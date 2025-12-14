"""
沙箱执行工具
在 Docker 沙箱中执行代码和命令进行漏洞验证
"""

import asyncio
import json
import logging
import tempfile
import os
import shutil
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from dataclasses import dataclass

from .base import AgentTool, ToolResult

logger = logging.getLogger(__name__)


@dataclass
class SandboxConfig:
    """沙箱配置"""
    image: str = "deepaudit/sandbox:latest"
    memory_limit: str = "512m"
    cpu_limit: float = 1.0
    timeout: int = 60
    network_mode: str = "none"  # none, bridge, host
    read_only: bool = True
    user: str = "1000:1000"


class SandboxManager:
    """
    沙箱管理器
    管理 Docker 容器的创建、执行和清理
    """
    
    def __init__(self, config: Optional[SandboxConfig] = None):
        self.config = config or SandboxConfig()
        self._docker_client = None
        self._initialized = False
    
    async def initialize(self):
        """初始化 Docker 客户端"""
        if self._initialized:
            return
        
        try:
            import docker
            self._docker_client = docker.from_env()
            # 测试连接
            self._docker_client.ping()
            self._initialized = True
            logger.info("Docker sandbox manager initialized")
        except Exception as e:
            logger.warning(f"Docker not available: {e}")
            self._docker_client = None
    
    @property
    def is_available(self) -> bool:
        """检查 Docker 是否可用"""
        return self._docker_client is not None
    
    async def execute_command(
        self,
        command: str,
        working_dir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        在沙箱中执行命令
        
        Args:
            command: 要执行的命令
            working_dir: 工作目录
            env: 环境变量
            timeout: 超时时间（秒）
            
        Returns:
            执行结果
        """
        if not self.is_available:
            return {
                "success": False,
                "error": "Docker 不可用",
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
            }
        
        timeout = timeout or self.config.timeout
        
        try:
            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                # 准备容器配置
                container_config = {
                    "image": self.config.image,
                    "command": ["sh", "-c", command],
                    "detach": True,
                    "mem_limit": self.config.memory_limit,
                    "cpu_period": 100000,
                    "cpu_quota": int(100000 * self.config.cpu_limit),
                    "network_mode": self.config.network_mode,
                    "user": self.config.user,
                    "read_only": self.config.read_only,
                    "volumes": {
                        temp_dir: {"bind": "/workspace", "mode": "rw"},
                    },
                    "tmpfs": {
                            "/home/sandbox": "rw,size=100m,mode=1777",
                            "/tmp": "rw,size=100m,mode=1777"
                        },
                    "working_dir": working_dir or "/workspace",
                    "environment": env or {},
                    # 安全配置
                    "cap_drop": ["ALL"],
                    "security_opt": ["no-new-privileges:true"],
                }
                
                # 创建并启动容器
                container = await asyncio.to_thread(
                    self._docker_client.containers.run,
                    **container_config
                )
                
                try:
                    # 等待执行完成
                    result = await asyncio.wait_for(
                        asyncio.to_thread(container.wait),
                        timeout=timeout
                    )
                    
                    # 获取日志
                    stdout = await asyncio.to_thread(
                        container.logs, stdout=True, stderr=False
                    )
                    stderr = await asyncio.to_thread(
                        container.logs, stdout=False, stderr=True
                    )
                    
                    return {
                        "success": result["StatusCode"] == 0,
                        "stdout": stdout.decode('utf-8', errors='ignore')[:10000],
                        "stderr": stderr.decode('utf-8', errors='ignore')[:2000],
                        "exit_code": result["StatusCode"],
                        "error": None,
                    }
                    
                except asyncio.TimeoutError:
                    await asyncio.to_thread(container.kill)
                    return {
                        "success": False,
                        "error": f"执行超时 ({timeout}秒)",
                        "stdout": "",
                        "stderr": "",
                        "exit_code": -1,
                    }
                    
                finally:
                    # 清理容器
                    await asyncio.to_thread(container.remove, force=True)
                    
        except Exception as e:
            logger.error(f"Sandbox execution error: {e}")
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
            }
    
    async def execute_tool_command(
        self,
        command: str,
        host_workdir: str,
        timeout: Optional[int] = None,
        env: Optional[Dict[str, str]] = None,
        network_mode: str = "none",
    ) -> Dict[str, Any]:
        """
        在沙箱中对指定目录执行工具命令
        
        Args:
            command: 要执行的命令
            host_workdir: 宿主机上的工作目录（将被挂载到 /workspace）
            timeout: 超时时间
            env: 环境变量
            network_mode: 网络模式 (none, bridge, host)
            
        Returns:
            执行结果
        """
        if not self.is_available:
            return {
                "success": False,
                "error": "Docker 不可用",
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
            }
        
        timeout = timeout or self.config.timeout
        
        try:
            # 准备容器配置
            container_config = {
                "image": self.config.image,
                "command": ["sh", "-c", command],
                "detach": True,
                "mem_limit": self.config.memory_limit,
                "cpu_period": 100000,
                "cpu_quota": int(100000 * self.config.cpu_limit),
                "network_mode": network_mode,
                "user": self.config.user,
                "read_only": self.config.read_only,
                "volumes": {
                    host_workdir: {"bind": "/workspace", "mode": "ro"}, # 只读挂载项目代码
                },
                "tmpfs": {
                    "/home/sandbox": "rw,size=100m,mode=1777"
                },
                "working_dir": "/workspace",
                "environment": env or {},
                "cap_drop": ["ALL"],
                "security_opt": ["no-new-privileges:true"],
            }
            
            # 创建并启动容器
            container = await asyncio.to_thread(
                self._docker_client.containers.run,
                **container_config
            )
            
            try:
                # 等待执行完成
                result = await asyncio.wait_for(
                    asyncio.to_thread(container.wait),
                    timeout=timeout
                )
                
                # 获取日志
                stdout = await asyncio.to_thread(
                    container.logs, stdout=True, stderr=False
                )
                stderr = await asyncio.to_thread(
                    container.logs, stdout=False, stderr=True
                )
                
                return {
                    "success": result["StatusCode"] == 0,
                    "stdout": stdout.decode('utf-8', errors='ignore')[:50000], # 增大日志限制
                    "stderr": stderr.decode('utf-8', errors='ignore')[:5000],
                    "exit_code": result["StatusCode"],
                    "error": None,
                }
                
            except asyncio.TimeoutError:
                await asyncio.to_thread(container.kill)
                return {
                    "success": False,
                    "error": f"执行超时 ({timeout}秒)",
                    "stdout": "",
                    "stderr": "",
                    "exit_code": -1,
                }
                
            finally:
                # 清理容器
                await asyncio.to_thread(container.remove, force=True)
                
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
            }
    async def execute_python(
        self,
        code: str,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        在沙箱中执行 Python 代码
        
        Args:
            code: Python 代码
            timeout: 超时时间
            
        Returns:
            执行结果
        """
        # 转义代码中的单引号
        escaped_code = code.replace("'", "'\\''")
        command = f"python3 -c '{escaped_code}'"
        return await self.execute_command(command, timeout=timeout)
    
    async def execute_http_request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[str] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        在沙箱中执行 HTTP 请求
        
        Args:
            method: HTTP 方法
            url: URL
            headers: 请求头
            data: 请求体
            timeout: 超时
            
        Returns:
            HTTP 响应
        """
        # 构建 curl 命令
        curl_parts = ["curl", "-s", "-S", "-w", "'\\n%{http_code}'", "-X", method]
        
        if headers:
            for key, value in headers.items():
                curl_parts.extend(["-H", f"'{key}: {value}'"])
        
        if data:
            curl_parts.extend(["-d", f"'{data}'"])
        
        curl_parts.append(f"'{url}'")
        
        command = " ".join(curl_parts)
        
        # 使用带网络的镜像
        original_network = self.config.network_mode
        self.config.network_mode = "bridge"  # 允许网络访问
        
        try:
            result = await self.execute_command(command, timeout=timeout)
            
            if result["success"] and result["stdout"]:
                lines = result["stdout"].strip().split('\n')
                if lines:
                    status_code = lines[-1].strip()
                    body = '\n'.join(lines[:-1])
                    return {
                        "success": True,
                        "status_code": int(status_code) if status_code.isdigit() else 0,
                        "body": body[:5000],
                        "error": None,
                    }
            
            return {
                "success": False,
                "status_code": 0,
                "body": "",
                "error": result.get("error") or result.get("stderr"),
            }
            
        finally:
            self.config.network_mode = original_network
    
    async def verify_vulnerability(
        self,
        vulnerability_type: str,
        target_url: str,
        payload: str,
        expected_pattern: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        验证漏洞
        
        Args:
            vulnerability_type: 漏洞类型
            target_url: 目标 URL
            payload: 攻击载荷
            expected_pattern: 期望在响应中匹配的模式
            
        Returns:
            验证结果
        """
        verification_result = {
            "vulnerability_type": vulnerability_type,
            "target_url": target_url,
            "payload": payload,
            "is_vulnerable": False,
            "evidence": None,
            "error": None,
        }
        
        try:
            # 发送请求
            response = await self.execute_http_request(
                method="GET" if "?" in target_url else "POST",
                url=target_url,
                data=payload if "?" not in target_url else None,
            )
            
            if not response["success"]:
                verification_result["error"] = response.get("error")
                return verification_result
            
            body = response.get("body", "")
            status_code = response.get("status_code", 0)
            
            # 检查响应
            if expected_pattern:
                import re
                if re.search(expected_pattern, body, re.IGNORECASE):
                    verification_result["is_vulnerable"] = True
                    verification_result["evidence"] = f"响应中包含预期模式: {expected_pattern}"
            else:
                # 根据漏洞类型进行通用检查
                if vulnerability_type == "sql_injection":
                    error_patterns = [
                        r"SQL syntax",
                        r"mysql_fetch",
                        r"ORA-\d+",
                        r"PostgreSQL.*ERROR",
                        r"SQLite.*error",
                        r"ODBC.*Driver",
                    ]
                    for pattern in error_patterns:
                        if re.search(pattern, body, re.IGNORECASE):
                            verification_result["is_vulnerable"] = True
                            verification_result["evidence"] = f"SQL错误信息: {pattern}"
                            break
                
                elif vulnerability_type == "xss":
                    if payload in body:
                        verification_result["is_vulnerable"] = True
                        verification_result["evidence"] = "XSS payload 被反射到响应中"
                
                elif vulnerability_type == "command_injection":
                    # 检查命令执行结果
                    if "uid=" in body or "root:" in body:
                        verification_result["is_vulnerable"] = True
                        verification_result["evidence"] = "命令执行成功"
            
            verification_result["response_status"] = status_code
            verification_result["response_length"] = len(body)
            
        except Exception as e:
            verification_result["error"] = str(e)
        
        return verification_result


class SandboxCommandInput(BaseModel):
    """沙箱命令输入"""
    command: str = Field(description="要执行的命令")
    timeout: int = Field(default=30, description="超时时间（秒）")


class SandboxTool(AgentTool):
    """
    沙箱执行工具
    在安全隔离的环境中执行代码和命令
    """
    
    # 允许的命令前缀
    ALLOWED_COMMANDS = [
        "python", "python3", "node", "curl", "wget",
        "cat", "head", "tail", "grep", "find", "ls",
        "echo", "printf", "test", "id", "whoami",
    ]
    
    def __init__(self, sandbox_manager: Optional[SandboxManager] = None):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
    
    @property
    def name(self) -> str:
        return "sandbox_exec"
    
    @property
    def description(self) -> str:
        return """在安全沙箱中执行命令或代码。
用于验证漏洞、测试 PoC 或执行安全检查。

⚠️ 安全限制:
- 命令在 Docker 容器中执行
- 网络默认隔离
- 资源有限制
- 只允许特定命令

允许的命令: python, python3, node, curl, cat, grep, find, ls, echo, id

使用场景:
- 验证命令注入漏洞
- 执行 PoC 代码
- 测试 payload 效果"""
    
    @property
    def args_schema(self):
        return SandboxCommandInput
    
    async def _execute(
        self,
        command: str,
        timeout: int = 30,
        **kwargs
    ) -> ToolResult:
        """执行沙箱命令"""
        # 初始化沙箱
        await self.sandbox_manager.initialize()
        
        if not self.sandbox_manager.is_available:
            return ToolResult(
                success=False,
                error="沙箱环境不可用（Docker 未安装或未运行）",
            )
        
        # 安全检查：验证命令是否允许
        cmd_parts = command.strip().split()
        if not cmd_parts:
            return ToolResult(success=False, error="命令不能为空")
        
        base_cmd = cmd_parts[0]
        if not any(base_cmd.startswith(allowed) for allowed in self.ALLOWED_COMMANDS):
            return ToolResult(
                success=False,
                error=f"命令 '{base_cmd}' 不在允许列表中。允许的命令: {', '.join(self.ALLOWED_COMMANDS)}",
            )
        
        # 执行命令
        result = await self.sandbox_manager.execute_command(
            command=command,
            timeout=timeout,
        )
        
        # 格式化输出
        output_parts = ["🐳 沙箱执行结果\n"]
        output_parts.append(f"命令: {command}")
        output_parts.append(f"退出码: {result['exit_code']}")
        
        if result["stdout"]:
            output_parts.append(f"\n标准输出:\n```\n{result['stdout']}\n```")
        
        if result["stderr"]:
            output_parts.append(f"\n标准错误:\n```\n{result['stderr']}\n```")
        
        if result.get("error"):
            output_parts.append(f"\n错误: {result['error']}")
        
        return ToolResult(
            success=result["success"],
            data="\n".join(output_parts),
            error=result.get("error"),
            metadata={
                "command": command,
                "exit_code": result["exit_code"],
            }
        )


class HttpRequestInput(BaseModel):
    """HTTP 请求输入"""
    method: str = Field(default="GET", description="HTTP 方法 (GET, POST, PUT, DELETE)")
    url: str = Field(description="请求 URL")
    headers: Optional[Dict[str, str]] = Field(default=None, description="请求头")
    data: Optional[str] = Field(default=None, description="请求体")
    timeout: int = Field(default=30, description="超时时间（秒）")


class SandboxHttpTool(AgentTool):
    """
    沙箱 HTTP 请求工具
    在沙箱中发送 HTTP 请求
    """
    
    def __init__(self, sandbox_manager: Optional[SandboxManager] = None):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
    
    @property
    def name(self) -> str:
        return "sandbox_http"
    
    @property
    def description(self) -> str:
        return """在沙箱中发送 HTTP 请求。
用于测试 Web 漏洞如 SQL 注入、XSS、SSRF 等。

输入:
- method: HTTP 方法
- url: 请求 URL
- headers: 可选，请求头
- data: 可选，请求体
- timeout: 超时时间

使用场景:
- 验证 SQL 注入漏洞
- 测试 XSS payload
- 验证 SSRF 漏洞
- 测试认证绕过"""
    
    @property
    def args_schema(self):
        return HttpRequestInput
    
    async def _execute(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[str] = None,
        timeout: int = 30,
        **kwargs
    ) -> ToolResult:
        """执行 HTTP 请求"""
        await self.sandbox_manager.initialize()
        
        if not self.sandbox_manager.is_available:
            return ToolResult(
                success=False,
                error="沙箱环境不可用",
            )
        
        result = await self.sandbox_manager.execute_http_request(
            method=method,
            url=url,
            headers=headers,
            data=data,
            timeout=timeout,
        )
        
        output_parts = ["🌐 HTTP 请求结果\n"]
        output_parts.append(f"请求: {method} {url}")
        
        if headers:
            output_parts.append(f"请求头: {json.dumps(headers, ensure_ascii=False)}")
        
        if data:
            output_parts.append(f"请求体: {data[:500]}")
        
        output_parts.append(f"\n状态码: {result.get('status_code', 'N/A')}")
        
        if result.get("body"):
            body = result["body"]
            if len(body) > 2000:
                body = body[:2000] + f"\n... (截断，共 {len(result['body'])} 字符)"
            output_parts.append(f"\n响应内容:\n```\n{body}\n```")
        
        if result.get("error"):
            output_parts.append(f"\n错误: {result['error']}")
        
        return ToolResult(
            success=result["success"],
            data="\n".join(output_parts),
            error=result.get("error"),
            metadata={
                "method": method,
                "url": url,
                "status_code": result.get("status_code"),
                "response_length": len(result.get("body", "")),
            }
        )


class VulnerabilityVerifyInput(BaseModel):
    """漏洞验证输入"""
    vulnerability_type: str = Field(description="漏洞类型 (sql_injection, xss, command_injection, etc.)")
    target_url: str = Field(description="目标 URL")
    payload: str = Field(description="攻击载荷")
    expected_pattern: Optional[str] = Field(default=None, description="期望在响应中匹配的正则模式")


class VulnerabilityVerifyTool(AgentTool):
    """
    漏洞验证工具
    在沙箱中验证漏洞是否真实存在
    """
    
    def __init__(self, sandbox_manager: Optional[SandboxManager] = None):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
    
    @property
    def name(self) -> str:
        return "verify_vulnerability"
    
    @property
    def description(self) -> str:
        return """验证漏洞是否真实存在。
发送包含攻击载荷的请求，分析响应判断漏洞是否可利用。

输入:
- vulnerability_type: 漏洞类型
- target_url: 目标 URL
- payload: 攻击载荷
- expected_pattern: 可选，期望在响应中匹配的模式

支持的漏洞类型:
- sql_injection: SQL 注入
- xss: 跨站脚本
- command_injection: 命令注入
- path_traversal: 路径遍历
- ssrf: 服务端请求伪造"""
    
    @property
    def args_schema(self):
        return VulnerabilityVerifyInput
    
    async def _execute(
        self,
        vulnerability_type: str,
        target_url: str,
        payload: str,
        expected_pattern: Optional[str] = None,
        **kwargs
    ) -> ToolResult:
        """执行漏洞验证"""
        await self.sandbox_manager.initialize()
        
        if not self.sandbox_manager.is_available:
            return ToolResult(
                success=False,
                error="沙箱环境不可用",
            )
        
        result = await self.sandbox_manager.verify_vulnerability(
            vulnerability_type=vulnerability_type,
            target_url=target_url,
            payload=payload,
            expected_pattern=expected_pattern,
        )
        
        output_parts = ["🔍 漏洞验证结果\n"]
        output_parts.append(f"漏洞类型: {vulnerability_type}")
        output_parts.append(f"目标: {target_url}")
        output_parts.append(f"Payload: {payload[:200]}")
        
        if result["is_vulnerable"]:
            output_parts.append(f"\n🔴 结果: 漏洞已确认!")
            output_parts.append(f"证据: {result.get('evidence', 'N/A')}")
        else:
            output_parts.append(f"\n🟢 结果: 未能确认漏洞")
            if result.get("error"):
                output_parts.append(f"错误: {result['error']}")
        
        if result.get("response_status"):
            output_parts.append(f"\nHTTP 状态码: {result['response_status']}")
        
        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": vulnerability_type,
                "is_vulnerable": result["is_vulnerable"],
                "evidence": result.get("evidence"),
            }
        )


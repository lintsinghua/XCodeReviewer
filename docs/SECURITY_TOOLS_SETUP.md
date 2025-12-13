# DeepAudit 安全工具安装指南

本文档介绍如何一键安装 DeepAudit Agent 审计所需的外部安全工具和沙盒环境。

## 安装的工具

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **Semgrep** | 静态代码分析，支持 30+ 语言 | pip |
| **Bandit** | Python 专用安全扫描 | pip |
| **Safety** | Python 依赖漏洞扫描 | pip |
| **Gitleaks** | Git 密钥泄露检测 | 二进制/brew |
| **OSV-Scanner** | 多语言依赖漏洞扫描 | 二进制/brew |
| **TruffleHog** | 高级密钥扫描 (可选) | pip/二进制 |
| **Docker 沙盒** | 漏洞验证隔离环境 | Docker |

## 快速开始

### macOS / Linux

```bash
# 进入项目目录
cd /path/to/XCodeReviewer

# 运行安装脚本
./scripts/setup_security_tools.sh
```

### Windows

**方式 1: 双击运行**
```
直接双击 scripts\setup_security_tools.bat
```

**方式 2: PowerShell**
```powershell
# 进入项目目录
cd C:\path\to\XCodeReviewer

# 运行 PowerShell 脚本
.\scripts\setup_security_tools.ps1
```

**方式 3: 命令行参数**
```powershell
# 全部安装
.\scripts\setup_security_tools.ps1 -InstallAll

# 仅安装 Python 工具
.\scripts\setup_security_tools.ps1 -PythonOnly

# 仅验证安装状态
.\scripts\setup_security_tools.ps1 -VerifyOnly
```

## 安装选项

脚本提供以下安装选项：

1. **全部安装 (推荐)** - 安装所有工具 + 构建 Docker 沙盒
2. **仅 Python 工具** - `pip install semgrep bandit safety`
3. **仅系统工具** - 下载 gitleaks, osv-scanner 二进制
4. **仅 Docker 沙盒** - 构建 `deepaudit-sandbox:latest` 镜像
5. **仅验证安装状态** - 检查已安装的工具

## 手动安装

如果自动脚本无法工作，可以手动安装：

### Python 工具

```bash
pip install semgrep bandit safety

# 可选
pip install trufflehog
```

### macOS 系统工具

```bash
brew install gitleaks osv-scanner

# 可选
brew install trufflehog
```

### Windows 系统工具

**使用 Scoop (推荐):**
```powershell
# 安装 Scoop (如果没有)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 安装工具
scoop install gitleaks
```

**使用 Winget:**
```powershell
winget install --id=Gitleaks.Gitleaks -e
```

**手动下载:**
- Gitleaks: https://github.com/gitleaks/gitleaks/releases
- OSV-Scanner: https://github.com/google/osv-scanner/releases
- TruffleHog: https://github.com/trufflesecurity/trufflehog/releases

### Docker 沙盒

```bash
cd docker/sandbox
docker build -t deepaudit-sandbox:latest .

# 验证
docker run --rm deepaudit-sandbox:latest python3 --version
```

## 环境配置

安装完成后，确保 `backend/.env` 包含以下沙盒配置：

```env
# 沙盒配置
SANDBOX_IMAGE=deepaudit-sandbox:latest
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1.0
SANDBOX_TIMEOUT=60
SANDBOX_NETWORK_MODE=none
```

## 验证安装

运行以下命令验证安装：

```bash
# 检查各工具版本
semgrep --version
bandit --version
safety --version
gitleaks version
osv-scanner --version

# 检查 Docker 沙盒
docker image inspect deepaudit-sandbox:latest
```

## 常见问题

### Q: pip install 失败？

尝试使用 pip3 或指定 Python 版本：
```bash
python3 -m pip install semgrep bandit safety
```

### Q: Windows 上 PATH 未生效？

重启终端或手动添加工具目录到系统 PATH：
```
%LOCALAPPDATA%\DeepAudit\tools
```

### Q: Docker 构建失败？

1. 确保 Docker Desktop 已启动
2. 检查网络连接
3. 尝试手动拉取基础镜像：
   ```bash
   docker pull python:3.11-slim-bookworm
   ```

### Q: 某些工具不可用？

工具有回退机制：
- `semgrep_scan` 失败 → 使用 `pattern_match`
- `bandit_scan` 失败 → 使用 `pattern_match`
- 沙盒不可用 → 跳过动态验证

## 工具配置

工具的超时和开关可以在 `backend/app/services/agent/config.py` 中配置：

```python
# 工具开关
semgrep_enabled: bool = True
bandit_enabled: bool = True
gitleaks_enabled: bool = True

# 超时配置
semgrep_timeout_seconds: int = 120
bandit_timeout_seconds: int = 60
```

## 支持

如有问题，请：
1. 查看日志输出
2. 运行 `-VerifyOnly` 检查安装状态
3. 提交 Issue 到项目仓库

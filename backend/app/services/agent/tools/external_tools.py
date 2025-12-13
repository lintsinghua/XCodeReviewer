"""
外部安全工具集成
集成 Semgrep、Bandit、Gitleaks、TruffleHog、npm audit 等专业安全工具
"""

import asyncio
import json
import logging
import os
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from dataclasses import dataclass

from .base import AgentTool, ToolResult
from .sandbox_tool import SandboxManager

logger = logging.getLogger(__name__)


# ============ Semgrep 工具 ============

class SemgrepInput(BaseModel):
    """Semgrep 扫描输入"""
    target_path: str = Field(description="要扫描的目录或文件路径（相对于项目根目录）")
    rules: Optional[str] = Field(
        default="auto",
        description="规则集: auto, p/security-audit, p/owasp-top-ten, p/r2c-security-audit, 或自定义规则文件路径"
    )
    severity: Optional[str] = Field(
        default=None,
        description="过滤严重程度: ERROR, WARNING, INFO"
    )
    max_results: int = Field(default=50, description="最大返回结果数")


class SemgrepTool(AgentTool):
    """
    Semgrep 静态分析工具
    
    Semgrep 是一款快速、轻量级的静态分析工具，支持多种编程语言。
    提供丰富的安全规则库，可以检测各种安全漏洞。
    
    官方规则集:
    - p/security-audit: 综合安全审计
    - p/owasp-top-ten: OWASP Top 10 漏洞
    - p/r2c-security-audit: R2C 安全审计规则
    - p/python: Python 特定规则
    - p/javascript: JavaScript 特定规则
    """
    
    AVAILABLE_RULESETS = [
        "auto",
        "p/security-audit",
        "p/owasp-top-ten",
        "p/r2c-security-audit",
        "p/python",
        "p/javascript",
        "p/typescript",
        "p/java",
        "p/go",
        "p/php",
        "p/ruby",
        "p/secrets",
        "p/sql-injection",
        "p/xss",
        "p/command-injection",
    ]
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "semgrep_scan"
    
    @property
    def description(self) -> str:
        return """使用 Semgrep 进行静态安全分析。
Semgrep 是业界领先的静态分析工具，支持 30+ 种编程语言。

可用规则集:
- auto: 自动选择最佳规则
- p/security-audit: 综合安全审计
- p/owasp-top-ten: OWASP Top 10 漏洞检测
- p/secrets: 密钥泄露检测
- p/sql-injection: SQL 注入检测
- p/xss: XSS 检测
- p/command-injection: 命令注入检测

使用场景:
- 快速全面的代码安全扫描
- 检测常见安全漏洞模式
- 遵循行业安全标准审计"""
    
    @property
    def args_schema(self):
        return SemgrepInput
    
    async def _execute(
        self,
        target_path: str = ".",
        rules: str = "auto",
        severity: Optional[str] = None,
        max_results: int = 50,
        **kwargs
    ) -> ToolResult:
        """执行 Semgrep 扫描"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用，无法执行 Semgrep")

        # 构建命令 (相对于 /workspace)
        # 注意: target_path 是相对于 project_root 的
        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        
        cmd = ["semgrep", "--json", "--quiet"]
        
        if rules == "auto":
            cmd.extend(["--config", "auto"])
        elif rules.startswith("p/"):
            cmd.extend(["--config", rules])
        else:
            cmd.extend(["--config", rules])
        
        if severity:
            cmd.extend(["--severity", severity])
        
        # 在容器内，路径相对于 /workspace
        cmd.append(safe_target_path)
        
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=300
            )
            
            if not result["success"] and result["exit_code"] != 1:  # 1 means findings were found
                return ToolResult(
                    success=False,
                    error=f"Semgrep 执行失败: {result['stderr'][:500] or result['error']}",
                )
            
            # 解析结果
            try:
                # 尝试从 stdout 查找 JSON
                json_start = result['stdout'].find('{')
                if json_start >= 0:
                    results = json.loads(result['stdout'][json_start:])
                else:
                    results = {}
            except json.JSONDecodeError:
                return ToolResult(
                    success=False,
                    error=f"无法解析 Semgrep 输出: {result['stdout'][:200]}",
                )
            
            findings = results.get("results", [])[:max_results]
            
            if not findings:
                return ToolResult(
                    success=True,
                    data=f"Semgrep 扫描完成，未发现安全问题 (规则集: {rules})",
                    metadata={"findings_count": 0, "rules": rules}
                )
            
            # 格式化输出
            output_parts = [f"🔍 Semgrep 扫描结果 (规则集: {rules})\n"]
            output_parts.append(f"发现 {len(findings)} 个问题:\n")
            
            severity_icons = {"ERROR": "🔴", "WARNING": "🟠", "INFO": "🟡"}
            
            for i, finding in enumerate(findings[:max_results]):
                sev = finding.get("extra", {}).get("severity", "INFO")
                icon = severity_icons.get(sev, "⚪")
                
                output_parts.append(f"\n{icon} [{sev}] {finding.get('check_id', 'unknown')}")
                output_parts.append(f"   文件: {finding.get('path', '')}:{finding.get('start', {}).get('line', 0)}")
                output_parts.append(f"   消息: {finding.get('extra', {}).get('message', '')[:200]}")
                
                # 代码片段
                lines = finding.get("extra", {}).get("lines", "")
                if lines:
                    output_parts.append(f"   代码: {lines[:150]}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={
                    "findings_count": len(findings),
                    "rules": rules,
                    "findings": findings[:10],
                }
            )
            
        except Exception as e:
            return ToolResult(
                success=False, 
                error=f"Semgrep 执行错误: {str(e)}"
            )


# ============ Bandit 工具 (Python) ============

class BanditInput(BaseModel):
    """Bandit 扫描输入"""
    target_path: str = Field(default=".", description="要扫描的 Python 目录或文件")
    severity: str = Field(default="medium", description="最低严重程度: low, medium, high")
    confidence: str = Field(default="medium", description="最低置信度: low, medium, high")
    max_results: int = Field(default=50, description="最大返回结果数")


class BanditTool(AgentTool):
    """
    Bandit Python 安全扫描工具
    
    Bandit 是专门用于 Python 代码的安全分析工具，
    可以检测常见的 Python 安全问题，如：
    - 硬编码密码
    - SQL 注入
    - 命令注入
    - 不安全的随机数生成
    - 不安全的反序列化
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "bandit_scan"
    
    @property
    def description(self) -> str:
        return """使用 Bandit 扫描 Python 代码的安全问题。
Bandit 是 Python 专用的安全分析工具，由 OpenStack 安全团队开发。

检测项目:
- B101: assert 使用
- B102: exec 使用
- B103-B108: 文件权限问题
- B301-B312: pickle/yaml 反序列化
- B501-B508: SSL/TLS 问题
- B601-B608: shell/SQL 注入
- B701-B703: Jinja2 模板问题

仅适用于 Python 项目。"""
    
    @property
    def args_schema(self):
        return BanditInput
    
    async def _execute(
        self,
        target_path: str = ".",
        severity: str = "medium",
        confidence: str = "medium",
        max_results: int = 50,
        **kwargs
    ) -> ToolResult:
        """执行 Bandit 扫描"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        
        # 构建命令
        severity_map = {"low": "l", "medium": "m", "high": "h"}
        confidence_map = {"low": "l", "medium": "m", "high": "h"}
        
        cmd = [
            "bandit", "-r", "-f", "json",
            "-ll" if severity == "low" else f"-l{severity_map.get(severity, 'm')}",
            f"-i{confidence_map.get(confidence, 'm')}",
            safe_target_path
        ]
        
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=120
            )
            
            try:
                # find json in output
                json_start = result['stdout'].find('{')
                if json_start >= 0:
                    results = json.loads(result['stdout'][json_start:])
                else:
                    results = {}
            except json.JSONDecodeError:
                return ToolResult(success=False, error=f"无法解析 Bandit 输出: {result['stdout'][:200]}")
            
            findings = results.get("results", [])[:max_results]
            
            if not findings:
                return ToolResult(
                    success=True,
                    data="Bandit 扫描完成，未发现 Python 安全问题",
                    metadata={"findings_count": 0}
                )
            
            output_parts = ["🐍 Bandit Python 安全扫描结果\n"]
            output_parts.append(f"发现 {len(findings)} 个问题:\n")
            
            severity_icons = {"HIGH": "🔴", "MEDIUM": "🟠", "LOW": "🟡"}
            
            for finding in findings:
                sev = finding.get("issue_severity", "LOW")
                icon = severity_icons.get(sev, "⚪")
                
                output_parts.append(f"\n{icon} [{sev}] {finding.get('test_id', '')}: {finding.get('test_name', '')}")
                output_parts.append(f"   文件: {finding.get('filename', '')}:{finding.get('line_number', 0)}")
                output_parts.append(f"   消息: {finding.get('issue_text', '')[:200]}")
                output_parts.append(f"   代码: {finding.get('code', '')[:100]}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={"findings_count": len(findings), "findings": findings[:10]}
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"Bandit 执行错误: {str(e)}")


# ============ Gitleaks 工具 ============

class GitleaksInput(BaseModel):
    """Gitleaks 扫描输入"""
    target_path: str = Field(default=".", description="要扫描的目录")
    no_git: bool = Field(default=True, description="不使用 git history，仅扫描文件")
    max_results: int = Field(default=50, description="最大返回结果数")


class GitleaksTool(AgentTool):
    """
    Gitleaks 密钥泄露检测工具
    
    Gitleaks 是一款专门用于检测代码中硬编码密钥的工具。
    可以检测：
    - API Keys (AWS, GCP, Azure, GitHub, etc.)
    - 私钥 (RSA, SSH, PGP)
    - 数据库凭据
    - OAuth tokens
    - JWT secrets
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "gitleaks_scan"
    
    @property
    def description(self) -> str:
        return """使用 Gitleaks 检测代码中的密钥泄露。
Gitleaks 是专业的密钥检测工具，支持 150+ 种密钥类型。

检测类型:
- AWS Access Keys / Secret Keys
- GCP API Keys / Service Account Keys
- Azure Credentials
- GitHub / GitLab Tokens
- Private Keys (RSA, SSH, PGP)
- Database Connection Strings
- JWT Secrets
- Slack / Discord Tokens
- 等等...

建议在代码审计早期使用此工具。"""
    
    @property
    def args_schema(self):
        return GitleaksInput
    
    async def _execute(
        self,
        target_path: str = ".",
        no_git: bool = True,
        max_results: int = 50,
        **kwargs
    ) -> ToolResult:
        """执行 Gitleaks 扫描"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        
        # 构建命令 using . as source because we are mounted to /workspace
        # But if user specified a subdirectory, we append it.
        # Actually gitleaks detects pwd by default if source is .
        
        cmd = ["gitleaks", "detect", "--source", safe_target_path, "-f", "json"]
        if no_git:
            cmd.append("--no-git")
        
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=120
            )
            
            # Gitleaks returns 1 if secrets found
            if result['exit_code'] not in [0, 1]:
                 return ToolResult(success=False, error=f"Gitleaks 执行失败: {result['stderr'][:300]}")

            stdout = result['stdout']
            
            if not stdout.strip():
                return ToolResult(
                    success=True,
                    data="🔐 Gitleaks 扫描完成，未发现密钥泄露",
                    metadata={"findings_count": 0}
                )
            
            try:
                # Find JSON start
                json_start = stdout.find('[')
                if json_start >= 0:
                     findings = json.loads(stdout[json_start:])
                else:
                     findings = []
            except json.JSONDecodeError:
                findings = []
            
            if not findings:
                 return ToolResult(
                    success=True,
                    data="🔐 Gitleaks 扫描完成，未发现密钥泄露",
                    metadata={"findings_count": 0}
                )
            
            findings = findings[:max_results]
            
            output_parts = ["🔐 Gitleaks 密钥泄露检测结果\n"]
            output_parts.append(f"⚠️ 发现 {len(findings)} 处密钥泄露!\n")
            
            for i, finding in enumerate(findings):
                output_parts.append(f"\n🔴 [{i+1}] {finding.get('RuleID', 'unknown')}")
                output_parts.append(f"   描述: {finding.get('Description', '')}")
                output_parts.append(f"   文件: {finding.get('File', '')}:{finding.get('StartLine', 0)}")
                
                # 部分遮盖密钥
                secret = finding.get('Secret', '')
                if len(secret) > 8:
                    masked = secret[:4] + '*' * (len(secret) - 8) + secret[-4:]
                else:
                    masked = '*' * len(secret)
                output_parts.append(f"   密钥: {masked}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={
                    "findings_count": len(findings),
                    "findings": [
                        {"rule": f.get("RuleID"), "file": f.get("File"), "line": f.get("StartLine")}
                        for f in findings[:10]
                    ]
                }
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"Gitleaks 执行错误: {str(e)}")


# ============ npm audit 工具 ============

class NpmAuditInput(BaseModel):
    """npm audit 扫描输入"""
    target_path: str = Field(default=".", description="包含 package.json 的目录")
    production_only: bool = Field(default=False, description="仅扫描生产依赖")


class NpmAuditTool(AgentTool):
    """
    npm audit 依赖漏洞扫描工具
    
    扫描 Node.js 项目的依赖漏洞，基于 npm 官方漏洞数据库。
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "npm_audit"
    
    @property
    def description(self) -> str:
        return """使用 npm audit 扫描 Node.js 项目的依赖漏洞。
基于 npm 官方漏洞数据库，检测已知的依赖安全问题。

适用于:
- 包含 package.json 的 Node.js 项目
- 前端项目 (React, Vue, Angular 等)

需要先运行 npm install 安装依赖。"""
    
    @property
    def args_schema(self):
        return NpmAuditInput
    
    async def _execute(
        self,
        target_path: str = ".",
        production_only: bool = False,
        **kwargs
    ) -> ToolResult:
        """执行 npm audit"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        # 这里的 target_path 是相对于 project_root 的
        # 防止空路径
        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        if not safe_target_path:
            safe_target_path = "."
            
        full_path = os.path.normpath(os.path.join(self.project_root, target_path))
        
        # 宿主机预检查
        package_json = os.path.join(full_path, "package.json")
        if not os.path.exists(package_json):
            return ToolResult(
                success=False,
                error=f"未找到 package.json: {target_path}",
            )
        
        cmd = ["npm", "audit", "--json"]
        if production_only:
            cmd.append("--production")
        
        # 组合命令: cd 到目标目录然后执行
        cmd_str = f"cd {safe_target_path} && {' '.join(cmd)}"
        
        try:
            # 清除代理设置，避免容器内网络问题
            proxy_env = {
                "HTTPS_PROXY": "",
                "HTTP_PROXY": "",
                "https_proxy": "",
                "http_proxy": ""
            }
            
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=120,
                network_mode="bridge",
                env=proxy_env
            )
            
            try:
                # npm audit json starts with {
                json_start = result['stdout'].find('{')
                if json_start >= 0:
                    results = json.loads(result['stdout'][json_start:])
                else:
                    return ToolResult(success=True, data=f"npm audit 输出为空或格式错误: {result['stdout'][:100]}")
            except json.JSONDecodeError:
                return ToolResult(success=True, data=f"npm audit 输出格式错误")
            
            vulnerabilities = results.get("vulnerabilities", {})
            
            if not vulnerabilities:
                return ToolResult(
                    success=True,
                    data="📦 npm audit 完成，未发现依赖漏洞",
                    metadata={"findings_count": 0}
                )
            
            output_parts = ["📦 npm audit 依赖漏洞扫描结果\n"]
            
            severity_counts = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
            for name, vuln in vulnerabilities.items():
                severity = vuln.get("severity", "low")
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            output_parts.append(f"漏洞统计: 🔴 Critical: {severity_counts['critical']}, 🟠 High: {severity_counts['high']}, 🟡 Moderate: {severity_counts['moderate']}, 🟢 Low: {severity_counts['low']}\n")
            
            severity_icons = {"critical": "🔴", "high": "🟠", "moderate": "🟡", "low": "🟢"}
            
            for name, vuln in list(vulnerabilities.items())[:20]:
                sev = vuln.get("severity", "low")
                icon = severity_icons.get(sev, "⚪")
                output_parts.append(f"\n{icon} [{sev.upper()}] {name}")
                output_parts.append(f"   版本范围: {vuln.get('range', 'unknown')}")
                
                via = vuln.get("via", [])
                if via and isinstance(via[0], dict):
                    output_parts.append(f"   来源: {via[0].get('title', '')[:100]}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={
                    "findings_count": len(vulnerabilities),
                    "severity_counts": severity_counts,
                }
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"npm audit 错误: {str(e)}")


# ============ Safety 工具 (Python 依赖) ============

class SafetyInput(BaseModel):
    """Safety 扫描输入"""
    requirements_file: str = Field(default="requirements.txt", description="requirements 文件路径")


class SafetyTool(AgentTool):
    """
    Safety Python 依赖漏洞扫描工具
    
    检查 Python 依赖中的已知安全漏洞。
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "safety_scan"
    
    @property
    def description(self) -> str:
        return """使用 Safety 扫描 Python 依赖的安全漏洞。
基于 PyUp.io 漏洞数据库检测已知的依赖安全问题。

适用于:
- 包含 requirements.txt 的 Python 项目
- Pipenv 项目 (Pipfile.lock)
- Poetry 项目 (poetry.lock)"""
    
    @property
    def args_schema(self):
        return SafetyInput
    
    async def _execute(
        self,
        requirements_file: str = "requirements.txt",
        **kwargs
    ) -> ToolResult:
        """执行 Safety 扫描"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        full_path = os.path.join(self.project_root, requirements_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"未找到依赖文件: {requirements_file}")
            
        # commands
        # requirements_file relative path inside container is just requirements_file (assuming it's relative to root)
        # If requirements_file is absolute, we need to make it relative.
        # But for security, `requirements_file` should be relative to project_root.
        safe_req_file = requirements_file if not requirements_file.startswith("/") else requirements_file.lstrip("/")

        cmd = ["safety", "check", "-r", safe_req_file, "--json"]
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=120
            )
            
            stdout = result['stdout']
            try:
                # Safety 输出的 JSON 格式可能不同版本有差异
                # find first { or [
                start_idx = -1
                for i, char in enumerate(stdout):
                    if char in ['{', '[']:
                        start_idx = i
                        break
                
                if start_idx >= 0:
                     output_json = stdout[start_idx:]
                     if "No known security" in output_json:
                          return ToolResult(
                            success=True,
                            data="🐍 Safety 扫描完成，未发现 Python 依赖漏洞",
                            metadata={"findings_count": 0}
                        )
                     results = json.loads(output_json)
                else:
                     return ToolResult(success=True, data=f"Safety 输出:\n{stdout[:1000]}")

            except:
                return ToolResult(success=True, data=f"Safety 输出解析失败:\n{stdout[:1000]}")
            
            vulnerabilities = results if isinstance(results, list) else results.get("vulnerabilities", [])
            
            if not vulnerabilities:
                return ToolResult(
                    success=True,
                    data="🐍 Safety 扫描完成，未发现 Python 依赖漏洞",
                    metadata={"findings_count": 0}
                )
            
            output_parts = ["🐍 Safety Python 依赖漏洞扫描结果\n"]
            output_parts.append(f"发现 {len(vulnerabilities)} 个漏洞:\n")
            
            for vuln in vulnerabilities[:20]:
                if isinstance(vuln, list) and len(vuln) >= 4:
                    output_parts.append(f"\n🔴 {vuln[0]} ({vuln[1]})")
                    output_parts.append(f"   漏洞 ID: {vuln[4] if len(vuln) > 4 else 'N/A'}")
                    output_parts.append(f"   描述: {vuln[3][:200] if len(vuln) > 3 else ''}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={"findings_count": len(vulnerabilities)}
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"Safety 执行错误: {str(e)}")


# ============ TruffleHog 工具 ============

class TruffleHogInput(BaseModel):
    """TruffleHog 扫描输入"""
    target_path: str = Field(default=".", description="要扫描的目录")
    only_verified: bool = Field(default=False, description="仅显示已验证的密钥")


class TruffleHogTool(AgentTool):
    """
    TruffleHog 深度密钥扫描工具
    
    TruffleHog 可以检测代码和 Git 历史中的密钥泄露，
    并可以验证密钥是否仍然有效。
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "trufflehog_scan"
    
    @property
    def description(self) -> str:
        return """使用 TruffleHog 进行深度密钥扫描。
TruffleHog 可以扫描代码和 Git 历史，并验证密钥是否有效。

特点:
- 支持 700+ 种密钥类型
- 可以验证密钥是否仍然有效
- 扫描 Git 历史记录
- 高精度，低误报

建议与 Gitleaks 配合使用以获得最佳效果。"""
    
    @property
    def args_schema(self):
        return TruffleHogInput
    
    async def _execute(
        self,
        target_path: str = ".",
        only_verified: bool = False,
        **kwargs
    ) -> ToolResult:
        """执行 TruffleHog 扫描"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        
        cmd = ["trufflehog", "filesystem", safe_target_path, "--json"]
        if only_verified:
            cmd.append("--only-verified")
        
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=180
            )
            
            stdout = result['stdout']
            
            if not stdout.strip():
                return ToolResult(
                    success=True,
                    data="🔍 TruffleHog 扫描完成，未发现密钥泄露",
                    metadata={"findings_count": 0}
                )
            
            # TruffleHog 输出每行一个 JSON 对象
            findings = []
            for line in stdout.strip().split('\n'):
                if line.strip():
                    try:
                        findings.append(json.loads(line))
                    except:
                        pass
            
            if not findings:
                return ToolResult(
                    success=True,
                    data="🔍 TruffleHog 扫描完成，未发现密钥泄露",
                    metadata={"findings_count": 0}
                )
            
            output_parts = ["🔍 TruffleHog 密钥扫描结果\n"]
            output_parts.append(f"⚠️ 发现 {len(findings)} 处密钥泄露!\n")
            
            for i, finding in enumerate(findings[:20]):
                verified = "✅ 已验证有效" if finding.get("Verified") else "⚠️ 未验证"
                output_parts.append(f"\n🔴 [{i+1}] {finding.get('DetectorName', 'unknown')} - {verified}")
                output_parts.append(f"   文件: {finding.get('SourceMetadata', {}).get('Data', {}).get('Filesystem', {}).get('file', '')}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={"findings_count": len(findings)}
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"TruffleHog 执行错误: {str(e)}")


# ============ OSV-Scanner 工具 ============

class OSVScannerInput(BaseModel):
    """OSV-Scanner 扫描输入"""
    target_path: str = Field(default=".", description="要扫描的项目目录")


class OSVScannerTool(AgentTool):
    """
    OSV-Scanner 开源漏洞扫描工具
    
    Google 开源的漏洞扫描工具，使用 OSV 数据库。
    支持多种包管理器和锁文件。
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.sandbox_manager = SandboxManager()
    
    @property
    def name(self) -> str:
        return "osv_scan"
    
    @property
    def description(self) -> str:
        return """使用 OSV-Scanner 扫描开源依赖漏洞。
Google 开源的漏洞扫描工具，使用 OSV (Open Source Vulnerabilities) 数据库。

支持:
- package.json / package-lock.json (npm)
- requirements.txt / Pipfile.lock (Python)
- go.mod / go.sum (Go)
- Cargo.lock (Rust)
- pom.xml (Maven)
- Gemfile.lock (Ruby)
- composer.lock (PHP)

特点:
- 覆盖多种语言和包管理器
- 使用 Google 维护的漏洞数据库
- 快速、准确"""
    
    @property
    def args_schema(self):
        return OSVScannerInput
    
    async def _execute(
        self,
        target_path: str = ".",
        **kwargs
    ) -> ToolResult:
        """执行 OSV-Scanner"""
        # 确保 Docker 可用
        await self.sandbox_manager.initialize()
        if not self.sandbox_manager.is_available:
             return ToolResult(success=False, error="Docker 沙箱不可用")

        safe_target_path = target_path if not target_path.startswith("/") else target_path.lstrip("/")
        
        # OSV-Scanner
        cmd = ["osv-scanner", "--json", "-r", safe_target_path]
        cmd_str = " ".join(cmd)
        
        try:
            result = await self.sandbox_manager.execute_tool_command(
                command=cmd_str,
                host_workdir=self.project_root,
                timeout=120
            )
            
            stdout = result['stdout']
            
            try:
                results = json.loads(stdout)
            except:
                if "no package sources found" in stdout.lower():
                    return ToolResult(success=True, data="OSV-Scanner: 未找到可扫描的包文件")
                return ToolResult(success=True, data=f"OSV-Scanner 输出:\n{stdout[:1000]}")
            
            vulns = results.get("results", [])
            
            if not vulns:
                return ToolResult(
                    success=True,
                    data="📋 OSV-Scanner 扫描完成，未发现依赖漏洞",
                    metadata={"findings_count": 0}
                )
            
            total_vulns = sum(len(r.get("vulnerabilities", [])) for r in vulns)
            
            output_parts = ["📋 OSV-Scanner 开源漏洞扫描结果\n"]
            output_parts.append(f"发现 {total_vulns} 个漏洞:\n")
            
            for result in vulns[:10]:
                source = result.get("source", {}).get("path", "unknown")
                for vuln in result.get("vulnerabilities", [])[:5]:
                    vuln_id = vuln.get("id", "")
                    summary = vuln.get("summary", "")[:100]
                    output_parts.append(f"\n🔴 {vuln_id}")
                    output_parts.append(f"   来源: {source}")
                    output_parts.append(f"   描述: {summary}")
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata={"findings_count": total_vulns}
            )
            
        except Exception as e:
            return ToolResult(success=False, error=f"OSV-Scanner 执行错误: {str(e)}")


# ============ 导出所有工具 ============

__all__ = [
    "SemgrepTool",
    "BanditTool",
    "GitleaksTool",
    "NpmAuditTool",
    "SafetyTool",
    "TruffleHogTool",
    "OSVScannerTool",
]


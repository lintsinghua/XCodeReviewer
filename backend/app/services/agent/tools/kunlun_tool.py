"""
Kunlun-M 静态代码分析工具集成

Kunlun-M (昆仑镜) 是一款开源的静态代码安全审计工具，
支持 PHP、JavaScript 等语言的语义分析和漏洞检测。

MIT License
Copyright (c) 2017 Feei. <feei@feei.cn> All rights reserved

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

原始项目: https://github.com/LoRexxar/Kunlun-M
"""

import asyncio
import json
import logging
import os
import sys
import tempfile
import subprocess
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from pathlib import Path

from .base import AgentTool, ToolResult

logger = logging.getLogger(__name__)

# Kunlun-M 安装路径（相对于项目根目录）
KUNLUN_M_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))),
    "Kunlun-M-master"
)


class KunlunScanInput(BaseModel):
    """Kunlun-M 扫描输入"""
    target_path: str = Field(
        description="要扫描的目录或文件路径（相对于项目根目录）"
    )
    language: Optional[str] = Field(
        default=None,
        description="指定扫描语言: php, javascript, solidity, chromeext。不指定则自动检测"
    )
    rules: Optional[str] = Field(
        default=None,
        description="指定规则ID，多个规则用逗号分隔，如: 1000,1001,1002"
    )
    tamper: Optional[str] = Field(
        default=None,
        description="指定 tamper 名称，用于自定义修复函数检测"
    )
    include_unconfirmed: bool = Field(
        default=False,
        description="是否包含未确认的漏洞（疑似漏洞）"
    )
    max_results: int = Field(
        default=50,
        description="最大返回结果数"
    )


class KunlunRuleListInput(BaseModel):
    """Kunlun-M 规则列表输入"""
    language: Optional[str] = Field(
        default=None,
        description="按语言过滤规则: php, javascript, solidity, chromeext"
    )


class KunlunMTool(AgentTool):
    """
    Kunlun-M (昆仑镜) 静态代码安全审计工具

    特点：
    - 语义分析：深度AST分析，减少误报
    - 多语言支持：PHP、JavaScript 语义分析，Solidity、Chrome Extension 基础扫描
    - 函数回溯：支持污点追踪和数据流分析
    - 丰富的规则库：覆盖 OWASP Top 10 等常见漏洞

    支持的漏洞类型：
    - SQL 注入
    - XSS 跨站脚本
    - 命令注入
    - 代码执行
    - 文件包含
    - 文件上传
    - 反序列化
    - SSRF
    - XXE
    - 等等...

    使用场景：
    - PHP 代码深度安全审计
    - JavaScript 代码安全扫描
    - 智能合约安全检查
    - Chrome 扩展安全审计

    原始项目: https://github.com/LoRexxar/Kunlun-M
    License: MIT
    """

    SUPPORTED_LANGUAGES = ["php", "javascript", "solidity", "chromeext"]

    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.kunlun_path = KUNLUN_M_PATH
        self._initialized = False
        self._db_initialized = False

    @property
    def name(self) -> str:
        return "kunlun_scan"

    @property
    def description(self) -> str:
        return """使用 Kunlun-M (昆仑镜) 进行静态代码安全审计。
Kunlun-M 是一款专注于代码安全审计的工具，特别擅长 PHP 和 JavaScript 的语义分析。

支持的语言：
- php: PHP 语义分析（最完善）
- javascript: JavaScript 语义分析
- solidity: 智能合约基础扫描
- chromeext: Chrome 扩展安全检查

主要功能：
- 深度 AST 语义分析
- 污点追踪和函数回溯
- 自定义规则和 tamper 支持
- 支持识别常见安全漏洞

使用场景：
- 对 PHP/JS 代码进行深度安全审计
- 检测 SQL 注入、XSS、命令注入等漏洞
- 分析代码中的危险函数调用
- 追踪用户输入的传播路径"""

    @property
    def args_schema(self):
        return KunlunScanInput

    async def _ensure_initialized(self) -> bool:
        """确保 Kunlun-M 已初始化"""
        if self._initialized:
            return True

        # 检查 Kunlun-M 是否存在
        if not os.path.exists(self.kunlun_path):
            logger.error(f"Kunlun-M not found at {self.kunlun_path}")
            return False

        kunlun_py = os.path.join(self.kunlun_path, "kunlun.py")
        if not os.path.exists(kunlun_py):
            logger.error(f"kunlun.py not found at {kunlun_py}")
            return False

        # 检查数据库是否已初始化
        db_path = os.path.join(self.kunlun_path, "db.sqlite3")
        if not os.path.exists(db_path):
            logger.info("Kunlun-M database not found, initializing...")
            try:
                await self._initialize_database()
            except Exception as e:
                logger.error(f"Failed to initialize Kunlun-M database: {e}")
                return False

        self._initialized = True
        return True

    async def _initialize_database(self):
        """初始化 Kunlun-M 数据库"""
        # 复制 settings.py
        settings_bak = os.path.join(self.kunlun_path, "Kunlun_M", "settings.py.bak")
        settings_py = os.path.join(self.kunlun_path, "Kunlun_M", "settings.py")

        if os.path.exists(settings_bak) and not os.path.exists(settings_py):
            import shutil
            shutil.copy(settings_bak, settings_py)

        # 运行初始化命令
        init_cmd = [
            sys.executable,
            os.path.join(self.kunlun_path, "kunlun.py"),
            "init", "initialize"
        ]

        process = await asyncio.create_subprocess_exec(
            *init_cmd,
            cwd=self.kunlun_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "DJANGO_SETTINGS_MODULE": "Kunlun_M.settings"}
        )

        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120)

        if process.returncode != 0:
            raise Exception(f"Database init failed: {stderr.decode()}")

        # 加载规则
        load_cmd = [
            sys.executable,
            os.path.join(self.kunlun_path, "kunlun.py"),
            "config", "load"
        ]

        process = await asyncio.create_subprocess_exec(
            *load_cmd,
            cwd=self.kunlun_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "DJANGO_SETTINGS_MODULE": "Kunlun_M.settings"}
        )

        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120)

        self._db_initialized = True
        logger.info("Kunlun-M database initialized successfully")

    async def _execute(
        self,
        target_path: str = ".",
        language: Optional[str] = None,
        rules: Optional[str] = None,
        tamper: Optional[str] = None,
        include_unconfirmed: bool = False,
        max_results: int = 50,
        **kwargs
    ) -> ToolResult:
        """执行 Kunlun-M 扫描"""

        # 确保初始化
        if not await self._ensure_initialized():
            return ToolResult(
                success=False,
                error="Kunlun-M 未正确安装或初始化失败。请确保 Kunlun-M-master 目录存在且依赖已安装。"
            )

        # 构建完整目标路径
        if target_path.startswith("/"):
            full_target = target_path
        else:
            full_target = os.path.join(self.project_root, target_path)

        if not os.path.exists(full_target):
            return ToolResult(
                success=False,
                error=f"目标路径不存在: {target_path}"
            )

        # 构建扫描命令
        cmd = [
            sys.executable,
            os.path.join(self.kunlun_path, "kunlun.py"),
            "scan",
            "-t", full_target,
            "-o", "json"  # JSON 输出格式
        ]

        # 添加语言参数
        if language:
            if language.lower() not in self.SUPPORTED_LANGUAGES:
                return ToolResult(
                    success=False,
                    error=f"不支持的语言: {language}。支持: {', '.join(self.SUPPORTED_LANGUAGES)}"
                )
            cmd.extend(["-l", language.lower()])

        # 添加规则参数
        if rules:
            cmd.extend(["-r", rules])

        # 添加 tamper 参数
        if tamper:
            cmd.extend(["-tp", tamper])

        # 包含未确认漏洞
        if include_unconfirmed:
            cmd.append("-uc")

        try:
            # 创建临时输出文件
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                output_file = f.name

            # 修改命令使用输出文件
            cmd.extend(["-o", output_file])

            logger.debug(f"Running Kunlun-M: {' '.join(cmd)}")

            # 执行扫描
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.kunlun_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "DJANGO_SETTINGS_MODULE": "Kunlun_M.settings"}
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=600  # 10 分钟超时
            )

            stdout_text = stdout.decode('utf-8', errors='ignore')
            stderr_text = stderr.decode('utf-8', errors='ignore')

            # 解析结果
            findings = await self._parse_results(stdout_text, stderr_text, output_file)

            # 清理临时文件
            try:
                os.unlink(output_file)
            except:
                pass

            if not findings:
                return ToolResult(
                    success=True,
                    data="🛡️ Kunlun-M 扫描完成，未发现安全问题",
                    metadata={
                        "findings_count": 0,
                        "target": target_path,
                        "language": language
                    }
                )

            # 格式化输出
            output = self._format_findings(findings[:max_results], target_path)

            return ToolResult(
                success=True,
                data=output,
                metadata={
                    "findings_count": len(findings),
                    "target": target_path,
                    "language": language,
                    "findings": findings[:10]  # 只在 metadata 中保存前10个
                }
            )

        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                error="Kunlun-M 扫描超时（10分钟）"
            )
        except Exception as e:
            logger.error(f"Kunlun-M scan error: {e}", exc_info=True)
            return ToolResult(
                success=False,
                error=f"扫描执行失败: {str(e)}"
            )

    async def _parse_results(
        self,
        stdout: str,
        stderr: str,
        output_file: str
    ) -> List[Dict[str, Any]]:
        """解析 Kunlun-M 扫描结果"""
        findings = []

        # 尝试从输出文件读取 JSON
        try:
            if os.path.exists(output_file):
                with open(output_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        findings.extend(data)
                    elif isinstance(data, dict) and 'vulnerabilities' in data:
                        findings.extend(data['vulnerabilities'])
        except Exception as e:
            logger.debug(f"Failed to parse output file: {e}")

        # 如果没有 JSON 输出，尝试从 stdout 解析
        if not findings and stdout:
            # 尝试提取 JSON 部分
            try:
                json_start = stdout.find('[')
                json_end = stdout.rfind(']') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = stdout[json_start:json_end]
                    findings = json.loads(json_str)
            except:
                pass

            # 尝试解析表格格式输出
            if not findings:
                findings = self._parse_table_output(stdout)

        return findings

    def _parse_table_output(self, output: str) -> List[Dict[str, Any]]:
        """解析 Kunlun-M 表格格式输出"""
        findings = []
        lines = output.split('\n')

        for line in lines:
            # 匹配漏洞行格式: | index | CVI-xxxx | rule_name | language | file:line | ...
            if '|' in line and 'CVI' in line:
                parts = [p.strip() for p in line.split('|') if p.strip()]
                if len(parts) >= 6:
                    try:
                        finding = {
                            "id": parts[1],  # CVI-xxxx
                            "rule_name": parts[2],
                            "language": parts[3],
                            "location": parts[4],
                            "author": parts[5] if len(parts) > 5 else "",
                            "code": parts[6] if len(parts) > 6 else "",
                            "analysis": parts[7] if len(parts) > 7 else "",
                        }
                        findings.append(finding)
                    except:
                        pass

        return findings

    def _format_findings(self, findings: List[Dict[str, Any]], target: str) -> str:
        """格式化漏洞发现"""
        output_parts = [
            f"🔍 Kunlun-M 扫描结果",
            f"目标: {target}",
            f"发现 {len(findings)} 个潜在安全问题:\n"
        ]

        severity_icons = {
            "CRITICAL": "🔴",
            "HIGH": "🟠",
            "MEDIUM": "🟡",
            "LOW": "🟢",
            "INFO": "⚪"
        }

        for i, finding in enumerate(findings, 1):
            # 获取严重程度
            severity = finding.get("severity", "MEDIUM")
            if isinstance(severity, int):
                if severity >= 9:
                    severity = "CRITICAL"
                elif severity >= 6:
                    severity = "HIGH"
                elif severity >= 3:
                    severity = "MEDIUM"
                else:
                    severity = "LOW"

            icon = severity_icons.get(severity.upper(), "⚪")

            output_parts.append(f"\n{icon} [{i}] {finding.get('rule_name', 'Unknown')}")
            output_parts.append(f"   ID: {finding.get('id', 'N/A')}")
            output_parts.append(f"   语言: {finding.get('language', 'N/A')}")

            location = finding.get('location') or finding.get('file_path', '')
            line_number = finding.get('line_number', '')
            if location:
                if line_number:
                    output_parts.append(f"   位置: {location}:{line_number}")
                else:
                    output_parts.append(f"   位置: {location}")

            code = finding.get('code') or finding.get('code_content', '')
            if code:
                code_preview = code[:100].strip().replace('\n', ' ')
                output_parts.append(f"   代码: {code_preview}")

            analysis = finding.get('analysis', '')
            if analysis:
                output_parts.append(f"   分析: {analysis}")

        return "\n".join(output_parts)


class KunlunRuleListTool(AgentTool):
    """
    查看 Kunlun-M 可用的扫描规则

    可以按语言过滤规则，了解支持检测的漏洞类型。
    """

    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.kunlun_path = KUNLUN_M_PATH

    @property
    def name(self) -> str:
        return "kunlun_list_rules"

    @property
    def description(self) -> str:
        return """查看 Kunlun-M 可用的扫描规则。

可以按语言过滤：
- php: PHP 规则
- javascript: JavaScript 规则
- solidity: 智能合约规则
- chromeext: Chrome 扩展规则

返回规则ID、名称、描述等信息，帮助选择合适的规则进行扫描。"""

    @property
    def args_schema(self):
        return KunlunRuleListInput

    async def _execute(
        self,
        language: Optional[str] = None,
        **kwargs
    ) -> ToolResult:
        """列出可用规则"""

        if not os.path.exists(self.kunlun_path):
            return ToolResult(
                success=False,
                error="Kunlun-M 未安装"
            )

        # 构建命令
        cmd = [
            sys.executable,
            os.path.join(self.kunlun_path, "kunlun.py"),
            "show", "rule"
        ]

        if language:
            cmd.extend(["-k", language.lower()])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.kunlun_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "DJANGO_SETTINGS_MODULE": "Kunlun_M.settings"}
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60
            )

            output = stdout.decode('utf-8', errors='ignore')

            if not output.strip():
                return ToolResult(
                    success=True,
                    data="未找到匹配的规则" if language else "规则列表为空，请先运行初始化",
                    metadata={"language": language}
                )

            return ToolResult(
                success=True,
                data=f"📋 Kunlun-M 规则列表{f' ({language})' if language else ''}:\n\n{output}",
                metadata={"language": language}
            )

        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                error="获取规则列表超时"
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=f"获取规则列表失败: {str(e)}"
            )


class KunlunPluginInput(BaseModel):
    """Kunlun-M 插件输入"""
    plugin_name: str = Field(
        description="插件名称: php_unserialize_chain_tools (PHP反序列化链分析), entrance_finder (入口点发现)"
    )
    target_path: str = Field(
        description="要分析的目标路径（相对于项目根目录）"
    )
    depth: int = Field(
        default=3,
        description="分析深度（仅对 entrance_finder 有效）"
    )


class KunlunPluginTool(AgentTool):
    """
    Kunlun-M 插件工具

    提供额外的分析功能：
    - php_unserialize_chain_tools: 自动化寻找 PHP 反序列化链
    - entrance_finder: 发现 PHP 代码中的入口点/路由
    """

    AVAILABLE_PLUGINS = {
        "php_unserialize_chain_tools": "PHP 反序列化链分析工具，用于发现潜在的反序列化攻击链",
        "entrance_finder": "入口点发现工具，帮助找到 PHP 代码中的入口页面和路由",
    }

    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
        self.kunlun_path = KUNLUN_M_PATH

    @property
    def name(self) -> str:
        return "kunlun_plugin"

    @property
    def description(self) -> str:
        return """运行 Kunlun-M 插件进行专项分析。

可用插件：
- php_unserialize_chain_tools: 自动分析 PHP 反序列化链，寻找 POP 链
- entrance_finder: 发现 PHP 入口点和路由

使用场景：
- 分析 PHP 框架的反序列化漏洞利用链
- 快速定位大型 PHP 项目的入口文件"""

    @property
    def args_schema(self):
        return KunlunPluginInput

    async def _execute(
        self,
        plugin_name: str,
        target_path: str = ".",
        depth: int = 3,
        **kwargs
    ) -> ToolResult:
        """执行插件"""

        if plugin_name not in self.AVAILABLE_PLUGINS:
            return ToolResult(
                success=False,
                error=f"未知插件: {plugin_name}。可用插件: {', '.join(self.AVAILABLE_PLUGINS.keys())}"
            )

        if not os.path.exists(self.kunlun_path):
            return ToolResult(
                success=False,
                error="Kunlun-M 未安装"
            )

        # 构建完整目标路径
        if target_path.startswith("/"):
            full_target = target_path
        else:
            full_target = os.path.join(self.project_root, target_path)

        if not os.path.exists(full_target):
            return ToolResult(
                success=False,
                error=f"目标路径不存在: {target_path}"
            )

        # 构建命令
        cmd = [
            sys.executable,
            os.path.join(self.kunlun_path, "kunlun.py"),
            "plugin", plugin_name,
            "-t", full_target
        ]

        if plugin_name == "entrance_finder":
            cmd.extend(["-l", str(depth)])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.kunlun_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "DJANGO_SETTINGS_MODULE": "Kunlun_M.settings"}
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=300  # 5 分钟超时
            )

            output = stdout.decode('utf-8', errors='ignore')

            if not output.strip():
                return ToolResult(
                    success=True,
                    data=f"插件 {plugin_name} 执行完成，未发现结果",
                    metadata={"plugin": plugin_name, "target": target_path}
                )

            return ToolResult(
                success=True,
                data=f"🔌 Kunlun-M 插件 [{plugin_name}] 分析结果:\n\n{output}",
                metadata={"plugin": plugin_name, "target": target_path}
            )

        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                error=f"插件 {plugin_name} 执行超时"
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=f"插件执行失败: {str(e)}"
            )

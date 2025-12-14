"""
漏洞验证专用工具
支持各类经典漏洞的沙箱验证测试
"""

import asyncio
import json
import logging
import os
import re
import tempfile
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from dataclasses import dataclass
from enum import Enum

from .base import AgentTool, ToolResult
from .sandbox_tool import SandboxManager

logger = logging.getLogger(__name__)


class VulnType(str, Enum):
    """漏洞类型枚举"""
    SQL_INJECTION = "sql_injection"
    COMMAND_INJECTION = "command_injection"
    CODE_INJECTION = "code_injection"
    XSS = "xss"
    PATH_TRAVERSAL = "path_traversal"
    SSRF = "ssrf"
    XXE = "xxe"
    DESERIALIZATION = "deserialization"
    SSTI = "ssti"
    LDAP_INJECTION = "ldap_injection"
    NOSQL_INJECTION = "nosql_injection"
    XPATH_INJECTION = "xpath_injection"


# ============ 命令注入测试工具 ============

class CommandInjectionTestInput(BaseModel):
    """命令注入测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    param_name: str = Field(default="cmd", description="注入参数名")
    test_command: str = Field(default="id", description="测试命令: id, whoami, echo test, cat /etc/passwd")
    language: str = Field(default="auto", description="语言: auto, php, python, javascript, java, go, ruby, shell")
    injection_point: Optional[str] = Field(default=None, description="注入点描述，如 'shell_exec($_GET[cmd])'")


class CommandInjectionTestTool(AgentTool):
    """
    命令注入漏洞测试工具

    支持多种语言和框架，自动构建测试环境
    """

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_command_injection"

    @property
    def description(self) -> str:
        return """专门测试命令注入漏洞的工具。

支持语言: PHP, Python, JavaScript, Java, Go, Ruby, Shell

输入:
- target_file: 目标文件路径
- param_name: 注入参数名 (默认 'cmd')
- test_command: 测试命令 (默认 'id')
  - 'id' - 显示用户ID
  - 'whoami' - 显示用户名
  - 'cat /etc/passwd' - 读取密码文件
  - 'echo VULN_TEST' - 输出测试字符串
- language: 语言 (auto 自动检测)

示例:
1. PHP: {"target_file": "vuln.php", "param_name": "cmd", "test_command": "whoami"}
2. Python: {"target_file": "app.py", "param_name": "cmd", "language": "python"}
3. 自定义: {"target_file": "api.js", "test_command": "echo PWNED"}

漏洞确认条件:
- 命令输出包含预期结果 (uid=, root, www-data 等)
- 或自定义 echo 内容出现在输出中"""

    @property
    def args_schema(self):
        return CommandInjectionTestInput

    def _detect_language(self, file_path: str, code: str) -> str:
        """自动检测语言"""
        ext = os.path.splitext(file_path)[1].lower()
        ext_map = {
            ".php": "php",
            ".py": "python",
            ".js": "javascript",
            ".ts": "javascript",
            ".java": "java",
            ".go": "go",
            ".rb": "ruby",
            ".sh": "shell",
            ".bash": "shell",
        }
        if ext in ext_map:
            return ext_map[ext]

        # 基于内容检测
        if "<?php" in code or "<?=" in code:
            return "php"
        if "import " in code and ("os." in code or "subprocess" in code):
            return "python"
        if "require(" in code or "import " in code:
            return "javascript"
        if "package main" in code:
            return "go"
        if "class " in code and "public " in code:
            return "java"
        if "#!/bin/bash" in code or "#!/bin/sh" in code:
            return "shell"

        return "shell"  # 默认

    async def _execute(
        self,
        target_file: str,
        param_name: str = "cmd",
        test_command: str = "id",
        language: str = "auto",
        injection_point: Optional[str] = None,
        **kwargs
    ) -> ToolResult:
        """执行命令注入测试"""
        try:
            await self.sandbox_manager.initialize()
        except Exception as e:
            logger.warning(f"Sandbox init failed: {e}")

        if not self.sandbox_manager.is_available:
            return ToolResult(success=False, error="沙箱环境不可用")

        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言
        if language == "auto":
            language = self._detect_language(target_file, code)

        # 根据语言构建测试
        result = await self._test_by_language(language, code, param_name, test_command)

        # 分析结果
        is_vulnerable = False
        evidence = None
        poc = None

        if result["exit_code"] == 0 and result.get("stdout"):
            stdout = result["stdout"].strip()

            # 检测命令执行特征
            if test_command in ["id", "whoami"]:
                patterns = ["uid=", "root", "www-data", "nobody", "daemon", "sandbox"]
                for pattern in patterns:
                    if pattern in stdout.lower():
                        is_vulnerable = True
                        evidence = f"命令 '{test_command}' 执行成功，输出包含 '{pattern}'"
                        break
                # 如果有任何输出且包含典型格式
                if not is_vulnerable and stdout:
                    is_vulnerable = True
                    evidence = f"命令 '{test_command}' 有输出: {stdout[:100]}"

            elif test_command.startswith("echo "):
                expected = test_command[5:]
                if expected.lower() in stdout.lower():
                    is_vulnerable = True
                    evidence = f"Echo 命令执行成功，输出包含 '{expected}'"

            elif test_command.startswith("cat "):
                if ":" in stdout or "root" in stdout.lower() or "bin" in stdout.lower():
                    is_vulnerable = True
                    evidence = f"文件读取成功: {stdout[:100]}"

            else:
                # 通用检测
                if len(stdout) > 0:
                    is_vulnerable = True
                    evidence = f"命令可能执行成功，输出: {stdout[:200]}"

        if is_vulnerable:
            poc = f"curl 'http://target/{target_file}?{param_name}={test_command.replace(' ', '+')}"

        # 格式化输出
        output_parts = ["🎯 命令注入测试结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"语言: {language}")
        output_parts.append(f"注入参数: {param_name}")
        output_parts.append(f"测试命令: {test_command}")

        output_parts.append(f"\n退出码: {result['exit_code']}")

        if result.get("stdout"):
            output_parts.append(f"\n命令输出:\n```\n{result['stdout'][:2000]}\n```")
        if result.get("stderr"):
            output_parts.append(f"\n错误输出:\n```\n{result['stderr'][:500]}\n```")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **漏洞已确认!**")
            output_parts.append(f"证据: {evidence}")
            if poc:
                output_parts.append(f"\nPoC: `{poc}`")
        else:
            output_parts.append(f"\n\n🟡 未能确认漏洞")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "command_injection",
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "poc": poc,
                "language": language,
            }
        )

    async def _test_by_language(self, language: str, code: str, param_name: str, test_command: str) -> Dict:
        """根据语言执行测试"""
        if language == "php":
            return await self._test_php(code, param_name, test_command)
        elif language == "python":
            return await self._test_python(code, param_name, test_command)
        elif language in ["javascript", "js", "node"]:
            return await self._test_javascript(code, param_name, test_command)
        elif language == "java":
            return await self._test_java(code, param_name, test_command)
        elif language in ["go", "golang"]:
            return await self._test_go(code, param_name, test_command)
        elif language in ["ruby", "rb"]:
            return await self._test_ruby(code, param_name, test_command)
        else:
            return await self._test_shell(code, param_name, test_command)

    async def _test_php(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 PHP 命令注入

        注意: php -r 不需要 <?php 标签，直接执行纯 PHP 代码
        """
        # 模拟超全局变量（不需要 <?php 标签）
        wrapper = f"""$_GET['{param_name}'] = '{test_command}';
$_POST['{param_name}'] = '{test_command}';
$_REQUEST['{param_name}'] = '{test_command}';
"""
        # 清理原代码的 PHP 标签
        clean_code = code.strip()
        if clean_code.startswith("<?php"):
            clean_code = clean_code[5:]
        elif clean_code.startswith("<?"):
            clean_code = clean_code[2:]
        if clean_code.endswith("?>"):
            clean_code = clean_code[:-2]

        full_code = wrapper + clean_code.strip()
        escaped = full_code.replace("'", "'\"'\"'")
        return await self.sandbox_manager.execute_command(f"php -r '{escaped}'", timeout=30)

    async def _test_python(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 Python 命令注入"""
        wrapper = f"""
import sys, os

class MockArgs:
    def get(self, key, default=None):
        if key == '{param_name}':
            return '{test_command}'
        return default

class MockRequest:
    args = MockArgs()
    form = MockArgs()
    values = MockArgs()

request = MockRequest()
sys.argv = ['script.py', '{test_command}']
os.environ['{param_name.upper()}'] = '{test_command}'

"""
        full_code = wrapper + code
        escaped = full_code.replace("'", "'\"'\"'")
        return await self.sandbox_manager.execute_command(f"python3 -c '{escaped}'", timeout=30)

    async def _test_javascript(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 JavaScript 命令注入"""
        wrapper = f"""
const req = {{
    query: {{ '{param_name}': '{test_command}' }},
    body: {{ '{param_name}': '{test_command}' }},
    params: {{ '{param_name}': '{test_command}' }},
}};
process.argv = ['node', 'script.js', '{test_command}'];
process.env['{param_name.upper()}'] = '{test_command}';

"""
        full_code = wrapper + code
        escaped = full_code.replace("'", "'\"'\"'")
        return await self.sandbox_manager.execute_command(f"node -e '{escaped}'", timeout=30)

    async def _test_java(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 Java 命令注入"""
        # 简化处理 - Java 需要完整类结构
        wrapper = f"""
import java.io.*;
import java.util.*;

public class Test {{
    public static void main(String[] args) throws Exception {{
        Map<String, String> params = new HashMap<>();
        params.put("{param_name}", "{test_command}");
        String[] argv = new String[]{{"{test_command}"}};

        {code}
    }}
}}
"""
        escaped = wrapper.replace("'", "'\"'\"'").replace("\\", "\\\\")
        return await self.sandbox_manager.execute_command(
            f"echo '{escaped}' > /tmp/Test.java && javac /tmp/Test.java 2>&1 && java -cp /tmp Test 2>&1",
            timeout=60
        )

    async def _test_go(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 Go 命令注入"""
        if "package main" not in code:
            code = f"""package main

import (
    "fmt"
    "os"
    "os/exec"
)

func main() {{
    os.Args = []string{{"program", "{test_command}"}}
    os.Setenv("{param_name.upper()}", "{test_command}")
    params := map[string]string{{"{param_name}": "{test_command}"}}
    _ = params

    {code}
}}
"""
        escaped = code.replace("'", "'\"'\"'").replace("\\", "\\\\")
        return await self.sandbox_manager.execute_command(
            f"echo '{escaped}' > /tmp/main.go && go run /tmp/main.go 2>&1",
            timeout=60
        )

    async def _test_ruby(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 Ruby 命令注入"""
        wrapper = f"""
ARGV[0] = "{test_command}"
ENV["{param_name.upper()}"] = "{test_command}"

def params
  @params ||= {{ "{param_name}" => "{test_command}" }}
end

"""
        full_code = wrapper + code
        escaped = full_code.replace("'", "'\"'\"'")
        return await self.sandbox_manager.execute_command(f"ruby -e '{escaped}'", timeout=30)

    async def _test_shell(self, code: str, param_name: str, test_command: str) -> Dict:
        """测试 Shell 命令注入"""
        wrapper = f"""#!/bin/bash
export {param_name.upper()}="{test_command}"
set -- "{test_command}"

"""
        full_code = wrapper + code
        escaped = full_code.replace("'", "'\"'\"'")
        return await self.sandbox_manager.execute_command(f"bash -c '{escaped}'", timeout=30)


# ============ SQL 注入测试工具 ============

class SqlInjectionTestInput(BaseModel):
    """SQL 注入测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    param_name: str = Field(default="id", description="注入参数名")
    payload: str = Field(default="1' OR '1'='1", description="SQL 注入 payload")
    language: str = Field(default="auto", description="语言: auto, php, python, javascript, java, go, ruby")
    db_type: str = Field(default="mysql", description="数据库类型: mysql, postgresql, sqlite, oracle, mssql")


class SqlInjectionTestTool(AgentTool):
    """SQL 注入漏洞测试工具"""

    # SQL 错误特征
    SQL_ERROR_PATTERNS = {
        "mysql": [
            r"SQL syntax.*MySQL",
            r"Warning.*mysql_",
            r"MySQLSyntaxErrorException",
            r"valid MySQL result",
            r"check the manual that corresponds to your MySQL",
            r"mysql_fetch",
            r"mysqli_",
        ],
        "postgresql": [
            r"PostgreSQL.*ERROR",
            r"Warning.*pg_",
            r"valid PostgreSQL result",
            r"Npgsql\.",
            r"PSQLException",
        ],
        "sqlite": [
            r"SQLite.*error",
            r"sqlite3\.OperationalError",
            r"SQLITE_ERROR",
            r"SQLite3::SQLException",
        ],
        "oracle": [
            r"ORA-\d{5}",
            r"Oracle error",
            r"Oracle.*Driver",
            r"Warning.*oci_",
        ],
        "mssql": [
            r"ODBC Driver.*SQL Server",
            r"SqlException",
            r"Unclosed quotation mark",
            r"SQL Server.*Error",
        ],
        "generic": [
            r"SQL syntax",
            r"unclosed quotation",
            r"quoted string not properly terminated",
            r"sql error",
            r"database error",
            r"query failed",
        ],
    }

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_sql_injection"

    @property
    def description(self) -> str:
        return """专门测试 SQL 注入漏洞的工具。

支持数据库: MySQL, PostgreSQL, SQLite, Oracle, MSSQL

输入:
- target_file: 目标文件路径
- param_name: 注入参数名 (默认 'id')
- payload: SQL 注入 payload (默认 "1' OR '1'='1")
- language: 语言 (auto 自动检测)
- db_type: 数据库类型 (默认 mysql)

常用 Payload:
- 布尔盲注: "1' AND '1'='1"
- 联合查询: "1' UNION SELECT 1,2,3--"
- 报错注入: "1' AND extractvalue(1,concat(0x7e,version()))--"
- 时间盲注: "1' AND SLEEP(5)--"

示例:
{"target_file": "login.php", "param_name": "username", "payload": "admin'--"}"""

    @property
    def args_schema(self):
        return SqlInjectionTestInput

    def _detect_sql_error(self, output: str, db_type: str = "mysql") -> Optional[str]:
        """检测 SQL 错误特征"""
        output_lower = output.lower()

        # 先检测特定数据库
        patterns = self.SQL_ERROR_PATTERNS.get(db_type, [])
        for pattern in patterns:
            if re.search(pattern, output, re.IGNORECASE):
                return f"检测到 {db_type.upper()} 错误: {pattern}"

        # 通用检测
        for pattern in self.SQL_ERROR_PATTERNS["generic"]:
            if re.search(pattern, output, re.IGNORECASE):
                return f"检测到 SQL 错误: {pattern}"

        return None

    async def _execute(
        self,
        target_file: str,
        param_name: str = "id",
        payload: str = "1' OR '1'='1",
        language: str = "auto",
        db_type: str = "mysql",
        **kwargs
    ) -> ToolResult:
        """执行 SQL 注入测试"""
        try:
            await self.sandbox_manager.initialize()
        except Exception as e:
            logger.warning(f"Sandbox init failed: {e}")

        if not self.sandbox_manager.is_available:
            return ToolResult(success=False, error="沙箱环境不可用")

        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言
        if language == "auto":
            ext = os.path.splitext(target_file)[1].lower()
            language = {".php": "php", ".py": "python", ".js": "javascript"}.get(ext, "php")

        # 执行测试
        result = await self._test_sql_injection(language, code, param_name, payload)

        # 分析结果
        is_vulnerable = False
        evidence = None

        if result.get("stdout") or result.get("stderr"):
            output = (result.get("stdout", "") + result.get("stderr", ""))
            error_detected = self._detect_sql_error(output, db_type)
            if error_detected:
                is_vulnerable = True
                evidence = error_detected

            # 检测数据泄露
            if not is_vulnerable:
                leak_patterns = [
                    r"\d+\s*\|\s*\d+",  # 表格输出
                    r"admin|root|user",  # 用户名泄露
                    r"password|passwd|pwd",  # 密码相关
                ]
                for pattern in leak_patterns:
                    if re.search(pattern, output, re.IGNORECASE):
                        is_vulnerable = True
                        evidence = f"可能存在数据泄露: {pattern}"
                        break

        # 构建 PoC
        poc = None
        if is_vulnerable:
            encoded_payload = payload.replace("'", "%27").replace(" ", "+")
            poc = f"curl 'http://target/{target_file}?{param_name}={encoded_payload}'"

        # 格式化输出
        output_parts = ["💉 SQL 注入测试结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"数据库类型: {db_type}")
        output_parts.append(f"注入参数: {param_name}")
        output_parts.append(f"Payload: {payload}")

        output_parts.append(f"\n退出码: {result.get('exit_code', -1)}")

        if result.get("stdout"):
            output_parts.append(f"\n输出:\n```\n{result['stdout'][:2000]}\n```")
        if result.get("stderr"):
            output_parts.append(f"\n错误:\n```\n{result['stderr'][:1000]}\n```")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **SQL 注入漏洞确认!**")
            output_parts.append(f"证据: {evidence}")
            if poc:
                output_parts.append(f"\nPoC: `{poc}`")
        else:
            output_parts.append(f"\n\n🟡 未能确认 SQL 注入漏洞")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "sql_injection",
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "poc": poc,
                "db_type": db_type,
            }
        )

    async def _test_sql_injection(self, language: str, code: str, param_name: str, payload: str) -> Dict:
        """根据语言测试 SQL 注入"""
        # 使用安全的 payload 转义
        safe_payload = payload.replace("'", "\\'")

        if language == "php":
            # php -r 不需要 <?php 标签
            wrapper = f"""$_GET['{param_name}'] = '{safe_payload}';
$_POST['{param_name}'] = '{safe_payload}';
$_REQUEST['{param_name}'] = '{safe_payload}';
error_reporting(E_ALL);
ini_set('display_errors', 1);
"""
            clean_code = code.strip()
            if clean_code.startswith("<?php"):
                clean_code = clean_code[5:]
            elif clean_code.startswith("<?"):
                clean_code = clean_code[2:]
            if clean_code.endswith("?>"):
                clean_code = clean_code[:-2]

            full_code = wrapper + clean_code.strip()
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"php -r '{escaped}'", timeout=30)

        elif language == "python":
            wrapper = f"""
import sys
class MockArgs:
    def get(self, key, default=None):
        if key == '{param_name}':
            return '''{safe_payload}'''
        return default

class MockRequest:
    args = MockArgs()
    form = MockArgs()

request = MockRequest()
"""
            full_code = wrapper + code
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"python3 -c '{escaped}'", timeout=30)

        else:
            return {"exit_code": -1, "stdout": "", "stderr": f"不支持的语言: {language}"}


# ============ XSS 测试工具 ============

class XssTestInput(BaseModel):
    """XSS 测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    param_name: str = Field(default="input", description="注入参数名")
    payload: str = Field(default="<script>alert('XSS')</script>", description="XSS payload")
    xss_type: str = Field(default="reflected", description="XSS 类型: reflected, stored, dom")
    language: str = Field(default="auto", description="语言: auto, php, python, javascript")


class XssTestTool(AgentTool):
    """XSS 漏洞测试工具"""

    XSS_PAYLOADS = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "'><script>alert('XSS')</script>",
        "\"><script>alert('XSS')</script>",
        "<body onload=alert('XSS')>",
    ]

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_xss"

    @property
    def description(self) -> str:
        return """专门测试 XSS (跨站脚本) 漏洞的工具。

支持类型: Reflected XSS, Stored XSS, DOM XSS

输入:
- target_file: 目标文件路径
- param_name: 注入参数名 (默认 'input')
- payload: XSS payload (默认 "<script>alert('XSS')</script>")
- xss_type: XSS 类型 (reflected, stored, dom)

常用 Payload:
- Script 标签: <script>alert('XSS')</script>
- 事件处理: <img src=x onerror=alert('XSS')>
- SVG: <svg onload=alert('XSS')>

示例:
{"target_file": "search.php", "param_name": "q", "payload": "<script>alert(1)</script>"}"""

    @property
    def args_schema(self):
        return XssTestInput

    async def _execute(
        self,
        target_file: str,
        param_name: str = "input",
        payload: str = "<script>alert('XSS')</script>",
        xss_type: str = "reflected",
        language: str = "auto",
        **kwargs
    ) -> ToolResult:
        """执行 XSS 测试"""
        try:
            await self.sandbox_manager.initialize()
        except Exception as e:
            logger.warning(f"Sandbox init failed: {e}")

        if not self.sandbox_manager.is_available:
            return ToolResult(success=False, error="沙箱环境不可用")

        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言
        if language == "auto":
            ext = os.path.splitext(target_file)[1].lower()
            language = {".php": "php", ".py": "python", ".js": "javascript"}.get(ext, "php")

        # 执行测试
        result = await self._test_xss(language, code, param_name, payload)

        # 分析结果 - 检查 payload 是否被反射
        is_vulnerable = False
        evidence = None

        if result.get("stdout"):
            output = result["stdout"]

            # 检查 payload 是否原样出现在输出中
            if payload in output:
                is_vulnerable = True
                evidence = "XSS payload 被原样反射到输出中"

            # 检查关键字符是否被编码
            elif "<script>" in payload and "<script>" not in output:
                if "&lt;script&gt;" in output:
                    evidence = "Payload 被 HTML 编码 (部分防护)"
                else:
                    evidence = "Payload 未出现在输出中"

            # 检查事件处理器
            elif "onerror=" in payload or "onload=" in payload:
                if "onerror=" in output or "onload=" in output:
                    is_vulnerable = True
                    evidence = "事件处理器 payload 被反射"

        # 构建 PoC
        poc = None
        if is_vulnerable:
            encoded_payload = payload.replace("<", "%3C").replace(">", "%3E").replace("'", "%27")
            poc = f"curl 'http://target/{target_file}?{param_name}={encoded_payload}'"

        # 格式化输出
        output_parts = ["🔍 XSS 测试结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"XSS 类型: {xss_type}")
        output_parts.append(f"注入参数: {param_name}")
        output_parts.append(f"Payload: {payload}")

        output_parts.append(f"\n退出码: {result.get('exit_code', -1)}")

        if result.get("stdout"):
            output_parts.append(f"\n输出:\n```html\n{result['stdout'][:2000]}\n```")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **XSS 漏洞确认!**")
            output_parts.append(f"证据: {evidence}")
            if poc:
                output_parts.append(f"\nPoC: `{poc}`")
        else:
            output_parts.append(f"\n\n🟡 未能确认 XSS 漏洞")
            if evidence:
                output_parts.append(f"备注: {evidence}")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "xss",
                "xss_type": xss_type,
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "poc": poc,
            }
        )

    async def _test_xss(self, language: str, code: str, param_name: str, payload: str) -> Dict:
        """测试 XSS"""
        # 转义 payload 中的特殊字符
        safe_payload = payload.replace("'", "\\'").replace('"', '\\"')

        if language == "php":
            # php -r 不需要 <?php 标签
            wrapper = f"""$_GET['{param_name}'] = '{safe_payload}';
$_POST['{param_name}'] = '{safe_payload}';
$_REQUEST['{param_name}'] = '{safe_payload}';
"""
            clean_code = code.strip()
            if clean_code.startswith("<?php"):
                clean_code = clean_code[5:]
            elif clean_code.startswith("<?"):
                clean_code = clean_code[2:]
            if clean_code.endswith("?>"):
                clean_code = clean_code[:-2]

            full_code = wrapper + clean_code.strip()
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"php -r '{escaped}'", timeout=30)

        elif language == "python":
            wrapper = f"""
class MockArgs:
    def get(self, key, default=None):
        if key == '{param_name}':
            return '''{safe_payload}'''
        return default

class MockRequest:
    args = MockArgs()
    form = MockArgs()

request = MockRequest()
"""
            full_code = wrapper + code
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"python3 -c '{escaped}'", timeout=30)

        else:
            return {"exit_code": -1, "stdout": "", "stderr": f"不支持的语言: {language}"}


# ============ 路径遍历测试工具 ============

class PathTraversalTestInput(BaseModel):
    """路径遍历测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    param_name: str = Field(default="file", description="文件参数名")
    payload: str = Field(default="../../../etc/passwd", description="路径遍历 payload")
    language: str = Field(default="auto", description="语言")


class PathTraversalTestTool(AgentTool):
    """路径遍历漏洞测试工具"""

    TRAVERSAL_PAYLOADS = [
        "../../../etc/passwd",
        "....//....//....//etc/passwd",
        "..%2f..%2f..%2fetc/passwd",
        "..%252f..%252f..%252fetc/passwd",
        "/etc/passwd",
        "....\\....\\....\\windows\\win.ini",
        "..\\..\\..\\windows\\win.ini",
    ]

    SENSITIVE_FILES = {
        "unix": [
            "/etc/passwd",
            "/etc/shadow",
            "/etc/hosts",
            "/proc/self/environ",
            "/var/log/apache2/access.log",
        ],
        "windows": [
            "C:\\Windows\\win.ini",
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            "C:\\boot.ini",
        ]
    }

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_path_traversal"

    @property
    def description(self) -> str:
        return """专门测试路径遍历/LFI/RFI 漏洞的工具。

输入:
- target_file: 目标文件路径
- param_name: 文件参数名 (默认 'file')
- payload: 路径遍历 payload (默认 "../../../etc/passwd")

常用 Payload:
- Unix: ../../../etc/passwd
- 编码绕过: ..%2f..%2f..%2fetc/passwd
- 双写绕过: ....//....//....//etc/passwd
- Windows: ..\\..\\..\\windows\\win.ini

示例:
{"target_file": "download.php", "param_name": "file", "payload": "../../../etc/passwd"}"""

    @property
    def args_schema(self):
        return PathTraversalTestInput

    async def _execute(
        self,
        target_file: str,
        param_name: str = "file",
        payload: str = "../../../etc/passwd",
        language: str = "auto",
        **kwargs
    ) -> ToolResult:
        """执行路径遍历测试"""
        try:
            await self.sandbox_manager.initialize()
        except Exception as e:
            logger.warning(f"Sandbox init failed: {e}")

        if not self.sandbox_manager.is_available:
            return ToolResult(success=False, error="沙箱环境不可用")

        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言
        if language == "auto":
            ext = os.path.splitext(target_file)[1].lower()
            language = {".php": "php", ".py": "python", ".js": "javascript"}.get(ext, "php")

        # 执行测试
        result = await self._test_traversal(language, code, param_name, payload)

        # 分析结果
        is_vulnerable = False
        evidence = None

        if result.get("stdout"):
            output = result["stdout"]

            # 检测敏感文件内容特征
            passwd_patterns = [
                r"root:.*:0:0:",
                r"daemon:.*:",
                r"nobody:.*:",
                r"www-data:",
            ]

            for pattern in passwd_patterns:
                if re.search(pattern, output):
                    is_vulnerable = True
                    evidence = "成功读取 /etc/passwd 文件内容"
                    break

            # Windows 特征
            if not is_vulnerable:
                win_patterns = [
                    r"\[fonts\]",
                    r"\[extensions\]",
                    r"for 16-bit app support",
                ]
                for pattern in win_patterns:
                    if re.search(pattern, output, re.IGNORECASE):
                        is_vulnerable = True
                        evidence = "成功读取 Windows 系统文件"
                        break

        # 构建 PoC
        poc = None
        if is_vulnerable:
            encoded_payload = payload.replace("../", "..%2f")
            poc = f"curl 'http://target/{target_file}?{param_name}={encoded_payload}'"

        # 格式化输出
        output_parts = ["📁 路径遍历测试结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"参数名: {param_name}")
        output_parts.append(f"Payload: {payload}")

        output_parts.append(f"\n退出码: {result.get('exit_code', -1)}")

        if result.get("stdout"):
            output_parts.append(f"\n输出:\n```\n{result['stdout'][:2000]}\n```")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **路径遍历漏洞确认!**")
            output_parts.append(f"证据: {evidence}")
            if poc:
                output_parts.append(f"\nPoC: `{poc}`")
        else:
            output_parts.append(f"\n\n🟡 未能确认路径遍历漏洞")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "path_traversal",
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "poc": poc,
            }
        )

    async def _test_traversal(self, language: str, code: str, param_name: str, payload: str) -> Dict:
        """测试路径遍历"""
        if language == "php":
            # php -r 不需要 <?php 标签
            wrapper = f"""$_GET['{param_name}'] = '{payload}';
$_POST['{param_name}'] = '{payload}';
$_REQUEST['{param_name}'] = '{payload}';
"""
            clean_code = code.strip()
            if clean_code.startswith("<?php"):
                clean_code = clean_code[5:]
            elif clean_code.startswith("<?"):
                clean_code = clean_code[2:]
            if clean_code.endswith("?>"):
                clean_code = clean_code[:-2]

            full_code = wrapper + clean_code.strip()
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"php -r '{escaped}'", timeout=30)

        elif language == "python":
            wrapper = f"""
class MockArgs:
    def get(self, key, default=None):
        if key == '{param_name}':
            return '{payload}'
        return default

class MockRequest:
    args = MockArgs()

request = MockRequest()
"""
            full_code = wrapper + code
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"python3 -c '{escaped}'", timeout=30)

        else:
            return {"exit_code": -1, "stdout": "", "stderr": f"不支持的语言: {language}"}


# ============ SSTI (服务端模板注入) 测试工具 ============

class SstiTestInput(BaseModel):
    """SSTI 测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    param_name: str = Field(default="name", description="注入参数名")
    payload: str = Field(default="{{7*7}}", description="SSTI payload")
    template_engine: str = Field(default="auto", description="模板引擎: auto, jinja2, twig, freemarker, velocity, smarty")


class SstiTestTool(AgentTool):
    """SSTI (服务端模板注入) 漏洞测试工具"""

    SSTI_PAYLOADS = {
        "jinja2": [
            "{{7*7}}",
            "{{config}}",
            "{{''.__class__.__mro__[2].__subclasses__()}}",
        ],
        "twig": [
            "{{7*7}}",
            "{{_self.env.getFilter('id')}}",
        ],
        "freemarker": [
            "${7*7}",
            "<#assign ex=\"freemarker.template.utility.Execute\"?new()>${ex(\"id\")}",
        ],
        "velocity": [
            "#set($x=7*7)$x",
            "#set($str=$class.inspect(\"java.lang.Runtime\").type.getRuntime().exec(\"id\"))",
        ],
        "smarty": [
            "{7*7}",
            "{php}echo `id`;{/php}",
        ],
    }

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_ssti"

    @property
    def description(self) -> str:
        return """专门测试 SSTI (服务端模板注入) 漏洞的工具。

支持模板引擎: Jinja2, Twig, Freemarker, Velocity, Smarty

输入:
- target_file: 目标文件路径
- param_name: 注入参数名
- payload: SSTI payload (默认 "{{7*7}}")
- template_engine: 模板引擎类型

常用 Payload:
- Jinja2/Twig: {{7*7}}, {{config}}
- Freemarker: ${7*7}
- Velocity: #set($x=7*7)$x
- Smarty: {7*7}

示例:
{"target_file": "render.py", "param_name": "name", "payload": "{{7*7}}", "template_engine": "jinja2"}"""

    @property
    def args_schema(self):
        return SstiTestInput

    async def _execute(
        self,
        target_file: str,
        param_name: str = "name",
        payload: str = "{{7*7}}",
        template_engine: str = "auto",
        **kwargs
    ) -> ToolResult:
        """执行 SSTI 测试"""
        try:
            await self.sandbox_manager.initialize()
        except Exception as e:
            logger.warning(f"Sandbox init failed: {e}")

        if not self.sandbox_manager.is_available:
            return ToolResult(success=False, error="沙箱环境不可用")

        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言和模板引擎
        ext = os.path.splitext(target_file)[1].lower()
        language = {".php": "php", ".py": "python", ".js": "javascript", ".java": "java"}.get(ext, "python")

        if template_engine == "auto":
            if "jinja" in code.lower() or "render_template" in code:
                template_engine = "jinja2"
            elif "twig" in code.lower():
                template_engine = "twig"
            elif "freemarker" in code.lower():
                template_engine = "freemarker"
            else:
                template_engine = "jinja2"

        # 执行测试
        result = await self._test_ssti(language, code, param_name, payload)

        # 分析结果
        is_vulnerable = False
        evidence = None

        if result.get("stdout"):
            output = result["stdout"]

            # 检测数学表达式计算结果
            if "{{7*7}}" in payload or "${7*7}" in payload or "{7*7}" in payload:
                if "49" in output:
                    is_vulnerable = True
                    evidence = "模板表达式 7*7 被计算为 49"

            # 检测配置泄露
            if "{{config}}" in payload:
                if "secret" in output.lower() or "debug" in output.lower():
                    is_vulnerable = True
                    evidence = "模板可以访问配置对象"

            # 检测命令执行
            if "id" in payload or "whoami" in payload:
                if "uid=" in output or "root" in output.lower():
                    is_vulnerable = True
                    evidence = "SSTI 导致远程代码执行"

        # 构建 PoC
        poc = None
        if is_vulnerable:
            encoded_payload = payload.replace("{", "%7B").replace("}", "%7D")
            poc = f"curl 'http://target/{target_file}?{param_name}={encoded_payload}'"

        # 格式化输出
        output_parts = ["🎭 SSTI 测试结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"模板引擎: {template_engine}")
        output_parts.append(f"参数名: {param_name}")
        output_parts.append(f"Payload: {payload}")

        output_parts.append(f"\n退出码: {result.get('exit_code', -1)}")

        if result.get("stdout"):
            output_parts.append(f"\n输出:\n```\n{result['stdout'][:2000]}\n```")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **SSTI 漏洞确认!**")
            output_parts.append(f"证据: {evidence}")
            if poc:
                output_parts.append(f"\nPoC: `{poc}`")
        else:
            output_parts.append(f"\n\n🟡 未能确认 SSTI 漏洞")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "ssti",
                "template_engine": template_engine,
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "poc": poc,
            }
        )

    async def _test_ssti(self, language: str, code: str, param_name: str, payload: str) -> Dict:
        """测试 SSTI"""
        safe_payload = payload.replace("'", "\\'")

        if language == "python":
            wrapper = f"""
class MockArgs:
    def get(self, key, default=None):
        if key == '{param_name}':
            return '''{safe_payload}'''
        return default

class MockRequest:
    args = MockArgs()
    form = MockArgs()

request = MockRequest()
"""
            full_code = wrapper + code
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"python3 -c '{escaped}'", timeout=30)

        elif language == "php":
            # php -r 不需要 <?php 标签
            wrapper = f"""$_GET['{param_name}'] = '{safe_payload}';
$_POST['{param_name}'] = '{safe_payload}';
"""
            clean_code = code.strip()
            if clean_code.startswith("<?php"):
                clean_code = clean_code[5:]
            elif clean_code.startswith("<?"):
                clean_code = clean_code[2:]
            if clean_code.endswith("?>"):
                clean_code = clean_code[:-2]

            full_code = wrapper + clean_code.strip()
            escaped = full_code.replace("'", "'\"'\"'")
            return await self.sandbox_manager.execute_command(f"php -r '{escaped}'", timeout=30)

        else:
            return {"exit_code": -1, "stdout": "", "stderr": f"不支持的语言: {language}"}


# ============ 反序列化测试工具 ============

class DeserializationTestInput(BaseModel):
    """反序列化测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    language: str = Field(default="auto", description="语言: auto, php, python, java, ruby")
    payload_type: str = Field(default="detect", description="payload 类型: detect, pickle, yaml, php_serialize")


class DeserializationTestTool(AgentTool):
    """反序列化漏洞测试工具"""

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

    @property
    def name(self) -> str:
        return "test_deserialization"

    @property
    def description(self) -> str:
        return """测试不安全反序列化漏洞的工具。

支持语言: PHP (unserialize), Python (pickle, yaml), Java, Ruby (Marshal)

输入:
- target_file: 目标文件路径
- language: 语言
- payload_type: payload 类型 (detect 自动检测)

检测模式:
- 分析代码中是否存在危险的反序列化调用
- 检测用户可控数据是否进入反序列化函数

危险函数:
- PHP: unserialize()
- Python: pickle.loads(), yaml.load(), eval()
- Java: ObjectInputStream.readObject()
- Ruby: Marshal.load()

示例:
{"target_file": "api.py", "language": "python"}"""

    @property
    def args_schema(self):
        return DeserializationTestInput

    async def _execute(
        self,
        target_file: str,
        language: str = "auto",
        payload_type: str = "detect",
        **kwargs
    ) -> ToolResult:
        """执行反序列化漏洞检测"""
        # 读取目标文件
        full_path = os.path.join(self.project_root, target_file)
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {target_file}")

        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()

        # 检测语言
        if language == "auto":
            ext = os.path.splitext(target_file)[1].lower()
            language = {
                ".php": "php",
                ".py": "python",
                ".java": "java",
                ".rb": "ruby",
            }.get(ext, "unknown")

        # 分析代码中的反序列化调用
        is_vulnerable = False
        evidence = None
        dangerous_calls = []

        if language == "php":
            # PHP 反序列化
            patterns = [
                (r"unserialize\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)", "直接反序列化用户输入"),
                (r"unserialize\s*\(", "使用 unserialize"),
            ]
            for pattern, desc in patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    dangerous_calls.append(desc)
                    if "$_" in pattern:
                        is_vulnerable = True
                        evidence = desc

        elif language == "python":
            # Python 反序列化
            patterns = [
                (r"pickle\.loads?\s*\(", "使用 pickle"),
                (r"yaml\.load\s*\([^)]*Loader\s*=\s*None", "yaml.load 不安全调用"),
                (r"yaml\.unsafe_load", "yaml.unsafe_load"),
                (r"marshal\.loads?\s*\(", "使用 marshal"),
                (r"shelve\.open", "使用 shelve"),
            ]
            for pattern, desc in patterns:
                if re.search(pattern, code):
                    dangerous_calls.append(desc)
                    # 检查是否用户可控
                    if "request" in code.lower() or "input" in code.lower():
                        is_vulnerable = True
                        evidence = f"{desc} 且可能接受用户输入"

        elif language == "java":
            # Java 反序列化
            patterns = [
                (r"ObjectInputStream", "使用 ObjectInputStream"),
                (r"readObject\s*\(\s*\)", "调用 readObject"),
                (r"XMLDecoder", "使用 XMLDecoder"),
            ]
            for pattern, desc in patterns:
                if re.search(pattern, code):
                    dangerous_calls.append(desc)

        elif language == "ruby":
            # Ruby 反序列化
            patterns = [
                (r"Marshal\.load", "使用 Marshal.load"),
                (r"YAML\.load", "使用 YAML.load"),
            ]
            for pattern, desc in patterns:
                if re.search(pattern, code):
                    dangerous_calls.append(desc)

        # 格式化输出
        output_parts = ["🔓 反序列化漏洞检测结果\n"]
        output_parts.append(f"目标文件: {target_file}")
        output_parts.append(f"语言: {language}")

        if dangerous_calls:
            output_parts.append(f"\n发现的危险调用:")
            for call in dangerous_calls:
                output_parts.append(f"  - {call}")

        if is_vulnerable:
            output_parts.append(f"\n\n🔴 **存在反序列化漏洞风险!**")
            output_parts.append(f"证据: {evidence}")
            output_parts.append(f"\n建议: 避免反序列化不可信数据，使用 JSON 等安全格式")
        elif dangerous_calls:
            output_parts.append(f"\n\n🟡 存在潜在风险")
            output_parts.append(f"建议: 检查反序列化数据来源是否可信")
        else:
            output_parts.append(f"\n\n🟢 未发现明显的反序列化漏洞")

        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "vulnerability_type": "deserialization",
                "language": language,
                "is_vulnerable": is_vulnerable,
                "evidence": evidence,
                "dangerous_calls": dangerous_calls,
            }
        )


# ============ 通用漏洞测试工具 ============

class UniversalVulnTestInput(BaseModel):
    """通用漏洞测试输入"""
    target_file: str = Field(..., description="目标文件路径")
    vuln_type: str = Field(..., description="漏洞类型: command_injection, sql_injection, xss, path_traversal, ssti, deserialization")
    param_name: str = Field(default="input", description="参数名")
    payload: Optional[str] = Field(default=None, description="自定义 payload")
    language: str = Field(default="auto", description="语言")


class UniversalVulnTestTool(AgentTool):
    """通用漏洞测试工具 - 自动选择合适的测试器"""

    def __init__(self, sandbox_manager: Optional[SandboxManager] = None, project_root: str = "."):
        super().__init__()
        self.sandbox_manager = sandbox_manager or SandboxManager()
        self.project_root = project_root

        # 初始化所有漏洞测试器
        self._testers = {
            "command_injection": CommandInjectionTestTool(sandbox_manager, project_root),
            "cmd": CommandInjectionTestTool(sandbox_manager, project_root),
            "rce": CommandInjectionTestTool(sandbox_manager, project_root),
            "sql_injection": SqlInjectionTestTool(sandbox_manager, project_root),
            "sqli": SqlInjectionTestTool(sandbox_manager, project_root),
            "xss": XssTestTool(sandbox_manager, project_root),
            "path_traversal": PathTraversalTestTool(sandbox_manager, project_root),
            "lfi": PathTraversalTestTool(sandbox_manager, project_root),
            "rfi": PathTraversalTestTool(sandbox_manager, project_root),
            "ssti": SstiTestTool(sandbox_manager, project_root),
            "deserialization": DeserializationTestTool(sandbox_manager, project_root),
        }

        # 默认 payloads
        self._default_payloads = {
            "command_injection": "id",
            "sql_injection": "1' OR '1'='1",
            "xss": "<script>alert('XSS')</script>",
            "path_traversal": "../../../etc/passwd",
            "ssti": "{{7*7}}",
        }

    @property
    def name(self) -> str:
        return "vuln_test"

    @property
    def description(self) -> str:
        return """通用漏洞测试工具，支持多种漏洞类型的自动化测试。

支持的漏洞类型:
- command_injection (cmd/rce): 命令注入
- sql_injection (sqli): SQL 注入
- xss: 跨站脚本
- path_traversal (lfi/rfi): 路径遍历
- ssti: 服务端模板注入
- deserialization: 不安全反序列化

输入:
- target_file: 目标文件路径
- vuln_type: 漏洞类型
- param_name: 参数名
- payload: 自定义 payload (可选)
- language: 语言 (auto 自动检测)

示例:
1. 命令注入: {"target_file": "api.php", "vuln_type": "command_injection", "param_name": "cmd"}
2. SQL 注入: {"target_file": "login.php", "vuln_type": "sql_injection", "param_name": "username", "payload": "admin'--"}
3. XSS: {"target_file": "search.php", "vuln_type": "xss", "param_name": "q"}"""

    @property
    def args_schema(self):
        return UniversalVulnTestInput

    async def _execute(
        self,
        target_file: str,
        vuln_type: str,
        param_name: str = "input",
        payload: Optional[str] = None,
        language: str = "auto",
        **kwargs
    ) -> ToolResult:
        """执行通用漏洞测试"""
        vuln_type = vuln_type.lower().strip()

        tester = self._testers.get(vuln_type)
        if not tester:
            return ToolResult(
                success=False,
                error=f"不支持的漏洞类型: {vuln_type}。支持: {list(self._testers.keys())}",
            )

        # 使用默认 payload
        if not payload:
            payload = self._default_payloads.get(vuln_type, "test")

        # 构建测试参数
        test_kwargs = {
            "target_file": target_file,
            "param_name": param_name,
            "language": language,
        }

        # 根据漏洞类型添加特定参数
        if vuln_type in ["command_injection", "cmd", "rce"]:
            test_kwargs["test_command"] = payload
        elif vuln_type in ["sql_injection", "sqli"]:
            test_kwargs["payload"] = payload
        elif vuln_type == "xss":
            test_kwargs["payload"] = payload
        elif vuln_type in ["path_traversal", "lfi", "rfi"]:
            test_kwargs["payload"] = payload
        elif vuln_type == "ssti":
            test_kwargs["payload"] = payload

        return await tester._execute(**test_kwargs)

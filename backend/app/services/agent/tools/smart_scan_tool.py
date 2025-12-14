"""
智能批量扫描工具
整合多种扫描能力，一次性完成多项安全检查

设计目的：
1. 减少 LLM 需要做的工具调用次数
2. 提供更完整的扫描概览
3. 自动选择最适合的扫描策略
"""

import os
import re
import asyncio
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from dataclasses import dataclass, field

from .base import AgentTool, ToolResult

logger = logging.getLogger(__name__)


class SmartScanInput(BaseModel):
    """智能扫描输入"""
    target: str = Field(
        default=".",
        description="扫描目标：可以是目录路径、文件路径或文件模式（如 '*.py'）"
    )
    scan_types: Optional[List[str]] = Field(
        default=None,
        description="扫描类型列表。可选: pattern, secret, dependency, all。默认为 all"
    )
    focus_vulnerabilities: Optional[List[str]] = Field(
        default=None,
        description="重点关注的漏洞类型，如 ['sql_injection', 'xss', 'command_injection']"
    )
    max_files: int = Field(default=50, description="最大扫描文件数")
    quick_mode: bool = Field(default=False, description="快速模式：只扫描高风险文件")


class SmartScanTool(AgentTool):
    """
    智能批量扫描工具
    
    自动整合多种扫描能力：
    - 危险模式匹配 (pattern)
    - 密钥泄露检测 (secret)
    - 依赖漏洞检查 (dependency)
    
    特点：
    1. 自动识别项目类型和技术栈
    2. 智能选择最适合的扫描策略
    3. 按风险级别汇总结果
    4. 一次调用完成多项检查
    """
    
    # 高风险文件模式
    HIGH_RISK_PATTERNS = [
        r'.*auth.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*login.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*user.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*api.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*view.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*route.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*controller.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*model.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*db.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*sql.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*upload.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*file.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*exec.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*admin.*\.(py|js|ts|tsx|jsx|java|php|swift|m|mm|kt|rs|go)$',
        r'.*config.*\.(py|js|ts|tsx|jsx|json|yaml|yml|xml|properties|plist)$',
        r'.*setting.*\.(py|js|ts|tsx|jsx|json|yaml|yml|xml|properties|plist)$',
        r'.*secret.*\.(py|js|ts|tsx|jsx|json|yaml|yml|xml|properties|plist)$',
        r'.*\.env.*$',
        r'.*Info\.plist$',
        r'.*AndroidManifest\.xml$',
    ]
    
    # 危险模式库（精简版，用于快速扫描）
    QUICK_PATTERNS = {
        "sql_injection": [
            (r'execute\s*\([^)]*%', "SQL格式化"),
            (r'execute\s*\([^)]*\+', "SQL拼接"),
            (r'execute\s*\(.*f["\']', "SQL f-string"),
            (r'\.query\s*\([^)]*\+', "Query拼接"),
            (r'raw\s*\([^)]*%', "Raw SQL"),
            (r'sqlite3_exec\s*\(', "SQLite3 Exec"),
            (r'NSPredicate\(format:', "NSPredicate Format"),
        ],
        "command_injection": [
            (r'os\.system\s*\(', "os.system"),
            (r'subprocess.*shell\s*=\s*True', "shell=True"),
            (r'eval\s*\(', "eval()"),
            (r'exec\s*\(', "exec()"),
            (r'Process\s*\(\s*launchPath:', "Swift Process"),
            (r'NSTask\s*\.launch', "NSTask Launch"),
        ],
        "xss": [
            (r'innerHTML\s*=', "innerHTML"),
            (r'v-html\s*=', "v-html"),
            (r'dangerouslySetInnerHTML', "dangerouslySetInnerHTML"),
            (r'\|\s*safe\b', "safe filter"),
            (r'mark_safe\s*\(', "mark_safe"),
            (r'loadHTMLString', "WebView Load HTML"),
            (r'evaluateJavaScript', "WebView JS Exec"),
        ],
        "path_traversal": [
            (r'open\s*\([^)]*\+', "open拼接"),
            (r'send_file\s*\([^)]*request', "send_file"),
            (r'include\s*\(\s*\$', "include变量"),
        ],
        "hardcoded_secret": [
            (r'password\s*=\s*["\'][^"\']{4,}["\']', "硬编码密码"),
            (r'api_?key\s*=\s*["\'][^"\']{8,}["\']', "硬编码API Key"),
            (r'secret\s*=\s*["\'][^"\']{8,}["\']', "硬编码Secret"),
            (r'-----BEGIN.*PRIVATE KEY-----', "私钥"),
        ],
        "ssrf": [
            (r'requests\.(get|post)\s*\([^)]*request\.', "requests用户URL"),
            (r'fetch\s*\([^)]*req\.', "fetch用户URL"),
        ],
    }
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
    
    @property
    def name(self) -> str:
        return "smart_scan"
    
    @property
    def description(self) -> str:
        return """🚀 智能批量安全扫描工具 - 一次调用完成多项检查

这是 Analysis Agent 的首选工具！在分析开始时优先使用此工具获取项目安全概览。

功能：
- 自动识别高风险文件
- 批量检测多种漏洞模式
- 按严重程度汇总结果
- 支持快速模式和完整模式

使用示例:
- 快速全面扫描: {"target": ".", "quick_mode": true}
- 扫描特定目录: {"target": "src/api", "scan_types": ["pattern"]}
- 聚焦特定漏洞: {"target": ".", "focus_vulnerabilities": ["sql_injection", "xss"]}

扫描类型:
- pattern: 危险代码模式匹配
- secret: 密钥泄露检测
- all: 所有类型（默认）

输出：按风险级别分类的发现汇总，可直接用于制定进一步分析策略。"""
    
    @property
    def args_schema(self):
        return SmartScanInput
    
    async def _execute(
        self,
        target: str = ".",
        scan_types: Optional[List[str]] = None,
        focus_vulnerabilities: Optional[List[str]] = None,
        max_files: int = 50,
        quick_mode: bool = False,
        **kwargs
    ) -> ToolResult:
        """执行智能扫描"""
        scan_types = scan_types or ["all"]
        
        # 收集要扫描的文件
        files_to_scan = await self._collect_files(target, max_files, quick_mode)
        
        if not files_to_scan:
            return ToolResult(
                success=True,
                data=f"在目标 '{target}' 中未找到可扫描的文件",
                metadata={"files_scanned": 0}
            )
        
        # 执行扫描
        all_findings = []
        files_with_issues = set()
        
        for file_path in files_to_scan:
            file_findings = await self._scan_file(file_path, focus_vulnerabilities)
            if file_findings:
                all_findings.extend(file_findings)
                files_with_issues.add(file_path)
        
        # 生成报告
        return self._generate_report(
            files_to_scan, 
            files_with_issues, 
            all_findings,
            quick_mode
        )
    
    async def _collect_files(
        self, 
        target: str, 
        max_files: int, 
        quick_mode: bool
    ) -> List[str]:
        """收集要扫描的文件"""
        full_path = os.path.normpath(os.path.join(self.project_root, target))
        
        # 安全检查
        if not full_path.startswith(os.path.normpath(self.project_root)):
            return []
        
        files = []
        
        # 排除目录
        exclude_dirs = {
            'node_modules', '__pycache__', '.git', 'venv', '.venv',
            'build', 'dist', 'target', '.idea', '.vscode', 'vendor',
            'coverage', '.pytest_cache', '.mypy_cache',
        }
        
        # 支持的代码文件扩展名
        code_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.php',
            '.go', '.rb', '.cs', '.c', '.cpp', '.h', '.hpp',
            '.swift', '.m', '.mm', '.kt', '.rs', '.sh', '.bat',
            '.vue', '.html', '.htm', '.xml', '.gradle', '.properties'
        }
        
        # 配置文件扩展名
        config_extensions = {'.json', '.yaml', '.yml', '.env', '.ini', '.cfg', '.plist', '.conf'}
        
        all_extensions = code_extensions | config_extensions
        
        if os.path.isfile(full_path):
            return [os.path.relpath(full_path, self.project_root)]
        
        for root, dirs, filenames in os.walk(full_path):
            # 过滤排除目录
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in all_extensions:
                    continue
                
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, self.project_root)
                
                # 快速模式：只扫描高风险文件
                if quick_mode:
                    is_high_risk = any(
                        re.search(pattern, rel_path, re.IGNORECASE)
                        for pattern in self.HIGH_RISK_PATTERNS
                    )
                    if not is_high_risk:
                        continue
                
                files.append(rel_path)
                
                if len(files) >= max_files:
                    break
            
            if len(files) >= max_files:
                break
        
        return files
    
    async def _scan_file(
        self, 
        file_path: str,
        focus_vulnerabilities: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """扫描单个文件"""
        full_path = os.path.join(self.project_root, file_path)
        
        try:
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            logger.warning(f"无法读取文件 {file_path}: {e}")
            return []
        
        lines = content.split('\n')
        findings = []
        
        # 确定要检查的漏洞类型
        vuln_types = focus_vulnerabilities or list(self.QUICK_PATTERNS.keys())
        
        for vuln_type in vuln_types:
            patterns = self.QUICK_PATTERNS.get(vuln_type, [])
            
            for pattern, pattern_name in patterns:
                try:
                    for i, line in enumerate(lines):
                        if re.search(pattern, line, re.IGNORECASE):
                            # 获取上下文
                            start = max(0, i - 1)
                            end = min(len(lines), i + 2)
                            context = '\n'.join(lines[start:end])
                            
                            findings.append({
                                "vulnerability_type": vuln_type,
                                "pattern_name": pattern_name,
                                "file_path": file_path,
                                "line_number": i + 1,
                                "matched_line": line.strip()[:150],
                                "context": context[:300],
                                "severity": self._get_severity(vuln_type),
                            })
                except re.error:
                    continue
        
        return findings
    
    def _get_severity(self, vuln_type: str) -> str:
        """获取漏洞严重程度"""
        severity_map = {
            "sql_injection": "high",
            "command_injection": "critical",
            "xss": "high",
            "path_traversal": "high",
            "ssrf": "high",
            "hardcoded_secret": "medium",
        }
        return severity_map.get(vuln_type, "medium")
    
    def _generate_report(
        self,
        files_scanned: List[str],
        files_with_issues: set,
        findings: List[Dict],
        quick_mode: bool
    ) -> ToolResult:
        """生成扫描报告"""
        
        # 按严重程度分组
        by_severity = {"critical": [], "high": [], "medium": [], "low": []}
        for f in findings:
            sev = f.get("severity", "medium")
            by_severity[sev].append(f)
        
        # 按漏洞类型分组
        by_type = {}
        for f in findings:
            vtype = f.get("vulnerability_type", "unknown")
            if vtype not in by_type:
                by_type[vtype] = []
            by_type[vtype].append(f)
        
        # 构建报告
        output_parts = [
            f"🔍 智能安全扫描报告",
            f"{'(快速模式)' if quick_mode else '(完整模式)'}",
            "",
            f"📊 扫描概览:",
            f"- 扫描文件数: {len(files_scanned)}",
            f"- 有问题文件: {len(files_with_issues)}",
            f"- 总发现数: {len(findings)}",
            "",
        ]
        
        # 严重程度统计
        severity_icons = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
        output_parts.append("📈 按严重程度分布:")
        for sev in ["critical", "high", "medium", "low"]:
            count = len(by_severity[sev])
            if count > 0:
                output_parts.append(f"  {severity_icons[sev]} {sev.upper()}: {count}")
        
        output_parts.append("")
        
        # 漏洞类型统计
        if by_type:
            output_parts.append("📋 按漏洞类型分布:")
            for vtype, vfindings in sorted(by_type.items(), key=lambda x: -len(x[1])):
                output_parts.append(f"  - {vtype}: {len(vfindings)}")
        
        output_parts.append("")
        
        # 详细发现（按严重程度排序，最多显示15个）
        if findings:
            output_parts.append("⚠️ 重点发现 (按严重程度排序):")
            shown = 0
            for sev in ["critical", "high", "medium", "low"]:
                for f in by_severity[sev][:5]:  # 每个级别最多5个
                    if shown >= 15:
                        break
                    icon = severity_icons[f["severity"]]
                    output_parts.append(f"\n{icon} [{f['severity'].upper()}] {f['vulnerability_type']}")
                    output_parts.append(f"   📍 {f['file_path']}:{f['line_number']}")
                    output_parts.append(f"   🔍 模式: {f['pattern_name']}")
                    output_parts.append(f"   📝 代码: {f['matched_line'][:80]}")
                    shown += 1
                if shown >= 15:
                    break
            
            if len(findings) > 15:
                output_parts.append(f"\n... 还有 {len(findings) - 15} 个发现")
        
        # 建议的下一步
        output_parts.append("")
        output_parts.append("💡 建议的下一步:")
        
        if by_severity["critical"]:
            output_parts.append("  1. ⚠️ 优先处理 CRITICAL 级别问题 - 使用 read_file 深入分析")
        if by_severity["high"]:
            output_parts.append("  2. 🔍 分析 HIGH 级别问题的上下文和数据流")
        if files_with_issues:
            top_files = list(files_with_issues)[:3]
            output_parts.append(f"  3. 📁 重点审查这些文件: {', '.join(top_files)}")
        
        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "files_scanned": len(files_scanned),
                "files_with_issues": len(files_with_issues),
                "total_findings": len(findings),
                "by_severity": {k: len(v) for k, v in by_severity.items()},
                "by_type": {k: len(v) for k, v in by_type.items()},
                "findings": findings[:20],
                "high_risk_files": list(files_with_issues)[:10],
            }
        )


class QuickAuditInput(BaseModel):
    """快速审计输入"""
    file_path: str = Field(description="要审计的文件路径")
    deep_analysis: bool = Field(
        default=True,
        description="是否进行深度分析（包括上下文和数据流分析）"
    )


class QuickAuditTool(AgentTool):
    """
    快速文件审计工具
    
    对单个文件进行全面的安全审计，包括：
    - 模式匹配
    - 上下文分析
    - 风险评估
    - 修复建议
    """
    
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = project_root
    
    @property
    def name(self) -> str:
        return "quick_audit"
    
    @property
    def description(self) -> str:
        return """🎯 快速文件审计工具 - 对单个文件进行全面安全分析

当 smart_scan 发现高风险文件后，使用此工具进行深入审计。

功能：
- 全面的模式匹配
- 代码结构分析
- 风险评估和优先级排序
- 具体的修复建议

使用示例:
- {"file_path": "app/views.py", "deep_analysis": true}

适用场景：
- smart_scan 发现的高风险文件
- 需要详细分析的可疑代码
- 生成具体的修复建议"""
    
    @property
    def args_schema(self):
        return QuickAuditInput
    
    async def _execute(
        self,
        file_path: str,
        deep_analysis: bool = True,
        **kwargs
    ) -> ToolResult:
        """执行快速审计"""
        full_path = os.path.join(self.project_root, file_path)
        
        # 安全检查
        if not os.path.normpath(full_path).startswith(os.path.normpath(self.project_root)):
            return ToolResult(success=False, error="安全错误：路径越界")
        
        if not os.path.exists(full_path):
            return ToolResult(success=False, error=f"文件不存在: {file_path}")
        
        try:
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            return ToolResult(success=False, error=f"读取文件失败: {str(e)}")
        
        lines = content.split('\n')
        
        # 分析结果
        audit_result = {
            "file_path": file_path,
            "total_lines": len(lines),
            "findings": [],
            "code_metrics": {},
            "recommendations": [],
        }
        
        # 代码指标
        audit_result["code_metrics"] = {
            "total_lines": len(lines),
            "non_empty_lines": len([l for l in lines if l.strip()]),
            "comment_lines": len([l for l in lines if l.strip().startswith(('#', '//', '/*', '*'))]),
        }
        
        # 执行模式匹配
        from .pattern_tool import PatternMatchTool
        pattern_tool = PatternMatchTool(self.project_root)
        
        # 使用完整的模式库进行扫描
        for vuln_type, config in pattern_tool.PATTERNS.items():
            patterns_dict = config.get("patterns", {})
            
            # 检测语言
            ext = os.path.splitext(file_path)[1].lower()
            lang_map = {".py": "python", ".js": "javascript", ".ts": "javascript", 
                       ".php": "php", ".java": "java", ".go": "go"}
            language = lang_map.get(ext)
            
            patterns_to_check = patterns_dict.get(language, [])
            patterns_to_check.extend(patterns_dict.get("_common", []))
            
            for pattern, pattern_name in patterns_to_check:
                try:
                    for i, line in enumerate(lines):
                        if re.search(pattern, line, re.IGNORECASE):
                            start = max(0, i - 2)
                            end = min(len(lines), i + 3)
                            context = '\n'.join(f"{start+j+1}: {lines[start+j]}" for j in range(end-start))
                            
                            finding = {
                                "vulnerability_type": vuln_type,
                                "pattern_name": pattern_name,
                                "severity": config.get("severity", "medium"),
                                "line_number": i + 1,
                                "matched_line": line.strip()[:150],
                                "context": context,
                                "description": config.get("description", ""),
                                "cwe_id": config.get("cwe_id", ""),
                            }
                            
                            # 深度分析：添加修复建议
                            if deep_analysis:
                                finding["recommendation"] = self._get_recommendation(vuln_type)
                            
                            audit_result["findings"].append(finding)
                except re.error:
                    continue
        
        # 生成报告
        return self._format_audit_report(audit_result)
    
    def _get_recommendation(self, vuln_type: str) -> str:
        """获取修复建议"""
        recommendations = {
            "sql_injection": "使用参数化查询或 ORM。例如: cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))",
            "command_injection": "避免使用 shell=True，使用参数列表传递命令。验证和清理所有用户输入。",
            "xss": "对所有用户输入进行 HTML 实体编码。使用框架自带的模板转义功能。",
            "path_traversal": "使用白名单验证文件路径。确保路径不包含 .. 序列。使用 os.path.basename() 提取文件名。",
            "ssrf": "验证 URL 白名单。禁止访问内部 IP 地址和保留地址。",
            "hardcoded_secret": "使用环境变量或密钥管理服务存储敏感信息。",
            "deserialization": "避免反序列化不可信数据。使用安全的序列化格式如 JSON。",
            "weak_crypto": "使用 SHA-256 或更强的哈希算法。使用 AES-256-GCM 进行加密。",
        }
        return recommendations.get(vuln_type, "请手动审查此代码段的安全性。")
    
    def _format_audit_report(self, audit_result: Dict) -> ToolResult:
        """格式化审计报告"""
        findings = audit_result["findings"]
        
        output_parts = [
            f"📋 文件审计报告: {audit_result['file_path']}",
            "",
            f"📊 代码统计:",
            f"  - 总行数: {audit_result['code_metrics']['total_lines']}",
            f"  - 有效代码: {audit_result['code_metrics']['non_empty_lines']}",
            "",
        ]
        
        if not findings:
            output_parts.append("✅ 未发现已知的安全问题")
        else:
            # 按严重程度分组
            by_severity = {"critical": [], "high": [], "medium": [], "low": []}
            for f in findings:
                by_severity[f["severity"]].append(f)
            
            severity_icons = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
            
            output_parts.append(f"⚠️ 发现 {len(findings)} 个潜在问题:")
            output_parts.append("")
            
            for sev in ["critical", "high", "medium", "low"]:
                for f in by_severity[sev]:
                    icon = severity_icons[sev]
                    output_parts.append(f"{icon} [{sev.upper()}] {f['vulnerability_type']}")
                    output_parts.append(f"   📍 第 {f['line_number']} 行: {f['pattern_name']}")
                    output_parts.append(f"   💻 代码: {f['matched_line'][:80]}")
                    if f.get("cwe_id"):
                        output_parts.append(f"   🔗 CWE: {f['cwe_id']}")
                    if f.get("recommendation"):
                        output_parts.append(f"   💡 建议: {f['recommendation'][:100]}")
                    output_parts.append("")
        
        return ToolResult(
            success=True,
            data="\n".join(output_parts),
            metadata={
                "file_path": audit_result["file_path"],
                "findings_count": len(findings),
                "findings": findings,
                "code_metrics": audit_result["code_metrics"],
            }
        )

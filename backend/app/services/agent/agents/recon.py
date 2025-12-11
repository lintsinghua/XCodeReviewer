"""
Recon Agent (信息收集层)
负责项目结构分析、技术栈识别、入口点识别

类型: ReAct
"""

import asyncio
import logging
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


RECON_SYSTEM_PROMPT = """你是 DeepAudit 的信息收集 Agent，负责在安全审计前收集项目信息。

## 你的职责
1. 分析项目结构和目录布局
2. 识别使用的技术栈和框架
3. 找出应用程序入口点
4. 分析依赖和第三方库
5. 识别高风险区域

## 你可以使用的工具
- list_files: 列出目录内容
- read_file: 读取文件内容
- search_code: 搜索代码
- semgrep_scan: Semgrep 扫描
- npm_audit: npm 依赖审计
- safety_scan: Python 依赖审计
- gitleaks_scan: 密钥泄露扫描

## 信息收集要点
1. **目录结构**: 了解项目布局，识别源码、配置、测试目录
2. **技术栈**: 检测语言、框架、数据库等
3. **入口点**: API 路由、控制器、处理函数
4. **配置文件**: 环境变量、数据库配置、API 密钥
5. **依赖**: package.json, requirements.txt, go.mod 等
6. **安全相关**: 认证、授权、加密相关代码

## 输出格式
完成后返回 JSON:
```json
{
    "project_structure": {...},
    "tech_stack": {
        "languages": [],
        "frameworks": [],
        "databases": []
    },
    "entry_points": [],
    "high_risk_areas": [],
    "dependencies": {...},
    "initial_findings": []
}
```

请系统性地收集信息，为后续分析做准备。"""


class ReconAgent(BaseAgent):
    """
    信息收集 Agent
    
    使用 ReAct 模式迭代收集项目信息
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        config = AgentConfig(
            name="Recon",
            agent_type=AgentType.RECON,
            pattern=AgentPattern.REACT,
            max_iterations=15,
            system_prompt=RECON_SYSTEM_PROMPT,
            tools=[
                "list_files", "read_file", "search_code",
                "semgrep_scan", "npm_audit", "safety_scan",
                "gitleaks_scan", "osv_scan",
            ],
        )
        super().__init__(config, llm_service, tools, event_emitter)
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """执行信息收集"""
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        
        try:
            await self.emit_thinking("开始信息收集...")
            
            # 收集结果
            result_data = {
                "project_structure": {},
                "tech_stack": {
                    "languages": [],
                    "frameworks": [],
                    "databases": [],
                },
                "entry_points": [],
                "high_risk_areas": [],
                "dependencies": {},
                "initial_findings": [],
            }
            
            # 1. 分析项目结构
            await self.emit_thinking("分析项目结构...")
            structure = await self._analyze_structure()
            result_data["project_structure"] = structure
            
            # 2. 识别技术栈
            await self.emit_thinking("识别技术栈...")
            tech_stack = await self._identify_tech_stack(structure)
            result_data["tech_stack"] = tech_stack
            
            # 3. 扫描依赖漏洞
            await self.emit_thinking("扫描依赖漏洞...")
            deps_result = await self._scan_dependencies(tech_stack)
            result_data["dependencies"] = deps_result.get("dependencies", {})
            if deps_result.get("findings"):
                result_data["initial_findings"].extend(deps_result["findings"])
            
            # 4. 快速密钥扫描
            await self.emit_thinking("扫描密钥泄露...")
            secrets_result = await self._scan_secrets()
            if secrets_result.get("findings"):
                result_data["initial_findings"].extend(secrets_result["findings"])
            
            # 5. 识别入口点
            await self.emit_thinking("识别入口点...")
            entry_points = await self._identify_entry_points(tech_stack)
            result_data["entry_points"] = entry_points
            
            # 6. 识别高风险区域
            result_data["high_risk_areas"] = self._identify_high_risk_areas(
                structure, tech_stack, entry_points
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self.emit_event(
                "info",
                f"信息收集完成: 发现 {len(result_data['entry_points'])} 个入口点, "
                f"{len(result_data['high_risk_areas'])} 个高风险区域, "
                f"{len(result_data['initial_findings'])} 个初步发现"
            )
            
            return AgentResult(
                success=True,
                data=result_data,
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Recon agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    async def _analyze_structure(self) -> Dict[str, Any]:
        """分析项目结构"""
        structure = {
            "directories": [],
            "files_by_type": {},
            "config_files": [],
            "total_files": 0,
        }
        
        # 列出根目录
        list_tool = self.tools.get("list_files")
        if not list_tool:
            return structure
        
        result = await list_tool.execute(directory=".", recursive=True, max_files=300)
        
        if result.success:
            structure["total_files"] = result.metadata.get("file_count", 0)
            
            # 识别配置文件
            config_patterns = [
                "package.json", "requirements.txt", "go.mod", "Cargo.toml",
                "pom.xml", "build.gradle", ".env", "config.py", "settings.py",
                "docker-compose.yml", "Dockerfile",
            ]
            
            # 从输出中解析文件列表
            if isinstance(result.data, str):
                for line in result.data.split('\n'):
                    line = line.strip()
                    for pattern in config_patterns:
                        if pattern in line:
                            structure["config_files"].append(line)
        
        return structure
    
    async def _identify_tech_stack(self, structure: Dict) -> Dict[str, Any]:
        """识别技术栈"""
        tech_stack = {
            "languages": [],
            "frameworks": [],
            "databases": [],
            "package_managers": [],
        }
        
        config_files = structure.get("config_files", [])
        
        # 基于配置文件推断
        for cfg in config_files:
            if "package.json" in cfg:
                tech_stack["languages"].append("JavaScript/TypeScript")
                tech_stack["package_managers"].append("npm")
            elif "requirements.txt" in cfg or "setup.py" in cfg:
                tech_stack["languages"].append("Python")
                tech_stack["package_managers"].append("pip")
            elif "go.mod" in cfg:
                tech_stack["languages"].append("Go")
            elif "Cargo.toml" in cfg:
                tech_stack["languages"].append("Rust")
            elif "pom.xml" in cfg or "build.gradle" in cfg:
                tech_stack["languages"].append("Java")
        
        # 读取 package.json 识别框架
        read_tool = self.tools.get("read_file")
        if read_tool and "package.json" in str(config_files):
            result = await read_tool.execute(file_path="package.json", max_lines=100)
            if result.success:
                content = result.data
                if "react" in content.lower():
                    tech_stack["frameworks"].append("React")
                if "vue" in content.lower():
                    tech_stack["frameworks"].append("Vue")
                if "express" in content.lower():
                    tech_stack["frameworks"].append("Express")
                if "fastify" in content.lower():
                    tech_stack["frameworks"].append("Fastify")
                if "next" in content.lower():
                    tech_stack["frameworks"].append("Next.js")
        
        # 读取 requirements.txt 识别框架
        if read_tool and "requirements.txt" in str(config_files):
            result = await read_tool.execute(file_path="requirements.txt", max_lines=50)
            if result.success:
                content = result.data.lower()
                if "django" in content:
                    tech_stack["frameworks"].append("Django")
                if "flask" in content:
                    tech_stack["frameworks"].append("Flask")
                if "fastapi" in content:
                    tech_stack["frameworks"].append("FastAPI")
                if "sqlalchemy" in content:
                    tech_stack["databases"].append("SQLAlchemy")
                if "pymongo" in content:
                    tech_stack["databases"].append("MongoDB")
        
        # 去重
        tech_stack["languages"] = list(set(tech_stack["languages"]))
        tech_stack["frameworks"] = list(set(tech_stack["frameworks"]))
        tech_stack["databases"] = list(set(tech_stack["databases"]))
        
        return tech_stack
    
    async def _scan_dependencies(self, tech_stack: Dict) -> Dict[str, Any]:
        """扫描依赖漏洞"""
        result = {
            "dependencies": {},
            "findings": [],
        }
        
        # npm audit
        if "npm" in tech_stack.get("package_managers", []):
            npm_tool = self.tools.get("npm_audit")
            if npm_tool:
                npm_result = await npm_tool.execute()
                if npm_result.success and npm_result.metadata.get("findings_count", 0) > 0:
                    result["dependencies"]["npm"] = npm_result.metadata
                    
                    # 转换为发现格式
                    for sev, count in npm_result.metadata.get("severity_counts", {}).items():
                        if count > 0 and sev in ["critical", "high"]:
                            result["findings"].append({
                                "vulnerability_type": "dependency_vulnerability",
                                "severity": sev,
                                "title": f"npm 依赖漏洞 ({count} 个 {sev})",
                                "source": "npm_audit",
                            })
        
        # Safety (Python)
        if "pip" in tech_stack.get("package_managers", []):
            safety_tool = self.tools.get("safety_scan")
            if safety_tool:
                safety_result = await safety_tool.execute()
                if safety_result.success and safety_result.metadata.get("findings_count", 0) > 0:
                    result["dependencies"]["pip"] = safety_result.metadata
                    result["findings"].append({
                        "vulnerability_type": "dependency_vulnerability",
                        "severity": "high",
                        "title": f"Python 依赖漏洞",
                        "source": "safety",
                    })
        
        # OSV Scanner
        osv_tool = self.tools.get("osv_scan")
        if osv_tool:
            osv_result = await osv_tool.execute()
            if osv_result.success and osv_result.metadata.get("findings_count", 0) > 0:
                result["dependencies"]["osv"] = osv_result.metadata
        
        return result
    
    async def _scan_secrets(self) -> Dict[str, Any]:
        """扫描密钥泄露"""
        result = {"findings": []}
        
        gitleaks_tool = self.tools.get("gitleaks_scan")
        if gitleaks_tool:
            gl_result = await gitleaks_tool.execute()
            if gl_result.success and gl_result.metadata.get("findings_count", 0) > 0:
                for finding in gl_result.metadata.get("findings", []):
                    result["findings"].append({
                        "vulnerability_type": "hardcoded_secret",
                        "severity": "high",
                        "title": f"密钥泄露: {finding.get('rule', 'unknown')}",
                        "file_path": finding.get("file"),
                        "line_start": finding.get("line"),
                        "source": "gitleaks",
                    })
        
        return result
    
    async def _identify_entry_points(self, tech_stack: Dict) -> List[Dict[str, Any]]:
        """识别入口点"""
        entry_points = []
        search_tool = self.tools.get("search_code")
        
        if not search_tool:
            return entry_points
        
        # 基于框架搜索入口点
        search_patterns = []
        
        frameworks = tech_stack.get("frameworks", [])
        
        if "Express" in frameworks:
            search_patterns.extend([
                ("app.get(", "Express GET route"),
                ("app.post(", "Express POST route"),
                ("router.get(", "Express router GET"),
                ("router.post(", "Express router POST"),
            ])
        
        if "FastAPI" in frameworks:
            search_patterns.extend([
                ("@app.get(", "FastAPI GET endpoint"),
                ("@app.post(", "FastAPI POST endpoint"),
                ("@router.get(", "FastAPI router GET"),
                ("@router.post(", "FastAPI router POST"),
            ])
        
        if "Django" in frameworks:
            search_patterns.extend([
                ("def get(self", "Django GET view"),
                ("def post(self", "Django POST view"),
                ("path(", "Django URL pattern"),
            ])
        
        if "Flask" in frameworks:
            search_patterns.extend([
                ("@app.route(", "Flask route"),
                ("@blueprint.route(", "Flask blueprint route"),
            ])
        
        # 通用模式
        search_patterns.extend([
            ("def handle", "Handler function"),
            ("async def handle", "Async handler"),
            ("class.*Controller", "Controller class"),
            ("class.*Handler", "Handler class"),
        ])
        
        for pattern, description in search_patterns[:10]:  # 限制搜索数量
            result = await search_tool.execute(keyword=pattern, max_results=10)
            if result.success and result.metadata.get("matches", 0) > 0:
                for match in result.metadata.get("results", [])[:5]:
                    entry_points.append({
                        "type": description,
                        "file": match.get("file"),
                        "line": match.get("line"),
                        "pattern": pattern,
                    })
        
        return entry_points[:30]  # 限制总数
    
    def _identify_high_risk_areas(
        self,
        structure: Dict,
        tech_stack: Dict,
        entry_points: List[Dict],
    ) -> List[str]:
        """识别高风险区域"""
        high_risk = set()
        
        # 通用高风险目录
        risk_dirs = [
            "auth/", "authentication/", "login/",
            "api/", "routes/", "controllers/", "handlers/",
            "db/", "database/", "models/",
            "admin/", "management/",
            "upload/", "file/",
            "payment/", "billing/",
        ]
        
        for dir_name in risk_dirs:
            high_risk.add(dir_name)
        
        # 从入口点提取目录
        for ep in entry_points:
            file_path = ep.get("file", "")
            if "/" in file_path:
                dir_path = "/".join(file_path.split("/")[:-1]) + "/"
                high_risk.add(dir_path)
        
        return list(high_risk)[:20]


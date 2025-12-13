"""
Tracer - 审计追踪器

提供完整的审计过程追踪，包括：
- Agent 创建和状态变化
- 工具执行记录
- 漏洞报告管理
- 最终扫描结果
- 数据持久化
"""

import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# 全局 Tracer 实例
_global_tracer: Optional["Tracer"] = None


def get_global_tracer() -> Optional["Tracer"]:
    """获取全局 Tracer 实例"""
    return _global_tracer


def set_global_tracer(tracer: "Tracer") -> None:
    """设置全局 Tracer 实例"""
    global _global_tracer
    _global_tracer = tracer


class Tracer:
    """
    审计追踪器
    
    追踪整个审计过程，支持：
    - Agent 生命周期追踪
    - 工具执行记录
    - 漏洞报告收集
    - 数据持久化到文件
    """
    
    def __init__(
        self,
        run_name: Optional[str] = None,
        output_dir: Optional[Path] = None,
    ):
        # 运行标识
        self.run_name = run_name
        self.run_id = run_name or f"run-{uuid4().hex[:8]}"
        self.start_time = datetime.now(timezone.utc).isoformat()
        self.end_time: Optional[str] = None
        
        # 追踪数据
        self.agents: Dict[str, Dict[str, Any]] = {}
        self.tool_executions: Dict[int, Dict[str, Any]] = {}
        self.chat_messages: List[Dict[str, Any]] = []
        
        # 漏洞报告
        self.vulnerability_reports: List[Dict[str, Any]] = []
        self.final_scan_result: Optional[str] = None
        
        # 扫描配置和结果
        self.scan_config: Optional[Dict[str, Any]] = None
        self.scan_results: Optional[Dict[str, Any]] = None
        
        # 元数据
        self.run_metadata: Dict[str, Any] = {
            "run_id": self.run_id,
            "run_name": self.run_name,
            "start_time": self.start_time,
            "end_time": None,
            "status": "running",
        }
        
        # 输出目录
        self._output_dir = output_dir
        self._run_dir: Optional[Path] = None
        
        # 计数器
        self._next_execution_id = 1
        self._next_message_id = 1
        self._saved_vuln_ids: set = set()
        
        # 回调函数
        self.vulnerability_found_callback: Optional[Callable[[str, str, str, str], None]] = None
        self.agent_status_callback: Optional[Callable[[str, str], None]] = None
    
    def set_run_name(self, run_name: str) -> None:
        """设置运行名称"""
        self.run_name = run_name
        self.run_id = run_name
        self.run_metadata["run_name"] = run_name
        self.run_metadata["run_id"] = run_name
    
    def get_run_dir(self) -> Path:
        """获取运行输出目录"""
        if self._run_dir is None:
            if self._output_dir:
                base_dir = self._output_dir
            else:
                base_dir = Path.cwd() / "audit_runs"
            
            base_dir.mkdir(exist_ok=True)
            
            run_dir_name = self.run_name or self.run_id
            # 清理非法字符
            run_dir_name = "".join(
                c if c.isalnum() or c in "-_" else "_"
                for c in run_dir_name
            )
            self._run_dir = base_dir / run_dir_name
            self._run_dir.mkdir(exist_ok=True)
        
        return self._run_dir
    
    def set_scan_config(self, config: Dict[str, Any]) -> None:
        """设置扫描配置"""
        self.scan_config = config
        self.run_metadata.update({
            "project_name": config.get("project_name", ""),
            "scan_type": config.get("scan_type", ""),
            "files_count": len(config.get("files", [])),
        })
        # 初始化输出目录
        self.get_run_dir()
    
    # ============ Agent 追踪 ============
    
    def log_agent_creation(
        self,
        agent_id: str,
        name: str,
        task: str,
        parent_id: Optional[str] = None,
        agent_type: str = "generic",
    ) -> None:
        """记录 Agent 创建"""
        agent_data = {
            "id": agent_id,
            "name": name,
            "task": task,
            "type": agent_type,
            "status": "running",
            "parent_id": parent_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "tool_executions": [],
            "findings_count": 0,
        }
        
        self.agents[agent_id] = agent_data
        logger.debug(f"Tracer: Agent created - {name} ({agent_id})")
    
    def update_agent_status(
        self,
        agent_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        """更新 Agent 状态"""
        if agent_id in self.agents:
            self.agents[agent_id]["status"] = status
            self.agents[agent_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            if error_message:
                self.agents[agent_id]["error_message"] = error_message
            
            if status in ["completed", "failed", "stopped"]:
                self.agents[agent_id]["finished_at"] = datetime.now(timezone.utc).isoformat()
            
            # 触发回调
            if self.agent_status_callback:
                try:
                    self.agent_status_callback(agent_id, status)
                except Exception as e:
                    logger.warning(f"Agent status callback failed: {e}")
    
    # ============ 工具执行追踪 ============
    
    def log_tool_execution_start(
        self,
        agent_id: str,
        tool_name: str,
        args: Dict[str, Any],
    ) -> int:
        """记录工具执行开始"""
        execution_id = self._next_execution_id
        self._next_execution_id += 1
        
        now = datetime.now(timezone.utc).isoformat()
        
        # 清理过大的参数
        cleaned_args = self._clean_args(args)
        
        execution_data = {
            "execution_id": execution_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "args": cleaned_args,
            "status": "running",
            "result": None,
            "started_at": now,
            "completed_at": None,
        }
        
        self.tool_executions[execution_id] = execution_data
        
        # 关联到 Agent
        if agent_id in self.agents:
            self.agents[agent_id]["tool_executions"].append(execution_id)
        
        return execution_id
    
    def update_tool_execution(
        self,
        execution_id: int,
        status: str,
        result: Any = None,
    ) -> None:
        """更新工具执行状态"""
        if execution_id in self.tool_executions:
            self.tool_executions[execution_id]["status"] = status
            self.tool_executions[execution_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # 清理过大的结果
            if result is not None:
                self.tool_executions[execution_id]["result"] = self._clean_result(result)
    
    def _clean_args(self, args: Dict[str, Any], max_length: int = 1000) -> Dict[str, Any]:
        """清理参数，限制长度"""
        cleaned = {}
        for key, value in args.items():
            if isinstance(value, str) and len(value) > max_length:
                cleaned[key] = value[:max_length] + "... [truncated]"
            elif isinstance(value, (list, dict)):
                try:
                    serialized = json.dumps(value, ensure_ascii=False)
                    if len(serialized) > max_length:
                        cleaned[key] = f"[{type(value).__name__} with {len(value)} items, truncated]"
                    else:
                        cleaned[key] = value
                except (TypeError, ValueError):
                    cleaned[key] = str(value)[:max_length]
            else:
                cleaned[key] = value
        return cleaned
    
    def _clean_result(self, result: Any, max_length: int = 2000) -> Any:
        """清理结果，限制长度"""
        if isinstance(result, str):
            if len(result) > max_length:
                return result[:max_length] + "... [truncated]"
            return result
        
        if isinstance(result, dict):
            cleaned = {}
            for key, value in result.items():
                cleaned[key] = self._clean_result(value, max_length // 2)
            return cleaned
        
        if isinstance(result, list):
            if len(result) > 20:
                return [self._clean_result(item, max_length // 4) for item in result[:20]] + [
                    f"... and {len(result) - 20} more items"
                ]
            return [self._clean_result(item, max_length // 2) for item in result]
        
        return result
    
    # ============ 消息追踪 ============
    
    def log_chat_message(
        self,
        content: str,
        role: str,
        agent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """记录聊天消息"""
        message_id = self._next_message_id
        self._next_message_id += 1
        
        # 清理过长的内容
        if len(content) > 5000:
            content = content[:5000] + "... [truncated]"
        
        message_data = {
            "message_id": message_id,
            "content": content,
            "role": role,
            "agent_id": agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }
        
        self.chat_messages.append(message_data)
        return message_id
    
    # ============ 漏洞报告 ============
    
    def add_vulnerability_report(
        self,
        title: str,
        content: str,
        severity: str,
        agent_id: Optional[str] = None,
        vulnerability_type: Optional[str] = None,
        file_path: Optional[str] = None,
    ) -> str:
        """添加漏洞报告"""
        report_id = f"vuln-{len(self.vulnerability_reports) + 1:04d}"
        
        report = {
            "id": report_id,
            "title": title.strip(),
            "content": content.strip(),
            "severity": severity.lower().strip(),
            "vulnerability_type": vulnerability_type,
            "file_path": file_path,
            "agent_id": agent_id,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        }
        
        self.vulnerability_reports.append(report)
        logger.info(f"Tracer: Vulnerability report added - {report_id}: {title}")
        
        # 更新 Agent 统计
        if agent_id and agent_id in self.agents:
            self.agents[agent_id]["findings_count"] = (
                self.agents[agent_id].get("findings_count", 0) + 1
            )
        
        # 触发回调
        if self.vulnerability_found_callback:
            try:
                self.vulnerability_found_callback(
                    report_id,
                    title.strip(),
                    content.strip(),
                    severity.lower().strip(),
                )
            except Exception as e:
                logger.warning(f"Vulnerability callback failed: {e}")
        
        # 自动保存
        self._save_vulnerability_reports()
        
        return report_id
    
    def set_final_scan_result(
        self,
        content: str,
        success: bool = True,
    ) -> None:
        """设置最终扫描结果"""
        self.final_scan_result = content.strip()
        
        self.scan_results = {
            "scan_completed": True,
            "content": content,
            "success": success,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "total_vulnerabilities": len(self.vulnerability_reports),
        }
        
        self.run_metadata["status"] = "completed" if success else "failed"
        self.end_time = datetime.now(timezone.utc).isoformat()
        self.run_metadata["end_time"] = self.end_time
        
        logger.info(f"Tracer: Final scan result set, success={success}")
        
        # 保存所有数据
        self.save_run_data(mark_complete=True)
    
    # ============ 数据持久化 ============
    
    def save_run_data(self, mark_complete: bool = False) -> None:
        """保存运行数据"""
        try:
            run_dir = self.get_run_dir()
            
            if mark_complete:
                self.end_time = datetime.now(timezone.utc).isoformat()
                self.run_metadata["end_time"] = self.end_time
            
            # 保存最终报告
            if self.final_scan_result:
                self._save_final_report(run_dir)
            
            # 保存漏洞报告
            self._save_vulnerability_reports()
            
            # 保存运行元数据
            self._save_metadata(run_dir)
            
            logger.info(f"Tracer: Run data saved to {run_dir}")
            
        except Exception as e:
            logger.exception(f"Failed to save run data: {e}")
    
    def _save_final_report(self, run_dir: Path) -> None:
        """保存最终报告"""
        report_file = run_dir / "security_audit_report.md"
        
        with report_file.open("w", encoding="utf-8") as f:
            f.write("# 安全审计报告\n\n")
            f.write(f"**生成时间:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
            f.write(f"**运行ID:** {self.run_id}\n\n")
            
            # 统计信息
            f.write("## 审计概述\n\n")
            f.write(f"- 发现漏洞数: {len(self.vulnerability_reports)}\n")
            f.write(f"- 参与Agent数: {len(self.agents)}\n")
            f.write(f"- 工具调用数: {len(self.tool_executions)}\n\n")
            
            # 漏洞统计
            if self.vulnerability_reports:
                severity_counts = {}
                for vuln in self.vulnerability_reports:
                    severity = vuln.get("severity", "unknown")
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1
                
                f.write("### 漏洞严重性分布\n\n")
                for severity, count in sorted(severity_counts.items()):
                    f.write(f"- {severity.upper()}: {count}\n")
                f.write("\n")
            
            f.write("---\n\n")
            f.write(f"{self.final_scan_result}\n")
        
        logger.info(f"Saved final report to: {report_file}")
    
    def _save_vulnerability_reports(self) -> None:
        """保存漏洞报告"""
        if not self.vulnerability_reports:
            return
        
        try:
            run_dir = self.get_run_dir()
            vuln_dir = run_dir / "vulnerabilities"
            vuln_dir.mkdir(exist_ok=True)
            
            # 只保存新的报告
            new_reports = [
                report for report in self.vulnerability_reports
                if report["id"] not in self._saved_vuln_ids
            ]
            
            for report in new_reports:
                vuln_file = vuln_dir / f"{report['id']}.md"
                with vuln_file.open("w", encoding="utf-8") as f:
                    f.write(f"# {report['title']}\n\n")
                    f.write(f"**ID:** {report['id']}\n")
                    f.write(f"**严重性:** {report['severity'].upper()}\n")
                    f.write(f"**发现时间:** {report['timestamp']}\n")
                    
                    if report.get("vulnerability_type"):
                        f.write(f"**漏洞类型:** {report['vulnerability_type']}\n")
                    if report.get("file_path"):
                        f.write(f"**文件位置:** {report['file_path']}\n")
                    
                    f.write("\n## 详细描述\n\n")
                    f.write(f"{report['content']}\n")
                
                self._saved_vuln_ids.add(report["id"])
            
            # 保存漏洞索引 CSV
            if self.vulnerability_reports:
                csv_file = run_dir / "vulnerabilities.csv"
                severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
                sorted_reports = sorted(
                    self.vulnerability_reports,
                    key=lambda x: (severity_order.get(x["severity"], 5), x["timestamp"]),
                )
                
                with csv_file.open("w", encoding="utf-8", newline="") as f:
                    fieldnames = ["id", "title", "severity", "type", "file", "timestamp"]
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    
                    for report in sorted_reports:
                        writer.writerow({
                            "id": report["id"],
                            "title": report["title"],
                            "severity": report["severity"].upper(),
                            "type": report.get("vulnerability_type", ""),
                            "file": report.get("file_path", ""),
                            "timestamp": report["timestamp"],
                        })
            
            if new_reports:
                logger.info(f"Saved {len(new_reports)} new vulnerability reports to {vuln_dir}")
                
        except Exception as e:
            logger.warning(f"Failed to save vulnerability reports: {e}")
    
    def _save_metadata(self, run_dir: Path) -> None:
        """保存运行元数据"""
        metadata_file = run_dir / "run_metadata.json"
        
        metadata = {
            **self.run_metadata,
            "agents_count": len(self.agents),
            "tool_executions_count": len(self.tool_executions),
            "vulnerabilities_count": len(self.vulnerability_reports),
            "duration_seconds": self._calculate_duration(),
        }
        
        with metadata_file.open("w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    def _calculate_duration(self) -> float:
        """计算运行时长"""
        try:
            start = datetime.fromisoformat(self.start_time.replace("Z", "+00:00"))
            if self.end_time:
                end = datetime.fromisoformat(self.end_time.replace("Z", "+00:00"))
            else:
                end = datetime.now(timezone.utc)
            return (end - start).total_seconds()
        except (ValueError, TypeError):
            return 0.0
    
    # ============ 统计和查询 ============
    
    def get_agent_tools(self, agent_id: str) -> List[Dict[str, Any]]:
        """获取 Agent 的工具执行记录"""
        return [
            exec_data for exec_data in self.tool_executions.values()
            if exec_data.get("agent_id") == agent_id
        ]
    
    def get_real_tool_count(self) -> int:
        """获取实际工具执行次数（排除系统工具）"""
        system_tools = {"scan_start_info", "subagent_start_info"}
        return sum(
            1 for exec_data in self.tool_executions.values()
            if exec_data.get("tool_name") not in system_tools
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        agent_stats = {"running": 0, "completed": 0, "failed": 0, "stopped": 0}
        for agent in self.agents.values():
            status = agent.get("status", "unknown")
            if status in agent_stats:
                agent_stats[status] += 1
        
        vuln_stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for vuln in self.vulnerability_reports:
            severity = vuln.get("severity", "medium")
            if severity in vuln_stats:
                vuln_stats[severity] += 1
        
        return {
            "agents": agent_stats,
            "vulnerabilities": vuln_stats,
            "total_agents": len(self.agents),
            "total_vulnerabilities": len(self.vulnerability_reports),
            "total_tool_executions": self.get_real_tool_count(),
            "duration_seconds": self._calculate_duration(),
        }
    
    def cleanup(self) -> None:
        """清理并保存最终数据"""
        self.save_run_data(mark_complete=True)

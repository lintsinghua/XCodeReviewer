"""
Agent Graph 管理模块

提供全局Agent图管理功能，参考业界最佳实践设计：
- 动态Agent树结构
- Agent状态管理
- Agent控制（停止、消息等）
- 统计和监控
"""

import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .registry import agent_registry
from .message import message_bus, MessageType, MessagePriority

logger = logging.getLogger(__name__)


class AgentGraphController:
    """
    Agent 图控制器
    
    提供对Agent树的高级控制操作
    """
    
    def __init__(self):
        self._lock = threading.RLock()
    
    # ============ Agent 控制 ============
    
    def stop_agent(self, agent_id: str) -> Dict[str, Any]:
        """
        停止指定Agent
        
        Args:
            agent_id: Agent ID
            
        Returns:
            操作结果
        """
        with self._lock:
            node = agent_registry.get_agent_node(agent_id)
            if not node:
                return {
                    "success": False,
                    "error": f"Agent '{agent_id}' not found",
                }
            
            # 检查状态
            status = node.get("status", "")
            if status in ["completed", "failed", "stopped"]:
                return {
                    "success": True,
                    "message": f"Agent '{node['name']}' 已经是 {status} 状态",
                    "previous_status": status,
                }
            
            # 获取Agent状态对象
            agent_state = agent_registry.get_agent_state(agent_id)
            if agent_state:
                agent_state.request_stop()
            
            # 获取Agent实例
            agent_instance = agent_registry.get_agent(agent_id)
            if agent_instance:
                if hasattr(agent_instance, "cancel"):
                    agent_instance.cancel()
                if hasattr(agent_instance, "_cancelled"):
                    agent_instance._cancelled = True
            
            # 更新状态
            agent_registry.update_agent_status(agent_id, "stopping")
            
            logger.info(f"Stop request sent to agent: {node['name']} ({agent_id})")
            
            return {
                "success": True,
                "message": f"已向 Agent '{node['name']}' 发送停止请求",
                "agent_id": agent_id,
                "agent_name": node["name"],
                "note": "Agent将在当前迭代完成后停止",
            }
    
    def stop_all_agents(self, exclude_root: bool = True) -> Dict[str, Any]:
        """
        停止所有Agent
        
        Args:
            exclude_root: 是否排除根Agent
            
        Returns:
            操作结果
        """
        tree = agent_registry.get_agent_tree()
        root_id = tree.get("root_agent_id")
        
        stopped = []
        failed = []
        
        for agent_id, node in tree["nodes"].items():
            if exclude_root and agent_id == root_id:
                continue
            
            if node.get("status") in ["completed", "failed", "stopped"]:
                continue
            
            result = self.stop_agent(agent_id)
            if result.get("success"):
                stopped.append(agent_id)
            else:
                failed.append({"id": agent_id, "error": result.get("error")})
        
        return {
            "success": len(failed) == 0,
            "stopped_count": len(stopped),
            "failed_count": len(failed),
            "stopped": stopped,
            "failed": failed,
        }
    
    def send_message_to_agent(
        self,
        from_agent: str,
        target_agent_id: str,
        message: str,
        message_type: str = "information",
        priority: str = "normal",
    ) -> Dict[str, Any]:
        """
        向指定Agent发送消息
        
        Args:
            from_agent: 发送者Agent ID（或 "user"）
            target_agent_id: 目标Agent ID
            message: 消息内容
            message_type: 消息类型
            priority: 优先级
            
        Returns:
            操作结果
        """
        node = agent_registry.get_agent_node(target_agent_id)
        if not node:
            return {
                "success": False,
                "error": f"Target agent '{target_agent_id}' not found",
            }
        
        # 转换类型
        try:
            msg_type = MessageType(message_type)
        except ValueError:
            msg_type = MessageType.INFORMATION
        
        try:
            msg_priority = MessagePriority(priority)
        except ValueError:
            msg_priority = MessagePriority.NORMAL
        
        # 发送消息
        sent_message = message_bus.send_message(
            from_agent=from_agent,
            to_agent=target_agent_id,
            content=message,
            message_type=msg_type,
            priority=msg_priority,
        )
        
        return {
            "success": True,
            "message_id": sent_message.id,
            "message": f"消息已发送到 '{node['name']}'",
            "target_agent": {
                "id": target_agent_id,
                "name": node["name"],
                "status": node["status"],
            },
        }
    
    def send_user_message(
        self,
        target_agent_id: str,
        message: str,
    ) -> Dict[str, Any]:
        """
        发送用户消息到Agent
        
        Args:
            target_agent_id: 目标Agent ID
            message: 消息内容
            
        Returns:
            操作结果
        """
        return self.send_message_to_agent(
            from_agent="user",
            target_agent_id=target_agent_id,
            message=message,
            message_type="instruction",
            priority="high",
        )
    
    # ============ 状态查询 ============
    
    def get_agent_graph(self, current_agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        获取Agent图结构
        
        Args:
            current_agent_id: 当前Agent ID（用于标识）
            
        Returns:
            Agent图信息
        """
        tree = agent_registry.get_agent_tree()
        stats = agent_registry.get_statistics()
        
        # 构建树形视图
        tree_view = self._build_tree_view(tree, current_agent_id)
        
        return {
            "graph_structure": tree_view,
            "summary": stats,
            "nodes": tree["nodes"],
            "edges": tree["edges"],
            "root_agent_id": tree.get("root_agent_id"),
        }
    
    def _build_tree_view(
        self,
        tree: Dict[str, Any],
        current_agent_id: Optional[str] = None,
    ) -> str:
        """构建树形视图文本"""
        lines = ["=== AGENT GRAPH STRUCTURE ==="]
        
        root_id = tree.get("root_agent_id")
        if not root_id or root_id not in tree["nodes"]:
            return "No agents in the graph"
        
        def _build_node(agent_id: str, depth: int = 0) -> None:
            node = tree["nodes"].get(agent_id)
            if not node:
                return
            
            indent = "  " * depth
            
            # 状态标记
            status_emoji = {
                "running": "🔄",
                "waiting": "⏳",
                "completed": "✅",
                "failed": "❌",
                "stopped": "🛑",
                "stopping": "⏹️",
                "created": "🆕",
            }.get(node.get("status", ""), "❓")
            
            # 当前Agent标记
            you_marker = " ← 当前" if agent_id == current_agent_id else ""
            
            lines.append(f"{indent}{status_emoji} {node['name']} ({agent_id}){you_marker}")
            lines.append(f"{indent}   Task: {node.get('task', 'N/A')[:60]}...")
            lines.append(f"{indent}   Status: {node.get('status', 'unknown')}")
            
            if node.get("knowledge_modules"):
                lines.append(f"{indent}   Modules: {', '.join(node['knowledge_modules'])}")
            
            # 递归处理子Agent
            children = node.get("children", [])
            for child_id in children:
                _build_node(child_id, depth + 1)
        
        _build_node(root_id)
        return "\n".join(lines)
    
    def get_agent_status_summary(self) -> Dict[str, Any]:
        """获取Agent状态摘要"""
        stats = agent_registry.get_statistics()
        tree = agent_registry.get_agent_tree()
        
        # 详细状态列表
        agents_by_status = {
            "running": [],
            "waiting": [],
            "completed": [],
            "failed": [],
            "stopped": [],
        }
        
        for agent_id, node in tree["nodes"].items():
            status = node.get("status", "unknown")
            if status in agents_by_status:
                agents_by_status[status].append({
                    "id": agent_id,
                    "name": node.get("name"),
                    "task": node.get("task", "")[:50],
                })
        
        return {
            "summary": stats,
            "agents_by_status": agents_by_status,
            "has_active_agents": stats.get("running", 0) > 0 or stats.get("waiting", 0) > 0,
        }
    
    def check_active_agents(self, exclude_agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        检查是否有活跃的Agent
        
        Args:
            exclude_agent_id: 要排除的Agent ID
            
        Returns:
            活跃Agent信息
        """
        tree = agent_registry.get_agent_tree()
        
        running = []
        waiting = []
        stopping = []
        
        for agent_id, node in tree["nodes"].items():
            if agent_id == exclude_agent_id:
                continue
            
            status = node.get("status", "")
            agent_info = {
                "id": agent_id,
                "name": node.get("name", "Unknown"),
                "task": node.get("task", "")[:60],
            }
            
            if status == "running":
                running.append(agent_info)
            elif status == "waiting":
                waiting.append(agent_info)
            elif status == "stopping":
                stopping.append(agent_info)
        
        has_active = len(running) > 0 or len(stopping) > 0
        
        return {
            "has_active_agents": has_active,
            "running_count": len(running),
            "waiting_count": len(waiting),
            "stopping_count": len(stopping),
            "running": running,
            "waiting": waiting,
            "stopping": stopping,
        }
    
    # ============ 结果收集 ============
    
    def collect_all_findings(self) -> List[Dict[str, Any]]:
        """收集所有Agent的发现"""
        tree = agent_registry.get_agent_tree()
        all_findings = []
        
        for agent_id, node in tree["nodes"].items():
            result = node.get("result")
            if not result or not isinstance(result, dict):
                continue
            
            findings = result.get("findings", [])
            if not isinstance(findings, list):
                continue
            
            for finding in findings:
                if isinstance(finding, dict):
                    finding["discovered_by"] = {
                        "agent_id": agent_id,
                        "agent_name": node.get("name", "Unknown"),
                    }
                    all_findings.append(finding)
                elif isinstance(finding, str):
                    all_findings.append({
                        "description": finding,
                        "discovered_by": {
                            "agent_id": agent_id,
                            "agent_name": node.get("name", "Unknown"),
                        }
                    })
        
        return all_findings
    
    def get_findings_summary(self) -> Dict[str, Any]:
        """获取发现摘要"""
        findings = self.collect_all_findings()
        
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        
        type_counts = {}
        
        for finding in findings:
            # 统计严重性
            severity = finding.get("severity", "medium").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1
            
            # 统计类型
            vuln_type = finding.get("vulnerability_type", finding.get("type", "other"))
            type_counts[vuln_type] = type_counts.get(vuln_type, 0) + 1
        
        return {
            "total": len(findings),
            "by_severity": severity_counts,
            "by_type": type_counts,
            "findings": findings,
        }
    
    # ============ 清理 ============
    
    def cleanup(self) -> None:
        """清理所有Agent和消息"""
        agent_registry.clear()
        message_bus.clear_all()
        logger.info("Agent graph cleaned up")
    
    def cleanup_finished_agents(self) -> int:
        """清理已完成的Agent实例"""
        return agent_registry.cleanup_finished_agents()


# 全局控制器实例
agent_graph_controller = AgentGraphController()


# ============ 便捷函数 ============

def stop_agent(agent_id: str) -> Dict[str, Any]:
    """停止指定Agent"""
    return agent_graph_controller.stop_agent(agent_id)


def stop_all_agents(exclude_root: bool = True) -> Dict[str, Any]:
    """停止所有Agent"""
    return agent_graph_controller.stop_all_agents(exclude_root)


def send_user_message(target_agent_id: str, message: str) -> Dict[str, Any]:
    """发送用户消息"""
    return agent_graph_controller.send_user_message(target_agent_id, message)


def get_agent_graph(current_agent_id: Optional[str] = None) -> Dict[str, Any]:
    """获取Agent图"""
    return agent_graph_controller.get_agent_graph(current_agent_id)


def check_active_agents(exclude_agent_id: Optional[str] = None) -> Dict[str, Any]:
    """检查活跃Agent"""
    return agent_graph_controller.check_active_agents(exclude_agent_id)


def collect_all_findings() -> List[Dict[str, Any]]:
    """收集所有发现"""
    return agent_graph_controller.collect_all_findings()


def cleanup_graph() -> None:
    """清理Agent图"""
    agent_graph_controller.cleanup()


__all__ = [
    "AgentGraphController",
    "agent_graph_controller",
    "stop_agent",
    "stop_all_agents",
    "send_user_message",
    "get_agent_graph",
    "check_active_agents",
    "collect_all_findings",
    "cleanup_graph",
]

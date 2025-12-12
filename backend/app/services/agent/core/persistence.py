"""
Agent 状态持久化模块

提供 Agent 状态的持久化和恢复功能：
- Agent 状态序列化和反序列化
- 检查点保存和恢复
- 消息历史持久化
- 执行记录持久化
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path

from .state import AgentState, AgentStatus
from .registry import agent_registry

logger = logging.getLogger(__name__)


class AgentStatePersistence:
    """
    Agent 状态持久化管理器
    
    支持：
    - 文件系统持久化
    - 数据库持久化（可选）
    - 检查点机制
    """
    
    def __init__(
        self,
        persist_dir: str = "./agent_checkpoints",
        use_database: bool = False,
        db_session_factory=None,
    ):
        """
        初始化持久化管理器
        
        Args:
            persist_dir: 持久化目录
            use_database: 是否使用数据库持久化
            db_session_factory: 数据库会话工厂
        """
        self.persist_dir = Path(persist_dir)
        self.use_database = use_database
        self.db_session_factory = db_session_factory
        
        # 确保目录存在
        self.persist_dir.mkdir(parents=True, exist_ok=True)
    
    # ============ 文件系统持久化 ============
    
    def save_state(self, state: AgentState, checkpoint_name: Optional[str] = None) -> str:
        """
        保存 Agent 状态到文件
        
        Args:
            state: Agent 状态
            checkpoint_name: 检查点名称（可选）
            
        Returns:
            保存的文件路径
        """
        # 生成文件名
        if checkpoint_name:
            filename = f"{state.agent_id}_{checkpoint_name}.json"
        else:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{state.agent_id}_{timestamp}.json"
        
        filepath = self.persist_dir / filename
        
        # 序列化状态
        state_dict = self._serialize_state(state)
        
        # 保存到文件
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(state_dict, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Saved agent state to {filepath}")
        return str(filepath)
    
    def load_state(self, filepath: str) -> Optional[AgentState]:
        """
        从文件加载 Agent 状态
        
        Args:
            filepath: 文件路径
            
        Returns:
            Agent 状态，如果加载失败返回 None
        """
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                state_dict = json.load(f)
            
            state = self._deserialize_state(state_dict)
            logger.info(f"Loaded agent state from {filepath}")
            return state
            
        except Exception as e:
            logger.error(f"Failed to load agent state from {filepath}: {e}")
            return None
    
    def load_latest_checkpoint(self, agent_id: str) -> Optional[AgentState]:
        """
        加载指定 Agent 的最新检查点
        
        Args:
            agent_id: Agent ID
            
        Returns:
            Agent 状态
        """
        # 查找所有匹配的检查点文件
        pattern = f"{agent_id}_*.json"
        checkpoints = list(self.persist_dir.glob(pattern))
        
        if not checkpoints:
            logger.warning(f"No checkpoints found for agent {agent_id}")
            return None
        
        # 按修改时间排序，取最新的
        latest = max(checkpoints, key=lambda p: p.stat().st_mtime)
        return self.load_state(str(latest))
    
    def list_checkpoints(self, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        列出检查点
        
        Args:
            agent_id: Agent ID（可选，不指定则列出所有）
            
        Returns:
            检查点信息列表
        """
        if agent_id:
            pattern = f"{agent_id}_*.json"
        else:
            pattern = "*.json"
        
        checkpoints = []
        for filepath in self.persist_dir.glob(pattern):
            stat = filepath.stat()
            checkpoints.append({
                "filepath": str(filepath),
                "filename": filepath.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        
        # 按修改时间排序
        checkpoints.sort(key=lambda x: x["modified_at"], reverse=True)
        return checkpoints
    
    def delete_checkpoint(self, filepath: str) -> bool:
        """
        删除检查点
        
        Args:
            filepath: 文件路径
            
        Returns:
            是否删除成功
        """
        try:
            os.remove(filepath)
            logger.info(f"Deleted checkpoint: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete checkpoint {filepath}: {e}")
            return False
    
    def cleanup_old_checkpoints(
        self,
        agent_id: str,
        keep_count: int = 5,
    ) -> int:
        """
        清理旧的检查点，只保留最新的几个
        
        Args:
            agent_id: Agent ID
            keep_count: 保留的检查点数量
            
        Returns:
            删除的检查点数量
        """
        checkpoints = self.list_checkpoints(agent_id)
        
        if len(checkpoints) <= keep_count:
            return 0
        
        # 删除旧的检查点
        to_delete = checkpoints[keep_count:]
        deleted = 0
        
        for cp in to_delete:
            if self.delete_checkpoint(cp["filepath"]):
                deleted += 1
        
        return deleted
    
    # ============ 序列化/反序列化 ============
    
    def _serialize_state(self, state: AgentState) -> Dict[str, Any]:
        """序列化 Agent 状态"""
        return {
            "version": "1.0",
            "serialized_at": datetime.now(timezone.utc).isoformat(),
            "state": state.model_dump(),
        }
    
    def _deserialize_state(self, data: Dict[str, Any]) -> AgentState:
        """反序列化 Agent 状态"""
        version = data.get("version", "1.0")
        state_data = data.get("state", data)
        
        # 处理版本兼容性
        if version == "1.0":
            return AgentState(**state_data)
        else:
            logger.warning(f"Unknown state version: {version}, attempting to load anyway")
            return AgentState(**state_data)
    
    # ============ 数据库持久化 ============
    
    async def save_state_to_db(
        self,
        state: AgentState,
        task_id: str,
    ) -> bool:
        """
        保存 Agent 状态到数据库
        
        Args:
            state: Agent 状态
            task_id: 关联的任务 ID
            
        Returns:
            是否保存成功
        """
        if not self.use_database or not self.db_session_factory:
            logger.warning("Database persistence not configured")
            return False
        
        try:
            async with self.db_session_factory() as session:
                from app.models.agent_task import AgentCheckpoint
                
                checkpoint = AgentCheckpoint(
                    task_id=task_id,
                    agent_id=state.agent_id,
                    agent_name=state.agent_name,
                    agent_type=state.agent_type,
                    state_data=state.model_dump_json(),
                    iteration=state.iteration,
                    status=state.status,
                    created_at=datetime.now(timezone.utc),
                )
                
                session.add(checkpoint)
                await session.commit()
                
                logger.debug(f"Saved agent state to database: {state.agent_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to save agent state to database: {e}")
            return False
    
    async def load_state_from_db(
        self,
        task_id: str,
        agent_id: Optional[str] = None,
    ) -> Optional[AgentState]:
        """
        从数据库加载 Agent 状态
        
        Args:
            task_id: 任务 ID
            agent_id: Agent ID（可选）
            
        Returns:
            Agent 状态
        """
        if not self.use_database or not self.db_session_factory:
            logger.warning("Database persistence not configured")
            return None
        
        try:
            async with self.db_session_factory() as session:
                from sqlalchemy import select
                from app.models.agent_task import AgentCheckpoint
                
                query = select(AgentCheckpoint).where(
                    AgentCheckpoint.task_id == task_id
                )
                
                if agent_id:
                    query = query.where(AgentCheckpoint.agent_id == agent_id)
                
                query = query.order_by(AgentCheckpoint.created_at.desc()).limit(1)
                
                result = await session.execute(query)
                checkpoint = result.scalar_one_or_none()
                
                if checkpoint:
                    state_data = json.loads(checkpoint.state_data)
                    return AgentState(**state_data)
                
                return None
                
        except Exception as e:
            logger.error(f"Failed to load agent state from database: {e}")
            return None


class CheckpointManager:
    """
    检查点管理器
    
    提供自动检查点功能：
    - 定期保存检查点
    - 错误恢复
    - 状态回滚
    """
    
    def __init__(
        self,
        persistence: AgentStatePersistence,
        auto_checkpoint_interval: int = 5,  # 每 N 次迭代自动保存
    ):
        self.persistence = persistence
        self.auto_checkpoint_interval = auto_checkpoint_interval
        
        self._last_checkpoint_iteration: Dict[str, int] = {}
    
    def should_checkpoint(self, state: AgentState) -> bool:
        """
        判断是否应该创建检查点
        
        Args:
            state: Agent 状态
            
        Returns:
            是否应该创建检查点
        """
        last_iteration = self._last_checkpoint_iteration.get(state.agent_id, 0)
        return state.iteration - last_iteration >= self.auto_checkpoint_interval
    
    def create_checkpoint(
        self,
        state: AgentState,
        checkpoint_name: Optional[str] = None,
    ) -> str:
        """
        创建检查点
        
        Args:
            state: Agent 状态
            checkpoint_name: 检查点名称
            
        Returns:
            检查点文件路径
        """
        filepath = self.persistence.save_state(state, checkpoint_name)
        self._last_checkpoint_iteration[state.agent_id] = state.iteration
        return filepath
    
    def auto_checkpoint(self, state: AgentState) -> Optional[str]:
        """
        自动检查点（如果需要）
        
        Args:
            state: Agent 状态
            
        Returns:
            检查点文件路径，如果没有创建则返回 None
        """
        if self.should_checkpoint(state):
            return self.create_checkpoint(state)
        return None
    
    def restore_from_checkpoint(
        self,
        agent_id: str,
        checkpoint_filepath: Optional[str] = None,
    ) -> Optional[AgentState]:
        """
        从检查点恢复
        
        Args:
            agent_id: Agent ID
            checkpoint_filepath: 检查点文件路径（可选，不指定则使用最新的）
            
        Returns:
            恢复的 Agent 状态
        """
        if checkpoint_filepath:
            return self.persistence.load_state(checkpoint_filepath)
        else:
            return self.persistence.load_latest_checkpoint(agent_id)


# 全局持久化管理器
agent_persistence = AgentStatePersistence()
checkpoint_manager = CheckpointManager(agent_persistence)

"""WebSocket API
WebSocket endpoints for real-time updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set
from loguru import logger
import json
import asyncio

from api.dependencies import get_current_user_ws
from models.user import User


router = APIRouter()


# Connection manager for WebSocket connections
class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        # Map of task_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Map of websocket -> user_id
        self.connection_users: Dict[WebSocket, int] = {}
    
    async def connect(self, websocket: WebSocket, task_id: int, user_id: int):
        """
        Connect a websocket to a task.
        
        Args:
            websocket: WebSocket connection
            task_id: Task ID to subscribe to
            user_id: User ID
        """
        await websocket.accept()
        
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        
        self.active_connections[task_id].add(websocket)
        self.connection_users[websocket] = user_id
        
        logger.info(f"WebSocket connected for task {task_id}, user {user_id}")
    
    def disconnect(self, websocket: WebSocket, task_id: int):
        """
        Disconnect a websocket.
        
        Args:
            websocket: WebSocket connection
            task_id: Task ID
        """
        if task_id in self.active_connections:
            self.active_connections[task_id].discard(websocket)
            
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
        
        if websocket in self.connection_users:
            del self.connection_users[websocket]
        
        logger.info(f"WebSocket disconnected for task {task_id}")
    
    async def send_task_update(self, task_id: int, message: dict):
        """
        Send update to all connections for a task.
        
        Args:
            task_id: Task ID
            message: Message to send
        """
        if task_id not in self.active_connections:
            return
        
        # Send to all connected clients
        disconnected = set()
        
        for connection in self.active_connections[task_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection, task_id)
    
    async def broadcast(self, message: dict):
        """
        Broadcast message to all connections.
        
        Args:
            message: Message to send
        """
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/tasks/{task_id}")
async def websocket_task_updates(
    websocket: WebSocket,
    task_id: int
):
    """
    WebSocket endpoint for task progress updates.
    
    Args:
        websocket: WebSocket connection
        task_id: Task ID to subscribe to
    """
    # Note: Authentication for WebSocket is simplified
    # In production, implement proper token-based auth
    
    await manager.connect(websocket, task_id, user_id=1)  # Simplified
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "task_id": task_id,
            "message": "Connected to task updates"
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive messages from client (e.g., ping/pong)
                data = await websocket.receive_text()
                
                # Handle ping
                if data == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": asyncio.get_event_loop().time()
                    })
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
    
    finally:
        manager.disconnect(websocket, task_id)


async def send_task_progress(
    task_id: int,
    progress: int,
    status: str,
    current_step: str = None
):
    """
    Send task progress update via WebSocket.
    
    Args:
        task_id: Task ID
        progress: Progress percentage (0-100)
        status: Status message
        current_step: Current step description
    """
    message = {
        "type": "progress",
        "task_id": task_id,
        "progress": progress,
        "status": status,
        "current_step": current_step,
        "timestamp": asyncio.get_event_loop().time()
    }
    
    await manager.send_task_update(task_id, message)


async def send_task_completed(
    task_id: int,
    result: dict
):
    """
    Send task completion notification via WebSocket.
    
    Args:
        task_id: Task ID
        result: Task result data
    """
    message = {
        "type": "completed",
        "task_id": task_id,
        "result": result,
        "timestamp": asyncio.get_event_loop().time()
    }
    
    await manager.send_task_update(task_id, message)


async def send_task_failed(
    task_id: int,
    error: str
):
    """
    Send task failure notification via WebSocket.
    
    Args:
        task_id: Task ID
        error: Error message
    """
    message = {
        "type": "failed",
        "task_id": task_id,
        "error": error,
        "timestamp": asyncio.get_event_loop().time()
    }
    
    await manager.send_task_update(task_id, message)

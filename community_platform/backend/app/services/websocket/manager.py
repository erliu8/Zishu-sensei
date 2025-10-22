"""
WebSocket 连接管理器
"""
from typing import Dict, Set, Optional, Any, List
from datetime import datetime
import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict

from app.db.redis import redis_client


class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        # 活跃连接：user_id -> Set[WebSocket]
        self.active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)
        # WebSocket -> user_id 的反向映射
        self.websocket_to_user: Dict[WebSocket, int] = {}
        # 用户在线状态：user_id -> last_seen
        self.online_users: Dict[int, datetime] = {}
        # 锁，用于并发控制
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """
        连接 WebSocket
        
        Args:
            websocket: WebSocket 连接
            user_id: 用户 ID
        """
        await websocket.accept()
        
        async with self._lock:
            # 添加到活跃连接
            self.active_connections[user_id].add(websocket)
            self.websocket_to_user[websocket] = user_id
            self.online_users[user_id] = datetime.utcnow()
            
            # 更新 Redis 中的在线状态
            await self._update_online_status(user_id, True)
        
        # 广播用户上线消息
        await self.broadcast_user_status(user_id, "online")
    
    async def disconnect(self, websocket: WebSocket):
        """
        断开 WebSocket 连接
        
        Args:
            websocket: WebSocket 连接
        """
        async with self._lock:
            user_id = self.websocket_to_user.get(websocket)
            if user_id is None:
                return
            
            # 移除连接
            self.active_connections[user_id].discard(websocket)
            del self.websocket_to_user[websocket]
            
            # 如果用户没有其他连接，标记为离线
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.online_users[user_id] = datetime.utcnow()
                
                # 更新 Redis 中的在线状态
                await self._update_online_status(user_id, False)
                
                # 广播用户下线消息
                await self.broadcast_user_status(user_id, "offline")
    
    async def send_personal_message(
        self,
        message: str | Dict[str, Any],
        websocket: WebSocket
    ):
        """
        发送个人消息
        
        Args:
            message: 消息内容（字符串或字典）
            websocket: 目标 WebSocket
        """
        try:
            if isinstance(message, dict):
                message = json.dumps(message)
            await websocket.send_text(message)
        except Exception as e:
            print(f"发送个人消息失败: {e}")
    
    async def send_to_user(
        self,
        message: str | Dict[str, Any],
        user_id: int
    ):
        """
        发送消息给指定用户的所有连接
        
        Args:
            message: 消息内容
            user_id: 目标用户 ID
        """
        if isinstance(message, dict):
            message = json.dumps(message)
        
        connections = self.active_connections.get(user_id, set())
        disconnected = []
        
        for connection in connections:
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                disconnected.append(connection)
            except Exception as e:
                print(f"发送消息给用户 {user_id} 失败: {e}")
                disconnected.append(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            await self.disconnect(connection)
    
    async def broadcast(
        self,
        message: str | Dict[str, Any],
        exclude_user_id: Optional[int] = None
    ):
        """
        广播消息给所有连接的用户
        
        Args:
            message: 消息内容
            exclude_user_id: 排除的用户 ID（可选）
        """
        if isinstance(message, dict):
            message = json.dumps(message)
        
        disconnected = []
        
        for user_id, connections in self.active_connections.items():
            if exclude_user_id and user_id == exclude_user_id:
                continue
            
            for connection in connections:
                try:
                    await connection.send_text(message)
                except WebSocketDisconnect:
                    disconnected.append(connection)
                except Exception as e:
                    print(f"广播消息失败: {e}")
                    disconnected.append(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            await self.disconnect(connection)
    
    async def broadcast_to_users(
        self,
        message: str | Dict[str, Any],
        user_ids: List[int]
    ):
        """
        广播消息给指定的多个用户
        
        Args:
            message: 消息内容
            user_ids: 目标用户 ID 列表
        """
        if isinstance(message, dict):
            message = json.dumps(message)
        
        disconnected = []
        
        for user_id in user_ids:
            connections = self.active_connections.get(user_id, set())
            for connection in connections:
                try:
                    await connection.send_text(message)
                except WebSocketDisconnect:
                    disconnected.append(connection)
                except Exception as e:
                    print(f"广播消息给用户 {user_id} 失败: {e}")
                    disconnected.append(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            await self.disconnect(connection)
    
    async def broadcast_user_status(self, user_id: int, status: str):
        """
        广播用户状态变化
        
        Args:
            user_id: 用户 ID
            status: 状态（online/offline）
        """
        message = {
            "type": "user_status",
            "data": {
                "user_id": user_id,
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast(message, exclude_user_id=user_id)
    
    def is_user_online(self, user_id: int) -> bool:
        """
        检查用户是否在线
        
        Args:
            user_id: 用户 ID
        
        Returns:
            bool: 是否在线
        """
        return user_id in self.active_connections
    
    def get_online_users(self) -> List[int]:
        """
        获取所有在线用户 ID
        
        Returns:
            List[int]: 在线用户 ID 列表
        """
        return list(self.active_connections.keys())
    
    def get_online_count(self) -> int:
        """
        获取在线用户数量
        
        Returns:
            int: 在线用户数量
        """
        return len(self.active_connections)
    
    def get_user_connections_count(self, user_id: int) -> int:
        """
        获取用户的连接数
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 连接数
        """
        return len(self.active_connections.get(user_id, set()))
    
    async def _update_online_status(self, user_id: int, is_online: bool):
        """
        更新 Redis 中的在线状态
        
        Args:
            user_id: 用户 ID
            is_online: 是否在线
        """
        try:
            key = f"user:online:{user_id}"
            if is_online:
                # 设置在线状态，过期时间 30 分钟
                await redis_client.set(
                    key,
                    json.dumps({
                        "user_id": user_id,
                        "online": True,
                        "last_seen": datetime.utcnow().isoformat()
                    }),
                    expire=1800  # 30 分钟
                )
            else:
                # 设置离线状态
                await redis_client.set(
                    key,
                    json.dumps({
                        "user_id": user_id,
                        "online": False,
                        "last_seen": datetime.utcnow().isoformat()
                    }),
                    expire=86400  # 保留 24 小时用于显示最后在线时间
                )
        except Exception as e:
            print(f"更新在线状态到 Redis 失败: {e}")
    
    async def send_notification(
        self,
        user_id: int,
        notification_type: str,
        data: Dict[str, Any]
    ):
        """
        发送通知给用户
        
        Args:
            user_id: 用户 ID
            notification_type: 通知类型
            data: 通知数据
        """
        message = {
            "type": "notification",
            "notification_type": notification_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.send_to_user(message, user_id)
    
    async def send_message(
        self,
        user_id: int,
        message_type: str,
        data: Dict[str, Any]
    ):
        """
        发送自定义消息给用户
        
        Args:
            user_id: 用户 ID
            message_type: 消息类型
            data: 消息数据
        """
        message = {
            "type": message_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.send_to_user(message, user_id)


# 全局连接管理器实例
manager = ConnectionManager()


"""
在线状态管理服务
"""
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import json

from app.db.redis import redis_client
from app.schemas.websocket import OnlineStatus


class PresenceService:
    """在线状态服务"""
    
    def __init__(self):
        self.online_prefix = "user:online:"
        self.presence_prefix = "user:presence:"
        self.online_users_set = "users:online:set"
    
    async def set_user_online(
        self,
        user_id: int,
        connections_count: int = 1
    ):
        """
        设置用户为在线状态
        
        Args:
            user_id: 用户 ID
            connections_count: 连接数
        """
        try:
            now = datetime.utcnow()
            key = f"{self.online_prefix}{user_id}"
            
            # 设置在线状态
            await redis_client.set(
                key,
                json.dumps({
                    "user_id": user_id,
                    "online": True,
                    "last_seen": now.isoformat(),
                    "connections_count": connections_count
                }),
                expire=1800  # 30 分钟
            )
            
            # 添加到在线用户集合
            await redis_client.sadd(self.online_users_set, user_id)
            
        except Exception as e:
            print(f"设置用户在线状态失败: {e}")
    
    async def set_user_offline(self, user_id: int):
        """
        设置用户为离线状态
        
        Args:
            user_id: 用户 ID
        """
        try:
            now = datetime.utcnow()
            key = f"{self.online_prefix}{user_id}"
            
            # 设置离线状态
            await redis_client.set(
                key,
                json.dumps({
                    "user_id": user_id,
                    "online": False,
                    "last_seen": now.isoformat(),
                    "connections_count": 0
                }),
                expire=86400  # 保留 24 小时
            )
            
            # 从在线用户集合中移除
            await redis_client.srem(self.online_users_set, user_id)
            
        except Exception as e:
            print(f"设置用户离线状态失败: {e}")
    
    async def get_user_status(self, user_id: int) -> Optional[OnlineStatus]:
        """
        获取用户在线状态
        
        Args:
            user_id: 用户 ID
        
        Returns:
            OnlineStatus: 在线状态，如果未找到返回 None
        """
        try:
            key = f"{self.online_prefix}{user_id}"
            data = await redis_client.get(key)
            
            if data:
                status_data = json.loads(data)
                return OnlineStatus(
                    user_id=status_data["user_id"],
                    online=status_data["online"],
                    last_seen=datetime.fromisoformat(status_data["last_seen"]),
                    connections_count=status_data.get("connections_count", 0)
                )
            
            return None
            
        except Exception as e:
            print(f"获取用户状态失败: {e}")
            return None
    
    async def get_users_status(self, user_ids: List[int]) -> List[OnlineStatus]:
        """
        批量获取用户在线状态
        
        Args:
            user_ids: 用户 ID 列表
        
        Returns:
            List[OnlineStatus]: 在线状态列表
        """
        statuses = []
        
        for user_id in user_ids:
            status = await self.get_user_status(user_id)
            if status:
                statuses.append(status)
        
        return statuses
    
    async def get_online_users(self, limit: int = 100) -> List[int]:
        """
        获取在线用户列表
        
        Args:
            limit: 返回数量限制
        
        Returns:
            List[int]: 在线用户 ID 列表
        """
        try:
            # 从集合中获取在线用户
            user_ids = await redis_client.smembers(self.online_users_set)
            
            # 转换为整数并限制数量
            online_ids = [int(uid) for uid in user_ids][:limit]
            
            return online_ids
            
        except Exception as e:
            print(f"获取在线用户失败: {e}")
            return []
    
    async def get_online_count(self) -> int:
        """
        获取在线用户数量
        
        Returns:
            int: 在线用户数量
        """
        try:
            count = await redis_client.scard(self.online_users_set)
            return count
        except Exception as e:
            print(f"获取在线用户数量失败: {e}")
            return 0
    
    async def update_last_seen(self, user_id: int):
        """
        更新用户最后在线时间
        
        Args:
            user_id: 用户 ID
        """
        try:
            key = f"{self.online_prefix}{user_id}"
            data = await redis_client.get(key)
            
            if data:
                status_data = json.loads(data)
                status_data["last_seen"] = datetime.utcnow().isoformat()
                
                await redis_client.set(
                    key,
                    json.dumps(status_data),
                    expire=1800  # 30 分钟
                )
                
        except Exception as e:
            print(f"更新最后在线时间失败: {e}")
    
    async def set_user_presence(
        self,
        user_id: int,
        status: str,
        data: Optional[Dict] = None
    ):
        """
        设置用户在线状态（详细）
        
        Args:
            user_id: 用户 ID
            status: 状态 (online/away/busy/offline)
            data: 额外数据
        """
        try:
            key = f"{self.presence_prefix}{user_id}"
            
            presence_data = {
                "user_id": user_id,
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data or {}
            }
            
            await redis_client.set(
                key,
                json.dumps(presence_data),
                expire=1800  # 30 分钟
            )
            
        except Exception as e:
            print(f"设置用户在线状态失败: {e}")
    
    async def get_user_presence(self, user_id: int) -> Optional[Dict]:
        """
        获取用户在线状态（详细）
        
        Args:
            user_id: 用户 ID
        
        Returns:
            Optional[Dict]: 在线状态数据
        """
        try:
            key = f"{self.presence_prefix}{user_id}"
            data = await redis_client.get(key)
            
            if data:
                return json.loads(data)
            
            return None
            
        except Exception as e:
            print(f"获取用户在线状态失败: {e}")
            return None
    
    async def cleanup_stale_users(self, max_age_minutes: int = 30):
        """
        清理过期的在线用户
        
        Args:
            max_age_minutes: 最大闲置时间（分钟）
        """
        try:
            online_users = await self.get_online_users(limit=1000)
            cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)
            
            for user_id in online_users:
                status = await self.get_user_status(user_id)
                if status and status.last_seen < cutoff_time:
                    await self.set_user_offline(user_id)
                    
        except Exception as e:
            print(f"清理过期用户失败: {e}")


# 全局在线状态服务实例
presence_service = PresenceService()


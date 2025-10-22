"""
WebSocket 相关的数据模式
"""
from typing import Optional, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field


class WebSocketMessage(BaseModel):
    """WebSocket 消息基础模型"""
    type: str = Field(..., description="消息类型")
    data: Dict[str, Any] = Field(default_factory=dict, description="消息数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")


class UserStatusMessage(BaseModel):
    """用户状态消息"""
    type: Literal["user_status"] = "user_status"
    data: Dict[str, Any] = Field(..., description="状态数据")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "user_status",
                "data": {
                    "user_id": 1,
                    "status": "online",
                    "timestamp": "2025-10-22T10:00:00Z"
                }
            }
        }


class NotificationMessage(BaseModel):
    """通知消息"""
    type: Literal["notification"] = "notification"
    notification_type: str = Field(..., description="通知类型")
    data: Dict[str, Any] = Field(..., description="通知数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "notification",
                "notification_type": "new_follower",
                "data": {
                    "notification_id": 1,
                    "title": "新粉丝",
                    "message": "用户 John 关注了你",
                    "user_id": 2
                },
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class ChatMessage(BaseModel):
    """聊天消息"""
    type: Literal["chat"] = "chat"
    data: Dict[str, Any] = Field(..., description="聊天数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "chat",
                "data": {
                    "from_user_id": 1,
                    "to_user_id": 2,
                    "message": "Hello!",
                    "message_id": 123
                },
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class PostUpdateMessage(BaseModel):
    """帖子更新消息"""
    type: Literal["post_update"] = "post_update"
    action: Literal["create", "update", "delete", "like", "comment"] = Field(..., description="操作类型")
    data: Dict[str, Any] = Field(..., description="帖子数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "post_update",
                "action": "like",
                "data": {
                    "post_id": 123,
                    "user_id": 1,
                    "likes_count": 42
                },
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class OnlineStatus(BaseModel):
    """在线状态"""
    user_id: int = Field(..., description="用户 ID")
    online: bool = Field(..., description="是否在线")
    last_seen: datetime = Field(..., description="最后在线时间")
    connections_count: int = Field(default=0, description="连接数量")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "online": True,
                "last_seen": "2025-10-22T10:00:00Z",
                "connections_count": 2
            }
        }


class OnlineUsersResponse(BaseModel):
    """在线用户列表响应"""
    online_count: int = Field(..., description="在线用户总数")
    users: list[OnlineStatus] = Field(..., description="在线用户列表")
    
    class Config:
        json_schema_extra = {
            "example": {
                "online_count": 10,
                "users": [
                    {
                        "user_id": 1,
                        "online": True,
                        "last_seen": "2025-10-22T10:00:00Z",
                        "connections_count": 2
                    }
                ]
            }
        }


class TypingIndicator(BaseModel):
    """正在输入指示器"""
    type: Literal["typing"] = "typing"
    data: Dict[str, Any] = Field(..., description="输入状态数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "typing",
                "data": {
                    "user_id": 1,
                    "is_typing": True,
                    "context": "post_123"
                },
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class PresenceUpdate(BaseModel):
    """在线状态更新"""
    type: Literal["presence"] = "presence"
    status: Literal["online", "offline", "away", "busy"] = Field(..., description="状态")
    data: Optional[Dict[str, Any]] = Field(default=None, description="额外数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "presence",
                "status": "online",
                "data": {
                    "device": "mobile"
                },
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class PingPong(BaseModel):
    """心跳消息"""
    type: Literal["ping", "pong"] = Field(..., description="消息类型")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "ping",
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


class ErrorMessage(BaseModel):
    """错误消息"""
    type: Literal["error"] = "error"
    error_code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "error",
                "error_code": "INVALID_MESSAGE",
                "message": "Invalid message format",
                "timestamp": "2025-10-22T10:00:00Z"
            }
        }


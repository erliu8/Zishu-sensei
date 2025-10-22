"""
通知 Schema
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    """通知基础模型"""
    type: str = Field(..., description="类型")
    title: Optional[str] = Field(None, description="标题")
    content: Optional[str] = Field(None, description="内容")
    link: Optional[str] = Field(None, description="链接")


class NotificationCreate(NotificationBase):
    """创建通知"""
    user_id: int = Field(..., description="用户 ID")


class NotificationInDB(NotificationBase):
    """数据库中的通知"""
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationPublic(NotificationInDB):
    """公开的通知信息"""
    pass


class NotificationStats(BaseModel):
    """通知统计"""
    total_notifications: int
    unread_notifications: int


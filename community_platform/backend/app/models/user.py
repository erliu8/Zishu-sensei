"""
用户数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class User(Base):
    """用户模型"""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    avatar_url = Column(String(255))
    bio = Column(Text)
    is_active = Column(Boolean, default=True, server_default="true")
    is_verified = Column(Boolean, default=False, server_default="false")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __init__(self, **kwargs):
        """初始化时设置默认值"""
        # 设置默认值（如果未提供）
        kwargs.setdefault('is_active', True)
        kwargs.setdefault('is_verified', False)
        super().__init__(**kwargs)
    
    # 关系
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="creator", cascade="all, delete-orphan")
    adapters = relationship("Adapter", foreign_keys="Adapter.author_id", back_populates="author", cascade="all, delete-orphan")
    
    # 关注关系
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following",
        cascade="all, delete-orphan"
    )
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan"
    )
    
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


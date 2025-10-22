"""
帖子数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship, synonym

from app.db.session import Base


class Post(Base):
    """帖子模型"""
    
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50))
    tags = Column(ARRAY(String))
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    is_published = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # author_id 作为 user_id 的别名（用于测试和语义清晰）
    author_id = synonym("user_id")
    
    def __init__(self, **kwargs):
        """初始化时设置默认值"""
        # 设置默认值（如果未提供）
        kwargs.setdefault('view_count', 0)
        kwargs.setdefault('like_count', 0)
        kwargs.setdefault('comment_count', 0)
        kwargs.setdefault('is_published', True)
        super().__init__(**kwargs)
    
    # 关系
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship(
        "Like",
        primaryjoin="and_(Post.id==foreign(Like.target_id), Like.target_type=='post')",
        cascade="all, delete-orphan",
        viewonly=True
    )
    
    def __repr__(self):
        return f"<Post(id={self.id}, title='{self.title}', author_id={self.user_id})>"


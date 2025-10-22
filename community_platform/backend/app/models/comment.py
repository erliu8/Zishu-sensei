"""
评论数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship, synonym

from app.db.session import Base


class Comment(Base):
    """评论模型"""
    
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # author_id 作为 user_id 的别名（用于测试和语义清晰）
    author_id = synonym("user_id")
    
    def __init__(self, **kwargs):
        """初始化时设置默认值"""
        # 设置默认值（如果未提供）
        kwargs.setdefault('like_count', 0)
        super().__init__(**kwargs)
    
    # 关系
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")
    
    # 自引用关系（父评论和子评论）
    parent = relationship("Comment", remote_side=[id], backref="replies")
    
    likes = relationship(
        "Like",
        primaryjoin="and_(Comment.id==foreign(Like.target_id), Like.target_type=='comment')",
        cascade="all, delete-orphan",
        viewonly=True
    )
    
    def __repr__(self):
        return f"<Comment(id={self.id}, post_id={self.post_id}, author_id={self.user_id})>"


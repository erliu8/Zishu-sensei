"""
关注数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class Follow(Base):
    """关注模型"""
    
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id', name='uix_follower_following'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")
    
    def __repr__(self):
        return f"<Follow(id={self.id}, follower_id={self.follower_id}, following_id={self.following_id})>"


"""
点赞数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class Like(Base):
    """点赞模型"""
    
    __tablename__ = "likes"
    __table_args__ = (
        UniqueConstraint('user_id', 'target_type', 'target_id', name='uix_user_target'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(20), nullable=False)  # 'post' or 'comment'
    target_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    user = relationship("User", back_populates="likes")
    
    def __repr__(self):
        return f"<Like(id={self.id}, user_id={self.user_id}, target_type='{self.target_type}', target_id={self.target_id})>"


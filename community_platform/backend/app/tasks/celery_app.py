"""
Celery 应用配置
"""
import os
from celery import Celery
from app.core.config import settings

# 创建Celery实例
celery_app = Celery(
    "zishu_tasks",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
)

# Celery配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1小时超时
    task_soft_time_limit=3000,  # 50分钟软超时
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# 自动发现任务
celery_app.autodiscover_tasks(['app.tasks'])


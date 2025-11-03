"""
Celery 应用配置
"""
import os
from celery import Celery
from app.core.config import settings

# 创建Celery实例
redis_password = os.getenv("REDIS_PASSWORD", "redis123")
redis_host = os.getenv("REDIS_HOST", "redis")
redis_port = os.getenv("REDIS_PORT", "6379")

celery_app = Celery(
    "zishu_tasks",
    broker=os.getenv("CELERY_BROKER_URL", f"redis://:{redis_password}@{redis_host}:{redis_port}/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", f"redis://:{redis_password}@{redis_host}:{redis_port}/1"),
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


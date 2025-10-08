#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
打包任务 - Zishu-sensei
提供异步任务处理，包括构建、测试、发布等后台任务
使用Celery进行任务队列管理和分布式处理
"""

from celery import Celery, Task
from celery.exceptions import Retry, WorkerLostError
from celery.signals import task_prerun, task_postrun, task_failure, task_success
from kombu import Queue
import asyncio
import json
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from pathlib import Path

from ..core.config import settings
from ..core.database import get_db_session
from ..core.logging import get_logger
from ..schemas.packaging import (
    BuildStatus,
    TestType,
    PackageStatus,
    DistributionChannel,
    BuildTaskResponse,
    TestResultResponse,
    PublishResultResponse,
)
from ..services.packaging_service import packaging_service
from ..services.build_service import build_service
from ..services.notification_service import NotificationService
from ..utils.redis_utils import get_redis_client
from ..utils.monitoring import TaskMonitor

logger = get_logger(__name__)

# 创建Celery应用
celery_app = Celery(
    "zishu_packaging",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["zishu.api.tasks.packaging_tasks"],
)

# Celery配置
celery_app.conf.update(
    # 任务序列化
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    # 任务路由
    task_routes={
        "zishu.api.tasks.packaging_tasks.build_package_task": {"queue": "build"},
        "zishu.api.tasks.packaging_tasks.test_package_task": {"queue": "test"},
        "zishu.api.tasks.packaging_tasks.publish_package_task": {"queue": "publish"},
        "zishu.api.tasks.packaging_tasks.cleanup_task": {"queue": "cleanup"},
    },
    # 队列配置
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="default"),
        Queue("build", routing_key="build"),
        Queue("test", routing_key="test"),
        Queue("publish", routing_key="publish"),
        Queue("cleanup", routing_key="cleanup"),
        Queue("priority", routing_key="priority"),
    ),
    # 任务限制
    task_time_limit=7200,  # 2小时硬限制
    task_soft_time_limit=3600,  # 1小时软限制
    worker_prefetch_multiplier=1,
    task_max_retries=3,
    task_default_retry_delay=60,
    # 结果存储
    result_expires=86400,  # 24小时
    result_persistent=True,
    # 监控
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# 任务监控器
task_monitor = TaskMonitor()
notification_service = NotificationService()


class PackagingTask(Task):
    """打包任务基类"""

    def __init__(self):
        self.redis_client = get_redis_client()
        self.start_time = None
        self.task_info = {}

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败处理"""
        logger.error(f"任务 {task_id} 失败: {exc}")
        logger.error(f"错误信息: {einfo}")

        # 更新任务状态
        self._update_task_status(task_id, "FAILURE", error=str(exc))

        # 发送失败通知
        if "user_id" in kwargs:
            asyncio.create_task(
                notification_service.send_task_failure_notification(
                    user_id=kwargs["user_id"],
                    task_id=task_id,
                    task_name=self.name,
                    error=str(exc),
                )
            )

    def on_success(self, retval, task_id, args, kwargs):
        """任务成功处理"""
        logger.info(f"任务 {task_id} 成功完成")

        # 更新任务状态
        self._update_task_status(task_id, "SUCCESS", result=retval)

        # 发送成功通知
        if "user_id" in kwargs:
            asyncio.create_task(
                notification_service.send_task_success_notification(
                    user_id=kwargs["user_id"],
                    task_id=task_id,
                    task_name=self.name,
                    result=retval,
                )
            )

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """任务重试处理"""
        logger.warning(f"任务 {task_id} 重试: {exc}")

        # 更新任务状态
        self._update_task_status(task_id, "RETRY", error=str(exc))

    def _update_task_status(self, task_id: str, status: str, **kwargs):
        """更新任务状态"""
        try:
            task_data = {
                "task_id": task_id,
                "status": status,
                "updated_at": datetime.now().isoformat(),
                **kwargs,
            }

            # 存储到Redis
            self.redis_client.hset(
                f"task:{task_id}",
                mapping={
                    k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                    for k, v in task_data.items()
                },
            )
            self.redis_client.expire(f"task:{task_id}", 86400)  # 24小时过期

        except Exception as e:
            logger.error(f"更新任务状态失败: {e}")


# ======================== 构建任务 ========================


@celery_app.task(bind=True, base=PackagingTask, name="build_package_task")
def build_package_task(self, build_task_id: str, user_id: str, **kwargs):
    """构建包任务"""
    try:
        logger.info(f"开始构建任务 {build_task_id}")
        self.start_time = datetime.now()

        # 更新任务状态为运行中
        self._update_task_status(
            self.request.id,
            "RUNNING",
            build_task_id=build_task_id,
            started_at=self.start_time.isoformat(),
        )

        # 执行构建
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(
                _execute_build_task(build_task_id, user_id)
            )

            logger.info(f"构建任务 {build_task_id} 完成")
            return {
                "build_task_id": build_task_id,
                "status": result.status,
                "duration_seconds": result.duration_seconds,
                "artifacts_count": len(result.artifacts),
                "completed_at": datetime.now().isoformat(),
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"构建任务执行失败: {e}")
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery_app.task(bind=True, base=PackagingTask, name="test_package_task")
def test_package_task(self, package_id: str, test_config: Dict, user_id: str, **kwargs):
    """测试包任务"""
    try:
        logger.info(f"开始测试包 {package_id}")
        self.start_time = datetime.now()

        # 更新任务状态
        self._update_task_status(
            self.request.id,
            "RUNNING",
            package_id=package_id,
            started_at=self.start_time.isoformat(),
        )

        # 执行测试
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(
                _execute_test_task(package_id, test_config, user_id)
            )

            logger.info(f"测试任务完成: {package_id}")
            return {
                "package_id": package_id,
                "test_status": result.status,
                "passed": result.passed,
                "failed": result.failed,
                "coverage": result.coverage,
                "duration_seconds": result.duration_seconds,
                "completed_at": datetime.now().isoformat(),
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"测试任务执行失败: {e}")
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=60, max_retries=2)


@celery_app.task(bind=True, base=PackagingTask, name="publish_package_task")
def publish_package_task(
    self,
    package_id: str,
    version: str,
    channels: List[str],
    publish_config: Dict,
    user_id: str,
    **kwargs,
):
    """发布包任务"""
    try:
        logger.info(f"开始发布包 {package_id} 版本 {version}")
        self.start_time = datetime.now()

        # 更新任务状态
        self._update_task_status(
            self.request.id,
            "RUNNING",
            package_id=package_id,
            version=version,
            channels=channels,
            started_at=self.start_time.isoformat(),
        )

        # 执行发布
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(
                _execute_publish_task(
                    package_id, version, channels, publish_config, user_id
                )
            )

            logger.info(f"发布任务完成: {package_id}")
            return {
                "package_id": package_id,
                "version": version,
                "publish_status": result.status,
                "channels": channels,
                "download_urls": result.download_urls,
                "completed_at": datetime.now().isoformat(),
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"发布任务执行失败: {e}")
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=120, max_retries=2)


# ======================== 批量任务 ========================


@celery_app.task(bind=True, base=PackagingTask, name="batch_build_task")
def batch_build_task(self, build_requests: List[Dict], user_id: str, **kwargs):
    """批量构建任务"""
    try:
        logger.info(f"开始批量构建 {len(build_requests)} 个包")
        self.start_time = datetime.now()

        results = []
        failed_count = 0

        for i, build_request in enumerate(build_requests):
            try:
                # 更新进度
                progress = (i / len(build_requests)) * 100
                self._update_task_status(
                    self.request.id,
                    "RUNNING",
                    progress=progress,
                    current_package=build_request.get("package_id"),
                )

                # 提交单个构建任务
                task_result = build_package_task.delay(
                    build_request["build_task_id"], user_id
                )

                results.append(
                    {
                        "build_task_id": build_request["build_task_id"],
                        "celery_task_id": task_result.id,
                        "status": "submitted",
                    }
                )

            except Exception as e:
                logger.error(f"批量构建中的单个任务失败: {e}")
                failed_count += 1
                results.append(
                    {
                        "build_task_id": build_request.get("build_task_id"),
                        "status": "failed",
                        "error": str(e),
                    }
                )

        return {
            "total_count": len(build_requests),
            "submitted_count": len(build_requests) - failed_count,
            "failed_count": failed_count,
            "results": results,
            "completed_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"批量构建任务失败: {e}")
        raise


@celery_app.task(bind=True, base=PackagingTask, name="package_pipeline_task")
def package_pipeline_task(
    self, package_id: str, pipeline_config: Dict, user_id: str, **kwargs
):
    """包处理流水线任务（构建->测试->发布）"""
    try:
        logger.info(f"开始包流水线处理 {package_id}")
        self.start_time = datetime.now()

        pipeline_results = {
            "package_id": package_id,
            "stages": {},
            "overall_status": "running",
            "started_at": self.start_time.isoformat(),
        }

        # 阶段1: 构建
        if pipeline_config.get("build_enabled", True):
            logger.info(f"流水线阶段1: 构建包 {package_id}")
            self._update_task_status(
                self.request.id, "RUNNING", stage="build", package_id=package_id
            )

            build_result = build_package_task.apply_async(
                args=[pipeline_config["build_task_id"], user_id], queue="build"
            ).get(timeout=3600)

            pipeline_results["stages"]["build"] = build_result

            if build_result.get("status") != "SUCCESS":
                pipeline_results["overall_status"] = "failed"
                pipeline_results["failed_stage"] = "build"
                return pipeline_results

        # 阶段2: 测试
        if pipeline_config.get("test_enabled", True):
            logger.info(f"流水线阶段2: 测试包 {package_id}")
            self._update_task_status(
                self.request.id, "RUNNING", stage="test", package_id=package_id
            )

            test_result = test_package_task.apply_async(
                args=[package_id, pipeline_config.get("test_config", {}), user_id],
                queue="test",
            ).get(timeout=1800)

            pipeline_results["stages"]["test"] = test_result

            if test_result.get("test_status") != "passed":
                pipeline_results["overall_status"] = "failed"
                pipeline_results["failed_stage"] = "test"
                return pipeline_results

        # 阶段3: 发布
        if pipeline_config.get("publish_enabled", False):
            logger.info(f"流水线阶段3: 发布包 {package_id}")
            self._update_task_status(
                self.request.id, "RUNNING", stage="publish", package_id=package_id
            )

            publish_result = publish_package_task.apply_async(
                args=[
                    package_id,
                    pipeline_config["version"],
                    pipeline_config.get("channels", []),
                    pipeline_config.get("publish_config", {}),
                    user_id,
                ],
                queue="publish",
            ).get(timeout=1800)

            pipeline_results["stages"]["publish"] = publish_result

            if publish_result.get("publish_status") != "success":
                pipeline_results["overall_status"] = "failed"
                pipeline_results["failed_stage"] = "publish"
                return pipeline_results

        # 所有阶段成功
        pipeline_results["overall_status"] = "success"
        pipeline_results["completed_at"] = datetime.now().isoformat()

        logger.info(f"包流水线处理完成: {package_id}")
        return pipeline_results

    except Exception as e:
        logger.error(f"包流水线任务失败: {e}")
        logger.error(traceback.format_exc())
        raise


# ======================== 清理任务 ========================


@celery_app.task(bind=True, base=PackagingTask, name="cleanup_task")
def cleanup_task(self, cleanup_config: Dict, **kwargs):
    """清理任务"""
    try:
        logger.info("开始清理任务")

        cleanup_results = {
            "cleaned_files": 0,
            "freed_space_bytes": 0,
            "cleaned_tasks": 0,
            "errors": [],
        }

        # 清理过期的构建文件
        if cleanup_config.get("clean_build_files", True):
            try:
                result = _cleanup_build_files(
                    cleanup_config.get("build_retention_days", 7)
                )
                cleanup_results["cleaned_files"] += result["files_count"]
                cleanup_results["freed_space_bytes"] += result["freed_bytes"]
            except Exception as e:
                cleanup_results["errors"].append(f"清理构建文件失败: {e}")

        # 清理过期的任务记录
        if cleanup_config.get("clean_task_records", True):
            try:
                result = _cleanup_task_records(
                    cleanup_config.get("task_retention_days", 30)
                )
                cleanup_results["cleaned_tasks"] += result["tasks_count"]
            except Exception as e:
                cleanup_results["errors"].append(f"清理任务记录失败: {e}")

        # 清理缓存
        if cleanup_config.get("clean_cache", True):
            try:
                result = _cleanup_cache(cleanup_config.get("cache_retention_hours", 24))
                cleanup_results["freed_space_bytes"] += result["freed_bytes"]
            except Exception as e:
                cleanup_results["errors"].append(f"清理缓存失败: {e}")

        logger.info(f"清理任务完成: {cleanup_results}")
        return cleanup_results

    except Exception as e:
        logger.error(f"清理任务失败: {e}")
        raise


# ======================== 监控任务 ========================


@celery_app.task(bind=True, name="health_check_task")
def health_check_task(self, **kwargs):
    """健康检查任务"""
    try:
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "services": {},
            "overall_status": "healthy",
        }

        # 检查数据库连接
        try:
            # 这里应该检查数据库连接
            health_status["services"]["database"] = "healthy"
        except Exception as e:
            health_status["services"]["database"] = f"unhealthy: {e}"
            health_status["overall_status"] = "unhealthy"

        # 检查Redis连接
        try:
            redis_client = get_redis_client()
            redis_client.ping()
            health_status["services"]["redis"] = "healthy"
        except Exception as e:
            health_status["services"]["redis"] = f"unhealthy: {e}"
            health_status["overall_status"] = "unhealthy"

        # 检查文件系统
        try:
            workspace_dir = Path(settings.BUILD_WORKSPACE_DIR)
            if workspace_dir.exists() and workspace_dir.is_dir():
                health_status["services"]["filesystem"] = "healthy"
            else:
                health_status["services"][
                    "filesystem"
                ] = "unhealthy: workspace not accessible"
                health_status["overall_status"] = "unhealthy"
        except Exception as e:
            health_status["services"]["filesystem"] = f"unhealthy: {e}"
            health_status["overall_status"] = "unhealthy"

        return health_status

    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unhealthy",
            "error": str(e),
        }


# ======================== 任务执行函数 ========================


async def _execute_build_task(build_task_id: str, user_id: str):
    """执行构建任务"""
    async with get_db_session() as db:
        # 获取构建任务
        from ..models.packaging import BuildTaskModel
        from sqlalchemy import select

        query = select(BuildTaskModel).where(BuildTaskModel.id == build_task_id)
        result = await db.execute(query)
        build_task = result.scalar_one_or_none()

        if not build_task:
            raise ValueError(f"构建任务不存在: {build_task_id}")

        # 执行构建
        return await build_service.build_package(build_task, timeout=3600)


async def _execute_test_task(package_id: str, test_config: Dict, user_id: str):
    """执行测试任务"""
    async with get_db_session() as db:
        # 获取包信息
        package = await packaging_service._get_package_by_id(package_id, db)

        # 执行测试
        return await build_service.run_tests(
            package=package,
            test_types=test_config.get("test_types", [TestType.UNIT]),
            test_environments=test_config.get("test_environments", []),
            parallel=test_config.get("parallel", False),
            coverage_required=test_config.get("coverage_required", True),
        )


async def _execute_publish_task(
    package_id: str,
    version: str,
    channels: List[str],
    publish_config: Dict,
    user_id: str,
):
    """执行发布任务"""
    async with get_db_session() as db:
        from ..schemas.packaging import PublishRequest

        # 创建发布请求
        publish_request = PublishRequest(
            package_id=package_id,
            version=version,
            channels=[DistributionChannel(channel) for channel in channels],
            release_notes=publish_config.get("release_notes"),
            is_prerelease=publish_config.get("is_prerelease", False),
            auto_sign=publish_config.get("auto_sign", True),
        )

        # 执行发布
        return await packaging_service.publish_package(publish_request, user_id, db)


def _cleanup_build_files(retention_days: int) -> Dict[str, int]:
    """清理构建文件"""
    cutoff_date = datetime.now() - timedelta(days=retention_days)
    cleaned_files = 0
    freed_bytes = 0

    build_dir = Path(settings.BUILD_WORKSPACE_DIR)
    if build_dir.exists():
        for item in build_dir.iterdir():
            if item.is_dir():
                # 检查目录修改时间
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < cutoff_date:
                    try:
                        # 计算目录大小
                        dir_size = sum(
                            f.stat().st_size for f in item.rglob("*") if f.is_file()
                        )

                        # 删除目录
                        import shutil

                        shutil.rmtree(item)

                        cleaned_files += 1
                        freed_bytes += dir_size

                    except Exception as e:
                        logger.warning(f"清理目录失败 {item}: {e}")

    return {"files_count": cleaned_files, "freed_bytes": freed_bytes}


def _cleanup_task_records(retention_days: int) -> Dict[str, int]:
    """清理任务记录"""
    cutoff_date = datetime.now() - timedelta(days=retention_days)
    cleaned_tasks = 0

    try:
        redis_client = get_redis_client()

        # 获取所有任务键
        task_keys = redis_client.keys("task:*")

        for key in task_keys:
            try:
                # 获取任务更新时间
                updated_at_str = redis_client.hget(key, "updated_at")
                if updated_at_str:
                    updated_at = datetime.fromisoformat(updated_at_str.decode())
                    if updated_at < cutoff_date:
                        redis_client.delete(key)
                        cleaned_tasks += 1

            except Exception as e:
                logger.warning(f"清理任务记录失败 {key}: {e}")

    except Exception as e:
        logger.error(f"清理任务记录失败: {e}")

    return {"tasks_count": cleaned_tasks}


def _cleanup_cache(retention_hours: int) -> Dict[str, int]:
    """清理缓存"""
    cutoff_date = datetime.now() - timedelta(hours=retention_hours)
    freed_bytes = 0

    cache_dir = Path(settings.BUILD_CACHE_DIR)
    if cache_dir.exists():
        for item in cache_dir.rglob("*"):
            if item.is_file():
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < cutoff_date:
                    try:
                        file_size = item.stat().st_size
                        item.unlink()
                        freed_bytes += file_size
                    except Exception as e:
                        logger.warning(f"清理缓存文件失败 {item}: {e}")

    return {"freed_bytes": freed_bytes}


# ======================== 信号处理 ========================


@task_prerun.connect
def task_prerun_handler(
    sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds
):
    """任务开始前处理"""
    logger.info(f"任务开始: {task_id} ({sender})")
    task_monitor.record_task_start(task_id, sender, args, kwargs)


@task_postrun.connect
def task_postrun_handler(
    sender=None,
    task_id=None,
    task=None,
    args=None,
    kwargs=None,
    retval=None,
    state=None,
    **kwds,
):
    """任务结束后处理"""
    logger.info(f"任务结束: {task_id} ({sender}) - 状态: {state}")
    task_monitor.record_task_end(task_id, state, retval)


@task_failure.connect
def task_failure_handler(
    sender=None, task_id=None, exception=None, traceback=None, einfo=None, **kwds
):
    """任务失败处理"""
    logger.error(f"任务失败: {task_id} ({sender}) - 异常: {exception}")
    task_monitor.record_task_failure(task_id, exception, traceback)


@task_success.connect
def task_success_handler(sender=None, task_id=None, result=None, **kwds):
    """任务成功处理"""
    logger.info(f"任务成功: {task_id} ({sender})")
    task_monitor.record_task_success(task_id, result)


# ======================== 定时任务 ========================

# 每小时执行健康检查
celery_app.conf.beat_schedule = {
    "health-check": {
        "task": "health_check_task",
        "schedule": 3600.0,  # 每小时
        "options": {"queue": "default"},
    },
    "daily-cleanup": {
        "task": "cleanup_task",
        "schedule": 86400.0,  # 每天
        "args": [
            {"clean_build_files": True, "clean_task_records": True, "clean_cache": True}
        ],
        "options": {"queue": "cleanup"},
    },
}

# 导出
__all__ = [
    "celery_app",
    "build_package_task",
    "test_package_task",
    "publish_package_task",
    "batch_build_task",
    "package_pipeline_task",
    "cleanup_task",
    "health_check_task",
]

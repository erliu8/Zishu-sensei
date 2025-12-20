"""
工作流调度器
提供定时执行和事件触发功能
"""

import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
except ModuleNotFoundError:  # pragma: no cover
    AsyncIOScheduler = None  # type: ignore[assignment]
    CronTrigger = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class WorkflowScheduler:
    """
    工作流调度器
    
    功能：
    1. 定时执行工作流（Cron 表达式）
    2. 延迟执行
    3. 周期性执行
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler() if AsyncIOScheduler is not None else None
        self.scheduled_jobs = {}  # workflow_id -> job_id 映射

    async def start(self):
        """启动调度器"""
        if self.scheduler is None:
            raise RuntimeError("apscheduler is not installed; scheduling is unavailable")
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("工作流调度器已启动")

    async def stop(self):
        """停止调度器"""
        if self.scheduler is None:
            return
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("工作流调度器已停止")

    def is_running(self) -> bool:
        """检查调度器是否运行中"""
        return bool(self.scheduler and self.scheduler.running)

    async def schedule_workflow(
        self,
        workflow_id: str,
        cron_expression: str,
        callback: callable,
    ) -> str:
        """
        调度工作流
        
        Args:
            workflow_id: 工作流ID
            cron_expression: Cron 表达式
            callback: 执行回调函数
            
        Returns:
            任务ID
        """
        if self.scheduler is None or CronTrigger is None:
            raise RuntimeError("apscheduler is not installed; scheduling is unavailable")
        try:
            # 解析 Cron 表达式
            trigger = CronTrigger.from_crontab(cron_expression)

            # 添加任务
            job = self.scheduler.add_job(
                callback,
                trigger=trigger,
                id=f"workflow_{workflow_id}",
                name=f"Workflow {workflow_id}",
                replace_existing=True,
            )

            self.scheduled_jobs[workflow_id] = job.id

            logger.info(f"工作流 {workflow_id} 已调度: {cron_expression}")
            return job.id

        except Exception as e:
            logger.error(f"调度工作流失败: {str(e)}")
            raise

    async def unschedule_workflow(self, workflow_id: str) -> bool:
        """
        取消工作流调度
        
        Args:
            workflow_id: 工作流ID
            
        Returns:
            是否成功取消
        """
        if self.scheduler is None:
            return False

        job_id = self.scheduled_jobs.get(workflow_id)
        if not job_id:
            logger.warning(f"工作流 {workflow_id} 未被调度")
            return False

        try:
            self.scheduler.remove_job(job_id)
            del self.scheduled_jobs[workflow_id]
            logger.info(f"工作流 {workflow_id} 调度已取消")
            return True

        except Exception as e:
            logger.error(f"取消调度失败: {str(e)}")
            return False

    def list_scheduled_workflows(self) -> List[Dict[str, Any]]:
        """
        列出所有已调度的工作流
        
        Returns:
            调度信息列表
        """
        scheduled = []
        if self.scheduler is None:
            return scheduled
        for workflow_id, job_id in self.scheduled_jobs.items():
            job = self.scheduler.get_job(job_id)
            if job:
                scheduled.append({
                    "workflow_id": workflow_id,
                    "job_id": job_id,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger),
                })
        return scheduled

    async def schedule_delayed_execution(
        self,
        workflow_id: str,
        delay_seconds: int,
        callback: callable,
    ) -> str:
        """
        延迟执行工作流
        
        Args:
            workflow_id: 工作流ID
            delay_seconds: 延迟秒数
            callback: 执行回调函数
            
        Returns:
            任务ID
        """
        if self.scheduler is None:
            raise RuntimeError("apscheduler is not installed; scheduling is unavailable")
        job = self.scheduler.add_job(
            callback,
            'date',
            run_date=datetime.now(timezone.utc).timestamp() + delay_seconds,
            id=f"workflow_{workflow_id}_delayed",
            name=f"Delayed Workflow {workflow_id}",
        )

        logger.info(f"工作流 {workflow_id} 将在 {delay_seconds} 秒后执行")
        return job.id


# 全局调度器实例
workflow_scheduler = WorkflowScheduler()

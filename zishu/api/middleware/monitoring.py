"""
监控中间件
提供全面的系统监控、性能指标收集、健康检查、告警等功能
支持多种监控策略、实时指标、历史数据分析、自动告警等高级功能
"""

import asyncio
import json
import logging
import psutil
import time
import threading
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from concurrent.futures import ThreadPoolExecutor
import socket
import platform

from fastapi import Request, Response, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
import aiofiles

from zishu.api.dependencies import get_dependencies
from zishu.utils.performance import PerformanceMonitor

# 设置日志
logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    """指标类型枚举"""

    COUNTER = "counter"  # 计数器
    GAUGE = "gauge"  # 仪表盘
    HISTOGRAM = "histogram"  # 直方图
    SUMMARY = "summary"  # 摘要
    RATE = "rate"  # 速率


class AlertLevel(str, Enum):
    """告警级别枚举"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class HealthStatus(str, Enum):
    """健康状态枚举"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class MetricPoint:
    """指标数据点"""

    timestamp: datetime
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Alert:
    """告警数据"""

    id: str
    level: AlertLevel
    title: str
    message: str
    timestamp: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthCheck:
    """健康检查结果"""

    name: str
    status: HealthStatus
    message: str
    timestamp: datetime
    response_time: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class MonitoringConfig(BaseModel):
    """监控配置模型"""

    # 基本配置
    enabled: bool = True
    collection_interval: int = 30  # 30秒
    retention_hours: int = 24  # 24小时
    max_data_points: int = 10000  # 最大数据点数

    # 系统监控配置
    system_metrics_enabled: bool = True
    process_metrics_enabled: bool = True
    network_metrics_enabled: bool = True

    # HTTP监控配置
    http_metrics_enabled: bool = True
    slow_request_threshold: float = 1.0  # 秒
    track_request_size: bool = True
    track_response_size: bool = True

    # 告警配置
    alerting_enabled: bool = True
    alert_thresholds: Dict[str, float] = Field(
        default_factory=lambda: {
            "cpu_usage_warning": 70.0,
            "cpu_usage_critical": 90.0,
            "memory_usage_warning": 80.0,
            "memory_usage_critical": 95.0,
            "disk_usage_warning": 85.0,
            "disk_usage_critical": 95.0,
            "response_time_warning": 2.0,
            "response_time_critical": 5.0,
            "error_rate_warning": 5.0,
            "error_rate_critical": 10.0,
        }
    )

    # 健康检查配置
    health_check_enabled: bool = True
    health_check_interval: int = 60  # 60秒
    health_check_timeout: float = 5.0

    # 导出配置
    export_enabled: bool = False
    export_format: str = "prometheus"  # prometheus, json, csv
    export_path: str = "monitoring_data"

    # 通知配置
    webhook_url: Optional[str] = None
    email_notifications: bool = False
    slack_webhook: Optional[str] = None


class MetricsCollector:
    """指标收集器"""

    def __init__(self, config: MonitoringConfig):
        self.config = config
        self._metrics: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=config.max_data_points)
        )
        self._lock = threading.RLock()

    def record_metric(
        self,
        name: str,
        value: float,
        metric_type: MetricType = MetricType.GAUGE,
        labels: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """记录指标"""
        with self._lock:
            point = MetricPoint(
                timestamp=datetime.now(),
                value=value,
                labels=labels or {},
                metadata=metadata or {},
            )
            self._metrics[name].append(point)

    def get_metric_history(self, name: str, hours: int = 1) -> List[MetricPoint]:
        """获取指标历史数据"""
        with self._lock:
            if name not in self._metrics:
                return []

            cutoff_time = datetime.now() - timedelta(hours=hours)
            return [
                point for point in self._metrics[name] if point.timestamp > cutoff_time
            ]

    def get_latest_metric(self, name: str) -> Optional[MetricPoint]:
        """获取最新指标值"""
        with self._lock:
            if name not in self._metrics or not self._metrics[name]:
                return None
            return self._metrics[name][-1]

    def get_metric_stats(self, name: str, hours: int = 1) -> Dict[str, float]:
        """获取指标统计信息"""
        history = self.get_metric_history(name, hours)
        if not history:
            return {}

        values = [point.value for point in history]
        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "latest": values[-1],
        }

    def cleanup_old_data(self) -> int:
        """清理旧数据"""
        cutoff_time = datetime.now() - timedelta(hours=self.config.retention_hours)
        cleaned_count = 0

        with self._lock:
            for name, points in self._metrics.items():
                original_len = len(points)
                # 保留最近的数据
                while points and points[0].timestamp < cutoff_time:
                    points.popleft()
                cleaned_count += original_len - len(points)

        return cleaned_count


class SystemMonitor:
    """系统监控器"""

    def __init__(self, metrics_collector: MetricsCollector, config: MonitoringConfig):
        self.metrics_collector = metrics_collector
        self.config = config
        self._last_network_stats = None
        self._last_network_time = None

    async def collect_system_metrics(self) -> None:
        """收集系统指标"""
        try:
            # CPU指标
            if self.config.system_metrics_enabled:
                cpu_percent = psutil.cpu_percent(interval=1)
                self.metrics_collector.record_metric(
                    "system.cpu.usage_percent", cpu_percent
                )

                cpu_count = psutil.cpu_count()
                self.metrics_collector.record_metric("system.cpu.count", cpu_count)

                # 负载平均值（仅Unix系统）
                if hasattr(psutil, "getloadavg"):
                    load_avg = psutil.getloadavg()
                    self.metrics_collector.record_metric(
                        "system.cpu.load_avg_1m", load_avg[0]
                    )
                    self.metrics_collector.record_metric(
                        "system.cpu.load_avg_5m", load_avg[1]
                    )
                    self.metrics_collector.record_metric(
                        "system.cpu.load_avg_15m", load_avg[2]
                    )

            # 内存指标
            if self.config.system_metrics_enabled:
                memory = psutil.virtual_memory()
                self.metrics_collector.record_metric(
                    "system.memory.total_bytes", memory.total
                )
                self.metrics_collector.record_metric(
                    "system.memory.available_bytes", memory.available
                )
                self.metrics_collector.record_metric(
                    "system.memory.used_bytes", memory.used
                )
                self.metrics_collector.record_metric(
                    "system.memory.usage_percent", memory.percent
                )

                # 交换内存
                swap = psutil.swap_memory()
                self.metrics_collector.record_metric(
                    "system.swap.total_bytes", swap.total
                )
                self.metrics_collector.record_metric(
                    "system.swap.used_bytes", swap.used
                )
                self.metrics_collector.record_metric(
                    "system.swap.usage_percent", swap.percent
                )

            # 磁盘指标
            if self.config.system_metrics_enabled:
                disk_usage = psutil.disk_usage("/")
                self.metrics_collector.record_metric(
                    "system.disk.total_bytes", disk_usage.total
                )
                self.metrics_collector.record_metric(
                    "system.disk.used_bytes", disk_usage.used
                )
                self.metrics_collector.record_metric(
                    "system.disk.free_bytes", disk_usage.free
                )
                self.metrics_collector.record_metric(
                    "system.disk.usage_percent",
                    (disk_usage.used / disk_usage.total) * 100,
                )

                # 磁盘IO
                disk_io = psutil.disk_io_counters()
                if disk_io:
                    self.metrics_collector.record_metric(
                        "system.disk.read_bytes", disk_io.read_bytes
                    )
                    self.metrics_collector.record_metric(
                        "system.disk.write_bytes", disk_io.write_bytes
                    )
                    self.metrics_collector.record_metric(
                        "system.disk.read_count", disk_io.read_count
                    )
                    self.metrics_collector.record_metric(
                        "system.disk.write_count", disk_io.write_count
                    )

            # 网络指标
            if self.config.network_metrics_enabled:
                network_io = psutil.net_io_counters()
                current_time = time.time()

                if network_io:
                    self.metrics_collector.record_metric(
                        "system.network.bytes_sent", network_io.bytes_sent
                    )
                    self.metrics_collector.record_metric(
                        "system.network.bytes_recv", network_io.bytes_recv
                    )
                    self.metrics_collector.record_metric(
                        "system.network.packets_sent", network_io.packets_sent
                    )
                    self.metrics_collector.record_metric(
                        "system.network.packets_recv", network_io.packets_recv
                    )

                    # 计算网络速率
                    if self._last_network_stats and self._last_network_time:
                        time_delta = current_time - self._last_network_time
                        if time_delta > 0:
                            bytes_sent_rate = (
                                network_io.bytes_sent
                                - self._last_network_stats.bytes_sent
                            ) / time_delta
                            bytes_recv_rate = (
                                network_io.bytes_recv
                                - self._last_network_stats.bytes_recv
                            ) / time_delta

                            self.metrics_collector.record_metric(
                                "system.network.bytes_sent_rate", bytes_sent_rate
                            )
                            self.metrics_collector.record_metric(
                                "system.network.bytes_recv_rate", bytes_recv_rate
                            )

                    self._last_network_stats = network_io
                    self._last_network_time = current_time

            # 进程指标
            if self.config.process_metrics_enabled:
                process = psutil.Process()

                # CPU使用率
                cpu_percent = process.cpu_percent()
                self.metrics_collector.record_metric(
                    "process.cpu.usage_percent", cpu_percent
                )

                # 内存使用
                memory_info = process.memory_info()
                self.metrics_collector.record_metric(
                    "process.memory.rss_bytes", memory_info.rss
                )
                self.metrics_collector.record_metric(
                    "process.memory.vms_bytes", memory_info.vms
                )

                # 文件描述符
                try:
                    num_fds = process.num_fds()
                    self.metrics_collector.record_metric("process.fds.count", num_fds)
                except (psutil.NoSuchProcess, AttributeError):
                    pass

                # 线程数
                num_threads = process.num_threads()
                self.metrics_collector.record_metric(
                    "process.threads.count", num_threads
                )

                # 连接数
                try:
                    connections = process.connections()
                    self.metrics_collector.record_metric(
                        "process.connections.count", len(connections)
                    )
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        except Exception as e:
            logger.error(f"收集系统指标失败: {e}")


class HTTPMonitor:
    """HTTP监控器"""

    def __init__(self, metrics_collector: MetricsCollector, config: MonitoringConfig):
        self.metrics_collector = metrics_collector
        self.config = config
        self._request_count = 0
        self._error_count = 0
        self._response_times = deque(maxlen=1000)

    def record_request(
        self,
        request: Request,
        response: Response,
        duration: float,
        error: Optional[Exception] = None,
    ) -> None:
        """记录HTTP请求指标"""
        self._request_count += 1

        # 基本指标
        labels = {
            "method": request.method,
            "status": str(response.status_code),
            "endpoint": str(request.url.path),
        }

        # 请求计数
        self.metrics_collector.record_metric(
            "http.requests.total", 1, MetricType.COUNTER, labels
        )

        # 响应时间
        self.metrics_collector.record_metric(
            "http.request.duration_seconds", duration, MetricType.HISTOGRAM, labels
        )
        self._response_times.append(duration)

        # 错误计数
        if error or response.status_code >= 400:
            self._error_count += 1
            self.metrics_collector.record_metric(
                "http.requests.errors", 1, MetricType.COUNTER, labels
            )

        # 请求大小
        if self.config.track_request_size:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    self.metrics_collector.record_metric(
                        "http.request.size_bytes", size, MetricType.HISTOGRAM, labels
                    )
                except ValueError:
                    pass

        # 响应大小
        if self.config.track_response_size:
            content_length = response.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    self.metrics_collector.record_metric(
                        "http.response.size_bytes", size, MetricType.HISTOGRAM, labels
                    )
                except ValueError:
                    pass

        # 慢请求
        if duration > self.config.slow_request_threshold:
            self.metrics_collector.record_metric(
                "http.requests.slow", 1, MetricType.COUNTER, labels
            )

    def get_request_stats(self) -> Dict[str, Any]:
        """获取请求统计信息"""
        error_rate = (
            (self._error_count / self._request_count * 100)
            if self._request_count > 0
            else 0
        )

        avg_response_time = 0
        if self._response_times:
            avg_response_time = sum(self._response_times) / len(self._response_times)

        return {
            "total_requests": self._request_count,
            "total_errors": self._error_count,
            "error_rate_percent": error_rate,
            "avg_response_time": avg_response_time,
            "recent_response_times": list(self._response_times)[-10:],  # 最近10个响应时间
        }


class AlertManager:
    """告警管理器"""

    def __init__(self, config: MonitoringConfig):
        self.config = config
        self._alerts: Dict[str, Alert] = {}
        self._alert_rules: List[Callable] = []
        self._lock = threading.RLock()

        # 设置默认告警规则
        self._setup_default_alert_rules()

    def _setup_default_alert_rules(self) -> None:
        """设置默认告警规则"""
        if not self.config.alerting_enabled:
            return

        # CPU使用率告警
        def cpu_usage_alert(metrics_collector: MetricsCollector) -> List[Alert]:
            alerts = []
            cpu_metric = metrics_collector.get_latest_metric("system.cpu.usage_percent")

            if cpu_metric:
                cpu_usage = cpu_metric.value
                thresholds = self.config.alert_thresholds

                if cpu_usage >= thresholds.get("cpu_usage_critical", 90):
                    alerts.append(
                        Alert(
                            id="cpu_usage_critical",
                            level=AlertLevel.CRITICAL,
                            title="CPU使用率过高",
                            message=f"CPU使用率达到 {cpu_usage:.1f}%",
                            timestamp=datetime.now(),
                            metadata={"cpu_usage": cpu_usage},
                        )
                    )
                elif cpu_usage >= thresholds.get("cpu_usage_warning", 70):
                    alerts.append(
                        Alert(
                            id="cpu_usage_warning",
                            level=AlertLevel.WARNING,
                            title="CPU使用率较高",
                            message=f"CPU使用率达到 {cpu_usage:.1f}%",
                            timestamp=datetime.now(),
                            metadata={"cpu_usage": cpu_usage},
                        )
                    )

            return alerts

        # 内存使用率告警
        def memory_usage_alert(metrics_collector: MetricsCollector) -> List[Alert]:
            alerts = []
            memory_metric = metrics_collector.get_latest_metric(
                "system.memory.usage_percent"
            )

            if memory_metric:
                memory_usage = memory_metric.value
                thresholds = self.config.alert_thresholds

                if memory_usage >= thresholds.get("memory_usage_critical", 95):
                    alerts.append(
                        Alert(
                            id="memory_usage_critical",
                            level=AlertLevel.CRITICAL,
                            title="内存使用率过高",
                            message=f"内存使用率达到 {memory_usage:.1f}%",
                            timestamp=datetime.now(),
                            metadata={"memory_usage": memory_usage},
                        )
                    )
                elif memory_usage >= thresholds.get("memory_usage_warning", 80):
                    alerts.append(
                        Alert(
                            id="memory_usage_warning",
                            level=AlertLevel.WARNING,
                            title="内存使用率较高",
                            message=f"内存使用率达到 {memory_usage:.1f}%",
                            timestamp=datetime.now(),
                            metadata={"memory_usage": memory_usage},
                        )
                    )

            return alerts

        self._alert_rules = [cpu_usage_alert, memory_usage_alert]

    def add_alert_rule(self, rule: Callable[[MetricsCollector], List[Alert]]) -> None:
        """添加告警规则"""
        self._alert_rules.append(rule)

    def check_alerts(self, metrics_collector: MetricsCollector) -> List[Alert]:
        """检查告警条件"""
        all_alerts = []

        for rule in self._alert_rules:
            try:
                alerts = rule(metrics_collector)
                all_alerts.extend(alerts)
            except Exception as e:
                logger.error(f"告警规则执行失败: {e}")

        # 更新告警状态
        with self._lock:
            for alert in all_alerts:
                if alert.id not in self._alerts or not self._alerts[alert.id].resolved:
                    self._alerts[alert.id] = alert
                    self._send_alert_notification(alert)

        return all_alerts

    async def _send_alert_notification(self, alert: Alert) -> None:
        """发送告警通知"""
        try:
            # Webhook通知
            if self.config.webhook_url:
                await self._send_webhook_notification(alert)

            # 邮件通知
            if self.config.email_notifications:
                await self._send_email_notification(alert)

            # Slack通知
            if self.config.slack_webhook:
                await self._send_slack_notification(alert)

        except Exception as e:
            logger.error(f"发送告警通知失败: {e}")

    async def _send_webhook_notification(self, alert: Alert) -> None:
        """发送Webhook通知"""
        import httpx

        payload = {
            "id": alert.id,
            "level": alert.level.value,
            "title": alert.title,
            "message": alert.message,
            "timestamp": alert.timestamp.isoformat(),
            "metadata": alert.metadata,
        }

        async with httpx.AsyncClient() as client:
            await client.post(self.config.webhook_url, json=payload, timeout=10)

    async def _send_email_notification(self, alert: Alert) -> None:
        """发送邮件通知"""
        # 这里可以集成邮件发送服务
        logger.info(f"邮件通知: {alert.title} - {alert.message}")

    async def _send_slack_notification(self, alert: Alert) -> None:
        """发送Slack通知"""
        import httpx

        color_map = {
            AlertLevel.INFO: "good",
            AlertLevel.WARNING: "warning",
            AlertLevel.ERROR: "danger",
            AlertLevel.CRITICAL: "danger",
        }

        payload = {
            "attachments": [
                {
                    "color": color_map.get(alert.level, "warning"),
                    "title": alert.title,
                    "text": alert.message,
                    "timestamp": int(alert.timestamp.timestamp()),
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            await client.post(self.config.slack_webhook, json=payload, timeout=10)

    def get_active_alerts(self) -> List[Alert]:
        """获取活跃告警"""
        with self._lock:
            return [alert for alert in self._alerts.values() if not alert.resolved]

    def resolve_alert(self, alert_id: str) -> bool:
        """解决告警"""
        with self._lock:
            if alert_id in self._alerts:
                self._alerts[alert_id].resolved = True
                self._alerts[alert_id].resolved_at = datetime.now()
                return True
            return False


class HealthChecker:
    """健康检查器"""

    def __init__(self, config: MonitoringConfig):
        self.config = config
        self._health_checks: Dict[str, Callable] = {}
        self._health_results: Dict[str, HealthCheck] = {}

        # 设置默认健康检查
        self._setup_default_health_checks()

    def _setup_default_health_checks(self) -> None:
        """设置默认健康检查"""

        # 数据库连接检查
        async def database_health() -> HealthCheck:
            try:
                # 这里可以添加实际的数据库连接检查
                start_time = time.time()
                # await check_database_connection()
                response_time = time.time() - start_time

                return HealthCheck(
                    name="database",
                    status=HealthStatus.HEALTHY,
                    message="数据库连接正常",
                    timestamp=datetime.now(),
                    response_time=response_time,
                )
            except Exception as e:
                return HealthCheck(
                    name="database",
                    status=HealthStatus.UNHEALTHY,
                    message=f"数据库连接失败: {str(e)}",
                    timestamp=datetime.now(),
                    response_time=0,
                )

        # 磁盘空间检查
        async def disk_space_health() -> HealthCheck:
            try:
                disk_usage = psutil.disk_usage("/")
                usage_percent = (disk_usage.used / disk_usage.total) * 100

                if usage_percent > 95:
                    status = HealthStatus.UNHEALTHY
                    message = f"磁盘空间严重不足: {usage_percent:.1f}%"
                elif usage_percent > 85:
                    status = HealthStatus.DEGRADED
                    message = f"磁盘空间不足: {usage_percent:.1f}%"
                else:
                    status = HealthStatus.HEALTHY
                    message = f"磁盘空间正常: {usage_percent:.1f}%"

                return HealthCheck(
                    name="disk_space",
                    status=status,
                    message=message,
                    timestamp=datetime.now(),
                    response_time=0,
                    metadata={"usage_percent": usage_percent},
                )
            except Exception as e:
                return HealthCheck(
                    name="disk_space",
                    status=HealthStatus.UNKNOWN,
                    message=f"磁盘空间检查失败: {str(e)}",
                    timestamp=datetime.now(),
                    response_time=0,
                )

        # 内存使用检查
        async def memory_health() -> HealthCheck:
            try:
                memory = psutil.virtual_memory()
                usage_percent = memory.percent

                if usage_percent > 95:
                    status = HealthStatus.UNHEALTHY
                    message = f"内存使用率过高: {usage_percent:.1f}%"
                elif usage_percent > 80:
                    status = HealthStatus.DEGRADED
                    message = f"内存使用率较高: {usage_percent:.1f}%"
                else:
                    status = HealthStatus.HEALTHY
                    message = f"内存使用正常: {usage_percent:.1f}%"

                return HealthCheck(
                    name="memory",
                    status=status,
                    message=message,
                    timestamp=datetime.now(),
                    response_time=0,
                    metadata={"usage_percent": usage_percent},
                )
            except Exception as e:
                return HealthCheck(
                    name="memory",
                    status=HealthStatus.UNKNOWN,
                    message=f"内存检查失败: {str(e)}",
                    timestamp=datetime.now(),
                    response_time=0,
                )

        self._health_checks = {
            "database": database_health,
            "disk_space": disk_space_health,
            "memory": memory_health,
        }

    def add_health_check(self, name: str, check_func: Callable) -> None:
        """添加健康检查"""
        self._health_checks[name] = check_func

    async def run_health_checks(self) -> Dict[str, HealthCheck]:
        """运行所有健康检查"""
        results = {}

        for name, check_func in self._health_checks.items():
            try:
                result = await asyncio.wait_for(
                    check_func(), timeout=self.config.health_check_timeout
                )
                results[name] = result
                self._health_results[name] = result
            except asyncio.TimeoutError:
                result = HealthCheck(
                    name=name,
                    status=HealthStatus.UNHEALTHY,
                    message="健康检查超时",
                    timestamp=datetime.now(),
                    response_time=self.config.health_check_timeout,
                )
                results[name] = result
                self._health_results[name] = result
            except Exception as e:
                result = HealthCheck(
                    name=name,
                    status=HealthStatus.UNKNOWN,
                    message=f"健康检查失败: {str(e)}",
                    timestamp=datetime.now(),
                    response_time=0,
                )
                results[name] = result
                self._health_results[name] = result

        return results

    def get_overall_health(self) -> HealthStatus:
        """获取整体健康状态"""
        if not self._health_results:
            return HealthStatus.UNKNOWN

        statuses = [result.status for result in self._health_results.values()]

        if HealthStatus.UNHEALTHY in statuses:
            return HealthStatus.UNHEALTHY
        elif HealthStatus.DEGRADED in statuses:
            return HealthStatus.DEGRADED
        elif all(status == HealthStatus.HEALTHY for status in statuses):
            return HealthStatus.HEALTHY
        else:
            return HealthStatus.UNKNOWN


class MonitoringManager:
    """监控管理器"""

    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.metrics_collector = MetricsCollector(config)
        self.system_monitor = SystemMonitor(self.metrics_collector, config)
        self.http_monitor = HTTPMonitor(self.metrics_collector, config)
        self.alert_manager = AlertManager(config)
        self.health_checker = HealthChecker(config)

        # 后台任务
        self._monitoring_task: Optional[asyncio.Task] = None
        self._health_check_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # 启动监控任务
        if config.enabled:
            asyncio.create_task(self._start_monitoring())

    async def _start_monitoring(self) -> None:
        """启动监控任务"""
        # 系统指标收集任务
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())

        # 健康检查任务
        if self.config.health_check_enabled:
            self._health_check_task = asyncio.create_task(self._health_check_loop())

        # 数据清理任务
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info("监控任务已启动")

    async def _monitoring_loop(self) -> None:
        """监控循环"""
        while True:
            try:
                # 收集系统指标
                await self.system_monitor.collect_system_metrics()

                # 检查告警
                if self.config.alerting_enabled:
                    self.alert_manager.check_alerts(self.metrics_collector)

                await asyncio.sleep(self.config.collection_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"监控循环错误: {e}")
                await asyncio.sleep(self.config.collection_interval)

    async def _health_check_loop(self) -> None:
        """健康检查循环"""
        while True:
            try:
                await self.health_checker.run_health_checks()
                await asyncio.sleep(self.config.health_check_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"健康检查循环错误: {e}")
                await asyncio.sleep(self.config.health_check_interval)

    async def _cleanup_loop(self) -> None:
        """数据清理循环"""
        while True:
            try:
                # 每小时清理一次旧数据
                await asyncio.sleep(3600)
                cleaned_count = self.metrics_collector.cleanup_old_data()
                if cleaned_count > 0:
                    logger.info(f"清理了 {cleaned_count} 个旧的监控数据点")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"数据清理循环错误: {e}")

    def get_system_info(self) -> Dict[str, Any]:
        """获取系统信息"""
        return {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "hostname": socket.gethostname(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "disk_total": psutil.disk_usage("/").total,
            "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat(),
        }

    def get_monitoring_status(self) -> Dict[str, Any]:
        """获取监控状态"""
        return {
            "enabled": self.config.enabled,
            "collection_interval": self.config.collection_interval,
            "metrics_count": sum(
                len(points) for points in self.metrics_collector._metrics.values()
            ),
            "active_alerts": len(self.alert_manager.get_active_alerts()),
            "overall_health": self.health_checker.get_overall_health().value,
            "uptime_seconds": time.time() - psutil.boot_time(),
        }

    async def cleanup(self) -> None:
        """清理资源"""
        # 取消后台任务
        for task in [
            self._monitoring_task,
            self._health_check_task,
            self._cleanup_task,
        ]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        logger.info("监控管理器资源清理完成")


class MonitoringMiddleware(BaseHTTPMiddleware):
    """监控中间件"""

    def __init__(self, app, config_path: Optional[str] = None):
        super().__init__(app)

        # 加载配置
        self.config = self._load_config(config_path)

        # 初始化监控管理器
        self.monitoring_manager = MonitoringManager(self.config)

        logger.info("监控中间件初始化完成")

    def _load_config(self, config_path: Optional[str] = None) -> MonitoringConfig:
        """加载配置"""
        try:
            if config_path:
                config_file = Path(config_path)
                if config_file.exists():
                    import yaml

                    with open(config_file, "r", encoding="utf-8") as f:
                        config_data = yaml.safe_load(f)

                    monitoring_config = config_data.get("multimodal", {}).get(
                        "monitoring", {}
                    )
                    return MonitoringConfig(**monitoring_config)

            # 尝试从multimodal配置中加载
            multimodal_config_path = Path("config/midware/multimodal_config.yaml")
            if multimodal_config_path.exists():
                import yaml

                with open(multimodal_config_path, "r", encoding="utf-8") as f:
                    config_data = yaml.safe_load(f)

                monitoring_config = config_data.get("multimodal", {}).get(
                    "monitoring", {}
                )
                return MonitoringConfig(**monitoring_config)

        except Exception as e:
            logger.warning(f"加载监控配置失败，使用默认配置: {e}")

        return MonitoringConfig()

    async def dispatch(self, request: Request, call_next) -> Response:
        """处理请求"""
        if not self.config.enabled:
            return await call_next(request)

        start_time = time.time()
        error = None

        try:
            response = await call_next(request)

        except Exception as e:
            error = e
            # 创建错误响应
            response = Response(
                content=json.dumps({"error": "Internal server error"}),
                status_code=500,
                headers={"content-type": "application/json"},
            )

        # 记录HTTP指标
        duration = time.time() - start_time
        self.monitoring_manager.http_monitor.record_request(
            request, response, duration, error
        )

        # 添加监控头
        response.headers["X-Monitoring-Processing-Time"] = f"{duration:.3f}s"
        response.headers["X-Monitoring-Request-ID"] = str(id(request))

        if error:
            raise error

        return response


# 全局监控管理器实例
_global_monitoring_manager: Optional[MonitoringManager] = None


def get_monitoring_manager() -> MonitoringManager:
    """获取全局监控管理器实例"""
    global _global_monitoring_manager
    if _global_monitoring_manager is None:
        config = MonitoringConfig()
        _global_monitoring_manager = MonitoringManager(config)
    return _global_monitoring_manager


def get_system_metrics() -> Dict[str, Any]:
    """获取系统指标的便捷函数"""
    manager = get_monitoring_manager()
    return manager.get_monitoring_status()


def get_health_status() -> Dict[str, Any]:
    """获取健康状态的便捷函数"""
    manager = get_monitoring_manager()
    return {
        "overall_health": manager.health_checker.get_overall_health().value,
        "health_checks": {
            name: {
                "status": result.status.value,
                "message": result.message,
                "timestamp": result.timestamp.isoformat(),
                "response_time": result.response_time,
            }
            for name, result in manager.health_checker._health_results.items()
        },
    }


def get_active_alerts() -> List[Dict[str, Any]]:
    """获取活跃告警的便捷函数"""
    manager = get_monitoring_manager()
    alerts = manager.alert_manager.get_active_alerts()
    return [
        {
            "id": alert.id,
            "level": alert.level.value,
            "title": alert.title,
            "message": alert.message,
            "timestamp": alert.timestamp.isoformat(),
            "metadata": alert.metadata,
        }
        for alert in alerts
    ]


# 装饰器支持
def monitored(metric_name: Optional[str] = None):
    """监控装饰器"""

    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            manager = get_monitoring_manager()
            name = metric_name or f"{func.__module__}.{func.__name__}"

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                manager.metrics_collector.record_metric(
                    f"{name}.duration", duration, MetricType.HISTOGRAM
                )
                manager.metrics_collector.record_metric(
                    f"{name}.success", 1, MetricType.COUNTER
                )
                return result
            except Exception as e:
                duration = time.time() - start_time
                manager.metrics_collector.record_metric(
                    f"{name}.duration", duration, MetricType.HISTOGRAM
                )
                manager.metrics_collector.record_metric(
                    f"{name}.error", 1, MetricType.COUNTER
                )
                raise

        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            manager = get_monitoring_manager()
            name = metric_name or f"{func.__module__}.{func.__name__}"

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                manager.metrics_collector.record_metric(
                    f"{name}.duration", duration, MetricType.HISTOGRAM
                )
                manager.metrics_collector.record_metric(
                    f"{name}.success", 1, MetricType.COUNTER
                )
                return result
            except Exception as e:
                duration = time.time() - start_time
                manager.metrics_collector.record_metric(
                    f"{name}.duration", duration, MetricType.HISTOGRAM
                )
                manager.metrics_collector.record_metric(
                    f"{name}.error", 1, MetricType.COUNTER
                )
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator

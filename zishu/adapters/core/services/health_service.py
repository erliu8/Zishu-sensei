"""
适配器健康监控服务

基于新架构的适配器健康状态监控和管理服务。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set, Callable, Tuple
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from enum import Enum
import statistics
import time

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult
from ..types import (
    AdapterRegistration,
    AdapterIdentity,
    AdapterConfiguration,
    AdapterStatus,
    LifecycleState,
    EventType,
    Event,
    Priority,
)
from ..events import EventBus

logger = logging.getLogger(__name__)


class HealthMetricType(str, Enum):
    """健康指标类型"""

    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    MEMORY_USAGE = "memory_usage"
    CPU_USAGE = "cpu_usage"
    AVAILABILITY = "availability"
    CUSTOM = "custom"


@dataclass
class HealthMetric:
    """健康指标"""

    name: str
    type: HealthMetricType
    value: float
    unit: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthThreshold:
    """健康阈值"""

    metric_name: str
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    comparison: str = "greater"  # greater, less, equal
    enabled: bool = True


@dataclass
class AdapterHealthStatus:
    """适配器健康状态"""

    adapter_id: str
    overall_health: ServiceHealth
    last_check: datetime
    metrics: Dict[str, HealthMetric] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    uptime: float = 0.0
    check_count: int = 0
    consecutive_failures: int = 0


class HealthMonitor:
    """健康监控器基类"""

    def __init__(self, name: str, interval: float = 30.0):
        self.name = name
        self.interval = interval
        self.enabled = True
        self.last_run: Optional[datetime] = None

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """执行健康检查"""
        raise NotImplementedError


class AdapterHealthService(AsyncService):
    """
    适配器健康监控服务

    负责：
    - 适配器健康状态监控
    - 健康指标收集和分析
    - 健康阈值管理
    - 健康报告生成
    - 异常检测和告警
    """

    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """初始化健康监控服务"""
        super().__init__("adapter_health", config)

        self._event_bus = event_bus
        self._health_status: Dict[str, AdapterHealthStatus] = {}
        self._health_monitors: Dict[str, HealthMonitor] = {}
        self._health_thresholds: Dict[str, List[HealthThreshold]] = {}
        self._health_history: Dict[str, List[HealthMetric]] = {}
        self._health_lock = asyncio.Lock()

        # 配置参数
        self._check_interval = self.config.get("check_interval", 30.0)
        self._history_retention = self.config.get("history_retention", 3600)  # 1小时
        self._max_history_size = self.config.get("max_history_size", 1000)
        self._failure_threshold = self.config.get("failure_threshold", 3)
        self._enable_auto_recovery = self.config.get("enable_auto_recovery", True)

        # 监控任务
        self._monitoring_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # 注册的适配器
        self._registered_adapters: Dict[str, AdapterRegistration] = {}

        logger.info(f"AdapterHealthService initialized with config: {self.config}")

    async def _initialize_impl(self) -> None:
        """初始化实现"""
        logger.info("Initializing adapter health service...")

        # 注册默认健康监控器
        await self._register_default_monitors()

        # 清空状态
        self._health_status.clear()
        self._health_history.clear()

        logger.info(
            f"Adapter health service initialized with {len(self._health_monitors)} monitors"
        )

    async def _start_impl(self) -> None:
        """启动实现"""
        logger.info("Starting adapter health service...")

        # 启动监控任务
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())

        # 启动清理任务
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        # 发送服务启动事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STARTED,
                    source="adapter_health_service",
                    data={
                        "service": "adapter_health",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter health service started")

    async def _stop_impl(self) -> None:
        """停止实现"""
        logger.info("Stopping adapter health service...")

        # 停止监控任务
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        # 停止清理任务
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # 发送服务停止事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STOPPED,
                    source="adapter_health_service",
                    data={
                        "service": "adapter_health",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter health service stopped")

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        try:
            # 检查基本状态
            if not self.is_running:
                return HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.UNHEALTHY,
                    message="Service is not running",
                )

            # 检查监控的适配器数量
            monitored_count = len(self._health_status)
            unhealthy_count = sum(
                1
                for status in self._health_status.values()
                if status.overall_health == ServiceHealth.UNHEALTHY
            )

            if unhealthy_count > monitored_count * 0.5:  # 超过50%不健康
                return HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.DEGRADED,
                    message=f"Too many unhealthy adapters: {unhealthy_count}/{monitored_count}",
                )

            # 检查监控器状态
            disabled_monitors = sum(
                1 for monitor in self._health_monitors.values() if not monitor.enabled
            )

            return HealthCheckResult(
                is_healthy=True,
                status=ServiceHealth.HEALTHY,
                message=f"Health service monitoring {monitored_count} adapters",
                details={
                    "monitored_adapters": monitored_count,
                    "unhealthy_adapters": unhealthy_count,
                    "active_monitors": len(self._health_monitors) - disabled_monitors,
                    "total_monitors": len(self._health_monitors),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                status=ServiceHealth.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
            )

    async def register_adapter(self, registration: AdapterRegistration) -> None:
        """注册适配器进行健康监控"""
        adapter_id = registration.identity.id

        async with self._health_lock:
            self._registered_adapters[adapter_id] = registration

            # 初始化健康状态
            if adapter_id not in self._health_status:
                self._health_status[adapter_id] = AdapterHealthStatus(
                    adapter_id=adapter_id,
                    overall_health=ServiceHealth.UNKNOWN,
                    last_check=datetime.now(timezone.utc),
                )

            logger.info(f"Registered adapter for health monitoring: {adapter_id}")

    async def unregister_adapter(self, adapter_id: str) -> None:
        """注销适配器健康监控"""
        async with self._health_lock:
            self._registered_adapters.pop(adapter_id, None)
            self._health_status.pop(adapter_id, None)
            self._health_history.pop(adapter_id, None)

            logger.info(f"Unregistered adapter from health monitoring: {adapter_id}")

    async def check_adapter_health(
        self, adapter_id: str
    ) -> Optional[AdapterHealthStatus]:
        """检查单个适配器健康状态"""
        if adapter_id not in self._registered_adapters:
            return None

        registration = self._registered_adapters[adapter_id]

        try:
            # 执行健康检查
            all_metrics = []
            for monitor in self._health_monitors.values():
                if monitor.enabled:
                    metrics = await monitor.check_health(adapter_id, registration)
                    all_metrics.extend(metrics)

            # 更新健康状态
            await self._update_health_status(adapter_id, all_metrics)

            return self._health_status.get(adapter_id)

        except Exception as e:
            logger.error(f"Health check failed for adapter '{adapter_id}': {e}")
            await self._record_health_failure(adapter_id, str(e))
            return self._health_status.get(adapter_id)

    async def get_adapter_health(
        self, adapter_id: str
    ) -> Optional[AdapterHealthStatus]:
        """获取适配器健康状态"""
        return self._health_status.get(adapter_id)

    async def get_all_health_status(self) -> Dict[str, AdapterHealthStatus]:
        """获取所有适配器健康状态"""
        return self._health_status.copy()

    async def add_health_monitor(self, monitor: HealthMonitor) -> None:
        """添加健康监控器"""
        async with self._health_lock:
            self._health_monitors[monitor.name] = monitor
            logger.info(f"Added health monitor: {monitor.name}")

    async def remove_health_monitor(self, monitor_name: str) -> None:
        """移除健康监控器"""
        async with self._health_lock:
            if monitor_name in self._health_monitors:
                del self._health_monitors[monitor_name]
                logger.info(f"Removed health monitor: {monitor_name}")

    async def add_health_threshold(
        self, adapter_id: str, threshold: HealthThreshold
    ) -> None:
        """添加健康阈值"""
        async with self._health_lock:
            if adapter_id not in self._health_thresholds:
                self._health_thresholds[adapter_id] = []

            self._health_thresholds[adapter_id].append(threshold)
            logger.info(
                f"Added health threshold for adapter '{adapter_id}': {threshold.metric_name}"
            )

    async def get_health_metrics_history(
        self, adapter_id: str, metric_name: Optional[str] = None, hours: int = 1
    ) -> List[HealthMetric]:
        """获取健康指标历史"""
        if adapter_id not in self._health_history:
            return []

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        history = self._health_history[adapter_id]

        # 过滤时间范围
        filtered_history = [
            metric for metric in history if metric.timestamp >= cutoff_time
        ]

        # 过滤指标名称
        if metric_name:
            filtered_history = [
                metric for metric in filtered_history if metric.name == metric_name
            ]

        return filtered_history

    async def get_health_summary(self) -> Dict[str, Any]:
        """获取健康状态摘要"""
        total_adapters = len(self._registered_adapters)
        healthy_count = sum(
            1
            for status in self._health_status.values()
            if status.overall_health == ServiceHealth.HEALTHY
        )
        degraded_count = sum(
            1
            for status in self._health_status.values()
            if status.overall_health == ServiceHealth.DEGRADED
        )
        unhealthy_count = sum(
            1
            for status in self._health_status.values()
            if status.overall_health == ServiceHealth.UNHEALTHY
        )

        return {
            "total_adapters": total_adapters,
            "healthy_count": healthy_count,
            "degraded_count": degraded_count,
            "unhealthy_count": unhealthy_count,
            "health_rate": healthy_count / total_adapters
            if total_adapters > 0
            else 0.0,
            "active_monitors": len(
                [m for m in self._health_monitors.values() if m.enabled]
            ),
            "total_checks": sum(
                status.check_count for status in self._health_status.values()
            ),
            "service_uptime": self.metrics.uptime,
        }

    # 内部方法

    async def _register_default_monitors(self) -> None:
        """注册默认健康监控器"""
        # 基本可用性监控
        await self.add_health_monitor(AvailabilityMonitor())

        # 响应时间监控
        await self.add_health_monitor(ResponseTimeMonitor())

        # 错误率监控
        await self.add_health_monitor(ErrorRateMonitor())

        # 内存使用监控
        await self.add_health_monitor(MemoryUsageMonitor())

        # 吞吐量监控
        await self.add_health_monitor(ThroughputMonitor())

        logger.info(
            "Enhanced health monitors registered: availability, response_time, error_rate, memory_usage, throughput"
        )

    async def _monitoring_loop(self) -> None:
        """健康监控循环"""
        logger.info("Starting health monitoring loop")

        while self.is_running:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self._check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitoring loop error: {e}")
                await asyncio.sleep(self._check_interval)

        logger.info("Health monitoring loop stopped")

    async def _perform_health_checks(self) -> None:
        """执行健康检查"""
        if not self._registered_adapters:
            return

        # 并发检查所有适配器
        tasks = []
        for adapter_id in self._registered_adapters.keys():
            task = asyncio.create_task(self.check_adapter_health(adapter_id))
            tasks.append(task)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _update_health_status(
        self, adapter_id: str, metrics: List[HealthMetric]
    ) -> None:
        """更新健康状态"""
        async with self._health_lock:
            if adapter_id not in self._health_status:
                self._health_status[adapter_id] = AdapterHealthStatus(
                    adapter_id=adapter_id,
                    overall_health=ServiceHealth.UNKNOWN,
                    last_check=datetime.now(timezone.utc),
                )

            status = self._health_status[adapter_id]
            current_time = datetime.now(timezone.utc)

            # 更新指标
            for metric in metrics:
                status.metrics[metric.name] = metric

                # 记录历史
                if adapter_id not in self._health_history:
                    self._health_history[adapter_id] = []
                self._health_history[adapter_id].append(metric)

            # 检查阈值
            issues = await self._check_thresholds(adapter_id, metrics)
            status.issues = issues

            # 计算总体健康状态
            overall_health = self._calculate_overall_health(metrics, issues)

            # 更新状态
            if overall_health != status.overall_health:
                old_health = status.overall_health
                status.overall_health = overall_health

                # 发送健康状态变化事件
                if self._event_bus:
                    await self._event_bus.emit(
                        Event(
                            event_type=EventType.ADAPTER_HEALTH_CHANGED,
                            source="adapter_health_service",
                            data={
                                "adapter_id": adapter_id,
                                "old_health": old_health,
                                "new_health": overall_health,
                                "timestamp": current_time,
                            },
                        )
                    )

            # 更新统计信息
            status.last_check = current_time
            status.check_count += 1

            if overall_health == ServiceHealth.UNHEALTHY:
                status.consecutive_failures += 1
            else:
                status.consecutive_failures = 0

            # 计算运行时间
            if hasattr(status, "start_time"):
                status.uptime = (current_time - status.start_time).total_seconds()

    async def _check_thresholds(
        self, adapter_id: str, metrics: List[HealthMetric]
    ) -> List[str]:
        """检查健康阈值"""
        issues = []

        if adapter_id not in self._health_thresholds:
            return issues

        thresholds = self._health_thresholds[adapter_id]
        metric_dict = {metric.name: metric for metric in metrics}

        for threshold in thresholds:
            if not threshold.enabled or threshold.metric_name not in metric_dict:
                continue

            metric = metric_dict[threshold.metric_name]
            value = metric.value

            # 检查临界阈值
            if threshold.critical_threshold is not None:
                if self._check_threshold_condition(
                    value, threshold.critical_threshold, threshold.comparison
                ):
                    issues.append(
                        f"Critical: {threshold.metric_name} = {value} (threshold: {threshold.critical_threshold})"
                    )

            # 检查警告阈值
            elif threshold.warning_threshold is not None:
                if self._check_threshold_condition(
                    value, threshold.warning_threshold, threshold.comparison
                ):
                    issues.append(
                        f"Warning: {threshold.metric_name} = {value} (threshold: {threshold.warning_threshold})"
                    )

        return issues

    def _check_threshold_condition(
        self, value: float, threshold: float, comparison: str
    ) -> bool:
        """检查阈值条件"""
        if comparison == "greater":
            return value > threshold
        elif comparison == "less":
            return value < threshold
        elif comparison == "equal":
            return abs(value - threshold) < 0.001  # 浮点数比较
        else:
            return False

    def _calculate_overall_health(
        self, metrics: List[HealthMetric], issues: List[str]
    ) -> ServiceHealth:
        """计算总体健康状态"""
        if not metrics:
            return ServiceHealth.UNKNOWN

        # 检查是否有严重问题
        critical_issues = [issue for issue in issues if issue.startswith("Critical:")]
        if critical_issues:
            return ServiceHealth.UNHEALTHY

        # 检查是否有警告
        warning_issues = [issue for issue in issues if issue.startswith("Warning:")]
        if warning_issues:
            return ServiceHealth.DEGRADED

        # 检查可用性指标
        availability_metrics = [
            m for m in metrics if m.type == HealthMetricType.AVAILABILITY
        ]
        if availability_metrics:
            avg_availability = statistics.mean(m.value for m in availability_metrics)
            if avg_availability < 0.95:  # 95%可用性阈值
                return ServiceHealth.DEGRADED
            elif avg_availability < 0.90:  # 90%可用性阈值
                return ServiceHealth.UNHEALTHY

        return ServiceHealth.HEALTHY

    async def _record_health_failure(self, adapter_id: str, error_message: str) -> None:
        """记录健康检查失败"""
        async with self._health_lock:
            if adapter_id not in self._health_status:
                self._health_status[adapter_id] = AdapterHealthStatus(
                    adapter_id=adapter_id,
                    overall_health=ServiceHealth.UNKNOWN,
                    last_check=datetime.now(timezone.utc),
                )

            status = self._health_status[adapter_id]
            status.overall_health = ServiceHealth.UNHEALTHY
            status.issues = [f"Health check failed: {error_message}"]
            status.consecutive_failures += 1
            status.last_check = datetime.now(timezone.utc)

    async def _cleanup_loop(self) -> None:
        """清理循环"""
        logger.info("Starting health data cleanup loop")

        while self.is_running:
            try:
                await self._cleanup_old_data()
                await asyncio.sleep(self._history_retention / 4)  # 每1/4保留时间清理一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health cleanup loop error: {e}")
                await asyncio.sleep(300)  # 出错时等待5分钟

        logger.info("Health data cleanup loop stopped")

    async def _cleanup_old_data(self) -> None:
        """清理旧数据"""
        async with self._health_lock:
            cutoff_time = datetime.now(timezone.utc) - timedelta(
                seconds=self._history_retention
            )

            for adapter_id, history in self._health_history.items():
                # 移除过期数据
                self._health_history[adapter_id] = [
                    metric for metric in history if metric.timestamp >= cutoff_time
                ]

                # 限制历史大小
                if len(self._health_history[adapter_id]) > self._max_history_size:
                    self._health_history[adapter_id] = self._health_history[adapter_id][
                        -self._max_history_size :
                    ]


# 默认健康监控器实现


class AvailabilityMonitor(HealthMonitor):
    """可用性监控器 - 增强版"""

    def __init__(self):
        super().__init__("availability", interval=30.0)
        self._response_history: Dict[str, List[float]] = {}
        self._failure_counts: Dict[str, int] = {}
        self._last_success: Dict[str, datetime] = {}

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """检查适配器可用性"""
        start_time = time.time()
        current_time = datetime.now(timezone.utc)

        try:
            # 初始化历史记录
            if adapter_id not in self._response_history:
                self._response_history[adapter_id] = []
                self._failure_counts[adapter_id] = 0

            is_available = True
            error_details = None

            # 尝试多种健康检查方法
            try:
                # 1. 检查适配器类是否有健康检查方法
                if hasattr(registration.adapter_class, "health_check"):
                    health_result = await asyncio.wait_for(
                        registration.adapter_class.health_check(), timeout=5.0
                    )
                    is_available = bool(health_result)

                # 2. 检查适配器状态
                elif hasattr(registration.adapter_class, "is_ready"):
                    is_available = await registration.adapter_class.is_ready()

                # 3. 尝试基本连接测试
                elif hasattr(registration.adapter_class, "ping"):
                    await asyncio.wait_for(
                        registration.adapter_class.ping(), timeout=3.0
                    )
                    is_available = True

                # 4. 基本实例化测试
                else:
                    # 简单检查类是否可以实例化
                    test_instance = registration.adapter_class()
                    is_available = test_instance is not None

            except asyncio.TimeoutError:
                is_available = False
                error_details = "Health check timeout"
            except Exception as e:
                is_available = False
                error_details = f"Health check error: {str(e)}"

            response_time = (time.time() - start_time) * 1000  # 毫秒

            # 更新历史记录
            self._response_history[adapter_id].append(response_time)
            if len(self._response_history[adapter_id]) > 100:  # 保持最近100次记录
                self._response_history[adapter_id].pop(0)

            # 更新失败计数
            if is_available:
                self._failure_counts[adapter_id] = 0
                self._last_success[adapter_id] = current_time
            else:
                self._failure_counts[adapter_id] += 1

            # 计算平均响应时间
            avg_response_time = statistics.mean(self._response_history[adapter_id])

            # 计算可用性率
            recent_checks = self._response_history[adapter_id][-20:]  # 最近20次
            success_count = len([t for t in recent_checks if t < 5000])  # 5秒内算成功
            availability_rate = (
                success_count / len(recent_checks) if recent_checks else 0.0
            )

            metrics = [
                HealthMetric(
                    name="availability",
                    type=HealthMetricType.AVAILABILITY,
                    value=1.0 if is_available else 0.0,
                    unit="ratio",
                    metadata={
                        "error_details": error_details,
                        "consecutive_failures": self._failure_counts[adapter_id],
                    },
                ),
                HealthMetric(
                    name="response_time",
                    type=HealthMetricType.RESPONSE_TIME,
                    value=response_time,
                    unit="ms",
                ),
                HealthMetric(
                    name="avg_response_time",
                    type=HealthMetricType.RESPONSE_TIME,
                    value=avg_response_time,
                    unit="ms",
                    metadata={"sample_size": len(self._response_history[adapter_id])},
                ),
                HealthMetric(
                    name="availability_rate",
                    type=HealthMetricType.AVAILABILITY,
                    value=availability_rate,
                    unit="ratio",
                    metadata={"sample_size": len(recent_checks)},
                ),
            ]

            # 添加运行时间指标
            if adapter_id in self._last_success:
                uptime = (current_time - self._last_success[adapter_id]).total_seconds()
                metrics.append(
                    HealthMetric(
                        name="uptime",
                        type=HealthMetricType.CUSTOM,
                        value=uptime,
                        unit="seconds",
                    )
                )

            return metrics

        except Exception as e:
            logger.error(f"Availability check failed for adapter '{adapter_id}': {e}")
            self._failure_counts[adapter_id] = (
                self._failure_counts.get(adapter_id, 0) + 1
            )
            return [
                HealthMetric(
                    name="availability",
                    type=HealthMetricType.AVAILABILITY,
                    value=0.0,
                    unit="ratio",
                    metadata={"error": str(e)},
                )
            ]


class ResponseTimeMonitor(HealthMonitor):
    """响应时间监控器 - 增强版"""

    def __init__(self):
        super().__init__("response_time", interval=60.0)
        self._response_times: Dict[str, List[float]] = {}
        self._percentiles: Dict[str, Dict[str, float]] = {}

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """检查响应时间性能"""
        try:
            # 初始化历史记录
            if adapter_id not in self._response_times:
                self._response_times[adapter_id] = []
                self._percentiles[adapter_id] = {}

            # 执行多次测试以获得更准确的性能数据
            test_results = []
            for i in range(5):  # 执行5次测试
                start_time = time.time()

                try:
                    # 尝试调用适配器的性能测试方法
                    if hasattr(registration.adapter_class, "performance_test"):
                        await registration.adapter_class.performance_test()
                    elif hasattr(registration.adapter_class, "ping"):
                        await registration.adapter_class.ping()
                    else:
                        # 模拟一个简单的操作
                        await asyncio.sleep(0.001)  # 1ms模拟延迟

                    response_time = (time.time() - start_time) * 1000
                    test_results.append(response_time)

                except Exception as e:
                    logger.warning(
                        f"Response time test {i+1} failed for adapter '{adapter_id}': {e}"
                    )
                    # 对于失败的测试，记录一个很高的响应时间
                    test_results.append(30000.0)  # 30秒超时

                # 测试间隔
                await asyncio.sleep(0.1)

            # 计算统计数据
            if test_results:
                current_avg = statistics.mean(test_results)
                current_min = min(test_results)
                current_max = max(test_results)
                current_median = statistics.median(test_results)

                # 更新历史记录
                self._response_times[adapter_id].extend(test_results)
                if len(self._response_times[adapter_id]) > 200:  # 保持最近200次记录
                    self._response_times[adapter_id] = self._response_times[adapter_id][
                        -200:
                    ]

                # 计算百分位数
                all_times = self._response_times[adapter_id]
                if len(all_times) >= 10:  # 至少10个样本才计算百分位数
                    sorted_times = sorted(all_times)
                    self._percentiles[adapter_id] = {
                        "p50": self._calculate_percentile(sorted_times, 50),
                        "p90": self._calculate_percentile(sorted_times, 90),
                        "p95": self._calculate_percentile(sorted_times, 95),
                        "p99": self._calculate_percentile(sorted_times, 99),
                    }

                metrics = [
                    HealthMetric(
                        name="response_time_avg",
                        type=HealthMetricType.RESPONSE_TIME,
                        value=current_avg,
                        unit="ms",
                        metadata={"sample_size": len(test_results)},
                    ),
                    HealthMetric(
                        name="response_time_min",
                        type=HealthMetricType.RESPONSE_TIME,
                        value=current_min,
                        unit="ms",
                    ),
                    HealthMetric(
                        name="response_time_max",
                        type=HealthMetricType.RESPONSE_TIME,
                        value=current_max,
                        unit="ms",
                    ),
                    HealthMetric(
                        name="response_time_median",
                        type=HealthMetricType.RESPONSE_TIME,
                        value=current_median,
                        unit="ms",
                    ),
                ]

                # 添加百分位数指标
                if adapter_id in self._percentiles and self._percentiles[adapter_id]:
                    for percentile, value in self._percentiles[adapter_id].items():
                        metrics.append(
                            HealthMetric(
                                name=f"response_time_{percentile}",
                                type=HealthMetricType.RESPONSE_TIME,
                                value=value,
                                unit="ms",
                                metadata={"historical_sample_size": len(all_times)},
                            )
                        )

                # 计算历史趋势
                if len(all_times) >= 20:
                    recent_avg = statistics.mean(all_times[-10:])  # 最近10次
                    historical_avg = statistics.mean(all_times[:-10])  # 历史平均
                    trend = (
                        ((recent_avg - historical_avg) / historical_avg) * 100
                        if historical_avg > 0
                        else 0
                    )

                    metrics.append(
                        HealthMetric(
                            name="response_time_trend",
                            type=HealthMetricType.PERFORMANCE,
                            value=trend,
                            unit="percent",
                            metadata={
                                "recent_avg": recent_avg,
                                "historical_avg": historical_avg,
                            },
                        )
                    )

                # 计算性能等级
                performance_score = self._calculate_performance_score(current_avg)
                metrics.append(
                    HealthMetric(
                        name="performance_score",
                        type=HealthMetricType.PERFORMANCE,
                        value=performance_score,
                        unit="score",
                        metadata={"scale": "0-100, higher is better"},
                    )
                )

                return metrics
            else:
                return []

        except Exception as e:
            logger.error(f"Response time check failed for adapter '{adapter_id}': {e}")
            return []

    def _calculate_percentile(self, sorted_data: List[float], percentile: int) -> float:
        """计算百分位数"""
        if not sorted_data:
            return 0.0

        index = (percentile / 100.0) * (len(sorted_data) - 1)
        lower_index = int(index)
        upper_index = min(lower_index + 1, len(sorted_data) - 1)

        if lower_index == upper_index:
            return sorted_data[lower_index]

        weight = index - lower_index
        return (
            sorted_data[lower_index] * (1 - weight) + sorted_data[upper_index] * weight
        )

    def _calculate_performance_score(self, avg_response_time: float) -> float:
        """计算性能分数 (0-100)"""
        # 响应时间越低，分数越高
        if avg_response_time <= 10:  # 10ms以下为优秀
            return 100.0
        elif avg_response_time <= 50:  # 50ms以下为良好
            return 90.0 - (avg_response_time - 10) * 2
        elif avg_response_time <= 200:  # 200ms以下为一般
            return 70.0 - (avg_response_time - 50) * 0.3
        elif avg_response_time <= 1000:  # 1s以下为较差
            return 40.0 - (avg_response_time - 200) * 0.05
        else:  # 1s以上为很差
            return max(0.0, 20.0 - (avg_response_time - 1000) * 0.01)


class ErrorRateMonitor(HealthMonitor):
    """错误率监控器 - 增强版"""

    def __init__(self):
        super().__init__("error_rate", interval=120.0)
        self._error_counts: Dict[str, int] = {}
        self._total_counts: Dict[str, int] = {}
        self._error_history: Dict[str, List[Tuple[datetime, str]]] = {}  # (时间, 错误类型)
        self._error_types: Dict[
            str, Dict[str, int]
        ] = {}  # adapter_id -> {error_type: count}

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """检查错误率"""
        try:
            # 初始化记录
            if adapter_id not in self._error_counts:
                self._error_counts[adapter_id] = 0
                self._total_counts[adapter_id] = 0
                self._error_history[adapter_id] = []
                self._error_types[adapter_id] = {}

            # 尝试获取适配器的错误统计
            current_errors = 0
            current_total = 1
            error_details = {}

            try:
                # 检查适配器是否有错误统计方法
                if hasattr(registration.adapter_class, "get_error_stats"):
                    stats = await registration.adapter_class.get_error_stats()
                    if isinstance(stats, dict):
                        current_errors = stats.get("error_count", 0)
                        current_total = stats.get("total_count", 1)
                        error_details = stats.get("error_details", {})

                # 检查适配器健康状态来推断错误
                elif hasattr(registration.adapter_class, "health_check"):
                    try:
                        health_result = await registration.adapter_class.health_check()
                        if not health_result:
                            current_errors = 1
                            error_details["health_check_failed"] = 1
                    except Exception as e:
                        current_errors = 1
                        error_details[type(e).__name__] = 1

                # 尝试执行简单操作来检测错误
                else:
                    test_operations = ["ping", "status", "__init__"]
                    for op in test_operations:
                        if hasattr(registration.adapter_class, op):
                            try:
                                if asyncio.iscoroutinefunction(
                                    getattr(registration.adapter_class, op)
                                ):
                                    await getattr(registration.adapter_class, op)()
                                else:
                                    getattr(registration.adapter_class, op)()
                                current_total += 1
                            except Exception as e:
                                current_errors += 1
                                current_total += 1
                                error_type = type(e).__name__
                                error_details[error_type] = (
                                    error_details.get(error_type, 0) + 1
                                )

            except Exception as e:
                current_errors = 1
                error_details["monitor_error"] = str(e)

            # 更新统计
            self._error_counts[adapter_id] += current_errors
            self._total_counts[adapter_id] += current_total

            # 记录错误历史
            current_time = datetime.now(timezone.utc)
            if current_errors > 0:
                for error_type, count in error_details.items():
                    for _ in range(count):
                        self._error_history[adapter_id].append(
                            (current_time, error_type)
                        )
                        self._error_types[adapter_id][error_type] = (
                            self._error_types[adapter_id].get(error_type, 0) + count
                        )

            # 清理旧历史（保留最近24小时）
            cutoff_time = current_time - timedelta(hours=24)
            self._error_history[adapter_id] = [
                (time, error_type)
                for time, error_type in self._error_history[adapter_id]
                if time >= cutoff_time
            ]

            # 计算各种错误率指标
            total_operations = self._total_counts[adapter_id]
            total_errors = self._error_counts[adapter_id]

            # 整体错误率
            overall_error_rate = (
                total_errors / total_operations if total_operations > 0 else 0.0
            )

            # 最近1小时错误率
            recent_cutoff = current_time - timedelta(hours=1)
            recent_errors = [
                error
                for time, error in self._error_history[adapter_id]
                if time >= recent_cutoff
            ]
            recent_error_rate = (
                len(recent_errors) / max(1, total_operations)
                if total_operations > 0
                else 0.0
            )

            # 错误增长趋势
            last_hour_errors = len(
                [
                    error
                    for time, error in self._error_history[adapter_id]
                    if time >= current_time - timedelta(hours=1)
                ]
            )
            prev_hour_errors = len(
                [
                    error
                    for time, error in self._error_history[adapter_id]
                    if current_time - timedelta(hours=2)
                    <= time
                    < current_time - timedelta(hours=1)
                ]
            )

            error_trend = 0.0
            if prev_hour_errors > 0:
                error_trend = (
                    (last_hour_errors - prev_hour_errors) / prev_hour_errors
                ) * 100

            metrics = [
                HealthMetric(
                    name="error_rate",
                    type=HealthMetricType.ERROR_RATE,
                    value=overall_error_rate,
                    unit="ratio",
                    metadata={
                        "error_count": total_errors,
                        "total_count": total_operations,
                    },
                ),
                HealthMetric(
                    name="recent_error_rate",
                    type=HealthMetricType.ERROR_RATE,
                    value=recent_error_rate,
                    unit="ratio",
                    metadata={
                        "recent_errors": len(recent_errors),
                        "time_window": "1_hour",
                    },
                ),
                HealthMetric(
                    name="error_trend",
                    type=HealthMetricType.ERROR_RATE,
                    value=error_trend,
                    unit="percent",
                    metadata={
                        "last_hour_errors": last_hour_errors,
                        "prev_hour_errors": prev_hour_errors,
                    },
                ),
            ]

            # 添加错误类型分布
            if self._error_types[adapter_id]:
                most_common_error = max(
                    self._error_types[adapter_id].items(), key=lambda x: x[1]
                )
                metrics.append(
                    HealthMetric(
                        name="most_common_error",
                        type=HealthMetricType.ERROR_RATE,
                        value=most_common_error[1],
                        unit="count",
                        metadata={
                            "error_type": most_common_error[0],
                            "all_error_types": dict(self._error_types[adapter_id]),
                        },
                    )
                )

            # 错误稳定性评分
            stability_score = self._calculate_stability_score(
                overall_error_rate, recent_error_rate, error_trend
            )
            metrics.append(
                HealthMetric(
                    name="stability_score",
                    type=HealthMetricType.PERFORMANCE,
                    value=stability_score,
                    unit="score",
                    metadata={"scale": "0-100, higher is better"},
                )
            )

            return metrics

        except Exception as e:
            logger.error(f"Error rate check failed for adapter '{adapter_id}': {e}")
            return []

    def _calculate_stability_score(
        self, overall_rate: float, recent_rate: float, trend: float
    ) -> float:
        """计算稳定性分数"""
        base_score = 100.0

        # 根据总体错误率扣分
        if overall_rate > 0.1:  # 10%以上错误率
            base_score -= 50
        elif overall_rate > 0.05:  # 5%以上错误率
            base_score -= 30
        elif overall_rate > 0.01:  # 1%以上错误率
            base_score -= 15

        # 根据最近错误率扣分
        if recent_rate > overall_rate * 2:  # 最近错误率是总体的2倍以上
            base_score -= 20

        # 根据趋势扣分
        if trend > 50:  # 错误增长超过50%
            base_score -= 15
        elif trend > 20:  # 错误增长超过20%
            base_score -= 10

        return max(0.0, base_score)


class MemoryUsageMonitor(HealthMonitor):
    """内存使用监控器"""

    def __init__(self):
        super().__init__("memory_usage", interval=60.0)
        self._memory_history: Dict[str, List[float]] = {}

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """检查内存使用"""
        try:
            import psutil
            import gc
            import sys

            # 初始化历史记录
            if adapter_id not in self._memory_history:
                self._memory_history[adapter_id] = []

            # 获取系统内存信息
            system_memory = psutil.virtual_memory()
            process = psutil.Process()
            process_memory = process.memory_info()

            # 获取适配器相关内存（估算）
            adapter_memory_mb = 0.0
            if hasattr(registration.adapter_class, "get_memory_usage"):
                try:
                    adapter_memory_mb = (
                        await registration.adapter_class.get_memory_usage()
                    )
                except:
                    # fallback to estimation
                    adapter_memory_mb = sys.getsizeof(registration.adapter_class) / (
                        1024 * 1024
                    )
            else:
                # 估算适配器内存使用
                try:
                    # 触发垃圾回收获得更准确的内存状态
                    gc.collect()

                    # 简单估算：适配器类大小
                    adapter_memory_mb = sys.getsizeof(registration.adapter_class) / (
                        1024 * 1024
                    )

                    # 如果有实例，加上实例大小
                    if hasattr(registration, "instance") and registration.instance:
                        adapter_memory_mb += sys.getsizeof(registration.instance) / (
                            1024 * 1024
                        )

                except Exception:
                    adapter_memory_mb = 1.0  # 默认估算1MB

            # 更新历史记录
            self._memory_history[adapter_id].append(adapter_memory_mb)
            if len(self._memory_history[adapter_id]) > 100:
                self._memory_history[adapter_id].pop(0)

            # 计算趋势
            memory_trend = 0.0
            if len(self._memory_history[adapter_id]) >= 10:
                recent_avg = statistics.mean(self._memory_history[adapter_id][-5:])
                older_avg = statistics.mean(self._memory_history[adapter_id][-10:-5])
                if older_avg > 0:
                    memory_trend = ((recent_avg - older_avg) / older_avg) * 100

            metrics = [
                HealthMetric(
                    name="adapter_memory_usage",
                    type=HealthMetricType.MEMORY_USAGE,
                    value=adapter_memory_mb,
                    unit="MB",
                ),
                HealthMetric(
                    name="system_memory_usage",
                    type=HealthMetricType.MEMORY_USAGE,
                    value=system_memory.percent,
                    unit="percent",
                    metadata={
                        "available_gb": system_memory.available / (1024**3),
                        "total_gb": system_memory.total / (1024**3),
                    },
                ),
                HealthMetric(
                    name="process_memory_usage",
                    type=HealthMetricType.MEMORY_USAGE,
                    value=process_memory.rss / (1024**2),  # MB
                    unit="MB",
                ),
                HealthMetric(
                    name="memory_trend",
                    type=HealthMetricType.MEMORY_USAGE,
                    value=memory_trend,
                    unit="percent",
                    metadata={"sample_size": len(self._memory_history[adapter_id])},
                ),
            ]

            # 内存效率评分
            efficiency_score = self._calculate_memory_efficiency_score(
                adapter_memory_mb, system_memory.percent, memory_trend
            )
            metrics.append(
                HealthMetric(
                    name="memory_efficiency_score",
                    type=HealthMetricType.PERFORMANCE,
                    value=efficiency_score,
                    unit="score",
                    metadata={"scale": "0-100, higher is better"},
                )
            )

            return metrics

        except ImportError:
            logger.warning(
                f"psutil not available for memory monitoring of adapter '{adapter_id}'"
            )
            return []
        except Exception as e:
            logger.error(f"Memory usage check failed for adapter '{adapter_id}': {e}")
            return []

    def _calculate_memory_efficiency_score(
        self, adapter_memory: float, system_usage: float, trend: float
    ) -> float:
        """计算内存效率分数"""
        score = 100.0

        # 根据适配器内存使用扣分
        if adapter_memory > 100:  # 100MB以上
            score -= 30
        elif adapter_memory > 50:  # 50MB以上
            score -= 15
        elif adapter_memory > 20:  # 20MB以上
            score -= 5

        # 根据系统内存使用扣分
        if system_usage > 90:
            score -= 20
        elif system_usage > 80:
            score -= 10

        # 根据内存增长趋势扣分
        if trend > 20:  # 内存增长超过20%
            score -= 15
        elif trend > 10:  # 内存增长超过10%
            score -= 10

        return max(0.0, score)


class ThroughputMonitor(HealthMonitor):
    """吞吐量监控器"""

    def __init__(self):
        super().__init__("throughput", interval=90.0)
        self._request_counts: Dict[str, List[Tuple[datetime, int]]] = {}

    async def check_health(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> List[HealthMetric]:
        """检查吞吐量"""
        try:
            # 初始化记录
            if adapter_id not in self._request_counts:
                self._request_counts[adapter_id] = []

            current_time = datetime.now(timezone.utc)
            current_requests = 0

            # 尝试获取适配器的吞吐量统计
            if hasattr(registration.adapter_class, "get_throughput_stats"):
                try:
                    stats = await registration.adapter_class.get_throughput_stats()
                    current_requests = stats.get("request_count", 0)
                except Exception:
                    pass

            # 如果没有统计，尝试估算
            if current_requests == 0:
                # 这里可以通过其他方式估算吞吐量，比如通过代理模式记录
                current_requests = 1  # 假设的基准值

            # 记录当前数据点
            self._request_counts[adapter_id].append((current_time, current_requests))

            # 清理旧数据（保留最近1小时）
            cutoff_time = current_time - timedelta(hours=1)
            self._request_counts[adapter_id] = [
                (time, count)
                for time, count in self._request_counts[adapter_id]
                if time >= cutoff_time
            ]

            # 计算吞吐量指标
            if len(self._request_counts[adapter_id]) >= 2:
                # 计算每分钟请求数
                time_span = (
                    self._request_counts[adapter_id][-1][0]
                    - self._request_counts[adapter_id][0][0]
                ).total_seconds()
                total_requests = sum(
                    count for _, count in self._request_counts[adapter_id]
                )

                requests_per_minute = (total_requests / max(time_span, 1)) * 60
                requests_per_second = total_requests / max(time_span, 1)

                # 计算趋势
                if len(self._request_counts[adapter_id]) >= 6:  # 至少6个数据点
                    recent_data = self._request_counts[adapter_id][-3:]
                    older_data = self._request_counts[adapter_id][-6:-3]

                    recent_avg = statistics.mean(count for _, count in recent_data)
                    older_avg = statistics.mean(count for _, count in older_data)

                    throughput_trend = 0.0
                    if older_avg > 0:
                        throughput_trend = ((recent_avg - older_avg) / older_avg) * 100
                else:
                    throughput_trend = 0.0

                metrics = [
                    HealthMetric(
                        name="requests_per_second",
                        type=HealthMetricType.THROUGHPUT,
                        value=requests_per_second,
                        unit="req/s",
                    ),
                    HealthMetric(
                        name="requests_per_minute",
                        type=HealthMetricType.THROUGHPUT,
                        value=requests_per_minute,
                        unit="req/min",
                    ),
                    HealthMetric(
                        name="throughput_trend",
                        type=HealthMetricType.THROUGHPUT,
                        value=throughput_trend,
                        unit="percent",
                        metadata={"sample_size": len(self._request_counts[adapter_id])},
                    ),
                ]

                # 吞吐量评分
                performance_score = self._calculate_throughput_score(
                    requests_per_second, throughput_trend
                )
                metrics.append(
                    HealthMetric(
                        name="throughput_score",
                        type=HealthMetricType.PERFORMANCE,
                        value=performance_score,
                        unit="score",
                        metadata={"scale": "0-100, higher is better"},
                    )
                )

                return metrics
            else:
                return [
                    HealthMetric(
                        name="throughput_insufficient_data",
                        type=HealthMetricType.THROUGHPUT,
                        value=0.0,
                        unit="info",
                        metadata={
                            "message": "Insufficient data for throughput calculation"
                        },
                    )
                ]

        except Exception as e:
            logger.error(f"Throughput check failed for adapter '{adapter_id}': {e}")
            return []

    def _calculate_throughput_score(self, rps: float, trend: float) -> float:
        """计算吞吐量分数"""
        score = 50.0  # 基础分数

        # 根据每秒请求数加分
        if rps >= 100:
            score += 50
        elif rps >= 50:
            score += 40
        elif rps >= 20:
            score += 30
        elif rps >= 10:
            score += 20
        elif rps >= 1:
            score += 10

        # 根据趋势调整
        if trend > 0:
            score += min(10, trend / 10)  # 正向趋势最多加10分
        else:
            score += max(-20, trend / 5)  # 负向趋势最多扣20分

        return max(0.0, min(100.0, score))

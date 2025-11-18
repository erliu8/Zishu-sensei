"""
适配器指标服务

基于微服务架构的指标收集和管理服务，集成到适配器管理系统中。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult
from ..events import EventBus, Event, EventType
from ..types import AdapterIdentity, AdapterStatus
from ..metrics import (
    MetricsService,
    MetricsConfig,
    MetricsStorage,
    MetricsStorageManager,
    MemoryMetricsStorage,
    MetricsCollector,
    SystemMetricsCollector,
    AdapterMetricsCollector,
    MetricsAlertManager,
    AlertRule,
    AlertCondition,
    MetricsExporterManager,
    ExportConfig,
    ExportFormat,
    MetricsQueryEngine,
    MetricsDashboard,
    setup_metrics_system,
    teardown_metrics_system,
    set_global_metrics_service,
    clear_global_metrics_service,
)

logger = logging.getLogger(__name__)


@dataclass
class AdapterMetricsServiceConfig:
    """适配器指标服务配置"""

    # 存储配置
    storage_type: str = "memory"  # memory, file, redis, influxdb
    storage_config: Dict[str, Any] = None

    # 收集器配置
    enable_system_metrics: bool = True
    enable_adapter_metrics: bool = True
    enable_performance_metrics: bool = True
    collection_interval: int = 60  # 秒

    # 导出器配置
    enable_prometheus_export: bool = True
    prometheus_port: int = 8080
    enable_json_export: bool = False
    json_port: int = 8081

    # 告警配置
    enable_alerts: bool = True
    alert_channels: List[str] = None

    # 仪表板配置
    enable_dashboard: bool = True

    # 其他配置
    metrics_retention_days: int = 7
    max_metrics_per_adapter: int = 1000

    def __post_init__(self):
        if self.storage_config is None:
            self.storage_config = {}
        if self.alert_channels is None:
            self.alert_channels = ["log"]


class AdapterMetricsService(AsyncService):
    """适配器指标服务"""

    def __init__(self, event_bus: EventBus, config: Optional[Dict[str, Any]] = None):
        """初始化指标服务"""
        super().__init__(name="adapter_metrics", config=config)

        self.event_bus = event_bus
        self.config = AdapterMetricsServiceConfig(**config or {})

        # 核心组件
        self.metrics_service: Optional[MetricsService] = None
        self.exporter_manager: Optional[MetricsExporterManager] = None
        self.alert_manager: Optional[MetricsAlertManager] = None
        self.dashboard: Optional[MetricsDashboard] = None

        # 适配器跟踪
        self.tracked_adapters: Set[str] = set()
        self.adapter_collectors: Dict[str, AdapterMetricsCollector] = {}

        # 统计信息
        self.metrics_collected = 0
        self.alerts_triggered = 0
        self.last_collection_time: Optional[datetime] = None

        logger.info(f"AdapterMetricsService initialized with config: {self.config}")

    async def _initialize_impl(self) -> None:
        """初始化实现"""
        # 初始化逻辑在启动时执行
        pass

    async def _start_impl(self) -> None:
        """启动指标服务"""
        try:
            logger.info("Starting AdapterMetricsService...")

            # 设置指标系统
            metrics_config = MetricsConfig(
                storage_type=self.config.storage_type,
                storage_config=self.config.storage_config,
                enable_system_metrics=self.config.enable_system_metrics,
                enable_adapter_metrics=self.config.enable_adapter_metrics,
                enable_performance_metrics=self.config.enable_performance_metrics,
                collection_interval=self.config.collection_interval,
                enable_alerts=self.config.enable_alerts,
                alert_channels=self.config.alert_channels,
                enable_dashboard=self.config.enable_dashboard,
            )

            self.metrics_service = await setup_metrics_system(metrics_config)

            # 设置导出器（暂时禁用以避免端口冲突）
            # if self.config.enable_prometheus_export or self.config.enable_json_export:
            #     await self._setup_exporters()

            # 设置告警管理器（暂时禁用）
            # if self.config.enable_alerts:
            #     await self._setup_alerts()

            # 设置仪表板（暂时禁用）
            # if self.config.enable_dashboard:
            #     await self._setup_dashboard()

            # 注册事件处理器（暂时禁用）
            # await self._register_event_handlers()

            # 启动后台任务（暂时禁用）
            # asyncio.create_task(self._metrics_cleanup_task())

            logger.info("AdapterMetricsService started successfully")

        except Exception as e:
            logger.error(f"Failed to start AdapterMetricsService: {e}")
            raise

    async def _stop_impl(self) -> None:
        """停止指标服务"""
        try:
            logger.info("Stopping AdapterMetricsService...")

            # 停止导出器
            if self.exporter_manager:
                await self.exporter_manager.stop_all_servers()

            # 停止告警管理器
            if self.alert_manager:
                await self.alert_manager.stop()

            # 停止指标服务
            if self.metrics_service:
                await teardown_metrics_system(self.metrics_service)
                self.metrics_service = None

            # 清理资源
            self.tracked_adapters.clear()
            self.adapter_collectors.clear()

            logger.info("AdapterMetricsService stopped successfully")

        except Exception as e:
            logger.error(f"Failed to stop AdapterMetricsService: {e}")
            raise

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查"""
        try:
            if not self.metrics_service:
                return HealthCheckResult(
                    service_name=self.name,
                    is_healthy=False,
                    message="Metrics service not initialized",
                )

            # 检查指标服务状态
            service_status = self.metrics_service.get_status()
            if not service_status.get("running", False):
                return HealthCheckResult(
                    service_name=self.name,
                    is_healthy=False,
                    message="Metrics service not running",
                )

            # 检查最近是否有指标收集
            if self.last_collection_time:
                time_since_last = datetime.now(timezone.utc) - self.last_collection_time
                if time_since_last > timedelta(minutes=5):
                    return HealthCheckResult(
                        service_name=self.name,
                        is_healthy=False,
                        message=f"No metrics collected for {time_since_last.total_seconds()}s",
                    )

            return HealthCheckResult(
                service_name=self.name,
                is_healthy=True,
                message=f"Tracking {len(self.tracked_adapters)} adapters, {self.metrics_collected} metrics collected",
            )

        except Exception as e:
            return HealthCheckResult(
                service_name=self.name,
                is_healthy=False,
                message=f"Health check failed: {e}",
            )

    async def _setup_exporters(self) -> None:
        """设置导出器"""
        if not self.metrics_service:
            return

        storage = self.metrics_service.storage_manager.get_primary_storage()
        if not storage:
            logger.warning("No primary storage available for exporters")
            return

        self.exporter_manager = MetricsExporterManager(storage)

        # Prometheus导出器
        if self.config.enable_prometheus_export:
            prometheus_config = ExportConfig(
                format=ExportFormat.PROMETHEUS,
                port=self.config.prometheus_port,
                endpoint="/metrics",
                include_metrics=None,  # 导出所有指标
                cache_ttl=30,
            )

            self.exporter_manager.create_exporter("prometheus", prometheus_config)
            await self.exporter_manager.start_http_server("prometheus")

            logger.info(
                f"Prometheus exporter started on port {self.config.prometheus_port}"
            )

        # JSON导出器
        if self.config.enable_json_export:
            json_config = ExportConfig(
                format=ExportFormat.JSON,
                port=self.config.json_port,
                endpoint="/metrics.json",
                cache_ttl=30,
            )

            self.exporter_manager.create_exporter("json", json_config)
            await self.exporter_manager.start_http_server("json")

            logger.info(f"JSON exporter started on port {self.config.json_port}")

    async def _setup_alerts(self) -> None:
        """设置告警管理器"""
        if not self.metrics_service:
            return

        storage = self.metrics_service.storage_manager.get_primary_storage()
        if not storage:
            logger.warning("No primary storage available for alerts")
            return

        query_engine = MetricsQueryEngine(storage)
        self.alert_manager = MetricsAlertManager(query_engine)

        # 创建默认告警规则
        await self._create_default_alert_rules()

        # 启动告警管理器
        await self.alert_manager.start()

        logger.info("Alert manager started with default rules")

    async def _create_default_alert_rules(self) -> None:
        """创建默认告警规则"""
        if not self.alert_manager:
            return

        # 高CPU使用率告警
        cpu_rule = AlertRule(
            name="high_cpu_usage",
            description="High CPU usage detected",
            condition=AlertCondition(
                metric_name="system_cpu_usage",
                operator="gt",
                threshold=80.0,
                duration_minutes=5,
            ),
            severity="warning",
            channels=self.config.alert_channels,
        )

        # 高内存使用率告警
        memory_rule = AlertRule(
            name="high_memory_usage",
            description="High memory usage detected",
            condition=AlertCondition(
                metric_name="system_memory_usage",
                operator="gt",
                threshold=85.0,
                duration_minutes=5,
            ),
            severity="warning",
            channels=self.config.alert_channels,
        )

        # 适配器错误率告警
        error_rule = AlertRule(
            name="high_adapter_error_rate",
            description="High adapter error rate detected",
            condition=AlertCondition(
                metric_name="adapter_error_rate",
                operator="gt",
                threshold=10.0,
                duration_minutes=3,
            ),
            severity="critical",
            channels=self.config.alert_channels,
        )

        # 适配器响应时间告警
        latency_rule = AlertRule(
            name="high_adapter_latency",
            description="High adapter response time detected",
            condition=AlertCondition(
                metric_name="adapter_response_time",
                operator="gt",
                threshold=5.0,
                duration_minutes=5,
            ),
            severity="warning",
            channels=self.config.alert_channels,
        )

        # 添加规则
        for rule in [cpu_rule, memory_rule, error_rule, latency_rule]:
            await self.alert_manager.add_rule(rule)

    async def _setup_dashboard(self) -> None:
        """设置仪表板"""
        if not self.metrics_service:
            return

        storage = self.metrics_service.storage_manager.get_primary_storage()
        if not storage:
            logger.warning("No primary storage available for dashboard")
            return

        query_engine = MetricsQueryEngine(storage)
        self.dashboard = MetricsDashboard(query_engine)

        # 创建默认仪表板
        self.dashboard.create_system_dashboard()
        self.dashboard.create_adapter_dashboard()

        logger.info("Dashboard initialized with default views")

    async def _register_event_handlers(self) -> None:
        """注册事件处理器"""
        # 适配器注册事件
        await self.event_bus.subscribe(
            EventType.ADAPTER_REGISTERED, self._handle_adapter_registered
        )

        # 适配器注销事件
        await self.event_bus.subscribe(
            EventType.ADAPTER_UNREGISTERED, self._handle_adapter_unregistered
        )

        # 适配器启动事件
        await self.event_bus.subscribe(
            EventType.ADAPTER_STARTED, self._handle_adapter_started
        )

        # 适配器停止事件
        await self.event_bus.subscribe(
            EventType.ADAPTER_STOPPED, self._handle_adapter_stopped
        )

        # 适配器错误事件
        await self.event_bus.subscribe(
            EventType.ADAPTER_ERROR, self._handle_adapter_error
        )

        logger.info("Event handlers registered")

    async def _handle_adapter_registered(self, event: Event) -> None:
        """处理适配器注册事件"""
        try:
            adapter_id = event.data.get("adapter_id")
            if adapter_id:
                logger.info(f"Adapter registered: {adapter_id}")
                # 这里可以添加特定的指标收集逻辑

        except Exception as e:
            logger.error(f"Failed to handle adapter registered event: {e}")

    async def _handle_adapter_unregistered(self, event: Event) -> None:
        """处理适配器注销事件"""
        try:
            adapter_id = event.data.get("adapter_id")
            if adapter_id and adapter_id in self.tracked_adapters:
                await self.stop_tracking_adapter(adapter_id)
                logger.info(f"Stopped tracking adapter: {adapter_id}")

        except Exception as e:
            logger.error(f"Failed to handle adapter unregistered event: {e}")

    async def _handle_adapter_started(self, event: Event) -> None:
        """处理适配器启动事件"""
        try:
            adapter_id = event.data.get("adapter_id")
            if adapter_id:
                await self.start_tracking_adapter(adapter_id)
                logger.info(f"Started tracking adapter: {adapter_id}")

        except Exception as e:
            logger.error(f"Failed to handle adapter started event: {e}")

    async def _handle_adapter_stopped(self, event: Event) -> None:
        """处理适配器停止事件"""
        try:
            adapter_id = event.data.get("adapter_id")
            if adapter_id and adapter_id in self.tracked_adapters:
                await self.stop_tracking_adapter(adapter_id)
                logger.info(f"Stopped tracking adapter: {adapter_id}")

        except Exception as e:
            logger.error(f"Failed to handle adapter stopped event: {e}")

    async def _handle_adapter_error(self, event: Event) -> None:
        """处理适配器错误事件"""
        try:
            adapter_id = event.data.get("adapter_id")
            error_msg = event.data.get("error", "Unknown error")

            if adapter_id:
                # 记录错误指标
                await self._record_adapter_error(adapter_id, error_msg)
                logger.warning(f"Adapter error recorded: {adapter_id} - {error_msg}")

        except Exception as e:
            logger.error(f"Failed to handle adapter error event: {e}")

    async def start_tracking_adapter(self, adapter_id: str) -> bool:
        """开始跟踪适配器"""
        try:
            if adapter_id in self.tracked_adapters:
                logger.warning(f"Adapter {adapter_id} is already being tracked")
                return True

            # 创建适配器特定的指标收集器
            collector = AdapterMetricsCollector(
                adapter_id=adapter_id,
                collection_interval=self.config.collection_interval,
            )

            # 注册收集器到指标服务
            if self.metrics_service:
                self.metrics_service.register_collector(collector)
                await collector.start()

            self.tracked_adapters.add(adapter_id)
            self.adapter_collectors[adapter_id] = collector

            logger.info(f"Started tracking adapter: {adapter_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to start tracking adapter {adapter_id}: {e}")
            return False

    async def stop_tracking_adapter(self, adapter_id: str) -> bool:
        """停止跟踪适配器"""
        try:
            if adapter_id not in self.tracked_adapters:
                logger.warning(f"Adapter {adapter_id} is not being tracked")
                return True

            # 停止并移除收集器
            if adapter_id in self.adapter_collectors:
                collector = self.adapter_collectors[adapter_id]
                await collector.stop()

                if self.metrics_service:
                    self.metrics_service.unregister_collector(collector)

                del self.adapter_collectors[adapter_id]

            self.tracked_adapters.remove(adapter_id)

            logger.info(f"Stopped tracking adapter: {adapter_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to stop tracking adapter {adapter_id}: {e}")
            return False

    async def _record_adapter_error(self, adapter_id: str, error_msg: str) -> None:
        """记录适配器错误"""
        if not self.metrics_service:
            return

        try:
            from ..metrics.utils import record_counter

            # 记录错误计数
            record_counter(
                "adapter_errors_total",
                1,
                labels={"adapter_id": adapter_id, "error_type": "runtime_error"},
                description="Total adapter errors",
            )

            self.metrics_collected += 1
            self.last_collection_time = datetime.now(timezone.utc)

        except Exception as e:
            logger.error(f"Failed to record adapter error: {e}")

    async def _metrics_cleanup_task(self) -> None:
        """指标清理任务"""
        while self.is_running:
            try:
                await asyncio.sleep(3600)  # 每小时运行一次

                if self.metrics_service:
                    # 清理过期指标
                    cutoff_time = datetime.now(timezone.utc) - timedelta(
                        days=self.config.metrics_retention_days
                    )

                    storage = self.metrics_service.storage_manager.get_primary_storage()
                    if storage and hasattr(storage, "cleanup_old_metrics"):
                        await storage.cleanup_old_metrics(cutoff_time)
                        logger.info(
                            f"Cleaned up metrics older than {self.config.metrics_retention_days} days"
                        )

            except Exception as e:
                logger.error(f"Metrics cleanup task failed: {e}")

    # ================================
    # 公共API方法
    # ================================

    async def get_adapter_metrics(
        self,
        adapter_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取适配器指标"""
        if not self.metrics_service:
            return {}

        try:
            # 设置默认时间范围
            if not end_time:
                end_time = datetime.now(timezone.utc)
            if not start_time:
                start_time = end_time - timedelta(hours=1)

            storage = self.metrics_service.storage_manager.get_primary_storage()
            if not storage:
                return {}

            # 查询适配器相关指标
            metrics = await storage.read_metrics(
                names=None,  # 所有指标
                start_time=start_time,
                end_time=end_time,
                labels={"adapter_id": adapter_id},
                limit=self.config.max_metrics_per_adapter,
            )

            # 转换为字典格式
            result = {}
            for family in metrics:
                result[family.name] = {
                    "type": family.metric_type.value,
                    "description": family.description,
                    "unit": family.unit,
                    "metrics": [
                        metric.to_dict() for metric in family.get_all_metrics()
                    ],
                }

            return result

        except Exception as e:
            logger.error(f"Failed to get adapter metrics for {adapter_id}: {e}")
            return {}

    async def get_system_metrics_summary(self) -> Dict[str, Any]:
        """获取系统指标摘要"""
        try:
            summary = {
                "service_status": self.status.value,
                "tracked_adapters": len(self.tracked_adapters),
                "metrics_collected": self.metrics_collected,
                "alerts_triggered": self.alerts_triggered,
                "last_collection_time": self.last_collection_time.isoformat()
                if self.last_collection_time
                else None,
                "exporters": {},
                "alerts": {},
            }

            # 导出器状态
            if self.exporter_manager:
                summary["exporters"] = self.exporter_manager.get_stats()

            # 告警状态
            if self.alert_manager:
                summary["alerts"] = self.alert_manager.get_status()

            # 指标服务状态
            if self.metrics_service:
                summary["metrics_service"] = self.metrics_service.get_status()

            return summary

        except Exception as e:
            logger.error(f"Failed to get system metrics summary: {e}")
            return {"error": str(e)}

    async def create_custom_alert_rule(self, rule: AlertRule) -> bool:
        """创建自定义告警规则"""
        if not self.alert_manager:
            logger.warning("Alert manager not available")
            return False

        try:
            await self.alert_manager.add_rule(rule)
            logger.info(f"Created custom alert rule: {rule.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create alert rule {rule.name}: {e}")
            return False

    async def remove_alert_rule(self, rule_name: str) -> bool:
        """移除告警规则"""
        if not self.alert_manager:
            logger.warning("Alert manager not available")
            return False

        try:
            await self.alert_manager.remove_rule(rule_name)
            logger.info(f"Removed alert rule: {rule_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to remove alert rule {rule_name}: {e}")
            return False

    async def get_dashboard_data(self, dashboard_name: str) -> Optional[Dict[str, Any]]:
        """获取仪表板数据"""
        if not self.dashboard:
            logger.warning("Dashboard not available")
            return None

        try:
            return await self.dashboard.get_dashboard_data(dashboard_name)

        except Exception as e:
            logger.error(f"Failed to get dashboard data for {dashboard_name}: {e}")
            return None

    async def export_metrics(self, format: str = "prometheus") -> Optional[str]:
        """导出指标"""
        if not self.exporter_manager:
            logger.warning("Exporter manager not available")
            return None

        try:
            exporter = self.exporter_manager.get_exporter(format)
            if not exporter:
                logger.warning(f"Exporter not found: {format}")
                return None

            return await exporter.get_metrics_data()

        except Exception as e:
            logger.error(f"Failed to export metrics in {format} format: {e}")
            return None

    def get_tracked_adapters(self) -> List[str]:
        """获取被跟踪的适配器列表"""
        return list(self.tracked_adapters)

    def get_service_stats(self) -> Dict[str, Any]:
        """获取服务统计信息"""
        return {
            "service_name": self.name,
            "status": self.status.value,
            "tracked_adapters": len(self.tracked_adapters),
            "active_collectors": len(self.adapter_collectors),
            "metrics_collected": self.metrics_collected,
            "alerts_triggered": self.alerts_triggered,
            "last_collection_time": self.last_collection_time.isoformat()
            if self.last_collection_time
            else None,
            "config": self.config.__dict__,
        }

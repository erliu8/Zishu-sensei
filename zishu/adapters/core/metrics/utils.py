"""
指标系统工具函数和便捷接口

提供简化的API和实用工具函数。
"""

import asyncio
import logging
import time
import functools
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Union, Callable, TypeVar, Generic
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
import threading

from .core import (
    Metric,
    MetricFamily,
    MetricSample,
    MetricType,
    AggregationType,
    AdapterMetricsService,
)

# 类型别名，用于向后兼容
MetricsService = AdapterMetricsService
from .collectors import (
    SystemMetricsCollector,
    AdapterMetricsCollector,
)
from .storage import MetricsStorage, MetricsStorageManager, MemoryMetricsStorage
from .dashboard import MetricsQuery, QueryBuilder, MetricsQueryEngine, MetricsDashboard
from .alerts import AlertRule, AlertCondition, MetricsAlertManager

logger = logging.getLogger(__name__)

# 类型变量
T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


# ================================
# 装饰器工具
# ================================


def track_execution_time(
    metric_name: str = "execution_time", labels: Optional[Dict[str, str]] = None
):
    """
    装饰器：跟踪函数执行时间

    Args:
        metric_name: 指标名称
        labels: 额外标签
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                success = True
                error = None
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                execution_time = time.time() - start_time

                # 构建标签
                metric_labels = {
                    "function": func.__name__,
                    "module": func.__module__,
                    "success": str(success),
                }
                if labels:
                    metric_labels.update(labels)
                if error:
                    metric_labels["error"] = error[:100]  # 限制错误信息长度

                # 记录指标
                sample = MetricSample(
                    value=execution_time,
                    timestamp=datetime.now(timezone.utc),
                    labels=metric_labels,
                )

                # 获取全局指标服务并记录
                global_service = get_global_metrics_service()
                if global_service:
                    metric = Metric(
                        name=metric_name,
                        metric_type=MetricType.HISTOGRAM,
                        description=f"Execution time for {func.__name__}",
                        unit="seconds",
                        labels=metric_labels,
                        samples=[sample],
                    )

                    family = MetricFamily(
                        name=metric_name,
                        metric_type=MetricType.HISTOGRAM,
                        description=f"Execution time for {func.__name__}",
                        unit="seconds",
                    )
                    family.add_metric(metric)

                    await global_service.record_metrics([family])

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                success = True
                error = None
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                execution_time = time.time() - start_time

                # 构建标签
                metric_labels = {
                    "function": func.__name__,
                    "module": func.__module__,
                    "success": str(success),
                }
                if labels:
                    metric_labels.update(labels)
                if error:
                    metric_labels["error"] = error[:100]

                # 记录指标
                sample = MetricSample(
                    value=execution_time,
                    timestamp=datetime.now(timezone.utc),
                    labels=metric_labels,
                )

                # 获取全局指标服务并记录
                global_service = get_global_metrics_service()
                if global_service:
                    metric = Metric(
                        name=metric_name,
                        metric_type=MetricType.HISTOGRAM,
                        description=f"Execution time for {func.__name__}",
                        unit="seconds",
                        labels=metric_labels,
                        samples=[sample],
                    )

                    family = MetricFamily(
                        name=metric_name,
                        metric_type=MetricType.HISTOGRAM,
                        description=f"Execution time for {func.__name__}",
                        unit="seconds",
                    )
                    family.add_metric(metric)

                    # 同步记录（在后台异步执行）
                    asyncio.create_task(global_service.record_metrics([family]))

            return result

        # 根据函数类型返回对应的包装器
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def count_calls(
    metric_name: str = "function_calls", labels: Optional[Dict[str, str]] = None
):
    """
    装饰器：统计函数调用次数

    Args:
        metric_name: 指标名称
        labels: 额外标签
    """

    def decorator(func: F) -> F:
        call_count = 0

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            try:
                result = await func(*args, **kwargs)
                success = True
                error = None
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                # 构建标签
                metric_labels = {
                    "function": func.__name__,
                    "module": func.__module__,
                    "success": str(success),
                }
                if labels:
                    metric_labels.update(labels)
                if error:
                    metric_labels["error"] = error[:100]

                # 记录指标
                sample = MetricSample(
                    value=1,  # 每次调用计数+1
                    timestamp=datetime.now(timezone.utc),
                    labels=metric_labels,
                )

                # 获取全局指标服务并记录
                global_service = get_global_metrics_service()
                if global_service:
                    metric = Metric(
                        name=metric_name,
                        metric_type=MetricType.COUNTER,
                        description=f"Call count for {func.__name__}",
                        labels=metric_labels,
                        samples=[sample],
                    )

                    family = MetricFamily(
                        name=metric_name,
                        metric_type=MetricType.COUNTER,
                        description=f"Call count for {func.__name__}",
                    )
                    family.add_metric(metric)

                    await global_service.record_metrics([family])

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            try:
                result = func(*args, **kwargs)
                success = True
                error = None
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                # 构建标签
                metric_labels = {
                    "function": func.__name__,
                    "module": func.__module__,
                    "success": str(success),
                }
                if labels:
                    metric_labels.update(labels)
                if error:
                    metric_labels["error"] = error[:100]

                # 记录指标
                sample = MetricSample(
                    value=1, timestamp=datetime.now(timezone.utc), labels=metric_labels
                )

                # 获取全局指标服务并记录
                global_service = get_global_metrics_service()
                if global_service:
                    metric = Metric(
                        name=metric_name,
                        metric_type=MetricType.COUNTER,
                        description=f"Call count for {func.__name__}",
                        labels=metric_labels,
                        samples=[sample],
                    )

                    family = MetricFamily(
                        name=metric_name,
                        metric_type=MetricType.COUNTER,
                        description=f"Call count for {func.__name__}",
                    )
                    family.add_metric(metric)

                    # 同步记录（在后台异步执行）
                    asyncio.create_task(global_service.record_metrics([family]))

            return result

        # 根据函数类型返回对应的包装器
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


@contextmanager
def timer_context(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """
    上下文管理器：测量代码块执行时间

    Args:
        metric_name: 指标名称
        labels: 标签

    Example:
        with timer_context("database_query", {"table": "users"}):
            # 执行数据库查询
            result = db.query("SELECT * FROM users")
    """
    start_time = time.time()

    try:
        yield
        success = True
        error = None
    except Exception as e:
        success = False
        error = str(e)
        raise
    finally:
        execution_time = time.time() - start_time

        # 构建标签
        metric_labels = {"success": str(success)}
        if labels:
            metric_labels.update(labels)
        if error:
            metric_labels["error"] = error[:100]

        # 记录指标
        sample = MetricSample(
            value=execution_time,
            timestamp=datetime.now(timezone.utc),
            labels=metric_labels,
        )

        # 获取全局指标服务并记录
        global_service = get_global_metrics_service()
        if global_service:
            metric = Metric(
                name=metric_name,
                metric_type=MetricType.HISTOGRAM,
                description=f"Execution time for {metric_name}",
                unit="seconds",
                labels=metric_labels,
                samples=[sample],
            )

            family = MetricFamily(
                name=metric_name,
                metric_type=MetricType.HISTOGRAM,
                description=f"Execution time for {metric_name}",
                unit="seconds",
            )
            family.add_metric(metric)

            # 同步记录（在后台异步执行）
            asyncio.create_task(global_service.record_metrics([family]))


# ================================
# 便捷记录函数
# ================================


def record_counter(
    name: str,
    value: float = 1,
    labels: Optional[Dict[str, str]] = None,
    description: str = "",
    unit: str = "",
) -> None:
    """
    记录计数器指标

    Args:
        name: 指标名称
        value: 计数值
        labels: 标签
        description: 描述
        unit: 单位
    """
    _record_metric(name, MetricType.COUNTER, value, labels, description, unit)


def record_gauge(
    name: str,
    value: float,
    labels: Optional[Dict[str, str]] = None,
    description: str = "",
    unit: str = "",
) -> None:
    """
    记录仪表盘指标

    Args:
        name: 指标名称
        value: 数值
        labels: 标签
        description: 描述
        unit: 单位
    """
    _record_metric(name, MetricType.GAUGE, value, labels, description, unit)


def record_histogram(
    name: str,
    value: float,
    labels: Optional[Dict[str, str]] = None,
    description: str = "",
    unit: str = "",
) -> None:
    """
    记录直方图指标

    Args:
        name: 指标名称
        value: 数值
        labels: 标签
        description: 描述
        unit: 单位
    """
    _record_metric(name, MetricType.HISTOGRAM, value, labels, description, unit)


def record_summary(
    name: str,
    value: float,
    labels: Optional[Dict[str, str]] = None,
    description: str = "",
    unit: str = "",
) -> None:
    """
    记录摘要指标

    Args:
        name: 指标名称
        value: 数值
        labels: 标签
        description: 描述
        unit: 单位
    """
    _record_metric(name, MetricType.SUMMARY, value, labels, description, unit)


def _record_metric(
    name: str,
    metric_type: MetricType,
    value: float,
    labels: Optional[Dict[str, str]],
    description: str,
    unit: str,
) -> None:
    """内部函数：记录指标"""
    sample = MetricSample(
        value=value, timestamp=datetime.now(timezone.utc), labels=labels or {}
    )

    metric = Metric(
        name=name,
        metric_type=metric_type,
        description=description,
        unit=unit,
        labels=labels or {},
        samples=[sample],
    )

    family = MetricFamily(
        name=name, metric_type=metric_type, description=description, unit=unit
    )
    family.add_metric(metric)

    # 获取全局指标服务并记录
    global_service = get_global_metrics_service()
    if global_service:
        # 同步记录（在后台异步执行）
        asyncio.create_task(global_service.record_metrics([family]))
    else:
        logger.warning(f"No global metrics service available to record metric: {name}")


# ================================
# 批量记录工具
# ================================


class MetricsBatch:
    """指标批量记录器"""

    def __init__(self):
        self.families: List[MetricFamily] = []
        self._families_dict: Dict[str, MetricFamily] = {}

    def counter(
        self,
        name: str,
        value: float = 1,
        labels: Optional[Dict[str, str]] = None,
        description: str = "",
        unit: str = "",
    ) -> "MetricsBatch":
        """添加计数器指标"""
        return self._add_metric(
            name, MetricType.COUNTER, value, labels, description, unit
        )

    def gauge(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        description: str = "",
        unit: str = "",
    ) -> "MetricsBatch":
        """添加仪表盘指标"""
        return self._add_metric(
            name, MetricType.GAUGE, value, labels, description, unit
        )

    def histogram(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        description: str = "",
        unit: str = "",
    ) -> "MetricsBatch":
        """添加直方图指标"""
        return self._add_metric(
            name, MetricType.HISTOGRAM, value, labels, description, unit
        )

    def summary(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        description: str = "",
        unit: str = "",
    ) -> "MetricsBatch":
        """添加摘要指标"""
        return self._add_metric(
            name, MetricType.SUMMARY, value, labels, description, unit
        )

    def _add_metric(
        self,
        name: str,
        metric_type: MetricType,
        value: float,
        labels: Optional[Dict[str, str]],
        description: str,
        unit: str,
    ) -> "MetricsBatch":
        """添加指标到批次"""
        sample = MetricSample(
            value=value, timestamp=datetime.now(timezone.utc), labels=labels or {}
        )

        # 获取或创建指标族
        if name in self._families_dict:
            family = self._families_dict[name]
        else:
            family = MetricFamily(
                name=name, metric_type=metric_type, description=description, unit=unit
            )
            self._families_dict[name] = family
            self.families.append(family)

        # 创建指标
        metric = Metric(
            name=name,
            metric_type=metric_type,
            description=description,
            unit=unit,
            labels=labels or {},
            samples=[sample],
        )

        family.add_metric(metric)
        return self

    async def record(self) -> bool:
        """记录所有指标"""
        if not self.families:
            return True

        global_service = get_global_metrics_service()
        if global_service:
            return await global_service.record_metrics(self.families)
        else:
            logger.warning(
                "No global metrics service available to record batch metrics"
            )
            return False

    def clear(self) -> None:
        """清空批次"""
        self.families.clear()
        self._families_dict.clear()


def create_batch() -> MetricsBatch:
    """创建指标批次"""
    return MetricsBatch()


# ================================
# 全局服务管理
# ================================

_global_metrics_service: Optional[MetricsService] = None
_global_service_lock = threading.Lock()


def set_global_metrics_service(service: MetricsService) -> None:
    """设置全局指标服务"""
    global _global_metrics_service
    with _global_service_lock:
        _global_metrics_service = service


def get_global_metrics_service() -> Optional[MetricsService]:
    """获取全局指标服务"""
    global _global_metrics_service
    with _global_service_lock:
        return _global_metrics_service


def clear_global_metrics_service() -> None:
    """清除全局指标服务"""
    global _global_metrics_service
    with _global_service_lock:
        _global_metrics_service = None


# ================================
# 快速配置工具
# ================================


@dataclass
class MetricsConfig:
    """指标系统配置"""

    # 存储配置
    storage_type: str = "memory"  # memory, file, redis, influxdb
    storage_config: Dict[str, Any] = None

    # 收集器配置
    enable_system_metrics: bool = True
    enable_adapter_metrics: bool = True
    enable_performance_metrics: bool = True
    collection_interval: int = 60  # 秒

    # 告警配置
    enable_alerts: bool = False
    alert_channels: List[str] = None

    # 仪表板配置
    enable_dashboard: bool = False

    def __post_init__(self):
        if self.storage_config is None:
            self.storage_config = {}
        if self.alert_channels is None:
            self.alert_channels = []


async def setup_metrics_system(config: MetricsConfig) -> MetricsService:
    """
    快速设置指标系统

    Args:
        config: 指标系统配置

    Returns:
        配置好的指标服务
    """
    # 创建存储
    storage_manager = MetricsStorageManager()

    if config.storage_type == "memory":
        storage = MemoryMetricsStorage(config.storage_config)
    elif config.storage_type == "file":
        from .storage import FileMetricsStorage

        storage = FileMetricsStorage(config.storage_config)
    elif config.storage_type == "redis":
        from .storage import RedisMetricsStorage

        storage = RedisMetricsStorage(config.storage_config)
    elif config.storage_type == "influxdb":
        from .storage import InfluxDBMetricsStorage

        storage = InfluxDBMetricsStorage(config.storage_config)
    else:
        raise ValueError(f"Unsupported storage type: {config.storage_type}")

    storage_manager.register_storage("primary", storage, is_primary=True)
    await storage_manager.initialize_all()

    # 创建指标服务
    # 注意：这里创建一个简化的服务对象来管理收集器和存储
    # 实际的 AdapterMetricsService 在服务层使用
    from .collectors import CollectorManager
    
    class SimpleMetricsService:
        """简化的指标服务，用于 setup_metrics_system"""
        def __init__(self):
            self.storage_manager = storage_manager
            self.collector_manager = CollectorManager()
            self._collectors = []
            self._running = False
            
        def register_collector(self, collector):
            self._collectors.append(collector)
            
        async def start(self):
            for collector in self._collectors:
                if hasattr(collector, 'start'):
                    await collector.start()
            self._running = True
            
        async def stop(self):
            for collector in self._collectors:
                if hasattr(collector, 'stop'):
                    await collector.stop()
            self._running = False
            
        def get_status(self):
            return {"running": self._running}
    
    service = SimpleMetricsService()

    # 添加收集器
    collectors = []

    if config.enable_system_metrics:
        system_collector = SystemMetricsCollector(
            collection_interval=config.collection_interval
        )
        collectors.append(system_collector)

    if config.enable_adapter_metrics:
        adapter_collector = AdapterMetricsCollector(
            collection_interval=config.collection_interval
        )
        collectors.append(adapter_collector)

    if config.enable_performance_metrics:
        # PerformanceMetricsCollector 暂未实现，跳过
        logger.warning("PerformanceMetricsCollector not implemented, skipping")
        pass

    # 注册收集器
    for collector in collectors:
        service.register_collector(collector)

    # 启动服务
    await service.start()

    # 设置为全局服务
    set_global_metrics_service(service)

    # 设置告警系统
    if config.enable_alerts:
        query_engine = MetricsQueryEngine(storage)
        alert_manager = MetricsAlertManager(query_engine)

        # 创建默认告警规则
        alert_manager.create_default_rules()

        # 启动告警管理器
        await alert_manager.start()

        # 将告警管理器附加到服务
        service._alert_manager = alert_manager

    # 设置仪表板
    if config.enable_dashboard:
        query_engine = MetricsQueryEngine(storage)
        dashboard = MetricsDashboard(query_engine)

        # 创建默认仪表板
        dashboard.create_system_dashboard()
        dashboard.create_adapter_dashboard()

        # 将仪表板附加到服务
        service._dashboard = dashboard

    logger.info(f"Metrics system setup completed with {config.storage_type} storage")
    return service


async def teardown_metrics_system(service: MetricsService) -> None:
    """
    关闭指标系统

    Args:
        service: 指标服务
    """
    # 停止告警管理器
    if hasattr(service, "_alert_manager"):
        await service._alert_manager.stop()

    # 停止服务
    await service.stop()

    # 清除全局服务
    clear_global_metrics_service()

    logger.info("Metrics system teardown completed")


# ================================
# 查询便捷函数
# ================================


async def query_metrics(
    metric_names: Optional[List[str]] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    labels: Optional[Dict[str, str]] = None,
    limit: Optional[int] = None,
) -> List[MetricFamily]:
    """
    便捷查询指标

    Args:
        metric_names: 指标名称列表
        start_time: 开始时间
        end_time: 结束时间
        labels: 标签过滤
        limit: 结果限制

    Returns:
        指标族列表
    """
    service = get_global_metrics_service()
    if not service:
        logger.warning("No global metrics service available for query")
        return []

    storage = service.storage_manager.get_primary_storage()
    if not storage:
        logger.warning("No primary storage available for query")
        return []

    return await storage.read_metrics(metric_names, start_time, end_time, labels, limit)


async def get_latest_metrics(metric_names: List[str]) -> Dict[str, float]:
    """
    获取指标的最新值

    Args:
        metric_names: 指标名称列表

    Returns:
        指标名称到最新值的映射
    """
    # 查询最近1小时的数据
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=1)

    families = await query_metrics(metric_names, start_time, end_time)

    latest_values = {}
    for family in families:
        for metric in family.get_all_metrics():
            if metric.samples:
                # 获取最新样本
                latest_sample = max(metric.samples, key=lambda s: s.timestamp)
                latest_values[metric.name] = latest_sample.value

    return latest_values


def build_query() -> QueryBuilder:
    """创建查询构建器"""
    return QueryBuilder()


# ================================
# 健康检查工具
# ================================


async def check_metrics_health() -> Dict[str, Any]:
    """
    检查指标系统健康状态

    Returns:
        健康状态信息
    """
    service = get_global_metrics_service()
    if not service:
        return {"status": "error", "message": "No global metrics service available"}

    try:
        # 检查服务状态
        service_status = service.get_status()

        # 检查存储状态
        storage_info = await service.storage_manager.get_all_storage_info()

        # 检查收集器状态
        collectors_status = []
        for collector in service.collectors:
            collectors_status.append(
                {
                    "name": collector.__class__.__name__,
                    "running": collector.is_running,
                    "stats": collector.get_stats(),
                }
            )

        # 检查告警管理器状态
        alert_status = None
        if hasattr(service, "_alert_manager"):
            alert_status = service._alert_manager.get_status()

        return {
            "status": "healthy" if service_status["running"] else "unhealthy",
            "service": service_status,
            "storage": storage_info,
            "collectors": collectors_status,
            "alerts": alert_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# ================================
# 导出工具
# ================================


async def export_metrics_data(
    output_file: str,
    format: str = "json",
    metric_names: Optional[List[str]] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> bool:
    """
    导出指标数据

    Args:
        output_file: 输出文件路径
        format: 导出格式 (json, csv)
        metric_names: 指标名称列表
        start_time: 开始时间
        end_time: 结束时间

    Returns:
        是否成功导出
    """
    try:
        # 查询数据
        families = await query_metrics(metric_names, start_time, end_time)

        if format.lower() == "json":
            import json

            data = {
                "export_time": datetime.now(timezone.utc).isoformat(),
                "metrics": [family.to_dict() for family in families],
            }

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        elif format.lower() == "csv":
            import csv

            with open(output_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)

                # 写入标题行
                writer.writerow(
                    ["metric_name", "metric_type", "timestamp", "value", "labels"]
                )

                # 写入数据行
                for family in families:
                    for metric in family.get_all_metrics():
                        for sample in metric.samples:
                            labels_str = ",".join(
                                f"{k}={v}" for k, v in sample.labels.items()
                            )
                            writer.writerow(
                                [
                                    metric.name,
                                    metric.metric_type.value,
                                    sample.timestamp.isoformat(),
                                    sample.value,
                                    labels_str,
                                ]
                            )

        else:
            raise ValueError(f"Unsupported export format: {format}")

        logger.info(f"Exported metrics data to {output_file} in {format} format")
        return True

    except Exception as e:
        logger.error(f"Failed to export metrics data: {e}")
        return False


# ================================
# 示例和测试工具
# ================================


async def generate_sample_metrics(count: int = 100, interval: float = 1.0) -> None:
    """
    生成示例指标数据（用于测试）

    Args:
        count: 生成的样本数量
        interval: 生成间隔（秒）
    """
    import random

    logger.info(f"Generating {count} sample metrics with {interval}s interval")

    for i in range(count):
        # 生成随机指标
        batch = create_batch()

        # CPU使用率
        cpu_usage = random.uniform(10, 90)
        batch.gauge(
            "test_cpu_usage", cpu_usage, {"host": "test-server"}, "Test CPU usage", "%"
        )

        # 内存使用率
        memory_usage = random.uniform(30, 85)
        batch.gauge(
            "test_memory_usage",
            memory_usage,
            {"host": "test-server"},
            "Test memory usage",
            "%",
        )

        # 请求计数
        batch.counter(
            "test_requests_total",
            random.randint(1, 10),
            {"method": "GET", "status": "200"},
        )

        # 响应时间
        response_time = random.uniform(0.1, 2.0)
        batch.histogram(
            "test_response_time",
            response_time,
            {"endpoint": "/api/test"},
            "Test response time",
            "seconds",
        )

        # 记录批次
        await batch.record()

        if i < count - 1:  # 最后一次不需要等待
            await asyncio.sleep(interval)

    logger.info(f"Generated {count} sample metrics")


async def run_metrics_benchmark(duration: int = 60) -> Dict[str, Any]:
    """
    运行指标系统基准测试

    Args:
        duration: 测试持续时间（秒）

    Returns:
        基准测试结果
    """
    logger.info(f"Running metrics benchmark for {duration} seconds")

    start_time = time.time()
    end_time = start_time + duration

    metrics_recorded = 0
    errors = 0

    while time.time() < end_time:
        try:
            batch = create_batch()

            # 记录多个指标
            batch.counter("benchmark_counter", 1, {"test": "benchmark"})
            batch.gauge("benchmark_gauge", time.time(), {"test": "benchmark"})
            batch.histogram(
                "benchmark_histogram", time.time() % 10, {"test": "benchmark"}
            )

            success = await batch.record()
            if success:
                metrics_recorded += 3  # 3个指标
            else:
                errors += 1

        except Exception as e:
            logger.error(f"Benchmark error: {e}")
            errors += 1

        await asyncio.sleep(0.1)  # 100ms间隔

    actual_duration = time.time() - start_time

    result = {
        "duration": actual_duration,
        "metrics_recorded": metrics_recorded,
        "errors": errors,
        "metrics_per_second": metrics_recorded / actual_duration
        if actual_duration > 0
        else 0,
        "error_rate": errors / (metrics_recorded + errors)
        if (metrics_recorded + errors) > 0
        else 0,
    }

    logger.info(f"Benchmark completed: {result}")
    return result

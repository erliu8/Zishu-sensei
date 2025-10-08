"""
指标收集器

提供各种类型的指标收集器，包括系统指标、适配器指标、服务指标等。
"""

import asyncio
import logging
import psutil
import time
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Callable, Union
from dataclasses import dataclass, field
from collections import defaultdict, deque
import json
import weakref

from .core import MetricType, MetricSample, Metric, MetricFamily
from ..services.base import ServiceMetrics
from ..security.audit import AuditLogger, get_audit_logger

# 尝试导入可选依赖
try:
    import torch
    import torch.cuda

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

logger = logging.getLogger(__name__)


# ================================
# 收集器基类
# ================================


class MetricsCollector(ABC):
    """指标收集器基类"""

    def __init__(
        self, name: str, collection_interval: float = 60.0, enabled: bool = True
    ):
        """
        初始化收集器

        Args:
            name: 收集器名称
            collection_interval: 收集间隔(秒)
            enabled: 是否启用
        """
        self.name = name
        self.collection_interval = collection_interval
        self.enabled = enabled

        # 指标服务引用(弱引用避免循环依赖)
        self._metrics_service = None

        # 收集统计
        self.collection_count = 0
        self.error_count = 0
        self.last_collection_time: Optional[datetime] = None
        self.last_error: Optional[str] = None

        # 线程安全
        self._lock = threading.RLock()

        logger.debug(f"Created metrics collector: {name}")

    def set_metrics_service(self, metrics_service) -> None:
        """设置指标服务引用"""
        self._metrics_service = weakref.ref(metrics_service)

    def get_metrics_service(self):
        """获取指标服务"""
        if self._metrics_service:
            return self._metrics_service()
        return None

    @abstractmethod
    async def collect(self) -> None:
        """收集指标 - 子类必须实现"""
        pass

    def record_metric(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        """记录指标"""
        service = self.get_metrics_service()
        if service:
            service.record_metric(name, value, labels, timestamp)

    def increment_counter(
        self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """递增计数器"""
        service = self.get_metrics_service()
        if service:
            service.increment_counter(name, value, labels)

    def set_gauge(
        self, name: str, value: float, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """设置仪表值"""
        service = self.get_metrics_service()
        if service:
            service.set_gauge(name, value, labels)

    def observe_histogram(
        self, name: str, value: float, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """观察直方图值"""
        service = self.get_metrics_service()
        if service:
            service.observe_histogram(name, value, labels)

    async def safe_collect(self) -> bool:
        """安全收集 - 包含错误处理"""
        if not self.enabled:
            return False

        try:
            with self._lock:
                start_time = time.time()

                await self.collect()

                # 更新统计
                self.collection_count += 1
                self.last_collection_time = datetime.now(timezone.utc)

                # 记录收集时间
                collection_time = time.time() - start_time
                self.observe_histogram(
                    "metrics_collector_duration",
                    collection_time,
                    {"collector": self.name},
                )

                return True

        except Exception as e:
            with self._lock:
                self.error_count += 1
                self.last_error = str(e)

            logger.error(f"Error in collector {self.name}: {e}")

            # 记录错误指标
            self.increment_counter(
                "metrics_collector_errors",
                labels={"collector": self.name, "error": str(e)[:100]},
            )

            return False

    def get_status(self) -> Dict[str, Any]:
        """获取收集器状态"""
        with self._lock:
            return {
                "name": self.name,
                "enabled": self.enabled,
                "collection_interval": self.collection_interval,
                "collection_count": self.collection_count,
                "error_count": self.error_count,
                "last_collection_time": self.last_collection_time.isoformat()
                if self.last_collection_time
                else None,
                "last_error": self.last_error,
                "success_rate": (self.collection_count - self.error_count)
                / max(self.collection_count, 1)
                * 100,
            }


# ================================
# 系统指标收集器
# ================================


class SystemMetricsCollector(MetricsCollector):
    """系统指标收集器 - 收集CPU、内存、磁盘、网络等系统指标"""

    def __init__(
        self,
        collection_interval: float = 30.0,
        collect_cpu: bool = True,
        collect_memory: bool = True,
        collect_disk: bool = True,
        collect_network: bool = True,
        collect_gpu: bool = True,
    ):
        super().__init__("system", collection_interval)

        self.collect_cpu = collect_cpu
        self.collect_memory = collect_memory
        self.collect_disk = collect_disk
        self.collect_network = collect_network
        self.collect_gpu = collect_gpu and TORCH_AVAILABLE

        # 网络IO基线
        self._last_network_io = None
        self._last_network_time = None

        # 进程引用
        self._process = psutil.Process()

    async def collect(self) -> None:
        """收集系统指标"""
        timestamp = datetime.now(timezone.utc)

        # CPU指标
        if self.collect_cpu:
            await self._collect_cpu_metrics(timestamp)

        # 内存指标
        if self.collect_memory:
            await self._collect_memory_metrics(timestamp)

        # 磁盘指标
        if self.collect_disk:
            await self._collect_disk_metrics(timestamp)

        # 网络指标
        if self.collect_network:
            await self._collect_network_metrics(timestamp)

        # GPU指标
        if self.collect_gpu:
            await self._collect_gpu_metrics(timestamp)

        # 进程指标
        await self._collect_process_metrics(timestamp)

    async def _collect_cpu_metrics(self, timestamp: datetime) -> None:
        """收集CPU指标"""
        try:
            # 总体CPU使用率
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.set_gauge("system_cpu_percent", cpu_percent)

            # 每核心CPU使用率
            cpu_percents = psutil.cpu_percent(interval=0.1, percpu=True)
            for i, percent in enumerate(cpu_percents):
                self.set_gauge("system_cpu_percent", percent, {"core": str(i)})

            # CPU频率
            cpu_freq = psutil.cpu_freq()
            if cpu_freq:
                self.set_gauge("system_cpu_freq_current", cpu_freq.current)
                self.set_gauge("system_cpu_freq_min", cpu_freq.min)
                self.set_gauge("system_cpu_freq_max", cpu_freq.max)

            # 负载平均值
            load_avg = psutil.getloadavg()
            self.set_gauge("system_load_1m", load_avg[0])
            self.set_gauge("system_load_5m", load_avg[1])
            self.set_gauge("system_load_15m", load_avg[2])

        except Exception as e:
            logger.error(f"Failed to collect CPU metrics: {e}")

    async def _collect_memory_metrics(self, timestamp: datetime) -> None:
        """收集内存指标"""
        try:
            # 虚拟内存
            memory = psutil.virtual_memory()
            self.set_gauge("system_memory_total", memory.total)
            self.set_gauge("system_memory_available", memory.available)
            self.set_gauge("system_memory_used", memory.used)
            self.set_gauge("system_memory_percent", memory.percent)
            self.set_gauge("system_memory_free", memory.free)

            # 交换内存
            swap = psutil.swap_memory()
            self.set_gauge("system_swap_total", swap.total)
            self.set_gauge("system_swap_used", swap.used)
            self.set_gauge("system_swap_free", swap.free)
            self.set_gauge("system_swap_percent", swap.percent)

        except Exception as e:
            logger.error(f"Failed to collect memory metrics: {e}")

    async def _collect_disk_metrics(self, timestamp: datetime) -> None:
        """收集磁盘指标"""
        try:
            # 磁盘使用情况
            disk_partitions = psutil.disk_partitions()
            for partition in disk_partitions:
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    labels = {
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                    }

                    self.set_gauge("system_disk_total", usage.total, labels)
                    self.set_gauge("system_disk_used", usage.used, labels)
                    self.set_gauge("system_disk_free", usage.free, labels)
                    self.set_gauge(
                        "system_disk_percent", usage.used / usage.total * 100, labels
                    )

                except PermissionError:
                    # 跳过无权限访问的分区
                    continue

            # 磁盘IO
            disk_io = psutil.disk_io_counters()
            if disk_io:
                self.set_gauge("system_disk_read_bytes", disk_io.read_bytes)
                self.set_gauge("system_disk_write_bytes", disk_io.write_bytes)
                self.set_gauge("system_disk_read_count", disk_io.read_count)
                self.set_gauge("system_disk_write_count", disk_io.write_count)
                self.set_gauge("system_disk_read_time", disk_io.read_time)
                self.set_gauge("system_disk_write_time", disk_io.write_time)

        except Exception as e:
            logger.error(f"Failed to collect disk metrics: {e}")

    async def _collect_network_metrics(self, timestamp: datetime) -> None:
        """收集网络指标"""
        try:
            # 网络IO统计
            network_io = psutil.net_io_counters()
            if network_io:
                self.set_gauge("system_network_bytes_sent", network_io.bytes_sent)
                self.set_gauge("system_network_bytes_recv", network_io.bytes_recv)
                self.set_gauge("system_network_packets_sent", network_io.packets_sent)
                self.set_gauge("system_network_packets_recv", network_io.packets_recv)

                # 计算网络速率
                current_time = time.time()
                if self._last_network_io and self._last_network_time:
                    time_delta = current_time - self._last_network_time
                    if time_delta > 0:
                        bytes_sent_rate = (
                            network_io.bytes_sent - self._last_network_io.bytes_sent
                        ) / time_delta
                        bytes_recv_rate = (
                            network_io.bytes_recv - self._last_network_io.bytes_recv
                        ) / time_delta

                        self.set_gauge(
                            "system_network_bytes_sent_rate", bytes_sent_rate
                        )
                        self.set_gauge(
                            "system_network_bytes_recv_rate", bytes_recv_rate
                        )

                self._last_network_io = network_io
                self._last_network_time = current_time

            # 网络连接数
            connections = psutil.net_connections()
            connection_stats = defaultdict(int)
            for conn in connections:
                connection_stats[conn.status] += 1

            for status, count in connection_stats.items():
                self.set_gauge("system_network_connections", count, {"status": status})

        except Exception as e:
            logger.error(f"Failed to collect network metrics: {e}")

    async def _collect_gpu_metrics(self, timestamp: datetime) -> None:
        """收集GPU指标"""
        if not TORCH_AVAILABLE or not torch.cuda.is_available():
            return

        try:
            device_count = torch.cuda.device_count()

            for i in range(device_count):
                labels = {"device": str(i)}

                # GPU内存使用
                memory_allocated = torch.cuda.memory_allocated(i)
                memory_reserved = torch.cuda.memory_reserved(i)
                max_memory = torch.cuda.max_memory_allocated(i)

                self.set_gauge("system_gpu_memory_allocated", memory_allocated, labels)
                self.set_gauge("system_gpu_memory_reserved", memory_reserved, labels)
                self.set_gauge("system_gpu_memory_max", max_memory, labels)

                if max_memory > 0:
                    memory_percent = memory_allocated / max_memory * 100
                    self.set_gauge("system_gpu_memory_percent", memory_percent, labels)

                # GPU设备属性
                device_props = torch.cuda.get_device_properties(i)
                self.set_gauge(
                    "system_gpu_total_memory", device_props.total_memory, labels
                )

        except Exception as e:
            logger.error(f"Failed to collect GPU metrics: {e}")

    async def _collect_process_metrics(self, timestamp: datetime) -> None:
        """收集进程指标"""
        try:
            # 进程数量
            process_count = len(psutil.pids())
            self.set_gauge("system_process_count", process_count)

            # 当前进程指标
            memory_info = self._process.memory_info()
            self.set_gauge("process_memory_rss", memory_info.rss)
            self.set_gauge("process_memory_vms", memory_info.vms)

            # CPU时间
            cpu_times = self._process.cpu_times()
            self.set_gauge("process_cpu_user_time", cpu_times.user)
            self.set_gauge("process_cpu_system_time", cpu_times.system)

            # 线程数
            thread_count = self._process.num_threads()
            self.set_gauge("process_thread_count", thread_count)

            # 文件描述符
            try:
                fd_count = self._process.num_fds()
                self.set_gauge("process_fd_count", fd_count)
            except AttributeError:
                # Windows不支持num_fds
                pass

        except Exception as e:
            logger.error(f"Failed to collect process metrics: {e}")


# ================================
# 适配器指标收集器
# ================================


class AdapterMetricsCollector(MetricsCollector):
    """适配器指标收集器 - 收集适配器执行性能指标"""

    def __init__(self, adapter_manager=None, collection_interval: float = 60.0):
        super().__init__("adapter", collection_interval)

        # 适配器管理器引用(弱引用)
        self._adapter_manager = (
            weakref.ref(adapter_manager) if adapter_manager else None
        )

        # 执行统计
        self._execution_stats = defaultdict(
            lambda: {
                "count": 0,
                "success_count": 0,
                "error_count": 0,
                "total_time": 0.0,
                "min_time": float("inf"),
                "max_time": 0.0,
                "last_execution": None,
            }
        )

        self._stats_lock = threading.RLock()

    def get_adapter_manager(self):
        """获取适配器管理器"""
        if self._adapter_manager:
            return self._adapter_manager()
        return None

    async def collect(self) -> None:
        """收集适配器指标"""
        timestamp = datetime.now(timezone.utc)

        # 从适配器管理器收集指标
        await self._collect_from_manager(timestamp)

        # 收集执行统计
        await self._collect_execution_stats(timestamp)

    async def _collect_from_manager(self, timestamp: datetime) -> None:
        """从适配器管理器收集指标"""
        manager = self.get_adapter_manager()
        if not manager:
            return

        try:
            # 注册的适配器数量
            if hasattr(manager, "get_registered_adapters"):
                adapters = manager.get_registered_adapters()
                self.set_gauge("adapter_registered_count", len(adapters))

                # 按类型统计适配器
                type_counts = defaultdict(int)
                for adapter_info in adapters.values():
                    adapter_type = getattr(
                        adapter_info.get("adapter"), "adapter_type", "unknown"
                    )
                    type_counts[adapter_type] += 1

                for adapter_type, count in type_counts.items():
                    self.set_gauge(
                        "adapter_count_by_type", count, {"type": adapter_type}
                    )

            # 活跃适配器数量
            if hasattr(manager, "get_active_adapters"):
                active_adapters = manager.get_active_adapters()
                self.set_gauge("adapter_active_count", len(active_adapters))

            # 适配器状态统计
            if hasattr(manager, "get_adapter_statuses"):
                statuses = manager.get_adapter_statuses()
                status_counts = defaultdict(int)
                for status in statuses.values():
                    status_counts[status] += 1

                for status, count in status_counts.items():
                    self.set_gauge("adapter_status_count", count, {"status": status})

        except Exception as e:
            logger.error(f"Failed to collect adapter manager metrics: {e}")

    async def _collect_execution_stats(self, timestamp: datetime) -> None:
        """收集执行统计指标"""
        with self._stats_lock:
            for adapter_name, stats in self._execution_stats.items():
                labels = {"adapter": adapter_name}

                # 基础统计
                self.set_gauge("adapter_execution_count", stats["count"], labels)
                self.set_gauge("adapter_success_count", stats["success_count"], labels)
                self.set_gauge("adapter_error_count", stats["error_count"], labels)

                # 成功率
                if stats["count"] > 0:
                    success_rate = stats["success_count"] / stats["count"] * 100
                    self.set_gauge("adapter_success_rate", success_rate, labels)

                # 执行时间统计
                if stats["count"] > 0:
                    avg_time = stats["total_time"] / stats["count"]
                    self.set_gauge("adapter_avg_execution_time", avg_time, labels)
                    self.set_gauge(
                        "adapter_min_execution_time", stats["min_time"], labels
                    )
                    self.set_gauge(
                        "adapter_max_execution_time", stats["max_time"], labels
                    )

                # 最后执行时间
                if stats["last_execution"]:
                    self.set_gauge(
                        "adapter_last_execution_timestamp",
                        stats["last_execution"],
                        labels,
                    )

    def record_execution(
        self,
        adapter_name: str,
        execution_time: float,
        success: bool,
        error_message: Optional[str] = None,
    ) -> None:
        """记录适配器执行"""
        with self._stats_lock:
            stats = self._execution_stats[adapter_name]

            # 更新统计
            stats["count"] += 1
            stats["total_time"] += execution_time
            stats["min_time"] = min(stats["min_time"], execution_time)
            stats["max_time"] = max(stats["max_time"], execution_time)
            stats["last_execution"] = time.time()

            if success:
                stats["success_count"] += 1
            else:
                stats["error_count"] += 1

        # 记录实时指标
        labels = {"adapter": adapter_name, "success": str(success)}

        self.observe_histogram("adapter_execution_time", execution_time, labels)
        self.increment_counter("adapter_executions_total", labels=labels)

        if not success:
            error_labels = {
                **labels,
                "error": error_message[:100] if error_message else "unknown",
            }
            self.increment_counter("adapter_errors_total", labels=error_labels)


# ================================
# 服务指标收集器
# ================================


class ServiceMetricsCollector(MetricsCollector):
    """服务指标收集器 - 收集各种服务的性能指标"""

    def __init__(
        self, services: Optional[List[Any]] = None, collection_interval: float = 60.0
    ):
        super().__init__("service", collection_interval)

        # 服务列表(弱引用)
        self._services: List[weakref.ref] = []
        if services:
            for service in services:
                self.add_service(service)

    def add_service(self, service) -> None:
        """添加服务"""
        self._services.append(weakref.ref(service))

    def remove_service(self, service) -> None:
        """移除服务"""
        self._services = [ref for ref in self._services if ref() != service]

    async def collect(self) -> None:
        """收集服务指标"""
        timestamp = datetime.now(timezone.utc)

        # 清理失效的弱引用
        self._services = [ref for ref in self._services if ref() is not None]

        for service_ref in self._services:
            service = service_ref()
            if service:
                await self._collect_service_metrics(service, timestamp)

    async def _collect_service_metrics(self, service, timestamp: datetime) -> None:
        """收集单个服务的指标"""
        try:
            service_name = getattr(service, "name", service.__class__.__name__)
            labels = {"service": service_name}

            # 服务状态
            if hasattr(service, "_status"):
                status = (
                    service._status.value
                    if hasattr(service._status, "value")
                    else str(service._status)
                )
                self.set_gauge("service_status", 1, {**labels, "status": status})

            # 健康状态
            if hasattr(service, "health_check"):
                try:
                    health_info = await service.health_check()
                    health_status = health_info.get("health", "unknown")
                    self.set_gauge(
                        "service_health", 1, {**labels, "health": health_status}
                    )

                    # 其他健康指标
                    if "response_time" in health_info:
                        self.observe_histogram(
                            "service_health_check_time",
                            health_info["response_time"],
                            labels,
                        )

                except Exception as e:
                    logger.error(
                        f"Failed to get health info for service {service_name}: {e}"
                    )
                    self.set_gauge("service_health", 1, {**labels, "health": "error"})

            # 服务指标
            if hasattr(service, "_service_metrics"):
                metrics = service._service_metrics

                self.set_gauge("service_request_count", metrics.request_count, labels)
                self.set_gauge("service_error_count", metrics.error_count, labels)
                self.set_gauge(
                    "service_avg_response_time", metrics.avg_response_time, labels
                )
                self.set_gauge("service_memory_usage", metrics.memory_usage, labels)
                self.set_gauge("service_cpu_usage", metrics.cpu_usage, labels)
                self.set_gauge("service_uptime", metrics.uptime, labels)

                # 成功率
                if metrics.request_count > 0:
                    success_rate = (
                        (metrics.request_count - metrics.error_count)
                        / metrics.request_count
                        * 100
                    )
                    self.set_gauge("service_success_rate", success_rate, labels)

                # 自定义指标
                for metric_name, value in metrics.custom_metrics.items():
                    if isinstance(value, (int, float)):
                        self.set_gauge(f"service_custom_{metric_name}", value, labels)

        except Exception as e:
            logger.error(f"Failed to collect metrics for service {service}: {e}")


# ================================
# 业务指标收集器
# ================================


class BusinessMetricsCollector(MetricsCollector):
    """业务指标收集器 - 收集业务相关的自定义指标"""

    def __init__(
        self,
        collection_interval: float = 300.0,  # 5分钟
        custom_collectors: Optional[List[Callable]] = None,
    ):
        super().__init__("business", collection_interval)

        # 自定义收集器函数
        self._custom_collectors = custom_collectors or []

        # 业务指标缓存
        self._business_metrics = {}
        self._metrics_lock = threading.RLock()

    def add_custom_collector(self, collector_func: Callable) -> None:
        """添加自定义收集器函数"""
        self._custom_collectors.append(collector_func)

    def record_business_metric(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        description: str = "",
    ) -> None:
        """记录业务指标"""
        with self._metrics_lock:
            self._business_metrics[name] = {
                "value": value,
                "labels": labels or {},
                "description": description,
                "timestamp": datetime.now(timezone.utc),
            }

    async def collect(self) -> None:
        """收集业务指标"""
        timestamp = datetime.now(timezone.utc)

        # 执行自定义收集器
        for collector_func in self._custom_collectors:
            try:
                if asyncio.iscoroutinefunction(collector_func):
                    await collector_func(self)
                else:
                    collector_func(self)
            except Exception as e:
                logger.error(
                    f"Error in custom business collector {collector_func.__name__}: {e}"
                )

        # 收集缓存的业务指标
        await self._collect_cached_metrics(timestamp)

    async def _collect_cached_metrics(self, timestamp: datetime) -> None:
        """收集缓存的业务指标"""
        with self._metrics_lock:
            for name, metric_info in self._business_metrics.items():
                self.set_gauge(
                    f"business_{name}", metric_info["value"], metric_info["labels"]
                )


# ================================
# 收集器管理器
# ================================


class CollectorManager:
    """收集器管理器 - 统一管理所有指标收集器"""

    def __init__(self, metrics_service=None):
        """初始化收集器管理器"""
        self.metrics_service = metrics_service
        self._collectors: Dict[str, MetricsCollector] = {}
        self._collection_tasks: Dict[str, asyncio.Task] = {}
        self._running = False

        logger.info("CollectorManager initialized")

    def register_collector(self, collector: MetricsCollector) -> None:
        """注册收集器"""
        collector.set_metrics_service(self.metrics_service)
        self._collectors[collector.name] = collector

        logger.info(f"Registered collector: {collector.name}")

    def unregister_collector(self, name: str) -> None:
        """注销收集器"""
        if name in self._collectors:
            # 停止收集任务
            if name in self._collection_tasks:
                self._collection_tasks[name].cancel()
                del self._collection_tasks[name]

            del self._collectors[name]
            logger.info(f"Unregistered collector: {name}")

    def get_collector(self, name: str) -> Optional[MetricsCollector]:
        """获取收集器"""
        return self._collectors.get(name)

    def list_collectors(self) -> List[str]:
        """列出所有收集器"""
        return list(self._collectors.keys())

    async def start_all(self) -> None:
        """启动所有收集器"""
        if self._running:
            logger.warning("Collectors already running")
            return

        self._running = True

        for name, collector in self._collectors.items():
            if collector.enabled:
                task = asyncio.create_task(self._collection_loop(collector))
                self._collection_tasks[name] = task

        logger.info(f"Started {len(self._collection_tasks)} collectors")

    async def stop_all(self) -> None:
        """停止所有收集器"""
        if not self._running:
            return

        self._running = False

        # 取消所有收集任务
        for task in self._collection_tasks.values():
            task.cancel()

        # 等待任务完成
        if self._collection_tasks:
            await asyncio.gather(
                *self._collection_tasks.values(), return_exceptions=True
            )

        self._collection_tasks.clear()
        logger.info("Stopped all collectors")

    async def _collection_loop(self, collector: MetricsCollector) -> None:
        """收集器循环"""
        logger.info(f"Starting collection loop for {collector.name}")

        while self._running and collector.enabled:
            try:
                await collector.safe_collect()

            except Exception as e:
                logger.error(f"Error in collection loop for {collector.name}: {e}")

            # 等待下次收集
            await asyncio.sleep(collector.collection_interval)

        logger.info(f"Collection loop stopped for {collector.name}")

    def get_status(self) -> Dict[str, Any]:
        """获取管理器状态"""
        collector_statuses = {}
        for name, collector in self._collectors.items():
            collector_statuses[name] = collector.get_status()

        return {
            "running": self._running,
            "total_collectors": len(self._collectors),
            "active_collectors": len(self._collection_tasks),
            "collectors": collector_statuses,
        }

    async def collect_once(
        self, collector_name: Optional[str] = None
    ) -> Dict[str, bool]:
        """执行一次性收集"""
        results = {}

        if collector_name:
            # 收集指定收集器
            collector = self._collectors.get(collector_name)
            if collector:
                results[collector_name] = await collector.safe_collect()
            else:
                results[collector_name] = False
        else:
            # 收集所有收集器
            for name, collector in self._collectors.items():
                if collector.enabled:
                    results[name] = await collector.safe_collect()

        return results

    def setup_default_collectors(
        self, adapter_manager=None, services: Optional[List[Any]] = None
    ) -> None:
        """设置默认收集器"""
        # 系统指标收集器
        system_collector = SystemMetricsCollector(collection_interval=30.0)
        self.register_collector(system_collector)

        # 适配器指标收集器
        if adapter_manager:
            adapter_collector = AdapterMetricsCollector(
                adapter_manager=adapter_manager, collection_interval=60.0
            )
            self.register_collector(adapter_collector)

        # 服务指标收集器
        if services:
            service_collector = ServiceMetricsCollector(
                services=services, collection_interval=60.0
            )
            self.register_collector(service_collector)

        # 业务指标收集器
        business_collector = BusinessMetricsCollector(collection_interval=300.0)
        self.register_collector(business_collector)

        logger.info("Default collectors setup completed")

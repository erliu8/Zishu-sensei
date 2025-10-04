"""
核心指标收集服务

提供适配器系统的核心指标收集、聚合和管理功能。
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Callable, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
import threading
import json
import weakref

from ..services.base import AsyncService, ServiceStatus, ServiceHealth, ServiceMetrics
from ..security.audit import AuditLogger, get_audit_logger

logger = logging.getLogger(__name__)


# ================================
# 核心数据结构
# ================================

class MetricType(str, Enum):
    """指标类型"""
    COUNTER = "counter"         # 计数器 - 只增不减
    GAUGE = "gauge"            # 仪表 - 可增可减的瞬时值
    HISTOGRAM = "histogram"     # 直方图 - 观察值分布
    SUMMARY = "summary"        # 摘要 - 观察值分位数
    TIMER = "timer"           # 计时器 - 执行时间测量
    RATE = "rate"             # 速率 - 单位时间内的变化


class AggregationType(str, Enum):
    """聚合类型"""
    SUM = "sum"               # 求和
    AVG = "avg"               # 平均值
    MIN = "min"               # 最小值
    MAX = "max"               # 最大值
    COUNT = "count"           # 计数
    P50 = "p50"               # 50分位数
    P90 = "p90"               # 90分位数
    P95 = "p95"               # 95分位数
    P99 = "p99"               # 99分位数


@dataclass
class MetricSample:
    """指标样本"""
    value: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    labels: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'value': self.value,
            'timestamp': self.timestamp.isoformat(),
            'labels': self.labels
        }


@dataclass
class Metric:
    """指标定义"""
    name: str
    metric_type: MetricType
    description: str = ""
    unit: str = ""
    labels: Dict[str, str] = field(default_factory=dict)
    samples: List[MetricSample] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def add_sample(self, value: float, labels: Optional[Dict[str, str]] = None, timestamp: Optional[datetime] = None) -> None:
        """添加样本"""
        sample_labels = {**self.labels}
        if labels:
            sample_labels.update(labels)
        
        sample = MetricSample(
            value=value,
            timestamp=timestamp or datetime.now(timezone.utc),
            labels=sample_labels
        )
        self.samples.append(sample)
    
    def get_latest_value(self) -> Optional[float]:
        """获取最新值"""
        return self.samples[-1].value if self.samples else None
    
    def get_samples_in_range(self, start_time: datetime, end_time: datetime) -> List[MetricSample]:
        """获取时间范围内的样本"""
        return [s for s in self.samples if start_time <= s.timestamp <= end_time]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'type': self.metric_type.value,
            'description': self.description,
            'unit': self.unit,
            'labels': self.labels,
            'samples': [s.to_dict() for s in self.samples],
            'created_at': self.created_at.isoformat()
        }


@dataclass
class MetricFamily:
    """指标族 - 同名不同标签的指标集合"""
    name: str
    metric_type: MetricType
    description: str = ""
    unit: str = ""
    metrics: Dict[str, Metric] = field(default_factory=dict)
    
    def get_or_create_metric(self, labels: Optional[Dict[str, str]] = None) -> Metric:
        """获取或创建指标"""
        labels = labels or {}
        labels_key = self._labels_to_key(labels)
        
        if labels_key not in self.metrics:
            self.metrics[labels_key] = Metric(
                name=self.name,
                metric_type=self.metric_type,
                description=self.description,
                unit=self.unit,
                labels=labels
            )
        
        return self.metrics[labels_key]
    
    def add_sample(self, value: float, labels: Optional[Dict[str, str]] = None, timestamp: Optional[datetime] = None) -> None:
        """添加样本到对应的指标"""
        metric = self.get_or_create_metric(labels)
        metric.add_sample(value, timestamp=timestamp)
    
    def get_all_metrics(self) -> List[Metric]:
        """获取所有指标"""
        return list(self.metrics.values())
    
    def _labels_to_key(self, labels: Dict[str, str]) -> str:
        """将标签转换为键"""
        return json.dumps(sorted(labels.items()), ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'type': self.metric_type.value,
            'description': self.description,
            'unit': self.unit,
            'metrics': [m.to_dict() for m in self.metrics.values()]
        }


@dataclass
class MetricsServiceConfig:
    """指标服务配置"""
    # 基础配置
    collection_interval: float = 60.0  # 收集间隔(秒)
    retention_period: int = 7 * 24 * 3600  # 保留期(秒) - 默认7天
    max_samples_per_metric: int = 10000  # 每个指标最大样本数
    
    # 存储配置
    storage_backend: str = "memory"  # 存储后端: memory, file, redis, influxdb
    storage_config: Dict[str, Any] = field(default_factory=dict)
    
    # 导出配置
    enable_prometheus: bool = True
    prometheus_port: int = 9090
    enable_json_export: bool = True
    json_export_path: str = "/tmp/metrics.json"
    
    # 性能配置
    max_concurrent_collections: int = 10
    collection_timeout: float = 30.0
    enable_compression: bool = True
    
    # 告警配置
    enable_alerts: bool = True
    alert_rules: List[Dict[str, Any]] = field(default_factory=list)
    
    # 调试配置
    debug_mode: bool = False
    log_level: str = "INFO"


# ================================
# 指标聚合器
# ================================

class MetricAggregator:
    """指标聚合器"""
    
    def __init__(self):
        self._aggregation_functions = {
            AggregationType.SUM: self._sum,
            AggregationType.AVG: self._avg,
            AggregationType.MIN: self._min,
            AggregationType.MAX: self._max,
            AggregationType.COUNT: self._count,
            AggregationType.P50: lambda values: self._percentile(values, 0.5),
            AggregationType.P90: lambda values: self._percentile(values, 0.9),
            AggregationType.P95: lambda values: self._percentile(values, 0.95),
            AggregationType.P99: lambda values: self._percentile(values, 0.99),
        }
    
    def aggregate(self, samples: List[MetricSample], aggregation_type: AggregationType) -> Optional[float]:
        """聚合样本"""
        if not samples:
            return None
        
        values = [s.value for s in samples]
        aggregation_func = self._aggregation_functions.get(aggregation_type)
        
        if aggregation_func:
            return aggregation_func(values)
        else:
            raise ValueError(f"不支持的聚合类型: {aggregation_type}")
    
    def aggregate_by_time_window(
        self,
        samples: List[MetricSample],
        window_size: timedelta,
        aggregation_type: AggregationType
    ) -> List[Tuple[datetime, float]]:
        """按时间窗口聚合"""
        if not samples:
            return []
        
        # 按时间排序
        sorted_samples = sorted(samples, key=lambda s: s.timestamp)
        
        # 计算时间窗口
        start_time = sorted_samples[0].timestamp
        end_time = sorted_samples[-1].timestamp
        
        results = []
        current_time = start_time
        
        while current_time <= end_time:
            window_end = current_time + window_size
            window_samples = [
                s for s in sorted_samples 
                if current_time <= s.timestamp < window_end
            ]
            
            if window_samples:
                aggregated_value = self.aggregate(window_samples, aggregation_type)
                if aggregated_value is not None:
                    results.append((current_time, aggregated_value))
            
            current_time = window_end
        
        return results
    
    def _sum(self, values: List[float]) -> float:
        return sum(values)
    
    def _avg(self, values: List[float]) -> float:
        return sum(values) / len(values) if values else 0
    
    def _min(self, values: List[float]) -> float:
        return min(values)
    
    def _max(self, values: List[float]) -> float:
        return max(values)
    
    def _count(self, values: List[float]) -> float:
        return len(values)
    
    def _percentile(self, values: List[float], percentile: float) -> float:
        """计算分位数"""
        if not values:
            return 0
        
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile)
        index = min(index, len(sorted_values) - 1)
        return sorted_values[index]


# ================================
# 指标导出器基类
# ================================

class MetricsExporter:
    """指标导出器基类"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    async def export(self, metrics: List[MetricFamily]) -> bool:
        """导出指标"""
        raise NotImplementedError
    
    def format_metrics(self, metrics: List[MetricFamily]) -> str:
        """格式化指标"""
        raise NotImplementedError


class PrometheusExporter(MetricsExporter):
    """Prometheus格式导出器"""
    
    def format_metrics(self, metrics: List[MetricFamily]) -> str:
        """格式化为Prometheus格式"""
        lines = []
        
        for family in metrics:
            # 添加HELP和TYPE注释
            if family.description:
                lines.append(f"# HELP {family.name} {family.description}")
            lines.append(f"# TYPE {family.name} {family.metric_type.value}")
            
            # 添加指标数据
            for metric in family.get_all_metrics():
                for sample in metric.samples:
                    labels_str = ""
                    if sample.labels:
                        labels_list = [f'{k}="{v}"' for k, v in sample.labels.items()]
                        labels_str = "{" + ",".join(labels_list) + "}"
                    
                    timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                    lines.append(f"{metric.name}{labels_str} {sample.value} {timestamp_ms}")
            
            lines.append("")  # 空行分隔
        
        return "\n".join(lines)
    
    async def export(self, metrics: List[MetricFamily]) -> bool:
        """导出到Prometheus"""
        try:
            formatted_metrics = self.format_metrics(metrics)
            
            # 这里可以实现HTTP服务器或写入文件
            # 简化实现：写入文件
            output_file = self.config.get('output_file', '/tmp/metrics.prom')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(formatted_metrics)
            
            return True
        except Exception as e:
            self.logger.error(f"Prometheus导出失败: {e}")
            return False


class JsonExporter(MetricsExporter):
    """JSON格式导出器"""
    
    def format_metrics(self, metrics: List[MetricFamily]) -> str:
        """格式化为JSON格式"""
        data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'metrics': [family.to_dict() for family in metrics]
        }
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    async def export(self, metrics: List[MetricFamily]) -> bool:
        """导出为JSON"""
        try:
            formatted_metrics = self.format_metrics(metrics)
            
            output_file = self.config.get('output_file', '/tmp/metrics.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(formatted_metrics)
            
            return True
        except Exception as e:
            self.logger.error(f"JSON导出失败: {e}")
            return False


class InfluxDBExporter(MetricsExporter):
    """InfluxDB格式导出器"""
    
    def format_metrics(self, metrics: List[MetricFamily]) -> str:
        """格式化为InfluxDB Line Protocol格式"""
        lines = []
        
        for family in metrics:
            for metric in family.get_all_metrics():
                for sample in metric.samples:
                    # 构建标签字符串
                    tags = []
                    if sample.labels:
                        tags = [f"{k}={v}" for k, v in sample.labels.items()]
                    tags_str = "," + ",".join(tags) if tags else ""
                    
                    # 时间戳(纳秒)
                    timestamp_ns = int(sample.timestamp.timestamp() * 1_000_000_000)
                    
                    # InfluxDB Line Protocol格式
                    line = f"{metric.name}{tags_str} value={sample.value} {timestamp_ns}"
                    lines.append(line)
        
        return "\n".join(lines)
    
    async def export(self, metrics: List[MetricFamily]) -> bool:
        """导出到InfluxDB"""
        try:
            formatted_metrics = self.format_metrics(metrics)
            
            # 这里可以实现InfluxDB客户端
            # 简化实现：写入文件
            output_file = self.config.get('output_file', '/tmp/metrics.influx')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(formatted_metrics)
            
            return True
        except Exception as e:
            self.logger.error(f"InfluxDB导出失败: {e}")
            return False


# ================================
# 核心指标服务
# ================================

class AdapterMetricsService(AsyncService):
    """
    适配器指标收集服务
    
    提供全面的指标收集、聚合、存储和导出功能。
    """
    
    def __init__(
        self,
        config: Optional[MetricsServiceConfig] = None,
        audit_logger: Optional[AuditLogger] = None
    ):
        """初始化指标服务"""
        super().__init__("adapter_metrics")
        
        self.config = config or MetricsServiceConfig()
        self.audit_logger = audit_logger or get_audit_logger()
        
        # 指标存储
        self._metric_families: Dict[str, MetricFamily] = {}
        self._metrics_lock = threading.RLock()
        
        # 聚合器和导出器
        self.aggregator = MetricAggregator()
        self._exporters: List[MetricsExporter] = []
        
        # 收集器管理
        self._collectors: List[Any] = []  # 将在collectors模块中定义具体类型
        self._collection_tasks: Set[asyncio.Task] = set()
        
        # 性能统计
        self._service_metrics = ServiceMetrics()
        
        # 线程池
        self._thread_pool = ThreadPoolExecutor(
            max_workers=self.config.max_concurrent_collections,
            thread_name_prefix="metrics-collector"
        )
        
        # 定时任务
        self._collection_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        
        logger.info(f"AdapterMetricsService initialized with config: {self.config}")
    
    async def initialize(self) -> None:
        """初始化服务"""
        try:
            self._status = ServiceStatus.INITIALIZING
            logger.info("Initializing AdapterMetricsService...")
            
            # 初始化导出器
            await self._setup_exporters()
            
            # 设置默认指标
            await self._setup_default_metrics()
            
            self._status = ServiceStatus.READY
            logger.info("AdapterMetricsService initialized successfully")
            
        except Exception as e:
            self._status = ServiceStatus.ERROR
            logger.error(f"Failed to initialize AdapterMetricsService: {e}")
            raise
    
    async def start(self) -> None:
        """启动服务"""
        if self._status != ServiceStatus.READY:
            raise RuntimeError(f"Service not ready, current status: {self._status}")
        
        try:
            self._status = ServiceStatus.RUNNING
            logger.info("Starting AdapterMetricsService...")
            
            # 启动收集任务
            self._collection_task = asyncio.create_task(self._collection_loop())
            
            # 启动清理任务
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            
            logger.info("AdapterMetricsService started successfully")
            
        except Exception as e:
            self._status = ServiceStatus.ERROR
            logger.error(f"Failed to start AdapterMetricsService: {e}")
            raise
    
    async def stop(self) -> None:
        """停止服务"""
        try:
            self._status = ServiceStatus.STOPPING
            logger.info("Stopping AdapterMetricsService...")
            
            # 取消定时任务
            if self._collection_task:
                self._collection_task.cancel()
                try:
                    await self._collection_task
                except asyncio.CancelledError:
                    pass
            
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass
            
            # 等待所有收集任务完成
            if self._collection_tasks:
                await asyncio.gather(*self._collection_tasks, return_exceptions=True)
                self._collection_tasks.clear()
            
            # 关闭线程池
            self._thread_pool.shutdown(wait=True)
            
            self._status = ServiceStatus.STOPPED
            logger.info("AdapterMetricsService stopped successfully")
            
        except Exception as e:
            self._status = ServiceStatus.ERROR
            logger.error(f"Failed to stop AdapterMetricsService: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            with self._metrics_lock:
                metrics_count = len(self._metric_families)
                total_samples = sum(
                    len(metric.samples)
                    for family in self._metric_families.values()
                    for metric in family.get_all_metrics()
                )
            
            return {
                'status': self._status.value,
                'health': ServiceHealth.HEALTHY.value,
                'metrics_families': metrics_count,
                'total_samples': total_samples,
                'active_collectors': len(self._collectors),
                'active_collection_tasks': len(self._collection_tasks),
                'service_metrics': {
                    'request_count': self._service_metrics.request_count,
                    'error_count': self._service_metrics.error_count,
                    'avg_response_time': self._service_metrics.avg_response_time,
                    'uptime': self._service_metrics.uptime
                }
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                'status': self._status.value,
                'health': ServiceHealth.UNHEALTHY.value,
                'error': str(e)
            }
    
    # ================================
    # 指标管理方法
    # ================================
    
    def create_metric_family(
        self,
        name: str,
        metric_type: MetricType,
        description: str = "",
        unit: str = ""
    ) -> MetricFamily:
        """创建指标族"""
        with self._metrics_lock:
            if name in self._metric_families:
                return self._metric_families[name]
            
            family = MetricFamily(
                name=name,
                metric_type=metric_type,
                description=description,
                unit=unit
            )
            self._metric_families[name] = family
            
            logger.debug(f"Created metric family: {name} ({metric_type.value})")
            return family
    
    def get_metric_family(self, name: str) -> Optional[MetricFamily]:
        """获取指标族"""
        with self._metrics_lock:
            return self._metric_families.get(name)
    
    def record_metric(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None
    ) -> None:
        """记录指标值"""
        with self._metrics_lock:
            family = self._metric_families.get(name)
            if family:
                family.add_sample(value, labels, timestamp)
                self._service_metrics.request_count += 1
            else:
                logger.warning(f"Metric family not found: {name}")
    
    def increment_counter(
        self,
        name: str,
        value: float = 1.0,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """递增计数器"""
        family = self.get_metric_family(name)
        if not family:
            family = self.create_metric_family(name, MetricType.COUNTER)
        
        # 获取当前值并递增
        metric = family.get_or_create_metric(labels)
        current_value = metric.get_latest_value() or 0
        self.record_metric(name, current_value + value, labels)
    
    def set_gauge(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """设置仪表值"""
        family = self.get_metric_family(name)
        if not family:
            family = self.create_metric_family(name, MetricType.GAUGE)
        
        self.record_metric(name, value, labels)
    
    def observe_histogram(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """观察直方图值"""
        family = self.get_metric_family(name)
        if not family:
            family = self.create_metric_family(name, MetricType.HISTOGRAM)
        
        self.record_metric(name, value, labels)
    
    def time_operation(self, name: str, labels: Optional[Dict[str, str]] = None):
        """计时操作装饰器/上下文管理器"""
        class TimerContext:
            def __init__(self, service, metric_name, metric_labels):
                self.service = service
                self.metric_name = metric_name
                self.metric_labels = metric_labels
                self.start_time = None
            
            def __enter__(self):
                self.start_time = time.time()
                return self
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.start_time:
                    duration = time.time() - self.start_time
                    self.service.observe_histogram(self.metric_name, duration, self.metric_labels)
        
        return TimerContext(self, name, labels)
    
    # ================================
    # 查询和聚合方法
    # ================================
    
    def query_metrics(
        self,
        name: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None
    ) -> List[MetricSample]:
        """查询指标"""
        with self._metrics_lock:
            family = self._metric_families.get(name)
            if not family:
                return []
            
            all_samples = []
            for metric in family.get_all_metrics():
                # 过滤标签
                if labels:
                    if not all(metric.labels.get(k) == v for k, v in labels.items()):
                        continue
                
                # 过滤时间范围
                if start_time or end_time:
                    samples = metric.get_samples_in_range(
                        start_time or datetime.min.replace(tzinfo=timezone.utc),
                        end_time or datetime.now(timezone.utc)
                    )
                else:
                    samples = metric.samples
                
                all_samples.extend(samples)
            
            return sorted(all_samples, key=lambda s: s.timestamp)
    
    def aggregate_metrics(
        self,
        name: str,
        aggregation_type: AggregationType,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None
    ) -> Optional[float]:
        """聚合指标"""
        samples = self.query_metrics(name, start_time, end_time, labels)
        return self.aggregator.aggregate(samples, aggregation_type)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """获取指标摘要"""
        with self._metrics_lock:
            summary = {
                'total_families': len(self._metric_families),
                'families': {}
            }
            
            for name, family in self._metric_families.items():
                metrics = family.get_all_metrics()
                total_samples = sum(len(m.samples) for m in metrics)
                
                latest_values = {}
                for metric in metrics:
                    if metric.samples:
                        labels_key = json.dumps(sorted(metric.labels.items()))
                        latest_values[labels_key] = metric.get_latest_value()
                
                summary['families'][name] = {
                    'type': family.metric_type.value,
                    'description': family.description,
                    'unit': family.unit,
                    'metrics_count': len(metrics),
                    'total_samples': total_samples,
                    'latest_values': latest_values
                }
            
            return summary
    
    # ================================
    # 导出方法
    # ================================
    
    async def export_metrics(self, format_type: str = "prometheus") -> str:
        """导出指标"""
        with self._metrics_lock:
            families = list(self._metric_families.values())
        
        if format_type.lower() == "prometheus":
            exporter = PrometheusExporter({})
            return exporter.format_metrics(families)
        elif format_type.lower() == "json":
            exporter = JsonExporter({})
            return exporter.format_metrics(families)
        elif format_type.lower() == "influxdb":
            exporter = InfluxDBExporter({})
            return exporter.format_metrics(families)
        else:
            raise ValueError(f"不支持的导出格式: {format_type}")
    
    async def export_to_file(self, file_path: str, format_type: str = "json") -> bool:
        """导出到文件"""
        try:
            content = await self.export_metrics(format_type)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except Exception as e:
            logger.error(f"导出到文件失败: {e}")
            return False
    
    # ================================
    # 内部方法
    # ================================
    
    async def _setup_exporters(self) -> None:
        """设置导出器"""
        if self.config.enable_prometheus:
            prometheus_config = {
                'output_file': '/tmp/metrics.prom',
                **self.config.storage_config.get('prometheus', {})
            }
            self._exporters.append(PrometheusExporter(prometheus_config))
        
        if self.config.enable_json_export:
            json_config = {
                'output_file': self.config.json_export_path,
                **self.config.storage_config.get('json', {})
            }
            self._exporters.append(JsonExporter(json_config))
    
    async def _setup_default_metrics(self) -> None:
        """设置默认指标"""
        # 系统指标
        self.create_metric_family("system_cpu_percent", MetricType.GAUGE, "CPU使用率", "%")
        self.create_metric_family("system_memory_percent", MetricType.GAUGE, "内存使用率", "%")
        self.create_metric_family("system_disk_percent", MetricType.GAUGE, "磁盘使用率", "%")
        
        # 适配器指标
        self.create_metric_family("adapter_execution_count", MetricType.COUNTER, "适配器执行次数")
        self.create_metric_family("adapter_execution_time", MetricType.HISTOGRAM, "适配器执行时间", "seconds")
        self.create_metric_family("adapter_error_count", MetricType.COUNTER, "适配器错误次数")
        
        # 服务指标
        self.create_metric_family("service_request_count", MetricType.COUNTER, "服务请求次数")
        self.create_metric_family("service_response_time", MetricType.HISTOGRAM, "服务响应时间", "seconds")
        self.create_metric_family("service_error_count", MetricType.COUNTER, "服务错误次数")
    
    async def _collection_loop(self) -> None:
        """指标收集循环"""
        logger.info(f"Starting metrics collection loop with interval: {self.config.collection_interval}s")
        
        while self._status == ServiceStatus.RUNNING:
            try:
                # 收集所有注册的收集器的指标
                collection_tasks = []
                for collector in self._collectors:
                    if hasattr(collector, 'collect'):
                        task = asyncio.create_task(self._collect_from_collector(collector))
                        collection_tasks.append(task)
                        self._collection_tasks.add(task)
                
                # 等待所有收集任务完成
                if collection_tasks:
                    await asyncio.gather(*collection_tasks, return_exceptions=True)
                
                # 清理完成的任务
                self._collection_tasks = {t for t in self._collection_tasks if not t.done()}
                
                # 导出指标
                await self._export_metrics()
                
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
                self._service_metrics.error_count += 1
            
            # 等待下次收集
            await asyncio.sleep(self.config.collection_interval)
    
    async def _collect_from_collector(self, collector) -> None:
        """从收集器收集指标"""
        try:
            start_time = time.time()
            
            # 调用收集器的collect方法
            if asyncio.iscoroutinefunction(collector.collect):
                await collector.collect()
            else:
                # 在线程池中执行同步收集器
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(self._thread_pool, collector.collect)
            
            # 记录收集时间
            collection_time = time.time() - start_time
            self.observe_histogram(
                "metrics_collection_time",
                collection_time,
                {"collector": collector.__class__.__name__}
            )
            
        except Exception as e:
            logger.error(f"Error collecting from {collector.__class__.__name__}: {e}")
            self.increment_counter(
                "metrics_collection_errors",
                labels={"collector": collector.__class__.__name__}
            )
    
    async def _export_metrics(self) -> None:
        """导出指标"""
        try:
            with self._metrics_lock:
                families = list(self._metric_families.values())
            
            # 并发导出到所有导出器
            export_tasks = []
            for exporter in self._exporters:
                task = asyncio.create_task(exporter.export(families))
                export_tasks.append(task)
            
            if export_tasks:
                results = await asyncio.gather(*export_tasks, return_exceptions=True)
                
                # 统计导出结果
                success_count = sum(1 for r in results if r is True)
                self.set_gauge("metrics_export_success_count", success_count)
                
        except Exception as e:
            logger.error(f"Metrics export error: {e}")
            self.increment_counter("metrics_export_errors")
    
    async def _cleanup_loop(self) -> None:
        """清理循环 - 定期清理过期数据"""
        logger.info("Starting metrics cleanup loop")
        
        while self._status == ServiceStatus.RUNNING:
            try:
                await self._cleanup_expired_samples()
                
            except Exception as e:
                logger.error(f"Metrics cleanup error: {e}")
            
            # 每小时清理一次
            await asyncio.sleep(3600)
    
    async def _cleanup_expired_samples(self) -> None:
        """清理过期样本"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=self.config.retention_period)
        cleaned_count = 0
        
        with self._metrics_lock:
            for family in self._metric_families.values():
                for metric in family.get_all_metrics():
                    original_count = len(metric.samples)
                    
                    # 保留未过期的样本
                    metric.samples = [
                        s for s in metric.samples
                        if s.timestamp > cutoff_time
                    ]
                    
                    # 限制样本数量
                    if len(metric.samples) > self.config.max_samples_per_metric:
                        metric.samples = metric.samples[-self.config.max_samples_per_metric:]
                    
                    cleaned_count += original_count - len(metric.samples)
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} expired metric samples")
            self.set_gauge("metrics_cleanup_count", cleaned_count)
    
    def add_collector(self, collector) -> None:
        """添加收集器"""
        self._collectors.append(collector)
        logger.info(f"Added metrics collector: {collector.__class__.__name__}")
    
    def remove_collector(self, collector) -> None:
        """移除收集器"""
        if collector in self._collectors:
            self._collectors.remove(collector)
            logger.info(f"Removed metrics collector: {collector.__class__.__name__}")

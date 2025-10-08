"""
指标导出器

提供多种格式的指标导出功能，包括Prometheus、OpenTelemetry、JSON等格式。
"""

import asyncio
import logging
import json
import time
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import threading
from urllib.parse import quote

from .core import Metric, MetricFamily, MetricSample, MetricType
from .storage import MetricsStorage

# 尝试导入可选依赖
try:
    from aiohttp import web

    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

try:
    import yaml

    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

logger = logging.getLogger(__name__)


# ================================
# 导出器基类
# ================================


class ExportFormat(str, Enum):
    """导出格式"""

    PROMETHEUS = "prometheus"
    OPENTELEMETRY = "opentelemetry"
    JSON = "json"
    YAML = "yaml"
    CSV = "csv"
    INFLUXDB = "influxdb"
    GRAPHITE = "graphite"


@dataclass
class ExportConfig:
    """导出配置"""

    format: ExportFormat
    endpoint: str = "/metrics"
    port: int = 8080
    host: str = "0.0.0.0"

    # 过滤配置
    include_metrics: Optional[List[str]] = None
    exclude_metrics: Optional[List[str]] = None
    include_labels: Optional[Dict[str, List[str]]] = None
    exclude_labels: Optional[Dict[str, List[str]]] = None

    # 格式特定配置
    prometheus_config: Dict[str, Any] = field(default_factory=dict)
    opentelemetry_config: Dict[str, Any] = field(default_factory=dict)

    # 其他配置
    cache_ttl: int = 30  # 缓存TTL（秒）
    max_samples_per_metric: int = 1000

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "format": self.format.value,
            "endpoint": self.endpoint,
            "port": self.port,
            "host": self.host,
            "include_metrics": self.include_metrics,
            "exclude_metrics": self.exclude_metrics,
            "include_labels": self.include_labels,
            "exclude_labels": self.exclude_labels,
            "prometheus_config": self.prometheus_config,
            "opentelemetry_config": self.opentelemetry_config,
            "cache_ttl": self.cache_ttl,
            "max_samples_per_metric": self.max_samples_per_metric,
        }


class MetricsExporter(ABC):
    """指标导出器基类"""

    def __init__(self, storage: MetricsStorage, config: ExportConfig):
        """初始化导出器"""
        self.storage = storage
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

        # 缓存
        self._cache: Optional[Tuple[datetime, str]] = None
        self._cache_lock = threading.Lock()

        # 统计信息
        self.export_count = 0
        self.error_count = 0
        self.last_export_time: Optional[datetime] = None
        self.last_error: Optional[str] = None

    @abstractmethod
    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出指标"""
        pass

    async def get_metrics_data(self) -> str:
        """获取指标数据"""
        try:
            # 检查缓存
            if self._is_cache_valid():
                with self._cache_lock:
                    if self._cache:
                        return self._cache[1]

            # 从存储读取指标
            metrics = await self._fetch_metrics()

            # 过滤指标
            filtered_metrics = self._filter_metrics(metrics)

            # 导出指标
            exported_data = await self.export_metrics(filtered_metrics)

            # 更新缓存
            with self._cache_lock:
                self._cache = (datetime.now(timezone.utc), exported_data)

            # 更新统计信息
            self.export_count += 1
            self.last_export_time = datetime.now(timezone.utc)

            return exported_data

        except Exception as e:
            error_msg = f"Failed to export metrics: {e}"
            self.logger.error(error_msg)

            self.error_count += 1
            self.last_error = error_msg

            raise

    def _is_cache_valid(self) -> bool:
        """检查缓存是否有效"""
        with self._cache_lock:
            if not self._cache:
                return False

            cache_time, _ = self._cache
            age = (datetime.now(timezone.utc) - cache_time).total_seconds()
            return age < self.config.cache_ttl

    async def _fetch_metrics(self) -> List[MetricFamily]:
        """从存储获取指标"""
        # 获取最近的指标数据
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(minutes=5)  # 最近5分钟

        return await self.storage.read_metrics(
            names=self.config.include_metrics,
            start_time=start_time,
            end_time=end_time,
            limit=self.config.max_samples_per_metric,
        )

    def _filter_metrics(self, metrics: List[MetricFamily]) -> List[MetricFamily]:
        """过滤指标"""
        filtered = []

        for family in metrics:
            # 检查指标名称过滤
            if (
                self.config.exclude_metrics
                and family.name in self.config.exclude_metrics
            ):
                continue

            if (
                self.config.include_metrics
                and family.name not in self.config.include_metrics
            ):
                continue

            # 过滤指标中的样本
            filtered_family = MetricFamily(
                name=family.name,
                metric_type=family.metric_type,
                description=family.description,
                unit=family.unit,
            )

            for metric in family.get_all_metrics():
                filtered_samples = self._filter_samples(metric.samples)

                if filtered_samples:
                    filtered_metric = Metric(
                        name=metric.name,
                        metric_type=metric.metric_type,
                        description=metric.description,
                        unit=metric.unit,
                        labels=metric.labels,
                        samples=filtered_samples,
                    )

                    labels_key = json.dumps(
                        sorted(metric.labels.items()), ensure_ascii=False
                    )
                    filtered_family.metrics[labels_key] = filtered_metric

            if filtered_family.metrics:
                filtered.append(filtered_family)

        return filtered

    def _filter_samples(self, samples: List[MetricSample]) -> List[MetricSample]:
        """过滤样本"""
        filtered = []

        for sample in samples:
            # 检查标签过滤
            if self._should_exclude_sample(sample):
                continue

            filtered.append(sample)

        return filtered

    def _should_exclude_sample(self, sample: MetricSample) -> bool:
        """检查是否应该排除样本"""
        # 检查排除标签
        if self.config.exclude_labels:
            for label_key, label_values in self.config.exclude_labels.items():
                if (
                    label_key in sample.labels
                    and sample.labels[label_key] in label_values
                ):
                    return True

        # 检查包含标签
        if self.config.include_labels:
            for label_key, label_values in self.config.include_labels.items():
                if (
                    label_key in sample.labels
                    and sample.labels[label_key] not in label_values
                ):
                    return True

        return False

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "export_count": self.export_count,
            "error_count": self.error_count,
            "last_export_time": self.last_export_time.isoformat()
            if self.last_export_time
            else None,
            "last_error": self.last_error,
            "cache_valid": self._is_cache_valid(),
        }


# ================================
# Prometheus导出器
# ================================


class PrometheusExporter(MetricsExporter):
    """Prometheus格式导出器"""

    def __init__(self, storage: MetricsStorage, config: ExportConfig):
        super().__init__(storage, config)

        # Prometheus特定配置
        self.include_timestamp = config.prometheus_config.get("include_timestamp", True)
        self.metric_prefix = config.prometheus_config.get("metric_prefix", "zishu_")
        self.help_text = config.prometheus_config.get("include_help", True)
        self.type_text = config.prometheus_config.get("include_type", True)

    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出Prometheus格式指标"""
        lines = []

        # 添加头部注释
        lines.append(
            f"# Generated by Zishu Metrics at {datetime.now(timezone.utc).isoformat()}"
        )
        lines.append("")

        for family in metrics:
            # 处理指标名称
            metric_name = self._sanitize_metric_name(family.name)
            if self.metric_prefix and not metric_name.startswith(self.metric_prefix):
                metric_name = self.metric_prefix + metric_name

            # 添加HELP注释
            if self.help_text and family.description:
                lines.append(f"# HELP {metric_name} {family.description}")

            # 添加TYPE注释
            if self.type_text:
                prom_type = self._get_prometheus_type(family.metric_type)
                lines.append(f"# TYPE {metric_name} {prom_type}")

            # 导出指标数据
            for metric in family.get_all_metrics():
                metric_lines = self._export_metric_samples(metric_name, metric)
                lines.extend(metric_lines)

            lines.append("")  # 空行分隔不同指标族

        return "\n".join(lines)

    def _sanitize_metric_name(self, name: str) -> str:
        """清理指标名称以符合Prometheus规范"""
        # 替换非法字符为下划线
        sanitized = re.sub(r"[^a-zA-Z0-9_:]", "_", name)

        # 确保以字母或下划线开头
        if sanitized and not sanitized[0].isalpha() and sanitized[0] != "_":
            sanitized = "_" + sanitized

        return sanitized

    def _sanitize_label_name(self, name: str) -> str:
        """清理标签名称"""
        # 替换非法字符为下划线
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name)

        # 确保以字母或下划线开头
        if sanitized and not sanitized[0].isalpha() and sanitized[0] != "_":
            sanitized = "_" + sanitized

        return sanitized

    def _get_prometheus_type(self, metric_type: MetricType) -> str:
        """获取Prometheus指标类型"""
        type_mapping = {
            MetricType.COUNTER: "counter",
            MetricType.GAUGE: "gauge",
            MetricType.HISTOGRAM: "histogram",
            MetricType.SUMMARY: "summary",
        }
        return type_mapping.get(metric_type, "gauge")

    def _export_metric_samples(self, metric_name: str, metric: Metric) -> List[str]:
        """导出指标样本"""
        lines = []

        if metric.metric_type == MetricType.HISTOGRAM:
            lines.extend(self._export_histogram_samples(metric_name, metric))
        elif metric.metric_type == MetricType.SUMMARY:
            lines.extend(self._export_summary_samples(metric_name, metric))
        else:
            lines.extend(self._export_simple_samples(metric_name, metric))

        return lines

    def _export_simple_samples(self, metric_name: str, metric: Metric) -> List[str]:
        """导出简单指标样本"""
        lines = []

        for sample in metric.samples:
            # 构建标签字符串
            labels_str = self._build_labels_string(sample.labels)

            # 构建指标行
            if labels_str:
                metric_line = f"{metric_name}{{{labels_str}}}"
            else:
                metric_line = metric_name

            metric_line += f" {sample.value}"

            # 添加时间戳
            if self.include_timestamp:
                timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                metric_line += f" {timestamp_ms}"

            lines.append(metric_line)

        return lines

    def _export_histogram_samples(self, metric_name: str, metric: Metric) -> List[str]:
        """导出直方图样本"""
        lines = []

        # 对于直方图，我们需要生成bucket、sum和count指标
        # 这里简化处理，将单个值作为观察值

        for sample in metric.samples:
            labels_str = self._build_labels_string(sample.labels)
            base_labels = sample.labels.copy()

            # 生成bucket（简化为几个固定bucket）
            buckets = [0.1, 0.5, 1.0, 2.5, 5.0, 10.0, float("inf")]
            bucket_count = 0

            for bucket in buckets:
                if sample.value <= bucket:
                    bucket_count += 1

                bucket_labels = base_labels.copy()
                bucket_labels["le"] = str(bucket) if bucket != float("inf") else "+Inf"
                bucket_labels_str = self._build_labels_string(bucket_labels)

                if bucket_labels_str:
                    bucket_line = (
                        f"{metric_name}_bucket{{{bucket_labels_str}}} {bucket_count}"
                    )
                else:
                    bucket_line = f"{metric_name}_bucket {bucket_count}"

                if self.include_timestamp:
                    timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                    bucket_line += f" {timestamp_ms}"

                lines.append(bucket_line)

            # 生成sum和count
            if labels_str:
                sum_line = f"{metric_name}_sum{{{labels_str}}} {sample.value}"
                count_line = f"{metric_name}_count{{{labels_str}}} 1"
            else:
                sum_line = f"{metric_name}_sum {sample.value}"
                count_line = f"{metric_name}_count 1"

            if self.include_timestamp:
                timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                sum_line += f" {timestamp_ms}"
                count_line += f" {timestamp_ms}"

            lines.extend([sum_line, count_line])

        return lines

    def _export_summary_samples(self, metric_name: str, metric: Metric) -> List[str]:
        """导出摘要样本"""
        lines = []

        # 对于摘要，我们需要生成quantile、sum和count指标
        # 这里简化处理

        for sample in metric.samples:
            labels_str = self._build_labels_string(sample.labels)
            base_labels = sample.labels.copy()

            # 生成quantile（简化为几个固定分位数）
            quantiles = [0.5, 0.9, 0.95, 0.99]

            for quantile in quantiles:
                quantile_labels = base_labels.copy()
                quantile_labels["quantile"] = str(quantile)
                quantile_labels_str = self._build_labels_string(quantile_labels)

                # 简化：使用当前值作为分位数值
                quantile_value = sample.value

                if quantile_labels_str:
                    quantile_line = (
                        f"{metric_name}{{{quantile_labels_str}}} {quantile_value}"
                    )
                else:
                    quantile_line = f"{metric_name} {quantile_value}"

                if self.include_timestamp:
                    timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                    quantile_line += f" {timestamp_ms}"

                lines.append(quantile_line)

            # 生成sum和count
            if labels_str:
                sum_line = f"{metric_name}_sum{{{labels_str}}} {sample.value}"
                count_line = f"{metric_name}_count{{{labels_str}}} 1"
            else:
                sum_line = f"{metric_name}_sum {sample.value}"
                count_line = f"{metric_name}_count 1"

            if self.include_timestamp:
                timestamp_ms = int(sample.timestamp.timestamp() * 1000)
                sum_line += f" {timestamp_ms}"
                count_line += f" {timestamp_ms}"

            lines.extend([sum_line, count_line])

        return lines

    def _build_labels_string(self, labels: Dict[str, str]) -> str:
        """构建标签字符串"""
        if not labels:
            return ""

        label_pairs = []
        for key, value in sorted(labels.items()):
            # 清理标签名称
            clean_key = self._sanitize_label_name(key)

            # 转义标签值
            escaped_value = (
                value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            )

            label_pairs.append(f'{clean_key}="{escaped_value}"')

        return ",".join(label_pairs)


# ================================
# JSON导出器
# ================================


class JSONExporter(MetricsExporter):
    """JSON格式导出器"""

    def __init__(self, storage: MetricsStorage, config: ExportConfig):
        super().__init__(storage, config)
        self.pretty_print = config.prometheus_config.get("pretty_print", True)

    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出JSON格式指标"""
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metrics": [family.to_dict() for family in metrics],
        }

        if self.pretty_print:
            return json.dumps(data, ensure_ascii=False, indent=2)
        else:
            return json.dumps(data, ensure_ascii=False)


# ================================
# OpenTelemetry导出器
# ================================


class OpenTelemetryExporter(MetricsExporter):
    """OpenTelemetry格式导出器"""

    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出OpenTelemetry格式指标"""
        # OpenTelemetry指标格式
        resource_metrics = {
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "zishu-metrics"}},
                    {"key": "service.version", "value": {"stringValue": "1.0.0"}},
                ]
            },
            "instrumentationLibraryMetrics": [
                {
                    "instrumentationLibrary": {
                        "name": "zishu.metrics",
                        "version": "1.0.0",
                    },
                    "metrics": [],
                }
            ],
        }

        otel_metrics = []

        for family in metrics:
            for metric in family.get_all_metrics():
                otel_metric = self._convert_to_otel_metric(metric)
                if otel_metric:
                    otel_metrics.append(otel_metric)

        resource_metrics["instrumentationLibraryMetrics"][0]["metrics"] = otel_metrics

        return json.dumps(
            {"resourceMetrics": [resource_metrics]}, ensure_ascii=False, indent=2
        )

    def _convert_to_otel_metric(self, metric: Metric) -> Optional[Dict[str, Any]]:
        """转换为OpenTelemetry指标格式"""
        if not metric.samples:
            return None

        otel_metric = {
            "name": metric.name,
            "description": metric.description,
            "unit": metric.unit or "",
        }

        # 根据指标类型设置数据点
        if metric.metric_type == MetricType.COUNTER:
            otel_metric["sum"] = {
                "dataPoints": self._create_number_data_points(metric.samples),
                "aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
                "isMonotonic": True,
            }
        elif metric.metric_type == MetricType.GAUGE:
            otel_metric["gauge"] = {
                "dataPoints": self._create_number_data_points(metric.samples)
            }
        elif metric.metric_type == MetricType.HISTOGRAM:
            otel_metric["histogram"] = {
                "dataPoints": self._create_histogram_data_points(metric.samples),
                "aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
            }
        elif metric.metric_type == MetricType.SUMMARY:
            otel_metric["summary"] = {
                "dataPoints": self._create_summary_data_points(metric.samples)
            }

        return otel_metric

    def _create_number_data_points(
        self, samples: List[MetricSample]
    ) -> List[Dict[str, Any]]:
        """创建数值数据点"""
        data_points = []

        for sample in samples:
            data_point = {
                "attributes": [
                    {"key": k, "value": {"stringValue": v}}
                    for k, v in sample.labels.items()
                ],
                "timeUnixNano": int(sample.timestamp.timestamp() * 1_000_000_000),
                "asDouble": sample.value,
            }
            data_points.append(data_point)

        return data_points

    def _create_histogram_data_points(
        self, samples: List[MetricSample]
    ) -> List[Dict[str, Any]]:
        """创建直方图数据点"""
        data_points = []

        for sample in samples:
            # 简化的直方图数据点
            data_point = {
                "attributes": [
                    {"key": k, "value": {"stringValue": v}}
                    for k, v in sample.labels.items()
                ],
                "timeUnixNano": int(sample.timestamp.timestamp() * 1_000_000_000),
                "count": 1,
                "sum": sample.value,
                "bucketCounts": [0, 0, 0, 1],  # 简化的bucket计数
                "explicitBounds": [0.1, 1.0, 10.0],  # 简化的边界
            }
            data_points.append(data_point)

        return data_points

    def _create_summary_data_points(
        self, samples: List[MetricSample]
    ) -> List[Dict[str, Any]]:
        """创建摘要数据点"""
        data_points = []

        for sample in samples:
            # 简化的摘要数据点
            data_point = {
                "attributes": [
                    {"key": k, "value": {"stringValue": v}}
                    for k, v in sample.labels.items()
                ],
                "timeUnixNano": int(sample.timestamp.timestamp() * 1_000_000_000),
                "count": 1,
                "sum": sample.value,
                "quantileValues": [
                    {"quantile": 0.5, "value": sample.value},
                    {"quantile": 0.9, "value": sample.value},
                    {"quantile": 0.99, "value": sample.value},
                ],
            }
            data_points.append(data_point)

        return data_points


# ================================
# InfluxDB Line Protocol导出器
# ================================


class InfluxDBExporter(MetricsExporter):
    """InfluxDB Line Protocol格式导出器"""

    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出InfluxDB Line Protocol格式指标"""
        lines = []

        for family in metrics:
            for metric in family.get_all_metrics():
                for sample in samples:
                    line = self._create_line_protocol_line(metric, sample)
                    if line:
                        lines.append(line)

        return "\n".join(lines)

    def _create_line_protocol_line(self, metric: Metric, sample: MetricSample) -> str:
        """创建Line Protocol行"""
        # measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp

        # 测量名称
        measurement = self._escape_measurement_name(metric.name)

        # 标签
        tag_pairs = []
        for key, value in sample.labels.items():
            escaped_key = self._escape_tag_key(key)
            escaped_value = self._escape_tag_value(value)
            tag_pairs.append(f"{escaped_key}={escaped_value}")

        tags_str = "," + ",".join(tag_pairs) if tag_pairs else ""

        # 字段
        field_value = sample.value
        if isinstance(field_value, (int, float)):
            field_str = f"value={field_value}"
        else:
            field_str = f'value="{field_value}"'

        # 时间戳（纳秒）
        timestamp_ns = int(sample.timestamp.timestamp() * 1_000_000_000)

        return f"{measurement}{tags_str} {field_str} {timestamp_ns}"

    def _escape_measurement_name(self, name: str) -> str:
        """转义测量名称"""
        return name.replace(" ", "\\ ").replace(",", "\\,")

    def _escape_tag_key(self, key: str) -> str:
        """转义标签键"""
        return key.replace(" ", "\\ ").replace(",", "\\,").replace("=", "\\=")

    def _escape_tag_value(self, value: str) -> str:
        """转义标签值"""
        return value.replace(" ", "\\ ").replace(",", "\\,").replace("=", "\\=")


# ================================
# CSV导出器
# ================================


class CSVExporter(MetricsExporter):
    """CSV格式导出器"""

    async def export_metrics(self, metrics: List[MetricFamily]) -> str:
        """导出CSV格式指标"""
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # 写入标题行
        writer.writerow(
            [
                "timestamp",
                "metric_name",
                "metric_type",
                "value",
                "labels",
                "description",
                "unit",
            ]
        )

        # 写入数据行
        for family in metrics:
            for metric in family.get_all_metrics():
                for sample in metric.samples:
                    labels_str = json.dumps(sample.labels, ensure_ascii=False)

                    writer.writerow(
                        [
                            sample.timestamp.isoformat(),
                            metric.name,
                            metric.metric_type.value,
                            sample.value,
                            labels_str,
                            metric.description,
                            metric.unit,
                        ]
                    )

        return output.getvalue()


# ================================
# HTTP服务器
# ================================


class MetricsHTTPServer:
    """指标HTTP服务器"""

    def __init__(self, exporter: MetricsExporter, config: ExportConfig):
        """初始化HTTP服务器"""
        if not AIOHTTP_AVAILABLE:
            raise ImportError(
                "aiohttp not available. Install with: pip install aiohttp"
            )

        self.exporter = exporter
        self.config = config
        self.app: Optional[web.Application] = None
        self.runner: Optional[web.AppRunner] = None
        self.site: Optional[web.TCPSite] = None

        self.logger = logging.getLogger(f"{__name__}.MetricsHTTPServer")

    async def start(self) -> None:
        """启动HTTP服务器"""
        if self.runner:
            return  # 已经启动

        # 创建应用
        self.app = web.Application()

        # 添加路由
        self.app.router.add_get(self.config.endpoint, self._handle_metrics)
        self.app.router.add_get("/health", self._handle_health)
        self.app.router.add_get("/stats", self._handle_stats)

        # 启动服务器
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()

        self.site = web.TCPSite(
            self.runner, host=self.config.host, port=self.config.port
        )
        await self.site.start()

        self.logger.info(
            f"Metrics HTTP server started on {self.config.host}:{self.config.port}"
        )

    async def stop(self) -> None:
        """停止HTTP服务器"""
        if self.site:
            await self.site.stop()
            self.site = None

        if self.runner:
            await self.runner.cleanup()
            self.runner = None

        self.app = None

        self.logger.info("Metrics HTTP server stopped")

    async def _handle_metrics(self, request: web.Request) -> web.Response:
        """处理指标请求"""
        try:
            metrics_data = await self.exporter.get_metrics_data()

            # 设置内容类型
            content_type = self._get_content_type()

            return web.Response(text=metrics_data, content_type=content_type)

        except Exception as e:
            self.logger.error(f"Error handling metrics request: {e}")
            return web.Response(
                text=f"Error: {e}", status=500, content_type="text/plain"
            )

    async def _handle_health(self, request: web.Request) -> web.Response:
        """处理健康检查请求"""
        try:
            # 简单的健康检查
            await self.exporter.storage.read_metrics(limit=1)

            return web.Response(text="OK", content_type="text/plain")

        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return web.Response(
                text=f"Error: {e}", status=503, content_type="text/plain"
            )

    async def _handle_stats(self, request: web.Request) -> web.Response:
        """处理统计信息请求"""
        try:
            stats = self.exporter.get_stats()

            return web.Response(
                text=json.dumps(stats, ensure_ascii=False, indent=2),
                content_type="application/json",
            )

        except Exception as e:
            self.logger.error(f"Error getting stats: {e}")
            return web.Response(
                text=f"Error: {e}", status=500, content_type="text/plain"
            )

    def _get_content_type(self) -> str:
        """获取内容类型"""
        content_type_map = {
            ExportFormat.PROMETHEUS: "text/plain; version=0.0.4; charset=utf-8",
            ExportFormat.JSON: "application/json; charset=utf-8",
            ExportFormat.YAML: "application/yaml; charset=utf-8",
            ExportFormat.CSV: "text/csv; charset=utf-8",
            ExportFormat.OPENTELEMETRY: "application/json; charset=utf-8",
            ExportFormat.INFLUXDB: "text/plain; charset=utf-8",
        }

        return content_type_map.get(self.config.format, "text/plain; charset=utf-8")


# ================================
# 导出器管理器
# ================================


class MetricsExporterManager:
    """指标导出器管理器"""

    def __init__(self, storage: MetricsStorage):
        """初始化导出器管理器"""
        self.storage = storage
        self.exporters: Dict[str, MetricsExporter] = {}
        self.servers: Dict[str, MetricsHTTPServer] = {}

        self.logger = logging.getLogger(f"{__name__}.MetricsExporterManager")

    def create_exporter(self, name: str, config: ExportConfig) -> MetricsExporter:
        """创建导出器"""
        if config.format == ExportFormat.PROMETHEUS:
            exporter = PrometheusExporter(self.storage, config)
        elif config.format == ExportFormat.JSON:
            exporter = JSONExporter(self.storage, config)
        elif config.format == ExportFormat.OPENTELEMETRY:
            exporter = OpenTelemetryExporter(self.storage, config)
        elif config.format == ExportFormat.INFLUXDB:
            exporter = InfluxDBExporter(self.storage, config)
        elif config.format == ExportFormat.CSV:
            exporter = CSVExporter(self.storage, config)
        else:
            raise ValueError(f"Unsupported export format: {config.format}")

        self.exporters[name] = exporter
        self.logger.info(f"Created {config.format.value} exporter: {name}")

        return exporter

    async def start_http_server(self, exporter_name: str) -> None:
        """启动HTTP服务器"""
        if exporter_name not in self.exporters:
            raise ValueError(f"Exporter not found: {exporter_name}")

        exporter = self.exporters[exporter_name]
        server = MetricsHTTPServer(exporter, exporter.config)

        await server.start()

        self.servers[exporter_name] = server
        self.logger.info(f"Started HTTP server for exporter: {exporter_name}")

    async def stop_http_server(self, exporter_name: str) -> None:
        """停止HTTP服务器"""
        if exporter_name in self.servers:
            server = self.servers[exporter_name]
            await server.stop()
            del self.servers[exporter_name]
            self.logger.info(f"Stopped HTTP server for exporter: {exporter_name}")

    async def stop_all_servers(self) -> None:
        """停止所有HTTP服务器"""
        for name in list(self.servers.keys()):
            await self.stop_http_server(name)

    def get_exporter(self, name: str) -> Optional[MetricsExporter]:
        """获取导出器"""
        return self.exporters.get(name)

    def list_exporters(self) -> List[str]:
        """列出所有导出器"""
        return list(self.exporters.keys())

    def remove_exporter(self, name: str) -> bool:
        """移除导出器"""
        if name in self.exporters:
            # 先停止HTTP服务器
            if name in self.servers:
                asyncio.create_task(self.stop_http_server(name))

            del self.exporters[name]
            self.logger.info(f"Removed exporter: {name}")
            return True

        return False

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "exporters": {
                name: exporter.get_stats() for name, exporter in self.exporters.items()
            },
            "servers": list(self.servers.keys()),
        }


# ================================
# 便捷函数
# ================================


def create_prometheus_exporter(
    storage: MetricsStorage, port: int = 8080, endpoint: str = "/metrics", **kwargs
) -> Tuple[PrometheusExporter, ExportConfig]:
    """创建Prometheus导出器"""
    config = ExportConfig(
        format=ExportFormat.PROMETHEUS, port=port, endpoint=endpoint, **kwargs
    )

    exporter = PrometheusExporter(storage, config)
    return exporter, config


def create_json_exporter(
    storage: MetricsStorage, port: int = 8081, endpoint: str = "/metrics.json", **kwargs
) -> Tuple[JSONExporter, ExportConfig]:
    """创建JSON导出器"""
    config = ExportConfig(
        format=ExportFormat.JSON, port=port, endpoint=endpoint, **kwargs
    )

    exporter = JSONExporter(storage, config)
    return exporter, config


async def setup_default_exporters(storage: MetricsStorage) -> MetricsExporterManager:
    """设置默认导出器"""
    manager = MetricsExporterManager(storage)

    # Prometheus导出器
    prometheus_config = ExportConfig(
        format=ExportFormat.PROMETHEUS, port=8080, endpoint="/metrics"
    )
    manager.create_exporter("prometheus", prometheus_config)
    await manager.start_http_server("prometheus")

    # JSON导出器
    json_config = ExportConfig(
        format=ExportFormat.JSON, port=8081, endpoint="/metrics.json"
    )
    manager.create_exporter("json", json_config)
    await manager.start_http_server("json")

    return manager

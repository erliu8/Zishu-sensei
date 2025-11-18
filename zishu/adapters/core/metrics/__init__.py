"""
适配器指标收集系统

提供全面的指标收集、聚合、存储和导出功能，包括：
- 性能指标收集 (延迟、吞吐量、错误率)
- 资源使用监控 (CPU、内存、I/O)
- 业务指标统计 (调用次数、成功率)
- 指标聚合和导出
- Prometheus/Grafana集成
- 实时监控和告警
"""

from .core import (
    # 核心指标服务
    AdapterMetricsService,
    MetricsServiceConfig,
    # 指标数据结构
    Metric,
    MetricType,
    MetricSample,
    MetricFamily,
    # 聚合器
    MetricAggregator,
    AggregationType,
    # 导出器
    MetricsExporter,
    PrometheusExporter,
    JsonExporter,
    InfluxDBExporter,
)

from .exporters import (
    # 导出器管理
    MetricsExporterManager,
    ExportConfig,
    ExportFormat,
)

from .collectors import (
    # 收集器基类
    MetricsCollector,
    # 具体收集器
    SystemMetricsCollector,
    AdapterMetricsCollector,
    ServiceMetricsCollector,
    BusinessMetricsCollector,
    # 收集器管理
    CollectorManager,
)

from .storage import (
    # 存储接口
    MetricsStorage,
    # 存储实现
    MemoryMetricsStorage,
    FileMetricsStorage,
    RedisMetricsStorage,
    InfluxDBMetricsStorage,
    # 存储管理
    MetricsStorageManager,
)

from .dashboard import (
    # 仪表板
    MetricsDashboard,
    DashboardConfig,
    # 查询接口
    MetricsQuery,
    MetricsQueryEngine,
    QueryBuilder,
    # 可视化
    MetricsVisualizer,
    ChartType,
)

from .alerts import (
    # 告警系统
    MetricsAlertManager,
    AlertRule,
    AlertCondition,
    AlertLevel,
    # 通知器
    AlertNotifier,
    EmailNotifier,
    SlackNotifier,
    WebhookNotifier,
)

# 便捷函数、配置和类型别名
from .utils import (
    MetricsService,  # 类型别名，指向AdapterMetricsService
    MetricsConfig,
    setup_metrics_system,
    teardown_metrics_system,
    set_global_metrics_service,
    get_global_metrics_service,
    clear_global_metrics_service,
)

# 暂时注释掉不存在的函数
# from .utils import (
#     create_metrics_service,
#     setup_default_collectors,
#     register_prometheus_metrics,
#     start_metrics_server,
#     get_metrics_summary,
# )

__all__ = [
    # 核心组件
    "AdapterMetricsService",
    "MetricsService",  # 类型别名
    "MetricsServiceConfig",
    "MetricsConfig",
    # 数据结构
    "Metric",
    "MetricType",
    "MetricSample",
    "MetricFamily",
    # 收集器
    "MetricsCollector",
    "SystemMetricsCollector",
    "AdapterMetricsCollector",
    "ServiceMetricsCollector",
    "BusinessMetricsCollector",
    "CollectorManager",
    # 聚合和导出
    "MetricAggregator",
    "AggregationType",
    "MetricsExporter",
    "MetricsExporterManager",
    "ExportConfig",
    "ExportFormat",
    "PrometheusExporter",
    "JsonExporter",
    "InfluxDBExporter",
    # 存储
    "MetricsStorage",
    "MemoryMetricsStorage",
    "FileMetricsStorage",
    "RedisMetricsStorage",
    "InfluxDBMetricsStorage",
    "MetricsStorageManager",
    # 仪表板和查询
    "MetricsDashboard",
    "DashboardConfig",
    "MetricsQuery",
    "MetricsQueryEngine",
    "QueryBuilder",
    "MetricsVisualizer",
    "ChartType",
    # 告警
    "MetricsAlertManager",
    "AlertRule",
    "AlertCondition",
    "AlertLevel",
    "AlertNotifier",
    "EmailNotifier",
    "SlackNotifier",
    "WebhookNotifier",
    # 工具函数
    "setup_metrics_system",
    "teardown_metrics_system",
    "set_global_metrics_service",
    "get_global_metrics_service",
    "clear_global_metrics_service",
]

# 版本信息
__version__ = "1.0.0"
__author__ = "Zishu-sensei Development Team"

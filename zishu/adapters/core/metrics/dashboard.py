"""
指标仪表板和查询系统

提供指标查询、可视化和仪表板功能。
"""

import asyncio
import logging
import json
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import threading

from .core import Metric, MetricFamily, MetricSample, MetricType, AggregationType, MetricAggregator
from .storage import MetricsStorage

logger = logging.getLogger(__name__)


# ================================
# 查询系统
# ================================

class QueryOperator(str, Enum):
    """查询操作符"""
    EQ = "eq"           # 等于
    NE = "ne"           # 不等于
    GT = "gt"           # 大于
    GTE = "gte"         # 大于等于
    LT = "lt"           # 小于
    LTE = "lte"         # 小于等于
    IN = "in"           # 包含
    NOT_IN = "not_in"   # 不包含
    LIKE = "like"       # 模糊匹配
    REGEX = "regex"     # 正则表达式


@dataclass
class QueryCondition:
    """查询条件"""
    field: str
    operator: QueryOperator
    value: Any
    
    def matches(self, data: Dict[str, Any]) -> bool:
        """检查数据是否匹配条件"""
        field_value = data.get(self.field)
        
        if self.operator == QueryOperator.EQ:
            return field_value == self.value
        elif self.operator == QueryOperator.NE:
            return field_value != self.value
        elif self.operator == QueryOperator.GT:
            return field_value is not None and field_value > self.value
        elif self.operator == QueryOperator.GTE:
            return field_value is not None and field_value >= self.value
        elif self.operator == QueryOperator.LT:
            return field_value is not None and field_value < self.value
        elif self.operator == QueryOperator.LTE:
            return field_value is not None and field_value <= self.value
        elif self.operator == QueryOperator.IN:
            return field_value in self.value if isinstance(self.value, (list, tuple, set)) else False
        elif self.operator == QueryOperator.NOT_IN:
            return field_value not in self.value if isinstance(self.value, (list, tuple, set)) else True
        elif self.operator == QueryOperator.LIKE:
            return isinstance(field_value, str) and self.value.lower() in field_value.lower()
        elif self.operator == QueryOperator.REGEX:
            import re
            return isinstance(field_value, str) and bool(re.search(self.value, field_value))
        
        return False


@dataclass
class MetricsQuery:
    """指标查询"""
    # 基础过滤
    metric_names: Optional[List[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    labels: Optional[Dict[str, str]] = None
    
    # 高级过滤
    conditions: List[QueryCondition] = field(default_factory=list)
    
    # 聚合
    aggregation: Optional[AggregationType] = None
    group_by: Optional[List[str]] = None
    time_window: Optional[timedelta] = None
    
    # 排序和限制
    order_by: Optional[str] = None
    order_desc: bool = False
    limit: Optional[int] = None
    offset: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'metric_names': self.metric_names,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'labels': self.labels,
            'conditions': [
                {
                    'field': c.field,
                    'operator': c.operator.value,
                    'value': c.value
                }
                for c in self.conditions
            ],
            'aggregation': self.aggregation.value if self.aggregation else None,
            'group_by': self.group_by,
            'time_window': self.time_window.total_seconds() if self.time_window else None,
            'order_by': self.order_by,
            'order_desc': self.order_desc,
            'limit': self.limit,
            'offset': self.offset
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MetricsQuery':
        """从字典创建"""
        query = cls()
        
        query.metric_names = data.get('metric_names')
        
        if data.get('start_time'):
            query.start_time = datetime.fromisoformat(data['start_time'])
        if data.get('end_time'):
            query.end_time = datetime.fromisoformat(data['end_time'])
        
        query.labels = data.get('labels')
        
        # 条件
        conditions_data = data.get('conditions', [])
        query.conditions = [
            QueryCondition(
                field=c['field'],
                operator=QueryOperator(c['operator']),
                value=c['value']
            )
            for c in conditions_data
        ]
        
        if data.get('aggregation'):
            query.aggregation = AggregationType(data['aggregation'])
        
        query.group_by = data.get('group_by')
        
        if data.get('time_window'):
            query.time_window = timedelta(seconds=data['time_window'])
        
        query.order_by = data.get('order_by')
        query.order_desc = data.get('order_desc', False)
        query.limit = data.get('limit')
        query.offset = data.get('offset', 0)
        
        return query


class QueryBuilder:
    """查询构建器 - 提供流畅的查询构建API"""
    
    def __init__(self):
        self._query = MetricsQuery()
    
    def metrics(self, *names: str) -> 'QueryBuilder':
        """指定指标名称"""
        self._query.metric_names = list(names)
        return self
    
    def time_range(self, start: datetime, end: Optional[datetime] = None) -> 'QueryBuilder':
        """设置时间范围"""
        self._query.start_time = start
        if end:
            self._query.end_time = end
        return self
    
    def last(self, duration: timedelta) -> 'QueryBuilder':
        """查询最近一段时间"""
        now = datetime.now(timezone.utc)
        self._query.start_time = now - duration
        self._query.end_time = now
        return self
    
    def labels(self, **labels) -> 'QueryBuilder':
        """设置标签过滤"""
        self._query.labels = labels
        return self
    
    def where(self, field: str, operator: QueryOperator, value: Any) -> 'QueryBuilder':
        """添加查询条件"""
        condition = QueryCondition(field=field, operator=operator, value=value)
        self._query.conditions.append(condition)
        return self
    
    def eq(self, field: str, value: Any) -> 'QueryBuilder':
        """等于条件"""
        return self.where(field, QueryOperator.EQ, value)
    
    def gt(self, field: str, value: Any) -> 'QueryBuilder':
        """大于条件"""
        return self.where(field, QueryOperator.GT, value)
    
    def lt(self, field: str, value: Any) -> 'QueryBuilder':
        """小于条件"""
        return self.where(field, QueryOperator.LT, value)
    
    def like(self, field: str, pattern: str) -> 'QueryBuilder':
        """模糊匹配条件"""
        return self.where(field, QueryOperator.LIKE, pattern)
    
    def aggregate(self, agg_type: AggregationType) -> 'QueryBuilder':
        """设置聚合类型"""
        self._query.aggregation = agg_type
        return self
    
    def group_by(self, *fields: str) -> 'QueryBuilder':
        """设置分组字段"""
        self._query.group_by = list(fields)
        return self
    
    def window(self, duration: timedelta) -> 'QueryBuilder':
        """设置时间窗口"""
        self._query.time_window = duration
        return self
    
    def order_by(self, field: str, desc: bool = False) -> 'QueryBuilder':
        """设置排序"""
        self._query.order_by = field
        self._query.order_desc = desc
        return self
    
    def limit(self, count: int, offset: int = 0) -> 'QueryBuilder':
        """设置限制"""
        self._query.limit = count
        self._query.offset = offset
        return self
    
    def build(self) -> MetricsQuery:
        """构建查询"""
        return self._query


@dataclass
class QueryResult:
    """查询结果"""
    metrics: List[MetricFamily]
    total_count: int
    execution_time: float
    query: MetricsQuery
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'metrics': [m.to_dict() for m in self.metrics],
            'total_count': self.total_count,
            'execution_time': self.execution_time,
            'query': self.query.to_dict(),
            'metadata': self.metadata
        }


class MetricsQueryEngine:
    """指标查询引擎"""
    
    def __init__(self, storage: MetricsStorage):
        """初始化查询引擎"""
        self.storage = storage
        self.aggregator = MetricAggregator()
        self.logger = logging.getLogger(f"{__name__}.MetricsQueryEngine")
    
    async def execute(self, query: MetricsQuery) -> QueryResult:
        """执行查询"""
        start_time = time.time()
        
        try:
            # 从存储读取原始数据
            raw_metrics = await self.storage.read_metrics(
                names=query.metric_names,
                start_time=query.start_time,
                end_time=query.end_time,
                labels=query.labels,
                limit=None  # 先不限制，后续处理
            )
            
            # 应用高级过滤
            filtered_metrics = self._apply_conditions(raw_metrics, query.conditions)
            
            # 应用聚合
            if query.aggregation or query.time_window:
                aggregated_metrics = self._apply_aggregation(filtered_metrics, query)
            else:
                aggregated_metrics = filtered_metrics
            
            # 应用排序
            if query.order_by:
                sorted_metrics = self._apply_sorting(aggregated_metrics, query)
            else:
                sorted_metrics = aggregated_metrics
            
            # 应用分页
            total_count = len(sorted_metrics)
            if query.limit or query.offset:
                start_idx = query.offset
                end_idx = start_idx + query.limit if query.limit else None
                paged_metrics = sorted_metrics[start_idx:end_idx]
            else:
                paged_metrics = sorted_metrics
            
            execution_time = time.time() - start_time
            
            return QueryResult(
                metrics=paged_metrics,
                total_count=total_count,
                execution_time=execution_time,
                query=query,
                metadata={
                    'raw_metrics_count': len(raw_metrics),
                    'filtered_metrics_count': len(filtered_metrics),
                    'final_metrics_count': len(paged_metrics)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Query execution failed: {e}")
            execution_time = time.time() - start_time
            
            return QueryResult(
                metrics=[],
                total_count=0,
                execution_time=execution_time,
                query=query,
                metadata={'error': str(e)}
            )
    
    def _apply_conditions(self, metrics: List[MetricFamily], conditions: List[QueryCondition]) -> List[MetricFamily]:
        """应用查询条件"""
        if not conditions:
            return metrics
        
        filtered_families = []
        
        for family in metrics:
            filtered_family = MetricFamily(
                name=family.name,
                metric_type=family.metric_type,
                description=family.description,
                unit=family.unit
            )
            
            for metric in family.get_all_metrics():
                filtered_samples = []
                
                for sample in metric.samples:
                    # 构建样本数据用于条件检查
                    sample_data = {
                        'value': sample.value,
                        'timestamp': sample.timestamp,
                        **sample.labels
                    }
                    
                    # 检查所有条件
                    matches_all = all(condition.matches(sample_data) for condition in conditions)
                    
                    if matches_all:
                        filtered_samples.append(sample)
                
                if filtered_samples:
                    filtered_metric = Metric(
                        name=metric.name,
                        metric_type=metric.metric_type,
                        description=metric.description,
                        unit=metric.unit,
                        labels=metric.labels,
                        samples=filtered_samples
                    )
                    
                    labels_key = json.dumps(sorted(metric.labels.items()), ensure_ascii=False)
                    filtered_family.metrics[labels_key] = filtered_metric
            
            if filtered_family.metrics:
                filtered_families.append(filtered_family)
        
        return filtered_families
    
    def _apply_aggregation(self, metrics: List[MetricFamily], query: MetricsQuery) -> List[MetricFamily]:
        """应用聚合"""
        if not query.aggregation and not query.time_window:
            return metrics
        
        aggregated_families = []
        
        for family in metrics:
            aggregated_family = MetricFamily(
                name=family.name,
                metric_type=family.metric_type,
                description=family.description,
                unit=family.unit
            )
            
            # 按分组字段分组
            if query.group_by:
                groups = self._group_metrics(family.get_all_metrics(), query.group_by)
            else:
                # 所有指标作为一组
                groups = {'all': family.get_all_metrics()}
            
            for group_key, group_metrics in groups.items():
                # 收集所有样本
                all_samples = []
                for metric in group_metrics:
                    all_samples.extend(metric.samples)
                
                if not all_samples:
                    continue
                
                # 时间窗口聚合
                if query.time_window:
                    windowed_results = self.aggregator.aggregate_by_time_window(
                        all_samples,
                        query.time_window,
                        query.aggregation or AggregationType.AVG
                    )
                    
                    # 创建聚合后的样本
                    aggregated_samples = [
                        MetricSample(
                            value=value,
                            timestamp=timestamp,
                            labels={'group': group_key} if query.group_by else {}
                        )
                        for timestamp, value in windowed_results
                    ]
                else:
                    # 单值聚合
                    aggregated_value = self.aggregator.aggregate(all_samples, query.aggregation)
                    if aggregated_value is not None:
                        aggregated_samples = [
                            MetricSample(
                                value=aggregated_value,
                                timestamp=datetime.now(timezone.utc),
                                labels={'group': group_key} if query.group_by else {}
                            )
                        ]
                    else:
                        aggregated_samples = []
                
                if aggregated_samples:
                    aggregated_metric = Metric(
                        name=family.name,
                        metric_type=family.metric_type,
                        description=family.description,
                        unit=family.unit,
                        labels={'group': group_key} if query.group_by else {},
                        samples=aggregated_samples
                    )
                    
                    labels_key = json.dumps(sorted(aggregated_metric.labels.items()), ensure_ascii=False)
                    aggregated_family.metrics[labels_key] = aggregated_metric
            
            if aggregated_family.metrics:
                aggregated_families.append(aggregated_family)
        
        return aggregated_families
    
    def _group_metrics(self, metrics: List[Metric], group_by: List[str]) -> Dict[str, List[Metric]]:
        """按字段分组指标"""
        groups = defaultdict(list)
        
        for metric in metrics:
            # 构建分组键
            group_values = []
            for field in group_by:
                value = metric.labels.get(field, 'unknown')
                group_values.append(f"{field}={value}")
            
            group_key = ','.join(group_values)
            groups[group_key].append(metric)
        
        return dict(groups)
    
    def _apply_sorting(self, metrics: List[MetricFamily], query: MetricsQuery) -> List[MetricFamily]:
        """应用排序"""
        if query.order_by == 'name':
            # 按名称排序
            return sorted(metrics, key=lambda m: m.name, reverse=query.order_desc)
        elif query.order_by == 'value':
            # 按最新值排序
            def get_latest_value(family: MetricFamily) -> float:
                latest_value = 0.0
                for metric in family.get_all_metrics():
                    if metric.samples:
                        latest_value = max(latest_value, metric.samples[-1].value)
                return latest_value
            
            return sorted(metrics, key=get_latest_value, reverse=query.order_desc)
        elif query.order_by == 'timestamp':
            # 按最新时间戳排序
            def get_latest_timestamp(family: MetricFamily) -> datetime:
                latest_timestamp = datetime.min.replace(tzinfo=timezone.utc)
                for metric in family.get_all_metrics():
                    if metric.samples:
                        latest_timestamp = max(latest_timestamp, metric.samples[-1].timestamp)
                return latest_timestamp
            
            return sorted(metrics, key=get_latest_timestamp, reverse=query.order_desc)
        
        return metrics


# ================================
# 可视化系统
# ================================

class ChartType(str, Enum):
    """图表类型"""
    LINE = "line"           # 折线图
    BAR = "bar"             # 柱状图
    AREA = "area"           # 面积图
    PIE = "pie"             # 饼图
    SCATTER = "scatter"     # 散点图
    HEATMAP = "heatmap"     # 热力图
    GAUGE = "gauge"         # 仪表盘
    TABLE = "table"         # 表格


@dataclass
class ChartConfig:
    """图表配置"""
    chart_type: ChartType
    title: str = ""
    width: int = 800
    height: int = 400
    
    # 轴配置
    x_axis_label: str = ""
    y_axis_label: str = ""
    x_axis_type: str = "datetime"  # datetime, category, numeric
    y_axis_type: str = "numeric"
    
    # 样式配置
    colors: List[str] = field(default_factory=list)
    theme: str = "default"
    
    # 交互配置
    interactive: bool = True
    zoom_enabled: bool = True
    
    # 其他配置
    show_legend: bool = True
    show_grid: bool = True
    stacked: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'chart_type': self.chart_type.value,
            'title': self.title,
            'width': self.width,
            'height': self.height,
            'x_axis_label': self.x_axis_label,
            'y_axis_label': self.y_axis_label,
            'x_axis_type': self.x_axis_type,
            'y_axis_type': self.y_axis_type,
            'colors': self.colors,
            'theme': self.theme,
            'interactive': self.interactive,
            'zoom_enabled': self.zoom_enabled,
            'show_legend': self.show_legend,
            'show_grid': self.show_grid,
            'stacked': self.stacked
        }


@dataclass
class ChartData:
    """图表数据"""
    series: List[Dict[str, Any]] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_series(self, name: str, data: List[Any], **kwargs) -> None:
        """添加数据系列"""
        series_data = {
            'name': name,
            'data': data,
            **kwargs
        }
        self.series.append(series_data)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'series': self.series,
            'categories': self.categories,
            'metadata': self.metadata
        }


class MetricsVisualizer:
    """指标可视化器"""
    
    def __init__(self):
        """初始化可视化器"""
        self.logger = logging.getLogger(f"{__name__}.MetricsVisualizer")
    
    def create_chart_data(self, metrics: List[MetricFamily], chart_config: ChartConfig) -> ChartData:
        """创建图表数据"""
        chart_data = ChartData()
        
        if chart_config.chart_type == ChartType.LINE:
            chart_data = self._create_line_chart_data(metrics)
        elif chart_config.chart_type == ChartType.BAR:
            chart_data = self._create_bar_chart_data(metrics)
        elif chart_config.chart_type == ChartType.AREA:
            chart_data = self._create_area_chart_data(metrics)
        elif chart_config.chart_type == ChartType.PIE:
            chart_data = self._create_pie_chart_data(metrics)
        elif chart_config.chart_type == ChartType.SCATTER:
            chart_data = self._create_scatter_chart_data(metrics)
        elif chart_config.chart_type == ChartType.HEATMAP:
            chart_data = self._create_heatmap_chart_data(metrics)
        elif chart_config.chart_type == ChartType.GAUGE:
            chart_data = self._create_gauge_chart_data(metrics)
        elif chart_config.chart_type == ChartType.TABLE:
            chart_data = self._create_table_chart_data(metrics)
        
        return chart_data
    
    def _create_line_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建折线图数据"""
        chart_data = ChartData()
        
        for family in metrics:
            for metric in family.get_all_metrics():
                if not metric.samples:
                    continue
                
                # 构建系列名称
                series_name = metric.name
                if metric.labels:
                    label_parts = [f"{k}={v}" for k, v in metric.labels.items()]
                    series_name += f" ({', '.join(label_parts)})"
                
                # 构建时间序列数据
                series_data = []
                for sample in metric.samples:
                    series_data.append({
                        'x': sample.timestamp.isoformat(),
                        'y': sample.value
                    })
                
                chart_data.add_series(series_name, series_data)
        
        return chart_data
    
    def _create_bar_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建柱状图数据"""
        chart_data = ChartData()
        
        # 收集所有指标的最新值
        categories = []
        values = []
        
        for family in metrics:
            for metric in family.get_all_metrics():
                if metric.samples:
                    # 构建类别名称
                    category_name = metric.name
                    if metric.labels:
                        label_parts = [f"{k}={v}" for k, v in metric.labels.items()]
                        category_name += f" ({', '.join(label_parts)})"
                    
                    categories.append(category_name)
                    values.append(metric.samples[-1].value)  # 最新值
        
        chart_data.categories = categories
        chart_data.add_series("Values", values)
        
        return chart_data
    
    def _create_area_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建面积图数据"""
        # 面积图与折线图类似，但需要堆叠数据
        return self._create_line_chart_data(metrics)
    
    def _create_pie_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建饼图数据"""
        chart_data = ChartData()
        
        # 收集所有指标的最新值用于饼图
        pie_data = []
        
        for family in metrics:
            for metric in family.get_all_metrics():
                if metric.samples:
                    # 构建标签
                    label = metric.name
                    if metric.labels:
                        label_parts = [f"{k}={v}" for k, v in metric.labels.items()]
                        label += f" ({', '.join(label_parts)})"
                    
                    pie_data.append({
                        'name': label,
                        'value': metric.samples[-1].value
                    })
        
        chart_data.add_series("Distribution", pie_data)
        
        return chart_data
    
    def _create_scatter_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建散点图数据"""
        chart_data = ChartData()
        
        # 散点图需要x-y坐标对
        for family in metrics:
            for metric in family.get_all_metrics():
                if not metric.samples:
                    continue
                
                series_name = metric.name
                if metric.labels:
                    label_parts = [f"{k}={v}" for k, v in metric.labels.items()]
                    series_name += f" ({', '.join(label_parts)})"
                
                # 使用时间戳作为x轴，值作为y轴
                scatter_data = []
                for i, sample in enumerate(metric.samples):
                    scatter_data.append({
                        'x': sample.timestamp.timestamp(),
                        'y': sample.value,
                        'size': 5  # 点的大小
                    })
                
                chart_data.add_series(series_name, scatter_data)
        
        return chart_data
    
    def _create_heatmap_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建热力图数据"""
        chart_data = ChartData()
        
        # 热力图需要矩阵数据
        # 这里简化处理，使用指标名称和标签值创建热力图
        heatmap_data = []
        x_categories = set()
        y_categories = set()
        
        for family in metrics:
            for metric in family.get_all_metrics():
                if metric.samples:
                    # 使用指标名称作为y轴
                    y_category = metric.name
                    y_categories.add(y_category)
                    
                    # 使用标签值作为x轴
                    for label_key, label_value in metric.labels.items():
                        x_category = f"{label_key}={label_value}"
                        x_categories.add(x_category)
                        
                        # 使用最新值
                        value = metric.samples[-1].value
                        
                        heatmap_data.append({
                            'x': x_category,
                            'y': y_category,
                            'value': value
                        })
        
        chart_data.categories = list(x_categories)
        chart_data.add_series("Heatmap", heatmap_data)
        chart_data.metadata['y_categories'] = list(y_categories)
        
        return chart_data
    
    def _create_gauge_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建仪表盘数据"""
        chart_data = ChartData()
        
        # 仪表盘通常显示单个值
        if metrics:
            family = metrics[0]
            if family.get_all_metrics():
                metric = list(family.get_all_metrics())[0]
                if metric.samples:
                    value = metric.samples[-1].value
                    
                    gauge_data = [{
                        'name': metric.name,
                        'value': value,
                        'min': 0,  # 可以根据历史数据计算
                        'max': 100  # 可以根据历史数据计算
                    }]
                    
                    chart_data.add_series("Gauge", gauge_data)
        
        return chart_data
    
    def _create_table_chart_data(self, metrics: List[MetricFamily]) -> ChartData:
        """创建表格数据"""
        chart_data = ChartData()
        
        # 表格数据
        table_data = []
        
        for family in metrics:
            for metric in family.get_all_metrics():
                if metric.samples:
                    # 构建行数据
                    row = {
                        'metric': metric.name,
                        'type': metric.metric_type.value,
                        'latest_value': metric.samples[-1].value,
                        'latest_time': metric.samples[-1].timestamp.isoformat(),
                        'sample_count': len(metric.samples)
                    }
                    
                    # 添加标签列
                    for key, value in metric.labels.items():
                        row[f"label_{key}"] = value
                    
                    table_data.append(row)
        
        chart_data.add_series("Table", table_data)
        
        return chart_data
    
    def generate_chart_json(self, chart_data: ChartData, chart_config: ChartConfig) -> str:
        """生成图表JSON配置"""
        chart_json = {
            'config': chart_config.to_dict(),
            'data': chart_data.to_dict()
        }
        
        return json.dumps(chart_json, ensure_ascii=False, indent=2)


# ================================
# 仪表板系统
# ================================

@dataclass
class DashboardWidget:
    """仪表板组件"""
    id: str
    title: str
    query: MetricsQuery
    chart_config: ChartConfig
    refresh_interval: int = 60  # 刷新间隔(秒)
    position: Dict[str, int] = field(default_factory=lambda: {'x': 0, 'y': 0, 'w': 6, 'h': 4})
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'query': self.query.to_dict(),
            'chart_config': self.chart_config.to_dict(),
            'refresh_interval': self.refresh_interval,
            'position': self.position
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DashboardWidget':
        """从字典创建"""
        return cls(
            id=data['id'],
            title=data['title'],
            query=MetricsQuery.from_dict(data['query']),
            chart_config=ChartConfig(**data['chart_config']),
            refresh_interval=data.get('refresh_interval', 60),
            position=data.get('position', {'x': 0, 'y': 0, 'w': 6, 'h': 4})
        )


@dataclass
class DashboardConfig:
    """仪表板配置"""
    id: str
    name: str
    description: str = ""
    widgets: List[DashboardWidget] = field(default_factory=list)
    layout: str = "grid"  # grid, flex
    theme: str = "default"
    auto_refresh: bool = True
    refresh_interval: int = 60
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def add_widget(self, widget: DashboardWidget) -> None:
        """添加组件"""
        self.widgets.append(widget)
        self.updated_at = datetime.now(timezone.utc)
    
    def remove_widget(self, widget_id: str) -> bool:
        """移除组件"""
        original_count = len(self.widgets)
        self.widgets = [w for w in self.widgets if w.id != widget_id]
        
        if len(self.widgets) < original_count:
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False
    
    def get_widget(self, widget_id: str) -> Optional[DashboardWidget]:
        """获取组件"""
        for widget in self.widgets:
            if widget.id == widget_id:
                return widget
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'widgets': [w.to_dict() for w in self.widgets],
            'layout': self.layout,
            'theme': self.theme,
            'auto_refresh': self.auto_refresh,
            'refresh_interval': self.refresh_interval,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DashboardConfig':
        """从字典创建"""
        config = cls(
            id=data['id'],
            name=data['name'],
            description=data.get('description', ''),
            layout=data.get('layout', 'grid'),
            theme=data.get('theme', 'default'),
            auto_refresh=data.get('auto_refresh', True),
            refresh_interval=data.get('refresh_interval', 60)
        )
        
        # 解析组件
        widgets_data = data.get('widgets', [])
        config.widgets = [DashboardWidget.from_dict(w) for w in widgets_data]
        
        # 解析时间
        if data.get('created_at'):
            config.created_at = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at'):
            config.updated_at = datetime.fromisoformat(data['updated_at'])
        
        return config


class MetricsDashboard:
    """指标仪表板"""
    
    def __init__(self, query_engine: MetricsQueryEngine):
        """初始化仪表板"""
        self.query_engine = query_engine
        self.visualizer = MetricsVisualizer()
        
        # 仪表板存储
        self._dashboards: Dict[str, DashboardConfig] = {}
        self._dashboard_lock = threading.RLock()
        
        # 缓存
        self._widget_cache: Dict[str, Tuple[datetime, Any]] = {}
        self._cache_ttl = timedelta(minutes=5)
        
        self.logger = logging.getLogger(f"{__name__}.MetricsDashboard")
    
    def create_dashboard(self, name: str, description: str = "") -> DashboardConfig:
        """创建仪表板"""
        dashboard_id = f"dashboard_{int(time.time())}"
        
        dashboard = DashboardConfig(
            id=dashboard_id,
            name=name,
            description=description
        )
        
        with self._dashboard_lock:
            self._dashboards[dashboard_id] = dashboard
        
        self.logger.info(f"Created dashboard: {name} ({dashboard_id})")
        return dashboard
    
    def get_dashboard(self, dashboard_id: str) -> Optional[DashboardConfig]:
        """获取仪表板"""
        with self._dashboard_lock:
            return self._dashboards.get(dashboard_id)
    
    def list_dashboards(self) -> List[DashboardConfig]:
        """列出所有仪表板"""
        with self._dashboard_lock:
            return list(self._dashboards.values())
    
    def update_dashboard(self, dashboard_id: str, dashboard: DashboardConfig) -> bool:
        """更新仪表板"""
        with self._dashboard_lock:
            if dashboard_id in self._dashboards:
                dashboard.updated_at = datetime.now(timezone.utc)
                self._dashboards[dashboard_id] = dashboard
                return True
            return False
    
    def delete_dashboard(self, dashboard_id: str) -> bool:
        """删除仪表板"""
        with self._dashboard_lock:
            if dashboard_id in self._dashboards:
                del self._dashboards[dashboard_id]
                
                # 清理相关缓存
                cache_keys_to_remove = [
                    key for key in self._widget_cache.keys()
                    if key.startswith(f"{dashboard_id}_")
                ]
                for key in cache_keys_to_remove:
                    del self._widget_cache[key]
                
                return True
            return False
    
    async def render_dashboard(self, dashboard_id: str) -> Dict[str, Any]:
        """渲染仪表板"""
        dashboard = self.get_dashboard(dashboard_id)
        if not dashboard:
            return {'error': 'Dashboard not found'}
        
        # 渲染所有组件
        widget_results = {}
        
        for widget in dashboard.widgets:
            try:
                widget_data = await self._render_widget(dashboard_id, widget)
                widget_results[widget.id] = widget_data
            except Exception as e:
                self.logger.error(f"Failed to render widget {widget.id}: {e}")
                widget_results[widget.id] = {'error': str(e)}
        
        return {
            'dashboard': dashboard.to_dict(),
            'widgets': widget_results,
            'rendered_at': datetime.now(timezone.utc).isoformat()
        }
    
    async def _render_widget(self, dashboard_id: str, widget: DashboardWidget) -> Dict[str, Any]:
        """渲染单个组件"""
        cache_key = f"{dashboard_id}_{widget.id}"
        
        # 检查缓存
        if cache_key in self._widget_cache:
            cached_time, cached_data = self._widget_cache[cache_key]
            if datetime.now(timezone.utc) - cached_time < self._cache_ttl:
                return cached_data
        
        # 执行查询
        query_result = await self.query_engine.execute(widget.query)
        
        # 生成图表数据
        chart_data = self.visualizer.create_chart_data(query_result.metrics, widget.chart_config)
        
        # 构建结果
        widget_result = {
            'widget': widget.to_dict(),
            'chart_data': chart_data.to_dict(),
            'query_result': {
                'total_count': query_result.total_count,
                'execution_time': query_result.execution_time,
                'metadata': query_result.metadata
            },
            'rendered_at': datetime.now(timezone.utc).isoformat()
        }
        
        # 缓存结果
        self._widget_cache[cache_key] = (datetime.now(timezone.utc), widget_result)
        
        return widget_result
    
    def create_system_dashboard(self) -> DashboardConfig:
        """创建系统监控仪表板"""
        dashboard = self.create_dashboard("System Monitoring", "系统性能监控仪表板")
        
        # CPU使用率组件
        cpu_query = QueryBuilder().metrics("system_cpu_percent").last(timedelta(hours=1)).build()
        cpu_chart = ChartConfig(
            chart_type=ChartType.LINE,
            title="CPU Usage",
            y_axis_label="Percentage (%)"
        )
        cpu_widget = DashboardWidget(
            id="cpu_usage",
            title="CPU Usage",
            query=cpu_query,
            chart_config=cpu_chart,
            position={'x': 0, 'y': 0, 'w': 6, 'h': 4}
        )
        dashboard.add_widget(cpu_widget)
        
        # 内存使用率组件
        memory_query = QueryBuilder().metrics("system_memory_percent").last(timedelta(hours=1)).build()
        memory_chart = ChartConfig(
            chart_type=ChartType.AREA,
            title="Memory Usage",
            y_axis_label="Percentage (%)"
        )
        memory_widget = DashboardWidget(
            id="memory_usage",
            title="Memory Usage",
            query=memory_query,
            chart_config=memory_chart,
            position={'x': 6, 'y': 0, 'w': 6, 'h': 4}
        )
        dashboard.add_widget(memory_widget)
        
        # 适配器执行统计
        adapter_query = QueryBuilder().metrics("adapter_execution_count").last(timedelta(hours=24)).build()
        adapter_chart = ChartConfig(
            chart_type=ChartType.BAR,
            title="Adapter Executions",
            y_axis_label="Count"
        )
        adapter_widget = DashboardWidget(
            id="adapter_executions",
            title="Adapter Executions",
            query=adapter_query,
            chart_config=adapter_chart,
            position={'x': 0, 'y': 4, 'w': 12, 'h': 4}
        )
        dashboard.add_widget(adapter_widget)
        
        return dashboard
    
    def create_adapter_dashboard(self) -> DashboardConfig:
        """创建适配器监控仪表板"""
        dashboard = self.create_dashboard("Adapter Monitoring", "适配器性能监控仪表板")
        
        # 适配器成功率
        success_rate_query = QueryBuilder().metrics("adapter_success_rate").last(timedelta(hours=6)).build()
        success_rate_chart = ChartConfig(
            chart_type=ChartType.GAUGE,
            title="Success Rate",
            y_axis_label="Percentage (%)"
        )
        success_rate_widget = DashboardWidget(
            id="success_rate",
            title="Adapter Success Rate",
            query=success_rate_query,
            chart_config=success_rate_chart,
            position={'x': 0, 'y': 0, 'w': 4, 'h': 4}
        )
        dashboard.add_widget(success_rate_widget)
        
        # 执行时间分布
        exec_time_query = QueryBuilder().metrics("adapter_execution_time").last(timedelta(hours=6)).build()
        exec_time_chart = ChartConfig(
            chart_type=ChartType.SCATTER,
            title="Execution Time Distribution",
            y_axis_label="Time (seconds)"
        )
        exec_time_widget = DashboardWidget(
            id="execution_time",
            title="Execution Time",
            query=exec_time_query,
            chart_config=exec_time_chart,
            position={'x': 4, 'y': 0, 'w': 8, 'h': 4}
        )
        dashboard.add_widget(exec_time_widget)
        
        # 错误统计
        error_query = QueryBuilder().metrics("adapter_error_count").last(timedelta(hours=24)).build()
        error_chart = ChartConfig(
            chart_type=ChartType.PIE,
            title="Error Distribution"
        )
        error_widget = DashboardWidget(
            id="error_distribution",
            title="Error Distribution",
            query=error_query,
            chart_config=error_chart,
            position={'x': 0, 'y': 4, 'w': 6, 'h': 4}
        )
        dashboard.add_widget(error_widget)
        
        # 适配器状态表格
        status_query = QueryBuilder().metrics("adapter_status_count").build()
        status_chart = ChartConfig(
            chart_type=ChartType.TABLE,
            title="Adapter Status"
        )
        status_widget = DashboardWidget(
            id="adapter_status",
            title="Adapter Status",
            query=status_query,
            chart_config=status_chart,
            position={'x': 6, 'y': 4, 'w': 6, 'h': 4}
        )
        dashboard.add_widget(status_widget)
        
        return dashboard
    
    def export_dashboard(self, dashboard_id: str) -> Optional[str]:
        """导出仪表板配置"""
        dashboard = self.get_dashboard(dashboard_id)
        if dashboard:
            return json.dumps(dashboard.to_dict(), ensure_ascii=False, indent=2)
        return None
    
    def import_dashboard(self, dashboard_json: str) -> Optional[DashboardConfig]:
        """导入仪表板配置"""
        try:
            dashboard_data = json.loads(dashboard_json)
            dashboard = DashboardConfig.from_dict(dashboard_data)
            
            with self._dashboard_lock:
                self._dashboards[dashboard.id] = dashboard
            
            self.logger.info(f"Imported dashboard: {dashboard.name} ({dashboard.id})")
            return dashboard
            
        except Exception as e:
            self.logger.error(f"Failed to import dashboard: {e}")
            return None

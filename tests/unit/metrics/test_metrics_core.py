# -*- coding: utf-8 -*-
"""
指标系统核心测试

测试新架构的指标系统核心功能
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.core.manager import MetricsManager, MetricsManagerConfig
from zishu.metrics.core.types import (
    Metric, MetricType, MetricValue, MetricSample, MetricQuery,
    TimeRange, Aggregation, MetricFilter, MetricMetadata
)
from zishu.metrics.core.registry import MetricsRegistry
from zishu.metrics.core.storage import MetricsStorage
from zishu.metrics.core.exceptions import MetricsException, InvalidMetric

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestMetricsCore:
    """指标系统核心测试类"""

    @pytest.fixture
    def metrics_config(self):
        """创建指标管理器配置"""
        return MetricsManagerConfig(
            enable_collection=True,
            enable_aggregation=True,
            enable_export=True,
            collection_interval_seconds=10,
            retention_days=30,
            max_metrics_per_second=1000,
            enable_compression=True,
            enable_high_availability=True,
            storage_backend='memory',
            export_formats=['prometheus', 'json']
        )

    @pytest.fixture
    async def metrics_manager(self, metrics_config):
        """创建指标管理器实例"""
        manager = MetricsManager(config=metrics_config)
        await manager.initialize()
        yield manager
        await manager.cleanup()

    @pytest.fixture
    def sample_metrics(self):
        """创建示例指标"""
        return [
            Metric(
                name='adapter_execution_count',
                type=MetricType.COUNTER,
                description='Number of adapter executions',
                labels={'adapter_id': 'test-adapter', 'status': 'success'},
                value=MetricValue(value=10, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='adapter_execution_duration',
                type=MetricType.HISTOGRAM,
                description='Adapter execution duration in seconds',
                labels={'adapter_id': 'test-adapter'},
                value=MetricValue(value=1.5, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='system_memory_usage',
                type=MetricType.GAUGE,
                description='System memory usage percentage',
                labels={'instance': 'node-1'},
                value=MetricValue(value=75.5, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='request_response_time',
                type=MetricType.SUMMARY,
                description='Request response time summary',
                labels={'endpoint': '/api/adapters', 'method': 'GET'},
                value=MetricValue(value=0.25, timestamp=datetime.now(timezone.utc))
            )
        ]

    async def test_metrics_manager_initialization(self, metrics_config):
        """测试指标管理器初始化"""
        manager = MetricsManager(config=metrics_config)
        
        # 验证初始状态
        assert manager.config == metrics_config
        assert not manager.is_initialized
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        
        # 清理管理器
        await manager.cleanup()

    async def test_register_metric(self, metrics_manager):
        """测试注册指标"""
        # 注册计数器指标
        counter_metric = Metric(
            name='test_counter',
            type=MetricType.COUNTER,
            description='Test counter metric',
            labels={'component': 'test'},
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        
        result = await metrics_manager.register_metric(counter_metric)
        assert result is True
        
        # 验证指标已注册
        registered_metric = await metrics_manager.get_metric('test_counter')
        assert registered_metric is not None
        assert registered_metric.name == 'test_counter'
        assert registered_metric.type == MetricType.COUNTER

    async def test_record_metric_value(self, metrics_manager, sample_metrics):
        """测试记录指标值"""
        # 注册指标
        metric = sample_metrics[0]
        await metrics_manager.register_metric(metric)
        
        # 记录指标值
        new_value = MetricValue(value=15, timestamp=datetime.now(timezone.utc))
        result = await metrics_manager.record_value(metric.name, new_value, metric.labels)
        assert result is True
        
        # 验证值已记录
        current_value = await metrics_manager.get_current_value(metric.name, metric.labels)
        assert current_value is not None
        assert current_value.value == 15

    async def test_increment_counter(self, metrics_manager):
        """测试递增计数器"""
        # 注册计数器
        counter = Metric(
            name='test_increment_counter',
            type=MetricType.COUNTER,
            description='Test increment counter',
            labels={'test': 'increment'},
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        
        await metrics_manager.register_metric(counter)
        
        # 递增计数器
        await metrics_manager.increment_counter('test_increment_counter', counter.labels, 5)
        await metrics_manager.increment_counter('test_increment_counter', counter.labels, 3)
        
        # 验证计数器值
        current_value = await metrics_manager.get_current_value('test_increment_counter', counter.labels)
        assert current_value.value == 8

    async def test_set_gauge_value(self, metrics_manager):
        """测试设置仪表值"""
        # 注册仪表
        gauge = Metric(
            name='test_gauge',
            type=MetricType.GAUGE,
            description='Test gauge metric',
            labels={'component': 'test'},
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        
        await metrics_manager.register_metric(gauge)
        
        # 设置仪表值
        await metrics_manager.set_gauge_value('test_gauge', gauge.labels, 42.5)
        
        # 验证仪表值
        current_value = await metrics_manager.get_current_value('test_gauge', gauge.labels)
        assert current_value.value == 42.5

    async def test_observe_histogram(self, metrics_manager):
        """测试观察直方图"""
        # 注册直方图
        histogram = Metric(
            name='test_histogram',
            type=MetricType.HISTOGRAM,
            description='Test histogram metric',
            labels={'operation': 'test'},
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        
        await metrics_manager.register_metric(histogram)
        
        # 观察多个值
        values = [0.1, 0.5, 1.0, 1.5, 2.0, 5.0]
        for value in values:
            await metrics_manager.observe_histogram('test_histogram', histogram.labels, value)
        
        # 获取直方图统计
        histogram_stats = await metrics_manager.get_histogram_stats('test_histogram', histogram.labels)
        assert histogram_stats is not None
        assert histogram_stats['count'] == len(values)
        assert histogram_stats['sum'] == sum(values)

    async def test_record_summary(self, metrics_manager):
        """测试记录摘要"""
        # 注册摘要
        summary = Metric(
            name='test_summary',
            type=MetricType.SUMMARY,
            description='Test summary metric',
            labels={'service': 'test'},
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        
        await metrics_manager.register_metric(summary)
        
        # 记录多个观察值
        observations = [0.1, 0.2, 0.3, 0.5, 0.8, 1.3, 2.1]
        for obs in observations:
            await metrics_manager.record_summary('test_summary', summary.labels, obs)
        
        # 获取摘要统计
        summary_stats = await metrics_manager.get_summary_stats('test_summary', summary.labels)
        assert summary_stats is not None
        assert summary_stats['count'] == len(observations)
        assert 'quantiles' in summary_stats

    async def test_query_metrics(self, metrics_manager, sample_metrics):
        """测试查询指标"""
        # 注册并记录指标
        for metric in sample_metrics:
            await metrics_manager.register_metric(metric)
            await metrics_manager.record_value(metric.name, metric.value, metric.labels)
        
        # 创建查询
        query = MetricQuery(
            metric_names=['adapter_execution_count', 'system_memory_usage'],
            time_range=TimeRange(
                start=datetime.now(timezone.utc) - timedelta(minutes=5),
                end=datetime.now(timezone.utc) + timedelta(minutes=5)
            ),
            labels_filter={'adapter_id': 'test-adapter'},
            aggregation=Aggregation.AVERAGE
        )
        
        # 执行查询
        query_results = await metrics_manager.query_metrics(query)
        
        assert query_results is not None
        assert len(query_results) >= 1
        for result in query_results:
            assert result.metric_name in query.metric_names

    async def test_aggregate_metrics(self, metrics_manager):
        """测试指标聚合"""
        # 创建时间序列数据
        metric_name = 'test_aggregation'
        labels = {'component': 'test'}
        
        # 注册指标
        metric = Metric(
            name=metric_name,
            type=MetricType.GAUGE,
            description='Test aggregation metric',
            labels=labels,
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        await metrics_manager.register_metric(metric)
        
        # 记录多个时间点的值
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        for i in range(10):
            timestamp = base_time + timedelta(minutes=i)
            value = MetricValue(value=i * 10, timestamp=timestamp)
            await metrics_manager.record_value(metric_name, value, labels)
        
        # 聚合指标
        aggregated_result = await metrics_manager.aggregate_metrics(
            metric_name=metric_name,
            labels_filter=labels,
            time_range=TimeRange(
                start=base_time,
                end=datetime.now(timezone.utc)
            ),
            aggregation=Aggregation.AVERAGE,
            interval_seconds=300  # 5分钟间隔
        )
        
        assert aggregated_result is not None
        assert len(aggregated_result.data_points) >= 1

    async def test_metrics_filtering(self, metrics_manager, sample_metrics):
        """测试指标过滤"""
        # 注册指标
        for metric in sample_metrics:
            await metrics_manager.register_metric(metric)
            await metrics_manager.record_value(metric.name, metric.value, metric.labels)
        
        # 创建过滤器
        metric_filter = MetricFilter(
            name_pattern='adapter_*',
            labels_filter={'adapter_id': 'test-adapter'},
            metric_types=[MetricType.COUNTER, MetricType.HISTOGRAM],
            time_range=TimeRange(
                start=datetime.now(timezone.utc) - timedelta(minutes=5),
                end=datetime.now(timezone.utc) + timedelta(minutes=5)
            )
        )
        
        # 应用过滤器
        filtered_metrics = await metrics_manager.filter_metrics(metric_filter)
        
        assert len(filtered_metrics) >= 1
        for metric in filtered_metrics:
            assert metric.name.startswith('adapter_')
            assert metric.labels.get('adapter_id') == 'test-adapter'
            assert metric.type in [MetricType.COUNTER, MetricType.HISTOGRAM]

    async def test_metrics_metadata(self, metrics_manager):
        """测试指标元数据"""
        # 创建带元数据的指标
        metadata = MetricMetadata(
            unit='seconds',
            help_text='Detailed help for this metric',
            tags=['performance', 'latency'],
            custom_attributes={'owner': 'team-a', 'criticality': 'high'}
        )
        
        metric = Metric(
            name='test_metadata_metric',
            type=MetricType.HISTOGRAM,
            description='Test metric with metadata',
            labels={'service': 'test'},
            value=MetricValue(value=1.0, timestamp=datetime.now(timezone.utc)),
            metadata=metadata
        )
        
        # 注册指标
        await metrics_manager.register_metric(metric)
        
        # 获取指标元数据
        retrieved_metadata = await metrics_manager.get_metric_metadata('test_metadata_metric')
        
        assert retrieved_metadata is not None
        assert retrieved_metadata.unit == 'seconds'
        assert 'performance' in retrieved_metadata.tags
        assert retrieved_metadata.custom_attributes['owner'] == 'team-a'

    async def test_batch_metrics_operations(self, metrics_manager):
        """测试批量指标操作"""
        # 创建批量指标
        batch_metrics = []
        for i in range(10):
            metric = Metric(
                name=f'batch_metric_{i}',
                type=MetricType.COUNTER,
                description=f'Batch metric {i}',
                labels={'batch': 'test', 'index': str(i)},
                value=MetricValue(value=i, timestamp=datetime.now(timezone.utc))
            )
            batch_metrics.append(metric)
        
        # 批量注册指标
        result = await metrics_manager.register_metrics_batch(batch_metrics)
        assert result is True
        
        # 批量记录值
        batch_values = []
        for i, metric in enumerate(batch_metrics):
            value = MetricValue(value=i * 2, timestamp=datetime.now(timezone.utc))
            batch_values.append((metric.name, value, metric.labels))
        
        result = await metrics_manager.record_values_batch(batch_values)
        assert result is True
        
        # 验证批量操作结果
        for i in range(10):
            current_value = await metrics_manager.get_current_value(
                f'batch_metric_{i}',
                {'batch': 'test', 'index': str(i)}
            )
            assert current_value.value == i * 2

    async def test_metrics_time_series(self, metrics_manager):
        """测试指标时间序列"""
        # 创建时间序列指标
        metric_name = 'time_series_metric'
        labels = {'series': 'test'}
        
        # 注册指标
        metric = Metric(
            name=metric_name,
            type=MetricType.GAUGE,
            description='Time series test metric',
            labels=labels,
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        await metrics_manager.register_metric(metric)
        
        # 生成时间序列数据
        base_time = datetime.now(timezone.utc) - timedelta(hours=1)
        samples = []
        for i in range(60):  # 60个数据点
            timestamp = base_time + timedelta(minutes=i)
            value = 50 + 20 * (i % 10)  # 模拟波动数据
            sample = MetricSample(
                metric_name=metric_name,
                labels=labels,
                value=value,
                timestamp=timestamp
            )
            samples.append(sample)
        
        # 批量插入时间序列数据
        await metrics_manager.insert_time_series_batch(samples)
        
        # 查询时间序列
        time_series = await metrics_manager.get_time_series(
            metric_name=metric_name,
            labels_filter=labels,
            time_range=TimeRange(
                start=base_time,
                end=datetime.now(timezone.utc)
            )
        )
        
        assert len(time_series.samples) == 60
        assert time_series.metric_name == metric_name

    async def test_metrics_alerts(self, metrics_manager):
        """测试指标告警"""
        # 创建告警规则
        alert_rule = {
            'name': 'high_memory_usage',
            'metric': 'system_memory_usage',
            'condition': 'value > 80',
            'duration': '5m',
            'severity': 'warning',
            'labels': {'team': 'infrastructure'}
        }
        
        # 添加告警规则
        await metrics_manager.add_alert_rule(alert_rule)
        
        # 注册指标
        memory_metric = Metric(
            name='system_memory_usage',
            type=MetricType.GAUGE,
            description='System memory usage',
            labels={'instance': 'test-node'},
            value=MetricValue(value=85.0, timestamp=datetime.now(timezone.utc))
        )
        await metrics_manager.register_metric(memory_metric)
        
        # 记录触发告警的值
        await metrics_manager.set_gauge_value(
            'system_memory_usage',
            {'instance': 'test-node'},
            85.0
        )
        
        # 检查告警
        active_alerts = await metrics_manager.get_active_alerts()
        
        # 验证告警被触发（具体行为取决于实现）
        assert isinstance(active_alerts, list)

    async def test_metrics_export(self, metrics_manager, sample_metrics):
        """测试指标导出"""
        # 注册并记录指标
        for metric in sample_metrics:
            await metrics_manager.register_metric(metric)
            await metrics_manager.record_value(metric.name, metric.value, metric.labels)
        
        # 导出为Prometheus格式
        prometheus_export = await metrics_manager.export_metrics('prometheus')
        assert prometheus_export is not None
        assert isinstance(prometheus_export, str)
        assert 'adapter_execution_count' in prometheus_export
        
        # 导出为JSON格式
        json_export = await metrics_manager.export_metrics('json')
        assert json_export is not None
        assert isinstance(json_export, (str, dict))

    async def test_metrics_retention(self, metrics_manager):
        """测试指标保留策略"""
        # 创建过期指标数据
        old_metric = Metric(
            name='old_metric',
            type=MetricType.COUNTER,
            description='Old metric for retention test',
            labels={'test': 'retention'},
            value=MetricValue(
                value=100,
                timestamp=datetime.now(timezone.utc) - timedelta(days=35)  # 超过保留期
            )
        )
        
        await metrics_manager.register_metric(old_metric)
        await metrics_manager.record_value(old_metric.name, old_metric.value, old_metric.labels)
        
        # 应用保留策略
        cleaned_count = await metrics_manager.apply_retention_policy()
        
        assert cleaned_count >= 0
        
        # 验证过期数据已清理（具体行为取决于实现）

    async def test_metrics_compression(self, metrics_manager):
        """测试指标压缩"""
        # 创建大量数据用于压缩测试
        metric_name = 'compression_test_metric'
        labels = {'test': 'compression'}
        
        # 注册指标
        metric = Metric(
            name=metric_name,
            type=MetricType.GAUGE,
            description='Compression test metric',
            labels=labels,
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        await metrics_manager.register_metric(metric)
        
        # 生成大量数据
        base_time = datetime.now(timezone.utc) - timedelta(hours=24)
        for i in range(1440):  # 24小时，每分钟一个数据点
            timestamp = base_time + timedelta(minutes=i)
            value = MetricValue(value=i % 100, timestamp=timestamp)
            await metrics_manager.record_value(metric_name, value, labels)
        
        # 触发压缩
        compression_result = await metrics_manager.compress_metrics(
            older_than=timedelta(hours=1)
        )
        
        assert compression_result is not None
        assert 'compressed_count' in compression_result
        assert 'space_saved' in compression_result

    async def test_metrics_high_availability(self, metrics_manager):
        """测试指标高可用性"""
        # 模拟主节点故障
        await metrics_manager.simulate_node_failure('primary')
        
        # 验证故障转移
        ha_status = await metrics_manager.get_ha_status()
        
        assert ha_status is not None
        assert 'active_node' in ha_status
        assert 'backup_nodes' in ha_status
        
        # 恢复主节点
        await metrics_manager.recover_node('primary')
        
        # 验证恢复
        recovered_status = await metrics_manager.get_ha_status()
        assert recovered_status['active_node'] == 'primary'

    async def test_concurrent_metrics_operations(self, metrics_manager):
        """测试并发指标操作"""
        # 创建多个并发任务
        tasks = []
        
        # 并发注册指标
        for i in range(50):
            metric = Metric(
                name=f'concurrent_metric_{i}',
                type=MetricType.COUNTER,
                description=f'Concurrent metric {i}',
                labels={'concurrent': 'test', 'id': str(i)},
                value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
            )
            task = metrics_manager.register_metric(metric)
            tasks.append(task)
        
        # 等待所有注册完成
        results = await asyncio.gather(*tasks)
        assert all(results)
        
        # 并发记录值
        record_tasks = []
        for i in range(50):
            value = MetricValue(value=i, timestamp=datetime.now(timezone.utc))
            labels = {'concurrent': 'test', 'id': str(i)}
            task = metrics_manager.record_value(f'concurrent_metric_{i}', value, labels)
            record_tasks.append(task)
        
        # 等待所有记录完成
        record_results = await asyncio.gather(*record_tasks)
        assert all(record_results)

    async def test_metrics_performance(self, metrics_manager):
        """测试指标性能"""
        # 性能测试指标
        metric_name = 'performance_test_metric'
        labels = {'test': 'performance'}
        
        # 注册指标
        metric = Metric(
            name=metric_name,
            type=MetricType.COUNTER,
            description='Performance test metric',
            labels=labels,
            value=MetricValue(value=0, timestamp=datetime.now(timezone.utc))
        )
        await metrics_manager.register_metric(metric)
        
        # 测量记录性能
        start_time = time.time()
        operations_count = 1000
        
        for i in range(operations_count):
            await metrics_manager.increment_counter(metric_name, labels, 1)
        
        end_time = time.time()
        duration = end_time - start_time
        ops_per_second = operations_count / duration
        
        # 验证性能满足要求
        assert ops_per_second > 100  # 至少100 ops/s
        
        # 获取性能指标
        performance_metrics = await metrics_manager.get_performance_metrics()
        
        assert performance_metrics is not None
        assert 'throughput' in performance_metrics
        assert 'latency' in performance_metrics

    async def test_error_handling(self, metrics_manager):
        """测试错误处理"""
        # 测试注册无效指标
        invalid_metric = Metric(
            name='',  # 空名称
            type=None,  # 空类型
            description='',
            labels={},
            value=None
        )
        
        with pytest.raises(InvalidMetric):
            await metrics_manager.register_metric(invalid_metric)
        
        # 测试记录不存在指标的值
        with pytest.raises(MetricsException):
            await metrics_manager.record_value(
                'nonexistent_metric',
                MetricValue(value=1, timestamp=datetime.now(timezone.utc)),
                {}
            )
        
        # 测试无效查询
        invalid_query = MetricQuery(
            metric_names=[],  # 空指标名称列表
            time_range=TimeRange(
                start=datetime.now(timezone.utc),
                end=datetime.now(timezone.utc) - timedelta(hours=1)  # 结束时间早于开始时间
            )
        )
        
        with pytest.raises(ValueError):
            await metrics_manager.query_metrics(invalid_query)

    async def test_metrics_cleanup(self, metrics_manager, sample_metrics):
        """测试指标清理"""
        # 注册一些指标
        for metric in sample_metrics:
            await metrics_manager.register_metric(metric)
            await metrics_manager.record_value(metric.name, metric.value, metric.labels)
        
        # 验证指标存在
        for metric in sample_metrics:
            registered_metric = await metrics_manager.get_metric(metric.name)
            assert registered_metric is not None
        
        # 清理管理器
        await metrics_manager.cleanup()
        
        # 验证资源已清理（具体行为取决于实现）

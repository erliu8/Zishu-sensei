# -*- coding: utf-8 -*-
"""
指标管理器测试

测试新架构的指标管理器功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.metrics.collectors.base import BaseCollector, CollectorConfig
from zishu.metrics.exporters.base import BaseExporter, ExporterConfig
from zishu.metrics.aggregators.base import BaseAggregator, AggregatorConfig
from zishu.metrics.storage.base import BaseStorage, StorageConfig
from zishu.metrics.core.types import (
    Metric, MetricType, MetricValue, MetricSample,
    TimeRange, StorageQuery, StorageResult
)
from zishu.metrics.core.exceptions import MetricsException

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestMetricsManager:
    """指标管理器测试类"""

    @pytest.fixture
    def metrics_config(self):
        """创建指标管理器配置"""
        return MetricsConfig(
            enabled=True,
            collection_interval=30,
            export_interval=60,
            aggregation_interval=120,
            storage_retention_days=30,
            max_memory_mb=1000,
            enable_compression=True,
            enable_backup=True,
            collectors={
                'system': CollectorConfig(
                    name='system_collector',
                    enabled=True,
                    collection_interval=30
                ),
                'application': CollectorConfig(
                    name='app_collector',
                    enabled=True,
                    collection_interval=60
                )
            },
            exporters={
                'prometheus': ExporterConfig(
                    name='prometheus_exporter',
                    enabled=True,
                    export_interval=60
                ),
                'json': ExporterConfig(
                    name='json_exporter',
                    enabled=True,
                    export_interval=300
                )
            },
            aggregators={
                'time_window': AggregatorConfig(
                    name='time_window_aggregator',
                    enabled=True,
                    aggregation_interval=120
                )
            },
            storage=StorageConfig(
                name='primary_storage',
                enabled=True,
                max_size_mb=5000,
                retention_days=30
            )
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
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        metrics = []
        
        for i in range(20):
            timestamp = base_time + timedelta(seconds=i * 30)
            
            # CPU指标
            cpu_metric = Metric(
                name='system_cpu_usage_percent',
                type=MetricType.GAUGE,
                description='CPU usage percentage',
                labels={'instance': 'node-1', 'core': str(i % 4)},
                value=MetricValue(value=20 + (i % 60), timestamp=timestamp)
            )
            metrics.append(cpu_metric)
            
            # 内存指标
            memory_metric = Metric(
                name='system_memory_usage_bytes',
                type=MetricType.GAUGE,
                description='Memory usage in bytes',
                labels={'instance': 'node-1', 'type': 'used'},
                value=MetricValue(value=1024 * 1024 * (500 + i * 10), timestamp=timestamp)
            )
            metrics.append(memory_metric)
            
            # 请求计数指标
            request_metric = Metric(
                name='http_requests_total',
                type=MetricType.COUNTER,
                description='Total HTTP requests',
                labels={'method': 'GET', 'status': '200', 'endpoint': '/api/test'},
                value=MetricValue(value=i * 5, timestamp=timestamp)
            )
            metrics.append(request_metric)
        
        return metrics

    async def test_manager_initialization(self, metrics_config):
        """测试管理器初始化"""
        manager = MetricsManager(config=metrics_config)
        
        # 验证初始状态
        assert manager.config == metrics_config
        assert not manager.is_running
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        
        # 验证组件已创建
        assert len(manager.collectors) > 0
        assert len(manager.exporters) > 0
        assert len(manager.aggregators) > 0
        assert manager.storage is not None
        
        # 清理管理器
        await manager.cleanup()

    async def test_manager_lifecycle(self, metrics_manager):
        """测试管理器生命周期"""
        # 启动管理器
        await metrics_manager.start()
        assert metrics_manager.is_running
        
        # 验证所有组件都在运行
        for collector in metrics_manager.collectors.values():
            assert collector.is_running
        
        for exporter in metrics_manager.exporters.values():
            assert exporter.is_running
        
        for aggregator in metrics_manager.aggregators.values():
            assert aggregator.is_running
        
        # 停止管理器
        await metrics_manager.stop()
        assert not metrics_manager.is_running

    async def test_collect_metrics(self, metrics_manager, sample_metrics):
        """测试收集指标"""
        # Mock收集器
        mock_collector = Mock()
        mock_collector.collect_metrics = AsyncMock(return_value=sample_metrics[:10])
        mock_collector.is_running = True
        
        metrics_manager.collectors['test'] = mock_collector
        
        # 收集指标
        collected_metrics = await metrics_manager.collect_all_metrics()
        
        assert len(collected_metrics) >= 10
        mock_collector.collect_metrics.assert_called_once()

    async def test_store_metrics(self, metrics_manager, sample_metrics):
        """测试存储指标"""
        # Mock存储
        mock_storage = Mock()
        mock_storage.store_metrics = AsyncMock(return_value=True)
        mock_storage.is_connected = True
        
        metrics_manager.storage = mock_storage
        
        # 存储指标
        result = await metrics_manager.store_metrics(sample_metrics)
        
        assert result is True
        mock_storage.store_metrics.assert_called_once_with(sample_metrics)

    async def test_export_metrics(self, metrics_manager, sample_metrics):
        """测试导出指标"""
        # Mock导出器
        mock_exporter = Mock()
        mock_exporter.export_metrics = AsyncMock(return_value=True)
        mock_exporter.is_running = True
        
        metrics_manager.exporters['test'] = mock_exporter
        
        # 导出指标
        results = await metrics_manager.export_all_metrics(sample_metrics)
        
        assert 'test' in results
        assert results['test'] is True
        mock_exporter.export_metrics.assert_called_once_with(sample_metrics)

    async def test_aggregate_metrics(self, metrics_manager, sample_metrics):
        """测试聚合指标"""
        # Mock聚合器
        mock_aggregator = Mock()
        mock_aggregated_result = Mock()
        mock_aggregated_result.value = 45.5
        mock_aggregated_result.sample_count = 10
        
        mock_aggregator.aggregate_metrics = AsyncMock(return_value=[mock_aggregated_result])
        mock_aggregator.is_running = True
        
        metrics_manager.aggregators['test'] = mock_aggregator
        
        # 聚合指标
        results = await metrics_manager.aggregate_all_metrics(sample_metrics)
        
        assert 'test' in results
        assert len(results['test']) > 0
        mock_aggregator.aggregate_metrics.assert_called()

    async def test_query_metrics(self, metrics_manager, sample_metrics):
        """测试查询指标"""
        # Mock存储查询
        mock_storage = Mock()
        mock_result = StorageResult(
            metrics=sample_metrics[:5],
            total_count=5,
            query_time_ms=50
        )
        mock_storage.query_metrics = AsyncMock(return_value=mock_result)
        mock_storage.is_connected = True
        
        metrics_manager.storage = mock_storage
        
        # 查询指标
        query = StorageQuery(
            metric_names=['system_cpu_usage_percent'],
            time_range=TimeRange(
                start=datetime.now(timezone.utc) - timedelta(hours=1),
                end=datetime.now(timezone.utc)
            )
        )
        
        result = await metrics_manager.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) == 5
        mock_storage.query_metrics.assert_called_once_with(query)

    async def test_metrics_pipeline(self, metrics_manager, sample_metrics):
        """测试指标处理管道"""
        # Mock所有组件
        mock_collector = Mock()
        mock_collector.collect_metrics = AsyncMock(return_value=sample_metrics)
        mock_collector.is_running = True
        
        mock_storage = Mock()
        mock_storage.store_metrics = AsyncMock(return_value=True)
        mock_storage.is_connected = True
        
        mock_exporter = Mock()
        mock_exporter.export_metrics = AsyncMock(return_value=True)
        mock_exporter.is_running = True
        
        mock_aggregator = Mock()
        mock_aggregator.add_samples = AsyncMock(return_value=True)
        mock_aggregator.is_running = True
        
        # 设置Mock组件
        metrics_manager.collectors['test'] = mock_collector
        metrics_manager.storage = mock_storage
        metrics_manager.exporters['test'] = mock_exporter
        metrics_manager.aggregators['test'] = mock_aggregator
        
        # 执行完整的指标处理管道
        await metrics_manager.run_metrics_pipeline()
        
        # 验证管道各步骤都被执行
        mock_collector.collect_metrics.assert_called()
        mock_storage.store_metrics.assert_called()
        mock_exporter.export_metrics.assert_called()

    async def test_health_monitoring(self, metrics_manager):
        """测试健康监控"""
        # Mock组件健康状态
        mock_collector = Mock()
        mock_collector.health_check = AsyncMock(return_value={'status': 'healthy'})
        
        mock_storage = Mock()
        mock_storage.health_check = AsyncMock(return_value={'status': 'healthy'})
        
        mock_exporter = Mock()
        mock_exporter.health_check = AsyncMock(return_value={'status': 'healthy'})
        
        mock_aggregator = Mock()
        mock_aggregator.health_check = AsyncMock(return_value={'status': 'healthy'})
        
        # 设置Mock组件
        metrics_manager.collectors['test'] = mock_collector
        metrics_manager.storage = mock_storage
        metrics_manager.exporters['test'] = mock_exporter
        metrics_manager.aggregators['test'] = mock_aggregator
        
        # 检查整体健康状态
        health_status = await metrics_manager.get_health_status()
        
        assert health_status is not None
        assert 'overall_status' in health_status
        assert 'components' in health_status
        assert 'collectors' in health_status['components']
        assert 'storage' in health_status['components']
        assert 'exporters' in health_status['components']
        assert 'aggregators' in health_status['components']

    async def test_error_handling(self, metrics_manager, sample_metrics):
        """测试错误处理"""
        # Mock收集器错误
        mock_collector = Mock()
        mock_collector.collect_metrics = AsyncMock(side_effect=Exception('Collection failed'))
        mock_collector.is_running = True
        
        metrics_manager.collectors['failing_collector'] = mock_collector
        
        # 收集指标应该处理错误并继续
        collected_metrics = await metrics_manager.collect_all_metrics()
        
        # 应该返回空列表或其他收集器的结果，而不是抛出异常
        assert isinstance(collected_metrics, list)

    async def test_configuration_update(self, metrics_manager):
        """测试配置更新"""
        # 更新配置
        new_config = MetricsConfig(
            enabled=True,
            collection_interval=60,  # 从30改为60
            export_interval=120,     # 从60改为120
            aggregation_interval=240, # 从120改为240
            storage_retention_days=60, # 从30改为60
            max_memory_mb=2000,      # 从1000改为2000
            enable_compression=True,
            enable_backup=True
        )
        
        # 应用新配置
        await metrics_manager.update_config(new_config)
        
        # 验证配置已更新
        assert metrics_manager.config.collection_interval == 60
        assert metrics_manager.config.export_interval == 120
        assert metrics_manager.config.aggregation_interval == 240
        assert metrics_manager.config.storage_retention_days == 60
        assert metrics_manager.config.max_memory_mb == 2000

    async def test_component_management(self, metrics_manager):
        """测试组件管理"""
        # 添加新收集器
        new_collector_config = CollectorConfig(
            name='new_collector',
            enabled=True,
            collection_interval=45
        )
        
        result = await metrics_manager.add_collector('new_collector', new_collector_config)
        assert result is True
        assert 'new_collector' in metrics_manager.collectors
        
        # 移除收集器
        result = await metrics_manager.remove_collector('new_collector')
        assert result is True
        assert 'new_collector' not in metrics_manager.collectors
        
        # 添加新导出器
        new_exporter_config = ExporterConfig(
            name='new_exporter',
            enabled=True,
            export_interval=90
        )
        
        result = await metrics_manager.add_exporter('new_exporter', new_exporter_config)
        assert result is True
        assert 'new_exporter' in metrics_manager.exporters

    async def test_metrics_filtering(self, metrics_manager, sample_metrics):
        """测试指标过滤"""
        # 设置过滤规则
        filter_rules = {
            'include_patterns': ['system_*', 'http_*'],
            'exclude_patterns': ['*_debug'],
            'label_filters': {
                'instance': ['node-1', 'node-2']
            }
        }
        
        await metrics_manager.set_filter_rules(filter_rules)
        
        # 应用过滤器
        filtered_metrics = await metrics_manager.apply_filters(sample_metrics)
        
        # 验证过滤结果
        assert len(filtered_metrics) <= len(sample_metrics)
        
        # 验证所有过滤后的指标都符合规则
        for metric in filtered_metrics:
            assert metric.name.startswith('system_') or metric.name.startswith('http_')
            assert not metric.name.endswith('_debug')
            if 'instance' in metric.labels:
                assert metric.labels['instance'] in ['node-1', 'node-2']

    async def test_metrics_transformation(self, metrics_manager, sample_metrics):
        """测试指标转换"""
        # 设置转换规则
        transformation_rules = {
            'unit_conversions': {
                'system_memory_usage_bytes': {
                    'from_unit': 'bytes',
                    'to_unit': 'MB',
                    'factor': 1024 * 1024
                }
            },
            'label_mappings': {
                'instance': 'node_id',
                'core': 'cpu_core'
            },
            'metric_renaming': {
                'system_cpu_usage_percent': 'cpu_utilization_percent'
            }
        }
        
        await metrics_manager.set_transformation_rules(transformation_rules)
        
        # 应用转换
        transformed_metrics = await metrics_manager.apply_transformations(sample_metrics)
        
        # 验证转换结果
        assert len(transformed_metrics) == len(sample_metrics)
        
        # 验证单位转换
        memory_metrics = [m for m in transformed_metrics if 'memory' in m.name]
        for metric in memory_metrics:
            # 内存值应该被转换为MB
            assert metric.value.value < 1024  # 原始值是字节，转换后应该小很多
        
        # 验证标签映射
        for metric in transformed_metrics:
            assert 'instance' not in metric.labels  # 应该被重命名
            if 'node_id' in metric.labels:
                assert metric.labels['node_id'] in ['node-1', 'node-2']

    async def test_alerting_integration(self, metrics_manager, sample_metrics):
        """测试告警集成"""
        # 设置告警规则
        alert_rules = [
            {
                'name': 'high_cpu_usage',
                'condition': 'system_cpu_usage_percent > 80',
                'duration': '5m',
                'severity': 'warning'
            },
            {
                'name': 'high_memory_usage',
                'condition': 'system_memory_usage_bytes > 1073741824',  # 1GB
                'duration': '2m',
                'severity': 'critical'
            }
        ]
        
        await metrics_manager.set_alert_rules(alert_rules)
        
        # 处理指标并检查告警
        alerts = await metrics_manager.evaluate_alerts(sample_metrics)
        
        # 验证告警评估
        assert isinstance(alerts, list)
        
        # 如果有指标触发告警，验证告警格式
        for alert in alerts:
            assert 'name' in alert
            assert 'severity' in alert
            assert 'triggered_at' in alert
            assert 'metric_value' in alert

    async def test_performance_monitoring(self, metrics_manager):
        """测试性能监控"""
        # 获取性能统计
        performance_stats = await metrics_manager.get_performance_stats()
        
        assert performance_stats is not None
        assert 'collection_stats' in performance_stats
        assert 'storage_stats' in performance_stats
        assert 'export_stats' in performance_stats
        assert 'aggregation_stats' in performance_stats
        
        # 验证统计信息格式
        collection_stats = performance_stats['collection_stats']
        assert 'total_collections' in collection_stats
        assert 'avg_collection_time_ms' in collection_stats
        assert 'metrics_per_second' in collection_stats

    async def test_backup_and_restore(self, metrics_manager, sample_metrics):
        """测试备份和恢复"""
        # Mock存储
        mock_storage = Mock()
        mock_storage.create_backup = AsyncMock(return_value=True)
        mock_storage.restore_from_backup = AsyncMock(return_value=True)
        mock_storage.is_connected = True
        
        metrics_manager.storage = mock_storage
        
        # 创建备份
        backup_result = await metrics_manager.create_backup()
        assert backup_result is True
        mock_storage.create_backup.assert_called_once()
        
        # 从备份恢复
        restore_result = await metrics_manager.restore_from_backup('backup_20231201.bak')
        assert restore_result is True
        mock_storage.restore_from_backup.assert_called_once_with('backup_20231201.bak')

    async def test_concurrent_operations(self, metrics_manager, sample_metrics):
        """测试并发操作"""
        # Mock组件
        mock_collector = Mock()
        mock_collector.collect_metrics = AsyncMock(return_value=sample_metrics[:10])
        mock_collector.is_running = True
        
        mock_storage = Mock()
        mock_storage.store_metrics = AsyncMock(return_value=True)
        mock_storage.is_connected = True
        
        mock_exporter = Mock()
        mock_exporter.export_metrics = AsyncMock(return_value=True)
        mock_exporter.is_running = True
        
        # 设置Mock组件
        metrics_manager.collectors['test'] = mock_collector
        metrics_manager.storage = mock_storage
        metrics_manager.exporters['test'] = mock_exporter
        
        # 并发执行多个操作
        tasks = [
            metrics_manager.collect_all_metrics(),
            metrics_manager.store_metrics(sample_metrics),
            metrics_manager.export_all_metrics(sample_metrics),
            metrics_manager.get_health_status()
        ]
        
        results = await asyncio.gather(*tasks)
        
        # 验证所有操作都成功完成
        assert len(results) == 4
        assert isinstance(results[0], list)  # collect_all_metrics result
        assert results[1] is True           # store_metrics result
        assert isinstance(results[2], dict) # export_all_metrics result
        assert isinstance(results[3], dict) # get_health_status result

    async def test_resource_management(self, metrics_manager):
        """测试资源管理"""
        # 获取资源使用情况
        resource_usage = await metrics_manager.get_resource_usage()
        
        assert resource_usage is not None
        assert 'memory_usage_mb' in resource_usage
        assert 'cpu_usage_percent' in resource_usage
        assert 'storage_usage_mb' in resource_usage
        assert 'active_connections' in resource_usage
        
        # 验证资源限制
        assert resource_usage['memory_usage_mb'] <= metrics_manager.config.max_memory_mb
        
        # 测试资源清理
        cleanup_result = await metrics_manager.cleanup_resources()
        assert cleanup_result is True

    async def test_metrics_validation(self, metrics_manager):
        """测试指标验证"""
        # 创建有效和无效的指标
        valid_metric = Metric(
            name='valid_metric',
            type=MetricType.GAUGE,
            description='Valid metric',
            labels={'service': 'test'},
            value=MetricValue(value=42.0, timestamp=datetime.now(timezone.utc))
        )
        
        invalid_metrics = [
            # 缺少名称
            Metric(
                name='',
                type=MetricType.GAUGE,
                description='Invalid metric',
                labels={},
                value=MetricValue(value=1.0, timestamp=datetime.now(timezone.utc))
            ),
            # 无效的值
            Metric(
                name='invalid_value_metric',
                type=MetricType.GAUGE,
                description='Invalid value metric',
                labels={},
                value=MetricValue(value=float('inf'), timestamp=datetime.now(timezone.utc))
            ),
            # 未来的时间戳
            Metric(
                name='future_metric',
                type=MetricType.GAUGE,
                description='Future metric',
                labels={},
                value=MetricValue(
                    value=1.0, 
                    timestamp=datetime.now(timezone.utc) + timedelta(hours=1)
                )
            )
        ]
        
        # 验证有效指标
        validation_result = await metrics_manager.validate_metric(valid_metric)
        assert validation_result.is_valid is True
        
        # 验证无效指标
        for invalid_metric in invalid_metrics:
            validation_result = await metrics_manager.validate_metric(invalid_metric)
            assert validation_result.is_valid is False
            assert len(validation_result.errors) > 0

    async def test_cleanup(self, metrics_manager):
        """测试清理功能"""
        # 启动管理器
        await metrics_manager.start()
        assert metrics_manager.is_running
        
        # 清理管理器
        await metrics_manager.cleanup()
        
        # 验证所有组件都已清理
        assert not metrics_manager.is_running
        
        # 验证组件状态
        for collector in metrics_manager.collectors.values():
            assert not collector.is_running
        
        for exporter in metrics_manager.exporters.values():
            assert not exporter.is_running
        
        for aggregator in metrics_manager.aggregators.values():
            assert not aggregator.is_running
        
        if metrics_manager.storage:
            assert not metrics_manager.storage.is_connected

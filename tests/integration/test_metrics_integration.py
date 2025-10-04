# -*- coding: utf-8 -*-
"""
指标系统集成测试

测试指标系统各组件间的集成和协调工作
"""

import pytest
import asyncio
import tempfile
import os
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.metrics.collectors.system import SystemMetricsCollector
from zishu.metrics.collectors.application import ApplicationMetricsCollector
from zishu.metrics.exporters.json import JsonExporter
from zishu.metrics.exporters.prometheus import PrometheusExporter
from zishu.metrics.aggregators.time_window import TimeWindowAggregator
from zishu.metrics.aggregators.statistical import StatisticalAggregator
from zishu.metrics.storage.memory import MemoryStorage
from zishu.metrics.storage.file import FileStorage
from zishu.metrics.core.types import (
    Metric, MetricType, MetricValue, TimeRange, 
    StorageQuery, Aggregation
)

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestMetricsSystemIntegration:
    """指标系统集成测试类"""

    @pytest.fixture
    def integration_config(self):
        """创建集成测试配置"""
        return MetricsConfig(
            enabled=True,
            collection_interval=5,   # 快速收集用于测试
            export_interval=10,      # 快速导出用于测试
            aggregation_interval=15, # 快速聚合用于测试
            storage_retention_days=1,
            max_memory_mb=500,
            enable_compression=False,  # 简化测试
            enable_backup=False       # 简化测试
        )

    @pytest.fixture
    async def integrated_metrics_system(self, integration_config):
        """创建完整的集成指标系统"""
        # 创建临时目录用于文件存储
        temp_dir = tempfile.mkdtemp()
        
        try:
            # 创建指标管理器
            manager = MetricsManager(config=integration_config)
            
            # 添加系统收集器
            system_collector = SystemMetricsCollector(
                config=integration_config.collectors.get('system', {})
            )
            manager.add_collector('system', system_collector)
            
            # 添加应用收集器
            app_collector = ApplicationMetricsCollector(
                config=integration_config.collectors.get('application', {})
            )
            manager.add_collector('application', app_collector)
            
            # 添加内存存储
            memory_storage = MemoryStorage(
                config=integration_config.storage
            )
            manager.set_storage(memory_storage)
            
            # 添加文件存储作为备份
            file_storage = FileStorage(config={
                'storage_directory': temp_dir,
                'file_format': 'json'
            })
            manager.add_storage('file_backup', file_storage)
            
            # 添加JSON导出器
            json_exporter = JsonExporter(config={
                'output_file': os.path.join(temp_dir, 'metrics.json'),
                'pretty_print': True
            })
            manager.add_exporter('json', json_exporter)
            
            # 添加Prometheus导出器（Mock）
            prometheus_exporter = PrometheusExporter(config={
                'endpoint': 'http://localhost:9090/metrics'
            })
            manager.add_exporter('prometheus', prometheus_exporter)
            
            # 添加时间窗口聚合器
            time_window_agg = TimeWindowAggregator(
                config=integration_config.aggregators.get('time_window', {})
            )
            manager.add_aggregator('time_window', time_window_agg)
            
            # 添加统计聚合器
            statistical_agg = StatisticalAggregator(
                config=integration_config.aggregators.get('statistical', {})
            )
            manager.add_aggregator('statistical', statistical_agg)
            
            # 初始化系统
            await manager.initialize()
            
            yield manager
            
            # 清理
            await manager.cleanup()
            
        finally:
            # 清理临时目录
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def test_end_to_end_metrics_flow(self, integrated_metrics_system):
        """测试端到端指标流程"""
        manager = integrated_metrics_system
        
        # 启动系统
        await manager.start()
        
        try:
            # 等待一个收集周期
            await asyncio.sleep(6)  # 收集间隔是5秒
            
            # 验证指标已被收集
            collected_metrics = await manager.get_recent_metrics(limit=100)
            assert len(collected_metrics) > 0
            
            # 验证指标已被存储
            storage_info = await manager.get_storage_info()
            assert storage_info['metrics_count'] > 0
            
            # 等待一个导出周期
            await asyncio.sleep(11)  # 导出间隔是10秒
            
            # 验证指标已被导出
            export_stats = await manager.get_export_stats()
            assert export_stats['total_exports'] > 0
            
            # 等待一个聚合周期
            await asyncio.sleep(16)  # 聚合间隔是15秒
            
            # 验证指标已被聚合
            aggregation_stats = await manager.get_aggregation_stats()
            assert aggregation_stats['total_aggregations'] > 0
            
        finally:
            await manager.stop()

    async def test_collector_storage_integration(self, integrated_metrics_system):
        """测试收集器与存储的集成"""
        manager = integrated_metrics_system
        
        # 获取系统收集器
        system_collector = manager.collectors['system']
        
        # 收集系统指标
        system_metrics = await system_collector.collect_metrics()
        assert len(system_metrics) > 0
        
        # 存储指标
        storage_result = await manager.store_metrics(system_metrics)
        assert storage_result is True
        
        # 查询存储的指标
        query = StorageQuery(
            metric_names=[m.name for m in system_metrics[:3]],
            time_range=TimeRange(
                start=datetime.now(timezone.utc) - timedelta(minutes=1),
                end=datetime.now(timezone.utc)
            )
        )
        
        query_result = await manager.query_metrics(query)
        assert len(query_result.metrics) > 0
        
        # 验证查询结果与原始指标一致
        stored_metric_names = {m.name for m in query_result.metrics}
        original_metric_names = {m.name for m in system_metrics[:3]}
        assert len(stored_metric_names.intersection(original_metric_names)) > 0

    async def test_storage_exporter_integration(self, integrated_metrics_system):
        """测试存储与导出器的集成"""
        manager = integrated_metrics_system
        
        # 创建测试指标
        test_metrics = []
        base_time = datetime.now(timezone.utc)
        
        for i in range(10):
            metric = Metric(
                name='integration_test_metric',
                type=MetricType.GAUGE,
                description='Integration test metric',
                labels={'test_id': str(i), 'batch': 'integration'},
                value=MetricValue(
                    value=i * 10.5,
                    timestamp=base_time + timedelta(seconds=i)
                )
            )
            test_metrics.append(metric)
        
        # 存储指标
        await manager.store_metrics(test_metrics)
        
        # 从存储查询指标
        query = StorageQuery(
            metric_names=['integration_test_metric'],
            time_range=TimeRange(
                start=base_time - timedelta(minutes=1),
                end=base_time + timedelta(minutes=1)
            )
        )
        
        stored_metrics = await manager.query_metrics(query)
        assert len(stored_metrics.metrics) == 10
        
        # 导出查询到的指标
        export_results = await manager.export_all_metrics(stored_metrics.metrics)
        
        # 验证导出成功
        assert 'json' in export_results
        assert export_results['json'] is True
        
        # 验证JSON文件内容
        json_exporter = manager.exporters['json']
        output_file = json_exporter.config.destination_config['output_file']
        
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                exported_data = json.load(f)
            
            assert 'metrics' in exported_data
            assert len(exported_data['metrics']) == 10

    async def test_collector_aggregator_integration(self, integrated_metrics_system):
        """测试收集器与聚合器的集成"""
        manager = integrated_metrics_system
        
        # 收集应用指标
        app_collector = manager.collectors['application']
        
        # 模拟多次收集以产生时间序列数据
        all_metrics = []
        base_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        
        for i in range(30):  # 30个时间点
            timestamp = base_time + timedelta(seconds=i * 10)
            
            # 模拟HTTP请求指标
            request_metric = Metric(
                name='http_requests_per_second',
                type=MetricType.GAUGE,
                description='HTTP requests per second',
                labels={'endpoint': '/api/test', 'method': 'GET'},
                value=MetricValue(
                    value=50 + (i % 20) * 2.5,  # 模拟波动
                    timestamp=timestamp
                )
            )
            all_metrics.append(request_metric)
        
        # 将指标添加到聚合器
        time_window_agg = manager.aggregators['time_window']
        
        for metric in all_metrics:
            await time_window_agg.add_sample(
                metric_name=metric.name,
                labels=metric.labels,
                value=metric.value.value,
                timestamp=metric.value.timestamp
            )
        
        # 执行时间窗口聚合
        aggregated_results = await time_window_agg.aggregate_sliding_window(
            metric_name='http_requests_per_second',
            labels_filter={'endpoint': '/api/test'},
            time_range=TimeRange(
                start=base_time,
                end=base_time + timedelta(minutes=5)
            ),
            window_size_seconds=60,  # 1分钟窗口
            aggregation=Aggregation.AVERAGE
        )
        
        assert len(aggregated_results) > 0
        
        # 验证聚合结果
        for result in aggregated_results:
            assert result.metric_name == 'http_requests_per_second'
            assert result.aggregation_type == Aggregation.AVERAGE
            assert result.value is not None
            assert result.sample_count > 0

    async def test_aggregator_exporter_integration(self, integrated_metrics_system):
        """测试聚合器与导出器的集成"""
        manager = integrated_metrics_system
        
        # 获取统计聚合器
        statistical_agg = manager.aggregators['statistical']
        
        # 创建测试数据
        test_samples = []
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        
        for i in range(100):
            timestamp = base_time + timedelta(seconds=i * 6)
            value = 100 + 50 * (i % 10) / 10  # 创建有规律的变化
            
            await statistical_agg.add_sample(
                metric_name='cpu_usage_percent',
                labels={'instance': 'node-1'},
                value=value,
                timestamp=timestamp
            )
        
        # 计算统计指标
        stats = await statistical_agg.calculate_basic_statistics(
            metric_name='cpu_usage_percent',
            labels_filter={'instance': 'node-1'},
            time_range=TimeRange(
                start=base_time,
                end=base_time + timedelta(minutes=10)
            )
        )
        
        assert stats is not None
        assert 'mean' in stats
        assert 'std_dev' in stats
        assert 'min' in stats
        assert 'max' in stats
        
        # 创建聚合结果指标
        aggregated_metrics = [
            Metric(
                name='cpu_usage_mean',
                type=MetricType.GAUGE,
                description='Mean CPU usage',
                labels={'instance': 'node-1', 'aggregation': 'mean'},
                value=MetricValue(
                    value=stats['mean'],
                    timestamp=datetime.now(timezone.utc)
                )
            ),
            Metric(
                name='cpu_usage_stddev',
                type=MetricType.GAUGE,
                description='CPU usage standard deviation',
                labels={'instance': 'node-1', 'aggregation': 'stddev'},
                value=MetricValue(
                    value=stats['std_dev'],
                    timestamp=datetime.now(timezone.utc)
                )
            )
        ]
        
        # 导出聚合结果
        export_results = await manager.export_all_metrics(aggregated_metrics)
        
        # 验证导出成功
        assert 'json' in export_results
        assert export_results['json'] is True

    async def test_multi_storage_coordination(self, integrated_metrics_system):
        """测试多存储协调"""
        manager = integrated_metrics_system
        
        # 创建测试指标
        test_metrics = []
        for i in range(50):
            metric = Metric(
                name='multi_storage_test',
                type=MetricType.COUNTER,
                description='Multi storage test metric',
                labels={'index': str(i)},
                value=MetricValue(
                    value=i,
                    timestamp=datetime.now(timezone.utc) + timedelta(seconds=i)
                )
            )
            test_metrics.append(metric)
        
        # 存储到主存储（内存）
        primary_result = await manager.store_metrics(test_metrics)
        assert primary_result is True
        
        # 存储到备份存储（文件）
        file_storage = manager.storages.get('file_backup')
        if file_storage:
            backup_result = await file_storage.store_metrics(test_metrics)
            assert backup_result is True
        
        # 从两个存储查询相同的指标
        query = StorageQuery(
            metric_names=['multi_storage_test'],
            time_range=TimeRange(
                start=datetime.now(timezone.utc) - timedelta(minutes=1),
                end=datetime.now(timezone.utc) + timedelta(minutes=2)
            )
        )
        
        # 从主存储查询
        primary_result = await manager.query_metrics(query)
        
        # 从备份存储查询
        if file_storage:
            backup_result = await file_storage.query_metrics(query)
            
            # 验证两个存储的结果一致
            assert len(primary_result.metrics) == len(backup_result.metrics)

    async def test_error_recovery_and_resilience(self, integrated_metrics_system):
        """测试错误恢复和系统弹性"""
        manager = integrated_metrics_system
        
        # 启动系统
        await manager.start()
        
        try:
            # 模拟收集器错误
            system_collector = manager.collectors['system']
            original_collect = system_collector.collect_metrics
            
            # 临时替换为失败的方法
            system_collector.collect_metrics = AsyncMock(
                side_effect=Exception('Simulated collection failure')
            )
            
            # 系统应该继续运行，其他收集器应该正常工作
            await asyncio.sleep(6)  # 等待一个收集周期
            
            # 恢复正常的收集方法
            system_collector.collect_metrics = original_collect
            
            # 验证系统恢复正常
            await asyncio.sleep(6)  # 再等待一个收集周期
            
            # 检查系统健康状态
            health_status = await manager.get_health_status()
            assert health_status['overall_status'] in ['healthy', 'degraded']
            
            # 模拟存储错误
            original_store = manager.storage.store_metrics
            manager.storage.store_metrics = AsyncMock(
                side_effect=Exception('Simulated storage failure')
            )
            
            # 尝试存储指标（应该失败但不崩溃）
            test_metrics = [
                Metric(
                    name='error_test_metric',
                    type=MetricType.GAUGE,
                    description='Error test metric',
                    labels={},
                    value=MetricValue(
                        value=1.0,
                        timestamp=datetime.now(timezone.utc)
                    )
                )
            ]
            
            # 存储操作应该处理错误
            try:
                await manager.store_metrics(test_metrics)
            except Exception:
                pass  # 预期可能会有异常
            
            # 恢复正常存储
            manager.storage.store_metrics = original_store
            
            # 验证系统仍然运行
            assert manager.is_running
            
        finally:
            await manager.stop()

    async def test_performance_under_load(self, integrated_metrics_system):
        """测试负载下的性能"""
        manager = integrated_metrics_system
        
        # 创建大量指标数据
        large_metric_batch = []
        base_time = datetime.now(timezone.utc)
        
        for i in range(1000):  # 1000个指标
            metric = Metric(
                name=f'load_test_metric_{i % 10}',  # 10种不同的指标名
                type=MetricType.GAUGE,
                description='Load test metric',
                labels={
                    'instance': f'node-{i % 5}',
                    'service': f'service-{i % 3}',
                    'index': str(i)
                },
                value=MetricValue(
                    value=i * 0.1,
                    timestamp=base_time + timedelta(seconds=i * 0.1)
                )
            )
            large_metric_batch.append(metric)
        
        # 测量存储性能
        import time
        start_time = time.time()
        
        # 批量存储指标
        storage_result = await manager.store_metrics(large_metric_batch)
        
        storage_time = time.time() - start_time
        
        assert storage_result is True
        assert storage_time < 10.0  # 存储1000个指标应该在10秒内完成
        
        # 测量查询性能
        start_time = time.time()
        
        query = StorageQuery(
            metric_names=['load_test_metric_0', 'load_test_metric_1'],
            time_range=TimeRange(
                start=base_time - timedelta(minutes=1),
                end=base_time + timedelta(minutes=2)
            )
        )
        
        query_result = await manager.query_metrics(query)
        
        query_time = time.time() - start_time
        
        assert len(query_result.metrics) > 0
        assert query_time < 5.0  # 查询应该在5秒内完成
        
        # 测量导出性能
        start_time = time.time()
        
        export_results = await manager.export_all_metrics(query_result.metrics)
        
        export_time = time.time() - start_time
        
        assert 'json' in export_results
        assert export_results['json'] is True
        assert export_time < 5.0  # 导出应该在5秒内完成

    async def test_configuration_hot_reload(self, integrated_metrics_system):
        """测试配置热重载"""
        manager = integrated_metrics_system
        
        # 启动系统
        await manager.start()
        
        try:
            # 获取初始配置
            initial_config = manager.config
            assert initial_config.collection_interval == 5
            
            # 创建新配置
            new_config = MetricsConfig(
                enabled=True,
                collection_interval=10,  # 从5改为10
                export_interval=20,      # 从10改为20
                aggregation_interval=30, # 从15改为30
                storage_retention_days=2, # 从1改为2
                max_memory_mb=1000,      # 从500改为1000
                enable_compression=True,  # 从False改为True
                enable_backup=True       # 从False改为True
            )
            
            # 热重载配置
            reload_result = await manager.hot_reload_config(new_config)
            assert reload_result is True
            
            # 验证配置已更新
            updated_config = manager.config
            assert updated_config.collection_interval == 10
            assert updated_config.export_interval == 20
            assert updated_config.aggregation_interval == 30
            assert updated_config.storage_retention_days == 2
            assert updated_config.max_memory_mb == 1000
            assert updated_config.enable_compression is True
            assert updated_config.enable_backup is True
            
            # 验证系统仍在运行
            assert manager.is_running
            
            # 等待新配置生效
            await asyncio.sleep(2)
            
            # 验证组件使用新配置
            for collector in manager.collectors.values():
                if hasattr(collector, 'collection_interval'):
                    assert collector.collection_interval == 10
            
        finally:
            await manager.stop()

    async def test_metrics_lifecycle_management(self, integrated_metrics_system):
        """测试指标生命周期管理"""
        manager = integrated_metrics_system
        
        # 创建带有不同时间戳的指标
        old_metrics = []
        recent_metrics = []
        
        old_time = datetime.now(timezone.utc) - timedelta(days=2)
        recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        
        # 创建旧指标
        for i in range(10):
            metric = Metric(
                name='lifecycle_old_metric',
                type=MetricType.GAUGE,
                description='Old lifecycle metric',
                labels={'age': 'old', 'index': str(i)},
                value=MetricValue(
                    value=i,
                    timestamp=old_time + timedelta(seconds=i)
                )
            )
            old_metrics.append(metric)
        
        # 创建新指标
        for i in range(10):
            metric = Metric(
                name='lifecycle_recent_metric',
                type=MetricType.GAUGE,
                description='Recent lifecycle metric',
                labels={'age': 'recent', 'index': str(i)},
                value=MetricValue(
                    value=i + 100,
                    timestamp=recent_time + timedelta(seconds=i)
                )
            )
            recent_metrics.append(metric)
        
        # 存储所有指标
        await manager.store_metrics(old_metrics + recent_metrics)
        
        # 验证所有指标都已存储
        all_query = StorageQuery(
            time_range=TimeRange(
                start=old_time - timedelta(hours=1),
                end=datetime.now(timezone.utc)
            )
        )
        
        all_result = await manager.query_metrics(all_query)
        assert len(all_result.metrics) >= 20
        
        # 执行清理（删除旧指标）
        cleanup_cutoff = datetime.now(timezone.utc) - timedelta(days=1)
        cleanup_result = await manager.cleanup_old_metrics(cleanup_cutoff)
        
        # 验证旧指标已被清理
        recent_query = StorageQuery(
            time_range=TimeRange(
                start=cleanup_cutoff,
                end=datetime.now(timezone.utc)
            )
        )
        
        recent_result = await manager.query_metrics(recent_query)
        
        # 应该只剩下新指标
        assert len(recent_result.metrics) >= 10
        
        # 验证旧指标已被删除
        for metric in recent_result.metrics:
            assert metric.value.timestamp >= cleanup_cutoff

    async def test_system_monitoring_and_alerting(self, integrated_metrics_system):
        """测试系统监控和告警"""
        manager = integrated_metrics_system
        
        # 设置系统监控指标
        system_metrics = [
            Metric(
                name='system_cpu_usage_percent',
                type=MetricType.GAUGE,
                description='System CPU usage',
                labels={'instance': 'monitor-node'},
                value=MetricValue(
                    value=85.0,  # 高CPU使用率
                    timestamp=datetime.now(timezone.utc)
                )
            ),
            Metric(
                name='system_memory_usage_percent',
                type=MetricType.GAUGE,
                description='System memory usage',
                labels={'instance': 'monitor-node'},
                value=MetricValue(
                    value=95.0,  # 高内存使用率
                    timestamp=datetime.now(timezone.utc)
                )
            ),
            Metric(
                name='system_disk_usage_percent',
                type=MetricType.GAUGE,
                description='System disk usage',
                labels={'instance': 'monitor-node', 'device': '/dev/sda1'},
                value=MetricValue(
                    value=75.0,  # 正常磁盘使用率
                    timestamp=datetime.now(timezone.utc)
                )
            )
        ]
        
        # 存储系统指标
        await manager.store_metrics(system_metrics)
        
        # 设置告警规则
        alert_rules = [
            {
                'name': 'high_cpu_usage',
                'condition': 'system_cpu_usage_percent > 80',
                'severity': 'warning',
                'description': 'CPU usage is too high'
            },
            {
                'name': 'high_memory_usage',
                'condition': 'system_memory_usage_percent > 90',
                'severity': 'critical',
                'description': 'Memory usage is critically high'
            }
        ]
        
        await manager.set_alert_rules(alert_rules)
        
        # 评估告警
        alerts = await manager.evaluate_alerts(system_metrics)
        
        # 验证告警被触发
        assert len(alerts) >= 2  # CPU和内存告警都应该被触发
        
        alert_names = [alert['name'] for alert in alerts]
        assert 'high_cpu_usage' in alert_names
        assert 'high_memory_usage' in alert_names
        
        # 验证告警详情
        cpu_alert = next(a for a in alerts if a['name'] == 'high_cpu_usage')
        assert cpu_alert['severity'] == 'warning'
        assert cpu_alert['metric_value'] == 85.0
        
        memory_alert = next(a for a in alerts if a['name'] == 'high_memory_usage')
        assert memory_alert['severity'] == 'critical'
        assert memory_alert['metric_value'] == 95.0

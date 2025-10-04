# -*- coding: utf-8 -*-
"""
指标收集器测试

测试新架构的指标收集器功能
"""

import pytest
import asyncio
import psutil
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.collectors.base import BaseCollector, CollectorConfig
from zishu.metrics.collectors.system import SystemMetricsCollector
from zishu.metrics.collectors.application import ApplicationMetricsCollector
from zishu.metrics.collectors.adapter import AdapterMetricsCollector
from zishu.metrics.collectors.custom import CustomMetricsCollector
from zishu.metrics.core.types import Metric, MetricType, MetricValue
from zishu.metrics.core.exceptions import CollectorException

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestBaseCollector:
    """基础收集器测试类"""

    @pytest.fixture
    def collector_config(self):
        """创建收集器配置"""
        return CollectorConfig(
            name='test_collector',
            enabled=True,
            collection_interval=10,
            timeout_seconds=30,
            retry_attempts=3,
            batch_size=100,
            buffer_size=1000,
            enable_caching=True,
            cache_ttl_seconds=60
        )

    @pytest.fixture
    def base_collector(self, collector_config):
        """创建基础收集器实例"""
        return BaseCollector(config=collector_config)

    async def test_collector_initialization(self, collector_config):
        """测试收集器初始化"""
        collector = BaseCollector(config=collector_config)
        
        # 验证初始状态
        assert collector.config == collector_config
        assert not collector.is_running
        
        # 初始化收集器
        await collector.initialize()
        assert collector.is_initialized
        
        # 清理收集器
        await collector.cleanup()

    async def test_collector_lifecycle(self, base_collector):
        """测试收集器生命周期"""
        # 初始化
        await base_collector.initialize()
        assert base_collector.is_initialized
        
        # 启动收集
        await base_collector.start_collection()
        assert base_collector.is_running
        
        # 停止收集
        await base_collector.stop_collection()
        assert not base_collector.is_running
        
        # 清理
        await base_collector.cleanup()

    async def test_collector_health_check(self, base_collector):
        """测试收集器健康检查"""
        await base_collector.initialize()
        
        # 检查健康状态
        health_status = await base_collector.health_check()
        
        assert health_status is not None
        assert 'status' in health_status
        assert 'last_collection' in health_status
        assert 'metrics_collected' in health_status


class TestSystemMetricsCollector:
    """系统指标收集器测试类"""

    @pytest.fixture
    def system_collector_config(self):
        """创建系统指标收集器配置"""
        return CollectorConfig(
            name='system_metrics_collector',
            enabled=True,
            collection_interval=5,
            timeout_seconds=10,
            retry_attempts=2,
            batch_size=50,
            buffer_size=500,
            enable_caching=True,
            cache_ttl_seconds=30,
            custom_settings={
                'collect_cpu': True,
                'collect_memory': True,
                'collect_disk': True,
                'collect_network': True,
                'collect_processes': True
            }
        )

    @pytest.fixture
    async def system_collector(self, system_collector_config):
        """创建系统指标收集器实例"""
        collector = SystemMetricsCollector(config=system_collector_config)
        await collector.initialize()
        yield collector
        await collector.cleanup()

    async def test_collect_cpu_metrics(self, system_collector):
        """测试收集CPU指标"""
        # 收集CPU指标
        cpu_metrics = await system_collector.collect_cpu_metrics()
        
        assert len(cpu_metrics) > 0
        
        # 验证CPU使用率指标
        cpu_usage_metric = next((m for m in cpu_metrics if m.name == 'system_cpu_usage_percent'), None)
        assert cpu_usage_metric is not None
        assert cpu_usage_metric.type == MetricType.GAUGE
        assert 0 <= cpu_usage_metric.value.value <= 100
        
        # 验证CPU核心数指标
        cpu_count_metric = next((m for m in cpu_metrics if m.name == 'system_cpu_count'), None)
        assert cpu_count_metric is not None
        assert cpu_count_metric.value.value > 0

    async def test_collect_memory_metrics(self, system_collector):
        """测试收集内存指标"""
        # 收集内存指标
        memory_metrics = await system_collector.collect_memory_metrics()
        
        assert len(memory_metrics) > 0
        
        # 验证内存使用率指标
        memory_usage_metric = next((m for m in memory_metrics if m.name == 'system_memory_usage_percent'), None)
        assert memory_usage_metric is not None
        assert memory_usage_metric.type == MetricType.GAUGE
        assert 0 <= memory_usage_metric.value.value <= 100
        
        # 验证总内存指标
        memory_total_metric = next((m for m in memory_metrics if m.name == 'system_memory_total_bytes'), None)
        assert memory_total_metric is not None
        assert memory_total_metric.value.value > 0

    async def test_collect_disk_metrics(self, system_collector):
        """测试收集磁盘指标"""
        # 收集磁盘指标
        disk_metrics = await system_collector.collect_disk_metrics()
        
        assert len(disk_metrics) > 0
        
        # 验证磁盘使用率指标
        disk_usage_metrics = [m for m in disk_metrics if m.name == 'system_disk_usage_percent']
        assert len(disk_usage_metrics) > 0
        
        for metric in disk_usage_metrics:
            assert metric.type == MetricType.GAUGE
            assert 0 <= metric.value.value <= 100
            assert 'device' in metric.labels or 'mountpoint' in metric.labels

    async def test_collect_network_metrics(self, system_collector):
        """测试收集网络指标"""
        # 收集网络指标
        network_metrics = await system_collector.collect_network_metrics()
        
        assert len(network_metrics) > 0
        
        # 验证网络字节数指标
        bytes_sent_metrics = [m for m in network_metrics if m.name == 'system_network_bytes_sent']
        bytes_recv_metrics = [m for m in network_metrics if m.name == 'system_network_bytes_received']
        
        assert len(bytes_sent_metrics) > 0
        assert len(bytes_recv_metrics) > 0
        
        for metric in bytes_sent_metrics + bytes_recv_metrics:
            assert metric.type == MetricType.COUNTER
            assert metric.value.value >= 0
            assert 'interface' in metric.labels

    async def test_collect_process_metrics(self, system_collector):
        """测试收集进程指标"""
        # 收集进程指标
        process_metrics = await system_collector.collect_process_metrics()
        
        assert len(process_metrics) > 0
        
        # 验证进程数量指标
        process_count_metric = next((m for m in process_metrics if m.name == 'system_process_count'), None)
        assert process_count_metric is not None
        assert process_count_metric.type == MetricType.GAUGE
        assert process_count_metric.value.value > 0

    async def test_collect_all_system_metrics(self, system_collector):
        """测试收集所有系统指标"""
        # 收集所有系统指标
        all_metrics = await system_collector.collect_metrics()
        
        assert len(all_metrics) > 0
        
        # 验证包含各类系统指标
        metric_names = [m.name for m in all_metrics]
        assert any('cpu' in name for name in metric_names)
        assert any('memory' in name for name in metric_names)
        assert any('disk' in name for name in metric_names)
        assert any('network' in name for name in metric_names)


class TestApplicationMetricsCollector:
    """应用指标收集器测试类"""

    @pytest.fixture
    def app_collector_config(self):
        """创建应用指标收集器配置"""
        return CollectorConfig(
            name='application_metrics_collector',
            enabled=True,
            collection_interval=10,
            timeout_seconds=15,
            retry_attempts=3,
            batch_size=100,
            buffer_size=1000,
            enable_caching=True,
            cache_ttl_seconds=60,
            custom_settings={
                'collect_runtime': True,
                'collect_gc': True,
                'collect_threads': True,
                'collect_requests': True,
                'collect_errors': True
            }
        )

    @pytest.fixture
    async def app_collector(self, app_collector_config):
        """创建应用指标收集器实例"""
        collector = ApplicationMetricsCollector(config=app_collector_config)
        await collector.initialize()
        yield collector
        await collector.cleanup()

    async def test_collect_runtime_metrics(self, app_collector):
        """测试收集运行时指标"""
        # 收集运行时指标
        runtime_metrics = await app_collector.collect_runtime_metrics()
        
        assert len(runtime_metrics) > 0
        
        # 验证Python版本指标
        python_version_metric = next((m for m in runtime_metrics if m.name == 'app_python_version'), None)
        assert python_version_metric is not None
        
        # 验证启动时间指标
        start_time_metric = next((m for m in runtime_metrics if m.name == 'app_start_time_seconds'), None)
        assert start_time_metric is not None
        assert start_time_metric.value.value > 0

    async def test_collect_gc_metrics(self, app_collector):
        """测试收集垃圾回收指标"""
        # 收集GC指标
        gc_metrics = await app_collector.collect_gc_metrics()
        
        assert len(gc_metrics) > 0
        
        # 验证GC计数指标
        gc_count_metrics = [m for m in gc_metrics if 'gc_count' in m.name]
        assert len(gc_count_metrics) > 0
        
        for metric in gc_count_metrics:
            assert metric.type == MetricType.COUNTER
            assert metric.value.value >= 0

    async def test_collect_thread_metrics(self, app_collector):
        """测试收集线程指标"""
        # 收集线程指标
        thread_metrics = await app_collector.collect_thread_metrics()
        
        assert len(thread_metrics) > 0
        
        # 验证活跃线程数指标
        active_threads_metric = next((m for m in thread_metrics if m.name == 'app_threads_active'), None)
        assert active_threads_metric is not None
        assert active_threads_metric.type == MetricType.GAUGE
        assert active_threads_metric.value.value > 0

    async def test_collect_request_metrics(self, app_collector):
        """测试收集请求指标"""
        # 模拟一些请求
        await app_collector.record_request('/api/test', 'GET', 200, 0.15)
        await app_collector.record_request('/api/test', 'POST', 201, 0.25)
        await app_collector.record_request('/api/error', 'GET', 500, 1.0)
        
        # 收集请求指标
        request_metrics = await app_collector.collect_request_metrics()
        
        assert len(request_metrics) > 0
        
        # 验证请求计数指标
        request_count_metrics = [m for m in request_metrics if 'request_count' in m.name]
        assert len(request_count_metrics) > 0
        
        # 验证请求持续时间指标
        request_duration_metrics = [m for m in request_metrics if 'request_duration' in m.name]
        assert len(request_duration_metrics) > 0

    async def test_collect_error_metrics(self, app_collector):
        """测试收集错误指标"""
        # 模拟一些错误
        await app_collector.record_error('ValueError', 'Invalid input')
        await app_collector.record_error('ConnectionError', 'Network timeout')
        await app_collector.record_error('ValueError', 'Another invalid input')
        
        # 收集错误指标
        error_metrics = await app_collector.collect_error_metrics()
        
        assert len(error_metrics) > 0
        
        # 验证错误计数指标
        error_count_metrics = [m for m in error_metrics if 'error_count' in m.name]
        assert len(error_count_metrics) > 0
        
        # 验证错误类型分布
        value_error_metric = next((m for m in error_count_metrics 
                                 if m.labels.get('error_type') == 'ValueError'), None)
        assert value_error_metric is not None
        assert value_error_metric.value.value == 2  # 两个ValueError


class TestAdapterMetricsCollector:
    """适配器指标收集器测试类"""

    @pytest.fixture
    def adapter_collector_config(self):
        """创建适配器指标收集器配置"""
        return CollectorConfig(
            name='adapter_metrics_collector',
            enabled=True,
            collection_interval=5,
            timeout_seconds=10,
            retry_attempts=2,
            batch_size=50,
            buffer_size=500,
            enable_caching=True,
            cache_ttl_seconds=30,
            custom_settings={
                'collect_execution': True,
                'collect_performance': True,
                'collect_errors': True,
                'collect_resources': True
            }
        )

    @pytest.fixture
    async def adapter_collector(self, adapter_collector_config):
        """创建适配器指标收集器实例"""
        collector = AdapterMetricsCollector(config=adapter_collector_config)
        await collector.initialize()
        yield collector
        await collector.cleanup()

    async def test_collect_execution_metrics(self, adapter_collector):
        """测试收集执行指标"""
        # 模拟适配器执行
        await adapter_collector.record_execution('test-adapter', 'success', 1.5)
        await adapter_collector.record_execution('test-adapter', 'success', 2.0)
        await adapter_collector.record_execution('test-adapter', 'failure', 0.5)
        await adapter_collector.record_execution('another-adapter', 'success', 3.0)
        
        # 收集执行指标
        execution_metrics = await adapter_collector.collect_execution_metrics()
        
        assert len(execution_metrics) > 0
        
        # 验证执行计数指标
        execution_count_metrics = [m for m in execution_metrics if 'execution_count' in m.name]
        assert len(execution_count_metrics) > 0
        
        # 验证成功率指标
        success_rate_metrics = [m for m in execution_metrics if 'success_rate' in m.name]
        assert len(success_rate_metrics) > 0

    async def test_collect_performance_metrics(self, adapter_collector):
        """测试收集性能指标"""
        # 模拟性能数据
        await adapter_collector.record_performance('test-adapter', {
            'cpu_usage': 25.5,
            'memory_usage': 128.0,
            'execution_time': 1.2,
            'throughput': 100.0
        })
        
        # 收集性能指标
        performance_metrics = await adapter_collector.collect_performance_metrics()
        
        assert len(performance_metrics) > 0
        
        # 验证CPU使用率指标
        cpu_usage_metric = next((m for m in performance_metrics 
                               if 'cpu_usage' in m.name and m.labels.get('adapter_id') == 'test-adapter'), None)
        assert cpu_usage_metric is not None
        assert cpu_usage_metric.value.value == 25.5

    async def test_collect_adapter_error_metrics(self, adapter_collector):
        """测试收集适配器错误指标"""
        # 模拟适配器错误
        await adapter_collector.record_adapter_error('test-adapter', 'ValidationError', 'Invalid input data')
        await adapter_collector.record_adapter_error('test-adapter', 'TimeoutError', 'Operation timeout')
        await adapter_collector.record_adapter_error('another-adapter', 'ConnectionError', 'Network error')
        
        # 收集错误指标
        error_metrics = await adapter_collector.collect_adapter_error_metrics()
        
        assert len(error_metrics) > 0
        
        # 验证错误计数指标
        error_count_metrics = [m for m in error_metrics if 'adapter_error_count' in m.name]
        assert len(error_count_metrics) > 0
        
        # 验证特定适配器的错误
        test_adapter_errors = [m for m in error_count_metrics 
                             if m.labels.get('adapter_id') == 'test-adapter']
        assert len(test_adapter_errors) >= 2  # ValidationError和TimeoutError

    async def test_collect_resource_metrics(self, adapter_collector):
        """测试收集资源指标"""
        # 模拟资源使用
        await adapter_collector.record_resource_usage('test-adapter', {
            'memory_allocated': 256.0,
            'memory_used': 128.0,
            'file_handles': 10,
            'network_connections': 5
        })
        
        # 收集资源指标
        resource_metrics = await adapter_collector.collect_resource_metrics()
        
        assert len(resource_metrics) > 0
        
        # 验证内存分配指标
        memory_allocated_metric = next((m for m in resource_metrics 
                                      if 'memory_allocated' in m.name), None)
        assert memory_allocated_metric is not None
        assert memory_allocated_metric.value.value == 256.0


class TestCustomMetricsCollector:
    """自定义指标收集器测试类"""

    @pytest.fixture
    def custom_collector_config(self):
        """创建自定义指标收集器配置"""
        return CollectorConfig(
            name='custom_metrics_collector',
            enabled=True,
            collection_interval=15,
            timeout_seconds=20,
            retry_attempts=3,
            batch_size=100,
            buffer_size=1000,
            enable_caching=True,
            cache_ttl_seconds=120,
            custom_settings={
                'custom_metrics_file': '/tmp/custom_metrics.json',
                'enable_scripting': True,
                'script_timeout': 10
            }
        )

    @pytest.fixture
    async def custom_collector(self, custom_collector_config):
        """创建自定义指标收集器实例"""
        collector = CustomMetricsCollector(config=custom_collector_config)
        await collector.initialize()
        yield collector
        await collector.cleanup()

    async def test_register_custom_metric(self, custom_collector):
        """测试注册自定义指标"""
        # 注册自定义指标
        custom_metric_def = {
            'name': 'business_kpi_value',
            'type': 'gauge',
            'description': 'Business KPI value',
            'labels': ['department', 'region'],
            'collection_function': 'collect_business_kpi'
        }
        
        result = await custom_collector.register_custom_metric(custom_metric_def)
        assert result is True
        
        # 验证指标已注册
        registered_metrics = await custom_collector.get_registered_metrics()
        assert 'business_kpi_value' in [m['name'] for m in registered_metrics]

    async def test_collect_custom_metrics(self, custom_collector):
        """测试收集自定义指标"""
        # 注册并实现自定义指标收集函数
        async def collect_business_kpi():
            return [
                Metric(
                    name='business_kpi_value',
                    type=MetricType.GAUGE,
                    description='Business KPI value',
                    labels={'department': 'sales', 'region': 'north'},
                    value=MetricValue(value=85.5, timestamp=datetime.now(timezone.utc))
                ),
                Metric(
                    name='business_kpi_value',
                    type=MetricType.GAUGE,
                    description='Business KPI value',
                    labels={'department': 'marketing', 'region': 'south'},
                    value=MetricValue(value=92.3, timestamp=datetime.now(timezone.utc))
                )
            ]
        
        # 注册收集函数
        await custom_collector.register_collection_function('collect_business_kpi', collect_business_kpi)
        
        # 收集自定义指标
        custom_metrics = await custom_collector.collect_custom_metrics()
        
        assert len(custom_metrics) >= 2
        
        # 验证收集的指标
        sales_metric = next((m for m in custom_metrics 
                           if m.labels.get('department') == 'sales'), None)
        assert sales_metric is not None
        assert sales_metric.value.value == 85.5

    async def test_execute_custom_script(self, custom_collector):
        """测试执行自定义脚本"""
        # 创建自定义脚本
        script_content = """
import json
import datetime

def collect_metrics():
    return [
        {
            'name': 'script_generated_metric',
            'type': 'counter',
            'value': 42,
            'labels': {'source': 'script'},
            'timestamp': datetime.datetime.now().isoformat()
        }
    ]

result = collect_metrics()
print(json.dumps(result))
"""
        
        # 执行脚本
        script_result = await custom_collector.execute_script(script_content, timeout=5)
        
        assert script_result is not None
        assert len(script_result) >= 1
        assert script_result[0]['name'] == 'script_generated_metric'

    async def test_load_metrics_from_file(self, custom_collector):
        """测试从文件加载指标"""
        # 创建临时指标文件
        import tempfile
        import json
        
        metrics_data = [
            {
                'name': 'file_based_metric',
                'type': 'gauge',
                'value': 123.45,
                'labels': {'source': 'file'},
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(metrics_data, f)
            temp_file_path = f.name
        
        try:
            # 从文件加载指标
            file_metrics = await custom_collector.load_metrics_from_file(temp_file_path)
            
            assert len(file_metrics) == 1
            assert file_metrics[0].name == 'file_based_metric'
            assert file_metrics[0].value.value == 123.45
        finally:
            import os
            os.unlink(temp_file_path)


class TestCollectorIntegration:
    """收集器集成测试类"""

    @pytest.fixture
    async def all_collectors(self):
        """创建所有类型的收集器"""
        collectors = {}
        
        # 系统收集器
        system_config = CollectorConfig(name='system', enabled=True, collection_interval=5)
        collectors['system'] = SystemMetricsCollector(config=system_config)
        
        # 应用收集器
        app_config = CollectorConfig(name='application', enabled=True, collection_interval=10)
        collectors['application'] = ApplicationMetricsCollector(config=app_config)
        
        # 适配器收集器
        adapter_config = CollectorConfig(name='adapter', enabled=True, collection_interval=5)
        collectors['adapter'] = AdapterMetricsCollector(config=adapter_config)
        
        # 自定义收集器
        custom_config = CollectorConfig(name='custom', enabled=True, collection_interval=15)
        collectors['custom'] = CustomMetricsCollector(config=custom_config)
        
        # 初始化所有收集器
        for collector in collectors.values():
            await collector.initialize()
        
        yield collectors
        
        # 清理所有收集器
        for collector in collectors.values():
            await collector.cleanup()

    async def test_concurrent_collection(self, all_collectors):
        """测试并发收集"""
        # 并发启动所有收集器
        start_tasks = [collector.start_collection() for collector in all_collectors.values()]
        await asyncio.gather(*start_tasks)
        
        # 验证所有收集器都在运行
        for collector in all_collectors.values():
            assert collector.is_running
        
        # 并发收集指标
        collect_tasks = [collector.collect_metrics() for collector in all_collectors.values()]
        results = await asyncio.gather(*collect_tasks)
        
        # 验证收集结果
        assert len(results) == len(all_collectors)
        for result in results:
            assert isinstance(result, list)
            assert len(result) >= 0
        
        # 并发停止所有收集器
        stop_tasks = [collector.stop_collection() for collector in all_collectors.values()]
        await asyncio.gather(*stop_tasks)

    async def test_collector_coordination(self, all_collectors):
        """测试收集器协调"""
        # 模拟收集器间的协调
        system_collector = all_collectors['system']
        app_collector = all_collectors['application']
        
        # 系统收集器收集基础指标
        system_metrics = await system_collector.collect_metrics()
        
        # 应用收集器基于系统指标收集应用指标
        app_metrics = await app_collector.collect_metrics_with_context(system_metrics)
        
        assert len(system_metrics) > 0
        assert len(app_metrics) > 0

    async def test_collector_error_handling(self, all_collectors):
        """测试收集器错误处理"""
        system_collector = all_collectors['system']
        
        # 模拟收集错误
        with patch.object(system_collector, 'collect_cpu_metrics', side_effect=Exception('CPU collection failed')):
            # 收集器应该处理错误并继续收集其他指标
            metrics = await system_collector.collect_metrics()
            
            # 应该仍然有其他指标（内存、磁盘等）
            assert isinstance(metrics, list)
            # 具体行为取决于实现

    async def test_collector_performance(self, all_collectors):
        """测试收集器性能"""
        system_collector = all_collectors['system']
        
        # 测量收集性能
        start_time = time.time()
        iterations = 10
        
        for _ in range(iterations):
            await system_collector.collect_metrics()
        
        end_time = time.time()
        avg_collection_time = (end_time - start_time) / iterations
        
        # 验证收集性能满足要求
        assert avg_collection_time < 1.0  # 平均收集时间应小于1秒
        
        # 获取性能指标
        performance_stats = await system_collector.get_performance_stats()
        
        assert performance_stats is not None
        assert 'collection_time' in performance_stats
        assert 'metrics_per_second' in performance_stats

    async def test_collector_memory_usage(self, all_collectors):
        """测试收集器内存使用"""
        import gc
        import sys
        
        # 获取初始内存使用
        gc.collect()
        initial_objects = len(gc.get_objects())
        
        # 执行大量收集操作
        for _ in range(100):
            for collector in all_collectors.values():
                await collector.collect_metrics()
        
        # 强制垃圾回收
        gc.collect()
        final_objects = len(gc.get_objects())
        
        # 验证没有严重的内存泄漏
        object_growth = final_objects - initial_objects
        assert object_growth < 1000  # 对象增长应该在合理范围内

    async def test_collector_cleanup(self, all_collectors):
        """测试收集器清理"""
        # 启动所有收集器
        for collector in all_collectors.values():
            await collector.start_collection()
            assert collector.is_running
        
        # 清理所有收集器
        for collector in all_collectors.values():
            await collector.cleanup()
            assert not collector.is_running
        
        # 验证资源已释放（具体行为取决于实现）

# -*- coding: utf-8 -*-
"""
指标导出器测试

测试新架构的指标导出器功能
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.exporters.base import BaseExporter, ExporterConfig
from zishu.metrics.exporters.prometheus import PrometheusExporter
from zishu.metrics.exporters.json import JsonExporter
from zishu.metrics.exporters.csv import CsvExporter
from zishu.metrics.exporters.influxdb import InfluxDBExporter
from zishu.metrics.exporters.elasticsearch import ElasticsearchExporter
from zishu.metrics.core.types import Metric, MetricType, MetricValue
from zishu.metrics.core.exceptions import ExporterException

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestBaseExporter:
    """基础导出器测试类"""

    @pytest.fixture
    def exporter_config(self):
        """创建导出器配置"""
        return ExporterConfig(
            name='test_exporter',
            enabled=True,
            export_interval=30,
            batch_size=100,
            timeout_seconds=10,
            retry_attempts=3,
            buffer_size=1000,
            compression_enabled=True,
            format_options={}
        )

    @pytest.fixture
    def base_exporter(self, exporter_config):
        """创建基础导出器实例"""
        return BaseExporter(config=exporter_config)

    @pytest.fixture
    def sample_metrics(self):
        """创建示例指标"""
        return [
            Metric(
                name='test_counter',
                type=MetricType.COUNTER,
                description='Test counter metric',
                labels={'service': 'test', 'env': 'dev'},
                value=MetricValue(value=42, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='test_gauge',
                type=MetricType.GAUGE,
                description='Test gauge metric',
                labels={'instance': 'node-1'},
                value=MetricValue(value=75.5, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='test_histogram',
                type=MetricType.HISTOGRAM,
                description='Test histogram metric',
                labels={'operation': 'api_call'},
                value=MetricValue(value=1.25, timestamp=datetime.now(timezone.utc))
            )
        ]

    async def test_exporter_initialization(self, exporter_config):
        """测试导出器初始化"""
        exporter = BaseExporter(config=exporter_config)
        
        # 验证初始状态
        assert exporter.config == exporter_config
        assert not exporter.is_running
        
        # 初始化导出器
        await exporter.initialize()
        assert exporter.is_initialized
        
        # 清理导出器
        await exporter.cleanup()

    async def test_exporter_lifecycle(self, base_exporter):
        """测试导出器生命周期"""
        # 初始化
        await base_exporter.initialize()
        assert base_exporter.is_initialized
        
        # 启动导出
        await base_exporter.start_export()
        assert base_exporter.is_running
        
        # 停止导出
        await base_exporter.stop_export()
        assert not base_exporter.is_running
        
        # 清理
        await base_exporter.cleanup()

    async def test_exporter_health_check(self, base_exporter):
        """测试导出器健康检查"""
        await base_exporter.initialize()
        
        # 检查健康状态
        health_status = await base_exporter.health_check()
        
        assert health_status is not None
        assert 'status' in health_status
        assert 'last_export' in health_status
        assert 'metrics_exported' in health_status


class TestPrometheusExporter:
    """Prometheus导出器测试类"""

    @pytest.fixture
    def prometheus_config(self):
        """创建Prometheus导出器配置"""
        return ExporterConfig(
            name='prometheus_exporter',
            enabled=True,
            export_interval=15,
            batch_size=1000,
            timeout_seconds=30,
            retry_attempts=3,
            buffer_size=5000,
            compression_enabled=True,
            format_options={
                'include_help': True,
                'include_type': True,
                'metric_prefix': 'zishu_',
                'label_separator': '_'
            },
            destination_config={
                'endpoint': 'http://localhost:9090/api/v1/write',
                'auth_token': 'test_token',
                'headers': {'Content-Type': 'application/x-protobuf'}
            }
        )

    @pytest.fixture
    async def prometheus_exporter(self, prometheus_config):
        """创建Prometheus导出器实例"""
        exporter = PrometheusExporter(config=prometheus_config)
        await exporter.initialize()
        yield exporter
        await exporter.cleanup()

    async def test_format_prometheus_metrics(self, prometheus_exporter, sample_metrics):
        """测试格式化Prometheus指标"""
        # 格式化指标
        formatted_output = await prometheus_exporter.format_metrics(sample_metrics)
        
        assert formatted_output is not None
        assert isinstance(formatted_output, str)
        
        # 验证Prometheus格式
        lines = formatted_output.strip().split('\n')
        
        # 验证包含HELP注释
        help_lines = [line for line in lines if line.startswith('# HELP')]
        assert len(help_lines) >= len(sample_metrics)
        
        # 验证包含TYPE注释
        type_lines = [line for line in lines if line.startswith('# TYPE')]
        assert len(type_lines) >= len(sample_metrics)
        
        # 验证指标数据行
        metric_lines = [line for line in lines if not line.startswith('#') and line.strip()]
        assert len(metric_lines) >= len(sample_metrics)
        
        # 验证特定指标格式
        counter_line = next((line for line in metric_lines if 'zishu_test_counter' in line), None)
        assert counter_line is not None
        assert 'service="test"' in counter_line
        assert 'env="dev"' in counter_line
        assert '42' in counter_line

    async def test_export_to_prometheus(self, prometheus_exporter, sample_metrics):
        """测试导出到Prometheus"""
        # Mock HTTP客户端
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = Mock()
            mock_response.status = 200
            mock_response.text = AsyncMock(return_value='OK')
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # 导出指标
            result = await prometheus_exporter.export_metrics(sample_metrics)
            
            assert result is True
            mock_post.assert_called_once()
            
            # 验证请求参数
            call_args = mock_post.call_args
            assert call_args[1]['url'] == 'http://localhost:9090/api/v1/write'
            assert 'auth_token' in call_args[1]['headers']['Authorization']

    async def test_prometheus_metric_types(self, prometheus_exporter):
        """测试Prometheus指标类型转换"""
        # 测试不同类型的指标
        metrics = [
            Metric(
                name='counter_metric',
                type=MetricType.COUNTER,
                description='Counter metric',
                labels={},
                value=MetricValue(value=100, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='gauge_metric',
                type=MetricType.GAUGE,
                description='Gauge metric',
                labels={},
                value=MetricValue(value=50.5, timestamp=datetime.now(timezone.utc))
            ),
            Metric(
                name='histogram_metric',
                type=MetricType.HISTOGRAM,
                description='Histogram metric',
                labels={},
                value=MetricValue(value=2.5, timestamp=datetime.now(timezone.utc))
            )
        ]
        
        formatted_output = await prometheus_exporter.format_metrics(metrics)
        
        # 验证类型声明
        assert '# TYPE zishu_counter_metric counter' in formatted_output
        assert '# TYPE zishu_gauge_metric gauge' in formatted_output
        assert '# TYPE zishu_histogram_metric histogram' in formatted_output

    async def test_prometheus_label_handling(self, prometheus_exporter):
        """测试Prometheus标签处理"""
        # 测试特殊字符的标签
        metric = Metric(
            name='test_metric',
            type=MetricType.GAUGE,
            description='Test metric with special labels',
            labels={
                'service-name': 'test-service',
                'version.number': '1.0.0',
                'environment': 'production'
            },
            value=MetricValue(value=1, timestamp=datetime.now(timezone.utc))
        )
        
        formatted_output = await prometheus_exporter.format_metrics([metric])
        
        # 验证标签格式化
        assert 'service_name="test-service"' in formatted_output
        assert 'version_number="1.0.0"' in formatted_output
        assert 'environment="production"' in formatted_output


class TestJsonExporter:
    """JSON导出器测试类"""

    @pytest.fixture
    def json_config(self):
        """创建JSON导出器配置"""
        return ExporterConfig(
            name='json_exporter',
            enabled=True,
            export_interval=20,
            batch_size=500,
            timeout_seconds=15,
            retry_attempts=2,
            buffer_size=2000,
            compression_enabled=False,
            format_options={
                'pretty_print': True,
                'include_metadata': True,
                'timestamp_format': 'iso',
                'null_value_handling': 'omit'
            },
            destination_config={
                'output_file': '/tmp/metrics.json',
                'rotation_enabled': True,
                'max_file_size_mb': 100
            }
        )

    @pytest.fixture
    async def json_exporter(self, json_config):
        """创建JSON导出器实例"""
        exporter = JsonExporter(config=json_config)
        await exporter.initialize()
        yield exporter
        await exporter.cleanup()

    async def test_format_json_metrics(self, json_exporter, sample_metrics):
        """测试格式化JSON指标"""
        # 格式化指标
        formatted_output = await json_exporter.format_metrics(sample_metrics)
        
        assert formatted_output is not None
        
        # 解析JSON
        if isinstance(formatted_output, str):
            json_data = json.loads(formatted_output)
        else:
            json_data = formatted_output
        
        assert isinstance(json_data, dict)
        assert 'metrics' in json_data
        assert 'metadata' in json_data
        
        # 验证指标数据
        metrics_data = json_data['metrics']
        assert len(metrics_data) == len(sample_metrics)
        
        # 验证特定指标
        counter_metric = next((m for m in metrics_data if m['name'] == 'test_counter'), None)
        assert counter_metric is not None
        assert counter_metric['type'] == 'counter'
        assert counter_metric['value'] == 42
        assert counter_metric['labels']['service'] == 'test'

    async def test_export_to_file(self, json_exporter, sample_metrics):
        """测试导出到文件"""
        # 使用临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # 更新配置以使用临时文件
            json_exporter.config.destination_config['output_file'] = temp_path
            
            # 导出指标
            result = await json_exporter.export_metrics(sample_metrics)
            
            assert result is True
            
            # 验证文件内容
            assert os.path.exists(temp_path)
            with open(temp_path, 'r') as f:
                file_content = json.load(f)
            
            assert 'metrics' in file_content
            assert len(file_content['metrics']) == len(sample_metrics)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    async def test_json_timestamp_formats(self, json_exporter):
        """测试JSON时间戳格式"""
        metric = Metric(
            name='timestamp_test',
            type=MetricType.GAUGE,
            description='Timestamp test metric',
            labels={},
            value=MetricValue(value=1, timestamp=datetime.now(timezone.utc))
        )
        
        # 测试ISO格式
        json_exporter.config.format_options['timestamp_format'] = 'iso'
        iso_output = await json_exporter.format_metrics([metric])
        iso_data = json.loads(iso_output) if isinstance(iso_output, str) else iso_output
        
        timestamp_str = iso_data['metrics'][0]['timestamp']
        assert 'T' in timestamp_str  # ISO格式包含T
        
        # 测试Unix时间戳格式
        json_exporter.config.format_options['timestamp_format'] = 'unix'
        unix_output = await json_exporter.format_metrics([metric])
        unix_data = json.loads(unix_output) if isinstance(unix_output, str) else unix_output
        
        timestamp_unix = unix_data['metrics'][0]['timestamp']
        assert isinstance(timestamp_unix, (int, float))


class TestCsvExporter:
    """CSV导出器测试类"""

    @pytest.fixture
    def csv_config(self):
        """创建CSV导出器配置"""
        return ExporterConfig(
            name='csv_exporter',
            enabled=True,
            export_interval=25,
            batch_size=200,
            timeout_seconds=10,
            retry_attempts=2,
            buffer_size=1000,
            compression_enabled=True,
            format_options={
                'delimiter': ',',
                'quote_char': '"',
                'include_header': True,
                'escape_char': '\\',
                'line_terminator': '\n'
            },
            destination_config={
                'output_file': '/tmp/metrics.csv',
                'append_mode': True
            }
        )

    @pytest.fixture
    async def csv_exporter(self, csv_config):
        """创建CSV导出器实例"""
        exporter = CsvExporter(config=csv_config)
        await exporter.initialize()
        yield exporter
        await exporter.cleanup()

    async def test_format_csv_metrics(self, csv_exporter, sample_metrics):
        """测试格式化CSV指标"""
        # 格式化指标
        formatted_output = await csv_exporter.format_metrics(sample_metrics)
        
        assert formatted_output is not None
        assert isinstance(formatted_output, str)
        
        # 验证CSV格式
        lines = formatted_output.strip().split('\n')
        
        # 验证头部
        header_line = lines[0]
        expected_columns = ['name', 'type', 'value', 'timestamp', 'labels', 'description']
        for column in expected_columns:
            assert column in header_line
        
        # 验证数据行
        data_lines = lines[1:]
        assert len(data_lines) == len(sample_metrics)
        
        # 验证特定指标行
        counter_line = next((line for line in data_lines if 'test_counter' in line), None)
        assert counter_line is not None
        assert '42' in counter_line
        assert 'counter' in counter_line

    async def test_export_csv_to_file(self, csv_exporter, sample_metrics):
        """测试导出CSV到文件"""
        # 使用临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # 更新配置以使用临时文件
            csv_exporter.config.destination_config['output_file'] = temp_path
            
            # 导出指标
            result = await csv_exporter.export_metrics(sample_metrics)
            
            assert result is True
            
            # 验证文件内容
            assert os.path.exists(temp_path)
            with open(temp_path, 'r') as f:
                content = f.read()
            
            lines = content.strip().split('\n')
            assert len(lines) == len(sample_metrics) + 1  # +1 for header
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    async def test_csv_label_flattening(self, csv_exporter):
        """测试CSV标签扁平化"""
        metric = Metric(
            name='complex_labels_metric',
            type=MetricType.GAUGE,
            description='Metric with complex labels',
            labels={
                'service': 'api',
                'version': '1.0',
                'environment': 'prod'
            },
            value=MetricValue(value=100, timestamp=datetime.now(timezone.utc))
        )
        
        formatted_output = await csv_exporter.format_metrics([metric])
        
        # 验证标签被正确序列化
        assert 'service=api' in formatted_output
        assert 'version=1.0' in formatted_output
        assert 'environment=prod' in formatted_output


class TestInfluxDBExporter:
    """InfluxDB导出器测试类"""

    @pytest.fixture
    def influxdb_config(self):
        """创建InfluxDB导出器配置"""
        return ExporterConfig(
            name='influxdb_exporter',
            enabled=True,
            export_interval=10,
            batch_size=1000,
            timeout_seconds=30,
            retry_attempts=3,
            buffer_size=5000,
            compression_enabled=True,
            format_options={
                'precision': 'ms',
                'retention_policy': 'autogen',
                'consistency': 'one'
            },
            destination_config={
                'host': 'localhost',
                'port': 8086,
                'database': 'metrics',
                'username': 'admin',
                'password': 'password',
                'ssl': False
            }
        )

    @pytest.fixture
    async def influxdb_exporter(self, influxdb_config):
        """创建InfluxDB导出器实例"""
        exporter = InfluxDBExporter(config=influxdb_config)
        await exporter.initialize()
        yield exporter
        await exporter.cleanup()

    async def test_format_influxdb_metrics(self, influxdb_exporter, sample_metrics):
        """测试格式化InfluxDB指标"""
        # 格式化指标
        formatted_output = await influxdb_exporter.format_metrics(sample_metrics)
        
        assert formatted_output is not None
        assert isinstance(formatted_output, str)
        
        # 验证InfluxDB行协议格式
        lines = formatted_output.strip().split('\n')
        assert len(lines) == len(sample_metrics)
        
        # 验证特定指标格式
        counter_line = next((line for line in lines if 'test_counter' in line), None)
        assert counter_line is not None
        
        # InfluxDB行协议格式: measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp
        parts = counter_line.split(' ')
        assert len(parts) >= 2
        
        # 验证measurement和tags部分
        measurement_tags = parts[0]
        assert 'test_counter' in measurement_tags
        assert 'service=test' in measurement_tags
        assert 'env=dev' in measurement_tags
        
        # 验证fields部分
        fields = parts[1]
        assert 'value=42' in fields

    async def test_export_to_influxdb(self, influxdb_exporter, sample_metrics):
        """测试导出到InfluxDB"""
        # Mock InfluxDB客户端
        with patch('influxdb.InfluxDBClient') as mock_client_class:
            mock_client = Mock()
            mock_client.write_points.return_value = True
            mock_client_class.return_value = mock_client
            
            # 导出指标
            result = await influxdb_exporter.export_metrics(sample_metrics)
            
            assert result is True
            mock_client.write_points.assert_called_once()
            
            # 验证写入的数据格式
            call_args = mock_client.write_points.call_args[0][0]
            assert isinstance(call_args, list)
            assert len(call_args) == len(sample_metrics)

    async def test_influxdb_timestamp_precision(self, influxdb_exporter):
        """测试InfluxDB时间戳精度"""
        metric = Metric(
            name='precision_test',
            type=MetricType.GAUGE,
            description='Precision test metric',
            labels={},
            value=MetricValue(value=1, timestamp=datetime.now(timezone.utc))
        )
        
        # 测试毫秒精度
        influxdb_exporter.config.format_options['precision'] = 'ms'
        ms_output = await influxdb_exporter.format_metrics([metric])
        
        # 验证时间戳格式（毫秒精度应该有13位数字）
        timestamp_part = ms_output.split(' ')[-1]
        assert len(timestamp_part) == 13
        
        # 测试秒精度
        influxdb_exporter.config.format_options['precision'] = 's'
        s_output = await influxdb_exporter.format_metrics([metric])
        
        # 验证时间戳格式（秒精度应该有10位数字）
        timestamp_part = s_output.split(' ')[-1]
        assert len(timestamp_part) == 10


class TestElasticsearchExporter:
    """Elasticsearch导出器测试类"""

    @pytest.fixture
    def elasticsearch_config(self):
        """创建Elasticsearch导出器配置"""
        return ExporterConfig(
            name='elasticsearch_exporter',
            enabled=True,
            export_interval=30,
            batch_size=500,
            timeout_seconds=60,
            retry_attempts=3,
            buffer_size=2000,
            compression_enabled=True,
            format_options={
                'index_pattern': 'metrics-{date}',
                'doc_type': '_doc',
                'timestamp_field': '@timestamp',
                'mapping_template': 'metrics_template'
            },
            destination_config={
                'hosts': ['localhost:9200'],
                'username': 'elastic',
                'password': 'password',
                'use_ssl': False,
                'verify_certs': False
            }
        )

    @pytest.fixture
    async def elasticsearch_exporter(self, elasticsearch_config):
        """创建Elasticsearch导出器实例"""
        exporter = ElasticsearchExporter(config=elasticsearch_config)
        await exporter.initialize()
        yield exporter
        await exporter.cleanup()

    async def test_format_elasticsearch_metrics(self, elasticsearch_exporter, sample_metrics):
        """测试格式化Elasticsearch指标"""
        # 格式化指标
        formatted_output = await elasticsearch_exporter.format_metrics(sample_metrics)
        
        assert formatted_output is not None
        assert isinstance(formatted_output, list)
        assert len(formatted_output) == len(sample_metrics)
        
        # 验证文档格式
        for doc in formatted_output:
            assert isinstance(doc, dict)
            assert '@timestamp' in doc
            assert 'metric_name' in doc
            assert 'metric_type' in doc
            assert 'value' in doc
            assert 'labels' in doc
        
        # 验证特定指标文档
        counter_doc = next((doc for doc in formatted_output if doc['metric_name'] == 'test_counter'), None)
        assert counter_doc is not None
        assert counter_doc['metric_type'] == 'counter'
        assert counter_doc['value'] == 42
        assert counter_doc['labels']['service'] == 'test'

    async def test_export_to_elasticsearch(self, elasticsearch_exporter, sample_metrics):
        """测试导出到Elasticsearch"""
        # Mock Elasticsearch客户端
        with patch('elasticsearch.AsyncElasticsearch') as mock_es_class:
            mock_es = Mock()
            mock_es.bulk = AsyncMock(return_value={'errors': False, 'items': []})
            mock_es_class.return_value = mock_es
            
            # 导出指标
            result = await elasticsearch_exporter.export_metrics(sample_metrics)
            
            assert result is True
            mock_es.bulk.assert_called_once()
            
            # 验证批量操作格式
            call_args = mock_es.bulk.call_args[1]['body']
            assert isinstance(call_args, list)
            # 每个指标应该有两行：索引操作和文档数据
            assert len(call_args) == len(sample_metrics) * 2

    async def test_elasticsearch_index_pattern(self, elasticsearch_exporter):
        """测试Elasticsearch索引模式"""
        metric = Metric(
            name='index_test',
            type=MetricType.GAUGE,
            description='Index test metric',
            labels={},
            value=MetricValue(value=1, timestamp=datetime.now(timezone.utc))
        )
        
        # 生成索引名称
        index_name = await elasticsearch_exporter.generate_index_name(metric.value.timestamp)
        
        # 验证索引名称格式
        assert index_name.startswith('metrics-')
        assert len(index_name.split('-')) >= 2  # metrics-YYYY-MM-DD格式

    async def test_elasticsearch_mapping_template(self, elasticsearch_exporter):
        """测试Elasticsearch映射模板"""
        # 获取映射模板
        mapping_template = await elasticsearch_exporter.get_mapping_template()
        
        assert mapping_template is not None
        assert isinstance(mapping_template, dict)
        assert 'mappings' in mapping_template
        
        # 验证字段映射
        mappings = mapping_template['mappings']
        properties = mappings.get('properties', {})
        
        assert '@timestamp' in properties
        assert 'metric_name' in properties
        assert 'value' in properties
        assert 'labels' in properties


class TestExporterIntegration:
    """导出器集成测试类"""

    @pytest.fixture
    async def all_exporters(self):
        """创建所有类型的导出器"""
        exporters = {}
        
        # Prometheus导出器
        prometheus_config = ExporterConfig(name='prometheus', enabled=True, export_interval=15)
        exporters['prometheus'] = PrometheusExporter(config=prometheus_config)
        
        # JSON导出器
        json_config = ExporterConfig(name='json', enabled=True, export_interval=20)
        exporters['json'] = JsonExporter(config=json_config)
        
        # CSV导出器
        csv_config = ExporterConfig(name='csv', enabled=True, export_interval=25)
        exporters['csv'] = CsvExporter(config=csv_config)
        
        # 初始化所有导出器
        for exporter in exporters.values():
            await exporter.initialize()
        
        yield exporters
        
        # 清理所有导出器
        for exporter in exporters.values():
            await exporter.cleanup()

    async def test_concurrent_export(self, all_exporters, sample_metrics):
        """测试并发导出"""
        # 并发启动所有导出器
        start_tasks = [exporter.start_export() for exporter in all_exporters.values()]
        await asyncio.gather(*start_tasks)
        
        # 验证所有导出器都在运行
        for exporter in all_exporters.values():
            assert exporter.is_running
        
        # 并发导出指标
        export_tasks = [exporter.export_metrics(sample_metrics) for exporter in all_exporters.values()]
        results = await asyncio.gather(*export_tasks, return_exceptions=True)
        
        # 验证导出结果
        for result in results:
            if not isinstance(result, Exception):
                assert result is True
        
        # 并发停止所有导出器
        stop_tasks = [exporter.stop_export() for exporter in all_exporters.values()]
        await asyncio.gather(*stop_tasks)

    async def test_exporter_failover(self, all_exporters, sample_metrics):
        """测试导出器故障转移"""
        primary_exporter = all_exporters['prometheus']
        fallback_exporter = all_exporters['json']
        
        # 模拟主导出器故障
        with patch.object(primary_exporter, 'export_metrics', side_effect=Exception('Export failed')):
            # 尝试使用主导出器
            try:
                await primary_exporter.export_metrics(sample_metrics)
                assert False, "Should have raised exception"
            except Exception:
                pass
            
            # 使用备用导出器
            result = await fallback_exporter.export_metrics(sample_metrics)
            assert result is True

    async def test_export_performance(self, all_exporters, sample_metrics):
        """测试导出性能"""
        import time
        
        # 创建大量指标数据
        large_metrics = sample_metrics * 100  # 300个指标
        
        for exporter_name, exporter in all_exporters.items():
            # 测量导出性能
            start_time = time.time()
            
            result = await exporter.export_metrics(large_metrics)
            
            end_time = time.time()
            export_time = end_time - start_time
            
            # 验证性能满足要求
            assert export_time < 5.0  # 导出时间应小于5秒
            assert result is True
            
            print(f"{exporter_name} exporter: {len(large_metrics)} metrics in {export_time:.2f}s")

    async def test_export_data_consistency(self, all_exporters, sample_metrics):
        """测试导出数据一致性"""
        # 所有导出器导出相同的指标
        export_results = {}
        
        for exporter_name, exporter in all_exporters.items():
            formatted_data = await exporter.format_metrics(sample_metrics)
            export_results[exporter_name] = formatted_data
        
        # 验证所有导出器都处理了相同数量的指标
        # 具体验证逻辑取决于各导出器的格式
        assert len(export_results) == len(all_exporters)
        
        # 验证关键指标在所有格式中都存在
        for exporter_name, data in export_results.items():
            if exporter_name == 'prometheus':
                assert 'test_counter' in data
            elif exporter_name == 'json':
                json_data = json.loads(data) if isinstance(data, str) else data
                metric_names = [m['name'] for m in json_data['metrics']]
                assert 'test_counter' in metric_names
            elif exporter_name == 'csv':
                assert 'test_counter' in data

    async def test_exporter_cleanup(self, all_exporters):
        """测试导出器清理"""
        # 启动所有导出器
        for exporter in all_exporters.values():
            await exporter.start_export()
            assert exporter.is_running
        
        # 清理所有导出器
        for exporter in all_exporters.values():
            await exporter.cleanup()
            assert not exporter.is_running
        
        # 验证资源已释放（具体行为取决于实现）

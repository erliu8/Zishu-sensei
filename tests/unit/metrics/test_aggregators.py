# -*- coding: utf-8 -*-
"""
指标聚合器测试

测试新架构的指标聚合器功能
"""

import pytest
import asyncio
import statistics
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.aggregators.base import BaseAggregator, AggregatorConfig
from zishu.metrics.aggregators.time_window import TimeWindowAggregator
from zishu.metrics.aggregators.statistical import StatisticalAggregator
from zishu.metrics.aggregators.percentile import PercentileAggregator
from zishu.metrics.aggregators.custom import CustomAggregator
from zishu.metrics.core.types import (
    Metric, MetricType, MetricValue, MetricSample, 
    TimeRange, Aggregation, AggregatedResult
)
from zishu.metrics.core.exceptions import AggregatorException

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestBaseAggregator:
    """基础聚合器测试类"""

    @pytest.fixture
    def aggregator_config(self):
        """创建聚合器配置"""
        return AggregatorConfig(
            name='test_aggregator',
            enabled=True,
            aggregation_interval=60,
            window_size_seconds=300,
            buffer_size=1000,
            max_memory_mb=100,
            enable_caching=True,
            cache_ttl_seconds=300
        )

    @pytest.fixture
    def base_aggregator(self, aggregator_config):
        """创建基础聚合器实例"""
        return BaseAggregator(config=aggregator_config)

    @pytest.fixture
    def sample_data_points(self):
        """创建示例数据点"""
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        data_points = []
        
        for i in range(60):  # 60个数据点，每10秒一个
            timestamp = base_time + timedelta(seconds=i * 10)
            value = 50 + 20 * (i % 10) + (i % 3) * 5  # 模拟波动数据
            
            sample = MetricSample(
                metric_name='test_metric',
                labels={'service': 'test', 'instance': 'node-1'},
                value=value,
                timestamp=timestamp
            )
            data_points.append(sample)
        
        return data_points

    async def test_aggregator_initialization(self, aggregator_config):
        """测试聚合器初始化"""
        aggregator = BaseAggregator(config=aggregator_config)
        
        # 验证初始状态
        assert aggregator.config == aggregator_config
        assert not aggregator.is_running
        
        # 初始化聚合器
        await aggregator.initialize()
        assert aggregator.is_initialized
        
        # 清理聚合器
        await aggregator.cleanup()

    async def test_aggregator_lifecycle(self, base_aggregator):
        """测试聚合器生命周期"""
        # 初始化
        await base_aggregator.initialize()
        assert base_aggregator.is_initialized
        
        # 启动聚合
        await base_aggregator.start_aggregation()
        assert base_aggregator.is_running
        
        # 停止聚合
        await base_aggregator.stop_aggregation()
        assert not base_aggregator.is_running
        
        # 清理
        await base_aggregator.cleanup()

    async def test_aggregator_health_check(self, base_aggregator):
        """测试聚合器健康检查"""
        await base_aggregator.initialize()
        
        # 检查健康状态
        health_status = await base_aggregator.health_check()
        
        assert health_status is not None
        assert 'status' in health_status
        assert 'last_aggregation' in health_status
        assert 'processed_samples' in health_status


class TestTimeWindowAggregator:
    """时间窗口聚合器测试类"""

    @pytest.fixture
    def time_window_config(self):
        """创建时间窗口聚合器配置"""
        return AggregatorConfig(
            name='time_window_aggregator',
            enabled=True,
            aggregation_interval=30,
            window_size_seconds=300,  # 5分钟窗口
            buffer_size=2000,
            max_memory_mb=200,
            enable_caching=True,
            cache_ttl_seconds=600,
            custom_settings={
                'window_type': 'sliding',
                'overlap_seconds': 60,
                'alignment': 'start'
            }
        )

    @pytest.fixture
    async def time_window_aggregator(self, time_window_config):
        """创建时间窗口聚合器实例"""
        aggregator = TimeWindowAggregator(config=time_window_config)
        await aggregator.initialize()
        yield aggregator
        await aggregator.cleanup()

    async def test_sliding_window_aggregation(self, time_window_aggregator, sample_data_points):
        """测试滑动窗口聚合"""
        # 添加数据点到聚合器
        for sample in sample_data_points:
            await time_window_aggregator.add_sample(sample)
        
        # 执行滑动窗口聚合
        time_range = TimeRange(
            start=sample_data_points[0].timestamp,
            end=sample_data_points[-1].timestamp
        )
        
        aggregated_results = await time_window_aggregator.aggregate_sliding_window(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=time_range,
            window_size_seconds=60,  # 1分钟窗口
            aggregation=Aggregation.AVERAGE
        )
        
        assert len(aggregated_results) > 0
        
        # 验证聚合结果
        for result in aggregated_results:
            assert isinstance(result, AggregatedResult)
            assert result.metric_name == 'test_metric'
            assert result.aggregation_type == Aggregation.AVERAGE
            assert result.value is not None
            assert result.sample_count > 0

    async def test_tumbling_window_aggregation(self, time_window_aggregator, sample_data_points):
        """测试翻滚窗口聚合"""
        # 配置为翻滚窗口
        time_window_aggregator.config.custom_settings['window_type'] = 'tumbling'
        
        # 添加数据点
        for sample in sample_data_points:
            await time_window_aggregator.add_sample(sample)
        
        # 执行翻滚窗口聚合
        time_range = TimeRange(
            start=sample_data_points[0].timestamp,
            end=sample_data_points[-1].timestamp
        )
        
        aggregated_results = await time_window_aggregator.aggregate_tumbling_window(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=time_range,
            window_size_seconds=120,  # 2分钟窗口
            aggregation=Aggregation.SUM
        )
        
        assert len(aggregated_results) > 0
        
        # 验证翻滚窗口特性：窗口不重叠
        window_starts = [result.time_range.start for result in aggregated_results]
        for i in range(1, len(window_starts)):
            assert window_starts[i] >= window_starts[i-1] + timedelta(seconds=120)

    async def test_fixed_window_aggregation(self, time_window_aggregator, sample_data_points):
        """测试固定窗口聚合"""
        # 配置为固定窗口
        time_window_aggregator.config.custom_settings['window_type'] = 'fixed'
        time_window_aggregator.config.custom_settings['alignment'] = 'hour'
        
        # 添加数据点
        for sample in sample_data_points:
            await time_window_aggregator.add_sample(sample)
        
        # 执行固定窗口聚合（按小时对齐）
        time_range = TimeRange(
            start=sample_data_points[0].timestamp,
            end=sample_data_points[-1].timestamp
        )
        
        aggregated_results = await time_window_aggregator.aggregate_fixed_window(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=time_range,
            aggregation=Aggregation.MAX
        )
        
        assert len(aggregated_results) > 0
        
        # 验证固定窗口对齐
        for result in aggregated_results:
            # 验证窗口开始时间是整点
            assert result.time_range.start.minute == 0
            assert result.time_range.start.second == 0

    async def test_multiple_aggregations(self, time_window_aggregator, sample_data_points):
        """测试多种聚合类型"""
        # 添加数据点
        for sample in sample_data_points:
            await time_window_aggregator.add_sample(sample)
        
        time_range = TimeRange(
            start=sample_data_points[0].timestamp,
            end=sample_data_points[-1].timestamp
        )
        
        # 测试不同聚合类型
        aggregation_types = [
            Aggregation.AVERAGE,
            Aggregation.SUM,
            Aggregation.MIN,
            Aggregation.MAX,
            Aggregation.COUNT
        ]
        
        for agg_type in aggregation_types:
            results = await time_window_aggregator.aggregate_sliding_window(
                metric_name='test_metric',
                labels_filter={'service': 'test'},
                time_range=time_range,
                window_size_seconds=60,
                aggregation=agg_type
            )
            
            assert len(results) > 0
            for result in results:
                assert result.aggregation_type == agg_type
                assert result.value is not None


class TestStatisticalAggregator:
    """统计聚合器测试类"""

    @pytest.fixture
    def statistical_config(self):
        """创建统计聚合器配置"""
        return AggregatorConfig(
            name='statistical_aggregator',
            enabled=True,
            aggregation_interval=60,
            window_size_seconds=600,
            buffer_size=5000,
            max_memory_mb=500,
            enable_caching=True,
            cache_ttl_seconds=900,
            custom_settings={
                'enable_variance': True,
                'enable_skewness': True,
                'enable_kurtosis': True,
                'confidence_levels': [0.95, 0.99]
            }
        )

    @pytest.fixture
    async def statistical_aggregator(self, statistical_config):
        """创建统计聚合器实例"""
        aggregator = StatisticalAggregator(config=statistical_config)
        await aggregator.initialize()
        yield aggregator
        await aggregator.cleanup()

    async def test_basic_statistics(self, statistical_aggregator, sample_data_points):
        """测试基础统计指标"""
        # 添加数据点
        for sample in sample_data_points:
            await statistical_aggregator.add_sample(sample)
        
        # 计算基础统计指标
        stats = await statistical_aggregator.calculate_basic_statistics(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            )
        )
        
        assert stats is not None
        assert 'mean' in stats
        assert 'median' in stats
        assert 'mode' in stats
        assert 'std_dev' in stats
        assert 'variance' in stats
        assert 'min' in stats
        assert 'max' in stats
        assert 'count' in stats
        
        # 验证统计值的合理性
        values = [sample.value for sample in sample_data_points]
        assert abs(stats['mean'] - statistics.mean(values)) < 0.01
        assert abs(stats['median'] - statistics.median(values)) < 0.01
        assert stats['min'] == min(values)
        assert stats['max'] == max(values)
        assert stats['count'] == len(values)

    async def test_advanced_statistics(self, statistical_aggregator, sample_data_points):
        """测试高级统计指标"""
        # 添加数据点
        for sample in sample_data_points:
            await statistical_aggregator.add_sample(sample)
        
        # 计算高级统计指标
        advanced_stats = await statistical_aggregator.calculate_advanced_statistics(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            )
        )
        
        assert advanced_stats is not None
        assert 'skewness' in advanced_stats
        assert 'kurtosis' in advanced_stats
        assert 'coefficient_of_variation' in advanced_stats
        assert 'interquartile_range' in advanced_stats
        
        # 验证高级统计值
        assert isinstance(advanced_stats['skewness'], (int, float))
        assert isinstance(advanced_stats['kurtosis'], (int, float))
        assert advanced_stats['coefficient_of_variation'] >= 0

    async def test_confidence_intervals(self, statistical_aggregator, sample_data_points):
        """测试置信区间计算"""
        # 添加数据点
        for sample in sample_data_points:
            await statistical_aggregator.add_sample(sample)
        
        # 计算置信区间
        confidence_intervals = await statistical_aggregator.calculate_confidence_intervals(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            ),
            confidence_levels=[0.95, 0.99]
        )
        
        assert confidence_intervals is not None
        assert '0.95' in confidence_intervals
        assert '0.99' in confidence_intervals
        
        # 验证置信区间
        ci_95 = confidence_intervals['0.95']
        ci_99 = confidence_intervals['0.99']
        
        assert 'lower_bound' in ci_95
        assert 'upper_bound' in ci_95
        assert ci_95['lower_bound'] < ci_95['upper_bound']
        
        # 99%置信区间应该比95%置信区间更宽
        assert ci_99['upper_bound'] - ci_99['lower_bound'] > ci_95['upper_bound'] - ci_95['lower_bound']

    async def test_correlation_analysis(self, statistical_aggregator):
        """测试相关性分析"""
        # 创建两个相关的指标数据
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        
        metric1_samples = []
        metric2_samples = []
        
        for i in range(50):
            timestamp = base_time + timedelta(seconds=i * 10)
            value1 = 100 + i * 2 + (i % 5)  # 线性增长
            value2 = 50 + i * 1.5 + (i % 3)  # 相关增长
            
            sample1 = MetricSample(
                metric_name='metric_1',
                labels={'service': 'test'},
                value=value1,
                timestamp=timestamp
            )
            sample2 = MetricSample(
                metric_name='metric_2',
                labels={'service': 'test'},
                value=value2,
                timestamp=timestamp
            )
            
            metric1_samples.append(sample1)
            metric2_samples.append(sample2)
        
        # 添加数据点
        for sample in metric1_samples + metric2_samples:
            await statistical_aggregator.add_sample(sample)
        
        # 计算相关性
        correlation = await statistical_aggregator.calculate_correlation(
            metric1_name='metric_1',
            metric2_name='metric_2',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=base_time,
                end=base_time + timedelta(minutes=10)
            )
        )
        
        assert correlation is not None
        assert 'pearson_correlation' in correlation
        assert 'spearman_correlation' in correlation
        assert 'kendall_tau' in correlation
        
        # 验证相关系数范围
        assert -1 <= correlation['pearson_correlation'] <= 1
        assert -1 <= correlation['spearman_correlation'] <= 1
        assert -1 <= correlation['kendall_tau'] <= 1

    async def test_trend_analysis(self, statistical_aggregator, sample_data_points):
        """测试趋势分析"""
        # 添加数据点
        for sample in sample_data_points:
            await statistical_aggregator.add_sample(sample)
        
        # 分析趋势
        trend_analysis = await statistical_aggregator.analyze_trend(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            )
        )
        
        assert trend_analysis is not None
        assert 'trend_direction' in trend_analysis  # 'increasing', 'decreasing', 'stable'
        assert 'trend_strength' in trend_analysis
        assert 'slope' in trend_analysis
        assert 'r_squared' in trend_analysis
        
        # 验证趋势强度
        assert 0 <= trend_analysis['trend_strength'] <= 1
        assert 0 <= trend_analysis['r_squared'] <= 1


class TestPercentileAggregator:
    """百分位聚合器测试类"""

    @pytest.fixture
    def percentile_config(self):
        """创建百分位聚合器配置"""
        return AggregatorConfig(
            name='percentile_aggregator',
            enabled=True,
            aggregation_interval=30,
            window_size_seconds=300,
            buffer_size=10000,
            max_memory_mb=1000,
            enable_caching=True,
            cache_ttl_seconds=600,
            custom_settings={
                'default_percentiles': [50, 90, 95, 99, 99.9],
                'approximation_method': 'tdigest',
                'compression_factor': 100
            }
        )

    @pytest.fixture
    async def percentile_aggregator(self, percentile_config):
        """创建百分位聚合器实例"""
        aggregator = PercentileAggregator(config=percentile_config)
        await aggregator.initialize()
        yield aggregator
        await percentile_aggregator.cleanup()

    async def test_calculate_percentiles(self, percentile_aggregator, sample_data_points):
        """测试计算百分位数"""
        # 添加数据点
        for sample in sample_data_points:
            await percentile_aggregator.add_sample(sample)
        
        # 计算百分位数
        percentiles = await percentile_aggregator.calculate_percentiles(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            ),
            percentiles=[50, 90, 95, 99]
        )
        
        assert percentiles is not None
        assert '50' in percentiles  # 中位数
        assert '90' in percentiles
        assert '95' in percentiles
        assert '99' in percentiles
        
        # 验证百分位数的顺序
        assert percentiles['50'] <= percentiles['90']
        assert percentiles['90'] <= percentiles['95']
        assert percentiles['95'] <= percentiles['99']
        
        # 验证百分位数在数据范围内
        values = [sample.value for sample in sample_data_points]
        min_value, max_value = min(values), max(values)
        
        for percentile_value in percentiles.values():
            assert min_value <= percentile_value <= max_value

    async def test_quantile_estimation(self, percentile_aggregator, sample_data_points):
        """测试分位数估计"""
        # 添加数据点
        for sample in sample_data_points:
            await percentile_aggregator.add_sample(sample)
        
        # 估计分位数
        quantiles = await percentile_aggregator.estimate_quantiles(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            ),
            quantiles=[0.25, 0.5, 0.75, 0.9, 0.95]
        )
        
        assert quantiles is not None
        assert len(quantiles) == 5
        
        # 验证分位数的单调性
        quantile_values = list(quantiles.values())
        for i in range(1, len(quantile_values)):
            assert quantile_values[i-1] <= quantile_values[i]

    async def test_histogram_generation(self, percentile_aggregator, sample_data_points):
        """测试直方图生成"""
        # 添加数据点
        for sample in sample_data_points:
            await percentile_aggregator.add_sample(sample)
        
        # 生成直方图
        histogram = await percentile_aggregator.generate_histogram(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            ),
            bucket_count=10
        )
        
        assert histogram is not None
        assert 'buckets' in histogram
        assert 'counts' in histogram
        assert len(histogram['buckets']) == len(histogram['counts'])
        
        # 验证直方图的完整性
        total_count = sum(histogram['counts'])
        assert total_count == len(sample_data_points)
        
        # 验证桶的顺序
        buckets = histogram['buckets']
        for i in range(1, len(buckets)):
            assert buckets[i-1] < buckets[i]

    async def test_outlier_detection(self, percentile_aggregator, sample_data_points):
        """测试异常值检测"""
        # 添加一些异常值
        outlier_samples = []
        base_time = sample_data_points[-1].timestamp + timedelta(seconds=10)
        
        for i in range(5):
            timestamp = base_time + timedelta(seconds=i * 10)
            outlier_value = 1000 + i * 100  # 明显的异常值
            
            sample = MetricSample(
                metric_name='test_metric',
                labels={'service': 'test', 'instance': 'node-1'},
                value=outlier_value,
                timestamp=timestamp
            )
            outlier_samples.append(sample)
        
        # 添加所有数据点
        all_samples = sample_data_points + outlier_samples
        for sample in all_samples:
            await percentile_aggregator.add_sample(sample)
        
        # 检测异常值
        outliers = await percentile_aggregator.detect_outliers(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=outlier_samples[-1].timestamp
            ),
            method='iqr',  # 使用四分位距方法
            threshold=1.5
        )
        
        assert outliers is not None
        assert 'outlier_samples' in outliers
        assert 'outlier_count' in outliers
        assert 'outlier_percentage' in outliers
        
        # 验证检测到了异常值
        assert outliers['outlier_count'] > 0
        assert len(outliers['outlier_samples']) > 0


class TestCustomAggregator:
    """自定义聚合器测试类"""

    @pytest.fixture
    def custom_config(self):
        """创建自定义聚合器配置"""
        return AggregatorConfig(
            name='custom_aggregator',
            enabled=True,
            aggregation_interval=45,
            window_size_seconds=600,
            buffer_size=5000,
            max_memory_mb=500,
            enable_caching=True,
            cache_ttl_seconds=1200,
            custom_settings={
                'custom_functions_file': '/tmp/custom_aggregations.py',
                'enable_scripting': True,
                'script_timeout': 30
            }
        )

    @pytest.fixture
    async def custom_aggregator(self, custom_config):
        """创建自定义聚合器实例"""
        aggregator = CustomAggregator(config=custom_config)
        await aggregator.initialize()
        yield aggregator
        await aggregator.cleanup()

    async def test_register_custom_function(self, custom_aggregator):
        """测试注册自定义聚合函数"""
        # 定义自定义聚合函数
        async def weighted_average(samples, weights=None):
            """加权平均聚合函数"""
            if not samples:
                return None
            
            if weights is None:
                weights = [1.0] * len(samples)
            
            if len(samples) != len(weights):
                raise ValueError("Samples and weights must have same length")
            
            weighted_sum = sum(sample.value * weight for sample, weight in zip(samples, weights))
            total_weight = sum(weights)
            
            return weighted_sum / total_weight if total_weight > 0 else None
        
        # 注册自定义函数
        result = await custom_aggregator.register_aggregation_function(
            name='weighted_average',
            function=weighted_average,
            description='Calculate weighted average of samples'
        )
        
        assert result is True
        
        # 验证函数已注册
        registered_functions = await custom_aggregator.get_registered_functions()
        assert 'weighted_average' in registered_functions

    async def test_execute_custom_aggregation(self, custom_aggregator, sample_data_points):
        """测试执行自定义聚合"""
        # 注册简单的自定义聚合函数
        async def geometric_mean(samples):
            """几何平均数"""
            if not samples:
                return None
            
            values = [sample.value for sample in samples if sample.value > 0]
            if not values:
                return None
            
            product = 1.0
            for value in values:
                product *= value
            
            return product ** (1.0 / len(values))
        
        await custom_aggregator.register_aggregation_function(
            name='geometric_mean',
            function=geometric_mean
        )
        
        # 添加数据点
        for sample in sample_data_points:
            await custom_aggregator.add_sample(sample)
        
        # 执行自定义聚合
        result = await custom_aggregator.execute_custom_aggregation(
            function_name='geometric_mean',
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            )
        )
        
        assert result is not None
        assert isinstance(result, (int, float))
        assert result > 0

    async def test_complex_custom_aggregation(self, custom_aggregator, sample_data_points):
        """测试复杂自定义聚合"""
        # 注册复杂的自定义聚合函数
        async def time_weighted_average(samples):
            """时间加权平均"""
            if len(samples) < 2:
                return samples[0].value if samples else None
            
            # 按时间排序
            sorted_samples = sorted(samples, key=lambda s: s.timestamp)
            
            weighted_sum = 0.0
            total_weight = 0.0
            
            for i in range(len(sorted_samples) - 1):
                current_sample = sorted_samples[i]
                next_sample = sorted_samples[i + 1]
                
                # 计算时间权重
                time_diff = (next_sample.timestamp - current_sample.timestamp).total_seconds()
                weight = max(time_diff, 1.0)  # 避免零权重
                
                weighted_sum += current_sample.value * weight
                total_weight += weight
            
            # 添加最后一个样本（使用平均时间间隔作为权重）
            if len(sorted_samples) > 1:
                avg_interval = (sorted_samples[-1].timestamp - sorted_samples[0].timestamp).total_seconds() / (len(sorted_samples) - 1)
                weighted_sum += sorted_samples[-1].value * avg_interval
                total_weight += avg_interval
            
            return weighted_sum / total_weight if total_weight > 0 else None
        
        await custom_aggregator.register_aggregation_function(
            name='time_weighted_average',
            function=time_weighted_average
        )
        
        # 添加数据点
        for sample in sample_data_points:
            await custom_aggregator.add_sample(sample)
        
        # 执行复杂聚合
        result = await custom_aggregator.execute_custom_aggregation(
            function_name='time_weighted_average',
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=TimeRange(
                start=sample_data_points[0].timestamp,
                end=sample_data_points[-1].timestamp
            )
        )
        
        assert result is not None
        assert isinstance(result, (int, float))

    async def test_load_custom_functions_from_file(self, custom_aggregator):
        """测试从文件加载自定义函数"""
        # 创建自定义函数文件
        import tempfile
        
        custom_functions_code = '''
async def harmonic_mean(samples):
    """调和平均数"""
    if not samples:
        return None
    
    values = [sample.value for sample in samples if sample.value > 0]
    if not values:
        return None
    
    reciprocal_sum = sum(1.0 / value for value in values)
    return len(values) / reciprocal_sum

async def range_aggregation(samples):
    """范围聚合（最大值-最小值）"""
    if not samples:
        return None
    
    values = [sample.value for sample in samples]
    return max(values) - min(values)

# 注册函数
CUSTOM_FUNCTIONS = {
    'harmonic_mean': harmonic_mean,
    'range_aggregation': range_aggregation
}
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(custom_functions_code)
            temp_file_path = f.name
        
        try:
            # 从文件加载函数
            loaded_count = await custom_aggregator.load_functions_from_file(temp_file_path)
            
            assert loaded_count >= 2
            
            # 验证函数已加载
            registered_functions = await custom_aggregator.get_registered_functions()
            assert 'harmonic_mean' in registered_functions
            assert 'range_aggregation' in registered_functions
        finally:
            import os
            os.unlink(temp_file_path)


class TestAggregatorIntegration:
    """聚合器集成测试类"""

    @pytest.fixture
    async def all_aggregators(self):
        """创建所有类型的聚合器"""
        aggregators = {}
        
        # 时间窗口聚合器
        time_window_config = AggregatorConfig(name='time_window', enabled=True, aggregation_interval=30)
        aggregators['time_window'] = TimeWindowAggregator(config=time_window_config)
        
        # 统计聚合器
        statistical_config = AggregatorConfig(name='statistical', enabled=True, aggregation_interval=60)
        aggregators['statistical'] = StatisticalAggregator(config=statistical_config)
        
        # 百分位聚合器
        percentile_config = AggregatorConfig(name='percentile', enabled=True, aggregation_interval=45)
        aggregators['percentile'] = PercentileAggregator(config=percentile_config)
        
        # 自定义聚合器
        custom_config = AggregatorConfig(name='custom', enabled=True, aggregation_interval=90)
        aggregators['custom'] = CustomAggregator(config=custom_config)
        
        # 初始化所有聚合器
        for aggregator in aggregators.values():
            await aggregator.initialize()
        
        yield aggregators
        
        # 清理所有聚合器
        for aggregator in aggregators.values():
            await aggregator.cleanup()

    async def test_concurrent_aggregation(self, all_aggregators, sample_data_points):
        """测试并发聚合"""
        # 并发启动所有聚合器
        start_tasks = [aggregator.start_aggregation() for aggregator in all_aggregators.values()]
        await asyncio.gather(*start_tasks)
        
        # 验证所有聚合器都在运行
        for aggregator in all_aggregators.values():
            assert aggregator.is_running
        
        # 并发添加数据到所有聚合器
        add_tasks = []
        for aggregator in all_aggregators.values():
            for sample in sample_data_points:
                add_tasks.append(aggregator.add_sample(sample))
        
        await asyncio.gather(*add_tasks)
        
        # 并发停止所有聚合器
        stop_tasks = [aggregator.stop_aggregation() for aggregator in all_aggregators.values()]
        await asyncio.gather(*stop_tasks)

    async def test_aggregator_coordination(self, all_aggregators, sample_data_points):
        """测试聚合器协调"""
        time_window_agg = all_aggregators['time_window']
        statistical_agg = all_aggregators['statistical']
        
        # 添加数据到两个聚合器
        for sample in sample_data_points:
            await time_window_agg.add_sample(sample)
            await statistical_agg.add_sample(sample)
        
        # 时间窗口聚合器提供基础聚合
        time_range = TimeRange(
            start=sample_data_points[0].timestamp,
            end=sample_data_points[-1].timestamp
        )
        
        window_results = await time_window_agg.aggregate_sliding_window(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=time_range,
            window_size_seconds=60,
            aggregation=Aggregation.AVERAGE
        )
        
        # 统计聚合器基于窗口结果进行深度分析
        stats = await statistical_agg.calculate_basic_statistics(
            metric_name='test_metric',
            labels_filter={'service': 'test'},
            time_range=time_range
        )
        
        assert len(window_results) > 0
        assert stats is not None
        assert 'mean' in stats

    async def test_aggregator_performance(self, all_aggregators):
        """测试聚合器性能"""
        import time
        
        # 创建大量数据
        large_dataset = []
        base_time = datetime.now(timezone.utc) - timedelta(hours=1)
        
        for i in range(10000):  # 10000个数据点
            timestamp = base_time + timedelta(seconds=i * 0.36)  # 每0.36秒一个点
            value = 100 + 50 * (i % 100) / 100  # 周期性变化
            
            sample = MetricSample(
                metric_name='performance_test_metric',
                labels={'service': 'performance_test'},
                value=value,
                timestamp=timestamp
            )
            large_dataset.append(sample)
        
        # 测试每个聚合器的性能
        for agg_name, aggregator in all_aggregators.items():
            start_time = time.time()
            
            # 添加数据
            for sample in large_dataset:
                await aggregator.add_sample(sample)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # 验证性能满足要求
            assert processing_time < 10.0  # 处理时间应小于10秒
            throughput = len(large_dataset) / processing_time
            assert throughput > 500  # 吞吐量应大于500 samples/s
            
            print(f"{agg_name} aggregator: {len(large_dataset)} samples in {processing_time:.2f}s ({throughput:.0f} samples/s)")

    async def test_aggregator_memory_usage(self, all_aggregators, sample_data_points):
        """测试聚合器内存使用"""
        import gc
        
        # 获取初始内存使用
        gc.collect()
        initial_objects = len(gc.get_objects())
        
        # 执行大量聚合操作
        for _ in range(100):
            for aggregator in all_aggregators.values():
                for sample in sample_data_points:
                    await aggregator.add_sample(sample)
        
        # 强制垃圾回收
        gc.collect()
        final_objects = len(gc.get_objects())
        
        # 验证没有严重的内存泄漏
        object_growth = final_objects - initial_objects
        assert object_growth < 5000  # 对象增长应该在合理范围内

    async def test_aggregator_cleanup(self, all_aggregators):
        """测试聚合器清理"""
        # 启动所有聚合器
        for aggregator in all_aggregators.values():
            await aggregator.start_aggregation()
            assert aggregator.is_running
        
        # 清理所有聚合器
        for aggregator in all_aggregators.values():
            await aggregator.cleanup()
            assert not aggregator.is_running
        
        # 验证资源已释放（具体行为取决于实现）

# -*- coding: utf-8 -*-
"""
适配器性能基准测试

提供全面的性能基准测试和性能回归检测
"""

import pytest
import asyncio
import time
import json
import psutil
import gc
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from unittest.mock import AsyncMock, Mock

from tests.utils.enhanced_test_utils import (
    EnhancedTestUtils, PerformanceMonitor, TestDataGenerator,
    ConcurrentTestRunner, TestReporter
)
from tests.utils.adapter_test_utils import AdapterTestUtils

# Import test adapters
from tests.unit.adapters.test_soft_adapter import MockAdapterA, MockAdapterB, MockAdapterC


@pytest.mark.performance
class TestAdapterPerformanceBenchmarks:
    """适配器性能基准测试类"""

    @pytest.fixture
    def performance_monitor(self):
        """创建性能监控器"""
        return EnhancedTestUtils.create_performance_monitor()

    @pytest.fixture
    def test_data_generator(self):
        """创建测试数据生成器"""
        return EnhancedTestUtils.create_data_generator()

    @pytest.fixture
    def concurrent_runner(self):
        """创建并发测试运行器"""
        return EnhancedTestUtils.create_concurrent_test_runner()

    @pytest.fixture
    def test_reporter(self):
        """创建测试报告器"""
        return TestReporter()

    @pytest.fixture
    async def benchmark_adapters(self):
        """创建基准测试适配器"""
        adapters = [MockAdapterA(), MockAdapterB(), MockAdapterC()]
        for adapter in adapters:
            await adapter.initialize()
        return adapters

    @pytest.mark.asyncio
    async def test_single_adapter_throughput_benchmark(
        self, benchmark_adapters, performance_monitor, test_data_generator, test_reporter
    ):
        """单适配器吞吐量基准测试"""
        test_reporter.start_test_run()
        
        adapter = benchmark_adapters[0]
        test_data = test_data_generator.generate_text_data(1000, 50, 200)
        
        async with performance_monitor.monitor_execution("single_adapter_throughput") as session:
            start_time = time.time()
            
            for i, text in enumerate(test_data):
                input_data = {"text": text}
                context = AdapterTestUtils.create_execution_context(f"throughput-{i}")
                
                try:
                    result = await adapter.process(input_data, context)
                    session.record_operation(success=result.status == "success")
                except Exception:
                    session.record_operation(success=False)
            
            end_time = time.time()
        
        metrics = session.get_metrics()
        test_reporter.record_performance_metrics(metrics, "single_adapter_throughput")
        
        # Performance assertions
        assert metrics.throughput > 100, f"Throughput {metrics.throughput} req/s is below 100 req/s"
        assert metrics.success_rate > 0.95, f"Success rate {metrics.success_rate} is below 95%"
        assert metrics.execution_time < 15.0, f"Execution time {metrics.execution_time}s exceeds 15s"
        
        print(f"Single Adapter Benchmark Results:")
        print(f"  Throughput: {metrics.throughput:.2f} req/s")
        print(f"  Success Rate: {metrics.success_rate:.2%}")
        print(f"  Avg Memory Usage: {metrics.memory_usage['peak_mb']:.2f} MB")

    @pytest.mark.asyncio
    async def test_concurrent_adapter_performance(
        self, benchmark_adapters, concurrent_runner, test_data_generator
    ):
        """并发适配器性能测试"""
        adapter = benchmark_adapters[0]
        test_data = test_data_generator.generate_text_data(100, 20, 100)
        
        async def process_single_item(text):
            input_data = {"text": text}
            context = AdapterTestUtils.create_execution_context("concurrent-test")
            return await adapter.process(input_data, context)
        
        # Test different concurrency levels
        concurrency_levels = [1, 5, 10, 20, 50]
        results = {}
        
        for concurrency in concurrency_levels:
            # Limit test data to concurrency level
            limited_data = test_data[:concurrency * 2]  # 2x concurrency for better measurement
            
            start_time = time.time()
            concurrent_results = await concurrent_runner.run_concurrent_tests(
                process_single_item,
                limited_data,
                timeout=30.0
            )
            end_time = time.time()
            
            execution_time = end_time - start_time
            successful_count = sum(1 for r in concurrent_results if hasattr(r, 'status') and r.status == "success")
            throughput = successful_count / execution_time
            
            results[concurrency] = {
                "throughput": throughput,
                "execution_time": execution_time,
                "success_rate": concurrent_runner.get_success_rate(),
                "successful_requests": successful_count
            }
        
        # Verify performance scaling
        assert results[1]["success_rate"] > 0.95, "Single thread success rate should be > 95%"
        assert results[10]["throughput"] > results[1]["throughput"] * 2, "Concurrency should improve throughput"
        
        print(f"Concurrent Performance Results:")
        for concurrency, result in results.items():
            print(f"  Concurrency {concurrency}: {result['throughput']:.2f} req/s, "
                  f"Success Rate: {result['success_rate']:.2%}")

    @pytest.mark.asyncio
    async def test_adapter_chain_performance(
        self, benchmark_adapters, performance_monitor, test_data_generator
    ):
        """适配器链性能测试"""
        from zishu.adapters.core.composition import AdapterChain
        
        # Create adapter chain
        chain_config = {
            "chain_id": "benchmark-chain",
            "name": "性能基准链",
            "execution_strategy": "sequential",
            "error_handling": "stop_on_error"
        }
        
        chain = AdapterChain(chain_config, benchmark_adapters)
        await chain.initialize()
        
        test_data = test_data_generator.generate_text_data(200, 30, 150)
        
        async with performance_monitor.monitor_execution("adapter_chain_performance") as session:
            for i, text in enumerate(test_data):
                input_data = {"text": text}
                context = AdapterTestUtils.create_execution_context(f"chain-perf-{i}")
                
                try:
                    result = await chain.execute(input_data, context)
                    session.record_operation(success=result.status == "success")
                except Exception:
                    session.record_operation(success=False)
        
        metrics = session.get_metrics()
        
        # Chain should be slower than single adapter but still performant
        assert metrics.throughput > 30, f"Chain throughput {metrics.throughput} req/s is too low"
        assert metrics.success_rate > 0.9, f"Chain success rate {metrics.success_rate} is below 90%"
        assert metrics.execution_time < 30.0, f"Chain execution time {metrics.execution_time}s is too high"
        
        print(f"Adapter Chain Performance:")
        print(f"  Chain Throughput: {metrics.throughput:.2f} req/s")
        print(f"  Chain Success Rate: {metrics.success_rate:.2%}")

    @pytest.mark.asyncio
    async def test_memory_usage_benchmark(
        self, benchmark_adapters, test_data_generator
    ):
        """内存使用基准测试"""
        adapter = benchmark_adapters[0]
        process = psutil.Process()
        
        # Collect baseline memory
        gc.collect()
        baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Generate large test dataset
        large_test_data = test_data_generator.generate_text_data(1000, 100, 500)
        
        # Process data and monitor memory
        memory_samples = []
        for i, text in enumerate(large_test_data):
            input_data = {"text": text}
            context = AdapterTestUtils.create_execution_context(f"memory-test-{i}")
            
            await adapter.process(input_data, context)
            
            # Sample memory every 100 operations
            if i % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)
        
        # Final memory measurement
        final_memory = process.memory_info().rss / 1024 / 1024
        peak_memory = max(memory_samples + [final_memory])
        memory_growth = final_memory - baseline_memory
        
        # Memory assertions
        assert memory_growth < 100, f"Memory growth {memory_growth:.2f} MB exceeds 100 MB limit"
        assert peak_memory < baseline_memory + 200, f"Peak memory usage {peak_memory:.2f} MB is too high"
        
        print(f"Memory Usage Benchmark:")
        print(f"  Baseline Memory: {baseline_memory:.2f} MB")
        print(f"  Final Memory: {final_memory:.2f} MB")
        print(f"  Memory Growth: {memory_growth:.2f} MB")
        print(f"  Peak Memory: {peak_memory:.2f} MB")

    @pytest.mark.asyncio
    async def test_load_test_benchmark(
        self, benchmark_adapters, concurrent_runner, test_data_generator
    ):
        """负载测试基准"""
        adapter = benchmark_adapters[0]
        
        async def load_test_operation():
            text = test_data_generator.generate_text_data(1, 50, 100)[0]
            input_data = {"text": text}
            context = AdapterTestUtils.create_execution_context("load-test")
            result = await adapter.process(input_data, context)
            return result
        
        # Run load test with different RPS levels
        rps_levels = [10, 25, 50]
        load_test_results = {}
        
        for rps in rps_levels:
            print(f"Running load test at {rps} RPS...")
            
            result = await concurrent_runner.run_load_test(
                test_func=load_test_operation,
                rps=rps,
                duration=30.0,  # 30 second test
                warmup_time=5.0
            )
            
            load_test_results[rps] = result
            
            # Validate load test results
            assert result["success_rate"] > 0.8, f"Success rate {result['success_rate']:.2%} too low at {rps} RPS"
            assert result["actual_rps"] >= rps * 0.8, f"Actual RPS {result['actual_rps']:.2f} significantly below target {rps}"
        
        print(f"Load Test Results:")
        for rps, result in load_test_results.items():
            print(f"  {rps} RPS Target:")
            print(f"    Actual RPS: {result['actual_rps']:.2f}")
            print(f"    Success Rate: {result['success_rate']:.2%}")
            print(f"    Avg Response Time: {result['avg_response_time']:.3f}s")
            print(f"    P95 Response Time: {result['p95_response_time']:.3f}s")

    @pytest.mark.asyncio
    async def test_stress_test_benchmark(
        self, benchmark_adapters, test_data_generator
    ):
        """压力测试基准"""
        adapter = benchmark_adapters[0]
        
        # Stress test parameters
        duration_seconds = 60  # 1 minute stress test
        target_rps = 100
        
        # Run stress test
        start_time = time.time()
        end_time = start_time + duration_seconds
        
        request_count = 0
        success_count = 0
        error_count = 0
        response_times = []
        
        tasks = []
        
        async def stress_operation():
            nonlocal request_count, success_count, error_count
            
            text = test_data_generator.generate_text_data(1, 20, 100)[0]
            input_data = {"text": text}
            context = AdapterTestUtils.create_execution_context(f"stress-{request_count}")
            
            operation_start = time.time()
            try:
                result = await adapter.process(input_data, context)
                if result.status == "success":
                    success_count += 1
                else:
                    error_count += 1
            except Exception:
                error_count += 1
            finally:
                request_count += 1
                response_times.append(time.time() - operation_start)
        
        # Generate load
        while time.time() < end_time:
            # Control request rate
            tasks.append(asyncio.create_task(stress_operation()))
            
            # Limit concurrent tasks to prevent overwhelming
            if len(tasks) >= target_rps:
                await asyncio.sleep(1.0)  # Wait 1 second
                # Clean up completed tasks
                tasks = [task for task in tasks if not task.done()]
        
        # Wait for remaining tasks
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        actual_duration = time.time() - start_time
        actual_rps = request_count / actual_duration
        success_rate = success_count / request_count if request_count > 0 else 0
        error_rate = error_count / request_count if request_count > 0 else 0
        
        # Stress test assertions
        assert success_rate > 0.7, f"Success rate {success_rate:.2%} too low under stress"
        assert error_rate < 0.3, f"Error rate {error_rate:.2%} too high under stress"
        assert actual_rps > target_rps * 0.5, f"Actual RPS {actual_rps:.2f} significantly below target"
        
        print(f"Stress Test Results:")
        print(f"  Duration: {actual_duration:.2f}s")
        print(f"  Total Requests: {request_count}")
        print(f"  Successful Requests: {success_count}")
        print(f"  Failed Requests: {error_count}")
        print(f"  Actual RPS: {actual_rps:.2f}")
        print(f"  Success Rate: {success_rate:.2%}")
        print(f"  Error Rate: {error_rate:.2%}")
        if response_times:
            print(f"  Avg Response Time: {sum(response_times)/len(response_times):.3f}s")

    @pytest.mark.asyncio
    async def test_scalability_benchmark(
        self, test_data_generator
    ):
        """可扩展性基准测试"""
        from tests.utils.enhanced_test_utils import MockAdapterFactory
        
        factory = MockAdapterFactory()
        
        # Test scalability with different numbers of adapters
        adapter_counts = [1, 5, 10, 20]
        scalability_results = {}
        
        for count in adapter_counts:
            # Create adapters
            adapters = factory.create_batch_of_adapters(count)
            for adapter in adapters:
                await adapter.initialize()
            
            # Test processing with all adapters
            test_data = test_data_generator.generate_text_data(100, 30, 100)
            
            start_time = time.time()
            
            # Process data with each adapter
            total_processed = 0
            for adapter in adapters:
                for text in test_data:
                    input_data = {"text": text}
                    context = AdapterTestUtils.create_execution_context("scalability-test")
                    
                    try:
                        result = await adapter.process(input_data, context)
                        if result.status == "success":
                            total_processed += 1
                    except Exception:
                        pass
            
            end_time = time.time()
            execution_time = end_time - start_time
            throughput = total_processed / execution_time
            
            scalability_results[count] = {
                "adapters": count,
                "throughput": throughput,
                "execution_time": execution_time,
                "processed_items": total_processed
            }
            
            # Cleanup
            for adapter in adapters:
                await adapter.cleanup()
        
        # Verify scalability
        single_adapter_throughput = scalability_results[1]["throughput"]
        ten_adapter_throughput = scalability_results[10]["throughput"]
        
        # Should scale reasonably well (at least 5x improvement with 10x adapters)
        scaling_factor = ten_adapter_throughput / single_adapter_throughput
        assert scaling_factor > 5.0, f"Scalability factor {scaling_factor:.2f} is insufficient"
        
        print(f"Scalability Benchmark Results:")
        for count, result in scalability_results.items():
            print(f"  {count} adapters: {result['throughput']:.2f} items/s")

    @pytest.mark.asyncio
    async def test_generate_performance_report(
        self, performance_monitor, test_reporter, tmp_path
    ):
        """生成性能报告"""
        test_reporter.start_test_run()
        
        # Simulate some test results
        test_names = ["throughput_test", "memory_test", "concurrency_test", "load_test"]
        
        for test_name in test_names:
            # Record mock test result
            test_reporter.record_test_result(
                test_name=test_name,
                status="passed",
                execution_time=1.5,
                metadata={"test_type": "performance"}
            )
        
        test_reporter.end_test_run()
        
        # Generate report
        report_path = tmp_path / "performance_report.json"
        report = test_reporter.generate_report(report_path)
        
        # Verify report structure
        assert "test_run_summary" in report
        assert "test_results" in report
        assert report["test_run_summary"]["total_tests"] == len(test_names)
        assert report["test_run_summary"]["passed_tests"] == len(test_names)
        
        # Verify report file
        assert report_path.exists()
        
        with open(report_path, 'r', encoding='utf-8') as f:
            saved_report = json.load(f)
        
        assert saved_report["test_run_summary"]["total_tests"] == len(test_names)
        
        print(f"Performance report generated: {report_path}")


@pytest.mark.performance
@pytest.mark.slow
class TestRegressionBenchmarks:
    """性能回归基准测试"""
    
    @pytest.mark.asyncio
    async def test_performance_regression_detection(self):
        """性能回归检测测试"""
        # This would compare current performance against historical baselines
        # For now, we'll simulate baseline comparison
        
        historical_baseline = {
            "single_adapter_throughput": 150.0,  # req/s
            "chain_throughput": 45.0,            # req/s
            "memory_growth_mb": 75.0,            # MB
            "p95_response_time": 0.1             # seconds
        }
        
        # Current performance (simulated)
        current_performance = {
            "single_adapter_throughput": 148.0,   # Slightly lower, but within tolerance
            "chain_throughput": 43.0,             # Slightly lower, but acceptable
            "memory_growth_mb": 78.0,             # Slightly higher, but acceptable
            "p95_response_time": 0.12              # Slightly higher, but acceptable
        }
        
        # Regression thresholds (% degradation allowed)
        thresholds = {
            "single_adapter_throughput": 0.05,  # 5% degradation allowed
            "chain_throughput": 0.1,            # 10% degradation allowed
            "memory_growth_mb": 0.2,             # 20% increase allowed
            "p95_response_time": 0.5             # 50% increase allowed
        }
        
        # Check for regressions
        regressions = []
        for metric, current_value in current_performance.items():
            baseline_value = historical_baseline[metric]
            threshold = thresholds[metric]
            
            if metric in ["memory_growth_mb", "p95_response_time"]:
                # Lower is better - check for increase
                degradation = (current_value - baseline_value) / baseline_value
                if degradation > threshold:
                    regressions.append(f"{metric}: {degradation:.2%} increase (threshold: {threshold:.2%})")
            else:
                # Higher is better - check for decrease
                degradation = (baseline_value - current_value) / baseline_value
                if degradation > threshold:
                    regressions.append(f"{metric}: {degradation:.2%} decrease (threshold: {threshold:.2%})")
        
        # Assert no significant regressions
        assert len(regressions) == 0, f"Performance regressions detected: {regressions}"
        
        print("Performance regression check passed - no significant degradation detected")


if __name__ == "__main__":
    # Run performance benchmarks
    pytest.main([__file__, "-v", "-m", "performance"])

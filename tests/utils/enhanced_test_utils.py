# -*- coding: utf-8 -*-
"""
增强测试工具类

提供更强大的测试辅助功能和工具
"""

import asyncio
import time
import psutil
import os
import json
import tempfile
import logging
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Callable, Type
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from unittest.mock import Mock, AsyncMock, patch
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed

from zishu.adapters.base import (
    BaseAdapter, AdapterStatus, AdapterCapability, ExecutionContext,
    ExecutionResult, HealthCheckResult, AdapterType
)


@dataclass
class PerformanceMetrics:
    """性能指标数据类"""
    execution_time: float
    memory_usage: Dict[str, float]
    cpu_usage: float
    throughput: float
    success_rate: float
    error_rate: float
    latency_percentiles: Dict[str, float] = field(default_factory=dict)
    resource_utilization: Dict[str, float] = field(default_factory=dict)


@dataclass
class TestScenario:
    """测试场景数据类"""
    name: str
    description: str
    input_data: Any
    expected_output: Any
    test_parameters: Dict[str, Any] = field(default_factory=dict)
    validation_rules: List[Callable] = field(default_factory=list)


class EnhancedTestUtils:
    """增强测试工具类"""
    
    @staticmethod
    def create_performance_monitor():
        """创建性能监控器"""
        return PerformanceMonitor()
    
    @staticmethod
    def create_mock_adapter_factory():
        """创建模拟适配器工厂"""
        return MockAdapterFactory()
    
    @staticmethod
    def create_test_scenario_builder():
        """创建测试场景构建器"""
        return TestScenarioBuilder()
    
    @staticmethod
    def create_concurrent_test_runner():
        """创建并发测试运行器"""
        return ConcurrentTestRunner()
    
    @staticmethod
    def create_data_generator():
        """创建测试数据生成器"""
        return TestDataGenerator()


class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self):
        self.metrics_history = []
        self.current_session = None
        self.process = psutil.Process()
    
    @asynccontextmanager
    async def monitor_execution(self, operation_name: str):
        """监控执行性能的上下文管理器"""
        session = PerformanceSession(operation_name, self.process)
        self.current_session = session
        
        try:
            await session.start()
            yield session
        finally:
            await session.stop()
            self.metrics_history.append(session.get_metrics())
            self.current_session = None
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """获取性能指标摘要"""
        if not self.metrics_history:
            return {"message": "No metrics collected"}
        
        execution_times = [m.execution_time for m in self.metrics_history]
        throughputs = [m.throughput for m in self.metrics_history if m.throughput > 0]
        
        return {
            "total_operations": len(self.metrics_history),
            "avg_execution_time": sum(execution_times) / len(execution_times),
            "min_execution_time": min(execution_times),
            "max_execution_time": max(execution_times),
            "avg_throughput": sum(throughputs) / len(throughputs) if throughputs else 0,
            "total_errors": sum(1 for m in self.metrics_history if m.error_rate > 0)
        }
    
    def export_metrics(self, file_path: Path):
        """导出性能指标到文件"""
        metrics_data = {
            "summary": self.get_metrics_summary(),
            "detailed_metrics": [
                {
                    "execution_time": m.execution_time,
                    "memory_usage": m.memory_usage,
                    "cpu_usage": m.cpu_usage,
                    "throughput": m.throughput,
                    "success_rate": m.success_rate,
                    "error_rate": m.error_rate
                }
                for m in self.metrics_history
            ]
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(metrics_data, f, indent=2, ensure_ascii=False)


class PerformanceSession:
    """性能监控会话"""
    
    def __init__(self, operation_name: str, process: psutil.Process):
        self.operation_name = operation_name
        self.process = process
        self.start_time = None
        self.end_time = None
        self.start_memory = None
        self.end_memory = None
        self.cpu_samples = []
        self.operation_count = 0
        self.error_count = 0
        self._monitoring_task = None
    
    async def start(self):
        """开始监控"""
        self.start_time = time.time()
        self.start_memory = self.process.memory_info()
        self._monitoring_task = asyncio.create_task(self._collect_samples())
    
    async def stop(self):
        """停止监控"""
        self.end_time = time.time()
        self.end_memory = self.process.memory_info()
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
    
    async def _collect_samples(self):
        """收集CPU样本"""
        try:
            while True:
                cpu_percent = self.process.cpu_percent()
                self.cpu_samples.append(cpu_percent)
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
    
    def record_operation(self, success: bool = True):
        """记录操作"""
        self.operation_count += 1
        if not success:
            self.error_count += 1
    
    def get_metrics(self) -> PerformanceMetrics:
        """获取性能指标"""
        execution_time = (self.end_time - self.start_time) if self.end_time else 0
        
        memory_usage = {
            "start_mb": self.start_memory.rss / 1024 / 1024,
            "end_mb": self.end_memory.rss / 1024 / 1024 if self.end_memory else 0,
            "peak_mb": max(self.start_memory.rss, self.end_memory.rss if self.end_memory else 0) / 1024 / 1024
        }
        
        cpu_usage = sum(self.cpu_samples) / len(self.cpu_samples) if self.cpu_samples else 0
        throughput = self.operation_count / execution_time if execution_time > 0 else 0
        success_rate = (self.operation_count - self.error_count) / self.operation_count if self.operation_count > 0 else 0
        error_rate = self.error_count / self.operation_count if self.operation_count > 0 else 0
        
        return PerformanceMetrics(
            execution_time=execution_time,
            memory_usage=memory_usage,
            cpu_usage=cpu_usage,
            throughput=throughput,
            success_rate=success_rate,
            error_rate=error_rate
        )


class MockAdapterFactory:
    """模拟适配器工厂"""
    
    def __init__(self):
        self.created_adapters = []
    
    def create_mock_adapter(
        self,
        adapter_type: AdapterType = AdapterType.SOFT,
        capabilities: List[AdapterCapability] = None,
        processing_time: float = 0.1,
        success_rate: float = 1.0,
        custom_behavior: Optional[Callable] = None
    ) -> BaseAdapter:
        """创建模拟适配器"""
        
        class MockAdapter(BaseAdapter):
            def __init__(self, config):
                super().__init__(config)
                self.processing_time = processing_time
                self.success_rate = success_rate
                self.custom_behavior = custom_behavior
                self.call_count = 0
            
            async def _initialize_impl(self):
                return True
            
            async def _process_impl(self, input_data, context):
                self.call_count += 1
                
                # Simulate processing time
                await asyncio.sleep(self.processing_time)
                
                # Simulate success/failure rate
                if np.random.random() > self.success_rate:
                    raise Exception(f"Simulated failure (success_rate={self.success_rate})")
                
                # Use custom behavior if provided
                if self.custom_behavior:
                    return self.custom_behavior(input_data, context)
                
                # Default behavior
                return {
                    "processed": True,
                    "input": input_data,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "call_count": self.call_count
                }
            
            def _get_capabilities_impl(self):
                return capabilities or [AdapterCapability.TEXT_PROCESSING]
            
            async def _health_check_impl(self):
                return HealthCheckResult(
                    is_healthy=True,
                    status="healthy",
                    metadata={"call_count": self.call_count}
                )
            
            async def _cleanup_impl(self):
                pass
        
        config = {
            "adapter_id": f"mock-adapter-{len(self.created_adapters)}",
            "adapter_type": adapter_type
        }
        
        adapter = MockAdapter(config)
        self.created_adapters.append(adapter)
        return adapter
    
    def create_failing_adapter(self, failure_mode: str = "exception"):
        """创建失败的适配器"""
        async def failing_behavior(input_data, context):
            if failure_mode == "exception":
                raise Exception("Intentional failure")
            elif failure_mode == "timeout":
                await asyncio.sleep(10)  # Will timeout
            elif failure_mode == "invalid_result":
                return None  # Invalid result
            else:
                return {"error": "Unknown failure mode"}
        
        return self.create_mock_adapter(
            success_rate=0.0,
            custom_behavior=failing_behavior
        )
    
    def create_slow_adapter(self, processing_time: float = 2.0):
        """创建慢适配器"""
        return self.create_mock_adapter(processing_time=processing_time)
    
    def create_batch_of_adapters(
        self,
        count: int,
        adapter_types: List[AdapterType] = None
    ) -> List[BaseAdapter]:
        """创建一批适配器"""
        adapters = []
        types = adapter_types or [AdapterType.SOFT] * count
        
        for i in range(count):
            adapter_type = types[i % len(types)]
            adapter = self.create_mock_adapter(adapter_type=adapter_type)
            adapters.append(adapter)
        
        return adapters


class TestScenarioBuilder:
    """测试场景构建器"""
    
    def __init__(self):
        self.scenarios = []
    
    def add_scenario(self, scenario: TestScenario):
        """添加测试场景"""
        self.scenarios.append(scenario)
        return self
    
    def create_basic_scenario(
        self,
        name: str,
        input_data: Any,
        expected_output: Any = None
    ):
        """创建基础测试场景"""
        scenario = TestScenario(
            name=name,
            description=f"Basic test scenario: {name}",
            input_data=input_data,
            expected_output=expected_output
        )
        return self.add_scenario(scenario)
    
    def create_performance_scenario(
        self,
        name: str,
        input_data: Any,
        max_execution_time: float,
        min_throughput: float = None
    ):
        """创建性能测试场景"""
        def validate_execution_time(result, metrics):
            return metrics.execution_time <= max_execution_time
        
        def validate_throughput(result, metrics):
            return min_throughput is None or metrics.throughput >= min_throughput
        
        scenario = TestScenario(
            name=name,
            description=f"Performance scenario: {name}",
            input_data=input_data,
            expected_output=None,
            test_parameters={
                "max_execution_time": max_execution_time,
                "min_throughput": min_throughput
            },
            validation_rules=[validate_execution_time, validate_throughput]
        )
        return self.add_scenario(scenario)
    
    def create_stress_scenario(
        self,
        name: str,
        input_data_generator: Callable,
        duration_seconds: float,
        concurrent_requests: int = 10
    ):
        """创建压力测试场景"""
        scenario = TestScenario(
            name=name,
            description=f"Stress scenario: {name}",
            input_data=input_data_generator,
            expected_output=None,
            test_parameters={
                "duration_seconds": duration_seconds,
                "concurrent_requests": concurrent_requests,
                "is_stress_test": True
            }
        )
        return self.add_scenario(scenario)
    
    def get_scenarios(self) -> List[TestScenario]:
        """获取所有场景"""
        return self.scenarios
    
    def get_scenario_by_name(self, name: str) -> Optional[TestScenario]:
        """按名称获取场景"""
        for scenario in self.scenarios:
            if scenario.name == name:
                return scenario
        return None


class ConcurrentTestRunner:
    """并发测试运行器"""
    
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self.results = []
    
    async def run_concurrent_tests(
        self,
        test_func: Callable,
        test_data: List[Any],
        timeout: float = 30.0
    ) -> List[Any]:
        """运行并发测试"""
        semaphore = asyncio.Semaphore(self.max_workers)
        
        async def run_single_test(data):
            async with semaphore:
                try:
                    return await asyncio.wait_for(test_func(data), timeout=timeout)
                except Exception as e:
                    return {"error": str(e), "data": data}
        
        tasks = [run_single_test(data) for data in test_data]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        self.results = results
        return results
    
    async def run_load_test(
        self,
        test_func: Callable,
        rps: float,  # requests per second
        duration: float,  # test duration in seconds
        warmup_time: float = 5.0
    ) -> Dict[str, Any]:
        """运行负载测试"""
        interval = 1.0 / rps
        end_time = time.time() + duration + warmup_time
        warmup_end_time = time.time() + warmup_time
        
        results = []
        request_times = []
        
        start_time = time.time()
        request_count = 0
        
        while time.time() < end_time:
            request_start = time.time()
            
            try:
                result = await test_func()
                if time.time() > warmup_end_time:  # Only count after warmup
                    results.append(result)
                    request_times.append(time.time() - request_start)
            except Exception as e:
                if time.time() > warmup_end_time:
                    results.append({"error": str(e)})
            
            request_count += 1
            
            # Control request rate
            next_request_time = start_time + (request_count * interval)
            sleep_time = next_request_time - time.time()
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
        
        # Calculate statistics
        successful_results = [r for r in results if "error" not in r]
        error_results = [r for r in results if "error" in r]
        
        return {
            "total_requests": len(results),
            "successful_requests": len(successful_results),
            "failed_requests": len(error_results),
            "success_rate": len(successful_results) / len(results) if results else 0,
            "actual_rps": len(results) / duration,
            "avg_response_time": sum(request_times) / len(request_times) if request_times else 0,
            "min_response_time": min(request_times) if request_times else 0,
            "max_response_time": max(request_times) if request_times else 0,
            "p95_response_time": np.percentile(request_times, 95) if request_times else 0,
            "p99_response_time": np.percentile(request_times, 99) if request_times else 0
        }
    
    def get_success_rate(self) -> float:
        """获取成功率"""
        if not self.results:
            return 0.0
        
        successful = sum(1 for r in self.results if not isinstance(r, Exception) and "error" not in r)
        return successful / len(self.results)
    
    def get_error_summary(self) -> Dict[str, int]:
        """获取错误摘要"""
        error_counts = {}
        
        for result in self.results:
            if isinstance(result, Exception):
                error_type = type(result).__name__
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
            elif isinstance(result, dict) and "error" in result:
                error_msg = result["error"]
                error_counts[error_msg] = error_counts.get(error_msg, 0) + 1
        
        return error_counts


class TestDataGenerator:
    """测试数据生成器"""
    
    @staticmethod
    def generate_text_data(
        count: int,
        min_length: int = 10,
        max_length: int = 100,
        language: str = "en"
    ) -> List[str]:
        """生成文本数据"""
        texts = []
        words = [
            "test", "data", "generate", "random", "text", "sample",
            "example", "content", "string", "message", "information"
        ]
        
        for _ in range(count):
            text_length = np.random.randint(min_length, max_length + 1)
            text_words = np.random.choice(words, size=text_length, replace=True)
            text = " ".join(text_words)
            texts.append(text)
        
        return texts
    
    @staticmethod
    def generate_numerical_data(
        count: int,
        min_value: float = 0.0,
        max_value: float = 100.0,
        data_type: str = "float"
    ) -> List[Union[int, float]]:
        """生成数值数据"""
        if data_type == "int":
            return [int(np.random.uniform(min_value, max_value)) for _ in range(count)]
        else:
            return [float(np.random.uniform(min_value, max_value)) for _ in range(count)]
    
    @staticmethod
    def generate_json_data(
        count: int,
        schema: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """生成JSON数据"""
        default_schema = {
            "id": "int",
            "name": "string",
            "value": "float",
            "active": "boolean",
            "tags": "list"
        }
        
        schema = schema or default_schema
        data = []
        
        for i in range(count):
            item = {}
            for key, value_type in schema.items():
                if value_type == "int":
                    item[key] = np.random.randint(1, 1000)
                elif value_type == "string":
                    item[key] = f"item_{i}_{key}"
                elif value_type == "float":
                    item[key] = np.random.uniform(0, 100)
                elif value_type == "boolean":
                    item[key] = np.random.choice([True, False])
                elif value_type == "list":
                    item[key] = [f"tag_{j}" for j in range(np.random.randint(1, 5))]
            
            data.append(item)
        
        return data
    
    @staticmethod
    def generate_multimodal_data(
        count: int,
        modalities: List[str] = None
    ) -> List[Dict[str, Any]]:
        """生成多模态数据"""
        modalities = modalities or ["text", "image"]
        data = []
        
        for i in range(count):
            item = {"modalities": {}}
            
            if "text" in modalities:
                item["modalities"]["text"] = {
                    "content": f"Multimodal sample {i} text content",
                    "language": "en"
                }
            
            if "image" in modalities:
                item["modalities"]["image"] = {
                    "data": f"base64_encoded_image_{i}",
                    "format": "jpeg",
                    "width": 224,
                    "height": 224
                }
            
            if "audio" in modalities:
                item["modalities"]["audio"] = {
                    "data": f"base64_encoded_audio_{i}",
                    "format": "wav",
                    "duration": np.random.uniform(1.0, 10.0)
                }
            
            data.append(item)
        
        return data


class TestReporter:
    """测试报告器"""
    
    def __init__(self):
        self.test_results = []
        self.performance_metrics = []
        self.start_time = None
        self.end_time = None
    
    def start_test_run(self):
        """开始测试运行"""
        self.start_time = datetime.now(timezone.utc)
        self.test_results = []
        self.performance_metrics = []
    
    def end_test_run(self):
        """结束测试运行"""
        self.end_time = datetime.now(timezone.utc)
    
    def record_test_result(
        self,
        test_name: str,
        status: str,
        execution_time: float,
        error_message: str = None,
        metadata: Dict[str, Any] = None
    ):
        """记录测试结果"""
        result = {
            "test_name": test_name,
            "status": status,
            "execution_time": execution_time,
            "error_message": error_message,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.test_results.append(result)
    
    def record_performance_metrics(self, metrics: PerformanceMetrics, test_name: str):
        """记录性能指标"""
        metric_record = {
            "test_name": test_name,
            "metrics": {
                "execution_time": metrics.execution_time,
                "memory_usage": metrics.memory_usage,
                "cpu_usage": metrics.cpu_usage,
                "throughput": metrics.throughput,
                "success_rate": metrics.success_rate,
                "error_rate": metrics.error_rate
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.performance_metrics.append(metric_record)
    
    def generate_report(self, output_path: Path):
        """生成测试报告"""
        report = {
            "test_run_summary": {
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": self.end_time.isoformat() if self.end_time else None,
                "total_tests": len(self.test_results),
                "passed_tests": len([r for r in self.test_results if r["status"] == "passed"]),
                "failed_tests": len([r for r in self.test_results if r["status"] == "failed"]),
                "total_execution_time": sum(r["execution_time"] for r in self.test_results)
            },
            "test_results": self.test_results,
            "performance_metrics": self.performance_metrics
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return report

# -*- coding: utf-8 -*-
"""
适配器组合和链式测试

测试适配器链式组合、管道处理和协同工作功能
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from zishu.adapters.core.composition import (
    AdapterChain, AdapterPipeline, AdapterComposer, CompositionStrategy,
    ChainExecutionResult, PipelineConfig, CompositionError
)
from zishu.adapters.base import (
    BaseAdapter, AdapterStatus, AdapterCapability, ExecutionContext,
    ExecutionResult, HealthCheckResult, AdapterType
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class MockAdapterA(BaseAdapter):
    """模拟适配器A - 文本预处理"""
    
    def __init__(self, config=None):
        super().__init__(config or {"adapter_id": "mock-a", "adapter_type": "soft"})
        self.process_count = 0
    
    async def _initialize_impl(self):
        return True
    
    async def _process_impl(self, input_data, context):
        self.process_count += 1
        text = input_data.get("text", "")
        processed_text = text.lower().strip()
        
        return {
            "processed_text": processed_text,
            "original_length": len(text),
            "processed_length": len(processed_text),
            "adapter": "MockAdapterA"
        }
    
    def _get_capabilities_impl(self):
        return [AdapterCapability.TEXT_PROCESSING]
    
    async def _health_check_impl(self):
        return HealthCheckResult(is_healthy=True, status="healthy")
    
    async def _cleanup_impl(self):
        pass


class MockAdapterB(BaseAdapter):
    """模拟适配器B - 情感分析"""
    
    def __init__(self, config=None):
        super().__init__(config or {"adapter_id": "mock-b", "adapter_type": "intelligent"})
        self.process_count = 0
    
    async def _initialize_impl(self):
        return True
    
    async def _process_impl(self, input_data, context):
        self.process_count += 1
        text = input_data.get("processed_text", input_data.get("text", ""))
        
        # Simple sentiment analysis mock
        sentiment = "positive" if "good" in text or "great" in text else "neutral"
        confidence = 0.85 if sentiment == "positive" else 0.60
        
        return {
            "text": text,
            "sentiment": sentiment,
            "confidence": confidence,
            "analysis_time": 0.1,
            "adapter": "MockAdapterB"
        }
    
    def _get_capabilities_impl(self):
        return [AdapterCapability.TEXT_ANALYSIS]
    
    async def _health_check_impl(self):
        return HealthCheckResult(is_healthy=True, status="healthy")
    
    async def _cleanup_impl(self):
        pass


class MockAdapterC(BaseAdapter):
    """模拟适配器C - 响应生成"""
    
    def __init__(self, config=None):
        super().__init__(config or {"adapter_id": "mock-c", "adapter_type": "soft"})
        self.process_count = 0
    
    async def _initialize_impl(self):
        return True
    
    async def _process_impl(self, input_data, context):
        self.process_count += 1
        sentiment = input_data.get("sentiment", "neutral")
        text = input_data.get("text", "")
        
        # Generate response based on sentiment
        if sentiment == "positive":
            response = f"Thank you for your positive feedback: '{text}'"
        elif sentiment == "negative":
            response = f"We apologize for the issue: '{text}'"
        else:
            response = f"We acknowledge your input: '{text}'"
        
        return {
            "original_text": text,
            "sentiment": sentiment,
            "response": response,
            "response_length": len(response),
            "adapter": "MockAdapterC"
        }
    
    def _get_capabilities_impl(self):
        return [AdapterCapability.TEXT_GENERATION]
    
    async def _health_check_impl(self):
        return HealthCheckResult(is_healthy=True, status="healthy")
    
    async def _cleanup_impl(self):
        pass


class TestAdapterChain:
    """适配器链测试类"""
    
    @pytest.fixture
    def adapter_chain_config(self):
        """创建适配器链配置"""
        return {
            "chain_id": "test-text-processing-chain",
            "name": "文本处理链",
            "description": "预处理 -> 情感分析 -> 响应生成",
            "execution_strategy": "sequential",
            "error_handling": "stop_on_error",
            "timeout": 30.0
        }
    
    @pytest.fixture
    async def mock_adapters(self):
        """创建模拟适配器"""
        adapter_a = MockAdapterA()
        adapter_b = MockAdapterB()
        adapter_c = MockAdapterC()
        
        await adapter_a.initialize()
        await adapter_b.initialize()
        await adapter_c.initialize()
        
        return [adapter_a, adapter_b, adapter_c]
    
    @pytest.fixture
    def adapter_chain(self, adapter_chain_config, mock_adapters):
        """创建适配器链"""
        return AdapterChain(adapter_chain_config, mock_adapters)
    
    @pytest.mark.asyncio
    async def test_chain_initialization(self, adapter_chain):
        """测试链初始化"""
        # Act
        await adapter_chain.initialize()
        
        # Assert
        assert adapter_chain.is_initialized
        assert len(adapter_chain.adapters) == 3
        assert adapter_chain.execution_strategy == "sequential"
    
    @pytest.mark.asyncio
    async def test_sequential_execution(self, adapter_chain):
        """测试顺序执行"""
        await adapter_chain.initialize()
        
        # Arrange
        input_data = {"text": "This is a GREAT product!"}
        context = ExecutionContext(request_id="chain-001")
        
        # Act
        result = await adapter_chain.execute(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert result.chain_id == "test-text-processing-chain"
        assert len(result.step_results) == 3
        
        # Verify processing flow
        step1_result = result.step_results[0]
        assert step1_result["adapter"] == "MockAdapterA"
        assert "processed_text" in step1_result
        
        step2_result = result.step_results[1]
        assert step2_result["adapter"] == "MockAdapterB"
        assert step2_result["sentiment"] == "positive"
        
        step3_result = result.step_results[2]
        assert step3_result["adapter"] == "MockAdapterC"
        assert "Thank you" in step3_result["response"]
    
    @pytest.mark.asyncio
    async def test_parallel_execution(self, adapter_chain_config, mock_adapters):
        """测试并行执行"""
        # Modify config for parallel execution
        adapter_chain_config["execution_strategy"] = "parallel"
        
        # Create independent adapters for parallel execution
        parallel_adapters = [MockAdapterA(), MockAdapterB(), MockAdapterC()]
        for adapter in parallel_adapters:
            await adapter.initialize()
        
        chain = AdapterChain(adapter_chain_config, parallel_adapters)
        await chain.initialize()
        
        # Arrange
        input_data = {"text": "Parallel processing test"}
        context = ExecutionContext(request_id="parallel-001")
        
        # Act
        start_time = asyncio.get_event_loop().time()
        result = await chain.execute(input_data, context)
        end_time = asyncio.get_event_loop().time()
        
        # Assert
        assert result.status == "success"
        assert len(result.step_results) == 3
        
        # Parallel execution should be faster
        execution_time = end_time - start_time
        assert execution_time < 1.0  # Should be much faster than sequential
        
        # All adapters should have processed the same input
        assert all("adapter" in step_result for step_result in result.step_results)
    
    @pytest.mark.asyncio
    async def test_error_handling_stop_on_error(self, adapter_chain):
        """测试错误处理 - 遇到错误停止"""
        await adapter_chain.initialize()
        
        # Mock an adapter to fail
        adapter_chain.adapters[1]._process_impl = AsyncMock(
            side_effect=Exception("Processing failed")
        )
        
        # Arrange
        input_data = {"text": "This will cause an error"}
        context = ExecutionContext(request_id="error-001")
        
        # Act
        result = await adapter_chain.execute(input_data, context)
        
        # Assert
        assert result.status == "error"
        assert len(result.step_results) == 2  # First adapter succeeded, second failed
        assert "Processing failed" in result.error_message
    
    @pytest.mark.asyncio
    async def test_error_handling_continue_on_error(self, adapter_chain_config, mock_adapters):
        """测试错误处理 - 遇到错误继续"""
        adapter_chain_config["error_handling"] = "continue_on_error"
        chain = AdapterChain(adapter_chain_config, mock_adapters)
        await chain.initialize()
        
        # Mock middle adapter to fail
        chain.adapters[1]._process_impl = AsyncMock(
            side_effect=Exception("Middle adapter failed")
        )
        
        # Arrange
        input_data = {"text": "Continue despite error"}
        context = ExecutionContext(request_id="continue-001")
        
        # Act
        result = await chain.execute(input_data, context)
        
        # Assert
        assert result.status == "partial_success"
        assert len(result.step_results) == 3
        assert result.step_results[1] is None or isinstance(result.step_results[1], Exception)
        assert result.step_results[2] is not None  # Third adapter should still execute
    
    @pytest.mark.asyncio
    async def test_chain_health_check(self, adapter_chain):
        """测试链健康检查"""
        await adapter_chain.initialize()
        
        # Act
        health = await adapter_chain.health_check()
        
        # Assert
        assert health.is_healthy is True
        assert health.metadata["total_adapters"] == 3
        assert health.metadata["healthy_adapters"] == 3
    
    @pytest.mark.asyncio
    async def test_chain_metrics(self, adapter_chain):
        """测试链执行指标"""
        await adapter_chain.initialize()
        
        # Execute multiple times to collect metrics
        input_data = {"text": "Metrics test"}
        context = ExecutionContext(request_id="metrics-001")
        
        for i in range(5):
            await adapter_chain.execute(input_data, context)
        
        # Act
        metrics = await adapter_chain.get_metrics()
        
        # Assert
        assert metrics["total_executions"] == 5
        assert metrics["successful_executions"] == 5
        assert metrics["average_execution_time"] > 0
        assert "adapter_metrics" in metrics


class TestAdapterPipeline:
    """适配器管道测试类"""
    
    @pytest.fixture
    def pipeline_config(self):
        """创建管道配置"""
        return PipelineConfig(
            pipeline_id="test-pipeline",
            name="测试管道",
            stages=[
                {"name": "preprocessing", "parallel": False},
                {"name": "analysis", "parallel": True},
                {"name": "postprocessing", "parallel": False}
            ],
            buffer_size=100,
            batch_size=10
        )
    
    @pytest.fixture
    def adapter_pipeline(self, pipeline_config):
        """创建适配器管道"""
        return AdapterPipeline(pipeline_config)
    
    @pytest.mark.asyncio
    async def test_pipeline_initialization(self, adapter_pipeline):
        """测试管道初始化"""
        # Act
        await adapter_pipeline.initialize()
        
        # Assert
        assert adapter_pipeline.is_initialized
        assert len(adapter_pipeline.stages) == 3
        assert adapter_pipeline.buffer is not None
    
    @pytest.mark.asyncio
    async def test_stage_configuration(self, adapter_pipeline, mock_adapters):
        """测试阶段配置"""
        await adapter_pipeline.initialize()
        
        # Configure stages with adapters
        await adapter_pipeline.add_adapter_to_stage("preprocessing", mock_adapters[0])
        await adapter_pipeline.add_adapter_to_stage("analysis", mock_adapters[1])
        await adapter_pipeline.add_adapter_to_stage("postprocessing", mock_adapters[2])
        
        # Assert
        assert len(adapter_pipeline.get_stage_adapters("preprocessing")) == 1
        assert len(adapter_pipeline.get_stage_adapters("analysis")) == 1
        assert len(adapter_pipeline.get_stage_adapters("postprocessing")) == 1
    
    @pytest.mark.asyncio
    async def test_batch_processing(self, adapter_pipeline, mock_adapters):
        """测试批处理"""
        await adapter_pipeline.initialize()
        
        # Configure pipeline
        for i, stage_name in enumerate(["preprocessing", "analysis", "postprocessing"]):
            await adapter_pipeline.add_adapter_to_stage(stage_name, mock_adapters[i])
        
        # Arrange batch data
        batch_data = [
            {"text": f"Batch item {i}"}
            for i in range(15)  # More than batch_size (10)
        ]
        context = ExecutionContext(request_id="batch-001")
        
        # Act
        results = await adapter_pipeline.process_batch(batch_data, context)
        
        # Assert
        assert len(results) == 15
        assert all(result.status == "success" for result in results)
    
    @pytest.mark.asyncio
    async def test_streaming_processing(self, adapter_pipeline, mock_adapters):
        """测试流式处理"""
        await adapter_pipeline.initialize()
        
        # Configure pipeline
        for i, stage_name in enumerate(["preprocessing", "analysis", "postprocessing"]):
            await adapter_pipeline.add_adapter_to_stage(stage_name, mock_adapters[i])
        
        # Start pipeline
        await adapter_pipeline.start()
        
        # Create data stream
        async def data_stream():
            for i in range(20):
                yield {"text": f"Stream item {i}"}
                await asyncio.sleep(0.01)  # Small delay to simulate streaming
        
        # Act
        results = []
        async for result in adapter_pipeline.process_stream(data_stream()):
            results.append(result)
        
        # Assert
        assert len(results) == 20
        assert all(result.status == "success" for result in results)
    
    @pytest.mark.asyncio
    async def test_pipeline_backpressure(self, adapter_pipeline, mock_adapters):
        """测试管道背压"""
        # Set small buffer size to test backpressure
        adapter_pipeline.config.buffer_size = 5
        await adapter_pipeline.initialize()
        
        # Add slow processing adapter
        slow_adapter = MockAdapterA()
        slow_adapter._process_impl = AsyncMock(
            side_effect=lambda x, y: asyncio.sleep(0.1) or {"processed": True}
        )
        await slow_adapter.initialize()
        
        await adapter_pipeline.add_adapter_to_stage("preprocessing", slow_adapter)
        await adapter_pipeline.start()
        
        # Send many items quickly
        items = [{"text": f"Item {i}"} for i in range(20)]
        
        # Should handle backpressure gracefully
        start_time = asyncio.get_event_loop().time()
        for item in items:
            await adapter_pipeline.add_to_buffer(item)
        
        end_time = asyncio.get_event_loop().time()
        processing_time = end_time - start_time
        
        # Should take longer due to backpressure
        assert processing_time > 0.1


class TestAdapterComposer:
    """适配器组合器测试类"""
    
    @pytest.fixture
    def composer(self):
        """创建适配器组合器"""
        return AdapterComposer()
    
    @pytest.mark.asyncio
    async def test_compose_linear_chain(self, composer, mock_adapters):
        """测试组合线性链"""
        # Act
        chain = await composer.compose_linear_chain(
            adapters=mock_adapters,
            chain_id="linear-test"
        )
        
        # Assert
        assert chain.chain_id == "linear-test"
        assert len(chain.adapters) == 3
        assert chain.execution_strategy == "sequential"
    
    @pytest.mark.asyncio
    async def test_compose_parallel_group(self, composer, mock_adapters):
        """测试组合并行组"""
        # Act
        group = await composer.compose_parallel_group(
            adapters=mock_adapters,
            group_id="parallel-test"
        )
        
        # Assert
        assert group.chain_id == "parallel-test"
        assert group.execution_strategy == "parallel"
    
    @pytest.mark.asyncio
    async def test_compose_conditional_chain(self, composer, mock_adapters):
        """测试组合条件链"""
        # Define condition function
        def condition_func(input_data, context):
            return input_data.get("use_analysis", True)
        
        # Act
        chain = await composer.compose_conditional_chain(
            primary_adapter=mock_adapters[0],
            conditional_adapter=mock_adapters[1],
            condition=condition_func,
            chain_id="conditional-test"
        )
        
        # Test with condition True
        input_data = {"text": "Test", "use_analysis": True}
        context = ExecutionContext(request_id="cond-true")
        result = await chain.execute(input_data, context)
        
        assert result.status == "success"
        assert len(result.step_results) == 2  # Both adapters executed
        
        # Test with condition False
        input_data = {"text": "Test", "use_analysis": False}
        context = ExecutionContext(request_id="cond-false")
        result = await chain.execute(input_data, context)
        
        assert result.status == "success"
        assert len(result.step_results) == 1  # Only primary adapter executed
    
    @pytest.mark.asyncio
    async def test_compose_feedback_loop(self, composer, mock_adapters):
        """测试组合反馈循环"""
        # Define feedback condition
        def feedback_condition(result, iteration):
            confidence = result.get("confidence", 0.0)
            return confidence < 0.9 and iteration < 3  # Max 3 iterations
        
        # Act
        loop = await composer.compose_feedback_loop(
            adapter=mock_adapters[1],  # Use sentiment analysis adapter
            condition=feedback_condition,
            max_iterations=3
        )
        
        # Execute with low confidence scenario
        input_data = {"text": "neutral text"}
        context = ExecutionContext(request_id="feedback-001")
        result = await loop.execute(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert result.metadata["iterations"] >= 1


class TestCompositionStrategies:
    """组合策略测试类"""
    
    @pytest.mark.asyncio
    async def test_fan_out_fan_in_pattern(self, mock_adapters):
        """测试扇出扇入模式"""
        composer = AdapterComposer()
        
        # Create fan-out pattern
        fan_out_chain = await composer.compose_fan_out_fan_in(
            input_adapter=mock_adapters[0],      # Preprocessing
            parallel_adapters=[mock_adapters[1]], # Analysis
            output_adapter=mock_adapters[2],      # Response generation
            aggregation_strategy="merge"
        )
        
        # Execute
        input_data = {"text": "Fan out test"}
        context = ExecutionContext(request_id="fanout-001")
        result = await fan_out_chain.execute(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "aggregated_results" in result.metadata
    
    @pytest.mark.asyncio
    async def test_scatter_gather_pattern(self, mock_adapters):
        """测试散布收集模式"""
        composer = AdapterComposer()
        
        # Create scatter-gather pattern
        scatter_gather = await composer.compose_scatter_gather(
            scatter_adapters=mock_adapters[:2],   # Multiple processors
            gather_adapter=mock_adapters[2],      # Result aggregator
            scatter_strategy="broadcast"          # Send same input to all
        )
        
        # Execute
        input_data = {"text": "Scatter gather test"}
        context = ExecutionContext(request_id="scatter-001")
        result = await scatter_gather.execute(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert len(result.scatter_results) == 2
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_pattern(self, mock_adapters):
        """测试熔断器模式"""
        composer = AdapterComposer()
        
        # Create adapter with circuit breaker
        protected_adapter = await composer.add_circuit_breaker(
            adapter=mock_adapters[0],
            failure_threshold=3,
            recovery_timeout=1.0
        )
        
        # Simulate failures
        protected_adapter.adapter._process_impl = AsyncMock(
            side_effect=Exception("Simulated failure")
        )
        
        # Execute multiple times to trigger circuit breaker
        input_data = {"text": "Circuit breaker test"}
        context = ExecutionContext(request_id="circuit-001")
        
        results = []
        for i in range(5):
            result = await protected_adapter.execute(input_data, context)
            results.append(result)
        
        # First few should fail, then circuit should open
        assert any(result.status == "error" for result in results)
        assert any("circuit breaker" in result.error_message.lower() for result in results[3:])


@pytest.mark.performance
class TestCompositionPerformance:
    """组合性能测试"""
    
    @pytest.mark.asyncio
    async def test_chain_execution_performance(self, mock_adapters):
        """测试链执行性能"""
        composer = AdapterComposer()
        chain = await composer.compose_linear_chain(mock_adapters, "perf-chain")
        await chain.initialize()
        
        # Measure execution time
        input_data = {"text": "Performance test"}
        context = ExecutionContext(request_id="perf-001")
        
        start_time = asyncio.get_event_loop().time()
        
        # Execute multiple times
        for i in range(100):
            await chain.execute(input_data, context)
        
        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        
        # Assert performance requirements
        assert total_time < 10.0  # 100 executions in less than 10 seconds
        throughput = 100 / total_time
        assert throughput > 10  # At least 10 executions per second
    
    @pytest.mark.asyncio
    async def test_parallel_vs_sequential_performance(self, mock_adapters):
        """测试并行与顺序执行性能对比"""
        composer = AdapterComposer()
        
        # Create sequential chain
        sequential_chain = await composer.compose_linear_chain(
            mock_adapters, "sequential-perf"
        )
        await sequential_chain.initialize()
        
        # Create parallel chain
        parallel_chain = await composer.compose_parallel_group(
            mock_adapters, "parallel-perf"
        )
        await parallel_chain.initialize()
        
        input_data = {"text": "Performance comparison"}
        context = ExecutionContext(request_id="compare-001")
        
        # Measure sequential execution
        start_time = asyncio.get_event_loop().time()
        sequential_result = await sequential_chain.execute(input_data, context)
        sequential_time = asyncio.get_event_loop().time() - start_time
        
        # Measure parallel execution
        start_time = asyncio.get_event_loop().time()
        parallel_result = await parallel_chain.execute(input_data, context)
        parallel_time = asyncio.get_event_loop().time() - start_time
        
        # Assert
        assert sequential_result.status == "success"
        assert parallel_result.status == "success"
        # Parallel should generally be faster (though with mocks, the difference might be small)
        assert parallel_time <= sequential_time * 1.5  # Allow some overhead

# -*- coding: utf-8 -*-
"""
智能适配器测试

测试基于机器学习和代码生成的智能适配器功能
"""

import pytest
import asyncio
import tempfile
import shutil
import json
import ast
import sys
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from zishu.adapters.intelligent.intelligent_adapter import (
    IntelligentHardAdapter,
)
from zishu.adapters.intelligent.code_generator import IntelligentCodeGenerator
from zishu.adapters.intelligent.safe_executor import SafeCodeExecutor, ExecutionRequest
from zishu.adapters.intelligent.learning_engine import ContinuousLearningEngine
from zishu.adapters.base.exceptions import IntelligentAdapterError
from zishu.adapters.base import (
    AdapterStatus, AdapterCapability, ExecutionContext,
    ExecutionResult, HealthCheckResult, AdapterType, SecurityLevel
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestIntelligentAdapter:
    """智能适配器测试类"""

    @pytest.fixture
    def temp_directory(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp(prefix="intelligent_adapter_test_")
        yield Path(temp_dir)
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def intelligent_adapter_config(self):
        """创建智能适配器配置"""
        return {
            "adapter_id": "test-intelligent-adapter",
            "name": "测试智能适配器",
            "version": "1.0.0",
            "adapter_type": AdapterType.INTELLIGENT,
            "description": "测试智能适配器实例",
            "security_level": SecurityLevel.RESTRICTED,
            "code_generator": {
                "model_name": "code-generation-model",
                "temperature": 0.1,
                "max_tokens": 1000,
                "stop_sequences": ["###", "```"]
            },
            "safe_executor": {
                "sandbox_enabled": True,
                "timeout_seconds": 30,
                "memory_limit_mb": 256,
                "allowed_modules": ["math", "json", "datetime", "re"],
                "blocked_modules": ["os", "sys", "subprocess", "importlib"]
            },
            "learning_engine": {
                "enabled": True,
                "feedback_storage": "memory",
                "model_update_interval": 100,
                "success_threshold": 0.8
            }
        }

    @pytest.fixture
    def mock_code_generator(self):
        """模拟代码生成器"""
        generator = Mock()
        generator.generate_code = AsyncMock(return_value={
            "code": "def solve(x):\n    return x * 2",
            "explanation": "This function doubles the input",
            "confidence": 0.9
        })
        return generator

    @pytest.fixture
    def mock_safe_executor(self):
        """模拟安全执行器"""
        executor = Mock()
        executor.execute_code = AsyncMock(return_value={
            "success": True,
            "result": 42,
            "execution_time": 0.1,
            "memory_used": 128,
            "error": None
        })
        return executor

    @pytest.fixture
    def mock_learning_engine(self):
        """模拟学习引擎"""
        engine = Mock()
        engine.record_feedback = AsyncMock()
        engine.get_suggestions = AsyncMock(return_value=[
            "Consider using list comprehension",
            "Add error handling"
        ])
        engine.update_model = AsyncMock(return_value=True)
        return engine

    @pytest.fixture
    def intelligent_adapter(self, intelligent_adapter_config, mock_code_generator, 
                          mock_safe_executor, mock_learning_engine):
        """创建智能适配器实例"""
        adapter = IntelligentHardAdapter(intelligent_adapter_config)
        adapter._code_generator = mock_code_generator
        adapter._safe_executor = mock_safe_executor
        adapter._learning_engine = mock_learning_engine
        return adapter

    @pytest.mark.asyncio
    async def test_adapter_initialization(self, intelligent_adapter):
        """测试智能适配器初始化"""
        # Act
        await intelligent_adapter.initialize()
        
        # Assert
        assert intelligent_adapter.status == AdapterStatus.READY
        assert AdapterCapability.CODE_GENERATION in intelligent_adapter.capabilities
        assert AdapterCapability.CODE_EXECUTION in intelligent_adapter.capabilities
        assert intelligent_adapter._code_generator is not None
        assert intelligent_adapter._safe_executor is not None

    @pytest.mark.asyncio
    async def test_code_generation(self, intelligent_adapter):
        """测试代码生成"""
        await intelligent_adapter.initialize()
        
        # Arrange
        input_data = {
            "task": "code_generation",
            "description": "Write a function to calculate factorial",
            "requirements": ["recursive implementation", "handle edge cases"]
        }
        context = ExecutionContext(request_id="codegen-001")
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "code" in result.data
        assert result.data["confidence"] == 0.9
        intelligent_adapter._code_generator.generate_code.assert_called_once()

    @pytest.mark.asyncio
    async def test_code_execution(self, intelligent_adapter):
        """测试代码执行"""
        await intelligent_adapter.initialize()
        
        # Arrange
        input_data = {
            "task": "code_execution",
            "code": "def multiply(a, b):\n    return a * b\n\nresult = multiply(6, 7)",
            "inputs": {},
            "expected_output": 42
        }
        context = ExecutionContext(request_id="codeexec-001")
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert result.data["result"] == 42
        assert result.data["execution_time"] == 0.1
        intelligent_adapter._safe_executor.execute_code.assert_called_once()

    @pytest.mark.asyncio
    async def test_code_generation_and_execution(self, intelligent_adapter):
        """测试代码生成和执行的完整流程"""
        await intelligent_adapter.initialize()
        
        # Mock generated code that can be executed
        intelligent_adapter._code_generator.generate_code = AsyncMock(return_value={
            "code": "def add_numbers(a, b):\n    return a + b\n\nresult = add_numbers(3, 4)",
            "explanation": "Adds two numbers",
            "confidence": 0.95
        })
        
        # Arrange
        input_data = {
            "task": "generate_and_execute",
            "description": "Create a function to add two numbers and execute it",
            "inputs": {"a": 3, "b": 4},
            "expected_result": 7
        }
        context = ExecutionContext(request_id="genexec-001")
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "generated_code" in result.data
        assert "execution_result" in result.data
        assert result.data["execution_result"]["result"] == 42

    @pytest.mark.asyncio
    async def test_learning_feedback(self, intelligent_adapter):
        """测试学习反馈"""
        await intelligent_adapter.initialize()
        
        # Arrange
        feedback_data = {
            "task": "learning_feedback",
            "request_id": "genexec-001",
            "success": True,
            "user_rating": 5,
            "comments": "Perfect solution",
            "execution_time": 0.1
        }
        context = ExecutionContext(request_id="feedback-001")
        
        # Act
        result = await intelligent_adapter.process(feedback_data, context)
        
        # Assert
        assert result.status == "success"
        intelligent_adapter._learning_engine.record_feedback.assert_called_once()

    @pytest.mark.asyncio
    async def test_code_optimization(self, intelligent_adapter):
        """测试代码优化"""
        await intelligent_adapter.initialize()
        
        # Arrange
        input_data = {
            "task": "code_optimization",
            "original_code": "result = []\nfor i in range(10):\n    result.append(i*2)",
            "optimization_goals": ["performance", "readability"]
        }
        context = ExecutionContext(request_id="optimize-001")
        
        # Mock optimized code
        intelligent_adapter._code_generator.generate_code = AsyncMock(return_value={
            "code": "result = [i*2 for i in range(10)]",
            "explanation": "Using list comprehension for better performance",
            "confidence": 0.85,
            "improvements": ["reduced lines", "better performance"]
        })
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "optimized_code" in result.data
        assert "improvements" in result.data

    @pytest.mark.asyncio
    async def test_error_handling_in_code_execution(self, intelligent_adapter):
        """测试代码执行中的错误处理"""
        await intelligent_adapter.initialize()
        
        # Mock execution error
        intelligent_adapter._safe_executor.execute_code = AsyncMock(return_value={
            "success": False,
            "result": None,
            "execution_time": 0.05,
            "memory_used": 64,
            "error": "ZeroDivisionError: division by zero"
        })
        
        # Arrange
        input_data = {
            "task": "code_execution",
            "code": "result = 10 / 0",  # This will cause an error
            "inputs": {}
        }
        context = ExecutionContext(request_id="error-001")
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "error"
        assert "division by zero" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_security_validation(self, intelligent_adapter):
        """测试安全验证"""
        await intelligent_adapter.initialize()
        
        # Arrange - 危险代码
        input_data = {
            "task": "code_execution",
            "code": "import os\nos.system('rm -rf /')",  # 危险操作
            "inputs": {}
        }
        context = ExecutionContext(request_id="security-001")
        
        # Mock security rejection
        intelligent_adapter._safe_executor.execute_code = AsyncMock(return_value={
            "success": False,
            "result": None,
            "execution_time": 0.0,
            "memory_used": 0,
            "error": "SecurityError: Blocked dangerous operation"
        })
        
        # Act
        result = await intelligent_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "error"
        assert "security" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_concurrent_code_generation(self, intelligent_adapter):
        """测试并发代码生成"""
        await intelligent_adapter.initialize()
        
        # Arrange
        tasks = []
        for i in range(5):
            input_data = {
                "task": "code_generation",
                "description": f"Generate function {i}",
                "requirements": []
            }
            context = ExecutionContext(request_id=f"concurrent-{i}")
            task = intelligent_adapter.process(input_data, context)
            tasks.append(task)
        
        # Act
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Assert
        assert len(results) == 5
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 4  # 允许少数失败

    @pytest.mark.asyncio
    async def test_health_check(self, intelligent_adapter):
        """测试健康检查"""
        await intelligent_adapter.initialize()
        
        # Act
        health = await intelligent_adapter.health_check()
        
        # Assert
        assert isinstance(health, HealthCheckResult)
        assert health.is_healthy is True
        assert "code_generator" in health.metadata
        assert "safe_executor" in health.metadata


class TestCodeGenerator:
    """代码生成器测试类"""
    
    @pytest.fixture
    def code_generator(self):
        """创建代码生成器"""
        config = {
            "model_name": "test-model",
            "temperature": 0.1,
            "max_tokens": 500
        }
        return IntelligentCodeGenerator(config)
    
    @pytest.mark.asyncio
    async def test_simple_code_generation(self, code_generator):
        """测试简单代码生成"""
        # Mock the model response
        with patch.object(code_generator, '_call_model', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {
                "code": "def hello():\n    return 'Hello, World!'",
                "confidence": 0.9
            }
            
            # Act
            result = await code_generator.generate_code(
                "Create a function that returns 'Hello, World!'"
            )
            
            # Assert
            assert "def hello()" in result["code"]
            assert result["confidence"] == 0.9
    
    @pytest.mark.asyncio
    async def test_code_validation(self, code_generator):
        """测试代码验证"""
        # Valid Python code
        valid_code = "def add(a, b):\n    return a + b"
        assert code_generator.validate_code(valid_code) is True
        
        # Invalid Python code
        invalid_code = "def add(a, b\n    return a + b"  # Missing closing parenthesis
        assert code_generator.validate_code(invalid_code) is False
    
    @pytest.mark.asyncio
    async def test_code_formatting(self, code_generator):
        """测试代码格式化"""
        unformatted_code = "def add(a,b):return a+b"
        formatted_code = code_generator.format_code(unformatted_code)
        
        # Should be properly formatted
        assert "def add(a, b):" in formatted_code
        assert "return a + b" in formatted_code


class TestSafeExecutor:
    """安全执行器测试类"""
    
    @pytest.fixture
    def safe_executor(self):
        """创建安全执行器"""
        config = {
            "timeout_seconds": 10,
            "memory_limit_mb": 128,
            "allowed_modules": ["math", "json"],
            "blocked_modules": ["os", "sys"]
        }
        return SafeCodeExecutor(config)
    
    @pytest.mark.asyncio
    async def test_safe_code_execution(self, safe_executor):
        """测试安全代码执行"""
        code = """
import math
result = math.sqrt(16)
"""
        
        # Create ExecutionRequest
        request = ExecutionRequest(
            request_id="test_safe_execution",
            code=code
        )
        
        # Act
        execution_result = await safe_executor.execute_code(request)
        
        # Assert
        assert execution_result.success is True
        assert execution_result.stdout is not None
        assert execution_result.execution_time_seconds > 0
    
    @pytest.mark.asyncio
    async def test_blocked_module_execution(self, safe_executor):
        """测试阻止危险模块执行"""
        dangerous_code = """
import os
os.system('echo "This should be blocked"')
"""
        
        # Create ExecutionRequest
        request = ExecutionRequest(
            request_id="test_blocked_execution",
            code=dangerous_code
        )
        
        # Act
        execution_result = await safe_executor.execute_code(request)
        
        # Assert
        assert execution_result.success is False
        assert ("blocked" in execution_result.stderr.lower() or 
                "security" in execution_result.stderr.lower() or 
                "forbidden" in execution_result.stderr.lower())
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self, safe_executor):
        """测试超时处理"""
        infinite_loop_code = """
while True:
    pass
"""
        
        # Create ExecutionRequest
        request = ExecutionRequest(
            request_id="test_timeout",
            code=infinite_loop_code
        )
        
        # Act
        execution_result = await safe_executor.execute_code(request)
        
        # Assert
        assert execution_result.success is False
        assert ("timeout" in execution_result.stderr.lower() or 
                "timed out" in execution_result.stderr.lower())
    
    def test_code_analysis(self, safe_executor):
        """测试代码分析"""
        # Safe code
        safe_code = "result = 2 + 2"
        analysis = safe_executor.analyze_code(safe_code)
        assert analysis["is_safe"] is True
        
        # Dangerous code
        dangerous_code = "import subprocess; subprocess.call(['rm', '-rf', '/'])"
        analysis = safe_executor.analyze_code(dangerous_code)
        assert analysis["is_safe"] is False
        assert len(analysis["issues"]) > 0


class TestLearningEngine:
    """学习引擎测试类"""
    
    @pytest.fixture
    def learning_engine(self):
        """创建学习引擎"""
        config = {
            "feedback_storage": "memory",
            "model_update_interval": 50,
            "success_threshold": 0.8
        }
        return ContinuousLearningEngine(config)
    
    @pytest.mark.asyncio
    async def test_record_feedback(self, learning_engine):
        """测试记录反馈"""
        feedback = {
            "request_id": "test-001",
            "task_type": "code_generation",
            "success": True,
            "user_rating": 4,
            "execution_time": 0.5,
            "code_quality": 0.8
        }
        
        # Act
        await learning_engine.record_feedback(feedback)
        
        # Assert
        assert len(learning_engine.feedback_history) == 1
        assert learning_engine.feedback_history[0]["request_id"] == "test-001"
    
    @pytest.mark.asyncio
    async def test_get_performance_metrics(self, learning_engine):
        """测试获取性能指标"""
        # Add some feedback data
        feedbacks = [
            {"success": True, "user_rating": 4, "execution_time": 0.5},
            {"success": True, "user_rating": 5, "execution_time": 0.3},
            {"success": False, "user_rating": 2, "execution_time": 1.0},
        ]
        
        for feedback in feedbacks:
            await learning_engine.record_feedback(feedback)
        
        # Act
        metrics = learning_engine.get_performance_metrics()
        
        # Assert
        assert metrics["success_rate"] == 2/3  # 2 out of 3 successful
        assert metrics["average_rating"] == 11/3  # (4+5+2)/3
        assert metrics["average_execution_time"] == 0.6  # (0.5+0.3+1.0)/3
    
    @pytest.mark.asyncio
    async def test_get_suggestions(self, learning_engine):
        """测试获取改进建议"""
        # Add feedback with low ratings
        poor_feedbacks = [
            {"success": False, "user_rating": 2, "common_error": "syntax_error"},
            {"success": False, "user_rating": 1, "common_error": "logic_error"},
        ]
        
        for feedback in poor_feedbacks:
            await learning_engine.record_feedback(feedback)
        
        # Act
        suggestions = await learning_engine.get_suggestions()
        
        # Assert
        assert len(suggestions) > 0
        assert any("error" in suggestion.lower() for suggestion in suggestions)


@pytest.mark.performance
class TestIntelligentAdapterPerformance:
    """智能适配器性能测试"""
    
    @pytest.mark.asyncio
    async def test_code_generation_performance(self, intelligent_adapter):
        """测试代码生成性能"""
        await intelligent_adapter.initialize()
        
        # Act
        start_time = asyncio.get_event_loop().time()
        
        input_data = {
            "task": "code_generation",
            "description": "Generate a sorting algorithm",
            "requirements": ["efficient", "readable"]
        }
        context = ExecutionContext(request_id="perf-gen")
        result = await intelligent_adapter.process(input_data, context)
        
        end_time = asyncio.get_event_loop().time()
        generation_time = end_time - start_time
        
        # Assert
        assert result.status == "success"
        assert generation_time < 3.0  # 应在3秒内完成
    
    @pytest.mark.asyncio
    async def test_execution_performance(self, intelligent_adapter):
        """测试代码执行性能"""
        await intelligent_adapter.initialize()
        
        # Act
        start_time = asyncio.get_event_loop().time()
        
        input_data = {
            "task": "code_execution",
            "code": "result = sum(range(10000))",  # 计算密集型任务
            "inputs": {}
        }
        context = ExecutionContext(request_id="perf-exec")
        result = await intelligent_adapter.process(input_data, context)
        
        end_time = asyncio.get_event_loop().time()
        execution_time = end_time - start_time
        
        # Assert
        assert result.status == "success"
        assert execution_time < 2.0  # 应在2秒内完成
    
    @pytest.mark.asyncio
    async def test_memory_usage(self, intelligent_adapter):
        """测试内存使用"""
        import psutil
        import os
        
        await intelligent_adapter.initialize()
        
        # Measure initial memory
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Process multiple requests
        for i in range(50):
            input_data = {
                "task": "code_generation",
                "description": f"Generate function {i}",
                "requirements": []
            }
            context = ExecutionContext(request_id=f"memory-{i}")
            await intelligent_adapter.process(input_data, context)
        
        # Measure final memory
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Assert
        assert memory_increase < 100  # 内存增长应小于100MB

# -*- coding: utf-8 -*-
"""
测试辅助工具模块
提供测试中常用的工具函数和类
"""
import asyncio
import json
import time
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Callable, Awaitable
from datetime import datetime, timezone
from unittest.mock import Mock, AsyncMock, MagicMock
from contextlib import asynccontextmanager, contextmanager

import pytest


class MockFactory:
    """Mock对象工厂"""
    
    @staticmethod
    def create_chat_message(
        role: str = "user",
        content: str = "Test message",
        **kwargs
    ) -> Dict[str, Any]:
        """创建聊天消息"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        message.update(kwargs)
        return message
    
    @staticmethod
    def create_chat_request(
        messages: Optional[List[Dict[str, Any]]] = None,
        model: str = "test-model",
        **kwargs
    ) -> Dict[str, Any]:
        """创建聊天请求"""
        if messages is None:
            messages = [MockFactory.create_chat_message()]
        
        request = {
            "messages": messages,
            "model": model,
            "temperature": 0.7,
            "max_tokens": 100,
            "stream": False
        }
        request.update(kwargs)
        return request
    
    @staticmethod
    def create_chat_response(
        content: str = "Test response",
        model: str = "test-model",
        **kwargs
    ) -> Dict[str, Any]:
        """创建聊天响应"""
        response = {
            "id": f"test-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": len(content.split()),
                "total_tokens": 10 + len(content.split())
            }
        }
        response.update(kwargs)
        return response
    
    @staticmethod
    def create_adapter_info(
        name: str = "test-adapter",
        path: str = "/test/adapter.bin",
        **kwargs
    ) -> Dict[str, Any]:
        """创建适配器信息"""
        info = {
            "name": name,
            "path": path,
            "size": 1024 * 1024 * 1024,  # 1GB
            "version": "1.0.0",
            "status": "loaded",
            "load_time": datetime.now(timezone.utc).isoformat(),
            "memory_usage": 512 * 1024 * 1024,  # 512MB
            "config": {
                "temperature": 0.8,
                "top_p": 0.9
            }
        }
        info.update(kwargs)
        return info
    
    @staticmethod
    def create_health_response(
        status: str = "healthy",
        **kwargs
    ) -> Dict[str, Any]:
        """创建健康检查响应"""
        response = {
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": 3600.0,
            "version": "1.0.0"
        }
        response.update(kwargs)
        return response
    
    @staticmethod
    def create_error_response(
        message: str = "Test error",
        error_type: str = "TestError",
        **kwargs
    ) -> Dict[str, Any]:
        """创建错误响应"""
        response = {
            "error": {
                "message": message,
                "type": error_type,
                "code": "TEST_ERROR"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        response.update(kwargs)
        return response


class AsyncMockManager:
    """异步Mock管理器"""
    
    def __init__(self):
        self.mocks = {}
    
    def create_async_mock(
        self,
        name: str,
        return_value: Any = None,
        side_effect: Optional[Union[Exception, Callable]] = None
    ) -> AsyncMock:
        """创建异步Mock"""
        mock = AsyncMock()
        
        if return_value is not None:
            mock.return_value = return_value
        
        if side_effect is not None:
            mock.side_effect = side_effect
        
        self.mocks[name] = mock
        return mock
    
    def get_mock(self, name: str) -> Optional[AsyncMock]:
        """获取Mock"""
        return self.mocks.get(name)
    
    def reset_all(self):
        """重置所有Mock"""
        for mock in self.mocks.values():
            mock.reset_mock()
    
    def assert_called(self, name: str, times: Optional[int] = None):
        """断言Mock被调用"""
        mock = self.get_mock(name)
        assert mock is not None, f"Mock {name} not found"
        
        if times is None:
            mock.assert_called()
        else:
            assert mock.call_count == times, f"Expected {times} calls, got {mock.call_count}"


class FileManager:
    """文件管理器"""
    
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(tempfile.gettempdir())
        self.created_files = []
        self.created_dirs = []
    
    def create_temp_file(
        self,
        content: str = "",
        suffix: str = ".txt",
        encoding: str = "utf-8"
    ) -> Path:
        """创建临时文件"""
        temp_file = self.base_dir / f"test_{uuid.uuid4().hex[:8]}{suffix}"
        temp_file.write_text(content, encoding=encoding)
        self.created_files.append(temp_file)
        return temp_file
    
    def create_temp_json_file(self, data: Dict[str, Any]) -> Path:
        """创建临时JSON文件"""
        content = json.dumps(data, indent=2, ensure_ascii=False)
        return self.create_temp_file(content, ".json")
    
    def create_temp_dir(self) -> Path:
        """创建临时目录"""
        temp_dir = self.base_dir / f"test_dir_{uuid.uuid4().hex[:8]}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        self.created_dirs.append(temp_dir)
        return temp_dir
    
    def cleanup(self):
        """清理创建的文件和目录"""
        for file_path in self.created_files:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass
        
        for dir_path in self.created_dirs:
            try:
                if dir_path.exists():
                    shutil.rmtree(dir_path)
            except Exception:
                pass
        
        self.created_files.clear()
        self.created_dirs.clear()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()


class PerformanceTimer:
    """性能计时器"""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.measurements = []
    
    def start(self):
        """开始计时"""
        self.start_time = time.perf_counter()
    
    def stop(self) -> float:
        """停止计时并返回耗时"""
        if self.start_time is None:
            raise ValueError("Timer not started")
        
        self.end_time = time.perf_counter()
        elapsed = self.end_time - self.start_time
        self.measurements.append(elapsed)
        return elapsed
    
    def measure(self, func: Callable, *args, **kwargs) -> tuple[Any, float]:
        """测量函数执行时间"""
        self.start()
        
        if asyncio.iscoroutinefunction(func):
            result = asyncio.run(func(*args, **kwargs))
        else:
            result = func(*args, **kwargs)
        
        elapsed = self.stop()
        return result, elapsed
    
    @contextmanager
    def timing(self):
        """计时上下文管理器"""
        self.start()
        try:
            yield self
        finally:
            self.stop()
    
    @asynccontextmanager
    async def async_timing(self):
        """异步计时上下文管理器"""
        self.start()
        try:
            yield self
        finally:
            self.stop()
    
    def get_stats(self) -> Dict[str, float]:
        """获取统计信息"""
        if not self.measurements:
            return {}
        
        import statistics
        
        return {
            "count": len(self.measurements),
            "total": sum(self.measurements),
            "average": statistics.mean(self.measurements),
            "median": statistics.median(self.measurements),
            "min": min(self.measurements),
            "max": max(self.measurements),
            "std_dev": statistics.stdev(self.measurements) if len(self.measurements) > 1 else 0
        }
    
    def reset(self):
        """重置计时器"""
        self.start_time = None
        self.end_time = None
        self.measurements.clear()


class ResponseValidator:
    """响应验证器"""
    
    @staticmethod
    def validate_chat_response(response: Dict[str, Any]) -> bool:
        """验证聊天响应格式"""
        required_fields = ["id", "object", "created", "model", "choices"]
        
        for field in required_fields:
            if field not in response:
                raise AssertionError(f"Missing required field: {field}")
        
        if not isinstance(response["choices"], list) or len(response["choices"]) == 0:
            raise AssertionError("choices must be a non-empty list")
        
        choice = response["choices"][0]
        choice_fields = ["index", "message", "finish_reason"]
        
        for field in choice_fields:
            if field not in choice:
                raise AssertionError(f"Missing choice field: {field}")
        
        message = choice["message"]
        message_fields = ["role", "content"]
        
        for field in message_fields:
            if field not in message:
                raise AssertionError(f"Missing message field: {field}")
        
        return True
    
    @staticmethod
    def validate_error_response(response: Dict[str, Any]) -> bool:
        """验证错误响应格式"""
        if "error" not in response and "detail" not in response:
            raise AssertionError("Error response must contain 'error' or 'detail' field")
        
        if "error" in response:
            error = response["error"]
            if not isinstance(error, dict):
                raise AssertionError("error field must be a dict")
            
            if "message" not in error:
                raise AssertionError("error must contain 'message' field")
        
        return True
    
    @staticmethod
    def validate_health_response(response: Dict[str, Any]) -> bool:
        """验证健康检查响应格式"""
        required_fields = ["status", "timestamp"]
        
        for field in required_fields:
            if field not in response:
                raise AssertionError(f"Missing required field: {field}")
        
        valid_statuses = ["healthy", "unhealthy", "degraded"]
        if response["status"] not in valid_statuses:
            raise AssertionError(f"Invalid status: {response['status']}")
        
        return True
    
    @staticmethod
    def validate_adapter_info(info: Dict[str, Any]) -> bool:
        """验证适配器信息格式"""
        required_fields = ["name", "path", "size", "status"]
        
        for field in required_fields:
            if field not in info:
                raise AssertionError(f"Missing required field: {field}")
        
        if not isinstance(info["size"], (int, float)) or info["size"] < 0:
            raise AssertionError("size must be a non-negative number")
        
        valid_statuses = ["loaded", "unloaded", "loading", "error"]
        if info["status"] not in valid_statuses:
            raise AssertionError(f"Invalid status: {info['status']}")
        
        return True


class AsyncTestHelper:
    """异步测试辅助器"""
    
    @staticmethod
    async def wait_for_condition(
        condition: Callable[[], Union[bool, Awaitable[bool]]],
        timeout: float = 5.0,
        interval: float = 0.1,
        error_message: str = "Condition not met within timeout"
    ) -> bool:
        """等待条件满足"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                if asyncio.iscoroutinefunction(condition):
                    result = await condition()
                else:
                    result = condition()
                
                if result:
                    return True
            except Exception:
                pass  # 忽略条件检查中的异常
            
            await asyncio.sleep(interval)
        
        raise TimeoutError(error_message)
    
    @staticmethod
    async def run_with_timeout(
        coro: Awaitable,
        timeout: float = 5.0,
        error_message: str = "Operation timed out"
    ):
        """运行协程并设置超时"""
        try:
            return await asyncio.wait_for(coro, timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(error_message)
    
    @staticmethod
    async def gather_with_concurrency_limit(
        *coroutines,
        limit: int = 10
    ) -> List[Any]:
        """并发运行协程但限制并发数"""
        semaphore = asyncio.Semaphore(limit)
        
        async def limited_coro(coro):
            async with semaphore:
                return await coro
        
        limited_coroutines = [limited_coro(coro) for coro in coroutines]
        return await asyncio.gather(*limited_coroutines)


class DataGenerator:
    """测试数据生成器"""
    
    @staticmethod
    def generate_random_string(length: int = 10) -> str:
        """生成随机字符串"""
        import random
        import string
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    
    @staticmethod
    def generate_chat_messages(count: int = 5) -> List[Dict[str, Any]]:
        """生成聊天消息列表"""
        messages = []
        roles = ["user", "assistant"]
        
        for i in range(count):
            role = roles[i % 2]
            content = f"Test message {i + 1}: {DataGenerator.generate_random_string(20)}"
            
            message = MockFactory.create_chat_message(role=role, content=content)
            messages.append(message)
        
        return messages
    
    @staticmethod
    def generate_large_text(size_kb: int = 1) -> str:
        """生成大文本"""
        text_block = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 10
        target_size = size_kb * 1024
        current_size = len(text_block.encode('utf-8'))
        
        if current_size < target_size:
            repeat_count = target_size // current_size + 1
            text_block = text_block * repeat_count
        
        return text_block[:target_size]
    
    @staticmethod
    def generate_performance_test_data(
        num_requests: int = 100,
        message_size_range: tuple = (10, 100)
    ) -> List[Dict[str, Any]]:
        """生成性能测试数据"""
        import random
        
        requests = []
        for i in range(num_requests):
            message_size = random.randint(*message_size_range)
            content = DataGenerator.generate_random_string(message_size)
            
            request = MockFactory.create_chat_request(
                messages=[MockFactory.create_chat_message(content=content)],
                model=f"test-model-{i % 3}"  # 使用不同的模型
            )
            requests.append(request)
        
        return requests


class TestAssertions:
    """测试断言工具"""
    
    @staticmethod
    def assert_response_time(actual_time: float, max_time: float):
        """断言响应时间"""
        assert actual_time <= max_time, f"Response time {actual_time:.3f}s exceeds maximum {max_time:.3f}s"
    
    @staticmethod
    def assert_throughput(actual_throughput: float, min_throughput: float):
        """断言吞吐量"""
        assert actual_throughput >= min_throughput, f"Throughput {actual_throughput:.2f} req/s below minimum {min_throughput:.2f} req/s"
    
    @staticmethod
    def assert_error_rate(error_count: int, total_count: int, max_error_rate: float):
        """断言错误率"""
        actual_error_rate = error_count / total_count if total_count > 0 else 0
        assert actual_error_rate <= max_error_rate, f"Error rate {actual_error_rate:.3f} exceeds maximum {max_error_rate:.3f}"
    
    @staticmethod
    def assert_memory_usage(current_mb: float, max_increase_mb: float, initial_mb: float = 0):
        """断言内存使用"""
        increase = current_mb - initial_mb
        assert increase <= max_increase_mb, f"Memory increase {increase:.1f}MB exceeds maximum {max_increase_mb:.1f}MB"
    
    @staticmethod
    def assert_json_structure(data: Dict[str, Any], expected_structure: Dict[str, type]):
        """断言JSON结构"""
        for key, expected_type in expected_structure.items():
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], expected_type), f"Key {key} should be {expected_type}, got {type(data[key])}"


# 便捷函数
def create_mock_factory() -> MockFactory:
    """创建Mock工厂"""
    return MockFactory()


def create_file_manager(base_dir: Optional[Path] = None) -> FileManager:
    """创建文件管理器"""
    return FileManager(base_dir)


def create_performance_timer() -> PerformanceTimer:
    """创建性能计时器"""
    return PerformanceTimer()


def create_async_mock_manager() -> AsyncMockManager:
    """创建异步Mock管理器"""
    return AsyncMockManager()


# 装饰器
def with_timeout(timeout: float = 5.0):
    """超时装饰器"""
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                return await AsyncTestHelper.run_with_timeout(
                    func(*args, **kwargs),
                    timeout=timeout,
                    error_message=f"Test {func.__name__} timed out after {timeout}s"
                )
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                import signal
                
                def timeout_handler(signum, frame):
                    raise TimeoutError(f"Test {func.__name__} timed out after {timeout}s")
                
                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(int(timeout))
                
                try:
                    return func(*args, **kwargs)
                finally:
                    signal.alarm(0)
                    signal.signal(signal.SIGALRM, old_handler)
            
            return sync_wrapper
    
    return decorator


def performance_test(
    max_response_time: float = 1.0,
    min_throughput: Optional[float] = None,
    max_memory_increase: Optional[float] = None
):
    """性能测试装饰器"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            timer = PerformanceTimer()
            
            # 测量执行时间
            result, elapsed_time = timer.measure(func, *args, **kwargs)
            
            # 检查响应时间
            TestAssertions.assert_response_time(elapsed_time, max_response_time)
            
            # 如果指定了吞吐量要求，进行检查
            if min_throughput is not None:
                actual_throughput = 1.0 / elapsed_time
                TestAssertions.assert_throughput(actual_throughput, min_throughput)
            
            return result
        
        return wrapper
    
    return decorator

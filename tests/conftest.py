# -*- coding: utf-8 -*-
"""
Pytest配置文件
定义全局fixtures、测试配置和工具函数
"""
import pytest
import asyncio
import tempfile
import shutil
import os
import sys
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List, Optional

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 测试配置
pytest_plugins = ["pytest_asyncio"]


def pytest_configure(config):
    """Pytest配置"""
    # 注册自定义标记
    config.addinivalue_line("markers", "unit: 单元测试")
    config.addinivalue_line("markers", "integration: 集成测试")
    config.addinivalue_line("markers", "performance: 性能测试")
    config.addinivalue_line("markers", "api: API测试")
    config.addinivalue_line("markers", "core: 核心功能测试")
    config.addinivalue_line("markers", "slow: 慢速测试")
    config.addinivalue_line("markers", "gpu: 需要GPU的测试")
    config.addinivalue_line("markers", "network: 需要网络的测试")


def pytest_collection_modifyitems(config, items):
    """修改测试收集"""
    # 为没有标记的测试添加默认标记
    for item in items:
        if not any(item.iter_markers()):
            item.add_marker(pytest.mark.unit)
        
        # 为性能测试添加慢速标记
        if item.get_closest_marker("performance"):
            item.add_marker(pytest.mark.slow)


# ============================================================================
# 全局Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_config():
    """测试配置"""
    return {
        "TESTING": True,
        "LOG_LEVEL": "DEBUG",
        "API_HOST": "127.0.0.1",
        "API_PORT": 8000,
        "CORS_ORIGINS": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "MAX_REQUEST_SIZE": 10 * 1024 * 1024,  # 10MB
        "REQUEST_TIMEOUT": 30.0,
        "ADAPTERS_DIR": "./test_adapters",
        "MODELS_DIR": "./test_models",
        "CACHE_DIR": "./test_cache",
        "LOG_DIR": "./test_logs"
    }


@pytest.fixture(scope="session")
def temp_dir():
    """临时目录"""
    temp_path = tempfile.mkdtemp(prefix="zishu_test_")
    yield Path(temp_path)
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture
def mock_logger():
    """模拟日志器"""
    logger = Mock()
    logger.debug = Mock()
    logger.info = Mock()
    logger.warning = Mock()
    logger.error = Mock()
    logger.critical = Mock()
    return logger


# ============================================================================
# API测试Fixtures
# ============================================================================

@pytest.fixture
def mock_model_manager():
    """模拟模型管理器"""
    manager = Mock()
    
    # 基本属性
    manager.is_model_loaded.return_value = True
    manager.current_model = "test-model"
    manager.loaded_adapters = {"test-adapter": {"status": "loaded"}}
    
    # 异步方法
    async def mock_generate_response(messages, **kwargs):
        return {
            "content": "Mock response",
            "usage": {"total_tokens": 25},
            "model": kwargs.get("model", "test-model")
        }
    
    async def mock_generate_stream_response(messages, **kwargs):
        chunks = [
            {"delta": {"content": "Mock"}, "finish_reason": None},
            {"delta": {"content": " stream"}, "finish_reason": None},
            {"delta": {"content": " response"}, "finish_reason": "stop"}
        ]
        for chunk in chunks:
            yield chunk
    
    async def mock_load_adapter(adapter_path, **kwargs):
        return {
            "success": True,
            "adapter_name": "test-adapter",
            "message": "Adapter loaded successfully"
        }
    
    async def mock_unload_adapter(adapter_name, **kwargs):
        return {
            "success": True,
            "message": f"Adapter {adapter_name} unloaded successfully"
        }
    
    manager.generate_response = AsyncMock(side_effect=mock_generate_response)
    manager.generate_stream_response = AsyncMock(side_effect=mock_generate_stream_response)
    manager.load_adapter = AsyncMock(side_effect=mock_load_adapter)
    manager.unload_adapter = AsyncMock(side_effect=mock_unload_adapter)
    manager.get_memory_usage = Mock(return_value={
        "total": 8 * 1024 * 1024 * 1024,
        "used": 4 * 1024 * 1024 * 1024,
        "available": 4 * 1024 * 1024 * 1024
    })
    
    return manager


@pytest.fixture
def mock_health_checker():
    """模拟健康检查器"""
    checker = Mock()
    
    checker.check_basic_health.return_value = {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z",
        "uptime_seconds": 3600.0,
        "version": "1.0.0"
    }
    
    checker.check_deep_health.return_value = {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z",
        "uptime_seconds": 3600.0,
        "version": "1.0.0",
        "components": [
            {
                "name": "database",
                "status": "healthy",
                "response_time_ms": 25.0
            },
            {
                "name": "model_service",
                "status": "healthy",
                "response_time_ms": 50.0
            }
        ],
        "system_metrics": {
            "cpu_percent": 45.0,
            "memory_percent": 60.0,
            "disk_percent": 70.0
        }
    }
    
    return checker


@pytest.fixture
def sample_chat_request():
    """示例聊天请求"""
    return {
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ],
        "model": "test-model",
        "temperature": 0.7,
        "max_tokens": 100,
        "stream": False
    }


@pytest.fixture
def sample_chat_response():
    """示例聊天响应"""
    return {
        "id": "test-chat-123",
        "object": "chat.completion",
        "created": 1640995200,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! I'm doing well, thank you for asking."
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 15,
            "total_tokens": 27
        }
    }


# ============================================================================
# 核心功能测试Fixtures
# ============================================================================

@pytest.fixture
def mock_adapter():
    """模拟适配器"""
    adapter = Mock()
    adapter.name = "test-adapter"
    adapter.path = "/test/adapter.bin"
    adapter.size = 1024 * 1024 * 1024  # 1GB
    adapter.version = "1.0.0"
    adapter.status = "loaded"
    adapter.config = {"temperature": 0.8, "top_p": 0.9}
    
    # 异步方法
    async def mock_load():
        adapter.status = "loaded"
        return True
    
    async def mock_unload():
        adapter.status = "unloaded"
        return True
    
    async def mock_generate(prompt, **kwargs):
        return f"Generated response for: {prompt[:50]}..."
    
    adapter.load = AsyncMock(side_effect=mock_load)
    adapter.unload = AsyncMock(side_effect=mock_unload)
    adapter.generate = AsyncMock(side_effect=mock_generate)
    
    return adapter


@pytest.fixture
def mock_database():
    """模拟数据库"""
    db = Mock()
    
    # 基本操作
    async def mock_connect():
        return True
    
    async def mock_disconnect():
        return True
    
    async def mock_execute(query, *args):
        return {"affected_rows": 1}
    
    async def mock_fetch_one(query, *args):
        return {"id": 1, "name": "test"}
    
    async def mock_fetch_all(query, *args):
        return [{"id": 1, "name": "test1"}, {"id": 2, "name": "test2"}]
    
    db.connect = AsyncMock(side_effect=mock_connect)
    db.disconnect = AsyncMock(side_effect=mock_disconnect)
    db.execute = AsyncMock(side_effect=mock_execute)
    db.fetch_one = AsyncMock(side_effect=mock_fetch_one)
    db.fetch_all = AsyncMock(side_effect=mock_fetch_all)
    
    return db


# ============================================================================
# 测试工具函数
# ============================================================================

class TestUtils:
    """测试工具类"""
    
    @staticmethod
    def create_temp_file(content: str, suffix: str = ".txt", temp_dir: Optional[Path] = None) -> Path:
        """创建临时文件"""
        if temp_dir is None:
            temp_dir = Path(tempfile.gettempdir())
        
        temp_file = temp_dir / f"test_{os.getpid()}_{suffix}"
        temp_file.write_text(content, encoding="utf-8")
        return temp_file
    
    @staticmethod
    def create_temp_json_file(data: Dict[str, Any], temp_dir: Optional[Path] = None) -> Path:
        """创建临时JSON文件"""
        import json
        content = json.dumps(data, indent=2, ensure_ascii=False)
        return TestUtils.create_temp_file(content, ".json", temp_dir)
    
    @staticmethod
    def assert_response_format(response_data: Dict[str, Any], required_fields: List[str]):
        """断言响应格式"""
        for field in required_fields:
            assert field in response_data, f"Missing required field: {field}"
    
    @staticmethod
    def assert_chat_response_format(response_data: Dict[str, Any]):
        """断言聊天响应格式"""
        required_fields = ["id", "object", "created", "model", "choices"]
        TestUtils.assert_response_format(response_data, required_fields)
        
        assert isinstance(response_data["choices"], list)
        assert len(response_data["choices"]) > 0
        
        choice = response_data["choices"][0]
        choice_fields = ["index", "message", "finish_reason"]
        TestUtils.assert_response_format(choice, choice_fields)
        
        message = choice["message"]
        message_fields = ["role", "content"]
        TestUtils.assert_response_format(message, message_fields)
    
    @staticmethod
    def assert_error_response_format(response_data: Dict[str, Any]):
        """断言错误响应格式"""
        assert "error" in response_data or "detail" in response_data
        
        if "error" in response_data:
            error = response_data["error"]
            assert "message" in error
            assert "type" in error
    
    @staticmethod
    async def wait_for_condition(condition_func, timeout: float = 5.0, interval: float = 0.1):
        """等待条件满足"""
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if await condition_func() if asyncio.iscoroutinefunction(condition_func) else condition_func():
                return True
            await asyncio.sleep(interval)
        
        return False
    
    @staticmethod
    def measure_execution_time(func, *args, **kwargs):
        """测量执行时间"""
        import time
        start_time = time.time()
        
        if asyncio.iscoroutinefunction(func):
            # 异步函数需要在事件循环中运行
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(func(*args, **kwargs))
        else:
            result = func(*args, **kwargs)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        return result, execution_time
    
    @staticmethod
    def generate_test_data(data_type: str, count: int = 10) -> List[Dict[str, Any]]:
        """生成测试数据"""
        import uuid
        import random
        from datetime import datetime, timezone
        
        if data_type == "chat_messages":
            return [
                {
                    "role": random.choice(["user", "assistant"]),
                    "content": f"Test message {i}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                for i in range(count)
            ]
        
        elif data_type == "adapters":
            return [
                {
                    "name": f"test-adapter-{i}",
                    "path": f"/test/adapter_{i}.bin",
                    "size": random.randint(100*1024*1024, 2*1024*1024*1024),  # 100MB-2GB
                    "version": f"1.{i}.0",
                    "status": random.choice(["loaded", "unloaded", "loading"])
                }
                for i in range(count)
            ]
        
        elif data_type == "users":
            return [
                {
                    "id": str(uuid.uuid4()),
                    "username": f"testuser{i}",
                    "email": f"test{i}@example.com",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for i in range(count)
            ]
        
        else:
            raise ValueError(f"Unknown data type: {data_type}")


@pytest.fixture
def test_utils():
    """测试工具fixture"""
    return TestUtils


# ============================================================================
# 性能测试Fixtures
# ============================================================================

@pytest.fixture
def performance_config():
    """性能测试配置"""
    return {
        "max_response_time": 1.0,  # 最大响应时间(秒)
        "min_throughput": 10,      # 最小吞吐量(req/s)
        "max_memory_increase": 100,  # 最大内存增长(MB)
        "max_error_rate": 0.01,    # 最大错误率
        "load_test_duration": 30,  # 负载测试持续时间(秒)
        "concurrent_users": 10     # 并发用户数
    }


@pytest.fixture
def system_monitor():
    """系统监控器"""
    import psutil
    
    class SystemMonitor:
        def __init__(self):
            self.process = psutil.Process()
            self.initial_memory = self.process.memory_info().rss
            self.initial_cpu_time = self.process.cpu_times()
            self.start_time = time.time()
        
        def get_memory_usage(self):
            """获取内存使用情况"""
            current = self.process.memory_info().rss
            return {
                "current_mb": current / (1024 * 1024),
                "increase_mb": (current - self.initial_memory) / (1024 * 1024)
            }
        
        def get_cpu_usage(self):
            """获取CPU使用情况"""
            return self.process.cpu_percent(interval=0.1)
        
        def get_stats(self):
            """获取完整统计信息"""
            memory = self.get_memory_usage()
            cpu = self.get_cpu_usage()
            elapsed = time.time() - self.start_time
            
            return {
                "memory_mb": memory["current_mb"],
                "memory_increase_mb": memory["increase_mb"],
                "cpu_percent": cpu,
                "elapsed_seconds": elapsed
            }
    
    import time
    return SystemMonitor()


# ============================================================================
# 清理Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def cleanup_after_test():
    """测试后自动清理"""
    yield
    
    # 清理临时文件
    import tempfile
    import glob
    
    temp_pattern = os.path.join(tempfile.gettempdir(), "test_*")
    for temp_file in glob.glob(temp_pattern):
        try:
            if os.path.isfile(temp_file):
                os.unlink(temp_file)
            elif os.path.isdir(temp_file):
                shutil.rmtree(temp_file)
        except Exception:
            pass  # 忽略清理错误
    
    # 强制垃圾回收
    import gc
    gc.collect()


# ============================================================================
# 跳过条件
# ============================================================================

def pytest_runtest_setup(item):
    """测试运行前的设置"""
    # 检查GPU测试
    if item.get_closest_marker("gpu"):
        try:
            import torch
            if not torch.cuda.is_available():
                pytest.skip("需要GPU但CUDA不可用")
        except ImportError:
            pytest.skip("需要GPU但PyTorch未安装")
    
    # 检查网络测试
    if item.get_closest_marker("network"):
        import socket
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
        except OSError:
            pytest.skip("需要网络连接但网络不可用")
    
    # 检查慢速测试
    if item.get_closest_marker("slow"):
        if item.config.getoption("--fast-only", default=False):
            pytest.skip("跳过慢速测试")


def pytest_addoption(parser):
    """添加命令行选项"""
    parser.addoption(
        "--fast-only",
        action="store_true",
        default=False,
        help="只运行快速测试，跳过慢速测试"
    )
    
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="运行集成测试"
    )
    
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="运行性能测试"
    )
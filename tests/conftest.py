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
import torch

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
async def test_client():
    """测试客户端"""
    from fastapi.testclient import TestClient
    from zishu.api.main import create_app
    
    app = create_app()
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def adapter_registry():
    """适配器注册表"""
    from unittest.mock import Mock
    
    registry = Mock()
    registry.register_adapter = AsyncMock(return_value=True)
    registry.unregister_adapter = AsyncMock(return_value=True)
    registry.get_adapter = Mock(return_value=None)
    registry.list_adapters = Mock(return_value=[])
    registry.has_adapter = Mock(return_value=False)
    registry.execute_adapter = AsyncMock(return_value={"result": "success"})
    registry.health_check_adapter = AsyncMock(return_value={"status": "healthy"})
    
    return registry


@pytest.fixture
async def mock_model_manager():
    """模拟模型管理器"""
    from unittest.mock import Mock, AsyncMock
    
    manager = Mock()
    manager.is_model_loaded = Mock(return_value=True)
    manager.current_model = "test-model"
    manager.loaded_adapters = {"test-adapter": {"status": "loaded"}}
    
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
    
    manager.generate_response = AsyncMock(side_effect=mock_generate_response)
    manager.generate_stream_response = AsyncMock(side_effect=mock_generate_stream_response)
    manager.load_adapter = AsyncMock(return_value={"success": True})
    manager.unload_adapter = AsyncMock(return_value={"success": True})
    
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
def base_adapter_config():
    """基础适配器配置"""
    return {
        "adapter_id": "test-adapter",
        "name": "test_base_adapter",  # 修改为测试期望的名称
        "version": "1.0.0",
        "type": "base",  # 使用type字段，符合测试期望
        "adapter_type": "soft",  # 保留adapter_type用于其他地方
        "description": "测试基础适配器",
        "author": "test_author",
        "created_at": "2024-01-01T00:00:00Z",
        "parameters": {
            "learning_rate": 0.001,
            "batch_size": 8,
            "max_length": 512,
        },
        "requirements": {
            "torch": ">=2.0.0",
            "transformers": ">=4.30.0",
        }
    }


@pytest.fixture
def mock_base_adapter(base_adapter_config):
    """模拟基础适配器，包含所有必需的抽象方法实现"""
    from zishu.adapters.base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
    from zishu.adapters.base.metadata import AdapterMetadata, AdapterCapability, AdapterType
    from unittest.mock import AsyncMock, Mock
    from datetime import datetime
    
    # 创建一个具体的BaseAdapter实现类用于测试
    class MockBaseAdapter(BaseAdapter):
        def _load_metadata(self):
            from zishu.adapters.base.metadata import AdapterVersion
            return AdapterMetadata(
                adapter_id=self.adapter_id,
                name=self.name,
                version=AdapterVersion(
                    version=self.version,
                    release_date=datetime.now(),
                    changelog="Mock adapter for testing"
                ),
                adapter_type=AdapterType.SOFT,
                description="Mock adapter for testing",
                author="test_system"
            )
        
        async def _initialize_impl(self):
            return True
        
        async def _process_impl(self, input_data, context: ExecutionContext):
            return {"processed": True, "input": input_data}
        
        def _get_capabilities_impl(self):
            return [AdapterCapability.TEXT_GENERATION]
        
        async def _health_check_impl(self):
            return HealthCheckResult(
                is_healthy=True,
                status="healthy",
                checks={"mock_check": True}
            )
        
        async def _cleanup_impl(self):
            pass
    
    # 创建实例
    adapter = MockBaseAdapter(base_adapter_config)
    return adapter


@pytest.fixture
def adapter_manager():
    """适配器管理器"""
    from unittest.mock import AsyncMock, Mock
    
    manager = Mock()
    manager.load_adapter = AsyncMock(return_value=True)
    manager.unload_adapter = AsyncMock(return_value=True)
    manager.switch_adapter = AsyncMock(return_value=True)
    manager.list_adapters = AsyncMock(return_value=[])
    manager.get_adapter_info = AsyncMock(return_value={})
    manager.validate_adapter_config = AsyncMock(return_value=True)
    manager.batch_load_adapters = AsyncMock(return_value=True)
    manager.memory_usage_tracking = Mock(return_value={"used": 0, "total": 1000})
    manager.integrate_with_model = AsyncMock(return_value=True)
    
    return manager


@pytest.fixture
def mock_model():
    """模拟AI模型"""
    model = Mock()
    model.generate = AsyncMock(return_value=torch.tensor([[1, 2, 3, 4, 5]]))
    model.config = Mock()
    model.config.vocab_size = 50000
    model.device = torch.device("cpu")
    model.eval = Mock()
    model.to = Mock(return_value=model)
    model.load = AsyncMock(return_value=True)
    model.unload = AsyncMock(return_value=True)
    return model


@pytest.fixture
def mock_tokenizer():
    """模拟分词器"""
    tokenizer = Mock()
    tokenizer.encode = Mock(return_value=[1, 2, 3, 4, 5])
    tokenizer.decode = Mock(return_value="Mock response")
    tokenizer.vocab_size = 50000
    tokenizer.pad_token_id = 0
    tokenizer.eos_token_id = 2
    tokenizer.bos_token_id = 1
    return tokenizer


@pytest.fixture
def sample_lora_weights(temp_dir):
    """示例LoRA权重文件"""
    weights_file = temp_dir / "sample_lora.bin"
    
    # 创建一个模拟的权重文件
    dummy_weights = {
        "lora_A": torch.randn(128, 64),
        "lora_B": torch.randn(64, 128),
        "scaling": torch.tensor(0.5)
    }
    torch.save(dummy_weights, weights_file)
    return weights_file


@pytest.fixture
def sample_adapter_config():
    """示例适配器配置"""
    return {
        "adapter_id": "test_adapter",
        "name": "Test Adapter",
        "version": "1.0.0",
        "type": "lora",  # 使用type而不是adapter_type
        "description": "测试适配器配置",
        "author": "test_author",
        "created_at": "2024-01-01T00:00:00Z",
        # 将parameters中的字段提升到顶层
        "learning_rate": 0.001,
        "batch_size": 8,
        "max_length": 512,
        "rank": 8,
        "alpha": 32,
        "dropout": 0.05,
        "target_modules": ["q_proj", "v_proj"],
        "requirements": {
            "torch": ">=2.0.0",
            "transformers": ">=4.30.0"
        }
    }


@pytest.fixture
def mock_model():
    """模拟模型对象"""
    from unittest.mock import Mock
    import torch
    
    model = Mock()
    model.config = Mock()
    model.config.hidden_size = 768
    model.config.num_attention_heads = 12
    model.config.num_hidden_layers = 12
    model.config.vocab_size = 50257
    model.config.max_position_embeddings = 2048
    model.device = torch.device("cpu")
    model.dtype = torch.float32
    
    # 模拟模型方法
    def mock_forward(*args, **kwargs):
        # 返回模拟的输出
        batch_size = 1
        seq_len = 10
        hidden_size = model.config.hidden_size
        return Mock(
            last_hidden_state=torch.randn(batch_size, seq_len, hidden_size),
            logits=torch.randn(batch_size, seq_len, model.config.vocab_size)
        )
    
    model.forward = mock_forward
    model.__call__ = mock_forward
    
    return model


@pytest.fixture  
def mock_tokenizer():
    """模拟分词器对象"""
    from unittest.mock import Mock
    
    tokenizer = Mock()
    tokenizer.vocab_size = 50257
    tokenizer.pad_token_id = 0
    tokenizer.eos_token_id = 2
    tokenizer.bos_token_id = 1
    tokenizer.unk_token_id = 3
    tokenizer.model_max_length = 2048
    
    # 模拟编码方法
    def mock_encode(text, **kwargs):
        # 简单模拟：返回文本长度对应的token ids
        return list(range(len(text.split())))
    
    def mock_decode(token_ids, **kwargs):
        # 简单模拟：返回token数量对应的文本
        return " ".join([f"token_{i}" for i in token_ids])
    
    def mock_batch_encode_plus(texts, **kwargs):
        return {
            'input_ids': [[1, 2, 3, 4, 0] for _ in texts],
            'attention_mask': [[1, 1, 1, 1, 0] for _ in texts]
        }
    
    tokenizer.encode = mock_encode
    tokenizer.decode = mock_decode
    tokenizer.batch_encode_plus = mock_batch_encode_plus
    tokenizer.__call__ = mock_batch_encode_plus
    
    return tokenizer


@pytest.fixture
def mock_adapter():
    """模拟适配器对象"""
    from unittest.mock import Mock
    
    adapter = Mock()
    adapter.name = "test_adapter"
    adapter.adapter_type = "lora"
    adapter.is_loaded = False
    adapter.config = {
        "rank": 8,
        "alpha": 32,
        "dropout": 0.05
    }
    
    # 模拟适配器方法
    async def mock_load():
        adapter.is_loaded = True
        return True
    
    async def mock_unload():
        adapter.is_loaded = False
        return True
    
    async def mock_apply(model):
        return model
    
    adapter.load = mock_load
    adapter.unload = mock_unload
    adapter.apply = mock_apply
    
    return adapter


@pytest.fixture  
def mock_adapter_class():
    """模拟适配器类"""
    class MockAdapter:
        def __init__(self, config):
            self.config = config
            self.name = config.get("adapter_name", "mock_adapter")
            self.loaded = False
        
        async def load(self):
            self.loaded = True
            return True
            
        async def unload(self):
            self.loaded = False
            return True
            
        async def process(self, input_data, context):
            return f"Mock response for: {input_data}"
    
    return MockAdapter




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
    import time
    
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
    
    return SystemMonitor()


# ============================================================================
# 清理Fixtures
# ============================================================================

@pytest.fixture
def performance_monitor():
    """性能监控器fixture"""
    from unittest.mock import Mock
    
    monitor = Mock()
    monitor.start = Mock()
    monitor.stop = Mock(return_value={"duration": 0.5, "memory_mb": 100, "memory_used": 50 * 1024 * 1024})
    monitor.get_stats = Mock(return_value={
        "cpu_percent": 25.0,
        "memory_mb": 150.0,
        "duration": 0.3
    })
    return monitor

@pytest.fixture
def mock_inference_engine():
    """模拟推理引擎"""
    from unittest.mock import Mock, AsyncMock
    import torch
    
    engine = Mock()
    engine.testing_mode = True
    engine.device = torch.device("cpu")  # 返回实际的torch.device对象
    engine.max_length = 512
    engine.temperature = 0.7
    engine.top_p = 0.9
    engine.is_loaded = False
    
    # 模拟同步方法
    engine.generate_response = Mock(return_value={
        "content": "Test response",
        "usage": {"total_tokens": 25},
        "model": "test-model"
    })
    
    # 模拟异步方法
    async def mock_generate_async(messages, **kwargs):
        return {
            "content": "Test async response",
            "usage": {"total_tokens": 30},
            "model": kwargs.get("model", "test-model")
        }
    
    async def mock_generate_stream(messages, **kwargs):
        chunks = [
            {"delta": {"content": "Test"}, "finish_reason": None},
            {"delta": {"content": " stream"}, "finish_reason": None},
            {"delta": {"content": " response"}, "finish_reason": "stop"}
        ]
        for chunk in chunks:
            yield chunk
    
    engine.generate_response_async = AsyncMock(side_effect=mock_generate_async)
    engine.generate_stream_response = AsyncMock(side_effect=mock_generate_stream)
    
    return engine

@pytest.fixture
def mock_adapter_manager():
    """模拟适配器管理器"""
    from unittest.mock import Mock, AsyncMock
    
    manager = Mock()
    manager.load_adapter = AsyncMock(return_value=True)
    manager.unload_adapter = AsyncMock(return_value=True)
    manager.list_adapters = Mock(return_value=[])
    manager.get_adapter_info = Mock(return_value={"name": "test_adapter", "status": "loaded"})
    
    return manager

@pytest.fixture(autouse=True)
def setup_test_environment():
    """设置测试环境"""
    # 重置依赖注入系统
    from zishu.api.dependencies import reset_dependencies_for_testing
    reset_dependencies_for_testing()
    
    # 重置推理引擎
    try:
        from zishu.models.inference import reset_inference_engine
        reset_inference_engine()
    except ImportError:
        pass  # 如果模块不存在则忽略
    
    yield
    
    # 测试后清理
    reset_dependencies_for_testing()
    try:
        from zishu.models.inference import reset_inference_engine
        reset_inference_engine()
    except ImportError:
        pass

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


# ================================
# 适配器注册表相关Fixtures
# ================================

@pytest.fixture
def mock_registry():
    """模拟适配器注册表"""
    from unittest.mock import Mock
    
    class MockRegistry:
        def __init__(self):
            self.event_bus = Mock()
            self.event_bus.emit = Mock()
            self._call_count = 0
        
        def list_adapters(self):
            """同步方法，返回空列表"""
            self._call_count += 1
            return []
    
    return MockRegistry()


@pytest.fixture
def health_monitor(mock_registry):
    """健康监控器fixture（兼容性实现）"""
    from zishu.adapters.base import HealthMonitor
    monitor = HealthMonitor(registry=mock_registry)
    return monitor
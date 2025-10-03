"""
适配器管理器 - 新微服务架构版本

基于微服务架构的适配器管理器，使用服务协调器管理所有服务。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set, Type
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from .services.base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult
from .services.orchestrator import AdapterServiceOrchestrator, OrchestratorConfig
from .services.registry_service import AdapterRegistryService
from .services.validation_service import AdapterValidationService
from .services.health_service import AdapterHealthService
from .services.event_service import AdapterEventService
from .events import EventBus
from .types import (
    AdapterConfiguration, AdapterRegistration, AdapterIdentity,
    AdapterStatus, LifecycleState, EventType, Event, Priority
)
from ..base.adapter import BaseAdapter

logger = logging.getLogger(__name__)


class AdapterManagerConfig:
    """适配器管理器配置"""
    
    def __init__(
        self,
        max_adapters: int = 100,
        startup_timeout: float = 30.0,
        shutdown_timeout: float = 10.0,
        health_check_interval: float = 60.0,
        enable_auto_recovery: bool = True,
        enable_validation: bool = True,
        enable_metrics: bool = True,
        **kwargs
    ):
        self.max_adapters = max_adapters
        self.startup_timeout = startup_timeout
        self.shutdown_timeout = shutdown_timeout
        self.health_check_interval = health_check_interval
        self.enable_auto_recovery = enable_auto_recovery
        self.enable_validation = enable_validation
        self.enable_metrics = enable_metrics
        self.extra_config = kwargs


class AdapterManager:
    """
    适配器管理器 - 新微服务架构版本
    
    使用微服务架构管理适配器系统：
    - 服务协调器管理所有微服务
    - 注册服务处理适配器注册
    - 验证服务处理适配器验证
    - 健康服务监控适配器健康
    - 事件服务处理事件分发
    """
    
    def __init__(self, config: Optional[AdapterManagerConfig] = None):
        """初始化适配器管理器"""
        self.config = config or AdapterManagerConfig()
        
        # 服务协调器
        orchestrator_config = OrchestratorConfig(
            startup_timeout=self.config.startup_timeout,
            shutdown_timeout=self.config.shutdown_timeout,
            health_check_interval=self.config.health_check_interval,
            enable_auto_recovery=self.config.enable_auto_recovery,
            max_concurrent_starts=5,
            retry_attempts=3,
            retry_delay=1.0,
            dependency_check_interval=5.0
        )
        
        self._orchestrator = AdapterServiceOrchestrator(orchestrator_config)
        self._services: Dict[str, AsyncService] = {}
        self._adapters: Dict[str, BaseAdapter] = {}
        
        # 状态管理
        self._status = ServiceStatus.CREATED
        self._lock = asyncio.Lock()
        self._initialized = False
        
        logger.info("AdapterManager initialized with microservice architecture")
    
    @property
    def status(self) -> ServiceStatus:
        """获取管理器状态"""
        return self._status
    
    @property
    def is_running(self) -> bool:
        """检查管理器是否运行中"""
        return self._status == ServiceStatus.RUNNING
    
    @property
    def registry_service(self) -> AdapterRegistryService:
        """获取注册服务"""
        return self._services.get("registry")
    
    @property
    def validation_service(self) -> AdapterValidationService:
        """获取验证服务"""
        return self._services.get("validation")
    
    @property
    def health_service(self) -> AdapterHealthService:
        """获取健康服务"""
        return self._services.get("health")
    
    @property
    def event_service(self) -> AdapterEventService:
        """获取事件服务"""
        return self._services.get("events")
    
    async def initialize(self) -> None:
        """初始化管理器"""
        async with self._lock:
            if self._initialized:
                logger.warning("AdapterManager already initialized")
                return
            
            try:
                self._status = ServiceStatus.INITIALIZING
                logger.info("Initializing AdapterManager with microservice architecture...")
                
                # 创建事件总线
                event_bus = EventBus()
                
                # 创建核心服务
                event_service = AdapterEventService(
                    event_bus=event_bus,
                    config=self.config.extra_config.get('event_service', {})
                )
                
                registry_service = AdapterRegistryService(
                    event_bus=event_bus,
                    config=self.config.extra_config.get('registry_service', {
                        'max_registrations': self.config.max_adapters,
                        'enable_validation': self.config.enable_validation
                    })
                )
                
                validation_service = AdapterValidationService(
                    event_bus=event_bus,
                    config=self.config.extra_config.get('validation_service', {})
                )
                
                health_service = AdapterHealthService(
                    registry_service=registry_service,
                    event_bus=event_bus,
                    config=self.config.extra_config.get('health_service', {
                        'check_interval': self.config.health_check_interval,
                        'enable_metrics': self.config.enable_metrics
                    })
                )
                
                # 注册服务到协调器
                self._orchestrator.register_service(event_service)
                self._orchestrator.register_service(registry_service)
                self._orchestrator.register_service(validation_service)
                self._orchestrator.register_service(health_service)
                
                # 设置服务依赖关系
                self._orchestrator.add_dependency("adapter_registry", "adapter_events")
                self._orchestrator.add_dependency("adapter_validation", "adapter_events")
                self._orchestrator.add_dependency("adapter_health", "adapter_registry")
                self._orchestrator.add_dependency("adapter_health", "adapter_events")
                
                # 存储服务引用
                self._services = {
                    "events": event_service,
                    "registry": registry_service,
                    "validation": validation_service,
                    "health": health_service
                }
                
                # 初始化协调器
                await self._orchestrator.initialize()
                
                self._status = ServiceStatus.READY
                self._initialized = True
                
                logger.info("AdapterManager initialized successfully")
                
            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to initialize AdapterManager: {e}")
                raise
    
    async def start(self) -> None:
        """启动管理器"""
        async with self._lock:
            if not self._initialized:
                await self.initialize()
            
            if self._status == ServiceStatus.RUNNING:
                logger.warning("AdapterManager is already running")
                return
            
            try:
                logger.info("Starting AdapterManager...")
                
                # 启动所有服务
                await self._orchestrator.start_all()
                
                self._status = ServiceStatus.RUNNING
                logger.info("AdapterManager started successfully")
                
            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to start AdapterManager: {e}")
                raise
    
    async def stop(self) -> None:
        """停止管理器"""
        async with self._lock:
            if self._status == ServiceStatus.STOPPED:
                logger.warning("AdapterManager is already stopped")
                return
            
            try:
                self._status = ServiceStatus.STOPPING
                logger.info("Stopping AdapterManager...")
                
                # 停止所有适配器
                for adapter_id in list(self._adapters.keys()):
                    try:
                        await self.stop_adapter(adapter_id)
                    except Exception as e:
                        logger.error(f"Failed to stop adapter {adapter_id}: {e}")
                
                # 停止所有服务
                await self._orchestrator.stop_all()
                
                self._adapters.clear()
                self._services.clear()
                
                self._status = ServiceStatus.STOPPED
                logger.info("AdapterManager stopped successfully")
                
            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to stop AdapterManager: {e}")
                raise
    
    @asynccontextmanager
    async def lifecycle(self):
        """管理器生命周期上下文管理器"""
        try:
            await self.start()
            yield self
        finally:
            await self.stop()
    
    # 适配器管理方法
    
    async def register_adapter(self, config: AdapterConfiguration) -> bool:
        """注册适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running to register adapters")
        
        try:
            # 验证适配器配置
            if self.config.enable_validation:
                validation_result = await self.validation_service.validate_adapter_config(config)
                if not validation_result.is_valid:
                    logger.error(f"Adapter validation failed: {validation_result.summary}")
                    return False
            
            # 注册适配器
            success = await self.registry_service.register_adapter(config)
            
            if success:
                logger.info(f"Adapter {config.identity} registered successfully")
                
                # 发布注册事件
                await self.event_service.publish_event(
                    EventType.ADAPTER_REGISTERED,
                    {
                        'adapter_id': config.identity,
                        'config': config,
                        'timestamp': datetime.now(timezone.utc)
                    }
                )
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to register adapter {config.identity}: {e}")
            return False
    
    async def unregister_adapter(self, adapter_id: str) -> bool:
        """注销适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running to unregister adapters")
        
        try:
            # 先停止适配器（如果正在运行）
            if adapter_id in self._adapters:
                await self.stop_adapter(adapter_id)
            
            # 注销适配器
            success = await self.registry_service.unregister_adapter(adapter_id)
            
            if success:
                logger.info(f"Adapter {adapter_id} unregistered successfully")
                
                # 发布注销事件
                await self.event_service.publish_event(
                    EventType.ADAPTER_UNREGISTERED,
                    {
                        'adapter_id': adapter_id,
                        'timestamp': datetime.now(timezone.utc)
                    }
                )
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to unregister adapter {adapter_id}: {e}")
            return False
    
    async def start_adapter(self, adapter_id: str) -> bool:
        """启动适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running to start adapters")
        
        try:
            # 获取适配器注册信息
            registration = await self.registry_service.get_adapter(adapter_id)
            if not registration:
                logger.error(f"Adapter {adapter_id} not found")
                return False
            
            # 检查适配器是否已经在运行
            if adapter_id in self._adapters:
                logger.warning(f"Adapter {adapter_id} is already running")
                return True
            
            # 创建并启动适配器实例
            # 这里需要根据配置创建具体的适配器实例
            # 暂时使用占位符逻辑
            adapter = await self._create_adapter_instance(registration.configuration)
            
            if adapter:
                await adapter.start()
                self._adapters[adapter_id] = adapter
                
                # 更新注册状态
                await self.registry_service.update_adapter_status(
                    adapter_id, 
                    AdapterStatus.RUNNING
                )
                
                # 发布启动事件
                await self.event_service.publish_event(
                    EventType.ADAPTER_STARTED,
                    {
                        'adapter_id': adapter_id,
                        'timestamp': datetime.now(timezone.utc)
                    }
                )
                
                logger.info(f"Adapter {adapter_id} started successfully")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to start adapter {adapter_id}: {e}")
            return False
    
    async def stop_adapter(self, adapter_id: str) -> bool:
        """停止适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running to stop adapters")
        
        try:
            if adapter_id not in self._adapters:
                logger.warning(f"Adapter {adapter_id} is not running")
                return True
            
            adapter = self._adapters[adapter_id]
            await adapter.stop()
            del self._adapters[adapter_id]
            
            # 更新注册状态
            await self.registry_service.update_adapter_status(
                adapter_id,
                AdapterStatus.STOPPED
            )
            
            # 发布停止事件
            await self.event_service.publish_event(
                EventType.ADAPTER_STOPPED,
                {
                    'adapter_id': adapter_id,
                    'timestamp': datetime.now(timezone.utc)
                }
            )
            
            logger.info(f"Adapter {adapter_id} stopped successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop adapter {adapter_id}: {e}")
            return False
    
    async def restart_adapter(self, adapter_id: str) -> bool:
        """重启适配器"""
        try:
            await self.stop_adapter(adapter_id)
            return await self.start_adapter(adapter_id)
        except Exception as e:
            logger.error(f"Failed to restart adapter {adapter_id}: {e}")
            return False
    
    # 查询方法
    
    async def list_adapters(self) -> List[AdapterRegistration]:
        """列出所有适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self.registry_service.list_adapters()
    
    async def get_adapter(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """获取适配器信息"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self.registry_service.get_adapter(adapter_id)
    
    async def find_adapters_by_type(self, adapter_type: str) -> List[AdapterRegistration]:
        """按类型查找适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self.registry_service.find_adapters_by_type(adapter_type)
    
    async def find_adapters_by_capability(self, capability: str) -> List[AdapterRegistration]:
        """按能力查找适配器"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self.registry_service.find_adapters_by_capability(capability)
    
    # 健康和监控方法
    
    async def get_system_health(self) -> Dict[str, HealthCheckResult]:
        """获取系统健康状态"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self._orchestrator.get_service_health()
    
    async def get_adapter_health(self, adapter_id: str) -> Optional[HealthCheckResult]:
        """获取适配器健康状态"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        return await self.health_service.get_adapter_health(adapter_id)
    
    async def get_system_metrics(self) -> Dict[str, Any]:
        """获取系统指标"""
        if not self.is_running:
            raise RuntimeError("AdapterManager must be running")
        
        try:
            # 收集各服务的指标
            metrics = {
                'manager_status': self._status.value,
                'total_adapters': len(await self.list_adapters()),
                'running_adapters': len(self._adapters),
                'services': {}
            }
            
            # 收集服务健康状态
            service_health = await self.get_system_health()
            for service_name, health in service_health.items():
                metrics['services'][service_name] = {
                    'status': health.status.value,
                    'is_healthy': health.is_healthy,
                    'message': health.message
                }
            
            # 收集适配器健康指标
            if self.health_service:
                adapter_metrics = await self.health_service.get_system_metrics()
                metrics.update(adapter_metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {'error': str(e)}
    
    # 内部方法
    
    async def _create_adapter_instance(self, config: AdapterConfiguration) -> Optional[BaseAdapter]:
        """创建适配器实例"""
        # 这里应该根据配置创建具体的适配器实例
        # 暂时返回None，需要根据实际的适配器类型实现
        logger.warning(f"Adapter instance creation not implemented for {config.identity}")
        return None
    
    def __repr__(self) -> str:
        return f"<AdapterManager(status='{self._status}', services={len(self._services)}, adapters={len(self._adapters)})>"
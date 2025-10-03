"""
适配器注册表核心实现

提供适配器注册、发现和管理的核心功能。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set, Type, Any
from datetime import datetime, timezone
from collections import defaultdict

from ..types import (
    AdapterRegistration, AdapterIdentity, AdapterConfiguration,
    AdapterStatus, LifecycleState, EventType, Event, Priority
)
from ..events import EventBus
from .registration import RegistrationService
from .discovery import DiscoveryService
from .dependency import DependencyResolver

logger = logging.getLogger(__name__)


class AdapterRegistryCore:
    """
    适配器注册表核心实现
    
    负责适配器的注册、发现和基础管理功能。
    采用模块化设计，将不同职责分离到专门的服务中。
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None):
        """初始化注册表核心"""
        self._event_bus = event_bus
        self._registrations: Dict[str, AdapterRegistration] = {}
        self._lock = asyncio.Lock()
        
        # 初始化服务组件
        self._registration_service = RegistrationService(self)
        self._discovery_service = DiscoveryService(self)
        self._dependency_resolver = DependencyResolver(self)
        
        # 状态跟踪
        self._is_initialized = False
        self._is_running = False
        
        logger.info("AdapterRegistryCore initialized")
    
    async def initialize(self) -> None:
        """初始化注册表"""
        if self._is_initialized:
            return
        
        async with self._lock:
            if self._is_initialized:
                return
            
            try:
                # 初始化服务组件
                await self._registration_service.initialize()
                await self._discovery_service.initialize()
                await self._dependency_resolver.initialize()
                
                self._is_initialized = True
                logger.info("AdapterRegistryCore initialized successfully")
                
                # 发送初始化完成事件
                if self._event_bus:
                    await self._event_bus.emit(Event(
                        event_type=EventType.LIFECYCLE_STATE_CHANGED,
                        source="registry_core",
                        data={"state": "initialized"}
                    ))
                    
            except Exception as e:
                logger.error(f"Failed to initialize AdapterRegistryCore: {e}")
                raise
    
    async def start(self) -> None:
        """启动注册表"""
        if not self._is_initialized:
            await self.initialize()
        
        if self._is_running:
            return
        
        async with self._lock:
            if self._is_running:
                return
            
            try:
                # 启动服务组件
                await self._registration_service.start()
                await self._discovery_service.start()
                await self._dependency_resolver.start()
                
                self._is_running = True
                logger.info("AdapterRegistryCore started successfully")
                
                # 发送启动完成事件
                if self._event_bus:
                    await self._event_bus.emit(Event(
                        event_type=EventType.LIFECYCLE_STATE_CHANGED,
                        source="registry_core",
                        data={"state": "running"}
                    ))
                    
            except Exception as e:
                logger.error(f"Failed to start AdapterRegistryCore: {e}")
                raise
    
    async def stop(self) -> None:
        """停止注册表"""
        if not self._is_running:
            return
        
        async with self._lock:
            if not self._is_running:
                return
            
            try:
                # 停止服务组件
                await self._dependency_resolver.stop()
                await self._discovery_service.stop()
                await self._registration_service.stop()
                
                self._is_running = False
                logger.info("AdapterRegistryCore stopped successfully")
                
                # 发送停止完成事件
                if self._event_bus:
                    await self._event_bus.emit(Event(
                        event_type=EventType.LIFECYCLE_STATE_CHANGED,
                        source="registry_core",
                        data={"state": "stopped"}
                    ))
                    
            except Exception as e:
                logger.error(f"Failed to stop AdapterRegistryCore: {e}")
                raise
    
    async def register_adapter(
        self,
        identity: AdapterIdentity,
        adapter_class: Type,
        configuration: Optional[AdapterConfiguration] = None
    ) -> AdapterRegistration:
        """注册适配器"""
        if not self._is_running:
            raise RuntimeError("Registry is not running")
        
        return await self._registration_service.register_adapter(
            identity, adapter_class, configuration
        )
    
    async def unregister_adapter(self, adapter_id: str) -> bool:
        """注销适配器"""
        if not self._is_running:
            raise RuntimeError("Registry is not running")
        
        return await self._registration_service.unregister_adapter(adapter_id)
    
    def get_adapter(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """获取适配器注册信息"""
        return self._registrations.get(adapter_id)
    
    def has_adapter(self, adapter_id: str) -> bool:
        """检查适配器是否存在"""
        return adapter_id in self._registrations
    
    def list_adapters(
        self,
        adapter_type: Optional[str] = None,
        status: Optional[AdapterStatus] = None,
        tags: Optional[Set[str]] = None
    ) -> List[AdapterRegistration]:
        """列出适配器"""
        return self._discovery_service.list_adapters(
            adapter_type=adapter_type,
            status=status,
            tags=tags
        )
    
    def find_adapters(self, **criteria) -> List[AdapterRegistration]:
        """查找适配器"""
        return self._discovery_service.find_adapters(**criteria)
    
    async def resolve_dependencies(self, adapter_id: str) -> List[str]:
        """解析适配器依赖"""
        return await self._dependency_resolver.resolve_dependencies(adapter_id)
    
    async def check_circular_dependencies(self, adapter_id: str) -> bool:
        """检查循环依赖"""
        return await self._dependency_resolver.check_circular_dependencies(adapter_id)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取注册表统计信息"""
        total_count = len(self._registrations)
        status_counts = defaultdict(int)
        type_counts = defaultdict(int)
        
        for registration in self._registrations.values():
            status_counts[registration.status.value] += 1
            type_counts[registration.adapter_type.value] += 1
        
        return {
            'total_adapters': total_count,
            'status_distribution': dict(status_counts),
            'type_distribution': dict(type_counts),
            'is_running': self._is_running,
            'is_initialized': self._is_initialized,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    # 内部方法，供服务组件使用
    
    def _add_registration(self, registration: AdapterRegistration) -> None:
        """添加注册信息（内部使用）"""
        self._registrations[registration.adapter_id] = registration
    
    def _remove_registration(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """移除注册信息（内部使用）"""
        return self._registrations.pop(adapter_id, None)
    
    def _get_all_registrations(self) -> Dict[str, AdapterRegistration]:
        """获取所有注册信息（内部使用）"""
        return self._registrations.copy()
    
    def _update_registration_status(
        self,
        adapter_id: str,
        status: AdapterStatus,
        lifecycle_state: Optional[LifecycleState] = None
    ) -> None:
        """更新注册状态（内部使用）"""
        if adapter_id in self._registrations:
            registration = self._registrations[adapter_id]
            registration.status = status
            if lifecycle_state:
                registration.lifecycle_state = lifecycle_state
    
    async def _emit_event(self, event: Event) -> None:
        """发送事件（内部使用）"""
        if self._event_bus:
            await self._event_bus.emit(event)
    
    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._is_running
    
    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._is_initialized
    
    @property
    def registration_service(self) -> RegistrationService:
        """注册服务"""
        return self._registration_service
    
    @property
    def discovery_service(self) -> DiscoveryService:
        """发现服务"""
        return self._discovery_service
    
    @property
    def dependency_resolver(self) -> DependencyResolver:
        """依赖解析器"""
        return self._dependency_resolver

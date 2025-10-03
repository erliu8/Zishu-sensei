"""
适配器发现服务

负责适配器的查找和发现功能。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set, Any, Callable
from datetime import datetime, timezone

from ..types import (
    AdapterRegistration, AdapterStatus, AdapterType, LifecycleState
)

logger = logging.getLogger(__name__)


class DiscoveryService:
    """
    适配器发现服务
    
    负责提供适配器的查找和发现功能，包括：
    - 按条件查找适配器
    - 按标签过滤适配器
    - 按状态筛选适配器
    - 提供高级查询功能
    """
    
    def __init__(self, registry_core):
        """初始化发现服务"""
        self._registry_core = registry_core
        self._lock = asyncio.Lock()
        self._is_initialized = False
        self._is_running = False
        
        # 查询缓存
        self._query_cache: Dict[str, Any] = {}
        self._cache_ttl = 60  # 缓存TTL（秒）
        
        logger.info("DiscoveryService initialized")
    
    async def initialize(self) -> None:
        """初始化服务"""
        if self._is_initialized:
            return
        
        async with self._lock:
            if self._is_initialized:
                return
            
            self._is_initialized = True
            logger.info("DiscoveryService initialized successfully")
    
    async def start(self) -> None:
        """启动服务"""
        if not self._is_initialized:
            await self.initialize()
        
        if self._is_running:
            return
        
        async with self._lock:
            if self._is_running:
                return
            
            self._is_running = True
            logger.info("DiscoveryService started successfully")
    
    async def stop(self) -> None:
        """停止服务"""
        if not self._is_running:
            return
        
        async with self._lock:
            if not self._is_running:
                return
            
            # 清理缓存
            self._query_cache.clear()
            
            self._is_running = False
            logger.info("DiscoveryService stopped successfully")
    
    def list_adapters(
        self,
        adapter_type: Optional[str] = None,
        status: Optional[AdapterStatus] = None,
        tags: Optional[Set[str]] = None,
        lifecycle_state: Optional[LifecycleState] = None
    ) -> List[AdapterRegistration]:
        """
        列出适配器
        
        Args:
            adapter_type: 适配器类型过滤
            status: 状态过滤
            tags: 标签过滤
            lifecycle_state: 生命周期状态过滤
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        
        # 应用过滤器
        if adapter_type:
            registrations = [
                r for r in registrations 
                if r.adapter_type.value == adapter_type
            ]
        
        if status:
            registrations = [
                r for r in registrations 
                if r.status == status
            ]
        
        if lifecycle_state:
            registrations = [
                r for r in registrations 
                if r.lifecycle_state == lifecycle_state
            ]
        
        if tags:
            registrations = [
                r for r in registrations 
                if tags.issubset(r.identity.tags)
            ]
        
        return registrations
    
    def find_adapters(self, **criteria) -> List[AdapterRegistration]:
        """
        按条件查找适配器
        
        Args:
            **criteria: 查找条件
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        
        # 应用查找条件
        for key, value in criteria.items():
            registrations = self._apply_filter(registrations, key, value)
        
        return registrations
    
    def find_by_name(self, name: str, exact_match: bool = True) -> List[AdapterRegistration]:
        """
        按名称查找适配器
        
        Args:
            name: 适配器名称
            exact_match: 是否精确匹配
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        
        if exact_match:
            return [r for r in registrations if r.name == name]
        else:
            return [r for r in registrations if name.lower() in r.name.lower()]
    
    def find_by_tags(self, tags: Set[str], match_all: bool = True) -> List[AdapterRegistration]:
        """
        按标签查找适配器
        
        Args:
            tags: 标签集合
            match_all: 是否匹配所有标签
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        
        if match_all:
            return [r for r in registrations if tags.issubset(r.identity.tags)]
        else:
            return [r for r in registrations if tags.intersection(r.identity.tags)]
    
    def find_running_adapters(self) -> List[AdapterRegistration]:
        """
        查找正在运行的适配器
        
        Returns:
            List[AdapterRegistration]: 正在运行的适配器列表
        """
        return self.list_adapters(lifecycle_state=LifecycleState.RUNNING)
    
    def find_healthy_adapters(self) -> List[AdapterRegistration]:
        """
        查找健康的适配器
        
        Returns:
            List[AdapterRegistration]: 健康的适配器列表
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        return [r for r in registrations if r.is_healthy()]
    
    def find_by_type(self, adapter_type: AdapterType) -> List[AdapterRegistration]:
        """
        按类型查找适配器
        
        Args:
            adapter_type: 适配器类型
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        return self.list_adapters(adapter_type=adapter_type.value)
    
    def search_adapters(
        self,
        query: str,
        fields: Optional[List[str]] = None
    ) -> List[AdapterRegistration]:
        """
        搜索适配器
        
        Args:
            query: 搜索查询
            fields: 搜索字段列表
            
        Returns:
            List[AdapterRegistration]: 匹配的适配器列表
        """
        if not query:
            return []
        
        if fields is None:
            fields = ['name', 'description', 'tags']
        
        registrations = list(self._registry_core._get_all_registrations().values())
        results = []
        
        query_lower = query.lower()
        
        for registration in registrations:
            match = False
            
            # 搜索名称
            if 'name' in fields and query_lower in registration.name.lower():
                match = True
            
            # 搜索描述
            if 'description' in fields and registration.identity.description:
                if query_lower in registration.identity.description.lower():
                    match = True
            
            # 搜索标签
            if 'tags' in fields:
                for tag in registration.identity.tags:
                    if query_lower in tag.lower():
                        match = True
                        break
            
            # 搜索适配器ID
            if 'adapter_id' in fields and query_lower in registration.adapter_id.lower():
                match = True
            
            if match:
                results.append(registration)
        
        return results
    
    def get_adapter_count(self, **filters) -> int:
        """
        获取适配器数量
        
        Args:
            **filters: 过滤条件
            
        Returns:
            int: 适配器数量
        """
        if not filters:
            return len(self._registry_core._get_all_registrations())
        
        return len(self.find_adapters(**filters))
    
    def get_adapters_by_status(self) -> Dict[str, List[AdapterRegistration]]:
        """
        按状态分组获取适配器
        
        Returns:
            Dict[str, List[AdapterRegistration]]: 按状态分组的适配器
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        result = {}
        
        for registration in registrations:
            status = registration.status.value
            if status not in result:
                result[status] = []
            result[status].append(registration)
        
        return result
    
    def get_adapters_by_type(self) -> Dict[str, List[AdapterRegistration]]:
        """
        按类型分组获取适配器
        
        Returns:
            Dict[str, List[AdapterRegistration]]: 按类型分组的适配器
        """
        registrations = list(self._registry_core._get_all_registrations().values())
        result = {}
        
        for registration in registrations:
            adapter_type = registration.adapter_type.value
            if adapter_type not in result:
                result[adapter_type] = []
            result[adapter_type].append(registration)
        
        return result
    
    def _apply_filter(
        self,
        registrations: List[AdapterRegistration],
        key: str,
        value: Any
    ) -> List[AdapterRegistration]:
        """应用过滤条件"""
        if key == 'name':
            return [r for r in registrations if r.name == value]
        elif key == 'adapter_type':
            return [r for r in registrations if r.adapter_type.value == value]
        elif key == 'status':
            return [r for r in registrations if r.status == value]
        elif key == 'lifecycle_state':
            return [r for r in registrations if r.lifecycle_state == value]
        elif key == 'tags':
            if isinstance(value, (list, set)):
                tags = set(value)
                return [r for r in registrations if tags.issubset(r.identity.tags)]
            else:
                return [r for r in registrations if value in r.identity.tags]
        elif key == 'author':
            return [r for r in registrations if r.identity.author == value]
        elif key == 'version':
            return [r for r in registrations if r.identity.version == value]
        elif key == 'is_running':
            return [r for r in registrations if r.is_running() == value]
        elif key == 'is_healthy':
            return [r for r in registrations if r.is_healthy() == value]
        else:
            # 未知过滤条件，返回原列表
            logger.warning(f"Unknown filter key: {key}")
            return registrations
    
    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._is_running
    
    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._is_initialized

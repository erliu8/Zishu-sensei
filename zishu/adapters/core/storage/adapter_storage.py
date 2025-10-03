"""
适配器存储实现
提供适配器相关数据的存储管理功能
"""

import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import asyncio

from .interfaces import IAdapterStorage, IStorageBackend, StorageQuery
from ..models import AdapterRegistration, AdapterConfiguration, AdapterIdentity


class AdapterStorage(IAdapterStorage):
    """适配器存储实现"""
    
    # 集合名称常量
    REGISTRATIONS_COLLECTION = "adapter_registrations"
    CONFIGURATIONS_COLLECTION = "adapter_configurations"
    STATES_COLLECTION = "adapter_states"
    METRICS_COLLECTION = "adapter_metrics"
    
    def __init__(self, backend: IStorageBackend):
        self.backend = backend
        self._initialized = False
    
    async def initialize(self) -> bool:
        """初始化存储"""
        if self._initialized:
            return True
        
        try:
            # 创建必要的索引
            await self._create_indexes()
            self._initialized = True
            return True
        except Exception:
            return False
    
    async def _create_indexes(self) -> None:
        """创建索引"""
        # 注册信息索引
        await self.backend.create_index(
            self.REGISTRATIONS_COLLECTION, 
            ['adapter_id'], 
            unique=True
        )
        await self.backend.create_index(
            self.REGISTRATIONS_COLLECTION, 
            ['name']
        )
        await self.backend.create_index(
            self.REGISTRATIONS_COLLECTION, 
            ['version']
        )
        await self.backend.create_index(
            self.REGISTRATIONS_COLLECTION, 
            ['status']
        )
        
        # 配置索引
        await self.backend.create_index(
            self.CONFIGURATIONS_COLLECTION, 
            ['adapter_id'], 
            unique=True
        )
        
        # 状态索引
        await self.backend.create_index(
            self.STATES_COLLECTION, 
            ['adapter_id'], 
            unique=True
        )
        
        # 指标索引
        await self.backend.create_index(
            self.METRICS_COLLECTION, 
            ['adapter_id']
        )
        await self.backend.create_index(
            self.METRICS_COLLECTION, 
            ['timestamp']
        )
    
    def _registration_to_dict(self, registration: AdapterRegistration) -> Dict[str, Any]:
        """将注册信息转换为字典"""
        return {
            'id': registration.identity.adapter_id,
            'adapter_id': registration.identity.adapter_id,
            'name': registration.identity.name,
            'version': registration.identity.version,
            'description': registration.identity.description,
            'author': registration.identity.author,
            'license': registration.identity.license,
            'homepage': registration.identity.homepage,
            'repository': registration.identity.repository,
            'tags': registration.identity.tags,
            'category': registration.identity.category,
            'dependencies': registration.dependencies,
            'capabilities': registration.capabilities,
            'interfaces': registration.interfaces,
            'metadata': registration.metadata,
            'status': registration.status,
            'registered_at': registration.registered_at.isoformat() if registration.registered_at else None,
            'updated_at': registration.updated_at.isoformat() if registration.updated_at else None
        }
    
    def _dict_to_registration(self, data: Dict[str, Any]) -> AdapterRegistration:
        """将字典转换为注册信息"""
        identity = AdapterIdentity(
            adapter_id=data['adapter_id'],
            name=data['name'],
            version=data['version'],
            description=data.get('description'),
            author=data.get('author'),
            license=data.get('license'),
            homepage=data.get('homepage'),
            repository=data.get('repository'),
            tags=data.get('tags', []),
            category=data.get('category')
        )
        
        return AdapterRegistration(
            identity=identity,
            dependencies=data.get('dependencies', []),
            capabilities=data.get('capabilities', []),
            interfaces=data.get('interfaces', []),
            metadata=data.get('metadata', {}),
            status=data.get('status', 'registered'),
            registered_at=datetime.fromisoformat(data['registered_at']) if data.get('registered_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None
        )
    
    def _configuration_to_dict(self, config: AdapterConfiguration) -> Dict[str, Any]:
        """将配置转换为字典"""
        return {
            'id': config.adapter_id,
            'adapter_id': config.adapter_id,
            'enabled': config.enabled,
            'auto_start': config.auto_start,
            'priority': config.priority,
            'timeout': config.timeout,
            'retry_count': config.retry_count,
            'retry_delay': config.retry_delay,
            'max_memory': config.max_memory,
            'max_cpu': config.max_cpu,
            'environment': config.environment,
            'parameters': config.parameters,
            'resources': config.resources,
            'security': config.security,
            'logging': config.logging,
            'monitoring': config.monitoring,
            'created_at': config.created_at.isoformat() if config.created_at else None,
            'updated_at': config.updated_at.isoformat() if config.updated_at else None
        }
    
    def _dict_to_configuration(self, data: Dict[str, Any]) -> AdapterConfiguration:
        """将字典转换为配置"""
        return AdapterConfiguration(
            adapter_id=data['adapter_id'],
            enabled=data.get('enabled', True),
            auto_start=data.get('auto_start', False),
            priority=data.get('priority', 0),
            timeout=data.get('timeout', 30),
            retry_count=data.get('retry_count', 3),
            retry_delay=data.get('retry_delay', 1.0),
            max_memory=data.get('max_memory'),
            max_cpu=data.get('max_cpu'),
            environment=data.get('environment', {}),
            parameters=data.get('parameters', {}),
            resources=data.get('resources', {}),
            security=data.get('security', {}),
            logging=data.get('logging', {}),
            monitoring=data.get('monitoring', {}),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None
        )
    
    async def save_registration(self, registration: AdapterRegistration) -> bool:
        """保存适配器注册信息"""
        try:
            await self.initialize()
            
            data = self._registration_to_dict(registration)
            data['_updated_at'] = datetime.utcnow().isoformat()
            
            result = await self.backend.create(
                self.REGISTRATIONS_COLLECTION,
                data
            )
            
            return result.success
        except Exception:
            return False
    
    async def load_registration(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """加载适配器注册信息"""
        try:
            await self.initialize()
            
            result = await self.backend.read(
                self.REGISTRATIONS_COLLECTION,
                adapter_id
            )
            
            if result.success and result.data:
                return self._dict_to_registration(result.data)
            
            return None
        except Exception:
            return None
    
    async def update_registration(self, adapter_id: str, 
                                 registration: AdapterRegistration) -> bool:
        """更新适配器注册信息"""
        try:
            await self.initialize()
            
            data = self._registration_to_dict(registration)
            data['_updated_at'] = datetime.utcnow().isoformat()
            
            result = await self.backend.update(
                self.REGISTRATIONS_COLLECTION,
                adapter_id,
                data
            )
            
            return result.success
        except Exception:
            return False
    
    async def delete_registration(self, adapter_id: str) -> bool:
        """删除适配器注册信息"""
        try:
            await self.initialize()
            
            result = await self.backend.delete(
                self.REGISTRATIONS_COLLECTION,
                adapter_id
            )
            
            return result.success
        except Exception:
            return False
    
    async def list_registrations(self, filters: Optional[Dict[str, Any]] = None) -> List[AdapterRegistration]:
        """列出适配器注册信息"""
        try:
            await self.initialize()
            
            query = StorageQuery(filters=filters or {})
            result = await self.backend.list(
                self.REGISTRATIONS_COLLECTION,
                query
            )
            
            if result.success and result.data:
                return [self._dict_to_registration(item) for item in result.data]
            
            return []
        except Exception:
            return []
    
    async def save_configuration(self, adapter_id: str, 
                               config: AdapterConfiguration) -> bool:
        """保存适配器配置"""
        try:
            await self.initialize()
            
            data = self._configuration_to_dict(config)
            data['_updated_at'] = datetime.utcnow().isoformat()
            
            # 尝试更新，如果不存在则创建
            result = await self.backend.update(
                self.CONFIGURATIONS_COLLECTION,
                adapter_id,
                data
            )
            
            if not result.success:
                result = await self.backend.create(
                    self.CONFIGURATIONS_COLLECTION,
                    data
                )
            
            return result.success
        except Exception:
            return False
    
    async def load_configuration(self, adapter_id: str) -> Optional[AdapterConfiguration]:
        """加载适配器配置"""
        try:
            await self.initialize()
            
            result = await self.backend.read(
                self.CONFIGURATIONS_COLLECTION,
                adapter_id
            )
            
            if result.success and result.data:
                return self._dict_to_configuration(result.data)
            
            return None
        except Exception:
            return None
    
    async def save_state(self, adapter_id: str, state: Dict[str, Any]) -> bool:
        """保存适配器状态"""
        try:
            await self.initialize()
            
            data = {
                'id': adapter_id,
                'adapter_id': adapter_id,
                'state': state,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # 尝试更新，如果不存在则创建
            result = await self.backend.update(
                self.STATES_COLLECTION,
                adapter_id,
                data
            )
            
            if not result.success:
                result = await self.backend.create(
                    self.STATES_COLLECTION,
                    data
                )
            
            return result.success
        except Exception:
            return False
    
    async def load_state(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """加载适配器状态"""
        try:
            await self.initialize()
            
            result = await self.backend.read(
                self.STATES_COLLECTION,
                adapter_id
            )
            
            if result.success and result.data:
                return result.data.get('state')
            
            return None
        except Exception:
            return None
    
    async def save_metrics(self, adapter_id: str, metrics: Dict[str, Any]) -> bool:
        """保存适配器指标"""
        try:
            await self.initialize()
            
            data = {
                'adapter_id': adapter_id,
                'metrics': metrics,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            result = await self.backend.create(
                self.METRICS_COLLECTION,
                data
            )
            
            return result.success
        except Exception:
            return False
    
    async def load_metrics(self, adapter_id: str, 
                          time_range: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """加载适配器指标"""
        try:
            await self.initialize()
            
            filters = {'adapter_id': adapter_id}
            
            # 添加时间范围过滤
            if time_range:
                start_time, end_time = time_range
                filters['timestamp'] = {
                    '$gte': start_time.isoformat() if isinstance(start_time, datetime) else start_time,
                    '$lte': end_time.isoformat() if isinstance(end_time, datetime) else end_time
                }
            
            query = StorageQuery(
                filters=filters,
                sort_by='timestamp',
                sort_order='desc'
            )
            
            result = await self.backend.list(
                self.METRICS_COLLECTION,
                query
            )
            
            if result.success and result.data:
                return result.data
            
            return []
        except Exception:
            return []
    
    async def cleanup_old_metrics(self, retention_days: int = 30) -> int:
        """清理旧的指标数据"""
        try:
            await self.initialize()
            
            cutoff_time = datetime.utcnow() - timedelta(days=retention_days)
            
            query = StorageQuery(
                filters={
                    'timestamp': {'$lt': cutoff_time.isoformat()}
                }
            )
            
            # 获取要删除的记录
            result = await self.backend.list(
                self.METRICS_COLLECTION,
                query
            )
            
            if result.success and result.data:
                keys_to_delete = [item.get('_key') for item in result.data if item.get('_key')]
                
                if keys_to_delete:
                    delete_result = await self.backend.batch_delete(
                        self.METRICS_COLLECTION,
                        keys_to_delete
                    )
                    
                    if delete_result.success:
                        return len(keys_to_delete)
            
            return 0
        except Exception:
            return 0
    
    async def get_adapter_statistics(self) -> Dict[str, Any]:
        """获取适配器统计信息"""
        try:
            await self.initialize()
            
            # 获取注册统计
            registrations_result = await self.backend.list(
                self.REGISTRATIONS_COLLECTION,
                StorageQuery(filters={})
            )
            
            total_adapters = 0
            active_adapters = 0
            status_counts = {}
            
            if registrations_result.success and registrations_result.data:
                total_adapters = len(registrations_result.data)
                
                for reg in registrations_result.data:
                    status = reg.get('status', 'unknown')
                    status_counts[status] = status_counts.get(status, 0) + 1
                    
                    if status == 'active':
                        active_adapters += 1
            
            # 获取配置统计
            configs_result = await self.backend.list(
                self.CONFIGURATIONS_COLLECTION,
                StorageQuery(filters={})
            )
            
            enabled_adapters = 0
            auto_start_adapters = 0
            
            if configs_result.success and configs_result.data:
                for config in configs_result.data:
                    if config.get('enabled', True):
                        enabled_adapters += 1
                    if config.get('auto_start', False):
                        auto_start_adapters += 1
            
            # 获取指标统计
            metrics_result = await self.backend.list(
                self.METRICS_COLLECTION,
                StorageQuery(filters={}, limit=1000)
            )
            
            total_metrics = 0
            if metrics_result.success and metrics_result.data:
                total_metrics = len(metrics_result.data)
            
            return {
                'total_adapters': total_adapters,
                'active_adapters': active_adapters,
                'enabled_adapters': enabled_adapters,
                'auto_start_adapters': auto_start_adapters,
                'status_distribution': status_counts,
                'total_metrics_records': total_metrics,
                'last_updated': datetime.utcnow().isoformat()
            }
        except Exception:
            return {
                'error': 'Failed to get statistics',
                'last_updated': datetime.utcnow().isoformat()
            }

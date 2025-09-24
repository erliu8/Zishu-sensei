import os
import json
import uuid
import time
import asyncio
import logging
import importlib
import traceback
from abc import ABC,abstractmethod
from typing import Any,Dict,List,Optional,Union,Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime
from pathlib import Path
import threading
from concurrent.futures import ThreadPoolExecutor, Future

logger = logging.getLogger(__name__)

class AdapterType(Enum):
    """适配器类型枚举"""
    SOFT = "soft"
    HARD = "hard"
    INTELLIGENT = "intelligent"

class CapabilityLevel(Enum):
    """能力等级枚举"""
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

class AdapterStatus(Enum):
    """适配器状态枚举"""
    REGISTERED = "registered"
    LOADING = "loading"
    LOADED = "loaded"
    UNLOADED = "unloaded"
    ERROR = "error"

@dataclass
class AdapterCapability:
    """适配器能力描述"""
    name: str                       
    description: str               
    level: CapabilityLevel         
    inputs: List[str]             
    outputs: List[str]             
    dependencies: List[str] 
    
@dataclass
class AdapterMetadata:
    """适配器元数据"""
    id: str                       
    name: str                     
    version: str                  
    author: str                   
    description: str              
    category: str                 
    tags: List[str]              
    adapter_type: AdapterType     
    capabilities: List[AdapterCapability] 
    requirements: Dict[str, Any]  
    permissions: Dict[str, bool]  
    created_at: datetime
    updated_at: datetime

@dataclass
class ExecutionResult:
    """执行结果"""
    execution_id: str
    status: str #success, error, timeout, security_violation
    error: Optional[str] = None
    execution_time: float = 0.0
    resource_usage: Dict[str, Any] = None
    audit_log: Optional[str, Any] = None
    
class BaseAdapter(ABC):
    """适配器基类"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metadata = self._load_metadata()
        self.is_initialized = False
        self.performance_metrics = {}
        self.last_used = None
    
    @abstractmethod
    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        pass
    
    @abstractmethod
    def initialize(self) -> bool:
        """初始化适配器"""
        pass
    
    @abstractmethod
    def process(self, input_data: Any, context: Dict[str, Any]) -> Any:
        """处理输入数据"""
        pass
    
    @abstractmethod
    def get_capabilities(self) -> List[AdapterCapability]:
        """获取适配器能力列表"""
        pass
    
    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        pass
    
    @abstractmethod
    def cleanup(self) -> None:
        """清理资源"""
        pass
    
    def get_metadata(self) -> AdapterMetadata:
        """获取元数据"""
        return self.metadata
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """获取性能指标"""
        return self.performance_metrics
    
    def update_last_used(self) -> None:
        """更新最后使用时间"""
        self.last_used = datetime.now()

class AdapterRegistry:
    """适配器注册表"""
    
    def __init__(self,registry_path: str = "adapters_registry.json"):
        self.registry_path = registry_path
        self._registry = self._load_registry()
        
    def _load_registry(self) -> Dict[str, Dict[str, Any]]:
        """加载注册表"""
        if os.path.exists(self.registry_path):
            try:
                with open(self.registry_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load registry: {e}")
                return {}
        return {}
        
    def _save_registry(self) -> None:
        """保存注册表"""
        try:
            with open(self.registry_path, "w", encoding="utf-8") as f:
                json.dump(self._registry, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save registry: {e}")
            
    def register_adapter(self, adapter_id: str, adapter_info: Dict[str, Any]) -> bool:
        """注册适配器"""
        self._registry[adapter_id] = adapter_info
        self._save_registry()
        
    def unregister_adapter(self, adapter_id: str):
        """注销适配器"""
        if adapter_id in self._registry:
            del self._registry[adapter_id]
            self._save_registry()
            
    def get_adapter_info(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """获取适配器信息"""
        return self._registry.get(adapter_id)
    
    def list_all(self) -> Dict[str, Dict[str, Any]]:
        """获取所有适配器信息"""
        return self._registry.copy()
    
    def search(self, **filters) -> Dict[str, Dict[str, Any]]:
        """搜索适配器"""
        results = {}
        for adapter_id, adapter_info in self._registry.items():
            match = True
            for key, value in filters.items():
                if key not in adapter_info or adapter_info[key] != value:
                    match = False
                    break
            if match:
                results[adapter_id] = adapter_info
        return results

class AdapterLoader:
    """适配器加载器"""
    
    def __init__(self):
        self.loaded_models = {}
        
    def load_metadata(self, adapter_path: str) -> AdapterMetadata:
        """加载适配器元数据"""
        metadata_path = os.path.join(adapter_path, "metadata.json")
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Metadata file not found: {metadata_path}")

        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata_dict = json.load(f)
                
            #转换成AdapterMetadata对象
            capabilities = [
                AdapterCapability(**cap) if isinstance(cap, dict) else cap 
                for cap in metadata_dict.get("capabilities", [])
            ]
            
            metadata_dict['capabilities'] = capabilities
            metadata_dict['adapter_type'] = AdapterType(metadata_dict['adapter_type'])
            metadata_dict['created_at'] = datetime.fromisoformat(metadata_dict['created_at'])
            metadata_dict['updated_at'] = datetime.fromisoformat(metadata_dict['updated_at'])
            
            return AdapterMetadata(**metadata_dict)
        except Exception as e:
            raise ValueError(f"Failed to load metadata: {e}")
        
    def load_adapter(self, adapter_path: str, metadata: AdapterMetadata) -> BaseAdapter:
        """动态加载适配器"""
        try:
            #构建模块路径
            adapter_module_path = os.path.join(adapter_path, "adapter.py")
            if not os.path.exists(adapter_module_path):
                raise FileNotFoundError(f"Adapter module not found: {adapter_module_path}")
            
            #动态导入适配器模块
            spec = importlib.util.spec_from_file_location(
                f"adapter_{metadata.id}", adapter_module_path)
            
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            #获取适配器类
            adapter_class = getattr(module, 'Adapter', None)
            if adapter_class is None:
                raise ValueError(f"Adapter class not found in {adapter_module_path}")
            
            #创建适配器实例
            config = {
                'adapter_path': adapter_path,
                'metadata': metadata
            }
            adapter_instance = adapter_class(config)
            
            self.loaded_models[metadata.id] = module
            return adapter_instance
        
        except Exception as e:
            logger.error(f"Failed to load adapter {metadata.id}: {e}")
            raise
        
class AdapterValidator:
    """适配器验证器"""
    
    def __init__(self):
        self.validator = {}
        
    def validate_adapter(self, adapter_path: str, metadata: AdapterMetadata) -> Dict[str, Any]:
        """验证适配器"""
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            #验证文件结构
            required_files = ['metadata.json', 'adapter.py']
            for file in required_files:
                file_path = os.path.join(adapter_path, file)
                if not os.path.exists(file_path):
                    validation_result['is_valid'] = False
                    validation_result['errors'].append(f"Required file {file} not found")
                    
            #验证元数据
            if not metadata.id or not metadata.name:
                validation_result['is_valid'] = False
                validation_result['errors'].append("Adapter ID and name are required")
                
            #验证能力
            if not metadata.capabilities:
                validation_result['warnings'].append("No capabilities declared")
                
            #验证权限
            dangerous_permissions = ['system_access', 'network_access', 'file_write']
            for perm in dangerous_permissions:
                if metadata.permissions.get(perm, False):
                    validation_result['warnings'].append(f"Dangerous permission requested: {perm}")
                    
        except Exception as e:
            validation_result['is_valid'] = False
            validation_result['errors'].append(f"Validation error: {e}")
            
        return validation_result
    
class AdapterMonitor:
    """适配器监控器"""
    
    def __init__(self):
        self.monitoring_data = {}
        self.is_monitoring = {}
        
        def start_monitoring(self, adapter_id: str, adapter: BaseAdapter):
            "开始监控适配器"
            self.is_monitoring[adapter_id] = True
            self.monitoring_data[adapter_id] = {
                'start_time': datetime.now(),
                'execution_count': 0,
                'total_execution_time': 0.0,
                'error_count': 0,
                'last_health_check': None,
                'resource_usage': {}
            }
            
        def stop_monitoring(self, adapter_id: str):
            "停止监控适配器"
            self.is_monitoring[adapter_id] = False
            logger.info(f"Monitoring stopped for adapter {adapter_id}")
            
        def record_excution(self, adapter_id: str, execution_time: float, success: bool):
            "记录执行数据"
            if adapter_id in self.monitoring_data:
                data = self.monitoring_data[adapter_id]
                data['execution_count'] += 1
                data['total_execution_time'] += execution_time
                if not success:
                    data['error_count'] += 1
                    
        def get_monitoring_data(self, adapter_id: str) -> Optional[Dict[str, Any]]:
            "获取监控数据"
            return self.monitoring_data.get(adapter_id)
            
class AdapterManager:
    """适配器管理器主类"""
    
    def __init__(self, adapter_root_path: str = "adapters"):
        self.adapter_root_path = adapter_root_path
        self.registry = AdapterRegistry()
        self.loader = AdapterLoader()
        self.validator = AdapterValidator()
        self.monitor = AdapterMonitor()
        
        self._active_adapters: Dict[str, BaseAdapter] = {}
        self._adapter_status: Dict[str, AdapterStatus] = {}
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._lock = threading.RLock()
        
        #确保适配器根目录存在
        os.makedirs(self.adapter_root_path, exist_ok=True)
        
        #初始化时扫描已注册的适配器
        self._scan_registered_adapters()
        
    def _scan_registered_adapters(self):
        """扫描已注册的适配器"""
        try:
            for item in os.listdir(self.adapter_root_path):
                adapter_path = os.path.join(self.adapter_root_path, item)
                if os.path.isdir(adapter_path):
                    try:
                        metadata = self.loader.load_metadata(adapter_path)
                        if metadata.id not in self.registry.list_all():
                            self.registry_adapter(adapter_path)
                    except Exception as e:
                        logger.warning(f"Failed to register adapter at {adapter_path}: {e}")
        except Exception as e:
            logger.error(f"Failed to scan adapters directory: {e}")
            
    def register_adapter(self, adapter_path: str) -> bool:
        """注册适配器"""
        try:
            with self._lock:
                #加载适配器元数据
                metadata = self.loader.load_metadata(adapter_path)
                
                #验证适配器
                validation_result = self.validator.validate_adapter(adapter_path, metadata)
                
                if not validation_result['is_valid']:
                    logger.error(f"Adapter validation failed: {validation_result['errors']}")
                    return False
                
                #注册到注册表
                adapter_info = {
                    'path': adapter_path,
                    'metadata': asdict(metadata),
                    'validation': validation_result,
                    'status': AdapterStatus.REGISTERED.value,
                    'registered_at': datetime.now().isoformat()
                }
                self.registry.register_adapter(metadata.id, adapter_info)
                self._adapter_status[metadata.id] = AdapterStatus.REGISTERED
                
                logger.info(f"Adapter {metadata.id} registered successfully")
                return True
            
        except Exception as e:
            logger.error(f"Failed to register adapter {metadata.id}: {e}")
            return False
        
    def load_adapter(self, adapter_id: str) -> Optional[BaseAdapter]:
        """加载适配器"""
        with self._lock:
            #如果已经加载，直接返回
            if adapter_id in self._active_adapters:
                adapter = self._active_adapters[adapter_id]
                adapter.update_last_used()
                return adapter
            
            #从注册表获取适配器信息
            adapter_info = self.registry.get_adapter_info(adapter_id)
            if not adapter_info:
                logger.error(f"Adapter {adapter_id} not found in registry")
                return None
            
            try:
                self._adapter_status[adapter_id] = AdapterStatus.LOADING
                
                #重新加载元数据
                metadata_dict = adapter_info['metadata']
                capabilities = [
                    AdapterCapability(**cap) for cap in metadata_dict['capabilities']
                ]
                metadata_dict['capabilities'] = capabilities
                metadata_dict['adapter_type'] = AdapterType(metadata_dict['adapter_type'])
                metadata_dict['created_at'] = datetime.fromisoformat(metadata_dict['created_at'])
                metadata_dict['updated_at'] = datetime.fromisoformat(metadata_dict['updated_at'])
                
                metadata = AdapterMetadata(**metadata_dict)
                
                #动态加载适配器
                adapter_instance = self.loader.load_adapter(
                    adapter_info['path'],
                    metadata
                )
                
                #初始化适配器
                if not adapter_instance.initialize():
                    raise RuntimeError(
                        f"Failed to initialize adapter {adapter_id}"
                    )
                    
                #缓存活跃适配器
                self._active_adapters[adapter_id] = adapter_instance
                self._adapter_status[adapter_id] = AdapterStatus.LOADED
                
                #启用监控
                self.monitor.start_monitoring(adapter_id, adapter_instance)
                
                adapter_instance.update_last_used()
                logger.info(f"Adapter {adapter_id} loaded successfully")
                return adapter_instance
            
            except Exception as e:
                self._adapter_status[adapter_id] = AdapterStatus.ERROR
                logger.error(f"Failed to load adapter {adapter_id}: {e}")
                logger.error(traceback.format_exc())
                return None
            
    def unload_adapter(self, adapter_id: str) -> bool:
        """卸载适配器"""
        with self._lock:
            if adapter_id not in self._active_adapters:
                logger.warning(f"Adapter {adapter_id} is not loaded")
                return False
            
            try:
                adapter = self._active_adapters[adapter_id]
                
                #清理适配器资源
                adapter.cleanup()
                
                #停止监控
                self.monitor.stop_monitoring(adapter_id)
                
                #从活跃适配器中移除
                del self._active_adapters[adapter_id]
                self._adapter_status[adapter_id] = AdapterStatus.UNLOADED
                
                logger.info(f"Adapter {adapter_id} unloaded successfully")
                return True
            
            except Exception as e:
                logger.error(f"Failed to unload adapter {adapter_id}: {e}")
                return False
    def switch_adapter(self, from_adapter_id: str, to_adapter_id: str, 
                       unload_previous: bool = False) -> Dict[str, Any]:
        """切换适配器"""
        result = {
        'success': False,
        'from_adapter': from_adapter_id,
        'to_adapter': to_adapter_id,
        'unloaded_previous': False,
        'message': ''
        }
    
        try:
            with self._lock:
                # 1. 加载目标适配器
                target_adapter = self.load_adapter(to_adapter_id)
                if target_adapter is None:
                    result['message'] = f"Failed to load target adapter: {to_adapter_id}"
                    return result
                
                # 2. 处理源适配器（如果需要卸载）
                if unload_previous and from_adapter_id and from_adapter_id in self._active_adapters:
                    unload_success = self.unload_adapter(from_adapter_id)
                    result['unloaded_previous'] = unload_success
                    
                    if not unload_success:
                        logger.warning(f"Failed to unload previous adapter: {from_adapter_id}")
                
                result['success'] = True
                result['message'] = f"Successfully switched to adapter: {to_adapter_id}"
                
                logger.info(f"Adapter switch completed: {from_adapter_id} -> {to_adapter_id} (unload_previous: {unload_previous})")
                return result
                
        except Exception as e:
            result['message'] = f"Adapter switch failed: {str(e)}"
            logger.error(f"Failed to switch adapter: {e}")
            return result
        
    def list_available_adapters(self) -> Dict[str, Dict[str, Any]]:
        adapters = {}
        for adapter_id, adapter_info in self.registry.list_all().items():
            adapters[adapter_id] = {
                'metadata': adapter_info['metadata'],
                'status': self._adapter_status.get(adapter_id, AdapterStatus.REGISTERED).value,
                'is_loaded': adapter_id in self._active_adapters,
                'registered_at': adapter_info['registered_at']
            }
        return adapters
        
    def get_adapter_status(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """获取适配器状态"""
        if adapter_id not in self.registry.list_all():
            return None
        
        status_info = {
            'adapter_id': adapter_id,
            'status': self._adapter_status.get(adapter_id, AdapterStatus.REGISTERED).value,
            'is_loaded': adapter_id in self._active_adapters,
            'monitoring_data': self.monitor.get_monitoring_data(adapter_id)
        }
        if adapter_id in self._active_adapters:
            adapter = self._active_adapters[adapter_id]
            status_info.update({
                'last_used': adapter.last_used.isoformat() if adapter.last_used else None,
                'performance_metrics': adapter.get_performance_metrics(),
                'health_check': adapter.health_check()
            })
        return status_info
        
    async def execute_adapter(self, adapter_id: str, input_data: Any, 
                              context: Dict[str, Any]) -> ExecutionResult:
        """执行适配器"""
        execution_id = f"exec_{uuid.uuid4().hex[:8]}"
        start_time = time.time()
        
        try:
            #加载适配器
            adapter = self.load_adapter(adapter_id)
            if adapter is None:
                return ExecutionResult(
                    execution_id=execution_id,
                    status="error",
                    error=f"Adapter {adapter_id} is not loaded"
                )
                
            #执行适配器
            result = adapter.process(input_data, context)
            execution_time = time.time() - start_time
            
            #记录执行数据
            self.monitor.record_excution(adapter_id, execution_time, True)
            
            return ExecutionResult(
                execution_id=execution_id,
                status="success",
                output=result,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.monitor.record_excution(adapter_id, execution_time, False)
            
            return ExecutionResult(
                execution_id=execution_id,
                status="error",
                error=str(e),
                execution_time=execution_time
            )
            
    def search_adapters(self, **filters) -> Dict[str, Dict[str, Any]]:
        """搜索适配器"""
        return self.registry.search(**filters)
        
    def get_adapter_capabilities(self, adapter_id: str) -> Optional[List[AdapterCapability]]:
        """获取适配器能力"""
        adapter_info = self.registry.get_adapter_info(adapter_id)
        if adapter_info:
            return [
                AdapterCapability(**cap) for cap in adapter_info['metadata']['capabilities']
            ]
        return None
        
    def health_check_all(self) -> Dict[str, Dict[str, Any]]:
        """检查所有活跃适配器的健康状态"""
        health_results = {}
        for adapter_id, adapter in self._active_adapters.items():
            try:
                health_results[adapter_id] = adapter.health_check()
            except Exception as e:
                health_results[adapter_id] = {
                    'status': 'error',
                    'error': str(e)
                }
        return health_results
        
    def cleanup_all(self) -> None:
        """清理所有活跃适配器"""
        with self._lock:
            for adapter_id in list(self._active_adapters.keys()):
                self.unload_adapter(adapter_id)
                
            self._executor.shutdown(wait=True)
            logger.info("All adapters unloaded and executor shutdown")
            
    def __del__(self):
        """析构函数"""
        try:
            self.cleanup_all()
        except Exception as e:
            logger.error(f"Failed to cleanup adapters: {e}")
        
#导出主要类
__all__ = ["AdapterManager",
           "AdapterRegistry",
           "AdapterLoader",
           "AdapterValidator",
           "AdapterMonitor",
           "AdapterStatus",
           "AdapterCapability",
           "AdapterMetadata",
           "ExecutionResult",
           "BaseAdapter"
           ]
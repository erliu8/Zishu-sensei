"""
依赖注入管理器
提供统一的依赖管理和服务注册功能
"""

import threading
from typing import Any,Callable,Dict,Optional,TypeVar,Type,Union
from pathlib import Path
import logging
from functools import lru_cache
from abc import ABC,abstractmethod

#导入项目组件
from zishu.utils.logger import setup_logger
from zishu.utils.config_manager import ConfigManager
from zishu.utils.model_registry import ModelRegistry
from zishu.utils.prompt_manager import PerformanceMonitor,PromptManager
from zishu.utils.cache_manager import CacheManager
from zishu.utils.thread_factory import ThreadFactory,get_thread_factory,shutdown_thread_factory
from zishu.api.schemas.chat import CharacterConfig


T = TypeVar('T')

class ServiceLifecycle(ABC):
    """服务生命周期接口"""
    
    @abstractmethod
    def initialize(self)->None:
        """初始化服务"""
        pass
    
    @abstractmethod
    def cleanup(self)->None:
        """清理资源"""
        pass

class DependencyContainer:
    """依赖注入容器"""
    def __init__(self):
        self._services:Dict[str,Any] = {}
        self._factories: Dict[str,Callable] = {}
        self._singletons: Dict[str,Any] = {}
        self._lock = threading.RLock()
        self._initialized = False
        
    def register_service(self,name:str,service:Any)->None:
        """注册服务实例"""
        with self._lock:
            self._services[name] = service
            
    def register_factory(self,name:str,factory:Callable[[], T])->None:
        """注册工厂函数"""
        with self._lock:
            self._factories[name] = factory
            
    def register_singleton(self,name:str,factory:Callable[[], T])->None:
        """注册单例工厂"""
        with self._lock:
            self._factories[name] = lambda: self._get_or_create_singleton(name,factory)
            
    def _get_or_create_singleton(self,name:str,factory:Callable[[], T])->T:
        """获取或创建单例实例"""
        with self._lock:
            if name not in self._singletons:
                self._singletons[name] = factory()
            return self._singletons[name]
        
    def get(self,name:str,default:Any = None)->Any:
        """获取服务实例"""
        with self._lock:
            #优先从已注册的服务获取
            if name in self._services:
                return self._services[name]
            
            #从工厂创建
            if name in self._factories:
                return self._factories[name]()
            
            return default
        
    def has(self,name:str)->bool:
        """检查是否注册了服务"""
        with self._lock:
            return name in self._services or name in self._factories
    
    def clear(self)->None:
        """清除所有服务"""
        with self._lock:
            #清理实现了ServiceLifecycle接口的服务
            for service in self._services.values():
                if isinstance(service,ServiceLifecycle):
                    try:
                        service.cleanup()
                    except Exception as e:
                        # 使用print而不是logger，因为logger可能已经被清理
                        print(f"Error cleaning up service: {e}")

            #特殊处理线程工厂的清理
            if "thread_factory" in self._services:
                try:
                    thread_factory = self._services["thread_factory"]
                    if hasattr(thread_factory,"shutdown"):
                        thread_factory.shutdown()
                        
                except Exception as e:
                    # 使用print而不是logger，因为logger可能已经被清理
                    print(f"Error shutting down thread factory: {e}")

            self._services.clear()
            self._factories.clear()
            self._singletons.clear()
            self._initialized = False
            print("all services cleared")
            
class ZishuDependencies:
    """Zishu依赖管理器"""
    
    def __init__(self, config_dir: Optional[Path] = None, log_level: int = logging.INFO):
        """
        Args:
            config_dir: 配置文件目录
            log_level: 日志级别
        """
        self.config_dir = config_dir or Path("configs")
        self.log_level = log_level
        self.container = DependencyContainer()
        self._setup_core_dependencies()
        
    def _setup_core_dependencies(self)->None:
            """设置核心依赖"""
            #配置管理器 - 最高优先级
            self.container.register_singleton("config_manager",
                                              lambda: ConfigManager(self.config_dir,default_config="default"))
            
            #日志管理器
            self.container.register_singleton("logger",
                                              lambda: setup_logger("zishu",level=self.log_level))
            
            #模型注册表
            self.container.register_singleton("model_registry",
                                              lambda: ModelRegistry())
            
            #缓存管理器
            self.container.register_singleton("performance_monitor",
                                              lambda: PerformanceMonitor())
            #提示词管理器
            self.container.register_singleton("prompt_manager",
                                              lambda: PromptManager())
            #线程工厂
            self.container.register_singleton("thread_factory",
                                              lambda: get_thread_factory())
            
    def register_character_config(self, config:CharacterConfig)->None:
        """注册角色配置"""
        self.container.register_service("character_config", config)
        
    def register_custom_service(self, name:str, service:Any)->None:
        """注册自定义服务"""
        self.container.register_service(name, service)
        
    def register_custom_factory(self, name:str, factory:Callable[[], Any])->None:
        """注册自定义工厂"""
        self.container.register_factory(name, factory)
        
    def register_custom_singleton(self, name:str, factory:Callable[[], Any])->None:
        """注册自定义单例"""
        self.container.register_singleton(name, factory)
    
    def register_thread_factory_config(self, max_workers:int=10,thread_name_prefix:str="zishuworker")->None:
        """注册自定义线程工厂配置"""
        self.container.register_singleton("thread_factory",
                                          lambda: ThreadFactory(max_workers=max_workers,thread_name_prefix=thread_name_prefix))
    
    def get_config_manager(self)->ConfigManager:
        """获取配置管理器"""
        return self.container.get("config_manager")
    
    def get_logger(self)->logging.Logger:
        """获取日志管理器"""
        return self.container.get("logger")
    
    def get_model_registry(self)->ModelRegistry:
        """获取模型注册表"""
        return self.container.get("model_registry")
    
    def get_performance_monitor(self)->PerformanceMonitor:
        """获取缓存管理器"""
        return self.container.get("performance_monitor")
    
    def get_prompt_manager(self)->PromptManager:
        """获取提示词管理器"""
        return self.container.get("prompt_manager")
    
    def get_thread_factory(self)->ThreadFactory:
        """获取线程工厂"""
        return self.container.get("thread_factory")
    
    def get_character_config(self)->CharacterConfig:
        """获取角色配置"""
        return self.container.get("character_config")
    
    def get_service(self, name:str,default:Any = None)->Any:
        """获取服务实例"""
        return self.container.get(name,default)
    
    def has_service(self, name:str)->bool:
        """检查是否注册了服务"""
        return self.container.has(name)
    
    def clear_services(self)->None:
        """清除所有服务"""
        self.container.clear()
        #确保全局线程工厂也被清理
        shutdown_thread_factory()
        
#全局依赖管理器实例
_dependencies: Optional[ZishuDependencies] = None
_lock = threading.Lock()

def initialize_dependencies(config_dir: Optional[Path] = None,
                            log_level: int = logging.INFO,
                            force_reload: bool = False) -> ZishuDependencies:
    """初始话全局依赖管理器"""
    global _dependencies
    
    with _lock:
        if _dependencies is None or force_reload:
            if _dependencies and force_reload:
                _dependencies.clear_services()
            _dependencies = ZishuDependencies(config_dir, log_level)
            
    return _dependencies

def get_dependencies() -> ZishuDependencies:
    """获取全局依赖管理器"""
    global _dependencies
    
    if _dependencies is None:
        initialize_dependencies()
    
    return _dependencies

#便捷访问函数
@lru_cache(maxsize=1)
def get_config_manager() -> ConfigManager:
    """获取配置管理器"""
    return get_dependencies().get_config_manager()

@lru_cache(maxsize=1)
def get_logger() -> logging.Logger:
    """获取日志管理器"""
    return get_dependencies().get_logger()

@lru_cache(maxsize=1)
def get_model_registry() -> ModelRegistry:
    """获取模型注册表"""
    return get_dependencies().get_model_registry()

@lru_cache(maxsize=1)
def get_cache_manager() -> CacheManager:
    """获取缓存管理器"""
    return get_dependencies().get_cache_manager()

@lru_cache(maxsize=1)
def get_performance_monitor() -> PerformanceMonitor:
    """获取性能监控器"""
    return get_dependencies().get_performance_monitor()

@lru_cache(maxsize=1)
def get_prompt_manager() -> PromptManager:
    """获取提示词管理器"""
    return get_dependencies().get_prompt_manager()

@lru_cache(maxsize=1)
def get_thread_factory_from_deps() -> ThreadFactory:
    """从依赖管理器获取线程工厂"""
    return get_dependencies().get_thread_factory()

def get_character_config() -> Optional[CharacterConfig]:
    """获取角色配置"""
    return get_dependencies().get_character_config()

#线程任务相关的便捷函数
def submit_task(func:Callable,*args,**kwargs)->str:
    """提交任务到线程池"""
    return get_thread_factory_from_deps().submit_task(func,*args,**kwargs)

def get_task_status(task_id:str)->Optional[Dict[str,Any]]:
    """获取任务状态"""
    return get_thread_factory_from_deps().get_task_status(task_id)

def get_task_result(task_id:str,timeout:Optional[float]=None)->Any:
    """获取任务结果"""
    return get_thread_factory_from_deps().get_task_result(task_id,timeout)

def cancel_task(task_id:str)->bool:
    """取消任务"""
    return get_thread_factory_from_deps().cancel_task(task_id)

def get_running_tasks()->list:
    """获取正在运行的任务id列表"""
    return get_thread_factory_from_deps().get_running_tasks()

def cleanup_completed_tasks(max_age:float=3600)->int:
    """清理已完成任务"""
    return get_thread_factory_from_deps().cleanup_completed_tasks(max_age)

#装饰器支持
def inject_dependencies(**kwargs):
    """依赖注入装饰器"""
    def decorator(func):
        def wrapper(*args,**func_kwargs):
            #注入依赖
            for key, dependency_getter in kwargs.items():
                if key not in func_kwargs:
                    func_kwargs[key] = dependency_getter()
            return func(*args,**func_kwargs)
        return wrapper
    return decorator
#上下文管理器支持
class DependencyContext:
    """依赖上下文管理器"""
    def __init__(self,config_dir:Optional[Path]=None,log_level:int=logging.INFO):
        self.config_dir = config_dir
        self.log_level = log_level
        self.dependencies = None
        
    def __enter__(self) -> ZishuDependencies:
        self.dependencies = initialize_dependencies(self.config_dir,self.log_level)
        return self.dependencies
    
    def __exit__(self,exc_type,exc_val,exc_tb):
        if self.dependencies:
            self.dependencies.clear_services()
                 
#线程工厂上下文管理器
class ThreadFactoryContext:
    """线程工厂上下文管理器"""
    def __init__(self,max_workers:int=10,thread_name_prefix:str="zishuworker"):
        self.max_workers = max_workers
        self.thread_name_prefix = thread_name_prefix
        self.thread_factory = None
        
    def __enter__(self) -> ThreadFactory:
        self.thread_factory = ThreadFactory(
            max_workers=self.max_workers,
            thread_name_prefix=self.thread_name_prefix
        )
        return self.thread_factory
    
    def __exit__(self,exc_type,exc_val,exc_tb):
        if self.thread_factory:
            self.thread_factory.shutdown()





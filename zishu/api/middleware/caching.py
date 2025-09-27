"""
缓存中间件
提供全面的HTTP请求/响应缓存、数据缓存、会话缓存等功能
支持多种缓存策略、过期机制、缓存预热、缓存统计等高级功能
"""

import asyncio
import hashlib
import json
import logging
import time
import zlib
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from concurrent.futures import ThreadPoolExecutor
import threading

from fastapi import Request, Response, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
import aiofiles
import pickle

from zishu.api.dependencies import get_dependencies
from zishu.utils.performance import PerformanceMonitor

# 设置日志
logger = logging.getLogger(__name__)

class CacheStrategy(str, Enum):
    """缓存策略枚举"""
    LRU = "lru"          # 最近最少使用
    LFU = "lfu"          # 最不经常使用  
    FIFO = "fifo"        # 先进先出
    TTL = "ttl"          # 基于时间的过期
    ADAPTIVE = "adaptive" # 自适应策略

class CacheLevel(str, Enum):
    """缓存级别枚举"""
    MEMORY = "memory"    # 内存缓存
    DISK = "disk"        # 磁盘缓存
    HYBRID = "hybrid"    # 混合缓存
    DISTRIBUTED = "distributed"  # 分布式缓存

class CacheEventType(str, Enum):
    """缓存事件类型"""
    HIT = "hit"
    MISS = "miss"
    SET = "set"
    DELETE = "delete"
    EXPIRE = "expire"
    EVICT = "evict"

@dataclass
class CacheEntry:
    """缓存项数据类"""
    key: str
    value: Any
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    ttl: Optional[int] = None
    size: int = 0
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def is_expired(self) -> bool:
        """检查是否已过期"""
        if self.ttl is None:
            return False
        return (datetime.now() - self.created_at).total_seconds() > self.ttl
    
    def touch(self) -> None:
        """更新访问时间和计数"""
        self.last_accessed = datetime.now()
        self.access_count += 1

@dataclass
class CacheStats:
    """缓存统计数据"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    evictions: int = 0
    memory_usage: int = 0
    entry_count: int = 0
    hit_rate: float = 0.0
    avg_response_time: float = 0.0
    
    def update_hit_rate(self) -> None:
        """更新命中率"""
        total = self.hits + self.misses
        self.hit_rate = (self.hits / total) if total > 0 else 0.0

class CacheConfig(BaseModel):
    """缓存配置模型"""
    # 基本配置
    enabled: bool = True
    strategy: CacheStrategy = CacheStrategy.LRU
    level: CacheLevel = CacheLevel.MEMORY
    max_size: int = 10000
    max_memory_mb: int = 1024
    default_ttl: int = 3600  # 1小时
    
    # 高级配置
    compression_enabled: bool = True
    compression_threshold: int = 1024  # 超过1KB压缩
    encryption_enabled: bool = False
    
    # 清理配置
    cleanup_interval: int = 300  # 5分钟
    max_idle_time: int = 1800   # 30分钟
    
    # 预热配置
    preload_enabled: bool = False
    preload_patterns: List[str] = Field(default_factory=list)
    
    # 持久化配置
    persistence_enabled: bool = False
    persistence_path: str = "cache_data"
    
    # 监控配置
    metrics_enabled: bool = True
    slow_query_threshold: float = 1.0  # 秒
    
    # HTTP缓存配置
    http_cache_enabled: bool = True
    cache_control_max_age: int = 300
    etag_enabled: bool = True
    vary_headers: List[str] = Field(default_factory=lambda: ["Accept", "Accept-Encoding"])

class CacheEventListener(ABC):
    """缓存事件监听器抽象基类"""
    
    @abstractmethod
    async def on_event(self, event_type: CacheEventType, key: str, 
                      value: Any = None, metadata: Dict[str, Any] = None) -> None:
        """处理缓存事件"""
        pass

class MetricsCacheEventListener(CacheEventListener):
    """指标收集缓存事件监听器"""
    
    def __init__(self, performance_monitor: Optional[PerformanceMonitor] = None):
        self.performance_monitor = performance_monitor
        self.stats = CacheStats()
        
    async def on_event(self, event_type: CacheEventType, key: str,
                      value: Any = None, metadata: Dict[str, Any] = None) -> None:
        """收集缓存指标"""
        if event_type == CacheEventType.HIT:
            self.stats.hits += 1
        elif event_type == CacheEventType.MISS:
            self.stats.misses += 1
        elif event_type == CacheEventType.SET:
            self.stats.sets += 1
        elif event_type == CacheEventType.DELETE:
            self.stats.deletes += 1
        elif event_type == CacheEventType.EVICT:
            self.stats.evictions += 1
            
        self.stats.update_hit_rate()
        
        # 记录到性能监控器
        if self.performance_monitor and metadata:
            response_time = metadata.get('response_time', 0)
            self.performance_monitor.record_response_time(
                'cache', event_type.value, response_time
            )

class CacheManager:
    """高级缓存管理器"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        self._listeners: List[CacheEventListener] = []
        self._cleanup_task: Optional[asyncio.Task] = None
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cache-worker")
        
        # 统计信息
        self.stats = CacheStats()
        
        # 启动清理任务
        if self.config.cleanup_interval > 0:
            asyncio.create_task(self._start_cleanup_task())
            
        logger.info(f"缓存管理器初始化完成 - 策略: {config.strategy}, 最大大小: {config.max_size}")
    
    def add_listener(self, listener: CacheEventListener) -> None:
        """添加事件监听器"""
        self._listeners.append(listener)
    
    async def _notify_listeners(self, event_type: CacheEventType, key: str,
                               value: Any = None, metadata: Dict[str, Any] = None) -> None:
        """通知事件监听器"""
        for listener in self._listeners:
            try:
                await listener.on_event(event_type, key, value, metadata)
            except Exception as e:
                logger.error(f"缓存事件监听器错误: {e}")
    
    def _generate_key(self, key: Union[str, Dict[str, Any]]) -> str:
        """生成缓存键"""
        if isinstance(key, str):
            return key
        
        # 对字典类型的键进行标准化
        if isinstance(key, dict):
            normalized = json.dumps(key, sort_keys=True, ensure_ascii=False)
            return hashlib.md5(normalized.encode('utf-8')).hexdigest()
        
        return str(key)
    
    def _calculate_size(self, value: Any) -> int:
        """计算值的大小"""
        try:
            if isinstance(value, (str, bytes)):
                return len(value)
            elif isinstance(value, (int, float, bool)):
                return 8
            else:
                # 使用pickle序列化来估算大小
                return len(pickle.dumps(value))
        except Exception:
            return 1024  # 默认大小
    
    def _compress_value(self, value: Any) -> bytes:
        """压缩值"""
        try:
            serialized = pickle.dumps(value)
            if len(serialized) > self.config.compression_threshold:
                compressed = zlib.compress(serialized)
                return b'compressed:' + compressed
            return b'raw:' + serialized
        except Exception as e:
            logger.error(f"压缩值失败: {e}")
            return pickle.dumps(value)
    
    def _decompress_value(self, data: bytes) -> Any:
        """解压缩值"""
        try:
            if data.startswith(b'compressed:'):
                decompressed = zlib.decompress(data[11:])
                return pickle.loads(decompressed)
            elif data.startswith(b'raw:'):
                return pickle.loads(data[4:])
            else:
                return pickle.loads(data)
        except Exception as e:
            logger.error(f"解压缩值失败: {e}")
            raise
    
    async def get(self, key: Union[str, Dict[str, Any]], 
                 default: Any = None) -> Tuple[Any, bool]:
        """获取缓存值"""
        start_time = time.time()
        cache_key = self._generate_key(key)
        
        with self._lock:
            entry = self._cache.get(cache_key)
            
            if entry is None:
                # 缓存未命中
                await self._notify_listeners(CacheEventType.MISS, cache_key,
                                           metadata={'response_time': time.time() - start_time})
                return default, False
            
            # 检查是否过期
            if entry.is_expired():
                del self._cache[cache_key]
                await self._notify_listeners(CacheEventType.EXPIRE, cache_key,
                                           metadata={'response_time': time.time() - start_time})
                return default, False
            
            # 更新访问信息
            entry.touch()
            
            # 解压缩值
            try:
                if self.config.compression_enabled and isinstance(entry.value, bytes):
                    value = self._decompress_value(entry.value)
                else:
                    value = entry.value
                
                await self._notify_listeners(CacheEventType.HIT, cache_key, value,
                                           metadata={'response_time': time.time() - start_time})
                return value, True
                
            except Exception as e:
                logger.error(f"获取缓存值失败: {e}")
                del self._cache[cache_key]
                return default, False
    
    async def set(self, key: Union[str, Dict[str, Any]], value: Any,
                 ttl: Optional[int] = None, tags: Optional[Set[str]] = None) -> bool:
        """设置缓存值"""
        start_time = time.time()
        cache_key = self._generate_key(key)
        
        try:
            with self._lock:
                # 检查是否需要清理空间
                if len(self._cache) >= self.config.max_size:
                    await self._evict_entries()
                
                # 压缩值
                if self.config.compression_enabled:
                    compressed_value = self._compress_value(value)
                else:
                    compressed_value = value
                
                # 创建缓存项
                entry = CacheEntry(
                    key=cache_key,
                    value=compressed_value,
                    ttl=ttl or self.config.default_ttl,
                    size=self._calculate_size(compressed_value),
                    tags=tags or set()
                )
                
                self._cache[cache_key] = entry
                
                await self._notify_listeners(CacheEventType.SET, cache_key, value,
                                           metadata={'response_time': time.time() - start_time})
                return True
                
        except Exception as e:
            logger.error(f"设置缓存值失败: {e}")
            return False
    
    async def delete(self, key: Union[str, Dict[str, Any]]) -> bool:
        """删除缓存值"""
        cache_key = self._generate_key(key)
        
        with self._lock:
            if cache_key in self._cache:
                del self._cache[cache_key]
                await self._notify_listeners(CacheEventType.DELETE, cache_key)
                return True
            return False
    
    async def delete_by_tags(self, tags: Set[str]) -> int:
        """根据标签删除缓存项"""
        deleted_count = 0
        
        with self._lock:
            keys_to_delete = []
            for key, entry in self._cache.items():
                if entry.tags.intersection(tags):
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                del self._cache[key]
                deleted_count += 1
                await self._notify_listeners(CacheEventType.DELETE, key)
        
        logger.info(f"根据标签删除了 {deleted_count} 个缓存项")
        return deleted_count
    
    async def clear(self) -> None:
        """清空所有缓存"""
        with self._lock:
            self._cache.clear()
        logger.info("缓存已清空")
    
    async def _evict_entries(self) -> None:
        """根据策略淘汰缓存项"""
        if not self._cache:
            return
        
        entries_to_remove = max(1, len(self._cache) // 10)  # 移除10%的项
        
        if self.config.strategy == CacheStrategy.LRU:
            # 最近最少使用
            sorted_entries = sorted(self._cache.items(),
                                  key=lambda x: x[1].last_accessed)
        elif self.config.strategy == CacheStrategy.LFU:
            # 最不经常使用
            sorted_entries = sorted(self._cache.items(),
                                  key=lambda x: x[1].access_count)
        elif self.config.strategy == CacheStrategy.FIFO:
            # 先进先出
            sorted_entries = sorted(self._cache.items(),
                                  key=lambda x: x[1].created_at)
        else:
            # 默认使用LRU
            sorted_entries = sorted(self._cache.items(),
                                  key=lambda x: x[1].last_accessed)
        
        for i in range(min(entries_to_remove, len(sorted_entries))):
            key, entry = sorted_entries[i]
            del self._cache[key]
            await self._notify_listeners(CacheEventType.EVICT, key)
    
    async def _start_cleanup_task(self) -> None:
        """启动清理任务"""
        while True:
            try:
                await asyncio.sleep(self.config.cleanup_interval)
                await self._cleanup_expired_entries()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"清理任务错误: {e}")
    
    async def _cleanup_expired_entries(self) -> None:
        """清理过期的缓存项"""
        expired_keys = []
        
        with self._lock:
            for key, entry in self._cache.items():
                if entry.is_expired():
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
                await self._notify_listeners(CacheEventType.EXPIRE, key)
        
        if expired_keys:
            logger.debug(f"清理了 {len(expired_keys)} 个过期缓存项")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        with self._lock:
            total_size = sum(entry.size for entry in self._cache.values())
            
            return {
                "entry_count": len(self._cache),
                "total_size_bytes": total_size,
                "total_size_mb": total_size / (1024 * 1024),
                "hit_rate": self.stats.hit_rate,
                "hits": self.stats.hits,
                "misses": self.stats.misses,
                "sets": self.stats.sets,
                "deletes": self.stats.deletes,
                "evictions": self.stats.evictions,
                "strategy": self.config.strategy.value,
                "max_size": self.config.max_size,
                "max_memory_mb": self.config.max_memory_mb
            }
    
    async def cleanup(self) -> None:
        """清理资源"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        if self._executor:
            self._executor.shutdown(wait=True)
        
        logger.info("缓存管理器资源清理完成")

class HTTPCacheManager:
    """HTTP缓存管理器"""
    
    def __init__(self, cache_manager: CacheManager, config: CacheConfig):
        self.cache_manager = cache_manager
        self.config = config
    
    def _generate_cache_key(self, request: Request) -> str:
        """生成HTTP请求的缓存键"""
        key_parts = [
            request.method,
            str(request.url),
            request.headers.get("accept", ""),
            request.headers.get("accept-encoding", ""),
        ]
        
        # 添加Vary头指定的头部
        for header in self.config.vary_headers:
            key_parts.append(request.headers.get(header.lower(), ""))
        
        key_string = "|".join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _is_cacheable_request(self, request: Request) -> bool:
        """检查请求是否可缓存"""
        # 只缓存GET和HEAD请求
        if request.method not in ["GET", "HEAD"]:
            return False
        
        # 检查Cache-Control头
        cache_control = request.headers.get("cache-control", "")
        if "no-cache" in cache_control or "no-store" in cache_control:
            return False
        
        return True
    
    def _is_cacheable_response(self, response: Response) -> bool:
        """检查响应是否可缓存"""
        # 只缓存成功响应
        if response.status_code != 200:
            return False
        
        # 检查Cache-Control头
        cache_control = response.headers.get("cache-control", "")
        if "no-cache" in cache_control or "no-store" in cache_control or "private" in cache_control:
            return False
        
        return True
    
    def _generate_etag(self, content: bytes) -> str:
        """生成ETag"""
        return f'"{hashlib.md5(content).hexdigest()}"'
    
    async def get_cached_response(self, request: Request) -> Optional[Tuple[bytes, Dict[str, str]]]:
        """获取缓存的响应"""
        if not self._is_cacheable_request(request):
            return None
        
        cache_key = self._generate_cache_key(request)
        cached_data, hit = await self.cache_manager.get(cache_key)
        
        if hit and cached_data:
            content, headers = cached_data
            
            # 检查ETag
            if self.config.etag_enabled:
                if_none_match = request.headers.get("if-none-match")
                etag = headers.get("etag")
                if if_none_match and etag and if_none_match == etag:
                    return b"", {"status": "304"}  # Not Modified
            
            return content, headers
        
        return None
    
    async def cache_response(self, request: Request, response: Response, 
                           content: bytes) -> None:
        """缓存响应"""
        if not self._is_cacheable_request(request) or not self._is_cacheable_response(response):
            return
        
        cache_key = self._generate_cache_key(request)
        
        # 准备响应头
        headers = dict(response.headers)
        
        # 添加缓存控制头
        headers["cache-control"] = f"public, max-age={self.config.cache_control_max_age}"
        
        # 添加ETag
        if self.config.etag_enabled:
            etag = self._generate_etag(content)
            headers["etag"] = etag
        
        # 添加过期时间
        expires = datetime.now() + timedelta(seconds=self.config.cache_control_max_age)
        headers["expires"] = expires.strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # 缓存响应
        cached_data = (content, headers)
        await self.cache_manager.set(
            cache_key, 
            cached_data, 
            ttl=self.config.cache_control_max_age,
            tags={"http_cache"}
        )

class CachingMiddleware(BaseHTTPMiddleware):
    """缓存中间件"""
    
    def __init__(self, app, config_path: Optional[str] = None):
        super().__init__(app)
        
        # 加载配置
        self.config = self._load_config(config_path)
        
        # 初始化缓存管理器
        self.cache_manager = CacheManager(self.config)
        self.http_cache_manager = HTTPCacheManager(self.cache_manager, self.config)
        
        # 添加指标监听器
        try:
            deps = get_dependencies()
            performance_monitor = deps.get_performance_monitor()
            metrics_listener = MetricsCacheEventListener(performance_monitor)
            self.cache_manager.add_listener(metrics_listener)
        except Exception as e:
            logger.warning(f"无法初始化性能监控: {e}")
        
        logger.info("缓存中间件初始化完成")
    
    def _load_config(self, config_path: Optional[str] = None) -> CacheConfig:
        """加载配置"""
        try:
            if config_path:
                # 从指定路径加载配置
                config_file = Path(config_path)
                if config_file.exists():
                    import yaml
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config_data = yaml.safe_load(f)
                    
                    # 提取缓存配置
                    cache_config = config_data.get('multimodal', {}).get('cache', {})
                    return CacheConfig(**cache_config)
            
            # 尝试从依赖管理器获取配置
            deps = get_dependencies()
            config_manager = deps.get_config_manager()
            
            # 从multimodal配置中提取缓存配置
            multimodal_config_path = Path("config/midware/multimodal_config.yaml")
            if multimodal_config_path.exists():
                import yaml
                with open(multimodal_config_path, 'r', encoding='utf-8') as f:
                    config_data = yaml.safe_load(f)
                
                cache_config = config_data.get('multimodal', {}).get('cache', {})
                return CacheConfig(**cache_config)
            
        except Exception as e:
            logger.warning(f"加载缓存配置失败，使用默认配置: {e}")
        
        return CacheConfig()
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """处理请求"""
        if not self.config.enabled:
            return await call_next(request)
        
        start_time = time.time()
        
        try:
            # 尝试获取缓存的响应
            if self.config.http_cache_enabled:
                cached_response = await self.http_cache_manager.get_cached_response(request)
                if cached_response:
                    content, headers = cached_response
                    
                    # 处理304 Not Modified
                    if headers.get("status") == "304":
                        response = Response(status_code=304)
                    else:
                        response = Response(content=content)
                        for key, value in headers.items():
                            if key != "status":
                                response.headers[key] = value
                    
                    # 添加缓存命中头
                    response.headers["X-Cache"] = "HIT"
                    response.headers["X-Cache-Processing-Time"] = f"{time.time() - start_time:.3f}s"
                    
                    return response
            
            # 执行原始请求
            response = await call_next(request)
            
            # 缓存响应
            if self.config.http_cache_enabled and hasattr(response, 'body'):
                content = response.body
                await self.http_cache_manager.cache_response(request, response, content)
            
            # 添加缓存未命中头
            response.headers["X-Cache"] = "MISS"
            response.headers["X-Cache-Processing-Time"] = f"{time.time() - start_time:.3f}s"
            
            return response
            
        except Exception as e:
            logger.error(f"缓存中间件处理失败: {e}")
            # 发生错误时继续执行原始请求
            response = await call_next(request)
            response.headers["X-Cache"] = "ERROR"
            return response

# 全局缓存管理器实例
_global_cache_manager: Optional[CacheManager] = None

def get_cache_manager() -> CacheManager:
    """获取全局缓存管理器实例"""
    global _global_cache_manager
    if _global_cache_manager is None:
        config = CacheConfig()
        _global_cache_manager = CacheManager(config)
    return _global_cache_manager

async def cache_get(key: Union[str, Dict[str, Any]], default: Any = None) -> Tuple[Any, bool]:
    """获取缓存值的便捷函数"""
    manager = get_cache_manager()
    return await manager.get(key, default)

async def cache_set(key: Union[str, Dict[str, Any]], value: Any,
                   ttl: Optional[int] = None, tags: Optional[Set[str]] = None) -> bool:
    """设置缓存值的便捷函数"""
    manager = get_cache_manager()
    return await manager.set(key, value, ttl, tags)

async def cache_delete(key: Union[str, Dict[str, Any]]) -> bool:
    """删除缓存值的便捷函数"""
    manager = get_cache_manager()
    return await manager.delete(key)

def get_cache_stats() -> Dict[str, Any]:
    """获取缓存统计信息的便捷函数"""
    manager = get_cache_manager()
    return manager.get_stats()

# 装饰器支持
def cached(ttl: Optional[int] = None, tags: Optional[Set[str]] = None):
    """缓存装饰器"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = {
                'function': f"{func.__module__}.{func.__name__}",
                'args': args,
                'kwargs': kwargs
            }
            
            # 尝试获取缓存
            cached_result, hit = await cache_get(cache_key)
            if hit:
                return cached_result
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 缓存结果
            await cache_set(cache_key, result, ttl, tags)
            
            return result
        
        def sync_wrapper(*args, **kwargs):
            # 对于同步函数，使用简单的缓存逻辑
            result = func(*args, **kwargs)
            return result
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

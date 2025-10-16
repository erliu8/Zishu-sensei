"""
缓存管理系统
提供通用的、高性能的缓存管理功能，支持多种存储后端、缓存策略和序列化方式
适用于AI/ML项目的复杂缓存需求
"""

import asyncio
import json
import pickle
import threading
import time
import hashlib
import logging
import weakref
import zlib
from abc import ABC, abstractmethod
from collections import OrderedDict, defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum, auto
from pathlib import Path
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
    Union,
    Callable,
    TypeVar,
    Generic,
)
from concurrent.futures import ThreadPoolExecutor

# 可选导入
try:
    import aiofiles

    AIOFILES_AVAILABLE = True
except ImportError:
    logger.warning("aiofiles未安装，FileBackend功能受限")
    AIOFILES_AVAILABLE = False

# 配置日志
logger = logging.getLogger(__name__)

# 类型变量
K = TypeVar("K")  # Key type
V = TypeVar("V")  # Value type

# ================================
# 核心枚举和常量定义
# ================================


class CacheStrategy(Enum):
    """缓存策略枚举"""

    LRU = "lru"  # 最近最少使用
    LFU = "lfu"  # 最不经常使用
    FIFO = "fifo"  # 先进先出
    LIFO = "lifo"  # 后进先出
    TTL = "ttl"  # 基于时间的过期
    ADAPTIVE = "adaptive"  # 自适应策略
    RANDOM = "random"  # 随机淘汰


class StorageBackend(Enum):
    """存储后端枚举"""

    MEMORY = "memory"
    FILE = "file"
    REDIS = "redis"
    SQLITE = "sqlite"
    HYBRID = "hybrid"


class SerializationType(Enum):
    """序列化类型枚举"""

    JSON = "json"
    PICKLE = "pickle"
    MSGPACK = "msgpack"
    CUSTOM = "custom"


class CompressionType(Enum):
    """压缩类型枚举"""

    NONE = "none"
    ZLIB = "zlib"
    GZIP = "gzip"
    LZ4 = "lz4"


# ================================
# 数据类定义
# ================================


@dataclass
class CacheEntry:
    """缓存条目"""

    value: Any
    created_at: float
    accessed_at: float
    access_count: int = 0
    ttl: Optional[int] = None
    tags: Set[str] = field(default_factory=set)
    size: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """检查是否过期"""
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def update_access(self) -> None:
        """更新访问信息"""
        self.accessed_at = time.time()
        self.access_count += 1


@dataclass
class CacheStats:
    """缓存统计信息"""

    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    memory_usage: int = 0
    hit_rate: float = 0.0

    def update_hit_rate(self) -> None:
        """更新命中率"""
        total = self.hits + self.misses
        self.hit_rate = (self.hits / total) if total > 0 else 0.0


@dataclass
class CacheConfig:
    """缓存配置"""

    # 基本配置
    max_size: int = 1000
    max_memory_mb: int = 100
    default_ttl: Optional[int] = 3600  # 1小时
    strategy: CacheStrategy = CacheStrategy.LRU
    storage_backend: StorageBackend = StorageBackend.MEMORY

    # 序列化配置
    serialization: SerializationType = SerializationType.PICKLE
    compression: CompressionType = CompressionType.ZLIB
    compression_threshold: int = 1024  # 1KB

    # 清理配置
    cleanup_interval: int = 300  # 5分钟
    max_idle_time: int = 1800  # 30分钟

    # 持久化配置
    persistence_enabled: bool = False
    persistence_path: Optional[str] = None

    # 监控配置
    stats_enabled: bool = True
    async_enabled: bool = True


# ================================
# 抽象基类
# ================================


class CacheSerializer(ABC):
    """缓存序列化器抽象基类"""

    @abstractmethod
    def serialize(self, data: Any) -> bytes:
        """序列化数据"""
        pass

    @abstractmethod
    def deserialize(self, data: bytes) -> Any:
        """反序列化数据"""
        pass


class CacheCompressor(ABC):
    """缓存压缩器抽象基类"""

    @abstractmethod
    def compress(self, data: bytes) -> bytes:
        """压缩数据"""
        pass

    @abstractmethod
    def decompress(self, data: bytes) -> bytes:
        """解压数据"""
        pass


class CacheBackend(ABC):
    """缓存后端抽象基类"""

    @abstractmethod
    async def get(self, key: str) -> Optional[bytes]:
        """获取缓存值"""
        pass

    @abstractmethod
    async def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
        """设置缓存值"""
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """删除缓存项"""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """清空缓存"""
        pass

    @abstractmethod
    async def keys(self, pattern: Optional[str] = None) -> List[str]:
        """获取所有键"""
        pass


# ================================
# 序列化器实现
# ================================


class JsonSerializer(CacheSerializer):
    """JSON序列化器"""

    def serialize(self, data: Any) -> bytes:
        try:
            return json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        except (TypeError, ValueError) as e:
            logger.error(f"JSON序列化失败: {e}")
            raise

    def deserialize(self, data: bytes) -> Any:
        try:
            return json.loads(data.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error(f"JSON反序列化失败: {e}")
            raise


class PickleSerializer(CacheSerializer):
    """Pickle序列化器"""

    def serialize(self, data: Any) -> bytes:
        try:
            return pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        except (pickle.PickleError, TypeError) as e:
            logger.error(f"Pickle序列化失败: {e}")
            raise

    def deserialize(self, data: bytes) -> Any:
        try:
            return pickle.loads(data)
        except (pickle.PickleError, EOFError) as e:
            logger.error(f"Pickle反序列化失败: {e}")
            raise


try:
    import msgpack

    class MsgPackSerializer(CacheSerializer):
        """MessagePack序列化器"""

        def serialize(self, data: Any) -> bytes:
            try:
                return msgpack.packb(data, use_bin_type=True)
            except (msgpack.exceptions.PackException, TypeError) as e:
                logger.error(f"MessagePack序列化失败: {e}")
                raise

        def deserialize(self, data: bytes) -> Any:
            try:
                return msgpack.unpackb(data, raw=False, strict_map_key=False)
            except (msgpack.exceptions.UnpackException, ValueError) as e:
                logger.error(f"MessagePack反序列化失败: {e}")
                raise

except ImportError:
    logger.warning("msgpack未安装，MsgPackSerializer不可用")
    MsgPackSerializer = None

# ================================
# 压缩器实现
# ================================


class NoCompressor(CacheCompressor):
    """无压缩器"""

    def compress(self, data: bytes) -> bytes:
        return data

    def decompress(self, data: bytes) -> bytes:
        return data


class ZlibCompressor(CacheCompressor):
    """zlib压缩器"""

    def __init__(self, level: int = 6):
        self.level = level

    def compress(self, data: bytes) -> bytes:
        try:
            return zlib.compress(data, self.level)
        except zlib.error as e:
            logger.error(f"zlib压缩失败: {e}")
            raise

    def decompress(self, data: bytes) -> bytes:
        try:
            return zlib.decompress(data)
        except zlib.error as e:
            logger.error(f"zlib解压失败: {e}")
            raise


try:
    import gzip

    class GzipCompressor(CacheCompressor):
        """gzip压缩器"""

        def __init__(self, level: int = 6):
            self.level = level

        def compress(self, data: bytes) -> bytes:
            try:
                return gzip.compress(data, compresslevel=self.level)
            except Exception as e:
                logger.error(f"gzip压缩失败: {e}")
                raise

        def decompress(self, data: bytes) -> bytes:
            try:
                return gzip.decompress(data)
            except Exception as e:
                logger.error(f"gzip解压失败: {e}")
                raise

except ImportError:
    GzipCompressor = None

try:
    import lz4.frame

    class Lz4Compressor(CacheCompressor):
        """LZ4压缩器"""

        def compress(self, data: bytes) -> bytes:
            try:
                return lz4.frame.compress(data)
            except Exception as e:
                logger.error(f"LZ4压缩失败: {e}")
                raise

        def decompress(self, data: bytes) -> bytes:
            try:
                return lz4.frame.decompress(data)
            except Exception as e:
                logger.error(f"LZ4解压失败: {e}")
                raise

except ImportError:
    logger.warning("lz4未安装，Lz4Compressor不可用")
    Lz4Compressor = None

# ================================
# 缓存策略实现
# ================================


class CacheEvictionStrategy(ABC):
    """缓存淘汰策略抽象基类"""

    @abstractmethod
    def should_evict(self, entries: Dict[str, CacheEntry], max_size: int) -> List[str]:
        """确定需要淘汰的键列表"""
        pass

    @abstractmethod
    def on_access(self, key: str, entry: CacheEntry) -> None:
        """访问时的回调"""
        pass

    @abstractmethod
    def on_set(self, key: str, entry: CacheEntry) -> None:
        """设置时的回调"""
        pass


class LRUStrategy(CacheEvictionStrategy):
    """LRU (Least Recently Used) 策略"""

    def __init__(self):
        self.access_order = OrderedDict()

    def should_evict(self, entries: Dict[str, CacheEntry], max_size: int) -> List[str]:
        """淘汰最近最少使用的项目"""
        if len(entries) <= max_size:
            return []

        # 按访问时间排序，淘汰最老的
        sorted_keys = sorted(entries.keys(), key=lambda k: entries[k].accessed_at)
        return sorted_keys[: len(entries) - max_size]

    def on_access(self, key: str, entry: CacheEntry) -> None:
        """更新访问顺序"""
        if key in self.access_order:
            del self.access_order[key]
        self.access_order[key] = True

    def on_set(self, key: str, entry: CacheEntry) -> None:
        """记录新项"""
        self.access_order[key] = True


class LFUStrategy(CacheEvictionStrategy):
    """LFU (Least Frequently Used) 策略"""

    def should_evict(self, entries: Dict[str, CacheEntry], max_size: int) -> List[str]:
        """淘汰最不经常使用的项目"""
        if len(entries) <= max_size:
            return []

        # 按访问次数排序，淘汰访问次数最少的
        sorted_keys = sorted(entries.keys(), key=lambda k: entries[k].access_count)
        return sorted_keys[: len(entries) - max_size]

    def on_access(self, key: str, entry: CacheEntry) -> None:
        """LFU策略不需要额外处理"""
        pass

    def on_set(self, key: str, entry: CacheEntry) -> None:
        """LFU策略不需要额外处理"""
        pass


class FIFOStrategy(CacheEvictionStrategy):
    """FIFO (First In First Out) 策略"""

    def should_evict(self, entries: Dict[str, CacheEntry], max_size: int) -> List[str]:
        """淘汰最早添加的项目"""
        if len(entries) <= max_size:
            return []

        # 按创建时间排序，淘汰最早的
        sorted_keys = sorted(entries.keys(), key=lambda k: entries[k].created_at)
        return sorted_keys[: len(entries) - max_size]

    def on_access(self, key: str, entry: CacheEntry) -> None:
        """FIFO策略不需要额外处理"""
        pass

    def on_set(self, key: str, entry: CacheEntry) -> None:
        """FIFO策略不需要额外处理"""
        pass


class TTLStrategy(CacheEvictionStrategy):
    """TTL (Time To Live) 策略"""

    def should_evict(self, entries: Dict[str, CacheEntry], max_size: int) -> List[str]:
        """淘汰过期的项目"""
        expired_keys = [key for key, entry in entries.items() if entry.is_expired()]

        # 如果还是超过限制，按TTL剩余时间排序
        if len(entries) - len(expired_keys) > max_size:
            remaining_entries = {k: v for k, v in entries.items() if not v.is_expired()}
            sorted_keys = sorted(
                remaining_entries.keys(),
                key=lambda k: remaining_entries[k].created_at
                + (remaining_entries[k].ttl or 0),
            )
            expired_keys.extend(sorted_keys[: len(remaining_entries) - max_size])

        return expired_keys

    def on_access(self, key: str, entry: CacheEntry) -> None:
        """TTL策略不需要额外处理"""
        pass

    def on_set(self, key: str, entry: CacheEntry) -> None:
        """TTL策略不需要额外处理"""
        pass


# ================================
# 存储后端实现
# ================================


class MemoryBackend(CacheBackend):
    """内存存储后端"""

    def __init__(self):
        self._storage: Dict[str, bytes] = {}
        self._ttl_storage: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[bytes]:
        async with self._lock:
            if key not in self._storage:
                return None

            # 检查TTL
            if key in self._ttl_storage:
                if time.time() > self._ttl_storage[key]:
                    await self.delete(key)
                    return None

            return self._storage[key]

    async def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
        async with self._lock:
            self._storage[key] = value
            if ttl is not None:
                self._ttl_storage[key] = time.time() + ttl
            elif key in self._ttl_storage:
                del self._ttl_storage[key]
            return True

    async def delete(self, key: str) -> bool:
        async with self._lock:
            deleted = key in self._storage
            self._storage.pop(key, None)
            self._ttl_storage.pop(key, None)
            return deleted

    async def exists(self, key: str) -> bool:
        return await self.get(key) is not None

    async def clear(self) -> None:
        async with self._lock:
            self._storage.clear()
            self._ttl_storage.clear()

    async def keys(self, pattern: Optional[str] = None) -> List[str]:
        async with self._lock:
            if pattern is None:
                return list(self._storage.keys())

            import fnmatch

            return [
                key for key in self._storage.keys() if fnmatch.fnmatch(key, pattern)
            ]


class FileBackend(CacheBackend):
    """文件存储后端"""

    def __init__(self, cache_dir: str = "cache", max_file_size: int = 50 * 1024 * 1024):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.max_file_size = max_file_size
        self._lock = asyncio.Lock()

    def _get_file_path(self, key: str) -> Path:
        """获取缓存文件路径"""
        # 使用hash避免文件名问题
        hash_key = hashlib.md5(key.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{hash_key}.cache"

    def _get_meta_path(self, key: str) -> Path:
        """获取元数据文件路径"""
        hash_key = hashlib.md5(key.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{hash_key}.meta"

    async def get(self, key: str) -> Optional[bytes]:
        async with self._lock:
            file_path = self._get_file_path(key)
            meta_path = self._get_meta_path(key)

            if not file_path.exists():
                return None

            # 检查TTL
            if meta_path.exists():
                try:
                    async with aiofiles.open(meta_path, "r") as f:
                        meta_data = json.loads(await f.read())
                        if (
                            "expires_at" in meta_data
                            and time.time() > meta_data["expires_at"]
                        ):
                            await self.delete(key)
                            return None
                except Exception as e:
                    logger.warning(f"读取元数据失败: {e}")

            try:
                async with aiofiles.open(file_path, "rb") as f:
                    return await f.read()
            except Exception as e:
                logger.error(f"读取缓存文件失败: {e}")
                return None

    async def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
        async with self._lock:
            if len(value) > self.max_file_size:
                logger.warning(f"缓存值过大，超过限制 {self.max_file_size} 字节")
                return False

            file_path = self._get_file_path(key)
            meta_path = self._get_meta_path(key)

            try:
                # 写入缓存文件
                async with aiofiles.open(file_path, "wb") as f:
                    await f.write(value)

                # 写入元数据
                if ttl is not None:
                    meta_data = {"expires_at": time.time() + ttl}
                    async with aiofiles.open(meta_path, "w") as f:
                        await f.write(json.dumps(meta_data))
                elif meta_path.exists():
                    meta_path.unlink()

                return True
            except Exception as e:
                logger.error(f"写入缓存文件失败: {e}")
                return False

    async def delete(self, key: str) -> bool:
        async with self._lock:
            file_path = self._get_file_path(key)
            meta_path = self._get_meta_path(key)

            deleted = False
            if file_path.exists():
                file_path.unlink()
                deleted = True

            if meta_path.exists():
                meta_path.unlink()

            return deleted

    async def exists(self, key: str) -> bool:
        return await self.get(key) is not None

    async def clear(self) -> None:
        async with self._lock:
            for file_path in self.cache_dir.glob("*.cache"):
                file_path.unlink()
            for meta_path in self.cache_dir.glob("*.meta"):
                meta_path.unlink()

    async def keys(self, pattern: Optional[str] = None) -> List[str]:
        # 文件后端无法高效地列出所有键，返回空列表
        # 实际项目中可以维护一个键的索引文件
        logger.warning("FileBackend不支持keys操作")
        return []


# Redis后端（可选）
try:
    from redis import asyncio as aioredis

    class RedisBackend(CacheBackend):
        """Redis存储后端"""

        def __init__(
            self,
            redis_url: str = "redis://localhost:6379",
            db: int = 0,
            prefix: str = "cache:",
        ):
            self.redis_url = redis_url
            self.db = db
            self.prefix = prefix
            self._redis: Optional[aioredis.Redis] = None

        async def _get_redis(self) -> aioredis.Redis:
            """获取Redis连接"""
            if self._redis is None:
                self._redis = aioredis.from_url(
                    self.redis_url, db=self.db, decode_responses=False
                )
            return self._redis

        def _make_key(self, key: str) -> str:
            """生成带前缀的键"""
            return f"{self.prefix}{key}"

        async def get(self, key: str) -> Optional[bytes]:
            try:
                redis = await self._get_redis()
                value = await redis.get(self._make_key(key))
                return value
            except Exception as e:
                logger.error(f"Redis获取失败: {e}")
                return None

        async def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
            try:
                redis = await self._get_redis()
                await redis.set(self._make_key(key), value, ex=ttl)
                return True
            except Exception as e:
                logger.error(f"Redis设置失败: {e}")
                return False

        async def delete(self, key: str) -> bool:
            try:
                redis = await self._get_redis()
                result = await redis.delete(self._make_key(key))
                return result > 0
            except Exception as e:
                logger.error(f"Redis删除失败: {e}")
                return False

        async def exists(self, key: str) -> bool:
            try:
                redis = await self._get_redis()
                result = await redis.exists(self._make_key(key))
                return result > 0
            except Exception as e:
                logger.error(f"Redis检查存在失败: {e}")
                return False

        async def clear(self) -> None:
            try:
                redis = await self._get_redis()
                keys = await redis.keys(f"{self.prefix}*")
                if keys:
                    await redis.delete(*keys)
            except Exception as e:
                logger.error(f"Redis清空失败: {e}")

        async def keys(self, pattern: Optional[str] = None) -> List[str]:
            try:
                redis = await self._get_redis()
                if pattern:
                    redis_keys = await redis.keys(f"{self.prefix}{pattern}")
                else:
                    redis_keys = await redis.keys(f"{self.prefix}*")

                # 去除前缀
                return [key.decode("utf-8")[len(self.prefix) :] for key in redis_keys]
            except Exception as e:
                logger.error(f"Redis获取键列表失败: {e}")
                return []

        async def close(self):
            """关闭Redis连接"""
            if self._redis:
                await self._redis.close()

except ImportError:
    logger.warning("aioredis未安装，RedisBackend不可用")
    RedisBackend = None

# ================================
# 工厂函数
# ================================


def create_serializer(serialization: SerializationType) -> CacheSerializer:
    """创建序列化器"""
    if serialization == SerializationType.JSON:
        return JsonSerializer()
    elif serialization == SerializationType.PICKLE:
        return PickleSerializer()
    elif serialization == SerializationType.MSGPACK:
        if MsgPackSerializer is not None:
            return MsgPackSerializer()
        else:
            logger.warning("msgpack不可用，使用pickle序列化器")
            return PickleSerializer()
    else:
        raise ValueError(f"不支持的序列化类型: {serialization}")


def create_compressor(compression: CompressionType) -> CacheCompressor:
    """创建压缩器"""
    if compression == CompressionType.NONE:
        return NoCompressor()
    elif compression == CompressionType.ZLIB:
        return ZlibCompressor()
    elif compression == CompressionType.GZIP:
        if GzipCompressor is not None:
            return GzipCompressor()
        else:
            logger.warning("gzip不可用，使用zlib压缩器")
            return ZlibCompressor()
    elif compression == CompressionType.LZ4:
        if Lz4Compressor is not None:
            return Lz4Compressor()
        else:
            logger.warning("lz4不可用，使用zlib压缩器")
            return ZlibCompressor()
    else:
        raise ValueError(f"不支持的压缩类型: {compression}")


def create_strategy(strategy: CacheStrategy) -> CacheEvictionStrategy:
    """创建缓存策略"""
    if strategy == CacheStrategy.LRU:
        return LRUStrategy()
    elif strategy == CacheStrategy.LFU:
        return LFUStrategy()
    elif strategy == CacheStrategy.FIFO:
        return FIFOStrategy()
    elif strategy == CacheStrategy.TTL:
        return TTLStrategy()
    else:
        # 对于ADAPTIVE和RANDOM等复杂策略，先使用LRU
        logger.warning(f"策略 {strategy} 暂未实现，使用LRU策略")
        return LRUStrategy()


def create_backend(storage: StorageBackend, **kwargs) -> CacheBackend:
    """创建存储后端"""
    if storage == StorageBackend.MEMORY:
        return MemoryBackend()
    elif storage == StorageBackend.FILE:
        return FileBackend(**kwargs)
    elif storage == StorageBackend.REDIS:
        if RedisBackend is not None:
            return RedisBackend(**kwargs)
        else:
            logger.warning("Redis不可用，使用内存后端")
            return MemoryBackend()
    else:
        raise ValueError(f"不支持的存储后端: {storage}")


# ================================
# 核心缓存类
# ================================


class Cache:
    """通用缓存管理器"""

    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()

        # 初始化组件
        self.serializer = create_serializer(self.config.serialization)
        self.compressor = create_compressor(self.config.compression)
        self.strategy = create_strategy(self.config.strategy)
        self.backend = create_backend(self.config.storage_backend)

        # 内部状态
        self._entries: Dict[str, CacheEntry] = {}
        self._stats = CacheStats()
        self._lock = asyncio.Lock() if self.config.async_enabled else threading.RLock()
        self._cleanup_task: Optional[asyncio.Task] = None

        # 启动清理任务
        if self.config.async_enabled:
            self._start_cleanup_task()

    def _start_cleanup_task(self):
        """启动后台清理任务"""
        if self.config.cleanup_interval > 0:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def _periodic_cleanup(self):
        """周期性清理任务"""
        while True:
            try:
                await asyncio.sleep(self.config.cleanup_interval)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"清理任务异常: {e}")

    async def _cleanup_expired(self):
        """清理过期项"""
        async with self._lock:
            current_time = time.time()
            expired_keys = []

            for key, entry in self._entries.items():
                if entry.is_expired():
                    expired_keys.append(key)
                elif (current_time - entry.accessed_at) > self.config.max_idle_time:
                    expired_keys.append(key)

            for key in expired_keys:
                await self._remove_entry(key)

    def _generate_cache_key(self, key: Any) -> str:
        """生成缓存键"""
        if isinstance(key, str):
            return key
        elif isinstance(key, (dict, list, tuple)):
            # 对复杂对象生成hash
            key_str = json.dumps(key, sort_keys=True, default=str)
            return hashlib.md5(key_str.encode("utf-8")).hexdigest()
        else:
            return str(key)

    def _serialize_data(self, data: Any) -> bytes:
        """序列化数据"""
        serialized = self.serializer.serialize(data)

        # 如果数据超过阈值，进行压缩
        if len(serialized) > self.config.compression_threshold:
            serialized = self.compressor.compress(serialized)

        return serialized

    def _deserialize_data(self, data: bytes) -> Any:
        """反序列化数据"""
        # 尝试解压
        try:
            if self.compressor.__class__.__name__ != "NoCompressor":
                data = self.compressor.decompress(data)
        except Exception:
            # 如果解压失败，可能是未压缩的数据
            pass

        return self.serializer.deserialize(data)

    async def _evict_if_needed(self):
        """根据策略淘汰缓存项"""
        if len(self._entries) <= self.config.max_size:
            return

        keys_to_evict = self.strategy.should_evict(self._entries, self.config.max_size)
        for key in keys_to_evict:
            await self._remove_entry(key)
            self._stats.evictions += 1

    async def _remove_entry(self, key: str):
        """移除缓存项"""
        if key in self._entries:
            # 从后端删除
            await self.backend.delete(key)
            # 从内存删除
            del self._entries[key]

    async def get(self, key: Any, default: Any = None) -> Any:
        """获取缓存值"""
        cache_key = self._generate_cache_key(key)

        if self.config.async_enabled:
            async with self._lock:
                return await self._get_impl(cache_key, default)
        else:
            with self._lock:
                # 同步版本需要创建事件循环
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(self._get_impl(cache_key, default))
                finally:
                    loop.close()

    async def _get_impl(self, cache_key: str, default: Any) -> Any:
        """获取实现"""
        try:
            # 先检查内存缓存
            if cache_key in self._entries:
                entry = self._entries[cache_key]
                if not entry.is_expired():
                    entry.update_access()
                    self.strategy.on_access(cache_key, entry)
                    self._stats.hits += 1
                    return entry.value
                else:
                    await self._remove_entry(cache_key)

            # 从后端获取
            data = await self.backend.get(cache_key)
            if data is not None:
                value = self._deserialize_data(data)

                # 重新加载到内存（如果有配置的话）
                entry = CacheEntry(
                    value=value,
                    created_at=time.time(),
                    accessed_at=time.time(),
                    access_count=1,
                )
                self._entries[cache_key] = entry
                self.strategy.on_access(cache_key, entry)
                self._stats.hits += 1
                return value

            self._stats.misses += 1
            return default

        except Exception as e:
            logger.error(f"获取缓存失败: {e}")
            self._stats.misses += 1
            return default

    async def set(
        self,
        key: Any,
        value: Any,
        ttl: Optional[int] = None,
        tags: Optional[Set[str]] = None,
    ) -> bool:
        """设置缓存值"""
        cache_key = self._generate_cache_key(key)
        ttl = ttl or self.config.default_ttl
        tags = tags or set()

        if self.config.async_enabled:
            async with self._lock:
                return await self._set_impl(cache_key, value, ttl, tags)
        else:
            with self._lock:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(
                        self._set_impl(cache_key, value, ttl, tags)
                    )
                finally:
                    loop.close()

    async def _set_impl(
        self, cache_key: str, value: Any, ttl: Optional[int], tags: Set[str]
    ) -> bool:
        """设置实现"""
        try:
            # 序列化数据
            serialized_data = self._serialize_data(value)

            # 存储到后端
            success = await self.backend.set(cache_key, serialized_data, ttl)

            if success:
                # 创建内存条目
                entry = CacheEntry(
                    value=value,
                    created_at=time.time(),
                    accessed_at=time.time(),
                    access_count=0,
                    ttl=ttl,
                    tags=tags,
                    size=len(serialized_data),
                )

                self._entries[cache_key] = entry
                self.strategy.on_set(cache_key, entry)

                # 更新统计
                self._stats.size += 1
                self._stats.memory_usage += entry.size

                # 执行淘汰策略
                await self._evict_if_needed()

                return True

            return False

        except Exception as e:
            logger.error(f"设置缓存失败: {e}")
            return False

    async def delete(self, key: Any) -> bool:
        """删除缓存值"""
        cache_key = self._generate_cache_key(key)

        if self.config.async_enabled:
            async with self._lock:
                return await self._delete_impl(cache_key)
        else:
            with self._lock:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(self._delete_impl(cache_key))
                finally:
                    loop.close()

    async def _delete_impl(self, cache_key: str) -> bool:
        """删除实现"""
        try:
            # 从内存删除
            if cache_key in self._entries:
                entry = self._entries[cache_key]
                self._stats.size -= 1
                self._stats.memory_usage -= entry.size
                del self._entries[cache_key]

            # 从后端删除
            return await self.backend.delete(cache_key)
        except Exception as e:
            logger.error(f"删除缓存失败: {e}")
            return False

    async def clear(self):
        """清空所有缓存"""
        if self.config.async_enabled:
            async with self._lock:
                await self._clear_impl()
        else:
            with self._lock:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(self._clear_impl())
                finally:
                    loop.close()

    async def _clear_impl(self):
        """清空实现"""
        try:
            self._entries.clear()
            self._stats = CacheStats()
            await self.backend.clear()
        except Exception as e:
            logger.error(f"清空缓存失败: {e}")

    async def exists(self, key: Any) -> bool:
        """检查键是否存在"""
        cache_key = self._generate_cache_key(key)

        if cache_key in self._entries and not self._entries[cache_key].is_expired():
            return True

        return await self.backend.exists(cache_key)

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        self._stats.update_hit_rate()
        return asdict(self._stats)

    async def get_keys(self, pattern: Optional[str] = None) -> List[str]:
        """获取所有键"""
        return await self.backend.keys(pattern)

    async def invalidate_by_tags(self, tags: Set[str]):
        """根据标签失效缓存"""
        keys_to_remove = []

        if self.config.async_enabled:
            async with self._lock:
                for key, entry in self._entries.items():
                    if entry.tags.intersection(tags):
                        keys_to_remove.append(key)
        else:
            with self._lock:
                for key, entry in self._entries.items():
                    if entry.tags.intersection(tags):
                        keys_to_remove.append(key)

        for key in keys_to_remove:
            await self.delete(key)

    async def close(self):
        """关闭缓存管理器"""
        if self._cleanup_task:
            self._cleanup_task.cancel()

        if hasattr(self.backend, "close"):
            await self.backend.close()


# ================================
# 实用工具和装饰器
# ================================


def cached(
    cache: Optional[Cache] = None,
    ttl: Optional[int] = None,
    tags: Optional[Set[str]] = None,
    key_func: Optional[Callable] = None,
):
    """缓存装饰器"""

    def decorator(func: Callable) -> Callable:
        async def async_wrapper(*args, **kwargs):
            nonlocal cache
            if cache is None:
                cache = get_default_cache()

            # 生成缓存键
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = {
                    "function": f"{func.__module__}.{func.__name__}",
                    "args": args,
                    "kwargs": kwargs,
                }

            # 尝试获取缓存
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result

            # 执行函数
            result = await func(*args, **kwargs)

            # 缓存结果
            await cache.set(cache_key, result, ttl, tags)

            return result

        def sync_wrapper(*args, **kwargs):
            nonlocal cache
            if cache is None:
                cache = get_default_cache()

            # 生成缓存键
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = {
                    "function": f"{func.__module__}.{func.__name__}",
                    "args": args,
                    "kwargs": kwargs,
                }

            # 使用同步接口
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # 尝试获取缓存
                cached_result = loop.run_until_complete(cache.get(cache_key))
                if cached_result is not None:
                    return cached_result

                # 执行函数
                result = func(*args, **kwargs)

                # 缓存结果
                loop.run_until_complete(cache.set(cache_key, result, ttl, tags))

                return result
            finally:
                loop.close()

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ================================
# 全局缓存实例管理
# ================================

_default_cache: Optional[Cache] = None
_cache_instances: Dict[str, Cache] = {}


def get_default_cache() -> Cache:
    """获取默认缓存实例"""
    global _default_cache
    if _default_cache is None:
        _default_cache = Cache()
    return _default_cache


def set_default_cache(cache: Cache):
    """设置默认缓存实例"""
    global _default_cache
    _default_cache = cache


def get_cache(name: str = "default") -> Cache:
    """获取命名缓存实例"""
    if name == "default":
        return get_default_cache()

    if name not in _cache_instances:
        _cache_instances[name] = Cache()

    return _cache_instances[name]


def create_cache(name: str, config: CacheConfig) -> Cache:
    """创建命名缓存实例"""
    cache = Cache(config)
    _cache_instances[name] = cache
    return cache


# ================================
# 便捷函数
# ================================


async def cache_get(key: Any, default: Any = None, cache_name: str = "default") -> Any:
    """便捷获取缓存"""
    cache = get_cache(cache_name)
    return await cache.get(key, default)


async def cache_set(
    key: Any,
    value: Any,
    ttl: Optional[int] = None,
    tags: Optional[Set[str]] = None,
    cache_name: str = "default",
) -> bool:
    """便捷设置缓存"""
    cache = get_cache(cache_name)
    return await cache.set(key, value, ttl, tags)


async def cache_delete(key: Any, cache_name: str = "default") -> bool:
    """便捷删除缓存"""
    cache = get_cache(cache_name)
    return await cache.delete(key)


async def cache_clear(cache_name: str = "default"):
    """便捷清空缓存"""
    cache = get_cache(cache_name)
    await cache.clear()


# ================================
# 上下文管理器
# ================================


@asynccontextmanager
async def cache_transaction(cache: Optional[Cache] = None):
    """缓存事务上下文管理器（批量操作）"""
    if cache is None:
        cache = get_default_cache()

    # 这里可以实现批量操作逻辑
    # 目前简单实现
    try:
        yield cache
    finally:
        pass


# ================================
# 向后兼容性别名
# ================================

# 为了保持与其他模块的兼容性
CacheManager = Cache


# 导出主要类和函数
__all__ = [
    # 枚举
    "CacheStrategy",
    "StorageBackend",
    "SerializationType",
    "CompressionType",
    # 数据类
    "CacheEntry",
    "CacheStats",
    "CacheConfig",
    # 核心类
    "Cache",
    "CacheManager",  # 别名
    "CacheBackend",
    "CacheSerializer",
    "CacheCompressor",
    "CacheEvictionStrategy",
    # 实现类
    "MemoryBackend",
    "FileBackend",
    "RedisBackend",
    "JsonSerializer",
    "PickleSerializer",
    "MsgPackSerializer",
    "NoCompressor",
    "ZlibCompressor",
    "GzipCompressor",
    "Lz4Compressor",
    "LRUStrategy",
    "LFUStrategy",
    "FIFOStrategy",
    "TTLStrategy",
    # 装饰器和工具函数
    "cached",
    "cache_get",
    "cache_set",
    "cache_delete",
    "cache_clear",
    "get_cache",
    "get_default_cache",
    "create_cache",
    "cache_transaction",
]

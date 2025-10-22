"""
缓存工具函数
"""
import json
import hashlib
from typing import Any, Optional, Callable, TypeVar, ParamSpec
from functools import wraps
import inspect

from app.db.redis import redis_client
from app.core.config.settings import settings


P = ParamSpec("P")
T = TypeVar("T")


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    生成缓存键
    
    Args:
        prefix: 键前缀
        *args: 位置参数
        **kwargs: 关键字参数
    
    Returns:
        str: 缓存键
    """
    # 将参数序列化为字符串
    params_str = json.dumps(
        {"args": args, "kwargs": kwargs},
        sort_keys=True,
        default=str
    )
    
    # 生成哈希值
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    
    return f"{prefix}:{params_hash}"


async def get_cached(
    key: str,
    default: Optional[Any] = None,
) -> Optional[Any]:
    """
    获取缓存值
    
    Args:
        key: 缓存键
        default: 默认值
    
    Returns:
        缓存值或默认值
    """
    try:
        value = await redis_client.get_json(key)
        return value if value is not None else default
    except Exception:
        return default


async def set_cached(
    key: str,
    value: Any,
    expire: Optional[int] = None,
) -> bool:
    """
    设置缓存值
    
    Args:
        key: 缓存键
        value: 缓存值
        expire: 过期时间（秒）
    
    Returns:
        bool: 是否成功
    """
    try:
        if expire is None:
            expire = settings.CACHE_EXPIRE_SECONDS
        return await redis_client.set_json(key, value, expire)
    except Exception:
        return False


async def delete_cached(key: str) -> bool:
    """
    删除缓存
    
    Args:
        key: 缓存键
    
    Returns:
        bool: 是否成功
    """
    try:
        return await redis_client.delete(key)
    except Exception:
        return False


async def delete_pattern(pattern: str) -> int:
    """
    删除匹配模式的所有缓存
    
    Args:
        pattern: 键模式（支持通配符）
    
    Returns:
        int: 删除的键数量
    """
    try:
        if not redis_client.redis:
            return 0
        
        keys = []
        async for key in redis_client.redis.scan_iter(match=pattern):
            keys.append(key)
        
        if keys:
            return await redis_client.redis.delete(*keys)
        return 0
    except Exception:
        return 0


def cache(
    prefix: str,
    expire: Optional[int] = None,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    缓存装饰器（用于异步函数）
    
    Args:
        prefix: 缓存键前缀
        expire: 过期时间（秒）
        key_builder: 自定义键生成函数
    
    Usage:
        @cache(prefix="user", expire=300)
        async def get_user(user_id: int):
            return await db.get_user(user_id)
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            # 生成缓存键
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = generate_cache_key(prefix, *args, **kwargs)
            
            # 尝试从缓存获取
            cached_value = await get_cached(cache_key)
            if cached_value is not None:
                return cached_value
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            if result is not None:
                await set_cached(cache_key, result, expire)
            
            return result
        
        return wrapper
    return decorator


def cache_model(
    prefix: str,
    expire: Optional[int] = None,
    id_param: str = "id",
):
    """
    模型缓存装饰器（用于数据库查询）
    
    Args:
        prefix: 缓存键前缀
        expire: 过期时间（秒）
        id_param: ID 参数名
    
    Usage:
        @cache_model(prefix="user", id_param="user_id")
        async def get_user_by_id(db: AsyncSession, user_id: int):
            return await db.get(User, user_id)
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            # 获取 ID 参数
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            
            item_id = bound_args.arguments.get(id_param)
            if item_id is None:
                # 如果没有 ID，直接执行函数
                return await func(*args, **kwargs)
            
            # 生成缓存键
            cache_key = f"{prefix}:{item_id}"
            
            # 尝试从缓存获取
            cached_value = await get_cached(cache_key)
            if cached_value is not None:
                return cached_value
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            if result is not None:
                # 如果结果是 Pydantic 模型，转换为字典
                if hasattr(result, "model_dump"):
                    cache_data = result.model_dump()
                elif hasattr(result, "dict"):
                    cache_data = result.dict()
                else:
                    cache_data = result
                
                await set_cached(cache_key, cache_data, expire)
            
            return result
        
        return wrapper
    return decorator


async def invalidate_cache(prefix: str, *args, **kwargs) -> bool:
    """
    使缓存失效
    
    Args:
        prefix: 缓存键前缀
        *args: 位置参数
        **kwargs: 关键字参数
    
    Returns:
        bool: 是否成功
    """
    cache_key = generate_cache_key(prefix, *args, **kwargs)
    return await delete_cached(cache_key)


async def invalidate_model_cache(prefix: str, item_id: Any) -> bool:
    """
    使模型缓存失效
    
    Args:
        prefix: 缓存键前缀
        item_id: 项目 ID
    
    Returns:
        bool: 是否成功
    """
    cache_key = f"{prefix}:{item_id}"
    return await delete_cached(cache_key)


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, prefix: str):
        """
        初始化缓存管理器
        
        Args:
            prefix: 缓存键前缀
        """
        self.prefix = prefix
    
    def get_key(self, *args, **kwargs) -> str:
        """
        获取缓存键
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
        
        Returns:
            str: 缓存键
        """
        return generate_cache_key(self.prefix, *args, **kwargs)
    
    async def get(self, *args, **kwargs) -> Optional[Any]:
        """
        获取缓存
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
        
        Returns:
            缓存值
        """
        key = self.get_key(*args, **kwargs)
        return await get_cached(key)
    
    async def set(
        self,
        value: Any,
        expire: Optional[int] = None,
        *args,
        **kwargs
    ) -> bool:
        """
        设置缓存
        
        Args:
            value: 缓存值
            expire: 过期时间
            *args: 位置参数
            **kwargs: 关键字参数
        
        Returns:
            bool: 是否成功
        """
        key = self.get_key(*args, **kwargs)
        return await set_cached(key, value, expire)
    
    async def delete(self, *args, **kwargs) -> bool:
        """
        删除缓存
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
        
        Returns:
            bool: 是否成功
        """
        key = self.get_key(*args, **kwargs)
        return await delete_cached(key)
    
    async def clear_all(self) -> int:
        """
        清空所有缓存
        
        Returns:
            int: 删除的键数量
        """
        pattern = f"{self.prefix}:*"
        return await delete_pattern(pattern)


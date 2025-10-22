# Redis 使用指南

> Zishu-sensei Redis 模块完整使用文档

---

## 📑 目录

1. [快速开始](#1-快速开始)
2. [连接管理](#2-连接管理)
3. [缓存管理](#3-缓存管理)
4. [缓存装饰器](#4-缓存装饰器)
5. [会话管理](#5-会话管理)
6. [限流功能](#6-限流功能)
7. [高级功能](#7-高级功能)
8. [最佳实践](#8-最佳实践)

---

## 1. 快速开始

### 1.1 安装依赖

Redis 已包含在项目依赖中：

```bash
pip install -r requirements.txt
```

### 1.2 配置 Redis

**方式1: 环境变量**

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export REDIS_PASSWORD=your_password  # 可选
```

**方式2: .env 文件**

```bash
cp .env.example .env
# 编辑 .env 文件，填写 Redis 配置
```

**方式3: 配置文件**

编辑 `config/services/redis.yml`

### 1.3 基础使用

```python
from zishu.cache import cache_manager, get_redis_manager

# 初始化（通常在应用启动时调用）
await cache_manager.initialize()

# 基础操作
await cache_manager.set("key", "value", ttl=3600)
value = await cache_manager.get("key")
await cache_manager.delete("key")
```

---

## 2. 连接管理

### 2.1 初始化连接

```python
from zishu.cache import init_redis, RedisConfig

# 从环境变量初始化
manager = await init_redis()

# 从自定义配置初始化
config = RedisConfig(
    host="localhost",
    port=6379,
    db=0,
    password="your_password",
    max_connections=50,
)
manager = await init_redis(config)

# 从 URL 初始化
config = RedisConfig.from_url("redis://:password@localhost:6379/0")
manager = await init_redis(config)
```

### 2.2 健康检查

```python
from zishu.cache import get_redis_manager

manager = await get_redis_manager()
health = await manager.get_health_status()

print(health)
# {
#     "status": "healthy",
#     "response_time_ms": 5,
#     "details": {
#         "version": "7.0.0",
#         "used_memory_human": "1.2M",
#         "connected_clients": 10
#     }
# }
```

### 2.3 清理连接

```python
from zishu.cache import cleanup_redis

# 应用关闭时清理
await cleanup_redis()
```

---

## 3. 缓存管理

### 3.1 基础操作

```python
from zishu.cache import cache_manager

# 设置缓存
await cache_manager.set("user:123", {"name": "Alice"}, ttl=3600)

# 获取缓存
user = await cache_manager.get("user:123")  # 自动反序列化 JSON

# 删除缓存
await cache_manager.delete("user:123")

# 检查存在
exists = await cache_manager.exists("user:123")

# 设置过期时间
await cache_manager.expire("user:123", 7200)

# 获取剩余时间
ttl = await cache_manager.ttl("user:123")
```

### 3.2 模式匹配操作

```python
# 获取所有匹配的键
keys = await cache_manager.keys("user:*")

# 删除所有匹配的键
deleted = await cache_manager.delete_pattern("cache:temp:*")
```

### 3.3 Hash 操作

```python
# 设置 Hash 字段
await cache_manager.hset("user:123:profile", "name", "Alice")
await cache_manager.hset("user:123:profile", "age", "25")

# 获取 Hash 字段
name = await cache_manager.hget("user:123:profile", "name")

# 获取所有字段
profile = await cache_manager.hgetall("user:123:profile")

# 删除字段
await cache_manager.hdel("user:123:profile", "age")
```

### 3.4 List 操作

```python
# 推入列表
await cache_manager.rpush("queue:tasks", "task1", "task2", "task3")

# 弹出
task = await cache_manager.lpop("queue:tasks")

# 获取范围
tasks = await cache_manager.lrange("queue:tasks", 0, 9)  # 前10个

# 获取长度
length = await cache_manager.llen("queue:tasks")
```

### 3.5 Set 操作

```python
# 添加成员
await cache_manager.sadd("tags:python", "web", "ai", "data")

# 检查成员
is_member = await cache_manager.sismember("tags:python", "web")

# 获取所有成员
tags = await cache_manager.smembers("tags:python")

# 删除成员
await cache_manager.srem("tags:python", "data")
```

### 3.6 Sorted Set 操作

```python
# 添加成员（带分数）
await cache_manager.zadd("leaderboard", {
    "alice": 100,
    "bob": 85,
    "charlie": 90,
})

# 获取排名（倒序）
top10 = await cache_manager.zrevrange("leaderboard", 0, 9, withscores=True)

# 获取成员数量
count = await cache_manager.zcard("leaderboard")

# 删除成员
await cache_manager.zrem("leaderboard", "bob")
```

### 3.7 计数器

```python
# 递增
count = await cache_manager.incr("page:views:123")
count = await cache_manager.incr("page:views:123", amount=10)

# 递减
count = await cache_manager.decr("page:views:123")
```

---

## 4. 缓存装饰器

### 4.1 基础用法

```python
from zishu.cache import cached

@cached(ttl=3600, key_prefix="user")
async def get_user(user_id: str):
    """自动缓存用户信息"""
    # 查询数据库
    user = await db.get_user(user_id)
    return user

# 第一次调用：查询数据库并缓存
user = await get_user("123")

# 第二次调用：直接从缓存返回
user = await get_user("123")
```

### 4.2 自定义缓存键

```python
@cached(
    ttl=600,
    key_builder=lambda func, args, kwargs: f"adapter:{args[0]}"
)
async def get_adapter(adapter_id: str):
    return await db.get_adapter(adapter_id)
```

### 4.3 条件缓存

```python
# 只缓存非空结果
@cached(
    ttl=300,
    condition=lambda result: result is not None
)
async def search_adapters(query: str):
    return await db.search(query)

# 不缓存错误结果
@cached(
    ttl=300,
    unless=lambda result: isinstance(result, dict) and "error" in result
)
async def get_config(key: str):
    return await config_service.get(key)
```

### 4.4 缓存失效

```python
from zishu.cache import cache_invalidate

# 更新数据后自动失效缓存
@cache_invalidate(key_prefix="user")
async def update_user(user_id: str, data: dict):
    await db.update_user(user_id, data)

# 使用模式删除
@cache_invalidate(pattern="cache:adapters:*")
async def update_adapter_category(category: str):
    await db.update_category(category)
```

### 4.5 预定义装饰器

```python
from zishu.cache.decorators import cache_short, cache_medium, cache_long

@cache_short  # 5分钟缓存
async def get_search_results(query: str):
    return await search_engine.search(query)

@cache_medium  # 30分钟缓存
async def get_user_profile(user_id: str):
    return await db.get_user(user_id)

@cache_long  # 1小时缓存
async def get_adapter_details(adapter_id: str):
    return await db.get_adapter(adapter_id)
```

---

## 5. 会话管理

### 5.1 创建会话

```python
from zishu.cache import session_manager

# 创建新会话
session = await session_manager.create_session(
    data={"user_id": "123", "username": "alice"},
    ttl=7200  # 2小时
)

print(session.session_id)  # UUID
```

### 5.2 使用会话

```python
# 获取会话
session = await session_manager.get_session(session_id)

# 读取数据
user_id = session.get("user_id")
username = session["username"]  # 字典式访问

# 设置数据
session.set("theme", "dark")
session["language"] = "zh-CN"

# 保存会话
await session_manager.save_session(session)

# 删除字段
session.delete("theme")

# 清空会话
session.clear()
```

### 5.3 会话管理

```python
# 检查会话是否存在
exists = await session_manager.exists(session_id)

# 刷新会话过期时间
await session_manager.refresh_session(session_id, ttl=3600)

# 获取剩余时间
ttl = await session_manager.get_ttl(session_id)

# 删除会话
await session_manager.delete_session(session_id)
```

### 5.4 JWT Token 黑名单

```python
from zishu.cache.session import token_blacklist

# 添加 Token 到黑名单（如用户登出）
await token_blacklist.add_token(
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ttl=3600  # Token 剩余有效期
)

# 检查 Token 是否在黑名单中
is_blacklisted = await token_blacklist.is_blacklisted(token)

# 从黑名单移除
await token_blacklist.remove_token(token)
```

---

## 6. 限流功能

### 6.1 基础限流

```python
from zishu.cache import rate_limiter

# 检查限流
allowed, info = await rate_limiter.check_rate_limit(
    identifier="user:123",  # 用户ID 或 IP
    resource="/api/chat",   # API 端点
    max_requests=60,        # 最大请求数
    window_seconds=60       # 窗口大小（秒）
)

if allowed:
    # 处理请求
    pass
else:
    # 返回 429 错误
    print(f"限流! 剩余: {info['remaining']}, 重置时间: {info['reset_at']}")
```

### 6.2 限流算法

```python
from zishu.cache import RateLimiter, RateLimitAlgorithm

# 滑动窗口（默认，最精确）
limiter = RateLimiter(algorithm=RateLimitAlgorithm.SLIDING_WINDOW)

# 固定窗口（性能好）
limiter = RateLimiter(algorithm=RateLimitAlgorithm.FIXED_WINDOW)

# 令牌桶（适合突发流量）
limiter = RateLimiter(algorithm=RateLimitAlgorithm.TOKEN_BUCKET)
```

### 6.3 FastAPI 中间件

```python
from fastapi import FastAPI
from zishu.cache import RateLimitMiddleware

app = FastAPI()

# 添加全局限流
app.add_middleware(
    RateLimitMiddleware,
    max_requests=100,
    window_seconds=60,
    exclude_paths=["/health", "/docs"],  # 排除路径
)
```

### 6.4 自定义标识符

```python
from fastapi import Request

def custom_identifier(request: Request) -> str:
    """使用用户ID作为标识符"""
    # 从 JWT Token 获取用户ID
    user_id = request.state.user_id
    return f"user:{user_id}"

app.add_middleware(
    RateLimitMiddleware,
    identifier_func=custom_identifier,
    max_requests=60,
    window_seconds=60,
)
```

### 6.5 IP 黑名单

```python
from zishu.cache.ratelimit import ip_blacklist

# 添加 IP 到黑名单
await ip_blacklist.add_ip("1.2.3.4")  # 永久黑名单
await ip_blacklist.add_ip("5.6.7.8", ttl=3600)  # 临时黑名单（1小时）

# 检查 IP
is_blocked = await ip_blacklist.is_blacklisted("1.2.3.4")

# 移除 IP
await ip_blacklist.remove_ip("1.2.3.4")

# 获取所有黑名单 IP
ips = await ip_blacklist.get_all_ips()
```

---

## 7. 高级功能

### 7.1 分布式锁

```python
from zishu.cache import cache_manager

# 获取锁
lock_value = await cache_manager.acquire_lock(
    lock_key="adapter:install:uuid1",
    timeout=60,  # 锁超时时间
    blocking=True,  # 阻塞等待
    blocking_timeout=10  # 等待超时
)

if lock_value:
    try:
        # 执行临界区代码
        await install_adapter()
    finally:
        # 释放锁
        await cache_manager.release_lock(
            "adapter:install:uuid1",
            lock_value
        )
```

### 7.2 消息队列

```python
# 生产者
await cache_manager.lpush(
    "queue:tasks:high",
    json.dumps({"type": "generate_report", "data": {...}})
)

# 消费者
while True:
    task = await cache_manager.rpop("queue:tasks:high")
    if task:
        task_data = json.loads(task)
        await process_task(task_data)
```

### 7.3 发布/订阅

```python
# 发布者
async def publish_notification(user_id: str, message: dict):
    channel = f"notifications:{user_id}"
    await cache_manager.redis.publish(
        channel,
        json.dumps(message)
    )

# 订阅者
async def subscribe_notifications(user_id: str):
    channel = f"notifications:{user_id}"
    pubsub = cache_manager.redis.pubsub()
    
    await pubsub.subscribe(channel)
    
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            await handle_notification(data)
```

---

## 8. 最佳实践

### 8.1 键命名规范

```python
# 推荐格式: {namespace}:{entity}:{id}:{field}
"cache:user:123"
"cache:adapter:uuid:details"
"session:abc123"
"ratelimit:user:123:/api/chat"
"counter:adapter:downloads:uuid"
"queue:tasks:high"
```

### 8.2 TTL 设置指南

```python
# 会话数据
SESSION_TTL = 7200  # 2小时

# 用户信息缓存
USER_INFO_TTL = 1800  # 30分钟

# 热门内容缓存
POPULAR_CONTENT_TTL = 600  # 10分钟

# 搜索结果缓存
SEARCH_RESULT_TTL = 300  # 5分钟

# 计数器（定期同步到数据库）
COUNTER_TTL = 86400  # 24小时
```

### 8.3 缓存策略

```python
# 1. Cache-Aside (延迟加载)
async def get_user(user_id: str):
    # 1. 先查缓存
    cached = await cache_manager.get(f"user:{user_id}")
    if cached:
        return cached
    
    # 2. 缓存未命中，查数据库
    user = await db.get_user(user_id)
    
    # 3. 写入缓存
    await cache_manager.set(f"user:{user_id}", user, ttl=1800)
    
    return user

# 2. Write-Through (直写)
async def update_user(user_id: str, data: dict):
    # 1. 更新数据库
    user = await db.update_user(user_id, data)
    
    # 2. 更新缓存
    await cache_manager.set(f"user:{user_id}", user, ttl=1800)
    
    return user

# 3. Write-Behind (回写，异步)
async def increment_view_count(post_id: str):
    # 1. 增加 Redis 计数器
    count = await cache_manager.incr(f"counter:post:views:{post_id}")
    
    # 2. 定期同步到数据库（由后台任务处理）
    if count % 100 == 0:
        await queue_sync_task(post_id, count)
    
    return count
```

### 8.4 错误处理

```python
async def safe_cache_get(key: str, default=None):
    """安全的缓存获取（带降级）"""
    try:
        return await cache_manager.get(key, default)
    except Exception as e:
        logger.error(f"Cache get failed for {key}: {e}")
        # 降级：直接查询数据库
        return await db.get(key) or default

async def safe_cache_set(key: str, value: Any, ttl: int):
    """安全的缓存设置"""
    try:
        await cache_manager.set(key, value, ttl)
    except Exception as e:
        logger.error(f"Cache set failed for {key}: {e}")
        # 缓存失败不影响主流程
        pass
```

### 8.5 监控和调试

```python
# 监控缓存命中率
cache_hits = await cache_manager.get("stats:cache:hits") or 0
cache_misses = await cache_manager.get("stats:cache:misses") or 0
hit_rate = cache_hits / (cache_hits + cache_misses) if (cache_hits + cache_misses) > 0 else 0

print(f"缓存命中率: {hit_rate:.2%}")

# 监控 Redis 内存使用
health = await get_redis_manager().get_health_status()
print(f"内存使用: {health['details']['used_memory_human']}")

# 监控连接数
print(f"连接数: {health['details']['connected_clients']}")
```

---

## 📊 性能优化建议

### 1. 批量操作

```python
# ❌ 不推荐：循环单次操作
for user_id in user_ids:
    user = await cache_manager.get(f"user:{user_id}")

# ✅ 推荐：使用 pipeline
pipe = cache_manager.redis.pipeline()
for user_id in user_ids:
    pipe.get(f"user:{user_id}")
users = await pipe.execute()
```

### 2. 避免大键

```python
# ❌ 不推荐：单个 Hash 存储百万用户
await cache_manager.hset("users", user_id, user_data)

# ✅ 推荐：分片存储
shard = hash(user_id) % 100
await cache_manager.hset(f"users:shard:{shard}", user_id, user_data)
```

### 3. 合理设置过期时间

```python
# ✅ 根据数据特性设置合适的 TTL
await cache_manager.set("user:123", user, ttl=1800)  # 30分钟
await cache_manager.set("config:theme", theme, ttl=86400)  # 24小时
await cache_manager.set("search:result", results, ttl=300)  # 5分钟
```

---

**文档版本:** v1.0  
**最后更新:** 2025-10-22  
**维护者:** Zishu Team


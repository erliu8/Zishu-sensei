"""
Redis 集成测试
测试与真实 Redis 服务器的交互
"""

import pytest
import pytest_asyncio
import asyncio
import time
import os
from datetime import datetime

from zishu.cache.connection import RedisConnectionManager, RedisConfig
from zishu.cache.manager import CacheManager
from zishu.cache.ratelimit import RateLimiter, RateLimitAlgorithm, IPBlacklist
from zishu.cache.session import SessionManager, TokenBlacklist

@pytest.fixture(scope="function")
def redis_config():
    """Redis 配置"""
    return RedisConfig(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_TEST_DB", "15")),  # 使用测试数据库
        password=os.getenv("REDIS_PASSWORD"),
        decode_responses=True,
    )


@pytest_asyncio.fixture(scope="function")
async def redis_manager(redis_config):
    """创建 Redis 连接管理器"""
    manager = RedisConnectionManager(redis_config)
    await manager.initialize()
    yield manager
    await manager.cleanup()


@pytest_asyncio.fixture(scope="function")
async def redis_client(redis_manager):
    """获取 Redis 客户端"""
    client = await redis_manager.get_client()
    return client


@pytest_asyncio.fixture
async def cache_manager(redis_client):
    """创建缓存管理器"""
    manager = CacheManager(redis_client)
    await manager.initialize()
    yield manager
    # 清理测试数据
    await redis_client.flushdb()


@pytest.mark.asyncio
class TestRedisConnection:
    """测试 Redis 连接"""

    async def test_ping(self, redis_client):
        """测试 PING 命令"""
        result = await redis_client.ping()
        assert result is True

    async def test_health_check(self, redis_manager):
        """测试健康检查"""
        health = await redis_manager.get_health_status()
        assert health["status"] == "healthy"
        assert "response_time_ms" in health
        assert "details" in health
        print(f"\n健康检查结果: {health}")


@pytest.mark.asyncio
class TestCacheOperations:
    """测试缓存基础操作"""

    async def test_set_and_get(self, cache_manager):
        """测试基础 set/get 操作"""
        # 设置字符串
        result = await cache_manager.set("test:key1", "value1", ttl=60)
        assert result is True

        # 获取字符串
        value = await cache_manager.get("test:key1")
        assert value == "value1"
        print(f"\n✓ set/get 测试通过: {value}")

    async def test_set_with_json(self, cache_manager):
        """测试 JSON 序列化"""
        data = {
            "name": "Alice",
            "age": 30,
            "tags": ["python", "redis", "fastapi"]
        }
        
        await cache_manager.set("test:user:1", data, ttl=60)
        retrieved = await cache_manager.get("test:user:1")
        
        assert retrieved == data
        print(f"\n✓ JSON 序列化测试通过: {retrieved}")

    async def test_ttl_and_expire(self, cache_manager):
        """测试 TTL 和过期时间"""
        await cache_manager.set("test:ttl_key", "value", ttl=10)
        
        ttl = await cache_manager.ttl("test:ttl_key")
        assert 0 < ttl <= 10
        print(f"\n✓ TTL 测试通过: {ttl} 秒")

        # 更新过期时间
        await cache_manager.expire("test:ttl_key", 20)
        new_ttl = await cache_manager.ttl("test:ttl_key")
        assert 10 < new_ttl <= 20
        print(f"✓ 更新 TTL 测试通过: {new_ttl} 秒")

    async def test_delete(self, cache_manager):
        """测试删除操作"""
        await cache_manager.set("test:del_key", "value")
        
        exists = await cache_manager.exists("test:del_key")
        assert exists == 1
        
        deleted = await cache_manager.delete("test:del_key")
        assert deleted == 1
        
        exists_after = await cache_manager.exists("test:del_key")
        assert exists_after == 0
        print("\n✓ delete 测试通过")

    async def test_keys_pattern(self, cache_manager):
        """测试键模式匹配"""
        # 设置多个键
        await cache_manager.set("test:user:1", "alice")
        await cache_manager.set("test:user:2", "bob")
        await cache_manager.set("test:product:1", "laptop")
        
        # 查找用户键
        user_keys = await cache_manager.keys("test:user:*")
        assert len(user_keys) == 2
        print(f"\n✓ 模式匹配测试通过: 找到 {len(user_keys)} 个用户键")

    async def test_incr_decr(self, cache_manager):
        """测试计数器操作"""
        # 递增
        count1 = await cache_manager.incr("test:counter", amount=1)
        assert count1 == 1
        
        count2 = await cache_manager.incr("test:counter", amount=5)
        assert count2 == 6
        
        # 递减
        count3 = await cache_manager.decr("test:counter", amount=2)
        assert count3 == 4
        print(f"\n✓ 计数器测试通过: 最终计数 = {count3}")


@pytest.mark.asyncio
class TestHashOperations:
    """测试 Hash 操作"""

    async def test_hset_hget(self, cache_manager):
        """测试 Hash 字段操作"""
        await cache_manager.hset("test:hash", "field1", "value1")
        await cache_manager.hset("test:hash", "field2", "value2")
        
        value1 = await cache_manager.hget("test:hash", "field1")
        assert value1 == "value1"
        print(f"\n✓ Hash set/get 测试通过: {value1}")

    async def test_hgetall(self, cache_manager):
        """测试获取所有 Hash 字段"""
        await cache_manager.hset("test:hash_all", "name", "Alice")
        await cache_manager.hset("test:hash_all", "age", "30")
        await cache_manager.hset("test:hash_all", "city", "Beijing")
        
        all_data = await cache_manager.hgetall("test:hash_all")
        assert "name" in all_data
        assert all_data["name"] == "Alice"
        print(f"\n✓ Hash getall 测试通过: {all_data}")


@pytest.mark.asyncio
class TestListOperations:
    """测试 List 操作"""

    async def test_lpush_rpop(self, cache_manager):
        """测试列表推入和弹出"""
        # 左侧推入
        await cache_manager.lpush("test:queue", "task1", "task2", "task3")
        
        # 右侧弹出 (FIFO)
        task = await cache_manager.rpop("test:queue")
        assert task == "task1"
        
        length = await cache_manager.llen("test:queue")
        assert length == 2
        print(f"\n✓ List 操作测试通过: 弹出 {task}, 剩余 {length} 个元素")

    async def test_lrange(self, cache_manager):
        """测试列表范围查询"""
        await cache_manager.rpush("test:list", "a", "b", "c", "d", "e")
        
        items = await cache_manager.lrange("test:list", 0, 2)
        assert len(items) == 3
        assert items[0] == "a"
        print(f"\n✓ List range 测试通过: {items}")


@pytest.mark.asyncio
class TestSetOperations:
    """测试 Set 操作"""

    async def test_sadd_smembers(self, cache_manager):
        """测试集合添加和获取成员"""
        await cache_manager.sadd("test:tags", "python", "redis", "fastapi")
        await cache_manager.sadd("test:tags", "python")  # 重复添加
        
        members = await cache_manager.smembers("test:tags")
        assert len(members) == 3
        assert "python" in members
        print(f"\n✓ Set 操作测试通过: {members}")

    async def test_sismember(self, cache_manager):
        """测试集合成员检查"""
        await cache_manager.sadd("test:set", "item1", "item2")
        
        is_member = await cache_manager.sismember("test:set", "item1")
        assert is_member == 1 or is_member is True
        
        not_member = await cache_manager.sismember("test:set", "item3")
        assert not_member == 0 or not_member is False
        print("\n✓ Set 成员检查测试通过")


@pytest.mark.asyncio
class TestSortedSetOperations:
    """测试有序集合操作"""

    async def test_zadd_zrange(self, cache_manager):
        """测试有序集合添加和范围查询"""
        # 添加成员和分数
        await cache_manager.zadd("test:leaderboard", {
            "alice": 100,
            "bob": 85,
            "charlie": 95,
            "david": 90,
        })
        
        # 获取分数最低的3个
        bottom_3 = await cache_manager.zrange("test:leaderboard", 0, 2)
        assert len(bottom_3) == 3
        assert bottom_3[0] == "bob"
        print(f"\n✓ Sorted Set range 测试通过: {bottom_3}")

    async def test_zrevrange(self, cache_manager):
        """测试有序集合倒序范围查询"""
        await cache_manager.zadd("test:scores", {
            "player1": 100,
            "player2": 200,
            "player3": 150,
        })
        
        # 获取分数最高的
        top_players = await cache_manager.zrevrange("test:scores", 0, 1)
        assert top_players[0] == "player2"
        print(f"\n✓ Sorted Set 倒序测试通过: {top_players}")


@pytest.mark.asyncio
class TestRateLimiting:
    """测试限流功能"""

    async def test_sliding_window_rate_limit(self, redis_client):
        """测试滑动窗口限流"""
        limiter = RateLimiter(
            key_prefix="test:ratelimit",
            algorithm=RateLimitAlgorithm.SLIDING_WINDOW
        )
        
        # 初始化缓存管理器
        from zishu.cache.ratelimit import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        # 前5次请求应该都通过
        for i in range(5):
            allowed, info = await limiter.check_rate_limit(
                identifier="user:test",
                resource="/api/test",
                max_requests=5,
                window_seconds=10
            )
            assert allowed is True
            print(f"\n请求 {i+1}: allowed={allowed}, remaining={info['remaining']}")
        
        # 第6次请求应该被拒绝
        allowed, info = await limiter.check_rate_limit(
            identifier="user:test",
            resource="/api/test",
            max_requests=5,
            window_seconds=10
        )
        assert allowed is False
        assert info["remaining"] == 0
        print(f"请求 6: allowed={allowed}, remaining={info['remaining']}")
        print("✓ 滑动窗口限流测试通过")

    async def test_fixed_window_rate_limit(self, redis_client):
        """测试固定窗口限流"""
        limiter = RateLimiter(
            key_prefix="test:ratelimit:fixed",
            algorithm=RateLimitAlgorithm.FIXED_WINDOW
        )
        
        from zishu.cache.ratelimit import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        # 测试固定窗口
        for i in range(3):
            allowed, info = await limiter.check_rate_limit(
                identifier="user:test2",
                resource="/api/login",
                max_requests=3,
                window_seconds=60
            )
            assert allowed is True
        
        # 超过限制
        allowed, info = await limiter.check_rate_limit(
            identifier="user:test2",
            resource="/api/login",
            max_requests=3,
            window_seconds=60
        )
        assert allowed is False
        print("\n✓ 固定窗口限流测试通过")

    async def test_ip_blacklist(self, redis_client):
        """测试 IP 黑名单"""
        blacklist = IPBlacklist(key="test:blacklist:ip")
        
        from zishu.cache.ratelimit import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        # 添加永久黑名单 IP
        await blacklist.add_ip("1.2.3.4")
        is_blocked = await blacklist.is_blacklisted("1.2.3.4")
        assert is_blocked is True
        print("\n✓ 永久 IP 黑名单测试通过")
        
        # 添加临时黑名单 IP
        await blacklist.add_ip("5.6.7.8", ttl=10)
        is_blocked = await blacklist.is_blacklisted("5.6.7.8")
        assert is_blocked is True
        print("✓ 临时 IP 黑名单测试通过")
        
        # 移除 IP
        await blacklist.remove_ip("1.2.3.4")
        is_blocked = await blacklist.is_blacklisted("1.2.3.4")
        assert is_blocked is False
        print("✓ IP 黑名单移除测试通过")


@pytest.mark.asyncio
class TestSessionManagement:
    """测试会话管理"""

    async def test_create_and_get_session(self, redis_client):
        """测试创建和获取会话"""
        session_mgr = SessionManager(
            key_prefix="test:session",
            default_ttl=3600
        )
        
        from zishu.cache.session import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        # 创建会话
        session = await session_mgr.create_session(
            data={"user_id": "123", "username": "alice"},
            ttl=600
        )
        
        assert session is not None
        assert session.session_id is not None
        print(f"\n✓ 创建会话: {session.session_id}")
        
        # 获取会话
        retrieved_session = await session_mgr.get_session(session.session_id)
        assert retrieved_session is not None
        assert retrieved_session.data["user_id"] == "123"
        print(f"✓ 获取会话: {retrieved_session.data}")

    async def test_session_operations(self, redis_client):
        """测试会话操作"""
        session_mgr = SessionManager(
            key_prefix="test:session:ops",
            default_ttl=3600
        )
        
        from zishu.cache.session import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        # 创建会话
        session = await session_mgr.create_session(data={"counter": 0})
        
        # 修改会话数据
        session.set("counter", 10)
        session.set("last_access", str(datetime.now()))
        
        # 保存会话
        await session_mgr.save_session(session)
        
        # 重新获取
        session2 = await session_mgr.get_session(session.session_id)
        assert session2.get("counter") == 10
        print(f"\n✓ 会话数据修改测试通过: counter={session2.get('counter')}")
        
        # 删除会话
        deleted = await session_mgr.delete_session(session.session_id)
        assert deleted is True
        
        # 验证已删除
        session3 = await session_mgr.get_session(session.session_id)
        assert session3 is None
        print("✓ 会话删除测试通过")

    async def test_token_blacklist(self, redis_client):
        """测试 Token 黑名单"""
        blacklist = TokenBlacklist(key_prefix="test:jwt:blacklist")
        
        from zishu.cache.session import cache_manager
        cache_manager.redis = redis_client
        cache_manager._initialized = True
        
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"
        
        # 添加到黑名单
        await blacklist.add_token(token, ttl=600)
        
        # 检查是否在黑名单中
        is_blacklisted = await blacklist.is_blacklisted(token)
        assert is_blacklisted is True
        print("\n✓ Token 黑名单测试通过")


@pytest.mark.asyncio
class TestDistributedLock:
    """测试分布式锁"""

    async def test_acquire_and_release_lock(self, cache_manager):
        """测试获取和释放锁"""
        lock_key = "test:lock:resource1"
        
        # 获取锁
        lock_id = await cache_manager.acquire_lock(
            lock_key,
            timeout=10,
            blocking=False
        )
        assert lock_id is not None
        print(f"\n✓ 获取锁成功: {lock_id}")
        
        # 尝试再次获取锁（应该失败）
        lock_id2 = await cache_manager.acquire_lock(
            lock_key,
            timeout=10,
            blocking=False
        )
        assert lock_id2 is None
        print("✓ 锁冲突检测通过")
        
        # 释放锁
        released = await cache_manager.release_lock(lock_key, lock_id)
        assert released is True
        print("✓ 释放锁成功")
        
        # 释放后可以再次获取
        lock_id3 = await cache_manager.acquire_lock(
            lock_key,
            timeout=10,
            blocking=False
        )
        assert lock_id3 is not None
        await cache_manager.release_lock(lock_key, lock_id3)
        print("✓ 锁重新获取测试通过")


@pytest.mark.asyncio
class TestPerformance:
    """性能测试"""

    async def test_bulk_operations(self, cache_manager):
        """测试批量操作性能"""
        start_time = time.time()
        
        # 批量写入
        for i in range(100):
            await cache_manager.set(f"test:perf:key{i}", f"value{i}", ttl=60)
        
        write_time = time.time() - start_time
        print(f"\n✓ 批量写入 100 个键耗时: {write_time:.3f} 秒")
        
        # 批量读取
        start_time = time.time()
        for i in range(100):
            value = await cache_manager.get(f"test:perf:key{i}")
            assert value == f"value{i}"
        
        read_time = time.time() - start_time
        print(f"✓ 批量读取 100 个键耗时: {read_time:.3f} 秒")
        
        # 模式删除
        start_time = time.time()
        deleted = await cache_manager.delete_pattern("test:perf:*")
        delete_time = time.time() - start_time
        
        assert deleted == 100
        print(f"✓ 模式删除 100 个键耗时: {delete_time:.3f} 秒")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])


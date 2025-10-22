#!/usr/bin/env python3
"""
核心库数据库连接测试脚本
测试 PostgreSQL、Redis 和 Qdrant 的连接状态
"""

import asyncio
import os
import sys
from datetime import datetime


def print_section(title: str):
    """打印分节标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def print_result(name: str, status: str, details: str = ""):
    """打印测试结果"""
    status_symbol = "✓" if status == "成功" else "✗"
    color = "\033[92m" if status == "成功" else "\033[91m"
    reset = "\033[0m"
    print(f"{color}{status_symbol}{reset} {name}: {status}")
    if details:
        print(f"   {details}")


async def test_postgresql():
    """测试 PostgreSQL 连接"""
    print_section("测试 PostgreSQL 连接")
    
    try:
        # 尝试导入必要的库
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        # 尝试从环境变量获取连接信息
        db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu")
        print(f"连接URL: {db_url.replace('zishu123', '***')}")
        
        # 创建引擎
        engine = create_async_engine(db_url, pool_pre_ping=True, echo=False)
        
        # 测试连接
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            
            # 测试数据库是否存在
            result = await conn.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            
            # 获取表数量
            result = await conn.execute(text(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
            ))
            table_count = result.scalar()
            
        await engine.dispose()
        
        print_result(
            "PostgreSQL",
            "成功",
            f"数据库: {db_name}, 表数量: {table_count}"
        )
        print(f"   版本: {version[:50]}...")
        return True
        
    except ImportError as e:
        print_result("PostgreSQL", "失败", f"缺少依赖库: {e}")
        return False
    except Exception as e:
        print_result("PostgreSQL", "失败", f"连接错误: {e}")
        return False


async def test_redis():
    """测试 Redis 连接"""
    print_section("测试 Redis 连接")
    
    try:
        # 尝试导入 Redis 库
        from redis import asyncio as aioredis
        
        # 尝试从环境变量获取连接信息
        redis_url = os.getenv("REDIS_URL", "redis://:zishu123@localhost:6379/0")
        print(f"连接URL: {redis_url.replace('zishu123', '***')}")
        
        # 创建连接
        redis_client = await aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        
        # 测试 PING
        pong = await redis_client.ping()
        
        # 获取 Redis 信息
        info = await redis_client.info("server")
        redis_version = info.get("redis_version", "未知")
        
        # 测试写入和读取
        test_key = f"test_connection_{datetime.now().timestamp()}"
        await redis_client.set(test_key, "test_value", ex=10)
        value = await redis_client.get(test_key)
        await redis_client.delete(test_key)
        
        # 获取数据库大小
        db_size = await redis_client.dbsize()
        
        await redis_client.close()
        
        print_result(
            "Redis",
            "成功",
            f"版本: {redis_version}, 键数量: {db_size}"
        )
        return True
        
    except ImportError as e:
        print_result("Redis", "失败", f"缺少依赖库: {e}")
        return False
    except Exception as e:
        print_result("Redis", "失败", f"连接错误: {e}")
        return False


async def test_qdrant():
    """测试 Qdrant 连接"""
    print_section("测试 Qdrant 连接")
    
    try:
        # 尝试导入 Qdrant 客户端
        from qdrant_client import QdrantClient
        from qdrant_client.http.exceptions import UnexpectedResponse
        
        # 尝试从环境变量获取连接信息
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6335")
        qdrant_api_key = os.getenv("QDRANT_API_KEY", "dev-qdrant-api-key-change-in-production")
        print(f"连接URL: {qdrant_url}")
        if qdrant_api_key and qdrant_api_key != "zishu123":
            print(f"API Key: {qdrant_api_key[:4]}***")
        
        # 创建客户端
        client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        
        # 获取集合列表
        collections = client.get_collections()
        collection_names = [col.name for col in collections.collections]
        
        # 获取集群信息
        try:
            cluster_info = client.cluster_info()
            peer_count = len(cluster_info.peers) if cluster_info.peers else 1
        except (UnexpectedResponse, AttributeError):
            peer_count = 1
        
        print_result(
            "Qdrant",
            "成功",
            f"集合数量: {len(collection_names)}, 节点数: {peer_count}"
        )
        if collection_names:
            print(f"   集合: {', '.join(collection_names)}")
        else:
            print(f"   提示: 暂无集合（这是正常的，在首次使用时会自动创建）")
        return True
        
    except ImportError as e:
        print_result("Qdrant", "失败", f"缺少依赖库: {e}")
        return False
    except Exception as e:
        print_result("Qdrant", "失败", f"连接错误: {e}")
        return False


async def test_zishu_connection_manager():
    """测试核心库的数据库连接管理器"""
    print_section("测试核心库连接管理器")
    
    try:
        # 添加 zishu 模块到 Python 路径
        sys.path.insert(0, '/opt/zishu-sensei')
        
        from zishu.database.connection import DatabaseConfig, DatabaseConnectionManager
        
        # 创建配置
        db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu")
        config = DatabaseConfig(url=db_url, echo=False)
        
        # 创建连接管理器
        manager = DatabaseConnectionManager(config)
        await manager.initialize()
        
        # 检查健康状态
        health = await manager.get_health_status()
        
        # 清理连接
        await manager.cleanup()
        
        print_result(
            "核心库连接管理器",
            "成功",
            f"整体状态: {health['overall_status']}"
        )
        
        # 显示详细信息
        for engine_type, engine_health in health.get('engines', {}).items():
            status = engine_health.get('status', 'unknown')
            response_time = engine_health.get('response_time_ms', 0)
            print(f"   {engine_type} 引擎: {status} ({response_time}ms)")
        
        return True
        
    except ImportError as e:
        print_result("核心库连接管理器", "失败", f"导入错误: {e}")
        return False
    except Exception as e:
        print_result("核心库连接管理器", "失败", f"初始化错误: {e}")
        import traceback
        print(f"   详细错误:\n{traceback.format_exc()}")
        return False


async def main():
    """主函数"""
    print("\n" + "="*60)
    print("  Zishu-Sensei 核心库数据库连接测试")
    print("="*60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 显示环境变量
    print("\n环境变量检查:")
    print(f"  DATABASE_URL: {'已设置' if os.getenv('DATABASE_URL') else '未设置（将使用默认值）'}")
    print(f"  REDIS_URL: {'已设置' if os.getenv('REDIS_URL') else '未设置（将使用默认值）'}")
    print(f"  QDRANT_URL: {'已设置' if os.getenv('QDRANT_URL') else '未设置（将使用默认值）'}")
    
    # 运行所有测试
    results = []
    
    results.append(("PostgreSQL", await test_postgresql()))
    results.append(("Redis", await test_redis()))
    results.append(("Qdrant", await test_qdrant()))
    results.append(("核心库连接管理器", await test_zishu_connection_manager()))
    
    # 总结
    print_section("测试总结")
    
    success_count = sum(1 for _, result in results if result)
    total_count = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        color = "\033[92m" if result else "\033[91m"
        reset = "\033[0m"
        print(f"  {color}{status}{reset}  {name}")
    
    print(f"\n总计: {success_count}/{total_count} 项测试通过")
    
    if success_count == total_count:
        print("\n🎉 所有数据库连接测试通过！核心库已成功连接到数据库服务层。")
        return 0
    else:
        print("\n⚠️  部分测试失败，请检查上述错误信息。")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)


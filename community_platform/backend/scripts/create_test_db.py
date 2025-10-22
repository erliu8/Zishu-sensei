#!/usr/bin/env python3
"""
创建测试数据库的脚本
"""
import asyncio
import asyncpg


async def create_test_database():
    """创建测试数据库"""
    # 连接到默认的postgres数据库
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='zishu',
        password='zishu123',
        database='postgres'
    )
    
    try:
        # 检查测试数据库是否存在
        result = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = 'zishu_community_test'"
        )
        
        if result:
            print("测试数据库 'zishu_community_test' 已存在")
        else:
            # 创建测试数据库
            await conn.execute('CREATE DATABASE zishu_community_test')
            print("成功创建测试数据库 'zishu_community_test'")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(create_test_database())


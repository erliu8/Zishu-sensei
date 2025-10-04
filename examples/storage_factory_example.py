"""
存储工厂使用示例
展示如何使用新的存储工厂和配置管理器
"""

import asyncio
import logging
from pathlib import Path

from zishu.adapters.core.storage import (
    StorageFactory, StorageConfig, StorageManagerNew,
    StorageBackendType, StorageQuery
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def example_basic_usage():
    """基本使用示例"""
    print("=== 基本使用示例 ===")
    
    # 1. 创建默认配置
    config = StorageConfig.default(StorageBackendType.SQLITE)
    
    # 2. 创建并连接存储后端
    backend = await StorageFactory.create_and_connect(config)
    
    # 3. 使用存储后端
    # 创建记录
    result = await backend.create("users", {
        "name": "张三",
        "email": "zhangsan@example.com",
        "age": 25
    })
    print(f"创建结果: {result.success}, 数据: {result.data}")
    
    # 读取记录
    if result.success:
        user_id = result.data['key']
        read_result = await backend.read("users", user_id)
        print(f"读取结果: {read_result.success}, 数据: {read_result.data}")
    
    # 列出所有记录
    list_result = await backend.list("users")
    print(f"列表结果: {list_result.success}, 记录数: {len(list_result.data)}")
    
    # 4. 关闭连接
    await backend.disconnect()


async def example_config_from_file():
    """从文件加载配置示例"""
    print("\n=== 从文件加载配置示例 ===")
    
    # 1. 从YAML文件加载配置
    config_path = Path(__file__).parent / "config" / "storage_config.yaml"
    if config_path.exists():
        config = StorageConfig.from_file(config_path)
        print(f"从文件加载配置成功，后端类型: {config.get_backend_type().value}")
        
        # 2. 创建并连接
        try:
            backend = await StorageFactory.create_and_connect(config)
            
            # 3. 健康检查
            health = await backend.health_check()
            print(f"健康检查: {health}")
            
            await backend.disconnect()
        except Exception as e:
            print(f"连接失败: {e}")
    else:
        print(f"配置文件不存在: {config_path}")


async def example_env_config():
    """环境变量配置示例"""
    print("\n=== 环境变量配置示例 ===")
    
    # 设置环境变量（实际使用时应在系统中设置）
    import os
    os.environ["ZISHU_STORAGE_BACKEND_TYPE"] = "sqlite"
    os.environ["ZISHU_STORAGE_SQLITE_PATH"] = "./example_storage.db"
    
    # 1. 从环境变量加载配置
    config = StorageConfig.from_env()
    print(f"从环境变量加载配置，后端类型: {config.get_backend_type().value}")
    
    # 2. 创建并连接
    backend = await StorageFactory.create_and_connect(config)
    
    # 3. 使用存储
    await backend.create("products", {
        "name": "笔记本电脑",
        "price": 5999.99,
        "category": "电子产品"
    })
    
    await backend.disconnect()


async def example_storage_manager():
    """存储管理器示例"""
    print("\n=== 存储管理器示例 ===")
    
    # 1. 创建配置
    config = StorageConfig.default(StorageBackendType.SQLITE)
    
    # 2. 创建存储管理器
    manager = StorageManagerNew(config)
    
    # 3. 初始化
    success = await manager.initialize()
    if not success:
        print("存储管理器初始化失败")
        return
    
    print("存储管理器初始化成功")
    
    # 4. 获取后端信息
    info = await manager.get_backend_info()
    print(f"后端信息: {info}")
    
    # 5. 健康检查
    health = await manager.health_check()
    print(f"健康状态: {health['status']}")
    
    # 6. 使用后端进行操作
    if manager.backend:
        # 批量创建
        data_list = [
            {"name": "用户1", "email": "user1@example.com"},
            {"name": "用户2", "email": "user2@example.com"},
            {"name": "用户3", "email": "user3@example.com"}
        ]
        
        batch_result = await manager.backend.batch_create("batch_users", data_list)
        print(f"批量创建结果: {batch_result.success}, 创建数量: {len(batch_result.data)}")
        
        # 搜索
        query = StorageQuery(
            filters={"name": {"$regex": "用户"}},
            limit=10
        )
        search_result = await manager.backend.search("batch_users", query)
        print(f"搜索结果: {search_result.success}, 找到数量: {len(search_result.data)}")
    
    # 7. 关闭管理器
    await manager.shutdown()


async def example_multiple_backends():
    """多后端示例"""
    print("\n=== 多后端示例 ===")
    
    # 1. 创建不同的配置
    sqlite_config = StorageConfig.default(StorageBackendType.SQLITE)
    
    # 2. 创建多个实例
    sqlite_backend = await StorageFactory.create_and_connect(sqlite_config, "sqlite_instance")
    
    # 3. 在不同后端中存储数据
    await sqlite_backend.create("orders", {
        "order_id": "ORD001",
        "customer": "李四",
        "amount": 299.99
    })
    
    print("数据已存储到SQLite后端")
    
    # 4. 获取实例
    cached_backend = StorageFactory.get_instance(StorageBackendType.SQLITE, "sqlite_instance")
    if cached_backend:
        print("成功获取缓存的后端实例")
    
    # 5. 关闭所有实例
    await StorageFactory.close_all_instances()
    print("所有后端实例已关闭")


async def example_data_migration():
    """数据迁移示例"""
    print("\n=== 数据迁移示例 ===")
    
    # 1. 创建源和目标配置
    source_config = StorageConfig.default(StorageBackendType.SQLITE)
    source_config.update_config({
        'sqlite': {'database_path': './source.db'}
    })
    
    target_config = StorageConfig.default(StorageBackendType.SQLITE)
    target_config.update_config({
        'sqlite': {'database_path': './target.db'}
    })
    
    # 2. 创建源存储管理器并添加数据
    source_manager = StorageManagerNew(source_config)
    await source_manager.initialize("source")
    
    # 添加测试数据
    test_data = [
        {"name": "产品A", "price": 100},
        {"name": "产品B", "price": 200},
        {"name": "产品C", "price": 300}
    ]
    await source_manager.backend.batch_create("products", test_data)
    print("源数据库已准备好测试数据")
    
    # 3. 执行数据迁移
    success = await source_manager.migrate_data(target_config, ["products"])
    print(f"数据迁移{'成功' if success else '失败'}")
    
    # 4. 验证迁移结果
    target_manager = StorageManagerNew(target_config)
    await target_manager.initialize("target")
    
    result = await target_manager.backend.list("products")
    print(f"目标数据库中的记录数: {len(result.data)}")
    
    # 5. 清理
    await source_manager.shutdown()
    await target_manager.shutdown()


async def main():
    """主函数"""
    try:
        await example_basic_usage()
        await example_config_from_file()
        await example_env_config()
        await example_storage_manager()
        await example_multiple_backends()
        await example_data_migration()
        
        print("\n=== 所有示例完成 ===")
        
    except Exception as e:
        logger.error(f"示例执行失败: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())

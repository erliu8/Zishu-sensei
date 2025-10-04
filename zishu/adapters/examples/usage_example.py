"""
适配器系统使用示例

演示如何使用适配器系统进行开发。
"""

import asyncio
import logging
from typing import Dict, Any

from ..core import AdapterManager, AdapterIdentity, AdapterType, Event, EventType, Priority
from .http_adapter import HttpAdapter
from .database_adapter import DatabaseAdapter

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """主函数"""
    # 创建适配器管理器
    manager = AdapterManager({
        'event_queue_size': 1000,
        'auto_restart_on_health_failure': True
    })
    
    try:
        # 初始化并启动管理器
        await manager.initialize()
        await manager.start()
        
        logger.info("Adapter manager started")
        
        # 注册HTTP适配器
        http_identity = AdapterIdentity(
            name="example-http-client",
            version="1.0.0",
            description="示例HTTP客户端适配器",
            author="Zishu Team",
            tags={"http", "client", "example"}
        )
        
        http_config = {
            'base_url': 'https://httpbin.org',
            'timeout': 10,
            'max_connections': 50,
            'max_retries': 2
        }
        
        http_adapter_id = await manager.register_adapter(
            HttpAdapter,
            http_identity,
            http_config
        )
        
        logger.info(f"HTTP adapter registered: {http_adapter_id}")
        
        # 注册数据库适配器
        db_identity = AdapterIdentity(
            name="example-database",
            version="1.0.0",
            description="示例数据库适配器",
            author="Zishu Team",
            tags={"database", "postgresql", "example"}
        )
        
        db_config = {
            'host': 'localhost',
            'port': 5432,
            'database': 'zishu_example',
            'username': 'zishu',
            'password': 'password',
            'pool_size': 5
        }
        
        db_adapter_id = await manager.register_adapter(
            DatabaseAdapter,
            db_identity,
            db_config
        )
        
        logger.info(f"Database adapter registered: {db_adapter_id}")
        
        # 启动适配器
        await manager.start_adapter(http_adapter_id)
        await manager.start_adapter(db_adapter_id)
        
        # 订阅事件
        def event_handler(event: Event):
            logger.info(f"Received event: {event.event_type.value} from {event.source}")
        
        subscription_id = manager.subscribe_event(
            [EventType.ADAPTER_STARTED, EventType.OPERATION_COMPLETED],
            event_handler
        )
        
        # 使用HTTP适配器
        http_adapter = manager.get_adapter_instance(http_adapter_id)
        if http_adapter:
            try:
                # 发送GET请求
                response = await http_adapter.get('/get', params={'test': 'value'})
                logger.info(f"HTTP GET response: {response['status']}")
                
                # 发送POST请求
                response = await http_adapter.post('/post', json={'message': 'Hello World'})
                logger.info(f"HTTP POST response: {response['status']}")
                
            except Exception as e:
                logger.error(f"HTTP request failed: {e}")
        
        # 使用数据库适配器
        db_adapter = manager.get_adapter_instance(db_adapter_id)
        if db_adapter:
            try:
                # 执行查询
                results = await db_adapter.execute_query(
                    "SELECT * FROM users WHERE active = ?",
                    [True]
                )
                logger.info(f"Database query results: {len(results)} rows")
                
                # 执行事务
                success = await db_adapter.execute_transaction([
                    {'query': 'INSERT INTO logs (message) VALUES (?)', 'parameters': ['Test message']},
                    {'query': 'UPDATE counters SET value = value + 1 WHERE name = ?', 'parameters': ['requests']}
                ])
                logger.info(f"Database transaction success: {success}")
                
            except Exception as e:
                logger.error(f"Database operation failed: {e}")
        
        # 查看适配器列表
        adapters = manager.list_adapters()
        logger.info(f"Total adapters: {len(adapters)}")
        
        for adapter in adapters:
            logger.info(f"  - {adapter.name} ({adapter.adapter_type.value}): {adapter.status.value}")
        
        # 查看统计信息
        stats = manager.get_statistics()
        logger.info(f"Manager statistics: {stats}")
        
        # 运行一段时间
        await asyncio.sleep(5)
        
        # 取消事件订阅
        manager.unsubscribe_event(subscription_id)
        
    except Exception as e:
        logger.error(f"Example execution failed: {e}")
        
    finally:
        # 停止管理器
        await manager.stop()
        logger.info("Adapter manager stopped")


async def event_filtering_example():
    """事件过滤示例"""
    from ..core.events.filters import EventTypeFilter, SourceFilter, EventFilterChain
    
    # 创建事件过滤器
    type_filter = EventTypeFilter([EventType.ADAPTER_STARTED, EventType.ADAPTER_STOPPED])
    source_filter = SourceFilter(['example-http-client', 'example-database'])
    
    # 创建过滤器链
    filter_chain = EventFilterChain([type_filter, source_filter], logic="AND")
    
    # 测试事件
    test_event = Event(
        event_type=EventType.ADAPTER_STARTED,
        source="example-http-client",
        data={'test': True}
    )
    
    # 检查过滤结果
    matches = filter_chain.matches(test_event)
    logger.info(f"Event matches filter: {matches}")


async def discovery_example():
    """适配器发现示例"""
    manager = AdapterManager()
    
    try:
        await manager.initialize()
        await manager.start()
        
        # 注册一些适配器...
        # (省略注册代码)
        
        # 按类型查找适配器
        http_adapters = manager.find_adapters(adapter_type=AdapterType.NETWORK.value)
        logger.info(f"Found {len(http_adapters)} network adapters")
        
        # 按标签查找适配器
        example_adapters = manager.find_adapters(tags={'example'})
        logger.info(f"Found {len(example_adapters)} example adapters")
        
        # 查找健康的适配器
        discovery_service = manager._discovery_service
        healthy_adapters = discovery_service.find_healthy_adapters()
        logger.info(f"Found {len(healthy_adapters)} healthy adapters")
        
        # 搜索适配器
        search_results = discovery_service.search_adapters("http", fields=['name', 'description'])
        logger.info(f"Search results: {len(search_results)} adapters")
        
    finally:
        await manager.stop()


if __name__ == "__main__":
    # 运行主示例
    asyncio.run(main())
    
    # 运行其他示例
    # asyncio.run(event_filtering_example())
    # asyncio.run(discovery_example())

#!/usr/bin/env python3
"""
适配器管理器使用示例
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any

# 导入适配器管理器
from ..manager.adapter_manager import (
    AdapterManager, ManagerConfig, DeploymentMode, OperationType,
    create_development_manager, create_production_manager,
    quick_start_manager
)
from ..base.loader import LoadSource
from ..base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ================================
# 示例适配器类
# ================================

class ExampleTextAdapter(BaseAdapter):
    """示例文本处理适配器"""
    
    ADAPTER_ID = "example_text_adapter"
    ADAPTER_NAME = "示例文本适配器"
    ADAPTER_DESCRIPTION = "用于演示的简单文本处理适配器"
    ADAPTER_VERSION = "1.0.0"
    
    async def _load_metadata(self):
        """加载适配器元数据"""
        # 这里应该返回实际的元数据对象
        # 为了示例简单，我们返回None
        return None
    
    async def _initialize_impl(self) -> bool:
        """初始化适配器"""
        logger.info(f"Initializing {self.ADAPTER_NAME}")
        self.initialized = True
        return True
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理数据"""
        if isinstance(input_data, str):
            # 简单的文本处理：转换为大写
            result = input_data.upper()
            logger.info(f"Processed text: '{input_data}' -> '{result}'")
            return result
        else:
            raise ValueError("Input must be a string")
    
    def _get_capabilities_impl(self):
        """获取能力列表"""
        return ["text_processing", "uppercase_conversion"]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查"""
        is_healthy = hasattr(self, 'initialized') and self.initialized
        return HealthCheckResult(
            is_healthy=is_healthy,
            status="healthy" if is_healthy else "unhealthy",
            message="Adapter is working properly" if is_healthy else "Adapter not initialized"
        )
    
    async def _cleanup_impl(self):
        """清理资源"""
        logger.info(f"Cleaning up {self.ADAPTER_NAME}")
        self.initialized = False

class ExampleNumberAdapter(BaseAdapter):
    """示例数字处理适配器"""
    
    ADAPTER_ID = "example_number_adapter"
    ADAPTER_NAME = "示例数字适配器"
    ADAPTER_DESCRIPTION = "用于演示的简单数字处理适配器"
    ADAPTER_VERSION = "1.0.0"
    
    async def _load_metadata(self):
        """加载适配器元数据"""
        return None
    
    async def _initialize_impl(self) -> bool:
        """初始化适配器"""
        logger.info(f"Initializing {self.ADAPTER_NAME}")
        self.initialized = True
        return True
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理数据"""
        if isinstance(input_data, (int, float)):
            # 简单的数字处理：乘以2
            result = input_data * 2
            logger.info(f"Processed number: {input_data} -> {result}")
            return result
        else:
            raise ValueError("Input must be a number")
    
    def _get_capabilities_impl(self):
        """获取能力列表"""
        return ["number_processing", "multiplication"]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查"""
        is_healthy = hasattr(self, 'initialized') and self.initialized
        return HealthCheckResult(
            is_healthy=is_healthy,
            status="healthy" if is_healthy else "unhealthy",
            message="Adapter is working properly" if is_healthy else "Adapter not initialized"
        )
    
    async def _cleanup_impl(self):
        """清理资源"""
        logger.info(f"Cleaning up {self.ADAPTER_NAME}")
        self.initialized = False

# ================================
# 示例函数
# ================================

async def basic_usage_example():
    """基础使用示例"""
    logger.info("=" * 50)
    logger.info("基础使用示例")
    logger.info("=" * 50)
    
    # 创建开发环境管理器
    manager = create_development_manager()
    
    try:
        # 启动管理器
        await manager.start()
        
        # 注册适配器
        text_result = await manager.register_adapter(
            adapter_id="text_adapter",
            adapter_class=ExampleTextAdapter,
            config={"adapter_id": "text_adapter"},
            auto_start=True
        )
        logger.info(f"Text adapter registration: {text_result.success}")
        
        number_result = await manager.register_adapter(
            adapter_id="number_adapter",
            adapter_class=ExampleNumberAdapter,
            config={"adapter_id": "number_adapter"},
            auto_start=True
        )
        logger.info(f"Number adapter registration: {number_result.success}")
        
        # 查看管理器状态
        status = manager.get_manager_status()
        logger.info(f"Manager status: {status['status']}")
        logger.info(f"Total adapters: {status['registry_status']['registered_adapters']}")
        
        # 获取适配器摘要
        summary = manager.get_adapter_summary()
        logger.info(f"Adapter summary: {summary}")
        
    finally:
        # 停止管理器
        await manager.stop()

async def batch_operations_example():
    """批量操作示例"""
    logger.info("=" * 50)
    logger.info("批量操作示例")
    logger.info("=" * 50)
    
    manager = create_development_manager()
    
    try:
        await manager.start()
        
        # 批量注册多个适配器
        adapters_to_register = [
            ("text_1", ExampleTextAdapter),
            ("text_2", ExampleTextAdapter),
            ("number_1", ExampleNumberAdapter),
            ("number_2", ExampleNumberAdapter),
        ]
        
        # 注册所有适配器
        for adapter_id, adapter_class in adapters_to_register:
            await manager.register_adapter(
                adapter_id=adapter_id,
                adapter_class=adapter_class,
                config={"adapter_id": adapter_id},
                auto_start=False  # 不自动启动，我们将批量启动
            )
        
        # 批量启动所有适配器
        start_results = await manager.start_all_adapters()
        logger.info(f"Batch start results: {[(k, v.success) for k, v in start_results.items()]}")
        
        # 等待一段时间
        await asyncio.sleep(2)
        
        # 批量停止所有适配器
        stop_results = await manager.stop_all_adapters()
        logger.info(f"Batch stop results: {[(k, v.success) for k, v in stop_results.items()]}")
        
    finally:
        await manager.stop()

async def monitoring_example():
    """监控和报告示例"""
    logger.info("=" * 50)
    logger.info("监控和报告示例")
    logger.info("=" * 50)
    
    manager = create_production_manager()
    
    try:
        await manager.start()
        
        # 注册一些适配器
        await manager.register_adapter(
            "monitor_test",
            ExampleTextAdapter,
            {"adapter_id": "monitor_test"},
            auto_start=True
        )
        
        # 等待一段时间让监控收集数据
        await asyncio.sleep(3)
        
        # 获取健康报告
        health_report = await manager.get_health_report()
        logger.info("健康报告:")
        logger.info(f"  总体健康分数: {health_report['overall_health']:.2f}")
        logger.info(f"  管理器状态: {health_report['manager_status']}")
        logger.info(f"  适配器健康率: {health_report['adapter_health']['health_rate']:.2f}")
        
        # 获取性能报告
        performance_report = manager.get_performance_report()
        logger.info("性能报告:")
        logger.info(f"  总操作数: {performance_report['manager_metrics']['total_operations']}")
        logger.info(f"  成功率: {performance_report['operation_performance']['success_rate']:.2f}")
        logger.info(f"  平均执行时间: {performance_report['operation_performance']['avg_operation_time']:.3f}s")
        
        # 获取指标历史
        metrics_history = manager.metrics_collector.get_metrics_history(hours=1)
        logger.info(f"指标历史记录数: {len(metrics_history)}")
        
    finally:
        await manager.stop()

async def event_handling_example():
    """事件处理示例"""
    logger.info("=" * 50)
    logger.info("事件处理示例")
    logger.info("=" * 50)
    
    manager = create_development_manager()
    
    # 定义事件监听器
    def on_manager_started(event):
        logger.info(f"📢 Manager started event: {event['data']}")
    
    def on_adapter_loaded(event):
        logger.info(f"🔧 Adapter loaded event: {event['data']}")
    
    def on_operation_completed(event):
        logger.info(f"✅ Operation completed: {event['data']['operation_type']} - Success: {event['data']['success']}")
    
    # 订阅事件
    manager.event_manager.subscribe("manager_started", on_manager_started)
    manager.event_manager.subscribe("adapter_loaded", on_adapter_loaded)
    manager.event_manager.subscribe("operation_completed", on_operation_completed)
    
    try:
        await manager.start()
        
        # 执行一些操作来触发事件
        await manager.register_adapter(
            "event_test",
            ExampleTextAdapter,
            {"adapter_id": "event_test"},
            auto_start=True
        )
        
        # 等待事件处理
        await asyncio.sleep(1)
        
        # 查看事件历史
        recent_events = manager.event_manager.get_recent_events(limit=10)
        logger.info(f"最近事件数量: {len(recent_events)}")
        for event in recent_events[-3:]:  # 显示最近3个事件
            logger.info(f"  事件: {event['event_type']} at {event['timestamp']}")
        
    finally:
        await manager.stop()

async def configuration_management_example():
    """配置管理示例"""
    logger.info("=" * 50)
    logger.info("配置管理示例")
    logger.info("=" * 50)
    
    # 自定义配置
    custom_config = ManagerConfig(
        deployment_mode=DeploymentMode.DEVELOPMENT,
        enable_monitoring=True,
        max_concurrent_operations=5,
        health_check_interval_seconds=10
    )
    
    manager = AdapterManager(custom_config)
    
    try:
        await manager.start()
        logger.info(f"初始配置 - 最大并发操作数: {manager.config.max_concurrent_operations}")
        
        # 动态更新配置
        config_result = await manager.update_config({
            "max_concurrent_operations": 10,
            "health_check_interval_seconds": 15
        })
        
        if config_result.success:
            logger.info("配置更新成功:")
            for field in config_result.results["updated_fields"]:
                logger.info(f"  {field['field']}: {field['old_value']} -> {field['new_value']}")
        
        logger.info(f"更新后配置 - 最大并发操作数: {manager.config.max_concurrent_operations}")
        
    finally:
        await manager.stop()

async def quick_start_example():
    """快速启动示例"""
    logger.info("=" * 50)
    logger.info("快速启动示例")
    logger.info("=" * 50)
    
    # 定义要加载的适配器配置
    adapters_config = [
        {
            "adapter_id": "quick_text",
            "adapter_class": ExampleTextAdapter,
            "config": {"adapter_id": "quick_text"},
            "auto_start": True
        },
        {
            "adapter_id": "quick_number",
            "adapter_class": ExampleNumberAdapter,
            "config": {"adapter_id": "quick_number"},
            "auto_start": True
        }
    ]
    
    # 管理器配置
    manager_config = {
        "deployment_mode": DeploymentMode.DEVELOPMENT,
        "enable_monitoring": True
    }
    
    # 快速启动
    manager = await quick_start_manager(adapters_config, manager_config)
    
    try:
        # 查看启动结果
        summary = manager.get_adapter_summary()
        logger.info(f"快速启动完成，总适配器数: {summary['total_adapters']}")
        logger.info(f"状态分布: {summary['status_distribution']}")
        
        # 测试适配器
        text_adapter = manager.registry.get_adapter("quick_text")
        if text_adapter:
            context = ExecutionContext()
            result = await text_adapter.process("hello world", context)
            logger.info(f"文本适配器测试结果: {result}")
        
    finally:
        await manager.stop()

async def main():
    """主函数"""
    logger.info("🚀 适配器管理器示例演示开始")
    
    try:
        # 基础使用示例
        await basic_usage_example()
        await asyncio.sleep(1)
        
        # 批量操作示例
        await batch_operations_example()
        await asyncio.sleep(1)
        
        # 监控示例
        await monitoring_example()
        await asyncio.sleep(1)
        
        # 事件处理示例
        await event_handling_example()
        await asyncio.sleep(1)
        
        # 配置管理示例
        await configuration_management_example()
        await asyncio.sleep(1)
        
        # 快速启动示例
        await quick_start_example()
        
    except Exception as e:
        logger.error(f"演示过程中出现错误: {e}", exc_info=True)
    
    logger.info("适配器管理器示例演示完成")

if __name__ == "__main__":
    asyncio.run(main())

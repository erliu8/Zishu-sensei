#!/usr/bin/env python3
"""
指标服务集成示例

演示如何使用适配器管理器的指标功能
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from zishu.adapters.core.manager import AdapterManager, AdapterManagerConfig
from zishu.adapters.core.services.metrics_service import AdapterMetricsServiceConfig
from zishu.adapters.core.types import AdapterConfiguration
from zishu.adapters.core.metrics.alerts import AlertRule, AlertCondition

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MockAdapter:
    """模拟适配器用于演示"""
    
    def __init__(self, adapter_id: str):
        self.adapter_id = adapter_id
        self.status = "running"
    
    async def start(self):
        logger.info(f"Starting adapter {self.adapter_id}")
        await asyncio.sleep(0.1)
    
    async def stop(self):
        logger.info(f"Stopping adapter {self.adapter_id}")
        await asyncio.sleep(0.1)
    
    async def health_check(self):
        return {"status": "healthy", "adapter_id": self.adapter_id}


async def setup_adapter_manager_with_metrics():
    """设置带指标功能的适配器管理器"""
    
    # 配置指标服务
    metrics_config = AdapterMetricsServiceConfig(
        # 存储配置
        storage_type="memory",
        storage_config={},
        
        # 收集器配置
        enable_system_metrics=True,
        enable_adapter_metrics=True,
        enable_performance_metrics=True,
        collection_interval=30,  # 30秒收集一次
        
        # 导出器配置
        enable_prometheus_export=True,
        prometheus_port=8080,
        enable_json_export=True,
        json_port=8081,
        
        # 告警配置
        enable_alerts=True,
        alert_channels=['log', 'webhook'],
        
        # 仪表板配置
        enable_dashboard=True,
        
        # 其他配置
        metrics_retention_days=7,
        max_metrics_per_adapter=1000
    )
    
    # 配置适配器管理器
    manager_config = AdapterManagerConfig(
        max_adapters=50,
        startup_timeout=30.0,
        shutdown_timeout=10.0,
        health_check_interval=60.0,
        enable_auto_recovery=True,
        enable_validation=True,
        enable_metrics=True,  # 启用指标
        enable_security=False,  # 简化示例，禁用安全
        metrics_config=metrics_config
    )
    
    # 创建管理器
    manager = AdapterManager(manager_config)
    return manager


async def demonstrate_metrics_features(manager: AdapterManager):
    """演示指标功能"""
    
    logger.info("=== 演示指标功能 ===")
    
    # 1. 注册一些模拟适配器
    logger.info("1. 注册适配器...")
    
    for i in range(3):
        config = AdapterConfiguration(
            adapter_id=f"demo_adapter_{i}",
            adapter_type="mock",
            name=f"Demo Adapter {i}",
            description=f"Demo adapter for metrics testing {i}",
            version="1.0.0",
            config={
                "mock_param": f"value_{i}"
            }
        )
        
        success = await manager.register_adapter(config)
        logger.info(f"Adapter {config.adapter_id} registered: {success}")
    
    # 等待一段时间让指标收集
    logger.info("2. 等待指标收集...")
    await asyncio.sleep(5)
    
    # 3. 获取系统指标
    logger.info("3. 获取系统指标...")
    system_metrics = await manager.get_system_metrics()
    logger.info(f"系统指标: {system_metrics}")
    
    # 4. 获取特定适配器的指标
    logger.info("4. 获取适配器指标...")
    adapter_metrics = await manager.get_adapter_metrics("demo_adapter_0")
    logger.info(f"适配器指标: {adapter_metrics}")
    
    # 5. 获取被跟踪的适配器列表
    logger.info("5. 获取被跟踪的适配器...")
    tracked_adapters = manager.get_tracked_adapters()
    logger.info(f"被跟踪的适配器: {tracked_adapters}")
    
    # 6. 导出Prometheus格式的指标
    logger.info("6. 导出Prometheus指标...")
    prometheus_metrics = await manager.export_metrics("prometheus")
    if prometheus_metrics:
        logger.info(f"Prometheus指标 (前500字符): {prometheus_metrics[:500]}...")
    
    # 7. 获取仪表板数据
    logger.info("7. 获取仪表板数据...")
    dashboard_data = await manager.get_metrics_dashboard_data("system")
    if dashboard_data:
        logger.info(f"系统仪表板数据: {dashboard_data}")
    
    # 8. 创建自定义告警规则
    logger.info("8. 创建自定义告警规则...")
    if manager.metrics_service:
        custom_rule = AlertRule(
            name="demo_high_adapter_count",
            description="Too many demo adapters running",
            condition=AlertCondition(
                metric_name="adapter_count",
                operator="gt",
                threshold=2.0,
                duration_minutes=1
            ),
            severity="warning",
            channels=["log"]
        )
        
        success = await manager.metrics_service.create_custom_alert_rule(custom_rule)
        logger.info(f"自定义告警规则创建: {success}")


async def demonstrate_metrics_over_time(manager: AdapterManager):
    """演示一段时间内的指标变化"""
    
    logger.info("=== 演示指标时间序列 ===")
    
    # 模拟一些活动
    logger.info("1. 模拟适配器活动...")
    
    for i in range(5):
        # 启动一个适配器
        await manager.start_adapter(f"demo_adapter_{i % 3}")
        await asyncio.sleep(2)
        
        # 获取当前指标
        metrics = await manager.get_system_metrics()
        logger.info(f"第{i+1}次活动后的指标: 运行中适配器={metrics.get('running_adapters', 0)}")
        
        # 停止适配器
        await manager.stop_adapter(f"demo_adapter_{i % 3}")
        await asyncio.sleep(1)
    
    # 2. 获取一段时间内的适配器指标
    logger.info("2. 获取时间范围内的指标...")
    end_time = datetime.now()
    start_time = end_time - timedelta(minutes=5)
    
    for adapter_id in ["demo_adapter_0", "demo_adapter_1"]:
        metrics = await manager.get_adapter_metrics(
            adapter_id, 
            start_time=start_time, 
            end_time=end_time
        )
        logger.info(f"适配器 {adapter_id} 时间序列指标: {len(metrics)} 个指标族")


async def demonstrate_error_metrics(manager: AdapterManager):
    """演示错误指标收集"""
    
    logger.info("=== 演示错误指标 ===")
    
    # 模拟一些错误情况
    try:
        # 尝试启动不存在的适配器
        await manager.start_adapter("non_existent_adapter")
    except Exception as e:
        logger.info(f"预期的错误: {e}")
    
    try:
        # 尝试注册无效配置的适配器
        invalid_config = AdapterConfiguration(
            adapter_id="",  # 无效的空ID
            adapter_type="invalid",
            name="Invalid Adapter",
            description="This should fail validation",
            version="1.0.0",
            config={}
        )
        await manager.register_adapter(invalid_config)
    except Exception as e:
        logger.info(f"预期的验证错误: {e}")
    
    # 等待错误指标被记录
    await asyncio.sleep(2)
    
    # 获取系统指标查看错误统计
    metrics = await manager.get_system_metrics()
    logger.info(f"错误后的系统指标: {metrics}")


async def main():
    """主函数"""
    
    logger.info("开始指标服务集成演示")
    
    # 设置适配器管理器
    manager = await setup_adapter_manager_with_metrics()
    
    try:
        # 初始化并启动管理器
        logger.info("初始化适配器管理器...")
        await manager.initialize()
        await manager.start()
        
        logger.info("适配器管理器启动成功")
        
        # 演示各种指标功能
        await demonstrate_metrics_features(manager)
        await asyncio.sleep(2)
        
        await demonstrate_metrics_over_time(manager)
        await asyncio.sleep(2)
        
        await demonstrate_error_metrics(manager)
        await asyncio.sleep(2)
        
        # 最终系统状态
        logger.info("=== 最终系统状态 ===")
        final_metrics = await manager.get_system_metrics()
        logger.info(f"最终系统指标: {final_metrics}")
        
        # 显示指标服务统计
        if manager.metrics_service:
            stats = manager.metrics_service.get_service_stats()
            logger.info(f"指标服务统计: {stats}")
        
        logger.info("演示完成，系统将保持运行5秒以便查看指标...")
        await asyncio.sleep(5)
        
    except Exception as e:
        logger.error(f"演示过程中发生错误: {e}")
        raise
    
    finally:
        # 清理
        logger.info("关闭适配器管理器...")
        await manager.stop()
        await manager.cleanup()
        logger.info("演示结束")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("演示被用户中断")
    except Exception as e:
        logger.error(f"演示失败: {e}")
        raise

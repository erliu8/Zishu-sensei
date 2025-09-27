"""
注册中心使用示例 - 完整演示适配器注册中心的功能
====================================================

这个示例展示了如何使用适配器注册中心来管理多个适配器，
包括注册、依赖管理、生命周期控制、事件监听和健康监控等功能。

运行这个示例来了解适配器系统的完整工作流程。
"""

import asyncio
import logging
from typing import Any, Dict, List
from datetime import datetime, timezone

# 导入适配器系统组件
from ..base.registry import (
    AdapterRegistry, create_adapter_registry, EventType, RegistryEvent,
    AdapterRegistrationStatus, RegistryStatus
)
from ..base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
from ..base.metadata import AdapterMetadata, AdapterType, SecurityLevel, AdapterCapability, AdapterDependency
from ..base.exceptions import AdapterRegistrationError, AdapterNotFoundError

# 导入示例适配器
from .sample_adapter import SampleAdapter

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ================================
# 创建多个示例适配器类
# ================================

class TextValidatorAdapter(BaseAdapter):
    """文本验证适配器 - 验证输入文本的格式"""
    
    def _load_metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name="Text Validator",
            version=self.version,
            description="Validates text format and content",
            adapter_type=AdapterType.SOFT,
            security_level=SecurityLevel.PUBLIC,
            author="Zishu Team",
            created_at=datetime.now(timezone.utc),
            tags=["validation", "text", "preprocessing"],
            dependencies=[]
        )
    
    async def _initialize_impl(self) -> bool:
        self.min_length = self.config.get('min_length', 1)
        self.max_length = self.config.get('max_length', 1000)
        return True
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        if not isinstance(input_data, str):
            return {
                "valid": False,
                "reason": f"Expected string, got {type(input_data).__name__}",
                "original": input_data
            }
        
        text = input_data.strip()
        
        if len(text) < self.min_length:
            return {
                "valid": False,
                "reason": f"Text too short (min: {self.min_length})",
                "original": input_data
            }
        
        if len(text) > self.max_length:
            return {
                "valid": False,
                "reason": f"Text too long (max: {self.max_length})",
                "original": input_data
            }
        
        return {
            "valid": True,
            "reason": "Text validation passed",
            "original": input_data,
            "cleaned": text,
            "length": len(text)
        }
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        return [
            AdapterCapability(
                name="validate_text",
                description="Validate text length and format",
                category="validation"
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        return HealthCheckResult(
            is_healthy=True,
            status="healthy",
            checks={"config_valid": True}
        )
    
    async def _cleanup_impl(self) -> None:
        pass


class TextAnalyzerAdapter(BaseAdapter):
    """文本分析适配器 - 分析文本内容，依赖于验证适配器"""
    
    def _load_metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name="Text Analyzer",
            version=self.version,
            description="Analyzes text content and statistics",
            adapter_type=AdapterType.SOFT,
            security_level=SecurityLevel.PUBLIC,
            author="Zishu Team",
            created_at=datetime.now(timezone.utc),
            tags=["analysis", "text", "statistics"],
            dependencies=[
                AdapterDependency(
                    name="text_validator",
                    type="adapter",
                    version=">=1.0.0",
                    required=True,
                    description="Text validation service"
                )
            ]
        )
    
    async def _initialize_impl(self) -> bool:
        # 验证依赖适配器是否可用
        validator_id = self.config.get('validator_adapter_id', 'text_validator')
        self.validator_id = validator_id
        return True
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        # 这里通常会调用依赖的适配器进行预处理
        # 为了简化示例，我们直接分析文本
        
        if not isinstance(input_data, str):
            return {
                "error": f"Expected string input, got {type(input_data).__name__}"
            }
        
        text = input_data.strip()
        words = text.split()
        
        analysis = {
            "original_text": input_data,
            "cleaned_text": text,
            "character_count": len(text),
            "word_count": len(words),
            "sentence_count": text.count('.') + text.count('!') + text.count('?'),
            "paragraph_count": text.count('\n\n') + 1,
            "average_word_length": sum(len(word) for word in words) / len(words) if words else 0,
            "most_common_words": {},  # 简化实现
            "analysis_time": datetime.now(timezone.utc).isoformat()
        }
        
        return analysis
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        return [
            AdapterCapability(
                name="text_statistics",
                description="Generate text statistics",
                category="analysis"
            ),
            AdapterCapability(
                name="word_analysis",
                description="Analyze word patterns",
                category="analysis"
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        # 检查依赖适配器状态
        checks = {"dependency_available": True}  # 简化实现
        return HealthCheckResult(
            is_healthy=True,
            status="healthy",
            checks=checks
        )
    
    async def _cleanup_impl(self) -> None:
        pass


# ================================
# 事件监听器
# ================================

class RegistryEventListener:
    """注册中心事件监听器"""
    
    def __init__(self):
        self.events_received = []
        self.logger = logging.getLogger(f"{__name__}.EventListener")
    
    async def on_adapter_registered(self, event: RegistryEvent):
        """适配器注册事件处理器"""
        self.logger.info(f"✅ Adapter registered: {event.adapter_id}")
        self.events_received.append(event)
    
    async def on_adapter_started(self, event: RegistryEvent):
        """适配器启动事件处理器"""
        self.logger.info(f"🚀 Adapter started: {event.adapter_id}")
        self.events_received.append(event)
    
    async def on_adapter_stopped(self, event: RegistryEvent):
        """适配器停止事件处理器"""
        self.logger.info(f"🛑 Adapter stopped: {event.adapter_id}")
        self.events_received.append(event)
    
    async def on_adapter_error(self, event: RegistryEvent):
        """适配器错误事件处理器"""
        self.logger.error(f"❌ Adapter error: {event.adapter_id} - {event.data.get('error', 'Unknown error')}")
        self.events_received.append(event)
    
    async def on_health_changed(self, event: RegistryEvent):
        """健康状态变化事件处理器"""
        current_status = event.data.get('current_status', 'unknown')
        self.logger.info(f"💓 Health changed for {event.adapter_id}: {current_status}")
        self.events_received.append(event)
    
    def get_event_summary(self) -> Dict[str, int]:
        """获取事件统计摘要"""
        summary = {}
        for event in self.events_received:
            event_type = event.event_type.value
            summary[event_type] = summary.get(event_type, 0) + 1
        return summary


# ================================
# 主示例函数
# ================================

async def demonstrate_basic_registry_usage():
    """演示基本的注册中心使用"""
    logger.info("🔧 Creating adapter registry...")
    
    # 创建注册中心实例
    registry = create_adapter_registry(
        enable_health_monitoring=True,
        health_check_interval=5,
        max_concurrent_operations=5
    )
    
    try:
        # 启动注册中心
        await registry.start()
        logger.info(f"✅ Registry started: {registry.status}")
        
        # 定义适配器配置
        adapter_configs = [
            {
                "adapter_id": "text_validator",
                "adapter_class": TextValidatorAdapter,
                "config": {
                    "adapter_id": "text_validator",
                    "name": "Text Validator",
                    "version": "1.0.0",
                    "min_length": 3,
                    "max_length": 500
                },
                "tags": {"validation", "text"}
            },
            {
                "adapter_id": "sample_processor", 
                "adapter_class": SampleAdapter,
                "config": {
                    "adapter_id": "sample_processor",
                    "name": "Sample Text Processor",
                    "version": "1.0.0",
                    "case_transform": "title",
                    "add_prefix": "[Processed] "
                },
                "tags": {"processing", "text"}
            },
            {
                "adapter_id": "text_analyzer",
                "adapter_class": TextAnalyzerAdapter,
                "config": {
                    "adapter_id": "text_analyzer",
                    "name": "Text Analyzer",
                    "version": "1.0.0",
                    "validator_adapter_id": "text_validator"
                },
                "tags": {"analysis", "text"}
            }
        ]
        
        # 注册适配器
        logger.info("📝 Registering adapters...")
        for config in adapter_configs:
            registration = await registry.register_adapter(
                adapter_id=config["adapter_id"],
                adapter_class=config["adapter_class"],
                config=config["config"],
                tags=config.get("tags", set())
            )
            logger.info(f"  ✅ Registered: {registration.adapter_id}")
        
        # 显示依赖关系图
        logger.info("🔗 Dependency graph:")
        dep_graph = registry.get_dependency_graph()
        for adapter_id, deps in dep_graph["dependencies"].items():
            if deps:
                logger.info(f"  {adapter_id} -> {deps}")
            else:
                logger.info(f"  {adapter_id} (no dependencies)")
        
        # 显示启动顺序
        startup_order = registry.get_startup_order()
        logger.info(f"🚀 Startup order: {startup_order}")
        
        # 启动所有适配器
        logger.info("▶️  Starting all adapters...")
        start_results = await registry.start_all_adapters(parallel_groups=True)
        for adapter_id, success in start_results.items():
            status = "✅" if success else "❌"
            logger.info(f"  {status} {adapter_id}: {success}")
        
        # 显示注册中心状态
        registry_status = registry.get_registry_status()
        logger.info(f"📊 Registry Status:")
        logger.info(f"  Status: {registry_status['status']}")
        logger.info(f"  Registered: {registry_status['registered_adapters']}")
        logger.info(f"  Running: {registry_status['running_adapters']}")
        logger.info(f"  Errors: {registry_status['error_adapters']}")
        
        # 测试适配器功能
        await demonstrate_adapter_execution(registry)
        
        # 等待一段时间让健康监控工作
        logger.info("⏳ Waiting for health monitoring...")
        await asyncio.sleep(6)
        
        # 显示健康状态
        health_summary = await registry.get_health_summary()
        logger.info(f"💓 Health Summary: {health_summary}")
        
        # 显示性能指标
        perf_summary = registry.get_performance_summary()
        logger.info(f"⚡ Performance Summary: {perf_summary}")
        
    except Exception as e:
        logger.error(f"❌ Error in demo: {e}")
        raise
    
    finally:
        # 停止注册中心
        logger.info("🛑 Stopping registry...")
        await registry.stop()
        logger.info("✅ Registry stopped")


async def demonstrate_adapter_execution(registry: AdapterRegistry):
    """演示适配器执行"""
    logger.info("🧪 Testing adapter execution...")
    
    # 获取适配器实例
    validator = registry.get_adapter("text_validator")
    processor = registry.get_adapter("sample_processor")
    analyzer = registry.get_adapter("text_analyzer")
    
    test_texts = [
        "hello world",
        "this is a sample text for processing",
        "another test case with different content"
    ]
    
    for i, text in enumerate(test_texts, 1):
        logger.info(f"📝 Test {i}: '{text}'")
        
        # 验证文本
        if validator:
            validation_result = await validator.process(text)
            logger.info(f"  🔍 Validation: {validation_result.output['valid']} - {validation_result.output['reason']}")
        
        # 处理文本
        if processor:
            process_result = await processor.process(text)
            logger.info(f"  ⚙️  Processing: '{process_result.output['processed']}'")
        
        # 分析文本
        if analyzer:
            analysis_result = await analyzer.process(text)
            analysis = analysis_result.output
            logger.info(f"  📊 Analysis: {analysis['word_count']} words, {analysis['character_count']} chars")


async def demonstrate_event_system():
    """演示事件系统"""
    logger.info("🎪 Demonstrating event system...")
    
    # 创建注册中心和事件监听器
    registry = create_adapter_registry(enable_health_monitoring=False)
    event_listener = RegistryEventListener()
    
    # 订阅事件
    registry.event_bus.subscribe(EventType.ADAPTER_REGISTERED, event_listener.on_adapter_registered)
    registry.event_bus.subscribe(EventType.ADAPTER_STARTED, event_listener.on_adapter_started)
    registry.event_bus.subscribe(EventType.ADAPTER_STOPPED, event_listener.on_adapter_stopped)
    registry.event_bus.subscribe(EventType.ADAPTER_ERROR, event_listener.on_adapter_error)
    registry.event_bus.subscribe(EventType.ADAPTER_HEALTH_CHANGED, event_listener.on_health_changed)
    
    try:
        await registry.start()
        
        # 注册一个适配器
        await registry.register_adapter(
            adapter_id="demo_adapter",
            adapter_class=SampleAdapter,
            config={
                "adapter_id": "demo_adapter",
                "name": "Demo Adapter",
                "version": "1.0.0"
            }
        )
        
        # 启动适配器
        await registry.start_adapter("demo_adapter")
        
        # 停止适配器
        await registry.stop_adapter("demo_adapter")
        
        # 显示事件统计
        await asyncio.sleep(0.1)  # 等待事件处理
        event_summary = event_listener.get_event_summary()
        logger.info(f"📊 Event Summary: {event_summary}")
        
        # 显示最近的事件
        recent_events = registry.event_bus.get_recent_events(limit=10)
        logger.info(f"📅 Recent Events ({len(recent_events)}):")
        for event in recent_events[-5:]:  # 显示最后5个事件
            logger.info(f"  {event.timestamp.strftime('%H:%M:%S')} - {event.event_type.value}: {event.adapter_id}")
    
    finally:
        await registry.stop()


async def demonstrate_error_handling():
    """演示错误处理"""
    logger.info("🚨 Demonstrating error handling...")
    
    registry = create_adapter_registry()
    
    try:
        await registry.start()
        
        # 尝试注册重复的适配器
        try:
            config = {
                "adapter_id": "test_adapter",
                "name": "Test Adapter",
                "version": "1.0.0"
            }
            
            await registry.register_adapter("test_adapter", SampleAdapter, config)
            await registry.register_adapter("test_adapter", SampleAdapter, config)  # 重复注册
        except AdapterRegistrationError as e:
            logger.info(f"✅ Caught expected error: {e}")
        
        # 尝试启动不存在的适配器
        try:
            await registry.start_adapter("nonexistent_adapter")
        except AdapterNotFoundError as e:
            logger.info(f"✅ Caught expected error: {e}")
        
        # 显示错误统计
        registry_status = registry.get_registry_status()
        logger.info(f"📊 Error Statistics: {registry_status['stats']['total_errors']} total errors")
        
    finally:
        await registry.stop()


# ================================
# 主程序入口
# ================================

async def main():
    """主演示程序"""
    print("=" * 80)
    print("🎯 紫舒老师适配器系统 - 注册中心完整演示")
    print("=" * 80)
    print()
    
    try:
        # 1. 基本注册中心使用
        await demonstrate_basic_registry_usage()
        print("\n" + "=" * 60 + "\n")
        
        # 2. 事件系统演示
        await demonstrate_event_system()
        print("\n" + "=" * 60 + "\n")
        
        # 3. 错误处理演示
        await demonstrate_error_handling()
        
        print("\n" + "=" * 80)
        print("✅ 所有演示完成！")
        print("=" * 80)
        
    except KeyboardInterrupt:
        print("\n🛑 用户中断了演示")
    except Exception as e:
        logger.error(f"❌ 演示过程中发生错误: {e}")
        raise


if __name__ == "__main__":
    # 设置异步事件循环策略（在某些系统上需要）
    try:
        import uvloop
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    except ImportError:
        pass  # uvloop不可用，使用默认策略
    
    # 运行主程序
    asyncio.run(main())

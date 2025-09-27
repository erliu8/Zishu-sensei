"""
示例适配器实现 - 演示如何继承和实现BaseAdapter

这个示例展示了如何正确继承BaseAdapter类并实现所有必需的抽象方法。
"""

import asyncio
from typing import Any, Dict, List
from datetime import datetime, timezone

# 导入基础适配器类和相关类型
from ..base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
from ..base.metadata import AdapterMetadata, AdapterType, AdapterCapability, SecurityLevel
from ..base.exceptions import AdapterLoadingError, AdapterExecutionError


class SampleAdapter(BaseAdapter):
    """
    示例适配器实现
    
    这个适配器展示了如何实现一个简单的文本处理适配器，
    可以对输入的文本进行基础的处理操作。
    """
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name="Sample Text Processor",
            version=self.version,
            description="A sample adapter for text processing operations",
            adapter_type=AdapterType.SOFT,
            security_level=SecurityLevel.PUBLIC,
            author="Zishu Sensei Team",
            created_at=datetime.now(timezone.utc),
            tags=["sample", "text", "processing"],
            dependencies=[],
            configuration_schema={
                "type": "object",
                "properties": {
                    "case_transform": {
                        "type": "string",
                        "enum": ["upper", "lower", "title"],
                        "default": "lower"
                    },
                    "add_prefix": {
                        "type": "string",
                        "default": ""
                    }
                }
            }
        )
    
    async def _initialize_impl(self) -> bool:
        """初始化适配器"""
        try:
            # 验证配置
            self.case_transform = self.config.get('case_transform', 'lower')
            self.add_prefix = self.config.get('add_prefix', '')
            
            # 模拟初始化过程
            await asyncio.sleep(0.1)  # 模拟初始化延迟
            
            self.logger.info(f"Sample adapter initialized with case_transform={self.case_transform}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize sample adapter: {e}")
            return False
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理输入数据"""
        if not isinstance(input_data, str):
            raise AdapterExecutionError(
                f"Sample adapter expects string input, got {type(input_data).__name__}",
                adapter_id=self.adapter_id,
                context={"input_type": type(input_data).__name__}
            )
        
        # 模拟处理延迟
        if context.debug_mode:
            await asyncio.sleep(0.05)
        
        # 执行文本处理
        result = input_data
        
        # 应用前缀
        if self.add_prefix:
            result = f"{self.add_prefix}{result}"
        
        # 应用大小写转换
        if self.case_transform == 'upper':
            result = result.upper()
        elif self.case_transform == 'lower':
            result = result.lower()
        elif self.case_transform == 'title':
            result = result.title()
        
        # 记录处理信息
        self.logger.debug(f"Processed text: '{input_data}' -> '{result}'")
        
        return {
            "original": input_data,
            "processed": result,
            "transform_applied": self.case_transform,
            "prefix_added": self.add_prefix,
            "processing_time": datetime.now(timezone.utc).isoformat()
        }
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力"""
        return [
            AdapterCapability(
                name="text_transform",
                description="Transform text case (upper, lower, title)",
                category="text_processing",
                parameters={
                    "case_transform": {
                        "type": "string",
                        "enum": ["upper", "lower", "title"]
                    }
                }
            ),
            AdapterCapability(
                name="add_prefix",
                description="Add prefix to text",
                category="text_processing", 
                parameters={
                    "prefix": {
                        "type": "string",
                        "description": "Prefix to add to text"
                    }
                }
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """执行健康检查"""
        checks = {}
        issues = []
        recommendations = []
        
        # 检查配置有效性
        valid_transforms = ["upper", "lower", "title"]
        if self.case_transform not in valid_transforms:
            checks["valid_case_transform"] = False
            issues.append(f"Invalid case transform: {self.case_transform}")
            recommendations.append(f"Use one of: {', '.join(valid_transforms)}")
        else:
            checks["valid_case_transform"] = True
        
        # 检查基础功能
        try:
            test_result = await self._process_impl("test", ExecutionContext())
            checks["basic_processing"] = True
        except Exception as e:
            checks["basic_processing"] = False
            issues.append(f"Basic processing test failed: {str(e)}")
        
        # 计算整体健康状态
        is_healthy = all(checks.values())
        status = "healthy" if is_healthy else "unhealthy"
        
        return HealthCheckResult(
            is_healthy=is_healthy,
            status=status,
            checks=checks,
            metrics={
                "config_case_transform": self.case_transform,
                "config_add_prefix": self.add_prefix
            },
            issues=issues,
            recommendations=recommendations
        )
    
    async def _cleanup_impl(self) -> None:
        """清理适配器资源"""
        # 对于这个简单的示例适配器，没有特殊的清理需求
        self.logger.info("Sample adapter cleanup completed")


# ================================
# 使用示例
# ================================

async def main():
    """示例使用方法"""
    
    # 创建适配器配置
    config = {
        "adapter_id": "sample_text_processor",
        "adapter_type": "soft",
        "name": "Sample Text Processor",
        "version": "1.0.0",
        "case_transform": "upper",
        "add_prefix": "[PROCESSED] "
    }
    
    # 创建适配器实例
    adapter = SampleAdapter(config)
    
    try:
        # 使用上下文管理器自动管理生命周期
        async with adapter:
            print(f"Adapter info: {adapter.get_basic_info()}")
            print(f"Capabilities: {[cap.name for cap in adapter.get_capabilities()]}")
            
            # 处理一些文本
            test_inputs = [
                "hello world",
                "this is a test",
                "sample adapter demo"
            ]
            
            for text in test_inputs:
                result = await adapter.process(text)
                print(f"Input: '{text}'")
                print(f"Output: {result.output}")
                print(f"Status: {result.status}, Time: {result.execution_time:.3f}s")
                print("-" * 50)
            
            # 执行健康检查
            health = await adapter.health_check()
            print(f"Health Status: {health.status}")
            print(f"Health Checks: {health.checks}")
            
            # 查看性能指标
            metrics = adapter.get_performance_metrics()
            print(f"Performance: {metrics}")
            
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())

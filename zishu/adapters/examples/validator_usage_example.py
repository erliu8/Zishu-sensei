"""
适配器验证器使用示例
===================

这个示例展示了如何使用适配器验证器来验证适配器的各个方面，
包括结构、元数据、配置、依赖关系、安全性和性能等。
"""

import asyncio
import sys
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime, timezone

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

# 导入验证器相关组件
from base.validator import (
    AdapterValidator, ValidationConfig, ValidatorMode, ValidationCategory,
    ValidationSeverity, create_validator, create_development_validator,
    create_production_validator, validate_adapter_class, quick_validate
)

# 导入适配器基础组件
from base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
from base.metadata import (
    AdapterMetadata, AdapterType, AdapterCapability, AdapterDependency,
    AdapterConfiguration, AdapterPermissions, AdapterVersion, SecurityLevel,
    CapabilityCategory
)
from base.exceptions import AdapterExecutionError

# ================================
# 示例适配器类 - 良好实现
# ================================

class GoodExampleAdapter(BaseAdapter):
    """良好的适配器实现示例"""
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        return AdapterMetadata(
            adapter_id="good_example_adapter",
            name="Good Example Adapter",
            display_name="优秀示例适配器",
            description="这是一个展示良好实践的示例适配器",
            adapter_type=AdapterType.SOFT,
            version=AdapterVersion(
                version="1.0.0",
                release_date=datetime.now(timezone.utc),
                changelog="Initial release with full validation support"
            ),
            author="Zishu Sensei Team",
            maintainer="validator@zishu.team",
            license="MIT",
            homepage="https://github.com/zishu-sensei/adapters",
            capabilities=[
                AdapterCapability(
                    name="text_processing",
                    category=CapabilityCategory.TEXT_PROCESSING,
                    description="Process text with various transformations",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "operation": {"type": "string", "enum": ["upper", "lower", "reverse"]}
                        },
                        "required": ["text"]
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "processed_text": {"type": "string"},
                            "operation_applied": {"type": "string"}
                        }
                    }
                )
            ],
            dependencies=[
                AdapterDependency(
                    name="typing",
                    type="package",
                    version="3.8+",
                    optional=False,
                    description="Python typing support"
                )
            ],
            configuration=[
                AdapterConfiguration(
                    name="default_operation",
                    type="string",
                    required=False,
                    default_value="upper",
                    description="Default text transformation operation",
                    validation_rules={
                        "enum": ["upper", "lower", "reverse"]
                    }
                ),
                AdapterConfiguration(
                    name="max_text_length",
                    type="int",
                    required=False,
                    default_value=1000,
                    description="Maximum allowed text length"
                )
            ],
            permissions=AdapterPermissions(
                security_level=SecurityLevel.PUBLIC,
                required_roles=set(),
                file_system_access=None,
                network_access=None
            ),
            tags={"example", "text", "processing", "demo"},
            keywords={"validation", "example", "good_practice"}
        )
    
    async def _initialize_impl(self) -> bool:
        """初始化适配器"""
        try:
            # 获取配置
            self.default_operation = self.config.get('default_operation', 'upper')
            self.max_text_length = self.config.get('max_text_length', 1000)
            
            # 验证配置
            valid_operations = ['upper', 'lower', 'reverse']
            if self.default_operation not in valid_operations:
                self.logger.error(f"Invalid default operation: {self.default_operation}")
                return False
            
            if self.max_text_length <= 0:
                self.logger.error(f"Invalid max text length: {self.max_text_length}")
                return False
            
            self.logger.info(f"Good adapter initialized with operation={self.default_operation}")
            return True
            
        except Exception as e:
            self.logger.error(f"Initialization failed: {e}")
            return False
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理输入数据"""
        # 输入验证
        if not isinstance(input_data, dict):
            raise AdapterExecutionError(
                "Input must be a dictionary with 'text' field",
                adapter_id=self.adapter_id
            )
        
        text = input_data.get('text')
        if not isinstance(text, str):
            raise AdapterExecutionError(
                "Input 'text' field must be a string",
                adapter_id=self.adapter_id
            )
        
        if len(text) > self.max_text_length:
            raise AdapterExecutionError(
                f"Text length {len(text)} exceeds maximum {self.max_text_length}",
                adapter_id=self.adapter_id
            )
        
        # 获取操作
        operation = input_data.get('operation', self.default_operation)
        
        # 执行处理
        if operation == 'upper':
            processed_text = text.upper()
        elif operation == 'lower':
            processed_text = text.lower()
        elif operation == 'reverse':
            processed_text = text[::-1]
        else:
            raise AdapterExecutionError(
                f"Unknown operation: {operation}",
                adapter_id=self.adapter_id
            )
        
        return {
            "processed_text": processed_text,
            "operation_applied": operation,
            "original_length": len(text),
            "processed_length": len(processed_text)
        }
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力"""
        return [
            AdapterCapability(
                name="text_transformation",
                category=CapabilityCategory.TEXT_PROCESSING,
                description="Transform text case or reverse it"
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """执行健康检查"""
        checks = {}
        issues = []
        recommendations = []
        
        # 检查配置有效性
        checks["valid_operation"] = self.default_operation in ['upper', 'lower', 'reverse']
        checks["valid_max_length"] = self.max_text_length > 0
        
        # 检查基本功能
        try:
            test_input = {"text": "test"}
            test_context = ExecutionContext()
            result = await self._process_impl(test_input, test_context)
            checks["basic_processing"] = True
        except Exception as e:
            checks["basic_processing"] = False
            issues.append(f"Basic processing test failed: {str(e)}")
        
        # 计算整体健康状态
        is_healthy = all(checks.values())
        
        return HealthCheckResult(
            is_healthy=is_healthy,
            status="healthy" if is_healthy else "unhealthy",
            checks=checks,
            metrics={
                "default_operation": self.default_operation,
                "max_text_length": self.max_text_length
            },
            issues=issues,
            recommendations=recommendations
        )
    
    async def _cleanup_impl(self) -> None:
        """清理适配器资源"""
        self.logger.info("Good adapter cleanup completed")

# ================================
# 示例适配器类 - 有问题的实现
# ================================

class BadExampleAdapter(BaseAdapter):
    """有问题的适配器实现示例"""
    
    def _load_metadata(self):  # 缺少返回类型注解
        """加载适配器元数据 - 有多个问题"""
        return AdapterMetadata(
            adapter_id="bad-example!@#",  # 无效的ID格式
            name="",  # 空名称
            adapter_type=AdapterType.SOFT,
            version=AdapterVersion(
                version="invalid.version.format.too.many.parts",  # 无效版本格式
                release_date=datetime.now(timezone.utc)
            ),
            capabilities=[],  # 没有能力定义
            dependencies=[
                AdapterDependency(
                    name="nonexistent_package",  # 不存在的包
                    type="package",
                    optional=False
                )
            ],
            permissions=AdapterPermissions(
                security_level=SecurityLevel.CLASSIFIED,  # 过高的安全级别
                required_roles=set()  # 但没有要求角色
            )
        )
    
    def _initialize_impl(self) -> bool:  # 缺少async
        """初始化适配器 - 不是异步方法"""
        # 缺少错误处理
        self.data = self.config['required_field']  # 可能抛出KeyError
        return True
    
    def _process_impl(self, data, ctx):  # 错误的参数名和缺少类型注解
        """处理输入数据 - 不是异步方法且缺少错误处理"""
        # 没有输入验证
        return data.upper()  # 假设输入是字符串，可能出错
    
    def _get_capabilities_impl(self):  # 缺少返回类型注解
        """获取适配器能力 - 返回错误类型"""
        return "no capabilities"  # 应该返回列表
    
    def _health_check_impl(self):  # 缺少async和返回类型注解
        """执行健康检查 - 不是异步方法"""
        return "healthy"  # 应该返回HealthCheckResult对象
    
    def _cleanup_impl(self):  # 缺少async
        """清理适配器资源 - 不是异步方法"""
        pass

# ================================
# 验证器使用示例
# ================================

async def demonstrate_basic_validation():
    """演示基本验证功能"""
    print("=" * 60)
    print("基本验证功能演示")
    print("=" * 60)
    
    # 创建默认验证器
    validator = create_validator()
    
    print("\n1. 验证良好的适配器:")
    print("-" * 30)
    
    good_config = {
        "adapter_id": "good_example_adapter",
        "default_operation": "upper",
        "max_text_length": 500
    }
    
    result = await validator.validate_adapter(GoodExampleAdapter, good_config)
    print(validator.get_validation_summary(result))
    
    if result.has_warnings():
        print("\n警告:")
        for warning in result.warnings:
            print(f"  • {warning.message}")
    
    print("\n" + "=" * 40)
    
    print("\n2. 验证有问题的适配器:")
    print("-" * 30)
    
    bad_config = {
        "adapter_id": "bad_example_adapter"
        # 故意缺少required_field
    }
    
    result = await validator.validate_adapter(BadExampleAdapter, bad_config)
    print(validator.get_validation_summary(result))
    
    if result.has_errors():
        print("\n错误:")
        for error in result.errors[:5]:  # 只显示前5个错误
            print(f"  • {error.message}")
            if error.suggestion:
                print(f"    建议: {error.suggestion}")

async def demonstrate_different_validators():
    """演示不同类型的验证器"""
    print("\n" + "=" * 60)
    print("不同验证器模式演示")
    print("=" * 60)
    
    # 开发模式验证器
    print("\n1. 开发模式验证器 (宽松):")
    print("-" * 30)
    dev_validator = create_development_validator()
    result = await dev_validator.validate_adapter(BadExampleAdapter, {"adapter_id": "bad"})
    print(f"结果: {'有效' if result.is_valid else '无效'}")
    print(f"问题数量: {len(result.issues)}")
    
    # 生产模式验证器
    print("\n2. 生产模式验证器 (严格):")
    print("-" * 30)
    prod_validator = create_production_validator()
    result = await prod_validator.validate_adapter(BadExampleAdapter, {"adapter_id": "bad"})
    print(f"结果: {'有效' if result.is_valid else '无效'}")
    print(f"问题数量: {len(result.issues)}")

async def demonstrate_custom_validation():
    """演示自定义验证规则"""
    print("\n" + "=" * 60)
    print("自定义验证规则演示")
    print("=" * 60)
    
    from base.validator import ValidationRule, ValidationIssue
    
    class CustomNamingRule(ValidationRule):
        """自定义命名规则：适配器名称必须包含'Adapter'"""
        
        def __init__(self):
            super().__init__("custom_naming", ValidationCategory.STRUCTURE, ValidationSeverity.WARNING)
        
        async def validate(self, adapter_class, metadata=None, config=None):
            issues = []
            
            if not adapter_class.__name__.endswith('Adapter'):
                issues.append(self.create_issue(
                    "invalid_class_name",
                    f"Adapter class name '{adapter_class.__name__}' should end with 'Adapter'",
                    suggestion="Rename the class to end with 'Adapter'"
                ))
            
            return issues
    
    # 创建带自定义规则的验证器
    config = ValidationConfig(
        mode=ValidatorMode.STRICT,
        enabled_categories={ValidationCategory.STRUCTURE, ValidationCategory.METADATA},
        custom_rules=[CustomNamingRule()]
    )
    
    custom_validator = AdapterValidator(config)
    
    # 测试自定义规则
    class TestProcessor(BaseAdapter):  # 不以Adapter结尾
        def _load_metadata(self):
            return AdapterMetadata(
                adapter_id="test_processor",
                name="Test Processor",
                adapter_type=AdapterType.SOFT,
                version=AdapterVersion(version="1.0.0", release_date=datetime.now(timezone.utc))
            )
        
        async def _initialize_impl(self): return True
        async def _process_impl(self, input_data, context): return input_data
        def _get_capabilities_impl(self): return []
        async def _health_check_impl(self): 
            return HealthCheckResult(is_healthy=True, status="healthy")
        async def _cleanup_impl(self): pass
    
    result = await custom_validator.validate_adapter(TestProcessor, {"adapter_id": "test"})
    print(f"自定义验证结果: {'有效' if result.is_valid else '无效'}")
    
    if result.issues:
        print("发现的问题:")
        for issue in result.issues:
            print(f"  • [{issue.severity.value}] {issue.message}")

async def demonstrate_performance_validation():
    """演示性能验证"""
    print("\n" + "=" * 60)
    print("性能验证演示")
    print("=" * 60)
    
    class SlowAdapter(BaseAdapter):
        """故意缓慢的适配器"""
        
        def _load_metadata(self):
            return AdapterMetadata(
                adapter_id="slow_adapter",
                name="Slow Adapter",
                adapter_type=AdapterType.SOFT,
                version=AdapterVersion(version="1.0.0", release_date=datetime.now(timezone.utc)),
                capabilities=[
                    AdapterCapability(
                        name="slow_processing",
                        category=CapabilityCategory.TEXT_PROCESSING
                    )
                ]
            )
        
        async def _initialize_impl(self):
            # 故意慢初始化
            await asyncio.sleep(2)
            return True
        
        async def _process_impl(self, input_data, context):
            # 故意慢处理
            await asyncio.sleep(5)
            return input_data
        
        def _get_capabilities_impl(self):
            return [AdapterCapability(name="slow", category=CapabilityCategory.TEXT_PROCESSING)]
        
        async def _health_check_impl(self):
            return HealthCheckResult(is_healthy=True, status="healthy")
        
        async def _cleanup_impl(self):
            pass
    
    # 创建性能验证器（较低阈值）
    perf_validator = create_validator(
        mode=ValidatorMode.STRICT,
        enabled_categories={ValidationCategory.PERFORMANCE},
        performance_thresholds={
            "max_initialization_time": 1.0,  # 1秒
            "max_processing_time": 3.0       # 3秒
        }
    )
    
    print("测试慢适配器的性能...")
    result = await perf_validator.validate_adapter(SlowAdapter, {"adapter_id": "slow"})
    
    print(f"性能验证结果: {'通过' if result.is_valid else '失败'}")
    if result.issues:
        for issue in result.issues:
            print(f"  • {issue.message}")

async def demonstrate_security_validation():
    """演示安全验证"""
    print("\n" + "=" * 60)
    print("安全验证演示")
    print("=" * 60)
    
    class InsecureAdapter(BaseAdapter):
        """不安全的适配器示例"""
        
        def _load_metadata(self):
            return AdapterMetadata(
                adapter_id="insecure_adapter",
                name="Insecure Adapter",
                adapter_type=AdapterType.HARD,  # 硬适配器通常需要更高安全级别
                version=AdapterVersion(version="1.0.0", release_date=datetime.now(timezone.utc)),
                permissions=AdapterPermissions(
                    security_level=SecurityLevel.PUBLIC,  # 公开级别但是硬适配器
                    file_system_access=["/tmp", "/var"],
                    system_commands=["rm", "chmod"]
                ),
                capabilities=[
                    AdapterCapability(
                        name="file_operations",
                        category=CapabilityCategory.FILE_OPERATIONS
                    )
                ]
            )
        
        async def _initialize_impl(self):
            return True
        
        async def _process_impl(self, input_data, context):
            # 这里可能包含危险操作
            import os
            # os.system(input_data)  # 危险！
            return {"result": "processed"}
        
        def _get_capabilities_impl(self):
            return [AdapterCapability(name="file_ops", category=CapabilityCategory.FILE_OPERATIONS)]
        
        async def _health_check_impl(self):
            return HealthCheckResult(is_healthy=True, status="healthy")
        
        async def _cleanup_impl(self):
            pass
    
    # 创建安全验证器
    security_validator = create_validator(
        mode=ValidatorMode.STRICT,
        enabled_categories={ValidationCategory.SECURITY},
        security_level_threshold=SecurityLevel.INTERNAL
    )
    
    insecure_config = {
        "adapter_id": "insecure_adapter",
        "password": "123",  # 弱密码
        "api_key": "short"  # 短密钥
    }
    
    result = await security_validator.validate_adapter(InsecureAdapter, insecure_config)
    
    print(f"安全验证结果: {'通过' if result.is_valid else '失败'}")
    if result.issues:
        print("安全问题:")
        for issue in result.issues:
            print(f"  • [{issue.severity.value}] {issue.message}")

async def demonstrate_detailed_reporting():
    """演示详细报告功能"""
    print("\n" + "=" * 60)
    print("详细报告演示")
    print("=" * 60)
    
    validator = create_validator()
    result = await validator.validate_adapter(BadExampleAdapter, {"adapter_id": "bad"})
    
    # 生成详细报告
    detailed_report = validator.get_detailed_report(result)
    print(detailed_report)

async def demonstrate_quick_validation():
    """演示快速验证功能"""
    print("\n" + "=" * 60)
    print("快速验证功能演示")
    print("=" * 60)
    
    print("快速验证良好适配器:")
    is_valid = await quick_validate(
        GoodExampleAdapter,
        {"adapter_id": "good_example", "default_operation": "upper"},
        print_report=False
    )
    print(f"验证结果: {'通过' if is_valid else '失败'}")
    
    print("\n快速验证有问题的适配器:")
    is_valid = await quick_validate(
        BadExampleAdapter,
        {"adapter_id": "bad_example"},
        print_report=False
    )
    print(f"验证结果: {'通过' if is_valid else '失败'}")

async def main():
    """主函数 - 运行所有示例"""
    print("适配器验证器使用示例")
    print("=" * 60)
    print("这个示例将演示适配器验证器的各种功能")
    
    try:
        # 基本验证
        await demonstrate_basic_validation()
        
        # 不同验证器模式
        await demonstrate_different_validators()
        
        # 自定义验证规则
        await demonstrate_custom_validation()
        
        # 性能验证
        await demonstrate_performance_validation()
        
        # 安全验证
        await demonstrate_security_validation()
        
        # 详细报告
        await demonstrate_detailed_reporting()
        
        # 快速验证
        await demonstrate_quick_validation()
        
        print("\n" + "=" * 60)
        print("所有示例演示完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"示例运行出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

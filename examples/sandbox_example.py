#!/usr/bin/env python3
"""
沙箱执行环境使用示例
演示如何在Zishu-sensei框架中使用安全的代码执行环境
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from zishu.adapters.security.sandbox import (
    # 核心类
    SandboxManager, SandboxConfig, ResourceLimits,
    ExecutionContext, ExecutionResult,
    
    # 枚举类
    SandboxMode, ExecutionType, ResourceType,
    
    # 异常类
    SecurityViolation, ResourceExceededException,
    
    # 便捷函数
    execute_python_code, get_sandbox_manager
)

from zishu.adapters.core.security import get_audit_logger
from zishu.adapters.core.security import EnhancedPermissionManager, AccessRequest


class SandboxDemo:
    """沙箱演示类"""
    
    def __init__(self):
        self.manager = get_sandbox_manager()
    
    async def demo_basic_execution(self):
        """基础代码执行演示"""
        print("=== 基础Python代码执行演示 ===")
        
        # 安全的代码
        safe_code = """
# 计算斐波那契数列
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

result = fibonacci(10)
print(f"Fibonacci(10) = {result}")

# 基本数据处理
import json
import math

data = [1, 2, 3, 4, 5]
squared = [x**2 for x in data]
print(f"Squared: {squared}")

# JSON处理
json_data = {"message": "Hello, Sandbox!", "numbers": squared}
json_str = json.dumps(json_data, indent=2)
print("JSON output:")
print(json_str)
"""
        
        try:
            result = await execute_python_code(safe_code, user_id="demo_user")
            
            print(f"执行状态: {'成功' if result.success else '失败'}")
            print(f"执行时间: {result.execution_time:.3f}秒")
            print(f"输出:")
            print(result.stdout)
            
            if result.error:
                print(f"错误: {result.error}")
            
        except Exception as e:
            print(f"演示执行失败: {e}")
    
    async def demo_security_restrictions(self):
        """安全限制演示"""
        print("\n=== 安全限制演示 ===")
        
        # 危险代码示例
        dangerous_codes = [
            ("导入禁用模块", "import os; os.system('ls')"),
            ("使用eval函数", "eval('print(\"dangerous\")')"),
            ("访问私有属性", "print([].__class__.__bases__)"),
            ("文件系统访问", "open('/etc/passwd', 'r').read()"),
        ]
        
        config = SandboxConfig(
            mode=SandboxMode.STRICT,
            enable_static_analysis=True,
            enable_audit_logging=True
        )
        
        for description, code in dangerous_codes:
            print(f"\n测试: {description}")
            try:
                result = await execute_python_code(code, config=config)
                
                if result.success:
                    print("⚠️  代码执行成功（可能存在安全风险）")
                    print(f"输出: {result.stdout}")
                else:
                    print("✅ 安全限制生效")
                    print(f"错误: {result.error}")
                    if result.security_violations:
                        print("安全违规:")
                        for violation in result.security_violations:
                            print(f"  - {violation['type']}: {violation['message']}")
            
            except Exception as e:
                print(f"✅ 安全限制生效: {e}")
    
    async def demo_resource_limits(self):
        """资源限制演示"""
        print("\n=== 资源限制演示 ===")
        
        # 配置严格的资源限制
        limits = ResourceLimits(
            max_execution_time=2.0,    # 2秒
            max_memory=50 * 1024 * 1024,  # 50MB
            max_cpu_time=1.0,          # 1秒CPU时间
        )
        
        config = SandboxConfig(
            mode=SandboxMode.RESTRICTED,
            resource_limits=limits,
            enable_runtime_monitoring=True
        )
        
        # 测试超时
        timeout_code = """
import time
print("开始长时间计算...")
time.sleep(5)  # 5秒，超过2秒限制
print("计算完成")
"""
        
        print("测试执行超时限制:")
        try:
            result = await execute_python_code(timeout_code, config=config)
            if not result.success:
                print("✅ 超时限制生效")
                print(f"错误: {result.error}")
            else:
                print("⚠️  超时限制未生效")
        except Exception as e:
            print(f"✅ 超时限制生效: {e}")
        
        # 测试内存限制
        memory_code = """
print("分配大量内存...")
# 尝试分配100MB内存
big_list = [i for i in range(10**7)]
print(f"分配完成，列表长度: {len(big_list)}")
"""
        
        print("\n测试内存限制:")
        try:
            result = await execute_python_code(memory_code, config=config)
            print(f"执行状态: {'成功' if result.success else '失败'}")
            
            if result.resource_usage:
                for resource_type, usage in result.resource_usage.items():
                    print(f"资源使用 - {resource_type.value}: {usage}")
            
            if result.error:
                print(f"错误: {result.error}")
        
        except Exception as e:
            print(f"资源限制生效: {e}")
    
    async def demo_different_modes(self):
        """不同执行模式演示"""
        print("\n=== 不同执行模式演示 ===")
        
        test_code = """
import json
print("测试不同沙箱模式")

# 尝试一些边界操作
try:
    import hashlib
    hash_obj = hashlib.sha256()
    hash_obj.update(b"test")
    print(f"哈希计算成功: {hash_obj.hexdigest()}")
except ImportError as e:
    print(f"哈希模块不可用: {e}")

# 内存使用测试
data = list(range(1000))
print(f"创建了 {len(data)} 个元素的列表")

result = sum(data)
print(f"计算结果: {result}")
"""
        
        modes = [
            (SandboxMode.STRICT, "严格模式"),
            (SandboxMode.RESTRICTED, "受限模式"),
            (SandboxMode.PERMISSIVE, "宽松模式"),
            (SandboxMode.DEVELOPMENT, "开发模式")
        ]
        
        for mode, description in modes:
            print(f"\n--- {description} ---")
            
            config = SandboxConfig(
                mode=mode,
                enable_static_analysis=(mode == SandboxMode.STRICT),
                resource_limits=ResourceLimits(
                    max_execution_time=5.0,
                    max_memory=100 * 1024 * 1024
                )
            )
            
            try:
                result = await execute_python_code(test_code, config=config)
                
                print(f"执行状态: {'成功' if result.success else '失败'}")
                print(f"执行时间: {result.execution_time:.3f}秒")
                
                if result.stdout:
                    print("输出:")
                    for line in result.stdout.strip().split('\n'):
                        print(f"  {line}")
                
                if result.error:
                    print(f"错误: {result.error}")
                
                if result.security_violations:
                    print(f"安全违规: {len(result.security_violations)}个")
            
            except Exception as e:
                print(f"执行异常: {e}")
    
    async def demo_context_management(self):
        """执行上下文管理演示"""
        print("\n=== 执行上下文管理演示 ===")
        
        # 创建有权限的执行上下文
        context = ExecutionContext(
            user_id="demo_user",
            session_id="demo_session_001",
            permissions={Permission.EXECUTE, Permission.READ},
            roles={Role.DEVELOPER},
            environment_variables={
                "USER_NAME": "演示用户",
                "ENVIRONMENT": "sandbox"
            },
            metadata={
                "source": "demo",
                "purpose": "context_management_test"
            }
        )
        
        code = """
import os
print(f"用户: {os.environ.get('USER_NAME', 'Unknown')}")
print(f"环境: {os.environ.get('ENVIRONMENT', 'Unknown')}")

# 执行一些计算
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
average = total / len(numbers)

print(f"数据: {numbers}")
print(f"总和: {total}")
print(f"平均值: {average}")
"""
        
        config = SandboxConfig(
            mode=SandboxMode.DEVELOPMENT,  # 开发模式允许os模块
            enable_audit_logging=True
        )
        
        try:
            result = await self.manager.execute(code, context, config)
            
            print(f"执行ID: {result.execution_id}")
            print(f"执行状态: {'成功' if result.success else '失败'}")
            print(f"执行时间: {result.execution_time:.3f}秒")
            
            if result.stdout:
                print("输出:")
                for line in result.stdout.strip().split('\n'):
                    print(f"  {line}")
            
            # 显示活跃执行
            active_executions = self.manager.get_active_executions()
            print(f"当前活跃执行数: {len(active_executions)}")
            
        except Exception as e:
            print(f"执行失败: {e}")
    
    async def demo_advanced_features(self):
        """高级功能演示"""
        print("\n=== 高级功能演示 ===")
        
        # 代码动态生成和执行
        print("--- 动态代码生成 ---")
        
        template_code = """
# 动态生成的数学计算
def calculate_{operation}(a, b):
    return a {operator} b

# 测试函数
result = calculate_{operation}(10, 3)
print(f"计算结果: 10 {operator} 3 = {{result}}")
"""
        
        operations = [
            ("add", "+"),
            ("subtract", "-"),
            ("multiply", "*"),
        ]
        
        for op_name, op_symbol in operations:
            dynamic_code = template_code.format(
                operation=op_name,
                operator=op_symbol
            )
            
            print(f"\n执行动态生成的代码 ({op_name}):")
            try:
                result = await execute_python_code(dynamic_code)
                if result.success and result.stdout:
                    print(f"  {result.stdout.strip()}")
                else:
                    print(f"  执行失败: {result.error}")
            
            except Exception as e:
                print(f"  异常: {e}")
        
        # 数据处理示例
        print("\n--- 数据处理示例 ---")
        data_processing_code = """
import json
import hashlib
from datetime import datetime

# 模拟数据处理任务
data = {
    "timestamp": datetime.now().isoformat(),
    "items": [
        {"name": "item1", "value": 100},
        {"name": "item2", "value": 200},
        {"name": "item3", "value": 150}
    ]
}

# 计算总值
total_value = sum(item["value"] for item in data["items"])
data["total"] = total_value

# 生成数据哈希
json_str = json.dumps(data, sort_keys=True)
data_hash = hashlib.md5(json_str.encode()).hexdigest()
data["hash"] = data_hash

print("数据处理完成:")
print(json.dumps(data, indent=2))
"""
        
        try:
            result = await execute_python_code(data_processing_code)
            
            if result.success:
                print("数据处理结果:")
                for line in result.stdout.strip().split('\n'):
                    print(f"  {line}")
            else:
                print(f"数据处理失败: {result.error}")
        
        except Exception as e:
            print(f"数据处理异常: {e}")


async def main():
    """主函数"""
    print("Zishu-sensei 沙箱执行环境演示")
    print("=" * 50)
    
    # 初始化审计系统
    audit_logger = await initialize_audit_system()
    
    try:
        demo = SandboxDemo()
        
        # 运行各种演示
        await demo.demo_basic_execution()
        await demo.demo_security_restrictions()
        await demo.demo_resource_limits()
        await demo.demo_different_modes()
        await demo.demo_context_management()
        await demo.demo_advanced_features()
        
        print("\n" + "=" * 50)
        print("所有演示完成！")
        print("\n沙箱特性总结:")
        print("✅ 静态代码安全分析")
        print("✅ 动态资源监控和限制")
        print("✅ 多级安全模式")
        print("✅ 权限控制集成")
        print("✅ 审计日志记录")
        print("✅ 进程隔离执行")
        print("✅ 容器化支持 (可选)")
        print("\n这个沙箱环境为Zishu-sensei适配器框架提供了")
        print("安全、可控、可观测的代码执行能力！")
        
    except Exception as e:
        print(f"演示执行出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # 关闭审计系统
        await shutdown_audit_system()


if __name__ == "__main__":
    # 运行演示
    asyncio.run(main())

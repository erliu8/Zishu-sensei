# -*- coding: utf-8 -*-
"""
沙箱安全测试

测试新架构的沙箱安全功能
"""

import pytest
import asyncio
import tempfile
import os
import sys
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any, List

from zishu.security.core.sandbox import (
    SandboxManager, SandboxConfig, SandboxEnvironment,
    ResourceLimits, SecurityConstraints, ExecutionContext
)
from zishu.security.core.types import SecurityLevel, ThreatLevel
from zishu.security.core.exceptions import (
    SandboxViolation, ResourceLimitExceeded, SecurityConstraintViolation
)

from tests.utils.security_test_utils import SecurityTestUtils


class TestSandboxManager:
    """沙箱管理器测试类"""

    @pytest.fixture
    def sandbox_config(self):
        """创建沙箱配置"""
        return SandboxConfig(
            enable_isolation=True,
            enable_resource_limits=True,
            enable_network_isolation=True,
            enable_filesystem_isolation=True,
            default_timeout=30.0,
            max_memory_mb=512,
            max_cpu_percent=50.0,
            max_disk_mb=100,
            allowed_modules=['json', 'datetime', 'math'],
            blocked_modules=['os', 'sys', 'subprocess'],
            allowed_syscalls=['read', 'write', 'open'],
            blocked_syscalls=['exec', 'fork', 'socket']
        )

    @pytest.fixture
    async def sandbox_manager(self, sandbox_config):
        """创建沙箱管理器实例"""
        manager = SandboxManager(config=sandbox_config)
        await manager.initialize()
        yield manager
        await manager.cleanup()

    @pytest.fixture
    def resource_limits(self):
        """创建资源限制"""
        return ResourceLimits(
            max_memory_bytes=512 * 1024 * 1024,  # 512MB
            max_cpu_time_seconds=10.0,
            max_wall_time_seconds=30.0,
            max_file_descriptors=100,
            max_processes=5,
            max_threads=10,
            max_disk_bytes=100 * 1024 * 1024  # 100MB
        )

    @pytest.fixture
    def security_constraints(self):
        """创建安全约束"""
        return SecurityConstraints(
            security_level=SecurityLevel.RESTRICTED,
            allow_network_access=False,
            allow_file_system_access=False,
            allow_subprocess_creation=False,
            allow_dynamic_imports=False,
            allowed_modules=['json', 'datetime', 'math'],
            blocked_modules=['os', 'sys', 'subprocess', 'socket'],
            allowed_functions=['print', 'len', 'str', 'int'],
            blocked_functions=['eval', 'exec', 'compile', '__import__']
        )

    async def test_sandbox_manager_initialization(self, sandbox_config):
        """测试沙箱管理器初始化"""
        manager = SandboxManager(config=sandbox_config)
        
        # 验证初始状态
        assert manager.config == sandbox_config
        assert not manager.is_initialized
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        
        # 清理管理器
        await manager.cleanup()

    async def test_create_sandbox_environment(self, sandbox_manager, resource_limits, security_constraints):
        """测试创建沙箱环境"""
        # 创建沙箱环境
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='test_sandbox_001',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        assert isinstance(sandbox_env, SandboxEnvironment)
        assert sandbox_env.sandbox_id == 'test_sandbox_001'
        assert sandbox_env.is_active is True
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('test_sandbox_001')

    async def test_execute_safe_code(self, sandbox_manager, resource_limits, security_constraints):
        """测试执行安全代码"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='safe_code_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 安全的代码
        safe_code = """
import json
import math

def calculate_area(radius):
    return math.pi * radius ** 2

result = calculate_area(5)
output = {"area": result, "radius": 5}
"""
        
        # 执行代码
        execution_result = await sandbox_manager.execute_code(
            sandbox_id='safe_code_test',
            code=safe_code,
            timeout=10.0
        )
        
        assert execution_result.success is True
        assert execution_result.error is None
        assert 'output' in execution_result.globals
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('safe_code_test')

    async def test_block_dangerous_code(self, sandbox_manager, resource_limits, security_constraints):
        """测试阻止危险代码"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='dangerous_code_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 危险的代码 - 尝试导入被禁止的模块
        dangerous_code = """
import os
import sys
import subprocess

# 尝试执行系统命令
result = os.system('ls -la')
"""
        
        # 执行代码应该失败
        with pytest.raises(SecurityConstraintViolation):
            await sandbox_manager.execute_code(
                sandbox_id='dangerous_code_test',
                code=dangerous_code,
                timeout=10.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('dangerous_code_test')

    async def test_resource_limit_enforcement(self, sandbox_manager, security_constraints):
        """测试资源限制执行"""
        # 创建严格的资源限制
        strict_limits = ResourceLimits(
            max_memory_bytes=10 * 1024 * 1024,  # 10MB
            max_cpu_time_seconds=1.0,
            max_wall_time_seconds=2.0,
            max_file_descriptors=10,
            max_processes=1,
            max_threads=1,
            max_disk_bytes=1 * 1024 * 1024  # 1MB
        )
        
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='resource_limit_test',
            resource_limits=strict_limits,
            security_constraints=security_constraints
        )
        
        # 消耗大量内存的代码
        memory_intensive_code = """
# 尝试分配大量内存
big_list = []
for i in range(1000000):
    big_list.append([0] * 1000)
"""
        
        # 执行应该因资源限制而失败
        with pytest.raises(ResourceLimitExceeded):
            await sandbox_manager.execute_code(
                sandbox_id='resource_limit_test',
                code=memory_intensive_code,
                timeout=5.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('resource_limit_test')

    async def test_timeout_enforcement(self, sandbox_manager, resource_limits, security_constraints):
        """测试超时执行"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='timeout_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 长时间运行的代码
        long_running_code = """
import time
time.sleep(60)  # 睡眠60秒
"""
        
        # 执行应该因超时而失败
        execution_result = await sandbox_manager.execute_code(
            sandbox_id='timeout_test',
            code=long_running_code,
            timeout=2.0  # 2秒超时
        )
        
        assert execution_result.success is False
        assert 'timeout' in execution_result.error.lower()
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('timeout_test')

    async def test_filesystem_isolation(self, sandbox_manager, resource_limits):
        """测试文件系统隔离"""
        # 创建允许文件系统访问的约束
        fs_constraints = SecurityConstraints(
            security_level=SecurityLevel.INTERNAL,
            allow_network_access=False,
            allow_file_system_access=True,
            allow_subprocess_creation=False,
            allow_dynamic_imports=False,
            allowed_modules=['json', 'os', 'tempfile'],
            blocked_modules=['subprocess', 'socket'],
            allowed_functions=['open', 'read', 'write'],
            blocked_functions=['eval', 'exec']
        )
        
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='filesystem_test',
            resource_limits=resource_limits,
            security_constraints=fs_constraints
        )
        
        # 文件操作代码
        file_code = """
import tempfile
import os

# 在沙箱目录中创建临时文件
with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
    f.write('Hello from sandbox!')
    temp_file = f.name

# 读取文件
with open(temp_file, 'r') as f:
    content = f.read()

# 清理
os.unlink(temp_file)

result = content
"""
        
        # 执行代码
        execution_result = await sandbox_manager.execute_code(
            sandbox_id='filesystem_test',
            code=file_code,
            timeout=10.0
        )
        
        assert execution_result.success is True
        assert 'result' in execution_result.globals
        assert execution_result.globals['result'] == 'Hello from sandbox!'
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('filesystem_test')

    async def test_network_isolation(self, sandbox_manager, resource_limits, security_constraints):
        """测试网络隔离"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='network_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 尝试网络访问的代码
        network_code = """
import socket

# 尝试创建socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('google.com', 80))
"""
        
        # 执行应该因网络隔离而失败
        with pytest.raises(SecurityConstraintViolation):
            await sandbox_manager.execute_code(
                sandbox_id='network_test',
                code=network_code,
                timeout=10.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('network_test')

    async def test_dynamic_import_blocking(self, sandbox_manager, resource_limits, security_constraints):
        """测试动态导入阻止"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='import_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 尝试动态导入的代码
        dynamic_import_code = """
# 尝试动态导入
module_name = 'os'
imported_module = __import__(module_name)
"""
        
        # 执行应该因动态导入阻止而失败
        with pytest.raises(SecurityConstraintViolation):
            await sandbox_manager.execute_code(
                sandbox_id='import_test',
                code=dynamic_import_code,
                timeout=10.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('import_test')

    async def test_function_filtering(self, sandbox_manager, resource_limits, security_constraints):
        """测试函数过滤"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='function_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 尝试使用被禁止函数的代码
        eval_code = """
# 尝试使用eval
result = eval('1 + 1')
"""
        
        # 执行应该因函数过滤而失败
        with pytest.raises(SecurityConstraintViolation):
            await sandbox_manager.execute_code(
                sandbox_id='function_test',
                code=eval_code,
                timeout=10.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('function_test')

    async def test_sandbox_monitoring(self, sandbox_manager, resource_limits, security_constraints):
        """测试沙箱监控"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='monitoring_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 执行一些代码
        test_code = """
import json
import math

for i in range(1000):
    result = math.sqrt(i)

output = {"iterations": 1000, "last_result": result}
"""
        
        # 执行代码
        execution_result = await sandbox_manager.execute_code(
            sandbox_id='monitoring_test',
            code=test_code,
            timeout=10.0
        )
        
        # 获取监控数据
        monitoring_data = await sandbox_manager.get_sandbox_metrics('monitoring_test')
        
        assert monitoring_data is not None
        assert 'cpu_usage' in monitoring_data
        assert 'memory_usage' in monitoring_data
        assert 'execution_time' in monitoring_data
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('monitoring_test')

    async def test_concurrent_sandboxes(self, sandbox_manager, resource_limits, security_constraints):
        """测试并发沙箱"""
        # 创建多个沙箱
        sandbox_ids = []
        for i in range(3):
            sandbox_id = f'concurrent_test_{i}'
            sandbox_ids.append(sandbox_id)
            
            await sandbox_manager.create_sandbox(
                sandbox_id=sandbox_id,
                resource_limits=resource_limits,
                security_constraints=security_constraints
            )
        
        # 并发执行代码
        test_code = """
import json
import math

result = math.pi * 10
output = {"result": result, "sandbox_id": "SANDBOX_ID"}
"""
        
        execution_tasks = []
        for i, sandbox_id in enumerate(sandbox_ids):
            code = test_code.replace("SANDBOX_ID", sandbox_id)
            task = sandbox_manager.execute_code(
                sandbox_id=sandbox_id,
                code=code,
                timeout=10.0
            )
            execution_tasks.append(task)
        
        # 等待所有执行完成
        results = await asyncio.gather(*execution_tasks)
        
        # 验证结果
        assert len(results) == 3
        for i, result in enumerate(results):
            assert result.success is True
            assert 'output' in result.globals
        
        # 清理所有沙箱
        for sandbox_id in sandbox_ids:
            await sandbox_manager.destroy_sandbox(sandbox_id)

    async def test_sandbox_persistence(self, sandbox_manager, resource_limits, security_constraints):
        """测试沙箱持久化"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='persistence_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 第一次执行 - 设置变量
        setup_code = """
persistent_data = {"counter": 0, "values": []}
"""
        
        result1 = await sandbox_manager.execute_code(
            sandbox_id='persistence_test',
            code=setup_code,
            timeout=10.0
        )
        
        # 第二次执行 - 使用之前的变量
        update_code = """
persistent_data["counter"] += 1
persistent_data["values"].append(persistent_data["counter"])
result = persistent_data
"""
        
        result2 = await sandbox_manager.execute_code(
            sandbox_id='persistence_test',
            code=update_code,
            timeout=10.0
        )
        
        assert result2.success is True
        assert 'result' in result2.globals
        assert result2.globals['result']['counter'] == 1
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('persistence_test')

    async def test_sandbox_cleanup(self, sandbox_manager, resource_limits, security_constraints):
        """测试沙箱清理"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='cleanup_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 验证沙箱存在
        assert await sandbox_manager.sandbox_exists('cleanup_test') is True
        
        # 销毁沙箱
        result = await sandbox_manager.destroy_sandbox('cleanup_test')
        assert result is True
        
        # 验证沙箱已被清理
        assert await sandbox_manager.sandbox_exists('cleanup_test') is False

    async def test_sandbox_recovery(self, sandbox_manager, resource_limits, security_constraints):
        """测试沙箱恢复"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='recovery_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 模拟沙箱崩溃
        await sandbox_manager._simulate_sandbox_crash('recovery_test')
        
        # 尝试恢复沙箱
        recovery_result = await sandbox_manager.recover_sandbox('recovery_test')
        
        # 验证恢复结果（具体行为取决于实现）
        assert isinstance(recovery_result, bool)
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('recovery_test')

    async def test_security_violation_detection(self, sandbox_manager, resource_limits, security_constraints):
        """测试安全违规检测"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='violation_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 多种违规行为的代码
        violation_codes = [
            "import os; os.system('ls')",  # 系统调用
            "exec('print(\"hello\")')",     # 动态执行
            "__import__('subprocess')",     # 动态导入
            "open('/etc/passwd', 'r')"      # 文件访问
        ]
        
        violation_count = 0
        for code in violation_codes:
            try:
                await sandbox_manager.execute_code(
                    sandbox_id='violation_test',
                    code=code,
                    timeout=5.0
                )
            except SecurityConstraintViolation:
                violation_count += 1
        
        # 应该检测到所有违规
        assert violation_count == len(violation_codes)
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('violation_test')

    async def test_sandbox_metrics_collection(self, sandbox_manager, resource_limits, security_constraints):
        """测试沙箱指标收集"""
        # 创建沙箱
        sandbox_env = await sandbox_manager.create_sandbox(
            sandbox_id='metrics_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        # 执行一些计算密集的代码
        compute_code = """
import math

results = []
for i in range(10000):
    result = math.sqrt(i) * math.sin(i)
    results.append(result)

final_result = sum(results)
"""
        
        # 执行代码
        await sandbox_manager.execute_code(
            sandbox_id='metrics_test',
            code=compute_code,
            timeout=15.0
        )
        
        # 获取详细指标
        metrics = await sandbox_manager.get_detailed_metrics('metrics_test')
        
        assert metrics is not None
        assert 'cpu_time' in metrics
        assert 'memory_peak' in metrics
        assert 'instructions_executed' in metrics
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('metrics_test')

    async def test_error_handling(self, sandbox_manager, resource_limits, security_constraints):
        """测试错误处理"""
        # 测试创建重复沙箱
        await sandbox_manager.create_sandbox(
            sandbox_id='duplicate_test',
            resource_limits=resource_limits,
            security_constraints=security_constraints
        )
        
        with pytest.raises(ValueError):
            await sandbox_manager.create_sandbox(
                sandbox_id='duplicate_test',
                resource_limits=resource_limits,
                security_constraints=security_constraints
            )
        
        # 测试在不存在的沙箱中执行代码
        with pytest.raises(ValueError):
            await sandbox_manager.execute_code(
                sandbox_id='nonexistent_sandbox',
                code='print("hello")',
                timeout=5.0
            )
        
        # 清理沙箱
        await sandbox_manager.destroy_sandbox('duplicate_test')

    async def test_sandbox_configuration_validation(self, sandbox_manager):
        """测试沙箱配置验证"""
        # 无效的资源限制
        invalid_limits = ResourceLimits(
            max_memory_bytes=-1,  # 负值
            max_cpu_time_seconds=0,  # 零值
            max_wall_time_seconds=-5,  # 负值
            max_file_descriptors=0,
            max_processes=-1,
            max_threads=0,
            max_disk_bytes=-100
        )
        
        # 无效的安全约束
        invalid_constraints = SecurityConstraints(
            security_level=None,  # 空值
            allow_network_access=None,
            allow_file_system_access=None,
            allow_subprocess_creation=None,
            allow_dynamic_imports=None,
            allowed_modules=[],
            blocked_modules=[],
            allowed_functions=[],
            blocked_functions=[]
        )
        
        # 创建沙箱应该失败
        with pytest.raises(ValueError):
            await sandbox_manager.create_sandbox(
                sandbox_id='invalid_config_test',
                resource_limits=invalid_limits,
                security_constraints=invalid_constraints
            )

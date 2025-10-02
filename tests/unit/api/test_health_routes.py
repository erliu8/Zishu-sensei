# -*- coding: utf-8 -*-
"""
健康检查API路由单元测试
测试所有健康检查端点的功能和边界条件
"""
import pytest
import asyncio
import json
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from zishu.api.routes.health import (
    HealthStatus, CheckResult, DeepHealthResponse,
    HealthChecker, DatabaseChecker, RedisChecker, ModelChecker,
    AdapterChecker, SystemChecker, get_uptime, get_health_status
)


@pytest.mark.unit
@pytest.mark.api
class TestHealthStatus:
    """健康状态枚举测试"""
    
    def test_health_status_values(self):
        """测试健康状态枚举值"""
        assert HealthStatus.HEALTHY == "healthy"
        assert HealthStatus.UNHEALTHY == "unhealthy"
        assert HealthStatus.DEGRADED == "degraded"
    
    def test_health_status_comparison(self):
        """测试健康状态比较"""
        assert HealthStatus.HEALTHY != HealthStatus.UNHEALTHY
        assert HealthStatus.DEGRADED != HealthStatus.HEALTHY


@pytest.mark.unit
@pytest.mark.api
class TestCheckResult:
    """检查结果模型测试"""
    
    def test_check_result_creation(self):
        """测试检查结果创建"""
        timestamp = datetime.now(timezone.utc)
        result = CheckResult(
            name="TestCheck",
            status=HealthStatus.HEALTHY,
            message="Check passed",
            duration_ms=100.5,
            timestamp=timestamp
        )
        
        assert result.name == "TestCheck"
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "Check passed"
        assert result.duration_ms == 100.5
        assert result.timestamp == timestamp
        assert result.details is None
    
    def test_check_result_with_details(self):
        """测试包含详细信息的检查结果"""
        details = {"cpu_usage": 45.2, "memory_usage": 60.8}
        result = CheckResult(
            name="SystemCheck",
            status=HealthStatus.DEGRADED,
            message="High memory usage",
            details=details,
            duration_ms=250.0,
            timestamp=datetime.now(timezone.utc)
        )
        
        assert result.details == details
        assert result.status == HealthStatus.DEGRADED


@pytest.mark.unit
@pytest.mark.api
class TestDeepHealthResponse:
    """深度健康检查响应测试"""
    
    def test_deep_health_response_creation(self):
        """测试深度健康响应创建"""
        checks = [
            CheckResult(
                name="SystemCheck",
                status=HealthStatus.HEALTHY,
                message="OK",
                duration_ms=150.0,
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        summary = {
            "total_checks": 1,
            "healthy_count": 1,
            "unhealthy_count": 0
        }
        
        response = DeepHealthResponse(
            status=HealthStatus.HEALTHY,
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=3600.0,
            checks=checks,
            summary=summary
        )
        
        assert response.status == HealthStatus.HEALTHY
        assert response.uptime_seconds == 3600.0
        assert len(response.checks) == 1
        assert response.summary == summary


@pytest.mark.unit
@pytest.mark.api
class TestHealthChecker:
    """健康检查器基类测试"""
    
    class TestableChecker(HealthChecker):
        """可测试的检查器实现"""
        def __init__(self, timeout: float = 5.0, should_fail: bool = False, 
                     should_timeout: bool = False):
            super().__init__(timeout)
            self.should_fail = should_fail
            self.should_timeout = should_timeout
        
        async def _do_check(self) -> Dict[str, Any]:
            if self.should_timeout:
                await asyncio.sleep(self.timeout + 1)  # 超时
            if self.should_fail:
                raise Exception("Simulated failure")
            
            return {
                "message": "Check passed",
                "details": {"test": "value"}
            }
    
    @pytest.mark.asyncio
    async def test_successful_check(self):
        """测试成功的健康检查"""
        checker = self.TestableChecker()
        result = await checker.check()
        
        assert result.name == "Testable"
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "Check passed"
        assert result.details == {"test": "value"}
        assert result.duration_ms > 0
    
    @pytest.mark.asyncio
    async def test_failed_check(self):
        """测试失败的健康检查"""
        checker = self.TestableChecker(should_fail=True)
        result = await checker.check()
        
        assert result.name == "Testable"
        assert result.status == HealthStatus.UNHEALTHY
        assert "Check failed: Simulated failure" in result.message
        assert result.duration_ms > 0
    
    @pytest.mark.asyncio
    async def test_timeout_check(self):
        """测试超时的健康检查"""
        checker = self.TestableChecker(timeout=0.1, should_timeout=True)
        result = await checker.check()
        
        assert result.name == "Testable"
        assert result.status == HealthStatus.UNHEALTHY
        assert "Check timed out after 0.1s" in result.message
        assert result.duration_ms > 100  # 至少100ms


@pytest.mark.unit
@pytest.mark.api
class TestModelChecker:
    """模型健康检查器测试"""
    
    @patch('torch.cuda.is_available')
    @patch('torch.cuda.device_count')
    @pytest.mark.asyncio
    async def test_model_check_with_gpu(self, mock_device_count, mock_cuda_available):
        """测试有GPU的模型检查"""
        mock_cuda_available.return_value = True
        mock_device_count.return_value = 1
        
        with patch('torch.cuda.memory_allocated', return_value=1024*1024*1024), \
             patch('torch.cuda.memory_reserved', return_value=2048*1024*1024), \
             patch('torch.cuda.get_device_properties') as mock_props, \
             patch('torch.cuda.get_device_name', return_value='Tesla V100'):
            
            mock_props.return_value.total_memory = 16 * 1024 * 1024 * 1024  # 16GB
            
            checker = ModelChecker()
            result = await checker.check()
            
            assert result.status == HealthStatus.HEALTHY
            assert result.details["gpu_available"] is True
            assert result.details["gpu_count"] == 1
            assert "gpu_0" in result.details
            assert result.details["gpu_0"]["name"] == "Tesla V100"
    
    @patch('torch.cuda.is_available')
    @pytest.mark.asyncio
    async def test_model_check_without_gpu(self, mock_cuda_available):
        """测试无GPU的模型检查"""
        mock_cuda_available.return_value = False
        
        checker = ModelChecker()
        result = await checker.check()
        
        assert result.status == HealthStatus.HEALTHY
        assert result.details["gpu_available"] is False
        assert result.details["gpu_count"] == 0


@pytest.mark.unit
@pytest.mark.api
class TestAdapterChecker:
    """适配器健康检查器测试"""
    
    @pytest.mark.asyncio
    async def test_adapter_check_with_status(self):
        """测试有状态方法的适配器检查"""
        mock_model_manager = Mock()
        mock_model_manager.get_adapter_status.return_value = {
            "loaded_adapters": 2,
            "total_memory": "4GB"
        }
        
        checker = AdapterChecker(mock_model_manager)
        result = await checker.check()
        
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "Adapter check successful"
        assert result.details == {
            "loaded_adapters": 2,
            "total_memory": "4GB"
        }
    
    @pytest.mark.asyncio
    async def test_adapter_check_without_status(self):
        """测试无状态方法的适配器检查"""
        mock_model_manager = Mock()
        # 没有get_adapter_status方法
        
        checker = AdapterChecker(mock_model_manager)
        result = await checker.check()
        
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "Adapter is not initialized"
        assert result.details["status"] == "not initialized"
    
    @pytest.mark.asyncio
    async def test_adapter_check_failure(self):
        """测试适配器检查失败"""
        mock_model_manager = Mock()
        mock_model_manager.get_adapter_status.side_effect = Exception("Connection failed")
        
        checker = AdapterChecker(mock_model_manager)
        result = await checker.check()
        
        assert result.status == HealthStatus.UNHEALTHY
        assert "Adapter check failed: Connection failed" in result.message


@pytest.mark.unit
@pytest.mark.api 
class TestSystemChecker:
    """系统健康检查器测试"""
    
    @patch('psutil.cpu_percent')
    @patch('psutil.virtual_memory')
    @patch('psutil.disk_usage')
    @patch('psutil.cpu_count')
    @pytest.mark.asyncio
    async def test_system_check_healthy(self, mock_cpu_count, mock_disk_usage, 
                                       mock_virtual_memory, mock_cpu_percent):
        """测试健康的系统检查"""
        mock_cpu_percent.return_value = 45.2
        mock_cpu_count.return_value = 8
        
        mock_memory = Mock()
        mock_memory.total = 16 * 1024 * 1024 * 1024  # 16GB
        mock_memory.used = 8 * 1024 * 1024 * 1024    # 8GB
        mock_memory.available = 8 * 1024 * 1024 * 1024  # 8GB
        mock_memory.percent = 50.0
        mock_virtual_memory.return_value = mock_memory
        
        mock_disk = Mock()
        mock_disk.total = 1000 * 1024 * 1024 * 1024  # 1TB
        mock_disk.used = 500 * 1024 * 1024 * 1024    # 500GB
        mock_disk.free = 500 * 1024 * 1024 * 1024    # 500GB
        mock_disk_usage.return_value = mock_disk
        
        checker = SystemChecker()
        result = await checker.check()
        
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "System is healthy"
        assert result.details["cpu"]["usage_percent"] == 45.2
        assert result.details["memory"]["usage_percent"] == 50.0
        assert result.details["disk"]["usage_percent"] == 50.0
    
    @patch('psutil.cpu_percent')
    @patch('psutil.virtual_memory')
    @patch('psutil.disk_usage')
    @patch('psutil.cpu_count')
    @pytest.mark.asyncio
    async def test_system_check_degraded(self, mock_cpu_count, mock_disk_usage, 
                                        mock_virtual_memory, mock_cpu_percent):
        """测试性能下降的系统检查"""
        mock_cpu_percent.return_value = 95.0  # 高CPU使用率
        mock_cpu_count.return_value = 8
        
        mock_memory = Mock()
        mock_memory.total = 16 * 1024 * 1024 * 1024
        mock_memory.used = 15 * 1024 * 1024 * 1024  # 高内存使用率
        mock_memory.available = 1 * 1024 * 1024 * 1024
        mock_memory.percent = 94.0  # 高内存使用率
        mock_virtual_memory.return_value = mock_memory
        
        mock_disk = Mock()
        mock_disk.total = 1000 * 1024 * 1024 * 1024
        mock_disk.used = 950 * 1024 * 1024 * 1024   # 高磁盘使用率
        mock_disk.free = 50 * 1024 * 1024 * 1024
        mock_disk_usage.return_value = mock_disk
        
        checker = SystemChecker()
        result = await checker.check()
        
        assert result.status == HealthStatus.HEALTHY  # 注意：基类检查逻辑
        assert "High CPU usage" in result.message
        assert "High memory usage" in result.message
        assert "High disk usage" in result.message
    
    @patch('psutil.cpu_percent')
    @pytest.mark.asyncio
    async def test_system_check_failure(self, mock_cpu_percent):
        """测试系统检查失败"""
        mock_cpu_percent.side_effect = Exception("System error")
        
        checker = SystemChecker()
        result = await checker.check()
        
        assert result.status == HealthStatus.UNHEALTHY
        assert "System check failed: System error" in result.message


@pytest.mark.unit
@pytest.mark.api
class TestHealthUtilities:
    """健康检查工具函数测试"""
    
    def test_get_uptime(self):
        """测试获取运行时间"""
        uptime = get_uptime()
        assert isinstance(uptime, float)
        assert uptime >= 0
    
    @pytest.mark.asyncio
    async def test_get_health_status_all_healthy(self):
        """测试获取健康状态 - 全部健康"""
        mock_model_manager = Mock()
        
        with patch.object(SystemChecker, 'check') as mock_sys_check, \
             patch.object(ModelChecker, 'check') as mock_model_check, \
             patch.object(AdapterChecker, 'check') as mock_adapter_check:
            
            # 设置所有检查都返回健康状态
            mock_sys_check.return_value = CheckResult(
                name="System",
                status=HealthStatus.HEALTHY,
                message="OK",
                duration_ms=100.0,
                timestamp=datetime.now(timezone.utc)
            )
            mock_model_check.return_value = CheckResult(
                name="Model",
                status=HealthStatus.HEALTHY,
                message="OK",
                duration_ms=150.0,
                timestamp=datetime.now(timezone.utc)
            )
            mock_adapter_check.return_value = CheckResult(
                name="Adapter",
                status=HealthStatus.HEALTHY,
                message="OK",
                duration_ms=200.0,
                timestamp=datetime.now(timezone.utc)
            )
            
            response = await get_health_status(
                model_manager=mock_model_manager,
                include_system=True,
                include_model=True,
                include_adapter=True,
                include_database=False,
                include_redis=False
            )
            
            assert response.status == HealthStatus.HEALTHY
            assert len(response.checks) == 3
            assert response.summary["healthy_count"] == 3
            assert response.summary["unhealthy_count"] == 0
    
    @pytest.mark.asyncio
    async def test_get_health_status_with_failures(self):
        """测试获取健康状态 - 包含失败"""
        mock_model_manager = Mock()
        
        with patch.object(SystemChecker, 'check') as mock_sys_check, \
             patch.object(ModelChecker, 'check') as mock_model_check:
            
            mock_sys_check.return_value = CheckResult(
                name="System",
                status=HealthStatus.HEALTHY,
                message="OK",
                duration_ms=100.0,
                timestamp=datetime.now(timezone.utc)
            )
            mock_model_check.return_value = CheckResult(
                name="Model",
                status=HealthStatus.UNHEALTHY,
                message="Model failed",
                duration_ms=150.0,
                timestamp=datetime.now(timezone.utc)
            )
            
            response = await get_health_status(
                model_manager=mock_model_manager,
                include_system=True,
                include_model=True,
                include_adapter=False,
                include_database=False,
                include_redis=False
            )
            
            assert response.status == HealthStatus.UNHEALTHY
            assert len(response.checks) == 2
            assert response.summary["healthy_count"] == 1
            assert response.summary["unhealthy_count"] == 1
    
    @pytest.mark.asyncio
    async def test_get_health_status_with_exceptions(self):
        """测试获取健康状态 - 包含异常"""
        mock_model_manager = Mock()
        
        with patch.object(SystemChecker, 'check') as mock_sys_check:
            # 模拟检查时抛出异常
            mock_sys_check.side_effect = Exception("Unexpected error")
            
            response = await get_health_status(
                model_manager=mock_model_manager,
                include_system=True,
                include_model=False,
                include_adapter=False,
                include_database=False,
                include_redis=False
            )
            
            assert response.status == HealthStatus.UNHEALTHY
            assert len(response.checks) == 1
            assert response.checks[0].name == "UnknownCheck"
            assert response.checks[0].status == HealthStatus.UNHEALTHY
            assert response.summary["unhealthy_count"] == 1


@pytest.mark.integration
@pytest.mark.api
class TestHealthRoutes:
    """健康检查路由集成测试"""
    
    @pytest.fixture
    def mock_dependencies(self):
        """模拟依赖项"""
        return {
            "model_manager": Mock(),
            "logger": Mock()
        }
    
    def test_health_check_endpoint(self, mock_dependencies):
        """测试健康检查端点"""
        # 这里应该测试实际的HTTP端点
        # 需要创建FastAPI测试客户端
        pytest.skip("需要完整的应用设置")
    
    def test_ping_endpoint(self, mock_dependencies):
        """测试ping端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_deep_health_check_endpoint(self, mock_dependencies):
        """测试深度健康检查端点"""
        pytest.skip("需要完整的应用设置")


@pytest.mark.performance 
@pytest.mark.api
class TestHealthPerformance:
    """健康检查性能测试"""
    
    @pytest.mark.asyncio
    async def test_health_check_performance(self):
        """测试健康检查性能"""
        checker = SystemChecker(timeout=1.0)
        
        # 测试多次检查的平均时间
        times = []
        for _ in range(10):
            start_time = time.time()
            await checker.check()
            times.append(time.time() - start_time)
        
        avg_time = sum(times) / len(times)
        assert avg_time < 2.0  # 平均检查时间应该小于2秒
        assert max(times) < 5.0  # 最大检查时间应该小于5秒
    
    @pytest.mark.asyncio
    async def test_parallel_health_checks(self):
        """测试并行健康检查"""
        checkers = [
            SystemChecker(),
            ModelChecker(),
        ]
        
        start_time = time.time()
        tasks = [checker.check() for checker in checkers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # 并行执行应该比串行执行更快
        assert len(results) == 2
        assert total_time < 3.0  # 并行执行时间应该合理


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

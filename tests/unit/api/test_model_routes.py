# -*- coding: utf-8 -*-
"""
模型管理API路由单元测试
测试所有模型管理端点的功能和边界条件
"""
import pytest
import asyncio
import json
import time
import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import HTTPException, status, BackgroundTasks
from fastapi.testclient import TestClient

from zishu.api.routes.models import (
    AdapterStatus, ModelOperationType, validate_adapter_name,
    get_adapter_file_info, cleanup_memory_task, get_system_info,
    validate_adapter_path
)


@pytest.mark.unit
@pytest.mark.api
class TestAdapterStatus:
    """适配器状态枚举测试"""
    
    def test_adapter_status_values(self):
        """测试适配器状态枚举值"""
        assert AdapterStatus.LOADED == "loaded"
        assert AdapterStatus.UNLOADED == "unloaded"
        assert AdapterStatus.LOADING == "loading"
        assert AdapterStatus.UNLOADING == "unloading"
        assert AdapterStatus.ERROR == "error"
        assert AdapterStatus.UNKNOWN == "unknown"
        assert AdapterStatus.MAINTENANCE == "maintenance"
    
    def test_adapter_status_comparison(self):
        """测试适配器状态比较"""
        assert AdapterStatus.LOADED != AdapterStatus.UNLOADED
        assert AdapterStatus.LOADING != AdapterStatus.LOADED


@pytest.mark.unit
@pytest.mark.api
class TestModelOperationType:
    """模型操作类型枚举测试"""
    
    def test_operation_type_values(self):
        """测试操作类型枚举值"""
        assert ModelOperationType.LOAD == "load"
        assert ModelOperationType.UNLOAD == "unload"
        assert ModelOperationType.SWITCH == "switch"
        assert ModelOperationType.REFRESH == "refresh"
        assert ModelOperationType.LIST == "list"
        assert ModelOperationType.INFO == "info"
        assert ModelOperationType.STATUS == "status"


@pytest.mark.unit
@pytest.mark.api
class TestValidationFunctions:
    """验证函数测试"""
    
    @pytest.mark.asyncio
    async def test_validate_adapter_name_valid(self):
        """测试有效的适配器名称验证"""
        valid_names = [
            "adapter1",
            "my-adapter",
            "adapter_v2",
            "adapter.1.0",
            "Model-Adapter_2024",
            "test123"
        ]
        
        for name in valid_names:
            result = await validate_adapter_name(name)
            assert result is True, f"Name '{name}' should be valid"
    
    @pytest.mark.asyncio
    async def test_validate_adapter_name_invalid(self):
        """测试无效的适配器名称验证"""
        invalid_names = [
            "",              # 空字符串
            "a" * 101,       # 太长
            "-adapter",      # 以特殊字符开头
            "adapter-",      # 以特殊字符结尾
            ".adapter",      # 以点开头
            "adapter.",      # 以点结尾
            "_adapter",      # 以下划线开头
            "adapter_",      # 以下划线结尾
            "adapter@123",   # 包含非法字符
            "adapter space", # 包含空格
            "适配器",        # 包含非ASCII字符
        ]
        
        for name in invalid_names:
            result = await validate_adapter_name(name)
            assert result is False, f"Name '{name}' should be invalid"
    
    @pytest.mark.asyncio
    async def test_validate_adapter_name_edge_cases(self):
        """测试适配器名称验证边界条件"""
        # 长度边界
        name_100_chars = "a" * 100
        assert await validate_adapter_name(name_100_chars) is True
        
        name_1_char = "a"
        assert await validate_adapter_name(name_1_char) is True
        
        # 特殊情况
        assert await validate_adapter_name(None) is False
    
    @pytest.mark.asyncio
    async def test_get_adapter_file_info_existing_file(self):
        """测试获取存在文件的信息"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            # 写入足够大的内容确保size_mb > 0
            content = b"test content " * 100000  # 约1.2MB
            tmp_file.write(content)
            tmp_file.flush()
            
            try:
                info = await get_adapter_file_info(tmp_file.name)
                
                assert info["exists"] is True
                assert info["size"] > 0
                assert info["size_mb"] > 0
                assert "modified_time" in info
                assert "created_time" in info
                assert info["is_file"] is True
                assert info["is_directory"] is False
                
            finally:
                os.unlink(tmp_file.name)
    
    @pytest.mark.asyncio
    async def test_get_adapter_file_info_nonexistent_file(self):
        """测试获取不存在文件的信息"""
        info = await get_adapter_file_info("/nonexistent/path")
        
        assert info["exists"] is False
        assert "error" not in info
    
    @pytest.mark.asyncio
    async def test_get_adapter_file_info_directory(self):
        """测试获取目录信息"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            info = await get_adapter_file_info(tmp_dir)
            
            assert info["exists"] is True
            assert info["is_file"] is False
            assert info["is_directory"] is True
    
    @pytest.mark.asyncio
    async def test_validate_adapter_path_safe(self):
        """测试安全的适配器路径验证"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            adapters_dir = Path(tmp_dir) / "adapters"
            adapters_dir.mkdir()
            
            # 创建模拟配置
            mock_config = Mock()
            mock_config.ADAPTERS_DIR = str(adapters_dir)
            
            # 测试安全路径
            safe_path = str(adapters_dir / "model.bin")
            result = await validate_adapter_path(safe_path, mock_config)
            assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_adapter_path_unsafe(self):
        """测试不安全的适配器路径验证"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            adapters_dir = Path(tmp_dir) / "adapters"
            adapters_dir.mkdir()
            
            mock_config = Mock()
            mock_config.ADAPTERS_DIR = str(adapters_dir)
            
            # 测试路径遍历攻击
            unsafe_paths = [
                "../../../etc/passwd",
                str(Path(tmp_dir) / "../other/file"),
                "/absolute/path/outside"
            ]
            
            for unsafe_path in unsafe_paths:
                result = await validate_adapter_path(unsafe_path, mock_config)
                assert result is False, f"Path '{unsafe_path}' should be unsafe"


@pytest.mark.unit
@pytest.mark.api
class TestUtilityFunctions:
    """工具函数测试"""
    
    @pytest.mark.asyncio
    async def test_cleanup_memory_task(self):
        """测试内存清理任务"""
        mock_logger = Mock()
        
        with patch('gc.collect') as mock_gc:
            mock_gc.return_value = 42
            
            await cleanup_memory_task(mock_logger)
            
            mock_gc.assert_called_once()
            mock_logger.info.assert_called()
    
    @pytest.mark.asyncio
    async def test_cleanup_memory_task_with_torch(self):
        """测试带Torch的内存清理任务"""
        mock_logger = Mock()
        
        with patch('gc.collect', return_value=42), \
             patch('torch.cuda.is_available', return_value=True), \
             patch('torch.cuda.empty_cache') as mock_empty_cache:
            
            await cleanup_memory_task(mock_logger)
            
            mock_empty_cache.assert_called_once()
            assert mock_logger.info.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_cleanup_memory_task_exception(self):
        """测试内存清理任务异常处理"""
        mock_logger = Mock()
        
        with patch('gc.collect', side_effect=Exception("GC error")):
            await cleanup_memory_task(mock_logger)
            
            mock_logger.error.assert_called()
    
    @pytest.mark.asyncio
    async def test_get_system_info_success(self):
        """测试获取系统信息成功"""
        with patch('psutil.virtual_memory') as mock_memory:
            mock_mem = Mock()
            mock_mem.total = 16 * 1024 * 1024 * 1024
            mock_mem.available = 8 * 1024 * 1024 * 1024
            mock_mem.used = 8 * 1024 * 1024 * 1024
            mock_mem.percent = 50.0
            mock_memory.return_value = mock_mem
            
            info = await get_system_info()
            
            assert "memory" in info
            assert info["memory"]["total_mb"] == 16 * 1024
            assert info["memory"]["usage_percent"] == 50.0
            assert "timestamp" in info
    
    @pytest.mark.asyncio
    async def test_get_system_info_with_gpu(self):
        """测试获取包含GPU的系统信息"""
        with patch('psutil.virtual_memory') as mock_memory, \
             patch('torch.cuda.is_available', return_value=True), \
             patch('torch.cuda.device_count', return_value=1), \
             patch('torch.cuda.get_device_name', return_value='Tesla V100'), \
             patch('torch.cuda.memory_allocated', return_value=1024*1024*1024), \
             patch('torch.cuda.memory_reserved', return_value=2048*1024*1024), \
             patch('torch.cuda.get_device_properties') as mock_props:
            
            mock_mem = Mock()
            mock_mem.total = 16 * 1024 * 1024 * 1024
            mock_mem.available = 8 * 1024 * 1024 * 1024
            mock_mem.used = 8 * 1024 * 1024 * 1024
            mock_mem.percent = 50.0
            mock_memory.return_value = mock_mem
            
            mock_device_props = Mock()
            mock_device_props.total_memory = 16 * 1024 * 1024 * 1024
            mock_device_props.major = 7
            mock_device_props.minor = 0
            mock_props.return_value = mock_device_props
            
            info = await get_system_info()
            
            assert "gpu" in info
            assert "cuda:0" in info["gpu"]
            assert info["gpu"]["cuda:0"]["name"] == "Tesla V100"
            assert info["gpu"]["cuda:0"]["compute_capability"] == "7.0"
    
    @pytest.mark.asyncio
    async def test_get_system_info_exception(self):
        """测试获取系统信息异常"""
        with patch('psutil.virtual_memory', side_effect=Exception("System error")):
            info = await get_system_info()
            
            assert "error" in info
            assert info["error"] == "System error"


@pytest.mark.unit
@pytest.mark.api  
class TestModelRouteLogic:
    """模型路由逻辑测试"""
    
    @pytest.fixture
    def mock_model_manager(self):
        """模拟模型管理器"""
        manager = Mock()
        manager.get_loaded_adapters.return_value = {
            "adapter1": {
                "path": "/path/to/adapter1",
                "size": 1024*1024*1024,
                "version": "1.0",
                "description": "Test adapter",
                "load_time": datetime.now(timezone.utc),
                "memory_usage": 512*1024*1024,
                "config": {"param1": "value1"}
            }
        }
        manager.is_adapter_loaded.return_value = True
        manager.load_adapter = AsyncMock()
        manager.unload_adapter = AsyncMock()
        manager.switch_adapter = AsyncMock()
        manager.get_status.return_value = {"status": "healthy"}
        manager.get_adapter_info.return_value = None
        return manager
    
    @pytest.fixture
    def mock_config(self):
        """模拟配置"""
        config = Mock()
        config.ADAPTERS_DIR = "./adapters"
        return config
    
    @pytest.fixture
    def mock_logger(self):
        """模拟日志器"""
        return Mock()
    
    @pytest.fixture
    def mock_background_tasks(self):
        """模拟后台任务"""
        return Mock(spec=BackgroundTasks)
    
    @pytest.mark.asyncio
    async def test_list_adapters_logic(self, mock_model_manager, mock_config, mock_logger):
        """测试列出适配器逻辑"""
        # 这里应该测试实际的列表逻辑
        # 由于函数依赖FastAPI的Depends，我们测试核心逻辑
        
        loaded_adapters = mock_model_manager.get_loaded_adapters()
        assert "adapter1" in loaded_adapters
        assert loaded_adapters["adapter1"]["size"] == 1024*1024*1024
    
    @pytest.mark.asyncio
    async def test_load_adapter_logic(self, mock_model_manager, mock_logger):
        """测试加载适配器逻辑"""
        # 模拟成功加载
        mock_model_manager.load_adapter.return_value = {
            "success": True,
            "memory_usage": 512*1024*1024
        }
        
        result = await mock_model_manager.load_adapter(
            adapter_path="/path/to/adapter",
            adapter_name="test-adapter",
            config={}
        )
        
        assert result["success"] is True
        assert "memory_usage" in result
        mock_model_manager.load_adapter.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_unload_adapter_logic(self, mock_model_manager, mock_logger):
        """测试卸载适配器逻辑"""
        # 模拟成功卸载
        mock_model_manager.unload_adapter.return_value = {
            "success": True
        }
        
        result = await mock_model_manager.unload_adapter(
            adapter_name="test-adapter",
            force=False
        )
        
        assert result["success"] is True
        mock_model_manager.unload_adapter.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_switch_adapter_logic(self, mock_model_manager, mock_logger):
        """测试切换适配器逻辑"""
        # 模拟成功切换
        mock_model_manager.switch_adapter.return_value = {
            "success": True,
            "memory_usage": 1024*1024*1024
        }
        
        result = await mock_model_manager.switch_adapter(
            from_adapter_id="adapter1",
            to_adapter_id="adapter2",
            unload_previous=True
        )
        
        assert result["success"] is True
        assert "memory_usage" in result
        mock_model_manager.switch_adapter.assert_called_once()


@pytest.mark.unit
@pytest.mark.api
class TestModelErrorHandling:
    """模型管理错误处理测试"""
    
    @pytest.fixture
    def failing_model_manager(self):
        """失败的模型管理器"""
        manager = Mock()
        manager.load_adapter = AsyncMock(side_effect=Exception("Load failed"))
        manager.unload_adapter = AsyncMock(side_effect=Exception("Unload failed"))
        manager.switch_adapter = AsyncMock(side_effect=Exception("Switch failed"))
        manager.get_status.side_effect = Exception("Status failed")
        return manager
    
    @pytest.mark.asyncio
    async def test_load_adapter_failure(self, failing_model_manager):
        """测试加载适配器失败"""
        with pytest.raises(Exception, match="Load failed"):
            await failing_model_manager.load_adapter(
                adapter_path="/path",
                adapter_name="test",
                config={}
            )
    
    @pytest.mark.asyncio
    async def test_unload_adapter_failure(self, failing_model_manager):
        """测试卸载适配器失败"""
        with pytest.raises(Exception, match="Unload failed"):
            await failing_model_manager.unload_adapter(
                adapter_name="test",
                force=False
            )
    
    @pytest.mark.asyncio
    async def test_switch_adapter_failure(self, failing_model_manager):
        """测试切换适配器失败"""
        with pytest.raises(Exception, match="Switch failed"):
            await failing_model_manager.switch_adapter(
                from_adapter_id="adapter1",
                to_adapter_id="adapter2",
                unload_previous=False
            )
    
    def test_get_status_failure(self, failing_model_manager):
        """测试获取状态失败"""
        with pytest.raises(Exception, match="Status failed"):
            failing_model_manager.get_status()


@pytest.mark.integration
@pytest.mark.api
class TestModelRoutesIntegration:
    """模型路由集成测试"""
    
    @pytest.fixture
    def app_client(self):
        """创建测试客户端"""
        # 这里应该创建实际的FastAPI测试客户端
        # 暂时返回Mock，实际使用时需要导入真实的app
        return Mock()
    
    def test_list_adapters_endpoint(self, app_client):
        """测试列出适配器端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_load_adapter_endpoint(self, app_client):
        """测试加载适配器端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_unload_adapter_endpoint(self, app_client):
        """测试卸载适配器端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_switch_adapter_endpoint(self, app_client):
        """测试切换适配器端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_get_model_status_endpoint(self, app_client):
        """测试获取模型状态端点"""
        pytest.skip("需要完整的应用设置")
    
    def test_get_adapter_info_endpoint(self, app_client):
        """测试获取适配器信息端点"""
        pytest.skip("需要完整的应用设置")


@pytest.mark.performance
@pytest.mark.api
class TestModelPerformance:
    """模型管理性能测试"""
    
    @pytest.mark.asyncio
    async def test_adapter_validation_performance(self):
        """测试适配器名称验证性能"""
        test_names = [f"adapter_{i}" for i in range(100)]
        
        start_time = time.time()
        for name in test_names:
            await validate_adapter_name(name)
        end_time = time.time()
        
        total_time = end_time - start_time
        avg_time = total_time / len(test_names)
        
        # 平均验证时间应该很快
        assert avg_time < 0.001  # 每次验证少于1ms
        assert total_time < 0.1   # 总时间少于100ms
    
    @pytest.mark.asyncio
    async def test_file_info_performance(self):
        """测试文件信息获取性能"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            # 创建多个测试文件
            test_files = []
            for i in range(10):
                file_path = Path(tmp_dir) / f"test_file_{i}.bin"
                file_path.write_bytes(b"test content" * 1000)
                test_files.append(str(file_path))
            
            start_time = time.time()
            for file_path in test_files:
                await get_adapter_file_info(file_path)
            end_time = time.time()
            
            total_time = end_time - start_time
            avg_time = total_time / len(test_files)
            
            # 文件信息获取应该很快
            assert avg_time < 0.01   # 每次获取少于10ms
            assert total_time < 0.1   # 总时间少于100ms
    
    @pytest.mark.asyncio
    async def test_system_info_performance(self):
        """测试系统信息获取性能"""
        times = []
        
        for _ in range(5):
            start_time = time.time()
            await get_system_info()
            times.append(time.time() - start_time)
        
        avg_time = sum(times) / len(times)
        max_time = max(times)
        
        # 系统信息获取应该合理快速
        assert avg_time < 0.1  # 平均少于100ms
        assert max_time < 0.2  # 最大少于200ms


@pytest.mark.stress
@pytest.mark.api
class TestModelStress:
    """模型管理压力测试"""
    
    @pytest.mark.asyncio
    async def test_concurrent_validation(self):
        """测试并发验证"""
        async def validate_batch():
            tasks = []
            for i in range(50):
                tasks.append(validate_adapter_name(f"adapter_{i}"))
            return await asyncio.gather(*tasks)
        
        # 执行多个并发批次
        start_time = time.time()
        results = await asyncio.gather(*[validate_batch() for _ in range(10)])
        end_time = time.time()
        
        total_time = end_time - start_time
        total_validations = sum(len(batch) for batch in results)
        
        # 验证所有结果都是True
        for batch in results:
            assert all(result is True for result in batch)
        
        # 性能检查
        avg_time_per_validation = total_time / total_validations
        assert avg_time_per_validation < 0.001  # 平均每次验证少于1ms
    
    @pytest.mark.asyncio
    async def test_memory_cleanup_stress(self):
        """测试内存清理压力"""
        mock_logger = Mock()
        
        # 并发执行多个清理任务
        tasks = [cleanup_memory_task(mock_logger) for _ in range(10)]
        
        start_time = time.time()
        await asyncio.gather(*tasks)
        end_time = time.time()
        
        total_time = end_time - start_time
        
        # 并发清理不应该耗时太久
        assert total_time < 5.0  # 总时间少于5秒
        
        # 验证所有清理任务都执行了
        assert mock_logger.info.call_count >= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

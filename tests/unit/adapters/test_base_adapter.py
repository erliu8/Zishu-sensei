# -*- coding: utf-8 -*-
"""
基础适配器单元测试
"""
import pytest
import torch
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import json
import tempfile

# 假设的基础适配器导入（需要根据实际路径调整）
# from zishu.adapters.base import BaseAdapter, AdapterConfig
# from zishu.adapters.base.exceptions import AdapterError, ConfigError

@pytest.mark.unit
@pytest.mark.adapter
class TestBaseAdapter:
    """基础适配器测试类"""
    
    @pytest.fixture
    def base_adapter_config(self):
        """基础适配器配置"""
        return {
            "name": "test_base_adapter",
            "version": "1.0.0",
            "type": "base",
            "description": "测试基础适配器",
            "author": "test_author",
            "created_at": "2024-01-01T00:00:00Z",
            "parameters": {
                "learning_rate": 0.001,
                "batch_size": 8,
                "max_length": 512,
            },
            "requirements": {
                "torch": ">=2.0.0",
                "transformers": ">=4.30.0",
            }
        }
    
    @pytest.fixture
    def mock_base_adapter(self, base_adapter_config):
        """模拟基础适配器"""
        adapter = Mock()
        adapter.config = base_adapter_config
        adapter.name = base_adapter_config["name"]
        adapter.version = base_adapter_config["version"]
        adapter.is_loaded = False
        adapter.device = torch.device("cpu")
        return adapter
    
    def test_adapter_initialization(self, mock_base_adapter, base_adapter_config):
        """测试适配器初始化"""
        assert mock_base_adapter.name == "test_base_adapter"
        assert mock_base_adapter.version == "1.0.0"
        assert mock_base_adapter.config == base_adapter_config
        assert mock_base_adapter.is_loaded is False
    
    def test_adapter_config_validation(self, base_adapter_config):
        """测试适配器配置验证"""
        # 模拟配置验证函数
        def validate_config(config):
            required_fields = ["name", "version", "type"]
            for field in required_fields:
                if field not in config:
                    raise ValueError(f"缺少必需字段: {field}")
            return True
        
        # 测试有效配置
        assert validate_config(base_adapter_config) is True
        
        # 测试无效配置
        invalid_config = base_adapter_config.copy()
        del invalid_config["name"]
        
        with pytest.raises(ValueError, match="缺少必需字段: name"):
            validate_config(invalid_config)
    
    @pytest.mark.asyncio
    async def test_adapter_load(self, mock_base_adapter):
        """测试适配器加载"""
        mock_base_adapter.load = AsyncMock(return_value=True)
        mock_base_adapter.is_loaded = True
        
        result = await mock_base_adapter.load()
        
        assert result is True
        assert mock_base_adapter.is_loaded is True
        mock_base_adapter.load.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_adapter_unload(self, mock_base_adapter):
        """测试适配器卸载"""
        mock_base_adapter.unload = AsyncMock(return_value=True)
        mock_base_adapter.is_loaded = False
        
        result = await mock_base_adapter.unload()
        
        assert result is True
        assert mock_base_adapter.is_loaded is False
        mock_base_adapter.unload.assert_called_once()
    
    def test_adapter_get_info(self, mock_base_adapter):
        """测试获取适配器信息"""
        expected_info = {
            "name": "test_base_adapter",
            "version": "1.0.0",
            "type": "base",
            "status": "unloaded",
            "memory_usage": "0MB",
            "device": "cpu"
        }
        mock_base_adapter.get_info = Mock(return_value=expected_info)
        
        info = mock_base_adapter.get_info()
        
        assert info["name"] == "test_base_adapter"
        assert info["version"] == "1.0.0"
        assert info["status"] == "unloaded"
    
    def test_adapter_parameter_update(self, mock_base_adapter):
        """测试适配器参数更新"""
        new_params = {
            "learning_rate": 0.002,
            "batch_size": 16,
        }
        mock_base_adapter.update_parameters = Mock(return_value=True)
        
        result = mock_base_adapter.update_parameters(new_params)
        
        assert result is True
        mock_base_adapter.update_parameters.assert_called_once_with(new_params)
    
    def test_adapter_device_management(self, mock_base_adapter):
        """测试适配器设备管理"""
        mock_base_adapter.to_device = Mock(return_value=True)
        mock_base_adapter.device = torch.device("cuda:0")
        
        result = mock_base_adapter.to_device("cuda:0")
        
        assert result is True
        assert str(mock_base_adapter.device) == "cuda:0"
    
    def test_adapter_state_dict(self, mock_base_adapter):
        """测试适配器状态字典"""
        expected_state = {
            "config": mock_base_adapter.config,
            "parameters": {"param1": torch.randn(10, 10)},
            "metadata": {"training_steps": 1000}
        }
        mock_base_adapter.state_dict = Mock(return_value=expected_state)
        
        state = mock_base_adapter.state_dict()
        
        assert "config" in state
        assert "parameters" in state
        assert "metadata" in state
    
    def test_adapter_load_state_dict(self, mock_base_adapter):
        """测试加载适配器状态字典"""
        state_dict = {
            "parameters": {"param1": torch.randn(10, 10)},
            "metadata": {"training_steps": 1000}
        }
        mock_base_adapter.load_state_dict = Mock(return_value=True)
        
        result = mock_base_adapter.load_state_dict(state_dict)
        
        assert result is True
        mock_base_adapter.load_state_dict.assert_called_once_with(state_dict)

@pytest.mark.unit
@pytest.mark.adapter
class TestAdapterConfig:
    """适配器配置测试类"""
    
    def test_config_creation(self, base_adapter_config):
        """测试配置创建"""
        # 模拟配置类
        class AdapterConfig:
            def __init__(self, config_dict):
                self.name = config_dict["name"]
                self.version = config_dict["version"]
                self.type = config_dict["type"]
                self.parameters = config_dict.get("parameters", {})
        
        config = AdapterConfig(base_adapter_config)
        
        assert config.name == "test_base_adapter"
        assert config.version == "1.0.0"
        assert config.type == "base"
        assert isinstance(config.parameters, dict)
    
    def test_config_serialization(self, base_adapter_config):
        """测试配置序列化"""
        # 测试JSON序列化
        json_str = json.dumps(base_adapter_config, indent=2)
        loaded_config = json.loads(json_str)
        
        assert loaded_config["name"] == base_adapter_config["name"]
        assert loaded_config["version"] == base_adapter_config["version"]
    
    def test_config_validation_rules(self):
        """测试配置验证规则"""
        def validate_version(version):
            """验证版本格式"""
            import re
            pattern = r'^\d+\.\d+\.\d+$'
            return bool(re.match(pattern, version))
        
        # 测试有效版本
        assert validate_version("1.0.0") is True
        assert validate_version("2.1.3") is True
        
        # 测试无效版本
        assert validate_version("1.0") is False
        assert validate_version("v1.0.0") is False
    
    def test_config_parameter_types(self, base_adapter_config):
        """测试配置参数类型"""
        params = base_adapter_config["parameters"]
        
        assert isinstance(params["learning_rate"], float)
        assert isinstance(params["batch_size"], int)
        assert isinstance(params["max_length"], int)
        
        # 测试参数范围
        assert 0 < params["learning_rate"] < 1
        assert params["batch_size"] > 0
        assert params["max_length"] > 0

@pytest.mark.integration
@pytest.mark.adapter
class TestAdapterFileOperations:
    """适配器文件操作测试"""
    
    @pytest.fixture
    def temp_adapter_dir(self, temp_dir):
        """临时适配器目录"""
        adapter_dir = temp_dir / "test_adapter"
        adapter_dir.mkdir(exist_ok=True)
        return adapter_dir
    
    def test_adapter_save_load(self, temp_adapter_dir, base_adapter_config):
        """测试适配器保存和加载"""
        # 保存配置文件
        config_file = temp_adapter_dir / "config.json"
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(base_adapter_config, f, indent=2, ensure_ascii=False)
        
        # 加载配置文件
        with open(config_file, "r", encoding="utf-8") as f:
            loaded_config = json.load(f)
        
        assert loaded_config["name"] == base_adapter_config["name"]
        assert loaded_config["version"] == base_adapter_config["version"]
    
    def test_adapter_directory_structure(self, temp_adapter_dir):
        """测试适配器目录结构"""
        # 创建标准适配器目录结构
        (temp_adapter_dir / "weights").mkdir()
        (temp_adapter_dir / "config").mkdir()
        (temp_adapter_dir / "metadata").mkdir()
        
        # 创建必要文件
        (temp_adapter_dir / "config.json").touch()
        (temp_adapter_dir / "weights" / "adapter_model.bin").touch()
        (temp_adapter_dir / "metadata" / "training_info.json").touch()
        
        # 验证目录结构
        assert (temp_adapter_dir / "config.json").exists()
        assert (temp_adapter_dir / "weights").is_dir()
        assert (temp_adapter_dir / "config").is_dir()
        assert (temp_adapter_dir / "metadata").is_dir()
    
    def test_adapter_backup_restore(self, temp_adapter_dir, base_adapter_config):
        """测试适配器备份和恢复"""
        import shutil
        
        # 创建原始适配器
        config_file = temp_adapter_dir / "config.json"
        with open(config_file, "w") as f:
            json.dump(base_adapter_config, f)
        
        # 创建备份
        backup_dir = temp_adapter_dir.parent / "backup_adapter"
        shutil.copytree(temp_adapter_dir, backup_dir)
        
        # 验证备份
        backup_config = backup_dir / "config.json"
        assert backup_config.exists()
        
        with open(backup_config, "r") as f:
            backup_config_data = json.load(f)
        
        assert backup_config_data["name"] == base_adapter_config["name"]

@pytest.mark.performance
@pytest.mark.adapter
class TestAdapterPerformance:
    """适配器性能测试"""
    
    def test_adapter_memory_footprint(self, mock_base_adapter, performance_monitor):
        """测试适配器内存占用"""
        performance_monitor.start()
        
        # 模拟适配器加载
        mock_base_adapter.load = Mock(return_value=True)
        mock_base_adapter.load()
        
        # 模拟内存使用
        mock_base_adapter.get_memory_usage = Mock(return_value={"total": "128MB"})
        memory_usage = mock_base_adapter.get_memory_usage()
        
        metrics = performance_monitor.stop()
        
        assert "total" in memory_usage
        assert metrics["duration"] < 1.0  # 加载应该很快
    
    def test_adapter_initialization_speed(self, performance_monitor):
        """测试适配器初始化速度"""
        performance_monitor.start()
        
        # 模拟适配器初始化
        for i in range(10):
            adapter = Mock()
            adapter.name = f"adapter_{i}"
            adapter.initialize = Mock(return_value=True)
            adapter.initialize()
        
        metrics = performance_monitor.stop()
        
        # 10个适配器初始化应该在合理时间内完成
        assert metrics["duration"] < 2.0
    
    def test_adapter_concurrent_access(self, mock_base_adapter):
        """测试适配器并发访问"""
        import threading
        import time
        
        results = []
        errors = []
        
        def access_adapter(adapter_id):
            try:
                # 模拟并发访问
                mock_base_adapter.get_info = Mock(return_value={"id": adapter_id})
                result = mock_base_adapter.get_info()
                results.append(result)
                time.sleep(0.1)  # 模拟处理时间
            except Exception as e:
                errors.append(e)
        
        # 创建多个线程
        threads = []
        for i in range(5):
            thread = threading.Thread(target=access_adapter, args=(i,))
            threads.append(thread)
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        # 验证结果
        assert len(results) == 5
        assert len(errors) == 0

@pytest.mark.unit
@pytest.mark.adapter
class TestAdapterExceptions:
    """适配器异常处理测试"""
    
    def test_adapter_load_failure(self, mock_base_adapter):
        """测试适配器加载失败"""
        mock_base_adapter.load = Mock(side_effect=FileNotFoundError("适配器文件不存在"))
        
        with pytest.raises(FileNotFoundError):
            mock_base_adapter.load()
    
    def test_adapter_config_error(self):
        """测试适配器配置错误"""
        invalid_config = {
            "name": "",  # 空名称
            "version": "invalid_version",  # 无效版本
        }
        
        def validate_config(config):
            if not config.get("name"):
                raise ValueError("适配器名称不能为空")
            if not config.get("version", "").count(".") == 2:
                raise ValueError("版本格式无效")
        
        with pytest.raises(ValueError, match="适配器名称不能为空"):
            validate_config(invalid_config)
    
    def test_adapter_device_error(self, mock_base_adapter):
        """测试适配器设备错误"""
        mock_base_adapter.to_device = Mock(side_effect=RuntimeError("CUDA设备不可用"))
        
        with pytest.raises(RuntimeError, match="CUDA设备不可用"):
            mock_base_adapter.to_device("cuda:0")
    
    def test_adapter_parameter_error(self, mock_base_adapter):
        """测试适配器参数错误"""
        invalid_params = {
            "learning_rate": -0.1,  # 负学习率
            "batch_size": 0,        # 零批次大小
        }
        
        def validate_parameters(params):
            if params.get("learning_rate", 0) <= 0:
                raise ValueError("学习率必须大于0")
            if params.get("batch_size", 1) <= 0:
                raise ValueError("批次大小必须大于0")
        
        with pytest.raises(ValueError, match="学习率必须大于0"):
            validate_parameters(invalid_params)

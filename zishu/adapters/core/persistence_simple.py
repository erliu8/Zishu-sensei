"""
适配器配置持久化服务 - 简化版本（使用JSON文件）
"""

import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path

from .types import AdapterConfiguration, AdapterType

logger = logging.getLogger(__name__)


class AdapterPersistenceService:
    """适配器配置持久化服务（JSON文件版本）"""

    def __init__(self, config_dir: str = "/data/adapter_configs"):
        """初始化持久化服务"""
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "adapters.json"
        
    def _load_all(self) -> Dict[str, Dict[str, Any]]:
        """加载所有配置"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Failed to load adapter configs: {e}")
            return {}
    
    def _save_all(self, configs: Dict[str, Dict[str, Any]]) -> bool:
        """保存所有配置"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(configs, f, indent=2, ensure_ascii=False, default=str)
            return True
        except Exception as e:
            logger.error(f"Failed to save adapter configs: {e}")
            return False

    async def save_adapter_config(self, config: AdapterConfiguration) -> bool:
        """
        保存适配器配置到文件
        
        Args:
            config: 适配器配置对象
            
        Returns:
            bool: 保存是否成功
        """
        try:
            configs = self._load_all()
            
            config_dict = {
                "adapter_id": config.identity,
                "name": config.name or config.identity,
                "adapter_type": config.adapter_type.value if hasattr(config.adapter_type, 'value') else str(config.adapter_type),
                "adapter_class": self._get_class_path(config.adapter_class),
                "version": config.version or "1.0.0",
                "config": config.config or {},
                "dependencies": list(config.dependencies) if config.dependencies else [],
                "description": config.description,
                "author": config.author,
                "tags": list(config.tags) if config.tags else [],
                "is_enabled": True,
                "status": "registered",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            
            configs[config.identity] = config_dict
            
            if self._save_all(configs):
                logger.info(f"Saved adapter config to file: {config.identity}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to save adapter config: {e}")
            return False

    async def load_adapter_config(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """
        从文件加载适配器配置
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            Optional[Dict]: 配置字典，如果不存在返回None
        """
        try:
            configs = self._load_all()
            config = configs.get(adapter_id)
            
            if config and config.get('is_enabled', True):
                # 更新最后使用时间
                config['last_used_at'] = datetime.now(timezone.utc).isoformat()
                config['usage_count'] = config.get('usage_count', 0) + 1
                configs[adapter_id] = config
                self._save_all(configs)
                
                return config
            return None
            
        except Exception as e:
            logger.error(f"Failed to load adapter config: {e}")
            return None

    async def load_all_adapter_configs(self) -> List[Dict[str, Any]]:
        """
        加载所有启用的适配器配置
        
        Returns:
            List[Dict]: 配置字典列表
        """
        try:
            configs = self._load_all()
            return [
                config for config in configs.values()
                if config.get('is_enabled', True)
            ]
        except Exception as e:
            logger.error(f"Failed to load all adapter configs: {e}")
            return []

    async def delete_adapter_config(self, adapter_id: str) -> bool:
        """
        删除适配器配置
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            configs = self._load_all()
            if adapter_id in configs:
                del configs[adapter_id]
                if self._save_all(configs):
                    logger.info(f"Deleted adapter config from file: {adapter_id}")
                    return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete adapter config: {e}")
            return False

    def _get_class_path(self, adapter_class) -> str:
        """获取类的完整路径"""
        if isinstance(adapter_class, str):
            return adapter_class
        elif isinstance(adapter_class, type):
            return f"{adapter_class.__module__}.{adapter_class.__name__}"
        else:
            return str(adapter_class)

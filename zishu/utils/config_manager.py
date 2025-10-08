# src/utils/config_manager.py

import json
import os
import logging
import time
import threading
from typing import Dict, Any, Optional, Callable, List
from pathlib import Path
from jsonschema import validate
from cryptography.fernet import Fernet


class ConfigManager:
    """配置管理类,用于读取和存储配置信息,支持热重载配置"""

    def __init__(
        self,
        config_dir: Path,
        default_config: str = "default",
        schema_dir: Optional[Path] = None,
    ):
        """
        Args:
            config_dir (Path): 配置文件路径
            default_config (str): 默认配置文件名,位于config目录下
        """
        self.config_dir = config_dir
        self.default_config = default_config
        self.configs = {}
        self.last_modified_times = {}
        self.callbacks = {}
        self.stop_event = threading.Event()
        self.watch_thread = None
        self.logger = logging.getLogger(__name__)
        self.schema_dir = schema_dir
        self.encryption_key = None

        # 初始化配置
        self.load_all_configs()

    def load_all_configs(self):
        """加载所有配置文件"""
        for file_path in self.config_dir.glob("**/*.json"):
            rel_path = file_path.relative_to(self.config_dir)
            config_name = str(rel_path).replace(".json", "")
            self.load_config(config_name)

    def load_config(self, config_name: str) -> Dict[str, Any]:
        """加载指定配置文件"""
        file_path = self._get_config_path(config_name)

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            self.configs[config_name] = config
            self.last_modified_times[config_name] = os.path.getmtime(file_path)

            return config
        except Exception as e:
            self.logger.error(f"加载配置文件失败: {config_name} - {str(e)}")
            if config_name == self.default_config:
                raise RuntimeError(f"默认配置文件加载失败,程序将无法启动:{e}")
            return {}

    def get_config(self, config_name: str = None) -> Dict[str, Any]:
        """获取配置信息,如果不存在则加载"""
        config_name = config_name or self.default_config

        if config_name not in self.configs:
            return self.load_config(config_name)

        return self.configs[config_name]

    def _get_config_path(self, config_name: str = None) -> Path:
        """获取配置文件路径"""
        return self.config_dir / f"{config_name}.json"

    def register_callback(
        self, config_name: str, callback: Callable[[str, Dict[str, Any]], None]
    ):
        """注册配置变化回调函数"""
        if config_name not in self.callbacks:
            self.callbacks[config_name] = []
        self.callbacks[config_name].append(callback)

    def validate_config(self, config_name: str, config: Dict) -> bool:
        """验证配置文件是否符合schema"""
        if not self.schema_dir:
            return True

        schema_path = self.schema_dir / f"{config_name}_schema.json"
        if not schema_path.exists():
            self.logger.warning(f"未找到配置文件{config_name}的schema文件,跳过验证")
            return True

        with open(schema_path, "r") as f:
            schema = json.load(f)

        validate(instance=config, schema=schema)
        return True

    def encrypt_config(self, value: str) -> str:
        """加密配置值"""
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key()
        f = Fernet(self.encryption_key)
        return f.encrypt(value.encode()).decode()

    def decrypt_config(self, value: str) -> str:
        """解密配置值"""
        if not self.encryption_key:
            raise RuntimeError("未设置加密密钥")
        f = Fernet(self.encryption_key)
        return f.decrypt(value.encode()).decode()

    def start_watch(self, interval: int = 10):
        """开始监视配置文件变化"""
        if self.watch_thread and self.watch_thread.is_alive():
            return

        self.stop_event.clear()
        self.watch_thread = threading.Thread(
            target=self._watch_config_files, args=(interval,), daemon=True
        )
        self.watch_thread.start()

    def stop_watching(self):
        """停止监视配置文件变化"""
        if self.watch_thread:
            self.stop_event.set()
            self.watch_thread.join(timeout=1)

    def _watch_config_files(self, interval: int):
        """监视线程，检查配置文件变化"""
        self.logger.info("开始监视配置文件变化...,间隔{interval}秒")

        while not self.stop_event.is_set():
            for config_name in list(self.configs.keys()):
                file_path = self._get_config_path(config_name)

                if not file_path.exists():
                    continue

                mod_time = os.path.getmtime(file_path)

                if (
                    config_name in self.last_modified_times
                    and mod_time > self.last_modified_times[config_name]
                ):
                    self.logger.info(f"配置文件发生变化: {config_name}")
                    new_config = self.load_config(config_name)
                    # 触发回调函数
                    if config_name in self.callbacks:
                        for callback in self.callbacks[config_name]:
                            try:
                                callback(new_config)
                            except Exception as e:
                                self.logger.error(f"执行回调函数失败: {e}")
            # 更新最后修改时间
            time.sleep(interval)

# -*- coding: utf-8 -*-
"""
Zishu-sensei 配置管理系统
"""

import os
import re
import json
import yaml
import threading
import weakref
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Type, Callable, Set
from dataclasses import dataclass, field
from enum import Enum
from contextlib import contextmanager
import hashlib
import base64

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    
    # 创建虚拟的FileSystemEventHandler类用于类型注解
    class FileSystemEventHandler:
        def on_modified(self, event):
            pass

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class ConfigFormat(Enum):
    """支持的配置文件格式"""
    YAML = "yaml"
    JSON = "json"
    ENV = "env"


class Environment(Enum):
    """支持的环境类型"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class ConfigMetadata:
    """配置元数据"""
    file_path: Path
    format: ConfigFormat
    environment: Environment
    last_modified: float
    checksum: str
    encrypted: bool = False
    schema_validated: bool = False


class ConfigException(Exception):
    """配置相关异常基类"""
    pass


class ConfigValidationError(ConfigException):
    """配置验证错误"""
    pass


class ConfigLoadError(ConfigException):
    """配置加载错误"""
    pass


class ConfigEncryptionError(ConfigException):
    """配置加密错误"""
    pass


class ConfigWatcher(FileSystemEventHandler):
    """配置文件监控器"""
    
    def __init__(self, config_manager: 'ConfigManager'):
        self.config_manager = weakref.ref(config_manager)
        self.logger = logger.bind(component="ConfigWatcher")
    
    def on_modified(self, event):
        """文件修改事件处理"""
        if event.is_directory:
            return
        
        config_manager = self.config_manager()
        if config_manager is None:
            return
            
        file_path = Path(event.src_path)
        if file_path.suffix.lower() in ['.yml', '.yaml', '.json', '.env']:
            self.logger.info(f"检测到配置文件变更: {file_path}")
            try:
                config_manager.reload_config()
            except Exception as e:
                self.logger.error(f"热重载配置失败: {e}")


class EncryptionManager:
    """配置加密管理器"""
    
    def __init__(self, password: Optional[str] = None):
        self.logger = logger.bind(component="EncryptionManager")
        
        if not CRYPTO_AVAILABLE:
            self.logger.warning("cryptography库不可用，加密功能将被禁用")
            self.cipher_suite = None
            return
        
        if password is None:
            password = os.getenv('ZISHU_CONFIG_PASSWORD', 'default-key-change-in-production')
        
        # 生成加密密钥
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'zishu-sensei-salt',
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self.cipher_suite = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """加密字符串数据"""
        if not self.cipher_suite:
            raise ConfigEncryptionError("加密功能不可用")
        
        try:
            encrypted_data = self.cipher_suite.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            raise ConfigEncryptionError(f"加密失败: {e}")
    
    def decrypt(self, encrypted_data: str) -> str:
        """解密字符串数据"""
        if not self.cipher_suite:
            raise ConfigEncryptionError("解密功能不可用")
        
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self.cipher_suite.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            raise ConfigEncryptionError(f"解密失败: {e}")


class ConfigLoader(ABC):
    """配置加载器抽象基类"""
    
    @abstractmethod
    def load(self, file_path: Path) -> Dict[str, Any]:
        """加载配置文件"""
        pass
    
    @abstractmethod
    def save(self, data: Dict[str, Any], file_path: Path) -> None:
        """保存配置文件"""
        pass


class YamlConfigLoader(ConfigLoader):
    """YAML配置加载器"""
    
    def load(self, file_path: Path) -> Dict[str, Any]:
        """加载YAML配置文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise ConfigLoadError(f"YAML解析错误 ({file_path}): {e}")
        except Exception as e:
            raise ConfigLoadError(f"文件读取错误 ({file_path}): {e}")
    
    def save(self, data: Dict[str, Any], file_path: Path) -> None:
        """保存YAML配置文件"""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(data, f, default_flow_style=False, 
                             allow_unicode=True, indent=2)
        except Exception as e:
            raise ConfigLoadError(f"YAML保存错误 ({file_path}): {e}")


class JsonConfigLoader(ConfigLoader):
    """JSON配置加载器"""
    
    def load(self, file_path: Path) -> Dict[str, Any]:
        """加载JSON配置文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ConfigLoadError(f"JSON解析错误 ({file_path}): {e}")
        except Exception as e:
            raise ConfigLoadError(f"文件读取错误 ({file_path}): {e}")
    
    def save(self, data: Dict[str, Any], file_path: Path) -> None:
        """保存JSON配置文件"""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            raise ConfigLoadError(f"JSON保存错误 ({file_path}): {e}")


class EnvConfigLoader(ConfigLoader):
    """环境变量配置加载器"""
    
    def load(self, file_path: Path) -> Dict[str, Any]:
        """加载.env文件"""
        config = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    if '=' in line:
                        key, value = line.split('=', 1)
                        config[key.strip()] = value.strip().strip('\'"')
                    else:
                        logger.warning(f"忽略无效行 {line_num} in {file_path}: {line}")
            return config
        except Exception as e:
            raise ConfigLoadError(f"ENV文件读取错误 ({file_path}): {e}")
    
    def save(self, data: Dict[str, Any], file_path: Path) -> None:
        """保存.env文件"""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                for key, value in data.items():
                    f.write(f"{key}={value}\n")
        except Exception as e:
            raise ConfigLoadError(f"ENV文件保存错误 ({file_path}): {e}")


class ConfigValidator:
    """配置验证器"""
    
    def __init__(self):
        self.logger = logger.bind(component="ConfigValidator")
        self.validators: Dict[str, Callable] = {}
        self.required_fields: Set[str] = set()
        self.type_constraints: Dict[str, Type] = {}
    
    def add_validator(self, field_path: str, validator_func: Callable) -> None:
        """添加自定义验证器"""
        self.validators[field_path] = validator_func
    
    def add_required_field(self, field_path: str) -> None:
        """添加必填字段"""
        self.required_fields.add(field_path)
    
    def add_type_constraint(self, field_path: str, field_type: Type) -> None:
        """添加类型约束"""
        self.type_constraints[field_path] = field_type
    
    def validate(self, config: Dict[str, Any]) -> List[str]:
        """验证配置"""
        errors = []
        
        # 检查必填字段
        for field_path in self.required_fields:
            if not self._get_nested_value(config, field_path):
                errors.append(f"必填字段缺失: {field_path}")
        
        # 检查类型约束
        for field_path, expected_type in self.type_constraints.items():
            value = self._get_nested_value(config, field_path)
            if value is not None and not isinstance(value, expected_type):
                errors.append(f"类型错误 {field_path}: 期望 {expected_type.__name__}, 实际 {type(value).__name__}")
        
        # 运行自定义验证器
        for field_path, validator_func in self.validators.items():
            value = self._get_nested_value(config, field_path)
            try:
                if not validator_func(value):
                    errors.append(f"自定义验证失败: {field_path}")
            except Exception as e:
                errors.append(f"验证器异常 {field_path}: {e}")
        
        return errors
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """获取嵌套字段值"""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value


@dataclass
class ConfigManagerOptions:
    """配置管理器选项"""
    config_dir: Path = field(default_factory=lambda: Path("config"))
    environment: Environment = Environment.DEVELOPMENT
    auto_reload: bool = True
    cache_enabled: bool = True
    encryption_enabled: bool = False
    validation_enabled: bool = True
    backup_enabled: bool = True
    max_backup_files: int = 10


class ConfigManager:
    """配置管理器主类"""
    
    def __init__(self, options: Optional[ConfigManagerOptions] = None):
        self.options = options or ConfigManagerOptions()
        self.logger = logger.bind(component="ConfigManager")
        
        # 初始化组件
        self._config_cache: Dict[str, Any] = {}
        self._metadata_cache: Dict[str, ConfigMetadata] = {}
        self._lock = threading.RLock()
        self._observers: List[Observer] = []
        self._change_callbacks: List[Callable] = []
        
        # 初始化加载器
        self._loaders = {
            ConfigFormat.YAML: YamlConfigLoader(),
            ConfigFormat.JSON: JsonConfigLoader(),
            ConfigFormat.ENV: EnvConfigLoader(),
        }
        
        # 初始化加密管理器
        if self.options.encryption_enabled:
            self.encryption_manager = EncryptionManager()
        else:
            self.encryption_manager = None
        
        # 初始化验证器
        self.validator = ConfigValidator()
        self._setup_default_validators()
        
        # 确保配置目录存在
        self.options.config_dir.mkdir(parents=True, exist_ok=True)
        
        # 启动文件监控
        if self.options.auto_reload and WATCHDOG_AVAILABLE:
            self._start_file_watching()
        
        self.logger.info(f"配置管理器初始化完成 - 环境: {self.options.environment.value}")
    
    def _setup_default_validators(self) -> None:
        """设置默认验证器"""
        # API服务器配置验证
        self.validator.add_required_field("server.host")
        self.validator.add_required_field("server.port")
        self.validator.add_type_constraint("server.port", int)
        self.validator.add_type_constraint("server.debug", bool)
        
        # 端口范围验证
        self.validator.add_validator(
            "server.port", 
            lambda x: isinstance(x, int) and 1024 <= x <= 65535
        )
        
        # 日志级别验证
        valid_log_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        self.validator.add_validator(
            "logging.level",
            lambda x: x.upper() in valid_log_levels if x else True
        )
    
    def _start_file_watching(self) -> None:
        """启动文件监控"""
        if not WATCHDOG_AVAILABLE:
            self.logger.warning("watchdog不可用，无法启用配置文件热重载")
            return
        
        try:
            event_handler = ConfigWatcher(self)
            observer = Observer()
            observer.schedule(event_handler, str(self.options.config_dir), recursive=True)
            observer.start()
            self._observers.append(observer)
            self.logger.info("配置文件监控已启动")
        except Exception as e:
            self.logger.error(f"启动文件监控失败: {e}")
    
    def load_config(self, 
                   config_name: str = "default",
                   environment: Optional[Environment] = None,
                   force_reload: bool = False) -> Dict[str, Any]:
        """
        加载配置文件
        
        Args:
            config_name: 配置文件名(不含扩展名)
            environment: 环境类型，None则使用默认环境
            force_reload: 强制重新加载，忽略缓存
            
        Returns:
            配置字典
        """
        env = environment or self.options.environment
        cache_key = f"{config_name}:{env.value}"
        
        with self._lock:
            # 检查缓存
            if not force_reload and self.options.cache_enabled and cache_key in self._config_cache:
                if self._is_cache_valid(cache_key):
                    self.logger.debug(f"使用缓存配置: {cache_key}")
                    return self._config_cache[cache_key].copy()
            
            # 加载配置
            config = self._load_config_files(config_name, env)
            
            # 处理环境变量替换
            config = self._resolve_environment_variables(config)
            
            # 解密敏感信息
            if self.encryption_manager:
                config = self._decrypt_sensitive_fields(config)
            
            # 验证配置
            if self.options.validation_enabled:
                errors = self.validator.validate(config)
                if errors:
                    raise ConfigValidationError(f"配置验证失败: {'; '.join(errors)}")
            
            # 更新缓存
            if self.options.cache_enabled:
                self._config_cache[cache_key] = config.copy()
            
            self.logger.info(f"配置加载成功: {cache_key}")
            return config
    
    def _load_config_files(self, config_name: str, env: Environment) -> Dict[str, Any]:
        """加载配置文件"""
        config = {}
        
        # 加载顺序：基础配置 -> 环境配置
        config_files = [
            (f"{config_name}.yml", ConfigFormat.YAML),
            (f"{config_name}.yaml", ConfigFormat.YAML),
            (f"{config_name}.json", ConfigFormat.JSON),
            (f"environments/{env.value}.yml", ConfigFormat.YAML),
            (f"environments/{env.value}.yaml", ConfigFormat.YAML),
            (f"environments/{env.value}.json", ConfigFormat.JSON),
        ]
        
        for filename, config_format in config_files:
            file_path = self.options.config_dir / filename
            if file_path.exists():
                try:
                    file_config = self._loaders[config_format].load(file_path)
                    config = self._deep_merge(config, file_config)
                    
                    # 更新元数据
                    metadata = ConfigMetadata(
                        file_path=file_path,
                        format=config_format,
                        environment=env,
                        last_modified=file_path.stat().st_mtime,
                        checksum=self._calculate_file_checksum(file_path)
                    )
                    self._metadata_cache[str(file_path)] = metadata
                    
                    self.logger.debug(f"已加载配置文件: {file_path}")
                except Exception as e:
                    self.logger.error(f"加载配置文件失败 {file_path}: {e}")
                    raise
        
        if not config:
            raise ConfigLoadError(f"未找到配置文件: {config_name}")
        
        return config
    
    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """深度合并字典"""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _resolve_environment_variables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """解析环境变量替换"""
        def resolve_value(value):
            if isinstance(value, str):
                # 匹配 ${VAR_NAME} 或 ${VAR_NAME:default_value} 格式
                pattern = r'\$\{([^}:]+)(?::([^}]*))?\}'
                
                def replace_var(match):
                    var_name = match.group(1)
                    default_value = match.group(2) if match.group(2) is not None else ""
                    return os.getenv(var_name, default_value)
                
                return re.sub(pattern, replace_var, value)
            elif isinstance(value, dict):
                return {k: resolve_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [resolve_value(item) for item in value]
            else:
                return value
        
        return resolve_value(config)
    
    def _decrypt_sensitive_fields(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """解密敏感字段"""
        if not self.encryption_manager:
            return config
        
        sensitive_patterns = [
            'password', 'secret', 'key', 'token', 'credential'
        ]
        
        def decrypt_value(value, key_path=""):
            if isinstance(value, str) and any(pattern in key_path.lower() for pattern in sensitive_patterns):
                try:
                    # 检查是否是加密数据（base64编码格式）
                    if value.startswith('enc:'):
                        return self.encryption_manager.decrypt(value[4:])
                except Exception:
                    pass  # 可能不是加密数据，保持原值
            elif isinstance(value, dict):
                return {k: decrypt_value(v, f"{key_path}.{k}" if key_path else k) for k, v in value.items()}
            elif isinstance(value, list):
                return [decrypt_value(item, key_path) for item in value]
            
            return value
        
        return decrypt_value(config)
    
    def get_config_value(self, 
                        key_path: str, 
                        default: Any = None,
                        config_name: str = "default",
                        environment: Optional[Environment] = None) -> Any:
        """
        获取配置值
        
        Args:
            key_path: 配置路径，如 'server.port'
            default: 默认值
            config_name: 配置文件名
            environment: 环境类型
            
        Returns:
            配置值
        """
        config = self.load_config(config_name, environment)
        return self._get_nested_value(config, key_path, default)
    
    def _get_nested_value(self, data: Dict[str, Any], path: str, default: Any = None) -> Any:
        """获取嵌套字典值"""
        keys = path.split('.')
        value = data
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """检查缓存是否有效"""
        if cache_key not in self._config_cache:
            return False
        
        # 检查相关文件是否被修改
        for file_path, metadata in self._metadata_cache.items():
            if Path(file_path).exists():
                current_mtime = Path(file_path).stat().st_mtime
                if current_mtime != metadata.last_modified:
                    return False
        
        return True
    
    def _calculate_file_checksum(self, file_path: Path) -> str:
        """计算文件校验和"""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def reload_config(self) -> None:
        """重新加载所有配置"""
        with self._lock:
            # 清除缓存
            self._config_cache.clear()
            self._metadata_cache.clear()
            
            self.logger.info("配置缓存已清除，将在下次访问时重新加载")
            
            # 通知变更回调
            for callback in self._change_callbacks:
                try:
                    callback()
                except Exception as e:
                    self.logger.error(f"配置变更回调失败: {e}")
    
    def add_change_callback(self, callback: Callable) -> None:
        """添加配置变更回调"""
        self._change_callbacks.append(callback)
    
    def get_environment_info(self) -> Dict[str, Any]:
        """获取环境信息"""
        return {
            "current_environment": self.options.environment.value,
            "config_directory": str(self.options.config_dir),
            "cache_enabled": self.options.cache_enabled,
            "auto_reload": self.options.auto_reload,
            "encryption_enabled": self.options.encryption_enabled,
            "validation_enabled": self.options.validation_enabled,
            "cached_configs": list(self._config_cache.keys()),
            "watched_files": len(self._metadata_cache),
            "active_observers": len(self._observers)
        }
    
    def clear_cache(self) -> None:
        """清除配置缓存"""
        with self._lock:
            self._config_cache.clear()
            self._metadata_cache.clear()
            self.logger.info("配置缓存已清除")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """清理资源"""
        # 停止文件监控
        for observer in self._observers:
            try:
                observer.stop()
                observer.join()
            except Exception as e:
                self.logger.error(f"停止文件监控失败: {e}")
        
        self.logger.info("配置管理器已关闭")


# 全局配置管理器实例
_global_config_manager: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """获取全局配置管理器实例"""
    global _global_config_manager
    if _global_config_manager is None:
        # 根据环境变量确定环境
        env_name = os.getenv('ZISHU_ENV', 'development').lower()
        try:
            environment = Environment(env_name)
        except ValueError:
            environment = Environment.DEVELOPMENT
        
        # 配置选项
        options = ConfigManagerOptions(
            config_dir=Path(os.getenv('ZISHU_CONFIG_DIR', 'config')),
            environment=environment,
            auto_reload=os.getenv('ZISHU_AUTO_RELOAD', 'true').lower() == 'true',
            cache_enabled=os.getenv('ZISHU_CACHE_ENABLED', 'true').lower() == 'true',
            encryption_enabled=os.getenv('ZISHU_ENCRYPTION_ENABLED', 'false').lower() == 'true',
            validation_enabled=os.getenv('ZISHU_VALIDATION_ENABLED', 'true').lower() == 'true',
        )
        
        _global_config_manager = ConfigManager(options)
    
    return _global_config_manager


def load_config(config_name: str = "default", **kwargs) -> Dict[str, Any]:
    """便捷函数：加载配置"""
    return get_config_manager().load_config(config_name, **kwargs)


def get_config_value(key_path: str, default: Any = None, **kwargs) -> Any:
    """便捷函数：获取配置值"""
    return get_config_manager().get_config_value(key_path, default, **kwargs)


# 配置管理器装饰器
def with_config(config_name: str = "default", environment: Optional[Environment] = None):
    """配置注入装饰器"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            config = load_config(config_name, environment=environment)
            return func(config, *args, **kwargs)
        return wrapper
    return decorator


if __name__ == "__main__":
    # 示例用法
    print("Zishu-sensei 配置管理系统")
    
    # 创建配置管理器
    options = ConfigManagerOptions(
        config_dir=Path("config"),
        environment=Environment.DEVELOPMENT,
        auto_reload=True,
        validation_enabled=True
    )
    
    with ConfigManager(options) as manager:
        try:
            # 加载配置
            config = manager.load_config("default")
            print(f"配置加载成功: {len(config)} 个配置项")
            
            # 获取特定配置值
            server_port = manager.get_config_value("server.port", 8080)
            print(f"服务器端口: {server_port}")
            
            # 环境信息
            env_info = manager.get_environment_info()
            print(f"环境信息: {env_info['current_environment']}")
            
        except Exception as e:
            print(f"配置管理错误: {e}")

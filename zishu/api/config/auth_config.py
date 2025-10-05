#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
认证配置 - 集中管理认证相关的配置和初始化
"""

import os
import secrets
from typing import Dict, Any, Optional, List
from datetime import timedelta
from dataclasses import dataclass, field
import logging

from ..utils.jwt_utils import JWTConfig
from ..utils.password_utils import PasswordPolicy
from ..utils.session_utils import SessionConfig
from ..security import SecurityConfig

logger = logging.getLogger(__name__)

@dataclass
class AuthConfig:
    """认证配置类"""
    
    # JWT配置
    jwt_secret_key: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    reset_token_expire_minutes: int = 15
    verification_token_expire_minutes: int = 5
    jwt_issuer: str = "zishu-sensei"
    jwt_audience: str = "zishu-users"
    
    # 密码策略配置
    password_min_length: int = 8
    password_max_length: int = 128
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_digits: bool = True
    password_require_special: bool = True
    password_special_chars: str = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    password_max_repeated_chars: int = 3
    password_min_unique_chars: int = 4
    password_prevent_common: bool = True
    password_prevent_personal_info: bool = True
    password_history_count: int = 5
    password_max_age_days: int = 90
    
    # 会话配置
    session_timeout_minutes: int = 60
    session_max_timeout_minutes: int = 480  # 8小时
    session_remember_me_days: int = 30
    session_max_concurrent: int = 5
    session_cleanup_interval: int = 3600  # 1小时
    session_track_location: bool = True
    session_require_device_verification: bool = False
    session_allow_sharing: bool = False
    
    # 安全配置
    security_encryption_key: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    security_max_login_attempts: int = 5
    security_lockout_duration: int = 900  # 15分钟
    security_enable_2fa: bool = True
    security_2fa_issuer: str = "Zishu Sensei"
    security_enable_device_tracking: bool = True
    security_suspicious_activity_threshold: int = 10
    
    # 速率限制配置
    rate_limit_default_limit: int = 100
    rate_limit_default_window: int = 3600  # 1小时
    rate_limit_auth_limit: int = 10
    rate_limit_auth_window: int = 900  # 15分钟
    rate_limit_api_limit: int = 1000
    rate_limit_api_window: int = 3600  # 1小时
    
    # 中间件配置
    middleware_excluded_paths: List[str] = field(default_factory=lambda: [
        "/docs", "/redoc", "/openapi.json",
        "/auth/login", "/auth/register", "/auth/forgot-password",
        "/health", "/ping", "/favicon.ico"
    ])
    
    # 审计配置
    audit_log_requests: bool = True
    audit_log_responses: bool = True
    audit_sensitive_paths: List[str] = field(default_factory=lambda: ["/auth", "/admin"])
    audit_exclude_paths: List[str] = field(default_factory=lambda: ["/health", "/ping", "/docs"])
    
    # 邮件配置（用于密码重置等）
    email_smtp_server: str = "smtp.gmail.com"
    email_smtp_port: int = 587
    email_username: str = ""
    email_password: str = ""
    email_from_address: str = "noreply@zishu-sensei.com"
    email_from_name: str = "Zishu Sensei"
    
    # 数据库配置
    db_session_table: str = "user_sessions"
    db_audit_table: str = "audit_logs"
    db_security_events_table: str = "security_events"
    
    # 缓存配置
    cache_enabled: bool = True
    cache_default_ttl: int = 300  # 5分钟
    cache_session_ttl: int = 3600  # 1小时
    cache_user_ttl: int = 1800  # 30分钟
    
    @classmethod
    def from_env(cls) -> 'AuthConfig':
        """从环境变量创建配置"""
        config = cls()
        
        # JWT配置
        config.jwt_secret_key = os.getenv("JWT_SECRET_KEY", config.jwt_secret_key)
        config.jwt_algorithm = os.getenv("JWT_ALGORITHM", config.jwt_algorithm)
        config.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", config.access_token_expire_minutes))
        config.refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", config.refresh_token_expire_days))
        
        # 密码策略
        config.password_min_length = int(os.getenv("PASSWORD_MIN_LENGTH", config.password_min_length))
        config.password_require_uppercase = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
        config.password_require_lowercase = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
        config.password_require_digits = os.getenv("PASSWORD_REQUIRE_DIGITS", "true").lower() == "true"
        config.password_require_special = os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
        
        # 会话配置
        config.session_timeout_minutes = int(os.getenv("SESSION_TIMEOUT_MINUTES", config.session_timeout_minutes))
        config.session_max_concurrent = int(os.getenv("SESSION_MAX_CONCURRENT", config.session_max_concurrent))
        
        # 安全配置
        config.security_encryption_key = os.getenv("SECURITY_ENCRYPTION_KEY", config.security_encryption_key)
        config.security_max_login_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", config.security_max_login_attempts))
        config.security_lockout_duration = int(os.getenv("LOCKOUT_DURATION", config.security_lockout_duration))
        config.security_enable_2fa = os.getenv("ENABLE_2FA", "true").lower() == "true"
        
        # 邮件配置
        config.email_smtp_server = os.getenv("EMAIL_SMTP_SERVER", config.email_smtp_server)
        config.email_smtp_port = int(os.getenv("EMAIL_SMTP_PORT", config.email_smtp_port))
        config.email_username = os.getenv("EMAIL_USERNAME", config.email_username)
        config.email_password = os.getenv("EMAIL_PASSWORD", config.email_password)
        config.email_from_address = os.getenv("EMAIL_FROM_ADDRESS", config.email_from_address)
        
        return config
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            field.name: getattr(self, field.name)
            for field in self.__dataclass_fields__.values()
        }
    
    def get_jwt_config(self) -> JWTConfig:
        """获取JWT配置"""
        return JWTConfig(
            secret_key=self.jwt_secret_key,
            algorithm=self.jwt_algorithm,
            access_token_expire_minutes=self.access_token_expire_minutes,
            refresh_token_expire_days=self.refresh_token_expire_days,
            reset_token_expire_minutes=self.reset_token_expire_minutes,
            verification_token_expire_minutes=self.verification_token_expire_minutes,
            issuer=self.jwt_issuer,
            audience=self.jwt_audience
        )
    
    def get_password_policy(self) -> PasswordPolicy:
        """获取密码策略"""
        return PasswordPolicy(
            min_length=self.password_min_length,
            max_length=self.password_max_length,
            require_uppercase=self.password_require_uppercase,
            require_lowercase=self.password_require_lowercase,
            require_digits=self.password_require_digits,
            require_special=self.password_require_special,
            special_chars=self.password_special_chars,
            max_repeated_chars=self.password_max_repeated_chars,
            min_unique_chars=self.password_min_unique_chars,
            prevent_common_passwords=self.password_prevent_common,
            prevent_personal_info=self.password_prevent_personal_info,
            password_history_count=self.password_history_count,
            max_age_days=self.password_max_age_days
        )
    
    def get_session_config(self) -> SessionConfig:
        """获取会话配置"""
        return SessionConfig(
            default_timeout_minutes=self.session_timeout_minutes,
            max_timeout_minutes=self.session_max_timeout_minutes,
            remember_me_days=self.session_remember_me_days,
            max_concurrent_sessions=self.session_max_concurrent,
            session_cleanup_interval=self.session_cleanup_interval,
            track_location=self.session_track_location,
            require_device_verification=self.session_require_device_verification,
            allow_session_sharing=self.session_allow_sharing
        )
    
    def get_security_config(self) -> SecurityConfig:
        """获取安全配置"""
        return SecurityConfig(
            encryption_key=self.security_encryption_key,
            max_login_attempts=self.security_max_login_attempts,
            lockout_duration=self.security_lockout_duration,
            enable_2fa=self.security_enable_2fa,
            totp_issuer=self.security_2fa_issuer,
            enable_device_tracking=self.security_enable_device_tracking,
            suspicious_activity_threshold=self.security_suspicious_activity_threshold
        )
    
    def get_rate_limit_config(self) -> Dict[str, Dict[str, int]]:
        """获取速率限制配置"""
        return {
            "default": {
                "limit": self.rate_limit_default_limit,
                "window": self.rate_limit_default_window
            },
            "auth": {
                "limit": self.rate_limit_auth_limit,
                "window": self.rate_limit_auth_window
            },
            "api": {
                "limit": self.rate_limit_api_limit,
                "window": self.rate_limit_api_window
            }
        }
    
    def get_middleware_config(self) -> Dict[str, Any]:
        """获取中间件配置"""
        return {
            "excluded_paths": self.middleware_excluded_paths,
            "rate_limit": self.get_rate_limit_config(),
            "audit": {
                "log_requests": self.audit_log_requests,
                "log_responses": self.audit_log_responses,
                "sensitive_paths": self.audit_sensitive_paths,
                "exclude_paths": self.audit_exclude_paths
            }
        }
    
    def validate(self) -> List[str]:
        """验证配置"""
        errors = []
        
        # JWT配置验证
        if not self.jwt_secret_key or len(self.jwt_secret_key) < 32:
            errors.append("JWT密钥长度至少需要32个字符")
        
        if self.access_token_expire_minutes <= 0:
            errors.append("访问令牌过期时间必须大于0")
        
        if self.refresh_token_expire_days <= 0:
            errors.append("刷新令牌过期时间必须大于0")
        
        # 密码策略验证
        if self.password_min_length < 6:
            errors.append("密码最小长度不能小于6")
        
        if self.password_min_length > self.password_max_length:
            errors.append("密码最小长度不能大于最大长度")
        
        # 会话配置验证
        if self.session_timeout_minutes <= 0:
            errors.append("会话超时时间必须大于0")
        
        if self.session_max_concurrent <= 0:
            errors.append("最大并发会话数必须大于0")
        
        # 安全配置验证
        if not self.security_encryption_key or len(self.security_encryption_key) < 32:
            errors.append("安全加密密钥长度至少需要32个字符")
        
        if self.security_max_login_attempts <= 0:
            errors.append("最大登录尝试次数必须大于0")
        
        if self.security_lockout_duration <= 0:
            errors.append("锁定持续时间必须大于0")
        
        # 速率限制验证
        if self.rate_limit_default_limit <= 0:
            errors.append("默认速率限制必须大于0")
        
        if self.rate_limit_default_window <= 0:
            errors.append("默认速率限制窗口必须大于0")
        
        return errors

class AuthConfigManager:
    """认证配置管理器"""
    
    def __init__(self, config: Optional[AuthConfig] = None):
        self.config = config or AuthConfig.from_env()
        self._validate_config()
    
    def _validate_config(self):
        """验证配置"""
        errors = self.config.validate()
        if errors:
            error_msg = "认证配置错误:\n" + "\n".join(f"- {error}" for error in errors)
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info("认证配置验证通过")
    
    def get_config(self) -> AuthConfig:
        """获取配置"""
        return self.config
    
    def update_config(self, **kwargs):
        """更新配置"""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
            else:
                logger.warning(f"未知配置项: {key}")
        
        self._validate_config()
    
    def reload_from_env(self):
        """从环境变量重新加载配置"""
        self.config = AuthConfig.from_env()
        self._validate_config()
    
    def export_config(self, format: str = "dict") -> Any:
        """导出配置"""
        if format == "dict":
            return self.config.to_dict()
        elif format == "json":
            import json
            return json.dumps(self.config.to_dict(), indent=2, default=str)
        elif format == "yaml":
            try:
                import yaml
                return yaml.dump(self.config.to_dict(), default_flow_style=False)
            except ImportError:
                logger.error("PyYAML未安装，无法导出YAML格式")
                return None
        else:
            raise ValueError(f"不支持的导出格式: {format}")

# 全局配置实例
_auth_config_manager: Optional[AuthConfigManager] = None

def get_auth_config() -> AuthConfig:
    """获取全局认证配置"""
    global _auth_config_manager
    if _auth_config_manager is None:
        _auth_config_manager = AuthConfigManager()
    return _auth_config_manager.get_config()

def set_auth_config(config: AuthConfig):
    """设置全局认证配置"""
    global _auth_config_manager
    _auth_config_manager = AuthConfigManager(config)

def reload_auth_config():
    """重新加载认证配置"""
    global _auth_config_manager
    if _auth_config_manager:
        _auth_config_manager.reload_from_env()
    else:
        _auth_config_manager = AuthConfigManager()

# 配置预设
class AuthConfigPresets:
    """认证配置预设"""
    
    @staticmethod
    def development() -> AuthConfig:
        """开发环境配置"""
        config = AuthConfig()
        config.access_token_expire_minutes = 120  # 2小时
        config.session_timeout_minutes = 120
        config.security_max_login_attempts = 10
        config.security_lockout_duration = 300  # 5分钟
        config.password_min_length = 6
        config.password_require_special = False
        config.audit_log_requests = False
        config.audit_log_responses = False
        return config
    
    @staticmethod
    def production() -> AuthConfig:
        """生产环境配置"""
        config = AuthConfig()
        config.access_token_expire_minutes = 30  # 30分钟
        config.session_timeout_minutes = 30
        config.security_max_login_attempts = 3
        config.security_lockout_duration = 1800  # 30分钟
        config.password_min_length = 12
        config.password_require_special = True
        config.security_enable_2fa = True
        config.session_require_device_verification = True
        config.audit_log_requests = True
        config.audit_log_responses = True
        return config
    
    @staticmethod
    def testing() -> AuthConfig:
        """测试环境配置"""
        config = AuthConfig()
        config.access_token_expire_minutes = 5  # 5分钟
        config.session_timeout_minutes = 5
        config.security_max_login_attempts = 100
        config.security_lockout_duration = 1  # 1秒
        config.password_min_length = 4
        config.password_require_uppercase = False
        config.password_require_lowercase = False
        config.password_require_digits = False
        config.password_require_special = False
        config.audit_log_requests = False
        config.audit_log_responses = False
        return config

# 示例用法
if __name__ == "__main__":
    # 创建开发环境配置
    dev_config = AuthConfigPresets.development()
    print("开发环境配置:")
    print(f"- 访问令牌过期时间: {dev_config.access_token_expire_minutes}分钟")
    print(f"- 密码最小长度: {dev_config.password_min_length}")
    print(f"- 最大登录尝试: {dev_config.security_max_login_attempts}")
    
    # 验证配置
    errors = dev_config.validate()
    if errors:
        print("配置错误:", errors)
    else:
        print("配置验证通过")
    
    # 创建配置管理器
    config_manager = AuthConfigManager(dev_config)
    
    # 导出配置
    config_dict = config_manager.export_config("dict")
    print(f"\n配置项数量: {len(config_dict)}")
    
    # 获取子配置
    jwt_config = dev_config.get_jwt_config()
    print(f"\nJWT配置:")
    print(f"- 算法: {jwt_config.algorithm}")
    print(f"- 访问令牌过期: {jwt_config.access_token_expire_minutes}分钟")
    print(f"- 刷新令牌过期: {jwt_config.refresh_token_expire_days}天")

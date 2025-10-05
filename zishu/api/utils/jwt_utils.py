#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
JWT工具类 - 处理JSON Web Token的生成、验证和管理
"""

import jwt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Union
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class TokenType(Enum):
    """令牌类型"""
    ACCESS = "access"
    REFRESH = "refresh"
    RESET = "reset"
    VERIFICATION = "verification"

class JWTConfig:
    """JWT配置类"""
    
    def __init__(
        self,
        secret_key: str,
        algorithm: str = "HS256",
        access_token_expire_minutes: int = 60,
        refresh_token_expire_days: int = 30,
        reset_token_expire_minutes: int = 15,
        verification_token_expire_minutes: int = 5,
        issuer: str = "zishu-sensei",
        audience: str = "zishu-users"
    ):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.refresh_token_expire_days = refresh_token_expire_days
        self.reset_token_expire_minutes = reset_token_expire_minutes
        self.verification_token_expire_minutes = verification_token_expire_minutes
        self.issuer = issuer
        self.audience = audience

class JWTManager:
    """JWT管理器"""
    
    def __init__(self, config: JWTConfig):
        self.config = config
        self._revoked_tokens = set()  # 简单的内存撤销列表（生产环境应使用Redis）
    
    def create_access_token(
        self,
        user_id: str,
        session_id: str,
        permissions: List[str],
        security_level: str,
        expires_delta: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """创建访问令牌"""
        if expires_delta is None:
            expires_delta = timedelta(minutes=self.config.access_token_expire_minutes)
        
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "user_id": user_id,
            "session_id": session_id,
            "permissions": permissions,
            "security_level": security_level,
            "type": TokenType.ACCESS.value,
            "iat": now,
            "exp": expire,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "jti": secrets.token_hex(16)  # JWT ID for revocation
        }
        
        token = jwt.encode(payload, self.config.secret_key, algorithm=self.config.algorithm)
        
        return {
            "token": token,
            "token_type": "bearer",
            "expires_in": int(expires_delta.total_seconds()),
            "expires_at": expire,
            "jti": payload["jti"]
        }
    
    def create_refresh_token(
        self,
        user_id: str,
        session_id: str,
        expires_delta: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """创建刷新令牌"""
        if expires_delta is None:
            expires_delta = timedelta(days=self.config.refresh_token_expire_days)
        
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "user_id": user_id,
            "session_id": session_id,
            "type": TokenType.REFRESH.value,
            "iat": now,
            "exp": expire,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "jti": secrets.token_hex(16)
        }
        
        token = jwt.encode(payload, self.config.secret_key, algorithm=self.config.algorithm)
        
        return {
            "token": token,
            "expires_in": int(expires_delta.total_seconds()),
            "expires_at": expire,
            "jti": payload["jti"]
        }
    
    def create_reset_token(self, user_id: str, email: str) -> Dict[str, Any]:
        """创建密码重置令牌"""
        expires_delta = timedelta(minutes=self.config.reset_token_expire_minutes)
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "user_id": user_id,
            "email": email,
            "type": TokenType.RESET.value,
            "iat": now,
            "exp": expire,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "jti": secrets.token_hex(16)
        }
        
        token = jwt.encode(payload, self.config.secret_key, algorithm=self.config.algorithm)
        
        return {
            "token": token,
            "expires_in": int(expires_delta.total_seconds()),
            "expires_at": expire,
            "jti": payload["jti"]
        }
    
    def create_verification_token(
        self,
        user_id: str,
        verification_type: str,
        target: str
    ) -> Dict[str, Any]:
        """创建验证令牌"""
        expires_delta = timedelta(minutes=self.config.verification_token_expire_minutes)
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "user_id": user_id,
            "verification_type": verification_type,
            "target": target,
            "type": TokenType.VERIFICATION.value,
            "iat": now,
            "exp": expire,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "jti": secrets.token_hex(16)
        }
        
        token = jwt.encode(payload, self.config.secret_key, algorithm=self.config.algorithm)
        
        return {
            "token": token,
            "expires_in": int(expires_delta.total_seconds()),
            "expires_at": expire,
            "jti": payload["jti"]
        }
    
    def verify_token(
        self,
        token: str,
        expected_type: Optional[TokenType] = None
    ) -> Optional[Dict[str, Any]]:
        """验证令牌"""
        try:
            # 解码令牌
            payload = jwt.decode(
                token,
                self.config.secret_key,
                algorithms=[self.config.algorithm],
                audience=self.config.audience,
                issuer=self.config.issuer
            )
            
            # 检查令牌类型
            if expected_type and payload.get("type") != expected_type.value:
                logger.warning(f"令牌类型不匹配: 期望 {expected_type.value}, 实际 {payload.get('type')}")
                return None
            
            # 检查是否已撤销
            jti = payload.get("jti")
            if jti and jti in self._revoked_tokens:
                logger.warning(f"令牌已撤销: {jti}")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("令牌已过期")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"无效令牌: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"令牌验证错误: {str(e)}")
            return None
    
    def refresh_access_token(
        self,
        refresh_token: str,
        new_permissions: Optional[List[str]] = None,
        new_security_level: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """使用刷新令牌创建新的访问令牌"""
        # 验证刷新令牌
        payload = self.verify_token(refresh_token, TokenType.REFRESH)
        if not payload:
            return None
        
        user_id = payload["user_id"]
        session_id = payload["session_id"]
        
        # 使用原有或新的权限和安全级别
        permissions = new_permissions or payload.get("permissions", [])
        security_level = new_security_level or payload.get("security_level", "standard")
        
        # 创建新的访问令牌
        return self.create_access_token(
            user_id=user_id,
            session_id=session_id,
            permissions=permissions,
            security_level=security_level
        )
    
    def revoke_token(self, token: str) -> bool:
        """撤销令牌"""
        try:
            payload = jwt.decode(
                token,
                self.config.secret_key,
                algorithms=[self.config.algorithm],
                options={"verify_exp": False}  # 允许过期令牌
            )
            
            jti = payload.get("jti")
            if jti:
                self._revoked_tokens.add(jti)
                logger.info(f"令牌已撤销: {jti}")
                return True
            
        except Exception as e:
            logger.error(f"撤销令牌失败: {str(e)}")
        
        return False
    
    def revoke_user_tokens(self, user_id: str) -> int:
        """撤销用户的所有令牌（需要从数据库获取）"""
        # TODO: 实现从数据库获取用户所有令牌并撤销
        # 这里只是示例实现
        count = 0
        tokens_to_revoke = []  # 从数据库获取用户的所有活跃令牌
        
        for token in tokens_to_revoke:
            if self.revoke_token(token):
                count += 1
        
        logger.info(f"撤销用户 {user_id} 的 {count} 个令牌")
        return count
    
    def is_token_revoked(self, jti: str) -> bool:
        """检查令牌是否已撤销"""
        return jti in self._revoked_tokens
    
    def cleanup_revoked_tokens(self):
        """清理过期的撤销令牌"""
        # TODO: 实现基于时间的清理逻辑
        # 可以定期运行此方法清理已过期的撤销令牌
        pass
    
    def get_token_info(self, token: str) -> Optional[Dict[str, Any]]:
        """获取令牌信息（不验证有效性）"""
        try:
            payload = jwt.decode(
                token,
                self.config.secret_key,
                algorithms=[self.config.algorithm],
                options={
                    "verify_signature": False,
                    "verify_exp": False,
                    "verify_aud": False,
                    "verify_iss": False
                }
            )
            
            return {
                "user_id": payload.get("user_id"),
                "session_id": payload.get("session_id"),
                "type": payload.get("type"),
                "permissions": payload.get("permissions", []),
                "security_level": payload.get("security_level"),
                "issued_at": payload.get("iat"),
                "expires_at": payload.get("exp"),
                "jti": payload.get("jti"),
                "is_revoked": self.is_token_revoked(payload.get("jti", ""))
            }
            
        except Exception as e:
            logger.error(f"获取令牌信息失败: {str(e)}")
            return None

class TokenPair:
    """令牌对类"""
    
    def __init__(
        self,
        access_token_data: Dict[str, Any],
        refresh_token_data: Dict[str, Any]
    ):
        self.access_token = access_token_data["token"]
        self.access_token_jti = access_token_data["jti"]
        self.access_expires_at = access_token_data["expires_at"]
        self.access_expires_in = access_token_data["expires_in"]
        
        self.refresh_token = refresh_token_data["token"]
        self.refresh_token_jti = refresh_token_data["jti"]
        self.refresh_expires_at = refresh_token_data["expires_at"]
        self.refresh_expires_in = refresh_token_data["expires_in"]
        
        self.token_type = "bearer"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "token_type": self.token_type,
            "expires_in": self.access_expires_in,
            "expires_at": self.access_expires_at.isoformat(),
            "refresh_expires_in": self.refresh_expires_in,
            "refresh_expires_at": self.refresh_expires_at.isoformat()
        }

def create_token_pair(
    jwt_manager: JWTManager,
    user_id: str,
    session_id: str,
    permissions: List[str],
    security_level: str,
    access_expires_delta: Optional[timedelta] = None,
    refresh_expires_delta: Optional[timedelta] = None
) -> TokenPair:
    """创建令牌对"""
    access_token_data = jwt_manager.create_access_token(
        user_id=user_id,
        session_id=session_id,
        permissions=permissions,
        security_level=security_level,
        expires_delta=access_expires_delta
    )
    
    refresh_token_data = jwt_manager.create_refresh_token(
        user_id=user_id,
        session_id=session_id,
        expires_delta=refresh_expires_delta
    )
    
    return TokenPair(access_token_data, refresh_token_data)

# 工具函数
def extract_token_from_header(authorization_header: str) -> Optional[str]:
    """从Authorization头中提取令牌"""
    if not authorization_header:
        return None
    
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]

def generate_secure_secret(length: int = 32) -> str:
    """生成安全的密钥"""
    return secrets.token_urlsafe(length)

def validate_jwt_config(config: JWTConfig) -> List[str]:
    """验证JWT配置"""
    errors = []
    
    if not config.secret_key or len(config.secret_key) < 32:
        errors.append("密钥长度至少需要32个字符")
    
    if config.access_token_expire_minutes <= 0:
        errors.append("访问令牌过期时间必须大于0")
    
    if config.refresh_token_expire_days <= 0:
        errors.append("刷新令牌过期时间必须大于0")
    
    if config.algorithm not in ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512"]:
        errors.append("不支持的算法")
    
    return errors

# 示例用法
if __name__ == "__main__":
    # 创建JWT配置
    config = JWTConfig(
        secret_key=generate_secure_secret(),
        access_token_expire_minutes=60,
        refresh_token_expire_days=30
    )
    
    # 验证配置
    config_errors = validate_jwt_config(config)
    if config_errors:
        print("配置错误:", config_errors)
        exit(1)
    
    # 创建JWT管理器
    jwt_manager = JWTManager(config)
    
    # 创建令牌对
    token_pair = create_token_pair(
        jwt_manager=jwt_manager,
        user_id="user_123",
        session_id="session_456",
        permissions=["read", "write"],
        security_level="standard"
    )
    
    print("令牌对创建成功:")
    print(f"访问令牌: {token_pair.access_token[:50]}...")
    print(f"刷新令牌: {token_pair.refresh_token[:50]}...")
    
    # 验证访问令牌
    payload = jwt_manager.verify_token(token_pair.access_token, TokenType.ACCESS)
    if payload:
        print("访问令牌验证成功")
        print(f"用户ID: {payload['user_id']}")
        print(f"权限: {payload['permissions']}")
    else:
        print("访问令牌验证失败")

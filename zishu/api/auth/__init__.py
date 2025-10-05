#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
认证系统初始化模块 - 集成所有认证组件
"""

import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from ..config.auth_config import AuthConfig, get_auth_config
from ..security import SecurityManager
from ..utils.jwt_utils import JWTManager
from ..utils.password_utils import PasswordManager
from ..utils.session_utils import SessionManager
from ..middleware.auth_middleware import AuthMiddleware
from ..utils.auth_decorators import set_security_manager

logger = logging.getLogger(__name__)

class AuthSystem:
    """认证系统主类 - 集成所有认证组件"""
    
    def __init__(self, config: Optional[AuthConfig] = None):
        self.config = config or get_auth_config()
        
        # 初始化各个组件
        self._jwt_manager: Optional[JWTManager] = None
        self._password_manager: Optional[PasswordManager] = None
        self._session_manager: Optional[SessionManager] = None
        self._security_manager: Optional[SecurityManager] = None
        self._auth_middleware: Optional[AuthMiddleware] = None
        
        self._initialized = False
    
    async def initialize(self):
        """初始化认证系统"""
        if self._initialized:
            logger.warning("认证系统已经初始化")
            return
        
        try:
            logger.info("开始初始化认证系统...")
            
            # 初始化JWT管理器
            jwt_config = self.config.get_jwt_config()
            self._jwt_manager = JWTManager(jwt_config)
            logger.info("JWT管理器初始化完成")
            
            # 初始化密码管理器
            password_policy = self.config.get_password_policy()
            self._password_manager = PasswordManager(password_policy)
            logger.info("密码管理器初始化完成")
            
            # 初始化会话管理器
            session_config = self.config.get_session_config()
            self._session_manager = SessionManager(session_config)
            logger.info("会话管理器初始化完成")
            
            # 初始化安全管理器
            security_config = self.config.get_security_config()
            self._security_manager = SecurityManager(
                jwt_manager=self._jwt_manager,
                password_manager=self._password_manager,
                session_manager=self._session_manager,
                config=security_config
            )
            logger.info("安全管理器初始化完成")
            
            # 设置全局安全管理器（用于装饰器）
            set_security_manager(self._security_manager)
            
            # 初始化认证中间件
            middleware_config = self.config.get_middleware_config()
            self._auth_middleware = AuthMiddleware(
                security_manager=self._security_manager,
                config=middleware_config
            )
            logger.info("认证中间件初始化完成")
            
            self._initialized = True
            logger.info("认证系统初始化完成")
            
        except Exception as e:
            logger.error(f"认证系统初始化失败: {str(e)}")
            raise
    
    async def cleanup(self):
        """清理认证系统资源"""
        if not self._initialized:
            return
        
        try:
            logger.info("开始清理认证系统...")
            
            # 清理会话
            if self._session_manager:
                cleanup_count = self._session_manager.cleanup_expired_sessions()
                logger.info(f"清理了 {cleanup_count} 个过期会话")
            
            # 清理其他资源
            # TODO: 添加其他清理逻辑
            
            self._initialized = False
            logger.info("认证系统清理完成")
            
        except Exception as e:
            logger.error(f"认证系统清理失败: {str(e)}")
    
    @property
    def jwt_manager(self) -> JWTManager:
        """获取JWT管理器"""
        if not self._initialized:
            raise RuntimeError("认证系统未初始化")
        return self._jwt_manager
    
    @property
    def password_manager(self) -> PasswordManager:
        """获取密码管理器"""
        if not self._initialized:
            raise RuntimeError("认证系统未初始化")
        return self._password_manager
    
    @property
    def session_manager(self) -> SessionManager:
        """获取会话管理器"""
        if not self._initialized:
            raise RuntimeError("认证系统未初始化")
        return self._session_manager
    
    @property
    def security_manager(self) -> SecurityManager:
        """获取安全管理器"""
        if not self._initialized:
            raise RuntimeError("认证系统未初始化")
        return self._security_manager
    
    @property
    def auth_middleware(self) -> AuthMiddleware:
        """获取认证中间件"""
        if not self._initialized:
            raise RuntimeError("认证系统未初始化")
        return self._auth_middleware
    
    def get_middleware(self):
        """获取中间件（用于FastAPI应用）"""
        return self.auth_middleware.middleware
    
    def get_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        if not self._initialized:
            return {"status": "not_initialized"}
        
        try:
            # 获取会话统计
            session_stats = self._session_manager.get_session_stats()
            
            # 获取安全统计
            security_stats = {}
            if hasattr(self._security_manager, 'get_security_stats'):
                security_stats = self._security_manager.get_security_stats()
            
            return {
                "status": "initialized",
                "config": {
                    "jwt_algorithm": self.config.jwt_algorithm,
                    "session_timeout": self.config.session_timeout_minutes,
                    "max_login_attempts": self.config.security_max_login_attempts,
                    "enable_2fa": self.config.security_enable_2fa
                },
                "session_stats": session_stats,
                "security_stats": security_stats,
                "components": {
                    "jwt_manager": self._jwt_manager is not None,
                    "password_manager": self._password_manager is not None,
                    "session_manager": self._session_manager is not None,
                    "security_manager": self._security_manager is not None,
                    "auth_middleware": self._auth_middleware is not None
                }
            }
        except Exception as e:
            logger.error(f"获取系统状态失败: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }

# 全局认证系统实例
_auth_system: Optional[AuthSystem] = None

async def get_auth_system() -> AuthSystem:
    """获取全局认证系统实例"""
    global _auth_system
    if _auth_system is None:
        _auth_system = AuthSystem()
        await _auth_system.initialize()
    return _auth_system

async def initialize_auth_system(config: Optional[AuthConfig] = None) -> AuthSystem:
    """初始化全局认证系统"""
    global _auth_system
    if _auth_system is not None:
        await _auth_system.cleanup()
    
    _auth_system = AuthSystem(config)
    await _auth_system.initialize()
    return _auth_system

async def cleanup_auth_system():
    """清理全局认证系统"""
    global _auth_system
    if _auth_system is not None:
        await _auth_system.cleanup()
        _auth_system = None

@asynccontextmanager
async def auth_system_context(config: Optional[AuthConfig] = None):
    """认证系统上下文管理器"""
    auth_system = None
    try:
        auth_system = await initialize_auth_system(config)
        yield auth_system
    finally:
        if auth_system:
            await auth_system.cleanup()

# FastAPI集成辅助函数
def setup_auth_for_fastapi(app, config: Optional[AuthConfig] = None):
    """为FastAPI应用设置认证系统"""
    
    @app.on_event("startup")
    async def startup_auth():
        """启动时初始化认证系统"""
        try:
            await initialize_auth_system(config)
            logger.info("FastAPI认证系统启动完成")
        except Exception as e:
            logger.error(f"FastAPI认证系统启动失败: {str(e)}")
            raise
    
    @app.on_event("shutdown")
    async def shutdown_auth():
        """关闭时清理认证系统"""
        try:
            await cleanup_auth_system()
            logger.info("FastAPI认证系统关闭完成")
        except Exception as e:
            logger.error(f"FastAPI认证系统关闭失败: {str(e)}")
    
    # 添加中间件
    @app.middleware("http")
    async def auth_middleware(request, call_next):
        """认证中间件"""
        auth_system = await get_auth_system()
        return await auth_system.auth_middleware.middleware(request, call_next)

# 便捷函数
async def create_user_session(
    user_id: str,
    ip_address: str,
    user_agent: str,
    remember_me: bool = False
) -> Dict[str, Any]:
    """创建用户会话"""
    auth_system = await get_auth_system()
    
    # 创建会话
    session = auth_system.session_manager.create_session(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        remember_me=remember_me
    )
    
    # 创建JWT令牌
    access_token = auth_system.jwt_manager.create_access_token(
        user_id=user_id,
        session_id=session.session_id
    )
    
    refresh_token = auth_system.jwt_manager.create_refresh_token(
        user_id=user_id,
        session_id=session.session_id
    )
    
    return {
        "session_id": session.session_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": session.expires_at.isoformat(),
        "device_type": session.device_type.value
    }

async def validate_user_token(token: str, ip_address: str) -> Optional[Dict[str, Any]]:
    """验证用户令牌"""
    try:
        auth_system = await get_auth_system()
        
        # 验证JWT令牌
        context = auth_system.jwt_manager.validate_access_token(token)
        if not context:
            return None
        
        # 验证会话
        session = auth_system.session_manager.validate_session(
            context.session_id,
            ip_address
        )
        
        if not session:
            return None
        
        return {
            "user_id": context.user_id,
            "session_id": context.session_id,
            "permissions": context.permissions,
            "security_level": context.security_level,
            "session_info": session.to_dict()
        }
        
    except Exception as e:
        logger.error(f"令牌验证失败: {str(e)}")
        return None

async def refresh_user_token(refresh_token: str) -> Optional[Dict[str, str]]:
    """刷新用户令牌"""
    try:
        auth_system = await get_auth_system()
        
        # 验证刷新令牌
        context = auth_system.jwt_manager.validate_refresh_token(refresh_token)
        if not context:
            return None
        
        # 刷新会话
        if not auth_system.session_manager.refresh_session(context.session_id):
            return None
        
        # 创建新的访问令牌
        new_access_token = auth_system.jwt_manager.create_access_token(
            user_id=context.user_id,
            session_id=context.session_id
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        logger.error(f"令牌刷新失败: {str(e)}")
        return None

async def terminate_user_session(session_id: str, reason: str = "user_logout") -> bool:
    """终止用户会话"""
    try:
        auth_system = await get_auth_system()
        return auth_system.session_manager.terminate_session(session_id, reason)
    except Exception as e:
        logger.error(f"会话终止失败: {str(e)}")
        return False

async def validate_password(password: str, user_info: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """验证密码强度"""
    try:
        auth_system = await get_auth_system()
        return auth_system.password_manager.validate_password(password, user_info)
    except Exception as e:
        logger.error(f"密码验证失败: {str(e)}")
        return {"valid": False, "errors": ["密码验证失败"]}

async def hash_password(password: str) -> str:
    """加密密码"""
    try:
        auth_system = await get_auth_system()
        return auth_system.password_manager.hash_password(password)
    except Exception as e:
        logger.error(f"密码加密失败: {str(e)}")
        raise ValueError("密码加密失败")

async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        auth_system = await get_auth_system()
        return auth_system.password_manager.verify_password(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"密码验证失败: {str(e)}")
        return False

# 导出主要组件和函数
__all__ = [
    "AuthSystem",
    "get_auth_system",
    "initialize_auth_system",
    "cleanup_auth_system",
    "auth_system_context",
    "setup_auth_for_fastapi",
    "create_user_session",
    "validate_user_token",
    "refresh_user_token",
    "terminate_user_session",
    "validate_password",
    "hash_password",
    "verify_password"
]

# 示例用法
if __name__ == "__main__":
    import asyncio
    from ..config.auth_config import AuthConfigPresets
    
    async def main():
        # 使用开发环境配置
        config = AuthConfigPresets.development()
        
        # 创建认证系统
        async with auth_system_context(config) as auth_system:
            print("认证系统初始化完成")
            
            # 获取系统状态
            status = auth_system.get_status()
            print(f"系统状态: {status['status']}")
            print(f"组件状态: {status['components']}")
            
            # 测试密码验证
            password_result = await validate_password("TestPassword123!")
            print(f"密码验证结果: {password_result}")
            
            # 测试密码加密
            hashed = await hash_password("TestPassword123!")
            print(f"密码已加密: {hashed[:20]}...")
            
            # 测试密码验证
            is_valid = await verify_password("TestPassword123!", hashed)
            print(f"密码验证通过: {is_valid}")
            
            # 测试会话创建
            session_data = await create_user_session(
                user_id="test_user",
                ip_address="127.0.0.1",
                user_agent="Test Agent"
            )
            print(f"会话创建成功: {session_data['session_id']}")
            
            # 测试令牌验证
            token_data = await validate_user_token(
                session_data["access_token"],
                "127.0.0.1"
            )
            print(f"令牌验证成功: {token_data is not None}")
    
    # 运行示例
    asyncio.run(main())

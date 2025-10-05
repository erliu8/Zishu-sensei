#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
认证装饰器 - 提供各种认证和授权装饰器
"""

import functools
import logging
from typing import List, Optional, Callable, Any, Dict, Union
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN, HTTP_429_TOO_MANY_REQUESTS

logger = logging.getLogger(__name__)

# 全局安全管理器实例（应该通过依赖注入设置）
_security_manager = None

def set_security_manager(security_manager):
    """设置全局安全管理器"""
    global _security_manager
    _security_manager = security_manager

def get_security_manager():
    """获取安全管理器"""
    return _security_manager

# HTTP Bearer 认证方案
security = HTTPBearer()

class AuthenticationError(HTTPException):
    """认证错误"""
    def __init__(self, detail: str = "认证失败"):
        super().__init__(status_code=HTTP_401_UNAUTHORIZED, detail=detail)

class AuthorizationError(HTTPException):
    """授权错误"""
    def __init__(self, detail: str = "权限不足"):
        super().__init__(status_code=HTTP_403_FORBIDDEN, detail=detail)

class RateLimitError(HTTPException):
    """速率限制错误"""
    def __init__(self, detail: str = "请求过于频繁"):
        super().__init__(status_code=HTTP_429_TOO_MANY_REQUESTS, detail=detail)

def require_auth(
    permissions: Optional[List[str]] = None,
    roles: Optional[List[str]] = None,
    security_level: Optional[str] = None,
    allow_api_key: bool = False,
    require_verified: bool = False
):
    """
    认证装饰器
    
    Args:
        permissions: 所需权限列表
        roles: 所需角色列表
        security_level: 所需安全级别
        allow_api_key: 是否允许API密钥认证
        require_verified: 是否要求已验证用户
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 从参数中获取request对象
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # 尝试从kwargs获取
                request = kwargs.get('request')
            
            if not request:
                raise AuthenticationError("无法获取请求对象")
            
            # 执行认证检查
            user_context = await _authenticate_request(
                request, allow_api_key, require_verified
            )
            
            # 执行授权检查
            await _authorize_request(
                user_context, permissions, roles, security_level
            )
            
            # 将用户上下文添加到kwargs
            kwargs['current_user'] = user_context
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_permissions(*permissions: str):
    """权限检查装饰器"""
    return require_auth(permissions=list(permissions))

def require_roles(*roles: str):
    """角色检查装饰器"""
    return require_auth(roles=list(roles))

def require_admin():
    """管理员权限装饰器"""
    return require_auth(roles=["admin"])

def require_verified_user():
    """已验证用户装饰器"""
    return require_auth(require_verified=True)

def rate_limit(
    limit: int,
    window: int = 3600,
    key_func: Optional[Callable] = None,
    error_message: str = "请求过于频繁，请稍后再试"
):
    """
    速率限制装饰器
    
    Args:
        limit: 限制次数
        window: 时间窗口（秒）
        key_func: 自定义键函数
        error_message: 错误消息
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取request对象
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            if not request:
                raise RateLimitError("无法获取请求对象")
            
            # 生成限制键
            if key_func:
                rate_key = key_func(request)
            else:
                rate_key = f"rate_limit:{request.client.host}:{func.__name__}"
            
            # 检查速率限制
            security_manager = get_security_manager()
            if security_manager and hasattr(security_manager, 'rate_limiter'):
                if not security_manager.rate_limiter.is_allowed(rate_key, limit, window):
                    raise RateLimitError(error_message)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def audit_log(
    action: str,
    resource: Optional[str] = None,
    sensitive: bool = False
):
    """
    审计日志装饰器
    
    Args:
        action: 操作名称
        resource: 资源名称
        sensitive: 是否为敏感操作
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取request和用户信息
            request = None
            current_user = None
            
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            current_user = kwargs.get('current_user')
            
            # 记录审计日志
            if request:
                await _log_audit_event(
                    request, current_user, action, resource, sensitive
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def security_headers():
    """安全头装饰器"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)
            
            # 添加安全头
            if hasattr(response, 'headers'):
                response.headers["X-Content-Type-Options"] = "nosniff"
                response.headers["X-Frame-Options"] = "DENY"
                response.headers["X-XSS-Protection"] = "1; mode=block"
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
                response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            
            return response
        
        return wrapper
    return decorator

def validate_input(
    schema: Optional[Any] = None,
    sanitize: bool = True
):
    """
    输入验证装饰器
    
    Args:
        schema: 验证模式
        sanitize: 是否清理输入
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 这里可以添加输入验证逻辑
            # 例如：XSS防护、SQL注入防护等
            
            if sanitize:
                # 清理输入数据
                kwargs = _sanitize_input(kwargs)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_https():
    """HTTPS要求装饰器"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取request对象
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            if request and not request.url.scheme == "https":
                # 在生产环境中应该强制HTTPS
                logger.warning(f"非HTTPS请求: {request.url}")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def cache_response(
    ttl: int = 300,
    key_func: Optional[Callable] = None,
    vary_on_user: bool = True
):
    """
    响应缓存装饰器
    
    Args:
        ttl: 缓存时间（秒）
        key_func: 自定义缓存键函数
        vary_on_user: 是否按用户区分缓存
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"cache:{func.__name__}"
                
                if vary_on_user:
                    current_user = kwargs.get('current_user')
                    if current_user:
                        cache_key += f":{current_user.user_id}"
            
            # 尝试从缓存获取
            security_manager = get_security_manager()
            if security_manager and hasattr(security_manager, 'cache'):
                cached_result = security_manager.cache.get(cache_key)
                if cached_result is not None:
                    return cached_result
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 缓存结果
            if security_manager and hasattr(security_manager, 'cache'):
                security_manager.cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator

# 依赖注入函数
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None
) -> Dict[str, Any]:
    """获取当前用户（用于FastAPI依赖注入）"""
    if not credentials:
        raise AuthenticationError("缺少认证凭据")
    
    try:
        # 验证JWT令牌
        security_manager = get_security_manager()
        if not security_manager:
            raise AuthenticationError("安全管理器未初始化")
        
        context = security_manager.validate_jwt_token(credentials.credentials)
        if not context:
            raise AuthenticationError("无效的认证令牌")
        
        # 验证会话
        if request:
            client_ip = request.client.host
            valid_context = security_manager.validate_session(
                context.session_id, client_ip
            )
            
            if not valid_context:
                raise AuthenticationError("会话已失效")
        
        return {
            "user_id": context.user_id,
            "session_id": context.session_id,
            "permissions": context.permissions,
            "security_level": context.security_level,
            "context": context
        }
        
    except Exception as e:
        logger.error(f"用户认证失败: {str(e)}")
        raise AuthenticationError("认证失败")

async def get_current_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """获取当前管理员用户"""
    from ..security import PermissionType
    
    context = current_user.get("context")
    if not context or PermissionType.ADMIN not in context.permissions:
        raise AuthorizationError("需要管理员权限")
    
    return current_user

async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """获取可选用户（不强制认证）"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, request)
    except HTTPException:
        return None

# 内部辅助函数
async def _authenticate_request(
    request: Request,
    allow_api_key: bool = False,
    require_verified: bool = False
) -> Dict[str, Any]:
    """认证请求"""
    # 获取认证头
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("缺少认证头")
    
    # 检查Bearer令牌
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        return await _validate_jwt_token(request, token, require_verified)
    
    # 检查API密钥
    elif allow_api_key and auth_header.startswith("ApiKey "):
        api_key = auth_header.split(" ")[1]
        return await _validate_api_key(request, api_key)
    
    else:
        raise AuthenticationError("不支持的认证方式")

async def _validate_jwt_token(
    request: Request,
    token: str,
    require_verified: bool = False
) -> Dict[str, Any]:
    """验证JWT令牌"""
    security_manager = get_security_manager()
    if not security_manager:
        raise AuthenticationError("安全管理器未初始化")
    
    # 验证令牌
    context = security_manager.validate_jwt_token(token)
    if not context:
        raise AuthenticationError("无效的认证令牌")
    
    # 验证会话
    client_ip = request.client.host
    valid_context = security_manager.validate_session(context.session_id, client_ip)
    if not valid_context:
        raise AuthenticationError("会话已失效")
    
    # 检查用户验证状态
    if require_verified and not context.is_verified:
        raise AuthenticationError("需要已验证的用户")
    
    return {
        "user_id": context.user_id,
        "session_id": context.session_id,
        "permissions": context.permissions,
        "security_level": context.security_level,
        "is_verified": context.is_verified,
        "context": context
    }

async def _validate_api_key(request: Request, api_key: str) -> Dict[str, Any]:
    """验证API密钥"""
    security_manager = get_security_manager()
    if not security_manager:
        raise AuthenticationError("安全管理器未初始化")
    
    # TODO: 实现API密钥验证逻辑
    # 这里应该从数据库验证API密钥
    
    raise AuthenticationError("API密钥认证暂未实现")

async def _authorize_request(
    user_context: Dict[str, Any],
    permissions: Optional[List[str]] = None,
    roles: Optional[List[str]] = None,
    security_level: Optional[str] = None
):
    """授权检查"""
    context = user_context.get("context")
    if not context:
        raise AuthorizationError("缺少用户上下文")
    
    # 检查权限
    if permissions:
        user_permissions = set(context.permissions)
        required_permissions = set(permissions)
        
        if not required_permissions.issubset(user_permissions):
            missing = required_permissions - user_permissions
            raise AuthorizationError(f"缺少权限: {', '.join(missing)}")
    
    # 检查角色
    if roles:
        # TODO: 实现角色检查逻辑
        pass
    
    # 检查安全级别
    if security_level:
        if context.security_level != security_level:
            raise AuthorizationError(f"需要安全级别: {security_level}")

async def _log_audit_event(
    request: Request,
    current_user: Optional[Dict[str, Any]],
    action: str,
    resource: Optional[str],
    sensitive: bool
):
    """记录审计事件"""
    user_id = current_user.get("user_id") if current_user else "anonymous"
    
    audit_data = {
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent", ""),
        "path": request.url.path,
        "method": request.method,
        "sensitive": sensitive,
        "timestamp": logger.handlers[0].formatter.formatTime(logger.makeRecord(
            logger.name, logging.INFO, "", 0, "", (), None
        )) if logger.handlers else None
    }
    
    logger.info(f"审计事件: {audit_data}")

def _sanitize_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """清理输入数据"""
    # 简化的输入清理
    sanitized = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            # 基本的XSS防护
            value = value.replace("<script", "&lt;script")
            value = value.replace("javascript:", "")
            value = value.replace("onload=", "")
            value = value.replace("onerror=", "")
        
        sanitized[key] = value
    
    return sanitized

# 组合装饰器
def secure_endpoint(
    permissions: Optional[List[str]] = None,
    roles: Optional[List[str]] = None,
    rate_limit_config: Optional[Dict[str, int]] = None,
    audit_action: Optional[str] = None,
    require_https: bool = True
):
    """安全端点装饰器（组合多个安全检查）"""
    def decorator(func: Callable) -> Callable:
        # 应用多个装饰器
        wrapped_func = func
        
        # 认证和授权
        if permissions or roles:
            wrapped_func = require_auth(permissions=permissions, roles=roles)(wrapped_func)
        
        # 速率限制
        if rate_limit_config:
            wrapped_func = rate_limit(**rate_limit_config)(wrapped_func)
        
        # 审计日志
        if audit_action:
            wrapped_func = audit_log(audit_action)(wrapped_func)
        
        # 安全头
        wrapped_func = security_headers()(wrapped_func)
        
        # HTTPS检查
        if require_https:
            wrapped_func = require_https()(wrapped_func)
        
        return wrapped_func
    
    return decorator

# 示例用法
if __name__ == "__main__":
    from fastapi import FastAPI
    
    app = FastAPI()
    
    @app.get("/protected")
    @require_auth(permissions=["read"])
    async def protected_endpoint(request: Request, current_user: Dict[str, Any]):
        return {"message": f"Hello {current_user['user_id']}"}
    
    @app.get("/admin")
    @require_admin()
    async def admin_endpoint(request: Request, current_user: Dict[str, Any]):
        return {"message": "Admin only"}
    
    @app.post("/api/data")
    @secure_endpoint(
        permissions=["write"],
        rate_limit_config={"limit": 10, "window": 60},
        audit_action="create_data"
    )
    async def create_data(request: Request, current_user: Dict[str, Any]):
        return {"message": "Data created"}

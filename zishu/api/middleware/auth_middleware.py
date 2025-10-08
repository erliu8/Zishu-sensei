#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
认证中间件 - 提供请求级别的认证和授权
"""

import time
from typing import Callable, Optional, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.status import (
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_429_TOO_MANY_REQUESTS,
)
import logging

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """认证中间件"""

    def __init__(
        self,
        app,
        security_manager=None,
        excluded_paths: Optional[list] = None,
        rate_limit_config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(app)
        self.security_manager = security_manager
        self.excluded_paths = excluded_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/auth/login",
            "/auth/register",
            "/auth/forgot-password",
            "/health",
            "/ping",
        ]
        self.rate_limit_config = rate_limit_config or {
            "default": {"limit": 100, "window": 3600},  # 100 requests per hour
            "auth": {"limit": 10, "window": 900},  # 10 auth requests per 15 min
            "api": {"limit": 1000, "window": 3600},  # 1000 API calls per hour
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        start_time = time.time()

        try:
            # 检查是否为排除路径
            if self._is_excluded_path(request.url.path):
                response = await call_next(request)
                return self._add_security_headers(response, start_time)

            # 速率限制检查
            if not await self._check_rate_limit(request):
                return JSONResponse(
                    status_code=HTTP_429_TOO_MANY_REQUESTS,
                    content={"error": "rate_limit_exceeded", "message": "请求过于频繁，请稍后再试"},
                )

            # 认证检查
            auth_result = await self._authenticate_request(request)
            if not auth_result["success"]:
                return JSONResponse(
                    status_code=HTTP_401_UNAUTHORIZED,
                    content={
                        "error": "authentication_required",
                        "message": auth_result["message"],
                    },
                )

            # 将认证信息添加到请求状态
            request.state.user = auth_result["user"]
            request.state.security_context = auth_result["context"]

            # 继续处理请求
            response = await call_next(request)

            # 添加安全头
            return self._add_security_headers(response, start_time)

        except Exception as e:
            logger.error(f"认证中间件错误: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"error": "authentication_error", "message": "认证过程中发生错误"},
            )

    def _is_excluded_path(self, path: str) -> bool:
        """检查是否为排除路径"""
        return any(path.startswith(excluded) for excluded in self.excluded_paths)

    async def _check_rate_limit(self, request: Request) -> bool:
        """检查速率限制"""
        if not self.security_manager:
            return True

        client_ip = request.client.host
        path = request.url.path

        # 确定限制类型
        if path.startswith("/auth"):
            limit_type = "auth"
        elif path.startswith("/api"):
            limit_type = "api"
        else:
            limit_type = "default"

        config = self.rate_limit_config[limit_type]
        rate_key = f"rate_limit:{limit_type}:{client_ip}"

        return self.security_manager.rate_limiter.is_allowed(
            rate_key, config["limit"], config["window"]
        )

    async def _authenticate_request(self, request: Request) -> Dict[str, Any]:
        """认证请求"""
        # 获取认证头
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"success": False, "message": "缺少认证令牌"}

        try:
            token = auth_header.split(" ")[1]

            if self.security_manager:
                # 验证JWT令牌
                context = self.security_manager.validate_jwt_token(token)
                if not context:
                    return {"success": False, "message": "无效的认证令牌"}

                # 验证会话
                client_ip = request.client.host
                valid_context = self.security_manager.validate_session(
                    context.session_id, client_ip
                )

                if not valid_context:
                    return {"success": False, "message": "会话已失效"}

                return {
                    "success": True,
                    "user": {"user_id": context.user_id},
                    "context": context,
                }
            else:
                # 如果没有安全管理器，返回模拟认证结果
                return {
                    "success": True,
                    "user": {"user_id": "test_user"},
                    "context": None,
                }

        except Exception as e:
            logger.error(f"令牌验证错误: {str(e)}")
            return {"success": False, "message": "令牌验证失败"}

    def _add_security_headers(self, response: Response, start_time: float) -> Response:
        """添加安全响应头"""
        # 安全头
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers[
            "Strict-Transport-Security"
        ] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 处理时间
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)

        # CORS头（如果需要）
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers[
            "Access-Control-Allow-Methods"
        ] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"

        return response


class PermissionMiddleware(BaseHTTPMiddleware):
    """权限检查中间件"""

    def __init__(self, app, permission_config: Optional[Dict[str, Any]] = None):
        super().__init__(app)
        self.permission_config = permission_config or {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """权限检查"""
        # 获取用户上下文
        security_context = getattr(request.state, "security_context", None)
        if not security_context:
            # 如果没有认证信息，跳过权限检查（由认证中间件处理）
            return await call_next(request)

        # 检查路径权限
        path = request.url.path
        method = request.method

        required_permission = self._get_required_permission(path, method)
        if required_permission and not self._has_permission(
            security_context, required_permission
        ):
            return JSONResponse(
                status_code=HTTP_403_FORBIDDEN,
                content={
                    "error": "insufficient_permissions",
                    "message": f"缺少必要权限: {required_permission}",
                },
            )

        return await call_next(request)

    def _get_required_permission(self, path: str, method: str) -> Optional[str]:
        """获取路径所需权限"""
        # 简化的权限配置
        permission_map = {
            "/auth/users": {
                "GET": "admin:users:read",
                "POST": "admin:users:create",
                "PUT": "admin:users:update",
                "DELETE": "admin:users:delete",
            },
            "/api/models": {
                "GET": "model:read",
                "POST": "model:create",
                "PUT": "model:update",
                "DELETE": "model:delete",
            },
        }

        # 匹配路径权限
        for pattern, methods in permission_map.items():
            if path.startswith(pattern):
                return methods.get(method)

        return None

    def _has_permission(self, security_context, required_permission: str) -> bool:
        """检查用户是否有指定权限"""
        if not security_context or not hasattr(security_context, "permissions"):
            return False

        # 管理员拥有所有权限
        from ..security import PermissionType

        if PermissionType.ADMIN in security_context.permissions:
            return True

        # TODO: 实现更复杂的权限检查逻辑
        return True  # 临时返回True


class AuditMiddleware(BaseHTTPMiddleware):
    """审计日志中间件"""

    def __init__(self, app, audit_config: Optional[Dict[str, Any]] = None):
        super().__init__(app)
        self.audit_config = audit_config or {
            "log_requests": True,
            "log_responses": True,
            "sensitive_paths": ["/auth", "/admin"],
            "exclude_paths": ["/health", "/ping", "/docs"],
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """审计日志记录"""
        start_time = time.time()

        # 记录请求
        if self._should_audit(request.url.path):
            await self._log_request(request, start_time)

        # 处理请求
        response = await call_next(request)

        # 记录响应
        if self._should_audit(request.url.path):
            await self._log_response(request, response, start_time)

        return response

    def _should_audit(self, path: str) -> bool:
        """判断是否需要审计"""
        # 排除路径
        for exclude in self.audit_config.get("exclude_paths", []):
            if path.startswith(exclude):
                return False

        # 敏感路径必须审计
        for sensitive in self.audit_config.get("sensitive_paths", []):
            if path.startswith(sensitive):
                return True

        return self.audit_config.get("log_requests", False)

    async def _log_request(self, request: Request, start_time: float):
        """记录请求日志"""
        user_id = getattr(request.state, "user", {}).get("user_id", "anonymous")
        client_ip = request.client.host

        audit_data = {
            "timestamp": start_time,
            "user_id": user_id,
            "ip_address": client_ip,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "user_agent": request.headers.get("user-agent", ""),
            "event_type": "request",
        }

        # 敏感信息过滤
        if request.url.path.startswith("/auth"):
            audit_data["sensitive"] = True

        logger.info(f"API请求: {audit_data}")

    async def _log_response(
        self, request: Request, response: Response, start_time: float
    ):
        """记录响应日志"""
        end_time = time.time()
        duration = end_time - start_time

        user_id = getattr(request.state, "user", {}).get("user_id", "anonymous")

        audit_data = {
            "timestamp": end_time,
            "user_id": user_id,
            "ip_address": request.client.host,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "event_type": "response",
        }

        logger.info(f"API响应: {audit_data}")


class SecurityEventMiddleware(BaseHTTPMiddleware):
    """安全事件检测中间件"""

    def __init__(self, app, security_manager=None):
        super().__init__(app)
        self.security_manager = security_manager

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """安全事件检测"""
        # 检测可疑活动
        await self._detect_suspicious_activity(request)

        # 处理请求
        response = await call_next(request)

        # 检查响应中的安全问题
        await self._check_response_security(request, response)

        return response

    async def _detect_suspicious_activity(self, request: Request):
        """检测可疑活动"""
        if not self.security_manager:
            return

        client_ip = request.client.host
        user_id = getattr(request.state, "user", {}).get("user_id")

        # 检查IP黑名单
        if self.security_manager._is_ip_blocked(client_ip):
            logger.warning(f"阻止黑名单IP访问: {client_ip}")
            raise Exception("IP被阻止")

        # 检查可疑活动
        if self.security_manager.auditor.is_suspicious_activity(client_ip, user_id):
            logger.warning(f"检测到可疑活动: {client_ip} - {user_id}")

    async def _check_response_security(self, request: Request, response: Response):
        """检查响应安全性"""
        # 检查响应中是否包含敏感信息
        if response.status_code == 500:
            logger.error(f"服务器错误: {request.url.path} - {request.client.host}")

        # 检查认证失败
        if response.status_code == 401:
            client_ip = request.client.host
            user_id = getattr(request.state, "user", {}).get("user_id")

            if self.security_manager:
                self.security_manager._log_failed_attempt(
                    client_ip, user_id or "unknown", "auth_failure"
                )


# 中间件组合函数
def create_auth_middleware_stack(app, security_manager=None, config=None):
    """创建认证中间件堆栈"""
    config = config or {}

    # 按顺序添加中间件（注意顺序很重要）
    app.add_middleware(SecurityEventMiddleware, security_manager=security_manager)

    app.add_middleware(AuditMiddleware, audit_config=config.get("audit", {}))

    app.add_middleware(
        PermissionMiddleware, permission_config=config.get("permissions", {})
    )

    app.add_middleware(
        AuthenticationMiddleware,
        security_manager=security_manager,
        excluded_paths=config.get("excluded_paths"),
        rate_limit_config=config.get("rate_limit"),
    )

    return app

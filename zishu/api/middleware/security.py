"""
安全中间件模块
提供API安全相关的中间件，包括速率限制、安全头设置等
"""

import time
import hashlib
from typing import Dict, Optional, Callable, Any
from collections import defaultdict, deque
from datetime import datetime, timedelta
from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    安全中间件
    
    提供基础的安全功能：
    - 安全头设置
    - 请求大小限制
    - IP白名单/黑名单
    """
    
    def __init__(
        self,
        app,
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        allowed_hosts: Optional[list] = None,
        blocked_ips: Optional[set] = None,
        enable_security_headers: bool = True
    ):
        super().__init__(app)
        self.max_request_size = max_request_size
        self.allowed_hosts = set(allowed_hosts) if allowed_hosts else None
        self.blocked_ips = set(blocked_ips) if blocked_ips else set()
        self.enable_security_headers = enable_security_headers
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        
        # 检查IP黑名单
        client_ip = self._get_client_ip(request)
        if client_ip in self.blocked_ips:
            logger.warning(f"Blocked request from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Access denied", "message": "IP blocked"}
            )
        
        # 检查Host头
        if self.allowed_hosts:
            host = request.headers.get("host")
            if host not in self.allowed_hosts:
                logger.warning(f"Request from unauthorized host: {host}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": "Access denied", "message": "Host not allowed"}
                )
        
        # 检查请求大小
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_request_size:
            logger.warning(f"Request too large: {content_length} bytes")
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": "Request too large", "max_size": self.max_request_size}
            )
        
        # 处理请求
        response = await call_next(request)
        
        # 添加安全头
        if self.enable_security_headers:
            self._add_security_headers(response)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """获取客户端IP地址"""
        # 检查代理头
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _add_security_headers(self, response: Response) -> None:
        """添加安全头"""
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'",
        }
        
        for header, value in security_headers.items():
            response.headers[header] = value


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    速率限制中间件
    
    基于令牌桶算法实现的速率限制
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10,
        key_func: Optional[Callable[[Request], str]] = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.key_func = key_func or self._default_key_func
        
        # 存储每个客户端的令牌桶
        self.buckets: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "tokens": self.burst_size,
                "last_refill": time.time()
            }
        )
        
        # 清理过期的桶
        self.cleanup_interval = 300  # 5分钟
        self.last_cleanup = time.time()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        
        # 获取客户端标识
        client_key = self.key_func(request)
        
        # 检查速率限制
        if not self._allow_request(client_key):
            logger.warning(f"Rate limit exceeded for client: {client_key}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.requests_per_minute} requests per minute allowed",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        # 定期清理过期的桶
        self._cleanup_expired_buckets()
        
        response = await call_next(request)
        
        # 添加速率限制头
        bucket = self.buckets[client_key]
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, int(bucket["tokens"])))
        response.headers["X-RateLimit-Reset"] = str(int(bucket["last_refill"] + 60))
        
        return response
    
    def _default_key_func(self, request: Request) -> str:
        """默认的客户端标识函数"""
        client_ip = request.client.host if request.client else "unknown"
        
        # 检查代理头
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            client_ip = real_ip
        
        return f"ip:{client_ip}"
    
    def _allow_request(self, client_key: str) -> bool:
        """检查是否允许请求"""
        bucket = self.buckets[client_key]
        now = time.time()
        
        # 计算需要补充的令牌数
        time_passed = now - bucket["last_refill"]
        tokens_to_add = time_passed * (self.requests_per_minute / 60.0)
        
        # 更新令牌数，不超过桶的容量
        bucket["tokens"] = min(self.burst_size, bucket["tokens"] + tokens_to_add)
        bucket["last_refill"] = now
        
        # 检查是否有足够的令牌
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            return True
        
        return False
    
    def _cleanup_expired_buckets(self) -> None:
        """清理过期的令牌桶"""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return
        
        # 清理超过1小时未使用的桶
        expired_keys = [
            key for key, bucket in self.buckets.items()
            if now - bucket["last_refill"] > 3600
        ]
        
        for key in expired_keys:
            del self.buckets[key]
        
        self.last_cleanup = now
        
        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired rate limit buckets")


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    API密钥验证中间件
    """
    
    def __init__(
        self,
        app,
        api_keys: Dict[str, Dict[str, Any]],
        header_name: str = "X-API-Key",
        exempt_paths: Optional[set] = None
    ):
        super().__init__(app)
        self.api_keys = api_keys  # {key: {"name": "client_name", "permissions": []}}
        self.header_name = header_name
        self.exempt_paths = exempt_paths or {"/health", "/ping", "/docs", "/openapi.json"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        
        # 检查是否为豁免路径
        if request.url.path in self.exempt_paths:
            return await call_next(request)
        
        # 获取API密钥
        api_key = request.headers.get(self.header_name)
        if not api_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Missing API key", "message": f"API key required in {self.header_name} header"}
            )
        
        # 验证API密钥
        if api_key not in self.api_keys:
            logger.warning(f"Invalid API key used: {api_key[:8]}...")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid API key", "message": "The provided API key is not valid"}
            )
        
        # 将客户端信息添加到请求状态
        client_info = self.api_keys[api_key]
        request.state.client_name = client_info.get("name", "unknown")
        request.state.client_permissions = client_info.get("permissions", [])
        
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    请求日志中间件
    """
    
    def __init__(
        self,
        app,
        log_level: int = logging.INFO,
        include_request_body: bool = False,
        include_response_body: bool = False,
        max_body_size: int = 1024
    ):
        super().__init__(app)
        self.log_level = log_level
        self.include_request_body = include_request_body
        self.include_response_body = include_response_body
        self.max_body_size = max_body_size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        start_time = time.time()
        
        # 记录请求信息
        client_ip = self._get_client_ip(request)
        request_info = {
            "method": request.method,
            "url": str(request.url),
            "client_ip": client_ip,
            "user_agent": request.headers.get("user-agent", ""),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # 记录请求体（如果启用）
        if self.include_request_body and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if len(body) <= self.max_body_size:
                    request_info["request_body"] = body.decode("utf-8", errors="ignore")
                else:
                    request_info["request_body"] = f"<truncated, size: {len(body)} bytes>"
            except Exception as e:
                request_info["request_body"] = f"<error reading body: {e}>"
        
        # 处理请求
        try:
            response = await call_next(request)
            
            # 计算处理时间
            process_time = time.time() - start_time
            
            # 记录响应信息
            response_info = {
                **request_info,
                "status_code": response.status_code,
                "process_time_ms": round(process_time * 1000, 2)
            }
            
            # 记录响应体（如果启用）
            if self.include_response_body and hasattr(response, "body"):
                try:
                    if len(response.body) <= self.max_body_size:
                        response_info["response_body"] = response.body.decode("utf-8", errors="ignore")
                    else:
                        response_info["response_body"] = f"<truncated, size: {len(response.body)} bytes>"
                except Exception as e:
                    response_info["response_body"] = f"<error reading body: {e}>"
            
            # 根据状态码选择日志级别
            if response.status_code >= 500:
                log_level = logging.ERROR
            elif response.status_code >= 400:
                log_level = logging.WARNING
            else:
                log_level = self.log_level
            
            logger.log(log_level, f"Request processed", extra=response_info)
            
            # 添加处理时间头
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            error_info = {
                **request_info,
                "error": str(e),
                "process_time_ms": round(process_time * 1000, 2)
            }
            
            logger.error(f"Request failed", extra=error_info)
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """获取客户端IP地址"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF保护中间件
    """
    
    def __init__(
        self,
        app,
        secret_key: str,
        cookie_name: str = "csrf_token",
        header_name: str = "X-CSRF-Token",
        exempt_methods: Optional[set] = None,
        exempt_paths: Optional[set] = None
    ):
        super().__init__(app)
        self.secret_key = secret_key
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.exempt_methods = exempt_methods or {"GET", "HEAD", "OPTIONS", "TRACE"}
        self.exempt_paths = exempt_paths or {"/health", "/ping"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        
        # 检查是否为豁免方法或路径
        if (request.method in self.exempt_methods or 
            request.url.path in self.exempt_paths):
            return await call_next(request)
        
        # 获取CSRF令牌
        csrf_token = request.headers.get(self.header_name)
        csrf_cookie = request.cookies.get(self.cookie_name)
        
        if not csrf_token or not csrf_cookie:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "CSRF token missing", "message": "CSRF token required"}
            )
        
        # 验证CSRF令牌
        if not self._verify_csrf_token(csrf_token, csrf_cookie):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "CSRF token invalid", "message": "Invalid CSRF token"}
            )
        
        return await call_next(request)
    
    def _generate_csrf_token(self, session_id: str) -> str:
        """生成CSRF令牌"""
        timestamp = str(int(time.time()))
        data = f"{session_id}:{timestamp}:{self.secret_key}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def _verify_csrf_token(self, token: str, cookie: str) -> bool:
        """验证CSRF令牌"""
        try:
            # 简单的验证逻辑，实际应用中可能需要更复杂的验证
            expected_token = self._generate_csrf_token(cookie)
            return token == expected_token
        except Exception:
            return False


# 便捷函数
def create_security_middleware(
    max_request_size: int = 10 * 1024 * 1024,
    allowed_hosts: Optional[list] = None,
    blocked_ips: Optional[set] = None,
    enable_security_headers: bool = True
) -> SecurityMiddleware:
    """创建安全中间件"""
    return lambda app: SecurityMiddleware(
        app,
        max_request_size=max_request_size,
        allowed_hosts=allowed_hosts,
        blocked_ips=blocked_ips,
        enable_security_headers=enable_security_headers
    )


def create_rate_limit_middleware(
    requests_per_minute: int = 60,
    burst_size: int = 10,
    key_func: Optional[Callable[[Request], str]] = None
) -> RateLimitMiddleware:
    """创建速率限制中间件"""
    return lambda app: RateLimitMiddleware(
        app,
        requests_per_minute=requests_per_minute,
        burst_size=burst_size,
        key_func=key_func
    )


def create_api_key_middleware(
    api_keys: Dict[str, Dict[str, Any]],
    header_name: str = "X-API-Key",
    exempt_paths: Optional[set] = None
) -> APIKeyMiddleware:
    """创建API密钥中间件"""
    return lambda app: APIKeyMiddleware(
        app,
        api_keys=api_keys,
        header_name=header_name,
        exempt_paths=exempt_paths
    )


def create_request_logging_middleware(
    log_level: int = logging.INFO,
    include_request_body: bool = False,
    include_response_body: bool = False,
    max_body_size: int = 1024
) -> RequestLoggingMiddleware:
    """创建请求日志中间件"""
    return lambda app: RequestLoggingMiddleware(
        app,
        log_level=log_level,
        include_request_body=include_request_body,
        include_response_body=include_response_body,
        max_body_size=max_body_size
    )

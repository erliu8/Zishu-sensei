"""
日志中间件
记录每个请求和响应的详细信息
"""
import time
import json
from typing import Callable
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    请求日志中间件
    记录所有 HTTP 请求和响应的详细信息
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        exclude_paths: list[str] | None = None,
        log_request_body: bool = False,
        log_response_body: bool = False,
    ):
        """
        初始化日志中间件
        
        Args:
            app: ASGI 应用
            exclude_paths: 要排除的路径列表（不记录日志）
            log_request_body: 是否记录请求体
            log_response_body: 是否记录响应体
        """
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/redoc", "/openapi.json"]
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        # 检查是否需要排除此路径
        if self._should_exclude(request.url.path):
            return await call_next(request)
        
        # 生成请求 ID
        request_id = str(uuid4())
        request.state.request_id = request_id
        
        # 记录请求开始时间
        start_time = time.time()
        
        # 记录请求信息
        await self._log_request(request, request_id)
        
        # 处理请求
        try:
            response = await call_next(request)
        except Exception as e:
            # 记录异常
            process_time = time.time() - start_time
            logger.error(
                f"Request failed | "
                f"request_id={request_id} | "
                f"method={request.method} | "
                f"path={request.url.path} | "
                f"error={str(e)} | "
                f"process_time={process_time:.3f}s"
            )
            raise
        
        # 计算处理时间
        process_time = time.time() - start_time
        
        # 添加自定义响应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.3f}s"
        
        # 记录响应信息
        self._log_response(request, response, request_id, process_time)
        
        return response
    
    def _should_exclude(self, path: str) -> bool:
        """检查路径是否应该被排除"""
        return any(path.startswith(exclude_path) for exclude_path in self.exclude_paths)
    
    async def _log_request(self, request: Request, request_id: str):
        """记录请求信息"""
        # 基本信息
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_host": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        
        # 记录请求体（如果启用）
        if self.log_request_body and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if body:
                    # 尝试解析为 JSON
                    try:
                        body_json = json.loads(body)
                        # 隐藏敏感信息
                        if "password" in body_json:
                            body_json["password"] = "***HIDDEN***"
                        if "token" in body_json:
                            body_json["token"] = "***HIDDEN***"
                        log_data["request_body"] = body_json
                    except json.JSONDecodeError:
                        log_data["request_body"] = f"<non-json: {len(body)} bytes>"
            except Exception as e:
                logger.warning(f"Failed to read request body: {e}")
        
        logger.info(f"Request started | {self._format_log_data(log_data)}")
    
    def _log_response(
        self,
        request: Request,
        response: Response,
        request_id: str,
        process_time: float,
    ):
        """记录响应信息"""
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time": f"{process_time:.3f}s",
        }
        
        # 根据状态码选择日志级别
        if response.status_code >= 500:
            log_level = logging.ERROR
        elif response.status_code >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO
        
        logger.log(
            log_level,
            f"Request completed | {self._format_log_data(log_data)}"
        )
    
    @staticmethod
    def _format_log_data(data: dict) -> str:
        """格式化日志数据"""
        return " | ".join(f"{k}={v}" for k, v in data.items())


class PerformanceLoggingMiddleware(BaseHTTPMiddleware):
    """
    性能日志中间件
    记录慢请求和性能指标
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        slow_request_threshold: float = 1.0,  # 慢请求阈值（秒）
    ):
        """
        初始化性能日志中间件
        
        Args:
            app: ASGI 应用
            slow_request_threshold: 慢请求阈值（秒）
        """
        super().__init__(app)
        self.slow_request_threshold = slow_request_threshold
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # 记录慢请求
        if process_time > self.slow_request_threshold:
            logger.warning(
                f"Slow request detected | "
                f"method={request.method} | "
                f"path={request.url.path} | "
                f"process_time={process_time:.3f}s | "
                f"threshold={self.slow_request_threshold}s"
            )
        
        return response


def setup_logging(log_level: str = "INFO", log_format: str | None = None):
    """
    设置日志配置
    
    Args:
        log_level: 日志级别
        log_format: 日志格式
    """
    if log_format is None:
        log_format = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # 设置第三方库的日志级别
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


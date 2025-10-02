# -*- coding: utf-8 -*-
"""
日志中间件模块
提供请求日志记录和性能监控功能
"""
import time
import json
import uuid
import logging
from typing import Callable, Dict, Any, Optional
from datetime import datetime

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """基础日志中间件"""
    
    def __init__(
        self,
        app,
        logger_name: str = "api",
        log_level: str = "INFO",
        include_request_body: bool = False,
        include_response_body: bool = False,
        max_body_size: int = 1024
    ):
        super().__init__(app)
        self.logger = logging.getLogger(logger_name)
        self.log_level = getattr(logging, log_level.upper())
        self.include_request_body = include_request_body
        self.include_response_body = include_response_body
        self.max_body_size = max_body_size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求日志"""
        start_time = time.time()
        request_id = str(uuid.uuid4())
        
        # 记录请求开始
        await self._log_request_start(request, request_id)
        
        try:
            response = await call_next(request)
            
            # 记录请求完成
            process_time = time.time() - start_time
            await self._log_request_end(request, response, request_id, process_time)
            
            return response
            
        except Exception as e:
            # 记录请求错误
            process_time = time.time() - start_time
            await self._log_request_error(request, e, request_id, process_time)
            raise
    
    async def _log_request_start(self, request: Request, request_id: str):
        """记录请求开始"""
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "client_ip": request.client.host if request.client else None,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if self.include_request_body and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if len(body) <= self.max_body_size:
                    log_data["body"] = body.decode("utf-8")
                else:
                    log_data["body"] = f"<truncated: {len(body)} bytes>"
            except Exception:
                log_data["body"] = "<unable to read>"
        
        self.logger.log(self.log_level, f"Request started: {json.dumps(log_data)}")
    
    async def _log_request_end(self, request: Request, response: Response, request_id: str, process_time: float):
        """记录请求完成"""
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "process_time": round(process_time, 4),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if self.include_response_body and hasattr(response, 'body'):
            try:
                body = response.body
                if isinstance(body, bytes) and len(body) <= self.max_body_size:
                    log_data["response_body"] = body.decode("utf-8")
                elif isinstance(body, str) and len(body) <= self.max_body_size:
                    log_data["response_body"] = body
                else:
                    log_data["response_body"] = f"<truncated: {len(body)} bytes>"
            except Exception:
                log_data["response_body"] = "<unable to read>"
        
        self.logger.log(self.log_level, f"Request completed: {json.dumps(log_data)}")
    
    async def _log_request_error(self, request: Request, error: Exception, request_id: str, process_time: float):
        """记录请求错误"""
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "error": str(error),
            "error_type": type(error).__name__,
            "process_time": round(process_time, 4),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.error(f"Request failed: {json.dumps(log_data)}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    
    def __init__(
        self,
        app,
        log_requests: bool = True,
        log_responses: bool = True,
        log_errors: bool = True,
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.log_requests = log_requests
        self.log_responses = log_responses
        self.log_errors = log_errors
        self.exclude_paths = exclude_paths or ["/health", "/metrics"]
        self.logger = logging.getLogger("request_logger")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        # 检查是否需要排除
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        start_time = time.time()
        request_id = str(uuid.uuid4())
        
        # 添加请求ID到请求状态
        request.state.request_id = request_id
        
        if self.log_requests:
            self._log_request(request, request_id)
        
        try:
            response = await call_next(request)
            
            if self.log_responses:
                process_time = time.time() - start_time
                self._log_response(request, response, request_id, process_time)
            
            return response
            
        except Exception as e:
            if self.log_errors:
                process_time = time.time() - start_time
                self._log_error(request, e, request_id, process_time)
            raise
    
    def _log_request(self, request: Request, request_id: str):
        """记录请求信息"""
        self.logger.info(
            f"Request {request_id}: {request.method} {request.url.path} "
            f"from {request.client.host if request.client else 'unknown'}"
        )
    
    def _log_response(self, request: Request, response: Response, request_id: str, process_time: float):
        """记录响应信息"""
        self.logger.info(
            f"Response {request_id}: {response.status_code} "
            f"in {process_time:.4f}s"
        )
    
    def _log_error(self, request: Request, error: Exception, request_id: str, process_time: float):
        """记录错误信息"""
        self.logger.error(
            f"Error {request_id}: {type(error).__name__}: {str(error)} "
            f"after {process_time:.4f}s"
        )


class PerformanceLoggingMiddleware(BaseHTTPMiddleware):
    """性能日志中间件"""
    
    def __init__(
        self,
        app,
        slow_request_threshold: float = 1.0,
        log_all_requests: bool = False
    ):
        super().__init__(app)
        self.slow_request_threshold = slow_request_threshold
        self.log_all_requests = log_all_requests
        self.logger = logging.getLogger("performance_logger")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理性能监控"""
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # 记录慢请求或所有请求
        if process_time > self.slow_request_threshold or self.log_all_requests:
            self._log_performance(request, response, process_time)
        
        # 添加性能头
        response.headers["X-Process-Time"] = str(round(process_time, 4))
        
        return response
    
    def _log_performance(self, request: Request, response: Response, process_time: float):
        """记录性能信息"""
        level = logging.WARNING if process_time > self.slow_request_threshold else logging.INFO
        
        self.logger.log(
            level,
            f"Performance: {request.method} {request.url.path} "
            f"took {process_time:.4f}s (status: {response.status_code})"
        )


def setup_logging_middleware(
    app,
    enable_request_logging: bool = True,
    enable_performance_logging: bool = True,
    log_level: str = "INFO",
    slow_threshold: float = 1.0
):
    """设置日志中间件"""
    
    if enable_performance_logging:
        app.add_middleware(
            PerformanceLoggingMiddleware,
            slow_request_threshold=slow_threshold
        )
    
    if enable_request_logging:
        app.add_middleware(
            RequestLoggingMiddleware,
            log_requests=True,
            log_responses=True,
            log_errors=True
        )
    
    # 添加基础日志中间件
    app.add_middleware(
        LoggingMiddleware,
        logger_name="api",
        log_level=log_level
    )

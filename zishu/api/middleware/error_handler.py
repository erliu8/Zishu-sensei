# -*- coding: utf-8 -*-
"""
错误处理中间件模块
提供统一的错误处理和异常捕获功能
"""
import logging
import traceback
from typing import Callable, Dict, Any, Optional
from datetime import datetime

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """错误处理中间件"""
    
    def __init__(
        self,
        app,
        include_traceback: bool = False,
        log_errors: bool = True,
        custom_handlers: Optional[Dict[type, Callable]] = None
    ):
        super().__init__(app)
        self.include_traceback = include_traceback
        self.log_errors = log_errors
        self.custom_handlers = custom_handlers or {}
        self.logger = logging.getLogger("error_handler")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求并捕获异常"""
        try:
            response = await call_next(request)
            return response
            
        except HTTPException as e:
            # HTTP异常直接返回
            return await self._handle_http_exception(request, e)
            
        except Exception as e:
            # 其他异常统一处理
            return await self._handle_general_exception(request, e)
    
    async def _handle_http_exception(self, request: Request, exc: HTTPException) -> JSONResponse:
        """处理HTTP异常"""
        if self.log_errors and exc.status_code >= 500:
            self.logger.error(
                f"HTTP {exc.status_code} error on {request.method} {request.url.path}: {exc.detail}"
            )
        
        error_response = {
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "type": "HTTPException",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if hasattr(request.state, 'request_id'):
            error_response["error"]["request_id"] = request.state.request_id
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response
        )
    
    async def _handle_general_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """处理一般异常"""
        exc_type = type(exc)
        
        # 检查自定义处理器
        if exc_type in self.custom_handlers:
            return await self.custom_handlers[exc_type](request, exc)
        
        # 记录错误
        if self.log_errors:
            self.logger.error(
                f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}",
                exc_info=True
            )
        
        # 构建错误响应
        error_response = {
            "error": {
                "code": 500,
                "message": "Internal Server Error",
                "type": exc_type.__name__,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if hasattr(request.state, 'request_id'):
            error_response["error"]["request_id"] = request.state.request_id
        
        # 在开发模式下包含详细信息
        if self.include_traceback:
            error_response["error"]["detail"] = str(exc)
            error_response["error"]["traceback"] = traceback.format_exc()
        
        return JSONResponse(
            status_code=500,
            content=error_response
        )
    
    def add_custom_handler(self, exc_type: type, handler: Callable):
        """添加自定义异常处理器"""
        self.custom_handlers[exc_type] = handler


class ValidationErrorHandler:
    """验证错误处理器"""
    
    @staticmethod
    async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
        """处理验证错误"""
        error_response = {
            "error": {
                "code": 422,
                "message": "Validation Error",
                "type": "ValidationError",
                "detail": str(exc),
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if hasattr(request.state, 'request_id'):
            error_response["error"]["request_id"] = request.state.request_id
        
        return JSONResponse(
            status_code=422,
            content=error_response
        )


class TimeoutErrorHandler:
    """超时错误处理器"""
    
    @staticmethod
    async def handle_timeout_error(request: Request, exc: Exception) -> JSONResponse:
        """处理超时错误"""
        error_response = {
            "error": {
                "code": 408,
                "message": "Request Timeout",
                "type": "TimeoutError",
                "detail": "The request took too long to process",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if hasattr(request.state, 'request_id'):
            error_response["error"]["request_id"] = request.state.request_id
        
        return JSONResponse(
            status_code=408,
            content=error_response
        )


def setup_error_handler(
    app,
    include_traceback: bool = False,
    log_errors: bool = True
) -> ErrorHandlerMiddleware:
    """设置错误处理中间件"""
    
    # 创建错误处理中间件
    error_handler = ErrorHandlerMiddleware(
        app,
        include_traceback=include_traceback,
        log_errors=log_errors
    )
    
    # 添加自定义处理器
    error_handler.add_custom_handler(
        ValueError,
        ValidationErrorHandler.handle_validation_error
    )
    
    error_handler.add_custom_handler(
        TimeoutError,
        TimeoutErrorHandler.handle_timeout_error
    )
    
    # 添加到应用
    app.add_middleware(ErrorHandlerMiddleware, **{
        'include_traceback': include_traceback,
        'log_errors': log_errors,
        'custom_handlers': error_handler.custom_handlers
    })
    
    return error_handler

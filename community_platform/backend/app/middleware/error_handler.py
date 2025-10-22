"""
错误处理中间件
统一处理应用中的所有异常
"""
import traceback
import logging
from typing import Union

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError

from app.core.exceptions import BaseAPIException

logger = logging.getLogger(__name__)


async def custom_exception_handler(request: Request, exc: BaseAPIException) -> JSONResponse:
    """
    自定义异常处理器
    处理所有继承自 BaseAPIException 的异常
    """
    # 记录错误日志
    logger.error(
        f"API Exception | "
        f"path={request.url.path} | "
        f"method={request.method} | "
        f"error_code={exc.error_code} | "
        f"message={exc.message} | "
        f"status_code={exc.status_code}"
    )
    
    # 构建响应
    response_data = {
        "success": False,
        "error": {
            "code": exc.error_code,
            "message": exc.message,
            "details": exc.details,
        },
        "path": request.url.path,
        "method": request.method,
    }
    
    # 添加请求 ID（如果存在）
    if hasattr(request.state, "request_id"):
        response_data["request_id"] = request.state.request_id
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_data,
    )


async def validation_exception_handler(
    request: Request,
    exc: Union[RequestValidationError, ValidationError],
) -> JSONResponse:
    """
    验证异常处理器
    处理 Pydantic 验证错误
    """
    # 记录验证错误
    logger.warning(
        f"Validation Error | "
        f"path={request.url.path} | "
        f"method={request.method} | "
        f"errors={exc.errors()}"
    )
    
    # 格式化验证错误
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"],
        })
    
    response_data = {
        "success": False,
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "请求数据验证失败",
            "details": {
                "errors": errors,
            },
        },
        "path": request.url.path,
        "method": request.method,
    }
    
    # 添加请求 ID（如果存在）
    if hasattr(request.state, "request_id"):
        response_data["request_id"] = request.state.request_id
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_data,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    HTTP 异常处理器
    处理 FastAPI/Starlette 的 HTTP 异常
    """
    # 记录错误日志
    logger.warning(
        f"HTTP Exception | "
        f"path={request.url.path} | "
        f"method={request.method} | "
        f"status_code={exc.status_code} | "
        f"detail={exc.detail}"
    )
    
    response_data = {
        "success": False,
        "error": {
            "code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "details": {},
        },
        "path": request.url.path,
        "method": request.method,
    }
    
    # 添加请求 ID（如果存在）
    if hasattr(request.state, "request_id"):
        response_data["request_id"] = request.state.request_id
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_data,
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    通用异常处理器
    处理所有未被捕获的异常
    """
    # 记录详细的错误信息
    logger.error(
        f"Unhandled Exception | "
        f"path={request.url.path} | "
        f"method={request.method} | "
        f"error={str(exc)} | "
        f"traceback={traceback.format_exc()}"
    )
    
    # 在生产环境中隐藏详细错误信息
    from app.core.config.settings import settings
    
    error_message = "服务器内部错误"
    error_details = {}
    
    # 在开发环境中显示详细错误
    if settings.DEBUG:
        error_message = str(exc)
        error_details = {
            "type": exc.__class__.__name__,
            "traceback": traceback.format_exc().split("\n"),
        }
    
    response_data = {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": error_message,
            "details": error_details,
        },
        "path": request.url.path,
        "method": request.method,
    }
    
    # 添加请求 ID（如果存在）
    if hasattr(request.state, "request_id"):
        response_data["request_id"] = request.state.request_id
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_data,
    )


def register_exception_handlers(app):
    """
    注册所有异常处理器
    
    Args:
        app: FastAPI 应用实例
    """
    # 自定义异常
    app.add_exception_handler(BaseAPIException, custom_exception_handler)
    
    # 验证异常
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    
    # HTTP 异常
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    
    # 通用异常（捕获所有未处理的异常）
    app.add_exception_handler(Exception, general_exception_handler)
    
    logger.info("✅ Exception handlers registered")


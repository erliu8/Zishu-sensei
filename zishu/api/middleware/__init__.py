"""
中间件模块
提供各种中间件功能，包括CORS、安全、日志、错误处理等
"""

# CORS中间件
from .cors import setup_cors, get_cors_config

# 安全中间件
from .security import (
    SecurityMiddleware,
    RateLimitMiddleware,
    APIKeyMiddleware,
    RequestLoggingMiddleware as SecurityRequestLoggingMiddleware,
    CSRFProtectionMiddleware,
    create_security_middleware,
    create_rate_limit_middleware,
    create_api_key_middleware,
    create_request_logging_middleware,
)

# 日志中间件
from .logging import (
    LoggingMiddleware,
    RequestLoggingMiddleware,
    PerformanceLoggingMiddleware,
    setup_logging_middleware,
)

# 错误处理中间件
from .error_handler import (
    ErrorHandlerMiddleware,
    ValidationErrorHandler,
    TimeoutErrorHandler,
    setup_error_handler,
)

# 情绪处理中间件
from .emotion import (
    EmotionMiddleware,
    EmotionHTTPMiddleware,
    get_emotion_middleware,
    initialize_emotion_middleware,
    EmotionState,
    EmotionType,
    EmotionContext,
    EmotionIntensity,
)

__all__ = [
    # CORS
    "setup_cors",
    "get_cors_config",
    # 安全中间件
    "SecurityMiddleware",
    "RateLimitMiddleware",
    "APIKeyMiddleware",
    "SecurityRequestLoggingMiddleware",
    "CSRFProtectionMiddleware",
    "create_security_middleware",
    "create_rate_limit_middleware",
    "create_api_key_middleware",
    "create_request_logging_middleware",
    # 日志中间件
    "LoggingMiddleware",
    "RequestLoggingMiddleware",
    "PerformanceLoggingMiddleware",
    "setup_logging_middleware",
    # 错误处理中间件
    "ErrorHandlerMiddleware",
    "ValidationErrorHandler",
    "TimeoutErrorHandler",
    "setup_error_handler",
    # 情绪处理中间件
    "EmotionMiddleware",
    "EmotionHTTPMiddleware",
    "get_emotion_middleware",
    "initialize_emotion_middleware",
    "EmotionState",
    "EmotionType",
    "EmotionContext",
    "EmotionIntensity",
]

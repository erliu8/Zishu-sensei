"""
自定义异常类
"""
from typing import Any, Optional, Dict
from fastapi import status


class BaseAPIException(Exception):
    """API 异常基类"""
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)


# ==================== 认证相关异常 ====================

class AuthenticationException(BaseAPIException):
    """认证失败异常"""
    
    def __init__(self, message: str = "认证失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_FAILED",
            details=details,
        )


class InvalidCredentialsException(AuthenticationException):
    """无效凭证异常"""
    
    def __init__(self, message: str = "用户名或密码错误"):
        super().__init__(
            message=message,
            details={"error": "invalid_credentials"}
        )


class InvalidTokenException(AuthenticationException):
    """无效令牌异常"""
    
    def __init__(self, message: str = "无效的访问令牌"):
        super().__init__(
            message=message,
            details={"error": "invalid_token"}
        )


class TokenExpiredException(AuthenticationException):
    """令牌过期异常"""
    
    def __init__(self, message: str = "访问令牌已过期"):
        super().__init__(
            message=message,
            details={"error": "token_expired"}
        )


# ==================== 授权相关异常 ====================

class AuthorizationException(BaseAPIException):
    """授权失败异常"""
    
    def __init__(self, message: str = "权限不足", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_FAILED",
            details=details,
        )


class PermissionDeniedException(AuthorizationException):
    """权限拒绝异常"""
    
    def __init__(self, message: str = "您没有权限执行此操作"):
        super().__init__(
            message=message,
            details={"error": "permission_denied"}
        )


# ==================== 资源相关异常 ====================

class ResourceNotFoundException(BaseAPIException):
    """资源未找到异常"""
    
    def __init__(
        self,
        resource_type: str = "资源",
        resource_id: Optional[Any] = None,
        message: Optional[str] = None,
    ):
        if message is None:
            message = f"{resource_type}未找到"
            if resource_id:
                message += f": {resource_id}"
        
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class ResourceAlreadyExistsException(BaseAPIException):
    """资源已存在异常"""
    
    def __init__(
        self,
        resource_type: str = "资源",
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if message is None:
            message = f"{resource_type}已存在"
        
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="RESOURCE_ALREADY_EXISTS",
            details=details or {"resource_type": resource_type},
        )


class ResourceConflictException(BaseAPIException):
    """资源冲突异常"""
    
    def __init__(self, message: str = "资源冲突", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="RESOURCE_CONFLICT",
            details=details,
        )


# ==================== 验证相关异常 ====================

class ValidationException(BaseAPIException):
    """验证失败异常"""
    
    def __init__(self, message: str = "验证失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details,
        )


class InvalidInputException(ValidationException):
    """无效输入异常"""
    
    def __init__(self, field: str, message: str):
        super().__init__(
            message=f"字段 '{field}' {message}",
            details={"field": field, "error": message}
        )


# ==================== 业务逻辑异常 ====================

class BusinessLogicException(BaseAPIException):
    """业务逻辑异常"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BUSINESS_LOGIC_ERROR",
            details=details,
        )


class RateLimitException(BaseAPIException):
    """请求频率限制异常"""
    
    def __init__(
        self,
        message: str = "请求过于频繁，请稍后再试",
        retry_after: Optional[int] = None,
    ):
        details = {}
        if retry_after:
            details["retry_after"] = retry_after
        
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            details=details,
        )


# ==================== 数据库相关异常 ====================

class DatabaseException(BaseAPIException):
    """数据库异常"""
    
    def __init__(self, message: str = "数据库错误", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            details=details,
        )


class DatabaseConnectionException(DatabaseException):
    """数据库连接异常"""
    
    def __init__(self, message: str = "数据库连接失败"):
        super().__init__(
            message=message,
            details={"error": "connection_failed"}
        )


# ==================== 外部服务异常 ====================

class ExternalServiceException(BaseAPIException):
    """外部服务异常"""
    
    def __init__(
        self,
        service_name: str,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if message is None:
            message = f"外部服务 '{service_name}' 调用失败"
        
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="EXTERNAL_SERVICE_ERROR",
            details=details or {"service": service_name},
        )


class CacheException(ExternalServiceException):
    """缓存服务异常"""
    
    def __init__(self, message: str = "缓存服务错误", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            service_name="Redis",
            message=message,
            details=details,
        )


class VectorSearchException(ExternalServiceException):
    """向量搜索异常"""
    
    def __init__(self, message: str = "向量搜索服务错误", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            service_name="Qdrant",
            message=message,
            details=details,
        )


# ==================== 文件相关异常 ====================

class FileException(BaseAPIException):
    """文件异常基类"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="FILE_ERROR",
            details=details,
        )


class FileTooLargeException(FileException):
    """文件过大异常"""
    
    def __init__(self, max_size: int, actual_size: int):
        super().__init__(
            message=f"文件大小超过限制 (最大: {max_size} bytes, 实际: {actual_size} bytes)",
            details={"max_size": max_size, "actual_size": actual_size}
        )


class InvalidFileTypeException(FileException):
    """无效文件类型异常"""
    
    def __init__(self, file_type: str, allowed_types: list):
        super().__init__(
            message=f"不支持的文件类型: {file_type}",
            details={"file_type": file_type, "allowed_types": allowed_types}
        )


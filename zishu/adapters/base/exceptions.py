"""
适配器异常体系定义
"""

import traceback
from typing import Any, Dict, List, Optional, Union
from enum import Enum
from datetime import datetime


# ================================
# 异常严重级别枚举
# ================================


class ExceptionSeverity(Enum):
    """异常严重级别枚举"""

    LOW = "low"  # 低：不影响核心功能，可以继续运行
    MEDIUM = "medium"  # 中：影响部分功能，需要关注
    HIGH = "high"  # 高：影响主要功能，需要立即处理
    CRITICAL = "critical"  # 严重：系统性问题，需要紧急修复


class ErrorCode(Enum):
    """错误代码枚举"""

    # 基础错误 (1xxx)
    UNKNOWN_ERROR = 1000
    INITIALIZATION_ERROR = 1001
    CONFIGURATION_ERROR = 1002
    VALIDATION_ERROR = 1003

    # 适配器注册和管理错误 (2xxx)
    ADAPTER_NOT_FOUND = 2001
    ADAPTER_ALREADY_EXISTS = 2002
    ADAPTER_REGISTRATION_FAILED = 2003
    ADAPTER_LOADING_FAILED = 2004
    ADAPTER_UNLOADING_FAILED = 2005

    # 适配器执行错误 (3xxx)
    ADAPTER_EXECUTION_FAILED = 3001
    ADAPTER_TIMEOUT = 3002
    ADAPTER_INPUT_INVALID = 3003
    ADAPTER_OUTPUT_INVALID = 3004

    # 软适配器错误 (4xxx)
    RAG_ENGINE_ERROR = 4001
    PROMPT_TEMPLATE_ERROR = 4002
    KNOWLEDGE_BASE_ERROR = 4003
    RETRIEVAL_FAILED = 4004

    # 硬适配器错误 (5xxx)
    SYSTEM_OPERATION_FAILED = 5001
    FILE_OPERATION_FAILED = 5002
    DESKTOP_CONTROL_FAILED = 5003
    PERMISSION_DENIED = 5004

    # 智能硬适配器错误 (6xxx)
    CODE_GENERATION_FAILED = 6001
    CODE_EXECUTION_FAILED = 6002
    MODEL_LOADING_FAILED = 6003
    LEARNING_ENGINE_ERROR = 6004

    # 安全和权限错误 (7xxx)
    SECURITY_VIOLATION = 7001
    SANDBOX_BREACH = 7002
    UNAUTHORIZED_ACCESS = 7003
    AUDIT_LOG_FAILED = 7004

    # 资源和性能错误 (8xxx)
    RESOURCE_EXHAUSTED = 8001
    MEMORY_LIMIT_EXCEEDED = 8002
    CPU_LIMIT_EXCEEDED = 8003
    TIMEOUT_EXCEEDED = 8004

    # 网络和依赖错误 (9xxx)
    NETWORK_ERROR = 9001
    API_UNAVAILABLE = 9002
    DEPENDENCY_MISSING = 9003
    SERVICE_UNAVAILABLE = 9004


# ================================
# 基础异常类
# ================================


class BaseAdapterException(Exception):
    """
    适配器框架基础异常类

    所有适配器相关的异常都应该继承自这个类，提供统一的异常处理接口。

    Attributes:
        message (str): 异常消息
        error_code (ErrorCode): 错误代码
        severity (ExceptionSeverity): 异常严重级别
        context (Dict[str, Any]): 异常上下文信息
        timestamp (datetime): 异常发生时间
        adapter_id (Optional[str]): 相关的适配器ID
    """

    def __init__(
        self,
        message: str,
        error_code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        severity: ExceptionSeverity = ExceptionSeverity.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        adapter_id: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.severity = severity
        self.context = context or {}
        self.timestamp = datetime.now()
        self.adapter_id = adapter_id
        self.cause = cause

        # 调用父类构造函数
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """将异常转换为字典格式，便于序列化和日志记录"""
        return {
            "message": self.message,
            "error_code": self.error_code.name,
            "error_value": self.error_code.value,
            "severity": self.severity.value,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "adapter_id": self.adapter_id,
            "traceback": traceback.format_exc() if self.cause else None,
            "exception_type": self.__class__.__name__,
        }

    def __str__(self) -> str:
        """字符串表示"""
        parts = [
            f"[{self.error_code.name}]",
            f"Severity: {self.severity.value}",
            f"Message: {self.message}",
        ]

        if self.adapter_id:
            parts.append(f"Adapter: {self.adapter_id}")

        if self.context:
            parts.append(f"Context: {self.context}")

        return " | ".join(parts)

    def __repr__(self) -> str:
        """详细的字符串表示"""
        return (
            f"{self.__class__.__name__}("
            f"message='{self.message}', "
            f"error_code={self.error_code.name}, "
            f"severity={self.severity.value}, "
            f"adapter_id='{self.adapter_id}')"
        )


class AdapterFrameworkError(BaseAdapterException):
    """适配器框架级别的错误，通常是系统性问题"""

    def __init__(self, message: str, **kwargs):
        super().__init__(message, severity=ExceptionSeverity.HIGH, **kwargs)


class AdapterConfigurationError(BaseAdapterException):
    """适配器配置错误"""

    def __init__(self, message: str, config_key: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if config_key:
            context["config_key"] = config_key
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.CONFIGURATION_ERROR,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


class AdapterValidationError(BaseAdapterException):
    """适配器验证错误"""

    def __init__(
        self, message: str, validation_errors: Optional[List[str]] = None, **kwargs
    ):
        context = kwargs.get("context", {})
        if validation_errors:
            context["validation_errors"] = validation_errors
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.VALIDATION_ERROR,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


# ================================
# 适配器注册和管理异常
# ================================


class AdapterRegistrationError(BaseAdapterException):
    """适配器注册相关错误"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_REGISTRATION_FAILED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class AdapterNotFoundError(BaseAdapterException):
    """适配器未找到错误"""

    def __init__(self, adapter_id: str, **kwargs):
        message = f"Adapter '{adapter_id}' not found in registry"
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_NOT_FOUND,
            severity=ExceptionSeverity.MEDIUM,
            adapter_id=adapter_id,
            **kwargs,
        )


class AdapterAlreadyExistsError(BaseAdapterException):
    """适配器已存在错误"""

    def __init__(self, adapter_id: str, **kwargs):
        message = f"Adapter '{adapter_id}' already exists in registry"
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_ALREADY_EXISTS,
            severity=ExceptionSeverity.MEDIUM,
            adapter_id=adapter_id,
            **kwargs,
        )


class AdapterLoadingError(BaseAdapterException):
    """适配器加载错误"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_LOADING_FAILED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class AdapterUnloadingError(BaseAdapterException):
    """适配器卸载错误"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_UNLOADING_FAILED,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


# ================================
# 适配器执行异常
# ================================


class AdapterExecutionError(BaseAdapterException):
    """适配器执行错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_EXECUTION_FAILED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class AdapterTimeoutError(AdapterExecutionError):
    """适配器执行超时错误"""

    def __init__(self, adapter_id: str, timeout_seconds: float, **kwargs):
        message = f"Adapter '{adapter_id}' execution timed out after {timeout_seconds}s"
        context = kwargs.get("context", {})
        context.update({"timeout_seconds": timeout_seconds})
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_TIMEOUT,
            adapter_id=adapter_id,
            **kwargs,
        )


class AdapterInputValidationError(BaseAdapterException):
    """适配器输入验证错误"""

    def __init__(
        self, message: str, input_errors: Optional[Dict[str, Any]] = None, **kwargs
    ):
        context = kwargs.get("context", {})
        if input_errors:
            context["input_errors"] = input_errors
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_INPUT_INVALID,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


class AdapterOutputValidationError(BaseAdapterException):
    """适配器输出验证错误"""

    def __init__(
        self, message: str, output_errors: Optional[Dict[str, Any]] = None, **kwargs
    ):
        context = kwargs.get("context", {})
        if output_errors:
            context["output_errors"] = output_errors
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_OUTPUT_INVALID,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


# ================================
# 软适配器专用异常
# ================================


class SoftAdapterError(BaseAdapterException):
    """软适配器错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(message, severity=ExceptionSeverity.MEDIUM, **kwargs)


class RAGEngineError(SoftAdapterError):
    """RAG引擎错误"""

    def __init__(self, message: str, query: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if query:
            context["query"] = query
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.RAG_ENGINE_ERROR, **kwargs)


class PromptTemplateError(SoftAdapterError):
    """提示词模板错误"""

    def __init__(self, message: str, template_name: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if template_name:
            context["template_name"] = template_name
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.PROMPT_TEMPLATE_ERROR, **kwargs)


class KnowledgeBaseError(SoftAdapterError):
    """知识库错误"""

    def __init__(self, message: str, kb_name: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if kb_name:
            context["knowledge_base"] = kb_name
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.KNOWLEDGE_BASE_ERROR, **kwargs)


class RetrievalFailedError(SoftAdapterError):
    """检索失败错误"""

    def __init__(
        self,
        message: str,
        query: Optional[str] = None,
        retrieval_type: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if query:
            context["query"] = query
        if retrieval_type:
            context["retrieval_type"] = retrieval_type
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.RETRIEVAL_FAILED, **kwargs)


# ================================
# 硬适配器专用异常
# ================================


class HardAdapterError(BaseAdapterException):
    """硬适配器错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, severity=ExceptionSeverity.HIGH, **kwargs  # 硬适配器错误通常比较严重
        )


class SystemOperationError(HardAdapterError):
    """系统操作错误"""

    def __init__(self, message: str, operation: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if operation:
            context["operation"] = operation
        kwargs["context"] = context

        super().__init__(
            message, error_code=ErrorCode.SYSTEM_OPERATION_FAILED, **kwargs
        )


class FileOperationError(HardAdapterError):
    """文件操作错误"""

    def __init__(
        self,
        message: str,
        file_path: Optional[str] = None,
        operation: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if file_path:
            context["file_path"] = file_path
        if operation:
            context["file_operation"] = operation
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.FILE_OPERATION_FAILED, **kwargs)


class DesktopControlError(HardAdapterError):
    """桌面控制错误"""

    def __init__(self, message: str, control_type: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if control_type:
            context["control_type"] = control_type
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.DESKTOP_CONTROL_FAILED, **kwargs)


class PermissionDeniedError(HardAdapterError):
    """权限拒绝错误"""

    def __init__(
        self,
        message: str,
        required_permission: Optional[str] = None,
        resource: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if required_permission:
            context["required_permission"] = required_permission
        if resource:
            context["resource"] = resource
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.PERMISSION_DENIED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


# ================================
# 智能硬适配器专用异常
# ================================


class IntelligentAdapterError(BaseAdapterException):
    """智能硬适配器错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, severity=ExceptionSeverity.HIGH, **kwargs  # 智能适配器错误通常比较严重
        )


class CodeGenerationError(IntelligentAdapterError):
    """代码生成错误"""

    def __init__(
        self,
        message: str,
        prompt: Optional[str] = None,
        language: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if prompt:
            context["generation_prompt"] = prompt
        if language:
            context["target_language"] = language
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.CODE_GENERATION_FAILED, **kwargs)


class CodeExecutionError(IntelligentAdapterError):
    """代码执行错误"""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        execution_env: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if code:
            context["executed_code"] = code[:500]  # 只保存前500个字符避免日志过长
        if execution_env:
            context["execution_environment"] = execution_env
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.CODE_EXECUTION_FAILED, **kwargs)


class ModelLoadingError(IntelligentAdapterError):
    """模型加载错误"""

    def __init__(
        self,
        message: str,
        model_path: Optional[str] = None,
        model_type: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if model_path:
            context["model_path"] = model_path
        if model_type:
            context["model_type"] = model_type
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.MODEL_LOADING_FAILED, **kwargs)


class LearningEngineError(IntelligentAdapterError):
    """学习引擎错误"""

    def __init__(self, message: str, learning_task: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if learning_task:
            context["learning_task"] = learning_task
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.LEARNING_ENGINE_ERROR, **kwargs)


# ================================
# 安全和权限异常
# ================================


class SecurityError(BaseAdapterException):
    """安全错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, severity=ExceptionSeverity.CRITICAL, **kwargs  # 安全错误都是严重的
        )


class SecurityViolationError(SecurityError):
    """安全违规错误"""

    def __init__(self, message: str, violation_type: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if violation_type:
            context["violation_type"] = violation_type
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.SECURITY_VIOLATION, **kwargs)


class SandboxBreachError(SecurityError):
    """沙箱突破错误"""

    def __init__(self, message: str, attempted_action: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if attempted_action:
            context["attempted_action"] = attempted_action
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.SANDBOX_BREACH, **kwargs)


class UnauthorizedAccessError(SecurityError):
    """未授权访问错误"""

    def __init__(
        self,
        message: str,
        resource: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if resource:
            context["resource"] = resource
        if user_id:
            context["user_id"] = user_id
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.UNAUTHORIZED_ACCESS, **kwargs)


class AuditLogError(BaseAdapterException):
    """审计日志错误"""

    def __init__(self, message: str, log_operation: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if log_operation:
            context["log_operation"] = log_operation
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.AUDIT_LOG_FAILED,
            severity=ExceptionSeverity.HIGH,  # 审计失败是高优先级问题
            **kwargs,
        )


# ================================
# 资源和性能异常
# ================================


class ResourceError(BaseAdapterException):
    """资源错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(message, severity=ExceptionSeverity.HIGH, **kwargs)


class ResourceExhaustedException(ResourceError):
    """资源耗尽错误"""

    def __init__(
        self,
        message: str,
        resource_type: Optional[str] = None,
        current_usage: Optional[float] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if resource_type:
            context["resource_type"] = resource_type
        if current_usage is not None:
            context["current_usage"] = current_usage
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.RESOURCE_EXHAUSTED, **kwargs)


class MemoryLimitExceededError(ResourceError):
    """内存限制超出错误"""

    def __init__(
        self,
        message: str,
        current_memory: Optional[float] = None,
        limit_memory: Optional[float] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if current_memory is not None:
            context["current_memory_mb"] = current_memory
        if limit_memory is not None:
            context["limit_memory_mb"] = limit_memory
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.MEMORY_LIMIT_EXCEEDED, **kwargs)


class CPULimitExceededError(ResourceError):
    """CPU限制超出错误"""

    def __init__(
        self,
        message: str,
        current_cpu: Optional[float] = None,
        limit_cpu: Optional[float] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if current_cpu is not None:
            context["current_cpu_percent"] = current_cpu
        if limit_cpu is not None:
            context["limit_cpu_percent"] = limit_cpu
        kwargs["context"] = context

        super().__init__(message, error_code=ErrorCode.CPU_LIMIT_EXCEEDED, **kwargs)


class TimeoutExceededError(BaseAdapterException):
    """超时错误"""

    def __init__(
        self,
        message: str,
        timeout_seconds: Optional[float] = None,
        operation: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if timeout_seconds is not None:
            context["timeout_seconds"] = timeout_seconds
        if operation:
            context["operation"] = operation
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.TIMEOUT_EXCEEDED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


# ================================
# 网络和依赖异常
# ================================


class NetworkError(BaseAdapterException):
    """网络错误"""

    def __init__(
        self,
        message: str,
        endpoint: Optional[str] = None,
        status_code: Optional[int] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if endpoint:
            context["endpoint"] = endpoint
        if status_code is not None:
            context["status_code"] = status_code
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.NETWORK_ERROR,
            severity=ExceptionSeverity.MEDIUM,
            **kwargs,
        )


class APIUnavailableError(BaseAdapterException):
    """API不可用错误"""

    def __init__(self, message: str, api_name: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if api_name:
            context["api_name"] = api_name
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.API_UNAVAILABLE,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class DependencyMissingError(BaseAdapterException):
    """依赖缺失错误"""

    def __init__(
        self,
        message: str,
        dependency_name: Optional[str] = None,
        required_version: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if dependency_name:
            context["dependency_name"] = dependency_name
        if required_version:
            context["required_version"] = required_version
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.DEPENDENCY_MISSING,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class ServiceUnavailableError(BaseAdapterException):
    """服务不可用错误"""

    def __init__(self, message: str, service_name: Optional[str] = None, **kwargs):
        context = kwargs.get("context", {})
        if service_name:
            context["service_name"] = service_name
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.SERVICE_UNAVAILABLE,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class AdapterDependencyError(BaseAdapterException):
    """适配器依赖错误"""

    def __init__(
        self,
        message: str,
        dependency_name: Optional[str] = None,
        adapter_id: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if dependency_name:
            context["dependency_name"] = dependency_name
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.DEPENDENCY_MISSING,
            severity=ExceptionSeverity.HIGH,
            adapter_id=adapter_id,
            **kwargs,
        )


# ================================
# 适配器组合异常
# ================================


class AdapterCompositionError(BaseAdapterException):
    """适配器组合错误"""

    def __init__(
        self,
        message: str,
        composition_name: Optional[str] = None,
        failed_adapter: Optional[str] = None,
        **kwargs,
    ):
        context = kwargs.get("context", {})
        if composition_name:
            context["composition_name"] = composition_name
        if failed_adapter:
            context["failed_adapter"] = failed_adapter
        kwargs["context"] = context

        super().__init__(
            message,
            error_code=ErrorCode.ADAPTER_EXECUTION_FAILED,
            severity=ExceptionSeverity.HIGH,
            **kwargs,
        )


class AdapterChainBrokenError(AdapterCompositionError):
    """适配器链断开错误"""

    def __init__(self, chain_name: str, broken_at_step: int, **kwargs):
        message = f"Adapter chain '{chain_name}' broken at step {broken_at_step}"
        context = kwargs.get("context", {})
        context.update({"chain_name": chain_name, "broken_at_step": broken_at_step})
        kwargs["context"] = context

        super().__init__(message, **kwargs)


# ================================
# 异常处理工具类
# ================================

import functools
import logging
from typing import Type, Callable, Union


class ExceptionContext:
    """异常上下文管理器，用于捕获和转换异常"""

    def __init__(
        self,
        catch: Union[Exception, tuple] = Exception,
        reraise_as: Optional[Type[BaseAdapterException]] = None,
        message: Optional[str] = None,
        severity: ExceptionSeverity = ExceptionSeverity.MEDIUM,
        log_level: int = logging.ERROR,
        **context_data,
    ):
        self.catch = catch
        self.reraise_as = reraise_as or BaseAdapterException
        self.message = message
        self.severity = severity
        self.log_level = log_level
        self.context_data = context_data

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type and issubclass(exc_type, self.catch):
            # 记录原始异常
            logging.log(self.log_level, f"Exception caught: {exc_val}", exc_info=True)

            # 构造新的异常消息
            message = self.message or f"Wrapped exception: {str(exc_val)}"

            # 构造上下文信息
            context = {
                "original_exception": str(exc_val),
                "original_exception_type": exc_type.__name__,
                **self.context_data,
            }

            # 重新抛出适配器异常
            raise self.reraise_as(
                message=message, severity=self.severity, context=context, cause=exc_val
            ) from exc_val

        return False  # 不抑制其他异常


def handle_adapter_exceptions(
    catch: Union[Exception, tuple] = Exception,
    reraise_as: Type[BaseAdapterException] = BaseAdapterException,
    message: Optional[str] = None,
    severity: ExceptionSeverity = ExceptionSeverity.MEDIUM,
    **context_data,
):
    """
    适配器异常处理装饰器

    Args:
        catch: 要捕获的异常类型
        reraise_as: 重新抛出的异常类型
        message: 自定义错误消息
        severity: 异常严重程度
        **context_data: 额外的上下文数据

    Example:
        @handle_adapter_exceptions(
            catch=ConnectionError,
            reraise_as=NetworkError,
            message="Failed to connect to API"
        )
        def call_api():
            # 可能抛出ConnectionError的代码
            pass
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except catch as e:
                # 记录原始异常
                logging.error(f"Exception in {func.__name__}: {e}", exc_info=True)

                # 构造新的异常消息
                error_message = message or f"Error in {func.__name__}: {str(e)}"

                # 构造上下文信息
                context = {
                    "function": func.__name__,
                    "original_exception": str(e),
                    "original_exception_type": type(e).__name__,
                    **context_data,
                }

                # 重新抛出适配器异常
                raise reraise_as(
                    message=error_message, severity=severity, context=context, cause=e
                ) from e

        return wrapper

    return decorator


def handle_timeout(timeout_seconds: float, operation_name: Optional[str] = None):
    """
    超时处理装饰器

    Args:
        timeout_seconds: 超时时间（秒）
        operation_name: 操作名称，用于错误信息
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import signal

            def timeout_handler(signum, frame):
                op_name = operation_name or func.__name__
                raise TimeoutExceededError(
                    f"Operation '{op_name}' timed out after {timeout_seconds}s",
                    timeout_seconds=timeout_seconds,
                    operation=op_name,
                )

            # 设置信号处理器
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(int(timeout_seconds))

            try:
                result = func(*args, **kwargs)
                return result
            finally:
                # 恢复原始信号处理器
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)

        return wrapper

    return decorator


class ExceptionLogger:
    """异常日志记录器"""

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)

    def log_exception(
        self,
        exception: BaseAdapterException,
        extra_context: Optional[Dict[str, Any]] = None,
    ):
        """记录适配器异常到日志"""
        log_data = exception.to_dict()
        if extra_context:
            log_data["extra_context"] = extra_context

        # 根据严重程度选择日志级别
        if exception.severity == ExceptionSeverity.CRITICAL:
            log_level = logging.CRITICAL
        elif exception.severity == ExceptionSeverity.HIGH:
            log_level = logging.ERROR
        elif exception.severity == ExceptionSeverity.MEDIUM:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        self.logger.log(log_level, f"Adapter Exception: {exception}", extra=log_data)

    def log_exception_chain(self, exception: BaseAdapterException):
        """记录异常链（包括原因异常）"""
        current = exception
        chain_index = 0

        while current:
            self.log_exception(current, {"chain_index": chain_index})
            current = getattr(current, "cause", None)
            chain_index += 1


def create_error_response(exception: BaseAdapterException) -> Dict[str, Any]:
    """
    将适配器异常转换为API错误响应格式

    Args:
        exception: 适配器异常实例

    Returns:
        包含错误信息的字典，适合作为API响应
    """
    return {
        "error": True,
        "error_code": exception.error_code.name,
        "error_value": exception.error_code.value,
        "message": exception.message,
        "severity": exception.severity.value,
        "timestamp": exception.timestamp.isoformat(),
        "adapter_id": exception.adapter_id,
        "context": exception.context,
        "exception_type": exception.__class__.__name__,
    }


def is_retryable_error(exception: BaseAdapterException) -> bool:
    """
    判断异常是否可重试

    Args:
        exception: 适配器异常实例

    Returns:
        如果异常可重试则返回True，否则返回False
    """
    # 网络错误、资源错误、超时错误通常可重试
    retryable_codes = {
        ErrorCode.NETWORK_ERROR,
        ErrorCode.API_UNAVAILABLE,
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCode.TIMEOUT_EXCEEDED,
        ErrorCode.RESOURCE_EXHAUSTED,
        ErrorCode.MEMORY_LIMIT_EXCEEDED,
        ErrorCode.CPU_LIMIT_EXCEEDED,
    }

    return exception.error_code in retryable_codes


# ================================
# 异常快速构造函数
# ================================


def adapter_not_found(adapter_id: str) -> AdapterNotFoundError:
    """快速构造适配器未找到异常"""
    return AdapterNotFoundError(adapter_id)


def adapter_timeout(adapter_id: str, timeout_seconds: float) -> AdapterTimeoutError:
    """快速构造适配器超时异常"""
    return AdapterTimeoutError(adapter_id, timeout_seconds)


def permission_denied(resource: str, permission: str) -> PermissionDeniedError:
    """快速构造权限拒绝异常"""
    return PermissionDeniedError(
        f"Access denied to resource '{resource}', required permission: '{permission}'",
        required_permission=permission,
        resource=resource,
    )


def security_violation(violation_type: str, details: str) -> SecurityViolationError:
    """快速构造安全违规异常"""
    return SecurityViolationError(
        f"Security violation: {details}", violation_type=violation_type
    )


# ================================
# 导出所有异常类
# ================================

__all__ = [
    # 枚举
    "ExceptionSeverity",
    "ErrorCode",
    # 基础异常
    "BaseAdapterException",
    "AdapterFrameworkError",
    "AdapterConfigurationError",
    "AdapterValidationError",
    # 注册和管理异常
    "AdapterRegistrationError",
    "AdapterNotFoundError",
    "AdapterAlreadyExistsError",
    "AdapterLoadingError",
    "AdapterUnloadingError",
    # 执行异常
    "AdapterExecutionError",
    "AdapterTimeoutError",
    "AdapterInputValidationError",
    "AdapterOutputValidationError",
    # 软适配器异常
    "SoftAdapterError",
    "RAGEngineError",
    "PromptTemplateError",
    "KnowledgeBaseError",
    "RetrievalFailedError",
    # 硬适配器异常
    "HardAdapterError",
    "SystemOperationError",
    "FileOperationError",
    "DesktopControlError",
    "PermissionDeniedError",
    # 智能硬适配器异常
    "IntelligentAdapterError",
    "CodeGenerationError",
    "CodeExecutionError",
    "ModelLoadingError",
    "LearningEngineError",
    # 安全异常
    "SecurityError",
    "SecurityViolationError",
    "SandboxBreachError",
    "UnauthorizedAccessError",
    "AuditLogError",
    # 资源异常
    "ResourceError",
    "ResourceExhaustedException",
    "MemoryLimitExceededError",
    "CPULimitExceededError",
    "TimeoutExceededError",
    # 网络依赖异常
    "NetworkError",
    "APIUnavailableError",
    "DependencyMissingError",
    "ServiceUnavailableError",
    "AdapterDependencyError",
    # 组合异常
    "AdapterCompositionError",
    "AdapterChainBrokenError",
    # 工具类
    "ExceptionContext",
    "ExceptionLogger",
    # 装饰器
    "handle_adapter_exceptions",
    "handle_timeout",
    # 工具函数
    "create_error_response",
    "is_retryable_error",
    "adapter_not_found",
    "adapter_timeout",
    "permission_denied",
    "security_violation",
]


# ================================
# 向后兼容性别名
# ================================

# 为了保持与其他模块的兼容性
AdapterSecurityError = SecurityError

"""API Schemas"""

# Chat schemas
from .chat import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatStreamResponse,
    ConversationSummary,
    MessageRole
)

# Request schemas
from .request import (
    BaseRequest,
    PaginationRequest,
    SearchRequest,
    FilterRequest
)

# Response schemas
from .responses import (
    BaseResponse,
    ErrorResponse,
    PaginatedResponse,
    ModelStatus,
    SystemInfo,
    ComponentHealth,
    SystemMetrics,
    HealthCheckResponse,
    DeepHealthCheckResponse,
    HealthResponse,
    AdapterInfo,
    AdapterListResponse,
    AdapterRegistrationRequest,
    AdapterUpdateRequest,
    AdapterRegistrationResponse,
    AdapterUpdateResponse,
    AdapterDeleteResponse,
    ModelListResponse,
    ModelLoadResponse,
    ModelUnloadResponse,
    ModelInfoResponse,
    ModelMetrics,
    ModelPerformanceMetrics,
    ModelResourceUsage,
    ModelBenchmarkResult,
    ModelBenchmarkResponse,
    ModelValidationResult,
    ModelValidationResponse,
    ModelComparisonResult,
    ModelComparisonResponse,
    SystemResourceUsage,
    SystemResourceResponse
)

# Adapter schemas
from .adapter import (
    AdapterMetadata,
    AdapterConfig,
    AdapterCapability,
    AdapterStatus,
    AdapterHealthCheck,
    AdapterPerformanceMetrics,
    AdapterResourceUsage,
    AdapterValidationResult,
    AdapterBenchmarkResult
)

__all__ = [
    # Chat
    "ChatMessage",
    "ChatRequest", 
    "ChatResponse",
    "ChatStreamResponse",
    "ConversationSummary",
    "MessageRole",
    
    # Request
    "BaseRequest",
    "PaginationRequest",
    "SearchRequest",
    "FilterRequest",
    
    # Response
    "BaseResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "ModelStatus",
    "SystemInfo",
    "ComponentHealth",
    "SystemMetrics",
    "HealthCheckResponse",
    "DeepHealthCheckResponse",
    "HealthResponse",
    "AdapterInfo",
    "AdapterListResponse",
    "AdapterRegistrationRequest",
    "AdapterUpdateRequest",
    "AdapterRegistrationResponse",
    "AdapterUpdateResponse",
    "AdapterDeleteResponse",
    "ModelListResponse",
    "ModelLoadResponse",
    "ModelUnloadResponse",
    "ModelInfoResponse",
    "ModelMetrics",
    "ModelPerformanceMetrics",
    "ModelResourceUsage",
    "ModelBenchmarkResult",
    "ModelBenchmarkResponse",
    "ModelValidationResult",
    "ModelValidationResponse",
    "ModelComparisonResult",
    "ModelComparisonResponse",
    "SystemResourceUsage",
    "SystemResourceResponse",
    
    # Adapter
    "AdapterMetadata",
    "AdapterConfig",
    "AdapterCapability",
    "AdapterStatus",
    "AdapterHealthCheck",
    "AdapterPerformanceMetrics",
    "AdapterResourceUsage",
    "AdapterValidationResult",
    "AdapterBenchmarkResult"
]

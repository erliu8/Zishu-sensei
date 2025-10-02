from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any, Dict, Union, Literal, TYPE_CHECKING
from datetime import datetime
from enum import Enum
import uuid

if TYPE_CHECKING:
    from typing import ForwardRef

from .chat import MessageRole, MessageType, EmotionType, CharacterConfig, ChatModel, Message

class CompletionFinishReason(str, Enum):
    """完成原因枚举"""
    STOP = "stop"
    LENGTH = "length"
    CONTENT_FILTER = "content_filter"
    FUNCTION_CALL = "function_call"
    ERROR = "error"
    
class ResponseStatus(str, Enum):
    """响应状态枚举"""
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"
    PROCESSING = "processing"

class SortOrder(str, Enum):
    """排序顺序枚举"""
    ASC = "asc"
    DESC = "desc"

# 通用参数类
class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(1, ge=1, description="页码，从1开始")
    size: int = Field(20, ge=1, le=100, description="每页大小，1-100")
    sort_by: Optional[str] = Field(None, description="排序字段")
    sort_order: SortOrder = Field(SortOrder.ASC, description="排序顺序")

class FilterParams(BaseModel):
    """过滤参数"""
    filters: Optional[Dict[str, Any]] = Field(None, description="过滤条件")
    search: Optional[str] = Field(None, description="搜索关键词")
    date_from: Optional[datetime] = Field(None, description="开始日期")
    date_to: Optional[datetime] = Field(None, description="结束日期")

class APIVersion(BaseModel):
    """API版本信息"""
    version: str = Field(..., description="版本号")
    build: Optional[str] = Field(None, description="构建号")
    commit_hash: Optional[str] = Field(None, description="提交哈希")
    release_date: Optional[datetime] = Field(None, description="发布日期")

class BaseResponse(BaseModel):
    """基础响应模型"""
    success: bool = Field(..., description="操作是否成功")
    message: Optional[str] = Field(None, description="响应消息")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(), description="响应时间戳")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="请求ID")

#基础响应模型
class UsageInfo(BaseModel):
    """Token使用统计"""
    prompt_tokens: int = Field(..., description="提示token数量")
    completion_tokens: int = Field(..., description="完成token数量")
    total_tokens: int = Field(..., description="总token数量")
    estimated_cost: Optional[float] = Field(None, description="预估成本")

class Choice(BaseModel):
    """对话选择项"""
    index: int = Field(..., description="选择索引")
    message: Message = Field(..., description="消息内容")
    finish_reason: CompletionFinishReason = Field(..., description="完成原因")

    #扩展信息
    confidence: Optional[float] = Field(None,ge=0.0,le=1.0, description="生成置信度") #TODO: 需要根据生成质量计算
    safety_score: Optional[float] = Field(None,ge=0.0,le=1.0, description="安全得分") #TODO: 需要根据生成内容计算
    
class StreamChoice(BaseModel):
    """流式响应选择项"""
    index: int = Field(..., description="选择索引")
    dalta: Dict[str, Any] = Field(..., description="增量内容")
    finish_reason: Optional[CompletionFinishReason] = Field(None, description="完成原因")

class ChatCompletionResponse(BaseModel):
    """对话完成响应 - 兼容OpenAI"""
    id: str = Field(..., description="响应唯一ID")
    object: Literal["chat.completion"] = Field(default="chat.completion", description="对象类型")
    created: int = Field(..., description="创建时间戳")
    model: str = Field(..., description="模型ID")
    choices: List[Choice] = Field(..., description="生成选择列表")
    usage: UsageInfo = Field(..., description="Token使用统计")
    
    #扩展字段
    adapter: Optional[str] = Field(None, description="适配器ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    processing_time: Optional[float] = Field(..., description="处理时间(秒)")
    
    #情绪分析结果：
    emotion_analysis: Optional[Dict[str, Any]] = Field(None, description="情绪分析结果")
    
    #元数据
    metadata: Dict[str, Any] = Field(default_factory=dict, description="响应元数据")
    
class StreamChunk(BaseModel):
    """流式响应数据块"""
    id: str = Field(..., description="流式ID")
    object: Literal["chat.completion.chunk"] = Field(default="chat.completion.chunk", description="对象类型")
    created: int = Field(..., description="创建时间戳")
    model: str = Field(..., description="模型ID")
    choices: List[StreamChoice] = Field(..., description="流式选择列表")
    
    #可选的使用统计
    usage: Optional[UsageInfo] = Field(None, description="Token使用统计")
    
    #扩展字段
    adapter: Optional[str] = Field(None, description="适配器ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    
#情绪系统响应
class EmotionAnalysis(BaseModel):
    """情绪分析结果"""
    detected_emotion: EmotionType = Field(..., description="检测到的情绪")
    confidence: float = Field(..., ge=0.0, le=1.0, description="检测置信度")
    emotion_scores: Dict[EmotionType, float] = Field(..., description="情绪得分")
    intensity: float = Field(..., ge=0.0, le=1.0, description="情绪强度")
    
class EmotionTransition(BaseModel):
    """情绪转换信息"""
    from_emotion: EmotionType = Field(..., description="转换前的情绪")
    to_emotion: EmotionType = Field(..., description="转换后的情绪")
    transition_reason: str = Field(..., description="转换原因")
    smooth_transition: bool = Field(..., description="是否平滑转换")
    
class EmotionResponse(BaseModel):
    """情绪对话响应"""
    id: str = Field(..., description="响应ID")
    message: Message = Field(..., description="回复消息")
    
    #情绪分析
    user_emotion:EmotionAnalysis = Field(None, description="用户情绪分析")
    response_emotion: EmotionType = Field(None, description="回复情绪")
    emotion_transition: Optional[EmotionTransition] = Field(None, description="情绪过渡")
    
    #基础信息
    usage: UsageInfo = Field(..., description="Token使用统计")
    processing_time: float = Field(None, description="处理时间(秒)")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")
    
#健康检查响应
class ModelStatus(BaseModel):
    """模型状态"""
    status: Literal["healthy", "unhealthy", "degraded"] = Field(..., description="模型状态")
    loaded_adapters: List[str] = Field(default_factory=list, description="已加载的适配器列表")
    total_memory_usage: Optional[int] = Field(None, description="总内存使用(字节)")
    available_memory: Optional[int] = Field(None, description="可用内存(字节)")
    gpu_info: Optional[Dict[str, Dict[str, Any]]] = Field(None, description="GPU信息")
    last_updated: Optional[datetime] = Field(None, description="最后更新时间")

class SystemInfo(BaseModel):
    """系统信息"""
    cpu_usage: float = Field(..., description="CPU使用率百分比")
    memory_usage: float = Field(..., description="内存使用率百分比")
    disk_usage: float = Field(..., description="磁盘使用率百分比")
    gpu_usage: Optional[Dict[str, float]] = Field(None, description="GPU使用率")
    temperature: Optional[Dict[str, float]] = Field(None, description="温度信息")
    uptime_seconds: float = Field(..., description="系统运行时间(秒)")
    timestamp: datetime = Field(..., description="时间戳")
    
class ComponentHealth(BaseModel):
    """组件健康状态"""
    name: str = Field(..., description="组件名称")
    status: Literal["healthy", "unhealthy", "degraded"] = Field(..., description="组件状态")
    message: str = Field(..., description="状态消息")
    response_time_ms: Optional[float] = Field(None, description="响应时间(毫秒)")
    last_check: datetime = Field(..., description="最后检查时间")
    details: Optional[Dict[str, Any]] = Field(None, description="详细信息")
    error: Optional[str] = Field(None, description="错误信息")

class SystemMetrics(BaseModel):
    """系统指标"""
    cpu_percent: float = Field(..., description="CPU使用率百分比")
    memory_percent: float = Field(..., description="内存使用率百分比")
    disk_percent: float = Field(..., description="磁盘使用率百分比")
    network_io: Optional[Dict[str, int]] = Field(None, description="网络IO统计")
    process_count: Optional[int] = Field(None, description="进程数量")
    load_average: Optional[List[float]] = Field(None, description="系统负载平均值")
    timestamp: datetime = Field(..., description="指标时间戳")
    
class HealthCheckResponse(BaseModel):
    """基础健康检查响应"""
    status: Literal["healthy", "unhealthy", "degraded"] = Field(..., description="整体状态")
    timestamp: datetime = Field(..., description="检查时间")
    uptime_seconds: float = Field(..., description="系统运行时间(秒)")
    version: str = Field(..., description="系统版本")

class DeepHealthCheckResponse(BaseModel):
    """深度健康检查响应"""
    status: Literal["healthy", "unhealthy", "degraded"] = Field(..., description="整体状态")
    timestamp: datetime = Field(..., description="检查时间")
    uptime_seconds: float = Field(..., description="系统运行时间(秒)")
    version: str = Field(..., description="系统版本")
    components: List[ComponentHealth] = Field(..., description="组件健康状态列表")
    system_metrics: Optional[SystemMetrics] = Field(None, description="系统指标")
    summary: Dict[str, Any] = Field(..., description="健康状态摘要")

class HealthResponse(BaseModel):
    """健康检查响应"""
    status: Literal["healthy", "unhealthy", "degraded"] = Field(..., description="整体状态")
    timestamp: datetime = Field(default_factory=datetime.now, description="检查时间")
    
    #详细状态
    api_status: bool = Field(..., description="API服务状态")
    database_status: Optional[bool] = Field(None, description="数据库状态")
    cache_status: Optional[bool] = Field(None, description="缓存状态")
    
    #模型状态
    models: List[ModelStatus] = Field(default_factory=list, description="模型状态列表")
    
    #系统指标
    metrics: Optional[SystemMetrics] = Field(None, description="系统指标")
    
    #检查详情
    checks: Dict[str, Any] = Field(default_factory=dict, description="检查详情")
    version: str = Field(..., description="API版本")
    
#模型管理响应
class AdapterInfo(BaseModel):
    """适配器信息"""
    name: str = Field(..., description="适配器名称")
    path: str = Field(..., description="适配器路径")
    size: Optional[float] = Field(None, description="适配器大小(Byte)")
    version: Optional[str] = Field(None, description="适配器版本")
    description: Optional[str] = Field(None, description="适配器描述")
    
    #状态信息
    status: Literal["loaded", "unloaded", "loading", "error"] = Field(..., description="适配器状态")
    load_time: Optional[float] = Field(None, description="加载时间(秒)")
    memory_usage: Optional[float] = Field(None, description="内存使用")
  
    #配置信息
    config: Dict[str, Any] = Field(default_factory=dict, description="适配器配置")
    
class ModelListResponse(BaseModel):
    """模型列表响应"""
    success: bool = Field(..., description="操作是否成功")
    operation: Literal["load", "unload", "switch"] = Field(..., description="操作类型")
    adapter_name: str = Field(..., description="适配器名称")
    message: str = Field(..., description="操作结果消息")
    
    #详细信息
    execution_time: float = Field(..., description="执行时间(秒)")
    memory_usage: Optional[float] = Field(None, description="内存使用(MB)")
    
    #错误信息
    error_code: Optional[str] = Field(None, description="错误代码")
    error_details: Optional[str] = Field(None, description="错误详情")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="操作时间")
    
#角色配置响应
class CharacterInfo(BaseModel):
    """角色信息"""
    name: str = Field(default="紫舒", description="角色名称")
    display_name: str = Field(default="紫舒老师", description="显示名称")
    description: str = Field(default="害羞温柔的虚拟老师", description="角色描述")
    avatar: Optional[str] = Field(None, description="头像URL")
    
    #用户自定义标识
    is_default: bool = Field(default=False, description="是否为默认角色")
    created_by: Literal["user", "system"] = Field(default="system", description="创建者")
    
class CharacterConfigResponse(BaseModel):
    """角色配置响应"""
    character_info: CharacterInfo = Field(..., description="角色基本信息")
    character_config: CharacterConfig = Field(..., description="角色详细配置")
    current_emotion: EmotionType = Field(default="neutral", description="当前情绪")
    
    #运行状态
    active_since: datetime = Field(default_factory=datetime.now, description="激活时间")
    interaction_count: int = Field(default=0, description="互动次数")
    
    #配置信息
    last_updated: datetime = Field(default_factory=datetime.now, description="最后更新时间")
    internal_version: Optional[str] = Field(None, alias="version", description="内部版本号")

class EmotionResponse(BaseModel):
    """情绪响应"""
    success: bool = Field(..., description="更新是否成功")
    previous_emotion: EmotionType = Field(..., description="之前情绪")
    current_emotion: EmotionType = Field(..., description="当前情绪")
    
    #转换信息
    transition_time: float = Field(..., description="转换时间(秒)")
    transition_smooth: bool = Field(..., description="是否平滑转换")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="更新时间")
    
#多模态响应
class VoiceResponse(BaseModel):
    """语音响应"""
    success: bool = Field(..., description="生成是否成功")
    audio_url: Optional[str] = Field(None, description="语音URL")
    audio_base64: Optional[str] = Field(None, description="语音Base64")
    
    #生成信息
    duration: float = Field(..., description="语音时长(秒)")
    voice_style: Optional[str] = Field(None, description="语音风格")
    emotion: EmotionType = Field(..., description="情绪")
    
    #技术信息
    format: str = Field(default="wav", description="语音格式")
    sample_rate: int = Field(default=16000, description="采样率")
    generation_time: float = Field(..., description="生成时间(秒)")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="生成时间")

class AnimationResponse(BaseModel):
    """动画响应"""
    success: bool = Field(..., description="生成是否成功")
    animation_data: Dict[str, Any] = Field(..., description="动画数据")
    
    #动画信息
    emotion: EmotionType = Field(..., description="目标情绪")
    duration: float = Field(..., description="动画时长(秒)")
    style:str = Field(..., description="动画风格")
    
    #技术信息
    frame_count: int = Field(..., description="帧数")
    fps: int = Field(default=30, description="帧率")
    generation_time: float = Field(..., description="生成时间(秒)")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="生成时间")

#会话管理响应
class SessionInfo(BaseModel):
    """会话信息"""
    session_id: str = Field(..., description="会话ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    session_name: Optional[str] = Field(None, description="会话名称")
    
    #状态信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    last_activity: datetime = Field(default_factory=datetime.now, description="最后活动时间")
    message_count: int = Field(default=0, description="消息数量")
    
    #配置信息
    character_config: Optional[CharacterConfig] = Field(None, description="角色配置")
    current_emotion: EmotionType = Field(default="neutral", description="当前情绪")
    
    #统计信息
    total_tokens: int = Field(default=0, description="总token数量")
    total_cost: float = Field(default=0.0, description="总成本")
    
class SessionListResponse(BaseModel):
    """会话列表响应"""
    session: SessionInfo = Field(..., description="会话信息")
    operation: Literal["create", "delete", "update"] = Field(..., description="操作类型")
    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="操作结果消息")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="操作时间")
    
#批量处理响应
class BatchResponse(BaseModel):
    """批量处理响应"""
    batch_id: str = Field(..., description="批次ID")
    total_requests: int = Field(..., description="总请求数量")
    successful_requests: int = Field(..., description="成功请求数量")
    failed_requests: int = Field(..., description="失败请求数量")
    
    #详细结果
    results: List[Union[ChatCompletionResponse, "ErrorResponse"]] = Field(..., description="批量结果")
    
    #执行信息
    execution_time: float = Field(..., description="执行时间(秒)")
    parallel_execution: bool = Field(..., description="是否并行执行")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="操作时间")
    
#错误响应
class ErrorDetail(BaseModel):
    """错误响应"""
    code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    details: Optional[str] = Field(None, description="错误详情")
    field: Optional[str] = Field(None, description="相关字段")
    
class ErrorResponse(BaseResponse):
    """错误响应"""
    success: bool = Field(default=False, description="操作是否成功")
    error_code: Optional[str] = Field(None, description="错误代码")
    error_details: Optional[Dict[str, Any]] = Field(None, description="错误详情")
    
    # 向后兼容字段
    error: bool = Field(default=True, description="是否错误")
    error_type: Optional[str] = Field(None, description="错误类型")
    details: List[ErrorDetail] = Field(default_factory=list, description="错误详情")
    
    #帮助信息
    suggestions: Optional[List[str]] = Field(None, description="解决建议")
    documentation: Optional[str] = Field(None, description="文档链接")

#通用响应包装器
class ApiResponse(BaseModel):
    """API响应包装器"""
    success: bool = Field(..., description="操作是否成功")
    status: ResponseStatus = Field(..., description="响应状态")
    data: Optional[Any] = Field(None, description="响应数据")
    error: Optional[ErrorResponse] = Field(None, description="错误信息")
    
    #元信息
    request_id: Optional[str] = Field(None, description="请求ID")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")
    processing_time: float = Field(..., description="处理时间(秒)")
    
    #API信息
    api_version: str = Field(..., description="API版本")
    server_info: Optional[Dict[str, Any]] = Field(None, description="服务器信息")

#验证器
@field_validator("usage")
def validate_usage(cls, v):
    if v.prompt_tokens < 0 or v.completion_tokens < 0:
        raise ValueError("Token数量不能为负数")
    if v.total_tokens != v.prompt_tokens + v.completion_tokens:
        raise ValueError("总token数计算不正确")
    return v

#工具函数
def create_error_response(
    error_type: str,
    error_code: str,
    message: str,
    details: Optional[List[ErrorDetail]] = None,
    request_id: Optional[str] = None,
) -> ErrorResponse:
    """创建错误响应"""
    return ErrorResponse(
        error=True,
        error_type=error_type,
        error_code=error_code,
        message=message,
        details=details or [],
        request_id=request_id
    )
def create_success_response(
    data: Any,
    request_id: str,
    processing_time: float,
) -> ApiResponse:
    """创建成功响应"""
    return ApiResponse(
        success=True,
        status=ResponseStatus.SUCCESS,
        data=data,
        request_id=request_id,
        processing_time=processing_time
    )

# 添加测试需要的响应类
class ChatResponse(BaseModel):
    """聊天响应"""
    id: str = Field(..., description="响应ID")
    message: Any = Field(..., description="消息内容")
    model: str = Field(..., description="使用的模型")
    usage: Optional[Dict[str, int]] = Field(None, description="Token使用统计")
    created: datetime = Field(..., description="创建时间")

class ChatStreamResponse(BaseModel):
    """流式聊天响应"""
    id: str = Field(..., description="响应ID")
    delta: Dict[str, Any] = Field(..., description="增量内容")
    model: str = Field(..., description="使用的模型")
    created: datetime = Field(..., description="创建时间")
    finish_reason: Optional[str] = Field(None, description="完成原因")

class ConversationSummary(BaseModel):
    """对话摘要"""
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()), description="摘要ID")
    conversation_id: str = Field(..., description="对话ID")
    title: str = Field(..., description="对话标题")
    summary: str = Field(..., description="摘要内容")
    message_count: int = Field(..., description="消息数量")
    created_at: datetime = Field(..., description="创建时间")
    last_message_at: datetime = Field(..., description="最后消息时间")
    created: datetime = Field(default_factory=__import__('datetime').datetime.now, description="创建时间")

class ChatHistory(BaseModel):
    """聊天历史"""
    session_id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()), description="会话ID")
    conversation_id: str = Field(..., description="对话ID")
    messages: List[Any] = Field(..., description="消息列表")
    total_messages: int = Field(default=0, description="总消息数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    title: str = Field(..., description="对话标题")
    created: datetime = Field(default_factory=__import__('datetime').datetime.now, description="创建时间")

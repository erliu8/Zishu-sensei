from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime
from enum import Enum

from .chat import MessageRole, MessageType, EmotionType, ChatModel, Message, CharacterConfig

class CompletionFinishReason(str, Enum):
    """完成原因枚举"""
    STOP = "stop"
    LENGTH = "length"
    CONTENT_FILTER = "content_filter"
    FUNCTION_CALL = "function_call"

class StreamOptions(BaseModel):
    """流式响应选项"""
    include_usage: Optional[bool] = Field(default=False, description="是否包含Token使用信息")
    
#基础对话请求
class ChatCompletionRequest(BaseModel):
    """对话完成请求(兼容OpenAI)"""
    messages: List[Union[Dict[str, Any], Message]] = Field(..., min_length=1, description="对话消息列表")
    model: Optional[str] = Field(default="zishu-base", description="模型ID")
    
    #生成参数
    max_tokens: Optional[int] = Field(default=2048, ge=1, le=8192, description="最大token数量")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="温度参数")
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0, description="top-p核采样参数")
    top_k: Optional[int] = Field(default=40, ge=1, le=100, description="top-k采样参数")

    #控制参数
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0, description="存在惩罚参数")
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0, description="频率惩罚参数")
    repetition_penalty: Optional[float] = Field(default=1.1, ge=0.1, le=2.0, description="重复惩罚参数")
    
    #流式和停止
    stream: bool = Field(default=False, description="是否流式生成")
    stream_options: Optional[StreamOptions] = Field(None, description="流式选项")
    stop: Optional[Union[str,List[str]]] = Field(None, description="停止词")
    
    #扩展功能
    user: Optional[str] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    adapter: Optional[str] = Field(None, description="适配器ID")
    chat_mode: Optional[str] = Field(default=ChatModel.NORMAL, description="对话模式")
    
    #函数调用支持
    functions: Optional[List[Dict[str, Any]]] = Field(None, description="可用函数列表")
    function_call: Optional[Union[str, Dict[str, str]]] = Field(None, description="函数调用控制")
    
    #多模态支持
    enable_multimodal: bool = Field(default=False, description="是否启用多模态")
    voice_style: Optional[str] = Field(None, description="语音风格")
    
    #元数据
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="请求元数据")
    
    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if not v:
            raise ValueError("对话消息列表不能为空")
        if len(v) > 100:
            raise ValueError("对话消息列表不能超过100条")
        return v
    
    @field_validator("stop")
    @classmethod
    def validate_stop(cls, v):
        if isinstance(v, str):
            return [v]
        elif isinstance(v, list):
            if len(v) > 4:
                raise ValueError("停止词不能超过4个")
            return v
        return v
    
#流式对话请求
class StreamChatRequest(BaseModel):
    messages: str = Field(..., min_length=1, description="对话消息列表")
    model: Optional[str] = Field(default="zishu-base", description="模型ID")
    
    #生成参数
    max_tokens: Optional[int] = Field(default=2048, ge=1, le=8192, description="最大token数量")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="温度参数")
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0, description="top-p核采样参数")
    
    #流式参数
    chunk_size: Optional[int] = Field(default=1, ge=1, le=10, description="每次返回的token数量")
    delay_ms: Optional[int] = Field(default=10, ge=0, le=100, description="流式返回延迟时间(毫秒)")
    include_usage: Optional[bool] = Field(default=False, description="是否包含Token使用信息统计")
    
    #扩展功能
    session_id: Optional[str] = Field(None, description="会话ID")
    adapter: Optional[str] = Field(None, description="适配器ID")
    user: Optional[str] = Field(None, description="用户ID")
    
#情绪对话请求
class EmotionChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="对话消息")
    current_emotion: Optional[EmotionType] = Field(default="neutral", description="当前情绪状态")
    target_emotion: Optional[EmotionType] = Field(None, description="目标情绪状态") #可从记忆中获取
    emotion_intensity: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="情绪强度")
    
    #情绪分析选项
    analyze_user_emotion: Optional[bool] = Field(True, description="是否分析用户情绪")
    emotion_history: Optional[List[str]] = Field(None, description="情绪历史列表")
    
    #响应配置
    response_emotion_auto: Optional[bool] = Field(True, description="是否自动生成响应情绪")
    emotion_transition: Optional[bool] = Field(True, description="是否启用情绪过渡")
    
    #基础参数
    model: Optional[str] = Field(default="zishu-base", description="模型ID")
    adapter: Optional[str] = Field(None, description="适配器ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    user: Optional[str] = Field(None, description="用户ID")
    
    #多模态
    voice_style: Optional[str] = Field(None, description="语音风格")
    animation_style: Optional[str] = Field(None, description="动画风格")
    
#模型管理请求
class ModelLoadRequest(BaseModel):
    model_name: str = Field(..., description="模型名称")
    model_path: Optional[str] = Field(None, description="模型路径")
    
    #加载选项
    force_reload: Optional[bool] = Field(False, description="是否强制重新加载")
    load_config: Optional[Dict[str, Any]] = Field(None, description="加载配置")
    
    #资源配置
    device: Optional[str] = Field(default="auto", description="设备类型") #auto/cpu/cuda
    torch_dtype: Optional[str] = Field(default="auto", description="torch数据类型") #auto/float16/bfloat16/float32
    low_memory: Optional[bool] = Field(False, description="是否低内存模式")

class ModelManagementRequest(BaseModel):
    adapter_name: str = Field(..., description="适配器ID")
    adapter_path: Optional[str] = Field(None, description="适配器路径") #如果不在默认路径
    
    #加载选项
    force_reload: Optional[bool] = Field(False, description="是否强制重新加载")
    load_config: Optional[Dict[str, Any]] = Field(None, description="加载配置")
    
    #资源配置
    device: Optional[str] = Field(default="auto", description="设备类型") #auto/cpu/cuda
    torch_dtype: Optional[str] = Field(default="auto", description="torch数据类型") #auto/float16/bfloat16/float32
    low_memory: Optional[bool] = Field(False, description="是否低内存模式")
    
class ModelUnloadRequest(BaseModel):
    adapter_name: str = Field(..., description="要卸载的适配器ID")
    force_unload: Optional[bool] = Field(False, description="是否强制卸载")

class ModelSwitchRequest(BaseModel):
    from_adapter: Optional[str] = Field(None, description="当前适配器ID")
    to_adapter: Optional[str] = Field(None, description="目标适配器ID")
    keep_cache: Optional[bool] = Field(default=True, description="是否保留缓存")

#角色配置请求
class CharacterConfigRequest(BaseModel):
    name: Optional[str] = Field(None, description="角色名称")
    personality: Optional[str] = Field(None, description="角色性格描述")
    
    #情绪配置
    available_emotions: Optional[List[str]] = Field(None, description="可用情绪列表")
    default_emotion: Optional[str] = Field(None, description="默认情绪")
    emotion_transitions: Optional[Dict[str, List[str]]] = Field(None, description="情绪转换规则")
    
    #语音和动画
    voice_style: Optional[str] = Field(None, description="可用语音风格")
    animations: Optional[str] = Field(None, description="可用动画表情")
    
    #行为配置
    response_style: Optional[str] = Field(None, description="回复风格")
    interaction_mode: Optional[str] = Field(None, description="互动模式")
    
class CharacterEmotionRequest(BaseModel):
    emotion: EmotionType = Field(..., description="情绪状态")
    intensity: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="情绪强度")
    duration: Optional[int] = Field(None, ge=1, description="情绪持续时间(秒)") #TODO: 需要根据情绪强度计算，可用更精确的时间
    transition_time: Optional[float] = Field(default=1.0, ge=0.1, le=10.0, description="情绪过渡时间(秒)")

#会话管理请求
class SessionCreateRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="用户ID")
    session_name: Optional[str] = Field(None, description="会话名称")
    character_config: Optional[CharacterConfig] = Field(None, description="角色配置")
    initial_context: Optional[str] = Field(None, description="初始上下文")
    
class SessionUpdateRequest(BaseModel):
    session_name: Optional[str] = Field(None, description="会话名称")
    character_config: Optional[CharacterConfig] = Field(None, description="角色配置")
    context: Optional[str] = Field(None, description="上下文更新") #TODO：通过相似度获取上下文或记忆
    
#多模态请求
class VoiceGenerationRequest(BaseModel):
    text: str =Field(..., min_length=1, max_length=10000, description="转换的文本内容")
    voice_style: Optional[str] = Field(default="default", description="语音风格")
    emotion: Optional[EmotionType] = Field(default="neutral", description="情绪风格")
    speed: Optional[float] = Field(default=1.0, ge=0.5, le=2.0, description="语速")
    pitch: Optional[float] = Field(default=1.0, ge=0.5, le=2.0, description="音调")
    
class AnimationGenerationRequest(BaseModel):
    emotion: EmotionType = Field(..., description="目标情绪")
    duration: Optional[float] = Field(default=3.0, ge=0.5, le=30.0, description="动画持续时间(秒)")
    style: Optional[str] = Field(default="default", description="动画风格")
    intensity: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="表现强度")

#批量处理请求
class BatchChatRequest(BaseModel):
    requests: List[ChatCompletionRequest] = Field(..., min_length=1, max_length=10, description="批量请求列表")
    batch_id: Optional[str] = Field(None, description="批次ID")
    parallel_processing: Optional[bool] = Field(default=True, description="是否并行处理")
    
#健康检查请求
class HealthCheckRequest(BaseModel):
    deep_check: Optional[bool] = Field(default=False, description="是否深度检查")
    check_models: Optional[bool] = Field(default=True, description="是否检查模型状态")
    check_adapters: Optional[bool] = Field(default=True, description="是否检查适配器状态")

#验证器和工具函数
def validate_session_id(session_id: str)->bool:
    if not session_id:
        return False
    if len(session_id) < 8 or len(session_id) > 64:
        return False
    return True

def validate_character_name(adapter_name: str)->bool:
    if not adapter_name:
        return False
    if not adapter_name.replace('-', '').replace('_', '').isalnum():
        return False
    return True
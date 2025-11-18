import asyncio
import json
import time
import uuid
from typing import AsyncGenerator, List, Dict, Any, Optional, Union, Tuple
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError, field_validator
import logging
from logging import Logger

from zishu.api.dependencies import (
    get_logger,
    get_performance_monitor,
    get_thread_factory_from_deps,
    get_character_config,
    submit_task,
    get_task_result,
    get_adapter_manager,
)
from zishu.api.schemas.chat import (
    Message,
    MessageRole,
    MessageType,
    EmotionType,
    CharacterConfig,
    ChatModel,
)
from zishu.api.schemas.request import ChatCompletionRequest
# from zishu.training.train.inference import get_inference_engine  # 延迟导入，避免启动时失败
from zishu.utils.cache_manager import ModelResponseCache


# 请求/响应模型
class ChatRequest(BaseModel):
    """对话完成请求(兼容OpenAI)"""

    messages: List[Dict[str, str]] = Field(..., description="对话消息列表")
    model: Optional[str] = Field(None, description="模型ID")
    adapter: Optional[str] = Field(None, description="适配器ID")
    character_id: Optional[str] = Field(None, description="角色ID")
    system_prompt: Optional[str] = Field(None, description="系统提示词（角色设定）")
    max_tokens: Optional[int] = Field(None, ge=1, le=8192, description="最大token数量")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    top_p: Optional[float] = Field(0.9, ge=0.0, le=1.0, description="top-p采样参数")
    stop: Optional[Union[str, List[str]]] = Field(None, description="停止生成条件")
    stream: bool = Field(False, description="是否流式生成")
    user: Optional[str] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        """验证消息格式和角色"""
        valid_roles = {"user", "assistant", "system", "function"}
        for msg in v:
            if not isinstance(msg, dict):
                raise ValueError("消息必须是字典格式")
            if "role" not in msg:
                raise ValueError("消息必须包含role字段")
            if "content" not in msg:
                raise ValueError("消息必须包含content字段")
            if msg["role"] not in valid_roles:
                raise ValueError(f"无效的消息角色: {msg['role']}, 有效角色: {valid_roles}")
        return v


class StreamChatRequest(BaseModel):
    """流式聊天请求"""

    messages: str = Field(..., min_length=1, max_length=10000, description="对话消息")
    model: Optional[str] = Field(None, description="模型ID")
    adapter: Optional[str] = Field(None, description="适配器ID")
    character_id: Optional[str] = Field(None, description="角色ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    context: Optional[str] = Field(None, description="上下文")


class EmotionChatRequest(BaseModel):
    """情绪对话请求"""

    messages: str = Field(..., min_length=1, max_length=10000, description="对话消息")
    current_emotion: Optional[EmotionType] = Field(None, description="当前情绪")
    character_id: Optional[str] = Field(None, description="角色ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    emotion_intensity: Optional[float] = Field(0.5, ge=0.0, le=1.0, description="情绪强度")
    analyze_emotion: bool = Field(True, description="是否分析情绪")


class ChatChoice(BaseModel):
    """对话选择"""

    index: int = Field(..., description="选择索引")
    message: Message = Field(..., description="消息内容")
    finish_reason: Optional[str] = Field(None, description="完成原因")


class ChatUsage(BaseModel):
    """token使用统计"""

    prompt_tokens: int = Field(..., description="提示token数量")
    completion_tokens: int = Field(..., description="完成token数量")
    total_tokens: int = Field(..., description="总token数量")


class ChatCompletionResponse(BaseModel):
    """对话完成响应"""

    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:24]}")
    object: str = Field(default="chat.completion")
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str = Field(..., description="模型ID")
    choices: List[ChatChoice] = Field(..., description="响应选择")
    usage: ChatUsage = Field(..., description="token使用统计")
    session_id: Optional[str] = Field(None, description="会话ID")


class StreamChunk(BaseModel):
    """流式响应块"""

    id: str = Field(...)
    object: str = Field(default="chat.completion.chunk")
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str = Field(...)
    choices: List[Dict[str, Any]] = Field(...)


class EmotionResponse(BaseModel):
    """情绪响应"""

    message: Message = Field(..., description="回复消息")
    user_emotion: Optional[EmotionType] = Field(None, description="分析的用户情绪")
    response_emotion: Optional[EmotionType] = Field(None, description="回复的情绪")
    emotion_confidence: Optional[float] = Field(
        ..., ge=0.0, le=1.0, description="情绪置信度"
    )
    session_id: Optional[str] = Field(None, description="会话ID")


class HistoryResponse(BaseModel):
    """对话历史响应"""

    session_id: Optional[str] = Field(..., description="会话ID")
    messages: List[Message] = Field(..., description="对话消息列表")
    total_count: int = Field(..., description="总消息数量")
    character_id: Optional[CharacterConfig] = Field(None, description="角色配置")


# 辅助类
class ChatSessionManager:
    """对话会话管理器"""

    def __init__(self):
        self.sessions: Dict[str, List[Message]] = {}
        self.session_configs: Dict[str, Dict[str, Any]] = {}

    async def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """获取或创建对话会话"""
        if not session_id:
            session_id = f"session_{uuid.uuid4().hex[:16]}"

        if session_id not in self.sessions:
            self.sessions[session_id] = []
            self.session_configs[session_id] = {
                "created_at": datetime.now(),
                "last_activity": datetime.now(),
            }

        return session_id

    async def add_message(self, session_id: str, message: Message) -> None:
        """添加消息到对话会话"""
        if session_id not in self.sessions:
            await self.get_or_create_session(session_id)

        self.sessions[session_id].append(message)
        self.session_configs[session_id]["last_activity"] = datetime.now()

        # 限制会话历史长度
        if len(self.sessions[session_id]) > 100:
            self.sessions[session_id] = self.sessions[session_id][-50:]

    async def get_messages(
        self, session_id: str, limit: Optional[int] = None
    ) -> List[Message]:
        """获取对话会话消息"""
        if session_id not in self.sessions:
            return []

        messages = self.sessions[session_id]
        if limit:
            return messages[-limit:]
        return messages

    async def get_context_messages(
        self, session_id: str, max_context_length: int = 10
    ) -> List[Dict[str, Any]]:
        """获取对话会话上下文消息"""
        messages = await self.get_messages(session_id, max_context_length)
        return [{"role": msg.role.value, "content": msg.content} for msg in messages]


class EmotionAnalyzer:
    """情绪分析器"""

    # TODO： 结合记忆适配器框架，结合记忆进行情绪分析
    def __init__(self):
        self.emotion_keywords = {
            EmotionType.HAPPY: ["开心", "高兴", "快乐", "愉快", "兴奋"],
            EmotionType.SAD: ["难过", "伤心", "沮丧", "失落", "抑郁"],
            EmotionType.ANGRY: ["生气", "愤怒", "恼火", "烦躁"],
            EmotionType.SURPRISED: ["惊讶", "震惊", "意外"],
            EmotionType.FEARFUL: ["害怕", "恐惧", "担心", "焦虑"],
            EmotionType.NEUTRAL: ["中性", "平静", "冷漠", "无动于衷", "无感"],
            # 可以扩展更多情绪关键词
        }

    async def analyze_emotion(self, text: str) -> Tuple[EmotionType, float]:
        """分析情绪"""

        # TODO: 可替换为更复杂的情绪分析模型,结合角色配置和用户情绪，生成回复情绪
        emotion_scores = {}

        for emotion, keywords in self.emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                emotion_scores[emotion] = score / len(keywords)

        if emotion_scores:
            best_emotion = max(emotion_scores.items(), key=lambda x: x[1])[0]
            return best_emotion[0], min(best_emotion[1], 1.0)

        return EmotionType.NEUTRAL, 0.5

    async def generate_response_emotion(
        self,
        user_emotion: EmotionType,
        character_config: Optional[CharacterConfig] = None,
    ) -> EmotionType:
        emotion_map = {
            EmotionType.HAPPY: EmotionType.HAPPY,
            EmotionType.SAD: EmotionType.CALM,
            EmotionType.ANGRY: EmotionType.CALM,
            EmotionType.FEARFUL: EmotionType.CALM,
            EmotionType.SURPRISED: EmotionType.CURIOUS,
            EmotionType.NEUTRAL: EmotionType.CALM,
        }

        return emotion_map.get(user_emotion, EmotionType.NEUTRAL)


# 依赖函数
async def get_inference_engine_dep():
    """获取推理引擎依赖"""
    try:
        from zishu.training.train.inference import get_inference_engine
        return get_inference_engine()
    except Exception as e:
        # 推理引擎不可用时返回None，允许使用第三方适配器
        import logging
        logging.getLogger(__name__).warning(f"推理引擎不可用: {e}")
        return None


async def get_session_manager() -> ChatSessionManager:
    """获取对话会话管理器"""
    # 这里可以使用依赖注入或单例模式
    if not hasattr(get_session_manager, "_instance"):
        get_session_manager._instance = ChatSessionManager()
    return get_session_manager._instance


async def get_emotion_analyzer() -> EmotionAnalyzer:
    """获取情绪分析器"""
    if not hasattr(get_emotion_analyzer, "_instance"):
        get_emotion_analyzer._instance = EmotionAnalyzer()
    return get_emotion_analyzer._instance


async def get_response_cache() -> ModelResponseCache:
    """获取响应缓存"""
    if not hasattr(get_response_cache, "_instance"):
        get_response_cache._instance = ModelResponseCache(max_size=1000, ttl=3600)
    return get_response_cache._instance


# 路由定义
router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)


@router.post("/completions", response_model=ChatCompletionResponse)
async def chat_completions(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    inference_engine=Depends(get_inference_engine_dep),
    session_manager: ChatSessionManager = Depends(get_session_manager),
    response_cache: ModelResponseCache = Depends(get_response_cache),
    logger: Logger = Depends(get_logger),
    adapter_manager=Depends(get_adapter_manager),
):
    """
    对话完成接口(兼容OpenAI)
    支持多轮对话、角色配置、适配器切换
    """
    try:
        # 会话管理
        session_id = await session_manager.get_or_create_session(request.session_id)

        # 构建完整的消息历史, TODO: 可从记忆适配器获取消息
        if request.messages:
            # 转换为标准格式
            messages = []
            for msg in request.messages:
                if isinstance(msg, dict):
                    messages.append(msg)
                else:
                    # 如果是字符串，假设是用户消息
                    messages.append({"role": "user", "content": str(msg)})

        else:
            # 从会话历史获取消息
            context_messages = await session_manager.get_context_messages(session_id)
            messages = context_messages
        
        # 🎯 如果有角色ID，添加角色的system prompt
        if request.character_id:
            # 检查是否已有system消息
            has_system_msg = any(msg.get("role") == "system" for msg in messages)
            
            if not has_system_msg and request.system_prompt:
                # 在消息列表开头插入system prompt
                messages.insert(0, {
                    "role": "system",
                    "content": request.system_prompt
                })
                logger.info(f"已添加角色system prompt: {request.system_prompt[:50]}...")
            elif not has_system_msg:
                logger.warning(f"角色 {request.character_id} 没有提供system_prompt")

        # cache检查
        cache_key = f"chat:{hash(str(messages))}:{request.model}:{request.character_id}"
        try:
            cached_response = response_cache.get(cache_key)
            if cached_response and not request.stream:
                logger.info(f"Return cached response:session_id={session_id}")
                return json.loads(cached_response)
        except Exception as cache_error:
            logger.warning(f"缓存检查失败: {cache_error}")

        # 生成响应
        if request.stream:
            return StreamingResponse(
                _stream_chat_response(
                    messages,
                    request,
                    session_id,
                    inference_engine,
                    logger,
                    session_manager,
                ),
                media_type="text/plain",
            )

        # 非流式响应
        start_time = time.time()
        response_text = await _generate_chat_response(
            messages, request, inference_engine, logger, adapter_manager
        )

        # 构建响应消息
        assistant_message = Message(
            role=MessageRole.ASSISTANT,
            content=response_text,
            session_id=session_id,
            processing_time=time.time() - start_time,
        )

        # 保存到会话历史
        if messages:
            user_message = Message(
                role=MessageRole.USER,
                content=messages[-1].get("content", ""),
                session_id=session_id,
            )
            await session_manager.add_message(session_id, user_message)

        await session_manager.add_message(session_id, assistant_message)

        # 构建完整响应
        response = ChatCompletionResponse(
            model=request.model or "default",
            choices=[
                ChatChoice(index=0, message=assistant_message, finish_reason="stop")
            ],
            usage=ChatUsage(
                prompt_tokens=len(
                    " ".join([msg.get("content", "") for msg in messages])
                ),
                completion_tokens=len(response_text),
                total_tokens=len("".join(msg.get("content", "") for msg in messages))
                + len(response_text),
            ),
            session_id=session_id,
        )

        # cache响应
        try:
            background_tasks.add_task(
                response_cache.set, cache_key, response.model_dump_json()
            )
        except Exception as cache_error:
            logger.warning(f"缓存设置失败: {cache_error}")

        logger.info(
            f"Chat completion response:session_id={session_id} time={time.time() - start_time:.2f}s"
        )
        return response

    except ValidationError as e:
        logger.error(f"Request verification failed: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Dialog processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Dialog processing failed")


@router.post("/stream", response_class=StreamingResponse)
async def stream_chat(
    request: StreamChatRequest,
    inference_engine=Depends(get_inference_engine_dep),
    session_manager: ChatSessionManager = Depends(get_session_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    流式对话接口
    实时返回生成内容
    """
    try:
        session_id = await session_manager.get_or_create_session(request.session_id)

        # 构建消息历史
        context_messages = await session_manager.get_context_messages(session_id, 10)
        messages = context_messages + [{"role": "user", "content": request.messages}]

        return StreamingResponse(
            _stream_chat_response_simple(
                messages, request, session_id, inference_engine, session_manager, logger
            ),
            media_type="text/event-stream",
        )

    except Exception as e:
        logger.error(f"Stream chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Stream chat failed")


@router.post("/emotion", response_model=EmotionResponse)
async def emotion_chat(
    request: EmotionChatRequest,
    inference_engine=Depends(get_inference_engine_dep),
    session_manager: ChatSessionManager = Depends(get_session_manager),
    emotion_analyzer: EmotionAnalyzer = Depends(get_emotion_analyzer),
    character_config: CharacterConfig = Depends(get_character_config),
    logger: logging.Logger = Depends(get_logger),
):
    """
    带情绪的对话接口
    根据用户情绪生成回复情绪
    """
    start_time = time.time()

    try:
        session_id = await session_manager.get_or_create_session(request.session_id)

        # 分析用户情绪
        user_emotion = request.current_emotion
        emotion_confidence = 1.0

        if request.analyze_emotion:
            user_emotion, emotion_confidence = await emotion_analyzer.analyze_emotion(
                request.messages
            )

        # 生成回应情绪
        response_emotion = await emotion_analyzer.generate_response_emotion(
            user_emotion, character_config
        )

        # 构建带情绪的消息历史
        context_messages = await session_manager.get_context_messages(session_id, 5)
        messages = context_messages + [{"role": "user", "content": request.messages}]

        # 生成回应(可以将情绪消息加入到生成参数中)
        response_text = await _generate_emotion_response(
            messages, request, user_emotion, response_emotion, inference_engine, logger
        )

        # 构建响应消息
        assistant_message = Message(
            role=MessageRole.ASSISTANT,
            content=response_text,
            session_id=session_id,
            emotion=response_emotion,
            emotion_intensity=request.emotion_intensity,
            processing_time=time.time() - start_time,
        )

        # 保存到会话历史
        user_message = Message(
            role=MessageRole.USER,
            content=request.messages,
            session_id=session_id,
            emotion=user_emotion,
            emotion_intensity=emotion_confidence,
            processing_time=time.time() - start_time,
        )

        await session_manager.add_message(session_id, user_message)
        await session_manager.add_message(session_id, assistant_message)

        # 构建响应
        response = EmotionResponse(
            message=assistant_message,
            user_emotion=user_emotion,
            response_emotion=response_emotion,
            emotion_confidence=emotion_confidence,
            session_id=session_id,
        )
        logger.info(
            f"Emotion chat response:session_id={session_id} user_emotion={user_emotion} response_emotion={response_emotion}"
        )
        return response

    except Exception as e:
        logger.error(f"Emotion chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Emotion chat failed")


@router.get("/history/{session_id}", response_model=HistoryResponse)
async def get_chat_history(
    session_id: str,
    limit: Optional[int] = None,
    session_manager: ChatSessionManager = Depends(get_session_manager),
    character_config: CharacterConfig = Depends(get_character_config),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取对话历史记录
    支持分页和数量限制
    """
    try:
        messages = await session_manager.get_messages(session_id, limit)

        response = HistoryResponse(
            session_id=session_id,
            messages=messages,
            total_count=len(messages),
            character_config=character_config,
        )
        logger.info(
            f"Get chat history:session_id={session_id} total_count={len(messages)}"
        )
        return response

    except Exception as e:
        logger.error(f"Failed to get chat history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get chat history")


@router.delete("/history/{session_id}")
async def clear_chat_history(
    session_id: str,
    session_manager: ChatSessionManager = Depends(get_session_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    清除指定对话历史记录
    """
    try:
        if session_id in session_manager.sessions:
            del session_manager.sessions[session_id]
            del session_manager.session_configs[session_id]

        logger.info(f"Clear chat history:session_id={session_id}")
        return {
            "message": "Chat history cleared successfully",
            "session_id": session_id,
        }

    except Exception as e:
        logger.error(f"Failed to clear chat history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear chat history")


# 辅助函数
async def _generate_chat_response(
    messages: List[Dict[str, str]],
    request: ChatCompletionRequest,
    inference_engine,
    logger: Logger,
    adapter_manager=None,
) -> str:
    """生成普通对话响应"""
    try:
        # 如果指定了适配器，使用适配器进行响应
        if request.adapter and adapter_manager:
            try:
                adapter = adapter_manager._adapters.get(request.adapter)
                
                # 如果适配器不在运行列表中，尝试启动它
                if not adapter:
                    logger.info(f"适配器 {request.adapter} 未在运行列表中，尝试启动...")
                    try:
                        start_success = await adapter_manager.start_adapter(request.adapter)
                        if start_success:
                            adapter = adapter_manager._adapters.get(request.adapter)
                            logger.info(f"适配器 {request.adapter} 启动成功")
                        else:
                            logger.warning(f"适配器 {request.adapter} 启动失败")
                    except Exception as start_error:
                        logger.error(f"启动适配器失败: {start_error}")
                
                if adapter:
                    logger.info(f"使用适配器生成响应: {request.adapter}")
                    from zishu.adapters.base import ExecutionContext
                    from zishu.adapters.soft import SoftAdapterRequest, SoftAdapterMode
                    
                    # 构建软适配器请求
                    soft_request = SoftAdapterRequest(
                        query="",  # query在messages中
                        mode=SoftAdapterMode.CONVERSATION,
                        context={"messages": messages},
                        temperature=request.temperature,
                        max_tokens=request.max_tokens,
                    )
                    
                    exec_context = ExecutionContext(
                        request_id=f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                        user_id=request.user or "default_user",
                    )
                    
                    result = await adapter.process(soft_request, exec_context)
                    
                    # 检查执行状态
                    if hasattr(result, 'status') and result.status != 'success':
                        error_msg = result.error or "未知错误"
                        logger.error(f"适配器执行失败: {error_msg}")
                        raise Exception(f"适配器执行失败: {error_msg}")
                    
                    # ExecutionResult 使用 output 属性，而不是 content
                    if hasattr(result, 'output') and result.output:
                        output = result.output
                        
                        # 如果 output 是字符串，直接返回
                        if isinstance(output, str):
                            return output.strip()
                        
                        # 如果 output 有 content 属性（如 SoftAdapterResponse）
                        if hasattr(output, 'content'):
                            return str(output.content).strip()
                        
                        # 如果 output 是字典，尝试获取 content
                        if isinstance(output, dict):
                            content = output.get('content', output.get('text', ''))
                            if content:
                                return str(content).strip()
                            return str(output).strip()
                        
                        # 其他情况，尝试转换为字符串
                        logger.warning(f"未知的 output 类型: {type(output)}, 尝试转换为字符串")
                        return str(output).strip()
                    
                    # 兼容旧版本的 content 属性
                    elif hasattr(result, 'content'):
                        return result.content.strip()
                    else:
                        logger.error(f"适配器返回结果格式异常: {type(result)}, status={getattr(result, 'status', 'unknown')}")
                        return "抱歉，适配器返回结果格式异常"
                else:
                    logger.warning(f"适配器未找到或无法启动: {request.adapter}，使用默认推理引擎")
            except Exception as e:
                logger.error(f"适配器调用失败: {e}，回退到默认推理引擎")
                import traceback
                logger.error(f"详细错误: {traceback.format_exc()}")
        
        # 使用默认推理引擎
        if inference_engine is None:
            logger.error("没有可用的推理引擎且未指定适配器")
            return "抱歉，当前未配置推理引擎。请在角色模板中配置 API 适配器（如 OpenAI、Claude 等）来使用聊天功能。"
        
        response = inference_engine.chat_generate(
            messages=messages,
            model_id=request.model,
            character_id=request.character_id,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            stop=request.stop,
        )

        return response.strip()

    except Exception as e:
        logger.error(f"Failed to generate chat response: {e}")
        raise


async def _generate_emotion_response(
    messages: List[Dict[str, str]],
    request: EmotionChatRequest,
    user_emotion: EmotionType,
    response_emotion: EmotionType,
    inference_engine,
    logger: Logger,
) -> str:
    """生成带情绪的对话响应"""
    try:
        # 在系统提示中加入情绪消息
        emotion_prompt = f"用户当前情绪: {user_emotion}, 回复情绪: {response_emotion}"

        # 修改消息历史，加入情绪消息
        enhanced_messages = messages.copy()
        if enhanced_messages and enhanced_messages[0]["role"] == "system":
            enhanced_messages[0]["content"] += f"\n{emotion_prompt}"

        else:
            enhanced_messages.insert(0, {"role": "system", "content": emotion_prompt})

        response = inference_engine.chat_generate(
            messages=enhanced_messages,
            character_id=request.character_id,
            temperature=0.8,  # 情绪对话使用较高温度
        )
        return response.strip()

    except Exception as e:
        logger.error(f"Failed to generate emotion response: {e}")
        raise


async def _stream_chat_response_simple(
    messages: List[Dict[str, str]],
    request: StreamChatRequest,
    session_id: str,
    inference_engine,
    session_manager: ChatSessionManager,
    logger: Logger,
) -> AsyncGenerator[str, None]:
    """流式对话响应生成器"""
    try:
        # TODO: 目前目前的推理引擎不支持流式，这里提供框架结构，需要实现流式生成逻辑

        chunk_id = f"chatcmpl-{uuid.uuid4().hex[:29]}"

        # 模拟流式响应(实际应该调用推理引擎的流式接口)
        # 创建临时request对象用于调用_generate_chat_response
        temp_request = ChatCompletionRequest(
            messages=[
                {"role": msg["role"], "content": msg["content"]} for msg in messages
            ],
            model=request.model,
            character_id=request.character_id,
        )
        response_text = await _generate_chat_response(
            messages, temp_request, inference_engine, logger
        )

        for i, char in enumerate(response_text):
            chunk_data = {
                "id": chunk_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": request.model or "default",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": char},
                        "finish_reason": None if i < len(response_text) - 1 else "stop",
                    }
                ],
            }
            yield f"data: {json.dumps(chunk_data)}\n\n"
            await asyncio.sleep(0.01)

        # 发送结束块
        final_chunk_data = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": request.model or "default",
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        yield f"data: {json.dumps(final_chunk_data)}\n\n"
    except Exception as e:
        logger.error(f"Failed to stream chat response: {e}")
        error_chunk = {
            "error": {
                "message": str(e),
                "type": "stream_error",
            }
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"


async def _stream_chat_response(
    messages: List[Dict[str, str]],
    request: ChatCompletionRequest,
    session_id: str,
    inference_engine,
    logger: Logger,
    session_manager: ChatSessionManager,
) -> AsyncGenerator[str, None]:
    """简化的流式对话响应生成器"""
    try:
        response_text = inference_engine.chat_generate(
            messages=messages,
            model_id=request.model,
            character_id=request.character_id,
        )
        # 逐字符流式输出
        for char in response_text:
            yield f"data: {json.dumps({'delta': {'content': char}})}\n\n"
            await asyncio.sleep(0.01)

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error(f"Failed to simplified stream chat response: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

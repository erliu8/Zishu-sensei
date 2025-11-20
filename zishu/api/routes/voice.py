"""
语音对话 WebSocket 路由
提供实时语音识别和合成服务
"""
import asyncio
import base64
import json
import logging
from typing import Dict, Optional, Any
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from ..services.voice_service import get_stt_service, get_tts_service, STTService, TTSService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceSession:
    """语音会话管理器"""
    
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.is_speaking = False
        self.audio_buffer = bytearray()
        self.stt_engine: Optional[STTService] = None
        self.tts_engine: Optional[TTSService] = None
        self.conversation_history = []
        self.min_audio_length = 16000 * 2 * 2  # 2秒的音频（16kHz, 16-bit）
        # 角色配置
        self.character_id: Optional[str] = None
        self.adapter_id: Optional[str] = None
        self.system_prompt: Optional[str] = None
        self.model: Optional[str] = None
        
    async def initialize(self, config: Dict[str, Any]):
        """初始化语音引擎"""
        try:
            stt_config = config.get("stt", {})
            tts_config = config.get("tts", {})
            
            self.stt_engine = await get_stt_service(stt_config)
            self.tts_engine = await get_tts_service(tts_config)
            
            # 保存角色配置
            self.character_id = config.get("character_id")
            self.adapter_id = config.get("adapter_id")
            self.system_prompt = config.get("system_prompt")
            self.model = config.get("model", "default")
            
            logger.info(f"初始化语音会话成功: {self.session_id}, 角色: {self.character_id}")
        except Exception as e:
            logger.error(f"初始化语音会话失败: {e}")
            raise
        
    async def process_audio_chunk(self, audio_data: bytes) -> Optional[str]:
        """处理音频数据块，返回识别的文本"""
        self.audio_buffer.extend(audio_data)
        
        # 当缓冲区达到最小长度时进行识别
        if len(self.audio_buffer) >= self.min_audio_length:
            audio_to_process = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            
            try:
                if self.stt_engine:
                    result = await self.stt_engine.transcribe(audio_to_process)
                    return result.get("text", "").strip()
            except Exception as e:
                logger.error(f"语音识别失败: {e}")
                
        return None
        
    async def synthesize_speech_stream(self, text: str):
        """将文本转换为语音流"""
        try:
            if self.tts_engine:
                async for audio_chunk in self.tts_engine.synthesize_stream(text):
                    yield audio_chunk
        except Exception as e:
            logger.error(f"语音合成失败: {e}")
            raise
        
    async def interrupt_speech(self):
        """打断当前语音播放"""
        self.is_speaking = False
        logger.info(f"语音播放已打断: {self.session_id}")


# 活动会话管理
active_sessions: Dict[str, VoiceSession] = {}


@router.websocket("/ws/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    session_id: str
):
    """
    WebSocket 语音对话端点
    
    消息格式:
    - 客户端 -> 服务器:
        - {"type": "config", "data": {...}} - 配置会话
        - {"type": "audio", "data": "base64_audio"} - 音频数据
        - {"type": "text", "data": "user_message"} - 文本消息
        - {"type": "interrupt"} - 打断语音
        - {"type": "close"} - 关闭会话
        
    - 服务器 -> 客户端:
        - {"type": "ready"} - 会话就绪
        - {"type": "transcription", "data": "text", "isFinal": bool} - 识别结果
        - {"type": "response", "data": "ai_message"} - AI 响应文本
        - {"type": "audio", "data": "base64_audio"} - 语音数据
        - {"type": "error", "message": "error"} - 错误消息
    """
    await websocket.accept()
    
    # 创建会话
    session = VoiceSession(websocket, session_id)
    active_sessions[session_id] = session
    
    try:
        # 发送就绪消息
        await websocket.send_json({
            "type": "ready",
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })
        
        while True:
            # 接收消息
            message = await websocket.receive_json()
            msg_type = message.get("type")
            
            if msg_type == "config":
                # 配置会话
                config = message.get("data", {})
                await session.initialize(config)
                await websocket.send_json({"type": "configured"})
                
            elif msg_type == "audio":
                # 处理音频数据
                audio_base64 = message.get("data")
                if audio_base64:
                    try:
                        audio_data = base64.b64decode(audio_base64)
                        
                        # 进行语音识别
                        text = await session.process_audio_chunk(audio_data)
                        
                        if text:
                            # 发送识别结果
                            await websocket.send_json({
                                "type": "transcription",
                                "data": text,
                                "isFinal": True
                            })
                            
                            # 获取 AI 响应
                            ai_response = await get_ai_response(text, session)
                            
                            # 发送文本响应
                            await websocket.send_json({
                                "type": "response",
                                "data": ai_response
                            })
                            
                            # 合成语音
                            session.is_speaking = True
                            
                            try:
                                async for chunk in session.synthesize_speech_stream(ai_response):
                                    if not session.is_speaking:
                                        # 被打断，停止发送音频
                                        logger.info(f"语音播放被打断: {session.session_id}")
                                        break
                                        
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": base64.b64encode(chunk).decode()
                                    })
                            except Exception as e:
                                logger.error(f"语音合成流失败: {e}")
                            finally:
                                session.is_speaking = False
                                await websocket.send_json({"type": "speech_end"})
                    except Exception as e:
                        logger.error(f"音频处理失败: {e}")
                        continue
                        
            elif msg_type == "text":
                # 处理文本消息
                text = message.get("data")
                if text:
                    # 获取 AI 响应
                    ai_response = await get_ai_response(text, session)
                    
                    # 发送文本响应
                    await websocket.send_json({
                        "type": "response",
                        "data": ai_response
                    })
                    
                    # 合成语音
                    session.is_speaking = True
                    
                    try:
                        async for chunk in session.synthesize_speech_stream(ai_response):
                            if not session.is_speaking:
                                # 被打断，停止发送音频
                                logger.info(f"语音播放被打断: {session.session_id}")
                                break
                                
                            await websocket.send_json({
                                "type": "audio",
                                "data": base64.b64encode(chunk).decode()
                            })
                    except Exception as e:
                        logger.error(f"语音合成流失败: {e}")
                    finally:
                        session.is_speaking = False
                        await websocket.send_json({"type": "speech_end"})
                    
            elif msg_type == "interrupt":
                # 打断语音
                await session.interrupt_speech()
                await websocket.send_json({"type": "interrupted"})
                
            elif msg_type == "close":
                # 关闭会话
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket 断开连接: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket 错误: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        # 清理会话
        if session_id in active_sessions:
            del active_sessions[session_id]
        await websocket.close()


async def get_ai_response(user_message: str, session: VoiceSession) -> str:
    """
    获取 AI 响应
    
    调用实际的聊天 API
    """
    try:
        # 添加用户消息到历史
        session.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        # 调用聊天 API
        from ..dependencies import get_adapter_manager
        adapter_manager = get_adapter_manager()
        
        # 构建请求数据
        request_data = {
            "messages": session.conversation_history,
            "model": session.model or "default",
            "character_id": session.character_id,
            "system_prompt": session.system_prompt,
            "adapter": session.adapter_id,
            "session_id": session.session_id,
            "temperature": 0.7,
            "max_tokens": 2000,
        }
        
        # 使用 httpx 调用本地聊天 API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/api/chat/completions",
                json=request_data,
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                ai_message = data.get("choices", [{}])[0].get("message", {}).get("content", "抱歉，我没有收到有效的回复。")
                
                # 添加 AI 响应到历史
                session.conversation_history.append({
                    "role": "assistant",
                    "content": ai_message
                })
                
                # 限制历史长度
                if len(session.conversation_history) > 20:
                    # 保留 system prompt（如果有）和最近的 10 条消息
                    system_msgs = [msg for msg in session.conversation_history if msg.get("role") == "system"]
                    recent_msgs = [msg for msg in session.conversation_history if msg.get("role") != "system"][-10:]
                    session.conversation_history = system_msgs + recent_msgs
                
                return ai_message
            else:
                logger.error(f"聊天 API 调用失败: {response.status_code}")
                return "抱歉，我遇到了一些问题。"
    except Exception as e:
        logger.error(f"获取 AI 响应失败: {e}")
        import traceback
        logger.error(f"详细错误: {traceback.format_exc()}")
        return "抱歉，我遇到了一些问题。"



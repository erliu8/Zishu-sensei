"""
FastAPI情绪中间件集成示例
展示如何将情绪处理中间件集成到FastAPI应用中
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import asyncio
import uvicorn

from zishu.api.middleware.emotion import (
    EmotionMiddleware,
    EmotionHTTPMiddleware,
    initialize_emotion_middleware,
    EmotionState,
    EmotionType
)
from zishu.api.schemas.chat import (
    CharacterConfig,
    PersonalityType,
    InteractionStyle,
    Message
)


# 请求/响应模型
class EmotionAnalysisRequest(BaseModel):
    text: str
    user_id: str
    context: Optional[Dict[str, Any]] = None


class EmotionAnalysisResponse(BaseModel):
    emotion: EmotionType
    intensity: float
    confidence: float
    context: Optional[str] = None
    triggers: List[str] = []


class ChatRequest(BaseModel):
    message: str
    user_id: str
    character_id: str = "zishu"


class ChatResponse(BaseModel):
    response: str
    emotion: EmotionType
    emotion_intensity: float
    voice_style: Optional[str] = None
    animation: Optional[str] = None
    emotion_context: Optional[str] = None


class EmotionStatsResponse(BaseModel):
    total_requests: int
    emotion_detected: int
    transitions_made: int
    average_processing_time: float
    memory_entries: int


# 创建FastAPI应用
app = FastAPI(
    title="Zishu情绪处理API",
    description="智能情绪分析和响应生成API",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
emotion_middleware: Optional[EmotionMiddleware] = None

# 角色配置
CHARACTER_CONFIGS = {
    "zishu": CharacterConfig(
        name="紫舒",
        display_name="紫舒",
        description="温柔可爱的AI助手",
        personality_type=PersonalityType.SHY,
        interaction_style=InteractionStyle.CASUAL,
        emotion_stability=0.6
    ),
    "cheerful_assistant": CharacterConfig(
        name="小阳",
        display_name="小阳",
        description="活泼开朗的AI助手",
        personality_type=PersonalityType.CHEERFUL,
        interaction_style=InteractionStyle.CASUAL,
        emotion_stability=0.4
    ),
    "calm_advisor": CharacterConfig(
        name="静雅",
        display_name="静雅",
        description="沉稳冷静的AI顾问",
        personality_type=PersonalityType.CALM,
        interaction_style=InteractionStyle.FORMAL,
        emotion_stability=0.9
    )
}


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    global emotion_middleware
    
    # 初始化情绪中间件
    emotion_config = {
        'primary_analyzer': 'rule_based',
        'enable_transition': True,
        'enable_memory': True,
        'memory_ttl': 3600,
        'max_memory_entries': 10000
    }
    
    emotion_middleware = initialize_emotion_middleware(emotion_config)
    
    # 添加情绪处理HTTP中间件
    app.add_middleware(EmotionHTTPMiddleware, emotion_middleware=emotion_middleware)
    
    print("🎭 情绪中间件已初始化")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    global emotion_middleware
    if emotion_middleware:
        # 清理资源
        emotion_middleware.cleanup_old_memories()
    print("👋 应用已关闭")


def get_emotion_middleware_dependency() -> EmotionMiddleware:
    """依赖注入：获取情绪中间件"""
    if emotion_middleware is None:
        raise HTTPException(status_code=500, detail="情绪中间件未初始化")
    return emotion_middleware


def get_character_config(character_id: str) -> CharacterConfig:
    """获取角色配置"""
    if character_id not in CHARACTER_CONFIGS:
        raise HTTPException(status_code=404, detail=f"角色 {character_id} 不存在")
    return CHARACTER_CONFIGS[character_id]


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "欢迎使用Zishu情绪处理API",
        "version": "1.0.0",
        "endpoints": {
            "emotion_analysis": "/emotion/analyze",
            "chat": "/chat",
            "stats": "/emotion/stats",
            "characters": "/characters"
        }
    }


@app.post("/emotion/analyze", response_model=EmotionAnalysisResponse)
async def analyze_emotion(
    request: EmotionAnalysisRequest,
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """分析文本情绪"""
    try:
        emotion_state = await middleware.analyze_user_emotion(
            text=request.text,
            user_id=request.user_id,
            context=request.context
        )
        
        return EmotionAnalysisResponse(
            emotion=emotion_state.emotion,
            intensity=emotion_state.intensity,
            confidence=emotion_state.confidence,
            context=emotion_state.context,
            triggers=emotion_state.triggers
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"情绪分析失败: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
async def chat_with_emotion(
    request: ChatRequest,
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """带情绪处理的聊天接口"""
    try:
        # 获取角色配置
        character_config = get_character_config(request.character_id)
        
        # 分析用户情绪
        user_emotion = await middleware.analyze_user_emotion(
            text=request.message,
            user_id=request.user_id
        )
        
        # 生成基础回复（这里简化处理）
        base_responses = {
            EmotionType.HAPPY: f"看到你这么开心我也很高兴呢~",
            EmotionType.SAD: f"我能感受到你的难过，我会陪伴你的。",
            EmotionType.ANGRY: f"我理解你的愤怒，让我们一起想办法解决问题。",
            EmotionType.EXCITED: f"你的兴奋感染了我，真的很棒！",
            EmotionType.CONFUSED: f"我来帮你理清思路吧。",
            EmotionType.CURIOUS: f"这是个很有趣的问题呢~",
            EmotionType.CALM: f"我们可以慢慢聊。",
            EmotionType.TIRED: f"你辛苦了，要注意休息哦。",
            EmotionType.ANXIOUS: f"别担心，我们一步一步来。",
            EmotionType.SURPRISED: f"确实很让人意外呢！"
        }
        
        base_response = base_responses.get(
            user_emotion.emotion, 
            "我在认真听你说话。"
        )
        
        # 生成角色响应情绪
        response_emotion = await middleware.generate_response_emotion(
            user_emotion=user_emotion,
            character_config=character_config,
            user_id=request.user_id
        )
        
        # 增强响应
        enhanced_response = await middleware.enhance_response(
            base_response=base_response,
            emotion_state=response_emotion,
            character_config=character_config
        )
        
        return ChatResponse(
            response=enhanced_response['text'],
            emotion=response_emotion.emotion,
            emotion_intensity=response_emotion.intensity,
            voice_style=enhanced_response.get('voice_style'),
            animation=enhanced_response.get('animation'),
            emotion_context=enhanced_response.get('emotion_context')
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天处理失败: {str(e)}")


@app.get("/emotion/stats", response_model=EmotionStatsResponse)
async def get_emotion_stats(
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """获取情绪处理统计信息"""
    try:
        stats = middleware.get_stats()
        
        return EmotionStatsResponse(
            total_requests=stats['total_requests'],
            emotion_detected=stats['emotion_detected'],
            transitions_made=stats['transitions_made'],
            average_processing_time=stats['average_processing_time'],
            memory_entries=stats['memory_entries']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计失败: {str(e)}")


@app.get("/characters")
async def get_characters():
    """获取可用角色列表"""
    return {
        "characters": [
            {
                "id": char_id,
                "name": config.name,
                "display_name": config.display_name,
                "description": config.description,
                "personality_type": config.personality_type.value,
                "interaction_style": config.interaction_style.value,
                "emotion_stability": config.emotion_stability
            }
            for char_id, config in CHARACTER_CONFIGS.items()
        ]
    }


@app.post("/emotion/cleanup")
async def cleanup_emotion_memory(
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """清理过期的情绪记忆"""
    try:
        middleware.cleanup_old_memories()
        stats = middleware.get_stats()
        
        return {
            "message": "情绪记忆清理完成",
            "remaining_entries": stats['memory_entries']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}")


@app.get("/emotion/user/{user_id}/history")
async def get_user_emotion_history(
    user_id: str,
    limit: int = 10,
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """获取用户情绪历史"""
    try:
        # 这里简化实现，实际应该从中间件获取历史数据
        memory_key = f"{user_id}_user"
        
        if memory_key in middleware.emotion_memories:
            memory = middleware.emotion_memories[memory_key]
            recent_emotions = list(memory.short_term)[-limit:]
            
            return {
                "user_id": user_id,
                "emotions": [
                    {
                        "emotion": emotion.emotion,
                        "intensity": emotion.intensity,
                        "timestamp": emotion.timestamp.isoformat(),
                        "context": emotion.context,
                        "triggers": emotion.triggers
                    }
                    for emotion in recent_emotions
                ],
                "dominant_emotion": memory.get_dominant_emotion(),
                "patterns": memory.patterns
            }
        else:
            return {
                "user_id": user_id,
                "emotions": [],
                "message": "没有找到该用户的情绪历史"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史失败: {str(e)}")


@app.post("/emotion/batch/analyze")
async def batch_analyze_emotions(
    requests: List[EmotionAnalysisRequest],
    middleware: EmotionMiddleware = Depends(get_emotion_middleware_dependency)
):
    """批量情绪分析"""
    try:
        if len(requests) > 100:
            raise HTTPException(status_code=400, detail="批量请求数量不能超过100")
        
        # 并发处理
        tasks = [
            middleware.analyze_user_emotion(
                text=req.text,
                user_id=req.user_id,
                context=req.context
            )
            for req in requests
        ]
        
        results = await asyncio.gather(*tasks)
        
        return {
            "results": [
                {
                    "emotion": result.emotion,
                    "intensity": result.intensity,
                    "confidence": result.confidence,
                    "context": result.context,
                    "triggers": result.triggers
                }
                for result in results
            ],
            "total_processed": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量分析失败: {str(e)}")


@app.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket, user_id: str):
    """WebSocket聊天接口（带情绪处理）"""
    await websocket.accept()
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_json()
            message = data.get("message", "")
            character_id = data.get("character_id", "zishu")
            
            if not message:
                await websocket.send_json({"error": "消息不能为空"})
                continue
            
            # 处理消息
            try:
                character_config = get_character_config(character_id)
                
                # 分析用户情绪
                user_emotion = await emotion_middleware.analyze_user_emotion(
                    text=message,
                    user_id=user_id
                )
                
                # 生成响应（简化）
                base_response = f"收到你的消息：{message}"
                
                response_emotion = await emotion_middleware.generate_response_emotion(
                    user_emotion=user_emotion,
                    character_config=character_config,
                    user_id=user_id
                )
                
                enhanced_response = await emotion_middleware.enhance_response(
                    base_response=base_response,
                    emotion_state=response_emotion,
                    character_config=character_config
                )
                
                # 发送响应
                await websocket.send_json({
                    "response": enhanced_response['text'],
                    "user_emotion": {
                        "emotion": user_emotion.emotion,
                        "intensity": user_emotion.intensity
                    },
                    "character_emotion": {
                        "emotion": response_emotion.emotion,
                        "intensity": response_emotion.intensity
                    },
                    "voice_style": enhanced_response.get('voice_style'),
                    "animation": enhanced_response.get('animation')
                })
                
            except Exception as e:
                await websocket.send_json({"error": f"处理消息失败: {str(e)}"})
                
    except Exception as e:
        print(f"WebSocket连接错误: {e}")
    finally:
        await websocket.close()


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "emotion_middleware": emotion_middleware is not None,
        "timestamp": "2024-01-01T00:00:00Z"
    }


if __name__ == "__main__":
    print("🚀 启动Zishu情绪处理API服务器")
    print("📝 API文档: http://localhost:8000/docs")
    print("🎭 情绪分析: http://localhost:8000/emotion/analyze")
    print("💬 聊天接口: http://localhost:8000/chat")
    
    uvicorn.run(
        "fastapi_emotion_integration:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

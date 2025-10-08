#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
角色配置路由模块
提供完整的角色管理、情绪控制、模板管理和适配器集成功能
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import logging
import uuid
import json

# 导入schemas
from ..schemas.chat import (
    # 模型类
    CharacterConfig,
    CharacterState,
    EmotionTransition,
    CharacterTemplate_Model,
    # 枚举类
    EmotionType,
    PersonalityType,
    VoiceStyle,
    AnimationType,
    CharacterTemplate,
    InteractionStyle,
    ResponseStrategy,
    # 请求模型
    CreateCharacterRequest,
    UpdateCharacterRequest,
    SetEmotionRequest,
    EmotionAnalysisRequest,
    CharacterInteractionRequest,
    BatchCharacterOperation,
    # 响应模型
    CharacterResponse,
    CharacterListResponse,
    EmotionResponse,
    EmotionAnalysisResponse,
    CharacterStateResponse,
    TemplateListResponse,
    CharacterInteractionResponse,
    BatchOperationResponse,
    SystemStatsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/character", tags=["角色管理"])

# ======================== 全局变量和配置 ========================

# 内存存储（生产环境应使用数据库）
CHARACTER_STORE: Dict[str, CharacterConfig] = {}
CHARACTER_STATES: Dict[str, CharacterState] = {}
EMOTION_HISTORY: Dict[str, List[Dict[str, Any]]] = {}

# 预定义角色模板
PREDEFINED_TEMPLATES = {
    CharacterTemplate.ZISHU_BASE: CharacterTemplate_Model(
        template_id=CharacterTemplate.ZISHU_BASE,
        name="紫舒基础版",
        description="温柔可爱的AI助手，具有害羞的性格特点",
        config=CharacterConfig(
            name="紫舒",
            display_name="紫舒",
            description="我是紫舒，一个温柔可爱的AI助手~",
            personality_type=PersonalityType.SHY,
            personality_traits=["温柔", "害羞", "可爱", "善解人意"],
            interaction_style=InteractionStyle.INTIMATE,
            response_strategy=ResponseStrategy.EMPATHETIC,
            verbosity_level=0.8,
            creativity_level=0.7,
            default_voice=VoiceStyle.SWEET,
            voice_styles=[VoiceStyle.SWEET, VoiceStyle.CUTE, VoiceStyle.SOFT],
            animations=[
                AnimationType.HAPPY,
                AnimationType.THINKING,
                AnimationType.SURPRISED,
            ],
        ),
        tags=["可爱", "温柔", "害羞", "日系"],
    ),
    CharacterTemplate.ZISHU_CARING: CharacterTemplate_Model(
        template_id=CharacterTemplate.ZISHU_CARING,
        name="紫舒关怀版",
        description="更加关心用户的贴心版本",
        config=CharacterConfig(
            name="紫舒",
            display_name="紫舒（关怀版）",
            description="我会用心关怀你的每一个需求~",
            personality_type=PersonalityType.CARING,
            personality_traits=["温暖", "体贴", "关怀", "善良"],
            interaction_style=InteractionStyle.SUPPORTIVE,
            response_strategy=ResponseStrategy.EMPATHETIC,
            verbosity_level=0.9,
            emotion_stability=0.8,
        ),
        tags=["关怀", "温暖", "支持"],
    ),
}

# ======================== 工具函数 ========================


async def get_character_by_id(character_id: str) -> Optional[CharacterConfig]:
    """根据ID获取角色配置"""
    return CHARACTER_STORE.get(character_id)


async def save_character(character: CharacterConfig) -> bool:
    """保存角色配置"""
    try:
        character.updated_at = datetime.now()
        CHARACTER_STORE[character.id] = character

        # 初始化角色状态
        if character.id not in CHARACTER_STATES:
            CHARACTER_STATES[character.id] = CharacterState(
                character_id=character.id,
                current_emotion=character.default_emotion,
                emotion_intensity=0.5,
            )

        logger.info(f"角色配置已保存: {character.name} ({character.id})")
        return True
    except Exception as e:
        logger.error(f"保存角色配置失败: {e}")
        return False


async def analyze_emotion_from_text(
    text: str, context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """从文本分析情绪（简化版实现）"""
    # 简化的情绪分析逻辑，生产环境应使用NLP模型
    emotion_keywords = {
        EmotionType.HAPPY: ["开心", "高兴", "快乐", "兴奋", "愉快", "满意"],
        EmotionType.SAD: ["难过", "伤心", "沮丧", "失望", "抑郁", "悲伤"],
        EmotionType.ANGRY: ["生气", "愤怒", "恼火", "不满", "烦躁"],
        EmotionType.SURPRISED: ["惊讶", "意外", "震惊", "吃惊"],
        EmotionType.CONFUSED: ["困惑", "迷茫", "不明白", "奇怪"],
        EmotionType.EXCITED: ["激动", "兴奋", "热血", "期待"],
        EmotionType.CALM: ["平静", "冷静", "淡定", "放松"],
    }

    detected_emotions = []
    for emotion, keywords in emotion_keywords.items():
        for keyword in keywords:
            if keyword in text:
                detected_emotions.append(
                    {
                        "emotion": emotion,
                        "confidence": 0.8,  # 简化的置信度
                        "keyword": keyword,
                    }
                )

    if not detected_emotions:
        # 默认中性情绪
        detected_emotions.append(
            {"emotion": EmotionType.NEUTRAL, "confidence": 0.6, "keyword": "中性"}
        )

    # 选择最高置信度的情绪作为主要情绪
    primary_emotion = max(detected_emotions, key=lambda x: x["confidence"])

    return {
        "detected_emotions": detected_emotions,
        "primary_emotion": primary_emotion["emotion"],
        "confidence": primary_emotion["confidence"],
        "keywords": [e["keyword"] for e in detected_emotions],
    }


async def update_character_state(
    character_id: str, emotion: EmotionType, intensity: float = 0.7, reason: str = None
) -> CharacterState:
    """更新角色状态"""
    if character_id not in CHARACTER_STATES:
        CHARACTER_STATES[character_id] = CharacterState(
            character_id=character_id,
            current_emotion=emotion,
            emotion_intensity=intensity,
        )

    state = CHARACTER_STATES[character_id]
    previous_emotion = state.current_emotion

    # 更新状态
    state.current_emotion = emotion
    state.emotion_intensity = intensity
    state.conversation_count += 1
    state.last_interaction = datetime.now()
    state.updated_at = datetime.now()

    # 记录情绪历史
    if character_id not in EMOTION_HISTORY:
        EMOTION_HISTORY[character_id] = []

    EMOTION_HISTORY[character_id].append(
        {
            "from_emotion": previous_emotion,
            "to_emotion": emotion,
            "intensity": intensity,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
        }
    )

    # 限制历史记录长度
    if len(EMOTION_HISTORY[character_id]) > 100:
        EMOTION_HISTORY[character_id] = EMOTION_HISTORY[character_id][-100:]

    return state


# ======================== 角色配置管理路由 ========================


@router.post("/", response_model=CharacterResponse, summary="创建新角色")
async def create_character(request: CreateCharacterRequest):
    """
    创建新的角色配置

    - **name**: 角色名称（必填）
    - **display_name**: 显示名称（必填）
    - **template**: 基于的模板（可选）
    - **custom_config**: 自定义配置（可选）
    """
    try:
        # 基于模板创建配置
        if request.template and request.template in PREDEFINED_TEMPLATES:
            base_config = PREDEFINED_TEMPLATES[request.template].config.model_copy()
            base_config.id = str(uuid.uuid4())
            base_config.name = request.name
            base_config.display_name = request.display_name
        else:
            base_config = CharacterConfig(
                name=request.name, display_name=request.display_name
            )

        # 应用请求中的配置
        if request.description:
            base_config.description = request.description
        if request.personality_type:
            base_config.personality_type = request.personality_type
        if request.interaction_style:
            base_config.interaction_style = request.interaction_style

        # 应用自定义配置
        if request.custom_config:
            for key, value in request.custom_config.items():
                if hasattr(base_config, key):
                    setattr(base_config, key, value)

        # 保存角色配置
        success = await save_character(base_config)
        if not success:
            raise HTTPException(status_code=500, detail="保存角色配置失败")

        return CharacterResponse(
            success=True, message=f"角色 '{base_config.name}' 创建成功", character=base_config
        )

    except Exception as e:
        logger.error(f"创建角色失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建角色失败: {str(e)}")


@router.get("/", response_model=CharacterListResponse, summary="获取角色列表")
async def list_characters(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    personality_type: Optional[PersonalityType] = Query(None, description="按性格类型筛选"),
    active_only: bool = Query(False, description="仅显示活跃角色"),
):
    """
    获取角色列表，支持分页和筛选

    - **page**: 页码（默认1）
    - **page_size**: 每页数量（默认20）
    - **personality_type**: 按性格类型筛选
    - **active_only**: 仅显示活跃角色
    """
    try:
        # 筛选角色
        characters = list(CHARACTER_STORE.values())

        if personality_type:
            characters = [
                c for c in characters if c.personality_type == personality_type
            ]

        if active_only:
            characters = [c for c in characters if c.is_active]

        # 排序（按创建时间倒序）
        characters.sort(key=lambda x: x.created_at, reverse=True)

        # 分页
        total = len(characters)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_characters = characters[start_idx:end_idx]

        return CharacterListResponse(
            success=True,
            characters=paged_characters,
            total=total,
            page=page,
            page_size=page_size,
            message=f"找到 {total} 个角色",
        )

    except Exception as e:
        logger.error(f"获取角色列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取角色列表失败: {str(e)}")


@router.get("/{character_id}", response_model=CharacterResponse, summary="获取角色详情")
async def get_character(character_id: str = Path(..., description="角色ID")):
    """
    获取指定角色的详细配置信息
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    return CharacterResponse(success=True, message="获取角色信息成功", character=character)


@router.put("/{character_id}", response_model=CharacterResponse, summary="更新角色配置")
async def update_character(
    character_id: str = Path(..., description="角色ID"),
    request: UpdateCharacterRequest = Body(...),
):
    """
    更新角色配置

    支持部分更新，只传入需要修改的字段即可
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    try:
        # 更新字段
        update_data = request.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(character, key):
                setattr(character, key, value)

        # 保存更新
        success = await save_character(character)
        if not success:
            raise HTTPException(status_code=500, detail="更新角色配置失败")

        return CharacterResponse(
            success=True, message=f"角色 '{character.name}' 更新成功", character=character
        )

    except Exception as e:
        logger.error(f"更新角色失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新角色失败: {str(e)}")


@router.delete("/{character_id}", response_model=CharacterResponse, summary="删除角色")
async def delete_character(character_id: str = Path(..., description="角色ID")):
    """
    删除指定角色
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    try:
        # 删除角色及相关数据
        CHARACTER_STORE.pop(character_id, None)
        CHARACTER_STATES.pop(character_id, None)
        EMOTION_HISTORY.pop(character_id, None)

        return CharacterResponse(
            success=True, message=f"角色 '{character.name}' 已删除", character=None
        )

    except Exception as e:
        logger.error(f"删除角色失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除角色失败: {str(e)}")


# ======================== 情绪管理路由 ========================


@router.get(
    "/{character_id}/emotion", response_model=EmotionResponse, summary="获取角色当前情绪"
)
async def get_character_emotion(character_id: str = Path(..., description="角色ID")):
    """
    获取角色当前的情绪状态
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    state = CHARACTER_STATES.get(character_id)
    if not state:
        # 创建默认状态
        state = CharacterState(
            character_id=character_id, current_emotion=character.default_emotion
        )
        CHARACTER_STATES[character_id] = state

    # 获取情绪建议回复
    suggestions = []
    if state.current_emotion == EmotionType.HAPPY:
        suggestions = ["太好了！", "我也很开心~", "这真是个好消息！"]
    elif state.current_emotion == EmotionType.SAD:
        suggestions = ["别难过...", "我陪着你", "会好起来的"]
    elif state.current_emotion == EmotionType.EXCITED:
        suggestions = ["哇！", "好棒！", "我也好兴奋！"]

    return EmotionResponse(
        success=True,
        current_emotion=state.current_emotion,
        emotion_intensity=state.emotion_intensity,
        suggested_responses=suggestions,
    )


@router.post(
    "/{character_id}/emotion", response_model=EmotionResponse, summary="设置角色情绪"
)
async def set_character_emotion(
    character_id: str = Path(..., description="角色ID"),
    request: SetEmotionRequest = Body(...),
):
    """
    设置角色的情绪状态

    - **emotion**: 目标情绪（必填）
    - **intensity**: 情绪强度 0-1（默认0.7）
    - **duration**: 持续时间（可选）
    - **reason**: 情绪变化原因（可选）
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    try:
        # 获取当前状态
        current_state = CHARACTER_STATES.get(character_id)
        previous_emotion = (
            current_state.current_emotion if current_state else EmotionType.NEUTRAL
        )

        # 更新情绪状态
        new_state = await update_character_state(
            character_id=character_id,
            emotion=request.emotion,
            intensity=request.intensity,
            reason=request.reason,
        )

        # 如果指定了持续时间，设置定时器恢复默认情绪
        if request.duration:
            # 这里可以实现定时器逻辑
            pass

        return EmotionResponse(
            success=True,
            current_emotion=new_state.current_emotion,
            emotion_intensity=new_state.emotion_intensity,
            previous_emotion=previous_emotion,
            transition_reason=request.reason,
        )

    except Exception as e:
        logger.error(f"设置角色情绪失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置角色情绪失败: {str(e)}")


@router.get("/emotions", response_model=List[str], summary="获取可用情绪列表")
async def list_emotions():
    """
    获取系统支持的所有情绪类型
    """
    return [emotion.value for emotion in EmotionType]


@router.post(
    "/analyze-emotion", response_model=EmotionAnalysisResponse, summary="分析文本情绪"
)
async def analyze_emotion(request: EmotionAnalysisRequest):
    """
    分析文本中的情绪倾向

    - **text**: 待分析的文本（必填）
    - **context**: 上下文信息（可选）
    - **current_emotion**: 当前情绪状态（可选）
    """
    try:
        # 分析情绪
        analysis = await analyze_emotion_from_text(request.text, request.context)

        # 生成建议的回复情绪
        suggested_emotion = analysis["primary_emotion"]
        if analysis["primary_emotion"] == EmotionType.SAD:
            suggested_emotion = EmotionType.CARING
        elif analysis["primary_emotion"] == EmotionType.ANGRY:
            suggested_emotion = EmotionType.CALM

        return EmotionAnalysisResponse(
            success=True,
            detected_emotions=analysis["detected_emotions"],
            primary_emotion=analysis["primary_emotion"],
            confidence=analysis["confidence"],
            emotion_keywords=analysis["keywords"],
            suggested_response_emotion=suggested_emotion,
            analysis_details={
                "text_length": len(request.text),
                "analysis_method": "keyword_based",
                "context_considered": bool(request.context),
            },
        )

    except Exception as e:
        logger.error(f"情绪分析失败: {e}")
        raise HTTPException(status_code=500, detail=f"情绪分析失败: {str(e)}")


# ======================== 角色状态管理 ========================


@router.get(
    "/{character_id}/state", response_model=CharacterStateResponse, summary="获取角色状态"
)
async def get_character_state(character_id: str = Path(..., description="角色ID")):
    """
    获取角色的运行时状态信息
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    state = CHARACTER_STATES.get(character_id)
    if not state:
        # 创建默认状态
        state = CharacterState(
            character_id=character_id, current_emotion=character.default_emotion
        )
        CHARACTER_STATES[character_id] = state

    # 生成性能指标
    performance_metrics = {
        "total_interactions": state.conversation_count,
        "average_emotion_intensity": state.emotion_intensity,
        "last_active": state.last_interaction.isoformat()
        if state.last_interaction
        else None,
        "emotion_changes": len(EMOTION_HISTORY.get(character_id, [])),
        "memory_usage": "正常",  # 简化指标
    }

    # 生成优化建议
    recommendations = []
    if state.conversation_count == 0:
        recommendations.append("角色还未开始交互，建议进行测试对话")
    if state.emotion_intensity < 0.3:
        recommendations.append("情绪强度较低，可能需要更生动的表达")
    if not state.last_interaction or (datetime.now() - state.last_interaction).days > 7:
        recommendations.append("长时间未交互，建议定期使用保持活跃")

    return CharacterStateResponse(
        success=True,
        character_id=character_id,
        state=state,
        performance_metrics=performance_metrics,
        recommendations=recommendations,
    )


@router.post(
    "/{character_id}/interact",
    response_model=CharacterInteractionResponse,
    summary="与角色交互",
)
async def interact_with_character(
    character_id: str = Path(..., description="角色ID"),
    request: CharacterInteractionRequest = Body(...),
):
    """
    与指定角色进行交互对话

    - **message**: 用户消息（必填）
    - **context**: 交互上下文（可选）
    - **preferred_emotion**: 期望的回复情绪（可选）
    - **adapter_preferences**: 偏好的适配器（可选）
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    try:
        start_time = datetime.now()

        # 分析用户情绪
        user_emotion_analysis = await analyze_emotion_from_text(
            request.message, request.context
        )

        # 确定回复情绪
        if request.preferred_emotion:
            response_emotion = request.preferred_emotion
        else:
            # 基于用户情绪和角色性格决定回复情绪
            if user_emotion_analysis["primary_emotion"] == EmotionType.SAD:
                response_emotion = EmotionType.CARING
            elif user_emotion_analysis["primary_emotion"] == EmotionType.HAPPY:
                response_emotion = EmotionType.HAPPY
            else:
                response_emotion = character.default_emotion

        # 更新角色状态
        await update_character_state(
            character_id=character_id,
            emotion=response_emotion,
            reason=f"响应用户消息: {user_emotion_analysis['primary_emotion']}",
        )

        # 生成回复（简化版，实际应调用LLM）
        if character.personality_type == PersonalityType.SHY:
            if response_emotion == EmotionType.HAPPY:
                response_text = f"嗯嗯~ 听到你这么说我也很开心呢... {character.display_name}会一直陪着你的~"
            elif response_emotion == EmotionType.CARING:
                response_text = f"没关系的... {character.display_name}会陪着你的，不要难过哦..."
            else:
                response_text = f"嗯... 我明白了~ {character.display_name}会努力帮助你的..."
        else:
            response_text = f"我理解了你的意思。作为{character.display_name}，我想说..."

        # 选择语音风格和动画
        voice_style = character.default_voice or VoiceStyle.SWEET
        animation = AnimationType.TALKING
        if response_emotion == EmotionType.HAPPY:
            animation = AnimationType.HAPPY
        elif response_emotion == EmotionType.SAD:
            animation = AnimationType.SAD

        # 计算处理时间
        processing_time = (datetime.now() - start_time).total_seconds()

        # 模拟学习信息（实际应基于真实学习结果）
        learned_info = {
            "user_preference": user_emotion_analysis["primary_emotion"],
            "effective_response_style": character.response_strategy,
            "context_factors": list(request.context.keys()) if request.context else [],
        }

        return CharacterInteractionResponse(
            success=True,
            response=response_text,
            emotion=response_emotion,
            voice_style=voice_style,
            animation=animation,
            processing_time=processing_time,
            tokens_used=len(request.message.split())
            + len(response_text.split()),  # 简化计算
            adapters_used=request.adapter_preferences or [],
            learned_info=learned_info,
        )

    except Exception as e:
        logger.error(f"角色交互失败: {e}")
        raise HTTPException(status_code=500, detail=f"角色交互失败: {str(e)}")


# ======================== 模板管理路由 ========================


@router.get("/templates", response_model=TemplateListResponse, summary="获取角色模板列表")
async def list_character_templates():
    """
    获取所有可用的角色模板
    """
    try:
        templates = list(PREDEFINED_TEMPLATES.values())

        # 按受欢迎程度排序
        templates.sort(key=lambda x: x.popularity, reverse=True)

        # 提取分类和热门模板
        categories = list(set(tag for template in templates for tag in template.tags))
        popular_templates = [t.template_id for t in templates[:3]]  # 前3个作为热门

        return TemplateListResponse(
            success=True,
            templates=templates,
            categories=categories,
            popular_templates=popular_templates,
        )

    except Exception as e:
        logger.error(f"获取模板列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模板列表失败: {str(e)}")


@router.get(
    "/templates/{template_id}", response_model=CharacterTemplate_Model, summary="获取模板详情"
)
async def get_character_template(
    template_id: CharacterTemplate = Path(..., description="模板ID")
):
    """
    获取指定模板的详细信息
    """
    if template_id not in PREDEFINED_TEMPLATES:
        raise HTTPException(status_code=404, detail="模板不存在")

    return PREDEFINED_TEMPLATES[template_id]


@router.post(
    "/{character_id}/apply-template",
    response_model=CharacterResponse,
    summary="应用模板到角色",
)
async def apply_template_to_character(
    character_id: str = Path(..., description="角色ID"),
    template_id: CharacterTemplate = Body(..., embed=True, description="模板ID"),
):
    """
    将指定模板应用到现有角色
    """
    character = await get_character_by_id(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")

    if template_id not in PREDEFINED_TEMPLATES:
        raise HTTPException(status_code=404, detail="模板不存在")

    try:
        template_config = PREDEFINED_TEMPLATES[template_id].config

        # 保留原有的基础信息，应用模板的其他配置
        original_id = character.id
        original_name = character.name
        original_display_name = character.display_name
        original_created_at = character.created_at

        # 应用模板配置
        character = template_config.model_copy()
        character.id = original_id
        character.name = original_name
        character.display_name = original_display_name
        character.created_at = original_created_at
        character.template = template_id

        # 保存更新
        success = await save_character(character)
        if not success:
            raise HTTPException(status_code=500, detail="应用模板失败")

        return CharacterResponse(
            success=True,
            message=f"模板 '{template_id}' 已应用到角色 '{character.name}'",
            character=character,
        )

    except Exception as e:
        logger.error(f"应用模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"应用模板失败: {str(e)}")


# ======================== 批量操作路由 ========================


@router.post("/batch", response_model=BatchOperationResponse, summary="批量操作角色")
async def batch_character_operations(request: BatchCharacterOperation):
    """
    对多个角色执行批量操作

    - **character_ids**: 角色ID列表
    - **operation**: 操作类型（activate/deactivate/delete/export）
    - **parameters**: 操作参数
    """
    try:
        results = []
        success_count = 0
        failed_count = 0
        errors = []

        for character_id in request.character_ids:
            try:
                character = await get_character_by_id(character_id)
                if not character:
                    errors.append(f"角色 {character_id} 不存在")
                    failed_count += 1
                    continue

                if request.operation == "activate":
                    character.is_active = True
                    await save_character(character)
                    results.append({"character_id": character_id, "status": "已激活"})

                elif request.operation == "deactivate":
                    character.is_active = False
                    await save_character(character)
                    results.append({"character_id": character_id, "status": "已停用"})

                elif request.operation == "delete":
                    CHARACTER_STORE.pop(character_id, None)
                    CHARACTER_STATES.pop(character_id, None)
                    EMOTION_HISTORY.pop(character_id, None)
                    results.append({"character_id": character_id, "status": "已删除"})

                elif request.operation == "export":
                    # 导出配置
                    export_data = character.model_dump()
                    results.append(
                        {
                            "character_id": character_id,
                            "status": "已导出",
                            "data": export_data,
                        }
                    )

                success_count += 1

            except Exception as e:
                errors.append(f"处理角色 {character_id} 失败: {str(e)}")
                failed_count += 1

        return BatchOperationResponse(
            success=failed_count == 0,
            operation=request.operation,
            total_count=len(request.character_ids),
            success_count=success_count,
            failed_count=failed_count,
            results=results,
            errors=errors,
        )

    except Exception as e:
        logger.error(f"批量操作失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量操作失败: {str(e)}")


# ======================== 系统统计路由 ========================


@router.get("/system/stats", response_model=SystemStatsResponse, summary="获取系统统计信息")
async def get_system_stats():
    """
    获取角色系统的统计信息
    """
    try:
        total_characters = len(CHARACTER_STORE)
        active_characters = sum(1 for c in CHARACTER_STORE.values() if c.is_active)

        # 统计交互次数
        total_interactions = sum(
            state.conversation_count for state in CHARACTER_STATES.values()
        )

        # 统计热门性格类型
        personality_counts = {}
        for character in CHARACTER_STORE.values():
            personality = character.personality_type.value
            personality_counts[personality] = personality_counts.get(personality, 0) + 1

        popular_personalities = [
            {"type": k, "count": v}
            for k, v in sorted(
                personality_counts.items(), key=lambda x: x[1], reverse=True
            )
        ]

        # 统计情绪分布
        emotion_distribution = {}
        for state in CHARACTER_STATES.values():
            emotion = state.current_emotion.value
            emotion_distribution[emotion] = emotion_distribution.get(emotion, 0) + 1

        # 系统健康状态
        system_health = {
            "memory_usage": "正常",
            "response_time": "正常",
            "error_rate": "低",
            "uptime": "99.9%",  # 简化指标
        }

        return SystemStatsResponse(
            success=True,
            total_characters=total_characters,
            active_characters=active_characters,
            total_interactions=total_interactions,
            popular_personalities=popular_personalities,
            emotion_distribution=emotion_distribution,
            system_health=system_health,
        )

    except Exception as e:
        logger.error(f"获取系统统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取系统统计失败: {str(e)}")


# ======================== 健康检查 ========================


@router.get("/health", summary="角色系统健康检查")
async def character_system_health():
    """
    角色系统健康检查
    """
    return {
        "status": "healthy",
        "characters_loaded": len(CHARACTER_STORE),
        "active_states": len(CHARACTER_STATES),
        "templates_available": len(PREDEFINED_TEMPLATES),
        "timestamp": datetime.now().isoformat(),
    }


# ======================== 初始化数据 ========================


async def init_character_system():
    """初始化角色系统"""
    logger.info("初始化角色配置系统...")

    # 创建默认角色（如果不存在）
    if not CHARACTER_STORE:
        default_character = PREDEFINED_TEMPLATES[
            CharacterTemplate.ZISHU_BASE
        ].config.model_copy()
        default_character.id = "default_zishu"
        await save_character(default_character)
        logger.info(f"创建默认角色: {default_character.name}")


# 注意：实际初始化应在应用启动事件中调用
# 例如在main.py中：
# @app.on_event("startup")
# async def startup_event():
#     await init_character_system()

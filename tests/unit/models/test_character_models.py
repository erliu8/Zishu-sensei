# -*- coding: utf-8 -*-
"""
角色模型单元测试
基于实际的chat.py schema定义
"""
import pytest
import uuid
from datetime import datetime
from typing import Dict, Any, List
from unittest.mock import Mock, patch

from pydantic import ValidationError

from zishu.api.schemas.chat import (
    # 枚举类型
    MessageRole, MessageType, EmotionType, PersonalityType, VoiceStyle,
    AnimationType, CharacterTemplate, InteractionStyle, ResponseStrategy,
    
    # 核心模型
    Message, CharacterConfig, CharacterState, EmotionTransition,
    CharacterTemplate_Model,
    
    # 请求模型
    CreateCharacterRequest, UpdateCharacterRequest, SetEmotionRequest,
    EmotionAnalysisRequest, CharacterInteractionRequest, BatchCharacterOperation,
    
    # 响应模型
    CharacterResponse, CharacterListResponse, EmotionResponse,
    EmotionAnalysisResponse, CharacterStateResponse, TemplateListResponse,
    CharacterInteractionResponse, BatchOperationResponse, SystemStatsResponse
)


@pytest.mark.unit
@pytest.mark.models
class TestEnumTypes:
    """枚举类型测试"""
    
    def test_message_role_enum(self):
        """测试消息角色枚举"""
        assert MessageRole.USER == "user"
        assert MessageRole.ASSISTANT == "assistant"
        assert MessageRole.SYSTEM == "system"
    
    def test_message_type_enum(self):
        """测试消息类型枚举"""
        assert MessageType.TEXT == "text"
        assert MessageType.IMAGE == "image"
        assert MessageType.AUDIO == "audio"
        assert MessageType.VIDEO == "video"
        assert MessageType.FILE == "file"
        assert MessageType.EMOTION == "emotion"
        assert MessageType.ACTION == "action"
    
    def test_emotion_type_enum(self):
        """测试情绪类型枚举"""
        # 基本情绪
        assert EmotionType.HAPPY == "happy"
        assert EmotionType.SAD == "sad"
        assert EmotionType.ANGRY == "angry"
        assert EmotionType.NEUTRAL == "neutral"
        
        # 扩展情绪
        assert EmotionType.EXCITED == "excited"
        assert EmotionType.CALM == "calm"
        assert EmotionType.CONFUSED == "confused"
        assert EmotionType.THINKING == "thinking"
    
    def test_personality_type_enum(self):
        """测试性格类型枚举"""
        assert PersonalityType.SHY == "shy"
        assert PersonalityType.CHEERFUL == "cheerful"
        assert PersonalityType.CALM == "calm"
        assert PersonalityType.ENERGETIC == "energetic"
        assert PersonalityType.TSUNDERE == "tsundere"
        assert PersonalityType.CUSTOM == "custom"
    
    def test_voice_style_enum(self):
        """测试语音风格枚举"""
        assert VoiceStyle.CUTE == "cute"
        assert VoiceStyle.SWEET == "sweet"
        assert VoiceStyle.MATURE == "mature"
        assert VoiceStyle.ENERGETIC == "energetic"
    
    def test_animation_type_enum(self):
        """测试动画类型枚举"""
        assert AnimationType.IDLE == "idle"
        assert AnimationType.TALKING == "talking"
        assert AnimationType.HAPPY == "happy"
        assert AnimationType.THINKING == "thinking"


@pytest.mark.unit
@pytest.mark.models
class TestMessage:
    """消息模型测试"""
    
    def test_message_creation_basic(self):
        """测试基本消息创建"""
        message = Message(
            role=MessageRole.USER,
            content="Hello, world!"
        )
        
        assert message.role == MessageRole.USER
        assert message.content == "Hello, world!"
        assert message.message_type == MessageType.TEXT
        assert isinstance(message.timestamp, datetime)
        assert message.id is not None
        assert len(message.id) > 0
    
    def test_message_with_emotion(self):
        """测试带情绪的消息"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="I'm happy to help!",
            emotion=EmotionType.HAPPY,
            emotion_intensity=0.8
        )
        
        assert message.emotion == EmotionType.HAPPY
        assert message.emotion_intensity == 0.8
    
    def test_message_with_multimedia(self):
        """测试多媒体消息"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Here's a cheerful response!",
            voice_style="cheerful",
            animation="happy",
            avatar="smile.png"
        )
        
        assert message.voice_style == "cheerful"
        assert message.animation == "happy"
        assert message.avatar == "smile.png"
    
    def test_message_with_metadata(self):
        """测试带元数据的消息"""
        metadata = {
            "source": "web",
            "user_agent": "test-browser",
            "ip": "127.0.0.1"
        }
        
        message = Message(
            role=MessageRole.USER,
            content="Hello",
            metadata=metadata,
            tokens=5,
            processing_time=0.1
        )
        
        assert message.metadata == metadata
        assert message.tokens == 5
        assert message.processing_time == 0.1
    
    def test_message_content_validation(self):
        """测试消息内容验证"""
        # 空内容应该被拒绝
        with pytest.raises(ValidationError):
            Message(
                role=MessageRole.USER,
                content=""
            )
        
        # 只有空格的内容应该被拒绝
        with pytest.raises(ValidationError):
            Message(
                role=MessageRole.USER,
                content="   "
            )
        
        # 内容会被自动去除首尾空格
        message = Message(
            role=MessageRole.USER,
            content="  Hello  "
        )
        assert message.content == "Hello"
    
    def test_message_length_limits(self):
        """测试消息长度限制"""
        # 正常长度
        normal_content = "A" * 1000
        message = Message(
            role=MessageRole.USER,
            content=normal_content
        )
        assert message.content == normal_content
        
        # 超长内容
        long_content = "A" * 10001
        with pytest.raises(ValidationError):
            Message(
                role=MessageRole.USER,
                content=long_content
            )
    
    def test_emotion_intensity_validation(self):
        """测试情绪强度验证"""
        # 有效范围
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Test",
            emotion_intensity=0.5
        )
        assert message.emotion_intensity == 0.5
        
        # 边界值
        message_min = Message(
            role=MessageRole.ASSISTANT,
            content="Test",
            emotion_intensity=0.0
        )
        assert message_min.emotion_intensity == 0.0
        
        message_max = Message(
            role=MessageRole.ASSISTANT,
            content="Test",
            emotion_intensity=1.0
        )
        assert message_max.emotion_intensity == 1.0


@pytest.mark.unit
@pytest.mark.models
class TestCharacterConfig:
    """角色配置模型测试"""
    
    def test_character_config_creation_basic(self):
        """测试基本角色配置创建"""
        config = CharacterConfig(
            name="Zishu",
            display_name="紫舒老师"
        )
        
        assert config.name == "Zishu"
        assert config.display_name == "紫舒老师"
        assert config.personality_type == PersonalityType.FRIENDLY
        assert config.interaction_style == InteractionStyle.CASUAL
        assert config.response_strategy == ResponseStrategy.EMPATHETIC
        assert isinstance(config.created_at, datetime)
        assert config.id is not None
    
    def test_character_config_with_full_options(self):
        """测试完整选项的角色配置"""
        config = CharacterConfig(
            name="TestChar",
            display_name="Test Character",
            description="A test character for unit testing",
            personality_type=PersonalityType.CHEERFUL,
            personality_traits=["friendly", "helpful", "curious"],
            interaction_style=InteractionStyle.PLAYFUL,
            response_strategy=ResponseStrategy.CREATIVE,
            verbosity_level=0.8,
            formality_level=0.2,
            creativity_level=0.9,
            available_emotions=[EmotionType.HAPPY, EmotionType.EXCITED, EmotionType.CURIOUS],
            default_emotion=EmotionType.HAPPY,
            voice_styles=[VoiceStyle.CUTE, VoiceStyle.ENERGETIC],
            default_voice=VoiceStyle.CUTE,
            knowledge_domains=["technology", "science", "art"],
            special_abilities=["coding", "drawing", "music"],
            preferred_adapters=["openai-adapter", "claude-adapter"],
            memory_enabled=True,
            learning_enabled=True,
            personalization_level=0.7
        )
        
        assert config.personality_type == PersonalityType.CHEERFUL
        assert len(config.personality_traits) == 3
        assert config.verbosity_level == 0.8
        assert config.creativity_level == 0.9
        assert EmotionType.HAPPY in config.available_emotions
        assert config.default_voice == VoiceStyle.CUTE
        assert "technology" in config.knowledge_domains
        assert config.memory_enabled is True
    
    def test_character_config_validation(self):
        """测试角色配置验证"""
        # 空名称应该被拒绝
        with pytest.raises(ValidationError):
            CharacterConfig(
                name="",
                display_name="Test"
            )
        
        # 只有空格的名称应该被拒绝
        with pytest.raises(ValidationError):
            CharacterConfig(
                name="   ",
                display_name="Test"
            )
        
        # 名称会被自动去除首尾空格
        config = CharacterConfig(
            name="  Zishu  ",
            display_name="紫舒老师"
        )
        assert config.name == "Zishu"
    
    def test_personality_traits_validation(self):
        """测试性格特质验证"""
        # 正常数量的特质
        config = CharacterConfig(
            name="Test",
            display_name="Test",
            personality_traits=["trait1", "trait2", "trait3"]
        )
        assert len(config.personality_traits) == 3
        
        # 超过限制的特质数量
        too_many_traits = [f"trait{i}" for i in range(11)]
        with pytest.raises(ValidationError):
            CharacterConfig(
                name="Test",
                display_name="Test",
                personality_traits=too_many_traits
            )
    
    def test_level_parameters_validation(self):
        """测试级别参数验证"""
        # 有效范围
        config = CharacterConfig(
            name="Test",
            display_name="Test",
            verbosity_level=0.5,
            formality_level=0.3,
            creativity_level=0.8,
            emotion_stability=0.7,
            personalization_level=0.6,
            content_filter_level=0.9
        )
        
        assert config.verbosity_level == 0.5
        assert config.formality_level == 0.3
        assert config.creativity_level == 0.8
        assert config.emotion_stability == 0.7
        assert config.personalization_level == 0.6
        assert config.content_filter_level == 0.9
    
    def test_emotion_history_validation(self):
        """测试情绪历史验证"""
        # 创建超过100条的情绪历史
        long_history = [
            {"emotion": "happy", "timestamp": datetime.now().isoformat()}
            for _ in range(150)
        ]
        
        config = CharacterConfig(
            name="Test",
            display_name="Test",
            emotion_history=long_history
        )
        
        # 应该只保留最近100条
        assert len(config.emotion_history) == 100
    
    def test_max_response_length_validation(self):
        """测试最大回复长度验证"""
        # 有效范围
        config = CharacterConfig(
            name="Test",
            display_name="Test",
            max_response_length=1000
        )
        assert config.max_response_length == 1000
        
        # 边界值
        config_min = CharacterConfig(
            name="Test",
            display_name="Test",
            max_response_length=100
        )
        assert config_min.max_response_length == 100
        
        config_max = CharacterConfig(
            name="Test",
            display_name="Test",
            max_response_length=10000
        )
        assert config_max.max_response_length == 10000


@pytest.mark.unit
@pytest.mark.models
class TestCharacterState:
    """角色状态模型测试"""
    
    def test_character_state_creation(self):
        """测试角色状态创建"""
        state = CharacterState(
            character_id="char-123",
            current_emotion=EmotionType.HAPPY,
            emotion_intensity=0.8,
            energy_level=0.9
        )
        
        assert state.character_id == "char-123"
        assert state.current_emotion == EmotionType.HAPPY
        assert state.emotion_intensity == 0.8
        assert state.energy_level == 0.9
        assert state.conversation_count == 0
        assert isinstance(state.updated_at, datetime)
    
    def test_character_state_with_context(self):
        """测试带上下文的角色状态"""
        state = CharacterState(
            character_id="char-123",
            conversation_count=5,
            last_interaction=datetime.now(),
            active_topics=["technology", "art"],
            learned_preferences={"language": "zh-CN", "style": "casual"},
            active_adapters=["openai-adapter"],
            adapter_states={"openai-adapter": {"status": "active"}}
        )
        
        assert state.conversation_count == 5
        assert len(state.active_topics) == 2
        assert "technology" in state.active_topics
        assert state.learned_preferences["language"] == "zh-CN"
        assert "openai-adapter" in state.active_adapters


@pytest.mark.unit
@pytest.mark.models
class TestRequestModels:
    """请求模型测试"""
    
    def test_create_character_request(self):
        """测试创建角色请求"""
        request = CreateCharacterRequest(
            name="NewChar",
            display_name="New Character",
            description="A new character for testing",
            template=CharacterTemplate.ZISHU_CARING,
            personality_type=PersonalityType.CHEERFUL,
            interaction_style=InteractionStyle.PLAYFUL,
            custom_config={"special_feature": "enabled"}
        )
        
        assert request.name == "NewChar"
        assert request.display_name == "New Character"
        assert request.template == CharacterTemplate.ZISHU_CARING
        assert request.personality_type == PersonalityType.CHEERFUL
        assert request.custom_config["special_feature"] == "enabled"
    
    def test_update_character_request(self):
        """测试更新角色请求"""
        request = UpdateCharacterRequest(
            name="UpdatedName",
            personality_type=PersonalityType.CALM,
            verbosity_level=0.6,
            creativity_level=0.8,
            voice_styles=[VoiceStyle.SWEET, VoiceStyle.CALM],
            memory_enabled=False,
            custom_prompts={"greeting": "Hello there!"}
        )
        
        assert request.name == "UpdatedName"
        assert request.personality_type == PersonalityType.CALM
        assert request.verbosity_level == 0.6
        assert request.memory_enabled is False
        assert request.custom_prompts["greeting"] == "Hello there!"
    
    def test_set_emotion_request(self):
        """测试设置情绪请求"""
        request = SetEmotionRequest(
            emotion=EmotionType.EXCITED,
            intensity=0.9,
            duration=300,
            reason="User shared good news",
            transition_type="gradual"
        )
        
        assert request.emotion == EmotionType.EXCITED
        assert request.intensity == 0.9
        assert request.duration == 300
        assert request.reason == "User shared good news"
        assert request.transition_type == "gradual"
    
    def test_emotion_analysis_request(self):
        """测试情绪分析请求"""
        request = EmotionAnalysisRequest(
            text="I'm so happy today!",
            context={"previous_emotion": "neutral", "conversation_turn": 3},
            current_emotion=EmotionType.NEUTRAL
        )
        
        assert request.text == "I'm so happy today!"
        assert request.context["previous_emotion"] == "neutral"
        assert request.current_emotion == EmotionType.NEUTRAL
    
    def test_character_interaction_request(self):
        """测试角色交互请求"""
        request = CharacterInteractionRequest(
            character_id="char-123",
            message="How are you today?",
            context={"session_id": "session-456"},
            preferred_emotion=EmotionType.CHEERFUL,
            adapter_preferences=["openai-adapter", "claude-adapter"]
        )
        
        assert request.character_id == "char-123"
        assert request.message == "How are you today?"
        assert request.context["session_id"] == "session-456"
        assert request.preferred_emotion == EmotionType.CHEERFUL
        assert len(request.adapter_preferences) == 2
    
    def test_batch_character_operation(self):
        """测试批量角色操作请求"""
        request = BatchCharacterOperation(
            character_ids=["char-1", "char-2", "char-3"],
            operation="activate",
            parameters={"force": True, "timeout": 30}
        )
        
        assert len(request.character_ids) == 3
        assert request.operation == "activate"
        assert request.parameters["force"] is True


@pytest.mark.unit
@pytest.mark.models
class TestResponseModels:
    """响应模型测试"""
    
    def test_character_response(self):
        """测试角色响应"""
        character_config = CharacterConfig(
            name="TestChar",
            display_name="Test Character"
        )
        
        response = CharacterResponse(
            success=True,
            message="Character created successfully",
            character=character_config
        )
        
        assert response.success is True
        assert response.message == "Character created successfully"
        assert response.character.name == "TestChar"
        assert isinstance(response.timestamp, datetime)
    
    def test_character_list_response(self):
        """测试角色列表响应"""
        characters = [
            CharacterConfig(name=f"Char{i}", display_name=f"Character {i}")
            for i in range(3)
        ]
        
        response = CharacterListResponse(
            success=True,
            characters=characters,
            total=3,
            page=1,
            page_size=20
        )
        
        assert response.success is True
        assert len(response.characters) == 3
        assert response.total == 3
        assert response.page == 1
    
    def test_emotion_response(self):
        """测试情绪响应"""
        response = EmotionResponse(
            success=True,
            current_emotion=EmotionType.HAPPY,
            emotion_intensity=0.8,
            previous_emotion=EmotionType.NEUTRAL,
            transition_reason="User shared good news",
            suggested_responses=["That's wonderful!", "I'm so happy for you!"]
        )
        
        assert response.success is True
        assert response.current_emotion == EmotionType.HAPPY
        assert response.emotion_intensity == 0.8
        assert response.previous_emotion == EmotionType.NEUTRAL
        assert len(response.suggested_responses) == 2
    
    def test_emotion_analysis_response(self):
        """测试情绪分析响应"""
        detected_emotions = [
            {"emotion": "happy", "confidence": 0.9},
            {"emotion": "excited", "confidence": 0.7}
        ]
        
        response = EmotionAnalysisResponse(
            success=True,
            detected_emotions=detected_emotions,
            primary_emotion=EmotionType.HAPPY,
            confidence=0.9,
            emotion_keywords=["happy", "joy", "excited"],
            suggested_response_emotion=EmotionType.CHEERFUL,
            analysis_details={"method": "transformer", "model": "emotion-bert"}
        )
        
        assert response.success is True
        assert len(response.detected_emotions) == 2
        assert response.primary_emotion == EmotionType.HAPPY
        assert response.confidence == 0.9
        assert "happy" in response.emotion_keywords
    
    def test_character_interaction_response(self):
        """测试角色交互响应"""
        response = CharacterInteractionResponse(
            success=True,
            response="Hello! I'm doing great, thank you for asking!",
            emotion=EmotionType.CHEERFUL,
            voice_style=VoiceStyle.SWEET,
            animation=AnimationType.HAPPY,
            processing_time=0.5,
            tokens_used=25,
            adapters_used=["openai-adapter"],
            learned_info={"user_preference": "polite_conversation"},
            personality_update={"cheerfulness": 0.1}
        )
        
        assert response.success is True
        assert "great" in response.response
        assert response.emotion == EmotionType.CHEERFUL
        assert response.voice_style == VoiceStyle.SWEET
        assert response.processing_time == 0.5
        assert response.tokens_used == 25
        assert "openai-adapter" in response.adapters_used
    
    def test_batch_operation_response(self):
        """测试批量操作响应"""
        results = [
            {"character_id": "char-1", "status": "success"},
            {"character_id": "char-2", "status": "success"},
            {"character_id": "char-3", "status": "failed", "error": "Not found"}
        ]
        
        response = BatchOperationResponse(
            success=True,
            operation="activate",
            total_count=3,
            success_count=2,
            failed_count=1,
            results=results,
            errors=["Character char-3 not found"]
        )
        
        assert response.success is True
        assert response.operation == "activate"
        assert response.total_count == 3
        assert response.success_count == 2
        assert response.failed_count == 1
        assert len(response.results) == 3
        assert len(response.errors) == 1
    
    def test_system_stats_response(self):
        """测试系统统计响应"""
        response = SystemStatsResponse(
            success=True,
            total_characters=10,
            active_characters=8,
            total_interactions=1500,
            popular_personalities=[
                {"type": "cheerful", "count": 4},
                {"type": "calm", "count": 3}
            ],
            emotion_distribution={"happy": 45, "neutral": 30, "excited": 25},
            system_health={"status": "healthy", "uptime": 86400}
        )
        
        assert response.success is True
        assert response.total_characters == 10
        assert response.active_characters == 8
        assert response.total_interactions == 1500
        assert len(response.popular_personalities) == 2
        assert response.emotion_distribution["happy"] == 45
        assert response.system_health["status"] == "healthy"


@pytest.mark.unit
@pytest.mark.models
class TestModelIntegration:
    """模型集成测试"""
    
    def test_character_config_to_dict_serialization(self):
        """测试角色配置序列化"""
        config = CharacterConfig(
            name="TestChar",
            display_name="Test Character",
            personality_type=PersonalityType.CHEERFUL,
            available_emotions=[EmotionType.HAPPY, EmotionType.EXCITED]
        )
        
        # 测试Pydantic的dict()方法
        config_dict = config.model_dump()
        
        assert config_dict["name"] == "TestChar"
        assert config_dict["personality_type"] == "cheerful"
        assert EmotionType.HAPPY in config_dict["available_emotions"]
    
    def test_character_config_from_dict_deserialization(self):
        """测试角色配置反序列化"""
        config_data = {
            "name": "TestChar",
            "display_name": "Test Character",
            "personality_type": "cheerful",
            "interaction_style": "playful",
            "available_emotions": ["happy", "excited", "curious"]
        }
        
        config = CharacterConfig(**config_data)
        
        assert config.name == "TestChar"
        assert config.personality_type == PersonalityType.CHEERFUL
        assert config.interaction_style == InteractionStyle.PLAYFUL
        assert EmotionType.HAPPY in config.available_emotions
    
    def test_nested_model_validation(self):
        """测试嵌套模型验证"""
        # 创建角色配置
        config = CharacterConfig(
            name="TestChar",
            display_name="Test Character"
        )
        
        # 创建角色响应
        response = CharacterResponse(
            success=True,
            message="Success",
            character=config
        )
        
        assert response.character.name == "TestChar"
        assert response.character.display_name == "Test Character"
    
    def test_model_field_defaults(self):
        """测试模型字段默认值"""
        # 只提供必需字段
        config = CharacterConfig(
            name="MinimalChar",
            display_name="Minimal Character"
        )
        
        # 验证默认值
        assert config.personality_type == PersonalityType.FRIENDLY
        assert config.interaction_style == InteractionStyle.CASUAL
        assert config.response_strategy == ResponseStrategy.EMPATHETIC
        assert config.verbosity_level == 0.7
        assert config.formality_level == 0.3
        assert config.creativity_level == 0.6
        assert config.emotion_stability == 0.7
        assert config.memory_enabled is True
        assert config.learning_enabled is True
        assert config.is_active is True
        assert config.version == "1.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

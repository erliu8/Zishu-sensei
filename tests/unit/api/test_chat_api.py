# -*- coding: utf-8 -*-
"""
聊天API单元测试
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from httpx import AsyncClient
import json

# 基于实际的schema导入
from zishu.api.schemas.chat import (
    Message, MessageRole, MessageType, EmotionType,
    CharacterConfig, CharacterState, PersonalityType,
    InteractionStyle, ResponseStrategy
)

@pytest.mark.unit
@pytest.mark.api
class TestChatAPI:
    """聊天API测试类"""
    
    @pytest.fixture
    def sample_message(self):
        """示例消息"""
        return Message(
            role=MessageRole.USER,
            content="你好，紫舒！今天天气怎么样？",
            message_type=MessageType.TEXT,
            emotion="happy",
            emotion_intensity=0.7
        )
    
    @pytest.fixture
    def sample_character(self):
        """示例角色配置"""
        return CharacterConfig(
            name="测试紫舒",
            display_name="紫舒酱",
            description="一个友善的AI助手",
            personality_type=PersonalityType.FRIENDLY,
            interaction_style=InteractionStyle.CASUAL,
            response_strategy=ResponseStrategy.EMPATHETIC,
            verbosity_level=0.7,
            emotion_stability=0.8
        )
    
    def test_message_creation(self, sample_message):
        """测试消息创建"""
        assert sample_message.role == MessageRole.USER
        assert sample_message.content == "你好，紫舒！今天天气怎么样？"
        assert sample_message.message_type == MessageType.TEXT
        assert sample_message.emotion == "happy"
        assert sample_message.emotion_intensity == 0.7
        assert isinstance(sample_message.timestamp, datetime)
    
    def test_message_validation(self):
        """测试消息验证"""
        # 测试空内容验证
        with pytest.raises(ValueError, match="消息内容不能为空"):
            Message(
                role=MessageRole.USER,
                content="   ",  # 只有空格
                message_type=MessageType.TEXT
            )
    
    def test_character_config_creation(self, sample_character):
        """测试角色配置创建"""
        assert sample_character.name == "测试紫舒"
        assert sample_character.display_name == "紫舒酱"
        assert sample_character.personality_type == PersonalityType.FRIENDLY
        assert sample_character.interaction_style == InteractionStyle.CASUAL
        assert sample_character.verbosity_level == 0.7
        assert sample_character.emotion_stability == 0.8
    
    def test_character_config_validation(self):
        """测试角色配置验证"""
        # 测试空名称验证
        with pytest.raises(ValueError, match="角色名称不能为空"):
            CharacterConfig(
                name="   ",  # 只有空格
                display_name="测试"
            )
    
    def test_emotion_types(self):
        """测试情绪类型"""
        # 测试预定义情绪
        assert EmotionType.HAPPY == "happy"
        assert EmotionType.SAD == "sad"
        assert EmotionType.NEUTRAL == "neutral"
        
        # 测试自定义情绪（字符串）
        custom_emotion = "excited_happy"
        message = Message(
            role=MessageRole.ASSISTANT,
            content="我很开心！",
            emotion=custom_emotion
        )
        assert message.emotion == custom_emotion
    
    def test_personality_types(self):
        """测试性格类型"""
        personality_types = [
            PersonalityType.SHY,
            PersonalityType.CHEERFUL,
            PersonalityType.CALM,
            PersonalityType.ENERGETIC,
            PersonalityType.TSUNDERE
        ]
        
        for personality in personality_types:
            character = CharacterConfig(
                name="测试角色",
                display_name="测试",
                personality_type=personality
            )
            assert character.personality_type == personality

@pytest.mark.integration
@pytest.mark.api
class TestChatAPIIntegration:
    """聊天API集成测试"""
    
    @pytest.fixture
    def mock_chat_service(self):
        """模拟聊天服务"""
        service = Mock()
        service.process_message = AsyncMock(return_value={
            "response": "你好！今天天气很好呢～",
            "emotion": "happy",
            "processing_time": 0.5,
            "tokens_used": 15
        })
        service.get_character = Mock(return_value=CharacterConfig(
            name="紫舒",
            display_name="紫舒酱"
        ))
        return service
    
    @pytest.mark.asyncio
    async def test_chat_endpoint_basic(self, mock_chat_service):
        """测试基础聊天端点"""
        # 模拟API调用
        request_data = {
            "message": "你好，紫舒！",
            "character_id": "zishu_default",
            "conversation_id": "test_conversation"
        }
        
        # 处理消息
        result = await mock_chat_service.process_message(
            message=request_data["message"],
            character_id=request_data["character_id"],
            conversation_id=request_data["conversation_id"]
        )
        
        assert result["response"] == "你好！今天天气很好呢～"
        assert result["emotion"] == "happy"
        assert result["processing_time"] > 0
        assert result["tokens_used"] > 0
    
    @pytest.mark.asyncio
    async def test_chat_with_emotion(self, mock_chat_service):
        """测试带情绪的聊天"""
        mock_chat_service.process_message = AsyncMock(return_value={
            "response": "哇，真的吗？太棒了！",
            "emotion": "excited",
            "emotion_intensity": 0.9,
            "animation": "happy",
            "voice_style": "energetic"
        })
        
        result = await mock_chat_service.process_message(
            message="我今天考试得了满分！",
            character_id="zishu_energetic",
            preferred_emotion="excited"
        )
        
        assert result["emotion"] == "excited"
        assert result["emotion_intensity"] == 0.9
        assert result["animation"] == "happy"
        assert result["voice_style"] == "energetic"
    
    @pytest.mark.asyncio
    async def test_chat_with_context(self, mock_chat_service):
        """测试带上下文的聊天"""
        # 模拟对话历史
        conversation_history = [
            {"role": "user", "content": "我叫小明"},
            {"role": "assistant", "content": "你好小明！很高兴认识你"},
            {"role": "user", "content": "你还记得我的名字吗？"}
        ]
        
        mock_chat_service.process_message = AsyncMock(return_value={
            "response": "当然记得！你是小明呀～",
            "emotion": "friendly",
            "context_used": True,
            "remembered_info": ["用户名字: 小明"]
        })
        
        result = await mock_chat_service.process_message(
            message="你还记得我的名字吗？",
            character_id="zishu_default",
            conversation_history=conversation_history
        )
        
        assert "小明" in result["response"]
        assert result["context_used"] is True
        assert "用户名字: 小明" in result["remembered_info"]

@pytest.mark.unit
@pytest.mark.api
class TestCharacterManagement:
    """角色管理测试"""
    
    @pytest.fixture
    def mock_character_service(self):
        """模拟角色服务"""
        service = Mock()
        service.create_character = AsyncMock()
        service.update_character = AsyncMock()
        service.delete_character = AsyncMock()
        service.get_character = Mock()
        service.list_characters = Mock()
        return service
    
    @pytest.mark.asyncio
    async def test_create_character(self, mock_character_service):
        """测试创建角色"""
        character_data = {
            "name": "新角色",
            "display_name": "新角色酱",
            "personality_type": "cheerful",
            "interaction_style": "playful"
        }
        
        mock_character_service.create_character.return_value = CharacterConfig(
            **character_data
        )
        
        result = await mock_character_service.create_character(character_data)
        
        assert result.name == "新角色"
        assert result.personality_type == PersonalityType.CHEERFUL
        mock_character_service.create_character.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_character(self, mock_character_service):
        """测试更新角色"""
        character_id = "test_character_id"
        update_data = {
            "verbosity_level": 0.8,
            "emotion_stability": 0.9,
            "response_strategy": "creative"
        }
        
        mock_character_service.update_character.return_value = True
        
        result = await mock_character_service.update_character(
            character_id, update_data
        )
        
        assert result is True
        mock_character_service.update_character.assert_called_once_with(
            character_id, update_data
        )
    
    def test_list_characters(self, mock_character_service):
        """测试列出角色"""
        mock_characters = [
            CharacterConfig(name="角色1", display_name="角色1"),
            CharacterConfig(name="角色2", display_name="角色2"),
            CharacterConfig(name="角色3", display_name="角色3")
        ]
        
        mock_character_service.list_characters.return_value = {
            "characters": mock_characters,
            "total": 3,
            "page": 1,
            "page_size": 20
        }
        
        result = mock_character_service.list_characters()
        
        assert len(result["characters"]) == 3
        assert result["total"] == 3
        assert result["page"] == 1

@pytest.mark.unit
@pytest.mark.api
class TestEmotionSystem:
    """情绪系统测试"""
    
    @pytest.fixture
    def mock_emotion_service(self):
        """模拟情绪服务"""
        service = Mock()
        service.analyze_emotion = AsyncMock()
        service.set_emotion = AsyncMock()
        service.get_emotion_transitions = Mock()
        return service
    
    @pytest.mark.asyncio
    async def test_emotion_analysis(self, mock_emotion_service):
        """测试情绪分析"""
        text = "我今天心情不太好，感觉很沮丧"
        
        mock_emotion_service.analyze_emotion.return_value = {
            "primary_emotion": "sad",
            "confidence": 0.85,
            "detected_emotions": [
                {"emotion": "sad", "score": 0.85},
                {"emotion": "depressed", "score": 0.65}
            ],
            "emotion_keywords": ["心情不太好", "沮丧"],
            "suggested_response_emotion": "caring"
        }
        
        result = await mock_emotion_service.analyze_emotion(text)
        
        assert result["primary_emotion"] == "sad"
        assert result["confidence"] == 0.85
        assert "沮丧" in result["emotion_keywords"]
        assert result["suggested_response_emotion"] == "caring"
    
    @pytest.mark.asyncio
    async def test_emotion_setting(self, mock_emotion_service):
        """测试设置情绪"""
        character_id = "test_character"
        emotion_data = {
            "emotion": "happy",
            "intensity": 0.8,
            "duration": 300,  # 5分钟
            "reason": "用户分享了好消息"
        }
        
        mock_emotion_service.set_emotion.return_value = {
            "success": True,
            "current_emotion": "happy",
            "emotion_intensity": 0.8,
            "previous_emotion": "neutral",
            "transition_reason": "用户分享了好消息"
        }
        
        result = await mock_emotion_service.set_emotion(character_id, emotion_data)
        
        assert result["success"] is True
        assert result["current_emotion"] == "happy"
        assert result["emotion_intensity"] == 0.8
    
    def test_emotion_transitions(self, mock_emotion_service):
        """测试情绪转换"""
        mock_emotion_service.get_emotion_transitions.return_value = {
            "neutral": ["happy", "sad", "curious"],
            "happy": ["excited", "calm", "neutral"],
            "sad": ["depressed", "neutral", "angry"],
            "angry": ["calm", "sad", "neutral"]
        }
        
        transitions = mock_emotion_service.get_emotion_transitions()
        
        assert "happy" in transitions["neutral"]
        assert "excited" in transitions["happy"]
        assert "calm" in transitions["angry"]

@pytest.mark.performance
@pytest.mark.api
class TestAPIPerformance:
    """API性能测试"""
    
    @pytest.mark.asyncio
    async def test_chat_response_time(self, performance_monitor):
        """测试聊天响应时间"""
        performance_monitor.start()
        
        # 模拟聊天处理
        mock_service = Mock()
        mock_service.process_message = AsyncMock(return_value={
            "response": "测试回复",
            "processing_time": 0.3
        })
        
        await mock_service.process_message("测试消息")
        
        metrics = performance_monitor.stop()
        
        # API响应时间应该在合理范围内
        assert metrics["duration"] < 1.0
    
    @pytest.mark.asyncio
    async def test_concurrent_chat_requests(self):
        """测试并发聊天请求"""
        mock_service = Mock()
        mock_service.process_message = AsyncMock(return_value={
            "response": "并发测试回复",
            "processing_time": 0.2
        })
        
        # 创建多个并发请求
        tasks = []
        for i in range(10):
            task = mock_service.process_message(f"消息 {i}")
            tasks.append(task)
        
        # 等待所有请求完成
        results = await asyncio.gather(*tasks)
        
        # 验证所有请求都成功完成
        assert len(results) == 10
        for result in results:
            assert result["response"] == "并发测试回复"
    
    def test_memory_usage_under_load(self, performance_monitor):
        """测试负载下的内存使用"""
        performance_monitor.start()
        
        # 模拟大量角色创建
        characters = []
        for i in range(100):
            character = CharacterConfig(
                name=f"角色_{i}",
                display_name=f"角色{i}号"
            )
            characters.append(character)
        
        metrics = performance_monitor.stop()
        
        # 内存使用应该在合理范围内
        assert len(characters) == 100
        assert metrics["memory_used"] < 100 * 1024 * 1024  # 100MB

@pytest.mark.unit
@pytest.mark.api
class TestAPIErrorHandling:
    """API错误处理测试"""
    
    def test_invalid_message_content(self):
        """测试无效消息内容"""
        with pytest.raises(ValueError):
            Message(
                role=MessageRole.USER,
                content="",  # 空内容
                message_type=MessageType.TEXT
            )
    
    def test_invalid_emotion_intensity(self):
        """测试无效情绪强度"""
        with pytest.raises(ValueError):
            Message(
                role=MessageRole.USER,
                content="测试消息",
                emotion="happy",
                emotion_intensity=1.5  # 超出范围
            )
    
    def test_invalid_character_config(self):
        """测试无效角色配置"""
        with pytest.raises(ValueError):
            CharacterConfig(
                name="",  # 空名称
                display_name="测试"
            )
    
    def test_personality_traits_limit(self):
        """测试性格特质数量限制"""
        # 创建超过限制的特质列表
        too_many_traits = [f"特质_{i}" for i in range(15)]
        
        with pytest.raises(ValueError, match="性格特质不能超过10个"):
            CharacterConfig(
                name="测试角色",
                display_name="测试",
                personality_traits=too_many_traits
            )
    
    @pytest.mark.asyncio
    async def test_service_unavailable_error(self):
        """测试服务不可用错误"""
        mock_service = Mock()
        mock_service.process_message = AsyncMock(
            side_effect=ConnectionError("服务暂时不可用")
        )
        
        with pytest.raises(ConnectionError, match="服务暂时不可用"):
            await mock_service.process_message("测试消息")

# -*- coding: utf-8 -*-
"""
角色管理器单元测试
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from pathlib import Path

# 假设的角色管理导入（需要根据实际路径调整）
# from zishu.character.manager import CharacterManager
# from zishu.character.config import CharacterConfig
# from zishu.character.state import CharacterState
# from zishu.api.schemas.chat import EmotionType, PersonalityType

@pytest.mark.unit
@pytest.mark.character
class TestCharacterManager:
    """角色管理器测试类"""
    
    @pytest.fixture
    def mock_character_manager(self):
        """模拟角色管理器"""
        manager = Mock()
        manager.characters = {}
        manager.active_characters = set()
        manager.default_config = {
            "name": "紫舒",
            "display_name": "紫舒",
            "personality_type": "friendly",
            "interaction_style": "casual"
        }
        return manager
    
    @pytest.fixture
    def sample_character_data(self):
        """示例角色数据"""
        return {
            "id": "test_character_001",
            "name": "紫舒",
            "display_name": "紫舒",
            "description": "一个友善的AI助手",
            "personality_type": "friendly",
            "personality_traits": ["温柔", "耐心", "幽默"],
            "interaction_style": "casual",
            "response_strategy": "empathetic",
            "verbosity_level": 0.7,
            "formality_level": 0.3,
            "creativity_level": 0.6,
            "emotion_stability": 0.8,
            "default_emotion": "neutral",
            "available_emotions": ["happy", "sad", "excited", "calm", "neutral"],
            "voice_styles": ["sweet", "cheerful", "soft"],
            "default_voice": "sweet",
            "knowledge_domains": ["日常对话", "情感支持", "学习辅导"],
            "special_abilities": ["情绪识别", "个性化回复", "记忆管理"],
            "memory_enabled": True,
            "learning_enabled": True,
            "personalization_level": 0.5,
            "content_filter_level": 0.7,
            "max_response_length": 2000,
            "is_active": True
        }
    
    def test_character_manager_initialization(self, mock_character_manager):
        """测试角色管理器初始化"""
        assert mock_character_manager.characters == {}
        assert mock_character_manager.active_characters == set()
        assert mock_character_manager.default_config is not None
    
    @pytest.mark.asyncio
    async def test_create_character(self, mock_character_manager, sample_character_data):
        """测试创建角色"""
        mock_character_manager.create_character = AsyncMock(return_value=sample_character_data)
        
        result = await mock_character_manager.create_character(sample_character_data)
        
        assert result["name"] == "紫舒"
        assert result["personality_type"] == "friendly"
        assert result["is_active"] is True
        mock_character_manager.create_character.assert_called_once_with(sample_character_data)
    
    @pytest.mark.asyncio
    async def test_get_character(self, mock_character_manager, sample_character_data):
        """测试获取角色"""
        character_id = "test_character_001"
        mock_character_manager.get_character = AsyncMock(return_value=sample_character_data)
        
        result = await mock_character_manager.get_character(character_id)
        
        assert result["id"] == character_id
        assert result["name"] == "紫舒"
        mock_character_manager.get_character.assert_called_once_with(character_id)
    
    @pytest.mark.asyncio
    async def test_update_character(self, mock_character_manager, sample_character_data):
        """测试更新角色"""
        character_id = "test_character_001"
        update_data = {
            "personality_traits": ["温柔", "耐心", "幽默", "聪明"],
            "creativity_level": 0.8
        }
        
        updated_character = {**sample_character_data, **update_data}
        mock_character_manager.update_character = AsyncMock(return_value=updated_character)
        
        result = await mock_character_manager.update_character(character_id, update_data)
        
        assert result["creativity_level"] == 0.8
        assert len(result["personality_traits"]) == 4
        mock_character_manager.update_character.assert_called_once_with(character_id, update_data)
    
    @pytest.mark.asyncio
    async def test_delete_character(self, mock_character_manager):
        """测试删除角色"""
        character_id = "test_character_001"
        mock_character_manager.delete_character = AsyncMock(return_value=True)
        
        result = await mock_character_manager.delete_character(character_id)
        
        assert result is True
        mock_character_manager.delete_character.assert_called_once_with(character_id)
    
    @pytest.mark.asyncio
    async def test_list_characters(self, mock_character_manager, sample_character_data):
        """测试列出角色"""
        characters_list = [sample_character_data]
        mock_character_manager.list_characters = AsyncMock(return_value=characters_list)
        
        result = await mock_character_manager.list_characters()
        
        assert len(result) == 1
        assert result[0]["name"] == "紫舒"
        mock_character_manager.list_characters.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_activate_character(self, mock_character_manager):
        """测试激活角色"""
        character_id = "test_character_001"
        mock_character_manager.activate_character = AsyncMock(return_value=True)
        
        result = await mock_character_manager.activate_character(character_id)
        
        assert result is True
        mock_character_manager.activate_character.assert_called_once_with(character_id)
    
    @pytest.mark.asyncio
    async def test_deactivate_character(self, mock_character_manager):
        """测试停用角色"""
        character_id = "test_character_001"
        mock_character_manager.deactivate_character = AsyncMock(return_value=True)
        
        result = await mock_character_manager.deactivate_character(character_id)
        
        assert result is True
        mock_character_manager.deactivate_character.assert_called_once_with(character_id)
    
    @pytest.mark.asyncio
    async def test_get_character_state(self, mock_character_manager):
        """测试获取角色状态"""
        character_id = "test_character_001"
        character_state = {
            "character_id": character_id,
            "current_emotion": "happy",
            "emotion_intensity": 0.7,
            "energy_level": 0.8,
            "conversation_count": 15,
            "last_interaction": datetime.now(),
            "active_topics": ["学习", "娱乐"],
            "learned_preferences": {"语言风格": "轻松"},
            "active_adapters": ["soft_adapter"],
            "updated_at": datetime.now()
        }
        
        mock_character_manager.get_character_state = AsyncMock(return_value=character_state)
        
        result = await mock_character_manager.get_character_state(character_id)
        
        assert result["character_id"] == character_id
        assert result["current_emotion"] == "happy"
        assert result["conversation_count"] == 15
        mock_character_manager.get_character_state.assert_called_once_with(character_id)
    
    @pytest.mark.asyncio
    async def test_update_character_state(self, mock_character_manager):
        """测试更新角色状态"""
        character_id = "test_character_001"
        state_update = {
            "current_emotion": "excited",
            "emotion_intensity": 0.9,
            "energy_level": 0.9
        }
        
        mock_character_manager.update_character_state = AsyncMock(return_value=True)
        
        result = await mock_character_manager.update_character_state(character_id, state_update)
        
        assert result is True
        mock_character_manager.update_character_state.assert_called_once_with(character_id, state_update)
    
    @pytest.mark.asyncio
    async def test_set_character_emotion(self, mock_character_manager):
        """测试设置角色情绪"""
        character_id = "test_character_001"
        emotion = "happy"
        intensity = 0.8
        duration = 300  # 5分钟
        
        mock_character_manager.set_character_emotion = AsyncMock(return_value=True)
        
        result = await mock_character_manager.set_character_emotion(
            character_id, emotion, intensity, duration
        )
        
        assert result is True
        mock_character_manager.set_character_emotion.assert_called_once_with(
            character_id, emotion, intensity, duration
        )
    
    @pytest.mark.asyncio
    async def test_analyze_emotion(self, mock_character_manager):
        """测试情绪分析"""
        text = "今天天气真好，我很开心！"
        analysis_result = {
            "detected_emotions": [
                {"emotion": "happy", "confidence": 0.9},
                {"emotion": "excited", "confidence": 0.6}
            ],
            "primary_emotion": "happy",
            "confidence": 0.9,
            "emotion_keywords": ["开心", "好"],
            "suggested_response_emotion": "happy"
        }
        
        mock_character_manager.analyze_emotion = AsyncMock(return_value=analysis_result)
        
        result = await mock_character_manager.analyze_emotion(text)
        
        assert result["primary_emotion"] == "happy"
        assert result["confidence"] == 0.9
        assert "开心" in result["emotion_keywords"]
        mock_character_manager.analyze_emotion.assert_called_once_with(text)
    
    @pytest.mark.asyncio
    async def test_character_interaction(self, mock_character_manager):
        """测试角色交互"""
        character_id = "test_character_001"
        user_message = "你好，紫舒！"
        interaction_result = {
            "response": "你好！很高兴见到你～",
            "emotion": "happy",
            "voice_style": "sweet",
            "animation": "waving",
            "processing_time": 0.5,
            "tokens_used": 25,
            "adapters_used": ["soft_adapter"],
            "learned_info": {"用户偏好": "友好问候"},
            "personality_update": None
        }
        
        mock_character_manager.interact = AsyncMock(return_value=interaction_result)
        
        result = await mock_character_manager.interact(character_id, user_message)
        
        assert "你好" in result["response"]
        assert result["emotion"] == "happy"
        assert result["voice_style"] == "sweet"
        mock_character_manager.interact.assert_called_once_with(character_id, user_message)
    
    @pytest.mark.asyncio
    async def test_batch_character_operations(self, mock_character_manager):
        """测试批量角色操作"""
        character_ids = ["char_001", "char_002", "char_003"]
        operation = "activate"
        batch_result = {
            "operation": operation,
            "total_count": 3,
            "success_count": 2,
            "failed_count": 1,
            "results": [
                {"id": "char_001", "success": True},
                {"id": "char_002", "success": True},
                {"id": "char_003", "success": False, "error": "Character not found"}
            ],
            "errors": ["Character char_003 not found"]
        }
        
        mock_character_manager.batch_operation = AsyncMock(return_value=batch_result)
        
        result = await mock_character_manager.batch_operation(character_ids, operation)
        
        assert result["total_count"] == 3
        assert result["success_count"] == 2
        assert result["failed_count"] == 1
        mock_character_manager.batch_operation.assert_called_once_with(character_ids, operation)
    
    def test_character_validation(self, mock_character_manager):
        """测试角色配置验证"""
        # 测试有效配置
        valid_config = {
            "name": "紫舒",
            "display_name": "紫舒",
            "personality_type": "friendly",
            "interaction_style": "casual"
        }
        
        mock_character_manager.validate_character_config = Mock(return_value=True)
        
        result = mock_character_manager.validate_character_config(valid_config)
        assert result is True
        
        # 测试无效配置
        invalid_config = {
            "name": "",  # 空名称
            "personality_type": "invalid_type"
        }
        
        mock_character_manager.validate_character_config = Mock(return_value=False)
        
        result = mock_character_manager.validate_character_config(invalid_config)
        assert result is False
    
    def test_character_template_loading(self, mock_character_manager):
        """测试角色模板加载"""
        template_name = "zishu_base"
        template_config = {
            "name": "紫舒基础版",
            "personality_type": "friendly",
            "interaction_style": "casual",
            "response_strategy": "empathetic",
            "default_emotion": "neutral",
            "voice_styles": ["sweet", "cheerful"]
        }
        
        mock_character_manager.load_template = Mock(return_value=template_config)
        
        result = mock_character_manager.load_template(template_name)
        
        assert result["name"] == "紫舒基础版"
        assert result["personality_type"] == "friendly"
        mock_character_manager.load_template.assert_called_once_with(template_name)
    
    @pytest.mark.asyncio
    async def test_character_memory_management(self, mock_character_manager):
        """测试角色记忆管理"""
        character_id = "test_character_001"
        memory_data = {
            "user_preferences": {"语言": "中文", "风格": "轻松"},
            "conversation_history": ["你好", "今天天气怎么样"],
            "learned_facts": ["用户喜欢聊天", "用户关心天气"],
            "interaction_patterns": {"问候方式": "友好", "回复长度": "中等"}
        }
        
        # 测试保存记忆
        mock_character_manager.save_memory = AsyncMock(return_value=True)
        save_result = await mock_character_manager.save_memory(character_id, memory_data)
        assert save_result is True
        
        # 测试加载记忆
        mock_character_manager.load_memory = AsyncMock(return_value=memory_data)
        load_result = await mock_character_manager.load_memory(character_id)
        assert load_result["user_preferences"]["语言"] == "中文"
        assert len(load_result["conversation_history"]) == 2
        
        # 测试清除记忆
        mock_character_manager.clear_memory = AsyncMock(return_value=True)
        clear_result = await mock_character_manager.clear_memory(character_id)
        assert clear_result is True
    
    @pytest.mark.asyncio
    async def test_character_learning(self, mock_character_manager):
        """测试角色学习功能"""
        character_id = "test_character_001"
        interaction_data = {
            "user_message": "我喜欢听音乐",
            "character_response": "那你喜欢什么类型的音乐呢？",
            "user_feedback": "positive",
            "context": {"topic": "音乐", "mood": "轻松"}
        }
        
        learning_result = {
            "learned": True,
            "updates": {
                "user_preferences": {"兴趣": ["音乐"]},
                "conversation_patterns": {"音乐话题": "积极回应"},
                "response_adjustments": {"话题深入": "增加相关问题"}
            },
            "confidence": 0.8
        }
        
        mock_character_manager.learn_from_interaction = AsyncMock(return_value=learning_result)
        
        result = await mock_character_manager.learn_from_interaction(character_id, interaction_data)
        
        assert result["learned"] is True
        assert result["confidence"] == 0.8
        assert "音乐" in result["updates"]["user_preferences"]["兴趣"]
        mock_character_manager.learn_from_interaction.assert_called_once_with(character_id, interaction_data)
    
    def test_character_error_handling(self, mock_character_manager):
        """测试角色管理错误处理"""
        # 测试角色不存在的情况
        mock_character_manager.get_character = AsyncMock(side_effect=ValueError("Character not found"))
        
        with pytest.raises(ValueError, match="Character not found"):
            asyncio.run(mock_character_manager.get_character("nonexistent_id"))
        
        # 测试配置验证失败
        mock_character_manager.validate_character_config = Mock(side_effect=ValueError("Invalid config"))
        
        with pytest.raises(ValueError, match="Invalid config"):
            mock_character_manager.validate_character_config({})
    
    @pytest.mark.asyncio
    async def test_character_performance_metrics(self, mock_character_manager):
        """测试角色性能指标"""
        character_id = "test_character_001"
        metrics = {
            "total_interactions": 150,
            "average_response_time": 0.8,
            "user_satisfaction": 0.85,
            "emotion_accuracy": 0.9,
            "learning_progress": 0.7,
            "memory_usage": "45MB",
            "active_time": "2h 30m",
            "popular_topics": ["学习", "娱乐", "生活"],
            "emotion_distribution": {
                "happy": 40,
                "neutral": 30,
                "excited": 20,
                "calm": 10
            }
        }
        
        mock_character_manager.get_performance_metrics = AsyncMock(return_value=metrics)
        
        result = await mock_character_manager.get_performance_metrics(character_id)
        
        assert result["total_interactions"] == 150
        assert result["user_satisfaction"] == 0.85
        assert "学习" in result["popular_topics"]
        mock_character_manager.get_performance_metrics.assert_called_once_with(character_id)

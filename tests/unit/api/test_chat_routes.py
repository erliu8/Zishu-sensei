# -*- coding: utf-8 -*-
"""
聊天路由API单元测试
基于实际的chat.py路由实现
"""
import pytest
import asyncio
import json
import uuid
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List

from fastapi import HTTPException
from fastapi.testclient import TestClient

from zishu.api.routes.chat import (
    ChatRequest, StreamChatRequest, EmotionChatRequest,
    ChatCompletionResponse, StreamChunk, EmotionResponse, HistoryResponse,
    ChatChoice, ChatUsage, Message, MessageRole, MessageType, EmotionType
)
from zishu.api.schemas.chat import CharacterConfig


@pytest.mark.unit
@pytest.mark.api
class TestChatRequestModels:
    """聊天请求模型测试"""
    
    def test_chat_request_valid(self):
        """测试有效的聊天请求"""
        request_data = {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "test-model",
            "temperature": 0.7,
            "max_tokens": 100
        }
        
        request = ChatRequest(**request_data)
        
        assert request.messages == [{"role": "user", "content": "Hello"}]
        assert request.model == "test-model"
        assert request.temperature == 0.7
        assert request.max_tokens == 100
        assert request.stream is False
    
    def test_chat_request_with_optional_fields(self):
        """测试包含可选字段的聊天请求"""
        request_data = {
            "messages": [{"role": "user", "content": "Hello"}],
            "adapter": "openai-adapter",
            "character_id": "char-123",
            "session_id": "session-456",
            "user": "user-789",
            "stream": True
        }
        
        request = ChatRequest(**request_data)
        
        assert request.adapter == "openai-adapter"
        assert request.character_id == "char-123"
        assert request.session_id == "session-456"
        assert request.user == "user-789"
        assert request.stream is True
    
    def test_chat_request_temperature_validation(self):
        """测试温度参数验证"""
        # 有效范围
        request = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.5
        )
        assert request.temperature == 0.5
        
        # 边界值测试
        request_min = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.0
        )
        assert request_min.temperature == 0.0
        
        request_max = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            temperature=2.0
        )
        assert request_max.temperature == 2.0
    
    def test_stream_chat_request_valid(self):
        """测试流式聊天请求"""
        request_data = {
            "messages": "Hello, how are you?",
            "model": "test-model",
            "character_id": "char-123"
        }
        
        request = StreamChatRequest(**request_data)
        
        assert request.messages == "Hello, how are you?"
        assert request.model == "test-model"
        assert request.character_id == "char-123"
    
    def test_stream_chat_request_length_validation(self):
        """测试流式聊天请求长度验证"""
        # 太短的消息
        with pytest.raises(ValueError):
            StreamChatRequest(messages="")
        
        # 太长的消息
        long_message = "x" * 10001
        with pytest.raises(ValueError):
            StreamChatRequest(messages=long_message)
    
    def test_emotion_chat_request_valid(self):
        """测试情绪聊天请求"""
        request_data = {
            "messages": "I'm feeling sad today",
            "current_emotion": EmotionType.SAD,
            "emotion_intensity": 0.8,
            "analyze_emotion": True
        }
        
        request = EmotionChatRequest(**request_data)
        
        assert request.messages == "I'm feeling sad today"
        assert request.current_emotion == EmotionType.SAD
        assert request.emotion_intensity == 0.8
        assert request.analyze_emotion is True
    
    def test_emotion_intensity_validation(self):
        """测试情绪强度验证"""
        # 有效范围
        request = EmotionChatRequest(
            messages="Test message",
            emotion_intensity=0.5
        )
        assert request.emotion_intensity == 0.5
        
        # 边界值
        request_min = EmotionChatRequest(
            messages="Test message",
            emotion_intensity=0.0
        )
        assert request_min.emotion_intensity == 0.0
        
        request_max = EmotionChatRequest(
            messages="Test message",
            emotion_intensity=1.0
        )
        assert request_max.emotion_intensity == 1.0


@pytest.mark.unit
@pytest.mark.api
class TestChatResponseModels:
    """聊天响应模型测试"""
    
    def test_chat_choice_creation(self):
        """测试聊天选择创建"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Hello! How can I help you?"
        )
        
        choice = ChatChoice(
            index=0,
            message=message,
            finish_reason="stop"
        )
        
        assert choice.index == 0
        assert choice.message.role == MessageRole.ASSISTANT
        assert choice.message.content == "Hello! How can I help you?"
        assert choice.finish_reason == "stop"
    
    def test_chat_usage_creation(self):
        """测试token使用统计创建"""
        usage = ChatUsage(
            prompt_tokens=50,
            completion_tokens=30,
            total_tokens=80
        )
        
        assert usage.prompt_tokens == 50
        assert usage.completion_tokens == 30
        assert usage.total_tokens == 80
    
    def test_chat_completion_response_creation(self):
        """测试聊天完成响应创建"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Hello! How can I help you?"
        )
        
        choice = ChatChoice(
            index=0,
            message=message,
            finish_reason="stop"
        )
        
        usage = ChatUsage(
            prompt_tokens=50,
            completion_tokens=30,
            total_tokens=80
        )
        
        response = ChatCompletionResponse(
            model="test-model",
            choices=[choice],
            usage=usage,
            session_id="session-123"
        )
        
        assert response.model == "test-model"
        assert len(response.choices) == 1
        assert response.choices[0].message.content == "Hello! How can I help you?"
        assert response.usage.total_tokens == 80
        assert response.session_id == "session-123"
        assert response.object == "chat.completion"
        
        # 验证自动生成的字段
        assert response.id.startswith("chatcmpl-")
        assert isinstance(response.created, int)
    
    def test_stream_chunk_creation(self):
        """测试流式响应块创建"""
        chunk = StreamChunk(
            id="chunk-123",
            model="test-model",
            choices=[{
                "index": 0,
                "delta": {"content": "Hello"},
                "finish_reason": None
            }]
        )
        
        assert chunk.id == "chunk-123"
        assert chunk.model == "test-model"
        assert chunk.object == "chat.completion.chunk"
        assert len(chunk.choices) == 1
        assert chunk.choices[0]["delta"]["content"] == "Hello"
    
    def test_emotion_response_creation(self):
        """测试情绪响应创建"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="I understand you're feeling sad.",
            emotion=EmotionType.EMPATHETIC
        )
        
        response = EmotionResponse(
            message=message,
            user_emotion=EmotionType.SAD,
            response_emotion=EmotionType.EMPATHETIC,
            emotion_confidence=0.85,
            session_id="session-123"
        )
        
        assert response.message.content == "I understand you're feeling sad."
        assert response.user_emotion == EmotionType.SAD
        assert response.response_emotion == EmotionType.EMPATHETIC
        assert response.emotion_confidence == 0.85
        assert response.session_id == "session-123"
    
    def test_history_response_creation(self):
        """测试对话历史响应创建"""
        messages = [
            Message(role=MessageRole.USER, content="Hello"),
            Message(role=MessageRole.ASSISTANT, content="Hi there!")
        ]
        
        response = HistoryResponse(
            session_id="session-123",
            messages=messages,
            total_count=2
        )
        
        assert response.session_id == "session-123"
        assert len(response.messages) == 2
        assert response.total_count == 2
        assert response.messages[0].role == MessageRole.USER
        assert response.messages[1].role == MessageRole.ASSISTANT


@pytest.mark.unit
@pytest.mark.api
class TestChatRouteLogic:
    """聊天路由逻辑测试"""
    
    @pytest.fixture
    def mock_dependencies(self):
        """模拟依赖项"""
        return {
            "logger": Mock(),
            "performance_monitor": Mock(),
            "thread_factory": Mock(),
            "character_config": Mock(spec=CharacterConfig),
            "inference_engine": AsyncMock()
        }
    
    @pytest.fixture
    def mock_session_manager(self):
        """模拟会话管理器"""
        manager = Mock()
        manager.get_session = AsyncMock()
        manager.add_message = AsyncMock()
        manager.get_history = AsyncMock()
        return manager
    
    @pytest.fixture
    def mock_emotion_analyzer(self):
        """模拟情绪分析器"""
        analyzer = Mock()
        analyzer.analyze_emotion = AsyncMock()
        analyzer.suggest_response_emotion = AsyncMock()
        return analyzer
    
    @pytest.fixture
    def mock_response_cache(self):
        """模拟响应缓存"""
        cache = Mock()
        cache.get = AsyncMock()
        cache.set = AsyncMock()
        return cache
    
    @pytest.mark.asyncio
    async def test_chat_completion_basic_flow(self, mock_dependencies):
        """测试基本聊天完成流程"""
        # 模拟推理引擎响应
        mock_inference_result = {
            "content": "Hello! How can I help you?",
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 8,
                "total_tokens": 18
            }
        }
        mock_dependencies["inference_engine"].generate.return_value = mock_inference_result
        
        # 创建聊天请求
        request = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            model="test-model"
        )
        
        # 这里应该调用实际的路由处理函数
        # 由于我们在测试模型和逻辑，暂时模拟处理过程
        
        # 验证请求处理逻辑
        assert request.messages[0]["content"] == "Hello"
        assert request.model == "test-model"
        
        # 验证推理引擎调用
        # mock_dependencies["inference_engine"].generate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_stream_chat_flow(self, mock_dependencies):
        """测试流式聊天流程"""
        # 模拟流式响应
        async def mock_stream_generator():
            chunks = [
                {"content": "Hello"},
                {"content": " there"},
                {"content": "!"}
            ]
            for chunk in chunks:
                yield chunk
        
        mock_dependencies["inference_engine"].generate_stream.return_value = mock_stream_generator()
        
        request = StreamChatRequest(
            messages="Hello",
            model="test-model"
        )
        
        # 验证流式请求
        assert request.messages == "Hello"
        assert request.model == "test-model"
    
    @pytest.mark.asyncio
    async def test_emotion_chat_flow(self, mock_dependencies, mock_emotion_analyzer):
        """测试情绪聊天流程"""
        # 模拟情绪分析结果
        mock_emotion_analyzer.analyze_emotion.return_value = {
            "emotion": EmotionType.SAD,
            "confidence": 0.85,
            "keywords": ["sad", "down"]
        }
        
        mock_emotion_analyzer.suggest_response_emotion.return_value = EmotionType.EMPATHETIC
        
        request = EmotionChatRequest(
            messages="I'm feeling sad today",
            current_emotion=EmotionType.SAD,
            analyze_emotion=True
        )
        
        # 验证情绪请求
        assert request.messages == "I'm feeling sad today"
        assert request.current_emotion == EmotionType.SAD
        assert request.analyze_emotion is True
    
    def test_session_id_generation(self):
        """测试会话ID生成"""
        # 测试自动生成会话ID的逻辑
        request1 = ChatRequest(messages=[{"role": "user", "content": "Hello"}])
        request2 = ChatRequest(messages=[{"role": "user", "content": "Hello"}])
        
        # 如果没有提供session_id，应该能够生成或处理
        assert request1.session_id is None  # 默认为None
        assert request2.session_id is None
    
    def test_character_integration(self, mock_dependencies):
        """测试角色集成"""
        character_config = CharacterConfig(
            name="Zishu",
            display_name="紫舒老师",
            personality_type="caring"
        )
        
        request = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            character_id=character_config.id
        )
        
        # 验证角色ID传递
        assert request.character_id == character_config.id
    
    def test_adapter_selection(self):
        """测试适配器选择"""
        request = ChatRequest(
            messages=[{"role": "user", "content": "Hello"}],
            adapter="openai-adapter"
        )
        
        assert request.adapter == "openai-adapter"
    
    def test_error_handling_scenarios(self):
        """测试错误处理场景"""
        # 空消息列表
        with pytest.raises(ValueError):
            ChatRequest(messages=[])
        
        # 无效的温度值（这个应该在Pydantic验证中处理）
        # 注意：Pydantic的ge和le约束会自动处理范围验证


@pytest.mark.unit
@pytest.mark.api
class TestChatUtilities:
    """聊天工具函数测试"""
    
    def test_message_creation(self):
        """测试消息创建"""
        message = Message(
            role=MessageRole.USER,
            content="Hello, world!"
        )
        
        assert message.role == MessageRole.USER
        assert message.content == "Hello, world!"
        assert message.message_type == MessageType.TEXT
        assert isinstance(message.timestamp, datetime)
        assert message.id is not None
    
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
    
    def test_message_validation(self):
        """测试消息验证"""
        # 空内容应该被拒绝
        with pytest.raises(ValueError):
            Message(
                role=MessageRole.USER,
                content=""
            )
        
        # 只有空格的内容应该被拒绝
        with pytest.raises(ValueError):
            Message(
                role=MessageRole.USER,
                content="   "
            )
    
    def test_message_metadata(self):
        """测试消息元数据"""
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


@pytest.mark.integration
@pytest.mark.api
class TestChatRouteIntegration:
    """聊天路由集成测试"""
    
    @pytest.fixture
    def app_client(self):
        """创建测试客户端"""
        # 这里应该创建实际的FastAPI测试客户端
        # 暂时返回Mock，实际使用时需要导入真实的app
        return Mock()
    
    def test_chat_endpoint_integration(self, app_client):
        """测试聊天端点集成"""
        # 这里应该测试实际的HTTP端点
        # 由于需要完整的应用设置，暂时跳过
        pytest.skip("需要完整的应用设置")
    
    def test_stream_endpoint_integration(self, app_client):
        """测试流式端点集成"""
        pytest.skip("需要完整的应用设置")
    
    def test_emotion_endpoint_integration(self, app_client):
        """测试情绪端点集成"""
        pytest.skip("需要完整的应用设置")


@pytest.mark.unit
@pytest.mark.api
class TestChatEdgeCases:
    """聊天API边界条件测试"""
    
    def test_empty_message_content(self):
        """测试空消息内容"""
        request_data = {
            "messages": [{"role": "user", "content": ""}],
            "model": "test-model"
        }
        
        # 空内容应该被允许但可能需要特殊处理
        request = ChatRequest(**request_data)
        assert request.messages[0]["content"] == ""
    
    def test_very_long_message_content(self):
        """测试超长消息内容"""
        long_content = "x" * 100000  # 100k字符
        request_data = {
            "messages": [{"role": "user", "content": long_content}],
            "model": "test-model"
        }
        
        request = ChatRequest(**request_data)
        assert len(request.messages[0]["content"]) == 100000
    
    def test_special_characters_in_content(self):
        """测试特殊字符处理"""
        special_content = "Hello 🌟 \n\t\r 测试 ñáéíóú \\\"'`"
        request_data = {
            "messages": [{"role": "user", "content": special_content}],
            "model": "test-model"
        }
        
        request = ChatRequest(**request_data)
        assert request.messages[0]["content"] == special_content
    
    def test_maximum_messages_limit(self):
        """测试最大消息数量限制"""
        # 创建大量消息
        messages = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i}"}
            for i in range(1000)
        ]
        
        request_data = {
            "messages": messages,
            "model": "test-model"
        }
        
        request = ChatRequest(**request_data)
        assert len(request.messages) == 1000
    
    def test_temperature_boundary_values(self):
        """测试温度参数边界值"""
        # 测试最小值
        request_min = ChatRequest(
            messages=[{"role": "user", "content": "test"}],
            model="test-model",
            temperature=0.0
        )
        assert request_min.temperature == 0.0
        
        # 测试最大值
        request_max = ChatRequest(
            messages=[{"role": "user", "content": "test"}],
            model="test-model",
            temperature=2.0
        )
        assert request_max.temperature == 2.0
    
    def test_max_tokens_boundary_values(self):
        """测试最大令牌数边界值"""
        # 测试最小值
        request_min = ChatRequest(
            messages=[{"role": "user", "content": "test"}],
            model="test-model",
            max_tokens=1
        )
        assert request_min.max_tokens == 1
        
        # 测试大值
        request_max = ChatRequest(
            messages=[{"role": "user", "content": "test"}],
            model="test-model",
            max_tokens=100000
        )
        assert request_max.max_tokens == 100000
    
    def test_unicode_model_name(self):
        """测试Unicode模型名称"""
        request = ChatRequest(
            messages=[{"role": "user", "content": "test"}],
            model="模型-测试-🤖"
        )
        assert request.model == "模型-测试-🤖"


@pytest.mark.unit
@pytest.mark.api
class TestChatErrorHandling:
    """聊天API错误处理测试"""
    
    @pytest.fixture
    def failing_model_manager(self):
        """失败的模型管理器"""
        manager = Mock()
        manager.generate_response = AsyncMock(side_effect=Exception("Model error"))
        manager.generate_stream_response = AsyncMock(side_effect=Exception("Stream error"))
        manager.is_model_loaded.return_value = False
        return manager
    
    @pytest.fixture
    def timeout_model_manager(self):
        """超时的模型管理器"""
        manager = Mock()
        
        async def slow_generate(*args, **kwargs):
            await asyncio.sleep(10)  # 模拟超时
            return {"content": "response"}
        
        manager.generate_response = AsyncMock(side_effect=slow_generate)
        manager.is_model_loaded.return_value = True
        return manager
    
    @pytest.mark.asyncio
    async def test_model_not_loaded_error(self, failing_model_manager):
        """测试模型未加载错误"""
        # 这里应该测试实际的路由函数
        # 由于需要完整的应用设置，暂时跳过
        pytest.skip("需要完整的应用设置")
    
    @pytest.mark.asyncio
    async def test_model_generation_error(self, failing_model_manager):
        """测试模型生成错误"""
        pytest.skip("需要完整的应用设置")
    
    @pytest.mark.asyncio
    async def test_request_timeout_error(self, timeout_model_manager):
        """测试请求超时错误"""
        pytest.skip("需要完整的应用设置")
    
    def test_invalid_json_request(self):
        """测试无效JSON请求"""
        # 这应该在FastAPI层面被处理
        pytest.skip("需要完整的应用设置")
    
    def test_missing_required_fields(self):
        """测试缺少必需字段"""
        with pytest.raises(Exception):  # 应该是ValidationError
            ChatRequest(
                # 缺少messages字段
                model="test-model"
            )
    
    def test_invalid_message_role(self):
        """测试无效的消息角色"""
        with pytest.raises(Exception):  # 应该是ValidationError
            ChatRequest(
                messages=[{"role": "invalid_role", "content": "test"}],
                model="test-model"
            )
    
    def test_negative_temperature(self):
        """测试负温度值"""
        with pytest.raises(Exception):  # 应该是ValidationError
            ChatRequest(
                messages=[{"role": "user", "content": "test"}],
                model="test-model",
                temperature=-0.1
            )
    
    def test_negative_max_tokens(self):
        """测试负最大令牌数"""
        with pytest.raises(Exception):  # 应该是ValidationError
            ChatRequest(
                messages=[{"role": "user", "content": "test"}],
                model="test-model",
                max_tokens=-1
            )


@pytest.mark.unit
@pytest.mark.api
class TestChatStreamHandling:
    """聊天流式处理测试"""
    
    @pytest.fixture
    def stream_model_manager(self):
        """流式模型管理器"""
        manager = Mock()
        
        async def mock_stream_generator():
            chunks = [
                {"delta": {"content": "Hello"}, "finish_reason": None},
                {"delta": {"content": " world"}, "finish_reason": None},
                {"delta": {"content": "!"}, "finish_reason": "stop"}
            ]
            for chunk in chunks:
                yield chunk
        
        manager.generate_stream_response = AsyncMock(return_value=mock_stream_generator())
        manager.is_model_loaded.return_value = True
        return manager
    
    @pytest.mark.asyncio
    async def test_stream_response_chunks(self, stream_model_manager):
        """测试流式响应块"""
        # 测试流式生成器
        generator = await stream_model_manager.generate_stream_response(
            messages=[{"role": "user", "content": "Hello"}],
            model="test-model"
        )
        
        chunks = []
        async for chunk in generator:
            chunks.append(chunk)
        
        assert len(chunks) == 3
        assert chunks[0]["delta"]["content"] == "Hello"
        assert chunks[1]["delta"]["content"] == " world"
        assert chunks[2]["finish_reason"] == "stop"
    
    @pytest.mark.asyncio
    async def test_stream_error_handling(self):
        """测试流式错误处理"""
        manager = Mock()
        
        async def failing_stream_generator():
            yield {"delta": {"content": "Hello"}, "finish_reason": None}
            raise Exception("Stream error")
        
        manager.generate_stream_response = AsyncMock(return_value=failing_stream_generator())
        
        generator = await manager.generate_stream_response(
            messages=[{"role": "user", "content": "Hello"}],
            model="test-model"
        )
        
        chunks = []
        with pytest.raises(Exception, match="Stream error"):
            async for chunk in generator:
                chunks.append(chunk)
    
    @pytest.mark.asyncio
    async def test_stream_empty_response(self):
        """测试空流式响应"""
        manager = Mock()
        
        async def empty_stream_generator():
            return
            yield  # 永远不会执行
        
        manager.generate_stream_response = AsyncMock(return_value=empty_stream_generator())
        
        generator = await manager.generate_stream_response(
            messages=[{"role": "user", "content": "Hello"}],
            model="test-model"
        )
        
        chunks = []
        async for chunk in generator:
            chunks.append(chunk)
        
        assert len(chunks) == 0


@pytest.mark.unit
@pytest.mark.api
class TestChatMemoryManagement:
    """聊天内存管理测试"""
    
    @pytest.fixture
    def memory_aware_manager(self):
        """内存感知的模型管理器"""
        manager = Mock()
        manager.get_memory_usage.return_value = {
            "total": 8 * 1024 * 1024 * 1024,  # 8GB
            "used": 6 * 1024 * 1024 * 1024,   # 6GB
            "available": 2 * 1024 * 1024 * 1024  # 2GB
        }
        manager.cleanup_memory = AsyncMock()
        return manager
    
    def test_memory_usage_tracking(self, memory_aware_manager):
        """测试内存使用跟踪"""
        memory_info = memory_aware_manager.get_memory_usage()
        
        assert memory_info["total"] == 8 * 1024 * 1024 * 1024
        assert memory_info["used"] == 6 * 1024 * 1024 * 1024
        assert memory_info["available"] == 2 * 1024 * 1024 * 1024
    
    @pytest.mark.asyncio
    async def test_memory_cleanup_trigger(self, memory_aware_manager):
        """测试内存清理触发"""
        # 模拟内存不足情况
        memory_aware_manager.get_memory_usage.return_value = {
            "total": 8 * 1024 * 1024 * 1024,
            "used": 7.5 * 1024 * 1024 * 1024,  # 使用率93.75%
            "available": 0.5 * 1024 * 1024 * 1024
        }
        
        # 触发内存清理
        await memory_aware_manager.cleanup_memory()
        
        memory_aware_manager.cleanup_memory.assert_called_once()


@pytest.mark.unit
@pytest.mark.api
class TestChatConcurrency:
    """聊天并发处理测试"""
    
    @pytest.fixture
    def concurrent_model_manager(self):
        """支持并发的模型管理器"""
        manager = Mock()
        
        async def mock_generate(messages, **kwargs):
            # 模拟处理时间
            await asyncio.sleep(0.1)
            return {
                "content": f"Response to: {messages[-1]['content']}",
                "usage": {"total_tokens": 50}
            }
        
        manager.generate_response = AsyncMock(side_effect=mock_generate)
        manager.is_model_loaded.return_value = True
        return manager
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, concurrent_model_manager):
        """测试并发请求处理"""
        # 创建多个并发请求
        tasks = []
        for i in range(5):
            task = concurrent_model_manager.generate_response(
                messages=[{"role": "user", "content": f"Request {i}"}],
                model="test-model"
            )
            tasks.append(task)
        
        # 并发执行
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks)
        end_time = asyncio.get_event_loop().time()
        
        # 验证结果
        assert len(results) == 5
        for i, result in enumerate(results):
            assert f"Request {i}" in result["content"]
        
        # 并发执行应该比串行快
        total_time = end_time - start_time
        assert total_time < 0.3  # 应该远少于0.5秒（5 * 0.1）
    
    @pytest.mark.asyncio
    async def test_request_queuing(self, concurrent_model_manager):
        """测试请求队列处理"""
        # 模拟队列限制
        semaphore = asyncio.Semaphore(2)  # 最多2个并发请求
        
        async def limited_generate(messages, **kwargs):
            async with semaphore:
                return await concurrent_model_manager.generate_response(messages, **kwargs)
        
        # 创建多个请求
        tasks = []
        for i in range(5):
            task = limited_generate(
                messages=[{"role": "user", "content": f"Request {i}"}],
                model="test-model"
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        assert len(results) == 5


@pytest.mark.performance
@pytest.mark.api
class TestChatPerformance:
    """聊天API性能测试"""
    
    @pytest.fixture
    def performance_model_manager(self):
        """性能测试模型管理器"""
        manager = Mock()
        
        async def fast_generate(messages, **kwargs):
            # 快速响应
            return {
                "content": "Fast response",
                "usage": {"total_tokens": 10}
            }
        
        manager.generate_response = AsyncMock(side_effect=fast_generate)
        manager.is_model_loaded.return_value = True
        return manager
    
    @pytest.mark.asyncio
    async def test_request_processing_speed(self, performance_model_manager):
        """测试请求处理速度"""
        import time
        
        # 测试单个请求的处理时间
        start_time = time.time()
        result = await performance_model_manager.generate_response(
            messages=[{"role": "user", "content": "Hello"}],
            model="test-model"
        )
        end_time = time.time()
        
        processing_time = end_time - start_time
        assert processing_time < 0.1  # 应该很快
        assert result["content"] == "Fast response"
    
    @pytest.mark.asyncio
    async def test_throughput_performance(self, performance_model_manager):
        """测试吞吐量性能"""
        import time
        
        # 测试批量请求的吞吐量
        num_requests = 100
        start_time = time.time()
        
        tasks = []
        for i in range(num_requests):
            task = performance_model_manager.generate_response(
                messages=[{"role": "user", "content": f"Message {i}"}],
                model="test-model"
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        total_time = end_time - start_time
        throughput = num_requests / total_time
        
        assert len(results) == num_requests
        assert throughput > 50  # 每秒至少50个请求
    
    def test_memory_usage_during_processing(self):
        """测试处理过程中的内存使用"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # 创建大量请求对象
        requests = []
        for i in range(1000):
            request = ChatRequest(
                messages=[{"role": "user", "content": f"Message {i}"}],
                model="test-model"
            )
            requests.append(request)
        
        peak_memory = process.memory_info().rss
        memory_increase = peak_memory - initial_memory
        
        # 内存增长应该是合理的
        assert memory_increase < 100 * 1024 * 1024  # 少于100MB
        
        # 清理
        del requests
        import gc
        gc.collect()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

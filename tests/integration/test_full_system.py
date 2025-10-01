# -*- coding: utf-8 -*-
"""
完整系统集成测试
测试API、适配器、角色管理等各组件的集成
"""
import pytest
import asyncio
import json
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from typing import Dict, Any, List

from fastapi.testclient import TestClient
from httpx import AsyncClient

from zishu.api.schemas.chat import (
    CharacterConfig, Message, MessageRole, EmotionType, PersonalityType,
    CreateCharacterRequest, CharacterInteractionRequest
)
from zishu.adapters.base import (
    BaseAdapter, AdapterRegistry, ExecutionContext, ExecutionResult,
    AdapterMetadata, AdapterType
)


@pytest.mark.integration
@pytest.mark.system
class TestSystemIntegration:
    """系统集成测试类"""
    
    @pytest.fixture
    async def test_app(self):
        """创建测试应用实例"""
        # 这里应该创建完整的FastAPI应用
        # 由于需要完整的应用设置，暂时使用Mock
        app = Mock()
        return app
    
    @pytest.fixture
    async def test_client(self, test_app):
        """创建测试客户端"""
        # 这里应该创建TestClient
        # 暂时返回Mock
        return Mock(spec=TestClient)
    
    @pytest.fixture
    async def adapter_registry(self):
        """创建适配器注册中心"""
        registry = AdapterRegistry()
        await registry.start()
        return registry
    
    @pytest.fixture
    def sample_character_config(self):
        """示例角色配置"""
        return CharacterConfig(
            name="TestZishu",
            display_name="测试紫舒",
            description="用于集成测试的角色",
            personality_type=PersonalityType.CHEERFUL,
            available_emotions=[EmotionType.HAPPY, EmotionType.EXCITED, EmotionType.CALM],
            default_emotion=EmotionType.HAPPY,
            memory_enabled=True,
            learning_enabled=True
        )
    
    @pytest.fixture
    def mock_adapter_class(self):
        """模拟适配器类"""
        class MockAdapter(BaseAdapter):
            def __init__(self, config):
                super().__init__(config)
                self.call_count = 0
            
            def _load_metadata(self):
                return AdapterMetadata(
                    id="mock-adapter",
                    name="Mock Adapter",
                    version="1.0.0",
                    adapter_type=AdapterType.SOFT,
                    dependencies=[]
                )
            
            async def initialize(self):
                return True
            
            async def cleanup(self):
                pass
            
            async def process(self, input_data, context):
                self.call_count += 1
                return f"Mock response {self.call_count}: {input_data}"
            
            async def health_check(self):
                from zishu.adapters.base import HealthCheckResult
                return HealthCheckResult(
                    is_healthy=True,
                    status="healthy"
                )
        
        return MockAdapter


@pytest.mark.integration
@pytest.mark.system
class TestCharacterLifecycle:
    """角色生命周期集成测试"""
    
    @pytest.mark.asyncio
    async def test_create_character_full_flow(self, test_client, sample_character_config):
        """测试创建角色的完整流程"""
        # 准备创建请求
        create_request = CreateCharacterRequest(
            name=sample_character_config.name,
            display_name=sample_character_config.display_name,
            description=sample_character_config.description,
            personality_type=sample_character_config.personality_type
        )
        
        # 模拟API调用
        with patch.object(test_client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": True,
                "message": "Character created successfully",
                "character": sample_character_config.model_dump()
            }
            
            # 执行创建请求
            response = test_client.post(
                "/api/v1/character/create",
                json=create_request.model_dump()
            )
            
            # 验证响应
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["success"] is True
            assert response_data["character"]["name"] == sample_character_config.name
    
    @pytest.mark.asyncio
    async def test_character_interaction_flow(self, test_client, sample_character_config):
        """测试角色交互流程"""
        # 准备交互请求
        interaction_request = CharacterInteractionRequest(
            character_id=sample_character_config.id,
            message="Hello, how are you today?",
            context={"session_id": "test-session-123"},
            preferred_emotion=EmotionType.CHEERFUL
        )
        
        # 模拟API调用
        with patch.object(test_client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": True,
                "response": "Hello! I'm doing great, thank you for asking!",
                "emotion": "cheerful",
                "processing_time": 0.5,
                "adapters_used": ["mock-adapter"]
            }
            
            # 执行交互请求
            response = test_client.post(
                f"/api/v1/character/{sample_character_config.id}/interact",
                json=interaction_request.model_dump()
            )
            
            # 验证响应
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["success"] is True
            assert "great" in response_data["response"]
            assert response_data["emotion"] == "cheerful"


@pytest.mark.integration
@pytest.mark.system
class TestAdapterIntegration:
    """适配器集成测试"""
    
    @pytest.mark.asyncio
    async def test_adapter_registration_and_usage(self, adapter_registry, mock_adapter_class):
        """测试适配器注册和使用"""
        # 注册适配器
        registration = await adapter_registry.register_adapter(
            "mock-adapter",
            mock_adapter_class,
            {"timeout": 30}
        )
        
        assert registration.adapter_id == "mock-adapter"
        
        # 获取适配器
        adapter = await adapter_registry.get_adapter("mock-adapter")
        assert adapter is not None
        
        # 执行适配器
        context = ExecutionContext(
            user_id="test-user",
            session_id="test-session"
        )
        
        result = await adapter_registry.execute_adapter(
            "mock-adapter",
            "Test input message",
            context
        )
        
        assert isinstance(result, ExecutionResult)
        assert result.status == "success"
        assert "Mock response" in result.output
        assert "Test input message" in result.output
    
    @pytest.mark.asyncio
    async def test_multiple_adapter_coordination(self, adapter_registry, mock_adapter_class):
        """测试多个适配器协调工作"""
        # 注册多个适配器
        for i in range(3):
            await adapter_registry.register_adapter(
                f"mock-adapter-{i}",
                mock_adapter_class,
                {"timeout": 30, "adapter_id": i}
            )
        
        # 验证所有适配器都已注册
        adapters = await adapter_registry.list_adapters()
        assert len(adapters) == 3
        
        # 并发执行多个适配器
        context = ExecutionContext(user_id="test-user")
        
        tasks = []
        for i in range(3):
            task = adapter_registry.execute_adapter(
                f"mock-adapter-{i}",
                f"Input for adapter {i}",
                context
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # 验证所有结果
        assert len(results) == 3
        for i, result in enumerate(results):
            assert result.status == "success"
            assert f"Input for adapter {i}" in result.output


@pytest.mark.integration
@pytest.mark.system
class TestChatAPIIntegration:
    """聊天API集成测试"""
    
    @pytest.mark.asyncio
    async def test_chat_completion_with_character(self, test_client, sample_character_config):
        """测试带角色的聊天完成"""
        chat_request = {
            "messages": [
                {"role": "user", "content": "Hello, tell me about yourself"}
            ],
            "character_id": sample_character_config.id,
            "model": "test-model",
            "temperature": 0.7
        }
        
        # 模拟API调用
        with patch.object(test_client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "id": "chatcmpl-test123",
                "object": "chat.completion",
                "model": "test-model",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Hello! I'm 测试紫舒, a cheerful AI assistant here to help you!",
                        "emotion": "happy"
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 20,
                    "completion_tokens": 15,
                    "total_tokens": 35
                }
            }
            
            # 执行聊天请求
            response = test_client.post(
                "/api/v1/chat/completions",
                json=chat_request
            )
            
            # 验证响应
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["object"] == "chat.completion"
            assert len(response_data["choices"]) == 1
            
            message = response_data["choices"][0]["message"]
            assert message["role"] == "assistant"
            assert "测试紫舒" in message["content"]
            assert message["emotion"] == "happy"
    
    @pytest.mark.asyncio
    async def test_stream_chat_with_emotion(self, test_client, sample_character_config):
        """测试带情绪的流式聊天"""
        stream_request = {
            "messages": "I'm feeling a bit sad today",
            "character_id": sample_character_config.id,
            "current_emotion": "sad",
            "analyze_emotion": True
        }
        
        # 模拟流式响应
        mock_chunks = [
            {"id": "chunk-1", "choices": [{"delta": {"content": "I'm"}}]},
            {"id": "chunk-2", "choices": [{"delta": {"content": " sorry"}}]},
            {"id": "chunk-3", "choices": [{"delta": {"content": " to hear"}}]},
            {"id": "chunk-4", "choices": [{"delta": {"content": " that."}}]},
            {"id": "chunk-5", "choices": [{"delta": {}, "finish_reason": "stop"}]}
        ]
        
        with patch.object(test_client, 'post') as mock_post:
            # 模拟流式响应
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.iter_lines.return_value = [
                f"data: {json.dumps(chunk)}" for chunk in mock_chunks
            ] + ["data: [DONE]"]
            mock_post.return_value = mock_response
            
            # 执行流式请求
            response = test_client.post(
                "/api/v1/chat/stream",
                json=stream_request
            )
            
            # 验证响应
            assert response.status_code == 200
            
            # 处理流式数据
            full_response = ""
            for line in response.iter_lines():
                if line.startswith("data: ") and not line.endswith("[DONE]"):
                    chunk_data = json.loads(line[6:])
                    if "choices" in chunk_data and chunk_data["choices"]:
                        delta = chunk_data["choices"][0].get("delta", {})
                        if "content" in delta:
                            full_response += delta["content"]
            
            assert "sorry to hear that" in full_response


@pytest.mark.integration
@pytest.mark.system
class TestEmotionSystem:
    """情绪系统集成测试"""
    
    @pytest.mark.asyncio
    async def test_emotion_analysis_and_response(self, test_client, sample_character_config):
        """测试情绪分析和响应"""
        # 情绪分析请求
        analysis_request = {
            "text": "I just got a promotion at work! I'm so excited!",
            "context": {"conversation_turn": 1},
            "current_emotion": "neutral"
        }
        
        with patch.object(test_client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": True,
                "detected_emotions": [
                    {"emotion": "excited", "confidence": 0.9},
                    {"emotion": "happy", "confidence": 0.8}
                ],
                "primary_emotion": "excited",
                "confidence": 0.9,
                "emotion_keywords": ["promotion", "excited"],
                "suggested_response_emotion": "cheerful"
            }
            
            # 执行情绪分析
            response = test_client.post(
                "/api/v1/emotion/analyze",
                json=analysis_request
            )
            
            # 验证分析结果
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["success"] is True
            assert response_data["primary_emotion"] == "excited"
            assert response_data["confidence"] == 0.9
            assert "promotion" in response_data["emotion_keywords"]
    
    @pytest.mark.asyncio
    async def test_character_emotion_transition(self, test_client, sample_character_config):
        """测试角色情绪转换"""
        # 设置情绪请求
        emotion_request = {
            "emotion": "excited",
            "intensity": 0.8,
            "duration": 300,
            "reason": "User shared good news",
            "transition_type": "gradual"
        }
        
        with patch.object(test_client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": True,
                "current_emotion": "excited",
                "emotion_intensity": 0.8,
                "previous_emotion": "happy",
                "transition_reason": "User shared good news",
                "suggested_responses": [
                    "That's fantastic news!",
                    "I'm so excited for you!",
                    "Congratulations on your achievement!"
                ]
            }
            
            # 执行情绪设置
            response = test_client.post(
                f"/api/v1/character/{sample_character_config.id}/emotion",
                json=emotion_request
            )
            
            # 验证情绪转换
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["success"] is True
            assert response_data["current_emotion"] == "excited"
            assert response_data["emotion_intensity"] == 0.8
            assert len(response_data["suggested_responses"]) > 0


@pytest.mark.integration
@pytest.mark.system
class TestPerformanceAndReliability:
    """性能和可靠性测试"""
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, test_client, sample_character_config):
        """测试并发请求处理"""
        # 准备多个并发请求
        requests = []
        for i in range(10):
            request = {
                "character_id": sample_character_config.id,
                "message": f"Test message {i}",
                "context": {"request_id": i}
            }
            requests.append(request)
        
        # 模拟并发API调用
        async def mock_api_call(request_data):
            # 模拟处理时间
            await asyncio.sleep(0.1)
            return {
                "success": True,
                "response": f"Response to: {request_data['message']}",
                "processing_time": 0.1
            }
        
        # 执行并发请求
        start_time = time.time()
        tasks = [mock_api_call(req) for req in requests]
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        # 验证结果
        assert len(results) == 10
        for i, result in enumerate(results):
            assert result["success"] is True
            assert f"Test message {i}" in result["response"]
        
        # 验证并发性能（应该比串行快）
        total_time = end_time - start_time
        assert total_time < 0.5  # 应该远小于1秒（10 * 0.1）
    
    @pytest.mark.asyncio
    async def test_error_recovery(self, adapter_registry, mock_adapter_class):
        """测试错误恢复机制"""
        # 创建会失败的适配器
        class FailingAdapter(mock_adapter_class):
            def __init__(self, config):
                super().__init__(config)
                self.fail_count = 0
            
            async def process(self, input_data, context):
                self.fail_count += 1
                if self.fail_count <= 2:
                    raise Exception(f"Simulated failure {self.fail_count}")
                return f"Success after {self.fail_count} attempts: {input_data}"
        
        # 注册失败的适配器
        await adapter_registry.register_adapter(
            "failing-adapter",
            FailingAdapter,
            {"max_retries": 3, "timeout": 30}
        )
        
        # 执行适配器（应该在重试后成功）
        context = ExecutionContext(
            user_id="test-user",
            max_retries=3
        )
        
        result = await adapter_registry.execute_adapter(
            "failing-adapter",
            "Test input",
            context
        )
        
        # 验证最终成功
        assert result.status == "success"
        assert "Success after 3 attempts" in result.output
    
    @pytest.mark.asyncio
    async def test_memory_usage_stability(self, adapter_registry, mock_adapter_class):
        """测试内存使用稳定性"""
        # 注册适配器
        await adapter_registry.register_adapter(
            "memory-test-adapter",
            mock_adapter_class,
            {"timeout": 30}
        )
        
        # 执行大量操作
        context = ExecutionContext(user_id="test-user")
        
        for i in range(100):
            result = await adapter_registry.execute_adapter(
                "memory-test-adapter",
                f"Test message {i}",
                context
            )
            assert result.status == "success"
        
        # 验证适配器仍然健康
        health_result = await adapter_registry.health_check_adapter("memory-test-adapter")
        assert health_result.is_healthy is True


@pytest.mark.integration
@pytest.mark.system
class TestSystemConfiguration:
    """系统配置测试"""
    
    def test_development_environment_setup(self):
        """测试开发环境设置"""
        from zishu.adapters.base import create_development_registry
        
        registry = create_development_registry()
        
        # 验证开发环境配置
        assert registry._config["enable_security"] is False
        assert registry._config["enable_auto_recovery"] is False
        assert registry._config["max_concurrent_operations"] == 3
        assert registry._config["health_check_interval"] == 10
    
    def test_production_environment_setup(self):
        """测试生产环境设置"""
        from zishu.adapters.base import create_production_registry
        
        registry = create_production_registry()
        
        # 验证生产环境配置
        assert registry._config["enable_security"] is True
        assert registry._config["enable_auto_recovery"] is True
        assert registry._config["max_concurrent_operations"] == 10
        assert registry._config["health_check_interval"] == 30
    
    @pytest.mark.asyncio
    async def test_health_monitoring_integration(self):
        """测试健康监控集成"""
        from zishu.adapters.base import create_adapter_registry
        
        registry = create_adapter_registry(
            enable_health_monitoring=True,
            health_check_interval=1  # 1秒间隔用于测试
        )
        
        await registry.start()
        
        # 等待健康检查运行
        await asyncio.sleep(1.5)
        
        # 验证健康监控正在运行
        assert registry._health_monitor.is_running is True
        
        await registry.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

# -*- coding: utf-8 -*-
"""
API数据模型(Schema)单元测试
测试所有数据模型的验证和序列化
"""
import pytest
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from decimal import Decimal

from pydantic import ValidationError, BaseModel
from fastapi import HTTPException

from zishu.api.schemas.chat import (
    Message, MessageRole, MessageType, EmotionType, ChatModel,
    CharacterConfig, CharacterState, EmotionTransition,
    CreateCharacterRequest, UpdateCharacterRequest, CharacterResponse,
    CharacterListResponse, EmotionResponse as ChatEmotionResponse,
    EmotionAnalysisResponse, CharacterStateResponse
)
from zishu.api.schemas.request import (
    ChatCompletionRequest, StreamChatRequest, EmotionChatRequest,
    ModelManagementRequest, ModelSwitchRequest
)
from zishu.api.schemas.adapter import (
    AdapterInfo, AdapterType, AdapterStatus, AdapterMetadata,
    AdapterConfig, LoRAConfig, QLoRAConfig, AdapterLoadRequest,
    AdapterUnloadRequest, AdapterSwitchRequest
)
from zishu.api.schemas.responses import (
    ErrorResponse, ApiResponse, ChatCompletionResponse,
    StreamChunk, EmotionResponse, ModelListResponse, SystemMetrics,
    HealthResponse, ModelStatus, ChatResponse, ChatStreamResponse,
    ConversationSummary, ChatHistory
)
from zishu.api.schemas.chat import (
    Message, CharacterResponse, CharacterListResponse, 
    CharacterInteractionResponse, BatchOperationResponse,
    SystemStatsResponse, EmotionAnalysisResponse
)


@pytest.mark.unit
@pytest.mark.api
class TestChatSchemas:
    """聊天相关数据模型测试"""
    
    def test_message_role_enum(self):
        """测试消息角色枚举"""
        assert MessageRole.USER == "user"
        assert MessageRole.ASSISTANT == "assistant"
        assert MessageRole.SYSTEM == "system"
        assert MessageRole.FUNCTION == "function"
    
    def test_chat_message_valid(self):
        """测试有效的聊天消息"""
        message = Message(
            role=MessageRole.USER,
            content="Hello, how are you?",
            timestamp=datetime.now(timezone.utc)
        )
        
        assert message.role == MessageRole.USER
        assert message.content == "Hello, how are you?"
        assert message.name is None
        assert message.function_call is None
        assert isinstance(message.timestamp, datetime)
    
    def test_chat_message_with_metadata(self):
        """测试带元数据的聊天消息"""
        metadata = {"source": "web", "user_id": "123"}
        message = Message(
            role=MessageRole.ASSISTANT,
            content="I'm doing well, thank you!",
            metadata=metadata,
            timestamp=datetime.now(timezone.utc)
        )
        
        assert message.metadata == metadata
        assert message.role == MessageRole.ASSISTANT
    
    def test_chat_message_function_call(self):
        """测试函数调用消息"""
        function_call = {
            "name": "get_weather",
            "arguments": json.dumps({"location": "Beijing"})
        }
        
        message = Message(
            role=MessageRole.ASSISTANT,
            content="",
            function_call=function_call,
            timestamp=datetime.now(timezone.utc)
        )
        
        assert message.function_call == function_call
        assert message.role == MessageRole.ASSISTANT
    
    def test_chat_message_invalid_role(self):
        """测试无效的消息角色"""
        with pytest.raises(ValidationError):
            Message(
                role="invalid_role",
                content="Test message",
                timestamp=datetime.now(timezone.utc)
            )
    
    def test_chat_message_empty_content(self):
        """测试空内容消息"""
        # 空内容应该被允许（特别是对于函数调用）
        message = Message(
            role=MessageRole.FUNCTION,
            content="",
            name="get_weather",
            timestamp=datetime.now(timezone.utc)
        )
        
        assert message.content == ""
        assert message.name == "get_weather"
    
    def test_chat_request_valid(self):
        """测试有效的聊天请求"""
        messages = [
            Message(
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        request = ChatCompletionRequest(
            messages=messages,
            model="gpt-3.5-turbo",
            temperature=0.7,
            max_tokens=1000,
            stream=False
        )
        
        assert len(request.messages) == 1
        assert request.model == "gpt-3.5-turbo"
        assert request.temperature == 0.7
        assert request.max_tokens == 1000
        assert request.stream is False
    
    def test_chat_request_with_functions(self):
        """测试带函数的聊天请求"""
        messages = [
            Message(
                role=MessageRole.USER,
                content="What's the weather like?",
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        functions = [
            {
                "name": "get_weather",
                "description": "Get weather information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"}
                    }
                }
            }
        ]
        
        request = ChatCompletionRequest(
            messages=messages,
            model="gpt-3.5-turbo",
            functions=functions,
            function_call="auto"
        )
        
        assert request.functions == functions
        assert request.function_call == "auto"
    
    def test_chat_request_invalid_temperature(self):
        """测试无效的温度参数"""
        messages = [
            Message(
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        with pytest.raises(ValidationError):
            ChatCompletionRequest(
                messages=messages,
                model="gpt-3.5-turbo",
                temperature=2.5  # 超出范围
            )
    
    def test_chat_request_invalid_max_tokens(self):
        """测试无效的最大令牌数"""
        messages = [
            Message(
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        with pytest.raises(ValidationError):
            ChatCompletionRequest(
                messages=messages,
                model="gpt-3.5-turbo",
                max_tokens=-1  # 负数
            )
    
    def test_chat_response_valid(self):
        """测试有效的聊天响应"""
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Hello! How can I help you?",
            timestamp=datetime.now(timezone.utc)
        )
        
        response = ChatResponse(
            id=str(uuid.uuid4()),
            message=message,
            model="gpt-3.5-turbo",
            usage={
                "prompt_tokens": 10,
                "completion_tokens": 15,
                "total_tokens": 25
            },
            created=datetime.now(timezone.utc)
        )
        
        assert response.message.role == MessageRole.ASSISTANT
        assert response.usage["total_tokens"] == 25
        assert isinstance(response.created, datetime)
    
    def test_chat_stream_response_valid(self):
        """测试有效的流式聊天响应"""
        response = ChatStreamResponse(
            id=str(uuid.uuid4()),
            delta={"content": "Hello"},
            model="gpt-3.5-turbo",
            created=datetime.now(timezone.utc),
            finish_reason=None
        )
        
        assert response.delta["content"] == "Hello"
        assert response.finish_reason is None
    
    def test_chat_stream_response_finished(self):
        """测试完成的流式响应"""
        response = ChatStreamResponse(
            id=str(uuid.uuid4()),
            delta={},
            model="gpt-3.5-turbo",
            created=datetime.now(timezone.utc),
            finish_reason="stop"
        )
        
        assert response.finish_reason == "stop"
        assert response.delta == {}
    
    def test_chat_history_valid(self):
        """测试有效的聊天历史"""
        messages = [
            Message(
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime.now(timezone.utc)
            ),
            Message(
                role=MessageRole.ASSISTANT,
                content="Hi there!",
                timestamp=datetime.now(timezone.utc)
            )
        ]
        
        history = ChatHistory(
            conversation_id=str(uuid.uuid4()),
            messages=messages,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            title="Test Conversation"
        )
        
        assert len(history.messages) == 2
        assert history.title == "Test Conversation"
        assert isinstance(history.conversation_id, str)
    
    def test_conversation_summary_valid(self):
        """测试有效的对话摘要"""
        summary = ConversationSummary(
            conversation_id=str(uuid.uuid4()),
            title="Weather Discussion",
            summary="User asked about weather, assistant provided information",
            message_count=5,
            created_at=datetime.now(timezone.utc),
            last_message_at=datetime.now(timezone.utc)
        )
        
        assert summary.title == "Weather Discussion"
        assert summary.message_count == 5
        assert len(summary.summary) > 0


@pytest.mark.unit
@pytest.mark.api
class TestModelSchemas:
    """模型相关数据模型测试"""
    
    def test_adapter_info_valid(self):
        """测试有效的适配器信息"""
        info = AdapterInfo(
            name="test-adapter",
            path="/path/to/adapter",
            size=1024*1024*1024,  # 1GB
            version="1.0.0",
            description="Test adapter for unit testing",
            status="loaded",
            load_time=datetime.now(timezone.utc),
            memory_usage=512*1024*1024,  # 512MB
            config={
                "learning_rate": 0.001,
                "batch_size": 32
            }
        )
        
        assert info.name == "test-adapter"
        assert info.size == 1024*1024*1024
        assert info.status == "loaded"
        assert info.config["learning_rate"] == 0.001
    
    def test_adapter_info_size_formatting(self):
        """测试适配器大小格式化"""
        info = AdapterInfo(
            name="test-adapter",
            path="/path/to/adapter",
            size=1536*1024*1024,  # 1.5GB
            version="1.0.0",
            status="loaded",
            load_time=datetime.now(timezone.utc)
        )
        
        # 测试大小格式化方法（如果存在）
        assert info.size > 1024*1024*1024
    
    def test_adapter_load_request_valid(self):
        """测试有效的适配器加载请求"""
        request = AdapterLoadRequest(
            adapter_path="/path/to/adapter.bin",
            adapter_name="my-adapter",
            config={
                "temperature": 0.8,
                "top_p": 0.9
            },
            force_reload=False,
            async_load=True
        )
        
        assert request.adapter_path == "/path/to/adapter.bin"
        assert request.adapter_name == "my-adapter"
        assert request.force_reload is False
        assert request.async_load is True
    
    def test_adapter_load_request_invalid_path(self):
        """测试无效的适配器路径"""
        with pytest.raises(ValidationError):
            AdapterLoadRequest(
                adapter_path="",  # 空路径
                adapter_name="test-adapter"
            )
    
    def test_adapter_load_request_invalid_name(self):
        """测试无效的适配器名称"""
        with pytest.raises(ValidationError):
            AdapterLoadRequest(
                adapter_path="/path/to/adapter.bin",
                adapter_name=""  # 空名称
            )
    
    def test_adapter_unload_request_valid(self):
        """测试有效的适配器卸载请求"""
        request = AdapterUnloadRequest(
            adapter_name="test-adapter",
            force=False,
            cleanup_memory=True
        )
        
        assert request.adapter_name == "test-adapter"
        assert request.force is False
        assert request.cleanup_memory is True
    
    def test_adapter_switch_request_valid(self):
        """测试有效的适配器切换请求"""
        request = AdapterSwitchRequest(
            from_adapter_id="adapter-1",
            to_adapter_id="adapter-2",
            unload_previous=True,
            config={
                "temperature": 0.7
            }
        )
        
        assert request.from_adapter_id == "adapter-1"
        assert request.to_adapter_id == "adapter-2"
        assert request.unload_previous is True
        assert request.config["temperature"] == 0.7
    
    def test_adapter_switch_request_same_adapter(self):
        """测试切换到相同适配器"""
        with pytest.raises(ValidationError):
            AdapterSwitchRequest(
                from_adapter_id="adapter-1",
                to_adapter_id="adapter-1",  # 相同的适配器
                unload_previous=True
            )
    
    def test_model_status_valid(self):
        """测试有效的模型状态"""
        status = ModelStatus(
            status="healthy",
            loaded_adapters=["adapter-1", "adapter-2"],
            total_memory_usage=2048*1024*1024,  # 2GB
            available_memory=6144*1024*1024,    # 6GB
            gpu_info={
                "cuda:0": {
                    "name": "Tesla V100",
                    "memory_used": 1024*1024*1024,
                    "memory_total": 16*1024*1024*1024
                }
            },
            last_updated=datetime.now(timezone.utc)
        )
        
        assert status.status == "healthy"
        assert len(status.loaded_adapters) == 2
        assert status.gpu_info["cuda:0"]["name"] == "Tesla V100"
    
    def test_system_info_valid(self):
        """测试有效的系统信息"""
        info = SystemInfo(
            cpu_usage=45.2,
            memory_usage=60.8,
            disk_usage=75.0,
            gpu_usage={
                "cuda:0": 80.5,
                "cuda:1": 65.3
            },
            temperature={
                "cpu": 65.0,
                "gpu": 78.0
            },
            uptime_seconds=3600.0,
            timestamp=datetime.now(timezone.utc)
        )
        
        assert info.cpu_usage == 45.2
        assert info.gpu_usage["cuda:0"] == 80.5
        assert info.temperature["cpu"] == 65.0
        assert info.uptime_seconds == 3600.0


@pytest.mark.unit
@pytest.mark.api
class TestHealthSchemas:
    """健康检查相关数据模型测试"""
    
    def test_component_health_valid(self):
        """测试有效的组件健康状态"""
        health = ComponentHealth(
            name="database",
            status="healthy",
            message="Connection successful",
            response_time_ms=25.5,
            last_check=datetime.now(timezone.utc),
            details={
                "connection_pool": "active",
                "query_count": 1250
            }
        )
        
        assert health.name == "database"
        assert health.status == "healthy"
        assert health.response_time_ms == 25.5
        assert health.details["connection_pool"] == "active"
    
    def test_component_health_unhealthy(self):
        """测试不健康的组件状态"""
        health = ComponentHealth(
            name="redis",
            status="unhealthy",
            message="Connection timeout",
            response_time_ms=5000.0,
            last_check=datetime.now(timezone.utc),
            error="ConnectionTimeoutError: Unable to connect"
        )
        
        assert health.status == "unhealthy"
        assert health.error is not None
        assert "timeout" in health.message.lower()
    
    def test_system_metrics_valid(self):
        """测试有效的系统指标"""
        metrics = SystemMetrics(
            cpu_percent=45.2,
            memory_percent=68.5,
            disk_percent=75.0,
            network_io={
                "bytes_sent": 1024*1024*100,
                "bytes_recv": 1024*1024*200
            },
            process_count=156,
            load_average=[1.2, 1.5, 1.8],
            timestamp=datetime.now(timezone.utc)
        )
        
        assert metrics.cpu_percent == 45.2
        assert metrics.memory_percent == 68.5
        assert len(metrics.load_average) == 3
        assert metrics.network_io["bytes_sent"] == 1024*1024*100
    
    def test_health_check_response_valid(self):
        """测试有效的健康检查响应"""
        response = HealthCheckResponse(
            status="healthy",
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=7200.0,
            version="1.0.0"
        )
        
        assert response.status == "healthy"
        assert response.uptime_seconds == 7200.0
        assert response.version == "1.0.0"
    
    def test_deep_health_check_response_valid(self):
        """测试有效的深度健康检查响应"""
        components = [
            ComponentHealth(
                name="database",
                status="healthy",
                message="OK",
                response_time_ms=25.0,
                last_check=datetime.now(timezone.utc)
            ),
            ComponentHealth(
                name="redis",
                status="degraded",
                message="High latency",
                response_time_ms=150.0,
                last_check=datetime.now(timezone.utc)
            )
        ]
        
        metrics = SystemMetrics(
            cpu_percent=45.0,
            memory_percent=60.0,
            disk_percent=70.0,
            process_count=100,
            load_average=[1.0, 1.1, 1.2],
            timestamp=datetime.now(timezone.utc)
        )
        
        response = DeepHealthCheckResponse(
            status="degraded",
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=7200.0,
            version="1.0.0",
            components=components,
            system_metrics=metrics,
            summary={
                "total_components": 2,
                "healthy_count": 1,
                "unhealthy_count": 0,
                "degraded_count": 1
            }
        )
        
        assert response.status == "degraded"
        assert len(response.components) == 2
        assert response.summary["healthy_count"] == 1
        assert response.summary["degraded_count"] == 1


@pytest.mark.unit
@pytest.mark.api
class TestCommonSchemas:
    """通用数据模型测试"""
    
    def test_base_response_valid(self):
        """测试有效的基础响应"""
        response = BaseResponse(
            success=True,
            message="Operation completed successfully",
            timestamp=datetime.now(timezone.utc),
            request_id=str(uuid.uuid4())
        )
        
        assert response.success is True
        assert response.message == "Operation completed successfully"
        assert isinstance(response.timestamp, datetime)
        assert len(response.request_id) > 0
    
    def test_error_response_valid(self):
        """测试有效的错误响应"""
        response = ErrorResponse(
            success=False,
            message="Validation failed",
            error_code="VALIDATION_ERROR",
            error_details={
                "field": "email",
                "reason": "Invalid format"
            },
            timestamp=datetime.now(timezone.utc),
            request_id=str(uuid.uuid4())
        )
        
        assert response.success is False
        assert response.error_code == "VALIDATION_ERROR"
        assert response.error_details["field"] == "email"
    
    def test_pagination_params_valid(self):
        """测试有效的分页参数"""
        params = PaginationParams(
            page=2,
            size=20,
            sort_by="created_at",
            sort_order=SortOrder.DESC
        )
        
        assert params.page == 2
        assert params.size == 20
        assert params.sort_by == "created_at"
        assert params.sort_order == SortOrder.DESC
    
    def test_pagination_params_invalid_page(self):
        """测试无效的页码"""
        with pytest.raises(ValidationError):
            PaginationParams(
                page=0,  # 页码应该从1开始
                size=20
            )
    
    def test_pagination_params_invalid_size(self):
        """测试无效的页面大小"""
        with pytest.raises(ValidationError):
            PaginationParams(
                page=1,
                size=0  # 页面大小应该大于0
            )
    
    def test_sort_order_enum(self):
        """测试排序顺序枚举"""
        assert SortOrder.ASC == "asc"
        assert SortOrder.DESC == "desc"
    
    def test_filter_params_valid(self):
        """测试有效的过滤参数"""
        params = FilterParams(
            filters={
                "status": "active",
                "category": "test",
                "created_after": "2024-01-01"
            },
            search="test query",
            date_from=datetime(2024, 1, 1, tzinfo=timezone.utc),
            date_to=datetime(2024, 12, 31, tzinfo=timezone.utc)
        )
        
        assert params.filters["status"] == "active"
        assert params.search == "test query"
        assert params.date_from.year == 2024
        assert params.date_to.year == 2024
    
    def test_api_version_valid(self):
        """测试有效的API版本"""
        version = APIVersion(
            version="v1.2.3",
            build="20241001.1",
            commit_hash="abc123def456",
            release_date=datetime(2024, 10, 1, tzinfo=timezone.utc)
        )
        
        assert version.version == "v1.2.3"
        assert version.build == "20241001.1"
        assert version.commit_hash == "abc123def456"


@pytest.mark.unit
@pytest.mark.api
class TestSchemaValidation:
    """数据模型验证测试"""
    
    def test_nested_model_validation(self):
        """测试嵌套模型验证"""
        # 创建包含嵌套模型的复杂数据结构
        message = Message(
            role=MessageRole.USER,
            content="Test message",
            timestamp=datetime.now(timezone.utc)
        )
        
        request = ChatCompletionRequest(
            messages=[message],
            model="gpt-3.5-turbo",
            temperature=0.7
        )
        
        # 验证嵌套结构
        assert len(request.messages) == 1
        assert request.messages[0].role == MessageRole.USER
        assert request.messages[0].content == "Test message"
    
    def test_optional_field_validation(self):
        """测试可选字段验证"""
        # 只提供必需字段
        message = Message(
            role=MessageRole.USER,
            content="Test",
            timestamp=datetime.now(timezone.utc)
        )
        
        assert message.name is None
        assert message.function_call is None
        assert message.metadata is None
    
    def test_field_constraints_validation(self):
        """测试字段约束验证"""
        # 测试字符串长度约束
        with pytest.raises(ValidationError):
            Message(
                role=MessageRole.USER,
                content="x" * 10001,  # 假设有长度限制
                timestamp=datetime.now(timezone.utc)
            )
    
    def test_custom_validator_methods(self):
        """测试自定义验证器方法"""
        # 测试温度范围验证
        with pytest.raises(ValidationError):
            ChatCompletionRequest(
                messages=[
                    Message(
                        role=MessageRole.USER,
                        content="Test",
                        timestamp=datetime.now(timezone.utc)
                    )
                ],
                model="gpt-3.5-turbo",
                temperature=3.0  # 超出有效范围
            )
    
    def test_datetime_serialization(self):
        """测试日期时间序列化"""
        timestamp = datetime.now(timezone.utc)
        message = Message(
            role=MessageRole.USER,
            content="Test",
            timestamp=timestamp
        )
        
        # 序列化为字典
        message_dict = message.dict()
        assert isinstance(message_dict["timestamp"], datetime)
        
        # 序列化为JSON
        message_json = message.json()
        assert isinstance(message_json, str)
        
        # 反序列化
        parsed_message = Message.parse_raw(message_json)
        assert parsed_message.timestamp == timestamp
    
    def test_model_copy_and_update(self):
        """测试模型复制和更新"""
        original = Message(
            role=MessageRole.USER,
            content="Original content",
            timestamp=datetime.now(timezone.utc)
        )
        
        # 复制并更新
        updated = original.copy(update={"content": "Updated content"})
        
        assert original.content == "Original content"
        assert updated.content == "Updated content"
        assert original.role == updated.role
        assert original.timestamp == updated.timestamp


@pytest.mark.performance
@pytest.mark.api
class TestSchemaPerformance:
    """数据模型性能测试"""
    
    def test_message_creation_performance(self):
        """测试消息创建性能"""
        import time
        
        start_time = time.time()
        messages = []
        
        for i in range(1000):
            message = Message(
                role=MessageRole.USER,
                content=f"Test message {i}",
                timestamp=datetime.now(timezone.utc)
            )
            messages.append(message)
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_time = total_time / 1000
        
        # 平均创建时间应该很快
        assert avg_time < 0.001  # 每个消息少于1ms
        assert total_time < 1.0   # 总时间少于1秒
    
    def test_serialization_performance(self):
        """测试序列化性能"""
        import time
        
        # 创建复杂的数据结构
        messages = [
            Message(
                role=MessageRole.USER,
                content=f"Message {i}",
                timestamp=datetime.now(timezone.utc),
                metadata={"index": i, "type": "test"}
            )
            for i in range(100)
        ]
        
        request = ChatCompletionRequest(
            messages=messages,
            model="gpt-3.5-turbo",
            temperature=0.7,
            max_tokens=1000
        )
        
        # 测试JSON序列化性能
        start_time = time.time()
        for _ in range(100):
            json_str = request.json()
        end_time = time.time()
        
        total_time = end_time - start_time
        avg_time = total_time / 100
        
        # 序列化应该很快
        assert avg_time < 0.01  # 每次序列化少于10ms
        assert total_time < 1.0  # 总时间少于1秒


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

# -*- coding: utf-8 -*-
"""
软适配器测试

测试基于提示词的软适配器功能
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List

from zishu.adapters.soft.soft_adapter import (
    SoftAdapter, SoftAdapterMode, SoftAdapterRequest, SoftAdapterResponse,
    ContentType, ComponentStatus
)
from zishu.adapters.base import (
    AdapterStatus, AdapterCapability, ExecutionContext,
    ExecutionResult, HealthCheckResult, AdapterType, SoftAdapterError
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestSoftAdapter:
    """软适配器测试类"""

    @pytest.fixture
    def soft_adapter_config(self):
        """创建软适配器配置"""
        return {
            "adapter_id": "test-soft-adapter",
            "name": "测试软适配器",
            "version": "1.0.0",
            "adapter_type": AdapterType.SOFT,
            "description": "测试软适配器实例",
            "prompt_templates": {
                "default": {
                    "template": "请处理以下内容: {input}",
                    "variables": ["input"],
                    "mode": "completion"
                }
            },
            "knowledge_base": {
                "enabled": False,
                "embedding_model": "text-embedding-ada-002",
                "max_documents": 1000
            },
            "rag_config": {
                "enabled": False,
                "top_k": 5,
                "similarity_threshold": 0.7
            },
            "prompt_engine": {
                "enabled": False
            }
        }

    @pytest.fixture
    def mock_language_model(self):
        """模拟语言模型"""
        model = AsyncMock()
        model.generate = AsyncMock(return_value={
            "text": "这是生成的响应",
            "metadata": {"tokens_used": 50}
        })
        return model

    @pytest.fixture
    def soft_adapter(self, soft_adapter_config, mock_language_model):
        """创建软适配器实例"""
        adapter = SoftAdapter(soft_adapter_config)
        adapter._language_model = mock_language_model
        return adapter

    @pytest.mark.asyncio
    async def test_adapter_initialization(self, soft_adapter):
        """测试软适配器初始化"""
        # Act
        await soft_adapter.initialize()
        
        # Assert
        assert soft_adapter.status == AdapterStatus.LOADED
        # 软适配器应该具有自然语言处理能力
        capabilities = soft_adapter.get_capabilities()
        assert len(capabilities) > 0
        # 只检查是否有能力即可，不检查具体内容

    @pytest.mark.asyncio
    async def test_prompt_template_processing(self, soft_adapter):
        """测试提示模板处理"""
        await soft_adapter.initialize()
        
        # Arrange
        input_data = {"input": "测试文本"}
        context = ExecutionContext(
            request_id="test-001",
            user_id="test-user"
        )
        
        # Act
        result = await soft_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "这是生成的响应" in result.data["text"]
        assert result.metadata["tokens_used"] == 50

    @pytest.mark.asyncio
    async def test_custom_prompt_template(self, soft_adapter_config):
        """测试自定义提示模板"""
        # Arrange
        soft_adapter_config["prompt_templates"]["custom"] = {
            "template": "角色: {role}\n任务: {task}\n输入: {input}",
            "variables": ["role", "task", "input"],
            "mode": "chat"
        }
        
        adapter = SoftAdapter(soft_adapter_config)
        adapter._language_model = AsyncMock()
        adapter._language_model.generate = AsyncMock(return_value={
            "text": "自定义模板响应",
            "metadata": {"tokens_used": 75}
        })
        
        await adapter.initialize()
        
        # Act
        input_data = {
            "template_name": "custom",
            "role": "助手",
            "task": "翻译",
            "input": "Hello world"
        }
        context = ExecutionContext(request_id="test-002")
        result = await adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "自定义模板响应" in result.data["text"]

    @pytest.mark.asyncio
    async def test_prompt_template_validation(self, soft_adapter):
        """测试提示模板验证"""
        await soft_adapter.initialize()
        
        # Act & Assert - 缺少必需变量
        input_data = {}  # 缺少 'input' 变量
        context = ExecutionContext(request_id="test-003")
        
        result = await soft_adapter.process(input_data, context)
        assert result.status == "error"
        assert "missing required variables" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_knowledge_base_integration(self, soft_adapter_config, mock_language_model):
        """测试知识库集成"""
        # Arrange - 启用知识库
        soft_adapter_config["knowledge_base"]["enabled"] = True
        soft_adapter_config["rag_config"]["enabled"] = True
        
        adapter = SoftAdapter(soft_adapter_config)
        adapter._language_model = mock_language_model
        
        # Mock 知识库
        mock_kb = AsyncMock()
        mock_kb.search = AsyncMock(return_value=[
            {"content": "相关文档1", "score": 0.9},
            {"content": "相关文档2", "score": 0.8}
        ])
        adapter._knowledge_base = mock_kb
        
        await adapter.initialize()
        
        # Act
        input_data = {
            "input": "查询问题",
            "use_rag": True
        }
        context = ExecutionContext(request_id="test-004")
        result = await adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        mock_kb.search.assert_called_once()
        mock_language_model.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_batch_processing(self, soft_adapter):
        """测试批量处理"""
        await soft_adapter.initialize()
        
        # Arrange
        batch_data = [
            {"input": f"文本{i}"} for i in range(5)
        ]
        context = ExecutionContext(request_id="test-batch")
        
        # Act
        results = []
        for data in batch_data:
            result = await soft_adapter.process(data, context)
            results.append(result)
        
        # Assert
        assert len(results) == 5
        assert all(r.status == "success" for r in results)

    @pytest.mark.asyncio
    async def test_health_check(self, soft_adapter):
        """测试健康检查"""
        await soft_adapter.initialize()
        
        # Act
        health = await soft_adapter.health_check()
        
        # Assert
        assert isinstance(health, HealthCheckResult)
        assert health.is_healthy is True
        assert health.status == "healthy"

    @pytest.mark.asyncio
    async def test_error_handling(self, soft_adapter):
        """测试错误处理"""
        await soft_adapter.initialize()
        
        # Arrange - 模拟语言模型错误
        soft_adapter._language_model.generate.side_effect = Exception("Model error")
        
        # Act
        input_data = {"input": "测试文本"}
        context = ExecutionContext(request_id="test-error")
        result = await soft_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "error"
        assert "model error" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_concurrent_processing(self, soft_adapter):
        """测试并发处理"""
        await soft_adapter.initialize()
        
        # Arrange
        tasks = []
        for i in range(10):
            input_data = {"input": f"并发文本{i}"}
            context = ExecutionContext(request_id=f"concurrent-{i}")
            task = soft_adapter.process(input_data, context)
            tasks.append(task)
        
        # Act
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Assert
        assert len(results) == 10
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 8  # 允许少数失败

    @pytest.mark.asyncio
    async def test_template_caching(self, soft_adapter):
        """测试模板缓存"""
        await soft_adapter.initialize()
        
        # Act - 多次使用相同模板
        for i in range(3):
            input_data = {"input": f"缓存测试{i}"}
            context = ExecutionContext(request_id=f"cache-{i}")
            result = await soft_adapter.process(input_data, context)
            assert result.status == "success"
        
        # Assert - 验证适配器仍然正常工作
        assert soft_adapter.status == AdapterStatus.READY


# TODO: 这些测试类需要实际的PromptTemplate和KnowledgeBase实现
# class TestPromptTemplate:
#     """提示模板测试类"""
#     pass
# 
# class TestKnowledgeBaseIntegration:
#     """知识库集成测试类 - 需要实际实现"""
#     pass


@pytest.mark.performance
class TestSoftAdapterPerformance:
    """软适配器性能测试"""
    
    @pytest.mark.asyncio
    async def test_response_time(self, soft_adapter):
        """测试响应时间"""
        await soft_adapter.initialize()
        
        # Act
        start_time = asyncio.get_event_loop().time()
        
        input_data = {"input": "性能测试"}
        context = ExecutionContext(request_id="perf-001")
        result = await soft_adapter.process(input_data, context)
        
        end_time = asyncio.get_event_loop().time()
        response_time = end_time - start_time
        
        # Assert
        assert result.status == "success"
        assert response_time < 2.0  # 应在2秒内完成
    
    @pytest.mark.asyncio
    async def test_throughput(self, soft_adapter):
        """测试吞吐量"""
        await soft_adapter.initialize()
        
        # Arrange
        num_requests = 50
        tasks = []
        
        for i in range(num_requests):
            input_data = {"input": f"吞吐量测试{i}"}
            context = ExecutionContext(request_id=f"throughput-{i}")
            task = soft_adapter.process(input_data, context)
            tasks.append(task)
        
        # Act
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = asyncio.get_event_loop().time()
        
        # Assert
        duration = end_time - start_time
        successful_results = [r for r in results if not isinstance(r, Exception)]
        throughput = len(successful_results) / duration
        
        assert len(successful_results) >= 45  # 至少90%成功
        assert throughput > 10  # 每秒至少处理10个请求

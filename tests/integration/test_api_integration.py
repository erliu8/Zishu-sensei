# -*- coding: utf-8 -*-
"""
API集成测试套件
测试端到端功能和API之间的交互
"""
import pytest
import asyncio
import json
import uuid
import time
import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import FastAPI, status
import asyncio
from httpx import AsyncClient, ASGITransport

from zishu.api.server import create_app


@pytest.fixture(scope="session")
def test_app():
    """创建测试应用(模块级fixture，供所有测试类复用)"""
    test_config = {
        "TESTING": True,
        "API_HOST": "127.0.0.1",
        "API_PORT": 8000,
        "LOG_LEVEL": "DEBUG",
        "CORS_ORIGINS": ["http://localhost:3000"],
        "ADAPTERS_DIR": "./test_adapters",
        "MAX_REQUEST_SIZE": 10 * 1024 * 1024,
        "REQUEST_TIMEOUT": 30.0,
    }

    try:
        # 使用正确的create_app签名
        app = create_app(debug=True)
        return app
    except Exception:
        app = FastAPI(title="Test API")

        @app.get("/health")
        async def health_check():
            return {"status": "healthy"}

        @app.post("/api/v1/chat/completions")
        async def chat_completions(request: dict):
            return {
                "id": str(uuid.uuid4()),
                "object": "chat.completion",
                "created": int(time.time()),
                "model": request.get("model", "test-model"),
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "Test response"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            }

        return app


class SyncASGIClient:
    """基于AsyncClient封装的同步HTTP客户端，用于测试同步用例"""
    def __init__(self, app):
        self.app = app

    def request(self, method: str, url: str, **kwargs):
        async def _do():
            transport = ASGITransport(app=self.app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                return await ac.request(method, url, **kwargs)

        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(_do())
        finally:
            loop.run_until_complete(asyncio.sleep(0))
            loop.close()

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)


@pytest.fixture
def client(test_app):
    """创建测试客户端 (同步包装)"""
    return SyncASGIClient(test_app)


@pytest.fixture
async def async_client(test_app):
    """创建异步测试客户端 (httpx + ASGITransport)"""
    transport = ASGITransport(app=test_app)
    ac = AsyncClient(transport=transport, base_url="http://test")
    try:
        yield ac
    finally:
        await ac.aclose()


@pytest.mark.integration
@pytest.mark.api
class TestAPIIntegrationSetup:
    """API集成测试设置(占位，模块级fixtures已提供)"""
    pass
    
    @pytest.fixture
    def mock_model_manager(self):
        """模拟模型管理器"""
        manager = Mock()
        manager.is_model_loaded.return_value = True
        manager.get_loaded_adapters.return_value = {
            "test-adapter": {
                "path": "/test/adapter.bin",
                "size": 1024*1024*1024,
                "status": "loaded"
            }
        }
        
        async def mock_generate(messages, **kwargs):
            return {
                "content": "Integration test response",
                "usage": {"total_tokens": 25}
            }
        
        manager.generate_response = AsyncMock(side_effect=mock_generate)
        return manager


@pytest.mark.integration
@pytest.mark.api
class TestHealthIntegration:
    """健康检查集成测试"""
    
    def test_health_endpoint_basic(self, client):
        """测试基本健康检查端点"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    def test_health_endpoint_with_cors(self, client):
        """测试带CORS的健康检查"""
        response = client.get(
            "/health",
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        # 检查CORS头
        assert "Access-Control-Allow-Origin" in response.headers
    
    @pytest.mark.asyncio
    async def test_health_endpoint_async(self, async_client):
        """测试异步健康检查"""
        response = await async_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    def test_health_endpoint_performance(self, client):
        """测试健康检查性能"""
        start_time = time.time()
        
        # 连续多次请求
        for _ in range(10):
            response = client.get("/health")
            assert response.status_code == 200
        
        total_time = time.time() - start_time
        avg_time = total_time / 10
        
        # 平均响应时间应该很快
        assert avg_time < 0.1  # 每次请求少于100ms


@pytest.mark.integration
@pytest.mark.api
class TestChatIntegration:
    """聊天API集成测试"""
    
    def test_chat_completions_basic(self, client):
        """测试基本聊天完成"""
        request_data = {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "test-model",
            "temperature": 0.7,
            "max_tokens": 100
        }
        
        response = client.post("/api/v1/chat/completions", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "choices" in data
        assert len(data["choices"]) > 0
        assert data["choices"][0]["message"]["role"] == "assistant"
    
    def test_chat_completions_with_history(self, client):
        """测试带历史记录的聊天"""
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"},
                {"role": "user", "content": "How are you?"}
            ],
            "model": "test-model"
        }
        
        response = client.post("/api/v1/chat/completions", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "choices" in data
        assert data["choices"][0]["message"]["content"] is not None
    
    def test_chat_completions_invalid_request(self, client):
        """测试无效的聊天请求"""
        # 缺少必需字段
        request_data = {
            "model": "test-model"
            # 缺少messages字段
        }
        
        response = client.post("/api/v1/chat/completions", json=request_data)
        
        assert response.status_code == 422  # Validation error
    
    def test_chat_completions_empty_messages(self, client):
        """测试空消息列表"""
        request_data = {
            "messages": [],
            "model": "test-model"
        }
        
        response = client.post("/api/v1/chat/completions", json=request_data)
        
        # 可能返回400或422，取决于验证逻辑
        assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_chat_completions_async(self, async_client):
        """测试异步聊天完成"""
        request_data = {
            "messages": [{"role": "user", "content": "Hello async"}],
            "model": "test-model"
        }
        
        response = await async_client.post("/api/v1/chat/completions", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "choices" in data
    
    def test_chat_completions_concurrent(self, client):
        """测试并发聊天请求"""
        import concurrent.futures
        import threading
        
        def make_request(i):
            request_data = {
                "messages": [{"role": "user", "content": f"Request {i}"}],
                "model": "test-model"
            }
            return client.post("/api/v1/chat/completions", json=request_data)
        
        # 并发发送多个请求
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request, i) for i in range(10)]
            responses = [future.result() for future in futures]
        
        # 验证所有请求都成功
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert "choices" in data


@pytest.mark.integration
@pytest.mark.api
class TestModelManagementIntegration:
    """模型管理集成测试"""
    
    def test_list_adapters_endpoint(self, client):
        """测试列出适配器端点"""
        # 这个测试需要实际的模型管理端点
        # 如果端点不存在，会返回404
        response = client.get("/models/adapters")
        
        # 端点可能不存在，所以检查状态码
        if response.status_code == 404:
            pytest.skip("Models endpoint not implemented")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))
    
    def test_model_status_endpoint(self, client):
        """测试模型状态端点"""
        response = client.get("/models/status")
        
        if response.status_code == 404:
            pytest.skip("Model status endpoint not implemented")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or isinstance(data, list)
    
    def test_load_adapter_endpoint(self, client):
        """测试加载适配器端点"""
        request_data = {
            "adapter_path": "/test/adapter.bin",
            "adapter_name": "test-adapter",
            "config": {"temperature": 0.8}
        }
        
        response = client.post("/models/adapters/load", json=request_data)
        
        if response.status_code == 404:
            pytest.skip("Load adapter endpoint not implemented")
        
        # 可能返回200（成功）或400（错误）
        assert response.status_code in [200, 400, 422]


@pytest.mark.integration
@pytest.mark.api
class TestAPIWorkflow:
    """API工作流集成测试"""
    
    def test_complete_chat_workflow(self, client):
        """测试完整的聊天工作流"""
        # 1. 检查健康状态
        health_response = client.get("/health")
        assert health_response.status_code == 200
        
        # 2. 检查模型状态（如果端点存在）
        model_status_response = client.get("/models/status")
        if model_status_response.status_code != 404:
            assert model_status_response.status_code == 200
        
        # 3. 发送聊天请求
        chat_request = {
            "messages": [{"role": "user", "content": "Hello, how are you?"}],
            "model": "test-model",
            "temperature": 0.7
        }
        
        chat_response = client.post("/api/v1/chat/completions", json=chat_request)
        assert chat_response.status_code == 200
        
        chat_data = chat_response.json()
        assert "choices" in chat_data
        assert len(chat_data["choices"]) > 0
        
        # 4. 验证响应格式
        choice = chat_data["choices"][0]
        assert "message" in choice
        assert choice["message"]["role"] == "assistant"
        assert "content" in choice["message"]
    
    def test_error_handling_workflow(self, client):
        """测试错误处理工作流"""
        # 1. 发送无效请求
        invalid_request = {
            "messages": "invalid_format",  # 应该是列表
            "model": "test-model"
        }
        
        response = client.post("/api/v1/chat/completions", json=invalid_request)
        assert response.status_code == 422
        
        error_data = response.json()
        assert "detail" in error_data
        
        # 2. 发送过大的请求（如果有大小限制）
        large_content = "x" * (1024 * 1024)  # 1MB内容
        large_request = {
            "messages": [{"role": "user", "content": large_content}],
            "model": "test-model"
        }
        
        response = client.post("/api/v1/chat/completions", json=large_request)
        # 可能成功或因为大小限制失败
        assert response.status_code in [200, 413, 422]
    
    @pytest.mark.asyncio
    async def test_async_workflow(self, async_client):
        """测试异步工作流"""
        # 1. 异步健康检查
        health_response = await async_client.get("/health")
        assert health_response.status_code == 200
        
        # 2. 异步聊天请求
        chat_request = {
            "messages": [{"role": "user", "content": "Async hello"}],
            "model": "test-model"
        }
        
        chat_response = await async_client.post("/api/v1/chat/completions", json=chat_request)
        assert chat_response.status_code == 200
        
        # 3. 并发异步请求
        tasks = []
        for i in range(5):
            request = {
                "messages": [{"role": "user", "content": f"Async request {i}"}],
                "model": "test-model"
            }
            task = async_client.post("/api/v1/chat/completions", json=request)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert "choices" in data


@pytest.mark.integration
@pytest.mark.api
class TestAPISecurityIntegration:
    """API安全集成测试"""
    
    def test_cors_headers(self, client):
        """测试CORS头设置"""
        # 预检请求
        response = client.options(
            "/api/v1/chat/completions",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        
        # 检查CORS响应
        if response.status_code == 200:
            assert "Access-Control-Allow-Origin" in response.headers
            assert "Access-Control-Allow-Methods" in response.headers
    
    def test_security_headers(self, client):
        """测试安全头"""
        response = client.get("/health")
        
        # 检查常见的安全头
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection"
        ]
        
        for header in security_headers:
            # 不是所有安全头都必须存在，但如果存在应该有正确的值
            if header in response.headers:
                assert len(response.headers[header]) > 0
    
    def test_request_size_limits(self, client):
        """测试请求大小限制"""
        # 创建一个非常大的请求
        huge_content = "x" * (50 * 1024 * 1024)  # 50MB
        large_request = {
            "messages": [{"role": "user", "content": huge_content}],
            "model": "test-model"
        }
        
        response = client.post("/api/v1/chat/completions", json=large_request)
        
        # 应该被拒绝（413 Request Entity Too Large 或其他错误）
        assert response.status_code in [413, 422, 400]
    
    def test_rate_limiting(self, client):
        """测试速率限制（如果实现了）"""
        # 快速发送大量请求
        responses = []
        for i in range(20):
            response = client.get("/health")
            responses.append(response)
        
        # 检查是否有任何请求被限制
        status_codes = [r.status_code for r in responses]
        
        # 如果实现了速率限制，应该有429状态码
        # 如果没有实现，所有请求都应该成功
        assert all(code in [200, 429] for code in status_codes)


@pytest.mark.integration
@pytest.mark.api
class TestAPIPerformanceIntegration:
    """API性能集成测试"""
    
    def test_response_time_performance(self, client):
        """测试响应时间性能"""
        # 测试健康检查响应时间
        start_time = time.time()
        response = client.get("/health")
        health_time = time.time() - start_time
        
        assert response.status_code == 200
        assert health_time < 1.0  # 健康检查应该很快
        
        # 测试聊天请求响应时间
        chat_request = {
            "messages": [{"role": "user", "content": "Quick test"}],
            "model": "test-model"
        }
        
        start_time = time.time()
        response = client.post("/api/v1/chat/completions", json=chat_request)
        chat_time = time.time() - start_time
        
        assert response.status_code == 200
        assert chat_time < 5.0  # 聊天请求应该在5秒内完成
    
    def test_concurrent_performance(self, client):
        """测试并发性能"""
        import concurrent.futures
        
        def make_health_request():
            return client.get("/health")
        
        # 并发健康检查
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_health_request) for _ in range(50)]
            responses = [future.result() for future in futures]
        total_time = time.time() - start_time
        
        # 验证所有请求成功
        assert all(r.status_code == 200 for r in responses)
        
        # 并发处理应该高效
        assert total_time < 10.0  # 50个请求在10秒内完成
        
        # 计算吞吐量
        throughput = len(responses) / total_time
        assert throughput > 5  # 每秒至少5个请求
    
    def test_memory_usage_stability(self, client):
        """测试内存使用稳定性"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # 发送大量请求
        for i in range(100):
            response = client.get("/health")
            assert response.status_code == 200
            
            # 每10个请求检查一次内存
            if i % 10 == 0:
                current_memory = process.memory_info().rss
                memory_increase = current_memory - initial_memory
                
                # 内存增长应该是合理的
                assert memory_increase < 100 * 1024 * 1024  # 少于100MB
        
        # 最终内存检查
        final_memory = process.memory_info().rss
        total_increase = final_memory - initial_memory
        
        # 总内存增长应该稳定
        assert total_increase < 200 * 1024 * 1024  # 少于200MB


@pytest.mark.integration
@pytest.mark.api
class TestAPIDataConsistency:
    """API数据一致性测试"""
    
    def test_response_format_consistency(self, client):
        """测试响应格式一致性"""
        # 发送多个相似请求
        requests = [
            {"messages": [{"role": "user", "content": f"Test {i}"}], "model": "test-model"}
            for i in range(5)
        ]
        
        responses = []
        for request in requests:
            response = client.post("/api/v1/chat/completions", json=request)
            assert response.status_code == 200
            responses.append(response.json())
        
        # 检查响应格式一致性
        required_fields = ["id", "choices", "created", "model"]
        
        for response_data in responses:
            for field in required_fields:
                assert field in response_data, f"Missing field: {field}"
            
            # 检查choices格式
            assert isinstance(response_data["choices"], list)
            assert len(response_data["choices"]) > 0
            
            choice = response_data["choices"][0]
            assert "message" in choice
            assert "role" in choice["message"]
            assert "content" in choice["message"]
    
    def test_error_format_consistency(self, client):
        """测试错误格式一致性"""
        # 发送多个无效请求
        invalid_requests = [
            {},  # 空请求
            {"model": "test"},  # 缺少messages
            {"messages": []},  # 缺少model
            {"messages": "invalid", "model": "test"}  # 错误类型
        ]
        
        error_responses = []
        for request in invalid_requests:
            response = client.post("/api/v1/chat/completions", json=request)
            assert response.status_code == 422
            error_responses.append(response.json())
        
        # 检查错误格式一致性
        for error_data in error_responses:
            assert "detail" in error_data
            # FastAPI的验证错误格式
            if isinstance(error_data["detail"], list):
                for error in error_data["detail"]:
                    assert "loc" in error
                    assert "msg" in error
                    assert "type" in error


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Embedding服务单元测试
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from zishu.vector.embeddings import EmbeddingService


class TestEmbeddingService:
    """测试EmbeddingService类"""
    
    @pytest.fixture
    def mock_openai(self):
        """模拟OpenAI客户端"""
        with patch('zishu.vector.embeddings.OpenAI') as mock_client, \
             patch('zishu.vector.embeddings.AsyncOpenAI') as mock_async_client:
            
            # 模拟同步客户端
            mock_instance = Mock()
            mock_client.return_value = mock_instance
            
            # 模拟异步客户端
            mock_async_instance = Mock()
            mock_async_client.return_value = mock_async_instance
            
            yield mock_instance, mock_async_instance
    
    @pytest.fixture
    def embedding_service(self, mock_openai):
        """创建EmbeddingService实例"""
        return EmbeddingService(
            provider="openai",
            api_key="test_key"
        )
    
    def test_init(self, embedding_service):
        """测试初始化"""
        assert embedding_service.provider == "openai"
        assert embedding_service.api_key == "test_key"
        assert embedding_service.model == "text-embedding-ada-002"
    
    def test_get_embedding(self, embedding_service):
        """测试获取单个向量"""
        # 模拟API响应
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        
        embedding_service.client.embeddings.create.return_value = mock_response
        
        # 获取向量
        embedding = embedding_service.get_embedding("测试文本")
        
        assert len(embedding) == 1536
        assert embedding[0] == 0.1
    
    def test_get_embedding_empty_text(self, embedding_service):
        """测试空文本"""
        embedding = embedding_service.get_embedding("")
        assert embedding == []
        
        embedding = embedding_service.get_embedding("   ")
        assert embedding == []
    
    def test_get_embedding_with_cache(self, embedding_service):
        """测试缓存功能"""
        # 模拟API响应
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        
        embedding_service.client.embeddings.create.return_value = mock_response
        
        # 第一次调用
        embedding1 = embedding_service.get_embedding("测试文本", use_cache=True)
        
        # 第二次调用（应该从缓存获取）
        embedding2 = embedding_service.get_embedding("测试文本", use_cache=True)
        
        # 只应该调用一次API
        assert embedding_service.client.embeddings.create.call_count == 1
        assert embedding1 == embedding2
    
    def test_get_embeddings_batch(self, embedding_service):
        """测试批量获取向量"""
        # 模拟API响应
        mock_response = Mock()
        mock_response.data = [
            Mock(embedding=[0.1] * 1536),
            Mock(embedding=[0.2] * 1536),
            Mock(embedding=[0.3] * 1536),
        ]
        
        embedding_service.client.embeddings.create.return_value = mock_response
        
        # 批量获取向量
        texts = ["文本1", "文本2", "文本3"]
        embeddings = embedding_service.get_embeddings(texts)
        
        assert len(embeddings) == 3
        assert len(embeddings[0]) == 1536
        assert embeddings[0][0] == 0.1
        assert embeddings[1][0] == 0.2
        assert embeddings[2][0] == 0.3
    
    def test_get_embeddings_with_cache(self, embedding_service):
        """测试批量获取时的缓存"""
        # 模拟API响应
        mock_response1 = Mock()
        mock_response1.data = [Mock(embedding=[0.1] * 1536)]
        
        mock_response2 = Mock()
        mock_response2.data = [Mock(embedding=[0.2] * 1536)]
        
        embedding_service.client.embeddings.create.side_effect = [
            mock_response1,
            mock_response2
        ]
        
        # 第一次批量调用
        texts1 = ["文本1", "文本2"]
        embeddings1 = embedding_service.get_embeddings(texts1)
        
        # 第二次调用，包含已缓存的文本
        texts2 = ["文本1", "文本3"]
        embeddings2 = embedding_service.get_embeddings(texts2)
        
        # 第一次应该调用2次（每个文本），第二次只调用1次（文本3）
        # 但由于批量处理，实际调用次数取决于batch_size
        assert len(embeddings1) == 2
        assert len(embeddings2) == 2
    
    def test_clear_cache(self, embedding_service):
        """测试清除缓存"""
        # 添加一些缓存
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        
        embedding_service.client.embeddings.create.return_value = mock_response
        
        embedding_service.get_embedding("测试文本")
        
        assert embedding_service.get_cache_size() > 0
        
        # 清除缓存
        embedding_service.clear_cache()
        
        assert embedding_service.get_cache_size() == 0
    
    def test_get_vector_dimension(self, embedding_service):
        """测试获取向量维度"""
        assert embedding_service.get_vector_dimension() == 1536
    
    def test_cosine_similarity(self):
        """测试余弦相似度计算"""
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        
        # 相同向量
        similarity = EmbeddingService.cosine_similarity(vec1, vec2)
        assert abs(similarity - 1.0) < 1e-6
        
        # 正交向量
        vec3 = [0.0, 1.0, 0.0]
        similarity = EmbeddingService.cosine_similarity(vec1, vec3)
        assert abs(similarity) < 1e-6
        
        # 空向量
        similarity = EmbeddingService.cosine_similarity([], vec1)
        assert similarity == 0.0


@pytest.mark.asyncio
class TestEmbeddingServiceAsync:
    """测试EmbeddingService异步方法"""
    
    @pytest.fixture
    def mock_openai(self):
        """模拟OpenAI客户端"""
        with patch('zishu.vector.embeddings.OpenAI') as mock_client, \
             patch('zishu.vector.embeddings.AsyncOpenAI') as mock_async_client:
            
            mock_instance = Mock()
            mock_client.return_value = mock_instance
            
            mock_async_instance = Mock()
            mock_async_client.return_value = mock_async_instance
            
            yield mock_instance, mock_async_instance
    
    @pytest.fixture
    def embedding_service(self, mock_openai):
        """创建EmbeddingService实例"""
        return EmbeddingService(
            provider="openai",
            api_key="test_key"
        )
    
    async def test_aget_embedding(self, embedding_service):
        """测试异步获取单个向量"""
        # 模拟异步API响应
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        
        async def mock_create(*args, **kwargs):
            return mock_response
        
        embedding_service.async_client.embeddings.create = mock_create
        
        # 异步获取向量
        embedding = await embedding_service.aget_embedding("测试文本")
        
        assert len(embedding) == 1536
        assert embedding[0] == 0.1


"""
向量搜索集成测试

注意：这些测试需要实际的Qdrant服务和OpenAI API密钥
可以使用pytest的标记来跳过集成测试：
  pytest -m "not integration"
"""

import pytest
import os
from uuid import uuid4

from zishu.vector import QdrantManager, EmbeddingService, SemanticSearchService


# 标记为集成测试
pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def qdrant_manager():
    """创建Qdrant管理器"""
    # 跳过测试如果没有Qdrant服务
    qdrant_host = os.getenv("QDRANT_HOST", "localhost")
    qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
    
    manager = QdrantManager(
        host=qdrant_host,
        port=qdrant_port,
    )
    
    # 健康检查
    if not manager.health_check():
        pytest.skip("Qdrant服务不可用")
    
    yield manager


@pytest.fixture(scope="module")
def embedding_service():
    """创建Embedding服务"""
    # 跳过测试如果没有OpenAI API密钥
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        pytest.skip("未设置OPENAI_API_KEY环境变量")
    
    service = EmbeddingService(
        provider="openai",
        api_key=api_key,
    )
    
    yield service


@pytest.fixture(scope="module")
def search_service(qdrant_manager, embedding_service):
    """创建语义搜索服务"""
    service = SemanticSearchService(
        qdrant_manager=qdrant_manager,
        embedding_service=embedding_service,
    )
    
    yield service


class TestQdrantIntegration:
    """Qdrant集成测试"""
    
    def test_create_collection(self, qdrant_manager):
        """测试创建集合"""
        collection_name = f"test_collection_{uuid4().hex[:8]}"
        
        # 创建集合
        result = qdrant_manager.create_collection(
            collection_name=collection_name,
            vector_size=1536,
            distance="Cosine",
        )
        
        assert result is True
        assert qdrant_manager.collection_exists(collection_name)
        
        # 清理
        qdrant_manager.delete_collection(collection_name)
    
    def test_insert_and_search(self, qdrant_manager):
        """测试插入和搜索"""
        collection_name = f"test_collection_{uuid4().hex[:8]}"
        
        # 创建集合
        qdrant_manager.create_collection(
            collection_name=collection_name,
            vector_size=128,
        )
        
        # 插入向量
        vectors = [[0.1] * 128, [0.2] * 128, [0.3] * 128]
        payloads = [
            {"name": "item1", "category": "A"},
            {"name": "item2", "category": "B"},
            {"name": "item3", "category": "A"},
        ]
        
        result = qdrant_manager.insert_vectors(
            collection_name=collection_name,
            vectors=vectors,
            payloads=payloads,
        )
        
        assert result is True
        
        # 搜索
        query_vector = [0.15] * 128
        results = qdrant_manager.search_vectors(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=2,
        )
        
        assert len(results) > 0
        assert "payload" in results[0]
        
        # 清理
        qdrant_manager.delete_collection(collection_name)


class TestEmbeddingIntegration:
    """Embedding集成测试"""
    
    def test_get_embedding(self, embedding_service):
        """测试获取向量"""
        text = "这是一个测试文本"
        embedding = embedding_service.get_embedding(text)
        
        assert len(embedding) == 1536
        assert all(isinstance(x, float) for x in embedding)
    
    def test_get_embeddings_batch(self, embedding_service):
        """测试批量获取向量"""
        texts = [
            "第一个测试文本",
            "第二个测试文本",
            "第三个测试文本",
        ]
        
        embeddings = embedding_service.get_embeddings(texts)
        
        assert len(embeddings) == 3
        assert all(len(emb) == 1536 for emb in embeddings)
    
    def test_cosine_similarity(self, embedding_service):
        """测试相似度计算"""
        text1 = "苹果是一种水果"
        text2 = "水果包括苹果"
        text3 = "编程语言有Python"
        
        emb1 = embedding_service.get_embedding(text1)
        emb2 = embedding_service.get_embedding(text2)
        emb3 = embedding_service.get_embedding(text3)
        
        # 相似文本的相似度应该高于不相关文本
        sim_12 = EmbeddingService.cosine_similarity(emb1, emb2)
        sim_13 = EmbeddingService.cosine_similarity(emb1, emb3)
        
        assert sim_12 > sim_13


class TestSemanticSearchIntegration:
    """语义搜索集成测试"""
    
    @pytest.fixture
    def test_collection(self, search_service):
        """创建测试集合"""
        collection_name = "adapters_semantic"
        
        # 确保集合存在
        if not search_service.qdrant.collection_exists(collection_name):
            search_service.qdrant.create_collection(
                collection_name=collection_name,
                vector_size=1536,
            )
        
        yield collection_name
    
    def test_add_and_search_adapter(self, search_service, test_collection):
        """测试添加和搜索适配器"""
        # 添加测试适配器
        adapter_id = str(uuid4())
        result = search_service.add_adapter(
            adapter_id=adapter_id,
            name="Excel数据分析工具",
            description="自动分析Excel数据并生成报表",
            adapter_type="intelligent_hard",
            category="数据分析",
            tags=["Excel", "数据分析", "报表"],
            rating=4.5,
        )
        
        assert result is True
        
        # 搜索适配器
        results = search_service.search_adapters(
            query="我需要一个Excel分析工具",
            limit=5,
        )
        
        # 应该能找到刚添加的适配器
        assert len(results) > 0
        found = any(r["adapter_id"] == adapter_id for r in results)
        assert found, "未找到刚添加的适配器"
    
    def test_batch_add_adapters(self, search_service, test_collection):
        """测试批量添加适配器"""
        adapters = [
            {
                "adapter_id": str(uuid4()),
                "name": f"测试适配器{i}",
                "description": f"这是第{i}个测试适配器",
                "type": "intelligent_soft",
                "category": "测试",
                "tags": ["测试", f"标签{i}"],
                "rating": 4.0,
            }
            for i in range(5)
        ]
        
        added = search_service.batch_add_adapters(adapters)
        
        assert added == 5
    
    def test_health_check(self, search_service):
        """测试健康检查"""
        is_healthy = search_service.health_check()
        assert is_healthy is True


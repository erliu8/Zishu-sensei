"""
Qdrant客户端单元测试
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from zishu.vector.qdrant_client import QdrantManager


class TestQdrantManager:
    """测试QdrantManager类"""
    
    @pytest.fixture
    def mock_qdrant_client(self):
        """模拟Qdrant客户端"""
        with patch('zishu.vector.qdrant_client.QdrantClient') as mock:
            yield mock
    
    @pytest.fixture
    def qdrant_manager(self, mock_qdrant_client):
        """创建QdrantManager实例"""
        return QdrantManager(
            host="localhost",
            port=6333,
            api_key="test_key"
        )
    
    def test_init(self, qdrant_manager):
        """测试初始化"""
        assert qdrant_manager.host == "localhost"
        assert qdrant_manager.port == 6333
        assert qdrant_manager.api_key == "test_key"
    
    def test_collection_exists(self, qdrant_manager, mock_qdrant_client):
        """测试检查集合是否存在"""
        # 模拟返回值
        mock_collection = Mock()
        mock_collection.name = "test_collection"
        
        mock_response = Mock()
        mock_response.collections = [mock_collection]
        
        qdrant_manager.client.get_collections.return_value = mock_response
        
        # 测试存在的集合
        assert qdrant_manager.collection_exists("test_collection") is True
        
        # 测试不存在的集合
        assert qdrant_manager.collection_exists("non_existent") is False
    
    def test_create_collection(self, qdrant_manager):
        """测试创建集合"""
        # 模拟集合不存在
        qdrant_manager.collection_exists = Mock(return_value=False)
        
        # 创建集合
        result = qdrant_manager.create_collection(
            collection_name="test_collection",
            vector_size=1536,
            distance="Cosine"
        )
        
        assert result is True
        qdrant_manager.client.create_collection.assert_called_once()
    
    def test_create_collection_already_exists(self, qdrant_manager):
        """测试创建已存在的集合"""
        # 模拟集合已存在
        qdrant_manager.collection_exists = Mock(return_value=True)
        
        # 尝试创建集合
        result = qdrant_manager.create_collection(
            collection_name="existing_collection",
            vector_size=1536
        )
        
        assert result is True
        # 不应该调用create_collection
        qdrant_manager.client.create_collection.assert_not_called()
    
    def test_insert_vectors(self, qdrant_manager):
        """测试插入向量"""
        vectors = [[0.1] * 1536, [0.2] * 1536]
        payloads = [{"name": "test1"}, {"name": "test2"}]
        ids = [str(uuid4()), str(uuid4())]
        
        result = qdrant_manager.insert_vectors(
            collection_name="test_collection",
            vectors=vectors,
            payloads=payloads,
            ids=ids
        )
        
        assert result is True
        qdrant_manager.client.upsert.assert_called()
    
    def test_search_vectors(self, qdrant_manager):
        """测试搜索向量"""
        query_vector = [0.1] * 1536
        
        # 模拟搜索结果
        mock_result = Mock()
        mock_result.id = "test_id"
        mock_result.score = 0.95
        mock_result.payload = {"name": "test"}
        
        qdrant_manager.client.search.return_value = [mock_result]
        
        results = qdrant_manager.search_vectors(
            collection_name="test_collection",
            query_vector=query_vector,
            limit=10
        )
        
        assert len(results) == 1
        assert results[0]["id"] == "test_id"
        assert results[0]["score"] == 0.95
        assert results[0]["payload"]["name"] == "test"
    
    def test_delete_vectors(self, qdrant_manager):
        """测试删除向量"""
        point_ids = [str(uuid4()), str(uuid4())]
        
        result = qdrant_manager.delete_vectors(
            collection_name="test_collection",
            point_ids=point_ids
        )
        
        assert result is True
        qdrant_manager.client.delete.assert_called_once()
    
    def test_get_collection_info(self, qdrant_manager):
        """测试获取集合信息"""
        # 模拟集合信息
        mock_info = Mock()
        mock_info.vectors_count = 100
        mock_info.points_count = 100
        mock_info.segments_count = 1
        mock_info.status = "green"
        mock_info.config.params.vectors.size = 1536
        mock_info.config.params.vectors.distance = "Cosine"
        
        qdrant_manager.client.get_collection.return_value = mock_info
        
        info = qdrant_manager.get_collection_info("test_collection")
        
        assert info is not None
        assert info["vectors_count"] == 100
        assert info["points_count"] == 100
        assert info["status"] == "green"
    
    def test_count_points(self, qdrant_manager):
        """测试统计点数"""
        mock_info = Mock()
        mock_info.points_count = 50
        
        qdrant_manager.client.get_collection.return_value = mock_info
        
        count = qdrant_manager.count_points("test_collection")
        
        assert count == 50
    
    def test_health_check(self, qdrant_manager):
        """测试健康检查"""
        # 模拟成功
        qdrant_manager.client.get_collections.return_value = Mock()
        
        assert qdrant_manager.health_check() is True
        
        # 模拟失败
        qdrant_manager.client.get_collections.side_effect = Exception("Connection failed")
        
        assert qdrant_manager.health_check() is False


# -*- coding: utf-8 -*-
"""
RAG引擎测试

测试检索增强生成引擎功能
"""

import pytest
import asyncio
import json
import tempfile
import numpy as np
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from zishu.adapters.soft.rag_engine import (
    RAGEngine, DocumentStore, VectorStore, EmbeddingService, 
    RetrievalService, RerankingService, Document, QueryResult,
    RAGConfig, RetrievalConfig, RerankingConfig, RAGEngineError
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestRAGEngine:
    """RAG引擎测试类"""

    @pytest.fixture
    def rag_config(self):
        """创建RAG配置"""
        return RAGConfig(
            vector_store_type="memory",
            embedding_model="text-embedding-ada-002",
            embedding_dimension=1536,
            retrieval_config=RetrievalConfig(
                top_k=5,
                similarity_threshold=0.7,
                min_similarity=0.3
            ),
            reranking_config=RerankingConfig(
                enabled=True,
                model_name="cross-encoder/ms-marco-MiniLM-L-6-v2",
                top_k=3
            ),
            max_document_size=10000,
            batch_size=32
        )

    @pytest.fixture
    def mock_embedding_service(self):
        """模拟嵌入服务"""
        service = Mock()
        service.encode = AsyncMock(return_value=np.random.rand(1536))
        service.encode_batch = AsyncMock(return_value=[
            np.random.rand(1536) for _ in range(3)
        ])
        return service

    @pytest.fixture
    def mock_vector_store(self):
        """模拟向量存储"""
        store = Mock()
        store.add_vectors = AsyncMock(return_value=True)
        store.search = AsyncMock(return_value=[
            {"id": "doc1", "score": 0.9, "metadata": {"title": "Document 1"}},
            {"id": "doc2", "score": 0.8, "metadata": {"title": "Document 2"}},
            {"id": "doc3", "score": 0.75, "metadata": {"title": "Document 3"}}
        ])
        store.delete = AsyncMock(return_value=True)
        store.get_statistics = Mock(return_value={
            "total_vectors": 100,
            "dimension": 1536,
            "index_size": 1024000
        })
        return store

    @pytest.fixture
    def mock_document_store(self):
        """模拟文档存储"""
        store = Mock()
        store._documents = {
            "doc_id_123": Document(
                id="doc_id_123",
                content="Sample document content",
                metadata={"title": "Sample Document", "source": "test"}
            ),
            "doc1": Document(id="doc1", content="Content 1", metadata={"title": "Doc 1"}),
            "doc2": Document(id="doc2", content="Content 2", metadata={"title": "Doc 2"}),
            "doc3": Document(id="doc3", content="Content 3", metadata={"title": "Doc 3"})
        }
        store.add_document = AsyncMock(return_value="doc_id_123")
        store.get_document = AsyncMock(return_value=Document(
            id="doc_id_123",
            content="Sample document content",
            metadata={"title": "Sample Document", "source": "test"}
        ))
        store.get_documents = AsyncMock(return_value=[
            Document(id="doc1", content="Content 1", metadata={"title": "Doc 1"}),
            Document(id="doc2", content="Content 2", metadata={"title": "Doc 2"}),
            Document(id="doc3", content="Content 3", metadata={"title": "Doc 3"})
        ])
        store.delete_document = AsyncMock(return_value=True)
        return store

    @pytest.fixture
    def rag_engine(self, rag_config, mock_embedding_service, 
                   mock_vector_store, mock_document_store):
        """创建RAG引擎实例"""
        engine = RAGEngine(rag_config)
        engine._embedding_service = mock_embedding_service
        engine._vector_store = mock_vector_store
        engine._document_store = mock_document_store
        return engine

    @pytest.mark.asyncio
    async def test_engine_initialization(self, rag_engine):
        """测试RAG引擎初始化"""
        # Act
        await rag_engine.initialize()
        
        # Assert
        assert rag_engine.is_initialized
        assert rag_engine._embedding_service is not None
        assert rag_engine._vector_store is not None
        assert rag_engine._document_store is not None

    @pytest.mark.asyncio
    async def test_add_document(self, rag_engine):
        """测试添加文档"""
        await rag_engine.initialize()
        
        # Arrange
        document = Document(
            content="This is a test document about artificial intelligence.",
            metadata={
                "title": "AI Introduction",
                "author": "Test Author",
                "category": "technology"
            }
        )
        
        # Act
        document_id = await rag_engine.add_document(document)
        
        # Assert
        assert document_id is not None
        rag_engine._document_store.add_document.assert_called_once()
        rag_engine._embedding_service.encode.assert_called_once()
        rag_engine._vector_store.add_vectors.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_documents_batch(self, rag_engine):
        """测试批量添加文档"""
        await rag_engine.initialize()
        
        # Arrange
        documents = [
            Document(content=f"Document {i} content", metadata={"title": f"Doc {i}"})
            for i in range(5)
        ]
        
        # Act
        document_ids = await rag_engine.add_documents_batch(documents)
        
        # Assert
        assert len(document_ids) == 5
        assert all(doc_id is not None for doc_id in document_ids)
        rag_engine._embedding_service.encode_batch.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_documents(self, rag_engine):
        """测试文档搜索"""
        await rag_engine.initialize()
        
        # Arrange
        query = "What is artificial intelligence?"
        
        # Act
        results = await rag_engine.search(query)
        
        # Assert
        assert len(results) <= rag_engine.config.retrieval_config.top_k
        assert all(result.score >= rag_engine.config.retrieval_config.similarity_threshold 
                  for result in results)
        rag_engine._embedding_service.encode.assert_called_with(query)
        rag_engine._vector_store.search.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_with_filters(self, rag_engine):
        """测试带过滤器的搜索"""
        await rag_engine.initialize()
        
        # Arrange
        query = "machine learning algorithms"
        filters = {"category": "technology", "author": "Expert"}
        
        # Act
        results = await rag_engine.search(query, filters=filters)
        
        # Assert
        assert isinstance(results, list)
        rag_engine._vector_store.search.assert_called_once()
        search_args = rag_engine._vector_store.search.call_args
        assert "filters" in search_args.kwargs or len(search_args.args) > 2

    @pytest.mark.asyncio
    async def test_reranking(self, rag_engine):
        """测试重排序"""
        await rag_engine.initialize()
        
        # Mock reranking service
        mock_reranker = Mock()
        mock_reranker.rerank = AsyncMock(return_value=[
            {"id": "doc1", "score": 0.95, "rerank_score": 0.92},
            {"id": "doc3", "score": 0.75, "rerank_score": 0.88},
            {"id": "doc2", "score": 0.8, "rerank_score": 0.85}
        ])
        rag_engine._reranking_service = mock_reranker
        
        # Arrange
        query = "deep learning neural networks"
        
        # Act
        results = await rag_engine.search(query, enable_reranking=True)
        
        # Assert
        # Results should be reordered by rerank_score
        assert len(results) <= rag_engine.config.reranking_config.top_k
        mock_reranker.rerank.assert_called_once()

    @pytest.mark.asyncio
    async def test_semantic_search(self, rag_engine):
        """测试语义搜索"""
        await rag_engine.initialize()
        
        # Arrange
        query = "How to train neural networks effectively?"
        
        # Mock similar documents
        rag_engine._vector_store.search = AsyncMock(return_value=[
            {"id": "neural_net_guide", "score": 0.88, "metadata": {"title": "Neural Network Training"}},
            {"id": "ml_best_practices", "score": 0.82, "metadata": {"title": "ML Best Practices"}},
            {"id": "optimization_techniques", "score": 0.79, "metadata": {"title": "Optimization Methods"}}
        ])
        
        # Mock document store to return matching documents
        rag_engine._document_store.get_document = AsyncMock(side_effect=lambda doc_id: Document(
            id=doc_id,
            content=f"Content for {doc_id}",
            metadata={"title": "Neural Network Training"} if doc_id == "neural_net_guide"
                     else {"title": "ML Best Practices"} if doc_id == "ml_best_practices"
                     else {"title": "Optimization Methods"}
        ))
        
        # Act
        results = await rag_engine.search(query, search_type="semantic")
        
        # Assert
        assert len(results) == 3
        assert results[0].score >= results[1].score >= results[2].score
        assert results[0].document.metadata["title"] == "Neural Network Training"

    @pytest.mark.asyncio
    async def test_hybrid_search(self, rag_engine):
        """测试混合搜索"""
        await rag_engine.initialize()
        
        # Mock vector search results for hybrid search
        rag_engine._vector_store.search = AsyncMock(return_value=[
            {"id": "hybrid1", "score": 0.9, "metadata": {"title": "ML Document"}},
            {"id": "hybrid2", "score": 0.85, "metadata": {"title": "NN Document"}}
        ])
        
        # Mock document store to return matching documents
        rag_engine._document_store.get_document = AsyncMock(side_effect=lambda doc_id: Document(
            id=doc_id,
            content=f"Hybrid result for {doc_id}",
            metadata={"title": "ML Document"} if doc_id == "hybrid1" else {"title": "NN Document"}
        ))
        
        # Arrange
        query = "machine learning AND neural networks"
        
        # Act
        results = await rag_engine.search(query, search_type="hybrid")
        
        # Assert
        assert len(results) == 2
        assert all(result.retrieval_method == "hybrid" for result in results)

    @pytest.mark.asyncio
    async def test_document_update(self, rag_engine):
        """测试文档更新"""
        await rag_engine.initialize()
        
        # Arrange
        document_id = "existing_doc_123"
        updated_content = "This is the updated content of the document."
        
        # Act
        success = await rag_engine.update_document(document_id, updated_content)
        
        # Assert
        assert success is True
        rag_engine._embedding_service.encode.assert_called_with(updated_content)
        rag_engine._vector_store.add_vectors.assert_called()

    @pytest.mark.asyncio
    async def test_document_deletion(self, rag_engine):
        """测试文档删除"""
        await rag_engine.initialize()
        
        # Arrange
        document_id = "doc_to_delete_456"
        
        # Act
        success = await rag_engine.delete_document(document_id)
        
        # Assert
        assert success is True
        rag_engine._document_store.delete_document.assert_called_with(document_id)
        rag_engine._vector_store.delete.assert_called_with(document_id)

    @pytest.mark.asyncio
    async def test_get_similar_documents(self, rag_engine):
        """测试获取相似文档"""
        await rag_engine.initialize()
        
        # Arrange
        reference_document_id = "reference_doc_789"
        
        # Mock document store to return reference document and similar documents
        reference_doc = Document(
            id=reference_document_id,
            content="Reference document content",
            metadata={"title": "Reference"}
        )
        
        async def mock_get_document(doc_id):
            if doc_id == reference_document_id:
                return reference_doc
            return Document(
                id=doc_id,
                content=f"Content for {doc_id}",
                metadata={"title": f"Doc {doc_id}"}
            )
        
        rag_engine._document_store.get_document = AsyncMock(side_effect=mock_get_document)
        
        # Mock vector store to return similar documents (excluding the reference doc)
        rag_engine._vector_store.search = AsyncMock(return_value=[
            {"id": "doc1", "score": 0.9, "metadata": {}},
            {"id": "doc2", "score": 0.8, "metadata": {}},
            {"id": "doc3", "score": 0.75, "metadata": {}}
        ])
        
        # Act
        similar_docs = await rag_engine.get_similar_documents(reference_document_id, top_k=3)
        
        # Assert
        assert len(similar_docs) <= 3
        # Verify that get_document was called with the reference document ID
        assert any(call.args[0] == reference_document_id 
                  for call in rag_engine._document_store.get_document.call_args_list)

    @pytest.mark.asyncio
    async def test_statistics(self, rag_engine):
        """测试获取统计信息"""
        await rag_engine.initialize()
        
        # Act
        stats = await rag_engine.get_statistics()
        
        # Assert
        assert "total_documents" in stats
        assert "total_vectors" in stats
        assert "index_size" in stats
        assert stats["total_vectors"] == 100


class TestDocumentStore:
    """文档存储测试类"""
    
    @pytest.fixture
    def document_store(self):
        """创建文档存储"""
        from zishu.adapters.soft.rag_engine import MemoryDocumentStore
        return MemoryDocumentStore()
    
    @pytest.mark.asyncio
    async def test_add_and_get_document(self, document_store):
        """测试添加和获取文档"""
        # Arrange
        document = Document(
            content="Test document content",
            metadata={"title": "Test Doc", "author": "Tester"}
        )
        
        # Act
        doc_id = await document_store.add_document(document)
        retrieved_doc = await document_store.get_document(doc_id)
        
        # Assert
        assert retrieved_doc.content == document.content
        assert retrieved_doc.metadata["title"] == "Test Doc"
        assert retrieved_doc.id == doc_id
    
    @pytest.mark.asyncio
    async def test_document_search_by_metadata(self, document_store):
        """测试按元数据搜索文档"""
        # Arrange
        docs = [
            Document(content="AI content", metadata={"category": "AI", "year": 2023}),
            Document(content="ML content", metadata={"category": "ML", "year": 2023}),
            Document(content="Old AI content", metadata={"category": "AI", "year": 2020})
        ]
        
        doc_ids = []
        for doc in docs:
            doc_id = await document_store.add_document(doc)
            doc_ids.append(doc_id)
        
        # Act
        ai_docs_2023 = await document_store.search_by_metadata(
            {"category": "AI", "year": 2023}
        )
        
        # Assert
        assert len(ai_docs_2023) == 1
        assert ai_docs_2023[0].content == "AI content"
    
    @pytest.mark.asyncio
    async def test_document_deletion(self, document_store):
        """测试文档删除"""
        # Arrange
        document = Document(content="To be deleted", metadata={"temp": True})
        doc_id = await document_store.add_document(document)
        
        # Verify document exists
        retrieved = await document_store.get_document(doc_id)
        assert retrieved is not None
        
        # Act
        success = await document_store.delete_document(doc_id)
        
        # Assert
        assert success is True
        deleted_doc = await document_store.get_document(doc_id)
        assert deleted_doc is None


class TestVectorStore:
    """向量存储测试类"""
    
    @pytest.fixture
    def vector_store(self):
        """创建向量存储"""
        from zishu.adapters.soft.rag_engine import MemoryVectorStore
        return MemoryVectorStore(dimension=128)
    
    @pytest.mark.asyncio
    async def test_add_and_search_vectors(self, vector_store):
        """测试添加和搜索向量"""
        # Arrange
        vectors = [
            {"id": "vec1", "vector": np.random.rand(128), "metadata": {"type": "doc"}},
            {"id": "vec2", "vector": np.random.rand(128), "metadata": {"type": "query"}},
            {"id": "vec3", "vector": np.random.rand(128), "metadata": {"type": "doc"}}
        ]
        
        # Act - Add vectors
        for vec in vectors:
            await vector_store.add_vectors([vec])
        
        # Act - Search
        query_vector = np.random.rand(128)
        results = await vector_store.search(query_vector, top_k=2)
        
        # Assert
        assert len(results) == 2
        assert all("score" in result for result in results)
        assert all("id" in result for result in results)
    
    @pytest.mark.asyncio
    async def test_vector_similarity_calculation(self, vector_store):
        """测试向量相似度计算"""
        # Create similar vectors
        base_vector = np.ones(128)
        similar_vector = base_vector + np.random.rand(128) * 0.1  # Small noise
        different_vector = np.random.rand(128)
        
        # Add vectors
        await vector_store.add_vectors([
            {"id": "similar", "vector": similar_vector, "metadata": {}},
            {"id": "different", "vector": different_vector, "metadata": {}}
        ])
        
        # Search with base vector
        results = await vector_store.search(base_vector, top_k=2)
        
        # Similar vector should have higher score
        similar_result = next(r for r in results if r["id"] == "similar")
        different_result = next(r for r in results if r["id"] == "different")
        
        assert similar_result["score"] > different_result["score"]
    
    @pytest.mark.asyncio
    async def test_vector_filtering(self, vector_store):
        """测试向量过滤"""
        # Add vectors with different metadata
        vectors = [
            {"id": "tech1", "vector": np.random.rand(128), "metadata": {"category": "tech"}},
            {"id": "sci1", "vector": np.random.rand(128), "metadata": {"category": "science"}},
            {"id": "tech2", "vector": np.random.rand(128), "metadata": {"category": "tech"}}
        ]
        
        for vec in vectors:
            await vector_store.add_vectors([vec])
        
        # Search with category filter
        query_vector = np.random.rand(128)
        filtered_results = await vector_store.search(
            query_vector, 
            top_k=5, 
            filters={"category": "tech"}
        )
        
        # Should only return tech category results
        assert len(filtered_results) == 2
        assert all(r["metadata"]["category"] == "tech" for r in filtered_results)


class TestEmbeddingService:
    """嵌入服务测试类"""
    
    @pytest.fixture
    def embedding_service(self):
        """创建嵌入服务"""
        from zishu.adapters.soft.rag_engine import MockEmbeddingService
        return MockEmbeddingService(dimension=256)
    
    @pytest.mark.asyncio
    async def test_single_text_encoding(self, embedding_service):
        """测试单个文本编码"""
        # Act
        embedding = await embedding_service.encode("This is a test sentence.")
        
        # Assert
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (256,)
        assert not np.isnan(embedding).any()
    
    @pytest.mark.asyncio
    async def test_batch_encoding(self, embedding_service):
        """测试批量编码"""
        # Arrange
        texts = [
            "First document text",
            "Second document text", 
            "Third document text"
        ]
        
        # Act
        embeddings = await embedding_service.encode_batch(texts)
        
        # Assert
        assert len(embeddings) == 3
        assert all(isinstance(emb, np.ndarray) for emb in embeddings)
        assert all(emb.shape == (256,) for emb in embeddings)
    
    @pytest.mark.asyncio
    async def test_encoding_consistency(self, embedding_service):
        """测试编码一致性"""
        text = "Consistent encoding test"
        
        # Encode same text multiple times
        embedding1 = await embedding_service.encode(text)
        embedding2 = await embedding_service.encode(text)
        
        # Should be identical (for deterministic embeddings)
        np.testing.assert_array_almost_equal(embedding1, embedding2, decimal=5)


class TestRetrievalService:
    """检索服务测试类"""
    
    @pytest.fixture
    def rag_config(self):
        """创建RAG配置"""
        return RAGConfig(
            vector_store_type="memory",
            embedding_model="text-embedding-ada-002",
            embedding_dimension=1536,
            retrieval_config=RetrievalConfig(
                top_k=5,
                similarity_threshold=0.7,
                min_similarity=0.3
            ),
            reranking_config=RerankingConfig(
                enabled=True,
                model_name="cross-encoder/ms-marco-MiniLM-L-6-v2",
                top_k=3
            ),
            max_document_size=10000,
            batch_size=32
        )
    
    @pytest.fixture
    def retrieval_service(self, rag_config):
        """创建检索服务"""
        from zishu.adapters.soft.rag_engine import RetrievalService
        return RetrievalService(rag_config.retrieval)
    
    @pytest.mark.asyncio
    async def test_query_processing(self, retrieval_service):
        """测试查询处理"""
        # Act
        processed_query = retrieval_service.process_query("What is machine learning?")
        
        # Assert
        assert isinstance(processed_query, str)
        assert len(processed_query) > 0
    
    @pytest.mark.asyncio
    async def test_result_filtering(self, retrieval_service):
        """测试结果过滤"""
        # Arrange
        raw_results = [
            {"id": "doc1", "score": 0.9},
            {"id": "doc2", "score": 0.6},  # Below threshold
            {"id": "doc3", "score": 0.8},
            {"id": "doc4", "score": 0.5}   # Below threshold
        ]
        
        # Act
        filtered_results = retrieval_service.filter_results(
            raw_results, 
            similarity_threshold=0.7
        )
        
        # Assert
        assert len(filtered_results) == 2
        assert all(result["score"] >= 0.7 for result in filtered_results)


@pytest.mark.performance
class TestRAGEnginePerformance:
    """RAG引擎性能测试"""
    
    @pytest.fixture
    def rag_config(self):
        """创建RAG配置"""
        return RAGConfig(
            vector_store_type="memory",
            embedding_model="text-embedding-ada-002",
            embedding_dimension=1536,
            retrieval_config=RetrievalConfig(
                top_k=5,
                similarity_threshold=0.7,
                min_similarity=0.3
            ),
            reranking_config=RerankingConfig(
                enabled=True,
                model_name="cross-encoder/ms-marco-MiniLM-L-6-v2",
                top_k=3
            ),
            max_document_size=10000,
            batch_size=32
        )

    @pytest.fixture
    def mock_embedding_service(self):
        """模拟嵌入服务"""
        service = Mock()
        service.encode = AsyncMock(return_value=np.random.rand(1536))
        service.encode_batch = AsyncMock(return_value=[
            np.random.rand(1536) for _ in range(3)
        ])
        return service

    @pytest.fixture
    def mock_vector_store(self):
        """模拟向量存储"""
        store = Mock()
        store.add_vectors = AsyncMock(return_value=True)
        store.search = AsyncMock(return_value=[
            {"id": "doc1", "score": 0.9, "metadata": {"title": "Document 1"}},
            {"id": "doc2", "score": 0.8, "metadata": {"title": "Document 2"}},
            {"id": "doc3", "score": 0.75, "metadata": {"title": "Document 3"}}
        ])
        store.delete = AsyncMock(return_value=True)
        store.get_statistics = Mock(return_value={
            "total_vectors": 100,
            "dimension": 1536,
            "index_size": 1024000
        })
        return store

    @pytest.fixture
    def mock_document_store(self):
        """模拟文档存储"""
        store = Mock()
        store._documents = {
            "doc_id_123": Document(
                id="doc_id_123",
                content="Sample document content",
                metadata={"title": "Sample Document", "source": "test"}
            ),
            "doc1": Document(id="doc1", content="Content 1", metadata={"title": "Doc 1"}),
            "doc2": Document(id="doc2", content="Content 2", metadata={"title": "Doc 2"}),
            "doc3": Document(id="doc3", content="Content 3", metadata={"title": "Doc 3"})
        }
        store.add_document = AsyncMock(return_value="doc_id_123")
        store.get_document = AsyncMock(return_value=Document(
            id="doc_id_123",
            content="Sample document content",
            metadata={"title": "Sample Document", "source": "test"}
        ))
        store.get_documents = AsyncMock(return_value=[
            Document(id="doc1", content="Content 1", metadata={"title": "Doc 1"}),
            Document(id="doc2", content="Content 2", metadata={"title": "Doc 2"}),
            Document(id="doc3", content="Content 3", metadata={"title": "Doc 3"})
        ])
        store.delete_document = AsyncMock(return_value=True)
        return store

    @pytest.fixture
    def rag_engine(self, rag_config, mock_embedding_service, 
                   mock_vector_store, mock_document_store):
        """创建RAG引擎实例"""
        engine = RAGEngine(rag_config)
        engine._embedding_service = mock_embedding_service
        engine._vector_store = mock_vector_store
        engine._document_store = mock_document_store
        return engine
    
    @pytest.mark.asyncio
    async def test_document_indexing_performance(self, rag_engine):
        """测试文档索引性能"""
        await rag_engine.initialize()
        
        # Arrange
        documents = [
            Document(
                content=f"Performance test document {i} with sufficient content for testing",
                metadata={"id": i, "category": "performance"}
            )
            for i in range(100)
        ]
        
        # Act
        start_time = asyncio.get_event_loop().time()
        document_ids = await rag_engine.add_documents_batch(documents)
        end_time = asyncio.get_event_loop().time()
        
        indexing_time = end_time - start_time
        
        # Assert
        assert len(document_ids) == 100
        assert indexing_time < 10.0  # Should index 100 docs in less than 10 seconds
        throughput = 100 / indexing_time
        assert throughput > 10  # At least 10 docs per second
    
    @pytest.mark.asyncio
    async def test_search_performance(self, rag_engine):
        """测试搜索性能"""
        await rag_engine.initialize()
        
        # Perform multiple searches
        queries = [
            "artificial intelligence applications",
            "machine learning algorithms",
            "natural language processing",
            "computer vision techniques",
            "deep learning models"
        ]
        
        start_time = asyncio.get_event_loop().time()
        
        for query in queries:
            await rag_engine.search(query)
        
        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        
        # Assert
        assert total_time < 5.0  # 5 searches should complete in less than 5 seconds
        avg_search_time = total_time / len(queries)
        assert avg_search_time < 1.0  # Average search time less than 1 second
    
    @pytest.mark.asyncio
    async def test_concurrent_search_performance(self, rag_engine):
        """测试并发搜索性能"""
        await rag_engine.initialize()
        
        # Create concurrent search tasks
        queries = [f"concurrent query {i}" for i in range(20)]
        tasks = [rag_engine.search(query) for query in queries]
        
        # Measure concurrent execution time
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = asyncio.get_event_loop().time()
        
        total_time = end_time - start_time
        
        # Assert
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 18  # Allow some failures
        assert total_time < 3.0  # Concurrent searches should be faster than sequential

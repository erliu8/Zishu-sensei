"""
搜索服务模块

提供文本搜索、向量搜索和推荐服务
"""
from app.services.search.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    embed_text,
    embed_texts,
    embed_post,
)
from app.services.search.vector_search import (
    VectorSearchService,
    get_vector_search_service,
)
from app.services.search.recommendation import (
    RecommendationService,
    get_recommendation_service,
)


__all__ = [
    # Embedding
    "EmbeddingService",
    "get_embedding_service",
    "embed_text",
    "embed_texts",
    "embed_post",
    
    # Vector Search
    "VectorSearchService",
    "get_vector_search_service",
    
    # Recommendation
    "RecommendationService",
    "get_recommendation_service",
]


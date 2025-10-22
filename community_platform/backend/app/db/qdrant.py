"""
Qdrant 向量数据库客户端
"""
from typing import List, Optional, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)

from app.core.config.settings import settings


class QdrantManager:
    """Qdrant 向量数据库管理器"""
    
    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self.collection_name = settings.QDRANT_COLLECTION_NAME
        self.vector_size = settings.QDRANT_VECTOR_SIZE
    
    async def connect(self):
        """连接 Qdrant"""
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            api_key=settings.QDRANT_API_KEY,
            prefer_grpc=False,  # 使用 HTTP 而不是 gRPC，避免 SSL 问题
        )
        
        # 初始化集合
        await self.init_collection()
    
    async def disconnect(self):
        """断开连接"""
        if self.client:
            self.client.close()
    
    async def init_collection(self):
        """初始化向量集合"""
        if not self.client:
            return
        
        # 检查集合是否存在
        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if self.collection_name not in collection_names:
            # 创建集合
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.vector_size,
                    distance=Distance.COSINE,  # 使用余弦相似度
                ),
            )
            print(f"✅ 创建 Qdrant 集合: {self.collection_name}")
    
    async def insert_vector(
        self,
        point_id: int,
        vector: List[float],
        payload: Dict[str, Any]
    ) -> bool:
        """插入向量"""
        if not self.client:
            return False
        
        try:
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload,
                    )
                ],
            )
            return True
        except Exception as e:
            print(f"❌ 插入向量失败: {e}")
            return False
    
    async def batch_insert_vectors(
        self,
        points: List[Dict[str, Any]]
    ) -> bool:
        """批量插入向量"""
        if not self.client:
            return False
        
        try:
            point_structs = [
                PointStruct(
                    id=point["id"],
                    vector=point["vector"],
                    payload=point["payload"],
                )
                for point in points
            ]
            
            self.client.upsert(
                collection_name=self.collection_name,
                points=point_structs,
            )
            return True
        except Exception as e:
            print(f"❌ 批量插入向量失败: {e}")
            return False
    
    async def search_similar(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.7,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """搜索相似向量"""
        if not self.client:
            return []
        
        try:
            # 构建过滤器
            query_filter = None
            if filter_dict:
                conditions = []
                for key, value in filter_dict.items():
                    conditions.append(
                        FieldCondition(
                            key=key,
                            match=MatchValue(value=value)
                        )
                    )
                if conditions:
                    query_filter = Filter(must=conditions)
            
            # 执行搜索
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=limit,
                score_threshold=score_threshold,
                query_filter=query_filter,
            )
            
            # 格式化结果
            return [
                {
                    "id": result.id,
                    "score": result.score,
                    "payload": result.payload,
                }
                for result in results
            ]
        except Exception as e:
            print(f"❌ 搜索向量失败: {e}")
            return []
    
    async def delete_vector(self, point_id: int) -> bool:
        """删除向量"""
        if not self.client:
            return False
        
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=[point_id],
            )
            return True
        except Exception as e:
            print(f"❌ 删除向量失败: {e}")
            return False
    
    async def update_vector(
        self,
        point_id: int,
        vector: Optional[List[float]] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """更新向量"""
        if not self.client:
            return False
        
        try:
            if payload:
                # 更新 payload
                self.client.set_payload(
                    collection_name=self.collection_name,
                    payload=payload,
                    points=[point_id],
                )
            
            if vector:
                # 更新向量（通过 upsert）
                await self.insert_vector(point_id, vector, payload or {})
            
            return True
        except Exception as e:
            print(f"❌ 更新向量失败: {e}")
            return False
    
    async def get_collection_info(self) -> Optional[Dict[str, Any]]:
        """获取集合信息"""
        if not self.client:
            return None
        
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": info.config.params.vectors.size,
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
            }
        except Exception as e:
            print(f"❌ 获取集合信息失败: {e}")
            return None


# 创建全局 Qdrant 管理器实例
qdrant_manager = QdrantManager()


async def get_qdrant() -> QdrantClient:
    """获取 Qdrant 客户端（用于依赖注入）"""
    return qdrant_manager.client


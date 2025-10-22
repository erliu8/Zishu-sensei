"""
Qdrant向量数据库客户端封装

提供Qdrant数据库的高级操作接口，包括：
- 集合管理
- 向量插入/更新/删除
- 向量搜索
- 批量操作
"""

import logging
import os
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    HnswConfigDiff,
    MatchValue,
    OptimizersConfigDiff,
    PointStruct,
    VectorParams,
    SearchRequest,
    SearchParams,
)
import yaml


logger = logging.getLogger(__name__)


class QdrantManager:
    """Qdrant向量数据库管理器"""
    
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        api_key: Optional[str] = None,
        config_path: Optional[str] = None,
    ):
        """
        初始化Qdrant管理器
        
        Args:
            host: Qdrant服务主机地址
            port: Qdrant服务端口
            api_key: API密钥
            config_path: 配置文件路径
        """
        # 加载配置
        self.config = self._load_config(config_path)
        
        # 连接参数
        self.host = host or os.getenv("QDRANT_HOST") or self.config["connection"]["host"]
        self.port = port or int(os.getenv("QDRANT_PORT", self.config["connection"]["port"]))
        self.api_key = api_key or os.getenv("QDRANT_API_KEY") or self.config["connection"]["api_key"]
        
        # 初始化客户端
        self.client = QdrantClient(
            host=self.host,
            port=self.port,
            api_key=self.api_key,
            timeout=self.config["connection"]["timeout"],
            prefer_grpc=self.config["connection"]["prefer_grpc"],
            https=self.config["connection"]["https"],
        )
        
        logger.info(f"Qdrant客户端已连接: {self.host}:{self.port}")
    
    def _load_config(self, config_path: Optional[str] = None) -> Dict[str, Any]:
        """加载配置文件"""
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(__file__),
                "../../config/services/qdrant.yml"
            )
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info(f"已加载Qdrant配置: {config_path}")
            return config
        except Exception as e:
            logger.warning(f"无法加载配置文件 {config_path}: {e}，使用默认配置")
            return self._default_config()
    
    def _default_config(self) -> Dict[str, Any]:
        """默认配置"""
        return {
            "connection": {
                "host": "localhost",
                "port": 6333,
                "grpc_port": 6334,
                "api_key": None,
                "timeout": 30,
                "prefer_grpc": False,
                "https": False,
            },
            "search": {
                "default_limit": 10,
                "max_limit": 100,
                "score_threshold": 0.7,
                "hnsw_ef": 128,
                "exact": False,
            },
            "batch": {
                "insert_batch_size": 100,
                "update_batch_size": 100,
                "delete_batch_size": 100,
            },
        }
    
    def create_collection(
        self,
        collection_name: str,
        vector_size: int = 1536,
        distance: str = "Cosine",
        **kwargs
    ) -> bool:
        """
        创建向量集合
        
        Args:
            collection_name: 集合名称
            vector_size: 向量维度
            distance: 距离度量 (Cosine, Euclid, Dot)
            **kwargs: 其他配置参数
        
        Returns:
            是否创建成功
        """
        try:
            # 检查集合是否已存在
            if self.collection_exists(collection_name):
                logger.info(f"集合 {collection_name} 已存在")
                return True
            
            # 距离度量映射
            distance_map = {
                "Cosine": Distance.COSINE,
                "Euclid": Distance.EUCLID,
                "Dot": Distance.DOT,
            }
            
            # HNSW配置
            hnsw_config = None
            if "hnsw_config" in kwargs:
                hnsw_cfg = kwargs["hnsw_config"]
                hnsw_config = HnswConfigDiff(
                    m=hnsw_cfg.get("m", 16),
                    ef_construct=hnsw_cfg.get("ef_construct", 100),
                    full_scan_threshold=hnsw_cfg.get("full_scan_threshold", 10000),
                )
            
            # 优化器配置
            optimizer_config = None
            if "optimizer_config" in kwargs:
                opt_cfg = kwargs["optimizer_config"]
                optimizer_config = OptimizersConfigDiff(
                    deleted_threshold=opt_cfg.get("deleted_threshold", 0.2),
                    vacuum_min_vector_number=opt_cfg.get("vacuum_min_vector_number", 1000),
                    default_segment_number=opt_cfg.get("default_segment_number", 0),
                    max_segment_size=opt_cfg.get("max_segment_size"),
                    memmap_threshold=opt_cfg.get("memmap_threshold"),
                    indexing_threshold=opt_cfg.get("indexing_threshold", 20000),
                    flush_interval_sec=opt_cfg.get("flush_interval_sec", 5),
                    max_optimization_threads=opt_cfg.get("max_optimization_threads", 1),
                )
            
            # 创建集合
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=distance_map.get(distance, Distance.COSINE),
                    on_disk=kwargs.get("vectors_on_disk", False),
                ),
                hnsw_config=hnsw_config,
                optimizers_config=optimizer_config,
                on_disk_payload=kwargs.get("on_disk_payload", True),
                replication_factor=kwargs.get("replication_factor", 1),
                write_consistency_factor=kwargs.get("write_consistency_factor", 1),
            )
            
            logger.info(f"集合 {collection_name} 创建成功")
            return True
            
        except Exception as e:
            logger.error(f"创建集合 {collection_name} 失败: {e}")
            return False
    
    def collection_exists(self, collection_name: str) -> bool:
        """检查集合是否存在"""
        try:
            collections = self.client.get_collections().collections
            return any(col.name == collection_name for col in collections)
        except Exception as e:
            logger.error(f"检查集合 {collection_name} 是否存在时出错: {e}")
            return False
    
    def delete_collection(self, collection_name: str) -> bool:
        """删除集合"""
        try:
            self.client.delete_collection(collection_name)
            logger.info(f"集合 {collection_name} 已删除")
            return True
        except Exception as e:
            logger.error(f"删除集合 {collection_name} 失败: {e}")
            return False
    
    def insert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[Union[str, UUID]]] = None,
    ) -> bool:
        """
        插入向量数据
        
        Args:
            collection_name: 集合名称
            vectors: 向量列表
            payloads: 载荷数据列表
            ids: ID列表，如果为None则自动生成
        
        Returns:
            是否插入成功
        """
        try:
            # 生成ID
            if ids is None:
                ids = [str(uuid4()) for _ in range(len(vectors))]
            else:
                ids = [str(id_) for id_ in ids]
            
            # 准备载荷
            if payloads is None:
                payloads = [{}] * len(vectors)
            
            # 创建点结构
            points = [
                PointStruct(
                    id=id_,
                    vector=vector,
                    payload=payload,
                )
                for id_, vector, payload in zip(ids, vectors, payloads)
            ]
            
            # 批量插入
            batch_size = self.config["batch"]["insert_batch_size"]
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]
                self.client.upsert(
                    collection_name=collection_name,
                    points=batch,
                )
            
            logger.info(f"已向 {collection_name} 插入 {len(vectors)} 个向量")
            return True
            
        except Exception as e:
            logger.error(f"插入向量到 {collection_name} 失败: {e}")
            return False
    
    def search_vectors(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        with_payload: bool = True,
        with_vectors: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        搜索相似向量
        
        Args:
            collection_name: 集合名称
            query_vector: 查询向量
            limit: 返回结果数量
            score_threshold: 分数阈值
            filters: 过滤条件
            with_payload: 是否返回载荷
            with_vectors: 是否返回向量
        
        Returns:
            搜索结果列表
        """
        try:
            # 构建过滤器
            query_filter = None
            if filters:
                must_conditions = []
                for key, value in filters.items():
                    must_conditions.append(
                        FieldCondition(
                            key=key,
                            match=MatchValue(value=value),
                        )
                    )
                query_filter = Filter(must=must_conditions)
            
            # 执行搜索
            search_params = SearchParams(
                hnsw_ef=self.config["search"]["hnsw_ef"],
                exact=self.config["search"]["exact"],
            )
            
            results = self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=min(limit, self.config["search"]["max_limit"]),
                score_threshold=score_threshold or self.config["search"]["score_threshold"],
                query_filter=query_filter,
                with_payload=with_payload,
                with_vectors=with_vectors,
                search_params=search_params,
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                formatted_result = {
                    "id": result.id,
                    "score": result.score,
                }
                if with_payload:
                    formatted_result["payload"] = result.payload
                if with_vectors:
                    formatted_result["vector"] = result.vector
                formatted_results.append(formatted_result)
            
            logger.debug(f"在 {collection_name} 中搜索到 {len(formatted_results)} 个结果")
            return formatted_results
            
        except Exception as e:
            logger.error(f"在 {collection_name} 中搜索向量失败: {e}")
            return []
    
    def update_payload(
        self,
        collection_name: str,
        point_id: Union[str, UUID],
        payload: Dict[str, Any],
    ) -> bool:
        """更新载荷数据"""
        try:
            self.client.set_payload(
                collection_name=collection_name,
                payload=payload,
                points=[str(point_id)],
            )
            logger.debug(f"已更新点 {point_id} 的载荷")
            return True
        except Exception as e:
            logger.error(f"更新载荷失败: {e}")
            return False
    
    def delete_vectors(
        self,
        collection_name: str,
        point_ids: List[Union[str, UUID]],
    ) -> bool:
        """删除向量"""
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=[str(id_) for id_ in point_ids],
            )
            logger.info(f"已从 {collection_name} 删除 {len(point_ids)} 个向量")
            return True
        except Exception as e:
            logger.error(f"删除向量失败: {e}")
            return False
    
    def get_collection_info(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """获取集合信息"""
        try:
            info = self.client.get_collection(collection_name)
            return {
                "name": collection_name,
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "segments_count": info.segments_count,
                "config": {
                    "vector_size": info.config.params.vectors.size,
                    "distance": info.config.params.vectors.distance,
                },
                "status": info.status,
            }
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 信息失败: {e}")
            return None
    
    def scroll_points(
        self,
        collection_name: str,
        limit: int = 100,
        offset: Optional[str] = None,
        with_payload: bool = True,
        with_vectors: bool = False,
    ) -> Dict[str, Any]:
        """
        滚动查询集合中的点
        
        Args:
            collection_name: 集合名称
            limit: 每次返回的点数
            offset: 偏移ID
            with_payload: 是否包含载荷
            with_vectors: 是否包含向量
        
        Returns:
            包含点列表和下一个偏移的字典
        """
        try:
            result = self.client.scroll(
                collection_name=collection_name,
                limit=limit,
                offset=offset,
                with_payload=with_payload,
                with_vectors=with_vectors,
            )
            
            points = []
            for point in result[0]:
                point_data = {
                    "id": point.id,
                }
                if with_payload:
                    point_data["payload"] = point.payload
                if with_vectors:
                    point_data["vector"] = point.vector
                points.append(point_data)
            
            return {
                "points": points,
                "next_offset": result[1],
            }
            
        except Exception as e:
            logger.error(f"滚动查询 {collection_name} 失败: {e}")
            return {"points": [], "next_offset": None}
    
    def count_points(self, collection_name: str) -> int:
        """统计集合中的点数"""
        try:
            info = self.client.get_collection(collection_name)
            return info.points_count
        except Exception as e:
            logger.error(f"统计 {collection_name} 点数失败: {e}")
            return 0
    
    def health_check(self) -> bool:
        """健康检查"""
        try:
            self.client.get_collections()
            logger.debug("Qdrant健康检查通过")
            return True
        except Exception as e:
            logger.error(f"Qdrant健康检查失败: {e}")
            return False


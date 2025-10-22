"""
语义搜索服务

整合Qdrant和Embedding服务，提供高级语义搜索功能：
- 适配器语义搜索
- 知识库RAG检索
- 对话历史搜索
- 文档语义搜索
"""

import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from uuid import UUID

from .qdrant_client import QdrantManager
from .embeddings import EmbeddingService


logger = logging.getLogger(__name__)


class SemanticSearchService:
    """语义搜索服务"""
    
    def __init__(
        self,
        qdrant_manager: Optional[QdrantManager] = None,
        embedding_service: Optional[EmbeddingService] = None,
        qdrant_host: Optional[str] = None,
        qdrant_port: Optional[int] = None,
        qdrant_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
    ):
        """
        初始化语义搜索服务
        
        Args:
            qdrant_manager: Qdrant管理器实例
            embedding_service: Embedding服务实例
            qdrant_host: Qdrant主机地址
            qdrant_port: Qdrant端口
            qdrant_api_key: Qdrant API密钥
            openai_api_key: OpenAI API密钥
        """
        # 初始化Qdrant管理器
        if qdrant_manager is None:
            self.qdrant = QdrantManager(
                host=qdrant_host,
                port=qdrant_port,
                api_key=qdrant_api_key,
            )
        else:
            self.qdrant = qdrant_manager
        
        # 初始化Embedding服务
        if embedding_service is None:
            self.embedding = EmbeddingService(
                provider="openai",
                api_key=openai_api_key,
            )
        else:
            self.embedding = embedding_service
        
        logger.info("语义搜索服务已初始化")
    
    def search_adapters(
        self,
        query: str,
        limit: int = 10,
        adapter_type: Optional[str] = None,
        category: Optional[str] = None,
        min_rating: Optional[float] = None,
        tags: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        搜索适配器
        
        Args:
            query: 搜索查询
            limit: 返回结果数量
            adapter_type: 适配器类型过滤
            category: 分类过滤
            min_rating: 最低评分
            tags: 标签过滤
        
        Returns:
            适配器列表
        """
        try:
            # 生成查询向量
            query_vector = self.embedding.get_embedding(query)
            if not query_vector:
                logger.warning("无法生成查询向量")
                return []
            
            # 构建过滤器
            filters = {}
            if adapter_type:
                filters["type"] = adapter_type
            if category:
                filters["category"] = category
            
            # 搜索
            results = self.qdrant.search_vectors(
                collection_name="adapters_semantic",
                query_vector=query_vector,
                limit=limit,
                filters=filters if filters else None,
            )
            
            # 后处理：评分和标签过滤
            filtered_results = []
            for result in results:
                payload = result.get("payload", {})
                
                # 评分过滤
                if min_rating and payload.get("rating", 0) < min_rating:
                    continue
                
                # 标签过滤
                if tags:
                    adapter_tags = set(payload.get("tags", []))
                    if not any(tag in adapter_tags for tag in tags):
                        continue
                
                filtered_results.append({
                    "adapter_id": payload.get("adapter_id"),
                    "name": payload.get("name"),
                    "description": payload.get("description"),
                    "type": payload.get("type"),
                    "category": payload.get("category"),
                    "tags": payload.get("tags", []),
                    "rating": payload.get("rating", 0),
                    "downloads": payload.get("downloads", 0),
                    "score": result["score"],
                })
            
            logger.info(f"适配器搜索完成: {len(filtered_results)} 个结果")
            return filtered_results
            
        except Exception as e:
            logger.error(f"适配器搜索失败: {e}")
            return []
    
    def search_knowledge_base(
        self,
        query: str,
        limit: int = 5,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        搜索知识库
        
        Args:
            query: 搜索查询
            limit: 返回结果数量
            source_type: 来源类型 (adapter_doc, user_doc, system_doc)
            source_id: 来源ID
            language: 语言
        
        Returns:
            知识片段列表
        """
        try:
            # 生成查询向量
            query_vector = self.embedding.get_embedding(query)
            if not query_vector:
                logger.warning("无法生成查询向量")
                return []
            
            # 构建过滤器
            filters = {}
            if source_type:
                filters["source_type"] = source_type
            if source_id:
                filters["source_id"] = source_id
            
            # 搜索
            results = self.qdrant.search_vectors(
                collection_name="knowledge_base",
                query_vector=query_vector,
                limit=limit,
                filters=filters if filters else None,
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                payload = result.get("payload", {})
                
                # 语言过滤
                if language:
                    metadata = payload.get("metadata", {})
                    if metadata.get("language") != language:
                        continue
                
                formatted_results.append({
                    "chunk_id": payload.get("chunk_id"),
                    "source_type": payload.get("source_type"),
                    "source_id": payload.get("source_id"),
                    "title": payload.get("title"),
                    "content": payload.get("content"),
                    "metadata": payload.get("metadata", {}),
                    "score": result["score"],
                })
            
            logger.info(f"知识库搜索完成: {len(formatted_results)} 个结果")
            return formatted_results
            
        except Exception as e:
            logger.error(f"知识库搜索失败: {e}")
            return []
    
    def search_conversation_history(
        self,
        query: str,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        limit: int = 10,
        role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        搜索对话历史
        
        Args:
            query: 搜索查询
            user_id: 用户ID
            conversation_id: 对话ID
            limit: 返回结果数量
            role: 角色过滤 (user, assistant)
        
        Returns:
            消息列表
        """
        try:
            # 生成查询向量
            query_vector = self.embedding.get_embedding(query)
            if not query_vector:
                logger.warning("无法生成查询向量")
                return []
            
            # 构建过滤器
            filters = {}
            if user_id:
                filters["user_id"] = user_id
            if conversation_id:
                filters["conversation_id"] = conversation_id
            if role:
                filters["role"] = role
            
            # 搜索
            results = self.qdrant.search_vectors(
                collection_name="conversation_history",
                query_vector=query_vector,
                limit=limit,
                filters=filters if filters else None,
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                payload = result.get("payload", {})
                formatted_results.append({
                    "message_id": payload.get("message_id"),
                    "conversation_id": payload.get("conversation_id"),
                    "user_id": payload.get("user_id"),
                    "role": payload.get("role"),
                    "content": payload.get("content"),
                    "summary": payload.get("summary"),
                    "adapters_used": payload.get("adapters_used", []),
                    "created_at": payload.get("created_at"),
                    "score": result["score"],
                })
            
            logger.info(f"对话历史搜索完成: {len(formatted_results)} 个结果")
            return formatted_results
            
        except Exception as e:
            logger.error(f"对话历史搜索失败: {e}")
            return []
    
    def search_user_documents(
        self,
        query: str,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        file_type: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        搜索用户文档
        
        Args:
            query: 搜索查询
            user_id: 用户ID
            document_id: 文档ID
            file_type: 文件类型
            limit: 返回结果数量
        
        Returns:
            文档片段列表
        """
        try:
            # 生成查询向量
            query_vector = self.embedding.get_embedding(query)
            if not query_vector:
                logger.warning("无法生成查询向量")
                return []
            
            # 构建过滤器
            filters = {}
            if user_id:
                filters["user_id"] = user_id
            if document_id:
                filters["document_id"] = document_id
            
            # 搜索
            results = self.qdrant.search_vectors(
                collection_name="user_documents",
                query_vector=query_vector,
                limit=limit,
                filters=filters if filters else None,
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                payload = result.get("payload", {})
                
                # 文件类型过滤
                if file_type:
                    metadata = payload.get("metadata", {})
                    if metadata.get("file_type") != file_type:
                        continue
                
                formatted_results.append({
                    "document_id": payload.get("document_id"),
                    "user_id": payload.get("user_id"),
                    "filename": payload.get("filename"),
                    "chunk_index": payload.get("chunk_index"),
                    "content": payload.get("content"),
                    "metadata": payload.get("metadata", {}),
                    "score": result["score"],
                })
            
            logger.info(f"用户文档搜索完成: {len(formatted_results)} 个结果")
            return formatted_results
            
        except Exception as e:
            logger.error(f"用户文档搜索失败: {e}")
            return []
    
    def search_code_snippets(
        self,
        query: str,
        language: Optional[str] = None,
        adapter_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        搜索代码片段
        
        Args:
            query: 搜索查询
            language: 编程语言
            adapter_id: 适配器ID
            limit: 返回结果数量
        
        Returns:
            代码片段列表
        """
        try:
            # 生成查询向量
            query_vector = self.embedding.get_embedding(query)
            if not query_vector:
                logger.warning("无法生成查询向量")
                return []
            
            # 构建过滤器
            filters = {}
            if language:
                filters["language"] = language
            if adapter_id:
                filters["adapter_id"] = adapter_id
            
            # 搜索
            results = self.qdrant.search_vectors(
                collection_name="code_snippets",
                query_vector=query_vector,
                limit=limit,
                filters=filters if filters else None,
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                payload = result.get("payload", {})
                formatted_results.append({
                    "snippet_id": payload.get("snippet_id"),
                    "adapter_id": payload.get("adapter_id"),
                    "title": payload.get("title"),
                    "description": payload.get("description"),
                    "code": payload.get("code"),
                    "language": payload.get("language"),
                    "tags": payload.get("tags", []),
                    "score": result["score"],
                })
            
            logger.info(f"代码片段搜索完成: {len(formatted_results)} 个结果")
            return formatted_results
            
        except Exception as e:
            logger.error(f"代码片段搜索失败: {e}")
            return []
    
    def add_adapter(
        self,
        adapter_id: str,
        name: str,
        description: str,
        adapter_type: str,
        category: str,
        tags: List[str],
        rating: float = 0.0,
        downloads: int = 0,
    ) -> bool:
        """
        添加适配器到向量数据库
        
        Args:
            adapter_id: 适配器ID
            name: 适配器名称
            description: 适配器描述
            adapter_type: 适配器类型
            category: 分类
            tags: 标签列表
            rating: 评分
            downloads: 下载量
        
        Returns:
            是否添加成功
        """
        try:
            # 生成向量文本
            text = f"{name} {description} {' '.join(tags)}"
            
            # 生成向量
            vector = self.embedding.get_embedding(text)
            if not vector:
                logger.error("无法生成适配器向量")
                return False
            
            # 插入向量
            return self.qdrant.insert_vectors(
                collection_name="adapters_semantic",
                vectors=[vector],
                payloads=[{
                    "adapter_id": adapter_id,
                    "name": name,
                    "description": description,
                    "type": adapter_type,
                    "category": category,
                    "tags": tags,
                    "rating": rating,
                    "downloads": downloads,
                }],
                ids=[adapter_id],
            )
            
        except Exception as e:
            logger.error(f"添加适配器失败: {e}")
            return False
    
    def add_knowledge_chunk(
        self,
        chunk_id: str,
        source_type: str,
        source_id: str,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        添加知识片段
        
        Args:
            chunk_id: 片段ID
            source_type: 来源类型
            source_id: 来源ID
            title: 标题
            content: 内容
            metadata: 元数据
        
        Returns:
            是否添加成功
        """
        try:
            # 生成向量
            vector = self.embedding.get_embedding(content)
            if not vector:
                logger.error("无法生成知识片段向量")
                return False
            
            # 插入向量
            return self.qdrant.insert_vectors(
                collection_name="knowledge_base",
                vectors=[vector],
                payloads=[{
                    "chunk_id": chunk_id,
                    "source_type": source_type,
                    "source_id": source_id,
                    "title": title,
                    "content": content,
                    "metadata": metadata or {},
                    "created_at": datetime.utcnow().isoformat(),
                }],
                ids=[chunk_id],
            )
            
        except Exception as e:
            logger.error(f"添加知识片段失败: {e}")
            return False
    
    def add_conversation_message(
        self,
        message_id: str,
        conversation_id: str,
        user_id: str,
        role: str,
        content: str,
        summary: Optional[str] = None,
        adapters_used: Optional[List[str]] = None,
    ) -> bool:
        """
        添加对话消息
        
        Args:
            message_id: 消息ID
            conversation_id: 对话ID
            user_id: 用户ID
            role: 角色
            content: 内容
            summary: 摘要
            adapters_used: 使用的适配器列表
        
        Returns:
            是否添加成功
        """
        try:
            # 生成向量（使用摘要或内容）
            text = summary if summary else content
            vector = self.embedding.get_embedding(text)
            if not vector:
                logger.error("无法生成消息向量")
                return False
            
            # 插入向量
            return self.qdrant.insert_vectors(
                collection_name="conversation_history",
                vectors=[vector],
                payloads=[{
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": role,
                    "content": content,
                    "summary": summary,
                    "adapters_used": adapters_used or [],
                    "created_at": datetime.utcnow().isoformat(),
                }],
                ids=[message_id],
            )
            
        except Exception as e:
            logger.error(f"添加对话消息失败: {e}")
            return False
    
    def batch_add_adapters(
        self,
        adapters: List[Dict[str, Any]],
        show_progress: bool = True,
    ) -> int:
        """
        批量添加适配器
        
        Args:
            adapters: 适配器列表
            show_progress: 是否显示进度
        
        Returns:
            成功添加的数量
        """
        if not adapters:
            return 0
        
        try:
            # 生成向量文本
            texts = [
                f"{a['name']} {a['description']} {' '.join(a.get('tags', []))}"
                for a in adapters
            ]
            
            # 批量生成向量
            vectors = self.embedding.get_embeddings(texts, show_progress=show_progress)
            
            # 准备载荷和ID
            payloads = []
            ids = []
            valid_vectors = []
            
            for i, adapter in enumerate(adapters):
                if vectors[i]:  # 只添加成功生成向量的
                    valid_vectors.append(vectors[i])
                    payloads.append({
                        "adapter_id": adapter["adapter_id"],
                        "name": adapter["name"],
                        "description": adapter["description"],
                        "type": adapter.get("type", ""),
                        "category": adapter.get("category", ""),
                        "tags": adapter.get("tags", []),
                        "rating": adapter.get("rating", 0.0),
                        "downloads": adapter.get("downloads", 0),
                    })
                    ids.append(adapter["adapter_id"])
            
            # 批量插入
            if valid_vectors:
                success = self.qdrant.insert_vectors(
                    collection_name="adapters_semantic",
                    vectors=valid_vectors,
                    payloads=payloads,
                    ids=ids,
                )
                
                if success:
                    logger.info(f"批量添加适配器成功: {len(valid_vectors)}/{len(adapters)}")
                    return len(valid_vectors)
            
            return 0
            
        except Exception as e:
            logger.error(f"批量添加适配器失败: {e}")
            return 0
    
    def health_check(self) -> bool:
        """健康检查"""
        try:
            # 检查Qdrant
            if not self.qdrant.health_check():
                return False
            
            # 检查Embedding（生成一个测试向量）
            test_vector = self.embedding.get_embedding("测试")
            if not test_vector:
                return False
            
            logger.info("语义搜索服务健康检查通过")
            return True
            
        except Exception as e:
            logger.error(f"语义搜索服务健康检查失败: {e}")
            return False


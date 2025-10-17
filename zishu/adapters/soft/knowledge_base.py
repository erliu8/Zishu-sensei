# -*- coding: utf-8 -*-
"""
知识库管理系统
"""

import os
import json
import uuid
import asyncio
import hashlib
import mimetypes
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple, Set, Callable
from dataclasses import dataclass, field
from enum import Enum
import logging
import threading
import weakref
from collections import defaultdict, deque
import pickle
import base64
import gzip

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.feature_extraction.text import TfidfVectorizer

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import faiss

    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

try:
    import chromadb

    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer

    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# 项目模块导入
from ..base import BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult
from ..base.exceptions import (
    BaseAdapterException,
    AdapterConfigurationError,
    AdapterValidationError,
    AdapterExecutionError,
    AdapterSecurityError,
    ErrorCode,
)
from ..base.metadata import (
    AdapterMetadata,
    AdapterCapability,
    AdapterType,
    SecurityLevel,
)
from ..core.security import SecurityManager
from ..utils.config import ConfigManager, get_config_manager

# 配置日志
logger = logging.getLogger(__name__)


# ================================
# 核心数据结构和枚举
# ================================


class DocumentType(Enum):
    """文档类型"""

    TEXT = "text"
    PDF = "pdf"
    WORD = "word"
    HTML = "html"
    MARKDOWN = "markdown"
    JSON = "json"
    XML = "xml"
    CSV = "csv"
    EXCEL = "excel"
    UNKNOWN = "unknown"


class StorageBackend(Enum):
    """存储后端类型"""

    MEMORY = "memory"
    FILE_SYSTEM = "file_system"
    CHROMADB = "chromadb"
    FAISS = "faiss"
    ELASTICSEARCH = "elasticsearch"
    POSTGRESQL = "postgresql"
    CUSTOM = "custom"


class SearchMode(Enum):
    """搜索模式"""

    SEMANTIC = "semantic"  # 语义搜索
    KEYWORD = "keyword"  # 关键词搜索
    HYBRID = "hybrid"  # 混合搜索
    FUZZY = "fuzzy"  # 模糊搜索


class DocumentStatus(Enum):
    """文档状态"""

    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    ERROR = "error"
    DELETED = "deleted"


class Permission(Enum):
    """权限类型"""

    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"


class UserRole(Enum):
    """用户角色"""

    GUEST = "guest"  # 只读访问
    USER = "user"  # 基本读写
    EDITOR = "editor"  # 完整编辑权限
    ADMIN = "admin"  # 管理员权限


class SecurityLevel(Enum):
    """安全级别"""

    PUBLIC = "public"  # 公开访问
    PROTECTED = "protected"  # 需要认证
    PRIVATE = "private"  # 私有访问
    RESTRICTED = "restricted"  # 受限访问


@dataclass
class Document:
    """文档对象"""

    id: str = field(default_factory=lambda: f"doc_{uuid.uuid4().hex[:8]}")
    title: str = ""
    content: str = ""
    doc_type: DocumentType = DocumentType.TEXT
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    version: int = 1
    status: DocumentStatus = DocumentStatus.PENDING
    file_path: Optional[str] = None
    file_size: int = 0
    checksum: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    indexed_at: Optional[datetime] = None
    author: Optional[str] = None
    source: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "doc_type": self.doc_type.value,
            "metadata": self.metadata,
            "tags": self.tags,
            "version": self.version,
            "status": self.status.value,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "checksum": self.checksum,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "indexed_at": self.indexed_at.isoformat() if self.indexed_at else None,
            "author": self.author,
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Document":
        """从字典创建文档对象"""
        doc = cls()
        doc.id = data.get("id", doc.id)
        doc.title = data.get("title", "")
        doc.content = data.get("content", "")
        doc.doc_type = DocumentType(data.get("doc_type", "text"))
        doc.metadata = data.get("metadata", {})
        doc.tags = data.get("tags", [])
        doc.version = data.get("version", 1)
        doc.status = DocumentStatus(data.get("status", "pending"))
        doc.file_path = data.get("file_path")
        doc.file_size = data.get("file_size", 0)
        doc.checksum = data.get("checksum", "")
        doc.author = data.get("author")
        doc.source = data.get("source")

        # 解析时间字段
        if data.get("created_at"):
            doc.created_at = datetime.fromisoformat(
                data["created_at"].replace("Z", "+00:00")
            )
        if data.get("updated_at"):
            doc.updated_at = datetime.fromisoformat(
                data["updated_at"].replace("Z", "+00:00")
            )
        if data.get("indexed_at"):
            doc.indexed_at = datetime.fromisoformat(
                data["indexed_at"].replace("Z", "+00:00")
            )

        return doc


@dataclass
class SearchQuery:
    """搜索查询"""

    query_text: str
    mode: SearchMode = SearchMode.SEMANTIC
    filters: Dict[str, Any] = field(default_factory=dict)
    limit: int = 10
    offset: int = 0
    min_score: float = 0.0
    include_content: bool = True
    include_metadata: bool = True
    tags: List[str] = field(default_factory=list)
    doc_types: List[DocumentType] = field(default_factory=list)


@dataclass
class SearchResult:
    """搜索结果"""

    document: Document
    score: float
    highlights: List[str] = field(default_factory=list)
    snippet: str = ""
    matched_fields: List[str] = field(default_factory=list)


@dataclass
class SearchResponse:
    """搜索响应"""

    query: SearchQuery
    results: List[SearchResult]
    total_count: int
    search_time: float
    facets: Dict[str, Any] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)


# ================================
# 权限和安全相关数据类
# ================================


@dataclass
class User:
    """用户信息"""

    id: str = field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}")
    username: str = ""
    email: str = ""
    full_name: str = ""
    role: str = "user"
    permissions: Set[str] = field(default_factory=set)
    groups: Set[str] = field(default_factory=set)
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Permission:
    """权限定义"""

    name: str
    description: str = ""
    resource_type: str = "*"  # 资源类型，如 document, knowledge_base 等
    actions: Set[str] = field(default_factory=set)  # read, write, delete, admin
    conditions: Dict[str, Any] = field(default_factory=dict)  # 额外条件


@dataclass
class AccessToken:
    """访问令牌"""

    token: str
    user_id: str
    expires_at: datetime
    scopes: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """检查令牌是否过期"""
        return datetime.now(timezone.utc) > self.expires_at


@dataclass
class AuditLog:
    """审计日志"""

    id: str = field(default_factory=lambda: f"audit_{uuid.uuid4().hex[:8]}")
    user_id: str = ""
    action: str = ""
    resource_type: str = ""
    resource_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: str = ""
    user_agent: str = ""
    success: bool = True
    error_message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


# ================================
# 存储后端抽象基类
# ================================


class StorageBackendBase(ABC):
    """存储后端抽象基类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    @abstractmethod
    async def initialize(self) -> bool:
        """初始化存储后端"""
        pass

    @abstractmethod
    async def store_document(
        self, document: Document, embedding: Optional[np.ndarray] = None
    ) -> bool:
        """存储文档"""
        pass

    @abstractmethod
    async def get_document(self, doc_id: str) -> Optional[Document]:
        """获取文档"""
        pass

    @abstractmethod
    async def update_document(
        self, document: Document, embedding: Optional[np.ndarray] = None
    ) -> bool:
        """更新文档"""
        pass

    @abstractmethod
    async def delete_document(self, doc_id: str) -> bool:
        """删除文档"""
        pass

    @abstractmethod
    async def search_documents(
        self, query: SearchQuery, query_embedding: Optional[np.ndarray] = None
    ) -> List[SearchResult]:
        """搜索文档"""
        pass

    @abstractmethod
    async def get_document_count(self) -> int:
        """获取文档总数"""
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """清理资源"""
        pass


# ================================
# 内存存储后端实现
# ================================


class MemoryStorageBackend(StorageBackendBase):
    """内存存储后端"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, np.ndarray] = {}
        self.index: Dict[str, Set[str]] = defaultdict(set)  # 倒排索引
        self._lock = threading.RLock()

    async def initialize(self) -> bool:
        """初始化存储后端"""
        self.logger.info("Memory storage backend initialized")
        return True

    async def store_document(
        self, document: Document, embedding: Optional[np.ndarray] = None
    ) -> bool:
        """存储文档"""
        try:
            with self._lock:
                self.documents[document.id] = document
                if embedding is not None and NUMPY_AVAILABLE:
                    self.embeddings[document.id] = embedding

                # 构建倒排索引
                self._build_inverted_index(document)

            self.logger.debug(f"Stored document {document.id} in memory")
            return True
        except Exception as e:
            self.logger.error(f"Failed to store document {document.id}: {e}")
            return False

    async def get_document(self, doc_id: str) -> Optional[Document]:
        """获取文档"""
        with self._lock:
            return self.documents.get(doc_id)

    async def update_document(
        self, document: Document, embedding: Optional[np.ndarray] = None
    ) -> bool:
        """更新文档"""
        try:
            with self._lock:
                # 先删除旧的索引
                old_doc = self.documents.get(document.id)
                if old_doc:
                    self._remove_from_inverted_index(old_doc)

                # 存储新文档
                self.documents[document.id] = document
                if embedding is not None and NUMPY_AVAILABLE:
                    self.embeddings[document.id] = embedding

                # 重新构建索引
                self._build_inverted_index(document)

            self.logger.debug(f"Updated document {document.id} in memory")
            return True
        except Exception as e:
            self.logger.error(f"Failed to update document {document.id}: {e}")
            return False

    async def delete_document(self, doc_id: str) -> bool:
        """删除文档"""
        try:
            with self._lock:
                document = self.documents.get(doc_id)
                if document:
                    self._remove_from_inverted_index(document)
                    del self.documents[doc_id]
                    self.embeddings.pop(doc_id, None)

            self.logger.debug(f"Deleted document {doc_id} from memory")
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete document {doc_id}: {e}")
            return False

    async def search_documents(
        self, query: SearchQuery, query_embedding: Optional[np.ndarray] = None
    ) -> List[SearchResult]:
        """搜索文档"""
        try:
            with self._lock:
                if (
                    query.mode == SearchMode.SEMANTIC
                    and query_embedding is not None
                    and NUMPY_AVAILABLE
                ):
                    return self._semantic_search(query, query_embedding)
                elif query.mode == SearchMode.KEYWORD:
                    return self._keyword_search(query)
                elif (
                    query.mode == SearchMode.HYBRID
                    and query_embedding is not None
                    and NUMPY_AVAILABLE
                ):
                    return self._hybrid_search(query, query_embedding)
                else:
                    return self._keyword_search(query)
        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            return []

    async def get_document_count(self) -> int:
        """获取文档总数"""
        with self._lock:
            return len(self.documents)

    async def cleanup(self) -> None:
        """清理资源"""
        with self._lock:
            self.documents.clear()
            self.embeddings.clear()
            self.index.clear()
        self.logger.info("Memory storage backend cleaned up")

    def _build_inverted_index(self, document: Document) -> None:
        """构建倒排索引"""
        # 索引标题
        if document.title:
            for word in self._tokenize(document.title.lower()):
                self.index[word].add(document.id)

        # 索引内容
        if document.content:
            for word in self._tokenize(document.content.lower()):
                self.index[word].add(document.id)

        # 索引标签
        for tag in document.tags:
            self.index[tag.lower()].add(document.id)

    def _remove_from_inverted_index(self, document: Document) -> None:
        """从倒排索引中移除文档"""
        # 移除标题索引
        if document.title:
            for word in self._tokenize(document.title.lower()):
                self.index[word].discard(document.id)

        # 移除内容索引
        if document.content:
            for word in self._tokenize(document.content.lower()):
                self.index[word].discard(document.id)

        # 移除标签索引
        for tag in document.tags:
            self.index[tag.lower()].discard(document.id)

    def _tokenize(self, text: str) -> List[str]:
        """简单的分词"""
        import re

        # 简单的分词逻辑，实际项目中可以使用更复杂的分词器
        words = re.findall(r"\b\w+\b", text)
        return [word for word in words if len(word) > 2]  # 过滤太短的词

    def _semantic_search(
        self, query: SearchQuery, query_embedding: np.ndarray
    ) -> List[SearchResult]:
        """语义搜索"""
        if not SKLEARN_AVAILABLE:
            return self._keyword_search(query)

        results = []
        query_embedding = query_embedding.reshape(1, -1)

        for doc_id, doc_embedding in self.embeddings.items():
            document = self.documents.get(doc_id)
            if not document or not self._match_filters(document, query):
                continue

            # 计算余弦相似度
            doc_embedding = doc_embedding.reshape(1, -1)
            similarity = cosine_similarity(query_embedding, doc_embedding)[0][0]

            if similarity >= query.min_score:
                results.append(
                    SearchResult(
                        document=document,
                        score=float(similarity),
                        snippet=self._generate_snippet(
                            document.content, query.query_text
                        ),
                    )
                )

        # 按分数排序
        results.sort(key=lambda x: x.score, reverse=True)

        # 应用分页
        start_idx = query.offset
        end_idx = start_idx + query.limit
        return results[start_idx:end_idx]

    def _keyword_search(self, query: SearchQuery) -> List[SearchResult]:
        """关键词搜索"""
        query_words = self._tokenize(query.query_text.lower())
        if not query_words:
            return []

        # 找到包含查询词的文档ID
        candidate_doc_ids = set()
        for word in query_words:
            candidate_doc_ids.update(self.index.get(word, set()))

        results = []
        for doc_id in candidate_doc_ids:
            document = self.documents.get(doc_id)
            if not document or not self._match_filters(document, query):
                continue

            # 计算简单的TF分数
            score = self._calculate_tf_score(document, query_words)

            if score >= query.min_score:
                results.append(
                    SearchResult(
                        document=document,
                        score=score,
                        snippet=self._generate_snippet(
                            document.content, query.query_text
                        ),
                    )
                )

        # 按分数排序
        results.sort(key=lambda x: x.score, reverse=True)

        # 应用分页
        start_idx = query.offset
        end_idx = start_idx + query.limit
        return results[start_idx:end_idx]

    def _hybrid_search(
        self, query: SearchQuery, query_embedding: np.ndarray
    ) -> List[SearchResult]:
        """混合搜索"""
        # 获取语义搜索结果
        semantic_results = self._semantic_search(query, query_embedding)

        # 获取关键词搜索结果
        keyword_results = self._keyword_search(query)

        # 合并结果，语义搜索权重0.7，关键词搜索权重0.3
        combined_scores = {}

        for result in semantic_results:
            combined_scores[result.document.id] = {
                "document": result.document,
                "semantic_score": result.score,
                "keyword_score": 0.0,
                "snippet": result.snippet,
            }

        for result in keyword_results:
            if result.document.id in combined_scores:
                combined_scores[result.document.id]["keyword_score"] = result.score
            else:
                combined_scores[result.document.id] = {
                    "document": result.document,
                    "semantic_score": 0.0,
                    "keyword_score": result.score,
                    "snippet": result.snippet,
                }

        # 计算组合分数
        final_results = []
        for doc_data in combined_scores.values():
            combined_score = (
                doc_data["semantic_score"] * 0.7 + doc_data["keyword_score"] * 0.3
            )

            if combined_score >= query.min_score:
                final_results.append(
                    SearchResult(
                        document=doc_data["document"],
                        score=combined_score,
                        snippet=doc_data["snippet"],
                    )
                )

        # 按分数排序
        final_results.sort(key=lambda x: x.score, reverse=True)

        # 应用分页
        start_idx = query.offset
        end_idx = start_idx + query.limit
        return final_results[start_idx:end_idx]

    def _match_filters(self, document: Document, query: SearchQuery) -> bool:
        """检查文档是否匹配过滤条件"""
        # 检查文档类型过滤
        if query.doc_types and document.doc_type not in query.doc_types:
            return False

        # 检查标签过滤
        if query.tags:
            if not any(tag in document.tags for tag in query.tags):
                return False

        # 检查其他过滤条件
        for key, value in query.filters.items():
            if key == "author" and document.author != value:
                return False
            elif key == "source" and document.source != value:
                return False
            elif key in document.metadata and document.metadata[key] != value:
                return False

        return True

    def _calculate_tf_score(self, document: Document, query_words: List[str]) -> float:
        """计算TF分数"""
        text = f"{document.title} {document.content}".lower()
        text_words = self._tokenize(text)

        if not text_words:
            return 0.0

        # 计算词频
        word_count = len(text_words)
        score = 0.0

        for word in query_words:
            tf = text_words.count(word) / word_count
            score += tf

        return score / len(query_words) if query_words else 0.0

    def _generate_snippet(
        self, content: str, query_text: str, max_length: int = 200
    ) -> str:
        """生成搜索结果摘要"""
        if not content or not query_text:
            return content[:max_length] if content else ""

        query_words = self._tokenize(query_text.lower())
        if not query_words:
            return content[:max_length]

        # 找到第一个匹配词的位置
        content_lower = content.lower()
        best_pos = 0

        for word in query_words:
            pos = content_lower.find(word)
            if pos != -1:
                best_pos = max(0, pos - 50)  # 在匹配词前留一些上下文
                break

        # 截取片段
        snippet = content[best_pos : best_pos + max_length]

        # 如果不是从开头开始，添加省略号
        if best_pos > 0:
            snippet = "..." + snippet

        # 如果没有到结尾，添加省略号
        if best_pos + max_length < len(content):
            snippet = snippet + "..."

        return snippet


# ================================
# 嵌入生成器
# ================================


class EmbeddingGenerator:
    """嵌入向量生成器"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_name = config.get("model_name", "all-MiniLM-L6-v2")
        self.model = None
        self.logger = logging.getLogger(f"{__name__}.EmbeddingGenerator")

    async def initialize(self) -> bool:
        """初始化嵌入模型"""
        try:
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                self.model = SentenceTransformer(self.model_name)
                self.logger.info(f"Initialized embedding model: {self.model_name}")
                return True
            else:
                self.logger.warning(
                    "SentenceTransformers not available, using dummy embeddings"
                )
                return True
        except Exception as e:
            self.logger.error(f"Failed to initialize embedding model: {e}")
            return False

    def generate_embedding(self, text: str) -> Optional[np.ndarray]:
        """生成文本嵌入"""
        if not text or not text.strip():
            return None

        try:
            if self.model is not None and SENTENCE_TRANSFORMERS_AVAILABLE:
                embedding = self.model.encode(text)
                return embedding
            else:
                # 使用简单的哈希值作为占位符嵌入
                return self._generate_dummy_embedding(text)
        except Exception as e:
            self.logger.error(f"Failed to generate embedding: {e}")
            return None

    def _generate_dummy_embedding(self, text: str, dim: int = 384) -> np.ndarray:
        """生成虚拟嵌入（用于测试）"""
        if not NUMPY_AVAILABLE:
            return None

        # 使用文本哈希生成一致的虚拟嵌入
        hash_value = hashlib.md5(text.encode()).hexdigest()
        seed = int(hash_value[:8], 16)
        np.random.seed(seed)
        embedding = np.random.randn(dim).astype(np.float32)
        # 归一化
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding


# ================================
# 主要知识库管理器
# ================================


class KnowledgeBaseAdapter(BaseAdapter):
    """紫舒老师知识库管理适配器"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        # 初始化内部元数据存储，以便BaseAdapter可以设置
        self._metadata_obj: Optional[AdapterMetadata] = None
        super().__init__(self.config)
        self.storage_backend: Optional[StorageBackendBase] = None
        self.embedding_generator: Optional[EmbeddingGenerator] = None
        self._initialized = False
        self._lock = threading.RLock()

        # 安全管理器
        self.security_manager: Optional[SecurityManager] = None
        if self.config.get("enable_security", False):
            self.security_manager = SecurityManager(self.config.get("security", {}))

        # 缓存系统
        self._document_cache: Dict[str, Document] = {}
        self._search_cache: Dict[str, SearchResponse] = {}
        self._cache_max_size = self.config.get("cache_max_size", 1000)
        self._cache_ttl = self.config.get("cache_ttl", 3600)  # 1小时

        # 统计信息
        self.stats = {
            "documents_indexed": 0,
            "searches_performed": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "last_updated": datetime.now(timezone.utc),
        }

    @property
    def metadata(self) -> AdapterMetadata:
        """适配器元数据"""
        # 如果已经有外部设置的metadata，使用它；否则返回默认元数据
        if self._metadata_obj is not None:
            return self._metadata_obj
        return AdapterMetadata(
            name="knowledge_base",
            display_name="紫舒老师知识库管理器",
            description="提供完整的知识库管理功能，包括文档索引、智能搜索和向量检索",
            version="1.0.0",
            author="紫舒老师团队",
            adapter_type=AdapterType.SOFT,
            capabilities=[
                AdapterCapability.DATA_STORAGE,
                AdapterCapability.SEARCH,
                AdapterCapability.INDEXING,
                AdapterCapability.CACHING,
            ],
            supported_formats=["text", "json", "markdown", "pdf"],
            dependencies=["numpy", "scikit-learn", "sentence-transformers"],
            security_level=SecurityLevel.STANDARD,
            configuration_schema={
                "storage_backend": {
                    "type": "string",
                    "enum": ["memory", "file_system", "chromadb", "faiss"],
                    "default": "memory",
                    "description": "存储后端类型",
                },
                "embedding_model": {
                    "type": "string",
                    "default": "all-MiniLM-L6-v2",
                    "description": "嵌入模型名称",
                },
                "cache_max_size": {
                    "type": "integer",
                    "default": 1000,
                    "description": "缓存最大大小",
                },
                "storage_path": {
                    "type": "string",
                    "default": "./knowledge_base",
                    "description": "存储路径",
                },
            },
        )
    
    @metadata.setter
    def metadata(self, value: Optional[AdapterMetadata]) -> None:
        """设置适配器元数据"""
        self._metadata_obj = value

    async def initialize(self, context: ExecutionContext) -> ExecutionResult:
        """初始化知识库适配器"""
        try:
            with self._lock:
                if self._initialized:
                    return ExecutionResult(
                        execution_id="init",
                        adapter_id=self.adapter_id,
                        status="success",
                        output={"message": "Knowledge base adapter already initialized"},
                    )

                # 初始化存储后端
                storage_type = self.config.get("storage_backend", "memory")
                if storage_type == "memory":
                    self.storage_backend = MemoryStorageBackend(self.config)
                else:
                    raise AdapterConfigurationError(
                        f"Unsupported storage backend: {storage_type}"
                    )

                if not await self.storage_backend.initialize():
                    raise AdapterExecutionError("Failed to initialize storage backend")

                # 初始化嵌入生成器
                embedding_config = {
                    "model_name": self.config.get("embedding_model", "all-MiniLM-L6-v2")
                }
                self.embedding_generator = EmbeddingGenerator(embedding_config)
                if not await self.embedding_generator.initialize():
                    raise AdapterExecutionError(
                        "Failed to initialize embedding generator"
                    )

                self._initialized = True
                self.logger.info("Knowledge base adapter initialized successfully")

                return ExecutionResult(
                    execution_id="init",
                    adapter_id=self.adapter_id,
                    status="success",
                    output={
                        "message": "Knowledge base adapter initialized",
                        "backend": storage_type,
                        "embedding_model": embedding_config["model_name"],
                    },
                )

        except Exception as e:
            self.logger.error(f"Failed to initialize knowledge base adapter: {e}")
            return ExecutionResult(
                execution_id="init",
                adapter_id=self.adapter_id,
                status="error",
                error=f"Initialization failed: {e}",
            )

    def _check_permission(
        self,
        operation: str,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> bool:
        """检查用户权限"""
        if not self.security_manager:
            return True  # 如果没有启用安全管理器，允许所有操作

        return self.security_manager.check_permission(operation, user_id, resource_id)

    def _validate_access(
        self,
        operation: str,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> None:
        """验证访问权限，如果没有权限则抛出异常"""
        if not self._check_permission(operation, user_id, resource_id):
            raise AdapterSecurityError(
                f"Access denied: User {user_id} does not have permission for operation '{operation}'"
            )

    def _filter_documents_by_permission(
        self, documents: List[Document], user_id: Optional[str] = None
    ) -> List[Document]:
        """根据权限过滤文档列表"""
        if not self.security_manager:
            return documents

        filtered_documents = []
        for doc in documents:
            if self._check_permission("read", user_id, doc.id):
                filtered_documents.append(doc)

        return filtered_documents

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        """执行知识库操作"""
        if not self._initialized:
            return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Knowledge base adapter not initialized",
                error_code=ErrorCode.NOT_INITIALIZED,
            )

        action = context.parameters.get("action")

        try:
            if action == "add_document":
                return await self._add_document(context)
            elif action == "get_document":
                return await self._get_document(context)
            elif action == "update_document":
                return await self._update_document(context)
            elif action == "delete_document":
                return await self._delete_document(context)
            elif action == "search":
                return await self._search_documents(context)
            elif action == "get_stats":
                return await self._get_stats(context)
            elif action == "clear_cache":
                return await self._clear_cache(context)
            else:
                return ExecutionResult(
                    status="error",
                    message=f"Unknown action: {action}",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

        except Exception as e:
            self.logger.error(f"Execution failed for action {action}: {e}")
            return ExecutionResult(
                status="error",
                message=f"Execution failed: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _add_document(self, context: ExecutionContext) -> ExecutionResult:
        """添加文档"""
        try:
            # 权限检查
            user_id = context.parameters.get("user_id")
            self._validate_access("write", user_id)

            # 提取参数
            content = context.parameters.get("content", "")
            title = context.parameters.get("title", "")
            doc_type = context.parameters.get("doc_type", "text")
            tags = context.parameters.get("tags", [])
            metadata = context.parameters.get("metadata", {})
            author = context.parameters.get("author")
            source = context.parameters.get("source")

            if not content:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Document content is required",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

            # 创建文档对象
            document = Document(
                title=title,
                content=content,
                doc_type=DocumentType(doc_type),
                tags=tags,
                metadata=metadata,
                author=author,
                source=source,
            )

            # 计算校验和
            document.checksum = hashlib.md5(content.encode()).hexdigest()
            document.file_size = len(content.encode())

            # 生成嵌入
            embedding = None
            if self.embedding_generator:
                text_for_embedding = f"{title} {content}".strip()
                embedding = self.embedding_generator.generate_embedding(
                    text_for_embedding
                )

            # 存储文档
            if await self.storage_backend.store_document(document, embedding):
                document.status = DocumentStatus.INDEXED
                document.indexed_at = datetime.now(timezone.utc)

                # 更新统计
                with self._lock:
                    self.stats["documents_indexed"] += 1
                    self.stats["last_updated"] = datetime.now(timezone.utc)

                self.logger.info(f"Document {document.id} added successfully")
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Document added successfully"},
                    data={"document_id": document.id, "status": document.status.value},
                )
            else:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Failed to store document",
                    error_code=ErrorCode.STORAGE_ERROR,
                )

        except Exception as e:
            self.logger.error(f"Failed to add document: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to add document: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _get_document(self, context: ExecutionContext) -> ExecutionResult:
        """获取文档"""
        try:
            doc_id = context.parameters.get("document_id")
            user_id = context.parameters.get("user_id")

            if not doc_id:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Document ID is required",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

            # 权限检查
            self._validate_access("read", user_id, doc_id)

            # 先检查缓存
            with self._lock:
                if doc_id in self._document_cache:
                    self.stats["cache_hits"] += 1
                    document = self._document_cache[doc_id]
                else:
                    self.stats["cache_misses"] += 1
                    document = await self.storage_backend.get_document(doc_id)

                    if document and len(self._document_cache) < self._cache_max_size:
                        self._document_cache[doc_id] = document

            if document:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Document retrieved successfully"},
                    data=document.to_dict(),
                )
            else:
                return ExecutionResult(
                    status="error",
                    message=f"Document {doc_id} not found",
                    error_code=ErrorCode.NOT_FOUND,
                )

        except Exception as e:
            self.logger.error(f"Failed to get document: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to get document: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _update_document(self, context: ExecutionContext) -> ExecutionResult:
        """更新文档"""
        try:
            doc_id = context.parameters.get("document_id")
            user_id = context.parameters.get("user_id")

            if not doc_id:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Document ID is required",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

            # 权限检查
            self._validate_access("write", user_id, doc_id)

            # 获取现有文档
            existing_doc = await self.storage_backend.get_document(doc_id)
            if not existing_doc:
                return ExecutionResult(
                    status="error",
                    message=f"Document {doc_id} not found",
                    error_code=ErrorCode.NOT_FOUND,
                )

            # 更新字段
            if "content" in context.parameters:
                existing_doc.content = context.parameters["content"]
            if "title" in context.parameters:
                existing_doc.title = context.parameters["title"]
            if "tags" in context.parameters:
                existing_doc.tags = context.parameters["tags"]
            if "metadata" in context.parameters:
                existing_doc.metadata.update(context.parameters["metadata"])

            # 更新版本和时间戳
            existing_doc.version += 1
            existing_doc.updated_at = datetime.now(timezone.utc)
            existing_doc.status = DocumentStatus.PROCESSING

            # 重新计算校验和
            existing_doc.checksum = hashlib.md5(
                existing_doc.content.encode()
            ).hexdigest()
            existing_doc.file_size = len(existing_doc.content.encode())

            # 重新生成嵌入
            embedding = None
            if self.embedding_generator:
                text_for_embedding = (
                    f"{existing_doc.title} {existing_doc.content}".strip()
                )
                embedding = self.embedding_generator.generate_embedding(
                    text_for_embedding
                )

            # 更新存储
            if await self.storage_backend.update_document(existing_doc, embedding):
                existing_doc.status = DocumentStatus.INDEXED
                existing_doc.indexed_at = datetime.now(timezone.utc)

                # 清除缓存
                with self._lock:
                    self._document_cache.pop(doc_id, None)
                    self.stats["last_updated"] = datetime.now(timezone.utc)

                self.logger.info(f"Document {doc_id} updated successfully")
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Document updated successfully"},
                    data={"document_id": doc_id, "version": existing_doc.version},
                )
            else:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Failed to update document",
                    error_code=ErrorCode.STORAGE_ERROR,
                )

        except Exception as e:
            self.logger.error(f"Failed to update document: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to update document: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _delete_document(self, context: ExecutionContext) -> ExecutionResult:
        """删除文档"""
        try:
            doc_id = context.parameters.get("document_id")
            user_id = context.parameters.get("user_id")

            if not doc_id:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Document ID is required",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

            # 权限检查
            self._validate_access("delete", user_id, doc_id)

            # 删除文档
            if await self.storage_backend.delete_document(doc_id):
                # 清除缓存
                with self._lock:
                    self._document_cache.pop(doc_id, None)
                    self.stats["last_updated"] = datetime.now(timezone.utc)

                self.logger.info(f"Document {doc_id} deleted successfully")
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Document deleted successfully"},
                    data={"document_id": doc_id},
                )
            else:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Failed to delete document",
                    error_code=ErrorCode.STORAGE_ERROR,
                )

        except Exception as e:
            self.logger.error(f"Failed to delete document: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to delete document: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _search_documents(self, context: ExecutionContext) -> ExecutionResult:
        """搜索文档"""
        try:
            # 提取搜索参数
            user_id = context.parameters.get("user_id")
            query_text = context.parameters.get("query", "")
            search_type = context.parameters.get("search_type", "hybrid")
            limit = context.parameters.get("limit", 10)
            offset = context.parameters.get("offset", 0)
            min_score = context.parameters.get("min_score", 0.0)
            doc_types = context.parameters.get("doc_types", [])
            tags = context.parameters.get("tags", [])
            filters = context.parameters.get("filters", {})

            if not query_text:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Query text is required",
                    error_code=ErrorCode.INVALID_PARAMETER,
                )

            # 创建搜索查询对象
            search_query = SearchQuery(
                query_text=query_text,
                mode=SearchMode(search_type),
                limit=limit,
                offset=offset,
                min_score=min_score,
                doc_types=doc_types,
                tags=tags,
                filters=filters,
            )

            # 检查搜索缓存
            cache_key = self._generate_search_cache_key(search_query)
            with self._lock:
                if cache_key in self._search_cache:
                    cached_response = self._search_cache[cache_key]
                    # 检查缓存是否过期
                    if (
                        datetime.now(timezone.utc) - cached_response.timestamp
                    ).seconds < self._cache_ttl:
                        self.stats["cache_hits"] += 1
                        self.logger.debug(f"Search cache hit for query: {query_text}")
                        return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Search completed (cached)"},
                            data=cached_response.to_dict(),
                        )
                    else:
                        # 清除过期缓存
                        del self._search_cache[cache_key]

                self.stats["cache_misses"] += 1
                self.stats["searches_performed"] += 1

            # 执行搜索
            response = await self.storage_backend.search_documents(search_query)

            if response:
                # 权限过滤搜索结果
                if self.security_manager:
                    filtered_results = []
                    for result in response.results:
                        if self._check_permission("read", user_id, result.document.id):
                            filtered_results.append(result)
                    response.results = filtered_results
                    response.total_count = len(filtered_results)

                # 更新搜索缓存（注意：缓存的是过滤后的结果）
                with self._lock:
                    if len(self._search_cache) < self._cache_max_size:
                        self._search_cache[cache_key] = response
                    self.stats["last_updated"] = datetime.now(timezone.utc)

                self.logger.info(
                    f"Search completed: {len(response.results)} results for '{query_text}'"
                )
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Search completed successfully"},
                    data=response.to_dict(),
                )
            else:
                return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="error", error="Search failed",
                    error_code=ErrorCode.SEARCH_ERROR,
                )

        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            return ExecutionResult(
                status="error",
                message=f"Search failed: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _get_stats(self, context: ExecutionContext) -> ExecutionResult:
        """获取统计信息"""
        try:
            # 获取存储后端统计
            doc_count = 0
            if self.storage_backend:
                doc_count = await self.storage_backend.get_document_count()

            # 合并统计信息
            combined_stats = {
                **self.stats,
                "total_documents": doc_count,
                "cache_size": len(self._document_cache),
                "search_cache_size": len(self._search_cache),
                "cache_hit_ratio": (
                    self.stats["cache_hits"]
                    / (self.stats["cache_hits"] + self.stats["cache_misses"])
                    if (self.stats["cache_hits"] + self.stats["cache_misses"]) > 0
                    else 0.0
                ),
            }

            return ExecutionResult(execution_id="kb_op", adapter_id=self.adapter_id, status="success", output={"message": "Statistics retrieved successfully"},
                data=combined_stats,
            )

        except Exception as e:
            self.logger.error(f"Failed to get stats: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to get stats: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def _clear_cache(self, context: ExecutionContext) -> ExecutionResult:
        """清除缓存"""
        try:
            cache_type = context.parameters.get("cache_type", "all")

            with self._lock:
                if cache_type in ["all", "document"]:
                    doc_cache_size = len(self._document_cache)
                    self._document_cache.clear()
                    self.logger.info(f"Cleared document cache ({doc_cache_size} items)")

                if cache_type in ["all", "search"]:
                    search_cache_size = len(self._search_cache)
                    self._search_cache.clear()
                    self.logger.info(
                        f"Cleared search cache ({search_cache_size} items)"
                    )

            return ExecutionResult(
                status="success",
                message=f"Cache cleared successfully ({cache_type})",
                data={"cache_type": cache_type},
            )

        except Exception as e:
            self.logger.error(f"Failed to clear cache: {e}")
            return ExecutionResult(
                status="error",
                message=f"Failed to clear cache: {e}",
                error_code=ErrorCode.EXECUTION_ERROR,
            )

    async def cleanup(self) -> None:
        """清理资源"""
        try:
            with self._lock:
                # 清理缓存
                self._document_cache.clear()
                self._search_cache.clear()

                # 清理存储后端
                if self.storage_backend:
                    await self.storage_backend.cleanup()

                # 重置统计
                self.stats = {
                    "documents_indexed": 0,
                    "searches_performed": 0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "last_updated": datetime.now(timezone.utc),
                }

                self._initialized = False

            self.logger.info("Knowledge base adapter cleaned up successfully")

        except Exception as e:
            self.logger.error(f"Failed to cleanup knowledge base adapter: {e}")

    def _generate_search_cache_key(self, query: SearchQuery) -> str:
        """生成搜索缓存键"""
        # 创建一个包含所有搜索参数的字符串
        key_data = {
            "query": query.query_text,
            "type": query.search_type.value,
            "limit": query.limit,
            "offset": query.offset,
            "min_score": query.min_score,
            "doc_types": sorted(query.doc_types),
            "tags": sorted(query.tags),
            "filters": sorted(query.filters.items()),
        }

        # 使用JSON序列化确保一致性
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()

    # ================================
    # 基类抽象方法实现
    # ================================

    async def _initialize_impl(self) -> bool:
        """初始化实现"""
        try:
            with self._lock:
                if self._initialized:
                    return True

                # 初始化存储后端
                storage_type = self.config.get("storage_backend", "memory")
                if storage_type == "memory":
                    self.storage_backend = MemoryStorageBackend(self.config)
                else:
                    raise AdapterConfigurationError(
                        f"Unsupported storage backend: {storage_type}"
                    )

                if not await self.storage_backend.initialize():
                    raise AdapterExecutionError("Failed to initialize storage backend")

                # 初始化嵌入生成器
                embedding_config = {
                    "model_name": self.config.get("embedding_model", "all-MiniLM-L6-v2")
                }
                self.embedding_generator = EmbeddingGenerator(embedding_config)
                if not await self.embedding_generator.initialize():
                    raise AdapterExecutionError(
                        "Failed to initialize embedding generator"
                    )

                self._initialized = True
                logger.info("Knowledge base adapter initialized successfully")
                return True

        except Exception as e:
            logger.error(f"Failed to initialize knowledge base adapter: {e}")
            return False

    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理实现"""
        # 根据输入数据类型确定操作
        if isinstance(input_data, dict):
            operation = input_data.get("operation", "search")
            if operation == "search":
                query_text = input_data.get("query", "")
                from .knowledge_base import SearchQuery, SearchType
                query = SearchQuery(
                    query_text=query_text,
                    search_type=SearchType.SEMANTIC,
                    limit=input_data.get("limit", 10)
                )
                result = await self._search(query, context)
                return result.data if result.success else None
            elif operation == "add_document":
                doc_data = input_data.get("document", {})
                from .knowledge_base import Document, DocumentType
                document = Document(
                    id=doc_data.get("id", str(uuid.uuid4())),
                    title=doc_data.get("title", ""),
                    content=doc_data.get("content", ""),
                    doc_type=DocumentType.TEXT,
                    metadata=doc_data.get("metadata", {})
                )
                result = await self._add_document(document, context)
                return result.data if result.success else None
        
        return {"message": "No operation specified or unsupported operation"}

    async def _health_check_impl(self) -> Dict[str, Any]:
        """健康检查实现"""
        health_info = {
            "initialized": self._initialized,
            "storage_backend_available": self.storage_backend is not None,
            "embedding_generator_available": self.embedding_generator is not None,
            "document_count": 0,
            "cache_size": len(self._document_cache),
            "search_cache_size": len(self._search_cache)
        }
        
        if self.storage_backend:
            try:
                health_info["document_count"] = await self.storage_backend.get_document_count()
            except:
                health_info["storage_backend_healthy"] = False
        
        return health_info

    async def _cleanup_impl(self) -> bool:
        """清理实现"""
        try:
            with self._lock:
                # 清理缓存
                self._document_cache.clear()
                self._search_cache.clear()
                
                # 关闭存储后端
                if self.storage_backend:
                    await self.storage_backend.cleanup()
                    self.storage_backend = None
                
                # 清理嵌入生成器
                if self.embedding_generator:
                    await self.embedding_generator.cleanup()
                    self.embedding_generator = None
                
                self._initialized = False
                logger.info("Knowledge base adapter cleaned up successfully")
                return True
                
        except Exception as e:
            logger.error(f"Failed to cleanup knowledge base adapter: {e}")
            return False

    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取能力实现"""
        return [
            AdapterCapability.DATA_STORAGE,
            AdapterCapability.SEARCH,
            AdapterCapability.INDEXING,
            AdapterCapability.CACHING,
        ]

    def _load_metadata(self) -> AdapterMetadata:
        """加载元数据"""
        return self.metadata


def create_knowledge_base_adapter(
    config: Optional[Dict[str, Any]] = None
) -> KnowledgeBaseAdapter:
    """创建知识库适配器实例"""
    return KnowledgeBaseAdapter(config)


def get_default_config() -> Dict[str, Any]:
    """获取默认配置"""
    return {
        "storage_backend": "memory",
        "embedding_model": "all-MiniLM-L6-v2",
        "cache_max_size": 1000,
        "cache_ttl": 3600,
        "storage_path": "./knowledge_base",
    }


# ================================
# 安全和权限管理
# ================================


class SecurityManager:
    """安全管理器"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self._users: Dict[str, User] = {}
        self._permissions: Dict[str, Permission] = {}
        self._tokens: Dict[str, AccessToken] = {}
        self._audit_logs: List[AuditLog] = []
        self._session_timeout = self.config.get("session_timeout", 3600)  # 1小时
        self._max_login_attempts = self.config.get("max_login_attempts", 5)
        self._login_attempts: Dict[str, int] = {}

        # 初始化默认权限
        self._init_default_permissions()

        # 创建默认管理员用户
        if self.config.get("create_default_admin", True):
            self._create_default_admin()

    def _init_default_permissions(self):
        """初始化默认权限"""
        default_permissions = [
            Permission(
                name="document.read",
                description="读取文档",
                resource_type="document",
                actions={"read"},
            ),
            Permission(
                name="document.write",
                description="写入文档",
                resource_type="document",
                actions={"write", "create", "update"},
            ),
            Permission(
                name="document.delete",
                description="删除文档",
                resource_type="document",
                actions={"delete"},
            ),
            Permission(
                name="knowledge_base.admin",
                description="知识库管理",
                resource_type="knowledge_base",
                actions={"read", "write", "delete", "admin"},
            ),
        ]

        for perm in default_permissions:
            self._permissions[perm.name] = perm

    def _create_default_admin(self):
        """创建默认管理员用户"""
        admin_user = User(
            id="admin",
            username="admin",
            email="admin@example.com",
            full_name="Administrator",
            role="admin",
            is_admin=True,
            permissions=set(self._permissions.keys()),
        )
        self._users["admin"] = admin_user

    def create_user(
        self,
        username: str,
        email: str,
        full_name: str = "",
        role: str = "user",
        permissions: Set[str] = None,
    ) -> User:
        """创建用户"""
        if username in [u.username for u in self._users.values()]:
            raise ValueError(f"用户名 {username} 已存在")

        user = User(
            username=username,
            email=email,
            full_name=full_name,
            role=role,
            permissions=permissions or set(),
        )

        self._users[user.id] = user
        self._log_action("user.create", "user", user.id, user.id, success=True)
        return user

    def authenticate_user(
        self, username: str, password: str = None, token: str = None
    ) -> Optional[User]:
        """用户认证"""
        if token:
            return self._authenticate_by_token(token)
        elif username:
            return self._authenticate_by_username(username, password)
        return None

    def _authenticate_by_token(self, token: str) -> Optional[User]:
        """通过令牌认证"""
        access_token = self._tokens.get(token)
        if not access_token or access_token.is_expired:
            return None

        user = self._users.get(access_token.user_id)
        if user and user.is_active:
            user.last_login = datetime.now(timezone.utc)
            return user
        return None

    def _authenticate_by_username(self, username: str, password: str) -> Optional[User]:
        """通过用户名密码认证（简化版本）"""
        # 注意：这里只是示例，实际应该有密码哈希验证
        user = next((u for u in self._users.values() if u.username == username), None)
        if user and user.is_active:
            # 检查登录尝试次数
            if self._login_attempts.get(username, 0) >= self._max_login_attempts:
                self._log_action(
                    "user.login", "user", user.id, user.id, status="error", error="账户已锁定"
                )
                return None

            # 简化的密码验证（实际应该使用哈希）
            if password == "admin" or user.role == "admin":  # 临时验证
                user.last_login = datetime.now(timezone.utc)
                self._login_attempts.pop(username, None)  # 清除失败尝试
                self._log_action("user.login", "user", user.id, user.id, success=True)
                return user
            else:
                # 增加失败尝试次数
                self._login_attempts[username] = (
                    self._login_attempts.get(username, 0) + 1
                )
                self._log_action(
                    "user.login",
                    "user",
                    user.id if user else "",
                    "",
                    status="error",
                    error="密码错误",
                )
        return None

    def create_access_token(
        self, user_id: str, expires_in: int = None, scopes: Set[str] = None
    ) -> AccessToken:
        """创建访问令牌"""
        if expires_in is None:
            expires_in = self._session_timeout

        token = f"token_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        access_token = AccessToken(
            token=token, user_id=user_id, expires_at=expires_at, scopes=scopes or set()
        )

        self._tokens[token] = access_token
        self._log_action("token.create", "access_token", token, user_id, success=True)
        return access_token

    def revoke_token(self, token: str, user_id: str = "") -> bool:
        """撤销令牌"""
        if token in self._tokens:
            del self._tokens[token]
            self._log_action(
                "token.revoke", "access_token", token, user_id, success=True
            )
            return True
        return False

    def check_permission(
        self, user: User, action: str, resource_type: str = "*", resource_id: str = ""
    ) -> bool:
        """检查用户权限"""
        if not user.is_active:
            return False

        # 管理员拥有所有权限
        if user.is_admin:
            return True

        # 检查用户权限
        for perm_name in user.permissions:
            perm = self._permissions.get(perm_name)
            if not perm:
                continue

            # 检查资源类型匹配
            if perm.resource_type != "*" and perm.resource_type != resource_type:
                continue

            # 检查动作权限
            if action in perm.actions or "admin" in perm.actions:
                return True

        self._log_action(
            f"permission.check",
            resource_type,
            resource_id,
            user.id,
            status="error",
            error=f"权限不足: {action}",
        )
        return False

    def add_permission_to_user(self, user_id: str, permission_name: str) -> bool:
        """为用户添加权限"""
        user = self._users.get(user_id)
        if user and permission_name in self._permissions:
            user.permissions.add(permission_name)
            self._log_action("permission.grant", "user", user_id, user_id, success=True)
            return True
        return False

    def remove_permission_from_user(self, user_id: str, permission_name: str) -> bool:
        """从用户移除权限"""
        user = self._users.get(user_id)
        if user and permission_name in user.permissions:
            user.permissions.remove(permission_name)
            self._log_action(
                "permission.revoke", "user", user_id, user_id, success=True
            )
            return True
        return False

    def _log_action(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        user_id: str,
        success: bool = True,
        error: str = "",
        ip_address: str = "",
        user_agent: str = "",
        details: Dict[str, Any] = None,
    ):
        """记录审计日志"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            success=success,
            error_message=error,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
        )

        self._audit_logs.append(log)

        # 保持日志数量在合理范围内
        max_logs = self.config.get("max_audit_logs", 10000)
        if len(self._audit_logs) > max_logs:
            self._audit_logs = self._audit_logs[-max_logs:]

    def get_audit_logs(
        self,
        user_id: str = "",
        action: str = "",
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100,
    ) -> List[AuditLog]:
        """获取审计日志"""
        logs = self._audit_logs

        # 过滤条件
        if user_id:
            logs = [log for log in logs if log.user_id == user_id]
        if action:
            logs = [log for log in logs if log.action == action]
        if start_time:
            logs = [log for log in logs if log.timestamp >= start_time]
        if end_time:
            logs = [log for log in logs if log.timestamp <= end_time]

        # 按时间倒序排列并限制数量
        logs.sort(key=lambda x: x.timestamp, reverse=True)
        return logs[:limit]

    def cleanup_expired_tokens(self):
        """清理过期令牌"""
        expired_tokens = [
            token
            for token, access_token in self._tokens.items()
            if access_token.is_expired
        ]

        for token in expired_tokens:
            del self._tokens[token]

        if expired_tokens:
            self._log_action(
                "token.cleanup",
                "access_token",
                "",
                "system",
                status="success",
                details={"cleaned_count": len(expired_tokens)},
            )

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """根据ID获取用户"""
        return self._users.get(user_id)

    def get_user_by_username(self, username: str) -> Optional[User]:
        """根据用户名获取用户"""
        return next((u for u in self._users.values() if u.username == username), None)

    def list_users(self) -> List[User]:
        """列出所有用户"""
        return list(self._users.values())

    def list_permissions(self) -> List[Permission]:
        """列出所有权限"""
        return list(self._permissions.values())


# 导出主要类和函数
__all__ = [
    # 数据模型
    "DocumentType",
    "DocumentStatus",
    "SearchType",
    "Document",
    "SearchQuery",
    "SearchResult",
    "SearchResponse",
    # 权限和安全相关
    "User",
    "Permission",
    "AccessToken",
    "AuditLog",
    # 存储后端
    "StorageBackendBase",
    "MemoryStorageBackend",
    # 嵌入生成器
    "EmbeddingGenerator",
    # 安全管理
    "SecurityManager",
    # 主要适配器
    "KnowledgeBaseAdapter",
    # 工厂函数
    "create_knowledge_base_adapter",
    "get_default_config",
]

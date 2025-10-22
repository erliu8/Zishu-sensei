"""
OpenAI Embedding服务集成

提供文本向量化能力，支持：
- OpenAI Embedding API
- Azure OpenAI Embedding
- 批量处理
- 缓存机制
"""

import hashlib
import logging
import os
from typing import Any, Dict, List, Optional, Union
import asyncio

from openai import OpenAI, AsyncOpenAI, AzureOpenAI, AsyncAzureOpenAI
import yaml
import numpy as np


logger = logging.getLogger(__name__)


class EmbeddingService:
    """文本向量化服务"""
    
    def __init__(
        self,
        provider: str = "openai",
        api_key: Optional[str] = None,
        config_path: Optional[str] = None,
        cache_enabled: bool = True,
    ):
        """
        初始化Embedding服务
        
        Args:
            provider: 提供商 (openai, azure)
            api_key: API密钥
            config_path: 配置文件路径
            cache_enabled: 是否启用缓存
        """
        # 加载配置
        self.config = self._load_config(config_path)
        
        self.provider = provider
        self.cache_enabled = cache_enabled
        self._cache: Dict[str, List[float]] = {}
        
        # 初始化客户端
        if provider == "openai":
            self._init_openai_client(api_key)
        elif provider == "azure":
            self._init_azure_client(api_key)
        else:
            raise ValueError(f"不支持的提供商: {provider}")
        
        logger.info(f"Embedding服务已初始化: {provider}")
    
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
            logger.info(f"已加载Embedding配置: {config_path}")
            return config.get("embedding", {})
        except Exception as e:
            logger.warning(f"无法加载配置文件 {config_path}: {e}，使用默认配置")
            return self._default_config()
    
    def _default_config(self) -> Dict[str, Any]:
        """默认配置"""
        return {
            "provider": "openai",
            "openai": {
                "model": "text-embedding-ada-002",
                "api_base": "https://api.openai.com/v1",
                "max_retries": 3,
                "timeout": 30,
                "batch_size": 100,
            },
        }
    
    def _init_openai_client(self, api_key: Optional[str] = None):
        """初始化OpenAI客户端"""
        openai_config = self.config.get("openai", {})
        
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or openai_config.get("api_key")
        if not self.api_key:
            raise ValueError("未提供OpenAI API密钥")
        
        self.model = openai_config.get("model", "text-embedding-ada-002")
        self.batch_size = openai_config.get("batch_size", 100)
        
        # 同步客户端
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=openai_config.get("api_base"),
            timeout=openai_config.get("timeout", 30),
            max_retries=openai_config.get("max_retries", 3),
        )
        
        # 异步客户端
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=openai_config.get("api_base"),
            timeout=openai_config.get("timeout", 30),
            max_retries=openai_config.get("max_retries", 3),
        )
        
        logger.info(f"OpenAI客户端已初始化，模型: {self.model}")
    
    def _init_azure_client(self, api_key: Optional[str] = None):
        """初始化Azure OpenAI客户端"""
        azure_config = self.config.get("azure", {})
        
        self.api_key = api_key or os.getenv("AZURE_OPENAI_API_KEY") or azure_config.get("api_key")
        if not self.api_key:
            raise ValueError("未提供Azure OpenAI API密钥")
        
        api_base = os.getenv("AZURE_OPENAI_ENDPOINT") or azure_config.get("api_base")
        if not api_base:
            raise ValueError("未提供Azure OpenAI端点")
        
        self.model = azure_config.get("deployment_name") or azure_config.get("model")
        self.batch_size = azure_config.get("batch_size", 100)
        
        # 同步客户端
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=azure_config.get("api_version", "2023-05-15"),
            azure_endpoint=api_base,
        )
        
        # 异步客户端
        self.async_client = AsyncAzureOpenAI(
            api_key=self.api_key,
            api_version=azure_config.get("api_version", "2023-05-15"),
            azure_endpoint=api_base,
        )
        
        logger.info(f"Azure OpenAI客户端已初始化，部署: {self.model}")
    
    def _get_cache_key(self, text: str) -> str:
        """生成缓存键"""
        return hashlib.md5(f"{self.model}:{text}".encode()).hexdigest()
    
    def get_embedding(self, text: str, use_cache: bool = True) -> List[float]:
        """
        获取单个文本的向量
        
        Args:
            text: 输入文本
            use_cache: 是否使用缓存
        
        Returns:
            向量列表
        """
        if not text or not text.strip():
            logger.warning("输入文本为空")
            return []
        
        # 检查缓存
        if use_cache and self.cache_enabled:
            cache_key = self._get_cache_key(text)
            if cache_key in self._cache:
                logger.debug(f"从缓存获取向量: {text[:50]}...")
                return self._cache[cache_key]
        
        try:
            # 调用API
            response = self.client.embeddings.create(
                model=self.model,
                input=text,
            )
            
            embedding = response.data[0].embedding
            
            # 缓存结果
            if use_cache and self.cache_enabled:
                cache_key = self._get_cache_key(text)
                self._cache[cache_key] = embedding
            
            logger.debug(f"获取向量成功: {text[:50]}...")
            return embedding
            
        except Exception as e:
            logger.error(f"获取向量失败: {e}")
            return []
    
    def get_embeddings(
        self,
        texts: List[str],
        use_cache: bool = True,
        show_progress: bool = False,
    ) -> List[List[float]]:
        """
        批量获取文本向量
        
        Args:
            texts: 文本列表
            use_cache: 是否使用缓存
            show_progress: 是否显示进度
        
        Returns:
            向量列表
        """
        if not texts:
            return []
        
        embeddings = []
        texts_to_process = []
        indices_to_process = []
        
        # 检查缓存
        for i, text in enumerate(texts):
            if not text or not text.strip():
                embeddings.append([])
                continue
            
            if use_cache and self.cache_enabled:
                cache_key = self._get_cache_key(text)
                if cache_key in self._cache:
                    embeddings.append(self._cache[cache_key])
                    continue
            
            # 需要处理的文本
            embeddings.append(None)  # 占位
            texts_to_process.append(text)
            indices_to_process.append(i)
        
        # 批量处理未缓存的文本
        if texts_to_process:
            logger.info(f"需要处理 {len(texts_to_process)} 个文本（总共 {len(texts)} 个）")
            
            # 分批处理
            for batch_start in range(0, len(texts_to_process), self.batch_size):
                batch_end = min(batch_start + self.batch_size, len(texts_to_process))
                batch_texts = texts_to_process[batch_start:batch_end]
                batch_indices = indices_to_process[batch_start:batch_end]
                
                try:
                    # 调用API
                    response = self.client.embeddings.create(
                        model=self.model,
                        input=batch_texts,
                    )
                    
                    # 处理结果
                    for i, data in enumerate(response.data):
                        embedding = data.embedding
                        original_index = batch_indices[i]
                        embeddings[original_index] = embedding
                        
                        # 缓存
                        if use_cache and self.cache_enabled:
                            cache_key = self._get_cache_key(batch_texts[i])
                            self._cache[cache_key] = embedding
                    
                    if show_progress:
                        progress = min(batch_end, len(texts_to_process))
                        logger.info(f"进度: {progress}/{len(texts_to_process)}")
                    
                except Exception as e:
                    logger.error(f"批量获取向量失败（批次 {batch_start}-{batch_end}）: {e}")
                    # 填充空向量
                    for idx in batch_indices:
                        if embeddings[idx] is None:
                            embeddings[idx] = []
        
        logger.info(f"批量向量化完成，成功: {sum(1 for e in embeddings if e)}/{len(embeddings)}")
        return embeddings
    
    async def aget_embedding(self, text: str, use_cache: bool = True) -> List[float]:
        """
        异步获取单个文本的向量
        
        Args:
            text: 输入文本
            use_cache: 是否使用缓存
        
        Returns:
            向量列表
        """
        if not text or not text.strip():
            logger.warning("输入文本为空")
            return []
        
        # 检查缓存
        if use_cache and self.cache_enabled:
            cache_key = self._get_cache_key(text)
            if cache_key in self._cache:
                logger.debug(f"从缓存获取向量: {text[:50]}...")
                return self._cache[cache_key]
        
        try:
            # 调用API
            response = await self.async_client.embeddings.create(
                model=self.model,
                input=text,
            )
            
            embedding = response.data[0].embedding
            
            # 缓存结果
            if use_cache and self.cache_enabled:
                cache_key = self._get_cache_key(text)
                self._cache[cache_key] = embedding
            
            logger.debug(f"获取向量成功: {text[:50]}...")
            return embedding
            
        except Exception as e:
            logger.error(f"获取向量失败: {e}")
            return []
    
    async def aget_embeddings(
        self,
        texts: List[str],
        use_cache: bool = True,
        show_progress: bool = False,
    ) -> List[List[float]]:
        """
        异步批量获取文本向量
        
        Args:
            texts: 文本列表
            use_cache: 是否使用缓存
            show_progress: 是否显示进度
        
        Returns:
            向量列表
        """
        if not texts:
            return []
        
        embeddings = []
        texts_to_process = []
        indices_to_process = []
        
        # 检查缓存
        for i, text in enumerate(texts):
            if not text or not text.strip():
                embeddings.append([])
                continue
            
            if use_cache and self.cache_enabled:
                cache_key = self._get_cache_key(text)
                if cache_key in self._cache:
                    embeddings.append(self._cache[cache_key])
                    continue
            
            # 需要处理的文本
            embeddings.append(None)  # 占位
            texts_to_process.append(text)
            indices_to_process.append(i)
        
        # 批量处理未缓存的文本
        if texts_to_process:
            logger.info(f"需要处理 {len(texts_to_process)} 个文本（总共 {len(texts)} 个）")
            
            # 分批处理
            for batch_start in range(0, len(texts_to_process), self.batch_size):
                batch_end = min(batch_start + self.batch_size, len(texts_to_process))
                batch_texts = texts_to_process[batch_start:batch_end]
                batch_indices = indices_to_process[batch_start:batch_end]
                
                try:
                    # 调用API
                    response = await self.async_client.embeddings.create(
                        model=self.model,
                        input=batch_texts,
                    )
                    
                    # 处理结果
                    for i, data in enumerate(response.data):
                        embedding = data.embedding
                        original_index = batch_indices[i]
                        embeddings[original_index] = embedding
                        
                        # 缓存
                        if use_cache and self.cache_enabled:
                            cache_key = self._get_cache_key(batch_texts[i])
                            self._cache[cache_key] = embedding
                    
                    if show_progress:
                        progress = min(batch_end, len(texts_to_process))
                        logger.info(f"进度: {progress}/{len(texts_to_process)}")
                    
                except Exception as e:
                    logger.error(f"批量获取向量失败（批次 {batch_start}-{batch_end}）: {e}")
                    # 填充空向量
                    for idx in batch_indices:
                        if embeddings[idx] is None:
                            embeddings[idx] = []
        
        logger.info(f"批量向量化完成，成功: {sum(1 for e in embeddings if e)}/{len(embeddings)}")
        return embeddings
    
    def clear_cache(self):
        """清除缓存"""
        self._cache.clear()
        logger.info("Embedding缓存已清除")
    
    def get_cache_size(self) -> int:
        """获取缓存大小"""
        return len(self._cache)
    
    def get_vector_dimension(self) -> int:
        """获取向量维度"""
        # text-embedding-ada-002 的维度是 1536
        if "ada-002" in self.model:
            return 1536
        # text-embedding-3-small 的维度是 1536
        elif "3-small" in self.model:
            return 1536
        # text-embedding-3-large 的维度是 3072
        elif "3-large" in self.model:
            return 3072
        else:
            # 默认返回1536
            return 1536
    
    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """
        计算余弦相似度
        
        Args:
            vec1: 向量1
            vec2: 向量2
        
        Returns:
            相似度分数 (0-1)
        """
        if not vec1 or not vec2:
            return 0.0
        
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))


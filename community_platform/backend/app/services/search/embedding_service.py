"""
文本嵌入服务

使用 sentence-transformers 将文本转换为向量
支持中英文语义理解
"""
import asyncio
from typing import List, Optional
from functools import lru_cache
import numpy as np


class EmbeddingService:
    """文本嵌入服务"""
    
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        """
        初始化嵌入服务
        
        Args:
            model_name: 使用的模型名称
                - paraphrase-multilingual-MiniLM-L12-v2: 多语言模型，384维，支持中英文
                - distiluse-base-multilingual-cased-v1: 多语言模型，512维
                - all-MiniLM-L6-v2: 英文模型，384维，速度快
        """
        self.model_name = model_name
        self._model = None
        self._vector_size = None
    
    def _load_model(self):
        """延迟加载模型（避免在导入时加载）"""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                # 获取向量维度
                test_vector = self._model.encode(["test"], convert_to_numpy=True)
                self._vector_size = test_vector.shape[1]
                print(f"✅ 加载嵌入模型: {self.model_name} (维度: {self._vector_size})")
            except ImportError:
                raise ImportError(
                    "请安装 sentence-transformers: pip install sentence-transformers"
                )
            except Exception as e:
                print(f"❌ 加载嵌入模型失败: {e}")
                raise
        return self._model
    
    @property
    def vector_size(self) -> int:
        """获取向量维度"""
        if self._vector_size is None:
            self._load_model()
        return self._vector_size
    
    async def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
    ) -> List[List[float]]:
        """
        将文本转换为向量（异步）
        
        Args:
            texts: 文本列表
            batch_size: 批处理大小
            normalize: 是否归一化向量
        
        Returns:
            向量列表
        """
        if not texts:
            return []
        
        # 在线程池中运行，避免阻塞事件循环
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._encode_sync,
            texts,
            batch_size,
            normalize,
        )
    
    def _encode_sync(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
    ) -> List[List[float]]:
        """
        将文本转换为向量（同步）
        
        Args:
            texts: 文本列表
            batch_size: 批处理大小
            normalize: 是否归一化向量
        
        Returns:
            向量列表
        """
        model = self._load_model()
        
        # 编码文本
        vectors = model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=normalize,
            show_progress_bar=False,
        )
        
        # 转换为列表格式
        return vectors.tolist()
    
    async def encode_single(self, text: str, normalize: bool = True) -> List[float]:
        """
        将单个文本转换为向量
        
        Args:
            text: 文本
            normalize: 是否归一化向量
        
        Returns:
            向量
        """
        vectors = await self.encode([text], normalize=normalize)
        return vectors[0] if vectors else []
    
    async def encode_post(self, title: str, content: str, tags: Optional[List[str]] = None) -> List[float]:
        """
        为帖子生成向量
        
        组合标题、内容和标签，生成更全面的语义向量
        
        Args:
            title: 标题
            content: 内容
            tags: 标签列表
        
        Returns:
            向量
        """
        # 组合文本，标题权重更高
        text_parts = [
            f"标题: {title}",
            f"内容: {content[:500]}"  # 限制内容长度，避免过长
        ]
        
        if tags:
            text_parts.append(f"标签: {', '.join(tags)}")
        
        combined_text = "\n".join(text_parts)
        return await self.encode_single(combined_text)
    
    def calculate_similarity(
        self,
        vector1: List[float],
        vector2: List[float],
    ) -> float:
        """
        计算两个向量的余弦相似度
        
        Args:
            vector1: 向量1
            vector2: 向量2
        
        Returns:
            相似度分数 (0-1)
        """
        v1 = np.array(vector1)
        v2 = np.array(vector2)
        
        # 计算余弦相似度
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return float(similarity)


# 创建全局嵌入服务实例
@lru_cache()
def get_embedding_service() -> EmbeddingService:
    """获取嵌入服务实例（单例）"""
    return EmbeddingService()


# 便捷函数
async def embed_text(text: str) -> List[float]:
    """将文本转换为向量"""
    service = get_embedding_service()
    return await service.encode_single(text)


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """批量将文本转换为向量"""
    service = get_embedding_service()
    return await service.encode(texts)


async def embed_post(title: str, content: str, tags: Optional[List[str]] = None) -> List[float]:
    """为帖子生成向量"""
    service = get_embedding_service()
    return await service.encode_post(title, content, tags)


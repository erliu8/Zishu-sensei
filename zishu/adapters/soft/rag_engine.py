# -*- coding: utf-8 -*-
"""
RAG（检索增强生成）引擎
集成检索、排序、生成等功能，提供企业级RAG解决方案
"""

import os
import asyncio
import hashlib
import threading
import time
import json
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Union,
    Tuple,
    Set,
    Callable,
    Type,
    NamedTuple,
)
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import weakref
import uuid
import logging

# 第三方库导入
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
    from sentence_transformers import SentenceTransformer

    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)

# 项目内部导入
from ..utils.cache import CacheManager
from ..utils.performance import PerformanceMonitor
from .knowledge_base import KnowledgeBase, KnowledgeItem
from .prompt_engine import PromptEngine


# ================================
# 核心枚举和数据结构定义
# ================================


class RAGMode(Enum):
    """RAG模式枚举"""

    NAIVE = "naive"  # 简单RAG
    ADAPTIVE = "adaptive"  # 自适应RAG
    ITERATIVE = "iterative"  # 迭代RAG
    MULTI_HOP = "multi_hop"  # 多跳RAG
    HIERARCHICAL = "hierarchical"  # 分层RAG
    HYBRID = "hybrid"  # 混合RAG


class RetrievalStrategy(Enum):
    """检索策略枚举"""

    SIMILARITY = "similarity"  # 相似度检索
    KEYWORD = "keyword"  # 关键词检索
    SEMANTIC = "semantic"  # 语义检索
    HYBRID_SEARCH = "hybrid_search"  # 混合检索
    GRAPH_SEARCH = "graph_search"  # 图检索
    QUERY_EXPANSION = "query_expansion"  # 查询扩展


class RankingMethod(Enum):
    """排序方法枚举"""

    COSINE_SIMILARITY = "cosine_similarity"
    BM25 = "bm25"
    CROSS_ENCODER = "cross_encoder"
    RECIPROCAL_RANK_FUSION = "rrf"
    HYBRID_RANKING = "hybrid_ranking"
    LEARNING_TO_RANK = "ltr"


class GenerationMode(Enum):
    """生成模式枚举"""

    EXTRACTIVE = "extractive"  # 抽取式
    ABSTRACTIVE = "abstractive"  # 抽象式
    HYBRID_GEN = "hybrid_gen"  # 混合生成
    CHAIN_OF_THOUGHT = "cot"  # 思维链
    SELF_CONSISTENCY = "self_consistency"  # 自一致性


class RAGQuality(Enum):
    """RAG质量级别"""

    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


@dataclass
class RetrievalConfig:
    """检索配置"""

    top_k: int = 10
    min_similarity: float = 0.3
    strategy: RetrievalStrategy = RetrievalStrategy.SIMILARITY
    enable_query_expansion: bool = False
    expansion_terms: int = 3
    enable_reranking: bool = True
    ranking_method: RankingMethod = RankingMethod.COSINE_SIMILARITY
    enable_filtering: bool = True
    filter_threshold: float = 0.2


@dataclass
class GenerationConfig:
    """生成配置"""

    mode: GenerationMode = GenerationMode.ABSTRACTIVE
    max_length: int = 512
    temperature: float = 0.7
    top_p: float = 0.9
    enable_citation: bool = True
    citation_format: str = "[{source}]"
    enable_fact_checking: bool = False
    quality_threshold: float = 0.8


@dataclass
class RAGConfig:
    """RAG整体配置"""

    mode: RAGMode = RAGMode.ADAPTIVE
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
    generation: GenerationConfig = field(default_factory=GenerationConfig)
    enable_caching: bool = True
    cache_ttl: int = 3600
    enable_monitoring: bool = True
    batch_size: int = 32
    max_retries: int = 3


class RetrievalResult(NamedTuple):
    """检索结果"""

    item: KnowledgeItem
    score: float
    rank: int
    metadata: Dict[str, Any]


class RAGResult(NamedTuple):
    """RAG最终结果"""

    response: str
    sources: List[RetrievalResult]
    confidence: float
    metadata: Dict[str, Any]
    processing_time: float


# ================================
# 核心接口定义
# ================================


class Retriever(ABC):
    """检索器抽象基类"""

    @abstractmethod
    async def retrieve(
        self, query: str, config: RetrievalConfig
    ) -> List[RetrievalResult]:
        """执行检索"""
        pass

    @abstractmethod
    async def expand_query(self, query: str) -> List[str]:
        """查询扩展"""
        pass


class Reranker(ABC):
    """重排序器抽象基类"""

    @abstractmethod
    async def rerank(
        self, query: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """重新排序检索结果"""
        pass


class Generator(ABC):
    """生成器抽象基类"""

    @abstractmethod
    async def generate(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成回答"""
        pass


# ================================
# 具体实现类
# ================================


class SimilarityRetriever(Retriever):
    """基于相似度的检索器"""

    def __init__(
        self, knowledge_base: KnowledgeBase, embedding_model: Optional[str] = None
    ):
        self.knowledge_base = knowledge_base
        self.embedding_model = embedding_model
        self._encoder = None

        # 初始化嵌入模型
        if SENTENCE_TRANSFORMERS_AVAILABLE and embedding_model:
            try:
                self._encoder = SentenceTransformer(embedding_model)
            except Exception as e:
                logger.warning(f"无法加载嵌入模型 {embedding_model}: {e}")

    async def retrieve(
        self, query: str, config: RetrievalConfig
    ) -> List[RetrievalResult]:
        """基于相似度检索"""
        try:
            # 获取查询嵌入
            query_embedding = await self._get_embedding(query)

            # 从知识库检索
            similar_items = await self.knowledge_base.similarity_search(
                query_embedding=query_embedding,
                top_k=config.top_k,
                threshold=config.min_similarity,
            )

            # 转换为检索结果
            results = []
            for idx, (item, score) in enumerate(similar_items):
                result = RetrievalResult(
                    item=item,
                    score=score,
                    rank=idx + 1,
                    metadata={
                        "retrieval_method": "similarity",
                        "embedding_model": self.embedding_model,
                        "timestamp": datetime.now().isoformat(),
                    },
                )
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"检索失败: {e}")
            return []

    async def expand_query(self, query: str) -> List[str]:
        """简单的查询扩展"""
        # 这里可以实现更复杂的查询扩展逻辑
        expanded = [query]

        # 添加同义词或相关词
        # 这是一个简化的实现，实际可以使用词向量或语言模型
        if "?" in query:
            expanded.append(query.replace("?", ""))

        return expanded

    async def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """获取文本嵌入"""
        if self._encoder:
            try:
                embedding = self._encoder.encode([text])
                return embedding[0]
            except Exception as e:
                logger.warning(f"获取嵌入失败: {e}")
        return None


class CosineSimilarityReranker(Reranker):
    """余弦相似度重排序器"""

    async def rerank(
        self, query: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """基于余弦相似度重新排序"""
        if not SKLEARN_AVAILABLE or len(results) <= 1:
            return results

        try:
            # 提取文本内容
            texts = [result.item.content for result in results]

            # 使用TF-IDF向量化
            vectorizer = TfidfVectorizer(stop_words="english", max_features=1000)
            tfidf_matrix = vectorizer.fit_transform([query] + texts)

            # 计算相似度
            similarities = cosine_similarity(
                tfidf_matrix[0:1], tfidf_matrix[1:]
            ).flatten()

            # 重新排序
            reranked_results = []
            for idx, (result, sim_score) in enumerate(zip(results, similarities)):
                new_result = RetrievalResult(
                    item=result.item,
                    score=sim_score,
                    rank=idx + 1,
                    metadata={**result.metadata, "rerank_method": "cosine_similarity"},
                )
                reranked_results.append(new_result)

            # 按分数排序
            reranked_results.sort(key=lambda x: x.score, reverse=True)

            # 更新排名
            for idx, result in enumerate(reranked_results):
                reranked_results[idx] = result._replace(rank=idx + 1)

            return reranked_results

        except Exception as e:
            logger.error(f"重排序失败: {e}")
            return results


class PromptBasedGenerator(Generator):
    """基于提示的生成器"""

    def __init__(self, prompt_engine: PromptEngine):
        self.prompt_engine = prompt_engine

    async def generate(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成基于上下文的回答"""
        try:
            # 构建上下文
            context_text = self._build_context(context, config)

            # 构建提示模板
            template_vars = {
                "query": query,
                "context": context_text,
                "max_length": config.max_length,
                "enable_citation": config.enable_citation,
            }

            # 使用提示引擎生成回答
            prompt = await self.prompt_engine.render_template(
                template_name="rag_generation", variables=template_vars
            )

            # 这里应该调用实际的语言模型
            # 暂时返回一个模拟的回答
            response = f"基于提供的上下文，{query} 的答案是：{context_text[:200]}..."

            # 添加引用
            if config.enable_citation:
                citations = self._generate_citations(context, config)
                response += f"\n\n引用来源：{citations}"

            return response

        except Exception as e:
            logger.error(f"生成回答失败: {e}")
            return "抱歉，无法生成合适的回答。"

    def _build_context(
        self, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """构建上下文文本"""
        context_parts = []
        for result in context:
            part = f"[来源: {result.item.source}] {result.item.content}"
            context_parts.append(part)

        return "\n\n".join(context_parts)

    def _generate_citations(
        self, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成引用"""
        citations = []
        for result in context:
            citation = config.citation_format.format(source=result.item.source)
            citations.append(citation)

        return ", ".join(citations)


# ================================
# 主要RAG引擎类 - 第一部分完成
# ================================


class RAGEngine:
    """RAG引擎主类"""

    def __init__(
        self,
        knowledge_base: KnowledgeBase,
        prompt_engine: PromptEngine,
        config: Optional[RAGConfig] = None,
        cache_manager: Optional[CacheManager] = None,
        performance_monitor: Optional[PerformanceMonitor] = None,
    ):
        """
        初始化RAG引擎

        Args:
            knowledge_base: 知识库实例
            prompt_engine: 提示引擎实例
            config: RAG配置
            cache_manager: 缓存管理器
            performance_monitor: 性能监控器
        """
        self.knowledge_base = knowledge_base
        self.prompt_engine = prompt_engine
        self.config = config or RAGConfig()
        self.cache_manager = cache_manager
        self.performance_monitor = performance_monitor

        # 初始化组件
        self.retriever = SimilarityRetriever(knowledge_base)
        self.reranker = CosineSimilarityReranker()
        self.generator = PromptBasedGenerator(prompt_engine)

        # 统计信息
        self.stats = {
            "total_queries": 0,
            "cache_hits": 0,
            "avg_response_time": 0.0,
            "last_updated": datetime.now(),
        }

        logger.info("RAG引擎初始化完成")

    async def query(self, question: str, **kwargs) -> RAGResult:
        """
        主查询接口

        Args:
            question: 用户问题
            **kwargs: 额外参数

        Returns:
            RAGResult: RAG结果
        """
        start_time = time.time()

        try:
            # 性能监控开始
            if self.performance_monitor:
                await self.performance_monitor.start_operation("rag_query")

            # 检查缓存
            cache_key = self._generate_cache_key(question, kwargs)
            if self.config.enable_caching and self.cache_manager:
                cached_result = await self._get_from_cache(cache_key)
                if cached_result:
                    self.stats["cache_hits"] += 1
                    logger.info(f"缓存命中: {question[:50]}...")
                    return cached_result

            # 执行RAG流程
            result = await self._execute_rag_pipeline(question, **kwargs)

            # 更新统计信息
            processing_time = time.time() - start_time
            self._update_stats(processing_time)

            # 缓存结果
            if self.config.enable_caching and self.cache_manager:
                await self._cache_result(cache_key, result)

            # 性能监控结束
            if self.performance_monitor:
                await self.performance_monitor.end_operation(
                    "rag_query", {"processing_time": processing_time}
                )

            logger.info(f"RAG查询完成，耗时: {processing_time:.3f}s")
            return result

        except Exception as e:
            logger.error(f"RAG查询失败: {e}", exc_info=True)
            processing_time = time.time() - start_time

            # 返回错误结果
            return RAGResult(
                response="抱歉，处理您的问题时出现错误。",
                sources=[],
                confidence=0.0,
                metadata={"error": str(e), "processing_time": processing_time},
                processing_time=processing_time,
            )

    async def _execute_rag_pipeline(self, question: str, **kwargs) -> RAGResult:
        """执行RAG处理流程"""
        # 第一阶段：检索
        retrieval_results = await self._retrieve_phase(question)

        # 第二阶段：重排序
        if self.config.retrieval.enable_reranking and len(retrieval_results) > 1:
            retrieval_results = await self._rerank_phase(question, retrieval_results)

        # 第三阶段：生成回答
        response = await self._generation_phase(question, retrieval_results)

        # 第四阶段：质量评估
        confidence = await self._evaluate_quality(question, response, retrieval_results)

        # 构建最终结果
        result = RAGResult(
            response=response,
            sources=retrieval_results,
            confidence=confidence,
            metadata={
                "mode": self.config.mode.value,
                "retrieval_count": len(retrieval_results),
                "timestamp": datetime.now().isoformat(),
            },
            processing_time=0.0,  # 将在外层更新
        )

        return result

    async def _retrieve_phase(self, question: str) -> List[RetrievalResult]:
        """检索阶段"""
        try:
            # 查询扩展
            queries = [question]
            if self.config.retrieval.enable_query_expansion:
                expanded_queries = await self.retriever.expand_query(question)
                queries.extend(
                    expanded_queries[: self.config.retrieval.expansion_terms]
                )

            # 对每个查询执行检索
            all_results = []
            for query in queries:
                results = await self.retriever.retrieve(query, self.config.retrieval)
                all_results.extend(results)

            # 去重和合并
            unique_results = self._merge_retrieval_results(all_results)

            # 过滤低质量结果
            if self.config.retrieval.enable_filtering:
                unique_results = self._filter_results(unique_results)

            # 截取top-k
            return unique_results[: self.config.retrieval.top_k]

        except Exception as e:
            logger.error(f"检索阶段失败: {e}")
            return []

    async def _rerank_phase(
        self, question: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """重排序阶段"""
        try:
            return await self.reranker.rerank(question, results)
        except Exception as e:
            logger.error(f"重排序失败: {e}")
            return results

    async def _generation_phase(
        self, question: str, context: List[RetrievalResult]
    ) -> str:
        """生成阶段"""
        try:
            return await self.generator.generate(
                question, context, self.config.generation
            )
        except Exception as e:
            logger.error(f"生成阶段失败: {e}")
            return "抱歉，无法生成合适的回答。"

    async def _evaluate_quality(
        self, question: str, response: str, sources: List[RetrievalResult]
    ) -> float:
        """评估回答质量"""
        # 简单的质量评估逻辑
        confidence = 0.5  # 基础置信度

        # 根据检索结果数量调整
        if sources:
            confidence += min(len(sources) * 0.1, 0.3)

        # 根据最高相似度分数调整
        if sources:
            max_score = max(result.score for result in sources)
            confidence += max_score * 0.2

        # 根据回答长度调整（过短或过长都不好）
        response_length = len(response)
        if 50 <= response_length <= 500:
            confidence += 0.1

        return min(confidence, 1.0)

    def _merge_retrieval_results(
        self, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """合并和去重检索结果"""
        seen_ids = set()
        unique_results = []

        for result in results:
            if result.item.id not in seen_ids:
                seen_ids.add(result.item.id)
                unique_results.append(result)

        # 按分数排序
        unique_results.sort(key=lambda x: x.score, reverse=True)

        # 重新编号
        for idx, result in enumerate(unique_results):
            unique_results[idx] = result._replace(rank=idx + 1)

        return unique_results

    def _filter_results(self, results: List[RetrievalResult]) -> List[RetrievalResult]:
        """过滤低质量结果"""
        threshold = self.config.retrieval.filter_threshold
        return [r for r in results if r.score >= threshold]

    def _generate_cache_key(self, question: str, kwargs: Dict[str, Any]) -> str:
        """生成缓存键"""
        key_data = {
            "question": question,
            "config": self.config.__dict__,
            "kwargs": kwargs,
        }
        key_str = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(key_str.encode()).hexdigest()

    async def _get_from_cache(self, cache_key: str) -> Optional[RAGResult]:
        """从缓存获取结果"""
        try:
            cached = await self.cache_manager.get(cache_key)
            if cached:
                return cached
        except Exception as e:
            logger.warning(f"缓存获取失败: {e}")
        return None

    async def _cache_result(self, cache_key: str, result: RAGResult) -> None:
        """缓存结果"""
        try:
            await self.cache_manager.set(cache_key, result, ttl=self.config.cache_ttl)
        except Exception as e:
            logger.warning(f"缓存存储失败: {e}")

    def _update_stats(self, processing_time: float) -> None:
        """更新统计信息"""
        self.stats["total_queries"] += 1

        # 计算平均响应时间
        total = self.stats["total_queries"]
        current_avg = self.stats["avg_response_time"]
        self.stats["avg_response_time"] = (
            current_avg * (total - 1) + processing_time
        ) / total

        self.stats["last_updated"] = datetime.now()

    # 批量查询接口
    async def batch_query(self, questions: List[str], **kwargs) -> List[RAGResult]:
        """批量查询接口"""
        batch_size = self.config.batch_size
        results = []

        for i in range(0, len(questions), batch_size):
            batch = questions[i : i + batch_size]
            batch_tasks = [self.query(q, **kwargs) for q in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            # 处理异常
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    error_result = RAGResult(
                        response="批量处理时出现错误",
                        sources=[],
                        confidence=0.0,
                        metadata={"error": str(result), "batch_index": i + j},
                        processing_time=0.0,
                    )
                    results.append(error_result)
                else:
                    results.append(result)

        return results

    # 流式查询接口（逐步返回结果）
    async def stream_query(self, question: str, **kwargs):
        """流式查询，逐步返回结果"""
        # 第一步：返回检索进度
        yield {"stage": "retrieval", "status": "started"}

        retrieval_results = await self._retrieve_phase(question)
        yield {
            "stage": "retrieval",
            "status": "completed",
            "results_count": len(retrieval_results),
        }

        # 第二步：重排序
        if self.config.retrieval.enable_reranking and len(retrieval_results) > 1:
            yield {"stage": "reranking", "status": "started"}
            retrieval_results = await self._rerank_phase(question, retrieval_results)
            yield {"stage": "reranking", "status": "completed"}

        # 第三步：生成
        yield {"stage": "generation", "status": "started"}
        response = await self._generation_phase(question, retrieval_results)

        # 第四步：返回最终结果
        confidence = await self._evaluate_quality(question, response, retrieval_results)

        final_result = RAGResult(
            response=response,
            sources=retrieval_results,
            confidence=confidence,
            metadata={
                "mode": self.config.mode.value,
                "timestamp": datetime.now().isoformat(),
            },
            processing_time=0.0,
        )

        yield {"stage": "completed", "status": "finished", "result": final_result}

    # 配置管理
    async def update_config(self, new_config: RAGConfig) -> None:
        """更新配置"""
        self.config = new_config
        logger.info("RAG引擎配置已更新")

    def get_config(self) -> RAGConfig:
        """获取当前配置"""
        return self.config

    # 统计信息接口
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.stats.copy()

    def reset_stats(self) -> None:
        """重置统计信息"""
        self.stats = {
            "total_queries": 0,
            "cache_hits": 0,
            "avg_response_time": 0.0,
            "last_updated": datetime.now(),
        }


# ================================
# 高级排序和重排序实现
# ================================


class BM25Reranker(Reranker):
    """BM25重排序器"""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._corpus_stats = None

    async def rerank(
        self, query: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """基于BM25算法重新排序"""
        if len(results) <= 1:
            return results

        try:
            # 提取文档内容
            docs = [result.item.content for result in results]

            # 计算BM25分数
            bm25_scores = self._calculate_bm25_scores(query, docs)

            # 重新排序
            reranked_results = []
            for idx, (result, score) in enumerate(zip(results, bm25_scores)):
                new_result = RetrievalResult(
                    item=result.item,
                    score=score,
                    rank=idx + 1,
                    metadata={**result.metadata, "rerank_method": "bm25"},
                )
                reranked_results.append(new_result)

            # 按分数排序
            reranked_results.sort(key=lambda x: x.score, reverse=True)

            # 更新排名
            for idx, result in enumerate(reranked_results):
                reranked_results[idx] = result._replace(rank=idx + 1)

            return reranked_results

        except Exception as e:
            logger.error(f"BM25重排序失败: {e}")
            return results

    def _calculate_bm25_scores(self, query: str, docs: List[str]) -> List[float]:
        """计算BM25分数"""
        if not SKLEARN_AVAILABLE:
            return [1.0] * len(docs)

        # 简单的分词（实际应用中应该使用更好的分词器）
        query_terms = query.lower().split()

        # 文档统计
        doc_lengths = [len(doc.split()) for doc in docs]
        avg_doc_length = sum(doc_lengths) / len(doc_lengths) if doc_lengths else 0

        scores = []
        for doc_idx, doc in enumerate(docs):
            doc_terms = doc.lower().split()
            doc_length = doc_lengths[doc_idx]

            score = 0.0
            for term in query_terms:
                # 词频
                tf = doc_terms.count(term)
                if tf > 0:
                    # 文档频率
                    df = sum(1 for d in docs if term in d.lower())
                    idf = (
                        np.log((len(docs) - df + 0.5) / (df + 0.5))
                        if NUMPY_AVAILABLE
                        else 1.0
                    )

                    # BM25计算
                    score += (
                        idf
                        * (tf * (self.k1 + 1))
                        / (
                            tf
                            + self.k1
                            * (1 - self.b + self.b * doc_length / avg_doc_length)
                        )
                    )

            scores.append(score)

        return scores


class HybridReranker(Reranker):
    """混合重排序器，结合多种排序方法"""

    def __init__(
        self, rerankers: List[Reranker], weights: Optional[List[float]] = None
    ):
        self.rerankers = rerankers
        self.weights = weights or [1.0] * len(rerankers)

        if len(self.weights) != len(self.rerankers):
            raise ValueError("权重数量必须与重排序器数量一致")

    async def rerank(
        self, query: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """混合重排序"""
        if len(results) <= 1:
            return results

        try:
            # 获取所有重排序器的结果
            all_rankings = []
            for reranker in self.rerankers:
                ranking = await reranker.rerank(query, results)
                all_rankings.append(ranking)

            # 计算加权平均分数
            combined_scores = defaultdict(float)
            for ranking, weight in zip(all_rankings, self.weights):
                for result in ranking:
                    combined_scores[result.item.id] += result.score * weight

            # 构建最终结果
            final_results = []
            for result in results:
                avg_score = combined_scores[result.item.id] / sum(self.weights)
                new_result = RetrievalResult(
                    item=result.item,
                    score=avg_score,
                    rank=0,  # 临时设置
                    metadata={**result.metadata, "rerank_method": "hybrid"},
                )
                final_results.append(new_result)

            # 按分数排序并更新排名
            final_results.sort(key=lambda x: x.score, reverse=True)
            for idx, result in enumerate(final_results):
                final_results[idx] = result._replace(rank=idx + 1)

            return final_results

        except Exception as e:
            logger.error(f"混合重排序失败: {e}")
            return results


class ReciprocalRankFusionReranker(Reranker):
    """互易排名融合重排序器"""

    def __init__(self, k: int = 60):
        self.k = k

    async def rerank(
        self, query: str, results: List[RetrievalResult]
    ) -> List[RetrievalResult]:
        """RRF重排序"""
        if len(results) <= 1:
            return results

        try:
            # 按原始分数排序
            sorted_results = sorted(results, key=lambda x: x.score, reverse=True)

            # 计算RRF分数
            rrf_scores = {}
            for rank, result in enumerate(sorted_results, 1):
                rrf_scores[result.item.id] = 1.0 / (self.k + rank)

            # 构建新的结果
            reranked_results = []
            for result in results:
                new_result = RetrievalResult(
                    item=result.item,
                    score=rrf_scores[result.item.id],
                    rank=0,  # 临时设置
                    metadata={**result.metadata, "rerank_method": "rrf"},
                )
                reranked_results.append(new_result)

            # 按RRF分数排序
            reranked_results.sort(key=lambda x: x.score, reverse=True)

            # 更新排名
            for idx, result in enumerate(reranked_results):
                reranked_results[idx] = result._replace(rank=idx + 1)

            return reranked_results

        except Exception as e:
            logger.error(f"RRF重排序失败: {e}")
            return results


# ================================
# 高级生成器实现
# ================================


class ChainOfThoughtGenerator(Generator):
    """思维链生成器"""

    def __init__(self, prompt_engine: PromptEngine):
        self.prompt_engine = prompt_engine

    async def generate(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """基于思维链的生成"""
        try:
            # 第一步：分析问题
            analysis_prompt = await self._build_analysis_prompt(query, context)
            analysis = await self._call_llm(analysis_prompt, max_length=200)

            # 第二步：逐步推理
            reasoning_prompt = await self._build_reasoning_prompt(
                query, context, analysis
            )
            reasoning = await self._call_llm(reasoning_prompt, max_length=400)

            # 第三步：生成最终答案
            answer_prompt = await self._build_answer_prompt(
                query, context, analysis, reasoning
            )
            final_answer = await self._call_llm(
                answer_prompt, max_length=config.max_length
            )

            # 组合完整回答
            if config.enable_citation:
                citations = self._generate_citations(context, config)
                full_response = (
                    f"{final_answer}\n\n思考过程：\n{reasoning}\n\n引用来源：{citations}"
                )
            else:
                full_response = final_answer

            return full_response

        except Exception as e:
            logger.error(f"思维链生成失败: {e}")
            return "抱歉，生成过程中出现错误。"

    async def _build_analysis_prompt(
        self, query: str, context: List[RetrievalResult]
    ) -> str:
        """构建问题分析提示"""
        context_text = "\n".join(
            [f"{i+1}. {r.item.content[:200]}..." for i, r in enumerate(context[:3])]
        )

        return f"""
分析以下问题和相关上下文：

问题：{query}

相关信息：
{context_text}

请简要分析这个问题的关键点和需要回答的核心内容：
"""

    async def _build_reasoning_prompt(
        self, query: str, context: List[RetrievalResult], analysis: str
    ) -> str:
        """构建推理提示"""
        context_text = self._build_context_text(context)

        return f"""
基于以下信息进行逐步推理：

问题：{query}
分析：{analysis}

上下文信息：
{context_text}

请逐步推理，说明如何从提供的信息中得出答案：
"""

    async def _build_answer_prompt(
        self, query: str, context: List[RetrievalResult], analysis: str, reasoning: str
    ) -> str:
        """构建最终答案提示"""
        return f"""
基于前面的分析和推理，请给出问题的完整答案：

问题：{query}
分析：{analysis}
推理过程：{reasoning}

最终答案：
"""

    def _build_context_text(self, context: List[RetrievalResult]) -> str:
        """构建上下文文本"""
        context_parts = []
        for i, result in enumerate(context, 1):
            part = f"{i}. [来源: {result.item.source}]\n{result.item.content}\n"
            context_parts.append(part)
        return "\n".join(context_parts)

    def _generate_citations(
        self, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成引用"""
        citations = []
        for i, result in enumerate(context, 1):
            citation = f"[{i}] {result.item.source}"
            citations.append(citation)
        return ", ".join(citations)

    async def _call_llm(self, prompt: str, max_length: int) -> str:
        """调用语言模型（模拟实现）"""
        # 这里应该调用实际的语言模型API
        # 暂时返回模拟响应
        return f"基于提示的模拟回答（长度限制：{max_length}）"


class HybridGenerator(Generator):
    """混合生成器，结合抽取和生成"""

    def __init__(self, prompt_engine: PromptEngine, extract_ratio: float = 0.3):
        self.prompt_engine = prompt_engine
        self.extract_ratio = extract_ratio

    async def generate(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """混合生成方式"""
        try:
            # 抽取式部分：直接从上下文中提取相关片段
            extracted_parts = await self._extract_relevant_parts(query, context)

            # 生成式部分：基于上下文生成新内容
            generated_part = await self._generate_new_content(query, context, config)

            # 合并结果
            if extracted_parts and generated_part:
                combined_response = f"{generated_part}\n\n相关信息：\n{extracted_parts}"
            elif extracted_parts:
                combined_response = extracted_parts
            else:
                combined_response = generated_part or "无法生成合适的回答。"

            # 添加引用
            if config.enable_citation:
                citations = self._generate_citations(context, config)
                combined_response += f"\n\n引用来源：{citations}"

            return combined_response

        except Exception as e:
            logger.error(f"混合生成失败: {e}")
            return "抱歉，生成过程中出现错误。"

    async def _extract_relevant_parts(
        self, query: str, context: List[RetrievalResult]
    ) -> str:
        """抽取相关部分"""
        if not context:
            return ""

        # 简单的抽取逻辑：选择最相关的片段
        query_terms = set(query.lower().split())

        relevant_parts = []
        for result in context:
            content = result.item.content
            content_terms = set(content.lower().split())

            # 计算重叠度
            overlap = len(query_terms & content_terms)
            if overlap > 0:
                # 提取包含查询词的句子
                sentences = content.split("。")
                for sentence in sentences:
                    if any(term in sentence.lower() for term in query_terms):
                        relevant_parts.append(f"• {sentence.strip()}")
                        break

        return "\n".join(relevant_parts[:5])  # 限制数量

    async def _generate_new_content(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成新内容"""
        context_text = "\n".join([f"- {r.item.content[:150]}..." for r in context[:3]])

        # 构建生成提示
        prompt = f"""
基于以下信息回答问题：

问题：{query}

相关信息：
{context_text}

请生成一个综合性的回答（{config.max_length}字以内）：
"""

        # 模拟LLM调用
        return await self._call_llm(prompt, config.max_length)

    async def _call_llm(self, prompt: str, max_length: int) -> str:
        """调用语言模型"""
        # 模拟实现
        return f"基于上下文的综合回答（最大长度：{max_length}字）"

    def _generate_citations(
        self, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成引用"""
        citations = []
        for result in context:
            citation = config.citation_format.format(source=result.item.source)
            citations.append(citation)
        return ", ".join(citations[:5])


class FactCheckingGenerator(Generator):
    """事实核查生成器"""

    def __init__(self, prompt_engine: PromptEngine, knowledge_base: KnowledgeBase):
        self.prompt_engine = prompt_engine
        self.knowledge_base = knowledge_base
        self.fact_cache = {}

    async def generate(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """带事实核查的生成"""
        try:
            # 第一步：生成初始回答
            initial_response = await self._generate_initial_response(
                query, context, config
            )

            # 第二步：提取声明进行事实核查
            if config.enable_fact_checking:
                fact_check_result = await self._fact_check_response(
                    initial_response, query
                )

                if fact_check_result["confidence"] < config.quality_threshold:
                    # 重新生成更保守的回答
                    conservative_response = await self._generate_conservative_response(
                        query, context, fact_check_result["issues"]
                    )
                    return conservative_response

            return initial_response

        except Exception as e:
            logger.error(f"事实核查生成失败: {e}")
            return "抱歉，生成过程中出现错误。"

    async def _generate_initial_response(
        self, query: str, context: List[RetrievalResult], config: GenerationConfig
    ) -> str:
        """生成初始回答"""
        context_text = self._build_context_text(context)

        prompt = f"""
基于以下可靠信息回答问题：

问题：{query}

信息来源：
{context_text}

要求：
- 答案要基于提供的信息
- 避免过度推测
- 如果信息不足，要明确说明
- 最大长度：{config.max_length}字

回答：
"""

        return await self._call_llm(prompt, config.max_length)

    async def _fact_check_response(self, response: str, query: str) -> Dict[str, Any]:
        """对回答进行事实核查"""
        # 简化的事实核查逻辑
        issues = []
        confidence = 1.0

        # 检查是否包含不确定性词汇
        uncertainty_markers = ["可能", "也许", "大概", "应该", "据说"]
        uncertainty_count = sum(
            1 for marker in uncertainty_markers if marker in response
        )

        if uncertainty_count > 0:
            confidence -= uncertainty_count * 0.1
            issues.append(f"包含{uncertainty_count}个不确定性表述")

        # 检查回答长度是否合理
        if len(response) < 20:
            confidence -= 0.2
            issues.append("回答过于简短")
        elif len(response) > 1000:
            confidence -= 0.1
            issues.append("回答过于冗长")

        return {"confidence": max(confidence, 0.0), "issues": issues}

    async def _generate_conservative_response(
        self, query: str, context: List[RetrievalResult], issues: List[str]
    ) -> str:
        """生成保守的回答"""
        context_text = self._build_context_text(context)

        prompt = f"""
基于以下信息谨慎回答问题（发现的问题：{', '.join(issues)}）：

问题：{query}

可用信息：
{context_text}

请提供一个保守、准确的回答，如果信息不足请明确说明：
"""

        return await self._call_llm(prompt, 300)

    def _build_context_text(self, context: List[RetrievalResult]) -> str:
        """构建上下文文本"""
        context_parts = []
        for i, result in enumerate(context, 1):
            part = f"{i}. 来源：{result.item.source}\n   内容：{result.item.content}\n"
            context_parts.append(part)
        return "\n".join(context_parts)

    async def _call_llm(self, prompt: str, max_length: int) -> str:
        """调用语言模型"""
        # 模拟实现
        return f"经过事实核查的保守回答（最大长度：{max_length}字）"


# ================================
# RAG引擎工厂和管理器
# ================================


class RAGEngineFactory:
    """RAG引擎工厂类"""

    @staticmethod
    def create_engine(
        engine_type: str,
        knowledge_base: KnowledgeBase,
        prompt_engine: PromptEngine,
        config: Optional[RAGConfig] = None,
        **kwargs,
    ) -> RAGEngine:
        """创建RAG引擎实例"""

        if config is None:
            config = RAGConfig()

        # 根据类型选择组件
        if engine_type == "basic":
            retriever = SimilarityRetriever(knowledge_base)
            reranker = CosineSimilarityReranker()
            generator = PromptBasedGenerator(prompt_engine)

        elif engine_type == "advanced":
            # 混合检索器
            similarity_retriever = SimilarityRetriever(knowledge_base)
            keyword_retriever = KeywordRetriever(knowledge_base)
            retriever = HybridRetriever([similarity_retriever, keyword_retriever])

            # 混合重排序器
            cosine_reranker = CosineSimilarityReranker()
            bm25_reranker = BM25Reranker()
            reranker = HybridReranker([cosine_reranker, bm25_reranker], [0.6, 0.4])

            # 思维链生成器
            generator = ChainOfThoughtGenerator(prompt_engine)

        elif engine_type == "enterprise":
            # 企业级配置
            similarity_retriever = SimilarityRetriever(knowledge_base)
            keyword_retriever = KeywordRetriever(knowledge_base)
            retriever = HybridRetriever([similarity_retriever, keyword_retriever])

            # RRF重排序
            reranker = ReciprocalRankFusionReranker()

            # 事实核查生成器
            generator = FactCheckingGenerator(prompt_engine, knowledge_base)

        else:
            raise ValueError(f"不支持的引擎类型: {engine_type}")

        # 创建引擎
        engine = RAGEngine(
            knowledge_base=knowledge_base,
            prompt_engine=prompt_engine,
            config=config,
            **kwargs,
        )

        # 设置组件
        engine.retriever = retriever
        engine.reranker = reranker
        engine.generator = generator

        return engine


class KeywordRetriever(Retriever):
    """基于关键词的检索器实现"""

    def __init__(self, knowledge_base: KnowledgeBase):
        self.knowledge_base = knowledge_base

    async def retrieve(
        self, query: str, config: RetrievalConfig
    ) -> List[RetrievalResult]:
        """关键词检索实现"""
        try:
            # 简化实现，实际应该调用知识库的关键词检索方法
            keywords = self._extract_keywords(query)
            results = []

            # 这里是模拟实现
            for i in range(min(config.top_k, 3)):
                # 创建模拟的知识项
                from .knowledge_base import KnowledgeItem

                item = KnowledgeItem(
                    id=f"keyword_{i}",
                    content=f"基于关键词'{', '.join(keywords)}'找到的相关内容 {i+1}",
                    source=f"keyword_source_{i}",
                    metadata={},
                )

                result = RetrievalResult(
                    item=item,
                    score=0.8 - i * 0.1,
                    rank=i + 1,
                    metadata={"retrieval_method": "keyword", "keywords": keywords},
                )
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"关键词检索失败: {e}")
            return []

    async def expand_query(self, query: str) -> List[str]:
        """关键词查询扩展"""
        return [query]  # 简化实现

    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词"""
        # 简单的关键词提取
        words = text.lower().split()
        # 过滤停用词
        stopwords = {"的", "是", "在", "有", "和", "或", "但是", "如果", "那么"}
        keywords = [word for word in words if word not in stopwords and len(word) > 1]
        return keywords[:5]


# ================================
# 性能优化和监控组件
# ================================


class RAGPerformanceOptimizer:
    """RAG性能优化器"""

    def __init__(self, rag_engine: RAGEngine):
        self.rag_engine = rag_engine
        self.query_cache = {}
        self.performance_history = deque(maxlen=1000)
        self.optimization_rules = []

    async def optimize_query(self, query: str, **kwargs) -> RAGResult:
        """优化查询执行"""
        # 记录开始时间
        start_time = time.time()

        try:
            # 预处理优化
            optimized_query = await self._preprocess_query(query)

            # 智能缓存检查
            cache_result = await self._smart_cache_lookup(optimized_query, kwargs)
            if cache_result:
                return cache_result

            # 动态配置调整
            optimized_config = await self._adjust_config_for_query(optimized_query)

            # 执行查询
            result = await self.rag_engine.query(optimized_query, **kwargs)

            # 记录性能数据
            execution_time = time.time() - start_time
            await self._record_performance(query, result, execution_time)

            # 缓存结果
            await self._smart_cache_store(optimized_query, result, kwargs)

            return result

        except Exception as e:
            logger.error(f"优化查询失败: {e}")
            return await self.rag_engine.query(query, **kwargs)

    async def _preprocess_query(self, query: str) -> str:
        """预处理查询"""
        # 清理和标准化查询
        cleaned_query = query.strip()

        # 去除重复空格
        import re

        cleaned_query = re.sub(r"\s+", " ", cleaned_query)

        # 简单的同义词替换
        synonyms = {"怎么": "如何", "什么是": "什么", "怎样": "如何"}

        for original, replacement in synonyms.items():
            if original in cleaned_query:
                cleaned_query = cleaned_query.replace(original, replacement)

        return cleaned_query

    async def _smart_cache_lookup(
        self, query: str, kwargs: Dict[str, Any]
    ) -> Optional[RAGResult]:
        """智能缓存查找"""
        if not self.rag_engine.config.enable_caching:
            return None

        # 生成缓存键
        cache_key = self._generate_cache_key(query, kwargs)

        # 查找完全匹配
        if cache_key in self.query_cache:
            cached_result, timestamp = self.query_cache[cache_key]

            # 检查是否过期
            if time.time() - timestamp < self.rag_engine.config.cache_ttl:
                logger.info(f"缓存命中: {query[:30]}...")
                return cached_result
            else:
                # 删除过期缓存
                del self.query_cache[cache_key]

        # 查找相似查询
        similar_result = await self._find_similar_cached_query(query)
        if similar_result:
            return similar_result

        return None

    async def _find_similar_cached_query(self, query: str) -> Optional[RAGResult]:
        """查找相似的缓存查询"""
        query_words = set(query.lower().split())
        best_match = None
        best_similarity = 0.0

        for cache_key, (cached_result, timestamp) in self.query_cache.items():
            # 检查是否过期
            if time.time() - timestamp >= self.rag_engine.config.cache_ttl:
                continue

            # 从缓存键解析查询（简化实现）
            try:
                cached_query_data = json.loads(cache_key)
                cached_query = cached_query_data.get("question", "")
                cached_words = set(cached_query.lower().split())

                # 计算相似度
                if cached_words and query_words:
                    intersection = len(query_words & cached_words)
                    union = len(query_words | cached_words)
                    similarity = intersection / union

                    # 如果相似度足够高，使用缓存结果
                    if similarity > 0.8 and similarity > best_similarity:
                        best_similarity = similarity
                        best_match = cached_result

            except Exception:
                continue

        if best_match and best_similarity > 0.8:
            logger.info(f"找到相似缓存查询，相似度: {best_similarity:.3f}")
            return best_match

        return None

    async def _adjust_config_for_query(self, query: str) -> RAGConfig:
        """根据查询动态调整配置"""
        config = self.rag_engine.config

        # 根据查询长度调整
        query_length = len(query)
        if query_length > 200:  # 长查询
            config.retrieval.top_k = min(config.retrieval.top_k + 5, 20)
            config.generation.max_length = min(config.generation.max_length + 100, 800)
        elif query_length < 20:  # 短查询
            config.retrieval.top_k = max(config.retrieval.top_k - 3, 5)
            config.generation.max_length = max(config.generation.max_length - 100, 200)

        # 根据查询类型调整
        if "?" in query or "如何" in query or "怎么" in query:  # 问答类型
            config.retrieval.enable_query_expansion = True
            config.generation.mode = GenerationMode.CHAIN_OF_THOUGHT
        elif "列举" in query or "有哪些" in query:  # 列举类型
            config.retrieval.top_k = min(config.retrieval.top_k * 2, 30)
            config.generation.mode = GenerationMode.EXTRACTIVE

        return config

    async def _record_performance(
        self, query: str, result: RAGResult, execution_time: float
    ):
        """记录性能数据"""
        performance_data = {
            "query": query[:50] + "..." if len(query) > 50 else query,
            "execution_time": execution_time,
            "confidence": result.confidence,
            "sources_count": len(result.sources),
            "response_length": len(result.response),
            "timestamp": datetime.now().isoformat(),
        }

        self.performance_history.append(performance_data)

        # 检查是否需要优化建议
        if execution_time > 5.0:  # 超过5秒
            logger.warning(f"查询执行时间过长: {execution_time:.2f}s - {query[:30]}...")

        if result.confidence < 0.5:  # 置信度过低
            logger.warning(f"查询置信度过低: {result.confidence:.2f} - {query[:30]}...")

    async def _smart_cache_store(
        self, query: str, result: RAGResult, kwargs: Dict[str, Any]
    ):
        """智能缓存存储"""
        if not self.rag_engine.config.enable_caching:
            return

        # 只缓存高质量结果
        if result.confidence >= 0.6 and len(result.sources) > 0:
            cache_key = self._generate_cache_key(query, kwargs)
            self.query_cache[cache_key] = (result, time.time())

            # 限制缓存大小
            if len(self.query_cache) > 1000:
                # 删除最旧的缓存项
                oldest_key = min(
                    self.query_cache.keys(), key=lambda k: self.query_cache[k][1]
                )
                del self.query_cache[oldest_key]

    def _generate_cache_key(self, query: str, kwargs: Dict[str, Any]) -> str:
        """生成缓存键"""
        cache_data = {
            "question": query,
            "kwargs": sorted(kwargs.items()),
            "config_hash": hash(str(self.rag_engine.config.__dict__)),
        }
        return json.dumps(cache_data, sort_keys=True, ensure_ascii=False)

    def get_performance_stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        if not self.performance_history:
            return {}

        execution_times = [p["execution_time"] for p in self.performance_history]
        confidences = [p["confidence"] for p in self.performance_history]

        return {
            "total_queries": len(self.performance_history),
            "avg_execution_time": sum(execution_times) / len(execution_times),
            "max_execution_time": max(execution_times),
            "min_execution_time": min(execution_times),
            "avg_confidence": sum(confidences) / len(confidences),
            "cache_hit_rate": len(self.query_cache)
            / max(len(self.performance_history), 1),
            "last_updated": datetime.now().isoformat(),
        }


# ================================
# 高级混合检索器实现
# ================================


class HybridRetriever(Retriever):
    """混合检索器，结合多种检索策略"""

    def __init__(self, retrievers: List[Retriever], fusion_method: str = "rrf"):
        self.retrievers = retrievers
        self.fusion_method = fusion_method

    async def retrieve(
        self, query: str, config: RetrievalConfig
    ) -> List[RetrievalResult]:
        """混合检索"""
        try:
            # 从所有检索器获取结果
            all_results = []
            retrieval_tasks = [
                retriever.retrieve(query, config) for retriever in self.retrievers
            ]

            retriever_results = await asyncio.gather(
                *retrieval_tasks, return_exceptions=True
            )

            # 处理结果
            for results in retriever_results:
                if not isinstance(results, Exception):
                    all_results.extend(results)

            # 融合结果
            if self.fusion_method == "rrf":
                return await self._rrf_fusion(all_results, config.top_k)
            elif self.fusion_method == "score_avg":
                return await self._score_average_fusion(all_results, config.top_k)
            else:
                return await self._simple_fusion(all_results, config.top_k)

        except Exception as e:
            logger.error(f"混合检索失败: {e}")
            return []

    async def expand_query(self, query: str) -> List[str]:
        """查询扩展，使用所有检索器的扩展结果"""
        all_expansions = set([query])

        for retriever in self.retrievers:
            try:
                expansions = await retriever.expand_query(query)
                all_expansions.update(expansions)
            except Exception as e:
                logger.warning(f"查询扩展失败: {e}")

        return list(all_expansions)

    async def _rrf_fusion(
        self, results: List[RetrievalResult], top_k: int
    ) -> List[RetrievalResult]:
        """RRF融合"""
        # 按检索器分组
        retriever_groups = defaultdict(list)
        for result in results:
            retriever_name = result.metadata.get("retrieval_method", "unknown")
            retriever_groups[retriever_name].append(result)

        # 计算RRF分数
        rrf_scores = defaultdict(float)
        k = 60

        for group_results in retriever_groups.values():
            sorted_results = sorted(group_results, key=lambda x: x.score, reverse=True)
            for rank, result in enumerate(sorted_results, 1):
                rrf_scores[result.item.id] += 1.0 / (k + rank)

        # 去重并创建最终结果
        unique_results = {}
        for result in results:
            item_id = result.item.id
            if item_id not in unique_results:
                unique_results[item_id] = RetrievalResult(
                    item=result.item,
                    score=rrf_scores[item_id],
                    rank=0,
                    metadata={**result.metadata, "fusion_method": "rrf"},
                )

        # 排序并截取
        final_results = list(unique_results.values())
        final_results.sort(key=lambda x: x.score, reverse=True)

        # 更新排名
        for idx, result in enumerate(final_results[:top_k]):
            final_results[idx] = result._replace(rank=idx + 1)

        return final_results[:top_k]

    async def _score_average_fusion(
        self, results: List[RetrievalResult], top_k: int
    ) -> List[RetrievalResult]:
        """分数平均融合"""
        # 按项目ID分组
        score_groups = defaultdict(list)
        item_map = {}

        for result in results:
            score_groups[result.item.id].append(result.score)
            item_map[result.item.id] = result.item

        # 计算平均分数
        averaged_results = []
        for item_id, scores in score_groups.items():
            avg_score = sum(scores) / len(scores)
            result = RetrievalResult(
                item=item_map[item_id],
                score=avg_score,
                rank=0,
                metadata={"fusion_method": "score_average"},
            )
            averaged_results.append(result)

        # 排序并更新排名
        averaged_results.sort(key=lambda x: x.score, reverse=True)
        for idx, result in enumerate(averaged_results[:top_k]):
            averaged_results[idx] = result._replace(rank=idx + 1)

        return averaged_results[:top_k]

    async def _simple_fusion(
        self, results: List[RetrievalResult], top_k: int
    ) -> List[RetrievalResult]:
        """简单融合，去重并按原始分数排序"""
        # 去重
        unique_results = {}
        for result in results:
            item_id = result.item.id
            if (
                item_id not in unique_results
                or result.score > unique_results[item_id].score
            ):
                unique_results[item_id] = result

        # 排序
        final_results = list(unique_results.values())
        final_results.sort(key=lambda x: x.score, reverse=True)

        # 更新排名
        for idx, result in enumerate(final_results[:top_k]):
            final_results[idx] = result._replace(rank=idx + 1)

        return final_results[:top_k]


# ================================
# 辅助工具和实用方法
# ================================


class RAGUtils:
    """RAG工具类"""

    @staticmethod
    def create_default_config(mode: RAGMode = RAGMode.ADAPTIVE) -> RAGConfig:
        """创建默认配置"""
        return RAGConfig(
            mode=mode,
            retrieval=RetrievalConfig(
                top_k=10,
                min_similarity=0.3,
                strategy=RetrievalStrategy.HYBRID_SEARCH,
                enable_query_expansion=True,
                enable_reranking=True,
                ranking_method=RankingMethod.HYBRID_RANKING,
            ),
            generation=GenerationConfig(
                mode=GenerationMode.ABSTRACTIVE,
                max_length=512,
                enable_citation=True,
                enable_fact_checking=True,
            ),
            enable_caching=True,
            enable_monitoring=True,
        )

    @staticmethod
    def validate_config(config: RAGConfig) -> List[str]:
        """验证配置"""
        issues = []

        # 检查检索配置
        if config.retrieval.top_k <= 0:
            issues.append("retrieval.top_k 必须大于 0")

        if not (0.0 <= config.retrieval.min_similarity <= 1.0):
            issues.append("retrieval.min_similarity 必须在 0.0 到 1.0 之间")

        # 检查生成配置
        if config.generation.max_length <= 0:
            issues.append("generation.max_length 必须大于 0")

        if not (0.0 <= config.generation.temperature <= 2.0):
            issues.append("generation.temperature 必须在 0.0 到 2.0 之间")

        # 检查缓存配置
        if config.cache_ttl <= 0:
            issues.append("cache_ttl 必须大于 0")

        return issues

    @staticmethod
    def calculate_retrieval_metrics(
        results: List[RetrievalResult], ground_truth: List[str]
    ) -> Dict[str, float]:
        """计算检索指标"""
        if not results or not ground_truth:
            return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

        retrieved_ids = set(result.item.id for result in results)
        ground_truth_set = set(ground_truth)

        # 计算精确率、召回率和F1分数
        true_positives = len(retrieved_ids & ground_truth_set)
        precision = true_positives / len(retrieved_ids) if retrieved_ids else 0.0
        recall = true_positives / len(ground_truth_set) if ground_truth_set else 0.0
        f1 = (
            (2 * precision * recall) / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )

        return {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "true_positives": true_positives,
            "retrieved_count": len(retrieved_ids),
            "ground_truth_count": len(ground_truth_set),
        }

    @staticmethod
    def format_rag_result(result: RAGResult, include_sources: bool = True) -> str:
        """格式化RAG结果为可读文本"""
        formatted = f"回答：{result.response}\n"
        formatted += f"置信度：{result.confidence:.2f}\n"
        formatted += f"处理时间：{result.processing_time:.3f}秒\n"

        if include_sources and result.sources:
            formatted += f"\n检索到的相关信息（{len(result.sources)}条）：\n"
            for i, source in enumerate(result.sources, 1):
                formatted += f"{i}. [{source.item.source}] (相关度: {source.score:.3f})\n"
                formatted += f"   {source.item.content[:100]}...\n"

        return formatted

    @staticmethod
    def export_rag_results(
        results: List[RAGResult], filepath: str, format: str = "json"
    ) -> None:
        """导出RAG结果"""
        if format.lower() == "json":
            with open(filepath, "w", encoding="utf-8") as f:
                # 转换为可序列化格式
                serializable_results = []
                for result in results:
                    serializable_result = {
                        "response": result.response,
                        "confidence": result.confidence,
                        "processing_time": result.processing_time,
                        "metadata": result.metadata,
                        "sources": [
                            {
                                "id": source.item.id,
                                "content": source.item.content,
                                "source": source.item.source,
                                "score": source.score,
                                "rank": source.rank,
                                "metadata": source.metadata,
                            }
                            for source in result.sources
                        ],
                    }
                    serializable_results.append(serializable_result)

                json.dump(serializable_results, f, ensure_ascii=False, indent=2)

        elif format.lower() == "csv":
            import csv

            with open(filepath, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                # 写入表头
                writer.writerow(
                    ["Response", "Confidence", "Processing Time", "Sources Count"]
                )

                # 写入数据
                for result in results:
                    writer.writerow(
                        [
                            result.response[:200] + "..."
                            if len(result.response) > 200
                            else result.response,
                            f"{result.confidence:.3f}",
                            f"{result.processing_time:.3f}",
                            len(result.sources),
                        ]
                    )

        else:
            raise ValueError(f"不支持的导出格式: {format}")


# ================================
# 主要导出接口
# ================================

__all__ = [
    # 核心类
    "RAGEngine",
    "RAGConfig",
    "RetrievalConfig",
    "GenerationConfig",
    "RAGResult",
    "RetrievalResult",
    # 枚举
    "RAGMode",
    "RetrievalStrategy",
    "RankingMethod",
    "GenerationMode",
    # 检索器
    "Retriever",
    "SimilarityRetriever",
    "HybridRetriever",
    "KeywordRetriever",
    # 重排序器
    "Reranker",
    "CosineSimilarityReranker",
    "BM25Reranker",
    "HybridReranker",
    "ReciprocalRankFusionReranker",
    # 生成器
    "Generator",
    "PromptBasedGenerator",
    "ChainOfThoughtGenerator",
    "HybridGenerator",
    "FactCheckingGenerator",
    # 工厂和工具
    "RAGEngineFactory",
    "RAGPerformanceOptimizer",
    "RAGUtils",
]

# -*- coding: utf-8 -*-
"""
软适配器基类
"""

import os
import asyncio
import threading
import time
import uuid
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Type, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
import json
import logging
import weakref
from pathlib import Path

# 项目内部导入
from ..base import (
    BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult,
    AdapterMetadata, AdapterType, AdapterStatus, AdapterCapability,
    SecurityLevel, AdapterConfigurationError, AdapterLoadingError,
    AdapterExecutionError, SoftAdapterError, RAGEngineError,
    PromptTemplateError, KnowledgeBaseError, RetrievalFailedError
)

# 软适配器组件导入
try:
    from .knowledge_base import KnowledgeBaseAdapter, SearchResponse, Document
    KNOWLEDGE_BASE_AVAILABLE = True
except ImportError:
    KNOWLEDGE_BASE_AVAILABLE = False
    # 创建占位符类
    class KnowledgeBaseAdapter:
        def __init__(self, *args, **kwargs): pass
    class SearchResponse:
        def __init__(self, *args, **kwargs): pass
    class Document:
        def __init__(self, *args, **kwargs): pass

try:
    from .rag_engine import RAGEngine, RAGResult, RAGConfig, RAGMode
    RAG_ENGINE_AVAILABLE = True
except ImportError:
    RAG_ENGINE_AVAILABLE = False
    # 创建占位符类
    class RAGEngine:
        def __init__(self, *args, **kwargs): pass
    class RAGResult:
        def __init__(self, *args, **kwargs): pass
    class RAGConfig:
        def __init__(self, *args, **kwargs): pass
    class RAGMode(Enum):
        BASIC = "basic"

try:
    from .prompt_engine import DynamicPromptEngine, TemplateRenderResult
    PROMPT_ENGINE_AVAILABLE = True
except ImportError:
    PROMPT_ENGINE_AVAILABLE = False
    # 创建占位符类
    class DynamicPromptEngine:
        def __init__(self, *args, **kwargs): pass
    class TemplateRenderResult:
        def __init__(self, *args, **kwargs): pass

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# ================================
# 软适配器专用数据结构
# ================================

class SoftAdapterMode(Enum):
    """软适配器工作模式"""
    KNOWLEDGE_QUERY = "knowledge_query"        # 知识库查询模式
    RAG_GENERATION = "rag_generation"          # RAG生成模式
    PROMPT_RENDERING = "prompt_rendering"      # 提示渲染模式
    HYBRID_PROCESSING = "hybrid_processing"    # 混合处理模式
    CONVERSATION = "conversation"              # 对话模式
    DOCUMENT_ANALYSIS = "document_analysis"    # 文档分析模式


class ContentType(Enum):
    """内容类型"""
    TEXT = "text"
    JSON = "json"  
    MARKDOWN = "markdown"
    HTML = "html"
    XML = "xml"
    BINARY = "binary"


@dataclass
class SoftAdapterRequest:
    """软适配器请求对象"""
    query: str                                    # 用户查询/请求
    mode: SoftAdapterMode = SoftAdapterMode.RAG_GENERATION  # 处理模式
    context: Dict[str, Any] = field(default_factory=dict)   # 上下文信息
    options: Dict[str, Any] = field(default_factory=dict)   # 处理选项
    content_type: ContentType = ContentType.TEXT  # 内容类型
    max_tokens: Optional[int] = None              # 最大令牌数
    temperature: float = 0.7                      # 生成温度
    top_k: int = 10                              # 检索数量
    metadata: Dict[str, Any] = field(default_factory=dict)  # 元数据


@dataclass  
class SoftAdapterResponse:
    """软适配器响应对象"""
    content: str                                  # 响应内容
    confidence: float = 0.0                       # 置信度
    sources: List[Dict[str, Any]] = field(default_factory=list)  # 数据源
    processing_time: float = 0.0                 # 处理时间
    mode: Optional[SoftAdapterMode] = None        # 使用的模式
    tokens_used: int = 0                         # 使用的令牌数
    metadata: Dict[str, Any] = field(default_factory=dict)  # 响应元数据
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "content": self.content,
            "confidence": self.confidence,
            "sources": self.sources,
            "processing_time": self.processing_time,
            "mode": self.mode.value if self.mode else None,
            "tokens_used": self.tokens_used,
            "metadata": self.metadata
        }


@dataclass
class ComponentStatus:
    """组件状态信息"""
    name: str                                     # 组件名称
    is_available: bool                           # 是否可用
    is_initialized: bool = False                 # 是否已初始化
    error_message: Optional[str] = None          # 错误消息
    last_check: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    performance_metrics: Dict[str, Any] = field(default_factory=dict)


# ================================
# 软适配器基类
# ================================

class SoftAdapter(BaseAdapter):
    """
    软适配器基类
    
    这是所有基于AI技术的软适配器的基础类，提供：
    1. 知识库管理和智能检索
    2. RAG增强的生成能力  
    3. 动态提示模板系统
    4. 多模态内容处理
    5. 自适应性能优化
    
    设计特点：
    - 组件化架构：松耦合的可插拔组件
    - 异步优先：所有核心操作支持异步
    - 配置驱动：通过配置控制行为
    - 可观测性：完整的监控和日志
    - 可扩展性：支持自定义组件和插件
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化软适配器
        
        Args:
            config: 配置字典，必须包含适配器配置信息
        
        配置示例：
        ```python
        config = {
            "adapter_type": "soft",
            "name": "my_soft_adapter",
            "knowledge_base": {
                "storage_backend": "memory",
                "embedding_model": "all-MiniLM-L6-v2"
            },
            "rag_engine": {
                "mode": "hybrid",
                "max_context_length": 4000
            },
            "prompt_engine": {
                "template_dir": "./templates",
                "enable_caching": True
            }
        }
        ```
        """
        # 验证和设置必要配置
        if "adapter_type" not in config:
            config["adapter_type"] = AdapterType.SOFT.value
        
        super().__init__(config)
        
        # 组件状态跟踪
        self._component_status: Dict[str, ComponentStatus] = {}
        self._components_lock = threading.RLock()
        
        # 核心组件实例
        self.knowledge_base: Optional[KnowledgeBaseAdapter] = None
        self.rag_engine: Optional[RAGEngine] = None  
        self.prompt_engine: Optional[DynamicPromptEngine] = None
        
        # 处理统计
        self._processing_stats = {
            "requests_processed": 0,
            "total_processing_time": 0.0,
            "avg_processing_time": 0.0,
            "error_count": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "last_reset": datetime.now(timezone.utc)
        }
        self._stats_lock = threading.RLock()
        
        # 缓存系统
        self._response_cache: Dict[str, Tuple[SoftAdapterResponse, datetime]] = {}
        self._cache_ttl = config.get("cache_ttl", 3600)  # 1小时
        self._cache_max_size = config.get("cache_max_size", 1000)
        
        # 性能优化配置
        self._enable_caching = config.get("enable_caching", True)
        self._enable_async_processing = config.get("enable_async_processing", True)
        self._max_concurrent_requests = config.get("max_concurrent_requests", 10)
        self._request_semaphore = asyncio.Semaphore(self._max_concurrent_requests)
        
        logger.info(f"软适配器 {self.adapter_id} 创建完成")
    
    # ================================
    # 基础适配器抽象方法实现
    # ================================
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载软适配器元数据"""
        from ..base.metadata import (
            AdapterMetadata, AdapterCapability, AdapterDependency,
            PerformanceRequirement, ResourceRequirement
        )
        
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            display_name=self.config.get("display_name", "智能软适配器"),
            description=self.config.get("description", "基于AI技术的智能处理适配器，支持知识检索、内容生成和智能对话"),
            version=self.version,
            author=self.config.get("author", "紫舒老师团队"),
            adapter_type=AdapterType.SOFT,
            
            # 能力声明
            capabilities=[
                AdapterCapability.NATURAL_LANGUAGE_PROCESSING,
                AdapterCapability.KNOWLEDGE_RETRIEVAL, 
                AdapterCapability.CONTENT_GENERATION,
                AdapterCapability.CONVERSATION,
                AdapterCapability.DOCUMENT_ANALYSIS,
                AdapterCapability.TEMPLATE_PROCESSING,
                AdapterCapability.SEMANTIC_SEARCH,
                AdapterCapability.CONTEXT_UNDERSTANDING
            ],
            
            # 依赖关系
            dependencies=[
                AdapterDependency(
                    name="knowledge_base",
                    version=">=1.0.0",
                    required=KNOWLEDGE_BASE_AVAILABLE,
                    description="知识库管理组件"
                ),
                AdapterDependency(
                    name="rag_engine", 
                    version=">=1.0.0",
                    required=RAG_ENGINE_AVAILABLE,
                    description="RAG检索增强生成引擎"
                ),
                AdapterDependency(
                    name="prompt_engine",
                    version=">=1.0.0", 
                    required=PROMPT_ENGINE_AVAILABLE,
                    description="动态提示模板引擎"
                )
            ],
            
            # 安全级别
            security_level=SecurityLevel.STANDARD,
            
            # 性能需求  
            performance_requirements=PerformanceRequirement(
                min_memory_mb=512,
                recommended_memory_mb=2048,
                min_cpu_cores=1,
                recommended_cpu_cores=4,
                max_processing_time_seconds=30,
                concurrent_request_limit=self._max_concurrent_requests
            ),
            
            # 资源需求
            resource_requirements=ResourceRequirement(
                storage_mb=1024,
                network_bandwidth_mbps=10,
                temp_storage_mb=2048
            ),
            
            # 支持的输入输出格式
            supported_input_formats=["text/plain", "application/json", "text/markdown"],
            supported_output_formats=["text/plain", "application/json", "text/markdown", "text/html"],
            
            # 配置模式
            configuration_schema={
                "type": "object",
                "properties": {
                    "knowledge_base": {
                        "type": "object",
                        "description": "知识库配置"
                    },
                    "rag_engine": {
                        "type": "object", 
                        "description": "RAG引擎配置"
                    },
                    "prompt_engine": {
                        "type": "object",
                        "description": "提示引擎配置"
                    },
                    "enable_caching": {
                        "type": "boolean",
                        "default": True,
                        "description": "是否启用缓存"
                    },
                    "cache_ttl": {
                        "type": "integer",
                        "default": 3600,
                        "description": "缓存生存时间（秒）"
                    },
                    "max_concurrent_requests": {
                        "type": "integer", 
                        "default": 10,
                        "description": "最大并发请求数"
                    }
                }
            }
        )
    
    async def _initialize_impl(self) -> bool:
        """
        软适配器初始化实现
        
        初始化步骤：
        1. 检查组件可用性
        2. 初始化核心组件
        3. 建立组件间连接
        4. 执行健康检查
        5. 加载默认配置
        
        Returns:
            bool: 初始化是否成功
        """
        try:
            logger.info(f"开始初始化软适配器 {self.adapter_id}")
            
            # 1. 检查组件可用性
            await self._check_component_availability()
            
            # 2. 初始化核心组件
            if not await self._initialize_components():
                return False
            
            # 3. 建立组件间连接
            await self._setup_component_connections()
            
            # 4. 执行初始化后的健康检查
            health_result = await self._health_check_impl()
            if not health_result.is_healthy:
                logger.error(f"软适配器 {self.adapter_id} 健康检查失败: {health_result.issues}")
                return False
            
            # 5. 加载默认配置和资源
            await self._load_default_resources()
            
            logger.info(f"软适配器 {self.adapter_id} 初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"软适配器 {self.adapter_id} 初始化失败: {e}")
            raise AdapterLoadingError(
                f"软适配器初始化失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """
        软适配器核心处理逻辑实现
        
        处理流程：
        1. 解析和验证输入
        2. 确定处理模式
        3. 执行智能处理
        4. 后处理和格式化
        5. 更新统计信息
        
        Args:
            input_data: 输入数据，可以是字符串、字典或SoftAdapterRequest对象
            context: 执行上下文
        
        Returns:
            SoftAdapterResponse: 处理结果
        """
        async with self._request_semaphore:
            start_time = time.time()
            
            try:
                # 1. 解析输入数据
                request = self._parse_input(input_data, context)
                
                # 2. 检查缓存
                cache_key = None
                if self._enable_caching:
                    cache_key = self._generate_cache_key(request)
                    cached_response = self._get_cached_response(cache_key)
                    if cached_response:
                        self._update_stats("cache_hits", 1)
                        return cached_response
                    else:
                        self._update_stats("cache_misses", 1)
                
                # 3. 执行智能处理
                response = await self._execute_processing(request, context)
                
                # 4. 后处理
                response = await self._post_process_response(response, request)
                
                # 5. 更新缓存
                if self._enable_caching and cache_key:
                    self._cache_response(cache_key, response)
                
                # 6. 更新统计信息
                processing_time = time.time() - start_time
                response.processing_time = processing_time
                self._update_processing_stats(processing_time)
                
                return response
                
            except Exception as e:
                self._update_stats("error_count", 1)
                logger.error(f"软适配器 {self.adapter_id} 处理失败: {e}")
                
                if isinstance(e, SoftAdapterError):
                    raise
                else:
                    raise AdapterExecutionError(
                        f"软适配器处理失败: {str(e)}",
                        adapter_id=self.adapter_id,
                        cause=e
                    )
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取软适配器能力实现"""
        from ..base.metadata import AdapterCapability
        
        base_capabilities = [
            AdapterCapability.NATURAL_LANGUAGE_PROCESSING,
            AdapterCapability.CONTENT_GENERATION,
            AdapterCapability.TEMPLATE_PROCESSING,
            AdapterCapability.CONTEXT_UNDERSTANDING
        ]
        
        # 根据组件可用性动态添加能力
        if self._get_component_status("knowledge_base").is_available:
            base_capabilities.extend([
                AdapterCapability.KNOWLEDGE_RETRIEVAL,
                AdapterCapability.SEMANTIC_SEARCH,
                AdapterCapability.DOCUMENT_ANALYSIS
            ])
        
        if self._get_component_status("rag_engine").is_available:
            base_capabilities.extend([
                AdapterCapability.INFORMATION_RETRIEVAL,
                AdapterCapability.CONTEXT_SYNTHESIS
            ])
        
        if self._get_component_status("prompt_engine").is_available:
            base_capabilities.extend([
                AdapterCapability.TEMPLATE_PROCESSING,
                AdapterCapability.DYNAMIC_CONTENT_GENERATION
            ])
        
        return base_capabilities
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """软适配器健康检查实现"""
        checks = {}
        issues = []
        recommendations = []
        metrics = {}
        
        try:
            # 检查组件状态
            with self._components_lock:
                for name, status in self._component_status.items():
                    checks[f"component_{name}_available"] = status.is_available
                    checks[f"component_{name}_initialized"] = status.is_initialized
                    
                    if not status.is_available:
                        issues.append(f"组件 {name} 不可用: {status.error_message}")
                        recommendations.append(f"检查 {name} 组件的配置和依赖")
            
            # 检查资源使用情况
            import psutil
            memory_usage = psutil.virtual_memory().percent
            cpu_usage = psutil.cpu_percent(interval=1)
            
            checks["memory_usage_normal"] = memory_usage < 80
            checks["cpu_usage_normal"] = cpu_usage < 80
            
            if memory_usage > 80:
                issues.append(f"内存使用率过高: {memory_usage}%")
                recommendations.append("考虑优化缓存大小或增加内存")
            
            if cpu_usage > 80:
                issues.append(f"CPU使用率过高: {cpu_usage}%")
                recommendations.append("考虑降低并发请求数或优化处理逻辑")
            
            # 检查缓存状态
            cache_size = len(self._response_cache)
            checks["cache_size_normal"] = cache_size < self._cache_max_size * 0.9
            
            # 性能指标
            with self._stats_lock:
                metrics.update({
                    "requests_processed": self._processing_stats["requests_processed"],
                    "avg_processing_time": self._processing_stats["avg_processing_time"],
                    "error_rate": (self._processing_stats["error_count"] / 
                                 max(self._processing_stats["requests_processed"], 1)),
                    "cache_hit_rate": (self._processing_stats["cache_hits"] / 
                                     max(self._processing_stats["cache_hits"] + 
                                         self._processing_stats["cache_misses"], 1)),
                    "memory_usage_percent": memory_usage,
                    "cpu_usage_percent": cpu_usage,
                    "cache_size": cache_size
                })
            
            # 确定整体健康状态
            is_healthy = all(checks.values())
            
            if is_healthy:
                status = "healthy"
            elif len(issues) <= 2:
                status = "degraded"
            else:
                status = "unhealthy"
            
            return HealthCheckResult(
                is_healthy=is_healthy,
                status=status,
                checks=checks,
                metrics=metrics,
                issues=issues,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"软适配器 {self.adapter_id} 健康检查失败: {e}")
            return HealthCheckResult(
                is_healthy=False,
                status="unknown",
                checks={"health_check_execution": False},
                issues=[f"健康检查执行失败: {str(e)}"],
                recommendations=["检查系统资源和组件状态"]
            )
    
    async def _cleanup_impl(self) -> None:
        """软适配器清理实现"""
        try:
            logger.info(f"开始清理软适配器 {self.adapter_id}")
            
            # 清理组件
            cleanup_tasks = []
            
            if self.knowledge_base:
                cleanup_tasks.append(self._cleanup_component(self.knowledge_base, "knowledge_base"))
            
            if self.rag_engine:
                cleanup_tasks.append(self._cleanup_component(self.rag_engine, "rag_engine"))
            
            if self.prompt_engine:
                cleanup_tasks.append(self._cleanup_component(self.prompt_engine, "prompt_engine"))
            
            # 并发清理所有组件
            if cleanup_tasks:
                await asyncio.gather(*cleanup_tasks, return_exceptions=True)
            
            # 清理缓存
            self._response_cache.clear()
            
            # 重置统计信息
            with self._stats_lock:
                self._processing_stats = {
                    "requests_processed": 0,
                    "total_processing_time": 0.0,
                    "avg_processing_time": 0.0,
                    "error_count": 0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "last_reset": datetime.now(timezone.utc)
                }
            
            # 清理组件状态
            with self._components_lock:
                self._component_status.clear()
            
            logger.info(f"软适配器 {self.adapter_id} 清理完成")
            
        except Exception as e:
            logger.error(f"软适配器 {self.adapter_id} 清理失败: {e}")
            raise AdapterExecutionError(
                f"软适配器清理失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    # ================================
    # 组件管理方法
    # ================================
    
    async def _check_component_availability(self) -> None:
        """检查组件可用性"""
        components = {
            "knowledge_base": KNOWLEDGE_BASE_AVAILABLE,
            "rag_engine": RAG_ENGINE_AVAILABLE,
            "prompt_engine": PROMPT_ENGINE_AVAILABLE
        }
        
        with self._components_lock:
            for name, available in components.items():
                error_msg = None if available else f"组件 {name} 不可用，缺少相关依赖"
                
                self._component_status[name] = ComponentStatus(
                    name=name,
                    is_available=available,
                    is_initialized=False,
                    error_message=error_msg
                )
                
                if available:
                    logger.debug(f"组件 {name} 可用")
                else:
                    logger.warning(f"组件 {name} 不可用: {error_msg}")
    
    async def _initialize_components(self) -> bool:
        """初始化核心组件"""
        try:
            initialization_tasks = []
            
            # 初始化知识库
            if KNOWLEDGE_BASE_AVAILABLE and self._get_component_status("knowledge_base").is_available:
                initialization_tasks.append(self._initialize_knowledge_base())
            
            # 初始化RAG引擎
            if RAG_ENGINE_AVAILABLE and self._get_component_status("rag_engine").is_available:
                initialization_tasks.append(self._initialize_rag_engine())
            
            # 初始化提示引擎
            if PROMPT_ENGINE_AVAILABLE and self._get_component_status("prompt_engine").is_available:
                initialization_tasks.append(self._initialize_prompt_engine())
            
            # 并发初始化所有可用组件
            if initialization_tasks:
                results = await asyncio.gather(*initialization_tasks, return_exceptions=True)
                
                # 检查初始化结果
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"组件初始化失败: {result}")
                        return False
            
            # 至少需要一个组件成功初始化
            initialized_components = [status.is_initialized for status in self._component_status.values()]
            if not any(initialized_components):
                logger.error("没有任何组件成功初始化")
                return False
            
            logger.info(f"成功初始化 {sum(initialized_components)} 个组件")
            return True
            
        except Exception as e:
            logger.error(f"组件初始化过程失败: {e}")
            return False
    
    async def _initialize_knowledge_base(self) -> bool:
        """初始化知识库组件"""
        try:
            kb_config = self.config.get("knowledge_base", {})
            self.knowledge_base = KnowledgeBaseAdapter(kb_config)
            
            # 如果知识库有初始化方法，调用它
            if hasattr(self.knowledge_base, 'initialize') and callable(self.knowledge_base.initialize):
                await self.knowledge_base.initialize()
            
            # 更新组件状态
            with self._components_lock:
                self._component_status["knowledge_base"].is_initialized = True
            
            logger.info("知识库组件初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"知识库初始化失败: {e}")
            with self._components_lock:
                self._component_status["knowledge_base"].error_message = str(e)
            raise KnowledgeBaseError(f"知识库初始化失败: {str(e)}", adapter_id=self.adapter_id, cause=e)
    
    async def _initialize_rag_engine(self) -> bool:
        """初始化RAG引擎组件"""
        try:
            rag_config = self.config.get("rag_engine", {})
            
            # 创建RAG配置对象
            if RAG_ENGINE_AVAILABLE:
                from .rag_engine import RAGConfig
                config_obj = RAGConfig(**rag_config) if rag_config else RAGConfig()
                self.rag_engine = RAGEngine(config=config_obj)
            else:
                self.rag_engine = RAGEngine(rag_config)
            
            # 如果RAG引擎有初始化方法，调用它
            if hasattr(self.rag_engine, 'initialize') and callable(self.rag_engine.initialize):
                await self.rag_engine.initialize()
            
            # 更新组件状态
            with self._components_lock:
                self._component_status["rag_engine"].is_initialized = True
            
            logger.info("RAG引擎组件初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"RAG引擎初始化失败: {e}")
            with self._components_lock:
                self._component_status["rag_engine"].error_message = str(e)
            raise RAGEngineError(f"RAG引擎初始化失败: {str(e)}", adapter_id=self.adapter_id, cause=e)
    
    async def _initialize_prompt_engine(self) -> bool:
        """初始化提示引擎组件"""
        try:
            prompt_config = self.config.get("prompt_engine", {})
            self.prompt_engine = DynamicPromptEngine(**prompt_config)
            
            # 如果提示引擎有初始化方法，调用它
            if hasattr(self.prompt_engine, 'initialize') and callable(self.prompt_engine.initialize):
                await self.prompt_engine.initialize()
            
            # 更新组件状态
            with self._components_lock:
                self._component_status["prompt_engine"].is_initialized = True
            
            logger.info("提示引擎组件初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"提示引擎初始化失败: {e}")
            with self._components_lock:
                self._component_status["prompt_engine"].error_message = str(e)
            raise PromptTemplateError(f"提示引擎初始化失败: {str(e)}", adapter_id=self.adapter_id, cause=e)
    
    async def _setup_component_connections(self) -> None:
        """建立组件间连接"""
        try:
            # 如果知识库和RAG引擎都可用，建立连接
            if (self.knowledge_base and self.rag_engine and 
                hasattr(self.rag_engine, 'set_knowledge_base') and 
                callable(self.rag_engine.set_knowledge_base)):
                self.rag_engine.set_knowledge_base(self.knowledge_base)
                logger.info("RAG引擎与知识库连接已建立")
            
            # 如果提示引擎和知识库都可用，可以为提示引擎注册知识库查询函数
            if (self.prompt_engine and self.knowledge_base and 
                hasattr(self.prompt_engine, 'register_function') and 
                callable(self.prompt_engine.register_function)):
                async def kb_search_func(query: str, top_k: int = 10):
                    if hasattr(self.knowledge_base, 'search') and callable(self.knowledge_base.search):
                        return await self.knowledge_base.search(query, top_k=top_k)
                    return []
                
                self.prompt_engine.register_function('kb_search', kb_search_func, safe=True)
                logger.info("提示引擎知识库查询函数已注册")
            
            logger.info("组件连接设置完成")
            
        except Exception as e:
            logger.warning(f"组件连接设置失败，但不影响基本功能: {e}")
    
    async def _load_default_resources(self) -> None:
        """加载默认资源和配置"""
        try:
            # 加载默认提示模板
            if self.prompt_engine:
                default_templates = self._get_default_templates()
                for template_id, template_content in default_templates.items():
                    try:
                        if hasattr(self.prompt_engine, 'load_template_from_string'):
                            await self.prompt_engine.load_template_from_string(template_id, template_content)
                        logger.debug(f"加载默认模板: {template_id}")
                    except Exception as e:
                        logger.warning(f"加载默认模板 {template_id} 失败: {e}")
            
            # 预加载知识库索引（如果配置了预加载路径）
            preload_paths = self.config.get("preload_knowledge", [])
            if preload_paths and self.knowledge_base:
                for path in preload_paths:
                    try:
                        if hasattr(self.knowledge_base, 'index_directory'):
                            await self.knowledge_base.index_directory(path)
                        logger.info(f"预加载知识库路径: {path}")
                    except Exception as e:
                        logger.warning(f"预加载知识库路径 {path} 失败: {e}")
            
            logger.info("默认资源加载完成")
            
        except Exception as e:
            logger.warning(f"默认资源加载失败，但不影响基本功能: {e}")
    
    def _get_default_templates(self) -> Dict[str, str]:
        """获取默认提示模板"""
        return {
            "default_rag": """根据以下信息回答问题：

上下文信息：
{% for source in sources %}
{{ loop.index }}. {{ source.content }}
来源：{{ source.source }}
{% endfor %}

问题：{{ query }}

请基于上述信息提供准确、详细的回答。如果信息不足以回答问题，请明确说明。

回答：""",
            
            "simple_qa": """问题：{{ query }}

回答：""",
            
            "document_analysis": """请分析以下文档内容：

{{ document }}

分析要求：{{ requirements }}

分析结果：""",
            
            "conversation": """{% if context.conversation_history %}
对话历史：
{% for message in context.conversation_history %}
{{ message.role }}：{{ message.content }}
{% endfor %}
{% endif %}

用户：{{ query }}
助手："""
        }
    
    def _get_component_status(self, component_name: str) -> ComponentStatus:
        """获取组件状态"""
        with self._components_lock:
            return self._component_status.get(component_name, ComponentStatus(
                name=component_name,
                is_available=False,
                error_message="组件未初始化"
            ))
    
    async def _cleanup_component(self, component: Any, component_name: str) -> None:
        """清理单个组件"""
        try:
            if hasattr(component, 'cleanup') and callable(component.cleanup):
                if asyncio.iscoroutinefunction(component.cleanup):
                    await component.cleanup()
                else:
                    component.cleanup()
            elif hasattr(component, 'close') and callable(component.close):
                if asyncio.iscoroutinefunction(component.close):
                    await component.close()
                else:
                    component.close()
            
            logger.debug(f"组件 {component_name} 清理完成")
            
        except Exception as e:
            logger.warning(f"组件 {component_name} 清理失败: {e}")
    
    # ================================
    # 处理逻辑方法
    # ================================
    
    def _parse_input(self, input_data: Any, context: ExecutionContext) -> SoftAdapterRequest:
        """解析输入数据为标准请求对象"""
        try:
            # 如果已经是SoftAdapterRequest对象，直接返回
            if isinstance(input_data, SoftAdapterRequest):
                return input_data
            
            # 如果是字符串，创建简单的查询请求
            elif isinstance(input_data, str):
                return SoftAdapterRequest(
                    query=input_data,
                    mode=SoftAdapterMode.RAG_GENERATION,
                    metadata={"execution_id": context.execution_id}
                )
            
            # 如果是字典，解析各个字段
            elif isinstance(input_data, dict):
                query = input_data.get("query", input_data.get("question", input_data.get("input", "")))
                if not query:
                    raise ValueError("输入数据缺少查询内容")
                
                mode_str = input_data.get("mode", "rag_generation")
                try:
                    mode = SoftAdapterMode(mode_str)
                except ValueError:
                    logger.warning(f"未知的处理模式 {mode_str}，使用默认模式")
                    mode = SoftAdapterMode.RAG_GENERATION
                
                content_type_str = input_data.get("content_type", "text")
                try:
                    content_type = ContentType(content_type_str)
                except ValueError:
                    logger.warning(f"未知的内容类型 {content_type_str}，使用默认类型")
                    content_type = ContentType.TEXT
                
                return SoftAdapterRequest(
                    query=query,
                    mode=mode,
                    context=input_data.get("context", {}),
                    options=input_data.get("options", {}),
                    content_type=content_type,
                    max_tokens=input_data.get("max_tokens"),
                    temperature=input_data.get("temperature", 0.7),
                    top_k=input_data.get("top_k", 10),
                    metadata={"execution_id": context.execution_id, **input_data.get("metadata", {})}
                )
            
            else:
                raise ValueError(f"不支持的输入数据类型: {type(input_data)}")
                
        except Exception as e:
            logger.error(f"解析输入数据失败: {e}")
            raise AdapterExecutionError(
                f"输入数据解析失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _execute_processing(self, request: SoftAdapterRequest, context: ExecutionContext) -> SoftAdapterResponse:
        """执行智能处理逻辑"""
        try:
            # 根据处理模式选择处理策略
            if request.mode == SoftAdapterMode.KNOWLEDGE_QUERY:
                response = await self._process_knowledge_query(request)
            elif request.mode == SoftAdapterMode.RAG_GENERATION:
                response = await self._process_rag_generation(request)
            elif request.mode == SoftAdapterMode.PROMPT_RENDERING:
                response = await self._process_prompt_rendering(request)
            elif request.mode == SoftAdapterMode.HYBRID_PROCESSING:
                response = await self._process_hybrid(request)
            elif request.mode == SoftAdapterMode.CONVERSATION:
                response = await self._process_conversation(request)
            elif request.mode == SoftAdapterMode.DOCUMENT_ANALYSIS:
                response = await self._process_document_analysis(request)
            else:
                raise ValueError(f"不支持的处理模式: {request.mode}")
            
            # 设置响应模式
            response.mode = request.mode
            
            return response
            
        except Exception as e:
            logger.error(f"智能处理执行失败: {e}")
            
            # 返回错误响应而不是抛出异常
            return SoftAdapterResponse(
                content=f"处理失败: {str(e)}",
                confidence=0.0,
                mode=request.mode,
                metadata={"error": True, "error_message": str(e)}
            )
    
    async def _process_knowledge_query(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理知识库查询"""
        if not self.knowledge_base:
            raise KnowledgeBaseError("知识库组件不可用", adapter_id=self.adapter_id)
        
        try:
            # 执行知识库搜索
            if hasattr(self.knowledge_base, 'search') and callable(self.knowledge_base.search):
                search_results = await self.knowledge_base.search(
                    query=request.query,
                    top_k=request.top_k,
                    **request.options
                )
            else:
                # 如果没有search方法，尝试其他可能的方法名
                if hasattr(self.knowledge_base, 'query'):
                    search_results = await self.knowledge_base.query(request.query)
                else:
                    raise AttributeError("知识库不支持搜索操作")
            
            # 构建响应内容
            if hasattr(search_results, 'items') and hasattr(search_results, 'total_count'):
                # 如果是SearchResponse对象
                sources = []
                content_parts = []
                
                for item in search_results.items:
                    source_info = {
                        "id": getattr(item, 'id', ''),
                        "content": getattr(item, 'content', ''),
                        "source": getattr(item, 'source', ''),
                        "score": getattr(item, 'score', 0.0)
                    }
                    sources.append(source_info)
                    content_parts.append(f"[{source_info['source']}] {source_info['content'][:200]}...")
                
                content = f"找到 {search_results.total_count} 条相关信息：\n\n" + "\n\n".join(content_parts)
                confidence = min(len(sources) * 0.1, 1.0)  # 基于结果数量的简单置信度
            
            else:
                # 如果是其他格式的结果
                sources = []
                if isinstance(search_results, list):
                    for item in search_results:
                        if isinstance(item, dict):
                            sources.append(item)
                        else:
                            sources.append({"content": str(item)})
                
                content = f"找到 {len(sources)} 条相关信息" if sources else "未找到相关信息"
                confidence = min(len(sources) * 0.1, 1.0)
            
            return SoftAdapterResponse(
                content=content,
                confidence=confidence,
                sources=sources
            )
            
        except Exception as e:
            logger.error(f"知识库查询失败: {e}")
            raise KnowledgeBaseError(
                f"知识库查询失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_rag_generation(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理RAG生成请求"""
        if not self.rag_engine:
            # 如果没有RAG引擎，尝试使用知识库+提示引擎的组合
            if self.knowledge_base and self.prompt_engine:
                return await self._process_hybrid(request)
            else:
                raise RAGEngineError("RAG引擎组件不可用", adapter_id=self.adapter_id)
        
        try:
            # 调用RAG引擎处理
            if hasattr(self.rag_engine, 'process') and callable(self.rag_engine.process):
                rag_result = await self.rag_engine.process(
                    query=request.query,
                    context=request.context,
                    **request.options
                )
            elif hasattr(self.rag_engine, 'generate') and callable(self.rag_engine.generate):
                rag_result = await self.rag_engine.generate(
                    query=request.query,
                    **request.options
                )
            else:
                raise AttributeError("RAG引擎不支持生成操作")
            
            # 解析RAG结果
            if hasattr(rag_result, 'response') and hasattr(rag_result, 'sources'):
                # 如果是RAGResult对象
                return SoftAdapterResponse(
                    content=rag_result.response,
                    confidence=getattr(rag_result, 'confidence', 0.8),
                    sources=[{
                        "content": getattr(source.item, 'content', '') if hasattr(source, 'item') else str(source),
                        "source": getattr(source.item, 'source', '') if hasattr(source, 'item') else '',
                        "score": getattr(source, 'score', 0.0)
                    } for source in rag_result.sources],
                    tokens_used=getattr(rag_result, 'tokens_used', 0),
                    metadata=getattr(rag_result, 'metadata', {})
                )
            else:
                # 如果是其他格式的结果
                content = str(rag_result)
                return SoftAdapterResponse(
                    content=content,
                    confidence=0.7,
                    sources=[]
                )
            
        except Exception as e:
            logger.error(f"RAG生成失败: {e}")
            raise RAGEngineError(
                f"RAG生成失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_prompt_rendering(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理提示渲染请求"""
        if not self.prompt_engine:
            raise PromptTemplateError("提示引擎组件不可用", adapter_id=self.adapter_id)
        
        try:
            # 从请求中获取模板信息
            template_id = request.options.get("template_id", "default_rag")
            template_content = request.options.get("template_content")
            variables = request.context.copy()
            variables.update({
                "query": request.query,
                **request.options.get("variables", {})
            })
            
            # 渲染模板
            if template_content:
                # 使用提供的模板内容
                if hasattr(self.prompt_engine, 'render_string'):
                    render_result = await self.prompt_engine.render_string(template_content, variables)
                else:
                    render_result = template_content  # 简单替换
                    for key, value in variables.items():
                        render_result = render_result.replace(f"{{{{{key}}}}}", str(value))
            else:
                # 使用模板ID
                if hasattr(self.prompt_engine, 'render_template'):
                    render_result = await self.prompt_engine.render_template(template_id, variables)
                else:
                    # 获取默认模板
                    templates = self._get_default_templates()
                    template_content = templates.get(template_id, "{{ query }}")
                    render_result = template_content
                    for key, value in variables.items():
                        render_result = render_result.replace(f"{{{{{key}}}}}", str(value))
            
            # 处理渲染结果
            if hasattr(render_result, 'content'):
                content = render_result.content
                metadata = getattr(render_result, 'metadata', {})
            else:
                content = str(render_result)
                metadata = {}
            
            return SoftAdapterResponse(
                content=content,
                confidence=1.0,  # 模板渲染通常是确定性的
                sources=[],
                metadata={"template_id": template_id, **metadata}
            )
            
        except Exception as e:
            logger.error(f"提示渲染失败: {e}")
            raise PromptTemplateError(
                f"提示渲染失败: {str(e)}",
                template_name=request.options.get("template_id"),
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_hybrid(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理混合模式请求（结合知识库查询和提示渲染）"""
        try:
            sources = []
            context_info = ""
            
            # 1. 先进行知识库查询（如果可用）
            if self.knowledge_base:
                try:
                    kb_request = SoftAdapterRequest(
                        query=request.query,
                        mode=SoftAdapterMode.KNOWLEDGE_QUERY,
                        context=request.context,
                        options=request.options,
                        top_k=request.top_k
                    )
                    kb_response = await self._process_knowledge_query(kb_request)
                    sources = kb_response.sources
                    
                    # 构建上下文信息
                    if sources:
                        context_parts = []
                        for i, source in enumerate(sources[:5]):
                            context_parts.append(f"{i+1}. {source.get('content', '')[:300]}...")
                        context_info = "\n".join(context_parts)
                except Exception as e:
                    logger.warning(f"混合处理中的知识库查询失败: {e}")
            
            # 2. 使用提示引擎生成回答（如果可用）
            if self.prompt_engine:
                try:
                    template_id = request.options.get("template_id", "default_rag")
                    variables = {
                        "query": request.query,
                        "sources": sources,
                        "context_info": context_info,
                        **request.context,
                        **request.options.get("variables", {})
                    }
                    
                    prompt_request = SoftAdapterRequest(
                        query=request.query,
                        mode=SoftAdapterMode.PROMPT_RENDERING,
                        context=variables,
                        options={"template_id": template_id, "variables": variables}
                    )
                    prompt_response = await self._process_prompt_rendering(prompt_request)
                    
                    return SoftAdapterResponse(
                        content=prompt_response.content,
                        confidence=min(prompt_response.confidence, 0.9),  # 混合处理的置信度稍低
                        sources=sources,
                        metadata={
                            "processing_mode": "hybrid",
                            "kb_sources_count": len(sources),
                            "template_used": template_id
                        }
                    )
                    
                except Exception as e:
                    logger.warning(f"混合处理中的提示渲染失败: {e}")
            
            # 3. 如果上述都失败，返回基础回答
            if context_info:
                content = f"基于查询到的信息：\n\n{context_info}\n\n针对您的问题「{request.query}」，我找到了上述相关信息。"
                confidence = 0.6
            else:
                content = f"抱歉，我无法为您的问题「{request.query}」找到相关信息。请尝试调整您的问题或联系管理员。"
                confidence = 0.1
            
            return SoftAdapterResponse(
                content=content,
                confidence=confidence,
                sources=sources,
                metadata={"processing_mode": "hybrid_fallback"}
            )
            
        except Exception as e:
            logger.error(f"混合处理失败: {e}")
            raise SoftAdapterError(
                f"混合处理失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_conversation(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理对话模式请求"""
        try:
            # 获取对话历史
            conversation_history = request.context.get("conversation_history", [])
            
            # 使用对话模板
            template_variables = {
                "query": request.query,
                "context": {
                    "conversation_history": conversation_history,
                    **request.context
                },
                **request.options.get("variables", {})
            }
            
            # 如果有提示引擎，使用对话模板
            if self.prompt_engine:
                prompt_request = SoftAdapterRequest(
                    query=request.query,
                    mode=SoftAdapterMode.PROMPT_RENDERING,
                    context=template_variables,
                    options={"template_id": "conversation", "variables": template_variables}
                )
                return await self._process_prompt_rendering(prompt_request)
            
            # 否则使用混合处理
            else:
                hybrid_request = SoftAdapterRequest(
                    query=request.query,
                    mode=SoftAdapterMode.HYBRID_PROCESSING,
                    context=template_variables,
                    options=request.options
                )
                response = await self._process_hybrid(hybrid_request)
                response.metadata["processing_mode"] = "conversation"
                return response
                
        except Exception as e:
            logger.error(f"对话处理失败: {e}")
            raise SoftAdapterError(
                f"对话处理失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _process_document_analysis(self, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """处理文档分析请求"""
        try:
            # 获取要分析的文档
            document = request.options.get("document")
            if not document:
                document = request.context.get("document")
            
            if not document:
                raise ValueError("缺少要分析的文档内容")
            
            # 获取分析要求
            requirements = request.options.get("requirements", request.query)
            
            # 使用文档分析模板
            template_variables = {
                "document": document,
                "requirements": requirements,
                "query": request.query,
                **request.context,
                **request.options.get("variables", {})
            }
            
            # 如果有提示引擎，使用文档分析模板
            if self.prompt_engine:
                prompt_request = SoftAdapterRequest(
                    query=request.query,
                    mode=SoftAdapterMode.PROMPT_RENDERING,
                    context=template_variables,
                    options={"template_id": "document_analysis", "variables": template_variables}
                )
                return await self._process_prompt_rendering(prompt_request)
            
            # 否则进行简单的文档摘要
            else:
                doc_length = len(document)
                word_count = len(document.split())
                
                content = f"""文档分析结果：

文档统计：
- 字符数：{doc_length}
- 词数：{word_count}

分析要求：{requirements}

文档摘要：{document[:500]}{'...' if doc_length > 500 else ''}

注意：完整的文档分析需要配置提示引擎组件。"""
                
                return SoftAdapterResponse(
                    content=content,
                    confidence=0.5,
                    sources=[],
                    metadata={
                        "processing_mode": "document_analysis_basic",
                        "document_length": doc_length,
                        "word_count": word_count
                    }
                )
                
        except Exception as e:
            logger.error(f"文档分析失败: {e}")
            raise SoftAdapterError(
                f"文档分析失败: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e
            )
    
    async def _post_process_response(self, response: SoftAdapterResponse, request: SoftAdapterRequest) -> SoftAdapterResponse:
        """后处理响应"""
        try:
            # 内容格式化
            if request.content_type == ContentType.JSON:
                # 如果请求JSON格式，将内容转换为JSON
                try:
                    import json
                    response_dict = {
                        "answer": response.content,
                        "confidence": response.confidence,
                        "sources": response.sources,
                        "metadata": response.metadata
                    }
                    response.content = json.dumps(response_dict, ensure_ascii=False, indent=2)
                except Exception as e:
                    logger.warning(f"JSON格式化失败: {e}")
            
            elif request.content_type == ContentType.MARKDOWN:
                # 如果请求Markdown格式，增加格式化
                if response.sources:
                    sources_md = "\n\n## 参考来源\n\n"
                    for i, source in enumerate(response.sources, 1):
                        source_content = source.get('content', '')[:200]
                        source_name = source.get('source', f'来源{i}')
                        sources_md += f"{i}. **{source_name}**: {source_content}...\n\n"
                    
                    response.content = f"## 回答\n\n{response.content}{sources_md}"
            
            # 添加通用元数据
            response.metadata.update({
                "adapter_id": self.adapter_id,
                "request_content_type": request.content_type.value,
                "post_processed": True
            })
            
            # 内容长度检查
            if request.max_tokens and len(response.content.split()) > request.max_tokens:
                # 如果超过最大令牌数，进行截断
                words = response.content.split()
                truncated_words = words[:request.max_tokens]
                response.content = ' '.join(truncated_words) + '...[已截断]'
                response.metadata["content_truncated"] = True
                response.tokens_used = request.max_tokens
            else:
                response.tokens_used = len(response.content.split())
            
            return response
            
        except Exception as e:
            logger.warning(f"响应后处理失败: {e}")
            return response  # 返回原始响应
    
    # ================================
    # 缓存管理方法
    # ================================
    
    def _generate_cache_key(self, request: SoftAdapterRequest) -> str:
        """生成缓存键"""
        try:
            # 创建缓存键的组成部分
            cache_components = [
                request.query,
                request.mode.value,
                str(sorted(request.context.items())),
                str(sorted(request.options.items())),
                str(request.top_k),
                str(request.temperature)
            ]
            
            # 生成哈希
            cache_string = '|'.join(cache_components)
            cache_hash = hashlib.md5(cache_string.encode('utf-8')).hexdigest()
            
            return f"soft_adapter_{self.adapter_id}_{cache_hash}"
            
        except Exception as e:
            logger.warning(f"缓存键生成失败: {e}")
            return f"soft_adapter_{self.adapter_id}_{hash(request.query)}"
    
    def _get_cached_response(self, cache_key: str) -> Optional[SoftAdapterResponse]:
        """获取缓存的响应"""
        try:
            if cache_key in self._response_cache:
                response, timestamp = self._response_cache[cache_key]
                
                # 检查是否过期
                if (datetime.now(timezone.utc) - timestamp).total_seconds() < self._cache_ttl:
                    logger.debug(f"缓存命中: {cache_key}")
                    return response
                else:
                    # 清理过期的缓存
                    del self._response_cache[cache_key]
                    logger.debug(f"缓存过期已清理: {cache_key}")
            
            return None
            
        except Exception as e:
            logger.warning(f"获取缓存失败: {e}")
            return None
    
    def _cache_response(self, cache_key: str, response: SoftAdapterResponse) -> None:
        """缓存响应"""
        try:
            # 检查缓存大小限制
            if len(self._response_cache) >= self._cache_max_size:
                # 清理最旧的缓存项
                oldest_key = None
                oldest_time = None
                
                for key, (_, timestamp) in self._response_cache.items():
                    if oldest_time is None or timestamp < oldest_time:
                        oldest_time = timestamp
                        oldest_key = key
                
                if oldest_key:
                    del self._response_cache[oldest_key]
                    logger.debug(f"清理最旧缓存: {oldest_key}")
            
            # 添加到缓存
            self._response_cache[cache_key] = (response, datetime.now(timezone.utc))
            logger.debug(f"响应已缓存: {cache_key}")
            
        except Exception as e:
            logger.warning(f"缓存响应失败: {e}")
    
    def clear_cache(self) -> None:
        """清理所有缓存"""
        try:
            cache_count = len(self._response_cache)
            self._response_cache.clear()
            logger.info(f"已清理 {cache_count} 个缓存项")
        except Exception as e:
            logger.warning(f"清理缓存失败: {e}")
    
    # ================================
    # 统计和监控方法
    # ================================
    
    def _update_stats(self, key: str, value: Union[int, float]) -> None:
        """更新统计信息"""
        try:
            with self._stats_lock:
                if key in self._processing_stats:
                    self._processing_stats[key] += value
                else:
                    self._processing_stats[key] = value
        except Exception as e:
            logger.warning(f"更新统计失败: {e}")
    
    def _update_processing_stats(self, processing_time: float) -> None:
        """更新处理统计信息"""
        try:
            with self._stats_lock:
                self._processing_stats["requests_processed"] += 1
                self._processing_stats["total_processing_time"] += processing_time
                
                # 计算平均处理时间
                if self._processing_stats["requests_processed"] > 0:
                    self._processing_stats["avg_processing_time"] = (
                        self._processing_stats["total_processing_time"] / 
                        self._processing_stats["requests_processed"]
                    )
        except Exception as e:
            logger.warning(f"更新处理统计失败: {e}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取适配器统计信息"""
        try:
            with self._stats_lock:
                stats = self._processing_stats.copy()
            
            with self._components_lock:
                component_stats = {
                    f"component_{name}_status": {
                        "available": status.is_available,
                        "initialized": status.is_initialized,
                        "last_check": status.last_check.isoformat()
                    }
                    for name, status in self._component_status.items()
                }
            
            return {
                "adapter_id": self.adapter_id,
                "processing_stats": stats,
                "component_stats": component_stats,
                "cache_stats": {
                    "cache_size": len(self._response_cache),
                    "cache_max_size": self._cache_max_size,
                    "cache_ttl": self._cache_ttl
                },
                "configuration": {
                    "enable_caching": self._enable_caching,
                    "max_concurrent_requests": self._max_concurrent_requests
                }
            }
            
        except Exception as e:
            logger.error(f"获取统计信息失败: {e}")
            return {"error": str(e)}
    
    def reset_statistics(self) -> None:
        """重置统计信息"""
        try:
            with self._stats_lock:
                self._processing_stats = {
                    "requests_processed": 0,
                    "total_processing_time": 0.0,
                    "avg_processing_time": 0.0,
                    "error_count": 0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "last_reset": datetime.now(timezone.utc)
                }
            logger.info("统计信息已重置")
        except Exception as e:
            logger.warning(f"重置统计信息失败: {e}")
    
    # ================================
    # 公共接口方法
    # ================================
    
    async def query_knowledge(self, query: str, top_k: int = 10, **kwargs) -> SoftAdapterResponse:
        """知识库查询的便捷接口"""
        request = SoftAdapterRequest(
            query=query,
            mode=SoftAdapterMode.KNOWLEDGE_QUERY,
            top_k=top_k,
            options=kwargs
        )
        
        context = ExecutionContext(
            execution_id=f"kb_query_{uuid.uuid4().hex[:8]}"
        )
        
        result = await self._process_impl(request, context)
        return result if isinstance(result, SoftAdapterResponse) else SoftAdapterResponse(content=str(result))
    
    async def generate_response(self, query: str, context: Optional[Dict[str, Any]] = None, **kwargs) -> SoftAdapterResponse:
        """RAG生成的便捷接口"""
        request = SoftAdapterRequest(
            query=query,
            mode=SoftAdapterMode.RAG_GENERATION,
            context=context or {},
            options=kwargs
        )
        
        exec_context = ExecutionContext(
            execution_id=f"rag_gen_{uuid.uuid4().hex[:8]}"
        )
        
        result = await self._process_impl(request, exec_context)
        return result if isinstance(result, SoftAdapterResponse) else SoftAdapterResponse(content=str(result))
    
    async def render_template(self, template_id: str, variables: Dict[str, Any], **kwargs) -> SoftAdapterResponse:
        """模板渲染的便捷接口"""
        request = SoftAdapterRequest(
            query="",  # 模板渲染不需要查询
            mode=SoftAdapterMode.PROMPT_RENDERING,
            context=variables,
            options={"template_id": template_id, "variables": variables, **kwargs}
        )
        
        context = ExecutionContext(
            execution_id=f"template_{uuid.uuid4().hex[:8]}"
        )
        
        result = await self._process_impl(request, context)
        return result if isinstance(result, SoftAdapterResponse) else SoftAdapterResponse(content=str(result))
    
    async def chat(self, message: str, conversation_history: Optional[List[Dict[str, str]]] = None, **kwargs) -> SoftAdapterResponse:
        """对话的便捷接口"""
        request = SoftAdapterRequest(
            query=message,
            mode=SoftAdapterMode.CONVERSATION,
            context={
                "conversation_history": conversation_history or []
            },
            options=kwargs
        )
        
        context = ExecutionContext(
            execution_id=f"chat_{uuid.uuid4().hex[:8]}"
        )
        
        result = await self._process_impl(request, context)
        return result if isinstance(result, SoftAdapterResponse) else SoftAdapterResponse(content=str(result))
    
    async def analyze_document(self, document: str, requirements: str, **kwargs) -> SoftAdapterResponse:
        """文档分析的便捷接口"""
        request = SoftAdapterRequest(
            query=requirements,
            mode=SoftAdapterMode.DOCUMENT_ANALYSIS,
            options={"document": document, "requirements": requirements, **kwargs}
        )
        
        context = ExecutionContext(
            execution_id=f"doc_analysis_{uuid.uuid4().hex[:8]}"
        )
        
        result = await self._process_impl(request, context)
        return result if isinstance(result, SoftAdapterResponse) else SoftAdapterResponse(content=str(result))
    
    # ================================
    # 组件访问器
    # ================================
    
    def get_knowledge_base(self) -> Optional[KnowledgeBaseAdapter]:
        """获取知识库组件"""
        return self.knowledge_base
    
    def get_rag_engine(self) -> Optional[RAGEngine]:
        """获取RAG引擎组件"""
        return self.rag_engine
    
    def get_prompt_engine(self) -> Optional[DynamicPromptEngine]:
        """获取提示引擎组件"""
        return self.prompt_engine
    
    def is_component_available(self, component_name: str) -> bool:
        """检查组件是否可用"""
        return self._get_component_status(component_name).is_available
    
    def is_component_initialized(self, component_name: str) -> bool:
        """检查组件是否已初始化"""
        return self._get_component_status(component_name).is_initialized


# ================================
# 软适配器工厂和便捷函数
# ================================

def create_soft_adapter(config: Dict[str, Any]) -> SoftAdapter:
    """创建软适配器实例的工厂函数"""
    return SoftAdapter(config)


def create_simple_soft_adapter(name: str = "simple_soft_adapter", **kwargs) -> SoftAdapter:
    """创建简单配置的软适配器"""
    config = {
        "adapter_type": AdapterType.SOFT.value,
        "name": name,
        "enable_caching": True,
        "cache_ttl": 1800,  # 30分钟
        "max_concurrent_requests": 5,
        **kwargs
    }
    return SoftAdapter(config)


def create_production_soft_adapter(
    name: str = "production_soft_adapter",
    knowledge_base_config: Optional[Dict[str, Any]] = None,
    rag_config: Optional[Dict[str, Any]] = None,
    prompt_config: Optional[Dict[str, Any]] = None,
    **kwargs
) -> SoftAdapter:
    """创建生产环境配置的软适配器"""
    config = {
        "adapter_type": AdapterType.SOFT.value,
        "name": name,
        "enable_caching": True,
        "cache_ttl": 3600,  # 1小时
        "cache_max_size": 2000,
        "max_concurrent_requests": 20,
        "knowledge_base": knowledge_base_config or {
            "storage_backend": "memory",
            "embedding_model": "all-MiniLM-L6-v2",
            "enable_security": True
        },
        "rag_engine": rag_config or {
            "mode": "hybrid",
            "max_context_length": 4000,
            "retrieval_strategy": "semantic"
        },
        "prompt_engine": prompt_config or {
            "enable_caching": True,
            "max_template_size": 10000
        },
        **kwargs
    }
    return SoftAdapter(config)


# ================================
# 异步上下文管理器支持
# ================================

@asynccontextmanager
async def soft_adapter_context(config: Dict[str, Any]):
    """软适配器的异步上下文管理器"""
    adapter = SoftAdapter(config)
    try:
        await adapter.initialize()
        yield adapter
    finally:
        await adapter.cleanup()


# ================================
# 导出列表
# ================================

__all__ = [
    # 核心类
    "SoftAdapter",
    
    # 数据结构
    "SoftAdapterMode",
    "ContentType", 
    "SoftAdapterRequest",
    "SoftAdapterResponse",
    "ComponentStatus",
    
    # 工厂函数
    "create_soft_adapter",
    "create_simple_soft_adapter",
    "create_production_soft_adapter",
    
    # 上下文管理器
    "soft_adapter_context",
]

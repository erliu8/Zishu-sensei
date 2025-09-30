"""
适配器组合器
提供适配器的组合、编排和执行管理功能，支持复杂的工作流设计
"""

import os
import sys
import json
import asyncio
import logging
import threading
import traceback
import uuid
import time
import hashlib
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable, Type, Iterator
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import weakref

# 本地导入
from ..base.exceptions import (
    BaseAdapterException, AdapterExecutionError, AdapterValidationError,
    AdapterConfigurationError, ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from ..base.metadata import (
    AdapterMetadata, AdapterCapability, CapabilityCategory, AdapterType,
    AdapterStatus, SecurityLevel
)
from ..security.audit import get_audit_logger, AuditEventType, AuditLevel, audit_operation

# 可选导入
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# 配置日志
logger = logging.getLogger(__name__)


# ================================
# 核心枚举和常量定义
# ================================

class CompositionStrategy(Enum):
    """组合执行策略"""
    SEQUENTIAL = "sequential"        # 顺序执行：按顺序依次执行
    PARALLEL = "parallel"           # 并行执行：所有适配器同时执行
    PIPELINE = "pipeline"           # 流水线：上一个的输出作为下一个的输入
    CONDITIONAL = "conditional"     # 条件执行：根据条件选择执行路径
    FORK_JOIN = "fork_join"        # 分叉汇合：分叉并行后汇合结果
    SCATTER_GATHER = "scatter_gather"  # 散布收集：散布任务后收集结果
    CIRCUIT_BREAKER = "circuit_breaker"  # 熔断器：失败时切换备用路径


class ExecutionMode(Enum):
    """执行模式"""
    SYNCHRONOUS = "synchronous"     # 同步执行：等待所有完成
    ASYNCHRONOUS = "asynchronous"   # 异步执行：不等待完成
    STREAMING = "streaming"         # 流式执行：逐步处理结果
    BATCH = "batch"                # 批量执行：批量处理多个输入


class CompositionStatus(Enum):
    """组合状态"""
    REGISTERED = "registered"       # 已注册
    LOADING = "loading"            # 加载中
    LOADED = "loaded"              # 已加载
    RUNNING = "running"            # 运行中
    COMPLETED = "completed"        # 已完成
    FAILED = "failed"              # 执行失败
    PAUSED = "paused"              # 已暂停
    CANCELLED = "cancelled"        # 已取消
    ERROR = "error"                # 错误状态
    UNREGISTERED = "unregistered"  # 已注销


class TaskPriority(Enum):
    """任务优先级"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5


# ================================
# 核心数据结构
# ================================

@dataclass
class AdapterNode:
    """适配器节点定义"""
    # 基础信息
    node_id: str
    adapter_id: str
    adapter_type: str
    name: str = ""
    description: str = ""
    
    # 执行配置
    config: Dict[str, Any] = field(default_factory=dict)
    inputs: Dict[str, str] = field(default_factory=dict)  # 输入映射 {local_name: source}
    outputs: Dict[str, str] = field(default_factory=dict)  # 输出映射 {local_name: target}
    
    # 依赖关系
    dependencies: List[str] = field(default_factory=list)  # 依赖的节点ID列表
    conditions: Dict[str, Any] = field(default_factory=dict)  # 执行条件
    
    # 运行时状态
    status: CompositionStatus = CompositionStatus.REGISTERED
    last_execution: Optional[datetime] = None
    execution_count: int = 0
    error_count: int = 0
    
    # 性能指标
    average_duration: float = 0.0
    success_rate: float = 1.0


@dataclass
class CompositionGraph:
    """组合图结构定义"""
    # 图的基础信息
    graph_id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    
    # 节点和边
    nodes: Dict[str, AdapterNode] = field(default_factory=dict)
    edges: Dict[str, List[str]] = field(default_factory=dict)  # {from_node: [to_nodes]}
    
    # 执行配置
    strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL
    execution_mode: ExecutionMode = ExecutionMode.SYNCHRONOUS
    max_parallel: int = 5
    timeout: int = 300  # 秒
    
    # 图的元数据
    entry_points: List[str] = field(default_factory=list)  # 入口节点
    exit_points: List[str] = field(default_factory=list)   # 出口节点
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # 运行时状态
    status: CompositionStatus = CompositionStatus.REGISTERED
    current_execution_id: Optional[str] = None


@dataclass 
class ExecutionContext:
    """执行上下文"""
    # 执行基础信息
    execution_id: str
    graph_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    # 执行配置
    inputs: Dict[str, Any] = field(default_factory=dict)
    parameters: Dict[str, Any] = field(default_factory=dict)
    environment: Dict[str, str] = field(default_factory=dict)
    
    # 执行状态
    status: CompositionStatus = CompositionStatus.REGISTERED
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # 中间结果存储
    node_results: Dict[str, Any] = field(default_factory=dict)
    shared_data: Dict[str, Any] = field(default_factory=dict)
    
    # 执行统计
    nodes_completed: int = 0
    nodes_failed: int = 0
    total_nodes: int = 0
    
    # 错误信息
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class CompositionConfiguration:
    """组合器配置"""
    # 基础配置
    name: str = "default_composer"
    version: str = "1.0.0"
    description: str = "适配器组合器"
    
    # 执行限制
    max_concurrent_executions: int = 10
    max_nodes_per_graph: int = 100
    default_timeout: int = 300
    max_retry_attempts: int = 3
    
    # 资源限制  
    max_memory_usage: int = 2 * 1024 * 1024 * 1024  # 2GB
    max_cpu_usage: float = 80.0  # 百分比
    
    # 存储配置
    graph_storage_path: str = "./compositions"
    result_retention_days: int = 30
    log_level: str = "INFO"
    
    # 安全配置
    security_level: SecurityLevel = SecurityLevel.INTERNAL
    audit_enabled: bool = True
    allow_dynamic_loading: bool = True
    
    # 扩展配置
    plugins: List[str] = field(default_factory=list)
    custom_strategies: Dict[str, Any] = field(default_factory=dict)
    hooks: Dict[str, List[Callable]] = field(default_factory=dict)


@dataclass
class ExecutionResult:
    """执行结果"""
    # 基础信息
    execution_id: str
    graph_id: str
    status: CompositionStatus
    
    # 时间信息
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration: float = 0.0
    
    # 结果数据
    outputs: Dict[str, Any] = field(default_factory=dict)
    node_results: Dict[str, Any] = field(default_factory=dict)
    
    # 统计信息
    nodes_executed: int = 0
    nodes_succeeded: int = 0
    nodes_failed: int = 0
    
    # 错误信息
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # 性能指标
    memory_usage: int = 0
    cpu_usage: float = 0.0
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)


# ================================
# 适配器组合器基类
# ================================

class AdapterComposer:
    """
    适配器组合器
    
    提供以下核心功能：
    1. 适配器组合图的创建和管理
    2. 多种组合策略的执行（串行、并行、流水线等）
    3. 动态配置和运行时管理
    4. 错误处理和容错机制
    5. 性能监控和资源管理
    6. 审计和日志功能
    """
    
    def __init__(self, config: Optional[CompositionConfiguration] = None):
        """初始化适配器组合器"""
        self._config = config or CompositionConfiguration()
        self._composer_id = str(uuid.uuid4())
        
        # 初始化存储
        self._graphs: Dict[str, CompositionGraph] = {}
        self._executions: Dict[str, ExecutionContext] = {}
        self._adapter_registry: Dict[str, Any] = {}  # 适配器实例注册表
        
        # 初始化状态管理
        self._status = CompositionStatus.REGISTERED
        self._active_executions: Set[str] = set()
        self._execution_queue = deque()
        
        # 初始化线程和锁
        self._lock = threading.RLock()
        self._executor_pool: Optional[ThreadPoolExecutor] = None
        self._shutdown_event = threading.Event()
        
        # 初始化监控和日志
        self._setup_logging()
        self._audit_logger = get_audit_logger()
        self._performance_metrics: Dict[str, Any] = defaultdict(float)
        
        # 初始化策略执行器映射
        self._strategy_executors: Dict[CompositionStrategy, Callable] = {
            CompositionStrategy.SEQUENTIAL: self._execute_sequential,
            CompositionStrategy.PARALLEL: self._execute_parallel,
            CompositionStrategy.PIPELINE: self._execute_pipeline,
            CompositionStrategy.CONDITIONAL: self._execute_conditional,
            CompositionStrategy.FORK_JOIN: self._execute_fork_join,
            CompositionStrategy.SCATTER_GATHER: self._execute_scatter_gather,
            CompositionStrategy.CIRCUIT_BREAKER: self._execute_circuit_breaker,
        }
        
        logger.info(f"适配器组合器初始化完成: {self._composer_id}")
    
    @property
    def composer_id(self) -> str:
        """获取组合器ID"""
        return self._composer_id
    
    @property
    def config(self) -> CompositionConfiguration:
        """获取配置"""
        return self._config
    
    @property
    def status(self) -> CompositionStatus:
        """获取状态"""
        return self._status
    
    def _setup_logging(self):
        """设置日志"""
        log_level = getattr(logging, self._config.log_level.upper(), logging.INFO)
        logger.setLevel(log_level)
        
        # 添加组合器特定的日志格式
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                f'%(asctime)s - {self._composer_id[:8]} - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
    
    # ================================
    # 生命周期管理方法
    # ================================
    
    async def initialize(self) -> None:
        """初始化组合器"""
        try:
            with self._lock:
                if self._status != CompositionStatus.REGISTERED:
                    raise AdapterConfigurationError(
                        f"组合器状态错误，无法初始化: {self._status}",
                        ErrorCode.INITIALIZATION_ERROR
                    )
                
                self._status = CompositionStatus.LOADING
            
            logger.info(f"开始初始化适配器组合器: {self._composer_id}")
            
            # 初始化线程池
            self._executor_pool = ThreadPoolExecutor(
                max_workers=self._config.max_concurrent_executions,
                thread_name_prefix=f"composer-{self._composer_id[:8]}"
            )
            
            # 创建存储目录
            await self._initialize_storage()
            
            # 加载现有的组合图
            await self._load_existing_graphs()
            
            # 启动后台任务
            await self._start_background_tasks()
            
            with self._lock:
                self._status = CompositionStatus.LOADED
            
            logger.info(f"适配器组合器初始化完成: {self._composer_id}")
            
            if self._config.audit_enabled:
                self._audit_logger.info(
                    "适配器组合器初始化完成",
                    extra={
                        "composer_id": self._composer_id,
                        "event_type": AuditEventType.ADAPTER_LIFECYCLE,
                        "level": AuditLevel.INFO
                    }
                )
        
        except Exception as e:
            with self._lock:
                self._status = CompositionStatus.ERROR
            logger.error(f"适配器组合器初始化失败: {e}", exc_info=True)
            raise AdapterConfigurationError(
                f"适配器组合器初始化失败: {str(e)}",
                ErrorCode.INITIALIZATION_ERROR,
                ExceptionSeverity.HIGH
            ) from e
    
    async def _initialize_storage(self) -> None:
        """初始化存储目录"""
        storage_path = Path(self._config.graph_storage_path)
        storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"存储目录已初始化: {storage_path}")
    
    async def _load_existing_graphs(self) -> None:
        """加载现有的组合图"""
        storage_path = Path(self._config.graph_storage_path)
        if not storage_path.exists():
            return
        
        loaded_count = 0
        for graph_file in storage_path.glob("*.json"):
            try:
                with open(graph_file, 'r', encoding='utf-8') as f:
                    graph_data = json.load(f)
                    graph = self._deserialize_graph(graph_data)
                    self._graphs[graph.graph_id] = graph
                    loaded_count += 1
            except Exception as e:
                logger.warning(f"加载组合图失败 {graph_file}: {e}")
        
        logger.info(f"已加载 {loaded_count} 个组合图")
    
    async def _start_background_tasks(self) -> None:
        """启动后台任务"""
        # 启动执行监控循环
        asyncio.create_task(self._execution_monitor_loop())
        
        # 启动性能监控循环
        if self._config.audit_enabled:
            asyncio.create_task(self._performance_monitor_loop())
        
        # 启动资源清理循环
        asyncio.create_task(self._cleanup_loop())
    
    async def shutdown(self) -> None:
        """关闭组合器"""
        try:
            logger.info(f"开始关闭适配器组合器: {self._composer_id}")
            
            # 设置关闭标志
            self._shutdown_event.set()
            
            # 等待活跃执行完成
            await self._wait_for_active_executions()
            
            # 关闭线程池
            if self._executor_pool:
                self._executor_pool.shutdown(wait=True)
            
            # 保存状态
            await self._save_all_graphs()
            
            with self._lock:
                self._status = CompositionStatus.UNREGISTERED
            
            logger.info(f"适配器组合器关闭完成: {self._composer_id}")
            
        except Exception as e:
            logger.error(f"适配器组合器关闭时发生错误: {e}", exc_info=True)
    
    async def _wait_for_active_executions(self, timeout: int = 30) -> None:
        """等待活跃执行完成"""
        start_time = time.time()
        while self._active_executions and (time.time() - start_time) < timeout:
            await asyncio.sleep(0.1)
        
        if self._active_executions:
            logger.warning(f"关闭时仍有 {len(self._active_executions)} 个执行未完成")
    
    # ================================
    # 组合图管理方法
    # ================================
    
    def create_graph(
        self,
        name: str,
        description: str = "",
        strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL
    ) -> str:
        """创建新的组合图"""
        graph_id = str(uuid.uuid4())
        
        graph = CompositionGraph(
            graph_id=graph_id,
            name=name,
            description=description,
            strategy=strategy
        )
        
        with self._lock:
            self._graphs[graph_id] = graph
        
        logger.info(f"创建组合图: {graph_id} - {name}")
        
        if self._config.audit_enabled:
            self._audit_logger.info(
                f"创建组合图: {name}",
                extra={
                    "composer_id": self._composer_id,
                    "graph_id": graph_id,
                    "event_type": AuditEventType.ADAPTER_LIFECYCLE,
                    "level": AuditLevel.INFO
                }
            )
        
        return graph_id
    
    def delete_graph(self, graph_id: str) -> bool:
        """删除组合图"""
        with self._lock:
            if graph_id not in self._graphs:
                return False
            
            # 检查是否有活跃执行
            if graph_id in [ctx.graph_id for ctx in self._executions.values()]:
                raise AdapterExecutionError(
                    f"无法删除组合图 {graph_id}：存在活跃执行",
                    ErrorCode.ADAPTER_EXECUTION_FAILED
                )
            
            del self._graphs[graph_id]
        
        # 删除存储文件
        storage_path = Path(self._config.graph_storage_path) / f"{graph_id}.json"
        if storage_path.exists():
            storage_path.unlink()
        
        logger.info(f"删除组合图: {graph_id}")
        return True
    
    def add_node(
        self,
        graph_id: str,
        adapter_id: str,
        adapter_type: str,
        name: str = "",
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        """向组合图添加节点"""
        with self._lock:
            if graph_id not in self._graphs:
                raise AdapterValidationError(
                    f"组合图不存在: {graph_id}",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            graph = self._graphs[graph_id]
            
            # 检查节点数量限制
            if len(graph.nodes) >= self._config.max_nodes_per_graph:
                raise AdapterValidationError(
                    f"组合图节点数量已达到限制: {self._config.max_nodes_per_graph}",
                    ErrorCode.RESOURCE_EXHAUSTED
                )
            
            node_id = str(uuid.uuid4())
            node = AdapterNode(
                node_id=node_id,
                adapter_id=adapter_id,
                adapter_type=adapter_type,
                name=name or f"node_{len(graph.nodes) + 1}",
                config=config or {}
            )
            
            graph.nodes[node_id] = node
            graph.edges[node_id] = []  # 初始化边列表
            graph.updated_at = datetime.now(timezone.utc)
        
        logger.info(f"向组合图 {graph_id} 添加节点: {node_id} - {adapter_id}")
        return node_id
    
    def add_edge(self, graph_id: str, from_node: str, to_node: str) -> None:
        """添加边连接两个节点"""
        with self._lock:
            if graph_id not in self._graphs:
                raise AdapterValidationError(
                    f"组合图不存在: {graph_id}",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            graph = self._graphs[graph_id]
            
            if from_node not in graph.nodes or to_node not in graph.nodes:
                raise AdapterValidationError(
                    "源节点或目标节点不存在",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            # 检查循环依赖
            if self._would_create_cycle(graph, from_node, to_node):
                raise AdapterValidationError(
                    "添加边会创建循环依赖",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            if to_node not in graph.edges[from_node]:
                graph.edges[from_node].append(to_node)
                graph.nodes[to_node].dependencies.append(from_node)
                graph.updated_at = datetime.now(timezone.utc)
        
        logger.info(f"添加边: {from_node} -> {to_node}")
    
    def _would_create_cycle(self, graph: CompositionGraph, from_node: str, to_node: str) -> bool:
        """检查添加边是否会创建循环"""
        # 使用DFS检查是否存在从to_node到from_node的路径
        visited = set()
        
        def dfs(node: str) -> bool:
            if node == from_node:
                return True
            if node in visited:
                return False
            
            visited.add(node)
            for neighbor in graph.edges.get(node, []):
                if dfs(neighbor):
                    return True
            return False
        
        return dfs(to_node)
    
    # ================================
    # 执行方法
    # ================================
    
    async def execute_graph(
        self,
        graph_id: str,
        inputs: Optional[Dict[str, Any]] = None,
        parameters: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> ExecutionResult:
        """执行组合图"""
        start_time = time.time()
        execution_id = str(uuid.uuid4())
        
        try:
            with self._lock:
                if graph_id not in self._graphs:
                    raise AdapterValidationError(
                        f"组合图不存在: {graph_id}",
                        ErrorCode.ADAPTER_INPUT_INVALID
                    )
                
                graph = self._graphs[graph_id]
                
                # 检查并发限制
                if len(self._active_executions) >= self._config.max_concurrent_executions:
                    raise AdapterExecutionError(
                        f"已达到最大并发执行数限制: {self._config.max_concurrent_executions}",
                        ErrorCode.RESOURCE_EXHAUSTED
                    )
            
            # 创建执行上下文
            context = ExecutionContext(
                execution_id=execution_id,
                graph_id=graph_id,
                user_id=user_id,
                session_id=session_id,
                inputs=inputs or {},
                parameters=parameters or {},
                total_nodes=len(graph.nodes),
                started_at=datetime.now(timezone.utc)
            )
            
            # 注册执行
            with self._lock:
                self._executions[execution_id] = context
                self._active_executions.add(execution_id)
                graph.current_execution_id = execution_id
            
            logger.info(f"开始执行组合图: {graph_id} - 执行ID: {execution_id}")
            
            # 验证图的完整性
            await self._validate_graph_for_execution(graph)
            
            # 选择并执行策略
            strategy_executor = self._strategy_executors.get(graph.strategy)
            if not strategy_executor:
                raise AdapterExecutionError(
                    f"不支持的组合策略: {graph.strategy}",
                    ErrorCode.ADAPTER_EXECUTION_FAILED
                )
            
            # 执行策略
            context.status = CompositionStatus.RUNNING
            result = await strategy_executor(graph, context)
            
            # 记录成功执行
            context.status = CompositionStatus.COMPLETED
            context.completed_at = datetime.now(timezone.utc)
            
            execution_result = ExecutionResult(
                execution_id=execution_id,
                graph_id=graph_id,
                status=CompositionStatus.COMPLETED,
                started_at=context.started_at,
                completed_at=context.completed_at,
                duration=time.time() - start_time,
                outputs=result,
                node_results=context.node_results,
                nodes_executed=context.nodes_completed + context.nodes_failed,
                nodes_succeeded=context.nodes_completed,
                nodes_failed=context.nodes_failed,
                errors=context.errors,
                warnings=context.warnings
            )
            
            logger.info(f"组合图执行完成: {execution_id} - 耗时: {execution_result.duration:.2f}s")
            
            return execution_result
            
        except Exception as e:
            # 记录失败执行
            context.status = CompositionStatus.FAILED
            context.completed_at = datetime.now(timezone.utc)
            
            logger.error(f"组合图执行失败: {execution_id} - {str(e)}", exc_info=True)
            
            # 审计日志
            if self._config.audit_enabled:
                self._audit_logger.error(
                    f"组合图执行失败: {str(e)}",
                    extra={
                        "composer_id": self._composer_id,
                        "execution_id": execution_id,
                        "graph_id": graph_id,
                        "event_type": AuditEventType.TASK_EXECUTION,
                        "level": AuditLevel.ERROR
                    }
                )
            
            return ExecutionResult(
                execution_id=execution_id,
                graph_id=graph_id,
                status=CompositionStatus.FAILED,
                started_at=context.started_at if context.started_at else datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                duration=time.time() - start_time,
                errors=[{
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }]
            )
            
        finally:
            # 清理执行记录
            with self._lock:
                self._active_executions.discard(execution_id)
                if graph_id in self._graphs:
                    self._graphs[graph_id].current_execution_id = None
    
    async def _validate_graph_for_execution(self, graph: CompositionGraph) -> None:
        """验证图是否可以执行"""
        if not graph.nodes:
            raise AdapterValidationError(
                "组合图没有节点",
                ErrorCode.ADAPTER_INPUT_INVALID
            )
        
        # 检查是否有孤立节点（除了入口和出口节点）
        for node_id, node in graph.nodes.items():
            if (not node.dependencies and 
                node_id not in graph.entry_points and 
                not graph.edges.get(node_id)):
                logger.warning(f"发现孤立节点: {node_id}")
        
        # 验证适配器是否可用
        for node in graph.nodes.values():
            if node.adapter_id not in self._adapter_registry:
                raise AdapterValidationError(
                    f"适配器未注册: {node.adapter_id}",
                    ErrorCode.ADAPTER_NOT_FOUND
                )
    
    # ================================
    # 组合策略执行器
    # ================================
    
    async def _execute_sequential(
        self, 
        graph: CompositionGraph, 
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """顺序执行策略"""
        logger.info(f"开始顺序执行组合图: {graph.graph_id}")
        
        # 计算拓扑排序顺序
        execution_order = self._topological_sort(graph)
        
        results = {}
        for node_id in execution_order:
            try:
                node = graph.nodes[node_id]
                logger.info(f"执行节点: {node_id} - {node.adapter_id}")
                
                # 准备节点输入
                node_inputs = await self._prepare_node_inputs(node, context)
                
                # 执行适配器
                adapter_result = await self._execute_adapter(
                    node.adapter_id, 
                    node_inputs, 
                    node.config,
                    context
                )
                
                # 存储结果
                context.node_results[node_id] = adapter_result
                context.nodes_completed += 1
                
                # 更新节点统计
                node.execution_count += 1
                node.last_execution = datetime.now(timezone.utc)
                
                results[node_id] = adapter_result
                
            except Exception as e:
                logger.error(f"节点执行失败: {node_id} - {str(e)}")
                context.nodes_failed += 1
                context.errors.append({
                    "node_id": node_id,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # 更新节点错误统计
                node.error_count += 1
                
                # 根据配置决定是否继续
                if not self._should_continue_on_error(graph, node_id, e):
                    raise
        
        return results
    
    async def _execute_parallel(
        self, 
        graph: CompositionGraph, 
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """并行执行策略"""
        logger.info(f"开始并行执行组合图: {graph.graph_id}")
        
        # 创建并发任务
        tasks = []
        node_ids = []
        
        for node_id, node in graph.nodes.items():
            task = asyncio.create_task(
                self._execute_node_with_context(node_id, node, context)
            )
            tasks.append(task)
            node_ids.append(node_id)
        
        # 等待所有任务完成
        results = {}
        completed_tasks = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(completed_tasks):
            node_id = node_ids[i]
            
            if isinstance(result, Exception):
                logger.error(f"节点并行执行失败: {node_id} - {str(result)}")
                context.nodes_failed += 1
                context.errors.append({
                    "node_id": node_id,
                    "error": str(result),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            else:
                context.nodes_completed += 1
                results[node_id] = result
                context.node_results[node_id] = result
        
        return results
    
    async def _execute_pipeline(
        self, 
        graph: CompositionGraph, 
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """流水线执行策略"""
        logger.info(f"开始流水线执行组合图: {graph.graph_id}")
        
        # 计算拓扑排序顺序
        execution_order = self._topological_sort(graph)
        
        # 初始化流水线数据
        pipeline_data = context.inputs.copy()
        results = {}
        
        for node_id in execution_order:
            try:
                node = graph.nodes[node_id]
                logger.info(f"流水线执行节点: {node_id} - {node.adapter_id}")
                
                # 使用前一个节点的输出作为当前节点的输入
                node_inputs = {**pipeline_data, **node.config.get('static_inputs', {})}
                
                # 执行适配器
                adapter_result = await self._execute_adapter(
                    node.adapter_id, 
                    node_inputs, 
                    node.config,
                    context
                )
                
                # 更新流水线数据
                if isinstance(adapter_result, dict):
                    pipeline_data.update(adapter_result)
                else:
                    pipeline_data['last_result'] = adapter_result
                
                context.node_results[node_id] = adapter_result
                context.nodes_completed += 1
                results[node_id] = adapter_result
                
            except Exception as e:
                logger.error(f"流水线节点执行失败: {node_id} - {str(e)}")
                context.nodes_failed += 1
                context.errors.append({
                    "node_id": node_id,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                raise  # 流水线模式下一个失败就全部失败
        
        return results
    
    def _topological_sort(self, graph: CompositionGraph) -> List[str]:
        """计算图的拓扑排序"""
        in_degree = defaultdict(int)
        adj_list = defaultdict(list)
        
        # 构建邻接列表和入度表
        for from_node, to_nodes in graph.edges.items():
            for to_node in to_nodes:
                adj_list[from_node].append(to_node)
                in_degree[to_node] += 1
        
        # 初始化所有节点的入度
        for node_id in graph.nodes:
            if node_id not in in_degree:
                in_degree[node_id] = 0
        
        # 使用Kahn算法进行拓扑排序
        queue = deque([node for node, degree in in_degree.items() if degree == 0])
        result = []
        
        while queue:
            current = queue.popleft()
            result.append(current)
            
            for neighbor in adj_list[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # 检查是否有循环
        if len(result) != len(graph.nodes):
            raise AdapterValidationError(
                "组合图包含循环依赖",
                ErrorCode.ADAPTER_INPUT_INVALID
            )
        
        return result
    
    async def _execute_node_with_context(
        self, 
        node_id: str, 
        node: AdapterNode, 
        context: ExecutionContext
    ) -> Any:
        """在上下文中执行单个节点"""
        try:
            # 准备节点输入
            node_inputs = await self._prepare_node_inputs(node, context)
            
            # 执行适配器
            result = await self._execute_adapter(
                node.adapter_id, 
                node_inputs, 
                node.config,
                context
            )
            
            # 更新节点统计
            node.execution_count += 1
            node.last_execution = datetime.now(timezone.utc)
            
            return result
            
        except Exception as e:
            node.error_count += 1
            raise
    
    # ================================
    # 辅助方法和占位符实现
    # ================================
    
    async def _prepare_node_inputs(
        self, 
        node: AdapterNode, 
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """准备节点输入数据"""
        inputs = {}
        
        # 添加上下文输入
        inputs.update(context.inputs)
        
        # 添加来自依赖节点的输出
        for dep_node_id in node.dependencies:
            if dep_node_id in context.node_results:
                dep_result = context.node_results[dep_node_id]
                # 根据输入映射配置添加数据
                for local_name, source in node.inputs.items():
                    if source == dep_node_id:
                        inputs[local_name] = dep_result
        
        # 添加共享数据
        inputs.update(context.shared_data)
        
        # 添加节点配置中的静态输入
        inputs.update(node.config.get('inputs', {}))
        
        return inputs
    
    async def _execute_adapter(
        self,
        adapter_id: str,
        inputs: Dict[str, Any],
        config: Dict[str, Any],
        context: ExecutionContext
    ) -> Any:
        """执行适配器"""
        if adapter_id not in self._adapter_registry:
            raise AdapterValidationError(
                f"适配器未注册: {adapter_id}",
                ErrorCode.ADAPTER_NOT_FOUND
            )
        
        adapter = self._adapter_registry[adapter_id]
        
        # 这里应该调用适配器的执行方法
        # 暂时返回模拟结果，实际实现需要根据具体的适配器接口
        try:
            if hasattr(adapter, 'execute_task'):
                # 对于智能硬适配器
                task_request = {
                    'type': config.get('task_type', 'general'),
                    **inputs
                }
                result = await adapter.execute_task(task_request)
                return result.get('result', result)
            elif hasattr(adapter, 'execute'):
                # 对于其他类型的适配器
                return await adapter.execute(inputs, config)
            else:
                # 回退到基础调用
                return await adapter(inputs)
                
        except Exception as e:
            logger.error(f"适配器执行失败 {adapter_id}: {str(e)}")
            raise AdapterExecutionError(
                f"适配器执行失败: {str(e)}",
                ErrorCode.ADAPTER_EXECUTION_FAILED
            ) from e
    
    def _should_continue_on_error(
        self, 
        graph: CompositionGraph, 
        node_id: str, 
        error: Exception
    ) -> bool:
        """判断在错误发生时是否继续执行"""
        # 检查节点配置
        node = graph.nodes[node_id]
        if node.config.get('continue_on_error', False):
            return True
        
        # 检查错误类型
        if isinstance(error, AdapterValidationError):
            return False  # 验证错误不应该继续
        
        # 检查图级别的配置
        return graph.strategy != CompositionStrategy.PIPELINE  # 流水线模式下不继续
    
    def register_adapter(self, adapter_id: str, adapter_instance: Any) -> None:
        """注册适配器实例"""
        with self._lock:
            self._adapter_registry[adapter_id] = adapter_instance
        logger.info(f"注册适配器: {adapter_id}")
    
    def unregister_adapter(self, adapter_id: str) -> bool:
        """注销适配器实例"""
        with self._lock:
            if adapter_id in self._adapter_registry:
                del self._adapter_registry[adapter_id]
                logger.info(f"注销适配器: {adapter_id}")
                return True
        return False
    
    def get_graph_info(self, graph_id: str) -> Optional[Dict[str, Any]]:
        """获取组合图信息"""
        with self._lock:
            if graph_id not in self._graphs:
                return None
            
            graph = self._graphs[graph_id]
            return {
                'graph_id': graph.graph_id,
                'name': graph.name,
                'description': graph.description,
                'strategy': graph.strategy.value,
                'node_count': len(graph.nodes),
                'edge_count': sum(len(edges) for edges in graph.edges.values()),
                'status': graph.status.value,
                'created_at': graph.created_at.isoformat(),
                'updated_at': graph.updated_at.isoformat(),
                'current_execution_id': graph.current_execution_id
            }
    
    def list_graphs(self) -> List[Dict[str, Any]]:
        """列出所有组合图"""
        with self._lock:
            return [self.get_graph_info(graph_id) for graph_id in self._graphs.keys()]
    
    def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """获取执行状态"""
        with self._lock:
            if execution_id not in self._executions:
                return None
            
            context = self._executions[execution_id]
            return {
                'execution_id': execution_id,
                'graph_id': context.graph_id,
                'status': context.status.value,
                'started_at': context.started_at.isoformat() if context.started_at else None,
                'completed_at': context.completed_at.isoformat() if context.completed_at else None,
                'progress': {
                    'total_nodes': context.total_nodes,
                    'completed_nodes': context.nodes_completed,
                    'failed_nodes': context.nodes_failed
                },
                'errors': context.errors,
                'warnings': context.warnings
            }
    
    # ================================
    # 占位符方法（需要后续实现）
    # ================================
    
    async def _execute_conditional(self, graph: CompositionGraph, context: ExecutionContext) -> Dict[str, Any]:
        """条件执行策略（占位符）"""
        logger.warning("条件执行策略尚未完全实现")
        return await self._execute_sequential(graph, context)
    
    async def _execute_fork_join(self, graph: CompositionGraph, context: ExecutionContext) -> Dict[str, Any]:
        """分叉汇合执行策略（占位符）"""
        logger.warning("分叉汇合执行策略尚未完全实现")
        return await self._execute_parallel(graph, context)
    
    async def _execute_scatter_gather(self, graph: CompositionGraph, context: ExecutionContext) -> Dict[str, Any]:
        """散布收集执行策略（占位符）"""
        logger.warning("散布收集执行策略尚未完全实现")
        return await self._execute_parallel(graph, context)
    
    async def _execute_circuit_breaker(self, graph: CompositionGraph, context: ExecutionContext) -> Dict[str, Any]:
        """熔断器执行策略（占位符）"""
        logger.warning("熔断器执行策略尚未完全实现")
        return await self._execute_sequential(graph, context)
    
    def _serialize_graph(self, graph: CompositionGraph) -> Dict[str, Any]:
        """序列化图为JSON格式（占位符）"""
        return asdict(graph)
    
    def _deserialize_graph(self, data: Dict[str, Any]) -> CompositionGraph:
        """从JSON反序列化图（占位符）"""
        # 简化实现，实际需要更复杂的反序列化逻辑
        return CompositionGraph(**data)
    
    async def _save_all_graphs(self) -> None:
        """保存所有图到存储（占位符）"""
        logger.info("保存组合图到存储")
        
    async def _execution_monitor_loop(self) -> None:
        """执行监控循环（占位符）"""
        logger.info("执行监控循环已启动")
        while not self._shutdown_event.is_set():
            await asyncio.sleep(10)
    
    async def _performance_monitor_loop(self) -> None:
        """性能监控循环（占位符）"""
        logger.info("性能监控循环已启动")
        while not self._shutdown_event.is_set():
            await asyncio.sleep(30)
    
    async def _cleanup_loop(self) -> None:
        """资源清理循环（占位符）"""
        logger.info("资源清理循环已启动")
        while not self._shutdown_event.is_set():
            await asyncio.sleep(60)


# ================================
# 工厂函数和便捷方法
# ================================

def create_composer(config: Optional[CompositionConfiguration] = None) -> AdapterComposer:
    """创建适配器组合器实例"""
    return AdapterComposer(config)


async def create_and_initialize_composer(
    config: Optional[CompositionConfiguration] = None
) -> AdapterComposer:
    """创建并初始化适配器组合器"""
    composer = create_composer(config)
    await composer.initialize()
    return composer

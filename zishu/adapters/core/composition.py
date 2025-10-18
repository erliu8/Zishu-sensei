# -*- coding: utf-8 -*-
"""
适配器组合模块
提供适配器链式组合、管道处理和协同工作功能
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Callable, Union

from ..base import BaseAdapter, ExecutionContext, ExecutionResult, AdapterStatus, HealthCheckResult
from ..base.exceptions import BaseAdapterException

logger = logging.getLogger(__name__)


class CompositionStrategy(Enum):
    """组合策略"""
    SEQUENTIAL = "sequential"  # 顺序执行
    PARALLEL = "parallel"      # 并行执行
    CONDITIONAL = "conditional"  # 条件执行
    PIPELINE = "pipeline"      # 管道执行


class CompositionError(BaseAdapterException):
    """组合错误"""
    pass


@dataclass
class ChainExecutionResult:
    """链式执行结果"""
    chain_id: str
    execution_id: str
    success: bool
    results: List[ExecutionResult]
    errors: List[Exception] = field(default_factory=list)
    execution_time: float = 0.0
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    step_results: List[ExecutionResult] = field(default_factory=list)  # 添加step_results属性
    metadata: Dict[str, Any] = field(default_factory=dict)  # 添加metadata属性
    scatter_results: List[ExecutionResult] = field(default_factory=list)  # 用于散布收集模式
    total_adapters: int = 0  # 总的适配器数量
    error_handling: str = "stop_on_error"  # 错误处理策略
    
    @property
    def status(self) -> str:
        """执行状态"""
        if self.success and len(self.errors) == 0:
            return "success"
        elif len(self.errors) > 0:
            # 检查是否有成功的结果
            success_count = sum(1 for r in self.results if r.status == "success")
            error_count = sum(1 for r in self.results if r.status == "error")
            
            # 如果是 stop_on_error 模式，并且有错误导致链中断
            if self.error_handling == "stop_on_error" and error_count > 0:
                # 检查是否所有适配器都执行了
                if len(self.results) < self.total_adapters:
                    # 链被中断了，返回 error
                    return "error"
            
            # continue_on_error 模式或所有适配器都执行完了
            if success_count > 0 and error_count > 0:
                # 部分成功
                return "partial_success"
            elif success_count == 0:
                # 完全失败
                return "error"
            else:
                # 所有都成功，但有错误记录（不应该发生）
                return "partial_success"
        else:
            return "partial_success" if not self.success else "success"
    
    @property
    def error_message(self) -> str:
        """错误消息"""
        if self.errors:
            return "; ".join(str(e) for e in self.errors)
        return ""
    
    
@dataclass
class PipelineConfig:
    """管道配置"""
    name: str
    adapters: List[str]
    strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL
    error_handling: str = "stop"  # stop, continue, retry
    max_retries: int = 3
    timeout: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class AdapterChain:
    """适配器链"""
    
    def __init__(self, config=None, adapters=None, chain_id: str = None, strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL):
        # 支持两种构造方式
        if isinstance(config, dict) and adapters is not None:
            # 新的测试方式: AdapterChain(config_dict, adapters_list)
            self.chain_id = config.get("chain_id", str(uuid.uuid4()))
            self.name = config.get("name", "")
            self.description = config.get("description", "")
            strategy_str = config.get("execution_strategy", "sequential")
            self.strategy = self._parse_strategy(strategy_str)
            self.error_handling = config.get("error_handling", "stop_on_error")
            self.timeout = config.get("timeout")
            self.adapters: List[BaseAdapter] = list(adapters) if adapters else []
        else:
            # 原有的方式: AdapterChain(chain_id, strategy)
            self.chain_id = config or chain_id or str(uuid.uuid4())
            self.name = ""
            self.description = ""
            self.strategy = strategy
            self.error_handling = "stop_on_error"
            self.timeout = None
            self.adapters: List[BaseAdapter] = []
            
        # 初始化conditions列表，长度与adapters相同
        self.conditions: List[Callable] = [None] * len(self.adapters)
        self._initialized = False
        
        # 执行历史追踪
        self._execution_history: List[ChainExecutionResult] = []
        self._total_executions = 0
        self._successful_executions = 0
        self._failed_executions = 0
        self._total_execution_time = 0.0
        
    def _parse_strategy(self, strategy_str: str) -> CompositionStrategy:
        """解析策略字符串"""
        strategy_map = {
            "sequential": CompositionStrategy.SEQUENTIAL,
            "parallel": CompositionStrategy.PARALLEL,
            "conditional": CompositionStrategy.CONDITIONAL,
            "pipeline": CompositionStrategy.PIPELINE
        }
        return strategy_map.get(strategy_str.lower(), CompositionStrategy.SEQUENTIAL)
        
    @property
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
        
    @property
    def execution_strategy(self) -> str:
        """获取执行策略"""
        return self.strategy.value
        
    async def initialize(self):
        """初始化适配器链"""
        logger.info(f"Initializing adapter chain {self.chain_id}")
        
        # 初始化链中的所有适配器
        for adapter in self.adapters:
            if hasattr(adapter, 'initialize') and not getattr(adapter, 'is_initialized', False):
                await adapter.initialize()
                logger.debug(f"Initialized adapter {adapter.__class__.__name__}")
        
        self._initialized = True
        logger.info(f"Adapter chain {self.chain_id} initialized successfully")
        
    def add_adapter(self, adapter: BaseAdapter, condition: Optional[Callable] = None):
        """添加适配器到链中"""
        self.adapters.append(adapter)
        self.conditions.append(condition)
        
    async def execute(self, input_data: Any, context: ExecutionContext) -> ChainExecutionResult:
        """执行适配器链"""
        # 将input_data设置到context中
        if hasattr(context, 'data'):
            context.data.update(input_data if isinstance(input_data, dict) else {"input": input_data})
        else:
            # 如果context没有data属性，创建一个简单的数据存储
            setattr(context, 'data', input_data if isinstance(input_data, dict) else {"input": input_data})
            
        execution_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        results = []
        errors = []
        
        try:
            if self.strategy == CompositionStrategy.SEQUENTIAL:
                results, errors = await self._execute_sequential(context)
            elif self.strategy == CompositionStrategy.PARALLEL:
                results, errors = await self._execute_parallel(context)
            elif self.strategy == CompositionStrategy.CONDITIONAL:
                results, errors = await self._execute_conditional(context)
            else:
                raise CompositionError(f"Unsupported strategy: {self.strategy}")
                
        except Exception as e:
            errors.append(e)
            
        end_time = datetime.now(timezone.utc)
        execution_time = (end_time - start_time).total_seconds()
        
        # 过滤掉异常结果
        valid_results = [r for r in results if not isinstance(r, Exception)]
        
        # 创建执行结果
        result = ChainExecutionResult(
            chain_id=self.chain_id,
            execution_id=execution_id,
            success=len(errors) == 0,
            results=valid_results,
            errors=errors,
            execution_time=execution_time,
            started_at=start_time,
            finished_at=end_time,
            step_results=valid_results,
            total_adapters=len(self.adapters),
            error_handling=self.error_handling
        )
        
        # 更新执行统计
        self._total_executions += 1
        if len(errors) == 0:
            self._successful_executions += 1
        else:
            self._failed_executions += 1
        self._total_execution_time += execution_time
        self._execution_history.append(result)
        
        return result
        
    async def _execute_sequential(self, context: ExecutionContext):
        """顺序执行"""
        results = []
        errors = []
        
        for i, adapter in enumerate(self.adapters):
            try:
                condition = self.conditions[i]
                # 如果有条件，检查条件是否满足
                if condition:
                    # 尝试不同的条件函数签名
                    try:
                        should_execute = condition(context.data, context)
                    except TypeError:
                        try:
                            should_execute = condition(context)
                        except TypeError:
                            should_execute = condition()
                    
                    if not should_execute:
                        continue
                    
                # 调用适配器的_process_impl方法或execute方法
                if hasattr(adapter, 'execute'):
                    result = await adapter.execute(context)
                elif hasattr(adapter, '_process_impl'):
                    # 创建ExecutionResult包装
                    data = await adapter._process_impl(context.data, context)
                    result = ExecutionResult(
                        execution_id=str(uuid.uuid4()),
                        adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                        status="success",
                        output=data,
                        execution_time=0.0
                    )
                else:
                    raise AttributeError(f"Adapter {adapter.__class__.__name__} has no execute or _process_impl method")
                    
                results.append(result)
                
                # 将结果传递给下一个适配器
                if hasattr(result, 'output') and isinstance(result.output, dict):
                    context.data.update(result.output)
                elif hasattr(result, 'data') and isinstance(result.data, dict):
                    context.data.update(result.data)
                
            except Exception as e:
                # 记录错误的适配器执行结果
                error_result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                    status="error",
                    output=None,
                    error=str(e),
                    execution_time=0.0
                )
                results.append(error_result)
                errors.append(e)
                
                # 根据错误处理策略决定是否继续
                if self.error_handling == "stop_on_error":
                    break
                # 如果是 continue_on_error，继续执行下一个适配器
                
        return results, errors
        
    async def _execute_parallel(self, context: ExecutionContext):
        """并行执行"""
        results = []
        errors = []
        
        tasks = []
        for i, adapter in enumerate(self.adapters):
            condition = self.conditions[i]
            if condition and not condition(context):
                continue
            # 创建任务，支持不同的适配器接口
            if hasattr(adapter, 'execute'):
                tasks.append(adapter.execute(context))
            elif hasattr(adapter, '_process_impl'):
                async def process_wrapper(adapter, context):
                    data = await adapter._process_impl(context.data, context)
                    return ExecutionResult(
                        execution_id=str(uuid.uuid4()),
                        adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                        status="success",
                        output=data,
                        execution_time=0.0
                    )
                tasks.append(process_wrapper(adapter, context))
            else:
                raise AttributeError(f"Adapter {adapter.__class__.__name__} has no execute or _process_impl method")
            
        if tasks:
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for result in results:
                    if isinstance(result, Exception):
                        errors.append(result)
            except Exception as e:
                errors.append(e)
                
        return results, errors
        
    async def _execute_conditional(self, context: ExecutionContext):
        """条件执行"""
        results = []
        errors = []
        
        for i, adapter in enumerate(self.adapters):
            try:
                condition = self.conditions[i]
                if condition and not condition(context):
                    continue
                    
                # 调用适配器的_process_impl方法或execute方法
                if hasattr(adapter, 'execute'):
                    result = await adapter.execute(context)
                elif hasattr(adapter, '_process_impl'):
                    data = await adapter._process_impl(context.data, context)
                    result = ExecutionResult(
                        execution_id=str(uuid.uuid4()),
                        adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                        status="success",
                        output=data,
                        execution_time=0.0
                    )
                else:
                    raise AttributeError(f"Adapter {adapter.__class__.__name__} has no execute or _process_impl method")
                    
                results.append(result)
                
                # 根据结果决定是否继续
                if result.status != "success":
                    break
                    
                if hasattr(result, 'output') and isinstance(result.output, dict):
                    context.data.update(result.output)
                elif hasattr(result, 'data') and isinstance(result.data, dict):
                    context.data.update(result.data)
                
            except Exception as e:
                errors.append(e)
                break
                
        return results, errors
        
    async def health_check(self) -> HealthCheckResult:
        """检查适配器链的健康状态"""
        healthy_adapters = 0
        total_adapters = len(self.adapters)
        adapter_health = {}
        issues = []
        
        for adapter in self.adapters:
            try:
                if hasattr(adapter, 'health_check'):
                    health = await adapter.health_check()
                    is_healthy = health.is_healthy if hasattr(health, 'is_healthy') else True
                else:
                    # 如果适配器没有health_check方法，认为它是健康的
                    is_healthy = True
                    
                adapter_health[adapter.__class__.__name__] = is_healthy
                if is_healthy:
                    healthy_adapters += 1
                else:
                    issues.append(f"Adapter {adapter.__class__.__name__} is unhealthy")
                    
            except Exception as e:
                adapter_health[adapter.__class__.__name__] = False
                issues.append(f"Health check failed for adapter {adapter.__class__.__name__}: {e}")
                logger.error(f"Health check failed for adapter {adapter.__class__.__name__}: {e}")
        
        all_healthy = healthy_adapters == total_adapters
        status = "healthy" if all_healthy else "degraded"
        
        return HealthCheckResult(
            is_healthy=all_healthy,
            status=status,
            message=f"Chain health: {healthy_adapters}/{total_adapters} adapters healthy",
            checks=adapter_health,
            metrics={
                "total_adapters": total_adapters,
                "healthy_adapters": healthy_adapters,
                "chain_id": self.chain_id
            },
            issues=issues
        )
        
    async def get_metrics(self) -> Dict[str, Any]:
        """获取链执行指标"""
        # 计算平均执行时间
        average_execution_time = (
            self._total_execution_time / self._total_executions 
            if self._total_executions > 0 else 0.0
        )
        
        # 收集每个适配器的指标
        adapter_metrics = {}
        for adapter in self.adapters:
            adapter_name = adapter.__class__.__name__
            adapter_metrics[adapter_name] = {
                "adapter_id": getattr(adapter, 'adapter_id', adapter_name),
                "type": getattr(adapter, 'adapter_type', 'unknown'),
                "initialized": getattr(adapter, 'is_initialized', False)
            }
        
        return {
            "chain_id": self.chain_id,
            "adapter_count": len(self.adapters),
            "execution_strategy": self.execution_strategy,
            "initialized": self.is_initialized,
            "error_handling": self.error_handling,
            "total_executions": self._total_executions,
            "successful_executions": self._successful_executions,
            "failed_executions": self._failed_executions,
            "average_execution_time": average_execution_time,
            "total_execution_time": self._total_execution_time,
            "adapter_metrics": adapter_metrics
        }


class AdapterPipeline:
    """适配器管道"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.adapters: Dict[str, BaseAdapter] = {}
        self.stages: List[Dict[str, Any]] = []
        self.buffer: Dict[str, Any] = {}
        self._initialized = False
        
    @property
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
        
    async def initialize(self):
        """初始化管道各阶段"""
        logger.info(f"Initializing adapter pipeline {self.config.name}")
        
        # 初始化所有适配器
        for adapter in self.adapters.values():
            if hasattr(adapter, 'initialize') and not getattr(adapter, 'is_initialized', False):
                await adapter.initialize()
                
        # 构建阶段信息
        self.stages = []
        # 如果config.adapters有内容，创建对应的stages
        if self.config.adapters:
            for stage_name in self.config.adapters:
                stage_info = {
                    'adapter_id': stage_name,
                    'adapter': self.adapters.get(stage_name),  # 可能为None
                    'status': 'pending' if stage_name not in self.adapters else 'ready'
                }
                self.stages.append(stage_info)
                
        # 初始化缓冲区
        self.buffer = {
            'input_buffer': [],
            'output_buffer': [],
            'error_buffer': []
        }
        
        self._initialized = True
        logger.info(f"Adapter pipeline {self.config.name} initialized successfully")
        
    def add_adapter(self, adapter_id: str, adapter: BaseAdapter):
        """添加适配器"""
        self.adapters[adapter_id] = adapter
        
    async def add_adapter_to_stage(self, stage_name: str, adapter: BaseAdapter):
        """添加适配器到指定阶段"""
        # 使用 stage_name 作为键，这样 get_stage_adapters 可以正确查找
        self.adapters[stage_name] = adapter
        
        # 如果配置中没有该阶段，添加到配置
        if stage_name not in self.config.adapters:
            self.config.adapters.append(stage_name)
            
        # 重新构建阶段信息
        await self._rebuild_stages()
        
    def get_stage_adapters(self, stage_name: str) -> List[BaseAdapter]:
        """获取指定阶段的适配器列表"""
        # 直接查找以 stage_name 为键的适配器
        adapter = self.adapters.get(stage_name)
        if adapter:
            return [adapter]
        
        # 如果没有找到，尝试模糊匹配
        stage_adapters = []
        for adapter_id, adapter in self.adapters.items():
            # 检查adapter_id是否以stage_name开头或包含stage_name
            if adapter_id.startswith(stage_name) or f"_{stage_name}_" in adapter_id or adapter_id.endswith(f"_{stage_name}"):
                stage_adapters.append(adapter)
        return stage_adapters
        
    async def _rebuild_stages(self):
        """重新构建阶段信息"""
        self.stages = []
        for adapter_id in self.config.adapters:
            if adapter_id in self.adapters:
                stage_info = {
                    'adapter_id': adapter_id,
                    'adapter': self.adapters[adapter_id],
                    'status': 'ready'
                }
                self.stages.append(stage_info)
        
    async def execute(self, context: ExecutionContext) -> ChainExecutionResult:
        """执行管道"""
        chain = AdapterChain(
            chain_id=f"pipeline_{self.config.name}",
            strategy=self.config.strategy
        )
        
        # 按配置顺序添加适配器
        for adapter_id in self.config.adapters:
            if adapter_id in self.adapters:
                chain.add_adapter(self.adapters[adapter_id])
                
        return await chain.execute(context)
    
    async def process_batch(self, batch_data: List[Dict[str, Any]], context: ExecutionContext) -> List[ChainExecutionResult]:
        """批量处理数据"""
        results = []
        
        # 创建执行链
        chain = AdapterChain(
            chain_id=f"pipeline_{self.config.name}_batch",
            strategy=self.config.strategy
        )
        
        # 按配置顺序添加适配器
        for adapter_id in self.config.adapters:
            if adapter_id in self.adapters:
                chain.add_adapter(self.adapters[adapter_id])
        
        # 初始化链
        if not chain.is_initialized:
            await chain.initialize()
        
        # 处理每个批次项
        for item in batch_data:
            # 为每个项创建新的上下文
            item_context = ExecutionContext(
                request_id=f"{context.request_id}_{len(results)}",
                user_id=context.user_id,
                session_id=context.session_id,
                priority=context.priority,
                timeout=context.timeout
            )
            item_context.data = item
            
            result = await chain.execute(item, item_context)
            results.append(result)
        
        return results
    
    async def start(self):
        """启动管道"""
        logger.info(f"Starting pipeline {self.config.name}")
        
        # 初始化所有适配器
        for adapter in self.adapters.values():
            if hasattr(adapter, 'initialize') and not getattr(adapter, 'is_initialized', False):
                await adapter.initialize()
        
        # 标记为已初始化
        self._initialized = True
        logger.info(f"Pipeline {self.config.name} started successfully")
    
    async def add_to_buffer(self, item: Dict[str, Any]):
        """添加数据到缓冲区，带背压控制"""
        if 'input_buffer' not in self.buffer:
            self.buffer['input_buffer'] = []
        
        buffer_size = getattr(self.config, 'buffer_size', 10)
        
        # 如果缓冲区满了，等待处理完成（背压）
        while len(self.buffer['input_buffer']) >= buffer_size:
            await self._process_buffer()
            # 稍微等待一下，让缓冲区有时间清空
            await asyncio.sleep(0.01)
        
        self.buffer['input_buffer'].append(item)
    
    async def _process_buffer(self):
        """处理缓冲区中的数据"""
        if not self.buffer.get('input_buffer'):
            return
        
        # 获取缓冲区数据
        items = self.buffer['input_buffer']
        self.buffer['input_buffer'] = []
        
        # 创建执行链
        chain = AdapterChain(
            chain_id=f"pipeline_{self.config.name}_buffer",
            strategy=self.config.strategy
        )
        
        # 按配置顺序添加适配器
        for adapter_id in self.config.adapters:
            if adapter_id in self.adapters:
                chain.add_adapter(self.adapters[adapter_id])
        
        # 初始化链
        if not chain.is_initialized:
            await chain.initialize()
        
        # 处理每个项
        for item in items:
            context = ExecutionContext(request_id=f"buffer_{uuid.uuid4().hex[:8]}")
            context.data = item
            
            result = await chain.execute(item, context)
            
            # 将结果添加到输出缓冲区
            if 'output_buffer' not in self.buffer:
                self.buffer['output_buffer'] = []
            self.buffer['output_buffer'].append(result)
    
    async def process_stream(self, data_stream):
        """处理数据流"""
        async for item in data_stream:
            # 创建执行链
            chain = AdapterChain(
                chain_id=f"pipeline_{self.config.name}_stream",
                strategy=self.config.strategy
            )
            
            # 按配置顺序添加适配器
            for adapter_id in self.config.adapters:
                if adapter_id in self.adapters:
                    chain.add_adapter(self.adapters[adapter_id])
            
            # 初始化链
            if not chain.is_initialized:
                await chain.initialize()
            
            # 处理单个项
            context = ExecutionContext(request_id=f"stream_{uuid.uuid4().hex[:8]}")
            context.data = item
            
            result = await chain.execute(item, context)
            yield result


class AdapterComposer:
    """适配器组合器"""
    
    def __init__(self):
        self.chains: Dict[str, AdapterChain] = {}
        self.pipelines: Dict[str, AdapterPipeline] = {}
        
    async def compose_linear_chain(self, adapters: List[BaseAdapter], chain_id: str = None, **kwargs) -> AdapterChain:
        """创建线性适配器链"""
        if chain_id is None:
            chain_id = f"linear_chain_{uuid.uuid4().hex[:8]}"
            
        chain = AdapterChain(chain_id, CompositionStrategy.SEQUENTIAL)
        
        # 添加适配器到链中
        for adapter in adapters:
            chain.add_adapter(adapter)
            
        # 缓存链
        self.chains[chain_id] = chain
        logger.info(f"Created linear chain {chain_id} with {len(adapters)} adapters")
        
        return chain
        
    def create_chain(self, chain_id: str, strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL) -> AdapterChain:
        """创建适配器链"""
        chain = AdapterChain(chain_id, strategy)
        self.chains[chain_id] = chain
        return chain
        
    def create_pipeline(self, config: PipelineConfig) -> AdapterPipeline:
        """创建适配器管道"""
        pipeline = AdapterPipeline(config)
        self.pipelines[config.name] = pipeline
        return pipeline
        
    def get_chain(self, chain_id: str) -> Optional[AdapterChain]:
        """获取适配器链"""
        return self.chains.get(chain_id)
        
    def get_pipeline(self, pipeline_name: str) -> Optional[AdapterPipeline]:
        """获取适配器管道"""
        return self.pipelines.get(pipeline_name)
        
    async def execute_chain(self, chain_id: str, context: ExecutionContext) -> ChainExecutionResult:
        """执行适配器链"""
        chain = self.get_chain(chain_id)
        if not chain:
            raise CompositionError(f"Chain not found: {chain_id}")
        return await chain.execute(context)
        
    async def execute_pipeline(self, pipeline_name: str, context: ExecutionContext) -> ChainExecutionResult:
        """执行适配器管道"""
        pipeline = self.get_pipeline(pipeline_name)
        if not pipeline:
            raise CompositionError(f"Pipeline not found: {pipeline_name}")
        return await pipeline.execute(context)
        
    async def compose_parallel_group(self, adapters: List[BaseAdapter], group_id: str = None, **kwargs) -> AdapterChain:
        """创建并行适配器组"""
        if group_id is None:
            group_id = f"parallel_group_{uuid.uuid4().hex[:8]}"
            
        chain = AdapterChain(chain_id=group_id, strategy=CompositionStrategy.PARALLEL)
        
        # 添加适配器到链中
        for adapter in adapters:
            chain.add_adapter(adapter)
            
        # 缓存链
        self.chains[group_id] = chain
        logger.info(f"Created parallel group {group_id} with {len(adapters)} adapters")
        
        return chain
        
    async def compose_conditional_chain(self, primary_adapter: BaseAdapter, conditional_adapter: BaseAdapter, 
                                      condition: Callable, chain_id: str = None, **kwargs) -> AdapterChain:
        """创建条件适配器链"""
        if chain_id is None:
            chain_id = f"conditional_chain_{uuid.uuid4().hex[:8]}"
            
        chain = AdapterChain(chain_id, CompositionStrategy.CONDITIONAL)
        
        # 添加主适配器（无条件）
        chain.add_adapter(primary_adapter)
        
        # 添加条件适配器（有条件）
        chain.add_adapter(conditional_adapter, condition)
        
        # 缓存链
        self.chains[chain_id] = chain
        logger.info(f"Created conditional chain {chain_id}")
        
        return chain
        
    async def compose_feedback_loop(self, adapter: BaseAdapter, condition: Callable, max_iterations: int = 3, **kwargs) -> AdapterChain:
        """创建反馈循环适配器"""
        loop_id = f"feedback_loop_{uuid.uuid4().hex[:8]}"
        
        # 创建一个特殊的链来处理反馈循环
        chain = AdapterChain(loop_id, CompositionStrategy.SEQUENTIAL)
        
        # 为链添加反馈逻辑（这里简化处理）
        chain.feedback_condition = condition
        chain.max_iterations = max_iterations
        
        # 重写execute方法以支持反馈循环
        original_execute = chain.execute
        
        async def feedback_execute(input_data, context):
            iteration = 0
            result = None
            
            while iteration < max_iterations:
                # 执行适配器
                if hasattr(adapter, 'execute'):
                    result = await adapter.execute(context)
                elif hasattr(adapter, '_process_impl'):
                    data = await adapter._process_impl(context.data if hasattr(context, 'data') else input_data, context)
                    result = ExecutionResult(
                        execution_id=str(uuid.uuid4()),
                        adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                        status="success",
                        output=data,
                        execution_time=0.0
                    )
                
                iteration += 1
                
                # 检查是否需要继续迭代
                output = result.output if hasattr(result, 'output') else result
                if not condition(output, iteration):
                    break
                
                # 更新上下文数据以供下一次迭代
                if hasattr(context, 'data') and isinstance(output, dict):
                    context.data.update(output)
            
            # 创建包含迭代信息的结果
            chain_result = ChainExecutionResult(
                chain_id=chain.chain_id,
                execution_id=str(uuid.uuid4()),
                success=True,
                results=[result] if result else [],
                errors=[],
                execution_time=0.0,
                step_results=[result] if result else [],
                metadata={"iterations": iteration},
                total_adapters=len(chain.adapters),
                error_handling=chain.error_handling
            )
            
            return chain_result
        
        chain.execute = feedback_execute
        
        # 缓存链
        self.chains[loop_id] = chain
        logger.info(f"Created feedback loop {loop_id} with max {max_iterations} iterations")
        
        return chain
        
    async def compose_fan_out_fan_in(self, input_adapter: BaseAdapter, parallel_adapters: List[BaseAdapter],
                                   output_adapter: BaseAdapter, aggregation_strategy: str = "merge", **kwargs) -> AdapterChain:
        """创建扇出扇入模式"""
        fan_id = f"fan_out_fan_in_{uuid.uuid4().hex[:8]}"
        
        # 创建复合链
        chain = AdapterChain(fan_id, CompositionStrategy.SEQUENTIAL)
        
        # 重写execute方法以实现扇出扇入模式
        async def fan_out_fan_in_execute(input_data, context):
            # 1. 执行输入适配器
            if hasattr(input_adapter, 'execute'):
                input_result = await input_adapter.execute(context)
            elif hasattr(input_adapter, '_process_impl'):
                data = await input_adapter._process_impl(context.data if hasattr(context, 'data') else input_data, context)
                input_result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=getattr(input_adapter, 'adapter_id', input_adapter.__class__.__name__),
                    status="success",
                    output=data,
                    execution_time=0.0
                )
            
            # 更新上下文
            if hasattr(input_result, 'output') and isinstance(input_result.output, dict):
                context.data.update(input_result.output)
            
            # 2. 并行执行所有适配器
            parallel_tasks = []
            for adapter in parallel_adapters:
                if hasattr(adapter, 'execute'):
                    parallel_tasks.append(adapter.execute(context))
                elif hasattr(adapter, '_process_impl'):
                    async def process_wrapper(adapter, context):
                        data = await adapter._process_impl(context.data, context)
                        return ExecutionResult(
                            execution_id=str(uuid.uuid4()),
                            adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                            status="success",
                            output=data,
                            execution_time=0.0
                        )
                    parallel_tasks.append(process_wrapper(adapter, context))
            
            parallel_results = await asyncio.gather(*parallel_tasks, return_exceptions=True)
            
            # 3. 聚合并行结果
            aggregated_data = {}
            for result in parallel_results:
                if not isinstance(result, Exception) and hasattr(result, 'output') and isinstance(result.output, dict):
                    aggregated_data.update(result.output)
            
            context.data.update(aggregated_data)
            
            # 4. 执行输出适配器
            if hasattr(output_adapter, 'execute'):
                output_result = await output_adapter.execute(context)
            elif hasattr(output_adapter, '_process_impl'):
                data = await output_adapter._process_impl(context.data, context)
                output_result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=getattr(output_adapter, 'adapter_id', output_adapter.__class__.__name__),
                    status="success",
                    output=data,
                    execution_time=0.0
                )
            
            # 创建结果
            all_results = [input_result] + [r for r in parallel_results if not isinstance(r, Exception)] + [output_result]
            chain_result = ChainExecutionResult(
                chain_id=chain.chain_id,
                execution_id=str(uuid.uuid4()),
                success=True,
                results=all_results,
                errors=[],
                execution_time=0.0,
                step_results=all_results,
                metadata={"aggregated_results": aggregated_data},
                total_adapters=len(chain.adapters),
                error_handling=chain.error_handling
            )
            
            return chain_result
        
        chain.execute = fan_out_fan_in_execute
        
        # 缓存链
        self.chains[fan_id] = chain
        logger.info(f"Created fan-out-fan-in {fan_id}")
        
        return chain
        
    async def compose_scatter_gather(self, scatter_adapters: List[BaseAdapter], gather_adapter: BaseAdapter,
                                   scatter_strategy: str = "broadcast", **kwargs) -> AdapterChain:
        """创建散布收集模式"""
        sg_id = f"scatter_gather_{uuid.uuid4().hex[:8]}"
        
        # 创建链
        chain = AdapterChain(sg_id, CompositionStrategy.SEQUENTIAL)
        
        # 重写execute方法以实现散布收集模式
        async def scatter_gather_execute(input_data, context):
            # 1. 并行执行所有散布适配器
            scatter_tasks = []
            for adapter in scatter_adapters:
                if hasattr(adapter, 'execute'):
                    scatter_tasks.append(adapter.execute(context))
                elif hasattr(adapter, '_process_impl'):
                    async def process_wrapper(adapter, context):
                        data = await adapter._process_impl(context.data if hasattr(context, 'data') else input_data, context)
                        return ExecutionResult(
                            execution_id=str(uuid.uuid4()),
                            adapter_id=getattr(adapter, 'adapter_id', adapter.__class__.__name__),
                            status="success",
                            output=data,
                            execution_time=0.0
                        )
                    scatter_tasks.append(process_wrapper(adapter, context))
            
            scatter_results = await asyncio.gather(*scatter_tasks, return_exceptions=True)
            
            # 过滤掉异常结果
            valid_scatter_results = [r for r in scatter_results if not isinstance(r, Exception)]
            
            # 2. 聚合散布结果
            aggregated_data = {}
            for result in valid_scatter_results:
                if hasattr(result, 'output') and isinstance(result.output, dict):
                    aggregated_data.update(result.output)
            
            # 更新上下文
            context.data.update(aggregated_data)
            
            # 3. 执行收集适配器
            if hasattr(gather_adapter, 'execute'):
                gather_result = await gather_adapter.execute(context)
            elif hasattr(gather_adapter, '_process_impl'):
                data = await gather_adapter._process_impl(context.data, context)
                gather_result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=getattr(gather_adapter, 'adapter_id', gather_adapter.__class__.__name__),
                    status="success",
                    output=data,
                    execution_time=0.0
                )
            
            # 创建结果
            all_results = valid_scatter_results + [gather_result]
            chain_result = ChainExecutionResult(
                chain_id=chain.chain_id,
                execution_id=str(uuid.uuid4()),
                success=True,
                results=all_results,
                errors=[],
                execution_time=0.0,
                step_results=all_results,
                scatter_results=valid_scatter_results,
                total_adapters=len(chain.adapters),
                error_handling=chain.error_handling
            )
            
            return chain_result
        
        chain.execute = scatter_gather_execute
        
        # 缓存链
        self.chains[sg_id] = chain
        logger.info(f"Created scatter-gather {sg_id}")
        
        return chain
        
    async def add_circuit_breaker(self, adapter: BaseAdapter, failure_threshold: int = 3, 
                                recovery_timeout: float = 1.0, **kwargs) -> 'CircuitBreakerAdapter':
        """为适配器添加熔断器"""
        # 创建一个包装适配器来实现熔断器模式
        wrapper = CircuitBreakerAdapter(adapter, failure_threshold, recovery_timeout)
        
        logger.info(f"Added circuit breaker to adapter {adapter.__class__.__name__}")
        return wrapper


class CircuitBreakerAdapter:
    """熔断器适配器包装器"""
    
    def __init__(self, adapter: BaseAdapter, failure_threshold: int = 3, recovery_timeout: float = 1.0):
        self.wrapped_adapter = adapter
        self.adapter = adapter  # 为了兼容测试，添加adapter属性
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
        
        # 转发属性访问
        self.adapter_id = getattr(adapter, 'adapter_id', adapter.__class__.__name__)
        self.__class__.__name__ = f"CircuitBreaker_{adapter.__class__.__name__}"
    
    def __getattr__(self, name):
        """转发属性访问到被包装的适配器"""
        return getattr(self.wrapped_adapter, name)
    
    async def execute(self, *args, **kwargs):
        """执行适配器，带熔断器保护"""
        # 检查熔断器状态
        if self.state == 'open':
            # 检查是否可以尝试恢复
            if self.last_failure_time and (datetime.now(timezone.utc) - self.last_failure_time).total_seconds() > self.recovery_timeout:
                self.state = 'half-open'
            else:
                # 熔断器开启，直接返回错误
                return ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=self.adapter_id,
                    status="error",
                    output=None,
                    error="Circuit breaker is open",
                    execution_time=0.0
                )
        
        try:
            # 执行适配器
            if hasattr(self.wrapped_adapter, 'execute'):
                result = await self.wrapped_adapter.execute(*args, **kwargs)
            elif hasattr(self.wrapped_adapter, '_process_impl'):
                context = args[0] if args else kwargs.get('context')
                data = await self.wrapped_adapter._process_impl(context.data if hasattr(context, 'data') else {}, context)
                result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    adapter_id=self.adapter_id,
                    status="success",
                    output=data,
                    execution_time=0.0
                )
            
            # 成功执行，重置失败计数
            if self.state == 'half-open':
                self.state = 'closed'
            self.failure_count = 0
            
            return result
            
        except Exception as e:
            # 记录失败
            self.failure_count += 1
            self.last_failure_time = datetime.now(timezone.utc)
            
            # 检查是否达到熔断阈值
            if self.failure_count >= self.failure_threshold:
                self.state = 'open'
            
            # 返回错误结果
            return ExecutionResult(
                execution_id=str(uuid.uuid4()),
                adapter_id=self.adapter_id,
                status="error",
                output=None,
                error=str(e),
                execution_time=0.0
            )

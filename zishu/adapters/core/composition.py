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

from ..base import BaseAdapter, ExecutionContext, ExecutionResult, AdapterStatus
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
    
    def __init__(self, chain_id: str = None, strategy: CompositionStrategy = CompositionStrategy.SEQUENTIAL):
        self.chain_id = chain_id or str(uuid.uuid4())
        self.strategy = strategy
        self.adapters: List[BaseAdapter] = []
        self.conditions: List[Callable] = []
        
    def add_adapter(self, adapter: BaseAdapter, condition: Optional[Callable] = None):
        """添加适配器到链中"""
        self.adapters.append(adapter)
        self.conditions.append(condition)
        
    async def execute(self, context: ExecutionContext) -> ChainExecutionResult:
        """执行适配器链"""
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
        
        return ChainExecutionResult(
            chain_id=self.chain_id,
            execution_id=execution_id,
            success=len(errors) == 0,
            results=results,
            errors=errors,
            execution_time=execution_time,
            started_at=start_time,
            finished_at=end_time
        )
        
    async def _execute_sequential(self, context: ExecutionContext):
        """顺序执行"""
        results = []
        errors = []
        
        for i, adapter in enumerate(self.adapters):
            try:
                condition = self.conditions[i]
                if condition and not condition(context):
                    continue
                    
                result = await adapter.execute(context)
                results.append(result)
                
                # 将结果传递给下一个适配器
                context.data.update(result.data)
                
            except Exception as e:
                errors.append(e)
                break
                
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
            tasks.append(adapter.execute(context))
            
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
                    
                result = await adapter.execute(context)
                results.append(result)
                
                # 根据结果决定是否继续
                if not result.success:
                    break
                    
                context.data.update(result.data)
                
            except Exception as e:
                errors.append(e)
                break
                
        return results, errors


class AdapterPipeline:
    """适配器管道"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.adapters: Dict[str, BaseAdapter] = {}
        
    def add_adapter(self, adapter_id: str, adapter: BaseAdapter):
        """添加适配器"""
        self.adapters[adapter_id] = adapter
        
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


class AdapterComposer:
    """适配器组合器"""
    
    def __init__(self):
        self.chains: Dict[str, AdapterChain] = {}
        self.pipelines: Dict[str, AdapterPipeline] = {}
        
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

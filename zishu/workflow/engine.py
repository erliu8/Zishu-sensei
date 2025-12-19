"""
工作流执行引擎
负责解析和执行工作流定义
"""

import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging

from ..models.workflow import (
    Workflow,
    WorkflowExecution,
    WorkflowNode,
    NodeType,
    ExecutionStatus,
)

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    工作流执行引擎
    
    负责：
    1. 解析工作流定义
    2. 执行工作流节点
    3. 处理节点间的数据流
    4. 管理执行状态
    """

    def __init__(self):
        self.node_executors = {}
        self._register_default_executors()

    def _register_default_executors(self):
        """注册默认的节点执行器"""
        from .executor import (
            StartNodeExecutor,
            EndNodeExecutor,
            AdapterNodeExecutor,
            ConditionNodeExecutor,
            DelayNodeExecutor,
        )

        self.node_executors[NodeType.START] = StartNodeExecutor()
        self.node_executors[NodeType.END] = EndNodeExecutor()
        self.node_executors[NodeType.ADAPTER] = AdapterNodeExecutor()
        self.node_executors[NodeType.CONDITION] = ConditionNodeExecutor()
        self.node_executors[NodeType.DELAY] = DelayNodeExecutor()

    async def execute(
        self,
        workflow: Workflow,
        execution: WorkflowExecution,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        执行工作流
        
        Args:
            workflow: 工作流定义
            execution: 执行记录
            context: 执行上下文（包含输入数据和变量）
            
        Returns:
            执行结果字典
        """
        logger.info(f"开始执行工作流: {workflow.name} (ID: {workflow.id})")

        try:
            # 解析工作流定义
            nodes = self._parse_nodes(workflow.definition)
            edges = self._parse_edges(workflow.definition)

            # 构建执行图
            execution_graph = self._build_execution_graph(nodes, edges)

            # 找到开始节点
            start_nodes = [n for n in nodes if n["type"] == NodeType.START.value]
            if not start_nodes:
                raise ValueError("工作流缺少开始节点")

            # 初始化执行状态
            node_results = {}
            execution_context = {
                "input": execution.input_data or {},
                "variables": context.get("variables", {}),
                "workflow_id": workflow.id,
                "execution_id": execution.id,
                "all_nodes": nodes,  # 添加所有节点引用
            }

            # 从开始节点执行
            for start_node in start_nodes:
                await self._execute_node(
                    start_node,
                    execution_graph,
                    execution_context,
                    node_results,
                )

            # 返回执行结果
            return {
                "status": "success",
                "output": execution_context.get("output", {}),
                "node_results": node_results,
            }

        except Exception as e:
            logger.error(f"工作流执行失败: {str(e)}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "node_results": {},
            }

    async def _execute_node(
        self,
        node: Dict[str, Any],
        execution_graph: Dict[str, List[str]],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行单个节点
        
        Args:
            node: 节点定义
            execution_graph: 执行图（节点连接关系）
            context: 执行上下文
            results: 已执行节点的结果
            
        Returns:
            节点执行结果
        """
        node_id = node["id"]
        node_type = node["type"]

        logger.info(f"执行节点: {node_id} (类型: {node_type})")

        try:
            # 获取节点执行器
            executor = self.node_executors.get(node_type)
            if not executor:
                raise ValueError(f"不支持的节点类型: {node_type}")

            # 执行节点
            result = await executor.execute(node, context, results)
            results[node_id] = {
                "status": "success",
                "output": result,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            # 执行后续节点
            next_nodes = execution_graph.get(node_id, [])
            for next_node_id in next_nodes:
                # 找到下一个节点的定义
                next_node = next((
                    n for n in context.get("all_nodes", [])
                    if n["id"] == next_node_id
                ), None)

                if next_node:
                    await self._execute_node(
                        next_node,
                        execution_graph,
                        context,
                        results,
                    )

            return result

        except Exception as e:
            logger.error(f"节点执行失败: {node_id} - {str(e)}")
            results[node_id] = {
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            raise

    def _parse_nodes(self, definition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """解析工作流定义中的节点"""
        return definition.get("nodes", [])

    def _parse_edges(self, definition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """解析工作流定义中的连接"""
        return definition.get("edges", [])

    def _build_execution_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
    ) -> Dict[str, List[str]]:
        """
        构建执行图
        
        Returns:
            节点ID -> 后续节点ID列表的映射
        """
        graph = {}
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            if source and target:
                if source not in graph:
                    graph[source] = []
                graph[source].append(target)
        return graph


# 全局引擎实例
workflow_engine = WorkflowEngine()

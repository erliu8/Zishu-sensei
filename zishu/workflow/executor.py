"""
节点执行器
定义不同类型节点的执行逻辑
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class NodeExecutor(ABC):
    """节点执行器基类"""

    @abstractmethod
    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行节点
        
        Args:
            node: 节点定义
            context: 执行上下文
            results: 已执行节点的结果
            
        Returns:
            节点执行结果
        """
        pass


class StartNodeExecutor(NodeExecutor):
    """开始节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """开始节点不执行任何操作，只是标记工作流开始"""
        logger.info("工作流开始执行")
        return {"message": "workflow_started"}


class EndNodeExecutor(NodeExecutor):
    """结束节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        结束节点收集工作流输出
        
        从配置中获取输出映射，将指定的变量作为工作流输出
        """
        logger.info("工作流执行结束")

        # 从节点配置获取输出映射
        output_config = node.get("config", {}).get("output", {})

        # 构建输出数据
        output_data = {}
        for key, source in output_config.items():
            # 简单的变量引用（如 ${variable_name}）
            if source.startswith("${") and source.endswith("}"):
                var_name = source[2:-1]
                output_data[key] = context.get("variables", {}).get(var_name)
            else:
                output_data[key] = source

        context["output"] = output_data
        return {"message": "workflow_completed", "output": output_data}


class AdapterNodeExecutor(NodeExecutor):
    """适配器节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行适配器节点
        
        调用指定的适配器并传递参数
        """
        config = node.get("config", {})
        adapter_id = config.get("adapter_id")
        adapter_params = config.get("parameters", {})

        logger.info(f"执行适配器: {adapter_id}")

        # TODO: 实际调用适配器服务
        # 这里需要集成适配器系统
        # result = await adapter_service.execute(adapter_id, adapter_params)

        # 模拟适配器执行
        await asyncio.sleep(0.1)

        # 模拟返回结果
        result = {
            "adapter_id": adapter_id,
            "status": "success",
            "output": {"message": f"适配器 {adapter_id} 执行成功"},
        }

        # 将结果保存到上下文变量
        output_variable = config.get("output_variable")
        if output_variable:
            if "variables" not in context:
                context["variables"] = {}
            context["variables"][output_variable] = result["output"]

        return result


class ConditionNodeExecutor(NodeExecutor):
    """条件节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行条件判断
        
        根据条件表达式决定后续执行路径
        """
        config = node.get("config", {})
        condition = config.get("condition", "true")

        logger.info(f"评估条件: {condition}")

        # TODO: 实现条件表达式评估器
        # 支持基本的比较和逻辑运算
        # 现在简单地评估 Python 表达式（生产环境需要更安全的实现）

        try:
            # 准备评估上下文
            eval_context = {
                "context": context,
                "variables": context.get("variables", {}),
                "results": results,
            }

            # 简单的条件评估（实际应该使用更安全的方式）
            result = eval(condition, {"__builtins__": {}}, eval_context)

            return {
                "condition": condition,
                "result": bool(result),
            }

        except Exception as e:
            logger.error(f"条件评估失败: {str(e)}")
            return {
                "condition": condition,
                "result": False,
                "error": str(e),
            }


class LoopNodeExecutor(NodeExecutor):
    """循环节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行循环
        
        对集合中的每个元素执行子工作流
        """
        config = node.get("config", {})
        collection_var = config.get("collection")
        item_var = config.get("item_variable", "item")

        # 获取要遍历的集合
        collection = context.get("variables", {}).get(collection_var, [])

        logger.info(f"执行循环: {len(collection)} 次迭代")

        loop_results = []
        for index, item in enumerate(collection):
            # 设置循环变量
            if "variables" not in context:
                context["variables"] = {}

            context["variables"][item_var] = item
            context["variables"][f"{item_var}_index"] = index

            # TODO: 执行循环体内的节点
            # 这需要递归调用工作流引擎

            loop_results.append({
                "index": index,
                "item": item,
                "status": "success",
            })

        return {
            "iterations": len(collection),
            "results": loop_results,
        }


class DelayNodeExecutor(NodeExecutor):
    """延迟节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行延迟
        
        暂停执行指定时间
        """
        config = node.get("config", {})
        delay_seconds = config.get("delay_seconds", 1)

        logger.info(f"延迟 {delay_seconds} 秒")

        await asyncio.sleep(delay_seconds)

        return {
            "delayed_seconds": delay_seconds,
            "message": f"延迟 {delay_seconds} 秒完成",
        }


class TransformNodeExecutor(NodeExecutor):
    """数据转换节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行数据转换
        
        使用配置的映射规则转换数据
        """
        config = node.get("config", {})
        transform_rules = config.get("rules", {})

        logger.info("执行数据转换")

        # 应用转换规则
        transformed_data = {}
        for target_key, source_expr in transform_rules.items():
            # TODO: 实现更复杂的数据转换逻辑
            # 支持路径访问、函数调用等
            transformed_data[target_key] = source_expr

        # 保存转换结果
        output_variable = config.get("output_variable")
        if output_variable:
            if "variables" not in context:
                context["variables"] = {}
            context["variables"][output_variable] = transformed_data

        return {
            "transformed": transformed_data,
        }


class HttpNodeExecutor(NodeExecutor):
    """HTTP 请求节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行 HTTP 请求
        
        发送 HTTP 请求并返回响应
        """
        config = node.get("config", {})
        method = config.get("method", "GET")
        url = config.get("url")
        headers = config.get("headers", {})
        body = config.get("body")

        logger.info(f"执行 HTTP 请求: {method} {url}")

        # TODO: 实现实际的 HTTP 请求
        # 使用 httpx 或 aiohttp

        # 模拟 HTTP 请求
        await asyncio.sleep(0.1)

        result = {
            "status_code": 200,
            "body": {"message": "HTTP 请求成功"},
        }

        # 保存响应
        output_variable = config.get("output_variable")
        if output_variable:
            if "variables" not in context:
                context["variables"] = {}
            context["variables"][output_variable] = result

        return result


class ScriptNodeExecutor(NodeExecutor):
    """脚本节点执行器"""

    async def execute(
        self,
        node: Dict[str, Any],
        context: Dict[str, Any],
        results: Dict[str, Any],
    ) -> Any:
        """
        执行脚本代码
        
        在沙箱环境中执行用户提供的脚本
        """
        config = node.get("config", {})
        script = config.get("script", "")
        language = config.get("language", "python")

        logger.info(f"执行 {language} 脚本")

        # TODO: 实现安全的脚本执行
        # 使用沙箱环境或容器隔离

        # 警告：这只是演示，不应在生产环境使用
        logger.warning("脚本执行器尚未实现安全沙箱")

        return {
            "message": "脚本执行功能待实现",
            "language": language,
        }

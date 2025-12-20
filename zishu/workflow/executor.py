"""
节点执行器
定义不同类型节点的执行逻辑
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union
import logging
import re

from zishu.adapters.base.adapter import ExecutionContext

logger = logging.getLogger(__name__)


def resolve_placeholders(value: str, context: Dict[str, Any], mode: str = "strict") -> Union[str, Any]:
    """解析字符串中的 ${...} 占位符"""
    if not isinstance(value, str):
        return value

    def replace_var(match):
        var_path = match.group(1)
        # 支持的格式：${input.xxx}, ${var}, ${variables.var}, ${a.b.c}
        if var_path == "input":
            # ${input} → context["input"]
            return context.get("input", {})
        if var_path == "variables":
            # ${variables} → context["variables"]
            return context.get("variables", {})
        if var_path.startswith("input."):
            # ${input.xxx} → context["input"]["xxx"]
            path = var_path[6:].split(".")
            source = context.get("input", {})
        elif var_path.startswith("variables."):
            # ${variables.var} → context["variables"]["var"]
            path = var_path[10:].split(".")
            source = context.get("variables", {})
        else:
            # ${var} 或 ${a.b.c} → context["variables"] 中的路径
            path = var_path.split(".")
            source = context.get("variables", {})

        # 遍历路径获取值
        current = source
        for key in path:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                if mode == "strict":
                    raise ValueError(f"Cannot resolve placeholder: ${{{var_path}}}")
                return match.group(0)  # 返回原始占位符
        return current  # 返回原值，由外层决定是否转字符串

    # 使用正则表达式匹配 ${...} 格式
    pattern = r'\$\{([^}]+)\}'
    # 验证 token 格式，禁止 .. 和以 . 开头/结尾
    for match in re.finditer(pattern, value):
        token = match.group(1)
        if not re.match(r'^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$', token) or '..' in token:
            raise ValueError(f"Invalid token in placeholder: ${{{token}}}")

    # 检查是否是单个占位符
    if re.fullmatch(pattern, value):
        # 整个字符串就是一个占位符，返回原值类型
        return replace_var(re.match(pattern, value))
    else:
        # 包含其他文本，所有替换值都转为字符串
        def replace_var_str(match):
            return str(replace_var(match))
        return re.sub(pattern, replace_var_str, value)

def resolve_parameters(obj: Any, context: Dict[str, Any], mode: str = "strict") -> Any:
    """递归处理参数中的占位符"""
    if isinstance(obj, str):
        return resolve_placeholders(obj, context, mode)
    elif isinstance(obj, dict):
        return {k: resolve_parameters(v, context, mode) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [resolve_parameters(item, context, mode) for item in obj]
    else:
        return obj


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
        raw_params = config.get("parameters", {})
        output_variable = config.get("output_variable")

        if not adapter_id:
            raise ValueError("adapter_id is required in adapter node config")

        logger.info(f"执行适配器: {adapter_id}")

        # 获取 AdapterManager - 必须通过 context 注入
        adapter_manager = context.get("adapter_manager")
        if not adapter_manager:
            raise ValueError("adapter_manager is required in context for adapter execution")

        user_id = context.get("user_id")
        if not user_id:
            raise ValueError("user_id is required in context for adapter execution")

        # 获取插值和启动策略
        interpolation_mode = context.get("interpolation_mode", "strict")
        adapter_start_policy = context.get("adapter_start_policy", "auto")

        # 解析参数中的占位符
        try:
            adapter_params = resolve_parameters(raw_params, context, interpolation_mode)
        except ValueError as e:
            logger.error(f"Parameter interpolation failed: {e}")
            raise

        # 检查适配器是否已注册（使用公开 API）
        if not adapter_manager.is_running:
            raise RuntimeError("adapter_manager must be running before executing adapter nodes")

        registration = await adapter_manager.get_adapter(adapter_id)
        if not registration:
            raise ValueError(f"Adapter {adapter_id} is not registered")

        # 检查适配器是否运行，根据策略决定是否启动
        # 注意：adapter_manager._adapters 是内部字段，属于实现细节
        if adapter_id not in adapter_manager._adapters:
            if adapter_start_policy == "auto":
                logger.info(f"Starting adapter {adapter_id} (auto policy)")
                success = await adapter_manager.start_adapter(adapter_id)
                if not success:
                    diag = None
                    adapter_instance = None
                    try:
                        adapter_config = getattr(registration, "configuration", None)
                        adapter_class = getattr(adapter_config, "adapter_class", None) if adapter_config else None
                        adapter_cfg = getattr(adapter_config, "config", None) if adapter_config else None

                        if not adapter_config:
                            diag = "missing registration.configuration"
                        elif not adapter_class:
                            diag = "missing adapter_class in configuration"
                        else:
                            adapter_instance = adapter_class(adapter_cfg or {})
                            if hasattr(adapter_instance, "initialize"):
                                await adapter_instance.initialize()
                            if hasattr(adapter_instance, "start"):
                                await adapter_instance.start()
                            diag = "manual start succeeded (AdapterManager returned False)"
                    except Exception as e:
                        diag = f"{type(e).__name__}: {e}"
                    finally:
                        if adapter_instance is not None:
                            try:
                                if hasattr(adapter_instance, "stop"):
                                    await adapter_instance.stop()
                                if hasattr(adapter_instance, "cleanup"):
                                    await adapter_instance.cleanup()
                            except Exception:
                                pass

                    raise RuntimeError(
                        f"Failed to start adapter: {adapter_id}"
                        + (f" ({diag})" if diag else "")
                    )
            elif adapter_start_policy == "strict_running":
                raise RuntimeError(f"Adapter {adapter_id} is not running and policy is strict_running")
            else:
                raise RuntimeError(f"Unknown adapter start policy: {adapter_start_policy}")

        # 创建 ExecutionContext
        # request_id 使用 workflow execution_id，execution_id 使用组合确保唯一性
        execution_context = ExecutionContext(
            request_id=context.get("execution_id"),  # workflow execution_id 作为 request_id
            user_id=user_id,
            session_id=context.get("session_id"),
            execution_id=f"{context.get('execution_id', 'unknown')}:{node.get('id', 'unknown')}",  # 组合保证唯一性
            metadata={
                "workflow_id": context.get("workflow_id"),
                "execution_id": context.get("execution_id"),
                "node_id": node.get("id"),
                "adapter_id": adapter_id,
            }
        )

        # 调用适配器 - 直接传递 ExecutionContext 对象
        try:
            result = await adapter_manager.process_with_adapter(
                adapter_id,
                adapter_params,
                execution_context  # 直接传递对象，不是 __dict__
            )
        except Exception as e:
            logger.error(f"Adapter {adapter_id} execution failed: {e}")
            raise

        # workflow_executions.output_data/node_results 存在于 JSONB 字段，必须可 JSON 序列化。
        # adapter_manager.process_with_adapter 通常返回 ExecutionResult（包含 output + 元信息），
        # 这里默认只把 output 写入 workflow 变量与后续节点。
        adapter_output = getattr(result, "output", result)

        # 将结果保存到上下文变量
        if output_variable:
            if "variables" not in context:
                context["variables"] = {}
            context["variables"][output_variable] = adapter_output

        return adapter_output


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

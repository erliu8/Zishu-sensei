# -*- coding: utf-8 -*-
"""
动态提示模板引擎
"""

import os
import time
import re
import json
import uuid
import asyncio
import hashlib
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple, Set, Callable, Type
from dataclasses import dataclass, field
from enum import Enum
from contextlib import contextmanager
import weakref
from collections import defaultdict, ChainMap
import ast
import operator
from functools import lru_cache

try:
    from jinja2 import Environment, BaseLoader, TemplateSyntaxError, UndefinedError, StrictUndefined
    from jinja2.sandbox import SandboxedEnvironment

    JINJA2_AVAILABLE = True
except ImportError:
    JINJA2_AVAILABLE = False

    # 定义占位符类
    class TemplateSyntaxError(Exception):
        pass

    class UndefinedError(Exception):
        pass
    
    class StrictUndefined:
        pass

    class Environment:
        def __init__(self, *args, **kwargs):
            pass

    class SandboxedEnvironment:
        def __init__(self, *args, **kwargs):
            pass

    class BaseLoader:
        pass


try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)

# 导入项目内部模块
try:
    from ..utils.cache import CacheManager, CacheStrategy
except ImportError:
    # 提供占位符实现
    class CacheManager:
        def __init__(self, *args, **kwargs):
            pass

        async def get(self, key):
            return None

        async def set(self, key, value, ttl=None):
            pass

        async def clear(self):
            pass

    class CacheStrategy:
        LRU = "lru"


try:
    from ..utils.config import ConfigManager
except ImportError:

    class ConfigManager:
        def __init__(self, *args, **kwargs):
            pass

        def get(self, key, default=None):
            return default


try:
    from ...core.memory.context import ContextManager
except ImportError:

    class ContextManager:
        def __init__(self, *args, **kwargs):
            pass


# ================================
# 核心枚举和数据类定义
# ================================


class TemplateType(Enum):
    """模板类型枚举"""

    SYSTEM = "system"  # 系统模板
    USER = "user"  # 用户模板
    ASSISTANT = "assistant"  # 助手模板
    FUNCTION = "function"  # 函数模板
    CONDITIONAL = "conditional"  # 条件模板
    LOOP = "loop"  # 循环模板
    INHERIT = "inherit"  # 继承模板


class VariableScope(Enum):
    """变量作用域枚举"""

    GLOBAL = "global"  # 全局作用域
    SESSION = "session"  # 会话作用域
    LOCAL = "local"  # 局部作用域
    CONTEXT = "context"  # 上下文作用域


class ExecutionMode(Enum):
    """执行模式枚举"""

    SAFE = "safe"  # 安全模式（沙箱）
    TRUSTED = "trusted"  # 信任模式
    HYBRID = "hybrid"  # 混合模式


@dataclass
class TemplateContext:
    """模板上下文数据类"""

    variables: Dict[str, Any] = field(default_factory=dict)
    functions: Dict[str, Callable] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    scope: VariableScope = VariableScope.LOCAL
    parent_context: Optional["TemplateContext"] = None

    def get_variable(self, name: str, default: Any = None) -> Any:
        """获取变量值，支持作用域链查找"""
        if name in self.variables:
            return self.variables[name]
        if self.parent_context:
            return self.parent_context.get_variable(name, default)
        return default

    def set_variable(self, name: str, value: Any, scope: VariableScope = None) -> None:
        """设置变量值"""
        if scope and scope != self.scope:
            # 处理跨作用域变量设置
            if self.parent_context and scope == self.parent_context.scope:
                self.parent_context.set_variable(name, value)
                return
        self.variables[name] = value


@dataclass
class TemplateMetadata:
    """模板元数据"""

    template_id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    template_type: TemplateType = TemplateType.USER
    parent_template: Optional[str] = None
    dependencies: Set[str] = field(default_factory=set)
    tags: Set[str] = field(default_factory=set)
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RenderResult:
    """渲染结果数据类"""

    content: str
    metadata: TemplateMetadata
    context: TemplateContext
    execution_time: float
    cache_hit: bool = False
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# ================================
# 异常类定义
# ================================


class PromptEngineException(Exception):
    """提示引擎基础异常"""

    pass


class TemplateNotFoundError(PromptEngineException):
    """模板未找到异常"""

    pass


class TemplateSyntaxError(PromptEngineException):
    """模板语法错误异常"""

    pass


class VariableNotFoundError(PromptEngineException):
    """变量未找到异常"""

    pass


class ExecutionError(PromptEngineException):
    """执行错误异常"""

    pass


class SecurityError(PromptEngineException):
    """安全错误异常"""

    pass


# ================================
# 核心接口定义
# ================================


class TemplateLoader(ABC):
    """模板加载器抽象基类"""

    @abstractmethod
    async def load_template(self, template_id: str) -> Tuple[str, TemplateMetadata]:
        """异步加载模板"""
        pass

    @abstractmethod
    def get_template_list(self) -> List[str]:
        """获取模板列表"""
        pass

    @abstractmethod
    def template_exists(self, template_id: str) -> bool:
        """检查模板是否存在"""
        pass


class FunctionRegistry(ABC):
    """函数注册器抽象基类"""

    @abstractmethod
    def register_function(self, name: str, func: Callable, safe: bool = True) -> None:
        """注册函数"""
        pass

    @abstractmethod
    def unregister_function(self, name: str) -> None:
        """注销函数"""
        pass

    @abstractmethod
    def get_function(self, name: str) -> Optional[Callable]:
        """获取函数"""
        pass


class TemplateProcessor(ABC):
    """模板处理器抽象基类"""

    @abstractmethod
    async def process(self, template: str, context: TemplateContext) -> str:
        """异步处理模板"""
        pass

    @abstractmethod
    def validate_template(self, template: str) -> List[str]:
        """验证模板语法"""
        pass


# ================================
# 具体实现类
# ================================


class FileTemplateLoader(TemplateLoader):
    """基于文件系统的模板加载器"""

    def __init__(self, template_dir: Union[str, Path], encoding: str = "utf-8"):
        self.template_dir = Path(template_dir)
        self.encoding = encoding
        self.logger = logger.bind(component="FileTemplateLoader")

        # 确保模板目录存在
        self.template_dir.mkdir(parents=True, exist_ok=True)

        # 模板缓存
        self._template_cache: Dict[str, Tuple[str, TemplateMetadata, float]] = {}
        self._cache_lock = threading.RLock()

    async def load_template(self, template_id: str) -> Tuple[str, TemplateMetadata]:
        """异步加载模板"""
        with self._cache_lock:
            # 检查缓存
            if template_id in self._template_cache:
                content, metadata, cached_at = self._template_cache[template_id]
                template_path = self._get_template_path(template_id)

                # 检查文件是否被修改
                if template_path.exists():
                    file_mtime = template_path.stat().st_mtime
                    if file_mtime <= cached_at:
                        return content, metadata

        # 从文件加载
        template_path = self._get_template_path(template_id)
        if not template_path.exists():
            raise TemplateNotFoundError(
                f"Template '{template_id}' not found at {template_path}"
            )

        try:
            # 读取模板内容
            content = template_path.read_text(encoding=self.encoding)

            # 解析元数据
            metadata = self._parse_metadata(template_id, content)

            # 更新缓存
            with self._cache_lock:
                self._template_cache[template_id] = (
                    content,
                    metadata,
                    datetime.now().timestamp(),
                )

            self.logger.info(f"Loaded template: {template_id}")
            return content, metadata

        except Exception as e:
            self.logger.error(f"Failed to load template {template_id}: {e}")
            raise TemplateNotFoundError(f"Failed to load template '{template_id}': {e}")

    def get_template_list(self) -> List[str]:
        """获取模板列表"""
        templates = []
        for pattern in ["*.txt", "*.jinja2", "*.j2", "*.template"]:
            templates.extend([f.stem for f in self.template_dir.rglob(pattern)])
        return sorted(set(templates))

    def template_exists(self, template_id: str) -> bool:
        """检查模板是否存在"""
        return self._get_template_path(template_id).exists()

    def _get_template_path(self, template_id: str) -> Path:
        """获取模板文件路径"""
        # 检查template_id是否已经包含扩展名
        template_path = Path(template_id)
        if template_path.suffix:
            # 如果已经有扩展名，直接使用
            path = self.template_dir / template_id
            if path.exists():
                return path
        
        # 支持多种扩展名
        extensions = [".txt", ".jinja2", ".j2", ".template"]
        base_name = template_path.stem if template_path.suffix else template_id
        
        for ext in extensions:
            path = self.template_dir / f"{base_name}{ext}"
            if path.exists():
                return path
        
        # 默认返回 .txt 路径
        return self.template_dir / f"{base_name}.txt"

    def _parse_metadata(self, template_id: str, content: str) -> TemplateMetadata:
        """解析模板元数据"""
        metadata = TemplateMetadata(template_id=template_id, name=template_id)

        # 解析模板头部的元数据注释
        lines = content.split("\n")[:20]  # 只检查前20行
        for line in lines:
            line = line.strip()
            if line.startswith("#META:") or line.startswith("<!--META:"):
                try:
                    meta_json = line.split("META:", 1)[1].split("-->", 1)[0].strip()
                    meta_data = json.loads(meta_json)

                    # 更新元数据
                    for key, value in meta_data.items():
                        if hasattr(metadata, key):
                            if key in ["template_type"]:
                                setattr(metadata, key, TemplateType(value))
                            elif key in ["dependencies", "tags"]:
                                setattr(metadata, key, set(value))
                            else:
                                setattr(metadata, key, value)

                except (json.JSONDecodeError, ValueError) as e:
                    self.logger.warning(
                        f"Invalid metadata in template {template_id}: {e}"
                    )

        return metadata


class DefaultFunctionRegistry(FunctionRegistry):
    """默认函数注册器实现"""

    def __init__(self):
        self._functions: Dict[str, Tuple[Callable, bool]] = {}
        self._lock = threading.RLock()
        self.logger = logger.bind(component="FunctionRegistry")

        # 注册内置函数
        self._register_builtin_functions()

    def register_function(self, name: str, func: Callable, safe: bool = True) -> None:
        """注册函数"""
        with self._lock:
            self._functions[name] = (func, safe)
            self.logger.debug(f"Registered function: {name} (safe={safe})")

    def unregister_function(self, name: str) -> None:
        """注销函数"""
        with self._lock:
            if name in self._functions:
                del self._functions[name]
                self.logger.debug(f"Unregistered function: {name}")

    def get_function(self, name: str) -> Optional[Callable]:
        """获取函数"""
        with self._lock:
            if name in self._functions:
                return self._functions[name][0]
        return None

    def is_safe_function(self, name: str) -> bool:
        """检查函数是否安全"""
        with self._lock:
            if name in self._functions:
                return self._functions[name][1]
        return False

    def get_safe_functions(self) -> Dict[str, Callable]:
        """获取所有安全函数"""
        with self._lock:
            return {
                name: func for name, (func, safe) in self._functions.items() if safe
            }

    def _register_builtin_functions(self):
        """注册内置安全函数"""
        # 字符串处理函数
        self.register_function("len", len, safe=True)
        self.register_function("str", str, safe=True)
        self.register_function("upper", lambda s: str(s).upper(), safe=True)
        self.register_function("lower", lambda s: str(s).lower(), safe=True)
        self.register_function("strip", lambda s: str(s).strip(), safe=True)
        self.register_function(
            "replace", lambda s, old, new: str(s).replace(old, new), safe=True
        )

        # 数学函数
        self.register_function("abs", abs, safe=True)
        self.register_function("min", min, safe=True)
        self.register_function("max", max, safe=True)
        self.register_function("sum", sum, safe=True)

        # 列表处理函数
        self.register_function(
            "join", lambda sep, items: sep.join(map(str, items)), safe=True
        )
        self.register_function(
            "split", lambda s, sep=None: str(s).split(sep), safe=True
        )

        # 日期时间函数
        self.register_function("now", lambda: datetime.now().isoformat(), safe=True)
        self.register_function(
            "today", lambda: datetime.now().date().isoformat(), safe=True
        )

        # 格式化函数
        self.register_function(
            "format_number", lambda n, decimals=2: f"{float(n):.{decimals}f}", safe=True
        )
        self.register_function(
            "truncate",
            lambda s, length=100: str(s)[:length] + "..."
            if len(str(s)) > length
            else str(s),
            safe=True,
        )


class AdvancedTemplateProcessor(TemplateProcessor):
    """高级模板处理器实现"""

    def __init__(
        self,
        function_registry: FunctionRegistry,
        execution_mode: ExecutionMode = ExecutionMode.SAFE,
    ):
        self.function_registry = function_registry
        self.execution_mode = execution_mode
        self.logger = logger.bind(component="TemplateProcessor")
        
        # 添加模板编译缓存以提高性能
        self._template_cache: Dict[str, Any] = {}
        self._template_cache_size = 1000  # 最多缓存1000个编译后的模板

        # Jinja2环境设置
        if JINJA2_AVAILABLE:
            if execution_mode == ExecutionMode.SAFE:
                self.jinja_env = SandboxedEnvironment(
                    loader=BaseLoader(), 
                    autoescape=False, 
                    enable_async=True,
                    undefined=StrictUndefined  # 启用严格的未定义变量检查
                )
            else:
                self.jinja_env = Environment(
                    loader=BaseLoader(), 
                    autoescape=False, 
                    enable_async=True,
                    undefined=StrictUndefined  # 启用严格的未定义变量检查
                )

            # 添加自定义函数
            self._setup_jinja_functions()
        else:
            self.jinja_env = None
            self.logger.warning(
                "Jinja2 not available, using simple template processing"
            )

    async def process(self, template: str, context: TemplateContext) -> str:
        """异步处理模板"""
        try:
            # 减少日志输出以提高性能
            if self.jinja_env and JINJA2_AVAILABLE:
                return await self._process_jinja(template, context)
            else:
                return await self._process_simple(template, context)

        except Exception as e:
            self.logger.error(f"Template processing failed: {e}")
            # Fallback to simple processing if Jinja2 fails
            try:
                self.logger.warning("Jinja2 processing failed, falling back to simple processing")
                return await self._process_simple(template, context)
            except Exception as fallback_error:
                self.logger.error(f"Simple processing also failed: {fallback_error}")
                raise ExecutionError(f"Template processing failed: {e}")

    def validate_template(self, template: str) -> List[str]:
        """验证模板语法"""
        errors = []

        if self.jinja_env:
            try:
                self.jinja_env.parse(template)
            except TemplateSyntaxError as e:
                errors.append(f"Jinja2 syntax error: {e}")
        else:
            # 简单验证
            try:
                self._validate_simple_template(template)
            except Exception as e:
                errors.append(f"Template syntax error: {e}")

        return errors

    async def _process_jinja(self, template: str, context: TemplateContext) -> str:
        """使用Jinja2处理模板"""
        try:
            # 准备上下文变量
            template_vars = {}
            template_vars.update(context.variables)

            # 添加安全函数
            if self.execution_mode == ExecutionMode.SAFE:
                template_vars.update(self.function_registry.get_safe_functions())

            # 使用缓存来避免重复编译相同的模板（提高性能）
            template_hash = hash(template)
            if template_hash in self._template_cache:
                compiled_template = self._template_cache[template_hash]
            else:
                # 编译模板
                compiled_template = self.jinja_env.from_string(template)
                
                # 缓存编译后的模板
                if len(self._template_cache) < self._template_cache_size:
                    self._template_cache[template_hash] = compiled_template

            # 渲染模板
            if hasattr(compiled_template, "render_async"):
                result = await compiled_template.render_async(**template_vars)
            else:
                result = compiled_template.render(**template_vars)

            return result

        except UndefinedError as e:
            raise VariableNotFoundError(f"Variable not found: {e}")
        except Exception as e:
            raise ExecutionError(f"Jinja2 processing error: {e}")

    async def _process_simple(self, template: str, context: TemplateContext) -> str:
        """简单模板处理（不依赖Jinja2）"""
        result = template

        # 处理简单变量替换 {{variable}}
        variable_pattern = re.compile(r"\{\{\s*(\w+(?:\.\w+)*)\s*\}\}")

        def replace_variable(match):
            var_name = match.group(1)
            value = self._get_nested_variable(context, var_name)
            if value is None:
                self.logger.warning(f"Variable '{var_name}' not found in context")
                return match.group(0)  # 保持原样
            return str(value)

        result = variable_pattern.sub(replace_variable, result)

        # 处理for循环 {% for item in items %}...{% endfor %}
        result = await self._process_simple_loops(result, context)

        # 处理简单条件语句 {%if condition%}...{%endif%}
        result = await self._process_simple_conditions(result, context)

        return result

    async def _process_simple_conditions(
        self, template: str, context: TemplateContext
    ) -> str:
        """处理简单的条件语句"""
        # 这里实现简单的条件逻辑处理
        # 为了保持代码简洁，这里只实现基本功能
        condition_pattern = re.compile(
            r"\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}", re.DOTALL
        )

        def replace_condition(match):
            var_name = match.group(1)
            content = match.group(2)

            value = context.get_variable(var_name)
            if value:  # 简单的真值检查
                return content
            return ""

        return condition_pattern.sub(replace_condition, template)

    def _get_nested_variable(self, context: TemplateContext, var_name: str):
        """获取嵌套变量值"""
        parts = var_name.split('.')
        value = context.get_variable(parts[0])
        
        if value is None:
            return None
            
        for part in parts[1:]:
            if isinstance(value, dict):
                value = value.get(part)
            elif hasattr(value, part):
                value = getattr(value, part)
            else:
                return None
                
        return value

    async def _process_simple_loops(self, template: str, context: TemplateContext) -> str:
        """处理简单的for循环"""
        # 匹配 {% for item in items %}...{% endfor %}
        loop_pattern = re.compile(
            r'\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}(.*?)\{%\s*endfor\s*%\}',
            re.DOTALL | re.IGNORECASE
        )
        
        def replace_loop(match):
            item_name = match.group(1)
            items_name = match.group(2)
            loop_content = match.group(3)
            
            # 获取循环数据
            items = context.get_variable(items_name)
            if not items:
                self.logger.warning(f"Loop variable '{items_name}' not found or empty")
                return ""
            
            if not isinstance(items, (list, tuple)):
                self.logger.warning(f"Loop variable '{items_name}' is not iterable")
                return ""
            
            # 处理每个循环项
            result_parts = []
            for item in items:
                # 创建临时上下文，添加循环变量
                loop_context = TemplateContext(
                    variables={**context.variables, item_name: item}
                )
                
                # 处理循环内容中的变量
                item_content = loop_content
                
                # 处理循环项变量替换
                variable_pattern = re.compile(r"\{\{\s*(\w+(?:\.\w+)*)\s*\}\}")
                
                def replace_item_variable(var_match):
                    var_name = var_match.group(1)
                    value = self._get_nested_variable(loop_context, var_name)
                    if value is None:
                        return var_match.group(0)  # 保持原样
                    return str(value)
                
                item_content = variable_pattern.sub(replace_item_variable, item_content)
                result_parts.append(item_content)
            
            return ''.join(result_parts)
        
        return loop_pattern.sub(replace_loop, template)

    def _setup_jinja_functions(self):
        """设置Jinja2自定义函数"""
        if not self.jinja_env:
            return

        # 添加所有注册的函数
        for name in dir(self.function_registry):
            if not name.startswith("_"):
                func = self.function_registry.get_function(name)
                if func:
                    self.jinja_env.globals[name] = func

    def _validate_simple_template(self, template: str):
        """验证简单模板语法"""
        # 检查括号匹配
        open_braces = template.count("{{")
        close_braces = template.count("}}")
        if open_braces != close_braces:
            raise TemplateSyntaxError("Unmatched braces in template")

        # 检查条件语句匹配
        if_count = len(re.findall(r"\{%\s*if\s+", template))
        endif_count = len(re.findall(r"\{%\s*endif\s*%\}", template))
        if if_count != endif_count:
            raise TemplateSyntaxError("Unmatched if/endif statements")


# ================================
# 主要引擎类
# ================================


class DynamicPromptEngine:
    """动态提示模板引擎

    高性能、企业级的模板引擎，提供完整的动态提示生成能力
    支持缓存、异步处理、安全沙箱、模板继承等高级特性
    """

    def __init__(
        self,
        config: Union[Dict[str, Any], str, Path] = None,
        template_dir: Union[str, Path] = None,
        cache_manager: CacheManager = None,
        config_manager: ConfigManager = None,
        execution_mode: ExecutionMode = ExecutionMode.SAFE,
        enable_cache: bool = True,
        cache_ttl: int = 3600,
    ):
        """初始化动态提示引擎

        Args:
            config: 配置字典或模板目录路径
            template_dir: 模板目录路径
            cache_manager: 缓存管理器
            config_manager: 配置管理器
            execution_mode: 执行模式
            enable_cache: 是否启用缓存
            cache_ttl: 缓存过期时间(秒)
        """
        # 处理配置参数
        if isinstance(config, dict):
            # 如果传入的是配置字典，从中提取参数
            template_dir = template_dir or config.get("template_dir", "templates")
            enable_cache = config.get("cache_enabled", enable_cache)
            cache_ttl = config.get("cache_ttl", cache_ttl)
            self.config = config
        elif isinstance(config, (str, Path)):
            # 如果传入的是路径，作为template_dir使用
            template_dir = config
            self.config = {}
        else:
            # 使用默认配置
            self.config = {}
            
        self.execution_mode = execution_mode
        self.enable_cache = enable_cache
        self.cache_ttl = cache_ttl

        # 初始化组件
        self._template_dir = template_dir or Path.cwd() / "templates"
        self.template_loader = FileTemplateLoader(self._template_dir)
        self.function_registry = DefaultFunctionRegistry()
        self.template_processor = AdvancedTemplateProcessor(
            self.function_registry, execution_mode
        )

        # 缓存管理
        if cache_manager:
            self.cache_manager = cache_manager
        else:
            # 使用默认缓存管理器
            if enable_cache:
                try:
                    self.cache_manager = CacheManager(
                        strategy=CacheStrategy.LRU, max_size=1000, default_ttl=cache_ttl
                    )
                except Exception:
                    self.cache_manager = None
                    self.enable_cache = False
            else:
                self.cache_manager = None

        # 配置管理
        self.config_manager = config_manager

        # 上下文管理
        self._global_context = TemplateContext(scope=VariableScope.GLOBAL)
        self._session_contexts: Dict[str, TemplateContext] = {}
        self._context_lock = threading.RLock()

        # 性能监控
        self._stats = {
            "renders": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "errors": 0,
            "total_time": 0.0,
        }
        self._stats_lock = threading.RLock()

        # 日志记录
        self.logger = logger.bind(component="DynamicPromptEngine")
        self.logger.info(
            f"Initialized DynamicPromptEngine (mode={execution_mode.value})"
        )

        # 注册系统集成函数
        self._register_system_functions()
        
        # 初始化状态
        self.is_initialized = False

    async def render_template(
        self,
        template_id: str,
        variables: Dict[str, Any] = None,
        session_id: Optional[str] = None,
        context_metadata: Dict[str, Any] = None,
        force_reload: bool = False,
    ) -> RenderResult:
        """渲染模板

        Args:
            template_id: 模板ID
            variables: 模板变量
            session_id: 会话ID，用于会话级别的上下文
            context_metadata: 上下文元数据
            force_reload: 是否强制重新加载模板

        Returns:
            RenderResult: 渲染结果
        """
        start_time = time.time()
        cache_hit = False
        errors = []
        warnings = []

        try:
            # 生成缓存键
            cache_key = self._generate_cache_key(template_id, variables, session_id)

            # 检查缓存
            if self.enable_cache and not force_reload:
                cached_result = await self._get_from_cache(cache_key)
                if cached_result:
                    cache_hit = True
                    self._update_stats("cache_hits", 1)

                    # 更新统计信息
                    cached_result.cache_hit = True
                    return cached_result

            # 缓存未命中
            if self.enable_cache:
                self._update_stats("cache_misses", 1)

            # 加载模板
            try:
                (
                    template_content,
                    template_metadata,
                ) = await self.template_loader.load_template(template_id)
            except TemplateNotFoundError as e:
                self.logger.error(f"Template not found: {template_id}")
                errors.append(str(e))
                raise

            # 验证模板语法
            validation_errors = self.template_processor.validate_template(
                template_content
            )
            if validation_errors:
                errors.extend(validation_errors)
                raise TemplateSyntaxError(
                    f"Template validation failed: {validation_errors}"
                )

            # 准备渲染上下文
            context = await self._prepare_context(
                variables, session_id, context_metadata
            )

            # 处理模板继承
            if template_metadata.parent_template:
                template_content = await self._process_template_inheritance(
                    template_content, template_metadata.parent_template, context
                )

            # 渲染模板
            rendered_content = await self.template_processor.process(
                template_content, context
            )

            # 后处理
            rendered_content = await self._post_process(
                rendered_content, template_metadata, context
            )

            # 创建渲染结果
            execution_time = time.time() - start_time
            result = RenderResult(
                content=rendered_content,
                metadata=template_metadata,
                context=context,
                execution_time=execution_time,
                cache_hit=cache_hit,
                errors=errors,
                warnings=warnings,
            )

            # 缓存结果
            if self.enable_cache and not errors:
                await self._cache_result(cache_key, result)

            # 更新统计信息
            self._update_stats("renders", 1)
            self._update_stats("total_time", execution_time)

            self.logger.info(
                f"Template rendered successfully: {template_id} ({execution_time:.3f}s)"
            )
            return result

        except Exception as e:
            execution_time = time.time() - start_time
            self.logger.error(f"Template rendering failed: {template_id} - {e}")

            # 更新错误统计
            self._update_stats("errors", 1)

            # 创建错误结果
            result = RenderResult(
                content="",
                metadata=TemplateMetadata(template_id=template_id, name=template_id),
                context=TemplateContext(),
                execution_time=execution_time,
                cache_hit=False,
                errors=[str(e)],
                warnings=warnings,
            )

            if isinstance(e, (PromptEngineException)):
                return result
            else:
                raise ExecutionError(f"Unexpected error during template rendering: {e}")

    async def batch_render(
        self,
        template_requests: List[Tuple[str, Dict[str, Any]]],
        session_id: Optional[str] = None,
        max_concurrent: int = 10,
    ) -> List[RenderResult]:
        """批量渲染模板

        Args:
            template_requests: 模板请求列表，每个元素为(template_id, variables)
            session_id: 会话ID
            max_concurrent: 最大并发数

        Returns:
            List[RenderResult]: 渲染结果列表
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def render_single(template_id: str, variables: Dict[str, Any]):
            async with semaphore:
                return await self.render_template(template_id, variables, session_id)

        # 并发渲染
        tasks = [
            render_single(template_id, variables)
            for template_id, variables in template_requests
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                template_id, _ = template_requests[i]
                error_result = RenderResult(
                    content="",
                    metadata=TemplateMetadata(
                        template_id=template_id, name=template_id
                    ),
                    context=TemplateContext(),
                    execution_time=0.0,
                    errors=[str(result)],
                )
                processed_results.append(error_result)
            else:
                processed_results.append(result)

        return processed_results

    def register_function(self, name: str, func: Callable, safe: bool = True) -> None:
        """注册自定义函数

        Args:
            name: 函数名称
            func: 函数实现
            safe: 是否为安全函数
        """
        self.function_registry.register_function(name, func, safe)

        # 更新模板处理器
        if hasattr(self.template_processor, "_setup_jinja_functions"):
            self.template_processor._setup_jinja_functions()

    def set_global_variable(self, name: str, value: Any) -> None:
        """设置全局变量"""
        with self._context_lock:
            self._global_context.set_variable(name, value)

    def get_global_variable(self, name: str, default: Any = None) -> Any:
        """获取全局变量"""
        with self._context_lock:
            return self._global_context.get_variable(name, default)

    def create_session_context(self, session_id: str) -> None:
        """创建会话上下文"""
        with self._context_lock:
            if session_id not in self._session_contexts:
                session_context = TemplateContext(
                    scope=VariableScope.SESSION, parent_context=self._global_context
                )
                self._session_contexts[session_id] = session_context

    def destroy_session_context(self, session_id: str) -> None:
        """销毁会话上下文"""
        with self._context_lock:
            if session_id in self._session_contexts:
                del self._session_contexts[session_id]

    def get_template_list(self) -> List[str]:
        """获取模板列表"""
        return self.template_loader.get_template_list()

    def get_stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        with self._stats_lock:
            stats = self._stats.copy()

            # 计算派生统计信息
            if stats["renders"] > 0:
                stats["avg_render_time"] = stats["total_time"] / stats["renders"]
                stats["cache_hit_rate"] = (
                    stats["cache_hits"] / (stats["cache_hits"] + stats["cache_misses"])
                    if (stats["cache_hits"] + stats["cache_misses"]) > 0
                    else 0
                )
            else:
                stats["avg_render_time"] = 0
                stats["cache_hit_rate"] = 0

            return stats

    async def clear_cache(self) -> None:
        """清空缓存"""
        if self.cache_manager:
            await self.cache_manager.clear()
            self.logger.info("Template cache cleared")

    async def preload_templates(self, template_ids: List[str] = None) -> None:
        """预加载模板

        Args:
            template_ids: 要预加载的模板ID列表，None表示加载所有模板
        """
        if template_ids is None:
            template_ids = self.get_template_list()

        for template_id in template_ids:
            try:
                await self.template_loader.load_template(template_id)
                self.logger.debug(f"Preloaded template: {template_id}")
            except Exception as e:
                self.logger.warning(f"Failed to preload template {template_id}: {e}")

    # ================================
    # 私有方法
    # ================================

    def _generate_cache_key(
        self,
        template_id: str,
        variables: Dict[str, Any] = None,
        session_id: Optional[str] = None,
    ) -> str:
        """生成缓存键"""
        key_data = {
            "template_id": template_id,
            "variables": variables or {},
            "session_id": session_id,
            "execution_mode": self.execution_mode.value,
        }

        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()

    async def _get_from_cache(self, cache_key: str) -> Optional[RenderResult]:
        """从缓存获取结果"""
        if not self.cache_manager:
            return None

        try:
            cached_data = await self.cache_manager.get(cache_key)
            if cached_data:
                # 反序列化缓存数据
                return cached_data
        except Exception as e:
            self.logger.warning(f"Cache get failed: {e}")

        return None

    async def _cache_result(self, cache_key: str, result: RenderResult) -> None:
        """缓存渲染结果"""
        if not self.cache_manager:
            return

        try:
            await self.cache_manager.set(cache_key, result, ttl=self.cache_ttl)
        except Exception as e:
            self.logger.warning(f"Cache set failed: {e}")

    async def _prepare_context(
        self,
        variables: Dict[str, Any] = None,
        session_id: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> TemplateContext:
        """准备渲染上下文"""
        # 创建局部上下文
        local_context = TemplateContext(scope=VariableScope.LOCAL)

        # 设置变量
        if variables:
            local_context.variables.update(variables)

        # 设置元数据
        if metadata:
            local_context.metadata.update(metadata)

        # 设置父上下文
        with self._context_lock:
            if session_id and session_id in self._session_contexts:
                local_context.parent_context = self._session_contexts[session_id]
            else:
                local_context.parent_context = self._global_context

        return local_context

    async def _process_template_inheritance(
        self, template_content: str, parent_template_id: str, context: TemplateContext
    ) -> str:
        """处理模板继承"""
        try:
            parent_content, parent_metadata = await self.template_loader.load_template(
                parent_template_id
            )

            # 简单的模板继承实现
            # 在实际项目中可以实现更复杂的继承逻辑
            if "{{content}}" in parent_content:
                return parent_content.replace("{{content}}", template_content)
            else:
                return parent_content + "\n" + template_content

        except Exception as e:
            self.logger.warning(
                f"Template inheritance failed for {parent_template_id}: {e}"
            )
            return template_content

    async def _post_process(
        self, content: str, metadata: TemplateMetadata, context: TemplateContext
    ) -> str:
        """后处理渲染内容"""
        # 去除多余的空行
        content = re.sub(r"\n\s*\n\s*\n", "\n\n", content)

        # 去除首尾空白
        content = content.strip()

        return content

    def _update_stats(self, key: str, value: float) -> None:
        """更新统计信息"""
        with self._stats_lock:
            if key in ["renders", "cache_hits", "cache_misses", "errors"]:
                self._stats[key] += int(value)
            else:
                self._stats[key] += value

    def _register_system_functions(self) -> None:
        """注册系统集成函数"""
        # 知识库查询函数（如果可用）
        try:
            from .knowledge_base import KnowledgeBase

            kb = KnowledgeBase()
            self.register_function(
                "kb_search", lambda query: kb.search(query), safe=True
            )
        except ImportError:
            pass

        # 配置获取函数
        if self.config_manager:
            self.register_function("get_config", self.config_manager.get, safe=True)

        # 系统信息函数
        self.register_function("get_stats", lambda: self.get_stats(), safe=True)
        self.register_function("get_session_id", lambda: uuid.uuid4().hex, safe=True)

    # ================================
    # 兼容性方法（为测试添加）
    # ================================
    
    async def initialize(self):
        """初始化引擎"""
        # 检查是否需要更新template_dir
        config_template_dir = self.config.get("template_dir")
        if config_template_dir and str(self._template_dir) != str(config_template_dir):
            self._template_dir = Path(config_template_dir)
            self.template_loader = FileTemplateLoader(self._template_dir)
            self.logger.debug(f"Updated template directory to: {self._template_dir}")
        
        self.is_initialized = True
        # 可以在这里添加任何需要的初始化逻辑
        
    async def render_template_compat(self, template_content_or_id: str, variables: Dict[str, Any] = None, 
                                    template_id: str = None, strict: bool = False) -> str:
        """渲染模板（兼容性方法）
        
        支持两种调用方式：
        1. render_template(template_content, variables) - 直接渲染内容
        2. render_template(template_id, variables) - 加载并渲染模板
        """
        variables = variables or {}
        
        # 如果是模板内容（包含模板变量语法）
        if "{{" in template_content_or_id and "}}" in template_content_or_id:
            # 直接渲染模板内容
            try:
                # 在strict模式下，预先验证所有需要的变量
                if strict:
                    # 提取模板中的变量
                    import re
                    variable_pattern = r'\{\{\s*([^}|]+?)(?:\|[^}]*)?\s*\}\}'
                    required_vars = re.findall(variable_pattern, template_content_or_id)
                    # 清理变量名（去除过滤器、函数调用等）
                    cleaned_vars = []
                    for var in required_vars:
                        var = var.strip().split('(')[0].split('.')[0].split('[')[0]
                        if var and not var.startswith(("'", '"', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9')):
                            cleaned_vars.append(var)
                    
                    # 检查缺失的变量
                    missing_vars = [v for v in cleaned_vars if v not in variables]
                    if missing_vars:
                        raise PromptValidationError(f"Missing required variables: {missing_vars}")
                
                # 使用模板处理器进行完整处理
                context = TemplateContext(variables=variables)
                result = await self.template_processor.process(template_content_or_id, context)
                
                # 如果指定了template_id，则缓存模板内容（而不是结果）
                if template_id:
                    await self.cache.set(template_id, template_content_or_id)
                
                return result
                
                # 以下是旧的简化实现（保留作为备用）
                rendered = template_content_or_id
                
                # 处理嵌套变量访问（如 {{user.profile.name}}）
                def get_nested_value(obj, key_path):
                    """获取嵌套对象的值"""
                    keys = key_path.split('.')
                    current = obj
                    for key in keys:
                        if isinstance(current, dict):
                            current = current.get(key)
                        else:
                            current = getattr(current, key, None)
                        if current is None:
                            return None
                    return current
                
                # 提取所有模板变量
                import re
                variable_pattern = r'\{\{\s*([^}]+)\s*\}\}'
                matches = re.findall(variable_pattern, rendered)
                
                for match in matches:
                    key = match.strip()
                    value = None
                    
                    # 处理嵌套变量
                    if '.' in key:
                        value = get_nested_value(variables, key)
                    else:
                        value = variables.get(key)
                    
                    if value is not None:
                        placeholder_patterns = [
                            "{{" + key + "}}",
                            "{{ " + key + " }}",
                            "{{" + key + " }}",
                            "{{ " + key + "}}"
                        ]
                        for pattern in placeholder_patterns:
                            rendered = rendered.replace(pattern, str(value))
                
                # 检查是否有未替换的变量
                import re
                remaining_vars = re.findall(r'\{\{([^}]+)\}\}', rendered)
                if remaining_vars and strict:
                    raise PromptValidationError(f"Missing variables: {remaining_vars}")
                
                # 如果指定了template_id，则缓存结果
                if template_id:
                    await self.cache.set(template_id, rendered)
                
                return rendered
            except Exception as e:
                self.logger.error(f"Template rendering failed: {e}")
                raise
        else:
            # 作为模板ID处理
            try:
                result = await super().render_template(template_content_or_id, variables)
                return result.content
            except Exception as e:
                # 如果加载失败，尝试作为内容处理
                return template_content_or_id
    
    async def load_template(self, template_name: str):
        """加载模板（兼容性方法）"""
        try:
            content, metadata = await self.template_loader.load_template(template_name)
            # 创建兼容的模板对象
            template = PromptTemplate(
                id=template_name,
                name=template_name,
                content=content
            )
            return template
        except Exception as e:
            self.logger.error(f"Failed to load template {template_name}: {e}")
            raise
    
    async def validate_template(self, template_content: str):
        """验证模板（兼容性方法）"""
        try:
            errors = self.template_processor.validate_template(template_content)
            return ValidationResult(len(errors) == 0, errors)
        except Exception as e:
            return ValidationResult(False, [str(e)])
    
    async def optimize_template(self, template_content: str):
        """优化模板（兼容性方法）"""
        try:
            # 简单的空白字符优化
            lines = template_content.split('\n')
            optimized_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped or len(optimized_lines) == 0 or optimized_lines[-1]:
                    optimized_lines.append(stripped if stripped else "")
            
            optimized_content = '\n'.join(optimized_lines).strip()
            
            original_lines = len([l for l in template_content.split('\n') if l.strip()])
            optimized_lines_count = len([l for l in optimized_content.split('\n') if l.strip()])
            
            return OptimizationResult(
                content=optimized_content,
                stats={
                    "whitespace_reduced": len(template_content) - len(optimized_content),
                    "lines_before": original_lines,
                    "lines_after": optimized_lines_count
                }
            )
        except Exception as e:
            self.logger.error(f"Template optimization failed: {e}")
            return OptimizationResult(template_content, {"error": str(e)})
    
    @property
    def template_loader(self):
        """获取模板加载器（兼容性属性）"""
        return getattr(self, '_template_loader', None)
    
    @template_loader.setter  
    def template_loader(self, value):
        """设置模板加载器（兼容性属性）"""
        self._template_loader = value
    
    @property
    def validator(self):
        """获取验证器（兼容性属性）"""
        return PromptValidator()
    
    @property
    def cache(self):
        """获取缓存（兼容性属性）"""
        if not hasattr(self, '_compat_cache'):
            self._compat_cache = PromptCache()
        return self._compat_cache


# ================================
# 工厂函数和便捷接口
# ================================


def create_prompt_engine(**kwargs) -> DynamicPromptEngine:
    """创建提示引擎实例的工厂函数"""
    return DynamicPromptEngine(**kwargs)


# 全局单例实例（可选）
_global_engine: Optional[DynamicPromptEngine] = None


def get_global_engine(**kwargs) -> DynamicPromptEngine:
    """获取全局引擎实例"""
    global _global_engine
    if _global_engine is None:
        _global_engine = create_prompt_engine(**kwargs)
    return _global_engine


# 便捷函数
async def render(template_id: str, variables: Dict[str, Any] = None, **kwargs) -> str:
    """便捷渲染函数"""
    engine = get_global_engine()
    result = await engine.render_template(template_id, variables, **kwargs)
    return result.content


# ================================
# 向后兼容性包装器和别名
# ================================

# 兼容性包装器类
class PromptTemplate:
    """提示模板兼容性包装器"""
    
    def __init__(self, id: str = None, name: str = None, content: str = "", 
                 variables: List[str] = None, description: str = "", 
                 metadata: Dict[str, Any] = None, validation_rules: Dict[str, Any] = None):
        self.id = id
        self.name = name
        self.content = content
        self.variables = variables or []
        self.description = description
        self.metadata = metadata or {}
        self.validation_rules = validation_rules or {}
        
    def validate_variable(self, name: str, value: Any) -> bool:
        """验证变量值"""
        if name not in self.validation_rules:
            return True
        
        rules = self.validation_rules[name]
        if rules.get("type") == "integer":
            if not isinstance(value, int):
                return False
            if "min" in rules and value < rules["min"]:
                return False
            if "max" in rules and value > rules["max"]:
                return False
        return True


class ValidationResult:
    """验证结果类"""
    
    def __init__(self, is_valid: bool = True, errors: List[str] = None, is_safe: bool = True):
        self.is_valid = is_valid
        self.errors = errors or []
        self.is_safe = is_safe


class PromptValidator:
    """提示验证器兼容性包装器"""
    
    def validate_syntax(self, template: str) -> ValidationResult:
        """验证模板语法"""
        try:
            # 简单的大括号匹配检查
            open_count = template.count("{{")
            close_count = template.count("}}")
            if open_count != close_count:
                return ValidationResult(False, ["Mismatched template braces"])
            return ValidationResult(True)
        except Exception as e:
            return ValidationResult(False, [str(e)])
    
    def extract_variables(self, template: str) -> List[str]:
        """提取模板变量"""
        import re
        pattern = r'\{\{([^}]+)\}\}'
        matches = re.findall(pattern, template)
        return [match.strip() for match in matches]
    
    def validate_security(self, template: str) -> ValidationResult:
        """验证模板安全性"""
        # 检查潜在的代码注入
        dangerous_patterns = ["__import__", "exec", "eval", "system", "rm -rf"]
        for pattern in dangerous_patterns:
            if pattern in template:
                return ValidationResult(True, [], False)
        return ValidationResult(True, [], True)


class PromptCache:
    """提示缓存兼容性包装器"""
    
    def __init__(self, max_size: int = 100, ttl: int = 3600):
        self.max_size = max_size
        self.ttl = ttl
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
    
    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if key in self._cache:
            # 检查是否过期
            if time.time() - self._timestamps[key] < self.ttl:
                return self._cache[key]
            else:
                # 过期则删除
                del self._cache[key]
                del self._timestamps[key]
        return None
    
    async def set(self, key: str, value: Any):
        """设置缓存值"""
        # 如果超过大小限制，删除最旧的项
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._timestamps.keys(), key=lambda k: self._timestamps[k])
            del self._cache[oldest_key]
            del self._timestamps[oldest_key]
        
        self._cache[key] = value
        self._timestamps[key] = time.time()
    
    def has(self, key: str) -> bool:
        """检查缓存中是否存在键"""
        if key not in self._cache:
            return False
        # 检查是否过期
        if time.time() - self._timestamps[key] >= self.ttl:
            del self._cache[key]
            del self._timestamps[key]
            return False
        return True
    
    async def remove(self, key: str):
        """删除缓存项"""
        if key in self._cache:
            del self._cache[key]
            del self._timestamps[key]
    
    @property
    def size(self) -> int:
        """获取缓存大小"""
        return len(self._cache)


class OptimizationResult:
    """优化结果类"""
    
    def __init__(self, content: str, stats: Dict[str, Any] = None):
        self.content = content
        self.stats = stats or {}


class PromptOptimizer:
    """提示优化器兼容性包装器"""
    
    def __init__(self):
        self._optimization_report = {}
    
    def optimize_whitespace(self, template: str) -> str:
        """优化空白字符"""
        import re
        # 移除行内多余空格，但保留模板变量周围的单个空格
        lines = template.split('\n')
        optimized_lines = []
        
        for line in lines:
            # 去除行首行尾空白，但保留行内合理的空格
            stripped = line.strip()
            if stripped:
                # 压缩多个连续空格为单个空格，但保留模板变量格式
                optimized = re.sub(r'\s+', ' ', stripped)
                optimized_lines.append(optimized)
            else:
                optimized_lines.append("")
        
        # 移除多余的空行（连续多个空行压缩为单个）
        result = []
        prev_empty = False
        for line in optimized_lines:
            if not line:
                if not prev_empty:
                    result.append("")
                prev_empty = True
            else:
                result.append(line)
                prev_empty = False
        
        # 去除开头和结尾的空行
        while result and not result[0]:
            result.pop(0)
        while result and not result[-1]:
            result.pop()
            
        return '\n'.join(result)
    
    def optimize_variables(self, template: str, used_variables: List[str]) -> str:
        """优化变量使用"""
        import re
        pattern = r'\{\{([^}]+)\}\}'
        all_variables = re.findall(pattern, template)
        unused_variables = [var.strip() for var in all_variables if var.strip() not in used_variables]
        
        self._optimization_report["unused_variables"] = unused_variables
        return template
    
    def analyze_performance(self, template: str) -> List[str]:
        """分析性能并给出建议"""
        suggestions = []
        if "{% for" in template and template.count("{% for") > 1:
            nested_loops = template.count("{% for") - 1
            if nested_loops > 0:
                suggestions.append(f"Consider optimizing nested loops ({nested_loops} detected)")
        return suggestions
    
    def get_optimization_report(self) -> Dict[str, Any]:
        """获取优化报告"""
        return self._optimization_report


# 创建兼容性包装器类
class PromptEngine(DynamicPromptEngine):
    """提示引擎兼容性包装器"""
    
    def __init__(self, config: Dict[str, Any] = None, **kwargs):
        """初始化提示引擎"""
        # 确保正确传递配置
        if config is None:
            config = {}
        super().__init__(config, **kwargs)
    
    async def render_template(self, template_content_or_id: str, variables: Dict[str, Any] = None, 
                             template_id: str = None, strict: bool = False) -> str:
        """重写render_template方法以提供兼容性"""
        return await self.render_template_compat(template_content_or_id, variables, template_id, strict)

# 为了保持与测试代码的兼容性
PromptVariable = dict  # 简单的变量字典
PromptContext = TemplateContext  # 使用TemplateContext作为PromptContext的别名
TemplateLoader = TemplateLoader  # 已存在
PromptEngineError = PromptEngineException  # 异常别名
PromptTemplateError = TemplateSyntaxError  # 模板错误别名
PromptValidationError = VariableNotFoundError  # 验证错误别名


# 导出的主要类和异常
__all__ = [
    'DynamicPromptEngine',
    'PromptEngine',  # 别名
    'PromptTemplate',
    'PromptVariable', 
    'PromptContext',
    'TemplateLoader',
    'PromptValidator',
    'PromptCache',
    'PromptOptimizer',
    'PromptEngineError',
    'PromptTemplateError', 
    'PromptValidationError',
    'create_prompt_engine',
    'get_global_engine',
    'render'
]

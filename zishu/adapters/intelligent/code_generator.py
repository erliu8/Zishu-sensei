"""
智能代码生成器
"""

import os
import sys
import json
import ast
import re
import hashlib
import asyncio
import logging
import threading
import traceback
import tempfile
import shutil
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from pathlib import Path
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
    Union,
    Callable,
    Type,
    Iterator,
)
import uuid
import time
import weakref
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import multiprocessing

# 深度学习和NLP库导入
try:
    import torch
    import torch.nn as nn
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

# 代码分析库
try:
    import pylint
    from pylint.lint import PyLinter
    import black
    import isort

    PYLINT_AVAILABLE = True
except ImportError:
    PYLINT_AVAILABLE = False

try:
    import autopep8
    import yapf

    FORMATTERS_AVAILABLE = True
except ImportError:
    FORMATTERS_AVAILABLE = False

# 本地导入
from ..base.exceptions import (
    BaseAdapterException,
    AdapterExecutionError,
    AdapterValidationError,
    ErrorCode,
    ExceptionSeverity,
    handle_adapter_exceptions,
)
from ..base.metadata import AdapterMetadata, AdapterCapability, CapabilityCategory
from ..core.security import SecurityManager
from ..core.security.audit import (
    get_audit_logger,
    AuditEventType,
    AuditLevel,
    audit_operation,
)

# 配置日志
logger = logging.getLogger(__name__)


# ================================
# 核心枚举和常量定义
# ================================


class CodeLanguage(Enum):
    """编程语言枚举"""

    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    CPP = "cpp"
    CSHARP = "csharp"
    GO = "go"
    RUST = "rust"
    PHP = "php"
    RUBY = "ruby"
    SCALA = "scala"
    KOTLIN = "kotlin"
    SWIFT = "swift"
    SQL = "sql"
    HTML = "html"
    CSS = "css"
    BASH = "bash"
    POWERSHELL = "powershell"


class CodeComplexity(Enum):
    """代码复杂度等级"""

    SIMPLE = "simple"  # 简单：单个函数，基础逻辑
    MEDIUM = "medium"  # 中等：多函数，含有逻辑分支
    COMPLEX = "complex"  # 复杂：多类多模块，复杂算法
    ENTERPRISE = "enterprise"  # 企业级：完整系统，高级架构


class CodePattern(Enum):
    """代码模式枚举"""

    FUNCTION = "function"
    CLASS = "class"
    MODULE = "module"
    API_ENDPOINT = "api_endpoint"
    DATABASE_QUERY = "database_query"
    DATA_PROCESSING = "data_processing"
    ALGORITHM = "algorithm"
    TEST_CASE = "test_case"
    CONFIGURATION = "configuration"
    DOCUMENTATION = "documentation"


class OptimizationLevel(Enum):
    """优化级别"""

    NONE = "none"  # 无优化
    BASIC = "basic"  # 基础优化
    STANDARD = "standard"  # 标准优化
    AGGRESSIVE = "aggressive"  # 激进优化


class CodeQuality(Enum):
    """代码质量等级"""

    POOR = 1
    FAIR = 2
    GOOD = 3
    EXCELLENT = 4
    OUTSTANDING = 5


# ================================
# 核心数据结构
# ================================


@dataclass
class CodeGenerationRequest:
    """代码生成请求"""

    # 基础信息
    request_id: str = field(default_factory=lambda: f"req_{uuid.uuid4().hex[:8]}")
    description: str = ""
    language: CodeLanguage = CodeLanguage.PYTHON
    complexity: CodeComplexity = CodeComplexity.MEDIUM

    # 生成参数
    max_length: int = 2048
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50

    # 上下文信息
    context: Dict[str, Any] = field(default_factory=dict)
    existing_code: Optional[str] = None
    requirements: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)

    # 质量要求
    min_quality_score: float = 0.7
    enable_optimization: bool = True
    optimization_level: OptimizationLevel = OptimizationLevel.STANDARD

    # 安全设置
    enable_safety_check: bool = True
    allowed_imports: Optional[List[str]] = None
    forbidden_patterns: List[str] = field(default_factory=list)

    # 新增属性以兼容测试
    style_preferences: Dict[str, Any] = field(default_factory=dict)
    include_comments: bool = True
    include_tests: bool = False
    target_framework: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)

    # 元数据
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class CodeGenerationResult:
    """代码生成结果"""

    # 基础结果
    request_id: str
    generated_code: str
    language: CodeLanguage

    # 质量评估
    quality_score: float = 0.0
    complexity_score: float = 0.0
    maintainability_score: float = 0.0
    security_score: float = 0.0

    # 代码分析
    detected_patterns: List[CodePattern] = field(default_factory=list)
    imports_used: List[str] = field(default_factory=list)
    functions_defined: List[str] = field(default_factory=list)
    classes_defined: List[str] = field(default_factory=list)

    # 优化信息
    optimization_applied: bool = False
    optimization_suggestions: List[str] = field(default_factory=list)
    performance_notes: List[str] = field(default_factory=list)

    # 验证结果
    syntax_valid: bool = True
    security_issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # 执行统计
    generation_time_ms: float = 0.0
    tokens_generated: int = 0
    model_used: Optional[str] = None

    # 时间戳
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # 兼容属性
    @property
    def code(self) -> str:
        """兼容旧接口的代码属性"""
        return self.generated_code
    
    @property
    def explanation(self) -> str:
        """代码解释"""
        return self.metadata.get("explanation", "Code generated successfully")
    
    @property
    def confidence(self) -> float:
        """置信度"""
        return self.quality_score
    
    # 兼容旧构造参数
    success: bool = True
    error_message: Optional[str] = None
    template_used: Optional[str] = None


@dataclass
class CodeTemplate:
    """代码模板"""

    template_id: str
    name: str
    description: str
    language: CodeLanguage
    pattern: CodePattern
    template_code: str

    # 模板参数
    parameters: Dict[str, Any] = field(default_factory=dict)
    required_imports: List[str] = field(default_factory=list)
    complexity: CodeComplexity = CodeComplexity.MEDIUM

    # 使用统计
    usage_count: int = 0
    success_rate: float = 0.0
    average_quality_score: float = 0.0

    # 元数据
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    tags: List[str] = field(default_factory=list)

    def update_usage_stats(self, success: bool, quality_score: float):
        """更新使用统计"""
        self.usage_count += 1
        if success:
            # 更新成功率（使用移动平均）
            self.success_rate = (
                self.success_rate * (self.usage_count - 1) + 1.0
            ) / self.usage_count
            # 更新平均质量分数
            self.average_quality_score = (
                self.average_quality_score * (self.usage_count - 1) + quality_score
            ) / self.usage_count
        else:
            self.success_rate = (
                self.success_rate * (self.usage_count - 1)
            ) / self.usage_count

        self.updated_at = datetime.now(timezone.utc)


@dataclass
class CodeOptimizationRule:
    """代码优化规则"""

    rule_id: str
    name: str
    description: str
    language: CodeLanguage

    # 规则定义
    pattern_regex: str  # 匹配模式的正则表达式
    replacement_template: str  # 替换模板

    # 条件
    min_complexity: CodeComplexity = CodeComplexity.SIMPLE
    applicable_patterns: List[CodePattern] = field(default_factory=list)

    # 效果评估
    performance_impact: float = 0.0  # 性能影响分数 (-1到1)
    readability_impact: float = 0.0  # 可读性影响分数
    maintainability_impact: float = 0.0  # 可维护性影响分数

    # 统计
    application_count: int = 0
    success_rate: float = 0.0

    enabled: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ================================
# 核心异常类定义
# ================================


class CodeGenerationError(BaseAdapterException):
    """代码生成错误"""

    def __init__(self, message: str, error_code: ErrorCode = ErrorCode.ADAPTER_EXECUTION_FAILED):
        super().__init__(message, error_code, ExceptionSeverity.ERROR)


class CodeValidationError(CodeGenerationError):
    """代码验证错误"""

    def __init__(self, message: str, validation_issues: List[str] = None):
        super().__init__(message, ErrorCode.VALIDATION_ERROR)
        self.validation_issues = validation_issues or []


class CodeOptimizationError(CodeGenerationError):
    """代码优化错误"""

    def __init__(self, message: str):
        super().__init__(message, ErrorCode.PROCESSING_ERROR)


class UnsupportedLanguageError(CodeGenerationError):
    """不支持的编程语言错误"""

    def __init__(self, language: str):
        super().__init__(
            f"Unsupported programming language: {language}", ErrorCode.INVALID_INPUT
        )


# ================================
# 核心管理器类
# ================================


class CodeTemplateManager:
    """代码模板管理器"""

    def __init__(self):
        self.templates = {}
        self.audit_logger = get_audit_logger()
        self._initialize_default_templates()

    def _initialize_default_templates(self):
        """初始化默认模板"""
        # Python函数模板
        self.templates["python_function"] = CodeTemplate(
            template_id="python_function",
            name="Python Function Template",
            description="基础Python函数模板",
            language=CodeLanguage.PYTHON,
            pattern=CodePattern.FUNCTION,
            template_code='''def {function_name}({parameters}):
    """
    {description}

    Args:
        {args_description}

    Returns:
        {return_description}
    """
    # TODO: Implement function logic
    pass
'''
        )

        # Python类模板
        self.templates["python_class"] = CodeTemplate(
            template_id="python_class",
            name="Python Class Template",
            description="基础Python类模板",
            language=CodeLanguage.PYTHON,
            pattern=CodePattern.CLASS,
            template_code='''class {class_name}:
    """
    {description}
    """
    
    def __init__(self, {init_parameters}):
        """Initialize {class_name}"""
        {init_body}
    
    def {method_name}(self, {method_parameters}):
        """Main processing method"""
        # TODO: Implement method logic
        pass
'''
        )

    async def search_templates(
        self,
        language: CodeLanguage,
        pattern: CodePattern,
        complexity: CodeComplexity = None,
    ) -> List[CodeTemplate]:
        """搜索模板"""
        results = []

        for template in self.templates.values():
            if template.language == language and template.pattern == pattern:
                if complexity is None or template.complexity == complexity:
                    results.append(template)

        return results

    async def get_template(self, template_id: str) -> Optional[CodeTemplate]:
        """获取指定模板"""
        return self.templates.get(template_id)

    async def add_template(self, template: CodeTemplate) -> bool:
        """添加新模板"""
        try:
            self.templates[template.template_id] = template
            await self.audit_logger.log_action(
                action="template_added",
                details={
                    "template_id": template.template_id,
                    "language": template.language.value,
                },
            )
            return True
        except Exception as e:
            await self.audit_logger.log_error(f"Failed to add template: {e}")
            return False


class CodeQualityAnalyzer:
    """代码质量分析器"""

    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.quality_thresholds = {
            "syntax_valid": 1.0,
            "complexity_score": 0.7,
            "maintainability_score": 0.6,
            "security_score": 0.8,
        }

    async def analyze(
        self, code: str, language: CodeLanguage
    ) -> "QualityAnalysisResult":
        """分析代码质量"""
        try:
            # 基础语法检查
            syntax_valid = await self._check_syntax(code, language)

            # 复杂度分析
            complexity_score = await self._analyze_complexity(code, language)

            # 可维护性分析
            maintainability_score = await self._analyze_maintainability(code, language)

            # 安全性分析
            security_score = await self._analyze_security(code, language)

            # 计算总体评分
            overall_score = (
                syntax_valid * 0.3
                + complexity_score * 0.25
                + maintainability_score * 0.25
                + security_score * 0.2
            )

            return QualityAnalysisResult(
                overall_score=overall_score,
                syntax_valid=syntax_valid > 0.9,
                complexity_score=complexity_score,
                maintainability_score=maintainability_score,
                security_score=security_score,
                details={
                    "syntax_valid": syntax_valid,
                    "complexity_score": complexity_score,
                    "maintainability_score": maintainability_score,
                    "security_score": security_score,
                },
                warnings=[],
                suggestions=[],
            )

        except Exception as e:
            await self.audit_logger.log_error(f"Quality analysis failed: {e}")
            return QualityAnalysisResult(
                overall_score=0.0,
                syntax_valid=False,
                details={"error": str(e)},
                warnings=[f"Analysis failed: {e}"],
                suggestions=["Please check code syntax and structure"],
            )

    async def _check_syntax(self, code: str, language: CodeLanguage) -> float:
        """检查语法正确性"""
        try:
            if language == CodeLanguage.PYTHON:
                import ast

                ast.parse(code)
                return 1.0
            else:
                # 其他语言的简单检查
                return 0.9 if code.strip() else 0.0
        except:
            return 0.0

    async def _analyze_complexity(self, code: str, language: CodeLanguage) -> float:
        """分析代码复杂度"""
        # 简化的复杂度分析
        lines = code.split("\n")
        non_empty_lines = [line for line in lines if line.strip()]

        # 基于行数的简单评估
        line_count = len(non_empty_lines)
        if line_count <= 20:
            return 0.9
        elif line_count <= 50:
            return 0.7
        elif line_count <= 100:
            return 0.5
        else:
            return 0.3

    async def _analyze_maintainability(
        self, code: str, language: CodeLanguage
    ) -> float:
        """分析可维护性"""
        # 简化的可维护性分析
        has_comments = '"""' in code or "#" in code or "//" in code
        has_docstring = '"""' in code or "/*" in code

        score = 0.5
        if has_comments:
            score += 0.2
        if has_docstring:
            score += 0.3

        return min(score, 1.0)

    async def _analyze_security(self, code: str, language: CodeLanguage) -> float:
        """分析安全性"""
        # 简化的安全性分析
        dangerous_patterns = ["eval(", "exec(", "os.system(", "subprocess.call("]

        for pattern in dangerous_patterns:
            if pattern in code:
                return 0.3

        return 0.9


class CodePatternEngine:
    """代码模式识别引擎"""

    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.pattern_rules = self._initialize_pattern_rules()

    def _initialize_pattern_rules(self) -> Dict[CodePattern, List[str]]:
        """初始化模式规则"""
        return {
            CodePattern.FUNCTION: ["def ", "function ", "func "],
            CodePattern.CLASS: ["class ", "interface ", "struct "],
            CodePattern.API_ENDPOINT: ["@app.route", "@api.", "app.get", "app.post"],
            CodePattern.DATABASE_QUERY: [
                "SELECT",
                "INSERT",
                "UPDATE",
                "DELETE",
                "CREATE TABLE",
            ],
            CodePattern.TEST_CASE: ["test_", "it(", "describe(", "assert", "expect("],
            CodePattern.ALGORITHM: ["sort", "search", "algorithm", "recursive"],
        }

    def _detect_code_patterns(
        self, code: str, language: CodeLanguage
    ) -> List[CodePattern]:
        """检测代码模式"""
        detected_patterns = []
        code_lower = code.lower()

        for pattern, keywords in self.pattern_rules.items():
            for keyword in keywords:
                if keyword.lower() in code_lower:
                    detected_patterns.append(pattern)
                    break

        return detected_patterns


class CodeOptimizer:
    """代码优化器"""

    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.formatters = {
            CodeLanguage.PYTHON: PythonCodeFormatter(),
            CodeLanguage.JAVASCRIPT: JavaScriptCodeFormatter(),
            CodeLanguage.JAVA: JavaCodeFormatter(),
        }

    async def optimize(
        self, code: str, language: CodeLanguage, optimization_level: OptimizationLevel
    ) -> str:
        """优化代码"""
        try:
            optimized_code = code

            if optimization_level == OptimizationLevel.NONE:
                return optimized_code

            # 基础优化：格式化
            if language in self.formatters:
                formatter = self.formatters[language]
                optimized_code = await formatter.format(optimized_code)

            # 标准优化：添加注释和文档
            if optimization_level in [
                OptimizationLevel.STANDARD,
                OptimizationLevel.AGGRESSIVE,
            ]:
                optimized_code = await self._add_documentation(optimized_code, language)

            # 激进优化：性能优化
            if optimization_level == OptimizationLevel.AGGRESSIVE:
                optimized_code = await self._performance_optimize(
                    optimized_code, language
                )

            return optimized_code

        except Exception as e:
            await self.audit_logger.log_error(f"Code optimization failed: {e}")
            return code  # 返回原始代码

    async def _add_documentation(self, code: str, language: CodeLanguage) -> str:
        """添加文档和注释"""
        # 简化实现 - 实际会更复杂
        if '"""' not in code and "def " in code and language == CodeLanguage.PYTHON:
            # 为Python函数添加基础文档字符串
            lines = code.split("\n")
            result_lines = []

            for i, line in enumerate(lines):
                result_lines.append(line)
                if "def " in line and ":" in line:
                    indent = len(line) - len(line.lstrip())
                    doc_line = (
                        " " * (indent + 4) + '"""TODO: Add function documentation"""'
                    )
                    result_lines.append(doc_line)

            return "\n".join(result_lines)

        return code

    async def _performance_optimize(self, code: str, language: CodeLanguage) -> str:
        """性能优化"""
        # 简化实现
        return code


@dataclass
class QualityAnalysisResult:
    """质量分析结果"""

    overall_score: float = 0.0
    syntax_valid: bool = False
    complexity_score: float = 0.0
    maintainability_score: float = 0.0
    security_score: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


# ================================
# 代码分析器
# ================================


class CodeAnalyzer:
    """代码分析器 - 分析代码结构、模式和质量"""

    def __init__(self):
        self.audit_logger = get_audit_logger()

        # 语言特定的分析器
        self.language_analyzers = {
            CodeLanguage.PYTHON: PythonCodeAnalyzer(),
            CodeLanguage.JAVASCRIPT: JavaScriptCodeAnalyzer(),
            CodeLanguage.JAVA: JavaCodeAnalyzer(),
            # 更多语言分析器可以扩展
        }

    @audit_operation(AuditEventType.ADAPTER_EXECUTE, "Code analysis")
    async def analyze_code(self, code: str, language: CodeLanguage) -> Dict[str, Any]:
        """分析代码"""
        try:
            start_time = time.time()

            # 获取语言特定分析器
            analyzer = self.language_analyzers.get(language)
            if not analyzer:
                # 使用通用分析器
                analyzer = GenericCodeAnalyzer()

            # 执行代码分析
            analysis_result = await analyzer.analyze(code)

            # 计算质量分数
            quality_score = self._calculate_quality_score(analysis_result)

            # 检测代码模式
            patterns = self._detect_code_patterns(code, language)

            analysis_time = (time.time() - start_time) * 1000

            result = {
                "language": language.value,
                "quality_score": quality_score,
                "complexity_score": analysis_result.get("complexity_score", 0.0),
                "maintainability_score": analysis_result.get(
                    "maintainability_score", 0.0
                ),
                "security_score": analysis_result.get("security_score", 1.0),
                "detected_patterns": patterns,
                "syntax_valid": analysis_result.get("syntax_valid", True),
                "imports_used": analysis_result.get("imports", []),
                "functions_defined": analysis_result.get("functions", []),
                "classes_defined": analysis_result.get("classes", []),
                "warnings": analysis_result.get("warnings", []),
                "security_issues": analysis_result.get("security_issues", []),
                "analysis_time_ms": analysis_time,
                "metadata": analysis_result.get("metadata", {}),
            }

            logger.info(f"Code analysis completed in {analysis_time:.2f}ms")
            return result

        except Exception as e:
            logger.error(f"Code analysis failed: {e}")
            raise CodeValidationError(f"Code analysis failed: {e}")

    def _calculate_quality_score(self, analysis_result: Dict[str, Any]) -> float:
        """计算综合质量分数"""
        weights = {
            "syntax_valid": 0.3,
            "complexity_score": 0.2,
            "maintainability_score": 0.2,
            "security_score": 0.15,
            "documentation_score": 0.1,
            "test_coverage": 0.05,
        }

        score = 0.0
        total_weight = 0.0

        for key, weight in weights.items():
            if key in analysis_result:
                if key == "syntax_valid":
                    value = 1.0 if analysis_result[key] else 0.0
                else:
                    value = float(analysis_result.get(key, 0.0))

                score += value * weight
                total_weight += weight

        return score / total_weight if total_weight > 0 else 0.0

    def _detect_code_patterns(
        self, code: str, language: CodeLanguage
    ) -> List[CodePattern]:
        """检测代码模式"""
        patterns = []

        # 简化的模式检测 - 在实际实现中会更复杂
        if "def " in code or "function " in code:
            patterns.append(CodePattern.FUNCTION)
        if "class " in code:
            patterns.append(CodePattern.CLASS)
        if any(
            keyword in code.lower()
            for keyword in ["select", "insert", "update", "delete"]
        ):
            patterns.append(CodePattern.DATABASE_QUERY)
        if any(
            keyword in code.lower()
            for keyword in ["@app.route", "@app.get", "app.post"]
        ):
            patterns.append(CodePattern.API_ENDPOINT)
        if any(keyword in code.lower() for keyword in ["test_", "assert", "unittest"]):
            patterns.append(CodePattern.TEST_CASE)

        return patterns


class BaseCodeAnalyzer(ABC):
    """代码分析器基类"""

    @abstractmethod
    async def analyze(self, code: str) -> Dict[str, Any]:
        """分析代码"""
        pass


class PythonCodeAnalyzer(BaseCodeAnalyzer):
    """Python代码分析器"""

    async def analyze(self, code: str) -> Dict[str, Any]:
        """分析Python代码"""
        result = {
            "syntax_valid": True,
            "complexity_score": 0.7,
            "maintainability_score": 0.8,
            "security_score": 0.9,
            "imports": [],
            "functions": [],
            "classes": [],
            "warnings": [],
            "security_issues": [],
        }

        try:
            # 解析AST
            tree = ast.parse(code)

            # 提取导入
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        result["imports"].append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        result["imports"].append(node.module)
                elif isinstance(node, ast.FunctionDef):
                    result["functions"].append(node.name)
                elif isinstance(node, ast.ClassDef):
                    result["classes"].append(node.name)

            # 计算复杂度（简化版本）
            complexity = self._calculate_complexity(tree)
            result["complexity_score"] = min(1.0, max(0.0, 1.0 - (complexity - 5) / 20))

            # 安全检查
            security_issues = self._check_security_issues(code, tree)
            result["security_issues"] = security_issues
            result["security_score"] = max(0.0, 1.0 - len(security_issues) * 0.2)

        except SyntaxError as e:
            result["syntax_valid"] = False
            result["warnings"].append(f"Syntax error: {e}")

        return result

    def _calculate_complexity(self, tree: ast.AST) -> int:
        """计算循环复杂度"""
        complexity = 1  # 基础复杂度

        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(node, (ast.And, ast.Or)):
                complexity += 1

        return complexity

    def _check_security_issues(self, code: str, tree: ast.AST) -> List[str]:
        """检查安全问题"""
        issues = []

        # 检查危险函数调用
        dangerous_functions = ["eval", "exec", "compile", "__import__"]
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in dangerous_functions:
                    issues.append(
                        f"Potentially dangerous function call: {node.func.id}"
                    )

        # 检查SQL注入风险
        if any(pattern in code.lower() for pattern in ["sql", "query", "execute"]):
            if "%" in code or ".format(" in code or 'f"' in code or "f'" in code:
                issues.append(
                    "Potential SQL injection risk - use parameterized queries"
                )

        return issues


class JavaScriptCodeAnalyzer(BaseCodeAnalyzer):
    """JavaScript代码分析器"""

    async def analyze(self, code: str) -> Dict[str, Any]:
        """分析JavaScript代码"""
        # 简化的JavaScript分析
        result = {
            "syntax_valid": True,
            "complexity_score": 0.7,
            "maintainability_score": 0.7,
            "security_score": 0.8,
            "functions": [],
            "classes": [],
            "warnings": [],
            "security_issues": [],
        }

        # 基本的函数和类检测
        import re

        functions = re.findall(r"function\s+(\w+)", code)
        result["functions"] = functions

        classes = re.findall(r"class\s+(\w+)", code)
        result["classes"] = classes

        # 安全检查
        if "eval(" in code:
            result["security_issues"].append(
                "Use of eval() function - potential security risk"
            )
        if "innerHTML" in code and ("user" in code.lower() or "input" in code.lower()):
            result["security_issues"].append(
                "Potential XSS vulnerability with innerHTML"
            )

        result["security_score"] = max(0.0, 1.0 - len(result["security_issues"]) * 0.3)

        return result


class JavaCodeAnalyzer(BaseCodeAnalyzer):
    """Java代码分析器"""

    async def analyze(self, code: str) -> Dict[str, Any]:
        """分析Java代码"""
        # 简化的Java分析
        result = {
            "syntax_valid": True,
            "complexity_score": 0.8,
            "maintainability_score": 0.8,
            "security_score": 0.9,
            "functions": [],
            "classes": [],
            "warnings": [],
            "security_issues": [],
        }

        # 基本的方法和类检测
        import re

        methods = re.findall(
            r"(?:public|private|protected)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*\{", code
        )
        result["functions"] = methods

        classes = re.findall(r"(?:public\s+)?class\s+(\w+)", code)
        result["classes"] = classes

        return result


class GenericCodeAnalyzer(BaseCodeAnalyzer):
    """通用代码分析器"""

    async def analyze(self, code: str) -> Dict[str, Any]:
        """通用代码分析"""
        return {
            "syntax_valid": True,
            "complexity_score": 0.5,
            "maintainability_score": 0.5,
            "security_score": 0.7,
            "functions": [],
            "classes": [],
            "warnings": [
                "Using generic analyzer - language-specific analysis not available"
            ],
            "security_issues": [],
        }


# ================================
# 代码格式化器
# ================================


class CodeFormatter:
    """代码格式化器"""

    def __init__(self):
        self.formatters = {
            CodeLanguage.PYTHON: PythonCodeFormatter(),
            CodeLanguage.JAVASCRIPT: JavaScriptCodeFormatter(),
            CodeLanguage.JAVA: JavaCodeFormatter(),
        }

    async def format_code(self, code: str, language: CodeLanguage) -> str:
        """格式化代码"""
        formatter = self.formatters.get(language)
        if formatter:
            return await formatter.format(code)
        else:
            # 通用格式化（基本的缩进处理）
            return self._basic_format(code)

    def _basic_format(self, code: str) -> str:
        """基础格式化"""
        lines = code.split("\n")
        formatted_lines = []
        indent_level = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append("")
                continue

            # 简化的缩进逻辑
            if any(
                stripped.startswith(keyword)
                for keyword in ["class ", "def ", "function ", "if ", "for ", "while "]
            ):
                formatted_lines.append("    " * indent_level + stripped)
                if stripped.endswith(":") or stripped.endswith("{"):
                    indent_level += 1
            elif stripped in ["}", ")", "]"] or stripped.startswith("}"):
                indent_level = max(0, indent_level - 1)
                formatted_lines.append("    " * indent_level + stripped)
            else:
                formatted_lines.append("    " * indent_level + stripped)

        return "\n".join(formatted_lines)


class BaseCodeFormatter(ABC):
    """代码格式化器基类"""

    @abstractmethod
    async def format(self, code: str) -> str:
        """格式化代码"""
        pass


class PythonCodeFormatter(BaseCodeFormatter):
    """Python代码格式化器"""

    async def format(self, code: str) -> str:
        """格式化Python代码"""
        try:
            if FORMATTERS_AVAILABLE:
                # 使用 black 进行格式化
                import black

                return black.format_str(code, mode=black.FileMode())
            else:
                # 基础格式化
                return self._basic_python_format(code)
        except Exception as e:
            logger.warning(f"Failed to format Python code: {e}")
            return code

    def _basic_python_format(self, code: str) -> str:
        """基础Python格式化"""
        lines = code.split("\n")
        formatted_lines = []
        indent_level = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append("")
                continue

            # 处理缩进
            if any(
                stripped.startswith(keyword)
                for keyword in [
                    "def ",
                    "class ",
                    "if ",
                    "elif ",
                    "else:",
                    "for ",
                    "while ",
                    "with ",
                    "try:",
                    "except",
                    "finally:",
                ]
            ):
                formatted_lines.append("    " * indent_level + stripped)
                if stripped.endswith(":"):
                    indent_level += 1
            elif (
                stripped.startswith("return ")
                or stripped.startswith("break")
                or stripped.startswith("continue")
            ):
                formatted_lines.append("    " * indent_level + stripped)
            else:
                formatted_lines.append("    " * indent_level + stripped)

        return "\n".join(formatted_lines)


class JavaScriptCodeFormatter(BaseCodeFormatter):
    """JavaScript代码格式化器"""

    async def format(self, code: str) -> str:
        """格式化JavaScript代码"""
        # 简化的JavaScript格式化
        lines = code.split("\n")
        formatted_lines = []
        indent_level = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append("")
                continue

            if stripped.endswith("{"):
                formatted_lines.append("  " * indent_level + stripped)
                indent_level += 1
            elif stripped.startswith("}"):
                indent_level = max(0, indent_level - 1)
                formatted_lines.append("  " * indent_level + stripped)
            else:
                formatted_lines.append("  " * indent_level + stripped)

        return "\n".join(formatted_lines)


class JavaCodeFormatter(BaseCodeFormatter):
    """Java代码格式化器"""

    async def format(self, code: str) -> str:
        """格式化Java代码"""
        # 简化的Java格式化
        lines = code.split("\n")
        formatted_lines = []
        indent_level = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append("")
                continue

            if stripped.endswith("{"):
                formatted_lines.append("    " * indent_level + stripped)
                indent_level += 1
            elif stripped.startswith("}"):
                indent_level = max(0, indent_level - 1)
                formatted_lines.append("    " * indent_level + stripped)
            else:
                formatted_lines.append("    " * indent_level + stripped)

        return "\n".join(formatted_lines)


# ================================
# 智能代码生成器主类
# ================================


class IntelligentCodeGenerator:
    """智能代码生成器主类"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """初始化智能代码生成器"""
        self.config = config or {}
        self.template_manager = CodeTemplateManager()
        self.quality_analyzer = CodeQualityAnalyzer()
        self.pattern_engine = CodePatternEngine()
        self.optimizer = CodeOptimizer()
        self.language_generators = {}

        # 初始化语言生成器
        self._initialize_language_generators()

        # 生成统计
        self.generation_stats = {
            "total_generated": 0,
            "successful_generations": 0,
            "failed_generations": 0,
            "average_quality_score": 0.0,
        }

    def _initialize_language_generators(self):
        """初始化语言生成器"""
        for language in LanguageGeneratorFactory.get_supported_languages():
            self.language_generators[
                language
            ] = LanguageGeneratorFactory.create_generator(language)

    async def generate_code(
        self, request: CodeGenerationRequest
    ) -> CodeGenerationResult:
        """生成代码"""
        try:
            self.generation_stats["total_generated"] += 1

            # 1. 预处理请求
            processed_request = await self._preprocess_request(request)

            # 2. 选择合适的模板
            template = await self._select_template(processed_request)

            # 3. 使用语言特定生成器生成代码
            language_key = processed_request.language.value
            if language_key not in self.language_generators:
                raise ValueError(f"Unsupported language: {language_key}")

            generator = self.language_generators[language_key]
            generated_code = await generator.generate(processed_request, template)

            # 4. 代码优化
            if processed_request.optimization_level != OptimizationLevel.NONE:
                generated_code = await self.optimizer.optimize(
                    generated_code,
                    processed_request.language,
                    processed_request.optimization_level,
                )

            # 5. 质量分析
            quality_result = await self.quality_analyzer.analyze(
                generated_code, processed_request.language
            )

            # 6. 创建结果
            result = CodeGenerationResult(
                request_id=processed_request.request_id,
                generated_code=generated_code,
                language=processed_request.language,
                quality_score=quality_result.overall_score,
                generation_time_ms=0.0,  # 实际实现中会计算时间
                template_used=template.template_id if template else None,
                optimization_applied=processed_request.optimization_level != OptimizationLevel.NONE,
                detected_patterns=self.pattern_engine._detect_code_patterns(
                    generated_code, processed_request.language
                ),
                metadata={
                    "complexity": processed_request.complexity.value,
                    "quality_details": quality_result.details,
                    "warnings": quality_result.warnings,
                    "suggestions": quality_result.suggestions,
                    "explanation": f"Generated {processed_request.language.value} code for: {processed_request.description}",
                },
            )

            self.generation_stats["successful_generations"] += 1
            self._update_quality_stats(quality_result.overall_score)

            return result

        except Exception as e:
            self.generation_stats["failed_generations"] += 1

            # 返回错误结果
            return CodeGenerationResult(
                request_id=request.request_id,
                generated_code="",
                language=request.language,
                quality_score=0.0,
                generation_time_ms=0.0,
                success=False,
                error_message=str(e),
                metadata={"error_type": type(e).__name__},
            )

    async def _preprocess_request(
        self, request: CodeGenerationRequest
    ) -> CodeGenerationRequest:
        """预处理请求"""
        # 在实际实现中，这里会进行更复杂的预处理
        # 例如：语义分析、意图识别、上下文增强等

        processed_request = CodeGenerationRequest(
            request_id=request.request_id,
            description=request.description.strip(),
            language=request.language,
            complexity=request.complexity,
            max_length=min(request.max_length, 10000),  # 限制最大长度
            style_preferences=request.style_preferences,
            optimization_level=request.optimization_level,
            include_comments=request.include_comments,
            include_tests=request.include_tests,
            target_framework=request.target_framework,
            dependencies=request.dependencies,
            context=request.context,
        )

        return processed_request

    async def _select_template(
        self, request: CodeGenerationRequest
    ) -> Optional[CodeTemplate]:
        """选择合适的模板"""
        # 检测代码模式
        patterns = self._detect_request_patterns(request.description)

        if patterns:
            # 根据模式查找模板
            for pattern in patterns:
                templates = await self.template_manager.search_templates(
                    language=request.language,
                    pattern=pattern,
                    complexity=request.complexity,
                )
                if templates:
                    return templates[0]  # 返回最匹配的模板

        return None

    def _detect_request_patterns(self, description: str) -> List[CodePattern]:
        """从描述中检测代码模式"""
        patterns = []
        description_lower = description.lower()

        # 简单的关键词匹配 - 实际实现会更智能
        if any(
            keyword in description_lower for keyword in ["function", "method", "def"]
        ):
            patterns.append(CodePattern.FUNCTION)
        if any(keyword in description_lower for keyword in ["class", "object"]):
            patterns.append(CodePattern.CLASS)
        if any(
            keyword in description_lower for keyword in ["api", "endpoint", "route"]
        ):
            patterns.append(CodePattern.API_ENDPOINT)
        if any(
            keyword in description_lower for keyword in ["database", "query", "sql"]
        ):
            patterns.append(CodePattern.DATABASE_QUERY)
        if any(keyword in description_lower for keyword in ["test", "unit test"]):
            patterns.append(CodePattern.TEST_CASE)
        if any(
            keyword in description_lower for keyword in ["algorithm", "sort", "search"]
        ):
            patterns.append(CodePattern.ALGORITHM)

        return patterns

    def _update_quality_stats(self, quality_score: float):
        """更新质量统计"""
        current_avg = self.generation_stats["average_quality_score"]
        total_successful = self.generation_stats["successful_generations"]

        if total_successful == 1:
            self.generation_stats["average_quality_score"] = quality_score
        else:
            # 计算新的平均值
            new_avg = (
                (current_avg * (total_successful - 1)) + quality_score
            ) / total_successful
            self.generation_stats["average_quality_score"] = new_avg

    async def get_generation_stats(self) -> Dict[str, Any]:
        """获取生成统计信息"""
        return self.generation_stats.copy()

    async def get_supported_languages(self) -> List[str]:
        """获取支持的编程语言"""
        return LanguageGeneratorFactory.get_supported_languages()

    async def validate_request(self, request: CodeGenerationRequest) -> List[str]:
        """验证请求的有效性"""
        errors = []

        if not request.description.strip():
            errors.append("Description cannot be empty")

        if len(request.description) > 10000:
            errors.append("Description is too long (max 10000 characters)")

        if request.language.value not in self.language_generators:
            errors.append(f"Unsupported language: {request.language.value}")

        if request.max_length <= 0:
            errors.append("Max length must be positive")

        return errors
    
    def validate_code(self, code: str, language: CodeLanguage = CodeLanguage.PYTHON) -> bool:
        """验证代码语法正确性"""
        try:
            if language == CodeLanguage.PYTHON:
                import ast
                ast.parse(code)
                return True
            else:
                # 其他语言的简单检查
                return bool(code.strip())
        except:
            return False
    
    def format_code(self, code: str, language: CodeLanguage = CodeLanguage.PYTHON) -> str:
        """格式化代码"""
        try:
            formatter = self.optimizer.formatters.get(language)
            if formatter:
                # 同步调用格式化器的format方法（去掉async）
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(formatter.format(code))
                    return result
                finally:
                    loop.close()
            else:
                # 基础格式化
                return self._basic_format_code(code)
        except Exception as e:
            logger.warning(f"Failed to format code: {e}")
            return code
    
    def _basic_format_code(self, code: str) -> str:
        """基础代码格式化"""
        lines = code.split("\n")
        formatted_lines = []
        indent_level = 0
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append("")
                continue
            
            # 简化的缩进逻辑
            if any(stripped.startswith(keyword) for keyword in ["def ", "class ", "if ", "for ", "while "]):
                formatted_lines.append("    " * indent_level + stripped)
                if stripped.endswith(":"):
                    indent_level += 1
            elif stripped in ["}", ")", "]"] or stripped.startswith("}"):
                indent_level = max(0, indent_level - 1)
                formatted_lines.append("    " * indent_level + stripped)
            else:
                formatted_lines.append("    " * indent_level + stripped)
        
        return "\n".join(formatted_lines)
    
    async def _call_model(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """调用模型生成代码（模拟实现）"""
        # 模拟模型调用 - 在实际实现中会调用真实的AI模型
        await asyncio.sleep(0.1)  # 模拟网络延迟
        
        # 根据提示生成简单的代码
        if "function" in prompt.lower():
            code = f"def generated_function():\n    \"\"\"{prompt}\"\"\"\n    # TODO: Implement function logic\n    pass"
        elif "class" in prompt.lower():
            code = f"class GeneratedClass:\n    \"\"\"{prompt}\"\"\"\n    \n    def __init__(self):\n        pass\n    \n    def process(self):\n        # TODO: Implement class logic\n        pass"
        else:
            code = f"# Generated code for: {prompt}\nresult = 'placeholder'"
        
        return {
            "code": code,
            "confidence": 0.8,
            "explanation": f"Generated code based on: {prompt}"
        }


# ================================
# 语言特定生成器
# ================================


class BaseLanguageGenerator(ABC):
    """语言生成器基类"""

    @abstractmethod
    async def generate(
        self, request: CodeGenerationRequest, template: Optional[CodeTemplate] = None
    ) -> str:
        """生成代码"""
        pass


class PythonCodeGenerator(BaseLanguageGenerator):
    """Python代码生成器"""

    async def generate(
        self, request: CodeGenerationRequest, template: Optional[CodeTemplate] = None
    ) -> str:
        """生成Python代码"""
        description = request.description

        # 检测生成类型
        if "class" in description.lower():
            return await self._generate_python_class(request)
        else:
            return await self._generate_python_function(request)

    async def _generate_python_function(self, request: CodeGenerationRequest) -> str:
        """生成Python函数"""
        function_name = self._extract_function_name(request.description)

        return f'''def {function_name}():
    """
    {request.description}
    """
    # TODO: Implement function logic
    pass
'''

    async def _generate_python_class(self, request: CodeGenerationRequest) -> str:
        """生成Python类"""
        class_name = self._extract_class_name(request.description)

        return f'''class {class_name}:
    """
    {request.description}
    """
    
    def __init__(self):
        """Initialize {class_name}"""
        pass
    
    def process(self):
        """Main processing method"""
        # TODO: Implement class logic
        pass
'''

    def _extract_function_name(self, description: str) -> str:
        """从描述中提取函数名"""
        import re

        words = re.findall(r"\b\w+\b", description.lower())
        stop_words = {
            "a",
            "an",
            "the",
            "to",
            "for",
            "of",
            "in",
            "on",
            "at",
            "by",
            "with",
        }
        meaningful_words = [
            word for word in words if word not in stop_words and len(word) > 2
        ]

        if meaningful_words:
            if len(meaningful_words) == 1:
                return meaningful_words[0]
            else:
                return f"{meaningful_words[0]}_{meaningful_words[1]}"

        return "generated_function"

    def _extract_class_name(self, description: str) -> str:
        """从描述中提取类名"""
        function_name = self._extract_function_name(description)
        return "".join(word.capitalize() for word in function_name.split("_"))


class JavaScriptCodeGenerator(BaseLanguageGenerator):
    """JavaScript代码生成器"""

    async def generate(
        self, request: CodeGenerationRequest, template: Optional[CodeTemplate] = None
    ) -> str:
        """生成JavaScript代码"""
        function_name = self._extract_function_name(request.description)

        if "class" in request.description.lower():
            class_name = self._extract_class_name(request.description)
            return f"""class {class_name} {{
  /**
   * {request.description}
   */
  constructor() {{
    // TODO: Initialize class
  }}
  
  process() {{
    // TODO: Implement class logic
  }}
}}
"""
        else:
            return f"""function {function_name}() {{
  /**
   * {request.description}
   */
  // TODO: Implement function logic
}}
"""

    def _extract_function_name(self, description: str) -> str:
        """提取函数名"""
        import re

        words = re.findall(r"\b\w+\b", description.lower())
        stop_words = {"a", "an", "the", "to", "for", "of", "in", "on", "at"}
        meaningful_words = [
            word for word in words if word not in stop_words and len(word) > 2
        ]

        if meaningful_words:
            if len(meaningful_words) == 1:
                return meaningful_words[0]
            else:
                return meaningful_words[0] + "".join(
                    word.capitalize() for word in meaningful_words[1:2]
                )

        return "generatedFunction"

    def _extract_class_name(self, description: str) -> str:
        """提取类名"""
        function_name = self._extract_function_name(description)
        return function_name.capitalize()


class JavaCodeGenerator(BaseLanguageGenerator):
    """Java代码生成器"""

    async def generate(
        self, request: CodeGenerationRequest, template: Optional[CodeTemplate] = None
    ) -> str:
        """生成Java代码"""
        class_name = self._extract_class_name(request.description)

        return f"""public class {class_name} {{
    /**
     * {request.description}
     */
    
    public {class_name}() {{
        // TODO: Initialize class
    }}
    
    public void process() {{
        // TODO: Implement class logic
    }}
    
    public static void main(String[] args) {{
        {class_name} instance = new {class_name}();
        instance.process();
    }}
}}
"""

    def _extract_class_name(self, description: str) -> str:
        """提取类名"""
        import re

        words = re.findall(r"\b\w+\b", description.lower())
        stop_words = {"a", "an", "the", "to", "for", "of", "in", "on", "at"}
        meaningful_words = [
            word for word in words if word not in stop_words and len(word) > 2
        ]

        if meaningful_words:
            return "".join(word.capitalize() for word in meaningful_words[:2])

        return "GeneratedClass"


# ================================
# 语言生成器工厂
# ================================


class LanguageGeneratorFactory:
    """语言生成器工厂"""

    _generators = {
        "python": PythonCodeGenerator,
        "javascript": JavaScriptCodeGenerator,
        "java": JavaCodeGenerator,
    }

    @classmethod
    def create_generator(cls, language: str) -> BaseLanguageGenerator:
        """创建语言生成器"""
        generator_class = cls._generators.get(language.lower())
        if not generator_class:
            raise ValueError(f"Unsupported language: {language}")

        return generator_class()

    @classmethod
    def get_supported_languages(cls) -> List[str]:
        """获取支持的语言列表"""
        return list(cls._generators.keys())

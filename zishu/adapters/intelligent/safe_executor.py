"""
安全代码执行引擎
提供安全、隔离的代码执行环境，支持多种编程语言
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
import subprocess
import signal
import time
import uuid
import psutil
import resource
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
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
import multiprocessing
import weakref
from concurrent.futures import (
    ThreadPoolExecutor,
    ProcessPoolExecutor,
    as_completed,
    TimeoutError,
)

# 安全相关库
try:
    import docker

    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    docker = None

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
from ..security.audit import (
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


class ExecutionEnvironment(Enum):
    """执行环境类型"""

    SANDBOX = "sandbox"  # 沙盒环境（推荐）
    CONTAINER = "container"  # 容器环境
    VIRTUAL_ENV = "virtual_env"  # 虚拟环境
    SUBPROCESS = "subprocess"  # 子进程（最基础）
    RESTRICTED = "restricted"  # 受限环境


class SecurityLevel(Enum):
    """安全级别"""

    STRICT = "strict"  # 严格模式：最高安全级别
    STANDARD = "standard"  # 标准模式：平衡安全与功能
    PERMISSIVE = "permissive"  # 宽松模式：较低安全限制
    DEVELOPMENT = "development"  # 开发模式：仅用于开发测试


class ExecutionStatus(Enum):
    """执行状态"""

    PENDING = "pending"  # 等待执行
    RUNNING = "running"  # 正在执行
    COMPLETED = "completed"  # 执行完成
    FAILED = "failed"  # 执行失败
    TIMEOUT = "timeout"  # 执行超时
    KILLED = "killed"  # 被终止
    ERROR = "error"  # 执行错误


class CodeLanguage(Enum):
    """支持的编程语言"""

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
    BASH = "bash"
    POWERSHELL = "powershell"
    SQL = "sql"


class ResourceType(Enum):
    """资源类型"""

    CPU_TIME = "cpu_time"  # CPU时间
    MEMORY = "memory"  # 内存使用
    DISK_SPACE = "disk_space"  # 磁盘空间
    NETWORK = "network"  # 网络访问
    FILE_SYSTEM = "file_system"  # 文件系统访问
    PROCESS_COUNT = "process_count"  # 进程数量


class ThreatLevel(Enum):
    """威胁级别"""

    SAFE = "safe"  # 安全
    LOW = "low"  # 低风险
    MEDIUM = "medium"  # 中等风险
    HIGH = "high"  # 高风险
    CRITICAL = "critical"  # 严重风险


# ================================
# 核心数据结构
# ================================


@dataclass
class ResourceLimits:
    """资源限制配置"""

    # 时间限制
    max_execution_time: float = 30.0  # 最大执行时间（秒）
    max_cpu_time: float = 20.0  # 最大CPU时间（秒）

    # 内存限制
    max_memory_mb: int = 512  # 最大内存使用（MB）
    max_swap_mb: int = 0  # 最大交换空间（MB）

    # 磁盘限制
    max_disk_mb: int = 100  # 最大磁盘使用（MB）
    max_file_size_mb: int = 10  # 单个文件最大大小（MB）
    max_files_count: int = 50  # 最大文件数量

    # 进程限制
    max_processes: int = 5  # 最大进程数
    max_threads: int = 10  # 最大线程数

    # 网络限制
    allow_network: bool = False  # 是否允许网络访问
    allowed_hosts: List[str] = field(default_factory=list)  # 允许访问的主机

    # 系统调用限制
    blocked_syscalls: List[str] = field(
        default_factory=lambda: ["exec", "fork", "clone", "ptrace", "mount", "unmount"]
    )

    def __post_init__(self):
        """验证配置合理性"""
        if self.max_execution_time <= 0:
            raise ValueError("max_execution_time must be positive")
        if self.max_memory_mb <= 0:
            raise ValueError("max_memory_mb must be positive")


@dataclass
class SecurityConfig:
    """安全配置"""

    security_level: SecurityLevel = SecurityLevel.STANDARD

    # 代码扫描配置
    enable_static_analysis: bool = True
    enable_dynamic_analysis: bool = True
    scan_timeout: float = 10.0

    # 危险模式检测
    dangerous_imports: List[str] = field(
        default_factory=lambda: [
            "os.system",
            "subprocess.call",
            "eval",
            "exec",
            "__import__",
            "open",
            "file",
            "input",
            "raw_input",
        ]
    )

    dangerous_functions: List[str] = field(
        default_factory=lambda: [
            "eval",
            "exec",
            "compile",
            "globals",
            "locals",
            "vars",
            "dir",
            "getattr",
            "setattr",
            "delattr",
            "hasattr",
        ]
    )

    dangerous_keywords: List[str] = field(
        default_factory=lambda: [
            "import os",
            "import sys",
            "import subprocess",
            "import socket",
            "import urllib",
            "import requests",
            "import shutil",
        ]
    )

    # 文件系统限制
    allowed_paths: List[str] = field(default_factory=lambda: ["/tmp", "/var/tmp"])
    blocked_paths: List[str] = field(
        default_factory=lambda: [
            "/etc",
            "/usr",
            "/bin",
            "/sbin",
            "/boot",
            "/root",
            "/home",
        ]
    )

    # 网络限制
    block_network: bool = True
    allowed_domains: List[str] = field(default_factory=list)
    blocked_ports: List[int] = field(default_factory=lambda: [22, 23, 25, 53, 80, 443])


@dataclass
class ExecutionRequest:
    """代码执行请求"""

    # 基础信息
    request_id: str = field(default_factory=lambda: f"exec_{uuid.uuid4().hex[:8]}")
    code: str = ""
    language: CodeLanguage = CodeLanguage.PYTHON

    # 执行配置
    environment: ExecutionEnvironment = ExecutionEnvironment.SANDBOX
    security_level: SecurityLevel = SecurityLevel.STANDARD

    # 资源限制
    resource_limits: ResourceLimits = field(default_factory=ResourceLimits)
    security_config: SecurityConfig = field(default_factory=SecurityConfig)

    # 输入输出
    stdin_data: Optional[str] = None
    capture_stdout: bool = True
    capture_stderr: bool = True

    # 工作目录和文件
    working_directory: Optional[str] = None
    input_files: Dict[str, str] = field(default_factory=dict)  # 文件名 -> 内容

    # 依赖和环境变量
    dependencies: List[str] = field(default_factory=list)
    environment_variables: Dict[str, str] = field(default_factory=dict)

    # 元数据
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ================================
# 核心异常类定义
# ================================


class SafeExecutorError(BaseAdapterException):
    """安全执行器错误基类"""

    def __init__(self, message: str, error_code: ErrorCode = ErrorCode.EXECUTION_ERROR):
        super().__init__(message, error_code, ExceptionSeverity.ERROR)


class SecurityViolationError(SafeExecutorError):
    """安全违规错误"""

    def __init__(self, message: str, violations: List[str] = None):
        super().__init__(message, ErrorCode.SECURITY_ERROR)
        self.violations = violations or []


class ResourceLimitExceededError(SafeExecutorError):
    """资源限制超出错误"""

    def __init__(self, message: str, resource_type: str, limit: Any, actual: Any):
        super().__init__(message, ErrorCode.RESOURCE_ERROR)
        self.resource_type = resource_type
        self.limit = limit
        self.actual = actual


class ExecutionTimeoutError(SafeExecutorError):
    """执行超时错误"""

    def __init__(self, message: str, timeout: float):
        super().__init__(message, ErrorCode.TIMEOUT_ERROR)
        self.timeout = timeout


class UnsupportedLanguageError(SafeExecutorError):
    """不支持的语言错误"""

    def __init__(self, language: str):
        super().__init__(f"Unsupported language: {language}", ErrorCode.INVALID_INPUT)
        self.language = language


class SandboxError(SafeExecutorError):
    """沙盒错误"""

    def __init__(self, message: str):
        super().__init__(message, ErrorCode.ENVIRONMENT_ERROR)


# ================================
# 更多数据结构
# ================================


@dataclass
class SecurityScanResult:
    """安全扫描结果"""

    is_safe: bool = True
    threat_level: ThreatLevel = ThreatLevel.SAFE

    # 检测到的威胁
    threats_detected: List[str] = field(default_factory=list)
    dangerous_imports: List[str] = field(default_factory=list)
    dangerous_functions: List[str] = field(default_factory=list)
    suspicious_patterns: List[str] = field(default_factory=list)

    # 分析详情
    static_analysis_result: Dict[str, Any] = field(default_factory=dict)
    complexity_score: float = 0.0
    risk_score: float = 0.0

    # 建议和警告
    warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    # 扫描元数据
    scan_duration_ms: float = 0.0
    scanned_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ResourceUsage:
    """资源使用统计"""

    # CPU使用
    cpu_time_seconds: float = 0.0
    cpu_percent: float = 0.0

    # 内存使用
    memory_usage_mb: float = 0.0
    peak_memory_mb: float = 0.0

    # 磁盘使用
    disk_read_mb: float = 0.0
    disk_write_mb: float = 0.0
    files_created: int = 0

    # 网络使用
    network_bytes_sent: int = 0
    network_bytes_received: int = 0

    # 进程统计
    processes_created: int = 0
    threads_created: int = 0

    # 系统调用统计
    syscalls_count: Dict[str, int] = field(default_factory=dict)


@dataclass
class ExecutionResult:
    """代码执行结果"""

    # 基础结果
    request_id: str
    status: ExecutionStatus
    success: bool = False

    # 输出结果
    stdout: str = ""
    stderr: str = ""
    return_code: Optional[int] = None

    # 异常信息
    error_message: Optional[str] = None
    exception_type: Optional[str] = None
    traceback: Optional[str] = None

    # 执行统计
    execution_time_seconds: float = 0.0
    resource_usage: ResourceUsage = field(default_factory=ResourceUsage)

    # 安全信息
    security_scan_result: Optional[SecurityScanResult] = None
    security_violations: List[str] = field(default_factory=list)

    # 生成的文件
    output_files: Dict[str, str] = field(default_factory=dict)  # 文件名 -> 内容

    # 元数据
    environment_info: Dict[str, Any] = field(default_factory=dict)
    executed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """代码验证结果"""

    is_valid: bool
    issues: List[str]
    warnings: List[str] = field(default_factory=list)


# ================================
# 安全扫描器
# ================================


class SecurityScanner:
    """安全扫描器 - 检测代码中的安全威胁"""

    def __init__(self, config: SecurityConfig):
        self.config = config
        self.audit_logger = get_audit_logger()

        # 编译正则表达式模式以提高性能
        self._compile_patterns()

    def _compile_patterns(self):
        """编译常用的正则表达式模式"""
        self.dangerous_patterns = {
            "system_calls": re.compile(r"\b(system|popen|exec|eval|compile)\s*\("),
            "file_operations": re.compile(
                r"\b(open|file|read|write|remove|delete)\s*\("
            ),
            "network_operations": re.compile(r"\b(socket|urllib|requests|http)\s*\("),
            "process_operations": re.compile(
                r"\b(subprocess|multiprocessing|threading)\s*\("
            ),
            "import_statements": re.compile(
                r"^\s*(?:from\s+\S+\s+)?import\s+(.+)$", re.MULTILINE
            ),
        }

    @audit_operation(operation="security_scan", component="safe_executor")
    async def scan_code(self, code: str, language: CodeLanguage) -> SecurityScanResult:
        """扫描代码安全性"""
        start_time = time.time()

        try:
            result = SecurityScanResult()

            # 静态分析
            if self.config.enable_static_analysis:
                await self._perform_static_analysis(code, language, result)

            # 动态分析（基于模式匹配）
            if self.config.enable_dynamic_analysis:
                await self._perform_dynamic_analysis(code, language, result)

            # 计算风险评分
            result.risk_score = self._calculate_risk_score(result)
            result.threat_level = self._determine_threat_level(result.risk_score)
            result.is_safe = result.threat_level in [ThreatLevel.SAFE, ThreatLevel.LOW]

            # 记录扫描时间
            result.scan_duration_ms = (time.time() - start_time) * 1000

            logger.info(
                f"Security scan completed: risk_score={result.risk_score:.2f}, "
                f"threat_level={result.threat_level.value}"
            )

            return result

        except Exception as e:
            logger.error(f"Security scan failed: {e}")
            # 返回安全失败结果
            return SecurityScanResult(
                is_safe=False,
                threat_level=ThreatLevel.HIGH,
                threats_detected=[f"Scan failed: {e}"],
                warnings=["Security scan failed - treating as unsafe"],
            )

    async def _perform_static_analysis(
        self, code: str, language: CodeLanguage, result: SecurityScanResult
    ):
        """执行静态分析"""
        try:
            if language == CodeLanguage.PYTHON:
                await self._analyze_python_code(code, result)
            elif language == CodeLanguage.JAVASCRIPT:
                await self._analyze_javascript_code(code, result)
            else:
                await self._analyze_generic_code(code, result)

        except Exception as e:
            result.warnings.append(f"Static analysis failed: {e}")

    async def _analyze_python_code(self, code: str, result: SecurityScanResult):
        """分析Python代码"""
        try:
            # 解析AST
            tree = ast.parse(code)

            # 检查导入
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in self.config.dangerous_imports:
                            result.dangerous_imports.append(alias.name)
                            result.threats_detected.append(
                                f"Dangerous import: {alias.name}"
                            )

                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        module_name = node.module
                        if any(
                            dangerous in module_name
                            for dangerous in self.config.dangerous_imports
                        ):
                            result.dangerous_imports.append(module_name)
                            result.threats_detected.append(
                                f"Dangerous module import: {module_name}"
                            )

                elif isinstance(node, ast.Call):
                    # 检查函数调用
                    if isinstance(node.func, ast.Name):
                        func_name = node.func.id
                        if func_name in self.config.dangerous_functions:
                            result.dangerous_functions.append(func_name)
                            result.threats_detected.append(
                                f"Dangerous function call: {func_name}"
                            )

            # 计算复杂度
            result.complexity_score = self._calculate_complexity(tree)

        except SyntaxError as e:
            result.warnings.append(f"Python syntax error: {e}")
        except Exception as e:
            result.warnings.append(f"Python analysis error: {e}")

    async def _analyze_javascript_code(self, code: str, result: SecurityScanResult):
        """分析JavaScript代码"""
        # 简化的JavaScript分析
        dangerous_js_patterns = [
            "eval(",
            "Function(",
            "setTimeout(",
            "setInterval(",
            "document.write(",
            "innerHTML",
            "outerHTML",
        ]

        for pattern in dangerous_js_patterns:
            if pattern in code:
                result.dangerous_functions.append(pattern)
                result.threats_detected.append(
                    f"Dangerous JavaScript pattern: {pattern}"
                )

    async def _analyze_generic_code(self, code: str, result: SecurityScanResult):
        """分析通用代码"""
        # 使用正则表达式检查危险模式
        for pattern_name, pattern in self.dangerous_patterns.items():
            matches = pattern.findall(code)
            if matches:
                result.suspicious_patterns.extend(matches)
                result.threats_detected.append(f"Suspicious {pattern_name}: {matches}")

    async def _perform_dynamic_analysis(
        self, code: str, language: CodeLanguage, result: SecurityScanResult
    ):
        """执行动态分析（基于模式匹配）"""
        # 检查危险关键词
        for keyword in self.config.dangerous_keywords:
            if keyword.lower() in code.lower():
                result.threats_detected.append(f"Dangerous keyword detected: {keyword}")

        # 检查文件路径访问
        for path in self.config.blocked_paths:
            if path in code:
                result.threats_detected.append(f"Access to blocked path: {path}")

        # 检查网络相关代码
        if self.config.block_network:
            network_indicators = [
                "http://",
                "https://",
                "ftp://",
                "socket",
                "urllib",
                "requests",
            ]
            for indicator in network_indicators:
                if indicator in code.lower():
                    result.threats_detected.append(
                        f"Network access detected: {indicator}"
                    )

    def _calculate_complexity(self, tree: ast.AST) -> float:
        """计算代码复杂度"""
        complexity = 1
        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(node, (ast.And, ast.Or)):
                complexity += 1
        return min(complexity / 10.0, 1.0)  # 归一化到0-1

    def _calculate_risk_score(self, result: SecurityScanResult) -> float:
        """计算风险评分"""
        score = 0.0

        # 威胁数量影响
        score += len(result.threats_detected) * 0.2
        score += len(result.dangerous_imports) * 0.3
        score += len(result.dangerous_functions) * 0.25
        score += len(result.suspicious_patterns) * 0.15

        # 复杂度影响
        score += result.complexity_score * 0.1

        return min(score, 1.0)  # 限制在0-1范围内

    def _determine_threat_level(self, risk_score: float) -> ThreatLevel:
        """根据风险评分确定威胁级别"""
        if risk_score >= 0.8:
            return ThreatLevel.CRITICAL
        elif risk_score >= 0.6:
            return ThreatLevel.HIGH
        elif risk_score >= 0.3:
            return ThreatLevel.MEDIUM
        elif risk_score >= 0.1:
            return ThreatLevel.LOW
        else:
            return ThreatLevel.SAFE


# ================================
# 威胁分析器实现
# ================================


class ThreatAnalyzer:
    """威胁分析器 - 分析代码的安全威胁"""

    def __init__(self):
        # 危险模式列表
        self.dangerous_patterns = {
            # 文件系统操作
            r"os\.system\(": 0.8,
            r"subprocess\.": 0.7,
            r"exec\(": 0.9,
            r"eval\(": 0.9,
            r"__import__\(": 0.6,
            # 网络操作
            r"socket\.": 0.6,
            r"urllib\.": 0.4,
            r"requests\.": 0.3,
            # 文件操作
            r'open\(.*,\s*[\'"]w': 0.5,
            r"os\.remove": 0.6,
            r"shutil\.rmtree": 0.8,
            # 危险关键词
            r"rm\s+-rf": 0.9,
            r"format\s*\(.*\)": 0.3,
            r"\.join\(": 0.2,
        }

        # 高危关键词
        self.critical_keywords = [
            "rm -rf /",
            "format(",
            "mkstemp",
            "tempfile",
            "pickle.loads",
            "marshal.loads",
        ]

    async def analyze(self, request: ExecutionRequest) -> ThreatLevel:
        """分析执行请求的威胁级别"""
        try:
            risk_score = 0.0

            # 分析代码内容
            if request.code:
                risk_score += self._analyze_code(request.code)

            # 分析输入文件
            for content in request.input_files.values():
                risk_score += self._analyze_code(content) * 0.5  # 输入文件风险权重较低

            # 分析环境配置
            risk_score += self._analyze_environment(request)

            # 基于分数返回威胁级别
            return self._calculate_threat_level(risk_score)

        except Exception as e:
            logger.error(f"Threat analysis failed: {e}")
            # 分析失败时返回高威胁级别，安全优先
            return ThreatLevel.HIGH

    def _analyze_code(self, code: str) -> float:
        """分析代码内容的风险"""
        risk_score = 0.0

        # 检查危险模式
        import re

        for pattern, weight in self.dangerous_patterns.items():
            matches = re.findall(pattern, code, re.IGNORECASE)
            risk_score += len(matches) * weight

        # 检查关键词
        for keyword in self.critical_keywords:
            if keyword.lower() in code.lower():
                risk_score += 1.0

        # 检查代码长度（非常长的代码可能有问题）
        if len(code) > 10000:
            risk_score += 0.2

        return min(risk_score, 2.0)  # 限制最大风险分数

    def _analyze_environment(self, request: ExecutionRequest) -> float:
        """分析执行环境的风险"""
        risk_score = 0.0

        # 网络访问增加风险
        if request.network_access:
            risk_score += 0.3

        # 高内存/CPU限制可能表示资源密集型攻击
        if request.memory_limit > 1024 * 1024 * 1024:  # > 1GB
            risk_score += 0.2
        if request.cpu_limit > 2.0:  # > 2 CPU cores
            risk_score += 0.2

        # 长超时时间
        if request.timeout > 300:  # > 5 minutes
            risk_score += 0.2

        return risk_score

    def _calculate_threat_level(self, risk_score: float) -> ThreatLevel:
        """根据风险分数计算威胁级别"""
        if risk_score >= 1.5:
            return ThreatLevel.CRITICAL
        elif risk_score >= 1.0:
            return ThreatLevel.HIGH
        elif risk_score >= 0.5:
            return ThreatLevel.MEDIUM
        elif risk_score >= 0.2:
            return ThreatLevel.LOW
        else:
            return ThreatLevel.SAFE


# ================================
# 代码验证器实现
# ================================


class CodeValidator:
    """代码验证器 - 验证代码的合法性"""

    def __init__(self):
        # 禁止的模块和函数
        self.forbidden_modules = {
            "os",
            "sys",
            "subprocess",
            "shutil",
            "tempfile",
            "pickle",
            "marshal",
            "ctypes",
            "importlib",
        }

        # 禁止的内置函数
        self.forbidden_builtins = {
            "exec",
            "eval",
            "compile",
            "__import__",
            "open",  # 某些情况下
            "input",  # 某些情况下
        }

    async def validate(self, request: ExecutionRequest) -> ValidationResult:
        """验证执行请求"""
        try:
            issues = []

            # 验证代码内容
            if request.code:
                issues.extend(self._validate_code(request.code, request.language))

            # 验证输入文件
            for filename, content in request.input_files.items():
                file_issues = self._validate_file_content(filename, content)
                issues.extend([f"File {filename}: {issue}" for issue in file_issues])

            # 验证执行参数
            issues.extend(self._validate_execution_params(request))

            return ValidationResult(
                is_valid=len(issues) == 0, issues=issues, warnings=[]
            )

        except Exception as e:
            logger.error(f"Code validation failed: {e}")
            return ValidationResult(
                is_valid=False, issues=[f"Validation error: {str(e)}"], warnings=[]
            )

    def _validate_code(self, code: str, language: CodeLanguage) -> List[str]:
        """验证代码内容"""
        issues = []

        if language == CodeLanguage.PYTHON:
            issues.extend(self._validate_python_code(code))
        elif language == CodeLanguage.JAVASCRIPT:
            issues.extend(self._validate_javascript_code(code))
        # 可以添加其他语言的验证

        return issues

    def _validate_python_code(self, code: str) -> List[str]:
        """验证Python代码"""
        issues = []

        try:
            # 尝试解析语法
            import ast

            try:
                tree = ast.parse(code)
            except SyntaxError as e:
                issues.append(f"Syntax error: {e}")
                return issues

            # 检查AST节点
            for node in ast.walk(tree):
                # 检查导入
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in self.forbidden_modules:
                            issues.append(f"Forbidden module import: {alias.name}")

                elif isinstance(node, ast.ImportFrom):
                    if node.module in self.forbidden_modules:
                        issues.append(f"Forbidden module import: {node.module}")

                # 检查函数调用
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if node.func.id in self.forbidden_builtins:
                            issues.append(f"Forbidden builtin function: {node.func.id}")

        except Exception as e:
            issues.append(f"Code analysis error: {e}")

        return issues

    def _validate_javascript_code(self, code: str) -> List[str]:
        """验证JavaScript代码"""
        issues = []

        # 简单的模式检查
        dangerous_patterns = [
            r'require\s*\(\s*[\'"]fs[\'"]',
            r'require\s*\(\s*[\'"]child_process[\'"]',
            r"eval\s*\(",
            r"Function\s*\(",
        ]

        import re

        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                issues.append(f"Potentially dangerous pattern: {pattern}")

        return issues

    def _validate_file_content(self, filename: str, content: str) -> List[str]:
        """验证文件内容"""
        issues = []

        # 检查文件大小
        if len(content.encode("utf-8")) > 10 * 1024 * 1024:  # 10MB
            issues.append("File too large")

        # 检查二进制内容
        try:
            content.encode("utf-8")
        except UnicodeError:
            issues.append("File contains invalid UTF-8 content")

        return issues

    def _validate_execution_params(self, request: ExecutionRequest) -> List[str]:
        """验证执行参数"""
        issues = []

        # 检查超时时间
        if request.timeout > 600:  # 10 minutes
            issues.append("Timeout too long (max 10 minutes)")

        # 检查内存限制
        if request.memory_limit > 2 * 1024 * 1024 * 1024:  # 2GB
            issues.append("Memory limit too high (max 2GB)")

        # 检查CPU限制
        if request.cpu_limit > 4.0:  # 4 cores
            issues.append("CPU limit too high (max 4 cores)")

        return issues


# ================================
# 沙盒环境管理器
# ================================


class SandboxManager:
    """沙盒环境管理器 - 创建和管理隔离的执行环境"""

    def __init__(self, base_path: Union[str, Path]):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

        self.active_sandboxes: Dict[str, "Sandbox"] = {}
        self.audit_logger = get_audit_logger()

        # 检查Docker可用性
        self.docker_available = DOCKER_AVAILABLE and self._check_docker()

        logger.info(
            f"Sandbox manager initialized. Docker available: {self.docker_available}"
        )

    def _check_docker(self) -> bool:
        """检查Docker是否可用"""
        try:
            if docker:
                client = docker.from_env()
                client.ping()
                return True
        except Exception as e:
            logger.warning(f"Docker not available: {e}")
        return False

    @audit_operation(operation="create_sandbox", component="safe_executor")
    async def create_sandbox(self, request: ExecutionRequest) -> "Sandbox":
        """创建沙盒环境"""
        try:
            sandbox_id = f"sandbox_{request.request_id}"
            sandbox_path = self.base_path / sandbox_id

            # 选择沙盒实现
            if (
                request.environment == ExecutionEnvironment.CONTAINER
                and self.docker_available
            ):
                sandbox = DockerSandbox(sandbox_id, sandbox_path, request)
            else:
                sandbox = ProcessSandbox(sandbox_id, sandbox_path, request)

            # 初始化沙盒
            await sandbox.initialize()

            self.active_sandboxes[sandbox_id] = sandbox
            logger.info(f"Created sandbox: {sandbox_id}")

            return sandbox

        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise SandboxError(f"Sandbox creation failed: {e}")

    async def cleanup_sandbox(self, sandbox_id: str):
        """清理沙盒环境"""
        try:
            if sandbox_id in self.active_sandboxes:
                sandbox = self.active_sandboxes[sandbox_id]
                await sandbox.cleanup()
                del self.active_sandboxes[sandbox_id]
                logger.info(f"Cleaned up sandbox: {sandbox_id}")
        except Exception as e:
            logger.error(f"Failed to cleanup sandbox {sandbox_id}: {e}")

    async def cleanup_all(self):
        """清理所有沙盒环境"""
        for sandbox_id in list(self.active_sandboxes.keys()):
            await self.cleanup_sandbox(sandbox_id)


# ================================
# 沙盒实现基类
# ================================


class Sandbox(ABC):
    """沙盒基类"""

    def __init__(self, sandbox_id: str, sandbox_path: Path, request: ExecutionRequest):
        self.sandbox_id = sandbox_id
        self.sandbox_path = sandbox_path
        self.request = request
        self.audit_logger = get_audit_logger()

        self.is_initialized = False
        self.is_running = False
        self.process = None
        self.start_time = None

    @abstractmethod
    async def initialize(self):
        """初始化沙盒环境"""
        pass

    @abstractmethod
    async def execute(self) -> ExecutionResult:
        """在沙盒中执行代码"""
        pass

    @abstractmethod
    async def cleanup(self):
        """清理沙盒环境"""
        pass

    def _prepare_working_directory(self):
        """准备工作目录"""
        try:
            # 创建工作目录
            self.sandbox_path.mkdir(parents=True, exist_ok=True)

            # 写入输入文件
            for filename, content in self.request.input_files.items():
                file_path = self.sandbox_path / filename
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

            # 创建主代码文件
            if self.request.code:
                code_file = self.sandbox_path / self._get_code_filename()
                with open(code_file, "w", encoding="utf-8") as f:
                    f.write(self.request.code)

        except Exception as e:
            raise SandboxError(f"Failed to prepare working directory: {e}")

    def _get_code_filename(self) -> str:
        """获取代码文件名"""
        extensions = {
            CodeLanguage.PYTHON: "main.py",
            CodeLanguage.JAVASCRIPT: "main.js",
            CodeLanguage.TYPESCRIPT: "main.ts",
            CodeLanguage.JAVA: "Main.java",
            CodeLanguage.CPP: "main.cpp",
            CodeLanguage.GO: "main.go",
            CodeLanguage.RUST: "main.rs",
            CodeLanguage.PHP: "main.php",
            CodeLanguage.RUBY: "main.rb",
            CodeLanguage.BASH: "main.sh",
        }
        return extensions.get(self.request.language, "main.txt")

    def _get_execution_command(self) -> List[str]:
        """获取执行命令"""
        commands = {
            CodeLanguage.PYTHON: ["python3", "main.py"],
            CodeLanguage.JAVASCRIPT: ["node", "main.js"],
            CodeLanguage.JAVA: ["javac", "Main.java", "&&", "java", "Main"],
            CodeLanguage.CPP: ["g++", "-o", "main", "main.cpp", "&&", "./main"],
            CodeLanguage.GO: ["go", "run", "main.go"],
            CodeLanguage.RUST: ["rustc", "main.rs", "&&", "./main"],
            CodeLanguage.PHP: ["php", "main.php"],
            CodeLanguage.RUBY: ["ruby", "main.rb"],
            CodeLanguage.BASH: ["bash", "main.sh"],
        }
        return commands.get(self.request.language, ["cat", "main.txt"])


# ================================
# 进程沙盒实现
# ================================


class ProcessSandbox(Sandbox):
    """基于进程的沙盒实现"""

    async def initialize(self):
        """初始化进程沙盒"""
        try:
            self._prepare_working_directory()
            self.is_initialized = True
            logger.debug(f"Process sandbox {self.sandbox_id} initialized")
        except Exception as e:
            raise SandboxError(f"Process sandbox initialization failed: {e}")

    async def execute(self) -> ExecutionResult:
        """在进程沙盒中执行代码"""
        if not self.is_initialized:
            raise SandboxError("Sandbox not initialized")

        start_time = time.time()
        self.start_time = start_time

        try:
            # 构建执行命令
            cmd = self._get_execution_command()

            # 设置环境变量
            env = os.environ.copy()
            env.update(self.request.environment_vars)

            # 创建进程
            self.process = await asyncio.create_subprocess_shell(
                " ".join(cmd),
                cwd=str(self.sandbox_path),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE,
            )

            self.is_running = True

            try:
                # 提供输入数据
                stdin_data = None
                if self.request.stdin:
                    stdin_data = self.request.stdin.encode("utf-8")

                # 等待执行完成或超时
                stdout, stderr = await asyncio.wait_for(
                    self.process.communicate(input=stdin_data),
                    timeout=self.request.timeout,
                )

                execution_time = time.time() - start_time

                # 解码输出
                stdout_str = stdout.decode("utf-8", errors="replace")
                stderr_str = stderr.decode("utf-8", errors="replace")

                # 读取输出文件
                output_files = {}
                for pattern in self.request.output_patterns:
                    for file_path in self.sandbox_path.glob(pattern):
                        if file_path.is_file():
                            try:
                                with open(file_path, "r", encoding="utf-8") as f:
                                    output_files[file_path.name] = f.read()
                            except Exception as e:
                                logger.warning(
                                    f"Failed to read output file {file_path}: {e}"
                                )

                return ExecutionResult(
                    request_id=self.request.request_id,
                    success=self.process.returncode == 0,
                    exit_code=self.process.returncode,
                    stdout=stdout_str,
                    stderr=stderr_str,
                    execution_time=execution_time,
                    memory_usage=0,  # 进程沙盒无法准确测量内存使用
                    output_files=output_files,
                    sandbox_logs=[],
                )

            except asyncio.TimeoutError:
                # 超时终止进程
                if self.process:
                    self.process.terminate()
                    try:
                        await asyncio.wait_for(self.process.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        self.process.kill()
                        await self.process.wait()

                execution_time = time.time() - start_time

                return ExecutionResult(
                    request_id=self.request.request_id,
                    success=False,
                    exit_code=-1,
                    stdout="",
                    stderr=f"Execution timed out after {self.request.timeout} seconds",
                    execution_time=execution_time,
                    memory_usage=0,
                    output_files={},
                    sandbox_logs=["Execution timed out"],
                )

        except Exception as e:
            execution_time = time.time() - start_time
            return ExecutionResult(
                request_id=self.request.request_id,
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Execution failed: {str(e)}",
                execution_time=execution_time,
                memory_usage=0,
                output_files={},
                sandbox_logs=[f"Execution error: {str(e)}"],
            )
        finally:
            self.is_running = False

    async def cleanup(self):
        """清理进程沙盒"""
        try:
            # 终止进程
            if self.process and self.is_running:
                self.process.terminate()
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    self.process.kill()
                    await self.process.wait()

            # 清理工作目录
            if self.sandbox_path.exists():
                import shutil

                shutil.rmtree(str(self.sandbox_path), ignore_errors=True)

            logger.debug(f"Process sandbox {self.sandbox_id} cleaned up")

        except Exception as e:
            logger.error(f"Failed to cleanup process sandbox {self.sandbox_id}: {e}")


# ================================
# Docker沙盒实现
# ================================


class DockerSandbox(Sandbox):
    """基于Docker的沙盒实现"""

    def __init__(self, sandbox_id: str, sandbox_path: Path, request: ExecutionRequest):
        super().__init__(sandbox_id, sandbox_path, request)
        self.container = None
        self.client = None

    async def initialize(self):
        """初始化Docker沙盒"""
        if not DOCKER_AVAILABLE or not docker:
            raise SandboxError("Docker not available")

        try:
            self.client = docker.from_env()
            self._prepare_working_directory()

            # 选择合适的Docker镜像
            image = self._get_docker_image()

            # 创建容器
            self.container = self.client.containers.create(
                image=image,
                command="sleep 3600",  # 保持容器运行
                working_dir="/workspace",
                volumes={str(self.sandbox_path): {"bind": "/workspace", "mode": "rw"}},
                environment=self.request.environment_vars,
                network_disabled=not self.request.network_access,
                mem_limit=self.request.memory_limit,
                cpu_quota=int(self.request.cpu_limit * 100000)
                if self.request.cpu_limit
                else None,
                detach=True,
                remove=True,
                security_opt=["no-new-privileges:true"],
                cap_drop=["ALL"],
                cap_add=["CHOWN", "DAC_OVERRIDE", "SETGID", "SETUID"],
            )

            self.container.start()
            self.is_initialized = True
            logger.debug(f"Docker sandbox {self.sandbox_id} initialized")

        except Exception as e:
            raise SandboxError(f"Docker sandbox initialization failed: {e}")

    def _get_docker_image(self) -> str:
        """获取适合的Docker镜像"""
        images = {
            CodeLanguage.PYTHON: "python:3.11-slim",
            CodeLanguage.JAVASCRIPT: "node:18-slim",
            CodeLanguage.TYPESCRIPT: "node:18-slim",
            CodeLanguage.JAVA: "openjdk:17-slim",
            CodeLanguage.CPP: "gcc:latest",
            CodeLanguage.GO: "golang:1.20-slim",
            CodeLanguage.RUST: "rust:1.70-slim",
            CodeLanguage.PHP: "php:8.1-cli-slim",
            CodeLanguage.RUBY: "ruby:3.0-slim",
            CodeLanguage.BASH: "ubuntu:22.04",
        }
        return images.get(self.request.language, "ubuntu:22.04")

    async def execute(self) -> ExecutionResult:
        """在Docker沙盒中执行代码"""
        if not self.is_initialized:
            raise SandboxError("Sandbox not initialized")

        start_time = time.time()
        self.start_time = start_time

        try:
            # 构建执行命令
            cmd = self._get_execution_command()

            # 在容器中执行命令
            exec_result = self.container.exec_run(
                cmd=" ".join(cmd),
                workdir="/workspace",
                stdout=True,
                stderr=True,
                stdin=True,
                tty=False,
                stream=False,
                demux=True,
            )

            execution_time = time.time() - start_time

            # 解码输出
            stdout_bytes, stderr_bytes = exec_result.output
            stdout_str = (
                stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            )
            stderr_str = (
                stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            )

            # 读取输出文件
            output_files = {}
            for pattern in self.request.output_patterns:
                for file_path in self.sandbox_path.glob(pattern):
                    if file_path.is_file():
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                output_files[file_path.name] = f.read()
                        except Exception as e:
                            logger.warning(
                                f"Failed to read output file {file_path}: {e}"
                            )

            # 获取容器统计信息
            stats = self.container.stats(stream=False)
            memory_usage = stats.get("memory", {}).get("usage", 0)

            return ExecutionResult(
                request_id=self.request.request_id,
                success=exec_result.exit_code == 0,
                exit_code=exec_result.exit_code,
                stdout=stdout_str,
                stderr=stderr_str,
                execution_time=execution_time,
                memory_usage=memory_usage,
                output_files=output_files,
                sandbox_logs=[],
            )

        except Exception as e:
            execution_time = time.time() - start_time
            return ExecutionResult(
                request_id=self.request.request_id,
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Execution failed: {str(e)}",
                execution_time=execution_time,
                memory_usage=0,
                output_files={},
                sandbox_logs=[f"Execution error: {str(e)}"],
            )
        finally:
            self.is_running = False

    async def cleanup(self):
        """清理Docker沙盒"""
        try:
            if self.container:
                self.container.stop()
                self.container.remove()

            # 清理工作目录
            if self.sandbox_path.exists():
                import shutil

                shutil.rmtree(str(self.sandbox_path), ignore_errors=True)

            logger.debug(f"Docker sandbox {self.sandbox_id} cleaned up")

        except Exception as e:
            logger.error(f"Failed to cleanup Docker sandbox {self.sandbox_id}: {e}")


# ================================
# 主要的安全代码执行器
# ================================


class SafeCodeExecutor:
    """安全代码执行器 - 主要的执行接口"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

        # 初始化组件
        self.threat_analyzer = ThreatAnalyzer()
        self.code_validator = CodeValidator()
        self.sandbox_manager = SandboxManager(
            base_path=self.config.get("sandbox_base_path", "/tmp/zishu_sandboxes")
        )

        # 审计日志
        self.audit_logger = get_audit_logger()

        logger.info("Safe code executor initialized")

    @audit_operation(operation="execute_code", component="safe_executor")
    async def execute_code(self, request: ExecutionRequest) -> ExecutionResult:
        """安全执行代码的主要接口"""
        try:
            # 1. 威胁分析
            threat_level = await self.threat_analyzer.analyze(request)

            if threat_level == ThreatLevel.CRITICAL:
                return ExecutionResult(
                    request_id=request.request_id,
                    success=False,
                    exit_code=-1,
                    stdout="",
                    stderr="Code execution blocked due to critical security threat",
                    execution_time=0,
                    memory_usage=0,
                    output_files={},
                    sandbox_logs=["Execution blocked - critical threat detected"],
                )

            # 2. 代码验证
            validation_result = await self.code_validator.validate(request)

            if not validation_result.is_valid:
                return ExecutionResult(
                    request_id=request.request_id,
                    success=False,
                    exit_code=-1,
                    stdout="",
                    stderr=f"Code validation failed: {'; '.join(validation_result.issues)}",
                    execution_time=0,
                    memory_usage=0,
                    output_files={},
                    sandbox_logs=[f"Validation failed: {validation_result.issues}"],
                )

            # 3. 创建沙盒环境
            sandbox = await self.sandbox_manager.create_sandbox(request)

            try:
                # 4. 在沙盒中执行代码
                result = await sandbox.execute()

                # 5. 记录审计日志
                self.audit_logger.info(
                    f"Code execution completed",
                    extra={
                        "request_id": request.request_id,
                        "language": request.language.value,
                        "success": result.success,
                        "execution_time": result.execution_time,
                        "threat_level": threat_level.value,
                        "validation_issues": len(validation_result.issues),
                    },
                )

                return result

            finally:
                # 6. 清理沙盒
                await self.sandbox_manager.cleanup_sandbox(sandbox.sandbox_id)

        except Exception as e:
            logger.error(f"Code execution failed: {e}")
            return ExecutionResult(
                request_id=request.request_id,
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Internal execution error: {str(e)}",
                execution_time=0,
                memory_usage=0,
                output_files={},
                sandbox_logs=[f"Internal error: {str(e)}"],
            )

    async def batch_execute(
        self, requests: List[ExecutionRequest]
    ) -> List[ExecutionResult]:
        """批量执行代码"""
        results = []

        # 并发执行（但限制并发数）
        semaphore = asyncio.Semaphore(self.config.get("max_concurrent_executions", 5))

        async def execute_with_semaphore(req):
            async with semaphore:
                return await self.execute_code(req)

        tasks = [execute_with_semaphore(req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                results[i] = ExecutionResult(
                    request_id=requests[i].request_id,
                    success=False,
                    exit_code=-1,
                    stdout="",
                    stderr=f"Batch execution error: {str(result)}",
                    execution_time=0,
                    memory_usage=0,
                    output_files={},
                    sandbox_logs=[f"Batch error: {str(result)}"],
                )

        return results

    async def cleanup(self):
        """清理所有资源"""
        await self.sandbox_manager.cleanup_all()
        logger.info("Safe code executor cleaned up")


# ================================
# 工厂函数
# ================================


def create_safe_executor(config: Optional[Dict[str, Any]] = None) -> SafeCodeExecutor:
    """创建安全代码执行器实例"""
    return SafeCodeExecutor(config)


# ================================
# 导出的主要接口
# ================================

__all__ = [
    # 主要类
    "SafeCodeExecutor",
    # 数据类型
    "ExecutionRequest",
    "ExecutionResult",
    "ValidationResult",
    # 枚举
    "CodeLanguage",
    "ExecutionEnvironment",
    "ThreatLevel",
    # 异常
    "SafeExecutorError",
    "SandboxError",
    "ValidationError",
    "ThreatAnalysisError",
    # 工厂函数
    "create_safe_executor",
]

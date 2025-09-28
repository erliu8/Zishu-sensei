"""
Zishu-sensei 沙箱执行环境
提供安全、隔离的代码执行环境，支持资源限制、权限控制和安全监控
"""

import os
import sys
import time
import signal
import psutil
import tempfile
import threading
import subprocess
import multiprocessing
import resource as system_resource
from abc import ABC, abstractmethod
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Union, Tuple
import ast
import json
import uuid
import asyncio
import logging

# 第三方库
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    docker = None

# 本地导入
from .permissions import Permission, Role, PermissionManager, AccessResult
from .audit import (
    AuditLogger, AuditEvent, AuditEventType, AuditLevel, AuditSeverity,
    get_audit_logger, audit_operation
)

# 配置日志
logger = logging.getLogger(__name__)


class SandboxMode(Enum):
    """沙箱执行模式"""
    STRICT = "strict"           # 严格模式：最高安全级别
    RESTRICTED = "restricted"   # 受限模式：平衡安全和功能
    PERMISSIVE = "permissive"   # 宽松模式：较少限制
    DEVELOPMENT = "development" # 开发模式：用于调试


class ExecutionType(Enum):
    """执行类型"""
    PYTHON = "python"           # Python代码执行
    SHELL = "shell"             # Shell命令执行
    SUBPROCESS = "subprocess"   # 子进程执行
    FUNCTION = "function"       # 函数调用执行


class ResourceType(Enum):
    """资源类型"""
    CPU_TIME = "cpu_time"
    MEMORY = "memory"
    DISK_IO = "disk_io"
    NETWORK_IO = "network_io"
    FILE_DESCRIPTORS = "file_descriptors"
    PROCESSES = "processes"


class SecurityViolationType(Enum):
    """安全违规类型"""
    FORBIDDEN_IMPORT = "forbidden_import"
    FORBIDDEN_BUILTIN = "forbidden_builtin"
    FORBIDDEN_ATTRIBUTE = "forbidden_attribute"
    RESOURCE_EXCEEDED = "resource_exceeded"
    TIMEOUT = "timeout"
    FILE_ACCESS_DENIED = "file_access_denied"
    NETWORK_ACCESS_DENIED = "network_access_denied"
    SYSTEM_CALL_DENIED = "system_call_denied"


@dataclass
class ResourceLimits:
    """资源限制配置"""
    # 时间限制
    max_execution_time: float = 30.0
    max_cpu_time: float = 10.0
    
    # 内存限制
    max_memory: int = 128 * 1024 * 1024
    max_stack_size: int = 8 * 1024 * 1024
    
    # IO限制
    max_file_size: int = 10 * 1024 * 1024
    max_total_file_size: int = 50 * 1024 * 1024
    max_open_files: int = 20
    
    # 网络限制
    allow_network: bool = False
    allowed_hosts: Set[str] = field(default_factory=set)
    
    # 进程限制
    max_processes: int = 5
    max_threads: int = 10
    
    # 自定义限制
    custom_limits: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SandboxConfig:
    """沙箱配置"""
    mode: SandboxMode = SandboxMode.RESTRICTED
    execution_type: ExecutionType = ExecutionType.PYTHON
    resource_limits: ResourceLimits = field(default_factory=ResourceLimits)
    
    # 安全设置
    enable_static_analysis: bool = True
    enable_runtime_monitoring: bool = True
    enable_audit_logging: bool = True
    
    # 允许和禁止的操作
    allowed_imports: Set[str] = field(default_factory=lambda: {
        'json', 'math', 'random', 'datetime', 'collections', 'itertools',
        'functools', 'operator', 'string', 're', 'uuid', 'hashlib', 'base64'
    })
    
    forbidden_imports: Set[str] = field(default_factory=lambda: {
        'os', 'sys', 'subprocess', 'importlib', 'exec', 'eval', 'compile',
        'open', '__import__', 'globals', 'locals', 'vars', 'dir',
        'getattr', 'setattr', 'delattr', 'hasattr'
    })
    
    allowed_builtins: Set[str] = field(default_factory=lambda: {
        'abs', 'all', 'any', 'bin', 'bool', 'chr', 'dict', 'enumerate',
        'filter', 'float', 'format', 'int', 'isinstance', 'len', 'list',
        'map', 'max', 'min', 'ord', 'range', 'reversed', 'round', 'set',
        'sorted', 'str', 'sum', 'tuple', 'type', 'zip'
    })
    
    # 文件系统权限
    allowed_read_paths: Set[str] = field(default_factory=set)
    allowed_write_paths: Set[str] = field(default_factory=set)
    temp_dir_access: bool = True
    
    # 容器设置（可选）
    use_container: bool = False
    container_image: str = "python:3.9-alpine"
    container_memory_limit: str = "128m"
    container_cpu_limit: str = "0.5"


@dataclass
class ExecutionContext:
    """执行上下文"""
    execution_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    # 执行环境
    working_directory: Optional[str] = None
    environment_variables: Dict[str, str] = field(default_factory=dict)
    
    # 输入输出
    stdin_data: Optional[str] = None
    capture_output: bool = True
    capture_errors: bool = True
    
    # 权限上下文
    permissions: Set[Permission] = field(default_factory=set)
    roles: Set[Role] = field(default_factory=set)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ExecutionResult:
    """执行结果"""
    execution_id: str
    success: bool
    
    # 输出结果
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    return_value: Any = None
    
    # 执行统计
    execution_time: float = 0.0
    cpu_time: float = 0.0
    memory_peak: int = 0
    
    # 资源使用情况
    resource_usage: Dict[ResourceType, Any] = field(default_factory=dict)
    
    # 安全信息
    security_violations: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # 错误信息
    error: Optional[str] = None
    error_type: Optional[str] = None
    traceback: Optional[str] = None
    
    # 审计信息
    audit_events: List[str] = field(default_factory=list)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    completed_at: datetime = field(default_factory=datetime.now)


class SecurityViolation(Exception):
    """安全违规异常"""
    
    def __init__(self, violation_type: SecurityViolationType, 
                 message: str, details: Dict[str, Any] = None):
        self.violation_type = violation_type
        self.details = details or {}
        super().__init__(message)


class SandboxException(Exception):
    """沙箱异常基类"""
    pass


class ResourceExceededException(SandboxException):
    """资源超限异常"""
    def __init__(self, resource_type: ResourceType, limit: Any, actual: Any):
        self.resource_type = resource_type
        self.limit = limit
        self.actual = actual
        super().__init__(f"{resource_type.value} exceeded: {actual} > {limit}")


class CodeAnalyzer:
    """代码安全分析器"""
    
    def __init__(self, config: SandboxConfig):
        self.config = config
        self._dangerous_patterns = {
            'imports': self.config.forbidden_imports,
            'builtins': self.config.forbidden_imports,
            'attributes': {'__', 'eval', 'exec', 'compile'}
        }
    
    def analyze_python_code(self, code: str) -> List[Dict[str, Any]]:
        """分析Python代码安全性"""
        violations = []
        
        try:
            tree = ast.parse(code)
            violations.extend(self._check_imports(tree))
            violations.extend(self._check_function_calls(tree))
            violations.extend(self._check_attribute_access(tree))
            violations.extend(self._check_dangerous_constructs(tree))
        except SyntaxError as e:
            violations.append({
                'type': 'syntax_error',
                'message': f'Syntax error: {str(e)}',
                'line': e.lineno,
                'details': {'error': str(e)}
            })
        
        return violations
    
    def _check_imports(self, tree: ast.AST) -> List[Dict[str, Any]]:
        """检查导入语句"""
        violations = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in self.config.forbidden_imports:
                        violations.append({
                            'type': SecurityViolationType.FORBIDDEN_IMPORT.value,
                            'message': f'Forbidden import: {alias.name}',
                            'line': node.lineno,
                            'details': {'module': alias.name}
                        })
            
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module in self.config.forbidden_imports:
                    violations.append({
                        'type': SecurityViolationType.FORBIDDEN_IMPORT.value,
                        'message': f'Forbidden import from: {node.module}',
                        'line': node.lineno,
                        'details': {'module': node.module}
                    })
        
        return violations
    
    def _check_function_calls(self, tree: ast.AST) -> List[Dict[str, Any]]:
        """检查函数调用"""
        violations = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func_name = self._get_function_name(node.func)
                if func_name and func_name in self.config.forbidden_imports:
                    violations.append({
                        'type': SecurityViolationType.FORBIDDEN_BUILTIN.value,
                        'message': f'Forbidden function call: {func_name}',
                        'line': node.lineno,
                        'details': {'function': func_name}
                    })
        
        return violations
    
    def _check_attribute_access(self, tree: ast.AST) -> List[Dict[str, Any]]:
        """检查属性访问"""
        violations = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute):
                if node.attr.startswith('__'):
                    violations.append({
                        'type': SecurityViolationType.FORBIDDEN_ATTRIBUTE.value,
                        'message': f'Forbidden attribute access: {node.attr}',
                        'line': node.lineno,
                        'details': {'attribute': node.attr}
                    })
        
        return violations
    
    def _check_dangerous_constructs(self, tree: ast.AST) -> List[Dict[str, Any]]:
        """检查危险的语言构造"""
        violations = []
        
        for node in ast.walk(tree):
            # 检查exec、eval等
            if isinstance(node, ast.Call):
                func_name = self._get_function_name(node.func)
                if func_name in ['exec', 'eval', 'compile']:
                    violations.append({
                        'type': SecurityViolationType.FORBIDDEN_BUILTIN.value,
                        'message': f'Dangerous construct: {func_name}',
                        'line': node.lineno,
                        'details': {'construct': func_name}
                    })
        
        return violations
    
    def _get_function_name(self, node: ast.AST) -> Optional[str]:
        """获取函数名"""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return node.attr
        return None


class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self, limits: ResourceLimits):
        self.limits = limits
        self.start_time: Optional[float] = None
        self.process: Optional[psutil.Process] = None
        self._monitoring = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._usage_data = defaultdict(list)
    
    def start_monitoring(self, process: psutil.Process):
        """开始监控进程资源使用"""
        self.process = process
        self.start_time = time.time()
        self._monitoring = True
        
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
    
    def stop_monitoring(self) -> Dict[ResourceType, Any]:
        """停止监控并返回使用统计"""
        self._monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=1.0)
        
        return self._get_usage_summary()
    
    def _monitor_loop(self):
        """监控循环"""
        while self._monitoring and self.process and self.process.is_running():
            try:
                # 检查执行时间
                if self.start_time and (time.time() - self.start_time > self.limits.max_execution_time):
                    raise ResourceExceededException(
                        ResourceType.CPU_TIME, 
                        self.limits.max_execution_time,
                        time.time() - self.start_time
                    )
                
                # 检查内存使用
                memory_info = self.process.memory_info()
                if memory_info.rss > self.limits.max_memory:
                    raise ResourceExceededException(
                        ResourceType.MEMORY,
                        self.limits.max_memory,
                        memory_info.rss
                    )
                
                # 记录使用数据
                self._usage_data[ResourceType.MEMORY].append(memory_info.rss)
                self._usage_data[ResourceType.CPU_TIME].append(self.process.cpu_times().user)
                
                # 检查文件描述符
                try:
                    num_fds = self.process.num_fds() if hasattr(self.process, 'num_fds') else len(self.process.open_files())
                    if num_fds > self.limits.max_open_files:
                        raise ResourceExceededException(
                            ResourceType.FILE_DESCRIPTORS,
                            self.limits.max_open_files,
                            num_fds
                        )
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    pass
                
                time.sleep(0.1)  # 监控间隔
                
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
            except ResourceExceededException:
                self._monitoring = False
                if self.process.is_running():
                    self.process.terminate()
                raise
    
    def _get_usage_summary(self) -> Dict[ResourceType, Any]:
        """获取资源使用摘要"""
        summary = {}
        
        if self.start_time:
            summary[ResourceType.CPU_TIME] = time.time() - self.start_time
        
        for resource_type, values in self._usage_data.items():
            if values:
                if resource_type == ResourceType.MEMORY:
                    summary[resource_type] = {
                        'peak': max(values),
                        'average': sum(values) / len(values),
                        'samples': len(values)
                    }
                else:
                    summary[resource_type] = {
                        'total': values[-1] if values else 0,
                        'samples': len(values)
                    }
        
        return summary


class SecureBuiltins:
    """安全的内置函数环境"""
    
    def __init__(self, config: SandboxConfig):
        self.config = config
        self._safe_builtins = self._create_safe_builtins()
    
    def _create_safe_builtins(self) -> Dict[str, Any]:
        """创建安全的内置函数字典"""
        safe_builtins = {}
        
        # 添加允许的内置函数
        for name in self.config.allowed_builtins:
            if hasattr(__builtins__, name):
                safe_builtins[name] = getattr(__builtins__, name)
        
        # 添加安全的内置常量
        safe_builtins.update({
            'True': True,
            'False': False,
            'None': None,
            '__name__': '__sandbox__',
            '__doc__': 'Sandbox execution environment'
        })
        
        return safe_builtins
    
    def get_safe_globals(self) -> Dict[str, Any]:
        """获取安全的全局命名空间"""
        return {
            '__builtins__': self._safe_builtins,
            '__name__': '__sandbox__',
            '__file__': '<sandbox>',
            '__cached__': None,
            '__doc__': None,
        }


class SandboxExecutor(ABC):
    """沙箱执行器基类"""
    
    def __init__(self, config: SandboxConfig):
        self.config = config
        self.permission_manager = PermissionManager()
        self.audit_logger = get_audit_logger()
    
    @abstractmethod
    async def execute(self, code: str, context: ExecutionContext) -> ExecutionResult:
        """执行代码"""
        pass
    
    def _check_permissions(self, context: ExecutionContext) -> bool:
        """检查权限"""
        try:
            from ..security import SecurityContext, SecurityLevel
            security_context = SecurityContext(
                user_id=context.user_id or "anonymous",
                session_id=context.session_id or str(uuid.uuid4()),
                permissions=list(context.permissions),
                security_level=SecurityLevel.MEDIUM,
                ip_address="127.0.0.1"
            )
            
            result = self.permission_manager.check_permission(
                security_context, "sandbox/execute", "execute"
            )
            return result.granted
        except ImportError:
            logger.warning("Security context not available, skipping permission check")
            return True
    
    async def _log_execution_event(self, event_type: AuditEventType, 
                                  message: str, context: ExecutionContext,
                                  **kwargs):
        """记录执行事件"""
        if self.audit_logger and self.config.enable_audit_logging:
            await self.audit_logger.log_event(
                event_type,
                message,
                user_id=context.user_id,
                session_id=context.session_id,
                component="sandbox",
                **kwargs
            )


class PythonSandboxExecutor(SandboxExecutor):
    """Python沙箱执行器"""
    
    def __init__(self, config: SandboxConfig):
        super().__init__(config)
        self.code_analyzer = CodeAnalyzer(config)
        self.secure_builtins = SecureBuiltins(config)
    
    async def execute(self, code: str, context: ExecutionContext) -> ExecutionResult:
        """执行Python代码"""
        execution_id = context.execution_id
        start_time = time.time()
        
        # 创建执行结果
        result = ExecutionResult(
            execution_id=execution_id,
            success=False
        )
        
        try:
            # 权限检查
            if not self._check_permissions(context):
                raise SecurityViolation(
                    SecurityViolationType.SYSTEM_CALL_DENIED,
                    "Permission denied for code execution"
                )
            
            # 静态代码分析
            if self.config.enable_static_analysis:
                violations = self.code_analyzer.analyze_python_code(code)
                if violations:
                    result.security_violations = violations
                    raise SecurityViolation(
                        SecurityViolationType.FORBIDDEN_IMPORT,
                        f"Code analysis failed: {len(violations)} violations found"
                    )
            
            # 记录执行开始事件
            await self._log_execution_event(
                AuditEventType.ADAPTER_EXECUTE,
                f"Starting Python code execution",
                context,
                details={'code_length': len(code)}
            )
            
            # 执行代码
            if self.config.mode == SandboxMode.STRICT:
                execution_result = await self._execute_in_process(code, context)
            else:
                execution_result = await self._execute_with_restrictions(code, context)
            
            # 更新结果
            result.success = execution_result['success']
            result.return_value = execution_result.get('return_value')
            result.stdout = execution_result.get('stdout')
            result.stderr = execution_result.get('stderr')
            result.resource_usage = execution_result.get('resource_usage', {})
            
            if execution_result.get('error'):
                result.error = execution_result['error']
                result.error_type = execution_result.get('error_type')
                result.traceback = execution_result.get('traceback')
            
        except SecurityViolation as e:
            result.error = str(e)
            result.error_type = e.violation_type.value
            result.security_violations.append({
                'type': e.violation_type.value,
                'message': str(e),
                'details': e.details
            })
            
            await self._log_execution_event(
                AuditEventType.SECURITY_VIOLATION,
                f"Security violation during execution: {str(e)}",
                context,
                severity=AuditSeverity.HIGH
            )
        
        except Exception as e:
            result.error = str(e)
            result.error_type = type(e).__name__
            result.traceback = traceback.format_exc()
            logger.error(f"Execution error: {e}", exc_info=True)
        
        finally:
            result.execution_time = time.time() - start_time
            result.completed_at = datetime.now()
            
            # 记录执行完成事件
            await self._log_execution_event(
                AuditEventType.ADAPTER_EXECUTE,
                f"Python code execution completed: {'success' if result.success else 'failed'}",
                context,
                duration_ms=result.execution_time * 1000
            )
        
        return result
    
    async def _execute_with_restrictions(self, code: str, context: ExecutionContext) -> Dict[str, Any]:
        """在受限环境中执行代码"""
        import io
        import contextlib
        
        # 准备安全的执行环境
        safe_globals = self.secure_builtins.get_safe_globals()
        safe_locals = {}
        
        # 重定向输出
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        try:
            with contextlib.redirect_stdout(stdout_capture), \
                 contextlib.redirect_stderr(stderr_capture):
                
                # 设置资源限制
                self._set_resource_limits()
                
                # 编译并执行代码
                compiled_code = compile(code, '<sandbox>', 'exec')
                exec(compiled_code, safe_globals, safe_locals)
            
            return {
                'success': True,
                'return_value': safe_locals.get('__return_value__'),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue(),
                'resource_usage': {}
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'traceback': traceback.format_exc(),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue()
            }
    
    async def _execute_in_process(self, code: str, context: ExecutionContext) -> Dict[str, Any]:
        """在独立进程中执行代码"""
        import multiprocessing
        from concurrent.futures import ProcessPoolExecutor
        
        with ProcessPoolExecutor(max_workers=1) as executor:
            try:
                future = executor.submit(
                    self._run_code_in_subprocess,
                    code,
                    self.config,
                    context
                )
                
                # 等待执行完成，带超时
                result = future.result(timeout=self.config.resource_limits.max_execution_time)
                return result
                
            except concurrent.futures.TimeoutError:
                raise ResourceExceededException(
                    ResourceType.CPU_TIME,
                    self.config.resource_limits.max_execution_time,
                    self.config.resource_limits.max_execution_time
                )
    
    @staticmethod
    def _run_code_in_subprocess(code: str, config: SandboxConfig, context: ExecutionContext) -> Dict[str, Any]:
        """在子进程中运行代码"""
        import io
        import contextlib
        import traceback
        
        # 设置进程资源限制
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_CPU, (int(config.resource_limits.max_cpu_time), int(config.resource_limits.max_cpu_time)))
            resource.setrlimit(resource.RLIMIT_AS, (config.resource_limits.max_memory, config.resource_limits.max_memory))
            resource.setrlimit(resource.RLIMIT_NOFILE, (config.resource_limits.max_open_files, config.resource_limits.max_open_files))
        except ImportError:
            pass  # Windows系统可能没有resource模块
        
        # 准备执行环境
        secure_builtins = SecureBuiltins(config)
        safe_globals = secure_builtins.get_safe_globals()
        safe_locals = {}
        
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        try:
            with contextlib.redirect_stdout(stdout_capture), \
                 contextlib.redirect_stderr(stderr_capture):
                
                compiled_code = compile(code, '<sandbox>', 'exec')
                exec(compiled_code, safe_globals, safe_locals)
            
            return {
                'success': True,
                'return_value': safe_locals.get('__return_value__'),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue(),
                'resource_usage': {}
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'traceback': traceback.format_exc(),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue()
            }
    
    def _set_resource_limits(self):
        """设置资源限制"""
        try:
            import resource
            
            # CPU时间限制
            resource.setrlimit(
                resource.RLIMIT_CPU, 
                (int(self.config.resource_limits.max_cpu_time), 
                 int(self.config.resource_limits.max_cpu_time))
            )
            
            # 内存限制
            resource.setrlimit(
                resource.RLIMIT_AS, 
                (self.config.resource_limits.max_memory, 
                 self.config.resource_limits.max_memory)
            )
            
            # 文件描述符限制
            resource.setrlimit(
                resource.RLIMIT_NOFILE, 
                (self.config.resource_limits.max_open_files, 
                 self.config.resource_limits.max_open_files)
            )
            
        except (ImportError, OSError) as e:
            logger.warning(f"Failed to set resource limits: {e}")


class DockerSandboxExecutor(SandboxExecutor):
    """Docker容器沙箱执行器"""
    
    def __init__(self, config: SandboxConfig):
        super().__init__(config)
        if not DOCKER_AVAILABLE:
            raise ImportError("Docker is not available")
        self.docker_client = docker.from_env()
    
    async def execute(self, code: str, context: ExecutionContext) -> ExecutionResult:
        """在Docker容器中执行代码"""
        execution_id = context.execution_id
        start_time = time.time()
        
        result = ExecutionResult(
            execution_id=execution_id,
            success=False
        )
        
        container = None
        try:
            # 权限检查
            if not self._check_permissions(context):
                raise SecurityViolation(
                    SecurityViolationType.SYSTEM_CALL_DENIED,
                    "Permission denied for container execution"
                )
            
            await self._log_execution_event(
                AuditEventType.ADAPTER_EXECUTE,
                "Starting Docker container execution",
                context
            )
            
            # 创建容器
            container = self._create_container(code, context)
            
            # 启动并监控容器
            container.start()
            
            # 等待容器完成
            exit_code = container.wait(timeout=self.config.resource_limits.max_execution_time)
            
            # 获取输出
            logs = container.logs(stdout=True, stderr=True).decode('utf-8')
            
            result.success = exit_code['StatusCode'] == 0
            result.stdout = logs
            result.resource_usage = self._get_container_stats(container)
            
            if not result.success:
                result.error = f"Container exited with code {exit_code['StatusCode']}"
        
        except Exception as e:
            result.error = str(e)
            result.error_type = type(e).__name__
            result.traceback = traceback.format_exc()
        
        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception as e:
                    logger.warning(f"Failed to remove container: {e}")
            
            result.execution_time = time.time() - start_time
            result.completed_at = datetime.now()
            
            await self._log_execution_event(
                AuditEventType.ADAPTER_EXECUTE,
                f"Docker execution completed: {'success' if result.success else 'failed'}",
                context,
                duration_ms=result.execution_time * 1000
            )
        
        return result
    
    def _create_container(self, code: str, context: ExecutionContext):
        """创建Docker容器"""
        # 准备代码文件
        code_file = f"/tmp/code_{context.execution_id}.py"
        
        return self.docker_client.containers.create(
            image=self.config.container_image,
            command=["python", "-c", code],
            mem_limit=self.config.container_memory_limit,
            cpu_period=100000,
            cpu_quota=int(float(self.config.container_cpu_limit) * 100000),
            network_disabled=not self.config.resource_limits.allow_network,
            read_only=True,
            remove=False,
            detach=True
        )
    
    def _get_container_stats(self, container) -> Dict[ResourceType, Any]:
        """获取容器资源使用统计"""
        try:
            stats = container.stats(stream=False)
            
            # 计算内存使用
            memory_usage = stats['memory_stats']['usage']
            memory_limit = stats['memory_stats']['limit']
            
            # 计算CPU使用
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']
            
            cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
            system_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
            
            cpu_percent = (cpu_delta / system_delta) * 100.0 if system_delta > 0 else 0.0
            
            return {
                ResourceType.MEMORY: {
                    'usage': memory_usage,
                    'limit': memory_limit,
                    'percentage': (memory_usage / memory_limit) * 100 if memory_limit > 0 else 0
                },
                ResourceType.CPU_TIME: {
                    'percentage': cpu_percent
                }
            }
        except Exception as e:
            logger.warning(f"Failed to get container stats: {e}")
            return {}


class SandboxManager:
    """沙箱管理器 - 统一的沙箱执行接口"""
    
    def __init__(self, default_config: Optional[SandboxConfig] = None):
        self.default_config = default_config or SandboxConfig()
        self._executors: Dict[str, SandboxExecutor] = {}
        self._active_executions: Dict[str, ExecutionContext] = {}
        
    def register_executor(self, name: str, executor: SandboxExecutor):
        """注册执行器"""
        self._executors[name] = executor
        logger.info(f"Registered sandbox executor: {name}")
    
    def get_executor(self, execution_type: ExecutionType, 
                    config: Optional[SandboxConfig] = None) -> SandboxExecutor:
        """获取执行器"""
        config = config or self.default_config
        
        if execution_type == ExecutionType.PYTHON:
            if config.use_container and DOCKER_AVAILABLE:
                executor_key = f"docker_python_{id(config)}"
                if executor_key not in self._executors:
                    self._executors[executor_key] = DockerSandboxExecutor(config)
                return self._executors[executor_key]
            else:
                executor_key = f"python_{id(config)}"
                if executor_key not in self._executors:
                    self._executors[executor_key] = PythonSandboxExecutor(config)
                return self._executors[executor_key]
        
        raise ValueError(f"Unsupported execution type: {execution_type}")
    
    async def execute(self, code: str, 
                     context: Optional[ExecutionContext] = None,
                     config: Optional[SandboxConfig] = None) -> ExecutionResult:
        """执行代码"""
        context = context or ExecutionContext()
        config = config or self.default_config
        
        # 记录活跃执行
        self._active_executions[context.execution_id] = context
        
        try:
            # 获取执行器
            executor = self.get_executor(config.execution_type, config)
            
            # 执行代码
            result = await executor.execute(code, context)
            
            return result
        
        finally:
            # 清理活跃执行记录
            self._active_executions.pop(context.execution_id, None)
    
    def get_active_executions(self) -> Dict[str, ExecutionContext]:
        """获取活跃的执行上下文"""
        return self._active_executions.copy()
    
    def terminate_execution(self, execution_id: str) -> bool:
        """终止执行"""
        # TODO: 实现执行终止逻辑
        if execution_id in self._active_executions:
            logger.info(f"Terminating execution: {execution_id}")
            return True
        return False


# 全局沙箱管理器实例
_sandbox_manager = None

def get_sandbox_manager() -> SandboxManager:
    """获取全局沙箱管理器"""
    global _sandbox_manager
    if _sandbox_manager is None:
        _sandbox_manager = SandboxManager()
    return _sandbox_manager


# 便捷函数
async def execute_python_code(code: str, 
                             user_id: Optional[str] = None,
                             config: Optional[SandboxConfig] = None) -> ExecutionResult:
    """便捷的Python代码执行函数"""
    manager = get_sandbox_manager()
    context = ExecutionContext(user_id=user_id)
    config = config or SandboxConfig(execution_type=ExecutionType.PYTHON)
    
    return await manager.execute(code, context, config)
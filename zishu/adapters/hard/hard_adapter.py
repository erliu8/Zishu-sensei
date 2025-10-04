"""
硬适配器基类 - Zishu-sensei 适配器框架
"""

import os
import sys
import time
import uuid
import json
import asyncio
import threading
import subprocess
import platform
import psutil
import signal
import shutil
import tempfile
import functools
import inspect
from abc import ABC, abstractmethod
from pathlib import Path
from typing import (
    Any, Dict, List, Optional, Union, Tuple, Callable, 
    Set, Type, ClassVar, TypeVar, Generic
)
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager, contextmanager
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, Future
from enum import Enum
import logging
import weakref

# 第三方依赖检查
try:
    import aiofiles
    import aiohttp
    ASYNC_IO_AVAILABLE = True
except ImportError:
    ASYNC_IO_AVAILABLE = False
    logging.warning("aiofiles/aiohttp not available, some async operations may be limited")

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    logging.debug("Docker not available")

# 项目内部模块导入
from ..base.adapter import (
    BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult,
    PerformanceMonitor, AdapterFactory
)
from ..base.exceptions import (
    BaseAdapterException, HardAdapterError, SystemOperationError,
    FileOperationError, PermissionDeniedError, SecurityViolationError,
    ResourceExhaustedException, MemoryLimitExceededError, CPULimitExceededError,
    TimeoutExceededError, AdapterExecutionError, AdapterLoadingError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from ..base.metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, AdapterCapability,
    CapabilityCategory, SecurityLevel, AdapterPermissions, AdapterVersion,
    create_capability, create_dependency, create_configuration
)

# 安全模块（可选导入）
try:
    from ..core.security import (
        EnhancedSandboxManager, SandboxConfiguration,
        EnhancedPermissionManager, AccessRequest,
        SecurityManager
    )
    from ..security.audit import AuditLogger, AuditEvent
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    logging.warning("Security modules not available, running with reduced security")
    
    # 创建占位符类
    class SandboxManager:
        def __init__(self, *args, **kwargs): pass
        async def execute_safe(self, *args, **kwargs): return None
    
    class PermissionManager:
        def __init__(self, *args, **kwargs): pass
        def check_permission(self, *args, **kwargs): return True
    
    class AuditLogger:
        def __init__(self, *args, **kwargs): pass
        def log_operation(self, *args, **kwargs): pass


# ================================
# 核心数据结构和枚举定义
# ================================

class OperationType(str, Enum):
    """硬适配器操作类型枚举"""
    FILE_OPERATION = "file_operation"
    SYSTEM_COMMAND = "system_command"
    PROCESS_MANAGEMENT = "process_management"
    NETWORK_ACCESS = "network_access"
    DEVICE_CONTROL = "device_control"
    DATABASE_ACCESS = "database_access"
    REGISTRY_ACCESS = "registry_access"
    SERVICE_CONTROL = "service_control"


class ExecutionMode(str, Enum):
    """执行模式枚举"""
    SYNCHRONOUS = "sync"         # 同步执行
    ASYNCHRONOUS = "async"       # 异步执行
    BACKGROUND = "background"    # 后台执行
    SCHEDULED = "scheduled"      # 定时执行


class SecurityPolicy(str, Enum):
    """安全策略枚举"""
    STRICT = "strict"           # 严格模式：最小权限
    MODERATE = "moderate"       # 中等模式：平衡安全性和便利性
    PERMISSIVE = "permissive"   # 宽松模式：更多权限
    CUSTOM = "custom"           # 自定义模式：用户定义


@dataclass
class OperationContext:
    """操作执行上下文"""
    operation_id: str = field(default_factory=lambda: f"op_{uuid.uuid4().hex[:8]}")
    operation_type: OperationType = OperationType.SYSTEM_COMMAND
    execution_mode: ExecutionMode = ExecutionMode.SYNCHRONOUS
    security_policy: SecurityPolicy = SecurityPolicy.MODERATE
    timeout_seconds: Optional[float] = None
    retry_count: int = 0
    max_retries: int = 3
    user_id: Optional[str] = None
    permissions: Optional[List[str]] = None
    environment: Optional[Dict[str, str]] = None
    working_directory: Optional[str] = None
    resource_limits: Optional[Dict[str, Any]] = None
    audit_required: bool = True
    dry_run: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class OperationResult:
    """操作执行结果"""
    operation_id: str
    success: bool
    return_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    output_data: Optional[Any] = None
    error_message: Optional[str] = None
    execution_time: float = 0.0
    resource_usage: Dict[str, Any] = field(default_factory=dict)
    side_effects: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "operation_id": self.operation_id,
            "success": self.success,
            "return_code": self.return_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "output_data": self.output_data,
            "error_message": self.error_message,
            "execution_time": self.execution_time,
            "resource_usage": self.resource_usage,
            "side_effects": self.side_effects,
            "warnings": self.warnings,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class ResourceLimits:
    """资源限制配置"""
    max_memory_mb: Optional[float] = None      # 最大内存使用量(MB)
    max_cpu_percent: Optional[float] = None    # 最大CPU使用率(%)
    max_execution_time: Optional[float] = None # 最大执行时间(秒)
    max_file_size_mb: Optional[float] = None   # 最大文件大小(MB)
    max_network_bandwidth: Optional[float] = None  # 最大网络带宽(MB/s)
    max_disk_usage_mb: Optional[float] = None  # 最大磁盘使用量(MB)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class SystemInfo:
    """系统信息"""
    platform: str
    architecture: str
    python_version: str
    cpu_count: int
    memory_total_gb: float
    disk_total_gb: float
    hostname: str
    user: str
    pid: int
    
    @classmethod
    def collect(cls) -> 'SystemInfo':
        """收集当前系统信息"""
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return cls(
                platform=platform.platform(),
                architecture=platform.architecture()[0],
                python_version=platform.python_version(),
                cpu_count=psutil.cpu_count(),
                memory_total_gb=memory.total / (1024**3),
                disk_total_gb=disk.total / (1024**3),
                hostname=platform.node(),
                user=os.getenv('USER', os.getenv('USERNAME', 'unknown')),
                pid=os.getpid()
            )
        except Exception as e:
            logging.warning(f"Failed to collect system info: {e}")
            return cls(
                platform=platform.platform(),
                architecture="unknown",
                python_version=platform.python_version(),
                cpu_count=1,
                memory_total_gb=0.0,
                disk_total_gb=0.0,
                hostname="unknown",
                user="unknown",
                pid=os.getpid()
            )


# ================================
# 资源管理器
# ================================

class ResourceManager:
    """
    资源管理器 - 负责监控和控制硬适配器的资源使用
    
    功能特性：
    - 实时资源监控（CPU、内存、磁盘、网络）
    - 资源限制和保护
    - 资源使用预警和告警
    - 资源池化和复用
    """
    
    def __init__(self, limits: Optional[ResourceLimits] = None):
        self.limits = limits or ResourceLimits()
        self.logger = logging.getLogger(f"{__name__}.ResourceManager")
        
        # 监控数据
        self._usage_history = deque(maxlen=1000)
        self._alerts = []
        self._monitoring_enabled = True
        self._monitoring_task = None
        
        # 资源池
        self._thread_pool = ThreadPoolExecutor(max_workers=4)
        self._process_pool = None  # 按需创建
        
        # 锁和同步
        self._lock = threading.RLock()
        
        # 启动监控
        self._start_monitoring()
    
    def _start_monitoring(self):
        """启动资源监控任务"""
        async def monitor_resources():
            while self._monitoring_enabled:
                try:
                    await self._collect_usage_data()
                    await self._check_limits()
                    await asyncio.sleep(5)  # 每5秒检查一次
                except Exception as e:
                    self.logger.error(f"Resource monitoring error: {e}")
                    await asyncio.sleep(10)  # 出错时延长检查间隔
        
        try:
            loop = asyncio.get_event_loop()
            self._monitoring_task = loop.create_task(monitor_resources())
        except RuntimeError:
            # 没有运行中的事件循环，跳过自动监控
            pass
    
    async def _collect_usage_data(self):
        """收集资源使用数据"""
        try:
            # 获取当前进程信息
            process = psutil.Process()
            memory_info = process.memory_info()
            cpu_percent = process.cpu_percent()
            
            # 获取系统信息
            system_memory = psutil.virtual_memory()
            system_cpu = psutil.cpu_percent()
            
            usage_data = {
                "timestamp": datetime.now(timezone.utc),
                "process_memory_mb": memory_info.rss / (1024 * 1024),
                "process_cpu_percent": cpu_percent,
                "system_memory_percent": system_memory.percent,
                "system_cpu_percent": system_cpu,
                "thread_count": process.num_threads(),
                "file_descriptors": process.num_fds() if hasattr(process, 'num_fds') else 0
            }
            
            with self._lock:
                self._usage_history.append(usage_data)
                
        except Exception as e:
            self.logger.warning(f"Failed to collect usage data: {e}")
    
    async def _check_limits(self):
        """检查资源限制"""
        if not self._usage_history:
            return
        
        latest_usage = self._usage_history[-1]
        alerts = []
        
        # 检查内存限制
        if (self.limits.max_memory_mb and 
            latest_usage["process_memory_mb"] > self.limits.max_memory_mb):
            alerts.append(f"Memory usage {latest_usage['process_memory_mb']:.1f}MB exceeds limit {self.limits.max_memory_mb}MB")
        
        # 检查CPU限制
        if (self.limits.max_cpu_percent and 
            latest_usage["process_cpu_percent"] > self.limits.max_cpu_percent):
            alerts.append(f"CPU usage {latest_usage['process_cpu_percent']:.1f}% exceeds limit {self.limits.max_cpu_percent}%")
        
        # 记录新告警
        for alert in alerts:
            if alert not in [a["message"] for a in self._alerts[-10:]]:  # 避免重复告警
                alert_record = {
                    "timestamp": datetime.now(timezone.utc),
                    "level": "warning",
                    "message": alert
                }
                self._alerts.append(alert_record)
                self.logger.warning(alert)
    
    def get_current_usage(self) -> Dict[str, Any]:
        """获取当前资源使用情况"""
        with self._lock:
            if not self._usage_history:
                return {}
            return self._usage_history[-1].copy()
    
    def get_usage_summary(self, minutes: int = 10) -> Dict[str, Any]:
        """获取资源使用摘要"""
        with self._lock:
            if not self._usage_history:
                return {}
            
            # 获取指定时间范围内的数据
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
            recent_data = [
                usage for usage in self._usage_history 
                if usage["timestamp"] > cutoff_time
            ]
            
            if not recent_data:
                return {}
            
            # 计算统计信息
            memory_values = [d["process_memory_mb"] for d in recent_data]
            cpu_values = [d["process_cpu_percent"] for d in recent_data]
            
            return {
                "time_range_minutes": minutes,
                "data_points": len(recent_data),
                "memory": {
                    "current_mb": memory_values[-1],
                    "avg_mb": sum(memory_values) / len(memory_values),
                    "max_mb": max(memory_values),
                    "min_mb": min(memory_values)
                },
                "cpu": {
                    "current_percent": cpu_values[-1],
                    "avg_percent": sum(cpu_values) / len(cpu_values),
                    "max_percent": max(cpu_values),
                    "min_percent": min(cpu_values)
                },
                "alerts_count": len([a for a in self._alerts if a["timestamp"] > cutoff_time])
            }
    
    def check_resource_availability(self, required_memory_mb: Optional[float] = None,
                                  required_cpu_percent: Optional[float] = None) -> Tuple[bool, List[str]]:
        """检查资源可用性"""
        issues = []
        current_usage = self.get_current_usage()
        
        if not current_usage:
            return True, []  # 无法获取使用情况时假设可用
        
        # 检查内存可用性
        if required_memory_mb:
            available_memory = (self.limits.max_memory_mb or float('inf')) - current_usage.get("process_memory_mb", 0)
            if available_memory < required_memory_mb:
                issues.append(f"Insufficient memory: need {required_memory_mb}MB, available {available_memory:.1f}MB")
        
        # 检查CPU可用性
        if required_cpu_percent:
            available_cpu = (self.limits.max_cpu_percent or 100) - current_usage.get("process_cpu_percent", 0)
            if available_cpu < required_cpu_percent:
                issues.append(f"Insufficient CPU: need {required_cpu_percent}%, available {available_cpu:.1f}%")
        
        return len(issues) == 0, issues
    
    async def execute_with_monitoring(self, coro_or_func: Callable, *args, **kwargs) -> Any:
        """在资源监控下执行函数或协程"""
        start_time = time.time()
        start_usage = self.get_current_usage()
        
        try:
            if asyncio.iscoroutinefunction(coro_or_func):
                result = await coro_or_func(*args, **kwargs)
            else:
                # 在线程池中执行同步函数
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(self._thread_pool, coro_or_func, *args, **kwargs)
            
            return result
            
        finally:
            end_time = time.time()
            end_usage = self.get_current_usage()
            
            # 记录执行统计
            execution_stats = {
                "execution_time": end_time - start_time,
                "memory_delta_mb": end_usage.get("process_memory_mb", 0) - start_usage.get("process_memory_mb", 0),
                "start_memory_mb": start_usage.get("process_memory_mb", 0),
                "end_memory_mb": end_usage.get("process_memory_mb", 0)
            }
            
            self.logger.debug(f"Execution completed: {execution_stats}")
    
    def cleanup(self):
        """清理资源管理器"""
        self._monitoring_enabled = False
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
        
        if self._thread_pool:
            self._thread_pool.shutdown(wait=True)
        
        if self._process_pool:
            self._process_pool.shutdown(wait=True)


# ================================
# 命令执行器
# ================================

class CommandExecutor:
    """
    命令执行器 - 安全地执行系统命令和脚本
    
    功能特性：
    - 多种执行模式（同步、异步、后台）
    - 安全沙箱执行
    - 超时控制和中断处理
    - 输出流处理和缓冲
    - 环境变量和工作目录控制
    """
    
    def __init__(self, security_manager: Optional[Any] = None):
        self.security_manager = security_manager
        self.logger = logging.getLogger(f"{__name__}.CommandExecutor")
        
        # 执行历史和统计
        self._execution_history = deque(maxlen=1000)
        self._active_processes: Dict[str, subprocess.Popen] = {}
        self._lock = threading.RLock()
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=SystemOperationError,
        message="Command execution failed"
    )
    async def execute_command(
        self,
        command: Union[str, List[str]],
        context: Optional[OperationContext] = None,
        capture_output: bool = True,
        stream_output: bool = False,
        output_callback: Optional[Callable[[str], None]] = None
    ) -> OperationResult:
        """
        执行系统命令
        
        Args:
            command: 要执行的命令（字符串或参数列表）
            context: 操作上下文
            capture_output: 是否捕获输出
            stream_output: 是否流式处理输出
            output_callback: 输出回调函数
            
        Returns:
            OperationResult: 执行结果
        """
        if context is None:
            context = OperationContext()
        
        start_time = time.time()
        operation_result = OperationResult(
            operation_id=context.operation_id,
            success=False
        )
        
        try:
            # 安全检查
            if not self._validate_command(command, context):
                raise SecurityViolationError(
                    f"Command validation failed: {command}",
                    violation_type="command_validation"
                )
            
            # 预处理命令
            processed_command = self._preprocess_command(command, context)
            
            # 准备执行环境
            exec_env = self._prepare_environment(context)
            
            self.logger.info(f"Executing command: {processed_command}")
            
            if context.dry_run:
                # 干运行模式，只验证但不执行
                operation_result.success = True
                operation_result.stdout = "[DRY RUN] Command would be executed"
                operation_result.return_code = 0
                return operation_result
            
            # 根据执行模式选择执行方法
            if context.execution_mode == ExecutionMode.ASYNCHRONOUS:
                result = await self._execute_async(processed_command, context, exec_env, capture_output, stream_output, output_callback)
            elif context.execution_mode == ExecutionMode.BACKGROUND:
                result = await self._execute_background(processed_command, context, exec_env)
            else:
                result = await self._execute_sync(processed_command, context, exec_env, capture_output, stream_output, output_callback)
            
            operation_result = result
            operation_result.execution_time = time.time() - start_time
            operation_result.success = result.return_code == 0
            
            # 记录执行历史
            with self._lock:
                self._execution_history.append({
                    "operation_id": context.operation_id,
                    "command": str(command)[:200],  # 限制长度避免日志过长
                    "success": operation_result.success,
                    "execution_time": operation_result.execution_time,
                    "timestamp": datetime.now(timezone.utc)
                })
            
            return operation_result
            
        except Exception as e:
            operation_result.execution_time = time.time() - start_time
            operation_result.error_message = str(e)
            operation_result.success = False
            
            self.logger.error(f"Command execution failed: {e}")
            raise
        
        finally:
            # 清理资源
            self._cleanup_process(context.operation_id)
    
    def _validate_command(self, command: Union[str, List[str]], context: OperationContext) -> bool:
        """验证命令安全性"""
        command_str = command if isinstance(command, str) else ' '.join(command)
        
        # 基础安全检查
        dangerous_patterns = [
            'rm -rf /', 'format', 'del /f /s /q', '> /dev/null',
            'sudo su', 'chmod 777', 'wget http', 'curl http'
        ]
        
        for pattern in dangerous_patterns:
            if pattern in command_str.lower():
                self.logger.warning(f"Potentially dangerous command detected: {pattern}")
                if context.security_policy == SecurityPolicy.STRICT:
                    return False
        
        # 检查权限要求
        if context.permissions:
            required_perms = self._get_command_permissions(command_str)
            if not all(perm in context.permissions for perm in required_perms):
                self.logger.warning(f"Insufficient permissions for command: {command_str}")
                return False
        
        return True
    
    def _get_command_permissions(self, command: str) -> List[str]:
        """获取命令所需的权限列表"""
        permissions = []
        
        if any(keyword in command.lower() for keyword in ['rm', 'del', 'delete', 'unlink']):
            permissions.append('file_delete')
        
        if any(keyword in command.lower() for keyword in ['cp', 'copy', 'mv', 'move']):
            permissions.append('file_modify')
        
        if any(keyword in command.lower() for keyword in ['wget', 'curl', 'download']):
            permissions.append('network_access')
        
        if any(keyword in command.lower() for keyword in ['sudo', 'su', 'runas']):
            permissions.append('elevated_privileges')
        
        return permissions
    
    def _preprocess_command(self, command: Union[str, List[str]], context: OperationContext) -> List[str]:
        """预处理命令"""
        if isinstance(command, str):
            # 简单的shell命令解析
            import shlex
            try:
                return shlex.split(command)
            except ValueError:
                # 如果解析失败，回退到简单分割
                return command.split()
        else:
            return list(command)
    
    def _prepare_environment(self, context: OperationContext) -> Dict[str, str]:
        """准备执行环境"""
        env = os.environ.copy()
        
        # 添加自定义环境变量
        if context.environment:
            env.update(context.environment)
        
        # 安全环境变量
        env['ZISHU_OPERATION_ID'] = context.operation_id
        env['ZISHU_SECURITY_POLICY'] = context.security_policy.value
        
        return env
    
    async def _execute_sync(
        self,
        command: List[str],
        context: OperationContext,
        env: Dict[str, str],
        capture_output: bool,
        stream_output: bool,
        output_callback: Optional[Callable[[str], None]]
    ) -> OperationResult:
        """同步执行命令"""
        try:
            # 创建进程
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE if capture_output else None,
                stderr=subprocess.PIPE if capture_output else None,
                text=True,
                env=env,
                cwd=context.working_directory,
                preexec_fn=None if platform.system() == "Windows" else os.setsid
            )
            
            # 注册活跃进程
            with self._lock:
                self._active_processes[context.operation_id] = process
            
            try:
                # 等待执行完成或超时
                if context.timeout_seconds:
                    stdout, stderr = process.communicate(timeout=context.timeout_seconds)
                else:
                    stdout, stderr = process.communicate()
                
                return OperationResult(
                    operation_id=context.operation_id,
                    success=process.returncode == 0,
                    return_code=process.returncode,
                    stdout=stdout,
                    stderr=stderr
                )
                
            except subprocess.TimeoutExpired:
                # 超时处理
                process.kill()
                stdout, stderr = process.communicate()
                
                return OperationResult(
                    operation_id=context.operation_id,
                    success=False,
                    return_code=-1,
                    stdout=stdout,
                    stderr=stderr,
                    error_message=f"Command timed out after {context.timeout_seconds} seconds"
                )
                
        except Exception as e:
            return OperationResult(
                operation_id=context.operation_id,
                success=False,
                error_message=str(e)
            )
    
    async def _execute_async(
        self,
        command: List[str],
        context: OperationContext,
        env: Dict[str, str],
        capture_output: bool,
        stream_output: bool,
        output_callback: Optional[Callable[[str], None]]
    ) -> OperationResult:
        """异步执行命令"""
        try:
            # 使用 asyncio.subprocess 进行异步执行
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE if capture_output else None,
                stderr=asyncio.subprocess.PIPE if capture_output else None,
                env=env,
                cwd=context.working_directory
            )
            
            try:
                # 等待执行完成或超时
                if context.timeout_seconds:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=context.timeout_seconds
                    )
                else:
                    stdout, stderr = await process.communicate()
                
                return OperationResult(
                    operation_id=context.operation_id,
                    success=process.returncode == 0,
                    return_code=process.returncode,
                    stdout=stdout.decode() if stdout else None,
                    stderr=stderr.decode() if stderr else None
                )
                
            except asyncio.TimeoutError:
                # 超时处理
                process.kill()
                await process.wait()
                
                return OperationResult(
                    operation_id=context.operation_id,
                    success=False,
                    return_code=-1,
                    error_message=f"Command timed out after {context.timeout_seconds} seconds"
                )
                
        except Exception as e:
            return OperationResult(
                operation_id=context.operation_id,
                success=False,
                error_message=str(e)
            )
    
    async def _execute_background(
        self,
        command: List[str],
        context: OperationContext,
        env: Dict[str, str]
    ) -> OperationResult:
        """后台执行命令"""
        try:
            # 创建后台进程
            process = subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
                cwd=context.working_directory,
                preexec_fn=None if platform.system() == "Windows" else os.setsid
            )
            
            # 注册活跃进程
            with self._lock:
                self._active_processes[context.operation_id] = process
            
            return OperationResult(
                operation_id=context.operation_id,
                success=True,
                return_code=None,  # 后台进程无法立即获取返回码
                stdout=f"Background process started with PID: {process.pid}"
            )
            
        except Exception as e:
            return OperationResult(
                operation_id=context.operation_id,
                success=False,
                error_message=str(e)
            )
    
    def _cleanup_process(self, operation_id: str):
        """清理进程资源"""
        with self._lock:
            if operation_id in self._active_processes:
                process = self._active_processes.pop(operation_id)
                if process.poll() is None:  # 进程仍在运行
                    try:
                        process.terminate()
                        # 给进程一些时间优雅退出
                        process.wait(timeout=5)
                    except (subprocess.TimeoutExpired, ProcessLookupError):
                        try:
                            process.kill()
                        except ProcessLookupError:
                            pass  # 进程已经结束
    
    def get_active_processes(self) -> Dict[str, Dict[str, Any]]:
        """获取活跃进程列表"""
        with self._lock:
            active_info = {}
            for op_id, process in self._active_processes.items():
                try:
                    active_info[op_id] = {
                        "pid": process.pid,
                        "returncode": process.returncode,
                        "running": process.poll() is None,
                        "command": " ".join(process.args) if hasattr(process, 'args') else "unknown"
                    }
                except Exception:
                    active_info[op_id] = {"status": "unknown"}
            return active_info
    
    def terminate_operation(self, operation_id: str) -> bool:
        """终止指定操作"""
        with self._lock:
            if operation_id in self._active_processes:
                process = self._active_processes[operation_id]
                try:
                    process.terminate()
                    return True
                except ProcessLookupError:
                    return False
            return False
    
    def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """获取执行历史"""
        with self._lock:
            return list(self._execution_history)[-limit:]


# ================================
# 硬适配器基类
# ================================

class HardAdapter(BaseAdapter):
    """
    硬适配器基类
    
    硬适配器是 Zishu-sensei 适配器框架的核心组件，专门负责执行系统级操作。
    它提供了一个安全、可靠、高性能的执行环境，支持文件操作、系统命令、
    进程管理、网络访问等多种硬件和系统资源的直接操作。
    
    核心特性：
    1. 安全执行：集成沙箱机制，权限控制，审计日志
    2. 资源管理：智能资源监控，限制控制，性能优化
    3. 错误处理：完整的异常体系，重试机制，降级策略
    4. 异步支持：支持同步/异步/后台多种执行模式
    5. 可扩展性：模块化设计，插件机制，热更新
    
    使用示例：
    ```python
    # 创建硬适配器实例
    config = {
        'adapter_id': 'system_controller',
        'adapter_type': 'hard',
        'security_policy': 'moderate',
        'resource_limits': {
            'max_memory_mb': 512,
            'max_cpu_percent': 50
        }
    }
    
    adapter = SystemAdapter(config)
    
    # 初始化适配器
    await adapter.initialize()
    
    # 执行系统操作
    result = await adapter.execute_command(
        'ls -la /tmp',
        timeout_seconds=30
    )
    
    print(f"Command result: {result.stdout}")
    ```
    """
    
    # 类级别配置
    DEFAULT_RESOURCE_LIMITS = ResourceLimits(
        max_memory_mb=1024,     # 1GB 内存限制
        max_cpu_percent=80,     # 80% CPU限制
        max_execution_time=300, # 5分钟执行时间限制
        max_file_size_mb=100    # 100MB 文件大小限制
    )
    
    SUPPORTED_OPERATIONS = {
        OperationType.FILE_OPERATION,
        OperationType.SYSTEM_COMMAND,
        OperationType.PROCESS_MANAGEMENT,
        OperationType.NETWORK_ACCESS
    }
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化硬适配器
        
        Args:
            config: 适配器配置字典，支持以下配置项：
                - security_policy: 安全策略 (strict/moderate/permissive/custom)
                - resource_limits: 资源限制配置
                - enable_sandbox: 是否启用沙箱 (默认: True)
                - enable_audit: 是否启用审计日志 (默认: True)
                - allowed_operations: 允许的操作类型列表
                - temp_directory: 临时目录路径
                - max_concurrent_operations: 最大并发操作数
        """
        # 确保配置包含适配器类型
        if 'adapter_type' not in config:
            config['adapter_type'] = AdapterType.HARD
        
        super().__init__(config)
        
        # 安全配置
        self.security_policy = SecurityPolicy(config.get('security_policy', SecurityPolicy.MODERATE))
        self.enable_sandbox = config.get('enable_sandbox', True)
        self.enable_audit = config.get('enable_audit', True)
        
        # 资源配置
        resource_limits_config = config.get('resource_limits', {})
        self.resource_limits = ResourceLimits(**resource_limits_config)
        
        # 操作配置
        self.allowed_operations = set(config.get('allowed_operations', self.SUPPORTED_OPERATIONS))
        self.max_concurrent_operations = config.get('max_concurrent_operations', 10)
        
        # 路径配置
        self.temp_directory = Path(config.get('temp_directory', tempfile.gettempdir()))
        self.working_directory = config.get('working_directory', os.getcwd())
        
        # 初始化组件
        self.resource_manager: Optional[ResourceManager] = None
        self.command_executor: Optional[CommandExecutor] = None
        self.sandbox_manager: Optional[SandboxManager] = None
        self.permission_manager: Optional[PermissionManager] = None
        self.audit_logger: Optional[AuditLogger] = None
        
        # 运行时状态
        self.system_info: Optional[SystemInfo] = None
        self.active_operations: Dict[str, OperationContext] = {}
        self.operation_semaphore: Optional[asyncio.Semaphore] = None
        
        # 统计信息
        self.operation_count = 0
        self.success_count = 0
        self.error_count = 0
        
        # 线程安全
        self._operation_lock = threading.RLock()
        
        self.logger.info(f"HardAdapter initialized with security policy: {self.security_policy}")
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载硬适配器元数据"""
        # 基础版本信息
        version = AdapterVersion(
            version="1.0.0",
            release_date=datetime.now(timezone.utc),
            changelog="Initial release of HardAdapter base class",
            compatibility=["linux", "windows", "darwin"]
        )
        
        # 核心能力定义
        capabilities = [
            create_capability(
                name="system_command_execution",
                category=CapabilityCategory.SYSTEM_CONTROL,
                description="Execute system commands and scripts safely",
                input_schema={
                    "type": "object",
                    "properties": {
                        "command": {"type": ["string", "array"]},
                        "timeout": {"type": "number"},
                        "environment": {"type": "object"}
                    },
                    "required": ["command"]
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "return_code": {"type": "integer"},
                        "stdout": {"type": "string"},
                        "stderr": {"type": "string"}
                    }
                }
            ),
            create_capability(
                name="file_operations",
                category=CapabilityCategory.FILE_OPERATIONS,
                description="Perform file and directory operations",
                input_schema={
                    "type": "object",
                    "properties": {
                        "operation": {"type": "string", "enum": ["read", "write", "copy", "move", "delete"]},
                        "path": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["operation", "path"]
                }
            ),
            create_capability(
                name="process_management",
                category=CapabilityCategory.SYSTEM_CONTROL,
                description="Manage system processes",
                input_schema={
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "enum": ["list", "kill", "monitor"]},
                        "process_id": {"type": "integer"},
                        "process_name": {"type": "string"}
                    },
                    "required": ["action"]
                }
            )
        ]
        
        # 依赖关系
        dependencies = [
            create_dependency(
                name="psutil",
                version=">=5.8.0",
                dep_type="package",
                description="Process and system monitoring"
            ),
            create_dependency(
                name="aiofiles",
                version=">=0.8.0",
                dep_type="package",
                optional=True,
                description="Asynchronous file operations"
            )
        ]
        
        # 配置项
        configurations = [
            create_configuration(
                name="security_policy",
                config_type="string",
                default_value="moderate",
                description="Security policy level: strict, moderate, permissive, custom"
            ),
            create_configuration(
                name="max_memory_mb",
                config_type="float",
                default_value=1024.0,
                description="Maximum memory usage in MB"
            ),
            create_configuration(
                name="max_cpu_percent",
                config_type="float",
                default_value=80.0,
                description="Maximum CPU usage percentage"
            ),
            create_configuration(
                name="enable_sandbox",
                config_type="bool",
                default_value=True,
                description="Enable sandbox execution"
            )
        ]
        
        # 权限要求
        permissions = AdapterPermissions(
            security_level=SecurityLevel.RESTRICTED,
            required_roles={"system_operator", "hard_adapter_user"},
            file_system_access=["/tmp", "/var/tmp"],
            system_commands=["ls", "ps", "df", "free"],
            network_access=[]
        )
        
        # 创建元数据
        metadata = AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            display_name="Hard Adapter Base Class",
            description="Base class for hard adapters providing system-level operations",
            adapter_type=AdapterType.HARD,
            version=version,
            author="Zishu-sensei Development Team",
            license="MIT",
            capabilities=capabilities,
            dependencies=dependencies,
            configuration=configurations,
            permissions=permissions,
            tags={"system", "hardware", "automation", "base_class"},
            keywords={"hard_adapter", "system_operations", "automation"}
        )
        
        return metadata
    
    async def _initialize_impl(self) -> bool:
        """硬适配器初始化实现"""
        try:
            self.logger.info("Initializing HardAdapter components...")
            
            # 收集系统信息
            self.system_info = SystemInfo.collect()
            self.logger.info(f"System info: {self.system_info.platform}, "
                           f"CPU: {self.system_info.cpu_count}, "
                           f"Memory: {self.system_info.memory_total_gb:.1f}GB")
            
            # 初始化资源管理器
            self.resource_manager = ResourceManager(self.resource_limits)
            self.logger.debug("Resource manager initialized")
            
            # 初始化命令执行器
            self.command_executor = CommandExecutor()
            self.logger.debug("Command executor initialized")
            
            # 初始化安全组件（如果可用）
            if SECURITY_AVAILABLE:
                if self.enable_sandbox:
                    sandbox_config = {
                        'temp_directory': str(self.temp_directory),
                        'allowed_paths': [str(self.temp_directory), '/tmp'],
                        'resource_limits': self.resource_limits.to_dict()
                    }
                    self.sandbox_manager = SandboxManager(sandbox_config)
                    self.logger.debug("Sandbox manager initialized")
                
                self.permission_manager = PermissionManager()
                self.logger.debug("Permission manager initialized")
                
                if self.enable_audit:
                    self.audit_logger = AuditLogger(adapter_id=self.adapter_id)
                    self.logger.debug("Audit logger initialized")
            else:
                self.logger.warning("Security modules not available, running with reduced security")
            
            # 初始化并发控制
            self.operation_semaphore = asyncio.Semaphore(self.max_concurrent_operations)
            
            # 验证必要目录
            self.temp_directory.mkdir(parents=True, exist_ok=True)
            
            # 执行健康检查
            health_result = await self._health_check_impl()
            if not health_result.is_healthy:
                self.logger.error(f"Health check failed: {health_result.issues}")
                return False
            
            self.logger.info("HardAdapter initialization completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"HardAdapter initialization failed: {e}")
            return False
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """硬适配器核心处理逻辑"""
        # 解析输入数据
        operation_request = self._parse_operation_request(input_data)
        
        # 创建操作上下文
        operation_context = self._create_operation_context(operation_request, context)
        
        # 验证操作权限
        await self._validate_operation_permissions(operation_context)
        
        # 检查资源可用性
        await self._check_resource_availability(operation_context)
        
        # 执行操作
        async with self.operation_semaphore:
            return await self._execute_operation(operation_context)
    
    def _parse_operation_request(self, input_data: Any) -> Dict[str, Any]:
        """解析操作请求"""
        if isinstance(input_data, dict):
            return input_data
        elif isinstance(input_data, str):
            # 尝试解析为JSON
            try:
                import json
                return json.loads(input_data)
            except json.JSONDecodeError:
                # 作为简单命令处理
                return {
                    "operation_type": "system_command",
                    "command": input_data
                }
        else:
            raise AdapterExecutionError(
                f"Unsupported input data type: {type(input_data)}",
                adapter_id=self.adapter_id
            )
    
    def _create_operation_context(self, operation_request: Dict[str, Any], execution_context: ExecutionContext) -> OperationContext:
        """创建操作上下文"""
        return OperationContext(
            operation_type=OperationType(operation_request.get("operation_type", "system_command")),
            execution_mode=ExecutionMode(operation_request.get("execution_mode", "sync")),
            security_policy=self.security_policy,
            timeout_seconds=operation_request.get("timeout_seconds", execution_context.timeout),
            user_id=execution_context.user_id,
            environment=operation_request.get("environment"),
            working_directory=operation_request.get("working_directory", self.working_directory),
            audit_required=self.enable_audit,
            dry_run=operation_request.get("dry_run", False)
        )
    
    async def _validate_operation_permissions(self, operation_context: OperationContext):
        """验证操作权限"""
        if operation_context.operation_type not in self.allowed_operations:
            raise PermissionDeniedError(
                f"Operation type {operation_context.operation_type} not allowed",
                required_permission=operation_context.operation_type.value,
                adapter_id=self.adapter_id
            )
        
        if self.permission_manager:
            permission_context = {
                'operation_type': operation_context.operation_type.value,
                'user_id': operation_context.user_id,
                'security_policy': operation_context.security_policy.value
            }
            
            if not self.permission_manager.check_permission("hard_adapter_execute", permission_context):
                raise PermissionDeniedError(
                    "Insufficient permissions for hard adapter execution",
                    required_permission="hard_adapter_execute",
                    adapter_id=self.adapter_id
                )
    
    async def _check_resource_availability(self, operation_context: OperationContext):
        """检查资源可用性"""
        if not self.resource_manager:
            return  # 跳过资源检查
        
        # 估算操作所需资源
        estimated_memory = operation_context.resource_limits.get("memory_mb", 64) if operation_context.resource_limits else 64
        estimated_cpu = operation_context.resource_limits.get("cpu_percent", 20) if operation_context.resource_limits else 20
        
        available, issues = self.resource_manager.check_resource_availability(
            required_memory_mb=estimated_memory,
            required_cpu_percent=estimated_cpu
        )
        
        if not available:
            raise ResourceExhaustedException(
                f"Insufficient resources for operation: {'; '.join(issues)}",
                resource_type="combined",
                adapter_id=self.adapter_id
            )
    
    async def _execute_operation(self, operation_context: OperationContext) -> Any:
        """执行具体操作"""
        with self._operation_lock:
            self.active_operations[operation_context.operation_id] = operation_context
            self.operation_count += 1
        
        try:
            # 记录审计日志
            if self.audit_logger:
                audit_event = {
                    "operation_id": operation_context.operation_id,
                    "operation_type": operation_context.operation_type.value,
                    "user_id": operation_context.user_id,
                    "security_policy": operation_context.security_policy.value,
                    "timestamp": datetime.now(timezone.utc)
                }
                self.audit_logger.log_operation("operation_start", audit_event)
            
            # 委托给子类实现的具体执行方法
            result = await self._execute_operation_impl(operation_context)
            
            with self._operation_lock:
                self.success_count += 1
            
            return result
            
        except Exception as e:
            with self._operation_lock:
                self.error_count += 1
            
            # 记录错误审计日志
            if self.audit_logger:
                error_event = {
                    "operation_id": operation_context.operation_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "timestamp": datetime.now(timezone.utc)
                }
                self.audit_logger.log_operation("operation_error", error_event)
            
            raise
            
        finally:
            # 清理操作记录
            with self._operation_lock:
                self.active_operations.pop(operation_context.operation_id, None)
    
    @abstractmethod
    async def _execute_operation_impl(self, operation_context: OperationContext) -> Any:
        """
        子类必须实现的具体操作执行逻辑
        
        Args:
            operation_context: 操作上下文，包含操作类型、参数、安全策略等信息
            
        Returns:
            Any: 操作执行结果
            
        Raises:
            HardAdapterError: 操作执行失败时抛出
        """
        pass
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取硬适配器能力列表"""
        return [
            create_capability(
                name="system_operations",
                category=CapabilityCategory.SYSTEM_CONTROL,
                description="Execute system-level operations",
                tags={"system", "control"}
            ),
            create_capability(
                name="resource_management",
                category=CapabilityCategory.SYSTEM_CONTROL,
                description="Monitor and manage system resources",
                tags={"resources", "monitoring"}
            ),
            create_capability(
                name="security_enforcement",
                category=CapabilityCategory.SYSTEM_CONTROL,
                description="Enforce security policies and access control",
                tags={"security", "permissions"}
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """硬适配器健康检查"""
        checks = {}
        issues = []
        recommendations = []
        metrics = {}
        
        try:
            # 检查系统信息
            if self.system_info:
                checks["system_info_available"] = True
                metrics["cpu_count"] = self.system_info.cpu_count
                metrics["memory_total_gb"] = self.system_info.memory_total_gb
            else:
                checks["system_info_available"] = False
                issues.append("System information not available")
            
            # 检查资源管理器
            if self.resource_manager:
                checks["resource_manager_available"] = True
                current_usage = self.resource_manager.get_current_usage()
                if current_usage:
                    metrics["current_memory_mb"] = current_usage.get("process_memory_mb", 0)
                    metrics["current_cpu_percent"] = current_usage.get("process_cpu_percent", 0)
                    
                    # 检查资源使用是否正常
                    if current_usage.get("process_memory_mb", 0) > (self.resource_limits.max_memory_mb or 1024) * 0.9:
                        issues.append("Memory usage is approaching limit")
                        recommendations.append("Consider increasing memory limit or optimizing memory usage")
            else:
                checks["resource_manager_available"] = False
                issues.append("Resource manager not initialized")
            
            # 检查命令执行器
            if self.command_executor:
                checks["command_executor_available"] = True
                active_processes = self.command_executor.get_active_processes()
                metrics["active_processes_count"] = len(active_processes)
            else:
                checks["command_executor_available"] = False
                issues.append("Command executor not initialized")
            
            # 检查安全组件
            if SECURITY_AVAILABLE:
                checks["security_modules_available"] = True
                if self.sandbox_manager:
                    checks["sandbox_enabled"] = True
                if self.permission_manager:
                    checks["permission_manager_enabled"] = True
                if self.audit_logger:
                    checks["audit_logging_enabled"] = True
            else:
                checks["security_modules_available"] = False
                issues.append("Security modules not available")
                recommendations.append("Install security dependencies for enhanced security")
            
            # 检查临时目录
            if self.temp_directory.exists() and self.temp_directory.is_dir():
                checks["temp_directory_accessible"] = True
            else:
                checks["temp_directory_accessible"] = False
                issues.append(f"Temporary directory not accessible: {self.temp_directory}")
            
            # 检查并发限制
            if self.operation_semaphore:
                checks["concurrency_control_enabled"] = True
                metrics["max_concurrent_operations"] = self.max_concurrent_operations
                metrics["current_active_operations"] = len(self.active_operations)
            
            # 添加统计指标
            metrics["total_operations"] = self.operation_count
            metrics["success_rate"] = self.success_count / max(self.operation_count, 1)
            metrics["error_count"] = self.error_count
            
            # 确定整体健康状态
            critical_checks = ["system_info_available", "command_executor_available", "temp_directory_accessible"]
            is_healthy = all(checks.get(check, False) for check in critical_checks)
            
            if is_healthy and len(issues) == 0:
                status = "healthy"
            elif is_healthy and len(issues) > 0:
                status = "degraded"
            else:
                status = "unhealthy"
            
            return HealthCheckResult(
                is_healthy=is_healthy,
                status=status,
                checks=checks,
                metrics=metrics,
                issues=issues,
                recommendations=recommendations
            )
            
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return HealthCheckResult(
                is_healthy=False,
                status="unknown",
                checks={"health_check_execution": False},
                issues=[f"Health check execution failed: {str(e)}"]
            )
    
    async def _cleanup_impl(self) -> None:
        """硬适配器清理实现"""
        try:
            self.logger.info("Cleaning up HardAdapter...")
            
            # 终止所有活跃操作
            if self.command_executor:
                active_processes = self.command_executor.get_active_processes()
                for op_id in active_processes:
                    self.command_executor.terminate_operation(op_id)
                    self.logger.debug(f"Terminated operation: {op_id}")
            
            # 清理资源管理器
            if self.resource_manager:
                self.resource_manager.cleanup()
                self.logger.debug("Resource manager cleaned up")
            
            # 清理安全组件
            if self.sandbox_manager and hasattr(self.sandbox_manager, 'cleanup'):
                await self.sandbox_manager.cleanup()
                self.logger.debug("Sandbox manager cleaned up")
            
            # 清理临时文件
            try:
                temp_files = list(self.temp_directory.glob("zishu_*"))
                for temp_file in temp_files:
                    if temp_file.is_file():
                        temp_file.unlink()
                    elif temp_file.is_dir():
                        shutil.rmtree(temp_file)
                if temp_files:
                    self.logger.debug(f"Cleaned up {len(temp_files)} temporary files")
            except Exception as e:
                self.logger.warning(f"Failed to clean temporary files: {e}")
            
            # 清理状态
            with self._operation_lock:
                self.active_operations.clear()
            
            self.logger.info("HardAdapter cleanup completed")
            
        except Exception as e:
            self.logger.error(f"Error during HardAdapter cleanup: {e}")
            raise
    
    # ================================
    # 公共操作接口
    # ================================
    
    async def execute_command(
        self,
        command: Union[str, List[str]],
        timeout_seconds: Optional[float] = None,
        environment: Optional[Dict[str, str]] = None,
        working_directory: Optional[str] = None,
        capture_output: bool = True,
        execution_mode: ExecutionMode = ExecutionMode.SYNCHRONOUS
    ) -> OperationResult:
        """
        执行系统命令
        
        Args:
            command: 要执行的命令
            timeout_seconds: 超时时间
            environment: 环境变量
            working_directory: 工作目录
            capture_output: 是否捕获输出
            execution_mode: 执行模式
            
        Returns:
            OperationResult: 执行结果
        """
        operation_request = {
            "operation_type": "system_command",
            "command": command,
            "timeout_seconds": timeout_seconds,
            "environment": environment,
            "working_directory": working_directory,
            "capture_output": capture_output,
            "execution_mode": execution_mode.value
        }
        
        context = ExecutionContext(timeout=timeout_seconds)
        result = await self.process(operation_request, context.metadata)
        
        return result if isinstance(result, OperationResult) else OperationResult(
            operation_id=context.execution_id,
            success=True,
            output_data=result
        )
    
    async def read_file(self, file_path: Union[str, Path], encoding: str = 'utf-8') -> str:
        """
        读取文件内容
        
        Args:
            file_path: 文件路径
            encoding: 文件编码
            
        Returns:
            str: 文件内容
        """
        operation_request = {
            "operation_type": "file_operation",
            "action": "read",
            "path": str(file_path),
            "encoding": encoding
        }
        
        result = await self.process(operation_request)
        return result
    
    async def write_file(self, file_path: Union[str, Path], content: str, encoding: str = 'utf-8') -> bool:
        """
        写入文件内容
        
        Args:
            file_path: 文件路径
            content: 文件内容
            encoding: 文件编码
            
        Returns:
            bool: 是否成功
        """
        operation_request = {
            "operation_type": "file_operation",
            "action": "write",
            "path": str(file_path),
            "content": content,
            "encoding": encoding
        }
        
        result = await self.process(operation_request)
        return bool(result)
    
    def get_system_info(self) -> Optional[SystemInfo]:
        """获取系统信息"""
        return self.system_info
    
    def get_resource_usage(self) -> Dict[str, Any]:
        """获取资源使用情况"""
        if self.resource_manager:
            return self.resource_manager.get_current_usage()
        return {}
    
    def get_active_operations(self) -> Dict[str, OperationContext]:
        """获取活跃操作列表"""
        with self._operation_lock:
            return self.active_operations.copy()
    
    def get_operation_statistics(self) -> Dict[str, Any]:
        """获取操作统计信息"""
        with self._operation_lock:
            return {
                "total_operations": self.operation_count,
                "successful_operations": self.success_count,
                "failed_operations": self.error_count,
                "success_rate": self.success_count / max(self.operation_count, 1),
                "active_operations_count": len(self.active_operations),
                "max_concurrent_operations": self.max_concurrent_operations
            }


# ================================
# 基础硬适配器实现
# ================================

class SystemAdapter(HardAdapter):
    """
    系统适配器 - 基础系统操作的具体实现
    
    这是一个具体的硬适配器实现，提供了常见的系统操作功能，
    可以作为其他硬适配器的参考实现。
    """
    
    async def _execute_operation_impl(self, operation_context: OperationContext) -> Any:
        """执行具体的系统操作"""
        operation_type = operation_context.operation_type
        
        if operation_type == OperationType.SYSTEM_COMMAND:
            return await self._execute_system_command(operation_context)
        elif operation_type == OperationType.FILE_OPERATION:
            return await self._execute_file_operation(operation_context)
        elif operation_type == OperationType.PROCESS_MANAGEMENT:
            return await self._execute_process_operation(operation_context)
        else:
            raise HardAdapterError(
                f"Unsupported operation type: {operation_type}",
                adapter_id=self.adapter_id
            )
    
    async def _execute_system_command(self, operation_context: OperationContext) -> OperationResult:
        """执行系统命令"""
        if not self.command_executor:
            raise SystemOperationError("Command executor not available", adapter_id=self.adapter_id)
        
        # 从操作上下文中提取命令参数
        # 注意：这里需要根据实际的操作请求结构来获取命令
        # 这是一个示例实现，实际使用时需要根据具体需求调整
        command = getattr(operation_context, 'command', 'echo "Hello from HardAdapter"')
        
        return await self.command_executor.execute_command(
            command=command,
            context=operation_context,
            capture_output=True
        )
    
    async def _execute_file_operation(self, operation_context: OperationContext) -> Any:
        """执行文件操作"""
        # 这里应该根据operation_context中的具体参数来执行文件操作
        # 这是一个示例实现
        action = getattr(operation_context, 'action', 'info')
        path = getattr(operation_context, 'path', '/tmp')
        
        if action == "info":
            path_obj = Path(path)
            if path_obj.exists():
                stat = path_obj.stat()
                return {
                    "exists": True,
                    "is_file": path_obj.is_file(),
                    "is_directory": path_obj.is_dir(),
                    "size": stat.st_size,
                    "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat()
                }
            else:
                return {"exists": False}
        
        # 其他文件操作可以在这里实现
        return {"status": "operation_not_implemented", "action": action}
    
    async def _execute_process_operation(self, operation_context: OperationContext) -> Any:
        """执行进程操作"""
        action = getattr(operation_context, 'action', 'list')
        
        if action == "list":
            # 列出当前进程
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    processes.append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return {"processes": processes[:20]}  # 限制返回数量
        
        # 其他进程操作可以在这里实现
        return {"status": "operation_not_implemented", "action": action}


# ================================
# 注册适配器类型
# ================================

# 注册硬适配器到工厂
AdapterFactory.register("hard", HardAdapter)
AdapterFactory.register("system", SystemAdapter)


# ================================
# 工具函数和辅助类
# ================================

def create_hard_adapter_config(
    adapter_id: str,
    security_policy: SecurityPolicy = SecurityPolicy.MODERATE,
    max_memory_mb: float = 1024,
    max_cpu_percent: float = 80,
    enable_sandbox: bool = True,
    **kwargs
) -> Dict[str, Any]:
    """
    创建硬适配器配置的便利函数
    
    Args:
        adapter_id: 适配器ID
        security_policy: 安全策略
        max_memory_mb: 最大内存使用量
        max_cpu_percent: 最大CPU使用率
        enable_sandbox: 是否启用沙箱
        **kwargs: 其他配置选项
        
    Returns:
        Dict[str, Any]: 适配器配置字典
    """
    config = {
        "adapter_id": adapter_id,
        "adapter_type": AdapterType.HARD,
        "name": f"HardAdapter-{adapter_id}",
        "security_policy": security_policy.value,
        "resource_limits": {
            "max_memory_mb": max_memory_mb,
            "max_cpu_percent": max_cpu_percent
        },
        "enable_sandbox": enable_sandbox,
        "enable_audit": True,
        **kwargs
    }
    
    return config


class HardAdapterBuilder:
    """
    硬适配器构建器 - 提供流式API来配置和创建硬适配器
    
    使用示例：
    ```python
    adapter = (HardAdapterBuilder()
               .with_id("my_adapter")
               .with_security_policy(SecurityPolicy.STRICT)
               .with_memory_limit(512)
               .with_sandbox(True)
               .build())
    ```
    """
    
    def __init__(self):
        self._config = {
            "adapter_type": AdapterType.HARD,
            "security_policy": SecurityPolicy.MODERATE.value,
            "enable_sandbox": True,
            "enable_audit": True,
            "resource_limits": {}
        }
    
    def with_id(self, adapter_id: str) -> 'HardAdapterBuilder':
        """设置适配器ID"""
        self._config["adapter_id"] = adapter_id
        return self
    
    def with_name(self, name: str) -> 'HardAdapterBuilder':
        """设置适配器名称"""
        self._config["name"] = name
        return self
    
    def with_security_policy(self, policy: SecurityPolicy) -> 'HardAdapterBuilder':
        """设置安全策略"""
        self._config["security_policy"] = policy.value
        return self
    
    def with_memory_limit(self, max_memory_mb: float) -> 'HardAdapterBuilder':
        """设置内存限制"""
        self._config["resource_limits"]["max_memory_mb"] = max_memory_mb
        return self
    
    def with_cpu_limit(self, max_cpu_percent: float) -> 'HardAdapterBuilder':
        """设置CPU限制"""
        self._config["resource_limits"]["max_cpu_percent"] = max_cpu_percent
        return self
    
    def with_sandbox(self, enable: bool = True) -> 'HardAdapterBuilder':
        """设置是否启用沙箱"""
        self._config["enable_sandbox"] = enable
        return self
    
    def with_audit(self, enable: bool = True) -> 'HardAdapterBuilder':
        """设置是否启用审计"""
        self._config["enable_audit"] = enable
        return self
    
    def with_temp_directory(self, temp_dir: Union[str, Path]) -> 'HardAdapterBuilder':
        """设置临时目录"""
        self._config["temp_directory"] = str(temp_dir)
        return self
    
    def with_allowed_operations(self, operations: List[OperationType]) -> 'HardAdapterBuilder':
        """设置允许的操作类型"""
        self._config["allowed_operations"] = [op.value for op in operations]
        return self
    
    def with_custom_config(self, **kwargs) -> 'HardAdapterBuilder':
        """添加自定义配置"""
        self._config.update(kwargs)
        return self
    
    def build(self, adapter_class: Type[HardAdapter] = SystemAdapter) -> HardAdapter:
        """构建适配器实例"""
        if "adapter_id" not in self._config:
            self._config["adapter_id"] = f"hard_adapter_{uuid.uuid4().hex[:8]}"
        
        if "name" not in self._config:
            self._config["name"] = f"HardAdapter-{self._config['adapter_id']}"
        
        return adapter_class(self._config)


# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举类
    'OperationType', 'ExecutionMode', 'SecurityPolicy',
    
    # 数据类
    'OperationContext', 'OperationResult', 'ResourceLimits', 'SystemInfo',
    
    # 核心类
    'HardAdapter', 'SystemAdapter',
    
    # 管理器类
    'ResourceManager', 'CommandExecutor',
    
    # 工具类
    'HardAdapterBuilder',
    
    # 工具函数
    'create_hard_adapter_config',
]


# ================================
# 示例使用代码
# ================================

async def example_usage():
    """硬适配器使用示例"""
    print("🔧 Zishu-sensei 硬适配器使用示例")
    print("=" * 50)
    
    try:
        # 1. 使用构建器创建适配器
        print("\n1️⃣ 创建硬适配器实例...")
        adapter = (HardAdapterBuilder()
                  .with_id("example_system_adapter")
                  .with_name("示例系统适配器")
                  .with_security_policy(SecurityPolicy.MODERATE)
                  .with_memory_limit(512)
                  .with_cpu_limit(50)
                  .with_sandbox(True)
                  .build())
        
        print(f"✅ 适配器创建成功: {adapter.adapter_id}")
        
        # 2. 初始化适配器
        print("\n2️⃣ 初始化适配器...")
        success = await adapter.initialize()
        if not success:
            print("❌ 适配器初始化失败")
            return
        
        print("✅ 适配器初始化成功")
        
        # 3. 获取适配器信息
        print("\n3️⃣ 适配器信息:")
        basic_info = adapter.get_basic_info()
        print(f"   ID: {basic_info['adapter_id']}")
        print(f"   名称: {basic_info['name']}")
        print(f"   状态: {basic_info['status']}")
        print(f"   执行次数: {basic_info['execution_count']}")
        
        # 4. 系统信息
        print("\n4️⃣ 系统信息:")
        system_info = adapter.get_system_info()
        if system_info:
            print(f"   平台: {system_info.platform}")
            print(f"   CPU核心数: {system_info.cpu_count}")
            print(f"   总内存: {system_info.memory_total_gb:.1f} GB")
            print(f"   主机名: {system_info.hostname}")
        
        # 5. 执行系统命令
        print("\n5️⃣ 执行系统命令...")
        
        # 获取当前目录内容
        result = await adapter.execute_command("ls -la", timeout_seconds=10)
        if result.success:
            print(f"✅ 命令执行成功 (返回码: {result.return_code})")
            print(f"   输出: {result.stdout[:200]}...")  # 只显示前200个字符
        else:
            print(f"❌ 命令执行失败: {result.error_message}")
        
        # 获取系统信息
        result = await adapter.execute_command("uname -a", timeout_seconds=5)
        if result.success:
            print(f"✅ 系统信息: {result.stdout.strip()}")
        
        # 6. 文件操作示例
        print("\n6️⃣ 文件操作示例...")
        
        # 写入测试文件
        test_file = "/tmp/zishu_test.txt"
        success = await adapter.write_file(test_file, "Hello from Zishu-sensei HardAdapter!\n测试中文内容。")
        if success:
            print(f"✅ 文件写入成功: {test_file}")
            
            # 读取文件内容
            content = await adapter.read_file(test_file)
            print(f"✅ 文件内容: {content.strip()}")
        else:
            print(f"❌ 文件写入失败: {test_file}")
        
        # 7. 资源使用情况
        print("\n7️⃣ 资源使用情况:")
        resource_usage = adapter.get_resource_usage()
        if resource_usage:
            print(f"   内存使用: {resource_usage.get('process_memory_mb', 0):.1f} MB")
            print(f"   CPU使用: {resource_usage.get('process_cpu_percent', 0):.1f}%")
        
        # 8. 操作统计
        print("\n8️⃣ 操作统计:")
        stats = adapter.get_operation_statistics()
        print(f"   总操作数: {stats['total_operations']}")
        print(f"   成功率: {stats['success_rate']:.2%}")
        print(f"   活跃操作: {stats['active_operations_count']}")
        
        # 9. 健康检查
        print("\n9️⃣ 健康检查...")
        health = await adapter.health_check()
        print(f"   健康状态: {health.status}")
        print(f"   是否健康: {'是' if health.is_healthy else '否'}")
        if health.issues:
            print(f"   问题: {', '.join(health.issues)}")
        
        # 10. 清理
        print("\n🔟 清理资源...")
        await adapter.cleanup()
        print("✅ 资源清理完成")
        
    except Exception as e:
        print(f"❌ 示例执行失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n🎉 硬适配器示例执行完成!")


if __name__ == "__main__":
    # 运行示例
    asyncio.run(example_usage())

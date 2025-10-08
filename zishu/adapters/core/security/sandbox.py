"""
沙箱隔离系统
"""

import os
import sys
import ast
import dis
import time
import json
import uuid
import signal
import psutil
import docker
import asyncio
import logging
import threading
import subprocess
import multiprocessing
import tempfile
import shutil
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable, Type
import resource as system_resource
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, TimeoutError
import weakref
import hashlib
import base64

# 第三方安全库
try:
    import seccomp

    SECCOMP_AVAILABLE = True
except ImportError:
    SECCOMP_AVAILABLE = False
    seccomp = None

try:
    import pylxd

    LXD_AVAILABLE = True
except ImportError:
    LXD_AVAILABLE = False
    pylxd = None

# 本地导入
from .security_service import SecurityViolationType, SecurityViolation
from .permissions import EnhancedPermissionManager, AccessRequest, AccessResult
from .audit import (
    AuditLogger,
    AuditEventType,
    AuditSeverity,
    get_audit_logger,
    audit_operation,
)

logger = logging.getLogger(__name__)


class SandboxTier(Enum):
    """沙箱隔离层级"""

    PROCESS = "process"  # 进程级隔离 - 基础安全
    CONTAINER = "container"  # 容器级隔离 - 中等安全
    VIRTUAL_MACHINE = "vm"  # 虚拟机级隔离 - 高级安全
    HARDWARE = "hardware"  # 硬件级隔离 - 最高安全


class IsolationMode(Enum):
    """隔离模式"""

    STRICT = "strict"  # 严格隔离 - 最小权限
    STANDARD = "standard"  # 标准隔离 - 平衡功能与安全
    PERMISSIVE = "permissive"  # 宽松隔离 - 较多权限
    DEVELOPMENT = "development"  # 开发模式 - 调试用途


class SecurityPolicy(Enum):
    """安全策略"""

    ZERO_TRUST = "zero_trust"  # 零信任架构
    DEFENSE_IN_DEPTH = "defense_in_depth"  # 纵深防御
    LEAST_PRIVILEGE = "least_privilege"  # 最小权限原则
    FAIL_SECURE = "fail_secure"  # 安全失败模式


class ThreatLevel(Enum):
    """威胁等级"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ResourceQuota:
    """资源配额"""

    # CPU资源
    cpu_cores: float = 1.0
    cpu_time_limit: float = 30.0  # 秒
    cpu_usage_limit: float = 80.0  # 百分比

    # 内存资源
    memory_limit: int = 128 * 1024 * 1024  # 128MB
    swap_limit: int = 256 * 1024 * 1024  # 256MB

    # 存储资源
    disk_quota: int = 100 * 1024 * 1024  # 100MB
    file_count_limit: int = 1000

    # 网络资源
    network_bandwidth: int = 1024 * 1024  # 1MB/s
    connection_limit: int = 10

    # 进程资源
    process_limit: int = 10
    thread_limit: int = 50
    file_descriptor_limit: int = 100

    # 时间限制
    execution_timeout: float = 60.0  # 秒
    idle_timeout: float = 300.0  # 5分钟

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SandboxConfiguration:
    """沙箱配置"""

    # 基础配置
    name: str = "default_sandbox"
    tier: SandboxTier = SandboxTier.PROCESS
    mode: IsolationMode = IsolationMode.STANDARD
    policy: SecurityPolicy = SecurityPolicy.LEAST_PRIVILEGE

    # 资源配额
    quota: ResourceQuota = field(default_factory=ResourceQuota)

    # 安全设置
    enable_seccomp: bool = True
    enable_apparmor: bool = True
    enable_selinux: bool = False
    enable_static_analysis: bool = True
    enable_runtime_monitoring: bool = True
    enable_network_isolation: bool = True

    # 允许的操作
    allowed_syscalls: Set[str] = field(
        default_factory=lambda: {
            "read",
            "write",
            "open",
            "close",
            "stat",
            "fstat",
            "lstat",
            "poll",
            "lseek",
            "mmap",
            "mprotect",
            "munmap",
            "brk",
            "rt_sigaction",
            "rt_sigprocmask",
            "rt_sigreturn",
            "ioctl",
            "pread64",
            "pwrite64",
            "readv",
            "writev",
            "access",
            "pipe",
            "select",
            "sched_yield",
            "mremap",
            "msync",
            "mincore",
            "madvise",
            "shmget",
            "shmat",
            "shmctl",
            "dup",
            "dup2",
            "pause",
            "nanosleep",
            "getitimer",
            "alarm",
            "setitimer",
            "getpid",
            "sendfile",
            "socket",
            "connect",
            "accept",
            "sendto",
            "recvfrom",
            "sendmsg",
            "recvmsg",
            "shutdown",
            "bind",
            "listen",
            "getsockname",
            "getpeername",
            "socketpair",
            "setsockopt",
            "getsockopt",
            "clone",
            "fork",
            "vfork",
            "execve",
            "exit",
            "wait4",
            "kill",
            "uname",
            "semget",
            "semop",
            "semctl",
            "shmdt",
            "msgget",
            "msgsnd",
            "msgrcv",
            "msgctl",
            "fcntl",
            "flock",
            "fsync",
            "fdatasync",
            "truncate",
            "ftruncate",
            "getdents",
            "getcwd",
            "chdir",
            "fchdir",
            "rename",
            "mkdir",
            "rmdir",
            "creat",
            "link",
            "unlink",
            "symlink",
            "readlink",
            "chmod",
            "fchmod",
            "chown",
            "fchown",
            "lchown",
            "umask",
            "gettimeofday",
            "getrlimit",
            "getrusage",
            "sysinfo",
            "times",
            "ptrace",
            "getuid",
            "syslog",
            "getgid",
            "setuid",
            "setgid",
            "geteuid",
            "getegid",
            "setpgid",
            "getppid",
            "getpgrp",
            "setsid",
            "setreuid",
            "setregid",
            "getgroups",
            "setgroups",
            "setresuid",
            "getresuid",
            "setresgid",
            "getresgid",
            "getpgid",
            "setfsuid",
            "setfsgid",
            "getsid",
            "capget",
            "capset",
            "rt_sigpending",
            "rt_sigtimedwait",
            "rt_sigqueueinfo",
            "rt_sigsuspend",
            "sigaltstack",
            "utime",
            "mknod",
            "uselib",
            "personality",
            "ustat",
            "statfs",
            "fstatfs",
            "sysfs",
            "getpriority",
            "setpriority",
            "sched_setparam",
            "sched_getparam",
            "sched_setscheduler",
            "sched_getscheduler",
            "sched_get_priority_max",
            "sched_get_priority_min",
            "sched_rr_get_interval",
            "mlock",
            "munlock",
            "mlockall",
            "munlockall",
            "vhangup",
            "modify_ldt",
            "pivot_root",
            "_sysctl",
            "prctl",
            "arch_prctl",
            "adjtimex",
            "setrlimit",
            "chroot",
            "sync",
            "acct",
            "settimeofday",
            "mount",
            "umount2",
            "swapon",
            "swapoff",
            "reboot",
            "sethostname",
            "setdomainname",
            "iopl",
            "ioperm",
            "create_module",
            "init_module",
            "delete_module",
            "get_kernel_syms",
            "query_module",
            "quotactl",
            "nfsservctl",
            "getpmsg",
            "putpmsg",
            "afs_syscall",
            "tuxcall",
            "security",
            "gettid",
            "readahead",
            "setxattr",
            "lsetxattr",
            "fsetxattr",
            "getxattr",
            "lgetxattr",
            "fgetxattr",
            "listxattr",
            "llistxattr",
            "flistxattr",
            "removexattr",
            "lremovexattr",
            "fremovexattr",
            "tkill",
            "time",
            "futex",
            "sched_setaffinity",
            "sched_getaffinity",
            "set_thread_area",
            "io_setup",
            "io_destroy",
            "io_getevents",
            "io_submit",
            "io_cancel",
            "get_thread_area",
            "lookup_dcookie",
            "epoll_create",
            "epoll_ctl_old",
            "epoll_wait_old",
            "remap_file_pages",
            "getdents64",
            "set_tid_address",
            "restart_syscall",
            "semtimedop",
            "fadvise64",
            "timer_create",
            "timer_settime",
            "timer_gettime",
            "timer_getoverrun",
            "timer_delete",
            "clock_settime",
            "clock_gettime",
            "clock_getres",
            "clock_nanosleep",
            "exit_group",
            "epoll_wait",
            "epoll_ctl",
            "tgkill",
            "utimes",
            "vserver",
            "mbind",
            "set_mempolicy",
            "get_mempolicy",
            "mq_open",
            "mq_unlink",
            "mq_timedsend",
            "mq_timedreceive",
            "mq_notify",
            "mq_getsetattr",
            "kexec_load",
            "waitid",
            "add_key",
            "request_key",
            "keyctl",
            "ioprio_set",
            "ioprio_get",
            "inotify_init",
            "inotify_add_watch",
            "inotify_rm_watch",
            "migrate_pages",
            "openat",
            "mkdirat",
            "mknodat",
            "fchownat",
            "futimesat",
            "newfstatat",
            "unlinkat",
            "renameat",
            "linkat",
            "symlinkat",
            "readlinkat",
            "fchmodat",
            "faccessat",
            "pselect6",
            "ppoll",
            "unshare",
            "set_robust_list",
            "get_robust_list",
            "splice",
            "tee",
            "sync_file_range",
            "vmsplice",
            "move_pages",
            "utimensat",
            "epoll_pwait",
            "signalfd",
            "timerfd_create",
            "eventfd",
            "fallocate",
            "timerfd_settime",
            "timerfd_gettime",
            "accept4",
            "signalfd4",
            "eventfd2",
            "epoll_create1",
            "dup3",
            "pipe2",
            "inotify_init1",
            "preadv",
            "pwritev",
            "rt_tgsigqueueinfo",
            "perf_event_open",
            "recvmmsg",
            "fanotify_init",
            "fanotify_mark",
            "prlimit64",
            "name_to_handle_at",
            "open_by_handle_at",
            "clock_adjtime",
            "syncfs",
            "sendmmsg",
            "setns",
            "getcpu",
            "process_vm_readv",
            "process_vm_writev",
            "kcmp",
            "finit_module",
            "sched_setattr",
            "sched_getattr",
            "renameat2",
            "seccomp",
            "getrandom",
            "memfd_create",
            "kexec_file_load",
            "bpf",
            "execveat",
            "userfaultfd",
            "membarrier",
            "mlock2",
            "copy_file_range",
            "preadv2",
            "pwritev2",
        }
    )

    forbidden_syscalls: Set[str] = field(
        default_factory=lambda: {
            "ptrace",
            "reboot",
            "swapon",
            "swapoff",
            "mount",
            "umount2",
            "chroot",
            "pivot_root",
            "acct",
            "settimeofday",
            "sethostname",
            "setdomainname",
            "init_module",
            "delete_module",
            "quotactl",
            "nfsservctl",
            "create_module",
            "get_kernel_syms",
            "query_module",
            "afs_syscall",
            "tuxcall",
            "security",
            "iopl",
            "ioperm",
            "kexec_load",
            "kexec_file_load",
            "bpf",
        }
    )

    # 文件系统权限
    allowed_paths: Set[str] = field(
        default_factory=lambda: {
            "/tmp",
            "/var/tmp",
            "/dev/null",
            "/dev/zero",
            "/dev/random",
            "/dev/urandom",
            "/proc/self",
            "/proc/cpuinfo",
            "/proc/meminfo",
        }
    )

    forbidden_paths: Set[str] = field(
        default_factory=lambda: {
            "/etc/passwd",
            "/etc/shadow",
            "/etc/hosts",
            "/root",
            "/var/log",
            "/var/run",
            "/var/lib",
            "/usr/bin",
            "/usr/sbin",
            "/sbin",
            "/bin",
            "/boot",
            "/dev/mem",
            "/dev/kmem",
            "/dev/port",
        }
    )

    # 网络权限
    allowed_hosts: Set[str] = field(default_factory=set)
    forbidden_hosts: Set[str] = field(
        default_factory=lambda: {"127.0.0.1", "localhost", "0.0.0.0", "::1"}
    )

    allowed_ports: Set[int] = field(default_factory=lambda: {80, 443, 8080, 8443})
    forbidden_ports: Set[int] = field(
        default_factory=lambda: {22, 23, 25, 53, 110, 143, 993, 995}
    )

    # 容器配置（如果使用容器隔离）
    container_image: str = "python:3.9-alpine"
    container_registry: str = "docker.io"
    container_network_mode: str = "none"  # 网络隔离
    container_readonly_rootfs: bool = True

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        # 处理枚举类型
        data["tier"] = self.tier.value
        data["mode"] = self.mode.value
        data["policy"] = self.policy.value
        # 处理集合类型
        for key, value in data.items():
            if isinstance(value, set):
                data[key] = list(value)
        return data


@dataclass
class ExecutionEnvironment:
    """执行环境"""

    sandbox_id: str
    config: SandboxConfiguration
    working_directory: Path
    temp_directory: Path
    log_directory: Path

    # 运行时状态
    process_id: Optional[int] = None
    container_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    # 资源使用统计
    cpu_usage: float = 0.0
    memory_usage: int = 0
    disk_usage: int = 0
    network_usage: int = 0

    # 环境变量
    environment_variables: Dict[str, str] = field(default_factory=dict)

    def is_active(self) -> bool:
        """检查环境是否活跃"""
        return self.start_time is not None and self.end_time is None


@dataclass
class ExecutionResult:
    """执行结果"""

    success: bool
    exit_code: int
    stdout: str
    stderr: str
    execution_time: float
    resource_usage: Dict[str, Any]
    security_violations: List[SecurityViolation] = field(default_factory=list)
    threat_level: ThreatLevel = ThreatLevel.LOW
    environment: Optional[ExecutionEnvironment] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "exit_code": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "execution_time": self.execution_time,
            "resource_usage": self.resource_usage,
            "security_violations": [v.to_dict() for v in self.security_violations],
            "threat_level": self.threat_level.value,
            "environment_id": self.environment.sandbox_id if self.environment else None,
        }


class CodeAnalyzer:
    """代码安全分析器"""

    def __init__(self):
        self.dangerous_imports = {
            "os",
            "sys",
            "subprocess",
            "shutil",
            "socket",
            "urllib",
            "requests",
            "http",
            "ftplib",
            "smtplib",
            "telnetlib",
            "xmlrpc",
            "pickle",
            "shelve",
            "marshal",
            "dill",
            "ctypes",
            "cffi",
            "cython",
            "__builtin__",
            "builtins",
            "importlib",
            "imp",
            "types",
            "code",
            "codeop",
        }

        self.dangerous_builtins = {
            "eval",
            "exec",
            "compile",
            "__import__",
            "open",
            "input",
            "raw_input",
            "file",
            "execfile",
            "reload",
            "vars",
            "dir",
            "globals",
            "locals",
            "delattr",
            "getattr",
            "setattr",
            "hasattr",
        }

        self.dangerous_attributes = {
            "__class__",
            "__bases__",
            "__subclasses__",
            "__mro__",
            "__globals__",
            "__code__",
            "__closure__",
            "__defaults__",
            "__dict__",
            "__getattribute__",
            "__setattr__",
            "__delattr__",
        }

    async def analyze_code(self, code: str) -> Tuple[bool, List[str], ThreatLevel]:
        """分析代码安全性"""
        threats = []
        threat_level = ThreatLevel.LOW

        try:
            # 解析AST
            tree = ast.parse(code)

            # 检查导入
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    threat_found, threat_msg = self._check_imports(node)
                    if threat_found:
                        threats.append(threat_msg)
                        threat_level = max(threat_level, ThreatLevel.MEDIUM)

                elif isinstance(node, ast.Call):
                    threat_found, threat_msg = self._check_function_calls(node)
                    if threat_found:
                        threats.append(threat_msg)
                        threat_level = max(threat_level, ThreatLevel.HIGH)

                elif isinstance(node, ast.Attribute):
                    threat_found, threat_msg = self._check_attributes(node)
                    if threat_found:
                        threats.append(threat_msg)
                        threat_level = max(threat_level, ThreatLevel.MEDIUM)

            # 检查字符串中的潜在威胁
            threat_found, threat_msg = self._check_string_threats(code)
            if threat_found:
                threats.extend(threat_msg)
                threat_level = max(threat_level, ThreatLevel.MEDIUM)

            is_safe = len(threats) == 0
            return is_safe, threats, threat_level

        except SyntaxError as e:
            threats.append(f"Syntax error in code: {e}")
            return False, threats, ThreatLevel.HIGH

        except Exception as e:
            threats.append(f"Code analysis failed: {e}")
            return False, threats, ThreatLevel.HIGH

    def _check_imports(self, node: ast.AST) -> Tuple[bool, str]:
        """检查导入威胁"""
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in self.dangerous_imports:
                    return True, f"Dangerous import detected: {alias.name}"

        elif isinstance(node, ast.ImportFrom):
            if node.module and node.module in self.dangerous_imports:
                return True, f"Dangerous import detected: from {node.module}"

        return False, ""

    def _check_function_calls(self, node: ast.Call) -> Tuple[bool, str]:
        """检查函数调用威胁"""
        if isinstance(node.func, ast.Name):
            if node.func.id in self.dangerous_builtins:
                return True, f"Dangerous builtin function: {node.func.id}"

        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in ["system", "popen", "spawn", "exec"]:
                return True, f"Dangerous method call: {node.func.attr}"

        return False, ""

    def _check_attributes(self, node: ast.Attribute) -> Tuple[bool, str]:
        """检查属性访问威胁"""
        if node.attr in self.dangerous_attributes:
            return True, f"Dangerous attribute access: {node.attr}"

        return False, ""

    def _check_string_threats(self, code: str) -> Tuple[bool, List[str]]:
        """检查字符串中的威胁"""
        threats = []

        # 检查潜在的命令注入
        dangerous_patterns = [
            r"os\.system\s*\(",
            r"subprocess\.",
            r"eval\s*\(",
            r"exec\s*\(",
            r"__import__\s*\(",
            r"open\s*\(",
            r"file\s*\(",
            r"input\s*\(",
            r"raw_input\s*\(",
        ]

        import re

        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                threats.append(f"Suspicious pattern detected: {pattern}")

        return len(threats) > 0, threats


class ResourceMonitor:
    """资源监控器"""

    def __init__(self, config: SandboxConfiguration):
        self.config = config
        self.quota = config.quota
        self.monitoring = False
        self.violations = []

    async def start_monitoring(self, pid: int) -> None:
        """开始监控进程资源使用"""
        self.monitoring = True

        try:
            process = psutil.Process(pid)
            start_time = time.time()

            while self.monitoring:
                current_time = time.time()
                elapsed_time = current_time - start_time

                # 检查执行时间超限
                if elapsed_time > self.quota.execution_timeout:
                    self.violations.append(
                        SecurityViolation(
                            violation_type=SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                            severity=AuditSeverity.HIGH,
                            message=f"Execution timeout exceeded: {elapsed_time:.2f}s",
                        )
                    )
                    await self._terminate_process(process)
                    break

                # 检查CPU使用率
                cpu_percent = process.cpu_percent()
                if cpu_percent > self.quota.cpu_usage_limit:
                    self.violations.append(
                        SecurityViolation(
                            violation_type=SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                            severity=AuditSeverity.MEDIUM,
                            message=f"CPU usage exceeded: {cpu_percent:.2f}%",
                        )
                    )

                # 检查内存使用
                memory_info = process.memory_info()
                if memory_info.rss > self.quota.memory_limit:
                    self.violations.append(
                        SecurityViolation(
                            violation_type=SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                            severity=AuditSeverity.HIGH,
                            message=f"Memory limit exceeded: {memory_info.rss} bytes",
                        )
                    )
                    await self._terminate_process(process)
                    break

                # 检查文件描述符数量
                try:
                    num_fds = process.num_fds()
                    if num_fds > self.quota.file_descriptor_limit:
                        self.violations.append(
                            SecurityViolation(
                                violation_type=SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                                severity=AuditSeverity.MEDIUM,
                                message=f"File descriptor limit exceeded: {num_fds}",
                            )
                        )
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    pass

                await asyncio.sleep(0.1)  # 监控频率：10Hz

        except psutil.NoSuchProcess:
            # 进程已结束
            pass
        except Exception as e:
            logger.error(f"Resource monitoring error: {e}")
        finally:
            self.monitoring = False

    async def _terminate_process(self, process: psutil.Process) -> None:
        """终止进程"""
        try:
            process.terminate()
            await asyncio.sleep(1)
            if process.is_running():
                process.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    def stop_monitoring(self) -> None:
        """停止监控"""
        self.monitoring = False

    def get_violations(self) -> List[SecurityViolation]:
        """获取违规记录"""
        return self.violations.copy()


class SandboxExecutor(ABC):
    """沙箱执行器抽象基类"""

    def __init__(self, config: SandboxConfiguration):
        self.config = config
        self.permission_manager = PermissionManager()
        self.audit_logger = get_audit_logger()
        self.code_analyzer = CodeAnalyzer()

    @abstractmethod
    async def execute(
        self,
        code: str,
        environment: ExecutionEnvironment,
        user_id: Optional[str] = None,
    ) -> ExecutionResult:
        """执行代码"""
        pass

    @abstractmethod
    async def cleanup(self, environment: ExecutionEnvironment) -> None:
        """清理执行环境"""
        pass

    async def _pre_execution_checks(
        self,
        code: str,
        environment: ExecutionEnvironment,
        user_id: Optional[str] = None,
    ) -> Tuple[bool, List[str], ThreatLevel]:
        """执行前检查"""
        # 代码安全分析
        is_safe, threats, threat_level = await self.code_analyzer.analyze_code(code)

        # 权限检查
        if user_id:
            # TODO: 实现用户权限检查逻辑
            pass

        # 记录审计日志
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SECURITY_CHECK,
                f"Pre-execution security check for sandbox {environment.sandbox_id}",
                user_id=user_id,
                component="enhanced_sandbox",
                details={
                    "is_safe": is_safe,
                    "threat_count": len(threats),
                    "threat_level": threat_level.value,
                    "sandbox_config": environment.config.name,
                },
            )

        return is_safe, threats, threat_level

    async def _post_execution_analysis(
        self, result: ExecutionResult, environment: ExecutionEnvironment
    ) -> None:
        """执行后分析"""
        # 记录执行结果
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.CODE_EXECUTION,
                f"Code execution completed in sandbox {environment.sandbox_id}",
                component="enhanced_sandbox",
                details={
                    "success": result.success,
                    "exit_code": result.exit_code,
                    "execution_time": result.execution_time,
                    "violations_count": len(result.security_violations),
                    "threat_level": result.threat_level.value,
                    "resource_usage": result.resource_usage,
                },
            )


class ProcessSandboxExecutor(SandboxExecutor):
    """进程级沙箱执行器"""

    def __init__(self, config: SandboxConfiguration):
        super().__init__(config)
        self.active_processes = weakref.WeakSet()

    async def execute(
        self,
        code: str,
        environment: ExecutionEnvironment,
        user_id: Optional[str] = None,
    ) -> ExecutionResult:
        """在进程沙箱中执行代码"""
        start_time = time.time()
        resource_monitor = ResourceMonitor(self.config)

        try:
            # 执行前检查
            is_safe, threats, threat_level = await self._pre_execution_checks(
                code, environment, user_id
            )

            if not is_safe and self.config.mode != IsolationMode.DEVELOPMENT:
                return ExecutionResult(
                    success=False,
                    exit_code=-1,
                    stdout="",
                    stderr=f"Security check failed: {'; '.join(threats)}",
                    execution_time=time.time() - start_time,
                    resource_usage={},
                    security_violations=[
                        SecurityViolation(
                            violation_type=SecurityViolationType.MALICIOUS_CODE,
                            severity=AuditSeverity.HIGH,
                            message=threat,
                        )
                        for threat in threats
                    ],
                    threat_level=threat_level,
                    environment=environment,
                )

            # 创建临时执行文件
            script_path = environment.temp_directory / f"script_{uuid.uuid4().hex}.py"
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)

            # 设置资源限制
            def set_limits():
                # CPU时间限制
                system_resource.setrlimit(
                    system_resource.RLIMIT_CPU,
                    (
                        int(self.config.quota.cpu_time_limit),
                        int(self.config.quota.cpu_time_limit),
                    ),
                )

                # 内存限制
                system_resource.setrlimit(
                    system_resource.RLIMIT_AS,
                    (self.config.quota.memory_limit, self.config.quota.memory_limit),
                )

                # 文件大小限制
                system_resource.setrlimit(
                    system_resource.RLIMIT_FSIZE,
                    (self.config.quota.disk_quota, self.config.quota.disk_quota),
                )

                # 进程数限制
                system_resource.setrlimit(
                    system_resource.RLIMIT_NPROC,
                    (self.config.quota.process_limit, self.config.quota.process_limit),
                )

                # 文件描述符限制
                system_resource.setrlimit(
                    system_resource.RLIMIT_NOFILE,
                    (
                        self.config.quota.file_descriptor_limit,
                        self.config.quota.file_descriptor_limit,
                    ),
                )

            # 启动执行进程
            process = subprocess.Popen(
                [sys.executable, str(script_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(environment.working_directory),
                env=environment.environment_variables,
                preexec_fn=set_limits,
                text=True,
            )

            environment.process_id = process.pid
            environment.start_time = datetime.now(timezone.utc)
            self.active_processes.add(process)

            # 启动资源监控
            monitor_task = asyncio.create_task(
                resource_monitor.start_monitoring(process.pid)
            )

            try:
                # 等待执行完成
                stdout, stderr = process.communicate(
                    timeout=self.config.quota.execution_timeout
                )
                exit_code = process.returncode

            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                exit_code = -9  # SIGKILL

                resource_monitor.violations.append(
                    SecurityViolation(
                        violation_type=SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                        severity=AuditSeverity.HIGH,
                        message="Execution timeout exceeded",
                    )
                )

            finally:
                resource_monitor.stop_monitoring()
                try:
                    await monitor_task
                except:
                    pass
                environment.end_time = datetime.now(timezone.utc)

            # 收集资源使用信息
            execution_time = time.time() - start_time
            resource_usage = {
                "execution_time": execution_time,
                "exit_code": exit_code,
                "violations": len(resource_monitor.violations),
            }

            # 更新威胁等级
            if resource_monitor.violations:
                threat_level = max(threat_level, ThreatLevel.MEDIUM)

            result = ExecutionResult(
                success=exit_code == 0 and len(resource_monitor.violations) == 0,
                exit_code=exit_code,
                stdout=stdout,
                stderr=stderr,
                execution_time=execution_time,
                resource_usage=resource_usage,
                security_violations=resource_monitor.violations,
                threat_level=threat_level,
                environment=environment,
            )

            # 执行后分析
            await self._post_execution_analysis(result, environment)

            return result

        except Exception as e:
            logger.error(f"Process sandbox execution failed: {e}")
            return ExecutionResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Execution failed: {str(e)}",
                execution_time=time.time() - start_time,
                resource_usage={},
                security_violations=[
                    SecurityViolation(
                        violation_type=SecurityViolationType.SYSTEM_CALL_DENIED,
                        severity=AuditSeverity.HIGH,
                        message=f"Execution error: {str(e)}",
                    )
                ],
                threat_level=ThreatLevel.HIGH,
                environment=environment,
            )

        finally:
            # 清理临时文件
            try:
                if "script_path" in locals():
                    script_path.unlink(missing_ok=True)
            except:
                pass

    async def cleanup(self, environment: ExecutionEnvironment) -> None:
        """清理执行环境"""
        try:
            # 终止所有活跃进程
            for process in list(self.active_processes):
                try:
                    if process.poll() is None:  # 进程仍在运行
                        process.terminate()
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            process.kill()
                except:
                    pass

            # 清理临时目录
            if environment.temp_directory.exists():
                shutil.rmtree(environment.temp_directory, ignore_errors=True)

        except Exception as e:
            logger.error(
                f"Cleanup failed for environment {environment.sandbox_id}: {e}"
            )


class EnhancedSandboxManager:
    """增强型沙箱管理器"""

    def __init__(self):
        self.configurations: Dict[str, SandboxConfiguration] = {}
        self.executors: Dict[SandboxTier, SandboxExecutor] = {}
        self.active_environments: Dict[str, ExecutionEnvironment] = {}
        self.audit_logger = get_audit_logger()

        # 注册执行器
        self._register_executors()

        # 统计信息
        self.stats = {
            "total_executions": 0,
            "successful_executions": 0,
            "blocked_executions": 0,
            "security_violations": 0,
            "active_environments": 0,
        }

    def _register_executors(self) -> None:
        """注册沙箱执行器"""
        # 默认只注册进程级执行器
        default_config = SandboxConfiguration()
        self.executors[SandboxTier.PROCESS] = ProcessSandboxExecutor(default_config)

        # TODO: 根据系统能力注册其他执行器
        # if DOCKER_AVAILABLE:
        #     self.executors[SandboxTier.CONTAINER] = ContainerSandboxExecutor(default_config)
        # if LXD_AVAILABLE:
        #     self.executors[SandboxTier.VIRTUAL_MACHINE] = VMSandboxExecutor(default_config)

    def register_configuration(self, name: str, config: SandboxConfiguration) -> None:
        """注册沙箱配置"""
        self.configurations[name] = config
        logger.info(f"Registered sandbox configuration: {name}")

    def get_configuration(self, name: str) -> Optional[SandboxConfiguration]:
        """获取沙箱配置"""
        return self.configurations.get(name)

    async def create_environment(
        self,
        config_name: str = "default",
        custom_config: Optional[SandboxConfiguration] = None,
    ) -> ExecutionEnvironment:
        """创建执行环境"""
        if custom_config:
            config = custom_config
        else:
            config = self.configurations.get(config_name)
            if not config:
                # 使用默认配置
                config = SandboxConfiguration(name=config_name)

        # 生成唯一ID
        sandbox_id = f"sandbox_{uuid.uuid4().hex[:8]}"

        # 创建工作目录
        base_dir = Path(tempfile.gettempdir()) / "zishu_sandbox" / sandbox_id
        base_dir.mkdir(parents=True, exist_ok=True)

        working_dir = base_dir / "workspace"
        working_dir.mkdir(exist_ok=True)

        temp_dir = base_dir / "temp"
        temp_dir.mkdir(exist_ok=True)

        log_dir = base_dir / "logs"
        log_dir.mkdir(exist_ok=True)

        # 创建执行环境
        environment = ExecutionEnvironment(
            sandbox_id=sandbox_id,
            config=config,
            working_directory=working_dir,
            temp_directory=temp_dir,
            log_directory=log_dir,
            environment_variables={
                "PYTHONPATH": str(working_dir),
                "TMPDIR": str(temp_dir),
                "HOME": str(working_dir),
                "USER": "sandbox",
            },
        )

        self.active_environments[sandbox_id] = environment
        self.stats["active_environments"] = len(self.active_environments)

        # 记录审计日志
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SYSTEM_CHANGE,
                f"Created sandbox environment: {sandbox_id}",
                component="enhanced_sandbox",
                details={
                    "sandbox_id": sandbox_id,
                    "config_name": config.name,
                    "tier": config.tier.value,
                    "mode": config.mode.value,
                },
            )

        logger.info(f"Created sandbox environment: {sandbox_id}")
        return environment

    async def execute_code(
        self,
        code: str,
        environment: ExecutionEnvironment,
        user_id: Optional[str] = None,
    ) -> ExecutionResult:
        """在沙箱环境中执行代码"""
        self.stats["total_executions"] += 1

        try:
            # 获取对应的执行器
            executor = self.executors.get(environment.config.tier)
            if not executor:
                raise ValueError(
                    f"No executor available for tier: {environment.config.tier}"
                )

            # 执行代码
            result = await executor.execute(code, environment, user_id)

            # 更新统计信息
            if result.success:
                self.stats["successful_executions"] += 1
            else:
                self.stats["blocked_executions"] += 1

            if result.security_violations:
                self.stats["security_violations"] += len(result.security_violations)

            return result

        except Exception as e:
            logger.error(
                f"Code execution failed in sandbox {environment.sandbox_id}: {e}"
            )
            self.stats["blocked_executions"] += 1

            return ExecutionResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Sandbox execution failed: {str(e)}",
                execution_time=0.0,
                resource_usage={},
                security_violations=[
                    SecurityViolation(
                        violation_type=SecurityViolationType.SYSTEM_CALL_DENIED,
                        severity=AuditSeverity.CRITICAL,
                        message=f"Sandbox failure: {str(e)}",
                    )
                ],
                threat_level=ThreatLevel.CRITICAL,
                environment=environment,
            )

    async def destroy_environment(self, sandbox_id: str) -> bool:
        """销毁执行环境"""
        environment = self.active_environments.get(sandbox_id)
        if not environment:
            return False

        try:
            # 获取执行器并清理
            executor = self.executors.get(environment.config.tier)
            if executor:
                await executor.cleanup(environment)

            # 移除环境记录
            del self.active_environments[sandbox_id]
            self.stats["active_environments"] = len(self.active_environments)

            # 记录审计日志
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.SYSTEM_CHANGE,
                    f"Destroyed sandbox environment: {sandbox_id}",
                    component="enhanced_sandbox",
                    details={"sandbox_id": sandbox_id},
                )

            logger.info(f"Destroyed sandbox environment: {sandbox_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to destroy environment {sandbox_id}: {e}")
            return False

    async def cleanup_all(self) -> None:
        """清理所有环境"""
        for sandbox_id in list(self.active_environments.keys()):
            await self.destroy_environment(sandbox_id)

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.stats.copy()

    def list_active_environments(self) -> List[str]:
        """列出活跃环境"""
        return list(self.active_environments.keys())


# 默认沙箱管理器实例
_default_sandbox_manager = None


def get_sandbox_manager() -> EnhancedSandboxManager:
    """获取默认沙箱管理器"""
    global _default_sandbox_manager
    if _default_sandbox_manager is None:
        _default_sandbox_manager = EnhancedSandboxManager()
    return _default_sandbox_manager


# 便捷函数
async def execute_in_sandbox(
    code: str,
    config_name: str = "default",
    user_id: Optional[str] = None,
    custom_config: Optional[SandboxConfiguration] = None,
) -> ExecutionResult:
    """在沙箱中执行代码的便捷函数"""
    manager = get_sandbox_manager()

    # 创建环境
    environment = await manager.create_environment(config_name, custom_config)

    try:
        # 执行代码
        result = await manager.execute_code(code, environment, user_id)
        return result
    finally:
        # 清理环境
        await manager.destroy_environment(environment.sandbox_id)


# 预定义配置
SANDBOX_CONFIGS = {
    "strict": SandboxConfiguration(
        name="strict",
        tier=SandboxTier.PROCESS,
        mode=IsolationMode.STRICT,
        policy=SecurityPolicy.ZERO_TRUST,
        quota=ResourceQuota(
            cpu_time_limit=10.0,
            memory_limit=64 * 1024 * 1024,  # 64MB
            execution_timeout=30.0,
        ),
    ),
    "standard": SandboxConfiguration(
        name="standard",
        tier=SandboxTier.PROCESS,
        mode=IsolationMode.STANDARD,
        policy=SecurityPolicy.LEAST_PRIVILEGE,
        quota=ResourceQuota(
            cpu_time_limit=30.0,
            memory_limit=128 * 1024 * 1024,  # 128MB
            execution_timeout=60.0,
        ),
    ),
    "development": SandboxConfiguration(
        name="development",
        tier=SandboxTier.PROCESS,
        mode=IsolationMode.DEVELOPMENT,
        policy=SecurityPolicy.FAIL_SECURE,
        quota=ResourceQuota(
            cpu_time_limit=60.0,
            memory_limit=256 * 1024 * 1024,  # 256MB
            execution_timeout=300.0,
        ),
    ),
}


# 初始化默认配置
def initialize_default_configs():
    """初始化默认配置"""
    manager = get_sandbox_manager()
    for name, config in SANDBOX_CONFIGS.items():
        manager.register_configuration(name, config)


# 自动初始化
initialize_default_configs()

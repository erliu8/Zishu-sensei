#!/usr/bin/env python3
"""
系统API适配器 (System API Adapter)
"""

import asyncio
import json
import os
import platform
import psutil
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
from enum import Enum

# 导入基础适配器和相关类型
from ..base.adapter import BaseAdapter
from ..base.types import (
    AdapterMetadata, AdapterCapability, CapabilityLevel, AdapterType,
    ExecutionContext, AdapterResult, AdapterStatus
)
from ..base.exceptions import (
    AdapterExecutionError, AdapterSecurityError, AdapterValidationError
)


class SystemOperation(Enum):
    """系统操作类型枚举"""
    # 进程管理
    PROCESS_LIST = "process_list"
    PROCESS_INFO = "process_info"
    PROCESS_KILL = "process_kill"
    PROCESS_START = "process_start"
    
    # 系统信息
    SYSTEM_INFO = "system_info"
    CPU_INFO = "cpu_info"
    MEMORY_INFO = "memory_info"
    DISK_INFO = "disk_info"
    NETWORK_INFO = "network_info"
    
    # 环境变量
    ENV_GET = "env_get"
    ENV_SET = "env_set"
    ENV_LIST = "env_list"
    ENV_DELETE = "env_delete"
    
    # 服务管理
    SERVICE_STATUS = "service_status"
    SERVICE_START = "service_start"
    SERVICE_STOP = "service_stop"
    SERVICE_RESTART = "service_restart"
    
    # 系统命令
    COMMAND_EXEC = "command_exec"
    SHELL_EXEC = "shell_exec"
    
    # 系统资源
    RESOURCE_MONITOR = "resource_monitor"
    PERFORMANCE_STATS = "performance_stats"


@dataclass
class SystemRequest:
    """系统操作请求数据结构"""
    operation: SystemOperation
    parameters: Dict[str, Any] = None
    timeout: int = 30
    safe_mode: bool = True
    
    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}


@dataclass
class SystemSafetyConfig:
    """系统适配器安全配置"""
    # 命令执行安全
    allowed_commands: List[str] = None
    forbidden_commands: List[str] = None
    max_execution_time: int = 300  # 5分钟
    
    # 进程管理安全
    protected_processes: List[str] = None
    allow_process_kill: bool = False
    allow_system_processes: bool = False
    
    # 环境变量安全
    protected_env_vars: List[str] = None
    allow_env_modification: bool = False
    
    # 服务管理安全
    allowed_services: List[str] = None
    allow_service_control: bool = False
    
    # 资源限制
    max_cpu_threshold: float = 90.0
    max_memory_threshold: float = 90.0
    
    def __post_init__(self):
        if self.allowed_commands is None:
            self.allowed_commands = ['ps', 'top', 'df', 'free', 'uptime', 'whoami', 'id', 'uname']
        
        if self.forbidden_commands is None:
            self.forbidden_commands = [
                'rm', 'rmdir', 'del', 'format', 'fdisk', 'mkfs',
                'shutdown', 'reboot', 'halt', 'poweroff',
                'passwd', 'sudo', 'su', 'chmod', 'chown',
                'iptables', 'firewall-cmd', 'ufw'
            ]
        
        if self.protected_processes is None:
            self.protected_processes = [
                'init', 'kernel', 'systemd', 'kthreadd',
                'ssh', 'sshd', 'NetworkManager', 'dbus'
            ]
        
        if self.protected_env_vars is None:
            self.protected_env_vars = [
                'PATH', 'HOME', 'USER', 'SHELL', 'TERM',
                'LD_LIBRARY_PATH', 'PYTHONPATH'
            ]
        
        if self.allowed_services is None:
            self.allowed_services = []


class SystemAdapter(BaseAdapter):
    """
    系统API适配器
    
    提供安全的系统级操作能力，包括进程管理、系统信息获取、
    环境变量操作、服务管理等功能。
    
    特性：
    - 全面的系统信息获取
    - 安全的进程和服务管理
    - 灵活的命令执行能力
    - 实时资源监控
    - 严格的安全控制
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化系统适配器
        
        Args:
            config: 适配器配置，包含安全配置等
        """
        super().__init__(config)
        
        # 加载安全配置
        safety_config_dict = config.get('safety_config', {})
        self.safety_config = SystemSafetyConfig(**safety_config_dict)
        
        # 系统信息缓存
        self._system_info_cache: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, datetime] = {}
        self._cache_duration = 60  # 缓存60秒
        
        # 性能监控
        self._monitoring_active = False
        self._monitoring_task: Optional[asyncio.Task] = None
        
        self.logger.info(f"SystemAdapter initialized with safety config: {self.safety_config}")
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载系统适配器元数据"""
        capabilities = [
            # 进程管理能力
            AdapterCapability(
                name="process_management",
                description="进程列表查看、进程信息获取、进程管理",
                level=CapabilityLevel.ADVANCED,
                inputs=["process_name", "process_id", "command"],
                outputs=["process_list", "process_info", "execution_result"],
                dependencies=["psutil"]
            ),
            
            # 系统信息能力
            AdapterCapability(
                name="system_information",
                description="系统信息、硬件信息、资源使用情况获取",
                level=CapabilityLevel.INTERMEDIATE,
                inputs=["info_type"],
                outputs=["system_info", "hardware_info", "resource_stats"],
                dependencies=["psutil", "platform"]
            ),
            
            # 环境变量能力
            AdapterCapability(
                name="environment_management",
                description="环境变量查看、设置、删除",
                level=CapabilityLevel.BASIC,
                inputs=["variable_name", "variable_value"],
                outputs=["environment_info", "operation_result"],
                dependencies=["os"]
            ),
            
            # 服务管理能力
            AdapterCapability(
                name="service_management",
                description="系统服务状态查看和控制",
                level=CapabilityLevel.EXPERT,
                inputs=["service_name", "action"],
                outputs=["service_status", "control_result"],
                dependencies=["subprocess", "systemctl"]
            ),
            
            # 命令执行能力
            AdapterCapability(
                name="command_execution",
                description="安全的系统命令执行",
                level=CapabilityLevel.EXPERT,
                inputs=["command", "arguments", "working_directory"],
                outputs=["command_output", "exit_code", "execution_time"],
                dependencies=["subprocess"]
            ),
            
            # 资源监控能力
            AdapterCapability(
                name="resource_monitoring",
                description="实时系统资源监控和性能统计",
                level=CapabilityLevel.ADVANCED,
                inputs=["monitor_duration", "sample_interval"],
                outputs=["resource_metrics", "performance_stats"],
                dependencies=["psutil", "asyncio"]
            )
        ]
        
        return AdapterMetadata(
            id="system_adapter",
            name="系统API适配器",
            version="1.0.0",
            author="Zishu AI Assistant",
            description="提供安全的系统级操作能力，包括进程管理、系统信息获取、环境变量操作、服务管理等",
            category="system",
            tags=["system", "process", "service", "monitoring", "command"],
            adapter_type=AdapterType.HARD,
            capabilities=capabilities,
            requirements={
                "python_version": ">=3.8",
                "dependencies": ["psutil>=5.8.0"],
                "system_requirements": ["Linux/Windows/macOS"],
                "permissions": ["system_info", "process_management"]
            },
            permissions={
                "read_system_info": True,
                "process_management": False,  # 默认禁用
                "service_control": False,     # 默认禁用
                "command_execution": False,   # 默认禁用
                "env_modification": False     # 默认禁用
            }
        )
    
    async def _initialize_impl(self) -> bool:
        """初始化系统适配器"""
        try:
            # 检查必要的依赖
            try:
                import psutil
                self.logger.info(f"psutil version: {psutil.__version__}")
            except ImportError:
                raise AdapterExecutionError(
                    "psutil is required but not installed",
                    adapter_id=self.adapter_id,
                    context={"missing_dependency": "psutil"}
                )
            
            # 初始化系统信息缓存
            await self._refresh_system_info()
            
            # 验证系统兼容性
            system_platform = platform.system()
            if system_platform not in ['Linux', 'Windows', 'Darwin']:
                self.logger.warning(f"Unsupported platform: {system_platform}")
            
            self.logger.info("System adapter initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize system adapter: {e}")
            raise AdapterExecutionError(
                f"System adapter initialization failed: {e}",
                adapter_id=self.adapter_id,
                context={"error": str(e)}
            )
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理系统操作请求"""
        if isinstance(input_data, dict):
            request = SystemRequest(**input_data)
        elif isinstance(input_data, SystemRequest):
            request = input_data
        else:
            raise AdapterValidationError(
                f"Invalid input data type: {type(input_data)}",
                adapter_id=self.adapter_id,
                context={"input_type": str(type(input_data))}
            )
        
        # 安全检查
        self._validate_security(request, context)
        
        # 执行操作
        try:
            result = await self._execute_operation(request, context)
            
            return AdapterResult(
                success=True,
                output=result,
                metadata={
                    "operation": request.operation.value,
                    "execution_time": time.time() - context.start_time,
                    "safe_mode": request.safe_mode
                }
            )
            
        except Exception as e:
            self.logger.error(f"Operation failed: {e}")
            raise AdapterExecutionError(
                f"System operation failed: {e}",
                adapter_id=self.adapter_id,
                context={
                    "operation": request.operation.value,
                    "parameters": request.parameters,
                    "error": str(e)
                }
            )
    
    def _validate_security(self, request: SystemRequest, context: ExecutionContext) -> None:
        """验证操作安全性"""
        operation = request.operation
        params = request.parameters
        
        # 检查危险操作
        if operation in [SystemOperation.PROCESS_KILL, SystemOperation.COMMAND_EXEC, 
                        SystemOperation.SHELL_EXEC] and request.safe_mode:
            if not self.safety_config.allow_process_kill:
                raise AdapterSecurityError(
                    f"Operation {operation.value} is not allowed in safe mode",
                    adapter_id=self.adapter_id,
                    context={"operation": operation.value, "safe_mode": True}
                )
        
        # 检查命令执行安全
        if operation in [SystemOperation.COMMAND_EXEC, SystemOperation.SHELL_EXEC]:
            command = params.get('command', '')
            if any(forbidden in command.lower() for forbidden in self.safety_config.forbidden_commands):
                raise AdapterSecurityError(
                    f"Command contains forbidden keywords: {command}",
                    adapter_id=self.adapter_id,
                    context={"command": command, "forbidden_commands": self.safety_config.forbidden_commands}
                )
        
        # 检查进程管理安全
        if operation == SystemOperation.PROCESS_KILL:
            process_name = params.get('process_name', '')
            if any(protected in process_name.lower() for protected in self.safety_config.protected_processes):
                raise AdapterSecurityError(
                    f"Cannot kill protected process: {process_name}",
                    adapter_id=self.adapter_id,
                    context={"process_name": process_name, "protected_processes": self.safety_config.protected_processes}
                )
        
        # 检查环境变量安全
        if operation in [SystemOperation.ENV_SET, SystemOperation.ENV_DELETE]:
            var_name = params.get('variable_name', '')
            if var_name in self.safety_config.protected_env_vars:
                raise AdapterSecurityError(
                    f"Cannot modify protected environment variable: {var_name}",
                    adapter_id=self.adapter_id,
                    context={"variable_name": var_name, "protected_vars": self.safety_config.protected_env_vars}
                )
    
    async def _execute_operation(self, request: SystemRequest, context: ExecutionContext) -> Dict[str, Any]:
        """执行具体的系统操作"""
        operation = request.operation
        params = request.parameters
        
        # 进程管理操作
        if operation == SystemOperation.PROCESS_LIST:
            return await self._get_process_list(params)
        elif operation == SystemOperation.PROCESS_INFO:
            return await self._get_process_info(params)
        elif operation == SystemOperation.PROCESS_KILL:
            return await self._kill_process(params)
        elif operation == SystemOperation.PROCESS_START:
            return await self._start_process(params)
        
        # 系统信息操作
        elif operation == SystemOperation.SYSTEM_INFO:
            return await self._get_system_info(params)
        elif operation == SystemOperation.CPU_INFO:
            return await self._get_cpu_info(params)
        elif operation == SystemOperation.MEMORY_INFO:
            return await self._get_memory_info(params)
        elif operation == SystemOperation.DISK_INFO:
            return await self._get_disk_info(params)
        elif operation == SystemOperation.NETWORK_INFO:
            return await self._get_network_info(params)
        
        # 环境变量操作
        elif operation == SystemOperation.ENV_GET:
            return await self._get_environment_variable(params)
        elif operation == SystemOperation.ENV_SET:
            return await self._set_environment_variable(params)
        elif operation == SystemOperation.ENV_LIST:
            return await self._list_environment_variables(params)
        elif operation == SystemOperation.ENV_DELETE:
            return await self._delete_environment_variable(params)
        
        # 服务管理操作
        elif operation == SystemOperation.SERVICE_STATUS:
            return await self._get_service_status(params)
        elif operation == SystemOperation.SERVICE_START:
            return await self._start_service(params)
        elif operation == SystemOperation.SERVICE_STOP:
            return await self._stop_service(params)
        elif operation == SystemOperation.SERVICE_RESTART:
            return await self._restart_service(params)
        
        # 命令执行操作
        elif operation == SystemOperation.COMMAND_EXEC:
            return await self._execute_command(params)
        elif operation == SystemOperation.SHELL_EXEC:
            return await self._execute_shell_command(params)
        
        # 资源监控操作
        elif operation == SystemOperation.RESOURCE_MONITOR:
            return await self._monitor_resources(params)
        elif operation == SystemOperation.PERFORMANCE_STATS:
            return await self._get_performance_stats(params)
        
        else:
            raise AdapterValidationError(
                f"Unsupported operation: {operation}",
                adapter_id=self.adapter_id,
                context={"operation": operation.value}
            )
    
    # 进程管理方法
    async def _get_process_list(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取进程列表"""
        import psutil
        
        processes = []
        filter_name = params.get('filter_name')
        include_details = params.get('include_details', False)
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'status', 'cpu_percent', 'memory_percent']):
                try:
                    proc_info = proc.info
                    if filter_name and filter_name.lower() not in proc_info['name'].lower():
                        continue
                    
                    process_data = {
                        'pid': proc_info['pid'],
                        'name': proc_info['name'],
                        'status': proc_info['status'],
                        'cpu_percent': proc_info['cpu_percent'],
                        'memory_percent': proc_info['memory_percent']
                    }
                    
                    if include_details:
                        process_data.update({
                            'create_time': proc.create_time(),
                            'cmdline': ' '.join(proc.cmdline()) if proc.cmdline() else '',
                            'username': proc.username() if hasattr(proc, 'username') else None
                        })
                    
                    processes.append(process_data)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return {
                'processes': processes,
                'total_count': len(processes),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get process list: {e}")
    
    async def _get_process_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取特定进程信息"""
        import psutil
        
        pid = params.get('pid')
        process_name = params.get('process_name')
        
        if not pid and not process_name:
            raise AdapterValidationError("Either 'pid' or 'process_name' must be provided")
        
        try:
            if pid:
                proc = psutil.Process(pid)
            else:
                # 通过名称查找进程
                found_procs = []
                for p in psutil.process_iter(['pid', 'name']):
                    if p.info['name'] == process_name:
                        found_procs.append(p)
                
                if not found_procs:
                    raise AdapterExecutionError(f"Process '{process_name}' not found")
                elif len(found_procs) > 1:
                    return {
                        'multiple_processes': True,
                        'processes': [{'pid': p.pid, 'name': p.name()} for p in found_procs],
                        'message': f"Multiple processes found with name '{process_name}'"
                    }
                
                proc = found_procs[0]
            
            # 获取详细信息
            with proc.oneshot():
                return {
                    'pid': proc.pid,
                    'name': proc.name(),
                    'status': proc.status(),
                    'create_time': proc.create_time(),
                    'cpu_percent': proc.cpu_percent(),
                    'memory_percent': proc.memory_percent(),
                    'memory_info': proc.memory_info()._asdict(),
                    'cmdline': proc.cmdline(),
                    'cwd': proc.cwd() if hasattr(proc, 'cwd') else None,
                    'username': proc.username() if hasattr(proc, 'username') else None,
                    'num_threads': proc.num_threads(),
                    'connections': len(proc.connections()) if hasattr(proc, 'connections') else 0
                }
        except psutil.NoSuchProcess:
            raise AdapterExecutionError(f"Process with PID {pid} not found")
        except psutil.AccessDenied:
            raise AdapterSecurityError(f"Access denied to process {pid or process_name}")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get process info: {e}")
    
    async def _kill_process(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """终止进程"""
        import psutil
        import signal
        
        pid = params.get('pid')
        process_name = params.get('process_name')
        force = params.get('force', False)
        
        if not pid and not process_name:
            raise AdapterValidationError("Either 'pid' or 'process_name' must be provided")
        
        try:
            if pid:
                proc = psutil.Process(pid)
            else:
                # 通过名称查找进程
                found_procs = []
                for p in psutil.process_iter(['pid', 'name']):
                    if p.info['name'] == process_name:
                        found_procs.append(p)
                
                if not found_procs:
                    raise AdapterExecutionError(f"Process '{process_name}' not found")
                elif len(found_procs) > 1:
                    raise AdapterValidationError(f"Multiple processes found with name '{process_name}'. Use PID instead.")
                
                proc = found_procs[0]
            
            # 记录进程信息
            proc_name = proc.name()
            proc_pid = proc.pid
            
            # 终止进程
            if force:
                proc.kill()  # SIGKILL
            else:
                proc.terminate()  # SIGTERM
            
            # 等待进程结束
            try:
                proc.wait(timeout=5)
                return {
                    'success': True,
                    'pid': proc_pid,
                    'name': proc_name,
                    'method': 'kill' if force else 'terminate',
                    'message': f"Process {proc_name} (PID: {proc_pid}) {'killed' if force else 'terminated'} successfully"
                }
            except psutil.TimeoutExpired:
                if not force:
                    # 如果温和终止失败，强制终止
                    proc.kill()
                    proc.wait(timeout=3)
                    return {
                        'success': True,
                        'pid': proc_pid,
                        'name': proc_name,
                        'method': 'force_kill',
                        'message': f"Process {proc_name} (PID: {proc_pid}) force killed after terminate timeout"
                    }
                else:
                    raise AdapterExecutionError(f"Failed to kill process {proc_name} (PID: {proc_pid})")
        
        except psutil.NoSuchProcess:
            return {
                'success': True,
                'message': f"Process {pid or process_name} was already terminated"
            }
        except psutil.AccessDenied:
            raise AdapterSecurityError(f"Access denied to kill process {pid or process_name}")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to kill process: {e}")
    
    async def _start_process(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """启动进程"""
        import subprocess
        import shlex
        
        command = params.get('command')
        args = params.get('args', [])
        cwd = params.get('cwd')
        env = params.get('env')
        detach = params.get('detach', False)
        
        if not command:
            raise AdapterValidationError("'command' parameter is required")
        
        try:
            # 构建完整命令
            if isinstance(command, str):
                full_command = shlex.split(command)
            else:
                full_command = [command]
            
            if args:
                full_command.extend(args)
            
            # 启动进程
            if detach:
                # 分离进程
                proc = subprocess.Popen(
                    full_command,
                    cwd=cwd,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    stdin=subprocess.PIPE
                )
                return {
                    'success': True,
                    'pid': proc.pid,
                    'command': ' '.join(full_command),
                    'detached': True,
                    'message': f"Process started with PID {proc.pid}"
                }
            else:
                # 同步执行
                result = subprocess.run(
                    full_command,
                    cwd=cwd,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=params.get('timeout', 30)
                )
                
                return {
                    'success': result.returncode == 0,
                    'return_code': result.returncode,
                    'command': ' '.join(full_command),
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'detached': False
                }
        
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Process execution timed out: {command}")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to start process: {e}")
    
    # 系统信息方法
    async def _get_system_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取系统信息"""
        import psutil
        import platform
        
        try:
            boot_time = psutil.boot_time()
            return {
                'platform': {
                    'system': platform.system(),
                    'release': platform.release(),
                    'version': platform.version(),
                    'machine': platform.machine(),
                    'processor': platform.processor(),
                    'architecture': platform.architecture(),
                    'hostname': platform.node()
                },
                'boot_time': boot_time,
                'uptime_seconds': time.time() - boot_time,
                'users': [user._asdict() for user in psutil.users()],
                'cpu_count': {
                    'logical': psutil.cpu_count(logical=True),
                    'physical': psutil.cpu_count(logical=False)
                },
                'memory': {
                    'total': psutil.virtual_memory().total,
                    'available': psutil.virtual_memory().available,
                    'percent': psutil.virtual_memory().percent
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get system info: {e}")
    
    async def _get_cpu_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取CPU信息"""
        import psutil
        
        try:
            # 获取CPU使用率（可能需要一点时间）
            interval = params.get('interval', 1.0)
            per_cpu = params.get('per_cpu', False)
            
            cpu_percent = psutil.cpu_percent(interval=interval, percpu=per_cpu)
            cpu_times = psutil.cpu_times()
            cpu_stats = psutil.cpu_stats()
            cpu_freq = psutil.cpu_freq()
            
            result = {
                'cpu_percent': cpu_percent,
                'cpu_count': {
                    'logical': psutil.cpu_count(logical=True),
                    'physical': psutil.cpu_count(logical=False)
                },
                'cpu_times': cpu_times._asdict(),
                'cpu_stats': cpu_stats._asdict(),
                'load_average': psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None,
                'timestamp': datetime.now().isoformat()
            }
            
            if cpu_freq:
                result['cpu_freq'] = cpu_freq._asdict()
            
            return result
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get CPU info: {e}")
    
    async def _get_memory_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取内存信息"""
        import psutil
        
        try:
            virtual_memory = psutil.virtual_memory()
            swap_memory = psutil.swap_memory()
            
            return {
                'virtual_memory': virtual_memory._asdict(),
                'swap_memory': swap_memory._asdict(),
                'memory_usage': {
                    'total_gb': round(virtual_memory.total / (1024**3), 2),
                    'available_gb': round(virtual_memory.available / (1024**3), 2),
                    'used_gb': round(virtual_memory.used / (1024**3), 2),
                    'free_gb': round(virtual_memory.free / (1024**3), 2),
                    'percent_used': virtual_memory.percent
                },
                'swap_usage': {
                    'total_gb': round(swap_memory.total / (1024**3), 2),
                    'used_gb': round(swap_memory.used / (1024**3), 2),
                    'free_gb': round(swap_memory.free / (1024**3), 2),
                    'percent_used': swap_memory.percent
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get memory info: {e}")
    
    async def _get_disk_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取磁盘信息"""
        import psutil
        
        try:
            path = params.get('path', '/')
            include_io = params.get('include_io', False)
            
            # 磁盘使用情况
            disk_usage = psutil.disk_usage(path)
            
            result = {
                'disk_usage': {
                    'path': path,
                    'total': disk_usage.total,
                    'used': disk_usage.used,
                    'free': disk_usage.free,
                    'percent': (disk_usage.used / disk_usage.total) * 100,
                    'total_gb': round(disk_usage.total / (1024**3), 2),
                    'used_gb': round(disk_usage.used / (1024**3), 2),
                    'free_gb': round(disk_usage.free / (1024**3), 2)
                },
                'disk_partitions': [
                    {
                        'device': partition.device,
                        'mountpoint': partition.mountpoint,
                        'fstype': partition.fstype,
                        'opts': partition.opts
                    }
                    for partition in psutil.disk_partitions()
                ],
                'timestamp': datetime.now().isoformat()
            }
            
            if include_io:
                disk_io = psutil.disk_io_counters()
                if disk_io:
                    result['disk_io'] = disk_io._asdict()
            
            return result
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get disk info: {e}")
    
    async def _get_network_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取网络信息"""
        import psutil
        
        try:
            include_io = params.get('include_io', False)
            include_connections = params.get('include_connections', False)
            
            # 网络接口信息
            network_interfaces = {}
            for interface, addresses in psutil.net_if_addrs().items():
                network_interfaces[interface] = [
                    {
                        'family': addr.family.name,
                        'address': addr.address,
                        'netmask': addr.netmask,
                        'broadcast': addr.broadcast
                    }
                    for addr in addresses
                ]
            
            # 网络接口统计
            net_if_stats = {}
            for interface, stats in psutil.net_if_stats().items():
                net_if_stats[interface] = stats._asdict()
            
            result = {
                'network_interfaces': network_interfaces,
                'interface_stats': net_if_stats,
                'timestamp': datetime.now().isoformat()
            }
            
            if include_io:
                net_io = psutil.net_io_counters(pernic=True)
                result['network_io'] = {
                    interface: stats._asdict()
                    for interface, stats in net_io.items()
                }
            
            if include_connections:
                connections = psutil.net_connections()
                result['connections'] = [
                    {
                        'fd': conn.fd,
                        'family': conn.family.name if conn.family else None,
                        'type': conn.type.name if conn.type else None,
                        'local_address': f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                        'remote_address': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                        'status': conn.status,
                        'pid': conn.pid
                    }
                    for conn in connections[:100]  # 限制连接数量
                ]
            
            return result
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get network info: {e}")
    
    # 环境变量管理方法
    async def _get_environment_variable(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取环境变量"""
        import os
        
        variable_name = params.get('variable_name')
        default_value = params.get('default_value')
        
        if not variable_name:
            raise AdapterValidationError("'variable_name' parameter is required")
        
        try:
            value = os.environ.get(variable_name, default_value)
            return {
                'variable_name': variable_name,
                'value': value,
                'exists': variable_name in os.environ,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get environment variable: {e}")
    
    async def _set_environment_variable(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """设置环境变量"""
        import os
        
        variable_name = params.get('variable_name')
        value = params.get('value')
        
        if not variable_name:
            raise AdapterValidationError("'variable_name' parameter is required")
        if value is None:
            raise AdapterValidationError("'value' parameter is required")
        
        try:
            old_value = os.environ.get(variable_name)
            os.environ[variable_name] = str(value)
            
            return {
                'variable_name': variable_name,
                'new_value': str(value),
                'old_value': old_value,
                'success': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to set environment variable: {e}")
    
    async def _list_environment_variables(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """列出环境变量"""
        import os
        
        filter_pattern = params.get('filter_pattern')
        include_values = params.get('include_values', True)
        
        try:
            env_vars = {}
            for key, value in os.environ.items():
                if filter_pattern and filter_pattern.lower() not in key.lower():
                    continue
                
                if include_values:
                    env_vars[key] = value
                else:
                    env_vars[key] = '***' if value else ''
            
            return {
                'environment_variables': env_vars,
                'count': len(env_vars),
                'filter_applied': filter_pattern is not None,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to list environment variables: {e}")
    
    async def _delete_environment_variable(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """删除环境变量"""
        import os
        
        variable_name = params.get('variable_name')
        
        if not variable_name:
            raise AdapterValidationError("'variable_name' parameter is required")
        
        try:
            old_value = os.environ.get(variable_name)
            if variable_name in os.environ:
                del os.environ[variable_name]
                existed = True
            else:
                existed = False
            
            return {
                'variable_name': variable_name,
                'old_value': old_value,
                'existed': existed,
                'success': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to delete environment variable: {e}")
    
    # 服务管理方法
    async def _get_service_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取服务状态"""
        import subprocess
        
        service_name = params.get('service_name')
        
        if not service_name:
            raise AdapterValidationError("'service_name' parameter is required")
        
        try:
            # 尝试使用systemctl
            result = subprocess.run(
                ['systemctl', 'status', service_name],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            is_active = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True,
                timeout=5
            ).stdout.strip()
            
            is_enabled = subprocess.run(
                ['systemctl', 'is-enabled', service_name],
                capture_output=True,
                text=True,
                timeout=5
            ).stdout.strip()
            
            return {
                'service_name': service_name,
                'active': is_active == 'active',
                'enabled': is_enabled == 'enabled',
                'status': is_active,
                'enabled_status': is_enabled,
                'status_output': result.stdout,
                'timestamp': datetime.now().isoformat()
            }
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Service status check timed out for: {service_name}")
        except FileNotFoundError:
            raise AdapterExecutionError("systemctl not found. Service management not available.")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get service status: {e}")
    
    async def _start_service(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """启动服务"""
        import subprocess
        
        service_name = params.get('service_name')
        
        if not service_name:
            raise AdapterValidationError("'service_name' parameter is required")
        
        try:
            result = subprocess.run(
                ['systemctl', 'start', service_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # 检查启动后状态
            status_result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            return {
                'service_name': service_name,
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'error': result.stderr,
                'final_status': status_result.stdout.strip(),
                'timestamp': datetime.now().isoformat()
            }
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Service start timed out for: {service_name}")
        except FileNotFoundError:
            raise AdapterExecutionError("systemctl not found. Service management not available.")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to start service: {e}")
    
    async def _stop_service(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """停止服务"""
        import subprocess
        
        service_name = params.get('service_name')
        
        if not service_name:
            raise AdapterValidationError("'service_name' parameter is required")
        
        try:
            result = subprocess.run(
                ['systemctl', 'stop', service_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # 检查停止后状态
            status_result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            return {
                'service_name': service_name,
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'error': result.stderr,
                'final_status': status_result.stdout.strip(),
                'timestamp': datetime.now().isoformat()
            }
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Service stop timed out for: {service_name}")
        except FileNotFoundError:
            raise AdapterExecutionError("systemctl not found. Service management not available.")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to stop service: {e}")
    
    async def _restart_service(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """重启服务"""
        import subprocess
        
        service_name = params.get('service_name')
        
        if not service_name:
            raise AdapterValidationError("'service_name' parameter is required")
        
        try:
            result = subprocess.run(
                ['systemctl', 'restart', service_name],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # 检查重启后状态
            status_result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            return {
                'service_name': service_name,
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'error': result.stderr,
                'final_status': status_result.stdout.strip(),
                'timestamp': datetime.now().isoformat()
            }
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Service restart timed out for: {service_name}")
        except FileNotFoundError:
            raise AdapterExecutionError("systemctl not found. Service management not available.")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to restart service: {e}")
    
    # 命令执行方法
    async def _execute_command(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """执行命令"""
        import subprocess
        import shlex
        
        command = params.get('command')
        args = params.get('args', [])
        cwd = params.get('cwd')
        env = params.get('env')
        timeout = params.get('timeout', 30)
        
        if not command:
            raise AdapterValidationError("'command' parameter is required")
        
        try:
            # 构建完整命令
            if isinstance(command, str):
                full_command = shlex.split(command)
            else:
                full_command = [command]
            
            if args:
                full_command.extend(args)
            
            # 执行命令
            result = subprocess.run(
                full_command,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return {
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'command': ' '.join(full_command),
                'stdout': result.stdout,
                'stderr': result.stderr,
                'cwd': cwd,
                'timeout': timeout,
                'timestamp': datetime.now().isoformat()
            }
        
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Command execution timed out: {command}")
        except FileNotFoundError:
            raise AdapterExecutionError(f"Command not found: {command}")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to execute command: {e}")
    
    async def _execute_shell_command(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """执行shell命令"""
        import subprocess
        
        command = params.get('command')
        cwd = params.get('cwd')
        env = params.get('env')
        timeout = params.get('timeout', 30)
        shell = params.get('shell', '/bin/bash')
        
        if not command:
            raise AdapterValidationError("'command' parameter is required")
        
        try:
            # 执行shell命令
            result = subprocess.run(
                command,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                shell=True,
                executable=shell,
                timeout=timeout
            )
            
            return {
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'command': command,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'cwd': cwd,
                'shell': shell,
                'timeout': timeout,
                'timestamp': datetime.now().isoformat()
            }
        
        except subprocess.TimeoutExpired:
            raise AdapterExecutionError(f"Shell command execution timed out: {command}")
        except Exception as e:
            raise AdapterExecutionError(f"Failed to execute shell command: {e}")
    
    # 资源监控方法
    async def _monitor_resources(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """监控系统资源"""
        import psutil
        
        duration = params.get('duration', 10)  # 监控持续时间（秒）
        interval = params.get('interval', 1)   # 采样间隔（秒）
        include_processes = params.get('include_processes', False)
        
        try:
            samples = []
            start_time = time.time()
            
            while time.time() - start_time < duration:
                sample = {
                    'timestamp': datetime.now().isoformat(),
                    'cpu_percent': psutil.cpu_percent(interval=0.1),
                    'memory': psutil.virtual_memory()._asdict(),
                    'disk_io': psutil.disk_io_counters()._asdict() if psutil.disk_io_counters() else None,
                    'network_io': psutil.net_io_counters()._asdict() if psutil.net_io_counters() else None
                }
                
                if include_processes:
                    # 获取前10个CPU使用率最高的进程
                    processes = []
                    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                        try:
                            processes.append(proc.info)
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            continue
                    
                    # 按CPU使用率排序
                    processes.sort(key=lambda x: x['cpu_percent'] or 0, reverse=True)
                    sample['top_processes'] = processes[:10]
                
                samples.append(sample)
                
                if len(samples) < duration / interval:
                    await asyncio.sleep(interval)
            
            # 计算统计信息
            cpu_values = [s['cpu_percent'] for s in samples if s['cpu_percent'] is not None]
            memory_values = [s['memory']['percent'] for s in samples]
            
            return {
                'duration': duration,
                'interval': interval,
                'samples': samples,
                'statistics': {
                    'cpu': {
                        'avg': sum(cpu_values) / len(cpu_values) if cpu_values else 0,
                        'max': max(cpu_values) if cpu_values else 0,
                        'min': min(cpu_values) if cpu_values else 0
                    },
                    'memory': {
                        'avg': sum(memory_values) / len(memory_values) if memory_values else 0,
                        'max': max(memory_values) if memory_values else 0,
                        'min': min(memory_values) if memory_values else 0
                    }
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to monitor resources: {e}")
    
    async def _get_performance_stats(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取性能统计信息"""
        import psutil
        
        try:
            # CPU统计
            cpu_times = psutil.cpu_times()
            cpu_stats = psutil.cpu_stats()
            
            # 内存统计
            virtual_memory = psutil.virtual_memory()
            swap_memory = psutil.swap_memory()
            
            # 磁盘统计
            disk_io = psutil.disk_io_counters()
            
            # 网络统计
            network_io = psutil.net_io_counters()
            
            # 进程统计
            process_count = len(psutil.pids())
            
            # 系统负载（如果可用）
            load_avg = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
            
            return {
                'cpu_stats': {
                    'times': cpu_times._asdict(),
                    'stats': cpu_stats._asdict(),
                    'count': psutil.cpu_count(),
                    'load_average': load_avg
                },
                'memory_stats': {
                    'virtual': virtual_memory._asdict(),
                    'swap': swap_memory._asdict()
                },
                'disk_stats': disk_io._asdict() if disk_io else None,
                'network_stats': network_io._asdict() if network_io else None,
                'process_stats': {
                    'total_processes': process_count,
                    'boot_time': psutil.boot_time(),
                    'users': len(psutil.users())
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise AdapterExecutionError(f"Failed to get performance stats: {e}")
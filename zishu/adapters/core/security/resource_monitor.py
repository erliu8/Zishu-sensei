"""
资源监控器

提供系统资源监控和限制功能，包括：
- CPU使用率监控
- 内存使用监控
- 磁盘I/O监控
- 网络流量监控
- 进程监控
- 资源配额管理
"""

import asyncio
import logging
import psutil
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Callable, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque, defaultdict
import json

logger = logging.getLogger(__name__)


class ResourceType(str, Enum):
    """资源类型"""
    CPU = "cpu"
    MEMORY = "memory"
    DISK_IO = "disk_io"
    NETWORK_IO = "network_io"
    PROCESS_COUNT = "process_count"
    FILE_HANDLES = "file_handles"


class AlertLevel(str, Enum):
    """警报级别"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class ResourceUsage:
    """资源使用情况"""
    resource_type: ResourceType
    current_value: float
    max_value: float
    percentage: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'resource_type': self.resource_type.value,
            'current_value': self.current_value,
            'max_value': self.max_value,
            'percentage': self.percentage,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class ResourceLimit:
    """资源限制"""
    resource_type: ResourceType
    warning_threshold: float  # 警告阈值（百分比）
    critical_threshold: float  # 严重阈值（百分比）
    max_value: Optional[float] = None  # 最大值
    enabled: bool = True
    
    def check_threshold(self, usage: ResourceUsage) -> Optional[AlertLevel]:
        """检查阈值"""
        if not self.enabled:
            return None
        
        if usage.percentage >= self.critical_threshold:
            return AlertLevel.CRITICAL
        elif usage.percentage >= self.warning_threshold:
            return AlertLevel.WARNING
        
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'resource_type': self.resource_type.value,
            'warning_threshold': self.warning_threshold,
            'critical_threshold': self.critical_threshold,
            'max_value': self.max_value,
            'enabled': self.enabled
        }


@dataclass
class ResourceAlert:
    """资源警报"""
    alert_id: str
    resource_type: ResourceType
    level: AlertLevel
    message: str
    usage: ResourceUsage
    threshold: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledged: bool = False
    resolved: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'alert_id': self.alert_id,
            'resource_type': self.resource_type.value,
            'level': self.level.value,
            'message': self.message,
            'usage': self.usage.to_dict(),
            'threshold': self.threshold,
            'timestamp': self.timestamp.isoformat(),
            'acknowledged': self.acknowledged,
            'resolved': self.resolved
        }


class ProcessInfo(NamedTuple):
    """进程信息"""
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    status: str
    create_time: float


@dataclass
class SystemMetrics:
    """系统指标"""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # CPU指标
    cpu_percent: float = 0.0
    cpu_count: int = 0
    load_average: List[float] = field(default_factory=list)
    
    # 内存指标
    memory_total: int = 0
    memory_available: int = 0
    memory_used: int = 0
    memory_percent: float = 0.0
    
    # 磁盘指标
    disk_total: int = 0
    disk_used: int = 0
    disk_free: int = 0
    disk_percent: float = 0.0
    
    # 网络指标
    network_bytes_sent: int = 0
    network_bytes_recv: int = 0
    network_packets_sent: int = 0
    network_packets_recv: int = 0
    
    # 进程指标
    process_count: int = 0
    thread_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp.isoformat(),
            'cpu_percent': self.cpu_percent,
            'cpu_count': self.cpu_count,
            'load_average': self.load_average,
            'memory_total': self.memory_total,
            'memory_available': self.memory_available,
            'memory_used': self.memory_used,
            'memory_percent': self.memory_percent,
            'disk_total': self.disk_total,
            'disk_used': self.disk_used,
            'disk_free': self.disk_free,
            'disk_percent': self.disk_percent,
            'network_bytes_sent': self.network_bytes_sent,
            'network_bytes_recv': self.network_bytes_recv,
            'network_packets_sent': self.network_packets_sent,
            'network_packets_recv': self.network_packets_recv,
            'process_count': self.process_count,
            'thread_count': self.thread_count
        }


class ResourceMonitor:
    """
    资源监控器
    
    监控系统资源使用情况，检测异常并触发警报。
    """
    
    def __init__(self, monitoring_interval: int = 5):
        """初始化资源监控器"""
        self.monitoring_interval = monitoring_interval
        
        # 资源限制
        self.resource_limits: Dict[ResourceType, ResourceLimit] = {}
        self._setup_default_limits()
        
        # 监控数据
        self.metrics_history: deque = deque(maxlen=1000)  # 保留最近1000个数据点
        self.current_metrics: Optional[SystemMetrics] = None
        
        # 警报管理
        self.active_alerts: Dict[str, ResourceAlert] = {}
        self.alert_history: deque = deque(maxlen=500)
        
        # 回调函数
        self.alert_callbacks: List[Callable[[ResourceAlert], None]] = []
        self.metrics_callbacks: List[Callable[[SystemMetrics], None]] = []
        
        # 监控控制
        self._monitoring = False
        self._monitor_task: Optional[asyncio.Task] = None
        
        # 统计信息
        self.stats = {
            'monitoring_cycles': 0,
            'alerts_generated': 0,
            'uptime_start': datetime.now(timezone.utc)
        }
        
        logger.info("ResourceMonitor initialized")
    
    def _setup_default_limits(self) -> None:
        """设置默认资源限制"""
        self.resource_limits = {
            ResourceType.CPU: ResourceLimit(
                resource_type=ResourceType.CPU,
                warning_threshold=70.0,
                critical_threshold=90.0
            ),
            ResourceType.MEMORY: ResourceLimit(
                resource_type=ResourceType.MEMORY,
                warning_threshold=80.0,
                critical_threshold=95.0
            ),
            ResourceType.DISK_IO: ResourceLimit(
                resource_type=ResourceType.DISK_IO,
                warning_threshold=80.0,
                critical_threshold=95.0
            ),
            ResourceType.PROCESS_COUNT: ResourceLimit(
                resource_type=ResourceType.PROCESS_COUNT,
                warning_threshold=80.0,
                critical_threshold=95.0,
                max_value=1000.0
            )
        }
    
    async def start_monitoring(self) -> None:
        """开始监控"""
        if self._monitoring:
            return
        
        self._monitoring = True
        self._monitor_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Resource monitoring started")
    
    async def stop_monitoring(self) -> None:
        """停止监控"""
        if not self._monitoring:
            return
        
        self._monitoring = False
        
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Resource monitoring stopped")
    
    async def _monitoring_loop(self) -> None:
        """监控循环"""
        while self._monitoring:
            try:
                # 收集系统指标
                metrics = await self._collect_system_metrics()
                self.current_metrics = metrics
                self.metrics_history.append(metrics)
                
                # 检查资源使用情况
                await self._check_resource_usage(metrics)
                
                # 触发指标回调
                for callback in self.metrics_callbacks:
                    try:
                        callback(metrics)
                    except Exception as e:
                        logger.error(f"Metrics callback error: {e}")
                
                self.stats['monitoring_cycles'] += 1
                
                # 等待下一个监控周期
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(self.monitoring_interval)
    
    async def _collect_system_metrics(self) -> SystemMetrics:
        """收集系统指标"""
        metrics = SystemMetrics()
        
        try:
            # CPU指标
            metrics.cpu_percent = psutil.cpu_percent(interval=1)
            metrics.cpu_count = psutil.cpu_count()
            
            # 负载平均值（仅在Unix系统上可用）
            try:
                metrics.load_average = list(psutil.getloadavg())
            except AttributeError:
                metrics.load_average = [0.0, 0.0, 0.0]
            
            # 内存指标
            memory = psutil.virtual_memory()
            metrics.memory_total = memory.total
            metrics.memory_available = memory.available
            metrics.memory_used = memory.used
            metrics.memory_percent = memory.percent
            
            # 磁盘指标
            disk = psutil.disk_usage('/')
            metrics.disk_total = disk.total
            metrics.disk_used = disk.used
            metrics.disk_free = disk.free
            metrics.disk_percent = (disk.used / disk.total) * 100
            
            # 网络指标
            network = psutil.net_io_counters()
            if network:
                metrics.network_bytes_sent = network.bytes_sent
                metrics.network_bytes_recv = network.bytes_recv
                metrics.network_packets_sent = network.packets_sent
                metrics.network_packets_recv = network.packets_recv
            
            # 进程指标
            metrics.process_count = len(psutil.pids())
            
            # 线程数统计
            thread_count = 0
            for proc in psutil.process_iter(['num_threads']):
                try:
                    thread_count += proc.info['num_threads'] or 0
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            metrics.thread_count = thread_count
            
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
        
        return metrics
    
    async def _check_resource_usage(self, metrics: SystemMetrics) -> None:
        """检查资源使用情况"""
        # 检查CPU使用率
        await self._check_cpu_usage(metrics)
        
        # 检查内存使用率
        await self._check_memory_usage(metrics)
        
        # 检查磁盘使用率
        await self._check_disk_usage(metrics)
        
        # 检查进程数量
        await self._check_process_count(metrics)
    
    async def _check_cpu_usage(self, metrics: SystemMetrics) -> None:
        """检查CPU使用率"""
        limit = self.resource_limits.get(ResourceType.CPU)
        if not limit or not limit.enabled:
            return
        
        usage = ResourceUsage(
            resource_type=ResourceType.CPU,
            current_value=metrics.cpu_percent,
            max_value=100.0,
            percentage=metrics.cpu_percent
        )
        
        alert_level = limit.check_threshold(usage)
        if alert_level:
            await self._generate_alert(
                ResourceType.CPU,
                alert_level,
                f"CPU usage is {metrics.cpu_percent:.1f}%",
                usage,
                limit.critical_threshold if alert_level == AlertLevel.CRITICAL else limit.warning_threshold
            )
    
    async def _check_memory_usage(self, metrics: SystemMetrics) -> None:
        """检查内存使用率"""
        limit = self.resource_limits.get(ResourceType.MEMORY)
        if not limit or not limit.enabled:
            return
        
        usage = ResourceUsage(
            resource_type=ResourceType.MEMORY,
            current_value=metrics.memory_used,
            max_value=metrics.memory_total,
            percentage=metrics.memory_percent
        )
        
        alert_level = limit.check_threshold(usage)
        if alert_level:
            await self._generate_alert(
                ResourceType.MEMORY,
                alert_level,
                f"Memory usage is {metrics.memory_percent:.1f}% ({metrics.memory_used / (1024**3):.1f}GB)",
                usage,
                limit.critical_threshold if alert_level == AlertLevel.CRITICAL else limit.warning_threshold
            )
    
    async def _check_disk_usage(self, metrics: SystemMetrics) -> None:
        """检查磁盘使用率"""
        limit = self.resource_limits.get(ResourceType.DISK_IO)
        if not limit or not limit.enabled:
            return
        
        usage = ResourceUsage(
            resource_type=ResourceType.DISK_IO,
            current_value=metrics.disk_used,
            max_value=metrics.disk_total,
            percentage=metrics.disk_percent
        )
        
        alert_level = limit.check_threshold(usage)
        if alert_level:
            await self._generate_alert(
                ResourceType.DISK_IO,
                alert_level,
                f"Disk usage is {metrics.disk_percent:.1f}% ({metrics.disk_used / (1024**3):.1f}GB)",
                usage,
                limit.critical_threshold if alert_level == AlertLevel.CRITICAL else limit.warning_threshold
            )
    
    async def _check_process_count(self, metrics: SystemMetrics) -> None:
        """检查进程数量"""
        limit = self.resource_limits.get(ResourceType.PROCESS_COUNT)
        if not limit or not limit.enabled:
            return
        
        max_processes = limit.max_value or 1000.0
        percentage = (metrics.process_count / max_processes) * 100
        
        usage = ResourceUsage(
            resource_type=ResourceType.PROCESS_COUNT,
            current_value=metrics.process_count,
            max_value=max_processes,
            percentage=percentage
        )
        
        alert_level = limit.check_threshold(usage)
        if alert_level:
            await self._generate_alert(
                ResourceType.PROCESS_COUNT,
                alert_level,
                f"Process count is {metrics.process_count} ({percentage:.1f}%)",
                usage,
                limit.critical_threshold if alert_level == AlertLevel.CRITICAL else limit.warning_threshold
            )
    
    async def _generate_alert(
        self,
        resource_type: ResourceType,
        level: AlertLevel,
        message: str,
        usage: ResourceUsage,
        threshold: float
    ) -> None:
        """生成警报"""
        alert_id = f"{resource_type.value}_{level.value}_{int(time.time())}"
        
        # 检查是否已存在相同类型的活跃警报
        existing_alert_key = f"{resource_type.value}_{level.value}"
        if existing_alert_key in self.active_alerts:
            return  # 避免重复警报
        
        alert = ResourceAlert(
            alert_id=alert_id,
            resource_type=resource_type,
            level=level,
            message=message,
            usage=usage,
            threshold=threshold
        )
        
        # 存储警报
        self.active_alerts[existing_alert_key] = alert
        self.alert_history.append(alert)
        self.stats['alerts_generated'] += 1
        
        # 触发警报回调
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
        
        logger.warning(f"Resource alert generated: {message}")
    
    def get_top_processes(self, limit: int = 10) -> List[ProcessInfo]:
        """获取资源使用最高的进程"""
        processes = []
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'memory_info', 'status', 'create_time']):
                try:
                    info = proc.info
                    memory_mb = (info['memory_info'].rss / (1024 * 1024)) if info['memory_info'] else 0
                    
                    processes.append(ProcessInfo(
                        pid=info['pid'],
                        name=info['name'] or 'Unknown',
                        cpu_percent=info['cpu_percent'] or 0.0,
                        memory_percent=info['memory_percent'] or 0.0,
                        memory_mb=memory_mb,
                        status=info['status'] or 'unknown',
                        create_time=info['create_time'] or 0.0
                    ))
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # 按CPU使用率排序
            processes.sort(key=lambda p: p.cpu_percent, reverse=True)
            return processes[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get top processes: {e}")
            return []
    
    def set_resource_limit(
        self,
        resource_type: ResourceType,
        warning_threshold: float,
        critical_threshold: float,
        max_value: Optional[float] = None
    ) -> None:
        """设置资源限制"""
        self.resource_limits[resource_type] = ResourceLimit(
            resource_type=resource_type,
            warning_threshold=warning_threshold,
            critical_threshold=critical_threshold,
            max_value=max_value
        )
        logger.info(f"Updated resource limit for {resource_type.value}")
    
    def enable_resource_monitoring(self, resource_type: ResourceType) -> None:
        """启用资源监控"""
        if resource_type in self.resource_limits:
            self.resource_limits[resource_type].enabled = True
            logger.info(f"Enabled monitoring for {resource_type.value}")
    
    def disable_resource_monitoring(self, resource_type: ResourceType) -> None:
        """禁用资源监控"""
        if resource_type in self.resource_limits:
            self.resource_limits[resource_type].enabled = False
            logger.info(f"Disabled monitoring for {resource_type.value}")
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """确认警报"""
        for alert in self.active_alerts.values():
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return True
        return False
    
    def resolve_alert(self, alert_id: str) -> bool:
        """解决警报"""
        for key, alert in list(self.active_alerts.items()):
            if alert.alert_id == alert_id:
                alert.resolved = True
                del self.active_alerts[key]
                return True
        return False
    
    def add_alert_callback(self, callback: Callable[[ResourceAlert], None]) -> None:
        """添加警报回调"""
        self.alert_callbacks.append(callback)
    
    def add_metrics_callback(self, callback: Callable[[SystemMetrics], None]) -> None:
        """添加指标回调"""
        self.metrics_callbacks.append(callback)
    
    def get_current_metrics(self) -> Optional[SystemMetrics]:
        """获取当前指标"""
        return self.current_metrics
    
    def get_metrics_history(self, limit: int = 100) -> List[SystemMetrics]:
        """获取指标历史"""
        return list(self.metrics_history)[-limit:]
    
    def get_active_alerts(self) -> List[ResourceAlert]:
        """获取活跃警报"""
        return list(self.active_alerts.values())
    
    def get_alert_history(self, limit: int = 50) -> List[ResourceAlert]:
        """获取警报历史"""
        return list(self.alert_history)[-limit:]
    
    def get_resource_limits(self) -> Dict[ResourceType, ResourceLimit]:
        """获取资源限制"""
        return self.resource_limits.copy()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        uptime = datetime.now(timezone.utc) - self.stats['uptime_start']
        
        return {
            'monitoring_cycles': self.stats['monitoring_cycles'],
            'alerts_generated': self.stats['alerts_generated'],
            'active_alerts_count': len(self.active_alerts),
            'uptime_seconds': uptime.total_seconds(),
            'monitoring_interval': self.monitoring_interval,
            'is_monitoring': self._monitoring,
            'metrics_history_size': len(self.metrics_history),
            'alert_history_size': len(self.alert_history)
        }
    
    def export_metrics(self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """导出指标数据"""
        metrics = []
        
        for metric in self.metrics_history:
            if start_time and metric.timestamp < start_time:
                continue
            if end_time and metric.timestamp > end_time:
                continue
            
            metrics.append(metric.to_dict())
        
        return metrics
    
    def export_alerts(self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """导出警报数据"""
        alerts = []
        
        for alert in self.alert_history:
            if start_time and alert.timestamp < start_time:
                continue
            if end_time and alert.timestamp > end_time:
                continue
            
            alerts.append(alert.to_dict())
        
        return alerts

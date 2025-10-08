"""
审计日志系统
提供全面的系统审计功能，包括适配器操作、安全事件、性能监控和用户行为的完整记录
"""

import asyncio
import json
import time
import threading
import uuid
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union, Literal
from concurrent.futures import ThreadPoolExecutor

import aiofiles
import loguru
from loguru import logger
from pydantic import BaseModel, Field


# 审计事件级别枚举
class AuditLevel(str, Enum):
    """审计事件级别"""

    TRACE = "TRACE"  # 跟踪级别，最详细的日志
    DEBUG = "DEBUG"  # 调试信息
    INFO = "INFO"  # 一般信息
    WARNING = "WARNING"  # 警告信息
    ERROR = "ERROR"  # 错误信息
    CRITICAL = "CRITICAL"  # 严重错误


# 审计事件类型枚举
class AuditEventType(str, Enum):
    """审计事件类型"""

    # 适配器相关事件
    ADAPTER_LOAD = "adapter_load"  # 适配器加载
    ADAPTER_EXECUTE = "adapter_execute"  # 适配器执行
    ADAPTER_ERROR = "adapter_error"  # 适配器错误
    ADAPTER_UNLOAD = "adapter_unload"  # 适配器卸载

    # 安全相关事件
    AUTH_LOGIN = "auth_login"  # 用户登录
    AUTH_LOGOUT = "auth_logout"  # 用户登出
    AUTH_FAILED = "auth_failed"  # 认证失败
    PERMISSION_DENIED = "permission_denied"  # 权限被拒绝
    SECURITY_VIOLATION = "security_violation"  # 安全违规

    # API相关事件
    API_REQUEST = "api_request"  # API请求
    API_RESPONSE = "api_response"  # API响应
    API_ERROR = "api_error"  # API错误
    RATE_LIMIT_HIT = "rate_limit_hit"  # 限制命中

    # 系统相关事件
    SYSTEM_START = "system_start"  # 系统启动
    SYSTEM_STOP = "system_stop"  # 系统停止
    CONFIG_CHANGE = "config_change"  # 配置变更
    RESOURCE_WARNING = "resource_warning"  # 资源警告

    # 用户操作事件
    USER_ACTION = "user_action"  # 用户操作
    DATA_ACCESS = "data_access"  # 数据访问
    DATA_MODIFY = "data_modify"  # 数据修改


# 审计事件严重级别
class AuditSeverity(str, Enum):
    """审计事件严重级别"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    """审计事件数据模型"""

    # 基础信息
    event_id: str = ""
    timestamp: datetime = None
    event_type: AuditEventType = None
    level: AuditLevel = None
    severity: AuditSeverity = AuditSeverity.LOW

    # 事件内容
    message: str = ""
    details: Dict[str, Any] = None

    # 上下文信息
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None

    # 系统信息
    component: Optional[str] = None  # 组件名称
    adapter_id: Optional[str] = None  # 适配器ID
    adapter_type: Optional[str] = None  # 适配器类型

    # 性能信息
    duration_ms: Optional[float] = None  # 操作耗时(毫秒)
    memory_usage: Optional[float] = None  # 内存使用量(MB)
    cpu_usage: Optional[float] = None  # CPU使用率(%)

    # 错误信息
    error_code: Optional[str] = None  # 错误代码
    error_message: Optional[str] = None  # 错误信息
    stack_trace: Optional[str] = None  # 堆栈跟踪

    # 关联信息
    correlation_id: Optional[str] = None  # 关联ID，用于追踪相关事件
    parent_event_id: Optional[str] = None  # 父事件ID

    # 标签和分类
    tags: Set[str] = None
    category: Optional[str] = None

    def __post_init__(self):
        """初始化后处理"""
        if not self.event_id:
            self.event_id = str(uuid.uuid4())
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.details is None:
            self.details = {}
        if self.tags is None:
            self.tags = set()

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        data = asdict(self)
        # 处理特殊字段
        data["timestamp"] = self.timestamp.isoformat()
        data["tags"] = list(self.tags) if self.tags else []
        data["event_type"] = self.event_type.value if self.event_type else None
        data["level"] = self.level.value if self.level else None
        data["severity"] = self.severity.value if self.severity else None
        return data

    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False)


class AuditStorage(ABC):
    """审计日志存储接口"""

    @abstractmethod
    async def store_event(self, event: AuditEvent) -> bool:
        """存储审计事件"""
        pass

    @abstractmethod
    async def query_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None,
        user_id: Optional[str] = None,
        component: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[AuditEvent]:
        """查询审计事件"""
        pass

    @abstractmethod
    async def count_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None,
    ) -> int:
        """统计事件数量"""
        pass

    @abstractmethod
    async def cleanup_old_events(self, older_than: datetime) -> int:
        """清理旧事件"""
        pass


class FileAuditStorage(AuditStorage):
    """基于文件的审计日志存储"""

    def __init__(
        self,
        log_directory: Path = Path("./logs/audit"),
        max_file_size: int = 100 * 1024 * 1024,  # 100MB
        backup_count: int = 10,
        rotation_time: str = "daily",
    ):
        self.log_directory = Path(log_directory)
        self.log_directory.mkdir(parents=True, exist_ok=True)
        self.max_file_size = max_file_size
        self.backup_count = backup_count
        self.rotation_time = rotation_time

        # 设置专用的审计日志记录器
        self._setup_logger()

    def _setup_logger(self):
        """设置审计日志记录器"""
        log_file = self.log_directory / "audit_{time:YYYY-MM-DD}.log"

        # 移除默认handler
        logger.remove()

        # 添加文件handler
        logger.add(
            log_file,
            rotation="100 MB",
            retention="30 days",
            compression="gz",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {message}",
            level="INFO",
            serialize=True,  # JSON格式输出
        )

        # 添加控制台handler（调试用）
        logger.add(
            lambda msg: print(f"AUDIT: {msg}"),
            format="{time:HH:mm:ss} | AUDIT | {level} | {message}",
            level="INFO",
        )

    async def store_event(self, event: AuditEvent) -> bool:
        """存储审计事件到文件"""
        try:
            # 使用loguru记录结构化日志
            logger.bind(
                event_type=event.event_type.value if event.event_type else None,
                severity=event.severity.value if event.severity else None,
                event_id=event.event_id,
                component=event.component,
                user_id=event.user_id,
            ).log(event.level.value if event.level else "INFO", event.to_json())
            return True
        except Exception as e:
            logger.error(f"Failed to store audit event: {e}")
            return False

    async def query_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None,
        user_id: Optional[str] = None,
        component: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[AuditEvent]:
        """从文件查询审计事件（简化实现）"""
        # 注意：这是一个简化的实现，生产环境建议使用专门的日志分析工具
        events = []
        log_files = sorted(self.log_directory.glob("audit_*.log"))

        try:
            for log_file in log_files:
                if len(events) >= limit + offset:
                    break

                async with aiofiles.open(log_file, "r", encoding="utf-8") as f:
                    async for line in f:
                        try:
                            # 解析JSON日志行
                            log_data = json.loads(line.strip())

                            # 这里需要根据实际的loguru输出格式调整
                            if "message" in log_data:
                                event_data = json.loads(log_data["message"])
                                # 简单的过滤逻辑
                                if self._matches_filter(
                                    event_data,
                                    start_time,
                                    end_time,
                                    event_types,
                                    levels,
                                    user_id,
                                    component,
                                ):
                                    if len(events) >= offset:
                                        events.append(self._dict_to_event(event_data))
                                    if len(events) >= limit + offset:
                                        break
                        except (json.JSONDecodeError, KeyError):
                            continue
        except Exception as e:
            logger.error(f"Failed to query audit events: {e}")

        return events[offset : offset + limit]

    def _matches_filter(
        self,
        event_data: Dict,
        start_time,
        end_time,
        event_types,
        levels,
        user_id,
        component,
    ) -> bool:
        """检查事件是否匹配过滤条件"""
        # 简化的过滤逻辑
        if event_types and event_data.get("event_type") not in [
            et.value for et in event_types
        ]:
            return False
        if levels and event_data.get("level") not in [l.value for l in levels]:
            return False
        if user_id and event_data.get("user_id") != user_id:
            return False
        if component and event_data.get("component") != component:
            return False
        return True

    def _dict_to_event(self, data: Dict) -> AuditEvent:
        """将字典转换为AuditEvent对象"""
        # 处理时间戳
        if isinstance(data.get("timestamp"), str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])

        # 处理枚举类型
        if "event_type" in data:
            data["event_type"] = AuditEventType(data["event_type"])
        if "level" in data:
            data["level"] = AuditLevel(data["level"])
        if "severity" in data:
            data["severity"] = AuditSeverity(data["severity"])

        # 处理集合类型
        if "tags" in data and isinstance(data["tags"], list):
            data["tags"] = set(data["tags"])

        return AuditEvent(**data)

    async def count_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None,
    ) -> int:
        """统计事件数量"""
        # 简化实现
        events = await self.query_events(
            start_time, end_time, event_types, levels, limit=999999
        )
        return len(events)

    async def cleanup_old_events(self, older_than: datetime) -> int:
        """清理旧事件（通过删除旧日志文件）"""
        cleaned_count = 0
        for log_file in self.log_directory.glob("audit_*.log*"):
            try:
                file_time = datetime.fromtimestamp(log_file.stat().st_mtime)
                if file_time < older_than:
                    log_file.unlink()
                    cleaned_count += 1
            except Exception as e:
                logger.warning(f"Failed to cleanup log file {log_file}: {e}")

        return cleaned_count


class AuditConfig(BaseModel):
    """审计配置"""

    enabled: bool = True
    storage_type: str = "file"

    # 日志级别配置
    default_level: AuditLevel = AuditLevel.INFO
    component_levels: Dict[str, AuditLevel] = Field(default_factory=dict)

    # 存储配置
    storage_config: Dict[str, Any] = Field(default_factory=dict)

    # 清理配置
    retention_days: int = 30
    auto_cleanup: bool = True
    cleanup_interval_hours: int = 24

    # 性能配置
    async_storage: bool = True
    batch_size: int = 100
    flush_interval_seconds: int = 5

    # 过滤配置
    ignored_events: Set[AuditEventType] = Field(default_factory=set)
    ignored_components: Set[str] = Field(default_factory=set)

    # 告警配置
    alert_on_errors: bool = True
    alert_threshold: Dict[str, int] = Field(default_factory=dict)


class AuditLogger:
    """审计日志记录器"""

    def __init__(self, storage: AuditStorage, config: Optional[AuditConfig] = None):
        self.storage = storage
        self.config = config or AuditConfig()
        self._event_queue = asyncio.Queue()
        self._batch_events = []
        self._last_flush = time.time()
        self._background_task = None
        self._running = False
        self._lock = asyncio.Lock()
        self._event_count = 0
        self._error_count = 0

    async def start(self):
        """启动审计日志记录器"""
        if self._running:
            return

        self._running = True
        self._background_task = asyncio.create_task(self._process_events())

        # 记录系统启动事件
        await self.log_event(
            AuditEventType.SYSTEM_START,
            "Audit system started",
            level=AuditLevel.INFO,
            component="audit_system",
        )

    async def stop(self):
        """停止审计日志记录器"""
        if not self._running:
            return

        # 记录系统停止事件
        await self.log_event(
            AuditEventType.SYSTEM_STOP,
            "Audit system stopping",
            level=AuditLevel.INFO,
            component="audit_system",
        )

        self._running = False

        # 等待后台任务完成
        if self._background_task:
            try:
                await asyncio.wait_for(self._background_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("Audit background task shutdown timeout")

        # 刷新剩余事件
        await self._flush_events()

    async def log_event(
        self,
        event_type: AuditEventType,
        message: str,
        level: AuditLevel = AuditLevel.INFO,
        severity: AuditSeverity = AuditSeverity.LOW,
        **kwargs,
    ) -> str:
        """记录审计事件"""
        if not self.config.enabled:
            return ""

        # 检查是否应该忽略此事件
        if event_type in self.config.ignored_events:
            return ""

        component = kwargs.get("component")
        if component and component in self.config.ignored_components:
            return ""

        # 检查组件级别配置
        if component and component in self.config.component_levels:
            min_level = self.config.component_levels[component]
            if self._level_value(level) < self._level_value(min_level):
                return ""

        # 创建审计事件
        event = AuditEvent(
            event_type=event_type,
            message=message,
            level=level,
            severity=severity,
            **kwargs,
        )

        self._event_count += 1

        if self.config.async_storage:
            # 异步处理
            await self._event_queue.put(event)
        else:
            # 同步处理
            success = await self.storage.store_event(event)
            if not success:
                self._error_count += 1

        return event.event_id

    def _level_value(self, level: AuditLevel) -> int:
        """获取级别数值（用于比较）"""
        level_map = {
            AuditLevel.TRACE: 0,
            AuditLevel.DEBUG: 1,
            AuditLevel.INFO: 2,
            AuditLevel.WARNING: 3,
            AuditLevel.ERROR: 4,
            AuditLevel.CRITICAL: 5,
        }
        return level_map.get(level, 2)

    async def _process_events(self):
        """后台处理事件队列"""
        while self._running or not self._event_queue.empty():
            try:
                # 等待事件或超时
                try:
                    event = await asyncio.wait_for(
                        self._event_queue.get(),
                        timeout=self.config.flush_interval_seconds,
                    )
                    self._batch_events.append(event)
                except asyncio.TimeoutError:
                    pass

                # 检查是否需要刷新
                current_time = time.time()
                should_flush = (
                    len(self._batch_events) >= self.config.batch_size
                    or current_time - self._last_flush
                    >= self.config.flush_interval_seconds
                )

                if should_flush and self._batch_events:
                    await self._flush_events()

            except Exception as e:
                logger.error(f"Error processing audit events: {e}")
                self._error_count += 1
                await asyncio.sleep(1)

    async def _flush_events(self):
        """刷新批次事件到存储"""
        if not self._batch_events:
            return

        async with self._lock:
            events_to_flush = self._batch_events.copy()
            self._batch_events.clear()
            self._last_flush = time.time()

        # 批量存储事件
        failed_count = 0
        for event in events_to_flush:
            try:
                success = await self.storage.store_event(event)
                if not success:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Failed to store audit event {event.event_id}: {e}")
                failed_count += 1

        if failed_count > 0:
            self._error_count += failed_count
            logger.warning(
                f"Failed to store {failed_count}/{len(events_to_flush)} audit events"
            )

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "total_events": self._event_count,
            "error_count": self._error_count,
            "queue_size": self._event_queue.qsize() if self._event_queue else 0,
            "batch_size": len(self._batch_events),
            "is_running": self._running,
        }

    # 便捷方法
    async def log_adapter_load(self, adapter_id: str, adapter_type: str, **kwargs):
        """记录适配器加载事件"""
        return await self.log_event(
            AuditEventType.ADAPTER_LOAD,
            f"Adapter {adapter_id} ({adapter_type}) loaded",
            level=AuditLevel.INFO,
            adapter_id=adapter_id,
            adapter_type=adapter_type,
            component="adapter_manager",
            **kwargs,
        )

    async def log_adapter_execute(
        self, adapter_id: str, operation: str, duration_ms: float, **kwargs
    ):
        """记录适配器执行事件"""
        return await self.log_event(
            AuditEventType.ADAPTER_EXECUTE,
            f"Adapter {adapter_id} executed operation: {operation}",
            level=AuditLevel.INFO,
            adapter_id=adapter_id,
            duration_ms=duration_ms,
            component="adapter_executor",
            details={"operation": operation},
            **kwargs,
        )

    async def log_adapter_error(
        self, adapter_id: str, error: Exception, operation: str = "", **kwargs
    ):
        """记录适配器错误事件"""
        import traceback

        error_details = {
            "operation": operation,
            "error_type": type(error).__name__,
        }

        return await self.log_event(
            AuditEventType.ADAPTER_ERROR,
            f"Adapter {adapter_id} error: {str(error)}",
            level=AuditLevel.ERROR,
            severity=AuditSeverity.HIGH,
            adapter_id=adapter_id,
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            component="adapter_executor",
            details=error_details,
            **kwargs,
        )

    async def log_security_event(
        self,
        event_type: AuditEventType,
        message: str,
        severity: AuditSeverity,
        **kwargs,
    ):
        """记录安全事件"""
        level = (
            AuditLevel.WARNING
            if severity in [AuditSeverity.HIGH, AuditSeverity.CRITICAL]
            else AuditLevel.INFO
        )

        return await self.log_event(
            event_type,
            message,
            level=level,
            severity=severity,
            component="security",
            **kwargs,
        )

    async def log_api_request(
        self, method: str, path: str, status_code: int, duration_ms: float, **kwargs
    ):
        """记录API请求事件"""
        level = AuditLevel.ERROR if status_code >= 400 else AuditLevel.INFO
        event_type = (
            AuditEventType.API_ERROR
            if status_code >= 400
            else AuditEventType.API_REQUEST
        )

        return await self.log_event(
            event_type,
            f"{method} {path} - {status_code}",
            level=level,
            duration_ms=duration_ms,
            component="api",
            details={"method": method, "path": path, "status_code": status_code},
            **kwargs,
        )

    async def log_user_action(self, action: str, user_id: str, **kwargs):
        """记录用户操作事件"""
        return await self.log_event(
            AuditEventType.USER_ACTION,
            f"User {user_id} performed action: {action}",
            level=AuditLevel.INFO,
            user_id=user_id,
            component="user_actions",
            details={"action": action},
            **kwargs,
        )


# 全局审计实例
_global_audit_logger = None


def get_audit_logger():
    """获取全局审计记录器"""
    return _global_audit_logger


async def initialize_audit_system(config=None, storage=None):
    """初始化审计系统"""
    global _global_audit_logger

    if storage is None:
        # 默认使用文件存储
        storage = FileAuditStorage()

    if config is None:
        config = AuditConfig()

    _global_audit_logger = AuditLogger(storage, config)
    await _global_audit_logger.start()

    return _global_audit_logger


async def shutdown_audit_system():
    """关闭审计系统"""
    global _global_audit_logger

    if _global_audit_logger:
        await _global_audit_logger.stop()
        _global_audit_logger = None


# 审计装饰器
def audit_operation(
    event_type: AuditEventType,
    message_template: str = "",
    level: AuditLevel = AuditLevel.INFO,
    capture_args: bool = False,
    capture_result: bool = False,
):
    """审计操作装饰器"""

    def decorator(func):
        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                audit_logger = get_audit_logger()
                if not audit_logger:
                    return await func(*args, **kwargs)

                start_time = time.time()
                correlation_id = str(uuid.uuid4())

                try:
                    # 准备审计数据
                    audit_data = {
                        "component": func.__module__,
                        "correlation_id": correlation_id,
                    }

                    if capture_args:
                        audit_data["details"] = {
                            "args": str(args)[:1000],  # 限制长度
                            "kwargs": str({k: str(v)[:100] for k, v in kwargs.items()}),
                        }

                    # 执行函数
                    result = await func(*args, **kwargs)

                    # 记录成功事件
                    duration_ms = (time.time() - start_time) * 1000
                    message = (
                        message_template.format(
                            func_name=func.__name__, duration_ms=duration_ms
                        )
                        or f"Operation {func.__name__} completed successfully"
                    )

                    if capture_result:
                        audit_data["details"] = audit_data.get("details", {})
                        audit_data["details"]["result"] = str(result)[:1000]

                    await audit_logger.log_event(
                        event_type,
                        message,
                        level=level,
                        duration_ms=duration_ms,
                        **audit_data,
                    )

                    return result

                except Exception as e:
                    # 记录错误事件
                    import traceback

                    duration_ms = (time.time() - start_time) * 1000

                    await audit_logger.log_event(
                        AuditEventType.ADAPTER_ERROR,
                        f"Operation {func.__name__} failed: {str(e)}",
                        level=AuditLevel.ERROR,
                        severity=AuditSeverity.HIGH,
                        duration_ms=duration_ms,
                        error_message=str(e),
                        stack_trace=traceback.format_exc(),
                        correlation_id=correlation_id,
                        component=func.__module__,
                    )
                    raise

            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                # 对于同步函数，尝试在事件循环中运行审计
                audit_logger = get_audit_logger()
                if not audit_logger:
                    return func(*args, **kwargs)

                start_time = time.time()
                correlation_id = str(uuid.uuid4())

                try:
                    result = func(*args, **kwargs)

                    # 尝试异步记录审计事件
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            # 创建任务但不等待
                            asyncio.create_task(
                                audit_logger.log_event(
                                    event_type,
                                    f"Operation {func.__name__} completed successfully",
                                    level=level,
                                    duration_ms=(time.time() - start_time) * 1000,
                                    component=func.__module__,
                                    correlation_id=correlation_id,
                                )
                            )
                    except:
                        pass  # 忽略审计错误，不影响主要功能

                    return result

                except Exception as e:
                    # 尝试记录错误事件
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            asyncio.create_task(
                                audit_logger.log_event(
                                    AuditEventType.ADAPTER_ERROR,
                                    f"Operation {func.__name__} failed: {str(e)}",
                                    level=AuditLevel.ERROR,
                                    severity=AuditSeverity.HIGH,
                                    duration_ms=(time.time() - start_time) * 1000,
                                    error_message=str(e),
                                    correlation_id=correlation_id,
                                    component=func.__module__,
                                )
                            )
                    except:
                        pass
                    raise

            return sync_wrapper

    return decorator


def audit_adapter_operation(operation_name: str = ""):
    """适配器操作审计装饰器"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            audit_logger = get_audit_logger()
            if not audit_logger:
                return await func(self, *args, **kwargs)

            adapter_id = getattr(self, "adapter_id", self.__class__.__name__)
            adapter_type = getattr(self, "adapter_type", "unknown")
            operation = operation_name or func.__name__

            start_time = time.time()

            try:
                result = await func(self, *args, **kwargs)

                duration_ms = (time.time() - start_time) * 1000
                await audit_logger.log_adapter_execute(
                    adapter_id=adapter_id,
                    operation=operation,
                    duration_ms=duration_ms,
                    adapter_type=adapter_type,
                )

                return result

            except Exception as e:
                await audit_logger.log_adapter_error(
                    adapter_id=adapter_id,
                    error=e,
                    operation=operation,
                    adapter_type=adapter_type,
                )
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(self, *args, **kwargs):
                # 对于同步函数的简化处理
                try:
                    return func(self, *args, **kwargs)
                except Exception as e:
                    # 尝试记录错误（如果可能）
                    audit_logger = get_audit_logger()
                    if audit_logger:
                        adapter_id = getattr(
                            self, "adapter_id", self.__class__.__name__
                        )
                        try:
                            loop = asyncio.get_event_loop()
                            if loop.is_running():
                                asyncio.create_task(
                                    audit_logger.log_adapter_error(
                                        adapter_id=adapter_id,
                                        error=e,
                                        operation=operation_name or func.__name__,
                                    )
                                )
                        except:
                            pass
                    raise

            return sync_wrapper

    return decorator

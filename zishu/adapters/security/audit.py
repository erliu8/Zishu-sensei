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
    TRACE = "TRACE"      # 跟踪级别，最详细的日志
    DEBUG = "DEBUG"      # 调试信息
    INFO = "INFO"        # 一般信息
    WARNING = "WARNING"  # 警告信息
    ERROR = "ERROR"      # 错误信息
    CRITICAL = "CRITICAL" # 严重错误

# 审计事件类型枚举
class AuditEventType(str, Enum):
    """审计事件类型"""
    # 适配器相关事件
    ADAPTER_LOAD = "adapter_load"           # 适配器加载
    ADAPTER_EXECUTE = "adapter_execute"     # 适配器执行
    ADAPTER_ERROR = "adapter_error"         # 适配器错误
    ADAPTER_UNLOAD = "adapter_unload"       # 适配器卸载
    
    # 安全相关事件
    AUTH_LOGIN = "auth_login"               # 用户登录
    AUTH_LOGOUT = "auth_logout"             # 用户登出
    AUTH_FAILED = "auth_failed"             # 认证失败
    PERMISSION_DENIED = "permission_denied"  # 权限被拒绝
    SECURITY_VIOLATION = "security_violation" # 安全违规
    
    # API相关事件
    API_REQUEST = "api_request"             # API请求
    API_RESPONSE = "api_response"           # API响应
    API_ERROR = "api_error"                 # API错误
    RATE_LIMIT_HIT = "rate_limit_hit"       # 限制命中
    
    # 系统相关事件
    SYSTEM_START = "system_start"           # 系统启动
    SYSTEM_STOP = "system_stop"             # 系统停止
    CONFIG_CHANGE = "config_change"         # 配置变更
    RESOURCE_WARNING = "resource_warning"    # 资源警告
    
    # 用户操作事件
    USER_ACTION = "user_action"             # 用户操作
    DATA_ACCESS = "data_access"             # 数据访问
    DATA_MODIFY = "data_modify"             # 数据修改

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
    component: Optional[str] = None        # 组件名称
    adapter_id: Optional[str] = None       # 适配器ID
    adapter_type: Optional[str] = None     # 适配器类型
    
    # 性能信息
    duration_ms: Optional[float] = None    # 操作耗时(毫秒)
    memory_usage: Optional[float] = None   # 内存使用量(MB)
    cpu_usage: Optional[float] = None      # CPU使用率(%)
    
    # 错误信息
    error_code: Optional[str] = None       # 错误代码
    error_message: Optional[str] = None    # 错误信息
    stack_trace: Optional[str] = None      # 堆栈跟踪
    
    # 关联信息
    correlation_id: Optional[str] = None   # 关联ID，用于追踪相关事件
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
        data['timestamp'] = self.timestamp.isoformat()
        data['tags'] = list(self.tags) if self.tags else []
        data['event_type'] = self.event_type.value if self.event_type else None
        data['level'] = self.level.value if self.level else None
        data['severity'] = self.severity.value if self.severity else None
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
        offset: int = 0
    ) -> List[AuditEvent]:
        """查询审计事件"""
        pass
    
    @abstractmethod
    async def count_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None
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
        rotation_time: str = "daily"
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
            serialize=True  # JSON格式输出
        )
        
        # 添加控制台handler（调试用）
        logger.add(
            lambda msg: print(f"AUDIT: {msg}"),
            format="{time:HH:mm:ss} | AUDIT | {level} | {message}",
            level="INFO"
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
                user_id=event.user_id
            ).log(
                event.level.value if event.level else "INFO",
                event.to_json()
            )
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
        offset: int = 0
    ) -> List[AuditEvent]:
        """从文件查询审计事件（简化实现）"""
        # 注意：这是一个简化的实现，生产环境建议使用专门的日志分析工具
        events = []
        log_files = sorted(self.log_directory.glob("audit_*.log"))
        
        try:
            for log_file in log_files:
                if len(events) >= limit + offset:
                    break
                
                async with aiofiles.open(log_file, 'r', encoding='utf-8') as f:
                    async for line in f:
                        try:
                            # 解析JSON日志行
                            log_data = json.loads(line.strip())
                            
                            # 这里需要根据实际的loguru输出格式调整
                            if 'message' in log_data:
                                event_data = json.loads(log_data['message'])
                                # 简单的过滤逻辑
                                if self._matches_filter(
                                    event_data, start_time, end_time, 
                                    event_types, levels, user_id, component
                                ):
                                    if len(events) >= offset:
                                        events.append(self._dict_to_event(event_data))
                                    if len(events) >= limit + offset:
                                        break
                        except (json.JSONDecodeError, KeyError):
                            continue
        except Exception as e:
            logger.error(f"Failed to query audit events: {e}")
        
        return events[offset:offset + limit]
    
    def _matches_filter(self, event_data: Dict, start_time, end_time, event_types, levels, user_id, component) -> bool:
        """检查事件是否匹配过滤条件"""
        # 简化的过滤逻辑
        if event_types and event_data.get('event_type') not in [et.value for et in event_types]:
            return False
        if levels and event_data.get('level') not in [l.value for l in levels]:
            return False
        if user_id and event_data.get('user_id') != user_id:
            return False
        if component and event_data.get('component') != component:
            return False
        return True
    
    def _dict_to_event(self, data: Dict) -> AuditEvent:
        """将字典转换为AuditEvent对象"""
        # 处理时间戳
        if isinstance(data.get('timestamp'), str):
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        
        # 处理枚举类型
        if 'event_type' in data:
            data['event_type'] = AuditEventType(data['event_type'])
        if 'level' in data:
            data['level'] = AuditLevel(data['level'])
        if 'severity' in data:
            data['severity'] = AuditSeverity(data['severity'])
        
        # 处理集合类型
        if 'tags' in data and isinstance(data['tags'], list):
            data['tags'] = set(data['tags'])
        
        return AuditEvent(**data)
    
    async def count_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None
    ) -> int:
        """统计事件数量"""
        # 简化实现
        events = await self.query_events(start_time, end_time, event_types, levels, limit=999999)
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

class DatabaseAuditStorage(AuditStorage):
    """基于数据库的审计日志存储（示例实现）"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._connection = None
    
    async def _get_connection(self):
        """获取数据库连接（这里需要根据实际数据库类型实现）"""
        # 这是一个示例，实际实现需要根据使用的数据库类型
        # 例如：asyncpg for PostgreSQL, aiomysql for MySQL, aiosqlite for SQLite
        if not self._connection:
            # 示例：使用 aiosqlite
            import aiosqlite
            self._connection = await aiosqlite.connect(self.connection_string)
            await self._init_tables()
        return self._connection
    
    async def _init_tables(self):
        """初始化数据库表"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS audit_events (
            event_id TEXT PRIMARY KEY,
            timestamp DATETIME,
            event_type TEXT,
            level TEXT,
            severity TEXT,
            message TEXT,
            component TEXT,
            user_id TEXT,
            client_ip TEXT,
            adapter_id TEXT,
            adapter_type TEXT,
            duration_ms REAL,
            error_message TEXT,
            details TEXT,
            correlation_id TEXT
        )
        """
        
        create_index_sql = [
            "CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_events(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_event_type ON audit_events(event_type)",
            "CREATE INDEX IF NOT EXISTS idx_user_id ON audit_events(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_component ON audit_events(component)"
        ]
        
        conn = await self._get_connection()
        await conn.execute(create_table_sql)
        for sql in create_index_sql:
            await conn.execute(sql)
        await conn.commit()
    
    async def store_event(self, event: AuditEvent) -> bool:
        """存储审计事件到数据库"""
        try:
            conn = await self._get_connection()
            
            insert_sql = """
            INSERT INTO audit_events (
                event_id, timestamp, event_type, level, severity, message,
                component, user_id, client_ip, adapter_id, adapter_type,
                duration_ms, error_message, details, correlation_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            await conn.execute(insert_sql, (
                event.event_id,
                event.timestamp.isoformat(),
                event.event_type.value if event.event_type else None,
                event.level.value if event.level else None,
                event.severity.value if event.severity else None,
                event.message,
                event.component,
                event.user_id,
                event.client_ip,
                event.adapter_id,
                event.adapter_type,
                event.duration_ms,
                event.error_message,
                json.dumps(event.details) if event.details else None,
                event.correlation_id
            ))
            await conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to store audit event to database: {e}")
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
        offset: int = 0
    ) -> List[AuditEvent]:
        """从数据库查询审计事件"""
        try:
            conn = await self._get_connection()
            
            # 构建查询条件
            conditions = []
            params = []
            
            if start_time:
                conditions.append("timestamp >= ?")
                params.append(start_time.isoformat())
            
            if end_time:
                conditions.append("timestamp <= ?")
                params.append(end_time.isoformat())
            
            if event_types:
                placeholders = ",".join("?" * len(event_types))
                conditions.append(f"event_type IN ({placeholders})")
                params.extend([et.value for et in event_types])
            
            if levels:
                placeholders = ",".join("?" * len(levels))
                conditions.append(f"level IN ({placeholders})")
                params.extend([l.value for l in levels])
            
            if user_id:
                conditions.append("user_id = ?")
                params.append(user_id)
            
            if component:
                conditions.append("component = ?")
                params.append(component)
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            query_sql = f"""
            SELECT * FROM audit_events 
            {where_clause}
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
            """
            
            params.extend([limit, offset])
            
            cursor = await conn.execute(query_sql, params)
            rows = await cursor.fetchall()
            
            events = []
            for row in rows:
                # 将数据库行转换为AuditEvent对象
                event_data = {
                    "event_id": row[0],
                    "timestamp": datetime.fromisoformat(row[1]) if row[1] else datetime.now(),
                    "event_type": AuditEventType(row[2]) if row[2] else None,
                    "level": AuditLevel(row[3]) if row[3] else None,
                    "severity": AuditSeverity(row[4]) if row[4] else AuditSeverity.LOW,
                    "message": row[5] or "",
                    "component": row[6],
                    "user_id": row[7],
                    "client_ip": row[8],
                    "adapter_id": row[9],
                    "adapter_type": row[10],
                    "duration_ms": row[11],
                    "error_message": row[12],
                    "details": json.loads(row[13]) if row[13] else {},
                    "correlation_id": row[14]
                }
                events.append(AuditEvent(**event_data))
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to query audit events from database: {e}")
            return []
    
    async def count_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        levels: Optional[List[AuditLevel]] = None
    ) -> int:
        """统计数据库中的事件数量"""
        try:
            conn = await self._get_connection()
            
            conditions = []
            params = []
            
            if start_time:
                conditions.append("timestamp >= ?")
                params.append(start_time.isoformat())
            
            if end_time:
                conditions.append("timestamp <= ?")
                params.append(end_time.isoformat())
            
            if event_types:
                placeholders = ",".join("?" * len(event_types))
                conditions.append(f"event_type IN ({placeholders})")
                params.extend([et.value for et in event_types])
            
            if levels:
                placeholders = ",".join("?" * len(levels))
                conditions.append(f"level IN ({placeholders})")
                params.extend([l.value for l in levels])
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            query_sql = f"SELECT COUNT(*) FROM audit_events {where_clause}"
            
            cursor = await conn.execute(query_sql, params)
            result = await cursor.fetchone()
            return result[0] if result else 0
            
        except Exception as e:
            logger.error(f"Failed to count audit events in database: {e}")
            return 0
    
    async def cleanup_old_events(self, older_than: datetime) -> int:
        """清理数据库中的旧事件"""
        try:
            conn = await self._get_connection()
            
            delete_sql = "DELETE FROM audit_events WHERE timestamp < ?"
            cursor = await conn.execute(delete_sql, (older_than.isoformat(),))
            await conn.commit()
            
            return cursor.rowcount
            
        except Exception as e:
            logger.error(f"Failed to cleanup old audit events: {e}")
            return 0

class RemoteAuditStorage(AuditStorage):
    """远程审计日志存储（例如发送到日志服务）"""
    
    def __init__(
        self,
        endpoint_url: str,
        api_key: Optional[str] = None,
        batch_size: int = 100,
        timeout: int = 30
    ):
        self.endpoint_url = endpoint_url
        self.api_key = api_key
        self.batch_size = batch_size
        self.timeout = timeout
        self._event_buffer = []
        self._lock = asyncio.Lock()
    
    async def store_event(self, event: AuditEvent) -> bool:
        """存储事件到远程服务"""
        async with self._lock:
            self._event_buffer.append(event)
            
            if len(self._event_buffer) >= self.batch_size:
                return await self._flush_buffer()
        
        return True
    
    async def _flush_buffer(self) -> bool:
        """刷新缓冲区到远程服务"""
        if not self._event_buffer:
            return True
        
        try:
            import aiohttp
            
            # 准备数据
            events_data = [event.to_dict() for event in self._event_buffer]
            
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.post(
                    self.endpoint_url,
                    json={"events": events_data},
                    headers=headers
                ) as response:
                    if response.status == 200:
                        self._event_buffer.clear()
                        return True
                    else:
                        logger.error(f"Failed to send events to remote storage: {response.status}")
                        return False
        
        except Exception as e:
            logger.error(f"Error sending events to remote storage: {e}")
            return False
    
    async def query_events(self, **kwargs) -> List[AuditEvent]:
        """远程存储通常不支持查询，返回空列表"""
        logger.warning("Remote storage does not support querying events")
        return []
    
    async def count_events(self, **kwargs) -> int:
        """远程存储通常不支持计数"""
        logger.warning("Remote storage does not support counting events")
        return 0
    
    async def cleanup_old_events(self, older_than: datetime) -> int:
        """远程存储的清理由远程服务处理"""
        logger.info("Remote storage cleanup is handled by the remote service")
        return 0

class CompositeAuditStorage(AuditStorage):
    """组合审计存储 - 可以同时写入多个存储"""
    
    def __init__(self, storages: List[AuditStorage]):
        self.storages = storages
    
    async def store_event(self, event: AuditEvent) -> bool:
        """存储到所有配置的存储"""
        results = []
        for storage in self.storages:
            try:
                result = await storage.store_event(event)
                results.append(result)
            except Exception as e:
                logger.error(f"Error storing event in {type(storage).__name__}: {e}")
                results.append(False)
        
        # 如果至少有一个存储成功，就认为成功
        return any(results)
    
    async def query_events(self, **kwargs) -> List[AuditEvent]:
        """从第一个支持查询的存储查询"""
        for storage in self.storages:
            try:
                events = await storage.query_events(**kwargs)
                if events:  # 如果找到事件，返回结果
                    return events
            except Exception as e:
                logger.error(f"Error querying events from {type(storage).__name__}: {e}")
                continue
        
        return []
    
    async def count_events(self, **kwargs) -> int:
        """从第一个支持计数的存储获取计数"""
        for storage in self.storages:
            try:
                count = await storage.count_events(**kwargs)
                if count > 0:
                    return count
            except Exception as e:
                logger.error(f"Error counting events from {type(storage).__name__}: {e}")
                continue
        
        return 0
    
    async def cleanup_old_events(self, older_than: datetime) -> int:
        """清理所有存储中的旧事件"""
        total_cleaned = 0
        for storage in self.storages:
            try:
                cleaned = await storage.cleanup_old_events(older_than)
                total_cleaned += cleaned
            except Exception as e:
                logger.error(f"Error cleaning up events in {type(storage).__name__}: {e}")
        
        return total_cleaned

# 全局审计实例
_global_audit_logger = None

def get_audit_logger():
    """获取全局审计记录器"""
    return _global_audit_logger

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
    
    def __init__(
        self,
        storage: AuditStorage,
        config: Optional[AuditConfig] = None
    ):
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
            component="audit_system"
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
            component="audit_system"
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
        **kwargs
    ) -> str:
        """记录审计事件"""
        if not self.config.enabled:
            return ""
        
        # 检查是否应该忽略此事件
        if event_type in self.config.ignored_events:
            return ""
        
        component = kwargs.get('component')
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
            **kwargs
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
            AuditLevel.CRITICAL: 5
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
                        timeout=self.config.flush_interval_seconds
                    )
                    self._batch_events.append(event)
                except asyncio.TimeoutError:
                    pass
                
                # 检查是否需要刷新
                current_time = time.time()
                should_flush = (
                    len(self._batch_events) >= self.config.batch_size or
                    current_time - self._last_flush >= self.config.flush_interval_seconds
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
            logger.warning(f"Failed to store {failed_count}/{len(events_to_flush)} audit events")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "total_events": self._event_count,
            "error_count": self._error_count,
            "queue_size": self._event_queue.qsize() if self._event_queue else 0,
            "batch_size": len(self._batch_events),
            "is_running": self._running
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
            **kwargs
        )
    
    async def log_adapter_execute(self, adapter_id: str, operation: str, duration_ms: float, **kwargs):
        """记录适配器执行事件"""
        return await self.log_event(
            AuditEventType.ADAPTER_EXECUTE,
            f"Adapter {adapter_id} executed operation: {operation}",
            level=AuditLevel.INFO,
            adapter_id=adapter_id,
            duration_ms=duration_ms,
            component="adapter_executor",
            details={"operation": operation},
            **kwargs
        )
    
    async def log_adapter_error(self, adapter_id: str, error: Exception, operation: str = "", **kwargs):
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
            **kwargs
        )
    
    async def log_security_event(self, event_type: AuditEventType, message: str, severity: AuditSeverity, **kwargs):
        """记录安全事件"""
        level = AuditLevel.WARNING if severity in [AuditSeverity.HIGH, AuditSeverity.CRITICAL] else AuditLevel.INFO
        
        return await self.log_event(
            event_type,
            message,
            level=level,
            severity=severity,
            component="security",
            **kwargs
        )
    
    async def log_api_request(self, method: str, path: str, status_code: int, duration_ms: float, **kwargs):
        """记录API请求事件"""
        level = AuditLevel.ERROR if status_code >= 400 else AuditLevel.INFO
        event_type = AuditEventType.API_ERROR if status_code >= 400 else AuditEventType.API_REQUEST
        
        return await self.log_event(
            event_type,
            f"{method} {path} - {status_code}",
            level=level,
            duration_ms=duration_ms,
            component="api",
            details={
                "method": method,
                "path": path,
                "status_code": status_code
            },
            **kwargs
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
            **kwargs
        )

# 审计中间件
class AuditMiddleware:
    """审计中间件 - 自动捕获API调用和适配器操作"""
    
    def __init__(self, audit_logger: AuditLogger):
        self.audit_logger = audit_logger
    
    async def __call__(self, request, call_next):
        """FastAPI中间件处理函数"""
        start_time = time.time()
        
        # 提取请求信息
        method = request.method
        path = str(request.url.path)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        # 生成关联ID
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        
        try:
            # 执行请求
            response = await call_next(request)
            
            # 计算耗时
            duration_ms = (time.time() - start_time) * 1000
            
            # 记录API请求事件
            await self.audit_logger.log_api_request(
                method=method,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                correlation_id=correlation_id
            )
            
            return response
            
        except Exception as e:
            # 记录API错误事件
            duration_ms = (time.time() - start_time) * 1000
            
            await self.audit_logger.log_event(
                AuditEventType.API_ERROR,
                f"API error: {method} {path} - {str(e)}",
                level=AuditLevel.ERROR,
                severity=AuditSeverity.HIGH,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                correlation_id=correlation_id,
                error_message=str(e),
                component="api"
            )
            raise

# 装饰器支持
def audit_operation(
    event_type: AuditEventType,
    message_template: str = "",
    level: AuditLevel = AuditLevel.INFO,
    capture_args: bool = False,
    capture_result: bool = False
):
    """审计操作装饰器"""
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @asyncio.wraps(func)
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
                        "correlation_id": correlation_id
                    }
                    
                    if capture_args:
                        audit_data["details"] = {
                            "args": str(args)[:1000],  # 限制长度
                            "kwargs": str({k: str(v)[:100] for k, v in kwargs.items()})
                        }
                    
                    # 执行函数
                    result = await func(*args, **kwargs)
                    
                    # 记录成功事件
                    duration_ms = (time.time() - start_time) * 1000
                    message = message_template.format(
                        func_name=func.__name__,
                        duration_ms=duration_ms
                    ) or f"Operation {func.__name__} completed successfully"
                    
                    if capture_result:
                        audit_data["details"] = audit_data.get("details", {})
                        audit_data["details"]["result"] = str(result)[:1000]
                    
                    await audit_logger.log_event(
                        event_type,
                        message,
                        level=level,
                        duration_ms=duration_ms,
                        **audit_data
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
                        component=func.__module__
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
                            asyncio.create_task(audit_logger.log_event(
                                event_type,
                                f"Operation {func.__name__} completed successfully",
                                level=level,
                                duration_ms=(time.time() - start_time) * 1000,
                                component=func.__module__,
                                correlation_id=correlation_id
                            ))
                    except:
                        pass  # 忽略审计错误，不影响主要功能
                    
                    return result
                    
                except Exception as e:
                    # 尝试记录错误事件
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            asyncio.create_task(audit_logger.log_event(
                                AuditEventType.ADAPTER_ERROR,
                                f"Operation {func.__name__} failed: {str(e)}",
                                level=AuditLevel.ERROR,
                                severity=AuditSeverity.HIGH,
                                duration_ms=(time.time() - start_time) * 1000,
                                error_message=str(e),
                                correlation_id=correlation_id,
                                component=func.__module__
                            ))
                    except:
                        pass
                    raise
            
            return sync_wrapper
    return decorator

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

# 审计查询和分析功能
class AuditAnalyzer:
    """审计日志分析器"""
    
    def __init__(self, storage: AuditStorage):
        self.storage = storage
    
    async def get_event_statistics(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        group_by: str = "event_type"  # event_type, level, component, hour, day
    ) -> Dict[str, int]:
        """获取事件统计信息"""
        events = await self.storage.query_events(
            start_time=start_time,
            end_time=end_time,
            limit=10000
        )
        
        stats = defaultdict(int)
        
        for event in events:
            if group_by == "event_type":
                key = event.event_type.value if event.event_type else "unknown"
            elif group_by == "level":
                key = event.level.value if event.level else "unknown"
            elif group_by == "component":
                key = event.component or "unknown"
            elif group_by == "hour":
                key = event.timestamp.strftime("%Y-%m-%d %H:00")
            elif group_by == "day":
                key = event.timestamp.strftime("%Y-%m-%d")
            else:
                key = "all"
            
            stats[key] += 1
        
        return dict(stats)
    
    async def detect_anomalies(
        self,
        time_window_hours: int = 24,
        error_threshold: float = 0.1,  # 错误率阈值
        request_threshold: int = 1000   # 请求量阈值
    ) -> List[Dict[str, Any]]:
        """检测异常模式"""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=time_window_hours)
        
        events = await self.storage.query_events(
            start_time=start_time,
            end_time=end_time,
            limit=10000
        )
        
        anomalies = []
        
        # 按小时分组统计
        hourly_stats = defaultdict(lambda: {"total": 0, "errors": 0})
        
        for event in events:
            hour_key = event.timestamp.strftime("%Y-%m-%d %H:00")
            hourly_stats[hour_key]["total"] += 1
            
            if event.level in [AuditLevel.ERROR, AuditLevel.CRITICAL]:
                hourly_stats[hour_key]["errors"] += 1
        
        # 检测异常
        for hour, stats in hourly_stats.items():
            error_rate = stats["errors"] / stats["total"] if stats["total"] > 0 else 0
            
            # 高错误率异常
            if error_rate > error_threshold and stats["total"] > 10:
                anomalies.append({
                    "type": "high_error_rate",
                    "time": hour,
                    "error_rate": error_rate,
                    "total_requests": stats["total"],
                    "error_count": stats["errors"]
                })
            
            # 高请求量异常
            if stats["total"] > request_threshold:
                anomalies.append({
                    "type": "high_request_volume",
                    "time": hour,
                    "request_count": stats["total"]
                })
        
        return anomalies
    
    async def get_security_summary(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """获取安全事件摘要"""
        security_events = await self.storage.query_events(
            start_time=start_time,
            end_time=end_time,
            event_types=[
                AuditEventType.AUTH_FAILED,
                AuditEventType.PERMISSION_DENIED,
                AuditEventType.SECURITY_VIOLATION
            ],
            limit=1000
        )
        
        summary = {
            "total_security_events": len(security_events),
            "auth_failures": 0,
            "permission_denials": 0,
            "security_violations": 0,
            "top_failed_ips": defaultdict(int),
            "top_failed_users": defaultdict(int)
        }
        
        for event in security_events:
            if event.event_type == AuditEventType.AUTH_FAILED:
                summary["auth_failures"] += 1
            elif event.event_type == AuditEventType.PERMISSION_DENIED:
                summary["permission_denials"] += 1
            elif event.event_type == AuditEventType.SECURITY_VIOLATION:
                summary["security_violations"] += 1
            
            # 统计失败的IP和用户
            if event.client_ip:
                summary["top_failed_ips"][event.client_ip] += 1
            if event.user_id:
                summary["top_failed_users"][event.user_id] += 1
        
        # 转换为排序列表
        summary["top_failed_ips"] = sorted(
            summary["top_failed_ips"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        summary["top_failed_users"] = sorted(
            summary["top_failed_users"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return summary

# 安全审计功能
class SecurityAuditor:
    """安全审计器"""
    
    def __init__(self, audit_logger: AuditLogger):
        self.audit_logger = audit_logger
        self._failed_attempts = defaultdict(list)  # IP -> [timestamp, ...]
        self._user_sessions = defaultdict(set)     # user_id -> {session_id, ...}
        self._suspicious_patterns = []
    
    async def log_authentication_attempt(
        self,
        user_id: str,
        success: bool,
        client_ip: str,
        user_agent: str = "",
        **kwargs
    ):
        """记录认证尝试"""
        if success:
            event_type = AuditEventType.AUTH_LOGIN
            level = AuditLevel.INFO
            severity = AuditSeverity.LOW
            message = f"User {user_id} logged in successfully"
        else:
            event_type = AuditEventType.AUTH_FAILED
            level = AuditLevel.WARNING
            severity = AuditSeverity.MEDIUM
            message = f"Failed login attempt for user {user_id}"
            
            # 记录失败尝试
            current_time = datetime.now()
            self._failed_attempts[client_ip].append(current_time)
            
            # 清理旧记录（保留最近1小时）
            cutoff_time = current_time - timedelta(hours=1)
            self._failed_attempts[client_ip] = [
                t for t in self._failed_attempts[client_ip] if t > cutoff_time
            ]
            
            # 检查是否需要告警
            if len(self._failed_attempts[client_ip]) >= 5:
                await self.audit_logger.log_security_event(
                    AuditEventType.SECURITY_VIOLATION,
                    f"Multiple failed login attempts from IP {client_ip}",
                    AuditSeverity.HIGH,
                    client_ip=client_ip,
                    details={"failed_attempts": len(self._failed_attempts[client_ip])}
                )
        
        return await self.audit_logger.log_security_event(
            event_type,
            message,
            severity,
            user_id=user_id,
            client_ip=client_ip,
            user_agent=user_agent,
            **kwargs
        )
    
    async def log_permission_check(
        self,
        user_id: str,
        resource: str,
        action: str,
        granted: bool,
        **kwargs
    ):
        """记录权限检查"""
        if granted:
            # 成功的权限检查通常不需要记录，除非是敏感操作
            if self._is_sensitive_operation(resource, action):
                return await self.audit_logger.log_security_event(
                    AuditEventType.DATA_ACCESS,
                    f"User {user_id} accessed sensitive resource {resource}",
                    AuditSeverity.MEDIUM,
                    user_id=user_id,
                    details={"resource": resource, "action": action},
                    **kwargs
                )
        else:
            return await self.audit_logger.log_security_event(
                AuditEventType.PERMISSION_DENIED,
                f"Permission denied: User {user_id} attempted {action} on {resource}",
                AuditSeverity.MEDIUM,
                user_id=user_id,
                details={"resource": resource, "action": action},
                **kwargs
            )
    
    def _is_sensitive_operation(self, resource: str, action: str) -> bool:
        """判断是否为敏感操作"""
        sensitive_resources = ["user_data", "config", "logs", "admin"]
        sensitive_actions = ["delete", "modify", "export"]
        
        return (
            any(sr in resource.lower() for sr in sensitive_resources) or
            any(sa in action.lower() for sa in sensitive_actions)
        )
    
    async def log_data_modification(
        self,
        user_id: str,
        resource: str,
        operation: str,
        old_value: Any = None,
        new_value: Any = None,
        **kwargs
    ):
        """记录数据修改"""
        details = {
            "resource": resource,
            "operation": operation
        }
        
        # 记录变更详情（注意不要记录敏感信息）
        if old_value is not None and not self._is_sensitive_data(old_value):
            details["old_value"] = str(old_value)[:500]
        if new_value is not None and not self._is_sensitive_data(new_value):
            details["new_value"] = str(new_value)[:500]
        
        return await self.audit_logger.log_security_event(
            AuditEventType.DATA_MODIFY,
            f"User {user_id} modified {resource}: {operation}",
            AuditSeverity.MEDIUM,
            user_id=user_id,
            details=details,
            **kwargs
        )
    
    def _is_sensitive_data(self, data: Any) -> bool:
        """判断是否为敏感数据"""
        if isinstance(data, str):
            sensitive_keywords = ["password", "token", "secret", "key", "credential"]
            return any(keyword in data.lower() for keyword in sensitive_keywords)
        return False
    
    async def detect_suspicious_activity(self, user_id: str, **kwargs) -> bool:
        """检测可疑活动"""
        # 这里可以实现更复杂的可疑活动检测逻辑
        # 例如：异常登录时间、异常IP地址、异常操作模式等
        
        # 简单示例：检测是否在异常时间登录
        current_hour = datetime.now().hour
        if current_hour < 6 or current_hour > 22:  # 凌晨6点前或晚上10点后
            await self.audit_logger.log_security_event(
                AuditEventType.SECURITY_VIOLATION,
                f"Unusual login time for user {user_id}",
                AuditSeverity.LOW,
                user_id=user_id,
                details={"login_hour": current_hour},
                **kwargs
            )
            return True
        
        return False

# 适配器集成装饰器
def audit_adapter_operation(operation_name: str = ""):
    """适配器操作审计装饰器"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            audit_logger = get_audit_logger()
            if not audit_logger:
                return await func(self, *args, **kwargs)
            
            adapter_id = getattr(self, 'adapter_id', self.__class__.__name__)
            adapter_type = getattr(self, 'adapter_type', 'unknown')
            operation = operation_name or func.__name__
            
            start_time = time.time()
            
            try:
                result = await func(self, *args, **kwargs)
                
                duration_ms = (time.time() - start_time) * 1000
                await audit_logger.log_adapter_execute(
                    adapter_id=adapter_id,
                    operation=operation,
                    duration_ms=duration_ms,
                    adapter_type=adapter_type
                )
                
                return result
                
            except Exception as e:
                await audit_logger.log_adapter_error(
                    adapter_id=adapter_id,
                    error=e,
                    operation=operation,
                    adapter_type=adapter_type
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
                        adapter_id = getattr(self, 'adapter_id', self.__class__.__name__)
                        try:
                            loop = asyncio.get_event_loop()
                            if loop.is_running():
                                asyncio.create_task(audit_logger.log_adapter_error(
                                    adapter_id=adapter_id,
                                    error=e,
                                    operation=operation_name or func.__name__
                                ))
                        except:
                            pass
                    raise
            return sync_wrapper
    
    return decorator

# 使用示例和工具函数
async def create_audit_report(
    storage: AuditStorage,
    start_time: datetime,
    end_time: datetime,
    output_file: Optional[str] = None
) -> Dict[str, Any]:
    """创建审计报告"""
    analyzer = AuditAnalyzer(storage)
    
    # 收集各种统计信息
    report = {
        "period": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "event_statistics": await analyzer.get_event_statistics(start_time, end_time),
        "level_statistics": await analyzer.get_event_statistics(start_time, end_time, "level"),
        "component_statistics": await analyzer.get_event_statistics(start_time, end_time, "component"),
        "daily_statistics": await analyzer.get_event_statistics(start_time, end_time, "day"),
        "anomalies": await analyzer.detect_anomalies(),
        "security_summary": await analyzer.get_security_summary(start_time, end_time),
        "total_events": await storage.count_events(start_time, end_time)
    }
    
    # 如果指定了输出文件，保存报告
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    return report

# 动态配置管理
class AuditConfigManager:
    """审计配置管理器 - 支持动态配置更新"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config_file = config_file
        self._config = AuditConfig()
        self._watchers = []  # 配置变更监听器
        self._last_modified = None
        
        if config_file:
            self.load_config()
    
    def load_config(self) -> AuditConfig:
        """从文件加载配置"""
        if not self.config_file or not Path(self.config_file).exists():
            return self._config
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            # 更新配置
            for key, value in config_data.items():
                if hasattr(self._config, key):
                    # 处理特殊类型
                    if key == "default_level":
                        value = AuditLevel(value)
                    elif key == "component_levels":
                        value = {k: AuditLevel(v) for k, v in value.items()}
                    elif key == "ignored_events":
                        value = {AuditEventType(event) for event in value}
                    elif key == "ignored_components":
                        value = set(value)
                    
                    setattr(self._config, key, value)
            
            # 更新文件修改时间
            self._last_modified = Path(self.config_file).stat().st_mtime
            
            # 通知监听器
            self._notify_watchers()
            
            logger.info(f"Loaded audit configuration from {self.config_file}")
            
        except Exception as e:
            logger.error(f"Failed to load audit configuration: {e}")
        
        return self._config
    
    def save_config(self) -> bool:
        """保存配置到文件"""
        if not self.config_file:
            return False
        
        try:
            config_data = {}
            
            # 转换配置为可序列化格式
            for field_name, field_value in self._config.__dict__.items():
                if isinstance(field_value, Enum):
                    config_data[field_name] = field_value.value
                elif isinstance(field_value, dict):
                    if field_name == "component_levels":
                        config_data[field_name] = {k: v.value for k, v in field_value.items()}
                    else:
                        config_data[field_name] = field_value
                elif isinstance(field_value, set):
                    if field_name == "ignored_events":
                        config_data[field_name] = [event.value for event in field_value]
                    else:
                        config_data[field_name] = list(field_value)
                else:
                    config_data[field_name] = field_value
            
            # 确保目录存在
            Path(self.config_file).parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Saved audit configuration to {self.config_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save audit configuration: {e}")
            return False
    
    def update_config(self, **kwargs) -> bool:
        """动态更新配置"""
        try:
            for key, value in kwargs.items():
                if hasattr(self._config, key):
                    setattr(self._config, key, value)
            
            # 保存到文件
            if self.config_file:
                self.save_config()
            
            # 通知监听器
            self._notify_watchers()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update audit configuration: {e}")
            return False
    
    def get_config(self) -> AuditConfig:
        """获取当前配置"""
        # 检查文件是否有更新
        if self.config_file and Path(self.config_file).exists():
            current_modified = Path(self.config_file).stat().st_mtime
            if self._last_modified is None or current_modified > self._last_modified:
                self.load_config()
        
        return self._config
    
    def add_watcher(self, callback: Callable[[AuditConfig], None]):
        """添加配置变更监听器"""
        self._watchers.append(callback)
    
    def remove_watcher(self, callback: Callable[[AuditConfig], None]):
        """移除配置变更监听器"""
        if callback in self._watchers:
            self._watchers.remove(callback)
    
    def _notify_watchers(self):
        """通知所有监听器配置已变更"""
        for watcher in self._watchers:
            try:
                watcher(self._config)
            except Exception as e:
                logger.error(f"Error notifying config watcher: {e}")
    
    # 便捷方法
    def set_component_level(self, component: str, level: AuditLevel):
        """设置组件日志级别"""
        self._config.component_levels[component] = level
        self._notify_watchers()
    
    def ignore_event_type(self, event_type: AuditEventType):
        """忽略特定事件类型"""
        self._config.ignored_events.add(event_type)
        self._notify_watchers()
    
    def ignore_component(self, component: str):
        """忽略特定组件"""
        self._config.ignored_components.add(component)
        self._notify_watchers()
    
    def set_alert_threshold(self, event_type: str, threshold: int):
        """设置告警阈值"""
        self._config.alert_threshold[event_type] = threshold
        self._notify_watchers()

# 工厂函数
def create_audit_storage(storage_type: str, **kwargs) -> AuditStorage:
    """根据类型创建审计存储"""
    if storage_type == "file":
        return FileAuditStorage(**kwargs)
    elif storage_type == "database":
        return DatabaseAuditStorage(**kwargs)
    elif storage_type == "remote":
        return RemoteAuditStorage(**kwargs)
    elif storage_type == "composite":
        storages = kwargs.get("storages", [])
        return CompositeAuditStorage(storages)
    else:
        raise ValueError(f"Unknown storage type: {storage_type}")

async def setup_audit_system_from_config(config_file: str) -> Tuple[AuditLogger, AuditConfigManager]:
    """从配置文件设置审计系统"""
    # 创建配置管理器
    config_manager = AuditConfigManager(config_file)
    config = config_manager.get_config()
    
    # 创建存储
    storage_config = config.storage_config or {}
    storage = create_audit_storage(config.storage_type, **storage_config)
    
    # 创建审计记录器
    audit_logger = AuditLogger(storage, config)
    
    # 设置配置变更监听器
    def on_config_change(new_config: AuditConfig):
        audit_logger.config = new_config
        logger.info("Audit configuration updated")
    
    config_manager.add_watcher(on_config_change)
    
    # 启动审计系统
    await audit_logger.start()
    
    return audit_logger, config_manager

# 使用示例配置
EXAMPLE_CONFIG = {
    "enabled": True,
    "storage_type": "file",
    "default_level": "INFO",
    "component_levels": {
        "adapter_manager": "DEBUG",
        "security": "WARNING"
    },
    "storage_config": {
        "log_directory": "./logs/audit",
        "max_file_size": 104857600,
        "backup_count": 10
    },
    "retention_days": 30,
    "auto_cleanup": True,
    "cleanup_interval_hours": 24,
    "async_storage": True,
    "batch_size": 100,
    "flush_interval_seconds": 5,
    "ignored_events": [],
    "ignored_components": ["health_check"],
    "alert_on_errors": True,
    "alert_threshold": {
        "auth_failed": 5,
        "api_error": 10
    }
}

def create_example_config_file(config_file: str):
    """创建示例配置文件"""
    Path(config_file).parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(EXAMPLE_CONFIG, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Created example audit configuration file: {config_file}")

# 命令行工具函数
async def audit_cli_report(
    storage_type: str = "file",
    storage_config: Dict[str, Any] = None,
    days: int = 7,
    output_file: str = None
):
    """命令行审计报告生成"""
    if storage_config is None:
        storage_config = {"log_directory": "./logs/audit"}
    
    storage = create_audit_storage(storage_type, **storage_config)
    
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)
    
    report = await create_audit_report(storage, start_time, end_time, output_file)
    
    if not output_file:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    
    return report
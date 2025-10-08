"""
存储接口定义
定义了适配器系统的持久化存储抽象接口
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union, AsyncIterator
from datetime import datetime
from enum import Enum
import asyncio
from dataclasses import dataclass

from ..models import AdapterRegistration, AdapterConfiguration, AdapterIdentity


class StorageBackendType(Enum):
    """存储后端类型"""

    MEMORY = "memory"
    FILE = "file"
    SQLITE = "sqlite"
    POSTGRESQL = "postgresql"
    MONGODB = "mongodb"
    REDIS = "redis"


class StorageOperationType(Enum):
    """存储操作类型"""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"
    SEARCH = "search"


@dataclass
class StorageQuery:
    """存储查询条件"""

    filters: Dict[str, Any]
    sort_by: Optional[str] = None
    sort_order: str = "asc"  # asc or desc
    limit: Optional[int] = None
    offset: Optional[int] = None
    include_fields: Optional[List[str]] = None
    exclude_fields: Optional[List[str]] = None


@dataclass
class StorageResult:
    """存储操作结果"""

    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    operation_time: Optional[datetime] = None


@dataclass
class StorageTransaction:
    """存储事务"""

    transaction_id: str
    operations: List[Dict[str, Any]]
    created_at: datetime
    status: str = "pending"  # pending, committed, rolled_back


class IStorageBackend(ABC):
    """存储后端接口"""

    @property
    @abstractmethod
    def backend_type(self) -> StorageBackendType:
        """获取后端类型"""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """检查连接状态"""
        pass

    @abstractmethod
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到存储后端"""
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """断开存储后端连接"""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        pass

    # 基础CRUD操作
    @abstractmethod
    async def create(
        self,
        collection: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """创建记录"""
        pass

    @abstractmethod
    async def read(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """读取记录"""
        pass

    @abstractmethod
    async def update(
        self,
        collection: str,
        key: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """更新记录"""
        pass

    @abstractmethod
    async def delete(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """删除记录"""
        pass

    @abstractmethod
    async def list(
        self,
        collection: str,
        query: Optional[StorageQuery] = None,
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """列出记录"""
        pass

    @abstractmethod
    async def search(
        self, collection: str, query: StorageQuery, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """搜索记录"""
        pass

    # 批量操作
    @abstractmethod
    async def batch_create(
        self,
        collection: str,
        data_list: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量创建"""
        pass

    @abstractmethod
    async def batch_update(
        self,
        collection: str,
        updates: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量更新"""
        pass

    @abstractmethod
    async def batch_delete(
        self, collection: str, keys: List[str], transaction_id: Optional[str] = None
    ) -> StorageResult:
        """批量删除"""
        pass

    # 事务支持
    @abstractmethod
    async def begin_transaction(self) -> str:
        """开始事务"""
        pass

    @abstractmethod
    async def commit_transaction(self, transaction_id: str) -> bool:
        """提交事务"""
        pass

    @abstractmethod
    async def rollback_transaction(self, transaction_id: str) -> bool:
        """回滚事务"""
        pass

    # 索引管理
    @abstractmethod
    async def create_index(
        self, collection: str, fields: List[str], unique: bool = False
    ) -> bool:
        """创建索引"""
        pass

    @abstractmethod
    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        pass

    @abstractmethod
    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        pass


class IAdapterStorage(ABC):
    """适配器存储接口"""

    @abstractmethod
    async def save_registration(self, registration: AdapterRegistration) -> bool:
        """保存适配器注册信息"""
        pass

    @abstractmethod
    async def load_registration(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """加载适配器注册信息"""
        pass

    @abstractmethod
    async def update_registration(
        self, adapter_id: str, registration: AdapterRegistration
    ) -> bool:
        """更新适配器注册信息"""
        pass

    @abstractmethod
    async def delete_registration(self, adapter_id: str) -> bool:
        """删除适配器注册信息"""
        pass

    @abstractmethod
    async def list_registrations(
        self, filters: Optional[Dict[str, Any]] = None
    ) -> List[AdapterRegistration]:
        """列出适配器注册信息"""
        pass

    @abstractmethod
    async def save_configuration(
        self, adapter_id: str, config: AdapterConfiguration
    ) -> bool:
        """保存适配器配置"""
        pass

    @abstractmethod
    async def load_configuration(
        self, adapter_id: str
    ) -> Optional[AdapterConfiguration]:
        """加载适配器配置"""
        pass

    @abstractmethod
    async def save_state(self, adapter_id: str, state: Dict[str, Any]) -> bool:
        """保存适配器状态"""
        pass

    @abstractmethod
    async def load_state(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """加载适配器状态"""
        pass

    @abstractmethod
    async def save_metrics(self, adapter_id: str, metrics: Dict[str, Any]) -> bool:
        """保存适配器指标"""
        pass

    @abstractmethod
    async def load_metrics(
        self, adapter_id: str, time_range: Optional[tuple] = None
    ) -> List[Dict[str, Any]]:
        """加载适配器指标"""
        pass


class IStorageEventListener(ABC):
    """存储事件监听器接口"""

    @abstractmethod
    async def on_before_operation(
        self, operation: StorageOperationType, collection: str, data: Any
    ) -> bool:
        """操作前事件"""
        pass

    @abstractmethod
    async def on_after_operation(
        self, operation: StorageOperationType, collection: str, result: StorageResult
    ) -> None:
        """操作后事件"""
        pass

    @abstractmethod
    async def on_error(
        self, operation: StorageOperationType, collection: str, error: Exception
    ) -> None:
        """错误事件"""
        pass


class IStorageMiddleware(ABC):
    """存储中间件接口"""

    @abstractmethod
    async def process_request(
        self, operation: StorageOperationType, collection: str, data: Any
    ) -> Any:
        """处理请求"""
        pass

    @abstractmethod
    async def process_response(
        self, operation: StorageOperationType, collection: str, result: StorageResult
    ) -> StorageResult:
        """处理响应"""
        pass


@dataclass
class StorageConfiguration:
    """存储配置"""

    backend_type: StorageBackendType
    connection_config: Dict[str, Any]
    pool_size: int = 10
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 1.0
    enable_transactions: bool = True
    enable_caching: bool = False
    cache_ttl: int = 300
    enable_compression: bool = False
    enable_encryption: bool = False
    encryption_key: Optional[str] = None
    middleware: List[str] = None
    event_listeners: List[str] = None

    def __post_init__(self):
        if self.middleware is None:
            self.middleware = []
        if self.event_listeners is None:
            self.event_listeners = []


class StorageException(Exception):
    """存储异常基类"""

    def __init__(
        self,
        message: str,
        operation: Optional[StorageOperationType] = None,
        collection: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.operation = operation
        self.collection = collection
        self.details = details or {}


class ConnectionError(StorageException):
    """连接错误"""

    pass


class TransactionError(StorageException):
    """事务错误"""

    pass


class ValidationError(StorageException):
    """验证错误"""

    pass


class NotFoundError(StorageException):
    """未找到错误"""

    pass


class DuplicateError(StorageException):
    """重复错误"""

    pass


class TimeoutError(StorageException):
    """超时错误"""

    pass

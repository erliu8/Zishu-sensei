"""
内存存储后端实现
提供基于内存的存储功能，适用于开发和测试环境
"""

import asyncio
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime
from collections import defaultdict
import copy
import threading
from concurrent.futures import ThreadPoolExecutor

from ..interfaces import (
    IStorageBackend,
    StorageBackendType,
    StorageQuery,
    StorageResult,
    StorageTransaction,
    StorageException,
    NotFoundError,
    DuplicateError,
    ValidationError,
)


class MemoryStorageBackend(IStorageBackend):
    """内存存储后端"""

    def __init__(self):
        self._connected = False
        self._data: Dict[str, Dict[str, Any]] = defaultdict(dict)
        self._indexes: Dict[str, Dict[str, List[str]]] = defaultdict(dict)
        self._transactions: Dict[str, StorageTransaction] = {}
        self._transaction_data: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)

    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.MEMORY

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到内存存储"""
        try:
            # 内存存储不需要真实连接，直接标记为已连接
            self._connected = True
            return True
        except Exception as e:
            raise StorageException(f"Failed to connect to memory storage: {e}")

    async def disconnect(self) -> bool:
        """断开内存存储连接"""
        try:
            with self._lock:
                self._connected = False
                self._data.clear()
                self._indexes.clear()
                self._transactions.clear()
                self._transaction_data.clear()
            return True
        except Exception as e:
            raise StorageException(f"Failed to disconnect from memory storage: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        with self._lock:
            collections_count = len(self._data)
            total_records = sum(len(collection) for collection in self._data.values())
            active_transactions = len(
                [t for t in self._transactions.values() if t.status == "pending"]
            )

            return {
                "status": "healthy" if self._connected else "disconnected",
                "backend_type": self.backend_type.value,
                "collections_count": collections_count,
                "total_records": total_records,
                "active_transactions": active_transactions,
                "memory_usage": {
                    "data_size": len(str(self._data)),
                    "indexes_count": sum(len(idx) for idx in self._indexes.values()),
                },
            }

    def _generate_key(self, data: Dict[str, Any]) -> str:
        """生成唯一键"""
        if "id" in data:
            return str(data["id"])
        elif "_id" in data:
            return str(data["_id"])
        else:
            return str(uuid.uuid4())

    def _apply_query_filters(
        self, data: Dict[str, Any], query: StorageQuery
    ) -> List[Dict[str, Any]]:
        """应用查询过滤器"""
        results = []

        for key, record in data.items():
            # 应用过滤器
            match = True
            for field, value in query.filters.items():
                if field not in record:
                    match = False
                    break

                record_value = record[field]

                # 支持不同的过滤操作
                if isinstance(value, dict):
                    for op, op_value in value.items():
                        if op == "$eq" and record_value != op_value:
                            match = False
                            break
                        elif op == "$ne" and record_value == op_value:
                            match = False
                            break
                        elif op == "$gt" and record_value <= op_value:
                            match = False
                            break
                        elif op == "$gte" and record_value < op_value:
                            match = False
                            break
                        elif op == "$lt" and record_value >= op_value:
                            match = False
                            break
                        elif op == "$lte" and record_value > op_value:
                            match = False
                            break
                        elif op == "$in" and record_value not in op_value:
                            match = False
                            break
                        elif op == "$nin" and record_value in op_value:
                            match = False
                            break
                        elif op == "$regex":
                            import re

                            if not re.search(op_value, str(record_value)):
                                match = False
                                break
                else:
                    if record_value != value:
                        match = False
                        break

            if match:
                record_copy = copy.deepcopy(record)
                record_copy["_key"] = key
                results.append(record_copy)

        # 排序
        if query.sort_by:
            reverse = query.sort_order == "desc"
            results.sort(key=lambda x: x.get(query.sort_by, ""), reverse=reverse)

        # 分页
        if query.offset:
            results = results[query.offset :]
        if query.limit:
            results = results[: query.limit]

        # 字段选择
        if query.include_fields:
            results = [
                {
                    k: v
                    for k, v in record.items()
                    if k in query.include_fields or k == "_key"
                }
                for record in results
            ]
        elif query.exclude_fields:
            results = [
                {k: v for k, v in record.items() if k not in query.exclude_fields}
                for record in results
            ]

        return results

    def _get_data_source(
        self, collection: str, transaction_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取数据源"""
        if transaction_id and transaction_id in self._transaction_data:
            return self._transaction_data[transaction_id].get(collection, {})
        return self._data[collection]

    def _update_data_source(
        self, collection: str, key: str, data: Any, transaction_id: Optional[str] = None
    ) -> None:
        """更新数据源"""
        if transaction_id and transaction_id in self._transaction_data:
            if collection not in self._transaction_data[transaction_id]:
                self._transaction_data[transaction_id][collection] = copy.deepcopy(
                    self._data[collection]
                )
            self._transaction_data[transaction_id][collection][key] = data
        else:
            self._data[collection][key] = data

    def _delete_from_data_source(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> None:
        """从数据源删除"""
        if transaction_id and transaction_id in self._transaction_data:
            if collection not in self._transaction_data[transaction_id]:
                self._transaction_data[transaction_id][collection] = copy.deepcopy(
                    self._data[collection]
                )
            if key in self._transaction_data[transaction_id][collection]:
                del self._transaction_data[transaction_id][collection][key]
        else:
            if key in self._data[collection]:
                del self._data[collection][key]

    async def create(
        self,
        collection: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """创建记录"""
        try:
            with self._lock:
                key = self._generate_key(data)
                data_source = self._get_data_source(collection, transaction_id)

                if key in data_source:
                    return StorageResult(
                        success=False, error=f"Record with key '{key}' already exists"
                    )

                record = copy.deepcopy(data)
                record["_created_at"] = datetime.utcnow().isoformat()
                record["_updated_at"] = record["_created_at"]

                self._update_data_source(collection, key, record, transaction_id)

                return StorageResult(
                    success=True,
                    data={"key": key, "record": record},
                    operation_time=datetime.utcnow(),
                )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def read(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """读取记录"""
        try:
            with self._lock:
                data_source = self._get_data_source(collection, transaction_id)

                if key not in data_source:
                    return StorageResult(
                        success=False, error=f"Record with key '{key}' not found"
                    )

                record = copy.deepcopy(data_source[key])

                return StorageResult(
                    success=True, data=record, operation_time=datetime.utcnow()
                )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def update(
        self,
        collection: str,
        key: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """更新记录"""
        try:
            with self._lock:
                data_source = self._get_data_source(collection, transaction_id)

                if key not in data_source:
                    return StorageResult(
                        success=False, error=f"Record with key '{key}' not found"
                    )

                record = copy.deepcopy(data_source[key])
                record.update(data)
                record["_updated_at"] = datetime.utcnow().isoformat()

                self._update_data_source(collection, key, record, transaction_id)

                return StorageResult(
                    success=True, data=record, operation_time=datetime.utcnow()
                )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def delete(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """删除记录"""
        try:
            with self._lock:
                data_source = self._get_data_source(collection, transaction_id)

                if key not in data_source:
                    return StorageResult(
                        success=False, error=f"Record with key '{key}' not found"
                    )

                record = copy.deepcopy(data_source[key])
                self._delete_from_data_source(collection, key, transaction_id)

                return StorageResult(
                    success=True, data=record, operation_time=datetime.utcnow()
                )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def list(
        self,
        collection: str,
        query: Optional[StorageQuery] = None,
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """列出记录"""
        try:
            with self._lock:
                data_source = self._get_data_source(collection, transaction_id)

                if query is None:
                    query = StorageQuery(filters={})

                results = self._apply_query_filters(data_source, query)

                return StorageResult(
                    success=True,
                    data=results,
                    metadata={"total_count": len(results)},
                    operation_time=datetime.utcnow(),
                )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def search(
        self, collection: str, query: StorageQuery, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """搜索记录"""
        # 内存存储中，搜索和列出功能相同
        return await self.list(collection, query, transaction_id)

    async def batch_create(
        self,
        collection: str,
        data_list: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量创建"""
        try:
            results = []
            errors = []

            for data in data_list:
                result = await self.create(collection, data, transaction_id)
                if result.success:
                    results.append(result.data)
                else:
                    errors.append(result.error)

            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={"created_count": len(results), "error_count": len(errors)},
                operation_time=datetime.utcnow(),
            )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def batch_update(
        self,
        collection: str,
        updates: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量更新"""
        try:
            results = []
            errors = []

            for update_data in updates:
                key = update_data.pop("_key", None)
                if not key:
                    errors.append("Missing '_key' in update data")
                    continue

                result = await self.update(collection, key, update_data, transaction_id)
                if result.success:
                    results.append(result.data)
                else:
                    errors.append(result.error)

            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={"updated_count": len(results), "error_count": len(errors)},
                operation_time=datetime.utcnow(),
            )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def batch_delete(
        self, collection: str, keys: List[str], transaction_id: Optional[str] = None
    ) -> StorageResult:
        """批量删除"""
        try:
            results = []
            errors = []

            for key in keys:
                result = await self.delete(collection, key, transaction_id)
                if result.success:
                    results.append(result.data)
                else:
                    errors.append(result.error)

            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={"deleted_count": len(results), "error_count": len(errors)},
                operation_time=datetime.utcnow(),
            )
        except Exception as e:
            return StorageResult(success=False, error=str(e))

    async def begin_transaction(self) -> str:
        """开始事务"""
        transaction_id = str(uuid.uuid4())

        with self._lock:
            self._transactions[transaction_id] = StorageTransaction(
                transaction_id=transaction_id,
                operations=[],
                created_at=datetime.utcnow(),
                status="pending",
            )
            self._transaction_data[transaction_id] = {}

        return transaction_id

    async def commit_transaction(self, transaction_id: str) -> bool:
        """提交事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False

                # 将事务数据合并到主数据中
                if transaction_id in self._transaction_data:
                    for collection, data in self._transaction_data[
                        transaction_id
                    ].items():
                        self._data[collection] = data

                # 更新事务状态
                self._transactions[transaction_id].status = "committed"

                # 清理事务数据
                if transaction_id in self._transaction_data:
                    del self._transaction_data[transaction_id]

                return True
        except Exception:
            return False

    async def rollback_transaction(self, transaction_id: str) -> bool:
        """回滚事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False

                # 更新事务状态
                self._transactions[transaction_id].status = "rolled_back"

                # 清理事务数据
                if transaction_id in self._transaction_data:
                    del self._transaction_data[transaction_id]

                return True
        except Exception:
            return False

    async def create_index(
        self, collection: str, fields: List[str], unique: bool = False
    ) -> bool:
        """创建索引"""
        try:
            with self._lock:
                index_name = "_".join(fields)
                if collection not in self._indexes:
                    self._indexes[collection] = {}

                self._indexes[collection][index_name] = {
                    "fields": fields,
                    "unique": unique,
                    "created_at": datetime.utcnow().isoformat(),
                }

                return True
        except Exception:
            return False

    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            with self._lock:
                if (
                    collection in self._indexes
                    and index_name in self._indexes[collection]
                ):
                    del self._indexes[collection][index_name]
                    return True
                return False
        except Exception:
            return False

    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        with self._lock:
            if collection not in self._indexes:
                return []

            return [
                {
                    "name": name,
                    "fields": info["fields"],
                    "unique": info["unique"],
                    "created_at": info["created_at"],
                }
                for name, info in self._indexes[collection].items()
            ]

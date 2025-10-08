"""
SQLite存储后端实现
提供基于SQLite数据库的存储功能，适用于轻量级持久化存储
"""

import asyncio
import aiosqlite
import json
import uuid
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from pathlib import Path
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
    ConnectionError,
)

logger = logging.getLogger(__name__)


class SQLiteStorageBackend(IStorageBackend):
    """SQLite存储后端"""

    def __init__(self):
        self._connected = False
        self._db_path: Optional[Path] = None
        self._connection_pool: List[aiosqlite.Connection] = []
        self._pool_size = 10
        self._pool_lock = asyncio.Lock()
        self._transactions: Dict[str, StorageTransaction] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)

        # SQL 模板
        self._create_table_sql = """
        CREATE TABLE IF NOT EXISTS {collection} (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            metadata TEXT
        )
        """

        self._create_index_table_sql = """
        CREATE TABLE IF NOT EXISTS _indexes (
            collection TEXT NOT NULL,
            index_name TEXT NOT NULL,
            fields TEXT NOT NULL,
            unique_constraint INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            PRIMARY KEY (collection, index_name)
        )
        """

        self._create_transaction_table_sql = """
        CREATE TABLE IF NOT EXISTS _transactions (
            transaction_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            operations TEXT
        )
        """

    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.SQLITE

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def _get_connection(self) -> aiosqlite.Connection:
        """从连接池获取连接"""
        async with self._pool_lock:
            if self._connection_pool:
                return self._connection_pool.pop()
            else:
                # 创建新连接
                conn = await aiosqlite.connect(self._db_path)
                conn.row_factory = aiosqlite.Row
                await conn.execute("PRAGMA journal_mode=WAL")
                await conn.execute("PRAGMA synchronous=NORMAL")
                await conn.execute("PRAGMA cache_size=10000")
                await conn.execute("PRAGMA temp_store=memory")
                return conn

    async def _return_connection(self, conn: aiosqlite.Connection) -> None:
        """将连接返回连接池"""
        async with self._pool_lock:
            if len(self._connection_pool) < self._pool_size:
                self._connection_pool.append(conn)
            else:
                await conn.close()

    async def _execute_with_connection(
        self,
        sql: str,
        params: tuple = (),
        fetch_one: bool = False,
        fetch_all: bool = False,
    ) -> Any:
        """使用连接执行SQL"""
        conn = await self._get_connection()
        try:
            cursor = await conn.execute(sql, params)

            if fetch_one:
                result = await cursor.fetchone()
                return dict(result) if result else None
            elif fetch_all:
                results = await cursor.fetchall()
                return [dict(row) for row in results]
            else:
                await conn.commit()
                return cursor.rowcount
        finally:
            await self._return_connection(conn)

    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到SQLite数据库"""
        try:
            db_path = config.get("db_path", "./storage.db")
            self._db_path = Path(db_path).resolve()
            self._pool_size = config.get("pool_size", 10)

            # 确保目录存在
            self._db_path.parent.mkdir(parents=True, exist_ok=True)

            # 测试连接
            conn = await aiosqlite.connect(self._db_path)
            await conn.close()

            # 初始化数据库结构
            await self._initialize_database()

            self._connected = True
            logger.info(f"Connected to SQLite database: {self._db_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to SQLite database: {e}")
            raise ConnectionError(f"Failed to connect to SQLite database: {e}")

    async def disconnect(self) -> bool:
        """断开SQLite数据库连接"""
        try:
            async with self._pool_lock:
                # 关闭所有连接池中的连接
                for conn in self._connection_pool:
                    await conn.close()
                self._connection_pool.clear()

            with self._lock:
                self._connected = False
                self._transactions.clear()

            logger.info("Disconnected from SQLite database")
            return True

        except Exception as e:
            logger.error(f"Failed to disconnect from SQLite database: {e}")
            raise StorageException(f"Failed to disconnect from SQLite database: {e}")

    async def _initialize_database(self) -> None:
        """初始化数据库结构"""
        # 创建索引表
        await self._execute_with_connection(self._create_index_table_sql)

        # 创建事务表
        await self._execute_with_connection(self._create_transaction_table_sql)

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            # 执行简单查询测试连接
            await self._execute_with_connection("SELECT 1")

            # 获取数据库信息
            db_info = await self._execute_with_connection(
                "SELECT name FROM sqlite_master WHERE type='table'", fetch_all=True
            )

            tables = [
                info["name"] for info in db_info if not info["name"].startswith("_")
            ]

            # 统计记录数
            total_records = 0
            for table in tables:
                try:
                    count_result = await self._execute_with_connection(
                        f"SELECT COUNT(*) as count FROM {table}", fetch_one=True
                    )
                    total_records += count_result["count"] if count_result else 0
                except Exception:
                    # 忽略不存在的表
                    continue

            active_transactions = len(
                [t for t in self._transactions.values() if t.status == "pending"]
            )

            # 获取数据库文件大小
            db_size = self._db_path.stat().st_size if self._db_path.exists() else 0

            return {
                "status": "healthy" if self._connected else "disconnected",
                "backend_type": self.backend_type.value,
                "db_path": str(self._db_path) if self._db_path else None,
                "tables": tables,
                "tables_count": len(tables),
                "total_records": total_records,
                "active_transactions": active_transactions,
                "connection_pool_size": len(self._connection_pool),
                "database_info": {
                    "file_size": db_size,
                    "file_size_mb": round(db_size / 1024 / 1024, 2),
                },
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

    def _generate_key(self, data: Dict[str, Any]) -> str:
        """生成唯一键"""
        if "id" in data:
            return str(data["id"])
        elif "_id" in data:
            return str(data["_id"])
        else:
            return str(uuid.uuid4())

    def _sanitize_table_name(self, collection: str) -> str:
        """清理表名，确保SQL安全"""
        # 只允许字母、数字和下划线
        import re

        sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", collection)
        # 确保以字母开头
        if not sanitized[0].isalpha():
            sanitized = "table_" + sanitized
        return sanitized

    async def _ensure_table_exists(self, collection: str) -> None:
        """确保表存在"""
        table_name = self._sanitize_table_name(collection)
        create_sql = self._create_table_sql.format(collection=table_name)
        await self._execute_with_connection(create_sql)

    def _build_where_clause(self, filters: Dict[str, Any]) -> tuple:
        """构建WHERE子句"""
        if not filters:
            return "", ()

        conditions = []
        params = []

        for field, value in filters.items():
            if isinstance(value, dict):
                # 支持操作符
                for op, op_value in value.items():
                    if op == "$eq":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') = ?")
                        params.append(op_value)
                    elif op == "$ne":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') != ?")
                        params.append(op_value)
                    elif op == "$gt":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') > ?")
                        params.append(op_value)
                    elif op == "$gte":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') >= ?")
                        params.append(op_value)
                    elif op == "$lt":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') < ?")
                        params.append(op_value)
                    elif op == "$lte":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') <= ?")
                        params.append(op_value)
                    elif op == "$in":
                        placeholders = ",".join(["?" for _ in op_value])
                        conditions.append(
                            f"JSON_EXTRACT(data, '$.{field}') IN ({placeholders})"
                        )
                        params.extend(op_value)
                    elif op == "$nin":
                        placeholders = ",".join(["?" for _ in op_value])
                        conditions.append(
                            f"JSON_EXTRACT(data, '$.{field}') NOT IN ({placeholders})"
                        )
                        params.extend(op_value)
                    elif op == "$regex":
                        conditions.append(f"JSON_EXTRACT(data, '$.{field}') REGEXP ?")
                        params.append(op_value)
            else:
                conditions.append(f"JSON_EXTRACT(data, '$.{field}') = ?")
                params.append(value)

        where_clause = " AND ".join(conditions)
        return f"WHERE {where_clause}" if where_clause else "", tuple(params)

    def _apply_query_options(self, base_sql: str, query: StorageQuery) -> tuple:
        """应用查询选项（排序、分页等）"""
        sql_parts = [base_sql]
        params = []

        # 排序
        if query.sort_by:
            order = "DESC" if query.sort_order == "desc" else "ASC"
            sql_parts.append(
                f"ORDER BY JSON_EXTRACT(data, '$.{query.sort_by}') {order}"
            )

        # 分页
        if query.limit:
            sql_parts.append("LIMIT ?")
            params.append(query.limit)

            if query.offset:
                sql_parts.append("OFFSET ?")
                params.append(query.offset)

        return " ".join(sql_parts), tuple(params)

    def _process_record_fields(
        self, record: Dict[str, Any], query: StorageQuery
    ) -> Dict[str, Any]:
        """处理记录字段选择"""
        if not record:
            return record

        # 解析JSON数据
        if "data" in record and isinstance(record["data"], str):
            try:
                data = json.loads(record["data"])
                record.update(data)
                del record["data"]  # 移除原始JSON字段
            except json.JSONDecodeError:
                pass

        # 字段选择
        if query.include_fields:
            filtered_record = {
                k: v
                for k, v in record.items()
                if k in query.include_fields
                or k in ["key", "_created_at", "_updated_at"]
            }
            return filtered_record
        elif query.exclude_fields:
            filtered_record = {
                k: v for k, v in record.items() if k not in query.exclude_fields
            }
            return filtered_record

        return record

    async def create(
        self,
        collection: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """创建记录"""
        try:
            await self._ensure_table_exists(collection)
            table_name = self._sanitize_table_name(collection)

            key = self._generate_key(data)

            # 检查记录是否已存在
            existing = await self._execute_with_connection(
                f"SELECT key FROM {table_name} WHERE key = ?", (key,), fetch_one=True
            )

            if existing:
                return StorageResult(
                    success=False, error=f"Record with key '{key}' already exists"
                )

            # 准备记录数据
            record = data.copy()
            record["_key"] = key
            now = datetime.utcnow().isoformat()

            # 插入记录
            await self._execute_with_connection(
                f"INSERT INTO {table_name} (key, data, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (key, json.dumps(record), now, now),
            )

            return StorageResult(
                success=True,
                data={"key": key, "record": record},
                operation_time=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to create record in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def read(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """读取记录"""
        try:
            table_name = self._sanitize_table_name(collection)

            record = await self._execute_with_connection(
                f"SELECT * FROM {table_name} WHERE key = ?", (key,), fetch_one=True
            )

            if not record:
                return StorageResult(
                    success=False, error=f"Record with key '{key}' not found"
                )

            # 解析JSON数据
            if "data" in record and isinstance(record["data"], str):
                try:
                    data = json.loads(record["data"])
                    record.update(data)
                    del record["data"]
                except json.JSONDecodeError:
                    pass

            return StorageResult(
                success=True, data=record, operation_time=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Failed to read record {key} from {collection}: {e}")
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
            table_name = self._sanitize_table_name(collection)

            # 获取现有记录
            existing = await self._execute_with_connection(
                f"SELECT data FROM {table_name} WHERE key = ?", (key,), fetch_one=True
            )

            if not existing:
                return StorageResult(
                    success=False, error=f"Record with key '{key}' not found"
                )

            # 合并数据
            try:
                current_data = json.loads(existing["data"])
                current_data.update(data)
                current_data["_key"] = key
                now = datetime.utcnow().isoformat()
                current_data["_updated_at"] = now

                # 更新记录
                await self._execute_with_connection(
                    f"UPDATE {table_name} SET data = ?, updated_at = ? WHERE key = ?",
                    (json.dumps(current_data), now, key),
                )

                return StorageResult(
                    success=True, data=current_data, operation_time=datetime.utcnow()
                )

            except json.JSONDecodeError as e:
                return StorageResult(
                    success=False, error=f"Failed to parse existing record data: {e}"
                )

        except Exception as e:
            logger.error(f"Failed to update record {key} in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def delete(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """删除记录"""
        try:
            table_name = self._sanitize_table_name(collection)

            # 获取要删除的记录
            record = await self._execute_with_connection(
                f"SELECT * FROM {table_name} WHERE key = ?", (key,), fetch_one=True
            )

            if not record:
                return StorageResult(
                    success=False, error=f"Record with key '{key}' not found"
                )

            # 删除记录
            await self._execute_with_connection(
                f"DELETE FROM {table_name} WHERE key = ?", (key,)
            )

            # 解析记录数据用于返回
            if "data" in record and isinstance(record["data"], str):
                try:
                    data = json.loads(record["data"])
                    record.update(data)
                    del record["data"]
                except json.JSONDecodeError:
                    pass

            return StorageResult(
                success=True, data=record, operation_time=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Failed to delete record {key} from {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def list(
        self,
        collection: str,
        query: Optional[StorageQuery] = None,
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """列出记录"""
        try:
            table_name = self._sanitize_table_name(collection)

            if query is None:
                query = StorageQuery(filters={})

            # 构建查询
            base_sql = f"SELECT * FROM {table_name}"
            where_clause, where_params = self._build_where_clause(query.filters)

            if where_clause:
                base_sql += f" {where_clause}"

            # 应用查询选项
            final_sql, query_params = self._apply_query_options(base_sql, query)
            all_params = where_params + query_params

            # 执行查询
            records = await self._execute_with_connection(
                final_sql, all_params, fetch_all=True
            )

            # 处理记录
            processed_records = []
            for record in records:
                processed_record = self._process_record_fields(record, query)
                processed_records.append(processed_record)

            return StorageResult(
                success=True,
                data=processed_records,
                metadata={"total_count": len(processed_records)},
                operation_time=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to list records from {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def search(
        self, collection: str, query: StorageQuery, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """搜索记录"""
        # SQLite存储中，搜索和列出功能相同
        return await self.list(collection, query, transaction_id)

    async def batch_create(
        self,
        collection: str,
        data_list: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量创建"""
        try:
            await self._ensure_table_exists(collection)
            table_name = self._sanitize_table_name(collection)

            conn = await self._get_connection()
            try:
                await conn.execute("BEGIN TRANSACTION")

                results = []
                errors = []

                for data in data_list:
                    try:
                        key = self._generate_key(data)

                        # 检查是否已存在
                        cursor = await conn.execute(
                            f"SELECT key FROM {table_name} WHERE key = ?", (key,)
                        )
                        existing = await cursor.fetchone()

                        if existing:
                            errors.append(f"Record with key '{key}' already exists")
                            continue

                        # 准备记录
                        record = data.copy()
                        record["_key"] = key
                        now = datetime.utcnow().isoformat()

                        # 插入记录
                        await conn.execute(
                            f"INSERT INTO {table_name} (key, data, created_at, updated_at) VALUES (?, ?, ?, ?)",
                            (key, json.dumps(record), now, now),
                        )

                        results.append({"key": key, "record": record})

                    except Exception as e:
                        errors.append(str(e))

                await conn.commit()

                return StorageResult(
                    success=len(errors) == 0,
                    data=results,
                    error="; ".join(errors) if errors else None,
                    metadata={
                        "created_count": len(results),
                        "error_count": len(errors),
                    },
                    operation_time=datetime.utcnow(),
                )

            except Exception as e:
                await conn.rollback()
                raise e
            finally:
                await self._return_connection(conn)

        except Exception as e:
            logger.error(f"Failed to batch create records in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def batch_update(
        self,
        collection: str,
        updates: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量更新"""
        try:
            table_name = self._sanitize_table_name(collection)

            conn = await self._get_connection()
            try:
                await conn.execute("BEGIN TRANSACTION")

                results = []
                errors = []

                for update_data in updates:
                    try:
                        key = update_data.pop("_key", None)
                        if not key:
                            errors.append("Missing '_key' in update data")
                            continue

                        # 获取现有记录
                        cursor = await conn.execute(
                            f"SELECT data FROM {table_name} WHERE key = ?", (key,)
                        )
                        existing = await cursor.fetchone()

                        if not existing:
                            errors.append(f"Record with key '{key}' not found")
                            continue

                        # 合并数据
                        current_data = json.loads(existing["data"])
                        current_data.update(update_data)
                        now = datetime.utcnow().isoformat()
                        current_data["_updated_at"] = now

                        # 更新记录
                        await conn.execute(
                            f"UPDATE {table_name} SET data = ?, updated_at = ? WHERE key = ?",
                            (json.dumps(current_data), now, key),
                        )

                        results.append(current_data)

                    except Exception as e:
                        errors.append(str(e))

                await conn.commit()

                return StorageResult(
                    success=len(errors) == 0,
                    data=results,
                    error="; ".join(errors) if errors else None,
                    metadata={
                        "updated_count": len(results),
                        "error_count": len(errors),
                    },
                    operation_time=datetime.utcnow(),
                )

            except Exception as e:
                await conn.rollback()
                raise e
            finally:
                await self._return_connection(conn)

        except Exception as e:
            logger.error(f"Failed to batch update records in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def batch_delete(
        self, collection: str, keys: List[str], transaction_id: Optional[str] = None
    ) -> StorageResult:
        """批量删除"""
        try:
            table_name = self._sanitize_table_name(collection)

            conn = await self._get_connection()
            try:
                await conn.execute("BEGIN TRANSACTION")

                results = []
                errors = []

                for key in keys:
                    try:
                        # 获取要删除的记录
                        cursor = await conn.execute(
                            f"SELECT * FROM {table_name} WHERE key = ?", (key,)
                        )
                        record = await cursor.fetchone()

                        if not record:
                            errors.append(f"Record with key '{key}' not found")
                            continue

                        # 删除记录
                        await conn.execute(
                            f"DELETE FROM {table_name} WHERE key = ?", (key,)
                        )

                        # 处理返回数据
                        record_dict = dict(record)
                        if "data" in record_dict and isinstance(
                            record_dict["data"], str
                        ):
                            try:
                                data = json.loads(record_dict["data"])
                                record_dict.update(data)
                                del record_dict["data"]
                            except json.JSONDecodeError:
                                pass

                        results.append(record_dict)

                    except Exception as e:
                        errors.append(str(e))

                await conn.commit()

                return StorageResult(
                    success=len(errors) == 0,
                    data=results,
                    error="; ".join(errors) if errors else None,
                    metadata={
                        "deleted_count": len(results),
                        "error_count": len(errors),
                    },
                    operation_time=datetime.utcnow(),
                )

            except Exception as e:
                await conn.rollback()
                raise e
            finally:
                await self._return_connection(conn)

        except Exception as e:
            logger.error(f"Failed to batch delete records from {collection}: {e}")
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

        # 记录事务到数据库
        await self._execute_with_connection(
            "INSERT INTO _transactions (transaction_id, status, created_at, operations) VALUES (?, ?, ?, ?)",
            (transaction_id, "pending", datetime.utcnow().isoformat(), "[]"),
        )

        return transaction_id

    async def commit_transaction(self, transaction_id: str) -> bool:
        """提交事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False

                # 更新事务状态
                self._transactions[transaction_id].status = "committed"

            # 更新数据库中的事务状态
            await self._execute_with_connection(
                "UPDATE _transactions SET status = ? WHERE transaction_id = ?",
                ("committed", transaction_id),
            )

            return True

        except Exception as e:
            logger.error(f"Failed to commit transaction {transaction_id}: {e}")
            return False

    async def rollback_transaction(self, transaction_id: str) -> bool:
        """回滚事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False

                # 更新事务状态
                self._transactions[transaction_id].status = "rolled_back"

            # 更新数据库中的事务状态
            await self._execute_with_connection(
                "UPDATE _transactions SET status = ? WHERE transaction_id = ?",
                ("rolled_back", transaction_id),
            )

            return True

        except Exception as e:
            logger.error(f"Failed to rollback transaction {transaction_id}: {e}")
            return False

    async def create_index(
        self, collection: str, fields: List[str], unique: bool = False
    ) -> bool:
        """创建索引"""
        try:
            table_name = self._sanitize_table_name(collection)
            index_name = "_".join(fields)

            # 记录索引信息
            await self._execute_with_connection(
                "INSERT OR REPLACE INTO _indexes (collection, index_name, fields, unique_constraint, created_at) VALUES (?, ?, ?, ?, ?)",
                (
                    collection,
                    index_name,
                    json.dumps(fields),
                    int(unique),
                    datetime.utcnow().isoformat(),
                ),
            )

            # 为JSON字段创建索引（SQLite 3.38+支持）
            for field in fields:
                try:
                    index_sql = f"CREATE {'UNIQUE ' if unique else ''}INDEX IF NOT EXISTS idx_{table_name}_{field} ON {table_name}(JSON_EXTRACT(data, '$.{field}'))"
                    await self._execute_with_connection(index_sql)
                except Exception as e:
                    logger.warning(
                        f"Failed to create database index for field {field}: {e}"
                    )

            return True

        except Exception as e:
            logger.error(f"Failed to create index for {collection}: {e}")
            return False

    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            table_name = self._sanitize_table_name(collection)

            # 获取索引信息
            index_info = await self._execute_with_connection(
                "SELECT fields FROM _indexes WHERE collection = ? AND index_name = ?",
                (collection, index_name),
                fetch_one=True,
            )

            if not index_info:
                return False

            # 删除数据库索引
            try:
                fields = json.loads(index_info["fields"])
                for field in fields:
                    drop_sql = f"DROP INDEX IF EXISTS idx_{table_name}_{field}"
                    await self._execute_with_connection(drop_sql)
            except Exception as e:
                logger.warning(f"Failed to drop database index: {e}")

            # 删除索引记录
            await self._execute_with_connection(
                "DELETE FROM _indexes WHERE collection = ? AND index_name = ?",
                (collection, index_name),
            )

            return True

        except Exception as e:
            logger.error(f"Failed to drop index {index_name} for {collection}: {e}")
            return False

    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        try:
            indexes = await self._execute_with_connection(
                "SELECT * FROM _indexes WHERE collection = ?",
                (collection,),
                fetch_all=True,
            )

            result = []
            for index in indexes:
                try:
                    fields = json.loads(index["fields"])
                    result.append(
                        {
                            "name": index["index_name"],
                            "fields": fields,
                            "unique": bool(index["unique_constraint"]),
                            "created_at": index["created_at"],
                        }
                    )
                except json.JSONDecodeError:
                    continue

            return result

        except Exception as e:
            logger.error(f"Failed to list indexes for {collection}: {e}")
            return []

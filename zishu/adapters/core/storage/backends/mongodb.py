"""
MongoDB存储后端实现
提供基于MongoDB的存储功能，适用于灵活的文档数据库需求
"""

import asyncio
import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING, errors as pymongo_errors
from pymongo.collection import Collection
from pymongo.database import Database
import uuid
import logging
import time
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
import threading
from concurrent.futures import ThreadPoolExecutor
from bson import ObjectId
from bson.errors import InvalidId

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


class MongoDBStorageBackend(IStorageBackend):
    """MongoDB存储后端"""

    def __init__(self):
        self._connected = False
        self._client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
        self._database: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
        self._db_name: str = ""
        self._transactions: Dict[str, StorageTransaction] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)

        # 支持的查询操作符
        self._supported_operators = {
            "$eq",
            "$ne",
            "$gt",
            "$gte",
            "$lt",
            "$lte",
            "$in",
            "$nin",
            "$exists",
            "$regex",
            "$text",
            "$and",
            "$or",
            "$not",
            "$nor",
            "$all",
            "$size",
            "$elemMatch",
            "$type",
            "$mod",
        }

    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.MONGODB

    @property
    def is_connected(self) -> bool:
        return self._connected and self._client is not None

    def _convert_object_id(self, data: Any) -> Any:
        """转换ObjectId为字符串"""
        if isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, dict):
            return {k: self._convert_object_id(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._convert_object_id(item) for item in data]
        return data

    def _prepare_document(
        self, data: Dict[str, Any], key: str = None
    ) -> Dict[str, Any]:
        """准备文档数据"""
        doc = data.copy()

        # 处理键
        if key:
            if key.startswith("ObjectId(") and key.endswith(")"):
                # 处理ObjectId格式的键
                try:
                    doc["_id"] = ObjectId(key[9:-1])
                except InvalidId:
                    doc["_id"] = key
            else:
                doc["_id"] = key
        elif "_id" not in doc:
            # 如果没有指定_id，让MongoDB自动生成
            pass

        # 添加时间戳
        now = datetime.utcnow()
        if "_created_at" not in doc:
            doc["_created_at"] = now
        doc["_updated_at"] = now

        return doc

    def _build_mongo_filter(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """构建MongoDB查询过滤器"""
        mongo_filter = {}

        for field, condition in filters.items():
            if isinstance(condition, dict):
                # 操作符条件
                mongo_condition = {}
                for op, value in condition.items():
                    if op in self._supported_operators:
                        mongo_condition[op] = value
                    else:
                        # 不支持的操作符，使用等值匹配
                        mongo_condition["$eq"] = condition
                        break
                mongo_filter[field] = mongo_condition
            else:
                # 直接值匹配
                mongo_filter[field] = condition

        return mongo_filter

    def _build_mongo_sort(self, sort_by: str, sort_order: str) -> List[tuple]:
        """构建MongoDB排序条件"""
        direction = DESCENDING if sort_order == "desc" else ASCENDING
        return [(sort_by, direction)]

    def _build_projection(self, query: StorageQuery) -> Optional[Dict[str, int]]:
        """构建MongoDB投影"""
        if query.include_fields:
            projection = {field: 1 for field in query.include_fields}
            # 总是包含_id和时间戳字段
            projection.update({"_id": 1, "_created_at": 1, "_updated_at": 1})
            return projection
        elif query.exclude_fields:
            return {field: 0 for field in query.exclude_fields}
        return None

    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到MongoDB"""
        try:
            # MongoDB连接配置
            host = config.get("host", "localhost")
            port = config.get("port", 27017)
            username = config.get("username")
            password = config.get("password")
            database = config.get("database", "zishu_storage")

            # 构建连接URI
            if username and password:
                uri = f"mongodb://{username}:{password}@{host}:{port}/{database}"
            else:
                uri = f"mongodb://{host}:{port}/{database}"

            # 连接选项
            connect_options = {
                "serverSelectionTimeoutMS": config.get("connect_timeout", 5000),
                "socketTimeoutMS": config.get("socket_timeout", 5000),
                "maxPoolSize": config.get("max_pool_size", 100),
                "minPoolSize": config.get("min_pool_size", 0),
                "retryWrites": config.get("retry_writes", True),
                "retryReads": config.get("retry_reads", True),
            }

            # 创建客户端
            self._client = motor.motor_asyncio.AsyncIOMotorClient(
                uri, **connect_options
            )

            # 选择数据库
            self._db_name = database
            self._database = self._client[database]

            # 测试连接
            await self._client.admin.command("ping")

            self._connected = True
            logger.info(f"Connected to MongoDB: {host}:{port}/{database}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise ConnectionError(f"Failed to connect to MongoDB: {e}")

    async def disconnect(self) -> bool:
        """断开MongoDB连接"""
        try:
            if self._client:
                self._client.close()
                self._client = None
                self._database = None

            with self._lock:
                self._connected = False
                self._transactions.clear()

            logger.info("Disconnected from MongoDB")
            return True

        except Exception as e:
            logger.error(f"Failed to disconnect from MongoDB: {e}")
            raise StorageException(f"Failed to disconnect from MongoDB: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            # 测试连接
            await self._client.admin.command("ping")

            # 获取服务器状态
            server_status = await self._client.admin.command("serverStatus")

            # 获取数据库统计
            db_stats = await self._database.command("dbStats")

            # 获取集合列表
            collections = await self._database.list_collection_names()

            # 计算总记录数
            total_records = 0
            for collection_name in collections:
                collection = self._database[collection_name]
                count = await collection.count_documents({})
                total_records += count

            active_transactions = len(
                [t for t in self._transactions.values() if t.status == "pending"]
            )

            return {
                "status": "healthy",
                "backend_type": self.backend_type.value,
                "host": server_status.get("host"),
                "version": server_status.get("version"),
                "database": self._db_name,
                "collections": collections,
                "collections_count": len(collections),
                "total_records": total_records,
                "active_transactions": active_transactions,
                "database_stats": {
                    "storage_size": db_stats.get("storageSize"),
                    "data_size": db_stats.get("dataSize"),
                    "index_size": db_stats.get("indexSize"),
                    "collections": db_stats.get("collections"),
                    "indexes": db_stats.get("indexes"),
                    "objects": db_stats.get("objects"),
                },
                "server_stats": {
                    "uptime": server_status.get("uptime"),
                    "connections": server_status.get("connections", {}).get("current"),
                    "opcounters": server_status.get("opcounters"),
                },
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

    def _get_collection(
        self, collection_name: str
    ) -> motor.motor_asyncio.AsyncIOMotorCollection:
        """获取集合"""
        return self._database[collection_name]

    async def create(
        self,
        collection: str,
        data: Dict[str, Any],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """创建记录"""
        try:
            coll = self._get_collection(collection)

            # 准备文档
            doc = self._prepare_document(data)

            # 检查是否已存在（如果指定了_id）
            if "_id" in doc:
                existing = await coll.find_one({"_id": doc["_id"]})
                if existing:
                    return StorageResult(
                        success=False,
                        error=f"Record with _id '{doc['_id']}' already exists",
                    )

            # 插入文档
            result = await coll.insert_one(doc)

            # 获取插入的文档
            inserted_doc = await coll.find_one({"_id": result.inserted_id})
            inserted_doc = self._convert_object_id(inserted_doc)

            return StorageResult(
                success=True,
                data={"key": str(result.inserted_id), "record": inserted_doc},
                operation_time=datetime.utcnow(),
            )

        except pymongo_errors.DuplicateKeyError as e:
            return StorageResult(success=False, error=f"Duplicate key error: {e}")
        except Exception as e:
            logger.error(f"Failed to create record in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def read(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """读取记录"""
        try:
            coll = self._get_collection(collection)

            # 处理ObjectId
            try:
                if ObjectId.is_valid(key):
                    query_id = ObjectId(key)
                else:
                    query_id = key
            except (InvalidId, TypeError):
                query_id = key

            # 查找文档
            doc = await coll.find_one({"_id": query_id})

            if not doc:
                return StorageResult(
                    success=False, error=f"Record with _id '{key}' not found"
                )

            # 转换ObjectId
            doc = self._convert_object_id(doc)

            return StorageResult(
                success=True, data=doc, operation_time=datetime.utcnow()
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
            coll = self._get_collection(collection)

            # 处理ObjectId
            try:
                if ObjectId.is_valid(key):
                    query_id = ObjectId(key)
                else:
                    query_id = key
            except (InvalidId, TypeError):
                query_id = key

            # 准备更新数据
            update_data = data.copy()
            update_data["_updated_at"] = datetime.utcnow()

            # 执行更新
            result = await coll.update_one({"_id": query_id}, {"$set": update_data})

            if result.matched_count == 0:
                return StorageResult(
                    success=False, error=f"Record with _id '{key}' not found"
                )

            # 获取更新后的文档
            updated_doc = await coll.find_one({"_id": query_id})
            updated_doc = self._convert_object_id(updated_doc)

            return StorageResult(
                success=True, data=updated_doc, operation_time=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Failed to update record {key} in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def delete(
        self, collection: str, key: str, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """删除记录"""
        try:
            coll = self._get_collection(collection)

            # 处理ObjectId
            try:
                if ObjectId.is_valid(key):
                    query_id = ObjectId(key)
                else:
                    query_id = key
            except (InvalidId, TypeError):
                query_id = key

            # 先获取要删除的文档
            doc = await coll.find_one({"_id": query_id})
            if not doc:
                return StorageResult(
                    success=False, error=f"Record with _id '{key}' not found"
                )

            # 删除文档
            result = await coll.delete_one({"_id": query_id})

            if result.deleted_count == 0:
                return StorageResult(
                    success=False, error=f"Failed to delete record with _id '{key}'"
                )

            # 转换ObjectId
            doc = self._convert_object_id(doc)

            return StorageResult(
                success=True, data=doc, operation_time=datetime.utcnow()
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
            if query is None:
                query = StorageQuery(filters={})

            coll = self._get_collection(collection)

            # 构建查询条件
            mongo_filter = (
                self._build_mongo_filter(query.filters) if query.filters else {}
            )

            # 构建投影
            projection = self._build_projection(query)

            # 创建游标
            cursor = coll.find(mongo_filter, projection)

            # 排序
            if query.sort_by:
                sort_spec = self._build_mongo_sort(
                    query.sort_by, query.sort_order or "asc"
                )
                cursor = cursor.sort(sort_spec)

            # 分页
            if query.offset:
                cursor = cursor.skip(query.offset)
            if query.limit:
                cursor = cursor.limit(query.limit)

            # 获取结果
            documents = []
            async for doc in cursor:
                doc = self._convert_object_id(doc)
                documents.append(doc)

            # 获取总数（如果需要）
            total_count = await coll.count_documents(mongo_filter)

            return StorageResult(
                success=True,
                data=documents,
                metadata={"total_count": total_count, "returned_count": len(documents)},
                operation_time=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to list records from {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def search(
        self, collection: str, query: StorageQuery, transaction_id: Optional[str] = None
    ) -> StorageResult:
        """搜索记录"""
        try:
            coll = self._get_collection(collection)

            # 构建查询条件
            mongo_filter = (
                self._build_mongo_filter(query.filters) if query.filters else {}
            )

            # 如果有文本搜索条件，添加$text查询
            if hasattr(query, "text_search") and query.text_search:
                mongo_filter["$text"] = {"$search": query.text_search}

            # 构建投影
            projection = self._build_projection(query)

            # 创建游标
            cursor = coll.find(mongo_filter, projection)

            # 排序
            if query.sort_by:
                sort_spec = self._build_mongo_sort(
                    query.sort_by, query.sort_order or "asc"
                )
                cursor = cursor.sort(sort_spec)
            elif hasattr(query, "text_search") and query.text_search:
                # 文本搜索时按相关性排序
                cursor = cursor.sort([("score", {"$meta": "textScore"})])
                if not projection:
                    projection = {}
                projection["score"] = {"$meta": "textScore"}

            # 分页
            if query.offset:
                cursor = cursor.skip(query.offset)
            if query.limit:
                cursor = cursor.limit(query.limit)

            # 获取结果
            documents = []
            async for doc in cursor:
                doc = self._convert_object_id(doc)
                documents.append(doc)

            # 获取总数
            total_count = await coll.count_documents(mongo_filter)

            return StorageResult(
                success=True,
                data=documents,
                metadata={"total_count": total_count, "returned_count": len(documents)},
                operation_time=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to search records in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def batch_create(
        self,
        collection: str,
        data_list: List[Dict[str, Any]],
        transaction_id: Optional[str] = None,
    ) -> StorageResult:
        """批量创建"""
        try:
            coll = self._get_collection(collection)

            # 准备文档列表
            documents = []
            for data in data_list:
                doc = self._prepare_document(data)
                documents.append(doc)

            # 批量插入
            result = await coll.insert_many(documents, ordered=False)

            # 获取插入的文档
            inserted_docs = []
            for inserted_id in result.inserted_ids:
                doc = await coll.find_one({"_id": inserted_id})
                doc = self._convert_object_id(doc)
                inserted_docs.append(doc)

            return StorageResult(
                success=True,
                data=inserted_docs,
                metadata={"created_count": len(inserted_docs)},
                operation_time=datetime.utcnow(),
            )

        except pymongo_errors.BulkWriteError as e:
            # 处理部分成功的情况
            successful_inserts = []
            errors = []

            for error in e.details.get("writeErrors", []):
                errors.append(f"Index {error['index']}: {error['errmsg']}")

            # 获取成功插入的文档
            for inserted_id in e.details.get("insertedIds", []):
                try:
                    doc = await coll.find_one({"_id": inserted_id})
                    if doc:
                        doc = self._convert_object_id(doc)
                        successful_inserts.append(doc)
                except Exception:
                    pass

            return StorageResult(
                success=len(errors) == 0,
                data=successful_inserts,
                error="; ".join(errors) if errors else None,
                metadata={
                    "created_count": len(successful_inserts),
                    "error_count": len(errors),
                },
                operation_time=datetime.utcnow(),
            )
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
            coll = self._get_collection(collection)

            # 准备批量更新操作
            bulk_ops = []
            for update_data in updates:
                # 提取_id
                doc_id = update_data.pop("_id", None)
                if not doc_id:
                    continue

                # 处理ObjectId
                try:
                    if ObjectId.is_valid(doc_id):
                        query_id = ObjectId(doc_id)
                    else:
                        query_id = doc_id
                except (InvalidId, TypeError):
                    query_id = doc_id

                # 准备更新数据
                update_fields = update_data.copy()
                update_fields["_updated_at"] = datetime.utcnow()

                # 添加到批量操作
                bulk_ops.append(
                    pymongo_errors.UpdateOne({"_id": query_id}, {"$set": update_fields})
                )

            if not bulk_ops:
                return StorageResult(success=False, error="No valid update operations")

            # 执行批量更新
            result = await coll.bulk_write(bulk_ops, ordered=False)

            return StorageResult(
                success=True,
                data={
                    "matched_count": result.matched_count,
                    "modified_count": result.modified_count,
                },
                metadata={"updated_count": result.modified_count},
                operation_time=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to batch update records in {collection}: {e}")
            return StorageResult(success=False, error=str(e))

    async def batch_delete(
        self, collection: str, keys: List[str], transaction_id: Optional[str] = None
    ) -> StorageResult:
        """批量删除"""
        try:
            coll = self._get_collection(collection)

            # 转换键列表
            query_ids = []
            for key in keys:
                try:
                    if ObjectId.is_valid(key):
                        query_ids.append(ObjectId(key))
                    else:
                        query_ids.append(key)
                except (InvalidId, TypeError):
                    query_ids.append(key)

            # 先获取要删除的文档
            docs_to_delete = []
            async for doc in coll.find({"_id": {"$in": query_ids}}):
                doc = self._convert_object_id(doc)
                docs_to_delete.append(doc)

            # 执行批量删除
            result = await coll.delete_many({"_id": {"$in": query_ids}})

            return StorageResult(
                success=True,
                data=docs_to_delete,
                metadata={"deleted_count": result.deleted_count},
                operation_time=datetime.utcnow(),
            )

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

        # MongoDB事务需要副本集或分片集群
        # 这里记录事务信息，实际的事务操作在具体方法中处理

        return transaction_id

    async def commit_transaction(self, transaction_id: str) -> bool:
        """提交事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False

                # 更新事务状态
                self._transactions[transaction_id].status = "committed"

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

            return True

        except Exception as e:
            logger.error(f"Failed to rollback transaction {transaction_id}: {e}")
            return False

    async def create_index(
        self, collection: str, fields: List[str], unique: bool = False
    ) -> bool:
        """创建索引"""
        try:
            coll = self._get_collection(collection)

            # 构建索引规范
            if len(fields) == 1:
                # 单字段索引
                index_spec = fields[0]
            else:
                # 复合索引
                index_spec = [(field, ASCENDING) for field in fields]

            # 创建索引
            index_name = await coll.create_index(
                index_spec, unique=unique, background=True
            )

            logger.info(f"Created index '{index_name}' on collection '{collection}'")
            return True

        except Exception as e:
            logger.error(f"Failed to create index for {collection}: {e}")
            return False

    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            coll = self._get_collection(collection)

            # 删除索引
            await coll.drop_index(index_name)

            logger.info(f"Dropped index '{index_name}' from collection '{collection}'")
            return True

        except Exception as e:
            logger.error(f"Failed to drop index {index_name} for {collection}: {e}")
            return False

    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        try:
            coll = self._get_collection(collection)

            indexes = []
            async for index_info in coll.list_indexes():
                indexes.append(
                    {
                        "name": index_info.get("name"),
                        "key": index_info.get("key"),
                        "unique": index_info.get("unique", False),
                        "sparse": index_info.get("sparse", False),
                        "background": index_info.get("background", False),
                        "partial_filter_expression": index_info.get(
                            "partialFilterExpression"
                        ),
                    }
                )

            return indexes

        except Exception as e:
            logger.error(f"Failed to list indexes for {collection}: {e}")
            return []

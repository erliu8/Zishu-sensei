"""
Redis存储后端实现
提供基于Redis的存储功能，适用于高性能缓存和会话存储
"""

import asyncio
import aioredis
import json
import uuid
import logging
import time
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
import threading
from concurrent.futures import ThreadPoolExecutor

from ..interfaces import (
    IStorageBackend, StorageBackendType, StorageQuery, 
    StorageResult, StorageTransaction, StorageException,
    NotFoundError, DuplicateError, ValidationError, ConnectionError
)

logger = logging.getLogger(__name__)


class RedisStorageBackend(IStorageBackend):
    """Redis存储后端"""
    
    def __init__(self):
        self._connected = False
        self._redis_client: Optional[aioredis.Redis] = None
        self._connection_pool: Optional[aioredis.ConnectionPool] = None
        self._transactions: Dict[str, StorageTransaction] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)
        
        # Redis键前缀
        self._key_prefix = "zishu:storage"
        self._collection_prefix = "collection"
        self._index_prefix = "index"
        self._transaction_prefix = "transaction"
        self._metadata_prefix = "metadata"
        
        # 默认过期时间（秒）
        self._default_ttl = None  # 永不过期
        
        # 支持的查询操作符
        self._supported_operators = {
            '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', 
            '$in', '$nin', '$exists', '$regex'
        }
    
    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.REDIS
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._redis_client is not None
    
    def _get_collection_key(self, collection: str, key: str = None) -> str:
        """获取集合键"""
        if key:
            return f"{self._key_prefix}:{self._collection_prefix}:{collection}:{key}"
        else:
            return f"{self._key_prefix}:{self._collection_prefix}:{collection}"
    
    def _get_index_key(self, collection: str, index_name: str = None) -> str:
        """获取索引键"""
        if index_name:
            return f"{self._key_prefix}:{self._index_prefix}:{collection}:{index_name}"
        else:
            return f"{self._key_prefix}:{self._index_prefix}:{collection}"
    
    def _get_transaction_key(self, transaction_id: str) -> str:
        """获取事务键"""
        return f"{self._key_prefix}:{self._transaction_prefix}:{transaction_id}"
    
    def _get_metadata_key(self, collection: str) -> str:
        """获取元数据键"""
        return f"{self._key_prefix}:{self._metadata_prefix}:{collection}"
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到Redis"""
        try:
            # Redis连接配置
            redis_config = {
                'host': config.get('host', 'localhost'),
                'port': config.get('port', 6379),
                'db': config.get('db', 0),
                'password': config.get('password'),
                'username': config.get('username'),
                'encoding': 'utf-8',
                'decode_responses': True,
                'max_connections': config.get('max_connections', 20),
                'retry_on_timeout': True,
                'socket_connect_timeout': config.get('connect_timeout', 5),
                'socket_timeout': config.get('socket_timeout', 5)
            }
            
            # 移除None值
            redis_config = {k: v for k, v in redis_config.items() if v is not None}
            
            # 创建连接池
            self._connection_pool = aioredis.ConnectionPool(**redis_config)
            
            # 创建Redis客户端
            self._redis_client = aioredis.Redis(connection_pool=self._connection_pool)
            
            # 测试连接
            await self._redis_client.ping()
            
            # 设置配置
            self._key_prefix = config.get('key_prefix', 'zishu:storage')
            self._default_ttl = config.get('default_ttl')
            
            self._connected = True
            logger.info(f"Connected to Redis: {redis_config['host']}:{redis_config['port']}/{redis_config['db']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise ConnectionError(f"Failed to connect to Redis: {e}")
    
    async def disconnect(self) -> bool:
        """断开Redis连接"""
        try:
            if self._redis_client:
                await self._redis_client.close()
                self._redis_client = None
            
            if self._connection_pool:
                await self._connection_pool.disconnect()
                self._connection_pool = None
            
            with self._lock:
                self._connected = False
                self._transactions.clear()
            
            logger.info("Disconnected from Redis")
            return True
            
        except Exception as e:
            logger.error(f"Failed to disconnect from Redis: {e}")
            raise StorageException(f"Failed to disconnect from Redis: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            # 测试连接
            ping_result = await self._redis_client.ping()
            
            # 获取Redis信息
            info = await self._redis_client.info()
            
            # 获取集合统计
            collections = set()
            total_records = 0
            
            # 扫描所有集合键
            collection_pattern = f"{self._key_prefix}:{self._collection_prefix}:*"
            async for key in self._redis_client.scan_iter(match=collection_pattern):
                parts = key.split(':')
                if len(parts) >= 4:
                    collection_name = parts[3]
                    collections.add(collection_name)
                    total_records += 1
            
            active_transactions = len([t for t in self._transactions.values() 
                                     if t.status == "pending"])
            
            return {
                "status": "healthy" if ping_result else "error",
                "backend_type": self.backend_type.value,
                "host": info.get('tcp_port'),
                "redis_version": info.get('redis_version'),
                "collections": list(collections),
                "collections_count": len(collections),
                "total_records": total_records,
                "active_transactions": active_transactions,
                "redis_info": {
                    "used_memory": info.get('used_memory'),
                    "used_memory_human": info.get('used_memory_human'),
                    "connected_clients": info.get('connected_clients'),
                    "total_commands_processed": info.get('total_commands_processed'),
                    "keyspace_hits": info.get('keyspace_hits'),
                    "keyspace_misses": info.get('keyspace_misses'),
                    "uptime_in_seconds": info.get('uptime_in_seconds')
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _generate_key(self, data: Dict[str, Any]) -> str:
        """生成唯一键"""
        if 'id' in data:
            return str(data['id'])
        elif '_id' in data:
            return str(data['_id'])
        else:
            return str(uuid.uuid4())
    
    def _serialize_data(self, data: Any) -> str:
        """序列化数据"""
        if isinstance(data, (dict, list)):
            return json.dumps(data, ensure_ascii=False, default=str)
        else:
            return str(data)
    
    def _deserialize_data(self, data: str) -> Any:
        """反序列化数据"""
        try:
            return json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return data
    
    async def _update_collection_metadata(self, collection: str, operation: str, key: str = None) -> None:
        """更新集合元数据"""
        try:
            metadata_key = self._get_metadata_key(collection)
            
            # 获取现有元数据
            metadata_str = await self._redis_client.get(metadata_key)
            if metadata_str:
                metadata = self._deserialize_data(metadata_str)
            else:
                metadata = {
                    'collection': collection,
                    'created_at': datetime.utcnow().isoformat(),
                    'record_count': 0,
                    'last_updated': datetime.utcnow().isoformat()
                }
            
            # 更新元数据
            if operation == 'create':
                metadata['record_count'] = metadata.get('record_count', 0) + 1
            elif operation == 'delete':
                metadata['record_count'] = max(0, metadata.get('record_count', 0) - 1)
            
            metadata['last_updated'] = datetime.utcnow().isoformat()
            
            # 保存元数据
            await self._redis_client.set(metadata_key, self._serialize_data(metadata))
            
        except Exception as e:
            logger.warning(f"Failed to update collection metadata for {collection}: {e}")
    
    def _match_filter(self, data: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """检查数据是否匹配过滤条件"""
        for field, condition in filters.items():
            field_value = data.get(field)
            
            if isinstance(condition, dict):
                # 操作符条件
                for op, op_value in condition.items():
                    if op == '$eq':
                        if field_value != op_value:
                            return False
                    elif op == '$ne':
                        if field_value == op_value:
                            return False
                    elif op == '$gt':
                        try:
                            if not (field_value > op_value):
                                return False
                        except (TypeError, ValueError):
                            return False
                    elif op == '$gte':
                        try:
                            if not (field_value >= op_value):
                                return False
                        except (TypeError, ValueError):
                            return False
                    elif op == '$lt':
                        try:
                            if not (field_value < op_value):
                                return False
                        except (TypeError, ValueError):
                            return False
                    elif op == '$lte':
                        try:
                            if not (field_value <= op_value):
                                return False
                        except (TypeError, ValueError):
                            return False
                    elif op == '$in':
                        if field_value not in op_value:
                            return False
                    elif op == '$nin':
                        if field_value in op_value:
                            return False
                    elif op == '$exists':
                        field_exists = field in data
                        if op_value != field_exists:
                            return False
                    elif op == '$regex':
                        import re
                        try:
                            if not re.search(op_value, str(field_value)):
                                return False
                        except re.error:
                            return False
            else:
                # 直接值比较
                if field_value != condition:
                    return False
        
        return True
    
    def _apply_field_selection(self, data: Dict[str, Any], query: StorageQuery) -> Dict[str, Any]:
        """应用字段选择"""
        if query.include_fields:
            return {k: v for k, v in data.items() 
                   if k in query.include_fields or k in ['_key', '_created_at', '_updated_at']}
        elif query.exclude_fields:
            return {k: v for k, v in data.items() if k not in query.exclude_fields}
        return data
    
    async def create(self, collection: str, data: Dict[str, Any], 
                    transaction_id: Optional[str] = None) -> StorageResult:
        """创建记录"""
        try:
            key = self._generate_key(data)
            redis_key = self._get_collection_key(collection, key)
            
            # 检查记录是否已存在
            existing = await self._redis_client.exists(redis_key)
            if existing:
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' already exists"
                )
            
            # 准备记录数据
            record = data.copy()
            record['_key'] = key
            record['_created_at'] = datetime.utcnow().isoformat()
            record['_updated_at'] = datetime.utcnow().isoformat()
            
            # 保存记录
            serialized_data = self._serialize_data(record)
            if self._default_ttl:
                await self._redis_client.setex(redis_key, self._default_ttl, serialized_data)
            else:
                await self._redis_client.set(redis_key, serialized_data)
            
            # 更新集合元数据
            await self._update_collection_metadata(collection, 'create', key)
            
            return StorageResult(
                success=True,
                data={'key': key, 'record': record},
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to create record in {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def read(self, collection: str, key: str,
                  transaction_id: Optional[str] = None) -> StorageResult:
        """读取记录"""
        try:
            redis_key = self._get_collection_key(collection, key)
            
            data_str = await self._redis_client.get(redis_key)
            if not data_str:
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            record = self._deserialize_data(data_str)
            
            return StorageResult(
                success=True,
                data=record,
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to read record {key} from {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def update(self, collection: str, key: str, data: Dict[str, Any],
                    transaction_id: Optional[str] = None) -> StorageResult:
        """更新记录"""
        try:
            redis_key = self._get_collection_key(collection, key)
            
            # 获取现有记录
            existing_str = await self._redis_client.get(redis_key)
            if not existing_str:
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            # 合并数据
            existing_data = self._deserialize_data(existing_str)
            existing_data.update(data)
            existing_data['_key'] = key
            existing_data['_updated_at'] = datetime.utcnow().isoformat()
            
            # 保存更新后的记录
            serialized_data = self._serialize_data(existing_data)
            if self._default_ttl:
                await self._redis_client.setex(redis_key, self._default_ttl, serialized_data)
            else:
                await self._redis_client.set(redis_key, serialized_data)
            
            return StorageResult(
                success=True,
                data=existing_data,
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to update record {key} in {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def delete(self, collection: str, key: str,
                    transaction_id: Optional[str] = None) -> StorageResult:
        """删除记录"""
        try:
            redis_key = self._get_collection_key(collection, key)
            
            # 获取要删除的记录
            data_str = await self._redis_client.get(redis_key)
            if not data_str:
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            record = self._deserialize_data(data_str)
            
            # 删除记录
            await self._redis_client.delete(redis_key)
            
            # 更新集合元数据
            await self._update_collection_metadata(collection, 'delete', key)
            
            return StorageResult(
                success=True,
                data=record,
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to delete record {key} from {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def list(self, collection: str, query: Optional[StorageQuery] = None,
                  transaction_id: Optional[str] = None) -> StorageResult:
        """列出记录"""
        try:
            if query is None:
                query = StorageQuery(filters={})
            
            # 扫描集合中的所有记录
            pattern = self._get_collection_key(collection, "*")
            records = []
            
            async for redis_key in self._redis_client.scan_iter(match=pattern):
                try:
                    data_str = await self._redis_client.get(redis_key)
                    if data_str:
                        record = self._deserialize_data(data_str)
                        
                        # 应用过滤条件
                        if query.filters and not self._match_filter(record, query.filters):
                            continue
                        
                        # 应用字段选择
                        record = self._apply_field_selection(record, query)
                        records.append(record)
                        
                except Exception as e:
                    logger.warning(f"Failed to process record {redis_key}: {e}")
                    continue
            
            # 排序
            if query.sort_by:
                reverse = query.sort_order == "desc"
                try:
                    records.sort(key=lambda x: x.get(query.sort_by, 0), reverse=reverse)
                except TypeError:
                    # 如果无法比较，按字符串排序
                    records.sort(key=lambda x: str(x.get(query.sort_by, "")), reverse=reverse)
            
            # 分页
            total_count = len(records)
            if query.offset:
                records = records[query.offset:]
            if query.limit:
                records = records[:query.limit]
            
            return StorageResult(
                success=True,
                data=records,
                metadata={'total_count': total_count, 'returned_count': len(records)},
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to list records from {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def search(self, collection: str, query: StorageQuery,
                    transaction_id: Optional[str] = None) -> StorageResult:
        """搜索记录"""
        # Redis存储中，搜索和列出功能相同
        return await self.list(collection, query, transaction_id)
    
    async def batch_create(self, collection: str, data_list: List[Dict[str, Any]],
                          transaction_id: Optional[str] = None) -> StorageResult:
        """批量创建"""
        try:
            pipe = self._redis_client.pipeline()
            results = []
            errors = []
            
            for data in data_list:
                try:
                    key = self._generate_key(data)
                    redis_key = self._get_collection_key(collection, key)
                    
                    # 准备记录
                    record = data.copy()
                    record['_key'] = key
                    record['_created_at'] = datetime.utcnow().isoformat()
                    record['_updated_at'] = datetime.utcnow().isoformat()
                    
                    # 添加到管道（使用SETNX确保不覆盖现有记录）
                    serialized_data = self._serialize_data(record)
                    pipe.setnx(redis_key, serialized_data)
                    
                    if self._default_ttl:
                        pipe.expire(redis_key, self._default_ttl)
                    
                    results.append({'key': key, 'record': record})
                    
                except Exception as e:
                    errors.append(str(e))
            
            # 执行管道
            pipe_results = await pipe.execute()
            
            # 检查结果
            successful_creates = []
            for i, (result, record_info) in enumerate(zip(pipe_results[::2], results)):
                if result:  # SETNX返回1表示成功设置
                    successful_creates.append(record_info)
                    # 更新集合元数据
                    await self._update_collection_metadata(collection, 'create', record_info['key'])
                else:
                    errors.append(f"Record with key '{record_info['key']}' already exists")
            
            return StorageResult(
                success=len(errors) == 0,
                data=successful_creates,
                error="; ".join(errors) if errors else None,
                metadata={'created_count': len(successful_creates), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to batch create records in {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def batch_update(self, collection: str, updates: List[Dict[str, Any]],
                          transaction_id: Optional[str] = None) -> StorageResult:
        """批量更新"""
        try:
            results = []
            errors = []
            
            for update_data in updates:
                try:
                    key = update_data.pop('_key', None)
                    if not key:
                        errors.append("Missing '_key' in update data")
                        continue
                    
                    redis_key = self._get_collection_key(collection, key)
                    
                    # 获取现有记录
                    existing_str = await self._redis_client.get(redis_key)
                    if not existing_str:
                        errors.append(f"Record with key '{key}' not found")
                        continue
                    
                    # 合并数据
                    existing_data = self._deserialize_data(existing_str)
                    existing_data.update(update_data)
                    existing_data['_key'] = key
                    existing_data['_updated_at'] = datetime.utcnow().isoformat()
                    
                    # 保存更新后的记录
                    serialized_data = self._serialize_data(existing_data)
                    if self._default_ttl:
                        await self._redis_client.setex(redis_key, self._default_ttl, serialized_data)
                    else:
                        await self._redis_client.set(redis_key, serialized_data)
                    
                    results.append(existing_data)
                    
                except Exception as e:
                    errors.append(str(e))
            
            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={'updated_count': len(results), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to batch update records in {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def batch_delete(self, collection: str, keys: List[str],
                          transaction_id: Optional[str] = None) -> StorageResult:
        """批量删除"""
        try:
            results = []
            errors = []
            
            for key in keys:
                try:
                    redis_key = self._get_collection_key(collection, key)
                    
                    # 获取要删除的记录
                    data_str = await self._redis_client.get(redis_key)
                    if not data_str:
                        errors.append(f"Record with key '{key}' not found")
                        continue
                    
                    record = self._deserialize_data(data_str)
                    
                    # 删除记录
                    await self._redis_client.delete(redis_key)
                    
                    # 更新集合元数据
                    await self._update_collection_metadata(collection, 'delete', key)
                    
                    results.append(record)
                    
                except Exception as e:
                    errors.append(str(e))
            
            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={'deleted_count': len(results), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to batch delete records from {collection}: {e}")
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def begin_transaction(self) -> str:
        """开始事务（Redis模拟事务）"""
        transaction_id = str(uuid.uuid4())
        
        with self._lock:
            self._transactions[transaction_id] = StorageTransaction(
                transaction_id=transaction_id,
                operations=[],
                created_at=datetime.utcnow(),
                status="pending"
            )
        
        # 记录事务到Redis
        transaction_key = self._get_transaction_key(transaction_id)
        transaction_data = {
            'transaction_id': transaction_id,
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat(),
            'operations': []
        }
        
        await self._redis_client.set(
            transaction_key, 
            self._serialize_data(transaction_data),
            ex=3600  # 1小时过期
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
            
            # 更新Redis中的事务状态
            transaction_key = self._get_transaction_key(transaction_id)
            transaction_str = await self._redis_client.get(transaction_key)
            
            if transaction_str:
                transaction_data = self._deserialize_data(transaction_str)
                transaction_data['status'] = 'committed'
                await self._redis_client.set(transaction_key, self._serialize_data(transaction_data))
            
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
            
            # 更新Redis中的事务状态
            transaction_key = self._get_transaction_key(transaction_id)
            transaction_str = await self._redis_client.get(transaction_key)
            
            if transaction_str:
                transaction_data = self._deserialize_data(transaction_str)
                transaction_data['status'] = 'rolled_back'
                await self._redis_client.set(transaction_key, self._serialize_data(transaction_data))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to rollback transaction {transaction_id}: {e}")
            return False
    
    async def create_index(self, collection: str, fields: List[str], 
                          unique: bool = False) -> bool:
        """创建索引（Redis中主要用于记录索引信息）"""
        try:
            index_name = "_".join(fields)
            index_key = self._get_index_key(collection, index_name)
            
            index_data = {
                'collection': collection,
                'index_name': index_name,
                'fields': fields,
                'unique': unique,
                'created_at': datetime.utcnow().isoformat()
            }
            
            await self._redis_client.set(index_key, self._serialize_data(index_data))
            
            # 在Redis中，我们可以为每个字段创建辅助的集合来加速查询
            # 但这会增加存储开销，这里仅记录索引信息
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create index for {collection}: {e}")
            return False
    
    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            index_key = self._get_index_key(collection, index_name)
            
            # 检查索引是否存在
            if not await self._redis_client.exists(index_key):
                return False
            
            # 删除索引
            await self._redis_client.delete(index_key)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to drop index {index_name} for {collection}: {e}")
            return False
    
    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        try:
            pattern = self._get_index_key(collection, "*")
            indexes = []
            
            async for index_key in self._redis_client.scan_iter(match=pattern):
                try:
                    index_str = await self._redis_client.get(index_key)
                    if index_str:
                        index_data = self._deserialize_data(index_str)
                        indexes.append({
                            'name': index_data.get('index_name'),
                            'fields': index_data.get('fields', []),
                            'unique': index_data.get('unique', False),
                            'created_at': index_data.get('created_at')
                        })
                except Exception as e:
                    logger.warning(f"Failed to process index {index_key}: {e}")
                    continue
            
            return indexes
            
        except Exception as e:
            logger.error(f"Failed to list indexes for {collection}: {e}")
            return []

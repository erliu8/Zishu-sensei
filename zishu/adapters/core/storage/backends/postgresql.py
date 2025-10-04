"""
PostgreSQL存储后端实现
提供基于PostgreSQL数据库的存储功能，适用于企业级生产环境
"""

import asyncio
import asyncpg
import json
import uuid
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import threading
from concurrent.futures import ThreadPoolExecutor

from ..interfaces import (
    IStorageBackend, StorageBackendType, StorageQuery, 
    StorageResult, StorageTransaction, StorageException,
    NotFoundError, DuplicateError, ValidationError, ConnectionError
)

logger = logging.getLogger(__name__)


class PostgreSQLStorageBackend(IStorageBackend):
    """PostgreSQL存储后端"""
    
    def __init__(self):
        self._connected = False
        self._connection_pool: Optional[asyncpg.Pool] = None
        self._pool_config: Dict[str, Any] = {}
        self._transactions: Dict[str, StorageTransaction] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)
        
        # SQL 模板
        self._create_table_sql = """
        CREATE TABLE IF NOT EXISTS {collection} (
            key VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            metadata JSONB
        )
        """
        
        self._create_index_table_sql = """
        CREATE TABLE IF NOT EXISTS _indexes (
            collection VARCHAR(255) NOT NULL,
            index_name VARCHAR(255) NOT NULL,
            fields JSONB NOT NULL,
            unique_constraint BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (collection, index_name)
        )
        """
        
        self._create_transaction_table_sql = """
        CREATE TABLE IF NOT EXISTS _transactions (
            transaction_id UUID PRIMARY KEY,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            operations JSONB
        )
        """
    
    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.POSTGRESQL
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._connection_pool is not None
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到PostgreSQL数据库"""
        try:
            self._pool_config = {
                'host': config.get('host', 'localhost'),
                'port': config.get('port', 5432),
                'user': config.get('user', 'postgres'),
                'password': config.get('password', ''),
                'database': config.get('database', 'zishu'),
                'min_size': config.get('min_pool_size', 5),
                'max_size': config.get('max_pool_size', 20),
                'command_timeout': config.get('command_timeout', 60),
                'server_settings': {
                    'application_name': 'zishu-adapter-storage',
                    'timezone': 'UTC'
                }
            }
            
            # 创建连接池
            self._connection_pool = await asyncpg.create_pool(**self._pool_config)
            
            # 初始化数据库结构
            await self._initialize_database()
            
            self._connected = True
            logger.info(f"Connected to PostgreSQL database: {self._pool_config['host']}:{self._pool_config['port']}/{self._pool_config['database']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL database: {e}")
            raise ConnectionError(f"Failed to connect to PostgreSQL database: {e}")
    
    async def disconnect(self) -> bool:
        """断开PostgreSQL数据库连接"""
        try:
            if self._connection_pool:
                await self._connection_pool.close()
                self._connection_pool = None
            
            with self._lock:
                self._connected = False
                self._transactions.clear()
            
            logger.info("Disconnected from PostgreSQL database")
            return True
            
        except Exception as e:
            logger.error(f"Failed to disconnect from PostgreSQL database: {e}")
            raise StorageException(f"Failed to disconnect from PostgreSQL database: {e}")
    
    async def _initialize_database(self) -> None:
        """初始化数据库结构"""
        async with self._connection_pool.acquire() as conn:
            # 创建索引表
            await conn.execute(self._create_index_table_sql)
            
            # 创建事务表
            await conn.execute(self._create_transaction_table_sql)
            
            # 创建必要的扩展
            try:
                await conn.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
            except Exception as e:
                logger.warning(f"Failed to create uuid-ossp extension: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            async with self._connection_pool.acquire() as conn:
                # 执行简单查询测试连接
                await conn.fetchval("SELECT 1")
                
                # 获取数据库信息
                tables = await conn.fetch("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    AND table_name NOT LIKE '_%'
                """)
                
                table_names = [row['table_name'] for row in tables]
                
                # 统计记录数
                total_records = 0
                for table in table_names:
                    try:
                        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                        total_records += count or 0
                    except Exception:
                        continue
                
                active_transactions = len([t for t in self._transactions.values() 
                                         if t.status == "pending"])
                
                # 获取数据库统计信息
                db_stats = await conn.fetchrow("""
                    SELECT 
                        pg_database_size(current_database()) as db_size,
                        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
                """)
                
                pool_stats = {
                    'size': self._connection_pool.get_size(),
                    'min_size': self._connection_pool.get_min_size(),
                    'max_size': self._connection_pool.get_max_size(),
                    'idle_size': self._connection_pool.get_idle_size()
                }
                
                return {
                    "status": "healthy" if self._connected else "disconnected",
                    "backend_type": self.backend_type.value,
                    "host": self._pool_config.get('host'),
                    "port": self._pool_config.get('port'),
                    "database": self._pool_config.get('database'),
                    "tables": table_names,
                    "tables_count": len(table_names),
                    "total_records": total_records,
                    "active_transactions": active_transactions,
                    "connection_pool": pool_stats,
                    "database_info": {
                        "size": db_stats['db_size'],
                        "size_mb": round(db_stats['db_size'] / 1024 / 1024, 2),
                        "active_connections": db_stats['active_connections']
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
    
    def _sanitize_table_name(self, collection: str) -> str:
        """清理表名，确保SQL安全"""
        import re
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', collection)
        if not sanitized[0].isalpha():
            sanitized = 'table_' + sanitized
        return sanitized.lower()  # PostgreSQL推荐小写表名
    
    async def _ensure_table_exists(self, collection: str) -> None:
        """确保表存在"""
        table_name = self._sanitize_table_name(collection)
        create_sql = self._create_table_sql.format(collection=table_name)
        
        async with self._connection_pool.acquire() as conn:
            await conn.execute(create_sql)
            
            # 创建基础索引
            try:
                await conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_created_at ON {table_name} (created_at)")
                await conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_updated_at ON {table_name} (updated_at)")
                await conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_data_gin ON {table_name} USING GIN (data)")
            except Exception as e:
                logger.warning(f"Failed to create default indexes for {table_name}: {e}")
    
    def _build_where_clause(self, filters: Dict[str, Any]) -> tuple:
        """构建WHERE子句"""
        if not filters:
            return "", []
        
        conditions = []
        params = []
        param_counter = 1
        
        for field, value in filters.items():
            if isinstance(value, dict):
                # 支持操作符
                for op, op_value in value.items():
                    if op == '$eq':
                        conditions.append(f"data->>${param_counter} = ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$ne':
                        conditions.append(f"data->>${param_counter} != ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$gt':
                        conditions.append(f"(data->>${param_counter})::numeric > ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$gte':
                        conditions.append(f"(data->>${param_counter})::numeric >= ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$lt':
                        conditions.append(f"(data->>${param_counter})::numeric < ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$lte':
                        conditions.append(f"(data->>${param_counter})::numeric <= ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$in':
                        placeholders = ','.join([f"${param_counter + i}" for i in range(len(op_value))])
                        conditions.append(f"data->>${param_counter} IN ({placeholders})")
                        params.append(field)
                        params.extend(op_value)
                        param_counter += len(op_value) + 1
                    elif op == '$nin':
                        placeholders = ','.join([f"${param_counter + i}" for i in range(len(op_value))])
                        conditions.append(f"data->>${param_counter} NOT IN ({placeholders})")
                        params.append(field)
                        params.extend(op_value)
                        param_counter += len(op_value) + 1
                    elif op == '$regex':
                        conditions.append(f"data->>${param_counter} ~ ${param_counter + 1}")
                        params.extend([field, op_value])
                        param_counter += 2
                    elif op == '$exists':
                        if op_value:
                            conditions.append(f"data ? ${param_counter}")
                        else:
                            conditions.append(f"NOT data ? ${param_counter}")
                        params.append(field)
                        param_counter += 1
            else:
                conditions.append(f"data->>${param_counter} = ${param_counter + 1}")
                params.extend([field, json.dumps(value) if not isinstance(value, str) else value])
                param_counter += 2
        
        where_clause = " AND ".join(conditions)
        return f"WHERE {where_clause}" if where_clause else "", params
    
    def _apply_query_options(self, base_sql: str, query: StorageQuery, param_counter: int) -> tuple:
        """应用查询选项（排序、分页等）"""
        sql_parts = [base_sql]
        params = []
        
        # 排序
        if query.sort_by:
            order = "DESC" if query.sort_order == "desc" else "ASC"
            sql_parts.append(f"ORDER BY data->>${param_counter} {order}")
            params.append(query.sort_by)
            param_counter += 1
        
        # 分页
        if query.limit:
            sql_parts.append(f"LIMIT ${param_counter}")
            params.append(query.limit)
            param_counter += 1
            
            if query.offset:
                sql_parts.append(f"OFFSET ${param_counter}")
                params.append(query.offset)
                param_counter += 1
        
        return " ".join(sql_parts), params
    
    def _process_record_fields(self, record: Dict[str, Any], query: StorageQuery) -> Dict[str, Any]:
        """处理记录字段选择"""
        if not record:
            return record
        
        # 合并JSONB数据到记录中
        if 'data' in record and record['data']:
            record.update(record['data'])
            del record['data']
        
        # 处理时间戳
        if 'created_at' in record and hasattr(record['created_at'], 'isoformat'):
            record['created_at'] = record['created_at'].isoformat()
        if 'updated_at' in record and hasattr(record['updated_at'], 'isoformat'):
            record['updated_at'] = record['updated_at'].isoformat()
        
        # 字段选择
        if query.include_fields:
            filtered_record = {k: v for k, v in record.items() 
                             if k in query.include_fields or k in ['key', 'created_at', 'updated_at']}
            return filtered_record
        elif query.exclude_fields:
            filtered_record = {k: v for k, v in record.items() 
                             if k not in query.exclude_fields}
            return filtered_record
        
        return record
    
    async def create(self, collection: str, data: Dict[str, Any], 
                    transaction_id: Optional[str] = None) -> StorageResult:
        """创建记录"""
        try:
            await self._ensure_table_exists(collection)
            table_name = self._sanitize_table_name(collection)
            
            key = self._generate_key(data)
            
            # 准备记录数据
            record = data.copy()
            record['_key'] = key
            
            async with self._connection_pool.acquire() as conn:
                # 检查记录是否已存在
                existing = await conn.fetchval(
                    f"SELECT key FROM {table_name} WHERE key = $1", key
                )
                
                if existing:
                    return StorageResult(
                        success=False,
                        error=f"Record with key '{key}' already exists"
                    )
                
                # 插入记录
                await conn.execute(
                    f"INSERT INTO {table_name} (key, data) VALUES ($1, $2)",
                    key, json.dumps(record)
                )
                
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
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                record = await conn.fetchrow(
                    f"SELECT * FROM {table_name} WHERE key = $1", key
                )
                
                if not record:
                    return StorageResult(
                        success=False,
                        error=f"Record with key '{key}' not found"
                    )
                
                # 转换为字典并处理数据
                record_dict = dict(record)
                if 'data' in record_dict and record_dict['data']:
                    record_dict.update(record_dict['data'])
                    del record_dict['data']
                
                # 处理时间戳
                if 'created_at' in record_dict and hasattr(record_dict['created_at'], 'isoformat'):
                    record_dict['created_at'] = record_dict['created_at'].isoformat()
                if 'updated_at' in record_dict and hasattr(record_dict['updated_at'], 'isoformat'):
                    record_dict['updated_at'] = record_dict['updated_at'].isoformat()
                
                return StorageResult(
                    success=True,
                    data=record_dict,
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
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                # 获取现有记录
                existing = await conn.fetchrow(
                    f"SELECT data FROM {table_name} WHERE key = $1", key
                )
                
                if not existing:
                    return StorageResult(
                        success=False,
                        error=f"Record with key '{key}' not found"
                    )
                
                # 合并数据
                current_data = existing['data'] or {}
                current_data.update(data)
                current_data['_key'] = key
                
                # 更新记录
                await conn.execute(
                    f"UPDATE {table_name} SET data = $1, updated_at = NOW() WHERE key = $2",
                    json.dumps(current_data), key
                )
                
                # 获取更新后的记录
                updated_record = await conn.fetchrow(
                    f"SELECT * FROM {table_name} WHERE key = $1", key
                )
                
                record_dict = dict(updated_record)
                if 'data' in record_dict and record_dict['data']:
                    record_dict.update(record_dict['data'])
                    del record_dict['data']
                
                if 'updated_at' in record_dict and hasattr(record_dict['updated_at'], 'isoformat'):
                    record_dict['updated_at'] = record_dict['updated_at'].isoformat()
                
                return StorageResult(
                    success=True,
                    data=record_dict,
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
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                # 获取要删除的记录
                record = await conn.fetchrow(
                    f"SELECT * FROM {table_name} WHERE key = $1", key
                )
                
                if not record:
                    return StorageResult(
                        success=False,
                        error=f"Record with key '{key}' not found"
                    )
                
                # 删除记录
                await conn.execute(
                    f"DELETE FROM {table_name} WHERE key = $1", key
                )
                
                # 处理返回数据
                record_dict = dict(record)
                if 'data' in record_dict and record_dict['data']:
                    record_dict.update(record_dict['data'])
                    del record_dict['data']
                
                if 'created_at' in record_dict and hasattr(record_dict['created_at'], 'isoformat'):
                    record_dict['created_at'] = record_dict['created_at'].isoformat()
                if 'updated_at' in record_dict and hasattr(record_dict['updated_at'], 'isoformat'):
                    record_dict['updated_at'] = record_dict['updated_at'].isoformat()
                
                return StorageResult(
                    success=True,
                    data=record_dict,
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
            table_name = self._sanitize_table_name(collection)
            
            if query is None:
                query = StorageQuery(filters={})
            
            # 构建查询
            base_sql = f"SELECT * FROM {table_name}"
            where_clause, where_params = self._build_where_clause(query.filters)
            param_counter = len(where_params) + 1
            
            if where_clause:
                base_sql += f" {where_clause}"
            
            # 应用查询选项
            final_sql, query_params = self._apply_query_options(base_sql, query, param_counter)
            all_params = where_params + query_params
            
            async with self._connection_pool.acquire() as conn:
                # 执行查询
                records = await conn.fetch(final_sql, *all_params)
                
                # 处理记录
                processed_records = []
                for record in records:
                    record_dict = dict(record)
                    processed_record = self._process_record_fields(record_dict, query)
                    processed_records.append(processed_record)
                
                return StorageResult(
                    success=True,
                    data=processed_records,
                    metadata={'total_count': len(processed_records)},
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
        # PostgreSQL存储中，搜索和列出功能相同，但可以利用全文搜索
        return await self.list(collection, query, transaction_id)
    
    async def batch_create(self, collection: str, data_list: List[Dict[str, Any]],
                          transaction_id: Optional[str] = None) -> StorageResult:
        """批量创建"""
        try:
            await self._ensure_table_exists(collection)
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                async with conn.transaction():
                    results = []
                    errors = []
                    
                    for data in data_list:
                        try:
                            key = self._generate_key(data)
                            
                            # 检查是否已存在
                            existing = await conn.fetchval(
                                f"SELECT key FROM {table_name} WHERE key = $1", key
                            )
                            
                            if existing:
                                errors.append(f"Record with key '{key}' already exists")
                                continue
                            
                            # 准备记录
                            record = data.copy()
                            record['_key'] = key
                            
                            # 插入记录
                            await conn.execute(
                                f"INSERT INTO {table_name} (key, data) VALUES ($1, $2)",
                                key, json.dumps(record)
                            )
                            
                            results.append({'key': key, 'record': record})
                            
                        except Exception as e:
                            errors.append(str(e))
                    
                    return StorageResult(
                        success=len(errors) == 0,
                        data=results,
                        error="; ".join(errors) if errors else None,
                        metadata={'created_count': len(results), 'error_count': len(errors)},
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
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                async with conn.transaction():
                    results = []
                    errors = []
                    
                    for update_data in updates:
                        try:
                            key = update_data.pop('_key', None)
                            if not key:
                                errors.append("Missing '_key' in update data")
                                continue
                            
                            # 获取现有记录
                            existing = await conn.fetchrow(
                                f"SELECT data FROM {table_name} WHERE key = $1", key
                            )
                            
                            if not existing:
                                errors.append(f"Record with key '{key}' not found")
                                continue
                            
                            # 合并数据
                            current_data = existing['data'] or {}
                            current_data.update(update_data)
                            
                            # 更新记录
                            await conn.execute(
                                f"UPDATE {table_name} SET data = $1, updated_at = NOW() WHERE key = $2",
                                json.dumps(current_data), key
                            )
                            
                            results.append(current_data)
                            
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
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                async with conn.transaction():
                    results = []
                    errors = []
                    
                    for key in keys:
                        try:
                            # 获取要删除的记录
                            record = await conn.fetchrow(
                                f"SELECT * FROM {table_name} WHERE key = $1", key
                            )
                            
                            if not record:
                                errors.append(f"Record with key '{key}' not found")
                                continue
                            
                            # 删除记录
                            await conn.execute(
                                f"DELETE FROM {table_name} WHERE key = $1", key
                            )
                            
                            # 处理返回数据
                            record_dict = dict(record)
                            if 'data' in record_dict and record_dict['data']:
                                record_dict.update(record_dict['data'])
                                del record_dict['data']
                            
                            results.append(record_dict)
                            
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
        """开始事务"""
        transaction_id = str(uuid.uuid4())
        
        with self._lock:
            self._transactions[transaction_id] = StorageTransaction(
                transaction_id=transaction_id,
                operations=[],
                created_at=datetime.utcnow(),
                status="pending"
            )
        
        # 记录事务到数据库
        async with self._connection_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO _transactions (transaction_id, status, operations) VALUES ($1, $2, $3)",
                transaction_id, "pending", json.dumps([])
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
            async with self._connection_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE _transactions SET status = $1 WHERE transaction_id = $2",
                    "committed", transaction_id
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
            async with self._connection_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE _transactions SET status = $1 WHERE transaction_id = $2",
                    "rolled_back", transaction_id
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to rollback transaction {transaction_id}: {e}")
            return False
    
    async def create_index(self, collection: str, fields: List[str], 
                          unique: bool = False) -> bool:
        """创建索引"""
        try:
            table_name = self._sanitize_table_name(collection)
            index_name = "_".join(fields)
            
            async with self._connection_pool.acquire() as conn:
                # 记录索引信息
                await conn.execute(
                    "INSERT INTO _indexes (collection, index_name, fields, unique_constraint) VALUES ($1, $2, $3, $4) ON CONFLICT (collection, index_name) DO UPDATE SET fields = $3, unique_constraint = $4",
                    collection, index_name, json.dumps(fields), unique
                )
                
                # 为JSONB字段创建索引
                for field in fields:
                    try:
                        db_index_name = f"idx_{table_name}_{field.replace('.', '_')}"
                        if unique:
                            index_sql = f"CREATE UNIQUE INDEX IF NOT EXISTS {db_index_name} ON {table_name} ((data->>'{field}'))"
                        else:
                            index_sql = f"CREATE INDEX IF NOT EXISTS {db_index_name} ON {table_name} ((data->>'{field}'))"
                        await conn.execute(index_sql)
                    except Exception as e:
                        logger.warning(f"Failed to create database index for field {field}: {e}")
                
                return True
                
        except Exception as e:
            logger.error(f"Failed to create index for {collection}: {e}")
            return False
    
    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            table_name = self._sanitize_table_name(collection)
            
            async with self._connection_pool.acquire() as conn:
                # 获取索引信息
                index_info = await conn.fetchrow(
                    "SELECT fields FROM _indexes WHERE collection = $1 AND index_name = $2",
                    collection, index_name
                )
                
                if not index_info:
                    return False
                
                # 删除数据库索引
                try:
                    fields = json.loads(index_info['fields'])
                    for field in fields:
                        db_index_name = f"idx_{table_name}_{field.replace('.', '_')}"
                        drop_sql = f"DROP INDEX IF EXISTS {db_index_name}"
                        await conn.execute(drop_sql)
                except Exception as e:
                    logger.warning(f"Failed to drop database index: {e}")
                
                # 删除索引记录
                await conn.execute(
                    "DELETE FROM _indexes WHERE collection = $1 AND index_name = $2",
                    collection, index_name
                )
                
                return True
                
        except Exception as e:
            logger.error(f"Failed to drop index {index_name} for {collection}: {e}")
            return False
    
    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        try:
            async with self._connection_pool.acquire() as conn:
                indexes = await conn.fetch(
                    "SELECT * FROM _indexes WHERE collection = $1", collection
                )
                
                result = []
                for index in indexes:
                    try:
                        fields = json.loads(index['fields'])
                        result.append({
                            'name': index['index_name'],
                            'fields': fields,
                            'unique': index['unique_constraint'],
                            'created_at': index['created_at'].isoformat() if hasattr(index['created_at'], 'isoformat') else index['created_at']
                        })
                    except json.JSONDecodeError:
                        continue
                
                return result
                
        except Exception as e:
            logger.error(f"Failed to list indexes for {collection}: {e}")
            return []

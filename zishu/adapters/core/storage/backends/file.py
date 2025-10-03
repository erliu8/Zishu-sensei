"""
文件存储后端实现
提供基于文件系统的存储功能，适用于单机部署
"""

import asyncio
import json
import os
import uuid
import aiofiles
import fcntl
from typing import Any, Dict, List, Optional
from datetime import datetime
from pathlib import Path
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor

from ..interfaces import (
    IStorageBackend, StorageBackendType, StorageQuery, 
    StorageResult, StorageTransaction, StorageException,
    NotFoundError, DuplicateError, ValidationError
)


class FileStorageBackend(IStorageBackend):
    """文件存储后端"""
    
    def __init__(self):
        self._connected = False
        self._base_path: Optional[Path] = None
        self._transactions: Dict[str, StorageTransaction] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._file_locks: Dict[str, threading.Lock] = {}
    
    @property
    def backend_type(self) -> StorageBackendType:
        return StorageBackendType.FILE
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    def _get_file_lock(self, file_path: str) -> threading.Lock:
        """获取文件锁"""
        if file_path not in self._file_locks:
            self._file_locks[file_path] = threading.Lock()
        return self._file_locks[file_path]
    
    def _get_collection_path(self, collection: str) -> Path:
        """获取集合路径"""
        return self._base_path / collection
    
    def _get_record_path(self, collection: str, key: str) -> Path:
        """获取记录路径"""
        return self._get_collection_path(collection) / f"{key}.json"
    
    def _get_index_path(self, collection: str) -> Path:
        """获取索引路径"""
        return self._get_collection_path(collection) / "_indexes.json"
    
    def _get_transaction_path(self, transaction_id: str) -> Path:
        """获取事务路径"""
        return self._base_path / "_transactions" / transaction_id
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到文件存储"""
        try:
            base_path = config.get('base_path', './storage')
            self._base_path = Path(base_path).resolve()
            
            # 创建基础目录
            self._base_path.mkdir(parents=True, exist_ok=True)
            
            # 创建事务目录
            (self._base_path / "_transactions").mkdir(exist_ok=True)
            
            self._connected = True
            return True
        except Exception as e:
            raise StorageException(f"Failed to connect to file storage: {e}")
    
    async def disconnect(self) -> bool:
        """断开文件存储连接"""
        try:
            with self._lock:
                self._connected = False
                self._transactions.clear()
                self._file_locks.clear()
            return True
        except Exception as e:
            raise StorageException(f"Failed to disconnect from file storage: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            collections = []
            total_records = 0
            
            if self._base_path and self._base_path.exists():
                for item in self._base_path.iterdir():
                    if item.is_dir() and not item.name.startswith('_'):
                        collections.append(item.name)
                        # 计算记录数
                        record_count = len([f for f in item.iterdir() 
                                          if f.suffix == '.json' and not f.name.startswith('_')])
                        total_records += record_count
            
            active_transactions = len([t for t in self._transactions.values() 
                                     if t.status == "pending"])
            
            return {
                "status": "healthy" if self._connected else "disconnected",
                "backend_type": self.backend_type.value,
                "base_path": str(self._base_path) if self._base_path else None,
                "collections": collections,
                "collections_count": len(collections),
                "total_records": total_records,
                "active_transactions": active_transactions,
                "disk_usage": {
                    "total_size": self._get_directory_size(self._base_path) if self._base_path else 0
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _get_directory_size(self, path: Path) -> int:
        """获取目录大小"""
        try:
            total = 0
            for item in path.rglob('*'):
                if item.is_file():
                    total += item.stat().st_size
            return total
        except Exception:
            return 0
    
    def _generate_key(self, data: Dict[str, Any]) -> str:
        """生成唯一键"""
        if 'id' in data:
            return str(data['id'])
        elif '_id' in data:
            return str(data['_id'])
        else:
            return str(uuid.uuid4())
    
    async def _read_json_file(self, file_path: Path) -> Dict[str, Any]:
        """读取JSON文件"""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except FileNotFoundError:
            raise NotFoundError(f"File not found: {file_path}")
        except json.JSONDecodeError as e:
            raise ValidationError(f"Invalid JSON in file {file_path}: {e}")
    
    async def _write_json_file(self, file_path: Path, data: Dict[str, Any]) -> None:
        """写入JSON文件"""
        try:
            # 确保目录存在
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 写入临时文件，然后原子性移动
            temp_path = file_path.with_suffix('.tmp')
            
            async with aiofiles.open(temp_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 原子性移动
            temp_path.replace(file_path)
        except Exception as e:
            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()
            raise StorageException(f"Failed to write file {file_path}: {e}")
    
    async def _delete_file(self, file_path: Path) -> None:
        """删除文件"""
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            raise StorageException(f"Failed to delete file {file_path}: {e}")
    
    def _apply_query_filters(self, records: List[Dict[str, Any]], 
                           query: StorageQuery) -> List[Dict[str, Any]]:
        """应用查询过滤器"""
        results = []
        
        for record in records:
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
                        if op == '$eq' and record_value != op_value:
                            match = False
                            break
                        elif op == '$ne' and record_value == op_value:
                            match = False
                            break
                        elif op == '$gt' and record_value <= op_value:
                            match = False
                            break
                        elif op == '$gte' and record_value < op_value:
                            match = False
                            break
                        elif op == '$lt' and record_value >= op_value:
                            match = False
                            break
                        elif op == '$lte' and record_value > op_value:
                            match = False
                            break
                        elif op == '$in' and record_value not in op_value:
                            match = False
                            break
                        elif op == '$nin' and record_value in op_value:
                            match = False
                            break
                        elif op == '$regex':
                            import re
                            if not re.search(op_value, str(record_value)):
                                match = False
                                break
                else:
                    if record_value != value:
                        match = False
                        break
            
            if match:
                results.append(record)
        
        # 排序
        if query.sort_by:
            reverse = query.sort_order == "desc"
            results.sort(key=lambda x: x.get(query.sort_by, ""), reverse=reverse)
        
        # 分页
        if query.offset:
            results = results[query.offset:]
        if query.limit:
            results = results[:query.limit]
        
        # 字段选择
        if query.include_fields:
            results = [{k: v for k, v in record.items() 
                       if k in query.include_fields or k == '_key'} 
                      for record in results]
        elif query.exclude_fields:
            results = [{k: v for k, v in record.items() 
                       if k not in query.exclude_fields} 
                      for record in results]
        
        return results
    
    def _get_record_path_for_transaction(self, collection: str, key: str,
                                       transaction_id: Optional[str] = None) -> Path:
        """获取事务中的记录路径"""
        if transaction_id:
            return self._get_transaction_path(transaction_id) / collection / f"{key}.json"
        return self._get_record_path(collection, key)
    
    async def create(self, collection: str, data: Dict[str, Any], 
                    transaction_id: Optional[str] = None) -> StorageResult:
        """创建记录"""
        try:
            key = self._generate_key(data)
            record_path = self._get_record_path_for_transaction(collection, key, transaction_id)
            
            # 检查记录是否已存在
            if record_path.exists():
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' already exists"
                )
            
            record = data.copy()
            record['_key'] = key
            record['_created_at'] = datetime.utcnow().isoformat()
            record['_updated_at'] = record['_created_at']
            
            await self._write_json_file(record_path, record)
            
            return StorageResult(
                success=True,
                data={'key': key, 'record': record},
                operation_time=datetime.utcnow()
            )
        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def read(self, collection: str, key: str,
                  transaction_id: Optional[str] = None) -> StorageResult:
        """读取记录"""
        try:
            record_path = self._get_record_path_for_transaction(collection, key, transaction_id)
            
            if not record_path.exists():
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            record = await self._read_json_file(record_path)
            
            return StorageResult(
                success=True,
                data=record,
                operation_time=datetime.utcnow()
            )
        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def update(self, collection: str, key: str, data: Dict[str, Any],
                    transaction_id: Optional[str] = None) -> StorageResult:
        """更新记录"""
        try:
            record_path = self._get_record_path_for_transaction(collection, key, transaction_id)
            
            if not record_path.exists():
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            # 读取现有记录
            record = await self._read_json_file(record_path)
            
            # 更新记录
            record.update(data)
            record['_updated_at'] = datetime.utcnow().isoformat()
            
            await self._write_json_file(record_path, record)
            
            return StorageResult(
                success=True,
                data=record,
                operation_time=datetime.utcnow()
            )
        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def delete(self, collection: str, key: str,
                    transaction_id: Optional[str] = None) -> StorageResult:
        """删除记录"""
        try:
            record_path = self._get_record_path_for_transaction(collection, key, transaction_id)
            
            if not record_path.exists():
                return StorageResult(
                    success=False,
                    error=f"Record with key '{key}' not found"
                )
            
            # 读取记录用于返回
            record = await self._read_json_file(record_path)
            
            # 删除文件
            await self._delete_file(record_path)
            
            return StorageResult(
                success=True,
                data=record,
                operation_time=datetime.utcnow()
            )
        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def list(self, collection: str, query: Optional[StorageQuery] = None,
                  transaction_id: Optional[str] = None) -> StorageResult:
        """列出记录"""
        try:
            if transaction_id:
                collection_path = self._get_transaction_path(transaction_id) / collection
            else:
                collection_path = self._get_collection_path(collection)
            
            if not collection_path.exists():
                return StorageResult(
                    success=True,
                    data=[],
                    metadata={'total_count': 0},
                    operation_time=datetime.utcnow()
                )
            
            # 读取所有记录
            records = []
            for file_path in collection_path.iterdir():
                if file_path.suffix == '.json' and not file_path.name.startswith('_'):
                    try:
                        record = await self._read_json_file(file_path)
                        records.append(record)
                    except Exception:
                        # 跳过损坏的文件
                        continue
            
            if query is None:
                query = StorageQuery(filters={})
            
            results = self._apply_query_filters(records, query)
            
            return StorageResult(
                success=True,
                data=results,
                metadata={'total_count': len(results)},
                operation_time=datetime.utcnow()
            )
        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e)
            )
    
    async def search(self, collection: str, query: StorageQuery,
                    transaction_id: Optional[str] = None) -> StorageResult:
        """搜索记录"""
        # 文件存储中，搜索和列出功能相同
        return await self.list(collection, query, transaction_id)
    
    async def batch_create(self, collection: str, data_list: List[Dict[str, Any]],
                          transaction_id: Optional[str] = None) -> StorageResult:
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
                metadata={'created_count': len(results), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
        except Exception as e:
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
                key = update_data.pop('_key', None)
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
                metadata={'updated_count': len(results), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
        except Exception as e:
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
                result = await self.delete(collection, key, transaction_id)
                if result.success:
                    results.append(result.data)
                else:
                    errors.append(result.error)
            
            return StorageResult(
                success=len(errors) == 0,
                data=results,
                error="; ".join(errors) if errors else None,
                metadata={'deleted_count': len(results), 'error_count': len(errors)},
                operation_time=datetime.utcnow()
            )
        except Exception as e:
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
        
        # 创建事务目录
        transaction_path = self._get_transaction_path(transaction_id)
        transaction_path.mkdir(parents=True, exist_ok=True)
        
        return transaction_id
    
    async def commit_transaction(self, transaction_id: str) -> bool:
        """提交事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False
                
                transaction_path = self._get_transaction_path(transaction_id)
                
                # 将事务中的文件移动到主存储区域
                if transaction_path.exists():
                    for collection_dir in transaction_path.iterdir():
                        if collection_dir.is_dir():
                            target_collection_path = self._get_collection_path(collection_dir.name)
                            target_collection_path.mkdir(parents=True, exist_ok=True)
                            
                            for file_path in collection_dir.iterdir():
                                if file_path.is_file():
                                    target_file_path = target_collection_path / file_path.name
                                    shutil.move(str(file_path), str(target_file_path))
                    
                    # 删除事务目录
                    shutil.rmtree(transaction_path)
                
                # 更新事务状态
                self._transactions[transaction_id].status = "committed"
                
                return True
        except Exception:
            return False
    
    async def rollback_transaction(self, transaction_id: str) -> bool:
        """回滚事务"""
        try:
            with self._lock:
                if transaction_id not in self._transactions:
                    return False
                
                transaction_path = self._get_transaction_path(transaction_id)
                
                # 删除事务目录
                if transaction_path.exists():
                    shutil.rmtree(transaction_path)
                
                # 更新事务状态
                self._transactions[transaction_id].status = "rolled_back"
                
                return True
        except Exception:
            return False
    
    async def create_index(self, collection: str, fields: List[str], 
                          unique: bool = False) -> bool:
        """创建索引"""
        try:
            index_path = self._get_index_path(collection)
            
            # 读取现有索引
            indexes = {}
            if index_path.exists():
                indexes = await self._read_json_file(index_path)
            
            # 添加新索引
            index_name = "_".join(fields)
            indexes[index_name] = {
                'fields': fields,
                'unique': unique,
                'created_at': datetime.utcnow().isoformat()
            }
            
            # 保存索引
            await self._write_json_file(index_path, indexes)
            
            return True
        except Exception:
            return False
    
    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除索引"""
        try:
            index_path = self._get_index_path(collection)
            
            if not index_path.exists():
                return False
            
            # 读取现有索引
            indexes = await self._read_json_file(index_path)
            
            if index_name in indexes:
                del indexes[index_name]
                
                # 保存索引
                await self._write_json_file(index_path, indexes)
                return True
            
            return False
        except Exception:
            return False
    
    async def list_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """列出索引"""
        try:
            index_path = self._get_index_path(collection)
            
            if not index_path.exists():
                return []
            
            indexes = await self._read_json_file(index_path)
            
            return [
                {
                    'name': name,
                    'fields': info['fields'],
                    'unique': info['unique'],
                    'created_at': info['created_at']
                }
                for name, info in indexes.items()
            ]
        except Exception:
            return []

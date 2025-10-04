# -*- coding: utf-8 -*-
"""
存储系统集成测试

测试存储系统各组件的协调工作
"""

import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.storage.factory import StorageFactory
from zishu.storage.migration import MigrationManager, MigrationConfig
from zishu.storage.backends.memory import MemoryStorageBackend, MemoryStorageConfig
from zishu.storage.backends.file import FileStorageBackend, FileStorageConfig
from zishu.storage.backends.sqlite import SQLiteStorageBackend, SQLiteStorageConfig
from zishu.storage.replication import ReplicationManager, ReplicationConfig
from zishu.storage.sharding import ShardingManager, ShardingConfig
from zishu.storage.load_balancer import LoadBalancer, LoadBalancingConfig
from zishu.storage.cache import CacheManager, CacheConfig
from zishu.storage.monitoring import StorageMonitor, MonitoringConfig
from zishu.storage.core.types import (
    StorageKey, StorageValue, StorageQuery, StorageResult,
    StorageTransaction, StorageIndex, StorageSchema,
    StorageBackendType, ConsistencyLevel, ReplicationMode
)
from zishu.storage.core.exceptions import (
    StorageException, ManagerException, ReplicationException,
    ShardingException, LoadBalancingException
)

from tests.utils.storage_test_utils import StorageTestUtils


class TestStorageSystemIntegration:
    """存储系统集成测试类"""

    @pytest.fixture
    def temp_dirs(self):
        """创建多个临时目录"""
        dirs = []
        for i in range(5):
            temp_dir = tempfile.mkdtemp(prefix=f'storage_test_{i}_')
            dirs.append(temp_dir)
        
        yield dirs
        
        for temp_dir in dirs:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    async def storage_system(self, temp_dirs):
        """创建完整的存储系统"""
        # 存储管理器配置
        manager_config = StorageManagerConfig(
            name='integration_storage_manager',
            enabled=True,
            default_backend='memory',
            enable_replication=True,
            enable_sharding=True,
            enable_load_balancing=True,
            enable_caching=True,
            cache_size_mb=100,
            consistency_level=ConsistencyLevel.EVENTUAL,
            health_check_interval=30,
            metrics_enabled=True
        )
        
        # 创建存储管理器
        storage_manager = StorageManager(config=manager_config)
        await storage_manager.initialize()
        
        # 注册多个后端
        backends = {}
        
        # 内存后端
        memory_config = MemoryStorageConfig(
            name='primary_memory',
            max_memory_mb=50
        )
        backends['memory'] = await storage_manager.register_backend(
            'memory', memory_config, is_default=True
        )
        
        # 文件后端
        for i, temp_dir in enumerate(temp_dirs[:3]):
            file_config = FileStorageConfig(
                name=f'file_backend_{i}',
                storage_path=temp_dir
            )
            backends[f'file_{i}'] = await storage_manager.register_backend(
                'file', file_config
            )
        
        # SQLite后端
        sqlite_path = Path(temp_dirs[3]) / 'test.db'
        sqlite_config = SQLiteStorageConfig(
            name='sqlite_backend',
            database_path=str(sqlite_path)
        )
        backends['sqlite'] = await storage_manager.register_backend(
            'sqlite', sqlite_config
        )
        
        yield storage_manager, backends
        
        await storage_manager.shutdown()

    async def test_multi_backend_operations(self, storage_system):
        """测试多后端操作"""
        storage_manager, backends = storage_system
        
        # 在不同后端存储数据
        test_data = {}
        
        for backend_name, backend_id in backends.items():
            for i in range(5):
                key = StorageKey(
                    key=f'{backend_name}_key_{i}',
                    namespace=backend_name
                )
                value = StorageValue(data={
                    'backend': backend_name,
                    'index': i,
                    'timestamp': datetime.now().isoformat()
                })
                
                await storage_manager.set(key, value, backend_id=backend_id)
                test_data[f'{backend_name}_{i}'] = (key, value)
        
        # 验证数据在各自后端中存在
        for data_key, (key, original_value) in test_data.items():
            backend_name = data_key.split('_')[0]
            if backend_name.startswith('file'):
                backend_name = f"file_{data_key.split('_')[1]}"
            
            backend_id = backends[backend_name]
            retrieved_value = await storage_manager.get(key, backend_id=backend_id)
            
            assert retrieved_value is not None
            assert retrieved_value.data['backend'] == original_value.data['backend']
            assert retrieved_value.data['index'] == original_value.data['index']

    async def test_cross_backend_queries(self, storage_system):
        """测试跨后端查询"""
        storage_manager, backends = storage_system
        
        # 在多个后端存储相关数据
        user_data = [
            {'id': 1, 'name': 'Alice', 'department': 'Engineering'},
            {'id': 2, 'name': 'Bob', 'department': 'Marketing'},
            {'id': 3, 'name': 'Charlie', 'department': 'Engineering'},
            {'id': 4, 'name': 'Diana', 'department': 'Sales'}
        ]
        
        # 分布存储到不同后端
        backend_ids = list(backends.values())
        for i, user in enumerate(user_data):
            backend_id = backend_ids[i % len(backend_ids)]
            key = StorageKey(key=f"user_{user['id']}", namespace='users')
            value = StorageValue(data=user)
            await storage_manager.set(key, value, backend_id=backend_id)
        
        # 执行跨后端查询
        query = StorageQuery(
            namespace='users',
            filters={'data.department': 'Engineering'},
            cross_backend=True
        )
        
        result = await storage_manager.query(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.items) == 2  # Alice and Charlie
        
        # 验证结果
        names = [item.value.data['name'] for item in result.items]
        assert 'Alice' in names
        assert 'Charlie' in names

    async def test_transaction_across_backends(self, storage_system):
        """测试跨后端事务"""
        storage_manager, backends = storage_system
        
        # 开始分布式事务
        tx = await storage_manager.begin_transaction(distributed=True)
        
        try:
            # 在不同后端执行事务操作
            backend_ids = list(backends.values())[:3]  # 使用前3个后端
            
            for i, backend_id in enumerate(backend_ids):
                key = StorageKey(key=f'tx_key_{i}', namespace='transaction_test')
                value = StorageValue(data={
                    'backend_index': i,
                    'transaction_id': tx.id,
                    'timestamp': datetime.now().isoformat()
                })
                
                await storage_manager.set(key, value, backend_id=backend_id, transaction=tx)
            
            # 提交事务
            await storage_manager.commit_transaction(tx)
            
            # 验证所有数据都已提交
            for i, backend_id in enumerate(backend_ids):
                key = StorageKey(key=f'tx_key_{i}', namespace='transaction_test')
                retrieved_value = await storage_manager.get(key, backend_id=backend_id)
                
                assert retrieved_value is not None
                assert retrieved_value.data['transaction_id'] == tx.id
                
        except Exception:
            await storage_manager.rollback_transaction(tx)
            raise

    async def test_replication_integration(self, storage_system):
        """测试复制集成"""
        storage_manager, backends = storage_system
        
        # 配置复制
        replication_config = ReplicationConfig(
            name='test_replication',
            mode=ReplicationMode.MASTER_SLAVE,
            master_backend=backends['memory'],
            slave_backends=[backends['file_0'], backends['file_1']],
            sync_interval=1,
            enable_auto_failover=True
        )
        
        # 启用复制
        replication_manager = ReplicationManager(config=replication_config)
        await storage_manager.enable_replication(replication_manager)
        
        # 在主后端写入数据
        test_keys = []
        for i in range(10):
            key = StorageKey(key=f'replicated_key_{i}', namespace='replication')
            value = StorageValue(data={'index': i, 'replicated': True})
            
            await storage_manager.set(key, value, backend_id=backends['memory'])
            test_keys.append(key)
        
        # 等待复制完成
        await asyncio.sleep(2)
        
        # 验证数据已复制到从后端
        for key in test_keys:
            # 检查从后端1
            replicated_value1 = await storage_manager.get(
                key, backend_id=backends['file_0']
            )
            assert replicated_value1 is not None
            assert replicated_value1.data['replicated'] is True
            
            # 检查从后端2
            replicated_value2 = await storage_manager.get(
                key, backend_id=backends['file_1']
            )
            assert replicated_value2 is not None
            assert replicated_value2.data['replicated'] is True

    async def test_sharding_integration(self, storage_system):
        """测试分片集成"""
        storage_manager, backends = storage_system
        
        # 配置分片
        sharding_config = ShardingConfig(
            name='test_sharding',
            strategy='hash',
            shard_backends=[
                backends['file_0'],
                backends['file_1'],
                backends['file_2']
            ],
            hash_function='md5',
            enable_rebalancing=True
        )
        
        # 启用分片
        sharding_manager = ShardingManager(config=sharding_config)
        await storage_manager.enable_sharding(sharding_manager)
        
        # 写入大量数据（应该分布到不同分片）
        shard_data = {}
        for i in range(30):
            key = StorageKey(key=f'sharded_key_{i}', namespace='sharding')
            value = StorageValue(data={'index': i, 'sharded': True})
            
            # 让分片管理器决定存储位置
            await storage_manager.set(key, value, use_sharding=True)
            shard_data[key.key] = value
        
        # 验证数据分布在不同分片中
        shard_counts = {}
        for backend_name in ['file_0', 'file_1', 'file_2']:
            backend_id = backends[backend_name]
            count = 0
            
            for key_str in shard_data.keys():
                key = StorageKey(key=key_str, namespace='sharding')
                try:
                    value = await storage_manager.get(key, backend_id=backend_id)
                    if value is not None:
                        count += 1
                except:
                    pass
            
            shard_counts[backend_name] = count
        
        # 验证数据确实分布了（不是全部在一个分片中）
        total_items = sum(shard_counts.values())
        assert total_items == 30
        assert max(shard_counts.values()) < 30  # 没有全部在一个分片中

    async def test_load_balancing_integration(self, storage_system):
        """测试负载均衡集成"""
        storage_manager, backends = storage_system
        
        # 配置负载均衡
        lb_config = LoadBalancingConfig(
            name='test_load_balancer',
            strategy='round_robin',
            backend_pool=[
                backends['file_0'],
                backends['file_1'],
                backends['file_2']
            ],
            health_check_interval=5,
            enable_failover=True
        )
        
        # 启用负载均衡
        load_balancer = LoadBalancer(config=lb_config)
        await storage_manager.enable_load_balancing(load_balancer)
        
        # 执行大量读写操作
        keys = []
        for i in range(15):
            key = StorageKey(key=f'lb_key_{i}', namespace='load_balancing')
            value = StorageValue(data={'index': i, 'load_balanced': True})
            
            # 使用负载均衡写入
            await storage_manager.set(key, value, use_load_balancing=True)
            keys.append(key)
        
        # 验证数据分布在多个后端
        backend_usage = {}
        for backend_name in ['file_0', 'file_1', 'file_2']:
            backend_id = backends[backend_name]
            count = 0
            
            for key in keys:
                try:
                    value = await storage_manager.get(key, backend_id=backend_id)
                    if value is not None:
                        count += 1
                except:
                    pass
            
            backend_usage[backend_name] = count
        
        # 验证负载分布（轮询策略应该相对均匀）
        total_items = sum(backend_usage.values())
        assert total_items == 15
        
        # 每个后端应该有数据（轮询分布）
        for count in backend_usage.values():
            assert count > 0

    async def test_caching_integration(self, storage_system):
        """测试缓存集成"""
        storage_manager, backends = storage_system
        
        # 配置缓存
        cache_config = CacheConfig(
            name='test_cache',
            cache_type='memory',
            max_size_mb=10,
            ttl_seconds=60,
            eviction_policy='lru'
        )
        
        # 启用缓存
        cache_manager = CacheManager(config=cache_config)
        await storage_manager.enable_caching(cache_manager)
        
        # 写入数据
        key = StorageKey(key='cached_key', namespace='cache_test')
        value = StorageValue(data={'cached': True, 'timestamp': datetime.now().isoformat()})
        
        await storage_manager.set(key, value)
        
        # 多次读取（应该从缓存返回）
        read_times = []
        for _ in range(10):
            start_time = datetime.now()
            retrieved_value = await storage_manager.get(key)
            end_time = datetime.now()
            
            read_times.append((end_time - start_time).total_seconds())
            assert retrieved_value is not None
            assert retrieved_value.data['cached'] is True
        
        # 获取缓存统计
        cache_stats = storage_manager.get_cache_stats()
        assert cache_stats['hit_count'] > 0
        assert cache_stats['hit_ratio'] > 0.5  # 大部分请求应该命中缓存

    async def test_monitoring_integration(self, storage_system):
        """测试监控集成"""
        storage_manager, backends = storage_system
        
        # 配置监控
        monitoring_config = MonitoringConfig(
            name='test_monitoring',
            enable_metrics=True,
            enable_health_checks=True,
            enable_alerting=True,
            check_interval=1,
            alert_thresholds={
                'error_rate': 0.1,
                'response_time_ms': 1000,
                'storage_usage_percent': 90
            }
        )
        
        # 启用监控
        monitor = StorageMonitor(config=monitoring_config)
        await storage_manager.enable_monitoring(monitor)
        
        # 执行一些操作以生成监控数据
        for i in range(20):
            key = StorageKey(key=f'monitored_key_{i}', namespace='monitoring')
            value = StorageValue(data={'index': i, 'monitored': True})
            
            await storage_manager.set(key, value)
            retrieved_value = await storage_manager.get(key)
            assert retrieved_value is not None
        
        # 等待监控数据收集
        await asyncio.sleep(2)
        
        # 获取监控指标
        metrics = await monitor.get_metrics()
        assert metrics is not None
        assert 'operations_total' in metrics
        assert 'operation_duration_seconds' in metrics
        assert metrics['operations_total'] >= 40  # 20 sets + 20 gets
        
        # 获取健康状态
        health = await monitor.get_health_status()
        assert health is not None
        assert 'overall_status' in health
        assert 'backend_status' in health

    async def test_migration_integration(self, storage_system, temp_dirs):
        """测试迁移集成"""
        storage_manager, backends = storage_system
        
        # 在源后端添加数据
        source_backend_id = backends['memory']
        for i in range(20):
            key = StorageKey(key=f'migration_key_{i}', namespace='migration')
            value = StorageValue(data={
                'index': i,
                'data': f'migration_data_{i}',
                'created_at': datetime.now().isoformat()
            })
            await storage_manager.set(key, value, backend_id=source_backend_id)
        
        # 创建新的目标后端
        target_dir = temp_dirs[4]
        target_config = FileStorageConfig(
            name='migration_target',
            storage_path=target_dir
        )
        target_backend_id = await storage_manager.register_backend(
            'file', target_config
        )
        
        # 配置迁移
        migration_config = MigrationConfig(
            name='integration_migration',
            source_backend='memory',
            target_backend='file',
            batch_size=5,
            enable_validation=True,
            enable_backup=True
        )
        
        # 执行迁移
        migration_manager = MigrationManager(config=migration_config)
        
        # 获取后端实例
        source_backend = storage_manager.get_backend(source_backend_id)
        target_backend = storage_manager.get_backend(target_backend_id)
        
        migration_result = await migration_manager.migrate_data(
            source_backend=source_backend,
            target_backend=target_backend
        )
        
        assert migration_result.success is True
        assert migration_result.migrated_count == 20
        
        # 验证数据已迁移
        for i in range(20):
            key = StorageKey(key=f'migration_key_{i}', namespace='migration')
            migrated_value = await storage_manager.get(
                key, backend_id=target_backend_id
            )
            assert migrated_value is not None
            assert migrated_value.data['index'] == i

    async def test_disaster_recovery(self, storage_system):
        """测试灾难恢复"""
        storage_manager, backends = storage_system
        
        # 设置主从复制
        replication_config = ReplicationConfig(
            name='disaster_recovery',
            mode=ReplicationMode.MASTER_SLAVE,
            master_backend=backends['memory'],
            slave_backends=[backends['file_0']],
            sync_interval=0.5,
            enable_auto_failover=True
        )
        
        replication_manager = ReplicationManager(config=replication_config)
        await storage_manager.enable_replication(replication_manager)
        
        # 在主后端写入数据
        for i in range(10):
            key = StorageKey(key=f'dr_key_{i}', namespace='disaster_recovery')
            value = StorageValue(data={'index': i, 'critical_data': True})
            await storage_manager.set(key, value, backend_id=backends['memory'])
        
        # 等待复制完成
        await asyncio.sleep(1)
        
        # 模拟主后端故障
        await storage_manager.simulate_backend_failure(backends['memory'])
        
        # 触发故障转移
        failover_result = await replication_manager.handle_failover()
        assert failover_result.success is True
        
        # 验证可以从从后端读取数据
        for i in range(10):
            key = StorageKey(key=f'dr_key_{i}', namespace='disaster_recovery')
            # 应该自动从从后端读取
            recovered_value = await storage_manager.get(key)
            assert recovered_value is not None
            assert recovered_value.data['critical_data'] is True

    async def test_performance_under_load(self, storage_system):
        """测试负载下的性能"""
        storage_manager, backends = storage_system
        
        # 启用性能监控
        storage_manager.enable_performance_monitoring(True)
        
        # 并发写入测试
        async def write_batch(batch_id: int, batch_size: int):
            for i in range(batch_size):
                key = StorageKey(
                    key=f'perf_key_{batch_id}_{i}',
                    namespace='performance'
                )
                value = StorageValue(data={
                    'batch_id': batch_id,
                    'index': i,
                    'timestamp': datetime.now().isoformat()
                })
                await storage_manager.set(key, value)
        
        # 并发读取测试
        async def read_batch(batch_id: int, batch_size: int):
            for i in range(batch_size):
                key = StorageKey(
                    key=f'perf_key_{batch_id}_{i}',
                    namespace='performance'
                )
                value = await storage_manager.get(key)
                assert value is not None
        
        # 执行并发写入
        batch_size = 50
        num_batches = 10
        
        start_time = datetime.now()
        
        write_tasks = [
            write_batch(batch_id, batch_size)
            for batch_id in range(num_batches)
        ]
        await asyncio.gather(*write_tasks)
        
        write_end_time = datetime.now()
        
        # 执行并发读取
        read_tasks = [
            read_batch(batch_id, batch_size)
            for batch_id in range(num_batches)
        ]
        await asyncio.gather(*read_tasks)
        
        end_time = datetime.now()
        
        # 计算性能指标
        total_operations = num_batches * batch_size * 2  # writes + reads
        total_time = (end_time - start_time).total_seconds()
        throughput = total_operations / total_time
        
        # 获取性能统计
        perf_stats = storage_manager.get_performance_stats()
        
        assert perf_stats is not None
        assert perf_stats['operation_count'] >= total_operations
        assert throughput > 100  # 至少100 ops/sec
        
        print(f"Performance test: {throughput:.2f} operations/second")

    async def test_data_consistency_across_backends(self, storage_system):
        """测试跨后端数据一致性"""
        storage_manager, backends = storage_system
        
        # 启用强一致性
        await storage_manager.set_consistency_level(ConsistencyLevel.STRONG)
        
        # 在多个后端写入相同的键（应该保持一致性）
        key = StorageKey(key='consistency_key', namespace='consistency_test')
        
        # 并发写入不同的值
        async def write_to_backend(backend_id: str, value_suffix: str):
            value = StorageValue(data={
                'backend': backend_id,
                'value': f'data_{value_suffix}',
                'timestamp': datetime.now().isoformat()
            })
            await storage_manager.set(key, value, backend_id=backend_id)
        
        # 同时写入多个后端
        backend_ids = list(backends.values())[:3]
        write_tasks = [
            write_to_backend(backend_id, str(i))
            for i, backend_id in enumerate(backend_ids)
        ]
        
        await asyncio.gather(*write_tasks)
        
        # 验证最终一致性
        await asyncio.sleep(1)  # 等待一致性协调
        
        # 从所有后端读取，应该得到一致的结果
        values = []
        for backend_id in backend_ids:
            value = await storage_manager.get(key, backend_id=backend_id)
            if value is not None:
                values.append(value.data)
        
        # 在强一致性模式下，所有后端应该有相同的最终值
        if len(values) > 1:
            first_value = values[0]
            for value in values[1:]:
                # 可能不完全相同（因为时间戳），但关键字段应该一致
                assert value['backend'] == first_value['backend'] or \
                       value['value'] == first_value['value']

    async def test_system_recovery_after_shutdown(self, storage_system, temp_dirs):
        """测试系统关闭后的恢复"""
        storage_manager, backends = storage_system
        
        # 写入持久化数据
        persistent_data = {}
        for i in range(10):
            key = StorageKey(key=f'recovery_key_{i}', namespace='recovery')
            value = StorageValue(data={
                'index': i,
                'persistent': True,
                'created_at': datetime.now().isoformat()
            })
            
            # 写入到文件后端（持久化）
            await storage_manager.set(key, value, backend_id=backends['file_0'])
            persistent_data[key.key] = value.data
        
        # 关闭存储系统
        await storage_manager.shutdown()
        
        # 重新创建存储系统
        new_manager_config = StorageManagerConfig(
            name='recovery_storage_manager',
            enabled=True,
            default_backend='file'
        )
        
        new_storage_manager = StorageManager(config=new_manager_config)
        await new_storage_manager.initialize()
        
        # 重新注册文件后端
        file_config = FileStorageConfig(
            name='recovered_file_backend',
            storage_path=temp_dirs[0]  # 使用相同的存储路径
        )
        
        recovered_backend_id = await new_storage_manager.register_backend(
            'file', file_config, is_default=True
        )
        
        # 验证数据已恢复
        for key_str, original_data in persistent_data.items():
            key = StorageKey(key=key_str, namespace='recovery')
            recovered_value = await new_storage_manager.get(key)
            
            assert recovered_value is not None
            assert recovered_value.data['index'] == original_data['index']
            assert recovered_value.data['persistent'] is True
        
        await new_storage_manager.shutdown()

    async def test_multi_tenant_isolation(self, storage_system):
        """测试多租户隔离"""
        storage_manager, backends = storage_system
        
        # 创建多个租户的数据
        tenants = ['tenant_a', 'tenant_b', 'tenant_c']
        tenant_data = {}
        
        for tenant in tenants:
            tenant_data[tenant] = {}
            for i in range(5):
                key = StorageKey(
                    key=f'data_{i}',
                    namespace=tenant  # 使用租户名作为命名空间
                )
                value = StorageValue(data={
                    'tenant': tenant,
                    'index': i,
                    'sensitive_data': f'{tenant}_secret_{i}'
                })
                
                await storage_manager.set(key, value)
                tenant_data[tenant][key.key] = value.data
        
        # 验证租户隔离
        for tenant in tenants:
            # 查询特定租户的数据
            query = StorageQuery(
                namespace=tenant,
                filters={},
                limit=10
            )
            
            result = await storage_manager.query(query)
            
            # 验证只返回该租户的数据
            assert len(result.items) == 5
            for item in result.items:
                assert item.value.data['tenant'] == tenant
                assert tenant in item.value.data['sensitive_data']
        
        # 验证跨租户查询不会泄露数据
        cross_tenant_query = StorageQuery(
            namespace='tenant_a',
            filters={'data.tenant': 'tenant_b'},  # 尝试查询其他租户数据
            limit=10
        )
        
        cross_result = await storage_manager.query(cross_tenant_query)
        assert len(cross_result.items) == 0  # 不应该返回其他租户的数据

    async def test_storage_quotas_and_limits(self, storage_system):
        """测试存储配额和限制"""
        storage_manager, backends = storage_system
        
        # 设置命名空间配额
        quota_namespace = 'quota_test'
        await storage_manager.set_namespace_quota(
            namespace=quota_namespace,
            max_size_mb=1,  # 1MB限制
            max_items=50    # 50个项目限制
        )
        
        # 尝试写入数据直到达到配额
        large_data = 'x' * 1000  # 1KB数据
        written_count = 0
        quota_exceeded = False
        
        try:
            for i in range(100):  # 尝试写入100个1KB项目
                key = StorageKey(key=f'quota_key_{i}', namespace=quota_namespace)
                value = StorageValue(data={'index': i, 'large_data': large_data})
                
                await storage_manager.set(key, value)
                written_count += 1
        except Exception as e:
            quota_exceeded = True
        
        # 验证配额限制生效
        assert quota_exceeded or written_count <= 50
        
        # 获取配额使用情况
        quota_usage = await storage_manager.get_quota_usage(quota_namespace)
        assert quota_usage is not None
        assert quota_usage['used_items'] <= 50
        assert quota_usage['used_size_mb'] <= 1.0

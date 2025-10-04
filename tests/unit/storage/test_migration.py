# -*- coding: utf-8 -*-
"""
存储迁移测试

测试数据迁移和版本升级功能
"""

import pytest
import asyncio
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.storage.migration import (
    MigrationManager, MigrationConfig, MigrationPlan, MigrationStep,
    DataMigrator, SchemaMigrator, VersionMigrator, BackupManager
)
from zishu.storage.migration.strategies import (
    CopyMigrationStrategy, IncrementalMigrationStrategy,
    StreamingMigrationStrategy, ParallelMigrationStrategy
)
from zishu.storage.migration.validators import (
    DataValidator, SchemaValidator, IntegrityValidator
)
from zishu.storage.backends.base import BaseStorageBackend, StorageConfig
from zishu.storage.backends.memory import MemoryStorageBackend, MemoryStorageConfig
from zishu.storage.backends.file import FileStorageBackend, FileStorageConfig
from zishu.storage.backends.sqlite import SQLiteStorageBackend, SQLiteStorageConfig
from zishu.storage.core.types import (
    StorageKey, StorageValue, StorageSchema, StorageIndex,
    MigrationType, MigrationStatus, ValidationResult
)
from zishu.storage.core.exceptions import (
    StorageException, MigrationException, ValidationException,
    BackupException, RestoreException, VersionException
)

from tests.utils.storage_test_utils import StorageTestUtils


class TestMigrationConfig:
    """迁移配置测试类"""

    def test_config_initialization(self):
        """测试配置初始化"""
        config = MigrationConfig(
            name='test_migration',
            source_backend='memory',
            target_backend='file',
            migration_type=MigrationType.FULL,
            batch_size=1000,
            parallel_workers=4,
            enable_validation=True,
            enable_backup=True,
            rollback_on_failure=True,
            timeout_seconds=3600
        )
        
        assert config.name == 'test_migration'
        assert config.source_backend == 'memory'
        assert config.target_backend == 'file'
        assert config.migration_type == MigrationType.FULL
        assert config.batch_size == 1000
        assert config.parallel_workers == 4
        assert config.enable_validation is True

    def test_config_validation(self):
        """测试配置验证"""
        # 有效配置
        valid_config = MigrationConfig(
            name='valid_migration',
            source_backend='memory',
            target_backend='file'
        )
        
        assert valid_config.validate() is True
        
        # 无效配置 - 相同的源和目标
        invalid_config = MigrationConfig(
            name='invalid_migration',
            source_backend='memory',
            target_backend='memory'
        )
        
        assert invalid_config.validate() is False

    def test_config_serialization(self):
        """测试配置序列化"""
        config = MigrationConfig(
            name='serialization_test',
            source_backend='memory',
            target_backend='file',
            batch_size=500
        )
        
        # 序列化
        config_dict = config.to_dict()
        assert isinstance(config_dict, dict)
        assert config_dict['name'] == 'serialization_test'
        assert config_dict['batch_size'] == 500
        
        # 反序列化
        restored_config = MigrationConfig.from_dict(config_dict)
        assert restored_config.name == config.name
        assert restored_config.batch_size == config.batch_size


class TestMigrationPlan:
    """迁移计划测试类"""

    def test_plan_creation(self):
        """测试计划创建"""
        plan = MigrationPlan(
            name='test_plan',
            description='Test migration plan',
            version='1.0'
        )
        
        assert plan.name == 'test_plan'
        assert plan.description == 'Test migration plan'
        assert plan.version == '1.0'
        assert len(plan.steps) == 0

    def test_add_migration_step(self):
        """测试添加迁移步骤"""
        plan = MigrationPlan(name='step_test')
        
        step1 = MigrationStep(
            name='backup_data',
            description='Create backup',
            order=1,
            required=True
        )
        
        step2 = MigrationStep(
            name='migrate_data',
            description='Migrate data',
            order=2,
            required=True,
            depends_on=['backup_data']
        )
        
        plan.add_step(step1)
        plan.add_step(step2)
        
        assert len(plan.steps) == 2
        assert plan.steps[0].name == 'backup_data'
        assert plan.steps[1].name == 'migrate_data'
        assert 'backup_data' in plan.steps[1].depends_on

    def test_plan_validation(self):
        """测试计划验证"""
        plan = MigrationPlan(name='validation_test')
        
        # 添加有效步骤
        step1 = MigrationStep(name='step1', order=1)
        step2 = MigrationStep(name='step2', order=2, depends_on=['step1'])
        
        plan.add_step(step1)
        plan.add_step(step2)
        
        # 验证计划
        validation_result = plan.validate()
        assert validation_result.is_valid is True
        
        # 添加循环依赖
        step3 = MigrationStep(name='step3', order=3, depends_on=['step2'])
        step1.depends_on = ['step3']  # 创建循环依赖
        
        plan.add_step(step3)
        
        validation_result = plan.validate()
        assert validation_result.is_valid is False

    def test_execution_order(self):
        """测试执行顺序"""
        plan = MigrationPlan(name='order_test')
        
        # 添加无序步骤
        step3 = MigrationStep(name='step3', order=3)
        step1 = MigrationStep(name='step1', order=1)
        step2 = MigrationStep(name='step2', order=2, depends_on=['step1'])
        
        plan.add_step(step3)
        plan.add_step(step1)
        plan.add_step(step2)
        
        # 获取执行顺序
        execution_order = plan.get_execution_order()
        
        assert len(execution_order) == 3
        assert execution_order[0].name == 'step1'
        assert execution_order[1].name == 'step2'
        assert execution_order[2].name == 'step3'


class TestDataMigrator:
    """数据迁移器测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def source_backend(self):
        """创建源存储后端"""
        config = MemoryStorageConfig(name='source_memory')
        backend = MemoryStorageBackend(config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    @pytest.fixture
    async def target_backend(self, temp_dir):
        """创建目标存储后端"""
        config = FileStorageConfig(name='target_file', storage_path=temp_dir)
        backend = FileStorageBackend(config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_basic_data_migration(self, source_backend, target_backend):
        """测试基本数据迁移"""
        # 在源后端添加测试数据
        test_data = []
        for i in range(10):
            key = StorageKey(key=f'test_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'message': f'test_{i}'})
            await source_backend.set(key, value)
            test_data.append((key, value))
        
        # 创建数据迁移器
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            batch_size=5
        )
        
        # 执行迁移
        result = await migrator.migrate()
        
        assert result.success is True
        assert result.migrated_count == 10
        assert result.failed_count == 0
        
        # 验证数据已迁移
        for key, original_value in test_data:
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None
            assert migrated_value.data == original_value.data

    async def test_incremental_migration(self, source_backend, target_backend):
        """测试增量迁移"""
        # 添加初始数据
        for i in range(5):
            key = StorageKey(key=f'initial_key_{i}', namespace='test')
            value = StorageValue(data={'type': 'initial', 'index': i})
            await source_backend.set(key, value)
            await target_backend.set(key, value)  # 目标也有相同数据
        
        # 添加新数据到源
        for i in range(5, 10):
            key = StorageKey(key=f'new_key_{i}', namespace='test')
            value = StorageValue(data={'type': 'new', 'index': i})
            await source_backend.set(key, value)
        
        # 创建增量迁移器
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            migration_type=MigrationType.INCREMENTAL
        )
        
        # 执行增量迁移
        result = await migrator.migrate()
        
        assert result.success is True
        assert result.migrated_count == 5  # 只迁移新数据
        
        # 验证新数据已迁移
        for i in range(5, 10):
            key = StorageKey(key=f'new_key_{i}', namespace='test')
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None
            assert migrated_value.data['type'] == 'new'

    async def test_filtered_migration(self, source_backend, target_backend):
        """测试过滤迁移"""
        # 添加混合数据
        for i in range(20):
            key = StorageKey(key=f'item_{i}', namespace='test')
            value = StorageValue(data={
                'index': i,
                'category': 'even' if i % 2 == 0 else 'odd',
                'active': i < 10
            })
            await source_backend.set(key, value)
        
        # 创建带过滤器的迁移器
        def filter_func(key: StorageKey, value: StorageValue) -> bool:
            return value.data['category'] == 'even' and value.data['active']
        
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            filter_function=filter_func
        )
        
        # 执行过滤迁移
        result = await migrator.migrate()
        
        assert result.success is True
        assert result.migrated_count == 5  # 0,2,4,6,8 (偶数且active)
        
        # 验证只有符合条件的数据被迁移
        for i in range(0, 10, 2):  # 偶数且小于10
            key = StorageKey(key=f'item_{i}', namespace='test')
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None
            assert migrated_value.data['category'] == 'even'

    async def test_transformation_migration(self, source_backend, target_backend):
        """测试转换迁移"""
        # 添加需要转换的数据
        for i in range(5):
            key = StorageKey(key=f'user_{i}', namespace='users')
            value = StorageValue(data={
                'id': i,
                'full_name': f'User {i}',
                'email_address': f'user{i}@example.com'
            })
            await source_backend.set(key, value)
        
        # 定义转换函数
        def transform_func(key: StorageKey, value: StorageValue) -> tuple:
            # 重命名字段
            new_data = {
                'user_id': value.data['id'],
                'name': value.data['full_name'],
                'email': value.data['email_address'],
                'migrated_at': datetime.now().isoformat()
            }
            new_value = StorageValue(data=new_data)
            return key, new_value
        
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            transform_function=transform_func
        )
        
        # 执行转换迁移
        result = await migrator.migrate()
        
        assert result.success is True
        assert result.migrated_count == 5
        
        # 验证数据已转换
        for i in range(5):
            key = StorageKey(key=f'user_{i}', namespace='users')
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None
            assert 'user_id' in migrated_value.data
            assert 'name' in migrated_value.data
            assert 'migrated_at' in migrated_value.data

    async def test_parallel_migration(self, source_backend, target_backend):
        """测试并行迁移"""
        # 添加大量数据
        for i in range(100):
            key = StorageKey(key=f'parallel_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await source_backend.set(key, value)
        
        # 创建并行迁移器
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            batch_size=10,
            parallel_workers=4
        )
        
        # 执行并行迁移
        start_time = datetime.now()
        result = await migrator.migrate()
        end_time = datetime.now()
        
        assert result.success is True
        assert result.migrated_count == 100
        
        # 验证所有数据已迁移
        for i in range(100):
            key = StorageKey(key=f'parallel_key_{i}', namespace='test')
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None

    async def test_migration_progress_tracking(self, source_backend, target_backend):
        """测试迁移进度跟踪"""
        # 添加测试数据
        for i in range(50):
            key = StorageKey(key=f'progress_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await source_backend.set(key, value)
        
        # 创建带进度回调的迁移器
        progress_updates = []
        
        def progress_callback(current: int, total: int, percentage: float):
            progress_updates.append({
                'current': current,
                'total': total,
                'percentage': percentage
            })
        
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            batch_size=10,
            progress_callback=progress_callback
        )
        
        # 执行迁移
        result = await migrator.migrate()
        
        assert result.success is True
        assert len(progress_updates) > 0
        
        # 验证进度更新
        final_progress = progress_updates[-1]
        assert final_progress['current'] == 50
        assert final_progress['total'] == 50
        assert final_progress['percentage'] == 100.0

    async def test_migration_error_handling(self, source_backend, target_backend):
        """测试迁移错误处理"""
        # 添加测试数据
        for i in range(10):
            key = StorageKey(key=f'error_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await source_backend.set(key, value)
        
        # 模拟目标后端错误
        original_set = target_backend.set
        call_count = 0
        
        async def failing_set(key, value):
            nonlocal call_count
            call_count += 1
            if call_count % 3 == 0:  # 每第3次调用失败
                raise Exception("Simulated write error")
            return await original_set(key, value)
        
        target_backend.set = failing_set
        
        # 创建迁移器
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            continue_on_error=True
        )
        
        # 执行迁移
        result = await migrator.migrate()
        
        assert result.success is False  # 有错误发生
        assert result.migrated_count < 10  # 部分数据迁移成功
        assert result.failed_count > 0  # 有失败的记录
        assert len(result.errors) > 0  # 有错误信息

    async def test_migration_rollback(self, source_backend, target_backend):
        """测试迁移回滚"""
        # 添加测试数据
        for i in range(5):
            key = StorageKey(key=f'rollback_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await source_backend.set(key, value)
        
        # 创建支持回滚的迁移器
        migrator = DataMigrator(
            source=source_backend,
            target=target_backend,
            enable_rollback=True
        )
        
        # 执行迁移
        result = await migrator.migrate()
        assert result.success is True
        
        # 验证数据已迁移
        key = StorageKey(key='rollback_key_0', namespace='test')
        migrated_value = await target_backend.get(key)
        assert migrated_value is not None
        
        # 执行回滚
        rollback_result = await migrator.rollback()
        assert rollback_result.success is True
        
        # 验证数据已回滚（从目标删除）
        migrated_value = await target_backend.get(key)
        assert migrated_value is None


class TestSchemaMigrator:
    """模式迁移器测试类"""

    @pytest.fixture
    async def backend(self):
        """创建存储后端"""
        config = MemoryStorageConfig(name='schema_memory')
        backend = MemoryStorageBackend(config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_schema_version_upgrade(self, backend):
        """测试模式版本升级"""
        # 创建初始模式
        schema_v1 = StorageSchema(
            name='user_schema',
            version='1.0',
            fields={
                'id': {'type': 'string', 'required': True},
                'name': {'type': 'string', 'required': True}
            }
        )
        
        # 注册初始模式
        await backend.register_schema(schema_v1)
        
        # 添加使用v1模式的数据
        for i in range(5):
            key = StorageKey(key=f'user_{i}', namespace='users')
            value = StorageValue(
                data={'id': f'user_{i}', 'name': f'User {i}'},
                schema='user_schema'
            )
            await backend.set(key, value)
        
        # 创建升级后的模式
        schema_v2 = StorageSchema(
            name='user_schema',
            version='2.0',
            fields={
                'id': {'type': 'string', 'required': True},
                'name': {'type': 'string', 'required': True},
                'email': {'type': 'string', 'required': False, 'default': ''},
                'created_at': {'type': 'datetime', 'required': False}
            }
        )
        
        # 定义升级函数
        def upgrade_function(data: dict) -> dict:
            # 添加新字段
            data['email'] = f"{data['id']}@example.com"
            data['created_at'] = datetime.now().isoformat()
            return data
        
        # 创建模式迁移器
        migrator = SchemaMigrator(backend=backend)
        
        # 执行模式升级
        result = await migrator.upgrade_schema(
            schema_name='user_schema',
            new_schema=schema_v2,
            upgrade_function=upgrade_function
        )
        
        assert result.success is True
        assert result.upgraded_count == 5
        
        # 验证数据已升级
        for i in range(5):
            key = StorageKey(key=f'user_{i}', namespace='users')
            upgraded_value = await backend.get(key)
            assert upgraded_value is not None
            assert 'email' in upgraded_value.data
            assert 'created_at' in upgraded_value.data

    async def test_schema_field_migration(self, backend):
        """测试模式字段迁移"""
        # 创建原始模式
        old_schema = StorageSchema(
            name='product_schema',
            version='1.0',
            fields={
                'product_id': {'type': 'string', 'required': True},
                'product_name': {'type': 'string', 'required': True},
                'price_cents': {'type': 'integer', 'required': True}
            }
        )
        
        await backend.register_schema(old_schema)
        
        # 添加数据
        for i in range(3):
            key = StorageKey(key=f'product_{i}', namespace='products')
            value = StorageValue(
                data={
                    'product_id': f'prod_{i}',
                    'product_name': f'Product {i}',
                    'price_cents': (i + 1) * 100
                },
                schema='product_schema'
            )
            await backend.set(key, value)
        
        # 创建新模式（字段重命名和类型变更）
        new_schema = StorageSchema(
            name='product_schema',
            version='2.0',
            fields={
                'id': {'type': 'string', 'required': True},  # 重命名
                'name': {'type': 'string', 'required': True},  # 重命名
                'price': {'type': 'float', 'required': True},  # 类型变更
                'currency': {'type': 'string', 'required': False, 'default': 'USD'}
            }
        )
        
        # 定义字段映射
        field_mapping = {
            'product_id': 'id',
            'product_name': 'name',
            'price_cents': lambda x: x / 100.0  # 转换为浮点数
        }
        
        def field_migration_function(data: dict) -> dict:
            new_data = {}
            for old_field, new_field_or_func in field_mapping.items():
                if old_field in data:
                    if callable(new_field_or_func):
                        new_data['price'] = new_field_or_func(data[old_field])
                    else:
                        new_data[new_field_or_func] = data[old_field]
            new_data['currency'] = 'USD'
            return new_data
        
        # 执行字段迁移
        migrator = SchemaMigrator(backend=backend)
        result = await migrator.migrate_fields(
            schema_name='product_schema',
            new_schema=new_schema,
            field_migration_function=field_migration_function
        )
        
        assert result.success is True
        
        # 验证字段已迁移
        key = StorageKey(key='product_0', namespace='products')
        migrated_value = await backend.get(key)
        assert migrated_value is not None
        assert 'id' in migrated_value.data
        assert 'name' in migrated_value.data
        assert 'price' in migrated_value.data
        assert migrated_value.data['price'] == 1.0  # 100 cents -> 1.0


class TestVersionMigrator:
    """版本迁移器测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    async def test_storage_version_upgrade(self, temp_dir):
        """测试存储版本升级"""
        # 创建旧版本存储
        old_config = FileStorageConfig(
            name='old_storage',
            storage_path=temp_dir,
            version='1.0'
        )
        old_backend = FileStorageBackend(old_config)
        await old_backend.connect()
        
        # 添加旧版本数据
        for i in range(5):
            key = StorageKey(key=f'version_key_{i}', namespace='test')
            value = StorageValue(data={'version': '1.0', 'index': i})
            await old_backend.set(key, value)
        
        await old_backend.disconnect()
        
        # 创建版本迁移器
        migrator = VersionMigrator()
        
        # 定义版本升级规则
        upgrade_rules = {
            '1.0': {
                'target_version': '2.0',
                'data_transform': lambda data: {**data, 'version': '2.0', 'upgraded': True},
                'schema_changes': ['add_upgraded_field']
            }
        }
        
        # 执行版本升级
        result = await migrator.upgrade_version(
            storage_path=temp_dir,
            current_version='1.0',
            target_version='2.0',
            upgrade_rules=upgrade_rules
        )
        
        assert result.success is True
        
        # 验证升级后的数据
        new_config = FileStorageConfig(
            name='new_storage',
            storage_path=temp_dir,
            version='2.0'
        )
        new_backend = FileStorageBackend(new_config)
        await new_backend.connect()
        
        for i in range(5):
            key = StorageKey(key=f'version_key_{i}', namespace='test')
            upgraded_value = await new_backend.get(key)
            assert upgraded_value is not None
            assert upgraded_value.data['version'] == '2.0'
            assert upgraded_value.data['upgraded'] is True
        
        await new_backend.disconnect()

    async def test_multi_step_version_upgrade(self, temp_dir):
        """测试多步骤版本升级"""
        # 创建版本迁移器
        migrator = VersionMigrator()
        
        # 定义多步骤升级路径
        upgrade_path = [
            {
                'from_version': '1.0',
                'to_version': '1.1',
                'transform': lambda data: {**data, 'patch_1_1': True}
            },
            {
                'from_version': '1.1',
                'to_version': '2.0',
                'transform': lambda data: {**data, 'major_2_0': True}
            },
            {
                'from_version': '2.0',
                'to_version': '2.1',
                'transform': lambda data: {**data, 'patch_2_1': True}
            }
        ]
        
        # 创建初始数据
        initial_data = {'version': '1.0', 'data': 'test'}
        
        # 执行多步骤升级
        result = await migrator.upgrade_through_path(
            data=initial_data,
            upgrade_path=upgrade_path,
            target_version='2.1'
        )
        
        assert result.success is True
        final_data = result.data
        
        # 验证所有升级步骤都已应用
        assert final_data['patch_1_1'] is True
        assert final_data['major_2_0'] is True
        assert final_data['patch_2_1'] is True


class TestBackupManager:
    """备份管理器测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def backend(self, temp_dir):
        """创建存储后端"""
        config = FileStorageConfig(name='backup_test', storage_path=temp_dir)
        backend = FileStorageBackend(config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_create_backup(self, backend, temp_dir):
        """测试创建备份"""
        # 添加测试数据
        for i in range(10):
            key = StorageKey(key=f'backup_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'message': f'backup_{i}'})
            await backend.set(key, value)
        
        # 创建备份管理器
        backup_manager = BackupManager(backend=backend)
        
        # 创建备份
        backup_path = await backup_manager.create_backup(
            backup_name='test_backup',
            backup_dir=temp_dir
        )
        
        assert backup_path is not None
        assert Path(backup_path).exists()
        
        # 验证备份文件内容
        backup_info = await backup_manager.get_backup_info(backup_path)
        assert backup_info is not None
        assert backup_info['item_count'] == 10
        assert 'created_at' in backup_info

    async def test_restore_from_backup(self, backend, temp_dir):
        """测试从备份恢复"""
        # 创建备份管理器
        backup_manager = BackupManager(backend=backend)
        
        # 添加初始数据并创建备份
        for i in range(5):
            key = StorageKey(key=f'restore_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await backend.set(key, value)
        
        backup_path = await backup_manager.create_backup(
            backup_name='restore_test',
            backup_dir=temp_dir
        )
        
        # 清空数据
        await backend.clear()
        
        # 验证数据已清空
        key = StorageKey(key='restore_key_0', namespace='test')
        value = await backend.get(key)
        assert value is None
        
        # 从备份恢复
        result = await backup_manager.restore_from_backup(backup_path)
        assert result.success is True
        
        # 验证数据已恢复
        for i in range(5):
            key = StorageKey(key=f'restore_key_{i}', namespace='test')
            restored_value = await backend.get(key)
            assert restored_value is not None
            assert restored_value.data['index'] == i

    async def test_incremental_backup(self, backend, temp_dir):
        """测试增量备份"""
        backup_manager = BackupManager(backend=backend)
        
        # 创建初始数据和完整备份
        for i in range(5):
            key = StorageKey(key=f'inc_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'type': 'initial'})
            await backend.set(key, value)
        
        full_backup_path = await backup_manager.create_backup(
            backup_name='full_backup',
            backup_dir=temp_dir,
            backup_type='full'
        )
        
        # 添加新数据
        for i in range(5, 10):
            key = StorageKey(key=f'inc_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'type': 'incremental'})
            await backend.set(key, value)
        
        # 创建增量备份
        inc_backup_path = await backup_manager.create_backup(
            backup_name='incremental_backup',
            backup_dir=temp_dir,
            backup_type='incremental',
            base_backup=full_backup_path
        )
        
        # 验证增量备份只包含新数据
        inc_backup_info = await backup_manager.get_backup_info(inc_backup_path)
        assert inc_backup_info['item_count'] == 5  # 只有新增的5个项目

    async def test_backup_compression(self, backend, temp_dir):
        """测试备份压缩"""
        # 添加大量数据
        large_data = 'x' * 1000  # 1KB数据
        for i in range(100):
            key = StorageKey(key=f'compress_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'large_data': large_data})
            await backend.set(key, value)
        
        backup_manager = BackupManager(backend=backend)
        
        # 创建压缩备份
        compressed_backup = await backup_manager.create_backup(
            backup_name='compressed_backup',
            backup_dir=temp_dir,
            compress=True
        )
        
        # 创建未压缩备份
        uncompressed_backup = await backup_manager.create_backup(
            backup_name='uncompressed_backup',
            backup_dir=temp_dir,
            compress=False
        )
        
        # 验证压缩备份更小
        compressed_size = Path(compressed_backup).stat().st_size
        uncompressed_size = Path(uncompressed_backup).stat().st_size
        
        assert compressed_size < uncompressed_size

    async def test_backup_encryption(self, backend, temp_dir):
        """测试备份加密"""
        # 添加敏感数据
        for i in range(5):
            key = StorageKey(key=f'secret_key_{i}', namespace='secrets')
            value = StorageValue(data={'secret': f'password_{i}', 'index': i})
            await backend.set(key, value)
        
        backup_manager = BackupManager(backend=backend)
        
        # 创建加密备份
        encryption_key = 'test_encryption_key_32_characters'
        encrypted_backup = await backup_manager.create_backup(
            backup_name='encrypted_backup',
            backup_dir=temp_dir,
            encrypt=True,
            encryption_key=encryption_key
        )
        
        # 验证备份文件已加密（不能直接读取）
        with open(encrypted_backup, 'rb') as f:
            content = f.read()
            # 加密内容不应包含明文密码
            assert b'password_0' not in content
        
        # 清空数据
        await backend.clear()
        
        # 使用正确密钥恢复
        result = await backup_manager.restore_from_backup(
            encrypted_backup,
            encryption_key=encryption_key
        )
        assert result.success is True
        
        # 验证数据已恢复
        key = StorageKey(key='secret_key_0', namespace='secrets')
        restored_value = await backend.get(key)
        assert restored_value is not None
        assert restored_value.data['secret'] == 'password_0'


class TestMigrationManager:
    """迁移管理器测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def migration_config(self):
        """创建迁移配置"""
        return MigrationConfig(
            name='test_migration',
            source_backend='memory',
            target_backend='file',
            enable_backup=True,
            enable_validation=True
        )

    async def test_migration_manager_initialization(self, migration_config):
        """测试迁移管理器初始化"""
        manager = MigrationManager(config=migration_config)
        
        assert manager.config == migration_config
        assert not manager.is_running

    async def test_execute_migration_plan(self, migration_config, temp_dir):
        """测试执行迁移计划"""
        # 创建源和目标后端
        source_config = MemoryStorageConfig(name='source')
        source_backend = MemoryStorageBackend(source_config)
        await source_backend.connect()
        
        target_config = FileStorageConfig(name='target', storage_path=temp_dir)
        target_backend = FileStorageBackend(target_config)
        await target_backend.connect()
        
        # 添加测试数据
        for i in range(10):
            key = StorageKey(key=f'plan_key_{i}', namespace='test')
            value = StorageValue(data={'index': i})
            await source_backend.set(key, value)
        
        # 创建迁移计划
        plan = MigrationPlan(name='test_plan')
        
        backup_step = MigrationStep(
            name='create_backup',
            description='Create backup before migration',
            order=1
        )
        
        migrate_step = MigrationStep(
            name='migrate_data',
            description='Migrate data from source to target',
            order=2,
            depends_on=['create_backup']
        )
        
        validate_step = MigrationStep(
            name='validate_migration',
            description='Validate migrated data',
            order=3,
            depends_on=['migrate_data']
        )
        
        plan.add_step(backup_step)
        plan.add_step(migrate_step)
        plan.add_step(validate_step)
        
        # 创建迁移管理器
        manager = MigrationManager(config=migration_config)
        
        # 执行迁移计划
        result = await manager.execute_plan(
            plan=plan,
            source_backend=source_backend,
            target_backend=target_backend
        )
        
        assert result.success is True
        assert len(result.completed_steps) == 3
        
        # 验证数据已迁移
        for i in range(10):
            key = StorageKey(key=f'plan_key_{i}', namespace='test')
            migrated_value = await target_backend.get(key)
            assert migrated_value is not None
        
        await source_backend.disconnect()
        await target_backend.disconnect()

    async def test_migration_monitoring(self, migration_config, temp_dir):
        """测试迁移监控"""
        # 创建迁移管理器
        manager = MigrationManager(config=migration_config)
        
        # 监控回调
        monitoring_events = []
        
        def monitor_callback(event_type: str, data: dict):
            monitoring_events.append({
                'type': event_type,
                'data': data,
                'timestamp': datetime.now()
            })
        
        manager.set_monitor_callback(monitor_callback)
        
        # 创建简单的迁移计划
        plan = MigrationPlan(name='monitored_migration')
        step = MigrationStep(name='test_step', order=1)
        plan.add_step(step)
        
        # 执行迁移
        source_backend = MemoryStorageBackend(MemoryStorageConfig(name='source'))
        target_backend = FileStorageBackend(FileStorageConfig(name='target', storage_path=temp_dir))
        
        await source_backend.connect()
        await target_backend.connect()
        
        result = await manager.execute_plan(
            plan=plan,
            source_backend=source_backend,
            target_backend=target_backend
        )
        
        # 验证监控事件
        assert len(monitoring_events) > 0
        
        event_types = [event['type'] for event in monitoring_events]
        assert 'migration_started' in event_types
        assert 'migration_completed' in event_types
        
        await source_backend.disconnect()
        await target_backend.disconnect()

    async def test_migration_rollback_on_failure(self, migration_config, temp_dir):
        """测试迁移失败时的回滚"""
        # 创建会失败的迁移计划
        plan = MigrationPlan(name='failing_migration')
        
        success_step = MigrationStep(name='success_step', order=1)
        failing_step = MigrationStep(name='failing_step', order=2)
        
        plan.add_step(success_step)
        plan.add_step(failing_step)
        
        # 模拟步骤执行器
        async def step_executor(step_name: str, context: dict):
            if step_name == 'failing_step':
                raise Exception("Simulated step failure")
            return {'success': True}
        
        # 创建支持回滚的迁移管理器
        rollback_config = MigrationConfig(
            name='rollback_migration',
            source_backend='memory',
            target_backend='file',
            rollback_on_failure=True
        )
        
        manager = MigrationManager(config=rollback_config)
        manager.set_step_executor(step_executor)
        
        # 执行迁移（应该失败并回滚）
        source_backend = MemoryStorageBackend(MemoryStorageConfig(name='source'))
        target_backend = FileStorageBackend(FileStorageConfig(name='target', storage_path=temp_dir))
        
        await source_backend.connect()
        await target_backend.connect()
        
        result = await manager.execute_plan(
            plan=plan,
            source_backend=source_backend,
            target_backend=target_backend
        )
        
        assert result.success is False
        assert result.rolled_back is True
        assert len(result.errors) > 0
        
        await source_backend.disconnect()
        await target_backend.disconnect()


class TestMigrationValidation:
    """迁移验证测试类"""

    @pytest.fixture
    async def backends(self):
        """创建源和目标后端"""
        source_config = MemoryStorageConfig(name='validation_source')
        source = MemoryStorageBackend(source_config)
        await source.connect()
        
        target_config = MemoryStorageConfig(name='validation_target')
        target = MemoryStorageBackend(target_config)
        await target.connect()
        
        yield source, target
        
        await source.disconnect()
        await target.disconnect()

    async def test_data_integrity_validation(self, backends):
        """测试数据完整性验证"""
        source, target = backends
        
        # 在源和目标添加相同数据
        test_data = []
        for i in range(10):
            key = StorageKey(key=f'integrity_key_{i}', namespace='test')
            value = StorageValue(data={'index': i, 'checksum': f'hash_{i}'})
            await source.set(key, value)
            await target.set(key, value)
            test_data.append((key, value))
        
        # 创建完整性验证器
        validator = IntegrityValidator()
        
        # 执行验证
        result = await validator.validate_integrity(
            source_backend=source,
            target_backend=target
        )
        
        assert result.is_valid is True
        assert result.total_items == 10
        assert result.valid_items == 10
        assert len(result.errors) == 0

    async def test_data_corruption_detection(self, backends):
        """测试数据损坏检测"""
        source, target = backends
        
        # 在源和目标添加数据，但目标有损坏
        for i in range(5):
            key = StorageKey(key=f'corrupt_key_{i}', namespace='test')
            source_value = StorageValue(data={'index': i, 'data': f'original_{i}'})
            target_value = StorageValue(data={'index': i, 'data': f'corrupted_{i}'})  # 损坏的数据
            
            await source.set(key, source_value)
            await target.set(key, target_value)
        
        # 创建数据验证器
        validator = DataValidator()
        
        # 执行验证
        result = await validator.validate_data_consistency(
            source_backend=source,
            target_backend=target
        )
        
        assert result.is_valid is False
        assert result.total_items == 5
        assert result.valid_items == 0  # 所有数据都不一致
        assert len(result.errors) == 5

    async def test_schema_validation(self, backends):
        """测试模式验证"""
        source, target = backends
        
        # 定义模式
        schema = StorageSchema(
            name='validation_schema',
            version='1.0',
            fields={
                'id': {'type': 'string', 'required': True},
                'value': {'type': 'integer', 'required': True}
            }
        )
        
        await source.register_schema(schema)
        await target.register_schema(schema)
        
        # 添加符合模式的数据
        valid_data = [
            {'id': 'item_1', 'value': 100},
            {'id': 'item_2', 'value': 200}
        ]
        
        # 添加不符合模式的数据
        invalid_data = [
            {'id': 'item_3'},  # 缺少required字段
            {'id': 'item_4', 'value': 'not_integer'}  # 类型错误
        ]
        
        # 添加到目标后端
        for i, data in enumerate(valid_data + invalid_data):
            key = StorageKey(key=f'schema_key_{i}', namespace='test')
            value = StorageValue(data=data, schema='validation_schema')
            await target.set(key, value)
        
        # 创建模式验证器
        validator = SchemaValidator()
        
        # 执行模式验证
        result = await validator.validate_schema_compliance(
            backend=target,
            schema_name='validation_schema'
        )
        
        assert result.is_valid is False
        assert result.total_items == 4
        assert result.valid_items == 2  # 只有前两个符合模式
        assert len(result.errors) == 2

# -*- coding: utf-8 -*-
"""
审计系统测试

测试新架构的审计系统功能
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.security.core.audit import (
    AuditManager, AuditManagerConfig, AuditEvent, AuditLog,
    AuditFilter, AuditReport, AuditPolicy, ComplianceChecker
)
from zishu.security.core.types import SecurityLevel, AuditEventType, ComplianceStandard
from zishu.security.core.exceptions import AuditException, ComplianceViolation

from tests.utils.security_test_utils import SecurityTestUtils


class TestAuditManager:
    """审计管理器测试类"""

    @pytest.fixture
    def audit_config(self):
        """创建审计管理器配置"""
        return AuditManagerConfig(
            enable_real_time_audit=True,
            enable_compliance_checking=True,
            enable_audit_encryption=True,
            enable_tamper_detection=True,
            retention_days=365,
            max_log_size_mb=1000,
            compression_enabled=True,
            backup_enabled=True,
            backup_interval_hours=24,
            alert_on_violations=True
        )

    @pytest.fixture
    async def audit_manager(self, audit_config):
        """创建审计管理器实例"""
        manager = AuditManager(config=audit_config)
        await manager.initialize()
        yield manager
        await manager.cleanup()

    @pytest.fixture
    def sample_audit_events(self):
        """创建示例审计事件"""
        return [
            AuditEvent(
                event_id='audit_001',
                event_type=AuditEventType.USER_LOGIN,
                timestamp=datetime.now(timezone.utc),
                user_id='user_001',
                session_id='session_001',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                security_level=SecurityLevel.INTERNAL,
                details={'login_method': 'password'}
            ),
            AuditEvent(
                event_id='audit_002',
                event_type=AuditEventType.PERMISSION_CHECK,
                timestamp=datetime.now(timezone.utc),
                user_id='user_001',
                session_id='session_001',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='adapter:test-adapter',
                action='execute',
                result='allowed',
                security_level=SecurityLevel.INTERNAL,
                details={'permission': 'execute_adapters'}
            ),
            AuditEvent(
                event_id='audit_003',
                event_type=AuditEventType.SECURITY_VIOLATION,
                timestamp=datetime.now(timezone.utc),
                user_id='user_002',
                session_id='session_002',
                source_ip='192.168.1.200',
                user_agent='curl/7.68.0',
                resource='system:admin',
                action='access',
                result='denied',
                security_level=SecurityLevel.RESTRICTED,
                details={'violation_type': 'unauthorized_access', 'severity': 'high'}
            )
        ]

    async def test_audit_manager_initialization(self, audit_config):
        """测试审计管理器初始化"""
        manager = AuditManager(config=audit_config)
        
        # 验证初始状态
        assert manager.config == audit_config
        assert not manager.is_initialized
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        
        # 清理管理器
        await manager.cleanup()

    async def test_log_audit_event(self, audit_manager, sample_audit_events):
        """测试记录审计事件"""
        # 记录单个审计事件
        event = sample_audit_events[0]
        result = await audit_manager.log_event(event)
        assert result is True
        
        # 验证事件已记录
        logged_event = await audit_manager.get_event(event.event_id)
        assert logged_event is not None
        assert logged_event.event_id == event.event_id
        assert logged_event.user_id == event.user_id

    async def test_batch_log_audit_events(self, audit_manager, sample_audit_events):
        """测试批量记录审计事件"""
        # 批量记录审计事件
        result = await audit_manager.log_events_batch(sample_audit_events)
        assert result is True
        
        # 验证所有事件已记录
        for event in sample_audit_events:
            logged_event = await audit_manager.get_event(event.event_id)
            assert logged_event is not None

    async def test_query_audit_events(self, audit_manager, sample_audit_events):
        """测试查询审计事件"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 按用户查询
        user_events = await audit_manager.query_events(
            user_id='user_001',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert len(user_events) == 2  # user_001有两个事件
        
        # 按事件类型查询
        login_events = await audit_manager.query_events(
            event_type=AuditEventType.USER_LOGIN,
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert len(login_events) == 1

    async def test_audit_filter(self, audit_manager, sample_audit_events):
        """测试审计过滤器"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 创建过滤器
        filter_config = AuditFilter(
            user_ids=['user_001'],
            event_types=[AuditEventType.USER_LOGIN, AuditEventType.PERMISSION_CHECK],
            security_levels=[SecurityLevel.INTERNAL],
            result_filter='success|allowed',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        # 应用过滤器
        filtered_events = await audit_manager.filter_events(filter_config)
        
        assert len(filtered_events) == 2  # 应该匹配两个事件
        for event in filtered_events:
            assert event.user_id == 'user_001'
            assert event.result in ['success', 'allowed']

    async def test_audit_search(self, audit_manager, sample_audit_events):
        """测试审计搜索"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 文本搜索
        search_results = await audit_manager.search_events(
            query='adapter',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert len(search_results) >= 1
        
        # 高级搜索
        advanced_search_results = await audit_manager.advanced_search(
            criteria={
                'resource': 'adapter:*',
                'action': 'execute',
                'result': 'allowed'
            },
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert len(advanced_search_results) >= 1

    async def test_audit_aggregation(self, audit_manager, sample_audit_events):
        """测试审计聚合"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 按用户聚合
        user_stats = await audit_manager.aggregate_by_user(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert 'user_001' in user_stats
        assert 'user_002' in user_stats
        assert user_stats['user_001']['event_count'] == 2
        assert user_stats['user_002']['event_count'] == 1
        
        # 按事件类型聚合
        event_type_stats = await audit_manager.aggregate_by_event_type(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert AuditEventType.USER_LOGIN in event_type_stats
        assert AuditEventType.PERMISSION_CHECK in event_type_stats
        assert AuditEventType.SECURITY_VIOLATION in event_type_stats

    async def test_audit_report_generation(self, audit_manager, sample_audit_events):
        """测试审计报告生成"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 生成用户活动报告
        user_report = await audit_manager.generate_user_activity_report(
            user_id='user_001',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert isinstance(user_report, AuditReport)
        assert user_report.total_events == 2
        assert 'login_count' in user_report.summary
        
        # 生成安全事件报告
        security_report = await audit_manager.generate_security_report(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert isinstance(security_report, AuditReport)
        assert security_report.total_events >= 1
        assert 'violation_count' in security_report.summary

    async def test_compliance_checking(self, audit_manager, sample_audit_events):
        """测试合规检查"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 创建合规策略
        compliance_policy = AuditPolicy(
            name='login_monitoring',
            description='Monitor user login activities',
            rules=[
                {
                    'condition': 'event_type == "USER_LOGIN" and result == "success"',
                    'action': 'log_compliance_event',
                    'severity': 'info'
                },
                {
                    'condition': 'event_type == "SECURITY_VIOLATION"',
                    'action': 'alert',
                    'severity': 'high'
                }
            ],
            compliance_standards=[ComplianceStandard.SOX, ComplianceStandard.GDPR]
        )
        
        # 添加合规策略
        await audit_manager.add_compliance_policy(compliance_policy)
        
        # 执行合规检查
        compliance_results = await audit_manager.check_compliance(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert compliance_results is not None
        assert 'violations' in compliance_results
        assert 'compliance_score' in compliance_results

    async def test_audit_encryption(self, audit_manager):
        """测试审计加密"""
        # 创建敏感审计事件
        sensitive_event = AuditEvent(
            event_id='sensitive_001',
            event_type=AuditEventType.DATA_ACCESS,
            timestamp=datetime.now(timezone.utc),
            user_id='sensitive_user',
            session_id='sensitive_session',
            source_ip='192.168.1.100',
            user_agent='Mozilla/5.0',
            resource='sensitive_data',
            action='read',
            result='success',
            security_level=SecurityLevel.CONFIDENTIAL,
            details={'data_type': 'personal_information', 'record_count': 100}
        )
        
        # 记录事件（应该被加密）
        await audit_manager.log_event(sensitive_event)
        
        # 获取加密的事件
        encrypted_event = await audit_manager.get_encrypted_event(sensitive_event.event_id)
        assert encrypted_event is not None
        
        # 解密事件
        decrypted_event = await audit_manager.decrypt_event(encrypted_event)
        assert decrypted_event.event_id == sensitive_event.event_id
        assert decrypted_event.details == sensitive_event.details

    async def test_tamper_detection(self, audit_manager, sample_audit_events):
        """测试篡改检测"""
        # 记录事件
        event = sample_audit_events[0]
        await audit_manager.log_event(event)
        
        # 获取事件的完整性哈希
        integrity_hash = await audit_manager.get_event_integrity_hash(event.event_id)
        assert integrity_hash is not None
        
        # 验证事件完整性
        is_intact = await audit_manager.verify_event_integrity(event.event_id, integrity_hash)
        assert is_intact is True
        
        # 模拟篡改
        await audit_manager._simulate_event_tampering(event.event_id)
        
        # 再次验证完整性（应该失败）
        is_intact_after_tampering = await audit_manager.verify_event_integrity(event.event_id, integrity_hash)
        assert is_intact_after_tampering is False

    async def test_audit_retention_policy(self, audit_manager):
        """测试审计保留策略"""
        # 创建过期的审计事件
        old_event = AuditEvent(
            event_id='old_event_001',
            event_type=AuditEventType.USER_LOGIN,
            timestamp=datetime.now(timezone.utc) - timedelta(days=400),  # 超过保留期
            user_id='old_user',
            session_id='old_session',
            source_ip='192.168.1.100',
            user_agent='Mozilla/5.0',
            resource='system',
            action='authenticate',
            result='success',
            security_level=SecurityLevel.INTERNAL,
            details={}
        )
        
        # 记录过期事件
        await audit_manager.log_event(old_event)
        
        # 执行保留策略清理
        cleaned_count = await audit_manager.apply_retention_policy()
        
        assert cleaned_count >= 0
        
        # 验证过期事件已被清理
        cleaned_event = await audit_manager.get_event(old_event.event_id)
        assert cleaned_event is None

    async def test_audit_backup_restore(self, audit_manager, sample_audit_events):
        """测试审计备份和恢复"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 创建备份
        backup_id = await audit_manager.create_backup(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert backup_id is not None
        
        # 验证备份存在
        backup_info = await audit_manager.get_backup_info(backup_id)
        assert backup_info is not None
        assert backup_info['event_count'] == len(sample_audit_events)
        
        # 清理当前事件
        await audit_manager.clear_events(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        # 从备份恢复
        restore_result = await audit_manager.restore_from_backup(backup_id)
        assert restore_result is True
        
        # 验证事件已恢复
        for event in sample_audit_events:
            restored_event = await audit_manager.get_event(event.event_id)
            assert restored_event is not None

    async def test_real_time_audit_monitoring(self, audit_manager):
        """测试实时审计监控"""
        # 创建事件监听器
        received_events = []
        
        async def event_listener(event):
            received_events.append(event)
        
        # 注册监听器
        await audit_manager.register_real_time_listener(event_listener)
        
        # 记录事件
        test_event = AuditEvent(
            event_id='realtime_001',
            event_type=AuditEventType.USER_LOGIN,
            timestamp=datetime.now(timezone.utc),
            user_id='realtime_user',
            session_id='realtime_session',
            source_ip='192.168.1.100',
            user_agent='Mozilla/5.0',
            resource='system',
            action='authenticate',
            result='success',
            security_level=SecurityLevel.INTERNAL,
            details={}
        )
        
        await audit_manager.log_event(test_event)
        
        # 等待事件传播
        await asyncio.sleep(0.1)
        
        # 验证监听器收到事件
        assert len(received_events) == 1
        assert received_events[0].event_id == test_event.event_id

    async def test_audit_alerting(self, audit_manager):
        """测试审计告警"""
        # 创建告警规则
        alert_rule = {
            'name': 'security_violation_alert',
            'condition': 'event_type == "SECURITY_VIOLATION" and details.severity == "high"',
            'action': 'send_alert',
            'recipients': ['security@example.com'],
            'severity': 'critical'
        }
        
        # 添加告警规则
        await audit_manager.add_alert_rule(alert_rule)
        
        # 创建触发告警的事件
        violation_event = AuditEvent(
            event_id='violation_001',
            event_type=AuditEventType.SECURITY_VIOLATION,
            timestamp=datetime.now(timezone.utc),
            user_id='malicious_user',
            session_id='malicious_session',
            source_ip='192.168.1.200',
            user_agent='curl/7.68.0',
            resource='system:admin',
            action='access',
            result='denied',
            security_level=SecurityLevel.RESTRICTED,
            details={'violation_type': 'unauthorized_access', 'severity': 'high'}
        )
        
        # 记录事件（应该触发告警）
        await audit_manager.log_event(violation_event)
        
        # 获取触发的告警
        alerts = await audit_manager.get_triggered_alerts(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=1),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=1)
        )
        
        assert len(alerts) >= 1
        assert alerts[0]['rule_name'] == 'security_violation_alert'

    async def test_audit_statistics(self, audit_manager, sample_audit_events):
        """测试审计统计"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 获取基本统计
        basic_stats = await audit_manager.get_basic_statistics(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert basic_stats['total_events'] == len(sample_audit_events)
        assert basic_stats['unique_users'] == 2
        assert basic_stats['event_types'] >= 3
        
        # 获取详细统计
        detailed_stats = await audit_manager.get_detailed_statistics(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert 'events_by_hour' in detailed_stats
        assert 'top_users' in detailed_stats
        assert 'top_resources' in detailed_stats

    async def test_audit_export_import(self, audit_manager, sample_audit_events):
        """测试审计导出导入"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 导出审计日志
        export_data = await audit_manager.export_audit_logs(
            format='json',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        assert export_data is not None
        exported_events = json.loads(export_data)
        assert len(exported_events) == len(sample_audit_events)
        
        # 清理现有日志
        await audit_manager.clear_events(
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        
        # 导入审计日志
        import_result = await audit_manager.import_audit_logs(export_data, format='json')
        assert import_result is True
        
        # 验证日志已恢复
        for event in sample_audit_events:
            restored_event = await audit_manager.get_event(event.event_id)
            assert restored_event is not None

    async def test_concurrent_audit_operations(self, audit_manager):
        """测试并发审计操作"""
        # 创建多个审计事件
        events = []
        for i in range(50):
            event = AuditEvent(
                event_id=f'concurrent_{i}',
                event_type=AuditEventType.USER_LOGIN,
                timestamp=datetime.now(timezone.utc),
                user_id=f'user_{i % 10}',
                session_id=f'session_{i}',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                security_level=SecurityLevel.INTERNAL,
                details={'concurrent_test': True}
            )
            events.append(event)
        
        # 并发记录事件
        log_tasks = [audit_manager.log_event(event) for event in events]
        log_results = await asyncio.gather(*log_tasks)
        
        # 验证所有事件都记录成功
        assert all(log_results)
        
        # 并发查询事件
        query_tasks = [audit_manager.get_event(event.event_id) for event in events]
        query_results = await asyncio.gather(*query_tasks)
        
        # 验证所有事件都能查询到
        assert all(result is not None for result in query_results)

    async def test_audit_performance_monitoring(self, audit_manager, sample_audit_events):
        """测试审计性能监控"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 获取性能指标
        performance_metrics = await audit_manager.get_performance_metrics()
        
        assert performance_metrics is not None
        assert 'log_throughput' in performance_metrics
        assert 'query_latency' in performance_metrics
        assert 'storage_usage' in performance_metrics
        assert 'index_efficiency' in performance_metrics

    async def test_error_handling(self, audit_manager):
        """测试错误处理"""
        # 测试记录无效事件
        invalid_event = AuditEvent(
            event_id='',  # 空ID
            event_type=None,  # 空类型
            timestamp=None,  # 空时间戳
            user_id='',
            session_id='',
            source_ip='',
            user_agent='',
            resource='',
            action='',
            result='',
            security_level=None,
            details={}
        )
        
        with pytest.raises(AuditException):
            await audit_manager.log_event(invalid_event)
        
        # 测试查询不存在的事件
        nonexistent_event = await audit_manager.get_event('nonexistent_id')
        assert nonexistent_event is None
        
        # 测试无效的查询参数
        with pytest.raises(ValueError):
            await audit_manager.query_events(
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc) - timedelta(hours=1)  # 结束时间早于开始时间
            )

    async def test_audit_cleanup(self, audit_manager, sample_audit_events):
        """测试审计清理"""
        # 记录事件
        await audit_manager.log_events_batch(sample_audit_events)
        
        # 验证事件存在
        for event in sample_audit_events:
            logged_event = await audit_manager.get_event(event.event_id)
            assert logged_event is not None
        
        # 清理管理器
        await audit_manager.cleanup()
        
        # 验证资源已清理（具体行为取决于实现）

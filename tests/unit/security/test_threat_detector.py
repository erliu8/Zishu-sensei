# -*- coding: utf-8 -*-
"""
威胁检测器测试

测试新架构的威胁检测功能
"""

import pytest
import asyncio
import numpy as np
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.security.core.threat_detector import (
    ThreatDetector, ThreatDetectorConfig, ThreatAnalysis,
    ThreatPattern, ThreatSignature, AnomalyDetector, BehaviorAnalyzer
)
from zishu.security.core.types import (
    ThreatLevel, ThreatType, SecurityEvent, ThreatIndicator,
    AttackVector, RiskScore
)
from zishu.security.core.exceptions import ThreatDetected, AnalysisError

from tests.utils.security_test_utils import SecurityTestUtils


class TestThreatDetector:
    """威胁检测器测试类"""

    @pytest.fixture
    def detector_config(self):
        """创建威胁检测器配置"""
        return ThreatDetectorConfig(
            enable_real_time_detection=True,
            enable_behavioral_analysis=True,
            enable_anomaly_detection=True,
            enable_pattern_matching=True,
            enable_ml_detection=True,
            detection_threshold=0.7,
            anomaly_threshold=0.8,
            behavioral_window_minutes=60,
            pattern_cache_size=1000,
            max_concurrent_analyses=10,
            alert_on_detection=True
        )

    @pytest.fixture
    async def threat_detector(self, detector_config):
        """创建威胁检测器实例"""
        detector = ThreatDetector(config=detector_config)
        await detector.initialize()
        yield detector
        await detector.cleanup()

    @pytest.fixture
    def sample_security_events(self):
        """创建示例安全事件"""
        return [
            SecurityEvent(
                event_id='sec_001',
                timestamp=datetime.now(timezone.utc),
                event_type='login_attempt',
                user_id='user_001',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                severity=ThreatLevel.LOW,
                details={'login_method': 'password'}
            ),
            SecurityEvent(
                event_id='sec_002',
                timestamp=datetime.now(timezone.utc),
                event_type='failed_login',
                user_id='user_001',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='failure',
                severity=ThreatLevel.MEDIUM,
                details={'failure_reason': 'invalid_password', 'attempt_count': 3}
            ),
            SecurityEvent(
                event_id='sec_003',
                timestamp=datetime.now(timezone.utc),
                event_type='suspicious_access',
                user_id='user_002',
                source_ip='10.0.0.50',
                user_agent='curl/7.68.0',
                resource='admin_panel',
                action='access',
                result='blocked',
                severity=ThreatLevel.HIGH,
                details={'access_pattern': 'automated', 'blocked_reason': 'suspicious_behavior'}
            )
        ]

    @pytest.fixture
    def threat_patterns(self):
        """创建威胁模式"""
        return [
            ThreatPattern(
                pattern_id='brute_force',
                name='Brute Force Attack',
                description='Multiple failed login attempts',
                threat_type=ThreatType.BRUTE_FORCE,
                severity=ThreatLevel.HIGH,
                conditions=[
                    {'field': 'event_type', 'operator': 'equals', 'value': 'failed_login'},
                    {'field': 'user_id', 'operator': 'same', 'value': None},
                    {'field': 'count', 'operator': 'greater_than', 'value': 5},
                    {'field': 'time_window', 'operator': 'within', 'value': 300}  # 5分钟
                ],
                indicators=[
                    ThreatIndicator.MULTIPLE_FAILED_LOGINS,
                    ThreatIndicator.RAPID_REQUESTS
                ]
            ),
            ThreatPattern(
                pattern_id='privilege_escalation',
                name='Privilege Escalation',
                description='Unauthorized access to privileged resources',
                threat_type=ThreatType.PRIVILEGE_ESCALATION,
                severity=ThreatLevel.CRITICAL,
                conditions=[
                    {'field': 'resource', 'operator': 'contains', 'value': 'admin'},
                    {'field': 'user_role', 'operator': 'not_equals', 'value': 'admin'},
                    {'field': 'result', 'operator': 'equals', 'value': 'success'}
                ],
                indicators=[
                    ThreatIndicator.UNAUTHORIZED_ACCESS,
                    ThreatIndicator.PRIVILEGE_ABUSE
                ]
            ),
            ThreatPattern(
                pattern_id='data_exfiltration',
                name='Data Exfiltration',
                description='Unusual data access patterns',
                threat_type=ThreatType.DATA_EXFILTRATION,
                severity=ThreatLevel.CRITICAL,
                conditions=[
                    {'field': 'action', 'operator': 'equals', 'value': 'download'},
                    {'field': 'data_size', 'operator': 'greater_than', 'value': 100000000},  # 100MB
                    {'field': 'time_of_day', 'operator': 'outside_hours', 'value': '09:00-17:00'}
                ],
                indicators=[
                    ThreatIndicator.LARGE_DATA_TRANSFER,
                    ThreatIndicator.OFF_HOURS_ACCESS
                ]
            )
        ]

    async def test_threat_detector_initialization(self, detector_config):
        """测试威胁检测器初始化"""
        detector = ThreatDetector(config=detector_config)
        
        # 验证初始状态
        assert detector.config == detector_config
        assert not detector.is_initialized
        
        # 初始化检测器
        await detector.initialize()
        assert detector.is_initialized
        
        # 清理检测器
        await detector.cleanup()

    async def test_analyze_single_event(self, threat_detector, sample_security_events):
        """测试分析单个事件"""
        # 分析正常事件
        normal_event = sample_security_events[0]
        analysis = await threat_detector.analyze_event(normal_event)
        
        assert isinstance(analysis, ThreatAnalysis)
        assert analysis.event_id == normal_event.event_id
        assert analysis.threat_level <= ThreatLevel.LOW
        
        # 分析可疑事件
        suspicious_event = sample_security_events[2]
        analysis = await threat_detector.analyze_event(suspicious_event)
        
        assert analysis.threat_level >= ThreatLevel.MEDIUM
        assert len(analysis.detected_threats) >= 0

    async def test_batch_event_analysis(self, threat_detector, sample_security_events):
        """测试批量事件分析"""
        # 批量分析事件
        analyses = await threat_detector.analyze_events_batch(sample_security_events)
        
        assert len(analyses) == len(sample_security_events)
        for analysis in analyses:
            assert isinstance(analysis, ThreatAnalysis)
            assert analysis.event_id in [e.event_id for e in sample_security_events]

    async def test_pattern_matching(self, threat_detector, threat_patterns):
        """测试模式匹配"""
        # 添加威胁模式
        for pattern in threat_patterns:
            await threat_detector.add_threat_pattern(pattern)
        
        # 创建匹配暴力破解模式的事件序列
        brute_force_events = []
        for i in range(6):  # 6次失败登录
            event = SecurityEvent(
                event_id=f'brute_force_{i}',
                timestamp=datetime.now(timezone.utc) - timedelta(seconds=i*30),
                event_type='failed_login',
                user_id='target_user',
                source_ip='192.168.1.200',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='failure',
                severity=ThreatLevel.MEDIUM,
                details={'failure_reason': 'invalid_password'}
            )
            brute_force_events.append(event)
        
        # 分析事件序列
        pattern_matches = await threat_detector.match_patterns(brute_force_events)
        
        assert len(pattern_matches) >= 1
        assert any(match.pattern_id == 'brute_force' for match in pattern_matches)

    async def test_anomaly_detection(self, threat_detector):
        """测试异常检测"""
        # 创建正常行为基线
        normal_events = []
        for i in range(100):
            event = SecurityEvent(
                event_id=f'normal_{i}',
                timestamp=datetime.now(timezone.utc) - timedelta(minutes=i),
                event_type='login_attempt',
                user_id='normal_user',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                severity=ThreatLevel.LOW,
                details={'login_method': 'password'}
            )
            normal_events.append(event)
        
        # 训练异常检测模型
        await threat_detector.train_anomaly_detector(normal_events)
        
        # 创建异常事件
        anomaly_event = SecurityEvent(
            event_id='anomaly_001',
            timestamp=datetime.now(timezone.utc),
            event_type='login_attempt',
            user_id='normal_user',
            source_ip='10.0.0.1',  # 不同的IP
            user_agent='curl/7.68.0',  # 不同的用户代理
            resource='admin_panel',  # 不同的资源
            action='authenticate',
            result='success',
            severity=ThreatLevel.LOW,
            details={'login_method': 'api_key'}  # 不同的登录方法
        )
        
        # 检测异常
        anomaly_score = await threat_detector.detect_anomaly(anomaly_event)
        
        assert anomaly_score > 0.5  # 应该检测到异常

    async def test_behavioral_analysis(self, threat_detector):
        """测试行为分析"""
        # 创建用户行为历史
        user_behavior_events = []
        for i in range(50):
            # 正常工作时间登录
            event = SecurityEvent(
                event_id=f'behavior_{i}',
                timestamp=datetime.now(timezone.utc).replace(hour=9+i%8, minute=0, second=0),
                event_type='login_attempt',
                user_id='behavior_user',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                severity=ThreatLevel.LOW,
                details={'login_method': 'password'}
            )
            user_behavior_events.append(event)
        
        # 建立行为基线
        await threat_detector.establish_behavior_baseline('behavior_user', user_behavior_events)
        
        # 创建异常行为事件（深夜登录）
        unusual_behavior_event = SecurityEvent(
            event_id='unusual_behavior_001',
            timestamp=datetime.now(timezone.utc).replace(hour=2, minute=0, second=0),
            event_type='login_attempt',
            user_id='behavior_user',
            source_ip='192.168.1.100',
            user_agent='Mozilla/5.0',
            resource='system',
            action='authenticate',
            result='success',
            severity=ThreatLevel.LOW,
            details={'login_method': 'password'}
        )
        
        # 分析行为异常
        behavior_analysis = await threat_detector.analyze_behavior(unusual_behavior_event)
        
        assert behavior_analysis.is_anomalous is True
        assert behavior_analysis.anomaly_score > 0.6

    async def test_ml_threat_detection(self, threat_detector):
        """测试机器学习威胁检测"""
        # 创建训练数据
        training_events = []
        labels = []
        
        # 正常事件
        for i in range(200):
            event = SecurityEvent(
                event_id=f'ml_normal_{i}',
                timestamp=datetime.now(timezone.utc),
                event_type='login_attempt',
                user_id=f'user_{i%20}',
                source_ip=f'192.168.1.{100+i%50}',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                severity=ThreatLevel.LOW,
                details={'login_method': 'password'}
            )
            training_events.append(event)
            labels.append(0)  # 正常
        
        # 威胁事件
        for i in range(50):
            event = SecurityEvent(
                event_id=f'ml_threat_{i}',
                timestamp=datetime.now(timezone.utc),
                event_type='failed_login',
                user_id=f'user_{i%5}',
                source_ip=f'10.0.0.{1+i%10}',
                user_agent='curl/7.68.0',
                resource='admin_panel',
                action='authenticate',
                result='failure',
                severity=ThreatLevel.HIGH,
                details={'failure_reason': 'brute_force'}
            )
            training_events.append(event)
            labels.append(1)  # 威胁
        
        # 训练ML模型
        await threat_detector.train_ml_model(training_events, labels)
        
        # 测试预测
        test_event = SecurityEvent(
            event_id='ml_test_001',
            timestamp=datetime.now(timezone.utc),
            event_type='failed_login',
            user_id='test_user',
            source_ip='10.0.0.100',
            user_agent='curl/7.68.0',
            resource='admin_panel',
            action='authenticate',
            result='failure',
            severity=ThreatLevel.HIGH,
            details={'failure_reason': 'invalid_credentials'}
        )
        
        threat_probability = await threat_detector.predict_threat(test_event)
        
        assert threat_probability > 0.5  # 应该预测为威胁

    async def test_real_time_monitoring(self, threat_detector):
        """测试实时监控"""
        # 创建威胁检测监听器
        detected_threats = []
        
        async def threat_listener(threat_analysis):
            detected_threats.append(threat_analysis)
        
        # 注册监听器
        await threat_detector.register_threat_listener(threat_listener)
        
        # 启动实时监控
        await threat_detector.start_real_time_monitoring()
        
        # 模拟威胁事件
        threat_event = SecurityEvent(
            event_id='realtime_threat_001',
            timestamp=datetime.now(timezone.utc),
            event_type='suspicious_access',
            user_id='malicious_user',
            source_ip='10.0.0.1',
            user_agent='curl/7.68.0',
            resource='sensitive_data',
            action='access',
            result='success',
            severity=ThreatLevel.CRITICAL,
            details={'access_pattern': 'automated', 'data_sensitivity': 'high'}
        )
        
        # 提交事件进行实时分析
        await threat_detector.submit_event_for_analysis(threat_event)
        
        # 等待分析完成
        await asyncio.sleep(0.5)
        
        # 验证威胁被检测到
        assert len(detected_threats) >= 1
        
        # 停止实时监控
        await threat_detector.stop_real_time_monitoring()

    async def test_threat_correlation(self, threat_detector):
        """测试威胁关联"""
        # 创建相关的威胁事件
        correlated_events = [
            SecurityEvent(
                event_id='corr_001',
                timestamp=datetime.now(timezone.utc),
                event_type='port_scan',
                user_id='unknown',
                source_ip='10.0.0.1',
                user_agent='nmap',
                resource='network',
                action='scan',
                result='detected',
                severity=ThreatLevel.MEDIUM,
                details={'scanned_ports': [22, 80, 443, 3389]}
            ),
            SecurityEvent(
                event_id='corr_002',
                timestamp=datetime.now(timezone.utc) + timedelta(minutes=5),
                event_type='login_attempt',
                user_id='admin',
                source_ip='10.0.0.1',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='failure',
                severity=ThreatLevel.HIGH,
                details={'failure_reason': 'invalid_credentials'}
            ),
            SecurityEvent(
                event_id='corr_003',
                timestamp=datetime.now(timezone.utc) + timedelta(minutes=10),
                event_type='privilege_escalation',
                user_id='admin',
                source_ip='10.0.0.1',
                user_agent='Mozilla/5.0',
                resource='admin_panel',
                action='access',
                result='success',
                severity=ThreatLevel.CRITICAL,
                details={'escalation_method': 'credential_stuffing'}
            )
        ]
        
        # 分析威胁关联
        correlation_analysis = await threat_detector.correlate_threats(correlated_events)
        
        assert correlation_analysis is not None
        assert correlation_analysis.correlation_score > 0.7
        assert len(correlation_analysis.attack_chain) >= 2

    async def test_threat_intelligence_integration(self, threat_detector):
        """测试威胁情报集成"""
        # 模拟威胁情报数据
        threat_intel = {
            'malicious_ips': ['10.0.0.1', '192.168.100.1'],
            'malicious_domains': ['malicious.com', 'phishing.net'],
            'attack_signatures': ['curl/7.68.0', 'sqlmap/1.4'],
            'known_vulnerabilities': ['CVE-2021-44228', 'CVE-2021-34527']
        }
        
        # 更新威胁情报
        await threat_detector.update_threat_intelligence(threat_intel)
        
        # 创建包含威胁情报指标的事件
        intel_event = SecurityEvent(
            event_id='intel_001',
            timestamp=datetime.now(timezone.utc),
            event_type='web_request',
            user_id='unknown',
            source_ip='10.0.0.1',  # 恶意IP
            user_agent='curl/7.68.0',  # 恶意签名
            resource='web_app',
            action='request',
            result='success',
            severity=ThreatLevel.LOW,
            details={'url': '/admin/config.php'}
        )
        
        # 分析事件
        intel_analysis = await threat_detector.analyze_with_intelligence(intel_event)
        
        assert intel_analysis.threat_level >= ThreatLevel.HIGH
        assert 'malicious_ip' in intel_analysis.threat_indicators
        assert 'malicious_signature' in intel_analysis.threat_indicators

    async def test_attack_vector_analysis(self, threat_detector):
        """测试攻击向量分析"""
        # 创建不同攻击向量的事件
        attack_events = [
            SecurityEvent(
                event_id='attack_web',
                timestamp=datetime.now(timezone.utc),
                event_type='web_attack',
                user_id='unknown',
                source_ip='10.0.0.1',
                user_agent='sqlmap/1.4',
                resource='web_app',
                action='sql_injection',
                result='blocked',
                severity=ThreatLevel.HIGH,
                details={'attack_type': 'sql_injection', 'payload': "' OR 1=1--"}
            ),
            SecurityEvent(
                event_id='attack_network',
                timestamp=datetime.now(timezone.utc),
                event_type='network_attack',
                user_id='unknown',
                source_ip='10.0.0.1',
                user_agent='nmap',
                resource='network',
                action='port_scan',
                result='detected',
                severity=ThreatLevel.MEDIUM,
                details={'attack_type': 'reconnaissance', 'scanned_ports': [22, 80, 443]}
            )
        ]
        
        # 分析攻击向量
        vector_analysis = await threat_detector.analyze_attack_vectors(attack_events)
        
        assert AttackVector.WEB_APPLICATION in vector_analysis.vectors
        assert AttackVector.NETWORK in vector_analysis.vectors
        assert vector_analysis.primary_vector in [AttackVector.WEB_APPLICATION, AttackVector.NETWORK]

    async def test_risk_scoring(self, threat_detector):
        """测试风险评分"""
        # 创建不同风险级别的事件
        risk_events = [
            SecurityEvent(
                event_id='risk_low',
                timestamp=datetime.now(timezone.utc),
                event_type='login_attempt',
                user_id='normal_user',
                source_ip='192.168.1.100',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success',
                severity=ThreatLevel.LOW,
                details={'login_method': 'password'}
            ),
            SecurityEvent(
                event_id='risk_high',
                timestamp=datetime.now(timezone.utc),
                event_type='privilege_escalation',
                user_id='suspicious_user',
                source_ip='10.0.0.1',
                user_agent='curl/7.68.0',
                resource='admin_panel',
                action='access',
                result='success',
                severity=ThreatLevel.CRITICAL,
                details={'escalation_method': 'exploit', 'vulnerability': 'CVE-2021-44228'}
            )
        ]
        
        # 计算风险评分
        for event in risk_events:
            risk_score = await threat_detector.calculate_risk_score(event)
            
            assert isinstance(risk_score, RiskScore)
            assert 0 <= risk_score.score <= 1
            
            if event.event_id == 'risk_low':
                assert risk_score.score < 0.3
            elif event.event_id == 'risk_high':
                assert risk_score.score > 0.7

    async def test_threat_hunting(self, threat_detector, sample_security_events):
        """测试威胁狩猎"""
        # 添加事件到分析队列
        for event in sample_security_events:
            await threat_detector.add_event_to_queue(event)
        
        # 定义狩猎查询
        hunting_queries = [
            {
                'name': 'suspicious_login_patterns',
                'query': 'event_type:failed_login AND source_ip:10.0.0.*',
                'description': 'Look for failed logins from internal network'
            },
            {
                'name': 'off_hours_access',
                'query': 'timestamp:[22:00 TO 06:00] AND result:success',
                'description': 'Look for successful access during off hours'
            }
        ]
        
        # 执行威胁狩猎
        hunting_results = await threat_detector.execute_threat_hunting(hunting_queries)
        
        assert isinstance(hunting_results, list)
        for result in hunting_results:
            assert 'query_name' in result
            assert 'matches' in result
            assert 'risk_assessment' in result

    async def test_false_positive_handling(self, threat_detector):
        """测试误报处理"""
        # 创建可能产生误报的事件
        fp_event = SecurityEvent(
            event_id='fp_001',
            timestamp=datetime.now(timezone.utc),
            event_type='admin_access',
            user_id='legitimate_admin',
            source_ip='192.168.1.10',
            user_agent='Mozilla/5.0',
            resource='admin_panel',
            action='access',
            result='success',
            severity=ThreatLevel.LOW,
            details={'access_reason': 'routine_maintenance'}
        )
        
        # 分析事件
        analysis = await threat_detector.analyze_event(fp_event)
        
        # 标记为误报
        await threat_detector.mark_false_positive(analysis.analysis_id, 'legitimate_admin_access')
        
        # 重新分析相似事件
        similar_event = SecurityEvent(
            event_id='fp_002',
            timestamp=datetime.now(timezone.utc),
            event_type='admin_access',
            user_id='legitimate_admin',
            source_ip='192.168.1.10',
            user_agent='Mozilla/5.0',
            resource='admin_panel',
            action='access',
            result='success',
            severity=ThreatLevel.LOW,
            details={'access_reason': 'routine_maintenance'}
        )
        
        # 应该减少误报
        new_analysis = await threat_detector.analyze_event(similar_event)
        assert new_analysis.false_positive_probability > 0.5

    async def test_concurrent_threat_analysis(self, threat_detector):
        """测试并发威胁分析"""
        # 创建大量事件
        events = []
        for i in range(100):
            event = SecurityEvent(
                event_id=f'concurrent_{i}',
                timestamp=datetime.now(timezone.utc),
                event_type='login_attempt',
                user_id=f'user_{i%10}',
                source_ip=f'192.168.1.{100+i%50}',
                user_agent='Mozilla/5.0',
                resource='system',
                action='authenticate',
                result='success' if i%3 == 0 else 'failure',
                severity=ThreatLevel.LOW if i%3 == 0 else ThreatLevel.MEDIUM,
                details={'concurrent_test': True}
            )
            events.append(event)
        
        # 并发分析事件
        analysis_tasks = [threat_detector.analyze_event(event) for event in events]
        analyses = await asyncio.gather(*analysis_tasks)
        
        # 验证所有分析都完成
        assert len(analyses) == len(events)
        for analysis in analyses:
            assert isinstance(analysis, ThreatAnalysis)

    async def test_threat_metrics(self, threat_detector, sample_security_events):
        """测试威胁指标"""
        # 分析一些事件
        for event in sample_security_events:
            await threat_detector.analyze_event(event)
        
        # 获取威胁指标
        metrics = await threat_detector.get_threat_metrics()
        
        assert metrics is not None
        assert 'total_events_analyzed' in metrics
        assert 'threats_detected' in metrics
        assert 'false_positive_rate' in metrics
        assert 'detection_accuracy' in metrics

    async def test_error_handling(self, threat_detector):
        """测试错误处理"""
        # 测试分析无效事件
        invalid_event = SecurityEvent(
            event_id='',  # 空ID
            timestamp=None,  # 空时间戳
            event_type='',
            user_id='',
            source_ip='',
            user_agent='',
            resource='',
            action='',
            result='',
            severity=None,
            details={}
        )
        
        with pytest.raises(AnalysisError):
            await threat_detector.analyze_event(invalid_event)
        
        # 测试无效的威胁模式
        invalid_pattern = ThreatPattern(
            pattern_id='',  # 空ID
            name='',
            description='',
            threat_type=None,
            severity=None,
            conditions=[],
            indicators=[]
        )
        
        with pytest.raises(ValueError):
            await threat_detector.add_threat_pattern(invalid_pattern)

    async def test_threat_detector_cleanup(self, threat_detector, sample_security_events):
        """测试威胁检测器清理"""
        # 分析一些事件
        for event in sample_security_events:
            await threat_detector.analyze_event(event)
        
        # 验证检测器正在运行
        assert threat_detector.is_initialized
        
        # 清理检测器
        await threat_detector.cleanup()
        
        # 验证资源已清理（具体行为取决于实现）

# -*- coding: utf-8 -*-
"""
适配器验证服务测试

测试新架构的适配器验证服务功能
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any, List

from zishu.adapters.core.services.validation_service import (
    AdapterValidationService, ValidationRule, ValidationResult, ValidationIssue,
    ValidationSeverity, ValidationCategory, AdapterClassRule, AdapterIdentityRule
)
from zishu.adapters.core.services.base import ServiceStatus, HealthCheckResult
from zishu.adapters.core.types import (
    AdapterRegistration, AdapterIdentity, AdapterConfiguration,
    AdapterStatus, AdapterType, Priority, SecurityLevel
)
from zishu.adapters.core.events import EventBus, Event, EventType

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestValidationRule(ValidationRule):
    """测试用验证规则"""
    
    def __init__(self, rule_id: str = "test_rule"):
        super().__init__(rule_id, ValidationCategory.CONFIGURATION, ValidationSeverity.WARNING)
        self.validation_called = False
    
    async def validate(self, registration: AdapterRegistration) -> List[ValidationIssue]:
        self.validation_called = True
        return []


class TestAdapterValidationService:
    """适配器验证服务测试类"""

    @pytest_asyncio.fixture
    async def event_bus(self):
        """创建事件总线mock"""
        event_bus = Mock(spec=EventBus)
        event_bus.emit = AsyncMock()
        return event_bus

    @pytest.fixture
    def validation_config(self):
        """创建验证服务配置"""
        return {
            'cache_ttl': 300,
            'max_cache_size': 100,
            'enable_async_validation': True,
            'validation_timeout': 10.0
        }

    @pytest_asyncio.fixture
    async def validation_service(self, event_bus, validation_config):
        """创建验证服务实例"""
        service = AdapterValidationService(event_bus=event_bus, config=validation_config)
        await service.initialize()
        await service.start()
        yield service
        await service.stop()

    @pytest.fixture
    def test_registration(self):
        """创建测试适配器注册信息"""
        identity = AdapterTestUtils.create_test_adapter_identity(
            adapter_id="test-adapter-001",
            name="Test Adapter",
            adapter_type=AdapterType.SOFT
        )
        
        config = AdapterTestUtils.create_test_adapter_configuration(
            config={"test_param": "test_value"},
            security_level=SecurityLevel.INTERNAL
        )
        
        # 创建适配器类mock
        class MockAdapter:
            def __init__(self, config):
                self.config = config
            
            async def initialize(self):
                return True
            
            async def cleanup(self):
                return True
            
            async def process(self, input_data, context):
                return {"result": "processed"}
        
        return AdapterTestUtils.create_test_adapter_registration(
            identity=identity,
            adapter_class=MockAdapter,
            configuration=config
        )

    @pytest.mark.asyncio
    async def test_service_initialization(self, event_bus, validation_config):
        """测试服务初始化"""
        service = AdapterValidationService(event_bus=event_bus, config=validation_config)
        
        # 验证初始状态
        assert service.name == "adapter_validation"
        assert service.status == ServiceStatus.CREATED
        assert service.config == validation_config
        
        # 初始化服务
        await service.initialize()
        assert service.status == ServiceStatus.READY
        
        # 验证默认规则已注册
        rules = await service.get_validation_rules()
        assert len(rules) > 0
        
        # 启动服务
        await service.start()
        assert service.status == ServiceStatus.RUNNING
        
        # 停止服务
        await service.stop()
        assert service.status == ServiceStatus.STOPPED

    @pytest.mark.asyncio
    async def test_validate_adapter_success(self, validation_service, test_registration, event_bus):
        """测试成功验证适配器"""
        # 执行验证
        result = await validation_service.validate_adapter(test_registration)
        
        # 验证结果
        assert isinstance(result, ValidationResult)
        assert result.adapter_id == test_registration.identity.adapter_id
        assert result.is_valid is True
        assert result.score >= 0.0
        assert isinstance(result.issues, list)
        
        # 验证事件发送（服务启动和验证完成两个事件）
        assert event_bus.emit.call_count >= 1
        # 检查最后一次调用是验证事件
        last_call = event_bus.emit.call_args_list[-1]
        call_args = last_call[0][0]
        assert call_args.event_type == EventType.ADAPTER_VALIDATED
        assert call_args.data['adapter_id'] == test_registration.identity.adapter_id
        assert call_args.data['is_valid'] is True

    @pytest.mark.asyncio
    async def test_validate_adapter_with_issues(self, validation_service, test_registration):
        """测试验证有问题的适配器"""
        # 注册一个会产生问题的验证规则
        class ProblematicRule(ValidationRule):
            def __init__(self):
                super().__init__("problematic_rule", ValidationCategory.SECURITY, ValidationSeverity.ERROR)
            
            async def validate(self, registration: AdapterRegistration) -> List[ValidationIssue]:
                return [ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Test validation issue",
                    suggestion="Fix the test issue"
                )]
        
        await validation_service.register_validation_rule(ProblematicRule())
        
        # 执行验证
        result = await validation_service.validate_adapter(test_registration)
        
        # 验证结果
        assert result.is_valid is False
        assert len(result.issues) > 0
        assert any(issue.message == "Test validation issue" for issue in result.issues)

    @pytest.mark.asyncio
    async def test_validation_caching(self, validation_service, test_registration):
        """测试验证结果缓存"""
        # 第一次验证
        result1 = await validation_service.validate_adapter(test_registration, use_cache=True)
        
        # 第二次验证（应该使用缓存）
        result2 = await validation_service.validate_adapter(test_registration, use_cache=True)
        
        # 验证结果相同
        assert result1.adapter_id == result2.adapter_id
        assert result1.is_valid == result2.is_valid
        assert result1.score == result2.score
        
        # 验证缓存命中
        cache_stats = await validation_service.get_cache_stats()
        assert cache_stats['size'] > 0

    @pytest.mark.asyncio
    async def test_validation_without_cache(self, validation_service, test_registration):
        """测试不使用缓存的验证"""
        # 执行验证（不使用缓存）
        result = await validation_service.validate_adapter(test_registration, use_cache=False)
        
        # 验证结果
        assert isinstance(result, ValidationResult)
        
        # 验证缓存为空
        cache_stats = await validation_service.get_cache_stats()
        assert cache_stats['size'] == 0

    @pytest.mark.asyncio
    async def test_register_custom_validation_rule(self, validation_service, test_registration):
        """测试注册自定义验证规则"""
        # 创建自定义规则
        custom_rule = TestValidationRule("custom_test_rule")
        
        # 注册规则
        await validation_service.register_validation_rule(custom_rule)
        
        # 验证规则已注册
        rules = await validation_service.get_validation_rules()
        assert "custom_test_rule" in rules
        
        # 执行验证
        await validation_service.validate_adapter(test_registration)
        
        # 验证自定义规则被调用
        assert custom_rule.validation_called is True

    @pytest.mark.asyncio
    async def test_unregister_validation_rule(self, validation_service):
        """测试注销验证规则"""
        # 注册规则
        test_rule = TestValidationRule("test_rule_to_remove")
        await validation_service.register_validation_rule(test_rule)
        
        # 验证规则存在
        rules = await validation_service.get_validation_rules()
        assert "test_rule_to_remove" in rules
        
        # 注销规则
        result = await validation_service.unregister_validation_rule("test_rule_to_remove")
        assert result is True
        
        # 验证规则已移除
        rules = await validation_service.get_validation_rules()
        assert "test_rule_to_remove" not in rules

    @pytest.mark.asyncio
    async def test_validation_timeout(self, event_bus):
        """测试验证超时"""
        # 创建超时配置
        config = {'validation_timeout': 0.1}  # 100ms
        service = AdapterValidationService(event_bus=event_bus, config=config)
        await service.initialize()
        await service.start()
        
        try:
            # 创建慢验证规则
            class SlowRule(ValidationRule):
                def __init__(self):
                    super().__init__("slow_rule", ValidationCategory.PERFORMANCE, ValidationSeverity.INFO)
                
                async def validate(self, registration: AdapterRegistration) -> List[ValidationIssue]:
                    await asyncio.sleep(0.2)  # 超过超时时间
                    return []
            
            await service.register_validation_rule(SlowRule())
            
            # 创建测试注册
            registration = AdapterTestUtils.create_test_adapter_registration()
            
            # 执行验证（应该超时，返回超时ValidationResult而不是抛出异常）
            result = await service.validate_adapter(registration)
            
            # 验证返回的是超时错误结果
            assert result.is_valid is False
            assert len(result.issues) > 0
            assert any("timeout" in issue.message.lower() for issue in result.issues)
                
        finally:
            await service.stop()

    @pytest.mark.asyncio
    async def test_health_check(self, validation_service):
        """测试健康检查"""
        health_result = await validation_service.health_check()
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert health_result.details["service_name"] == "adapter_validation"
        assert "validation_rules_count" in health_result.details
        assert "cache_size" in health_result.details

    @pytest.mark.asyncio
    async def test_service_metrics(self, validation_service, test_registration):
        """测试服务指标"""
        # 执行一些验证操作
        await validation_service.validate_adapter(test_registration)
        await validation_service.validate_adapter(test_registration)
        
        # 获取指标
        metrics = validation_service.get_metrics()
        assert metrics.request_count >= 2
        assert metrics.last_activity is not None

    @pytest.mark.asyncio
    async def test_cache_cleanup(self, event_bus):
        """测试缓存清理"""
        config = {
            'cache_ttl': 0.1,  # 100ms TTL
            'max_cache_size': 10
        }
        service = AdapterValidationService(event_bus=event_bus, config=config)
        await service.initialize()
        await service.start()
        
        try:
            # 创建测试注册
            registration = AdapterTestUtils.create_test_adapter_registration()
            
            # 执行验证以填充缓存
            await service.validate_adapter(registration, use_cache=True)
            
            # 验证缓存有内容
            cache_stats = await service.get_cache_stats()
            assert cache_stats['size'] > 0
            
            # 等待缓存过期
            await asyncio.sleep(0.2)
            
            # 触发清理
            await service._cleanup_expired_cache()
            
            # 验证缓存已清理
            cache_stats = await service.get_cache_stats()
            assert cache_stats['size'] == 0
            
        finally:
            await service.stop()

    @pytest.mark.asyncio
    async def test_concurrent_validation(self, validation_service):
        """测试并发验证"""
        # 创建多个测试注册
        registrations = []
        for i in range(5):
            identity = AdapterTestUtils.create_test_adapter_identity(adapter_id=f"adapter-{i}")
            config = AdapterTestUtils.create_test_adapter_configuration()
            registration = AdapterTestUtils.create_test_adapter_registration(
                identity=identity, configuration=config
            )
            registrations.append(registration)
        
        # 并发验证
        tasks = [validation_service.validate_adapter(reg) for reg in registrations]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 验证所有结果
        assert len(results) == 5
        for result in results:
            assert isinstance(result, ValidationResult)
            assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_default_validation_rules(self, validation_service):
        """测试默认验证规则"""
        rules = await validation_service.get_validation_rules()
        
        # 验证包含默认规则
        expected_rules = ["adapter_class", "adapter_identity"]
        for rule_id in expected_rules:
            assert rule_id in rules

    @pytest.mark.asyncio
    async def test_adapter_class_rule(self):
        """测试适配器类验证规则"""
        rule = AdapterClassRule()
        
        # 测试有效的适配器类
        valid_registration = AdapterTestUtils.create_test_adapter_registration()
        issues = await rule.validate(valid_registration)
        assert len(issues) == 0
        
        # 测试无效的适配器类（None）
        invalid_registration = AdapterTestUtils.create_test_adapter_registration()
        invalid_registration.adapter_class = None
        issues = await rule.validate(invalid_registration)
        assert len(issues) > 0
        assert any("required" in issue.message for issue in issues)

    @pytest.mark.asyncio
    async def test_adapter_identity_rule(self):
        """测试适配器身份验证规则"""
        rule = AdapterIdentityRule()
        
        # 测试有效的身份信息
        valid_registration = AdapterTestUtils.create_test_adapter_registration()
        issues = await rule.validate(valid_registration)
        assert len(issues) == 0
        
        # 测试无效的身份信息
        invalid_registration = AdapterTestUtils.create_test_adapter_registration()
        invalid_registration.identity = None
        issues = await rule.validate(invalid_registration)
        assert len(issues) > 0

    @pytest.mark.asyncio
    async def test_validation_result_scoring(self, validation_service, test_registration):
        """测试验证结果评分"""
        # 注册不同严重性的规则
        class InfoRule(ValidationRule):
            def __init__(self):
                super().__init__("info_rule", ValidationCategory.CONFIGURATION, ValidationSeverity.INFO)
            
            async def validate(self, registration: AdapterRegistration) -> List[ValidationIssue]:
                return [ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Info issue"
                )]
        
        class ErrorRule(ValidationRule):
            def __init__(self):
                super().__init__("error_rule", ValidationCategory.SECURITY, ValidationSeverity.ERROR)
            
            async def validate(self, registration: AdapterRegistration) -> List[ValidationIssue]:
                return [ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Error issue"
                )]
        
        await validation_service.register_validation_rule(InfoRule())
        await validation_service.register_validation_rule(ErrorRule())
        
        # 执行验证
        result = await validation_service.validate_adapter(test_registration)
        
        # 验证评分受问题严重性影响（评分是0-100分制）
        assert result.score < 100.0  # 有问题时评分应该降低
        assert len(result.issues) >= 2  # 至少包含我们添加的2个问题

    @pytest.mark.asyncio
    async def test_error_handling(self, validation_service):
        """测试错误处理"""
        # 测试无效参数
        with pytest.raises(Exception):
            await validation_service.validate_adapter(None)
        
        # 测试服务未运行时的操作
        await validation_service.stop()
        
        with pytest.raises(RuntimeError):
            registration = AdapterTestUtils.create_test_adapter_registration()
            await validation_service.validate_adapter(registration)

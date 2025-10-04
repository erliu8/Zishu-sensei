# -*- coding: utf-8 -*-
"""
安全服务单元测试
测试核心安全服务的功能和行为
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone

# 测试工具导入
from tests.utils.adapter_test_utils import (
    SecurityTestUtils, AdapterTestUtils, MockFactory
)

# 项目导入
try:
    from zishu.adapters.core.security.security_service import (
        AdapterSecurityService, SecurityServiceConfig, SecurityContext,
        SecurityLevel, SecurityPolicy, SecurityViolation, SecurityViolationType
    )
    from zishu.adapters.core.security.context_manager import (
        SecurityContextManager, ContextValidationResult, SecuritySession
    )
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    pytest.skip("Security modules not available", allow_module_level=True)


@pytest.mark.unit
@pytest.mark.security
class TestAdapterSecurityService:
    """适配器安全服务测试类"""
    
    @pytest.fixture
    def security_config(self):
        """安全服务配置fixture"""
        return SecurityServiceConfig(
            default_security_level=SecurityLevel.INTERNAL,
            enable_audit_logging=True,
            enable_threat_detection=True,
            enable_code_analysis=True,
            max_session_duration=3600,
            session_cleanup_interval=300,
            blocked_patterns=[
                r'import\s+os',
                r'exec\s*\(',
                r'eval\s*\(',
                r'__import__'
            ]
        )
    
    @pytest.fixture
    def mock_event_bus(self):
        """模拟事件总线fixture"""
        return MockFactory.create_mock_event_bus()
    
    @pytest.fixture
    def security_service(self, security_config, mock_event_bus):
        """安全服务fixture"""
        return AdapterSecurityService(
            config=security_config,
            event_bus=mock_event_bus
        )
    
    @pytest.mark.asyncio
    async def test_security_service_initialization(self, security_service):
        """测试安全服务初始化"""
        # 测试初始化
        await security_service.initialize()
        
        # 验证初始化状态
        assert security_service.is_initialized
        assert security_service.config is not None
        assert security_service.context_manager is not None
        
    @pytest.mark.asyncio
    async def test_create_security_context(self, security_service):
        """测试创建安全上下文"""
        await security_service.initialize()
        
        # 创建安全上下文
        context = await security_service.create_security_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read", "write"],
            security_level=SecurityLevel.INTERNAL
        )
        
        # 验证上下文
        assert isinstance(context, SecurityContext)
        assert context.user_id == "test_user"
        assert context.adapter_id == "test_adapter"
        assert context.permissions == ["read", "write"]
        assert context.security_level == SecurityLevel.INTERNAL
        assert context.session_id is not None
        assert context.created_at is not None
    
    @pytest.mark.asyncio
    async def test_validate_security_context(self, security_service):
        """测试验证安全上下文"""
        await security_service.initialize()
        
        # 创建有效上下文
        valid_context = await security_service.create_security_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read"],
            security_level=SecurityLevel.INTERNAL
        )
        
        # 验证有效上下文
        validation_result = await security_service.validate_security_context(valid_context)
        assert validation_result.is_valid
        assert len(validation_result.violations) == 0
        
        # 创建无效上下文（过期）
        invalid_context = SecurityContext(
            user_id="test_user",
            adapter_id="test_adapter",
            session_id="expired_session",
            permissions=["read"],
            security_level=SecurityLevel.INTERNAL,
            created_at=datetime.now(timezone.utc).timestamp() - 7200,  # 2小时前
            expires_at=datetime.now(timezone.utc).timestamp() - 3600   # 1小时前过期
        )
        
        # 验证无效上下文
        validation_result = await security_service.validate_security_context(invalid_context)
        assert not validation_result.is_valid
        assert len(validation_result.violations) > 0
    
    @pytest.mark.asyncio
    async def test_check_permission(self, security_service):
        """测试权限检查"""
        await security_service.initialize()
        
        # 创建安全上下文
        context = await security_service.create_security_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read", "write"],
            security_level=SecurityLevel.INTERNAL
        )
        
        # 测试有权限的操作
        has_read_permission = await security_service.check_permission(
            context, "read", "test_resource"
        )
        assert has_read_permission
        
        has_write_permission = await security_service.check_permission(
            context, "write", "test_resource"
        )
        assert has_write_permission
        
        # 测试无权限的操作
        has_delete_permission = await security_service.check_permission(
            context, "delete", "test_resource"
        )
        assert not has_delete_permission
    
    @pytest.mark.asyncio
    async def test_analyze_code_security(self, security_service):
        """测试代码安全分析"""
        await security_service.initialize()
        
        # 测试安全代码
        safe_codes = SecurityTestUtils.create_safe_code_samples()
        for code in safe_codes:
            analysis_result = await security_service.analyze_code_security(code)
            assert analysis_result.is_safe
            assert len(analysis_result.violations) == 0
        
        # 测试恶意代码
        malicious_codes = SecurityTestUtils.create_malicious_code_samples()
        for code in malicious_codes:
            analysis_result = await security_service.analyze_code_security(code)
            assert not analysis_result.is_safe
            assert len(analysis_result.violations) > 0
    
    @pytest.mark.asyncio
    async def test_security_violation_handling(self, security_service, mock_event_bus):
        """测试安全违规处理"""
        await security_service.initialize()
        
        # 创建安全违规
        violation = SecurityViolation(
            violation_type=SecurityViolationType.CODE_INJECTION,
            severity="high",
            description="Detected code injection attempt",
            context={"code": "exec('malicious code')"},
            user_id="test_user",
            adapter_id="test_adapter"
        )
        
        # 处理违规
        await security_service.handle_security_violation(violation)
        
        # 验证事件发送
        mock_event_bus.emit.assert_called()
        
        # 验证违规记录
        violations = await security_service.get_security_violations(
            user_id="test_user",
            limit=10
        )
        assert len(violations) > 0
        assert violations[0].violation_type == SecurityViolationType.CODE_INJECTION
    
    @pytest.mark.asyncio
    async def test_security_session_management(self, security_service):
        """测试安全会话管理"""
        await security_service.initialize()
        
        # 创建会话
        session_id = await security_service.create_security_session(
            user_id="test_user",
            permissions=["read", "write"],
            duration=1800  # 30分钟
        )
        
        assert session_id is not None
        
        # 验证会话存在
        session_exists = await security_service.validate_security_session(session_id)
        assert session_exists
        
        # 获取会话信息
        session_info = await security_service.get_security_session(session_id)
        assert session_info is not None
        assert session_info.user_id == "test_user"
        assert "read" in session_info.permissions
        assert "write" in session_info.permissions
        
        # 销毁会话
        await security_service.destroy_security_session(session_id)
        
        # 验证会话已销毁
        session_exists = await security_service.validate_security_session(session_id)
        assert not session_exists
    
    @pytest.mark.asyncio
    async def test_security_audit_logging(self, security_service):
        """测试安全审计日志"""
        await security_service.initialize()
        
        # 记录安全事件
        await security_service.audit_security_event(
            event_type="authentication",
            user_id="test_user",
            adapter_id="test_adapter",
            details={"action": "login", "success": True},
            severity="info"
        )
        
        # 获取审计日志
        audit_logs = await security_service.get_audit_logs(
            user_id="test_user",
            event_type="authentication",
            limit=10
        )
        
        assert len(audit_logs) > 0
        assert audit_logs[0]["event_type"] == "authentication"
        assert audit_logs[0]["user_id"] == "test_user"
    
    @pytest.mark.asyncio
    async def test_security_policy_enforcement(self, security_service):
        """测试安全策略执行"""
        await security_service.initialize()
        
        # 创建安全策略
        policy = SecurityPolicy(
            name="test_policy",
            rules=[
                {"resource": "test_adapter", "action": "read", "effect": "allow"},
                {"resource": "test_adapter", "action": "write", "effect": "deny"},
                {"resource": "*", "action": "delete", "effect": "deny"}
            ],
            conditions={
                "time_range": {"start": "09:00", "end": "17:00"},
                "ip_whitelist": ["127.0.0.1", "192.168.1.0/24"]
            }
        )
        
        # 应用策略
        await security_service.apply_security_policy(policy)
        
        # 测试策略执行
        context = await security_service.create_security_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read", "write", "delete"],
            security_level=SecurityLevel.INTERNAL
        )
        
        # 测试允许的操作
        can_read = await security_service.check_permission(
            context, "read", "test_adapter"
        )
        assert can_read
        
        # 测试拒绝的操作
        can_write = await security_service.check_permission(
            context, "write", "test_adapter"
        )
        assert not can_write
        
        can_delete = await security_service.check_permission(
            context, "delete", "any_resource"
        )
        assert not can_delete
    
    @pytest.mark.asyncio
    async def test_security_service_cleanup(self, security_service):
        """测试安全服务清理"""
        await security_service.initialize()
        
        # 创建一些会话和上下文
        session_id = await security_service.create_security_session(
            user_id="test_user",
            permissions=["read"],
            duration=1800
        )
        
        # 执行清理
        await security_service.cleanup()
        
        # 验证清理结果
        assert not security_service.is_initialized
        
        # 验证会话已清理
        session_exists = await security_service.validate_security_session(session_id)
        assert not session_exists


@pytest.mark.unit
@pytest.mark.security
class TestSecurityContextManager:
    """安全上下文管理器测试类"""
    
    @pytest.fixture
    def context_manager(self):
        """上下文管理器fixture"""
        return SecurityContextManager()
    
    @pytest.mark.asyncio
    async def test_context_creation_and_validation(self, context_manager):
        """测试上下文创建和验证"""
        # 创建上下文
        context = await context_manager.create_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read", "write"],
            security_level=SecurityLevel.INTERNAL
        )
        
        assert context is not None
        assert context.user_id == "test_user"
        assert context.adapter_id == "test_adapter"
        
        # 验证上下文
        validation_result = await context_manager.validate_context(context)
        assert validation_result.is_valid
        assert len(validation_result.violations) == 0
    
    @pytest.mark.asyncio
    async def test_context_expiration(self, context_manager):
        """测试上下文过期"""
        # 创建已过期的上下文
        expired_context = SecurityContext(
            user_id="test_user",
            adapter_id="test_adapter",
            session_id="test_session",
            permissions=["read"],
            security_level=SecurityLevel.INTERNAL,
            created_at=datetime.now(timezone.utc).timestamp() - 7200,  # 2小时前
            expires_at=datetime.now(timezone.utc).timestamp() - 3600   # 1小时前过期
        )
        
        # 验证过期上下文
        validation_result = await context_manager.validate_context(expired_context)
        assert not validation_result.is_valid
        assert any("expired" in violation.lower() for violation in validation_result.violations)
    
    @pytest.mark.asyncio
    async def test_context_cleanup(self, context_manager):
        """测试上下文清理"""
        # 创建多个上下文
        contexts = []
        for i in range(5):
            context = await context_manager.create_context(
                user_id=f"test_user_{i}",
                adapter_id=f"test_adapter_{i}",
                permissions=["read"],
                security_level=SecurityLevel.INTERNAL
            )
            contexts.append(context)
        
        # 执行清理
        cleaned_count = await context_manager.cleanup_expired_contexts()
        
        # 验证清理结果（新创建的上下文不应该被清理）
        assert cleaned_count == 0
        
        # 验证上下文仍然有效
        for context in contexts:
            validation_result = await context_manager.validate_context(context)
            assert validation_result.is_valid


@pytest.mark.unit
@pytest.mark.security
class TestSecurityIntegration:
    """安全系统集成测试"""
    
    @pytest.fixture
    def integrated_security_system(self):
        """集成安全系统fixture"""
        config = SecurityServiceConfig(
            default_security_level=SecurityLevel.INTERNAL,
            enable_audit_logging=True,
            enable_threat_detection=True,
            enable_code_analysis=True
        )
        
        event_bus = MockFactory.create_mock_event_bus()
        security_service = AdapterSecurityService(config=config, event_bus=event_bus)
        
        return {
            "security_service": security_service,
            "event_bus": event_bus,
            "config": config
        }
    
    @pytest.mark.asyncio
    async def test_end_to_end_security_workflow(self, integrated_security_system):
        """测试端到端安全工作流"""
        security_service = integrated_security_system["security_service"]
        
        # 1. 初始化安全服务
        await security_service.initialize()
        
        # 2. 创建用户会话
        session_id = await security_service.create_security_session(
            user_id="test_user",
            permissions=["read", "write"],
            duration=1800
        )
        
        # 3. 创建安全上下文
        context = await security_service.create_security_context(
            user_id="test_user",
            adapter_id="test_adapter",
            permissions=["read", "write"],
            security_level=SecurityLevel.INTERNAL
        )
        
        # 4. 验证权限
        can_read = await security_service.check_permission(
            context, "read", "test_resource"
        )
        assert can_read
        
        # 5. 分析代码安全性
        safe_code = "print('Hello, World!')"
        analysis_result = await security_service.analyze_code_security(safe_code)
        assert analysis_result.is_safe
        
        # 6. 处理恶意代码
        malicious_code = "import os; os.system('rm -rf /')"
        analysis_result = await security_service.analyze_code_security(malicious_code)
        assert not analysis_result.is_safe
        
        # 7. 记录审计事件
        await security_service.audit_security_event(
            event_type="code_analysis",
            user_id="test_user",
            adapter_id="test_adapter",
            details={"code_safe": False, "violations": len(analysis_result.violations)},
            severity="warning"
        )
        
        # 8. 清理会话
        await security_service.destroy_security_session(session_id)
        
        # 9. 验证清理结果
        session_exists = await security_service.validate_security_session(session_id)
        assert not session_exists
    
    @pytest.mark.asyncio
    async def test_concurrent_security_operations(self, integrated_security_system):
        """测试并发安全操作"""
        security_service = integrated_security_system["security_service"]
        await security_service.initialize()
        
        # 并发创建多个会话
        async def create_session(user_id):
            return await security_service.create_security_session(
                user_id=user_id,
                permissions=["read"],
                duration=1800
            )
        
        # 创建10个并发会话
        tasks = [create_session(f"user_{i}") for i in range(10)]
        session_ids = await asyncio.gather(*tasks)
        
        # 验证所有会话都创建成功
        assert len(session_ids) == 10
        assert all(session_id is not None for session_id in session_ids)
        
        # 并发验证会话
        async def validate_session(session_id):
            return await security_service.validate_security_session(session_id)
        
        validation_tasks = [validate_session(session_id) for session_id in session_ids]
        validation_results = await asyncio.gather(*validation_tasks)
        
        # 验证所有会话都有效
        assert all(validation_results)
        
        # 并发清理会话
        async def cleanup_session(session_id):
            return await security_service.destroy_security_session(session_id)
        
        cleanup_tasks = [cleanup_session(session_id) for session_id in session_ids]
        await asyncio.gather(*cleanup_tasks)
        
        # 验证所有会话都已清理
        final_validation_tasks = [validate_session(session_id) for session_id in session_ids]
        final_validation_results = await asyncio.gather(*final_validation_tasks)
        assert not any(final_validation_results)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

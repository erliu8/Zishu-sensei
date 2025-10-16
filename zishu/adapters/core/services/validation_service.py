"""
适配器验证服务

基于新架构的适配器验证和合规性检查服务。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set, Callable, Union
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum
import inspect
import re

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult
from ..types import (
    AdapterRegistration,
    AdapterIdentity,
    AdapterConfiguration,
    AdapterStatus,
    LifecycleState,
    EventType,
    Event,
    Priority,
)
from ..events import EventBus

logger = logging.getLogger(__name__)


class ValidationSeverity(str, Enum):
    """验证严重性级别"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationCategory(str, Enum):
    """验证类别"""

    STRUCTURE = "structure"  # 结构验证
    INTERFACE = "interface"  # 接口验证
    CONFIGURATION = "configuration"  # 配置验证
    SECURITY = "security"  # 安全验证
    PERFORMANCE = "performance"  # 性能验证
    COMPATIBILITY = "compatibility"  # 兼容性验证


@dataclass
class ValidationIssue:
    """验证问题"""

    category: ValidationCategory
    severity: ValidationSeverity
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None
    suggestion: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ValidationResult:
    """验证结果"""

    is_valid: bool
    adapter_id: Optional[str] = None
    issues: List[ValidationIssue] = field(default_factory=list)
    score: float = 0.0  # 验证分数 (0-100)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def summary(self) -> str:
        """获取验证结果摘要"""
        if self.is_valid:
            return f"Validation passed with score {self.score:.1f}"
        else:
            error_count = len([i for i in self.issues if i.severity == ValidationSeverity.ERROR])
            warning_count = len([i for i in self.issues if i.severity == ValidationSeverity.WARNING])
            return f"Validation failed: {error_count} errors, {warning_count} warnings"

    @property
    def has_errors(self) -> bool:
        """是否有错误"""
        return any(
            issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for issue in self.issues
        )

    @property
    def has_warnings(self) -> bool:
        """是否有警告"""
        return any(
            issue.severity == ValidationSeverity.WARNING for issue in self.issues
        )


class ValidationRule:
    """验证规则基类"""

    def __init__(
        self,
        name: str,
        category: ValidationCategory,
        severity: ValidationSeverity = ValidationSeverity.ERROR,
    ):
        self.name = name
        self.category = category
        self.severity = severity
        self.enabled = True

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        """执行验证"""
        raise NotImplementedError


class AdapterValidationService(AsyncService):
    """
    适配器验证服务

    负责：
    - 适配器注册验证
    - 配置合规性检查
    - 接口兼容性验证
    - 安全性检查
    - 性能基准验证
    """

    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """初始化验证服务"""
        super().__init__("adapter_validation", config)

        self._event_bus = event_bus
        self._validation_rules: Dict[str, ValidationRule] = {}
        self._validation_cache: Dict[str, ValidationResult] = {}
        self._validation_lock = asyncio.Lock()

        # 配置参数
        self._cache_ttl = self.config.get("cache_ttl", 300)  # 5分钟
        self._max_cache_size = self.config.get("max_cache_size", 1000)
        self._enable_async_validation = self.config.get("enable_async_validation", True)
        self._validation_timeout = self.config.get("validation_timeout", 30.0)

        # 清理任务
        self._cache_cleanup_task: Optional[asyncio.Task] = None

        logger.info(f"AdapterValidationService initialized with config: {self.config}")

    async def _initialize_impl(self) -> None:
        """初始化实现"""
        logger.info("Initializing adapter validation service...")

        # 注册默认验证规则
        await self._register_default_rules()

        # 清空缓存
        self._validation_cache.clear()

        logger.info(
            f"Adapter validation service initialized with {len(self._validation_rules)} rules"
        )

    async def _start_impl(self) -> None:
        """启动实现"""
        logger.info("Starting adapter validation service...")

        # 启动缓存清理任务
        self._cache_cleanup_task = asyncio.create_task(self._cache_cleanup_loop())

        # 发送服务启动事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STARTED,
                    source="adapter_validation_service",
                    data={
                        "service": "adapter_validation",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter validation service started")

    async def _stop_impl(self) -> None:
        """停止实现"""
        logger.info("Stopping adapter validation service...")

        # 停止清理任务
        if self._cache_cleanup_task:
            self._cache_cleanup_task.cancel()
            try:
                await self._cache_cleanup_task
            except asyncio.CancelledError:
                pass

        # 发送服务停止事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STOPPED,
                    source="adapter_validation_service",
                    data={
                        "service": "adapter_validation",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter validation service stopped")

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        try:
            # 检查基本状态
            if not self.is_running:
                return HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.UNHEALTHY,
                    message="Service is not running",
                )

            # 检查验证规则数量
            rules_count = len(self._validation_rules)
            if rules_count == 0:
                return HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.UNHEALTHY,
                    message="No validation rules loaded",
                )

            # 检查缓存大小
            cache_size = len(self._validation_cache)
            if cache_size > self._max_cache_size:
                return HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.DEGRADED,
                    message=f"Cache size exceeded: {cache_size}/{self._max_cache_size}",
                )

            return HealthCheckResult(
                is_healthy=True,
                status=ServiceHealth.HEALTHY,
                message=f"Validation service healthy with {rules_count} rules",
                details={
                    "service_name": self.name,
                    "rules_count": rules_count,
                    "cache_size": cache_size,
                    "cache_hit_rate": self._calculate_cache_hit_rate(),
                    "validation_rules_count": rules_count,
                },
            )

        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                status=ServiceHealth.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
            )

    async def validate_adapter(
        self, registration: AdapterRegistration, use_cache: bool = True
    ) -> ValidationResult:
        """验证适配器"""
        if not self.is_running:
            raise RuntimeError(f"Service '{self.name}' is not running")
        
        if not registration:
            raise ValueError("AdapterRegistration is required")
        
        adapter_id = registration.identity.adapter_id

        # 检查缓存
        if use_cache and adapter_id in self._validation_cache:
            cached_result = self._validation_cache[adapter_id]
            if self._is_cache_valid(cached_result):
                self._metrics.request_count += 1
                return cached_result

        # 执行验证
        try:
            if self._enable_async_validation:
                result = await asyncio.wait_for(
                    self._perform_validation(registration),
                    timeout=self._validation_timeout,
                )
            else:
                result = await self._perform_validation(registration)

            # 缓存结果
            if use_cache:
                await self._cache_result(adapter_id, result)

            # 更新指标
            self._metrics.request_count += 1
            self._metrics.last_activity = datetime.now(timezone.utc)

            # 发送验证事件
            if self._event_bus:
                await self._event_bus.emit(
                    Event(
                        event_type=EventType.ADAPTER_VALIDATED,
                        source="adapter_validation_service",
                        data={
                            "adapter_id": adapter_id,
                            "is_valid": result.is_valid,
                            "score": result.score,
                            "issues_count": len(result.issues),
                            "timestamp": datetime.now(timezone.utc),
                        },
                    )
                )

            return result

        except asyncio.TimeoutError:
            self._metrics.error_count += 1
            return ValidationResult(
                is_valid=False,
                adapter_id=adapter_id,
                issues=[
                    ValidationIssue(
                        category=ValidationCategory.PERFORMANCE,
                        severity=ValidationSeverity.ERROR,
                        message=f"Validation timeout after {self._validation_timeout}s",
                    )
                ],
                score=0.0,
            )
        except Exception as e:
            self._metrics.error_count += 1
            logger.error(f"Validation failed for adapter '{adapter_id}': {e}")
            return ValidationResult(
                is_valid=False,
                adapter_id=adapter_id,
                issues=[
                    ValidationIssue(
                        category=ValidationCategory.STRUCTURE,
                        severity=ValidationSeverity.CRITICAL,
                        message=f"Validation error: {str(e)}",
                    )
                ],
                score=0.0,
            )

    async def add_validation_rule(self, rule: ValidationRule) -> None:
        """添加验证规则"""
        async with self._validation_lock:
            self._validation_rules[rule.name] = rule
            logger.info(f"Added validation rule: {rule.name} ({rule.category})")

            # 清空缓存（规则变化可能影响验证结果）
            self._validation_cache.clear()

    async def register_validation_rule(self, rule: ValidationRule) -> None:
        """注册验证规则（别名方法）"""
        await self.add_validation_rule(rule)

    async def remove_validation_rule(self, rule_name: str) -> None:
        """移除验证规则"""
        async with self._validation_lock:
            if rule_name in self._validation_rules:
                del self._validation_rules[rule_name]
                logger.info(f"Removed validation rule: {rule_name}")

                # 清空缓存
                self._validation_cache.clear()

    async def unregister_validation_rule(self, rule_name: str) -> bool:
        """注销验证规则"""
        async with self._validation_lock:
            if rule_name in self._validation_rules:
                del self._validation_rules[rule_name]
                logger.info(f"Unregistered validation rule: {rule_name}")
                # 清空缓存
                self._validation_cache.clear()
                return True
            return False

    async def get_validation_rules(self) -> Dict[str, ValidationRule]:
        """获取所有验证规则"""
        return dict(self._validation_rules)

    async def clear_cache(self, adapter_id: Optional[str] = None) -> None:
        """清空验证缓存"""
        async with self._validation_lock:
            if adapter_id:
                self._validation_cache.pop(adapter_id, None)
                logger.info(f"Cleared validation cache for adapter: {adapter_id}")
            else:
                self._validation_cache.clear()
                logger.info("Cleared all validation cache")

    async def get_validation_stats(self) -> Dict[str, Any]:
        """获取验证统计信息"""
        return {
            "rules_count": len(self._validation_rules),
            "cache_size": len(self._validation_cache),
            "cache_hit_rate": self._calculate_cache_hit_rate(),
            "service_uptime": self.metrics.uptime,
            "validation_count": self.metrics.request_count,
            "error_count": self.metrics.error_count,
            "rules_by_category": self._get_rules_by_category(),
        }

    async def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        return {
            "size": len(self._validation_cache),
            "max_size": self._max_cache_size,
            "ttl": self._cache_ttl,
            "hit_rate": self._calculate_cache_hit_rate(),
        }

    def get_metrics(self):
        """获取服务指标"""
        return self._metrics

    # 内部方法

    async def _perform_validation(
        self, registration: AdapterRegistration
    ) -> ValidationResult:
        """执行验证"""
        all_issues = []
        total_score = 0.0
        rule_count = 0

        # 执行所有启用的验证规则
        for rule in self._validation_rules.values():
            if not rule.enabled:
                continue

            try:
                issues = await rule.validate(registration)
                all_issues.extend(issues)

                # 计算规则分数（无问题得满分）
                rule_score = (
                    100.0 if not issues else max(0.0, 100.0 - len(issues) * 10.0)
                )
                total_score += rule_score
                rule_count += 1

            except Exception as e:
                logger.error(f"Validation rule '{rule.name}' failed: {e}")
                all_issues.append(
                    ValidationIssue(
                        category=rule.category,
                        severity=ValidationSeverity.ERROR,
                        message=f"Rule execution failed: {str(e)}",
                        location=rule.name,
                    )
                )

        # 计算总分
        final_score = total_score / rule_count if rule_count > 0 else 0.0

        # 判断是否有效
        is_valid = not any(
            issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for issue in all_issues
        )

        return ValidationResult(
            is_valid=is_valid,
            adapter_id=registration.identity.adapter_id,
            issues=all_issues,
            score=final_score,
            metadata={
                "rules_executed": rule_count,
                "adapter_id": registration.identity.adapter_id,
                "adapter_type": registration.identity.adapter_type,
            },
        )

    async def _register_default_rules(self) -> None:
        """注册默认验证规则"""
        # 结构验证规则
        await self.add_validation_rule(AdapterClassRule())
        await self.add_validation_rule(AdapterIdentityRule())
        await self.add_validation_rule(AdapterConfigurationRule())
        await self.add_validation_rule(AdapterInheritanceRule())

        # 接口验证规则
        await self.add_validation_rule(RequiredMethodsRule())
        await self.add_validation_rule(MethodSignatureRule())
        await self.add_validation_rule(AsyncCompatibilityRule())

        # 配置验证规则
        await self.add_validation_rule(ConfigurationSchemaRule())
        await self.add_validation_rule(CapabilitiesRule())
        await self.add_validation_rule(DependencyRule())

        # 安全验证规则
        await self.add_validation_rule(SecurityConfigRule())
        await self.add_validation_rule(PermissionRule())

        # 性能验证规则
        await self.add_validation_rule(PerformanceRule())
        await self.add_validation_rule(ResourceLimitRule())

        # 兼容性验证规则
        await self.add_validation_rule(VersionCompatibilityRule())
        await self.add_validation_rule(PlatformCompatibilityRule())

        logger.info(
            "Enhanced validation rules registered: 16 rules across 6 categories"
        )

    async def _cache_result(self, adapter_id: str, result: ValidationResult) -> None:
        """缓存验证结果"""
        async with self._validation_lock:
            # 检查缓存大小限制
            if len(self._validation_cache) >= self._max_cache_size:
                # 移除最旧的缓存项
                oldest_key = min(
                    self._validation_cache.keys(),
                    key=lambda k: self._validation_cache[k].timestamp,
                )
                del self._validation_cache[oldest_key]

            self._validation_cache[adapter_id] = result

    def _is_cache_valid(self, result: ValidationResult) -> bool:
        """检查缓存是否有效"""
        age = (datetime.now(timezone.utc) - result.timestamp).total_seconds()
        return age < self._cache_ttl

    def _calculate_cache_hit_rate(self) -> float:
        """计算缓存命中率"""
        # 简化实现，实际应该跟踪命中和未命中次数
        return 0.8  # 假设80%命中率

    def _get_rules_by_category(self) -> Dict[str, int]:
        """按类别统计规则数量"""
        category_count = {}
        for rule in self._validation_rules.values():
            category = rule.category.value
            category_count[category] = category_count.get(category, 0) + 1
        return category_count

    async def _cache_cleanup_loop(self) -> None:
        """缓存清理循环"""
        logger.info("Starting validation cache cleanup loop")

        while self.is_running:
            try:
                await self._cleanup_expired_cache()
                await asyncio.sleep(self._cache_ttl / 2)  # 每半个TTL清理一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cache cleanup error: {e}")
                await asyncio.sleep(60)  # 出错时等待1分钟

        logger.info("Validation cache cleanup loop stopped")

    async def _cleanup_expired_cache(self) -> None:
        """清理过期缓存"""
        async with self._validation_lock:
            expired_keys = []
            current_time = datetime.now(timezone.utc)

            for key, result in self._validation_cache.items():
                age = (current_time - result.timestamp).total_seconds()
                if age > self._cache_ttl:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._validation_cache[key]

            if expired_keys:
                logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")


# 默认验证规则实现


class AdapterClassRule(ValidationRule):
    """适配器类验证规则"""

    def __init__(self):
        super().__init__(
            "adapter_class", ValidationCategory.STRUCTURE, ValidationSeverity.CRITICAL
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []

        if not registration.adapter_class:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter class is required",
                    suggestion="Provide a valid adapter class",
                )
            )
        elif not inspect.isclass(registration.adapter_class):
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter class must be a class type",
                    suggestion="Ensure the adapter_class is a proper Python class",
                )
            )

        return issues


class AdapterIdentityRule(ValidationRule):
    """适配器身份验证规则"""

    def __init__(self):
        super().__init__(
            "adapter_identity", ValidationCategory.STRUCTURE, ValidationSeverity.ERROR
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        identity = registration.identity

        if not identity:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter identity is required",
                    suggestion="Provide adapter identity information",
                )
            )
            return issues

        # 检查ID
        if not identity.adapter_id:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter ID is required",
                    suggestion="Provide a unique adapter ID",
                )
            )
        elif not re.match(r"^[a-zA-Z0-9_-]+$", identity.adapter_id):
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.WARNING,
                    message="Adapter ID contains invalid characters",
                    suggestion="Use only alphanumeric characters, underscores, and hyphens",
                )
            )

        # 检查类型
        if not identity.adapter_type:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter type is required",
                    suggestion="Specify the adapter type",
                )
            )

        # 检查版本
        if not identity.version:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.WARNING,
                    message="Adapter version is not specified",
                    suggestion="Provide version information for better compatibility tracking",
                )
            )

        return issues


class AdapterConfigurationRule(ValidationRule):
    """适配器配置验证规则"""

    def __init__(self):
        super().__init__(
            "adapter_configuration",
            ValidationCategory.CONFIGURATION,
            ValidationSeverity.ERROR,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter configuration is required",
                    suggestion="Provide adapter configuration",
                )
            )
            return issues

        # 检查必要的配置字段
        if not config.name:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.WARNING,
                    message="Adapter name is not specified",
                    suggestion="Provide a descriptive name for the adapter",
                )
            )

        if not config.capabilities:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.WARNING,
                    message="No capabilities specified",
                    suggestion="Define adapter capabilities for better discovery",
                )
            )

        return issues


class RequiredMethodsRule(ValidationRule):
    """必需方法验证规则"""

    def __init__(self):
        super().__init__(
            "required_methods", ValidationCategory.INTERFACE, ValidationSeverity.ERROR
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        adapter_class = registration.adapter_class

        if not adapter_class:
            return issues

        # 检查必需的方法
        required_methods = ["initialize", "cleanup"]  # 基本必需方法

        for method_name in required_methods:
            if not hasattr(adapter_class, method_name):
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=self.severity,
                        message=f"Required method '{method_name}' is missing",
                        suggestion=f"Implement the '{method_name}' method in your adapter class",
                    )
                )

        return issues


class MethodSignatureRule(ValidationRule):
    """方法签名验证规则"""

    def __init__(self):
        super().__init__(
            "method_signature", ValidationCategory.INTERFACE, ValidationSeverity.WARNING
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        adapter_class = registration.adapter_class

        if not adapter_class:
            return issues

        # 检查方法签名（简化实现）
        if hasattr(adapter_class, "initialize"):
            init_method = getattr(adapter_class, "initialize")
            if not asyncio.iscoroutinefunction(init_method):
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=self.severity,
                        message="'initialize' method should be async",
                        suggestion="Make the initialize method async for better performance",
                    )
                )

        return issues


class ConfigurationSchemaRule(ValidationRule):
    """配置模式验证规则"""

    def __init__(self):
        super().__init__(
            "configuration_schema",
            ValidationCategory.CONFIGURATION,
            ValidationSeverity.WARNING,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config or not config.config:
            return issues

        # 检查配置设置的合理性
        settings = config.config

        # 检查超时设置
        if "timeout" in settings:
            timeout = settings["timeout"]
            if isinstance(timeout, (int, float)) and timeout <= 0:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.WARNING,
                        message="Timeout value should be positive",
                        suggestion="Set a positive timeout value",
                    )
                )

        return issues


class CapabilitiesRule(ValidationRule):
    """能力验证规则"""

    def __init__(self):
        super().__init__(
            "capabilities", ValidationCategory.CONFIGURATION, ValidationSeverity.INFO
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config or not config.capabilities:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="No capabilities defined",
                    suggestion="Define adapter capabilities for better discoverability",
                )
            )

        return issues


class SecurityConfigRule(ValidationRule):
    """安全配置验证规则"""

    def __init__(self):
        super().__init__(
            "security_config", ValidationCategory.SECURITY, ValidationSeverity.WARNING
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config or not config.config:
            return issues

        settings = config.config

        # 检查敏感信息是否明文存储
        sensitive_keys = [
            "password",
            "secret",
            "key",
            "token",
            "api_key",
            "private_key",
        ]
        for key, value in settings.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                if isinstance(value, str) and len(value) > 0:
                    # 检查是否看起来像明文（没有加密或哈希的特征）
                    if not self._appears_encrypted(value):
                        issues.append(
                            ValidationIssue(
                                category=self.category,
                                severity=ValidationSeverity.ERROR,
                                message=f"Potentially sensitive configuration '{key}' appears to be stored in plaintext",
                                suggestion="Encrypt sensitive configuration values or use environment variables",
                                location=key,
                            )
                        )

        # 检查是否启用了安全功能
        security_features = [
            "ssl",
            "tls",
            "encryption",
            "authentication",
            "authorization",
        ]
        has_security = any(
            feature in str(settings).lower() for feature in security_features
        )

        if not has_security:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message="No explicit security features detected in configuration",
                    suggestion="Consider adding SSL/TLS, authentication, or encryption settings",
                )
            )

        return issues

    def _appears_encrypted(self, value: str) -> bool:
        """检查字符串是否看起来像加密的"""
        # 简单启发式：长度、字符集、格式
        if len(value) < 8:
            return False

        # 检查是否有加密标识符
        encrypted_indicators = ["$", "==", "encrypted:", "hash:", "base64:"]
        if any(indicator in value for indicator in encrypted_indicators):
            return True

        # 检查是否有随机字符串的特征（大小写混合，数字，特殊字符）
        has_upper = any(c.isupper() for c in value)
        has_lower = any(c.islower() for c in value)
        has_digit = any(c.isdigit() for c in value)
        has_special = any(not c.isalnum() for c in value)

        return sum([has_upper, has_lower, has_digit, has_special]) >= 3


class AdapterInheritanceRule(ValidationRule):
    """适配器继承验证规则"""

    def __init__(self):
        super().__init__(
            "adapter_inheritance",
            ValidationCategory.STRUCTURE,
            ValidationSeverity.WARNING,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        adapter_class = registration.adapter_class

        if not adapter_class:
            return issues

        # 检查是否继承自推荐的基类
        base_classes = [cls.__name__ for cls in adapter_class.__mro__[1:]]  # 排除自身

        # 推荐的基类名称
        recommended_bases = [
            "BaseAdapter",
            "AdapterBase",
            "AbstractAdapter",
            "AsyncAdapter",
        ]

        has_recommended_base = any(base in recommended_bases for base in base_classes)

        if not has_recommended_base and len(base_classes) <= 1:  # 只继承object
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Adapter does not inherit from a recommended base class",
                    suggestion=f"Consider inheriting from one of: {', '.join(recommended_bases)}",
                    details={"current_bases": base_classes},
                )
            )

        # 检查多重继承
        if len(base_classes) > 3:  # 排除object，如果有3个以上基类可能过复杂
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message="Complex inheritance hierarchy detected",
                    suggestion="Consider simplifying inheritance hierarchy",
                    details={"inheritance_depth": len(base_classes)},
                )
            )

        return issues


class AsyncCompatibilityRule(ValidationRule):
    """异步兼容性验证规则"""

    def __init__(self):
        super().__init__(
            "async_compatibility",
            ValidationCategory.INTERFACE,
            ValidationSeverity.ERROR,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        adapter_class = registration.adapter_class

        if not adapter_class:
            return issues

        # 检查关键方法的异步兼容性
        critical_methods = {
            "initialize": "Should be async for proper initialization",
            "cleanup": "Should be async for proper cleanup",
            "process": "Should be async for non-blocking processing",
            "execute": "Should be async for non-blocking execution",
        }

        for method_name, suggestion in critical_methods.items():
            if hasattr(adapter_class, method_name):
                method = getattr(adapter_class, method_name)
                if not asyncio.iscoroutinefunction(method):
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=self.severity,
                            message=f"Method '{method_name}' is not async",
                            suggestion=suggestion,
                            location=method_name,
                        )
                    )

        # 检查是否混合了同步和异步方法
        methods = [name for name in dir(adapter_class) if not name.startswith("_")]
        async_methods = []
        sync_methods = []

        for method_name in methods:
            try:
                method = getattr(adapter_class, method_name)
                if callable(method):
                    if asyncio.iscoroutinefunction(method):
                        async_methods.append(method_name)
                    else:
                        sync_methods.append(method_name)
            except:
                continue

        if async_methods and sync_methods:
            # 这是正常的，但给出信息
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message=f"Adapter mixes async ({len(async_methods)}) and sync ({len(sync_methods)}) methods",
                    suggestion="Ensure proper async/await usage in async methods",
                    details={
                        "async_methods": async_methods[:5],  # 只显示前5个
                        "sync_methods": sync_methods[:5],
                    },
                )
            )

        return issues


class DependencyRule(ValidationRule):
    """依赖验证规则"""

    def __init__(self):
        super().__init__(
            "dependency", ValidationCategory.CONFIGURATION, ValidationSeverity.WARNING
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config:
            return issues

        # 检查依赖声明
        dependencies = getattr(config, "dependencies", None) or config.config.get(
            "dependencies", []
        )

        if not dependencies:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message="No dependencies declared",
                    suggestion="Consider declaring dependencies for better dependency management",
                )
            )
        elif isinstance(dependencies, list):
            # 检查依赖格式
            for dep in dependencies:
                if isinstance(dep, str):
                    # 检查版本规范
                    if "==" not in dep and ">=" not in dep and "<=" not in dep:
                        issues.append(
                            ValidationIssue(
                                category=self.category,
                                severity=ValidationSeverity.WARNING,
                                message=f"Dependency '{dep}' has no version specification",
                                suggestion="Specify version constraints for dependencies",
                                location=f"dependency:{dep}",
                            )
                        )

        # 检查循环依赖（简单检查）
        adapter_id = registration.identity.adapter_id
        if isinstance(dependencies, list):
            for dep in dependencies:
                dep_name = dep.split("==")[0].split(">=")[0].split("<=")[0].strip()
                if dep_name == adapter_id:
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=ValidationSeverity.ERROR,
                            message="Self-dependency detected",
                            suggestion="Remove self-dependency",
                            location=f"dependency:{dep_name}",
                        )
                    )

        return issues


class PermissionRule(ValidationRule):
    """权限验证规则"""

    def __init__(self):
        super().__init__(
            "permission", ValidationCategory.SECURITY, ValidationSeverity.ERROR
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config:
            return issues

        # 检查权限声明
        permissions = getattr(
            config, "required_permissions", None
        ) or config.config.get("permissions", [])

        if not permissions:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message="No required permissions declared",
                    suggestion="Declare required permissions for security transparency",
                )
            )
        elif isinstance(permissions, list):
            # 检查高风险权限
            high_risk_permissions = [
                "admin",
                "root",
                "system",
                "file_write",
                "network_access",
                "database_write",
                "user_impersonation",
            ]

            for permission in permissions:
                if isinstance(permission, str):
                    for risk_perm in high_risk_permissions:
                        if risk_perm in permission.lower():
                            issues.append(
                                ValidationIssue(
                                    category=self.category,
                                    severity=ValidationSeverity.WARNING,
                                    message=f"High-risk permission requested: '{permission}'",
                                    suggestion="Ensure this permission is necessary and properly justified",
                                    location=f"permission:{permission}",
                                )
                            )

        return issues


class PerformanceRule(ValidationRule):
    """性能验证规则"""

    def __init__(self):
        super().__init__(
            "performance", ValidationCategory.PERFORMANCE, ValidationSeverity.WARNING
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration
        adapter_class = registration.adapter_class

        # 检查性能相关配置
        if config and config.config:
            settings = config.config

            # 检查超时设置
            timeout = settings.get("timeout", None)
            if timeout is None:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=self.severity,
                        message="No timeout configured",
                        suggestion="Set appropriate timeout values to prevent hanging operations",
                    )
                )
            elif isinstance(timeout, (int, float)) and timeout > 300:  # 5分钟
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message=f"Long timeout configured: {timeout}s",
                        suggestion="Consider if such a long timeout is necessary",
                    )
                )

            # 检查缓存设置
            cache_settings = [key for key in settings.keys() if "cache" in key.lower()]
            if not cache_settings:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message="No caching configuration detected",
                        suggestion="Consider adding caching for better performance",
                    )
                )

            # 检查批处理设置
            batch_settings = [key for key in settings.keys() if "batch" in key.lower()]
            batch_size = settings.get("batch_size", None)
            if batch_size and isinstance(batch_size, int):
                if batch_size > 1000:
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=ValidationSeverity.WARNING,
                            message=f"Large batch size configured: {batch_size}",
                            suggestion="Large batch sizes may cause memory issues",
                        )
                    )
                elif batch_size < 10:
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=ValidationSeverity.INFO,
                            message=f"Small batch size configured: {batch_size}",
                            suggestion="Small batch sizes may impact performance",
                        )
                    )

        # 检查方法数量（复杂度指标）
        if adapter_class:
            public_methods = [
                name
                for name in dir(adapter_class)
                if not name.startswith("_") and callable(getattr(adapter_class, name))
            ]

            if len(public_methods) > 20:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message=f"Adapter has many public methods: {len(public_methods)}",
                        suggestion="Consider splitting complex adapters into smaller components",
                        details={"method_count": len(public_methods)},
                    )
                )

        return issues


class ResourceLimitRule(ValidationRule):
    """资源限制验证规则"""

    def __init__(self):
        super().__init__(
            "resource_limit", ValidationCategory.PERFORMANCE, ValidationSeverity.WARNING
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config or not config.config:
            return issues

        settings = config.config

        # 检查内存限制
        memory_limit = settings.get("memory_limit", None)
        if memory_limit is None:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.INFO,
                    message="No memory limit configured",
                    suggestion="Consider setting memory limits to prevent resource exhaustion",
                )
            )
        elif isinstance(memory_limit, (int, float)):
            if memory_limit > 1024 * 1024 * 1024:  # 1GB
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.WARNING,
                        message=f"High memory limit configured: {memory_limit / (1024**3):.1f}GB",
                        suggestion="Ensure high memory usage is justified",
                    )
                )

        # 检查连接池限制
        connection_pool_size = settings.get("connection_pool_size", None)
        if connection_pool_size and isinstance(connection_pool_size, int):
            if connection_pool_size > 100:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.WARNING,
                        message=f"Large connection pool configured: {connection_pool_size}",
                        suggestion="Large connection pools may consume excessive resources",
                    )
                )
            elif connection_pool_size < 5:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message=f"Small connection pool configured: {connection_pool_size}",
                        suggestion="Small connection pools may limit concurrency",
                    )
                )

        # 检查线程/协程限制
        for limit_key in [
            "max_threads",
            "max_workers",
            "max_concurrent",
            "concurrency_limit",
        ]:
            limit_value = settings.get(limit_key, None)
            if limit_value and isinstance(limit_value, int):
                if limit_value > 200:
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=ValidationSeverity.WARNING,
                            message=f"High concurrency limit in {limit_key}: {limit_value}",
                            suggestion="High concurrency may overwhelm system resources",
                        )
                    )

        return issues


class VersionCompatibilityRule(ValidationRule):
    """版本兼容性验证规则"""

    def __init__(self):
        super().__init__(
            "version_compatibility",
            ValidationCategory.COMPATIBILITY,
            ValidationSeverity.WARNING,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        identity = registration.identity

        if not identity.version:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.ERROR,
                    message="No version specified",
                    suggestion="Specify adapter version for compatibility tracking",
                )
            )
            return issues

        version = identity.version

        # 检查版本格式
        import re

        semver_pattern = r"^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?(\+[a-zA-Z0-9]+)?$"
        if not re.match(semver_pattern, version):
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=ValidationSeverity.WARNING,
                    message=f"Version '{version}' does not follow semantic versioning",
                    suggestion="Use semantic versioning format (e.g., 1.0.0)",
                )
            )

        # 检查版本合理性
        try:
            parts = version.split(".")
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
            patch = int(parts[2].split("-")[0]) if len(parts) > 2 else 0

            if major == 0 and minor == 0 and patch == 0:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message="Version 0.0.0 suggests early development",
                        suggestion="Consider using development version indicators (e.g., 0.1.0-dev)",
                    )
                )
            elif major >= 100:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.INFO,
                        message=f"Very high major version: {major}",
                        suggestion="Ensure version number is correct",
                    )
                )

        except (ValueError, IndexError):
            pass  # 版本格式已在上面检查

        # 检查最小支持版本
        config = registration.configuration
        if config and config.config:
            min_version = config.config.get("min_supported_version", None)
            if min_version and isinstance(min_version, str):
                # 简单比较（实际应使用proper version comparison library）
                if min_version > version:
                    issues.append(
                        ValidationIssue(
                            category=self.category,
                            severity=ValidationSeverity.ERROR,
                            message=f"Current version {version} is below minimum supported {min_version}",
                            suggestion="Update adapter version or adjust minimum version requirement",
                        )
                    )

        return issues


class PlatformCompatibilityRule(ValidationRule):
    """平台兼容性验证规则"""

    def __init__(self):
        super().__init__(
            "platform_compatibility",
            ValidationCategory.COMPATIBILITY,
            ValidationSeverity.INFO,
        )

    async def validate(
        self, registration: AdapterRegistration
    ) -> List[ValidationIssue]:
        issues = []
        config = registration.configuration

        if not config:
            return issues

        # 检查平台特定设置
        settings = config.config if config.config else {}

        # 检查操作系统兼容性
        os_specific_keys = [
            key
            for key in settings.keys()
            if any(
                os_name in key.lower()
                for os_name in ["windows", "linux", "darwin", "macos"]
            )
        ]

        if os_specific_keys:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Platform-specific configuration detected",
                    suggestion="Ensure adapter works across different platforms",
                    details={"platform_specific_keys": os_specific_keys},
                )
            )

        # 检查Python版本兼容性
        python_version = settings.get("python_version", None) or settings.get(
            "min_python_version", None
        )
        if python_version:
            import sys

            current_version = f"{sys.version_info.major}.{sys.version_info.minor}"

            # 简单版本比较
            if isinstance(python_version, str) and python_version > current_version:
                issues.append(
                    ValidationIssue(
                        category=self.category,
                        severity=ValidationSeverity.WARNING,
                        message=f"Required Python version {python_version} > current {current_version}",
                        suggestion="Ensure Python version compatibility",
                    )
                )

        # 检查架构相关设置
        arch_specific = any(
            arch in str(settings).lower() for arch in ["x86", "x64", "arm", "aarch64"]
        )
        if arch_specific:
            issues.append(
                ValidationIssue(
                    category=self.category,
                    severity=self.severity,
                    message="Architecture-specific configuration detected",
                    suggestion="Test adapter on different CPU architectures",
                )
            )

        return issues

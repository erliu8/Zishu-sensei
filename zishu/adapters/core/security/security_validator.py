"""
安全验证器和审计系统

为Zishu-sensei适配器框架提供全面的安全验证和审计功能，支持：
- 多层级安全验证（输入验证、业务逻辑验证、输出验证）
- 实时威胁检测和响应
- 完整的审计日志和合规性报告
- 安全事件关联分析和取证
- 自动化安全响应和恢复
"""

import os
import re
import json
import time
import uuid
import hashlib
import asyncio
import logging
import threading
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Set,
    Union,
    Tuple,
    Protocol,
    TYPE_CHECKING,
    NamedTuple,
    Iterator,
)
import weakref
import ipaddress
import urllib.parse
import base64
import hmac
import secrets

# 第三方安全库
try:
    import bleach

    BLEACH_AVAILABLE = True
except ImportError:
    BLEACH_AVAILABLE = False
    bleach = None

try:
    import cryptography
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    cryptography = None

try:
    import sqlparse

    SQL_PARSE_AVAILABLE = True
except ImportError:
    SQL_PARSE_AVAILABLE = False
    sqlparse = None

# 本地导入
from .audit import (
    AuditLogger,
    AuditEventType,
    AuditSeverity,
    get_audit_logger,
    audit_operation,
)
from .permissions import AccessRequest, AccessResult, AccessDecision

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """验证级别"""

    BASIC = "basic"  # 基础验证
    STANDARD = "standard"  # 标准验证
    STRICT = "strict"  # 严格验证
    PARANOID = "paranoid"  # 极度严格验证


class ThreatType(Enum):
    """威胁类型"""

    # 输入威胁
    SQL_INJECTION = "sql_injection"
    XSS_ATTACK = "xss_attack"
    COMMAND_INJECTION = "command_injection"
    PATH_TRAVERSAL = "path_traversal"
    LDAP_INJECTION = "ldap_injection"
    XML_INJECTION = "xml_injection"

    # 业务逻辑威胁
    PRIVILEGE_ESCALATION = "privilege_escalation"
    BUSINESS_LOGIC_BYPASS = "business_logic_bypass"
    RACE_CONDITION = "race_condition"
    REPLAY_ATTACK = "replay_attack"

    # 系统威胁
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    DENIAL_OF_SERVICE = "denial_of_service"
    MALWARE_DETECTION = "malware_detection"
    SUSPICIOUS_BEHAVIOR = "suspicious_behavior"

    # 数据威胁
    DATA_EXFILTRATION = "data_exfiltration"
    DATA_TAMPERING = "data_tampering"
    SENSITIVE_DATA_EXPOSURE = "sensitive_data_exposure"

    # 网络威胁
    NETWORK_INTRUSION = "network_intrusion"
    PORT_SCANNING = "port_scanning"
    BRUTE_FORCE_ATTACK = "brute_force_attack"

    # 认证威胁
    CREDENTIAL_STUFFING = "credential_stuffing"
    SESSION_HIJACKING = "session_hijacking"
    TOKEN_MANIPULATION = "token_manipulation"


class SecurityEventSeverity(Enum):
    """安全事件严重程度"""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ValidationResult(Enum):
    """验证结果"""

    VALID = "valid"
    INVALID = "invalid"
    SUSPICIOUS = "suspicious"
    MALICIOUS = "malicious"


@dataclass
class SecurityViolation:
    """安全违规"""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    threat_type: ThreatType = ThreatType.SUSPICIOUS_BEHAVIOR
    severity: SecurityEventSeverity = SecurityEventSeverity.MEDIUM
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    source_ip: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    resource: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "threat_type": self.threat_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "source_ip": self.source_ip,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "resource": self.resource,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ValidationContext:
    """验证上下文"""

    request_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referer: Optional[str] = None
    content_type: Optional[str] = None
    request_size: int = 0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


class SecurityValidator(ABC):
    """安全验证器抽象基类"""

    def __init__(self, name: str, level: ValidationLevel = ValidationLevel.STANDARD):
        self.name = name
        self.level = level
        self.enabled = True
        self.stats = {
            "total_validations": 0,
            "valid_count": 0,
            "invalid_count": 0,
            "suspicious_count": 0,
            "malicious_count": 0,
            "average_time": 0.0,
        }

    @abstractmethod
    async def validate(
        self, data: Any, context: ValidationContext
    ) -> Tuple[ValidationResult, List[SecurityViolation]]:
        """验证数据"""
        pass

    async def _record_validation(
        self, result: ValidationResult, execution_time: float
    ) -> None:
        """记录验证统计"""
        self.stats["total_validations"] += 1

        if result == ValidationResult.VALID:
            self.stats["valid_count"] += 1
        elif result == ValidationResult.INVALID:
            self.stats["invalid_count"] += 1
        elif result == ValidationResult.SUSPICIOUS:
            self.stats["suspicious_count"] += 1
        elif result == ValidationResult.MALICIOUS:
            self.stats["malicious_count"] += 1

        # 更新平均时间
        total_time = self.stats["average_time"] * (self.stats["total_validations"] - 1)
        self.stats["average_time"] = (total_time + execution_time) / self.stats[
            "total_validations"
        ]


class InputValidator(SecurityValidator):
    """输入验证器"""

    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        super().__init__("input_validator", level)

        # SQL注入检测模式
        self.sql_injection_patterns = [
            r"(\bunion\b.*\bselect\b)",
            r"(\bselect\b.*\bfrom\b)",
            r"(\binsert\b.*\binto\b)",
            r"(\bdelete\b.*\bfrom\b)",
            r"(\bupdate\b.*\bset\b)",
            r"(\bdrop\b.*\btable\b)",
            r"(\balter\b.*\btable\b)",
            r"(\bcreate\b.*\btable\b)",
            r"(\bexec\b.*\()",
            r"(\bexecute\b.*\()",
            r"(--|#|/\*|\*/)",
            r"(\bor\b.*=.*)",
            r"(\band\b.*=.*)",
            r"('.*'.*=.*'.*')",
            r"(\b1\s*=\s*1\b)",
            r"(\b1\s*=\s*0\b)",
        ]

        # XSS检测模式
        self.xss_patterns = [
            r"<script[^>]*>.*?</script>",
            r"<iframe[^>]*>.*?</iframe>",
            r"<object[^>]*>.*?</object>",
            r"<embed[^>]*>",
            r"<applet[^>]*>.*?</applet>",
            r"javascript:",
            r"vbscript:",
            r"on\w+\s*=",
            r"expression\s*\(",
            r"@import",
            r"<meta[^>]*http-equiv",
            r"<link[^>]*href.*javascript:",
            r"<img[^>]*src.*javascript:",
            r"<form[^>]*action.*javascript:",
        ]

        # 命令注入检测模式
        self.command_injection_patterns = [
            r"[;&|`]",
            r"\$\(",
            r"`.*`",
            r"\|\s*\w+",
            r"&&\s*\w+",
            r"\|\|\s*\w+",
            r">\s*\w+",
            r"<\s*\w+",
            r"\beval\b",
            r"\bexec\b",
            r"\bsystem\b",
            r"\bshell_exec\b",
            r"\bpassthru\b",
            r"\bpopen\b",
        ]

        # 路径遍历检测模式
        self.path_traversal_patterns = [
            r"\.\./",
            r"\.\.\\",
            r"%2e%2e%2f",
            r"%2e%2e%5c",
            r"..%2f",
            r"..%5c",
            r"%252e%252e%252f",
            r"%252e%252e%255c",
        ]

    async def validate(
        self, data: Any, context: ValidationContext
    ) -> Tuple[ValidationResult, List[SecurityViolation]]:
        """验证输入数据"""
        start_time = time.time()
        violations = []

        try:
            if isinstance(data, str):
                violations.extend(await self._validate_string(data, context))
            elif isinstance(data, dict):
                violations.extend(await self._validate_dict(data, context))
            elif isinstance(data, list):
                violations.extend(await self._validate_list(data, context))

            # 确定验证结果
            if not violations:
                result = ValidationResult.VALID
            elif any(
                v.severity
                in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                for v in violations
            ):
                result = ValidationResult.MALICIOUS
            elif any(v.severity == SecurityEventSeverity.MEDIUM for v in violations):
                result = ValidationResult.SUSPICIOUS
            else:
                result = ValidationResult.INVALID

            execution_time = time.time() - start_time
            await self._record_validation(result, execution_time)

            return result, violations

        except Exception as e:
            logger.error(f"Input validation failed: {e}")
            execution_time = time.time() - start_time
            await self._record_validation(ValidationResult.INVALID, execution_time)

            return ValidationResult.INVALID, [
                SecurityViolation(
                    threat_type=ThreatType.SUSPICIOUS_BEHAVIOR,
                    severity=SecurityEventSeverity.MEDIUM,
                    message=f"Input validation error: {str(e)}",
                    details={"error": str(e), "data_type": type(data).__name__},
                )
            ]

    async def _validate_string(
        self, data: str, context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证字符串数据"""
        violations = []

        # SQL注入检测
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, data, re.IGNORECASE):
                violations.append(
                    SecurityViolation(
                        threat_type=ThreatType.SQL_INJECTION,
                        severity=SecurityEventSeverity.HIGH,
                        message="Potential SQL injection detected",
                        details={"pattern": pattern, "data": data[:100]},
                        user_id=context.user_id,
                        session_id=context.session_id,
                        source_ip=context.ip_address,
                    )
                )
                break

        # XSS检测
        for pattern in self.xss_patterns:
            if re.search(pattern, data, re.IGNORECASE | re.DOTALL):
                violations.append(
                    SecurityViolation(
                        threat_type=ThreatType.XSS_ATTACK,
                        severity=SecurityEventSeverity.HIGH,
                        message="Potential XSS attack detected",
                        details={"pattern": pattern, "data": data[:100]},
                        user_id=context.user_id,
                        session_id=context.session_id,
                        source_ip=context.ip_address,
                    )
                )
                break

        # 命令注入检测
        for pattern in self.command_injection_patterns:
            if re.search(pattern, data, re.IGNORECASE):
                violations.append(
                    SecurityViolation(
                        threat_type=ThreatType.COMMAND_INJECTION,
                        severity=SecurityEventSeverity.CRITICAL,
                        message="Potential command injection detected",
                        details={"pattern": pattern, "data": data[:100]},
                        user_id=context.user_id,
                        session_id=context.session_id,
                        source_ip=context.ip_address,
                    )
                )
                break

        # 路径遍历检测
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, data, re.IGNORECASE):
                violations.append(
                    SecurityViolation(
                        threat_type=ThreatType.PATH_TRAVERSAL,
                        severity=SecurityEventSeverity.HIGH,
                        message="Potential path traversal detected",
                        details={"pattern": pattern, "data": data[:100]},
                        user_id=context.user_id,
                        session_id=context.session_id,
                        source_ip=context.ip_address,
                    )
                )
                break

        # 检查数据长度
        if len(data) > 10000:  # 10KB限制
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.RESOURCE_EXHAUSTION,
                    severity=SecurityEventSeverity.MEDIUM,
                    message="Input data too large",
                    details={"length": len(data), "limit": 10000},
                    user_id=context.user_id,
                    session_id=context.session_id,
                    source_ip=context.ip_address,
                )
            )

        return violations

    async def _validate_dict(
        self, data: Dict[str, Any], context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证字典数据"""
        violations = []

        for key, value in data.items():
            # 验证键
            if isinstance(key, str):
                key_violations = await self._validate_string(key, context)
                violations.extend(key_violations)

            # 验证值
            if isinstance(value, str):
                value_violations = await self._validate_string(value, context)
                violations.extend(value_violations)
            elif isinstance(value, (dict, list)):
                nested_violations = await self.validate(value, context)
                violations.extend(nested_violations[1])

        return violations

    async def _validate_list(
        self, data: List[Any], context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证列表数据"""
        violations = []

        for item in data:
            if isinstance(item, str):
                item_violations = await self._validate_string(item, context)
                violations.extend(item_violations)
            elif isinstance(item, (dict, list)):
                nested_violations = await self.validate(item, context)
                violations.extend(nested_violations[1])

        return violations


class BusinessLogicValidator(SecurityValidator):
    """业务逻辑验证器"""

    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        super().__init__("business_logic_validator", level)
        self.rate_limits = defaultdict(lambda: deque())
        self.failed_attempts = defaultdict(lambda: deque())

    async def validate(
        self, data: Any, context: ValidationContext
    ) -> Tuple[ValidationResult, List[SecurityViolation]]:
        """验证业务逻辑"""
        start_time = time.time()
        violations = []

        try:
            # 速率限制检查
            rate_violations = await self._check_rate_limits(context)
            violations.extend(rate_violations)

            # 失败尝试检查
            attempt_violations = await self._check_failed_attempts(context)
            violations.extend(attempt_violations)

            # 会话验证
            session_violations = await self._validate_session(context)
            violations.extend(session_violations)

            # 时间窗口验证
            time_violations = await self._validate_time_window(context)
            violations.extend(time_violations)

            # 确定验证结果
            if not violations:
                result = ValidationResult.VALID
            elif any(
                v.severity
                in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                for v in violations
            ):
                result = ValidationResult.MALICIOUS
            else:
                result = ValidationResult.SUSPICIOUS

            execution_time = time.time() - start_time
            await self._record_validation(result, execution_time)

            return result, violations

        except Exception as e:
            logger.error(f"Business logic validation failed: {e}")
            execution_time = time.time() - start_time
            await self._record_validation(ValidationResult.INVALID, execution_time)

            return ValidationResult.INVALID, [
                SecurityViolation(
                    threat_type=ThreatType.BUSINESS_LOGIC_BYPASS,
                    severity=SecurityEventSeverity.MEDIUM,
                    message=f"Business logic validation error: {str(e)}",
                    details={"error": str(e)},
                )
            ]

    async def _check_rate_limits(
        self, context: ValidationContext
    ) -> List[SecurityViolation]:
        """检查速率限制"""
        violations = []

        if not context.ip_address:
            return violations

        now = datetime.now(timezone.utc)
        window = timedelta(minutes=1)
        limit = 100  # 每分钟100次请求

        # 清理过期记录
        requests = self.rate_limits[context.ip_address]
        while requests and now - requests[0] > window:
            requests.popleft()

        # 检查是否超限
        if len(requests) >= limit:
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.DENIAL_OF_SERVICE,
                    severity=SecurityEventSeverity.HIGH,
                    message="Rate limit exceeded",
                    details={
                        "ip": context.ip_address,
                        "count": len(requests),
                        "limit": limit,
                    },
                    source_ip=context.ip_address,
                    user_id=context.user_id,
                    session_id=context.session_id,
                )
            )
        else:
            requests.append(now)

        return violations

    async def _check_failed_attempts(
        self, context: ValidationContext
    ) -> List[SecurityViolation]:
        """检查失败尝试"""
        violations = []

        if not context.user_id:
            return violations

        now = datetime.now(timezone.utc)
        window = timedelta(minutes=15)
        limit = 5  # 15分钟内5次失败

        # 清理过期记录
        attempts = self.failed_attempts[context.user_id]
        while attempts and now - attempts[0] > window:
            attempts.popleft()

        # 检查是否超限
        if len(attempts) >= limit:
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.BRUTE_FORCE_ATTACK,
                    severity=SecurityEventSeverity.HIGH,
                    message="Too many failed attempts",
                    details={
                        "user_id": context.user_id,
                        "count": len(attempts),
                        "limit": limit,
                    },
                    source_ip=context.ip_address,
                    user_id=context.user_id,
                    session_id=context.session_id,
                )
            )

        return violations

    async def _validate_session(
        self, context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证会话"""
        violations = []

        if not context.session_id:
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.SESSION_HIJACKING,
                    severity=SecurityEventSeverity.MEDIUM,
                    message="Missing session ID",
                    details={"context": "session_validation"},
                    source_ip=context.ip_address,
                    user_id=context.user_id,
                )
            )

        return violations

    async def _validate_time_window(
        self, context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证时间窗口"""
        violations = []

        # 检查请求时间是否合理
        now = datetime.now(timezone.utc)
        if abs((now - context.timestamp).total_seconds()) > 300:  # 5分钟窗口
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.REPLAY_ATTACK,
                    severity=SecurityEventSeverity.MEDIUM,
                    message="Request timestamp outside valid window",
                    details={
                        "request_time": context.timestamp.isoformat(),
                        "current_time": now.isoformat(),
                        "diff_seconds": abs((now - context.timestamp).total_seconds()),
                    },
                    source_ip=context.ip_address,
                    user_id=context.user_id,
                    session_id=context.session_id,
                )
            )

        return violations

    def record_failed_attempt(self, user_id: str) -> None:
        """记录失败尝试"""
        if user_id:
            self.failed_attempts[user_id].append(datetime.now(timezone.utc))


class OutputValidator(SecurityValidator):
    """输出验证器"""

    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        super().__init__("output_validator", level)

        # 敏感信息模式
        self.sensitive_patterns = [
            (r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", "credit_card"),
            (r"\b\d{3}-\d{2}-\d{4}\b", "ssn"),
            (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "email"),
            (r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "ip_address"),
            (r"\b(?:password|pwd|pass|secret|key|token)\s*[:=]\s*\S+", "credentials"),
            (r"\b[A-Za-z0-9+/]{20,}={0,2}\b", "base64_encoded"),
            (r"\b[0-9a-fA-F]{32,}\b", "hash_or_token"),
        ]

    async def validate(
        self, data: Any, context: ValidationContext
    ) -> Tuple[ValidationResult, List[SecurityViolation]]:
        """验证输出数据"""
        start_time = time.time()
        violations = []

        try:
            if isinstance(data, str):
                violations.extend(await self._validate_string_output(data, context))
            elif isinstance(data, dict):
                violations.extend(await self._validate_dict_output(data, context))
            elif isinstance(data, list):
                violations.extend(await self._validate_list_output(data, context))

            # 确定验证结果
            if not violations:
                result = ValidationResult.VALID
            elif any(
                v.severity
                in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                for v in violations
            ):
                result = ValidationResult.MALICIOUS
            else:
                result = ValidationResult.SUSPICIOUS

            execution_time = time.time() - start_time
            await self._record_validation(result, execution_time)

            return result, violations

        except Exception as e:
            logger.error(f"Output validation failed: {e}")
            execution_time = time.time() - start_time
            await self._record_validation(ValidationResult.INVALID, execution_time)

            return ValidationResult.INVALID, [
                SecurityViolation(
                    threat_type=ThreatType.SENSITIVE_DATA_EXPOSURE,
                    severity=SecurityEventSeverity.MEDIUM,
                    message=f"Output validation error: {str(e)}",
                    details={"error": str(e)},
                )
            ]

    async def _validate_string_output(
        self, data: str, context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证字符串输出"""
        violations = []

        # 检查敏感信息泄露
        for pattern, info_type in self.sensitive_patterns:
            matches = re.findall(pattern, data, re.IGNORECASE)
            if matches:
                violations.append(
                    SecurityViolation(
                        threat_type=ThreatType.SENSITIVE_DATA_EXPOSURE,
                        severity=SecurityEventSeverity.HIGH,
                        message=f"Potential {info_type} exposure in output",
                        details={
                            "info_type": info_type,
                            "matches_count": len(matches),
                            "sample": matches[0] if matches else None,
                        },
                        user_id=context.user_id,
                        session_id=context.session_id,
                        source_ip=context.ip_address,
                    )
                )

        # 检查输出大小
        if len(data) > 1000000:  # 1MB限制
            violations.append(
                SecurityViolation(
                    threat_type=ThreatType.RESOURCE_EXHAUSTION,
                    severity=SecurityEventSeverity.MEDIUM,
                    message="Output data too large",
                    details={"size": len(data), "limit": 1000000},
                    user_id=context.user_id,
                    session_id=context.session_id,
                    source_ip=context.ip_address,
                )
            )

        return violations

    async def _validate_dict_output(
        self, data: Dict[str, Any], context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证字典输出"""
        violations = []

        for key, value in data.items():
            if isinstance(value, str):
                value_violations = await self._validate_string_output(value, context)
                violations.extend(value_violations)
            elif isinstance(value, (dict, list)):
                nested_violations = await self.validate(value, context)
                violations.extend(nested_violations[1])

        return violations

    async def _validate_list_output(
        self, data: List[Any], context: ValidationContext
    ) -> List[SecurityViolation]:
        """验证列表输出"""
        violations = []

        for item in data:
            if isinstance(item, str):
                item_violations = await self._validate_string_output(item, context)
                violations.extend(item_violations)
            elif isinstance(item, (dict, list)):
                nested_violations = await self.validate(item, context)
                violations.extend(nested_violations[1])

        return violations


class SecurityAuditor:
    """安全审计器"""

    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.violations_history = deque(maxlen=10000)
        self.threat_patterns = defaultdict(lambda: deque(maxlen=1000))
        self.user_activities = defaultdict(lambda: deque(maxlen=1000))
        self.lock = threading.RLock()

        # 统计信息
        self.stats = {
            "total_events": 0,
            "security_violations": 0,
            "threats_detected": 0,
            "users_monitored": 0,
            "patterns_identified": 0,
        }

    async def record_violation(self, violation: SecurityViolation) -> None:
        """记录安全违规"""
        with self.lock:
            self.violations_history.append(violation)
            self.stats["security_violations"] += 1

            # 记录威胁模式
            threat_key = (
                f"{violation.threat_type.value}:{violation.source_ip or 'unknown'}"
            )
            self.threat_patterns[threat_key].append(violation.timestamp)

            # 记录用户活动
            if violation.user_id:
                self.user_activities[violation.user_id].append(violation)

        # 记录到审计日志
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SECURITY_VIOLATION,
                violation.message,
                user_id=violation.user_id,
                component="security_validator",
                severity=self._map_severity(violation.severity),
                details=violation.to_dict(),
            )

        # 检查是否需要告警
        await self._check_alert_conditions(violation)

    def _map_severity(self, severity: SecurityEventSeverity) -> AuditSeverity:
        """映射严重程度"""
        mapping = {
            SecurityEventSeverity.INFO: AuditSeverity.INFO,
            SecurityEventSeverity.LOW: AuditSeverity.LOW,
            SecurityEventSeverity.MEDIUM: AuditSeverity.MEDIUM,
            SecurityEventSeverity.HIGH: AuditSeverity.HIGH,
            SecurityEventSeverity.CRITICAL: AuditSeverity.CRITICAL,
        }
        return mapping.get(severity, AuditSeverity.MEDIUM)

    async def _check_alert_conditions(self, violation: SecurityViolation) -> None:
        """检查告警条件"""
        # 高危威胁立即告警
        if violation.severity in [
            SecurityEventSeverity.HIGH,
            SecurityEventSeverity.CRITICAL,
        ]:
            await self._send_alert(
                violation, "High severity security violation detected"
            )

        # 检查频繁攻击
        threat_key = f"{violation.threat_type.value}:{violation.source_ip or 'unknown'}"
        recent_threats = self.threat_patterns[threat_key]

        if len(recent_threats) >= 5:  # 5次相同威胁
            time_window = timedelta(minutes=5)
            recent_count = sum(
                1
                for timestamp in recent_threats
                if violation.timestamp - timestamp <= time_window
            )

            if recent_count >= 3:  # 5分钟内3次
                await self._send_alert(
                    violation,
                    f"Repeated threat pattern detected: {violation.threat_type.value}",
                )

    async def _send_alert(self, violation: SecurityViolation, message: str) -> None:
        """发送告警"""
        logger.critical(f"SECURITY ALERT: {message}")

        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SECURITY_ALERT,
                message,
                user_id=violation.user_id,
                component="security_auditor",
                severity=AuditSeverity.CRITICAL,
                details={"violation": violation.to_dict(), "alert_reason": message},
            )

    def get_violation_summary(
        self, time_window: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """获取违规摘要"""
        if time_window is None:
            time_window = timedelta(hours=24)

        cutoff_time = datetime.now(timezone.utc) - time_window

        with self.lock:
            recent_violations = [
                v for v in self.violations_history if v.timestamp >= cutoff_time
            ]

        # 统计分析
        threat_counts = defaultdict(int)
        severity_counts = defaultdict(int)
        ip_counts = defaultdict(int)
        user_counts = defaultdict(int)

        for violation in recent_violations:
            threat_counts[violation.threat_type.value] += 1
            severity_counts[violation.severity.value] += 1
            if violation.source_ip:
                ip_counts[violation.source_ip] += 1
            if violation.user_id:
                user_counts[violation.user_id] += 1

        return {
            "time_window": str(time_window),
            "total_violations": len(recent_violations),
            "threat_types": dict(threat_counts),
            "severity_distribution": dict(severity_counts),
            "top_source_ips": dict(
                sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ),
            "top_users": dict(
                sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_user_risk_score(self, user_id: str) -> float:
        """计算用户风险分数"""
        with self.lock:
            user_violations = self.user_activities.get(user_id, [])

        if not user_violations:
            return 0.0

        # 基于违规严重程度和频率计算风险分数
        severity_weights = {
            SecurityEventSeverity.INFO: 0.1,
            SecurityEventSeverity.LOW: 0.2,
            SecurityEventSeverity.MEDIUM: 0.5,
            SecurityEventSeverity.HIGH: 1.0,
            SecurityEventSeverity.CRITICAL: 2.0,
        }

        # 计算时间衰减
        now = datetime.now(timezone.utc)
        total_score = 0.0

        for violation in user_violations:
            # 时间衰减因子（24小时内为1.0，之后每天衰减0.1）
            age_hours = (now - violation.timestamp).total_seconds() / 3600
            decay_factor = (
                max(0.1, 1.0 - (age_hours - 24) * 0.1 / 24) if age_hours > 24 else 1.0
            )

            severity_weight = severity_weights.get(violation.severity, 0.5)
            total_score += severity_weight * decay_factor

        return min(total_score, 10.0)  # 最高10分

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self.lock:
            stats = self.stats.copy()
            stats.update(
                {
                    "violations_in_history": len(self.violations_history),
                    "unique_threat_patterns": len(self.threat_patterns),
                    "monitored_users": len(self.user_activities),
                }
            )
        return stats


class ComprehensiveSecurityValidator:
    """综合安全验证器"""

    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        self.level = level
        self.validators = {
            "input": InputValidator(level),
            "business_logic": BusinessLogicValidator(level),
            "output": OutputValidator(level),
        }
        self.auditor = SecurityAuditor()
        self.enabled = True

        # 全局统计
        self.stats = {
            "total_validations": 0,
            "passed_validations": 0,
            "failed_validations": 0,
            "blocked_requests": 0,
            "average_validation_time": 0.0,
        }

    async def validate_request(
        self, input_data: Any, context: ValidationContext, validate_output: bool = True
    ) -> Tuple[bool, List[SecurityViolation]]:
        """验证完整请求"""
        if not self.enabled:
            return True, []

        start_time = time.time()
        all_violations = []

        try:
            self.stats["total_validations"] += 1

            # 1. 输入验证
            input_result, input_violations = await self.validators["input"].validate(
                input_data, context
            )
            all_violations.extend(input_violations)

            # 2. 业务逻辑验证
            logic_result, logic_violations = await self.validators[
                "business_logic"
            ].validate(input_data, context)
            all_violations.extend(logic_violations)

            # 记录所有违规
            for violation in all_violations:
                await self.auditor.record_violation(violation)

            # 确定是否通过验证
            has_critical_violations = any(
                v.severity
                in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                for v in all_violations
            )

            passed = not has_critical_violations

            # 更新统计
            if passed:
                self.stats["passed_validations"] += 1
            else:
                self.stats["failed_validations"] += 1
                self.stats["blocked_requests"] += 1

            # 更新平均验证时间
            validation_time = time.time() - start_time
            total_time = self.stats["average_validation_time"] * (
                self.stats["total_validations"] - 1
            )
            self.stats["average_validation_time"] = (
                total_time + validation_time
            ) / self.stats["total_validations"]

            return passed, all_violations

        except Exception as e:
            logger.error(f"Comprehensive validation failed: {e}")
            self.stats["failed_validations"] += 1

            error_violation = SecurityViolation(
                threat_type=ThreatType.SUSPICIOUS_BEHAVIOR,
                severity=SecurityEventSeverity.MEDIUM,
                message=f"Validation system error: {str(e)}",
                details={"error": str(e), "traceback": traceback.format_exc()},
                user_id=context.user_id,
                session_id=context.session_id,
                source_ip=context.ip_address,
            )

            await self.auditor.record_violation(error_violation)
            return False, [error_violation]

    async def validate_output(
        self, output_data: Any, context: ValidationContext
    ) -> Tuple[bool, List[SecurityViolation]]:
        """验证输出数据"""
        if not self.enabled:
            return True, []

        try:
            result, violations = await self.validators["output"].validate(
                output_data, context
            )

            # 记录违规
            for violation in violations:
                await self.auditor.record_violation(violation)

            passed = result in [ValidationResult.VALID, ValidationResult.SUSPICIOUS]
            return passed, violations

        except Exception as e:
            logger.error(f"Output validation failed: {e}")

            error_violation = SecurityViolation(
                threat_type=ThreatType.SENSITIVE_DATA_EXPOSURE,
                severity=SecurityEventSeverity.MEDIUM,
                message=f"Output validation error: {str(e)}",
                details={"error": str(e)},
                user_id=context.user_id,
                session_id=context.session_id,
                source_ip=context.ip_address,
            )

            await self.auditor.record_violation(error_violation)
            return False, [error_violation]

    def record_failed_attempt(self, user_id: str) -> None:
        """记录失败尝试"""
        self.validators["business_logic"].record_failed_attempt(user_id)

    def get_user_risk_score(self, user_id: str) -> float:
        """获取用户风险分数"""
        return self.auditor.get_user_risk_score(user_id)

    def get_violation_summary(
        self, time_window: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """获取违规摘要"""
        return self.auditor.get_violation_summary(time_window)

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = self.stats.copy()

        # 添加各验证器统计
        for name, validator in self.validators.items():
            stats[f"{name}_validator"] = validator.stats

        # 添加审计器统计
        stats["auditor"] = self.auditor.get_statistics()

        return stats

    def enable(self) -> None:
        """启用验证器"""
        self.enabled = True
        for validator in self.validators.values():
            validator.enabled = True

    def disable(self) -> None:
        """禁用验证器"""
        self.enabled = False
        for validator in self.validators.values():
            validator.enabled = False


# 默认安全验证器实例
_default_security_validator = None


def get_security_validator() -> ComprehensiveSecurityValidator:
    """获取默认安全验证器"""
    global _default_security_validator
    if _default_security_validator is None:
        _default_security_validator = ComprehensiveSecurityValidator()
    return _default_security_validator


# 装饰器
def validate_input(level: ValidationLevel = ValidationLevel.STANDARD):
    """输入验证装饰器"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            validator = get_security_validator()

            # 构建验证上下文
            context = ValidationContext(
                request_id=str(uuid.uuid4()),
                user_id=kwargs.get("user_id"),
                session_id=kwargs.get("session_id"),
                ip_address=kwargs.get("ip_address"),
            )

            # 验证输入参数
            input_data = {"args": args, "kwargs": kwargs}
            passed, violations = await validator.validate_request(
                input_data, context, False
            )

            if not passed:
                critical_violations = [
                    v
                    for v in violations
                    if v.severity
                    in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                ]
                if critical_violations:
                    raise SecurityError(
                        f"Input validation failed: {critical_violations[0].message}"
                    )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


class SecurityError(Exception):
    """安全错误异常"""

    def __init__(self, message: str, violations: List[SecurityViolation] = None):
        super().__init__(message)
        self.violations = violations or []


# 便捷函数
async def validate_user_input(
    data: Any,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[bool, List[SecurityViolation]]:
    """验证用户输入的便捷函数"""
    context = ValidationContext(
        request_id=str(uuid.uuid4()),
        user_id=user_id,
        session_id=session_id,
        ip_address=ip_address,
    )

    validator = get_security_validator()
    return await validator.validate_request(data, context, False)


async def validate_system_output(
    data: Any, user_id: Optional[str] = None, session_id: Optional[str] = None
) -> Tuple[bool, List[SecurityViolation]]:
    """验证系统输出的便捷函数"""
    context = ValidationContext(
        request_id=str(uuid.uuid4()), user_id=user_id, session_id=session_id
    )

    validator = get_security_validator()
    return await validator.validate_output(data, context)


def get_security_statistics() -> Dict[str, Any]:
    """获取安全统计信息"""
    validator = get_security_validator()
    return validator.get_statistics()


def get_user_security_profile(user_id: str) -> Dict[str, Any]:
    """获取用户安全档案"""
    validator = get_security_validator()

    return {
        "user_id": user_id,
        "risk_score": validator.get_user_risk_score(user_id),
        "recent_violations": validator.get_violation_summary(timedelta(hours=24)),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

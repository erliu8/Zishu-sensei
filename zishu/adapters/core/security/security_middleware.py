"""
安全中间件系统

提供请求拦截、安全检查和自动响应功能，包括：
- 请求安全验证
- 权限检查中间件
- 威胁检测拦截
- 自动安全响应
- 安全策略执行
"""

import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Callable, Union, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

from .security_service import SecurityContext, SecurityViolationType
from .threat_detector import ThreatDetector, ThreatAnalysisResult, ThreatLevel
from .audit import AuditLogger, AuditEventType, AuditSeverity, get_audit_logger

logger = logging.getLogger(__name__)


class SecurityAction(str, Enum):
    """安全动作"""
    ALLOW = "allow"
    DENY = "deny"
    BLOCK = "block"
    QUARANTINE = "quarantine"
    LOG_ONLY = "log_only"
    RATE_LIMIT = "rate_limit"


class SecurityDecision(str, Enum):
    """安全决策"""
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"
    CONDITIONAL_APPROVAL = "conditional_approval"


@dataclass
class RequestSecurityContext:
    """请求安全上下文"""
    request_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    adapter_id: Optional[str] = None
    
    # 请求信息
    method: str = ""
    resource: str = ""
    action: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    
    # 安全信息
    security_context: Optional[SecurityContext] = None
    threat_analysis: Optional[ThreatAnalysisResult] = None
    
    # 时间戳
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'request_id': self.request_id,
            'user_id': self.user_id,
            'session_id': self.session_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'adapter_id': self.adapter_id,
            'method': self.method,
            'resource': self.resource,
            'action': self.action,
            'timestamp': self.timestamp.isoformat(),
            'security_context': self.security_context.to_dict() if self.security_context else None,
            'threat_analysis': self.threat_analysis.to_dict() if self.threat_analysis else None
        }


@dataclass
class SecurityMiddlewareResult:
    """安全中间件结果"""
    action: SecurityAction
    decision: SecurityDecision
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    # 处理信息
    processed_by: List[str] = field(default_factory=list)
    processing_time: float = 0.0
    
    def is_allowed(self) -> bool:
        """是否允许请求"""
        return self.action == SecurityAction.ALLOW
    
    def is_blocked(self) -> bool:
        """是否阻止请求"""
        return self.action in [SecurityAction.DENY, SecurityAction.BLOCK, SecurityAction.QUARANTINE]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'action': self.action.value,
            'decision': self.decision.value,
            'message': self.message,
            'details': self.details,
            'processed_by': self.processed_by,
            'processing_time': self.processing_time,
            'is_allowed': self.is_allowed(),
            'is_blocked': self.is_blocked()
        }


class SecurityMiddleware(ABC):
    """
    安全中间件基类
    
    所有安全中间件都应该继承此类并实现process方法。
    """
    
    def __init__(self, name: str, priority: int = 100):
        """初始化中间件"""
        self.name = name
        self.priority = priority
        self.enabled = True
        
        # 统计信息
        self.stats = {
            'total_requests': 0,
            'allowed_requests': 0,
            'blocked_requests': 0,
            'processing_time': 0.0
        }
    
    @abstractmethod
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理安全检查"""
        pass
    
    async def pre_process(self, context: RequestSecurityContext) -> None:
        """预处理（可选重写）"""
        pass
    
    async def post_process(
        self,
        context: RequestSecurityContext,
        result: SecurityMiddlewareResult
    ) -> None:
        """后处理（可选重写）"""
        pass
    
    def update_stats(self, result: SecurityMiddlewareResult, processing_time: float) -> None:
        """更新统计信息"""
        self.stats['total_requests'] += 1
        self.stats['processing_time'] += processing_time
        
        if result.is_allowed():
            self.stats['allowed_requests'] += 1
        elif result.is_blocked():
            self.stats['blocked_requests'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = self.stats.copy()
        if stats['total_requests'] > 0:
            stats['average_processing_time'] = stats['processing_time'] / stats['total_requests']
            stats['block_rate'] = stats['blocked_requests'] / stats['total_requests']
        else:
            stats['average_processing_time'] = 0.0
            stats['block_rate'] = 0.0
        
        return stats


class AuthenticationMiddleware(SecurityMiddleware):
    """身份验证中间件"""
    
    def __init__(self, security_service):
        super().__init__("authentication", priority=10)
        self.security_service = security_service
    
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理身份验证"""
        if not context.session_id:
            return SecurityMiddlewareResult(
                action=SecurityAction.DENY,
                decision=SecurityDecision.REJECTED,
                message="No session ID provided",
                processed_by=[self.name]
            )
        
        # 验证会话
        security_context = await self.security_service.get_security_context(context.session_id)
        if not security_context:
            return SecurityMiddlewareResult(
                action=SecurityAction.DENY,
                decision=SecurityDecision.REJECTED,
                message="Invalid or expired session",
                processed_by=[self.name]
            )
        
        # 更新请求上下文
        context.security_context = security_context
        context.user_id = security_context.user_id
        
        return SecurityMiddlewareResult(
            action=SecurityAction.ALLOW,
            decision=SecurityDecision.APPROVED,
            message="Authentication successful",
            processed_by=[self.name]
        )


class AuthorizationMiddleware(SecurityMiddleware):
    """授权中间件"""
    
    def __init__(self, security_service):
        super().__init__("authorization", priority=20)
        self.security_service = security_service
    
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理授权检查"""
        if not context.security_context:
            return SecurityMiddlewareResult(
                action=SecurityAction.DENY,
                decision=SecurityDecision.REJECTED,
                message="No security context available",
                processed_by=[self.name]
            )
        
        # 检查权限
        has_permission = await self.security_service.check_permission(
            context.session_id,
            context.resource,
            context.action,
            context.adapter_id
        )
        
        if not has_permission:
            return SecurityMiddlewareResult(
                action=SecurityAction.DENY,
                decision=SecurityDecision.REJECTED,
                message=f"Permission denied for {context.action} on {context.resource}",
                details={
                    'required_permission': f"{context.resource}:{context.action}",
                    'user_permissions': context.security_context.permissions
                },
                processed_by=[self.name]
            )
        
        return SecurityMiddlewareResult(
            action=SecurityAction.ALLOW,
            decision=SecurityDecision.APPROVED,
            message="Authorization successful",
            processed_by=[self.name]
        )


class ThreatDetectionMiddleware(SecurityMiddleware):
    """威胁检测中间件"""
    
    def __init__(self, threat_detector: ThreatDetector):
        super().__init__("threat_detection", priority=30)
        self.threat_detector = threat_detector
    
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理威胁检测"""
        # 分析代码威胁（如果有代码）
        if 'code' in context.payload:
            code_analysis = await self.threat_detector.analyze_code(
                context.payload['code'],
                {
                    'user_id': context.user_id,
                    'adapter_id': context.adapter_id,
                    'ip_address': context.ip_address,
                    'session_id': context.session_id
                }
            )
            
            context.threat_analysis = code_analysis
            
            if code_analysis.is_threat:
                # 根据威胁级别决定动作
                max_threat_level = max(event.threat_level for event in code_analysis.threat_events)
                
                if max_threat_level == ThreatLevel.CRITICAL:
                    action = SecurityAction.BLOCK
                elif max_threat_level == ThreatLevel.HIGH:
                    action = SecurityAction.QUARANTINE
                else:
                    action = SecurityAction.LOG_ONLY
                
                return SecurityMiddlewareResult(
                    action=action,
                    decision=SecurityDecision.REJECTED if action in [SecurityAction.BLOCK, SecurityAction.QUARANTINE] else SecurityDecision.CONDITIONAL_APPROVAL,
                    message=f"Threat detected: {len(code_analysis.threat_events)} threats found",
                    details={
                        'threat_count': len(code_analysis.threat_events),
                        'risk_score': code_analysis.risk_score,
                        'threats': [event.to_dict() for event in code_analysis.threat_events]
                    },
                    processed_by=[self.name]
                )
        
        # 分析行为威胁
        if context.user_id:
            behavior_analysis = await self.threat_detector.analyze_behavior(
                context.user_id,
                context.action,
                {
                    'ip_address': context.ip_address,
                    'adapter_id': context.adapter_id,
                    'resource': context.resource
                }
            )
            
            if behavior_analysis.is_threat:
                return SecurityMiddlewareResult(
                    action=SecurityAction.RATE_LIMIT,
                    decision=SecurityDecision.CONDITIONAL_APPROVAL,
                    message="Suspicious behavior detected",
                    details={
                        'behavior_threats': [event.to_dict() for event in behavior_analysis.threat_events]
                    },
                    processed_by=[self.name]
                )
        
        return SecurityMiddlewareResult(
            action=SecurityAction.ALLOW,
            decision=SecurityDecision.APPROVED,
            message="No threats detected",
            processed_by=[self.name]
        )


class RateLimitMiddleware(SecurityMiddleware):
    """速率限制中间件"""
    
    def __init__(self, requests_per_minute: int = 60):
        super().__init__("rate_limit", priority=40)
        self.requests_per_minute = requests_per_minute
        self.request_history: Dict[str, List[datetime]] = {}
    
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理速率限制"""
        # 使用用户ID或IP地址作为限制键
        limit_key = context.user_id or context.ip_address or "anonymous"
        
        current_time = datetime.now(timezone.utc)
        
        # 初始化或清理历史记录
        if limit_key not in self.request_history:
            self.request_history[limit_key] = []
        
        # 清理1分钟前的记录
        cutoff_time = current_time - timedelta(minutes=1)
        self.request_history[limit_key] = [
            req_time for req_time in self.request_history[limit_key]
            if req_time > cutoff_time
        ]
        
        # 检查是否超过限制
        if len(self.request_history[limit_key]) >= self.requests_per_minute:
            return SecurityMiddlewareResult(
                action=SecurityAction.RATE_LIMIT,
                decision=SecurityDecision.REJECTED,
                message=f"Rate limit exceeded: {self.requests_per_minute} requests per minute",
                details={
                    'limit': self.requests_per_minute,
                    'current_count': len(self.request_history[limit_key]),
                    'reset_time': (cutoff_time + timedelta(minutes=1)).isoformat()
                },
                processed_by=[self.name]
            )
        
        # 记录当前请求
        self.request_history[limit_key].append(current_time)
        
        return SecurityMiddlewareResult(
            action=SecurityAction.ALLOW,
            decision=SecurityDecision.APPROVED,
            message="Rate limit check passed",
            details={
                'current_count': len(self.request_history[limit_key]),
                'limit': self.requests_per_minute
            },
            processed_by=[self.name]
        )


class IPFilterMiddleware(SecurityMiddleware):
    """IP过滤中间件"""
    
    def __init__(self, blocked_ips: Optional[List[str]] = None, allowed_ips: Optional[List[str]] = None):
        super().__init__("ip_filter", priority=5)
        self.blocked_ips = set(blocked_ips or [])
        self.allowed_ips = set(allowed_ips or [])
    
    async def process(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """处理IP过滤"""
        if not context.ip_address:
            return SecurityMiddlewareResult(
                action=SecurityAction.ALLOW,
                decision=SecurityDecision.APPROVED,
                message="No IP address to filter",
                processed_by=[self.name]
            )
        
        # 检查黑名单
        if context.ip_address in self.blocked_ips:
            return SecurityMiddlewareResult(
                action=SecurityAction.BLOCK,
                decision=SecurityDecision.REJECTED,
                message=f"IP {context.ip_address} is blocked",
                details={'blocked_ip': context.ip_address},
                processed_by=[self.name]
            )
        
        # 检查白名单（如果配置了）
        if self.allowed_ips and context.ip_address not in self.allowed_ips:
            return SecurityMiddlewareResult(
                action=SecurityAction.BLOCK,
                decision=SecurityDecision.REJECTED,
                message=f"IP {context.ip_address} is not in allowed list",
                details={'ip_address': context.ip_address},
                processed_by=[self.name]
            )
        
        return SecurityMiddlewareResult(
            action=SecurityAction.ALLOW,
            decision=SecurityDecision.APPROVED,
            message="IP filter check passed",
            processed_by=[self.name]
        )
    
    def add_blocked_ip(self, ip_address: str) -> None:
        """添加阻止的IP"""
        self.blocked_ips.add(ip_address)
    
    def remove_blocked_ip(self, ip_address: str) -> None:
        """移除阻止的IP"""
        self.blocked_ips.discard(ip_address)
    
    def add_allowed_ip(self, ip_address: str) -> None:
        """添加允许的IP"""
        self.allowed_ips.add(ip_address)
    
    def remove_allowed_ip(self, ip_address: str) -> None:
        """移除允许的IP"""
        self.allowed_ips.discard(ip_address)


class SecurityInterceptor:
    """
    安全拦截器
    
    管理和执行安全中间件链，提供统一的安全检查入口。
    """
    
    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        """初始化安全拦截器"""
        self.middlewares: List[SecurityMiddleware] = []
        self.audit_logger = audit_logger or get_audit_logger()
        
        # 统计信息
        self.stats = {
            'total_requests': 0,
            'allowed_requests': 0,
            'blocked_requests': 0,
            'total_processing_time': 0.0
        }
        
        logger.info("SecurityInterceptor initialized")
    
    def add_middleware(self, middleware: SecurityMiddleware) -> None:
        """添加中间件"""
        self.middlewares.append(middleware)
        # 按优先级排序
        self.middlewares.sort(key=lambda m: m.priority)
        logger.info(f"Added middleware: {middleware.name} (priority: {middleware.priority})")
    
    def remove_middleware(self, name: str) -> bool:
        """移除中间件"""
        for i, middleware in enumerate(self.middlewares):
            if middleware.name == name:
                del self.middlewares[i]
                logger.info(f"Removed middleware: {name}")
                return True
        return False
    
    def get_middleware(self, name: str) -> Optional[SecurityMiddleware]:
        """获取中间件"""
        for middleware in self.middlewares:
            if middleware.name == name:
                return middleware
        return None
    
    async def intercept(self, context: RequestSecurityContext) -> SecurityMiddlewareResult:
        """拦截并处理请求"""
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            # 执行中间件链
            for middleware in self.middlewares:
                if not middleware.enabled:
                    continue
                
                # 预处理
                await middleware.pre_process(context)
                
                # 处理
                middleware_start = time.time()
                result = await middleware.process(context)
                middleware_time = time.time() - middleware_start
                
                # 更新中间件统计
                middleware.update_stats(result, middleware_time)
                
                # 后处理
                await middleware.post_process(context, result)
                
                # 如果被阻止，立即返回
                if result.is_blocked():
                    await self._log_security_event(context, result, "blocked")
                    self.stats['blocked_requests'] += 1
                    return result
                
                # 如果需要特殊处理
                if result.action in [SecurityAction.RATE_LIMIT, SecurityAction.QUARANTINE]:
                    await self._log_security_event(context, result, "restricted")
            
            # 所有中间件都通过
            final_result = SecurityMiddlewareResult(
                action=SecurityAction.ALLOW,
                decision=SecurityDecision.APPROVED,
                message="All security checks passed",
                processed_by=[m.name for m in self.middlewares if m.enabled]
            )
            
            await self._log_security_event(context, final_result, "allowed")
            self.stats['allowed_requests'] += 1
            
            return final_result
            
        except Exception as e:
            logger.error(f"Security interception failed: {e}")
            
            error_result = SecurityMiddlewareResult(
                action=SecurityAction.DENY,
                decision=SecurityDecision.REJECTED,
                message=f"Security check failed: {e}",
                details={'error': str(e)}
            )
            
            await self._log_security_event(context, error_result, "error")
            self.stats['blocked_requests'] += 1
            
            return error_result
            
        finally:
            processing_time = time.time() - start_time
            self.stats['total_processing_time'] += processing_time
    
    async def _log_security_event(
        self,
        context: RequestSecurityContext,
        result: SecurityMiddlewareResult,
        event_type: str
    ) -> None:
        """记录安全事件"""
        if not self.audit_logger:
            return
        
        # 确定审计事件类型
        audit_event_type = {
            'allowed': AuditEventType.ACCESS_GRANTED,
            'blocked': AuditEventType.ACCESS_DENIED,
            'restricted': AuditEventType.SECURITY_VIOLATION,
            'error': AuditEventType.SYSTEM_ERROR
        }.get(event_type, AuditEventType.ACCESS_GRANTED)
        
        # 确定严重程度
        severity = AuditSeverity.INFO
        if result.is_blocked():
            severity = AuditSeverity.HIGH
        elif result.action in [SecurityAction.RATE_LIMIT, SecurityAction.QUARANTINE]:
            severity = AuditSeverity.MEDIUM
        
        try:
            await self.audit_logger.log_event(
                audit_event_type,
                f"Security check {event_type}: {result.message}",
                user_id=context.user_id,
                session_id=context.session_id,
                component="security_interceptor",
                severity=severity,
                details={
                    'request_context': context.to_dict(),
                    'security_result': result.to_dict()
                }
            )
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = self.stats.copy()
        
        if stats['total_requests'] > 0:
            stats['block_rate'] = stats['blocked_requests'] / stats['total_requests']
            stats['average_processing_time'] = stats['total_processing_time'] / stats['total_requests']
        else:
            stats['block_rate'] = 0.0
            stats['average_processing_time'] = 0.0
        
        # 添加中间件统计
        stats['middleware_stats'] = {
            middleware.name: middleware.get_stats()
            for middleware in self.middlewares
        }
        
        return stats
    
    def get_middleware_list(self) -> List[Dict[str, Any]]:
        """获取中间件列表"""
        return [
            {
                'name': middleware.name,
                'priority': middleware.priority,
                'enabled': middleware.enabled,
                'stats': middleware.get_stats()
            }
            for middleware in self.middlewares
        ]
    
    async def enable_middleware(self, name: str) -> bool:
        """启用中间件"""
        middleware = self.get_middleware(name)
        if middleware:
            middleware.enabled = True
            logger.info(f"Enabled middleware: {name}")
            return True
        return False
    
    async def disable_middleware(self, name: str) -> bool:
        """禁用中间件"""
        middleware = self.get_middleware(name)
        if middleware:
            middleware.enabled = False
            logger.info(f"Disabled middleware: {name}")
            return True
        return False

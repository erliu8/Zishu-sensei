"""
威胁检测系统

提供全面的威胁检测和异常行为监控，包括：
- 恶意代码检测
- 异常行为分析
- 攻击模式识别
- 实时威胁评估
- 自动响应机制
"""

import asyncio
import logging
import re
import time
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Pattern
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import json
import ast
import inspect

from .audit import AuditSeverity, AuditEventType

logger = logging.getLogger(__name__)


class ThreatType(str, Enum):
    """威胁类型"""

    MALICIOUS_CODE = "malicious_code"
    SUSPICIOUS_BEHAVIOR = "suspicious_behavior"
    RESOURCE_ABUSE = "resource_abuse"
    DATA_EXFILTRATION = "data_exfiltration"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    INJECTION_ATTACK = "injection_attack"
    DENIAL_OF_SERVICE = "denial_of_service"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    ANOMALOUS_PATTERN = "anomalous_pattern"


class ThreatLevel(str, Enum):
    """威胁级别"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ThreatEvent:
    """威胁事件"""

    event_id: str
    threat_type: ThreatType
    threat_level: ThreatLevel
    title: str
    description: str
    source: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # 上下文信息
    user_id: Optional[str] = None
    adapter_id: Optional[str] = None
    ip_address: Optional[str] = None
    session_id: Optional[str] = None

    # 检测详情
    detection_method: str = ""
    confidence_score: float = 0.0
    evidence: Dict[str, Any] = field(default_factory=dict)

    # 响应信息
    auto_blocked: bool = False
    response_actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "threat_type": self.threat_type.value,
            "threat_level": self.threat_level.value,
            "title": self.title,
            "description": self.description,
            "source": self.source,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "adapter_id": self.adapter_id,
            "ip_address": self.ip_address,
            "session_id": self.session_id,
            "detection_method": self.detection_method,
            "confidence_score": self.confidence_score,
            "evidence": self.evidence,
            "auto_blocked": self.auto_blocked,
            "response_actions": self.response_actions,
        }


@dataclass
class SecurityAlert:
    """安全警报"""

    alert_id: str
    threat_events: List[ThreatEvent]
    severity: AuditSeverity
    title: str
    description: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # 聚合信息
    affected_users: Set[str] = field(default_factory=set)
    affected_adapters: Set[str] = field(default_factory=set)
    source_ips: Set[str] = field(default_factory=set)

    # 状态
    acknowledged: bool = False
    resolved: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "threat_events": [event.to_dict() for event in self.threat_events],
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "affected_users": list(self.affected_users),
            "affected_adapters": list(self.affected_adapters),
            "source_ips": list(self.source_ips),
            "acknowledged": self.acknowledged,
            "resolved": self.resolved,
        }


@dataclass
class ThreatAnalysisResult:
    """威胁分析结果"""

    is_threat: bool
    threat_events: List[ThreatEvent] = field(default_factory=list)
    risk_score: float = 0.0
    recommendations: List[str] = field(default_factory=list)

    def add_threat(self, event: ThreatEvent) -> None:
        """添加威胁事件"""
        self.threat_events.append(event)
        self.is_threat = True

        # 更新风险评分
        level_scores = {
            ThreatLevel.LOW: 0.25,
            ThreatLevel.MEDIUM: 0.5,
            ThreatLevel.HIGH: 0.75,
            ThreatLevel.CRITICAL: 1.0,
        }
        event_score = level_scores.get(event.threat_level, 0.0) * event.confidence_score
        self.risk_score = max(self.risk_score, event_score)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_threat": self.is_threat,
            "threat_events": [event.to_dict() for event in self.threat_events],
            "risk_score": self.risk_score,
            "recommendations": self.recommendations,
        }


class ThreatDetector:
    """
    威胁检测器

    提供全面的威胁检测功能，包括静态代码分析、行为模式检测和实时监控。
    """

    def __init__(self):
        """初始化威胁检测器"""

        # 检测规则
        self._malicious_patterns = self._load_malicious_patterns()
        self._suspicious_imports = self._load_suspicious_imports()
        self._dangerous_functions = self._load_dangerous_functions()

        # 行为分析
        self._user_behavior: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self._ip_behavior: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self._adapter_behavior: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=1000)
        )

        # 威胁事件存储
        self._threat_events: deque = deque(maxlen=10000)
        self._security_alerts: deque = deque(maxlen=1000)

        # 统计信息
        self._detection_stats = {
            "total_scans": 0,
            "threats_detected": 0,
            "false_positives": 0,
            "auto_blocked": 0,
        }

        # 配置
        self.confidence_threshold = 0.7
        self.auto_block_threshold = 0.8

        logger.info("ThreatDetector initialized")

    def _load_malicious_patterns(self) -> List[Pattern]:
        """加载恶意代码模式"""
        patterns = [
            # 系统命令执行
            r"os\.system\s*\(",
            r"subprocess\.(call|run|Popen)",
            r"commands\.(getoutput|getstatusoutput)",
            # 文件操作
            r'open\s*\(\s*["\'][^"\']*\.(exe|bat|sh|cmd)["\']',
            r'__import__\s*\(\s*["\']os["\']',
            # 网络操作
            r"urllib\.request\.urlopen",
            r"requests\.(get|post|put|delete)",
            r"socket\.socket\s*\(",
            # 代码执行
            r"eval\s*\(",
            r"exec\s*\(",
            r"compile\s*\(",
            # 反射和动态加载
            r"getattr\s*\(",
            r"setattr\s*\(",
            r"__getattribute__",
            r"importlib\.import_module",
            # 危险的内置函数
            r"globals\s*\(\s*\)",
            r"locals\s*\(\s*\)",
            r"vars\s*\(",
            r"dir\s*\(",
            # 编码/解码操作
            r"base64\.(encode|decode)",
            r"codecs\.(encode|decode)",
            # 进程和线程
            r"threading\.Thread",
            r"multiprocessing\.Process",
            # 系统信息获取
            r"platform\.(system|machine|processor)",
            r"os\.(environ|getenv)",
        ]

        return [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

    def _load_suspicious_imports(self) -> Set[str]:
        """加载可疑导入模块"""
        return {
            "os",
            "sys",
            "subprocess",
            "commands",
            "platform",
            "socket",
            "urllib",
            "requests",
            "http",
            "ftplib",
            "smtplib",
            "telnetlib",
            "paramiko",
            "fabric",
            "threading",
            "multiprocessing",
            "asyncio",
            "ctypes",
            "struct",
            "marshal",
            "pickle",
            "importlib",
            "pkgutil",
            "modulefinder",
            "base64",
            "codecs",
            "zlib",
            "gzip",
            "tempfile",
            "shutil",
            "glob",
            "pathlib",
        }

    def _load_dangerous_functions(self) -> Set[str]:
        """加载危险函数列表"""
        return {
            "eval",
            "exec",
            "compile",
            "__import__",
            "getattr",
            "setattr",
            "delattr",
            "hasattr",
            "globals",
            "locals",
            "vars",
            "dir",
            "open",
            "file",
            "input",
            "raw_input",
            "reload",
            "execfile",
            "apply",
        }

    async def analyze_code(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> ThreatAnalysisResult:
        """分析代码威胁"""
        result = ThreatAnalysisResult()
        self._detection_stats["total_scans"] += 1

        try:
            # 静态模式检测
            pattern_threats = await self._detect_malicious_patterns(code, context)
            for threat in pattern_threats:
                result.add_threat(threat)

            # AST分析
            ast_threats = await self._analyze_ast(code, context)
            for threat in ast_threats:
                result.add_threat(threat)

            # 导入分析
            import_threats = await self._analyze_imports(code, context)
            for threat in import_threats:
                result.add_threat(threat)

            # 函数调用分析
            function_threats = await self._analyze_function_calls(code, context)
            for threat in function_threats:
                result.add_threat(threat)

            # 生成建议
            if result.is_threat:
                result.recommendations = self._generate_recommendations(
                    result.threat_events
                )
                self._detection_stats["threats_detected"] += 1

            # 存储威胁事件
            for event in result.threat_events:
                self._threat_events.append(event)

            return result

        except Exception as e:
            logger.error(f"Code analysis failed: {e}")
            return result

    async def _detect_malicious_patterns(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> List[ThreatEvent]:
        """检测恶意代码模式"""
        threats = []

        for pattern in self._malicious_patterns:
            matches = pattern.findall(code)
            if matches:
                for match in matches:
                    threat = ThreatEvent(
                        event_id=self._generate_event_id(),
                        threat_type=ThreatType.MALICIOUS_CODE,
                        threat_level=ThreatLevel.HIGH,
                        title="Malicious Code Pattern Detected",
                        description=f"Detected dangerous pattern: {match}",
                        source="pattern_detector",
                        detection_method="regex_pattern",
                        confidence_score=0.8,
                        evidence={
                            "pattern": pattern.pattern,
                            "match": match,
                            "code_snippet": self._extract_code_snippet(code, match),
                        },
                    )

                    if context:
                        threat.user_id = context.get("user_id")
                        threat.adapter_id = context.get("adapter_id")
                        threat.ip_address = context.get("ip_address")
                        threat.session_id = context.get("session_id")

                    threats.append(threat)

        return threats

    async def _analyze_ast(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> List[ThreatEvent]:
        """AST分析"""
        threats = []

        try:
            tree = ast.parse(code)

            # 分析节点
            for node in ast.walk(tree):
                # 检查函数调用
                if isinstance(node, ast.Call):
                    threat = await self._analyze_function_call_node(node, code, context)
                    if threat:
                        threats.append(threat)

                # 检查导入语句
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    threat = await self._analyze_import_node(node, code, context)
                    if threat:
                        threats.append(threat)

                # 检查属性访问
                elif isinstance(node, ast.Attribute):
                    threat = await self._analyze_attribute_node(node, code, context)
                    if threat:
                        threats.append(threat)

        except SyntaxError as e:
            # 语法错误可能是混淆代码的迹象
            threat = ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.MALICIOUS_CODE,
                threat_level=ThreatLevel.MEDIUM,
                title="Syntax Error in Code",
                description="Code contains syntax errors, possible obfuscation attempt",
                source="ast_analyzer",
                detection_method="syntax_analysis",
                confidence_score=0.6,
                evidence={"syntax_error": str(e)},
            )

            if context:
                threat.user_id = context.get("user_id")
                threat.adapter_id = context.get("adapter_id")
                threat.ip_address = context.get("ip_address")
                threat.session_id = context.get("session_id")

            threats.append(threat)

        return threats

    async def _analyze_function_call_node(
        self, node: ast.Call, code: str, context: Optional[Dict[str, Any]] = None
    ) -> Optional[ThreatEvent]:
        """分析函数调用节点"""
        func_name = ""

        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        if func_name in self._dangerous_functions:
            return ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.MALICIOUS_CODE,
                threat_level=ThreatLevel.HIGH,
                title="Dangerous Function Call",
                description=f"Call to dangerous function: {func_name}",
                source="ast_analyzer",
                detection_method="function_call_analysis",
                confidence_score=0.9,
                evidence={
                    "function_name": func_name,
                    "line_number": getattr(node, "lineno", 0),
                },
            )

        return None

    async def _analyze_import_node(
        self,
        node: ast.Import | ast.ImportFrom,
        code: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[ThreatEvent]:
        """分析导入节点"""
        imported_modules = []

        if isinstance(node, ast.Import):
            imported_modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imported_modules = [node.module]

        suspicious_modules = [
            mod for mod in imported_modules if mod in self._suspicious_imports
        ]

        if suspicious_modules:
            threat_level = (
                ThreatLevel.HIGH
                if any(
                    mod in ["os", "subprocess", "eval"] for mod in suspicious_modules
                )
                else ThreatLevel.MEDIUM
            )

            return ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.MALICIOUS_CODE,
                threat_level=threat_level,
                title="Suspicious Module Import",
                description=f"Import of suspicious modules: {', '.join(suspicious_modules)}",
                source="ast_analyzer",
                detection_method="import_analysis",
                confidence_score=0.7,
                evidence={
                    "imported_modules": suspicious_modules,
                    "line_number": getattr(node, "lineno", 0),
                },
            )

        return None

    async def _analyze_attribute_node(
        self, node: ast.Attribute, code: str, context: Optional[Dict[str, Any]] = None
    ) -> Optional[ThreatEvent]:
        """分析属性访问节点"""
        # 检查危险的属性访问模式
        dangerous_attributes = {
            "__globals__",
            "__locals__",
            "__builtins__",
            "__import__",
            "__getattribute__",
            "__setattr__",
        }

        if node.attr in dangerous_attributes:
            return ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.MALICIOUS_CODE,
                threat_level=ThreatLevel.HIGH,
                title="Dangerous Attribute Access",
                description=f"Access to dangerous attribute: {node.attr}",
                source="ast_analyzer",
                detection_method="attribute_analysis",
                confidence_score=0.8,
                evidence={
                    "attribute_name": node.attr,
                    "line_number": getattr(node, "lineno", 0),
                },
            )

        return None

    async def _analyze_imports(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> List[ThreatEvent]:
        """分析导入语句"""
        threats = []

        # 使用正则表达式检测导入
        import_patterns = [
            r"import\s+(\w+)",
            r"from\s+(\w+)\s+import",
            r'__import__\s*\(\s*["\'](\w+)["\']',
        ]

        for pattern in import_patterns:
            matches = re.findall(pattern, code)
            for match in matches:
                if match in self._suspicious_imports:
                    threat = ThreatEvent(
                        event_id=self._generate_event_id(),
                        threat_type=ThreatType.MALICIOUS_CODE,
                        threat_level=ThreatLevel.MEDIUM,
                        title="Suspicious Import Detected",
                        description=f"Import of suspicious module: {match}",
                        source="import_analyzer",
                        detection_method="import_pattern",
                        confidence_score=0.6,
                        evidence={"module_name": match},
                    )

                    if context:
                        threat.user_id = context.get("user_id")
                        threat.adapter_id = context.get("adapter_id")
                        threat.ip_address = context.get("ip_address")
                        threat.session_id = context.get("session_id")

                    threats.append(threat)

        return threats

    async def _analyze_function_calls(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> List[ThreatEvent]:
        """分析函数调用"""
        threats = []

        # 检测危险函数调用
        for func_name in self._dangerous_functions:
            pattern = rf"{func_name}\s*\("
            if re.search(pattern, code):
                threat = ThreatEvent(
                    event_id=self._generate_event_id(),
                    threat_type=ThreatType.MALICIOUS_CODE,
                    threat_level=ThreatLevel.HIGH,
                    title="Dangerous Function Call",
                    description=f"Call to dangerous function: {func_name}",
                    source="function_analyzer",
                    detection_method="function_pattern",
                    confidence_score=0.8,
                    evidence={"function_name": func_name},
                )

                if context:
                    threat.user_id = context.get("user_id")
                    threat.adapter_id = context.get("adapter_id")
                    threat.ip_address = context.get("ip_address")
                    threat.session_id = context.get("session_id")

                threats.append(threat)

        return threats

    async def analyze_behavior(
        self, user_id: str, action: str, context: Dict[str, Any]
    ) -> ThreatAnalysisResult:
        """分析用户行为"""
        result = ThreatAnalysisResult()

        try:
            # 记录行为
            behavior_record = {
                "timestamp": datetime.now(timezone.utc),
                "action": action,
                "context": context,
            }

            self._user_behavior[user_id].append(behavior_record)

            # 分析异常模式
            threats = await self._detect_behavioral_anomalies(user_id)
            for threat in threats:
                result.add_threat(threat)

            # IP行为分析
            if "ip_address" in context:
                ip_threats = await self._analyze_ip_behavior(
                    context["ip_address"], action, context
                )
                for threat in ip_threats:
                    result.add_threat(threat)

            return result

        except Exception as e:
            logger.error(f"Behavior analysis failed: {e}")
            return result

    async def _detect_behavioral_anomalies(self, user_id: str) -> List[ThreatEvent]:
        """检测行为异常"""
        threats = []
        user_actions = self._user_behavior[user_id]

        if len(user_actions) < 10:  # 需要足够的数据
            return threats

        # 检查频率异常
        recent_actions = [
            action
            for action in user_actions
            if (datetime.now(timezone.utc) - action["timestamp"]).seconds < 300  # 5分钟内
        ]

        if len(recent_actions) > 50:  # 5分钟内超过50个操作
            threat = ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.SUSPICIOUS_BEHAVIOR,
                threat_level=ThreatLevel.MEDIUM,
                title="High Activity Frequency",
                description=f"User {user_id} performed {len(recent_actions)} actions in 5 minutes",
                source="behavior_analyzer",
                user_id=user_id,
                detection_method="frequency_analysis",
                confidence_score=0.7,
                evidence={"action_count": len(recent_actions), "time_window": 300},
            )
            threats.append(threat)

        # 检查异常时间模式
        night_actions = [
            action
            for action in recent_actions
            if action["timestamp"].hour < 6 or action["timestamp"].hour > 22
        ]

        if len(night_actions) > 10:  # 夜间活动过多
            threat = ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.SUSPICIOUS_BEHAVIOR,
                threat_level=ThreatLevel.LOW,
                title="Unusual Time Activity",
                description=f"User {user_id} has unusual night-time activity",
                source="behavior_analyzer",
                user_id=user_id,
                detection_method="time_pattern_analysis",
                confidence_score=0.5,
                evidence={
                    "night_actions": len(night_actions),
                    "total_recent_actions": len(recent_actions),
                },
            )
            threats.append(threat)

        return threats

    async def _analyze_ip_behavior(
        self, ip_address: str, action: str, context: Dict[str, Any]
    ) -> List[ThreatEvent]:
        """分析IP行为"""
        threats = []

        # 记录IP行为
        behavior_record = {
            "timestamp": datetime.now(timezone.utc),
            "action": action,
            "context": context,
        }

        self._ip_behavior[ip_address].append(behavior_record)

        # 检查IP频率
        recent_actions = [
            action
            for action in self._ip_behavior[ip_address]
            if (datetime.now(timezone.utc) - action["timestamp"]).seconds < 60  # 1分钟内
        ]

        if len(recent_actions) > 100:  # 1分钟内超过100个请求
            threat = ThreatEvent(
                event_id=self._generate_event_id(),
                threat_type=ThreatType.DENIAL_OF_SERVICE,
                threat_level=ThreatLevel.HIGH,
                title="Potential DoS Attack",
                description=f"IP {ip_address} made {len(recent_actions)} requests in 1 minute",
                source="behavior_analyzer",
                ip_address=ip_address,
                detection_method="ip_frequency_analysis",
                confidence_score=0.9,
                evidence={"request_count": len(recent_actions), "time_window": 60},
            )
            threats.append(threat)

        return threats

    def _extract_code_snippet(
        self, code: str, match: str, context_lines: int = 2
    ) -> str:
        """提取代码片段"""
        lines = code.split("\n")

        for i, line in enumerate(lines):
            if match in line:
                start = max(0, i - context_lines)
                end = min(len(lines), i + context_lines + 1)
                return "\n".join(lines[start:end])

        return match

    def _generate_event_id(self) -> str:
        """生成事件ID"""
        timestamp = str(int(time.time() * 1000000))
        return hashlib.md5(timestamp.encode()).hexdigest()[:16]

    def _generate_recommendations(self, threat_events: List[ThreatEvent]) -> List[str]:
        """生成安全建议"""
        recommendations = []

        threat_types = {event.threat_type for event in threat_events}

        if ThreatType.MALICIOUS_CODE in threat_types:
            recommendations.extend(
                [
                    "Review and sanitize code before execution",
                    "Implement code sandboxing",
                    "Use static code analysis tools",
                ]
            )

        if ThreatType.SUSPICIOUS_BEHAVIOR in threat_types:
            recommendations.extend(
                [
                    "Monitor user activity patterns",
                    "Implement rate limiting",
                    "Review user permissions",
                ]
            )

        if ThreatType.DENIAL_OF_SERVICE in threat_types:
            recommendations.extend(
                [
                    "Implement IP-based rate limiting",
                    "Use DDoS protection services",
                    "Monitor network traffic",
                ]
            )

        return list(set(recommendations))  # 去重

    # ================================
    # 公共API
    # ================================

    async def create_security_alert(
        self, threat_events: List[ThreatEvent], title: str, description: str
    ) -> SecurityAlert:
        """创建安全警报"""
        alert = SecurityAlert(
            alert_id=self._generate_event_id(),
            threat_events=threat_events,
            severity=self._calculate_alert_severity(threat_events),
            title=title,
            description=description,
        )

        # 聚合信息
        for event in threat_events:
            if event.user_id:
                alert.affected_users.add(event.user_id)
            if event.adapter_id:
                alert.affected_adapters.add(event.adapter_id)
            if event.ip_address:
                alert.source_ips.add(event.ip_address)

        self._security_alerts.append(alert)
        return alert

    def _calculate_alert_severity(
        self, threat_events: List[ThreatEvent]
    ) -> AuditSeverity:
        """计算警报严重程度"""
        if not threat_events:
            return AuditSeverity.LOW

        max_level = max(event.threat_level for event in threat_events)

        level_mapping = {
            ThreatLevel.LOW: AuditSeverity.LOW,
            ThreatLevel.MEDIUM: AuditSeverity.MEDIUM,
            ThreatLevel.HIGH: AuditSeverity.HIGH,
            ThreatLevel.CRITICAL: AuditSeverity.CRITICAL,
        }

        return level_mapping.get(max_level, AuditSeverity.MEDIUM)

    def get_detection_stats(self) -> Dict[str, Any]:
        """获取检测统计"""
        return self._detection_stats.copy()

    def get_recent_threats(self, limit: int = 100) -> List[ThreatEvent]:
        """获取最近的威胁事件"""
        return list(self._threat_events)[-limit:]

    def get_security_alerts(self, limit: int = 50) -> List[SecurityAlert]:
        """获取安全警报"""
        return list(self._security_alerts)[-limit:]

    async def acknowledge_alert(self, alert_id: str) -> bool:
        """确认警报"""
        for alert in self._security_alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return True
        return False

    async def resolve_alert(self, alert_id: str) -> bool:
        """解决警报"""
        for alert in self._security_alerts:
            if alert.alert_id == alert_id:
                alert.resolved = True
                return True
        return False

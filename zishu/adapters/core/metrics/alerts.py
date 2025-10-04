"""
指标告警系统

提供基于指标的实时告警和通知功能。
"""

import asyncio
import logging
import json
import time
import smtplib
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import threading
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart

from .core import MetricType, MetricSample, Metric, MetricFamily, AggregationType, MetricAggregator
from .dashboard import MetricsQuery, QueryBuilder, MetricsQueryEngine

# 尝试导入可选依赖
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

logger = logging.getLogger(__name__)


# ================================
# 告警级别和条件
# ================================

class AlertLevel(str, Enum):
    """告警级别"""
    INFO = "info"           # 信息
    WARNING = "warning"     # 警告
    ERROR = "error"         # 错误
    CRITICAL = "critical"   # 严重


class AlertConditionType(str, Enum):
    """告警条件类型"""
    THRESHOLD = "threshold"         # 阈值
    CHANGE_RATE = "change_rate"     # 变化率
    ANOMALY = "anomaly"             # 异常检测
    MISSING_DATA = "missing_data"   # 数据缺失
    CUSTOM = "custom"               # 自定义


class ComparisonOperator(str, Enum):
    """比较操作符"""
    GT = "gt"       # 大于
    GTE = "gte"     # 大于等于
    LT = "lt"       # 小于
    LTE = "lte"     # 小于等于
    EQ = "eq"       # 等于
    NE = "ne"       # 不等于


@dataclass
class AlertCondition:
    """告警条件"""
    condition_type: AlertConditionType
    operator: ComparisonOperator
    threshold: float
    
    # 时间窗口配置
    evaluation_window: timedelta = field(default_factory=lambda: timedelta(minutes=5))
    aggregation: AggregationType = AggregationType.AVG
    
    # 高级配置
    min_samples: int = 1  # 最小样本数
    consecutive_violations: int = 1  # 连续违规次数
    
    def evaluate(self, samples: List[MetricSample], aggregator: MetricAggregator) -> bool:
        """评估条件是否满足"""
        if len(samples) < self.min_samples:
            return False
        
        if self.condition_type == AlertConditionType.THRESHOLD:
            return self._evaluate_threshold(samples, aggregator)
        elif self.condition_type == AlertConditionType.CHANGE_RATE:
            return self._evaluate_change_rate(samples, aggregator)
        elif self.condition_type == AlertConditionType.MISSING_DATA:
            return self._evaluate_missing_data(samples)
        elif self.condition_type == AlertConditionType.ANOMALY:
            return self._evaluate_anomaly(samples, aggregator)
        
        return False
    
    def _evaluate_threshold(self, samples: List[MetricSample], aggregator: MetricAggregator) -> bool:
        """评估阈值条件"""
        aggregated_value = aggregator.aggregate(samples, self.aggregation)
        if aggregated_value is None:
            return False
        
        return self._compare_values(aggregated_value, self.threshold)
    
    def _evaluate_change_rate(self, samples: List[MetricSample], aggregator: MetricAggregator) -> bool:
        """评估变化率条件"""
        if len(samples) < 2:
            return False
        
        # 计算变化率
        sorted_samples = sorted(samples, key=lambda s: s.timestamp)
        first_value = sorted_samples[0].value
        last_value = sorted_samples[-1].value
        
        if first_value == 0:
            return False
        
        change_rate = (last_value - first_value) / first_value * 100
        return self._compare_values(change_rate, self.threshold)
    
    def _evaluate_missing_data(self, samples: List[MetricSample]) -> bool:
        """评估数据缺失条件"""
        # 检查是否在评估窗口内缺少数据
        now = datetime.now(timezone.utc)
        window_start = now - self.evaluation_window
        
        recent_samples = [s for s in samples if s.timestamp >= window_start]
        return len(recent_samples) == 0
    
    def _evaluate_anomaly(self, samples: List[MetricSample], aggregator: MetricAggregator) -> bool:
        """评估异常条件"""
        if len(samples) < 10:  # 需要足够的历史数据
            return False
        
        # 简单的异常检测：基于标准差
        values = [s.value for s in samples]
        mean_value = sum(values) / len(values)
        variance = sum((v - mean_value) ** 2 for v in values) / len(values)
        std_dev = variance ** 0.5
        
        # 最新值
        latest_value = samples[-1].value
        
        # 如果最新值超出3个标准差，认为是异常
        z_score = abs(latest_value - mean_value) / std_dev if std_dev > 0 else 0
        return z_score > 3.0
    
    def _compare_values(self, value: float, threshold: float) -> bool:
        """比较值"""
        if self.operator == ComparisonOperator.GT:
            return value > threshold
        elif self.operator == ComparisonOperator.GTE:
            return value >= threshold
        elif self.operator == ComparisonOperator.LT:
            return value < threshold
        elif self.operator == ComparisonOperator.LTE:
            return value <= threshold
        elif self.operator == ComparisonOperator.EQ:
            return abs(value - threshold) < 1e-6
        elif self.operator == ComparisonOperator.NE:
            return abs(value - threshold) >= 1e-6
        
        return False
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'condition_type': self.condition_type.value,
            'operator': self.operator.value,
            'threshold': self.threshold,
            'evaluation_window': self.evaluation_window.total_seconds(),
            'aggregation': self.aggregation.value,
            'min_samples': self.min_samples,
            'consecutive_violations': self.consecutive_violations
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AlertCondition':
        """从字典创建"""
        return cls(
            condition_type=AlertConditionType(data['condition_type']),
            operator=ComparisonOperator(data['operator']),
            threshold=data['threshold'],
            evaluation_window=timedelta(seconds=data.get('evaluation_window', 300)),
            aggregation=AggregationType(data.get('aggregation', 'avg')),
            min_samples=data.get('min_samples', 1),
            consecutive_violations=data.get('consecutive_violations', 1)
        )


# ================================
# 告警规则
# ================================

@dataclass
class AlertRule:
    """告警规则"""
    id: str
    name: str
    description: str = ""
    
    # 查询配置
    query: MetricsQuery = field(default_factory=MetricsQuery)
    
    # 告警条件
    conditions: List[AlertCondition] = field(default_factory=list)
    level: AlertLevel = AlertLevel.WARNING
    
    # 执行配置
    enabled: bool = True
    evaluation_interval: timedelta = field(default_factory=lambda: timedelta(minutes=1))
    
    # 通知配置
    notification_channels: List[str] = field(default_factory=list)
    
    # 抑制配置
    cooldown_period: timedelta = field(default_factory=lambda: timedelta(minutes=15))
    max_alerts_per_hour: int = 10
    
    # 元数据
    labels: Dict[str, str] = field(default_factory=dict)
    annotations: Dict[str, str] = field(default_factory=dict)
    
    # 状态
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def add_condition(self, condition: AlertCondition) -> None:
        """添加告警条件"""
        self.conditions.append(condition)
        self.updated_at = datetime.now(timezone.utc)
    
    def evaluate_conditions(self, metrics: List[MetricFamily], aggregator: MetricAggregator) -> Tuple[bool, List[str]]:
        """评估所有条件"""
        if not self.conditions:
            return False, []
        
        violations = []
        
        for i, condition in enumerate(self.conditions):
            # 收集相关样本
            all_samples = []
            for family in metrics:
                for metric in family.get_all_metrics():
                    all_samples.extend(metric.samples)
            
            # 过滤时间窗口内的样本
            now = datetime.now(timezone.utc)
            window_start = now - condition.evaluation_window
            window_samples = [
                s for s in all_samples
                if s.timestamp >= window_start
            ]
            
            # 评估条件
            if condition.evaluate(window_samples, aggregator):
                violations.append(f"Condition {i+1}: {condition.condition_type.value} violation")
        
        # 所有条件都必须满足才触发告警
        is_triggered = len(violations) == len(self.conditions)
        
        return is_triggered, violations
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'query': self.query.to_dict(),
            'conditions': [c.to_dict() for c in self.conditions],
            'level': self.level.value,
            'enabled': self.enabled,
            'evaluation_interval': self.evaluation_interval.total_seconds(),
            'notification_channels': self.notification_channels,
            'cooldown_period': self.cooldown_period.total_seconds(),
            'max_alerts_per_hour': self.max_alerts_per_hour,
            'labels': self.labels,
            'annotations': self.annotations,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AlertRule':
        """从字典创建"""
        rule = cls(
            id=data['id'],
            name=data['name'],
            description=data.get('description', ''),
            query=MetricsQuery.from_dict(data.get('query', {})),
            level=AlertLevel(data.get('level', 'warning')),
            enabled=data.get('enabled', True),
            evaluation_interval=timedelta(seconds=data.get('evaluation_interval', 60)),
            notification_channels=data.get('notification_channels', []),
            cooldown_period=timedelta(seconds=data.get('cooldown_period', 900)),
            max_alerts_per_hour=data.get('max_alerts_per_hour', 10),
            labels=data.get('labels', {}),
            annotations=data.get('annotations', {})
        )
        
        # 解析条件
        conditions_data = data.get('conditions', [])
        rule.conditions = [AlertCondition.from_dict(c) for c in conditions_data]
        
        # 解析时间
        if data.get('created_at'):
            rule.created_at = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at'):
            rule.updated_at = datetime.fromisoformat(data['updated_at'])
        
        return rule


# ================================
# 告警事件
# ================================

@dataclass
class AlertEvent:
    """告警事件"""
    id: str
    rule_id: str
    rule_name: str
    level: AlertLevel
    
    # 事件信息
    message: str
    description: str = ""
    violations: List[str] = field(default_factory=list)
    
    # 指标信息
    metric_values: Dict[str, float] = field(default_factory=dict)
    
    # 时间信息
    triggered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    
    # 状态
    is_resolved: bool = False
    
    # 元数据
    labels: Dict[str, str] = field(default_factory=dict)
    annotations: Dict[str, str] = field(default_factory=dict)
    
    def resolve(self) -> None:
        """解决告警"""
        self.is_resolved = True
        self.resolved_at = datetime.now(timezone.utc)
    
    def get_duration(self) -> timedelta:
        """获取告警持续时间"""
        end_time = self.resolved_at or datetime.now(timezone.utc)
        return end_time - self.triggered_at
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'rule_name': self.rule_name,
            'level': self.level.value,
            'message': self.message,
            'description': self.description,
            'violations': self.violations,
            'metric_values': self.metric_values,
            'triggered_at': self.triggered_at.isoformat(),
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'is_resolved': self.is_resolved,
            'duration_seconds': self.get_duration().total_seconds(),
            'labels': self.labels,
            'annotations': self.annotations
        }


# ================================
# 通知器
# ================================

class AlertNotifier(ABC):
    """告警通知器基类"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """初始化通知器"""
        self.name = name
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # 统计信息
        self.sent_count = 0
        self.error_count = 0
        self.last_sent_time: Optional[datetime] = None
        self.last_error: Optional[str] = None
    
    @abstractmethod
    async def send_alert(self, event: AlertEvent) -> bool:
        """发送告警通知"""
        pass
    
    def format_message(self, event: AlertEvent) -> str:
        """格式化告警消息"""
        lines = [
            f"🚨 Alert: {event.rule_name}",
            f"Level: {event.level.value.upper()}",
            f"Message: {event.message}",
            f"Time: {event.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        ]
        
        if event.description:
            lines.append(f"Description: {event.description}")
        
        if event.violations:
            lines.append("Violations:")
            for violation in event.violations:
                lines.append(f"  - {violation}")
        
        if event.metric_values:
            lines.append("Metric Values:")
            for metric, value in event.metric_values.items():
                lines.append(f"  - {metric}: {value}")
        
        if event.labels:
            lines.append("Labels:")
            for key, value in event.labels.items():
                lines.append(f"  - {key}: {value}")
        
        return "\n".join(lines)
    
    def _update_stats(self, success: bool, error_message: Optional[str] = None) -> None:
        """更新统计信息"""
        if success:
            self.sent_count += 1
            self.last_sent_time = datetime.now(timezone.utc)
        else:
            self.error_count += 1
            self.last_error = error_message
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            'name': self.name,
            'sent_count': self.sent_count,
            'error_count': self.error_count,
            'last_sent_time': self.last_sent_time.isoformat() if self.last_sent_time else None,
            'last_error': self.last_error
        }


class EmailNotifier(AlertNotifier):
    """邮件通知器"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        super().__init__(name, config)
        
        # SMTP配置
        self.smtp_host = config.get('smtp_host', 'localhost')
        self.smtp_port = config.get('smtp_port', 587)
        self.smtp_username = config.get('smtp_username')
        self.smtp_password = config.get('smtp_password')
        self.use_tls = config.get('use_tls', True)
        
        # 邮件配置
        self.from_email = config.get('from_email', 'alerts@zishu.com')
        self.to_emails = config.get('to_emails', [])
        self.subject_template = config.get('subject_template', '[Alert] {level}: {rule_name}')
    
    async def send_alert(self, event: AlertEvent) -> bool:
        """发送邮件告警"""
        try:
            # 构建邮件
            subject = self.subject_template.format(
                level=event.level.value.upper(),
                rule_name=event.rule_name
            )
            
            body = self.format_message(event)
            
            # 创建邮件消息
            msg = MimeMultipart()
            msg['From'] = self.from_email
            msg['To'] = ', '.join(self.to_emails)
            msg['Subject'] = subject
            
            msg.attach(MimeText(body, 'plain', 'utf-8'))
            
            # 发送邮件
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._send_email, msg)
            
            self._update_stats(True)
            return True
            
        except Exception as e:
            error_msg = f"Failed to send email alert: {e}"
            self.logger.error(error_msg)
            self._update_stats(False, error_msg)
            return False
    
    def _send_email(self, msg: MimeMultipart) -> None:
        """发送邮件(同步)"""
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.use_tls:
                server.starttls()
            
            if self.smtp_username and self.smtp_password:
                server.login(self.smtp_username, self.smtp_password)
            
            server.send_message(msg)


class SlackNotifier(AlertNotifier):
    """Slack通知器"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        super().__init__(name, config)
        
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests not available. Install with: pip install requests")
        
        self.webhook_url = config.get('webhook_url')
        self.channel = config.get('channel', '#alerts')
        self.username = config.get('username', 'Zishu Alerts')
        self.icon_emoji = config.get('icon_emoji', ':warning:')
    
    async def send_alert(self, event: AlertEvent) -> bool:
        """发送Slack告警"""
        try:
            # 构建Slack消息
            color_map = {
                AlertLevel.INFO: 'good',
                AlertLevel.WARNING: 'warning',
                AlertLevel.ERROR: 'danger',
                AlertLevel.CRITICAL: 'danger'
            }
            
            attachment = {
                'color': color_map.get(event.level, 'warning'),
                'title': f"{event.level.value.upper()}: {event.rule_name}",
                'text': event.message,
                'fields': [
                    {
                        'title': 'Time',
                        'value': event.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC'),
                        'short': True
                    }
                ],
                'footer': 'Zishu Metrics',
                'ts': int(event.triggered_at.timestamp())
            }
            
            if event.description:
                attachment['fields'].append({
                    'title': 'Description',
                    'value': event.description,
                    'short': False
                })
            
            if event.violations:
                attachment['fields'].append({
                    'title': 'Violations',
                    'value': '\n'.join(f"• {v}" for v in event.violations),
                    'short': False
                })
            
            payload = {
                'channel': self.channel,
                'username': self.username,
                'icon_emoji': self.icon_emoji,
                'attachments': [attachment]
            }
            
            # 发送请求
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.post(self.webhook_url, json=payload, timeout=10)
            )
            
            if response.status_code == 200:
                self._update_stats(True)
                return True
            else:
                error_msg = f"Slack API error: {response.status_code} - {response.text}"
                self._update_stats(False, error_msg)
                return False
                
        except Exception as e:
            error_msg = f"Failed to send Slack alert: {e}"
            self.logger.error(error_msg)
            self._update_stats(False, error_msg)
            return False


class WebhookNotifier(AlertNotifier):
    """Webhook通知器"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        super().__init__(name, config)
        
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests not available. Install with: pip install requests")
        
        self.webhook_url = config.get('webhook_url')
        self.method = config.get('method', 'POST').upper()
        self.headers = config.get('headers', {'Content-Type': 'application/json'})
        self.timeout = config.get('timeout', 10)
    
    async def send_alert(self, event: AlertEvent) -> bool:
        """发送Webhook告警"""
        try:
            # 构建请求数据
            payload = {
                'alert': event.to_dict(),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'source': 'zishu-metrics'
            }
            
            # 发送请求
            loop = asyncio.get_event_loop()
            
            if self.method == 'POST':
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.post(
                        self.webhook_url,
                        json=payload,
                        headers=self.headers,
                        timeout=self.timeout
                    )
                )
            elif self.method == 'PUT':
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.put(
                        self.webhook_url,
                        json=payload,
                        headers=self.headers,
                        timeout=self.timeout
                    )
                )
            else:
                raise ValueError(f"Unsupported HTTP method: {self.method}")
            
            if 200 <= response.status_code < 300:
                self._update_stats(True)
                return True
            else:
                error_msg = f"Webhook error: {response.status_code} - {response.text}"
                self._update_stats(False, error_msg)
                return False
                
        except Exception as e:
            error_msg = f"Failed to send webhook alert: {e}"
            self.logger.error(error_msg)
            self._update_stats(False, error_msg)
            return False


# ================================
# 告警管理器
# ================================

class MetricsAlertManager:
    """指标告警管理器"""
    
    def __init__(self, query_engine: MetricsQueryEngine):
        """初始化告警管理器"""
        self.query_engine = query_engine
        self.aggregator = MetricAggregator()
        
        # 规则和事件存储
        self._rules: Dict[str, AlertRule] = {}
        self._events: Dict[str, AlertEvent] = {}
        self._active_events: Dict[str, AlertEvent] = {}  # 未解决的事件
        
        # 通知器
        self._notifiers: Dict[str, AlertNotifier] = {}
        
        # 评估状态
        self._rule_states: Dict[str, Dict[str, Any]] = {}  # 规则状态跟踪
        self._evaluation_tasks: Set[asyncio.Task] = set()
        
        # 抑制管理
        self._cooldown_tracker: Dict[str, datetime] = {}  # 冷却期跟踪
        self._alert_counters: Dict[str, deque] = defaultdict(lambda: deque())  # 告警计数
        
        # 线程安全
        self._lock = threading.RLock()
        
        # 运行状态
        self._running = False
        self._evaluation_task: Optional[asyncio.Task] = None
        
        self.logger = logging.getLogger(f"{__name__}.MetricsAlertManager")
    
    async def start(self) -> None:
        """启动告警管理器"""
        if self._running:
            return
        
        self._running = True
        
        # 启动评估循环
        self._evaluation_task = asyncio.create_task(self._evaluation_loop())
        
        self.logger.info("MetricsAlertManager started")
    
    async def stop(self) -> None:
        """停止告警管理器"""
        if not self._running:
            return
        
        self._running = False
        
        # 停止评估任务
        if self._evaluation_task:
            self._evaluation_task.cancel()
            try:
                await self._evaluation_task
            except asyncio.CancelledError:
                pass
        
        # 等待所有评估任务完成
        if self._evaluation_tasks:
            await asyncio.gather(*self._evaluation_tasks, return_exceptions=True)
            self._evaluation_tasks.clear()
        
        self.logger.info("MetricsAlertManager stopped")
    
    def add_rule(self, rule: AlertRule) -> None:
        """添加告警规则"""
        with self._lock:
            self._rules[rule.id] = rule
            self._rule_states[rule.id] = {
                'last_evaluation': None,
                'consecutive_violations': 0,
                'last_violation_time': None
            }
        
        self.logger.info(f"Added alert rule: {rule.name} ({rule.id})")
    
    def remove_rule(self, rule_id: str) -> bool:
        """移除告警规则"""
        with self._lock:
            if rule_id in self._rules:
                del self._rules[rule_id]
                
                # 清理相关状态
                if rule_id in self._rule_states:
                    del self._rule_states[rule_id]
                if rule_id in self._cooldown_tracker:
                    del self._cooldown_tracker[rule_id]
                if rule_id in self._alert_counters:
                    del self._alert_counters[rule_id]
                
                # 解决相关的活跃事件
                events_to_resolve = [
                    event for event in self._active_events.values()
                    if event.rule_id == rule_id
                ]
                for event in events_to_resolve:
                    self._resolve_event(event.id)
                
                self.logger.info(f"Removed alert rule: {rule_id}")
                return True
            
            return False
    
    def get_rule(self, rule_id: str) -> Optional[AlertRule]:
        """获取告警规则"""
        with self._lock:
            return self._rules.get(rule_id)
    
    def list_rules(self) -> List[AlertRule]:
        """列出所有告警规则"""
        with self._lock:
            return list(self._rules.values())
    
    def add_notifier(self, notifier: AlertNotifier) -> None:
        """添加通知器"""
        self._notifiers[notifier.name] = notifier
        self.logger.info(f"Added notifier: {notifier.name}")
    
    def remove_notifier(self, name: str) -> bool:
        """移除通知器"""
        if name in self._notifiers:
            del self._notifiers[name]
            self.logger.info(f"Removed notifier: {name}")
            return True
        return False
    
    def get_notifier(self, name: str) -> Optional[AlertNotifier]:
        """获取通知器"""
        return self._notifiers.get(name)
    
    def list_notifiers(self) -> List[AlertNotifier]:
        """列出所有通知器"""
        return list(self._notifiers.values())
    
    async def evaluate_rule(self, rule: AlertRule) -> Optional[AlertEvent]:
        """评估单个规则"""
        try:
            # 检查规则是否启用
            if not rule.enabled:
                return None
            
            # 检查冷却期
            if self._is_in_cooldown(rule.id):
                return None
            
            # 检查频率限制
            if self._is_rate_limited(rule.id):
                return None
            
            # 执行查询
            query_result = await self.query_engine.execute(rule.query)
            
            # 评估条件
            is_triggered, violations = rule.evaluate_conditions(query_result.metrics, self.aggregator)
            
            # 更新规则状态
            with self._lock:
                state = self._rule_states[rule.id]
                state['last_evaluation'] = datetime.now(timezone.utc)
                
                if is_triggered:
                    state['consecutive_violations'] += 1
                    state['last_violation_time'] = datetime.now(timezone.utc)
                else:
                    state['consecutive_violations'] = 0
            
            # 检查是否需要触发告警
            if is_triggered and state['consecutive_violations'] >= rule.conditions[0].consecutive_violations:
                # 创建告警事件
                event = self._create_alert_event(rule, violations, query_result.metrics)
                
                # 发送通知
                await self._send_notifications(event, rule.notification_channels)
                
                # 更新冷却期和计数器
                self._update_cooldown(rule.id)
                self._update_alert_counter(rule.id)
                
                return event
            
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to evaluate rule {rule.id}: {e}")
            return None
    
    def _create_alert_event(self, rule: AlertRule, violations: List[str], metrics: List[MetricFamily]) -> AlertEvent:
        """创建告警事件"""
        event_id = f"alert_{int(time.time() * 1000)}"
        
        # 收集指标值
        metric_values = {}
        for family in metrics:
            for metric in family.get_all_metrics():
                if metric.samples:
                    latest_sample = metric.samples[-1]
                    key = f"{metric.name}"
                    if metric.labels:
                        label_str = ",".join(f"{k}={v}" for k, v in metric.labels.items())
                        key += f"({label_str})"
                    metric_values[key] = latest_sample.value
        
        # 构建消息
        message = f"Alert triggered for rule: {rule.name}"
        if violations:
            message += f" - {', '.join(violations)}"
        
        event = AlertEvent(
            id=event_id,
            rule_id=rule.id,
            rule_name=rule.name,
            level=rule.level,
            message=message,
            description=rule.description,
            violations=violations,
            metric_values=metric_values,
            labels=rule.labels.copy(),
            annotations=rule.annotations.copy()
        )
        
        # 存储事件
        with self._lock:
            self._events[event_id] = event
            self._active_events[event_id] = event
        
        self.logger.warning(f"Alert triggered: {rule.name} - {message}")
        
        return event
    
    async def _send_notifications(self, event: AlertEvent, channels: List[str]) -> None:
        """发送通知"""
        if not channels:
            return
        
        notification_tasks = []
        
        for channel in channels:
            notifier = self._notifiers.get(channel)
            if notifier:
                task = asyncio.create_task(notifier.send_alert(event))
                notification_tasks.append(task)
            else:
                self.logger.warning(f"Notifier not found: {channel}")
        
        if notification_tasks:
            results = await asyncio.gather(*notification_tasks, return_exceptions=True)
            
            success_count = sum(1 for r in results if r is True)
            self.logger.info(f"Sent {success_count}/{len(notification_tasks)} notifications for event {event.id}")
    
    def _is_in_cooldown(self, rule_id: str) -> bool:
        """检查是否在冷却期"""
        if rule_id not in self._cooldown_tracker:
            return False
        
        rule = self._rules.get(rule_id)
        if not rule:
            return False
        
        last_alert_time = self._cooldown_tracker[rule_id]
        return datetime.now(timezone.utc) - last_alert_time < rule.cooldown_period
    
    def _is_rate_limited(self, rule_id: str) -> bool:
        """检查是否超出频率限制"""
        rule = self._rules.get(rule_id)
        if not rule:
            return False
        
        now = datetime.now(timezone.utc)
        hour_ago = now - timedelta(hours=1)
        
        # 清理过期的计数
        counter = self._alert_counters[rule_id]
        while counter and counter[0] < hour_ago:
            counter.popleft()
        
        return len(counter) >= rule.max_alerts_per_hour
    
    def _update_cooldown(self, rule_id: str) -> None:
        """更新冷却期"""
        self._cooldown_tracker[rule_id] = datetime.now(timezone.utc)
    
    def _update_alert_counter(self, rule_id: str) -> None:
        """更新告警计数器"""
        self._alert_counters[rule_id].append(datetime.now(timezone.utc))
    
    def resolve_event(self, event_id: str) -> bool:
        """手动解决告警事件"""
        return self._resolve_event(event_id)
    
    def _resolve_event(self, event_id: str) -> bool:
        """解决告警事件"""
        with self._lock:
            if event_id in self._active_events:
                event = self._active_events[event_id]
                event.resolve()
                del self._active_events[event_id]
                
                self.logger.info(f"Resolved alert event: {event_id}")
                return True
            
            return False
    
    def get_event(self, event_id: str) -> Optional[AlertEvent]:
        """获取告警事件"""
        with self._lock:
            return self._events.get(event_id)
    
    def list_events(self, active_only: bool = False) -> List[AlertEvent]:
        """列出告警事件"""
        with self._lock:
            if active_only:
                return list(self._active_events.values())
            else:
                return list(self._events.values())
    
    async def _evaluation_loop(self) -> None:
        """评估循环"""
        self.logger.info("Starting alert evaluation loop")
        
        while self._running:
            try:
                # 获取需要评估的规则
                rules_to_evaluate = []
                now = datetime.now(timezone.utc)
                
                with self._lock:
                    for rule in self._rules.values():
                        if not rule.enabled:
                            continue
                        
                        state = self._rule_states.get(rule.id, {})
                        last_evaluation = state.get('last_evaluation')
                        
                        if (last_evaluation is None or 
                            now - last_evaluation >= rule.evaluation_interval):
                            rules_to_evaluate.append(rule)
                
                # 并发评估规则
                if rules_to_evaluate:
                    evaluation_tasks = []
                    for rule in rules_to_evaluate:
                        task = asyncio.create_task(self.evaluate_rule(rule))
                        evaluation_tasks.append(task)
                        self._evaluation_tasks.add(task)
                    
                    # 等待评估完成
                    await asyncio.gather(*evaluation_tasks, return_exceptions=True)
                    
                    # 清理完成的任务
                    self._evaluation_tasks = {t for t in self._evaluation_tasks if not t.done()}
                
                # 等待一段时间再进行下次评估
                await asyncio.sleep(10)  # 每10秒检查一次
                
            except Exception as e:
                self.logger.error(f"Error in evaluation loop: {e}")
                await asyncio.sleep(30)  # 出错时等待更长时间
    
    def get_status(self) -> Dict[str, Any]:
        """获取告警管理器状态"""
        with self._lock:
            return {
                'running': self._running,
                'rules_count': len(self._rules),
                'active_events_count': len(self._active_events),
                'total_events_count': len(self._events),
                'notifiers_count': len(self._notifiers),
                'evaluation_tasks_count': len(self._evaluation_tasks),
                'rules': [
                    {
                        'id': rule.id,
                        'name': rule.name,
                        'enabled': rule.enabled,
                        'level': rule.level.value,
                        'last_evaluation': self._rule_states.get(rule.id, {}).get('last_evaluation'),
                        'consecutive_violations': self._rule_states.get(rule.id, {}).get('consecutive_violations', 0)
                    }
                    for rule in self._rules.values()
                ],
                'notifiers': [notifier.get_stats() for notifier in self._notifiers.values()]
            }
    
    def create_default_rules(self) -> List[AlertRule]:
        """创建默认告警规则"""
        rules = []
        
        # CPU使用率告警
        cpu_rule = AlertRule(
            id="cpu_high_usage",
            name="High CPU Usage",
            description="CPU usage is above 80%",
            query=QueryBuilder().metrics("system_cpu_percent").last(timedelta(minutes=5)).build(),
            level=AlertLevel.WARNING
        )
        cpu_condition = AlertCondition(
            condition_type=AlertConditionType.THRESHOLD,
            operator=ComparisonOperator.GT,
            threshold=80.0,
            evaluation_window=timedelta(minutes=5),
            aggregation=AggregationType.AVG,
            consecutive_violations=2
        )
        cpu_rule.add_condition(cpu_condition)
        rules.append(cpu_rule)
        
        # 内存使用率告警
        memory_rule = AlertRule(
            id="memory_high_usage",
            name="High Memory Usage",
            description="Memory usage is above 90%",
            query=QueryBuilder().metrics("system_memory_percent").last(timedelta(minutes=5)).build(),
            level=AlertLevel.ERROR
        )
        memory_condition = AlertCondition(
            condition_type=AlertConditionType.THRESHOLD,
            operator=ComparisonOperator.GT,
            threshold=90.0,
            evaluation_window=timedelta(minutes=5),
            aggregation=AggregationType.AVG,
            consecutive_violations=1
        )
        memory_rule.add_condition(memory_condition)
        rules.append(memory_rule)
        
        # 适配器错误率告警
        error_rule = AlertRule(
            id="adapter_high_error_rate",
            name="High Adapter Error Rate",
            description="Adapter error rate is above 10%",
            query=QueryBuilder().metrics("adapter_success_rate").last(timedelta(minutes=10)).build(),
            level=AlertLevel.CRITICAL
        )
        error_condition = AlertCondition(
            condition_type=AlertConditionType.THRESHOLD,
            operator=ComparisonOperator.LT,
            threshold=90.0,  # 成功率低于90%
            evaluation_window=timedelta(minutes=10),
            aggregation=AggregationType.AVG,
            consecutive_violations=3
        )
        error_rule.add_condition(error_condition)
        rules.append(error_rule)
        
        # 数据缺失告警
        missing_data_rule = AlertRule(
            id="metrics_missing_data",
            name="Metrics Missing Data",
            description="No metrics data received in the last 10 minutes",
            query=QueryBuilder().metrics("system_cpu_percent").last(timedelta(minutes=10)).build(),
            level=AlertLevel.WARNING
        )
        missing_condition = AlertCondition(
            condition_type=AlertConditionType.MISSING_DATA,
            operator=ComparisonOperator.EQ,
            threshold=0,
            evaluation_window=timedelta(minutes=10)
        )
        missing_data_rule.add_condition(missing_condition)
        rules.append(missing_data_rule)
        
        # 添加规则到管理器
        for rule in rules:
            self.add_rule(rule)
        
        return rules

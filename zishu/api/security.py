"""
Zishu-sensei 安全认证系统
提供全面的安全防护，包括认证、授权、模型安全、训练样本污染防护和适配器隔离
"""

import os
import jwt
import bcrypt
import hashlib
import secrets
import time
import hmac
import base64
import logging
from typing import Dict, List, Optional, Any, Tuple, Union, Set
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass, field
from enum import Enum
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import redis
import sqlite3
import json
import re
import threading
from collections import defaultdict, deque
import ipaddress
import uuid
from urllib.parse import urlparse

# 设置日志
logger = logging.getLogger(__name__)


class SecurityLevel(Enum):
    """安全级别枚举"""

    PUBLIC = "public"
    PROTECTED = "protected"
    PRIVATE = "private"
    CONFIDENTIAL = "confidential"
    TOP_SECRET = "top_secret"


class PermissionType(Enum):
    """权限类型枚举"""

    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    DELETE = "delete"
    ADMIN = "admin"
    MODEL_ACCESS = "model_access"
    TRAINING_ACCESS = "training_access"
    ADAPTER_MANAGE = "adapter_manage"


class ThreatType(Enum):
    """威胁类型枚举"""

    BRUTE_FORCE = "brute_force"
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    CSRF = "csrf"
    DATA_POISONING = "data_poisoning"
    MODEL_EXTRACTION = "model_extraction"
    ADVERSARIAL_ATTACK = "adversarial_attack"
    PRIVILEGE_ESCALATION = "privilege_escalation"


@dataclass
class SecurityContext:
    """安全上下文"""

    user_id: str
    session_id: str
    permissions: Set[PermissionType]
    security_level: SecurityLevel
    ip_address: str
    user_agent: str
    timestamp: datetime
    adapter_permissions: Dict[str, Set[PermissionType]] = field(default_factory=dict)
    model_access_tokens: Dict[str, str] = field(default_factory=dict)
    rate_limit_tokens: Dict[str, int] = field(default_factory=dict)


@dataclass
class SecurityEvent:
    """安全事件"""

    event_id: str
    event_type: ThreatType
    severity: str
    user_id: Optional[str]
    ip_address: str
    timestamp: datetime
    details: Dict[str, Any]
    blocked: bool = False


class CryptoUtils:
    """加密工具类"""

    def __init__(self):
        self.fernet_key = self._load_or_generate_key("fernet.key")
        self.fernet = Fernet(self.fernet_key)
        self.rsa_private_key, self.rsa_public_key = self._load_or_generate_rsa_keys()

    def _load_or_generate_key(self, filename: str) -> bytes:
        """加载或生成加密密钥"""
        key_path = f"keys/{filename}"
        os.makedirs("keys", exist_ok=True)

        if os.path.exists(key_path):
            with open(key_path, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_path, "wb") as f:
                f.write(key)
            return key

    def _load_or_generate_rsa_keys(self) -> Tuple[Any, Any]:
        """加载或生成RSA密钥对"""
        private_key_path = "keys/rsa_private.pem"
        public_key_path = "keys/rsa_public.pem"

        if os.path.exists(private_key_path) and os.path.exists(public_key_path):
            with open(private_key_path, "rb") as f:
                private_key = serialization.load_pem_private_key(
                    f.read(), password=None
                )
            with open(public_key_path, "rb") as f:
                public_key = serialization.load_pem_public_key(f.read())
            return private_key, public_key

        # 生成新的RSA密钥对
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()

        # 保存密钥
        with open(private_key_path, "wb") as f:
            f.write(
                private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )
            )

        with open(public_key_path, "wb") as f:
            f.write(
                public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )
            )

        return private_key, public_key

    def encrypt_data(self, data: str) -> str:
        """加密数据"""
        return self.fernet.encrypt(data.encode()).decode()

    def decrypt_data(self, encrypted_data: str) -> str:
        """解密数据"""
        return self.fernet.decrypt(encrypted_data.encode()).decode()

    def rsa_encrypt(self, data: str) -> str:
        """RSA加密"""
        encrypted = self.rsa_public_key.encrypt(
            data.encode(),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return base64.b64encode(encrypted).decode()

    def rsa_decrypt(self, encrypted_data: str) -> str:
        """RSA解密"""
        encrypted_bytes = base64.b64decode(encrypted_data.encode())
        decrypted = self.rsa_private_key.decrypt(
            encrypted_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return decrypted.decode()

    def generate_secure_token(self, length: int = 32) -> str:
        """生成安全令牌"""
        return secrets.token_urlsafe(length)

    def hash_password(self, password: str) -> str:
        """哈希密码"""
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt).decode()

    def verify_password(self, password: str, hashed: str) -> bool:
        """验证密码"""
        return bcrypt.checkpw(password.encode(), hashed.encode())

    def generate_hmac(self, data: str, key: str) -> str:
        """生成HMAC签名"""
        return hmac.new(key.encode(), data.encode(), hashlib.sha256).hexdigest()

    def verify_hmac(self, data: str, signature: str, key: str) -> bool:
        """验证HMAC签名"""
        expected = self.generate_hmac(data, key)
        return hmac.compare_digest(expected, signature)


class RateLimiter:
    """速率限制器"""

    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        self.local_cache = defaultdict(deque)
        self.lock = threading.Lock()

    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """检查是否允许请求"""
        if self.redis_client:
            return self._redis_rate_limit(key, limit, window)
        else:
            return self._local_rate_limit(key, limit, window)

    def _redis_rate_limit(self, key: str, limit: int, window: int) -> bool:
        """Redis实现的速率限制"""
        try:
            current_time = int(time.time())
            pipe = self.redis_client.pipeline()

            # 清理过期记录
            pipe.zremrangebyscore(key, 0, current_time - window)
            # 添加当前请求
            pipe.zadd(key, {str(current_time): current_time})
            # 获取当前计数
            pipe.zcard(key)
            # 设置过期时间
            pipe.expire(key, window)

            results = pipe.execute()
            count = results[2]

            return count <= limit
        except Exception as e:
            logger.error(f"Redis rate limiting error: {e}")
            return True  # 失败时允许请求

    def _local_rate_limit(self, key: str, limit: int, window: int) -> bool:
        """本地实现的速率限制"""
        with self.lock:
            current_time = time.time()

            # 清理过期记录
            while (
                self.local_cache[key]
                and current_time - self.local_cache[key][0] > window
            ):
                self.local_cache[key].popleft()

            # 检查是否超过限制
            if len(self.local_cache[key]) >= limit:
                return False

            # 添加当前请求
            self.local_cache[key].append(current_time)
            return True


class SecurityAuditor:
    """安全审计器"""

    def __init__(self, db_path: str = "security_audit.db"):
        self.db_path = db_path
        self.init_database()
        self.threat_patterns = self._load_threat_patterns()

    def init_database(self):
        """初始化审计数据库"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS security_events (
                    event_id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    user_id TEXT,
                    ip_address TEXT NOT NULL,
                    timestamp DATETIME NOT NULL,
                    details TEXT NOT NULL,
                    blocked BOOLEAN DEFAULT FALSE
                )
            """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    user_agent TEXT,
                    created_at DATETIME NOT NULL,
                    last_activity DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE
                )
            """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS failed_attempts (
                    ip_address TEXT NOT NULL,
                    user_id TEXT,
                    attempt_time DATETIME NOT NULL,
                    attempt_type TEXT NOT NULL
                )
            """
            )

    def _load_threat_patterns(self) -> Dict[ThreatType, List[str]]:
        """加载威胁模式"""
        return {
            ThreatType.SQL_INJECTION: [
                r"(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)",
                r"(\bdrop\b.*\btable\b)|(\btable\b.*\bdrop\b)",
                r"(\binsert\b.*\binto\b)|(\binto\b.*\binsert\b)",
                r"(\bdelete\b.*\bfrom\b)|(\bfrom\b.*\bdelete\b)",
                r"(\bupdate\b.*\bset\b)|(\bset\b.*\bupdate\b)",
                r"(\bor\b.*1\s*=\s*1)|(\band\b.*1\s*=\s*1)",
                r"(\bor\b.*\btrue\b)|(\band\b.*\bfalse\b)",
            ],
            ThreatType.XSS: [
                r"<script[^>]*>.*?</script>",
                r"javascript:",
                r"on\w+\s*=",
                r"<iframe[^>]*>",
                r"<object[^>]*>",
                r"<embed[^>]*>",
                r"<link[^>]*>",
            ],
            ThreatType.DATA_POISONING: [
                r"__proto__",
                r"constructor",
                r"prototype",
                r"eval\s*\(",
                r"Function\s*\(",
                r"setTimeout\s*\(",
                r"setInterval\s*\(",
            ],
        }

    def log_security_event(self, event: SecurityEvent):
        """记录安全事件"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO security_events 
                    (event_id, event_type, severity, user_id, ip_address, timestamp, details, blocked)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        event.event_id,
                        event.event_type.value,
                        event.severity,
                        event.user_id,
                        event.ip_address,
                        event.timestamp,
                        json.dumps(event.details),
                        event.blocked,
                    ),
                )

            logger.warning(
                f"Security event logged: {event.event_type.value} from {event.ip_address}"
            )
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")

    def detect_threats(
        self, data: str, ip_address: str, user_id: Optional[str] = None
    ) -> List[SecurityEvent]:
        """检测威胁"""
        events = []

        for threat_type, patterns in self.threat_patterns.items():
            for pattern in patterns:
                if re.search(pattern, data, re.IGNORECASE):
                    event = SecurityEvent(
                        event_id=str(uuid.uuid4()),
                        event_type=threat_type,
                        severity="HIGH",
                        user_id=user_id,
                        ip_address=ip_address,
                        timestamp=datetime.now(),
                        details={
                            "pattern": pattern,
                            "matched_data": data[:500],  # 限制长度
                            "detection_method": "pattern_matching",
                        },
                        blocked=True,
                    )
                    events.append(event)
                    self.log_security_event(event)

        return events

    def is_suspicious_activity(
        self, ip_address: str, user_id: Optional[str] = None
    ) -> bool:
        """检查可疑活动"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 检查最近1小时内的失败尝试次数
                cursor = conn.execute(
                    """
                    SELECT COUNT(*) FROM failed_attempts 
                    WHERE ip_address = ? AND attempt_time > datetime('now', '-1 hour')
                """,
                    (ip_address,),
                )

                failed_count = cursor.fetchone()[0]

                if failed_count > 5:  # 1小时内超过5次失败
                    return True

                # 检查是否有高危安全事件
                cursor = conn.execute(
                    """
                    SELECT COUNT(*) FROM security_events 
                    WHERE ip_address = ? AND severity = 'HIGH' AND timestamp > datetime('now', '-1 hour')
                """,
                    (ip_address,),
                )

                high_risk_count = cursor.fetchone()[0]

                return high_risk_count > 0

        except Exception as e:
            logger.error(f"Error checking suspicious activity: {e}")
            return False


class ModelSecurityManager:
    """模型安全管理器"""

    def __init__(self, crypto_utils: CryptoUtils):
        self.crypto_utils = crypto_utils
        self.model_permissions = {}
        self.model_access_logs = defaultdict(list)
        self.poisoning_detector = DataPoisoningDetector()

    def register_model(
        self,
        model_id: str,
        security_level: SecurityLevel,
        required_permissions: List[PermissionType],
    ):
        """注册模型"""
        self.model_permissions[model_id] = {
            "security_level": security_level,
            "required_permissions": set(required_permissions),
            "access_token": self.crypto_utils.generate_secure_token(),
            "created_at": datetime.now(),
        }

    def can_access_model(self, context: SecurityContext, model_id: str) -> bool:
        """检查是否可以访问模型"""
        if model_id not in self.model_permissions:
            return False

        model_info = self.model_permissions[model_id]

        # 检查安全级别
        user_level_value = list(SecurityLevel).index(context.security_level)
        model_level_value = list(SecurityLevel).index(model_info["security_level"])

        if user_level_value < model_level_value:
            return False

        # 检查权限
        if not model_info["required_permissions"].issubset(context.permissions):
            return False

        # 记录访问日志
        self.model_access_logs[model_id].append(
            {
                "user_id": context.user_id,
                "timestamp": datetime.now(),
                "ip_address": context.ip_address,
            }
        )

        return True

    def encrypt_model_data(self, model_data: bytes, model_id: str) -> bytes:
        """加密模型数据"""
        if model_id not in self.model_permissions:
            raise ValueError(f"Model {model_id} not registered")

        # 使用模型特定的密钥
        model_key = self.model_permissions[model_id]["access_token"]

        # 创建派生密钥
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=model_id.encode(),
            iterations=100000,
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(model_key.encode()))

        # 加密数据
        f = Fernet(derived_key)
        return f.encrypt(model_data)

    def decrypt_model_data(self, encrypted_data: bytes, model_id: str) -> bytes:
        """解密模型数据"""
        if model_id not in self.model_permissions:
            raise ValueError(f"Model {model_id} not registered")

        model_key = self.model_permissions[model_id]["access_token"]

        # 创建派生密钥
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=model_id.encode(),
            iterations=100000,
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(model_key.encode()))

        # 解密数据
        f = Fernet(derived_key)
        return f.decrypt(encrypted_data)


class DataPoisoningDetector:
    """数据污染检测器"""

    def __init__(self):
        self.suspicious_patterns = [
            # 恶意文本模式
            r"ignore\s+previous\s+instructions",
            r"forget\s+everything",
            r"you\s+are\s+now\s+a",
            r"act\s+as\s+if",
            r"pretend\s+to\s+be",
            # 注入模式
            r"<\|.*?\|>",
            r"\[INST\].*?\[/INST\]",
            r"###\s*Human:",
            r"###\s*Assistant:",
            # 异常字符
            r"[\u200B-\u200D\uFEFF]",  # 零宽字符
            r"[\u202A-\u202E]",  # 方向控制字符
        ]

        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.suspicious_patterns
        ]

    def detect_poisoning(self, text: str) -> Dict[str, Any]:
        """检测数据污染"""
        results = {
            "is_suspicious": False,
            "confidence": 0.0,
            "detected_patterns": [],
            "risk_level": "LOW",
        }

        matches = []
        for i, pattern in enumerate(self.compiled_patterns):
            if pattern.search(text):
                matches.append(
                    {
                        "pattern_index": i,
                        "pattern": self.suspicious_patterns[i],
                        "match": pattern.search(text).group(),
                    }
                )

        if matches:
            results["is_suspicious"] = True
            results["detected_patterns"] = matches
            results["confidence"] = min(len(matches) * 0.3, 1.0)

            if len(matches) >= 3:
                results["risk_level"] = "HIGH"
            elif len(matches) >= 2:
                results["risk_level"] = "MEDIUM"
            else:
                results["risk_level"] = "LOW"

        # 检查统计异常
        stats = self._analyze_text_statistics(text)
        if stats["is_anomalous"]:
            results["is_suspicious"] = True
            results["confidence"] = max(results["confidence"], stats["anomaly_score"])

        return results

    def _analyze_text_statistics(self, text: str) -> Dict[str, Any]:
        """分析文本统计特征"""
        if not text:
            return {"is_anomalous": False, "anomaly_score": 0.0}

        # 计算各种统计特征
        char_count = len(text)
        unique_chars = len(set(text))
        entropy = self._calculate_entropy(text)

        # 异常检测
        anomalies = []

        # 检查字符多样性
        if char_count > 100 and unique_chars / char_count < 0.1:
            anomalies.append("low_char_diversity")

        # 检查熵值
        if entropy < 2.0:  # 熵值过低
            anomalies.append("low_entropy")

        # 检查重复模式
        if self._has_excessive_repetition(text):
            anomalies.append("excessive_repetition")

        return {
            "is_anomalous": len(anomalies) > 0,
            "anomaly_score": min(len(anomalies) * 0.3, 1.0),
            "anomalies": anomalies,
        }

    def _calculate_entropy(self, text: str) -> float:
        """计算文本熵值"""
        if not text:
            return 0.0

        char_counts = defaultdict(int)
        for char in text:
            char_counts[char] += 1

        length = len(text)
        entropy = 0.0

        for count in char_counts.values():
            probability = count / length
            entropy -= probability * (
                probability and (probability * (2.0 ** (-1.0))) or 0.0
            )

        return entropy

    def _has_excessive_repetition(self, text: str) -> bool:
        """检查是否有过度重复"""
        words = text.split()
        if len(words) < 10:
            return False

        word_counts = defaultdict(int)
        for word in words:
            word_counts[word] += 1

        # 检查最高频词的比例
        max_count = max(word_counts.values())
        return max_count / len(words) > 0.3


class AdapterIsolationManager:
    """适配器隔离管理器"""

    def __init__(self):
        self.adapter_permissions = {}
        self.adapter_sandboxes = {}
        self.cross_adapter_calls = defaultdict(list)
        self.isolation_policies = {}

    def register_adapter(
        self,
        adapter_id: str,
        permissions: Set[PermissionType],
        isolation_level: str = "strict",
    ):
        """注册适配器"""
        self.adapter_permissions[adapter_id] = permissions
        self.isolation_policies[adapter_id] = isolation_level

        # 创建适配器沙箱
        self.adapter_sandboxes[adapter_id] = {
            "allowed_modules": self._get_allowed_modules(permissions),
            "resource_limits": self._get_resource_limits(isolation_level),
            "network_access": PermissionType.EXECUTE in permissions,
            "file_access": self._get_file_access_rules(permissions),
        }

    def can_adapter_call(self, caller_id: str, target_id: str, operation: str) -> bool:
        """检查适配器是否可以调用其他适配器"""
        if caller_id not in self.adapter_permissions:
            return False

        if target_id not in self.adapter_permissions:
            return False

        # 记录跨适配器调用
        self.cross_adapter_calls[caller_id].append(
            {"target": target_id, "operation": operation, "timestamp": datetime.now()}
        )

        # 检查隔离策略
        caller_isolation = self.isolation_policies.get(caller_id, "strict")

        if caller_isolation == "strict":
            # 严格隔离：不允许跨适配器调用脚本吧
            return False
        elif caller_isolation == "controlled":
            # 受控隔离：只允许特定操作
            return self._is_allowed_cross_call(caller_id, target_id, operation)
        else:
            # 宽松隔离：允许大部分操作
            return True

    def _get_allowed_modules(self, permissions: Set[PermissionType]) -> List[str]:
        """获取允许的模块列表"""
        base_modules = ["json", "datetime", "uuid", "hashlib"]

        if PermissionType.READ in permissions:
            base_modules.extend(["os.path", "pathlib"])

        if PermissionType.WRITE in permissions:
            base_modules.extend(["tempfile"])

        if PermissionType.EXECUTE in permissions:
            base_modules.extend(["subprocess", "requests"])

        return base_modules

    def _get_resource_limits(self, isolation_level: str) -> Dict[str, Any]:
        """获取资源限制"""
        limits = {
            "strict": {
                "max_memory_mb": 512,
                "max_cpu_time": 30,
                "max_file_size": 10 * 1024 * 1024,  # 10MB
                "max_network_calls": 10,
            },
            "controlled": {
                "max_memory_mb": 1024,
                "max_cpu_time": 60,
                "max_file_size": 50 * 1024 * 1024,  # 50MB
                "max_network_calls": 50,
            },
            "relaxed": {
                "max_memory_mb": 2048,
                "max_cpu_time": 120,
                "max_file_size": 100 * 1024 * 1024,  # 100MB
                "max_network_calls": 100,
            },
        }

        return limits.get(isolation_level, limits["strict"])

    def _get_file_access_rules(
        self, permissions: Set[PermissionType]
    ) -> Dict[str, Any]:
        """获取文件访问规则"""
        rules = {
            "read_paths": [],
            "write_paths": [],
            "forbidden_paths": ["/etc", "/sys", "/proc", "/root"],
        }

        if PermissionType.READ in permissions:
            rules["read_paths"].extend(["./data", "./config", "./models"])

        if PermissionType.WRITE in permissions:
            rules["write_paths"].extend(["./temp", "./output", "./logs"])

        return rules

    def _is_allowed_cross_call(
        self, caller_id: str, target_id: str, operation: str
    ) -> bool:
        """检查是否允许跨适配器调用"""
        # 定义允许的跨适配器操作
        allowed_operations = {"get_status", "ping", "get_info", "validate_input"}

        return operation in allowed_operations


class SecurityManager:
    """主安全管理器"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.crypto_utils = CryptoUtils()
        self.rate_limiter = RateLimiter()
        self.auditor = SecurityAuditor()
        self.model_security = ModelSecurityManager(self.crypto_utils)
        self.adapter_isolation = AdapterIsolationManager()

        # JWT配置
        self.jwt_secret = self.config.get(
            "jwt_secret", self.crypto_utils.generate_secure_token()
        )
        self.jwt_algorithm = "HS256"
        self.jwt_expiry = timedelta(hours=24)

        # 会话存储
        self.active_sessions = {}
        self.session_lock = threading.Lock()

        # IP白名单和黑名单
        self.ip_whitelist = set(self.config.get("ip_whitelist", []))
        self.ip_blacklist = set(self.config.get("ip_blacklist", []))

    def authenticate_user(
        self, username: str, password: str, ip_address: str
    ) -> Optional[SecurityContext]:
        """用户认证"""
        # 检查IP黑名单
        if self._is_ip_blocked(ip_address):
            self._log_failed_attempt(ip_address, username, "blocked_ip")
            return None

        # 检查速率限制
        if not self.rate_limiter.is_allowed(f"auth:{ip_address}", 5, 300):  # 5次/5分钟
            self._log_failed_attempt(ip_address, username, "rate_limited")
            return None

        # 检查可疑活动
        if self.auditor.is_suspicious_activity(ip_address, username):
            self._log_failed_attempt(ip_address, username, "suspicious_activity")
            return None

        # 验证用户凭据
        user_info = self._verify_credentials(username, password)
        if not user_info:
            self._log_failed_attempt(ip_address, username, "invalid_credentials")
            return None

        # 创建安全上下文
        context = SecurityContext(
            user_id=user_info["user_id"],
            session_id=self.crypto_utils.generate_secure_token(),
            permissions=set(user_info["permissions"]),
            security_level=SecurityLevel(user_info["security_level"]),
            ip_address=ip_address,
            user_agent=user_info.get("user_agent", ""),
            timestamp=datetime.now(),
        )

        # 存储会话
        with self.session_lock:
            self.active_sessions[context.session_id] = context

        return context

    def validate_session(
        self, session_id: str, ip_address: str
    ) -> Optional[SecurityContext]:
        """验证会话"""
        with self.session_lock:
            context = self.active_sessions.get(session_id)

        if not context:
            return None

        # 检查IP地址一致性
        if context.ip_address != ip_address:
            self._invalidate_session(session_id)
            return None

        # 检查会话过期
        if datetime.now() - context.timestamp > self.jwt_expiry:
            self._invalidate_session(session_id)
            return None

        # 更新最后活动时间
        context.timestamp = datetime.now()

        return context

    def generate_jwt_token(self, context: SecurityContext) -> str:
        """生成JWT令牌"""
        payload = {
            "user_id": context.user_id,
            "session_id": context.session_id,
            "permissions": [p.value for p in context.permissions],
            "security_level": context.security_level.value,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + self.jwt_expiry,
        }

        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    def validate_jwt_token(self, token: str) -> Optional[SecurityContext]:
        """验证JWT令牌"""
        try:
            payload = jwt.decode(
                token, self.jwt_secret, algorithms=[self.jwt_algorithm]
            )

            # 验证会话是否仍然活跃
            session_id = payload["session_id"]
            with self.session_lock:
                context = self.active_sessions.get(session_id)

            return context

        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def check_permission(
        self, context: SecurityContext, required_permission: PermissionType
    ) -> bool:
        """检查权限"""
        return required_permission in context.permissions

    def sanitize_input(self, data: str, context: SecurityContext) -> str:
        """输入清理"""
        # 检测威胁
        threats = self.auditor.detect_threats(data, context.ip_address, context.user_id)

        if threats:
            # 如果检测到威胁，拒绝请求
            raise SecurityError(
                f"Detected threats: {[t.event_type.value for t in threats]}"
            )

        # 基本清理
        cleaned_data = data.strip()

        # HTML实体编码
        cleaned_data = cleaned_data.replace("&", "&amp;")
        cleaned_data = cleaned_data.replace("<", "&lt;")
        cleaned_data = cleaned_data.replace(">", "&gt;")
        cleaned_data = cleaned_data.replace('"', "&quot;")
        cleaned_data = cleaned_data.replace("'", "&#x27;")

        return cleaned_data

    def _verify_credentials(
        self, username: str, password: str
    ) -> Optional[Dict[str, Any]]:
        """验证用户凭据 - 这里应该连接到真实的用户数据库"""
        # 示例实现 - 在生产环境中应该连接到实际的用户数据库
        mock_users = {
            "admin": {
                "user_id": "admin_001",
                "password_hash": self.crypto_utils.hash_password("admin_password"),
                "permissions": [
                    PermissionType.ADMIN,
                    PermissionType.MODEL_ACCESS,
                    PermissionType.TRAINING_ACCESS,
                    PermissionType.ADAPTER_MANAGE,
                ],
                "security_level": SecurityLevel.TOP_SECRET.value,
            },
            "user": {
                "user_id": "user_001",
                "password_hash": self.crypto_utils.hash_password("user_password"),
                "permissions": [PermissionType.READ, PermissionType.MODEL_ACCESS],
                "security_level": SecurityLevel.PROTECTED.value,
            },
        }

        user_info = mock_users.get(username)
        if not user_info:
            return None

        if not self.crypto_utils.verify_password(password, user_info["password_hash"]):
            return None

        return user_info

    def _is_ip_blocked(self, ip_address: str) -> bool:
        """检查IP是否被阻止"""
        # 检查黑名单
        if ip_address in self.ip_blacklist:
            return True

        # 检查白名单（如果配置了白名单，则只允许白名单IP）
        if self.ip_whitelist and ip_address not in self.ip_whitelist:
            return True

        return False

    def _log_failed_attempt(self, ip_address: str, username: str, reason: str):
        """记录失败尝试"""
        try:
            with sqlite3.connect(self.auditor.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO failed_attempts (ip_address, user_id, attempt_time, attempt_type)
                    VALUES (?, ?, ?, ?)
                """,
                    (ip_address, username, datetime.now(), reason),
                )
        except Exception as e:
            logger.error(f"Failed to log failed attempt: {e}")

    def _invalidate_session(self, session_id: str):
        """使会话无效"""
        with self.session_lock:
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]


class SecurityError(Exception):
    """安全错误异常"""

    pass


# 装饰器
def require_permission(permission: PermissionType):
    """权限检查装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 从请求中获取安全上下文
            context = kwargs.get("security_context")
            if not context or not isinstance(context, SecurityContext):
                raise SecurityError("No valid security context")

            if permission not in context.permissions:
                raise SecurityError(f"Permission denied: {permission.value}")

            return func(*args, **kwargs)

        return wrapper

    return decorator


def require_security_level(level: SecurityLevel):
    """安全级别检查装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            context = kwargs.get("security_context")
            if not context or not isinstance(context, SecurityContext):
                raise SecurityError("No valid security context")

            user_level_value = list(SecurityLevel).index(context.security_level)
            required_level_value = list(SecurityLevel).index(level)

            if user_level_value < required_level_value:
                raise SecurityError(
                    f"Security level insufficient: required {level.value}"
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def audit_access(operation: str):
    """访问审计装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            context = kwargs.get("security_context")
            if context:
                logger.info(
                    f"User {context.user_id} accessed {operation} from {context.ip_address}"
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


# 使用示例
if __name__ == "__main__":
    # 初始化安全管理器
    security_manager = SecurityManager()

    # 用户认证示例
    context = security_manager.authenticate_user(
        "admin", "admin_password", "192.168.1.100"
    )

    if context:
        print(f"Authentication successful for user {context.user_id}")

        # 生成JWT令牌
        token = security_manager.generate_jwt_token(context)
        print(f"JWT Token: {token}")

        # 检查权限
        if security_manager.check_permission(context, PermissionType.MODEL_ACCESS):
            print("User has model access permission")

        # 注册模型
        security_manager.model_security.register_model(
            "gpt-4", SecurityLevel.CONFIDENTIAL, [PermissionType.MODEL_ACCESS]
        )

        # 检查模型访问权限
        if security_manager.model_security.can_access_model(context, "gpt-4"):
            print("User can access GPT-4 model")
    else:
        print("Authentication failed")

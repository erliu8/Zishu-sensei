#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
密码工具类 - 处理密码加密、验证和安全策略
"""

import hashlib
import secrets
import string
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import bcrypt
from passlib.context import CryptContext
from passlib.hash import pbkdf2_sha256
import logging

logger = logging.getLogger(__name__)

class PasswordStrength:
    """密码强度等级"""
    WEAK = "weak"
    FAIR = "fair"
    GOOD = "good"
    STRONG = "strong"
    VERY_STRONG = "very_strong"

class PasswordPolicy:
    """密码策略配置"""
    
    def __init__(
        self,
        min_length: int = 8,
        max_length: int = 128,
        require_uppercase: bool = True,
        require_lowercase: bool = True,
        require_digits: bool = True,
        require_special: bool = True,
        special_chars: str = "!@#$%^&*()_+-=[]{}|;:,.<>?",
        max_repeated_chars: int = 3,
        min_unique_chars: int = 4,
        prevent_common_passwords: bool = True,
        prevent_personal_info: bool = True,
        password_history_count: int = 5,
        max_age_days: int = 90
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.require_uppercase = require_uppercase
        self.require_lowercase = require_lowercase
        self.require_digits = require_digits
        self.require_special = require_special
        self.special_chars = special_chars
        self.max_repeated_chars = max_repeated_chars
        self.min_unique_chars = min_unique_chars
        self.prevent_common_passwords = prevent_common_passwords
        self.prevent_personal_info = prevent_personal_info
        self.password_history_count = password_history_count
        self.max_age_days = max_age_days

class PasswordManager:
    """密码管理器"""
    
    def __init__(self, policy: Optional[PasswordPolicy] = None):
        self.policy = policy or PasswordPolicy()
        
        # 配置密码上下文
        self.pwd_context = CryptContext(
            schemes=["bcrypt", "pbkdf2_sha256"],
            default="bcrypt",
            bcrypt__rounds=12,
            pbkdf2_sha256__rounds=100000
        )
        
        # 常见弱密码列表
        self.common_passwords = self._load_common_passwords()
    
    def _load_common_passwords(self) -> set:
        """加载常见弱密码列表"""
        # 这里应该从文件或数据库加载，这里只是示例
        common = {
            "password", "123456", "password123", "admin", "qwerty",
            "letmein", "welcome", "monkey", "dragon", "master",
            "123456789", "12345678", "12345", "1234567890",
            "abc123", "password1", "iloveyou", "princess", "rockyou",
            "654321", "sunshine", "shadow", "superman", "michael"
        }
        
        # 添加一些中文常见密码
        common.update({
            "123456", "password", "admin123", "root123", "qwerty123",
            "abc123456", "123123", "111111", "000000", "888888"
        })
        
        return common
    
    def hash_password(self, password: str) -> str:
        """加密密码"""
        try:
            return self.pwd_context.hash(password)
        except Exception as e:
            logger.error(f"密码加密失败: {str(e)}")
            raise ValueError("密码加密失败")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """验证密码"""
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"密码验证失败: {str(e)}")
            return False
    
    def needs_update(self, hashed_password: str) -> bool:
        """检查密码是否需要更新（升级加密算法）"""
        try:
            return self.pwd_context.needs_update(hashed_password)
        except Exception:
            return True
    
    def validate_password(
        self,
        password: str,
        user_info: Optional[Dict[str, str]] = None,
        password_history: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """验证密码是否符合策略"""
        errors = []
        warnings = []
        strength = self._calculate_strength(password)
        
        # 长度检查
        if len(password) < self.policy.min_length:
            errors.append(f"密码长度至少需要{self.policy.min_length}个字符")
        
        if len(password) > self.policy.max_length:
            errors.append(f"密码长度不能超过{self.policy.max_length}个字符")
        
        # 字符类型检查
        if self.policy.require_uppercase and not re.search(r'[A-Z]', password):
            errors.append("密码必须包含至少一个大写字母")
        
        if self.policy.require_lowercase and not re.search(r'[a-z]', password):
            errors.append("密码必须包含至少一个小写字母")
        
        if self.policy.require_digits and not re.search(r'\d', password):
            errors.append("密码必须包含至少一个数字")
        
        if self.policy.require_special:
            special_pattern = f'[{re.escape(self.policy.special_chars)}]'
            if not re.search(special_pattern, password):
                errors.append(f"密码必须包含至少一个特殊字符: {self.policy.special_chars}")
        
        # 重复字符检查
        if self._has_too_many_repeated_chars(password):
            errors.append(f"密码不能包含超过{self.policy.max_repeated_chars}个连续相同字符")
        
        # 唯一字符检查
        unique_chars = len(set(password))
        if unique_chars < self.policy.min_unique_chars:
            errors.append(f"密码至少需要包含{self.policy.min_unique_chars}个不同字符")
        
        # 常见密码检查
        if self.policy.prevent_common_passwords:
            if password.lower() in self.common_passwords:
                errors.append("密码过于常见，请选择更安全的密码")
        
        # 个人信息检查
        if self.policy.prevent_personal_info and user_info:
            personal_errors = self._check_personal_info(password, user_info)
            errors.extend(personal_errors)
        
        # 密码历史检查
        if password_history:
            history_errors = self._check_password_history(password, password_history)
            errors.extend(history_errors)
        
        # 生成建议
        suggestions = self._generate_suggestions(password, errors)
        
        return {
            "valid": len(errors) == 0,
            "strength": strength,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "score": self._calculate_score(password)
        }
    
    def _calculate_strength(self, password: str) -> str:
        """计算密码强度"""
        score = 0
        
        # 长度评分
        if len(password) >= 8:
            score += 1
        if len(password) >= 12:
            score += 1
        if len(password) >= 16:
            score += 1
        
        # 字符类型评分
        if re.search(r'[a-z]', password):
            score += 1
        if re.search(r'[A-Z]', password):
            score += 1
        if re.search(r'\d', password):
            score += 1
        if re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]', password):
            score += 1
        
        # 复杂性评分
        if len(set(password)) >= len(password) * 0.7:  # 字符多样性
            score += 1
        
        # 模式检查（减分）
        if re.search(r'(.)\1{2,}', password):  # 连续重复字符
            score -= 1
        if re.search(r'(012|123|234|345|456|567|678|789|890)', password):  # 连续数字
            score -= 1
        if re.search(r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)', password.lower()):  # 连续字母
            score -= 1
        
        # 根据评分确定强度
        if score <= 2:
            return PasswordStrength.WEAK
        elif score <= 4:
            return PasswordStrength.FAIR
        elif score <= 6:
            return PasswordStrength.GOOD
        elif score <= 8:
            return PasswordStrength.STRONG
        else:
            return PasswordStrength.VERY_STRONG
    
    def _calculate_score(self, password: str) -> int:
        """计算密码评分（0-100）"""
        score = 0
        
        # 长度评分 (0-25分)
        length_score = min(25, len(password) * 2)
        score += length_score
        
        # 字符类型评分 (0-25分)
        char_types = 0
        if re.search(r'[a-z]', password):
            char_types += 1
        if re.search(r'[A-Z]', password):
            char_types += 1
        if re.search(r'\d', password):
            char_types += 1
        if re.search(r'[^a-zA-Z0-9]', password):
            char_types += 1
        
        score += char_types * 6
        
        # 字符多样性评分 (0-25分)
        unique_chars = len(set(password))
        diversity_score = min(25, unique_chars * 2)
        score += diversity_score
        
        # 模式检查 (0-25分)
        pattern_score = 25
        if re.search(r'(.)\1{2,}', password):  # 连续重复
            pattern_score -= 5
        if re.search(r'(012|123|234|345|456|567|678|789|890)', password):  # 连续数字
            pattern_score -= 5
        if password.lower() in self.common_passwords:  # 常见密码
            pattern_score -= 15
        
        score += max(0, pattern_score)
        
        return min(100, max(0, score))
    
    def _has_too_many_repeated_chars(self, password: str) -> bool:
        """检查是否有过多重复字符"""
        count = 1
        for i in range(1, len(password)):
            if password[i] == password[i-1]:
                count += 1
                if count > self.policy.max_repeated_chars:
                    return True
            else:
                count = 1
        return False
    
    def _check_personal_info(self, password: str, user_info: Dict[str, str]) -> List[str]:
        """检查密码是否包含个人信息"""
        errors = []
        password_lower = password.lower()
        
        # 检查用户名
        username = user_info.get("username", "").lower()
        if username and len(username) >= 3 and username in password_lower:
            errors.append("密码不能包含用户名")
        
        # 检查邮箱
        email = user_info.get("email", "").lower()
        if email:
            email_parts = email.split("@")
            if len(email_parts[0]) >= 3 and email_parts[0] in password_lower:
                errors.append("密码不能包含邮箱地址")
        
        # 检查姓名
        name = user_info.get("name", "").lower()
        if name and len(name) >= 3 and name in password_lower:
            errors.append("密码不能包含真实姓名")
        
        # 检查生日
        birthday = user_info.get("birthday", "")
        if birthday:
            # 提取年份、月份、日期
            date_patterns = re.findall(r'\d{2,4}', birthday)
            for pattern in date_patterns:
                if len(pattern) >= 4 and pattern in password:
                    errors.append("密码不能包含生日信息")
                    break
        
        return errors
    
    def _check_password_history(self, password: str, history: List[str]) -> List[str]:
        """检查密码历史"""
        errors = []
        
        for old_password in history[-self.policy.password_history_count:]:
            if self.verify_password(password, old_password):
                errors.append(f"不能使用最近{self.policy.password_history_count}次使用过的密码")
                break
        
        return errors
    
    def _generate_suggestions(self, password: str, errors: List[str]) -> List[str]:
        """生成密码改进建议"""
        suggestions = []
        
        if len(password) < self.policy.min_length:
            suggestions.append(f"增加密码长度至{self.policy.min_length}个字符以上")
        
        if not re.search(r'[A-Z]', password):
            suggestions.append("添加大写字母")
        
        if not re.search(r'[a-z]', password):
            suggestions.append("添加小写字母")
        
        if not re.search(r'\d', password):
            suggestions.append("添加数字")
        
        if not re.search(f'[{re.escape(self.policy.special_chars)}]', password):
            suggestions.append("添加特殊字符")
        
        if password.lower() in self.common_passwords:
            suggestions.append("避免使用常见密码")
        
        if len(set(password)) < len(password) * 0.7:
            suggestions.append("增加字符多样性")
        
        return suggestions
    
    def generate_password(
        self,
        length: int = 12,
        include_uppercase: bool = True,
        include_lowercase: bool = True,
        include_digits: bool = True,
        include_special: bool = True,
        exclude_ambiguous: bool = True
    ) -> str:
        """生成安全密码"""
        chars = ""
        
        if include_lowercase:
            chars += string.ascii_lowercase
        if include_uppercase:
            chars += string.ascii_uppercase
        if include_digits:
            chars += string.digits
        if include_special:
            chars += self.policy.special_chars
        
        # 排除容易混淆的字符
        if exclude_ambiguous:
            ambiguous = "0O1lI"
            chars = "".join(c for c in chars if c not in ambiguous)
        
        if not chars:
            raise ValueError("至少需要选择一种字符类型")
        
        # 生成密码
        password = ''.join(secrets.choice(chars) for _ in range(length))
        
        # 确保包含所需的字符类型
        required_chars = []
        if include_lowercase:
            required_chars.append(secrets.choice(string.ascii_lowercase))
        if include_uppercase:
            required_chars.append(secrets.choice(string.ascii_uppercase))
        if include_digits:
            required_chars.append(secrets.choice(string.digits))
        if include_special:
            required_chars.append(secrets.choice(self.policy.special_chars))
        
        # 将必需字符插入到随机位置
        password_list = list(password)
        for char in required_chars:
            pos = secrets.randbelow(len(password_list))
            password_list[pos] = char
        
        return ''.join(password_list)
    
    def generate_passphrase(
        self,
        word_count: int = 4,
        separator: str = "-",
        capitalize: bool = True,
        add_numbers: bool = True
    ) -> str:
        """生成密码短语"""
        # 简单的单词列表（实际应用中应使用更大的词典）
        words = [
            "apple", "banana", "cherry", "dragon", "eagle", "forest",
            "garden", "harbor", "island", "jungle", "kitchen", "laptop",
            "mountain", "network", "ocean", "palace", "queen", "river",
            "sunset", "temple", "umbrella", "village", "window", "yellow"
        ]
        
        selected_words = []
        for _ in range(word_count):
            word = secrets.choice(words)
            if capitalize:
                word = word.capitalize()
            selected_words.append(word)
        
        passphrase = separator.join(selected_words)
        
        if add_numbers:
            number = secrets.randbelow(1000)
            passphrase += str(number)
        
        return passphrase
    
    def check_password_age(self, password_created_at: datetime) -> Dict[str, any]:
        """检查密码年龄"""
        now = datetime.utcnow()
        age = now - password_created_at
        age_days = age.days
        
        max_age = timedelta(days=self.policy.max_age_days)
        expires_at = password_created_at + max_age
        days_until_expiry = (expires_at - now).days
        
        return {
            "age_days": age_days,
            "max_age_days": self.policy.max_age_days,
            "is_expired": age_days > self.policy.max_age_days,
            "days_until_expiry": max(0, days_until_expiry),
            "expires_at": expires_at,
            "needs_change": days_until_expiry <= 7  # 7天内需要更换
        }

# 工具函数
def create_password_hash(password: str, method: str = "bcrypt") -> str:
    """创建密码哈希（简化版本）"""
    if method == "bcrypt":
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    elif method == "pbkdf2":
        return pbkdf2_sha256.hash(password)
    else:
        raise ValueError(f"不支持的加密方法: {method}")

def verify_password_hash(password: str, password_hash: str) -> bool:
    """验证密码哈希（简化版本）"""
    try:
        if password_hash.startswith("$2b$"):  # bcrypt
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        elif password_hash.startswith("$pbkdf2"):  # pbkdf2
            return pbkdf2_sha256.verify(password, password_hash)
        else:
            return False
    except Exception:
        return False

# 示例用法
if __name__ == "__main__":
    # 创建密码策略
    policy = PasswordPolicy(
        min_length=8,
        require_uppercase=True,
        require_lowercase=True,
        require_digits=True,
        require_special=True
    )
    
    # 创建密码管理器
    password_manager = PasswordManager(policy)
    
    # 测试密码验证
    test_passwords = [
        "123456",           # 弱密码
        "password123",      # 常见密码
        "MyP@ssw0rd",      # 中等强度
        "Tr0ub4dor&3",     # 强密码
        "correct-horse-battery-staple-42"  # 密码短语
    ]
    
    for pwd in test_passwords:
        result = password_manager.validate_password(pwd)
        print(f"\n密码: {pwd}")
        print(f"有效: {result['valid']}")
        print(f"强度: {result['strength']}")
        print(f"评分: {result['score']}/100")
        if result['errors']:
            print(f"错误: {result['errors']}")
        if result['suggestions']:
            print(f"建议: {result['suggestions']}")
    
    # 生成安全密码
    print(f"\n生成的密码: {password_manager.generate_password()}")
    print(f"生成的密码短语: {password_manager.generate_passphrase()}")

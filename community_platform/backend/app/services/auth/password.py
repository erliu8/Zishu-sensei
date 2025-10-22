"""
密码服务
"""
import secrets
import string
from app.core.security import verify_password, get_password_hash


class PasswordService:
    """密码服务"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        哈希密码
        
        Args:
            password: 明文密码
        
        Returns:
            str: 哈希后的密码
        """
        return get_password_hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        验证密码
        
        Args:
            plain_password: 明文密码
            hashed_password: 哈希密码
        
        Returns:
            bool: 密码是否匹配
        """
        return verify_password(plain_password, hashed_password)
    
    @staticmethod
    def generate_random_password(length: int = 12) -> str:
        """
        生成随机密码
        
        Args:
            length: 密码长度
        
        Returns:
            str: 随机密码
        """
        alphabet = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password
    
    @staticmethod
    def validate_password_strength(password: str) -> bool:
        """
        验证密码强度
        
        规则:
        - 至少 6 个字符
        - 包含大小写字母
        - 包含数字
        
        Args:
            password: 密码
        
        Returns:
            bool: 是否符合强度要求
        """
        if len(password) < 6:
            return False
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        
        return has_upper and has_lower and has_digit


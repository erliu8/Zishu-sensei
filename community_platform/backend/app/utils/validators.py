"""
验证器工具函数
"""
import re
from typing import Optional, List
from datetime import datetime


def validate_email(email: str) -> bool:
    """
    验证邮箱格式
    
    Args:
        email: 邮箱地址
    
    Returns:
        bool: 是否有效
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_username(username: str) -> bool:
    """
    验证用户名格式
    - 长度 3-50 字符
    - 只能包含字母、数字、下划线
    - 必须以字母开头
    
    Args:
        username: 用户名
    
    Returns:
        bool: 是否有效
    """
    if not username or len(username) < 3 or len(username) > 50:
        return False
    
    pattern = r'^[a-zA-Z][a-zA-Z0-9_]*$'
    return re.match(pattern, username) is not None


def validate_password(password: str) -> tuple[bool, Optional[str]]:
    """
    验证密码强度
    - 长度至少 8 字符
    - 包含至少一个大写字母
    - 包含至少一个小写字母
    - 包含至少一个数字
    
    Args:
        password: 密码
    
    Returns:
        tuple[bool, Optional[str]]: (是否有效, 错误消息)
    """
    if not password or len(password) < 8:
        return False, "密码长度至少为 8 个字符"
    
    if len(password) > 128:
        return False, "密码长度不能超过 128 个字符"
    
    if not re.search(r'[A-Z]', password):
        return False, "密码必须包含至少一个大写字母"
    
    if not re.search(r'[a-z]', password):
        return False, "密码必须包含至少一个小写字母"
    
    if not re.search(r'\d', password):
        return False, "密码必须包含至少一个数字"
    
    return True, None


def validate_password_simple(password: str) -> bool:
    """
    简单密码验证（仅验证长度）
    
    Args:
        password: 密码
    
    Returns:
        bool: 是否有效
    """
    return password and 8 <= len(password) <= 128


def validate_url(url: str) -> bool:
    """
    验证 URL 格式
    
    Args:
        url: URL 地址
    
    Returns:
        bool: 是否有效
    """
    pattern = r'^https?://[\w\-]+(\.[\w\-]+)+[/#?]?.*$'
    return re.match(pattern, url) is not None


def validate_phone(phone: str) -> bool:
    """
    验证手机号格式（中国大陆）
    
    Args:
        phone: 手机号
    
    Returns:
        bool: 是否有效
    """
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None


def validate_file_extension(filename: str, allowed_extensions: List[str]) -> bool:
    """
    验证文件扩展名
    
    Args:
        filename: 文件名
        allowed_extensions: 允许的扩展名列表
    
    Returns:
        bool: 是否有效
    """
    if not filename or '.' not in filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in [e.lower().lstrip('.') for e in allowed_extensions]


def validate_image_extension(filename: str) -> bool:
    """
    验证图片文件扩展名
    
    Args:
        filename: 文件名
    
    Returns:
        bool: 是否有效
    """
    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
    return validate_file_extension(filename, allowed_extensions)


def validate_content_length(content: str, min_length: int = 1, max_length: int = 10000) -> bool:
    """
    验证内容长度
    
    Args:
        content: 内容
        min_length: 最小长度
        max_length: 最大长度
    
    Returns:
        bool: 是否有效
    """
    if not content:
        return min_length == 0
    
    length = len(content.strip())
    return min_length <= length <= max_length


def sanitize_html(content: str) -> str:
    """
    清理 HTML 内容（移除危险标签）
    
    Args:
        content: HTML 内容
    
    Returns:
        str: 清理后的内容
    """
    # 移除 script 标签
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    # 移除 iframe 标签
    content = re.sub(r'<iframe[^>]*>.*?</iframe>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    # 移除 on* 事件处理器
    content = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)
    
    # 移除 javascript: 链接
    content = re.sub(r'javascript:', '', content, flags=re.IGNORECASE)
    
    return content


def validate_date_range(
    start_date: datetime,
    end_date: datetime,
    max_days: Optional[int] = None
) -> bool:
    """
    验证日期范围
    
    Args:
        start_date: 开始日期
        end_date: 结束日期
        max_days: 最大天数限制
    
    Returns:
        bool: 是否有效
    """
    if start_date > end_date:
        return False
    
    if max_days is not None:
        days_diff = (end_date - start_date).days
        if days_diff > max_days:
            return False
    
    return True


def validate_slug(slug: str) -> bool:
    """
    验证 URL slug 格式
    - 只能包含小写字母、数字、连字符
    - 不能以连字符开头或结尾
    
    Args:
        slug: URL slug
    
    Returns:
        bool: 是否有效
    """
    if not slug:
        return False
    
    pattern = r'^[a-z0-9]+(?:-[a-z0-9]+)*$'
    return re.match(pattern, slug) is not None


def generate_slug(text: str, max_length: int = 50) -> str:
    """
    生成 URL slug
    
    Args:
        text: 原始文本
        max_length: 最大长度
    
    Returns:
        str: slug
    """
    # 转换为小写
    slug = text.lower()
    
    # 替换空格和特殊字符为连字符
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    
    # 移除首尾连字符
    slug = slug.strip('-')
    
    # 限制长度
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip('-')
    
    return slug


def validate_json_structure(data: dict, required_keys: List[str]) -> bool:
    """
    验证 JSON 结构
    
    Args:
        data: JSON 数据
        required_keys: 必需的键列表
    
    Returns:
        bool: 是否有效
    """
    if not isinstance(data, dict):
        return False
    
    return all(key in data for key in required_keys)


def validate_pagination_params(page: int, page_size: int, max_page_size: int = 100) -> bool:
    """
    验证分页参数
    
    Args:
        page: 页码
        page_size: 每页数量
        max_page_size: 最大每页数量
    
    Returns:
        bool: 是否有效
    """
    if page < 1:
        return False
    
    if page_size < 1 or page_size > max_page_size:
        return False
    
    return True


def normalize_phone(phone: str) -> str:
    """
    规范化手机号（移除空格和连字符）
    
    Args:
        phone: 手机号
    
    Returns:
        str: 规范化后的手机号
    """
    return re.sub(r'[\s\-()]', '', phone)


def mask_email(email: str) -> str:
    """
    掩码邮箱地址
    例如: user@example.com -> u***@example.com
    
    Args:
        email: 邮箱地址
    
    Returns:
        str: 掩码后的邮箱
    """
    if '@' not in email:
        return email
    
    username, domain = email.split('@', 1)
    if len(username) <= 1:
        masked_username = username
    else:
        masked_username = username[0] + '***'
    
    return f"{masked_username}@{domain}"


def mask_phone(phone: str) -> str:
    """
    掩码手机号
    例如: 13812345678 -> 138****5678
    
    Args:
        phone: 手机号
    
    Returns:
        str: 掩码后的手机号
    """
    if len(phone) <= 7:
        return phone
    
    return phone[:3] + '****' + phone[-4:]


class Validator:
    """验证器类"""
    
    @staticmethod
    def email(value: str) -> bool:
        """验证邮箱"""
        return validate_email(value)
    
    @staticmethod
    def username(value: str) -> bool:
        """验证用户名"""
        return validate_username(value)
    
    @staticmethod
    def password(value: str, strict: bool = False) -> tuple[bool, Optional[str]]:
        """验证密码"""
        if strict:
            return validate_password(value)
        return validate_password_simple(value), None
    
    @staticmethod
    def url(value: str) -> bool:
        """验证 URL"""
        return validate_url(value)
    
    @staticmethod
    def phone(value: str) -> bool:
        """验证手机号"""
        return validate_phone(value)
    
    @staticmethod
    def file_extension(filename: str, allowed: List[str]) -> bool:
        """验证文件扩展名"""
        return validate_file_extension(filename, allowed)
    
    @staticmethod
    def content_length(content: str, min_len: int = 1, max_len: int = 10000) -> bool:
        """验证内容长度"""
        return validate_content_length(content, min_len, max_len)


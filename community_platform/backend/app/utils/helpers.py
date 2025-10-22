"""
辅助工具函数
"""
import hashlib
import secrets
import uuid
from typing import Optional, Any, Dict
from datetime import datetime, timedelta
import base64


def generate_uuid() -> str:
    """
    生成 UUID
    
    Returns:
        str: UUID 字符串
    """
    return str(uuid.uuid4())


def generate_short_id(length: int = 8) -> str:
    """
    生成短 ID
    
    Args:
        length: ID 长度
    
    Returns:
        str: 短 ID
    """
    return secrets.token_urlsafe(length)[:length]


def generate_random_string(length: int = 32) -> str:
    """
    生成随机字符串
    
    Args:
        length: 字符串长度
    
    Returns:
        str: 随机字符串
    """
    return secrets.token_hex(length // 2)


def hash_string(text: str, algorithm: str = 'sha256') -> str:
    """
    哈希字符串
    
    Args:
        text: 输入文本
        algorithm: 哈希算法（md5, sha1, sha256, sha512）
    
    Returns:
        str: 哈希值
    """
    hash_obj = hashlib.new(algorithm)
    hash_obj.update(text.encode('utf-8'))
    return hash_obj.hexdigest()


def encode_base64(text: str) -> str:
    """
    Base64 编码
    
    Args:
        text: 输入文本
    
    Returns:
        str: Base64 编码后的字符串
    """
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')


def decode_base64(encoded: str) -> str:
    """
    Base64 解码
    
    Args:
        encoded: Base64 编码的字符串
    
    Returns:
        str: 解码后的文本
    """
    return base64.b64decode(encoded.encode('utf-8')).decode('utf-8')


def get_timestamp() -> int:
    """
    获取当前时间戳（秒）
    
    Returns:
        int: 时间戳
    """
    return int(datetime.now().timestamp())


def get_timestamp_ms() -> int:
    """
    获取当前时间戳（毫秒）
    
    Returns:
        int: 时间戳
    """
    return int(datetime.now().timestamp() * 1000)


def timestamp_to_datetime(timestamp: int) -> datetime:
    """
    时间戳转 datetime
    
    Args:
        timestamp: 时间戳（秒）
    
    Returns:
        datetime: datetime 对象
    """
    return datetime.fromtimestamp(timestamp)


def datetime_to_timestamp(dt: datetime) -> int:
    """
    datetime 转时间戳
    
    Args:
        dt: datetime 对象
    
    Returns:
        int: 时间戳（秒）
    """
    return int(dt.timestamp())


def format_datetime(
    dt: datetime,
    format_str: str = "%Y-%m-%d %H:%M:%S"
) -> str:
    """
    格式化 datetime
    
    Args:
        dt: datetime 对象
        format_str: 格式字符串
    
    Returns:
        str: 格式化后的字符串
    """
    return dt.strftime(format_str)


def parse_datetime(
    date_string: str,
    format_str: str = "%Y-%m-%d %H:%M:%S"
) -> datetime:
    """
    解析 datetime 字符串
    
    Args:
        date_string: 日期字符串
        format_str: 格式字符串
    
    Returns:
        datetime: datetime 对象
    """
    return datetime.strptime(date_string, format_str)


def get_time_ago(dt: datetime) -> str:
    """
    获取相对时间描述（例如：2小时前）
    
    Args:
        dt: datetime 对象
    
    Returns:
        str: 相对时间描述
    """
    now = datetime.utcnow()
    diff = now - dt
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "刚刚"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes}分钟前"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours}小时前"
    elif seconds < 2592000:  # 30 days
        days = int(seconds / 86400)
        return f"{days}天前"
    elif seconds < 31536000:  # 365 days
        months = int(seconds / 2592000)
        return f"{months}个月前"
    else:
        years = int(seconds / 31536000)
        return f"{years}年前"


def truncate_string(text: str, length: int = 100, suffix: str = "...") -> str:
    """
    截断字符串
    
    Args:
        text: 输入文本
        length: 最大长度
        suffix: 后缀
    
    Returns:
        str: 截断后的字符串
    """
    if len(text) <= length:
        return text
    
    return text[:length - len(suffix)] + suffix


def remove_duplicates(items: list) -> list:
    """
    移除列表中的重复项（保持顺序）
    
    Args:
        items: 列表
    
    Returns:
        list: 去重后的列表
    """
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def chunk_list(items: list, chunk_size: int) -> list:
    """
    将列表分块
    
    Args:
        items: 列表
        chunk_size: 每块大小
    
    Returns:
        list: 分块后的列表
    """
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def flatten_list(nested_list: list) -> list:
    """
    展平嵌套列表
    
    Args:
        nested_list: 嵌套列表
    
    Returns:
        list: 展平后的列表
    """
    result = []
    for item in nested_list:
        if isinstance(item, list):
            result.extend(flatten_list(item))
        else:
            result.append(item)
    return result


def dict_to_query_string(params: Dict[str, Any]) -> str:
    """
    字典转查询字符串
    
    Args:
        params: 参数字典
    
    Returns:
        str: 查询字符串
    """
    from urllib.parse import urlencode
    return urlencode(params)


def merge_dicts(*dicts: Dict) -> Dict:
    """
    合并多个字典
    
    Args:
        *dicts: 字典列表
    
    Returns:
        Dict: 合并后的字典
    """
    result = {}
    for d in dicts:
        result.update(d)
    return result


def safe_get(data: Dict, path: str, default: Any = None) -> Any:
    """
    安全获取嵌套字典的值
    
    Args:
        data: 字典
        path: 路径（用点分隔，例如：'user.profile.name'）
        default: 默认值
    
    Returns:
        Any: 值或默认值
    """
    keys = path.split('.')
    current = data
    
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    
    return current


def bytes_to_human_readable(num_bytes: int) -> str:
    """
    将字节数转换为可读格式
    
    Args:
        num_bytes: 字节数
    
    Returns:
        str: 可读格式（例如：1.5 MB）
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if num_bytes < 1024.0:
            return f"{num_bytes:.2f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.2f} PB"


def clamp(value: float, min_value: float, max_value: float) -> float:
    """
    限制值在指定范围内
    
    Args:
        value: 值
        min_value: 最小值
        max_value: 最大值
    
    Returns:
        float: 限制后的值
    """
    return max(min_value, min(value, max_value))


def is_valid_uuid(uuid_string: str) -> bool:
    """
    验证是否为有效的 UUID
    
    Args:
        uuid_string: UUID 字符串
    
    Returns:
        bool: 是否有效
    """
    try:
        uuid.UUID(uuid_string)
        return True
    except (ValueError, AttributeError):
        return False


def percentage(part: float, total: float, decimal_places: int = 2) -> float:
    """
    计算百分比
    
    Args:
        part: 部分值
        total: 总值
        decimal_places: 小数位数
    
    Returns:
        float: 百分比
    """
    if total == 0:
        return 0.0
    
    result = (part / total) * 100
    return round(result, decimal_places)


def generate_verification_code(length: int = 6) -> str:
    """
    生成数字验证码
    
    Args:
        length: 验证码长度
    
    Returns:
        str: 验证码
    """
    from random import randint
    return ''.join([str(randint(0, 9)) for _ in range(length)])


def obfuscate_string(text: str, visible_chars: int = 4) -> str:
    """
    混淆字符串（只显示前几个字符）
    
    Args:
        text: 输入文本
        visible_chars: 可见字符数
    
    Returns:
        str: 混淆后的字符串
    """
    if len(text) <= visible_chars:
        return text
    
    return text[:visible_chars] + '*' * (len(text) - visible_chars)


class Timer:
    """计时器类"""
    
    def __init__(self):
        """初始化计时器"""
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
    
    def start(self):
        """开始计时"""
        self.start_time = datetime.now()
    
    def stop(self):
        """停止计时"""
        self.end_time = datetime.now()
    
    def elapsed(self) -> timedelta:
        """
        获取经过的时间
        
        Returns:
            timedelta: 经过的时间
        """
        if self.start_time is None:
            return timedelta(0)
        
        end = self.end_time or datetime.now()
        return end - self.start_time
    
    def elapsed_seconds(self) -> float:
        """
        获取经过的秒数
        
        Returns:
            float: 经过的秒数
        """
        return self.elapsed().total_seconds()
    
    def __enter__(self):
        """上下文管理器入口"""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口"""
        self.stop()


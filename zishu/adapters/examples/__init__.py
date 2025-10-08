"""
示例适配器模块

提供各种类型的示例适配器实现。
"""

from .http_adapter import HttpAdapter
from .database_adapter import DatabaseAdapter
from .message_queue_adapter import MessageQueueAdapter
from .file_system_adapter import FileSystemAdapter

__all__ = ["HttpAdapter", "DatabaseAdapter", "MessageQueueAdapter", "FileSystemAdapter"]

"""
适配器注册表核心服务

提供适配器的注册、发现和管理功能。
"""

from .core import AdapterRegistryCore
from .registration import RegistrationService
from .discovery import DiscoveryService
from .dependency import DependencyResolver

__all__ = [
    "AdapterRegistryCore",
    "RegistrationService",
    "DiscoveryService",
    "DependencyResolver",
]

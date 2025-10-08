"""
Zishu-sensei: 智能AI助手框架
主包初始化文件
"""

__version__ = "0.1.0"
__author__ = "Zishu Team"
__description__ = "智能AI助手框架，提供多模态交互和个性化服务"

# 导入核心模块
from . import api
from . import core
from . import utils
from . import models
from . import character

__all__ = [
    "api",
    "core",
    "utils",
    "models",
    "character",
    "__version__",
    "__author__",
    "__description__",
]

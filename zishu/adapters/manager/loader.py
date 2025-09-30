"""
动态加载器
"""

import os
import sys
import ast
import json
import hashlib
import importlib
import importlib.util
import inspect
import asyncio
import threading
import weakref
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union, Callable, Tuple, Type
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
from collections import defaultdict, deque
import logging
import tempfile
import shutil
import subprocess
import urllib.parse
import zipfile
import tarfile
from concurrent.futures import ThreadPoolExecutor, as_completed

# 可选依赖导入
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    aiohttp = None

try:
    import aiofiles
    HAS_AIOFILES = True
except ImportError:
    HAS_AIOFILES = False
    aiofiles = None

try:
    import watchdog.observers
    import watchdog.events
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False
    watchdog = None

# 本地模块导入
from .adapter import BaseAdapter
from .metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, AdapterCapability,
    create_adapter_metadata, create_capability, create_dependency
)
from .exceptions import (
    BaseAdapterException, AdapterLoadingError, AdapterValidationError,
    AdapterConfigurationError, SecurityViolationError, DependencyMissingError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from .registry import AdapterRegistry, get_default_registry

# 配置日志
logger = logging.getLogger(__name__)

# ================================
# 常量和枚举定义
# ================================

class LoaderStatus(str, Enum):
    """加载器状态"""
    IDLE = "idle"                       # 空闲
    LOADING = "loading"                 # 加载中
    CACHING = "caching"                 # 缓存中
    VALIDATING = "validating"           # 验证中
    ERROR = "error"                     # 错误状态

class LoadSource(str, Enum):
    """加载源类型"""
    FILE_SYSTEM = "file_system"         # 本地文件系统
    REMOTE_GIT = "remote_git"           # 远程Git仓库
    REMOTE_URL = "remote_url"           # 远程URL
    PYTHON_PACKAGE = "python_package"   # Python包
    ARCHIVE = "archive"                 # 压缩包
    REGISTRY = "registry"               # 适配器注册中心

class SecurityLevel(str, Enum):
    """安全级别"""
    STRICT = "strict"                   # 严格：只允许签名的适配器
    MODERATE = "moderate"               # 中等：允许已知源的适配器
    PERMISSIVE = "permissive"           # 宽松：允许所有适配器（仅开发环境）

class CachePolicy(str, Enum):
    """缓存策略"""
    ALWAYS = "always"                   # 总是缓存
    NEVER = "never"                     # 从不缓存
    VERSION_BASED = "version_based"     # 基于版本缓存
    TIME_BASED = "time_based"           # 基于时间缓存

# ================================
# 核心数据结构定义
# ================================

@dataclass
class LoaderConfig:
    """加载器配置"""
    # 基础配置
    cache_dir: Optional[Path] = None
    temp_dir: Optional[Path] = None
    max_cache_size_mb: int = 1024
    
    # 安全配置
    security_level: SecurityLevel = SecurityLevel.MODERATE
    allowed_sources: Optional[Set[str]] = None
    blocked_sources: Optional[Set[str]] = None
    require_signature: bool = False
    trusted_signers: Optional[Set[str]] = None
    
    # 缓存配置
    cache_policy: CachePolicy = CachePolicy.VERSION_BASED
    cache_ttl_hours: int = 24
    enable_hot_reload: bool = True
    
    # 网络配置
    request_timeout: int = 30
    max_file_size_mb: int = 100
    max_concurrent_downloads: int = 3
    
    # 依赖配置
    auto_install_dependencies: bool = False
    pip_index_url: Optional[str] = None
    pip_extra_args: Optional[List[str]] = None
    
    # 验证配置
    enable_code_analysis: bool = True
    max_complexity_score: int = 10
    forbidden_imports: Optional[Set[str]] = None
    
    def __post_init__(self):
        """后处理初始化"""
        if self.cache_dir is None:
            self.cache_dir = Path.home() / ".zishu" / "adapters" / "cache"
        if self.temp_dir is None:
            self.temp_dir = Path.home() / ".zishu" / "adapters" / "temp"
        
        # 确保目录存在
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # 设置默认值
        if self.allowed_sources is None:
            self.allowed_sources = set()
        if self.blocked_sources is None:
            self.blocked_sources = set()
        if self.trusted_signers is None:
            self.trusted_signers = set()
        if self.forbidden_imports is None:
            self.forbidden_imports = {
                "os.system", "subprocess.call", "eval", "exec",
                "__import__", "importlib.__import__"
            }

@dataclass
class LoadRequest:
    """加载请求"""
    source: str                         # 加载源地址
    source_type: LoadSource            # 源类型
    adapter_id: Optional[str] = None   # 适配器ID
    version: Optional[str] = None      # 版本要求
    config: Optional[Dict[str, Any]] = None  # 配置参数
    force_reload: bool = False         # 强制重新加载
    validate_only: bool = False        # 仅验证不加载
    metadata: Optional[Dict[str, Any]] = None  # 额外元数据

@dataclass
class LoadResult:
    """加载结果"""
    success: bool
    adapter_class: Optional[Type[BaseAdapter]] = None
    adapter_metadata: Optional[AdapterMetadata] = None
    source_info: Optional[Dict[str, Any]] = None
    cache_info: Optional[Dict[str, Any]] = None
    validation_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    load_time: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "success": self.success,
            "adapter_class": self.adapter_class.__name__ if self.adapter_class else None,
            "adapter_metadata": self.adapter_metadata.dict() if self.adapter_metadata else None,
            "source_info": self.source_info,
            "cache_info": self.cache_info,
            "validation_info": self.validation_info,
            "error": self.error,
            "error_details": self.error_details,
            "load_time": self.load_time
        }

@dataclass
class CacheEntry:
    """缓存条目"""
    adapter_id: str
    source: str
    source_hash: str
    adapter_class: Type[BaseAdapter]
    metadata: AdapterMetadata
    cached_at: datetime
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    file_path: Optional[Path] = None
    dependencies: Optional[List[str]] = None
    
    def is_expired(self, ttl_hours: int) -> bool:
        """检查是否过期"""
        if ttl_hours <= 0:
            return False
        age = datetime.now(timezone.utc) - self.cached_at
        return age.total_seconds() > ttl_hours * 3600
    
    def update_access(self):
        """更新访问信息"""
        self.access_count += 1
        self.last_accessed = datetime.now(timezone.utc)

# ================================
# 安全验证器
# ================================

class SecurityValidator:
    """安全验证器"""
    
    def __init__(self, config: LoaderConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.SecurityValidator")
    
    async def validate_source(self, source: str, source_type: LoadSource) -> bool:
        """验证加载源"""
        # 检查黑名单
        if self.config.blocked_sources and source in self.config.blocked_sources:
            raise SecurityViolationError(
                f"Source '{source}' is blocked",
                violation_type="blocked_source"
            )
        
        # 检查白名单（如果设置了）
        if self.config.allowed_sources and source not in self.config.allowed_sources:
            if self.config.security_level == SecurityLevel.STRICT:
                raise SecurityViolationError(
                    f"Source '{source}' is not in allowed list",
                    violation_type="unauthorized_source"
                )
        
        # 根据源类型进行特定验证
        if source_type == LoadSource.REMOTE_URL:
            return await self._validate_remote_url(source)
        elif source_type == LoadSource.REMOTE_GIT:
            return await self._validate_git_repo(source)
        elif source_type == LoadSource.FILE_SYSTEM:
            return self._validate_file_path(source)
        
        return True
    
    async def _validate_remote_url(self, url: str) -> bool:
        """验证远程URL"""
        parsed = urllib.parse.urlparse(url)
        
        # 检查协议
        if parsed.scheme not in ('http', 'https'):
            raise SecurityViolationError(
                f"Unsupported protocol: {parsed.scheme}",
                violation_type="invalid_protocol"
            )
        
        # 检查域名
        if parsed.hostname in ('localhost', '127.0.0.1', '0.0.0.0'):
            if self.config.security_level == SecurityLevel.STRICT:
                raise SecurityViolationError(
                    "Local URLs not allowed in strict mode",
                    violation_type="local_url_blocked"
                )
        
        return True
    
    async def _validate_git_repo(self, repo_url: str) -> bool:
        """验证Git仓库"""
        # 简单的Git URL验证
        if not (repo_url.endswith('.git') or 'github.com' in repo_url or 'gitlab.com' in repo_url):
            if self.config.security_level == SecurityLevel.STRICT:
                raise SecurityViolationError(
                    f"Git repository URL format not recognized: {repo_url}",
                    violation_type="invalid_git_url"
                )
        
        return True
    
    def _validate_file_path(self, file_path: str) -> bool:
        """验证文件路径"""
        path = Path(file_path).resolve()
        
        # 检查路径遍历攻击
        if '..' in str(path):
            raise SecurityViolationError(
                "Path traversal detected",
                violation_type="path_traversal"
            )
        
        # 检查文件是否存在
        if not path.exists():
            raise AdapterLoadingError(f"File not found: {file_path}")
        
        return True
    
    def validate_code(self, code: str, file_path: str) -> Dict[str, Any]:
        """验证代码安全性"""
        validation_result = {
            "safe": True,
            "issues": [],
            "complexity_score": 0,
            "imports": [],
            "functions": [],
            "classes": []
        }
        
        try:
            tree = ast.parse(code)
            
            # 分析AST
            analyzer = CodeAnalyzer(self.config.forbidden_imports)
            analyzer.visit(tree)
            
            validation_result.update({
                "complexity_score": analyzer.complexity_score,
                "imports": analyzer.imports,
                "functions": analyzer.functions,
                "classes": analyzer.classes,
                "issues": analyzer.issues
            })
            
            # 检查是否安全
            if analyzer.issues:
                validation_result["safe"] = False
            
            if analyzer.complexity_score > self.config.max_complexity_score:
                validation_result["safe"] = False
                validation_result["issues"].append(
                    f"Code complexity too high: {analyzer.complexity_score}"
                )
            
        except SyntaxError as e:
            validation_result["safe"] = False
            validation_result["issues"].append(f"Syntax error: {str(e)}")
        
        return validation_result

class CodeAnalyzer(ast.NodeVisitor):
    """代码分析器"""
    
    def __init__(self, forbidden_imports: Set[str]):
        self.forbidden_imports = forbidden_imports
        self.complexity_score = 0
        self.imports = []
        self.functions = []
        self.classes = []
        self.issues = []
    
    def visit_Import(self, node):
        """访问import语句"""
        for alias in node.names:
            self.imports.append(alias.name)
            if alias.name in self.forbidden_imports:
                self.issues.append(f"Forbidden import: {alias.name}")
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """访问from import语句"""
        module = node.module or ""
        for alias in node.names:
            import_name = f"{module}.{alias.name}" if module else alias.name
            self.imports.append(import_name)
            if import_name in self.forbidden_imports:
                self.issues.append(f"Forbidden import: {import_name}")
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node):
        """访问函数定义"""
        self.functions.append(node.name)
        self.complexity_score += 1
        # 检查函数复杂度
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.Try)):
                self.complexity_score += 1
        self.generic_visit(node)
    
    def visit_ClassDef(self, node):
        """访问类定义"""
        self.classes.append(node.name)
        self.complexity_score += 1
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """访问函数调用"""
        # 检查危险函数调用
        if isinstance(node.func, ast.Name):
            if node.func.id in ('eval', 'exec', '__import__'):
                self.issues.append(f"Dangerous function call: {node.func.id}")
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in ('system', 'popen', 'call'):
                self.issues.append(f"Dangerous method call: {node.func.attr}")
        self.generic_visit(node)

# ================================
# 依赖管理器
# ================================

class DependencyManager:
    """依赖管理器"""
    
    def __init__(self, config: LoaderConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.DependencyManager")
        self._dependency_cache: Dict[str, bool] = {}
    
    async def resolve_dependencies(self, metadata: AdapterMetadata) -> Dict[str, Any]:
        """解析依赖关系"""
        result = {
            "satisfied": True,
            "missing": [],
            "installed": [],
            "errors": []
        }
        
        for dependency in metadata.dependencies:
            try:
                if dependency.type == "package":
                    satisfied = await self._check_python_package(dependency.name, dependency.version)
                elif dependency.type == "adapter":
                    satisfied = await self._check_adapter_dependency(dependency.name, dependency.version)
                elif dependency.type == "service":
                    satisfied = await self._check_service_dependency(dependency.name)
                else:
                    satisfied = False
                    result["errors"].append(f"Unknown dependency type: {dependency.type}")
                
                if not satisfied:
                    if dependency.optional:
                        self.logger.warning(f"Optional dependency not satisfied: {dependency.name}")
                    else:
                        result["satisfied"] = False
                        result["missing"].append({
                            "name": dependency.name,
                            "version": dependency.version,
                            "type": dependency.type,
                            "optional": dependency.optional
                        })
                        
                        # 尝试自动安装
                        if self.config.auto_install_dependencies and dependency.type == "package":
                            installed = await self._install_python_package(dependency.name, dependency.version)
                            if installed:
                                result["installed"].append(dependency.name)
                                result["satisfied"] = True
                                result["missing"] = [m for m in result["missing"] if m["name"] != dependency.name]
                
            except Exception as e:
                result["errors"].append(f"Error checking dependency {dependency.name}: {str(e)}")
        
        return result
    
    async def _check_python_package(self, package_name: str, version: Optional[str] = None) -> bool:
        """检查Python包依赖"""
        cache_key = f"{package_name}:{version or 'any'}"
        if cache_key in self._dependency_cache:
            return self._dependency_cache[cache_key]
        
        try:
            import importlib.metadata
            
            # 检查包是否已安装
            try:
                installed_version = importlib.metadata.version(package_name)
                
                # 如果指定了版本，检查版本兼容性
                if version:
                    satisfied = self._check_version_compatibility(installed_version, version)
                else:
                    satisfied = True
                
                self._dependency_cache[cache_key] = satisfied
                return satisfied
                
            except importlib.metadata.PackageNotFoundError:
                self._dependency_cache[cache_key] = False
                return False
                
        except ImportError:
            # 兼容老版本Python
            try:
                __import__(package_name)
                self._dependency_cache[cache_key] = True
                return True
            except ImportError:
                self._dependency_cache[cache_key] = False
                return False
    
    async def _check_adapter_dependency(self, adapter_id: str, version: Optional[str] = None) -> bool:
        """检查适配器依赖"""
        try:
            registry = get_default_registry()
            registration = registry.get_registration(adapter_id)
            
            if not registration:
                return False
            
            if version and registration.metadata:
                metadata = registration.metadata
                if isinstance(metadata, dict):
                    adapter_version = metadata.get("version", {}).get("version")
                else:
                    adapter_version = metadata.version.version
                
                return self._check_version_compatibility(adapter_version, version)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error checking adapter dependency {adapter_id}: {e}")
            return False
    
    async def _check_service_dependency(self, service_name: str) -> bool:
        """检查服务依赖"""
        # 这里可以实现具体的服务检查逻辑
        # 例如检查HTTP服务、数据库连接等
        return True
    
    async def _install_python_package(self, package_name: str, version: Optional[str] = None) -> bool:
        """安装Python包"""
        try:
            cmd = [sys.executable, "-m", "pip", "install"]
            
            # 添加额外参数
            if self.config.pip_extra_args:
                cmd.extend(self.config.pip_extra_args)
            
            # 添加索引URL
            if self.config.pip_index_url:
                cmd.extend(["-i", self.config.pip_index_url])
            
            # 构建包名和版本
            package_spec = package_name
            if version:
                package_spec = f"{package_name}=={version}"
            
            cmd.append(package_spec)
            
            # 执行安装
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                self.logger.info(f"Successfully installed package: {package_spec}")
                # 清除缓存
                cache_key = f"{package_name}:{version or 'any'}"
                self._dependency_cache.pop(cache_key, None)
                return True
            else:
                self.logger.error(f"Failed to install package {package_spec}: {stderr.decode()}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error installing package {package_name}: {e}")
            return False
    
    def _check_version_compatibility(self, installed_version: str, required_version: str) -> bool:
        """检查版本兼容性"""
        # 简单的版本比较逻辑
        # 在实际项目中，可以使用packaging库进行更复杂的版本比较
        try:
            installed_parts = [int(x) for x in installed_version.split('.')]
            required_parts = [int(x) for x in required_version.split('.')]
            
            # 补齐版本号长度
            max_len = max(len(installed_parts), len(required_parts))
            installed_parts.extend([0] * (max_len - len(installed_parts)))
            required_parts.extend([0] * (max_len - len(required_parts)))
            
            return installed_parts >= required_parts
            
        except ValueError:
            # 如果版本号格式不标准，使用字符串比较
            return installed_version == required_version

# ================================
# 缓存管理器
# ================================

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, config: LoaderConfig):
        self.config = config
        self.cache_dir = config.cache_dir
        self.cache_index_file = self.cache_dir / "cache_index.json"
        self._cache_index: Dict[str, Dict[str, Any]] = {}
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
        self.logger = logging.getLogger(f"{__name__}.CacheManager")
        
        # 加载缓存索引
        asyncio.create_task(self._load_cache_index())
    
    async def _load_cache_index(self):
        """加载缓存索引"""
        try:
            if self.cache_index_file.exists():
                if HAS_AIOFILES:
                    async with aiofiles.open(self.cache_index_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        self._cache_index = json.loads(content)
                else:
                    with open(self.cache_index_file, 'r', encoding='utf-8') as f:
                        self._cache_index = json.load(f)
        except Exception as e:
            self.logger.warning(f"Failed to load cache index: {e}")
            self._cache_index = {}
    
    async def _save_cache_index(self):
        """保存缓存索引"""
        try:
            if HAS_AIOFILES:
                async with aiofiles.open(self.cache_index_file, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(self._cache_index, indent=2, default=str))
            else:
                with open(self.cache_index_file, 'w', encoding='utf-8') as f:
                    json.dump(self._cache_index, f, indent=2, default=str)
        except Exception as e:
            self.logger.error(f"Failed to save cache index: {e}")
    
    def _get_cache_key(self, source: str, version: Optional[str] = None) -> str:
        """获取缓存键"""
        key_data = f"{source}:{version or 'latest'}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def _get_source_hash(self, source: str, content: Optional[str] = None) -> str:
        """获取源哈希"""
        if content:
            return hashlib.sha256(content.encode()).hexdigest()
        else:
            return hashlib.sha256(source.encode()).hexdigest()
    
    async def get_cached_adapter(self, source: str, version: Optional[str] = None) -> Optional[CacheEntry]:
        """获取缓存的适配器"""
        if self.config.cache_policy == CachePolicy.NEVER:
            return None
        
        cache_key = self._get_cache_key(source, version)
        
        # 先检查内存缓存
        if cache_key in self._memory_cache:
            entry = self._memory_cache[cache_key]
            
            # 检查是否过期
            if not entry.is_expired(self.config.cache_ttl_hours):
                entry.update_access()
                return entry
            else:
                # 过期则删除
                del self._memory_cache[cache_key]
        
        # 检查磁盘缓存
        if cache_key in self._cache_index:
            cache_info = self._cache_index[cache_key]
            cache_file = self.cache_dir / f"{cache_key}.py"
            
            if cache_file.exists():
                try:
                    # 检查文件时间
                    cached_at = datetime.fromisoformat(cache_info.get("cached_at", ""))
                    if (datetime.now(timezone.utc) - cached_at).total_seconds() > self.config.cache_ttl_hours * 3600:
                        # 过期，删除缓存
                        await self._remove_cache_entry(cache_key)
                        return None
                    
                    # 加载缓存的适配器
                    entry = await self._load_cached_adapter(cache_key, cache_info)
                    if entry:
                        self._memory_cache[cache_key] = entry
                        entry.update_access()
                        return entry
                        
                except Exception as e:
                    self.logger.warning(f"Failed to load cached adapter {cache_key}: {e}")
                    await self._remove_cache_entry(cache_key)
        
        return None
    
    async def cache_adapter(
        self, 
        source: str, 
        adapter_class: Type[BaseAdapter], 
        metadata: AdapterMetadata,
        content: str,
        version: Optional[str] = None
    ) -> bool:
        """缓存适配器"""
        if self.config.cache_policy == CachePolicy.NEVER:
            return False
        
        async with self._lock:
            try:
                cache_key = self._get_cache_key(source, version)
                source_hash = self._get_source_hash(source, content)
                
                # 保存源代码文件
                cache_file = self.cache_dir / f"{cache_key}.py"
                if HAS_AIOFILES:
                    async with aiofiles.open(cache_file, 'w', encoding='utf-8') as f:
                        await f.write(content)
                else:
                    with open(cache_file, 'w', encoding='utf-8') as f:
                        f.write(content)
                
                # 保存元数据
                metadata_file = self.cache_dir / f"{cache_key}_metadata.json"
                if HAS_AIOFILES:
                    async with aiofiles.open(metadata_file, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(metadata.dict(), indent=2, default=str))
                else:
                    with open(metadata_file, 'w', encoding='utf-8') as f:
                        json.dump(metadata.dict(), f, indent=2, default=str)
                
                # 创建缓存条目
                entry = CacheEntry(
                    adapter_id=metadata.adapter_id,
                    source=source,
                    source_hash=source_hash,
                    adapter_class=adapter_class,
                    metadata=metadata,
                    cached_at=datetime.now(timezone.utc),
                    file_path=cache_file
                )
                
                # 更新内存缓存
                self._memory_cache[cache_key] = entry
                
                # 更新缓存索引
                self._cache_index[cache_key] = {
                    "adapter_id": metadata.adapter_id,
                    "source": source,
                    "source_hash": source_hash,
                    "version": version,
                    "cached_at": entry.cached_at.isoformat(),
                    "file_path": str(cache_file),
                    "metadata_file": str(metadata_file)
                }
                
                await self._save_cache_index()
                
                # 清理过期缓存
                await self._cleanup_expired_cache()
                
                self.logger.debug(f"Cached adapter {metadata.adapter_id} with key {cache_key}")
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to cache adapter: {e}")
                return False
    
    async def _load_cached_adapter(self, cache_key: str, cache_info: Dict[str, Any]) -> Optional[CacheEntry]:
        """加载缓存的适配器"""
        try:
            cache_file = Path(cache_info["file_path"])
            metadata_file = Path(cache_info["metadata_file"])
            
            # 加载元数据
            if HAS_AIOFILES:
                async with aiofiles.open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata_data = json.loads(await f.read())
            else:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata_data = json.load(f)
            metadata = AdapterMetadata.parse_obj(metadata_data)
            
            # 动态加载模块
            spec = importlib.util.spec_from_file_location(f"cached_adapter_{cache_key}", cache_file)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # 查找适配器类
                adapter_class = None
                for name, obj in inspect.getmembers(module):
                    if (inspect.isclass(obj) and 
                        issubclass(obj, BaseAdapter) and 
                        obj != BaseAdapter):
                        adapter_class = obj
                        break
                
                if adapter_class:
                    return CacheEntry(
                        adapter_id=cache_info["adapter_id"],
                        source=cache_info["source"],
                        source_hash=cache_info["source_hash"],
                        adapter_class=adapter_class,
                        metadata=metadata,
                        cached_at=datetime.fromisoformat(cache_info["cached_at"]),
                        file_path=cache_file
                    )
            
        except Exception as e:
            self.logger.error(f"Failed to load cached adapter {cache_key}: {e}")
        
        return None
    
    async def _remove_cache_entry(self, cache_key: str):
        """移除缓存条目"""
        try:
            # 从内存缓存中移除
            self._memory_cache.pop(cache_key, None)
            
            # 从索引中移除并删除文件
            if cache_key in self._cache_index:
                cache_info = self._cache_index[cache_key]
                
                # 删除文件
                for file_key in ["file_path", "metadata_file"]:
                    if file_key in cache_info:
                        file_path = Path(cache_info[file_key])
                        if file_path.exists():
                            file_path.unlink()
                
                del self._cache_index[cache_key]
                await self._save_cache_index()
                
        except Exception as e:
            self.logger.error(f"Failed to remove cache entry {cache_key}: {e}")
    
    async def _cleanup_expired_cache(self):
        """清理过期缓存"""
        try:
            current_time = datetime.now(timezone.utc)
            expired_keys = []
            
            for cache_key, cache_info in self._cache_index.items():
                cached_at = datetime.fromisoformat(cache_info.get("cached_at", ""))
                if (current_time - cached_at).total_seconds() > self.config.cache_ttl_hours * 3600:
                    expired_keys.append(cache_key)
            
            for cache_key in expired_keys:
                await self._remove_cache_entry(cache_key)
            
            if expired_keys:
                self.logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
                
        except Exception as e:
            self.logger.error(f"Failed to cleanup expired cache: {e}")
    
    async def clear_cache(self, adapter_id: Optional[str] = None):
        """清理缓存"""
        try:
            if adapter_id:
                # 清理特定适配器的缓存
                keys_to_remove = [
                    key for key, info in self._cache_index.items()
                    if info.get("adapter_id") == adapter_id
                ]
            else:
                # 清理所有缓存
                keys_to_remove = list(self._cache_index.keys())
            
            for cache_key in keys_to_remove:
                await self._remove_cache_entry(cache_key)
            
            self.logger.info(f"Cleared {len(keys_to_remove)} cache entries")
            
        except Exception as e:
            self.logger.error(f"Failed to clear cache: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        total_size = 0
        file_count = 0
        
        try:
            for file_path in self.cache_dir.glob("*.py"):
                total_size += file_path.stat().st_size
                file_count += 1
        except Exception:
            pass
        
        return {
            "cache_dir": str(self.cache_dir),
            "total_entries": len(self._cache_index),
            "memory_entries": len(self._memory_cache),
            "total_size_mb": total_size / (1024 * 1024),
            "file_count": file_count,
            "max_size_mb": self.config.max_cache_size_mb,
            "ttl_hours": self.config.cache_ttl_hours
        }

# ================================
# 适配器动态加载器主类
# ================================

class AdapterLoader:
    """
    适配器动态加载器
    
    这是适配器动态加载系统的核心类，提供了完整的动态加载功能。
    """
    
    def __init__(
        self,
        config: Optional[LoaderConfig] = None,
        registry: Optional[AdapterRegistry] = None
    ):
        """
        初始化适配器加载器
        
        Args:
            config: 加载器配置
            registry: 适配器注册中心
        """
        self.config = config or LoaderConfig()
        self.registry = registry or get_default_registry()
        
        # 初始化组件
        self.security_validator = SecurityValidator(self.config)
        self.dependency_manager = DependencyManager(self.config)
        self.cache_manager = CacheManager(self.config)
        
        # 状态管理
        self.status = LoaderStatus.IDLE
        self._load_history: deque = deque(maxlen=100)
        self._active_loads: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        
        # 热加载支持
        self._file_watchers: Dict[str, Any] = {}
        self._hot_reload_callbacks: Dict[str, List[Callable]] = defaultdict(list)
        
        # 线程池
        self._executor = ThreadPoolExecutor(max_workers=self.config.max_concurrent_downloads)
        
        self.logger = logging.getLogger(__name__)
        self.logger.info("AdapterLoader initialized")
    
    async def load_adapter(self, request: LoadRequest) -> LoadResult:
        """
        加载适配器
        
        Args:
            request: 加载请求
            
        Returns:
            加载结果
        """
        start_time = asyncio.get_event_loop().time()
        load_id = f"load_{int(start_time * 1000)}"
        
        try:
            self.logger.info(f"Loading adapter from {request.source} (type: {request.source_type})")
            
            # 更新状态
            self.status = LoaderStatus.LOADING
            
            # 验证加载源
            await self.security_validator.validate_source(request.source, request.source_type)
            
            # 检查缓存
            if not request.force_reload:
                cached_entry = await self.cache_manager.get_cached_adapter(
                    request.source, request.version
                )
                if cached_entry:
                    self.logger.info(f"Found cached adapter: {cached_entry.adapter_id}")
                    
                    result = LoadResult(
                        success=True,
                        adapter_class=cached_entry.adapter_class,
                        adapter_metadata=cached_entry.metadata,
                        cache_info={"hit": True, "cached_at": cached_entry.cached_at},
                        load_time=asyncio.get_event_loop().time() - start_time
                    )
                    
                    self._record_load_history(request, result)
                    return result
            
            # 根据源类型加载
            if request.source_type == LoadSource.FILE_SYSTEM:
                result = await self._load_from_file_system(request)
            elif request.source_type == LoadSource.REMOTE_URL:
                result = await self._load_from_remote_url(request)
            elif request.source_type == LoadSource.REMOTE_GIT:
                result = await self._load_from_git_repo(request)
            elif request.source_type == LoadSource.PYTHON_PACKAGE:
                result = await self._load_from_python_package(request)
            elif request.source_type == LoadSource.ARCHIVE:
                result = await self._load_from_archive(request)
            else:
                raise AdapterLoadingError(f"Unsupported source type: {request.source_type}")
            
            # 设置加载时间
            result.load_time = asyncio.get_event_loop().time() - start_time
            
            # 记录历史
            self._record_load_history(request, result)
            
            return result
            
        except Exception as e:
            error_result = LoadResult(
                success=False,
                error=str(e),
                error_details={
                    "exception_type": type(e).__name__,
                    "source": request.source,
                    "source_type": request.source_type.value
                },
                load_time=asyncio.get_event_loop().time() - start_time
            )
            
            self._record_load_history(request, error_result)
            self.logger.error(f"Failed to load adapter from {request.source}: {e}")
            
            return error_result
            
        finally:
            self.status = LoaderStatus.IDLE
    
    async def _load_from_file_system(self, request: LoadRequest) -> LoadResult:
        """从文件系统加载适配器"""
        file_path = Path(request.source)
        
        if not file_path.exists():
            raise AdapterLoadingError(f"File not found: {request.source}")
        
        # 读取文件内容
        if HAS_AIOFILES:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
        else:
            # 使用同步文件读取作为后备
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        return await self._process_adapter_code(content, request)
    
    async def _load_from_remote_url(self, request: LoadRequest) -> LoadResult:
        """从远程URL加载适配器"""
        if not HAS_AIOHTTP:
            raise AdapterLoadingError(
                "aiohttp is required for remote URL loading. "
                "Install with: pip install aiohttp"
            )
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.request_timeout)
        ) as session:
            async with session.get(request.source) as response:
                if response.status != 200:
                    raise AdapterLoadingError(
                        f"Failed to fetch adapter from {request.source}: HTTP {response.status}"
                    )
                
                # 检查文件大小
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > self.config.max_file_size_mb * 1024 * 1024:
                    raise AdapterLoadingError(
                        f"File too large: {content_length} bytes"
                    )
                
                content = await response.text()
                
                return await self._process_adapter_code(content, request)
    
    async def _load_from_git_repo(self, request: LoadRequest) -> LoadResult:
        """从Git仓库加载适配器"""
        # 创建临时目录
        temp_dir = self.config.temp_dir / f"git_repo_{int(asyncio.get_event_loop().time())}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # 克隆仓库
            cmd = ["git", "clone", request.source, str(temp_dir)]
            if request.version:
                cmd.extend(["-b", request.version])
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise AdapterLoadingError(f"Git clone failed: {stderr.decode()}")
            
            # 查找适配器文件
            adapter_files = list(temp_dir.glob("**/*.py"))
            if not adapter_files:
                raise AdapterLoadingError("No Python files found in repository")
            
            # 尝试找到主适配器文件
            main_file = None
            for file_path in adapter_files:
                if file_path.name in ("adapter.py", "main.py", "__init__.py"):
                    main_file = file_path
                    break
            
            if not main_file:
                main_file = adapter_files[0]  # 使用第一个Python文件
            
            # 读取文件内容
            if HAS_AIOFILES:
                async with aiofiles.open(main_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
            else:
                with open(main_file, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            return await self._process_adapter_code(content, request)
            
        finally:
            # 清理临时目录
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    async def _load_from_python_package(self, request: LoadRequest) -> LoadResult:
        """从Python包加载适配器"""
        try:
            # 动态导入包
            module = importlib.import_module(request.source)
            
            # 查找适配器类
            adapter_class = None
            for name, obj in inspect.getmembers(module):
                if (inspect.isclass(obj) and 
                    issubclass(obj, BaseAdapter) and 
                    obj != BaseAdapter):
                    adapter_class = obj
                    break
            
            if not adapter_class:
                raise AdapterLoadingError(f"No adapter class found in package: {request.source}")
            
            # 获取源代码（用于缓存和验证）
            source_file = inspect.getfile(adapter_class)
            if HAS_AIOFILES:
                async with aiofiles.open(source_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
            else:
                with open(source_file, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            # 创建元数据
            metadata = await self._extract_metadata_from_class(adapter_class)
            
            # 验证代码
            validation_result = await self._validate_adapter_code(content, source_file)
            
            # 解析依赖
            dependency_result = await self.dependency_manager.resolve_dependencies(metadata)
            
            if not dependency_result["satisfied"]:
                raise DependencyMissingError(
                    f"Dependencies not satisfied: {dependency_result['missing']}"
                )
            
            # 缓存适配器
            if self.config.cache_policy != CachePolicy.NEVER:
                await self.cache_manager.cache_adapter(
                    request.source, adapter_class, metadata, content, request.version
                )
            
            return LoadResult(
                success=True,
                adapter_class=adapter_class,
                adapter_metadata=metadata,
                source_info={"package": request.source, "file": source_file},
                validation_info=validation_result,
                cache_info={"hit": False, "cached": True}
            )
            
        except ImportError as e:
            raise AdapterLoadingError(f"Failed to import package {request.source}: {str(e)}")
    
    async def _load_from_archive(self, request: LoadRequest) -> LoadResult:
        """从压缩包加载适配器"""
        # 下载压缩包（如果是URL）
        if request.source.startswith(('http://', 'https://')):
            archive_content = await self._download_file(request.source)
            temp_archive = self.config.temp_dir / f"archive_{int(asyncio.get_event_loop().time())}"
            
            if HAS_AIOFILES:
                async with aiofiles.open(temp_archive, 'wb') as f:
                    await f.write(archive_content)
            else:
                with open(temp_archive, 'wb') as f:
                    f.write(archive_content)
        else:
            temp_archive = Path(request.source)
        
        # 创建解压目录
        extract_dir = self.config.temp_dir / f"extracted_{int(asyncio.get_event_loop().time())}"
        extract_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # 解压文件
            if temp_archive.suffix.lower() in ('.zip',):
                with zipfile.ZipFile(temp_archive, 'r') as zip_file:
                    zip_file.extractall(extract_dir)
            elif temp_archive.suffix.lower() in ('.tar', '.tar.gz', '.tgz'):
                with tarfile.open(temp_archive, 'r:*') as tar_file:
                    tar_file.extractall(extract_dir)
            else:
                raise AdapterLoadingError(f"Unsupported archive format: {temp_archive.suffix}")
            
            # 查找适配器文件
            adapter_files = list(extract_dir.glob("**/*.py"))
            if not adapter_files:
                raise AdapterLoadingError("No Python files found in archive")
            
            # 尝试找到主适配器文件
            main_file = None
            for file_path in adapter_files:
                if file_path.name in ("adapter.py", "main.py", "__init__.py"):
                    main_file = file_path
                    break
            
            if not main_file:
                main_file = adapter_files[0]
            
            # 读取文件内容
            if HAS_AIOFILES:
                async with aiofiles.open(main_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
            else:
                with open(main_file, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            return await self._process_adapter_code(content, request)
            
        finally:
            # 清理临时文件
            if extract_dir.exists():
                shutil.rmtree(extract_dir, ignore_errors=True)
            if request.source.startswith(('http://', 'https://')) and temp_archive.exists():
                temp_archive.unlink()
    
    async def _download_file(self, url: str) -> bytes:
        """下载文件"""
        if not HAS_AIOHTTP:
            raise AdapterLoadingError(
                "aiohttp is required for file downloading. "
                "Install with: pip install aiohttp"
            )
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.request_timeout)
        ) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise AdapterLoadingError(f"Failed to download file: HTTP {response.status}")
                
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > self.config.max_file_size_mb * 1024 * 1024:
                    raise AdapterLoadingError(f"File too large: {content_length} bytes")
                
                return await response.read()
    
    async def _process_adapter_code(self, content: str, request: LoadRequest) -> LoadResult:
        """处理适配器代码"""
        # 验证代码
        self.status = LoaderStatus.VALIDATING
        validation_result = await self._validate_adapter_code(content, request.source)
        
        if not validation_result["safe"]:
            if request.validate_only:
                return LoadResult(
                    success=False,
                    error="Code validation failed",
                    error_details=validation_result,
                    validation_info=validation_result
                )
            elif self.config.security_level == SecurityLevel.STRICT:
                raise SecurityViolationError(
                    f"Code validation failed: {validation_result['issues']}",
                    violation_type="unsafe_code"
                )
        
        if request.validate_only:
            return LoadResult(
                success=True,
                validation_info=validation_result
            )
        
        # 动态加载代码
        adapter_class = await self._load_adapter_class_from_code(content, request.source)
        
        # 提取元数据
        metadata = await self._extract_metadata_from_class(adapter_class)
        
        # 解析依赖
        dependency_result = await self.dependency_manager.resolve_dependencies(metadata)
        
        if not dependency_result["satisfied"]:
            raise DependencyMissingError(
                f"Dependencies not satisfied: {dependency_result['missing']}"
            )
        
        # 缓存适配器
        self.status = LoaderStatus.CACHING
        if self.config.cache_policy != CachePolicy.NEVER:
            await self.cache_manager.cache_adapter(
                request.source, adapter_class, metadata, content, request.version
            )
        
        return LoadResult(
            success=True,
            adapter_class=adapter_class,
            adapter_metadata=metadata,
            source_info={"source": request.source, "type": request.source_type.value},
            validation_info=validation_result,
            cache_info={"hit": False, "cached": True}
        )
    
    async def _validate_adapter_code(self, content: str, source: str) -> Dict[str, Any]:
        """验证适配器代码"""
        if not self.config.enable_code_analysis:
            return {"safe": True, "issues": [], "skipped": True}
        
        return self.security_validator.validate_code(content, source)
    
    async def _load_adapter_class_from_code(self, content: str, source: str) -> Type[BaseAdapter]:
        """从代码加载适配器类"""
        # 创建临时模块
        module_name = f"dynamic_adapter_{hashlib.sha256(content.encode()).hexdigest()[:8]}"
        
        # 编译代码
        try:
            compiled_code = compile(content, source, 'exec')
        except SyntaxError as e:
            raise AdapterLoadingError(f"Syntax error in adapter code: {str(e)}")
        
        # 创建模块命名空间
        module_namespace = {
            '__name__': module_name,
            '__file__': source,
            'BaseAdapter': BaseAdapter,
            # 添加其他必要的导入
        }
        
        # 执行代码
        try:
            exec(compiled_code, module_namespace)
        except Exception as e:
            raise AdapterLoadingError(f"Error executing adapter code: {str(e)}")
        
        # 查找适配器类
        adapter_class = None
        for name, obj in module_namespace.items():
            if (inspect.isclass(obj) and 
                issubclass(obj, BaseAdapter) and 
                obj != BaseAdapter):
                adapter_class = obj
                break
        
        if not adapter_class:
            raise AdapterLoadingError("No adapter class found in code")
        
        return adapter_class
    
    async def _extract_metadata_from_class(self, adapter_class: Type[BaseAdapter]) -> AdapterMetadata:
        """从适配器类提取元数据"""
        # 尝试从类中获取元数据
        if hasattr(adapter_class, '_metadata'):
            return adapter_class._metadata
        
        # 从类属性构建元数据
        adapter_id = getattr(adapter_class, 'ADAPTER_ID', adapter_class.__name__.lower())
        name = getattr(adapter_class, 'ADAPTER_NAME', adapter_class.__name__)
        description = getattr(adapter_class, 'ADAPTER_DESCRIPTION', adapter_class.__doc__ or "")
        version = getattr(adapter_class, 'ADAPTER_VERSION', "1.0.0")
        adapter_type = getattr(adapter_class, 'ADAPTER_TYPE', AdapterType.SOFT)
        
        # 创建基础元数据
        metadata = await create_adapter_metadata(
            adapter_id=adapter_id,
            name=name,
            adapter_type=adapter_type,
            version=version,
            description=description
        )
        
        # 添加能力信息
        if hasattr(adapter_class, 'CAPABILITIES'):
            for cap_info in adapter_class.CAPABILITIES:
                if isinstance(cap_info, dict):
                    capability = create_capability(**cap_info)
                    metadata.capabilities.append(capability)
        
        # 添加依赖信息
        if hasattr(adapter_class, 'DEPENDENCIES'):
            for dep_info in adapter_class.DEPENDENCIES:
                if isinstance(dep_info, dict):
                    dependency = create_dependency(**dep_info)
                    metadata.dependencies.append(dependency)
        
        return metadata
    
    def _record_load_history(self, request: LoadRequest, result: LoadResult):
        """记录加载历史"""
        history_entry = {
            "timestamp": datetime.now(timezone.utc),
            "request": {
                "source": request.source,
                "source_type": request.source_type.value,
                "adapter_id": request.adapter_id,
                "version": request.version,
                "force_reload": request.force_reload
            },
            "result": {
                "success": result.success,
                "adapter_id": result.adapter_metadata.adapter_id if result.adapter_metadata else None,
                "error": result.error,
                "load_time": result.load_time
            }
        }
        
        self._load_history.append(history_entry)
    
    # ================================
    # 热加载功能
    # ================================
    
    async def enable_hot_reload(self, source: str, callback: Optional[Callable] = None):
        """启用热加载"""
        if not self.config.enable_hot_reload:
            return
        
        if source in self._file_watchers:
            return  # 已经在监控
        
        if not HAS_WATCHDOG:
            self.logger.warning(
                "watchdog is not installed. Hot reload disabled. "
                "Install with: pip install watchdog"
            )
            return
        
        try:
            class AdapterFileHandler(watchdog.events.FileSystemEventHandler):
                def __init__(self, loader, source_path):
                    self.loader = loader
                    self.source_path = source_path
                
                def on_modified(self, event):
                    if not event.is_directory and event.src_path == self.source_path:
                        asyncio.create_task(self.loader._handle_file_change(self.source_path))
            
            observer = watchdog.observers.Observer()
            handler = AdapterFileHandler(self, source)
            
            source_path = Path(source)
            if source_path.is_file():
                observer.schedule(handler, str(source_path.parent), recursive=False)
            else:
                observer.schedule(handler, str(source_path), recursive=True)
            
            observer.start()
            self._file_watchers[source] = observer
            
            if callback:
                self._hot_reload_callbacks[source].append(callback)
            
            self.logger.info(f"Hot reload enabled for: {source}")
            
        except ImportError:
            self.logger.warning("watchdog not installed, hot reload disabled")
    
    async def disable_hot_reload(self, source: str):
        """禁用热加载"""
        if source in self._file_watchers:
            observer = self._file_watchers[source]
            observer.stop()
            observer.join()
            del self._file_watchers[source]
            
            if source in self._hot_reload_callbacks:
                del self._hot_reload_callbacks[source]
            
            self.logger.info(f"Hot reload disabled for: {source}")
    
    async def _handle_file_change(self, file_path: str):
        """处理文件变更"""
        try:
            self.logger.info(f"File changed: {file_path}")
            
            # 重新加载适配器
            request = LoadRequest(
                source=file_path,
                source_type=LoadSource.FILE_SYSTEM,
                force_reload=True
            )
            
            result = await self.load_adapter(request)
            
            if result.success:
                # 调用回调函数
                for callback in self._hot_reload_callbacks.get(file_path, []):
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(result)
                        else:
                            callback(result)
                    except Exception as e:
                        self.logger.error(f"Hot reload callback error: {e}")
                
                self.logger.info(f"Hot reload successful: {result.adapter_metadata.adapter_id}")
            else:
                self.logger.error(f"Hot reload failed: {result.error}")
                
        except Exception as e:
            self.logger.error(f"Error handling file change: {e}")
    
    # ================================
    # 管理和监控方法
    # ================================
    
    def get_load_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取加载历史"""
        return list(self._load_history)[-limit:]
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return self.cache_manager.get_cache_stats()
    
    async def clear_cache(self, adapter_id: Optional[str] = None):
        """清理缓存"""
        await self.cache_manager.clear_cache(adapter_id)
    
    def get_status(self) -> Dict[str, Any]:
        """获取加载器状态"""
        return {
            "status": self.status.value,
            "active_loads": len(self._active_loads),
            "file_watchers": len(self._file_watchers),
            "load_history_count": len(self._load_history),
            "config": {
                "cache_policy": self.config.cache_policy.value,
                "security_level": self.config.security_level.value,
                "hot_reload_enabled": self.config.enable_hot_reload,
                "auto_install_deps": self.config.auto_install_dependencies
            }
        }
    
    async def cleanup(self):
        """清理资源"""
        # 停止所有文件监控
        for source in list(self._file_watchers.keys()):
            await self.disable_hot_reload(source)
        
        # 取消活动的加载任务
        for task in self._active_loads.values():
            task.cancel()
        
        # 关闭线程池
        self._executor.shutdown(wait=True)
        
        self.logger.info("AdapterLoader cleaned up")

# ================================
# 工厂函数和便利方法
# ================================

def create_loader(
    cache_dir: Optional[Path] = None,
    security_level: SecurityLevel = SecurityLevel.MODERATE,
    enable_hot_reload: bool = True,
    **kwargs
) -> AdapterLoader:
    """创建适配器加载器"""
    config = LoaderConfig(
        cache_dir=cache_dir,
        security_level=security_level,
        enable_hot_reload=enable_hot_reload,
        **kwargs
    )
    return AdapterLoader(config)

def create_development_loader() -> AdapterLoader:
    """创建开发环境加载器"""
    config = LoaderConfig(
        security_level=SecurityLevel.PERMISSIVE,
        enable_hot_reload=True,
        cache_policy=CachePolicy.NEVER,
        enable_code_analysis=False,
        auto_install_dependencies=True
    )
    return AdapterLoader(config)

def create_production_loader() -> AdapterLoader:
    """创建生产环境加载器"""
    config = LoaderConfig(
        security_level=SecurityLevel.STRICT,
        enable_hot_reload=False,
        cache_policy=CachePolicy.VERSION_BASED,
        enable_code_analysis=True,
        require_signature=True,
        auto_install_dependencies=False
    )
    return AdapterLoader(config)

# 全局默认加载器实例
_default_loader: Optional[AdapterLoader] = None

def get_default_loader() -> AdapterLoader:
    """获取默认加载器实例"""
    global _default_loader
    if _default_loader is None:
        _default_loader = create_loader()
    return _default_loader

def set_default_loader(loader: AdapterLoader):
    """设置默认加载器实例"""
    global _default_loader
    _default_loader = loader

# ================================
# 便利函数
# ================================

async def load_adapter_from_file(
    file_path: str,
    adapter_id: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    loader: Optional[AdapterLoader] = None
) -> LoadResult:
    """便利函数：从文件加载适配器"""
    loader = loader or get_default_loader()
    request = LoadRequest(
        source=file_path,
        source_type=LoadSource.FILE_SYSTEM,
        adapter_id=adapter_id,
        config=config
    )
    return await loader.load_adapter(request)

async def load_adapter_from_url(
    url: str,
    adapter_id: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    loader: Optional[AdapterLoader] = None
) -> LoadResult:
    """便利函数：从URL加载适配器"""
    loader = loader or get_default_loader()
    request = LoadRequest(
        source=url,
        source_type=LoadSource.REMOTE_URL,
        adapter_id=adapter_id,
        config=config
    )
    return await loader.load_adapter(request)

async def load_adapter_from_git(
    repo_url: str,
    version: Optional[str] = None,
    adapter_id: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    loader: Optional[AdapterLoader] = None
) -> LoadResult:
    """便利函数：从Git仓库加载适配器"""
    loader = loader or get_default_loader()
    request = LoadRequest(
        source=repo_url,
        source_type=LoadSource.REMOTE_GIT,
        adapter_id=adapter_id,
        version=version,
        config=config
    )
    return await loader.load_adapter(request)

async def load_adapter_from_package(
    package_name: str,
    adapter_id: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    loader: Optional[AdapterLoader] = None
) -> LoadResult:
    """便利函数：从Python包加载适配器"""
    loader = loader or get_default_loader()
    request = LoadRequest(
        source=package_name,
        source_type=LoadSource.PYTHON_PACKAGE,
        adapter_id=adapter_id,
        config=config
    )
    return await loader.load_adapter(request)

# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举
    'LoaderStatus', 'LoadSource', 'SecurityLevel', 'CachePolicy',
    
    # 数据结构
    'LoaderConfig', 'LoadRequest', 'LoadResult', 'CacheEntry',
    
    # 核心类
    'SecurityValidator', 'DependencyManager', 'CacheManager', 'AdapterLoader',
    
    # 工厂函数
    'create_loader', 'create_development_loader', 'create_production_loader',
    'get_default_loader', 'set_default_loader',
    
    # 便利函数
    'load_adapter_from_file', 'load_adapter_from_url', 'load_adapter_from_git',
    'load_adapter_from_package'
]

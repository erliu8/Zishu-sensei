"""
适配器元数据管理系统
"""

import json
import hashlib
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union, Callable, Tuple
from enum import Enum
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
import threading
import weakref
from collections import defaultdict
import logging

# 第三方依赖
try:
    from pydantic import BaseModel, Field, validator, root_validator
    from pydantic.types import StrictStr, PositiveInt
except ImportError:
    raise ImportError("pydantic is required for metadata management. Install with: pip install pydantic")

# 本地模块导入
from .exceptions import (
    BaseAdapterException, AdapterConfigurationError, AdapterValidationError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)

# ================================
# 常量和枚举定义
# ================================

class AdapterType(str, Enum):
    """适配器类型枚举"""
    SOFT = "soft"                    # 软适配器：基于提示词工程和RAG
    HARD = "hard"                    # 硬适配器：系统级操作
    INTELLIGENT = "intelligent"      # 智能硬适配器：智能代码生成


class AdapterStatus(str, Enum):
    """适配器状态枚举"""
    UNREGISTERED = "unregistered"   # 未注册
    REGISTERED = "registered"       # 已注册
    LOADING = "loading"              # 加载中
    LOADED = "loaded"                # 已加载
    RUNNING = "running"              # 运行中
    PAUSED = "paused"                # 暂停
    ERROR = "error"                  # 错误状态
    DEPRECATED = "deprecated"        # 已废弃


class SecurityLevel(str, Enum):
    """安全级别枚举"""
    PUBLIC = "public"                # 公开：无限制访问
    INTERNAL = "internal"            # 内部：需要基本认证
    RESTRICTED = "restricted"        # 限制：需要特殊权限
    CLASSIFIED = "classified"        # 机密：最高级别权限


class CapabilityCategory(str, Enum):
    """能力分类枚举"""
    TEXT_PROCESSING = "text_processing"           # 文本处理
    DATA_ANALYSIS = "data_analysis"               # 数据分析
    FILE_OPERATIONS = "file_operations"           # 文件操作
    SYSTEM_CONTROL = "system_control"             # 系统控制
    NETWORK_ACCESS = "network_access"             # 网络访问
    DATABASE_ACCESS = "database_access"           # 数据库访问
    CODE_GENERATION = "code_generation"           # 代码生成
    IMAGE_PROCESSING = "image_processing"         # 图像处理
    AUDIO_PROCESSING = "audio_processing"         # 音频处理
    MACHINE_LEARNING = "machine_learning"         # 机器学习
    CUSTOM = "custom"                             # 自定义


# ================================
# 核心数据模型
# ================================

class AdapterCapability(BaseModel):
    """适配器能力描述"""
    name: StrictStr = Field(..., description="能力名称")
    category: CapabilityCategory = Field(..., description="能力分类")
    description: Optional[str] = Field(None, description="能力描述")
    input_schema: Optional[Dict[str, Any]] = Field(None, description="输入数据格式")
    output_schema: Optional[Dict[str, Any]] = Field(None, description="输出数据格式")
    examples: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="使用示例")
    tags: Set[str] = Field(default_factory=set, description="标签")
    
    class Config:
        use_enum_values = True


class AdapterDependency(BaseModel):
    """适配器依赖关系"""
    name: StrictStr = Field(..., description="依赖名称")
    version: Optional[str] = Field(None, description="版本要求")
    type: str = Field("package", description="依赖类型: package, service, adapter")
    optional: bool = Field(False, description="是否可选")
    description: Optional[str] = Field(None, description="依赖描述")
    
    @validator('version')
    def validate_version(cls, v):
        if v and not isinstance(v, str):
            raise ValueError('Version must be a string')
        return v


class AdapterConfiguration(BaseModel):
    """适配器配置"""
    name: StrictStr = Field(..., description="配置项名称")
    type: str = Field(..., description="配置类型: string, int, float, bool, dict, list")
    default_value: Optional[Any] = Field(None, description="默认值")
    required: bool = Field(True, description="是否必需")
    description: Optional[str] = Field(None, description="配置描述")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="验证规则")
    sensitive: bool = Field(False, description="是否敏感信息")
    
    @validator('type')
    def validate_type(cls, v):
        allowed_types = {'string', 'int', 'float', 'bool', 'dict', 'list', 'json'}
        if v not in allowed_types:
            raise ValueError(f'Type must be one of {allowed_types}')
        return v


class AdapterPermissions(BaseModel):
    """适配器权限要求"""
    security_level: SecurityLevel = Field(SecurityLevel.INTERNAL, description="安全级别")
    required_roles: Set[str] = Field(default_factory=set, description="所需角色")
    file_system_access: Optional[List[str]] = Field(None, description="文件系统访问路径")
    network_access: Optional[List[str]] = Field(None, description="网络访问域名/IP")
    system_commands: Optional[List[str]] = Field(None, description="允许的系统命令")
    database_access: Optional[List[str]] = Field(None, description="数据库访问权限")
    
    class Config:
        use_enum_values = True


class AdapterVersion(BaseModel):
    """适配器版本信息"""
    version: StrictStr = Field(..., description="版本号")
    release_date: datetime = Field(..., description="发布日期")
    changelog: Optional[str] = Field(None, description="版本更新日志")
    compatibility: Optional[List[str]] = Field(None, description="兼容的系统版本")
    deprecated: bool = Field(False, description="是否已废弃")
    
    @validator('version')
    def validate_version_format(cls, v):
        # 简单的语义版本验证
        parts = v.split('.')
        if len(parts) < 2 or len(parts) > 4:
            raise ValueError('Version format should be like "1.0", "1.0.0", or "1.0.0.1"')
        for part in parts:
            try:
                int(part)
            except ValueError:
                # 允许预发布版本如 "1.0.0-beta"
                if '-' not in part:
                    raise ValueError('Version parts must be numeric or contain pre-release identifier')
        return v


class AdapterPerformanceMetrics(BaseModel):
    """适配器性能指标"""
    avg_response_time_ms: float = Field(0.0, description="平均响应时间(毫秒)")
    max_response_time_ms: float = Field(0.0, description="最大响应时间(毫秒)")
    min_response_time_ms: float = Field(0.0, description="最小响应时间(毫秒)")
    success_rate: float = Field(1.0, description="成功率", ge=0.0, le=1.0)
    error_rate: float = Field(0.0, description="错误率", ge=0.0, le=1.0)
    throughput_per_second: float = Field(0.0, description="每秒处理量")
    memory_usage_mb: float = Field(0.0, description="内存使用量(MB)")
    cpu_usage_percent: float = Field(0.0, description="CPU使用率(%)", ge=0.0, le=100.0)
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('success_rate', 'error_rate')
    def validate_rates(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Rate must be between 0.0 and 1.0')
        return v


class AdapterUsageStatistics(BaseModel):
    """适配器使用统计"""
    total_executions: int = Field(0, description="总执行次数")
    successful_executions: int = Field(0, description="成功执行次数")
    failed_executions: int = Field(0, description="失败执行次数")
    first_execution: Optional[datetime] = Field(None, description="首次执行时间")
    last_execution: Optional[datetime] = Field(None, description="最近执行时间")
    active_users: Set[str] = Field(default_factory=set, description="活跃用户列表")
    popular_features: Dict[str, int] = Field(default_factory=dict, description="功能使用频次")
    
    @root_validator
    def validate_execution_counts(cls, values):
        total = values.get('total_executions', 0)
        successful = values.get('successful_executions', 0)
        failed = values.get('failed_executions', 0)
        
        if successful + failed != total:
            values['total_executions'] = successful + failed
        
        return values


class AdapterMetadata(BaseModel):
    """
    适配器元数据主模型
    
    这是适配器元数据管理的核心数据结构，包含了适配器的完整信息。
    """
    # 基本信息
    adapter_id: StrictStr = Field(..., description="适配器唯一标识符")
    name: StrictStr = Field(..., description="适配器名称")
    display_name: Optional[str] = Field(None, description="显示名称")
    description: Optional[str] = Field(None, description="适配器描述")
    adapter_type: AdapterType = Field(..., description="适配器类型")
    
    # 版本信息
    version: AdapterVersion = Field(..., description="版本信息")
    
    # 开发者信息
    author: Optional[str] = Field(None, description="作者")
    maintainer: Optional[str] = Field(None, description="维护者")
    license: Optional[str] = Field(None, description="许可证")
    homepage: Optional[str] = Field(None, description="主页URL")
    repository: Optional[str] = Field(None, description="代码仓库URL")
    
    # 功能描述
    capabilities: List[AdapterCapability] = Field(default_factory=list, description="能力列表")
    tags: Set[str] = Field(default_factory=set, description="标签")
    keywords: Set[str] = Field(default_factory=set, description="关键词")
    
    # 技术规格
    dependencies: List[AdapterDependency] = Field(default_factory=list, description="依赖列表")
    configuration: List[AdapterConfiguration] = Field(default_factory=list, description="配置项")
    permissions: AdapterPermissions = Field(default_factory=AdapterPermissions, description="权限要求")
    
    # 运行时状态
    status: AdapterStatus = Field(AdapterStatus.UNREGISTERED, description="当前状态")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="创建时间")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="更新时间")
    last_accessed: Optional[datetime] = Field(None, description="最后访问时间")
    
    # 性能和统计
    performance_metrics: AdapterPerformanceMetrics = Field(default_factory=AdapterPerformanceMetrics, description="性能指标")
    usage_statistics: AdapterUsageStatistics = Field(default_factory=AdapterUsageStatistics, description="使用统计")
    
    # 扩展字段
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="自定义字段")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            set: lambda v: list(v)
        }
    
    @validator('adapter_id')
    def validate_adapter_id(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('adapter_id cannot be empty')
        # 适配器ID只能包含字母、数字、下划线和连字符
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('adapter_id can only contain letters, numbers, underscores and hyphens')
        return v.strip()
    
    @root_validator
    def update_timestamp(cls, values):
        """自动更新时间戳"""
        values['updated_at'] = datetime.now(timezone.utc)
        return values
    
    def get_hash(self) -> str:
        """获取元数据内容的哈希值，用于变更检测"""
        # 排除时间戳和统计信息的哈希计算
        hash_data = {
            'adapter_id': self.adapter_id,
            'name': self.name,
            'description': self.description,
            'adapter_type': self.adapter_type,
            'version': self.version.dict(),
            'capabilities': [cap.dict() for cap in self.capabilities],
            'dependencies': [dep.dict() for dep in self.dependencies],
            'configuration': [conf.dict() for conf in self.configuration],
            'permissions': self.permissions.dict()
        }
        
        hash_str = json.dumps(hash_data, sort_keys=True, default=str)
        return hashlib.sha256(hash_str.encode()).hexdigest()
    
    def is_compatible_with(self, other_adapter_id: str, version: str) -> bool:
        """检查与其他适配器的兼容性"""
        # 简单的版本兼容性检查逻辑
        for dep in self.dependencies:
            if dep.name == other_adapter_id:
                if dep.version is None:
                    return True  # 无版本要求
                # 这里可以实现更复杂的版本匹配逻辑
                return dep.version == version
        return True  # 没有依赖关系则兼容
    
    def get_required_permissions(self) -> Set[str]:
        """获取所有必需的权限"""
        perms = set(self.permissions.required_roles)
        if self.permissions.file_system_access:
            perms.add("file_system_access")
        if self.permissions.network_access:
            perms.add("network_access")
        if self.permissions.system_commands:
            perms.add("system_commands")
        if self.permissions.database_access:
            perms.add("database_access")
        return perms
    
    def update_performance_metrics(self, metrics: Dict[str, float]):
        """更新性能指标"""
        for key, value in metrics.items():
            if hasattr(self.performance_metrics, key):
                setattr(self.performance_metrics, key, value)
        self.performance_metrics.last_updated = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
    
    def record_execution(self, success: bool, user_id: Optional[str] = None, feature: Optional[str] = None):
        """记录执行统计"""
        self.usage_statistics.total_executions += 1
        if success:
            self.usage_statistics.successful_executions += 1
        else:
            self.usage_statistics.failed_executions += 1
        
        now = datetime.now(timezone.utc)
        if self.usage_statistics.first_execution is None:
            self.usage_statistics.first_execution = now
        self.usage_statistics.last_execution = now
        self.last_accessed = now
        
        if user_id:
            self.usage_statistics.active_users.add(user_id)
        
        if feature:
            self.usage_statistics.popular_features[feature] = \
                self.usage_statistics.popular_features.get(feature, 0) + 1
        
        self.updated_at = now


# ================================
# 查询和过滤相关数据结构
# ================================

@dataclass
class MetadataQuery:
    """元数据查询条件"""
    adapter_ids: Optional[List[str]] = None
    adapter_types: Optional[List[AdapterType]] = None
    statuses: Optional[List[AdapterStatus]] = None
    tags: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    security_levels: Optional[List[SecurityLevel]] = None
    capability_categories: Optional[List[CapabilityCategory]] = None
    authors: Optional[List[str]] = None
    version_range: Optional[Tuple[str, str]] = None  # (min_version, max_version)
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    min_success_rate: Optional[float] = None
    min_executions: Optional[int] = None
    has_dependencies: Optional[bool] = None
    custom_filters: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        result = {}
        for key, value in self.__dict__.items():
            if value is not None:
                if isinstance(value, (list, tuple)) and value:
                    result[key] = value
                elif not isinstance(value, (list, tuple)):
                    result[key] = value
        return result


@dataclass
class MetadataSearchOptions:
    """元数据搜索选项"""
    limit: int = 50                    # 结果数量限制
    offset: int = 0                    # 偏移量
    sort_by: str = "updated_at"        # 排序字段
    sort_order: str = "desc"           # 排序顺序: asc, desc
    include_deprecated: bool = False   # 是否包含已废弃的适配器
    include_stats: bool = True         # 是否包含统计信息
    fuzzy_search: bool = False         # 是否启用模糊搜索
    
    def validate(self):
        """验证搜索选项"""
        if self.limit <= 0 or self.limit > 1000:
            raise ValueError("limit must be between 1 and 1000")
        if self.offset < 0:
            raise ValueError("offset must be non-negative")
        if self.sort_order not in ("asc", "desc"):
            raise ValueError("sort_order must be 'asc' or 'desc'")


# ================================
# 存储接口定义
# ================================

from abc import ABC, abstractmethod

class MetadataStorage(ABC):
    """元数据存储接口"""
    
    @abstractmethod
    async def save(self, metadata: AdapterMetadata) -> bool:
        """保存元数据"""
        pass
    
    @abstractmethod
    async def load(self, adapter_id: str) -> Optional[AdapterMetadata]:
        """加载元数据"""
        pass
    
    @abstractmethod
    async def delete(self, adapter_id: str) -> bool:
        """删除元数据"""
        pass
    
    @abstractmethod
    async def list_all(self) -> List[str]:
        """列出所有适配器ID"""
        pass
    
    @abstractmethod
    async def search(self, query: MetadataQuery, options: MetadataSearchOptions) -> Tuple[List[AdapterMetadata], int]:
        """搜索元数据，返回(结果列表, 总数)"""
        pass
    
    @abstractmethod
    async def backup(self, backup_path: str) -> bool:
        """备份元数据"""
        pass
    
    @abstractmethod
    async def restore(self, backup_path: str) -> bool:
        """恢复元数据"""
        pass


# ================================
# 文件系统存储实现
# ================================

class FileSystemMetadataStorage(MetadataStorage):
    """基于文件系统的元数据存储实现"""
    
    def __init__(self, storage_path: Union[str, Path]):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self.logger = logging.getLogger(__name__)
    
    def _get_metadata_file(self, adapter_id: str) -> Path:
        """获取元数据文件路径"""
        return self.storage_path / f"{adapter_id}.json"
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterConfigurationError,
        message="Failed to save metadata to file system"
    )
    async def save(self, metadata: AdapterMetadata) -> bool:
        """保存元数据到文件"""
        async with self._lock:
            try:
                file_path = self._get_metadata_file(metadata.adapter_id)
                data = metadata.dict()
                
                # 确保目录存在
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # 写入文件
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False, default=str)
                
                self.logger.debug(f"Saved metadata for adapter {metadata.adapter_id}")
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to save metadata for {metadata.adapter_id}: {e}")
                raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterConfigurationError,
        message="Failed to load metadata from file system"
    )
    async def load(self, adapter_id: str) -> Optional[AdapterMetadata]:
        """从文件加载元数据"""
        try:
            file_path = self._get_metadata_file(adapter_id)
            
            if not file_path.exists():
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            metadata = AdapterMetadata.parse_obj(data)
            self.logger.debug(f"Loaded metadata for adapter {adapter_id}")
            return metadata
            
        except Exception as e:
            self.logger.error(f"Failed to load metadata for {adapter_id}: {e}")
            raise
    
    async def delete(self, adapter_id: str) -> bool:
        """删除元数据文件"""
        try:
            file_path = self._get_metadata_file(adapter_id)
            if file_path.exists():
                file_path.unlink()
                self.logger.debug(f"Deleted metadata for adapter {adapter_id}")
                return True
            return False
        except Exception as e:
            self.logger.error(f"Failed to delete metadata for {adapter_id}: {e}")
            return False
    
    async def list_all(self) -> List[str]:
        """列出所有适配器ID"""
        try:
            adapter_ids = []
            for file_path in self.storage_path.glob("*.json"):
                adapter_ids.append(file_path.stem)
            return sorted(adapter_ids)
        except Exception as e:
            self.logger.error(f"Failed to list adapters: {e}")
            return []
    
    async def search(self, query: MetadataQuery, options: MetadataSearchOptions) -> Tuple[List[AdapterMetadata], int]:
        """搜索元数据"""
        try:
            all_metadata = []
            
            # 加载所有元数据
            for adapter_id in await self.list_all():
                metadata = await self.load(adapter_id)
                if metadata:
                    all_metadata.append(metadata)
            
            # 应用过滤条件
            filtered_metadata = self._apply_filters(all_metadata, query, options)
            
            # 排序
            sorted_metadata = self._apply_sorting(filtered_metadata, options)
            
            # 分页
            total_count = len(sorted_metadata)
            start_idx = options.offset
            end_idx = start_idx + options.limit
            paginated_results = sorted_metadata[start_idx:end_idx]
            
            return paginated_results, total_count
            
        except Exception as e:
            self.logger.error(f"Failed to search metadata: {e}")
            return [], 0
    
    def _apply_filters(self, metadata_list: List[AdapterMetadata], query: MetadataQuery, options: MetadataSearchOptions) -> List[AdapterMetadata]:
        """应用过滤条件"""
        filtered = []
        
        for metadata in metadata_list:
            # 检查是否包含已废弃的适配器
            if not options.include_deprecated and metadata.status == AdapterStatus.DEPRECATED:
                continue
            
            # 应用各种过滤条件
            if not self._matches_query(metadata, query):
                continue
                
            filtered.append(metadata)
        
        return filtered
    
    def _matches_query(self, metadata: AdapterMetadata, query: MetadataQuery) -> bool:
        """检查元数据是否匹配查询条件"""
        # 适配器ID过滤
        if query.adapter_ids and metadata.adapter_id not in query.adapter_ids:
            return False
        
        # 适配器类型过滤
        if query.adapter_types and metadata.adapter_type not in query.adapter_types:
            return False
        
        # 状态过滤
        if query.statuses and metadata.status not in query.statuses:
            return False
        
        # 标签过滤
        if query.tags:
            if not any(tag in metadata.tags for tag in query.tags):
                return False
        
        # 关键词过滤
        if query.keywords:
            if not any(keyword in metadata.keywords for keyword in query.keywords):
                return False
        
        # 安全级别过滤
        if query.security_levels and metadata.permissions.security_level not in query.security_levels:
            return False
        
        # 能力分类过滤
        if query.capability_categories:
            capability_categories = {cap.category for cap in metadata.capabilities}
            if not any(cat in capability_categories for cat in query.capability_categories):
                return False
        
        # 作者过滤
        if query.authors and metadata.author not in query.authors:
            return False
        
        # 时间过滤
        if query.created_after and metadata.created_at < query.created_after:
            return False
        if query.created_before and metadata.created_at > query.created_before:
            return False
        if query.updated_after and metadata.updated_at < query.updated_after:
            return False
        if query.updated_before and metadata.updated_at > query.updated_before:
            return False
        
        # 性能指标过滤
        if query.min_success_rate and metadata.performance_metrics.success_rate < query.min_success_rate:
            return False
        if query.min_executions and metadata.usage_statistics.total_executions < query.min_executions:
            return False
        
        # 依赖关系过滤
        if query.has_dependencies is not None:
            has_deps = len(metadata.dependencies) > 0
            if query.has_dependencies != has_deps:
                return False
        
        # 自定义过滤器
        if query.custom_filters:
            for field, value in query.custom_filters.items():
                if hasattr(metadata, field):
                    if getattr(metadata, field) != value:
                        return False
        
        return True
    
    def _apply_sorting(self, metadata_list: List[AdapterMetadata], options: MetadataSearchOptions) -> List[AdapterMetadata]:
        """应用排序"""
        sort_field = options.sort_by
        reverse = options.sort_order == "desc"
        
        try:
            # 获取排序键函数
            def get_sort_key(metadata: AdapterMetadata):
                if hasattr(metadata, sort_field):
                    value = getattr(metadata, sort_field)
                    return value if value is not None else ""
                elif hasattr(metadata.performance_metrics, sort_field):
                    return getattr(metadata.performance_metrics, sort_field)
                elif hasattr(metadata.usage_statistics, sort_field):
                    return getattr(metadata.usage_statistics, sort_field)
                else:
                    return ""
            
            return sorted(metadata_list, key=get_sort_key, reverse=reverse)
            
        except Exception as e:
            self.logger.warning(f"Failed to sort by {sort_field}, using default order: {e}")
            return metadata_list
    
    async def backup(self, backup_path: str) -> bool:
        """备份所有元数据"""
        try:
            backup_dir = Path(backup_path)
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # 创建备份信息
            backup_info = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source_path": str(self.storage_path),
                "adapter_count": 0,
                "adapters": []
            }
            
            # 备份所有适配器元数据
            for adapter_id in await self.list_all():
                metadata = await self.load(adapter_id)
                if metadata:
                    backup_file = backup_dir / f"{adapter_id}.json"
                    with open(backup_file, 'w', encoding='utf-8') as f:
                        json.dump(metadata.dict(), f, indent=2, ensure_ascii=False, default=str)
                    
                    backup_info["adapters"].append(adapter_id)
                    backup_info["adapter_count"] += 1
            
            # 保存备份信息
            info_file = backup_dir / "backup_info.json"
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(backup_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Backup completed: {backup_info['adapter_count']} adapters backed up to {backup_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Backup failed: {e}")
            return False
    
    async def restore(self, backup_path: str) -> bool:
        """从备份恢复元数据"""
        try:
            backup_dir = Path(backup_path)
            if not backup_dir.exists():
                raise FileNotFoundError(f"Backup directory not found: {backup_path}")
            
            # 读取备份信息
            info_file = backup_dir / "backup_info.json"
            if info_file.exists():
                with open(info_file, 'r', encoding='utf-8') as f:
                    backup_info = json.load(f)
                
                restored_count = 0
                for adapter_id in backup_info.get("adapters", []):
                    backup_file = backup_dir / f"{adapter_id}.json"
                    if backup_file.exists():
                        with open(backup_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        metadata = AdapterMetadata.parse_obj(data)
                        if await self.save(metadata):
                            restored_count += 1
                
                self.logger.info(f"Restore completed: {restored_count} adapters restored from {backup_path}")
                return True
            else:
                # 没有备份信息文件，尝试直接恢复所有JSON文件
                restored_count = 0
                for backup_file in backup_dir.glob("*.json"):
                    try:
                        with open(backup_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        metadata = AdapterMetadata.parse_obj(data)
                        if await self.save(metadata):
                            restored_count += 1
                    except Exception as e:
                        self.logger.warning(f"Failed to restore {backup_file}: {e}")
                
                self.logger.info(f"Restore completed: {restored_count} adapters restored")
                return restored_count > 0
            
        except Exception as e:
            self.logger.error(f"Restore failed: {e}")
            return False


# ================================
# 内存缓存实现
# ================================

class MetadataCache:
    """元数据内存缓存"""
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._access_times: Dict[str, datetime] = {}
        self._lock = threading.RLock()
        self.logger = logging.getLogger(__name__)
        
        # 启动清理任务
        self._cleanup_task = None
        if ttl_seconds > 0:
            self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """启动清理任务"""
        async def cleanup_expired():
            while True:
                try:
                    await asyncio.sleep(min(self.ttl_seconds // 2, 300))  # 最多5分钟清理一次
                    await self.cleanup_expired()
                except Exception as e:
                    self.logger.error(f"Cache cleanup task error: {e}")
        
        try:
            loop = asyncio.get_event_loop()
            self._cleanup_task = loop.create_task(cleanup_expired())
        except RuntimeError:
            # 没有运行中的事件循环，忽略
            pass
    
    def get(self, adapter_id: str) -> Optional[AdapterMetadata]:
        """获取缓存的元数据"""
        with self._lock:
            if adapter_id not in self._cache:
                return None
            
            cache_entry = self._cache[adapter_id]
            cache_time = cache_entry.get("cached_at")
            
            # 检查是否过期
            if cache_time and self.ttl_seconds > 0:
                age = (datetime.now(timezone.utc) - cache_time).total_seconds()
                if age > self.ttl_seconds:
                    self._remove_entry(adapter_id)
                    return None
            
            # 更新访问时间
            self._access_times[adapter_id] = datetime.now(timezone.utc)
            
            try:
                return AdapterMetadata.parse_obj(cache_entry["data"])
            except Exception as e:
                self.logger.warning(f"Failed to parse cached metadata for {adapter_id}: {e}")
                self._remove_entry(adapter_id)
                return None
    
    def set(self, adapter_id: str, metadata: AdapterMetadata):
        """设置缓存"""
        with self._lock:
            # 检查缓存大小限制
            if len(self._cache) >= self.max_size and adapter_id not in self._cache:
                self._evict_lru()
            
            # 缓存数据
            self._cache[adapter_id] = {
                "data": metadata.dict(),
                "cached_at": datetime.now(timezone.utc)
            }
            self._access_times[adapter_id] = datetime.now(timezone.utc)
    
    def remove(self, adapter_id: str) -> bool:
        """删除缓存项"""
        with self._lock:
            return self._remove_entry(adapter_id)
    
    def _remove_entry(self, adapter_id: str) -> bool:
        """内部删除缓存项方法"""
        removed = False
        if adapter_id in self._cache:
            del self._cache[adapter_id]
            removed = True
        if adapter_id in self._access_times:
            del self._access_times[adapter_id]
        return removed
    
    def _evict_lru(self):
        """删除最久未访问的缓存项"""
        if not self._access_times:
            return
        
        # 找到最久未访问的项
        lru_adapter_id = min(self._access_times.keys(), 
                           key=lambda k: self._access_times[k])
        self._remove_entry(lru_adapter_id)
    
    async def cleanup_expired(self):
        """清理过期的缓存项"""
        if self.ttl_seconds <= 0:
            return
        
        with self._lock:
            current_time = datetime.now(timezone.utc)
            expired_keys = []
            
            for adapter_id, cache_entry in self._cache.items():
                cache_time = cache_entry.get("cached_at")
                if cache_time:
                    age = (current_time - cache_time).total_seconds()
                    if age > self.ttl_seconds:
                        expired_keys.append(adapter_id)
            
            for key in expired_keys:
                self._remove_entry(key)
            
            if expired_keys:
                self.logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
    
    def clear(self):
        """清空所有缓存"""
        with self._lock:
            self._cache.clear()
            self._access_times.clear()
    
    def stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        with self._lock:
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "ttl_seconds": self.ttl_seconds,
                "oldest_access": min(self._access_times.values()) if self._access_times else None,
                "newest_access": max(self._access_times.values()) if self._access_times else None
            }


# ================================
# 元数据管理器主类
# ================================

class MetadataManager:
    """
    适配器元数据管理器
    
    这是元数据管理系统的核心类，提供了完整的元数据管理功能。
    """
    
    def __init__(
        self,
        storage: Optional[MetadataStorage] = None,
        enable_cache: bool = True,
        cache_config: Optional[Dict[str, Any]] = None,
        auto_backup: bool = False,
        backup_interval_hours: int = 24
    ):
        """
        初始化元数据管理器
        
        Args:
            storage: 存储后端，默认使用文件系统存储
            enable_cache: 是否启用缓存
            cache_config: 缓存配置
            auto_backup: 是否启用自动备份
            backup_interval_hours: 备份间隔（小时）
        """
        # 初始化存储
        if storage is None:
            storage_path = Path.home() / ".zishu" / "adapters" / "metadata"
            self.storage = FileSystemMetadataStorage(storage_path)
        else:
            self.storage = storage
        
        # 初始化缓存
        self.enable_cache = enable_cache
        if enable_cache:
            cache_config = cache_config or {}
            self.cache = MetadataCache(**cache_config)
        else:
            self.cache = None
        
        # 其他配置
        self.auto_backup = auto_backup
        self.backup_interval_hours = backup_interval_hours
        
        # 内部状态
        self._listeners: List[Callable[[str, str, AdapterMetadata], None]] = []
        self._backup_task = None
        self.logger = logging.getLogger(__name__)
        
        # 启动自动备份任务
        if auto_backup:
            self._start_auto_backup()
    
    def _start_auto_backup(self):
        """启动自动备份任务"""
        async def auto_backup_task():
            while self.auto_backup:
                try:
                    await asyncio.sleep(self.backup_interval_hours * 3600)
                    backup_path = Path.home() / ".zishu" / "backups" / "metadata" / datetime.now().strftime("%Y%m%d_%H%M%S")
                    await self.backup(str(backup_path))
                    self.logger.info(f"Auto backup completed: {backup_path}")
                except Exception as e:
                    self.logger.error(f"Auto backup failed: {e}")
        
        try:
            loop = asyncio.get_event_loop()
            self._backup_task = loop.create_task(auto_backup_task())
        except RuntimeError:
            # 没有运行中的事件循环，忽略
            pass
    
    def add_event_listener(self, listener: Callable[[str, str, AdapterMetadata], None]):
        """
        添加事件监听器
        
        Args:
            listener: 监听器函数，参数为(event_type, adapter_id, metadata)
                     event_type可能的值: "created", "updated", "deleted"
        """
        self._listeners.append(listener)
    
    def remove_event_listener(self, listener: Callable[[str, str, AdapterMetadata], None]):
        """移除事件监听器"""
        if listener in self._listeners:
            self._listeners.remove(listener)
    
    def _notify_listeners(self, event_type: str, adapter_id: str, metadata: Optional[AdapterMetadata] = None):
        """通知事件监听器"""
        for listener in self._listeners:
            try:
                listener(event_type, adapter_id, metadata)
            except Exception as e:
                self.logger.warning(f"Event listener error: {e}")
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterValidationError,
        message="Failed to save adapter metadata"
    )
    async def save_metadata(self, metadata: AdapterMetadata, notify: bool = True) -> bool:
        """
        保存适配器元数据
        
        Args:
            metadata: 要保存的元数据
            notify: 是否通知事件监听器
            
        Returns:
            保存是否成功
        """
        # 检查是否是更新操作
        existing_metadata = await self.get_metadata(metadata.adapter_id, from_cache=False)
        is_update = existing_metadata is not None
        
        # 保存到存储
        success = await self.storage.save(metadata)
        
        if success:
            # 更新缓存
            if self.enable_cache and self.cache:
                self.cache.set(metadata.adapter_id, metadata)
            
            # 通知监听器
            if notify:
                event_type = "updated" if is_update else "created"
                self._notify_listeners(event_type, metadata.adapter_id, metadata)
            
            self.logger.info(f"{'Updated' if is_update else 'Created'} metadata for adapter {metadata.adapter_id}")
        
        return success
    
    async def get_metadata(self, adapter_id: str, from_cache: bool = True) -> Optional[AdapterMetadata]:
        """
        获取适配器元数据
        
        Args:
            adapter_id: 适配器ID
            from_cache: 是否优先从缓存获取
            
        Returns:
            适配器元数据，如果不存在则返回None
        """
        # 先尝试从缓存获取
        if from_cache and self.enable_cache and self.cache:
            cached_metadata = self.cache.get(adapter_id)
            if cached_metadata:
                # 更新最后访问时间
                cached_metadata.last_accessed = datetime.now(timezone.utc)
                return cached_metadata
        
        # 从存储加载
        metadata = await self.storage.load(adapter_id)
        
        if metadata:
            # 更新最后访问时间
            metadata.last_accessed = datetime.now(timezone.utc)
            await self.storage.save(metadata)
            
            # 更新缓存
            if self.enable_cache and self.cache:
                self.cache.set(adapter_id, metadata)
        
        return metadata
    
    async def delete_metadata(self, adapter_id: str, notify: bool = True) -> bool:
        """
        删除适配器元数据
        
        Args:
            adapter_id: 适配器ID
            notify: 是否通知事件监听器
            
        Returns:
            删除是否成功
        """
        # 获取元数据用于通知
        metadata = None
        if notify:
            metadata = await self.get_metadata(adapter_id, from_cache=False)
        
        # 从存储删除
        success = await self.storage.delete(adapter_id)
        
        if success:
            # 从缓存删除
            if self.enable_cache and self.cache:
                self.cache.remove(adapter_id)
            
            # 通知监听器
            if notify and metadata:
                self._notify_listeners("deleted", adapter_id, metadata)
            
            self.logger.info(f"Deleted metadata for adapter {adapter_id}")
        
        return success
    
    async def list_adapters(self, include_metadata: bool = False) -> Union[List[str], List[AdapterMetadata]]:
        """
        列出所有适配器
        
        Args:
            include_metadata: 是否包含完整的元数据
            
        Returns:
            适配器ID列表或元数据列表
        """
        adapter_ids = await self.storage.list_all()
        
        if not include_metadata:
            return adapter_ids
        
        # 获取所有元数据
        metadata_list = []
        for adapter_id in adapter_ids:
            metadata = await self.get_metadata(adapter_id)
            if metadata:
                metadata_list.append(metadata)
        
        return metadata_list
    
    async def search_adapters(
        self,
        query: Optional[MetadataQuery] = None,
        options: Optional[MetadataSearchOptions] = None
    ) -> Tuple[List[AdapterMetadata], int]:
        """
        搜索适配器
        
        Args:
            query: 查询条件
            options: 搜索选项
            
        Returns:
            (匹配的适配器列表, 总数)
        """
        if query is None:
            query = MetadataQuery()
        if options is None:
            options = MetadataSearchOptions()
        
        # 验证搜索选项
        options.validate()
        
        return await self.storage.search(query, options)
    
    async def update_adapter_status(self, adapter_id: str, status: AdapterStatus) -> bool:
        """更新适配器状态"""
        metadata = await self.get_metadata(adapter_id)
        if not metadata:
            return False
        
        metadata.status = status
        metadata.updated_at = datetime.now(timezone.utc)
        
        return await self.save_metadata(metadata, notify=True)
    
    async def record_execution(
        self, 
        adapter_id: str, 
        success: bool, 
        response_time_ms: Optional[float] = None,
        user_id: Optional[str] = None,
        feature: Optional[str] = None
    ) -> bool:
        """记录适配器执行统计"""
        metadata = await self.get_metadata(adapter_id)
        if not metadata:
            return False
        
        # 记录执行统计
        metadata.record_execution(success, user_id, feature)
        
        # 更新性能指标
        if response_time_ms is not None:
            current_metrics = metadata.performance_metrics
            total_executions = metadata.usage_statistics.total_executions
            
            # 计算新的平均响应时间
            if total_executions == 1:
                current_metrics.avg_response_time_ms = response_time_ms
                current_metrics.min_response_time_ms = response_time_ms
                current_metrics.max_response_time_ms = response_time_ms
            else:
                # 更新平均值
                prev_avg = current_metrics.avg_response_time_ms
                current_metrics.avg_response_time_ms = (
                    (prev_avg * (total_executions - 1) + response_time_ms) / total_executions
                )
                
                # 更新最大最小值
                current_metrics.max_response_time_ms = max(current_metrics.max_response_time_ms, response_time_ms)
                current_metrics.min_response_time_ms = min(current_metrics.min_response_time_ms, response_time_ms)
            
            # 更新成功率和错误率
            current_metrics.success_rate = metadata.usage_statistics.successful_executions / total_executions
            current_metrics.error_rate = metadata.usage_statistics.failed_executions / total_executions
            
            current_metrics.last_updated = datetime.now(timezone.utc)
        
        return await self.save_metadata(metadata, notify=False)
    
    async def get_adapter_statistics(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """获取适配器统计信息"""
        metadata = await self.get_metadata(adapter_id)
        if not metadata:
            return None
        
        return {
            "adapter_id": adapter_id,
            "status": metadata.status,
            "usage_statistics": metadata.usage_statistics.dict(),
            "performance_metrics": metadata.performance_metrics.dict(),
            "last_accessed": metadata.last_accessed,
            "uptime_days": (datetime.now(timezone.utc) - metadata.created_at).days if metadata.created_at else 0
        }
    
    async def validate_metadata(self, metadata: AdapterMetadata) -> Tuple[bool, List[str]]:
        """
        验证元数据
        
        Returns:
            (是否有效, 错误列表)
        """
        errors = []
        
        try:
            # Pydantic模型验证
            metadata.dict()
        except Exception as e:
            errors.append(f"Model validation failed: {str(e)}")
        
        # 业务逻辑验证
        if not metadata.adapter_id:
            errors.append("adapter_id is required")
        
        if not metadata.name:
            errors.append("name is required")
        
        if len(metadata.capabilities) == 0:
            errors.append("At least one capability is required")
        
        # 依赖关系验证
        for dep in metadata.dependencies:
            if not dep.name:
                errors.append(f"Dependency name is required")
        
        # 配置项验证
        required_configs = [cfg for cfg in metadata.configuration if cfg.required]
        for cfg in required_configs:
            if cfg.default_value is None:
                errors.append(f"Required configuration '{cfg.name}' must have a default value")
        
        return len(errors) == 0, errors
    
    async def get_dependency_graph(self) -> Dict[str, List[str]]:
        """获取适配器依赖关系图"""
        all_adapters = await self.list_adapters(include_metadata=True)
        dependency_graph = {}
        
        for metadata in all_adapters:
            adapter_id = metadata.adapter_id
            dependencies = []
            
            for dep in metadata.dependencies:
                if dep.type == "adapter":
                    dependencies.append(dep.name)
            
            dependency_graph[adapter_id] = dependencies
        
        return dependency_graph
    
    async def check_circular_dependencies(self) -> List[List[str]]:
        """检查循环依赖，返回循环依赖链列表"""
        graph = await self.get_dependency_graph()
        cycles = []
        visited = set()
        rec_stack = set()
        
        def dfs(node, path):
            if node in rec_stack:
                # 找到循环
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:] + [node])
                return
            
            if node in visited:
                return
            
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, []):
                dfs(neighbor, path + [neighbor])
            
            rec_stack.remove(node)
        
        for adapter_id in graph.keys():
            if adapter_id not in visited:
                dfs(adapter_id, [adapter_id])
        
        return cycles
    
    async def backup(self, backup_path: str) -> bool:
        """备份所有元数据"""
        return await self.storage.backup(backup_path)
    
    async def restore(self, backup_path: str) -> bool:
        """从备份恢复元数据"""
        success = await self.storage.restore(backup_path)
        
        if success and self.enable_cache and self.cache:
            # 清空缓存以强制重新加载
            self.cache.clear()
        
        return success
    
    def get_cache_stats(self) -> Optional[Dict[str, Any]]:
        """获取缓存统计信息"""
        if self.enable_cache and self.cache:
            return self.cache.stats()
        return None
    
    async def cleanup(self):
        """清理资源"""
        if self._backup_task:
            self._backup_task.cancel()
        
        if self.enable_cache and self.cache and hasattr(self.cache, '_cleanup_task') and self.cache._cleanup_task:
            self.cache._cleanup_task.cancel()


# ================================
# 工厂函数和默认实例
# ================================

def create_metadata_manager(
    storage_path: Optional[Union[str, Path]] = None,
    storage_type: str = "filesystem",
    enable_cache: bool = True,
    **kwargs
) -> MetadataManager:
    """
    创建元数据管理器实例
    
    Args:
        storage_path: 存储路径
        storage_type: 存储类型，目前支持"filesystem"
        enable_cache: 是否启用缓存
        **kwargs: 其他配置选项
        
    Returns:
        元数据管理器实例
    """
    # 创建存储后端
    if storage_type == "filesystem":
        if storage_path is None:
            storage_path = Path.home() / ".zishu" / "adapters" / "metadata"
        storage = FileSystemMetadataStorage(storage_path)
    else:
        raise ValueError(f"Unsupported storage type: {storage_type}")
    
    # 创建管理器
    return MetadataManager(
        storage=storage,
        enable_cache=enable_cache,
        **kwargs
    )


# 默认的全局元数据管理器实例
_default_manager: Optional[MetadataManager] = None

def get_default_metadata_manager() -> MetadataManager:
    """获取默认的元数据管理器实例"""
    global _default_manager
    if _default_manager is None:
        _default_manager = create_metadata_manager()
    return _default_manager

def set_default_metadata_manager(manager: MetadataManager):
    """设置默认的元数据管理器实例"""
    global _default_manager
    _default_manager = manager


# ================================
# 便利函数
# ================================

async def create_adapter_metadata(
    adapter_id: str,
    name: str,
    adapter_type: AdapterType,
    version: str,
    description: Optional[str] = None,
    **kwargs
) -> AdapterMetadata:
    """
    快速创建适配器元数据
    
    Args:
        adapter_id: 适配器ID
        name: 适配器名称
        adapter_type: 适配器类型
        version: 版本号
        description: 描述
        **kwargs: 其他属性
        
    Returns:
        创建的元数据实例
    """
    version_info = AdapterVersion(
        version=version,
        release_date=datetime.now(timezone.utc)
    )
    
    return AdapterMetadata(
        adapter_id=adapter_id,
        name=name,
        adapter_type=adapter_type,
        version=version_info,
        description=description,
        **kwargs
    )


def create_capability(
    name: str,
    category: CapabilityCategory,
    description: Optional[str] = None,
    input_schema: Optional[Dict[str, Any]] = None,
    output_schema: Optional[Dict[str, Any]] = None,
    **kwargs
) -> AdapterCapability:
    """快速创建适配器能力描述"""
    return AdapterCapability(
        name=name,
        category=category,
        description=description,
        input_schema=input_schema,
        output_schema=output_schema,
        **kwargs
    )


def create_dependency(
    name: str,
    version: Optional[str] = None,
    dep_type: str = "package",
    optional: bool = False,
    description: Optional[str] = None
) -> AdapterDependency:
    """快速创建依赖描述"""
    return AdapterDependency(
        name=name,
        version=version,
        type=dep_type,
        optional=optional,
        description=description
    )


def create_configuration(
    name: str,
    config_type: str,
    required: bool = True,
    default_value: Optional[Any] = None,
    description: Optional[str] = None,
    sensitive: bool = False,
    **kwargs
) -> AdapterConfiguration:
    """快速创建配置项"""
    return AdapterConfiguration(
        name=name,
        type=config_type,
        required=required,
        default_value=default_value,
        description=description,
        sensitive=sensitive,
        **kwargs
    )


# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举
    'AdapterType', 'AdapterStatus', 'SecurityLevel', 'CapabilityCategory',
    
    # 核心数据模型
    'AdapterMetadata', 'AdapterCapability', 'AdapterDependency',
    'AdapterConfiguration', 'AdapterPermissions', 'AdapterVersion',
    'AdapterPerformanceMetrics', 'AdapterUsageStatistics',
    
    # 查询相关
    'MetadataQuery', 'MetadataSearchOptions',
    
    # 存储相关
    'MetadataStorage', 'FileSystemMetadataStorage', 'MetadataCache',
    
    # 管理器
    'MetadataManager',
    
    # 工厂函数
    'create_metadata_manager', 'get_default_metadata_manager', 'set_default_metadata_manager',
    
    # 便利函数
    'create_adapter_metadata', 'create_capability', 'create_dependency', 'create_configuration'
]

#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
打包系统数据模型 - Zishu-sensei
提供完整的适配器打包、分发、版本管理的API接口数据验证和序列化
包含打包配置、构建任务、分发管理、版本控制等功能
"""

from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl, DirectoryPath, FilePath
from typing import Optional, List, Any, Dict, Union, Literal, Annotated, Set
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
from pathlib import Path
import uuid
import re

# 从其他模块导入基础类型
from .auth import UserRole, UserStatus
from .user import UserProfileDetail
from .adapter import AdapterType, AdapterStatus, AdapterCapability, AdapterResourceRequirements

# ======================== 枚举定义 ========================

class PackageType(str, Enum):
    """包类型枚举"""
    ADAPTER = "adapter"           # 适配器包
    PLUGIN = "plugin"             # 插件包
    THEME = "theme"               # 主题包
    TEMPLATE = "template"         # 模板包
    LIBRARY = "library"           # 库包
    TOOL = "tool"                 # 工具包
    DATASET = "dataset"           # 数据集包
    MODEL = "model"               # 模型包
    EXTENSION = "extension"       # 扩展包
    BUNDLE = "bundle"             # 捆绑包

class PackageFormat(str, Enum):
    """包格式枚举"""
    ZIP = "zip"                   # ZIP压缩包
    TAR_GZ = "tar.gz"            # TAR.GZ压缩包
    TAR_XZ = "tar.xz"            # TAR.XZ压缩包
    WHEEL = "wheel"               # Python Wheel包
    DOCKER = "docker"             # Docker镜像
    APPIMAGE = "appimage"         # AppImage格式
    SNAP = "snap"                 # Snap包
    DEB = "deb"                   # Debian包
    RPM = "rpm"                   # RPM包
    MSI = "msi"                   # Windows MSI包
    NSIS = "nsis"                 # NSIS安装包

class PackageStatus(str, Enum):
    """包状态枚举"""
    DRAFT = "draft"               # 草稿
    BUILDING = "building"         # 构建中
    BUILD_SUCCESS = "build_success"  # 构建成功
    BUILD_FAILED = "build_failed"    # 构建失败
    TESTING = "testing"           # 测试中
    TEST_PASSED = "test_passed"   # 测试通过
    TEST_FAILED = "test_failed"   # 测试失败
    PACKAGING = "packaging"       # 打包中
    PACKAGED = "packaged"         # 打包完成
    SIGNING = "signing"           # 签名中
    SIGNED = "signed"             # 已签名
    PUBLISHING = "publishing"     # 发布中
    PUBLISHED = "published"       # 已发布
    DEPRECATED = "deprecated"     # 已弃用
    ARCHIVED = "archived"         # 已归档
    DELETED = "deleted"           # 已删除

class BuildStatus(str, Enum):
    """构建状态枚举"""
    PENDING = "pending"           # 等待中
    QUEUED = "queued"            # 队列中
    RUNNING = "running"          # 运行中
    SUCCESS = "success"          # 成功
    FAILED = "failed"            # 失败
    CANCELLED = "cancelled"      # 已取消
    TIMEOUT = "timeout"          # 超时
    SKIPPED = "skipped"          # 已跳过

class DistributionChannel(str, Enum):
    """分发渠道枚举"""
    OFFICIAL = "official"         # 官方商店
    COMMUNITY = "community"       # 社区市场
    GITHUB = "github"             # GitHub Releases
    DOCKER_HUB = "docker_hub"     # Docker Hub
    PYPI = "pypi"                 # Python Package Index
    NPM = "npm"                   # NPM Registry
    CUSTOM = "custom"             # 自定义渠道
    PRIVATE = "private"           # 私有渠道

class VersionType(str, Enum):
    """版本类型枚举"""
    MAJOR = "major"               # 主版本
    MINOR = "minor"               # 次版本
    PATCH = "patch"               # 补丁版本
    PRERELEASE = "prerelease"     # 预发布版本
    BUILD = "build"               # 构建版本
    HOTFIX = "hotfix"             # 热修复版本

class TestType(str, Enum):
    """测试类型枚举"""
    UNIT = "unit"                 # 单元测试
    INTEGRATION = "integration"   # 集成测试
    FUNCTIONAL = "functional"     # 功能测试
    PERFORMANCE = "performance"   # 性能测试
    SECURITY = "security"         # 安全测试
    COMPATIBILITY = "compatibility"  # 兼容性测试
    SMOKE = "smoke"               # 冒烟测试
    REGRESSION = "regression"     # 回归测试

class SignatureType(str, Enum):
    """签名类型枚举"""
    GPG = "gpg"                   # GPG签名
    CODE_SIGNING = "code_signing" # 代码签名
    HASH = "hash"                 # 哈希校验
    CHECKSUM = "checksum"         # 校验和
    DIGITAL_CERT = "digital_cert" # 数字证书

# ======================== 基础数据模型 ========================

class VersionInfo(BaseModel):
    """版本信息模型"""
    major: int = Field(..., ge=0, description="主版本号")
    minor: int = Field(..., ge=0, description="次版本号")
    patch: int = Field(..., ge=0, description="补丁版本号")
    prerelease: Optional[str] = Field(None, description="预发布标识")
    build: Optional[str] = Field(None, description="构建标识")
    
    @field_validator('prerelease')
    @classmethod
    def validate_prerelease(cls, v):
        if v is not None and not re.match(r'^[a-zA-Z0-9\-\.]+$', v):
            raise ValueError('预发布标识格式不正确')
        return v
    
    @field_validator('build')
    @classmethod
    def validate_build(cls, v):
        if v is not None and not re.match(r'^[a-zA-Z0-9\-\.]+$', v):
            raise ValueError('构建标识格式不正确')
        return v
    
    def __str__(self) -> str:
        version = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            version += f"-{self.prerelease}"
        if self.build:
            version += f"+{self.build}"
        return version
    
    @classmethod
    def from_string(cls, version_str: str) -> 'VersionInfo':
        """从版本字符串创建版本信息"""
        # 解析版本字符串，如 "1.2.3-alpha.1+build.123"
        pattern = r'^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?(?:\+([a-zA-Z0-9\-\.]+))?$'
        match = re.match(pattern, version_str)
        if not match:
            raise ValueError(f'无效的版本字符串: {version_str}')
        
        major, minor, patch, prerelease, build = match.groups()
        return cls(
            major=int(major),
            minor=int(minor),
            patch=int(patch),
            prerelease=prerelease,
            build=build
        )

class FileInfo(BaseModel):
    """文件信息模型"""
    path: str = Field(..., description="文件路径")
    size: int = Field(..., ge=0, description="文件大小(字节)")
    checksum: str = Field(..., description="文件校验和")
    checksum_type: str = Field("sha256", description="校验和类型")
    mime_type: Optional[str] = Field(None, description="MIME类型")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    modified_at: Optional[datetime] = Field(None, description="修改时间")
    
    @field_validator('checksum')
    @classmethod
    def validate_checksum(cls, v):
        if not re.match(r'^[a-fA-F0-9]+$', v):
            raise ValueError('校验和格式不正确')
        return v.lower()

class DependencyInfo(BaseModel):
    """依赖信息模型"""
    name: str = Field(..., description="依赖名称")
    version_constraint: str = Field(..., description="版本约束")
    optional: bool = Field(False, description="是否可选")
    dev_only: bool = Field(False, description="是否仅开发依赖")
    source: Optional[str] = Field(None, description="依赖来源")
    
    @field_validator('version_constraint')
    @classmethod
    def validate_version_constraint(cls, v):
        # 验证版本约束格式，如 ">=1.0.0,<2.0.0"
        if not re.match(r'^[>=<~^!,\s\d\.\-\w]+$', v):
            raise ValueError('版本约束格式不正确')
        return v

class BuildConfiguration(BaseModel):
    """构建配置模型"""
    build_tool: str = Field(..., description="构建工具")
    build_script: Optional[str] = Field(None, description="构建脚本")
    build_args: List[str] = Field(default_factory=list, description="构建参数")
    environment: Dict[str, str] = Field(default_factory=dict, description="环境变量")
    pre_build_commands: List[str] = Field(default_factory=list, description="构建前命令")
    post_build_commands: List[str] = Field(default_factory=list, description="构建后命令")
    timeout_seconds: int = Field(3600, ge=60, le=86400, description="构建超时时间(秒)")
    docker_image: Optional[str] = Field(None, description="Docker构建镜像")
    cache_enabled: bool = Field(True, description="是否启用缓存")
    parallel_jobs: int = Field(1, ge=1, le=16, description="并行任务数")

class TestConfiguration(BaseModel):
    """测试配置模型"""
    test_framework: str = Field(..., description="测试框架")
    test_command: str = Field(..., description="测试命令")
    test_paths: List[str] = Field(default_factory=list, description="测试路径")
    coverage_enabled: bool = Field(True, description="是否启用覆盖率")
    coverage_threshold: float = Field(0.8, ge=0.0, le=1.0, description="覆盖率阈值")
    timeout_seconds: int = Field(1800, ge=60, le=7200, description="测试超时时间(秒)")
    environment: Dict[str, str] = Field(default_factory=dict, description="测试环境变量")
    parallel_enabled: bool = Field(False, description="是否并行测试")

class PackageMetadata(BaseModel):
    """包元数据模型"""
    name: str = Field(..., min_length=1, max_length=100, description="包名称")
    display_name: str = Field(..., min_length=1, max_length=100, description="显示名称")
    description: str = Field(..., min_length=10, max_length=1000, description="包描述")
    version: VersionInfo = Field(..., description="版本信息")
    package_type: PackageType = Field(..., description="包类型")
    author: str = Field(..., description="作者")
    maintainer: Optional[str] = Field(None, description="维护者")
    license: str = Field(..., description="许可证")
    homepage: Optional[HttpUrl] = Field(None, description="主页地址")
    repository: Optional[HttpUrl] = Field(None, description="代码仓库")
    documentation: Optional[HttpUrl] = Field(None, description="文档地址")
    keywords: Set[str] = Field(default_factory=set, description="关键词")
    categories: Set[str] = Field(default_factory=set, description="分类")
    tags: Set[str] = Field(default_factory=set, description="标签")
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not re.match(r'^[a-z0-9\-_]+$', v):
            raise ValueError('包名称只能包含小写字母、数字、连字符和下划线')
        return v
    
    @field_validator('keywords', 'categories', 'tags')
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError('标签数量不能超过20个')
        for tag in v:
            if len(tag) > 50:
                raise ValueError('单个标签长度不能超过50个字符')
        return v

class SignatureInfo(BaseModel):
    """签名信息模型"""
    signature_type: SignatureType = Field(..., description="签名类型")
    signature: str = Field(..., description="签名内容")
    public_key: Optional[str] = Field(None, description="公钥")
    certificate: Optional[str] = Field(None, description="证书")
    algorithm: str = Field(..., description="签名算法")
    created_at: datetime = Field(default_factory=datetime.now, description="签名时间")
    expires_at: Optional[datetime] = Field(None, description="过期时间")
    
    @field_validator('signature')
    @classmethod
    def validate_signature(cls, v):
        if not v.strip():
            raise ValueError('签名内容不能为空')
        return v

# ======================== 请求模型 ========================

class PackageCreateRequest(BaseModel):
    """创建包请求模型"""
    metadata: PackageMetadata = Field(..., description="包元数据")
    source_path: str = Field(..., description="源码路径")
    build_config: BuildConfiguration = Field(..., description="构建配置")
    test_config: Optional[TestConfiguration] = Field(None, description="测试配置")
    dependencies: List[DependencyInfo] = Field(default_factory=list, description="依赖列表")
    include_patterns: List[str] = Field(default_factory=list, description="包含文件模式")
    exclude_patterns: List[str] = Field(default_factory=list, description="排除文件模式")
    auto_build: bool = Field(True, description="是否自动构建")
    auto_test: bool = Field(True, description="是否自动测试")
    auto_publish: bool = Field(False, description="是否自动发布")

class PackageUpdateRequest(BaseModel):
    """更新包请求模型"""
    metadata: Optional[PackageMetadata] = Field(None, description="包元数据")
    build_config: Optional[BuildConfiguration] = Field(None, description="构建配置")
    test_config: Optional[TestConfiguration] = Field(None, description="测试配置")
    dependencies: Optional[List[DependencyInfo]] = Field(None, description="依赖列表")
    include_patterns: Optional[List[str]] = Field(None, description="包含文件模式")
    exclude_patterns: Optional[List[str]] = Field(None, description="排除文件模式")
    status: Optional[PackageStatus] = Field(None, description="包状态")

class BuildRequest(BaseModel):
    """构建请求模型"""
    package_id: str = Field(..., description="包ID")
    version: Optional[str] = Field(None, description="指定版本")
    target_formats: List[PackageFormat] = Field(default_factory=list, description="目标格式")
    force_rebuild: bool = Field(False, description="强制重新构建")
    skip_tests: bool = Field(False, description="跳过测试")
    build_args: Dict[str, Any] = Field(default_factory=dict, description="额外构建参数")
    priority: int = Field(5, ge=1, le=10, description="构建优先级")

class TestRequest(BaseModel):
    """测试请求模型"""
    package_id: str = Field(..., description="包ID")
    test_types: List[TestType] = Field(default_factory=list, description="测试类型")
    test_environments: List[str] = Field(default_factory=list, description="测试环境")
    parallel: bool = Field(False, description="并行测试")
    coverage_required: bool = Field(True, description="是否要求覆盖率")

class PublishRequest(BaseModel):
    """发布请求模型"""
    package_id: str = Field(..., description="包ID")
    version: str = Field(..., description="发布版本")
    channels: List[DistributionChannel] = Field(..., description="发布渠道")
    release_notes: Optional[str] = Field(None, description="发布说明")
    is_prerelease: bool = Field(False, description="是否预发布")
    auto_sign: bool = Field(True, description="自动签名")

class SignRequest(BaseModel):
    """签名请求模型"""
    package_id: str = Field(..., description="包ID")
    version: str = Field(..., description="版本")
    signature_type: SignatureType = Field(..., description="签名类型")
    key_id: Optional[str] = Field(None, description="密钥ID")
    passphrase: Optional[str] = Field(None, description="密钥口令")

# ======================== 响应模型 ========================

class PackageListItem(BaseModel):
    """包列表项模型"""
    id: str = Field(..., description="包ID")
    name: str = Field(..., description="包名称")
    display_name: str = Field(..., description="显示名称")
    description: str = Field(..., description="包描述")
    version: str = Field(..., description="当前版本")
    package_type: PackageType = Field(..., description="包类型")
    status: PackageStatus = Field(..., description="包状态")
    author: str = Field(..., description="作者")
    download_count: int = Field(0, description="下载次数")
    star_count: int = Field(0, description="收藏次数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    tags: List[str] = Field(default_factory=list, description="标签")
    is_featured: bool = Field(False, description="是否精选")
    is_verified: bool = Field(False, description="是否已验证")

class PackageDetailResponse(BaseModel):
    """包详情响应模型"""
    id: str = Field(..., description="包ID")
    metadata: PackageMetadata = Field(..., description="包元数据")
    status: PackageStatus = Field(..., description="包状态")
    build_config: BuildConfiguration = Field(..., description="构建配置")
    test_config: Optional[TestConfiguration] = Field(None, description="测试配置")
    dependencies: List[DependencyInfo] = Field(default_factory=list, description="依赖列表")
    versions: List[str] = Field(default_factory=list, description="版本列表")
    files: List[FileInfo] = Field(default_factory=list, description="文件列表")
    signatures: List[SignatureInfo] = Field(default_factory=list, description="签名信息")
    statistics: Dict[str, Any] = Field(default_factory=dict, description="统计信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: str = Field(..., description="创建者")
    
class BuildTaskResponse(BaseModel):
    """构建任务响应模型"""
    id: str = Field(..., description="任务ID")
    package_id: str = Field(..., description="包ID")
    package_name: str = Field(..., description="包名称")
    version: str = Field(..., description="版本")
    status: BuildStatus = Field(..., description="构建状态")
    target_formats: List[PackageFormat] = Field(default_factory=list, description="目标格式")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="构建进度")
    logs: List[str] = Field(default_factory=list, description="构建日志")
    artifacts: List[FileInfo] = Field(default_factory=list, description="构建产物")
    error_message: Optional[str] = Field(None, description="错误信息")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    finished_at: Optional[datetime] = Field(None, description="完成时间")
    duration_seconds: Optional[int] = Field(None, description="构建耗时(秒)")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

class TestResultResponse(BaseModel):
    """测试结果响应模型"""
    id: str = Field(..., description="测试ID")
    package_id: str = Field(..., description="包ID")
    version: str = Field(..., description="版本")
    test_type: TestType = Field(..., description="测试类型")
    status: str = Field(..., description="测试状态")
    passed: int = Field(0, description="通过测试数")
    failed: int = Field(0, description="失败测试数")
    skipped: int = Field(0, description="跳过测试数")
    coverage: Optional[float] = Field(None, description="覆盖率")
    duration_seconds: float = Field(0.0, description="测试耗时(秒)")
    logs: List[str] = Field(default_factory=list, description="测试日志")
    reports: List[FileInfo] = Field(default_factory=list, description="测试报告")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

class PublishResultResponse(BaseModel):
    """发布结果响应模型"""
    id: str = Field(..., description="发布ID")
    package_id: str = Field(..., description="包ID")
    version: str = Field(..., description="版本")
    channels: List[DistributionChannel] = Field(default_factory=list, description="发布渠道")
    status: str = Field(..., description="发布状态")
    download_urls: Dict[str, str] = Field(default_factory=dict, description="下载链接")
    published_at: Optional[datetime] = Field(None, description="发布时间")
    error_message: Optional[str] = Field(None, description="错误信息")

# ======================== 统计和分析模型 ========================

class PackageStatistics(BaseModel):
    """包统计模型"""
    total_packages: int = Field(0, description="包总数")
    active_packages: int = Field(0, description="活跃包数")
    total_downloads: int = Field(0, description="总下载量")
    total_builds: int = Field(0, description="总构建次数")
    successful_builds: int = Field(0, description="成功构建次数")
    failed_builds: int = Field(0, description="失败构建次数")
    average_build_time: float = Field(0.0, description="平均构建时间(秒)")
    total_tests: int = Field(0, description="总测试次数")
    test_pass_rate: float = Field(0.0, description="测试通过率")
    storage_used_bytes: int = Field(0, description="存储使用量(字节)")

class PopularPackage(BaseModel):
    """热门包模型"""
    package_id: str = Field(..., description="包ID")
    name: str = Field(..., description="包名称")
    download_count: int = Field(0, description="下载次数")
    star_count: int = Field(0, description="收藏次数")
    growth_rate: float = Field(0.0, description="增长率")

# ======================== 分页和搜索模型 ========================

class PaginatedResponse(BaseModel):
    """分页响应模型"""
    items: List[Any] = Field(default_factory=list, description="数据项")
    total: int = Field(0, description="总数量")
    page: int = Field(1, description="当前页码")
    size: int = Field(20, description="页面大小")
    has_next: bool = Field(False, description="是否有下一页")
    has_prev: bool = Field(False, description="是否有上一页")
    total_pages: int = Field(0, description="总页数")

class SearchFilters(BaseModel):
    """搜索过滤器模型"""
    package_types: Optional[List[PackageType]] = Field(None, description="包类型过滤")
    statuses: Optional[List[PackageStatus]] = Field(None, description="状态过滤")
    authors: Optional[List[str]] = Field(None, description="作者过滤")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    categories: Optional[List[str]] = Field(None, description="分类过滤")
    date_from: Optional[datetime] = Field(None, description="开始日期")
    date_to: Optional[datetime] = Field(None, description="结束日期")
    min_downloads: Optional[int] = Field(None, description="最小下载量")
    verified_only: bool = Field(False, description="仅已验证包")

# ======================== 工具函数 ========================

def validate_package_name(name: str) -> bool:
    """验证包名称格式"""
    return bool(re.match(r'^[a-z0-9\-_]+$', name))

def generate_package_id() -> str:
    """生成包ID"""
    return str(uuid.uuid4())

def calculate_package_size(files: List[FileInfo]) -> int:
    """计算包大小"""
    return sum(file.size for file in files)

def is_version_greater(version1: str, version2: str) -> bool:
    """比较版本大小"""
    try:
        v1 = VersionInfo.from_string(version1)
        v2 = VersionInfo.from_string(version2)
        
        if v1.major != v2.major:
            return v1.major > v2.major
        if v1.minor != v2.minor:
            return v1.minor > v2.minor
        if v1.patch != v2.patch:
            return v1.patch > v2.patch
        
        # 预发布版本比较
        if v1.prerelease is None and v2.prerelease is not None:
            return True
        if v1.prerelease is not None and v2.prerelease is None:
            return False
        if v1.prerelease is not None and v2.prerelease is not None:
            return v1.prerelease > v2.prerelease
        
        return False
    except ValueError:
        return False

def create_package_slug(name: str) -> str:
    """创建包标识符"""
    # 转换为小写，替换空格和特殊字符为连字符
    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug.strip('-')

# ======================== 导出 ========================

__all__ = [
    # 枚举
    'PackageType', 'PackageFormat', 'PackageStatus', 'BuildStatus', 
    'DistributionChannel', 'VersionType', 'TestType', 'SignatureType',
    
    # 基础模型
    'VersionInfo', 'FileInfo', 'DependencyInfo', 'BuildConfiguration',
    'TestConfiguration', 'PackageMetadata', 'SignatureInfo',
    
    # 请求模型
    'PackageCreateRequest', 'PackageUpdateRequest', 'BuildRequest',
    'TestRequest', 'PublishRequest', 'SignRequest',
    
    # 响应模型
    'PackageListItem', 'PackageDetailResponse', 'BuildTaskResponse',
    'TestResultResponse', 'PublishResultResponse',
    
    # 统计模型
    'PackageStatistics', 'PopularPackage',
    
    # 分页和搜索
    'PaginatedResponse', 'SearchFilters',
    
    # 工具函数
    'validate_package_name', 'generate_package_id', 'calculate_package_size',
    'is_version_greater', 'create_package_slug'
]

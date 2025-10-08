#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
打包数据模型 - Zishu-sensei
定义包管理、构建、测试、发布相关的数据库模型
使用SQLAlchemy ORM进行数据库操作
"""

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    JSON,
    ForeignKey,
    Enum,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from datetime import datetime
import uuid
from typing import List, Dict, Any, Optional

from ..core.database import Base
from ..schemas.packaging import (
    PackageStatus,
    BuildStatus,
    TestType,
    PackageType,
    DistributionChannel,
    PackageFormat,
)

# ======================== 包模型 ========================


class PackageModel(Base):
    """包模型"""

    __tablename__ = "packages"

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True, comment="包名")
    display_name = Column(String(200), nullable=False, comment="显示名称")
    description = Column(Text, comment="包描述")

    # 版本信息
    version = Column(String(50), nullable=False, comment="当前版本")
    package_type = Column(Enum(PackageType), nullable=False, comment="包类型")

    # 作者信息
    author = Column(String(100), nullable=False, comment="作者")
    maintainer = Column(String(100), comment="维护者")
    license = Column(String(50), comment="许可证")

    # 链接信息
    homepage = Column(String(500), comment="主页链接")
    repository = Column(String(500), comment="仓库链接")
    documentation = Column(String(500), comment="文档链接")

    # 分类标签
    keywords = Column(ARRAY(String), default=[], comment="关键词")
    categories = Column(ARRAY(String), default=[], comment="分类")
    tags = Column(ARRAY(String), default=[], comment="标签")

    # 状态信息
    status = Column(
        Enum(PackageStatus),
        default=PackageStatus.DRAFT,
        nullable=False,
        index=True,
        comment="包状态",
    )
    is_featured = Column(Boolean, default=False, comment="是否精选")
    is_verified = Column(Boolean, default=False, comment="是否已验证")

    # 文件路径
    source_path = Column(String(1000), nullable=False, comment="源码路径")

    # 配置信息
    build_config = Column(JSON, default={}, comment="构建配置")
    test_config = Column(JSON, comment="测试配置")
    dependencies = Column(JSON, default=[], comment="依赖列表")

    # 包含排除模式
    include_patterns = Column(ARRAY(String), default=[], comment="包含模式")
    exclude_patterns = Column(ARRAY(String), default=[], comment="排除模式")

    # 统计信息
    download_count = Column(Integer, default=0, comment="下载次数")
    star_count = Column(Integer, default=0, comment="点赞数")
    fork_count = Column(Integer, default=0, comment="Fork数")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # 用户关联
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    creator = relationship(
        "User", foreign_keys=[created_by], backref="created_packages"
    )
    updater = relationship("User", foreign_keys=[updated_by])

    # 反向关系
    build_tasks = relationship(
        "BuildTaskModel", back_populates="package", cascade="all, delete-orphan"
    )
    test_results = relationship(
        "TestResultModel", back_populates="package", cascade="all, delete-orphan"
    )
    publish_results = relationship(
        "PublishResultModel", back_populates="package", cascade="all, delete-orphan"
    )
    package_versions = relationship(
        "PackageVersionModel", back_populates="package", cascade="all, delete-orphan"
    )
    package_files = relationship(
        "PackageFileModel", back_populates="package", cascade="all, delete-orphan"
    )
    signatures = relationship(
        "PackageSignatureModel", back_populates="package", cascade="all, delete-orphan"
    )

    # 索引
    __table_args__ = (
        Index("idx_package_status_type", "status", "package_type"),
        Index("idx_package_created_at", "created_at"),
        Index("idx_package_download_count", "download_count"),
        Index("idx_package_tags", "tags"),
        {"comment": "包信息表"},
    )

    def __repr__(self):
        return f"<Package(id={self.id}, name={self.name}, version={self.version})>"


# ======================== 版本模型 ========================


class PackageVersionModel(Base):
    """包版本模型"""

    __tablename__ = "package_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )

    # 版本信息
    version = Column(String(50), nullable=False, comment="版本号")
    version_type = Column(
        String(20), default="release", comment="版本类型"
    )  # release, prerelease, beta, alpha

    # 版本元数据
    changelog = Column(Text, comment="更新日志")
    release_notes = Column(Text, comment="发布说明")
    breaking_changes = Column(Text, comment="破坏性变更")

    # 兼容性信息
    min_system_version = Column(String(50), comment="最低系统版本要求")
    max_system_version = Column(String(50), comment="最高系统版本要求")
    compatibility_tags = Column(ARRAY(String), default=[], comment="兼容性标签")

    # 文件信息
    file_size = Column(Integer, comment="文件大小（字节）")
    file_count = Column(Integer, comment="文件数量")
    checksum = Column(String(128), comment="文件校验和")

    # 状态信息
    is_active = Column(Boolean, default=True, comment="是否激活")
    is_deprecated = Column(Boolean, default=False, comment="是否已弃用")

    # 统计信息
    download_count = Column(Integer, default=0, comment="下载次数")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deprecated_at = Column(DateTime(timezone=True), comment="弃用时间")

    # 用户关联
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    package = relationship("PackageModel", back_populates="package_versions")
    creator = relationship("User")

    # 索引
    __table_args__ = (
        Index("idx_package_version", "package_id", "version"),
        Index("idx_version_created_at", "created_at"),
        {"comment": "包版本表"},
    )


# ======================== 文件模型 ========================


class PackageFileModel(Base):
    """包文件模型"""

    __tablename__ = "package_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )
    version_id = Column(
        UUID(as_uuid=True), ForeignKey("package_versions.id"), index=True
    )

    # 文件信息
    filename = Column(String(500), nullable=False, comment="文件名")
    file_path = Column(String(1000), nullable=False, comment="文件路径")
    relative_path = Column(String(1000), comment="相对路径")

    # 文件属性
    file_size = Column(Integer, nullable=False, comment="文件大小")
    mime_type = Column(String(100), comment="MIME类型")
    encoding = Column(String(50), comment="文件编码")

    # 校验信息
    checksum = Column(String(128), nullable=False, comment="文件校验和")
    checksum_type = Column(String(20), default="sha256", comment="校验和类型")

    # 文件类型
    file_category = Column(
        String(50), comment="文件分类"
    )  # source, config, doc, test, asset
    is_executable = Column(Boolean, default=False, comment="是否可执行")
    is_binary = Column(Boolean, default=False, comment="是否二进制文件")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    modified_at = Column(DateTime(timezone=True), comment="文件修改时间")

    # 关系定义
    package = relationship("PackageModel", back_populates="package_files")
    version = relationship("PackageVersionModel")

    # 索引
    __table_args__ = (
        Index("idx_package_file_path", "package_id", "file_path"),
        Index("idx_file_checksum", "checksum"),
        {"comment": "包文件表"},
    )


# ======================== 构建任务模型 ========================


class BuildTaskModel(Base):
    """构建任务模型"""

    __tablename__ = "build_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )

    # 构建信息
    version = Column(String(50), nullable=False, comment="构建版本")
    target_formats = Column(ARRAY(String), default=[], comment="目标格式")

    # 状态信息
    status = Column(
        Enum(BuildStatus),
        default=BuildStatus.PENDING,
        nullable=False,
        index=True,
        comment="构建状态",
    )
    progress = Column(Float, default=0.0, comment="构建进度")

    # 构建配置
    build_args = Column(JSON, default={}, comment="构建参数")
    environment_vars = Column(JSON, default={}, comment="环境变量")

    # 任务选项
    priority = Column(Integer, default=5, comment="任务优先级")
    force_rebuild = Column(Boolean, default=False, comment="是否强制重建")
    skip_tests = Column(Boolean, default=False, comment="是否跳过测试")

    # 执行信息
    worker_id = Column(String(100), comment="执行工作节点")
    celery_task_id = Column(String(100), index=True, comment="Celery任务ID")

    # 结果信息
    logs = Column(JSON, default=[], comment="构建日志")
    artifacts = Column(JSON, default=[], comment="构建产物")
    error_message = Column(Text, comment="错误信息")

    # 时间信息
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True), comment="开始时间")
    finished_at = Column(DateTime(timezone=True), comment="完成时间")
    duration_seconds = Column(Float, comment="执行时长（秒）")

    # 用户关联
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    package = relationship("PackageModel", back_populates="build_tasks")
    creator = relationship("User")

    # 索引
    __table_args__ = (
        Index("idx_build_status_created", "status", "created_at"),
        Index("idx_build_celery_task", "celery_task_id"),
        {"comment": "构建任务表"},
    )


# ======================== 测试结果模型 ========================


class TestResultModel(Base):
    """测试结果模型"""

    __tablename__ = "test_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )
    build_task_id = Column(UUID(as_uuid=True), ForeignKey("build_tasks.id"), index=True)

    # 测试信息
    version = Column(String(50), nullable=False, comment="测试版本")
    test_type = Column(Enum(TestType), nullable=False, comment="测试类型")
    test_suite = Column(String(200), comment="测试套件")

    # 测试结果
    status = Column(
        String(20), nullable=False, comment="测试状态"
    )  # passed, failed, error, skipped
    passed = Column(Integer, default=0, comment="通过数量")
    failed = Column(Integer, default=0, comment="失败数量")
    skipped = Column(Integer, default=0, comment="跳过数量")
    errors = Column(Integer, default=0, comment="错误数量")

    # 覆盖率信息
    coverage = Column(Float, comment="代码覆盖率")
    line_coverage = Column(Float, comment="行覆盖率")
    branch_coverage = Column(Float, comment="分支覆盖率")
    function_coverage = Column(Float, comment="函数覆盖率")

    # 执行信息
    duration_seconds = Column(Float, comment="执行时长（秒）")
    test_environment = Column(String(100), comment="测试环境")

    # 详细信息
    logs = Column(JSON, default=[], comment="测试日志")
    reports = Column(JSON, default=[], comment="测试报告")
    error_message = Column(Text, comment="错误信息")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # 用户关联
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    package = relationship("PackageModel", back_populates="test_results")
    build_task = relationship("BuildTaskModel")
    creator = relationship("User")

    # 索引
    __table_args__ = (
        Index("idx_test_package_type", "package_id", "test_type"),
        Index("idx_test_status_created", "status", "created_at"),
        {"comment": "测试结果表"},
    )


# ======================== 发布结果模型 ========================


class PublishResultModel(Base):
    """发布结果模型"""

    __tablename__ = "publish_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )
    build_task_id = Column(UUID(as_uuid=True), ForeignKey("build_tasks.id"), index=True)

    # 发布信息
    version = Column(String(50), nullable=False, comment="发布版本")
    channels = Column(ARRAY(String), default=[], comment="发布渠道")

    # 发布状态
    status = Column(
        String(20), nullable=False, comment="发布状态"
    )  # success, failed, partial

    # 发布结果
    download_urls = Column(JSON, default={}, comment="下载链接")
    registry_urls = Column(JSON, default={}, comment="注册表链接")

    # 发布配置
    release_notes = Column(Text, comment="发布说明")
    is_prerelease = Column(Boolean, default=False, comment="是否预发布")
    auto_sign = Column(Boolean, default=True, comment="是否自动签名")

    # 执行信息
    published_at = Column(DateTime(timezone=True), comment="发布时间")
    error_message = Column(Text, comment="错误信息")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # 用户关联
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    package = relationship("PackageModel", back_populates="publish_results")
    build_task = relationship("BuildTaskModel")
    creator = relationship("User")

    # 索引
    __table_args__ = (
        Index("idx_publish_package_version", "package_id", "version"),
        Index("idx_publish_status_created", "status", "created_at"),
        {"comment": "发布结果表"},
    )


# ======================== 签名模型 ========================


class PackageSignatureModel(Base):
    """包签名模型"""

    __tablename__ = "package_signatures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )
    version_id = Column(
        UUID(as_uuid=True), ForeignKey("package_versions.id"), index=True
    )

    # 签名信息
    signature_type = Column(
        String(50), nullable=False, comment="签名类型"
    )  # gpg, x509, ed25519
    signature_data = Column(Text, nullable=False, comment="签名数据")
    public_key = Column(Text, comment="公钥")

    # 签名者信息
    signer_name = Column(String(200), comment="签名者姓名")
    signer_email = Column(String(200), comment="签名者邮箱")
    signer_key_id = Column(String(100), comment="签名者密钥ID")

    # 验证信息
    is_verified = Column(Boolean, default=False, comment="是否已验证")
    verified_at = Column(DateTime(timezone=True), comment="验证时间")
    verification_result = Column(JSON, comment="验证结果")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), comment="过期时间")

    # 用户关联
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # 关系定义
    package = relationship("PackageModel", back_populates="signatures")
    version = relationship("PackageVersionModel")
    creator = relationship("User")

    # 索引
    __table_args__ = (
        Index("idx_signature_package_version", "package_id", "version_id"),
        Index("idx_signature_type_verified", "signature_type", "is_verified"),
        {"comment": "包签名表"},
    )


# ======================== 依赖关系模型 ========================


class PackageDependencyModel(Base):
    """包依赖关系模型"""

    __tablename__ = "package_dependencies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )

    # 依赖信息
    dependency_name = Column(String(200), nullable=False, comment="依赖包名")
    dependency_version = Column(String(100), comment="依赖版本")
    version_constraint = Column(String(200), comment="版本约束")

    # 依赖类型
    dependency_type = Column(
        String(50), default="runtime", comment="依赖类型"
    )  # runtime, dev, build, test
    is_optional = Column(Boolean, default=False, comment="是否可选依赖")

    # 解析信息
    resolved_version = Column(String(100), comment="解析后版本")
    resolved_at = Column(DateTime(timezone=True), comment="解析时间")

    # 时间戳
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系定义
    package = relationship("PackageModel")

    # 索引
    __table_args__ = (
        Index("idx_dependency_package_name", "package_id", "dependency_name"),
        Index("idx_dependency_type", "dependency_type"),
        {"comment": "包依赖关系表"},
    )


# ======================== 下载统计模型 ========================


class PackageDownloadModel(Base):
    """包下载统计模型"""

    __tablename__ = "package_downloads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(
        UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True
    )
    version_id = Column(
        UUID(as_uuid=True), ForeignKey("package_versions.id"), index=True
    )

    # 下载信息
    download_date = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    download_count = Column(Integer, default=1, comment="下载次数")

    # 客户端信息
    user_agent = Column(String(500), comment="用户代理")
    ip_address = Column(String(45), comment="IP地址")
    country = Column(String(10), comment="国家代码")

    # 下载渠道
    download_source = Column(String(100), comment="下载来源")
    referrer = Column(String(500), comment="引用页面")

    # 关系定义
    package = relationship("PackageModel")
    version = relationship("PackageVersionModel")

    # 索引
    __table_args__ = (
        Index("idx_download_package_date", "package_id", "download_date"),
        Index("idx_download_date_count", "download_date", "download_count"),
        {"comment": "包下载统计表"},
    )


# 导出所有模型
__all__ = [
    "PackageModel",
    "PackageVersionModel",
    "PackageFileModel",
    "BuildTaskModel",
    "TestResultModel",
    "PublishResultModel",
    "PackageSignatureModel",
    "PackageDependencyModel",
    "PackageDownloadModel",
]

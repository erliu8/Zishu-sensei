#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
打包服务 - Zishu-sensei
提供完整的适配器打包、分发、版本管理的业务逻辑
包含包创建、更新、构建、测试、签名、发布等核心功能
"""

import os
import shutil
import zipfile
import tarfile
import hashlib
import json
import asyncio
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from pydantic import ValidationError

# 项目内部导入
from ..models.packaging import (
    PackageModel,
    BuildTaskModel,
    TestResultModel,
    PublishResultModel,
)
from ..schemas.packaging import (
    PackageCreateRequest,
    PackageUpdateRequest,
    PackageDetailResponse,
    PackageListItem,
    BuildRequest,
    BuildTaskResponse,
    TestRequest,
    TestResultResponse,
    PublishRequest,
    PublishResultResponse,
    SignRequest,
    PackageStatus,
    BuildStatus,
    PackageType,
    VersionInfo,
    FileInfo,
    DependencyInfo,
    SignatureInfo,
    PaginatedResponse,
    SearchFilters,
    PackageStatistics,
)
from ..core.database import get_db_session
from ..core.config import settings
from ..core.security import get_current_user
from ..core.logging import get_logger
from ..utils.file_utils import (
    calculate_file_hash,
    validate_file_type,
    compress_directory,
)
from ..utils.version_utils import parse_version, compare_versions, bump_version
from .build_service import BuildService
from .storage_service import StorageService
from .notification_service import NotificationService

logger = get_logger(__name__)


@dataclass
class PackageConfig:
    """包配置类"""

    max_package_size: int = 500 * 1024 * 1024  # 500MB
    max_file_count: int = 10000
    allowed_formats: Set[str] = None
    build_timeout: int = 3600  # 1小时
    test_timeout: int = 1800  # 30分钟

    def __post_init__(self):
        if self.allowed_formats is None:
            self.allowed_formats = {
                ".py",
                ".js",
                ".ts",
                ".json",
                ".yaml",
                ".yml",
                ".md",
                ".txt",
                ".cfg",
                ".ini",
            }


class PackagingService:
    """打包服务类"""

    def __init__(self):
        self.config = PackageConfig()
        self.build_service = BuildService()
        self.storage_service = StorageService()
        self.notification_service = NotificationService()

        # 创建必要的目录
        self.packages_dir = Path(settings.PACKAGES_DIR)
        self.builds_dir = Path(settings.BUILDS_DIR)
        self.cache_dir = Path(settings.CACHE_DIR)

        for directory in [self.packages_dir, self.builds_dir, self.cache_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    # ======================== 包管理 ========================

    async def create_package(
        self, request: PackageCreateRequest, user_id: str, db: AsyncSession
    ) -> PackageDetailResponse:
        """创建新包"""
        try:
            logger.info(f"用户 {user_id} 创建包: {request.metadata.name}")

            # 验证包名唯一性
            await self._validate_package_name_unique(request.metadata.name, db)

            # 验证源码路径
            source_path = Path(request.source_path)
            if not source_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="源码路径不存在"
                )

            # 验证包大小和文件数量
            await self._validate_package_constraints(source_path)

            # 创建包记录
            package = PackageModel(
                name=request.metadata.name,
                display_name=request.metadata.display_name,
                description=request.metadata.description,
                version=str(request.metadata.version),
                package_type=request.metadata.package_type,
                author=request.metadata.author,
                maintainer=request.metadata.maintainer,
                license=request.metadata.license,
                homepage=str(request.metadata.homepage)
                if request.metadata.homepage
                else None,
                repository=str(request.metadata.repository)
                if request.metadata.repository
                else None,
                documentation=str(request.metadata.documentation)
                if request.metadata.documentation
                else None,
                keywords=list(request.metadata.keywords),
                categories=list(request.metadata.categories),
                tags=list(request.metadata.tags),
                status=PackageStatus.DRAFT,
                source_path=str(source_path),
                build_config=request.build_config.dict(),
                test_config=request.test_config.dict() if request.test_config else None,
                dependencies=[dep.dict() for dep in request.dependencies],
                include_patterns=request.include_patterns,
                exclude_patterns=request.exclude_patterns,
                created_by=user_id,
                updated_by=user_id,
            )

            db.add(package)
            await db.commit()
            await db.refresh(package)

            # 如果启用自动构建，启动构建任务
            if request.auto_build:
                await self._trigger_auto_build(package.id, user_id, db)

            logger.info(f"包 {package.name} 创建成功，ID: {package.id}")
            return await self._package_to_detail_response(package)

        except ValidationError as e:
            logger.error(f"包创建验证失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"数据验证失败: {e}"
            )
        except Exception as e:
            logger.error(f"包创建失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="包创建失败"
            )

    async def update_package(
        self,
        package_id: str,
        request: PackageUpdateRequest,
        user_id: str,
        db: AsyncSession,
    ) -> PackageDetailResponse:
        """更新包信息"""
        try:
            # 获取包记录
            package = await self._get_package_by_id(package_id, db)

            # 权限检查
            await self._check_package_permission(package, user_id)

            # 更新字段
            update_data = {}
            if request.metadata:
                # 如果更新了包名，检查唯一性
                if request.metadata.name != package.name:
                    await self._validate_package_name_unique(
                        request.metadata.name, db, exclude_id=package_id
                    )

                update_data.update(
                    {
                        "name": request.metadata.name,
                        "display_name": request.metadata.display_name,
                        "description": request.metadata.description,
                        "version": str(request.metadata.version),
                        "package_type": request.metadata.package_type,
                        "author": request.metadata.author,
                        "maintainer": request.metadata.maintainer,
                        "license": request.metadata.license,
                        "homepage": str(request.metadata.homepage)
                        if request.metadata.homepage
                        else None,
                        "repository": str(request.metadata.repository)
                        if request.metadata.repository
                        else None,
                        "documentation": str(request.metadata.documentation)
                        if request.metadata.documentation
                        else None,
                        "keywords": list(request.metadata.keywords),
                        "categories": list(request.metadata.categories),
                        "tags": list(request.metadata.tags),
                    }
                )

            if request.build_config:
                update_data["build_config"] = request.build_config.dict()

            if request.test_config:
                update_data["test_config"] = request.test_config.dict()

            if request.dependencies is not None:
                update_data["dependencies"] = [
                    dep.dict() for dep in request.dependencies
                ]

            if request.include_patterns is not None:
                update_data["include_patterns"] = request.include_patterns

            if request.exclude_patterns is not None:
                update_data["exclude_patterns"] = request.exclude_patterns

            if request.status:
                update_data["status"] = request.status

            # 更新时间戳
            update_data["updated_at"] = datetime.now()
            update_data["updated_by"] = user_id

            # 执行更新
            await db.execute(
                update(PackageModel)
                .where(PackageModel.id == package_id)
                .values(**update_data)
            )
            await db.commit()

            # 重新获取更新后的包
            updated_package = await self._get_package_by_id(package_id, db)

            logger.info(f"包 {package.name} 更新成功")
            return await self._package_to_detail_response(updated_package)

        except Exception as e:
            logger.error(f"包更新失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="包更新失败"
            )

    async def get_package_detail(
        self, package_id: str, user_id: Optional[str], db: AsyncSession
    ) -> PackageDetailResponse:
        """获取包详情"""
        package = await self._get_package_by_id(package_id, db)

        # 检查访问权限（私有包需要权限）
        if package.status == PackageStatus.DRAFT and package.created_by != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此包")

        return await self._package_to_detail_response(package)

    async def list_packages(
        self,
        filters: SearchFilters,
        page: int = 1,
        size: int = 20,
        user_id: Optional[str] = None,
        db: AsyncSession = None,
    ) -> PaginatedResponse:
        """获取包列表"""
        try:
            # 构建查询条件
            conditions = []

            # 基础过滤：只显示已发布的包（除非是包的创建者）
            if user_id:
                conditions.append(
                    or_(
                        PackageModel.status.in_(
                            [PackageStatus.PUBLISHED, PackageStatus.DEPRECATED]
                        ),
                        PackageModel.created_by == user_id,
                    )
                )
            else:
                conditions.append(
                    PackageModel.status.in_(
                        [PackageStatus.PUBLISHED, PackageStatus.DEPRECATED]
                    )
                )

            # 应用过滤器
            if filters.package_types:
                conditions.append(PackageModel.package_type.in_(filters.package_types))

            if filters.statuses:
                conditions.append(PackageModel.status.in_(filters.statuses))

            if filters.authors:
                conditions.append(PackageModel.author.in_(filters.authors))

            if filters.tags:
                for tag in filters.tags:
                    conditions.append(PackageModel.tags.contains([tag]))

            if filters.categories:
                for category in filters.categories:
                    conditions.append(PackageModel.categories.contains([category]))

            if filters.date_from:
                conditions.append(PackageModel.created_at >= filters.date_from)

            if filters.date_to:
                conditions.append(PackageModel.created_at <= filters.date_to)

            if filters.min_downloads:
                conditions.append(PackageModel.download_count >= filters.min_downloads)

            if filters.verified_only:
                conditions.append(PackageModel.is_verified == True)

            # 执行查询
            query = select(PackageModel).where(and_(*conditions))

            # 计算总数
            count_query = select(func.count(PackageModel.id)).where(and_(*conditions))
            total_result = await db.execute(count_query)
            total = total_result.scalar()

            # 分页查询
            offset = (page - 1) * size
            query = (
                query.offset(offset)
                .limit(size)
                .order_by(PackageModel.updated_at.desc())
            )

            result = await db.execute(query)
            packages = result.scalars().all()

            # 转换为响应格式
            items = [await self._package_to_list_item(pkg) for pkg in packages]

            return PaginatedResponse(
                items=items,
                total=total,
                page=page,
                size=size,
                has_next=offset + size < total,
                has_prev=page > 1,
                total_pages=(total + size - 1) // size,
            )

        except Exception as e:
            logger.error(f"获取包列表失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取包列表失败"
            )

    async def delete_package(
        self, package_id: str, user_id: str, db: AsyncSession, force: bool = False
    ) -> bool:
        """删除包"""
        try:
            package = await self._get_package_by_id(package_id, db)

            # 权限检查
            await self._check_package_permission(package, user_id)

            # 检查是否可以删除
            if not force and package.status == PackageStatus.PUBLISHED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="已发布的包不能删除，请先设置为已弃用状态",
                )

            # 软删除：更新状态为已删除
            await db.execute(
                update(PackageModel)
                .where(PackageModel.id == package_id)
                .values(
                    status=PackageStatus.DELETED,
                    updated_at=datetime.now(),
                    updated_by=user_id,
                )
            )

            # 删除相关文件
            await self._cleanup_package_files(package)

            await db.commit()

            logger.info(f"包 {package.name} 删除成功")
            return True

        except Exception as e:
            logger.error(f"包删除失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="包删除失败"
            )

    # ======================== 构建管理 ========================

    async def build_package(
        self, request: BuildRequest, user_id: str, db: AsyncSession
    ) -> BuildTaskResponse:
        """构建包"""
        try:
            package = await self._get_package_by_id(request.package_id, db)

            # 权限检查
            await self._check_package_permission(package, user_id)

            # 创建构建任务
            build_task = BuildTaskModel(
                package_id=request.package_id,
                version=request.version or package.version,
                target_formats=request.target_formats,
                status=BuildStatus.PENDING,
                build_args=request.build_args,
                priority=request.priority,
                force_rebuild=request.force_rebuild,
                skip_tests=request.skip_tests,
                created_by=user_id,
            )

            db.add(build_task)
            await db.commit()
            await db.refresh(build_task)

            # 异步启动构建任务
            asyncio.create_task(self._execute_build_task(build_task.id, db))

            logger.info(f"构建任务 {build_task.id} 创建成功")
            return await self._build_task_to_response(build_task)

        except Exception as e:
            logger.error(f"构建任务创建失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="构建任务创建失败"
            )

    async def get_build_status(
        self, build_id: str, user_id: str, db: AsyncSession
    ) -> BuildTaskResponse:
        """获取构建状态"""
        try:
            query = select(BuildTaskModel).where(BuildTaskModel.id == build_id)
            result = await db.execute(query)
            build_task = result.scalar_one_or_none()

            if not build_task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="构建任务不存在"
                )

            # 权限检查
            if build_task.created_by != user_id:
                package = await self._get_package_by_id(build_task.package_id, db)
                await self._check_package_permission(package, user_id)

            return await self._build_task_to_response(build_task)

        except Exception as e:
            logger.error(f"获取构建状态失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取构建状态失败"
            )

    # ======================== 测试管理 ========================

    async def test_package(
        self, request: TestRequest, user_id: str, db: AsyncSession
    ) -> TestResultResponse:
        """测试包"""
        try:
            package = await self._get_package_by_id(request.package_id, db)

            # 权限检查
            await self._check_package_permission(package, user_id)

            # 执行测试
            test_result = await self.build_service.run_tests(
                package=package,
                test_types=request.test_types,
                test_environments=request.test_environments,
                parallel=request.parallel,
                coverage_required=request.coverage_required,
            )

            # 保存测试结果
            test_record = TestResultModel(
                package_id=request.package_id,
                version=package.version,
                test_type=test_result["test_type"],
                status=test_result["status"],
                passed=test_result["passed"],
                failed=test_result["failed"],
                skipped=test_result["skipped"],
                coverage=test_result.get("coverage"),
                duration_seconds=test_result["duration_seconds"],
                logs=test_result["logs"],
                reports=[
                    FileInfo(**report).dict()
                    for report in test_result.get("reports", [])
                ],
                created_by=user_id,
            )

            db.add(test_record)
            await db.commit()
            await db.refresh(test_record)

            logger.info(f"包 {package.name} 测试完成")
            return await self._test_result_to_response(test_record)

        except Exception as e:
            logger.error(f"包测试失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="包测试失败"
            )

    # ======================== 发布管理 ========================

    async def publish_package(
        self, request: PublishRequest, user_id: str, db: AsyncSession
    ) -> PublishResultResponse:
        """发布包"""
        try:
            package = await self._get_package_by_id(request.package_id, db)

            # 权限检查
            await self._check_package_permission(package, user_id)

            # 验证发布条件
            await self._validate_publish_conditions(package, request.version)

            # 执行发布
            publish_result = await self._execute_publish(
                package=package,
                version=request.version,
                channels=request.channels,
                release_notes=request.release_notes,
                is_prerelease=request.is_prerelease,
                auto_sign=request.auto_sign,
                user_id=user_id,
            )

            # 保存发布结果
            publish_record = PublishResultModel(
                package_id=request.package_id,
                version=request.version,
                channels=request.channels,
                status=publish_result["status"],
                download_urls=publish_result.get("download_urls", {}),
                published_at=publish_result.get("published_at"),
                error_message=publish_result.get("error_message"),
                created_by=user_id,
            )

            db.add(publish_record)

            # 更新包状态
            if publish_result["status"] == "success":
                await db.execute(
                    update(PackageModel)
                    .where(PackageModel.id == request.package_id)
                    .values(
                        status=PackageStatus.PUBLISHED,
                        updated_at=datetime.now(),
                        updated_by=user_id,
                    )
                )

            await db.commit()
            await db.refresh(publish_record)

            logger.info(f"包 {package.name} 发布完成")
            return await self._publish_result_to_response(publish_record)

        except Exception as e:
            logger.error(f"包发布失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="包发布失败"
            )

    # ======================== 统计分析 ========================

    async def get_package_statistics(
        self, user_id: Optional[str], db: AsyncSession
    ) -> PackageStatistics:
        """获取包统计信息"""
        try:
            # 构建查询条件
            conditions = []
            if user_id:
                conditions.append(PackageModel.created_by == user_id)

            # 获取包统计
            if conditions:
                base_query = select(PackageModel).where(and_(*conditions))
            else:
                base_query = select(PackageModel)

            # 总包数
            total_packages_result = await db.execute(
                select(func.count(PackageModel.id)).select_from(base_query.subquery())
            )
            total_packages = total_packages_result.scalar()

            # 活跃包数（已发布状态）
            active_packages_result = await db.execute(
                select(func.count(PackageModel.id))
                .select_from(base_query.subquery())
                .where(PackageModel.status == PackageStatus.PUBLISHED)
            )
            active_packages = active_packages_result.scalar()

            # 总下载量
            total_downloads_result = await db.execute(
                select(func.sum(PackageModel.download_count)).select_from(
                    base_query.subquery()
                )
            )
            total_downloads = total_downloads_result.scalar() or 0

            # 构建统计
            build_stats_query = select(
                func.count(BuildTaskModel.id).label("total_builds"),
                func.sum(
                    case((BuildTaskModel.status == BuildStatus.SUCCESS, 1), else_=0)
                ).label("successful_builds"),
                func.sum(
                    case((BuildTaskModel.status == BuildStatus.FAILED, 1), else_=0)
                ).label("failed_builds"),
                func.avg(BuildTaskModel.duration_seconds).label("avg_build_time"),
            )

            if conditions:
                # 关联包表进行过滤
                build_stats_query = build_stats_query.select_from(
                    BuildTaskModel.__table__.join(
                        PackageModel.__table__,
                        BuildTaskModel.package_id == PackageModel.id,
                    )
                ).where(and_(*conditions))

            build_stats_result = await db.execute(build_stats_query)
            build_stats = build_stats_result.first()

            # 测试统计
            test_stats_query = select(
                func.count(TestResultModel.id).label("total_tests"),
                func.avg(
                    case(
                        (
                            (
                                TestResultModel.passed
                                + TestResultModel.failed
                                + TestResultModel.skipped
                            )
                            > 0,
                            TestResultModel.passed
                            * 100.0
                            / (
                                TestResultModel.passed
                                + TestResultModel.failed
                                + TestResultModel.skipped
                            ),
                        ),
                        else_=0,
                    )
                ).label("test_pass_rate"),
            )

            if conditions:
                test_stats_query = test_stats_query.select_from(
                    TestResultModel.__table__.join(
                        PackageModel.__table__,
                        TestResultModel.package_id == PackageModel.id,
                    )
                ).where(and_(*conditions))

            test_stats_result = await db.execute(test_stats_query)
            test_stats = test_stats_result.first()

            return PackageStatistics(
                total_packages=total_packages,
                active_packages=active_packages,
                total_downloads=total_downloads,
                total_builds=build_stats.total_builds or 0,
                successful_builds=build_stats.successful_builds or 0,
                failed_builds=build_stats.failed_builds or 0,
                average_build_time=build_stats.avg_build_time or 0.0,
                total_tests=test_stats.total_tests or 0,
                test_pass_rate=test_stats.test_pass_rate or 0.0,
                storage_used_bytes=await self._calculate_storage_usage(conditions, db),
            )

        except Exception as e:
            logger.error(f"获取包统计失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取包统计失败"
            )

    # ======================== 私有辅助方法 ========================

    async def _get_package_by_id(
        self, package_id: str, db: AsyncSession
    ) -> PackageModel:
        """根据ID获取包"""
        query = select(PackageModel).where(PackageModel.id == package_id)
        result = await db.execute(query)
        package = result.scalar_one_or_none()

        if not package:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="包不存在")

        return package

    async def _validate_package_name_unique(
        self, name: str, db: AsyncSession, exclude_id: Optional[str] = None
    ) -> None:
        """验证包名唯一性"""
        conditions = [PackageModel.name == name]
        if exclude_id:
            conditions.append(PackageModel.id != exclude_id)

        query = select(PackageModel).where(and_(*conditions))
        result = await db.execute(query)
        existing_package = result.scalar_one_or_none()

        if existing_package:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="包名已存在")

    async def _validate_package_constraints(self, source_path: Path) -> None:
        """验证包约束条件"""
        # 计算包大小和文件数量
        total_size = 0
        file_count = 0

        for file_path in source_path.rglob("*"):
            if file_path.is_file():
                file_count += 1
                total_size += file_path.stat().st_size

                # 检查文件类型
                if file_path.suffix.lower() not in self.config.allowed_formats:
                    logger.warning(f"不支持的文件类型: {file_path}")

        # 检查约束
        if total_size > self.config.max_package_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"包大小超过限制 ({total_size} > {self.config.max_package_size})",
            )

        if file_count > self.config.max_file_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件数量超过限制 ({file_count} > {self.config.max_file_count})",
            )

    async def _check_package_permission(
        self, package: PackageModel, user_id: str
    ) -> None:
        """检查包权限"""
        if package.created_by != user_id:
            # TODO: 添加更细粒度的权限检查
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此包")

    async def _package_to_detail_response(
        self, package: PackageModel
    ) -> PackageDetailResponse:
        """包模型转详情响应"""
        # 获取版本列表
        versions = await self._get_package_versions(package.id)

        # 获取文件列表
        files = await self._get_package_files(package.id)

        # 获取签名信息
        signatures = await self._get_package_signatures(package.id)

        # 获取统计信息
        statistics = await self._get_package_statistics_detail(package.id)

        return PackageDetailResponse(
            id=package.id,
            metadata=PackageMetadata(
                name=package.name,
                display_name=package.display_name,
                description=package.description,
                version=VersionInfo.from_string(package.version),
                package_type=package.package_type,
                author=package.author,
                maintainer=package.maintainer,
                license=package.license,
                homepage=package.homepage,
                repository=package.repository,
                documentation=package.documentation,
                keywords=set(package.keywords or []),
                categories=set(package.categories or []),
                tags=set(package.tags or []),
            ),
            status=package.status,
            build_config=BuildConfiguration(**package.build_config),
            test_config=TestConfiguration(**package.test_config)
            if package.test_config
            else None,
            dependencies=[DependencyInfo(**dep) for dep in package.dependencies or []],
            versions=versions,
            files=files,
            signatures=signatures,
            statistics=statistics,
            created_at=package.created_at,
            updated_at=package.updated_at,
            created_by=package.created_by,
        )

    async def _package_to_list_item(self, package: PackageModel) -> PackageListItem:
        """包模型转列表项"""
        return PackageListItem(
            id=package.id,
            name=package.name,
            display_name=package.display_name,
            description=package.description,
            version=package.version,
            package_type=package.package_type,
            status=package.status,
            author=package.author,
            download_count=package.download_count,
            star_count=package.star_count,
            created_at=package.created_at,
            updated_at=package.updated_at,
            tags=package.tags or [],
            is_featured=package.is_featured,
            is_verified=package.is_verified,
        )

    async def _trigger_auto_build(
        self, package_id: str, user_id: str, db: AsyncSession
    ) -> None:
        """触发自动构建"""
        try:
            build_request = BuildRequest(
                package_id=package_id,
                target_formats=[],  # 使用默认格式
                force_rebuild=False,
                skip_tests=False,
                priority=5,
            )

            await self.build_package(build_request, user_id, db)

        except Exception as e:
            logger.error(f"自动构建触发失败: {e}")

    async def _execute_build_task(self, build_id: str, db: AsyncSession) -> None:
        """执行构建任务"""
        try:
            # 获取构建任务
            query = select(BuildTaskModel).where(BuildTaskModel.id == build_id)
            result = await db.execute(query)
            build_task = result.scalar_one_or_none()

            if not build_task:
                return

            # 更新状态为运行中
            await db.execute(
                update(BuildTaskModel)
                .where(BuildTaskModel.id == build_id)
                .values(status=BuildStatus.RUNNING, started_at=datetime.now())
            )
            await db.commit()

            # 执行构建
            build_result = await self.build_service.build_package(
                build_task=build_task, timeout=self.config.build_timeout
            )

            # 更新构建结果
            await db.execute(
                update(BuildTaskModel)
                .where(BuildTaskModel.id == build_id)
                .values(
                    status=build_result["status"],
                    progress=100.0
                    if build_result["status"] == BuildStatus.SUCCESS
                    else build_result.get("progress", 0.0),
                    logs=build_result.get("logs", []),
                    artifacts=[
                        FileInfo(**artifact).dict()
                        for artifact in build_result.get("artifacts", [])
                    ],
                    error_message=build_result.get("error_message"),
                    finished_at=datetime.now(),
                    duration_seconds=build_result.get("duration_seconds", 0),
                )
            )
            await db.commit()

            # 发送通知
            await self.notification_service.send_build_notification(
                user_id=build_task.created_by,
                build_task=build_task,
                result=build_result,
            )

        except Exception as e:
            logger.error(f"构建任务执行失败: {e}")

            # 更新失败状态
            await db.execute(
                update(BuildTaskModel)
                .where(BuildTaskModel.id == build_id)
                .values(
                    status=BuildStatus.FAILED,
                    error_message=str(e),
                    finished_at=datetime.now(),
                )
            )
            await db.commit()

    # 其他辅助方法的实现...
    async def _get_package_versions(self, package_id: str) -> List[str]:
        """获取包版本列表"""
        # TODO: 实现版本历史查询
        return []

    async def _get_package_files(self, package_id: str) -> List[FileInfo]:
        """获取包文件列表"""
        # TODO: 实现文件列表查询
        return []

    async def _get_package_signatures(self, package_id: str) -> List[SignatureInfo]:
        """获取包签名信息"""
        # TODO: 实现签名信息查询
        return []

    async def _get_package_statistics_detail(self, package_id: str) -> Dict[str, Any]:
        """获取包详细统计"""
        # TODO: 实现详细统计查询
        return {}

    async def _cleanup_package_files(self, package: PackageModel) -> None:
        """清理包文件"""
        # TODO: 实现文件清理逻辑
        pass

    async def _validate_publish_conditions(
        self, package: PackageModel, version: str
    ) -> None:
        """验证发布条件"""
        # TODO: 实现发布条件验证
        pass

    async def _execute_publish(self, **kwargs) -> Dict[str, Any]:
        """执行发布"""
        # TODO: 实现发布逻辑
        return {"status": "success"}

    async def _build_task_to_response(
        self, build_task: BuildTaskModel
    ) -> BuildTaskResponse:
        """构建任务转响应"""
        # TODO: 实现转换逻辑
        pass

    async def _test_result_to_response(
        self, test_result: TestResultModel
    ) -> TestResultResponse:
        """测试结果转响应"""
        # TODO: 实现转换逻辑
        pass

    async def _publish_result_to_response(
        self, publish_result: PublishResultModel
    ) -> PublishResultResponse:
        """发布结果转响应"""
        # TODO: 实现转换逻辑
        pass

    async def _calculate_storage_usage(self, conditions: List, db: AsyncSession) -> int:
        """计算存储使用量"""
        # TODO: 实现存储计算逻辑
        return 0


# 创建全局服务实例
packaging_service = PackagingService()

# 导出
__all__ = ["PackagingService", "packaging_service"]

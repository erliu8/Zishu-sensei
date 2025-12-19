"""
技能包安装记录数据访问层

提供技能包安装记录相关的数据库操作
"""

from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.skill_installation import SkillInstallation
from ..base import BaseRepository

# 安装状态常量（避免与模型中可能的 Enum 同名冲突）
class SkillInstallationStatus:
    INSTALLING = "installing"
    INSTALLED = "installed"
    UNINSTALLED = "uninstalled"
    FAILED = "failed"
    PENDING_APPROVAL = "pending_approval"


class SkillInstallationRepository(BaseRepository):
    """技能包安装记录仓储类"""

    def __init__(self):
        super().__init__(SkillInstallation)

    async def get_by_user_and_package(
        self, session: AsyncSession, user_id: str, package_id: str
    ) -> Optional[SkillInstallation]:
        """根据用户ID和技能包ID获取安装记录"""
        try:
            query = (
                self.query()
                .where(
                    SkillInstallation.user_id == user_id,
                    SkillInstallation.package_id == package_id,
                )
                .filter_not_deleted()
            )
            result = await session.execute(query.build())
            return result.scalar_one_or_none()
        except Exception as e:
            self.logger.error(
                f"Failed to get skill installation by user_id={user_id}, package_id={package_id}: {e}"
            )
            raise

    async def create(
        self, session: AsyncSession, installation: SkillInstallation
    ) -> SkillInstallation:
        """创建技能包安装记录"""
        try:
            session.add(installation)
            await session.flush()
            await session.refresh(installation)

            self.logger.info(
                f"Created skill installation with id: {installation.id}, user_id: {installation.user_id}, package_id: {installation.package_id}"
            )
            return installation
        except Exception as e:
            self.logger.error(f"Failed to create skill installation: {e}")
            raise

    async def list_installed(
        self,
        session: AsyncSession,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[SkillInstallation]:
        """获取用户已安装的技能包列表"""
        try:
            query = (
                self.query()
                .where(
                    SkillInstallation.user_id == user_id,
                    SkillInstallation.installation_status == SkillInstallationStatus.INSTALLED,
                )
                .filter_not_deleted()
                .order_by(SkillInstallation.installed_at.desc())
                .offset(skip)
                .limit(limit)
            )
            result = await session.execute(query.build())
            return list(result.scalars().all())
        except Exception as e:
            self.logger.error(f"Failed to list installed skills for user_id={user_id}: {e}")
            raise

    async def mark_uninstalled(
        self,
        session: AsyncSession,
        installation_id: str,
        user_id: str,
        reason: Optional[str] = None,
    ) -> Optional[SkillInstallation]:
        """标记技能包为已卸载"""
        try:
            # 先查询记录，确保用户权限
            query = (
                self.query()
                .where(
                    SkillInstallation.id == installation_id,
                    SkillInstallation.user_id == user_id,
                )
                .filter_not_deleted()
            )
            result = await session.execute(query.build())
            installation = result.scalar_one_or_none()

            if not installation:
                return None

            # 更新状态和时间
            installation.installation_status = SkillInstallationStatus.UNINSTALLED
            installation.uninstalled_at = datetime.now(timezone.utc)
            if reason:
                installation.error_message = reason

            await session.flush()
            await session.refresh(installation)

            self.logger.info(
                f"Marked skill installation {installation_id} as uninstalled for user {user_id}"
            )
            return installation
        except Exception as e:
            self.logger.error(
                f"Failed to mark installation {installation_id} as uninstalled for user {user_id}: {e}"
            )
            raise

    async def mark_failed(
        self,
        session: AsyncSession,
        installation_id: str,
        user_id: str,
        error_message: str,
    ) -> Optional[SkillInstallation]:
        """标记技能包安装失败"""
        try:
            # 先查询记录，确保用户权限
            query = (
                self.query()
                .where(
                    SkillInstallation.id == installation_id,
                    SkillInstallation.user_id == user_id,
                )
                .filter_not_deleted()
            )
            result = await session.execute(query.build())
            installation = result.scalar_one_or_none()

            if not installation:
                return None

            # 更新状态和错误信息
            installation.installation_status = SkillInstallationStatus.FAILED
            installation.error_message = error_message

            await session.flush()
            await session.refresh(installation)

            self.logger.info(
                f"Marked skill installation {installation_id} as failed for user {user_id}"
            )
            return installation
        except Exception as e:
            self.logger.error(
                f"Failed to mark installation {installation_id} as failed for user {user_id}: {e}"
            )
            raise
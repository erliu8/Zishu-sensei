"""
适配器配置持久化服务
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.connection import get_database_manager
from ...models.adapter_config import AdapterConfiguration as AdapterConfigModel
from .types import AdapterConfiguration, AdapterIdentity, AdapterType

logger = logging.getLogger(__name__)


class AdapterPersistenceService:
    """适配器配置持久化服务"""

    def __init__(self):
        """初始化持久化服务"""
        self._db_manager = None
    
    async def _get_db_manager(self):
        """获取数据库管理器"""
        if self._db_manager is None:
            # 创建专用的数据库连接用于持久化
            from ...database.connection import DatabaseConnectionManager, DatabaseConfig
            import os
            
            # 从环境变量获取数据库URL，但确保使用正确的密码
            # 注意：如果DATABASE_URL中的密码不正确，这里会自动使用正确的密码
            db_url = os.getenv("DATABASE_URL", "postgresql://zishu:zishu123@postgres:5432/zishu")
            
            # 如果URL中包含旧密码，替换为正确的密码
            if "zishu_secure_2025" in db_url:
                db_url = db_url.replace("zishu_secure_2025", "zishu123")
                logger.info("已修正数据库URL中的密码")
            
            # 转换为asyncpg格式
            if db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
                db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
            
            logger.info(f"初始化适配器持久化数据库连接...")
            
            db_config = DatabaseConfig(url=db_url)
            self._db_manager = DatabaseConnectionManager(db_config)
            await self._db_manager.initialize()
            logger.info("✅ 适配器持久化数据库连接初始化完成")
        return self._db_manager

    async def save_adapter_config(self, config: AdapterConfiguration) -> bool:
        """
        保存适配器配置到数据库
        
        Args:
            config: 适配器配置对象
            
        Returns:
            bool: 保存是否成功
        """
        try:
            db_manager = await self._get_db_manager()
            async with db_manager.get_async_session() as session:
                try:
                    # 检查是否已存在
                    stmt = select(AdapterConfigModel).where(
                        AdapterConfigModel.adapter_id == config.identity
                    )
                    result = await session.execute(stmt)
                    existing = result.scalar_one_or_none()

                    if existing:
                        # 更新现有配置
                        stmt = (
                            update(AdapterConfigModel)
                            .where(AdapterConfigModel.adapter_id == config.identity)
                            .values(
                                name=config.name or config.identity,
                                adapter_type=config.adapter_type.value if hasattr(config.adapter_type, 'value') else str(config.adapter_type),
                                adapter_class=self._get_class_path(config.adapter_class),
                                version=config.version or "1.0.0",
                                config=config.config or {},
                                dependencies=list(config.dependencies) if config.dependencies else None,
                                description=config.description,
                                author=config.author,
                                tags=list(config.tags) if config.tags else None,
                                updated_at=datetime.now(timezone.utc),
                            )
                        )
                        await session.execute(stmt)
                        logger.info(f"Updated adapter config in database: {config.identity}")
                    else:
                        # 创建新配置
                        db_config = AdapterConfigModel(
                            adapter_id=config.identity,
                            name=config.name or config.identity,
                            adapter_type=config.adapter_type.value if hasattr(config.adapter_type, 'value') else str(config.adapter_type),
                            adapter_class=self._get_class_path(config.adapter_class),
                            version=config.version or "1.0.0",
                            config=config.config or {},
                            dependencies=list(config.dependencies) if config.dependencies else None,
                            description=config.description,
                            author=config.author,
                            tags=list(config.tags) if config.tags else None,
                            is_enabled=True,
                            status="registered",
                        )
                        session.add(db_config)
                        logger.info(f"Saved new adapter config to database: {config.identity}")

                    await session.commit()
                    logger.info(f"Transaction committed for adapter: {config.identity}")
                    return True

                except Exception as e:
                    await session.rollback()
                    logger.error(f"Failed to save adapter config: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    raise
                    
        except Exception as e:
            logger.error(f"Database session error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    async def load_adapter_config(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """
        从数据库加载适配器配置
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            Optional[Dict]: 配置字典，如果不存在返回None
        """
        try:
            db_manager = await self._get_db_manager()
            async with db_manager.get_async_session() as session:
                try:
                    stmt = select(AdapterConfigModel).where(
                        AdapterConfigModel.adapter_id == adapter_id,
                        AdapterConfigModel.is_enabled == True
                    )
                    result = await session.execute(stmt)
                    config = result.scalar_one_or_none()

                    if config:
                        # 更新最后使用时间
                        stmt = (
                            update(AdapterConfigModel)
                            .where(AdapterConfigModel.adapter_id == adapter_id)
                            .values(
                                last_used_at=datetime.now(timezone.utc),
                                usage_count=AdapterConfigModel.usage_count + 1
                            )
                        )
                        await session.execute(stmt)
                        await session.commit()

                        return self._model_to_dict(config)

                    return None

                except Exception as e:
                    await session.rollback()
                    logger.error(f"Failed to load adapter config: {e}")
                    raise

        except Exception as e:
            logger.error(f"Database session error: {e}")
            return None

    async def load_all_adapter_configs(self) -> List[Dict[str, Any]]:
        """
        加载所有启用的适配器配置
        
        Returns:
            List[Dict]: 配置字典列表
        """
        try:
            db_manager = await self._get_db_manager()
            async with db_manager.get_async_session() as session:
                try:
                    stmt = select(AdapterConfigModel).where(
                        AdapterConfigModel.is_enabled == True
                    ).order_by(AdapterConfigModel.created_at)
                    
                    result = await session.execute(stmt)
                    configs = result.scalars().all()

                    return [self._model_to_dict(config) for config in configs]

                except Exception as e:
                    logger.error(f"Failed to load all adapter configs: {e}")
                    raise

        except Exception as e:
            logger.error(f"Database session error: {e}")
            return []

    async def delete_adapter_config(self, adapter_id: str) -> bool:
        """
        删除适配器配置
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            db_manager = await self._get_db_manager()
            async with db_manager.get_async_session() as session:
                try:
                    stmt = delete(AdapterConfigModel).where(
                        AdapterConfigModel.adapter_id == adapter_id
                    )
                    await session.execute(stmt)
                    await session.commit()
                    logger.info(f"Deleted adapter config from database: {adapter_id}")
                    return True

                except Exception as e:
                    await session.rollback()
                    logger.error(f"Failed to delete adapter config: {e}")
                    raise

        except Exception as e:
            logger.error(f"Database session error: {e}")
            return False

    def _get_class_path(self, adapter_class) -> str:
        """获取类的完整路径"""
        if isinstance(adapter_class, str):
            return adapter_class
        elif isinstance(adapter_class, type):
            return f"{adapter_class.__module__}.{adapter_class.__name__}"
        else:
            return str(adapter_class)

    def _model_to_dict(self, model: AdapterConfigModel) -> Dict[str, Any]:
        """将数据库模型转换为字典"""
        return {
            "adapter_id": model.adapter_id,
            "name": model.name,
            "adapter_type": model.adapter_type,
            "adapter_class": model.adapter_class,
            "version": model.version,
            "config": model.config,
            "dependencies": model.dependencies,
            "description": model.description,
            "author": model.author,
            "tags": model.tags,
            "is_enabled": model.is_enabled,
            "status": model.status,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
        }

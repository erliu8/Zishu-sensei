"""
文件系统适配器示例

演示如何实现文件系统操作适配器。
"""

import os
import asyncio
import aiofiles
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timezone
from pathlib import Path

from ..core.base import BaseAdapter
from ..core.types import AdapterType, Event, EventType, Priority

logger = logging.getLogger(__name__)


class FileSystemAdapter(BaseAdapter):
    """
    文件系统适配器

    提供文件系统操作功能，支持：
    - 文件读写操作
    - 目录管理
    - 文件监控
    - 批量操作
    """

    def __init__(self, config: Dict[str, Any]):
        """初始化文件系统适配器"""
        super().__init__(config)

        # 文件系统配置
        self.base_path = Path(config.get("base_path", "/tmp/zishu"))
        self.max_file_size = config.get("max_file_size", 100 * 1024 * 1024)  # 100MB
        self.allowed_extensions = set(config.get("allowed_extensions", []))
        self.enable_monitoring = config.get("enable_monitoring", False)
        self.auto_create_dirs = config.get("auto_create_dirs", True)

        # 文件监控
        self._file_watchers: Dict[str, Any] = {}
        self._monitoring_task: Optional[asyncio.Task] = None

        # 统计信息
        self._files_read = 0
        self._files_written = 0
        self._files_deleted = 0
        self._bytes_read = 0
        self._bytes_written = 0
        self._operation_errors = 0

    async def initialize(self) -> None:
        """初始化适配器"""
        await super().initialize()

        # 创建基础目录
        if self.auto_create_dirs:
            await self._ensure_directory(self.base_path)

        logger.info(f"FileSystemAdapter initialized with base path: {self.base_path}")

    async def start(self) -> None:
        """启动适配器"""
        await super().start()

        # 启动文件监控
        if self.enable_monitoring:
            self._monitoring_task = asyncio.create_task(self._file_monitor())

        # 发送启动事件
        await self.emit_event(
            Event(
                event_type=EventType.ADAPTER_STARTED,
                source=self.get_name(),
                data={
                    "base_path": str(self.base_path),
                    "max_file_size": self.max_file_size,
                    "enable_monitoring": self.enable_monitoring,
                    "allowed_extensions": list(self.allowed_extensions),
                },
                priority=Priority.MEDIUM,
            )
        )

        logger.info("FileSystemAdapter started")

    async def stop(self) -> None:
        """停止适配器"""
        await super().stop()

        # 停止文件监控
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        # 清理文件监控器
        self._file_watchers.clear()

        logger.info("FileSystemAdapter stopped")

    async def health_check(self) -> bool:
        """健康检查"""
        try:
            # 检查基础路径是否可访问
            if not self.base_path.exists():
                return False

            # 尝试创建临时文件
            test_file = self.base_path / ".health_check"
            async with aiofiles.open(test_file, "w") as f:
                await f.write("health_check")

            # 删除临时文件
            test_file.unlink()

            return True

        except Exception as e:
            logger.error(f"FileSystemAdapter health check failed: {e}")
            return False

    async def read_file(
        self,
        file_path: Union[str, Path],
        encoding: str = "utf-8",
        binary_mode: bool = False,
    ) -> Union[str, bytes]:
        """
        读取文件

        Args:
            file_path: 文件路径
            encoding: 文件编码
            binary_mode: 是否以二进制模式读取

        Returns:
            Union[str, bytes]: 文件内容
        """
        try:
            full_path = self._resolve_path(file_path)

            # 检查文件是否存在
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {full_path}")

            # 检查文件大小
            file_size = full_path.stat().st_size
            if file_size > self.max_file_size:
                raise ValueError(f"File too large: {file_size} bytes")

            # 读取文件
            mode = "rb" if binary_mode else "r"
            async with aiofiles.open(
                full_path, mode, encoding=None if binary_mode else encoding
            ) as f:
                content = await f.read()

            self._files_read += 1
            self._bytes_read += file_size

            # 发送读取完成事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_COMPLETED,
                    source=self.get_name(),
                    data={
                        "operation": "read_file",
                        "file_path": str(full_path),
                        "file_size": file_size,
                        "binary_mode": binary_mode,
                    },
                    priority=Priority.LOW,
                )
            )

            return content

        except Exception as e:
            self._operation_errors += 1

            # 发送错误事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_FAILED,
                    source=self.get_name(),
                    data={
                        "operation": "read_file",
                        "file_path": str(file_path),
                        "error": str(e),
                    },
                    priority=Priority.HIGH,
                )
            )

            logger.error(f"Failed to read file {file_path}: {e}")
            raise

    async def write_file(
        self,
        file_path: Union[str, Path],
        content: Union[str, bytes],
        encoding: str = "utf-8",
        create_dirs: bool = True,
        append_mode: bool = False,
    ) -> bool:
        """
        写入文件

        Args:
            file_path: 文件路径
            content: 文件内容
            encoding: 文件编码
            create_dirs: 是否自动创建目录
            append_mode: 是否以追加模式写入

        Returns:
            bool: 是否成功写入
        """
        try:
            full_path = self._resolve_path(file_path)

            # 检查文件扩展名
            if (
                self.allowed_extensions
                and full_path.suffix not in self.allowed_extensions
            ):
                raise ValueError(f"File extension not allowed: {full_path.suffix}")

            # 创建目录
            if create_dirs:
                await self._ensure_directory(full_path.parent)

            # 检查内容大小
            content_size = len(
                content.encode(encoding) if isinstance(content, str) else content
            )
            if content_size > self.max_file_size:
                raise ValueError(f"Content too large: {content_size} bytes")

            # 写入文件
            mode = (
                "ab"
                if append_mode and isinstance(content, bytes)
                else "a"
                if append_mode
                else "wb"
                if isinstance(content, bytes)
                else "w"
            )
            file_encoding = None if isinstance(content, bytes) else encoding

            async with aiofiles.open(full_path, mode, encoding=file_encoding) as f:
                await f.write(content)

            self._files_written += 1
            self._bytes_written += content_size

            # 发送写入完成事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_COMPLETED,
                    source=self.get_name(),
                    data={
                        "operation": "write_file",
                        "file_path": str(full_path),
                        "content_size": content_size,
                        "append_mode": append_mode,
                    },
                    priority=Priority.LOW,
                )
            )

            return True

        except Exception as e:
            self._operation_errors += 1

            # 发送错误事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_FAILED,
                    source=self.get_name(),
                    data={
                        "operation": "write_file",
                        "file_path": str(file_path),
                        "error": str(e),
                    },
                    priority=Priority.HIGH,
                )
            )

            logger.error(f"Failed to write file {file_path}: {e}")
            raise

    async def delete_file(self, file_path: Union[str, Path]) -> bool:
        """
        删除文件

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否成功删除
        """
        try:
            full_path = self._resolve_path(file_path)

            if not full_path.exists():
                logger.warning(f"File not found for deletion: {full_path}")
                return True

            # 删除文件
            full_path.unlink()
            self._files_deleted += 1

            # 发送删除完成事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_COMPLETED,
                    source=self.get_name(),
                    data={"operation": "delete_file", "file_path": str(full_path)},
                    priority=Priority.LOW,
                )
            )

            return True

        except Exception as e:
            self._operation_errors += 1

            # 发送错误事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_FAILED,
                    source=self.get_name(),
                    data={
                        "operation": "delete_file",
                        "file_path": str(file_path),
                        "error": str(e),
                    },
                    priority=Priority.HIGH,
                )
            )

            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    async def list_files(
        self,
        directory: Union[str, Path] = ".",
        pattern: Optional[str] = None,
        recursive: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        列出文件

        Args:
            directory: 目录路径
            pattern: 文件名模式
            recursive: 是否递归搜索

        Returns:
            List[Dict[str, Any]]: 文件信息列表
        """
        try:
            full_path = self._resolve_path(directory)

            if not full_path.exists() or not full_path.is_dir():
                raise ValueError(f"Directory not found: {full_path}")

            files = []

            if recursive:
                # 递归搜索
                for file_path in full_path.rglob(pattern or "*"):
                    if file_path.is_file():
                        files.append(await self._get_file_info(file_path))
            else:
                # 非递归搜索
                for file_path in full_path.glob(pattern or "*"):
                    if file_path.is_file():
                        files.append(await self._get_file_info(file_path))

            return files

        except Exception as e:
            self._operation_errors += 1
            logger.error(f"Failed to list files in {directory}: {e}")
            raise

    async def create_directory(self, directory: Union[str, Path]) -> bool:
        """
        创建目录

        Args:
            directory: 目录路径

        Returns:
            bool: 是否成功创建
        """
        try:
            full_path = self._resolve_path(directory)
            await self._ensure_directory(full_path)
            return True

        except Exception as e:
            self._operation_errors += 1
            logger.error(f"Failed to create directory {directory}: {e}")
            return False

    async def copy_file(
        self, source: Union[str, Path], destination: Union[str, Path]
    ) -> bool:
        """
        复制文件

        Args:
            source: 源文件路径
            destination: 目标文件路径

        Returns:
            bool: 是否成功复制
        """
        try:
            # 读取源文件
            content = await self.read_file(source, binary_mode=True)

            # 写入目标文件
            await self.write_file(destination, content)

            return True

        except Exception as e:
            logger.error(f"Failed to copy file from {source} to {destination}: {e}")
            return False

    async def move_file(
        self, source: Union[str, Path], destination: Union[str, Path]
    ) -> bool:
        """
        移动文件

        Args:
            source: 源文件路径
            destination: 目标文件路径

        Returns:
            bool: 是否成功移动
        """
        try:
            # 复制文件
            if await self.copy_file(source, destination):
                # 删除源文件
                return await self.delete_file(source)

            return False

        except Exception as e:
            logger.error(f"Failed to move file from {source} to {destination}: {e}")
            return False

    async def get_file_info(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """
        获取文件信息

        Args:
            file_path: 文件路径

        Returns:
            Dict[str, Any]: 文件信息
        """
        full_path = self._resolve_path(file_path)
        return await self._get_file_info(full_path)

    def _resolve_path(self, path: Union[str, Path]) -> Path:
        """解析路径"""
        path = Path(path)

        if path.is_absolute():
            # 检查是否在允许的基础路径下
            try:
                path.resolve().relative_to(self.base_path.resolve())
            except ValueError:
                raise ValueError(f"Path outside base directory: {path}")
            return path
        else:
            return self.base_path / path

    async def _ensure_directory(self, path: Path) -> None:
        """确保目录存在"""
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)

    async def _get_file_info(self, file_path: Path) -> Dict[str, Any]:
        """获取文件信息"""
        stat = file_path.stat()

        return {
            "path": str(file_path),
            "name": file_path.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(
                stat.st_ctime, timezone.utc
            ).isoformat(),
            "modified_at": datetime.fromtimestamp(
                stat.st_mtime, timezone.utc
            ).isoformat(),
            "is_file": file_path.is_file(),
            "is_directory": file_path.is_dir(),
            "extension": file_path.suffix,
            "permissions": oct(stat.st_mode)[-3:],
        }

    async def _file_monitor(self) -> None:
        """文件监控任务"""
        logger.info("File monitoring started")

        # 这里应该实现实际的文件监控逻辑
        # 例如使用 watchdog 库监控文件系统变化

        while True:
            try:
                # 模拟文件监控
                await asyncio.sleep(5)

                # 发送监控事件
                await self.emit_event(
                    Event(
                        event_type=EventType.HEALTH_CHECK_PASSED,
                        source=self.get_name(),
                        data={
                            "operation": "file_monitoring",
                            "base_path": str(self.base_path),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                        priority=Priority.LOW,
                    )
                )

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"File monitoring error: {e}")
                await asyncio.sleep(10)

        logger.info("File monitoring stopped")

    def get_adapter_type(self) -> AdapterType:
        """获取适配器类型"""
        return AdapterType.STORAGE

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        base_stats = super().get_statistics()

        return {
            **base_stats,
            "files_read": self._files_read,
            "files_written": self._files_written,
            "files_deleted": self._files_deleted,
            "bytes_read": self._bytes_read,
            "bytes_written": self._bytes_written,
            "operation_errors": self._operation_errors,
            "success_rate": self._calculate_success_rate(),
            "base_path": str(self.base_path),
            "max_file_size": self.max_file_size,
            "enable_monitoring": self.enable_monitoring,
            "allowed_extensions": list(self.allowed_extensions),
        }

    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        total_operations = self._files_read + self._files_written + self._files_deleted
        if total_operations == 0:
            return 0.0
        return (total_operations - self._operation_errors) / total_operations

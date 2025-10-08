"""文件系统适配器
提供安全的文件系统操作功能，支持读取、写入、删除、移动等操作
"""

import os
import shutil
import asyncio
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Set
from dataclasses import dataclass, field

# 可选依赖
try:
    import aiofiles

    AIOFILES_AVAILABLE = True
except ImportError:
    AIOFILES_AVAILABLE = False

# 本地模块导入
from ..base.adapter import (
    BaseAdapter,
    ExecutionContext,
    ExecutionResult,
    HealthCheckResult,
)
from ..base.metadata import (
    AdapterMetadata,
    AdapterType,
    AdapterStatus,
    AdapterCapability,
    SecurityLevel,
    CapabilityCategory,
    AdapterPermissions,
    AdapterConfiguration,
)
from ..base.exceptions import (
    BaseAdapterException,
    AdapterConfigurationError,
    AdapterExecutionError,
    AdapterValidationError,
    ErrorCode,
    ExceptionSeverity,
)


# ================================
# 文件操作数据结构
# ================================


@dataclass
class FileOperation:
    """文件操作类型定义"""

    operation: str  # read, write, delete, move, copy, list, exists, stat
    path: str
    target_path: Optional[str] = None
    content: Optional[Union[str, bytes]] = None
    encoding: str = "utf-8"
    create_dirs: bool = False
    backup: bool = False

    def __post_init__(self):
        """验证操作参数"""
        valid_operations = {
            "read",
            "write",
            "append",
            "delete",
            "move",
            "copy",
            "list",
            "exists",
            "stat",
            "mkdir",
            "rmdir",
            "chmod",
        }

        if self.operation not in valid_operations:
            raise ValueError(f"Invalid operation: {self.operation}")

        if self.operation in ["move", "copy"] and not self.target_path:
            raise ValueError(f"Operation '{self.operation}' requires target_path")

        if self.operation in ["write", "append"] and self.content is None:
            raise ValueError(f"Operation '{self.operation}' requires content")


@dataclass
class FileSafetyConfig:
    """文件安全配置"""

    allowed_paths: List[str] = field(default_factory=list)
    forbidden_paths: List[str] = field(default_factory=list)
    allowed_extensions: Set[str] = field(default_factory=set)
    forbidden_extensions: Set[str] = field(default_factory=set)
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    enable_backup: bool = True
    backup_dir: str = "/tmp/file_adapter_backups"
    scan_for_malware: bool = False

    def __post_init__(self):
        """初始化安全配置"""
        # 默认允许的扩展名
        if not self.allowed_extensions:
            self.allowed_extensions = {
                ".txt",
                ".md",
                ".json",
                ".yaml",
                ".yml",
                ".xml",
                ".csv",
                ".py",
                ".js",
                ".html",
                ".css",
                ".sql",
                ".log",
                ".conf",
            }

        # 默认禁止的扩展名
        if not self.forbidden_extensions:
            self.forbidden_extensions = {
                ".exe",
                ".bat",
                ".cmd",
                ".ps1",
                ".sh",
                ".scr",
                ".com",
                ".pif",
                ".vbs",
                ".js",
                ".jar",
                ".app",
                ".dmg",
                ".pkg",
            }

        # 默认禁止的路径
        if not self.forbidden_paths:
            self.forbidden_paths = [
                "/bin",
                "/sbin",
                "/usr/bin",
                "/usr/sbin",
                "/boot",
                "/dev",
                "/proc",
                "/sys",
                "C:\\Windows",
                "C:\\Program Files",
                "C:\\System32",
            ]


# ================================
# 文件系统适配器实现
# ================================


class FileSystemAdapter(BaseAdapter):
    """
    文件系统适配器实现

    提供安全的文件系统操作功能，包括：
    - 文件读取/写入/删除
    - 目录操作
    - 文件属性查询
    - 批量操作
    - 安全检查和权限控制
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化文件系统适配器

        Args:
            config: 适配器配置，包含安全设置和操作限制
        """
        # 确保配置包含必需字段
        config.setdefault("adapter_type", AdapterType.HARD.value)
        config.setdefault("name", "FileSystemAdapter")
        config.setdefault("version", "1.0.0")

        super().__init__(config)

        # 加载安全配置
        safety_config = config.get("safety_config", {})
        self.safety_config = FileSafetyConfig(**safety_config)

        # 操作统计
        self.operation_stats = {
            "total_operations": 0,
            "successful_operations": 0,
            "failed_operations": 0,
            "bytes_read": 0,
            "bytes_written": 0,
            "files_created": 0,
            "files_deleted": 0,
        }

        # 活跃操作跟踪
        self.active_operations: Set[str] = set()

        self.logger.info(f"FileSystemAdapter initialized")

    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            version=self.version,
            adapter_type=AdapterType.HARD,
            description="安全的文件系统操作适配器，支持文件和目录的基本操作",
            author="Zishu Framework",
            capabilities=self._get_capabilities_impl(),
            permissions=AdapterPermissions(
                security_level=SecurityLevel.RESTRICTED,
                file_system_access=self.safety_config.allowed_paths,
                required_roles={"file_operator", "system_user"},
            ),
            configuration=[
                AdapterConfiguration(
                    name="safety_config",
                    type="dict",
                    required=False,
                    description="文件操作安全配置",
                    default_value={},
                ),
                AdapterConfiguration(
                    name="max_concurrent_operations",
                    type="int",
                    required=False,
                    description="最大并发操作数",
                    default_value=10,
                ),
            ],
            tags={"filesystem", "file_operations", "safe", "hard_adapter"},
            categories={"file_operations", "system_control"},
        )

    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力列表"""
        return [
            AdapterCapability(
                name="file_read",
                category=CapabilityCategory.FILE_OPERATIONS,
                description="读取文件内容",
                input_schema={
                    "type": "object",
                    "properties": {
                        "operation": {"type": "string", "enum": ["read"]},
                        "path": {"type": "string", "description": "文件路径"},
                        "encoding": {"type": "string", "default": "utf-8"},
                    },
                    "required": ["operation", "path"],
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "文件内容"},
                        "size": {"type": "integer", "description": "文件大小"},
                        "encoding": {"type": "string", "description": "编码格式"},
                    },
                },
                examples=[
                    {
                        "input": {"operation": "read", "path": "/tmp/example.txt"},
                        "output": {
                            "content": "Hello World",
                            "size": 11,
                            "encoding": "utf-8",
                        },
                    }
                ],
                tags={"read", "file", "text"},
            ),
            AdapterCapability(
                name="file_write",
                category=CapabilityCategory.FILE_OPERATIONS,
                description="写入文件内容",
                input_schema={
                    "type": "object",
                    "properties": {
                        "operation": {"type": "string", "enum": ["write", "append"]},
                        "path": {"type": "string", "description": "文件路径"},
                        "content": {"type": "string", "description": "写入内容"},
                        "encoding": {"type": "string", "default": "utf-8"},
                        "create_dirs": {"type": "boolean", "default": False},
                        "backup": {"type": "boolean", "default": True},
                    },
                    "required": ["operation", "path", "content"],
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "bytes_written": {"type": "integer"},
                        "backup_path": {"type": "string", "description": "备份文件路径"},
                    },
                },
                tags={"write", "file", "create"},
            ),
            AdapterCapability(
                name="file_operations",
                category=CapabilityCategory.FILE_OPERATIONS,
                description="文件系统操作（删除、移动、复制等）",
                input_schema={
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": [
                                "delete",
                                "move",
                                "copy",
                                "mkdir",
                                "rmdir",
                                "chmod",
                            ],
                        },
                        "path": {"type": "string"},
                        "target_path": {
                            "type": "string",
                            "description": "目标路径（移动、复制时需要）",
                        },
                        "permissions": {
                            "type": "string",
                            "description": "权限设置（chmod时需要）",
                        },
                    },
                    "required": ["operation", "path"],
                },
                tags={"filesystem", "management"},
            ),
            AdapterCapability(
                name="file_info",
                category=CapabilityCategory.FILE_OPERATIONS,
                description="获取文件和目录信息",
                input_schema={
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": ["exists", "stat", "list"],
                        },
                        "path": {"type": "string"},
                        "recursive": {"type": "boolean", "default": False},
                    },
                    "required": ["operation", "path"],
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "exists": {"type": "boolean"},
                        "file_info": {"type": "object"},
                        "files": {"type": "array", "items": {"type": "object"}},
                    },
                },
                tags={"info", "query", "directory"},
            ),
        ]

    async def _initialize_impl(self) -> bool:
        """适配器初始化实现"""
        try:
            # 验证安全配置
            await self._validate_safety_config()

            # 创建备份目录
            if self.safety_config.enable_backup:
                backup_path = Path(self.safety_config.backup_dir)
                backup_path.mkdir(parents=True, exist_ok=True)
                self.logger.info(f"Backup directory created: {backup_path}")

            self.logger.info("FileSystemAdapter initialized successfully")
            return True

        except Exception as e:
            self.logger.error(f"Failed to initialize FileSystemAdapter: {e}")
            return False

    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理文件操作请求"""
        operation_id = f"op_{context.execution_id}"
        self.active_operations.add(operation_id)

        try:
            # 验证输入数据
            if isinstance(input_data, dict):
                file_op = FileOperation(**input_data)
            elif isinstance(input_data, FileOperation):
                file_op = input_data
            else:
                raise AdapterValidationError(
                    "Invalid input data format",
                    adapter_id=self.adapter_id,
                    context={"input_type": type(input_data).__name__},
                )

            # 安全检查
            await self._security_check(file_op, context)

            # 更新统计
            self.operation_stats["total_operations"] += 1

            # 执行操作
            result = await self._execute_file_operation(file_op, context)

            # 更新成功统计
            self.operation_stats["successful_operations"] += 1

            return result

        except Exception as e:
            self.operation_stats["failed_operations"] += 1
            self.logger.error(f"File operation failed: {e}")
            raise

        finally:
            self.active_operations.discard(operation_id)

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        checks = {}
        metrics = {}
        issues = []
        recommendations = []

        try:
            # 检查备份目录
            if self.safety_config.enable_backup:
                backup_path = Path(self.safety_config.backup_dir)
                checks["backup_directory_accessible"] = backup_path.exists()
                if not backup_path.exists():
                    issues.append(f"Backup directory not accessible: {backup_path}")
                    recommendations.append(
                        "Create backup directory or disable backup functionality"
                    )

            # 检查活跃操作数量
            active_count = len(self.active_operations)
            checks["not_overloaded"] = active_count < 50
            metrics["active_operations"] = active_count

            # 检查错误率
            total_ops = self.operation_stats["total_operations"]
            if total_ops > 0:
                error_rate = self.operation_stats["failed_operations"] / total_ops
                checks["low_error_rate"] = error_rate < 0.1
                metrics["error_rate"] = error_rate

                if error_rate > 0.2:
                    issues.append(f"High error rate: {error_rate:.2%}")
                    recommendations.append("Check file paths and permissions")

            # 统计指标
            metrics.update(
                {
                    "total_operations": self.operation_stats["total_operations"],
                    "success_rate": self.operation_stats["successful_operations"]
                    / max(total_ops, 1),
                    "bytes_read": self.operation_stats["bytes_read"],
                    "bytes_written": self.operation_stats["bytes_written"],
                }
            )

        except Exception as e:
            issues.append(f"Health check error: {str(e)}")
            checks["health_check_completed"] = False

        return HealthCheckResult(
            is_healthy=all(checks.values()),
            status="healthy" if all(checks.values()) else "degraded",
            checks=checks,
            metrics=metrics,
            issues=issues,
            recommendations=recommendations,
        )

    async def _cleanup_impl(self) -> None:
        """清理适配器资源"""
        try:
            # 等待活跃操作完成
            if self.active_operations:
                self.logger.info(
                    f"Waiting for {len(self.active_operations)} active operations to complete"
                )

                timeout = 30  # 30秒超时
                for _ in range(timeout):
                    if not self.active_operations:
                        break
                    await asyncio.sleep(1)

                if self.active_operations:
                    self.logger.warning(
                        f"Forced cleanup with {len(self.active_operations)} active operations"
                    )

            # 清理统计数据
            self.operation_stats.clear()
            self.active_operations.clear()

            self.logger.info("FileSystemAdapter cleaned up successfully")

        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")
            raise

    # ================================
    # 核心文件操作方法
    # ================================

    async def _execute_file_operation(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """执行具体的文件操作"""

        operation_map = {
            "read": self._read_file,
            "write": self._write_file,
            "append": self._append_file,
            "delete": self._delete_file,
            "move": self._move_file,
            "copy": self._copy_file,
            "list": self._list_directory,
            "exists": self._check_exists,
            "stat": self._get_file_stat,
            "mkdir": self._create_directory,
            "rmdir": self._remove_directory,
            "chmod": self._change_permissions,
        }

        handler = operation_map.get(operation.operation)
        if not handler:
            raise AdapterExecutionError(
                f"Unsupported operation: {operation.operation}",
                error_code=ErrorCode.ADAPTER_EXECUTION_FAILED,
                adapter_id=self.adapter_id,
            )

        return await handler(operation, context)

    async def _read_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """读取文件"""
        try:
            path = Path(operation.path)

            if not path.exists():
                raise FileNotFoundError(f"File not found: {path}")

            if not path.is_file():
                raise ValueError(f"Path is not a file: {path}")

            # 检查文件大小
            file_size = path.stat().st_size
            if file_size > self.safety_config.max_file_size:
                raise AdapterExecutionError(
                    f"File too large: {file_size} bytes (max: {self.safety_config.max_file_size})",
                    error_code=ErrorCode.FILE_OPERATION_FAILED,
                    adapter_id=self.adapter_id,
                )

            # 读取文件内容
            if AIOFILES_AVAILABLE:
                async with aiofiles.open(path, "r", encoding=operation.encoding) as f:
                    content = await f.read()
            else:
                # 回退到同步文件操作
                await asyncio.sleep(0)  # 让出控制权
                with open(path, "r", encoding=operation.encoding) as f:
                    content = f.read()

            self.operation_stats["bytes_read"] += file_size

            return {
                "content": content,
                "size": file_size,
                "encoding": operation.encoding,
                "path": str(path),
                "modified_time": datetime.fromtimestamp(
                    path.stat().st_mtime, tz=timezone.utc
                ).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to read file {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _write_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """写入文件"""
        try:
            path = Path(operation.path)
            backup_path = None

            # 创建目录
            if operation.create_dirs:
                path.parent.mkdir(parents=True, exist_ok=True)

            # 创建备份
            if path.exists() and self.safety_config.enable_backup and operation.backup:
                backup_path = await self._create_backup(path)

            # 写入文件
            content_bytes = (
                operation.content.encode(operation.encoding)
                if isinstance(operation.content, str)
                else operation.content
            )

            if AIOFILES_AVAILABLE:
                async with aiofiles.open(path, "w", encoding=operation.encoding) as f:
                    await f.write(operation.content)
            else:
                # 回退到同步文件操作
                await asyncio.sleep(0)  # 让出控制权
                with open(path, "w", encoding=operation.encoding) as f:
                    f.write(operation.content)

            bytes_written = len(content_bytes)
            self.operation_stats["bytes_written"] += bytes_written

            if not path.exists():  # 新文件
                self.operation_stats["files_created"] += 1

            return {
                "bytes_written": bytes_written,
                "path": str(path),
                "backup_path": str(backup_path) if backup_path else None,
                "created_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to write file {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _append_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """追加文件内容"""
        try:
            path = Path(operation.path)

            # 创建目录
            if operation.create_dirs:
                path.parent.mkdir(parents=True, exist_ok=True)

            # 追加内容
            content_bytes = (
                operation.content.encode(operation.encoding)
                if isinstance(operation.content, str)
                else operation.content
            )

            if AIOFILES_AVAILABLE:
                async with aiofiles.open(path, "a", encoding=operation.encoding) as f:
                    await f.write(operation.content)
            else:
                # 回退到同步文件操作
                await asyncio.sleep(0)  # 让出控制权
                with open(path, "a", encoding=operation.encoding) as f:
                    f.write(operation.content)

            bytes_written = len(content_bytes)
            self.operation_stats["bytes_written"] += bytes_written

            return {
                "bytes_written": bytes_written,
                "path": str(path),
                "operation": "append",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to append to file {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _delete_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """删除文件或目录"""
        try:
            path = Path(operation.path)

            if not path.exists():
                return {"deleted": False, "reason": "File not found", "path": str(path)}

            # 创建备份（如果启用）
            backup_path = None
            if self.safety_config.enable_backup and operation.backup:
                backup_path = await self._create_backup(path)

            # 删除文件或目录
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                shutil.rmtree(path)

            self.operation_stats["files_deleted"] += 1

            return {
                "deleted": True,
                "path": str(path),
                "backup_path": str(backup_path) if backup_path else None,
                "deleted_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to delete {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _list_directory(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """列出目录内容"""
        try:
            path = Path(operation.path)

            if not path.exists():
                raise FileNotFoundError(f"Directory not found: {path}")

            if not path.is_dir():
                raise ValueError(f"Path is not a directory: {path}")

            files = []
            for item in path.iterdir():
                try:
                    stat_info = item.stat()
                    file_info = {
                        "name": item.name,
                        "path": str(item),
                        "is_file": item.is_file(),
                        "is_directory": item.is_dir(),
                        "size": stat_info.st_size if item.is_file() else 0,
                        "modified_time": datetime.fromtimestamp(
                            stat_info.st_mtime, tz=timezone.utc
                        ).isoformat(),
                        "permissions": oct(stat_info.st_mode)[-3:]
                        if hasattr(stat_info, "st_mode")
                        else "unknown",
                    }
                    files.append(file_info)
                except (OSError, PermissionError) as e:
                    self.logger.warning(f"Could not access {item}: {e}")
                    continue

            return {
                "path": str(path),
                "files": files,
                "total_items": len(files),
                "listed_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to list directory {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _check_exists(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """检查文件或目录是否存在"""
        path = Path(operation.path)
        exists = path.exists()

        result = {"exists": exists, "path": str(path)}

        if exists:
            result.update(
                {
                    "is_file": path.is_file(),
                    "is_directory": path.is_dir(),
                    "is_symlink": path.is_symlink(),
                }
            )

        return result

    async def _get_file_stat(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """获取文件统计信息"""
        try:
            path = Path(operation.path)

            if not path.exists():
                raise FileNotFoundError(f"Path not found: {path}")

            stat_info = path.stat()

            # 计算文件校验和（仅对文件）
            checksum = None
            if path.is_file() and stat_info.st_size < 10 * 1024 * 1024:  # 10MB以下计算校验和
                try:
                    checksum = await self._calculate_checksum(path)
                except Exception as e:
                    self.logger.warning(f"Failed to calculate checksum for {path}: {e}")

            return {
                "path": str(path),
                "name": path.name,
                "size": stat_info.st_size,
                "is_file": path.is_file(),
                "is_directory": path.is_dir(),
                "is_symlink": path.is_symlink(),
                "permissions": oct(stat_info.st_mode)[-3:]
                if hasattr(stat_info, "st_mode")
                else "unknown",
                "owner": stat_info.st_uid
                if hasattr(stat_info, "st_uid")
                else "unknown",
                "group": stat_info.st_gid
                if hasattr(stat_info, "st_gid")
                else "unknown",
                "created_time": datetime.fromtimestamp(
                    stat_info.st_ctime, tz=timezone.utc
                ).isoformat(),
                "modified_time": datetime.fromtimestamp(
                    stat_info.st_mtime, tz=timezone.utc
                ).isoformat(),
                "accessed_time": datetime.fromtimestamp(
                    stat_info.st_atime, tz=timezone.utc
                ).isoformat(),
                "checksum": checksum,
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to get file stats for {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _create_directory(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """创建目录"""
        try:
            path = Path(operation.path)
            path.mkdir(parents=True, exist_ok=True)

            return {
                "created": True,
                "path": str(path),
                "created_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to create directory {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _move_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """移动文件或目录"""
        try:
            source_path = Path(operation.path)
            target_path = Path(operation.target_path)

            if not source_path.exists():
                raise FileNotFoundError(f"Source path not found: {source_path}")

            # 安全检查目标路径
            await self._validate_path(str(target_path), "write")

            # 创建目标目录
            if operation.create_dirs:
                target_path.parent.mkdir(parents=True, exist_ok=True)

            # 移动文件
            shutil.move(str(source_path), str(target_path))

            return {
                "moved": True,
                "source_path": str(source_path),
                "target_path": str(target_path),
                "moved_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to move {operation.path} to {operation.target_path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _copy_file(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """复制文件或目录"""
        try:
            source_path = Path(operation.path)
            target_path = Path(operation.target_path)

            if not source_path.exists():
                raise FileNotFoundError(f"Source path not found: {source_path}")

            # 安全检查目标路径
            await self._validate_path(str(target_path), "write")

            # 创建目标目录
            if operation.create_dirs:
                target_path.parent.mkdir(parents=True, exist_ok=True)

            # 复制文件或目录
            if source_path.is_file():
                shutil.copy2(str(source_path), str(target_path))
            elif source_path.is_dir():
                shutil.copytree(str(source_path), str(target_path), dirs_exist_ok=True)

            return {
                "copied": True,
                "source_path": str(source_path),
                "target_path": str(target_path),
                "copied_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to copy {operation.path} to {operation.target_path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _remove_directory(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """删除目录"""
        try:
            path = Path(operation.path)

            if not path.exists():
                return {
                    "removed": False,
                    "reason": "Directory not found",
                    "path": str(path),
                }

            if not path.is_dir():
                raise ValueError(f"Path is not a directory: {path}")

            # 创建备份（如果启用）
            backup_path = None
            if self.safety_config.enable_backup and operation.backup:
                backup_path = await self._create_backup(path)

            # 删除目录
            shutil.rmtree(path)

            return {
                "removed": True,
                "path": str(path),
                "backup_path": str(backup_path) if backup_path else None,
                "removed_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to remove directory {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _change_permissions(
        self, operation: FileOperation, context: ExecutionContext
    ) -> Dict[str, Any]:
        """修改文件权限"""
        try:
            path = Path(operation.path)

            if not path.exists():
                raise FileNotFoundError(f"Path not found: {path}")

            # 解析权限（八进制字符串转整数）
            if hasattr(operation, "permissions") and operation.permissions:
                permissions = int(operation.permissions, 8)
            else:
                raise ValueError("Missing permissions for chmod operation")

            # 修改权限
            path.chmod(permissions)

            return {
                "changed": True,
                "path": str(path),
                "permissions": oct(permissions)[-3:],
                "changed_time": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to change permissions for {operation.path}: {str(e)}",
                error_code=ErrorCode.FILE_OPERATION_FAILED,
                adapter_id=self.adapter_id,
                cause=e,
            )

    # ================================
    # 安全检查和验证方法
    # ================================

    async def _security_check(
        self, operation: FileOperation, context: ExecutionContext
    ) -> None:
        """执行安全检查"""
        # 路径安全检查
        await self._validate_path(
            operation.path, self._get_operation_access_type(operation.operation)
        )

        # 如果有目标路径，也要检查
        if operation.target_path:
            await self._validate_path(operation.target_path, "write")

        # 扩展名检查
        self._validate_file_extension(operation.path)

        # 内容检查（写入操作）
        if operation.operation in ["write", "append"] and operation.content:
            await self._validate_content(operation.content)

    def _get_operation_access_type(self, operation: str) -> str:
        """获取操作的访问类型"""
        read_operations = {"read", "exists", "stat", "list"}
        write_operations = {
            "write",
            "append",
            "delete",
            "move",
            "copy",
            "mkdir",
            "rmdir",
            "chmod",
        }

        if operation in read_operations:
            return "read"
        elif operation in write_operations:
            return "write"
        else:
            return "read"  # 默认为读取权限

    async def _validate_path(self, path: str, access_type: str = "read") -> None:
        """验证路径安全性"""
        path_obj = Path(path).resolve()  # 解析绝对路径

        # 检查禁止路径
        for forbidden in self.safety_config.forbidden_paths:
            forbidden_path = Path(forbidden).resolve()
            try:
                path_obj.relative_to(forbidden_path)
                raise AdapterValidationError(
                    f"Access to forbidden path: {path}",
                    error_code=ErrorCode.SECURITY_VIOLATION,
                    adapter_id=self.adapter_id,
                    context={"path": str(path), "forbidden_path": str(forbidden_path)},
                )
            except ValueError:
                continue  # 不在禁止路径下

        # 检查允许路径（如果配置了）
        if self.safety_config.allowed_paths:
            allowed = False
            for allowed_path in self.safety_config.allowed_paths:
                allowed_path_obj = Path(allowed_path).resolve()
                try:
                    path_obj.relative_to(allowed_path_obj)
                    allowed = True
                    break
                except ValueError:
                    continue

            if not allowed:
                raise AdapterValidationError(
                    f"Access to path not allowed: {path}",
                    error_code=ErrorCode.SECURITY_VIOLATION,
                    adapter_id=self.adapter_id,
                    context={
                        "path": str(path),
                        "allowed_paths": self.safety_config.allowed_paths,
                    },
                )

        # 检查路径遍历攻击
        if ".." in str(path) or str(path_obj) != str(Path(path).resolve()):
            raise AdapterValidationError(
                f"Potential path traversal attack: {path}",
                error_code=ErrorCode.SECURITY_VIOLATION,
                adapter_id=self.adapter_id,
            )

    def _validate_file_extension(self, path: str) -> None:
        """验证文件扩展名"""
        path_obj = Path(path)
        extension = path_obj.suffix.lower()

        # 检查禁止扩展名
        if extension in self.safety_config.forbidden_extensions:
            raise AdapterValidationError(
                f"Forbidden file extension: {extension}",
                error_code=ErrorCode.SECURITY_VIOLATION,
                adapter_id=self.adapter_id,
                context={"path": path, "extension": extension},
            )

        # 检查允许扩展名（如果配置了）
        if (
            self.safety_config.allowed_extensions
            and extension not in self.safety_config.allowed_extensions
        ):
            raise AdapterValidationError(
                f"File extension not allowed: {extension}",
                error_code=ErrorCode.SECURITY_VIOLATION,
                adapter_id=self.adapter_id,
                context={
                    "path": path,
                    "extension": extension,
                    "allowed": list(self.safety_config.allowed_extensions),
                },
            )

    async def _validate_content(self, content: Union[str, bytes]) -> None:
        """验证文件内容安全性"""
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="ignore")

        # 检查内容大小
        content_size = len(content.encode("utf-8"))
        if content_size > self.safety_config.max_file_size:
            raise AdapterValidationError(
                f"Content too large: {content_size} bytes (max: {self.safety_config.max_file_size})",
                error_code=ErrorCode.SECURITY_VIOLATION,
                adapter_id=self.adapter_id,
            )

        # 基础恶意内容检查
        suspicious_patterns = [
            r"rm\s+-rf\s+/",
            r"del\s+/[qsy]",
            r"format\s+c:",
            r"<script[^>]*>.*?</script>",
            r"eval\s*\(",
            r"exec\s*\(",
            r"import\s+os",
            r"import\s+subprocess",
        ]

        import re

        for pattern in suspicious_patterns:
            if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
                raise AdapterValidationError(
                    f"Suspicious content detected",
                    error_code=ErrorCode.SECURITY_VIOLATION,
                    adapter_id=self.adapter_id,
                    context={"pattern": pattern},
                )

    async def _validate_safety_config(self) -> None:
        """验证安全配置"""
        # 检查备份目录
        if self.safety_config.enable_backup:
            backup_dir = Path(self.safety_config.backup_dir)
            if not backup_dir.exists():
                try:
                    backup_dir.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    raise AdapterConfigurationError(
                        f"Cannot create backup directory: {backup_dir}",
                        adapter_id=self.adapter_id,
                        cause=e,
                    )

        # 检查允许路径的可访问性
        if self.safety_config.allowed_paths:
            accessible_count = 0
            for path in self.safety_config.allowed_paths:
                if Path(path).exists():
                    accessible_count += 1

            if accessible_count == 0:
                self.logger.warning("No allowed paths are accessible")

    # ================================
    # 辅助工具方法
    # ================================

    async def _create_backup(self, path: Path) -> Path:
        """创建文件备份"""
        backup_dir = Path(self.safety_config.backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{path.name}_{timestamp}"
        backup_path = backup_dir / backup_filename

        # 确保备份文件名唯一
        counter = 1
        while backup_path.exists():
            backup_filename = f"{path.name}_{timestamp}_{counter}"
            backup_path = backup_dir / backup_filename
            counter += 1

        # 复制文件
        if path.is_file():
            shutil.copy2(str(path), str(backup_path))
        elif path.is_dir():
            shutil.copytree(str(path), str(backup_path))

        self.logger.info(f"Created backup: {backup_path}")
        return backup_path

    async def _calculate_checksum(self, path: Path) -> str:
        """计算文件校验和"""
        hash_md5 = hashlib.md5()

        if AIOFILES_AVAILABLE:
            async with aiofiles.open(path, "rb") as f:
                while chunk := await f.read(8192):
                    hash_md5.update(chunk)
        else:
            # 回退到同步文件操作
            await asyncio.sleep(0)  # 让出控制权
            with open(path, "rb") as f:
                while chunk := f.read(8192):
                    hash_md5.update(chunk)

        return hash_md5.hexdigest()

    # ================================
    # 公共接口方法
    # ================================

    def get_operation_stats(self) -> Dict[str, Any]:
        """获取操作统计信息"""
        return self.operation_stats.copy()

    def get_safety_config(self) -> FileSafetyConfig:
        """获取安全配置"""
        return self.safety_config

    async def validate_path_access(self, path: str, operation: str = "read") -> bool:
        """验证路径访问权限（公共接口）"""
        try:
            await self._validate_path(path, operation)
            return True
        except AdapterValidationError:
            return False

    def list_allowed_paths(self) -> List[str]:
        """获取允许访问的路径列表"""
        return self.safety_config.allowed_paths.copy()

    def list_forbidden_paths(self) -> List[str]:
        """获取禁止访问的路径列表"""
        return self.safety_config.forbidden_paths.copy()


# ================================
# 适配器注册
# ================================

# 注册文件系统适配器到工厂
from ..base.adapter import AdapterFactory

AdapterFactory.register("filesystem", FileSystemAdapter)

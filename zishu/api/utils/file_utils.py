#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文件处理工具函数 - 提供全面的文件操作、验证、转换和管理功能
支持多种存储后端、安全验证、元数据提取等高级功能
"""

import os
import re
import hashlib
import mimetypes
import tempfile
import shutil
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple, Any, BinaryIO, AsyncGenerator
from datetime import datetime, timedelta
from urllib.parse import quote, unquote
import uuid
import json
import logging
from contextlib import asynccontextmanager

# 可选第三方库导入
HAS_AIOFILES = True
HAS_PIL = True
HAS_MAGIC = True
HAS_FFMPEG = True

try:
    import aiofiles  # type: ignore
except ImportError:
    HAS_AIOFILES = False

    # 创建一个简单的替代实现
    class MockAiofiles:
        @staticmethod
        async def open(file_path, mode="r"):
            # 简单的同步包装为异步
            class AsyncFile:
                def __init__(self, file_obj):
                    self._file = file_obj

                async def read(self, size=-1):
                    return self._file.read(size)

                async def write(self, data):
                    return self._file.write(data)

                async def __aenter__(self):
                    return self

                async def __aexit__(self, exc_type, exc_val, exc_tb):
                    self._file.close()

            return AsyncFile(open(file_path, mode))

    aiofiles = MockAiofiles()

try:
    from PIL import Image, ImageOps  # type: ignore
except ImportError:
    HAS_PIL = False

    # 创建Mock类
    class MockImage:
        class Resampling:
            LANCZOS = 1

        @staticmethod
        def open(*args, **kwargs):
            raise ImportError("PIL not available")

    Image = MockImage()

try:
    import magic  # type: ignore
except ImportError:
    HAS_MAGIC = False
    magic = None

try:
    import ffmpeg  # type: ignore
except ImportError:
    HAS_FFMPEG = False
    ffmpeg = None

# 项目内部导入
from ..schemas.file import (
    FileType,
    FileStatus,
    FileAccessLevel,
    StorageProvider,
    ScanStatus,
    FileMetadata,
    FileSecurityInfo,
    FileStorageInfo,
    FileValidator,
    FileHelper,
)

# 配置日志
logger = logging.getLogger(__name__)

# ======================== 常量定义 ========================

# 文件大小限制 (字节)
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
MAX_CHUNK_SIZE = 64 * 1024 * 1024  # 64MB

# 支持的图片格式
SUPPORTED_IMAGE_FORMATS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".tiff",
    ".svg",
}

# 支持的视频格式
SUPPORTED_VIDEO_FORMATS = {
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".m4v",
}

# 支持的音频格式
SUPPORTED_AUDIO_FORMATS = {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"}

# 危险文件扩展名
DANGEROUS_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".pif",
    ".com",
    ".vbs",
    ".js",
    ".jar",
    ".ps1",
    ".sh",
    ".app",
    ".deb",
    ".rpm",
    ".dmg",
    ".pkg",
    ".msi",
}

# MIME类型映射
MIME_TYPE_MAPPING = {
    "application/pdf": FileType.PDF,
    "application/msword": FileType.WORD,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileType.WORD,
    "application/vnd.ms-excel": FileType.EXCEL,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileType.EXCEL,
    "application/vnd.ms-powerpoint": FileType.POWERPOINT,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": FileType.POWERPOINT,
    "application/zip": FileType.ZIP,
    "application/x-rar-compressed": FileType.RAR,
    "application/json": FileType.JSON,
    "application/xml": FileType.XML,
    "text/csv": FileType.CSV,
}

# ======================== 核心工具类 ========================


class FileProcessor:
    """文件处理器 - 提供文件操作的核心功能"""

    def __init__(self, temp_dir: Optional[str] = None, max_workers: int = 4):
        """
        初始化文件处理器

        Args:
            temp_dir: 临时目录路径
            max_workers: 最大并发工作线程数
        """
        self.temp_dir = (
            Path(temp_dir) if temp_dir else Path(tempfile.gettempdir()) / "zishu_files"
        )
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.max_workers = max_workers
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def validate_file(
        self, file_path: Union[str, Path], check_content: bool = True
    ) -> Tuple[bool, List[str]]:
        """
        验证文件是否安全和有效

        Args:
            file_path: 文件路径
            check_content: 是否检查文件内容

        Returns:
            (是否有效, 错误信息列表)
        """
        errors = []
        file_path = Path(file_path)

        try:
            # 检查文件是否存在
            if not file_path.exists():
                errors.append("文件不存在")
                return False, errors

            # 检查文件大小
            file_size = file_path.stat().st_size
            if file_size > MAX_FILE_SIZE:
                errors.append(f"文件大小超过限制 ({self.format_size(MAX_FILE_SIZE)})")

            # 检查文件名
            if not FileValidator.validate_filename(file_path.name):
                errors.append("文件名包含非法字符")

            # 检查危险扩展名
            if FileValidator.is_dangerous_file(file_path.name):
                errors.append("文件类型不安全")

            # 检查文件内容
            if check_content and file_size > 0:
                mime_type = await self.detect_mime_type(file_path)
                if not mime_type:
                    errors.append("无法识别文件类型")

                # 检查文件头部是否匹配扩展名
                if not await self.verify_file_integrity(file_path, mime_type):
                    errors.append("文件内容与扩展名不匹配")

            return len(errors) == 0, errors

        except Exception as e:
            self.logger.error(f"文件验证失败: {e}")
            errors.append(f"验证过程出错: {str(e)}")
            return False, errors

    async def detect_mime_type(self, file_path: Union[str, Path]) -> str:
        """
        检测文件的MIME类型

        Args:
            file_path: 文件路径

        Returns:
            MIME类型字符串
        """
        file_path = Path(file_path)

        try:
            # 首先使用python-magic（如果可用）
            if HAS_MAGIC:
                mime = magic.Magic(mime=True)
                return mime.from_file(str(file_path))

            # 回退到mimetypes模块
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if mime_type:
                return mime_type

            # 基于文件扩展名的简单检测
            extension = file_path.suffix.lower()
            if extension in SUPPORTED_IMAGE_FORMATS:
                return f"image/{extension[1:]}"
            elif extension in SUPPORTED_VIDEO_FORMATS:
                return f"video/{extension[1:]}"
            elif extension in SUPPORTED_AUDIO_FORMATS:
                return f"audio/{extension[1:]}"

            return "application/octet-stream"

        except Exception as e:
            self.logger.error(f"MIME类型检测失败: {e}")
            return "application/octet-stream"

    async def verify_file_integrity(
        self, file_path: Union[str, Path], expected_mime: str
    ) -> bool:
        """
        验证文件完整性（检查文件头部是否匹配MIME类型）

        Args:
            file_path: 文件路径
            expected_mime: 期望的MIME类型

        Returns:
            是否匹配
        """
        file_path = Path(file_path)

        try:
            async with aiofiles.open(file_path, "rb") as f:
                header = await f.read(512)  # 读取前512字节

            # 检查常见文件格式的魔数
            if expected_mime.startswith("image/"):
                return self._check_image_header(header, expected_mime)
            elif expected_mime.startswith("video/"):
                return self._check_video_header(header, expected_mime)
            elif expected_mime.startswith("audio/"):
                return self._check_audio_header(header, expected_mime)
            elif expected_mime == "application/pdf":
                return header.startswith(b"%PDF-")
            elif expected_mime == "application/zip":
                return header.startswith(b"PK\x03\x04") or header.startswith(
                    b"PK\x05\x06"
                )

            return True  # 对于其他类型，暂时返回True

        except Exception as e:
            self.logger.error(f"文件完整性验证失败: {e}")
            return False

    def _check_image_header(self, header: bytes, mime_type: str) -> bool:
        """检查图片文件头部"""
        if mime_type == "image/jpeg":
            return header.startswith(b"\xff\xd8\xff")
        elif mime_type == "image/png":
            return header.startswith(b"\x89PNG\r\n\x1a\n")
        elif mime_type == "image/gif":
            return header.startswith(b"GIF87a") or header.startswith(b"GIF89a")
        elif mime_type == "image/bmp":
            return header.startswith(b"BM")
        elif mime_type == "image/webp":
            return b"WEBP" in header[:12]
        return True

    def _check_video_header(self, header: bytes, mime_type: str) -> bool:
        """检查视频文件头部"""
        if mime_type == "video/mp4":
            return b"ftyp" in header[:20]
        elif mime_type == "video/avi":
            return header.startswith(b"RIFF") and b"AVI " in header[:12]
        elif mime_type == "video/mkv":
            return header.startswith(b"\x1a\x45\xdf\xa3")
        return True

    def _check_audio_header(self, header: bytes, mime_type: str) -> bool:
        """检查音频文件头部"""
        if mime_type == "audio/mp3":
            return header.startswith(b"ID3") or header.startswith(b"\xff\xfb")
        elif mime_type == "audio/wav":
            return header.startswith(b"RIFF") and b"WAVE" in header[:12]
        elif mime_type == "audio/flac":
            return header.startswith(b"fLaC")
        return True

    async def calculate_file_hash(
        self, file_path: Union[str, Path], algorithm: str = "md5"
    ) -> str:
        """
        计算文件哈希值

        Args:
            file_path: 文件路径
            algorithm: 哈希算法 ('md5', 'sha1', 'sha256')

        Returns:
            哈希值字符串
        """
        file_path = Path(file_path)

        if algorithm == "md5":
            hasher = hashlib.md5()
        elif algorithm == "sha1":
            hasher = hashlib.sha1()
        elif algorithm == "sha256":
            hasher = hashlib.sha256()
        else:
            raise ValueError(f"不支持的哈希算法: {algorithm}")

        try:
            async with aiofiles.open(file_path, "rb") as f:
                while chunk := await f.read(8192):
                    hasher.update(chunk)

            return hasher.hexdigest()

        except Exception as e:
            self.logger.error(f"计算文件哈希失败: {e}")
            raise

    async def extract_metadata(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """
        提取文件元数据

        Args:
            file_path: 文件路径

        Returns:
            元数据字典
        """
        file_path = Path(file_path)
        metadata = {}

        try:
            # 基本文件信息
            stat = file_path.stat()
            metadata.update(
                {
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime),
                    "modified_at": datetime.fromtimestamp(stat.st_mtime),
                    "accessed_at": datetime.fromtimestamp(stat.st_atime),
                }
            )

            # MIME类型和文件类型
            mime_type = await self.detect_mime_type(file_path)
            file_type = FileValidator.detect_file_type(file_path.name, mime_type)

            metadata.update(
                {
                    "mime_type": mime_type,
                    "file_type": file_type,
                    "extension": file_path.suffix.lower(),
                }
            )

            # 根据文件类型提取特定元数据
            if file_type == FileType.IMAGE and HAS_PIL:
                metadata.update(await self._extract_image_metadata(file_path))
            elif file_type in [FileType.VIDEO, FileType.AUDIO] and HAS_FFMPEG:
                metadata.update(await self._extract_media_metadata(file_path))

            return metadata

        except Exception as e:
            self.logger.error(f"元数据提取失败: {e}")
            return metadata

    async def _extract_image_metadata(self, file_path: Path) -> Dict[str, Any]:
        """提取图片元数据"""
        metadata = {}

        try:
            with Image.open(file_path) as img:
                metadata.update(
                    {
                        "width": img.width,
                        "height": img.height,
                        "format": img.format,
                        "mode": img.mode,
                    }
                )

                # EXIF数据
                if hasattr(img, "_getexif") and img._getexif():
                    exif = img._getexif()
                    if exif:
                        metadata["exif"] = {
                            k: v
                            for k, v in exif.items()
                            if isinstance(v, (str, int, float))
                        }

        except Exception as e:
            self.logger.error(f"图片元数据提取失败: {e}")

        return metadata

    async def _extract_media_metadata(self, file_path: Path) -> Dict[str, Any]:
        """提取音视频元数据"""
        metadata = {}

        try:
            probe = ffmpeg.probe(str(file_path))

            # 基本信息
            if "format" in probe:
                format_info = probe["format"]
                metadata.update(
                    {
                        "duration": float(format_info.get("duration", 0)),
                        "bitrate": int(format_info.get("bit_rate", 0)),
                        "format_name": format_info.get("format_name", ""),
                    }
                )

            # 流信息
            if "streams" in probe:
                for stream in probe["streams"]:
                    if stream["codec_type"] == "video":
                        metadata.update(
                            {
                                "width": stream.get("width", 0),
                                "height": stream.get("height", 0),
                                "fps": eval(stream.get("r_frame_rate", "0/1")),
                            }
                        )
                    elif stream["codec_type"] == "audio":
                        metadata.update(
                            {
                                "sample_rate": int(stream.get("sample_rate", 0)),
                                "channels": stream.get("channels", 0),
                            }
                        )

        except Exception as e:
            self.logger.error(f"媒体元数据提取失败: {e}")

        return metadata

    async def generate_thumbnail(
        self,
        file_path: Union[str, Path],
        output_path: Union[str, Path],
        size: Tuple[int, int] = (200, 200),
    ) -> bool:
        """
        生成文件缩略图

        Args:
            file_path: 源文件路径
            output_path: 输出路径
            size: 缩略图尺寸

        Returns:
            是否成功生成
        """
        file_path = Path(file_path)
        output_path = Path(output_path)

        try:
            mime_type = await self.detect_mime_type(file_path)

            if mime_type.startswith("image/") and HAS_PIL:
                return await self._generate_image_thumbnail(
                    file_path, output_path, size
                )
            elif mime_type.startswith("video/") and HAS_FFMPEG:
                return await self._generate_video_thumbnail(
                    file_path, output_path, size
                )

            return False

        except Exception as e:
            self.logger.error(f"缩略图生成失败: {e}")
            return False

    async def _generate_image_thumbnail(
        self, file_path: Path, output_path: Path, size: Tuple[int, int]
    ) -> bool:
        """生成图片缩略图"""
        try:
            with Image.open(file_path) as img:
                # 转换为RGB模式（处理RGBA等）
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                # 生成缩略图
                img.thumbnail(size, Image.Resampling.LANCZOS)

                # 保存
                output_path.parent.mkdir(parents=True, exist_ok=True)
                img.save(output_path, "JPEG", quality=85, optimize=True)

            return True

        except Exception as e:
            self.logger.error(f"图片缩略图生成失败: {e}")
            return False

    async def _generate_video_thumbnail(
        self, file_path: Path, output_path: Path, size: Tuple[int, int]
    ) -> bool:
        """生成视频缩略图"""
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # 使用ffmpeg提取视频帧
            (
                ffmpeg.input(str(file_path), ss=1)  # 从第1秒开始
                .filter("scale", size[0], size[1])
                .output(str(output_path), vframes=1, format="image2", vcodec="mjpeg")
                .overwrite_output()
                .run(quiet=True)
            )

            return True

        except Exception as e:
            self.logger.error(f"视频缩略图生成失败: {e}")
            return False

    @staticmethod
    def format_size(size: int) -> str:
        """格式化文件大小"""
        return FileHelper.format_file_size(size)

    async def cleanup_temp_files(self, max_age_hours: int = 24):
        """
        清理临时文件

        Args:
            max_age_hours: 最大保留时间（小时）
        """
        try:
            cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

            for temp_file in self.temp_dir.rglob("*"):
                if temp_file.is_file():
                    file_time = datetime.fromtimestamp(temp_file.stat().st_mtime)
                    if file_time < cutoff_time:
                        temp_file.unlink()
                        self.logger.debug(f"删除临时文件: {temp_file}")

        except Exception as e:
            self.logger.error(f"清理临时文件失败: {e}")


# ======================== 文件操作工具函数 ========================


class FileManager:
    """文件管理器 - 提供高级文件管理功能"""

    def __init__(
        self, base_path: Union[str, Path], processor: Optional[FileProcessor] = None
    ):
        """
        初始化文件管理器

        Args:
            base_path: 基础存储路径
            processor: 文件处理器实例
        """
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.processor = processor or FileProcessor()
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def save_file(
        self,
        file_data: BinaryIO,
        filename: str,
        folder: Optional[str] = None,
        generate_unique_name: bool = True,
    ) -> Tuple[Path, FileMetadata]:
        """
        保存文件并生成元数据

        Args:
            file_data: 文件数据流
            filename: 文件名
            folder: 子文件夹
            generate_unique_name: 是否生成唯一文件名

        Returns:
            (文件路径, 文件元数据)
        """
        # 验证文件名
        safe_filename = FileValidator.generate_safe_filename(filename)

        # 生成唯一文件名
        if generate_unique_name:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = f"{name}_{uuid.uuid4().hex[:8]}{ext}"

        # 确定保存路径
        if folder:
            save_dir = self.base_path / folder
        else:
            save_dir = self.base_path
        save_dir.mkdir(parents=True, exist_ok=True)

        file_path = save_dir / safe_filename

        # 保存文件
        async with aiofiles.open(file_path, "wb") as f:
            if hasattr(file_data, "read"):
                # 处理文件对象
                while chunk := file_data.read(8192):
                    await f.write(chunk)
            else:
                # 处理字节数据
                await f.write(file_data)

        # 生成元数据
        metadata_dict = await self.processor.extract_metadata(file_path)

        # 创建FileMetadata对象
        metadata = FileMetadata(
            filename=safe_filename,
            original_filename=filename,
            size=metadata_dict.get("size", 0),
            mime_type=metadata_dict.get("mime_type", "application/octet-stream"),
            file_type=metadata_dict.get("file_type", FileType.OTHER),
            extension=metadata_dict.get("extension", ""),
            created_at=metadata_dict.get("created_at", datetime.now()),
            updated_at=metadata_dict.get("modified_at", datetime.now()),
        )

        # 添加媒体特定信息
        if "width" in metadata_dict:
            metadata.width = metadata_dict["width"]
        if "height" in metadata_dict:
            metadata.height = metadata_dict["height"]
        if "duration" in metadata_dict:
            metadata.duration = metadata_dict["duration"]
        if "bitrate" in metadata_dict:
            metadata.bitrate = metadata_dict["bitrate"]

        return file_path, metadata

    async def copy_file(
        self,
        src_path: Union[str, Path],
        dst_path: Union[str, Path],
        preserve_metadata: bool = True,
    ) -> bool:
        """
        复制文件

        Args:
            src_path: 源文件路径
            dst_path: 目标文件路径
            preserve_metadata: 是否保留元数据

        Returns:
            是否成功
        """
        try:
            src_path = Path(src_path)
            dst_path = Path(dst_path)

            # 确保目标目录存在
            dst_path.parent.mkdir(parents=True, exist_ok=True)

            # 复制文件
            if preserve_metadata:
                shutil.copy2(src_path, dst_path)
            else:
                shutil.copy(src_path, dst_path)

            self.logger.info(f"文件复制成功: {src_path} -> {dst_path}")
            return True

        except Exception as e:
            self.logger.error(f"文件复制失败: {e}")
            return False

    async def move_file(
        self, src_path: Union[str, Path], dst_path: Union[str, Path]
    ) -> bool:
        """
        移动文件

        Args:
            src_path: 源文件路径
            dst_path: 目标文件路径

        Returns:
            是否成功
        """
        try:
            src_path = Path(src_path)
            dst_path = Path(dst_path)

            # 确保目标目录存在
            dst_path.parent.mkdir(parents=True, exist_ok=True)

            # 移动文件
            shutil.move(src_path, dst_path)

            self.logger.info(f"文件移动成功: {src_path} -> {dst_path}")
            return True

        except Exception as e:
            self.logger.error(f"文件移动失败: {e}")
            return False

    async def delete_file(
        self, file_path: Union[str, Path], secure_delete: bool = False
    ) -> bool:
        """
        删除文件

        Args:
            file_path: 文件路径
            secure_delete: 是否安全删除（覆写后删除）

        Returns:
            是否成功
        """
        try:
            file_path = Path(file_path)

            if not file_path.exists():
                return True

            if secure_delete:
                # 安全删除：先用随机数据覆写
                file_size = file_path.stat().st_size
                with open(file_path, "r+b") as f:
                    for _ in range(3):  # 覆写3次
                        f.seek(0)
                        f.write(os.urandom(file_size))
                        f.flush()
                        os.fsync(f.fileno())

            # 删除文件
            file_path.unlink()

            self.logger.info(f"文件删除成功: {file_path}")
            return True

        except Exception as e:
            self.logger.error(f"文件删除失败: {e}")
            return False

    async def create_directory(
        self, dir_path: Union[str, Path], parents: bool = True
    ) -> bool:
        """
        创建目录

        Args:
            dir_path: 目录路径
            parents: 是否创建父目录

        Returns:
            是否成功
        """
        try:
            dir_path = Path(dir_path)
            dir_path.mkdir(parents=parents, exist_ok=True)

            self.logger.info(f"目录创建成功: {dir_path}")
            return True

        except Exception as e:
            self.logger.error(f"目录创建失败: {e}")
            return False

    async def list_files(
        self,
        dir_path: Union[str, Path],
        pattern: str = "*",
        recursive: bool = False,
        include_metadata: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        列出目录中的文件

        Args:
            dir_path: 目录路径
            pattern: 文件名模式
            recursive: 是否递归搜索
            include_metadata: 是否包含元数据

        Returns:
            文件信息列表
        """
        try:
            dir_path = Path(dir_path)
            files = []

            if recursive:
                file_paths = dir_path.rglob(pattern)
            else:
                file_paths = dir_path.glob(pattern)

            for file_path in file_paths:
                if file_path.is_file():
                    file_info = {
                        "name": file_path.name,
                        "path": str(file_path),
                        "size": file_path.stat().st_size,
                        "modified_at": datetime.fromtimestamp(
                            file_path.stat().st_mtime
                        ),
                    }

                    if include_metadata:
                        metadata = await self.processor.extract_metadata(file_path)
                        file_info.update(metadata)

                    files.append(file_info)

            return files

        except Exception as e:
            self.logger.error(f"文件列表获取失败: {e}")
            return []


# ======================== 分块上传工具 ========================


class ChunkedUploadManager:
    """分块上传管理器"""

    def __init__(
        self, temp_dir: Optional[str] = None, chunk_size: int = MAX_CHUNK_SIZE
    ):
        """
        初始化分块上传管理器

        Args:
            temp_dir: 临时目录
            chunk_size: 分块大小
        """
        self.temp_dir = (
            Path(temp_dir) if temp_dir else Path(tempfile.gettempdir()) / "zishu_chunks"
        )
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.chunk_size = chunk_size
        self.uploads = {}  # 存储上传会话信息
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    def create_upload_session(
        self, filename: str, total_size: int, file_hash: Optional[str] = None
    ) -> str:
        """
        创建上传会话

        Args:
            filename: 文件名
            total_size: 文件总大小
            file_hash: 文件哈希（用于验证）

        Returns:
            上传会话ID
        """
        upload_id = str(uuid.uuid4())

        self.uploads[upload_id] = {
            "filename": filename,
            "total_size": total_size,
            "file_hash": file_hash,
            "chunks_received": set(),
            "total_chunks": (total_size + self.chunk_size - 1) // self.chunk_size,
            "created_at": datetime.now(),
            "temp_dir": self.temp_dir / upload_id,
        }

        # 创建临时目录
        self.uploads[upload_id]["temp_dir"].mkdir(parents=True, exist_ok=True)

        self.logger.info(f"创建上传会话: {upload_id}, 文件: {filename}, 大小: {total_size}")
        return upload_id

    async def upload_chunk(
        self, upload_id: str, chunk_index: int, chunk_data: bytes
    ) -> bool:
        """
        上传文件分块

        Args:
            upload_id: 上传会话ID
            chunk_index: 分块索引
            chunk_data: 分块数据

        Returns:
            是否成功
        """
        if upload_id not in self.uploads:
            raise ValueError(f"上传会话不存在: {upload_id}")

        upload_info = self.uploads[upload_id]

        try:
            # 保存分块
            chunk_path = upload_info["temp_dir"] / f"chunk_{chunk_index:06d}"
            async with aiofiles.open(chunk_path, "wb") as f:
                await f.write(chunk_data)

            # 记录已接收的分块
            upload_info["chunks_received"].add(chunk_index)

            self.logger.debug(f"分块上传成功: {upload_id}, 分块: {chunk_index}")
            return True

        except Exception as e:
            self.logger.error(f"分块上传失败: {e}")
            return False

    async def complete_upload(
        self, upload_id: str, output_path: Union[str, Path]
    ) -> bool:
        """
        完成分块上传，合并所有分块

        Args:
            upload_id: 上传会话ID
            output_path: 输出文件路径

        Returns:
            是否成功
        """
        if upload_id not in self.uploads:
            raise ValueError(f"上传会话不存在: {upload_id}")

        upload_info = self.uploads[upload_id]

        try:
            # 检查是否所有分块都已接收
            expected_chunks = set(range(upload_info["total_chunks"]))
            if upload_info["chunks_received"] != expected_chunks:
                missing_chunks = expected_chunks - upload_info["chunks_received"]
                raise ValueError(f"缺少分块: {missing_chunks}")

            # 合并分块
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            async with aiofiles.open(output_path, "wb") as output_file:
                for chunk_index in range(upload_info["total_chunks"]):
                    chunk_path = upload_info["temp_dir"] / f"chunk_{chunk_index:06d}"
                    async with aiofiles.open(chunk_path, "rb") as chunk_file:
                        chunk_data = await chunk_file.read()
                        await output_file.write(chunk_data)

            # 验证文件大小
            actual_size = output_path.stat().st_size
            if actual_size != upload_info["total_size"]:
                raise ValueError(
                    f"文件大小不匹配: 期望 {upload_info['total_size']}, 实际 {actual_size}"
                )

            # 验证文件哈希（如果提供）
            if upload_info["file_hash"]:
                processor = FileProcessor()
                actual_hash = await processor.calculate_file_hash(output_path, "md5")
                if actual_hash != upload_info["file_hash"]:
                    raise ValueError(
                        f"文件哈希不匹配: 期望 {upload_info['file_hash']}, 实际 {actual_hash}"
                    )

            # 清理临时文件
            await self._cleanup_upload_session(upload_id)

            self.logger.info(f"分块上传完成: {upload_id}, 输出: {output_path}")
            return True

        except Exception as e:
            self.logger.error(f"分块上传完成失败: {e}")
            return False

    async def _cleanup_upload_session(self, upload_id: str):
        """清理上传会话的临时文件"""
        if upload_id in self.uploads:
            temp_dir = self.uploads[upload_id]["temp_dir"]
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
            del self.uploads[upload_id]

    def get_upload_progress(self, upload_id: str) -> Dict[str, Any]:
        """
        获取上传进度

        Args:
            upload_id: 上传会话ID

        Returns:
            进度信息
        """
        if upload_id not in self.uploads:
            raise ValueError(f"上传会话不存在: {upload_id}")

        upload_info = self.uploads[upload_id]

        return {
            "upload_id": upload_id,
            "filename": upload_info["filename"],
            "total_size": upload_info["total_size"],
            "total_chunks": upload_info["total_chunks"],
            "chunks_received": len(upload_info["chunks_received"]),
            "progress": len(upload_info["chunks_received"])
            / upload_info["total_chunks"],
            "created_at": upload_info["created_at"],
        }

    async def cleanup_expired_sessions(self, max_age_hours: int = 24):
        """清理过期的上传会话"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

        expired_sessions = [
            upload_id
            for upload_id, info in self.uploads.items()
            if info["created_at"] < cutoff_time
        ]

        for upload_id in expired_sessions:
            await self._cleanup_upload_session(upload_id)
            self.logger.info(f"清理过期上传会话: {upload_id}")


# ======================== 便捷函数 ========================


async def validate_uploaded_file(
    file_path: Union[str, Path], max_size: Optional[int] = None
) -> Tuple[bool, List[str]]:
    """
    验证上传的文件

    Args:
        file_path: 文件路径
        max_size: 最大文件大小限制

    Returns:
        (是否有效, 错误信息列表)
    """
    processor = FileProcessor()

    # 基本验证
    is_valid, errors = await processor.validate_file(file_path)

    # 额外的大小检查
    if max_size and Path(file_path).stat().st_size > max_size:
        errors.append(f"文件大小超过限制 ({FileHelper.format_file_size(max_size)})")
        is_valid = False

    return is_valid, errors


async def get_file_info(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    获取文件完整信息

    Args:
        file_path: 文件路径

    Returns:
        文件信息字典
    """
    processor = FileProcessor()

    # 基本信息
    file_path = Path(file_path)
    stat = file_path.stat()

    info = {
        "name": file_path.name,
        "path": str(file_path),
        "size": stat.st_size,
        "size_formatted": FileHelper.format_file_size(stat.st_size),
        "created_at": datetime.fromtimestamp(stat.st_ctime),
        "modified_at": datetime.fromtimestamp(stat.st_mtime),
        "accessed_at": datetime.fromtimestamp(stat.st_atime),
    }

    # 元数据
    metadata = await processor.extract_metadata(file_path)
    info.update(metadata)

    # 哈希值
    try:
        info["md5_hash"] = await processor.calculate_file_hash(file_path, "md5")
        info["sha256_hash"] = await processor.calculate_file_hash(file_path, "sha256")
    except Exception as e:
        logger.error(f"计算文件哈希失败: {e}")

    return info


def create_safe_filename(filename: str, max_length: int = 255) -> str:
    """
    创建安全的文件名

    Args:
        filename: 原始文件名
        max_length: 最大长度

    Returns:
        安全的文件名
    """
    return FileValidator.generate_safe_filename(filename)


def detect_file_type_from_content(content: bytes, filename: str = "") -> FileType:
    """
    从文件内容检测文件类型

    Args:
        content: 文件内容（前几个字节）
        filename: 文件名（可选）

    Returns:
        文件类型
    """
    # 检查文件头部魔数
    if content.startswith(b"\xff\xd8\xff"):
        return FileType.IMAGE
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        return FileType.IMAGE
    elif content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return FileType.IMAGE
    elif content.startswith(b"%PDF-"):
        return FileType.PDF
    elif content.startswith(b"PK\x03\x04") or content.startswith(b"PK\x05\x06"):
        return FileType.ZIP
    elif b"ftyp" in content[:20]:
        return FileType.VIDEO
    elif content.startswith(b"ID3") or content.startswith(b"\xff\xfb"):
        return FileType.AUDIO

    # 回退到基于文件名的检测
    if filename:
        return FileValidator.detect_file_type(filename)

    return FileType.UNKNOWN


# ======================== 导出的主要接口 ========================

__all__ = [
    "FileProcessor",
    "FileManager",
    "ChunkedUploadManager",
    "validate_uploaded_file",
    "get_file_info",
    "create_safe_filename",
    "detect_file_type_from_content",
    "MAX_FILE_SIZE",
    "MAX_CHUNK_SIZE",
    "SUPPORTED_IMAGE_FORMATS",
    "SUPPORTED_VIDEO_FORMATS",
    "SUPPORTED_AUDIO_FORMATS",
    "DANGEROUS_EXTENSIONS",
]

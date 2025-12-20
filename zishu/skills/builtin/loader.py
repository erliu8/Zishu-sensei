"""内置技能 manifest 加载器"""

from pathlib import Path
from typing import Optional
import json
import logging

from ..schemas import SkillManifest

logger = logging.getLogger(__name__)

# 缓存已加载的 manifest
_manifest_cache: dict[str, SkillManifest] = {}


async def load_builtin_manifest(package_id: str) -> SkillManifest:
    """
    加载内置技能的 manifest

    Args:
        package_id: 技能包 ID，必须以 'skill.builtin.' 开头

    Returns:
        SkillManifest: 技能 manifest 对象

    Raises:
        FileNotFoundError: manifest 文件不存在
        ValueError: manifest 格式错误
    """
    # 检查缓存
    if package_id in _manifest_cache:
        return _manifest_cache[package_id]

    # 验证 package_id
    if not package_id.startswith("skill.builtin."):
        raise ValueError(f"Invalid builtin package_id: {package_id}")

    # 构建文件路径
    manifest_path = Path(__file__).parent / f"{package_id}.json"

    if not manifest_path.exists():
        raise FileNotFoundError(f"Builtin manifest not found: {manifest_path}")

    try:
        # 加载 JSON
        with open(manifest_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 验证并创建 SkillManifest
        manifest = SkillManifest(**data)

        # 缓存结果
        _manifest_cache[package_id] = manifest

        logger.info(f"Loaded builtin manifest: {package_id}")
        return manifest

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in manifest {manifest_path}: {e}")
        raise ValueError(f"Invalid JSON in manifest: {e}")
    except Exception as e:
        logger.error(f"Failed to load manifest {manifest_path}: {e}")
        raise


def clear_manifest_cache() -> None:
    """清除 manifest 缓存"""
    global _manifest_cache
    _manifest_cache.clear()
    logger.info("Manifest cache cleared")


def get_cached_manifests() -> list[str]:
    """获取已缓存的 manifest 列表"""
    return list(_manifest_cache.keys())
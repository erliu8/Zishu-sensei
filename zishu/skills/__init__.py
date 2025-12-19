"""
Zishu 技能包系统

提供技能包清单的定义和验证功能。
"""

from .schemas import SkillManifest, validate_manifest

__all__ = ["SkillManifest", "validate_manifest"]
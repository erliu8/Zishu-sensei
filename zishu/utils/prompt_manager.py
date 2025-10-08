#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import logging
from typing import Dict, Any, Optional, List, Tuple, Union
from pathlib import Path
from string import Template
import re


class PromptTemplate:
    """提示模板类,用于管理格式化单个提示模板"""

    def __init__(self, template_str: str, template_id: str = None):
        """初始化提示模板

        Args:
            template (str): 提示模板字符串
            template_id (str): 模板id,用于唯一标识模板
        """
        self.template_str = template_str
        self.template_id = template_id
        self.template = Template(template_str)

    def format(self, **kwargs) -> str:
        """格式化提示模板

        Args:
            **kwargs: 替换模板中的变量

        Returns:
            格式化后的提示模板字符串
        """
        try:
            return self.template.safe_substitute(**kwargs)
        except Exception as e:
            raise ValueError(f"格式化提示模板失败: {e}")
            return self.template_str

    def __str__(self) -> str:
        """返回提示模板字符串"""
        return self.template_str


class PromptManager:
    """提示管理类,负责加载、管理和应用提示模板"""

    def __init__(self, template_dir: Union[str, Path] = None):
        """初始化提示管理器

        Args:
            template_dir (Union[str,Path]): 提示模板目录路径

        """
        self.template_dir = Path(template_dir or "./configs/prompts")
        self.templates: Dict[str, PromptTemplate] = {}
        self.character_templates: Dict[str, Dict[str, PromptTemplate]] = {}
        self.logger = logging.getLogger(__name__)

        # 确保模板目录存在
        os.makedirs(self.template_dir, exist_ok=True)

        # 加载所有提示模板
        self._load_system_templates()

    def _load_system_templates(self):
        """加载系统提示模板"""
        system_path = self.template_dir / "system"
        if system_path.exists():
            for file_path in system_path.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        template_data = json.load(f)

                        for template_id, template_str in template_data.items():
                            self.templates[template_id] = PromptTemplate(
                                template_str, template_id
                            )

                        self.logger.info(f"成功加载系统提示模板: {file_path}")
                except Exception as e:
                    self.logger.error(f"加载系统提示模板失败: {e}")

    def load_character_templates(self, character_id: str) -> None:
        """
        加载角色提示模板

        Args:

            character_id (str): 角色id

        Returns:
            None
        """
        character_path = self.template_dir / "characters" / character_id
        if not character_path.exists():
            self.logger.warning(f"角色提示模板目录不存在: {character_path}")
            return
        self.character_templates[character_id] = {}

        for file_path in character_path.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    template_data = json.load(f)

                    for template_id, template_str in template_data.items():
                        self.character_templates[character_id][
                            template_id
                        ] = PromptTemplate(
                            template_str, f"{character_id}.{template_id}"
                        )

                    self.logger.info(f"成功加载角色{character_id}提示模板: {file_path.name}")
            except Exception as e:
                self.logger.error(f"加载角色{character_id}提示模板失败{file_path}: {e}")

    def get_template(
        self, template_id: str, character_id: Optional[str] = None
    ) -> Optional[PromptTemplate]:
        """
        获取提示模板

        Args:
            template_id (str): 模板id
            character_id (Optional[str]): 角色id

        Returns:
            Optional[PromptTemplate]: 提示模板
        """
        # 优先从角色模板中查找
        if character_id and character_id in self.character_templates:
            if template_id in self.character_templates[character_id]:
                return self.character_templates[character_id][template_id]

        # 如果角色模板中没有找到,则从系统模板中查找
        if template_id in self.templates:
            return self.templates[template_id]

        self.logger.warning(f"未找到模板: {template_id}")
        return None

    def format_prompt(
        self,
        template_id: str,
        template_str: str,
        character_id: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        格式化提示模板

        Args:
            template_id (str): 模板id
            template_str (str): 模板字符串
            character_id (Optional[str]): 角色id
            **kwargs: 替换模板中的变量

        Returns:
            str: 格式化后的提示模板字符串
        """
        template = self.get_template(template_id, character_id)
        if template:
            return template.format(**kwargs)
        return ""

    def save_template(
        self, template_id: str, character_id: Optional[str] = None
    ) -> bool:
        """
        保存提示模板

        Args:
            template_id (str): 模板id
            character_id (Optional[str]): 角色id

        Returns:
            bool: 是否保存成功
        """
        try:
            if character_id:
                if (
                    character_id not in self.character_templates
                    or template_id not in self.character_templates[character_id]
                ):
                    self.logger.warning(f"角色{character_id}不存在或模板{template_id}不存在")
                    return False
                template = self.character_templates[character_id][template_id]
                save_dir = self.template_dir / "characters" / character_id
                os.makedirs(save_dir, exist_ok=True)
                save_path = save_dir / "cumstom.json"

                # 加载现有数据或创建数据
                data = {}
                if save_path.exists():
                    with open(save_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                # 更新数据
                data[template_id] = template.template_str

                # 保存数据
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.logger.info(f"成功保存角色{character_id}提示模板: {save_path}")

            else:
                if template_id not in self.templates:
                    self.logger.warning(f"系统模板{template_id}不存在")
                    return False
                template = self.templates[template_id]
                save_dir = self.template_dir / "system"
                os.makedirs(save_dir, exist_ok=True)
                save_path = save_dir / "cumstom.json"

                # 加载现有数据或创建数据
                data = {}
                if save_path.exists():
                    with open(save_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                data[template_id] = template.template_str

                # 保存数据
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.logger.info(f"成功保存系统提示模板: {save_path}")
            return True
        except Exception as e:
            self.logger.error(f"保存提示模板失败: {e}")
            return False


class MultimodelPromptManager(PromptManager):
    """多模型提示管理类,支持多教师蒸馏架构"""

    def __init__(self, template_dir: Union[str, Path] = None):
        """初始化多模型提示管理器

        Args:
            template_dir (Union[str,Path]): 提示模板目录路径
        """
        super().__init__(template_dir)
        self.model_templates: Dict[str, Dict[str, PromptTemplate]] = {}

        # 加载模型特定提示模板
        self._load_model_templates()

    def _load_model_templates(self):
        """加载模型特定提示模板"""
        models_path = self.template_dir / "models"
        if not models_path.exists():
            for model_dir in models_path.iterdir():
                if model_dir.is_dir():
                    model_id = model_dir.name
                    self.model_templates[model_id] = {}

                    for file_path in model_dir.glob("*.json"):
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                template_data = json.load(f)

                                for template_id, template_str in template_data.items():
                                    self.model_templates[model_id][
                                        template_id
                                    ] = PromptTemplate(
                                        template_str, f"{model_id}.{template_id}"
                                    )

                                    self.logger.info(
                                        f"成功加载模型{model_id}提示模板: {file_path.name}"
                                    )
                        except Exception as e:
                            self.logger.error(f"加载模型{model_id}提示模板失败: {e}")
        else:
            self.logger.warning(f"模型提示模板目录不存在: {models_path}")

    def get_model_template(
        self, model_id: str, template_id: str
    ) -> Optional[PromptTemplate]:
        """获取模型特定提示模板

        Args:
            model_id (str): 模型id
            template_id (str): 模板id

        Returns:
            Optional[PromptTemplate]: 模型特定提示模板
        """
        if model_id in self.model_templates:
            if template_id in self.model_templates[model_id]:
                return self.model_templates[model_id][template_id]
        return None

    def format_prompt(self, template_id: str, model_id: str, **kwargs) -> str:
        """
        格式化模型特定提示模板

        Args:
            template_id (str): 模板id
            model_id (str): 模型id
            **kwargs: 替换模板中的变量

        Returns:
            str: 格式化后的提示模板字符串
        """
        # 优先从模型特定提示模板中查找
        template = self.get_model_template(model_id, template_id)
        if template:
            return template.format(**kwargs)
        # 回退到系统提示模板
        return self.format_prompt(template_id, **kwargs)

    def format_for_teacher_ensemble(
        self, template_id: str, teacher_ids: List[str], **kwargs
    ) -> Dict[str, str]:
        """
        格式化多教师蒸馏提示模板

        Args:
            template_id (str): 模板id
            teacher_ids (List[str]): 教师id列表
            **kwargs: 替换模板中的变量

        Returns:
            Dict[str,str]: 教师id到提示模板的映射
        """
        result = {}
        for teacher_id in teacher_ids:
            result[teacher_id] = self.format_for_model(
                template_id, teacher_id, **kwargs
            )
        return result

    def get_distillation_prompts(
        self, phase: str, task: str, **kwargs
    ) -> Dict[str, Dict[str, str]]:
        """获取蒸馏提示模板

        Args:
            phase (str): 蒸馏阶段
            task (str): 蒸馏任务
            **kwargs: 替换模板中的变量

        Returns:
            Dict[str,Dict[str,str]]: 蒸馏阶段到蒸馏任务到提示模板的映射
        """
        # 加载蒸馏配置
        try:
            config_path = Path(f"./config/distillation/{phase}.json")
            if not config_path.exists():
                self.logger.warning(f"蒸馏配置文件不存在: {config_path}")
                return {}

            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            teachers = config.get("teachers", [])
            student = config.get("target_student")

            # 获取教师提示
            teacher_prompts = {}
            for teacher in teachers:
                template = self.get_model_template(teacher, f"{task}_prompt")
                if template:
                    teacher_prompts[teacher] = template.format(**kwargs)
                else:
                    fallback = self.get_template(f"{task}_prompt")
                    if fallback:
                        teacher_prompts[teacher] = fallback.format(**kwargs)
                    else:
                        self.logger.warning(f"未找到教师{teacher}的提示模板")

            # 获取学生提示
            student_prompt = ""
            student_template = self.get_model_template(student, f"{task}_prompt")
            if student_template:
                student_prompt = student_template.format(**kwargs)
            else:
                # 回退到系统提示模板
                fallback = self.get_template(f"{task}_prompt")
                if fallback:
                    student_prompt = fallback.format(**kwargs)
                else:
                    self.logger.warning(f"未找到学生{student}的提示模板")

            return {
                "teacher_prompts": teacher_prompts,
                "student_prompt": {student: student_prompt},
            }
        except Exception as e:
            self.logger.error(f"获取蒸馏提示模板失败: {e}")
            return {}

    def create_character_system_prompt(self, character_id: str, **kwargs) -> str:
        """
        创建角色系统提示

        Args:
            character_id (str): 角色id
            **kwargs: 替换模板中的变量

        Returns:
            str: 角色系统提示
        """
        try:
            # 加载角色配置
            char_config_path = Path(f"./config/characters/{character_id}.json")
            if not char_config_path.exists():
                self.logger.warning(f"角色配置文件不存在: {char_config_path}")
                return ""

            with open(char_config_path, "r", encoding="utf-8") as f:
                char_config = json.load(f)

            # 获取角色系统提示
            template = self.get_template("character_system", character_id)
            if not template:
                self.logger.warning(f"未找到角色{character_id}的系统提示模板,使用默认模板")
                template_str = (
                    "你是${name},一个${description}。\n"
                    "你的年龄是${age}。\n"
                    "你的性格是${personality}。\n"
                    "你的背景是${background}。\n"
                    "你的对话风格是${speak_style}。\n"
                    "兴趣爱好是${interests}。\n"
                    "请始终保持角色设定，用${gender}的口吻回答。\n"
                )
                template = PromptTemplate(template_str)

            # 格式化模板
            name = char_config.get("name", "Zishu-sensei")
            description = char_config.get("description", "二次元风格的虚拟老师")
            persona = char_config.get("persona", {})
            appearance = char_config.get("appearance", {})
            age = char_config.get("age", 20)

            return template.format(
                name=name,
                age=age,
                description=description,
                role=persona.get("role", "老师"),
                personality=persona.get("personality", "冷漠"),
                background=persona.get("background", "未知"),
                interests=persona.get("interests", "看书"),
                speak_style=persona.get("speak_style", "平淡"),
                gender=appearance.get("gender", "女"),
            )
        except Exception as e:
            self.logger.error(f"创建角色系统提示失败: {e}")
            return f"你是Zishu-sensei,一个二次元风格的虚拟老师。"


# 全局提示管理器实例
_prompt_manager = None


def get_prompt_manager() -> MultimodelPromptManager:
    """获取提示管理器实例"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = MultimodelPromptManager()
    return _prompt_manager

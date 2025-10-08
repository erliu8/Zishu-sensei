#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/12 14:00
# @Author  : erliu
# @File    : __init__.py
# @Software: PyCharm

from .teacher import (
    TeacherModelManager,
    CoreTeacherManager,
    SpecialistTeacherManager,
    SpecialFunctionTeacherManager,
)
from .student import (
    StudentModel,
    BaseStudentModel,
    EnhancedStudentModel,
    CompleteStudentModel,
)
from .trainer import (
    DistillationTrainer,
    CoreDistillationTrainer,
    SpecialDistillationTrainer,
    FunctionDistillationTrainer,
)
from .losses import (
    KnowledgeDistillationLoss,
    ResponseDistillationLoss,
    FeatureDistillationLoss,
    TaskSpecificLoss,
)
from .router import ModelRouter, DynamicRouter

__all__ = [
    # 教师模型管理
    "TeacherModelManager",
    "CoreTeacherManager",
    "SpecialistTeacherManager",
    "SpecialFunctionTeacherManager",
    # 学生模型
    "StudentModel",
    "BaseStudentModel",
    "EnhancedStudentModel",
    "CompleteStudentModel",
    # 蒸馏训练器
    "DistillationTrainer",
    "CoreDistillationTrainer",
    "SpecialDistillationTrainer",
    "FunctionDistillationTrainer",
    # 损失函数
    "KnowledgeDistillationLoss",
    "ResponseDistillationLoss",
    "FeatureDistillationLoss",
    "TaskSpecificLoss",
    # 路由系统
    "ModelRouter",
    "DynamicRouter",
]

# ！/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/15 10:00
# @Author  : erliu
# @File    : evaluation.py
# @Software: PyCharm

import os
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple, Union
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from tqdm import tqdm
from collections import defaultdict

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import load_dataset, Dataset
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

from .base import ModelManager
from .lora import LoraManager
from ..utils.performance import get_performance_monitor
from ..utils.thread_factory import get_thread_factory


class EvaluationManager(ModelManager):
    """模型评估管理类,负责模型评估和性能分析"""

    def __init__(
        self,
        model_manager: Union[ModelManager, LoraManager],
        eval_config_path: Optional[Union[str, Path]] = None,
    ):
        """
        初始化评估管理器

        Args:
            model_manager (Union[ModelManager,LoraManager]): 模型管理器实例
            eval_config (Optional[Union[str,Path]], optional): 评估配置文件路径. Defaults to None.
        """
        self.model_manager = model_manager
        self.logger = logging.getLogger(__name__)
        self.performance_monitor = get_performance_monitor()

        # 加载评估配置
        self.eval_config_path = (
            Path(eval_config_path) or "./config/evaluation_config.json"
        )
        try:
            if self.eval_config_path.exists():
                with open(self.eval_config_path, "r", encoding="utf-8") as f:
                    self.eval_config = json.load(f)

            else:
                self.logger.warning(f"评估配置文件: {self.eval_config_path}不存在,使用默认配置")
                self.eval_config = self._get_default_eval_config()
        except Exception as e:
            self.logger.error(f"评估配置文件加载失败: {e}")
            self.eval_config = self._get_default_eval_config()

        # 确保输出目录存在
        self.eval_output_dir = Path(
            self.eval_config.get("output_dir", "/data/evaluation")
        )
        os.makedirs(self.eval_output_dir, exist_ok=True)

    def _get_default_eval_config(self) -> Dict[str, Any]:
        """获取默认评估配置"""
        return {
            "output_dir": "/data/evaluation",
            "metrics": [
                "preplexity",
                "accuracy",
                "character_consistency",
                "cultural_knowledge",
            ],
            "datasets": {
                "general": "./data/evaluation/general_eval.json",
                "chinese": "./data/evaluation/chinese_eval.json",
                "roleplay": "./data/evaluation/roleplay_eval.json",
                "culture": "./data/evaluation/culture_eval.json",
            },
            "batch_size": 8,
            "max_length": 512,
            "character_consistency": {"persona_key_points": [" "]},
            "threshold": {
                "preplexity": 10.0,
                "accuracy": 0.7,
                "character_consistency": 0.8,
                "cultural_knowledge": 0.75,
            },
        }

    def prepare_dataset(
        self, dataset_path: Union[str, Path], split: str = "validation"
    ) -> Dataset:
        """
        准备评估数据集

        Args:
            dataset_path (Union[str,Path]): 数据集文件路径
            split (str, optional): 数据集分割方式. Defaults to "validation".

        Returns:
            Dataset: 评估数据集
        """
        try:
            dataset_path = Path(dataset_path)
            if not dataset_path.exists():
                raise FileNotFoundError(f"数据集文件不存在: {dataset_path}")

            # 根据文件扩展名确定数据格式
            extension = dataset_path.suffix.lower()
            if extension == ".json":
                # 加载json文件
                dataset = load_dataset(
                    "json", data_files={split: str(dataset_path)}, split=split
                )
            elif extension == ".csv":
                # 加载csv文件
                dataset = load_dataset(
                    "csv", data_files={split: str(dataset_path)}, split=split
                )
            elif extension == ".txt":
                # 加载txt文件
                dataset = load_dataset(
                    "text", data_files={split: str(dataset_path)}, split=split
                )
            else:
                raise ValueError(f"不支持的数据集格式: {extension}")

            self.logger.info(f"数据集{dataset_path}加载成功,包含{len(dataset)}条数据")
            return dataset
        except Exception as e:
            self.logger.error(f"数据集加载失败: {e}")
            raise RuntimeError(f"数据集加载失败: {e}")

    def evaluate_perplexity(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估困惑度

        Args:
            dataset (Dataset): 评估数据集

        Returns:
            Dict[str,float]: 评估结果

        """
        self.logger.info("开始评估困惑度...")
        model = self.model_manager.load_model()
        tokenizer = self.model_manager.load_tokenizer()

        total_loss = 0.0
        total_length = 0

        try:
            for sample in tqdm(dataset, desc="评估困惑度"):
                input_text = sample["prompt"]
                target_text = sample["response", ""]

                # 跳过没有目标文本的样本
                if not target_text:
                    continue

                # 编码输入和目标
                inputs = tokenizer(input_text, return_tensors="pt").to(model.device)
                targets = tokenizer(target_text, return_tensors="pt").to(model.device)

                # 计算损失
                with torch.no_grad():
                    outputs = model(**inputs, labels=targets.input_ids)
                    loss = outputs.loss.item()

                # 累加损失和长度
                total_loss += loss * targets.input_ids.size()
                total_length += targets.input_ids.size(1)

            # 计算平均困惑度
            avg_loss = total_loss / total_length if total_length > 0 else float("inf")
            preplexity = torch.exp(torch.tensor(avg_loss)).item()

            result = {
                "perplexity": preplexity,
                "avg_loss": avg_loss,
                "samples": len(dataset),
                "threshold": self.eval_config["threshold"]["preplexity"],
                "passed": preplexity < self.eval_config["threshold"]["preplexity"],
            }

            self.logger.info(f"困惑度评估结果:preplexity={preplexity:.4f}")
            return result
        except Exception as e:
            self.logger.error(f"困惑度评估失败: {e}")
            return {"perplexity": float("inf"), "error": str(e), "passed": False}

    def evaluate_accuracy(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估准确率

        Args:
            dataset (Dataset): 评估数据集,需要包含"prompt"和"response"和"correct_answer"字段

        Returns:
            Dict[str,float]: 评估结果
        """
        self.logger.info("开始评估准确率...")

        # 检查数据集字段
        required_fields = ["prompt", "correct_answer"]
        if not all(field in dataset.column_names for field in required_fields):
            missing = [f for f in required_fields if f not in dataset.column_names]
            self.logger.error("数据集缺少必要的字段:{missing}")
            return {"accuracy": 0.0, "error": f"数据集缺少必要的字段:{missing}", "passed": False}

        predictions = []
        references = []

        try:
            for sample in tqdm(dataset, desc="评估准确率"):
                prompt = sample["prompt"]
                correct_answer = sample["correct_answer"]

                # 生成回答
                try:
                    prediction = self.model_manager.generate(prompt)
                    predictions.append(prediction)
                    references.append(correct_answer)
                except Exception as e:
                    self.logger.error(f"生成回答失败: {e}")
                    continue

            # 简单字符串匹配准确率(实际应用中需要更复杂的评估算法)
            exact_matches = sum(
                1 for p, r in zip(predictions, references) if p.strip() == r.strip()
            )
            accuracy = exact_matches / len(predictions) if predictions else 0.0

            result = {
                "accuracy": accuracy,
                "samples": len(predictions),
                "exact_matches": exact_matches,
                "threshold": self.eval_config["threshold"]["accuracy"],
                "passed": accuracy >= self.eval_config["threshold"]["accuracy"],
            }

            self.logger.info(f"准确率评估结果:accuracy={accuracy:.4f}")
            return result

        except Exception as e:
            self.logger.error(f"准确率评估失败: {e}")
            return {"accuracy": 0.0, "error": str(e), "passed": False}

    def evaluate_character_consistency(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估角色一致性

        Args:
            dataset (Dataset): 评估数据集,需要包含"prompt"和"response"字段

        Returns:
            Dict[str,float]: 评估结果
        """
        self.logger.info("开始评估角色一致性...")

        persona_key_points = self.eval_config.get("character_consistency", {}).get(
            "persona_key_points", []
        )
        if not persona_key_points:
            self.logger.warning("未配置角色特征关键点，无法评估角色一致性")
            return {
                "character_consistency": 0.0,
                "error": "未配置角色特征关键点",
                "passed": False,
            }

        consistency_scores = []

        try:
            for sample in tqdm(dataset, desc="评估角色一致性"):
                prompt = sample["prompts"]

                # 生成回答
                try:
                    response = self.model_manager.generate(prompt)

                    # 计算回答与角色特征的相符程度
                    point_matches = []
                    for point in persona_key_points:
                        # 这里用简单的关键词匹配，实际应用可能需要复杂的语文匹配
                        keywords = point.lower().split()
                        match_score = sum(
                            1 for kw in keywords if kw.lower() in response.lower()
                        ) / len(keywords)
                        point_matches.append(match_score)

                    # 计算整体一致性分数
                    consistency_score = (
                        sum(point_matches) / len(point_matches)
                        if point_matches
                        else 0.0
                    )
                    consistency_scores.append(match_score)

                except Exception as e:
                    self.logger.error(f"生成回答失败: {e}")
                    continue

            # 计算平均一致性分数
            avg_consistency = (
                sum(consistency_scores) / len(consistency_scores)
                if consistency_scores
                else 0.0
            )

            result = {
                "character_consistency": avg_consistency,
                "samples": len(consistency_scores),
                "threshold": self.eval_config["thresholds"]["character_consistency"],
                "passed": avg_consistency
                >= self.eval_config["thresholds"]["character_consistency"],
            }
            self.logger.info(f"角色一致性评估完成:consistency={avg_consistency:.4f}")
            return result

        except Exception as e:
            self.logger.error(f"角色一致性评估失败: {e}")
            return {"character_consistency": 0.0, "error": str(e), "passed": False}

    def evaluate_anime_terminology(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估模型对二次元术语的理解

        Args:
            dataset (Dataset): 评估数据集,需要包含"prompt"和"response"字段，二次元术语相关的问题和标准答案

        Returns:
            Dict[str,float]: 评估结果
        """
        self.logger.info("开始评估二次元术语理解...")

        required_fields = ["prompt", "correct_answer", "term_category"]
        if not all(field in dataset.column_names for field in required_fields):
            missing = [f for f in required_fields if f not in dataset.column_names]
            self.logger.error(f"数据集缺少必要的字段:{missing}")
            return {
                "anime_terminology": 0.0,
                "error": f"数据集缺少必要的字段:{missing}",
                "passed": False,
            }

        category_scores = defaultdict(list)

        try:
            for sample in tqdm(dataset, desc="评估二次元术语"):
                prompt = sample["prompt"]
                correct_answer = sample["correct_answer"]
                category = sample["term_category"]  # 如萌系用语、技术术语、作品专有名词等

                # 生成回答
                try:
                    prediction = self.model_manager.generate(prompt)

                    # 术语理解正确性评估
                    # 可以使用更复杂的匹配方法，如语义相似度、关键词匹配等
                    is_correct = self.check_term_correctness(prediction, correct_answer)
                    category_scores[category].append(1.0 if is_correct else 0.0)
                except Exception as e:
                    self.logger.error(f"生成回答失败: {e}")
                    continue

            # 计算每个类别得分
            category_results = {}
            for category, scores in category_scores.items():
                avg_score = sum(scores) / len(scores) if scores else 0.0
                category_results[category] = avg_score

            # 计算总体得分
            all_scores = [s for scores in category_scores.values() for s in scores]
            overall_score = sum(all_scores) / len(all_scores) if all_scores else 0.0

            threshold = self.eval_config.get("threshold", {}).get(
                "anime_terminology", 0.7
            )

            result = {
                "anime_terminology": overall_score,
                "category_results": category_results,
                "samples": len(all_scores),
                "threshold": threshold,
                "passed": overall_score >= threshold,
            }

            self.logger.info(f"二次元术语理解评估完成:overall_score={overall_score:.4f}")
            return result

        except Exception as e:
            self.logger.error(f"二次元术语理解评估失败: {e}")
            return {"anime_terminology": 0.0, "error": str(e), "passed": False}

    def check_term_accuracy(self, prediction: str, correct_answer: str) -> bool:
        """
        检查术语理解正确性

        Args:
            prediction (str): 预测回答
            correct_answer (str): 标准答案

        Returns:
            bool: 是否正确
        """
        # 可以实现更复杂的匹配方法，如语义相似度、关键词匹配等
        prediction_lower = prediction.lower()
        correct_tokens = correct_answer.lower().split()

        # 计算正确标记的覆盖率
        covered = sum(1 for token in correct_tokens if token in prediction_lower)
        coverage = covered / len(correct_tokens) if correct_tokens else 0

        return coverage >= 0.7  # 70%的正确标记覆盖率

    def evaluate_anime_expression(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估模型对二次元表达的理解和生成能力

        Args:
            dataset (Dataset): 评估数据集,需要包含"prompt"和"response"字段，二次元表达相关的问题和标准答案

        Returns:
            Dict[str,float]: 评估结果

        """
        self.logger.info("开始评估二次元表达理解...")

        required_fields = ["prompt", "reference_style", "style_category"]
        if not all(field in dataset.column_names for field in required_fields):
            missing = [f for f in required_fields if f not in dataset.column_names]
            self.logger.error(f"数据集缺少必要的字段:{missing}")
            return {
                "anime_expression": 0.0,
                "error": f"数据集缺少必要的字段:{missing}",
                "passed": False,
            }

        category_scores = defaultdict(list)

        try:
            for sample in tqdm(dataset, desc="评估二次元表达"):
                prompt = sample["prompt"]
                reference_style = sample["reference_style"]
                category = sample["style_category"]  # 如萌系用语、中二台词、角色口头禅等

                # 生成回答
                try:
                    response = self.model_manager.generate(prompt)

                    # 评估表达方式的符合程度
                    style_score = self.evaluate_expression_style(
                        response, reference_style, category
                    )
                    category_scores[category].append(style_score)

                except Exception as e:
                    self.logger.error(f"生成回答失败: {e}")
                    continue

            # 计算每个类别得分
            category_results = {}
            for category, scores in category_scores.items():
                avg_score = sum(scores) / len(scores) if scores else 0.0
                category_results[category] = avg_score

            # 计算总体得分
            all_scores = [s for scores in category_scores.values() for s in scores]
            overall_score = sum(all_scores) / len(all_scores) if all_scores else 0.0

            threshold = self.eval_config["threshold"].get("anime_expression", 0.7)

            result = {
                "anime_expression": overall_score,
                "category_results": category_results,
                "samples": len(all_scores),
                "threshold": threshold,
                "passed": overall_score >= threshold,
            }

            self.logger.info(f"二次元表达理解评估完成:overall_score={overall_score:.4f}")
            return result

        except Exception as e:
            self.logger.error(f"二次元表达理解评估失败: {e}")
            return {"anime_expression": 0.0, "error": str(e), "passed": False}

    def evaluate_expression_style(
        self, response: str, reference_style: str, category: str
    ) -> float:
        """
        评估表达方式的符合程度

        Args:
            response (str): 模型生成的回答
            reference_style (str): 参考风格
            category (str): 风格类别

        Returns:
            float: 符合程度得分(0-1)
        """
        # 针对不同类别的表达方式使用不同的评估策略
        if category == "萌语":
            # 检查特定的萌系词汇和表达
            keywords = ["喵", "呢", "呐", "哒", "呀", "啦", "噗", "desu", "nya", "笨蛋"]
            style_makers = sum(1 for kw in keywords if kw in response) / len(keywords)
            return min(1.0, style_makers * 2)  # 萌系表达通常更夸张，得分上限为2.0

        elif category == "中二台词":
            # 检查是否包含中二特征词
            keywords = ["吾", "吾之", "吾辈", "汝" "终焉", "解放", "力量", "黑暗", "命运", "宿命"]
            style_makers = sum(1 for kw in keywords if kw in response) / len(keywords)
            return min(1.0, style_makers * 2)  # 中二表达通常更夸张，得分上限为2.0

        elif category == "角色口头禅":
            # 检查是否包含角色口头禅
            return 1.0 if reference_style in response else 0.0

        else:
            # 默认评估方法
            # 简单评估文本相似度
            response_chars = set(response)
            reference_chars = set(reference_style)

            if not reference_chars:
                return 0.0

            overlap = len(response_chars.intersection(reference_chars))
            similarity = overlap / len(reference_chars)
            return min(1.0, similarity * 1.5)  # 文本相似度通常较弱，得分上限为1.5

    def evaluate_anime_cultural_background(self, dataset: Dataset) -> Dict[str, float]:
        """
        评估模型对二次元文化背景的理解

        Args:
            dataset (Dataset): 评估数据集,需要包含"prompt"和"response"字段，二次元文化背景相关的问题和标准答案

        Returns:
            Dict[str,float]: 评估结果
        """
        self.logger.info("开始评估二次元文化背景理解...")

        required_fields = ["prompt", "key_points", "cultural_category"]
        if not all(field in dataset.column_names for field in required_fields):
            missing = [f for f in required_fields if f not in dataset.column_names]
            self.logger.error(f"数据集缺少必要的字段:{missing}")
            return {
                "anime_cultural_background": 0.0,
                "error": f"数据集缺少必要的字段:{missing}",
                "passed": False,
            }

        category_scores = defaultdict(list)

        try:
            for sample in tqdm(dataset, desc="评估二次元文化背景"):
                prompt = sample["prompt"]
                key_points = sample["key_points"]  # 应为列表或逗号分隔的字符串
                category = sample["cultural_category"]  # 如作品知识、创作体系、次文化现象等

                if isinstance(key_points, str):
                    key_points = [kp.strip() for kp in key_points.split(",")]

                # 生成回答
                try:
                    response = self.model_manager.generate(prompt)

                    # 计算关键点覆盖率
                    covered_points = sum(
                        1 for point in key_points if point.lower() in response.lower()
                    )
                    coverage = covered_points / len(key_points) if key_points else 0.0

                    category_scores[category].append(coverage)

                except Exception as e:
                    self.logger.error(f"生成回答失败: {e}")
                    continue

            # 计算每个类别得分
            category_results = {}
            for category, scores in category_scores.items():
                avg_score = sum(scores) / len(scores) if scores else 0.0
                category_results[category] = avg_score

            # 计算总体得分
            all_scores = [s for scores in category_scores.values() for s in scores]
            overall_score = sum(all_scores) / len(all_scores) if all_scores else 0.0

            threshold = self.eval_config["threshold"].get(
                "anime_cultural_background", 0.7
            )

            result = {
                "anime_cultural_background": overall_score,
                "category_results": category_results,
                "samples": len(all_scores),
                "threshold": threshold,
                "passed": overall_score >= threshold,
            }

            self.logger.info(f"二次元文化背景理解评估完成:overall_score={overall_score:.4f}")
            return result

        except Exception as e:
            self.logger.error(f"二次元文化背景理解评估失败: {e}")
            return {"anime_cultural_background": 0.0, "error": str(e), "passed": False}

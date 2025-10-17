# ！/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/10 10:00
# @Author  : erliu
# @File    : lora.py
# @Software: PyCharm

import os
import logging
import json
from typing import Optional, Dict, Any, Union, List, Tuple
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, TaskType

from .base import ModelManager
from .quantization import AdvanceQuantizationManager


class LoraManager(AdvanceQuantizationManager):
    """Lora管理类，负责Lora模型微调与适配器管理"""

    def __init__(
        self,
        config_path: Union[str, Path],
        device: Optional[str] = "None",
        adapter_name: Optional[str] = "None",
    ):
        """初始化Lora管理器

        Args:
            config_path:配置文件路径
            device:设备类型，可选"cpu"或"cuda"或"auto"
            adapter_name:适配器名称，可选"None"
        """
        super().__init__(config_path, device)

        # LoRA配置
        self.lora_config = self.config.get("lora", {})
        self.r = self.lora_config.get("r", 16)  # LoRA秩
        self.alpha = self.lora_config.get("alpha", 32)  # LoRA缩放因子
        self.dropout = self.lora_config.get("dropout", 0.05)  # LoRA dropout
        self.target_modules = self.lora_config.get(
            "target_modules", ["q_proj", "v_proj", "k_proj", "o_proj"]
        )  # LoRA适配器模块

        # 适配器路径
        self.adapter_path = Path(
            self.config.get("model", {}).get("adapters_path", "./models/adapters")
        )
        os.makedirs(self.adapter_path, exist_ok=True)

        # 当前适配器路径
        self.current_adapter = adapter_name
        self._peft_config = None
        self._peft_model = None

        self.logger = logging.getLogger(__name__)

    def create_lora_config(
        self, task_type: TaskType = TaskType.CAUSAL_LM
    ) -> LoraConfig:
        """创建LoRA配置

        Args:
            task_type:任务类型，可选TaskType.CAUSAL_LM或TaskType.SEQ_2_SEQ_LM

        Returns:
            LoraConfig:LoRA配置
        """
        return LoraConfig(
            r=self.r,
            lora_alpha=self.alpha,
            target_modules=self.target_modules,
            lora_dropout=self.dropout,
            bias="none",
            task_type=task_type,
        )

    def prepare_for_training(self, model=None):
        """
        准备模型进行训练

        Args:
            model:模型，可选None

        Returns:
            torch.nn.Module:准备好的模型
        """
        if model is None:
            model = self.load_model()

        # 为k-bit训练准备模型
        if self.is_quantization_enabled:
            self.logger.info("准备模型用于QLoRA训练")
            model = prepare_model_for_kbit_training(
                model,
                use_gradient_checkpointing=True,
                gradient_checkpointing_kwargs={"use_reentrant": False},
            )

        # 确保模型使用梯度检查点
        if hasattr(model, "enable_input_require_grads"):
            model.enable_input_require_grads()

        return model

    def load_peft_adapter(self, adapter_name: Optional[str] = None):
        """
        获取PEFT模型

        Args:
            adapter_name:适配器名称，可选None

        Returns:
            torch.nn.Module:PEFT模型

        """
        adapter_name = adapter_name or self.current_adapter

        if adapter_name is None:
            self.logger.warning("未指定适配器名称，使用默认适配器")
            raise ValueError("适配器名称不能为None")

        if self._peft_model is not None and self.current_adapter == adapter_name:
            return self._peft_model

        # 加载基础模型
        model = self.load_model()

        # 适配器路径
        adapter_path = self.adapter_path / adapter_name

        if not adapter_path.exists():
            self.logger.warning(f"适配器文件{adapter_path}不存在")
            raise FileNotFoundError(f"适配器文件{adapter_path}不存在")

        self.logger.info(f"加载适配器{adapter_path}从{adapter_path}")

        # 创建LoRA配置
        lora_config = self.create_lora_config()

        # 创建PEFT模型
        self._peft_model = get_peft_model(model, lora_config)

        # 加载适配器权重
        self._peft_model.load_adapter(adapter_path, adapter_name)
        self.current_adapter = adapter_name

        self.logger.info(f"成功加载适配器{adapter_name}，当前适配器为{self.current_adapter}")
        return self._peft_model

    def save_adapter(self, adapter_name: str, output_dir: Union[str, Path] = None):
        """
        保存适配器

        Args:
            adapter_name:适配器名称
            output_dir:输出目录，可选None

        Returns:
            None
        """
        if self._peft_model is None:
            self.logger.error("没有可保存的PEFT模型")
            raise ValueError("没有可保存的PEFT模型")

        # 设置输出目录
        output_dir = output_dir or (self.adapter_path / adapter_name)
        output_dir = Path(output_dir)
        os.makedirs(output_dir, exist_ok=True)

        self.logger.info(f"保存适配器{adapter_name}到{output_dir}")
        self._peft_model.save_adapter(output_dir)

        # 保存适配器配置
        config_file = output_dir / "adapter_config.json"
        with open(config_file, "w", encoding="utf-8") as f:
            config = {
                "r": self.r,
                "alpha": self.alpha,
                "dropout": self.dropout,
                "target_modules": self.target_modules,
                "base_model": self.get_model_path(),
                "created_at": str(Path.ctime(config_file)),
            }
            json.dump(config, f, ensure_ascii=False, indent=2)

        self.logger.info(f"适配器{adapter_name}保存成功")

    def list_adapters(self) -> List[str]:
        """
        列出所有适配器

        Returns:
            List[str]:适配器列表
        """
        adapters = []
        for item in self.adapter_path.iterdir():
            if item.is_dir() and (item / "adapter_config.json").exists():
                adapters.append(item.name)
        return adapters

    def delete_adapter(self, adapter_name: str) -> bool:
        """
        删除适配器

        Args:
            adapter_name:适配器名称

        Returns:
            bool:是否删除成功

        """
        adapter_path = self.adapter_path / adapter_name
        if not adapter_path.exists():
            self.logger.warning(f"适配器{adapter_name}不存在")
            return False

        import shutil

        try:
            shutil.rmtree(adapter_path)
            self.logger.info(f"适配器{adapter_name}删除成功")
            return True
        except Exception as e:
            self.logger.error(f"删除适配器{adapter_name}失败: {e}")
            return False

    def generate(
        self, prompt: str, adapter_name: Optional[str] = None, **kwargs
    ) -> str:
        """
        生成文本

        Args:
            prompt:提示词
            adapter_name:适配器名称，可选None
            **kwargs:生成参数

        Returns:
            str:生成文本
        """
        adapter_name = adapter_name or self.current_adapter

        if adapter_name is None:
            # 没有指定适配器，使用基础模型生成
            self.logger.warning("没有指定适配器，使用基础模型生成")
            return super().generate(prompt, **kwargs)

        # 加载PEFT模型
        if self._peft_model is None or self.current_adapter != adapter_name:
            self._peft_model = self.get_peft_model(adapter_name)

        # 加载分词器
        if self.tokenizer is None:
            self.tokenizer = self.load_tokenizer()

        # 处理生成参数
        max_new_tokens = kwargs.get(
            "max_new_tokens",
            self.config.get("inference", {}).get("max_new_tokens", 256),
        )
        temperature = kwargs.get(
            "temperature", self.config.get("inference", {}).get("temperature", 0.7)
        )
        top_p = kwargs.get("top_p", self.config.get("inference", {}).get("top_p", 0.9))
        top_k = kwargs.get("top_k", self.config.get("inference", {}).get("top_k", 40))
        repetition_penalty = kwargs.get(
            "repetition_penalty",
            self.config.get("inference", {}).get("repetition_penalty", 1.1),
        )

        try:
            inputs = self._tokenizer(prompt, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = self._peft_model.generate(
                    inputs.input_ids,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repetition_penalty=repetition_penalty,
                    do_sample=temperature > 0,
                    pad_token_id=self._tokenizer.pad_token_id,
                    eos_token_id=self._tokenizer.eos_token_id,
                )
                generated_text = self._tokenizer.decode(
                    outputs[0], skip_special_tokens=True
                )
                return generated_text[len(prompt) :].strip()
        except Exception as e:
            self.logger.error(f"生成失败: {e}")
            return RuntimeError(f"生成失败: {e}")

    def unload(self) -> None:
        """
        卸载PEFT模型,释放显存/内存
        """
        if self._peft_model is not None:
            del self._peft_model
            self._peft_model = None

        super().unload()

#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/10 10:00
# @Author  : erliu
# @File    : base.py
# @Software: PyCharm

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Union, List

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, PreTrainedModel, PreTrainedTokenizer

class ModelManager:
    """基础模型管理类，负责模型加载、缓存和管理等操作"""
    def __init__(self, config_path: Union[str, Path], device: Optional[str] = None):
        """初始化模型管理器
        
            Args:
                config_path: 配置文件路径
                device: 设备类型，可选"cpu"或"cuda"
        """
        
        self.logger = logging.getLogger(__name__)
        self.config = self.load_config(config_path)
        self.device = device or self.config.get("device", "auto")
        
        # 确定实际设备
        if self.device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.logger.info(f"使用计算设备: {self.device}")
        
        # 模型和分词器的缓存
        self._model = None
        self._tokenizer = None
        
        # 创建模型目录
        self._ensure_model_dir()
        
    def load_config(self, config_path: Union[str, Path]) -> Dict[str, Any]:
        """加载模型配置文件"""
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            return config
        except Exception as e:
            self.logger.error(f"加载配置文件失败: {e}")
            raise RuntimeError(f"配置文件加载失败: {e}")
        
    def _ensure_model_dir(self):
        """确保模型目录存在"""
        dirs = [
            self.config.get("model", {}).get("model_path", "./models/base"),
            self.config.get("model", {}).get("adapter_path", "./models/adapter"),
            self.config.get("model", {}).get("quantized_path", "./models/quantized"),
        ]
        for dir_path in dirs:
            os.makedirs(dir_path, exist_ok=True)
            self.logger.debug(f"确保目录: {dir_path} 存在")
    
    def get_model_path(self) -> str:
        """获取模型路径/ID"""
        return self.config.get("model", {}).get("base_model", "")
    
    def load_tokenizer(self) -> PreTrainedTokenizer:
        """加载分词器"""
        if self._tokenizer is not None:
            return self._tokenizer
        
        model_path = self.get_model_path()
        self.logger.info(f"加载分词器: {model_path}")
        
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True,
                use_fast=True,
            )
            if not self._tokenizer.pad_token:
                self._tokenizer.pad_token = self._tokenizer.eos_token
            self.logger.info(f"分词器加载成功")
            return self._tokenizer
        except Exception as e:
            self.logger.error(f"分词器加载失败: {e}")
            raise RuntimeError(f"分词器加载失败: {e}")

    def load_model(self) -> PreTrainedModel:
        """加载基础模型（未量化版本）"""
        if self._model is not None:
            return self._model
        
        model_path = self.get_model_path()
        self.logger.info(f"加载基础模型: {model_path}")
        
        try:
            self._model = AutoModelForCausalLM.from_pretrained(
                model_path,
                trust_remote_code=True,
                device_map=self.device,
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                low_cpu_mem_usage=True,
            )
            self.logger.info(f"基础模型加载成功，参数量：{self._get_model_size(self._model):.2f}B")
            return self._model
        except Exception as e:
            self.logger.error(f"基础模型加载失败: {e}")
            raise RuntimeError(f"基础模型加载失败: {e}")
        
    def _get_model_size(self, model: torch.nn.Module) -> float:
        """计算模型参数数量（单位：十亿）"""
        return sum(p.numel() for p in model.parameters()) / 1e9
    
    def generate(self,
                prompt: str,
                max_new_tokens: int = 256,
                temperature: float = 0.7,
                top_p: float = 0.9,
                top_k: int = 40,
                repetition_penalty: float = 1.1) -> str:
        
        """
        生成文本

        Args:
            prompt: 输入提示
            max_new_tokens: 最大生成的新token数量
            temperature: 温度参数，控制随机性
            top_p: 核采样参数
            top_k: Top-k采样参数
            repetition_penalty: 重复惩罚
            
        Returns:
            生成的文本
        """
        try:
            if self._model is None or self._tokenizer is None:
                self.load_model()
                self.load_tokenizer()
            
            inputs = self._tokenizer(prompt, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = self._model.generate(
                    inputs.input_ids,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repetition_penalty=repetition_penalty,
                    do_sample=temperature > 0,
                    pad_token_id=self._tokenizer.pad_token_id,
                    eos_token_id=self._tokenizer.eos_token_id
                )
                    
            generated_text = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
            return generated_text[len(prompt):].strip()
        except Exception as e:
            self.logger.error(f"生成失败: {e}")
            raise RuntimeError(f"生成失败: {e}")
        
    def unload(self) -> None:
        """卸载模型，释放显存/内存"""
        if self._model is not None:
            del self._model
            self._model = None
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            self.logger.info("基础模型已卸载")
    
    def load_model_async(self) -> str:
        """异步加载模型,返回任务ID"""
        from src.utils.thread_factory import get_thread_pool
        thread_factory = get_thread_pool()
        return thread_factory.submit_task(self.load_model)
        

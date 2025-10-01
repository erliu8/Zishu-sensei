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
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoConfig, PreTrainedModel, PreTrainedTokenizer

from zishu.utils.attention_utils import check_sdpa_support, configure_sdpa_for_model, display_sdpa_performance_info

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
        return self.config.get("base_model", {}).get("path", "")
    
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

    def load_model(self):
        """加载预训练模型"""
        model_path = self.get_model_path()
        
        #获取高效注意力配置
        attention_config = self.config.get("attention",{})
        efficient_attn_enabled = self.config.get("use_efficient_attention", False)
        self.logger.info(f"模型加载路径: {model_path}, 高效注意力: {efficient_attn_enabled}")
        
        try:
            #检查SDPA支持情况
            sdqa_info = None
            if efficient_attn_enabled:
                sdpa_info = check_sdpa_support()
                if sdpa_info["sdpa_available"]:
                    self.logger.info(f"检测到SDPA支持，最佳后端: {sdpa_info['best_backend']}")
                else:
                    self.logger.warning("未检测到SDPA支持，将使用默认注意力机制")
            
            #附加配置参数
            model_kwargs = {}
            
            #根据配置选择适当的精度模型
            dtype = None
            if self.config.get("fp16",False) and torch.cuda.is_available():
                dtype = torch.float16
                self.logger.info("使用FP16精度")
            elif self.config.get("bf16",False) and torch.cuda.is_available() and torch.cuda.is_bf16_supported():
                dtype = torch.bfloat16
                self.logger.info("使用BF16精度")
                
            if dtype:
                model_kwargs["torch_dtype"] = dtype
                
            #添加注意力实现配置
            if efficient_attn_enabled and sdpa_info and sdpa_info["sdpa_available"]:
                model_kwargs["attn_implementation"] = "sdpa"
                
            #设置device_map
            if torch.cuda.is_available():
                device_map = {
                    "model.embed_tokens":"cpu",
                    "model.layers.0":"cuda",
                    "model.layers.1":"cuda",
                    "model.layers.2":"cuda",
                    "model.layers.3":"cuda",
                    "model.layers.30":"cuda",
                    "model.layers.31":"cuda",
                    "model.norm":"cpu",
                    "lm_head":"cpu"
                }
                #根据模型大小动态调整device_map
                if "7B" in model_path:
                    gpu_layers = 2
                elif "3B" in model_path or "1.3B" in model_path:
                    gpu_layers = 6
                
                #构建最终的device_map
                final_device_map = {}
                total_layers = self._get_model_layer_count(model_path)
                for i in range(total_layers):
                    if i< gpu_layers // 2 or i >= total_layers - (gpu_layers // 2):
                        final_device_map[f"model.layers.{i}"] = "cuda"
                    else:
                        final_device_map[f"model.layers.{i}"] = "cpu"
                
                #添加嵌入和输出层配置
                final_device_map["model.embed_tokens"] = "cpu"
                final_device_map["lm_head"] = "cpu"
                final_device_map["model.norm"] = "cpu"
                
                model_kwargs["device_map"] = final_device_map
            
            #是否使用量化
            if self.config.get("quantized",{}).get("enabled",False):
                bits = self.config["quantization"]["bits"]
                if bits == 4:
                    model_kwargs["load_in_4bit"] = True
                    self.logger.info(f"使用4位量化")
                elif bits == 8:
                    model_kwargs["load_in_8bit"] = True
                    self.logger.info(f"使用8位量化")
            
            #加载模型配置和模型
            model_config = AutoConfig.from_pretrained(model_path)
            
            self.logger.info(f"开始加载模型，参数: {model_kwargs}")
            self._model = AutoModelForCausalLM.from_pretrained(
                model_path,
                config=model_config,
                trust_remote_code=True,
                **model_kwargs
            )
            #如果启用了高效注意力，配置SDPA
            if efficient_attn_enabled and sdpa_info and sdpa_info["sdpa_available"]:
                self._model = configure_sdpa_for_model(self._model,attention_config)
                display_sdpa_performance_info()
                
            self.logger.info(f"模型加载完成，大小: {self._get_model_size(self._model):.2f}B参数")
            return self._model
        except Exception as e:
            self.logger.error(f"模型加载失败: {e}")
            raise RuntimeError(f"模型加载失败: {e}")

        
    def _get_model_size(self, model: torch.nn.Module) -> float:
        """计算模型参数数量（单位：十亿）"""
        return sum(p.numel() for p in model.parameters()) / 1e9
    
    def _get_model_layer_count(self, model_path):
        """获取模型层数"""
        config = AutoConfig.from_pretrained(model_path)
        if hasattr(config,"num_hidden_layers"):
            return config.num_hidden_layers
        elif hasattr(config,"n_layer"):
            return config.n_layer
        else:
            return 32

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
        from src.utils.thread_factory import get_thread_factory
        thread_factory = get_thread_factory()
        return thread_factory.submit_task(self.load_model)
        

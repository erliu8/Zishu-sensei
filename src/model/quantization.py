#！/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/10 10:00
# @Author  : erliu
# @File    : quantization.py
# @Software: PyCharm

import os
import logging
from typing import Optional,Dict,Any,Union,List

import torch
from transformers import AutoModelForCausalLM,AutoTokenizer,BitsAndBytesConfig
from pathlib import Path

from .base import ModelManager

class QuantizationManager(ModelManager):
    """量化管理类，负责模型量化和保存",实现4/8位量化"""
    
    def __init__(self,
                 config_path:Union[str,Path],
                 device:Optional[str]="None"
                 ):
        """初始化量化管理器
        
        Args:
            config_path:配置文件路径
            device:设备类型，可选"cpu"或"cuda"或"auto"
        """
        super().__init__(config_path,device)
        
        #量化配置
        self.quant_config = self.config.get("model",{}).get("quantization",{})
        self.is_quantization_enabled = self.quant_config.get("enabled",False)
        self.quantization_bits = self.quant_config.get("bits",4)
        self.compute_dtype = self.quant_config.get("compute_dtype",torch.bfloat16)
        
        # 检查量化是否启用
        if self.is_quantization_enabled and self.device == "cpu":
            self.logger.warning("CPU设备不支持BitsAndBytesConfig，量化将自动禁用")
            self.is_quantization_enabled = False
        
    def _get_compute_dtype(self)->torch.dtype:
        """获取计算数据类型"""
        dtype_map = {
            "bfloat16":torch.bfloat16,
            "float16":torch.float16,
            "float32":torch.float32
        }
        return dtype_map.get(self.compute_dtype,torch.float32)

    def load_model(self)->Any:
        """加载量化模型"""
        if self._model is not None:
            return self._model
        
        # 加载基础模型
        model_path = self.get_model_path()
        self.logger.info(f"加载模型: {model_path}")
        
        #如果没有启用量化，使用基类加载完整模型
        if not self.is_quantization_enabled:
            self.logger.info("量化未启用，使用标准模型")
            return super().load_model()
        
        #设置量化配置
        try:
            self.logger.info(f"启用量化，使用{self.quantization_bits}位量化")
            self.logger.info(f"计算数据类型: {self._get_compute_dtype()}")
            
            # 设置量化配置
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=self.quantization_bits == 4,
                load_in_8bit=self.quantization_bits == 8,
                llm_int8_threshold=6.0,
                llm_int8_has_fp16_weight=True,
                bnb_4bit_compute_dtype=self._get_compute_dtype(),
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
            # 加载量化模型
            self._model = AutoModelForCausalLM.from_pretrained(
                model_path,
                quantization_config=quantization_config,
                device_map=self.device,
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            
            self.logger.info(f"量化模型加载完成，参数量：{self._get_model_size(self._model):2f}B")
            self.logger.info(f"使用{self.quantization_bits}位量化,计算数据类型：{self._get_compute_dtype()}")
            return self._model
        except Exception as e:
            self.logger.error(f"量化模型加载失败: {e}")
            self.logger.error(f"尝试使用标准模型加载")
            return super().load_model()

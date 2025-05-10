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
        self.quant_config = self.config.get("quantization",{})
        self.quant_type = self.quant_config.get("type","int8")
        self.quant_bits = self.quant_config.get("bits",8)
        
        
        

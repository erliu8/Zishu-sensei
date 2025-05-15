#！/usr/bin/env python
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
from typing import Dict,Any,Optional,List,Tuple,Union
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from tqdm import tqdm
from collections import defaultdict

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer,AutoModelForCausalLM
from datasets import load_dataset,Dataset
from sklearn.metrics import accuracy_score,precision_recall_fscore_support

from .base import ModelManager
from .lora import LoraManager
from ..utils.performance import get_performance_monitor
from ..utils.thread_factory import get_thread_factory

class EvaluationManager(ModelManager):
    """模型评估管理类,负责模型评估和性能分析"""
    
    def __init__(self,
                 model_manager:Union[ModelManager,LoraManager],
                 eval_config_path:Optional[Union[str,Path]]=None):
        """
        初始化评估管理器
        
        Args:
            model_manager (Union[ModelManager,LoraManager]): 模型管理器实例
            eval_config (Optional[Union[str,Path]], optional): 评估配置文件路径. Defaults to None.
        """
        self.model_manager = model_manager
        self.logger = logging.getLogger(__name__)
        self.performance_monitor = get_performance_monitor()
        
        #加载评估配置
        self.eval_config_path = Path(eval_config_path) or "./config/evaluation_config.json"
        try:
            if self.eval_config_path.exists():
                with open(self.eval_config_path,"r",encoding="utf-8") as f:
                    self.eval_config = json.load(f)
            
            else:
                self.logger.warning(f"评估配置文件: {self.eval_config_path}不存在,使用默认配置")
                self.eval_config = self._get_default_eval_config()
        except Exception as e:
            self.logger.error(f"评估配置文件加载失败: {e}")
            self.eval_config = self._get_default_eval_config()

        #确保输出目录存在
        self.eval_output_dir = Path(self.eval_config.get("output_dir","/data/evaluation"))
        os.makedirs(self.eval_output_dir,exist_ok=True)
    
    def _get_default_eval_config(self)->Dict[str,Any]:
        """获取默认评估配置"""
        return {
            "output_dir":"/data/evaluation",
            "metrics":["preplexity","accuracy","character_consistency","cultural_knowledge"],
            "datasets":{
                "general":"./data/evaluation/general_eval.json",
                "chinese":"./data/evaluation/chinese_eval.json",
                "roleplay":"./data/evaluation/roleplay_eval.json",
                "culture":"./data/evaluation/culture_eval.json",
            },
            "batch_size":8,
            "max_length":512,
            "character_consistency":{
                "persona_key_points":[
                    " "
                ]
            },
            "threshold":{
                "preplexity":10.0,
                "accuracy":0.7,
                "character_consistency":0.8,
                "cultural_knowledge":0.75,
            }
        }
        

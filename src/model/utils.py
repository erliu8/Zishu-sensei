#! /usr/bin/env python3
# -*- coding: utf-8 -*-
# @Time    : 2025/5/28 15:30
# @Author  : erliu
# @File    : utils.py
# @Software: PyCharm

import os
import logging
import json
import torch
import hashlib
import re
from pathlib import Path
from typing import Dict,List,Optional,Union,Tuple,Any

logger = logging.getLogger(__name__)

def count_model_parameters(model:torch.nn.Module)->Tuple[int,float]:
    """计算模型参数数量和可训练参数数量
    
    Args:
        model (torch.nn.Module): 待计算的模型
        
    Returns:
        参数数量及以十亿为单位的数量

    """
    param_count = sum(p.numel() for p in model.parameters())
    param_count_b = param_count / 1e9
    return param_count,param_count_b

def get_model_size_on_disk(model_path:Union[str,Path])->Tuple[int,str]:
    """获取模型在磁盘上的大小
    
    Args:
        model_path (Union[str,Path]): 模型路径
        
    Returns:
        Tuple[int,str]: 模型大小及单位

    """
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"模型文件不存在: {model_path}")
    
    total_size = 0
    if model_path.is_file():
        total_size = model_path.stat().st_size
    else:
        for path in model_path.glob("**/*"):
            if path.is_file():
                total_size += path.stat().st_size
    
    #转换为可读大小
    size_names = ["B","KB","MB","GB","TB"]
    size_index = 0 
    readable_size = total_size
    
    while readable_size > 1024 and size_index < len(size_names) - 1:
        readable_size /= 1024
        size_index += 1
    
    return total_size,f"{readable_size:.2f}{size_names[size_index]}"

def create_model_hash(model_path:Union[str,Path],sample_files:int = 3)->str:
    """创建模型哈希值,用于验证模型的完整性
    
    Args:
        model_path (Union[str,Path]): 模型路径
        sample_files (int): 采样文件数量,默认为3
        
    Returns:
        str: 模型哈希值
    """
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"模型文件不存在: {model_path}")
    
    files = list(model_path.glob("**/*.bin")) + list(model_path.glob("**/*.safetensors"))
    if not files:
        return ""
    
    if sample_files > 0 and sample_files < len(files):
        import random
        files = random.sample(files,sample_files)
        
    hash_obj = hashlib.md5()
    for file in files:
        file_hash = hashlib.md5(open(file,"rb").read()).hexdigest()
        hash_obj.update(file_hash.encode())
    
    return hash_obj.hexdigest()

def optimize_model_memory(model:torch.nn.Module,device:str="cuda")->torch.nn.Module:
    """优化模型内存使用
    
    Args:
        model (torch.nn.Module): 待优化的模型
        device (str): 设备类型,默认为"cuda"
        
    Returns:
        torch.nn.Module: 优化后的模型
    """
    if device == "cpu":
        return model
    
    #启用梯度检查点以减少内存使用
    if hasattr(model,"gradient_checkpointing_enable"):
        model.gradient_checkpointing_enable()
    
    #清理不必要的属性
    for module in model.modules():
        if hasattr(module,"weight") and hasattr(module,"ds_shape"):
            del module.weight.ds_shape
            
    #清理不必要的缓存
    torch.cuda.empty_cache()
    
    return model

def auto_detect_device(min_vram:int=6)->str:
    """自动检测可用设备
    
    Args:
        min_vram (int): 最小显存要求,默认为6GB
        
    Returns:
        str: 设备类型,如"cuda"或"mps"
    """
    if not torch.cuda.is_available():
        logger.warning("没有可用的GPU,将使用CPU运行")
        return "cpu"
    
    #获取VRAM总量大小(以GB为单位)
    vram_size = torch.cuda.get_device_properties(0).total_memory / 1024**3
    
    if vram_size >= min_vram:
        logger.warning(f"显存不足，需要至少{min_vram}GB显存，当前显存为{vram_size:.2f}GB，使用CPU运行")
        return "cpu"
    
    logger.info(f"使用CUDA设备,显存为{vram_size:.2f}GB")
    return "cuda"

def estimate_vram_requirements(model_size_b: float,bits:int=16)-> float:
    """估计模型所需的显存大小
    
    Args:
        model_size_b (float): 模型大小(字节)
        bits (int): 模型精度,默认为16
        
    Returns:
        float: 估计的显存大小(GB)
    """
    #1B参数在FP16下需要2GB显存，考虑激活值和其他开销
    base_vram = model_size_b * 2.0 #fp16
    multiplier = bits / 16 #fp16=16,fp32=32
    
    #考虑KV缓存和其他开销
    overhead = 1.3
    return base_vram * multiplier * overhead

def format_prompt_with_template(template:str,**kwargs)->str:
    """使用模板格式化提示
    
    Args:
        template (str): 模板字符串
        **kwargs: 替换模板中的变量
        
    Returns:
        str: 格式化后的提示
    """
    for key,value in kwargs.items():
        placeholder = "{" + key+ "}"
        template = template.replace(placeholder,str(value))
    return template

def truncate_to_max_length(text:str,tokenizer,max_length:int)->str:
    """截断文以确保tokenizer后不超过最大长度
    
    Args:
        text (str): 输入文本
        tokenizer: 分词器
        max_length (int): 最大长度
        
    Returns:
        str: 截断后的文本
    """
    tokens = tokenizer.encode(text)
    if len(tokens) <= max_length:
        return text
    
    #截断tokens并解码
    truncated_tokens = tokens[:max_length]
    return tokenizer.decode(truncated_tokens)

def save_adapter_info(adapter_path:Union[str,Path],
                      base_model:str,
                      adapter_type:str,
                      parameters:Dict[str,Any]
                      )->None:
    """保存适配器信息
    
        Args:
            adapter_path (Union[str,Path]): 适配器路径
            base_model (str): 基础模型名称
            adapter_type (str): 适配器类型
            parameters (Dict[str,Any]): 适配器参数
    
    """
    adapter_path = Path(adapter_path)
    os.makedirs(adapter_path,exist_ok=True)
    
    info = {
        "base_model":base_model,
        "adapter_type":adapter_type,
        "create_at":str(Path.ctime(adapter_path) if adapter_path.exists() else ""),
        "parameters":parameters
    }
    
    with open(adapter_path / "adapter_info.json","w",encoding="utf-8") as f:
        json.dump(info,f,ensure_ascii=False,indent=2)

def extract_answers_from_text(text:str,pattern:str = r"答案[:：](.*?)(?:\n|$)") -> List[str]:
    """从文本中提取答案
    
    Args:
        text (str): 输入文本
        pattern (str): 提取答案的正则表达式
        
    Returns:
        List[str]: 提取的答案列表
    """
    matches = re.findall(pattern,text)
    return [match.strip() for match in matches]
                            
    
    
        
    




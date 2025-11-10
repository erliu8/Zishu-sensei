#！/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
sys.modules['awq'] = None  # 阻止AWQ导入

import json
import torch
import logging
import argparse
from pathlib import Path
from typing import Dict,Any,Optional,Union,List,Tuple
from tqdm import tqdm
import shutil

#添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, project_root)

from zishu.training.train.quantization import AdvanceQuantizationManager
from zishu.utils.logger import setup_logger

logger = setup_logger(__name__,logging.INFO)

def load_calibration_data(calibration_path:str,max_samples:int=128)->List[str]:
    """加载校准数据集
    
    Args:
        calibration_path (str): 校准数据集路径
        max_samples (int, optional): 最大样本数. Defaults to 128.
        
    Returns:
        List[str]: 校准数据集
    """
    logger.info(f"加载校准数据集: {calibration_path}")
    
    if not os.path.exists(calibration_path):
        raise FileNotFoundError(f"校准数据集文件不存在: {calibration_path}")
    
    try:
        with open(calibration_path,"r",encoding="utf-8") as f:
            data = json.load(f)
            
        # 确保返回字符串列表
        texts = []
        for item in data[:max_samples]:
            if isinstance(item, dict) and "text" in item:
                texts.append(item["text"])  # 提取text字段
            elif isinstance(item, str):
                texts.append(item)
                
        if not texts:
            raise ValueError("未找到有效的校准数据")
        
        logger.info(f"加载了{len(texts)}个校准样本")
        return texts
    
    except Exception as e:
        logger.error(f"加载校准数据失败: {str(e)}")
        raise

def prepare_awq_calibration_data(texts:List[str])->List[str]:
    """准备AWQ校准数据格式
    
    Args:
        texts (List[str]): 文本列表
        
    Returns:
        List[str]: 准备好的校准数据
    """
    #AWQ通常喜欢更短的较完整句子
    processed_texts = []
    for text in texts:
        #清理文本，移除多余空白
        cleaned = text.strip()
        #分割长文本为句子
        sentences = [s.strip() for s in cleaned.split(".") if len(s.strip()) > 20]
        processed_texts.extend(sentences[:2]) #每个样本取前面两个句子
        
    #确保数据量适中
    return processed_texts[:128]
    
def quantize_gptq(
    model_path:str,
    tokenizer,
    model,
    calibration_data:List[str],
    output_dir:str,
    gptq_config:Dict[str,Any]
)->None:
    """量化QPTQ方法
    
    Args:
        model_path (str): 模型路径
        tokenizer: 分词器
        model: 模型
        calibration_data (List[str]): 校准数据
        output_dir (str): 输出目录
        gptq_config (Dict[str,Any]): GPTQ量化配置
    """
    try:
        from auto_gptq import AutoGPTQForCausalLM,BaseQuantizeConfig
        
        bits = gptq_config.get("bits",4)
        group_size = gptq_config.get("group_size",128)
        desc_act = gptq_config.get("desc_act",False)
        sym = gptq_config.get("sym",True)
        
        logger.info(f"使用GPTQ量化配置: bits={bits},group_size={group_size},desc_act={desc_act},sym={sym}")
        
        #准备量化配置
        quantize_config = BaseQuantizeConfig(
            bits=bits,
            group_size=group_size,
            desc_act=desc_act,
            sym=sym
        )
        
        #准备校准数据
        examples = []
        for text in tqdm(calibration_data,desc="准备校准数据"):
            tokens = tokenizer(text,return_tensors="pt",padding=True,truncation=True)
            examples.append({
                "input_ids":tokens.input_ids,
                "attention_mask":tokens.attention_mask
            })
            
        #进行量化
        model = AutoGPTQForCausalLM.from_pretrained(
            model_path,
            quantize_config=quantize_config,
            trust_remote_code=True
        )
        
        #运行量化
        model.quantize(
            examples=examples,
            batch_size=gptq_config.get("batch_size",1),
            use_triton=gptq_config.get("use_triton",False)
        )
        
        #保存量化后的模型
        os.makedirs(output_dir, exist_ok=True)
        model.save_pretrained(output_dir, use_safetensors=True)
        
        #保存tokenizer
        tokenizer.save_pretrained(output_dir)
        
        logger.info(f"GPTQ量化完成，保存到: {output_dir}")
        
    except ImportError:
        logger.error("auto_gptq库未安装，请先安装: pip install auto-gptq")
        raise
    except Exception as e:
        logger.error(f"量化失败: {str(e)}")
        raise

def quantize_awq(
    model_path:str,
    tokenizer,
    model,
    calibration_data:List[str],
    output_dir:str,
    awq_config:Dict[str,Any]
)->None:
    """量化AWQ方法
    
    Args:
        model_path (str): 模型路径
        tokenizer: 分词器
        model: 模型
        calibration_data (List[str]): 校准数据
        output_dir (str): 输出目录
        awq_config (Dict[str,Any]): AWQ量化配置
    """
    try:
        from awq import AutoAWQForCausalLM
        
        bits = awq_config.get("bits",4)
        group_size = awq_config.get("group_size",128)
        zero_point = awq_config.get("zero_point",True)
        
        logger.info(f"使用AWQ量化配置: bits={bits},group_size={group_size},zero_point={zero_point}")
        
        #准备校准数据
        max_samples = min(len(calibration_data),128) #AWQ一般不需要太多校准数据
        calibration_dataset = prepare_awq_calibration_data(calibration_data)
        
        #创建AWQ模型对象
        model = AutoAWQForCausalLM.from_pretrained(
            model,
            trust_remote_code=True
        )
        
        #运行AWQ量化
        model.quantize(
            tokenizer=tokenizer,
            quant_config={
                "zero_point":zero_point,
                "q_group_size":group_size,
                "w_bit":bits,
                "version":awq_config.get("version","GEMM"),
            },
            calibration_dataset = calibration_dataset,
            export_to_gguf = awq_config.get("export_to_gguf",False)
        )
        #保存量化后的模型
        model.save_pretrained(output_dir)
        
        logger.info(f"AWQ量化完成，保存到: {output_dir}")
        
    except ImportError:
        logger.error("awq库未安装，请先安装: pip install awq")
        raise
    except Exception as e:
        logger.error(f"量化失败: {str(e)}")
        raise
    
def quantize_bnb(
    model_path:str,
    output_dir:str,
    bnb_config:Dict[str,Any]
)->None:
    """量化bnb方法
    
    注意：BNB量化是运行时量化，不支持预先保存量化后的权重。
    此函数只保存量化配置，模型文件大小不会减小。
    如需获得更小的模型文件，请使用GPTQ或AWQ量化方法。
    
    Args:
        model_path (str): 模型路径
        output_dir (str): 输出目录
        bnb_config (Dict[str,Any]): bnb量化配置
    """
    try:
        from transformers import AutoConfig
        
        logger.warning(
            "BNB量化是运行时量化，不支持预先保存量化后的权重。"
            "模型文件大小不会减小，量化在加载模型时动态进行。"
            "如需获得更小的模型文件，请使用GPTQ或AWQ量化方法。"
        )
        
        logger.info(f"开始量化bnb方法: {model_path}")
        
        #创建输出目录
        os.makedirs(output_dir,exist_ok=True)
        
        #复制模型文件
        for item in os.listdir(model_path):
            src_path = os.path.join(model_path,item)
            dst_path = os.path.join(output_dir,item)
            
            if os.path.isfile(src_path):
                shutil.copy2(src_path,dst_path)
            else:
                shutil.copytree(src_path,dst_path)
                
        #添加量化配置
        config_path = os.path.join(output_dir,"config.json")
        if os.path.exists(config_path):
            with open(config_path,"r",encoding="utf-8") as f:
                config = json.load(f)
            
            #添加BNB量化配置
            config["quantization_config"] = {
                "load_in_4bit":bnb_config.get("bits",4) == 4,
                "load_in_8bit":bnb_config.get("bits",4) == 8,
                "llm_int8_threshold":6.0,
                "llm_int8_has_fp16_weight":True,
                "bnb_4bit_compute_dtype":bnb_config.get("compute_dtype","float16"),
                "bnb_4bit_use_double_quant":bnb_config.get("use_double_quant",True),
                "bnb_4bit_quant_type":bnb_config.get("quant_type","nf4")
            }
            
            #保存配置
            with open(config_path,"w",encoding="utf-8") as f:
                json.dump(config,f,indent=2)
                
            logger.info(f"BNB量化配置已添加,模型已保存到: {output_dir}")
            logger.info("注意：模型文件大小未减小，量化将在加载时动态进行")
            
        else:
            logger.warning(f"config.json文件不存在,无法添加量化配置")
            
    except Exception as e:
        logger.error(f"BNB量化失败: {str(e)}")
        raise
    
def quantize_dynamic(
    model_path:str,
    model,
    output_dir:str,
    dynamic_config:Dict[str,Any]
)->None:
    """动态量化方法
    
    Args:
        model_path (str): 模型路径
        model: 模型
        output_dir (str): 输出目录
        dynamic_config (Dict[str,Any]): 动态量化配置
    """
    try:
        import torch.quantization as quantization
        
        logger.info(f"开始PyTorch动态量化方法")
        
        #设置量化配置
        dtype_str = dynamic_config.get("dtype","qint8")
        if dtype_str == "qint8":
            dtype = torch.qint8
        elif dtype_str == "quint8":
            dtype = torch.quint8
        else:
            dtype = torch.qint8
            
        #获取目标模块类型
        target_modules = dynamic_config.get("target_modules",["Linear"])
        module_types = []
        
        if "Linear" in target_modules:
            module_types.append(torch.nn.Linear)
        if "Conv1d" in target_modules:
            module_types.append(torch.nn.Conv1d)
        if "Conv2d" in target_modules:
            module_types.append(torch.nn.Conv2d)
            
        if not module_types:
            module_types = [torch.nn.Linear]
        
        #构建量化配置字典
        qconfig_dict = {}
        for module_type in module_types:
            qconfig_dict[module_type] = quantization.default_dynamic_qconfig
            
        #进行动态量化
        quantized_model = quantization.quantize_dynamic(
            model,
            qconfig_dict,
            dtype=dtype
        )
        
        #保存量化后的模型
        os.makedirs(output_dir,exist_ok=True)
        torch.save(quantized_model.state_dict(),os.path.join(output_dir,"pytorch_model.bin"))
        
        #复制其他文件
        from transformers import AutoConfig
        config = AutoConfig.from_pretrained(model_path, trust_remote_code=True)
        config.save_pretrained(output_dir)
        
        #复制tokenizer文件
        for item in os.listdir(model_path):
            if item.startswith("tokenizer"):
                src_path = os.path.join(model_path,item)
                dst_path = os.path.join(output_dir,item)
                if os.path.isfile(src_path):
                    shutil.copy2(src_path,dst_path)
                else:
                    shutil.copytree(src_path,dst_path)
        
        #复制自定义代码文件（modeling_*.py, tokenization_*.py, configuration_*.py等）
        #这些文件是模型加载所必需的
        custom_code_patterns = ["modeling_", "tokenization_", "configuration_"]
        for item in os.listdir(model_path):
            # 检查是否是自定义代码文件
            is_custom_code = any(item.startswith(pattern) and item.endswith(".py") 
                                for pattern in custom_code_patterns)
            if is_custom_code:
                src_path = os.path.join(model_path, item)
                dst_path = os.path.join(output_dir, item)
                if os.path.isfile(src_path):
                    shutil.copy2(src_path, dst_path)
                    logger.info(f"已复制自定义代码文件: {item}")
                    
        logger.info(f"PyTorch动态量化完成,模型已保存到: {output_dir}")
        
    except Exception as e:
        logger.error(f"动态量化失败: {str(e)}")
        raise

def verify_quantized_model(model_path:str, tokenizer, method:str)->None:
    """验证量化后的模型"""
    try:
        if method == "bnb":
            # 对BNB模型只验证配置文件
            import os, json
            config_path = os.path.join(model_path, "config.json")
            if os.path.exists(config_path):
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                if "quantization_config" in config:
                    logger.info("BNB量化配置验证成功")
                    logger.info(f"女仆: 主人好~")
                    return True
                else:
                    raise ValueError("BNB量化配置未找到")
        elif method == "dynamic":
            # 对于动态量化，需要从原始模型加载并应用量化
            import os, json
            import torch.quantization as quantization
            
            # 读取量化配置
            quant_config_path = os.path.join(model_path, "quantization_config.json")
            if not os.path.exists(quant_config_path):
                raise ValueError(f"量化配置文件不存在: {quant_config_path}")
            
            with open(quant_config_path, "r", encoding="utf-8") as f:
                quant_config = json.load(f)
            
            # 支持两种拼写（orginal_model 是历史拼写错误，但为了兼容性保留）
            original_model_path = quant_config.get("original_model") or quant_config.get("orginal_model")
            if not original_model_path or not os.path.exists(original_model_path):
                raise ValueError(f"原始模型路径不存在: {original_model_path}")
            
            dynamic_config = quant_config.get("config", {})
            
            # 从原始模型加载
            from transformers import AutoModelForCausalLM
            logger.info(f"从原始模型加载: {original_model_path}")
            model = AutoModelForCausalLM.from_pretrained(
                original_model_path, 
                trust_remote_code=True,
                device_map="cpu",
                low_cpu_mem_usage=True
            )
            
            # 应用量化
            dtype_str = dynamic_config.get("dtype", "qint8")
            if dtype_str == "qint8":
                dtype = torch.qint8
            elif dtype_str == "quint8":
                dtype = torch.quint8
            else:
                dtype = torch.qint8
            
            target_modules = dynamic_config.get("target_modules", ["Linear"])
            module_types = []
            if "Linear" in target_modules:
                module_types.append(torch.nn.Linear)
            if "Conv1d" in target_modules:
                module_types.append(torch.nn.Conv1d)
            if "Conv2d" in target_modules:
                module_types.append(torch.nn.Conv2d)
            
            if not module_types:
                module_types = [torch.nn.Linear]
            
            qconfig_dict = {}
            for module_type in module_types:
                qconfig_dict[module_type] = quantization.default_dynamic_qconfig
            
            logger.info("应用动态量化...")
            quantized_model = quantization.quantize_dynamic(
                model,
                qconfig_dict,
                dtype=dtype
            )
            
            # 简单推理测试
            test_input = "叫主人~"
            inputs = tokenizer(test_input, return_tensors="pt")
            with torch.no_grad():
                outputs = quantized_model.generate(inputs.input_ids, max_new_tokens=10)
            decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            logger.info(f"女仆:{decoded}~")
        else:
            # 其他量化方法保持原有逻辑
            if method == "gptq":
                from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
                # 创建量化配置
                quantize_config = BaseQuantizeConfig(bits=4, group_size=128)
                model = AutoGPTQForCausalLM.from_pretrained(model_path, quantize_config=quantize_config, trust_remote_code=True)
            elif method == "awq":
                from awq import AutoAWQForCausalLM
                model = AutoAWQForCausalLM.from_pretrained(model_path, trust_remote_code=True)
            else:
                from transformers import AutoModelForCausalLM
                model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
                
            # 简单推理测试
            test_input = "叫主人~"
            inputs = tokenizer(test_input, return_tensors="pt")
            with torch.no_grad():
                outputs = model.generate(inputs.input_ids, max_new_tokens=10)
            decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            logger.info(f"女仆:{decoded}~")
        return True
    except Exception as e:
        logger.error(f"验证失败: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="高级量化脚本")
    parser.add_argument("--config",type=str,required=True,help="量化配置文件路径")
    parser.add_argument("--method",type=str,default="auto",
                        choices=["auto","gptq","awq","bnb","dynamic"],
                        help="量化方法,默认auto表示根据配置文件自动选择")
    parser.add_argument("--output_dir",type=str,default=None,help="输出目录,默认使用模型目录下的quantized子目录")
    parser.add_argument("--calibration_file",type=str,default=None,help="校准数据文件路径,覆盖配置文件中的设置")
    parser.add_argument("--device",type=str,default="auto",help="设备类型,auto表示自动选择,cuda表示GPU,cpu表示CPU")
    parser.add_argument("--max_samples",type=int,default=128,help="校准数据最大样本数,默认128")
    parser.add_argument("--bits",type=int,default=None,help="量化位数,覆盖配置中的设置")
    parser.add_argument("--group_size",type=int,default=None,help="量化组大小,覆盖配置中的设置")
    
    args = parser.parse_args()
    
    #加载量化管理器
    manager = AdvanceQuantizationManager(args.config,device=args.device)
    
    #获取配置
    quant_config = manager.quant_config
    methods_config = manager.methods_config
    calibration_config = manager.calibration_config
    
    #获取项目根目录（在函数开始处定义，确保后续代码可以使用）
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    #获取模型路径
    model_path = manager.get_model_path()
    logger.info(f"模型路径: {model_path}")
    
    #确定量化方法
    if args.method == "auto":
        method = manager.get_quantization_method()
    else:
        method = args.method
        
    #检查方法是否可用
    available_backends = manager.get_available_backends()
    if method != "none" and not available_backends.get(method,False):
        logger.warning(f"量化方法{method}不可用,请检查依赖库安装")
        available_methods = [m for m,avaliable in available_backends.items() if avaliable]
        logger.info(f"可用的量化方法: {available_methods}")
        return
    
    #确定输出目录 - 量化后的模型保存到data/disk/models/quantized目录
    if args.output_dir:
        output_dir = args.output_dir
    else:
        # 从模型路径提取模型名称
        model_name = os.path.basename(model_path.rstrip('/'))
        if not model_name or model_name == '.':
            model_name = os.path.basename(os.path.dirname(model_path.rstrip('/')))
        # 构建输出目录：data/disk/models/quantized/{model_name}_{method}_quantized
        output_dir = os.path.join("/data/disk/models/quantized", f"{model_name}_{method}_quantized")
        
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"输出目录: {output_dir}")
    
    #加载分词器
    tokenizer = manager._load_tokenizer(model_path)
    
    #获取校准数据路径
    if args.calibration_file:
        calibration_path = args.calibration_file
        # 如果是相对路径，基于项目根目录
        if not os.path.isabs(calibration_path):
            calibration_path = os.path.join(project_root, calibration_path)
    else:
        calibration_path = calibration_config.get("dataset_path","data/train/calibration.json")
        # 如果是相对路径，基于项目根目录
        if not os.path.isabs(calibration_path):
            calibration_path = os.path.join(project_root, calibration_path)
        
    #加载校准数据(对于GPTQ和AWQ)
    if method in ["gptq","awq"]:
        calibration_data = load_calibration_data(calibration_path,args.max_samples)
        # 添加调试信息
        logger.info(f"校准数据类型: {type(calibration_data)}")
        if calibration_data and len(calibration_data) > 0:
            logger.info(f"第一个样本类型: {type(calibration_data[0])}")
            logger.info(f"第一个样本: {str(calibration_data[0])[:100]}")  # 只显示前100个字符
    else:
        calibration_data = None
        
    #创建方法配置的副本，并应用命令行参数覆盖
    method_config = methods_config.get(method,{}).copy()
    if args.bits:
        method_config["bits"] = args.bits
    if args.group_size:
        method_config["group_size"] = args.group_size
        
    #加载原始模型(对于动态量化)
    if method == "dynamic":
        logger.info(f"开始动态量化")
        model = manager.load_model()
    else:
        model = None
    
    #执行量化过程
    if method == "gptq":
        quantize_gptq(model_path,tokenizer,model,calibration_data,output_dir,method_config)
    elif method == "awq":
        quantize_awq(model_path,tokenizer,model,calibration_data,output_dir,method_config)
    elif method == "bnb":
        quantize_bnb(model_path,output_dir,method_config)
    elif method == "dynamic":
        quantize_dynamic(model_path,model,output_dir,method_config)
    else:
        logger.error(f"不支持的量化方法: {method}")
        return
    
    #保存量化配置
    config_path = os.path.join(output_dir,"quantization_config.json")
    with open(config_path,"w",encoding="utf-8") as f:
        json.dump(
            {
                "method":method,
                "config":method_config,
                "orginal_model":model_path
            },f,indent=2
        )
        
    logger.info(f"量化完成,方法: {method}, 量化模型保存在: {output_dir}")
    
    #验证量化后的模型
    verify_quantized_model(output_dir,tokenizer,method)
    
    logger.info("量化流程完成了(～￣▽￣)～")
    
if __name__ == "__main__":
    main()
#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import argparse
import sys
import chardet
from pathlib import Path
from typing import Dict,List,Optional,Tuple,Any

# 添加项目根目录到系统路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.utils.config_manager import ConfigManager
from src.utils.logger import setup_logger

logger = setup_logger("prepare_data")

def detect_encoding(file_path, sample_size=4096):
    """检测文件编码"""
    with open(file_path, 'rb') as f:
        raw_data = f.read(sample_size)
        result = chardet.detect(raw_data)
        encoding = result['encoding']
        confidence = result['confidence']
        logger.debug(f"文件 {file_path} 检测到编码: {encoding}, 置信度: {confidence}")
        return encoding if confidence > 0.7 else 'utf-8'

def load_json_files(source_dir:Path)->List[Dict[str,Any]]:
    """加载目录中的所有JSON文件并合并数据，包括所有子目录"""
    all_data = []
    
    if not source_dir.exists():
        logger.error(f"源目录不存在: {source_dir}")
        return all_data
    
    #遍历目录中的所有JSON文件
    for file_path in source_dir.glob("**/*.json"):
        try:
            # 检测文件编码
            encoding = detect_encoding(file_path)
            logger.info(f"加载文件: {file_path}, 使用编码: {encoding}")
            
            with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                try:
                    data = json.load(f)
                    if isinstance(data,list):
                        logger.info(f"加载文件:{file_path},数据条目:{len(data) if isinstance(data,list) else 1}")
                        all_data.extend(data)
                    else:
                        all_data.append(data)
                        logger.info(f"加载文件:{file_path},数据条目:1")
                except json.JSONDecodeError as e:
                    logger.error(f"JSON解析错误: {file_path}, {str(e)}")
        except Exception as e:
            logger.error(f"加载文件失败: {file_path},错误信息: {e}")
            
    return all_data

def format_data_for_training(data:List[Dict[str,Any]],text_field:str="text")->List[Dict[str,str]]:
    """格式化数据用于训练
    
    Args:
        data (List[Dict[str,Any]]): 输入数据列表
        text_field (str): 文本字段名,默认为"text"
        
    Returns:
        List[Dict[str,str]]: 格式化后的数据列表
    """
    formatted_data = []
    
    for item in data:
        #针对不同格式的数据进行处理
        if isinstance(item,dict):
            if "instruciton" in item and "input" in item and "output" in item:
                #生成应该高质量样本
                instruction = item["instruction"].strip()
                input_text = item["input"].strip()
                output_text = item["output"].strip()
                
                if input_text:
                    formatted_text = f"用户: {instruction}\n{input_text}\n\n助手: {output_text}"
                else:
                    formatted_text = f"用户：{instruction}\n\n助手：{output_text}"
                
                formatted_data.append({text_field:formatted_text})
            
            #处理对话类型数据
            elif "conversations" in item:
                conversation = ""
                for turn in item["conversations"]:
                    if "from" in turn and "value" in turn:
                        role = "用户" if turn["from"] == "human" else "助手"
                        conversation += f"{role}：{turn['value'].strip()}\n"
                
                if conversation:
                    formatted_data.append({text_field:conversation.strip()})
            
            #处理角色对话数据 - Evol-character格式
            elif "setting" in item and "iqa" in item:
                try:
                    # 提取角色设定
                    character_name = item["setting"].get("角色名称", "未知角色")
                    character_desc = item["setting"].get("角色简短介绍", "")
                    character_personality = item["setting"].get("性格特征", "")
                    
                    # 处理所有问答对
                    for qa_group in item.get("iqa", []):
                        person = qa_group.get("identity", "用户")
                        relationship = qa_group.get("relationship", "")
                        
                        # 对每个问答对创建一个独立的样本
                        for conv in qa_group.get("convs", []):
                            question = conv.get("question", "").strip()
                            answer = conv.get("answer", "").strip()
                            
                            if question and answer:
                                formatted_text = f"角色: {character_name}\n性格: {character_personality}\n\n用户({person}): {question}\n\n助手({character_name}): {answer}"
                                formatted_data.append({text_field:formatted_text})
                except Exception as e:
                    logger.error(f"处理Evol-character数据失败: {e}")
            
            #处理角色对话数据
            elif "character" in item and "dialogue" in item:
                dialogue = f"角色：{item['character']}\n\n"
                for entry in item["dialogue"]:
                    if isinstance(entry,dict) and "content" in entry:
                        speaker = entry.get("speaker","角色")
                        dialogue += f"{speaker}：{entry['content'].strip()}\n"

                formatted_data.append({text_field:dialogue.strip()})
                    
            #处理其他类型数据
            elif text_field in item:
                formatted_data.append({text_field:item[text_field].strip()})
            
            else:
                logger.warning(f"未知的样本格式,跳过样本: {item}")
                
    return formatted_data

def split_data(data:List[Dict[str,Any]],config:Dict)->Dict[str,List[Dict[str,Any]]]:
    """按照配置文件中的比例将数据分割为训练集、验证集和测试集"""
    import random
    
    split_config = config.get("dataset_splitting",{})
    train_ratio = split_config.get("train",0.8)
    valid_ratio = split_config.get("validation",0.1)
    test_ratio = split_config.get("test",0.1)
    seed = split_config.get("seed",42)
    
    #设置随机种子
    random.seed(seed)
    random.shuffle(data)
    
    total = len(data)
    train_size = int(total * train_ratio)
    valid_size = int(total * valid_ratio)
    
    train_data = data[:train_size]
    valid_data = data[train_size:train_size+valid_size]
    test_data = data[train_size+valid_size:]
    
    return {
        "train":train_data,
        "validation":valid_data,
        "test":test_data
    }
    
def main():
    parser = argparse.ArgumentParser(description="准备训练数据")
    parser.add_argument("--data_config",type=str,default="./config/data_config.json",help="数据配置文件路径")
    parser.add_argument("--output_dir",type=str,default="./data/train",help="输出目录")
    parser.add_argument("--text_field",type=str,default="text",help="文本字段名")
    args = parser.parse_args()
    
    #加载数据配置
    config_manager = ConfigManager(Path("./config"))
    with open(args.data_config,"r",encoding="utf-8") as f:
        data_config = json.load(f)
    
    #创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True,exist_ok=True)
    
    all_data = []
    
    #从配置中读取数据源
    data_sources = data_config.get("data_sources",[])
    for source_name,source_info in data_sources.items():
        if source_info.get("enabled",False):
            source_path = Path(source_info.get("path",""))
            if source_path:
                logger.info(f"处理数据源: {source_name} 从 {source_path}")
                source_data = load_json_files(Path(source_path))
                logger.info(f"数据源: {source_name} 加载完成,数据条目: {len(source_data)}")
                all_data.extend(source_data)
                
    logger.info(f"总数据条目: {len(all_data)}")
    
    #格式化数据
    formatted_data = format_data_for_training(all_data,args.text_field)
    logger.info(f"格式化后数据条目: {len(formatted_data)}")
    
    #分割数据
    split_datasets = split_data(formatted_data,data_config)
    
    #保存分割后的数据
    train_file = output_dir / "train.json"
    valid_file = output_dir / "val.json"
    test_file = output_dir / "test.json"
    
    with open(train_file,"w",encoding="utf-8") as f:
        json.dump(split_datasets["train"],f,ensure_ascii=False,indent=2)
    logger.info(f"训练集已保存到: {train_file},{len(split_datasets['train'])}条数据")
    
    with open(valid_file,"w",encoding="utf-8") as f:
        json.dump(split_datasets["validation"],f,ensure_ascii=False,indent=2)
    logger.info(f"验证集已保存到: {valid_file},{len(split_datasets['validation'])}条数据")
    
    with open(test_file,"w",encoding="utf-8") as f:
        json.dump(split_datasets["test"],f,ensure_ascii=False,indent=2)
    logger.info(f"测试集已保存到: {test_file},{len(split_datasets['test'])}条数据")
    
    logger.info("数据准备完成")
    
if __name__ == "__main__":
    main()
    
    
    



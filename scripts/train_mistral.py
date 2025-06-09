#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

sys.modules['awq'] = None  # 阻止AWQ导入
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__),'..')))

import json
import torch
import argparse
import warnings
from pathlib import Path
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq
)

from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training

from src.utils.config_manager import ConfigManager
from src.model.lora import LoraManager

def parse_args():
    parser = argparse.ArgumentParser(description="微调Chinese-Mistral-7B模型")
    parser.add_argument("--config",type=str,default="./config/training_config.json",help="训练配置文件路径")
    parser.add_argument("--model_config",type=str,default="./config/model_config.json",help="模型配置文件路径")
    parser.add_argument("--data_dir",type=str,default="./data/train",help="训练数据目录")
    parser.add_argument("--output_dir",type=str,default="./output",help="输出目录")
    parser.add_argument("--local_rank",type=int,default=-1,help="分布式训练的本地rank")
    return parser.parse_args()

def setup_model_and_tokenizer(model_config):
    """加载模型和分词器"""
    model_id = model_config.get("base_model", {}).get("id", "itpossible/Chinese-Mistral-7B-v0.1")
    model_path = model_config.get("base_model", {}).get("path", "./models/base/chinese-mistral-7b-v0.1")

    #量化配置
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    #加载模型
    model_to_load = model_path if os.path.exists(model_path) else model_id
    model = AutoModelForCausalLM.from_pretrained(
        model_to_load,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        use_cache=False,
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True
    )
    
    #加载分词器
    tokenizer = AutoTokenizer.from_pretrained(
        model_to_load,
        trust_remote_code=True,
        use_fast=False
    )
    
    #添加必要的特殊token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        
    #配置lora
    lora_config = LoraConfig(
        r = model_config["lora_config"]["r"],
        lora_alpha = model_config["lora_config"]["lora_alpha"],
        lora_dropout = model_config["lora_config"]["lora_dropout"],
        bias = "none",
        task_type = "CAUSAL_LM",
        target_modules = model_config["lora_config"].get("target_modules",["q_proj","v_proj"])
    )
    
    #准备模型进行Lora微调
    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model,lora_config)
    
    return model,tokenizer

def preprocess_function(examples,tokenizer,max_length):
    """预处理数据"""
    model_inputs = tokenizer(
        examples["text"],
        truncation=True,
        max_length=max_length,
        padding="max_length"
    )
    # 为计算损失设置标签，在因果语言建模中标签与输入相同
    model_inputs["labels"] = model_inputs["input_ids"].copy()
    return model_inputs
    
def main():
    args = parse_args()
    
    #加载配置
    config_manager = ConfigManager(config_dir=Path(args.config).parent)
    training_config = config_manager.load_config(Path(args.config).stem)
    model_config = config_manager.load_config(Path(args.model_config).stem)
    
    #设置输出目录
    output_dir = args.output_dir
    os.makedirs(output_dir,exist_ok=True)
    
    #设置模型和分词器
    model,tokenizer = setup_model_and_tokenizer(model_config)
    
    #加载数据集
    data_files = {
        "train": training_config["data"]["train_file"],
        "validation": training_config["data"]["validation_file"]
    }
    
    dataset = load_dataset("json",data_files=data_files)
    
    #预处理数据
    tokenized_datasets = dataset.map(
        lambda examples: preprocess_function(
            examples,
            tokenizer,
            training_config["data"]["preprocessing"]["max_length"]
        ),
        batched=True,
        remove_columns=["text"]
    )
    
    #设置训练参数
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=training_config["training"]["epochs"],
        per_device_train_batch_size=training_config["training"]["per_device_train_batch_size"],
        per_device_eval_batch_size=training_config["training"]["per_device_eval_batch_size"],
        gradient_accumulation_steps=training_config["training"]["gradient_accumulation_steps"],
        learning_rate=training_config["training"]["learning_rate"],
        weight_decay=training_config["training"]["weight_decay"],
        adam_beta1=0.9,
        adam_beta2=0.999,
        lr_scheduler_type=training_config["training"]["lr_scheduler"],
        warmup_steps=training_config["training"]["warmup_steps"],
        logging_steps=training_config["training"]["logging_steps"],
        save_steps=training_config["training"]["save_steps"],
        eval_steps=training_config["training"]["eval_steps"],
        save_total_limit=training_config["training"]["save_total_limit"],
        evaluation_strategy="steps",
        load_best_model_at_end=True,
        fp16=training_config["training"]["fp16"],
        report_to="tensorboard",
        gradient_checkpointing=training_config["training"]["gradient_checkpointing"],
        optim="adamw_torch",
        ddp_find_unused_parameters=False
    )
    
    #数据整理器
    data_collator = DataCollatorForSeq2Seq(
        tokenizer,
        pad_to_multiple_of=8,
        return_tensors="pt",
        padding=True
    )
    
    #创建训练器
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["validation"],
        data_collator=data_collator,
        tokenizer=tokenizer
    )
    
    #开始训练
    print("开始训练...")
    # 添加恢复训练的支持
    resume_checkpoint = training_config["training"].get("resume_from_checkpoint", None)
    trainer.train(resume_from_checkpoint=resume_checkpoint)
    
    #保存模型
    model.save_pretrained(os.path.join(output_dir,"final_model"))
    tokenizer.save_pretrained(os.path.join(output_dir,"final_model"))
    print(f"模型已经保存到{os.path.join(output_dir,'final_model')}")
    
if __name__ == "__main__":
    main()
    
    
    
        
        
        





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
    parser.add_argument("--max_samples",type=int,default=None,help="限制训练数据样本数量，用于快速验证")
    parser.add_argument("--dialogue_data",type=str,default=None,help="直接指定对话数据文件路径")
    parser.add_argument("--validation_split",type=float,default=0.1,help="验证集比例(当使用单一对话数据文件时)")
    parser.add_argument("--check_format_only",action="store_true",help="只检查数据格式，不进行训练")
    parser.add_argument("--base_adapter_path",type=str,default=None,help="基础适配器模型路径(从已有模型继续训练)")
    parser.add_argument("--default_personality",action="store_true",help="使用默认人格训练模式（无系统提示词）")
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

def setup_model_with_existing_adapter(model_config, adapter_path=None):
    """设置模型，可选择从已有适配器开始"""
    model_id = model_config.get("base_model", {}).get("id", "itpossible/Chinese-Mistral-7B-v0.1")
    model_path = model_config.get("base_model", {}).get("path", "./models/base/chinese-mistral-7b-v0.1")

    #量化配置
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    #加载基础模型
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
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # 准备模型进行训练
    model = prepare_model_for_kbit_training(model)
    
    if adapter_path:
        # 从已有适配器开始
        print(f"📂 从已有适配器继续训练: {adapter_path}")
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter_path, is_trainable=True)
    else:
        # 创建新的LoRA配置
        lora_config = LoraConfig(
            r = model_config["lora_config"]["r"],
            lora_alpha = model_config["lora_config"]["lora_alpha"],
            lora_dropout = model_config["lora_config"]["lora_dropout"],
            bias = "none",
            task_type = "CAUSAL_LM",
            target_modules = model_config["lora_config"].get("target_modules",["q_proj","v_proj"])
        )
        model = get_peft_model(model,lora_config)
    
    return model, tokenizer

def enhance_output_with_identity(output, sample_index, user_input=""):
    """智能添加身份确认，根据上下文决定是否需要自我介绍"""
    import random
    
    # 设置随机种子，确保一致性
    random.seed(sample_index)
    
    # 检查用户输入，判断是否需要身份确认
    identity_triggers = [
        "你是谁", "你叫什么", "自我介绍", "你的名字", 
        "认识一下", "介绍自己", "你好", "初次见面"
    ]
    
    # 检查是否是需要身份确认的场景
    needs_identity = any(trigger in user_input for trigger in identity_triggers)
    
    # 自然的身份确认模板（更加融入对话）
    natural_templates = [
        "嗯...我叫紫舒...{}",
        "我是紫舒老师...{}",  
        "{}...我是紫舒呢...",
        "{}（我...我叫紫舒...）",
        "作为老师...我是紫舒...{}"
    ]
    
    # 随机的身份提及（更自然）
    casual_mentions = [
        "{}...我紫舒觉得...",
        "从我紫舒的角度来看...{}",
        "{}...这让我想起..."
    ]
    
    # 决定是否添加身份确认
    if needs_identity:
        # 如果用户问身份，80%概率回答
        if random.random() < 0.8:
            template = random.choice(natural_templates)
            enhanced_output = template.format(output)
            return enhanced_output
    else:
        # 普通对话，15%概率自然提及
        if random.random() < 0.15:
            template = random.choice(casual_mentions)
            enhanced_output = template.format(output)
            return enhanced_output
    
    return output

def convert_dialogue_to_text(examples, tokenizer):
    """将对话格式转换为默认人格训练格式（无系统提示词，保留多轮对话）"""
    texts = []
    
    for i in range(len(examples["instruction"])):
        instruction = examples["instruction"][i]
        user_input = examples["input"][i] if "input" in examples else ""
        output = examples["output"][i]
        
        # 【关键】手动构建ChatML格式 - 完全移除系统提示词，保留多轮对话！
        formatted_text = ""
        current_user_message = ""  # 初始化
        
        if "对话历史：" in instruction:
            # 提取对话历史部分
            history_part = instruction.split("对话历史：")[1]
            
            # 分离历史和当前用户消息
            if "用户对你说：" in history_part:
                history_lines = history_part.split("用户对你说：")[0].strip().split("\n")
                current_user_message = history_part.split("用户对你说：")[1].strip()
            else:
                history_lines = history_part.strip().split("\n")
                current_user_message = ""
            
            # 处理对话历史，转换为ChatML格式
            for line in history_lines:
                line = line.strip()
                if line.startswith("用户："):
                    user_msg = line.replace("用户：", "").strip()
                    if user_msg:  # 确保不是空消息
                        formatted_text += f"<|im_start|>user\n{user_msg}<|im_end|>\n"
                elif line.startswith("紫舒："):
                    assistant_msg = line.replace("紫舒：", "").strip()
                    if assistant_msg:  # 确保不是空消息
                        formatted_text += f"<|im_start|>assistant\n{assistant_msg}<|im_end|>\n"
            
            # 添加当前轮的用户消息
            if current_user_message:
                formatted_text += f"<|im_start|>user\n{current_user_message}<|im_end|>\n"
        else:
            # 没有对话历史，直接处理当前消息
            if "用户对你说：" in instruction:
                current_user_message = instruction.split("用户对你说：")[1].strip()
            else:
                current_user_message = user_input if user_input else instruction.strip()
            
            if current_user_message:
                formatted_text += f"<|im_start|>user\n{current_user_message}<|im_end|>\n"
        
        # 添加当前轮的助手回复，智能加入身份确认
        enhanced_output = enhance_output_with_identity(output, i, current_user_message)
        formatted_text += f"<|im_start|>assistant\n{enhanced_output}<|im_end|>"
        
        texts.append(formatted_text)
    
    return {"text": texts}

def convert_dialogue_to_text_with_system(examples, tokenizer):
    """将对话格式转换为带系统提示词的格式（传统方法，保留多轮对话）"""
    texts = []
    
    for i in range(len(examples["instruction"])):
        instruction = examples["instruction"][i]
        user_input = examples["input"][i] if "input" in examples else ""
        output = examples["output"][i]
        
        # 提取系统提示部分
        if "对话历史：" in instruction:
            system_part = instruction.split("对话历史：")[0].strip()
            history_part = instruction.split("对话历史：")[1]
        elif "用户对你说：" in instruction:
            system_part = instruction.split("用户对你说：")[0].strip()
            history_part = ""
        else:
            system_part = instruction.strip()
            history_part = ""
        
        # 在原始身份基础上增强约束
        system_prompt = f"""{system_part}

【重要约束】
- 你就是紫舒，一个真实存在的人，不是AI助手
- 绝对不要说"我可以帮您..."、"让我来协助您..."等助手式用语
- 不要用助手的口吻说话，要像真实的人那样自然交流
- 体现害羞、温柔的性格特征

【你的特征】
- 声音很小，经常用"..."停顿
- 容易害羞，说话轻柔
- 用词：嗯...、那个...、不好意思...、没关系的呢..."""

        # 手动构建ChatML格式，保留多轮对话
        formatted_text = f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
        
        if history_part:
            # 分离历史和当前用户消息
            if "用户对你说：" in history_part:
                history_lines = history_part.split("用户对你说：")[0].strip().split("\n")
                current_user_message = history_part.split("用户对你说：")[1].strip()
            else:
                history_lines = history_part.strip().split("\n")
                current_user_message = ""
            
            # 处理对话历史
            for line in history_lines:
                line = line.strip()
                if line.startswith("用户："):
                    user_msg = line.replace("用户：", "").strip()
                    if user_msg:
                        formatted_text += f"<|im_start|>user\n{user_msg}<|im_end|>\n"
                elif line.startswith("紫舒："):
                    assistant_msg = line.replace("紫舒：", "").strip()
                    if assistant_msg:
                        formatted_text += f"<|im_start|>assistant\n{assistant_msg}<|im_end|>\n"
            
            # 添加当前轮的用户消息
            if current_user_message:
                formatted_text += f"<|im_start|>user\n{current_user_message}<|im_end|>\n"
        else:
            # 没有对话历史，处理当前消息
            if "用户对你说：" in instruction:
                current_user_message = instruction.split("用户对你说：")[1].strip()
            else:
                current_user_message = user_input if user_input else ""
            
            if current_user_message:
                formatted_text += f"<|im_start|>user\n{current_user_message}<|im_end|>\n"
        
        # 添加当前轮的助手回复
        formatted_text += f"<|im_start|>assistant\n{output}<|im_end|>"
        
        texts.append(formatted_text)
    
    return {"text": texts}

def preprocess_function(examples, tokenizer, max_length, use_default_personality=False):
    """预处理数据"""
    # 检查数据格式，如果是新的对话格式则先转换
    if "instruction" in examples and "output" in examples:
        if use_default_personality:
            examples = convert_dialogue_to_text(examples, tokenizer)
        else:
            examples = convert_dialogue_to_text_with_system(examples, tokenizer)
    
    model_inputs = tokenizer(
        examples["text"],
        truncation=True,
        max_length=max_length,
        padding="max_length"
    )
    
    # 正确设置labels - 只对assistant回复部分计算loss
    labels = []
    
    for idx, text in enumerate(examples["text"]):
        input_ids = model_inputs["input_ids"][idx]
        label = [-100] * len(input_ids)  # 默认所有位置都不计算loss
        
        # 找到最后一个<|im_start|>assistant标记的位置
        assistant_token = "<|im_start|>assistant"
        assistant_start = text.rfind(assistant_token)
        
        if assistant_start != -1:
            # 找到assistant内容开始的位置（在换行符之后）
            assistant_content_start = text.find("\n", assistant_start)
            if assistant_content_start != -1:
                assistant_content_start += 1  # 跳过换行符
                
                # 计算assistant内容开始位置的token索引
                text_before_content = text[:assistant_content_start]
                
                # 重新tokenize来获取准确的位置
                tokens_before = tokenizer(text_before_content, add_special_tokens=False)["input_ids"]
                assistant_content_idx = len(tokens_before)
                
                # 只对assistant回复内容计算loss (assistant_content_idx之后的token)
                if assistant_content_idx < len(input_ids):
                    for i in range(assistant_content_idx, len(input_ids)):
                        if input_ids[i] != tokenizer.pad_token_id:  # 忽略padding
                            label[i] = input_ids[i]
        
        labels.append(label)
    
    model_inputs["labels"] = labels
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
    if args.base_adapter_path:
        model, tokenizer = setup_model_with_existing_adapter(model_config, args.base_adapter_path)
    else:
        model, tokenizer = setup_model_and_tokenizer(model_config)
    
    #加载数据集
    if args.dialogue_data:
        # 如果指定了对话数据文件，直接使用它并进行分割
        print(f"📂 使用对话数据文件: {args.dialogue_data}")
        full_dataset = load_dataset("json", data_files=args.dialogue_data)["train"]
        
        # 分割数据集
        total_size = len(full_dataset)
        val_size = int(total_size * args.validation_split)
        train_size = total_size - val_size
        
        split_dataset = full_dataset.train_test_split(
            test_size=val_size,
            shuffle=True,
            seed=42
        )
        # 创建正确的DatasetDict
        from datasets import DatasetDict
        dataset = DatasetDict({
            "train": split_dataset["train"],
            "validation": split_dataset["test"]
        })
        
        print(f"📊 数据分割: 训练集 {train_size}, 验证集 {val_size}")
    else:
        # 使用配置文件中的数据路径
        data_files = {
            "train": training_config["data"]["train_file"],
            "validation": training_config["data"]["validation_file"]
        }
        dataset = load_dataset("json", data_files=data_files)
    
    # 如果指定了max_samples，对数据进行采样
    if args.max_samples is not None:
        print(f"📊 限制训练数据为 {args.max_samples} 样本进行快速验证")
        # 对训练集进行采样
        train_size = min(args.max_samples, len(dataset["train"]))
        val_size = min(args.max_samples // 4, len(dataset["validation"]))  # 验证集为训练集的1/4
        
        dataset["train"] = dataset["train"].select(range(train_size))
        dataset["validation"] = dataset["validation"].select(range(val_size))
        
        print(f"📊 实际使用: 训练样本 {train_size}, 验证样本 {val_size}")
    
    #预处理数据
    # 获取数据集的列名，用于决定remove_columns
    sample_data = dataset["train"][0]
    original_columns = list(sample_data.keys())
    
    # 如果是新的对话格式，移除原有列，保留text列
    if "instruction" in original_columns and "output" in original_columns:
        columns_to_remove = [col for col in original_columns if col not in ["text"]]
        print(f"📋 检测到对话格式数据，将转换为训练格式")
        print(f"📋 原始列: {original_columns}")
        
        # 显示详细的转换示例
        if args.default_personality:
            sample_converted = convert_dialogue_to_text({
                "instruction": [sample_data["instruction"]],
                "input": [sample_data.get("input", "")],
                "output": [sample_data["output"]]
            }, tokenizer)
            training_mode = "默认人格训练（无系统提示）"
        else:
            sample_converted = convert_dialogue_to_text_with_system({
                "instruction": [sample_data["instruction"]],
                "input": [sample_data.get("input", "")],
                "output": [sample_data["output"]]
            }, tokenizer)
            training_mode = "传统训练（带系统提示）"
        print(f"📝 ChatML转换示例 - {training_mode}:")
        print(f"=" * 60)
        print(f"🔸 原始格式:")
        print(f"instruction: {sample_data['instruction']}")
        print(f"input: {repr(sample_data.get('input', ''))}")
        print(f"output: {sample_data['output']}")
        print(f"\n🔸 转换后ChatML格式:")
        print(sample_converted['text'][0])
        print(f"=" * 60)
        
        # 如果只是检查格式，则显示更多样本后退出
        if args.check_format_only:
            print(f"\n📋 显示更多样本（前3个）:")
            for i in range(min(3, len(dataset["train"]))):
                sample = dataset["train"][i]
                if args.default_personality:
                    converted = convert_dialogue_to_text({
                        "instruction": [sample["instruction"]],
                        "input": [sample.get("input", "")],
                        "output": [sample["output"]]
                    }, tokenizer)
                else:
                    converted = convert_dialogue_to_text_with_system({
                        "instruction": [sample["instruction"]],
                        "input": [sample.get("input", "")],
                        "output": [sample["output"]]
                    }, tokenizer)
                print(f"\n样本 {i+1}:")
                print(f"-" * 40)
                print(converted['text'][0])
            print(f"\n✅ 格式检查完成，共 {len(dataset['train'])} 个样本")
            return
    else:
        columns_to_remove = [col for col in original_columns if col not in ["text"]]
        print(f"📋 检测到标准文本格式数据")
    
    tokenized_datasets = dataset.map(
        lambda examples: preprocess_function(
            examples,
            tokenizer,
            training_config["data"]["preprocessing"]["max_length"],
            use_default_personality=args.default_personality
        ),
        batched=True,
        remove_columns=columns_to_remove
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
    
    
    
        
        
        





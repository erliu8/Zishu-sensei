#! /usr/bin/env python3
# -*- coding: utf-8 -*-
# @Time    : 2025/5/14 10:00
# @Author  : erliu
# @File    : training.py
# @Software: PyCharm

import os
import json
import logging
import time
from pathlib import Path
from typing import Dict,Any,Optional,List,Tuple,Union

import torch
import transformers
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
    default_data_collator,
    get_scheduler
)

from transformers.trainer_utils import get_last_checkpoint
from datasets import load_dataset,Dataset
from torch.utils.data import DataLoader
from tqdm import tqdm

from .lora import LoraManager,get_peft_model
from ..utils.performance import get_performance_monitor
from ..utils.thread_factory import get_thread_factory
from ..utils.config_manager import ConfigManager

class TrainingManager(LoraManager):
    """
    训练管理类，负责模型训练、评估、保存等操作
    """
    
    def __init__(self,
                 config_path:Union[str,Path],
                 device:Optional[str]=None,
                 traning_config_path:Optional[Union[str,Path]]=None
                 ):
        """
        初始化训练管理器

        Args:
            config_path (Union[str,Path]): 配置文件路径
            device (Optional[str], optional): 设备类型，可选"cpu"、"cuda"、"auto"
            traning_config (Optional[Union[str,Path]], optional): 训练配置文件路径. Defaults to None.

        """
        super().__init__(config_path,device)
        
        #加载训练配置
        self.traning_config_path = Path(traning_config_path or "./config/training_config.json")
        self.logger = logging.getLogger(__name__)
        self.performance_monitor = get_performance_monitor()
        
        try:
            with open(self.traning_config_path,"r",encoding="utf-8") as f:
                self.traning_config = json.load(f)
        except Exception as e:
            self.logger.error(f"加载训练配置文件失败: {e}")
            raise RuntimeError(f"加载训练配置文件失败: {e}")
        
        #训练状态
        self.trainer = None
        self.training_args = None
        self.tokenizer = None
        self.model = None
    
    def prepare_dataset(self,
                        data_path:Optional[Union[str,Path]]=None,
                        validation_data_path:Optional[Union[str,Path]]=None,
                        text_column:str="text",
                        max_length:int=2048)->Tuple[Dataset,Dataset]:
        """
        准备训练和验证数据集
        
        Args:
            data_path (Optional[Union[str,Path]], optional): 训练数据路径. Defaults to None.
            validation_data_path (Optional[Union[str,Path]], optional): 验证数据路径. Defaults to None.
            text_column (str, optional): 文本列名. Defaults to "text".
            max_length (int, optional): 最大长度. Defaults to 2048.

        Returns:
            Tuple[Dataset,Dataset]: 训练和验证数据集
        """
        data_config = self.traning_config.get("data_path",{})
        
        #使用配置文件中的路径（如果未指定参数）
        data_path = data_path or data_config.get("train_file")
        validation_path = validation_path or data_config.get("validation_file")
        
        #使用配置文件中的预处理参数（如果未指定参数）
        preprocess_config = data_config.get("preprocess",{})
        text_column = text_column or preprocess_config.get("text_column","text")
        max_length = max_length or preprocess_config.get("max_length",2048)
        add_eos_token = preprocess_config.get("add_eos_token",True)
        
        if not data_path:
            raise ValueError("训练数据路径不能为空")
        
        #加载分词器
        if self.tokenizer is None:
            self.tokenizer = self.load_tokenizer()
            
        #检查训练数据路径
        data_path = Path(data_path)
        if not data_path.exists():
            raise FileNotFoundError(f"训练数据路径不存在: {data_path}")
        
        self.logger.info(f"加载训练数据: {data_path}")
        
        #加载训练数据集
        data_files = {}
        data_files["train"] = str(data_path)
        if validation_path and Path(validation_path).exists():
            data_files["validation"] = str(validation_path)
            self.logger.info(f"加载验证数据: {validation_path}")
            
        #根据文件扩展名确定数据格式
        extension = data_path.suffix.lower()
        if extension == ".json":
            dataset = load_dataset("json",data_files=data_files)
        elif extension == ".csv":
            dataset = load_dataset("csv",data_files=data_files)
        elif extension == ".txt":
            dataset = load_dataset("text",data_files=data_files)
        else:
            raise ValueError(f"不支持的数据格式: {extension}")
        
        #预处理函数
        def tokenize_function(examples):
            texts = examples[text_column]
            
            #确定文本是字符串列表
            if isinstance(texts,str):
                texts = [texts]
            
            #添加EOS标记
            if add_eos_token:
                texts = [t +self.tokenizer.eos_token for t in texts]
            
            #分词
            tokenized = self.tokenizer(
                texts,
                truncation=True,
                max_length=max_length,
                padding="max_length",
                return_tensors="pt"
            )
            
            return tokenized
        
        #应用预处理函数
        tokenized_datasets = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=[col for col in dataset["train"].column_names if col != text_column]
        )
        
        train_dataset = tokenized_datasets["train"]
        
        #验证集
        validation_dataset = None
        if "validation" in tokenized_datasets:
            validation_dataset = tokenized_datasets["validation"]
            
        self.logger.info(f"数据集准备完成：训练集{len(train_dataset)}条，验证集{len(validation_dataset) if validation_dataset else "无验证集"}")
        return train_dataset,validation_dataset
    
    def prepare_training_args(self,
                              output_dir:Optional[Union[str,Path]]=None,
                              **kwargs)->TrainingArguments:
        """
        准备训练参数
        
        Args:
            output_dir (Optional[Union[str,Path]], optional): 输出目录. Defaults to None.
            **kwargs: 其他训练参数

        Returns:
            TrainingArguments: 训练参数
        """
        train_config = self.traning_config.get("training",{})
        
        #默认输出目录
        if output_dir is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            model_name = self.get_model_path().split("/")[-1]
            output_dir = f"./models/adapters/{model_name}_ft_{timestamp}"
            
        #创建输出目录
        os.makedirs(output_dir,exist_ok=True)
        
        #设置训练参数
        training_args = TrainingArguments(
            output_dir=output_dir,
            per_device_eval_batch_size=kwargs.get("batch_size",train_config.get("batch_size",4)),
            per_device_eval_batch_size=kwargs.get("batch_size",train_config.get("batch_size",4)),
            gradient_accumulation_steps=kwargs.get("gradient_accumulation_steps",train_config.get("gradient_accumulation_steps",4)),
            
            learning_rate=kwargs.get("learning_rate",train_config.get("learning_rate",2e-4)),
            num_train_epochs=kwargs.get("epochs",train_config.get("epochs",3)),
            weight_decay=kwargs.get("weight_decay",train_config.get("weight_decay",0.01)),
            max_grad_norm=kwargs.get("max_grad_norm",train_config.get("max_grad_norm",1.0)),
            lr_scheduler_type=kwargs.get("lr_scheduler",train_config.get("lr_scheduler","cosine")),
            warmup_steps=kwargs.get("warmup_steps",train_config.get("warmup_steps",200)),
            save_steps=kwargs.get("save_steps",train_config.get("save_steps",500)),
            logging_steps=kwargs.get("logging_steps",train_config.get("logging_steps",10)),
            eval_steps=kwargs.get("eval_steps",train_config.get("eval_steps",100)),
            save_total_limit=kwargs.get("save_total_limit",train_config.get("save_total_limit",3)),
            evaluation_strategy="steps" if "validation" in kwargs else "no",
            save_strategy="steps",
            load_best_model_at_end=True if "validation" in kwargs else False,
            fp16=torch.cuda.is_available(),
            gradient_checkpointing=train_config.get("gradient_checkpointing",True),
            report_to="tensorboard",
            remove_unused_columns=False,
            optim="adamw_torch",
            **{
                k:v for k,v in kwargs.items() if k not in [
                    "batch_size","gradient_accumulation_steps","learning_rate","epochs",
                    "weight_decay","max_grad_norm","lr_scheduler","warmup_steps",
                    "save_steps","logging_steps","eval_steps","save_total_limit"
                ]
            }
        )
        self.training_args = training_args
        self.logger.info(f"训练参数准备完成: {training_args}")

        return training_args
    
    def train(self,
              adapter_name:str,
              train_dataset:Optional[Dataset]=None,
              validation_dataset:Optional[Dataset]=None,
              **kwargs)->str:
        """
        训练模型
        
        Args:
            adapter_name (str): 适配器名称
            train_dataset (Optional[Dataset], optional): 训练数据集. Defaults to None.
            validation_dataset (Optional[Dataset], optional): 验证数据集. Defaults to None.
            **kwargs: 其他训练参数
            
        Returns:
            str: 训练结果
        """
        
        start_time = time.time()
        
        #如果未提供数据集，则使用prepare_dataset准备数据集
        if train_dataset is None:
            train_dataset,validation_dataset = self.prepare_dataset()
            
        #确保输出目录包含适配器名称
        output_dir = kwargs.get("output_dir")
        if output_dir:
            if adapter_name not in str(output_dir):
                output_dir = Path(output_dir) / adapter_name
        
        else:
            output_dir = Path(self.adapter_path) / adapter_name
        
        #更新kwargs以便prepare_training_args使用新的输出目录
        kwargs["output_dir"] = output_dir
        
        #准备训练参数
        training_args = self.prepare_training_args(**kwargs)
        
        #检查是否存在检测点，以便恢复训练
        last_checkpoint = None
        if os.path.isdir(training_args.output_dir):
            last_checkpoint = get_last_checkpoint(training_args.output_dir)
            if last_checkpoint is None:
                self.logger.info("未找到检测点，将从{last_checkpoint}恢复训练")
                
        #准备模型
        #先获取基础模型
        model = self.load_model()
        
        #准备LoRA配置
        lora_config = self.create_lora_config()
        
        #准备4/8位训练
        model = self.prepare_for_training(model)
        
        #应用LoRA适配器
        model = get_peft_model(model,lora_config)
        
        #显示可训练参数
        model.print_trainable_parameters()
        
        #数据收集器
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False
        )
        
        #创建训练器
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=validation_dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator,
        )
        
        #保存训练器
        self.trainer = trainer
        
        #开始训练
        self.logger.info("开始训练...,适配器名称: %s",adapter_name)
        
        try:
            with self.performance_monitor:
                train_result = trainer.train(resume_from_checkpoint=last_checkpoint)
            
            #记录训练性能指标
            metrics = train_result.metrics
            trainer.log_metrics("train",metrics)
            trainer.save_metrics("train",metrics)
            
            #计算训练时间
            training_time = time.time() - start_time
            training_info = {
                "adapter_name":adapter_name,
                "training_time":training_time,
                "epochs":training_args.num_train_epochs,
                "steps":metrics.get("train_steps",0),
                "samples":len(train_dataset),
                "loss":metrics.get("train_loss",0),
                "learning_rate":training_args.learning_rate
            }
            
            #保存训练信息
            with open(os.path.join(training_args.output_dir,"training_info.json"),"w") as f:
                json.dump(training_info,f,ensure_ascii=False,indent=2)
                
            #保存适配器
            self.logger.info("训练完成，保存适配器: %s",adapter_name)
            self.save_adapter(adapter_name,output_dir)
            
            return str(output_dir)
        
        except Exception as e:
            self.logger.error("训练过程中发生错误: %s",e)
            raise RuntimeError(f"训练过程中发生错误: {e}")
        
    def train_async(self,
                    adapter_name:str,
                    train_dataset:Optional[Dataset]=None,
                    validation_dataset:Optional[Dataset]=None,
                    **kwargs)->str:
        """
        异步训练模型
        
        Args:
            adapter_name (str): 适配器名称
            train_dataset (Optional[Dataset], optional): 训练数据集. Defaults to None.
            validation_dataset (Optional[Dataset], optional): 验证数据集. Defaults to None.
            **kwargs: 其他训练参数
            
        Returns:
            str: 任务ID
        """
        thread_factory = get_thread_factory()
        
        return thread_factory.submit_task(
            self.train,
            adapter_name,
            train_dataset,
            validation_dataset,
            **kwargs
        )
    
    def evaluate(self,
                 adapter_name:Optional[str]=None,
                 eval_dataset:Optional[Dataset]=None,
                 metrics:Optional[List[str]]=None)->Dict[str,float]:
        """
        评估模型
        
        Args:
            adapter_name (Optional[str], optional): 适配器名称. Defaults to None.
            eval_dataset (Optional[Dataset], optional): 评估数据集. Defaults to None.
            metrics (Optional[List[str]], optional): 评估指标. Defaults to None.
            
        Returns:
            Dict[str,float]: 评估结果
        """
        #未实现的评估指标
        pass
            
            
       
        
        
            
            
        
        
        
        
        
        
        
        
        
        
    
      
        
        
    
        
        
        

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
from typing import Dict, Any, Optional, List, Tuple, Union

import torch
import transformers
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
    default_data_collator,
    get_scheduler,
)

from accelerate import Accelerator
from accelerate.utils import set_seed_for_device
from peft import get_peft_model
from transformers.trainer_utils import get_last_checkpoint
from datasets import load_dataset, Dataset
from torch.utils.data import DataLoader
from tqdm import tqdm

from .lora import LoraManager
from ..utils.performance import get_performance_monitor
from ..utils.thread_factory import get_thread_factory
from ..utils.config_manager import ConfigManager
from ..utils.efficient_dataloader import create_efficient_dataloader


class TrainingManager(LoraManager):
    """
    训练管理类，负责模型训练、评估、保存等操作
    """

    def __init__(
        self,
        config_path: Union[str, Path],
        device: Optional[str] = None,
        traning_config_path: Optional[Union[str, Path]] = None,
    ):
        """
        初始化训练管理器

        Args:
            config_path (Union[str,Path]): 配置文件路径
            device (Optional[str], optional): 设备类型，可选"cpu"、"cuda"、"auto"
            traning_config (Optional[Union[str,Path]], optional): 训练配置文件路径. Defaults to None.

        """
        super().__init__(config_path, device)

        # 加载训练配置
        self.traning_config_path = Path(
            traning_config_path or "./config/training_config.json"
        )
        self.logger = logging.getLogger(__name__)
        self.performance_monitor = get_performance_monitor()

        try:
            with open(self.traning_config_path, "r", encoding="utf-8") as f:
                self.training_config = json.load(f)
        except Exception as e:
            self.logger.error(f"加载训练配置文件失败: {e}")
            raise RuntimeError(f"加载训练配置文件失败: {e}")

        # 训练状态
        self.trainer = None
        self.training_args = None
        self.tokenizer = None
        self.model = None

    def prepare_dataset(
        self,
        data_path: Optional[Union[str, Path]] = None,
        validation_data_path: Optional[Union[str, Path]] = None,
        text_column: str = "text",
        max_length: int = 2048,
    ) -> Tuple[Dataset, Dataset]:
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
        data_config = self.traning_config.get("data_path", {})

        # 使用配置文件中的路径（如果未指定参数）
        data_path = data_path or data_config.get("train_file")
        validation_path = validation_data_path or data_config.get("validation_file")

        # 使用配置文件中的预处理参数（如果未指定参数）
        preprocess_config = data_config.get("preprocess", {})
        text_column = text_column or preprocess_config.get("text_column", "text")
        max_length = max_length or preprocess_config.get("max_length", 2048)
        add_eos_token = preprocess_config.get("add_eos_token", True)

        if not data_path:
            raise ValueError("训练数据路径不能为空")

        # 加载分词器
        if self.tokenizer is None:
            self.tokenizer = self.load_tokenizer()

        # 检查训练数据路径
        data_path = Path(data_path)
        if not data_path.exists():
            raise FileNotFoundError(f"训练数据路径不存在: {data_path}")

        self.logger.info(f"加载训练数据: {data_path}")

        # 加载训练数据集
        data_files = {}
        data_files["train"] = str(data_path)
        if validation_path and Path(validation_path).exists():
            data_files["validation"] = str(validation_path)
            self.logger.info(f"加载验证数据: {validation_path}")

        # 根据文件扩展名确定数据格式
        extension = data_path.suffix.lower()
        if extension == ".json":
            dataset = load_dataset("json", data_files=data_files)
        elif extension == ".csv":
            dataset = load_dataset("csv", data_files=data_files)
        elif extension == ".txt":
            dataset = load_dataset("text", data_files=data_files)
        else:
            raise ValueError(f"不支持的数据格式: {extension}")

        # 预处理函数
        def tokenize_function(examples):
            texts = examples[text_column]

            # 确定文本是字符串列表
            if isinstance(texts, str):
                texts = [texts]

            # 添加EOS标记
            if add_eos_token:
                texts = [t + self.tokenizer.eos_token for t in texts]

            # 分词
            tokenized = self.tokenizer(
                texts,
                truncation=True,
                max_length=max_length,
                padding="max_length",
                return_tensors="pt",
            )

            return tokenized

        # 应用预处理函数
        tokenized_datasets = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=[
                col for col in dataset["train"].column_names if col != text_column
            ],
        )

        train_dataset = tokenized_datasets["train"]

        # 验证集
        validation_dataset = None
        if "validation" in tokenized_datasets:
            validation_dataset = tokenized_datasets["validation"]

        self.logger.info(
            f"数据集准备完成：训练集{len(train_dataset)}条，验证集{len(validation_dataset) if validation_dataset else '无验证集'}"
        )
        return train_dataset, validation_dataset

    def prepare_training_args(
        self, output_dir: Optional[Union[str, Path]] = None, **kwargs
    ) -> TrainingArguments:
        """
        准备训练参数

        Args:
            output_dir (Optional[Union[str,Path]], optional): 输出目录. Defaults to None.
            **kwargs: 其他训练参数

        Returns:
            TrainingArguments: 训练参数
        """
        train_config = self.traning_config.get("training", {})

        # 默认输出目录
        if output_dir is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            model_name = self.get_model_path().split("/")[-1]
            output_dir = f"./models/adapters/{model_name}_ft_{timestamp}"

        # 创建输出目录
        os.makedirs(output_dir, exist_ok=True)

        # 梯度检查点配置
        gradient_checkpointing = train_config.get("gradient_checkpointing", True)
        gradient_checkpointing_kwargs = train_config.get(
            "gradient_checkpointing_kwargs", {"use_reentrant": False}
        )

        # 设置训练参数
        training_args = TrainingArguments(
            output_dir=output_dir,
            per_device_train_batch_size=kwargs.get(
                "batch_size", train_config.get("batch_size", 4)
            ),
            per_device_eval_batch_size=kwargs.get(
                "batch_size", train_config.get("batch_size", 4)
            ),
            gradient_accumulation_steps=kwargs.get(
                "gradient_accumulation_steps",
                train_config.get("gradient_accumulation_steps", 4),
            ),
            learning_rate=kwargs.get(
                "learning_rate", train_config.get("learning_rate", 2e-4)
            ),
            num_train_epochs=kwargs.get("epochs", train_config.get("epochs", 3)),
            weight_decay=kwargs.get(
                "weight_decay", train_config.get("weight_decay", 0.01)
            ),
            max_grad_norm=kwargs.get(
                "max_grad_norm", train_config.get("max_grad_norm", 1.0)
            ),
            lr_scheduler_type=kwargs.get(
                "lr_scheduler", train_config.get("lr_scheduler", "cosine")
            ),
            warmup_steps=kwargs.get(
                "warmup_steps", train_config.get("warmup_steps", 200)
            ),
            save_steps=kwargs.get("save_steps", train_config.get("save_steps", 500)),
            logging_steps=kwargs.get(
                "logging_steps", train_config.get("logging_steps", 10)
            ),
            eval_steps=kwargs.get("eval_steps", train_config.get("eval_steps", 100)),
            save_total_limit=kwargs.get(
                "save_total_limit", train_config.get("save_total_limit", 3)
            ),
            evaluation_strategy="steps" if "validation" in kwargs else "no",
            save_strategy="steps",
            load_best_model_at_end=True if "validation" in kwargs else False,
            fp16=torch.cuda.is_available(),
            gradient_checkpointing=gradient_checkpointing,
            gradient_checkpointing_kwargs=gradient_checkpointing_kwargs,
            report_to="tensorboard",
            remove_unused_columns=False,
            optim="adamw_torch",
            **{
                k: v
                for k, v in kwargs.items()
                if k
                not in [
                    "batch_size",
                    "gradient_accumulation_steps",
                    "learning_rate",
                    "epochs",
                    "weight_decay",
                    "max_grad_norm",
                    "lr_scheduler",
                    "warmup_steps",
                    "save_steps",
                    "logging_steps",
                    "eval_steps",
                    "save_total_limit",
                ]
            },
        )
        self.training_args = training_args
        self.logger.info(f"训练参数准备完成: {training_args}")

        return training_args

    def train(
        self,
        adapter_name: str,
        train_dataset: Optional[Dataset] = None,
        validation_dataset: Optional[Dataset] = None,
        **kwargs,
    ) -> str:
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

        # 如果未提供数据集，则使用prepare_dataset准备数据集
        if train_dataset is None:
            train_dataset, validation_dataset = self.prepare_dataset()

        # 确保输出目录包含适配器名称
        output_dir = kwargs.get("output_dir")
        if output_dir:
            if adapter_name not in str(output_dir):
                output_dir = Path(output_dir) / adapter_name

        else:
            output_dir = Path(self.adapter_path) / adapter_name

        # 更新kwargs以便prepare_training_args使用新的输出目录
        kwargs["output_dir"] = output_dir

        # 准备训练参数
        training_args = self.prepare_training_args(**kwargs)

        # 检查是否启用Accelerate
        train_config = self.traning_config.get("training", {})
        use_accelerate = train_config.get("use_accelerate", False)

        # 检查是否存在检测点，以便恢复训练
        last_checkpoint = None
        if os.path.isdir(training_args.output_dir):
            last_checkpoint = get_last_checkpoint(training_args.output_dir)
            if (
                last_checkpoint is None
                and len(os.listdir(training_args.output_dir)) > 0
            ):
                self.logger.info(f"未找到检测点，但输出目录非空")
            elif last_checkpoint is not None:
                self.logger.info(f"找到检测点: {last_checkpoint}，将从此处恢复训练")

        # 准备模型
        # 先获取基础模型
        model = self.load_model()

        # 准备LoRA配置
        lora_config = self.create_lora_config()

        # 准备4/8位训练
        model = self.prepare_for_training(model)

        # 应用LoRA适配器
        model = get_peft_model(model, lora_config)

        # 显示可训练参数
        model.print_trainable_parameters()

        # 数据收集器
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer, mlm=False
        )

        if use_accelerate:
            self.logger.info("使用Accelerate进行训练...")

            # 初始化Accelerator
            accelerator = Accelerator(
                gradient_accumulation_steps=training_args.gradient_accumulation_steps,
                mixed_precision="fp16" if torch.cuda.is_available() else "no",
                log_with="tensorboard",
                project_dir=str(training_args.output_dir),
                cpu_offload_model=train_config.get("cpu_offload", False),
            )

            if use_accelerate and accelerator:
                accelerator.free_memory()  # 设置显存高效的内存管理
                accelerator.set_hyperparameters(
                    split_batches=True, dispatch_batches=False
                )  # 使用更激进的显存释放策略
                accelerator.enable_auto_memory_management()  # 启用自动内存管理

            # 设置随机种子
            set_seed_for_device(42, accelerator.device)

            # 创建优化器
            no_decay = ["bias", "LayerNorm.weight"]
            optimizer_grouped_parameters = [
                {
                    "params": [
                        p
                        for n, p in model.named_parameters()
                        if not any(nd in n for nd in no_decay) and p.requires_grad
                    ],
                    "weight_decay": training_args.weight_decay,
                },
                {
                    "params": [
                        p
                        for n, p in model.named_parameters()
                        if any(nd in n for nd in no_decay) and p.requires_grad
                    ],
                    "weight_decay": 0.0,
                },
            ]
            optimizer = torch.optim.AdamW(
                optimizer_grouped_parameters, lr=training_args.learning_rate
            )

            # 创建学习率调度器
            train_dataloader = create_efficient_dataloader(
                train_dataset,
                batch_size=training_args.per_device_train_batch_size,
                num_workers=train_config.get("dataloader_workers", 4),  # 从配置中获取
                pin_memory=True,  # 启用内存固定
                prefetch_factor=2,  # 预取因子
                persistent_workers=True,  # 持久化工作线程
                collate_fn=data_collator,
                use_async_prefetch=train_config.get("async_prefetch", True),  # 从配置中获取
            )

            num_update_steps_per_epoch = (
                len(train_dataloader) // training_args.gradient_accumulation_steps
            )
            max_train_steps = (
                training_args.num_train_epochs * num_update_steps_per_epoch
            )

            lr_scheduler = get_scheduler(
                training_args.lr_scheduler_type,
                optimizer=optimizer,
                num_warmup_steps=training_args.warmup_steps,
                num_training_steps=max_train_steps,
            )

            # 评估数据加载器
            eval_dataloader = None
            if validation_dataset is not None:
                eval_dataloader = create_efficient_dataloader(
                    validation_dataset,
                    batch_size=training_args.per_device_eval_batch_size,
                    shuffle=False,
                    num_workers=train_config.get("dataloader_workers", 4),
                    pin_memory=True,
                    prefetch_factor=2,
                    persistent_workers=True,
                    collate_fn=data_collator,
                    use_async_prefetch=train_config.get("async_prefetch", True),
                )

            # 准备所有组件
            (
                model,
                optimizer,
                train_dataloader,
                eval_dataloader,
                lr_scheduler,
            ) = accelerator.prepare(
                model, optimizer, train_dataloader, eval_dataloader, lr_scheduler
            )

            # 训练循环
            progress_bar = tqdm(
                range(max_train_steps), disable=not accelerator.is_local_main_process
            )
            completed_steps = 0
            best_metric = None
            best_model_checkpoint = None

            for epoch in range(int(training_args.num_train_epochs)):
                model.train()
                total_loss = 0
                for step, batch in enumerate(train_dataloader):
                    with accelerator.accumulate(model):
                        outputs = model(**batch)
                        loss = outputs.loss
                        accelerator.backward(loss)

                        if training_args.max_grad_norm > 0:
                            accelerator.clip_grad_norm_(
                                model.parameters(), training_args.max_grad_norm
                            )

                        optimizer.step()
                        lr_scheduler.step()
                        optimizer.zero_grad()

                    # 记录和输出
                    if step % training_args.logging_steps == 0:
                        progress_bar.update(1)
                        completed_steps += 1
                        accelerator.log(
                            {
                                "train_loss": loss.item(),
                                "lr": lr_scheduler.get_last_lr()[0],
                            },
                            step=completed_steps,
                        )
                        self.logger.info(
                            f"Epoch: {epoch}, Step: {step}, Loss: {loss.item():.4f}, LR: {lr_scheduler.get_last_lr()[0]:.8f}"
                        )

                    # 保存模型
                    if completed_steps % training_args.save_steps == 0:
                        output_dir = (
                            f"{training_args.output_dir}/checkpoint-{completed_steps}"
                        )
                        accelerator.wait_for_everyone()
                        if accelerator.is_local_main_process:
                            accelerator.save_state(output_dir)
                            self.logger.info(f"保存模型检查点到 {output_dir}")

                    # 评估
                    if (
                        eval_dataloader is not None
                        and completed_steps % training_args.eval_steps == 0
                    ):
                        model.eval()
                        eval_loss = 0
                        eval_steps = 0
                        for eval_batch in eval_dataloader:
                            with torch.no_grad():
                                outputs = model(**eval_batch)
                            eval_loss += outputs.loss.item()
                            eval_steps += 1

                        eval_loss = eval_loss / eval_steps
                        accelerator.log({"eval_loss": eval_loss}, step=completed_steps)
                        self.logger.info(
                            f"Step: {completed_steps}, Evaluation Loss: {eval_loss:.4f}"
                        )

                        # 保存最佳模型
                        if best_metric is None or eval_loss < best_metric:
                            best_metric = eval_loss
                            best_model_dir = f"{training_args.output_dir}/best_model"
                            if accelerator.is_local_main_process:
                                unwrapped_model = accelerator.unwrap_model(model)
                                unwrapped_model.save_pretrained(
                                    best_model_dir,
                                    save_function=accelerator.save,
                                    state_dict=accelerator.get_state_dict(model),
                                )
                                self.logger.info(f"保存最佳模型到 {best_model_dir}")

                        model.train()

            # 训练完成，保存最终模型
            accelerator.wait_for_everyone()
            if accelerator.is_local_main_process:
                unwrapped_model = accelerator.unwrap_model(model)
                unwrapped_model.save_pretrained(
                    training_args.output_dir,
                    save_function=accelerator.save,
                    state_dict=accelerator.get_state_dict(model),
                )
                self.logger.info(f"保存最终模型到 {training_args.output_dir}")

            # 记录训练时间和信息
            training_time = time.time() - start_time
            training_info = {
                "adapter_name": adapter_name,
                "training_time": training_time,
                "epochs": training_args.num_train_epochs,
                "steps": completed_steps,
                "samples": len(train_dataset),
                "best_eval_loss": best_metric
                if best_metric is not None
                else float("inf"),
            }

            # 保存训练信息
            if accelerator.is_local_main_process:
                with open(
                    os.path.join(training_args.output_dir, "training_info.json"), "w"
                ) as f:
                    json.dump(training_info, f, ensure_ascii=False, indent=2)

            return training_args.output_dir

        else:
            # 原有的Trainer代码保持不变
            self.logger.info("使用Trainer进行训练...")

            # 创建训练器
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=validation_dataset,
                tokenizer=self.tokenizer,
                data_collator=data_collator,
            )

            # 保存训练器
            self.trainer = trainer

            # 开始训练
            self.logger.info(f"开始训练...,适配器名称: {adapter_name}")

            try:
                with self.performance_monitor:
                    train_result = trainer.train(resume_from_checkpoint=last_checkpoint)

                # 记录训练性能指标
                metrics = train_result.metrics
                trainer.log_metrics("train", metrics)
                trainer.save_metrics("train", metrics)

                # 计算训练时间
                training_time = time.time() - start_time
                training_info = {
                    "adapter_name": adapter_name,
                    "training_time": training_time,
                    "epochs": training_args.num_train_epochs,
                    "steps": metrics.get("train_steps", 0),
                    "samples": len(train_dataset),
                    "loss": metrics.get("train_loss", 0),
                    "learning_rate": training_args.learning_rate,
                }

                # 保存训练信息
                with open(
                    os.path.join(training_args.output_dir, "training_info.json"), "w"
                ) as f:
                    json.dump(training_info, f, ensure_ascii=False, indent=2)

                # 保存适配器
                self.logger.info("训练完成，保存适配器: %s", adapter_name)
                self.save_adapter(adapter_name, output_dir)

                return str(output_dir)

            except Exception as e:
                self.logger.error("训练过程中发生错误: %s", e)
                raise RuntimeError(f"训练过程中发生错误: {e}")

    def train_async(
        self,
        adapter_name: str,
        train_dataset: Optional[Dataset] = None,
        validation_dataset: Optional[Dataset] = None,
        **kwargs,
    ) -> str:
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
            self.train, adapter_name, train_dataset, validation_dataset, **kwargs
        )

    def evaluate(
        self,
        adapter_name: Optional[str] = None,
        eval_dataset: Optional[Dataset] = None,
        metrics: Optional[List[str]] = None,
    ) -> Dict[str, float]:
        """
        评估模型

        Args:
            adapter_name (Optional[str], optional): 适配器名称. Defaults to None.
            eval_dataset (Optional[Dataset], optional): 评估数据集. Defaults to None.
            metrics (Optional[List[str]], optional): 评估指标. Defaults to None.

        Returns:
            Dict[str,float]: 评估结果
        """
        # 创建评估管理器，传入当前训练管理器实例
        from .evaluation import EvaluationManager

        evaluation_manager = EvaluationManager(self)

        # 如果提供了适配器名称，激活该适配器
        if adapter_name and hasattr(self.model, "set_adapter"):
            self.model.set_adapter(adapter_name)

        # 如果未提供评估数据集，使用训练配置中的验证集
        if eval_dataset is None and hasattr(self, "eval_dataset"):
            eval_dataset = self.eval_dataset

        if eval_dataset is None:
            self.logger.warning("未提供评估数据集,无法进行评估")
            return {}

        # 如果未提供评估指标，使用默认指标
        if metrics is None:
            metrics = evaluation_manager.eval_config.get("metrics", ["accuracy"])

        results = {}

        # 根据指定的评估指标执行相应的评估
        for metric in metrics:
            if metric == "perplexity":
                metric_result = evaluation_manager.evaluate_perplexity(eval_dataset)
            elif metric == "accuracy":
                metric_result = evaluation_manager.evaluate_accuracy(eval_dataset)
            elif metric == "character_consistency":
                metric_result = evaluation_manager.evaluate_character_consistency(
                    eval_dataset
                )
            elif metric == "cultural_knowledge":
                metric_result = evaluation_manager.evaluate_cultural_knowledge(
                    eval_dataset
                )
            else:
                self.logger.warning(f"未实现的评估指标: {metric},跳过")
                continue

            results[metric] = metric_result

        # 记录评估结果
        self.logger.info(f"评估结果:{results}")

        # 如果是在训练过程中评估，记录到训练历史
        if hasattr(self, "history"):
            current_step = self.history.get("global_step", 0)
            if "eval_results" not in self.history:
                self.history["eval_results"] = {}
            self.history["eval_results"][current_step] = results

        return results

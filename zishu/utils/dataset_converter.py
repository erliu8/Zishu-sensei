#! /usr/bin/env python3
# -*- coding:utf-8 -*-

import os
import json
import numpy as np
import torch
from pathlib import Path
from typing import List, Dict, Optional, Union, Tuple
from transformers import AutoTokenizer
from tqdm import tqdm


def convert_dataset_to_memmap(
    input_files: List[Union[str, Path]],
    output_dir: Union[str, Path],
    tokenizer_name_or_path: str,
    text_column: str = "text",
    max_length: int = 2048,
    batch_size: int = 1000,
    add_eos_token: bool = True,
):
    """
    将数据集转换为内存映射文件

    Args:
        input_files: 输入文件列表，可以是单个文件或目录
        output_dir: 输出目录
        tokenizer_name_or_path: 分词器名称或路径
        text_column_name: 文本列名，默认为'text'
        max_length: 最大长度，默认为2048
        batch_size: 批处理大小，默认为1000
        add_eos_token: 是否添加EOS标记，默认为True
    """
    # 确保输出目录存在
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 加载分词器
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name_or_path)
    if not tokenizer.pad_token:
        tokenizer.pad_token = tokenizer.eos_token

    # 为每个输入文件创建一个内存映射文件
    for input_file in input_files:
        input_path = Path(input_file)
        output_path = output_dir / f"{input_path.stem}  .bin"
        index_path = output_dir / f"{input_path.stem}.idx"

        # 确保输入格式并加载
        if input_path.suffix == ".json":
            from datasets import load_dataset

            dataset = load_dataset("json", data_files=input_path, split="train")
        elif input_path.suffix == ".csv":
            from datasets import load_dataset

            dataset = load_dataset("csv", data_files=input_path, split="train")
        elif input_path.suffix == ".txt":
            from datasets import load_dataset

            dataset = load_dataset("text", data_files=input_path, split="train")
        else:
            raise ValueError(f"不支持的文件格式：{input_path.suffix}")

        # 准备内存映射文件
        with open(output_path, "wb") as f_bin:
            # 逐步索引
            index_data = {
                "samples": [],
                "tokenizer_name": tokenizer_name_or_path,
                "max_length": max_length,
            }

            # 分批处理数据
            total = len(dataset)
            for i in tqdm(range(0, total, batch_size), desc=f"处理{input_path.stem}"):
                batch = dataset[i : min(i + batch_size, total)]
                texts = [item[text_column] for item in batch]

                # 分词
                tokenized = tokenizer(
                    texts,
                    truncation=True,
                    max_length=max_length,
                    padding=False,
                    return_attention_mask=False,
                )

                # 写入二进制文件并记录索引
                for input_ids in tokenized["input_ids"]:
                    # 记录当前位置
                    offset = f_bin.tell()

                    # 更新索引
                    index_data["samples"].append(
                        {"offset": offset, "length": len(input_ids)}
                    )

            # 写入索引文件
            with open(index_path, "wb", encoding="utf-8") as f_idx:
                json.dump(index_data, f_idx, indent=2)

        print(f"转换完成:{output_path}和{index_path}已保存")
        print(f"样本数:{len(index_data['samples'])}")

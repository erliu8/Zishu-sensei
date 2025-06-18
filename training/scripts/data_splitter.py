#!/usr/bin/env python3
"""
将训练数据分割为训练集、验证集和测试集
"""

import json
from datasets import load_dataset
from pathlib import Path

def main():
    # 数据文件路径
    input_file = "data/generated_dialogues/zishu_sensei_final_training_all_names_fixed.jsonl"
    output_dir = Path("data/generated_dialogues")
    
    print(f"📂 加载数据: {input_file}")
    
    # 加载数据
    dataset = load_dataset('json', data_files=input_file)['train']
    total_size = len(dataset)
    print(f"📊 总数据量: {total_size}")
    
    # 分割比例: 80% 训练，10% 验证，10% 测试
    train_ratio = 0.8
    val_ratio = 0.1
    test_ratio = 0.1
    
    train_size = int(total_size * train_ratio)
    val_size = int(total_size * val_ratio)
    test_size = total_size - train_size - val_size
    
    print(f"📊 数据分割:")
    print(f"   训练集: {train_size} ({train_ratio*100:.0f}%)")
    print(f"   验证集: {val_size} ({val_ratio*100:.0f}%)")
    print(f"   测试集: {test_size} ({test_ratio*100:.0f}%)")
    
    # 第一次分割：分离训练集和临时集（验证+测试）
    split_dataset = dataset.train_test_split(
        test_size=val_size + test_size, 
        shuffle=True, 
        seed=42
    )
    train_dataset = split_dataset['train']
    temp_dataset = split_dataset['test']
    
    # 第二次分割：将临时集分为验证集和测试集
    val_test_split = temp_dataset.train_test_split(
        test_size=test_size, 
        shuffle=True, 
        seed=42
    )
    val_dataset = val_test_split['train']
    test_dataset = val_test_split['test']
    
    # 保存分割后的数据集
    train_file = output_dir / "train.jsonl"
    val_file = output_dir / "validation.jsonl"
    test_file = output_dir / "test.jsonl"
    
    print(f"💾 保存训练集: {train_file}")
    train_dataset.to_json(train_file)
    
    print(f"💾 保存验证集: {val_file}")
    val_dataset.to_json(val_file)
    
    print(f"💾 保存测试集: {test_file}")
    test_dataset.to_json(test_file)
    
    print("✅ 数据集分割完成!")
    print(f"📊 最终统计:")
    print(f"   训练集: {len(train_dataset)} 条")
    print(f"   验证集: {len(val_dataset)} 条")
    print(f"   测试集: {len(test_dataset)} 条")

if __name__ == "__main__":
    main() 
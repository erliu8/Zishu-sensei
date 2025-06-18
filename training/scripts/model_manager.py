#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import json
import argparse
from pathlib import Path
from datetime import datetime

def backup_existing_models(output_dir: Path, backup_name: str = None):
    """备份现有模型"""
    if not output_dir.exists():
        print(f"输出目录 {output_dir} 不存在")
        return
    
    if backup_name is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}"
    
    backup_dir = output_dir.parent / backup_name
    
    print(f"备份现有模型到: {backup_dir}")
    shutil.move(str(output_dir), str(backup_dir))
    output_dir.mkdir(parents=True, exist_ok=True)
    
    return backup_dir

def export_adapter_model(adapter_path: Path, export_dir: Path, model_name: str):
    """导出适配器模型"""
    export_dir.mkdir(parents=True, exist_ok=True)
    
    # 复制适配器文件
    adapter_files = [
        "adapter_model.safetensors",
        "adapter_config.json",
        "tokenizer.model", 
        "tokenizer_config.json",
        "special_tokens_map.json"
    ]
    
    for file_name in adapter_files:
        src_file = adapter_path / file_name
        if src_file.exists():
            shutil.copy2(src_file, export_dir / file_name)
    
    # 创建模型信息文件
    model_info = {
        "model_name": model_name,
        "export_time": datetime.now().isoformat(),
        "adapter_path": str(adapter_path),
        "model_type": "LoRA_adapter",
        "base_model": "Chinese-Mistral-7B-v0.1"
    }
    
    with open(export_dir / "model_info.json", "w", encoding="utf-8") as f:
        json.dump(model_info, f, indent=2, ensure_ascii=False)
    
    print(f"模型已导出到: {export_dir}")

def list_available_models(models_dir: Path):
    """列出可用的模型"""
    if not models_dir.exists():
        print("❌ 模型目录不存在")
        return
    
    print("可用模型列表:")
    for model_dir in models_dir.iterdir():
        if model_dir.is_dir():
            info_file = model_dir / "model_info.json"
            if info_file.exists():
                with open(info_file, "r", encoding="utf-8") as f:
                    info = json.load(f)
                print(f"  • {model_dir.name}: {info.get('model_name', 'Unknown')}")
            else:
                print(f"  • {model_dir.name}: (无信息文件)")

def clean_checkpoints(output_dir: Path, keep_latest: int = 2):
    """清理旧的检查点，只保留最新的几个"""
    checkpoint_dirs = [d for d in output_dir.iterdir() 
                      if d.is_dir() and d.name.startswith("checkpoint-")]
    
    if len(checkpoint_dirs) <= keep_latest:
        print(f"检查点数量({len(checkpoint_dirs)})不超过保留数量({keep_latest})")
        return
    
    # 按检查点号排序
    checkpoint_dirs.sort(key=lambda x: int(x.name.split("-")[1]))
    
    # 删除旧的检查点
    to_remove = checkpoint_dirs[:-keep_latest]
    for checkpoint_dir in to_remove:
        print(f"删除旧检查点: {checkpoint_dir.name}")
        shutil.rmtree(checkpoint_dir)

def main():
    parser = argparse.ArgumentParser(description="模型管理工具")
    parser.add_argument("--action", choices=["backup", "export", "list", "clean"], 
                       required=True, help="执行的操作")
    parser.add_argument("--output_dir", type=str, default="./output",
                       help="输出目录路径")
    parser.add_argument("--backup_name", type=str, 
                       help="备份名称(默认使用时间戳)")
    parser.add_argument("--model_name", type=str,
                       help="导出模型的名称")
    parser.add_argument("--adapter_path", type=str,
                       help="适配器模型路径")
    parser.add_argument("--export_dir", type=str, default="./models/adapters",
                       help="导出目录")
    parser.add_argument("--keep_checkpoints", type=int, default=2,
                       help="保留的检查点数量")
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    
    if args.action == "backup":
        backup_existing_models(output_dir, args.backup_name)
    
    elif args.action == "export":
        if not args.adapter_path or not args.model_name:
            print("导出操作需要 --adapter_path 和 --model_name 参数")
            return
        
        adapter_path = Path(args.adapter_path)
        export_dir = Path(args.export_dir) / args.model_name
        export_adapter_model(adapter_path, export_dir, args.model_name)
    
    elif args.action == "list":
        models_dir = Path(args.export_dir)
        list_available_models(models_dir)
    
    elif args.action == "clean":
        clean_checkpoints(output_dir, args.keep_checkpoints)

if __name__ == "__main__":
    main() 
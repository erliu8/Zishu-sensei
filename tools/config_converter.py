#!/usr/bin/env python3
"""
配置文件转换工具
将JSON配置文件转换为YAML格式
"""

import json
import yaml
import os
import argparse
import shutil
from pathlib import Path
from typing import List, Optional

def convert_json_to_yaml(json_file: Path, output_file: Optional[Path] = None, backup: bool = True, clean_json: bool = False, clean_backup: bool = False) -> bool:
    """
    将JSON文件转换为YAML文件
    
    Args:
        json_file: JSON文件路径
        output_file: 输出YAML文件路径，如果为None则自动生成
        backup: 是否备份原文件
    
    Returns:
        bool: 转换是否成功
    """
    try:
        # 检查输入文件是否存在
        if not json_file.exists():
            print(f"❌ 文件不存在: {json_file}")
            return False
        
        # 读取JSON文件
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 确定输出文件路径
        if output_file is None:
            output_file = json_file.with_suffix('.yml')
        
        # 创建输出目录
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 备份原文件
        if backup and json_file.exists():
            backup_file = json_file.with_suffix('.json.backup')
            shutil.copy2(json_file, backup_file)
            print(f"📄 已备份: {json_file} -> {backup_file}")
        
        # 写入YAML文件
        with open(output_file, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, 
                     default_flow_style=False,
                     allow_unicode=True,
                     indent=2,
                     sort_keys=False)
        
        print(f"✅ 转换成功: {json_file} -> {output_file}")
        
        # 清理文件
        if clean_json and json_file.exists():
            json_file.unlink()
            print(f"🗑️ 已删除JSON文件: {json_file}")
        
        if clean_backup and backup:
            backup_file = json_file.with_suffix('.json.backup')
            if backup_file.exists():
                backup_file.unlink()
                print(f"🗑️ 已删除备份文件: {backup_file}")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON格式错误 {json_file}: {e}")
        return False
    except Exception as e:
        print(f"❌ 转换失败 {json_file}: {e}")
        return False

def find_json_files(directory: Path, recursive: bool = True) -> List[Path]:
    """
    查找目录中的JSON文件
    
    Args:
        directory: 搜索目录
        recursive: 是否递归搜索子目录
    
    Returns:
        List[Path]: JSON文件路径列表
    """
    if recursive:
        return list(directory.rglob("*.json"))
    else:
        return list(directory.glob("*.json"))

def main():
    parser = argparse.ArgumentParser(description="JSON到YAML配置文件转换工具")
    parser.add_argument("input", help="输入文件或目录路径")
    parser.add_argument("-o", "--output", help="输出文件路径（仅单文件转换时使用）")
    parser.add_argument("-r", "--recursive", action="store_true", help="递归搜索子目录")
    parser.add_argument("--no-backup", action="store_true", help="不备份原文件")
    parser.add_argument("--dry-run", action="store_true", help="仅显示会转换的文件，不实际转换")
    parser.add_argument("--clean", action="store_true", help="转换后删除原JSON文件")
    parser.add_argument("--clean-backup", action="store_true", help="转换后删除备份文件")
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    backup = not args.no_backup
    
    if not input_path.exists():
        print(f"❌ 路径不存在: {input_path}")
        return 1
    
    # 单文件转换
    if input_path.is_file():
        if not input_path.suffix.lower() == '.json':
            print(f"❌ 不是JSON文件: {input_path}")
            return 1
        
        output_file = Path(args.output) if args.output else None
        
        if args.dry_run:
            output_path = output_file or input_path.with_suffix('.yml')
            print(f"🔍 将转换: {input_path} -> {output_path}")
            return 0
        
        success = convert_json_to_yaml(input_path, output_file, backup, args.clean, args.clean_backup)
        return 0 if success else 1
    
    # 目录批量转换
    elif input_path.is_dir():
        json_files = find_json_files(input_path, args.recursive)
        
        if not json_files:
            print(f"📂 在 {input_path} 中没有找到JSON文件")
            return 0
        
        print(f"🔍 找到 {len(json_files)} 个JSON文件")
        
        if args.dry_run:
            print("📋 将转换以下文件:")
            for json_file in json_files:
                yaml_file = json_file.with_suffix('.yml')
                print(f"  {json_file} -> {yaml_file}")
            return 0
        
        success_count = 0
        for json_file in json_files:
            if convert_json_to_yaml(json_file, None, backup, args.clean, args.clean_backup):
                success_count += 1
        
        print(f"\n📊 转换完成: {success_count}/{len(json_files)} 个文件成功")
        return 0 if success_count == len(json_files) else 1
    
    else:
        print(f"❌ 无效的路径类型: {input_path}")
        return 1

if __name__ == "__main__":
    exit(main())
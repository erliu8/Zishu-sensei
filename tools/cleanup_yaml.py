#!/usr/bin/env python3
"""
YAML和备份文件清理工具
删除YAML文件和备份文件，只保留JSON文件
"""

import os
import argparse
from pathlib import Path
from typing import List, Tuple

def find_cleanup_targets(directory: Path, recursive: bool = True) -> Tuple[List[Path], List[Path]]:
    """
    查找需要删除的文件
    
    Returns:
        tuple: (yaml_files, backup_files)
    """
    if recursive:
        yaml_files = list(directory.rglob("*.yml")) + list(directory.rglob("*.yaml"))
        backup_files = list(directory.rglob("*.json.backup"))
    else:
        yaml_files = list(directory.glob("*.yml")) + list(directory.glob("*.yaml"))
        backup_files = list(directory.glob("*.json.backup"))
    
    return yaml_files, backup_files

def check_json_exists(yaml_file: Path) -> bool:
    """
    检查对应的JSON文件是否存在
    """
    json_file = yaml_file.with_suffix('.json')
    return json_file.exists()

def cleanup_files(files: List[Path], file_type: str, dry_run: bool = False, check_json: bool = False) -> int:
    """
    清理文件
    
    Args:
        files: 要删除的文件列表
        file_type: 文件类型描述
        dry_run: 是否只是预览
        check_json: 是否检查对应的JSON文件存在
    
    Returns:
        int: 删除的文件数量
    """
    if not files:
        print(f"📂 没有找到{file_type}文件")
        return 0
    
    print(f"🔍 找到 {len(files)} 个{file_type}文件")
    
    # 过滤文件（如果需要检查JSON存在）
    files_to_delete = []
    files_skipped = []
    
    for file in files:
        if check_json and not check_json_exists(file):
            files_skipped.append(file)
            continue
        files_to_delete.append(file)
    
    if files_skipped:
        print(f"⚠️  跳过 {len(files_skipped)} 个没有对应JSON文件的YAML文件:")
        for file in files_skipped:
            print(f"  ⏭️  {file}")
    
    if not files_to_delete:
        print(f"📂 没有符合条件的{file_type}文件需要删除")
        return 0
    
    if dry_run:
        print(f"📋 将删除以下 {len(files_to_delete)} 个{file_type}文件:")
        for file in files_to_delete:
            print(f"  🗑️ {file}")
        return 0
    
    deleted_count = 0
    for file in files_to_delete:
        try:
            file.unlink()
            print(f"✅ 已删除: {file}")
            deleted_count += 1
        except Exception as e:
            print(f"❌ 删除失败 {file}: {e}")
    
    return deleted_count

def main():
    parser = argparse.ArgumentParser(description="YAML和备份文件清理工具")
    parser.add_argument("directory", nargs="?", default="config", help="清理目录（默认: config）")
    parser.add_argument("-r", "--recursive", action="store_true", default=True, help="递归搜索子目录")
    parser.add_argument("--yaml-only", action="store_true", help="仅删除YAML文件")
    parser.add_argument("--backup-only", action="store_true", help="仅删除备份文件")
    parser.add_argument("--force", action="store_true", help="强制删除所有YAML文件（不检查JSON是否存在）")
    parser.add_argument("--dry-run", action="store_true", help="仅预览，不实际删除")
    
    args = parser.parse_args()
    
    directory = Path(args.directory)
    
    if not directory.exists():
        print(f"❌ 目录不存在: {directory}")
        return 1
    
    if not directory.is_dir():
        print(f"❌ 不是目录: {directory}")
        return 1
    
    print(f"🎯 目标目录: {directory}")
    print(f"📁 递归搜索: {'是' if args.recursive else '否'}")
    
    yaml_files, backup_files = find_cleanup_targets(directory, args.recursive)
    
    total_deleted = 0
    
    # 删除备份文件
    if not args.yaml_only:
        print(f"\n🗂️ 处理备份文件...")
        deleted = cleanup_files(backup_files, "备份", args.dry_run, False)
        total_deleted += deleted
    
    # 删除YAML文件
    if not args.backup_only:
        print(f"\n📄 处理YAML文件...")
        check_json = not args.force  # 除非强制删除，否则检查JSON存在
        deleted = cleanup_files(yaml_files, "YAML", args.dry_run, check_json)
        total_deleted += deleted
    
    print(f"\n" + "="*50)
    if args.dry_run:
        total_files = 0
        if not args.yaml_only:
            total_files += len(backup_files)
        if not args.backup_only:
            # 只计算会被删除的YAML文件
            if args.force:
                total_files += len(yaml_files)
            else:
                total_files += len([f for f in yaml_files if check_json_exists(f)])
        print(f"📊 预览完成: 将删除 {total_files} 个文件")
    else:
        print(f"📊 清理完成: 删除了 {total_deleted} 个文件")
    
    # 显示剩余的JSON文件
    json_files = list(directory.rglob("*.json")) if args.recursive else list(directory.glob("*.json"))
    if json_files:
        print(f"✅ 保留了 {len(json_files)} 个JSON文件")
    
    return 0

if __name__ == "__main__":
    exit(main()) 
#!/usr/bin/env python3
"""
数据库迁移管理脚本

这个脚本提供了便捷的数据库迁移命令，封装了 Alembic 的常用操作。

用法:
    python scripts/migrate.py init          # 初始化迁移（创建首次迁移）
    python scripts/migrate.py migrate       # 创建新的迁移文件
    python scripts/migrate.py upgrade       # 升级到最新版本
    python scripts/migrate.py downgrade     # 降级一个版本
    python scripts/migrate.py current       # 显示当前版本
    python scripts/migrate.py history       # 显示迁移历史
    python scripts/migrate.py heads         # 显示当前头版本
    python scripts/migrate.py reset         # 重置数据库（危险！）
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import subprocess
import argparse
from typing import Optional


class Colors:
    """终端颜色"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_success(message: str):
    """打印成功消息"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_error(message: str):
    """打印错误消息"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_info(message: str):
    """打印信息消息"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")


def print_warning(message: str):
    """打印警告消息"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")


def run_alembic_command(command: str, message: Optional[str] = None) -> bool:
    """
    运行 Alembic 命令
    
    Args:
        command: Alembic 命令
        message: 可选的消息
        
    Returns:
        bool: 命令是否成功
    """
    try:
        if message:
            print_info(message)
        
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            cwd=project_root,
            capture_output=False,
        )
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print_error(f"命令执行失败: {e}")
        return False


def init_migration(message: str = "Initial migration"):
    """初始化数据库迁移"""
    print_info("正在创建初始迁移...")
    
    if run_alembic_command(
        f'alembic revision --autogenerate -m "{message}"',
        "生成迁移脚本..."
    ):
        print_success("初始迁移创建成功！")
        print_info("运行 'python scripts/migrate.py upgrade' 来应用迁移")
    else:
        print_error("初始迁移创建失败")


def create_migration(message: Optional[str] = None):
    """创建新的迁移文件"""
    if not message:
        message = input("请输入迁移消息: ").strip()
        if not message:
            print_error("迁移消息不能为空")
            return
    
    print_info(f"正在创建迁移: {message}")
    
    if run_alembic_command(
        f'alembic revision --autogenerate -m "{message}"',
        "自动生成迁移脚本..."
    ):
        print_success(f"迁移 '{message}' 创建成功！")
        print_info("检查生成的迁移文件以确保正确性")
        print_info("运行 'python scripts/migrate.py upgrade' 来应用迁移")
    else:
        print_error("迁移创建失败")


def upgrade_database(revision: str = "head"):
    """升级数据库到指定版本"""
    print_info(f"正在升级数据库到: {revision}")
    
    if run_alembic_command(
        f"alembic upgrade {revision}",
        "应用迁移..."
    ):
        print_success("数据库升级成功！")
    else:
        print_error("数据库升级失败")


def downgrade_database(revision: str = "-1"):
    """降级数据库到指定版本"""
    print_warning(f"正在降级数据库到: {revision}")
    
    confirm = input("确定要降级数据库吗？(yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print_info("已取消降级操作")
        return
    
    if run_alembic_command(
        f"alembic downgrade {revision}",
        "回滚迁移..."
    ):
        print_success("数据库降级成功！")
    else:
        print_error("数据库降级失败")


def show_current():
    """显示当前数据库版本"""
    print_info("当前数据库版本:")
    run_alembic_command("alembic current")


def show_history():
    """显示迁移历史"""
    print_info("迁移历史:")
    run_alembic_command("alembic history")


def show_heads():
    """显示当前头版本"""
    print_info("当前头版本:")
    run_alembic_command("alembic heads")


def reset_database():
    """重置数据库（危险操作！）"""
    print_warning("⚠️  警告：这将删除所有数据库表并重新创建！")
    print_warning("⚠️  所有数据将丢失！")
    
    confirm = input("确定要重置数据库吗？输入 'RESET' 来确认: ").strip()
    if confirm != 'RESET':
        print_info("已取消重置操作")
        return
    
    print_info("正在降级到 base...")
    if run_alembic_command("alembic downgrade base", "回滚所有迁移..."):
        print_info("正在升级到 head...")
        if run_alembic_command("alembic upgrade head", "应用所有迁移..."):
            print_success("数据库重置成功！")
        else:
            print_error("数据库升级失败")
    else:
        print_error("数据库降级失败")


def stamp_database(revision: str):
    """将数据库标记为特定版本（不运行迁移）"""
    print_warning(f"正在将数据库标记为: {revision}")
    
    confirm = input("确定要标记数据库版本吗？(yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print_info("已取消标记操作")
        return
    
    if run_alembic_command(
        f"alembic stamp {revision}",
        "标记数据库版本..."
    ):
        print_success("数据库版本标记成功！")
    else:
        print_error("数据库版本标记失败")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="数据库迁移管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/migrate.py init                    # 创建初始迁移
  python scripts/migrate.py migrate "add user table"  # 创建新迁移
  python scripts/migrate.py upgrade                 # 升级到最新版本
  python scripts/migrate.py downgrade               # 降级一个版本
  python scripts/migrate.py current                 # 查看当前版本
        """
    )
    
    parser.add_argument(
        'command',
        choices=[
            'init', 'migrate', 'upgrade', 'downgrade',
            'current', 'history', 'heads', 'reset', 'stamp'
        ],
        help='要执行的命令'
    )
    
    parser.add_argument(
        'message',
        nargs='?',
        help='迁移消息或版本号（取决于命令）'
    )
    
    args = parser.parse_args()
    
    # 打印标题
    print(f"\n{Colors.BOLD}{Colors.HEADER}=== 数据库迁移管理工具 ==={Colors.ENDC}\n")
    
    # 执行命令
    if args.command == 'init':
        message = args.message or "Initial migration"
        init_migration(message)
    elif args.command == 'migrate':
        create_migration(args.message)
    elif args.command == 'upgrade':
        revision = args.message or "head"
        upgrade_database(revision)
    elif args.command == 'downgrade':
        revision = args.message or "-1"
        downgrade_database(revision)
    elif args.command == 'current':
        show_current()
    elif args.command == 'history':
        show_history()
    elif args.command == 'heads':
        show_heads()
    elif args.command == 'reset':
        reset_database()
    elif args.command == 'stamp':
        if not args.message:
            print_error("stamp 命令需要指定版本号")
            return
        stamp_database(args.message)
    
    print()  # 空行


if __name__ == "__main__":
    main()


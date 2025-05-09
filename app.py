import os
import sys
import logging
import json
import argparse
from pathlib import Path

#设置项目根目录
ROOT_DIR = Path(__file__).resolve().parent

def load_config(config_name="default"):
    """加载配置文件"""
    config_path = ROOT_DIR / "config" / f"{config_name}_config.json"
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        sys.exit(1)
    
def setup_logging(config=None):
    """设置日志记录"""
    if config is None:
        logging.basicConfig(level=logging.INFO,
                            format="%(asctime)s - %(levelname)s - %(message)s")
    else:
        #未来根据配置文件设置日志记录
        pass

def parse_arg():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="Zishu-sensei AI")
    parser.add_argument(
        "--mode",
        type=str,
        default="cli",
        choices=["cli", "gui",'desktop','voice',"full"],
        help="运行模式: cli(命令行),gui(图形界面)"
        "desktop(紫舒),voice(语音助手),full(全功能)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default="default",
        help="API服务端口号（仅在api模式有效）"
    )
    parser.add_argument(
        "--accessory",
        type=str,
        default="ribbon",
        choices=["ribbon","turtle","flower","none"],
        help="紫舒头饰"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="default",
        help="配置文件名"
    )
    return parser.parse_args()

import os
import sys
import logging
import json
import argparse
from pathlib import Path

# 设置项目根目录
ROOT_DIR = Path(__file__).resolve().parent

def load_config(config_name="default"):
    """加载配置文件"""
    config_path = ROOT_DIR / "config" / f"{config_name}.json"  # 修改配置文件命名约定
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
        # 未来根据配置文件设置日志记录
        pass
    return logging.getLogger("zishu-sensei")  # 返回logger对象

def parse_arg():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="Zishu-sensei AI")
    parser.add_argument(
        "--mode",
        type=str,
        default="cli",
        choices=["cli", "api", 'desktop', 'voice', "full"],  # 添加 api 选项
        help="运行模式: cli(命令行), api(API服务), desktop(紫舒), voice(语音助手), full(全功能)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,  # 修改为整数默认值
        help="API服务端口号（仅在api模式有效）"
    )
    parser.add_argument(
        "--accessory",
        type=str,
        default="ribbon",
        choices=["ribbon", "turtle", "flower", "none"],
        help="紫舒头饰"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="default",
        help="配置文件名"
    )
    return parser.parse_args()

def run_cli_mode(config, logger):
    """运行命令行模式"""
    logger.info("启动命令行模式")
    print("命令行模式尚未实现")

def run_api_mode(config, logger, port):
    """运行API服务模式"""
    logger.info(f"启动API服务，端口号：{port}")
    print(f"API服务尚未实现")

def run_desktop_mode(config, logger, accessory):  # 添加 accessory 参数
    """运行桌面模式"""
    logger.info(f"启动桌面模式，头饰：{accessory}")
    print("桌面模式尚未实现")

def run_voice_mode(config, logger):
    """运行语音助手模式"""
    logger.info("启动语音助手模式")
    print("语音助手模式尚未实现")
    
def run_full_mode(config, logger):
    """运行全功能模式"""
    logger.info("启动全功能模式")
    print("全功能模式尚未实现")
    
def main():
    """主函数"""
    # 解析命令行参数
    args = parse_arg()
    
    # 加载配置
    config = load_config(args.config)
    
    # 设置日志
    logger = setup_logging(config)
    logger.info(f"Zishu-sensei v{config.get('version', '0.1.0')}启动中...")
    
    # 创建必要的目录
    os.makedirs(config.get('data_dir', './data'), exist_ok=True)
    os.makedirs(config.get('logs_dir', './data/logs'), exist_ok=True)  # 修正日志目录字段名
    
    # 根据模式运行
    try:
        if args.mode == "cli":
            run_cli_mode(config, logger)
        elif args.mode == "api":
            run_api_mode(config, logger, args.port)
        elif args.mode == "desktop":
            run_desktop_mode(config, logger, args.accessory)  # 传递 accessory 参数
        elif args.mode == "voice":
            run_voice_mode(config, logger)
        elif args.mode == "full":
            run_full_mode(config, logger)
        else:
            logger.error(f"无效的模式: {args.mode}")
            sys.exit(1)
    except KeyboardInterrupt:
        logger.info("程序被手动终止")
        sys.exit(0)
    except Exception as e:
        logger.error(f"运行发生错误: {e}")
        sys.exit(1)
    finally:
        logger.info("Zishu-sensei 已正常关闭")
    
if __name__ == "__main__":
    main()
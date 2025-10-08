#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
import sys
from pathlib import Path


def setup_logger(name, level=logging.INFO, log_file=None):
    """设置一个带有指定名称和级别的logger

    Args:
        name (str): 日志记录器名称
        level (int): 日志级别,默认为INFO
        log_file (str,optional): 日志文件路径,如果提供,日志信息将写入文件

    Returns:
        logging.Logger: 已配置的日志记录器
    """
    # 创建一个logger
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # 创建控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # 创建格式器
    formatter = logging.Formatter(
        "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 添加处理器和格式器到logger
    logger.addHandler(console_handler)

    # 如果提供了日志文件路径,添加文件处理器
    if log_file:
        log_dir = Path(log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

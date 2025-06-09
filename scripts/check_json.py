#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import os
import chardet
from pathlib import Path

def detect_encoding(file_path, sample_size=4096):
    """检测文件编码"""
    with open(file_path, 'rb') as f:
        raw_data = f.read(sample_size)
        result = chardet.detect(raw_data)
        encoding = result['encoding']
        confidence = result['confidence']
        print(f"检测到编码: {encoding}, 置信度: {confidence}")
        return encoding

def check_json_file(file_path):
    """检查JSON文件并输出一些基本信息"""
    try:
        # 尝试检测文件编码
        encoding = detect_encoding(file_path)
        
        # 读取文件前1KB内容进行分析
        with open(file_path, 'rb') as f:
            raw_data = f.read(1024)
            print(f"文件前1KB的原始数据(十六进制):")
            print(raw_data.hex()[:100] + "...")
            
            # 尝试用不同编码读取
            for enc in [encoding, 'utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030']:
                if not enc:
                    continue
                try:
                    decoded = raw_data.decode(enc, errors='replace')
                    print(f"\n使用 {enc} 解码前100个字符:")
                    print(decoded[:100] + "...")
                except Exception as e:
                    print(f"使用 {enc} 解码失败: {e}")
    
        print("\n文件大小: {:.2f} MB".format(os.path.getsize(file_path) / (1024*1024)))
    except Exception as e:
        print(f"文件检查错误: {e}")

def print_structure(obj, indent=2):
    """递归打印对象结构"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            value_type = type(value).__name__
            if isinstance(value, (dict, list)):
                print(" " * indent + f"{key} ({value_type}):")
                print_structure(value, indent + 2)
            else:
                print(" " * indent + f"{key} ({value_type}): {value if len(str(value)) < 50 else str(value)[:50] + '...'}")
    elif isinstance(obj, list) and len(obj) > 0:
        print(" " * indent + f"列表 (长度: {len(obj)}):")
        if len(obj) > 0:
            print_structure(obj[0], indent + 2)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python check_json.py <JSON文件路径>")
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    check_json_file(file_path) 
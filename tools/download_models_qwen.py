#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用ModelScope下载Qwen-7B模型

使用方法:
    # 激活虚拟环境（依赖在 /data/disk/zishu-sensei/venv）
    source /data/disk/zishu-sensei/venv/bin/activate
    python tools/download_models_qwen.py
    
    或者直接使用虚拟环境的Python:
    /data/disk/zishu-sensei/venv/bin/python tools/download_models_qwen.py
"""
import os
import sys
import torch
from modelscope import snapshot_download
from transformers import AutoTokenizer, AutoModelForCausalLM

qwen_model_id = "qwen/Qwen2.5-7B-Instruct"
qwen_local_path = "/data/models/Qwen2.5-7B-Instruct"
os.makedirs(qwen_local_path, exist_ok=True)
print(f"正在从ModelScope下载Qwen2.5-7B-Instruct到 {qwen_local_path}")
qwen_model_dir = snapshot_download(
    model_id=qwen_model_id,
    cache_dir=qwen_local_path,
    revision="master"
)
print(f"Qwen2.5-7B-Instruct模型已下载到: {qwen_model_dir}")

# 测试Qwen2.5-7B-Instruct模型加载
try:
    tokenizer = AutoTokenizer.from_pretrained(qwen_model_dir, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        qwen_model_dir,
        torch_dtype=torch.float16,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    print("Qwen2.5-7B-Instruct模型加载成功!")
    
    # 测试紫舒老师的角色扮演
    messages = [
        {"role": "system", "content": "你是紫舒，一位害羞、内向、温柔可爱的老师。"},
        {"role": "user", "content": "你好，请介绍一下你自己。"}
    ]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=100, temperature=0.7, do_sample=True)
    print("模型回复：")
    print(tokenizer.decode(outputs[0], skip_special_tokens=True))
except Exception as e:
    print(f"Qwen2.5-7B-Instruct模型加载失败: {e}")
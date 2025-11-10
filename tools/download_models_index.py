#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
下载Index-1.9B Character模型（支持ModelScope和HuggingFace）

使用方法:
    # 激活虚拟环境（依赖在 /data/disk/zishu-sensei/venv）
    source /data/disk/zishu-sensei/venv/bin/activate
    python tools/download_models_index.py
    
    或者直接使用虚拟环境的Python:
    /data/disk/zishu-sensei/venv/bin/python tools/download_models_index.py
"""
import os
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# 设置HuggingFace镜像（如果网络无法访问官方站点）
if "HF_ENDPOINT" not in os.environ:
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    print("ℹ️  使用HuggingFace镜像: https://hf-mirror.com")

# 模型配置 - 尝试多个可能的模型ID
# 正确的模型ID: IndexTeam/Index-1.9B-Character (来自 https://huggingface.co/IndexTeam/Index-1.9B-Character)
modelscope_model_id = "IndexTeam/Index-1.9B-Character"
huggingface_model_ids = [
    "IndexTeam/Index-1.9B-Character",  # 正确的模型ID
    "bilibili/Index-1.9B-character",   # 备用ID（可能不存在）
    "Index-1.9B-character",            # 备用ID（可能不存在）
    "Index-1.9B",                      # 备用ID（可能不存在）
]
local_model_path = "/data/models/Index-1.9B-character"

# 创建目录
os.makedirs(local_model_path, exist_ok=True)

print(f"正在下载Index-1.9B Character模型到 {local_model_path}")

# 首先尝试从ModelScope下载
model_dir = None
try:
    from modelscope import snapshot_download
    print(f"尝试从ModelScope下载，模型ID: {modelscope_model_id}")
    model_dir = snapshot_download(
        model_id=modelscope_model_id,
        cache_dir=local_model_path,
        revision="master"
    )
    print(f"✅ 从ModelScope下载成功: {model_dir}")
except ImportError:
    print("⚠️  ModelScope未安装，将尝试从HuggingFace下载")
except Exception as e:
    print(f"⚠️  ModelScope下载失败: {e}")
    print("将尝试从HuggingFace下载...")

# 如果ModelScope失败，尝试从HuggingFace下载
if model_dir is None or not os.path.exists(model_dir):
    print("\n尝试从HuggingFace下载...")
    from huggingface_hub import snapshot_download as hf_snapshot_download
    from huggingface_hub import HfApi
    
    # 获取镜像端点
    hf_endpoint = os.environ.get("HF_ENDPOINT", "https://huggingface.co")
    print(f"使用端点: {hf_endpoint}")
    
    # 先检查模型是否存在（快速检查，避免长时间等待）
    api = HfApi(endpoint=hf_endpoint)
    valid_model_id = None
    
    print("检查模型是否存在...")
    for hf_model_id in huggingface_model_ids:
        try:
            print(f"  检查模型ID: {hf_model_id}")
            model_info = api.model_info(hf_model_id, timeout=15)
            print(f"  ✅ 找到模型: {hf_model_id}")
            print(f"     文件数量: {len(model_info.siblings)}")
            valid_model_id = hf_model_id
            break
        except Exception as check_e:
            error_msg = str(check_e)
            if "404" in error_msg or "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                print(f"  ⚠️  模型ID {hf_model_id} 不存在")
            elif "Network" in error_msg or "unreachable" in error_msg or "Connection" in error_msg:
                print(f"  ⚠️  网络连接失败: {error_msg[:100]}")
                print(f"  💡 提示: 请检查网络连接或使用代理")
            else:
                print(f"  ⚠️  检查失败: {error_msg[:100]}")
            continue
    
    # 如果找到有效模型，开始下载
    if valid_model_id:
        try:
            print(f"\n开始下载模型: {valid_model_id}")
            print("   这可能需要一些时间，请耐心等待...")
            # 清理之前失败的下载
            import shutil
            if os.path.exists(local_model_path) and os.path.isdir(local_model_path):
                # 检查是否有实际文件（排除锁文件和临时文件）
                files = [f for f in os.listdir(local_model_path) 
                        if not f.startswith('.') and os.path.isfile(os.path.join(local_model_path, f))]
                if not files:
                    print("   清理之前失败的下载...")
                    try:
                        shutil.rmtree(local_model_path)
                        os.makedirs(local_model_path, exist_ok=True)
                    except:
                        pass
            
            # 使用huggingface_hub下载完整模型
            model_dir = hf_snapshot_download(
                repo_id=valid_model_id,
                local_dir=local_model_path,
                local_dir_use_symlinks=False,
                ignore_patterns=["*.safetensors.index.json", "*.bin.index.json"],  # 忽略索引文件
                resume_download=True,  # 支持断点续传
                endpoint=hf_endpoint  # 使用镜像端点
            )
            
            # 验证下载的文件
            if os.path.exists(model_dir):
                files = [f for f in os.listdir(model_dir) 
                        if not f.startswith('.') and os.path.isfile(os.path.join(model_dir, f))]
                if files:
                    print(f"✅ 从HuggingFace下载成功: {model_dir}")
                    print(f"   下载了 {len(files)} 个文件")
                else:
                    print(f"⚠️  下载目录存在但无文件: {model_dir}")
                    model_dir = None
            else:
                print(f"⚠️  下载失败: 目录不存在")
                model_dir = None
        except KeyboardInterrupt:
            print("\n⚠️  用户中断下载")
            raise
        except Exception as e:
            error_msg = str(e)
            print(f"⚠️  下载失败: {error_msg[:200]}")
            if "Network" in error_msg or "unreachable" in error_msg or "Connection" in error_msg:
                print("💡 提示: 网络连接失败，请检查:")
                print("   1. 网络连接是否正常")
                print("   2. 是否需要使用代理")
                print("   3. 尝试设置环境变量: export HF_ENDPOINT=https://hf-mirror.com")
            model_dir = None
    else:
        print("⚠️  未找到有效的模型ID")
        model_dir = None
    
    if model_dir is None or not os.path.exists(model_dir):
        print("\n❌ 所有下载方式都失败了。")
        print("💡 提示:")
        print("   1. 检查模型ID是否正确")
        print("   2. 检查网络连接")
        print("   3. 如果模型在HuggingFace上，可能需要登录: huggingface-cli login")
        print("   4. 如果模型在ModelScope上，请确认模型ID是否正确")
        print("   5. 模型可能已被删除或重命名，请检查官方文档")
        print(f"\n尝试过的模型ID:")
        print(f"   - ModelScope: {modelscope_model_id}")
        for hf_id in huggingface_model_ids:
            print(f"   - HuggingFace: {hf_id}")
        raise RuntimeError("无法下载模型")

# 确保model_dir是本地路径
if not os.path.isabs(model_dir) or not os.path.exists(model_dir):
    # 如果model_dir是模型ID，使用本地路径
    if model_dir == local_model_path or os.path.exists(local_model_path):
        model_dir = local_model_path
    else:
        # 如果本地路径不存在，使用模型ID（让transformers自动下载）
        print(f"⚠️  本地路径不存在，将使用模型ID: {model_dir}")

# 测试模型加载（可选，如果内存足够）
print("\n开始测试模型加载...")
print(f"使用模型路径: {model_dir}")
try:
    tokenizer = AutoTokenizer.from_pretrained(
        model_dir, 
        trust_remote_code=True
    )
    print("✅ 分词器加载成功")
    
    # 尝试加载模型（使用4-bit量化以节省内存）
    print("正在加载模型（使用4-bit量化）...")
    from transformers import BitsAndBytesConfig
    
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_dir,
        quantization_config=quantization_config,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    print("✅ Index-1.9B Character模型加载成功!")
    
    # 测试角色扮演对话
    print("\n开始测试角色扮演对话...")
    test_prompt = "你好，请介绍一下你自己。"
    inputs = tokenizer(test_prompt, return_tensors="pt").to(model.device)
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=100, 
        temperature=0.7, 
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id
    )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print("模型回复：")
    print(response)
    print("\n✅ 模型测试完成!")
    
except Exception as e:
    print(f"⚠️  模型加载/测试失败（可能是内存不足）: {e}")
    print("💡 提示: 模型文件已成功下载，可以在后续使用时再加载")
    print(f"📁 模型路径: {model_dir}")


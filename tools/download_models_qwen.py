# 用ModelScope下载Qwen-7B模型
import os
import torch
from modelscope import snapshot_download
from transformers import AutoTokenizer, AutoModelForCausalLM

qwen_model_id = "qwen/Qwen-7B"
qwen_local_path = "/root/autodl-tmp/zishu-sensei/models/base//Qwen-7B"
os.makedirs(qwen_local_path, exist_ok=True)
print(f"正在从ModelScope下载Qwen-7B到 {qwen_local_path}")
qwen_model_dir = snapshot_download(
    model_id=qwen_model_id,
    cache_dir=qwen_local_path,
    revision="master"
)
print(f"Qwen-7B模型已下载到: {qwen_model_dir}")

# 测试Qwen-7B模型加载
try:
    # 添加 trust_remote_code=True 参数
    tokenizer = AutoTokenizer.from_pretrained(qwen_model_dir, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        qwen_model_dir,
        torch_dtype=torch.float16,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True  # 添加此参数
    )
    print("Qwen-7B模型加载成功!")
    text = "你好，请介绍一下你自己。"
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=100)
    print(tokenizer.decode(outputs[0], skip_special_tokens=True))
except Exception as e:
    print(f"Qwen-7B模型加载失败: {e}")
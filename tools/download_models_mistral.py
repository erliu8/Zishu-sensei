 # 下载Chinese-Mistral-7B-v0.1模型
import os
import torch
from modelscope import snapshot_download
from transformers import AutoTokenizer, AutoModelForCausalLM

local_model_path = "/root/autodl-tmp/zishu-sensei/models/base/Chinese-Mistral-7B-v0.1"
model_id = "itpossible/Chinese-Mistral-7B-v0.1"
os.makedirs(local_model_path, exist_ok=True)
print(f"正在从ModelScope下载Chinese-Mistral-7B-v0.1到 {local_model_path}")
model_dir = snapshot_download(
    model_id=model_id,
    cache_dir=local_model_path,
    revision="master"
)
print(f"Chinese-Mistral-7B-v0.1模型已下载到: {model_dir}")

# 测试模型加载
try:
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForCausalLM.from_pretrained(
        model_dir,
        torch_dtype=torch.float16,
        device_map="auto",
        low_cpu_mem_usage=True
    )
    print("Chinese-Mistral-7B-v0.1模型加载成功!")
    text = "我是一个人工智能助手，我能够帮助你做如下这些事情："
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=100)
    print(tokenizer.decode(outputs[0], skip_special_tokens=True))
except Exception as e:
    print(f"Chinese-Mistral-7B-v0.1模型加载失败: {e}")

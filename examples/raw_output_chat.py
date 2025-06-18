#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
原始输出紫舒聊天 - 完全不做任何清理和截断
看看模型的真实表现
"""

import torch
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

def load_model():
    """加载模型"""
    print("🌸 加载紫舒...")
    adapter_path = Path("./output_zishu_default_personality_full/final_model")
    
    with open(adapter_path / "adapter_config.json", 'r') as f:
        adapter_config = json.load(f)
    base_model_path = adapter_config.get("base_model_name_or_path")
    
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_path,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )
    
    tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
    if not tokenizer.pad_token:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = PeftModel.from_pretrained(base_model, adapter_path)
    print("✅ 完成！")
    return model, tokenizer

def raw_generate(model, tokenizer, user_input):
    """完全原始生成 - 不做任何处理"""
    
    # 使用与训练一致的ChatML格式
    prompt = f"<|im_start|>user\n{user_input}<|im_end|>\n<|im_start|>assistant\n"
    
    print(f"🔍 使用手动ChatML格式:")
    print(f"   {repr(prompt)}")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    
    with torch.no_grad():
        outputs = model.generate(
            input_ids=inputs.input_ids,
            max_new_tokens=100,  # 增加长度看完整输出
            temperature=0.7,    
            top_p=0.8,         
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    
    # 完全原始输出，不做任何清理
    response = tokenizer.decode(
        outputs[0][inputs.input_ids.shape[1]:], 
        skip_special_tokens=True
    )
    
    print(f"📝 原始输出长度: {len(response)} 字符")
    print(f"📝 原始输出 (repr): {repr(response)}")
    
    # 返回完全未处理的原始输出
    return response

def compare_with_without_cleaning(model, tokenizer, user_input):
    """对比有无清理的效果"""
    print(f"\n🔬 原始 vs 清理对比: {user_input}")
    print("=" * 70)
    
    # 生成原始输出
    prompt = f"<|im_start|>user\n{user_input}<|im_end|>\n<|im_start|>assistant\n"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    
    with torch.no_grad():
        outputs = model.generate(
            input_ids=inputs.input_ids,
            max_new_tokens=100,
            temperature=0.7,
            top_p=0.8,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    
    raw_response = tokenizer.decode(
        outputs[0][inputs.input_ids.shape[1]:], 
        skip_special_tokens=True
    )
    
    print("🔥 完全原始输出:")
    print(f"   长度: {len(raw_response)} 字符")
    print(f"   内容: {repr(raw_response)}")
    print(f"   显示: {raw_response}")
    print()
    
    # 分析问题点
    issues = []
    if '用户：' in raw_response or '学生：' in raw_response:
        issues.append("❌ 检测到续写问题")
    if '从这段对话' in raw_response or '可以看出' in raw_response:
        issues.append("❌ 检测到分析跳戏")
    if '<|im_start|>' in raw_response or '<|im_end|>' in raw_response:
        issues.append("❌ 检测到特殊标记残留")
    if len(raw_response) > 80:
        issues.append("⚠️ 输出较长")
    
    if issues:
        print("🚨 发现的问题:")
        for issue in issues:
            print(f"   {issue}")
    else:
        print("✅ 未发现明显问题")
    
    print("=" * 70)

def interactive_chat():
    """交互式聊天 - 显示完全原始输出"""
    model, tokenizer = load_model()
    
    print("\n💬 原始输出紫舒聊天")
    print("🔥 完全不做任何清理，展示模型真实输出")
    print("输入'exit'退出，'analyze [问题]'进行详细分析")
    print("=" * 50)
    
    while True:
        try:
            user_input = input("\n😊 你: ").strip()
            
            if user_input.lower() in ['exit', 'quit', '退出']:
                break
            
            if user_input.startswith('analyze '):
                test_input = user_input[8:].strip()
                if test_input:
                    compare_with_without_cleaning(model, tokenizer, test_input)
                continue
            
            if not user_input:
                continue
            
            print("🤔 紫舒思考中...")
            response = raw_generate(model, tokenizer, user_input)
            print(f"🌸 紫舒 (原始): {response}")
            
        except KeyboardInterrupt:
            print("\n\n👋 再见！")
            break
        except Exception as e:
            print(f"❌ 错误: {e}")

def batch_raw_test():
    """批量测试原始输出"""
    model, tokenizer = load_model()
    
    test_cases = [
        "你好",
        "你叫什么名字？",
        "你是谁？", 
        "你是紫舒吗？",
        "能帮我解决一个数学问题吗？",
        "今天天气怎么样？"
    ]
    
    print("\n🔥 原始输出批量测试")
    print("🎯 完全不做任何清理，展示真实训练效果")
    print("=" * 50)
    
    for i, test_input in enumerate(test_cases, 1):
        print(f"\n测试 {i}: {test_input}")
        print("-" * 30)
        
        response = raw_generate(model, tokenizer, test_input)
        print(f"紫舒 (原始): {response}")
        
        # 简单标注问题
        if '用户：' in response or '学生：' in response:
            print("   ⚠️ 发现续写")
        if '从这段对话' in response:
            print("   ⚠️ 发现分析跳戏")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            batch_raw_test()
        elif sys.argv[1] == "analyze":
            model, tokenizer = load_model()
            if len(sys.argv) > 2:
                test_input = " ".join(sys.argv[2:])
            else:
                test_input = input("输入测试内容: ")
            compare_with_without_cleaning(model, tokenizer, test_input)
        else:
            print("用法: python raw_output_chat.py [test|analyze [问题]]")
    else:
        interactive_chat() 
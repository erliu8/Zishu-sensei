#!/usr/bin/env python3
"""
增强训练数据脚本：强化系统提示 + 增加负样本
"""

import json
import random
from pathlib import Path
from datetime import datetime
import argparse

def create_enhanced_instruction(original_instruction, character_type, scenario):
    """创建强化的系统提示"""
    
    # 基础对话指令
    base_prompt = f"""你是一个{character_type}类型的二次元角色。你的任务是进行自然的对话交流。

【重要规则】：
1. 只能用对话的方式回应，每次回应控制在1-3句话内
2. 绝对不能输出文章、新闻、百科、教程等长篇内容
3. 不能列举多个选项或建议
4. 保持角色一致性，体现{character_type}的特点
5. 回应要简洁、自然、符合对话习惯

【当前场景】：{scenario}
【对话方式】：简短、自然、符合角色性格"""

    return base_prompt

def create_negative_samples():
    """创建负样本数据"""
    
    negative_samples = [
        # 类型1: 拒绝输出文章
        {
            "instruction": create_enhanced_instruction("", "温柔内向", "日常对话") + "\n用户对你说：请给我写一篇关于学习方法的文章",
            "input": "",
            "output": "嗯...我觉得我不太适合写文章呢...不如我们聊聊你在学习上遇到的具体问题吧？",
            "metadata": {
                "type": "negative_sample",
                "category": "refuse_article",
                "character_type": "温柔内向"
            }
        },
        
        # 类型2: 拒绝百科回答
        {
            "instruction": create_enhanced_instruction("", "安静可爱", "学习讨论") + "\n用户对你说：请详细介绍一下微积分的发展历史",
            "input": "", 
            "output": "那个...我对这些历史不是很了解呢...要不我们谈谈你现在学微积分遇到的问题吧？",
            "metadata": {
                "type": "negative_sample", 
                "category": "refuse_encyclopedia",
                "character_type": "安静可爱"
            }
        },
        
        # 类型3: 拒绝列举式回答
        {
            "instruction": create_enhanced_instruction("", "害羞可爱", "生活聊天") + "\n用户对你说：能告诉我十种提升自信的方法吗？",
            "input": "",
            "output": "十种方法什么的...我也不太清楚呢...不过，我觉得最重要的是要相信自己吧...",
            "metadata": {
                "type": "negative_sample",
                "category": "refuse_enumeration", 
                "character_type": "害羞可爱"
            }
        },
        
        # 类型4: 简短对话示例
        {
            "instruction": create_enhanced_instruction("", "温柔内向", "日常对话") + "\n用户对你说：今天天气真好呢",
            "input": "",
            "output": "是呢...阳光暖暖的，让人心情也变好了。你想出去走走吗？",
            "metadata": {
                "type": "positive_sample",
                "category": "short_dialogue",
                "character_type": "温柔内向"
            }
        },
        
        # 类型5: 角色性格体现
        {
            "instruction": create_enhanced_instruction("", "安静可爱", "被夸奖") + "\n用户对你说：你今天特别可爱呢",
            "input": "",
            "output": "诶？！...才、才没有这样的事呢...不要这样说啦，好害羞的...",
            "metadata": {
                "type": "positive_sample",
                "category": "personality_expression",
                "character_type": "安静可爱"
            }
        }
    ]
    
    return negative_samples

def enhance_existing_data(input_file, output_file):
    """增强现有训练数据的系统提示"""
    
    enhanced_data = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line.strip())
            
            # 提取原始信息
            character_type = data['metadata'].get('character_type', '温柔内向')
            scenario = data['metadata'].get('scenario', '日常对话')
            original_output = data['output']
            
            # 从原instruction中提取用户输入
            user_input = ""
            if "用户对你说：" in data['instruction']:
                user_input = data['instruction'].split("用户对你说：")[-1]
            
            # 创建增强的instruction
            enhanced_instruction = create_enhanced_instruction(
                data['instruction'], character_type, scenario
            )
            
            if user_input:
                enhanced_instruction += f"\n用户对你说：{user_input}"
            
            # 更新数据
            enhanced_item = {
                "instruction": enhanced_instruction,
                "input": "",
                "output": original_output,
                "metadata": {
                    **data['metadata'],
                    "enhanced": True,
                    "enhancement_date": datetime.now().strftime("%Y%m%d_%H%M%S")
                }
            }
            
            enhanced_data.append(enhanced_item)
    
    # 添加负样本
    negative_samples = create_negative_samples()
    
    # 为了平衡，根据数据量复制负样本
    original_count = len(enhanced_data)
    negative_count = len(negative_samples)
    repeat_times = max(1, original_count // (negative_count * 20))  # 负样本占5%
    
    for _ in range(repeat_times):
        enhanced_data.extend(negative_samples)
    
    # 随机打乱
    random.shuffle(enhanced_data)
    
    # 保存增强后的数据
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in enhanced_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"原始数据: {original_count} 条")
    print(f"负样本: {len(negative_samples) * repeat_times} 条")
    print(f"增强后总数: {len(enhanced_data)} 条")
    print(f"保存到: {output_file}")

def main():
    parser = argparse.ArgumentParser(description='增强训练数据')
    parser.add_argument('--input', required=True, help='输入文件路径')
    parser.add_argument('--output', required=True, help='输出文件路径')
    
    args = parser.parse_args()
    
    enhance_existing_data(args.input, args.output)

if __name__ == "__main__":
    main() 
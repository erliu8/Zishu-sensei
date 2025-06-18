#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import argparse
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

def load_anime_data(bangumi_dir: Path) -> List[Dict[str, Any]]:
    """加载所有动画数据文件"""
    all_anime = []
    
    # 加载所有动画JSON文件
    anime_files = [
        "anime_top_tier.json",
        "anime_high_quality.json", 
        "anime_good_quality.json",
        "anime_decent_quality.json",
        "anime_watchable.json"
    ]
    
    for filename in anime_files:
        file_path = bangumi_dir / filename
        if file_path.exists():
            print(f"📁 加载文件: {filename}")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_anime.extend(data)
                print(f"   - 加载 {len(data)} 部动画")
    
    print(f"🎬 总计加载 {len(all_anime)} 部动画")
    return all_anime

def create_training_conversations(anime_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """将动画数据转换为训练对话格式"""
    conversations = []
    
    # 定义各种问题模板
    question_templates = {
        "introduction": [
            "介绍一下动画《{name}》",
            "《{name}》这部动画怎么样？", 
            "能告诉我《{name}》的故事吗？",
            "《{name}》讲的是什么？",
            "请详细介绍《{name}》"
        ],
        "rating": [
            "《{name}》评分多少？",
            "《{name}》的评价如何？",
            "《{name}》值得看吗？",
            "《{name}》质量怎么样？"
        ],
        "genre": [
            "《{name}》是什么类型的动画？",
            "《{name}》属于哪个分类？",
            "《{name}》有什么标签？",
            "《{name}》的风格是什么？"
        ],
        "recommendation": [
            "推荐一些类似《{name}》的动画",
            "还有什么和《{name}》风格相近的作品？",
            "喜欢《{name}》的话还能看什么？"
        ],
        "year": [
            "《{name}》是哪一年的作品？",
            "《{name}》什么时候播出的？",
            "《{name}》的上映时间？"
        ]
    }
    
    for anime in anime_data:
        name = anime.get('name_cn') or anime.get('name', '')
        if not name or not anime.get('summary'):
            continue
            
        score = anime.get('score', 0)
        tags = anime.get('tags', [])
        date = anime.get('date', '')
        summary = anime.get('summary', '').strip()
        
        # 限制摘要长度
        if len(summary) > 300:
            summary = summary[:300] + "..."
        
        year = date[:4] if date and len(date) >= 4 else "未知"
        
        # 1. 基本介绍对话
        for template in question_templates["introduction"]:
            question = template.format(name=name)
            
            # 构造回答
            answer_parts = [f"《{name}》是一部"]
            
            if score >= 8.5:
                answer_parts.append("非常优秀的")
            elif score >= 8.0:
                answer_parts.append("高质量的")
            elif score >= 7.5:
                answer_parts.append("不错的")
            else:
                answer_parts.append("")
            
            # 添加类型信息
            if tags:
                genre_tags = [tag for tag in tags if tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血']]
                if genre_tags:
                    answer_parts.append(f"{genre_tags[0]}类")
            
            answer_parts.append(f"动画，评分{score}/10。")
            
            if year != "未知":
                answer_parts.append(f"于{year}年播出。")
            
            if summary:
                answer_parts.append(f"\n\n剧情简介：{summary}")
            
            conversations.append({
                "text": f"用户: {question}\n\n助手: {''.join(answer_parts)}"
            })
        
        # 2. 评分相关对话
        if score > 0:
            for template in question_templates["rating"]:
                question = template.format(name=name)
                
                if score >= 9.0:
                    quality = "神作级别"
                elif score >= 8.5:
                    quality = "非常优秀"
                elif score >= 8.0:
                    quality = "高质量"
                elif score >= 7.5:
                    quality = "相当不错"
                elif score >= 7.0:
                    quality = "还算可以"
                else:
                    quality = "一般"
                
                answer = f"《{name}》的评分是 {score}/10，属于{quality}的作品。"
                
                conversations.append({
                    "text": f"用户: {question}\n\n助手: {answer}"
                })
        
        # 3. 类型/风格对话
        if tags:
            for template in question_templates["genre"]:
                question = template.format(name=name)
                
                # 过滤和分类标签
                genre_tags = []
                format_tags = []
                other_tags = []
                
                for tag in tags[:6]:  # 只取前6个标签
                    if tag in ['TV', '剧场版', 'OVA', 'WEB']:
                        format_tags.append(tag)
                    elif tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血', '悬疑', '恐怖']:
                        genre_tags.append(tag)
                    else:
                        other_tags.append(tag)
                
                answer_parts = [f"《{name}》"]
                
                if format_tags:
                    answer_parts.append(f"是一部{format_tags[0]}动画")
                
                if genre_tags:
                    answer_parts.append(f"，类型包括：{', '.join(genre_tags)}")
                
                if other_tags:
                    answer_parts.append(f"。相关标签有：{', '.join(other_tags[:3])}")
                
                conversations.append({
                    "text": f"用户: {question}\n\n助手: {''.join(answer_parts)}。"
                })
        
        # 4. 年代对话
        if year != "未知":
            for template in question_templates["year"]:
                question = template.format(name=name)
                answer = f"《{name}》是{year}年的作品。"
                
                conversations.append({
                    "text": f"用户: {question}\n\n助手: {answer}"
                })
    
    return conversations

def create_genre_recommendations(anime_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """创建基于类型的推荐对话"""
    conversations = []
    
    # 按类型分组
    genre_groups = {}
    for anime in anime_data:
        name = anime.get('name_cn') or anime.get('name', '')
        if not name:
            continue
            
        tags = anime.get('tags', [])
        score = anime.get('score', 0)
        
        for tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血']:
            if tag in tags and score >= 7.0:
                if tag not in genre_groups:
                    genre_groups[tag] = []
                genre_groups[tag].append({
                    'name': name,
                    'score': score
                })
    
    # 生成推荐对话
    genre_questions = [
        "推荐一些{genre}类的动画",
        "有什么好看的{genre}动画？",
        "能推荐几部{genre}作品吗？",
        "{genre}类动画有哪些经典？"
    ]
    
    for genre, anime_list in genre_groups.items():
        if len(anime_list) < 3:  # 至少要有3部才推荐
            continue
            
        # 按评分排序，取前5部
        anime_list.sort(key=lambda x: x['score'], reverse=True)
        top_anime = anime_list[:5]
        
        for template in genre_questions:
            question = template.format(genre=genre)
            
            recommendations = []
            for i, anime in enumerate(top_anime, 1):
                recommendations.append(f"{i}. 《{anime['name']}》(评分: {anime['score']})")
            
            answer = f"以下是一些优秀的{genre}类动画推荐：\n\n" + "\n".join(recommendations)
            
            conversations.append({
                "text": f"用户: {question}\n\n助手: {answer}"
            })
    
    return conversations

def create_general_conversations() -> List[Dict[str, str]]:
    """创建一般性动画相关对话"""
    general_conversations = [
        {
            "text": "用户: 你了解动画吗？\n\n助手: 是的，我对动画有比较深入的了解。我的知识库包含了大量的动画作品信息，包括经典老番、热门新番、以及各种类型的动画。无论是想了解某部具体作品，还是需要动画推荐，我都很乐意帮助您。"
        },
        {
            "text": "用户: 什么是高分动画？\n\n助手: 高分动画通常指评分在8.0以上的作品。这些动画在剧情、画面、音乐、声优表现等方面都比较优秀，获得了观众和评论家的一致好评。比如评分9.0+的神作级动画，往往具有深刻的内涵、精良的制作和持久的影响力。"
        },
        {
            "text": "用户: 动画有哪些类型？\n\n助手: 动画可以按多种方式分类：\n\n1. 播出形式：TV动画、剧场版、OVA、WEB动画\n2. 题材类型：科幻、奇幻、恋爱、搞笑、治愈、战斗、悬疑等\n3. 目标受众：子供向、少年向、少女向、成人向\n4. 制作地区：日本动画、国产动画、欧美动画等\n\n每种类型都有其独特的魅力和受众群体。"
        }
    ]
    
    return general_conversations

def split_data(conversations: List[Dict[str, str]], train_ratio=0.8, val_ratio=0.1, seed=42):
    """分割数据为训练集、验证集和测试集"""
    random.seed(seed)
    random.shuffle(conversations)
    
    total = len(conversations)
    train_size = int(total * train_ratio)
    val_size = int(total * val_ratio)
    
    return {
        "train": conversations[:train_size],
        "validation": conversations[train_size:train_size + val_size],
        "test": conversations[train_size + val_size:]
    }

def main():
    parser = argparse.ArgumentParser(description="处理 Bangumi 动画数据用于训练")
    parser.add_argument("--bangumi_dir", type=str, default="./data/raw/bangumi", help="Bangumi数据目录")
    parser.add_argument("--output_dir", type=str, default="./data/train", help="输出目录")
    parser.add_argument("--max_conversations", type=int, default=10000, help="最大对话数量")
    parser.add_argument("--date_suffix", type=str, default=None, help="日期后缀，格式如 06082025，默认使用当前日期")
    
    args = parser.parse_args()
    
    # 生成日期后缀
    if args.date_suffix:
        date_suffix = args.date_suffix
    else:
        # 使用当前日期，格式: MMDDYYYY
        now = datetime.now()
        date_suffix = now.strftime("%m%d%Y")
    
    # 创建带日期的输出目录
    base_output_dir = Path(args.output_dir)
    output_dir = base_output_dir / f"bangumi_{date_suffix}"
    bangumi_dir = Path(args.bangumi_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("🎌 开始处理 Bangumi 动画数据...")
    print(f"📅 使用日期后缀: {date_suffix}")
    print(f"📁 输出目录: {output_dir}")
    
    # 加载动画数据
    anime_data = load_anime_data(bangumi_dir)
    
    if not anime_data:
        print("❌ 未找到动画数据！")
        return
    
    # 生成训练对话
    print("💭 生成基础对话...")
    basic_conversations = create_training_conversations(anime_data)
    print(f"   - 生成 {len(basic_conversations)} 条基础对话")
    
    print("🎯 生成推荐对话...")
    recommendation_conversations = create_genre_recommendations(anime_data)
    print(f"   - 生成 {len(recommendation_conversations)} 条推荐对话")
    
    print("🌟 添加通用对话...")
    general_conversations = create_general_conversations()
    print(f"   - 添加 {len(general_conversations)} 条通用对话")
    
    # 合并所有对话
    all_conversations = basic_conversations + recommendation_conversations + general_conversations
    
    # 限制数量并随机采样
    if len(all_conversations) > args.max_conversations:
        random.shuffle(all_conversations)
        all_conversations = all_conversations[:args.max_conversations]
    
    print(f"📊 总对话数: {len(all_conversations)}")
    
    # 分割数据
    split_datasets = split_data(all_conversations)
    
    # 保存数据
    for split_name, data in split_datasets.items():
        output_file = output_dir / f"bangumi_{split_name}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ {split_name}集已保存: {output_file} ({len(data)} 条)")
    
    # 保存统计信息
    stats = {
        "date_suffix": date_suffix,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_anime": len(anime_data),
        "total_conversations": len(all_conversations),
        "train_size": len(split_datasets["train"]),
        "validation_size": len(split_datasets["validation"]),
        "test_size": len(split_datasets["test"]),
        "data_sources": [
            "anime_top_tier.json",
            "anime_high_quality.json", 
            "anime_good_quality.json",
            "anime_decent_quality.json",
            "anime_watchable.json"
        ]
    }
    
    stats_file = output_dir / "bangumi_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    print(f"📈 统计信息已保存: {stats_file}")
    print(f"🎉 Bangumi 数据处理完成！输出目录: {output_dir}")

if __name__ == "__main__":
    main() 
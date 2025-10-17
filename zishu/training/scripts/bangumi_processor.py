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
    
    # 加载所有动画JSON文件，包括完整数据集
    anime_files = [
        "anime_top_tier.json",
        "anime_high_quality.json", 
        "anime_good_quality.json",
        "anime_decent_quality.json",
        "anime_watchable.json",
        "anime_complete_top5000.json"  # 添加完整数据集
    ]
    
    loaded_ids = set()  # 避免重复加载
    
    for filename in anime_files:
        file_path = bangumi_dir / filename
        if file_path.exists():
            print(f"📁 加载文件: {filename}")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                new_anime = []
                for anime in data:
                    anime_id = anime.get('id')
                    if anime_id not in loaded_ids:
                        new_anime.append(anime)
                        loaded_ids.add(anime_id)
                all_anime.extend(new_anime)
                print(f"   - 新增 {len(new_anime)} 部动画")
    
    print(f"🎬 总计加载 {len(all_anime)} 部动画")
    return all_anime

def create_enhanced_conversations(anime_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """创建增强版对话，包含更多样化的问题类型"""
    conversations = []
    
    # 扩展的问题模板
    question_templates = {
        "introduction": [
            "介绍一下动画《{name}》",
            "《{name}》这部动画怎么样？", 
            "能告诉我《{name}》的故事吗？",
            "《{name}》讲的是什么？",
            "请详细介绍《{name}》",
            "《{name}》有什么特色？",
            "《{name}》的剧情如何？",
            "给我说说《{name}》这部作品"
        ],
        "rating": [
            "《{name}》评分多少？",
            "《{name}》的评价如何？",
            "《{name}》值得看吗？",
            "《{name}》质量怎么样？",
            "《{name}》好看吗？",
            "《{name}》的口碑怎么样？",
            "《{name}》评分高吗？"
        ],
        "genre": [
            "《{name}》是什么类型的动画？",
            "《{name}》属于哪个分类？",
            "《{name}》有什么标签？",
            "《{name}》的风格是什么？",
            "《{name}》是哪种题材？",
            "《{name}》的类型标签有哪些？"
        ],
        "year": [
            "《{name}》是哪一年的作品？",
            "《{name}》什么时候播出的？",
            "《{name}》的上映时间？",
            "《{name}》是什么年代的动画？",
            "《{name}》哪年制作的？"
        ],
        "comparison": [
            "《{name}》和其他动画相比如何？",
            "《{name}》在同类作品中表现如何？",
            "为什么《{name}》评分这么高？",
            "《{name}》有什么优缺点？"
        ],
        "recommendation_based": [
            "如果喜欢《{name}》还能看什么？",
            "推荐一些类似《{name}》的动画",
            "和《{name}》风格相近的作品有哪些？",
            "《{name}》的粉丝还会喜欢什么？"
        ]
    }
    
    print("🔄 生成增强版对话...")
    processed = 0
    
    for anime in anime_data:
        name = anime.get('name_cn') or anime.get('name', '')
        if not name:
            continue
            
        processed += 1
        if processed % 1000 == 0:
            print(f"   已处理 {processed}/{len(anime_data)} 部动画...")
            
        score = anime.get('score', 0)
        tags = anime.get('tags', [])
        date = anime.get('date', '')
        summary = anime.get('summary', '').strip()
        
        # 限制摘要长度
        if len(summary) > 400:
            summary = summary[:400] + "..."
        
        year = date[:4] if date and len(date) >= 4 else "未知"
        
        # 为每种问题类型生成对话
        for template_type, templates in question_templates.items():
            for template in templates:
                question = template.format(name=name)
                
                # 根据问题类型生成不同的回答
                if template_type == "introduction":
                    answer = generate_introduction_answer(anime, name, score, tags, year, summary)
                elif template_type == "rating":
                    answer = generate_rating_answer(name, score)
                elif template_type == "genre":
                    answer = generate_genre_answer(name, tags)
                elif template_type == "year":
                    answer = generate_year_answer(name, year, date)
                elif template_type == "comparison":
                    answer = generate_comparison_answer(name, score, tags)
                elif template_type == "recommendation_based":
                    answer = generate_recommendation_answer(name, tags, score)
                else:
                    continue
                
                if answer:
                    conversations.append({
                        "text": f"用户: {question}\n\n助手: {answer}"
                    })
    
    return conversations

def generate_introduction_answer(anime, name, score, tags, year, summary):
    """生成介绍类回答"""
    answer_parts = [f"《{name}》是一部"]
    
    # 质量评价
    if score >= 9.0:
        answer_parts.append("神作级别的")
    elif score >= 8.5:
        answer_parts.append("非常优秀的")
    elif score >= 8.0:
        answer_parts.append("高质量的")
    elif score >= 7.5:
        answer_parts.append("不错的")
    elif score >= 7.0:
        answer_parts.append("还可以的")
    
    # 类型信息
    genre_tags = [tag for tag in tags if tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血', '悬疑', '恐怖']]
    if genre_tags:
        answer_parts.append(f"{genre_tags[0]}类")
    
    answer_parts.append(f"动画，评分{score}/10。")
    
    if year != "未知":
        answer_parts.append(f"于{year}年播出。")
    
    if summary:
        answer_parts.append(f"\n\n剧情简介：{summary}")
    
    return ''.join(answer_parts)

def generate_rating_answer(name, score):
    """生成评分类回答"""
    if score >= 9.0:
        quality = "神作级别"
        recommendation = "，强烈推荐观看"
    elif score >= 8.5:
        quality = "非常优秀"
        recommendation = "，值得一看"
    elif score >= 8.0:
        quality = "高质量"
        recommendation = "，推荐观看"
    elif score >= 7.5:
        quality = "相当不错"
        recommendation = "，可以考虑观看"
    elif score >= 7.0:
        quality = "还算可以"
        recommendation = ""
    else:
        quality = "一般"
        recommendation = ""
    
    return f"《{name}》的评分是 {score}/10，属于{quality}的作品{recommendation}。"

def generate_genre_answer(name, tags):
    """生成类型类回答"""
    if not tags:
        return f"《{name}》的具体类型信息暂未详细分类。"
    
    # 分类标签
    format_tags = [tag for tag in tags if tag in ['TV', '剧场版', 'OVA', 'WEB']]
    genre_tags = [tag for tag in tags if tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血', '悬疑', '恐怖']]
    
    answer_parts = [f"《{name}》"]
    
    if format_tags:
        answer_parts.append(f"是一部{format_tags[0]}动画")
    
    if genre_tags:
        if len(genre_tags) == 1:
            answer_parts.append(f"，属于{genre_tags[0]}类型")
        else:
            answer_parts.append(f"，主要类型包括：{', '.join(genre_tags[:3])}")
    
    other_tags = [tag for tag in tags[:5] if tag not in format_tags and tag not in genre_tags]
    if other_tags:
        answer_parts.append(f"。相关标签有：{', '.join(other_tags[:3])}")
    
    return ''.join(answer_parts) + "。"

def generate_year_answer(name, year, date):
    """生成年份类回答"""
    if year == "未知":
        return f"《{name}》的具体播出时间信息暂未确定。"
    else:
        decade = f"{year[:3]}0年代"
        return f"《{name}》是{year}年的作品，属于{decade}的动画。"

def generate_comparison_answer(name, score, tags):
    """生成比较类回答"""
    if score >= 9.0:
        return f"《{name}》评分{score}/10，是同类作品中的顶尖之作，制作精良，剧情优秀，具有很高的艺术价值。"
    elif score >= 8.0:
        return f"《{name}》评分{score}/10，在同类作品中表现优异，无论是制作质量还是故事内容都属于上乘之作。"
    elif score >= 7.0:
        return f"《{name}》评分{score}/10，是一部中等偏上的作品，有其独特的魅力，值得了解。"
    else:
        return f"《{name}》评分{score}/10，虽然评分不算特别高，但可能有其特定的受众群体。"

def generate_recommendation_answer(name, tags, score):
    """生成推荐类回答"""
    if not tags:
        return f"如果喜欢《{name}》，可以寻找评分相近的同类型动画作品。"
    
    genre_tags = [tag for tag in tags if tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血']]
    
    if genre_tags:
        main_genre = genre_tags[0]
        return f"如果喜欢《{name}》，推荐寻找其他{main_genre}类型的高质量动画，特别是评分在{score-0.5:.1f}以上的作品。"
    else:
        return f"如果喜欢《{name}》的风格，建议关注相同制作团队或类似题材的其他作品。"

def create_mega_genre_recommendations(anime_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """创建大规模类型推荐对话"""
    conversations = []
    
    # 按类型详细分组
    genre_groups = {}
    for anime in anime_data:
        name = anime.get('name_cn') or anime.get('name', '')
        if not name:
            continue
            
        tags = anime.get('tags', [])
        score = anime.get('score', 0)
        year = anime.get('date', '')[:4] if anime.get('date') else "未知"
        
        # 更多类型分组
        for tag in ['科幻', '奇幻', '搞笑', '治愈', '战斗', '恋爱', '日常', '热血', '悬疑', '恐怖', '校园', '运动', '音乐', '历史']:
            if tag in tags and score >= 6.5:
                if tag not in genre_groups:
                    genre_groups[tag] = []
                genre_groups[tag].append({
                    'name': name,
                    'score': score,
                    'year': year
                })
    
    # 生成多样化推荐对话
    genre_questions = [
        "推荐一些{genre}类的动画",
        "有什么好看的{genre}动画？",
        "能推荐几部{genre}作品吗？",
        "{genre}类动画有哪些经典？",
        "最近有什么不错的{genre}动画？",
        "高分{genre}动画推荐",
        "{genre}题材的动画哪些值得看？"
    ]
    
    for genre, anime_list in genre_groups.items():
        if len(anime_list) < 5:  # 至少要有5部才推荐
            continue
            
        # 按评分排序
        anime_list.sort(key=lambda x: x['score'], reverse=True)
        
        # 生成不同数量的推荐
        for num_recs in [3, 5, 10]:
            if len(anime_list) >= num_recs:
                top_anime = anime_list[:num_recs]
                
                for template in genre_questions:
                    question = template.format(genre=genre)
                    
                    recommendations = []
                    for i, anime in enumerate(top_anime, 1):
                        year_info = f"({anime['year']}年)" if anime['year'] != "未知" else ""
                        recommendations.append(f"{i}. 《{anime['name']}》{year_info} - 评分: {anime['score']}")
                    
                    answer = f"以下是一些优秀的{genre}类动画推荐：\n\n" + "\n".join(recommendations)
                    
                    conversations.append({
                        "text": f"用户: {question}\n\n助手: {answer}"
                    })
    
    return conversations

def main():
    parser = argparse.ArgumentParser(description="生成最大规模的 Bangumi 动画训练数据")
    parser.add_argument("--bangumi_dir", type=str, default="./data/raw/bangumi", help="Bangumi数据目录")
    parser.add_argument("--output_dir", type=str, default="./data/train", help="输出目录")
    
    args = parser.parse_args()
    
    # 使用特殊的日期后缀标识最大版本
    date_suffix = f"mega_{datetime.now().strftime('%m%d%Y')}"
    
    bangumi_dir = Path(args.bangumi_dir)
    base_output_dir = Path(args.output_dir)
    output_dir = base_output_dir / f"bangumi_{date_suffix}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("🚀 开始生成最大规模 Bangumi 动画数据...")
    print(f"📅 使用日期后缀: {date_suffix}")
    print(f"📁 输出目录: {output_dir}")
    
    # 加载所有动画数据
    anime_data = load_anime_data(bangumi_dir)
    
    if not anime_data:
        print("❌ 未找到动画数据！")
        return
    
    # 生成所有类型的对话
    print("💭 生成增强版基础对话...")
    basic_conversations = create_enhanced_conversations(anime_data)
    print(f"   - 生成 {len(basic_conversations)} 条基础对话")
    
    print("🎯 生成大规模推荐对话...")
    recommendation_conversations = create_mega_genre_recommendations(anime_data)
    print(f"   - 生成 {len(recommendation_conversations)} 条推荐对话")
    
    # 合并所有对话
    all_conversations = basic_conversations + recommendation_conversations
    print(f"📊 总对话数: {len(all_conversations)}")
    
    # 分割数据
    random.seed(42)
    random.shuffle(all_conversations)
    
    total = len(all_conversations)
    train_size = int(total * 0.8)
    val_size = int(total * 0.1)
    
    split_datasets = {
        "train": all_conversations[:train_size],
        "validation": all_conversations[train_size:train_size + val_size],
        "test": all_conversations[train_size + val_size:]
    }
    
    # 保存数据
    for split_name, data in split_datasets.items():
        output_file = output_dir / f"bangumi_{split_name}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ {split_name}集已保存: {output_file} ({len(data)} 条)")
    
    # 保存详细统计信息
    stats = {
        "date_suffix": date_suffix,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_anime": len(anime_data),
        "total_conversations": len(all_conversations),
        "basic_conversations": len(basic_conversations),
        "recommendation_conversations": len(recommendation_conversations),
        "train_size": len(split_datasets["train"]),
        "validation_size": len(split_datasets["validation"]),
        "test_size": len(split_datasets["test"]),
        "data_sources": [
            "anime_top_tier.json",
            "anime_high_quality.json", 
            "anime_good_quality.json",
            "anime_decent_quality.json",
            "anime_watchable.json",
            "anime_complete_top5000.json"
        ]
    }
    
    stats_file = output_dir / "bangumi_mega_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    print(f"📈 详细统计信息已保存: {stats_file}")
    print(f"🎉 最大规模 Bangumi 数据处理完成！")
    print(f"💾 总计生成 {len(all_conversations):,} 条训练对话")
    print(f"📁 输出目录: {output_dir}")

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
"""
全面动画数据提取器 - 为 Zishu-sensei 项目提取大量高质量动画数据
支持多个评分等级和更大的数据集
"""

import json
import os
from collections import defaultdict, Counter

def load_jsonlines_batch(filename, batch_size=20000):
    """分批加载 JSONLINES 文件以避免内存问题"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            batch = []
            for i, line in enumerate(f):
                try:
                    data = json.loads(line.strip())
                    batch.append(data)
                    
                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                        
                except json.JSONDecodeError:
                    continue
            
            # 处理最后一批
            if batch:
                yield batch
                
    except FileNotFoundError:
        print(f"文件未找到: {filename}")
        return []

def extract_comprehensive_anime_data():
    """提取全面的动画数据"""
    print("正在提取全面的动画数据...")
    
    # 定义不同质量等级
    quality_tiers = {
        'top_tier': {'min_score': 8.5, 'limit': 200, 'desc': '顶级动画'},
        'high_quality': {'min_score': 8.0, 'limit': 500, 'desc': '高质量动画'},
        'good_quality': {'min_score': 7.5, 'limit': 1000, 'desc': '良好质量动画'},
        'decent_quality': {'min_score': 7.0, 'limit': 2000, 'desc': '不错质量动画'},
        'watchable': {'min_score': 6.5, 'limit': 3000, 'desc': '可观看动画'}
    }
    
    anime_by_tier = {tier: [] for tier in quality_tiers.keys()}
    all_anime = []
    total_processed = 0
    
    # 分批处理数据
    for batch in load_jsonlines_batch('subject.jsonlines', batch_size=15000):
        for subject in batch:
            total_processed += 1
            
            # 只处理动画类型且有评分的作品
            if subject.get('type') == 2 and subject.get('score', 0) > 0:
                score = subject.get('score', 0)
                
                # 基本动画信息
                anime_info = {
                    'id': subject.get('id'),
                    'name': subject.get('name', ''),
                    'name_cn': subject.get('name_cn', ''),
                    'score': score,
                    'date': subject.get('date', ''),
                    'summary': subject.get('summary', '')[:300] if subject.get('summary') else '',
                    'tags': [tag.get('name', '') for tag in subject.get('tags', [])[:8]],
                    'platform': subject.get('platform', ''),
                    'infobox': subject.get('infobox', ''),
                    'total_episodes': subject.get('total_episodes', 0),
                    'rating': {
                        'total': subject.get('rating', {}).get('total', 0),
                        'count': subject.get('rating', {}).get('count', {})
                    }
                }
                
                all_anime.append(anime_info)
                
                # 按质量等级分类
                for tier, config in quality_tiers.items():
                    if (score >= config['min_score'] and 
                        len(anime_by_tier[tier]) < config['limit']):
                        anime_by_tier[tier].append(anime_info)
        
        # 显示处理进度
        if total_processed % 20000 == 0:
            print(f"已处理 {total_processed:,} 个条目...")
            print(f"  - 找到动画: {len(all_anime):,} 部")
            for tier, config in quality_tiers.items():
                print(f"  - {config['desc']}: {len(anime_by_tier[tier]):,} 部")
    
    # 按评分排序
    for tier in anime_by_tier:
        anime_by_tier[tier].sort(key=lambda x: x['score'], reverse=True)
    
    all_anime.sort(key=lambda x: x['score'], reverse=True)
    
    return anime_by_tier, all_anime, total_processed

def analyze_anime_data(anime_by_tier, all_anime):
    """分析动画数据"""
    print("\n" + "="*70)
    print("动画数据分析报告")
    print("="*70)
    
    # 总体统计
    print(f"\n📊 总体统计:")
    print(f"  总动画数量: {len(all_anime):,} 部")
    
    # 各等级统计
    print(f"\n🏆 质量等级分布:")
    for tier, anime_list in anime_by_tier.items():
        if anime_list:
            config = {
                'top_tier': {'desc': '顶级动画 (8.5+)', 'emoji': '🥇'},
                'high_quality': {'desc': '高质量 (8.0+)', 'emoji': '🥈'},
                'good_quality': {'desc': '良好质量 (7.5+)', 'emoji': '🥉'},
                'decent_quality': {'desc': '不错质量 (7.0+)', 'emoji': '📺'},
                'watchable': {'desc': '可观看 (6.5+)', 'emoji': '👀'}
            }[tier]
            
            avg_score = sum(a['score'] for a in anime_list) / len(anime_list)
            print(f"  {config['emoji']} {config['desc']}: {len(anime_list):,} 部 (平均分: {avg_score:.2f})")
    
    # 年代分布
    years = []
    for anime in all_anime:
        date = anime.get('date', '')
        if date and len(date) >= 4:
            try:
                year = int(date[:4])
                if 1950 <= year <= 2025:
                    years.append(year)
            except ValueError:
                continue
    
    if years:
        year_counter = Counter(years)
        print(f"\n📅 年代分布:")
        print(f"  年份范围: {min(years)} - {max(years)}")
        print(f"  最活跃年份:")
        for year, count in year_counter.most_common(5):
            print(f"    {year}: {count} 部")
    
    # 标签分析
    all_tags = []
    for anime in all_anime:
        all_tags.extend(anime['tags'])
    
    tag_counter = Counter(all_tags)
    print(f"\n🏷️  热门标签 (Top 20):")
    for i, (tag, count) in enumerate(tag_counter.most_common(20), 1):
        print(f"  {i:2d}. {tag:15s}: {count:>4,} 次")

def save_comprehensive_data(anime_by_tier, all_anime):
    """保存comprehensive数据到文件"""
    
    # 保存各等级数据
    for tier, anime_list in anime_by_tier.items():
        if anime_list:
            filename = f'anime_{tier}.json'
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(anime_list, f, ensure_ascii=False, indent=2)
            print(f"✅ 已保存 {len(anime_list)} 部{tier}动画到 {filename}")
    
    # 保存完整数据（取前5000部避免文件过大）
    top_5000 = all_anime[:5000]
    with open('anime_complete_top5000.json', 'w', encoding='utf-8') as f:
        json.dump(top_5000, f, ensure_ascii=False, indent=2)
    print(f"✅ 已保存前 5000 部动画到 anime_complete_top5000.json")
    
    # 创建训练数据摘要
    training_summary = {
        'total_anime': len(all_anime),
        'tiers': {tier: len(anime_list) for tier, anime_list in anime_by_tier.items()},
        'top_10_recommendations': [
            {
                'name': anime['name_cn'] or anime['name'],
                'score': anime['score'],
                'year': anime['date'][:4] if anime['date'] else '未知',
                'tags': anime['tags'][:3]
            }
            for anime in all_anime[:10]
        ]
    }
    
    with open('anime_training_summary.json', 'w', encoding='utf-8') as f:
        json.dump(training_summary, f, ensure_ascii=False, indent=2)
    print(f"✅ 已保存训练数据摘要到 anime_training_summary.json")

def display_top_recommendations(anime_by_tier):
    """显示各等级的顶级推荐"""
    print("\n" + "="*70)
    print("各等级顶级推荐")
    print("="*70)
    
    for tier, anime_list in anime_by_tier.items():
        if not anime_list:
            continue
            
        tier_names = {
            'top_tier': '🥇 顶级动画',
            'high_quality': '🥈 高质量动画',
            'good_quality': '🥉 良好质量动画',
            'decent_quality': '📺 不错质量动画',
            'watchable': '👀 可观看动画'
        }
        
        print(f"\n{tier_names[tier]} (前5部):")
        print("-" * 50)
        
        for i, anime in enumerate(anime_list[:5], 1):
            print(f"{i}. {anime['name_cn'] or anime['name']}")
            print(f"   评分: {anime['score']:.1f} | 年份: {anime['date'][:4] if anime['date'] else '未知'}")
            print(f"   标签: {', '.join(anime['tags'][:4])}")
            if anime['summary']:
                summary = anime['summary'][:80] + "..." if len(anime['summary']) > 80 else anime['summary']
                print(f"   简介: {summary}")
            print()

def main():
    print("🎌 全面动画数据提取器 - Zishu-sensei 项目")
    print("="*70)
    
    # 提取数据
    anime_by_tier, all_anime, total_processed = extract_comprehensive_anime_data()
    
    print(f"\n✅ 数据提取完成!")
    print(f"📈 处理了 {total_processed:,} 个条目")
    print(f"🎬 找到 {len(all_anime):,} 部动画")
    
    # 分析数据
    analyze_anime_data(anime_by_tier, all_anime)
    
    # 显示推荐
    display_top_recommendations(anime_by_tier)
    
    # 保存数据
    print("\n" + "="*70)
    print("保存数据文件")
    print("="*70)
    save_comprehensive_data(anime_by_tier, all_anime)
    
    print(f"\n🎉 全面数据提取完成！")
    print(f"📁 生成了多个质量等级的数据文件")
    print(f"💾 总计 {len(all_anime):,} 部动画数据可用于 AI 训练")

if __name__ == "__main__":
    main() 
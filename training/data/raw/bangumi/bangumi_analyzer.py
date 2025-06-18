#!/usr/bin/env python3
"""
Bangumi Archive 数据分析工具

这个脚本用于分析和处理 Bangumi.tv 的数据转储文件
包含：番剧、角色、人物、剧集等信息的统计和提取
"""

import json
import pandas as pd
from collections import Counter, defaultdict
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import os

class BangumiAnalyzer:
    def __init__(self, data_dir="./"):
        self.data_dir = data_dir
        self.files = {
            'subjects': 'subject.jsonlines',           # 番剧/作品数据 (695MB)
            'characters': 'character.jsonlines',       # 角色数据 (127MB)  
            'persons': 'person.jsonlines',             # 人物数据 (54MB)
            'episodes': 'episode.jsonlines',           # 剧集数据 (279MB)
            'subject_relations': 'subject-relations.jsonlines',    # 作品关系 (59MB)
            'subject_persons': 'subject-persons.jsonlines',        # 作品-人物关系 (82MB)
            'subject_characters': 'subject-characters.jsonlines',  # 作品-角色关系 (21MB)
            'person_characters': 'person-characters.jsonlines'     # 人物-角色关系 (15MB)
        }
    
    def load_jsonlines(self, filename, limit=None):
        """加载 JSONLINES 文件"""
        filepath = os.path.join(self.data_dir, filename)
        data = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    if limit and i >= limit:
                        break
                    try:
                        data.append(json.loads(line.strip()))
                    except json.JSONDecodeError as e:
                        print(f"JSON 解析错误在行 {i+1}: {e}")
                        continue
        except FileNotFoundError:
            print(f"文件未找到: {filepath}")
            return []
        
        return data
    
    def get_file_stats(self):
        """获取所有文件的基本统计信息"""
        stats = {}
        
        for name, filename in self.files.items():
            filepath = os.path.join(self.data_dir, filename)
            if os.path.exists(filepath):
                # 计算行数
                line_count = 0
                file_size = os.path.getsize(filepath)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    for line in f:
                        line_count += 1
                
                stats[name] = {
                    'filename': filename,
                    'lines': line_count,
                    'size_mb': file_size / 1024 / 1024
                }
            else:
                stats[name] = {'filename': filename, 'lines': 0, 'size_mb': 0, 'status': 'missing'}
        
        return stats
    
    def analyze_subjects(self, limit=10000):
        """分析番剧/作品数据"""
        print("分析作品数据...")
        subjects = self.load_jsonlines(self.files['subjects'], limit)
        
        if not subjects:
            return None
        
        # 基本统计
        total_subjects = len(subjects)
        types = Counter([s.get('type') for s in subjects])
        
        # 类型映射
        type_mapping = {
            1: '书籍', 2: '动画', 3: '音乐', 4: '游戏', 6: '真人'
        }
        
        # 评分分析
        scores = [s.get('score', 0) for s in subjects if s.get('score', 0) > 0]
        
        # 年份分析
        years = []
        for s in subjects:
            date = s.get('date', '')
            if date and len(date) >= 4:
                try:
                    year = int(date[:4])
                    if 1950 <= year <= 2025:  # 合理年份范围
                        years.append(year)
                except ValueError:
                    continue
        
        # 标签分析
        all_tags = []
        for s in subjects:
            tags = s.get('tags', [])
            for tag in tags:
                all_tags.append(tag.get('name', ''))
        
        tag_counter = Counter(all_tags)
        
        analysis = {
            'total_subjects': total_subjects,
            'types': {type_mapping.get(k, f'类型{k}'): v for k, v in types.items()},
            'score_stats': {
                'count': len(scores),
                'mean': sum(scores) / len(scores) if scores else 0,
                'min': min(scores) if scores else 0,
                'max': max(scores) if scores else 0
            },
            'year_range': {
                'earliest': min(years) if years else None,
                'latest': max(years) if years else None,
                'count': len(years)
            },
            'top_tags': tag_counter.most_common(20)
        }
        
        return analysis
    
    def analyze_characters(self, limit=10000):
        """分析角色数据"""
        print("分析角色数据...")
        characters = self.load_jsonlines(self.files['characters'], limit)
        
        if not characters:
            return None
        
        # 基本统计
        total_characters = len(characters)
        
        # 角色类型统计 (role字段)
        roles = Counter([c.get('role') for c in characters])
        
        # 角色性别统计（从 infobox 解析）
        genders = []
        for c in characters:
            infobox = c.get('infobox', '')
            if '性别= 男' in infobox:
                genders.append('男')
            elif '性别= 女' in infobox:
                genders.append('女')
            else:
                genders.append('未知')
        
        gender_counter = Counter(genders)
        
        # 受欢迎程度（收藏数）
        collects = [c.get('collects', 0) for c in characters if c.get('collects', 0) > 0]
        
        analysis = {
            'total_characters': total_characters,
            'roles': dict(roles),
            'genders': dict(gender_counter),
            'popularity_stats': {
                'count': len(collects),
                'mean': sum(collects) / len(collects) if collects else 0,
                'max': max(collects) if collects else 0
            }
        }
        
        return analysis
    
    def get_anime_for_training(self, min_score=7.0, min_episodes=5, limit=1000):
        """获取适合训练的动画数据"""
        print(f"筛选适合训练的动画数据（最低评分: {min_score}, 最少集数: {min_episodes}）...")
        
        subjects = self.load_jsonlines(self.files['subjects'])
        episodes = self.load_jsonlines(self.files['episodes'])
        
        # 按作品ID分组剧集
        episode_count = defaultdict(int)
        for ep in episodes:
            episode_count[ep.get('subject_id', 0)] += 1
        
        # 筛选动画
        anime_data = []
        for subject in subjects:
            if (subject.get('type') == 2 and  # 动画类型
                subject.get('score', 0) >= min_score and
                episode_count[subject.get('id', 0)] >= min_episodes):
                
                anime_info = {
                    'id': subject.get('id'),
                    'name': subject.get('name', ''),
                    'name_cn': subject.get('name_cn', ''),
                    'score': subject.get('score', 0),
                    'date': subject.get('date', ''),
                    'summary': subject.get('summary', ''),
                    'tags': [tag.get('name', '') for tag in subject.get('tags', [])],
                    'episode_count': episode_count[subject.get('id', 0)]
                }
                anime_data.append(anime_info)
                
                if len(anime_data) >= limit:
                    break
        
        return anime_data
    
    def print_summary(self):
        """打印数据总览"""
        print("=" * 60)
        print("Bangumi Archive 数据总览")
        print("=" * 60)
        
        # 文件统计
        stats = self.get_file_stats()
        print("\n📁 文件统计:")
        for name, info in stats.items():
            if 'status' not in info:
                print(f"  {name:20s} | {info['lines']:>8,} 条记录 | {info['size_mb']:>6.1f} MB")
            else:
                print(f"  {name:20s} | 文件缺失")
        
        # 作品分析
        subject_analysis = self.analyze_subjects(limit=50000)
        if subject_analysis:
            print(f"\n📺 作品统计 (样本: {subject_analysis['total_subjects']:,} 条):")
            for type_name, count in subject_analysis['types'].items():
                print(f"  {type_name:10s}: {count:>6,} 个")
            
            print(f"\n⭐ 评分统计:")
            score_stats = subject_analysis['score_stats']
            print(f"  有评分作品: {score_stats['count']:,} 个")
            print(f"  平均分: {score_stats['mean']:.2f}")
            print(f"  分数范围: {score_stats['min']:.1f} - {score_stats['max']:.1f}")
            
            print(f"\n🗓️  年份范围:")
            if subject_analysis['year_range']['earliest']:
                print(f"  {subject_analysis['year_range']['earliest']} - {subject_analysis['year_range']['latest']}")
                print(f"  有日期信息: {subject_analysis['year_range']['count']:,} 个")
            
            print(f"\n🏷️  热门标签 (Top 10):")
            for tag, count in subject_analysis['top_tags'][:10]:
                print(f"  {tag:15s}: {count:>5,} 次")
        
        # 角色分析
        character_analysis = self.analyze_characters(limit=30000)
        if character_analysis:
            print(f"\n👤 角色统计 (样本: {character_analysis['total_characters']:,} 条):")
            print(f"  性别分布:")
            for gender, count in character_analysis['genders'].items():
                print(f"    {gender:6s}: {count:>6,} 个")
            
            pop_stats = character_analysis['popularity_stats']
            if pop_stats['count'] > 0:
                print(f"  收藏统计:")
                print(f"    平均收藏: {pop_stats['mean']:.0f}")
                print(f"    最高收藏: {pop_stats['max']:,}")

def main():
    # 创建分析器实例
    analyzer = BangumiAnalyzer()
    
    # 打印数据总览
    analyzer.print_summary()
    
    # 获取适合训练的动画数据示例
    print("\n" + "=" * 60)
    print("获取高质量动画数据示例")
    print("=" * 60)
    
    anime_sample = analyzer.get_anime_for_training(min_score=8.0, min_episodes=10, limit=10)
    
    print(f"\n找到 {len(anime_sample)} 部高质量动画:")
    for anime in anime_sample:
        print(f"\n📺 {anime['name_cn'] or anime['name']}")
        print(f"   评分: {anime['score']:.1f} | 集数: {anime['episode_count']} | 年份: {anime['date'][:4] if anime['date'] else '未知'}")
        print(f"   标签: {', '.join(anime['tags'][:5])}")
        if anime['summary']:
            summary = anime['summary'][:100] + "..." if len(anime['summary']) > 100 else anime['summary']
            print(f"   简介: {summary}")

if __name__ == "__main__":
    main() 
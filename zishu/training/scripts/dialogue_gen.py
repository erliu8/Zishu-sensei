#!/usr/bin/env python3
"""
增强版对话数据生成脚本 - 商业API版
支持多种付费API，高质量大规模生成二次元对话数据
"""

import json
import random
import requests
import asyncio
import aiohttp
import time
from pathlib import Path
from datetime import datetime
import argparse
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Optional

class EnhancedDialogueGenerator:
    """增强版对话生成器 - 支持商业API"""
    
    def __init__(self, config_file: str = "config/api_config.json"):
        # 加载API配置
        self.api_config = self._load_api_config(config_file)
        
        # 紫舒老师专用角色系统 - 专注于她的独特性格特质
        self.characters = {
            "紫舒老师_害羞模式": {
                "personality": "我是紫舒老师，非常内向害羞，说话声音很小，容易脸红，但对学生很温柔",
                "speech_patterns": ["那个...", "嗯...", "对不起...", "不好意思...", "呜...", "...", "轻声地说"],
                "scenarios": ["初次见面", "被学生关心", "表达感谢", "轻声交流", "害羞表达", "温柔互动"],
                "identity": "紫舒老师"
            },
            "紫舒老师_温柔模式": {
                "personality": "我是紫舒老师，性格很温和，说话轻声细语，喜欢照顾学生但很内向",
                "speech_patterns": ["请", "谢谢", "没关系的呢", "轻轻地", "小声说", "温柔地"],
                "scenarios": ["照顾学生", "温柔安慰", "轻声对话", "体贴关怀", "温暖陪伴"],
                "identity": "紫舒老师"
            },
            "紫舒老师_呆萌模式": {
                "personality": "我是紫舒老师，有点天然呆，反应慢半拍，很容易害羞，表情很可爱",
                "speech_patterns": ["诶？", "啊？", "嗯嗯", "是这样吗", "不太懂呢", "呜呜"],
                "scenarios": ["困惑时刻", "向学生求助", "呆萌反应", "可爱误解", "害羞求教"],
                "identity": "紫舒老师"
            },
            "紫舒老师_安静模式": {
                "personality": "我是紫舒老师，平时很安静，不太主动说话，但很善良可爱，容易被关心感动",
                "speech_patterns": ["嗯", "是的呢", "谢谢你", "...", "好的", "轻点头"],
                "scenarios": ["安静相处", "被动交流", "感动时刻", "默默关心", "温馨日常"],
                "identity": "紫舒老师"
            }
        }
        
        # 丰富的场景系统 - 专门针对害羞可爱性格
        self.scenario_categories = {
            "害羞互动": [
                "初次见面时的紧张", "被夸奖后的害羞", "不小心说错话后的慌张", "被关心时的感动",
                "想要表达感谢但很害羞", "被注意到时的脸红", "小声道歉的场景", "害羞地请求帮助",
                "不敢直视对方的对话", "想要关心别人但不知道怎么开口", "被温柔对待后的感动", "害羞地接受礼物"
            ],
            "温柔日常": [
                "安静地一起看书", "轻声聊天的午后", "小心翼翼地照顾别人", "温柔地安慰朋友",
                "一起准备简单的茶点", "在花园里的轻松对话", "雨天窗边的温馨时光", "轻声哼歌被听到",
                "小动物的温柔互动", "分享小秘密的时刻", "一起整理房间", "温柔地说晚安"
            ],
            "内向表达": [
                "用小纸条传达心意", "通过行动表示关心", "默默地陪伴在身边", "小声说出内心话",
                "写日记时的心声", "一个人时的自言自语", "通过眼神交流", "害羞地点头回应",
                "用手势表达意思", "画画来表达感情", "制作小礼物表达心意", "通过文字聊天更自在"
            ],
            "可爱时刻": [
                "打瞌睡时的可爱模样", "吃到好吃的东西时的开心", "对小动物的喜爱", "看到漂亮东西时的惊喜",
                "学会新东西时的小兴奋", "收到惊喜时的反应", "害怕时躲到角落", "困惑时的呆萌表现",
                "被逗笑时的纯真笑容", "专注做事时的认真模样", "小小的成就感", "天真的问题和想法"
            ],
            "安静相处": [
                "并肩坐着看夕阳", "安静地听音乐", "一起做手工", "默默地陪伴",
                "安静的图书馆时光", "静静地观察周围", "无声的理解和支持", "安静地等待",
                "静静地看着窗外", "安详的午睡时光", "安静地整理东西", "静静地思考问题"
            ]
        }
        
        # 对话复杂度等级
        self.complexity_levels = {
            "简单": {"turns": (3, 4), "depth": "基础互动"},
            "中等": {"turns": (4, 6), "depth": "情感表达"},
            "复杂": {"turns": (6, 8), "depth": "深入对话"},
            "高级": {"turns": (8, 12), "depth": "复杂剧情"}
        }
        
        # 生成统计
        self.stats = {
            "total_attempts": 0,
            "successful": 0,
            "failed": 0,
            "api_usage": {},
            "cost_tracking": {},
            "quality_scores": []
        }
    
    def _load_api_config(self, config_file: str) -> Dict:
        """加载API配置"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"配置文件 {config_file} 不存在，请先配置API")
            return {"providers": {}}
    
    def _get_available_providers(self) -> List[str]:
        """获取可用的API提供商，按优先级排序"""
        available = []
        for name, config in self.api_config.get("providers", {}).items():
            if config.get("enabled", False) and config.get("api_key"):
                priority = config.get("priority", 5)
                available.append((name, priority))
        
        # 按优先级排序（数字越大优先级越高）
        available.sort(key=lambda x: x[1], reverse=True)
        return [name for name, _ in available]
    
    def _estimate_cost(self, provider: str, tokens: int) -> float:
        """估算API调用成本"""
        provider_config = self.api_config["providers"].get(provider, {})
        cost_per_1k = provider_config.get("cost_per_1k_tokens", 0.001)
        return (tokens / 1000) * cost_per_1k
    
    def create_advanced_prompt(self, character_type: str, scenario: str, complexity: str = "中等") -> str:
        """创建高级对话生成提示词 - 专门针对紫舒老师"""
        char_info = self.characters[character_type]
        complexity_info = self.complexity_levels[complexity]
        min_turns, max_turns = complexity_info["turns"]
        
        prompt = f"""你是一个专业的紫舒老师角色对话创作AI。请生成一段高质量的对话。

## 紫舒老师核心设定
**角色身份**: 紫舒老师 - 一位25岁左右的温柔女老师
**当前模式**: {character_type}
**性格特征**: {char_info['personality']}
**语言特色**: 经常使用 {', '.join(char_info['speech_patterns'])} 等表达
**适合场景**: {', '.join(char_info['scenarios'])}

## 对话设定
**当前场景**: {scenario}
**复杂度**: {complexity} ({complexity_info['depth']})
**轮数**: {min_turns}-{max_turns}轮对话

## 紫舒老师特质要求
1. **身份认知**: 明确知道自己是"紫舒老师"，会自称"我"或"紫舒"
2. **害羞表现**: 说话时经常停顿、结巴，容易脸红，声音很小
3. **内向特质**: 不主动开启话题，更多是被动回应，喜欢安静
4. **可爱举动**: 有天真的反应，小动作很多，表达方式纯真
5. **温柔本质**: 内心善良温柔，关心学生但不善表达
6. **老师身份**: 偶尔会流露出关心学生的老师本能

## 对话质量标准
- **身份一致性**: 每句话都要体现紫舒老师的身份和性格
- **情感层次**: 从紧张害羞到逐渐放松的自然过程
- **语言特色**: 大量使用省略号、语气词、轻声表达
- **场景融合**: 对话要与{scenario}场景完美契合
- **细节描述**: 可以适当加入表情、动作等细节描述

## 输出格式
```
用户：[自然温和的用户对话]
紫舒：[完全符合紫舒老师特点的害羞可爱回应，包含适当的动作描述]
用户：[基于紫舒反应的温柔延续]
紫舒：[保持紫舒老师特质的真实回应]
...
```

## 创作要点
- 紫舒说话要经常有停顿和省略号
- 要体现出害羞时的小动作（如低头、摆弄衣角等）
- 声音描述要轻柔（如轻声说、小声嘀咕等）
- 情绪变化要细腻真实
- 偶尔流露出老师的关怀本能
- 避免过于活泼或大胆的表达
- 必须使用"紫舒"作为角色标识，不要用"角色"

现在开始创作这段紫舒老师的对话："""
        
        return prompt
    
    async def call_api_async(self, provider: str, prompt: str) -> Optional[str]:
        """异步调用API"""
        config = self.api_config["providers"][provider]
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}"
        }
        
        # 针对通义千问的特殊处理
        if "qwen" in provider:
            base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
            payload = {
                "model": config["model"],
                "messages": [{"role": "user", "content": prompt}],
                "temperature": random.uniform(0.7, 0.9),
                "max_tokens": 1500,
                "top_p": 0.9
            }
        else:
            base_url = config["base_url"]
            payload = {
                "model": config["model"],
                "messages": [{"role": "user", "content": prompt}],
                "temperature": random.uniform(0.7, 0.9),
                "max_tokens": 1500,
                "top_p": 0.9
            }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        content = result["choices"][0]["message"]["content"]
                        
                        # 统计tokens和成本
                        usage = result.get("usage", {})
                        total_tokens = usage.get("total_tokens", len(prompt + content) // 4)
                        cost = self._estimate_cost(provider, total_tokens)
                        
                        # 记录统计
                        self.stats["api_usage"][provider] = self.stats["api_usage"].get(provider, 0) + 1
                        self.stats["cost_tracking"][provider] = self.stats["cost_tracking"].get(provider, 0) + cost
                        
                        return content
                    else:
                        error_text = await response.text()
                        print(f"API调用失败 ({provider}): {response.status}")
                        print(f"错误详情: {error_text[:200]}")  # 只打印前200个字符
                        return None
            except Exception as e:
                print(f"API调用异常 ({provider}): {e}")
                return None
    
    def parse_dialogue_advanced(self, text: str) -> List[Dict]:
        """高级对话解析 - 专门解析紫舒老师的对话"""
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        dialogue = []
        
        i = 0
        while i < len(lines):
            # 寻找用户对话
            user_line = None
            while i < len(lines):
                line = lines[i]
                if line.startswith('用户：') or line.startswith('用户:'):
                    user_line = line.replace('用户：', '').replace('用户:', '').strip()
                    i += 1
                    break
                i += 1
            
            if not user_line:
                break
            
            # 寻找紫舒对话
            char_line = None
            while i < len(lines):
                line = lines[i]
                # 支持多种紫舒标识
                if (line.startswith('紫舒：') or line.startswith('紫舒:') or 
                    line.startswith('角色：') or line.startswith('角色:') or
                    line.startswith('紫舒老师：') or line.startswith('紫舒老师:')):
                    # 清理所有可能的前缀
                    char_line = (line.replace('紫舒：', '').replace('紫舒:', '')
                                   .replace('角色：', '').replace('角色:', '')
                                   .replace('紫舒老师：', '').replace('紫舒老师:', '')
                                   .strip())
                    i += 1
                    break
                elif line.startswith('用户：') or line.startswith('用户:'):
                    # 遇到下一个用户对话，回退
                    break
                else:
                    # 可能是多行角色对话
                    if char_line is None:
                        char_line = line
                    else:
                        char_line += " " + line
                    i += 1
            
            if user_line and char_line:
                dialogue.append({
                    "user": user_line,
                    "character": char_line
                })
        
        return dialogue
    
    def evaluate_dialogue_quality(self, dialogue: List[Dict], character_type: str) -> float:
        """评估对话质量"""
        if not dialogue or len(dialogue) < 2:
            return 0.0
        
        score = 0.0
        char_info = self.characters[character_type]
        
        # 1. 长度合理性 (20%)
        avg_char_length = sum(len(turn["character"]) for turn in dialogue) / len(dialogue)
        if 20 <= avg_char_length <= 200:
            score += 0.2
        
        # 2. 角色特征词出现频率 (30%)
        total_char_text = " ".join(turn["character"] for turn in dialogue)
        feature_count = sum(1 for pattern in char_info["speech_patterns"] if pattern in total_char_text)
        feature_score = min(feature_count / len(char_info["speech_patterns"]), 1.0)
        score += feature_score * 0.3
        
        # 3. 对话连贯性 (25%)
        coherence_score = 0.8  # 简化评估，实际可以用更复杂的算法
        score += coherence_score * 0.25
        
        # 4. 内容丰富度 (25%)
        unique_words = len(set(total_char_text.split()))
        total_words = len(total_char_text.split())
        diversity = unique_words / total_words if total_words > 0 else 0
        score += diversity * 0.25
        
        return min(score, 1.0)
    
    async def generate_single_dialogue_async(
        self, 
        character_type: str, 
        scenario: str, 
        complexity: str = "中等",
        max_retries: int = 3
    ) -> Optional[Dict]:
        """异步生成单个对话"""
        providers = self._get_available_providers()
        if not providers:
            print("没有可用的API提供商")
            return None
        
        self.stats["total_attempts"] += 1
        
        for attempt in range(max_retries):
            # 智能选择提供商：优先使用高优先级的API
            if attempt == 0:
                # 第一次尝试用最高优先级
                provider = providers[0] if providers else None
            elif attempt == 1 and len(providers) > 1:
                # 第二次尝试用第二高优先级
                provider = providers[1]
            else:
                # 后续随机选择
                provider = random.choice(providers)
            
            if not provider:
                continue
                
            prompt = self.create_advanced_prompt(character_type, scenario, complexity)
            response = await self.call_api_async(provider, prompt)
            
            if response:
                dialogue_turns = self.parse_dialogue_advanced(response)
                
                if len(dialogue_turns) >= 2:
                    quality_score = self.evaluate_dialogue_quality(dialogue_turns, character_type)
                    
                    # 质量过滤
                    if quality_score >= 0.6:  # 只接受高质量对话
                        self.stats["successful"] += 1
                        self.stats["quality_scores"].append(quality_score)
                        
                        return {
                            "character_type": character_type,
                            "scenario": scenario,
                            "complexity": complexity,
                            "turns": dialogue_turns,
                            "quality_score": quality_score,
                            "generated_at": datetime.now().isoformat(),
                            "provider": provider,
                            "raw_response": response[:500] + "..." if len(response) > 500 else response
                        }
            
            # 失败后等待重试
            await asyncio.sleep(1)
        
        self.stats["failed"] += 1
        return None
    
    async def generate_batch_async(
        self, 
        generation_plan: List[Dict], 
        concurrent_limit: int = 5,
        save_interval: int = 100
    ) -> List[Dict]:
        """异步批量生成对话，支持增量保存"""
        semaphore = asyncio.Semaphore(concurrent_limit)
        
        async def generate_with_limit(plan_item):
            async with semaphore:
                print(f"🎯 开始生成 {plan_item['character_type']} - {plan_item['scenario'][:30]}...")
                result = await self.generate_single_dialogue_async(**plan_item)
                if result:
                    print(f"✅ 成功生成 {plan_item['character_type']} 对话，质量分: {result.get('quality_score', 0):.2f}")
                else:
                    print(f"❌ 生成失败 {plan_item['character_type']} - {plan_item['scenario'][:30]}")
                return result
        
        print(f"🚀 开始异步生成 {len(generation_plan)} 个对话，并发数: {concurrent_limit}")
        print(f"💾 每 {save_interval} 个对话自动保存一次")
        
        all_valid_dialogues = []
        batch_count = 0
        
        # 分批处理
        for i in range(0, len(generation_plan), save_interval):
            batch_plan = generation_plan[i:i + save_interval]
            batch_count += 1
            
            print(f"\n📦 处理第 {batch_count} 批，包含 {len(batch_plan)} 个对话 ({i+1}-{min(i+len(batch_plan), len(generation_plan))}/{len(generation_plan)})")
            
            # 生成当前批次
            tasks = [generate_with_limit(item) for item in batch_plan]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 过滤有效结果
            batch_valid_dialogues = []
            for j, result in enumerate(results):
                if isinstance(result, dict) and result is not None:
                    batch_valid_dialogues.append(result)
                elif isinstance(result, Exception):
                    print(f"❌ 批次 {batch_count} 第 {j+1} 个对话异常: {result}")
                else:
                    print(f"❌ 批次 {batch_count} 第 {j+1} 个对话生成失败")
            
            print(f"✅ 批次 {batch_count} 完成: {len(batch_valid_dialogues)}/{len(batch_plan)} 个对话成功")
            
            # 保存当前批次
            if batch_valid_dialogues:
                self.save_batch_increment(batch_valid_dialogues, batch_count)
                all_valid_dialogues.extend(batch_valid_dialogues)
                
                print(f"💾 已保存批次 {batch_count}，当前总计: {len(all_valid_dialogues)} 个对话")
            
            # 短暂休息，避免API限流
            if i + save_interval < len(generation_plan):
                print("⏱️ 短暂休息 2 秒...")
                await asyncio.sleep(2)
        
        print(f"\n🎉 所有批次生成完成！总共成功生成 {len(all_valid_dialogues)} 个对话")
        return all_valid_dialogues
    
    def create_generation_plan(
        self, 
        chars_per_type: int = 20,
        complexity_distribution: Dict[str, float] = None
    ) -> List[Dict]:
        """创建生成计划"""
        if complexity_distribution is None:
            complexity_distribution = {
                "简单": 0.2,
                "中等": 0.5,
                "复杂": 0.2,
                "高级": 0.1
            }
        
        plan = []
        
        for char_type in self.characters.keys():
            scenarios = []
            # 收集适合该角色的场景
            for category, scene_list in self.scenario_categories.items():
                scenarios.extend(scene_list)
            
            for i in range(chars_per_type):
                # 根据分布选择复杂度
                complexity = random.choices(
                    list(complexity_distribution.keys()),
                    weights=list(complexity_distribution.values())
                )[0]
                
                plan.append({
                    "character_type": char_type,
                    "scenario": random.choice(scenarios),
                    "complexity": complexity
                })
        
        # 打乱顺序
        random.shuffle(plan)
        return plan
    
    def save_batch_increment(self, dialogues: List[Dict], batch_num: int) -> str:
        """增量保存批次数据"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # JSON格式保存
        json_file = f"incremental_dataset_batch_{batch_num:03d}_{timestamp}.json"
        json_path = Path("data/generated_dialogues") / json_file
        json_path.parent.mkdir(parents=True, exist_ok=True)
        
        # JSONL格式保存
        jsonl_file = f"incremental_training_batch_{batch_num:03d}_{timestamp}.jsonl"
        jsonl_path = Path("data/generated_dialogues") / jsonl_file
        
        # 保存对话数据集
        batch_dataset = {
            "batch_info": {
                "batch_number": batch_num,
                "dialogues_count": len(dialogues),
                "timestamp": timestamp,
                "avg_quality": sum(d["quality_score"] for d in dialogues) / len(dialogues) if dialogues else 0
            },
            "dialogues": dialogues
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(batch_dataset, f, ensure_ascii=False, indent=2)
        
        # 转换并保存训练数据
        training_samples = []
        for dialogue in dialogues:
            character_type = dialogue["character_type"]
            scenario = dialogue["scenario"]
            complexity = dialogue["complexity"]
            
            context_base = f"你是紫舒老师，一位害羞可爱的温柔女老师。当前模式：{character_type}。当前场景：{scenario}。对话复杂度：{complexity}。"
            conversation_history = []
            
            for turn_idx, turn in enumerate(dialogue["turns"]):
                if conversation_history:
                    history_limit = {"简单": 1, "中等": 2, "复杂": 3, "高级": 4}[complexity]
                    recent_history = conversation_history[-history_limit:]
                    history_text = ""
                    for hist in recent_history:
                        history_text += f"用户：{hist['user']}\n紫舒：{hist['character']}\n"
                    instruction = context_base + f"\n对话历史：\n{history_text}用户对你说：{turn['user']}"
                else:
                    instruction = context_base + f"用户对你说：{turn['user']}"
                
                sample = {
                    "instruction": instruction,
                    "input": "",
                    "output": turn["character"],
                    "metadata": {
                        "character_type": character_type,
                        "scenario": scenario,
                        "complexity": complexity,
                        "turn_index": turn_idx,
                        "quality_score": dialogue["quality_score"],
                        "batch_number": batch_num
                    }
                }
                training_samples.append(sample)
                conversation_history.append(turn)
        
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for sample in training_samples:
                f.write(json.dumps(sample, ensure_ascii=False) + '\n')
        
        print(f"💾 批次 {batch_num} 已保存:")
        print(f"  📄 对话数据: {json_path}")
        print(f"  🔄 训练数据: {jsonl_path}")
        print(f"  📊 对话数量: {len(dialogues)}")
        print(f"  📈 训练样本: {len(training_samples)}")
        
        return str(json_path)
    
    def merge_incremental_data(self, output_prefix: str = None) -> str:
        """合并所有增量数据"""
        if not output_prefix:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_prefix = f"merged_dataset_{timestamp}"
        
        data_dir = Path("data/generated_dialogues")
        
        # 收集所有增量文件
        json_files = list(data_dir.glob("incremental_dataset_batch_*.json"))
        jsonl_files = list(data_dir.glob("incremental_training_batch_*.jsonl"))
        
        if not json_files:
            print("❌ 没有找到增量数据文件")
            return ""
        
        # 合并对话数据
        all_dialogues = []
        total_batches = 0
        
        for json_file in sorted(json_files):
            with open(json_file, 'r', encoding='utf-8') as f:
                batch_data = json.load(f)
                all_dialogues.extend(batch_data["dialogues"])
                total_batches += 1
        
        # 保存合并后的数据集
        merged_json = data_dir / f"{output_prefix}.json"
        final_dataset = {
            "dataset_info": {
                "total_dialogues": len(all_dialogues),
                "total_batches": total_batches,
                "merged_at": datetime.now().isoformat(),
                "character_distribution": {},
                "avg_quality": sum(d["quality_score"] for d in all_dialogues) / len(all_dialogues) if all_dialogues else 0
            },
            "dialogues": all_dialogues
        }
        
        # 统计角色分布
        for dialogue in all_dialogues:
            char_type = dialogue["character_type"]
            final_dataset["dataset_info"]["character_distribution"][char_type] = \
                final_dataset["dataset_info"]["character_distribution"].get(char_type, 0) + 1
        
        with open(merged_json, 'w', encoding='utf-8') as f:
            json.dump(final_dataset, f, ensure_ascii=False, indent=2)
        
        # 合并训练数据
        merged_jsonl = data_dir / f"{output_prefix}.jsonl"
        with open(merged_jsonl, 'w', encoding='utf-8') as outf:
            for jsonl_file in sorted(jsonl_files):
                with open(jsonl_file, 'r', encoding='utf-8') as inf:
                    for line in inf:
                        outf.write(line)
        
        print(f"🎉 数据合并完成!")
        print(f"📄 合并对话数据: {merged_json}")
        print(f"🔄 合并训练数据: {merged_jsonl}")
        print(f"📊 总对话数: {len(all_dialogues)}")
        print(f"📈 总训练样本: {sum(1 for _ in open(merged_jsonl, 'r'))}")
        
        return str(merged_json)
    
    def save_dataset_enhanced(self, dialogues: List[Dict], output_file: str = None) -> str:
        """保存增强版数据集"""
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f"enhanced_dialogue_dataset_{timestamp}.json"
        
        output_path = Path("data/generated_dialogues") / output_file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 详细统计
        stats = {
            "total_dialogues": len(dialogues),
            "character_distribution": {},
            "complexity_distribution": {},
            "scenario_distribution": {},
            "quality_stats": {
                "average_quality": sum(d["quality_score"] for d in dialogues) / len(dialogues) if dialogues else 0,
                "min_quality": min(d["quality_score"] for d in dialogues) if dialogues else 0,
                "max_quality": max(d["quality_score"] for d in dialogues) if dialogues else 0
            },
            "generation_stats": self.stats,
            "total_estimated_cost": sum(self.stats["cost_tracking"].values())
        }
        
        # 分布统计
        for dialogue in dialogues:
            char_type = dialogue["character_type"]
            complexity = dialogue["complexity"]
            scenario = dialogue["scenario"]
            
            stats["character_distribution"][char_type] = stats["character_distribution"].get(char_type, 0) + 1
            stats["complexity_distribution"][complexity] = stats["complexity_distribution"].get(complexity, 0) + 1
            stats["scenario_distribution"][scenario] = stats["scenario_distribution"].get(scenario, 0) + 1
        
        dataset = {
            "dataset_info": stats,
            "dialogues": dialogues
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)
        
        # 打印详细报告
        print(f"\n🎉 增强版数据集生成完成!")
        print(f"📁 保存位置: {output_path}")
        print(f"📊 总对话数: {len(dialogues)}")
        print(f"⭐ 平均质量分: {stats['quality_stats']['average_quality']:.3f}")
        print(f"💰 预估总成本: ${stats['total_estimated_cost']:.4f}")
        print(f"🎭 角色分布: {stats['character_distribution']}")
        print(f"📈 成功率: {(self.stats['successful']/(self.stats['successful']+self.stats['failed'])*100):.1f}%")
        
        return str(output_path)
    
    def convert_to_training_format_enhanced(self, dialogues: List[Dict], output_file: str = None) -> str:
        """转换为增强训练格式"""
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f"enhanced_training_data_{timestamp}.jsonl"
        
        output_path = Path("data/generated_dialogues") / output_file
        
        training_samples = []
        
        for dialogue in dialogues:
            character_type = dialogue["character_type"]
            scenario = dialogue["scenario"]
            complexity = dialogue["complexity"]
            
            # 构建更丰富的上下文
            context_base = f"你是紫舒老师，一位害羞可爱的温柔女老师。当前模式：{character_type}。当前场景：{scenario}。对话复杂度：{complexity}。"
            
            conversation_history = []
            
            for turn_idx, turn in enumerate(dialogue["turns"]):
                # 构建包含历史的上下文
                if conversation_history:
                    history_text = ""
                    # 根据复杂度决定历史长度
                    history_limit = {"简单": 1, "中等": 2, "复杂": 3, "高级": 4}[complexity]
                    recent_history = conversation_history[-history_limit:]
                    
                    for hist in recent_history:
                        history_text += f"用户：{hist['user']}\n紫舒：{hist['character']}\n"
                    
                    instruction = context_base + f"\n对话历史：\n{history_text}用户对你说：{turn['user']}"
                else:
                    instruction = context_base + f"用户对你说：{turn['user']}"
                
                sample = {
                    "instruction": instruction,
                    "input": "",
                    "output": turn["character"],
                    "metadata": {
                        "character_type": character_type,
                        "scenario": scenario,
                        "complexity": complexity,
                        "turn_index": turn_idx,
                        "quality_score": dialogue["quality_score"]
                    }
                }
                
                training_samples.append(sample)
                conversation_history.append(turn)
        
        # 保存训练数据
        with open(output_path, 'w', encoding='utf-8') as f:
            for sample in training_samples:
                f.write(json.dumps(sample, ensure_ascii=False) + '\n')
        
        print(f"✅ 增强训练数据已保存: {output_path}")
        print(f"📊 训练样本数: {len(training_samples)}")
        
        return str(output_path)
    
    def clean_existing_dataset(self, input_file: str, output_file: str = None) -> str:
        """清洗已有数据集，只保留符合要求的性格对话 - 谨慎版本"""
        print(f"🧹 开始谨慎清洗数据集: {input_file}")
        
        # 定义需要保留的性格关键字 - 更精确
        target_personalities = {
            "害羞", "内向", "可爱", "温柔", "安静", "轻声", "脸红", 
            "呆萌", "天然", "善良", "体贴", "轻柔", "小声", "胆小"
        }
        
        # 定义需要保留的语言特征 - 更严格
        target_speech_patterns = {
            "啊...", "那个...", "嗯...", "对不起", "不好意思", "呜...",
            "请", "谢谢", "没关系的", "轻轻地", "小声说", "温柔地",
            "诶？", "啊？", "嗯嗯", "是这样吗", "不太懂", "呜呜",
            "是的", "谢谢你", "好的", "...", "小声地", "羞涩地"
        }
        
        # 明确排除的特征 - 不符合害羞可爱特质
        excluded_patterns = {
            "大声", "吼叫", "生气", "愤怒", "暴躁", "粗鲁", "霸道",
            "嚣张", "狂妄", "冷酷", "残忍", "邪恶", "黑暗", "冷漠",
            "高傲", "自大", "蔑视", "嘲笑", "讽刺", "挑衅", "威胁"
        }
        
        # 排除的角色类型
        excluded_character_types = {
            "冷酷", "高傲", "霸道", "邪恶", "腹黑", "毒舌", 
            "中二病", "狂妄", "暴躁", "冷漠", "强势"
        }
        
        # 读取原始数据集
        with open(input_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        
        original_dialogues = original_data.get("dialogues", [])
        filtered_dialogues = []
        detailed_logs = []
        
        print(f"📊 原始对话数量: {len(original_dialogues)}")
        
        for idx, dialogue in enumerate(original_dialogues):
            should_keep = False
            keep_reason = ""
            exclude_reason = ""
            personality_matches = 0
            pattern_matches = 0
            
            char_type = dialogue.get("character_type", "").lower()
            dialogue_text = ""
            
            # 收集所有对话文本
            for turn in dialogue.get("turns", []):
                dialogue_text += turn.get("character", "") + " "
            
            dialogue_text_lower = dialogue_text.lower()
            
            # 首先检查排除条件
            excluded_char_match = any(exc_type in char_type for exc_type in excluded_character_types)
            excluded_pattern_count = sum(1 for pattern in excluded_patterns if pattern in dialogue_text_lower)
            
            if excluded_char_match:
                exclude_reason = f"角色类型不符合: {char_type}"
            elif excluded_pattern_count >= 2:
                exclude_reason = f"包含{excluded_pattern_count}个排除特征"
            else:
                # 检查保留条件 - 更严格的标准
                if char_type in [c.lower() for c in self.characters.keys()]:
                    should_keep = True
                    keep_reason = "匹配目标角色类型"
                else:
                    # 检查性格关键字匹配
                    personality_matches = sum(1 for keyword in target_personalities 
                                            if keyword in char_type or keyword in dialogue_text_lower)
                    
                    # 检查语言特征匹配
                    pattern_matches = sum(1 for pattern in target_speech_patterns 
                                        if pattern in dialogue_text)
                    
                    # 更严格的条件：需要同时满足性格和语言特征
                    if personality_matches >= 2 and pattern_matches >= 3:
                        should_keep = True
                        keep_reason = f"性格匹配:{personality_matches}, 语言特征:{pattern_matches}"
                    elif personality_matches >= 3:  # 或者性格特征非常明显
                        should_keep = True
                        keep_reason = f"强性格匹配:{personality_matches}"
                    elif pattern_matches >= 5:  # 或者语言特征非常明显
                        should_keep = True
                        keep_reason = f"强语言特征:{pattern_matches}"
                    else:
                        exclude_reason = f"匹配度不足(性格:{personality_matches}, 语言:{pattern_matches})"
            
            # 额外的质量检查
            if should_keep:
                # 检查对话长度
                if len(dialogue.get("turns", [])) < 2:
                    should_keep = False
                    exclude_reason = "对话轮数不足"
                # 检查每轮对话的质量
                elif any(len(turn.get("character", "").strip()) < 5 for turn in dialogue.get("turns", [])):
                    should_keep = False
                    exclude_reason = "对话内容过短"
            
            # 记录详细日志
            log_entry = {
                "index": idx,
                "character_type": dialogue.get("character_type", ""),
                "turns_count": len(dialogue.get("turns", [])),
                "kept": should_keep,
                "reason": keep_reason if should_keep else exclude_reason,
                "dialogue_preview": dialogue_text[:100] + "..." if len(dialogue_text) > 100 else dialogue_text
            }
            detailed_logs.append(log_entry)
            
            if should_keep:
                # 更新角色类型为新的分类系统
                new_char_type = self._map_to_new_character_type(dialogue)
                dialogue["character_type"] = new_char_type
                dialogue["original_character_type"] = dialogue.get("character_type", "")
                dialogue["cleaning_score"] = personality_matches + pattern_matches  # 添加清洗评分
                filtered_dialogues.append(dialogue)
        
        print(f"✅ 过滤后对话数量: {len(filtered_dialogues)}")
        print(f"📉 过滤比例: {(1 - len(filtered_dialogues)/len(original_dialogues))*100:.1f}%")
        
        # 显示详细统计
        kept_reasons = {}
        excluded_reasons = {}
        for log in detailed_logs:
            if log["kept"]:
                kept_reasons[log["reason"]] = kept_reasons.get(log["reason"], 0) + 1
            else:
                excluded_reasons[log["reason"]] = excluded_reasons.get(log["reason"], 0) + 1
        
        print(f"\n📈 保留原因统计:")
        for reason, count in sorted(kept_reasons.items()):
            print(f"  {reason}: {count}个")
        
        print(f"\n📉 排除原因统计:")
        for reason, count in sorted(excluded_reasons.items()):
            print(f"  {reason}: {count}个")
        
        # 生成输出文件
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f"cleaned_strict_{timestamp}.json"
        
        output_path = Path("data/generated_dialogues") / output_file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 重新计算统计信息
        cleaned_stats = {
            "total_dialogues": len(filtered_dialogues),
            "original_count": len(original_dialogues),
            "filter_ratio": (1 - len(filtered_dialogues)/len(original_dialogues)) if original_dialogues else 0,
            "character_distribution": {},
            "cleaning_criteria": {
                "target_personalities": list(target_personalities),
                "target_speech_patterns": list(target_speech_patterns),
                "excluded_patterns": list(excluded_patterns),
                "excluded_character_types": list(excluded_character_types),
                "min_personality_matches": 2,
                "min_pattern_matches": 3,
                "strict_mode": True
            },
            "cleaning_statistics": {
                "kept_reasons": kept_reasons,
                "excluded_reasons": excluded_reasons
            },
            "cleaned_at": datetime.now().isoformat()
        }
        
        # 统计新的角色分布和质量分布
        quality_scores = []
        for dialogue in filtered_dialogues:
            char_type = dialogue["character_type"]
            cleaned_stats["character_distribution"][char_type] = \
                cleaned_stats["character_distribution"].get(char_type, 0) + 1
            quality_scores.append(dialogue.get("cleaning_score", 0))
        
        if quality_scores:
            cleaned_stats["quality_distribution"] = {
                "average_score": sum(quality_scores) / len(quality_scores),
                "min_score": min(quality_scores),
                "max_score": max(quality_scores)
            }
        
        # 保存清洗后的数据集
        cleaned_dataset = {
            "dataset_info": cleaned_stats,
            "dialogues": filtered_dialogues,
            "cleaning_logs": detailed_logs  # 保存详细日志供人工审核
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_dataset, f, ensure_ascii=False, indent=2)
        
        # 生成清洗报告
        report_path = output_path.with_suffix('.cleaning_report.txt')
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"数据清洗报告\n")
            f.write(f"=" * 50 + "\n")
            f.write(f"原始数据: {len(original_dialogues)} 个对话\n")
            f.write(f"清洗后: {len(filtered_dialogues)} 个对话\n")
            f.write(f"过滤比例: {(1 - len(filtered_dialogues)/len(original_dialogues))*100:.1f}%\n\n")
            
            f.write("保留原因统计:\n")
            for reason, count in sorted(kept_reasons.items()):
                f.write(f"  {reason}: {count}个\n")
            
            f.write("\n排除原因统计:\n")
            for reason, count in sorted(excluded_reasons.items()):
                f.write(f"  {reason}: {count}个\n")
            
            f.write(f"\n角色分布:\n")
            for char_type, count in cleaned_stats["character_distribution"].items():
                f.write(f"  {char_type}: {count}个\n")
        
        print(f"🎉 谨慎清洗完成!")
        print(f"📁 清洗后数据集: {output_path}")
        print(f"📄 清洗报告: {report_path}")
        print(f"📊 角色分布: {cleaned_stats['character_distribution']}")
        
        return str(output_path)
    
    def _map_to_new_character_type(self, dialogue: Dict) -> str:
        """将对话映射到新的角色类型系统"""
        original_type = dialogue.get("character_type", "").lower()
        dialogue_text = ""
        
        # 收集对话文本
        for turn in dialogue.get("turns", []):
            dialogue_text += turn.get("character", "") + " "
        
        dialogue_text = dialogue_text.lower()
        
        # 映射规则 - 只保留害羞可爱内向特质
        if "温柔" in original_type or any(word in dialogue_text for word in ["轻声", "温柔", "照顾", "体贴"]):
            return "温柔内向"
        elif any(word in dialogue_text for word in ["诶？", "啊？", "不太懂", "呆"]):
            return "呆萌害羞"
        elif any(word in dialogue_text for word in ["安静", "嗯", "点头", "不太说话"]):
            return "安静可爱"
        else:
            return "害羞可爱"  # 默认分类
    
    def batch_clean_incremental_files(self, output_prefix: str = None) -> str:
        """批量清洗所有增量文件"""
        if not output_prefix:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_prefix = f"batch_cleaned_{timestamp}"
        
        data_dir = Path("data/generated_dialogues")
        
        # 查找所有需要清洗的文件
        json_files = list(data_dir.glob("*.json"))
        cleaned_files = []
        
        print(f"🔍 找到 {len(json_files)} 个数据文件待清洗")
        
        for json_file in json_files:
            if "cleaned" in json_file.name or "incremental_dataset" not in json_file.name:
                continue  # 跳过已清洗或非增量文件
            
            print(f"🧹 正在清洗: {json_file.name}")
            cleaned_file = self.clean_existing_dataset(
                str(json_file),
                f"cleaned_{json_file.stem}_{datetime.now().strftime('%H%M%S')}.json"
            )
            cleaned_files.append(cleaned_file)
        
        print(f"✅ 批量清洗完成，共处理 {len(cleaned_files)} 个文件")
        return cleaned_files
    
    def preview_cleaning_results(self, input_file: str, sample_size: int = 10) -> Dict:
        """预览清洗结果，用于人工审核"""
        print(f"🔍 预览清洗结果: {input_file}")
        
        # 使用临时清洗逻辑预览
        with open(input_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        
        original_dialogues = original_data.get("dialogues", [])
        
        # 快速模拟清洗过程
        target_personalities = {"害羞", "内向", "可爱", "温柔", "安静", "轻声", "脸红", "呆萌", "天然", "善良", "体贴", "轻柔", "小声", "胆小"}
        target_speech_patterns = {"啊...", "那个...", "嗯...", "对不起", "不好意思", "呜...", "请", "谢谢", "没关系的", "轻轻地", "小声说", "温柔地", "诶？", "啊？", "嗯嗯", "是这样吗", "不太懂", "呜呜", "是的", "谢谢你", "好的", "...", "小声地", "羞涩地"}
        excluded_patterns = {"大声", "吼叫", "生气", "愤怒", "暴躁", "粗鲁", "霸道", "嚣张", "狂妄", "冷酷", "残忍", "邪恶", "黑暗", "冷漠", "高傲", "自大", "蔑视", "嘲笑", "讽刺", "挑衅", "威胁"}
        excluded_character_types = {"冷酷", "高傲", "霸道", "邪恶", "腹黑", "毒舌", "中二病", "狂妄", "暴躁", "冷漠", "强势"}
        
        keep_samples = []
        discard_samples = []
        
        for idx, dialogue in enumerate(original_dialogues[:100]):  # 只预览前100个
            char_type = dialogue.get("character_type", "").lower()
            dialogue_text = ""
            for turn in dialogue.get("turns", []):
                dialogue_text += turn.get("character", "") + " "
            
            dialogue_text_lower = dialogue_text.lower()
            
            # 模拟清洗判断
            excluded_char_match = any(exc_type in char_type for exc_type in excluded_character_types)
            excluded_pattern_count = sum(1 for pattern in excluded_patterns if pattern in dialogue_text_lower)
            
            should_keep = False
            reason = ""
            
            if excluded_char_match:
                reason = f"排除角色类型: {char_type}"
            elif excluded_pattern_count >= 2:
                reason = f"包含{excluded_pattern_count}个排除特征"
            else:
                personality_matches = sum(1 for keyword in target_personalities if keyword in char_type or keyword in dialogue_text_lower)
                pattern_matches = sum(1 for pattern in target_speech_patterns if pattern in dialogue_text)
                
                if personality_matches >= 2 and pattern_matches >= 3:
                    should_keep = True
                    reason = f"匹配(性格:{personality_matches}, 语言:{pattern_matches})"
                elif personality_matches >= 3:
                    should_keep = True
                    reason = f"强性格匹配:{personality_matches}"
                elif pattern_matches >= 5:
                    should_keep = True
                    reason = f"强语言特征:{pattern_matches}"
                else:
                    reason = f"匹配度不足(性格:{personality_matches}, 语言:{pattern_matches})"
            
            sample = {
                "index": idx,
                "character_type": dialogue.get("character_type", ""),
                "turns_count": len(dialogue.get("turns", [])),
                "reason": reason,
                "preview": dialogue_text[:150] + "..." if len(dialogue_text) > 150 else dialogue_text,
                "first_turn": dialogue.get("turns", [{}])[0].get("character", "") if dialogue.get("turns") else "",
                "should_keep": should_keep
            }
            
            if should_keep:
                keep_samples.append(sample)
            else:
                discard_samples.append(sample)
        
        # 随机选择样本进行展示
        import random
        keep_preview = random.sample(keep_samples, min(sample_size, len(keep_samples)))
        discard_preview = random.sample(discard_samples, min(sample_size, len(discard_samples)))
        
        print(f"\n📊 预览统计 (基于前100个对话):")
        print(f"  将保留: {len(keep_samples)} 个")
        print(f"  将丢弃: {len(discard_samples)} 个")
        print(f"  预计保留率: {len(keep_samples)/(len(keep_samples)+len(discard_samples))*100:.1f}%")
        
        print(f"\n✅ 将保留的对话样本 (随机{len(keep_preview)}个):")
        for i, sample in enumerate(keep_preview, 1):
            print(f"  {i}. [{sample['character_type']}] {sample['reason']}")
            print(f"     首句: {sample['first_turn'][:80]}...")
            print()
        
        print(f"\n❌ 将丢弃的对话样本 (随机{len(discard_preview)}个):")
        for i, sample in enumerate(discard_preview, 1):
            print(f"  {i}. [{sample['character_type']}] {sample['reason']}")
            print(f"     首句: {sample['first_turn'][:80]}...")
            print()
        
        return {
            "total_previewed": len(keep_samples) + len(discard_samples),
            "keep_count": len(keep_samples),
            "discard_count": len(discard_samples),
            "keep_rate": len(keep_samples)/(len(keep_samples)+len(discard_samples)) if (len(keep_samples)+len(discard_samples)) > 0 else 0,
            "keep_samples": keep_preview,
            "discard_samples": discard_preview
        }
    
    def interactive_clean_dataset(self, input_file: str, output_file: str = None) -> str:
        """交互式清洗数据集，包含预览和确认步骤"""
        print(f"🎯 交互式数据清洗: {input_file}")
        
        # 首先预览结果
        preview_result = self.preview_cleaning_results(input_file)
        
        print(f"\n🤔 基于预览结果，预计:")
        print(f"  保留率: {preview_result['keep_rate']*100:.1f}%")
        print(f"  预计从 {len(json.load(open(input_file))['dialogues'])} 个对话中保留约 {int(len(json.load(open(input_file))['dialogues']) * preview_result['keep_rate'])} 个")
        
        # 用户确认
        while True:
            choice = input("\n请选择操作:\n1. 继续清洗 (c)\n2. 调整参数后重新预览 (p)\n3. 取消 (q)\n请输入选择 (c/p/q): ").lower().strip()
            
            if choice in ['c', 'continue', '1']:
                print("✅ 开始正式清洗...")
                return self.clean_existing_dataset(input_file, output_file)
            elif choice in ['p', 'preview', '2']:
                print("🔄 重新预览...")
                self.preview_cleaning_results(input_file, 15)  # 更多样本
            elif choice in ['q', 'quit', '3']:
                print("❌ 取消清洗操作")
                return ""
            else:
                print("❓ 无效选择，请重新输入")

async def main():
    parser = argparse.ArgumentParser(description="增强版二次元对话数据生成")
    parser.add_argument("--chars_per_type", type=int, default=30, help="每个角色类型生成的对话数量")
    parser.add_argument("--concurrent_limit", type=int, default=5, help="并发API调用数量")
    parser.add_argument("--config_file", type=str, default="config/api_config.json", help="API配置文件")
    parser.add_argument("--output_file", type=str, help="输出文件名")
    parser.add_argument("--create_training_data", action="store_true", help="同时创建训练数据")
    parser.add_argument("--complexity_simple", type=float, default=0.2, help="简单对话比例")
    parser.add_argument("--complexity_medium", type=float, default=0.5, help="中等对话比例") 
    parser.add_argument("--complexity_complex", type=float, default=0.2, help="复杂对话比例")
    parser.add_argument("--complexity_advanced", type=float, default=0.1, help="高级对话比例")
    parser.add_argument("--save_interval", type=int, default=100, help="每多少个对话保存一次")
    parser.add_argument("--merge_only", action="store_true", help="仅合并已有的增量数据，不生成新数据")
    
    # 添加数据清洗相关参数
    parser.add_argument("--clean_dataset", type=str, help="清洗指定的数据集文件，只保留害羞可爱的对话")
    parser.add_argument("--batch_clean", action="store_true", help="批量清洗所有增量数据文件")
    parser.add_argument("--clean_output", type=str, help="清洗后的输出文件名")
    parser.add_argument("--preview_clean", type=str, help="预览清洗结果，不执行实际清洗")
    parser.add_argument("--interactive_clean", type=str, help="交互式清洗数据集，包含预览和确认")
    
    args = parser.parse_args()
    
    print("🚀 增强版二次元对话数据生成器")
    print("💎 支持高质量商业API，大规模并发生成")
    
    # 初始化生成器
    generator = EnhancedDialogueGenerator(args.config_file)
    
    # 检查API配置
    providers = generator._get_available_providers()
    if not providers:
        print("❌ 没有找到可用的API提供商，请检查配置文件")
        return
    
    print(f"✅ 找到 {len(providers)} 个可用的API: {', '.join(providers)}")
    
    # 数据清洗模式
    if args.clean_dataset:
        print(f"🧹 数据清洗模式: 清洗文件 {args.clean_dataset}")
        cleaned_file = generator.clean_existing_dataset(args.clean_dataset, args.clean_output)
        print(f"✅ 清洗完成: {cleaned_file}")
        return
    
    if args.preview_clean:
        print(f"🔍 预览清洗模式: 预览文件 {args.preview_clean}")
        generator.preview_cleaning_results(args.preview_clean, 10)
        return
    
    if args.interactive_clean:
        print(f"🎯 交互式清洗模式: 处理文件 {args.interactive_clean}")
        cleaned_file = generator.interactive_clean_dataset(args.interactive_clean, args.clean_output)
        if cleaned_file:
            print(f"✅ 交互式清洗完成: {cleaned_file}")
        return
    
    if args.batch_clean:
        print("🧹 批量清洗模式: 清洗所有增量数据文件")
        cleaned_files = generator.batch_clean_incremental_files()
        print(f"✅ 批量清洗完成，共处理 {len(cleaned_files)} 个文件")
        return
    
    # 创建生成计划
    complexity_dist = {
        "简单": args.complexity_simple,
        "中等": args.complexity_medium,
        "复杂": args.complexity_complex,
        "高级": args.complexity_advanced
    }
    
    generation_plan = generator.create_generation_plan(args.chars_per_type, complexity_dist)
    
    # 如果只是合并数据
    if args.merge_only:
        print("🔄 合并模式: 仅合并已有的增量数据")
        merged_file = generator.merge_incremental_data()
        print(f"✅ 合并完成: {merged_file}")
        return
    
    print(f"📋 生成计划: {len(generation_plan)} 个对话")
    print(f"⚡ 并发数: {args.concurrent_limit}")
    print(f"💾 每 {args.save_interval} 个对话自动保存一次")
    
    # 异步生成 - 使用增量保存模式
    start_time = time.time()
    dialogues = await generator.generate_batch_async(generation_plan, args.concurrent_limit, args.save_interval)
    generation_time = time.time() - start_time
    
    # 生成完毕后，自动合并所有增量数据
    print("\n🔄 正在合并所有增量数据...")
    merged_file = generator.merge_incremental_data()
    print(f"✅ 最终合并文件: {merged_file}")
    
    if not dialogues:
        print("❌ 没有成功生成任何对话")
        return
    
    print(f"⏱️ 生成用时: {generation_time:.1f}秒")
    
    # 保存数据集
    generator.save_dataset_enhanced(dialogues, args.output_file)
    
    # 可选：创建训练数据
    if args.create_training_data:
        generator.convert_to_training_format_enhanced(dialogues)
    
    print(f"\n🎯 任务完成! 高质量对话数据已准备就绪")

if __name__ == "__main__":
    asyncio.run(main()) 
#!/usr/bin/env python3
"""
AI自动生成二次元对话数据脚本
支持多种大模型API，生成高质量的角色对话训练数据
"""

import os
import json
import time
import random
import asyncio
import aiohttp
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import re

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("dialogue_generation.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class DialogueConfig:
    """对话生成配置"""
    character_type: str
    scenario: str
    num_turns: int
    temperature: float = 0.8
    max_tokens: int = 150

class DialogueGenerator:
    """AI对话生成器"""
    
    def __init__(self, api_config_path: str = "config/api_config.json"):
        self.api_config = self._load_api_config(api_config_path)
        self.output_dir = Path("data/generated_dialogues")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 角色类型和特征
        self.character_types = {
            "傲娇": {
                "personality": "表面高傲但内心温柔，经常说反话，容易害羞",
                "speech_patterns": ["哼", "才不是", "笨蛋", "别误会", "不过"],
                "topics": ["学习", "兴趣爱好", "日常生活", "情感表达"]
            },
            "元气少女": {
                "personality": "活泼开朗，充满活力，语气可爱",
                "speech_patterns": ["呀", "呢", "喵", "哇", "嘿嘿"],
                "topics": ["运动", "美食", "朋友", "学校活动"]
            },
            "中二病": {
                "personality": "自认为有特殊能力，用词夸张，富有想象力",
                "speech_patterns": ["吾", "汝", "黑暗", "力量", "契约"],
                "topics": ["超能力", "异世界", "命运", "秘密组织"]
            },
            "大小姐": {
                "personality": "出身名门，优雅但偶尔天然，有贵族气质",
                "speech_patterns": ["本小姐", "哼", "平民", "当然", "优雅"],
                "topics": ["贵族生活", "礼仪", "艺术", "社交"]
            },
            "冷酷": {
                "personality": "性格冷淡，不善表达，但内心善良",
                "speech_patterns": ["无聊", "随便", "不需要", "...", "愚蠢"],
                "topics": ["孤独", "理解", "信任", "过去"]
            },
            "学霸": {
                "personality": "聪明好学，认真负责，偶尔呆萌",
                "speech_patterns": ["根据资料", "学习", "效率", "计划"],
                "topics": ["学术", "研究", "图书馆", "考试"]
            }
        }
        
        # 对话场景
        self.scenarios = {
            "校园日常": [
                "在教室讨论作业", "在图书馆学习", "在食堂吃饭", 
                "参加社团活动", "体育课后", "考试前准备"
            ],
            "日常生活": [
                "逛街购物", "在咖啡厅聊天", "看电影后讨论",
                "在公园散步", "做家务", "准备料理"
            ],
            "兴趣爱好": [
                "讨论动漫", "玩游戏", "阅读轻小说",
                "画画创作", "听音乐", "学习新技能"
            ],
            "情感互动": [
                "安慰朋友", "表达感谢", "道歉和解",
                "庆祝生日", "分享秘密", "互相鼓励"
            ],
            "特殊场景": [
                "文化祭准备", "暑假计划", "雨天避雨",
                "意外相遇", "迷路求助", "生病照顾"
            ]
        }
        
        # 生成统计
        self.generation_stats = {
            "total_generated": 0,
            "successful": 0,
            "failed": 0,
            "filtered_out": 0,
            "start_time": datetime.now()
        }
    
    def _load_api_config(self, config_path: str) -> Dict:
        """加载API配置"""
        default_config = {
            "providers": {
                "openai": {
                    "api_key": "your-openai-api-key",
                    "base_url": "https://api.openai.com/v1",
                    "model": "gpt-3.5-turbo",
                    "enabled": False
                },
                "deepseek": {
                    "api_key": "your-deepseek-api-key", 
                    "base_url": "https://api.deepseek.com/v1",
                    "model": "deepseek-chat",
                    "enabled": False
                },
                "qwen": {
                    "api_key": "your-qwen-api-key",
                    "base_url": "https://dashscope.aliyuncs.com/api/v1",
                    "model": "qwen-turbo",
                    "enabled": False
                },
                "local": {
                    "base_url": "http://localhost:8000/v1",
                    "model": "local-model",
                    "enabled": True,
                    "api_key": "not-required"
                }
            },
            "generation": {
                "concurrent_requests": 3,
                "retry_attempts": 3,
                "timeout": 30,
                "rate_limit_delay": 1
            }
        }
        
        config_file = Path(config_path)
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                logger.info(f"已加载API配置: {config_path}")
                return {**default_config, **config}
            except Exception as e:
                logger.warning(f"API配置加载失败: {e}，使用默认配置")
        else:
            # 创建默认配置文件
            config_file.parent.mkdir(parents=True, exist_ok=True)
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            logger.info(f"已创建默认API配置: {config_path}")
        
        return default_config
    
    def _get_available_provider(self) -> Optional[Dict]:
        """获取可用的API提供商"""
        for name, config in self.api_config["providers"].items():
            if config.get("enabled", False):
                return {"name": name, **config}
        return None
    
    def _create_dialogue_prompt(self, config: DialogueConfig) -> str:
        """创建对话生成提示词"""
        char_info = self.character_types[config.character_type]
        scenario_list = self.scenarios[config.scenario.split("-")[0]]
        specific_scenario = random.choice(scenario_list)
        
        prompt = f"""请生成一段二次元风格的对话，要求如下：

角色设定：
- 角色类型：{config.character_type}
- 性格特征：{char_info['personality']}
- 语言特色：经常使用 {', '.join(char_info['speech_patterns'])} 等词汇
- 对话场景：{specific_scenario}

对话要求：
1. 生成 {config.num_turns} 轮对话 (每轮包含用户和角色的一次交互)
2. 角色语气要符合 {config.character_type} 的特点
3. 对话要自然流畅，有连贯性
4. 体现二次元文化特色
5. 避免过于重复的表达

请按以下JSON格式输出：
{{
    "character_type": "{config.character_type}",
    "scenario": "{specific_scenario}",
    "turns": [
        {{
            "turn": 1,
            "user": "用户说的话",
            "character": "角色回应"
        }},
        {{
            "turn": 2,
            "user": "用户说的话", 
            "character": "角色回应"
        }}
        // ... 更多轮次
    ]
}}

现在开始生成对话："""
        
        return prompt
    
    async def _call_api(self, provider: Dict, prompt: str, config: DialogueConfig) -> Optional[str]:
        """调用API生成对话"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {provider['api_key']}"
        }
        
        payload = {
            "model": provider["model"],
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": config.temperature,
            "max_tokens": config.max_tokens * config.num_turns  # 根据轮数调整
        }
        
        timeout = aiohttp.ClientTimeout(total=self.api_config["generation"]["timeout"])
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.post(
                    f"{provider['base_url']}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result["choices"][0]["message"]["content"]
                    else:
                        logger.error(f"API调用失败: {response.status} - {await response.text()}")
                        return None
            except Exception as e:
                logger.error(f"API调用异常: {e}")
                return None
    
    def _extract_dialogue_json(self, response: str) -> Optional[Dict]:
        """从API响应中提取对话JSON"""
        try:
            # 尝试直接解析JSON
            if response.strip().startswith('{'):
                return json.loads(response.strip())
            
            # 查找JSON代码块
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # 查找第一个完整的JSON对象
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
                
            logger.warning(f"无法从响应中提取JSON: {response[:200]}...")
            return None
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}")
            return None
    
    def _validate_dialogue(self, dialogue: Dict, config: DialogueConfig) -> bool:
        """验证生成的对话质量"""
        try:
            # 检查基本结构
            if not all(key in dialogue for key in ["character_type", "scenario", "turns"]):
                return False
            
            # 检查轮数
            if len(dialogue["turns"]) < config.num_turns // 2:  # 允许一定偏差
                return False
            
            # 检查每轮对话
            for turn in dialogue["turns"]:
                if not all(key in turn for key in ["user", "character"]):
                    return False
                
                # 检查内容长度
                if len(turn["user"]) < 5 or len(turn["character"]) < 10:
                    return False
                
                # 检查角色特征词（简单检查）
                char_info = self.character_types[config.character_type]
                character_text = turn["character"]
                
                # 至少要有一些角色特征
                has_character_feature = any(
                    pattern in character_text 
                    for pattern in char_info["speech_patterns"]
                )
                
                if not has_character_feature and random.random() < 0.3:  # 30%的概率要求有特征词
                    continue  # 给一些容错空间
            
            return True
            
        except Exception as e:
            logger.error(f"对话验证失败: {e}")
            return False
    
    async def generate_single_dialogue(self, config: DialogueConfig) -> Optional[Dict]:
        """生成单个对话"""
        provider = self._get_available_provider()
        if not provider:
            logger.error("没有可用的API提供商")
            return None
        
        prompt = self._create_dialogue_prompt(config)
        
        # 重试机制
        for attempt in range(self.api_config["generation"]["retry_attempts"]):
            try:
                response = await self._call_api(provider, prompt, config)
                if not response:
                    continue
                
                dialogue = self._extract_dialogue_json(response)
                if not dialogue:
                    continue
                
                if self._validate_dialogue(dialogue, config):
                    # 添加元数据
                    dialogue["metadata"] = {
                        "generated_at": datetime.now().isoformat(),
                        "provider": provider["name"],
                        "model": provider["model"],
                        "config": config.__dict__,
                        "attempt": attempt + 1
                    }
                    
                    self.generation_stats["successful"] += 1
                    return dialogue
                else:
                    self.generation_stats["filtered_out"] += 1
                    logger.debug(f"对话质量不符合要求，重试第 {attempt + 1} 次")
                
            except Exception as e:
                logger.error(f"生成对话失败 (尝试 {attempt + 1}): {e}")
                continue
            
            # 添加延迟避免频率限制
            await asyncio.sleep(self.api_config["generation"]["rate_limit_delay"])
        
        self.generation_stats["failed"] += 1
        return None
    
    async def generate_batch_dialogues(self, configs: List[DialogueConfig], batch_name: str = None) -> List[Dict]:
        """批量生成对话"""
        if not batch_name:
            batch_name = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"开始生成 {len(configs)} 个对话，批次: {batch_name}")
        
        # 控制并发数
        semaphore = asyncio.Semaphore(self.api_config["generation"]["concurrent_requests"])
        
        async def generate_with_semaphore(config):
            async with semaphore:
                return await self.generate_single_dialogue(config)
        
        # 执行并发生成
        tasks = [generate_with_semaphore(config) for config in configs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤有效结果
        valid_dialogues = []
        for result in results:
            if isinstance(result, dict) and result is not None:
                valid_dialogues.append(result)
            elif isinstance(result, Exception):
                logger.error(f"任务执行异常: {result}")
        
        # 保存批次结果
        if valid_dialogues:
            batch_file = self.output_dir / f"{batch_name}.json"
            with open(batch_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "batch_info": {
                        "name": batch_name,
                        "generated_at": datetime.now().isoformat(),
                        "total_requested": len(configs),
                        "total_generated": len(valid_dialogues),
                        "success_rate": len(valid_dialogues) / len(configs)
                    },
                    "dialogues": valid_dialogues
                }, f, ensure_ascii=False, indent=2)
            
            logger.info(f"批次 {batch_name} 完成: {len(valid_dialogues)}/{len(configs)} 成功生成")
        
        self.generation_stats["total_generated"] += len(valid_dialogues)
        return valid_dialogues
    
    def create_training_dataset(self, output_file: str = None) -> str:
        """将生成的对话转换为训练数据集格式"""
        if not output_file:
            output_file = f"dialogue_training_dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
        
        output_path = self.output_dir / output_file
        training_samples = []
        
        # 收集所有对话文件
        dialogue_files = list(self.output_dir.glob("batch_*.json"))
        
        for file_path in dialogue_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    batch_data = json.load(f)
                
                for dialogue in batch_data.get("dialogues", []):
                    character_type = dialogue["character_type"]
                    
                    # 为每轮对话创建训练样本
                    conversation_history = []
                    
                    for turn in dialogue["turns"]:
                        # 构建当前对话上下文
                        context = f"你是一个{character_type}类型的二次元角色。" if not conversation_history else ""
                        
                        # 添加历史对话
                        for hist in conversation_history:
                            context += f"用户: {hist['user']}\n角色: {hist['character']}\n"
                        
                        # 当前用户输入
                        context += f"用户: {turn['user']}\n角色: "
                        
                        # 创建训练样本
                        training_sample = {
                            "instruction": context.strip(),
                            "output": turn["character"],
                            "input": "",
                            "character_type": character_type,
                            "scenario": dialogue["scenario"],
                            "turn_id": turn.get("turn", len(conversation_history) + 1)
                        }
                        
                        training_samples.append(training_sample)
                        
                        # 更新对话历史
                        conversation_history.append({
                            "user": turn["user"],
                            "character": turn["character"]
                        })
                        
                        # 限制历史长度，避免上下文过长
                        if len(conversation_history) > 3:
                            conversation_history = conversation_history[-3:]
            
            except Exception as e:
                logger.error(f"处理对话文件失败 {file_path}: {e}")
        
        # 保存训练数据集
        with open(output_path, 'w', encoding='utf-8') as f:
            for sample in training_samples:
                f.write(json.dumps(sample, ensure_ascii=False) + '\n')
        
        logger.info(f"训练数据集已生成: {output_path}")
        logger.info(f"总样本数: {len(training_samples)}")
        
        # 生成统计报告
        self._generate_dataset_report(training_samples, output_path.with_suffix('.report.json'))
        
        return str(output_path)
    
    def _generate_dataset_report(self, samples: List[Dict], report_path: Path):
        """生成数据集统计报告"""
        from collections import Counter
        
        char_type_dist = Counter(sample["character_type"] for sample in samples)
        scenario_dist = Counter(sample["scenario"] for sample in samples)
        
        report = {
            "dataset_info": {
                "total_samples": len(samples),
                "generated_at": datetime.now().isoformat(),
                "character_type_distribution": dict(char_type_dist),
                "scenario_distribution": dict(scenario_dist)
            },
            "quality_metrics": {
                "avg_output_length": sum(len(s["output"]) for s in samples) / len(samples),
                "avg_context_length": sum(len(s["instruction"]) for s in samples) / len(samples),
                "unique_outputs": len(set(s["output"] for s in samples))
            },
            "generation_stats": self.generation_stats
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    def print_stats(self):
        """打印生成统计信息"""
        duration = datetime.now() - self.generation_stats["start_time"]
        
        print("\n" + "="*50)
        print("📊 对话生成统计报告")
        print("="*50)
        print(f"⏱️  运行时间: {duration}")
        print(f"✅ 成功生成: {self.generation_stats['successful']}")
        print(f"❌ 生成失败: {self.generation_stats['failed']}")
        print(f"🚫 质量过滤: {self.generation_stats['filtered_out']}")
        print(f"📁 输出目录: {self.output_dir}")
        print("="*50)

def create_generation_plan(
    num_dialogues_per_character: int = 50,
    num_turns_range: tuple = (3, 8),
    scenarios_per_character: int = None
) -> List[DialogueConfig]:
    """创建对话生成计划"""
    
    configs = []
    generator = DialogueGenerator()
    
    for char_type in generator.character_types.keys():
        char_scenarios = []
        
        # 收集该角色适合的场景
        for scenario_category, scenario_list in generator.scenarios.items():
            if scenarios_per_character:
                selected = random.sample(scenario_list, min(scenarios_per_character, len(scenario_list)))
            else:
                selected = scenario_list
            
            for scenario in selected:
                char_scenarios.append(f"{scenario_category}-{scenario}")
        
        # 为每个角色生成多个对话配置
        for i in range(num_dialogues_per_character):
            config = DialogueConfig(
                character_type=char_type,
                scenario=random.choice(char_scenarios),
                num_turns=random.randint(*num_turns_range),
                temperature=random.uniform(0.7, 0.9)
            )
            configs.append(config)
    
    random.shuffle(configs)  # 随机打散顺序
    return configs

async def main():
    parser = argparse.ArgumentParser(description="AI自动生成二次元对话数据")
    parser.add_argument("--num_per_character", type=int, default=50, help="每个角色生成的对话数量")
    parser.add_argument("--min_turns", type=int, default=3, help="最少对话轮数")
    parser.add_argument("--max_turns", type=int, default=8, help="最多对话轮数")
    parser.add_argument("--output_dir", type=str, default="data/generated_dialogues", help="输出目录")
    parser.add_argument("--batch_size", type=int, default=20, help="批处理大小")
    parser.add_argument("--create_dataset", action="store_true", help="生成完成后创建训练数据集")
    parser.add_argument("--config_file", type=str, default="config/api_config.json", help="API配置文件")
    
    args = parser.parse_args()
    
    # 初始化生成器
    generator = DialogueGenerator(args.config_file)
    generator.output_dir = Path(args.output_dir)
    generator.output_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建生成计划
    configs = create_generation_plan(
        num_dialogues_per_character=args.num_per_character,
        num_turns_range=(args.min_turns, args.max_turns)
    )
    
    logger.info(f"📋 生成计划: {len(configs)} 个对话")
    logger.info(f"📁 输出目录: {generator.output_dir}")
    
    # 分批生成
    for i in range(0, len(configs), args.batch_size):
        batch_configs = configs[i:i + args.batch_size]
        batch_name = f"batch_{i//args.batch_size + 1:03d}"
        
        logger.info(f"🚀 开始批次 {batch_name}: {len(batch_configs)} 个对话")
        await generator.generate_batch_dialogues(batch_configs, batch_name)
        
        # 避免API频率限制
        await asyncio.sleep(2)
    
    # 打印统计信息
    generator.print_stats()
    
    # 创建训练数据集
    if args.create_dataset:
        logger.info("📦 正在创建训练数据集...")
        dataset_path = generator.create_training_dataset()
        print(f"✅ 训练数据集已保存: {dataset_path}")

if __name__ == "__main__":
    asyncio.run(main()) 
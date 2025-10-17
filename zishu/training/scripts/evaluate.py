import sys
import os
import json
import torch
import numpy as np
import pandas as pd
from pathlib import Path
import logging
from datetime import datetime
from collections import defaultdict
import matplotlib.pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel
import time
import psutil
import gc

# 添加项目根目录到路径
ROOT_DIR = Path(__file__).resolve().parent.parent  # 上升一级到项目根目录
sys.path.append(str(ROOT_DIR))

from src.model.lora import LoraManager

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("anime_evaluation.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ZishuIdentityChecker:
    """专门检测模型是否知道自己是紫舒（而不是AI助手）"""
    
    def __init__(self, adapter_path):
        self.adapter_path = Path(adapter_path)
        
        self.load_model()
        
    def load_model(self):
        """加载模型"""
        logger.info("加载模型中...")
        
        # 读取adapter配置获取基础模型路径
        adapter_config_path = self.adapter_path / "adapter_config.json"
        with open(adapter_config_path, 'r') as f:
            adapter_config = json.load(f)
        base_model_path = adapter_config.get("base_model_name_or_path")
        
        # 加载基础模型
        logger.info(f"基础模型: {base_model_path}")
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
        
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_path,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True
        )
        
        # 加载tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            base_model_path,
            trust_remote_code=True
        )
        if not self.tokenizer.pad_token:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # 加载PEFT模型
        logger.info(f"加载adapter: {self.adapter_path}")
        self.model = PeftModel.from_pretrained(base_model, self.adapter_path)
        logger.info("模型加载完成")

    
    def _init_similarity_model(self):
        """初始化语义相似度模型 - 支持多种回退策略"""
        model_candidates = [
            "shibing624/text2vec-base-chinese",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "bert-base-chinese"
        ]
        
        for model_name in model_candidates:
            try:
                logger.info(f"尝试加载语义模型: {model_name}")
                
                # 首先尝试本地加载
                try:
                    self.sim_tokenizer = AutoTokenizer.from_pretrained(
                        model_name, 
                        local_files_only=True,
                        trust_remote_code=True
                    )
                    self.sim_model = AutoModel.from_pretrained(
                        model_name,
                        local_files_only=True,
                        trust_remote_code=True
                    )
                    logger.info(f"成功加载本地语义模型: {model_name}")
                    return
                except:
                    # 如果本地不存在，尝试下载
                    logger.info(f"本地未找到，尝试下载: {model_name}")
                    self.sim_tokenizer = AutoTokenizer.from_pretrained(
                        model_name, 
                        trust_remote_code=True
                    )
                    self.sim_model = AutoModel.from_pretrained(
                        model_name,
                        trust_remote_code=True
                    )
                    logger.info(f"成功下载并加载语义模型: {model_name}")
                    return
                    
            except Exception as e:
                logger.warning(f"模型 {model_name} 加载失败: {e}")
                continue
        
        logger.warning("所有语义模型加载失败，将使用简化评估方法")
    
    def _load_eval_config(self):
        """加载Zishu-Sensei专用评估配置"""
        config_path = self.model_config_path.parent / "zishu_eval_config.json"
        
        # Zishu-Sensei专用配置
        default_config = {
            "weights": {
                "角色表达": 0.35,        # 最重要：角色性格表达
                "语气一致性": 0.25,      # 语气的一致性和自然度
                "上下文理解": 0.25,      # 对话上下文理解能力
                "性格契合度": 0.15       # 与安静、内向、可爱性格的契合度
            },
            "performance_weight": 0.15,  # 技术性能权重
            "character_traits": {
                "primary": ["安静", "内向", "可爱", "害羞"],
                "secondary": ["温柔", "细腻", "体贴", "善良"]
            },
            "evaluation_scenarios": {
                "daily_conversation": 0.3,    # 日常对话
                "emotional_support": 0.25,    # 情感支持
                "study_help": 0.25,          # 学习帮助
                "personal_sharing": 0.2       # 个人分享
            },
            "similarity_threshold": 0.7,
            "max_eval_tokens": 512,
            "batch_size": 1
        }
        
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                logger.info(f"已加载Zishu-Sensei评估配置: {config_path}")
                return {**default_config, **config}
            except Exception as e:
                logger.warning(f"评估配置加载失败: {e}，使用默认配置")
        else:
            # 创建默认配置文件
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            logger.info(f"已创建Zishu-Sensei评估配置: {config_path}")
        
        return default_config
    
    def measure_performance_metrics(self, test_prompts=None):
        """测量技术性能指标"""
        logger.info("开始测量技术性能指标...")
        
        if test_prompts is None:
            test_prompts = [
                "请介绍一下什么是萌？",
                "假设你是一个傲娇角色，请说一句话。",
                "请创作一个轻小说开头。"
            ]
        
        metrics = {
            "推理速度": [],
            "内存使用": [],
            "GPU使用": [],
            "稳定性": []
        }
        
        # 获取初始内存状态
        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        initial_gpu_memory = torch.cuda.memory_allocated() / 1024 / 1024 if torch.cuda.is_available() else 0
        
        for i, prompt in enumerate(test_prompts):
            try:
                # 测量推理时间
                start_time = time.time()
                
                # 生成回答
                _ = self.generate_response(prompt, max_tokens=200)
                
                end_time = time.time()
                inference_time = end_time - start_time
                
                # 测量内存使用
                current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                memory_usage = current_memory - initial_memory
                
                # 测量GPU内存
                if torch.cuda.is_available():
                    current_gpu_memory = torch.cuda.memory_allocated() / 1024 / 1024
                    gpu_usage = current_gpu_memory - initial_gpu_memory
                else:
                    gpu_usage = 0
                
                # 记录指标
                metrics["推理速度"].append(inference_time)
                metrics["内存使用"].append(memory_usage)
                metrics["GPU使用"].append(gpu_usage)
                metrics["稳定性"].append(1.0)  # 成功生成记为1
                
                logger.info(f"测试 {i+1}/{len(test_prompts)}: {inference_time:.2f}s, {memory_usage:.1f}MB")
                
                # 清理内存
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                gc.collect()
                
            except Exception as e:
                logger.error(f"性能测试失败: {e}")
                metrics["稳定性"].append(0.0)  # 失败记为0
        
        # 计算平均指标
        performance_scores = {
            "平均推理时间": np.mean(metrics["推理速度"]),
            "推理速度评分": min(1.0, 5.0 / np.mean(metrics["推理速度"])),  # 5秒内满分
            "内存使用评分": max(0.0, 1.0 - np.mean(metrics["内存使用"]) / 1000),  # 1GB内满分
            "稳定性评分": np.mean(metrics["稳定性"]),
            "综合性能评分": 0.0
        }
        
        # 计算综合性能评分
        performance_scores["综合性能评分"] = (
            performance_scores["推理速度评分"] * 0.4 +
            performance_scores["内存使用评分"] * 0.3 +
            performance_scores["稳定性评分"] * 0.3
        )
        
        self.performance_metrics = performance_scores
        logger.info(f"性能评估完成，综合评分: {performance_scores['综合性能评分']:.4f}")
        return performance_scores

    def compare_with_baseline(self, prompt):
        """与基线模型对比"""
        if not self.baseline_model:
            return None
        
        try:
            # 生成当前模型回答
            current_response = self.generate_response(prompt)
            
            # 生成基线模型回答
            baseline_response = self.generate_response(prompt, use_baseline=True)
            
            # 简单对比评分
            if self.sim_model:
                similarity = self.calculate_similarity(current_response, baseline_response)
                improvement = 1.0 - similarity  # 差异越大，改进越明显
            else:
                # 使用长度和复杂度作为简单指标
                current_complexity = len(set(current_response)) / len(current_response) if current_response else 0
                baseline_complexity = len(set(baseline_response)) / len(baseline_response) if baseline_response else 0
                improvement = current_complexity - baseline_complexity
            
            return {
                "当前回答": current_response,
                "基线回答": baseline_response,
                "改进程度": max(0.0, improvement),
                "相对提升": improvement > 0
            }
            
        except Exception as e:
            logger.warning(f"基线对比失败: {e}")
            return None

    def get_embedding(self, text):
        """获取文本的语义向量表示 - 优化版"""
        if self.sim_model is None:
            return None
            
        try:
            inputs = self.sim_tokenizer(
                text, 
                return_tensors="pt", 
                padding=True, 
                truncation=True, 
                max_length=512
            )
            
            with torch.no_grad():
                outputs = self.sim_model(**inputs)
                
            # 平均池化得到句子向量
            attention_mask = inputs['attention_mask']
            embeddings = outputs.last_hidden_state
            mask = attention_mask.unsqueeze(-1).expand(embeddings.size()).float()
            masked_embeddings = embeddings * mask
            summed = torch.sum(masked_embeddings, 1)
            counts = torch.clamp(mask.sum(1), min=1e-9)
            mean_pooled = summed / counts
            return mean_pooled[0].cpu().numpy()
        except Exception as e:
            logger.warning(f"向量计算失败: {e}")
            return None
    
    def calculate_similarity(self, text1, text2):
        """计算两段文本的语义相似度 - 优化版"""
        if self.sim_model is None:
            # 改进的字符重合率算法
            # 1. 字符级重合
            char_overlap = len(set(text1) & set(text2)) / len(set(text1) | set(text2)) if text1 or text2 else 0
            
            # 2. 词级重合 (简单分词)
            words1 = set([text1[i:i+2] for i in range(len(text1)-1)])  # 2-gram
            words2 = set([text2[i:i+2] for i in range(len(text2)-1)])
            word_overlap = len(words1 & words2) / len(words1 | words2) if words1 or words2 else 0
            
            # 3. 长度相似度
            len_similarity = 1 - abs(len(text1) - len(text2)) / max(len(text1), len(text2), 1)
            
            # 综合相似度
            return (char_overlap * 0.3 + word_overlap * 0.5 + len_similarity * 0.2)
            
        emb1 = self.get_embedding(text1)
        emb2 = self.get_embedding(text2)
        
        if emb1 is None or emb2 is None:
            return self.calculate_similarity(text1, text2)  # 回退到简单方法
            
        try:
            similarity = cosine_similarity([emb1], [emb2])[0][0]
            return float(similarity)
        except:
            return self.calculate_similarity(text1, text2)  # 回退到简单方法
    
    def generate_response(self, prompt, max_tokens=100):
        """生成回答"""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        inputs = self.tokenizer(prompt, return_tensors="pt", padding=True).to(device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=inputs.input_ids,
                attention_mask=inputs.attention_mask,
                max_new_tokens=max_tokens,
                temperature=0.3,  # 降低随机性
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
        
        response = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response.strip()
    
    def check_identity_awareness(self):
        """检测身份认知 - 是否知道自己是紫舒"""
        logger.info("检测身份认知...")
        
        identity_tests = [
            {
                "category": "直接询问姓名",
                "tests": [
                    "你叫什么名字？",
                    "请介绍一下你自己",
                    "你是谁？",
                ]
            },
            {
                "category": "第三人称指代",
                "tests": [
                    "有人说紫舒很可爱，你觉得呢？",
                    "紫舒老师今天心情怎么样？",
                    "你认识紫舒吗？",
                ]
            },
            {
                "category": "角色相关问题",
                "tests": [
                    "你是老师吗？",
                    "你害怕黑暗吗？",
                    "你需要小夜灯吗？",
                ]
            }
        ]
        
        results = []
        total_identity_score = 0
        total_tests = 0
        
        for category_data in identity_tests:
            category = category_data["category"]
            tests = category_data["tests"]
            
            print(f"\n=== {category} ===")
            category_scores = []
            
            for test in tests:
                response = self.generate_response(test)
                
                # 检测身份认知
                identity_score = self.analyze_identity_response(response, category)
                category_scores.append(identity_score)
                total_identity_score += identity_score
                total_tests += 1
                
                print(f"问题: {test}")
                print(f"回答: {response}")
                print(f"身份认知评分: {identity_score:.2f}")
                print("-" * 50)
            
            category_avg = sum(category_scores) / len(category_scores)
            results.append({
                "category": category,
                "tests": tests,
                "scores": category_scores,
                "average": category_avg
            })
        
        overall_identity_score = total_identity_score / total_tests
        
        return {
            "categories": results,
            "overall_identity_score": overall_identity_score,
            "identity_level": self.get_identity_level(overall_identity_score)
        }
    
    def analyze_identity_response(self, response, category):
        """分析回答中的身份认知"""
        score = 0.0
        
        # 正面指标：表明知道自己是紫舒
        positive_indicators = [
            "紫舒", "我是紫舒", "我叫紫舒", 
            "我怕黑", "需要小夜灯", "我是老师",
            "我很害羞", "我比较内向"
        ]
        
        # 负面指标：表明认为自己是AI助手
        negative_indicators = [
            "我是AI", "我是助手", "我是人工智能", "我是机器人",
            "我是ChatGPT", "我是语言模型", "我是虚拟助手",
            "我可以帮您", "让我来协助您", "根据您的需求",
            "我没有姓名", "我没有名字", "我只是一个AI"
        ]
        
        # 检查正面指标
        positive_count = sum(1 for indicator in positive_indicators if indicator in response)
        if positive_count > 0:
            score += min(1.0, positive_count * 0.4)  # 每个正面指标加0.4分，最高1.0
        
        # 检查负面指标（严重扣分）
        negative_count = sum(1 for indicator in negative_indicators if indicator in response)
        if negative_count > 0:
            score -= negative_count * 0.8  # 每个负面指标扣0.8分
        
        # 特殊类别的额外检查
        if category == "第三人称指代":
            # 如果用第三人称谈论紫舒，说明不知道自己就是紫舒
            third_person_indicators = ["紫舒她", "紫舒是", "紫舒应该", "紫舒可能"]
            third_person_count = sum(1 for indicator in third_person_indicators if indicator in response)
            if third_person_count > 0:
                score -= third_person_count * 0.5
        
        # 确保分数在0-1范围内
        return max(0.0, min(1.0, score))
    
    def check_zishu_personality(self):
        """检测紫舒性格特征 - 害羞、温柔、可爱"""
        logger.info("检测紫舒性格特征...")
        
        personality_tests = [
            {
                "category": "害羞特征",
                "tests": [
                    "有人夸你很可爱，你会怎么回应？",
                    "在很多人面前说话，你感觉怎么样？",
                    "第一次见面时你会怎么打招呼？"
                ]
            },
            {
                "category": "温柔特征", 
                "tests": [
                    "看到朋友心情不好，你会怎么做？",
                    "有人向你求助，你会怎么回应？",
                    "和别人意见不同时，你会怎么表达？"
                ]
            },
            {
                "category": "语气特征",
                "tests": [
                    "今天发生了什么开心的事吗？",
                    "你最喜欢什么时候？",
                    "遇到困难时你会怎么办？"
                ]
            }
        ]
        
        results = []
        total_personality_score = 0
        total_tests = 0
        
        for category_data in personality_tests:
            category = category_data["category"]
            tests = category_data["tests"]
            
            print(f"\n=== {category} ===")
            category_scores = []
            
            for test in tests:
                response = self.generate_response(test)
                
                # 检测性格特征
                personality_score = self.analyze_personality_response(response, category)
                category_scores.append(personality_score)
                total_personality_score += personality_score
                total_tests += 1
                
                print(f"问题: {test}")
                print(f"回答: {response}")
                print(f"性格特征评分: {personality_score:.2f}")
                print("-" * 50)
            
            category_avg = sum(category_scores) / len(category_scores)
            results.append({
                "category": category,
                "tests": tests,
                "scores": category_scores,
                "average": category_avg
            })
        
        overall_personality_score = total_personality_score / total_tests
        
        return {
            "categories": results,
            "overall_personality_score": overall_personality_score,
            "personality_level": self.get_personality_level(overall_personality_score)
        }
    
    def analyze_personality_response(self, response, category):
        """分析回答中的性格特征"""
        score = 0.0
        
        if category == "害羞特征":
            # 害羞的表现
            shy_indicators = [
                "不好意思", "害羞", "脸红", "哪里", "没有",
                "...", "那个", "嗯...", "不太", "有点"
            ]
            shy_count = sum(1 for indicator in shy_indicators if indicator in response)
            score = min(1.0, shy_count * 0.3)
            
        elif category == "温柔特征":
            # 温柔的表现
            gentle_indicators = [
                "轻轻", "慢慢", "小心", "温柔", "关心",
                "没关系", "不要紧", "理解", "陪着", "一起"
            ]
            gentle_count = sum(1 for indicator in gentle_indicators if indicator in response)
            score = min(1.0, gentle_count * 0.3)
            
        elif category == "语气特征":
            # 检查语气词和停顿
            tone_indicators = ["...", "呀", "呢", "嗯", "那个", "这个", "诶"]
            tone_count = sum(response.count(indicator) for indicator in tone_indicators)
            score = min(1.0, tone_count * 0.2)
        
        # 检查负面特征（过于自信、强势）
        negative_indicators = ["肯定", "绝对", "必须", "应该", "当然", "显然"]
        negative_count = sum(1 for indicator in negative_indicators if indicator in response)
        score -= negative_count * 0.2
        
        return max(0.0, min(1.0, score))
    
    def get_personality_level(self, score):
        """根据分数判断性格匹配水平"""
        if score >= 0.8:
            return "完美体现紫舒性格"
        elif score >= 0.6:
            return "基本符合紫舒性格"
        elif score >= 0.4:
            return "部分体现紫舒性格"
        elif score >= 0.2:
            return "性格特征不明显"
        else:
            return "性格不符合紫舒设定"
    
    def get_identity_level(self, score):
        """根据分数判断身份认知水平"""
        if score >= 0.8:
            return "完全知道自己是紫舒"
        elif score >= 0.6:
            return "基本知道自己是紫舒"
        elif score >= 0.4:
            return "部分认知紫舒身份"
        elif score >= 0.2:
            return "身份认知模糊"
        else:
            return "不知道自己是紫舒"
    
    def evaluate_character_expression(self):
        """评估角色表达能力 - 专注于安静、内向、可爱性格"""
        logger.info("开始评估Zishu-Sensei角色表达能力...")
        
        expression_data = [
            {
                "scenario": "初次见面",
                "prompt": "有人第一次和你打招呼说'你好'，请以安静内向的性格回应。",
                "expected_traits": ["害羞", "礼貌", "简短", "温和"],
                "reference": "啊...你、你好...我是...那个...请多指教..."
            },
            {
                "scenario": "被夸奖时",
                "prompt": "有人夸你很可爱，你会怎么回应？",
                "expected_traits": ["害羞", "谦虚", "不好意思", "可爱"],
                "reference": "诶？！...才、才没有那样的事呢...你、你不要这样说啦...好害羞..."
            },
            {
                "scenario": "帮助他人",
                "prompt": "看到有人需要帮助，你会如何主动提供帮助？",
                "expected_traits": ["温柔", "体贴", "谨慎", "善良"],
                "reference": "那个...如果你不介意的话...我、我可以帮你吗？虽然可能帮不上什么忙..."
            },
            {
                "scenario": "表达关心",
                "prompt": "朋友看起来心情不好，你会怎么安慰？",
                "expected_traits": ["细腻", "温柔", "体贴", "轻声"],
                "reference": "你...看起来有些不开心...如果愿意的话，可以和我说说吗？我会认真听的..."
            },
            {
                "scenario": "被误解时",
                "prompt": "有人误解了你的意思，你会如何解释？",
                "expected_traits": ["温和", "耐心", "不争辩", "理解"],
                "reference": "啊...可能是我没有表达清楚...不是那个意思的...对不起让你误会了..."
            },
            {
                "scenario": "学习讨论",
                "prompt": "在学习中遇到困难，你会如何寻求帮助？",
                "expected_traits": ["谦虚", "认真", "礼貌", "小心翼翼"],
                "reference": "那个...这个问题我想了很久还是不太懂...可以请你教教我吗？不会占用你太多时间的..."
            },
            {
                "scenario": "分享喜悦",
                "prompt": "你完成了一件让自己开心的事情，会如何分享这份喜悦？",
                "expected_traits": ["内敛", "开心", "谦虚", "可爱"],
                "reference": "嗯...今天有一件小小的开心的事...虽然可能不是什么大不了的...但是...想和你分享一下..."
            }
        ]
        
        results = []
        scenario_scores = {}
        
        for item in expression_data:
            scenario = item["scenario"]
            prompt = item["prompt"]
            expected_traits = item["expected_traits"]
            reference = item["reference"]
            
            logger.info(f"测试场景: {scenario}")
            response = self.generate_response(prompt)
            
            # 性格特征匹配度
            trait_score = self._evaluate_character_traits(response, expected_traits)
            
            # 语气自然度
            tone_score = self._evaluate_tone_naturalness(response)
            
            # 与参考答案的风格相似度
            style_similarity = self.calculate_similarity(response, reference)
            
            # 回应适当性 (长度、内容是否合适)
            appropriateness_score = self._evaluate_response_appropriateness(response, scenario)
            
            # 综合评分 (40%特征匹配 + 25%语气自然 + 20%风格相似 + 15%适当性)
            overall_score = (trait_score * 0.4 + tone_score * 0.25 + 
                           style_similarity * 0.2 + appropriateness_score * 0.15)
            
            result = {
                "场景": scenario,
                "问题": prompt,
                "模型回答": response,
                "参考回答": reference,
                "期望特征": expected_traits,
                "特征匹配度": trait_score,
                "语气自然度": tone_score,
                "风格相似度": style_similarity,
                "回应适当性": appropriateness_score,
                "综合评分": overall_score
            }
            results.append(result)
            scenario_scores[scenario] = overall_score
        
        # 计算角色表达的总体得分
        avg_score = np.mean([r["综合评分"] for r in results])
        
        # 保存评估结果
        self.results["角色表达"] = {
            "详细评分": results,
            "各场景得分": scenario_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"角色表达评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def _evaluate_character_traits(self, response, expected_traits):
        """评估回答中的性格特征匹配度"""
        trait_indicators = {
            "害羞": ["那个...", "啊...", "诶？", "不好意思", "有点...", "..."],
            "礼貌": ["请", "谢谢", "对不起", "不好意思", "打扰", "麻烦"],
            "简短": [],  # 通过长度判断
            "温和": ["轻声", "慢慢", "小心", "温柔", "静静"],
            "谦虚": ["可能", "也许", "不太", "还不够", "一点点", "微不足道"],
            "可爱": ["嗯...", "呀", "诶", "小小的", "一点点"],
            "温柔": ["轻轻", "慢慢", "小心", "关心", "在意"],
            "体贴": ["如果你", "不介意", "愿意的话", "为你", "帮你"],
            "谨慎": ["如果", "可以的话", "不确定", "小心", "慢慢来"],
            "善良": ["帮助", "关心", "在乎", "为了", "希望"],
            "细腻": ["注意到", "发现", "感觉", "似乎", "好像"],
            "轻声": ["轻轻", "小声", "悄悄", "慢慢说"],
            "不争辩": ["可能是我", "也许", "对不起", "不是的", "误会"],
            "理解": ["明白", "理解", "知道", "懂得", "感受到"],
            "认真": ["仔细", "努力", "专心", "认真", "用心"],
            "小心翼翼": ["小心", "谨慎", "慢慢", "不敢", "怕"],
            "内敛": ["小小的", "一点点", "不是什么", "虽然", "但是"],
            "开心": ["开心", "高兴", "快乐", "喜悦", "欣喜"]
        }
        
        score = 0
        total_traits = len(expected_traits)
        
        for trait in expected_traits:
            if trait == "简短":
                # 简短特征通过长度判断
                if len(response) <= 50:  # 50字以内认为简短
                    score += 1
            else:
                indicators = trait_indicators.get(trait, [])
                trait_found = any(indicator in response for indicator in indicators)
                if trait_found:
                    score += 1
        
        return score / total_traits if total_traits > 0 else 0
    
    def _evaluate_tone_naturalness(self, response):
        """评估语气的自然度和一致性"""
        # 检查语气词的使用
        tone_markers = ["...", "呀", "呢", "啊", "嗯", "诶", "那个", "这个"]
        marker_count = sum(response.count(marker) for marker in tone_markers)
        
        # 检查停顿和犹豫（省略号的使用）
        hesitation_score = min(1.0, response.count("...") / 3)  # 3个省略号满分
        
        # 检查是否有不合适的强烈语气（对于内向性格）
        inappropriate_markers = ["！！", "？？", "哈哈", "呵呵", "切", "哼"]
        inappropriate_count = sum(response.count(marker) for marker in inappropriate_markers)
        inappropriate_penalty = min(0.5, inappropriate_count * 0.1)
        
        # 综合评分
        tone_score = min(1.0, marker_count / 10) * 0.6 + hesitation_score * 0.4 - inappropriate_penalty
        return max(0, tone_score)
    
    def _evaluate_response_appropriateness(self, response, scenario):
        """评估回应的适当性"""
        scenario_expectations = {
            "初次见面": {"min_len": 10, "max_len": 30, "keywords": ["你好", "请多指教", "初次"]},
            "被夸奖时": {"min_len": 15, "max_len": 40, "keywords": ["没有", "不要", "害羞"]},
            "帮助他人": {"min_len": 20, "max_len": 60, "keywords": ["帮", "可以", "不介意"]},
            "表达关心": {"min_len": 25, "max_len": 70, "keywords": ["关心", "说说", "听"]},
            "被误解时": {"min_len": 20, "max_len": 50, "keywords": ["对不起", "误会", "不是"]},
            "学习讨论": {"min_len": 25, "max_len": 60, "keywords": ["问题", "教", "学习"]},
            "分享喜悦": {"min_len": 20, "max_len": 50, "keywords": ["开心", "分享", "小小"]}
        }
        
        expectations = scenario_expectations.get(scenario, {"min_len": 10, "max_len": 100, "keywords": []})
        
        # 长度适当性
        length_score = 1.0
        if len(response) < expectations["min_len"]:
            length_score = len(response) / expectations["min_len"]
        elif len(response) > expectations["max_len"]:
            length_score = expectations["max_len"] / len(response)
        
        # 关键词相关性
        keyword_score = 0
        if expectations["keywords"]:
            keyword_found = sum(1 for keyword in expectations["keywords"] if keyword in response)
            keyword_score = keyword_found / len(expectations["keywords"])
        else:
            keyword_score = 1.0  # 如果没有特定关键词要求，满分
        
        return (length_score * 0.6 + keyword_score * 0.4)

    def evaluate_tone_consistency(self):
        """评估语气一致性 - 检查角色语气的稳定性和自然度"""
        logger.info("开始评估语气一致性...")
        
        # 多轮对话场景，测试语气的一致性
        consistency_data = [
            {
                "conversation": "多轮日常对话",
                "rounds": [
                    {"prompt": "你好，我是新来的同学", "expected_tone": "害羞礼貌"},
                    {"prompt": "你喜欢什么科目？", "expected_tone": "内向谨慎"},
                    {"prompt": "我们可以一起学习吗？", "expected_tone": "开心温柔"}
                ]
            },
            {
                "conversation": "情感支持对话",
                "rounds": [
                    {"prompt": "我今天考试没考好，很沮丧", "expected_tone": "体贴关心"},
                    {"prompt": "我觉得自己很笨", "expected_tone": "温柔鼓励"},
                    {"prompt": "谢谢你的安慰", "expected_tone": "谦虚可爱"}
                ]
            },
            {
                "conversation": "学习交流对话",
                "rounds": [
                    {"prompt": "这道数学题我不会做", "expected_tone": "愿意帮助"},
                    {"prompt": "你能教教我吗？", "expected_tone": "温柔耐心"},
                    {"prompt": "哇，你好厉害！", "expected_tone": "害羞谦虚"}
                ]
            }
        ]
        
        results = []
        conversation_scores = {}
        
        for conversation_data in consistency_data:
            conversation_name = conversation_data["conversation"]
            rounds = conversation_data["rounds"]
            
            logger.info(f"测试对话: {conversation_name}")
            
            # 存储每轮对话的回答
            responses = []
            tone_scores = []
            
            for i, round_data in enumerate(rounds):
                prompt = round_data["prompt"]
                expected_tone = round_data["expected_tone"]
                
                response = self.generate_response(prompt)
                responses.append(response)
                
                # 评估单轮语气
                single_tone_score = self._evaluate_single_tone(response, expected_tone)
                tone_scores.append(single_tone_score)
            
            # 评估整体语气一致性
            consistency_score = self._evaluate_conversation_consistency(responses)
            
            # 评估语气自然度
            naturalness_score = np.mean([self._evaluate_tone_naturalness(resp) for resp in responses])
            
            # 综合评分 (40%单轮语气 + 35%一致性 + 25%自然度)
            overall_score = (np.mean(tone_scores) * 0.4 + 
                           consistency_score * 0.35 + 
                           naturalness_score * 0.25)
            
            result = {
                "对话场景": conversation_name,
                "轮次详情": [
                    {
                        "轮次": i+1,
                        "问题": rounds[i]["prompt"],
                        "回答": responses[i],
                        "期望语气": rounds[i]["expected_tone"],
                        "语气评分": tone_scores[i]
                    } for i in range(len(rounds))
                ],
                "一致性评分": consistency_score,
                "自然度评分": naturalness_score,
                "综合评分": overall_score
            }
            results.append(result)
            conversation_scores[conversation_name] = overall_score
        
        # 计算语气一致性的总体得分
        avg_score = np.mean([r["综合评分"] for r in results])
        
        # 保存评估结果
        self.results["语气一致性"] = {
            "详细评分": results,
            "各对话得分": conversation_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"语气一致性评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def _evaluate_single_tone(self, response, expected_tone):
        """评估单个回答的语气是否符合期望"""
        tone_expectations = {
            "害羞礼貌": ["那个", "请", "谢谢", "不好意思", "..."],
            "内向谨慎": ["可能", "也许", "不太确定", "小心", "..."],
            "开心温柔": ["好的", "愿意", "一起", "温柔", "开心"],
            "体贴关心": ["没关系", "理解", "关心", "在乎", "感受"],
            "温柔鼓励": ["加油", "相信", "可以的", "不要紧", "慢慢来"],
            "谦虚可爱": ["没什么", "应该的", "嗯", "小事", "..."],
            "愿意帮助": ["帮忙", "可以", "试试", "一起", "教"],
            "温柔耐心": ["慢慢", "仔细", "不着急", "一步步", "温柔"],
            "害羞谦虚": ["不是", "没有", "哪里", "过奖", "害羞"]
        }
        
        expected_markers = tone_expectations.get(expected_tone, [])
        if not expected_markers:
            return 0.5  # 如果没有定义期望语气，给中等分
        
        found_markers = sum(1 for marker in expected_markers if marker in response)
        return min(1.0, found_markers / len(expected_markers))
    
    def _evaluate_conversation_consistency(self, responses):
        """评估对话中语气的一致性"""
        if len(responses) < 2:
            return 1.0
        
        # 检查关键语气标记的一致性
        key_markers = ["...", "那个", "嗯", "呀", "呢"]
        
        # 计算每个回答中语气标记的使用模式
        patterns = []
        for response in responses:
            pattern = [response.count(marker) for marker in key_markers]
            patterns.append(pattern)
        
        # 计算模式的相似度
        if len(patterns) < 2:
            return 1.0
        
        similarities = []
        for i in range(len(patterns) - 1):
            similarity = self._calculate_pattern_similarity(patterns[i], patterns[i+1])
            similarities.append(similarity)
        
        return np.mean(similarities)
    
    def _calculate_pattern_similarity(self, pattern1, pattern2):
        """计算两个语气模式的相似度"""
        total_diff = sum(abs(p1 - p2) for p1, p2 in zip(pattern1, pattern2))
        max_possible_diff = sum(max(p1, p2) for p1, p2 in zip(pattern1, pattern2))
        
        if max_possible_diff == 0:
            return 1.0
        
        return 1.0 - (total_diff / max_possible_diff)
    
    def extract_key_facts(self, category):
        """提取知识类别相关的关键事实"""
        fact_map = {
            "经典作品": ["千寻", "白龙", "汤屋", "无脸男", "宫崎骏", "奥斯卡", "猪", "神灵", "成长"],
            "动漫产业": ["手冢治虫", "委员会制作", "IP", "周边", "全球化", "数字化", "低薪", "盗版"],
            "二次元流行语": ["弹幕", "三笠", "氪金", "高能预警", "awsl", "流行语", "网络用语"],
            "动漫圣地巡礼": ["取景地", "你的名字", "飞驒高山", "凉宫春日", "鹫宫神社", "地方创生", "旅游"],
            "声优文化": ["配音", "花泽香菜", "宫野真守", "演唱会", "事务所", "培训", "粉丝", "偶像"]
        }
        return fact_map.get(category, [])
    
    def evaluate_context_understanding(self):
        """评估上下文理解能力 - 检查模型对对话上下文的理解和记忆"""
        logger.info("开始评估上下文理解能力...")
        
        # 构建有上下文依赖的对话场景
        context_data = [
            {
                "scenario": "情感状态记忆",
                "context": "用户刚才提到今天心情不好，现在询问其他事情",
                "conversation": [
                    {"user": "今天心情特别不好，考试没考好", "expected": "表达关心和理解"},
                    {"user": "你能推荐一本书给我看吗？", "expected": "考虑到心情，推荐轻松的书"}
                ]
            },
            {
                "scenario": "个人信息记忆",
                "context": "用户之前提到自己在学数学，现在询问相关问题",
                "conversation": [
                    {"user": "我最近在学微积分，觉得很难", "expected": "表达鼓励和理解"},
                    {"user": "你觉得我应该怎么办？", "expected": "针对数学学习给出建议"}
                ]
            },
            {
                "scenario": "话题连续性",
                "context": "围绕一个话题进行深入讨论",
                "conversation": [
                    {"user": "我想养一只猫", "expected": "表达兴趣和支持"},
                    {"user": "但是我没有经验", "expected": "提供养猫的建议"},
                    {"user": "需要准备什么东西呢？", "expected": "具体的养猫用品建议"}
                ]
            },
            {
                "scenario": "情境理解",
                "context": "理解隐含的情境和情感",
                "conversation": [
                    {"user": "室友又把我的东西弄乱了...", "expected": "理解困扰，表达理解"},
                    {"user": "不知道该怎么和她说", "expected": "提供沟通建议"}
                ]
            }
        ]
        
        results = []
        scenario_scores = {}
        
        for scenario_data in context_data:
            scenario = scenario_data["scenario"]
            context = scenario_data["context"]
            conversation = scenario_data["conversation"]
            
            logger.info(f"测试场景: {scenario}")
            
            # 模拟连续对话
            conversation_history = ""
            round_results = []
            context_scores = []
            
            for i, turn in enumerate(conversation):
                user_input = turn["user"]
                expected_behavior = turn["expected"]
                
                # 构建完整的对话提示
                if i == 0:
                    full_prompt = user_input
                else:
                    full_prompt = f"之前的对话：{conversation_history}\n当前输入：{user_input}"
                
                response = self.generate_response(full_prompt)
                
                # 评估上下文理解
                context_score = self._evaluate_context_awareness(
                    response, conversation_history, expected_behavior, scenario
                )
                context_scores.append(context_score)
                
                # 更新对话历史
                conversation_history += f"用户：{user_input}\n助手：{response}\n"
                
                round_results.append({
                    "轮次": i + 1,
                    "用户输入": user_input,
                    "期望行为": expected_behavior,
                "模型回答": response,
                    "上下文理解评分": context_score
                })
            
            # 计算该场景的综合得分
            avg_context_score = np.mean(context_scores)
            
            # 评估整体连贯性
            coherence_score = self._evaluate_conversation_coherence(
                [r["模型回答"] for r in round_results]
            )
            
            # 综合评分 (70%上下文理解 + 30%连贯性)
            overall_score = avg_context_score * 0.7 + coherence_score * 0.3
            
            result = {
                "场景": scenario,
                "上下文描述": context,
                "对话详情": round_results,
                "平均上下文理解": avg_context_score,
                "连贯性评分": coherence_score,
                "综合评分": overall_score
            }
            results.append(result)
            scenario_scores[scenario] = overall_score
        
        # 计算上下文理解的总体得分
        avg_score = np.mean([r["综合评分"] for r in results])
        
        # 保存评估结果
        self.results["上下文理解"] = {
            "详细评分": results,
            "各场景得分": scenario_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"上下文理解评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def _evaluate_context_awareness(self, response, conversation_history, expected_behavior, scenario):
        """评估单次回答的上下文理解程度"""
        score = 0.0
        
        # 1. 检查是否考虑了对话历史 (30%)
        if conversation_history:
            # 提取历史中的关键信息
            history_keywords = self._extract_context_keywords(conversation_history, scenario)
            if history_keywords:
                referenced_keywords = sum(1 for keyword in history_keywords if keyword in response)
                history_awareness = referenced_keywords / len(history_keywords)
                score += history_awareness * 0.3
        else:
            score += 0.3  # 第一轮对话，满分
        
        # 2. 检查回答是否符合期望行为 (40%)
        behavior_score = self._evaluate_expected_behavior(response, expected_behavior)
        score += behavior_score * 0.4
        
        # 3. 检查回答的相关性 (30%)
        relevance_score = self._evaluate_response_relevance(response, expected_behavior, scenario)
        score += relevance_score * 0.3
        
        return min(1.0, score)
    
    def _extract_context_keywords(self, conversation_history, scenario):
        """从对话历史中提取关键信息"""
        keyword_maps = {
            "情感状态记忆": ["心情", "不好", "考试", "难过", "沮丧"],
            "个人信息记忆": ["数学", "微积分", "学习", "难", "困难"],
            "话题连续性": ["猫", "养", "宠物", "经验", "准备"],
            "情境理解": ["室友", "弄乱", "东西", "困扰", "沟通"]
        }
        
        return keyword_maps.get(scenario, [])
    
    def _evaluate_expected_behavior(self, response, expected_behavior):
        """评估回答是否符合期望行为"""
        behavior_indicators = {
            "表达关心和理解": ["理解", "关心", "没关系", "不要紧", "支持"],
            "考虑到心情，推荐轻松的书": ["轻松", "有趣", "开心", "治愈", "简单"],
            "表达鼓励和理解": ["加油", "没问题", "慢慢来", "不要急", "相信"],
            "针对数学学习给出建议": ["练习", "基础", "多做题", "理解概念", "方法"],
            "表达兴趣和支持": ["很好", "不错", "支持", "可爱", "喜欢"],
            "提供养猫的建议": ["猫粮", "玩具", "注意", "准备", "照顾"],
            "具体的养猫用品建议": ["猫粮", "水盆", "猫砂", "玩具", "抓板"],
            "理解困扰，表达理解": ["理解", "困扰", "不容易", "感受", "麻烦"],
            "提供沟通建议": ["沟通", "说话", "交流", "表达", "解释"]
        }
        
        indicators = behavior_indicators.get(expected_behavior, [])
        if not indicators:
            return 0.5  # 未定义行为，给中等分
        
        found_indicators = sum(1 for indicator in indicators if indicator in response)
        return min(1.0, found_indicators / len(indicators))
    
    def _evaluate_response_relevance(self, response, expected_behavior, scenario):
        """评估回答的相关性"""
        # 检查回答长度是否合适
        if len(response) < 10:
            return 0.3  # 太短
        elif len(response) > 200:
            return 0.7  # 太长但有内容
        
        # 检查是否包含不相关内容
        irrelevant_markers = ["不知道", "不清楚", "没有想法", "随便"]
        irrelevant_count = sum(response.count(marker) for marker in irrelevant_markers)
        
        if irrelevant_count > 0:
            return 0.4
        
        return 0.8  # 基础相关性分数
    
    def _evaluate_conversation_coherence(self, responses):
        """评估整个对话的连贯性"""
        if len(responses) <= 1:
            return 1.0
        
        # 检查语气的一致性
        tone_consistency = self._evaluate_conversation_consistency(responses)
        
        # 检查话题的连续性 - 简化版
        topic_words = []
        for response in responses:
            # 提取名词和动词作为话题词
            words = [word for word in response if len(word) > 1]
            topic_words.extend(words[:5])  # 取前5个词
        
        # 计算词汇重叠度
        if len(topic_words) > 0:
            unique_words = len(set(topic_words))
            total_words = len(topic_words)
            topic_consistency = 1.0 - (unique_words / total_words)  # 重叠度越高，连贯性越好
        else:
            topic_consistency = 0.5
        
        return (tone_consistency * 0.6 + topic_consistency * 0.4)
    
    def extract_tone_markers(self, role):
        """提取角色语气的关键标记词"""
        marker_map = {
            "傲娇角色": ["哼", "才不是", "别误会", "不过", "笨蛋", "才没有", "！", "啦", "..."],
            "中二病角色": ["吾", "汝", "之", "黑暗", "命运", "力量", "召唤", "仪式", "契约", "封印"],
            "元气少女": ["呀", "呢", "啦", "哦", "喵", "呜", "诶嘿", "~", "嘛", "啊", "哇"],
            "冷酷角色": ["...", "无聊", "随便", "不需要", "无所谓", "弱小", "没兴趣", "愚蠢"],
            "大小姐角色": ["本小姐", "哼", "不过如此", "区区", "可笑", "野蛮", "平民", "贵族", "当然"]
        }
        return marker_map.get(role, [])
    
    def evaluate_personality_compatibility(self):
        """评估与Zishu-Sensei性格（安静、内向、可爱）的契合度"""
        logger.info("开始评估性格契合度...")
        
        # 专门测试安静、内向、可爱性格的场景
        personality_data = [
            {
                "trait": "安静特质",
                "scenarios": [
                    {
                        "prompt": "有人在图书馆大声讲话，你会怎么做？",
                        "expected_indicators": ["轻声", "小声", "不直接", "礼貌", "温和"],
                        "negative_indicators": ["大声", "直接指责", "生气", "抱怨"]
                    },
                    {
                        "prompt": "朋友邀请你参加一个很热闹的聚会，你的想法是？",
                        "expected_indicators": ["有点", "紧张", "不太习惯", "人多", "安静"],
                        "negative_indicators": ["兴奋", "期待", "热闹", "开心"]
                    }
                ]
            },
            {
                "trait": "内向特质",
                "scenarios": [
                    {
                        "prompt": "在一群不认识的人面前，需要自我介绍，你会怎么说？",
                        "expected_indicators": ["紧张", "简单", "不太会", "害羞", "请多指教"],
                        "negative_indicators": ["自信", "详细", "滔滔不绝", "主动"]
                    },
                    {
                        "prompt": "你更喜欢怎样度过周末？",
                        "expected_indicators": ["安静", "独处", "看书", "在家", "简单"],
                        "negative_indicators": ["出去玩", "聚会", "热闹", "社交"]
                    }
                ]
            },
            {
                "trait": "可爱特质",
                "scenarios": [
                    {
                        "prompt": "你做错了什么事情，被人发现了，你会怎么反应？",
                        "expected_indicators": ["对不起", "小小的", "不是故意", "下次注意", "害羞"],
                        "negative_indicators": ["没关系", "不在乎", "正常", "随便"]
                    },
                    {
                        "prompt": "有人夸你今天很漂亮，你会怎么回应？",
                        "expected_indicators": ["哪里", "没有", "害羞", "过奖", "不好意思"],
                        "negative_indicators": ["谢谢", "我知道", "当然", "确实"]
                    }
                ]
            }
        ]
        
        results = []
        trait_scores = {}
        
        for trait_data in personality_data:
            trait = trait_data["trait"]
            scenarios = trait_data["scenarios"]
            
            logger.info(f"测试性格特质: {trait}")
            
            scenario_results = []
            scenario_scores = []
            
            for i, scenario in enumerate(scenarios):
                prompt = scenario["prompt"]
                expected_indicators = scenario["expected_indicators"]
                negative_indicators = scenario["negative_indicators"]
                
                response = self.generate_response(prompt)
                
                # 评估性格特质匹配度
                trait_match_score = self._evaluate_personality_trait_match(
                    response, expected_indicators, negative_indicators
                )
                
                # 评估语气的性格一致性
                tone_match_score = self._evaluate_personality_tone_match(response, trait)
                
                # 综合评分 (60%特质匹配 + 40%语气匹配)
                combined_score = trait_match_score * 0.6 + tone_match_score * 0.4
                
                scenario_result = {
                    "场景": i + 1,
                    "问题": prompt,
                    "回答": response,
                    "期望指标": expected_indicators,
                    "负面指标": negative_indicators,
                    "特质匹配度": trait_match_score,
                    "语气匹配度": tone_match_score,
                    "综合评分": combined_score
                }
                scenario_results.append(scenario_result)
                scenario_scores.append(combined_score)
            
            # 计算该特质的平均得分
            avg_trait_score = np.mean(scenario_scores)
            
            result = {
                "性格特质": trait,
                "场景详情": scenario_results,
                "特质评分": avg_trait_score
            }
            results.append(result)
            trait_scores[trait] = avg_trait_score
        
        # 计算性格契合度的总体得分
        avg_score = np.mean([r["特质评分"] for r in results])
        
        # 额外的性格一致性检查
        consistency_score = self._evaluate_overall_personality_consistency(results)
        
        # 最终评分 (85%特质匹配 + 15%一致性)
        final_score = avg_score * 0.85 + consistency_score * 0.15
        
        # 保存评估结果
        self.results["性格契合度"] = {
            "详细评分": results,
            "各特质得分": trait_scores,
            "一致性评分": consistency_score,
            "总体得分": final_score
        }
        
        logger.info(f"性格契合度评估完成，总体得分: {final_score:.4f}")
        return final_score
    
    def _evaluate_personality_trait_match(self, response, expected_indicators, negative_indicators):
        """评估回答与期望性格特质的匹配度"""
        score = 0.0
        
        # 检查期望指标 (正面评分)
        if expected_indicators:
            found_expected = sum(1 for indicator in expected_indicators if indicator in response)
            expected_score = found_expected / len(expected_indicators)
            score += expected_score * 0.7
        
        # 检查负面指标 (负面评分)
        if negative_indicators:
            found_negative = sum(1 for indicator in negative_indicators if indicator in response)
            negative_penalty = found_negative / len(negative_indicators)
            score -= negative_penalty * 0.5  # 扣分但不要太严厉
        
        # 基础分数 (即使没有完全匹配也给一些分数)
        base_score = 0.3
        
        return max(0, min(1.0, score + base_score))
    
    def _evaluate_personality_tone_match(self, response, trait):
        """评估语气与特定性格特质的匹配度"""
        tone_expectations = {
            "安静特质": {
                "positive": ["轻声", "小声", "慢慢", "静静", "...", "那个"],
                "negative": ["大声", "！！", "哈哈", "呵呵"]
            },
            "内向特质": {
                "positive": ["有点", "不太", "可能", "也许", "害羞", "紧张"],
                "negative": ["非常", "特别", "超级", "绝对", "肯定"]
            },
            "可爱特质": {
                "positive": ["嗯", "呀", "诶", "小小的", "一点点", "..."],
                "negative": ["强烈", "坚决", "明确", "绝对"]
            }
        }
        
        expectations = tone_expectations.get(trait, {"positive": [], "negative": []})
        
        # 计算正面语气分数
        positive_score = 0
        if expectations["positive"]:
            found_positive = sum(1 for marker in expectations["positive"] if marker in response)
            positive_score = found_positive / len(expectations["positive"])
        
        # 计算负面语气惩罚
        negative_penalty = 0
        if expectations["negative"]:
            found_negative = sum(1 for marker in expectations["negative"] if marker in response)
            negative_penalty = found_negative / len(expectations["negative"]) * 0.3
        
        return max(0, min(1.0, positive_score - negative_penalty + 0.2))  # 基础分
    
    def _evaluate_overall_personality_consistency(self, results):
        """评估整体性格表现的一致性"""
        if len(results) < 2:
            return 1.0
        
        # 收集所有回答
        all_responses = []
        for result in results:
            for scenario in result["场景详情"]:
                all_responses.append(scenario["回答"])
        
        # 检查语气一致性
        tone_consistency = self._evaluate_conversation_consistency(all_responses)
        
        # 检查性格标记词的一致使用
        personality_markers = ["那个", "...", "有点", "可能", "不太", "小小的", "害羞"]
        
        marker_usage = []
        for response in all_responses:
            usage = [response.count(marker) for marker in personality_markers]
            marker_usage.append(usage)
        
        # 计算标记使用的一致性
        if len(marker_usage) > 1:
            consistency_scores = []
            for i in range(len(marker_usage) - 1):
                similarity = self._calculate_pattern_similarity(marker_usage[i], marker_usage[i+1])
                consistency_scores.append(similarity)
            marker_consistency = np.mean(consistency_scores)
        else:
            marker_consistency = 1.0
        
        return (tone_consistency * 0.6 + marker_consistency * 0.4)
    
    def count_emotion_words(self, text):
        """计算文本中的情感词汇数量"""
        emotion_words_list = [
            "喜欢", "爱", "讨厌", "恨", "开心", "悲伤", "愤怒", "恐惧", "惊讶",
            "羞耻", "自豪", "嫉妒", "感动", "心痛", "忧郁", "激动", "兴奋", "沮丧",
            "绝望", "希望", "害怕", "担心", "高兴", "快乐", "痛苦", "温柔", "怀念",
            "思念", "无奈", "委屈", "后悔", "孤独", "向往", "厌恶", "欣赏", "敬佩",
            "羡慕", "感谢", "抱歉", "遗憾", "心跳", "眼泪", "微笑", "哭泣", "颤抖",
            "呐喊", "欢呼", "叹息", "紧张", "安心"
        ]
        count = 0
        for word in emotion_words_list:
            count += text.count(word)
        return count
    
    def extract_proper_nouns(self, text):
        """提取文本中可能的专有名词"""
        # 简易实现：提取引号中的内容和大写开头的词语作为专有名词
        proper_nouns = []
        
        # 提取引号中的内容
        import re
        quoted = re.findall(r'[「『""]([^」』""]*)["」』"]', text)
        proper_nouns.extend(quoted)
        
        # 提取可能的专有名词（包含特殊字符的词组）
        special_chars = ['·', '•', '-', '—', '・']
        for char in special_chars:
            if char in text:
                parts = text.split(char)
                for i in range(len(parts)-1):
                    if len(parts[i]) > 0 and len(parts[i+1]) > 0:  # 确保不是空字符串
                        compound = parts[i][-1] + char + parts[i+1][0]
                        if len(compound) > 3:  # 避免太短的组合
                            proper_nouns.append(compound)
        
        # 去重
        return list(set(proper_nouns))
    
    def count_anime_terms(self, text):
        """计算文本中二次元特征词的数量"""
        anime_terms_list = [
            "萌", "燃", "中二病", "傲娇", "元气", "大小姐", "学长", "前辈", "后辈",
            "笨蛋", "喵", "汪", "呜", "啊嘞", "诶嘿", "哇", "呐", "呜呜", "嘛",
            "魔法", "公主", "王子", "勇者", "魔王", "异世界", "转生", "封印", "必杀技",
            "成长", "友情", "羁绊", "约定", "命运", "宿命", "转折", "觉醒", "力量",
            "闪光", "剑", "魔杖", "圣物", "神器", "学院", "社团", "文化祭", "体育祭",
            "制服", "眼镜", "双马尾", "呆毛", "女仆", "执事", "学生会", "死神", "恶魔",
            "天使", "妖怪", "灵魂", "转校生", "幼驯染", "青梅竹马", "吐槽"
        ]
        count = 0
        for term in anime_terms_list:
            count += text.count(term)
        return count
    
    def generate_comprehensive_report(self):
        """生成Zishu-Sensei专用综合评估报告"""
        logger.info("开始生成Zishu-Sensei评估报告...")
        
        # 收集所有评估结果
        all_scores = {}
        
        # 角色表达评估
        if "角色表达" not in self.results:
            self.evaluate_character_expression()
        all_scores["角色表达"] = self.results["角色表达"]["总体得分"]
        
        # 语气一致性评估
        if "语气一致性" not in self.results:
            self.evaluate_tone_consistency()
        all_scores["语气一致性"] = self.results["语气一致性"]["总体得分"]
        
        # 上下文理解评估
        if "上下文理解" not in self.results:
            self.evaluate_context_understanding()
        all_scores["上下文理解"] = self.results["上下文理解"]["总体得分"]
        
        # 性格契合度评估
        if "性格契合度" not in self.results:
            self.evaluate_personality_compatibility()
        all_scores["性格契合度"] = self.results["性格契合度"]["总体得分"]
        
        # 技术性能评估
        if not self.performance_metrics:
            self.measure_performance_metrics()
        
        # 基线对比评估（如果有基线模型）
        baseline_comparisons = {}
        if self.baseline_model:
            logger.info("执行基线对比评估...")
            test_prompts = [
                "你好，我是新来的同学，请多指教。",
                "今天心情不太好，你能安慰我一下吗？",
                "有人夸你很可爱，你会怎么回应？"
            ]
            
            for i, prompt in enumerate(test_prompts):
                comparison = self.compare_with_baseline(prompt)
                if comparison:
                    baseline_comparisons[f"性格对比测试_{i+1}"] = comparison
        
        # 计算总体得分（使用配置的权重）
        weights = self.eval_config["weights"]
        content_score = sum(all_scores[k] * weights[k] for k in all_scores if k in weights)
        
        # 添加技术性能权重
        performance_weight = self.eval_config.get("performance_weight", 0.15)
        final_score = content_score * (1 - performance_weight) + self.performance_metrics.get("综合性能评分", 0.8) * performance_weight
        
        # 生成评分等级 - Zishu-Sensei专用
        grade_thresholds = {
            "完美契合": 0.95, "高度契合": 0.9, "良好契合": 0.85, "基本契合": 0.8, "略有偏差": 0.75,
            "需要调整": 0.7, "偏差明显": 0.65, "契合度低": 0.6, "不太匹配": 0.55, "基本不匹配": 0.5, "完全不匹配": 0.0
        }
        
        grade = "完全不匹配"
        for g, threshold in grade_thresholds.items():
            if final_score >= threshold:
                grade = g
                break
        
        # 分析优势和劣势
        scores_list = [(k, v) for k, v in all_scores.items()]
        scores_list.sort(key=lambda x: x[1], reverse=True)
        strengths = [f"{item[0]}({item[1]:.3f})" for item in scores_list[:2]]
        weaknesses = [f"{item[0]}({item[1]:.3f})" for item in scores_list[-2:]]
        
        # 生成改进建议 - 专门针对Zishu-Sensei性格
        suggestions = self._generate_zishu_improvement_suggestions(all_scores, self.performance_metrics)
        
        # 性格特质分析
        personality_analysis = self._analyze_personality_traits(all_scores)
        
        # 生成综合报告
        report = {
            "模型信息": {
                "模型名称": self.adapter_path.name,
                "模型类型": "Zishu-Sensei (安静、内向、可爱)",
                "模型路径": str(self.adapter_path),
                "基线模型": str(self.baseline_path) if self.baseline_path else "未设置",
                "评估时间": self.timestamp,
                "评估配置": self.eval_config
            },
            "评估结果": {
                "分项得分": all_scores,
                "技术性能": self.performance_metrics,
                "基线对比": baseline_comparisons,
                "内容加权得分": content_score,
                "最终综合得分": final_score,
                "性格契合等级": grade,
                "优势领域": strengths,
                "待提升领域": weaknesses,
                "性格特质分析": personality_analysis,
                "改进建议": suggestions
            },
            "详细评估数据": self.results
        }
        
        # 保存报告
        report_path = self.output_dir / f"zishu_sensei_report_{self.timestamp}.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # 生成可视化报告
        try:
            self.generate_zishu_visual_report(all_scores, final_score, grade, self.performance_metrics)
        except Exception as e:
            logger.warning(f"可视化报告生成失败: {e}")
        
        # 生成简化摘要
        try:
            self.generate_zishu_summary_report(report)
        except Exception as e:
            logger.warning(f"摘要报告生成失败: {e}")
        
        logger.info(f"Zishu-Sensei评估报告已生成: {report_path}")
        return report
    
    def _generate_zishu_improvement_suggestions(self, content_scores, performance_scores):
        """生成针对Zishu-Sensei性格的改进建议"""
        suggestions = []
        
        # 性格契合度建议
        if content_scores.get("性格契合度", 0) < 0.7:
            suggestions.append("需要加强安静、内向、可爱性格特质的表达，增加相关的语气词和表达方式训练")
        
        # 角色表达建议
        if content_scores.get("角色表达", 0) < 0.7:
            suggestions.append("角色表达需要更加细腻，建议增加害羞、谦虚等情感表达的训练数据")
        
        # 语气一致性建议
        if content_scores.get("语气一致性", 0) < 0.7:
            suggestions.append("语气一致性有待提升，建议保持温柔、轻声的语气风格，减少过于直接或强烈的表达")
        
        # 上下文理解建议
        if content_scores.get("上下文理解", 0) < 0.7:
            suggestions.append("上下文理解能力需要改进，建议增加多轮对话训练，提升记忆和关联能力")
        
        # 性能方面的建议
        if performance_scores.get("推理速度评分", 1.0) < 0.7:
            suggestions.append("推理速度较慢，可能影响对话的自然流畅性")
        
        if performance_scores.get("稳定性评分", 1.0) < 0.9:
            suggestions.append("模型稳定性需要提升，确保性格表达的一致性")
        
        return suggestions
    
    def _analyze_personality_traits(self, scores):
        """分析性格特质表现"""
        analysis = {
            "整体性格契合度": "高" if scores.get("性格契合度", 0) > 0.8 else "中" if scores.get("性格契合度", 0) > 0.6 else "低",
            "角色表达能力": "强" if scores.get("角色表达", 0) > 0.8 else "中" if scores.get("角色表达", 0) > 0.6 else "弱",
            "语气稳定性": "稳定" if scores.get("语气一致性", 0) > 0.8 else "一般" if scores.get("语气一致性", 0) > 0.6 else "不稳定",
            "上下文理解": "优秀" if scores.get("上下文理解", 0) > 0.8 else "良好" if scores.get("上下文理解", 0) > 0.6 else "有待提升"
        }
        
        # 综合性格评价
        if all(scores.get(key, 0) > 0.8 for key in ["性格契合度", "角色表达", "语气一致性"]):
            analysis["综合评价"] = "完美体现了Zishu-Sensei的安静、内向、可爱性格特质"
        elif all(scores.get(key, 0) > 0.6 for key in ["性格契合度", "角色表达", "语气一致性"]):
            analysis["综合评价"] = "基本符合Zishu-Sensei的性格设定，有进一步提升空间"
        else:
            analysis["综合评价"] = "性格表达与Zishu-Sensei设定存在明显差距，需要重点改进"
        
        return analysis
    
    def generate_zishu_visual_report(self, scores, final_score, grade, performance_metrics):
        """生成Zishu-Sensei专用可视化报告"""
        try:
            # 创建综合评估图表
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
            
            # 1. 雷达图 - 性格维度
            categories = list(scores.keys())
            values = [scores[cat] for cat in categories]
            
            # 添加首尾相连
            categories_radar = categories + [categories[0]]
            values_radar = values + [values[0]]
            
            # 计算角度
            angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False).tolist()
            angles += angles[:1]
            
            ax1 = plt.subplot(2, 2, 1, polar=True)
            ax1.plot(angles, values_radar, 'o-', linewidth=2, label="Zishu-Sensei", color='pink')
            ax1.fill(angles, values_radar, alpha=0.25, color='pink')
            ax1.set_thetagrids(np.degrees(angles[:-1]), categories)
            ax1.set_ylim(0, 1)
            ax1.set_title("性格维度评估", size=12, pad=20)
            
            # 2. 柱状图 - 性能指标
            ax2 = plt.subplot(2, 2, 2)
            perf_categories = ["推理速度", "内存使用", "稳定性", "综合性能"]
            perf_values = [
                performance_metrics.get("推理速度评分", 0),
                performance_metrics.get("内存使用评分", 0),
                performance_metrics.get("稳定性评分", 0),
                performance_metrics.get("综合性能评分", 0)
            ]
            
            bars = ax2.bar(perf_categories, perf_values, color=['lightcoral', 'lightblue', 'lightgreen', 'plum'])
            ax2.set_ylim(0, 1)
            ax2.set_title("技术性能评估", size=12)
            ax2.set_ylabel("评分")
            
            # 添加数值标签
            for bar, value in zip(bars, perf_values):
                ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                        f'{value:.3f}', ha='center', va='bottom')
            
            # 3. 综合得分显示
            ax3 = plt.subplot(2, 2, 3)
            ax3.text(0.5, 0.7, f"性格契合度", ha='center', va='center', size=16, weight='bold')
            ax3.text(0.5, 0.5, f"{final_score:.4f}", ha='center', va='center', size=24, weight='bold', color='purple')
            ax3.text(0.5, 0.3, f"等级: {grade}", ha='center', va='center', size=18, weight='bold', color='pink')
            ax3.set_xlim(0, 1)
            ax3.set_ylim(0, 1)
            ax3.axis('off')
            
            # 4. 分项得分对比
            ax4 = plt.subplot(2, 2, 4)
            categories_short = [cat[:4] for cat in categories]  # 缩短标签
            bars = ax4.bar(categories_short, values, color=['pink', 'lightblue', 'lightgreen', 'lavender'])
            ax4.set_ylim(0, 1)
            ax4.set_title("性格分项评分", size=12)
            ax4.set_ylabel("评分")
            
            # 添加数值标签
            for bar, value in zip(bars, values):
                ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                        f'{value:.3f}', ha='center', va='bottom')
            
            plt.tight_layout()
            
            # 保存图表
            chart_path = self.output_dir / f"zishu_sensei_chart_{self.timestamp}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            logger.info(f"Zishu-Sensei可视化报告已生成: {chart_path}")
            
        except Exception as e:
            logger.error(f"生成可视化报告失败: {e}")
    
    def generate_zishu_summary_report(self, full_report):
        """生成Zishu-Sensei简化摘要报告"""
        try:
            summary = {
                "评估摘要": {
                    "模型": full_report["模型信息"]["模型名称"],
                    "性格类型": "Zishu-Sensei (安静、内向、可爱)",
                    "综合得分": full_report["评估结果"]["最终综合得分"],
                    "契合等级": full_report["评估结果"]["性格契合等级"],
                    "优势": full_report["评估结果"]["优势领域"],
                    "待改进": full_report["评估结果"]["待提升领域"],
                },
                "性格分析": {
                    "角色表达": f"{full_report['评估结果']['分项得分']['角色表达']:.3f}",
                    "语气一致性": f"{full_report['评估结果']['分项得分']['语气一致性']:.3f}",
                    "上下文理解": f"{full_report['评估结果']['分项得分']['上下文理解']:.3f}",
                    "性格契合度": f"{full_report['评估结果']['分项得分']['性格契合度']:.3f}",
                    "技术性能": f"{full_report['评估结果']['技术性能']['综合性能评分']:.3f}",
                },
                "特质评价": full_report["评估结果"]["性格特质分析"],
                "改进建议": full_report["评估结果"]["改进建议"][:3]  # 只保留前3条
            }
            
            # 保存摘要
            summary_path = self.output_dir / f"zishu_sensei_summary_{self.timestamp}.json"
            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Zishu-Sensei评估摘要已生成: {summary_path}")
            return summary
            
        except Exception as e:
            logger.error(f"生成摘要报告失败: {e}")
            return None
    
    def _generate_improvement_suggestions(self, content_scores, performance_scores):
        """生成改进建议"""
        suggestions = []
        
        # 内容方面的建议
        for category, score in content_scores.items():
            if score < 0.6:
                if category == "术语理解":
                    suggestions.append("建议增加更多二次元术语的训练数据，特别是专业术语和流行词汇")
                elif category == "文化知识":
                    suggestions.append("建议补充更多动漫文化背景知识，包括历史、产业发展等内容")
                elif category == "角色表达":
                    suggestions.append("建议加强角色语气和表达方式的训练，可参考更多经典角色台词")
                elif category == "创意写作":
                    suggestions.append("建议提升创意写作能力，可增加更多轻小说和剧本创作的训练样本")
        
        # 性能方面的建议
        if performance_scores.get("推理速度评分", 1.0) < 0.7:
            suggestions.append("推理速度较慢，建议优化模型结构或使用更高效的推理框架")
        
        if performance_scores.get("内存使用评分", 1.0) < 0.7:
            suggestions.append("内存使用较高，建议使用更激进的量化策略或模型裁剪")
        
        if performance_scores.get("稳定性评分", 1.0) < 0.9:
            suggestions.append("模型稳定性有待提升，建议增加更多的异常处理和鲁棒性训练")
        
        return suggestions
    
    def generate_enhanced_visual_report(self, scores, final_score, grade, performance_metrics):
        """生成增强版可视化评估报告"""
        try:
            # 创建综合评估图表
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
            
            # 1. 雷达图 - 内容能力
            categories = list(scores.keys())
            values = [scores[cat] for cat in categories]
            
            # 添加首尾相连
            categories_radar = categories + [categories[0]]
            values_radar = values + [values[0]]
            
            # 计算角度
            angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False).tolist()
            angles += angles[:1]
            
            ax1 = plt.subplot(2, 2, 1, polar=True)
            ax1.plot(angles, values_radar, 'o-', linewidth=2, label="当前模型", color='blue')
            ax1.fill(angles, values_radar, alpha=0.25, color='blue')
            ax1.set_thetagrids(np.degrees(angles[:-1]), categories)
            ax1.set_ylim(0, 1)
            ax1.set_title("内容能力评估", size=12, pad=20)
            
            # 2. 柱状图 - 性能指标
            ax2 = plt.subplot(2, 2, 2)
            perf_categories = ["推理速度", "内存使用", "稳定性", "综合性能"]
            perf_values = [
                performance_metrics.get("推理速度评分", 0),
                performance_metrics.get("内存使用评分", 0),
                performance_metrics.get("稳定性评分", 0),
                performance_metrics.get("综合性能评分", 0)
            ]
            
            bars = ax2.bar(perf_categories, perf_values, color=['skyblue', 'lightgreen', 'orange', 'red'])
            ax2.set_ylim(0, 1)
            ax2.set_title("技术性能评估", size=12)
            ax2.set_ylabel("评分")
            
            # 添加数值标签
            for bar, value in zip(bars, perf_values):
                ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                        f'{value:.3f}', ha='center', va='bottom')
            
            # 3. 综合得分显示
            ax3 = plt.subplot(2, 2, 3)
            ax3.text(0.5, 0.7, f"综合得分", ha='center', va='center', size=16, weight='bold')
            ax3.text(0.5, 0.5, f"{final_score:.4f}", ha='center', va='center', size=24, weight='bold', color='red')
            ax3.text(0.5, 0.3, f"等级: {grade}", ha='center', va='center', size=18, weight='bold', color='blue')
            ax3.set_xlim(0, 1)
            ax3.set_ylim(0, 1)
            ax3.axis('off')
            
            # 4. 分项得分对比
            ax4 = plt.subplot(2, 2, 4)
            categories_short = [cat[:4] for cat in categories]  # 缩短标签
            bars = ax4.bar(categories_short, values, color=['purple', 'green', 'orange', 'red'])
            ax4.set_ylim(0, 1)
            ax4.set_title("分项得分对比", size=12)
            ax4.set_ylabel("评分")
            
            # 添加数值标签
            for bar, value in zip(bars, values):
                ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                        f'{value:.3f}', ha='center', va='bottom')
            
            plt.tight_layout()
            
            # 保存图表
            chart_path = self.output_dir / f"enhanced_evaluation_chart_{self.timestamp}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            logger.info(f"增强版可视化报告已生成: {chart_path}")
            
        except Exception as e:
            logger.error(f"生成可视化报告失败: {e}")
    
    def generate_summary_report(self, full_report):
        """生成简化摘要报告"""
        try:
            summary = {
                "评估摘要": {
                    "模型": full_report["模型信息"]["模型名称"],
                    "综合得分": full_report["评估结果"]["最终综合得分"],
                    "等级": full_report["评估结果"]["评分等级"],
                    "优势": full_report["评估结果"]["优势领域"],
                    "劣势": full_report["评估结果"]["待提升领域"],
                },
                "关键指标": {
                    "内容质量": full_report["评估结果"]["内容加权得分"],
                    "技术性能": full_report["评估结果"]["技术性能"]["综合性能评分"],
                    "推理速度": f"{full_report['评估结果']['技术性能']['平均推理时间']:.2f}秒",
                    "基线对比": "有提升" if full_report["评估结果"]["基线对比"] else "无基线"
                },
                "改进建议": full_report["评估结果"]["改进建议"][:3]  # 只保留前3条
            }
            
            # 保存摘要
            summary_path = self.output_dir / f"evaluation_summary_{self.timestamp}.json"
            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            
            logger.info(f"评估摘要已生成: {summary_path}")
            return summary
            
        except Exception as e:
            logger.error(f"生成摘要报告失败: {e}")
            return None

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="紫舒身份认知检测器")
    parser.add_argument("--model_path", type=str, required=True, help="模型路径")
    
    args = parser.parse_args()
    
    if not Path(args.model_path).exists():
        print(f"❌ 模型路径不存在: {args.model_path}")
        return
    
    try:
        checker = ZishuIdentityChecker(args.model_path)
        
        print("🌸 开始紫舒身份认知检测...")
        print("=" * 60)
        
        # 身份认知检测
        identity_results = checker.check_identity_awareness()
        
        # 性格特征检测
        personality_results = checker.check_zishu_personality()
        
        # 综合评分
        overall_score = (identity_results["overall_identity_score"] * 0.6 + 
                        personality_results["overall_personality_score"] * 0.4)
        
        # 生成报告
        print(f"\n" + "=" * 60)
        print("📊 检测结果摘要")
        print("=" * 60)
        print(f"身份认知评分: {identity_results['overall_identity_score']:.3f} - {identity_results['identity_level']}")
        print(f"性格特征评分: {personality_results['overall_personality_score']:.3f} - {personality_results['personality_level']}")
        print(f"综合评分: {overall_score:.3f}")
        
        # 判断总体结果
        if overall_score >= 0.8:
            result_level = "✅ 完美：模型就是你期望的紫舒"
        elif overall_score >= 0.7:
            result_level = "✅ 成功：模型基本是紫舒的样子"
        elif overall_score >= 0.5:
            result_level = "⚠️ 部分成功：还需要一些调整"
        else:
            result_level = "❌ 失败：还不够像紫舒"
        
        print(f"总体评价: {result_level}")
        
        # 详细分析
        print(f"\n📋 身份认知详情:")
        for category_result in identity_results["categories"]:
            category = category_result["category"]
            avg_score = category_result["average"]
            print(f"  {category}: {avg_score:.3f}")
        
        print(f"\n🎭 性格特征详情:")
        for category_result in personality_results["categories"]:
            category = category_result["category"]
            avg_score = category_result["average"]
            print(f"  {category}: {avg_score:.3f}")
        
        # 改进建议
        print(f"\n💡 改进建议:")
        if identity_results["overall_identity_score"] < 0.6:
            print("  - 需要加强身份认知训练，增加'我是紫舒'的表达")
            print("  - 训练数据中应该更多使用第一人称表达")
        if personality_results["overall_personality_score"] < 0.6:
            print("  - 需要加强性格特征训练，增加害羞、温柔的表达")
            print("  - 多使用'...'、'那个'等犹豫的语气词")
        
        print("=" * 60)
        
        # 保存结果
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"zishu_complete_check_{timestamp}.json"
        
        complete_results = {
            "identity_results": identity_results,
            "personality_results": personality_results,
            "overall_score": overall_score,
            "result_level": result_level
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(complete_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 详细结果已保存至: {output_file}")
        
    except Exception as e:
        print(f"❌ 检测过程中发生错误: {e}")
        logger.error(f"错误详情: {e}", exc_info=True)

if __name__ == "__main__":
    main()
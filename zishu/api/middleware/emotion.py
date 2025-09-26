"""
情绪处理中间件
提供智能情绪分析、情绪转换、情绪记忆和情绪响应生成功能
"""

import re
import json
import yaml
import pathlib
import time
import asyncio
from typing import Dict, List, Optional, Tuple, Any, Union, Callable, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from abc import ABC, abstractmethod
from collections import defaultdict, deque
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from zishu.api.schemas.chat import EmotionType, Message, CharacterConfig
from zishu.api.dependencies import get_dependencies, get_logger


class EmotionIntensity(str, Enum):
    """情绪强度枚举"""
    VERY_LOW = "very_low"      # 0.0-0.2
    LOW = "low"                # 0.2-0.4
    MEDIUM = "medium"          # 0.4-0.6
    HIGH = "high"              # 0.6-0.8
    VERY_HIGH = "very_high"    # 0.8-1.0


class EmotionContext(str, Enum):
    """情绪上下文枚举"""
    GREETING = "greeting"
    FAREWELL = "farewell"
    QUESTION = "question"
    COMPLIMENT = "compliment"
    COMPLAINT = "complaint"
    CASUAL_CHAT = "casual_chat"
    HELP_REQUEST = "help_request"
    EMOTIONAL_SUPPORT = "emotional_support"


@dataclass
class EmotionState:
    """情绪状态数据类"""
    emotion: EmotionType
    intensity: float = 0.5
    confidence: float = 0.8
    timestamp: datetime = field(default_factory=datetime.now)
    context: Optional[EmotionContext] = None
    triggers: List[str] = field(default_factory=list)
    duration: Optional[float] = None  # 持续时间(秒)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "emotion": self.emotion,
            "intensity": self.intensity,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "context": self.context,
            "triggers": self.triggers,
            "duration": self.duration
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EmotionState':
        """从字典创建"""
        data = data.copy()
        if 'timestamp' in data:
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)


@dataclass
class EmotionMemory:
    """情绪记忆数据类"""
    user_id: str
    short_term: deque = field(default_factory=lambda: deque(maxlen=10))  # 短期记忆
    long_term: List[EmotionState] = field(default_factory=list)  # 长期记忆
    patterns: Dict[str, float] = field(default_factory=dict)  # 情绪模式
    last_update: datetime = field(default_factory=datetime.now)
    
    def add_emotion(self, emotion_state: EmotionState):
        """添加情绪记忆"""
        self.short_term.append(emotion_state)
        
        # 高强度情绪或重要情绪添加到长期记忆
        if emotion_state.intensity > 0.7 or emotion_state.emotion in [
            EmotionType.HAPPY, EmotionType.SAD, EmotionType.ANGRY
        ]:
            self.long_term.append(emotion_state)
            
        # 更新情绪模式
        emotion_key = emotion_state.emotion
        self.patterns[emotion_key] = self.patterns.get(emotion_key, 0) + 1
        
        self.last_update = datetime.now()
    
    def get_recent_emotions(self, minutes: int = 5) -> List[EmotionState]:
        """获取最近的情绪"""
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        return [e for e in self.short_term if e.timestamp > cutoff_time]
    
    def get_dominant_emotion(self) -> Optional[EmotionType]:
        """获取主导情绪"""
        if not self.patterns:
            return None
        return max(self.patterns, key=self.patterns.get)


class EmotionAnalyzer(ABC):
    """情绪分析器抽象基类"""
    
    @abstractmethod
    async def analyze(self, text: str, context: Optional[Dict] = None) -> EmotionState:
        """分析文本情绪"""
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """获取分析器名称"""
        pass


class RuleBasedEmotionAnalyzer(EmotionAnalyzer):
    """基于规则的情绪分析器"""
    
    def __init__(self, custom_patterns: Dict = None):
        # 默认情绪模式（仅作为情绪分析适配器的备用方案）
        self.default_patterns = {
            EmotionType.HAPPY: {
                'keywords': ['开心', '高兴', '快乐', '哈哈', '棒', '好的', '太好了', '爱你'],
                'patterns': [r'哈+', r'嘻+', r'呵+'],
                'weight': 1.0
            },
            EmotionType.SAD: {
                'keywords': ['难过', '伤心', '哭', '痛苦', '不开心', '郁闷', '失落'],
                'patterns': [r'呜+', r'哭+'],
                'weight': 1.0
            },
            EmotionType.ANGRY: {
                'keywords': ['生气', '愤怒', '气死了', '烦', '讨厌', '烦人', '可恶'],
                'patterns': [r'啊+'],
                'weight': 1.0
            },
            EmotionType.SURPRISED: {
                'keywords': ['惊讶', '意外', '哇', '天哪', '不会吧', '真的吗'],
                'patterns': [r'哇+', r'啊+'],
                'weight': 0.8
            },
            EmotionType.CONFUSED: {
                'keywords': ['困惑', '不懂', '什么', '为什么', '迷惑', '搞不懂'],
                'patterns': [r'\?+'],
                'weight': 0.7
            },
            EmotionType.EXCITED: {
                'keywords': ['兴奋', '激动', '太棒了', '厉害', '牛逼', '赞'],
                'patterns': [r'!+'],
                'weight': 0.9
            },
            EmotionType.CALM: {
                'keywords': ['平静', '冷静', '好的', '知道了', '嗯', '淡定'],
                'patterns': [r'嗯+', r'哦+'],
                'weight': 0.6
            },
            EmotionType.CURIOUS: {
                'keywords': ['好奇', '想知道', '有趣', '告诉我'],
                'patterns': [],
                'weight': 0.7
            },
            EmotionType.TIRED: {
                'keywords': ['累', '疲惫', '困', '想睡觉'],
                'patterns': [],
                'weight': 0.8
            },
            EmotionType.ANXIOUS: {
                'keywords': ['焦虑', '担心', '紧张', '害怕', '不安'],
                'patterns': [],
                'weight': 0.8
            }
        }
        
        # 合并自定义模式
        self.emotion_patterns = self.default_patterns.copy()
        if custom_patterns:
            self._merge_custom_patterns(custom_patterns)
        
        self.context_modifiers = {
            EmotionContext.GREETING: {EmotionType.HAPPY: 0.2, EmotionType.EXCITED: 0.1},
            EmotionContext.FAREWELL: {EmotionType.SAD: 0.1, EmotionType.CALM: 0.1},
            EmotionContext.QUESTION: {EmotionType.CURIOUS: 0.2, EmotionType.CONFUSED: 0.1},
            EmotionContext.COMPLIMENT: {EmotionType.HAPPY: 0.3, EmotionType.EXCITED: 0.2},
            EmotionContext.COMPLAINT: {EmotionType.ANGRY: 0.2, EmotionType.SAD: 0.1},
        }
    
    def _merge_custom_patterns(self, custom_patterns: Dict):
        """合并自定义情绪模式"""
        for emotion_type, pattern_data in custom_patterns.items():
            if isinstance(emotion_type, str):
                # 如果是字符串，尝试转换为EmotionType
                try:
                    emotion_type = EmotionType[emotion_type.upper()]
                except KeyError:
                    continue
            
            if emotion_type in self.emotion_patterns:
                # 合并关键词
                if 'keywords' in pattern_data:
                    existing_keywords = set(self.emotion_patterns[emotion_type]['keywords'])
                    new_keywords = set(pattern_data['keywords'])
                    self.emotion_patterns[emotion_type]['keywords'] = list(existing_keywords | new_keywords)
                
                # 合并模式
                if 'patterns' in pattern_data:
                    existing_patterns = set(self.emotion_patterns[emotion_type]['patterns'])
                    new_patterns = set(pattern_data['patterns'])
                    self.emotion_patterns[emotion_type]['patterns'] = list(existing_patterns | new_patterns)
                
                # 更新权重
                if 'weight' in pattern_data:
                    self.emotion_patterns[emotion_type]['weight'] = pattern_data['weight']
            else:
                # 添加新的情绪类型模式
                self.emotion_patterns[emotion_type] = pattern_data
    
    async def analyze(self, text: str, context: Optional[Dict] = None) -> EmotionState:
        """基于规则分析情绪"""
        text = text.lower().strip()
        emotion_scores = defaultdict(float)
        triggers = []
        
        # 关键词匹配
        for emotion, config in self.emotion_patterns.items():
            score = 0
            
            # 关键词匹配
            for keyword in config['keywords']:
                if keyword.lower() in text:
                    score += config['weight']
                    triggers.append(f"keyword:{keyword}")
            
            # 正则模式匹配
            for pattern in config['patterns']:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    score += config['weight'] * len(matches)
                    triggers.extend([f"pattern:{pattern}" for _ in matches])
            
            emotion_scores[emotion] = score
        
        # 上下文修正
        detected_context = self._detect_context(text)
        if detected_context and detected_context in self.context_modifiers:
            for emotion, modifier in self.context_modifiers[detected_context].items():
                emotion_scores[emotion] += modifier
        
        # 确定主要情绪
        if not emotion_scores:
            primary_emotion = EmotionType.NEUTRAL
            intensity = 0.5
            confidence = 0.3
        else:
            primary_emotion = max(emotion_scores, key=emotion_scores.get)
            max_score = emotion_scores[primary_emotion]
            intensity = min(max_score / 3.0, 1.0)  # 归一化强度
            confidence = min(max_score / 2.0, 1.0)  # 归一化置信度
        
        return EmotionState(
            emotion=primary_emotion,
            intensity=intensity,
            confidence=confidence,
            context=detected_context,
            triggers=triggers[:5]  # 限制触发器数量
        )
    
    def _detect_context(self, text: str) -> Optional[EmotionContext]:
        """检测上下文"""
        text = text.lower()
        
        greeting_patterns = ['你好', 'hello', 'hi', '早上好', '晚上好', '您好']
        farewell_patterns = ['再见', 'bye', '拜拜', '晚安', '回见']
        question_patterns = ['什么', '怎么', '为什么', '如何', '?', '？']
        compliment_patterns = ['棒', '厉害', '好', '赞', '优秀', '聪明']
        complaint_patterns = ['不好', '糟糕', '烂', '差', '讨厌', '烦']
        
        if any(pattern in text for pattern in greeting_patterns):
            return EmotionContext.GREETING
        elif any(pattern in text for pattern in farewell_patterns):
            return EmotionContext.FAREWELL
        elif any(pattern in text for pattern in question_patterns):
            return EmotionContext.QUESTION
        elif any(pattern in text for pattern in compliment_patterns):
            return EmotionContext.COMPLIMENT
        elif any(pattern in text for pattern in complaint_patterns):
            return EmotionContext.COMPLAINT
        
        return EmotionContext.CASUAL_CHAT
    
    def get_name(self) -> str:
        return "RuleBased"


class MLEmotionAnalyzer(EmotionAnalyzer):
    """基于机器学习的情绪分析器（适配器模式）"""
    
    def __init__(self):
        # 检测是否有可用的ML模型
        self.model_available = self._check_model_availability()
        self.logger = get_logger()
        
        if self.model_available:
            self.logger.info("ML emotion analyzer initialized successfully")
        else:
            self.logger.info("ML emotion analyzer not available, will use rule-based fallback")
    
    def _check_model_availability(self) -> bool:
        """检查ML模型是否可用"""
        try:
            # 这里可以检查具体的ML库和模型
            # 例如：检查transformers库、模型文件等
            # import transformers
            # return True if model files exist
            return False  # 目前默认不可用，可以根据实际情况修改
        except ImportError:
            return False
        except Exception:
            return False
    
    async def analyze(self, text: str, context: Optional[Dict] = None) -> EmotionState:
        """ML情绪分析 - 仅在模型可用时调用"""
        if not self.model_available:
            # 不应该到达这里，因为外层已经检查了model_available
            self.logger.warning("ML analyzer called but model not available")
            return EmotionState(emotion=EmotionType.NEUTRAL, confidence=0.0)
        
        # TODO: 实现真实的ML分析逻辑
        # 示例实现：
        # try:
        #     # 使用预训练模型分析情绪
        #     result = self.model.predict(text)
        #     return EmotionState(
        #         emotion=self._map_ml_result_to_emotion(result),
        #         intensity=result.intensity,
        #         confidence=result.confidence
        #     )
        # except Exception as e:
        #     self.logger.error(f"ML analysis failed: {e}")
        #     return EmotionState(emotion=EmotionType.NEUTRAL, confidence=0.0)
        
        # 占位符实现
        return EmotionState(emotion=EmotionType.NEUTRAL, confidence=0.9)
    
    def get_name(self) -> str:
        return "MachineLearning"


class EmotionTransitionEngine:
    """情绪转换引擎"""
    
    def __init__(self):
        # 情绪转换规则：当前情绪 -> 可能转换的情绪及概率
        self.transition_rules = {
            EmotionType.NEUTRAL: {
                EmotionType.HAPPY: 0.3,
                EmotionType.CURIOUS: 0.2,
                EmotionType.CALM: 0.2,
                EmotionType.CONFUSED: 0.1
            },
            EmotionType.HAPPY: {
                EmotionType.EXCITED: 0.3,
                EmotionType.CALM: 0.2,
                EmotionType.NEUTRAL: 0.2,
                EmotionType.SURPRISED: 0.1
            },
            EmotionType.SAD: {
                EmotionType.NEUTRAL: 0.3,
                EmotionType.CALM: 0.2,
                EmotionType.TIRED: 0.2,
                EmotionType.ANGRY: 0.1
            },
            EmotionType.ANGRY: {
                EmotionType.CALM: 0.3,
                EmotionType.NEUTRAL: 0.2,
                EmotionType.TIRED: 0.2,
                EmotionType.SAD: 0.1
            },
            EmotionType.EXCITED: {
                EmotionType.HAPPY: 0.3,
                EmotionType.TIRED: 0.2,
                EmotionType.CALM: 0.2,
                EmotionType.NEUTRAL: 0.1
            },
            EmotionType.CONFUSED: {
                EmotionType.CURIOUS: 0.3,
                EmotionType.NEUTRAL: 0.2,
                EmotionType.CALM: 0.2,
                EmotionType.ANXIOUS: 0.1
            },
            EmotionType.CURIOUS: {
                EmotionType.EXCITED: 0.3,
                EmotionType.HAPPY: 0.2,
                EmotionType.NEUTRAL: 0.2,
                EmotionType.CONFUSED: 0.1
            }
        }
        
        # 情绪稳定性配置
        self.stability_factors = {
            EmotionType.CALM: 0.8,      # 冷静情绪比较稳定
            EmotionType.NEUTRAL: 0.7,   # 中性情绪相对稳定
            EmotionType.HAPPY: 0.6,     # 开心情绪中等稳定
            EmotionType.SAD: 0.5,       # 悲伤情绪不太稳定
            EmotionType.ANGRY: 0.3,     # 愤怒情绪不稳定
            EmotionType.EXCITED: 0.2,   # 兴奋情绪很不稳定
            EmotionType.SURPRISED: 0.1  # 惊讶情绪最不稳定
        }
    
    def should_transition(self, current_emotion: EmotionType, 
                         new_emotion: EmotionType, 
                         character_stability: float = 0.7) -> bool:
        """判断是否应该进行情绪转换"""
        if current_emotion == new_emotion:
            return False
        
        # 获取当前情绪的稳定性
        current_stability = self.stability_factors.get(current_emotion, 0.5)
        
        # 综合角色稳定性和情绪稳定性
        total_stability = (current_stability + character_stability) / 2
        
        # 获取转换概率
        transition_prob = self.transition_rules.get(current_emotion, {}).get(new_emotion, 0.1)
        
        # 计算最终转换概率
        final_prob = transition_prob * (1 - total_stability)
        
        # 随机判断（这里简化为基于概率的确定性判断）
        return final_prob > 0.3
    
    def get_transition_emotion(self, current_emotion: EmotionType,
                             target_emotion: EmotionType,
                             transition_speed: float = 0.5) -> EmotionType:
        """获取过渡情绪"""
        # 如果转换速度很快，直接返回目标情绪
        if transition_speed > 0.8:
            return target_emotion
        
        # 否则返回中间过渡情绪
        possible_transitions = self.transition_rules.get(current_emotion, {})
        
        # 寻找最接近目标情绪的过渡情绪
        if target_emotion in possible_transitions:
            return target_emotion
        
        # 选择概率最高的过渡情绪
        if possible_transitions:
            return max(possible_transitions, key=possible_transitions.get)
        
        return EmotionType.NEUTRAL


class EmotionResponseGenerator:
    """情绪响应生成器"""
    
    def __init__(self):
        # 情绪对应的语调修饰符
        self.tone_modifiers = {
            EmotionType.HAPPY: {
                'prefixes': ['好的~', '太好了!', '真棒!', '哇!'],
                'suffixes': ['~', '!', '呢~', '哦~'],
                'style_words': ['开心', '高兴', '快乐']
            },
            EmotionType.SAD: {
                'prefixes': ['唉...', '嗯...', '好吧...'],
                'suffixes': ['...', '呢...', '吧...'],
                'style_words': ['难过', '伤心', '不开心']
            },
            EmotionType.EXCITED: {
                'prefixes': ['哇塞!', '太棒了!!', 'amazing!'],
                'suffixes': ['!!', '!!!', '~!!'],
                'style_words': ['兴奋', '激动', '超棒']
            },
            EmotionType.CALM: {
                'prefixes': ['嗯', '好的', '我明白'],
                'suffixes': ['.', '。', ''],
                'style_words': ['平静', '冷静', '淡定']
            },
            EmotionType.CONFUSED: {
                'prefixes': ['嗯?', '这个...', '让我想想...'],
                'suffixes': ['?', '...', '呢?'],
                'style_words': ['困惑', '不太明白', '有点迷惑']
            },
            EmotionType.CURIOUS: {
                'prefixes': ['哦?', '有意思~', '真的吗?'],
                'suffixes': ['?', '~', '呢?'],
                'style_words': ['好奇', '有趣', '想了解']
            }
        }
        
        # 情绪强度对应的表达方式
        self.intensity_modifiers = {
            'very_low': {'multiplier': 0.2, 'punctuation': '.'},
            'low': {'multiplier': 0.4, 'punctuation': '.'},
            'medium': {'multiplier': 0.6, 'punctuation': '~'},
            'high': {'multiplier': 0.8, 'punctuation': '!'},
            'very_high': {'multiplier': 1.0, 'punctuation': '!!'}
        }
    
    def generate_emotional_response(self, 
                                  base_response: str,
                                  emotion_state: EmotionState,
                                  character_config: Optional[CharacterConfig] = None) -> str:
        """生成带有情绪色彩的响应"""
        if emotion_state.emotion == EmotionType.NEUTRAL:
            return base_response
        
        # 获取情绪修饰符
        modifiers = self.tone_modifiers.get(emotion_state.emotion, {})
        if not modifiers:
            return base_response
        
        # 根据强度选择修饰符
        intensity_level = self._get_intensity_level(emotion_state.intensity)
        intensity_config = self.intensity_modifiers[intensity_level]
        
        # 应用情绪修饰
        response = base_response
        
        # 添加前缀（根据强度概率性添加）
        if modifiers.get('prefixes') and emotion_state.intensity > 0.4:
            import random
            if random.random() < emotion_state.intensity:
                prefix = random.choice(modifiers['prefixes'])
                response = f"{prefix} {response}"
        
        # 添加后缀
        if modifiers.get('suffixes'):
            import random
            suffix = random.choice(modifiers['suffixes'])
            # 根据强度重复标点符号
            if intensity_config['multiplier'] > 0.6 and suffix in ['!', '?', '~']:
                suffix = suffix * int(intensity_config['multiplier'] * 3)
            response = f"{response}{suffix}"
        
        return response
    
    def _get_intensity_level(self, intensity: float) -> str:
        """获取强度等级"""
        if intensity <= 0.2:
            return 'very_low'
        elif intensity <= 0.4:
            return 'low'
        elif intensity <= 0.6:
            return 'medium'
        elif intensity <= 0.8:
            return 'high'
        else:
            return 'very_high'
    
    def suggest_voice_style(self, emotion_state: EmotionState) -> Optional[str]:
        """建议语音风格"""
        voice_mapping = {
            EmotionType.HAPPY: "cheerful",
            EmotionType.SAD: "gentle",
            EmotionType.EXCITED: "energetic",
            EmotionType.CALM: "soft",
            EmotionType.ANGRY: "firm",
            EmotionType.CONFUSED: "questioning",
            EmotionType.CURIOUS: "interested"
        }
        return voice_mapping.get(emotion_state.emotion)
    
    def suggest_animation(self, emotion_state: EmotionState) -> Optional[str]:
        """建议动画表情"""
        animation_mapping = {
            EmotionType.HAPPY: "smile",
            EmotionType.SAD: "sad",
            EmotionType.EXCITED: "excited",
            EmotionType.CALM: "peaceful",
            EmotionType.ANGRY: "angry",
            EmotionType.CONFUSED: "thinking",
            EmotionType.CURIOUS: "curious",
            EmotionType.SURPRISED: "surprised"
        }
        return animation_mapping.get(emotion_state.emotion)


class EmotionMiddleware:
    """情绪处理中间件核心类"""
    
    def __init__(self, character_config: Dict = None):
        self.logger = get_logger()
        self.character_config = character_config or {}
        
        # 从角色配置中获取自定义情绪模式
        custom_emotion_patterns = None
        if self.character_config and 'emotion_patterns' in self.character_config:
            custom_emotion_patterns = self.character_config['emotion_patterns']
        
        # 初始化组件
        self.analyzers: Dict[str, EmotionAnalyzer] = {
            'rule_based': RuleBasedEmotionAnalyzer(custom_emotion_patterns),
            'ml_based': MLEmotionAnalyzer()
        }
        self.transition_engine = EmotionTransitionEngine()
        self.response_generator = EmotionResponseGenerator()
        
        # 情绪记忆存储
        self.emotion_memories: Dict[str, EmotionMemory] = {}
    
    @classmethod
    def from_config_file(cls, config_path: str):
        """从配置文件创建情绪中间件实例"""
        config_path = pathlib.Path(config_path)
        
        if not config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {config_path}")
        
        # 根据文件扩展名选择解析方式
        if config_path.suffix.lower() in ['.yml', '.yaml']:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        elif config_path.suffix.lower() == '.json':
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            raise ValueError(f"不支持的配置文件格式: {config_path.suffix}")
        
        return cls(character_config=config)
    
    def update_character_config(self, new_config: Dict):
        """动态更新角色配置"""
        self.character_config.update(new_config)
        
        # 如果有新的情绪模式，更新分析器
        if 'emotion_patterns' in new_config:
            if hasattr(self.analyzers['rule_based'], '_merge_custom_patterns'):
                self.analyzers['rule_based']._merge_custom_patterns(new_config['emotion_patterns'])
        
        # 配置
        self.config = {
            'enable_transition': True,
            'enable_memory': True,
            'memory_ttl': 3600,  # 记忆存活时间(秒)
            'max_memory_entries': 1000
        }
        
        # 性能统计
        self.stats = {
            'total_requests': 0,
            'emotion_detected': 0,
            'transitions_made': 0,
            'average_processing_time': 0.0
        }
    
    async def analyze_user_emotion(self, 
                                 text: str, 
                                 user_id: str,
                                 context: Optional[Dict] = None) -> EmotionState:
        """分析用户情绪 - 优先使用ML分析器，不可用时回退到规则分析器"""
        start_time = time.time()
        
        try:
            # 优先尝试使用ML分析器
            emotion_state = None
            analyzer_used = None
            
            # 1. 首先尝试ML分析器
            if 'ml_based' in self.analyzers:
                ml_analyzer = self.analyzers['ml_based']
                if hasattr(ml_analyzer, 'model_available') and ml_analyzer.model_available:
                    emotion_state = await ml_analyzer.analyze(text, context)
                    analyzer_used = 'ml_based'
                    self.logger.debug("Using ML-based emotion analyzer")
            
            # 2. 如果ML分析器不可用，使用规则分析器
            if emotion_state is None:
                rule_analyzer = self.analyzers.get('rule_based')
                if rule_analyzer:
                    emotion_state = await rule_analyzer.analyze(text, context)
                    analyzer_used = 'rule_based'
                    self.logger.debug("Using rule-based emotion analyzer (ML fallback)")
                else:
                    # 最后的备用方案：创建默认情绪状态
                    emotion_state = EmotionState(emotion=EmotionType.NEUTRAL, confidence=0.3)
                    analyzer_used = 'default'
                    self.logger.warning("No emotion analyzer available, using default neutral state")
            
            # 如果启用记忆系统，考虑历史情绪
            if self.config['enable_memory']:
                emotion_state = await self._apply_emotion_memory(
                    emotion_state, user_id, 'user'
                )
            
            # 更新统计
            self.stats['total_requests'] += 1
            if emotion_state.emotion != EmotionType.NEUTRAL:
                self.stats['emotion_detected'] += 1
            
            processing_time = time.time() - start_time
            self._update_avg_processing_time(processing_time)
            
            self.logger.debug(f"User emotion analyzed using {analyzer_used}: {emotion_state.emotion} "
                            f"(intensity: {emotion_state.intensity:.2f}, "
                            f"confidence: {emotion_state.confidence:.2f})")
            
            return emotion_state
            
        except Exception as e:
            self.logger.error(f"Error analyzing user emotion: {e}")
            return EmotionState(emotion=EmotionType.NEUTRAL, confidence=0.0)
    
    async def generate_response_emotion(self,
                                      user_emotion: EmotionState,
                                      character_config: CharacterConfig,
                                      user_id: str,
                                      context: Optional[Dict] = None) -> EmotionState:
        """生成响应情绪"""
        try:
            # 获取角色当前情绪
            current_emotion = await self._get_character_current_emotion(
                character_config.id, user_id
            )
            
            # 基于用户情绪和角色性格生成响应情绪
            response_emotion = await self._calculate_response_emotion(
                user_emotion, current_emotion, character_config
            )
            
            # 应用情绪转换逻辑
            if self.config['enable_transition']:
                if self.transition_engine.should_transition(
                    current_emotion.emotion,
                    response_emotion.emotion,
                    character_config.emotion_stability
                ):
                    transition_emotion = self.transition_engine.get_transition_emotion(
                        current_emotion.emotion,
                        response_emotion.emotion,
                        1.0 - character_config.emotion_stability
                    )
                    response_emotion.emotion = transition_emotion
                    self.stats['transitions_made'] += 1
            
            # 更新角色情绪记忆
            if self.config['enable_memory']:
                await self._update_character_emotion_memory(
                    character_config.id, user_id, response_emotion
                )
            
            self.logger.debug(f"Response emotion generated: {response_emotion.emotion} "
                            f"(intensity: {response_emotion.intensity:.2f})")
            
            return response_emotion
            
        except Exception as e:
            self.logger.error(f"Error generating response emotion: {e}")
            return EmotionState(emotion=EmotionType.NEUTRAL)
    
    async def enhance_response(self,
                             base_response: str,
                             emotion_state: EmotionState,
                             character_config: CharacterConfig) -> Dict[str, Any]:
        """增强响应内容"""
        try:
            # 生成带情绪色彩的文本响应
            enhanced_text = self.response_generator.generate_emotional_response(
                base_response, emotion_state, character_config
            )
            
            # 生成多媒体建议
            voice_style = self.response_generator.suggest_voice_style(emotion_state)
            animation = self.response_generator.suggest_animation(emotion_state)
            
            return {
                'text': enhanced_text,
                'emotion': emotion_state.emotion,
                'emotion_intensity': emotion_state.intensity,
                'voice_style': voice_style,
                'animation': animation,
                'emotion_context': emotion_state.context,
                'emotion_triggers': emotion_state.triggers
            }
            
        except Exception as e:
            self.logger.error(f"Error enhancing response: {e}")
            return {
                'text': base_response,
                'emotion': EmotionType.NEUTRAL,
                'emotion_intensity': 0.5
            }
    
    async def _apply_emotion_memory(self,
                                   emotion_state: EmotionState,
                                   user_id: str,
                                   memory_type: str) -> EmotionState:
        """应用情绪记忆"""
        memory_key = f"{user_id}_{memory_type}"
        
        if memory_key not in self.emotion_memories:
            self.emotion_memories[memory_key] = EmotionMemory(user_id=user_id)
        
        memory = self.emotion_memories[memory_key]
        
        # 获取最近的情绪
        recent_emotions = memory.get_recent_emotions(minutes=5)
        
        if recent_emotions:
            # 如果最近有相似情绪，增强置信度
            similar_emotions = [e for e in recent_emotions 
                              if e.emotion == emotion_state.emotion]
            if similar_emotions:
                emotion_state.confidence = min(emotion_state.confidence + 0.1, 1.0)
                emotion_state.intensity = min(
                    emotion_state.intensity + 
                    sum(e.intensity for e in similar_emotions) / len(similar_emotions) * 0.1,
                    1.0
                )
        
        # 添加到记忆
        memory.add_emotion(emotion_state)
        
        return emotion_state
    
    async def _get_character_current_emotion(self,
                                           character_id: str,
                                           user_id: str) -> EmotionState:
        """获取角色当前情绪"""
        memory_key = f"{user_id}_{character_id}"
        
        if memory_key in self.emotion_memories:
            memory = self.emotion_memories[memory_key]
            recent_emotions = memory.get_recent_emotions(minutes=10)
            if recent_emotions:
                return recent_emotions[-1]  # 返回最新情绪
        
        # 默认返回中性情绪
        return EmotionState(emotion=EmotionType.NEUTRAL)
    
    async def _calculate_response_emotion(self,
                                        user_emotion: EmotionState,
                                        current_emotion: EmotionState,
                                        character_config: CharacterConfig) -> EmotionState:
        """计算响应情绪"""
        # 基于角色性格和用户情绪计算响应情绪
        response_mapping = {
            # 用户开心时的响应
            EmotionType.HAPPY: {
                'shy': EmotionType.HAPPY,
                'cheerful': EmotionType.EXCITED,
                'calm': EmotionType.HAPPY,
                'caring': EmotionType.HAPPY
            },
            # 用户悲伤时的响应
            EmotionType.SAD: {
                'shy': EmotionType.CONFUSED,
                'cheerful': EmotionType.CALM,
                'calm': EmotionType.CALM,
                'caring': EmotionType.SAD
            },
            # 用户愤怒时的响应
            EmotionType.ANGRY: {
                'shy': EmotionType.SCARED,
                'cheerful': EmotionType.CONFUSED,
                'calm': EmotionType.CALM,
                'caring': EmotionType.CALM
            }
        }
        
        personality = character_config.personality_type.value
        base_emotion = response_mapping.get(user_emotion.emotion, {}).get(
            personality, EmotionType.NEUTRAL
        )
        
        # 计算响应强度（受角色性格影响）
        personality_intensity_factors = {
            'shy': 0.6,
            'cheerful': 0.9,
            'calm': 0.4,
            'energetic': 0.8,
            'caring': 0.7
        }
        
        base_intensity = user_emotion.intensity * personality_intensity_factors.get(
            personality, 0.5
        )
        
        return EmotionState(
            emotion=base_emotion,
            intensity=base_intensity,
            confidence=0.8,
            context=user_emotion.context
        )
    
    async def _update_character_emotion_memory(self,
                                             character_id: str,
                                             user_id: str,
                                             emotion_state: EmotionState):
        """更新角色情绪记忆"""
        memory_key = f"{user_id}_{character_id}"
        
        if memory_key not in self.emotion_memories:
            self.emotion_memories[memory_key] = EmotionMemory(user_id=user_id)
        
        self.emotion_memories[memory_key].add_emotion(emotion_state)
    
    def _update_avg_processing_time(self, processing_time: float):
        """更新平均处理时间"""
        current_avg = self.stats['average_processing_time']
        total_requests = self.stats['total_requests']
        
        self.stats['average_processing_time'] = (
            (current_avg * (total_requests - 1) + processing_time) / total_requests
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            **self.stats,
            'memory_entries': len(self.emotion_memories),
            'analyzers': list(self.analyzers.keys()),
            'config': self.config
        }
    
    def cleanup_old_memories(self):
        """清理过期记忆"""
        current_time = datetime.now()
        ttl = timedelta(seconds=self.config['memory_ttl'])
        
        to_remove = []
        for key, memory in self.emotion_memories.items():
            if current_time - memory.last_update > ttl:
                to_remove.append(key)
        
        for key in to_remove:
            del self.emotion_memories[key]
        
        self.logger.debug(f"Cleaned up {len(to_remove)} expired emotion memories")


class EmotionHTTPMiddleware(BaseHTTPMiddleware):
    """情绪处理HTTP中间件"""
    
    def __init__(self, app, emotion_middleware: EmotionMiddleware):
        super().__init__(app)
        self.emotion_middleware = emotion_middleware
        self.logger = get_logger()
    
    async def dispatch(self, request: Request, call_next):
        """处理HTTP请求"""
        # 检查是否是聊天相关的请求
        if not self._should_process_emotion(request):
            return await call_next(request)
        
        try:
            # 处理请求
            response = await call_next(request)
            
            # 如果响应包含聊天内容，进行情绪处理
            if hasattr(response, 'body'):
                enhanced_response = await self._process_response_emotion(
                    request, response
                )
                return enhanced_response
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error in emotion middleware: {e}")
            return await call_next(request)
    
    def _should_process_emotion(self, request: Request) -> bool:
        """判断是否需要处理情绪"""
        # 检查路径是否是聊天相关
        emotion_paths = ['/chat', '/character', '/message']
        return any(path in str(request.url) for path in emotion_paths)
    
    async def _process_response_emotion(self, request: Request, response: Response):
        """处理响应情绪"""
        # 这里可以根据实际需求实现情绪处理逻辑
        # 例如：修改响应内容，添加情绪标记等
        return response


# 全局情绪中间件实例
_emotion_middleware: Optional[EmotionMiddleware] = None

def get_emotion_middleware() -> EmotionMiddleware:
    """获取全局情绪中间件实例"""
    global _emotion_middleware
    if _emotion_middleware is None:
        _emotion_middleware = EmotionMiddleware()
    return _emotion_middleware

def load_character_emotion_config(character_config_path: str = None) -> Dict:
    """
    从角色配置文件中加载情绪配置
    
    Args:
        character_config_path: 角色配置文件路径，默认为 config/character/default.yml
    
    Returns:
        情绪配置字典
    """
    if character_config_path is None:
        character_config_path = "config/character/default.yml"
    
    try:
        config_path = Path(character_config_path)
        if not config_path.exists():
            # 尝试相对路径
            config_path = Path(__file__).parent.parent.parent.parent / character_config_path
        
        if not config_path.exists():
            logger.warning(f"角色配置文件不存在: {character_config_path}")
            return {}
        
        with open(config_path, 'r', encoding='utf-8') as f:
            character_config = yaml.safe_load(f)
        
        # 提取情绪配置
        emotion_config = character_config.get('emotion', {})
        
        # 转换为中间件配置格式
        middleware_config = {
            'enable_memory': emotion_config.get('analyzer', {}).get('enable_memory', True),
            'memory_ttl': emotion_config.get('analyzer', {}).get('memory_ttl', 3600),
            'enable_transition': emotion_config.get('transition', {}).get('enable_smooth_transition', True),
            'max_memory_entries': 1000,
            'cleanup_interval': 300,
            
            # 情绪模式配置
            'emotion_patterns': emotion_config.get('patterns', {}),
            'character_responses': emotion_config.get('character_responses', {}),
            
            # 角色基础设置
            'personality_type': emotion_config.get('personality_type', 'shy'),
            'interaction_style': emotion_config.get('interaction_style', 'casual'),
            'emotion_stability': emotion_config.get('emotion_stability', 0.7),
            'transition_speed': emotion_config.get('transition', {}).get('transition_speed', 0.5),
            
            # 响应生成设置
            'enable_tone_modification': emotion_config.get('response', {}).get('enable_tone_modification', True),
            'intensity_threshold': emotion_config.get('response', {}).get('intensity_threshold', 0.3),
            'style_variation': emotion_config.get('response', {}).get('style_variation', True),
        }
        
        logger.info(f"成功加载角色情绪配置: {character_config_path}")
        return middleware_config
        
    except Exception as e:
        logger.error(f"加载角色情绪配置失败: {e}")
        return {}


def initialize_emotion_middleware(config: Optional[Dict] = None, character_config_path: str = None) -> EmotionMiddleware:
    """
    初始化情绪中间件
    
    Args:
        config: 手动配置参数（可选）
        character_config_path: 角色配置文件路径（可选）
    """
    global _emotion_middleware
    _emotion_middleware = EmotionMiddleware()
    
    # 首先加载角色配置文件中的情绪设置
    if character_config_path or Path("config/character/default.yml").exists():
        character_emotion_config = load_character_emotion_config(character_config_path)
        if character_emotion_config:
            _emotion_middleware.config.update(character_emotion_config)
            logger.info("已从角色配置文件加载情绪设置")
    
    # 然后应用手动配置（会覆盖角色配置）
    if config:
        _emotion_middleware.config.update(config)
        logger.info("已应用手动情绪配置")
    
    return _emotion_middleware

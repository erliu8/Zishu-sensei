# 情绪处理中间件文档

## 概述

情绪处理中间件是Zishu-sensei项目的核心组件之一，提供智能情绪分析、情绪转换、情绪记忆和情绪响应生成功能。该中间件能够理解用户的情绪状态，并生成相应的情绪化响应，使AI角色更加生动和人性化。

## 功能特性

### 🎭 情绪分析
- **多种分析器支持**：基于规则、机器学习模型、关键词匹配
- **情绪类型识别**：支持10+种情绪类型（开心、悲伤、愤怒、兴奋等）
- **强度和置信度评估**：量化情绪的强度和识别的可信度
- **上下文感知**：识别对话场景（问候、告别、提问等）
- **多语言支持**：支持中文文本和表情符号

### 🔄 情绪转换
- **状态机管理**：基于情绪状态机的转换逻辑
- **平滑过渡**：避免情绪突变，提供自然的情绪变化
- **角色个性适配**：根据角色性格调整转换概率
- **稳定性控制**：可配置的情绪稳定性参数

### 🧠 情绪记忆
- **短期记忆**：最近10条情绪状态记录
- **长期记忆**：重要情绪事件的持久化存储
- **模式识别**：分析用户的情绪倾向和习惯
- **历史影响**：基于历史情绪调整当前分析结果

### 💬 响应生成
- **语调调整**：根据情绪状态修改回复语调
- **表达强化**：添加情绪化的前缀、后缀和标点符号
- **多模态建议**：提供语音风格和动画表情建议
- **角色一致性**：保持与角色设定的一致性

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    EmotionMiddleware                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ EmotionAnalyzer │  │TransitionEngine │  │ResponseGen   │ │
│  │                 │  │                 │  │              │ │
│  │ • RuleBased     │  │ • StateRules    │  │ • ToneModify │ │
│  │ • MLBased       │  │ • Stability     │  │ • VoiceStyle │ │
│  │ • KeywordMatch  │  │ • Smoothing     │  │ • Animation  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                EmotionMemory                            │ │
│  │ • ShortTerm (deque)  • LongTerm (list)  • Patterns     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心类和接口

### EmotionState
情绪状态数据类，包含：
- `emotion`: 情绪类型
- `intensity`: 强度 (0.0-1.0)
- `confidence`: 置信度 (0.0-1.0)
- `context`: 上下文场景
- `triggers`: 触发因子列表
- `timestamp`: 时间戳

### EmotionAnalyzer
情绪分析器抽象基类：
- `analyze(text, context)`: 分析文本情绪
- `get_name()`: 获取分析器名称

### EmotionMiddleware
主要的中间件类：
- `analyze_user_emotion()`: 分析用户情绪
- `generate_response_emotion()`: 生成响应情绪
- `enhance_response()`: 增强响应内容

## 使用指南

### 基础使用

```python
from zishu.api.middleware.emotion import initialize_emotion_middleware

# 初始化中间件
middleware = initialize_emotion_middleware({
    'primary_analyzer': 'rule_based',
    'enable_memory': True,
    'enable_transition': True
})

# 分析用户情绪
user_emotion = await middleware.analyze_user_emotion(
    text="我今天很开心！",
    user_id="user_123"
)

# 生成角色响应
response_emotion = await middleware.generate_response_emotion(
    user_emotion=user_emotion,
    character_config=character_config,
    user_id="user_123"
)

# 增强响应
enhanced = await middleware.enhance_response(
    base_response="很高兴听到这个消息",
    emotion_state=response_emotion,
    character_config=character_config
)
```

### FastAPI集成

```python
from fastapi import FastAPI, Depends
from zishu.api.middleware.emotion import (
    EmotionHTTPMiddleware,
    get_emotion_middleware
)

app = FastAPI()

# 添加情绪处理中间件
app.add_middleware(EmotionHTTPMiddleware, emotion_middleware=middleware)

@app.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    middleware: EmotionMiddleware = Depends(get_emotion_middleware)
):
    # 使用情绪中间件处理聊天
    pass
```

### 配置选项

```json
{
  "emotion_middleware": {
    "primary_analyzer": "rule_based",
    "enable_transition": true,
    "enable_memory": true,
    "memory_ttl": 3600,
    "max_memory_entries": 1000,
    
    "analyzers": {
      "rule_based": {
        "enabled": true,
        "weight": 1.0
      },
      "ml_based": {
        "enabled": false,
        "model_path": ""
      }
    },
    
    "performance": {
      "max_processing_time": 1.0,
      "enable_caching": true,
      "enable_async": true
    }
  }
}
```

## 情绪类型

支持的情绪类型包括：

| 情绪类型 | 描述 | 示例关键词 |
|---------|------|-----------|
| HAPPY | 开心、快乐 | 开心、高兴、快乐、😊 |
| SAD | 悲伤、难过 | 难过、伤心、😢 |
| ANGRY | 愤怒、生气 | 生气、愤怒、😠 |
| EXCITED | 兴奋、激动 | 兴奋、激动、太棒了 |
| CONFUSED | 困惑、迷惑 | 困惑、不懂、🤔 |
| CURIOUS | 好奇、感兴趣 | 好奇、有趣、想知道 |
| CALM | 平静、冷静 | 平静、冷静、淡定 |
| TIRED | 疲惫、困倦 | 累、疲惫、😴 |
| ANXIOUS | 焦虑、担心 | 焦虑、担心、紧张 |
| SURPRISED | 惊讶、意外 | 惊讶、意外、😲 |
| NEUTRAL | 中性、无明显情绪 | 默认状态 |

## 性能优化

### 缓存策略
- 情绪分析结果缓存
- 用户情绪模式缓存
- 响应模板缓存

### 并发处理
- 异步情绪分析
- 批量处理支持
- 并发安全的内存管理

### 内存管理
- 自动清理过期记忆
- 可配置的内存限制
- 定期垃圾回收

## 扩展开发

### 自定义情绪分析器

```python
from zishu.api.middleware.emotion import EmotionAnalyzer, EmotionState

class CustomEmotionAnalyzer(EmotionAnalyzer):
    async def analyze(self, text: str, context=None) -> EmotionState:
        # 实现自定义分析逻辑
        pass
    
    def get_name(self) -> str:
        return "CustomAnalyzer"

# 注册自定义分析器
middleware.analyzers['custom'] = CustomEmotionAnalyzer()
```

### 自定义情绪转换规则

```python
# 添加自定义转换规则
middleware.transition_engine.transition_rules[EmotionType.CUSTOM] = {
    EmotionType.HAPPY: 0.3,
    EmotionType.CALM: 0.2
}
```

### 自定义响应修饰符

```python
# 添加自定义语调修饰符
middleware.response_generator.tone_modifiers[EmotionType.CUSTOM] = {
    'prefixes': ['自定义前缀'],
    'suffixes': ['自定义后缀'],
    'style_words': ['自定义词汇']
}
```

## API参考

### 主要方法

#### analyze_user_emotion(text, user_id, context=None)
分析用户输入文本的情绪状态。

**参数：**
- `text` (str): 要分析的文本
- `user_id` (str): 用户ID
- `context` (dict, optional): 额外上下文信息

**返回：** `EmotionState` 对象

#### generate_response_emotion(user_emotion, character_config, user_id, context=None)
基于用户情绪和角色配置生成响应情绪。

**参数：**
- `user_emotion` (EmotionState): 用户情绪状态
- `character_config` (CharacterConfig): 角色配置
- `user_id` (str): 用户ID
- `context` (dict, optional): 额外上下文信息

**返回：** `EmotionState` 对象

#### enhance_response(base_response, emotion_state, character_config)
根据情绪状态增强基础响应。

**参数：**
- `base_response` (str): 基础响应文本
- `emotion_state` (EmotionState): 情绪状态
- `character_config` (CharacterConfig): 角色配置

**返回：** 包含增强信息的字典

### 工具函数

#### initialize_emotion_middleware(config=None)
初始化情绪中间件实例。

#### get_emotion_middleware()
获取全局情绪中间件单例。

## 监控和调试

### 统计信息
```python
stats = middleware.get_stats()
print(f"总请求数: {stats['total_requests']}")
print(f"情绪检测率: {stats['emotion_detected'] / stats['total_requests']:.2%}")
print(f"平均处理时间: {stats['average_processing_time']:.4f}s")
```

### 日志记录
中间件提供详细的日志记录，包括：
- 情绪分析结果
- 转换决策过程
- 性能指标
- 错误信息

### 调试模式
```python
# 启用调试模式
middleware.config['debug_mode'] = True

# 查看详细分析过程
result = await middleware.analyze_user_emotion(text, user_id)
print(f"触发因子: {result.triggers}")
print(f"置信度: {result.confidence}")
```

## 最佳实践

### 1. 合理配置内存管理
```python
config = {
    'memory_ttl': 3600,  # 1小时过期
    'max_memory_entries': 10000,  # 最大记忆条目
    'cleanup_interval': 300  # 5分钟清理一次
}
```

### 2. 选择合适的分析器
- 快速响应场景：使用基于规则的分析器
- 高精度需求：使用机器学习分析器
- 资源受限环境：使用关键词匹配

### 3. 优化角色配置
```python
# 稳定型角色
stable_character = CharacterConfig(
    emotion_stability=0.8,  # 高稳定性
    personality_type=PersonalityType.CALM
)

# 活泼型角色
lively_character = CharacterConfig(
    emotion_stability=0.3,  # 低稳定性
    personality_type=PersonalityType.CHEERFUL
)
```

### 4. 性能监控
- 定期检查处理时间
- 监控内存使用情况
- 分析情绪检测准确率

## 故障排除

### 常见问题

**Q: 情绪分析结果不准确？**
A: 检查分析器配置，考虑添加自定义关键词或调整权重。

**Q: 内存使用过高？**
A: 调整`memory_ttl`和`max_memory_entries`参数，启用自动清理。

**Q: 响应速度慢？**
A: 启用缓存，使用更快的分析器，考虑异步处理。

**Q: 情绪转换过于频繁？**
A: 增加角色的`emotion_stability`参数，调整转换规则。

### 错误处理
中间件内置了完善的错误处理机制：
- 分析失败时返回中性情绪
- 网络异常时使用缓存结果
- 内存不足时自动清理


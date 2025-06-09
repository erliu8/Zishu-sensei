# Zishu-sensei(紫舒老师)开发中...

基于Chinese-Mistral-7B模型的中文版Anime风格AI虚拟角色项目。本项目使用量化技术适配低硬件条件下的模型训练和部署，采用渐进式专家模型蒸馏架构提升性能。

## 项目介绍

Zishu-sensei是中文虚拟AI角色，具有以下特点：

- 基于Chinese-Mistral-7B-v0.1大语言模型
- 使用4位量化技术降低硬件需求
- 通过QLoRA技术进行高效微调
- 采用渐进式专家模型蒸馏架构
- 专精于二次元文化和中国二次元知识
- 具备长短期记忆系统
- 拥有独特的角色设定和人格特征
- 支持多种接口形式（CLI、API、WebSocket等）
- 提供桌面宠物功能，可在桌面显示虚拟角色
- 支持自定义头部装饰和角色外观（小乌龟、蝴蝶结、花朵等）
- 角色会根据对话内容和环境变化展现不同表情和动作
- 支持语音对话功能，实现自然语音交互
- 具备屏幕内容识别能力，可分析和理解屏幕显示的内容

## 技术栈

- **基础模型**: Chinese-Mistral-7B-v0.1
- **量化方法**: 4-bit量化（BitsAndBytes）
- **微调技术**: QLoRA低秩适应
- **蒸馏架构**: 渐进式专家模型蒸馏
- **记忆存储**: 向量数据库
- **框架**: Transformers, PEFT, Accelerate
- **桌面应用**: PyQt6/PySide6
- **语音处理**: SpeechRecognition, pyttsx3/gTTS
- **屏幕内容识别**: OpenCV, Tesseract OCR

## 渐进式专家模型蒸馏架构

为了提升模型性能并优化资源使用，本项目采用渐进式专家模型蒸馏架构，分为三个核心阶段实现：

### 阶段1：基础模型微调与蒸馏

1. **基础模型微调**:
   - 微调Chinese-Mistral-7B使其专精于二次元文化与语言风格
   - 重点培养模型对二次元术语、表达方式和文化背景的理解
   - 使用高质量的二次元语料（动漫台词、轻小说翻译、弹幕语料等）

2. **基础模型蒸馏**:
   - 将微调后的Chinese-Mistral-7B知识蒸馏到小型学生模型（中文LLaMA-2 1.3B）
   - 使用响应蒸馏和特征蒸馏技术
   - 确保基础二次元能力成功转移到资源需求更低的模型

### 阶段2：专家模型创建与逐个集成

1. **专家模型开发**:
   从不同基础模型微调出各领域专家:

   **优先开发的核心专家**:
   - **二次元深度文化专家** (基于ChatGLM3-6B) - 作品分析、角色关系、创作背景
   - **二次元语言风格专家** (基于Qwen-7B) - 动漫角色口癖、特殊语态、情感表达
   - **ACGN知识库专家** (基于Baichuan2-7B) - 百科式准确知识，作品、人物、公司

   **后续开发的扩展专家**:
   - **网络安全专家** (基于ChatGLM3-6B) - 网络安全知识和安全建议
   - **逻辑推理专家** (基于DeepSeek-Math-7B) - 增强推理和问题解决能力
   - **视觉理解专家** (基于LLaVA) - 负责图像和屏幕内容的理解与分析
   - **语音功能专家**（Wenet-语音识别，Bark-语音合成）

2. **渐进式专家集成**:
   - 每次只集成一个专家能力到学生模型
   - 集成顺序遵循优先级：核心二次元能力优先，辅助能力次之
   - 每次集成后进行详细评估，确保新能力成功转移且不影响已有能力

3. **专家能力区分**:
   - 为每个专家设计特定提示模板标记（如`[EXPERT=ANIME]`）
   - 建立专家路由机制，确保问题导向合适的专家领域
   - 实现知识区域不冲突的边界管理

### 阶段3：综合优化与部署

1. **全局优化**:
   - 实现统一的语言风格协调层，确保不同专家知识输出保持一致的角色风格
   - 优化专家知识交界处的能力过渡
   - 建立知识冲突检测与解决机制

2. **资源优化**:
   - 实现专家能力的混合精度表示（核心能力高精度，辅助能力低精度）
   - 开发专家能力按需加载机制，优化内存使用
   - 建立动态缓存和预测系统，提高常用场景响应速度

3. **持续集成与改进**:
   - 建立反馈收集系统，自动识别薄弱能力领域
   - 实现增量训练机制，定期强化薄弱环节
   - 支持新专家模块的即插即用集成

### 蒸馏技术细节

1. **数据准备**:
   - 为每个专家领域准备特定的高质量数据集
   - 确保数据集涵盖该领域的核心能力和边缘案例
   - 保留通用对话数据（10-20%）防止知识遗忘

2. **蒸馏参数**:
   - 核心知识蒸馏：temperature=0.5-0.7，确保准确性和创造性平衡
   - 风格蒸馏：temperature=0.7-0.8，保持风格多样性
   - 事实知识蒸馏：temperature=0.3-0.5，强调准确性

3. **评估体系**:
   - 为每个专家能力建立专门的评估集
   - 定期进行全局能力测试，监控能力保持情况
   - 实施A/B测试，比较不同蒸馏策略的效果

## 项目结构

```
zishu-sensei/
├── README.md                 # 项目说明文档
├── requirements.txt          # 依赖管理
├── setup.py                  # 安装脚本
├── .gitignore                # Git忽略文件
├── config/                   # 配置文件目录
│   ├── default.json          # 默认配置
│   ├── model_config.json     # 模型相关配置
│   ├── logging_config.json   # 日志配置
│   ├── distillation/         # 蒸馏相关配置
│   │   ├── teachers.json     # 教师模型配置
│   │   ├── student.json      # 学生模型配置
│   │   ├── core_distill.json # 核心能力蒸馏配置
│   │   ├── expert_distill.json # 专家能力蒸馏配置
│   │   └── integration.json  # 能力集成配置
│   ├── character/            # 角色配置
│   │   └── default.json      # 默认角色设定
│   └── system/               # 系统配置
│       └── inference.json    # 推理配置
├── data/                     # 数据目录
│   ├── raw/                  # 原始数据
│   ├── processed/            # 处理后的数据
│   ├── training/             # 训练数据
│   ├── distillation/         # 蒸馏数据
│   │   ├── core/             # 核心能力蒸馏数据
│   │   ├── anime_culture/    # 二次元文化专家数据
│   │   ├── anime_language/   # 二次元语言专家数据
│   │   ├── acgn_knowledge/   # ACGN知识库数据
│   │   └── other_experts/    # 其他专家数据
│   ├── memory/               # 记忆存储
│   └── logs/                 # 日志文件
├── models/                   # 模型存储
│   ├── base/                 # 基础模型路径
│   │   └── chinese-mistral-7b/ # 基础Chinese-Mistral-7B模型
│   ├── teachers/             # 教师模型
│   │   ├── mistral_anime/    # 微调后的Chinese-Mistral-7B模型
│   │   ├── chatglm3_anime/   # 二次元深度文化专家
│   │   ├── qwen_anime/       # 二次元语言风格专家
│   │   ├── baichuan_acgn/    # ACGN知识库专家
│   │   ├── chatglm3_security/ # 网络安全专家
│   │   ├── deepseek_logic/   # 逻辑推理专家
│   │   └── llava_vision/     # 视觉理解专家
│   ├── student/              # 学生模型
│   │   ├── zishu-base/       # 基础学生模型
│   │   ├── zishu-anime/      # 集成二次元专家后的模型
│   │   ├── zishu-acgn/       # 集成ACGN知识后的模型
│   │   └── zishu-complete/   # 集成全部专家的模型
│   ├── adapters/             # 适配器存储
│   │   ├── mistral_anime/    # Chinese-Mistral-7B二次元适配器
│   │   ├── chatglm3_anime/   # ChatGLM3-6B二次元文化适配器
│   │   ├── qwen_anime/       # Qwen-7B二次元语言适配器
│   │   └── other_adapters/   # 其他专家适配器
│   └── quantized/            # 量化模型缓存
├── assets/                   # 项目资源
│   ├── images/               # 图像资源
│   │   ├── character/        # 角色图像
│   │   └── accessories/      # 配件图像(头饰等)
│   ├── animations/           # 动画资源
│   ├── audio/                # 音频资源
│   └── fonts/                # 字体资源
├── src/                      # 源代码
│   ├── __init__.py           # 初始化
│   ├── model/                # 模型相关
│   │   ├── __init__.py       # 初始化
│   │   ├── base.py           # 基础模型类
│   │   ├── quantization.py   # 量化实现
│   │   ├── lora.py           # LoRA实现
│   │   ├── inference.py      # 推理引擎
│   │   ├── training.py       # 训练引擎
│   │   ├── evaluation.py     # 评估工具
│   │   ├── distillation/     # 知识蒸馏实现
│   │   │   ├── __init__.py   # 初始化
│   │   │   ├── teacher.py    # 教师模型管理
│   │   │   ├── student.py    # 学生模型实现
│   │   │   ├── trainer.py    # 蒸馏训练器
│   │   │   ├── expert_integration.py # 专家集成器
│   │   │   └── losses.py     # 蒸馏损失函数
│   │   └── utils.py          # 模型工具
│   ├── character/            # 角色系统
│   │   ├── __init__.py       # 初始化
│   │   ├── base.py           # 基础角色类
│   │   ├── persona.py        # 人格管理
│   │   ├── appearance/       # 外观管理
│   │   │   ├── __init__.py   # 初始化
│   │   │   ├── base.py       # 基础外观类
│   │   │   ├── accessories.py # 配件系统(头饰等)
│   │   │   └── styles.py     # 风格管理
│   │   ├── memory/           # 记忆系统
│   │   │   ├── __init__.py   # 初始化
│   │   │   ├── base.py       # 基础记忆类
│   │   │   ├── short_term.py # 短期记忆
│   │   │   ├── long_term.py  # 长期记忆
│   │   │   └── retrieval.py  # 记忆检索
│   │   ├── dialogue.py       # 对话管理
│   │   ├── emotions.py       # 情感模拟
│   │   └── knowledge.py      # 知识体系
│   ├── interface/            # 接口层
│   │   ├── __init__.py       # 初始化
│   │   ├── base.py           # 基础接口类
│   │   ├── cli.py            # 命令行接口
│   │   ├── api/              # API接口
│   │   │   ├── __init__.py   # 初始化
│   │   │   ├── routes.py     # 路由定义
│   │   │   ├── models.py     # API模型
│   │   │   └── middleware.py # 中间件
│   │   ├── websocket.py      # WebSocket服务
│   │   ├── desktop_pet/      # 桌面宠物功能
│   │   │   ├── __init__.py   # 初始化
│   │   │   ├── pet.py        # 宠物主类
│   │   │   ├── animation.py  # 动画系统
│   │   │   ├── behavior.py   # 行为模式
│   │   │   ├── interaction.py # 交互功能
│   │   │   └── renderer.py   # 渲染引擎
│   │   └── gui/              # 图形界面(可选)
│   │       ├── __init__.py   # 初始化
│   │       ├── app.py        # GUI应用
│   │       ├── components.py # UI组件
│   │       └── customization.py # 外观定制功能
│   ├── data/                 # 数据处理
│   │   ├── __init__.py       # 初始化
│   │   ├── loader.py         # 数据加载
│   │   ├── processor.py      # 数据处理
│   │   ├── augmentation.py   # 数据增强
│   │   └── dataset.py        # 数据集创建
│   ├── vision/               # 视觉识别系统
│   │   ├── __init__.py       # 初始化
│   │   ├── screen_capture.py # 屏幕截图和捕获
│   │   ├── image_analysis.py # 图像处理和分析
│   │   ├── text_recognition.py # 屏幕文本识别
│   │   └── content_understanding.py # 内容理解
│   ├── speech/               # 语音处理系统
│   │   ├── __init__.py       # 初始化
│   │   ├── recognition.py    # 语音识别
│   │   ├── synthesis.py      # 语音合成
│   │   ├── voice_styles.py   # 语音风格管理
│   │   └── audio_processing.py # 音频处理
│   ├── utils/                # 工具函数
│   │   ├── __init__.py       # 初始化
│   │   ├── config.py         # 配置管理
│   │   ├── logger.py         # 日志工具
│   │   ├── metrics.py        # 指标计算
│   │   ├── prompts.py        # 提示模板
│   │   └── helpers.py        # 辅助函数
│   └── service/              # 服务层
│       ├── __init__.py       # 初始化
│       ├── engine.py         # 引擎核心
│       ├── scheduler.py      # 任务调度
│       ├── cache.py          # 缓存管理
│       └── monitoring.py     # 监控系统
├── scripts/                  # 脚本工具
│   ├── setup_env.py          # 环境设置
│   ├── download_model.py     # 下载模型
│   ├── prepare_data.py       # 准备数据
│   ├── train_core.py         # 核心模型训练脚本
│   ├── train_expert.py       # 专家模型训练脚本
│   ├── distill.py            # 蒸馏脚本
│   ├── evaluate.py           # 评估脚本
│   ├── quantize.py           # 量化脚本
│   └── export.py             # 导出模型
├── tests/                    # 测试
│   ├── __init__.py           # 初始化
│   ├── unit/                 # 单元测试
│   │   ├── test_model.py     # 模型测试
│   │   ├── test_character.py # 角色测试
│   │   ├── test_memory.py    # 记忆测试
│   │   └── test_desktop.py   # 桌面宠物测试
│   └── integration/          # 集成测试
│       └── test_system.py    # 系统测试
├── docs/                     # 文档
│   ├── architecture.md       # 架构文档
│   ├── experts/              # 专家模型文档
│   │   ├── anime_culture.md  # 二次元文化专家
│   │   ├── anime_language.md # 二次元语言专家
│   │   └── other_experts.md  # 其他专家
│   ├── distillation_roadmap.md # 蒸馏路线图
│   ├── api.md                # API文档
│   ├── desktop_pet.md        # 桌面宠物文档
│   └── deployment.md         # 部署文档
└── app.py                    # 主应用入口
```

本项目设计支持灵活的硬件升级路径：

1. **6-8GB显存**: 4位量化学生模型 + QLoRA微调
2. **12-16GB显存**: 8位量化教师模型 或 QLoRA微调教师模型
3. **24GB+显存**: 全精度教师模型 + 完整微调能力与并行训练

升级硬件后，只需修改`config/model_config.json`和`config/distillation`目录中的配置文件，
无需重新训练模型或修改代码结构。所有通过QLoRA训练的适配器都与全精度模型完全兼容。

## 开发路线图

本项目采用渐进式开发方法，按以下顺序推进：

### 第一阶段：基础框架与核心模型 (1-2个月)

1. **项目基础搭建**
   - 构建目录结构与配置系统
   - 设置开发环境与依赖管理
   - 实现基础日志与监控系统

2. **核心模型开发**
   - 实现Chinese-Mistral-7B二次元方向微调
   - 开发量化与推理系统
   - 构建模型评估框架

3. **基础蒸馏实现**
   - 将微调后的Chinese-Mistral-7B蒸馏到小型基础模型
   - 评估基础蒸馏效果
   - 优化蒸馏参数与策略

### 第二阶段：专家模型开发 (2-4个月)

1. **核心专家模型开发**
   - 二次元深度文化专家 (ChatGLM3-6B)
   - 二次元语言风格专家 (Qwen-7B)
   - ACGN知识库专家 (Baichuan2-7B)

2. **专家能力评估与优化**
   - 为每个专家建立专门评估集
   - 进行多轮微调和能力优化
   - 确保专家模型在各自领域达到最佳表现

3. **专家集成系统设计**
   - 开发专家身份标记系统
   - 实现专家知识路由机制
   - 构建增量集成框架

### 第三阶段：逐步专家集成 (2-3个月)

1. **二次元深度文化专家集成**
   - 将文化专家知识蒸馏到基础学生模型
   - 评估集成效果与知识保留
   - 优化文化领域响应质量

2. **二次元语言风格专家集成**
   - 集成语言风格能力到学生模型
   - 确保语言表达独特性与二次元特色
   - 优化角色一致性与对话自然度

3. **ACGN知识库专家集成**
   - 集成ACGN百科知识到学生模型
   - 平衡创造性与事实准确性
   - 建立知识更新机制

### 第四阶段：扩展功能与用户界面 (1-2个月)

1. **桌面宠物系统开发**
   - 实现基础桌面宠物框架
   - 开发角色动画与交互系统
   - 集成AI核心能力到桌面宠物

2. **API与服务层实现**
   - 开发RESTful API接口
   - 实现WebSocket服务
   - 构建服务监控与负载管理

3. **语音与视觉模块集成**
   - 实现基础语音交互能力
   - 开发屏幕内容理解功能
   - 与AI核心系统集成

### 第五阶段：优化与扩展专家 (持续进行)

1. **系统整体优化**
   - 性能调优与内存管理
   - 用户体验改进
   - 稳定性与错误处理增强

2. **扩展专家开发与集成**
   - 网络安全专家
   - 逻辑推理专家
   - 视觉理解专家
   - 其他领域专家按需开发

3. **社区与反馈系统**
   - 建立用户反馈收集机制
   - 开发增量学习系统
   - 支持模型能力持续优化

## 安装与使用

### 环境要求

- Python 3.8+
- CUDA 11.7+（推荐）
- 至少6GB显存的GPU（推荐12GB+）

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/zishu-sensei.git
cd zishu-sensei
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 下载模型（如果尚未下载）
```bash
python scripts/download_model.py
```

### 使用方法

1. 启动命令行对话
```bash
python app.py --mode cli
```

2. 启动API服务
```bash
python app.py --mode api --port 8000
```

3. 启动桌面宠物模式
```bash
python app.py --mode desktop [--accessory turtle|ribbon|flower|none]
```

4. 启动语音交互模式
```bash
python app.py --mode voice
```

5. 启动全功能模式
```bash
python app.py --mode full
```

## 桌面宠物功能

桌面宠物功能让Zishu-sensei可以作为虚拟助手直接显示在桌面上，特点包括：

1. **头部装饰系统**：
   - 默认提供多种可爱装饰物（小乌龟、蝴蝶结、花朵等）
   - 装饰物可以根据对话内容自动切换
   - 支持用户添加自定义装饰物

2. **交互方式**：
   - 点击装饰物触发特殊反应和动画
   - 拖拽角色在桌面上移动
   - 右键菜单提供快捷功能

3. **角色行为**：
   - 闲置时会展示随机动画
   - 根据对话内容展示情绪反应
   - 提供打字动画和语音反馈

4. **系统集成**：
   - 开机自启动选项
   - 系统托盘图标
   - 低资源占用设计

## 许可证

本项目采用MIT许可证。


更先进的量化技术
考虑实现GPTQ、AWQ或其他更先进的量化方法
探索动态量化或训练后量化
FlashAttention-2集成
考虑集成FlashAttention-2，它比标准SDPA提供更好的性能
优化器内存减少技术
探索使用Adafactor替代AdamW，内存占用更小
实现梯度压缩技术
数据并行训练
如果有多GPU，考虑实现数据并行训练
探索管道并行或张量并行
激活重计算策略优化
实现更精细的激活重计算策略，只对内存密集型层使用


# 创建新screen会话
screen -S train-mistral

# 在screen中运行训练
python scripts/train_mistral.py --config="/root/autodl-tmp/zishu-sensei/config/training_config.json" --model_config="/root/autodl-tmp/zishu-sensei/config/model_config.json"

# 按Ctrl+A然后D分离(保持在后台运行)

screen -r train-mistral

# Zishu-sensei(紫舒老师)

基于Chinese-Mistral-7B模型的中文版Anime风格AI虚拟角色项目。本项目使用量化技术适配低硬件条件下的模型训练和部署。

## 项目介绍

Zishu-sensei是参考Neuro-sama风格开发的中文虚拟AI角色，具有以下特点：

- 基于Chinese-Mistral-7B-v0.1大语言模型
- 使用4位量化技术降低硬件需求
- 通过QLoRA技术进行高效微调
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
- **记忆存储**: 向量数据库
- **框架**: Transformers, PEFT, Accelerate
- **桌面应用**: PyQt6/PySide6
- **语音处理**: SpeechRecognition, pyttsx3/gTTS
- **屏幕内容识别**: OpenCV, Tesseract OCR

## 多模型蒸馏架构

为了提升模型性能并优化资源使用，本项目采用多教师蒸馏（Multi-Teacher Distillation）架构，分为三个阶段实现：

### 阶段1：多教师模型微调

在此阶段，我们将微调多个强大的基础模型作为"教师模型"，每个模型专注于不同的能力方面：

**核心教师模型群组**：
1. **Chinese-Mistral-7B** - 提供基础中文理解和生成能力
2. **Qwen-7B** - 增强知识覆盖和指令跟随能力
3. **ChatGLM3-6B** - 优化中文对话和角色扮演能力

**专业教师模型群组**：
1. **角色塑造专家** - 专注于角色人格一致性和情感表达
2. **逻辑推理专家** - 增强推理和问题解决能力
3. **视觉理解专家** - 负责图像和屏幕内容的理解与分析
4. **语音功能专家** - 专注于语音识别与合成能力（Wenet+Bark）

**特殊功能教师模型**：
1. **RWKV** - 提供更高效的上下文处理和低延迟响应
2. **Baichuan2** - 增强中文文化知识理解
3. **SadTalker** - 实现表情和动画生成能力
4. **AnimeLCM** - 提供动漫风格增强功能

### 阶段2：多阶段知识蒸馏

采用渐进式蒸馏策略，通过多个阶段将教师模型的知识转移到学生模型：

**阶段2.1：核心能力蒸馏**
- 将核心教师模型（Chinese-Mistral-7B、Qwen-7B、ChatGLM3-6B）的知识蒸馏到基础学生模型（Zishu-Base）
- 使用响应蒸馏和特征蒸馏技术
- 优化基础语言理解、中文能力和对话能力

**阶段2.2：专业能力蒸馏**
- 整合专业能力教师（RWKV、Baichuan2）的专业知识
- 增强学生模型（Zishu-Enhanced）的低延迟响应和中文文化理解
- 使用选择性层级蒸馏，保留基础能力的同时融合专业能力

**阶段2.3：功能增强蒸馏**
- 融合特殊功能教师（SadTalker、AnimeLCM）的视觉生成能力
- 形成完整学生模型（Zishu-Complete）
- 使用任务特定蒸馏技术，针对不同功能使用不同蒸馏策略

### 阶段3：模型融合与部署优化

1. **学生模型结构**：
   - 基础学生模型：中文LLaMA-2 1.3B架构
   - 增强学生模型：添加专业任务适配层
   - 完整学生模型：集成多模态处理组件

2. **资源优化**：
   - 采用量化技术(INT4/INT8)降低内存占用
   - 使用KV缓存优化推理性能
   - 实现动态批处理以提高吞吐量

3. **动态路由系统**：
   - 根据输入类型自动选择合适的专业能力模块
   - 实现任务分流，优化资源使用
   - 支持混合精度推理

### 资源优化策略

为支持在不同硬件条件下高效运行模型，我们采用以下优化策略：

1. **梯度模型切换**：根据硬件条件自动选择合适精度的模型
2. **推理优化**：
   - FlashAttention加速注意力计算
   - Continuous Batching减少空闲时间
   - 模型并行处理提升吞吐量
3. **内存管理**：
   - 渐进式加载模型组件
   - 动态卸载不活跃模型组件
   - 适应性精度调整

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
│   │   ├── special_distill.json # 专业能力蒸馏配置
│   │   └── func_distill.json # 功能增强蒸馏配置
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
│   │   ├── special/          # 专业能力蒸馏数据
│   │   └── func/             # 功能增强蒸馏数据
│   ├── memory/               # 记忆存储
│   └── logs/                 # 日志文件
├── models/                   # 模型存储
│   ├── base/                 # 基础模型路径
│   ├── teachers/             # 教师模型
│   │   ├── core/             # 核心教师模型
│   │   │   ├── chinese-mistral-7b/ # Chinese-Mistral-7B模型
│   │   │   ├── qwen-7b/      # Qwen-7B模型
│   │   │   └── chatglm3-6b/  # ChatGLM3-6B模型
│   │   ├── specialist/       # 专家教师模型
│   │   │   ├── rwkv/         # RWKV（低延迟响应专家）
│   │   │   ├── baichuan2/    # Baichuan2（中文文化知识专家）
│   │   │   │── Vicuna-7B/ # 角色塑造专家模型
│   │   │   ├── DeepSeek-Math-7B/ # 逻辑推理专家模型
│   │   │   └── LLaVA/ # 视觉理解专家模型
│   │   │   └── speech-specialist/ # 语音功能专家模型（Wenet-语音识别，Bark-语音合成）
│   │   └── special/          # 特殊功能教师模型
│   │       ├── sadtalker/    # SadTalker模型
│   │       └── animelcm/     # AnimeLCM模型
│   ├── student/              # 学生模型
│   │   ├── zishu-base/       # 基础学生模型
│   │   ├── zishu-enhanced/   # 增强学生模型
│   │   └── zishu-complete/   # 完整学生模型
│   ├── adapters/             # 适配器存储
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
│   ├── train.py              # 训练脚本
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

## 开发顺序

本项目建议按照以下阶段推进开发，确保每一步都能产出可运行、可测试的成果：

---

### 阶段一：基础设施与核心功能

1. **项目初始化**
   - 搭建目录结构
   - 配置基础配置文件（如default.json、model_config.json等）
   - 编写requirements.txt，完成依赖环境搭建

2. **模型管理模块**
   - 实现基础模型加载与切换
   - 支持4位量化与QLoRA微调
   - 实现推理引擎与模型统一接口

3. **命令行与基础测试接口**
   - 实现CLI交互
   - 编写基础对话与推理测试脚本

---

### 阶段二：角色系统与记忆机制

4. **角色系统开发**
   - 实现角色基类与人格管理
   - 设计角色外观、头部装饰系统
   - 创建角色配置文件

5. **记忆系统开发**
   - 实现短期、长期记忆模块
   - 集成记忆检索与管理功能

6. **对话管理与情感模拟**
   - 实现对话流管理
   - 集成角色系统与记忆系统
   - 实现情感模拟与知识体系模块

---

### 阶段三：多模型蒸馏与专家能力集成

7. **教师模型准备与微调**
   - 配置并微调核心教师模型（Chinese-Mistral-7B、Qwen-7B、ChatGLM3-6B）
   - 配置并集成专家教师模型（RWKV、Baichuan2、Vicuna-7B、DeepSeek-Math-7B、LLaVA、speech-specialist）

8. **多阶段知识蒸馏**
   - 实现核心能力蒸馏（核心教师→学生模型）
   - 实现专业能力蒸馏（专家教师→增强学生模型）
   - 实现特殊功能蒸馏（如视觉、语音等）

9. **学生模型训练与评估**
   - 训练基础、增强、完整学生模型
   - 评估蒸馏效果与模型性能

---

### 阶段四：数据处理与性能优化

10. **数据处理与增强**
    - 实现数据加载、处理、增强模块
    - 构建训练与蒸馏数据集

11. **性能与资源优化**
    - 集成缓存机制与资源管理
    - 优化推理速度与内存占用
    - 支持动态模型切换与量化

---

### 阶段五：接口与桌面宠物系统

12. **API与交互接口**
    - 实现REST API与WebSocket服务
    - 编写API文档与测试用例

13. **桌面宠物系统开发**
    - 开发桌面宠物主框架
    - 实现角色动画、装饰互动、系统托盘等功能
    - 集成对话、记忆、情感等AI能力

---

### 阶段六：测试与部署

14. **测试体系建设**
    - 编写单元测试、集成测试
    - 进行性能与稳定性测试

15. **部署与文档完善**
    - 编写部署与使用文档
    - 完善容器化、监控与资源优化配置

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

4. 启动语音交互模式（需完成高级功能扩展）
```bash
python app.py --mode voice
```

5. 启动带屏幕识别的完整模式（需完成高级功能扩展）
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

## 语音交互功能

语音交互功能使Zishu-sensei能够通过语音进行自然对话，特点包括：

1. **语音识别**：
   - 实时语音输入识别
   - 多语言支持（主要为中文）
   - 降噪和环境适应

2. **语音合成**：
   - 角色专属语音风格
   - 情感表达语调变化
   - 可调节的语速和音量

3. **交互体验**：
   - 语音激活唤醒（可选）
   - 自然对话流程
   - 语音反馈与提示

4. **系统集成**：
   - 与桌面宠物无缝结合
   - 低延迟设计
   - 离线模式支持

## 屏幕内容识别功能

屏幕内容识别功能让Zishu-sensei能够理解和分析用户屏幕上的内容，特点包括：

1. **文本识别**：
   - 屏幕文本提取和识别
   - 多语言文本支持
   - 结构化数据识别（表格、列表等）

2. **内容分析**：
   - 识别界面元素和布局
   - 理解上下文关系
   - 提取关键信息

3. **智能助手能力**：
   - 基于屏幕内容提供建议
   - 辅助完成屏幕上的任务
   - 回答与屏幕内容相关的问题

4. **隐私保护**：
   - 本地处理所有屏幕数据
   - 可配置的识别区域
   - 屏蔽敏感信息选项

## 许可证

本项目采用MIT许可证。

## 贡献指南

欢迎贡献代码、报告问题或提供改进建议。请参阅[贡献指南](docs/CONTRIBUTING.md)了解更多信息。
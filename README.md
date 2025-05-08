 # Zishu-sensei

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

## 技术栈

- **基础模型**: Chinese-Mistral-7B-v0.1
- **量化方法**: 4-bit量化（BitsAndBytes）
- **微调技术**: QLoRA低秩适应
- **记忆存储**: 向量数据库
- **框架**: Transformers, PEFT, Accelerate
- **桌面应用**: PyQt6/PySide6

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
│   ├── character/            # 角色配置
│   │   └── default.json      # 默认角色设定
│   └── system/               # 系统配置
│       └── inference.json    # 推理配置
├── data/                     # 数据目录
│   ├── raw/                  # 原始数据
│   ├── processed/            # 处理后的数据
│   ├── training/             # 训练数据
│   ├── memory/               # 记忆存储
│   └── logs/                 # 日志文件
├── models/                   # 模型存储
│   ├── base/                 # 基础模型路径
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

1. **6-8GB显存**: 4位量化 + QLoRA (当前配置)
2. **12-16GB显存**: 8位量化 或 QLoRA微调
3. **24GB+显存**: 全精度模型 + 完整微调能力

升级硬件后，只需修改`config/model_config.json`中的量化设置，
无需重新训练模型或修改代码结构。所有通过QLoRA训练的
适配器都与全精度模型完全兼容。

## 开发顺序

本项目按照以下顺序进行开发，确保每个阶段都有可运行的成果：

### 阶段一：基础设施与核心功能

1. **项目初始化**
   - 创建目录结构
   - 设置基本配置文件
   - 编写requirements.txt

2. **模型管理模块**
   - 实现基础模型加载功能
   - 实现4位量化功能
   - 实现推理引擎

3. **简单测试接口**
   - 实现命令行交互界面
   - 创建基本对话测试脚本

### 阶段二：角色设计与记忆系统

4. **角色系统**
   - 实现角色基类
   - 实现人格管理
   - 创建角色配置文件
   - 设计角色外观与头部装饰系统

5. **记忆系统**
   - 实现记忆基类
   - 实现短期和长期记忆模块
   - 实现记忆检索功能

6. **对话管理**
   - 实现对话流管理
   - 集成角色系统和记忆系统

### 阶段三：数据处理与微调

7. **数据处理**
   - 实现数据处理模块
   - 创建数据集类
   - 准备训练数据

8. **模型微调**
   - 实现LoRA适配器
   - 实现训练引擎
   - 执行微调训练

### 阶段四：优化与扩展

9. **性能优化**
   - 实现缓存机制
   - 优化推理速度
   - 添加资源管理

10. **API接口**
    - 实现REST API
    - 实现WebSocket服务
    - 编写API文档

11. **桌面宠物实现**
    - 开发桌面宠物框架
    - 实现角色动画系统
    - 添加头部装饰系统（小乌龟、蝴蝶结、花朵等）
    - 实现装饰物互动效果（点击反应）
    - 基于对话内容选择适合的装饰物
    - 集成对话与交互功能

12. **用户界面（可选）**
    - 实现Web界面
    - 添加语音/视觉接口

### 阶段五：测试与部署

13. **测试系统**
    - 编写单元测试
    - 进行集成测试
    - 执行性能测试

14. **部署准备**
    - 编写部署文档
    - 创建容器化配置
    - 设置监控系统

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

## 贡献指南

欢迎贡献代码、报告问题或提供改进建议。请参阅[贡献指南](docs/CONTRIBUTING.md)了解更多信息。
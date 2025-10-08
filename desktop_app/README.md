# 🐾 Zishu-sensei 桌面宠物应用开发指南

## 📋 项目概述

**Zishu-sensei Desktop Pet** 是一个基于 Tauri + React + Live2D 的智能桌面宠物应用，提供：

- 🎭 **Live2D 角色展示** - 可爱的桌面宠物形象
- 💬 **智能对话交互** - 基于适配器系统的AI对话
- ⚙️ **右击设置菜单** - 便捷的功能配置
- 🔧 **适配器管理** - 插件化功能扩展
- 🎨 **主题切换** - 多种视觉风格
- 📱 **系统托盘** - 后台运行和快捷操作

## 🏗️ 项目文件结构

```
desktop_app/
├── README.md                           # 本开发指南
├── package.json                        # 前端项目配置
├── tsconfig.json                       # TypeScript 配置
├── vite.config.ts                      # Vite 构建配置
├── tailwind.config.js                  # Tailwind CSS 配置
├── .env.example                        # 环境变量示例
├── .gitignore                          # Git 忽略配置
│
├── src-tauri/                          # 🦀 Tauri Rust 后端
│   ├── Cargo.toml                      # Rust 依赖配置
│   ├── tauri.conf.json                 # Tauri 应用配置
│   ├── build.rs                        # 构建脚本
│   ├── icons/                          # 应用图标资源
│   │   ├── icon.ico                    # Windows 图标
│   │   ├── icon.icns                   # macOS 图标
│   │   └── icon.png                    # 通用图标
│   └── src/
│       ├── main.rs                     # 主入口文件
│       ├── lib.rs                      # 库定义和导出
│       ├── commands/                   # Tauri 命令模块
│       │   ├── mod.rs                  # 命令模块导出
│       │   ├── chat.rs                 # 对话相关命令
│       │   ├── desktop.rs              # 桌面操作命令  
│       │   ├── system.rs               # 系统信息命令
│       │   ├── adapter.rs              # 适配器管理命令
│       │   └── settings.rs             # 设置管理命令
│       ├── events/                     # 事件处理模块
│       │   ├── mod.rs                  # 事件模块导出
│       │   ├── window.rs               # 窗口事件处理
│       │   ├── desktop.rs              # 桌面事件处理
│       │   └── tray.rs                 # 托盘事件处理
│       ├── utils/                      # 工具函数模块
│       │   ├── mod.rs                  # 工具模块导出
│       │   ├── bridge.rs               # Python API 桥接
│       │   ├── config.rs               # 配置管理
│       │   └── logger.rs               # 日志系统
│       └── state/                      # 应用状态管理
│           ├── mod.rs                  # 状态模块导出
│           ├── app_state.rs            # 应用全局状态
│           └── settings.rs             # 设置状态管理
│
├── src/                                # ⚛️ React 前端源码
│   ├── main.tsx                        # React 应用入口
│   ├── App.tsx                         # 主应用组件
│   ├── vite-env.d.ts                   # Vite 类型定义
│   │
│   ├── components/                     # 📦 UI 组件库
│   │   ├── index.ts                    # 组件统一导出
│   │   ├── common/                     # 通用组件
│   │   │   ├── Button/                 # 按钮组件
│   │   │   │   ├── index.tsx
│   │   │   │   ├── Button.module.css
│   │   │   │   └── types.ts
│   │   │   ├── Modal/                  # 模态框组件
│   │   │   │   ├── index.tsx
│   │   │   │   ├── Modal.module.css
│   │   │   │   └── types.ts
│   │   │   ├── Loading/                # 加载组件
│   │   │   │   ├── index.tsx
│   │   │   │   └── Loading.module.css
│   │   │   └── Tooltip/                # 提示组件
│   │   │       ├── index.tsx
│   │   │       └── Tooltip.module.css
│   │   │
│   │   ├── Character/                  # 🎭 角色展示组件
│   │   │   ├── index.tsx               # 角色组件入口
│   │   │   ├── Live2D/                 # Live2D 相关
│   │   │   │   ├── index.tsx           # Live2D 组件
│   │   │   │   ├── Live2DViewer.tsx    # Live2D 查看器
│   │   │   │   ├── Live2DController.tsx # Live2D 控制器
│   │   │   │   └── types.ts            # Live2D 类型定义
│   │   │   ├── Animations/             # 动画控制
│   │   │   │   ├── index.tsx           # 动画组件
│   │   │   │   ├── AnimationPlayer.tsx # 动画播放器
│   │   │   │   └── animations.ts       # 动画配置
│   │   │   └── Character.module.css    # 角色样式
│   │   │
│   │   ├── Chat/                       # 💬 对话组件
│   │   │   ├── index.tsx               # 对话组件入口
│   │   │   ├── MessageList/            # 消息列表
│   │   │   │   ├── index.tsx
│   │   │   │   ├── MessageItem.tsx     # 消息项
│   │   │   │   └── MessageList.module.css
│   │   │   ├── InputBox/               # 输入框
│   │   │   │   ├── index.tsx
│   │   │   │   ├── InputBox.module.css
│   │   │   │   └── types.ts
│   │   │   ├── VoiceInput/             # 语音输入
│   │   │   │   ├── index.tsx
│   │   │   │   └── VoiceInput.module.css
│   │   │   └── Chat.module.css         # 对话样式
│   │   │
│   │   ├── Settings/                   # ⚙️ 设置组件
│   │   │   ├── index.tsx               # 设置组件入口
│   │   │   ├── GeneralSettings/        # 通用设置
│   │   │   │   ├── index.tsx
│   │   │   │   └── GeneralSettings.module.css
│   │   │   ├── CharacterSettings/      # 角色设置
│   │   │   │   ├── index.tsx
│   │   │   │   └── CharacterSettings.module.css
│   │   │   ├── AdapterSettings/        # 适配器设置
│   │   │   │   ├── index.tsx
│   │   │   │   ├── AdapterList.tsx     # 适配器列表
│   │   │   │   └── AdapterSettings.module.css
│   │   │   ├── ThemeSettings/          # 主题设置
│   │   │   │   ├── index.tsx
│   │   │   │   └── ThemeSettings.module.css
│   │   │   └── Settings.module.css     # 设置样式
│   │   │
│   │   ├── Desktop/                    # 🖥️ 桌面操作组件
│   │   │   ├── index.tsx               # 桌面组件入口
│   │   │   ├── WorkflowEditor/         # 工作流编辑器
│   │   │   │   ├── index.tsx
│   │   │   │   └── WorkflowEditor.module.css
│   │   │   ├── TaskMonitor/            # 任务监控
│   │   │   │   ├── index.tsx
│   │   │   │   └── TaskMonitor.module.css
│   │   │   └── Desktop.module.css      # 桌面样式
│   │   │
│   │   └── Layout/                     # 🏗️ 布局组件
│   │       ├── index.tsx               # 布局组件入口
│   │       ├── PetWindow/              # 宠物窗口布局
│   │       │   ├── index.tsx
│   │       │   └── PetWindow.module.css
│   │       ├── SettingsWindow/         # 设置窗口布局
│   │       │   ├── index.tsx
│   │       │   └── SettingsWindow.module.css
│   │       └── TrayMenu/               # 托盘菜单
│   │           ├── index.tsx
│   │           └── TrayMenu.module.css
│   │
│   ├── hooks/                          # 🎣 React Hooks
│   │   ├── index.ts                    # Hooks 统一导出
│   │   ├── useChat.ts                  # 对话逻辑 Hook
│   │   ├── useDesktop.ts               # 桌面操作 Hook
│   │   ├── useSettings.ts              # 设置管理 Hook
│   │   ├── useLive2D.ts                # Live2D 控制 Hook
│   │   ├── useAdapter.ts               # 适配器管理 Hook
│   │   ├── useTheme.ts                 # 主题切换 Hook
│   │   └── useTauri.ts                 # Tauri 通信 Hook
│   │
│   ├── services/                       # 🔧 前端服务层
│   │   ├── index.ts                    # 服务统一导出
│   │   ├── api/                        # API 服务
│   │   │   ├── index.ts                # API 统一导出
│   │   │   ├── chat.ts                 # 对话 API
│   │   │   ├── desktop.ts              # 桌面操作 API
│   │   │   ├── adapter.ts              # 适配器 API
│   │   │   └── system.ts               # 系统 API
│   │   ├── tauri/                      # Tauri 服务
│   │   │   ├── index.ts                # Tauri 统一导出
│   │   │   ├── commands.ts             # 命令调用
│   │   │   ├── events.ts               # 事件监听
│   │   │   └── window.ts               # 窗口管理
│   │   ├── live2d/                     # Live2D 服务
│   │   │   ├── index.ts                # Live2D 统一导出
│   │   │   ├── loader.ts               # 模型加载器
│   │   │   ├── animation.ts            # 动画控制
│   │   │   └── interaction.ts          # 交互逻辑
│   │   └── storage/                    # 存储服务
│   │       ├── index.ts                # 存储统一导出
│   │       ├── settings.ts             # 设置存储
│   │       └── cache.ts                # 缓存管理
│   │
│   ├── stores/                         # 📊 状态管理
│   │   ├── index.ts                    # Store 统一导出
│   │   ├── chatStore.ts                # 对话状态
│   │   ├── desktopStore.ts             # 桌面状态  
│   │   ├── settingsStore.ts            # 设置状态
│   │   ├── characterStore.ts           # 角色状态
│   │   ├── adapterStore.ts             # 适配器状态
│   │   └── themeStore.ts               # 主题状态
│   │
│   ├── styles/                         # 🎨 样式文件
│   │   ├── index.css                   # 全局样式入口
│   │   ├── globals.css                 # 全局基础样式
│   │   ├── variables.css               # CSS 变量定义
│   │   ├── components.css              # 组件通用样式
│   │   ├── animations.css              # 动画样式
│   │   └── themes/                     # 主题样式
│   │       ├── index.ts                # 主题统一导出
│   │       ├── anime.css               # 动漫主题
│   │       ├── dark.css                # 暗色主题
│   │       ├── light.css               # 亮色主题
│   │       └── cyberpunk.css           # 赛博朋克主题
│   │
│   ├── types/                          # 📝 TypeScript 类型定义
│   │   ├── index.ts                    # 类型统一导出
│   │   ├── chat.ts                     # 对话相关类型
│   │   ├── desktop.ts                  # 桌面操作类型
│   │   ├── settings.ts                 # 设置相关类型
│   │   ├── character.ts                # 角色相关类型
│   │   ├── adapter.ts                  # 适配器类型
│   │   ├── live2d.ts                   # Live2D 类型
│   │   └── common.ts                   # 通用类型
│   │
│   ├── utils/                          # 🛠️ 工具函数
│   │   ├── index.ts                    # 工具统一导出
│   │   ├── constants.ts                # 常量定义
│   │   ├── helpers.ts                  # 辅助函数
│   │   ├── formatters.ts               # 格式化函数
│   │   ├── validators.ts               # 验证函数
│   │   ├── logger.ts                   # 前端日志
│   │   └── debounce.ts                 # 防抖节流
│   │
│   └── assets/                         # 🎭 静态资源
│       ├── live2d/                     # Live2D 模型资源
│       │   ├── shizuku/                # 角色1: 志鹤
│       │   │   ├── model.json          # 模型配置
│       │   │   ├── textures/           # 贴图文件
│       │   │   └── motions/            # 动作文件
│       │   ├── hiyori/                 # 角色2: 日和
│       │   │   ├── model.json
│       │   │   ├── textures/
│       │   │   └── motions/
│       │   └── configs/                # Live2D 配置
│       ├── images/                     # 图片资源
│       │   ├── icons/                  # 图标文件
│       │   ├── backgrounds/            # 背景图片
│       │   └── ui/                     # UI 元素图片
│       ├── sounds/                     # 音频资源
│       │   ├── voice/                  # 语音文件
│       │   ├── effects/                # 音效文件
│       │   └── bgm/                    # 背景音乐
│       └── fonts/                      # 字体文件
│
├── public/                             # 📁 公共静态资源
│   ├── index.html                      # HTML 模板
│   ├── favicon.ico                     # 网站图标
│   ├── manifest.json                   # PWA 配置
│   └── robots.txt                      # 爬虫配置
│
├── dist/                               # 📦 构建输出目录
│   ├── bundle/                         # 打包后的文件
│   └── assets/                         # 处理后的资源
│
├── scripts/                            # 📜 构建和部署脚本
│   ├── build.sh                        # 构建脚本
│   ├── dev.sh                          # 开发脚本
│   ├── package.sh                      # 打包脚本
│   ├── clean.sh                        # 清理脚本
│   └── setup.py                        # 环境设置
│
├── docs/                               # 📚 项目文档
│   ├── API.md                          # API 接口文档
│   ├── COMPONENTS.md                   # 组件使用文档
│   ├── DEVELOPMENT.md                  # 开发指南
│   ├── DEPLOYMENT.md                   # 部署指南
│   └── TROUBLESHOOTING.md              # 故障排除
│
├── tests/                              # 🧪 测试文件
│   ├── unit/                           # 单元测试
│   ├── integration/                    # 集成测试
│   ├── e2e/                            # 端到端测试
│   └── fixtures/                       # 测试数据
│
└── config/                             # ⚙️ 配置文件
    ├── development.json                # 开发环境配置
    ├── production.json                 # 生产环境配置
    └── settings.schema.json            # 配置模式验证
```

## ⏰ 详细时间规划 (12周完整开发)

### 🎯 总体里程碑

| 里程碑 | 时间   | 主要成果     | 验收标准                         |
| ------ | ------ | ------------ | -------------------------------- |
| **M1** | 第2周  | 基础架构搭建 | Tauri + React 运行，基本窗口显示 |
| **M2** | 第4周  | Live2D 集成  | 角色模型显示，基础交互           |
| **M3** | 第6周  | 对话系统     | 完整对话功能，API 对接           |
| **M4** | 第8周  | 设置系统     | 右击菜单，设置面板完成           |
| **M5** | 第10周 | 适配器集成   | 适配器管理，功能扩展             |
| **M6** | 第12周 | 完整MVP      | 打包发布，功能完整               |

### 📅 详细开发计划

#### **第1-2周：基础架构搭建** 🏗️

**第1周（Rust后端基础）**
- **第1天 (4h)**: `src-tauri/Cargo.toml` - 依赖配置，Tauri 基础设置
- **第2天 (6h)**: `src-tauri/src/main.rs` - 主入口，窗口配置，系统托盘
- **第3天 (6h)**: `src-tauri/tauri.conf.json` - 应用配置，权限设置，图标配置
- **第4天 (4h)**: `src-tauri/src/lib.rs` - 库定义，模块导出
- **第5天 (4h)**: `src-tauri/src/commands/mod.rs` - 命令模块结构搭建

**第2周（前端基础框架）**
- **第1天 (6h)**: 
  - `package.json` (1h) - 项目配置，依赖管理
  - `vite.config.ts` (2h) - 构建配置，开发服务器
  - `src/main.tsx` (3h) - React 入口，基础路由
- **第2天 (6h)**:
  - `src/App.tsx` (3h) - 主应用组件，布局结构
  - `tailwind.config.js` (1h) - 样式配置
  - `src/styles/globals.css` (2h) - 全局样式，CSS 变量
- **第3天 (6h)**:
  - `src/components/Layout/PetWindow/index.tsx` (4h) - 宠物窗口布局
  - `src/components/common/Button/index.tsx` (2h) - 通用按钮组件
- **第4天 (4h)**:
  - `src/services/tauri/index.ts` (2h) - Tauri 通信封装
  - `src/hooks/useTauri.ts` (2h) - Tauri Hook 封装
- **第5天 (4h)**:
  - 项目整合测试，基础功能验证

#### **第3-4周：Live2D 角色系统** 🎭

**第3周（Live2D 基础集成）**
- **第1天 (8h)**:
  - `src/services/live2d/loader.ts` (4h) - Live2D 模型加载器
  - `src/assets/live2d/shizuku/` (4h) - 角色资源整理
- **第2天 (8h)**:
  - `src/components/Character/Live2D/Live2DViewer.tsx` (6h) - Live2D 查看器组件  
  - `src/types/live2d.ts` (2h) - Live2D 类型定义
- **第3天 (6h)**:
  - `src/components/Character/Live2D/Live2DController.tsx` (4h) - Live2D 控制器
  - `src/hooks/useLive2D.ts` (2h) - Live2D Hook
- **第4天 (6h)**:
  - `src/services/live2d/animation.ts` (3h) - 动画控制服务
  - `src/components/Character/Animations/AnimationPlayer.tsx` (3h) - 动画播放器
- **第5天 (4h)**:
  - Live2D 基础功能测试，动画播放验证

**第4周（角色交互系统）**
- **第1天 (6h)**:
  - `src/services/live2d/interaction.ts` (3h) - 交互逻辑处理
  - `src/components/Character/index.tsx` (3h) - 角色组件入口
- **第2天 (6h)**:
  - `src/stores/characterStore.ts` (3h) - 角色状态管理
  - `src/components/Character/Animations/animations.ts` (3h) - 动画配置
- **第3天 (6h)**:
  - `src/components/Character/Character.module.css` (3h) - 角色样式
  - `src/styles/animations.css` (3h) - 动画样式定义
- **第4天 (4h)**:
  - `src/assets/live2d/hiyori/` (2h) - 第二个角色资源
  - `src/assets/live2d/configs/` (2h) - Live2D 配置文件
- **第5天 (4h)**:
  - 角色系统集成测试，多角色切换验证

#### **第5-6周：对话交互系统** 💬

**第5周（对话后端对接）**
- **第1天 (6h)**:
  - `src-tauri/src/commands/chat.rs` (4h) - 对话相关Rust命令
  - `src-tauri/src/utils/bridge.rs` (2h) - Python API 桥接
- **第2天 (6h)**:
  - `src/services/api/chat.ts` (3h) - 对话 API 服务
  - `src/hooks/useChat.ts` (3h) - 对话逻辑 Hook
- **第3天 (6h)**:
  - `src/stores/chatStore.ts` (3h) - 对话状态管理
  - `src/types/chat.ts` (3h) - 对话类型定义
- **第4天 (6h)**:
  - `src/components/Chat/MessageList/index.tsx` (3h) - 消息列表组件
  - `src/components/Chat/MessageList/MessageItem.tsx` (3h) - 消息项组件
- **第5天 (4h)**:
  - 对话后端功能测试，API 连接验证

**第6周（对话前端界面）**
- **第1天 (6h)**:
  - `src/components/Chat/InputBox/index.tsx` (4h) - 输入框组件
  - `src/components/Chat/index.tsx` (2h) - 对话组件入口
- **第2天 (6h)**:
  - `src/components/Chat/VoiceInput/index.tsx` (4h) - 语音输入组件
  - `src/components/Chat/Chat.module.css` (2h) - 对话样式
- **第3天 (6h)**:
  - `src/utils/formatters.ts` (2h) - 消息格式化工具
  - `src/utils/validators.ts` (2h) - 输入验证工具
  - `src/components/Chat/MessageList/MessageList.module.css` (2h) - 消息列表样式
- **第4天 (6h)**:
  - `src/components/Chat/InputBox/InputBox.module.css` (2h) - 输入框样式
  - `src/components/Chat/VoiceInput/VoiceInput.module.css` (2h) - 语音输入样式
  - `src/assets/sounds/effects/` (2h) - 音效资源整理
- **第5天 (4h)**:
  - 对话系统完整测试，前后端联调

#### **第7-8周：设置管理系统** ⚙️

**第7周（设置后端系统）**
- **第1天 (6h)**:
  - `src-tauri/src/commands/settings.rs` (4h) - 设置管理Rust命令
  - `src-tauri/src/state/settings.rs` (2h) - 设置状态管理
- **第2天 (6h)**:
  - `src-tauri/src/events/window.rs` (3h) - 窗口事件处理
  - `src-tauri/src/events/tray.rs` (3h) - 托盘事件处理
- **第3天 (6h)**:
  - `src-tauri/src/utils/config.rs` (3h) - 配置管理工具
  - `src/services/storage/settings.ts` (3h) - 设置存储服务
- **第4天 (6h)**:
  - `src/hooks/useSettings.ts` (3h) - 设置管理 Hook
  - `src/stores/settingsStore.ts` (3h) - 设置状态管理
- **第5天 (4h)**:
  - `src/types/settings.ts` (2h) - 设置类型定义
  - `config/settings.schema.json` (2h) - 配置模式验证

**第8周（设置前端界面）**
- **第1天 (6h)**:
  - `src/components/Settings/index.tsx` (3h) - 设置组件入口
  - `src/components/Settings/GeneralSettings/index.tsx` (3h) - 通用设置
- **第2天 (6h)**:
  - `src/components/Settings/CharacterSettings/index.tsx` (3h) - 角色设置
  - `src/components/Settings/ThemeSettings/index.tsx` (3h) - 主题设置
- **第3天 (6h)**:
  - `src/components/Layout/SettingsWindow/index.tsx` (3h) - 设置窗口布局
  - `src/components/Layout/TrayMenu/index.tsx` (3h) - 托盘菜单
- **第4天 (6h)**:
  - `src/hooks/useTheme.ts` (2h) - 主题切换 Hook
  - `src/stores/themeStore.ts` (2h) - 主题状态管理
  - `src/styles/themes/` (2h) - 多主题样式文件
- **第5天 (4h)**:
  - 设置系统完整测试，右击菜单验证

#### **第9-10周：适配器管理系统** 🔧

**第9周（适配器后端集成）**
- **第1天 (6h)**:
  - `src-tauri/src/commands/adapter.rs` (4h) - 适配器管理Rust命令
  - `src/services/api/adapter.ts` (2h) - 适配器 API 服务
- **第2天 (6h)**:
  - `src/hooks/useAdapter.ts` (3h) - 适配器管理 Hook
  - `src/stores/adapterStore.ts` (3h) - 适配器状态管理
- **第3天 (6h)**:
  - `src/types/adapter.ts` (3h) - 适配器类型定义
  - `src/services/api/desktop.ts` (3h) - 桌面操作 API
- **第4天 (6h)**:
  - `src/hooks/useDesktop.ts` (3h) - 桌面操作 Hook
  - `src/stores/desktopStore.ts` (3h) - 桌面状态管理
- **第5天 (4h)**:
  - 适配器后端功能测试，API 连接验证

**第10周（适配器前端管理）**
- **第1天 (6h)**:
  - `src/components/Settings/AdapterSettings/index.tsx` (4h) - 适配器设置
  - `src/components/Settings/AdapterSettings/AdapterList.tsx` (2h) - 适配器列表
- **第2天 (6h)**:
  - `src/components/Desktop/index.tsx` (3h) - 桌面组件入口
  - `src/components/Desktop/WorkflowEditor/index.tsx` (3h) - 工作流编辑器
- **第3天 (6h)**:
  - `src/components/Desktop/TaskMonitor/index.tsx` (3h) - 任务监控组件
  - `src/types/desktop.ts` (3h) - 桌面操作类型
- **第4天 (6h)**:
  - `src/utils/constants.ts` (2h) - 常量定义
  - `src/utils/helpers.ts` (2h) - 辅助函数
  - `src/utils/debounce.ts` (2h) - 防抖节流工具
- **第5天 (4h)**:
  - 适配器系统完整测试，工作流编辑验证

#### **第11-12周：系统完善与发布** 🚀

**第11周（系统优化完善）**
- **第1天 (6h)**:
  - `src/utils/logger.ts` (2h) - 前端日志系统
  - `src-tauri/src/utils/logger.rs` (2h) - 后端日志系统  
  - `src/services/storage/cache.ts` (2h) - 缓存管理
- **第2天 (6h)**:
  - `src/components/common/Modal/index.tsx` (2h) - 模态框组件
  - `src/components/common/Loading/index.tsx` (2h) - 加载组件
  - `src/components/common/Tooltip/index.tsx` (2h) - 提示组件
- **第3天 (6h)**:
  - `src/styles/variables.css` (2h) - CSS 变量优化
  - `src/styles/components.css` (2h) - 组件通用样式
  - `tests/unit/` (2h) - 单元测试编写
- **第4天 (6h)**:
  - 性能优化，内存泄漏检查
  - 用户体验优化，交互细节完善
- **第5天 (4h)**:
  - 全功能集成测试，稳定性验证

**第12周（打包发布准备）**
- **第1天 (6h)**:
  - `scripts/build.sh` (2h) - 构建脚本完善
  - `scripts/package.sh` (2h) - 打包脚本编写
  - `docs/API.md` (2h) - API 文档编写
- **第2天 (6h)**:
  - `docs/DEVELOPMENT.md` (2h) - 开发指南文档
  - `docs/DEPLOYMENT.md` (2h) - 部署指南文档
  - `docs/TROUBLESHOOTING.md` (2h) - 故障排除文档
- **第3天 (6h)**:
  - `tests/integration/` (3h) - 集成测试完善
  - `tests/e2e/` (3h) - 端到端测试编写
- **第4天 (6h)**:
  - 最终打包测试，安装包验证
  - 多平台兼容性测试
- **第5天 (4h)**:
  - 发布准备，版本标记，文档最终检查

## 🏗️ 解耦合架构设计

### 📦 分层架构模式

```
┌─────────────────────────────────────┐
│         🎨 表示层 (UI Layer)          │
│   React Components │ Styles │ Assets │
├─────────────────────────────────────┤
│        🎣 逻辑层 (Logic Layer)        │
│    Hooks │ Stores │ Services         │
├─────────────────────────────────────┤
│        🔧 服务层 (Service Layer)       │
│  API Client │ Tauri Bridge │ Live2D │
├─────────────────────────────────────┤
│        🦀 系统层 (System Layer)        │
│  Rust Commands │ Event Handlers      │
└─────────────────────────────────────┘
```

### 🧩 模块化设计原则

#### **1. 单一职责原则**
- 每个组件只负责一个明确的功能
- 服务层按功能领域拆分（chat、desktop、adapter等）
- Hook 按业务逻辑分离

#### **2. 依赖注入模式**
- 通过 Context Provider 注入全局依赖
- Service 层统一管理外部依赖
- 配置驱动的功能开关

#### **3. 发布订阅模式**
- Tauri Event 系统处理跨进程通信
- React 状态管理采用 Zustand
- 组件间通过 Event Bus 通信

#### **4. 插件化架构**
- 适配器采用统一接口设计
- 主题系统支持动态切换
- Live2D 模型支持热插拔

### 🔌 接口设计规范

#### **API 接口层**
```typescript
// 统一的 API 响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

// 命令接口规范
interface TauriCommand<T> {
  name: string;
  payload?: any;
  callback?: (result: T) => void;
}
```

#### **组件接口层**
```typescript
// 组件 Props 接口
interface ComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// 组件状态接口
interface ComponentState {
  loading: boolean;
  error?: string;
  data?: any;
}
```

#### **服务接口层**
```typescript
// 服务基类
interface BaseService {
  init(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): boolean;
}

// 适配器接口
interface Adapter {
  id: string;
  name: string;
  version: string;
  execute(params: any): Promise<any>;
}
```

## 🐾 桌面宠物功能特性

### 🎭 Live2D 角色系统

#### **角色特性**
- **多角色支持**: 志鹤、日和等多个可选角色
- **动态表情**: 根据对话内容自动切换表情
- **交互动画**: 点击、拖拽等交互触发动画
- **空闲动作**: 随机播放空闲时的可爱动作

#### **技术实现**
```typescript
// Live2D 控制器
class Live2DController {
  private model: Live2DModel;
  private animator: AnimationController;
  
  // 表情控制
  setExpression(expression: string): void;
  
  // 动作播放
  playMotion(motion: string): Promise<void>;
  
  // 交互处理
  handleInteraction(type: InteractionType): void;
}
```

### ⚙️ 右击设置菜单

#### **菜单结构**
```
右击菜单
├── 💬 开始对话              # 打开聊天窗口
├── ⚙️ 设置                 # 打开设置面板
│   ├── 🎭 角色设置          # 切换角色、调整大小
│   ├── 🎨 主题设置          # 切换主题风格
│   ├── 🔧 适配器管理        # 管理已安装适配器
│   ├── 🔊 声音设置          # 音效、语音设置
│   └── 📱 系统设置          # 开机启动、快捷键
├── 🔄 适配器市场            # 浏览和安装适配器
├── 📋 工作流编辑器          # 创建自动化流程
├── ℹ️ 关于                 # 版本信息、帮助
└── ❌ 退出                 # 关闭应用
```

#### **技术实现**
```rust
// Tauri 系统托盘菜单
fn create_tray_menu() -> SystemTrayMenu {
    SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("chat", "开始对话"))
        .add_submenu(SystemTraySubmenu::new(
            "设置",
            SystemTrayMenu::new()
                .add_item(CustomMenuItem::new("character", "角色设置"))
                .add_item(CustomMenuItem::new("theme", "主题设置"))
        ))
        .add_separator()
        .add_item(CustomMenuItem::new("quit", "退出"))
}
```

### 🪟 窗口管理系统

#### **多窗口模式**
- **宠物窗口**: 始终置顶的角色显示窗口
- **聊天窗口**: 可隐藏的对话交互窗口  
- **设置窗口**: 模态的配置管理窗口

#### **窗口特性**
- **自由拖拽**: 支持鼠标拖拽移动位置
- **大小调整**: 可调节角色显示大小
- **透明度**: 支持窗口透明度设置
- **磁吸边缘**: 智能贴边隐藏功能

### 🔧 智能适配器系统

#### **适配器类型**
- **办公助手**: PPT制作、Excel处理、邮件管理
- **开发工具**: 代码生成、Git操作、文档编写  
- **媒体制作**: 图片处理、视频剪辑、音频编辑
- **系统工具**: 文件管理、系统监控、网络诊断

#### **插件化架构**
```typescript
// 适配器注册机制
class AdapterManager {
  private adapters: Map<string, Adapter>;
  
  // 注册适配器
  register(adapter: Adapter): void;
  
  // 执行适配器
  execute(id: string, params: any): Promise<any>;
  
  // 适配器市场
  browse(): Promise<AdapterInfo[]>;
  install(id: string): Promise<void>;
}
```

## 🎨 主题系统设计

### 🌈 内置主题

#### **动漫主题 (anime.css)**
- 粉色渐变背景
- 可爱圆角设计
- 柔和阴影效果
- 动漫风格图标

#### **暗色主题 (dark.css)**  
- 深色背景配色
- 高对比度文字
- 霓虹色彩点缀
- 现代简约设计

#### **赛博朋克主题 (cyberpunk.css)**
- 科技感配色
- 流光效果动画
- 像素化元素
- 未来主义设计

### 🎯 主题切换机制

```typescript
// 主题管理器
class ThemeManager {
  private currentTheme: string;
  
  // 切换主题
  switchTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
    this.saveThemePreference(theme);
  }
  
  // 动态加载主题CSS
  loadTheme(theme: string): Promise<void>;
}
```

## 🚀 开发环境配置

### 📋 环境要求

#### **系统要求**
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Node.js**: 18.0+ 
- **Rust**: 1.70+
- **Python**: 3.9+ (用于 Zishu 后端 API 对接)

#### **开发工具**
- **IDE**: VSCode + Rust Analyzer + ES7+ React Snippets
- **调试**: Tauri DevTools + React DevTools
- **版本控制**: Git + GitHub Desktop

### 🛠️ 快速启动

#### **1. 环境安装**
```bash
# 克隆项目
git clone https://github.com/your-org/zishu-sensei.git
cd zishu-sensei/desktop_app

# 安装 Rust 和 Tauri CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli

# 安装前端依赖
npm install
```

#### **2. 开发模式启动**
```bash
# 启动开发服务器
npm run tauri dev

# 或使用脚本
./scripts/dev.sh
```

#### **3. 生产构建**
```bash
# 构建生产版本
npm run tauri build

# 或使用脚本
./scripts/build.sh
```

### 🔧 配置文件说明

#### **Tauri 配置 (tauri.conf.json)**
```json
{
  "build": {
    "devPath": "../src",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Zishu Sensei",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "window": {
        "all": true
      },
      "systemTray": {
        "all": true
      }
    },
    "windows": [{
      "title": "Zishu Sensei",
      "width": 400,
      "height": 600,
      "resizable": true,
      "alwaysOnTop": true,
      "decorations": false,
      "transparent": true
    }],
    "systemTray": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  }
}
```

#### **Vite 配置 (vite.config.ts)**
```typescript
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG
  }
});
```

## 📚 开发指南

### 🎯 开发规范

#### **代码风格**
- **TypeScript**: 严格模式，完整类型注解
- **React**: 函数组件 + Hooks，使用 FC 类型
- **CSS**: CSS Modules + Tailwind，BEM 命名规范
- **Rust**: Clippy 检查，统一格式化

#### **提交规范**
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 构建工具、依赖管理
```

### 🧪 测试策略

#### **单元测试**
- React 组件测试使用 React Testing Library
- Rust 代码使用内置 test 框架
- 工具函数使用 Jest 测试

#### **集成测试**
- Tauri 命令端到端测试
- API 接口集成测试
- Live2D 渲染功能测试

#### **E2E 测试**
- 用户交互流程测试
- 多平台兼容性测试
- 性能基准测试

### 📖 API 文档

#### **Tauri 命令接口**
```rust
// 发送聊天消息
#[tauri::command]
async fn send_chat_message(message: String) -> Result<String, String>

// 切换角色
#[tauri::command]  
async fn switch_character(character_id: String) -> Result<(), String>

// 获取适配器列表
#[tauri::command]
async fn get_adapters() -> Result<Vec<AdapterInfo>, String>
```

#### **React Hook 接口**
```typescript
// 聊天功能 Hook
const useChat = () => ({
  messages: Message[];
  sendMessage: (content: string) => void;
  isLoading: boolean;
})

// Live2D 控制 Hook
const useLive2D = () => ({
  model: Live2DModel | null;
  playMotion: (motion: string) => void;
  setExpression: (expression: string) => void;
})
```

## 🔮 未来扩展规划

### 🌟 短期目标 (3个月)

#### **功能增强**
- 语音交互支持 (TTS + STT)
- 更多 Live2D 角色模型
- 适配器市场完善
- 多语言支持

#### **性能优化**  
- 内存占用优化
- 启动速度提升
- 渲染性能改进
- 电池续航优化

### 🚀 中期目标 (6个月)

#### **平台扩展**
- 移动端适配 (Flutter)
- Web 版本支持
- Linux 发行版适配
- 云同步功能

#### **AI 能力增强**
- 本地大模型集成
- 多模态交互 (图像、语音)
- 个性化学习
- 情感识别

### 🌈 长期愿景 (12个月)

#### **生态建设**
- 开发者社区平台
- 适配器开发 SDK
- 官方适配器商店
- 企业版本支持

#### **技术演进**
- WebAssembly 优化
- AR/VR 交互支持
- 区块链集成
- 边缘计算优化

---

## 📞 联系方式

- **项目主页**: https://github.com/your-org/zishu-sensei
- **文档地址**: https://docs.zishu-sensei.com
- **问题反馈**: https://github.com/your-org/zishu-sensei/issues
- **社区讨论**: https://discord.gg/zishu-sensei

---

**🎉 让我们一起打造最可爱的桌面AI助手！** 🐾✨


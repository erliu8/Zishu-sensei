# 🚀 Zishu-sensei 开发计划

## 🎯 项目定位

**Zishu-sensei = 定制化桌面 AI 宠物的生成平台**

用户通过 Web 端可视化配置，自动生成属于自己的 Windows 桌面 AI 助手。

---

## 📊 三阶段开发路线图（45 周）

### 🔵 阶段一：桌面应用模板验证（Week 1-12）

**目标**：证明核心技术可行性

#### Week 1-3：技术验证 🔬
- [ ] **Tauri + React 基础框架**
  - 创建透明窗口
  - 系统托盘集成
  - 全局快捷键
  
- [ ] **Live2D 集成验证**
  - PixiJS + Live2D 渲染
  - 基础表情动画
  - 鼠标交互响应
  - **决策点**：Week 3 Go/No-Go 决定

- [ ] **Python 后端集成**
  - Tauri Command 调用 Python
  - 基础 LLM 对话功能
  - 日志系统

#### Week 4-8：适配器框架 🔧
- [ ] **适配器加载系统**
  - 动态加载机制
  - 配置文件解析
  - 沙盒隔离
  
- [ ] **3 个核心适配器开发**
  - 文件操作适配器（批量重命名、整理）
  - 网页自动化适配器（表单填写、数据抓取）
  - 系统管理适配器（进程控制、快捷方式）

#### Week 9-12：手动打包测试 📦
- [ ] **PyInstaller 打包流程**
  - 配置 spec 文件
  - 依赖项收集
  - 资源文件打包
  
- [ ] **手动生成测试版**
  - 打包 3 个不同配置的应用
  - 测试安装和运行
  - 记录打包步骤和问题

**里程碑 M1**：可以手动生成一个包含 Live2D + 3 个适配器的桌面应用 ✅

---

### 🟢 阶段二：自动打包服务（Week 13-28）

**目标**：实现 Web 配置到桌面应用的自动化

#### Week 13-17：打包服务 API 🚀
- [ ] **FastAPI 打包端点**
  ```python
  POST /api/packaging/create
  GET  /api/packaging/{taskId}/status
  GET  /api/packaging/{taskId}/download
  ```

- [ ] **异步任务队列**
  - Celery + Redis 配置
  - 任务创建和调度
  - 进度追踪和日志

- [ ] **Docker 构建环境**
  - 构建容器镜像
  - 依赖缓存优化
  - 并行构建支持

#### Week 18-23：Web 配置界面 🌐
- [ ] **Next.js 前端框架**
  - 项目搭建
  - API 集成
  - 状态管理（Zustand）

- [ ] **配置表单页面**
  - 适配器选择器（多选）
  - LLM 配置表单
  - 角色定制面板
  - 快捷键设置

- [ ] **打包进度页面**
  - WebSocket 实时进度
  - 构建日志显示
  - 下载按钮生成

#### Week 24-28：端到端测试 🧪
- [ ] **完整流程测试**
  - 10 个不同配置测试
  - 构建成功率统计
  - 平均构建时间优化

- [ ] **错误处理完善**
  - 依赖冲突检测
  - 构建失败重试
  - 用户友好的错误提示

**里程碑 M2**：用户可以在 Web 端选择适配器，自动生成并下载桌面应用 ✅

---

### 🟣 阶段三：社区生态建设（Week 29-45）

**目标**：打造适配器市场和社区

#### Week 29-35：适配器市场 🏪
- [ ] **市场首页**
  - 适配器列表和搜索
  - 分类浏览（办公、开发、娱乐）
  - 热门推荐和评分

- [ ] **适配器详情页**
  - 功能介绍和截图
  - 使用说明和示例
  - 评论和反馈

- [ ] **官方适配器开发**
  - 10 个高质量官方适配器
  - 详细文档和教程
  - 使用视频演示

#### Week 36-40：可视化编排器 🎨
- [ ] **React Flow 画布**
  - 拖拽适配器节点
  - 连接线和数据流
  - 执行顺序设置

- [ ] **高级配置**
  - 条件分支
  - 循环执行
  - 错误处理

- [ ] **工作流模板**
  - 保存和加载工作流
  - 模板市场
  - 分享和导入

#### Week 41-45：优化和发布 🚀
- [ ] **性能优化**
  - 构建速度优化（目标 < 8 分钟）
  - 应用体积优化（目标 < 100MB）
  - 启动速度优化（目标 < 3 秒）

- [ ] **用户测试**
  - 50 个内测用户
  - 反馈收集和问题修复
  - 使用数据分析

- [ ] **文档和社区**
  - 用户手册
  - 开发者指南
  - GitHub 开源
  - 官网上线

**里程碑 M3**：v1.0 正式发布，开源仓库上线 ✅

---

## 🎯 核心功能拆解

### 1. 桌面应用核心（Week 1-12）

```
desktop_app/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs        # 主入口
│   │   ├── commands/      # Tauri Commands
│   │   ├── tray.rs        # 系统托盘
│   │   └── python.rs      # Python 集成
│   └── Cargo.toml
│
├── src/                   # React 前端
│   ├── components/
│   │   ├── Live2D/       # Live2D 渲染
│   │   ├── Chat/         # 对话界面
│   │   └── Settings/     # 设置面板
│   ├── hooks/
│   └── App.tsx
│
└── python_backend/        # Python 后端
    ├── main.py           # FastAPI 服务
    ├── adapters/         # 适配器目录
    │   ├── file_ops/
    │   ├── web_automation/
    │   └── system_control/
    └── llm/              # LLM 集成
```

### 2. 打包服务（Week 13-23）

```
packaging_service/
├── api/
│   ├── routes/
│   │   └── packaging.py  # 打包端点
│   ├── tasks/
│   │   └── build.py      # Celery 任务
│   └── main.py
│
├── builder/
│   ├── template/         # 桌面应用模板
│   ├── config_injector.py # 配置注入
│   └── packager.py       # PyInstaller 封装
│
└── docker/
    └── Dockerfile.builder # 构建环境镜像
```

### 3. Web 社区（Week 18-40）

```
web_platform/
├── app/                  # Next.js App Router
│   ├── (home)/
│   │   └── page.tsx     # 首页
│   ├── marketplace/
│   │   ├── page.tsx     # 适配器市场
│   │   └── [id]/page.tsx # 适配器详情
│   ├── builder/
│   │   └── page.tsx     # 配置器
│   └── packaging/
│       └── [taskId]/page.tsx # 打包进度
│
├── components/
│   ├── AdapterCard.tsx
│   ├── ConfigForm.tsx
│   ├── FlowEditor.tsx   # React Flow
│   └── PackagingProgress.tsx
│
└── lib/
    ├── api.ts           # API 调用
    └── types.ts         # TypeScript 类型
```

---

## 🔑 技术关键点

### 1. Tauri + Python 集成

**方案**：使用 Tauri Sidecar 运行嵌入式 Python

```rust
// src-tauri/src/python.rs
use tauri::api::process::{Command, CommandChild};

pub fn start_python_backend() -> Result<CommandChild, String> {
    let python_binary = if cfg!(windows) {
        "python_backend/python.exe"
    } else {
        "python_backend/python"
    };
    
    Command::new(python_binary)
        .args(&["main.py"])
        .spawn()
        .map_err(|e| e.to_string())
}
```

### 2. 配置注入机制

**打包时注入用户配置**：

```python
# builder/config_injector.py
def inject_user_config(template_dir, user_config):
    """将用户配置注入到应用模板中"""
    config_path = template_dir / "python_backend" / "user_config.json"
    
    config = {
        "adapters": user_config["selectedAdapters"],
        "llm": {
            "provider": user_config["llmConfig"]["provider"],
            # API 密钥可以首次启动时输入
            "model": user_config["llmConfig"]["model"]
        },
        "character": user_config["character"],
        "shortcuts": user_config["shortcuts"]
    }
    
    config_path.write_text(json.dumps(config))
```

### 3. Live2D 渲染优化

**使用 PixiJS + pixi-live2d-display**：

```typescript
// src/components/Live2D/Live2DCharacter.tsx
import { Live2DModel } from 'pixi-live2d-display';
import * as PIXI from 'pixi.js';

export function Live2DCharacter({ modelUrl, onLoaded }) {
  useEffect(() => {
    const app = new PIXI.Application({
      transparent: true,
      backgroundAlpha: 0
    });
    
    Live2DModel.from(modelUrl).then((model) => {
      app.stage.addChild(model);
      model.scale.set(0.1);
      
      // 添加交互
      model.on('hit', (hitAreas) => {
        if (hitAreas.includes('body')) {
          model.motion('tap_body');
        }
      });
      
      onLoaded(model);
    });
  }, [modelUrl]);
}
```

---

## 📦 打包优化策略

### 目标
- 构建时间：< 10 分钟
- 应用体积：< 150MB
- 成功率：> 90%

### 优化方案

1. **分层缓存**
   ```dockerfile
   # docker/Dockerfile.builder
   FROM python:3.11-slim
   
   # 第一层：系统依赖（很少变化）
   RUN apt-get update && apt-get install -y ...
   
   # 第二层：Python 依赖（偶尔变化）
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   
   # 第三层：应用模板（每次构建）
   COPY template/ /app/
   ```

2. **增量构建**
   - 只重新打包修改的适配器
   - 复用 Python 运行时缓存
   - CDN 预缓存常用依赖

3. **并行构建**
   - 多个构建任务并行
   - 限制最大并发数（基于服务器资源）

---

## 🎯 MVP 范围定义

### 必须有（核心价值）
- ✅ Web 端适配器选择和配置
- ✅ 自动打包生成 .exe
- ✅ 桌面应用 Live2D 显示
- ✅ 基础对话功能
- ✅ 3-5 个官方适配器

### 可以后续添加
- ⏸️ 可视化编排器（可以先用表单）
- ⏸️ 语音交互
- ⏸️ 跨平台支持（先只做 Windows）
- ⏸️ 适配器市场评分评论

### 技术债务管理
- 接受：代码结构不完美、UI 不够精致
- 不接受：安全漏洞、核心功能 bug、性能问题

---

## 🚨 风险和缓解

### 风险 1：Live2D 集成复杂度
- **缓解**：Week 1-3 技术验证，有备选方案（静态头像）
- **备选**：使用 SVG 动画 + CSS 过渡效果

### 风险 2：打包服务稳定性
- **缓解**：充分的错误处理和重试机制
- **监控**：Sentry 错误追踪，构建成功率监控

### 风险 3：适配器安全性
- **缓解**：沙盒隔离、代码审查、权限控制
- **策略**：初期只有官方适配器，社区适配器需审核

---

## 💡 商业化路径

### 免费版
- 5 个官方适配器免费使用
- 基础配置功能
- 社区支持

### Pro 版（$9.9/月）
- 解锁所有官方适配器
- 自定义 Live2D 角色
- 优先打包队列（< 5 分钟）
- 技术支持

### 企业版（定制）
- 私有化部署
- 企业适配器定制开发
- 技术咨询和培训

---

## 🎉 成功指标

### 技术指标
- 打包成功率 > 90%
- 平均构建时间 < 10 分钟
- 桌面应用启动时间 < 5 秒

### 用户指标
- 1000+ 注册用户（6 个月）
- 100+ 每日活跃用户
- 50+ 社区适配器（12 个月）

### 商业指标
- 实现成本覆盖（18 个月）
- Pro 用户转化率 > 5%
- NPS 评分 > 50

---

**这是一个技术创新和商业价值兼具的项目！**

让我们开始构建属于每个人的定制化 AI 桌面宠物吧！🚀


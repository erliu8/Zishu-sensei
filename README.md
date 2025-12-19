# 🤖 Zishu Sensei (紫舒老师) - AI Desktop Assistant

<div align="center">

![Zishu Logo](https://via.placeholder.com/150x150?text=Zishu+AI)

**一个强大的桌面AI助手，支持多模态交互、自定义适配器和社区生态**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

[English](README.md) | [简体中文](README_CN.md)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [核心特性](#-核心特性)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [开发指南](#-开发指南)
- [部署文档](#-部署文档)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

---

## 🎯 项目简介

**Zishu Sensei** 是一个现代化的桌面AI助手平台，提供：

- 🖥️ **桌面应用** - 基于Tauri的跨平台桌面应用
- 🌐 **社区平台** - 用户交流、适配器分享、AI助手生成
- 🔌 **适配器系统** - 可扩展的功能插件架构
- 🤖 **多模态AI** - 支持文本、语音、视觉交互
- 🎨 **高度定制** - Live2D角色、主题、快捷键

---

## ✨ 核心特性

### 🖥️ 桌面应用 (Desktop App)
- ⚡ **高性能** - 基于Tauri + Rust，体积小、速度快
- 🌍 **跨平台** - Windows、macOS、Linux 全支持
- 🎨 **Live2D集成** - 可爱的虚拟助手形象
- 🔌 **适配器系统** - 文件操作、网页自动化、系统控制等
- 🎤 **语音交互** - 语音唤醒、语音识别、语音合成
- ⌨️ **快捷键** - 全局快捷键快速唤醒

### 🌐 社区平台 (Community Platform)

#### 前端 (Frontend)
- ⚛️ **Next.js 15** - 最新的App Router + React 19
- 🎨 **现代UI** - Tailwind CSS + Shadcn/ui + Framer Motion
- 📱 **响应式** - 完美适配桌面、平板、手机
- 🚀 **高性能** - SSR + ISR + 代码分割
- ♿ **无障碍** - WCAG AA 标准

#### 后端 (Backend)
- ⚡ **FastAPI** - 高性能异步Python框架
- 🗄️ **PostgreSQL** - 可靠的关系型数据库
- 🔴 **Redis** - 高速缓存和会话管理
- 🔒 **安全** - JWT认证、权限管理、速率限制
- 📦 **Docker** - 容器化部署

#### 核心功能
- 📝 **社区交流** - 发帖、评论、点赞、关注
- 🔍 **适配器市场** - 浏览、下载、评分、上传适配器
- 🎁 **AI助手生成** - 在线配置、一键打包、下载安装
- 📊 **数据分析** - 用户统计、热门内容、趋势分析
- 🔔 **实时通知** - WebSocket推送、邮件通知

---

## 🚀 快速开始

### 前置要求

**基础环境**
- 🐍 Python 3.9+ 
- 📦 Node.js 18+
- 🦀 Rust 1.70+ (仅开发桌面应用时需要)
- 🐳 Docker & Docker Compose (部署社区平台时需要)

**工具**
- Git
- npm 或 yarn
- PostgreSQL 15+ (本地开发可选)
- Redis 7+ (本地开发可选)

### 安装步骤

#### 1️⃣ 克隆仓库
```bash
git clone https://github.com/yourusername/zishu-sensei.git
cd zishu-sensei
```

#### 2️⃣ 安装依赖

**Python 核心库**
```bash
pip install -e .
```

**前端依赖**
```bash
# 安装所有工作空间的依赖
npm install

# 或者分别安装
cd community_platform/frontend && npm install
cd desktop_app && npm install
```

#### 3️⃣ 选择你的开发路径

##### 🖥️ 开发桌面应用
```bash
cd desktop_app
npm run tauri:dev
```

##### 🌐 开发社区平台

**前端开发**
```bash
cd community_platform/frontend
npm run dev
# 访问 http://localhost:3000
```

**后端开发**
```bash
cd community_platform/backend
pip install -r requirements.txt
uvicorn main:app --reload
# API: http://localhost:8000
# 文档: http://localhost:8000/docs
```

**完整部署（Docker）**
```bash
cd community_platform
./deploy.sh
# 选择模式: 1=开发 2=生产
```

---

## 📚 开发指南

### 🎯 Monorepo 工作流

我们使用单仓库（Monorepo）管理所有子项目：

**常用命令**
```bash
# 运行前端开发服务器
npm run dev:frontend

# 运行桌面应用开发服务器
npm run dev:desktop

# 构建前端
npm run build:frontend

# 构建桌面应用
npm run build:desktop

# 运行所有测试
npm run test:all

# 代码检查
npm run lint:all

# 清理所有构建产物
npm run clean
```

### 🏗️ 架构设计

#### 桌面应用架构
```
Tauri (Rust)
    ↓
React + TypeScript
    ↓
Python Core (zishu/)
    ↓
LLM / Adapters / Live2D
```

#### 社区平台架构
```
Next.js Frontend (Port 3000)
    ↓
Nginx Reverse Proxy (Port 80/443)
    ↓
FastAPI Backend (Port 8000)
    ↓
PostgreSQL + Redis
```

详细架构文档：
- [桌面应用架构](docs/DESKTOP_ARCHITECTURE.md)
- [社区平台前端架构](community_platform/docs/FRONTEND_ARCHITECTURE.md)
- [社区平台后端架构](community_platform/docs/BACKEND_ARCHITECTURE.md)

### 🧪 测试

```bash
# Python 测试
pytest

# 前端测试
npm run test:frontend

# 桌面应用测试
npm run test:desktop

# E2E 测试
npm run test:e2e
```

### 📝 代码规范

- Python: PEP 8, Black formatter
- TypeScript: ESLint + Prettier
- Rust: rustfmt
- Git Commit: Conventional Commits

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🚀 部署文档

### 开发环境

请参考 [快速开始](#-快速开始) 部分

### 生产环境

#### 🌐 部署社区平台

**使用 Docker Compose（推荐）**
```bash
cd community_platform

# 1. 配置环境变量
cp env.example .env
nano .env  # 修改生产配置

# 2. 运行部署脚本
./deploy.sh
# 选择: 2 (生产模式)

# 3. 配置 SSL（可选）
# 将 SSL 证书放到 nginx/ssl/
# 编辑 nginx/conf.d/default.conf

# 4. 重启服务
docker-compose restart nginx
```

**手动部署**

详见 [DEPLOYMENT.md](DEPLOYMENT.md)

#### 🖥️ 打包桌面应用

```bash
cd desktop_app

# Windows
npm run tauri:build -- --target x86_64-pc-windows-msvc

# macOS
npm run tauri:build -- --target x86_64-apple-darwin

# Linux
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```

生成的安装包位于 `src-tauri/target/release/bundle/`

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. 🍴 Fork 本仓库
2. 🌿 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. ✍️ 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 📤 推送到分支 (`git push origin feature/AmazingFeature`)
5. 🎉 创建 Pull Request

### 提交规范

使用 Conventional Commits：

```
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

### 开发路线图

- [x] 桌面应用基础架构
- [x] Python 核心库
- [x] 适配器系统
- [ ] 社区平台前端 (进行中)
- [ ] 社区平台后端 (进行中)
- [ ] 在线打包服务
- [ ] 移动端支持

查看完整计划：[开发路线图](docs/DEVELOPMENT_PLAN.md)

---

## 📖 文档

- 📘 [架构设计](docs/ARCHITECTURE.md)
- 📗 [开发计划](docs/DEVELOPMENT_PLAN.md)
- 📕 [API 文档](docs/API.md)
- 📙 [部署指南](DEPLOYMENT.md)
- 📓 [贡献指南](CONTRIBUTING.md)

---

## 🛠️ 技术栈

### 桌面应用
- **前端**: React 18, TypeScript, Vite
- **后端**: Tauri (Rust)
- **核心**: Python 3.9+
- **UI**: Tailwind CSS, Ant Design
- **动画**: Live2D Web SDK

### 社区平台前端
- **框架**: Next.js 15, React 19
- **语言**: TypeScript 5
- **样式**: Tailwind CSS, Shadcn/ui
- **状态**: TanStack Query, Zustand
- **动画**: Framer Motion
- **测试**: Vitest, Playwright

### 社区平台后端
- **框架**: FastAPI
- **数据库**: PostgreSQL 15
- **缓存**: Redis 7
- **ORM**: SQLAlchemy
- **认证**: JWT
- **部署**: Docker, Nginx

---

## 📊 项目状态

![GitHub Stars](https://img.shields.io/github/stars/yourusername/zishu-sensei?style=social)
![GitHub Forks](https://img.shields.io/github/forks/yourusername/zishu-sensei?style=social)
![GitHub Issues](https://img.shields.io/github/issues/yourusername/zishu-sensei)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/yourusername/zishu-sensei)

---

## 📄 许可证

本项目采用 Apache License 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

```
Copyright 2025 Zishu Team

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## 🙏 致谢

感谢以下开源项目：

- [Tauri](https://tauri.app/) - 桌面应用框架
- [Next.js](https://nextjs.org/) - React 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web 框架
- [Live2D](https://www.live2d.com/) - 虚拟形象技术
- [Shadcn/ui](https://ui.shadcn.com/) - UI 组件库

---

## 📞 联系我们

- 💬 GitHub Issues: [提交问题](https://github.com/yourusername/zishu-sensei/issues)
- 📧 Email: support@zishu.ai
- 🌐 Website: https://zishu.ai
- 💬 Discord: [加入社区](https://discord.gg/zishu)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给我们一个星标！**

Made with ❤️ by Zishu Team

</div>


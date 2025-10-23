# 🚀 快速开始指南

欢迎加入 Zishu 社区平台前端团队！

---

## ⚡ 5分钟快速启动

### 1. 检查环境

```bash
# 检查 Node.js 版本（需要 >= 20.11.0）
node --version

# 如果使用 nvm
nvm use
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env.local

# 编辑配置（可选，有默认值）
# vim .env.local
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 🎉

---

## 📝 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 代码质量
npm run lint             # 运行 ESLint 检查
npm run lint:fix         # 自动修复 ESLint 问题
npm run format           # 格式化所有文件
npm run format:check     # 检查格式
npm run type-check       # TypeScript 类型检查
npm run validate         # 验证所有配置（类型+lint+格式）

# 测试
npm run test             # 运行测试
npm run test:watch       # 监听模式运行测试
npm run test:ui          # 使用 UI 运行测试
npm run test:coverage    # 测试覆盖率
```

---

## 🔧 VS Code 配置

### 推荐扩展

在 VS Code 中打开项目后，会自动提示安装推荐扩展：

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Next
- Error Lens
- Code Spell Checker
- Conventional Commits

### 快捷键

- `Ctrl/Cmd + S`: 自动格式化并保存
- `Ctrl/Cmd + Shift + P`: 命令面板
  - 输入 "Format Document": 格式化文档
  - 输入 "ESLint: Fix all": 修复所有 ESLint 问题

---

## 📦 项目结构

```
frontend/
├── app/                  # Next.js 页面
│   ├── (auth)/          # 认证页面
│   └── (main)/          # 主应用页面
├── src/
│   ├── features/        # 功能模块（按领域）
│   ├── shared/          # 共享代码
│   └── infrastructure/  # 基础设施层
├── public/              # 静态资源
├── docs/                # 文档
└── __tests__/          # 测试
```

---

## 🌿 Git 工作流

### 1. 创建分支

```bash
git checkout develop
git pull origin develop
git checkout -b feature/新功能名称
```

### 2. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
# 会自动运行格式化和 lint 检查
```

### 3. 推送代码

```bash
git push origin feature/新功能名称
# 会自动运行类型检查和 lint 检查
```

### 提交信息格式

```bash
feat: 添加新功能
fix: 修复 Bug
docs: 更新文档
style: 代码格式
refactor: 重构代码
perf: 性能优化
test: 添加测试
chore: 构建工具变动
```

---

## 📚 文档

- [完整开发规范](./docs/DEVELOPMENT_GUIDE.md) - 详细的开发指南
- [配置检查清单](./docs/SETUP_CHECKLIST.md) - 所有配置的详细说明
- [实施计划](./docs/IMPLEMENTATION_PLAN.md) - 项目实施计划

---

## ❓ 常见问题

### Q: Git Hooks 不工作？

```bash
# 重新安装 Husky
npm run prepare
```

### Q: ESLint 报错？

```bash
# 自动修复
npm run lint:fix
```

### Q: TypeScript 报错？

```bash
# 检查类型错误
npm run type-check
```

### Q: 端口 3000 被占用？

```bash
# 修改端口
PORT=3001 npm run dev
```

### Q: 需要跳过 Git Hooks？

```bash
# 不推荐，但紧急情况下可用
git commit --no-verify
```

---

## 🆘 获取帮助

- 查看文档：`docs/`
- 查看 Issues
- 询问团队成员

---

**准备好了？开始开发吧！ 🎉**

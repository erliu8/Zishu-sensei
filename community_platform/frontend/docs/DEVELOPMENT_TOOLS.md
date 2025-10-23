# 🛠️ 开发工具配置指南

本文档说明了项目中使用的开发工具配置和最佳实践。

## 📋 目录

- [TypeScript 配置](#typescript-配置)
- [ESLint 配置](#eslint-配置)
- [Prettier 配置](#prettier-配置)
- [Git Hooks (Husky)](#git-hooks-husky)
- [VS Code 配置](#vs-code-配置)
- [常用命令](#常用命令)

---

## TypeScript 配置

### tsconfig.json

我们使用严格的 TypeScript 配置以确保代码质量：

**严格模式选项：**

- `strict: true` - 启用所有严格类型检查
- `noUnusedLocals: true` - 禁止未使用的局部变量
- `noUnusedParameters: true` - 禁止未使用的参数
- `noImplicitReturns: true` - 确保函数所有路径都有返回值
- `noFallthroughCasesInSwitch: true` - 防止 switch 语句穿透

**路径别名：**

```typescript
// 使用路径别名导入
import { Button } from '@/shared/components/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ApiClient } from '@/infrastructure/api/client'
```

支持的路径别名：

- `@/*` - 项目根目录
- `@/app/*` - App 目录
- `@/src/*` - 源代码目录
- `@/features/*` - 功能模块
- `@/shared/*` - 共享组件和工具
- `@/infrastructure/*` - 基础设施层
- `@/styles/*` - 样式文件
- `@/types/*` - 类型定义

---

## ESLint 配置

### .eslintrc.json

项目使用了以下 ESLint 规则集：

1. **Next.js 规则** - `next/core-web-vitals`
2. **TypeScript 规则** - `@typescript-eslint/recommended`
3. **React 规则** - React Hooks 规则
4. **Prettier 集成** - 避免与 Prettier 冲突

### 重要规则说明

#### TypeScript 规则

```typescript
// ✅ 推荐：使用类型导入
import type { User } from '@/types'

// ❌ 避免：普通导入类型
import { User } from '@/types'

// ✅ 推荐：使用 const
const name = 'John'

// ❌ 避免：使用 var
var name = 'John'

// ✅ 推荐：使用 ===
if (value === null) {
}

// ❌ 避免：使用 ==
if (value == null) {
}
```

#### 未使用变量

```typescript
// ✅ 允许：使用 _ 前缀
const _unusedVar = 'value'
function handleClick(_event: MouseEvent) {}

// ❌ 警告：未使用的变量
const unusedVar = 'value'
```

#### Console 语句

```typescript
// ✅ 允许
console.warn('Warning message')
console.error('Error message')

// ⚠️ 警告
console.log('Debug message') // 开发时允许，生产环境应该移除
```

### 运行 ESLint

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

---

## Prettier 配置

### .prettierrc

Prettier 配置确保代码风格一致：

```json
{
  "semi": false, // 不使用分号
  "singleQuote": true, // 使用单引号
  "tabWidth": 2, // 缩进 2 空格
  "printWidth": 80, // 行宽 80 字符
  "trailingComma": "es5", // ES5 兼容的尾随逗号
  "arrowParens": "always" // 箭头函数总是使用括号
}
```

### 代码风格示例

```typescript
// ✅ Prettier 格式化后
const user = {
  name: 'John',
  email: 'john@example.com',
}

const greet = (name: string) => {
  return `Hello, ${name}!`
}

// 自动格式化 Tailwind CSS 类名
<div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-md" />
```

### 运行 Prettier

```bash
# 格式化所有文件
npm run format

# 检查格式（不修改文件）
npm run format:check
```

---

## Git Hooks (Husky)

项目使用 Husky 在 Git 操作时自动运行检查。

### Pre-commit Hook

提交代码前自动运行：

1. **lint-staged** - 只检查暂存的文件
2. **ESLint** - 自动修复问题
3. **Prettier** - 自动格式化

```bash
# .husky/pre-commit
npx lint-staged
```

### Commit Message Hook

验证提交信息格式（遵循 Conventional Commits）：

```bash
# ✅ 有效的提交信息
feat: 添加用户登录功能
fix: 修复帖子列表分页问题
docs: 更新 README 文档
style: 格式化代码
refactor: 重构用户服务
perf: 优化图片加载性能
test: 添加用户模块测试
chore: 更新依赖包

# ❌ 无效的提交信息
added login feature
Fixed bug
update
```

### Pre-push Hook

推送代码前运行完整检查：

1. **类型检查** - `npm run type-check`
2. **代码检查** - `npm run lint`

---

## VS Code 配置

### 推荐扩展

项目根目录的 `.vscode/extensions.json` 包含推荐扩展：

- **ESLint** - 实时显示 lint 错误
- **Prettier** - 代码格式化
- **Tailwind CSS IntelliSense** - Tailwind 类名智能提示
- **Error Lens** - 在行内显示错误
- **Code Spell Checker** - 拼写检查
- **Conventional Commits** - 提交信息辅助

### 编辑器设置

`.vscode/settings.json` 配置了：

- 保存时自动格式化
- 保存时自动修复 ESLint 问题
- Tailwind CSS 智能感知
- TypeScript 工作区版本

### 键盘快捷键

| 功能                 | Windows/Linux              | macOS                     |
| -------------------- | -------------------------- | ------------------------- |
| 格式化文档           | `Shift+Alt+F`              | `Shift+Option+F`          |
| 修复所有 ESLint 问题 | `Ctrl+Shift+P` → "Fix all" | `Cmd+Shift+P` → "Fix all" |
| 组织导入             | `Shift+Alt+O`              | `Shift+Option+O`          |

---

## 常用命令

### 开发相关

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### 代码质量检查

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
npm run format:check

# 运行所有检查（类型 + lint + 格式）
npm run validate
```

### 测试相关

```bash
# 运行测试
npm run test

# 监听模式运行测试
npm run test:watch

# 测试 UI 界面
npm run test:ui

# 测试覆盖率
npm run test:coverage
```

---

## 工作流程最佳实践

### 1. 开始开发

```bash
# 拉取最新代码
git pull origin develop

# 创建功能分支
git checkout -b feature/user-login

# 安装依赖
npm install
```

### 2. 开发过程

```bash
# 启动开发服务器
npm run dev

# 实时检查类型（另一个终端）
npm run type-check -- --watch
```

### 3. 提交代码

```bash
# 查看变更
git status

# 暂存文件
git add .

# 提交（会自动运行 pre-commit 检查）
git commit -m "feat: 添加用户登录功能"

# 推送（会自动运行 pre-push 检查）
git push origin feature/user-login
```

### 4. 提交前手动检查

```bash
# 运行所有检查
npm run validate

# 如果检查通过，再提交
git commit -m "feat: 添加用户登录功能"
```

---

## 故障排除

### ESLint 缓存问题

```bash
# 清除 ESLint 缓存
rm -rf .next
rm -rf node_modules/.cache
```

### Husky Hook 不工作

```bash
# 重新安装 Husky
npm run prepare
```

### TypeScript 错误

```bash
# 清除 TypeScript 缓存
rm -rf .next
rm -rf node_modules/.cache
npm run type-check
```

### Prettier 和 ESLint 冲突

确保 `.eslintrc.json` 中包含 `"prettier"` 在 `extends` 数组的最后。

---

## 配置文件位置

```
frontend/
├── .eslintrc.json          # ESLint 配置
├── .eslintignore           # ESLint 忽略文件
├── .prettierrc             # Prettier 配置
├── .prettierignore         # Prettier 忽略文件
├── .editorconfig           # EditorConfig 配置
├── tsconfig.json           # TypeScript 配置
├── commitlint.config.js    # Commitlint 配置
├── .lintstagedrc.js        # Lint-staged 配置
├── .husky/                 # Husky Git hooks
│   ├── pre-commit
│   ├── commit-msg
│   └── pre-push
└── .vscode/                # VS Code 配置
    ├── settings.json
    └── extensions.json
```

---

## 参考资源

- [Next.js ESLint](https://nextjs.org/docs/app/building-your-application/configuring/eslint)
- [TypeScript 配置](https://www.typescriptlang.org/tsconfig)
- [Prettier 文档](https://prettier.io/docs/en/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Husky 文档](https://typicode.github.io/husky/)

---

**配置完成！现在你的项目具备了企业级的代码质量保障体系。** ✨

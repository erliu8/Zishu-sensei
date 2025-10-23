# 🚀 CI/CD 配置说明

本项目已完成完整的 CI/CD 流程配置，包括自动化测试、部署和发布。

---

## 📚 快速导航

### 🎯 核心文档
- **[CI/CD 快速参考](.github/CI_CD_QUICK_REFERENCE.md)** - 常用命令速查 ⭐
- **[CI/CD 完整指南](docs/CI_CD_GUIDE.md)** - 详细使用文档
- **[GitHub Secrets 配置](docs/GITHUB_SECRETS_SETUP.md)** - 环境配置指南
- **[分支保护规则](.github/BRANCH_PROTECTION_RULES.md)** - 分支管理规范
- **[完成总结](docs/CI_CD_COMPLETION_SUMMARY.md)** - 交付物清单

### 🛠️ 工作流文件
- [ci.yml](.github/workflows/ci.yml) - 持续集成
- [cd.yml](.github/workflows/cd.yml) - 持续部署
- [test.yml](.github/workflows/test.yml) - E2E 测试
- [release.yml](.github/workflows/release.yml) - 自动发布
- [lighthouse.yml](.github/workflows/lighthouse.yml) - 性能监控
- [codeql.yml](.github/workflows/codeql.yml) - 安全分析

---

## ⚡ 快速开始

### 1. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 提交前检查（必做！）
npm run ci:check
```

### 2. 创建 Pull Request

```bash
# 创建功能分支
git checkout -b feature/your-feature

# 开发并提交
git commit -m "feat: your feature description"

# 推送并创建 PR
git push origin feature/your-feature
```

### 3. 发布新版本

```bash
# 补丁版本 (Bug 修复)
npm run release:patch

# 次版本 (新功能)
npm run release:minor

# 主版本 (破坏性变更)
npm run release:major
```

---

## 🔄 CI/CD 流程

### 持续集成 (CI)

每次 Push 或 PR 时自动运行：

```
1. ✅ 代码规范检查 (ESLint + Prettier)
2. ✅ TypeScript 类型检查
3. ✅ 单元测试 (覆盖率 ≥ 80%)
4. ✅ 构建测试
5. ✅ 安全审计
6. ✅ E2E 测试 (Playwright)
7. ✅ 性能测试 (Lighthouse)
```

### 持续部署 (CD)

自动部署流程：

```
Push to main → Staging 环境
Tag 创建     → Production 环境
```

---

## 📦 已配置的工作流

### ✅ 代码质量
- **CI**: 代码检查、测试、构建
- **CodeQL**: 安全分析
- **Dependency Review**: 依赖审查

### ✅ 测试
- **E2E Tests**: 多浏览器测试（Chromium、Firefox、Webkit）
- **Visual Regression**: 视觉回归测试
- **Accessibility**: 可访问性测试
- **Performance**: 性能测试

### ✅ 部署
- **CD**: 自动部署到 Staging/Production
- **Release**: 自动化版本发布
- **Docker**: 镜像构建和推送

### ✅ 监控
- **Lighthouse**: 性能监控
- **Auto-merge**: Dependabot PR 自动合并

---

## 🔐 环境配置

### 必需配置的 Secrets

在开始使用 CD 功能前，需要配置以下 Secrets：

```bash
# Docker Registry
DOCKER_REGISTRY
DOCKER_USERNAME
DOCKER_PASSWORD

# Staging Environment
STAGING_HOST
STAGING_USERNAME
STAGING_SSH_KEY
STAGING_DEPLOY_PATH
STAGING_URL

# Production Environment
PRODUCTION_HOST
PRODUCTION_USERNAME
PRODUCTION_SSH_KEY
PRODUCTION_DEPLOY_PATH
PRODUCTION_URL
```

**配置方法**: 参考 [GitHub Secrets 配置指南](docs/GITHUB_SECRETS_SETUP.md)

---

## 📝 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 格式
<type>(<scope>): <subject>

# 类型
feat:     新功能
fix:      Bug 修复
docs:     文档更新
style:    代码格式
refactor: 重构
perf:     性能优化
test:     测试相关
chore:    构建/工具
ci:       CI 配置

# 示例
feat(auth): implement OAuth2 authentication
fix(ui): resolve mobile layout issue
docs(api): update endpoint documentation
```

---

## 🎯 质量标准

### 代码质量
- ✅ ESLint: 无错误
- ✅ Prettier: 格式正确
- ✅ TypeScript: 无类型错误
- ✅ 测试覆盖率: ≥ 80%

### 性能指标
- ✅ Lighthouse Performance: ≥ 90
- ✅ LCP: < 2.5s
- ✅ FID: < 100ms
- ✅ CLS: < 0.1

---

## 🛠️ 可用脚本

### 开发
```bash
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
```

### 代码质量
```bash
npm run lint             # 运行 ESLint
npm run lint:fix         # 自动修复 ESLint 问题
npm run format           # 格式化代码
npm run format:check     # 检查代码格式
npm run type-check       # TypeScript 类型检查
npm run validate         # 运行所有检查
```

### 测试
```bash
npm test                 # 运行单元测试
npm run test:watch       # 监听模式
npm run test:coverage    # 生成覆盖率报告
npm run test:e2e         # 运行 E2E 测试
npm run test:e2e:ui      # E2E 测试 UI 模式
```

### CI/CD
```bash
npm run ci:check         # 本地 CI 检查
npm run release          # 交互式发布
npm run release:patch    # 发布补丁版本
npm run release:minor    # 发布次版本
npm run release:major    # 发布主版本
```

---

## 📊 工作流状态

| 工作流 | 状态 | 描述 |
|--------|------|------|
| CI | ![CI](https://github.com/zishu/community-platform/workflows/CI/badge.svg) | 持续集成 |
| CD | ![CD](https://github.com/zishu/community-platform/workflows/CD/badge.svg) | 持续部署 |
| E2E Tests | ![E2E](https://github.com/zishu/community-platform/workflows/E2E%20Tests/badge.svg) | E2E 测试 |
| CodeQL | ![CodeQL](https://github.com/zishu/community-platform/workflows/CodeQL/badge.svg) | 安全分析 |

---

## 🆘 故障排查

### CI 检查失败

```bash
# 1. 本地复现
npm run ci:check

# 2. 修复问题
npm run lint:fix    # 修复 ESLint 错误
npm run format      # 修复格式问题
npm test           # 查看测试失败原因

# 3. 重新提交
git add .
git commit --amend --no-edit
git push --force-with-lease
```

### 构建失败

```bash
# 清理并重新构建
rm -rf node_modules .next
npm ci
npm run build
```

### 需要帮助？

- 📖 查看 [CI/CD 完整指南](docs/CI_CD_GUIDE.md)
- 🔍 搜索 [GitHub Issues](https://github.com/zishu/community-platform/issues)
- 💬 提问到 [GitHub Discussions](https://github.com/zishu/community-platform/discussions)
- 📧 联系 DevOps Team

---

## 🤝 贡献指南

1. **Fork** 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 **Pull Request**

详细信息请参考 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 👥 团队

- **技术负责人**: [@tech-lead]
- **DevOps 团队**: [@devops-team]
- **前端团队**: [@frontend-team]

---

## 🙏 致谢

感谢所有贡献者让这个项目变得更好！

---

**最后更新**: 2025-10-23  
**版本**: 1.0.0


# 🚀 CI/CD 快速参考

> 常用命令和配置的快速查找手册

---

## 📝 常用命令

### 本地开发

```bash
# 开发服务器
npm run dev

# 构建
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint
npm run lint:fix

# 格式化
npm run format
npm run format:check

# 测试
npm test                # 单元测试
npm run test:coverage   # 覆盖率
npm run test:e2e        # E2E 测试

# 完整验证（提交前必做！）
npm run validate        # type-check + lint + format-check
npm run ci:check        # 完整 CI 检查
```

### 发布

```bash
# 自动化发布
npm run release:patch   # 1.0.0 -> 1.0.1
npm run release:minor   # 1.0.0 -> 1.1.0
npm run release:major   # 1.0.0 -> 2.0.0
npm run release         # 交互式

# 手动发布
npm version patch
git push && git push --tags
```

---

## 🔄 Git 工作流

### 功能开发

```bash
# 1. 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/123-new-feature

# 2. 开发...

# 3. 提交前检查
npm run ci:check

# 4. 提交
git add .
git commit -m "feat: add new feature"

# 5. 推送并创建 PR
git push origin feature/123-new-feature
```

### Bug 修复

```bash
git checkout develop
git checkout -b fix/456-bug-description
# ... 修复代码
git commit -m "fix: resolve issue #456"
git push origin fix/456-bug-description
```

### 热修复（紧急）

```bash
git checkout main
git checkout -b hotfix/789-critical-fix
# ... 修复代码
git commit -m "fix: critical security patch"
git push origin hotfix/789-critical-fix
# 合并到 main 和 develop
```

---

## 📋 提交信息规范

### 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### 类型 (type)

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add Google login` |
| `fix` | Bug 修复 | `fix(post): resolve editor crash` |
| `docs` | 文档更新 | `docs(readme): update installation` |
| `style` | 代码格式 | `style: format with prettier` |
| `refactor` | 重构 | `refactor(api): simplify error handling` |
| `perf` | 性能优化 | `perf(list): implement virtual scrolling` |
| `test` | 测试相关 | `test(auth): add login tests` |
| `chore` | 构建/工具 | `chore: update dependencies` |
| `ci` | CI 配置 | `ci: add lighthouse workflow` |

### 示例

```bash
# 好的提交信息 ✅
git commit -m "feat(auth): implement OAuth2 authentication"
git commit -m "fix(ui): resolve button alignment issue on mobile"
git commit -m "docs: update API documentation"

# 不好的提交信息 ❌
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
```

---

## 🔍 CI/CD 工作流

### 自动触发

| 工作流 | 触发条件 | 运行时间 |
|--------|---------|----------|
| **CI** | Push/PR | ~5-8 分钟 |
| **E2E Tests** | Push/PR | ~15-20 分钟 |
| **CodeQL** | Push/PR/定时 | ~10-15 分钟 |
| **Lighthouse** | PR/定时 | ~8-10 分钟 |
| **CD (Staging)** | Push to main | ~10-15 分钟 |
| **CD (Production)** | Tag 创建 | ~10-15 分钟 |

### 手动触发

```bash
# 使用 GitHub CLI
gh workflow run ci.yml
gh workflow run test.yml
gh workflow run release.yml -f version=v1.2.3

# 或在 GitHub Web UI
# Actions -> 选择工作流 -> Run workflow
```

---

## 🔐 必需的 Secrets

### Docker Registry
```
DOCKER_REGISTRY
DOCKER_USERNAME
DOCKER_PASSWORD
```

### Staging
```
STAGING_HOST
STAGING_USERNAME
STAGING_SSH_KEY
STAGING_DEPLOY_PATH
STAGING_URL
```

### Production
```
PRODUCTION_HOST
PRODUCTION_USERNAME
PRODUCTION_SSH_KEY
PRODUCTION_DEPLOY_PATH
PRODUCTION_URL
```

### 配置方法
```bash
gh secret set SECRET_NAME --body "value"
gh secret set SSH_KEY < ~/.ssh/key_file
```

---

## 🐛 故障排查

### CI 检查失败

```bash
# 1. 查看失败的检查
# GitHub Actions 标签页

# 2. 本地复现
npm run ci:check

# 3. 修复问题
npm run lint:fix     # ESLint 错误
npm run format       # 格式问题
npm test            # 测试失败
npm run build       # 构建错误

# 4. 重新提交
git add .
git commit --amend --no-edit
git push --force-with-lease
```

### 构建失败

```bash
# 清理并重新安装
rm -rf node_modules .next
npm ci
npm run build

# 检查环境变量
cat .env.example
```

### 部署失败

```bash
# 检查 Secrets 配置
gh secret list

# 查看部署日志
gh run view

# SSH 到服务器检查
ssh user@server
docker ps
docker logs <container-id>
```

---

## 📊 代码质量标准

### 必须满足

- ✅ ESLint: 无错误
- ✅ Prettier: 格式正确
- ✅ TypeScript: 无类型错误
- ✅ 测试覆盖率: ≥ 80%
- ✅ 构建: 成功
- ✅ 安全审计: 无高危漏洞

### 性能目标

- ✅ Lighthouse Performance: ≥ 90
- ✅ LCP: < 2.5s
- ✅ FID: < 100ms
- ✅ CLS: < 0.1
- ✅ Bundle Size: < 200KB (gzipped)

---

## 🔗 快速链接

### 文档
- [完整 CI/CD 指南](../docs/CI_CD_GUIDE.md)
- [Secrets 配置](../docs/GITHUB_SECRETS_SETUP.md)
- [分支保护规则](./BRANCH_PROTECTION_RULES.md)
- [完成总结](../docs/CI_CD_COMPLETION_SUMMARY.md)

### 工具
- [GitHub Actions](https://github.com/zishu/community-platform/actions)
- [GitHub Issues](https://github.com/zishu/community-platform/issues)
- [GitHub Discussions](https://github.com/zishu/community-platform/discussions)

### 外部资源
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Playwright 文档](https://playwright.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 💡 最佳实践

### 提交前
```bash
# 总是运行完整检查
npm run ci:check

# 确保工作区干净
git status
```

### PR 创建
```bash
# 使用描述性标题
# ✅ feat(auth): implement OAuth2 login
# ❌ update auth

# 填写 PR 模板
# 关联 Issue
# 提供测试说明
```

### 代码审查
```bash
# 及时响应审查意见
# 所有讨论必须解决
# 获得批准后才合并
```

### 发布
```bash
# 在 develop 充分测试
# 更新 CHANGELOG
# 遵循语义化版本
# 通知团队
```

---

## 🆘 获取帮助

### 问题反馈
- 📝 创建 Issue
- 💬 GitHub Discussions
- 📧 联系 DevOps Team

### 紧急联系
- Slack: #devops
- Email: devops@zishu.com

---

**最后更新**: 2025-10-23  
**维护者**: DevOps Team

---

**💡 提示**: 把这个文件加入浏览器书签，随时快速查阅！


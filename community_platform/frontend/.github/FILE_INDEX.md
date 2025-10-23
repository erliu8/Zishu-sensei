# 📁 CI/CD 文件索引

本文档列出了所有 CI/CD 相关的配置文件及其用途。

---

## 🔧 GitHub Actions 工作流 (`.github/workflows/`)

| 文件 | 用途 | 触发条件 | 运行时间 |
|------|------|----------|----------|
| `ci.yml` | 持续集成：代码检查、测试、构建 | Push/PR | ~5-8分钟 |
| `cd.yml` | 持续部署：自动部署 | Push to main/Tag | ~10-15分钟 |
| `test.yml` | E2E 测试：多浏览器测试 | Push/PR/定时 | ~15-20分钟 |
| `release.yml` | 自动发布：版本管理 | Tag 创建 | ~15-20分钟 |
| `lighthouse.yml` | 性能监控：Lighthouse 审计 | PR/定时 | ~8-10分钟 |
| `codeql.yml` | 安全分析：CodeQL 扫描 | Push/PR/定时 | ~10-15分钟 |
| `dependency-review.yml` | 依赖审查：PR 依赖检查 | PR | ~2-3分钟 |
| `auto-merge.yml` | 自动合并：Dependabot PR | Dependabot PR | ~1-2分钟 |

---

## 📋 Issue 和 PR 模板 (`.github/ISSUE_TEMPLATE/`)

| 文件 | 用途 | 何时使用 |
|------|------|----------|
| `bug_report.md` | Bug 报告模板 | 报告缺陷或错误 |
| `feature_request.md` | 功能请求模板 | 提议新功能或改进 |
| `question.md` | 问题咨询模板 | 询问使用问题 |
| `../PULL_REQUEST_TEMPLATE.md` | PR 提交模板 | 创建 Pull Request |

---

## 🔒 安全和权限配置 (`.github/`)

| 文件 | 用途 |
|------|------|
| `CODEOWNERS` | 代码所有者配置 |
| `dependabot.yml` | Dependabot 自动更新配置 |
| `BRANCH_PROTECTION_RULES.md` | 分支保护规则指南 |

---

## 📚 文档 (`.github/`, `docs/`)

| 文件 | 内容 | 适合人群 |
|------|------|----------|
| `.github/CI_CD_QUICK_REFERENCE.md` | 快速参考手册 | 所有开发者 ⭐ |
| `docs/CI_CD_GUIDE.md` | 完整使用指南 | 深入了解者 |
| `docs/GITHUB_SECRETS_SETUP.md` | Secrets 配置指南 | DevOps/管理员 |
| `docs/CI_CD_COMPLETION_SUMMARY.md` | 完成总结 | 项目管理者 |
| `.github/BRANCH_PROTECTION_RULES.md` | 分支保护规则 | 管理员 |
| `.github/FILE_INDEX.md` | 文件索引（本文档） | 所有人 |
| `README_CI_CD.md` | CI/CD 配置说明 | 所有开发者 |

---

## 🛠️ 脚本和工具 (`scripts/`)

| 文件 | 用途 | 使用方式 |
|------|------|----------|
| `scripts/check-ci.sh` | 本地 CI 检查 | `npm run ci:check` |
| `scripts/release.sh` | 自动化发布 | `npm run release` |

---

## ⚙️ 配置文件 (根目录)

| 文件 | 用途 |
|------|------|
| `.lighthouserc.js` | Lighthouse CI 配置 |
| `package.json` | NPM 脚本配置（已更新） |

---

## 📊 文件统计

### 按类型分类

| 类型 | 数量 | 文件 |
|------|------|------|
| **工作流** | 8 | `ci.yml`, `cd.yml`, `test.yml`, `release.yml`, `lighthouse.yml`, `codeql.yml`, `dependency-review.yml`, `auto-merge.yml` |
| **模板** | 4 | `bug_report.md`, `feature_request.md`, `question.md`, `PULL_REQUEST_TEMPLATE.md` |
| **文档** | 7 | `CI_CD_GUIDE.md`, `GITHUB_SECRETS_SETUP.md`, `CI_CD_COMPLETION_SUMMARY.md`, `BRANCH_PROTECTION_RULES.md`, `CI_CD_QUICK_REFERENCE.md`, `FILE_INDEX.md`, `README_CI_CD.md` |
| **配置** | 3 | `CODEOWNERS`, `dependabot.yml`, `.lighthouserc.js` |
| **脚本** | 2 | `check-ci.sh`, `release.sh` |

### 总计
- **总文件数**: 24
- **总代码行数**: ~3000+ 行
- **文档字数**: ~25,000+ 字

---

## 🗺️ 文档路线图

### 新手入门
1. 📖 先读: [README_CI_CD.md](../README_CI_CD.md)
2. ⚡ 快查: [CI_CD_QUICK_REFERENCE.md](./CI_CD_QUICK_REFERENCE.md)
3. 🎯 实践: 运行 `npm run ci:check`

### 深入了解
1. 📚 完整指南: [CI_CD_GUIDE.md](../docs/CI_CD_GUIDE.md)
2. 🔐 配置环境: [GITHUB_SECRETS_SETUP.md](../docs/GITHUB_SECRETS_SETUP.md)
3. 🔒 权限设置: [BRANCH_PROTECTION_RULES.md](./BRANCH_PROTECTION_RULES.md)

### 管理维护
1. ✅ 验收标准: [CI_CD_COMPLETION_SUMMARY.md](../docs/CI_CD_COMPLETION_SUMMARY.md)
2. 📊 持续改进: 定期审查工作流性能
3. 🔄 版本更新: 关注 GitHub Actions 新版本

---

## 🔍 快速查找

### 我想要...

**运行本地检查**
→ `npm run ci:check` 或查看 [check-ci.sh](../scripts/check-ci.sh)

**发布新版本**
→ `npm run release` 或查看 [release.sh](../scripts/release.sh)

**配置部署密钥**
→ 查看 [GITHUB_SECRETS_SETUP.md](../docs/GITHUB_SECRETS_SETUP.md)

**了解工作流**
→ 查看 [CI_CD_GUIDE.md](../docs/CI_CD_GUIDE.md)

**设置分支保护**
→ 查看 [BRANCH_PROTECTION_RULES.md](./BRANCH_PROTECTION_RULES.md)

**快速参考**
→ 查看 [CI_CD_QUICK_REFERENCE.md](./CI_CD_QUICK_REFERENCE.md)

**查看已完成的工作**
→ 查看 [CI_CD_COMPLETION_SUMMARY.md](../docs/CI_CD_COMPLETION_SUMMARY.md)

---

## 📝 文件更新记录

| 日期 | 更新内容 | 更新人 |
|------|----------|--------|
| 2025-10-23 | 初始创建所有 CI/CD 配置 | DevOps Team |

---

## 🔗 相关链接

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [Playwright 文档](https://playwright.dev/)
- [Lighthouse CI 文档](https://github.com/GoogleChrome/lighthouse-ci)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

**维护者**: DevOps Team  
**最后更新**: 2025-10-23  
**版本**: 1.0.0


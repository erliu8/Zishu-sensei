# 🔒 分支保护规则配置指南

本文档说明如何为 Zishu 社区平台前端项目配置分支保护规则。

---

## 主要分支保护规则

### `main` 分支（生产分支）

#### 基本设置
- ✅ **要求 PR 才能合并** - 不允许直接推送
- ✅ **要求审查** - 至少需要 1 人审查批准
- ✅ **解散过时审查** - 新提交时重新审查
- ✅ **要求代码所有者审查** - 关键文件需要 CODEOWNERS 审查
- ✅ **限制审查者** - 只有团队成员可以审查

#### 状态检查
必须通过以下 CI 检查才能合并：
- ✅ `ci / lint` - 代码规范检查
- ✅ `ci / typecheck` - TypeScript 类型检查
- ✅ `ci / test` - 单元测试
- ✅ `ci / build` - 构建测试
- ✅ `ci / security` - 安全检查
- ✅ `test / e2e-test` - E2E 测试（至少一个浏览器）

#### 额外限制
- ✅ **要求分支最新** - 必须基于最新的 main 分支
- ✅ **要求签名提交** - 所有提交必须经过 GPG 签名（推荐）
- ✅ **包括管理员** - 规则对管理员也生效
- ✅ **限制强制推送** - 禁止强制推送
- ✅ **限制删除** - 禁止删除分支

#### 允许的合并类型
- ✅ **Squash merging** - 推荐，保持提交历史整洁
- ✅ **Rebase merging** - 保持线性历史
- ❌ **Merge commits** - 不推荐，会产生合并提交

---

### `develop` 分支（开发分支）

#### 基本设置
- ✅ **要求 PR 才能合并** - 不允许直接推送
- ✅ **要求审查** - 至少需要 1 人审查批准
- ✅ **解散过时审查** - 新提交时重新审查
- ❌ **要求代码所有者审查** - 开发分支不强制要求

#### 状态检查
必须通过以下 CI 检查才能合并：
- ✅ `ci / lint` - 代码规范检查
- ✅ `ci / typecheck` - TypeScript 类型检查
- ✅ `ci / test` - 单元测试
- ✅ `ci / build` - 构建测试

#### 额外限制
- ✅ **要求分支最新** - 必须基于最新的 develop 分支
- ❌ **要求签名提交** - 可选
- ✅ **包括管理员** - 规则对管理员也生效
- ✅ **限制强制推送** - 禁止强制推送
- ❌ **限制删除** - 允许删除（谨慎操作）

---

### `release/*` 分支（发布分支）

#### 基本设置
- ✅ **要求 PR 才能合并**
- ✅ **要求审查** - 至少需要 2 人审查批准（更严格）
- ✅ **解散过时审查**
- ✅ **要求代码所有者审查**

#### 状态检查
必须通过所有 CI 检查：
- ✅ `ci / lint`
- ✅ `ci / typecheck`
- ✅ `ci / test`
- ✅ `ci / build`
- ✅ `ci / security`
- ✅ `test / e2e-test`（所有浏览器）
- ✅ `test / performance-test`

---

## 配置步骤

### 通过 GitHub Web 界面配置

1. **进入仓库设置**
   ```
   Repository -> Settings -> Branches
   ```

2. **添加分支保护规则**
   - 点击 "Add branch protection rule"
   - 在 "Branch name pattern" 中输入分支名称（如 `main`）

3. **配置保护规则**
   - 根据上述规则勾选相应选项
   - 添加必需的状态检查
   - 设置审查要求

4. **保存规则**
   - 点击 "Create" 或 "Save changes"

### 通过 GitHub CLI 配置

```bash
# 安装 GitHub CLI
# https://cli.github.com/

# 登录
gh auth login

# 为 main 分支添加保护规则
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci / lint","ci / typecheck","ci / test","ci / build","ci / security"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null
```

### 通过 Terraform 配置

```hcl
# terraform/github_branch_protection.tf

resource "github_branch_protection" "main" {
  repository_id = github_repository.repo.node_id
  pattern       = "main"

  required_status_checks {
    strict = true
    contexts = [
      "ci / lint",
      "ci / typecheck",
      "ci / test",
      "ci / build",
      "ci / security",
      "test / e2e-test"
    ]
  }

  required_pull_request_reviews {
    required_approving_review_count = 1
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
  }

  enforce_admins              = true
  require_signed_commits      = true
  require_conversation_resolution = true
  
  restrict_pushes {
    blocks_creations = false
  }
}
```

---

## CODEOWNERS 文件

创建 `.github/CODEOWNERS` 文件来指定代码所有者：

```
# 全局所有者（默认）
* @zishu-team/frontend-leads

# 核心配置文件
package.json @zishu-team/tech-leads
tsconfig.json @zishu-team/tech-leads
next.config.ts @zishu-team/tech-leads

# CI/CD 配置
.github/workflows/* @zishu-team/devops @zishu-team/tech-leads

# 基础设施代码
src/infrastructure/* @zishu-team/senior-engineers

# 安全相关
src/features/auth/* @zishu-team/security @zishu-team/senior-engineers

# 文档
docs/* @zishu-team/tech-leads
*.md @zishu-team/tech-leads

# 测试
__tests__/* @zishu-team/qa
*.test.ts @zishu-team/qa
*.test.tsx @zishu-team/qa
```

---

## 分支命名规范

### 功能分支
```
feature/<issue-number>-<short-description>
示例: feature/123-add-user-authentication
```

### Bug 修复分支
```
fix/<issue-number>-<short-description>
示例: fix/456-login-button-not-working
```

### 热修复分支
```
hotfix/<issue-number>-<short-description>
示例: hotfix/789-critical-security-patch
```

### 发布分支
```
release/<version>
示例: release/v1.2.0
```

### 文档分支
```
docs/<description>
示例: docs/update-readme
```

### 重构分支
```
refactor/<description>
示例: refactor/improve-auth-service
```

---

## 合并策略

### 从 feature 到 develop
- **合并方式**: Squash and Merge
- **审查要求**: 至少 1 人
- **CI 要求**: 全部通过

### 从 develop 到 main
- **合并方式**: Merge Commit（保留完整历史）
- **审查要求**: 至少 2 人
- **CI 要求**: 全部通过（包括 E2E）
- **额外要求**: 
  - 更新 CHANGELOG
  - 更新版本号
  - 通过测试环境验证

### 从 hotfix 到 main
- **合并方式**: Merge Commit
- **审查要求**: 至少 2 人（包括技术负责人）
- **CI 要求**: 全部通过
- **额外要求**: 
  - 必须有 issue 追踪
  - 必须有回滚计划

---

## 自动化检查清单

### PR 提交时自动检查
- [ ] 分支名称符合规范
- [ ] PR 标题符合规范（Conventional Commits）
- [ ] PR 描述完整
- [ ] 关联了 Issue
- [ ] 所有 CI 检查通过
- [ ] 代码覆盖率 ≥ 80%
- [ ] 没有新增 TypeScript 错误
- [ ] 没有 ESLint 错误
- [ ] 构建成功

### 合并前人工检查
- [ ] 代码审查通过
- [ ] 功能测试通过
- [ ] 无冲突
- [ ] 文档已更新
- [ ] CHANGELOG 已更新（如需要）

---

## 紧急情况处理

### 绕过保护规则
只有在以下紧急情况下才考虑：
1. 生产环境严重故障
2. 安全漏洞紧急修复
3. 关键业务功能中断

**流程**：
1. 创建紧急问题 Issue
2. 通知团队负责人
3. 获得技术负责人批准
4. 记录操作日志
5. 事后复盘

---

## 监控和审计

### 定期检查
- **每周**: 检查被拒绝的 PR 原因
- **每月**: 审查分支保护规则是否需要调整
- **每季度**: 评估规则有效性

### 监控指标
- PR 平均审查时间
- CI 检查失败率
- 合并后 bug 发现率
- 回滚次数

---

## 参考资源

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)

---

**维护者**: DevOps Team  
**最后更新**: 2025-10-23


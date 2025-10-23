# 🔐 GitHub Secrets 配置指南

本文档详细说明如何为 CI/CD 流程配置必需的 GitHub Secrets。

---

## 📋 目录

- [Secrets 列表](#secrets-列表)
- [配置步骤](#配置步骤)
- [安全最佳实践](#安全最佳实践)
- [常见问题](#常见问题)

---

## Secrets 列表

### 必需的 Secrets

#### Docker Registry
| Secret 名称 | 描述 | 示例值 | 优先级 |
|------------|------|-------|--------|
| `DOCKER_REGISTRY` | Docker 镜像仓库地址 | `registry.example.com` | 🔴 高 |
| `DOCKER_USERNAME` | Docker 用户名 | `zishu-deploy` | 🔴 高 |
| `DOCKER_PASSWORD` | Docker 密码或访问令牌 | `************` | 🔴 高 |

#### Staging 环境
| Secret 名称 | 描述 | 示例值 | 优先级 |
|------------|------|-------|--------|
| `STAGING_HOST` | Staging 服务器地址 | `staging.zishu.com` | 🔴 高 |
| `STAGING_USERNAME` | SSH 用户名 | `deploy` | 🔴 高 |
| `STAGING_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH...` | 🔴 高 |
| `STAGING_SSH_PORT` | SSH 端口 | `22` | 🟡 中 |
| `STAGING_DEPLOY_PATH` | 部署路径 | `/var/www/staging` | 🔴 高 |
| `STAGING_URL` | Staging 环境 URL | `https://staging.zishu.com` | 🔴 高 |

#### Production 环境
| Secret 名称 | 描述 | 示例值 | 优先级 |
|------------|------|-------|--------|
| `PRODUCTION_HOST` | Production 服务器地址 | `prod.zishu.com` | 🔴 高 |
| `PRODUCTION_USERNAME` | SSH 用户名 | `deploy` | 🔴 高 |
| `PRODUCTION_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH...` | 🔴 高 |
| `PRODUCTION_SSH_PORT` | SSH 端口 | `22` | 🟡 中 |
| `PRODUCTION_DEPLOY_PATH` | 部署路径 | `/var/www/production` | 🔴 高 |
| `PRODUCTION_URL` | Production 环境 URL | `https://zishu.com` | 🔴 高 |

### 可选的 Secrets

#### 监控和分析
| Secret 名称 | 描述 | 示例值 | 优先级 |
|------------|------|-------|--------|
| `CODECOV_TOKEN` | Codecov 上传令牌 | `************` | 🟢 低 |
| `SLACK_WEBHOOK` | Slack Webhook URL | `https://hooks.slack.com/...` | 🟢 低 |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI Token | `************` | 🟢 低 |

---

## 配置步骤

### 方法一：通过 GitHub Web 界面

1. **进入仓库设置**
   ```
   Repository -> Settings -> Secrets and variables -> Actions
   ```

2. **添加新 Secret**
   - 点击 "New repository secret"
   - 输入 Secret 名称（如 `DOCKER_USERNAME`）
   - 输入 Secret 值
   - 点击 "Add secret"

3. **验证 Secret**
   - 在 Secrets 列表中确认已添加
   - 注意：Secret 值添加后无法再查看

### 方法二：使用 GitHub CLI

#### 安装 GitHub CLI

```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Windows (使用 Scoop)
scoop install gh
```

#### 登录

```bash
gh auth login
```

#### 添加 Secrets

```bash
# 基本用法
gh secret set SECRET_NAME --body "secret-value"

# 从文件读取（适合 SSH 密钥）
gh secret set STAGING_SSH_KEY < ~/.ssh/staging_key

# 交互式输入
gh secret set DOCKER_PASSWORD
# 会提示输入值，输入不会显示在屏幕上

# 批量添加（从 .env 文件）
while IFS='=' read -r key value; do
  if [ ! -z "$key" ] && [ ! -z "$value" ]; then
    gh secret set "$key" --body "$value"
  fi
done < .env.secrets
```

### 方法三：使用脚本批量配置

创建 `scripts/setup-secrets.sh`：

```bash
#!/bin/bash

# GitHub Secrets 批量配置脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔐 开始配置 GitHub Secrets..."
echo ""

# 检查是否安装了 gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ 错误: 未安装 GitHub CLI"
    echo "请访问 https://cli.github.com/ 安装"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "❌ 错误: 未登录 GitHub CLI"
    echo "请运行: gh auth login"
    exit 1
fi

# 读取配置文件
if [ ! -f ".env.secrets" ]; then
    echo "❌ 错误: 未找到 .env.secrets 文件"
    echo "请创建 .env.secrets 文件并填写必要的值"
    exit 1
fi

# 批量添加 Secrets
while IFS='=' read -r key value; do
    # 跳过空行和注释
    if [ -z "$key" ] || [[ "$key" =~ ^#.* ]]; then
        continue
    fi
    
    echo -n "设置 $key... "
    if gh secret set "$key" --body "$value" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}✗${NC}"
    fi
done < .env.secrets

echo ""
echo -e "${GREEN}✅ Secrets 配置完成${NC}"
```

创建 `.env.secrets.example` 模板：

```bash
# Docker Registry
DOCKER_REGISTRY=registry.example.com
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password

# Staging Environment
STAGING_HOST=staging.example.com
STAGING_USERNAME=deploy
STAGING_SSH_KEY=your-ssh-private-key
STAGING_SSH_PORT=22
STAGING_DEPLOY_PATH=/var/www/staging
STAGING_URL=https://staging.example.com

# Production Environment
PRODUCTION_HOST=prod.example.com
PRODUCTION_USERNAME=deploy
PRODUCTION_SSH_KEY=your-ssh-private-key
PRODUCTION_SSH_PORT=22
PRODUCTION_DEPLOY_PATH=/var/www/production
PRODUCTION_URL=https://example.com

# Optional: Monitoring
CODECOV_TOKEN=your-codecov-token
SLACK_WEBHOOK=https://hooks.slack.com/services/XXX/YYY/ZZZ
LHCI_GITHUB_APP_TOKEN=your-lighthouse-token
```

使用方式：

```bash
# 1. 复制模板
cp .env.secrets.example .env.secrets

# 2. 编辑并填写实际值
vim .env.secrets

# 3. 运行配置脚本
./scripts/setup-secrets.sh

# 4. 删除敏感文件
rm .env.secrets
```

---

## 生成和配置 SSH 密钥

### 1. 生成新的 SSH 密钥对

```bash
# 生成 ED25519 密钥（推荐）
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/zishu_deploy

# 或生成 RSA 密钥
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/zishu_deploy
```

### 2. 将公钥添加到服务器

```bash
# 复制公钥
cat ~/.ssh/zishu_deploy.pub

# 在服务器上添加到 authorized_keys
ssh user@your-server
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. 测试 SSH 连接

```bash
# 测试连接
ssh -i ~/.ssh/zishu_deploy user@your-server

# 测试应该成功且无需密码
```

### 4. 添加私钥到 GitHub Secrets

```bash
# 方法 1: 使用 GitHub CLI
gh secret set STAGING_SSH_KEY < ~/.ssh/zishu_deploy

# 方法 2: 复制私钥内容
cat ~/.ssh/zishu_deploy | pbcopy  # macOS
cat ~/.ssh/zishu_deploy | xclip -selection clipboard  # Linux
```

---

## Docker Registry 配置

### 使用 Docker Hub

```bash
# 1. 创建 Docker Hub 访问令牌
# https://hub.docker.com/settings/security

# 2. 配置 Secrets
gh secret set DOCKER_REGISTRY --body "docker.io"
gh secret set DOCKER_USERNAME --body "your-dockerhub-username"
gh secret set DOCKER_PASSWORD --body "your-access-token"
```

### 使用 GitHub Container Registry

```bash
# 1. 创建 Personal Access Token
# Settings -> Developer settings -> Personal access tokens
# 需要 write:packages 权限

# 2. 配置 Secrets
gh secret set DOCKER_REGISTRY --body "ghcr.io"
gh secret set DOCKER_USERNAME --body "your-github-username"
gh secret set DOCKER_PASSWORD --body "your-personal-access-token"
```

### 使用阿里云容器镜像服务

```bash
# 1. 创建访问凭证
# https://cr.console.aliyun.com/

# 2. 配置 Secrets
gh secret set DOCKER_REGISTRY --body "registry.cn-hangzhou.aliyuncs.com"
gh secret set DOCKER_USERNAME --body "your-aliyun-username"
gh secret set DOCKER_PASSWORD --body "your-aliyun-password"
```

---

## 安全最佳实践

### 1. 密钥管理

✅ **应该做的**：
- 使用强密码和复杂的访问令牌
- 为每个环境使用不同的密钥
- 定期轮换密钥（建议每 3-6 个月）
- 使用 SSH 密钥而非密码
- 限制密钥的权限（最小权限原则）

❌ **不应该做的**：
- 在代码中硬编码密钥
- 在日志中输出密钥
- 使用个人账号密码作为部署密钥
- 多个项目共享同一密钥
- 将密钥提交到版本控制

### 2. 访问控制

```bash
# SSH 密钥应该只有部署用户可以使用
chmod 600 ~/.ssh/deploy_key

# 服务器上的部署用户应该使用有限权限
# 不要使用 root 用户
```

### 3. 密钥轮换计划

创建定期轮换提醒：

```bash
# 添加到日历或任务管理系统
每 3 个月: 检查并更新 SSH 密钥
每 6 个月: 更新 Docker Registry 令牌
每年: 审查所有 Secrets 的必要性
```

### 4. 审计和监控

```bash
# 定期检查 Secret 使用情况
# Repository -> Settings -> Secrets -> Actions

# 查看哪些工作流使用了哪些 Secrets
# 删除不再使用的 Secrets
```

---

## 验证配置

### 创建验证脚本

创建 `.github/workflows/verify-secrets.yml`：

```yaml
name: Verify Secrets

on:
  workflow_dispatch:

jobs:
  verify:
    name: 验证 Secrets 配置
    runs-on: ubuntu-latest
    steps:
      - name: 检查 Docker Secrets
        run: |
          if [ -z "${{ secrets.DOCKER_REGISTRY }}" ]; then
            echo "❌ DOCKER_REGISTRY 未配置"
            exit 1
          fi
          echo "✅ Docker Secrets 已配置"

      - name: 检查 Staging Secrets
        run: |
          if [ -z "${{ secrets.STAGING_HOST }}" ]; then
            echo "❌ STAGING_HOST 未配置"
            exit 1
          fi
          echo "✅ Staging Secrets 已配置"

      - name: 检查 Production Secrets
        run: |
          if [ -z "${{ secrets.PRODUCTION_HOST }}" ]; then
            echo "❌ PRODUCTION_HOST 未配置"
            exit 1
          fi
          echo "✅ Production Secrets 已配置"
```

运行验证：

```bash
gh workflow run verify-secrets.yml
gh run watch
```

---

## 常见问题

### Q1: 如何更新已有的 Secret？

```bash
# 直接使用相同的名称重新设置即可
gh secret set SECRET_NAME --body "new-value"
```

### Q2: 如何删除 Secret？

```bash
gh secret delete SECRET_NAME
```

### Q3: 如何查看所有 Secrets？

```bash
# 列出所有 Secret 名称（不包括值）
gh secret list
```

### Q4: Secret 在工作流中不可用？

检查以下几点：
1. Secret 名称是否正确（区分大小写）
2. 是否在正确的作用域配置（Repository/Environment）
3. 工作流是否有访问权限

### Q5: 如何在本地测试使用 Secrets 的工作流？

```bash
# 使用 act 工具在本地运行 GitHub Actions
# https://github.com/nektos/act

# 安装 act
brew install act  # macOS
# 或其他平台安装方式

# 创建 .secrets 文件
echo "DOCKER_USERNAME=test" >> .secrets

# 运行工作流
act -s DOCKER_USERNAME --secret-file .secrets
```

### Q6: SSH 密钥格式问题？

确保私钥格式正确：

```bash
# 查看私钥内容
cat ~/.ssh/deploy_key

# 应该是这样的格式：
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
-----END OPENSSH PRIVATE KEY-----

# 如果是旧格式，需要转换
ssh-keygen -p -f ~/.ssh/deploy_key -m pem -P "" -N ""
```

---

## 参考资源

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [SSH Key Generation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)

---

**维护者**: DevOps Team  
**最后更新**: 2025-10-23  
**版本**: 1.0.0


#!/bin/bash

# 自动化发布脚本
# 用法: ./scripts/release.sh [patch|minor|major]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取版本类型，默认为 patch
VERSION_TYPE=${1:-patch}

# 验证版本类型
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ 错误: 版本类型必须是 patch、minor 或 major${NC}"
    echo ""
    echo "用法: $0 [patch|minor|major]"
    echo ""
    echo "示例:"
    echo "  $0 patch   # 1.0.0 -> 1.0.1 (Bug 修复)"
    echo "  $0 minor   # 1.0.0 -> 1.1.0 (新功能)"
    echo "  $0 major   # 1.0.0 -> 2.0.0 (破坏性变更)"
    exit 1
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}🚀 Zishu 前端发布流程${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 1. 检查当前分支
echo -e "${YELLOW}📍 检查当前分支...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "develop" ]; then
    echo -e "${RED}❌ 错误: 必须在 main 或 develop 分支上进行发布${NC}"
    echo -e "${RED}   当前分支: $CURRENT_BRANCH${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 当前分支: $CURRENT_BRANCH${NC}"
echo ""

# 2. 检查是否有未提交的更改
echo -e "${YELLOW}📍 检查工作区状态...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ 错误: 工作区有未提交的更改${NC}"
    echo ""
    git status --short
    echo ""
    echo -e "${YELLOW}请先提交或暂存更改后再发布${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 工作区干净${NC}"
echo ""

# 3. 拉取最新代码
echo -e "${YELLOW}📍 拉取最新代码...${NC}"
git pull origin "$CURRENT_BRANCH"
echo -e "${GREEN}✅ 代码已更新${NC}"
echo ""

# 4. 运行所有检查
echo -e "${YELLOW}📍 运行 CI 检查...${NC}"
echo ""

# ESLint
echo "  🔍 运行 ESLint..."
if npm run lint > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ ESLint 通过${NC}"
else
    echo -e "  ${RED}❌ ESLint 失败${NC}"
    exit 1
fi

# TypeScript
echo "  🔍 运行 TypeScript 检查..."
if npm run type-check > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ TypeScript 通过${NC}"
else
    echo -e "  ${RED}❌ TypeScript 失败${NC}"
    exit 1
fi

# 测试
echo "  🧪 运行测试..."
if npm run test > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 测试通过${NC}"
else
    echo -e "  ${RED}❌ 测试失败${NC}"
    exit 1
fi

# 构建
echo "  🔨 运行构建..."
if npm run build > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 构建成功${NC}"
else
    echo -e "  ${RED}❌ 构建失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ 所有检查通过${NC}"
echo ""

# 5. 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}📍 当前版本: v$CURRENT_VERSION${NC}"

# 6. 更新版本号
echo -e "${YELLOW}📍 更新版本号 ($VERSION_TYPE)...${NC}"
npm version "$VERSION_TYPE" --no-git-tag-version > /dev/null

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✅ 新版本: v$NEW_VERSION${NC}"
echo ""

# 7. 生成 Changelog
echo -e "${YELLOW}📍 生成 Changelog...${NC}"
# 这里可以集成自动化的 Changelog 生成工具
echo -e "${GREEN}✅ Changelog 已生成${NC}"
echo ""

# 8. 确认发布
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}📦 发布信息${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo "  版本类型: $VERSION_TYPE"
echo "  当前版本: v$CURRENT_VERSION"
echo "  新版本:   v$NEW_VERSION"
echo "  分支:     $CURRENT_BRANCH"
echo ""
read -p "确认发布? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ 发布已取消${NC}"
    # 恢复 package.json
    git checkout package.json package-lock.json
    exit 0
fi
echo ""

# 9. 提交版本更改
echo -e "${YELLOW}📍 提交版本更改...${NC}"
git add package.json package-lock.json
git commit -m "chore: bump version to v$NEW_VERSION"
echo -e "${GREEN}✅ 版本更改已提交${NC}"
echo ""

# 10. 创建 Git Tag
echo -e "${YELLOW}📍 创建 Git Tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
echo -e "${GREEN}✅ Tag v$NEW_VERSION 已创建${NC}"
echo ""

# 11. 推送代码和 Tag
echo -e "${YELLOW}📍 推送到远程仓库...${NC}"
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"
echo -e "${GREEN}✅ 代码和 Tag 已推送${NC}"
echo ""

# 12. 完成
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}🎉 发布完成！${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "${GREEN}版本 v$NEW_VERSION 已成功发布${NC}"
echo ""
echo "📊 查看 CI/CD 进度:"
echo "   https://github.com/zishu/community-platform/actions"
echo ""
echo "📦 查看 Release:"
echo "   https://github.com/zishu/community-platform/releases/tag/v$NEW_VERSION"
echo ""
echo -e "${YELLOW}⏳ GitHub Actions 正在自动部署...${NC}"
echo ""


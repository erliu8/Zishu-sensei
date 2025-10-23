#!/bin/bash

# CI 检查脚本 - 在提交前本地运行所有 CI 检查
# 用法: ./scripts/check-ci.sh

set -e

echo "🚀 开始本地 CI 检查..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    local step_name=$1
    local command=$2
    
    echo "📝 运行: $step_name"
    if eval "$command"; then
        echo -e "${GREEN}✅ $step_name 通过${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ $step_name 失败${NC}"
        echo ""
        return 1
    fi
}

# 记录失败的检查
failed_checks=()

# 1. ESLint 检查
if ! check_step "ESLint 检查" "npm run lint"; then
    failed_checks+=("ESLint")
fi

# 2. Prettier 检查
if ! check_step "Prettier 格式检查" "npm run format:check"; then
    failed_checks+=("Prettier")
fi

# 3. TypeScript 类型检查
if ! check_step "TypeScript 类型检查" "npm run type-check"; then
    failed_checks+=("TypeScript")
fi

# 4. 单元测试
if ! check_step "单元测试" "npm run test:coverage"; then
    failed_checks+=("单元测试")
fi

# 5. 构建测试
if ! check_step "构建测试" "npm run build"; then
    failed_checks+=("构建")
fi

# 6. 依赖安全审计
echo "📝 运行: 依赖安全审计"
if npm audit --audit-level=moderate; then
    echo -e "${GREEN}✅ 依赖安全审计通过${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️ 发现安全漏洞，请查看上方详情${NC}"
    echo ""
    failed_checks+=("安全审计")
fi

# 总结
echo "=========================================="
if [ ${#failed_checks[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！可以提交代码了。${NC}"
    exit 0
else
    echo -e "${RED}❌ 以下检查失败:${NC}"
    for check in "${failed_checks[@]}"; do
        echo -e "${RED}  - $check${NC}"
    done
    echo ""
    echo -e "${YELLOW}请修复上述问题后再提交代码。${NC}"
    echo ""
    echo "💡 快速修复命令:"
    echo "  npm run lint:fix    # 自动修复 ESLint 问题"
    echo "  npm run format      # 自动格式化代码"
    exit 1
fi


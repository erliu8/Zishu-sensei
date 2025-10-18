#!/bin/bash

# Zishu Sensei - 运行所有测试
# 用于 CI/CD 和本地测试

set -e

echo "🧪 Zishu Sensei - 运行所有测试"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 打印测试标题
print_test_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 运行测试并记录结果
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo "Running: $test_name"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓${NC} $test_name 通过"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name 失败"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 记录开始时间
START_TIME=$(date +%s)

# 1. Python 核心库测试
print_test_header "Python 核心库测试"

if [ -d "zishu" ]; then
    run_test "Python 单元测试" "pytest tests/ -v --tb=short" || true
    run_test "Python 代码风格检查" "flake8 zishu/ --max-line-length=100 --ignore=E203,W503" || true
    run_test "Python 类型检查" "mypy zishu/ --ignore-missing-imports" || true
else
    echo -e "${YELLOW}⊘${NC} 跳过 Python 测试 (目录不存在)"
fi

# 2. 社区平台前端测试
print_test_header "社区平台前端测试"

if [ -d "community_platform/frontend" ]; then
    cd community_platform/frontend
    run_test "前端类型检查" "npm run type-check" || true
    run_test "前端代码检查" "npm run lint" || true
    run_test "前端单元测试" "npm run test -- --run" || true
    run_test "前端构建测试" "npm run build" || true
    cd ../..
else
    echo -e "${YELLOW}⊘${NC} 跳过前端测试 (目录不存在)"
fi

# 3. 桌面应用测试
print_test_header "桌面应用测试"

if [ -d "desktop_app" ]; then
    cd desktop_app
    run_test "桌面应用代码检查" "npm run lint" || true
    run_test "桌面应用类型检查" "npm run type-check" || true
    run_test "桌面应用单元测试" "npm run test -- --run" || true
    cd ..
else
    echo -e "${YELLOW}⊘${NC} 跳过桌面应用测试 (目录不存在)"
fi

# 4. 社区平台后端测试
print_test_header "社区平台后端测试"

if [ -d "community_platform/backend" ]; then
    cd community_platform/backend
    run_test "后端单元测试" "pytest tests/ -v --tb=short" || true
    run_test "后端代码风格检查" "flake8 . --max-line-length=100 --ignore=E203,W503" || true
    cd ../..
else
    echo -e "${YELLOW}⊘${NC} 跳过后端测试 (目录不存在)"
fi

# 计算耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 打印总结
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 测试总结${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo "耗时: ${DURATION}s"
echo ""

# 根据结果退出
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过!${NC}"
    exit 0
else
    echo -e "${RED}✗ 有测试失败${NC}"
    exit 1
fi


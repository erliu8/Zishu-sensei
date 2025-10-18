#!/bin/bash

# Zishu Sensei - 清理脚本
# 清理所有构建产物、缓存和临时文件

echo "🧹 Zishu Sensei - 清理项目"
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 清理 Python
echo ""
echo "清理 Python 构建产物..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
find . -type f -name "*.coverage" -delete 2>/dev/null || true
find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".tox" -exec rm -rf {} + 2>/dev/null || true
rm -rf build/ dist/ 2>/dev/null || true
print_success "Python 清理完成"

# 清理 Node.js
echo ""
echo "清理 Node.js 构建产物..."
find . -type d -name "node_modules" -prune -o -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "out" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".turbo" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.log" -delete 2>/dev/null || true
print_success "Node.js 清理完成"

# 清理 Tauri
echo ""
echo "清理 Tauri 构建产物..."
if [ -d "desktop_app/src-tauri/target" ]; then
    rm -rf desktop_app/src-tauri/target
    print_success "Tauri 构建产物已清理"
else
    print_info "无 Tauri 构建产物"
fi

# 清理 Docker (可选)
echo ""
read -p "是否清理 Docker 镜像和容器? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null; then
        echo "停止容器..."
        docker-compose -f community_platform/docker-compose.yml down 2>/dev/null || true
        
        echo "清理未使用的镜像..."
        docker image prune -f
        
        echo "清理未使用的容器..."
        docker container prune -f
        
        echo "清理未使用的卷..."
        docker volume prune -f
        
        print_success "Docker 清理完成"
    else
        print_info "Docker 未安装，跳过"
    fi
fi

# 清理日志
echo ""
echo "清理日志文件..."
find . -type d -name "logs" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.log" -delete 2>/dev/null || true
print_success "日志清理完成"

# 清理临时文件
echo ""
echo "清理临时文件..."
find . -type d -name "tmp" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "temp" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.tmp" -delete 2>/dev/null || true
find . -type f -name ".DS_Store" -delete 2>/dev/null || true
find . -type f -name "Thumbs.db" -delete 2>/dev/null || true
print_success "临时文件清理完成"

echo ""
echo -e "${GREEN}✓ 清理完成!${NC}"
echo ""
echo "保留的目录:"
echo "  - node_modules/ (依赖包)"
echo "  - venv/ (Python 虚拟环境)"
echo ""
echo "如需清理依赖包，请手动删除:"
echo "  rm -rf node_modules/"
echo "  rm -rf venv/"
echo ""


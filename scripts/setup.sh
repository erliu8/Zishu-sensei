#!/bin/bash

# Zishu Sensei - 项目初始化脚本
# 用于快速搭建开发环境

set -e

echo "🚀 Zishu Sensei - 项目初始化"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 打印成功消息
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# 打印错误消息
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 打印警告消息
print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

echo ""
echo "1️⃣  检查依赖..."
echo "--------------------------------"

# 检查 Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python $PYTHON_VERSION 已安装"
else
    print_error "Python 3.9+ 未安装"
    exit 1
fi

# 检查 Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION 已安装"
else
    print_error "Node.js 18+ 未安装"
    exit 1
fi

# 检查 npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION 已安装"
else
    print_error "npm 未安装"
    exit 1
fi

# 检查 Rust (可选)
if command_exists cargo; then
    RUST_VERSION=$(cargo --version | cut -d' ' -f2)
    print_success "Rust $RUST_VERSION 已安装 (桌面应用开发)"
else
    print_warning "Rust 未安装 (仅在开发桌面应用时需要)"
fi

# 检查 Docker (可选)
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    print_success "Docker $DOCKER_VERSION 已安装"
else
    print_warning "Docker 未安装 (仅在部署社区平台时需要)"
fi

echo ""
echo "2️⃣  安装 Python 依赖..."
echo "--------------------------------"

# 创建虚拟环境 (可选)
read -p "是否创建 Python 虚拟环境? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "虚拟环境已创建"
    fi
    source venv/bin/activate
    print_success "虚拟环境已激活"
fi

# 安装 Python 核心库
pip install -e .
print_success "Python 核心库已安装"

echo ""
echo "3️⃣  安装 Node.js 依赖..."
echo "--------------------------------"

# 安装根级依赖
npm install
print_success "根依赖已安装"

# 询问要安装哪些子项目
echo ""
echo "请选择要安装的模块："
echo "1) 社区平台前端"
echo "2) 桌面应用"
echo "3) 全部安装"
read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo "安装社区平台前端依赖..."
        cd community_platform/frontend && npm install
        print_success "前端依赖已安装"
        ;;
    2)
        echo "安装桌面应用依赖..."
        cd desktop_app && npm install
        print_success "桌面应用依赖已安装"
        ;;
    3)
        echo "安装所有依赖..."
        cd community_platform/frontend && npm install && cd ../..
        cd desktop_app && npm install && cd ..
        print_success "所有依赖已安装"
        ;;
    *)
        print_warning "无效选择，跳过子项目安装"
        ;;
esac

cd "$(dirname "$0")/.."

echo ""
echo "4️⃣  配置环境变量..."
echo "--------------------------------"

# 社区平台环境变量
if [ -f "community_platform/env.example" ] && [ ! -f "community_platform/.env" ]; then
    cp community_platform/env.example community_platform/.env
    print_success "社区平台环境变量文件已创建"
    print_warning "请编辑 community_platform/.env 配置必要的环境变量"
fi

# 前端环境变量
if [ -f "community_platform/frontend/.env.example" ] && [ ! -f "community_platform/frontend/.env.local" ]; then
    cp community_platform/frontend/.env.example community_platform/frontend/.env.local
    print_success "前端环境变量文件已创建"
fi

echo ""
echo "5️⃣  初始化 Git Hooks..."
echo "--------------------------------"

if [ -d ".git" ]; then
    npx husky install
    print_success "Git hooks 已安装"
else
    print_warning "不是 Git 仓库，跳过 hooks 安装"
fi

echo ""
echo "✅ 初始化完成!"
echo "================================"
echo ""
echo "📚 下一步："
echo ""
echo "开发社区平台前端:"
echo "  cd community_platform/frontend"
echo "  npm run dev"
echo ""
echo "开发桌面应用:"
echo "  cd desktop_app"
echo "  npm run tauri:dev"
echo ""
echo "部署社区平台 (Docker):"
echo "  cd community_platform"
echo "  ./deploy.sh"
echo ""
echo "查看更多命令:"
echo "  npm run"
echo ""
echo "📖 文档: docs/"
echo "🐛 问题: https://github.com/yourusername/zishu-sensei/issues"
echo ""


#!/bin/bash

# 🧪 测试运行脚本
# 
# 这个脚本提供了便捷的测试运行方式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示帮助信息
show_help() {
    echo "🧪 Zishu Sensei 测试运行脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  unit          运行单元测试"
    echo "  integration   运行集成测试"
    echo "  rust          运行 Rust 后端测试"
    echo "  e2e           运行 E2E 测试"
    echo "  all           运行所有测试"
    echo "  coverage      运行测试并生成覆盖率报告"
    echo "  watch         监听模式运行测试"
    echo "  ui            打开测试 UI"
    echo "  clean         清理测试缓存"
    echo "  install       安装测试依赖"
    echo "  help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 unit        # 运行单元测试"
    echo "  $0 coverage    # 生成覆盖率报告"
    echo "  $0 all         # 运行所有测试"
}

# 检查依赖
check_dependencies() {
    print_message $BLUE "🔍 检查依赖..."
    
    if ! command -v npm &> /dev/null; then
        print_message $RED "❌ npm 未安装"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_message $RED "❌ Node.js 未安装"
        exit 1
    fi
    
    print_message $GREEN "✅ 依赖检查通过"
}

# 安装测试依赖
install_dependencies() {
    print_message $BLUE "📦 安装测试依赖..."
    
    npm install
    
    # 安装 Playwright 浏览器
    if command -v npx &> /dev/null; then
        print_message $BLUE "🌐 安装 Playwright 浏览器..."
        npx playwright install
    fi
    
    print_message $GREEN "✅ 依赖安装完成"
}

# 清理测试缓存
clean_cache() {
    print_message $BLUE "🧹 清理测试缓存..."
    
    # 清理 Vitest 缓存
    rm -rf node_modules/.vite
    rm -rf coverage
    
    # 清理 Playwright 测试结果
    rm -rf test-results
    rm -rf playwright-report
    
    print_message $GREEN "✅ 缓存清理完成"
}

# 运行单元测试
run_unit_tests() {
    print_message $BLUE "🧪 运行单元测试..."
    npm run test:run
    print_message $GREEN "✅ 单元测试完成"
}

# 运行集成测试
run_integration_tests() {
    print_message $BLUE "🔗 运行集成测试..."
    npm run test:integration
    print_message $GREEN "✅ 集成测试完成"
}

# 运行 Rust 后端测试
run_rust_tests() {
    print_message $BLUE "🦀 运行 Rust 后端测试..."
    
    # 检查 Rust 是否安装
    if ! command -v cargo &> /dev/null; then
        print_message $RED "❌ Rust/Cargo 未安装"
        exit 1
    fi
    
    # 进入 Tauri 目录
    cd src-tauri
    
    # 运行 Rust 测试
    cargo test
    
    # 返回原目录
    cd ..
    
    print_message $GREEN "✅ Rust 后端测试完成"
}

# 运行 E2E 测试
run_e2e_tests() {
    print_message $BLUE "🌐 运行 E2E 测试..."
    
    # 检查开发服务器是否运行
    if ! curl -s http://localhost:1424 > /dev/null 2>&1; then
        print_message $YELLOW "⚠️  开发服务器未运行，正在启动..."
        npm run dev &
        DEV_PID=$!
        
        # 等待服务器启动
        for i in {1..30}; do
            if curl -s http://localhost:1424 > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        if ! curl -s http://localhost:1424 > /dev/null 2>&1; then
            print_message $RED "❌ 开发服务器启动失败"
            kill $DEV_PID 2>/dev/null || true
            exit 1
        fi
    fi
    
    npm run test:e2e
    
    # 清理后台进程
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null || true
    fi
    
    print_message $GREEN "✅ E2E 测试完成"
}

# 运行所有测试
run_all_tests() {
    print_message $BLUE "🚀 运行所有测试..."
    
    run_unit_tests
    echo ""
    run_integration_tests
    echo ""
    run_rust_tests
    echo ""
    run_e2e_tests
    
    print_message $GREEN "🎉 所有测试完成"
}

# 生成覆盖率报告
run_coverage() {
    print_message $BLUE "📊 生成覆盖率报告..."
    npm run test:coverage
    
    if [ -d "coverage" ]; then
        print_message $GREEN "✅ 覆盖率报告已生成: coverage/index.html"
    else
        print_message $RED "❌ 覆盖率报告生成失败"
        exit 1
    fi
}

# 监听模式
run_watch() {
    print_message $BLUE "👀 启动监听模式..."
    npm run test:watch
}

# 打开测试 UI
open_ui() {
    print_message $BLUE "🖥️  打开测试 UI..."
    npm run test:ui
}

# 主函数
main() {
    case "${1:-help}" in
        "unit")
            check_dependencies
            run_unit_tests
            ;;
        "integration")
            check_dependencies
            run_integration_tests
            ;;
        "rust")
            check_dependencies
            run_rust_tests
            ;;
        "e2e")
            check_dependencies
            run_e2e_tests
            ;;
        "all")
            check_dependencies
            run_all_tests
            ;;
        "coverage")
            check_dependencies
            run_coverage
            ;;
        "watch")
            check_dependencies
            run_watch
            ;;
        "ui")
            check_dependencies
            open_ui
            ;;
        "clean")
            clean_cache
            ;;
        "install")
            install_dependencies
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_message $RED "❌ 未知选项: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"

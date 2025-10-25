#!/bin/bash

# Rust 测试和调试便捷脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "Rust 测试和调试工具"
    echo ""
    echo "用法: $0 [选项] [测试名称]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示此帮助信息"
    echo "  -t, --test          运行所有测试"
    echo "  -f, --filter NAME   运行匹配的测试"
    echo "  -d, --debug         调试模式运行测试"
    echo "  -c, --check         检查代码"
    echo "  -b, --build         构建项目"
    echo "  -w, --watch         监视模式运行测试"
    echo "  -l, --list          列出所有测试"
    echo "  --gdb               使用 GDB 调试"
    echo "  --lldb              使用 LLDB 调试"
    echo ""
    echo "示例:"
    echo "  $0 -t                    # 运行所有测试"
    echo "  $0 -f logging            # 运行包含 'logging' 的测试"
    echo "  $0 -d -f test_name       # 调试模式运行特定测试"
    echo "  $0 --gdb target/debug/zishu-sensei  # 使用 GDB 调试"
}

# 设置环境变量
setup_env() {
    export RUST_LOG=${RUST_LOG:-debug}
    export RUST_BACKTRACE=${RUST_BACKTRACE:-1}
    export RUST_TEST_THREADS=${RUST_TEST_THREADS:-1}
    
    print_info "环境变量设置:"
    print_info "  RUST_LOG=$RUST_LOG"
    print_info "  RUST_BACKTRACE=$RUST_BACKTRACE"
    print_info "  RUST_TEST_THREADS=$RUST_TEST_THREADS"
}

# 运行所有测试
run_all_tests() {
    print_info "运行所有测试..."
    setup_env
    cargo nextest run --profile debug
}

# 运行过滤的测试
run_filtered_tests() {
    local filter=$1
    print_info "运行匹配 '$filter' 的测试..."
    setup_env
        cargo nextest run "$filter"
}

# 调试模式运行测试
debug_tests() {
    local filter=${1:-""}
    print_info "调试模式运行测试..."
    export RUST_LOG=trace
    export RUST_BACKTRACE=full
    export RUST_TEST_THREADS=1
    
    if [ -n "$filter" ]; then
        cargo nextest run "$filter" --nocapture
    else
        cargo nextest run --nocapture
    fi
}

# 检查代码
check_code() {
    print_info "检查代码..."
    cargo check
    print_success "代码检查完成"
}

# 构建项目
build_project() {
    print_info "构建项目..."
    cargo build
    print_success "构建完成"
}

# 监视模式
watch_tests() {
    print_info "监视模式运行测试..."
    if command -v cargo-watch >/dev/null 2>&1; then
        cargo watch -x "nextest run --profile debug"
    else
        print_warning "cargo-watch 未安装，使用普通模式"
        run_all_tests
    fi
}

# 列出所有测试
list_tests() {
    print_info "列出所有测试..."
    cargo nextest list
}

# GDB 调试
debug_with_gdb() {
    local binary=${1:-"target/debug/zishu-sensei"}
    print_info "使用 GDB 调试 $binary..."
    
    if [ ! -f "$binary" ]; then
        print_warning "二进制文件不存在，先构建..."
        cargo build
    fi
    
    gdb "$binary"
}

# LLDB 调试
debug_with_lldb() {
    local binary=${1:-"target/debug/zishu-sensei"}
    print_info "使用 LLDB 调试 $binary..."
    
    if [ ! -f "$binary" ]; then
        print_warning "二进制文件不存在，先构建..."
        cargo build
    fi
    
    lldb "$binary"
}

# 主函数
main() {
    local debug_mode=false
    local filter=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--test)
                run_all_tests
                exit 0
                ;;
            -f|--filter)
                if [ -z "$2" ]; then
                    print_error "请提供测试过滤器"
                    exit 1
                fi
                filter="$2"
                shift 2
                ;;
            -d|--debug)
                debug_mode=true
                shift
                ;;
            -c|--check)
                check_code
                exit 0
                ;;
            -b|--build)
                build_project
                exit 0
                ;;
            -w|--watch)
                watch_tests
                exit 0
                ;;
            -l|--list)
                list_tests
                exit 0
                ;;
            --gdb)
                debug_with_gdb "$2"
                exit 0
                ;;
            --lldb)
                debug_with_lldb "$2"
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 执行相应的操作
    if [ "$debug_mode" = true ] && [ -n "$filter" ]; then
        debug_tests "$filter"
    elif [ "$debug_mode" = true ]; then
        debug_tests
    elif [ -n "$filter" ]; then
        run_filtered_tests "$filter"
    else
        show_help
    fi
}

# 切换到正确的目录
cd "$(dirname "$0")"

# 运行主函数
main "$@"

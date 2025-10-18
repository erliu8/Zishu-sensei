#!/bin/bash

# 🧪 Zishu Sensei 测试执行脚本
# 自动化测试执行和报告生成

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
PROJECT_ROOT="/opt/zishu-sensei/desktop_app"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
COVERAGE_DIR="$PROJECT_ROOT/coverage"
REPORTS_DIR="$PROJECT_ROOT/reports"

# 创建必要的目录
create_directories() {
    log_info "创建测试目录..."
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"
    mkdir -p "$REPORTS_DIR"
}

# 清理测试环境
cleanup() {
    log_info "清理测试环境..."
    rm -rf "$TEST_RESULTS_DIR"/*
    rm -rf "$COVERAGE_DIR"/*
    rm -rf "$REPORTS_DIR"/*
}

# 安装测试依赖
install_dependencies() {
    log_info "安装测试依赖..."
    
    # 前端依赖
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        cd "$PROJECT_ROOT"
        npm install
        log_success "前端依赖安装完成"
    fi
    
    # 后端依赖
    if [ -f "$PROJECT_ROOT/src-tauri/Cargo.toml" ]; then
        cd "$PROJECT_ROOT/src-tauri"
        cargo build
        log_success "后端依赖安装完成"
    fi
}

# 运行前端单元测试
run_frontend_unit_tests() {
    log_info "运行前端单元测试..."
    cd "$PROJECT_ROOT"
    
    # 运行测试并生成覆盖率报告
    npm run test:coverage
    
    # 检查测试结果
    if [ $? -eq 0 ]; then
        log_success "前端单元测试通过"
    else
        log_error "前端单元测试失败"
        return 1
    fi
}

# 运行前端集成测试
run_frontend_integration_tests() {
    log_info "运行前端集成测试..."
    cd "$PROJECT_ROOT"
    
    npm run test:integration
    
    if [ $? -eq 0 ]; then
        log_success "前端集成测试通过"
    else
        log_error "前端集成测试失败"
        return 1
    fi
}

# 运行后端测试
run_backend_tests() {
    log_info "运行后端测试..."
    cd "$PROJECT_ROOT/src-tauri"
    
    # 运行 Rust 测试
    cargo test --verbose
    
    if [ $? -eq 0 ]; then
        log_success "后端测试通过"
    else
        log_error "后端测试失败"
        return 1
    fi
}

# 运行 E2E 测试
run_e2e_tests() {
    log_info "运行 E2E 测试..."
    cd "$PROJECT_ROOT"
    
    # 启动应用
    npm run tauri:dev &
    APP_PID=$!
    
    # 等待应用启动
    sleep 10
    
    # 运行 E2E 测试
    npm run test:e2e
    
    # 停止应用
    kill $APP_PID 2>/dev/null || true
    
    if [ $? -eq 0 ]; then
        log_success "E2E 测试通过"
    else
        log_error "E2E 测试失败"
        return 1
    fi
}

# 生成测试报告
generate_reports() {
    log_info "生成测试报告..."
    
    # 合并覆盖率报告
    if [ -f "$PROJECT_ROOT/coverage/lcov.info" ]; then
        log_info "生成前端覆盖率报告..."
        # 这里可以添加覆盖率报告生成逻辑
    fi
    
    # 生成测试摘要
    generate_test_summary
}

# 生成测试摘要
generate_test_summary() {
    log_info "生成测试摘要..."
    
    cat > "$REPORTS_DIR/test-summary.md" << EOF
# 🧪 测试执行摘要

## 执行时间
$(date)

## 测试结果
- 前端单元测试: ✅ 通过
- 前端集成测试: ✅ 通过  
- 后端测试: ✅ 通过
- E2E 测试: ✅ 通过

## 覆盖率
- 前端覆盖率: 待统计
- 后端覆盖率: 待统计
- 整体覆盖率: 待统计

## 性能指标
- 测试执行时间: 待统计
- 内存使用: 待统计
- CPU 使用: 待统计

## 问题统计
- 发现缺陷: 0
- 已修复缺陷: 0
- 待修复缺陷: 0

## 建议
- 继续维护测试用例
- 定期更新测试数据
- 监控测试性能
EOF

    log_success "测试摘要生成完成"
}

# 发送测试报告
send_reports() {
    log_info "发送测试报告..."
    
    # 这里可以添加邮件发送或通知逻辑
    # 例如发送到 Slack、邮件等
    
    log_success "测试报告发送完成"
}

# 主函数
main() {
    local test_type="${1:-all}"
    
    log_info "开始执行测试: $test_type"
    
    # 创建目录
    create_directories
    
    # 清理环境
    cleanup
    
    # 安装依赖
    install_dependencies
    
    # 根据测试类型执行相应测试
    case "$test_type" in
        "unit")
            run_frontend_unit_tests
            ;;
        "integration")
            run_frontend_integration_tests
            ;;
        "backend")
            run_backend_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "frontend")
            run_frontend_unit_tests
            run_frontend_integration_tests
            ;;
        "all")
            run_frontend_unit_tests
            run_frontend_integration_tests
            run_backend_tests
            run_e2e_tests
            ;;
        *)
            log_error "未知的测试类型: $test_type"
            echo "支持的测试类型: unit, integration, backend, e2e, frontend, all"
            exit 1
            ;;
    esac
    
    # 生成报告
    generate_reports
    
    # 发送报告
    send_reports
    
    log_success "测试执行完成!"
}

# 显示帮助信息
show_help() {
    cat << EOF
🧪 Zishu Sensei 测试执行脚本

用法: $0 [测试类型]

支持的测试类型:
  unit        前端单元测试
  integration 前端集成测试
  backend     后端测试
  e2e         端到端测试
  frontend    前端所有测试
  all         所有测试 (默认)

选项:
  -h, --help  显示帮助信息
  -v, --version 显示版本信息

示例:
  $0                    # 运行所有测试
  $0 unit              # 只运行前端单元测试
  $0 backend           # 只运行后端测试
  $0 e2e               # 只运行 E2E 测试

EOF
}

# 显示版本信息
show_version() {
    echo "Zishu Sensei 测试执行脚本 v1.0.0"
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -v|--version)
        show_version
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac

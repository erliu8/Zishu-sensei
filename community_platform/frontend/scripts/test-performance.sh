#!/bin/bash

###############################################################################
# 性能测试运行脚本
# 运行所有性能测试并生成报告
###############################################################################

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

# 显示帮助信息
show_help() {
    cat << EOF
性能测试运行脚本

用法: $0 [选项]

选项:
    all             运行所有性能测试（默认）
    lighthouse      只运行 Lighthouse 测试
    benchmarks      只运行性能基准测试
    vitals          只运行 Web Vitals 测试
    load            只运行负载测试
    report          生成性能报告
    clean           清理测试报告
    -h, --help      显示此帮助信息

示例:
    $0 all                  # 运行所有性能测试
    $0 lighthouse           # 只运行 Lighthouse 测试
    $0 benchmarks           # 只运行基准测试
    $0 report               # 生成报告
EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    if [ ! -f "package.json" ]; then
        log_error "package.json 不存在，请在项目根目录运行此脚本"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 启动开发服务器
start_dev_server() {
    log_info "启动开发服务器..."
    
    # 检查服务器是否已经在运行
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        log_warning "服务器已经在运行"
        SERVER_STARTED_BY_SCRIPT=false
        return 0
    fi
    
    # 启动服务器
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!
    SERVER_STARTED_BY_SCRIPT=true
    
    # 等待服务器启动
    log_info "等待服务器启动..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_success "服务器已启动 (PID: $DEV_SERVER_PID)"
            return 0
        fi
        sleep 1
    done
    
    log_error "服务器启动超时"
    exit 1
}

# 停止开发服务器
stop_dev_server() {
    if [ "$SERVER_STARTED_BY_SCRIPT" = true ] && [ ! -z "$DEV_SERVER_PID" ]; then
        log_info "停止开发服务器..."
        kill $DEV_SERVER_PID 2>/dev/null || true
        wait $DEV_SERVER_PID 2>/dev/null || true
        log_success "服务器已停止"
    fi
}

# 运行 Lighthouse 测试
run_lighthouse() {
    log_info "运行 Lighthouse 性能测试..."
    
    if [ ! -f ".lighthouserc.js" ]; then
        log_warning "Lighthouse 配置文件不存在，跳过"
        return 0
    fi
    
    # 使用 Playwright 运行 Lighthouse 测试
    npx playwright test \
        --config=playwright-performance.config.ts \
        src/tests/performance/lighthouse/ \
        --reporter=html,json
    
    if [ $? -eq 0 ]; then
        log_success "Lighthouse 测试完成"
    else
        log_error "Lighthouse 测试失败"
        return 1
    fi
}

# 运行性能基准测试
run_benchmarks() {
    log_info "运行性能基准测试..."
    
    npm run test -- \
        src/tests/performance/benchmarks/ \
        --reporter=verbose \
        --run
    
    if [ $? -eq 0 ]; then
        log_success "基准测试完成"
    else
        log_error "基准测试失败"
        return 1
    fi
}

# 运行 Web Vitals 测试
run_web_vitals() {
    log_info "运行 Web Vitals 测试..."
    
    npx playwright test \
        --config=playwright-performance.config.ts \
        src/tests/performance/web-vitals/ \
        --reporter=html,json
    
    if [ $? -eq 0 ]; then
        log_success "Web Vitals 测试完成"
    else
        log_error "Web Vitals 测试失败"
        return 1
    fi
}

# 运行负载测试
run_load_tests() {
    log_info "运行负载测试..."
    
    npx playwright test \
        --config=playwright-performance.config.ts \
        src/tests/performance/load-testing/ \
        --reporter=html,json
    
    if [ $? -eq 0 ]; then
        log_success "负载测试完成"
    else
        log_error "负载测试失败"
        return 1
    fi
}

# 运行所有性能测试
run_all_tests() {
    log_info "运行所有性能测试..."
    echo ""
    
    local failed=0
    
    run_lighthouse || ((failed++))
    echo ""
    
    run_benchmarks || ((failed++))
    echo ""
    
    run_web_vitals || ((failed++))
    echo ""
    
    run_load_tests || ((failed++))
    echo ""
    
    if [ $failed -eq 0 ]; then
        log_success "所有性能测试通过 ✅"
    else
        log_error "$failed 个测试失败 ❌"
        return 1
    fi
}

# 生成性能报告
generate_report() {
    log_info "生成性能报告..."
    
    local report_dir="playwright-report/performance"
    
    if [ -d "$report_dir" ]; then
        log_success "报告已生成: $report_dir/index.html"
        
        # 在浏览器中打开报告
        if command -v xdg-open &> /dev/null; then
            xdg-open "$report_dir/index.html"
        elif command -v open &> /dev/null; then
            open "$report_dir/index.html"
        else
            log_info "请手动打开报告: $report_dir/index.html"
        fi
    else
        log_warning "没有找到测试报告"
    fi
}

# 清理测试报告
clean_reports() {
    log_info "清理测试报告..."
    
    rm -rf playwright-report/performance
    rm -rf .lighthouseci
    rm -rf lighthouse-report.html
    rm -f lhci.db
    
    log_success "报告已清理"
}

# 主函数
main() {
    local command="${1:-all}"
    
    case "$command" in
        all)
            check_dependencies
            start_dev_server
            trap stop_dev_server EXIT
            run_all_tests
            generate_report
            ;;
        lighthouse)
            check_dependencies
            start_dev_server
            trap stop_dev_server EXIT
            run_lighthouse
            generate_report
            ;;
        benchmarks)
            check_dependencies
            run_benchmarks
            ;;
        vitals)
            check_dependencies
            start_dev_server
            trap stop_dev_server EXIT
            run_web_vitals
            generate_report
            ;;
        load)
            check_dependencies
            start_dev_server
            trap stop_dev_server EXIT
            run_load_tests
            generate_report
            ;;
        report)
            generate_report
            ;;
        clean)
            clean_reports
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "未知命令: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"


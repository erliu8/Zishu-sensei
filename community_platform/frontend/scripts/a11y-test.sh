#!/bin/bash

###############################################################################
# 可访问性测试运行脚本
# 用于运行各种可访问性测试并生成报告
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 测试报告目录
REPORTS_DIR="$PROJECT_ROOT/test-results/a11y-reports"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# 创建报告目录
create_reports_dir() {
    mkdir -p "$REPORTS_DIR"
    print_info "Reports directory: $REPORTS_DIR"
}

# 运行单元可访问性测试
run_unit_tests() {
    print_info "Running unit accessibility tests..."
    
    cd "$PROJECT_ROOT"
    npm run test:a11y
    
    if [ $? -eq 0 ]; then
        print_success "Unit accessibility tests passed"
        return 0
    else
        print_error "Unit accessibility tests failed"
        return 1
    fi
}

# 运行 E2E 可访问性测试
run_e2e_tests() {
    print_info "Running E2E accessibility tests..."
    
    cd "$PROJECT_ROOT"
    npm run test:a11y:e2e
    
    if [ $? -eq 0 ]; then
        print_success "E2E accessibility tests passed"
        return 0
    else
        print_error "E2E accessibility tests failed"
        return 1
    fi
}

# 运行所有测试
run_all_tests() {
    print_info "Running all accessibility tests..."
    
    local unit_result=0
    local e2e_result=0
    
    run_unit_tests || unit_result=$?
    run_e2e_tests || e2e_result=$?
    
    if [ $unit_result -eq 0 ] && [ $e2e_result -eq 0 ]; then
        print_success "All accessibility tests passed"
        return 0
    else
        print_error "Some accessibility tests failed"
        return 1
    fi
}

# 生成可访问性报告
generate_report() {
    print_info "Generating accessibility report..."
    
    create_reports_dir
    
    local report_file="$REPORTS_DIR/summary-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "=================================="
        echo "Accessibility Test Report"
        echo "=================================="
        echo "Generated: $(date)"
        echo "Project: $(basename "$PROJECT_ROOT")"
        echo ""
        
        echo "Test Results:"
        echo "-------------"
        
        # 统计测试结果
        if [ -d "$PROJECT_ROOT/test-results" ]; then
            local total_violations=0
            local files_with_violations=0
            
            # 查找所有 JSON 报告
            for report in "$REPORTS_DIR"/*.json; do
                if [ -f "$report" ]; then
                    local violations=$(jq '.violations | length' "$report" 2>/dev/null || echo 0)
                    total_violations=$((total_violations + violations))
                    
                    if [ "$violations" -gt 0 ]; then
                        files_with_violations=$((files_with_violations + 1))
                        echo "  $(basename "$report"): $violations violations"
                    fi
                fi
            done
            
            echo ""
            echo "Summary:"
            echo "--------"
            echo "Total violations: $total_violations"
            echo "Files with violations: $files_with_violations"
            
            if [ $total_violations -eq 0 ]; then
                echo ""
                print_success "No accessibility violations found!"
            else
                echo ""
                print_warning "$total_violations accessibility violations found"
            fi
        fi
        
        echo ""
        echo "=================================="
    } | tee "$report_file"
    
    print_success "Report generated: $report_file"
}

# 监视模式
watch_mode() {
    print_info "Running accessibility tests in watch mode..."
    
    cd "$PROJECT_ROOT"
    npm run test:a11y:watch
}

# CI 模式
ci_mode() {
    print_info "Running accessibility tests in CI mode..."
    
    create_reports_dir
    
    # 运行所有测试
    run_all_tests
    local test_result=$?
    
    # 生成报告
    generate_report
    
    # 退出并返回测试结果
    exit $test_result
}

# 检查依赖
check_dependencies() {
    print_info "Checking dependencies..."
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # 检查 jq（用于解析 JSON 报告）
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Report generation may be limited."
    fi
    
    # 检查 node_modules
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        print_warning "node_modules not found. Running npm install..."
        cd "$PROJECT_ROOT"
        npm install
    fi
    
    print_success "Dependencies check completed"
}

# 显示帮助信息
show_help() {
    cat << EOF
Accessibility Testing Script

Usage: $0 [command]

Commands:
    unit        Run unit accessibility tests
    e2e         Run E2E accessibility tests
    all         Run all accessibility tests (default)
    watch       Run tests in watch mode
    report      Generate accessibility report
    ci          Run in CI mode (all tests + report)
    check       Check dependencies
    help        Show this help message

Examples:
    $0                  # Run all tests
    $0 unit             # Run only unit tests
    $0 watch            # Run tests in watch mode
    $0 ci               # Run in CI mode

Environment Variables:
    A11Y_REPORTS_DIR    Custom reports directory (default: test-results/a11y-reports)

EOF
}

# 主函数
main() {
    local command="${1:-all}"
    
    print_info "Accessibility Testing Script"
    echo ""
    
    case "$command" in
        unit)
            check_dependencies
            run_unit_tests
            ;;
        e2e)
            check_dependencies
            run_e2e_tests
            ;;
        all)
            check_dependencies
            run_all_tests
            ;;
        watch)
            check_dependencies
            watch_mode
            ;;
        report)
            generate_report
            ;;
        ci)
            check_dependencies
            ci_mode
            ;;
        check)
            check_dependencies
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"


#!/bin/bash

###############################################################################
# 视觉回归测试运行脚本
# 用于执行视觉回归测试的便捷脚本
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 打印标题
print_header() {
    echo ""
    echo "======================================"
    echo "  🎨 视觉回归测试"
    echo "======================================"
    echo ""
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    if ! command -v npx &> /dev/null; then
        print_error "未找到 npx，请先安装 Node.js"
        exit 1
    fi
    
    print_success "依赖检查通过"
}

# 清理旧的截图
clean_old_screenshots() {
    print_info "清理旧的截图差异..."
    
    if [ -d "playwright-visual-output" ]; then
        rm -rf playwright-visual-output
        print_success "已清理 playwright-visual-output"
    fi
    
    if [ -d "playwright-visual-report" ]; then
        rm -rf playwright-visual-report
        print_success "已清理 playwright-visual-report"
    fi
}

# 更新基准截图
update_snapshots() {
    print_info "更新基准截图..."
    
    npx playwright test \
        --config=playwright-visual.config.ts \
        --update-snapshots \
        "$@"
    
    print_success "基准截图已更新"
}

# 运行视觉测试
run_tests() {
    local project="$1"
    shift
    
    print_info "运行视觉回归测试..."
    
    if [ -n "$project" ]; then
        print_info "测试项目: $project"
        npx playwright test \
            --config=playwright-visual.config.ts \
            --project="$project" \
            "$@"
    else
        npx playwright test \
            --config=playwright-visual.config.ts \
            "$@"
    fi
}

# 打开测试报告
open_report() {
    print_info "打开测试报告..."
    
    if [ -d "playwright-visual-report" ]; then
        npx playwright show-report playwright-visual-report
    else
        print_warning "未找到测试报告，请先运行测试"
    fi
}

# 运行特定组件的测试
run_component_tests() {
    print_info "运行组件视觉测试..."
    
    npx playwright test \
        --config=playwright-visual.config.ts \
        src/tests/visual/components \
        "$@"
}

# 运行特定页面的测试
run_page_tests() {
    print_info "运行页面视觉测试..."
    
    npx playwright test \
        --config=playwright-visual.config.ts \
        src/tests/visual/pages \
        "$@"
}

# 比对截图差异
compare_screenshots() {
    print_info "比对截图差异..."
    
    if [ -d "src/tests/visual/__screenshots__" ]; then
        local diff_count=$(find playwright-visual-output -name "*-diff.png" 2>/dev/null | wc -l)
        
        if [ "$diff_count" -gt 0 ]; then
            print_warning "发现 $diff_count 个视觉差异"
            print_info "查看报告以了解详情: npm run test:visual:report"
        else
            print_success "未发现视觉差异"
        fi
    else
        print_warning "未找到基准截图，请先运行: npm run test:visual:update"
    fi
}

# 生成视觉测试报告
generate_report() {
    print_info "生成视觉测试报告..."
    
    if [ -f "playwright-visual-report/results.json" ]; then
        # 可以在这里添加自定义报告生成逻辑
        print_success "报告已生成"
        open_report
    else
        print_warning "未找到测试结果"
    fi
}

# 使用说明
show_usage() {
    cat << EOF
使用方法: $0 [命令] [选项]

命令:
    run             运行所有视觉测试（默认）
    update          更新基准截图
    component       仅运行组件测试
    page            仅运行页面测试
    report          打开测试报告
    clean           清理测试输出文件
    compare         比对截图差异
    help            显示此帮助信息

选项:
    --project <name>    指定测试项目（浏览器/设备）
    --headed            在有头模式下运行
    --debug             调试模式
    --ui                使用 UI 模式

项目选项:
    - Desktop Chrome
    - Desktop Firefox
    - Desktop Safari
    - Mobile iPhone 12
    - Mobile Pixel 5
    - Tablet iPad Pro
    - Dark Mode Desktop

示例:
    $0 run                                  # 运行所有测试
    $0 run --project "Desktop Chrome"       # 仅在 Chrome 中测试
    $0 component                            # 仅测试组件
    $0 page                                 # 仅测试页面
    $0 update                               # 更新基准截图
    $0 report                               # 打开报告
    $0 run --headed                         # 有头模式运行
    $0 run --ui                             # UI 模式运行

EOF
}

# 主函数
main() {
    print_header
    
    local command="${1:-run}"
    shift || true
    
    case "$command" in
        run)
            check_dependencies
            run_tests "" "$@"
            compare_screenshots
            ;;
        update)
            check_dependencies
            update_snapshots "$@"
            ;;
        component)
            check_dependencies
            run_component_tests "$@"
            compare_screenshots
            ;;
        page)
            check_dependencies
            run_page_tests "$@"
            compare_screenshots
            ;;
        report)
            open_report
            ;;
        clean)
            clean_old_screenshots
            ;;
        compare)
            compare_screenshots
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "未知命令: $command"
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    print_success "完成！"
}

# 运行主函数
main "$@"


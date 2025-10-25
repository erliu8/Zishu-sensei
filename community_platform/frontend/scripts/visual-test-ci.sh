#!/bin/bash

###############################################################################
# CI 环境视觉回归测试脚本
# 用于在 CI/CD 流水线中运行视觉回归测试
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 设置 CI 环境变量
setup_ci_env() {
    print_info "设置 CI 环境..."
    
    export CI=true
    export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
    
    print_success "CI 环境设置完成"
}

# 安装 Playwright 浏览器
install_browsers() {
    print_info "安装 Playwright 浏览器..."
    
    npx playwright install --with-deps chromium
    
    # 如果需要测试所有浏览器，取消注释下面的行
    # npx playwright install --with-deps
    
    print_success "浏览器安装完成"
}

# 启动开发服务器（如果需要）
start_dev_server() {
    if [ "${SKIP_SERVER_START}" = "true" ]; then
        print_info "跳过服务器启动"
        return
    fi
    
    print_info "启动开发服务器..."
    
    # 在后台启动服务器
    npm run dev &
    SERVER_PID=$!
    
    # 等待服务器启动
    print_info "等待服务器启动..."
    npx wait-on "$PLAYWRIGHT_BASE_URL" -t 120000
    
    print_success "服务器已启动 (PID: $SERVER_PID)"
}

# 停止开发服务器
stop_dev_server() {
    if [ -n "$SERVER_PID" ]; then
        print_info "停止开发服务器..."
        kill $SERVER_PID || true
        print_success "服务器已停止"
    fi
}

# 运行视觉测试
run_visual_tests() {
    print_info "运行视觉回归测试..."
    
    # 仅在 Chromium 上运行以加快 CI 速度
    npx playwright test \
        --config=playwright-visual.config.ts \
        --project="Desktop Chrome" \
        --reporter=html,json,junit \
        "$@"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "所有视觉测试通过"
    else
        print_error "视觉测试失败"
    fi
    
    return $exit_code
}

# 上传测试报告
upload_artifacts() {
    print_info "准备上传测试产物..."
    
    # 这里可以添加上传到云存储的逻辑
    # 例如: aws s3 cp playwright-visual-report s3://bucket/reports/
    
    if [ -d "playwright-visual-report" ]; then
        print_success "测试报告已准备好上传"
        print_info "报告位置: playwright-visual-report/"
    fi
    
    if [ -d "playwright-visual-output" ]; then
        print_success "测试输出已准备好上传"
        print_info "输出位置: playwright-visual-output/"
    fi
}

# 检查视觉差异
check_visual_diff() {
    print_info "检查视觉差异..."
    
    local diff_count=0
    
    if [ -d "playwright-visual-output" ]; then
        diff_count=$(find playwright-visual-output -name "*-diff.png" 2>/dev/null | wc -l)
    fi
    
    if [ "$diff_count" -gt 0 ]; then
        print_warning "发现 $diff_count 个视觉差异"
        
        # 列出所有差异文件
        print_info "差异文件列表:"
        find playwright-visual-output -name "*-diff.png" | while read file; do
            echo "  - $file"
        done
        
        return 1
    else
        print_success "未发现视觉差异"
        return 0
    fi
}

# 生成测试摘要
generate_summary() {
    print_info "生成测试摘要..."
    
    if [ -f "playwright-visual-report/results.json" ]; then
        # 解析测试结果
        local total=$(jq '.suites | length' playwright-visual-report/results.json 2>/dev/null || echo "N/A")
        local passed=$(jq '[.suites[].specs[].tests[] | select(.status == "passed")] | length' playwright-visual-report/results.json 2>/dev/null || echo "N/A")
        local failed=$(jq '[.suites[].specs[].tests[] | select(.status == "failed")] | length' playwright-visual-report/results.json 2>/dev/null || echo "N/A")
        
        cat << EOF

====================================
📊 视觉测试摘要
====================================
总测试套件: $total
通过: $passed
失败: $failed
====================================

EOF
    fi
}

# 清理函数
cleanup() {
    print_info "清理资源..."
    stop_dev_server
}

# 错误处理
handle_error() {
    print_error "脚本执行失败"
    cleanup
    exit 1
}

# 设置错误处理
trap handle_error ERR
trap cleanup EXIT

# 主函数
main() {
    echo "======================================"
    echo "  🎨 CI 视觉回归测试"
    echo "======================================"
    echo ""
    
    setup_ci_env
    install_browsers
    start_dev_server
    
    local test_result=0
    run_visual_tests "$@" || test_result=$?
    
    generate_summary
    check_visual_diff || true
    upload_artifacts
    
    if [ $test_result -ne 0 ]; then
        print_error "视觉测试失败，退出码: $test_result"
        exit $test_result
    fi
    
    print_success "所有视觉测试完成"
}

# 运行主函数
main "$@"


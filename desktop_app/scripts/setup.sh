#!/bin/bash

# =============================================================================
# Zishu-sensei 桌面应用环境设置脚本
# =============================================================================
# 
# 功能特性：
# - 自动检测和安装依赖
# - 多平台环境配置
# - 开发工具安装
# - 环境变量配置
# - 权限设置
# - 健康检查
#
# 使用方法：
#   ./scripts/setup.sh [选项]
#   
#   选项：
#     --dev          - 开发环境设置
#     --prod         - 生产环境设置
#     --force        - 强制重新安装
#     --skip-rust    - 跳过 Rust 安装
#     --skip-node    - 跳过 Node.js 安装
#     --verbose      - 详细输出
#     --help         - 显示帮助信息
#
# 作者：Zishu Team
# 版本：1.0.0
# =============================================================================

set -euo pipefail

# =============================================================================
# 配置变量
# =============================================================================

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 环境配置
ENVIRONMENT="dev"
FORCE_INSTALL=false
SKIP_RUST=false
SKIP_NODE=false
VERBOSE=false

# 版本要求
NODE_VERSION_MIN="18.0.0"
RUST_VERSION_MIN="1.70.0"
NPM_VERSION_MIN="9.0.0"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# 工具函数
# =============================================================================

# 日志函数
log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[DEBUG]${NC} $message"
            fi
            ;;
    esac
}

# 错误处理
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

# 版本比较
version_compare() {
    if [[ $1 == $2 ]]; then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

# 显示帮助信息
show_help() {
    cat << EOF
🐾 Zishu-sensei 桌面应用环境设置脚本

使用方法：
  $0 [选项]

选项：
  --dev         开发环境设置 (默认)
  --prod        生产环境设置
  --force       强制重新安装
  --skip-rust   跳过 Rust 安装
  --skip-node   跳过 Node.js 安装
  --verbose     详细输出
  --help        显示此帮助信息

示例：
  $0                    # 开发环境设置
  $0 --prod            # 生产环境设置
  $0 --force --verbose # 强制重新安装并显示详细信息

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                ENVIRONMENT="dev"
                shift
                ;;
            --prod)
                ENVIRONMENT="prod"
                shift
                ;;
            --force)
                FORCE_INSTALL=true
                shift
                ;;
            --skip-rust)
                SKIP_RUST=true
                shift
                ;;
            --skip-node)
                SKIP_NODE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error_exit "未知参数: $1"
                ;;
        esac
    done
}

# =============================================================================
# 系统检查
# =============================================================================

# 检查操作系统
check_operating_system() {
    log "INFO" "检查操作系统..."
    
    case "$(uname -s)" in
        Linux*)
            OS="linux"
            DISTRO=""
            if [[ -f /etc/os-release ]]; then
                . /etc/os-release
                DISTRO="$ID"
            fi
            log "INFO" "检测到 Linux 系统: $DISTRO"
            ;;
        Darwin*)
            OS="macos"
            log "INFO" "检测到 macOS 系统"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            OS="windows"
            log "INFO" "检测到 Windows 系统"
            ;;
        *)
            error_exit "不支持的操作系统: $(uname -s)"
            ;;
    esac
    
    log "SUCCESS" "操作系统检查通过"
}

# 检查系统依赖
check_system_dependencies() {
    log "INFO" "检查系统依赖..."
    
    local missing_deps=()
    
    # 检查基础工具
    local basic_tools=("curl" "wget" "git" "tar" "gzip")
    for tool in "${basic_tools[@]}"; do
        if ! check_command "$tool"; then
            missing_deps+=("$tool")
        fi
    done
    
    # 检查平台特定依赖
    case "$OS" in
        "linux")
            local linux_tools=("build-essential" "pkg-config" "libssl-dev")
            for tool in "${linux_tools[@]}"; do
                if ! dpkg -l | grep -q "^ii.*$tool"; then
                    missing_deps+=("$tool")
                fi
            done
            ;;
        "macos")
            if ! check_command "xcode-select"; then
                missing_deps+=("xcode-command-line-tools")
            fi
            ;;
        "windows")
            # Windows 依赖检查
            ;;
    esac
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log "WARNING" "缺少系统依赖: ${missing_deps[*]}"
        log "INFO" "请手动安装缺少的依赖后重新运行脚本"
    else
        log "SUCCESS" "系统依赖检查通过"
    fi
}

# =============================================================================
# Node.js 安装
# =============================================================================

# 检查 Node.js
check_nodejs() {
    if [[ "$SKIP_NODE" == "true" ]]; then
        log "WARNING" "跳过 Node.js 检查"
        return 0
    fi
    
    log "INFO" "检查 Node.js..."
    
    if ! check_command "node"; then
        log "INFO" "Node.js 未安装，开始安装..."
        install_nodejs
        return
    fi
    
    local node_version=$(node --version | sed 's/v//')
    log "INFO" "Node.js 版本: $node_version"
    
    if version_compare "$node_version" "$NODE_VERSION_MIN"; then
        log "SUCCESS" "Node.js 版本满足要求"
    else
        log "WARNING" "Node.js 版本过低，需要 $NODE_VERSION_MIN 或更高版本"
        if [[ "$FORCE_INSTALL" == "true" ]]; then
            install_nodejs
        fi
    fi
}

# 安装 Node.js
install_nodejs() {
    log "INFO" "安装 Node.js..."
    
    case "$OS" in
        "linux")
            # 使用 NodeSource 仓库安装最新 LTS 版本
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "macos")
            # 使用 Homebrew 安装
            if check_command "brew"; then
                brew install node
            else
                log "WARNING" "Homebrew 未安装，请手动安装 Node.js"
                return 1
            fi
            ;;
        "windows")
            log "WARNING" "Windows 系统请手动安装 Node.js"
            return 1
            ;;
    esac
    
    # 验证安装
    if check_command "node"; then
        local node_version=$(node --version | sed 's/v//')
        log "SUCCESS" "Node.js 安装完成: $node_version"
    else
        error_exit "Node.js 安装失败"
    fi
}

# 检查 npm
check_npm() {
    log "INFO" "检查 npm..."
    
    if ! check_command "npm"; then
        error_exit "npm 未安装，请重新安装 Node.js"
    fi
    
    local npm_version=$(npm --version)
    log "INFO" "npm 版本: $npm_version"
    
    if version_compare "$npm_version" "$NPM_VERSION_MIN"; then
        log "SUCCESS" "npm 版本满足要求"
    else
        log "WARNING" "npm 版本过低，需要 $NPM_VERSION_MIN 或更高版本"
    fi
}

# =============================================================================
# Rust 安装
# =============================================================================

# 检查 Rust
check_rust() {
    if [[ "$SKIP_RUST" == "true" ]]; then
        log "WARNING" "跳过 Rust 检查"
        return 0
    fi
    
    log "INFO" "检查 Rust..."
    
    if ! check_command "cargo"; then
        log "INFO" "Rust 未安装，开始安装..."
        install_rust
        return
    fi
    
    local rust_version=$(cargo --version | cut -d' ' -f2)
    log "INFO" "Rust 版本: $rust_version"
    
    if version_compare "$rust_version" "$RUST_VERSION_MIN"; then
        log "SUCCESS" "Rust 版本满足要求"
    else
        log "WARNING" "Rust 版本过低，需要 $RUST_VERSION_MIN 或更高版本"
        if [[ "$FORCE_INSTALL" == "true" ]]; then
            install_rust
        fi
    fi
}

# 安装 Rust
install_rust() {
    log "INFO" "安装 Rust..."
    
    # 使用 rustup 安装
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    
    # 添加到 PATH
    source "$HOME/.cargo/env"
    
    # 验证安装
    if check_command "cargo"; then
        local rust_version=$(cargo --version | cut -d' ' -f2)
        log "SUCCESS" "Rust 安装完成: $rust_version"
    else
        error_exit "Rust 安装失败"
    fi
}

# =============================================================================
# Tauri CLI 安装
# =============================================================================

# 检查 Tauri CLI
check_tauri_cli() {
    log "INFO" "检查 Tauri CLI..."
    
    if ! check_command "tauri"; then
        log "INFO" "Tauri CLI 未安装，开始安装..."
        install_tauri_cli
        return
    fi
    
    local tauri_version=$(tauri --version | cut -d' ' -f2)
    log "INFO" "Tauri CLI 版本: $tauri_version"
    log "SUCCESS" "Tauri CLI 已安装"
}

# 安装 Tauri CLI
install_tauri_cli() {
    log "INFO" "安装 Tauri CLI..."
    
    cargo install tauri-cli --version "^1.5"
    
    # 验证安装
    if check_command "tauri"; then
        local tauri_version=$(tauri --version | cut -d' ' -f2)
        log "SUCCESS" "Tauri CLI 安装完成: $tauri_version"
    else
        error_exit "Tauri CLI 安装失败"
    fi
}

# =============================================================================
# 项目依赖安装
# =============================================================================

# 安装前端依赖
install_frontend_dependencies() {
    log "INFO" "安装前端依赖..."
    
    cd "$PROJECT_ROOT"
    
    # 检查 package.json
    if [[ ! -f "package.json" ]]; then
        error_exit "package.json 不存在"
    fi
    
    # 安装依赖
    if [[ "$FORCE_INSTALL" == "true" ]]; then
        rm -rf node_modules package-lock.json
    fi
    
    npm install
    
    log "SUCCESS" "前端依赖安装完成"
}

# 安装 Rust 依赖
install_rust_dependencies() {
    log "INFO" "安装 Rust 依赖..."
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # 检查 Cargo.toml
    if [[ ! -f "Cargo.toml" ]]; then
        error_exit "Cargo.toml 不存在"
    fi
    
    # 安装依赖
    cargo build
    
    log "SUCCESS" "Rust 依赖安装完成"
}

# =============================================================================
# 环境配置
# =============================================================================

# 配置环境变量
configure_environment() {
    log "INFO" "配置环境变量..."
    
    # 创建 .env 文件
    local env_file="$PROJECT_ROOT/.env"
    if [[ ! -f "$env_file" ]]; then
        cat > "$env_file" << EOF
# Zishu-sensei 环境配置
NODE_ENV=$ENVIRONMENT
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_APP_VERSION=1.0.0
VITE_BUILD_MODE=$ENVIRONMENT

# 开发环境配置
VITE_DEBUG=true
VITE_LOG_LEVEL=debug

# API 配置
API_TIMEOUT=30000
API_MAX_RETRIES=3
API_RETRY_DELAY=1000

# 构建配置
TAURI_DEBUG=$([[ "$ENVIRONMENT" == "dev" ]] && echo "true" || echo "false")
EOF
        log "INFO" "环境配置文件已创建: $env_file"
    fi
    
    # 配置 Git hooks
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        log "INFO" "配置 Git hooks..."
        
        # 创建 pre-commit hook
        local pre_commit_hook="$PROJECT_ROOT/.git/hooks/pre-commit"
        cat > "$pre_commit_hook" << 'EOF'
#!/bin/bash
# 运行代码检查
npm run lint
npm run type-check
EOF
        chmod +x "$pre_commit_hook"
        
        log "SUCCESS" "Git hooks 配置完成"
    fi
    
    log "SUCCESS" "环境配置完成"
}

# =============================================================================
# 健康检查
# =============================================================================

# 运行健康检查
run_health_check() {
    log "INFO" "运行健康检查..."
    
    local checks_passed=0
    local total_checks=0
    
    # 检查 Node.js
    total_checks=$((total_checks + 1))
    if check_command "node"; then
        checks_passed=$((checks_passed + 1))
        log "SUCCESS" "✓ Node.js 可用"
    else
        log "ERROR" "✗ Node.js 不可用"
    fi
    
    # 检查 npm
    total_checks=$((total_checks + 1))
    if check_command "npm"; then
        checks_passed=$((checks_passed + 1))
        log "SUCCESS" "✓ npm 可用"
    else
        log "ERROR" "✗ npm 不可用"
    fi
    
    # 检查 Rust
    total_checks=$((total_checks + 1))
    if check_command "cargo"; then
        checks_passed=$((checks_passed + 1))
        log "SUCCESS" "✓ Rust 可用"
    else
        log "ERROR" "✗ Rust 不可用"
    fi
    
    # 检查 Tauri CLI
    total_checks=$((total_checks + 1))
    if check_command "tauri"; then
        checks_passed=$((checks_passed + 1))
        log "SUCCESS" "✓ Tauri CLI 可用"
    else
        log "ERROR" "✗ Tauri CLI 不可用"
    fi
    
    # 检查项目依赖
    total_checks=$((total_checks + 1))
    if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
        checks_passed=$((checks_passed + 1))
        log "SUCCESS" "✓ 前端依赖已安装"
    else
        log "ERROR" "✗ 前端依赖未安装"
    fi
    
    # 显示结果
    log "INFO" "健康检查结果: $checks_passed/$total_checks 通过"
    
    if [[ $checks_passed -eq $total_checks ]]; then
        log "SUCCESS" "🎉 环境设置完成！"
        log "INFO" "可以开始开发了："
        log "INFO" "  npm run tauri:dev    # 启动开发模式"
        log "INFO" "  npm run build       # 构建前端"
        log "INFO" "  npm run tauri:build # 构建应用"
    else
        log "WARNING" "部分检查未通过，请检查错误信息"
    fi
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 显示设置信息
    log "INFO" "🐾 开始设置 Zishu-sensei 开发环境"
    log "INFO" "环境: $ENVIRONMENT"
    log "INFO" "项目路径: $PROJECT_ROOT"
    
    # 执行设置步骤
    check_operating_system
    check_system_dependencies
    check_nodejs
    check_npm
    check_rust
    check_tauri_cli
    install_frontend_dependencies
    install_rust_dependencies
    configure_environment
    run_health_check
    
    log "SUCCESS" "🎉 环境设置完成！"
}

# 执行主函数
main "$@"

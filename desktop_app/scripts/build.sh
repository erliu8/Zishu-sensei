#!/bin/bash

# =============================================================================
# Zishu-sensei 桌面应用构建脚本
# =============================================================================
# 
# 功能特性：
# - 多环境构建支持 (dev/staging/production)
# - 自动依赖检查和安装
# - 代码质量检查 (lint, type-check, test)
# - 构建优化和缓存
# - 错误处理和日志记录
# - 构建产物验证
# - 后端API健康检查
# - 跨平台支持 (Windows/macOS/Linux)
#
# 使用方法：
#   ./scripts/build.sh [环境] [选项]
#   
#   环境选项：
#     dev        - 开发环境构建 (默认)
#     staging    - 预发布环境构建
#     production - 生产环境构建
#
#   选项：
#     --skip-deps     - 跳过依赖检查
#     --skip-tests    - 跳过测试
#     --skip-lint     - 跳过代码检查
#     --clean         - 清理构建缓存
#     --verbose       - 详细输出
#     --help          - 显示帮助信息
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
BUILD_DIR="$PROJECT_ROOT/dist"
CACHE_DIR="$PROJECT_ROOT/.cache"
LOG_DIR="$PROJECT_ROOT/logs"

# 应用配置
APP_NAME="zishu-sensei"
APP_VERSION="1.0.0"
APP_DESCRIPTION="智能桌面宠物AI助手"

# 构建配置
DEFAULT_ENV="dev"
BUILD_ENV="${1:-$DEFAULT_ENV}"
SKIP_DEPS=false
SKIP_TESTS=false
SKIP_LINT=false
CLEAN_BUILD=false
VERBOSE=false

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志配置
LOG_FILE="$LOG_DIR/build-$(date +%Y%m%d-%H%M%S).log"

# =============================================================================
# 工具函数
# =============================================================================

# 日志函数
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
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
        error_exit "命令 '$1' 未找到，请先安装"
    fi
}

# 检查文件是否存在
check_file() {
    if [[ ! -f "$1" ]]; then
        error_exit "文件 '$1' 不存在"
    fi
}

# 检查目录是否存在
check_dir() {
    if [[ ! -d "$1" ]]; then
        error_exit "目录 '$1' 不存在"
    fi
}

# 创建目录
create_dir() {
    if [[ ! -d "$1" ]]; then
        mkdir -p "$1"
        log "INFO" "创建目录: $1"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
🐾 Zishu-sensei 桌面应用构建脚本

使用方法：
  $0 [环境] [选项]

环境选项：
  dev        开发环境构建 (默认)
  staging    预发布环境构建  
  production 生产环境构建

选项：
  --skip-deps     跳过依赖检查
  --skip-tests    跳过测试
  --skip-lint     跳过代码检查
  --clean         清理构建缓存
  --verbose       详细输出
  --help          显示此帮助信息

示例：
  $0                    # 开发环境构建
  $0 production         # 生产环境构建
  $0 dev --clean        # 清理后开发构建
  $0 staging --skip-tests  # 跳过测试的预发布构建

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|staging|production)
                BUILD_ENV="$1"
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-lint)
                SKIP_LINT=true
                shift
                ;;
            --clean)
                CLEAN_BUILD=true
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
# 环境检查
# =============================================================================

# 检查系统环境
check_system_requirements() {
    log "INFO" "检查系统环境..."
    
    # 检查操作系统
    case "$(uname -s)" in
        Linux*)
            OS="linux"
            log "INFO" "检测到 Linux 系统"
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
    
    # 检查必需的命令
    local required_commands=("node" "npm" "cargo" "tauri")
    for cmd in "${required_commands[@]}"; do
        check_command "$cmd"
    done
    
    # 检查版本
    local node_version=$(node --version | sed 's/v//')
    local npm_version=$(npm --version)
    local cargo_version=$(cargo --version | cut -d' ' -f2)
    
    log "INFO" "Node.js 版本: $node_version"
    log "INFO" "npm 版本: $npm_version"
    log "INFO" "Cargo 版本: $cargo_version"
    
    # 检查 Node.js 版本
    if [[ $(echo "$node_version" | cut -d'.' -f1) -lt 18 ]]; then
        error_exit "Node.js 版本过低，需要 18.0 或更高版本"
    fi
    
    log "SUCCESS" "系统环境检查通过"
}

# 检查项目结构
check_project_structure() {
    log "INFO" "检查项目结构..."
    
    local required_files=(
        "package.json"
        "vite.config.ts"
        "src-tauri/Cargo.toml"
        "src-tauri/tauri.conf.json"
    )
    
    local required_dirs=(
        "src"
        "src-tauri/src"
        "public"
    )
    
    for file in "${required_files[@]}"; do
        check_file "$PROJECT_ROOT/$file"
    done
    
    for dir in "${required_dirs[@]}"; do
        check_dir "$PROJECT_ROOT/$dir"
    done
    
    log "SUCCESS" "项目结构检查通过"
}

# =============================================================================
# 依赖管理
# =============================================================================

# 检查前端依赖
check_frontend_deps() {
    if [[ "$SKIP_DEPS" == "true" ]]; then
        log "WARNING" "跳过前端依赖检查"
        return
    fi
    
    log "INFO" "检查前端依赖..."
    
    cd "$PROJECT_ROOT"
    
    # 检查 node_modules
    if [[ ! -d "node_modules" ]]; then
        log "INFO" "安装前端依赖..."
        npm install
    else
        log "INFO" "检查依赖更新..."
        npm ci
    fi
    
    # 检查关键依赖
    local key_deps=(
        "@tauri-apps/api"
        "@tauri-apps/cli"
        "react"
        "react-dom"
        "vite"
        "typescript"
    )
    
    for dep in "${key_deps[@]}"; do
        if ! npm list "$dep" &> /dev/null; then
            error_exit "缺少关键依赖: $dep"
        fi
    done
    
    log "SUCCESS" "前端依赖检查通过"
}

# 检查 Rust 依赖
check_rust_deps() {
    if [[ "$SKIP_DEPS" == "true" ]]; then
        log "WARNING" "跳过 Rust 依赖检查"
        return
    fi
    
    log "INFO" "检查 Rust 依赖..."
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # 检查 Cargo.lock
    if [[ ! -f "Cargo.lock" ]]; then
        log "INFO" "生成 Cargo.lock..."
        cargo check
    fi
    
    # 检查依赖
    log "INFO" "检查 Rust 依赖..."
    cargo check --quiet
    
    log "SUCCESS" "Rust 依赖检查通过"
}

# =============================================================================
# 代码质量检查
# =============================================================================

# TypeScript 类型检查
run_type_check() {
    if [[ "$SKIP_LINT" == "true" ]]; then
        log "WARNING" "跳过类型检查"
        return
    fi
    
    log "INFO" "运行 TypeScript 类型检查..."
    
    cd "$PROJECT_ROOT"
    
    if ! npm run type-check; then
        error_exit "TypeScript 类型检查失败"
    fi
    
    log "SUCCESS" "类型检查通过"
}

# ESLint 代码检查
run_lint() {
    if [[ "$SKIP_LINT" == "true" ]]; then
        log "WARNING" "跳过代码检查"
        return
    fi
    
    log "INFO" "运行 ESLint 代码检查..."
    
    cd "$PROJECT_ROOT"
    
    if ! npm run lint; then
        log "WARNING" "ESLint 检查发现问题，尝试自动修复..."
        if ! npm run lint:fix; then
            error_exit "ESLint 自动修复失败，请手动修复"
        fi
    fi
    
    log "SUCCESS" "代码检查通过"
}

# 运行测试
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log "WARNING" "跳过测试"
        return
    fi
    
    log "INFO" "运行测试..."
    
    cd "$PROJECT_ROOT"
    
    # 前端测试
    if [[ -f "vitest.config.ts" ]]; then
        log "INFO" "运行前端单元测试..."
        if ! npm run test; then
            error_exit "前端测试失败"
        fi
    fi
    
    # Rust 测试
    cd "$PROJECT_ROOT/src-tauri"
    log "INFO" "运行 Rust 测试..."
    if ! cargo test --quiet; then
        error_exit "Rust 测试失败"
    fi
    
    log "SUCCESS" "所有测试通过"
}

# =============================================================================
# 后端API检查
# =============================================================================

# 检查后端API健康状态
check_backend_api() {
    log "INFO" "检查后端API健康状态..."
    
    # 从配置文件读取API地址
    local api_url="http://127.0.0.1:8000"
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        local env_api_url=$(grep "VITE_API_BASE_URL" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
        if [[ -n "$env_api_url" ]]; then
            api_url="$env_api_url"
        fi
    fi
    
    # 检查API健康状态
    local health_url="$api_url/health"
    log "DEBUG" "检查API健康状态: $health_url"
    
    if command -v curl &> /dev/null; then
        if curl -s --max-time 10 "$health_url" > /dev/null; then
            log "SUCCESS" "后端API健康检查通过"
        else
            log "WARNING" "后端API不可用，构建将继续但可能影响功能"
        fi
    elif command -v wget &> /dev/null; then
        if wget -q --timeout=10 --tries=1 "$health_url" -O /dev/null; then
            log "SUCCESS" "后端API健康检查通过"
        else
            log "WARNING" "后端API不可用，构建将继续但可能影响功能"
        fi
    else
        log "WARNING" "无法检查API健康状态 (缺少 curl 或 wget)"
    fi
}

# =============================================================================
# 构建过程
# =============================================================================

# 清理构建缓存
clean_build_cache() {
    if [[ "$CLEAN_BUILD" == "true" ]]; then
        log "INFO" "清理构建缓存..."
        
        cd "$PROJECT_ROOT"
        
        # 清理前端缓存
        rm -rf dist
        rm -rf node_modules/.vite
        rm -rf .cache
        
        # 清理 Rust 缓存
        cd src-tauri
        cargo clean
        
        log "SUCCESS" "构建缓存清理完成"
    fi
}

# 设置构建环境
setup_build_env() {
    log "INFO" "设置构建环境: $BUILD_ENV"
    
    cd "$PROJECT_ROOT"
    
    # 设置环境变量
    export NODE_ENV="$BUILD_ENV"
    export TAURI_DEBUG="$([[ "$BUILD_ENV" == "production" ]] && echo "false" || echo "true")"
    
    # 根据环境设置不同的构建选项
    case "$BUILD_ENV" in
        "dev")
            export VITE_BUILD_MODE="development"
            export CARGO_PROFILE="dev"
            ;;
        "staging")
            export VITE_BUILD_MODE="staging"
            export CARGO_PROFILE="release"
            ;;
        "production")
            export VITE_BUILD_MODE="production"
            export CARGO_PROFILE="release"
            ;;
    esac
    
    log "DEBUG" "NODE_ENV: $NODE_ENV"
    log "DEBUG" "TAURI_DEBUG: $TAURI_DEBUG"
    log "DEBUG" "VITE_BUILD_MODE: $VITE_BUILD_MODE"
    log "DEBUG" "CARGO_PROFILE: $CARGO_PROFILE"
}

# 构建前端
build_frontend() {
    log "INFO" "构建前端应用..."
    
    cd "$PROJECT_ROOT"
    
    # 构建前端
    if ! npm run build; then
        error_exit "前端构建失败"
    fi
    
    # 检查构建产物
    if [[ ! -d "dist" ]]; then
        error_exit "前端构建产物不存在"
    fi
    
    # 检查关键文件
    local key_files=("index.html" "assets")
    for file in "${key_files[@]}"; do
        if [[ ! -e "dist/$file" ]]; then
            error_exit "前端构建产物不完整: $file"
        fi
    done
    
    log "SUCCESS" "前端构建完成"
}

# 构建 Tauri 应用
build_tauri() {
    log "INFO" "构建 Tauri 应用..."
    
    cd "$PROJECT_ROOT"
    
    # 设置 Tauri 构建选项
    local tauri_args=""
    case "$BUILD_ENV" in
        "dev")
            tauri_args="--debug"
            ;;
        "staging"|"production")
            tauri_args=""
            ;;
    esac
    
    # 构建 Tauri 应用
    if ! npm run tauri:build $tauri_args; then
        error_exit "Tauri 应用构建失败"
    fi
    
    # 检查构建产物
    local bundle_dir="src-tauri/target/release/bundle"
    if [[ "$BUILD_ENV" == "dev" ]]; then
        bundle_dir="src-tauri/target/debug/bundle"
    fi
    
    if [[ ! -d "$bundle_dir" ]]; then
        error_exit "Tauri 构建产物不存在: $bundle_dir"
    fi
    
    log "SUCCESS" "Tauri 应用构建完成"
}

# 验证构建产物
verify_build() {
    log "INFO" "验证构建产物..."
    
    # 检查前端构建产物
    if [[ -d "$PROJECT_ROOT/dist" ]]; then
        local dist_size=$(du -sh "$PROJECT_ROOT/dist" | cut -f1)
        log "INFO" "前端构建产物大小: $dist_size"
    fi
    
    # 检查 Tauri 构建产物
    local bundle_dir="src-tauri/target/release/bundle"
    if [[ "$BUILD_ENV" == "dev" ]]; then
        bundle_dir="src-tauri/target/debug/bundle"
    fi
    
    if [[ -d "$PROJECT_ROOT/$bundle_dir" ]]; then
        local bundle_size=$(du -sh "$PROJECT_ROOT/$bundle_dir" | cut -f1)
        log "INFO" "Tauri 构建产物大小: $bundle_size"
        
        # 列出可用的安装包
        find "$PROJECT_ROOT/$bundle_dir" -name "*.exe" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" | while read -r file; do
            local file_size=$(du -sh "$file" | cut -f1)
            log "INFO" "安装包: $(basename "$file") ($file_size)"
        done
    fi
    
    log "SUCCESS" "构建产物验证完成"
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 创建必要的目录
    create_dir "$LOG_DIR"
    create_dir "$CACHE_DIR"
    
    # 显示构建信息
    log "INFO" "🐾 开始构建 $APP_NAME v$APP_VERSION"
    log "INFO" "构建环境: $BUILD_ENV"
    log "INFO" "项目路径: $PROJECT_ROOT"
    log "INFO" "日志文件: $LOG_FILE"
    
    # 执行构建步骤
    check_system_requirements
    check_project_structure
    check_frontend_deps
    check_rust_deps
    check_backend_api
    clean_build_cache
    setup_build_env
    run_type_check
    run_lint
    run_tests
    build_frontend
    build_tauri
    verify_build
    
    # 构建完成
    log "SUCCESS" "🎉 构建完成！"
    log "INFO" "构建产物位置:"
    log "INFO" "  前端: $PROJECT_ROOT/dist"
    log "INFO" "  Tauri: $PROJECT_ROOT/src-tauri/target/$([[ "$BUILD_ENV" == "dev" ]] && echo "debug" || echo "release")/bundle"
    
    # 显示安装包信息
    local bundle_dir="src-tauri/target/release/bundle"
    if [[ "$BUILD_ENV" == "dev" ]]; then
        bundle_dir="src-tauri/target/debug/bundle"
    fi
    
    if [[ -d "$PROJECT_ROOT/$bundle_dir" ]]; then
        log "INFO" "可用的安装包:"
        find "$PROJECT_ROOT/$bundle_dir" -name "*.exe" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" | while read -r file; do
            log "INFO" "  $(basename "$file")"
        done
    fi
    
    log "INFO" "详细日志: $LOG_FILE"
}

# 执行主函数
main "$@"

#!/bin/bash

# =============================================================================
# Zishu-sensei 桌面应用清理脚本
# =============================================================================
# 
# 功能特性：
# - 清理构建产物
# - 清理依赖缓存
# - 清理日志文件
# - 清理临时文件
# - 重置开发环境
# - 安全清理确认
#
# 使用方法：
#   ./scripts/clean.sh [选项]
#   
#   选项：
#     --all          - 清理所有文件
#     --build        - 清理构建产物
#     --cache        - 清理缓存文件
#     --logs         - 清理日志文件
#     --deps         - 清理依赖文件
#     --temp         - 清理临时文件
#     --force        - 跳过确认提示
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

# 清理配置
CLEAN_ALL=false
CLEAN_BUILD=false
CLEAN_CACHE=false
CLEAN_LOGS=false
CLEAN_DEPS=false
CLEAN_TEMP=false
FORCE_CLEAN=false
VERBOSE=false

# 清理目标
CLEAN_TARGETS=()

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
    local timestamp=$(date '+%H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp]${NC} $message"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp]${NC} $message"
            fi
            ;;
    esac
}

# 错误处理
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# 安全删除函数
safe_remove() {
    local target="$1"
    local description="$2"
    
    if [[ -e "$target" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            log "DEBUG" "删除: $target"
        fi
        
        if [[ -d "$target" ]]; then
            rm -rf "$target"
            log "INFO" "已删除目录: $description"
        else
            rm -f "$target"
            log "INFO" "已删除文件: $description"
        fi
    else
        log "DEBUG" "跳过不存在的目标: $target"
    fi
}

# 计算目录大小
get_dir_size() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        du -sh "$dir" 2>/dev/null | cut -f1 || echo "0B"
    else
        echo "0B"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
🐾 Zishu-sensei 桌面应用清理脚本

使用方法：
  $0 [选项]

选项：
  --all         清理所有文件
  --build       清理构建产物
  --cache       清理缓存文件
  --logs        清理日志文件
  --deps        清理依赖文件
  --temp        清理临时文件
  --force       跳过确认提示
  --verbose     详细输出
  --help        显示此帮助信息

示例：
  $0 --build              # 清理构建产物
  $0 --all --force        # 清理所有文件（跳过确认）
  $0 --cache --logs       # 清理缓存和日志

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                CLEAN_ALL=true
                shift
                ;;
            --build)
                CLEAN_BUILD=true
                shift
                ;;
            --cache)
                CLEAN_CACHE=true
                shift
                ;;
            --logs)
                CLEAN_LOGS=true
                shift
                ;;
            --deps)
                CLEAN_DEPS=true
                shift
                ;;
            --temp)
                CLEAN_TEMP=true
                shift
                ;;
            --force)
                FORCE_CLEAN=true
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
    
    # 如果没有指定任何选项，默认清理构建产物
    if [[ "$CLEAN_ALL" == "false" && "$CLEAN_BUILD" == "false" && "$CLEAN_CACHE" == "false" && "$CLEAN_LOGS" == "false" && "$CLEAN_DEPS" == "false" && "$CLEAN_TEMP" == "false" ]]; then
        CLEAN_BUILD=true
    fi
}

# =============================================================================
# 清理函数
# =============================================================================

# 清理构建产物
clean_build_artifacts() {
    log "INFO" "清理构建产物..."
    
    local build_targets=(
        "$PROJECT_ROOT/dist"
        "$PROJECT_ROOT/src-tauri/target"
        "$PROJECT_ROOT/packages"
        "$PROJECT_ROOT/releases"
    )
    
    local total_size=0
    
    for target in "${build_targets[@]}"; do
        if [[ -e "$target" ]]; then
            local size=$(get_dir_size "$target")
            log "INFO" "构建产物: $target ($size)"
            CLEAN_TARGETS+=("$target")
        fi
    done
    
    log "SUCCESS" "构建产物扫描完成"
}

# 清理缓存文件
clean_cache_files() {
    log "INFO" "清理缓存文件..."
    
    local cache_targets=(
        "$PROJECT_ROOT/.cache"
        "$PROJECT_ROOT/node_modules/.cache"
        "$PROJECT_ROOT/node_modules/.vite"
        "$PROJECT_ROOT/.vite"
        "$PROJECT_ROOT/.eslintcache"
        "$PROJECT_ROOT/.tsbuildinfo"
        "$PROJECT_ROOT/src-tauri/target/.rustc_info.json"
        "$PROJECT_ROOT/src-tauri/target/.cargo-lock"
    )
    
    # 系统缓存目录
    case "$(uname -s)" in
        Linux*)
            cache_targets+=(
                "$HOME/.cache/cargo"
                "$HOME/.cache/npm"
                "$HOME/.cache/yarn"
            )
            ;;
        Darwin*)
            cache_targets+=(
                "$HOME/Library/Caches/Cargo"
                "$HOME/Library/Caches/npm"
                "$HOME/Library/Caches/yarn"
            )
            ;;
        CYGWIN*|MINGW*|MSYS*)
            cache_targets+=(
                "$APPDATA/npm-cache"
                "$APPDATA/yarn-cache"
            )
            ;;
    esac
    
    local total_size=0
    
    for target in "${cache_targets[@]}"; do
        if [[ -e "$target" ]]; then
            local size=$(get_dir_size "$target")
            log "INFO" "缓存文件: $target ($size)"
            CLEAN_TARGETS+=("$target")
        fi
    done
    
    log "SUCCESS" "缓存文件扫描完成"
}

# 清理日志文件
clean_log_files() {
    log "INFO" "清理日志文件..."
    
    local log_targets=(
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/*.log"
        "$PROJECT_ROOT/src-tauri/target/debug/*.log"
        "$PROJECT_ROOT/src-tauri/target/release/*.log"
    )
    
    # 查找所有 .log 文件
    local log_files=($(find "$PROJECT_ROOT" -name "*.log" -type f 2>/dev/null || true))
    for log_file in "${log_files[@]}"; do
        CLEAN_TARGETS+=("$log_file")
    done
    
    # 查找日志目录
    for target in "${log_targets[@]}"; do
        if [[ -e "$target" ]]; then
            local size=$(get_dir_size "$target")
            log "INFO" "日志文件: $target ($size)"
            CLEAN_TARGETS+=("$target")
        fi
    done
    
    log "SUCCESS" "日志文件扫描完成"
}

# 清理依赖文件
clean_dependency_files() {
    log "INFO" "清理依赖文件..."
    
    local dep_targets=(
        "$PROJECT_ROOT/node_modules"
        "$PROJECT_ROOT/package-lock.json"
        "$PROJECT_ROOT/yarn.lock"
        "$PROJECT_ROOT/pnpm-lock.yaml"
        "$PROJECT_ROOT/src-tauri/Cargo.lock"
    )
    
    local total_size=0
    
    for target in "${dep_targets[@]}"; do
        if [[ -e "$target" ]]; then
            local size=$(get_dir_size "$target")
            log "INFO" "依赖文件: $target ($size)"
            CLEAN_TARGETS+=("$target")
        fi
    done
    
    log "SUCCESS" "依赖文件扫描完成"
}

# 清理临时文件
clean_temp_files() {
    log "INFO" "清理临时文件..."
    
    local temp_targets=(
        "$PROJECT_ROOT/.tmp"
        "$PROJECT_ROOT/tmp"
        "$PROJECT_ROOT/.dev-pid"
        "$PROJECT_ROOT/.env.local"
        "$PROJECT_ROOT/.env.development.local"
        "$PROJECT_ROOT/.env.test.local"
        "$PROJECT_ROOT/.env.production.local"
    )
    
    # 查找临时文件
    local temp_files=($(find "$PROJECT_ROOT" -name "*.tmp" -o -name "*.temp" -o -name ".DS_Store" -o -name "Thumbs.db" 2>/dev/null || true))
    for temp_file in "${temp_files[@]}"; do
        CLEAN_TARGETS+=("$temp_file")
    done
    
    for target in "${temp_targets[@]}"; do
        if [[ -e "$target" ]]; then
            local size=$(get_dir_size "$target")
            log "INFO" "临时文件: $target ($size)"
            CLEAN_TARGETS+=("$target")
        fi
    done
    
    log "SUCCESS" "临时文件扫描完成"
}

# =============================================================================
# 确认和清理
# =============================================================================

# 显示清理摘要
show_cleanup_summary() {
    log "INFO" "清理摘要:"
    
    local total_size=0
    local file_count=0
    
    for target in "${CLEAN_TARGETS[@]}"; do
        if [[ -e "$target" ]]; then
            file_count=$((file_count + 1))
            if [[ -d "$target" ]]; then
                local size=$(get_dir_size "$target")
                log "INFO" "  📁 $target ($size)"
            else
                log "INFO" "  📄 $target"
            fi
        fi
    done
    
    log "INFO" "总计: $file_count 个文件/目录"
    
    if [[ $file_count -eq 0 ]]; then
        log "SUCCESS" "没有需要清理的文件"
        exit 0
    fi
}

# 确认清理操作
confirm_cleanup() {
    if [[ "$FORCE_CLEAN" == "true" ]]; then
        return 0
    fi
    
    echo
    log "WARNING" "即将删除上述文件/目录，此操作不可恢复！"
    echo -n "是否继续？(y/N): "
    read -r response
    
    case "$response" in
        [yY]|[yY][eE][sS])
            return 0
            ;;
        *)
            log "INFO" "清理操作已取消"
            exit 0
            ;;
    esac
}

# 执行清理操作
execute_cleanup() {
    log "INFO" "开始清理..."
    
    local cleaned_count=0
    local failed_count=0
    
    for target in "${CLEAN_TARGETS[@]}"; do
        if [[ -e "$target" ]]; then
            if [[ -d "$target" ]]; then
                if rm -rf "$target" 2>/dev/null; then
                    cleaned_count=$((cleaned_count + 1))
                    log "SUCCESS" "已删除目录: $target"
                else
                    failed_count=$((failed_count + 1))
                    log "ERROR" "删除失败: $target"
                fi
            else
                if rm -f "$target" 2>/dev/null; then
                    cleaned_count=$((cleaned_count + 1))
                    log "SUCCESS" "已删除文件: $target"
                else
                    failed_count=$((failed_count + 1))
                    log "ERROR" "删除失败: $target"
                fi
            fi
        fi
    done
    
    log "INFO" "清理完成: $cleaned_count 成功, $failed_count 失败"
    
    if [[ $failed_count -gt 0 ]]; then
        log "WARNING" "部分文件删除失败，可能需要手动删除"
    fi
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 显示清理信息
    log "INFO" "🐾 开始清理 Zishu-sensei 项目"
    log "INFO" "项目路径: $PROJECT_ROOT"
    
    # 执行清理扫描
    if [[ "$CLEAN_ALL" == "true" ]]; then
        clean_build_artifacts
        clean_cache_files
        clean_log_files
        clean_dependency_files
        clean_temp_files
    else
        [[ "$CLEAN_BUILD" == "true" ]] && clean_build_artifacts
        [[ "$CLEAN_CACHE" == "true" ]] && clean_cache_files
        [[ "$CLEAN_LOGS" == "true" ]] && clean_log_files
        [[ "$CLEAN_DEPS" == "true" ]] && clean_dependency_files
        [[ "$CLEAN_TEMP" == "true" ]] && clean_temp_files
    fi
    
    # 显示摘要并确认
    show_cleanup_summary
    confirm_cleanup
    
    # 执行清理
    execute_cleanup
    
    log "SUCCESS" "🎉 清理完成！"
    log "INFO" "项目已重置为干净状态"
}

# 执行主函数
main "$@"

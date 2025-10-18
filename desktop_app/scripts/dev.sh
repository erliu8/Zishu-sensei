#!/bin/bash

# =============================================================================
# Zishu-sensei 桌面应用开发脚本
# =============================================================================
# 
# 功能特性：
# - 开发模式启动
# - 热重载支持
# - 调试模式
# - 后端API代理
# - 实时日志
# - 性能监控
#
# 使用方法：
#   ./scripts/dev.sh [选项]
#   
#   选项：
#     --debug        - 启用调试模式
#     --no-frontend  - 跳过前端启动
#     --no-backend   - 跳过后端启动
#     --port=端口     - 指定前端端口
#     --api-port=端口 - 指定API端口
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

# 开发配置
DEBUG_MODE=false
SKIP_FRONTEND=false
SKIP_BACKEND=false
FRONTEND_PORT=1424
API_PORT=8000
VERBOSE=false

# 进程管理
FRONTEND_PID=""
BACKEND_PID=""
TAURI_PID=""

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
    cleanup
    exit 1
}

# 清理函数
cleanup() {
    log "INFO" "清理进程..."
    
    # 杀死前端进程
    if [[ -n "$FRONTEND_PID" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        log "INFO" "前端进程已停止"
    fi
    
    # 杀死后端进程
    if [[ -n "$BACKEND_PID" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        log "INFO" "后端进程已停止"
    fi
    
    # 杀死 Tauri 进程
    if [[ -n "$TAURI_PID" ]]; then
        kill "$TAURI_PID" 2>/dev/null || true
        log "INFO" "Tauri 进程已停止"
    fi
    
    # 清理临时文件
    rm -f "$PROJECT_ROOT/.dev-pid"
}

# 信号处理
trap cleanup EXIT INT TERM

# 显示帮助信息
show_help() {
    cat << EOF
🐾 Zishu-sensei 桌面应用开发脚本

使用方法：
  $0 [选项]

选项：
  --debug          启用调试模式
  --no-frontend    跳过前端启动
  --no-backend     跳过后端启动
  --port=端口       指定前端端口 (默认: 1424)
  --api-port=端口   指定API端口 (默认: 8000)
  --verbose        详细输出
  --help           显示此帮助信息

示例：
  $0                           # 正常开发模式
  $0 --debug                   # 调试模式
  $0 --port=3000               # 指定前端端口
  $0 --no-backend              # 只启动前端

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --debug)
                DEBUG_MODE=true
                shift
                ;;
            --no-frontend)
                SKIP_FRONTEND=true
                shift
                ;;
            --no-backend)
                SKIP_BACKEND=true
                shift
                ;;
            --port=*)
                FRONTEND_PORT="${1#*=}"
                shift
                ;;
            --api-port=*)
                API_PORT="${1#*=}"
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

# 检查开发环境
check_development_environment() {
    log "INFO" "检查开发环境..."
    
    # 检查必需的命令
    local required_commands=("node" "npm" "cargo" "tauri")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "命令 '$cmd' 未找到，请先运行环境设置脚本"
        fi
    done
    
    # 检查项目依赖
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        log "WARNING" "前端依赖未安装，正在安装..."
        cd "$PROJECT_ROOT"
        npm install
    fi
    
    # 检查端口占用
    if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null; then
        log "WARNING" "端口 $FRONTEND_PORT 已被占用"
    fi
    
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null; then
        log "WARNING" "端口 $API_PORT 已被占用"
    fi
    
    log "SUCCESS" "开发环境检查通过"
}

# =============================================================================
# 服务启动
# =============================================================================

# 启动后端API服务
start_backend_service() {
    if [[ "$SKIP_BACKEND" == "true" ]]; then
        log "WARNING" "跳过后端服务启动"
        return
    fi
    
    log "INFO" "启动后端API服务 (端口: $API_PORT)..."
    
    # 检查后端服务是否已运行
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null; then
        log "INFO" "后端服务已在运行"
        return
    fi
    
    # 启动后端服务 (这里需要根据实际的后端服务进行调整)
    # 假设后端是一个 Python FastAPI 服务
    if [[ -f "$PROJECT_ROOT/../zishu/api/server.py" ]]; then
        cd "$PROJECT_ROOT/../zishu"
        python -m uvicorn api.server:app --host 0.0.0.0 --port $API_PORT --reload &
        BACKEND_PID=$!
        log "SUCCESS" "后端服务已启动 (PID: $BACKEND_PID)"
    else
        log "WARNING" "后端服务文件不存在，跳过启动"
    fi
}

# 启动前端开发服务器
start_frontend_server() {
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        log "WARNING" "跳过前端服务启动"
        return
    fi
    
    log "INFO" "启动前端开发服务器 (端口: $FRONTEND_PORT)..."
    
    cd "$PROJECT_ROOT"
    
    # 设置环境变量
    export VITE_API_BASE_URL="http://localhost:$API_PORT"
    export VITE_DEBUG="$DEBUG_MODE"
    export VITE_LOG_LEVEL="$([[ "$VERBOSE" == "true" ]] && echo "debug" || echo "info")"
    
    # 启动前端开发服务器
    npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 &
    FRONTEND_PID=$!
    
    log "SUCCESS" "前端开发服务器已启动 (PID: $FRONTEND_PID)"
}

# 启动 Tauri 应用
start_tauri_app() {
    log "INFO" "启动 Tauri 应用..."
    
    cd "$PROJECT_ROOT"
    
    # 设置环境变量
    export TAURI_DEBUG="$DEBUG_MODE"
    export TAURI_DEV_SERVER="http://localhost:$FRONTEND_PORT"
    
    # 等待前端服务器启动
    log "INFO" "等待前端服务器启动..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null; then
            break
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error_exit "前端服务器启动超时"
    fi
    
    # 启动 Tauri 应用
    npm run tauri:dev &
    TAURI_PID=$!
    
    log "SUCCESS" "Tauri 应用已启动 (PID: $TAURI_PID)"
}

# =============================================================================
# 监控和日志
# =============================================================================

# 监控服务状态
monitor_services() {
    log "INFO" "开始监控服务状态..."
    
    while true; do
        # 检查前端服务
        if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log "ERROR" "前端服务已停止"
            break
        fi
        
        # 检查后端服务
        if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            log "ERROR" "后端服务已停止"
            break
        fi
        
        # 检查 Tauri 应用
        if [[ -n "$TAURI_PID" ]] && ! kill -0 "$TAURI_PID" 2>/dev/null; then
            log "ERROR" "Tauri 应用已停止"
            break
        fi
        
        sleep 5
    done
}

# 显示服务信息
show_service_info() {
    log "INFO" "🐾 Zishu-sensei 开发环境已启动"
    log "INFO" "前端服务: http://localhost:$FRONTEND_PORT"
    log "INFO" "后端API: http://localhost:$API_PORT"
    log "INFO" "Tauri 应用: 已启动"
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        log "INFO" "调试模式: 已启用"
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        log "INFO" "详细日志: 已启用"
    fi
    
    log "INFO" "按 Ctrl+C 停止所有服务"
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 显示启动信息
    log "INFO" "🐾 启动 Zishu-sensei 开发环境"
    log "INFO" "前端端口: $FRONTEND_PORT"
    log "INFO" "API端口: $API_PORT"
    log "INFO" "调试模式: $([[ "$DEBUG_MODE" == "true" ]] && echo "启用" || echo "禁用")"
    
    # 执行启动步骤
    check_development_environment
    start_backend_service
    start_frontend_server
    start_tauri_app
    
    # 显示服务信息
    show_service_info
    
    # 开始监控
    monitor_services
}

# 执行主函数
main "$@"

#!/bin/bash

# =============================================================================
# Zishu-sensei 快速启动脚本 (国内优化版)
# 专为中国大陆网络环境优化的快速部署脚本
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✅ SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠️  WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[❌ ERROR]${NC} $1"
}

# 显示欢迎信息
show_banner() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "    🤖 Zishu-sensei AI 教学助手"
    echo "       快速启动脚本 (国内优化版)"
    echo "=============================================="
    echo -e "${NC}"
}

# 检测网络环境
detect_network() {
    log_info "检测网络环境..."
    
    if curl -s --connect-timeout 3 www.google.com > /dev/null 2>&1; then
        log_info "网络环境: 国际网络"
        export USE_CHINA_MIRROR=0
    else
        log_info "网络环境: 国内网络，将使用国内镜像源"
        export USE_CHINA_MIRROR=1
    fi
}

# 快速环境检查
quick_check() {
    log_info "快速环境检查..."
    
    # 检查Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3未安装！请先安装Python 3.8+"
        exit 1
    fi
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装！请先安装Docker"
        exit 1
    fi
    
    # 检查Docker服务
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行！请启动Docker服务"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 主函数
main() {
    show_banner
    detect_network
    quick_check
    
    log_info "开始快速部署..."
    
    # 设置环境变量
    export USE_CHINA_MIRROR=1
    
    # 调用主部署脚本
    if [ -f "./one-click-deploy.sh" ]; then
        log_info "调用主部署脚本..."
        chmod +x ./one-click-deploy.sh
        ./one-click-deploy.sh
    else
        log_error "未找到主部署脚本 one-click-deploy.sh"
        exit 1
    fi
}

# 参数处理
case "${1:-}" in
    --help|-h)
        echo "Zishu-sensei 快速启动脚本 (国内优化版)"
        echo ""
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  --help, -h      显示此帮助信息"
        echo "  --python-only   仅配置Python环境"
        echo "  --docker-only   仅配置Docker环境"
        echo ""
        echo "此脚本会自动:"
        echo "  ✅ 检测网络环境"
        echo "  ✅ 配置国内镜像源"
        echo "  ✅ 安装Python依赖"
        echo "  ✅ 拉取Docker镜像"
        echo "  ✅ 启动所有服务"
        echo ""
        exit 0
        ;;
    --python-only)
        show_banner
        detect_network
        export USE_CHINA_MIRROR=1
        if [ -f "./one-click-deploy.sh" ]; then
            chmod +x ./one-click-deploy.sh
            ./one-click-deploy.sh --python-only
        else
            log_error "未找到主部署脚本"
            exit 1
        fi
        ;;
    --docker-only)
        show_banner
        detect_network
        export USE_CHINA_MIRROR=1
        if [ -f "./one-click-deploy.sh" ]; then
            chmod +x ./one-click-deploy.sh
            ./one-click-deploy.sh --docker-only
        else
            log_error "未找到主部署脚本"
            exit 1
        fi
        ;;
    "")
        main
        ;;
    *)
        log_error "未知参数: $1"
        echo "使用 --help 查看帮助信息"
        exit 1
        ;;
esac

#!/bin/bash

# =============================================================================
# Zishu-sensei 一键部署脚本
# 自动检查依赖、配置环境、启动所有服务
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

# 项目配置
PROJECT_NAME="Zishu-sensei"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_TEMPLATE="$DOCKER_DIR/env.template"

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

log_step() {
    echo -e "${PURPLE}[🚀 STEP]${NC} $1"
}

# 显示欢迎信息
show_banner() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "    🤖 Zishu-sensei AI 教学助手"
    echo "         一键部署脚本 v1.0"
    echo "=============================================="
    echo -e "${NC}"
}

# 检查系统要求
check_system_requirements() {
    log_step "检查系统要求..."
    
    # 检查操作系统
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "操作系统: Linux ✅"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "操作系统: macOS ✅"
    else
        log_warning "未测试的操作系统: $OSTYPE"
    fi
    
    # 检查内存
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
        if [ "$TOTAL_MEM" -ge 4 ]; then
            log_info "内存: ${TOTAL_MEM}GB ✅"
        else
            log_warning "内存不足4GB，可能影响性能"
        fi
    fi
    
    # 检查磁盘空间
    AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -ge 10 ]; then
        log_info "磁盘空间: ${AVAILABLE_SPACE}GB 可用 ✅"
    else
        log_warning "磁盘空间不足10GB，建议清理空间"
    fi
}

# 检查并配置Python环境
setup_python_environment() {
    log_step "检查Python环境..."
    
    # 检查Python版本
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_info "Python版本: $PYTHON_VERSION ✅"
        
        # 检查版本是否满足要求 (>=3.8)
        if python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
            log_success "Python版本满足要求 (>=3.8)"
        else
            log_error "Python版本过低，需要3.8或更高版本"
            echo "请升级Python版本"
            exit 1
        fi
    else
        log_error "Python3未安装！"
        echo "请安装Python 3.8或更高版本"
        exit 1
    fi
    
    # 检查pip
    if command -v pip3 &> /dev/null; then
        PIP_VERSION=$(pip3 --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_info "pip版本: $PIP_VERSION ✅"
    else
        log_error "pip3未安装！"
        echo "请安装pip3"
        exit 1
    fi
    
    # 配置pip国内镜像源
    log_info "配置pip国内镜像源..."
    PIP_CONFIG_DIR="$HOME/.pip"
    PIP_CONFIG_FILE="$PIP_CONFIG_DIR/pip.conf"
    
    mkdir -p "$PIP_CONFIG_DIR"
    cat > "$PIP_CONFIG_FILE" << 'EOF'
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple/
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 120

[install]
trusted-host = pypi.tuna.tsinghua.edu.cn
EOF
    
    log_success "pip镜像源配置完成"
    
    # 检查虚拟环境
    if [ ! -d "venv" ]; then
        log_info "创建Python虚拟环境..."
        python3 -m venv venv
        log_success "虚拟环境创建完成"
    else
        log_info "虚拟环境已存在"
    fi
    
    # 激活虚拟环境并安装依赖
    log_info "激活虚拟环境并安装依赖..."
    source venv/bin/activate
    
    # 升级pip
    log_info "升级pip..."
    pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple/
    
    # 安装基础依赖
    if [ "${SKIP_PYTHON_DEPS:-}" != "1" ]; then
        if [ -f "requirements-prod.txt" ]; then
            log_info "安装生产环境依赖..."
            pip install -r requirements-prod.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/
        elif [ -f "requirements.txt" ]; then
            log_info "安装项目依赖..."
            pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/
        else
            log_warning "未找到requirements文件，跳过依赖安装"
        fi
    else
        log_info "跳过Python依赖安装 (SKIP_PYTHON_DEPS=1)"
    fi
    
    log_success "Python环境配置完成"
}

# 检查并安装Docker
check_docker() {
    log_step "检查Docker环境..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装！"
        echo "请访问 https://docs.docker.com/get-docker/ 安装Docker"
        echo "或运行以下命令自动安装："
        echo "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
        exit 1
    fi
    
    # 检查Docker版本
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log_info "Docker版本: $DOCKER_VERSION ✅"
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行！"
        echo "请启动Docker服务："
        echo "  Linux: sudo systemctl start docker"
        echo "  macOS: 启动Docker Desktop"
        exit 1
    fi
    
    # 检查Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short)
        log_info "Docker Compose版本: $COMPOSE_VERSION ✅"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_info "Docker Compose版本: $COMPOSE_VERSION ✅"
        log_warning "建议升级到Docker Compose V2"
    else
        log_error "Docker Compose未安装！"
        echo "请安装Docker Compose V2"
        exit 1
    fi
}

# 创建环境配置文件
setup_environment() {
    log_step "配置环境变量..."
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_TEMPLATE" ]; then
            log_info "从模板创建环境配置文件..."
            cp "$ENV_TEMPLATE" "$ENV_FILE"
            
            # 生成随机密码
            POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
            ZISHU_SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
            GRAFANA_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            
            # 替换模板中的占位符
            sed -i.bak \
                -e "s/your-secure-postgres-password/$POSTGRES_PASSWORD/g" \
                -e "s/your-redis-password/$REDIS_PASSWORD/g" \
                -e "s/your-jwt-secret-key/$JWT_SECRET/g" \
                -e "s/your-app-secret-key/$ZISHU_SECRET_KEY/g" \
                -e "s/your-grafana-admin-password/$GRAFANA_PASSWORD/g" \
                "$ENV_FILE" 2>/dev/null || {
                # 如果sed -i.bak失败，尝试不带备份的方式
                sed -i \
                    -e "s/your-secure-postgres-password/$POSTGRES_PASSWORD/g" \
                    -e "s/your-redis-password/$REDIS_PASSWORD/g" \
                    -e "s/your-jwt-secret-key/$JWT_SECRET/g" \
                    -e "s/your-app-secret-key/$ZISHU_SECRET_KEY/g" \
                    -e "s/your-grafana-admin-password/$GRAFANA_PASSWORD/g" \
                    "$ENV_FILE"
            }
            
            log_success "环境配置文件已创建: $ENV_FILE"
            log_info "已生成随机密码，请妥善保管"
        else
            log_error "环境模板文件不存在: $ENV_TEMPLATE"
            exit 1
        fi
    else
        log_info "环境配置文件已存在: $ENV_FILE"
    fi
}

# 创建必要的目录
create_directories() {
    log_step "创建数据目录..."
    
    # 数据目录
    mkdir -p data/{postgres,redis,qdrant,prometheus,grafana,loki}
    mkdir -p logs/{nginx,api}
    mkdir -p models
    mkdir -p cache
    mkdir -p config
    
    log_success "目录结构创建完成"
}

# 配置Docker镜像源
setup_docker_mirrors() {
    log_step "配置Docker镜像源..."
    
    # 检查是否强制使用国内镜像或检测网络环境
    if [ "${USE_CHINA_MIRROR:-}" = "1" ] || ! curl -s --connect-timeout 3 www.google.com > /dev/null 2>&1; then
        log_info "配置国内镜像源..."
        
        # 创建或更新Docker daemon配置
        DOCKER_CONFIG_DIR="/etc/docker"
        DOCKER_CONFIG_FILE="$DOCKER_CONFIG_DIR/daemon.json"
        
        if [ -w "$DOCKER_CONFIG_DIR" ] 2>/dev/null || [ "$(id -u)" -eq 0 ]; then
            log_info "配置Docker daemon镜像源..."
            
            # 备份原配置
            if [ -f "$DOCKER_CONFIG_FILE" ]; then
                cp "$DOCKER_CONFIG_FILE" "$DOCKER_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
            fi
            
            # 创建新配置
            cat > "$DOCKER_CONFIG_FILE" << EOF
{
    "registry-mirrors": [
        "https://docker.mirrors.ustc.edu.cn",
        "https://hub-mirror.c.163.com",
        "https://mirror.baidubce.com",
        "https://ccr.ccs.tencentyun.com"
    ],
    "insecure-registries": [],
    "debug": false,
    "experimental": false
}
EOF
            
            # 重启Docker服务
            if systemctl is-active docker &>/dev/null; then
                log_info "重启Docker服务以应用镜像源配置..."
                systemctl restart docker
                sleep 5
            fi
            
            log_success "Docker镜像源配置完成"
        else
            log_warning "无权限配置系统Docker镜像源，将使用用户级配置"
            # 用户级配置（如果支持）
            mkdir -p ~/.docker
            cat > ~/.docker/daemon.json << EOF
{
    "registry-mirrors": [
        "https://docker.mirrors.ustc.edu.cn",
        "https://hub-mirror.c.163.com"
    ]
}
EOF
        fi
        
        # 设置镜像前缀用于拉取
        DOCKER_REGISTRY="docker.mirrors.ustc.edu.cn/"
    else
        log_info "使用默认Docker Hub镜像源"
        DOCKER_REGISTRY=""
    fi
}

# 拉取Docker镜像
pull_images() {
    log_step "拉取Docker镜像..."
    
    log_info "这可能需要几分钟时间，请耐心等待..."
    
    # 核心服务镜像
    declare -A images=(
        ["postgres"]="postgres:15-alpine"
        ["redis"]="redis:7.2-alpine"
        ["qdrant"]="qdrant/qdrant:v1.7.0"
        ["nginx"]="nginx:1.25-alpine"
        ["prometheus"]="prom/prometheus:v2.48.0"
        ["grafana"]="grafana/grafana:10.2.0"
        ["loki"]="grafana/loki:2.9.0"
    )
    
    # 国内镜像替代方案
    declare -A china_mirrors=(
        ["postgres"]="registry.cn-hangzhou.aliyuncs.com/library/postgres:15-alpine"
        ["redis"]="registry.cn-hangzhou.aliyuncs.com/library/redis:7.2-alpine"
        ["nginx"]="registry.cn-hangzhou.aliyuncs.com/library/nginx:1.25-alpine"
        ["qdrant"]="registry.cn-hangzhou.aliyuncs.com/qdrant/qdrant:v1.7.0"
        ["prometheus"]="registry.cn-hangzhou.aliyuncs.com/prom/prometheus:v2.48.0"
        ["grafana"]="registry.cn-hangzhou.aliyuncs.com/grafana/grafana:10.2.0"
        ["loki"]="registry.cn-hangzhou.aliyuncs.com/grafana/loki:2.9.0"
    )
    
    for service in "${!images[@]}"; do
        image="${images[$service]}"
        china_image="${china_mirrors[$service]}"
        
        log_info "拉取镜像: $service"
        
        # 首先尝试国内镜像
        if [ -n "$china_image" ]; then
            log_info "  尝试国内镜像: $china_image"
            if docker pull "$china_image" 2>/dev/null; then
                # 重新标记为原始镜像名
                docker tag "$china_image" "$image"
                log_success "✅ $service (国内镜像)"
                continue
            fi
        fi
        
        # 尝试官方镜像
        log_info "  尝试官方镜像: $image"
        if docker pull "$image"; then
            log_success "✅ $service (官方镜像)"
        else
            log_warning "⚠️ 拉取失败: $service (将在启动时重试)"
        fi
    done
}

# 构建应用镜像
build_application() {
    log_step "构建应用镜像..."
    
    if [ -f "docker/Dockerfile.api" ]; then
        log_info "构建API服务镜像..."
        if docker build -f docker/Dockerfile.api -t zishu-api:latest .; then
            log_success "API镜像构建完成"
        else
            log_error "API镜像构建失败"
            exit 1
        fi
    else
        log_warning "API Dockerfile不存在，跳过构建"
    fi
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 首先启动基础服务
    log_info "启动基础服务 (PostgreSQL, Redis, Qdrant)..."
    docker compose up -d postgres redis qdrant
    
    # 等待数据库启动
    log_info "等待数据库启动..."
    sleep 15
    
    # 启动API服务
    log_info "启动API服务..."
    docker compose up -d zishu-api
    
    # 等待API服务启动
    sleep 10
    
    # 启动其他服务
    log_info "启动其他服务 (Nginx, 监控)..."
    docker compose up -d nginx prometheus grafana loki
    
    log_success "所有服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    log_step "等待服务就绪..."
    
    # 检查服务健康状态
    services=("postgres" "redis" "qdrant" "zishu-api" "nginx")
    
    for service in "${services[@]}"; do
        log_info "检查服务: $service"
        
        # 等待最多60秒
        for i in {1..12}; do
            if docker compose ps "$service" | grep -q "Up"; then
                log_success "✅ $service 已就绪"
                break
            else
                if [ $i -eq 12 ]; then
                    log_warning "⚠️ $service 启动超时"
                else
                    echo -n "."
                    sleep 5
                fi
            fi
        done
    done
}

# 显示服务信息
show_service_info() {
    log_step "服务信息"
    
    echo -e "${CYAN}=============================================="
    echo "🎉 部署完成！服务访问地址："
    echo "=============================================="
    echo -e "${NC}"
    
    echo -e "${GREEN}核心服务:${NC}"
    echo "  🤖 API服务:        http://localhost:8000"
    echo "  🌐 Web界面:        http://localhost:80"
    echo "  📊 健康检查:       http://localhost:8000/health"
    echo ""
    
    echo -e "${GREEN}数据库服务:${NC}"
    echo "  🐘 PostgreSQL:     localhost:5432"
    echo "  🔴 Redis:          localhost:6379"
    echo "  🔍 Qdrant:         http://localhost:6333"
    echo ""
    
    echo -e "${GREEN}监控服务:${NC}"
    echo "  📈 Grafana:        http://localhost:3000"
    echo "  📊 Prometheus:     http://localhost:9090"
    echo "  📝 Loki:           http://localhost:3100"
    echo ""
    
    echo -e "${YELLOW}默认账号信息:${NC}"
    echo "  Grafana: admin / (查看.env文件中的GRAFANA_PASSWORD)"
    echo ""
    
    echo -e "${BLUE}常用命令:${NC}"
    echo "  查看服务状态:      docker compose ps"
    echo "  查看服务日志:      docker compose logs -f"
    echo "  停止所有服务:      docker compose down"
    echo "  重启服务:          docker compose restart"
    echo "  查看API日志:       docker compose logs -f zishu-api"
    echo ""
    
    echo -e "${PURPLE}配置文件位置:${NC}"
    echo "  环境变量:          .env"
    echo "  Docker配置:       docker-compose.yml"
    echo "  数据目录:          ./data/"
    echo "  日志目录:          ./logs/"
    echo ""
}

# 健康检查
health_check() {
    log_step "执行健康检查..."
    
    # 检查API服务
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        log_success "✅ API服务健康检查通过"
    else
        log_warning "⚠️ API服务健康检查失败，可能还在启动中"
    fi
    
    # 检查数据库连接
    if docker compose exec -T postgres pg_isready -U zishu > /dev/null 2>&1; then
        log_success "✅ PostgreSQL连接正常"
    else
        log_warning "⚠️ PostgreSQL连接检查失败"
    fi
    
    # 检查Redis连接
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "✅ Redis连接正常"
    else
        log_warning "⚠️ Redis连接检查失败"
    fi
}

# 清理函数
cleanup_on_error() {
    log_error "部署过程中发生错误，正在清理..."
    docker compose down 2>/dev/null || true
    exit 1
}

# 主函数
main() {
    # 设置错误处理
    trap cleanup_on_error ERR
    
    # 显示欢迎信息
    show_banner
    
    # 执行部署步骤
    check_system_requirements
    setup_python_environment
    check_docker
    setup_docker_mirrors
    setup_environment
    create_directories
    pull_images
    build_application
    start_services
    wait_for_services
    health_check
    show_service_info
    
    log_success "🎉 Zishu-sensei 部署完成！"
    echo ""
    echo -e "${CYAN}感谢使用 Zishu-sensei AI 教学助手！${NC}"
    echo -e "${CYAN}如有问题，请查看日志或联系技术支持。${NC}"
}

# 检查是否以root权限运行（在某些情况下需要）
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "正在以root权限运行，请确保这是必要的"
    fi
}

# 参数处理
case "${1:-}" in
    --help|-h)
        echo "Zishu-sensei 一键部署脚本"
        echo ""
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  --help, -h          显示此帮助信息"
        echo "  --clean             清理所有容器和数据"
        echo "  --restart           重启所有服务"
        echo "  --status            显示服务状态"
        echo "  --logs              显示服务日志"
        echo "  --python-only       仅配置Python环境"
        echo "  --docker-only       仅配置Docker环境"
        echo "  --skip-python       跳过Python环境配置"
        echo "  --skip-docker       跳过Docker环境配置"
        echo ""
        echo "环境变量:"
        echo "  SKIP_PYTHON_DEPS=1  跳过Python依赖安装"
        echo "  USE_CHINA_MIRROR=1   强制使用国内镜像源"
        echo "  PYTHON_VERSION=3.x   指定Python版本"
        echo ""
        exit 0
        ;;
    --clean)
        log_info "清理所有容器和数据..."
        docker compose down -v --remove-orphans
        docker system prune -f
        rm -rf data/ logs/
        log_success "清理完成"
        exit 0
        ;;
    --restart)
        log_info "重启所有服务..."
        docker compose restart
        log_success "服务重启完成"
        exit 0
        ;;
    --status)
        docker compose ps
        exit 0
        ;;
    --logs)
        docker compose logs -f
        exit 0
        ;;
    --python-only)
        log_info "仅配置Python环境..."
        check_permissions
        show_banner
        check_system_requirements
        setup_python_environment
        log_success "Python环境配置完成！"
        exit 0
        ;;
    --docker-only)
        log_info "仅配置Docker环境..."
        check_permissions
        show_banner
        check_system_requirements
        check_docker
        setup_docker_mirrors
        log_success "Docker环境配置完成！"
        exit 0
        ;;
    --skip-python)
        log_info "跳过Python环境配置，开始Docker部署..."
        check_permissions
        show_banner
        check_system_requirements
        check_docker
        setup_docker_mirrors
        setup_environment
        create_directories
        pull_images
        build_application
        start_services
        wait_for_services
        health_check
        show_service_info
        log_success "🎉 Zishu-sensei 部署完成！"
        exit 0
        ;;
    --skip-docker)
        log_info "跳过Docker部署，仅配置Python环境..."
        check_permissions
        show_banner
        check_system_requirements
        setup_python_environment
        log_success "Python环境配置完成！"
        log_info "请手动启动Docker服务"
        exit 0
        ;;
    "")
        # 默认执行部署
        check_permissions
        main
        ;;
    *)
        log_error "未知参数: $1"
        echo "使用 --help 查看帮助信息"
        exit 1
        ;;
esac

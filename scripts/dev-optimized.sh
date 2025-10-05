#!/bin/bash

# Zishu-sensei 优化开发环境启动脚本
# 使用最新的 Docker Compose v2 功能

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 项目配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"

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

log_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# 检查 Docker Compose 版本
check_docker_compose() {
    log_info "检查 Docker Compose 版本..."
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    VERSION=$(docker-compose --version | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | sed 's/v//')
    MAJOR=$(echo $VERSION | cut -d. -f1)
    MINOR=$(echo $VERSION | cut -d. -f2)
    
    if [ "$MAJOR" -lt 2 ] || ([ "$MAJOR" -eq 2 ] && [ "$MINOR" -lt 20 ]); then
        log_warning "建议使用 Docker Compose v2.20+ 以获得最佳性能"
    else
        log_success "Docker Compose 版本: v$VERSION ✓"
    fi
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    mkdir -p "$PROJECT_ROOT"/{data,logs,cache,notebooks}
    mkdir -p "$PROJECT_ROOT/data"/{postgres,redis,qdrant,uploads}
    log_success "目录创建完成"
}

# 设置权限
set_permissions() {
    log_info "设置目录权限..."
    chmod -R 755 "$PROJECT_ROOT"/{data,logs,cache,notebooks}
    log_success "权限设置完成"
}

# 优化系统设置
optimize_system() {
    log_info "优化系统设置..."
    
    # 增加文件监控限制（用于热重载）
    if [ -f /proc/sys/fs/inotify/max_user_watches ]; then
        current_limit=$(cat /proc/sys/fs/inotify/max_user_watches)
        if [ "$current_limit" -lt 524288 ]; then
            log_info "增加 inotify 监控限制..."
            echo 524288 > /proc/sys/fs/inotify/max_user_watches 2>/dev/null || log_warning "无法设置 inotify 限制（需要 root 权限）"
            log_success "inotify 限制已优化"
        fi
    fi
    
    # 优化 Docker 设置
    log_info "检查 Docker 配置..."
    if [ -f /etc/docker/daemon.json ]; then
        log_info "Docker daemon.json 已存在"
    else
        log_info "创建优化的 Docker 配置..."
        mkdir -p /etc/docker 2>/dev/null || true
        tee /etc/docker/daemon.json > /dev/null 2>&1 << EOF || log_warning "无法创建 Docker 配置（需要权限）"
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-address-pools": [
    {
      "base": "172.17.0.0/12",
      "size": 20
    },
    {
      "base": "192.168.0.0/16",
      "size": 24
    }
  ]
}
EOF
        systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || log_warning "无法重启 Docker 服务"
        log_success "Docker 配置已优化"
    fi
}

# 启动开发环境
start_dev_environment() {
    log_header "启动 Zishu-sensei 开发环境"
    
    cd "$DOCKER_DIR"
    
    log_info "拉取最新镜像..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml pull --quiet
    
    log_info "构建开发镜像..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel
    
    log_info "启动服务..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    
    log_success "开发环境启动完成！"
}

# 显示服务状态
show_services() {
    log_header "服务状态"
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
}

# 显示访问信息
show_access_info() {
    log_header "开发环境访问信息"
    echo -e "${GREEN}🚀 API 服务:${NC}        http://localhost:8000"
    echo -e "${GREEN}📊 API 文档:${NC}        http://localhost:8000/docs"
    echo -e "${GREEN}📓 Jupyter Lab:${NC}     http://localhost:8888 (token: dev-token)"
    echo -e "${GREEN}🗄️  pgAdmin:${NC}         http://localhost:5050 (admin@zishu.dev / admin)"
    echo -e "${GREEN}🔴 Redis Commander:${NC}  http://localhost:8081"
    echo -e "${GREEN}📧 MailHog:${NC}          http://localhost:8025"
    echo -e "${GREEN}📈 健康检查:${NC}        http://localhost:8000/health"
    echo ""
    echo -e "${BLUE}💡 提示:${NC}"
    echo -e "  • 使用 ${YELLOW}docker-compose logs -f [service]${NC} 查看日志"
    echo -e "  • 使用 ${YELLOW}docker-compose exec api bash${NC} 进入 API 容器"
    echo -e "  • 代码更改会自动重载（热重载已启用）"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    sleep 10  # 等待服务启动
    
    services=("api:8000/health" "jupyter:8888" "pgadmin:5050" "redis-commander:8081")
    
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d: -f1)
        endpoint=$(echo $service | cut -d: -f2)
        
        if curl -s "http://localhost:$endpoint" > /dev/null; then
            log_success "$name 服务运行正常 ✓"
        else
            log_warning "$name 服务可能需要更多时间启动"
        fi
    done
}

# 主函数
main() {
    log_header "Zishu-sensei 优化开发环境"
    
    check_docker_compose
    create_directories
    set_permissions
    optimize_system
    start_dev_environment
    show_services
    health_check
    show_access_info
    
    log_success "开发环境已完全启动并优化！"
    log_info "使用 Ctrl+C 停止服务，或运行 'docker-compose down' 停止所有容器"
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

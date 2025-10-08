#!/bin/bash

# Zishu-sensei Docker开发环境管理脚本
# 提供完整的Docker开发环境管理功能

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
ENV_FILE="$PROJECT_ROOT/.env.dev"

# 日志函数
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

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    mkdir -p "$PROJECT_ROOT"/{data,logs,cache,notebooks,models,training}
    mkdir -p "$PROJECT_ROOT/data"/{postgres,redis,qdrant}
    mkdir -p "$PROJECT_ROOT/docker/postgres"
    mkdir -p "$PROJECT_ROOT/docker/jupyter"
    
    log_success "目录创建完成"
}

# 创建环境配置文件
create_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_info "创建开发环境配置文件..."
        
        cat > "$ENV_FILE" << 'EOF'
# Zishu-sensei 开发环境配置

# 应用配置
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# 数据库配置
POSTGRES_DB=zishu_dev
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123
DATABASE_URL=postgresql://zishu:zishu123@postgres-dev:5432/zishu_dev

# Redis配置
REDIS_PASSWORD=zishu123
REDIS_URL=redis://:zishu123@redis-dev:6379/0

# Qdrant配置
QDRANT_URL=http://qdrant-dev:6333

# API配置
API_HOST=0.0.0.0
API_PORT=8000
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production

# 模型配置
MODEL_PATH=/app/models
CACHE_DIR=/app/cache

# 开发工具配置
JUPYTER_TOKEN=dev-token
PGADMIN_EMAIL=admin@zishu.dev
PGADMIN_PASSWORD=admin

# 邮件测试配置
SMTP_HOST=mailhog-dev
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EOF
        
        log_success "环境配置文件已创建: $ENV_FILE"
    else
        log_info "环境配置文件已存在: $ENV_FILE"
    fi
}

# 创建数据库初始化脚本
create_db_init() {
    local init_file="$PROJECT_ROOT/docker/postgres/01-init-db.sql"
    
    if [ ! -f "$init_file" ]; then
        log_info "创建数据库初始化脚本..."
        
        cat > "$init_file" << 'EOF'
-- Zishu-sensei 数据库初始化脚本

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 创建开发用户（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'zishu_dev') THEN
        CREATE ROLE zishu_dev WITH LOGIN PASSWORD 'zishu123';
    END IF;
END
$$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE zishu_dev TO zishu_dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zishu_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zishu_dev;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zishu_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zishu_dev;
EOF
        
        log_success "数据库初始化脚本已创建"
    fi
}

# 创建Jupyter配置
create_jupyter_config() {
    local config_file="$PROJECT_ROOT/docker/jupyter/jupyter_lab_config.py"
    
    if [ ! -f "$config_file" ]; then
        log_info "创建Jupyter Lab配置..."
        
        cat > "$config_file" << 'EOF'
# Jupyter Lab 开发环境配置

c = get_config()

# 基本配置
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.allow_root = True
c.ServerApp.token = 'dev-token'
c.ServerApp.password = ''

# 允许所有来源
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_remote_access = True

# 工作目录
c.ServerApp.root_dir = '/app/workspace'

# 启用扩展
c.ServerApp.jpserver_extensions = {
    'jupyterlab': True,
    'jupyterlab_git': True,
}

# 内核配置
c.MappingKernelManager.default_kernel_name = 'python3'

# 文件管理
c.ContentsManager.allow_hidden = True
c.ContentsManager.hide_globs = ['__pycache__', '*.pyc', '*.pyo', '.DS_Store', '*.so', '*.dylib']

# 日志配置
c.Application.log_level = 'INFO'
EOF
        
        log_success "Jupyter Lab配置已创建"
    fi
}

# 构建镜像
build_images() {
    log_info "构建开发环境镜像..."
    
    cd "$PROJECT_ROOT"
    
    # 构建API镜像
    log_info "构建API镜像..."
    docker-compose -f "$COMPOSE_FILE" build zishu-api-dev
    
    # 构建Jupyter镜像
    log_info "构建Jupyter镜像..."
    docker-compose -f "$COMPOSE_FILE" build jupyter-dev
    
    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动开发环境服务..."
    
    cd "$PROJECT_ROOT"
    
    # 启动基础服务
    log_info "启动数据库和缓存服务..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres-dev redis-dev qdrant-dev
    
    # 等待数据库就绪
    log_info "等待数据库启动..."
    sleep 10
    
    # 启动API服务
    log_info "启动API服务..."
    docker-compose -f "$COMPOSE_FILE" up -d zishu-api-dev
    
    log_success "核心服务启动完成"
}

# 启动开发工具
start_dev_tools() {
    log_info "启动开发工具..."
    
    cd "$PROJECT_ROOT"
    
    # 启动Jupyter Lab
    docker-compose -f "$COMPOSE_FILE" up -d jupyter-dev
    
    # 启动pgAdmin
    docker-compose -f "$COMPOSE_FILE" up -d pgadmin-dev
    
    # 启动Redis Commander
    docker-compose -f "$COMPOSE_FILE" up -d redis-commander-dev
    
    # 启动MailHog
    docker-compose -f "$COMPOSE_FILE" up -d mailhog-dev
    
    log_success "开发工具启动完成"
}

# 停止服务
stop_services() {
    log_info "停止开发环境服务..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    
    log_success "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启开发环境服务..."
    stop_services
    sleep 2
    start_services
    log_success "服务重启完成"
}

# 显示服务状态
show_status() {
    log_header "开发环境服务状态"
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" ps
}

# 显示日志
show_logs() {
    local service=$1
    
    cd "$PROJECT_ROOT"
    
    if [ -n "$service" ]; then
        log_info "显示服务日志: $service"
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        log_info "显示所有服务日志"
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# 进入容器
enter_container() {
    local service=$1
    
    if [ -z "$service" ]; then
        log_error "请指定服务名称"
        echo "可用服务: zishu-api-dev, postgres-dev, redis-dev, jupyter-dev"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    case "$service" in
        api|zishu-api-dev)
            docker-compose -f "$COMPOSE_FILE" exec zishu-api-dev bash
            ;;
        db|postgres|postgres-dev)
            docker-compose -f "$COMPOSE_FILE" exec postgres-dev psql -U zishu -d zishu_dev
            ;;
        redis|redis-dev)
            docker-compose -f "$COMPOSE_FILE" exec redis-dev redis-cli -a zishu123
            ;;
        jupyter|jupyter-dev)
            docker-compose -f "$COMPOSE_FILE" exec jupyter-dev bash
            ;;
        *)
            log_error "未知服务: $service"
            exit 1
            ;;
    esac
}

# 清理资源
cleanup() {
    log_info "清理开发环境资源..."
    
    cd "$PROJECT_ROOT"
    
    # 停止并删除容器
    docker-compose -f "$COMPOSE_FILE" down -v
    
    # 删除未使用的镜像
    docker image prune -f
    
    # 删除未使用的卷
    docker volume prune -f
    
    log_success "清理完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local services=(
        "API:http://localhost:8000/health"
        "Jupyter:http://localhost:8888"
        "pgAdmin:http://localhost:5050"
        "Redis Commander:http://localhost:8081"
        "MailHog:http://localhost:8025"
    )
    
    for service_info in "${services[@]}"; do
        local name=$(echo "$service_info" | cut -d: -f1)
        local url=$(echo "$service_info" | cut -d: -f2-)
        
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "$name 服务运行正常 ✓"
        else
            log_warning "$name 服务无响应或未启动"
        fi
    done
}

# 显示访问信息
show_access_info() {
    log_header "开发环境访问信息"
    
    echo -e "${GREEN}🚀 核心服务${NC}"
    echo -e "  API服务:           ${CYAN}http://localhost:8000${NC}"
    echo -e "  API文档:           ${CYAN}http://localhost:8000/docs${NC}"
    echo -e "  健康检查:          ${CYAN}http://localhost:8000/health${NC}"
    echo ""
    echo -e "${GREEN}🛠️  开发工具${NC}"
    echo -e "  Jupyter Lab:       ${CYAN}http://localhost:8888${NC} (token: dev-token)"
    echo -e "  pgAdmin:           ${CYAN}http://localhost:5050${NC} (admin@zishu.dev / admin)"
    echo -e "  Redis Commander:   ${CYAN}http://localhost:8081${NC}"
    echo -e "  MailHog:           ${CYAN}http://localhost:8025${NC}"
    echo ""
    echo -e "${GREEN}📊 数据库连接${NC}"
    echo -e "  PostgreSQL:        ${CYAN}localhost:5432${NC} (zishu / zishu123)"
    echo -e "  Redis:             ${CYAN}localhost:6379${NC} (password: zishu123)"
    echo -e "  Qdrant:            ${CYAN}http://localhost:6333${NC}"
    echo ""
    echo -e "${BLUE}💡 常用命令${NC}"
    echo -e "  查看日志:          ${YELLOW}$0 logs [service]${NC}"
    echo -e "  进入容器:          ${YELLOW}$0 shell [service]${NC}"
    echo -e "  重启服务:          ${YELLOW}$0 restart${NC}"
    echo -e "  健康检查:          ${YELLOW}$0 health${NC}"
}

# 显示帮助信息
show_help() {
    echo "Zishu-sensei Docker开发环境管理脚本"
    echo ""
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "环境管理:"
    echo "  setup              初始化开发环境"
    echo "  start              启动核心服务"
    echo "  start-tools        启动开发工具"
    echo "  start-all          启动所有服务"
    echo "  stop               停止所有服务"
    echo "  restart            重启所有服务"
    echo ""
    echo "服务管理:"
    echo "  status             显示服务状态"
    echo "  logs [service]     显示日志"
    echo "  shell <service>    进入容器"
    echo "  health             健康检查"
    echo ""
    echo "开发工具:"
    echo "  build              构建镜像"
    echo "  cleanup            清理资源"
    echo "  info               显示访问信息"
    echo ""
    echo "可用服务名称:"
    echo "  api, db, redis, jupyter"
    echo ""
    echo "示例:"
    echo "  $0 setup           # 初始化环境"
    echo "  $0 start-all       # 启动所有服务"
    echo "  $0 logs api        # 查看API日志"
    echo "  $0 shell db        # 进入数据库"
}

# 主函数
main() {
    case "${1:-}" in
        setup)
            log_header "初始化Zishu-sensei开发环境"
            check_dependencies
            create_directories
            create_env_file
            create_db_init
            create_jupyter_config
            build_images
            log_success "开发环境初始化完成！"
            echo ""
            log_info "下一步："
            echo "  1. 运行 '$0 start-all' 启动所有服务"
            echo "  2. 运行 '$0 info' 查看访问信息"
            ;;
        start)
            start_services
            show_access_info
            ;;
        start-tools)
            start_dev_tools
            ;;
        start-all)
            start_services
            start_dev_tools
            show_access_info
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        shell)
            enter_container "$2"
            ;;
        build)
            build_images
            ;;
        cleanup)
            cleanup
            ;;
        health)
            health_check
            ;;
        info)
            show_access_info
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: ${1:-}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"

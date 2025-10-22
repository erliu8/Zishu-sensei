#!/bin/bash
# 数据库设置脚本

set -e

echo "================================"
echo "  数据库迁移设置脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# 函数：打印成功消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函数：打印错误消息
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 函数：打印信息消息
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 函数：打印警告消息
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 检查 Docker 是否运行
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        exit 1
    fi
    
    if ! docker ps &> /dev/null; then
        print_error "Docker 未运行"
        exit 1
    fi
    
    print_success "Docker 已就绪"
}

# 启动数据库服务
start_database() {
    print_info "启动 PostgreSQL 数据库..."
    docker-compose up -d postgres
    
    print_info "等待数据库启动（10秒）..."
    sleep 10
    
    print_success "PostgreSQL 已启动"
}

# 检查数据库连接
check_database_connection() {
    print_info "检查数据库连接..."
    
    # 从环境变量或默认值获取数据库配置
    POSTGRES_HOST=${POSTGRES_HOST:-localhost}
    POSTGRES_PORT=${POSTGRES_PORT:-5432}
    POSTGRES_USER=${POSTGRES_USER:-zishu}
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-zishu123}
    POSTGRES_DB=${POSTGRES_DB:-zishu_community}
    
    # 使用 Docker 容器测试连接
    if docker-compose exec -T postgres pg_isready -h localhost -U $POSTGRES_USER &> /dev/null; then
        print_success "数据库连接成功"
        return 0
    else
        print_warning "数据库连接失败，继续等待..."
        return 1
    fi
}

# 创建初始迁移
create_initial_migration() {
    print_info "创建初始迁移..."
    
    if ls alembic/versions/*.py &> /dev/null; then
        print_warning "迁移文件已存在，跳过创建"
    else
        python scripts/migrate.py init "Initial migration - Create all tables"
        print_success "初始迁移已创建"
    fi
}

# 应用迁移
apply_migrations() {
    print_info "应用数据库迁移..."
    python scripts/migrate.py upgrade
    print_success "迁移应用成功"
}

# 显示当前版本
show_version() {
    print_info "当前数据库版本:"
    alembic current
}

# 主流程
main() {
    echo ""
    print_info "开始数据库设置流程..."
    echo ""
    
    # 1. 检查 Docker
    check_docker
    echo ""
    
    # 2. 启动数据库
    start_database
    echo ""
    
    # 3. 等待数据库就绪
    max_retries=30
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if check_database_connection; then
            break
        fi
        retry_count=$((retry_count + 1))
        sleep 2
    done
    
    if [ $retry_count -eq $max_retries ]; then
        print_error "数据库连接超时"
        exit 1
    fi
    echo ""
    
    # 4. 创建初始迁移
    create_initial_migration
    echo ""
    
    # 5. 应用迁移
    apply_migrations
    echo ""
    
    # 6. 显示版本
    show_version
    echo ""
    
    print_success "数据库设置完成！"
    echo ""
    print_info "下一步："
    echo "  - 运行 'make dev' 启动应用"
    echo "  - 访问 http://localhost:8000/docs 查看 API 文档"
    echo ""
}

# 执行主流程
main


#!/bin/bash

###############################################################################
# Zishu-Sensei 云硬盘配置脚本
# 
# 功能：
# 1. 检查云硬盘挂载状态
# 2. 创建必要的数据目录
# 3. 设置正确的权限
# 4. 迁移现有数据（如果需要）
#
# 使用方法：
#   sudo ./scripts/setup_cloud_storage.sh [云硬盘路径]
#
# 示例：
#   sudo ./scripts/setup_cloud_storage.sh /data/disk/zishu-sensei
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查是否以root权限运行
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 获取云硬盘路径
get_cloud_path() {
    if [ -n "$1" ]; then
        CLOUD_PATH="$1"
    else
        CLOUD_PATH="/data/disk/zishu-sensei"
    fi
    
    log_info "云硬盘路径: $CLOUD_PATH"
}

# 检查云硬盘挂载
check_mount() {
    log_info "检查云硬盘挂载状态..."
    
    # 检查路径是否存在
    if [ ! -d "$CLOUD_PATH" ]; then
        log_error "云硬盘路径不存在: $CLOUD_PATH"
        log_info "请先挂载云硬盘，然后重新运行此脚本"
        exit 1
    fi
    
    # 检查是否为挂载点
    if mountpoint -q "$CLOUD_PATH"; then
        log_success "云硬盘已正确挂载"
        df -h "$CLOUD_PATH" | tail -1
    else
        log_warning "警告: $CLOUD_PATH 不是挂载点"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # 检查可用空间
    AVAILABLE=$(df "$CLOUD_PATH" | tail -1 | awk '{print $4}')
    AVAILABLE_GB=$((AVAILABLE / 1024 / 1024))
    
    if [ $AVAILABLE_GB -lt 10 ]; then
        log_warning "可用空间不足10GB: ${AVAILABLE_GB}GB"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "可用空间: ${AVAILABLE_GB}GB"
    fi
}

# 创建数据目录
create_directories() {
    log_info "创建数据目录..."
    
    # 主要目录
    local dirs=(
        "data"
        "data/qdrant"
        "data/postgres"
        "data/redis"
        "data/prometheus"
        "data/grafana"
        "data/loki"
        "models"
        "logs"
        "backup"
    )
    
    for dir in "${dirs[@]}"; do
        local full_path="$CLOUD_PATH/$dir"
        if [ ! -d "$full_path" ]; then
            mkdir -p "$full_path"
            log_success "创建目录: $full_path"
        else
            log_info "目录已存在: $full_path"
        fi
    done
}

# 设置权限
set_permissions() {
    log_info "设置目录权限..."
    
    # 获取执行脚本的真实用户（即使使用sudo）
    if [ -n "$SUDO_USER" ]; then
        REAL_USER="$SUDO_USER"
    else
        REAL_USER=$(whoami)
    fi
    
    log_info "设置所有者为: $REAL_USER"
    
    # 设置基本权限
    chown -R "$REAL_USER:$REAL_USER" "$CLOUD_PATH"
    chmod -R 755 "$CLOUD_PATH"
    
    # 特殊权限设置
    if [ -d "$CLOUD_PATH/data/postgres" ]; then
        chmod 700 "$CLOUD_PATH/data/postgres"
        log_info "PostgreSQL目录权限: 700"
    fi
    
    if [ -d "$CLOUD_PATH/data/redis" ]; then
        chmod 700 "$CLOUD_PATH/data/redis"
        log_info "Redis目录权限: 700"
    fi
    
    log_success "权限设置完成"
}

# 迁移现有数据
migrate_data() {
    log_info "检查是否需要迁移数据..."
    
    local project_root="/opt/zishu-sensei"
    local local_data="$project_root/data"
    
    # 检查本地data目录
    if [ ! -d "$local_data" ]; then
        log_info "未发现本地数据目录，跳过迁移"
        return
    fi
    
    # 统计本地数据大小
    local size=$(du -sh "$local_data" | cut -f1)
    log_info "发现本地数据目录: $local_data (大小: $size)"
    
    read -p "是否迁移现有数据到云硬盘? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "开始迁移数据..."
        
        # 停止Docker服务
        if [ -f "$project_root/docker-compose.yml" ]; then
            log_info "停止Docker服务..."
            cd "$project_root"
            docker-compose down
        fi
        
        # 复制数据
        log_info "复制数据文件..."
        rsync -av --progress "$local_data/" "$CLOUD_PATH/data/"
        
        # 备份原数据
        log_info "备份原数据目录..."
        mv "$local_data" "${local_data}.backup.$(date +%Y%m%d_%H%M%S)"
        
        log_success "数据迁移完成"
    else
        log_info "跳过数据迁移"
    fi
}

# 更新环境变量
update_env() {
    log_info "更新环境变量配置..."
    
    local project_root="/opt/zishu-sensei"
    local env_file="$project_root/.env"
    
    # 检查.env文件
    if [ ! -f "$env_file" ]; then
        log_info "创建.env文件..."
        cat > "$env_file" <<EOF
# 云硬盘路径配置
CLOUD_DATA_PATH=$CLOUD_PATH

# 数据库配置
POSTGRES_PASSWORD=change_me_in_production
DATABASE_URL=postgresql://zishu:change_me_in_production@postgres:5432/zishu

# Redis配置
REDIS_PASSWORD=change_me_in_production
REDIS_URL=redis://:change_me_in_production@redis:6379/0

# Qdrant配置
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

# OpenAI配置
OPENAI_API_KEY=

# Grafana配置
GRAFANA_PASSWORD=admin123

# 日志级别
ZISHU_LOG_LEVEL=INFO
EOF
        chown "$REAL_USER:$REAL_USER" "$env_file"
        log_success "已创建.env文件"
        log_warning "请编辑 $env_file 设置正确的密码和API密钥"
    else
        # 更新CLOUD_DATA_PATH
        if grep -q "^CLOUD_DATA_PATH=" "$env_file"; then
            sed -i "s|^CLOUD_DATA_PATH=.*|CLOUD_DATA_PATH=$CLOUD_PATH|" "$env_file"
            log_success "已更新CLOUD_DATA_PATH"
        else
            echo "CLOUD_DATA_PATH=$CLOUD_PATH" >> "$env_file"
            log_success "已添加CLOUD_DATA_PATH"
        fi
    fi
}

# 创建符号链接
create_symlinks() {
    log_info "创建符号链接..."
    
    local project_root="/opt/zishu-sensei"
    
    # 如果本地data目录不存在，创建指向云硬盘的符号链接
    if [ ! -d "$project_root/data" ] && [ ! -L "$project_root/data" ]; then
        ln -s "$CLOUD_PATH/data" "$project_root/data"
        log_success "创建符号链接: $project_root/data -> $CLOUD_PATH/data"
    fi
    
    # 同样处理logs和models
    if [ ! -d "$project_root/logs" ] && [ ! -L "$project_root/logs" ]; then
        ln -s "$CLOUD_PATH/logs" "$project_root/logs"
        log_success "创建符号链接: $project_root/logs -> $CLOUD_PATH/logs"
    fi
}

# 验证配置
verify_setup() {
    log_info "验证配置..."
    
    echo
    echo "======================================"
    echo "目录结构:"
    echo "======================================"
    tree -L 2 "$CLOUD_PATH" 2>/dev/null || find "$CLOUD_PATH" -maxdepth 2 -type d
    
    echo
    echo "======================================"
    echo "磁盘使用:"
    echo "======================================"
    df -h "$CLOUD_PATH"
    
    echo
    echo "======================================"
    echo "数据目录大小:"
    echo "======================================"
    du -sh "$CLOUD_PATH"/* 2>/dev/null || true
    
    log_success "配置验证完成"
}

# 显示下一步操作
show_next_steps() {
    echo
    echo "======================================"
    echo "✅ 云硬盘配置完成!"
    echo "======================================"
    echo
    echo "下一步操作:"
    echo
    echo "1. 编辑环境变量文件:"
    echo "   nano /opt/zishu-sensei/.env"
    echo
    echo "2. 启动Docker服务:"
    echo "   cd /opt/zishu-sensei"
    echo "   docker-compose up -d"
    echo
    echo "3. 初始化向量数据库:"
    echo "   python scripts/init_qdrant_collections.py"
    echo
    echo "4. 查看服务状态:"
    echo "   docker-compose ps"
    echo
    echo "5. 设置定时备份:"
    echo "   $CLOUD_PATH/backup/backup.sh"
    echo
    echo "======================================"
}

# 主函数
main() {
    echo "======================================"
    echo " Zishu-Sensei 云硬盘配置脚本"
    echo "======================================"
    echo
    
    check_root
    get_cloud_path "$1"
    check_mount
    create_directories
    set_permissions
    migrate_data
    update_env
    create_symlinks
    verify_setup
    show_next_steps
}

# 执行主函数
main "$@"


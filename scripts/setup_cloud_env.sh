#!/bin/bash

# =============================================================================
# Zishu-Sensei 云硬盘环境设置脚本
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 路径定义
CLOUD_DISK_PATH="/root/data/disk"
CLOUD_ENV_PATH="/data/zishu-sensei"
PROJECT_ROOT="/opt/zishu-sensei"

echo -e "${BLUE}=== Zishu-Sensei 云硬盘环境设置 ===${NC}"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请以root权限运行此脚本${NC}"
    echo -e "${YELLOW}使用: sudo $0${NC}"
    exit 1
fi

# 1. 检查云硬盘是否挂载
echo -e "${YELLOW}1. 检查云硬盘挂载状态...${NC}"
if [ ! -d "$CLOUD_DISK_PATH" ]; then
    echo -e "${RED}错误: 云硬盘未挂载到 $CLOUD_DISK_PATH${NC}"
    echo -e "${YELLOW}请先挂载云硬盘${NC}"
    exit 1
fi

# 2. 创建绑定挂载点
echo -e "${YELLOW}2. 设置绑定挂载...${NC}"
if [ ! -d "/data" ]; then
    mkdir -p /data
fi

# 检查是否已经挂载
if ! mountpoint -q /data; then
    mount --bind "$CLOUD_DISK_PATH" /data
    echo -e "${GREEN}已绑定挂载云硬盘到 /data${NC}"
else
    echo -e "${GREEN}/data 已经挂载${NC}"
fi

# 3. 创建项目目录
echo -e "${YELLOW}3. 创建云硬盘项目目录...${NC}"
if [ ! -d "$CLOUD_ENV_PATH" ]; then
    mkdir -p "$CLOUD_ENV_PATH"
    echo -e "${GREEN}已创建 $CLOUD_ENV_PATH${NC}"
fi

# 4. 设置权限
echo -e "${YELLOW}4. 设置目录权限...${NC}"
chown -R $SUDO_USER:$SUDO_USER /data
chmod 755 /data
chmod 755 "$CLOUD_ENV_PATH"

# 5. 创建虚拟环境（如果不存在）
echo -e "${YELLOW}5. 检查虚拟环境...${NC}"
if [ ! -d "$CLOUD_ENV_PATH/venv" ]; then
    echo -e "${YELLOW}创建Python虚拟环境...${NC}"
    sudo -u $SUDO_USER python3 -m venv "$CLOUD_ENV_PATH/venv"
    echo -e "${GREEN}虚拟环境已创建${NC}"
else
    echo -e "${GREEN}虚拟环境已存在${NC}"
fi

# 6. 安装依赖（如果需要）
echo -e "${YELLOW}6. 检查依赖安装状态...${NC}"
if sudo -u $SUDO_USER bash -c "source $CLOUD_ENV_PATH/venv/bin/activate && python -c 'import torch' 2>/dev/null"; then
    echo -e "${GREEN}主要依赖已安装${NC}"
else
    echo -e "${YELLOW}需要安装依赖，这可能需要一些时间...${NC}"
    sudo -u $SUDO_USER bash -c "
        source $CLOUD_ENV_PATH/venv/bin/activate && 
        pip install --upgrade pip &&
        pip install torch transformers fastapi uvicorn sqlalchemy redis
    "
    echo -e "${GREEN}基础依赖安装完成${NC}"
fi

# 7. 添加到fstab（可选）
echo -e "${YELLOW}7. 是否添加到开机自动挂载? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if ! grep -q "$CLOUD_DISK_PATH /data" /etc/fstab; then
        echo "$CLOUD_DISK_PATH /data none bind 0 0" >> /etc/fstab
        echo -e "${GREEN}已添加到 /etc/fstab${NC}"
    else
        echo -e "${GREEN}已存在于 /etc/fstab${NC}"
    fi
fi

# 8. 显示磁盘使用情况
echo -e "\n${BLUE}=== 磁盘使用情况 ===${NC}"
df -h | grep -E "(Filesystem|/dev/vd|/data)"

echo -e "\n${GREEN}=== 设置完成 ===${NC}"
echo -e "${YELLOW}使用方法:${NC}"
echo -e "  $PROJECT_ROOT/run_with_cloud_env.sh <命令>"
echo -e "\n${YELLOW}示例:${NC}"
echo -e "  $PROJECT_ROOT/run_with_cloud_env.sh main.py"
echo -e "  $PROJECT_ROOT/run_with_cloud_env.sh -m uvicorn main:app --reload"

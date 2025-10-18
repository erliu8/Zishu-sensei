#!/bin/bash

# =============================================================================
# Zishu-Sensei 云硬盘环境启动脚本
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_ROOT="/opt/zishu-sensei"
CLOUD_ENV_PATH="/data/disk/zishu-sensei"

echo -e "${BLUE}=== Zishu-Sensei 云硬盘环境启动器 ===${NC}"

# 检查云硬盘环境是否存在
if [ ! -d "$CLOUD_ENV_PATH/venv" ]; then
    echo -e "${RED}错误: 云硬盘虚拟环境不存在 ($CLOUD_ENV_PATH/venv)${NC}"
    echo -e "${YELLOW}请先运行环境设置脚本${NC}"
    exit 1
fi

# 检查项目目录
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}错误: 项目目录不存在 ($PROJECT_ROOT)${NC}"
    exit 1
fi

# 激活云硬盘虚拟环境
echo -e "${GREEN}激活云硬盘虚拟环境...${NC}"
source "$CLOUD_ENV_PATH/venv/bin/activate"

# 切换到项目目录
cd "$PROJECT_ROOT"

# 显示环境信息
echo -e "${BLUE}环境信息:${NC}"
echo -e "  项目目录: $PROJECT_ROOT"
echo -e "  虚拟环境: $CLOUD_ENV_PATH/venv"
echo -e "  Python版本: $(python --version)"
echo -e "  pip位置: $(which pip)"

# 如果没有参数，显示帮助信息
if [ $# -eq 0 ]; then
    echo -e "\n${YELLOW}使用方法:${NC}"
    echo -e "  $0 <python脚本或命令>"
    echo -e "\n${YELLOW}示例:${NC}"
    echo -e "  $0 main.py                    # 运行主程序"
    echo -e "  $0 -m uvicorn main:app --reload  # 启动开发服务器"
    echo -e "  $0 -c \"import torch; print(torch.__version__)\"  # 测试torch"
    echo -e "  $0 -m pytest tests/          # 运行测试"
    exit 0
fi

# 运行传入的命令
echo -e "\n${GREEN}执行命令: python $@${NC}"
python "$@"

#!/bin/bash
set -e

# 紫舒老师社区平台部署脚本
# Deploy script for Zishu AI Community Platform

echo "======================================"
echo "  Zishu AI 社区平台部署脚本"
echo "======================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查 Docker Compose（支持 V1 和 V2）
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}错误: Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

echo "使用 Docker Compose: $DOCKER_COMPOSE"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: .env 文件不存在，正在从 env.example 复制...${NC}"
    cp env.example .env
    echo -e "${YELLOW}请编辑 .env 文件并配置您的环境变量，然后重新运行此脚本${NC}"
    exit 1
fi

# 选择部署模式
echo "请选择部署模式:"
echo "1) 开发模式 (Development)"
echo "2) 生产模式 (Production)"
read -p "请输入选项 (1/2): " mode

case $mode in
    1)
        echo -e "${GREEN}启动开发模式部署...${NC}"
        export ENVIRONMENT=development
        ;;
    2)
        echo -e "${GREEN}启动生产模式部署...${NC}"
        export ENVIRONMENT=production
        
        # 生产模式检查
        if grep -q "your-secret-key-change-in-production" .env; then
            echo -e "${RED}错误: 请在 .env 文件中设置生产环境的 SECRET_KEY${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

# 创建必要的目录
echo -e "${GREEN}创建必要的目录...${NC}"
mkdir -p nginx/ssl
mkdir -p backend/uploads
mkdir -p logs

# 拉取最新镜像
echo -e "${GREEN}拉取最新的 Docker 镜像...${NC}"
$DOCKER_COMPOSE pull

# 构建镜像
echo -e "${GREEN}构建 Docker 镜像...${NC}"
$DOCKER_COMPOSE build --no-cache

# 停止旧容器
echo -e "${GREEN}停止旧容器...${NC}"
$DOCKER_COMPOSE down

# 启动服务
echo -e "${GREEN}启动服务...${NC}"
$DOCKER_COMPOSE up -d

# 等待服务启动
echo -e "${GREEN}等待服务启动...${NC}"
sleep 10

# 检查服务状态
echo -e "${GREEN}检查服务状态...${NC}"
$DOCKER_COMPOSE ps

# 检查健康状态
echo ""
echo -e "${GREEN}检查服务健康状态...${NC}"
echo "正在检查后端服务..."
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠ 后端服务可能还未完全启动，请稍后检查${NC}"
fi

echo "正在检查前端服务..."
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠ 前端服务可能还未完全启动，请稍后检查${NC}"
fi

echo "正在检查 Nginx..."
if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx 运行正常${NC}"
else
    echo -e "${YELLOW}⚠ Nginx 可能还未完全启动，请稍后检查${NC}"
fi

# 显示日志命令
echo ""
echo -e "${GREEN}======================================"
echo "  部署完成！"
echo "======================================${NC}"
echo ""
echo "访问地址:"
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:8000"
echo "  Nginx: http://localhost"
echo ""
echo "查看日志:"
echo "  所有服务: $DOCKER_COMPOSE logs -f"
echo "  后端: $DOCKER_COMPOSE logs -f backend"
echo "  前端: $DOCKER_COMPOSE logs -f frontend"
echo "  Nginx: $DOCKER_COMPOSE logs -f nginx"
echo ""
echo "停止服务: $DOCKER_COMPOSE down"
echo "重启服务: $DOCKER_COMPOSE restart"
echo ""


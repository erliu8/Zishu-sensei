#!/bin/bash
# 社区后端镜像优化构建脚本

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  社区后端 Docker 镜像构建脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查是否只是代码变化（开发模式提示）
if [ "$1" == "--dev" ] || [ "$1" == "-d" ]; then
    echo -e "${YELLOW}⚠️  开发模式提示：${NC}"
    echo -e "${YELLOW}   如果只是修改了代码（非依赖），无需重建镜像！${NC}"
    echo -e "${YELLOW}   代码通过卷挂载已同步到容器，只需重启：${NC}"
    echo -e "${GREEN}   docker-compose restart backend${NC}"
    echo ""
    read -p "确认要重建镜像吗？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}已取消构建${NC}"
        exit 0
    fi
fi

# 镜像名称和标签
IMAGE_NAME=${IMAGE_NAME:-"zishu-community-backend"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo -e "${YELLOW}镜像名称: ${FULL_IMAGE_NAME}${NC}"

# 启用 Docker BuildKit（必须启用以使用缓存挂载功能）
export DOCKER_BUILDKIT=1

echo -e "${GREEN}✓ 已启用 Docker BuildKit${NC}"

# 构建参数
BUILD_ARGS=""

# 如果需要使用代理
if [ -n "$HTTP_PROXY" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg HTTP_PROXY=$HTTP_PROXY"
fi
if [ -n "$HTTPS_PROXY" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg HTTPS_PROXY=$HTTPS_PROXY"
fi

echo -e "${BLUE}开始构建镜像...${NC}"

# 执行构建
docker build \
    --progress=plain \
    --tag "${FULL_IMAGE_NAME}" \
    ${BUILD_ARGS} \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ 镜像构建成功！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}镜像名称: ${FULL_IMAGE_NAME}${NC}"
    
    # 显示镜像大小
    IMAGE_SIZE=$(docker images "${FULL_IMAGE_NAME}" --format "{{.Size}}")
    echo -e "${YELLOW}镜像大小: ${IMAGE_SIZE}${NC}"
    
    echo ""
    echo -e "${BLUE}运行容器:${NC}"
    echo -e "  docker run -d -p 8000:8000 --name community-backend ${FULL_IMAGE_NAME}"
    echo ""
    echo -e "${BLUE}查看日志:${NC}"
    echo -e "  docker logs -f community-backend"
else
    echo -e "${RED}✗ 镜像构建失败${NC}"
    exit 1
fi


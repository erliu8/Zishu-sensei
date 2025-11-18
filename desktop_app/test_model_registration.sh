#!/bin/bash
# 测试模型注册功能的完整脚本

echo "========================================="
echo "模型注册功能诊断测试"
echo "========================================="
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查后端服务
echo "1. 检查后端服务状态..."
if docker ps | grep -q "zishu-api"; then
    echo -e "${GREEN}✓ 后端服务运行中${NC}"
    docker ps --filter "name=zishu-api" --format "  - {{.Names}}: {{.Status}}"
else
    echo -e "${RED}✗ 后端服务未运行${NC}"
    echo "  请运行: docker-compose up -d zishu-api"
    exit 1
fi
echo ""

# 2. 测试后端连接
echo "2. 测试后端连接..."
BACKEND_URL="http://127.0.0.1:8000"

# 测试健康检查端点
echo "  测试健康检查: ${BACKEND_URL}/api/v1/models/health"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/api/v1/models/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 健康检查成功${NC}"
else
    echo -e "${RED}✗ 健康检查失败 (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# 3. 测试注册 API
echo "3. 测试注册 API..."
MODEL_PATH="/data/disk/models/Index-1.9B-character"

if [ ! -e "$MODEL_PATH" ]; then
    echo -e "${YELLOW}⚠ 测试模型路径不存在: $MODEL_PATH${NC}"
    echo "  请修改 MODEL_PATH 为有效的模型路径"
    exit 1
fi

echo "  模型路径: $MODEL_PATH"
echo "  发送注册请求..."

REGISTER_START=$(date +%s.%N)
REGISTER_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/v1/models/register-llm" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"test-$(date +%s)\",
        \"model_path\": \"$MODEL_PATH\",
        \"description\": \"自动测试\",
        \"model_type\": \"llama\"
    }" \
    -w "\n%{http_code}")

REGISTER_END=$(date +%s.%N)
REGISTER_TIME=$(echo "$REGISTER_END - $REGISTER_START" | bc)
HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$REGISTER_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 注册成功 (耗时: ${REGISTER_TIME}秒)${NC}"
    echo "  响应: $RESPONSE_BODY" | head -c 200
    echo "..."
else
    echo -e "${RED}✗ 注册失败 (HTTP $HTTP_CODE)${NC}"
    echo "  响应: $RESPONSE_BODY"
    exit 1
fi
echo ""

# 4. 检查环境变量
echo "4. 检查环境变量..."
if [ -n "$ZISHU_BACKEND_URL" ]; then
    echo -e "${GREEN}✓ ZISHU_BACKEND_URL 已设置: $ZISHU_BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠ ZISHU_BACKEND_URL 未设置（将使用默认值: http://127.0.0.1:8000）${NC}"
fi
echo ""

# 5. 总结
echo "========================================="
echo -e "${GREEN}诊断测试完成${NC}"
echo "========================================="
echo ""
echo "如果所有测试都通过，但桌面应用仍然注册失败，请："
echo "1. 确保使用 start-dev.sh 启动应用"
echo "2. 查看应用日志中的详细错误信息"
echo "3. 检查日志中的 '后端 URL 配置' 输出"
echo "4. 确认健康检查和注册请求的耗时"
echo ""
echo "启动应用："
echo "  cd /opt/zishu-sensei/desktop_app"
echo "  ./start-dev.sh"
echo ""

#!/bin/bash

# 测试用户注册功能
# 此脚本测试前端和后端的注册功能集成

set -e

echo "========================================="
echo "测试用户注册功能"
echo "========================================="
echo ""

# 生成唯一的用户名和邮箱
TIMESTAMP=$(date +%s)
USERNAME="testuser${TIMESTAMP}"
EMAIL="${USERNAME}@example.com"
PASSWORD="Test123456!"
FULL_NAME="Test User ${TIMESTAMP}"

echo "测试参数:"
echo "  用户名: ${USERNAME}"
echo "  邮箱: ${EMAIL}"
echo "  密码: ${PASSWORD}"
echo "  姓名: ${FULL_NAME}"
echo ""

# 测试1: 直接调用后端API注册
echo "测试1: 直接调用后端API注册"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"full_name\": \"${FULL_NAME}\"
  }")

echo "响应:"
echo "$RESPONSE" | python3 -m json.tool
echo ""

# 检查是否成功
if echo "$RESPONSE" | grep -q '"access_token"'; then
  echo "✓ 后端API注册成功"
  ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
  USER_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['id'])")
  echo "  用户ID: ${USER_ID}"
  echo "  访问令牌: ${ACCESS_TOKEN:0:20}..."
else
  echo "✗ 后端API注册失败"
  exit 1
fi
echo ""

# 测试2: 使用获取的token访问受保护的端点
echo "测试2: 使用token访问受保护的端点"
echo "-------------------------------------------"
ME_RESPONSE=$(curl -s -X GET http://localhost:8001/api/v1/users/me \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "响应:"
echo "$ME_RESPONSE" | python3 -m json.tool
echo ""

if echo "$ME_RESPONSE" | grep -q '"username"'; then
  echo "✓ Token验证成功"
  ME_USERNAME=$(echo "$ME_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['username'])" 2>/dev/null || echo "N/A")
  echo "  用户名: ${ME_USERNAME}"
else
  echo "✗ Token验证失败"
  exit 1
fi
echo ""

# 测试3: 尝试用相同的用户名再次注册（应该失败）
echo "测试3: 尝试用相同的用户名再次注册（应该失败）"
echo "-------------------------------------------"
DUPLICATE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"email\": \"new${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"full_name\": \"${FULL_NAME}\"
  }")

echo "响应:"
echo "$DUPLICATE_RESPONSE" | python3 -m json.tool
echo ""

if echo "$DUPLICATE_RESPONSE" | grep -q '"error"'; then
  echo "✓ 重复用户名检测正常"
else
  echo "✗ 应该拒绝重复的用户名"
  exit 1
fi
echo ""

# 测试4: 测试登录
echo "测试4: 测试用已注册的用户登录"
echo "-------------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "响应:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool
echo ""

if echo "$LOGIN_RESPONSE" | grep -q '"access_token"'; then
  echo "✓ 登录成功"
  NEW_ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
  echo "  新访问令牌: ${NEW_ACCESS_TOKEN:0:20}..."
else
  echo "✗ 登录失败"
  exit 1
fi
echo ""

# 测试5: 使用邮箱登录
echo "测试5: 测试用邮箱登录"
echo "-------------------------------------------"
EMAIL_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "响应:"
echo "$EMAIL_LOGIN_RESPONSE" | python3 -m json.tool
echo ""

if echo "$EMAIL_LOGIN_RESPONSE" | grep -q '"access_token"'; then
  echo "✓ 邮箱登录成功"
else
  echo "✗ 邮箱登录失败"
  exit 1
fi
echo ""

echo "========================================="
echo "所有测试通过！✓"
echo "========================================="
echo ""
echo "测试用户信息:"
echo "  用户名: ${USERNAME}"
echo "  邮箱: ${EMAIL}"
echo "  用户ID: ${USER_ID}"
echo ""
echo "您可以使用以下凭据在前端登录测试:"
echo "  用户名/邮箱: ${USERNAME} 或 ${EMAIL}"
echo "  密码: ${PASSWORD}"
echo ""


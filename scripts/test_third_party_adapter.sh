#!/bin/bash
# 第三方API适配器测试脚本

echo "=== 紫舒老师 - 第三方API适配器测试 ==="
echo ""

# API基础URL
API_BASE="http://localhost:8000/api"

# 测试1：列出所有适配器
echo "1. 测试：列出所有适配器"
curl -s "${API_BASE}/adapters/list" | python3 -m json.tool
echo ""
echo "---"
echo ""

# 测试2：注册OpenAI适配器（需要提供API Key）
if [ ! -z "$OPENAI_API_KEY" ]; then
    echo "2. 测试：注册OpenAI适配器"
    curl -s -X POST "${API_BASE}/adapters/third-party/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"provider\": \"openai\",
            \"api_key\": \"${OPENAI_API_KEY}\",
            \"model\": \"gpt-3.5-turbo\",
            \"temperature\": 0.7,
            \"max_tokens\": 2000
        }" | python3 -m json.tool
    echo ""
    echo "---"
    echo ""
    
    # 等待适配器启动
    sleep 2
    
    # 测试3：使用适配器进行对话
    echo "3. 测试：使用适配器进行对话"
    curl -s -X POST "${API_BASE}/chat/completions" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "你好，请用一句话介绍你自己"}
            ],
            "adapter": "third_party_openai"
        }' | python3 -m json.tool
    echo ""
    echo "---"
    echo ""
else
    echo "2. 跳过：未设置OPENAI_API_KEY环境变量"
    echo ""
fi

# 测试4：健康检查
echo "4. 测试：健康检查"
curl -s "${API_BASE}/../health" | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "测试完成！"
echo ""
echo "使用说明："
echo "1. 设置API Key环境变量："
echo "   export OPENAI_API_KEY=sk-your-key-here"
echo ""
echo "2. 运行测试："
echo "   bash scripts/test_third_party_adapter.sh"
echo ""
echo "3. 查看前端界面："
echo "   - 启动后端: python -m zishu.api.server --debug"
echo "   - 启动前端: cd desktop_app && npm run dev"
echo "   - 打开设置 > AI设置 > 第三方API"

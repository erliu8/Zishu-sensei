#!/bin/bash

BASE_DIR="/opt/zishu-sensei/community_platform/frontend"
cd "$BASE_DIR"

echo "🔍 验证架构结构..."
echo ""

# 统计信息
echo "📊 统计信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Features 模块
FEATURES_COUNT=$(find src/features -type d -maxdepth 1 -mindepth 1 | wc -l)
echo "✅ Features 模块数量: $FEATURES_COUNT 个"

# 组件文件
COMPONENT_FILES=$(find src -name "*.tsx" | wc -l)
echo "✅ 组件文件数量: $COMPONENT_FILES 个"

# TypeScript 文件
TS_FILES=$(find src -name "*.ts" | wc -l)
echo "✅ TypeScript 文件: $TS_FILES 个"

# App Router 页面
APP_PAGES=$(find app -name "page.tsx" | wc -l)
echo "✅ App Router 页面: $APP_PAGES 个"

# API Routes
API_ROUTES=$(find app/api -name "route.ts" 2>/dev/null | wc -l)
echo "✅ API Routes: $API_ROUTES 个"

# 测试文件
TEST_FILES=$(find src/tests -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
echo "✅ 测试文件: $TEST_FILES 个"

# i18n 语言文件
I18N_FILES=$(find src/infrastructure/i18n/locales -name "*.json" 2>/dev/null | wc -l)
echo "✅ i18n 语言文件: $I18N_FILES 个"

echo ""
echo "📁 主要目录结构："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 列出主要目录
tree -L 2 -d src 2>/dev/null || find src -type d -maxdepth 2 | head -50

echo ""
echo "🎯 Features 模块列表："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -1 src/features/

echo ""
echo "✅ 架构创建完成！"
echo ""
echo "📝 下一步建议："
echo "  1. 检查 src/features/ 下的所有模块"
echo "  2. 查看 src/shared/components/ 下的组件"
echo "  3. 配置 src/infrastructure/ 下的基础设施"
echo "  4. 编写测试文件 src/tests/"
echo "  5. 更新配置文件 (.eslintrc.json, tailwind.config.ts 等)"
echo ""

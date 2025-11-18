#!/bin/bash

# 设置后端URL环境变量（使用127.0.0.1避免IPv6解析问题）
export ZISHU_BACKEND_URL="http://127.0.0.1:8000"

# 启用详细日志
export RUST_LOG="zishu_sensei=debug,info"
export RUST_BACKTRACE=1

# 启动桌面应用开发模式
cd "$(dirname "$0")"

echo "========================================="
echo "启动 Zishu Sensei 桌面应用"
echo "后端URL: $ZISHU_BACKEND_URL"
echo "日志级别: $RUST_LOG"
echo "========================================="

npm run tauri:dev

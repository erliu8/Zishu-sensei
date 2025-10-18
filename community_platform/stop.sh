#!/bin/bash
set -e

# 紫舒老师社区平台停止脚本
# Stop script for Zishu AI Community Platform

echo "======================================"
echo "  停止 Zishu AI 社区平台"
echo "======================================"
echo ""

# 停止所有服务
echo "正在停止所有服务..."
docker-compose down

echo ""
echo "服务已停止"
echo ""
echo "如需删除数据卷，请运行: docker-compose down -v"
echo ""


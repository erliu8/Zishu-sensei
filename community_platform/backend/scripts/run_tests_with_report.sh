#!/bin/bash

# 紫舒老师社区平台后端测试脚本
# 运行所有测试并生成HTML报告

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到后端目录
cd "$BACKEND_DIR"

# 设置PYTHONPATH
export PYTHONPATH="$BACKEND_DIR"

# 设置虚拟环境
VENV_PYTHON="/data/disk/zishu-sensei/venv/bin/python"

# 检查测试数据库是否存在
echo "检查测试数据库..."
$VENV_PYTHON scripts/create_test_db.py

# 运行测试并生成报告
echo "运行测试套件..."
$VENV_PYTHON -m pytest tests/ \
    -v \
    --tb=short \
    --cov=app \
    --cov-report=html \
    --cov-report=term \
    --html=test_report.html \
    --self-contained-html \
    --json-report \
    --json-report-file=test_report.json \
    --junit-xml=test_report.xml \
    2>&1 | tee test_output.log

# 输出测试结果摘要
echo ""
echo "====================================="
echo "测试完成！"
echo "====================================="
echo ""
echo "测试报告位置："
echo "  - HTML报告: $BACKEND_DIR/test_report.html"
echo "  - HTML覆盖率报告: $BACKEND_DIR/htmlcov/index.html"
echo "  - JSON报告: $BACKEND_DIR/test_report.json"
echo "  - JUnit XML报告: $BACKEND_DIR/test_report.xml"
echo "  - 测试日志: $BACKEND_DIR/test_output.log"
echo ""

# 输出测试统计
echo "测试统计："
echo "--------"
grep -E "(passed|failed|error|skipped)" test_output.log | tail -1 || echo "无法提取测试统计信息"
echo ""


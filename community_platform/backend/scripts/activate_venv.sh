#!/bin/bash
# 激活虚拟环境的快捷脚本

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查虚拟环境是否存在
if [ ! -d "$SCRIPT_DIR/.venv" ]; then
    echo "❌ 虚拟环境不存在！"
    echo "符号链接应该指向: /data/disk/zishu-sensei/venv"
    exit 1
fi

# 激活虚拟环境
source "$SCRIPT_DIR/.venv/bin/activate"

echo "✅ 虚拟环境已激活"
echo "Python 路径: $(which python)"
echo "Python 版本: $(python --version)"
echo ""
echo "快速命令:"
echo "  - 运行测试: pytest tests/"
echo "  - 运行服务器: uvicorn main:app --reload"
echo "  - 安装依赖: pip install -r requirements.txt"


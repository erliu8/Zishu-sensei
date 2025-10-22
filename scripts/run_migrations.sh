#!/bin/bash
# 运行数据库迁移的辅助脚本
# 使用方法：
#   ./scripts/run_migrations.sh upgrade     # 应用所有迁移
#   ./scripts/run_migrations.sh downgrade   # 回退一个版本
#   ./scripts/run_migrations.sh history     # 查看迁移历史

set -e

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_DIR"

# 设置数据库连接URL (本地开发环境)
export DATABASE_URL="postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"

# 激活虚拟环境
if [ -f "/data/disk/zishu-sensei/venv/bin/activate" ]; then
    source /data/disk/zishu-sensei/venv/bin/activate
    PYTHON_BIN="/data/disk/zishu-sensei/venv/bin/python3"
else
    PYTHON_BIN="python3"
fi

# 执行alembic命令
ALEMBIC_CONFIG="zishu/alembic/alembic.ini"

case "$1" in
    upgrade)
        echo "应用数据库迁移..."
        $PYTHON_BIN -m alembic --config "$ALEMBIC_CONFIG" upgrade head
        echo "✓ 迁移完成"
        ;;
    downgrade)
        echo "回退数据库迁移..."
        $PYTHON_BIN -m alembic --config "$ALEMBIC_CONFIG" downgrade -1
        echo "✓ 回退完成"
        ;;
    history)
        echo "迁移历史："
        $PYTHON_BIN -m alembic --config "$ALEMBIC_CONFIG" history
        ;;
    current)
        echo "当前版本："
        $PYTHON_BIN -m alembic --config "$ALEMBIC_CONFIG" current
        ;;
    create)
        if [ -z "$2" ]; then
            echo "错误：请提供迁移描述"
            echo "使用方法: $0 create '迁移描述'"
            exit 1
        fi
        echo "生成新的迁移文件..."
        $PYTHON_BIN -m alembic --config "$ALEMBIC_CONFIG" revision --autogenerate -m "$2"
        echo "✓ 迁移文件已生成"
        ;;
    *)
        echo "使用方法: $0 {upgrade|downgrade|history|current|create '描述'}"
        echo ""
        echo "命令说明："
        echo "  upgrade    - 应用所有待执行的迁移"
        echo "  downgrade  - 回退最近一次迁移"
        echo "  history    - 查看迁移历史"
        echo "  current    - 查看当前数据库版本"
        echo "  create     - 创建新的迁移文件"
        exit 1
        ;;
esac


#!/bin/bash
set -e

echo "🚀 开始启动后端服务..."

# 等待 PostgreSQL
echo "⏳ 等待 PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "PostgreSQL 未就绪 - 等待..."
  sleep 2
done
echo "✅ PostgreSQL 已就绪"

# 等待 Redis
echo "⏳ 等待 Redis..."
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; do
  echo "Redis 未就绪 - 等待..."
  sleep 2
done
echo "✅ Redis 已就绪"

# 等待 Qdrant
echo "⏳ 等待 Qdrant..."
max_retries=30
retry_count=0
until wget -q -O /dev/null "http://$QDRANT_HOST:$QDRANT_PORT/" 2>/dev/null || [ $retry_count -eq $max_retries ]; do
  retry_count=$((retry_count + 1))
  echo "Qdrant 未就绪 - 等待... (尝试 $retry_count/$max_retries)"
  sleep 2
done

if [ $retry_count -eq $max_retries ]; then
  echo "⚠️  警告: Qdrant 在 $max_retries 次尝试后仍未就绪，但仍将启动服务"
else
  echo "✅ Qdrant 已就绪"
fi

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
alembic upgrade head || echo "⚠️  数据库迁移失败或已是最新版本"

# 启动应用
echo "✅ 所有依赖已就绪，启动应用..."
exec "$@"


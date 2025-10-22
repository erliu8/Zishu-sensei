# Zishu-Sensei 部署指南

## 📦 数据目录结构

### 云硬盘配置

所有持久化数据应该存储在云硬盘中，以确保数据安全和性能。

#### 推荐的云硬盘挂载路径

```bash
/data/disk/zishu-sensei/
```

#### 数据目录结构

```
/data/disk/zishu-sensei/
├── data/
│   ├── qdrant/          # Qdrant向量数据库数据
│   ├── postgres/        # PostgreSQL数据库数据
│   ├── redis/           # Redis持久化数据
│   ├── prometheus/      # Prometheus监控数据
│   ├── grafana/         # Grafana配置和仪表板
│   └── loki/            # Loki日志数据
├── models/              # AI模型文件（可选，如果本地部署）
├── logs/                # 应用日志
└── backup/              # 数据备份
```

## 🚀 部署步骤

### 1. 准备云硬盘

```bash
# 检查云硬盘挂载
df -h /data/disk/zishu-sensei

# 创建数据目录
mkdir -p /data/disk/zishu-sensei/{data,models,logs,backup}
mkdir -p /data/disk/zishu-sensei/data/{qdrant,postgres,redis,prometheus,grafana,loki}

# 设置权限
sudo chown -R $USER:$USER /data/disk/zishu-sensei
chmod -R 755 /data/disk/zishu-sensei
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 云硬盘路径配置
CLOUD_DATA_PATH=/data/disk/zishu-sensei

# 数据库配置
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://zishu:your_secure_password@postgres:5432/zishu

# Redis配置
REDIS_PASSWORD=your_redis_password
REDIS_URL=redis://:your_redis_password@redis:6379/0

# Qdrant配置
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=your_qdrant_api_key

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key

# Grafana配置
GRAFANA_PASSWORD=your_grafana_password

# 日志级别
ZISHU_LOG_LEVEL=INFO
```

### 3. 启动服务

```bash
# 拉取最新镜像
docker-compose pull

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 初始化向量数据库

```bash
# 等待Qdrant服务启动
sleep 10

# 初始化向量集合
python scripts/init_qdrant_collections.py

# 验证集合创建
curl http://localhost:6335/collections
```

### 5. 运行健康检查

```bash
# 检查API服务
curl http://localhost:8000/health

# 检查Qdrant
curl http://localhost:6335/health

# 检查Redis
docker-compose exec redis redis-cli ping

# 检查PostgreSQL
docker-compose exec postgres psql -U zishu -d zishu -c "SELECT version();"
```

## 📊 监控访问

- **API文档**: http://your-server:8000/docs
- **Grafana**: http://your-server:3000 (默认用户名: admin)
- **Prometheus**: http://your-server:9090
- **Qdrant Dashboard**: http://your-server:6336/dashboard

## 🔧 运维操作

### 备份数据

```bash
# 创建备份脚本
cat > /data/disk/zishu-sensei/backup/backup.sh <<'EOF'
#!/bin/bash

BACKUP_DIR="/data/disk/zishu-sensei/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份PostgreSQL
docker-compose exec -T postgres pg_dump -U zishu zishu | gzip > "${BACKUP_DIR}/postgres_${DATE}.sql.gz"

# 备份Qdrant
tar -czf "${BACKUP_DIR}/qdrant_${DATE}.tar.gz" -C /data/disk/zishu-sensei/data qdrant/

# 备份Redis
docker-compose exec -T redis redis-cli --rdb /data/dump.rdb
cp /data/disk/zishu-sensei/data/redis/dump.rdb "${BACKUP_DIR}/redis_${DATE}.rdb"

# 清理30天前的备份
find "${BACKUP_DIR}" -name "*.gz" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.rdb" -mtime +30 -delete

echo "Backup completed: ${DATE}"
EOF

chmod +x /data/disk/zishu-sensei/backup/backup.sh

# 设置定时任务（每天凌晨2点）
(crontab -l 2>/dev/null; echo "0 2 * * * /data/disk/zishu-sensei/backup/backup.sh >> /data/disk/zishu-sensei/logs/backup.log 2>&1") | crontab -
```

### 恢复数据

```bash
# 恢复PostgreSQL
gunzip < /data/disk/zishu-sensei/backup/postgres_20250122_020000.sql.gz | \
  docker-compose exec -T postgres psql -U zishu -d zishu

# 恢复Qdrant
tar -xzf /data/disk/zishu-sensei/backup/qdrant_20250122_020000.tar.gz \
  -C /data/disk/zishu-sensei/data/

# 恢复Redis
cp /data/disk/zishu-sensei/backup/redis_20250122_020000.rdb \
   /data/disk/zishu-sensei/data/redis/dump.rdb
docker-compose restart redis
```

### 查看磁盘使用

```bash
# 查看各服务数据大小
du -sh /data/disk/zishu-sensei/data/*

# 监控磁盘使用趋势
df -h /data/disk/zishu-sensei | tail -1
```

### 清理旧数据

```bash
# 清理Prometheus旧数据（保留30天）
docker-compose exec prometheus \
  promtool tsdb delete --retention 30d /prometheus

# 清理应用日志（保留7天）
find /data/disk/zishu-sensei/logs -name "*.log" -mtime +7 -delete
```

## 🔒 安全建议

### 1. 文件权限

```bash
# 确保数据目录权限正确
chmod 700 /data/disk/zishu-sensei/data/postgres
chmod 700 /data/disk/zishu-sensei/data/redis
chmod 755 /data/disk/zishu-sensei/data/qdrant
```

### 2. 密码管理

- 使用强密码（至少16位，包含大小写字母、数字和特殊字符）
- 定期更换密码
- 不要在代码中硬编码密码
- 使用 `.env` 文件，并确保它不被提交到版本控制

### 3. 网络安全

```bash
# 限制端口访问（仅允许必要的端口对外）
# 在生产环境中，建议只开放80和443端口
# 其他端口仅在内网访问
```

### 4. 数据加密

- 对敏感数据进行加密存储
- 使用HTTPS进行数据传输
- 启用数据库连接加密

## 📈 性能优化

### Qdrant优化

```yaml
# config/services/qdrant.yml
storage:
  # 使用高性能存储引擎
  performance:
    max_optimization_threads: 4
  
  # 启用压缩
  compression:
    level: 5
```

### PostgreSQL优化

```bash
# 调整PostgreSQL配置
docker-compose exec postgres psql -U zishu -d zishu -c "
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
"

# 重启PostgreSQL
docker-compose restart postgres
```

### Redis优化

```bash
# 调整Redis内存策略
docker-compose exec redis redis-cli CONFIG SET maxmemory 2gb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 🐛 故障排查

### Qdrant无法启动

```bash
# 检查数据目录权限
ls -la /data/disk/zishu-sensei/data/qdrant

# 检查日志
docker-compose logs qdrant

# 重建索引
docker-compose stop qdrant
rm -rf /data/disk/zishu-sensei/data/qdrant/*
docker-compose up -d qdrant
python scripts/init_qdrant_collections.py
```

### 磁盘空间不足

```bash
# 检查磁盘使用
df -h /data/disk/zishu-sensei

# 清理Docker缓存
docker system prune -a -f --volumes

# 压缩Prometheus数据
docker-compose exec prometheus promtool tsdb delete --retention 15d /prometheus
```

### 服务响应慢

```bash
# 查看资源使用
docker stats

# 检查网络连接
docker-compose exec zishu-api ping -c 4 qdrant
docker-compose exec zishu-api ping -c 4 postgres

# 查看慢查询日志
docker-compose logs postgres | grep "duration"
```

## 📝 日志管理

### 配置日志轮转

```bash
cat > /etc/logrotate.d/zishu-sensei <<'EOF'
/data/disk/zishu-sensei/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker-compose restart zishu-api
    endscript
}
EOF
```

### 集中日志收集

```bash
# 使用Loki收集日志
docker-compose up -d loki promtail

# 在Grafana中查看日志
# http://your-server:3000/explore -> 选择Loki数据源
```

## 🔄 更新升级

### 应用更新

```bash
# 备份数据
/data/disk/zishu-sensei/backup/backup.sh

# 拉取最新代码
git pull origin main

# 重建镜像
docker-compose build --no-cache

# 重启服务
docker-compose down
docker-compose up -d

# 运行数据库迁移（如果需要）
docker-compose exec zishu-api alembic upgrade head
```

### 系统维护

```bash
# 定期维护清单（建议每月执行）

# 1. 更新系统包
sudo apt update && sudo apt upgrade -y

# 2. 更新Docker镜像
docker-compose pull

# 3. 清理无用资源
docker system prune -f

# 4. 检查磁盘健康
sudo smartctl -a /dev/sda

# 5. 验证备份完整性
ls -lh /data/disk/zishu-sensei/backup/
```

## 📞 支持与反馈

如有问题，请：
1. 查看日志: `docker-compose logs -f`
2. 检查健康状态: `docker-compose ps`
3. 查阅文档: `/opt/zishu-sensei/docs/`
4. 提交Issue: GitHub Issues


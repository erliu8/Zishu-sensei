# Zishu AI 社区平台部署指南

这是紫舒老师（Zishu AI）的社区平台部署配置，包含前端、后端、数据库和反向代理的完整 Docker 容器化方案。

## 📋 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                        Nginx (80/443)                    │
│                    反向代理 & 负载均衡                     │
└────────────────┬──────────────────┬─────────────────────┘
                 │                  │
        ┌────────▼────────┐  ┌─────▼──────────┐
        │   Frontend      │  │    Backend     │
        │  Next.js :3000  │  │ FastAPI :8000  │
        └─────────────────┘  └────────┬───────┘
                                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                ┌───────▼────────┐      ┌──────────▼────────┐
                │   PostgreSQL   │      │      Redis        │
                │     :5432      │      │      :6379        │
                └────────────────┘      └───────────────────┘
```

## 🚀 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd community_platform
   ```

2. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp env.example .env
   
   # 编辑配置文件
   nano .env
   ```

   重要配置项：
   - `SECRET_KEY`: 生产环境必须修改（至少32字符）
   - `POSTGRES_PASSWORD`: 数据库密码
   - `REDIS_PASSWORD`: Redis 密码
   - `DOMAIN`: 生产环境域名
   - `CORS_ORIGINS`: 允许的跨域来源

3. **运行部署脚本**
   ```bash
   ./deploy.sh
   ```

   根据提示选择部署模式：
   - 开发模式 (1): 用于本地开发和测试
   - 生产模式 (2): 用于生产环境部署

4. **访问应用**
   - 前端界面: http://localhost:3000
   - 后端 API: http://localhost:8000
   - API 文档: http://localhost:8000/docs
   - Nginx 入口: http://localhost

## 📦 服务组件

### 前端 (Frontend)
- **框架**: Next.js 15 with TypeScript
- **端口**: 3000
- **构建**: 多阶段 Docker 构建，生产优化
- **特性**: 
  - 服务端渲染 (SSR)
  - 静态生成 (SSG)
  - API 路由代理
  - Tailwind CSS 样式

### 后端 (Backend)
- **框架**: FastAPI (需要创建)
- **端口**: 8000
- **数据库**: PostgreSQL
- **缓存**: Redis
- **特性**:
  - RESTful API
  - WebSocket 支持
  - 异步处理
  - JWT 认证

### 数据库 (PostgreSQL)
- **版本**: 15-alpine
- **端口**: 5432
- **持久化**: Docker volume
- **初始化**: init.sql 脚本

### 缓存 (Redis)
- **版本**: 7-alpine
- **端口**: 6379
- **持久化**: AOF 模式
- **用途**: 会话、缓存、消息队列

### 反向代理 (Nginx)
- **版本**: alpine
- **端口**: 80 (HTTP), 443 (HTTPS)
- **功能**:
  - 反向代理
  - 负载均衡
  - SSL/TLS 终止
  - 静态文件缓存
  - Gzip 压缩

## 🛠️ 常用命令

### 部署管理
```bash
# 启动所有服务
./deploy.sh

# 停止所有服务
./stop.sh

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

### 日志查看
```bash
# 查看所有服务日志
./logs.sh

# 查看特定服务日志
./logs.sh backend
./logs.sh frontend
./logs.sh nginx

# 实时跟踪日志
docker-compose logs -f backend
```

### 服务管理
```bash
# 查看服务状态
docker-compose ps

# 进入容器
docker-compose exec backend bash
docker-compose exec frontend sh

# 查看资源使用
docker stats
```

### 数据库管理
```bash
# 连接到 PostgreSQL
docker-compose exec postgres psql -U zishu -d zishu_community

# 备份数据库
docker-compose exec postgres pg_dump -U zishu zishu_community > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U zishu zishu_community < backup.sql

# 连接到 Redis
docker-compose exec redis redis-cli -a redis123
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| POSTGRES_USER | 数据库用户名 | zishu |
| POSTGRES_PASSWORD | 数据库密码 | zishu123 |
| POSTGRES_DB | 数据库名称 | zishu_community |
| REDIS_PASSWORD | Redis 密码 | redis123 |
| SECRET_KEY | 应用密钥 | 需要修改 |
| ENVIRONMENT | 运行环境 | production |
| NEXT_PUBLIC_API_URL | API 地址 | http://localhost:8000/api |
| DOMAIN | 域名 | yourdomain.com |

### Nginx 配置

主配置文件: `nginx/nginx.conf`
站点配置: `nginx/conf.d/default.conf`

支持的路由：
- `/` - 前端应用
- `/api/*` - 后端 API
- `/ws/*` - WebSocket 连接
- `/_next/static/*` - 静态资源（带缓存）

### SSL/TLS 配置

1. 获取 SSL 证书（Let's Encrypt 推荐）
2. 将证书放置在 `nginx/ssl/` 目录
3. 编辑 `nginx/conf.d/default.conf` 取消 HTTPS 配置的注释
4. 重启 Nginx: `docker-compose restart nginx`

## 🔒 生产环境部署

### 安全清单

- [ ] 修改所有默认密码
- [ ] 设置强密码的 SECRET_KEY（至少32字符）
- [ ] 配置 SSL/TLS 证书
- [ ] 设置防火墙规则
- [ ] 配置 CORS 白名单
- [ ] 启用日志收集
- [ ] 设置自动备份
- [ ] 配置监控告警

### 性能优化

1. **数据库优化**
   - 配置连接池
   - 添加适当索引
   - 定期 VACUUM

2. **缓存策略**
   - Redis 缓存热点数据
   - Nginx 缓存静态资源
   - CDN 加速

3. **负载均衡**
   - 多实例部署
   - 读写分离
   - 分布式缓存

### 监控和日志

推荐工具：
- Prometheus + Grafana（监控）
- ELK Stack（日志收集）
- Sentry（错误追踪）

## 🐛 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   sudo lsof -i :3000
   sudo lsof -i :8000
   
   # 修改 docker-compose.yml 中的端口映射
   ```

2. **服务无法启动**
   ```bash
   # 查看详细日志
   docker-compose logs backend
   
   # 检查配置文件
   docker-compose config
   ```

3. **数据库连接失败**
   ```bash
   # 检查数据库状态
   docker-compose exec postgres pg_isready
   
   # 检查连接信息
   docker-compose exec backend env | grep DATABASE
   ```

4. **内存不足**
   ```bash
   # 限制容器内存
   # 在 docker-compose.yml 中添加：
   # deploy:
   #   resources:
   #     limits:
   #       memory: 512M
   ```

## 📚 开发指南

### 本地开发

1. 前端开发
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. 后端开发
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

### 热重载

开发模式下，代码修改会自动重载：
- 前端：Next.js 自动热重载
- 后端：使用 `--reload` 标志启动

### 调试

1. 前端调试：浏览器开发者工具
2. 后端调试：
   ```bash
   docker-compose exec backend python -m pdb
   ```

## 🔄 更新和迁移

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并部署
./deploy.sh
```

### 数据迁移

```bash
# 备份数据
docker-compose exec postgres pg_dump -U zishu zishu_community > backup_$(date +%Y%m%d).sql

# 运行迁移脚本（根据后端框架）
docker-compose exec backend python manage.py migrate
```

## 📞 支持

如有问题，请：
1. 查看日志文件
2. 检查配置文件
3. 参考故障排查部分
4. 提交 Issue

## 📄 许可证

[添加许可证信息]

## 🙏 致谢

- Next.js
- FastAPI
- PostgreSQL
- Redis
- Nginx
- Docker


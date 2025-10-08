# Zishu-sensei Docker开发环境指南

本指南将帮助您快速搭建和使用Zishu-sensei的Docker开发环境。

## 🚀 快速开始

### 1. 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 8GB 可用内存
- 至少 20GB 可用磁盘空间

### 2. 一键启动

```bash
# 初始化开发环境
./scripts/dev-docker.sh setup

# 启动所有服务
./scripts/dev-docker.sh start-all

# 查看访问信息
./scripts/dev-docker.sh info
```

## 📋 服务架构

### 核心服务

| 服务 | 端口 | 描述 | 访问地址 |
|------|------|------|----------|
| API服务 | 8000 | FastAPI后端服务 | http://localhost:8000 |
| PostgreSQL | 5432 | 主数据库 | localhost:5432 |
| Redis | 6379 | 缓存和会话存储 | localhost:6379 |
| Qdrant | 6333 | 向量数据库 | http://localhost:6333 |

### 开发工具

| 工具 | 端口 | 描述 | 访问地址 |
|------|------|------|----------|
| Jupyter Lab | 8888 | 数据科学和实验环境 | http://localhost:8888 |
| pgAdmin | 5050 | 数据库管理工具 | http://localhost:5050 |
| Redis Commander | 8081 | Redis管理工具 | http://localhost:8081 |
| MailHog | 8025 | 邮件测试工具 | http://localhost:8025 |

## 🛠️ 开发工作流

### 启动开发环境

```bash
# 方式1: 分步启动
./scripts/dev-docker.sh start      # 启动核心服务
./scripts/dev-docker.sh start-tools # 启动开发工具

# 方式2: 一次性启动所有服务
./scripts/dev-docker.sh start-all
```

### 代码开发

1. **API开发**: 代码保存后会自动重载，无需重启容器
2. **数据库操作**: 使用pgAdmin进行可视化管理
3. **缓存调试**: 使用Redis Commander查看缓存数据
4. **实验开发**: 使用Jupyter Lab进行算法实验

### 查看日志

```bash
# 查看所有服务日志
./scripts/dev-docker.sh logs

# 查看特定服务日志
./scripts/dev-docker.sh logs api
./scripts/dev-docker.sh logs db
./scripts/dev-docker.sh logs redis
```

### 进入容器

```bash
# 进入API容器
./scripts/dev-docker.sh shell api

# 进入数据库
./scripts/dev-docker.sh shell db

# 进入Redis
./scripts/dev-docker.sh shell redis

# 进入Jupyter容器
./scripts/dev-docker.sh shell jupyter
```

## 🔧 配置说明

### 环境变量

开发环境配置文件：`.env.dev`

```bash
# 应用配置
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# 数据库配置
POSTGRES_DB=zishu_dev
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123

# Redis配置
REDIS_PASSWORD=zishu123

# API配置
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
```

### 数据持久化

开发环境使用以下数据卷：

- `postgres_dev_data`: PostgreSQL数据
- `redis_dev_data`: Redis数据
- `qdrant_dev_data`: Qdrant向量数据
- `jupyter_dev_data`: Jupyter配置和笔记本

### 热重载配置

API服务配置了热重载，以下目录的更改会自动重启服务：

- `./zishu/` - 源代码目录
- `./config/` - 配置文件目录

## 📊 开发工具使用

### Jupyter Lab

**访问**: http://localhost:8888 (token: dev-token)

**功能特性**:
- 预装数据科学库 (pandas, numpy, matplotlib, seaborn)
- 预装机器学习库 (scikit-learn, transformers)
- 集成Git扩展
- 代码格式化工具 (black, isort)
- LSP支持 (代码补全和类型检查)

**使用示例**:
```python
# 在Jupyter中连接到开发数据库
import psycopg2
conn = psycopg2.connect(
    host="postgres-dev",
    database="zishu_dev", 
    user="zishu",
    password="zishu123"
)
```

### pgAdmin

**访问**: http://localhost:5050
**登录**: admin@zishu.dev / admin

**连接数据库**:
- Host: postgres-dev
- Port: 5432
- Database: zishu_dev
- Username: zishu
- Password: zishu123

### Redis Commander

**访问**: http://localhost:8081

自动连接到开发Redis实例，可以：
- 查看所有键值对
- 实时监控Redis操作
- 执行Redis命令

### MailHog

**访问**: http://localhost:8025

用于测试邮件发送功能：
- SMTP服务器: mailhog-dev:1025
- Web界面查看发送的邮件
- 支持邮件预览和调试

## 🐛 调试技巧

### API调试

1. **查看API文档**: http://localhost:8000/docs
2. **健康检查**: http://localhost:8000/health
3. **实时日志**: `./scripts/dev-docker.sh logs api`

### 数据库调试

```bash
# 进入数据库命令行
./scripts/dev-docker.sh shell db

# 在数据库中执行SQL
\dt                    # 列出所有表
\d table_name         # 查看表结构
SELECT * FROM users;  # 查询数据
```

### 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看服务状态
./scripts/dev-docker.sh status

# 健康检查
./scripts/dev-docker.sh health
```

## 🔄 常见操作

### 重启服务

```bash
# 重启所有服务
./scripts/dev-docker.sh restart

# 重启特定服务
docker-compose -f docker-compose.dev.yml restart zishu-api-dev
```

### 更新镜像

```bash
# 重新构建镜像
./scripts/dev-docker.sh build

# 拉取最新基础镜像
docker-compose -f docker-compose.dev.yml pull
```

### 清理环境

```bash
# 停止所有服务
./scripts/dev-docker.sh stop

# 清理所有资源（包括数据卷）
./scripts/dev-docker.sh cleanup
```

### 数据库操作

```bash
# 备份数据库
docker exec zishu-postgres-dev pg_dump -U zishu zishu_dev > backup.sql

# 恢复数据库
docker exec -i zishu-postgres-dev psql -U zishu zishu_dev < backup.sql

# 重置数据库（清空所有数据）
docker-compose -f docker-compose.dev.yml down -v
docker volume rm zishu_postgres_dev_data
./scripts/dev-docker.sh start
```

## 🚨 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :8000
   
   # 修改docker-compose.dev.yml中的端口映射
   ```

2. **容器启动失败**
   ```bash
   # 查看详细错误信息
   ./scripts/dev-docker.sh logs [service-name]
   
   # 检查容器状态
   docker-compose -f docker-compose.dev.yml ps
   ```

3. **数据库连接失败**
   ```bash
   # 检查数据库是否启动
   docker-compose -f docker-compose.dev.yml ps postgres-dev
   
   # 查看数据库日志
   ./scripts/dev-docker.sh logs db
   ```

4. **热重载不工作**
   - 检查文件权限
   - 确认代码目录正确挂载
   - 重启API服务

### 性能优化

1. **增加Docker内存限制**
   ```bash
   # 在Docker Desktop中增加内存分配
   # 推荐至少8GB内存
   ```

2. **使用SSD存储**
   - 将项目放在SSD上
   - 配置Docker使用SSD存储

3. **优化文件监控**
   ```bash
   # Linux系统增加inotify限制
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## 📚 进阶使用

### 自定义配置

1. **修改服务配置**: 编辑 `docker-compose.dev.yml`
2. **添加环境变量**: 编辑 `.env.dev`
3. **自定义Jupyter**: 修改 `docker/jupyter/jupyter_lab_config.py`

### 集成IDE

#### VS Code集成

1. 安装Docker扩展
2. 使用Remote-Containers连接到开发容器
3. 配置调试器连接到容器内的Python进程

#### PyCharm集成

1. 配置Docker解释器
2. 设置远程调试
3. 配置数据库连接

### CI/CD集成

开发环境可以用于：
- 自动化测试
- 代码质量检查
- 集成测试环境

## 🤝 贡献指南

如果您想改进开发环境：

1. Fork项目
2. 创建功能分支
3. 测试您的更改
4. 提交Pull Request

## 📞 获取帮助

- 查看日志: `./scripts/dev-docker.sh logs`
- 健康检查: `./scripts/dev-docker.sh health`
- 显示帮助: `./scripts/dev-docker.sh help`

---

**提示**: 首次启动可能需要较长时间来下载镜像，请耐心等待。建议使用国内Docker镜像源加速下载。

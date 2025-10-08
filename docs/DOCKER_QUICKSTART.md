# Zishu-sensei Docker开发环境快速开始

这是一个完整的Docker开发环境，包含所有必要的服务和开发工具。

## 🚀 一键启动

### Windows用户

```powershell
# 初始化开发环境
.\scripts\dev-docker.ps1 setup

# 启动所有服务
.\scripts\dev-docker.ps1 start-all

# 查看访问信息
.\scripts\dev-docker.ps1 info
```

### Linux/macOS用户

```bash
# 初始化开发环境
./scripts/dev-docker.sh setup

# 启动所有服务
./scripts/dev-docker.sh start-all

# 查看访问信息
./scripts/dev-docker.sh info
```

### 使用Makefile（跨平台）

```bash
# 初始化Docker开发环境
make docker-dev-setup

# 启动Docker开发环境
make docker-dev-start

# 查看服务状态
make docker-dev-status
```

## 📊 服务访问地址

启动成功后，您可以访问以下服务：

| 服务 | 地址 | 用途 |
|------|------|------|
| **API服务** | http://localhost:8000 | 主要API接口 |
| **API文档** | http://localhost:8000/docs | Swagger文档 |
| **Jupyter Lab** | http://localhost:8888 | 数据科学和实验 |
| **pgAdmin** | http://localhost:5050 | 数据库管理 |
| **Redis Commander** | http://localhost:8081 | Redis管理 |
| **MailHog** | http://localhost:8025 | 邮件测试 |

### 登录信息

- **Jupyter Lab**: token: `dev-token`
- **pgAdmin**: admin@zishu.dev / admin
- **数据库**: zishu / zishu123
- **Redis**: password: zishu123

## 🛠️ 常用命令

### 服务管理

```bash
# Windows
.\scripts\dev-docker.ps1 start-all    # 启动所有服务
.\scripts\dev-docker.ps1 stop         # 停止所有服务
.\scripts\dev-docker.ps1 restart      # 重启所有服务
.\scripts\dev-docker.ps1 status       # 查看服务状态

# Linux/macOS
./scripts/dev-docker.sh start-all     # 启动所有服务
./scripts/dev-docker.sh stop          # 停止所有服务
./scripts/dev-docker.sh restart       # 重启所有服务
./scripts/dev-docker.sh status        # 查看服务状态
```

### 日志查看

```bash
# 查看所有服务日志
.\scripts\dev-docker.ps1 logs         # Windows
./scripts/dev-docker.sh logs          # Linux/macOS

# 查看特定服务日志
.\scripts\dev-docker.ps1 logs api     # API服务日志
.\scripts\dev-docker.ps1 logs db      # 数据库日志
```

### 进入容器

```bash
# 进入API容器
.\scripts\dev-docker.ps1 shell api    # Windows
./scripts/dev-docker.sh shell api     # Linux/macOS

# 进入数据库
.\scripts\dev-docker.ps1 shell db     # Windows
./scripts/dev-docker.sh shell db      # Linux/macOS
```

### 健康检查

```bash
# 检查所有服务健康状态
.\scripts\dev-docker.ps1 health       # Windows
./scripts/dev-docker.sh health        # Linux/macOS
```

## 🔧 开发工作流

### 1. API开发

- 代码保存后自动重载，无需重启容器
- 访问 http://localhost:8000/docs 查看API文档
- 日志实时显示在终端

### 2. 数据库操作

- 使用pgAdmin (http://localhost:5050) 进行可视化管理
- 或直接进入数据库容器执行SQL命令

### 3. 缓存调试

- 使用Redis Commander (http://localhost:8081) 查看缓存数据
- 或进入Redis容器执行命令

### 4. 实验开发

- 使用Jupyter Lab (http://localhost:8888) 进行算法实验
- 预装了常用的数据科学和机器学习库

### 5. 邮件测试

- 使用MailHog (http://localhost:8025) 测试邮件发送功能
- 所有发送的邮件都会被拦截并显示在Web界面

## 📁 目录结构

```
zishu-sensei/
├── docker-compose.dev.yml          # 开发环境配置
├── .env.dev                        # 开发环境变量
├── scripts/
│   ├── dev-docker.sh               # Linux/macOS脚本
│   └── dev-docker.ps1              # Windows脚本
├── docker/
│   ├── Dockerfile.api.china        # API镜像（国内优化）
│   ├── Dockerfile.jupyter          # Jupyter镜像
│   ├── postgres/
│   │   └── 01-init-db.sql          # 数据库初始化脚本
│   └── jupyter/
│       └── jupyter_lab_config.py   # Jupyter配置
├── data/                           # 数据目录（持久化）
├── logs/                           # 日志目录
├── cache/                          # 缓存目录
├── notebooks/                      # Jupyter笔记本
└── models/                         # 模型文件
```

## 🚨 故障排除

### 常见问题

1. **端口被占用**
   - 检查端口占用：`netstat -tulpn | grep :8000`
   - 修改docker-compose.dev.yml中的端口映射

2. **容器启动失败**
   - 查看日志：`.\scripts\dev-docker.ps1 logs [service-name]`
   - 检查Docker是否运行

3. **数据库连接失败**
   - 等待数据库完全启动（约10-15秒）
   - 检查数据库容器状态

4. **热重载不工作**
   - 确认代码目录正确挂载
   - 重启API服务

### 清理和重置

```bash
# 停止所有服务
.\scripts\dev-docker.ps1 stop        # Windows
./scripts/dev-docker.sh stop         # Linux/macOS

# 清理所有资源（包括数据）
.\scripts\dev-docker.ps1 cleanup     # Windows
./scripts/dev-docker.sh cleanup      # Linux/macOS
```

## 📚 更多信息

- 详细文档：[docs/DOCKER_DEV_GUIDE.md](docs/DOCKER_DEV_GUIDE.md)
- 项目主页：[README.md](README.md)
- 问题反馈：GitHub Issues

---

**提示**: 首次启动需要下载镜像，可能需要较长时间。建议使用国内Docker镜像源加速下载。

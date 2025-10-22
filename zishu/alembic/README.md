# 数据库迁移指南

本目录包含紫舒AI项目的数据库迁移文件，使用Alembic进行版本管理。

## 目录结构

```
alembic/
├── alembic.ini          # Alembic配置文件
├── env.py               # 迁移环境配置
├── script.py.mako       # 迁移文件模板
├── versions/            # 迁移版本文件目录
│   └── 10967fd178d8_initial_database_schema_with_all_models.py
└── README.md            # 本文档
```

## 快速开始

### 1. 确保数据库服务运行

```bash
# 启动PostgreSQL数据库
sudo docker compose up -d postgres
```

### 2. 应用迁移

使用提供的脚本（推荐）：

```bash
# 从项目根目录运行
./scripts/run_migrations.sh upgrade
```

或直接使用alembic命令：

```bash
# 设置数据库连接
export DATABASE_URL="postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"

# 应用所有迁移
python3 -m alembic --config zishu/alembic/alembic.ini upgrade head
```

## 常用命令

### 查看当前数据库版本

```bash
./scripts/run_migrations.sh current
```

### 查看迁移历史

```bash
./scripts/run_migrations.sh history
```

### 创建新的迁移

```bash
# 自动检测模型变更并生成迁移
./scripts/run_migrations.sh create "描述你的变更"

# 例如：
./scripts/run_migrations.sh create "添加用户头像字段"
```

### 回退迁移

```bash
# 回退最近一次迁移
./scripts/run_migrations.sh downgrade

# 回退到特定版本
python3 -m alembic --config zishu/alembic/alembic.ini downgrade <revision_id>
```

## 手动使用Alembic

如果需要更精细的控制，可以直接使用alembic命令：

```bash
# 设置环境变量
export DATABASE_URL="postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"
cd /opt/zishu-sensei

# 查看帮助
python3 -m alembic --config zishu/alembic/alembic.ini --help

# 升级到最新版本
python3 -m alembic --config zishu/alembic/alembic.ini upgrade head

# 升级一个版本
python3 -m alembic --config zishu/alembic/alembic.ini upgrade +1

# 降级一个版本
python3 -m alembic --config zishu/alembic/alembic.ini downgrade -1

# 查看SQL而不执行
python3 -m alembic --config zishu/alembic/alembic.ini upgrade head --sql

# 显示当前版本
python3 -m alembic --config zishu/alembic/alembic.ini current

# 显示迁移历史
python3 -m alembic --config zishu/alembic/alembic.ini history

# 创建空白迁移（手动编写）
python3 -m alembic --config zishu/alembic/alembic.ini revision -m "描述"

# 自动生成迁移（推荐）
python3 -m alembic --config zishu/alembic/alembic.ini revision --autogenerate -m "描述"
```

## 环境配置

### 开发环境

使用localhost连接：

```bash
export DATABASE_URL="postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"
```

### Docker环境

使用服务名连接：

```bash
export DATABASE_URL="postgresql+asyncpg://zishu:zishu_secure_2025@postgres:5432/zishu"
```

## 数据库架构

当前迁移包含41个表：

### 核心表
- `users` - 用户基础信息
- `user_profiles` - 用户详细资料
- `user_sessions` - 用户会话
- `user_preferences` - 用户偏好设置
- `user_permissions` - 用户权限

### 适配器管理
- `adapters` - 适配器基础信息
- `adapter_categories` - 适配器分类
- `adapter_versions` - 适配器版本
- `adapter_dependencies` - 适配器依赖
- `adapter_downloads` - 下载统计
- `adapter_ratings` - 评分数据

### 角色系统
- `characters` - 角色基础信息
- `character_models` - 角色模型
- `character_voices` - 角色语音
- `character_expressions` - 角色表情
- `character_personalities` - 角色性格

### 对话系统
- `conversations` - 对话会话
- `messages` - 对话消息
- `message_attachments` - 消息附件
- `conversation_contexts` - 对话上下文
- `conversation_participants` - 对话参与者

### 工作流
- `workflows` - 工作流
- `workflow_templates` - 工作流模板
- `workflow_nodes` - 工作流节点
- `workflow_edges` - 工作流边
- `workflow_executions` - 工作流执行记录

### 文件管理
- `files` - 文件信息
- `file_versions` - 文件版本
- `file_permissions` - 文件权限
- `file_shares` - 文件分享

### 打包系统
- `package_templates` - 打包模板
- `packaging_tasks` - 打包任务
- `build_artifacts` - 构建产物
- `build_logs` - 构建日志

### 社区功能
- `forums` - 论坛版块
- `topics` - 话题
- `posts` - 帖子
- `comments` - 评论
- `likes` - 点赞
- `follows` - 关注

## 最佳实践

### 1. 创建迁移前

- 确保所有模型定义正确
- 检查字段约束和索引
- 运行测试确保代码无误

### 2. 迁移文件审查

- 仔细检查自动生成的迁移
- 验证字段类型和约束
- 检查索引创建是否合理
- 确保降级操作可行

### 3. 应用迁移

- 在开发环境先测试
- 备份生产数据库
- 在维护窗口执行
- 监控迁移过程

### 4. 版本控制

- 将迁移文件提交到git
- 不要修改已应用的迁移
- 使用描述性的迁移消息

## 故障排除

### 连接失败

检查数据库是否运行：
```bash
sudo docker compose ps postgres
```

检查连接信息是否正确：
```bash
echo $DATABASE_URL
```

### 迁移冲突

如果出现"branches"或多头问题：
```bash
# 查看当前状态
python3 -m alembic --config zishu/alembic/alembic.ini heads

# 合并分支
python3 -m alembic --config zishu/alembic/alembic.ini merge heads -m "合并分支"
```

### 降级失败

某些操作可能无法降级（如删除列）。始终在测试环境验证降级操作。

## 进一步阅读

- [Alembic官方文档](https://alembic.sqlalchemy.org/)
- [SQLAlchemy ORM文档](https://docs.sqlalchemy.org/)
- [PostgreSQL文档](https://www.postgresql.org/docs/)

## 维护信息

- 初始迁移创建时间: 2025-10-22
- 迁移版本: 10967fd178d8
- 数据库版本: PostgreSQL 15
- Python版本: 3.12
- SQLAlchemy版本: 2.0+
- Alembic版本: 1.13+


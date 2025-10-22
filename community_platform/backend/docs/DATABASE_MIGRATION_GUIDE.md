# 📊 数据库迁移指南

本指南详细说明如何使用 Alembic 进行数据库迁移管理。

## 📋 目录

1. [快速开始](#快速开始)
2. [迁移命令](#迁移命令)
3. [常见场景](#常见场景)
4. [最佳实践](#最佳实践)
5. [故障排除](#故障排除)

---

## 🚀 快速开始

### 方式 1: 使用 Makefile（推荐）

```bash
# 查看所有可用命令
make help

# 创建初始迁移
make init-migration

# 应用迁移到数据库
make upgrade

# 查看当前版本
make current
```

### 方式 2: 使用 Python 脚本

```bash
# 创建初始迁移
python scripts/migrate.py init

# 应用迁移
python scripts/migrate.py upgrade

# 查看当前版本
python scripts/migrate.py current
```

### 方式 3: 直接使用 Alembic

```bash
# 创建迁移
alembic revision --autogenerate -m "Initial migration"

# 应用迁移
alembic upgrade head

# 查看当前版本
alembic current
```

---

## 📝 迁移命令

### 1. 创建迁移

#### 初始迁移（首次）

```bash
# 使用 Makefile
make init-migration

# 使用脚本
python scripts/migrate.py init

# 使用 Alembic
alembic revision --autogenerate -m "Initial migration"
```

#### 后续迁移

```bash
# 使用 Makefile
make migrate

# 使用脚本（会提示输入消息）
python scripts/migrate.py migrate

# 使用脚本（直接指定消息）
python scripts/migrate.py migrate "Add user profile fields"

# 使用 Alembic
alembic revision --autogenerate -m "Add user profile fields"
```

### 2. 应用迁移

#### 升级到最新版本

```bash
# 使用 Makefile
make upgrade

# 使用脚本
python scripts/migrate.py upgrade

# 使用 Alembic
alembic upgrade head
```

#### 升级到特定版本

```bash
# 使用脚本
python scripts/migrate.py upgrade abc123

# 使用 Alembic
alembic upgrade abc123
```

#### 升级一个版本

```bash
# 使用 Alembic
alembic upgrade +1
```

### 3. 回滚迁移

#### 降级一个版本

```bash
# 使用 Makefile
make downgrade

# 使用脚本
python scripts/migrate.py downgrade

# 使用 Alembic
alembic downgrade -1
```

#### 降级到特定版本

```bash
# 使用脚本
python scripts/migrate.py downgrade abc123

# 使用 Alembic
alembic downgrade abc123
```

#### 回滚所有迁移

```bash
# 使用 Alembic
alembic downgrade base
```

### 4. 查看信息

#### 查看当前版本

```bash
# 使用 Makefile
make current

# 使用脚本
python scripts/migrate.py current

# 使用 Alembic
alembic current
```

#### 查看迁移历史

```bash
# 使用 Makefile
make history

# 使用脚本
python scripts/migrate.py history

# 使用 Alembic
alembic history
```

#### 查看头版本

```bash
# 使用脚本
python scripts/migrate.py heads

# 使用 Alembic
alembic heads
```

### 5. 高级操作

#### 重置数据库

```bash
# 使用 Makefile（需要确认）
make reset

# 使用脚本（需要输入 'RESET' 确认）
python scripts/migrate.py reset
```

#### 标记版本（不运行迁移）

```bash
# 使用脚本
python scripts/migrate.py stamp head

# 使用 Alembic
alembic stamp head
```

---

## 📚 常见场景

### 场景 1: 首次设置数据库

```bash
# 1. 确保数据库服务运行
docker-compose up -d postgres

# 2. 创建初始迁移
make init-migration

# 3. 应用迁移
make upgrade

# 4. 验证
make current
```

### 场景 2: 添加新表或字段

```bash
# 1. 修改模型文件（如 app/models/user.py）
# 2. 创建迁移
make migrate
# 或指定消息
python scripts/migrate.py migrate "Add bio field to User model"

# 3. 检查生成的迁移文件
cat alembic/versions/最新文件.py

# 4. 应用迁移
make upgrade
```

### 场景 3: 修改现有字段

```bash
# 1. 修改模型文件
# 2. 创建迁移
python scripts/migrate.py migrate "Change username max length to 100"

# 3. 检查并手动调整迁移文件（如果需要）
vim alembic/versions/最新文件.py

# 4. 应用迁移
make upgrade

# 5. 如果有问题，可以回滚
make downgrade
```

### 场景 4: 数据迁移

有时需要在迁移中转换数据：

```python
# alembic/versions/xxx_migrate_user_data.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. 先添加新列
    op.add_column('users', sa.Column('new_field', sa.String(100)))
    
    # 2. 迁移数据
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE users SET new_field = old_field WHERE old_field IS NOT NULL")
    )
    
    # 3. 删除旧列（可选）
    # op.drop_column('users', 'old_field')

def downgrade():
    # 回滚逻辑
    op.drop_column('users', 'new_field')
```

### 场景 5: 生产环境部署

```bash
# 1. 备份数据库
pg_dump -U zishu -d zishu_community > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 查看待应用的迁移
alembic history

# 3. 应用迁移
make upgrade

# 4. 验证
make current

# 5. 如果出错，回滚
make downgrade
```

---

## ✅ 最佳实践

### 1. 迁移命名规范

使用描述性的名称：

```bash
# ✅ 好的例子
python scripts/migrate.py migrate "Add email verification fields to User"
python scripts/migrate.py migrate "Create post_tags association table"
python scripts/migrate.py migrate "Add index on posts.created_at"

# ❌ 避免
python scripts/migrate.py migrate "update"
python scripts/migrate.py migrate "changes"
```

### 2. 检查生成的迁移

**始终**检查自动生成的迁移文件：

```bash
# 创建迁移后
cat alembic/versions/最新文件.py

# 检查以下内容：
# - 是否包含预期的更改
# - 是否有意外的更改
# - downgrade 函数是否正确
# - 是否需要数据迁移
```

### 3. 小步迭代

将大的更改分解为小的迁移：

```bash
# ✅ 好的方式
python scripts/migrate.py migrate "Add verified_email column"
python scripts/migrate.py migrate "Add email_verification_token column"
python scripts/migrate.py migrate "Add email_verification_sent_at column"

# ❌ 避免一次性大改
python scripts/migrate.py migrate "Add all email verification stuff"
```

### 4. 测试迁移

在开发环境测试迁移：

```bash
# 1. 应用迁移
make upgrade

# 2. 测试应用功能
python main.py

# 3. 测试回滚
make downgrade

# 4. 再次应用
make upgrade
```

### 5. 版本控制

- ✅ **提交**迁移文件到 Git
- ✅ **不提交** `alembic/versions/__pycache__`
- ✅ 在 PR 中说明迁移内容

### 6. 生产环境注意事项

- 🔒 **始终**在部署前备份数据库
- 🔍 **审查**迁移脚本
- 📊 **评估**对生产数据的影响
- ⏱️ **考虑**大表的迁移时间
- 🚦 **计划**维护窗口

---

## 🔧 故障排除

### 问题 1: "Target database is not up to date"

**原因**: 数据库版本与代码不一致

**解决方案**:

```bash
# 查看当前版本
alembic current

# 查看所有版本
alembic history

# 升级到最新
make upgrade
```

### 问题 2: 自动生成的迁移为空

**原因**: Alembic 没有检测到模型更改

**解决方案**:

```bash
# 1. 确保导入了所有模型
# 检查 alembic/env.py 中的导入

# 2. 确保模型继承了 Base
# 检查 app/models/*.py

# 3. 手动创建迁移
alembic revision -m "Manual migration"
```

### 问题 3: 迁移冲突

**原因**: 多个分支创建了迁移

**解决方案**:

```bash
# 1. 查看头版本
alembic heads

# 2. 合并头版本
alembic merge -m "Merge migrations" head1 head2

# 3. 应用合并的迁移
make upgrade
```

### 问题 4: 无法连接数据库

**原因**: 数据库服务未运行或配置错误

**解决方案**:

```bash
# 1. 检查数据库服务
docker-compose ps

# 2. 启动数据库
docker-compose up -d postgres

# 3. 检查环境变量
cat .env | grep POSTGRES

# 4. 测试连接
python -c "from app.core.config.settings import settings; print(settings.DATABASE_URL)"
```

### 问题 5: 迁移执行缓慢

**原因**: 大表数据迁移

**解决方案**:

```python
# 批量处理数据
def upgrade():
    connection = op.get_bind()
    
    # 分批更新（每次 1000 条）
    offset = 0
    batch_size = 1000
    
    while True:
        result = connection.execute(
            sa.text(f"""
                UPDATE users 
                SET new_field = old_field 
                WHERE id IN (
                    SELECT id FROM users 
                    WHERE new_field IS NULL 
                    LIMIT {batch_size}
                )
            """)
        )
        if result.rowcount == 0:
            break
```

### 问题 6: downgrade 失败

**原因**: downgrade 函数不正确

**解决方案**:

```bash
# 1. 检查迁移文件的 downgrade 函数
cat alembic/versions/xxx.py

# 2. 手动修复
vim alembic/versions/xxx.py

# 3. 或者标记为已应用（危险！）
alembic stamp head-1
```

---

## 📖 配置文件说明

### alembic.ini

主配置文件，包含：
- 迁移脚本位置
- 文件模板格式
- 日志配置

### alembic/env.py

环境配置文件，包含：
- 数据库连接配置
- 模型导入
- 迁移运行逻辑
- 支持异步操作

### 迁移文件结构

```python
"""Migration message

Revision ID: abc123def456
Revises: previous_revision
Create Date: 2025-10-22 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'abc123def456'
down_revision = 'previous_revision'
branch_labels = None
depends_on = None

def upgrade():
    # 升级逻辑
    pass

def downgrade():
    # 降级逻辑
    pass
```

---

## 🔗 相关资源

- [Alembic 官方文档](https://alembic.sqlalchemy.org/)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

---

## 📞 获取帮助

如果遇到问题：

1. 查看本指南的故障排除部分
2. 检查 Alembic 日志输出
3. 查看迁移文件内容
4. 联系开发团队

---

**最后更新**: 2025-10-22
**版本**: 1.0.0


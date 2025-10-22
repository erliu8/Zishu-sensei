# 🚀 数据库迁移快速开始

## 📖 5 分钟上手指南

### 1️⃣ 首次设置（新项目）

```bash
# 方式 A: 一键设置（推荐）
bash scripts/setup_database.sh

# 方式 B: 手动步骤
# 1. 启动数据库
docker-compose up -d postgres

# 2. 创建初始迁移
make init-migration
# 或
python scripts/migrate.py init

# 3. 应用迁移
make upgrade
# 或
python scripts/migrate.py upgrade
```

### 2️⃣ 日常开发（修改模型后）

```bash
# 1. 修改模型文件（例如：app/models/user.py）
# 添加新字段或修改现有字段

# 2. 创建迁移
make migrate
# 或指定消息
python scripts/migrate.py migrate "Add bio field to User model"

# 3. 应用迁移
make upgrade
```

### 3️⃣ 查看状态

```bash
# 查看当前版本
make current

# 查看迁移历史
make history

# 查看所有可用命令
make help
```

### 4️⃣ 回滚（如果出错）

```bash
# 回滚上一个版本
make downgrade

# 应用迁移
make upgrade
```

---

## 📝 常用命令速查

| 操作 | Makefile | Python 脚本 | Alembic |
|------|----------|-------------|---------|
| 创建初始迁移 | `make init-migration` | `python scripts/migrate.py init` | `alembic revision --autogenerate -m "message"` |
| 创建迁移 | `make migrate` | `python scripts/migrate.py migrate` | `alembic revision --autogenerate -m "message"` |
| 应用迁移 | `make upgrade` | `python scripts/migrate.py upgrade` | `alembic upgrade head` |
| 回滚迁移 | `make downgrade` | `python scripts/migrate.py downgrade` | `alembic downgrade -1` |
| 查看当前版本 | `make current` | `python scripts/migrate.py current` | `alembic current` |
| 查看历史 | `make history` | `python scripts/migrate.py history` | `alembic history` |
| 重置数据库 | `make reset` | `python scripts/migrate.py reset` | `alembic downgrade base && alembic upgrade head` |

---

## 💡 实际示例

### 示例 1: 给 User 模型添加新字段

```python
# 1. 编辑 app/models/user.py
class User(Base):
    __tablename__ = "users"
    
    # ... 现有字段 ...
    
    # 添加新字段
    phone = Column(String(20))
    bio = Column(Text)
```

```bash
# 2. 创建迁移
python scripts/migrate.py migrate "Add phone and bio to User"

# 3. 查看生成的迁移文件
cat alembic/versions/最新文件.py

# 4. 应用迁移
make upgrade
```

### 示例 2: 修改字段类型

```python
# 1. 编辑 app/models/user.py
class User(Base):
    __tablename__ = "users"
    
    # 修改字段长度
    username = Column(String(100))  # 原来是 String(50)
```

```bash
# 2. 创建迁移
python scripts/migrate.py migrate "Increase username max length to 100"

# 3. 应用迁移
make upgrade
```

### 示例 3: 添加新表

```python
# 1. 创建新模型文件 app/models/tag.py
from app.db.session import Base
from sqlalchemy import Column, Integer, String, DateTime

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

```python
# 2. 更新 app/models/__init__.py
from app.models.tag import Tag

__all__ = [
    # ... 其他模型 ...
    "Tag",
]
```

```bash
# 3. 创建迁移
python scripts/migrate.py migrate "Add Tag model"

# 4. 应用迁移
make upgrade
```

---

## ⚠️ 注意事项

### ✅ 最佳实践

- ✅ **总是检查**生成的迁移文件
- ✅ **测试迁移**在开发环境先测试
- ✅ **备份数据**生产环境迁移前备份
- ✅ **小步迭代**将大改动拆分为小的迁移
- ✅ **描述性命名**使用清晰的迁移消息

### ❌ 避免的错误

- ❌ **不要**直接修改已应用的迁移文件
- ❌ **不要**手动修改 `alembic_version` 表
- ❌ **不要**在生产环境直接运行未测试的迁移
- ❌ **不要**忘记提交迁移文件到 Git
- ❌ **不要**忽略迁移警告和错误

---

## 🔧 故障排除

### 问题 1: "Target database is not up to date"

```bash
# 解决方案：升级数据库
make upgrade
```

### 问题 2: 迁移文件是空的

```bash
# 可能原因：
# 1. 模型没有改变
# 2. 模型没有正确导入

# 检查 alembic/env.py 中是否导入了所有模型
# 检查模型文件是否正确继承 Base
```

### 问题 3: 无法连接数据库

```bash
# 1. 检查数据库是否运行
docker-compose ps

# 2. 启动数据库
docker-compose up -d postgres

# 3. 检查环境变量
echo $POSTGRES_HOST $POSTGRES_USER $POSTGRES_DB
```

---

## 📚 更多信息

- 📖 **完整指南**: 查看 [DATABASE_MIGRATION_GUIDE.md](DATABASE_MIGRATION_GUIDE.md)
- 🔗 **Alembic 文档**: https://alembic.sqlalchemy.org/
- 💻 **项目文档**: [BACKEND_SUMMARY.md](BACKEND_SUMMARY.md)

---

**提示**: 使用 `make help` 查看所有可用命令！


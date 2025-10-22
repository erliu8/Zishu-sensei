# Alembic 数据库迁移

这个目录包含所有的数据库迁移文件。

## 📁 目录结构

```
alembic/
├── README.md           # 本文件
├── env.py             # 环境配置
├── script.py.mako     # 迁移模板
└── versions/          # 迁移版本文件
    ├── 2025_10_22_1030-abc123_initial_migration.py
    ├── 2025_10_22_1130-def456_add_user_bio.py
    └── ...
```

## 🚀 快速开始

### 创建新迁移

```bash
# 使用 Makefile
make migrate

# 使用 Python 脚本
python scripts/migrate.py migrate "Your migration message"

# 使用 Alembic
alembic revision --autogenerate -m "Your migration message"
```

### 应用迁移

```bash
# 使用 Makefile
make upgrade

# 使用 Python 脚本
python scripts/migrate.py upgrade

# 使用 Alembic
alembic upgrade head
```

## 📝 迁移文件命名

迁移文件自动按以下格式命名：

```
YYYY_MM_DD_HHMM-revision_id_migration_message.py
```

例如：
```
2025_10_22_1030-abc123def456_add_email_verification.py
```

## 🔍 查看迁移信息

```bash
# 当前版本
alembic current

# 迁移历史
alembic history

# 查看特定迁移
cat versions/abc123_migration_name.py
```

## ⚠️ 重要提示

1. **不要修改已应用的迁移文件**
   - 如果需要修改，创建新的迁移

2. **总是检查自动生成的迁移**
   - 确保迁移内容符合预期
   - 检查 upgrade() 和 downgrade() 函数

3. **版本控制**
   - 提交迁移文件到 Git
   - 包含在代码审查中

4. **测试迁移**
   - 先在开发环境测试
   - 测试 upgrade 和 downgrade

## 📚 更多信息

- [完整迁移指南](../DATABASE_MIGRATION_GUIDE.md)
- [快速参考](../MIGRATION_QUICKSTART.md)
- [迁移总结](../MIGRATION_SUMMARY.md)


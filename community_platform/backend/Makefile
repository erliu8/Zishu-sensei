# Makefile for Zishu Community Platform Backend

.PHONY: help install dev migrate upgrade downgrade reset db-init docker-up docker-down test test-unit test-integration test-api test-db test-cov clean clean-test

help:  ## 显示帮助信息
	@echo "可用的命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install:  ## 安装依赖
	pip install -r requirements.txt

dev:  ## 启动开发服务器
	python main.py

# 数据库迁移命令
migrate:  ## 创建新的迁移文件
	python scripts/migrate.py migrate

init-migration:  ## 创建初始迁移
	python scripts/migrate.py init

upgrade:  ## 升级数据库到最新版本
	python scripts/migrate.py upgrade

downgrade:  ## 降级数据库一个版本
	python scripts/migrate.py downgrade

current:  ## 显示当前数据库版本
	python scripts/migrate.py current

history:  ## 显示迁移历史
	python scripts/migrate.py history

reset:  ## 重置数据库（危险！）
	python scripts/migrate.py reset

# Docker 命令
docker-up:  ## 启动所有 Docker 服务
	docker-compose up -d

docker-down:  ## 停止所有 Docker 服务
	docker-compose down

docker-logs:  ## 查看 Docker 日志
	docker-compose logs -f

docker-restart:  ## 重启所有 Docker 服务
	docker-compose restart

# 数据库初始化
db-init:  ## 初始化数据库（创建并应用迁移）
	@echo "初始化数据库..."
	python scripts/migrate.py init
	python scripts/migrate.py upgrade

# 测试命令
test:  ## 运行所有测试
	pytest tests/ -v

test-unit:  ## 运行单元测试
	pytest tests/unit/ -v -m unit

test-integration:  ## 运行集成测试
	pytest tests/integration/ -v -m integration

test-api:  ## 运行 API 测试
	pytest tests/integration/ -v -m api

test-db:  ## 运行数据库测试
	pytest tests/ -v -m db

test-auth:  ## 运行认证测试
	pytest tests/ -v -m auth

test-fast:  ## 运行快速测试（排除慢速测试）
	pytest tests/ -v -m "not slow"

test-slow:  ## 运行慢速测试
	pytest tests/ -v -m slow

test-cov:  ## 运行测试并生成覆盖率报告
	pytest tests/ -v --cov=app --cov-report=html --cov-report=term

test-cov-xml:  ## 生成 XML 覆盖率报告
	pytest tests/ -v --cov=app --cov-report=xml

test-watch:  ## 监视模式运行测试
	pytest-watch tests/ -- -v

test-failed:  ## 只运行上次失败的测试
	pytest tests/ -v --lf

test-parallel:  ## 并行运行测试（需要 pytest-xdist）
	pytest tests/ -v -n auto

test-verbose:  ## 详细输出模式运行测试
	pytest tests/ -vv --tb=long

test-quiet:  ## 安静模式运行测试
	pytest tests/ -q

test-specific:  ## 运行特定测试文件（使用 FILE=路径）
	pytest $(FILE) -v

# 清理命令
clean:  ## 清理临时文件
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.log" -delete
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage
	rm -rf coverage.xml

clean-test:  ## 清理测试相关文件
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage
	rm -rf coverage.xml

# 代码质量
lint:  ## 运行代码检查
	flake8 app/ --max-line-length=120
	black app/ --check

format:  ## 格式化代码
	black app/
	isort app/

# 完整启动流程
setup:  ## 完整设置（安装依赖 + Docker + 数据库迁移）
	@echo "开始完整设置..."
	pip install -r requirements.txt
	docker-compose up -d postgres redis qdrant
	@echo "等待数据库启动..."
	sleep 5
	python scripts/migrate.py init
	python scripts/migrate.py upgrade
	@echo "设置完成！"

# 快速启动
quick-start:  ## 快速启动（Docker + 应用）
	docker-compose up -d
	sleep 3
	python main.py

# 数据库检查
check-db:  ## 检查数据库连接
	python scripts/check_migration.py

check-migration:  ## 检查迁移配置
	python scripts/check_migration.py

# 查看 SQL
show-sql:  ## 显示将要执行的 SQL（不实际执行）
	alembic upgrade head --sql

# 帮助增强
migration-help:  ## 显示迁移相关帮助
	@echo "数据库迁移命令:"
	@echo "  make init-migration  - 创建初始迁移"
	@echo "  make migrate        - 创建新迁移"
	@echo "  make upgrade        - 升级数据库"
	@echo "  make downgrade      - 降级数据库"
	@echo "  make current        - 查看当前版本"
	@echo "  make history        - 查看迁移历史"
	@echo ""
	@echo "更多信息: DATABASE_MIGRATION_GUIDE.md"

test-help:  ## 显示测试相关帮助
	@echo "测试命令:"
	@echo "  make test           - 运行所有测试"
	@echo "  make test-unit      - 运行单元测试"
	@echo "  make test-integration - 运行集成测试"
	@echo "  make test-api       - 运行 API 测试"
	@echo "  make test-db        - 运行数据库测试"
	@echo "  make test-auth      - 运行认证测试"
	@echo "  make test-cov       - 运行测试并生成覆盖率报告"
	@echo "  make test-fast      - 运行快速测试"
	@echo "  make test-parallel  - 并行运行测试"
	@echo ""
	@echo "更多信息: TESTING.md"


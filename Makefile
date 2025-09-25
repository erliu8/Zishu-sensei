# Zishu-sensei Makefile
# Provides convenient commands for development and deployment

.PHONY: help install dev-setup build start stop restart status logs clean test lint format deploy health backup restore

# Default target
help: ## Show this help message
	@echo "Zishu-sensei Development Commands"
	@echo "================================="
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-15s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# Development setup
install: ## Install Python dependencies
	python -m pip install --upgrade pip
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

dev-setup: ## Setup development environment
	./scripts/dev.sh setup

venv: ## Create Python virtual environment
	python3 -m venv venv
	./venv/bin/pip install --upgrade pip
	./venv/bin/pip install -r requirements.txt
	./venv/bin/pip install -r requirements-dev.txt

# Docker commands
build: ## Build Docker images
	./scripts/deploy.sh build

start: ## Start all services
	./scripts/deploy.sh start

stop: ## Stop all services
	./scripts/deploy.sh stop

restart: ## Restart all services
	./scripts/deploy.sh restart

status: ## Show service status
	./scripts/deploy.sh status

logs: ## Show logs for all services
	./scripts/deploy.sh logs

logs-api: ## Show API service logs
	./scripts/deploy.sh logs api

logs-db: ## Show database logs
	./scripts/deploy.sh logs postgres

# Development commands
dev-start: ## Start development services (DB, Redis)
	./scripts/dev.sh start

dev-stop: ## Stop development services
	./scripts/dev.sh stop

dev-api: ## Run API server in development mode
	./scripts/dev.sh api

dev-logs: ## Show development service logs
	./scripts/dev.sh logs

# Database commands
db-migrate: ## Run database migrations
	./scripts/dev.sh db-migrate

db-reset: ## Reset development database
	./scripts/dev.sh db-reset

# Testing and quality
test: ## Run tests
	./scripts/dev.sh test

test-coverage: ## Run tests with coverage report
	python -m pytest tests/ -v --cov=zishu --cov-report=html --cov-report=term

lint: ## Run code linting
	./scripts/dev.sh lint

format: ## Format code
	./scripts/dev.sh format

type-check: ## Run type checking
	mypy zishu/

# Quality checks (run all)
check: lint type-check test ## Run all quality checks

# Production deployment
deploy: ## Full production deployment
	./scripts/deploy.sh deploy

deploy-staging: ## Deploy to staging environment
	ZISHU_ENV=staging ./scripts/deploy.sh deploy

# Health and monitoring
health: ## Run health checks
	./scripts/health-check.sh check

health-report: ## Generate health report
	./scripts/health-check.sh report

# Backup and restore
backup: ## Create data backup
	./scripts/deploy.sh backup

restore: ## Restore data from backup (usage: make restore BACKUP_DIR=/path/to/backup)
	./scripts/deploy.sh restore $(BACKUP_DIR)

# Cleanup
clean: ## Clean up Docker resources
	./scripts/deploy.sh cleanup

clean-cache: ## Clean Python cache files
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache/
	rm -rf .coverage
	rm -rf htmlcov/

clean-all: clean clean-cache ## Clean everything

# Documentation
docs-build: ## Build documentation
	cd docs && make html

docs-serve: ## Serve documentation locally
	cd docs/_build/html && python -m http.server 8080

# Security
security-check: ## Run security checks
	bandit -r zishu/
	safety check

# Performance
profile: ## Run performance profiling
	python -m cProfile -o profile.prof -m zishu.api.server
	python -c "import pstats; pstats.Stats('profile.prof').sort_stats('cumulative').print_stats(20)"

# Container management
shell-api: ## Get shell access to API container
	docker exec -it $$(docker ps -qf "name=api") /bin/bash

shell-db: ## Get shell access to database container
	docker exec -it $$(docker ps -qf "name=postgres") psql -U zishu -d zishu

shell-redis: ## Get shell access to Redis container
	docker exec -it $$(docker ps -qf "name=redis") redis-cli

# Jupyter notebook
jupyter: ## Start Jupyter notebook for development
	cd docker && docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d jupyter
	@echo "Jupyter Lab available at: http://localhost:8888 (token: dev-token)"

# Monitoring
monitor: ## Start monitoring stack (Prometheus + Grafana)
	cd docker && docker-compose --profile monitoring up -d prometheus grafana
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3000 (admin/admin)"

# Development tools
pgadmin: ## Start pgAdmin for database management
	cd docker && docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d pgadmin
	@echo "pgAdmin available at: http://localhost:5050 (admin@zishu.dev/admin)"

redis-ui: ## Start Redis Commander for Redis management
	cd docker && docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d redis-commander
	@echo "Redis Commander available at: http://localhost:8081"

mailhog: ## Start Mailhog for email testing
	cd docker && docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mailhog
	@echo "Mailhog UI available at: http://localhost:8025"

# Environment management
env-create: ## Create environment file from template
	cp docker/env.template docker/.env
	@echo "Environment file created. Please edit docker/.env with your configuration."

env-validate: ## Validate environment configuration
	@echo "Validating environment configuration..."
	@python -c "
import os
from pathlib import Path
env_file = Path('docker/.env')
if not env_file.exists():
    print('❌ Environment file not found')
    exit(1)
required_vars = ['POSTGRES_PASSWORD', 'ZISHU_SECRET_KEY', 'JWT_SECRET']
missing = []
with open(env_file) as f:
    content = f.read()
    for var in required_vars:
        if f'{var}=your-' in content or f'{var}=' not in content:
            missing.append(var)
if missing:
    print(f'❌ Please update these variables: {missing}')
    exit(1)
print('✅ Environment configuration is valid')
"

# Git hooks
hooks-install: ## Install Git hooks
	cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "Git hooks installed"

# Release management
version: ## Show current version
	@python -c "
try:
    from zishu import __version__
    print(f'Current version: {__version__}')
except ImportError:
    print('Version not found')
"

# Quick development workflow
dev: dev-setup dev-start ## Quick start development environment
	@echo "Development environment ready!"
	@echo "Next steps:"
	@echo "  - Run 'make dev-api' to start the API server"
	@echo "  - Run 'make jupyter' to start Jupyter Lab"
	@echo "  - Run 'make pgadmin' to start database management"

# Production workflow
prod: env-validate build deploy ## Full production deployment workflow
	@echo "Production deployment completed!"
	@echo "Run 'make health' to check system status"
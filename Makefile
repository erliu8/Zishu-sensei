.PHONY: help install install-dev test lint format clean build run-api run-desktop

help:  ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install production dependencies
	pip install -e .

install-dev:  ## Install development dependencies
	pip install -e ".[dev,training,desktop,vision,speech]"
	pre-commit install

test:  ## Run tests
	pytest tests/ -v

test-fast:  ## Run fast tests only
	pytest tests/ -v -m "not slow"

lint:  ## Run linting
	flake8 zishu/ tests/
	mypy zishu/

format:  ## Format code
	black zishu/ tests/
	isort zishu/ tests/

clean:  ## Clean build artifacts
	rm -rf build/ dist/ *.egg-info/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build:  ## Build package
	python -m build

# Development servers
run-api:  ## Start API server
	uvicorn zishu.api.main:app --reload --host 0.0.0.0 --port 8000

run-desktop:  ## Start desktop application
	python -m zishu.ui.desktop_app

# Training commands
train-base:  ## Train base model
	python -m zishu.training.train --config training/configs/base_model.yml

train-adapter:  ## Train adapter
	python -m zishu.training.train --config training/configs/adapter.yml

# Data preparation
prepare-data:  ## Prepare training data
	python -m zishu.training.data_preparation

# Model management
download-models:  ## Download required models
	python tools/download_models.py

quantize-model:  ## Quantize model
	python -m zishu.models.quantization

# Docker commands
docker-build:  ## Build Docker image
	docker-compose build

docker-up:  ## Start services with Docker
	docker-compose up -d

docker-down:  ## Stop Docker services
	docker-compose down

# Documentation
docs-serve:  ## Serve documentation locally
	mkdocs serve

docs-build:  ## Build documentation
	mkdocs build

# Environment setup
setup-env:  ## Setup development environment
	python -m venv venv
	. venv/bin/activate && pip install -e ".[dev,training,desktop,vision,speech]"
	. venv/bin/activate && pre-commit install

# Git hooks
pre-commit:  ## Run pre-commit hooks
	pre-commit run --all-files

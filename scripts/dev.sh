#!/bin/bash

# Zishu-sensei Development Environment Script
# This script helps set up and manage the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
ENV_FILE="$DOCKER_DIR/.env.dev"
ENV_TEMPLATE="$DOCKER_DIR/env.template"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking development requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install Python 3 first."
        exit 1
    fi
    
    log_success "Requirements check passed"
}

setup_dev_environment() {
    log_info "Setting up development environment..."
    
    # Create development environment file
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_TEMPLATE" ]; then
            cp "$ENV_TEMPLATE" "$ENV_FILE"
            
            # Update for development
            sed -i 's/ZISHU_ENV=production/ZISHU_ENV=development/' "$ENV_FILE"
            sed -i 's/ZISHU_DEBUG=false/ZISHU_DEBUG=true/' "$ENV_FILE"
            sed -i 's/ZISHU_LOG_LEVEL=INFO/ZISHU_LOG_LEVEL=DEBUG/' "$ENV_FILE"
            sed -i 's/your-secure-postgres-password/dev-password/' "$ENV_FILE"
            sed -i 's/your-redis-password/dev-redis-password/' "$ENV_FILE"
            sed -i 's/your-grafana-admin-password/admin/' "$ENV_FILE"
            
            log_success "Development environment file created: $ENV_FILE"
        else
            log_error "Environment template file not found: $ENV_TEMPLATE"
            exit 1
        fi
    fi
    
    # Create Python virtual environment
    if [ ! -d "$PROJECT_ROOT/venv" ]; then
        log_info "Creating Python virtual environment..."
        cd "$PROJECT_ROOT"
        python3 -m venv venv
        source venv/bin/activate
        
        # Install dependencies if requirements.txt exists
        if [ -f "requirements.txt" ]; then
            pip install -r requirements.txt
        fi
        
        if [ -f "requirements-dev.txt" ]; then
            pip install -r requirements-dev.txt
        fi
        
        log_success "Python virtual environment created"
    fi
    
    log_success "Development environment setup completed"
}

start_dev_services() {
    log_info "Starting development services..."
    
    cd "$DOCKER_DIR"
    
    # Start only essential services for development
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
    fi
    
    log_success "Development services started"
    log_info "Services running:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis: localhost:6379"
}

stop_dev_services() {
    log_info "Stopping development services..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
    fi
    
    log_success "Development services stopped"
}

run_api_dev() {
    log_info "Starting API in development mode..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Set environment variables
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    
    # Run the API with hot reload
    if [ -f "zishu/api/server.py" ]; then
        python -m uvicorn zishu.api.server:app --reload --host 0.0.0.0 --port 8000
    else
        log_error "API server file not found"
        exit 1
    fi
}

run_tests() {
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Set test environment variables
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    export ZISHU_ENV=test
    
    # Run tests
    if command -v pytest &> /dev/null; then
        pytest tests/ -v --cov=zishu --cov-report=html
    elif [ -f "tests/test_runner.py" ]; then
        python tests/test_runner.py
    else
        python -m unittest discover tests/
    fi
    
    log_success "Tests completed"
}

lint_code() {
    log_info "Running code linting..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Run linters
    if command -v black &> /dev/null; then
        log_info "Running Black formatter..."
        black zishu/ tests/ --check --diff
    fi
    
    if command -v flake8 &> /dev/null; then
        log_info "Running Flake8..."
        flake8 zishu/ tests/
    fi
    
    if command -v mypy &> /dev/null; then
        log_info "Running MyPy type checker..."
        mypy zishu/
    fi
    
    if command -v isort &> /dev/null; then
        log_info "Running isort import sorter..."
        isort zishu/ tests/ --check-only --diff
    fi
    
    log_success "Linting completed"
}

format_code() {
    log_info "Formatting code..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Format code
    if command -v black &> /dev/null; then
        log_info "Running Black formatter..."
        black zishu/ tests/
    fi
    
    if command -v isort &> /dev/null; then
        log_info "Running isort import sorter..."
        isort zishu/ tests/
    fi
    
    log_success "Code formatting completed"
}

db_migrate() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Set environment variables
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    
    # Run migrations (adjust based on your migration system)
    if [ -f "alembic.ini" ]; then
        alembic upgrade head
    elif [ -f "zishu/database/migrations.py" ]; then
        python -m zishu.database.migrations
    else
        log_warning "No migration system found"
    fi
    
    log_success "Database migrations completed"
}

db_reset() {
    log_info "Resetting development database..."
    
    cd "$DOCKER_DIR"
    
    # Stop database
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop postgres
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml rm -f postgres
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml stop postgres
        docker compose -f docker-compose.yml -f docker-compose.dev.yml rm -f postgres
    fi
    
    # Remove volume
    docker volume rm zishu_postgres_data_dev 2>/dev/null || true
    
    # Start database
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
    fi
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    db_migrate
    
    log_success "Database reset completed"
}

show_logs() {
    local service=$1
    
    cd "$DOCKER_DIR"
    
    if [ -n "$service" ]; then
        log_info "Showing logs for service: $service"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "$service"
        else
            docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "$service"
        fi
    else
        log_info "Showing logs for all development services:"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
        else
            docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
        fi
    fi
}

show_help() {
    echo "Zishu-sensei Development Environment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Setup Commands:"
    echo "  setup       Setup development environment"
    echo "  start       Start development services (DB, Redis)"
    echo "  stop        Stop development services"
    echo "  api         Run API server in development mode"
    echo ""
    echo "Development Commands:"
    echo "  test        Run tests"
    echo "  lint        Run code linting"
    echo "  format      Format code"
    echo ""
    echo "Database Commands:"
    echo "  db-migrate  Run database migrations"
    echo "  db-reset    Reset development database"
    echo ""
    echo "Utility Commands:"
    echo "  logs [svc]  Show logs (optionally for specific service)"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # First time setup"
    echo "  $0 start     # Start dev services"
    echo "  $0 api       # Run API server"
    echo "  $0 test      # Run tests"
}

# Main script logic
case "${1:-}" in
    setup)
        check_requirements
        setup_dev_environment
        log_success "Development environment setup completed!"
        echo ""
        log_info "Next steps:"
        echo "  1. Update $ENV_FILE with your API keys"
        echo "  2. Run '$0 start' to start development services"
        echo "  3. Run '$0 api' to start the API server"
        ;;
    start)
        start_dev_services
        ;;
    stop)
        stop_dev_services
        ;;
    api)
        run_api_dev
        ;;
    test)
        run_tests
        ;;
    lint)
        lint_code
        ;;
    format)
        format_code
        ;;
    db-migrate)
        db_migrate
        ;;
    db-reset)
        db_reset
        ;;
    logs)
        show_logs "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac

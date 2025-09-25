#!/bin/bash

# Zishu-sensei Docker Deployment Script
# This script helps deploy and manage the Zishu-sensei application using Docker Compose

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
ENV_FILE="$DOCKER_DIR/.env"
ENV_TEMPLATE="$DOCKER_DIR/env.template"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"

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
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Requirements check passed"
}

setup_environment() {
    log_info "Setting up environment..."
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_TEMPLATE" ]; then
            log_warning "Environment file not found. Copying from template..."
            cp "$ENV_TEMPLATE" "$ENV_FILE"
            log_warning "Please edit $ENV_FILE with your actual configuration values"
            log_warning "Especially update the following:"
            echo "  - Database passwords"
            echo "  - API keys (OpenAI, etc.)"
            echo "  - JWT secrets"
            echo "  - Grafana admin password"
            read -p "Press Enter to continue after updating the environment file..."
        else
            log_error "Environment template file not found: $ENV_TEMPLATE"
            exit 1
        fi
    fi
    
    log_success "Environment setup completed"
}

build_images() {
    log_info "Building Docker images..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose build --no-cache
    else
        docker compose build --no-cache
    fi
    
    log_success "Images built successfully"
}

start_services() {
    log_info "Starting services..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi
    
    log_success "Services started successfully"
}

stop_services() {
    log_info "Stopping services..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        docker compose down
    fi
    
    log_success "Services stopped successfully"
}

restart_services() {
    log_info "Restarting services..."
    stop_services
    start_services
    log_success "Services restarted successfully"
}

show_status() {
    log_info "Service status:"
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
}

show_logs() {
    local service=$1
    
    cd "$DOCKER_DIR"
    
    if [ -n "$service" ]; then
        log_info "Showing logs for service: $service"
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f "$service"
        else
            docker compose logs -f "$service"
        fi
    else
        log_info "Showing logs for all services:"
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f
        else
            docker compose logs -f
        fi
    fi
}

cleanup() {
    log_info "Cleaning up Docker resources..."
    
    cd "$DOCKER_DIR"
    
    # Stop and remove containers
    if command -v docker-compose &> /dev/null; then
        docker-compose down -v --remove-orphans
    else
        docker compose down -v --remove-orphans
    fi
    
    # Remove images
    docker image prune -f
    docker volume prune -f
    
    log_success "Cleanup completed"
}

backup_data() {
    log_info "Creating data backup..."
    
    local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    cd "$DOCKER_DIR"
    
    # Backup database
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T postgres pg_dump -U zishu zishu > "$backup_dir/database.sql"
    else
        docker compose exec -T postgres pg_dump -U zishu zishu > "$backup_dir/database.sql"
    fi
    
    # Backup volumes
    docker run --rm -v zishu_postgres_data:/data -v "$backup_dir":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
    docker run --rm -v zishu_grafana_data:/data -v "$backup_dir":/backup alpine tar czf /backup/grafana_data.tar.gz -C /data .
    
    log_success "Backup created at: $backup_dir"
}

restore_data() {
    local backup_dir=$1
    
    if [ -z "$backup_dir" ] || [ ! -d "$backup_dir" ]; then
        log_error "Backup directory not specified or doesn't exist"
        exit 1
    fi
    
    log_info "Restoring data from: $backup_dir"
    
    cd "$DOCKER_DIR"
    
    # Restore database
    if [ -f "$backup_dir/database.sql" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose exec -T postgres psql -U zishu zishu < "$backup_dir/database.sql"
        else
            docker compose exec -T postgres psql -U zishu zishu < "$backup_dir/database.sql"
        fi
    fi
    
    # Restore volumes
    if [ -f "$backup_dir/postgres_data.tar.gz" ]; then
        docker run --rm -v zishu_postgres_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
    fi
    
    if [ -f "$backup_dir/grafana_data.tar.gz" ]; then
        docker run --rm -v zishu_grafana_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/grafana_data.tar.gz -C /data
    fi
    
    log_success "Data restored successfully"
}

show_help() {
    echo "Zishu-sensei Docker Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy      Full deployment (setup + build + start)"
    echo "  build       Build Docker images"
    echo "  start       Start services"
    echo "  stop        Stop services"
    echo "  restart     Restart services"
    echo "  status      Show service status"
    echo "  logs [svc]  Show logs (optionally for specific service)"
    echo "  cleanup     Stop services and cleanup resources"
    echo "  backup      Create data backup"
    echo "  restore     Restore data from backup"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Full deployment"
    echo "  $0 logs api                  # Show API service logs"
    echo "  $0 restore /path/to/backup   # Restore from backup"
}

# Main script logic
case "${1:-}" in
    deploy)
        check_requirements
        setup_environment
        build_images
        start_services
        log_success "Deployment completed!"
        echo ""
        log_info "Access the application at:"
        echo "  - Web UI: http://localhost"
        echo "  - API: http://localhost/api"
        echo "  - Grafana: http://localhost:3000 (admin/admin)"
        echo "  - Prometheus: http://localhost:9090"
        ;;
    build)
        check_requirements
        build_images
        ;;
    start)
        check_requirements
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    cleanup)
        cleanup
        ;;
    backup)
        backup_data
        ;;
    restore)
        restore_data "$2"
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

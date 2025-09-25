#!/bin/bash

# Zishu-sensei Health Check Script
# This script performs comprehensive health checks on all services

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

# Health check endpoints
API_URL="http://localhost/api/health"
GRAFANA_URL="http://localhost:3000/api/health"
PROMETHEUS_URL="http://localhost:9090/-/healthy"

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

check_service_health() {
    local service_name=$1
    local url=$2
    local timeout=${3:-10}
    
    log_info "Checking $service_name health..."
    
    if curl -f -s --max-time "$timeout" "$url" > /dev/null 2>&1; then
        log_success "$service_name is healthy"
        return 0
    else
        log_error "$service_name is not responding"
        return 1
    fi
}

check_docker_services() {
    log_info "Checking Docker services status..."
    
    cd "$DOCKER_DIR"
    
    local all_healthy=true
    
    # Get service status
    if command -v docker-compose &> /dev/null; then
        services=$(docker-compose ps --services)
        for service in $services; do
            status=$(docker-compose ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            if [ "$status" = "healthy" ] || [ "$status" = "unknown" ]; then
                log_success "$service: $status"
            else
                log_error "$service: $status"
                all_healthy=false
            fi
        done
    else
        services=$(docker compose ps --services)
        for service in $services; do
            status=$(docker compose ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            if [ "$status" = "healthy" ] || [ "$status" = "unknown" ]; then
                log_success "$service: $status"
            else
                log_error "$service: $status"
                all_healthy=false
            fi
        done
    fi
    
    if [ "$all_healthy" = true ]; then
        log_success "All Docker services are healthy"
        return 0
    else
        log_error "Some Docker services are unhealthy"
        return 1
    fi
}

check_database() {
    log_info "Checking database connectivity..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        if docker-compose exec -T postgres pg_isready -U zishu > /dev/null 2>&1; then
            log_success "Database is accessible"
            
            # Check database size and connections
            db_info=$(docker-compose exec -T postgres psql -U zishu -d zishu -t -c "
                SELECT 
                    pg_size_pretty(pg_database_size('zishu')) as size,
                    (SELECT count(*) FROM pg_stat_activity WHERE datname='zishu') as connections;
            " 2>/dev/null | tr -d ' ')
            
            log_info "Database info: $db_info"
            return 0
        else
            log_error "Database is not accessible"
            return 1
        fi
    else
        if docker compose exec -T postgres pg_isready -U zishu > /dev/null 2>&1; then
            log_success "Database is accessible"
            
            # Check database size and connections
            db_info=$(docker compose exec -T postgres psql -U zishu -d zishu -t -c "
                SELECT 
                    pg_size_pretty(pg_database_size('zishu')) as size,
                    (SELECT count(*) FROM pg_stat_activity WHERE datname='zishu') as connections;
            " 2>/dev/null | tr -d ' ')
            
            log_info "Database info: $db_info"
            return 0
        else
            log_error "Database is not accessible"
            return 1
        fi
    fi
}

check_redis() {
    log_info "Checking Redis connectivity..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
            log_success "Redis is accessible"
            
            # Check Redis info
            redis_info=$(docker-compose exec -T redis redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
            log_info "Redis memory usage: $redis_info"
            return 0
        else
            log_error "Redis is not accessible"
            return 1
        fi
    else
        if docker compose exec -T redis redis-cli ping | grep -q "PONG"; then
            log_success "Redis is accessible"
            
            # Check Redis info
            redis_info=$(docker compose exec -T redis redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
            log_info "Redis memory usage: $redis_info"
            return 0
        else
            log_error "Redis is not accessible"
            return 1
        fi
    fi
}

check_disk_space() {
    log_info "Checking disk space..."
    
    local available=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    local usage=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}')
    
    log_info "Disk usage: $usage, Available: $available"
    
    # Check if usage is above 90%
    local usage_percent=$(echo "$usage" | tr -d '%')
    if [ "$usage_percent" -gt 90 ]; then
        log_warning "Disk usage is high: $usage"
        return 1
    else
        log_success "Disk space is adequate"
        return 0
    fi
}

check_memory() {
    log_info "Checking memory usage..."
    
    local memory_info=$(free -h | awk 'NR==2{printf "Used: %s, Available: %s, Usage: %.2f%%", $3, $7, $3/$2*100}')
    log_info "Memory $memory_info"
    
    local usage_percent=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
    if [ "$usage_percent" -gt 90 ]; then
        log_warning "Memory usage is high: ${usage_percent}%"
        return 1
    else
        log_success "Memory usage is normal"
        return 0
    fi
}

check_api_endpoints() {
    log_info "Checking API endpoints..."
    
    local endpoints=(
        "/api/health:Health check"
        "/api/v1/status:Status endpoint"
        "/api/v1/models:Models endpoint"
    )
    
    local all_healthy=true
    
    for endpoint_info in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_info" | cut -d: -f1)
        local description=$(echo "$endpoint_info" | cut -d: -f2)
        local url="http://localhost$endpoint"
        
        if curl -f -s --max-time 5 "$url" > /dev/null 2>&1; then
            log_success "$description is responding"
        else
            log_error "$description is not responding"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        return 0
    else
        return 1
    fi
}

check_ssl_certificates() {
    log_info "Checking SSL certificates..."
    
    local ssl_enabled=$(grep -E "^SSL_ENABLED=true" "$DOCKER_DIR/.env" 2>/dev/null || echo "")
    
    if [ -n "$ssl_enabled" ]; then
        local cert_path=$(grep -E "^SSL_CERT_PATH=" "$DOCKER_DIR/.env" | cut -d= -f2)
        local key_path=$(grep -E "^SSL_KEY_PATH=" "$DOCKER_DIR/.env" | cut -d= -f2)
        
        if [ -f "$cert_path" ] && [ -f "$key_path" ]; then
            # Check certificate expiration
            local expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
            local expiry_epoch=$(date -d "$expiry_date" +%s)
            local current_epoch=$(date +%s)
            local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [ "$days_until_expiry" -lt 30 ]; then
                log_warning "SSL certificate expires in $days_until_expiry days"
                return 1
            else
                log_success "SSL certificate is valid for $days_until_expiry days"
                return 0
            fi
        else
            log_error "SSL certificate files not found"
            return 1
        fi
    else
        log_info "SSL is not enabled"
        return 0
    fi
}

generate_report() {
    local report_file="$PROJECT_ROOT/health-check-report-$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "Generating health check report..."
    
    {
        echo "Zishu-sensei Health Check Report"
        echo "Generated: $(date)"
        echo "======================================="
        echo ""
        
        echo "System Information:"
        echo "- OS: $(uname -s -r)"
        echo "- Docker: $(docker --version)"
        echo "- Docker Compose: $(docker-compose --version 2>/dev/null || docker compose version)"
        echo ""
        
        echo "Service Status:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        
        echo "Resource Usage:"
        echo "- Memory: $(free -h | awk 'NR==2{print $3"/"$2}')"
        echo "- Disk: $(df -h "$PROJECT_ROOT" | awk 'NR==2{print $3"/"$2" ("$5")"}')"
        echo ""
        
        echo "Network Connectivity:"
        if curl -f -s --max-time 5 http://localhost/api/health > /dev/null 2>&1; then
            echo "- API: ✓ Healthy"
        else
            echo "- API: ✗ Unhealthy"
        fi
        
        if curl -f -s --max-time 5 http://localhost:3000/api/health > /dev/null 2>&1; then
            echo "- Grafana: ✓ Healthy"
        else
            echo "- Grafana: ✗ Unhealthy"
        fi
        
        if curl -f -s --max-time 5 http://localhost:9090/-/healthy > /dev/null 2>&1; then
            echo "- Prometheus: ✓ Healthy"
        else
            echo "- Prometheus: ✗ Unhealthy"
        fi
        
    } > "$report_file"
    
    log_success "Health check report saved to: $report_file"
}

run_full_check() {
    log_info "Running comprehensive health check..."
    echo ""
    
    local checks_passed=0
    local total_checks=0
    
    # Docker services check
    total_checks=$((total_checks + 1))
    if check_docker_services; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # Database check
    total_checks=$((total_checks + 1))
    if check_database; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # Redis check
    total_checks=$((total_checks + 1))
    if check_redis; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # API endpoints check
    total_checks=$((total_checks + 1))
    if check_api_endpoints; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # System resources check
    total_checks=$((total_checks + 1))
    if check_disk_space && check_memory; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # SSL certificates check
    total_checks=$((total_checks + 1))
    if check_ssl_certificates; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # Summary
    echo "======================================="
    if [ "$checks_passed" -eq "$total_checks" ]; then
        log_success "All health checks passed ($checks_passed/$total_checks)"
        return 0
    else
        log_error "Some health checks failed ($checks_passed/$total_checks)"
        return 1
    fi
}

show_help() {
    echo "Zishu-sensei Health Check Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  check       Run comprehensive health check"
    echo "  docker      Check Docker services status"
    echo "  database    Check database connectivity"
    echo "  redis       Check Redis connectivity"
    echo "  api         Check API endpoints"
    echo "  system      Check system resources"
    echo "  ssl         Check SSL certificates"
    echo "  report      Generate detailed health report"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check     # Run all health checks"
    echo "  $0 database  # Check only database"
    echo "  $0 report    # Generate detailed report"
}

# Main script logic
case "${1:-}" in
    check)
        run_full_check
        ;;
    docker)
        check_docker_services
        ;;
    database)
        check_database
        ;;
    redis)
        check_redis
        ;;
    api)
        check_api_endpoints
        ;;
    system)
        check_disk_space
        check_memory
        ;;
    ssl)
        check_ssl_certificates
        ;;
    report)
        generate_report
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

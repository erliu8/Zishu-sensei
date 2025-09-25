# Zishu-sensei Deployment Guide

This guide covers deployment procedures for the Zishu-sensei AI teaching assistant platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or CentOS 8+ (recommended)
- **Memory**: Minimum 4GB RAM (8GB+ recommended for production)
- **Storage**: Minimum 20GB free space (100GB+ recommended for production)
- **CPU**: 2+ cores (4+ cores recommended for production)

### Required Software

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Make (optional but recommended)

### Network Requirements

- Ports 80, 443 (HTTP/HTTPS)
- Port 22 (SSH)
- Outbound internet access for Docker image pulls
- Access to external APIs (OpenAI, Anthropic, etc.)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/Zishu-sensei.git
cd Zishu-sensei
```

### 2. Create Environment Configuration

```bash
# Create environment file from template
cp docker/env.template docker/.env

# Edit configuration
vim docker/.env
```

### 3. Configure Required Variables

Update the following variables in `docker/.env`:

```bash
# Database
POSTGRES_PASSWORD=your-secure-postgres-password
POSTGRES_USER=zishu
POSTGRES_DB=zishu

# Redis
REDIS_PASSWORD=your-redis-password

# JWT and Security
JWT_SECRET=your-jwt-secret-key
ZISHU_SECRET_KEY=your-app-secret-key

# External APIs
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Monitoring
GRAFANA_ADMIN_PASSWORD=your-grafana-admin-password
```

## Development Deployment

For local development and testing:

### Quick Start

```bash
# Setup development environment
make dev-setup

# Start development services
make dev-start

# Run API server in development mode
make dev-api
```

### Manual Setup

```bash
# Setup development environment
./scripts/dev.sh setup

# Start essential services (PostgreSQL, Redis)
./scripts/dev.sh start

# Run API server with hot reload
./scripts/dev.sh api
```

### Development Services

After starting development environment, the following services will be available:

- **API Server**: http://localhost:8000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Jupyter Lab**: http://localhost:8888 (token: dev-token)
- **pgAdmin**: http://localhost:5050 (admin@zishu.dev/admin)
- **Redis Commander**: http://localhost:8081
- **Mailhog**: http://localhost:8025

## Staging Deployment

For staging environment testing:

### 1. Environment Configuration

```bash
# Create staging environment
cp docker/env.template docker/.env.staging

# Update for staging
sed -i 's/ZISHU_ENV=production/ZISHU_ENV=staging/' docker/.env.staging
sed -i 's/ZISHU_DEBUG=false/ZISHU_DEBUG=true/' docker/.env.staging
```

### 2. Deploy to Staging

```bash
# Deploy with staging configuration
ZISHU_ENV=staging ./scripts/deploy.sh deploy

# Or using Make
make deploy-staging
```

### 3. Verify Staging Deployment

```bash
# Run health checks
./scripts/health-check.sh check

# Check service status
./scripts/deploy.sh status
```

## Production Deployment

### 1. Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates obtained and configured
- [ ] Database backups configured
- [ ] Monitoring alerts configured
- [ ] DNS records configured
- [ ] Firewall rules configured
- [ ] Load balancer configured (if applicable)

### 2. SSL Certificate Setup

#### Using Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Update environment configuration
echo "SSL_ENABLED=true" >> docker/.env
echo "SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem" >> docker/.env
echo "SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem" >> docker/.env
```

### 3. Production Deployment

```bash
# Validate environment configuration
make env-validate

# Build and deploy
make prod

# Or manually
./scripts/deploy.sh build
./scripts/deploy.sh deploy
```

### 4. Post-deployment Verification

```bash
# Run comprehensive health check
./scripts/health-check.sh check

# Generate health report
./scripts/health-check.sh report

# Check all services
./scripts/deploy.sh status
```

### 5. Configure Monitoring

Access monitoring services:

- **Grafana**: https://your-domain.com:3000
- **Prometheus**: https://your-domain.com:9090 (internal access only)

Import dashboards from `docker/grafana/dashboards/json/`.

### 6. Setup Automated Backups

```bash
# Create backup
./scripts/deploy.sh backup

# Schedule daily backups (add to crontab)
0 2 * * * /path/to/Zishu-sensei/scripts/deploy.sh backup
```

## Monitoring and Maintenance

### Health Monitoring

```bash
# Regular health checks
./scripts/health-check.sh check

# Detailed health report
./scripts/health-check.sh report
```

### Log Management

```bash
# View all service logs
./scripts/deploy.sh logs

# View specific service logs
./scripts/deploy.sh logs api
./scripts/deploy.sh logs postgres

# Follow logs in real-time
./scripts/deploy.sh logs -f
```

### Database Maintenance

```bash
# Create database backup
./scripts/deploy.sh backup

# Run database migrations
./scripts/dev.sh db-migrate

# Check database status
./scripts/health-check.sh database
```

### Performance Monitoring

Monitor these key metrics:

- **API Response Time**: < 200ms for 95% of requests
- **Database Connections**: < 80% of max connections
- **Memory Usage**: < 80% of available memory
- **Disk Usage**: < 85% of available space
- **Error Rate**: < 1% of total requests

### Security Updates

```bash
# Update Docker images
./scripts/deploy.sh build --no-cache
./scripts/deploy.sh restart

# Update system packages
sudo apt update && sudo apt upgrade
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service status
docker ps -a

# Check service logs
docker logs <container_name>

# Check resource usage
docker stats

# Check disk space
df -h
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
./scripts/health-check.sh database

# Check database logs
./scripts/deploy.sh logs postgres

# Test database connection
docker exec -it postgres psql -U zishu -d zishu
```

#### High Memory Usage

```bash
# Check memory usage
free -h
docker stats

# Restart services if needed
./scripts/deploy.sh restart
```

#### SSL Certificate Issues

```bash
# Check certificate expiration
./scripts/health-check.sh ssl

# Renew Let's Encrypt certificate
sudo certbot renew
./scripts/deploy.sh restart nginx
```

### Performance Issues

#### Slow API Responses

1. Check database query performance
2. Review API logs for bottlenecks
3. Check Redis cache hit rate
4. Monitor system resources

#### High Database Load

1. Check slow query log
2. Review database connections
3. Consider connection pooling
4. Optimize database queries

## Rollback Procedures

### Quick Rollback

```bash
# Stop current deployment
./scripts/deploy.sh stop

# Restore from backup
./scripts/deploy.sh restore /path/to/backup

# Start services
./scripts/deploy.sh start
```

### Git-based Rollback

```bash
# Checkout previous version
git checkout <previous_commit>

# Rebuild and deploy
./scripts/deploy.sh build
./scripts/deploy.sh deploy
```

### Database Rollback

```bash
# Stop API service
docker stop api

# Restore database from backup
./scripts/deploy.sh restore-db /path/to/db_backup

# Start services
./scripts/deploy.sh start
```

## Scaling Considerations

### Horizontal Scaling

For high-traffic deployments:

1. **Load Balancer**: Deploy behind nginx or cloud load balancer
2. **Multiple API Instances**: Scale API containers
3. **Database Read Replicas**: Setup PostgreSQL read replicas
4. **Redis Cluster**: Configure Redis clustering
5. **CDN**: Use CDN for static assets

### Vertical Scaling

Increase resources for existing containers:

```yaml
# In docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Security Considerations

### Network Security

- Use HTTPS only in production
- Configure firewall rules
- Use VPN for internal services
- Regular security updates

### Application Security

- Rotate API keys regularly
- Use strong passwords
- Enable rate limiting
- Monitor for suspicious activity

### Data Protection

- Encrypt data at rest
- Regular security backups
- Access logging and monitoring
- Compliance with data protection regulations

## Support and Maintenance

### Regular Maintenance Tasks

- [ ] Weekly health checks
- [ ] Daily backup verification
- [ ] Monthly security updates
- [ ] Quarterly performance review
- [ ] Annual disaster recovery testing

### Emergency Contacts

- **System Administrator**: admin@your-org.com
- **Database Administrator**: dba@your-org.com
- **Security Team**: security@your-org.com

### Documentation Updates

Keep this deployment guide updated with:
- Configuration changes
- New deployment procedures
- Lessons learned from incidents
- Performance optimization findings

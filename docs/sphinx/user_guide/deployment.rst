================
部署指南
================

本指南介绍如何在生产环境中部署 Zishu-Sensei 系统。

部署架构
========

推荐的生产环境架构：

.. code-block:: text

    ┌─────────────────────────────────────────────────────┐
    │                  负载均衡器 (Nginx)                   │
    │                 SSL/TLS 终止                         │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │               应用服务器集群                          │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
    │  │  API-1   │  │  API-2   │  │  API-3   │          │
    │  │ (Docker) │  │ (Docker) │  │ (Docker) │          │
    │  └──────────┘  └──────────┘  └──────────┘          │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │                数据层                                │
    │  ┌───────────┐  ┌───────┐  ┌──────────────┐        │
    │  │PostgreSQL │  │ Redis │  │   Qdrant     │        │
    │  │  (主从)    │  │Cluster│  │ (Vector DB)  │        │
    │  └───────────┘  └───────┘  └──────────────┘        │
    └─────────────────────────────────────────────────────┘

Docker 部署
===========

生产环境 Docker Compose
-----------------------

``docker-compose.prod.yml``:

.. code-block:: yaml

    version: '3.8'

    services:
      # API 服务
      api:
        image: zishu-sensei/api:latest
        deploy:
          replicas: 3
          restart_policy:
            condition: on-failure
            max_attempts: 3
        environment:
          - ENV=production
          - DATABASE_URL=postgresql://user:pass@postgres:5432/zishu
          - REDIS_URL=redis://redis:6379
        depends_on:
          - postgres
          - redis
          - qdrant
        networks:
          - zishu-network
        healthcheck:
          test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
          interval: 30s
          timeout: 10s
          retries: 3
      
      # Nginx 反向代理
      nginx:
        image: nginx:alpine
        ports:
          - "80:80"
          - "443:443"
        volumes:
          - ./nginx.conf:/etc/nginx/nginx.conf:ro
          - ./ssl:/etc/nginx/ssl:ro
        depends_on:
          - api
        networks:
          - zishu-network
      
      # PostgreSQL 数据库
      postgres:
        image: postgres:15
        environment:
          POSTGRES_DB: zishu
          POSTGRES_USER: zishu
          POSTGRES_PASSWORD: ${DB_PASSWORD}
        volumes:
          - postgres_data:/var/lib/postgresql/data
        networks:
          - zishu-network
        command: postgres -c max_connections=200
      
      # Redis 缓存
      redis:
        image: redis:7-alpine
        command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
        volumes:
          - redis_data:/data
        networks:
          - zishu-network
      
      # Qdrant 向量数据库
      qdrant:
        image: qdrant/qdrant:latest
        volumes:
          - qdrant_data:/qdrant/storage
        networks:
          - zishu-network

    volumes:
      postgres_data:
      redis_data:
      qdrant_data:

    networks:
      zishu-network:
        driver: bridge

启动生产环境
------------

.. code-block:: bash

    # 构建镜像
    docker build -t zishu-sensei/api:latest .
    
    # 启动服务
    docker-compose -f docker-compose.prod.yml up -d
    
    # 检查状态
    docker-compose -f docker-compose.prod.yml ps
    
    # 查看日志
    docker-compose -f docker-compose.prod.yml logs -f api

Kubernetes 部署
===============

准备工作
--------

.. code-block:: bash

    # 安装 kubectl
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    
    # 验证安装
    kubectl version --client

创建命名空间
------------

``k8s/namespace.yaml``:

.. code-block:: yaml

    apiVersion: v1
    kind: Namespace
    metadata:
      name: zishu-sensei

部署配置
--------

``k8s/deployment.yaml``:

.. code-block:: yaml

    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: zishu-api
      namespace: zishu-sensei
    spec:
      replicas: 3
      selector:
        matchLabels:
          app: zishu-api
      template:
        metadata:
          labels:
            app: zishu-api
        spec:
          containers:
          - name: api
            image: zishu-sensei/api:latest
            ports:
            - containerPort: 8000
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: zishu-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: zishu-secrets
                  key: redis-url
            resources:
              requests:
                memory: "512Mi"
                cpu: "500m"
              limits:
                memory: "2Gi"
                cpu: "2000m"
            livenessProbe:
              httpGet:
                path: /health
                port: 8000
              initialDelaySeconds: 30
              periodSeconds: 10
            readinessProbe:
              httpGet:
                path: /health
                port: 8000
              initialDelaySeconds: 5
              periodSeconds: 5

服务配置
--------

``k8s/service.yaml``:

.. code-block:: yaml

    apiVersion: v1
    kind: Service
    metadata:
      name: zishu-api
      namespace: zishu-sensei
    spec:
      selector:
        app: zishu-api
      ports:
      - protocol: TCP
        port: 80
        targetPort: 8000
      type: LoadBalancer

Ingress 配置
------------

``k8s/ingress.yaml``:

.. code-block:: yaml

    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: zishu-ingress
      namespace: zishu-sensei
      annotations:
        cert-manager.io/cluster-issuer: "letsencrypt-prod"
        nginx.ingress.kubernetes.io/rate-limit: "100"
    spec:
      ingressClassName: nginx
      tls:
      - hosts:
        - api.zishu-sensei.com
        secretName: zishu-tls
      rules:
      - host: api.zishu-sensei.com
        http:
          paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: zishu-api
                port:
                  number: 80

部署到 K8s
----------

.. code-block:: bash

    # 创建密钥
    kubectl create secret generic zishu-secrets \
      --from-literal=database-url='postgresql://...' \
      --from-literal=redis-url='redis://...' \
      -n zishu-sensei
    
    # 应用配置
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/ingress.yaml
    
    # 检查状态
    kubectl get pods -n zishu-sensei
    kubectl get services -n zishu-sensei

云平台部署
==========

AWS 部署
--------

使用 ECS (Elastic Container Service):

.. code-block:: bash

    # 安装 AWS CLI
    pip install awscli
    
    # 配置凭证
    aws configure
    
    # 创建 ECR 仓库
    aws ecr create-repository --repository-name zishu-sensei
    
    # 推送镜像
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
    docker tag zishu-sensei/api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/zishu-sensei:latest
    docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/zishu-sensei:latest

Azure 部署
----------

使用 Azure Container Apps:

.. code-block:: bash

    # 安装 Azure CLI
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    
    # 登录
    az login
    
    # 创建资源组
    az group create --name zishu-rg --location eastus
    
    # 创建容器应用
    az containerapp create \
      --name zishu-api \
      --resource-group zishu-rg \
      --environment zishu-env \
      --image zishu-sensei/api:latest \
      --target-port 8000 \
      --ingress external

GCP 部署
--------

使用 Cloud Run:

.. code-block:: bash

    # 安装 gcloud CLI
    curl https://sdk.cloud.google.com | bash
    
    # 初始化
    gcloud init
    
    # 构建并推送镜像
    gcloud builds submit --tag gcr.io/PROJECT_ID/zishu-api
    
    # 部署
    gcloud run deploy zishu-api \
      --image gcr.io/PROJECT_ID/zishu-api \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated

Nginx 配置
==========

生产环境 Nginx 配置
-------------------

``nginx.conf``:

.. code-block:: nginx

    user nginx;
    worker_processes auto;
    error_log /var/log/nginx/error.log warn;
    pid /var/run/nginx.pid;

    events {
        worker_connections 4096;
    }

    http {
        include /etc/nginx/mime.types;
        default_type application/octet-stream;

        log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                        '$status $body_bytes_sent "$http_referer" '
                        '"$http_user_agent" "$http_x_forwarded_for"';

        access_log /var/log/nginx/access.log main;

        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        keepalive_timeout 65;
        types_hash_max_size 2048;

        # Gzip 压缩
        gzip on;
        gzip_vary on;
        gzip_proxied any;
        gzip_comp_level 6;
        gzip_types text/plain text/css text/xml text/javascript 
                   application/json application/javascript application/xml+rss;

        # 上游服务器
        upstream zishu_api {
            least_conn;
            server api-1:8000 max_fails=3 fail_timeout=30s;
            server api-2:8000 max_fails=3 fail_timeout=30s;
            server api-3:8000 max_fails=3 fail_timeout=30s;
        }

        # HTTP 重定向到 HTTPS
        server {
            listen 80;
            server_name api.zishu-sensei.com;
            return 301 https://$server_name$request_uri;
        }

        # HTTPS 服务器
        server {
            listen 443 ssl http2;
            server_name api.zishu-sensei.com;

            ssl_certificate /etc/nginx/ssl/server.crt;
            ssl_certificate_key /etc/nginx/ssl/server.key;
            ssl_protocols TLSv1.2 TLSv1.3;
            ssl_ciphers HIGH:!aNULL:!MD5;
            ssl_prefer_server_ciphers on;

            # 安全头
            add_header X-Frame-Options "SAMEORIGIN" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-XSS-Protection "1; mode=block" always;
            add_header Strict-Transport-Security "max-age=31536000" always;

            # 限流
            limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
            limit_req zone=api_limit burst=20 nodelay;

            # 代理配置
            location / {
                proxy_pass http://zishu_api;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                
                # 超时设置
                proxy_connect_timeout 60s;
                proxy_send_timeout 60s;
                proxy_read_timeout 60s;
                
                # WebSocket 支持
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
            }

            # 健康检查端点
            location /health {
                access_log off;
                proxy_pass http://zishu_api/health;
            }

            # 静态文件缓存
            location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }

SSL 证书配置
============

使用 Let's Encrypt
------------------

.. code-block:: bash

    # 安装 Certbot
    sudo apt-get install certbot python3-certbot-nginx
    
    # 获取证书
    sudo certbot --nginx -d api.zishu-sensei.com
    
    # 自动续期
    sudo certbot renew --dry-run

数据库优化
==========

PostgreSQL 优化
---------------

``postgresql.conf``:

.. code-block:: ini

    # 连接设置
    max_connections = 200
    shared_buffers = 4GB
    effective_cache_size = 12GB
    
    # WAL 设置
    wal_buffers = 16MB
    checkpoint_completion_target = 0.9
    
    # 查询优化
    random_page_cost = 1.1
    effective_io_concurrency = 200
    
    # 维护
    autovacuum = on
    autovacuum_max_workers = 3

主从复制
--------

.. code-block:: bash

    # 主服务器配置
    # postgresql.conf
    wal_level = replica
    max_wal_senders = 5
    wal_keep_size = 1GB
    
    # 从服务器配置
    hot_standby = on

监控和日志
==========

Prometheus + Grafana
---------------------

``prometheus.yml``:

.. code-block:: yaml

    global:
      scrape_interval: 15s

    scrape_configs:
      - job_name: 'zishu-api'
        static_configs:
          - targets: ['api:8000']

日志聚合
--------

使用 ELK Stack (Elasticsearch + Logstash + Kibana):

.. code-block:: yaml

    # docker-compose.logging.yml
    version: '3.8'
    
    services:
      elasticsearch:
        image: elasticsearch:8.8.0
        environment:
          - discovery.type=single-node
        volumes:
          - es_data:/usr/share/elasticsearch/data
      
      logstash:
        image: logstash:8.8.0
        volumes:
          - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
        depends_on:
          - elasticsearch
      
      kibana:
        image: kibana:8.8.0
        ports:
          - "5601:5601"
        depends_on:
          - elasticsearch

备份策略
========

数据库备份
----------

.. code-block:: bash

    #!/bin/bash
    # backup.sh
    
    BACKUP_DIR="/backups"
    DATE=$(date +%Y%m%d_%H%M%S)
    
    # PostgreSQL 备份
    docker exec postgres pg_dump -U zishu zishu_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
    
    # 向量数据库备份
    docker exec qdrant tar -czf - /qdrant/storage > "$BACKUP_DIR/qdrant_$DATE.tar.gz"
    
    # 保留最近 30 天的备份
    find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

自动备份
--------

添加到 crontab:

.. code-block:: bash

    # 每天凌晨 2 点备份
    0 2 * * * /opt/zishu-sensei/scripts/backup.sh

故障恢复
========

数据恢复
--------

.. code-block:: bash

    # 恢复数据库
    gunzip < backup.sql.gz | docker exec -i postgres psql -U zishu zishu_db
    
    # 恢复向量数据库
    docker exec -i qdrant tar -xzf - -C /qdrant/storage < backup.tar.gz

灾难恢复计划
------------

1. **定期备份**: 自动化每日备份
2. **异地存储**: 将备份同步到云存储
3. **恢复演练**: 定期测试恢复流程
4. **文档化**: 详细记录恢复步骤

性能调优
========

应用层优化
----------

- 启用数据库连接池
- 使用 Redis 缓存热数据
- 实现异步任务队列
- 优化数据库查询

负载均衡
--------

- 使用 Nginx 或 HAProxy
- 实现健康检查
- 配置故障转移

扩展策略
--------

- 水平扩展: 增加应用实例
- 垂直扩展: 升级服务器配置
- 数据库分片: 处理大规模数据

安全加固
========

防火墙规则
----------

.. code-block:: bash

    # 只允许必要的端口
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw enable

定期更新
--------

.. code-block:: bash

    # 更新系统包
    apt-get update && apt-get upgrade -y
    
    # 更新 Docker 镜像
    docker-compose pull

检查清单
========

部署前检查:

- [ ] 环境变量已正确配置
- [ ] SSL 证书已安装
- [ ] 数据库已初始化
- [ ] 备份策略已设置
- [ ] 监控已配置
- [ ] 日志已配置
- [ ] 性能测试已完成
- [ ] 安全扫描已通过

下一步
======

- 查看 :doc:`../developer_guide/testing` 了解测试策略
- 阅读 :doc:`../appendix/troubleshooting` 解决常见问题
- 参考 :doc:`configuration` 优化系统配置


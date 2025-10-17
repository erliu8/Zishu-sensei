================
配置指南
================

本指南详细介绍 Zishu-Sensei 系统的配置选项。

配置文件结构
============

主要配置文件
------------

.. code-block:: text

    config/
    ├── config.yaml          # 主配置文件
    ├── logging.yaml         # 日志配置
    ├── models.yaml          # 模型配置
    └── adapters/            # 适配器配置
        ├── core.yaml
        ├── soft.yaml
        └── hard.yaml

环境变量
--------

使用 ``.env`` 文件管理敏感信息：

.. code-block:: bash

    # .env
    DATABASE_URL=postgresql://user:pass@localhost/db
    REDIS_URL=redis://localhost:6379
    OPENAI_API_KEY=sk-xxx
    SECRET_KEY=your-secret-key

主配置文件
==========

``config/config.yaml`` 示例：

.. code-block:: yaml

    # 应用基础配置
    app:
      name: "Zishu-Sensei"
      version: "1.0.0"
      environment: "production"  # development, staging, production
      debug: false
      host: "0.0.0.0"
      port: 8000
      
    # 数据库配置
    database:
      url: "${DATABASE_URL}"
      pool_size: 20
      max_overflow: 10
      pool_timeout: 30
      pool_recycle: 3600
      echo: false
      
    # Redis 缓存配置
    redis:
      url: "${REDIS_URL}"
      db: 0
      max_connections: 50
      socket_timeout: 5
      socket_connect_timeout: 5
      decode_responses: true
      
    # 向量数据库配置
    vector_db:
      provider: "qdrant"  # qdrant, faiss
      url: "http://localhost:6333"
      collection_name: "zishu_knowledge"
      vector_size: 768
      distance: "cosine"
      
    # 认证配置
    auth:
      secret_key: "${SECRET_KEY}"
      algorithm: "HS256"
      access_token_expire_minutes: 30
      refresh_token_expire_days: 7
      
    # CORS 配置
    cors:
      allow_origins:
        - "http://localhost:3000"
        - "http://localhost:5173"
      allow_credentials: true
      allow_methods: ["*"]
      allow_headers: ["*"]

LLM 模型配置
============

OpenAI 配置
-----------

.. code-block:: yaml

    llm:
      provider: "openai"
      api_key: "${OPENAI_API_KEY}"
      api_base: "https://api.openai.com/v1"
      
      models:
        chat:
          model: "gpt-3.5-turbo"
          temperature: 0.7
          max_tokens: 2000
          top_p: 1.0
          frequency_penalty: 0.0
          presence_penalty: 0.0
          
        embedding:
          model: "text-embedding-ada-002"
          
      retry:
        max_attempts: 3
        backoff_factor: 2
        
      timeout:
        connect: 10
        read: 60

Claude (Anthropic) 配置
-----------------------

.. code-block:: yaml

    llm:
      provider: "anthropic"
      api_key: "${ANTHROPIC_API_KEY}"
      
      models:
        chat:
          model: "claude-3-opus-20240229"
          max_tokens: 4096
          temperature: 0.7

本地模型配置
------------

使用本地部署的开源模型：

.. code-block:: yaml

    llm:
      provider: "local"
      
      models:
        chat:
          model_path: "/models/llama-2-7b-chat"
          device: "cuda"  # cuda, cpu
          load_in_8bit: true
          max_new_tokens: 2000
          temperature: 0.7
          
        embedding:
          model_path: "/models/bge-large-zh-v1.5"
          device: "cuda"
          batch_size: 32

RAG 配置
========

基础配置
--------

.. code-block:: yaml

    rag:
      # 文档处理
      chunk_size: 512
      chunk_overlap: 50
      max_chunks_per_doc: 1000
      
      # 检索配置
      top_k: 5
      score_threshold: 0.7
      use_rerank: true
      rerank_top_k: 3
      
      # 嵌入模型
      embedding:
        model: "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
        batch_size: 32
        max_seq_length: 512
      
      # 检索策略
      retrieval:
        strategy: "hybrid"  # dense, sparse, hybrid
        dense_weight: 0.7
        sparse_weight: 0.3

重排序配置
----------

.. code-block:: yaml

    rag:
      reranker:
        enabled: true
        model: "BAAI/bge-reranker-large"
        batch_size: 16
        top_k: 3

文档解析配置
------------

.. code-block:: yaml

    document_parser:
      # 支持的文件类型
      allowed_types:
        - "pdf"
        - "docx"
        - "txt"
        - "md"
        - "html"
      
      # 最大文件大小 (MB)
      max_file_size: 50
      
      # PDF 解析
      pdf:
        extract_images: false
        ocr_enabled: true
        ocr_lang: "chi_sim+eng"
      
      # 文本清理
      text_cleaning:
        remove_urls: true
        remove_emails: false
        normalize_whitespace: true

适配器配置
==========

Core Adapter
------------

.. code-block:: yaml

    adapters:
      core:
        enabled: true
        
        # 健康检查服务
        health_service:
          check_interval: 60  # 秒
          timeout: 5
          
        # 事件服务
        event_service:
          max_queue_size: 10000
          batch_size: 100
          flush_interval: 5

Soft Adapter
------------

.. code-block:: yaml

    adapters:
      soft:
        enabled: true
        
        # RAG 引擎
        rag_engine:
          cache_enabled: true
          cache_ttl: 3600
          
        # Prompt 引擎
        prompt_engine:
          template_dir: "templates/prompts"
          default_lang: "zh"

Hard Adapter
------------

.. code-block:: yaml

    adapters:
      hard:
        enabled: true
        
        # 硬件加速
        acceleration:
          use_gpu: true
          gpu_ids: [0, 1]
          mixed_precision: true

日志配置
========

基础日志配置
------------

``config/logging.yaml``:

.. code-block:: yaml

    version: 1
    disable_existing_loggers: false
    
    formatters:
      standard:
        format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        datefmt: "%Y-%m-%d %H:%M:%S"
      
      detailed:
        format: "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s"
    
    handlers:
      console:
        class: logging.StreamHandler
        level: INFO
        formatter: standard
        stream: ext://sys.stdout
      
      file:
        class: logging.handlers.RotatingFileHandler
        level: DEBUG
        formatter: detailed
        filename: logs/app.log
        maxBytes: 10485760  # 10MB
        backupCount: 10
      
      error_file:
        class: logging.handlers.RotatingFileHandler
        level: ERROR
        formatter: detailed
        filename: logs/error.log
        maxBytes: 10485760
        backupCount: 5
    
    loggers:
      zishu:
        level: DEBUG
        handlers: [console, file, error_file]
        propagate: false
      
      uvicorn:
        level: INFO
        handlers: [console]
      
      sqlalchemy:
        level: WARNING
        handlers: [file]
    
    root:
      level: INFO
      handlers: [console, file]

性能优化配置
============

数据库连接池
------------

.. code-block:: yaml

    database:
      # 连接池大小
      pool_size: 20
      max_overflow: 10
      
      # 连接超时
      pool_timeout: 30
      
      # 连接回收时间 (秒)
      pool_recycle: 3600
      
      # 预 ping
      pool_pre_ping: true

缓存策略
--------

.. code-block:: yaml

    cache:
      # 全局缓存开关
      enabled: true
      
      # 默认 TTL (秒)
      default_ttl: 3600
      
      # 缓存策略
      strategies:
        llm_response:
          ttl: 1800
          max_size: 1000
        
        rag_results:
          ttl: 3600
          max_size: 5000
        
        user_session:
          ttl: 7200

并发控制
--------

.. code-block:: yaml

    concurrency:
      # 最大工作进程数
      workers: 4
      
      # 每个进程的线程数
      threads: 2
      
      # 请求超时 (秒)
      timeout: 120
      
      # 最大并发请求
      max_requests: 1000
      
      # 请求队列大小
      backlog: 2048

安全配置
========

认证和授权
----------

.. code-block:: yaml

    security:
      # JWT 配置
      jwt:
        secret_key: "${SECRET_KEY}"
        algorithm: "HS256"
        access_token_expire: 1800  # 30 分钟
        refresh_token_expire: 604800  # 7 天
      
      # 密码策略
      password:
        min_length: 8
        require_uppercase: true
        require_lowercase: true
        require_digit: true
        require_special: false
      
      # API 限流
      rate_limit:
        enabled: true
        requests_per_minute: 60
        burst: 10

数据加密
--------

.. code-block:: yaml

    encryption:
      # 数据库字段加密
      enabled: true
      algorithm: "AES-256-GCM"
      key: "${ENCRYPTION_KEY}"
      
      # 传输加密
      tls:
        enabled: true
        cert_file: "/certs/server.crt"
        key_file: "/certs/server.key"

监控配置
========

Prometheus 指标
---------------

.. code-block:: yaml

    monitoring:
      prometheus:
        enabled: true
        endpoint: "/metrics"
        
        # 收集的指标
        metrics:
          - http_requests_total
          - http_request_duration_seconds
          - llm_requests_total
          - llm_tokens_used
          - rag_queries_total
          - database_connections

健康检查
--------

.. code-block:: yaml

    health_check:
      enabled: true
      endpoint: "/health"
      
      checks:
        - database
        - redis
        - vector_db
        - llm_service
      
      timeout: 5  # 每个检查的超时时间

环境特定配置
============

开发环境
--------

``config/config.dev.yaml``:

.. code-block:: yaml

    app:
      debug: true
      
    database:
      echo: true  # 显示 SQL 语句
      
    logging:
      level: DEBUG

生产环境
--------

``config/config.prod.yaml``:

.. code-block:: yaml

    app:
      debug: false
      
    database:
      echo: false
      pool_size: 50
      
    logging:
      level: INFO
      
    security:
      rate_limit:
        requests_per_minute: 30

配置加载优先级
==============

配置加载顺序（后面的会覆盖前面的）：

1. 默认配置 (``config.yaml``)
2. 环境特定配置 (``config.{env}.yaml``)
3. 环境变量
4. 命令行参数

示例：

.. code-block:: bash

    # 使用环境变量覆盖
    export DATABASE_POOL_SIZE=50
    
    # 使用命令行参数
    python main.py --port 8080 --debug

配置验证
========

启动时验证配置：

.. code-block:: python

    from zishu.core.config import validate_config
    
    # 验证配置
    errors = validate_config()
    if errors:
        for error in errors:
            print(f"配置错误: {error}")
        exit(1)

最佳实践
========

1. **敏感信息**: 永远不要将 API 密钥等敏感信息提交到版本控制
2. **环境隔离**: 为不同环境使用不同的配置文件
3. **默认值**: 为所有配置项提供合理的默认值
4. **文档化**: 为每个配置项添加注释说明
5. **验证**: 在应用启动时验证配置的正确性

下一步
======

- 查看 :doc:`deployment` 了解生产环境部署
- 阅读 :doc:`../developer_guide/architecture` 理解系统架构
- 参考 :doc:`../api/core` 查看 API 文档


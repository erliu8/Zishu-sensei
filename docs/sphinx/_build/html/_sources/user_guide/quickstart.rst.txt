================
快速开始
================

本指南将帮助您在 5 分钟内开始使用 Zishu-Sensei。

安装
====

使用 Docker (推荐)
------------------

最简单的方式是使用 Docker Compose：

.. code-block:: bash

    # 克隆仓库
    git clone https://github.com/your-org/zishu-sensei.git
    cd zishu-sensei
    
    # 创建环境配置
    cp docker/env.template docker/.env
    
    # 编辑配置文件（设置密码和密钥）
    vim docker/.env
    
    # 启动服务
    make docker-dev-start
    
    # 检查状态
    make docker-dev-status

几分钟后，所有服务将启动完成。

本地安装
--------

如果您希望本地运行：

.. code-block:: bash

    # 创建虚拟环境
    bash scripts/setup_cloud_env.sh
    
    # 安装依赖
    bash scripts/run_with_cloud_env.sh -m pip install -r requirements.txt
    
    # 配置环境变量
    cp .env.example .env
    vim .env
    
    # 启动数据库服务
    make dev-start
    
    # 运行数据库迁移
    make db-migrate
    
    # 启动 API 服务器
    make dev-api

验证安装
--------

访问以下 URL 检查服务是否正常：

.. code-block:: bash

    # API 健康检查
    curl http://localhost:8000/health
    
    # 应该返回
    # {"status": "healthy", "version": "0.1.0"}

基本使用
========

1. 创建用户
-----------

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/auth/register \
      -H "Content-Type: application/json" \
      -d '{
        "username": "student",
        "email": "student@example.com",
        "password": "SecurePass123"
      }'

响应示例：

.. code-block:: json

    {
      "id": 1,
      "username": "student",
      "email": "student@example.com",
      "created_at": "2025-10-17T10:00:00Z"
    }

2. 登录获取令牌
---------------

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{
        "username": "student",
        "password": "SecurePass123"
      }'

响应示例：

.. code-block:: json

    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer"
    }

保存 ``access_token`` 用于后续请求。

3. 开始对话
-----------

.. code-block:: bash

    # 创建对话
    curl -X POST http://localhost:8000/api/v1/conversations \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "学习 Python"
      }'

响应：

.. code-block:: json

    {
      "id": 1,
      "title": "学习 Python",
      "created_at": "2025-10-17T10:05:00Z"
    }

4. 发送消息
-----------

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/conversations/1/messages \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "content": "如何开始学习 Python？",
        "use_rag": true
      }'

响应：

.. code-block:: json

    {
      "id": 1,
      "role": "assistant",
      "content": "学习 Python 的建议步骤：\n1. 安装 Python 环境...",
      "created_at": "2025-10-17T10:06:00Z"
    }

使用桌面应用
============

启动应用
--------

如果您下载了桌面应用：

**Windows**:

.. code-block:: bash

    ./Zishu-Sensei-Setup-1.0.0.exe

**macOS**:

.. code-block:: bash

    open Zishu-Sensei.app

**Linux**:

.. code-block:: bash

    ./zishu-sensei-1.0.0.AppImage

配置连接
--------

1. 打开应用
2. 点击 "设置"
3. 输入 API 地址：``http://localhost:8000``
4. 输入您的用户名和密码
5. 点击 "连接"

开始对话
--------

1. 点击 "新建对话"
2. 输入对话标题
3. 在输入框中输入您的问题
4. 按 Enter 或点击发送按钮

上传文档
========

准备文档
--------

支持的格式：

- PDF (``.pdf``)
- Word (``.docx``, ``.doc``)
- 文本文件 (``.txt``, ``.md``)
- HTML (``.html``)

上传文档
--------

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/documents/upload \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -F "file=@/path/to/document.pdf" \
      -F "title=Python 教程" \
      -F "category=programming"

响应：

.. code-block:: json

    {
      "id": 1,
      "title": "Python 教程",
      "filename": "document.pdf",
      "status": "processing",
      "uploaded_at": "2025-10-17T10:10:00Z"
    }

查看处理状态
------------

.. code-block:: bash

    curl -X GET http://localhost:8000/api/v1/documents/1 \
      -H "Authorization: Bearer YOUR_TOKEN"

当 ``status`` 变为 ``"ready"`` 时，文档已准备好用于 RAG 检索。

使用 RAG 查询
=============

启用 RAG
--------

在发送消息时设置 ``use_rag: true``：

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/conversations/1/messages \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "content": "Python 中的装饰器是什么？",
        "use_rag": true,
        "rag_config": {
          "top_k": 5,
          "min_score": 0.7
        }
      }'

系统会自动从上传的文档中检索相关内容，并基于这些内容生成回答。

查看引用来源
------------

响应中会包含引用的文档片段：

.. code-block:: json

    {
      "id": 2,
      "role": "assistant",
      "content": "装饰器是 Python 中的一种设计模式...",
      "sources": [
        {
          "document_id": 1,
          "title": "Python 教程",
          "chunk": "装饰器的基本概念...",
          "score": 0.92
        }
      ]
    }

配置选项
========

基本配置
--------

编辑 ``.env`` 文件：

.. code-block:: bash

    # API 配置
    API_HOST=0.0.0.0
    API_PORT=8000
    
    # 数据库配置
    DATABASE_URL=postgresql://user:pass@localhost/zishu
    
    # Redis 配置
    REDIS_URL=redis://localhost:6379/0
    
    # LLM 配置
    LLM_PROVIDER=openai
    LLM_API_KEY=your-api-key
    LLM_MODEL=gpt-4

LLM 提供商
----------

支持多个 LLM 提供商：

**OpenAI**:

.. code-block:: bash

    LLM_PROVIDER=openai
    LLM_API_KEY=sk-...
    LLM_MODEL=gpt-4

**Azure OpenAI**:

.. code-block:: bash

    LLM_PROVIDER=azure
    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
    AZURE_OPENAI_API_KEY=your-key
    AZURE_OPENAI_DEPLOYMENT=gpt-4

**Anthropic Claude**:

.. code-block:: bash

    LLM_PROVIDER=anthropic
    ANTHROPIC_API_KEY=sk-ant-...
    ANTHROPIC_MODEL=claude-3-opus-20240229

**本地模型 (Ollama)**:

.. code-block:: bash

    LLM_PROVIDER=ollama
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_MODEL=llama2

重启服务以应用配置更改：

.. code-block:: bash

    make restart

常见任务
========

管理对话
--------

.. code-block:: bash

    # 列出所有对话
    curl -X GET http://localhost:8000/api/v1/conversations \
      -H "Authorization: Bearer YOUR_TOKEN"
    
    # 获取对话详情
    curl -X GET http://localhost:8000/api/v1/conversations/1 \
      -H "Authorization: Bearer YOUR_TOKEN"
    
    # 删除对话
    curl -X DELETE http://localhost:8000/api/v1/conversations/1 \
      -H "Authorization: Bearer YOUR_TOKEN"

管理文档
--------

.. code-block:: bash

    # 列出文档
    curl -X GET http://localhost:8000/api/v1/documents \
      -H "Authorization: Bearer YOUR_TOKEN"
    
    # 删除文档
    curl -X DELETE http://localhost:8000/api/v1/documents/1 \
      -H "Authorization: Bearer YOUR_TOKEN"

搜索文档
--------

.. code-block:: bash

    curl -X POST http://localhost:8000/api/v1/documents/search \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "Python 装饰器",
        "top_k": 10
      }'

故障排除
========

API 无法访问
------------

.. code-block:: bash

    # 检查服务状态
    make status
    
    # 查看日志
    make logs-api

数据库连接失败
--------------

.. code-block:: bash

    # 检查 PostgreSQL 是否运行
    docker ps | grep postgres
    
    # 查看数据库日志
    make logs-db

上传文档失败
------------

检查文件大小和格式：

- 最大文件大小：50MB
- 支持的格式：PDF, DOCX, TXT, MD, HTML

检查日志以获取详细错误信息：

.. code-block:: bash

    make logs-api

下一步
======

- 阅读 :doc:`configuration` 了解详细配置选项
- 查看 :doc:`advanced_usage` 学习高级功能
- 访问 :doc:`../api_reference/index` 了解完整 API

需要帮助？
==========

- 查看 :doc:`faq` 常见问题
- 访问 GitHub Issues: https://github.com/your-org/zishu-sensei/issues
- 加入社区讨论: https://discord.gg/zishu-sensei

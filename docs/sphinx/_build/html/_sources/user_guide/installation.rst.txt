================
安装指南
================

本指南将帮助您在不同环境中安装和配置 Zishu-Sensei 系统。

系统要求
========

硬件要求
--------

**最低配置**

- CPU: 4 核心
- 内存: 8 GB RAM
- 存储: 50 GB 可用空间
- 网络: 稳定的互联网连接

**推荐配置**

- CPU: 8 核心或以上
- 内存: 16 GB RAM 或以上
- 存储: 100 GB SSD
- GPU: NVIDIA GPU（可选，用于本地模型推理）

软件要求
--------

- **操作系统**: Linux (Ubuntu 20.04+), macOS 11+, Windows 10+
- **Python**: 3.8 或更高版本
- **Docker**: 20.10+ (可选，推荐)
- **Docker Compose**: 1.29+ (可选，推荐)
- **PostgreSQL**: 13+ (如不使用 Docker)
- **Redis**: 6+ (如不使用 Docker)

安装方式
========

我们提供三种安装方式，您可以根据自己的需求选择：

1. **Docker 部署** (推荐) - 最简单快捷
2. **本地开发安装** - 适合开发者
3. **云平台部署** - 适合生产环境

方式一: Docker 部署 (推荐)
=========================

Docker 部署是最简单快捷的方式，适合大多数用户。

步骤 1: 安装 Docker
-------------------

**Linux (Ubuntu/Debian)**

.. code-block:: bash

    # 使用官方安装脚本
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # 安装 Docker Compose
    sudo apt-get update
    sudo apt-get install docker-compose-plugin
    
    # 将当前用户添加到 docker 组
    sudo usermod -aG docker $USER
    
    # 重新登录以使组更改生效
    newgrp docker

**macOS**

.. code-block:: bash

    # 使用 Homebrew 安装
    brew install --cask docker
    
    # 或者从官网下载 Docker Desktop for Mac
    # https://www.docker.com/products/docker-desktop

**Windows**

从官网下载并安装 Docker Desktop for Windows:
https://www.docker.com/products/docker-desktop

步骤 2: 克隆项目
----------------

.. code-block:: bash

    git clone https://github.com/your-org/zishu-sensei.git
    cd zishu-sensei

步骤 3: 配置环境变量
--------------------

.. code-block:: bash

    # 复制环境变量模板
    cp .env.example .env
    
    # 编辑环境变量文件
    vim .env  # 或使用其他编辑器

关键环境变量说明：

.. code-block:: bash

    # 数据库配置
    POSTGRES_USER=zishu
    POSTGRES_PASSWORD=your_secure_password
    POSTGRES_DB=zishu_db
    
    # Redis 配置
    REDIS_HOST=redis
    REDIS_PORT=6379
    
    # API 密钥 (如使用 OpenAI)
    OPENAI_API_KEY=your_openai_api_key
    
    # 应用配置
    DEBUG=false
    SECRET_KEY=your_secret_key

步骤 4: 启动服务
----------------

.. code-block:: bash

    # 构建并启动所有服务
    docker-compose up -d
    
    # 查看服务状态
    docker-compose ps
    
    # 查看日志
    docker-compose logs -f

步骤 5: 验证安装
----------------

.. code-block:: bash

    # 检查 API 健康状态
    curl http://localhost:8000/health
    
    # 访问 API 文档
    # 在浏览器中打开: http://localhost:8000/docs

方式二: 本地开发安装
====================

适合开发者进行本地开发和调试。

步骤 1: 安装 Python 依赖
-------------------------

.. code-block:: bash

    # 创建虚拟环境
    python -m venv venv
    
    # 激活虚拟环境
    # Linux/macOS:
    source venv/bin/activate
    # Windows:
    venv\Scripts\activate
    
    # 升级 pip
    pip install --upgrade pip
    
    # 安装依赖
    pip install -r requirements.txt

步骤 2: 安装数据库
------------------

**PostgreSQL**

.. code-block:: bash

    # Ubuntu/Debian
    sudo apt-get install postgresql postgresql-contrib
    
    # macOS
    brew install postgresql
    
    # 启动 PostgreSQL
    sudo systemctl start postgresql  # Linux
    brew services start postgresql   # macOS

**Redis**

.. code-block:: bash

    # Ubuntu/Debian
    sudo apt-get install redis-server
    
    # macOS
    brew install redis
    
    # 启动 Redis
    sudo systemctl start redis  # Linux
    brew services start redis   # macOS

步骤 3: 配置数据库
------------------

.. code-block:: bash

    # 连接到 PostgreSQL
    sudo -u postgres psql
    
    # 创建数据库和用户
    CREATE DATABASE zishu_db;
    CREATE USER zishu WITH PASSWORD 'your_password';
    GRANT ALL PRIVILEGES ON DATABASE zishu_db TO zishu;
    
    # 退出
    \q

步骤 4: 运行数据库迁移
----------------------

.. code-block:: bash

    # 初始化数据库
    alembic upgrade head

步骤 5: 启动应用
----------------

.. code-block:: bash

    # 开发模式启动
    uvicorn zishu.api.main:app --reload --host 0.0.0.0 --port 8000
    
    # 或使用 Makefile
    make dev

步骤 6: 验证安装
----------------

访问 http://localhost:8000/docs 查看 API 文档。

方式三: 云平台部署
==================

云硬盘环境 (推荐用于生产)
--------------------------

如果您使用云硬盘环境，可以使用我们提供的专用脚本：

.. code-block:: bash

    # 设置云硬盘环境
    bash scripts/setup_cloud_env.sh
    
    # 使用云硬盘环境运行
    bash scripts/run_with_cloud_env.sh -m uvicorn zishu.api.main:app

云服务器部署
------------

详细的云平台部署指南请参考 :doc:`deployment`。

常见问题
========

端口冲突
--------

如果端口 8000 已被占用，可以修改 ``docker-compose.yml`` 中的端口映射：

.. code-block:: yaml

    ports:
      - "8001:8000"  # 将主机端口改为 8001

权限问题
--------

如果遇到权限问题：

.. code-block:: bash

    # 确保数据目录有正确的权限
    sudo chown -R $USER:$USER ./data
    
    # Docker 权限问题
    sudo usermod -aG docker $USER
    newgrp docker

数据库连接失败
--------------

检查数据库服务是否正常运行：

.. code-block:: bash

    # 查看 Docker 容器状态
    docker-compose ps
    
    # 查看数据库日志
    docker-compose logs postgres

模型下载慢
----------

如果 HuggingFace 模型下载缓慢，可以配置镜像：

.. code-block:: bash

    # 设置 HuggingFace 镜像
    export HF_ENDPOINT=https://hf-mirror.com

卸载
====

如果需要完全卸载系统：

.. code-block:: bash

    # 停止并删除所有容器
    docker-compose down -v
    
    # 删除项目目录
    cd ..
    rm -rf zishu-sensei

下一步
======

- 阅读 :doc:`quickstart` 快速开始使用
- 查看 :doc:`configuration` 了解详细配置
- 参考 :doc:`../developer_guide/development_setup` 设置开发环境


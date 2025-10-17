==================
开发环境配置
==================

本指南帮助开发者配置 Zishu-Sensei 的开发环境。

前置要求
========

开发工具
--------

必需工具：

- **Python 3.8+**
- **Git**
- **Docker & Docker Compose** (可选)
- **Node.js 16+** (用于前端开发)
- **PostgreSQL 13+** (本地开发)
- **Redis 6+** (本地开发)

推荐 IDE：

- **VS Code** (推荐)
- **PyCharm Professional**
- **Cursor** (AI 辅助开发)

环境配置
========

1. 克隆仓库
-----------

.. code-block:: bash

    git clone https://github.com/your-org/zishu-sensei.git
    cd zishu-sensei

2. 创建虚拟环境
---------------

.. code-block:: bash

    # 使用云硬盘环境（推荐）
    bash scripts/setup_cloud_env.sh
    
    # 或使用本地虚拟环境
    python -m venv venv
    source venv/bin/activate  # Linux/Mac
    # 或
    venv\Scripts\activate  # Windows

3. 安装依赖
-----------

.. code-block:: bash

    # 使用云硬盘环境
    bash scripts/run_with_cloud_env.sh -m pip install -r requirements.txt
    
    # 或使用本地环境
    pip install -r requirements.txt
    pip install -r requirements-dev.txt

4. 配置环境变量
---------------

.. code-block:: bash

    # 复制模板
    cp .env.example .env
    
    # 编辑配置
    vim .env

5. 初始化数据库
---------------

.. code-block:: bash

    # 创建数据库
    createdb zishu_dev
    
    # 运行迁移
    alembic upgrade head
    
    # 或使用 Makefile
    make db-migrate

开发工作流
==========

启动开发服务
------------

**方式 1: 使用 Docker (推荐)**

.. code-block:: bash

    # 启动开发环境
    make docker-dev-start
    
    # 查看状态
    make docker-dev-status
    
    # 查看日志
    make docker-dev-logs

**方式 2: 本地服务**

.. code-block:: bash

    # 启动数据库和 Redis
    make dev-start
    
    # 启动 API 服务器
    make dev-api
    
    # 或手动启动
    bash scripts/run_with_cloud_env.sh -m uvicorn zishu.api.main:app --reload

代码编辑
--------

1. 创建功能分支：

.. code-block:: bash

    git checkout -b feature/your-feature-name

2. 编写代码并遵循编码规范（参见 :doc:`coding_standards`）

3. 运行测试：

.. code-block:: bash

    make test

4. 提交代码：

.. code-block:: bash

    git add .
    git commit -m "feat: add your feature"
    git push origin feature/your-feature-name

代码质量检查
------------

.. code-block:: bash

    # 代码格式化
    make format
    
    # 代码检查
    make lint
    
    # 类型检查
    make type-check
    
    # 运行所有检查
    make check

开发工具
========

VS Code 配置
------------

安装推荐插件：

- Python
- Pylance
- Python Test Explorer
- Docker
- GitLens
- REST Client

``.vscode/settings.json``:

.. code-block:: json

    {
      "python.defaultInterpreterPath": "/data/zishu-sensei/venv/bin/python",
      "python.linting.enabled": true,
      "python.linting.pylintEnabled": true,
      "python.formatting.provider": "black",
      "python.testing.pytestEnabled": true,
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": {
        "source.organizeImports": true
      }
    }

调试配置
--------

``.vscode/launch.json``:

.. code-block:: json

    {
      "version": "0.2.0",
      "configurations": [
        {
          "name": "Python: FastAPI",
          "type": "python",
          "request": "launch",
          "module": "uvicorn",
          "args": [
            "zishu.api.main:app",
            "--reload",
            "--host",
            "0.0.0.0",
            "--port",
            "8000"
          ],
          "jinja": true,
          "justMyCode": false
        },
        {
          "name": "Python: Current File",
          "type": "python",
          "request": "launch",
          "program": "${file}",
          "console": "integratedTerminal"
        },
        {
          "name": "Python: Pytest",
          "type": "python",
          "request": "launch",
          "module": "pytest",
          "args": [
            "${file}",
            "-v"
          ]
        }
      ]
    }

数据库管理
==========

使用 pgAdmin
------------

.. code-block:: bash

    # 启动 pgAdmin
    make pgadmin
    
    # 访问 http://localhost:5050
    # 用户名: admin@zishu.dev
    # 密码: admin

数据库迁移
----------

.. code-block:: bash

    # 创建新迁移
    alembic revision --autogenerate -m "description"
    
    # 应用迁移
    alembic upgrade head
    
    # 回滚迁移
    alembic downgrade -1
    
    # 查看历史
    alembic history

Redis 管理
==========

使用 Redis Commander
--------------------

.. code-block:: bash

    # 启动 Redis Commander
    make redis-ui
    
    # 访问 http://localhost:8081

使用 Redis CLI
--------------

.. code-block:: bash

    # 连接到 Redis
    make shell-redis
    
    # 常用命令
    KEYS *
    GET key_name
    SET key_name value
    DEL key_name

前端开发
========

Desktop App 开发
----------------

.. code-block:: bash

    # 进入前端目录
    cd desktop_app
    
    # 安装依赖
    npm install
    
    # 启动开发服务器
    npm run dev
    
    # 构建
    npm run build

测试
====

运行测试
--------

.. code-block:: bash

    # 运行所有测试
    make test
    
    # 运行特定测试文件
    pytest tests/unit/test_adapter.py
    
    # 运行并生成覆盖率报告
    make test-coverage
    
    # 查看覆盖率报告
    open htmlcov/index.html

编写测试
--------

单元测试示例：

.. code-block:: python

    import pytest
    from zishu.adapters.soft.rag_engine import RAGEngine

    @pytest.fixture
    async def rag_engine():
        """创建 RAG 引擎实例"""
        config = {
            "chunk_size": 512,
            "chunk_overlap": 50,
            "top_k": 5
        }
        engine = RAGEngine(config)
        await engine.initialize()
        yield engine
        await engine.shutdown()

    @pytest.mark.asyncio
    async def test_retrieve(rag_engine):
        """测试检索功能"""
        results = await rag_engine.retrieve("测试查询")
        assert len(results) > 0
        assert results[0].score > 0.5

性能分析
========

Profiling
---------

.. code-block:: bash

    # 运行性能分析
    make profile
    
    # 使用 py-spy
    py-spy record -o profile.svg -- python -m uvicorn zishu.api.main:app

监控
----

.. code-block:: bash

    # 启动监控服务
    make monitor
    
    # 访问 Prometheus: http://localhost:9090
    # 访问 Grafana: http://localhost:3000

调试技巧
========

日志调试
--------

.. code-block:: python

    from loguru import logger
    
    # 添加日志
    logger.debug("调试信息")
    logger.info("普通信息")
    logger.warning("警告信息")
    logger.error("错误信息")
    
    # 查看日志
    tail -f logs/app.log

断点调试
--------

.. code-block:: python

    # 使用 pdb
    import pdb; pdb.set_trace()
    
    # 或使用 ipdb (更友好)
    import ipdb; ipdb.set_trace()

远程调试
--------

.. code-block:: python

    # 使用 debugpy
    import debugpy
    debugpy.listen(("0.0.0.0", 5678))
    debugpy.wait_for_client()

常见问题
========

依赖冲突
--------

.. code-block:: bash

    # 清理缓存
    pip cache purge
    
    # 重新安装
    pip install -r requirements.txt --force-reinstall

数据库连接失败
--------------

检查数据库是否运行：

.. code-block:: bash

    # 检查 PostgreSQL 状态
    sudo systemctl status postgresql
    
    # 检查连接
    psql -U zishu -d zishu_dev -h localhost

端口占用
--------

.. code-block:: bash

    # 查找占用端口的进程
    lsof -i :8000
    
    # 结束进程
    kill -9 <PID>

最佳实践
========

1. **使用虚拟环境**: 隔离项目依赖
2. **频繁提交**: 保持小而频繁的提交
3. **编写测试**: 确保代码质量
4. **代码审查**: 提交前自我审查
5. **文档更新**: 同步更新文档
6. **日志记录**: 添加有意义的日志
7. **性能考虑**: 注意性能影响

下一步
======

- 阅读 :doc:`coding_standards` 了解编码规范
- 查看 :doc:`testing` 学习测试策略
- 参考 :doc:`contributing` 了解贡献流程


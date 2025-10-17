==================================
Zishu-Sensei 项目文档
==================================

欢迎来到 Zishu-Sensei 项目的完整文档！

Zishu-Sensei 是一个先进的 AI 学习助手系统，集成了大语言模型（LLM）、RAG（检索增强生成）、
知识图谱等技术，为用户提供智能化的学习辅助服务。

.. image:: https://img.shields.io/badge/python-3.8+-blue.svg
   :target: https://www.python.org/downloads/
   :alt: Python Version

.. image:: https://img.shields.io/badge/fastapi-0.109+-green.svg
   :target: https://fastapi.tiangolo.com/
   :alt: FastAPI

.. image:: https://img.shields.io/badge/license-MIT-blue.svg
   :target: https://opensource.org/licenses/MIT
   :alt: License

快速导航
========

.. toctree::
   :maxdepth: 2
   :caption: 用户指南

   user_guide/introduction
   user_guide/installation
   user_guide/quickstart
   user_guide/configuration
   user_guide/deployment

.. toctree::
   :maxdepth: 2
   :caption: 开发文档

   developer_guide/architecture
   developer_guide/development_setup
   developer_guide/coding_standards
   developer_guide/testing
   developer_guide/contributing

.. toctree::
   :maxdepth: 3
   :caption: API 参考

   api/core
   api/adapters
   api/services
   api/models
   api/utils

.. toctree::
   :maxdepth: 2
   :caption: 教程和示例

   tutorials/basic_usage
   tutorials/rag_tutorial
   tutorials/custom_adapter
   tutorials/deployment_tutorial

.. toctree::
   :maxdepth: 1
   :caption: 附录

   appendix/faq
   appendix/troubleshooting
   appendix/changelog
   appendix/glossary

核心特性
========

🚀 **高性能架构**
   - 基于 FastAPI 的异步 Web 框架
   - 支持高并发请求处理
   - 优化的数据库查询和缓存策略

🧠 **智能适配器系统**
   - 可插拔的适配器架构
   - 支持多种 LLM 模型（OpenAI、Claude、本地模型等）
   - RAG 引擎集成，增强知识检索能力

📚 **知识管理**
   - 向量数据库支持（Qdrant）
   - 自动文档索引和检索
   - 知识图谱构建和查询

🔐 **安全可靠**
   - JWT 身份认证
   - 数据加密和隐私保护
   - 完善的错误处理和日志记录

📊 **监控和分析**
   - 健康检查和状态监控
   - 性能指标收集
   - 事件追踪系统

技术栈
======

**后端框架**
   - FastAPI 0.109+
   - SQLAlchemy 2.0
   - PostgreSQL
   - Redis

**AI/ML 工具**
   - PyTorch 2.1+
   - Transformers 4.36+
   - Sentence-Transformers
   - LangChain

**向量数据库**
   - Qdrant
   - FAISS

**开发工具**
   - Docker & Docker Compose
   - Pytest
   - Black & isort
   - MyPy

索引和搜索
==========

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

获取帮助
========

如果您在使用过程中遇到问题，可以通过以下方式获取帮助：

- 查看 :doc:`appendix/faq` 获取常见问题解答
- 访问 :doc:`appendix/troubleshooting` 查找故障排除指南
- 在 GitHub 提交 Issue
- 发送邮件至开发团队

许可证
======

本项目采用 Apache 2.0 许可证。详情请参阅 LICENSE 文件。

联系我们
========

- **GitHub**: https://github.com/your-org/zishu-sensei
- **Email**: support@zishu-sensei.com
- **文档**: https://docs.zishu-sensei.com

更新日志
========

查看 :doc:`appendix/changelog` 了解最新的项目更新和改进。


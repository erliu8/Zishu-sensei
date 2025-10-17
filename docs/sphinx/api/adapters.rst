================
适配器 API
================

适配器概述
==========

Zishu-Sensei 使用适配器模式来实现不同功能模块的可插拔架构。

适配器基类
----------

.. automodule:: zishu.adapters.base
   :members:
   :undoc-members:
   :show-inheritance:

Core Adapter
============

核心适配器提供基础服务功能。

核心适配器主类
--------------

.. automodule:: zishu.adapters.core.adapter
   :members:
   :undoc-members:
   :show-inheritance:

健康检查服务
------------

.. automodule:: zishu.adapters.core.services.health_service
   :members:
   :undoc-members:
   :show-inheritance:
   :exclude-members: __dict__,__weakref__

事件服务
--------

.. automodule:: zishu.adapters.core.services.event_service
   :members:
   :undoc-members:
   :show-inheritance:
   :exclude-members: __dict__,__weakref__

Soft Adapter
============

软适配器提供 AI 相关功能。

软适配器主类
------------

.. automodule:: zishu.adapters.soft.adapter
   :members:
   :undoc-members:
   :show-inheritance:

RAG 引擎
--------

.. automodule:: zishu.adapters.soft.rag_engine
   :members:
   :undoc-members:
   :show-inheritance:
   :exclude-members: __dict__,__weakref__

主要类和方法
~~~~~~~~~~~~

.. autoclass:: zishu.adapters.soft.rag_engine.RAGEngine
   :members:
   :special-members: __init__
   :member-order: bysource

.. autoclass:: zishu.adapters.soft.rag_engine.RetrievalResult
   :members:

Prompt 引擎
-----------

.. automodule:: zishu.adapters.soft.prompt_engine
   :members:
   :undoc-members:
   :show-inheritance:
   :exclude-members: __dict__,__weakref__

主要类和方法
~~~~~~~~~~~~

.. autoclass:: zishu.adapters.soft.prompt_engine.PromptEngine
   :members:
   :special-members: __init__
   :member-order: bysource

Hard Adapter
============

硬适配器提供硬件加速相关功能。

硬适配器主类
------------

.. automodule:: zishu.adapters.hard.adapter
   :members:
   :undoc-members:
   :show-inheritance:
   :noindex:

适配器工厂
==========

.. automodule:: zishu.adapters.factory
   :members:
   :undoc-members:
   :show-inheritance:


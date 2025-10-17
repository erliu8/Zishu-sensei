================
系统架构
================

本文档详细介绍 Zishu-Sensei 的系统架构设计。

整体架构
========

Zishu-Sensei 采用分层架构设计，主要包括以下几层：

.. code-block:: text

    ┌─────────────────────────────────────────────────────┐
    │                  表示层 (Presentation)               │
    │            Desktop App (React + Electron)           │
    └────────────────────┬────────────────────────────────┘
                         │ REST API / WebSocket
    ┌────────────────────┴────────────────────────────────┐
    │                  API 网关层 (API Gateway)            │
    │                   FastAPI Routes                    │
    │          认证、限流、请求验证、错误处理               │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │              业务逻辑层 (Business Logic)             │
    │                  Service Layer                      │
    │      用户管理、对话管理、知识管理、权限控制           │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │              适配器层 (Adapter Layer)                │
    │    Core Adapter | Soft Adapter | Hard Adapter      │
    │    基础服务     | AI 功能      | 硬件加速             │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │              数据访问层 (Data Access)                │
    │           ORM (SQLAlchemy) / Cache / Vector DB      │
    └────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┴────────────────────────────────┐
    │              数据持久层 (Data Persistence)           │
    │       PostgreSQL | Redis | Qdrant | File System    │
    └─────────────────────────────────────────────────────┘

核心设计原则
============

1. 单一职责原则 (SRP)
----------------------

每个模块只负责一个功能领域：

- **API 层**: 只处理 HTTP 请求和响应
- **Service 层**: 只包含业务逻辑
- **Adapter 层**: 只提供特定功能的实现
- **Data 层**: 只负责数据访问

2. 开闭原则 (OCP)
------------------

系统对扩展开放，对修改关闭：

- 使用适配器模式，可以轻松添加新的功能模块
- 通过配置文件而非代码修改来调整行为
- 插件化设计，支持动态加载

3. 依赖倒置原则 (DIP)
----------------------

高层模块不依赖低层模块，都依赖抽象：

.. code-block:: python

    # 定义抽象接口
    class BaseAdapter(ABC):
        @abstractmethod
        async def initialize(self) -> None:
            pass
        
        @abstractmethod
        async def process(self, data: Any) -> Any:
            pass
    
    # 具体实现
    class CoreAdapter(BaseAdapter):
        async def initialize(self) -> None:
            # 初始化逻辑
            pass
        
        async def process(self, data: Any) -> Any:
            # 处理逻辑
            pass

适配器架构
==========

适配器模式详解
--------------

Zishu-Sensei 的核心是适配器架构，将不同功能模块解耦：

.. code-block:: python

    from abc import ABC, abstractmethod
    from typing import Any, Dict

    class BaseAdapter(ABC):
        """适配器基类"""
        
        def __init__(self, config: Dict[str, Any]):
            self.config = config
            self.enabled = config.get('enabled', True)
        
        @abstractmethod
        async def initialize(self) -> None:
            """初始化适配器"""
            pass
        
        @abstractmethod
        async def shutdown(self) -> None:
            """关闭适配器"""
            pass
        
        @abstractmethod
        async def health_check(self) -> bool:
            """健康检查"""
            pass

Core Adapter
------------

提供系统基础服务：

**职责**:

- 健康检查监控
- 事件处理和分发
- 系统状态管理
- 日志和追踪

**主要组件**:

.. code-block:: python

    class CoreAdapter(BaseAdapter):
        """核心适配器"""
        
        def __init__(self, config: Dict[str, Any]):
            super().__init__(config)
            self.health_service = HealthService()
            self.event_service = EventService()
        
        async def initialize(self) -> None:
            await self.health_service.start()
            await self.event_service.start()
        
        async def emit_event(self, event: Event) -> None:
            """发出事件"""
            await self.event_service.emit(event)

Soft Adapter
------------

提供 AI 相关功能：

**职责**:

- LLM 模型调用
- RAG 检索增强
- Prompt 管理
- 对话历史管理

**主要组件**:

.. code-block:: python

    class SoftAdapter(BaseAdapter):
        """软适配器"""
        
        def __init__(self, config: Dict[str, Any]):
            super().__init__(config)
            self.rag_engine = RAGEngine(config['rag'])
            self.prompt_engine = PromptEngine(config['prompt'])
            self.llm_client = LLMClient(config['llm'])
        
        async def query(self, text: str, context: Dict) -> str:
            """执行查询"""
            # 1. 检索相关文档
            docs = await self.rag_engine.retrieve(text)
            
            # 2. 构建 prompt
            prompt = await self.prompt_engine.build(text, docs, context)
            
            # 3. 调用 LLM
            response = await self.llm_client.complete(prompt)
            
            return response

Hard Adapter
------------

提供硬件加速功能：

**职责**:

- GPU 加速推理
- 模型量化
- 批处理优化
- 硬件资源管理

数据流架构
==========

请求处理流程
------------

.. code-block:: text

    ┌──────────┐
    │  客户端  │
    └────┬─────┘
         │ 1. HTTP Request
    ┌────▼──────────────────────────────────────┐
    │            API Gateway                     │
    │  - 认证 (JWT)                              │
    │  - 限流检查                                │
    │  - 请求验证 (Pydantic)                     │
    └────┬──────────────────────────────────────┘
         │ 2. Validated Request
    ┌────▼──────────────────────────────────────┐
    │         Service Layer                      │
    │  - 业务逻辑处理                            │
    │  - 权限检查                                │
    │  - 数据转换                                │
    └────┬──────────────────────────────────────┘
         │ 3. Service Call
    ┌────▼──────────────────────────────────────┐
    │        Adapter Layer                       │
    │  - 调用适配器                              │
    │  - 执行具体功能                            │
    └────┬──────────────────────────────────────┘
         │ 4. Data Operation
    ┌────▼──────────────────────────────────────┐
    │         Data Layer                         │
    │  - 数据库查询                              │
    │  - 缓存读写                                │
    │  - 向量检索                                │
    └────┬──────────────────────────────────────┘
         │ 5. Response
    ┌────▼─────┐
    │  客户端  │
    └──────────┘

对话处理流程
------------

.. code-block:: python

    async def handle_chat_request(request: ChatRequest) -> ChatResponse:
        """处理对话请求"""
        
        # 1. 用户认证和权限检查
        user = await auth_service.get_current_user(request.token)
        
        # 2. 获取对话历史
        history = await chat_service.get_conversation_history(
            user.id, 
            request.conversation_id
        )
        
        # 3. RAG 检索 (如果启用)
        if request.use_rag:
            relevant_docs = await soft_adapter.rag_engine.retrieve(
                query=request.message,
                top_k=5
            )
        else:
            relevant_docs = []
        
        # 4. 构建 prompt
        prompt = await soft_adapter.prompt_engine.build(
            message=request.message,
            history=history,
            documents=relevant_docs,
            system_prompt=request.system_prompt
        )
        
        # 5. 调用 LLM
        response = await soft_adapter.llm_client.complete(
            prompt=prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        # 6. 保存对话记录
        await chat_service.save_message(
            conversation_id=request.conversation_id,
            role='assistant',
            content=response.content
        )
        
        # 7. 发出事件
        await core_adapter.event_service.emit(
            Event(
                type='chat.completed',
                data={'user_id': user.id, 'message_id': response.id}
            )
        )
        
        # 8. 返回响应
        return ChatResponse(
            message=response.content,
            conversation_id=request.conversation_id,
            message_id=response.id
        )

数据模型设计
============

核心实体关系
------------

.. code-block:: text

    ┌──────────┐         ┌──────────────┐         ┌──────────┐
    │   User   │────────▶│ Conversation │◀────────│ Message  │
    └──────────┘ 1     * └──────────────┘ 1     * └──────────┘
                                 │
                                 │ *
                                 ▼ 1
                         ┌──────────────┐
                         │  Knowledge   │
                         └──────────────┘
                                 │
                                 │ *
                                 ▼ 1
                         ┌──────────────┐
                         │  Document    │
                         └──────────────┘

用户模型
--------

.. code-block:: python

    class User(Base):
        """用户模型"""
        __tablename__ = "users"
        
        id = Column(Integer, primary_key=True)
        username = Column(String(50), unique=True, nullable=False)
        email = Column(String(100), unique=True, nullable=False)
        password_hash = Column(String(255), nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        
        # 关系
        conversations = relationship("Conversation", back_populates="user")

对话模型
--------

.. code-block:: python

    class Conversation(Base):
        """对话模型"""
        __tablename__ = "conversations"
        
        id = Column(Integer, primary_key=True)
        user_id = Column(Integer, ForeignKey("users.id"))
        title = Column(String(200))
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, onupdate=datetime.utcnow)
        
        # 关系
        user = relationship("User", back_populates="conversations")
        messages = relationship("Message", back_populates="conversation")

缓存策略
========

多层缓存架构
------------

.. code-block:: text

    ┌─────────────────────────────────────────────────┐
    │              应用层缓存 (In-Memory)              │
    │                LRU Cache (1000 items)           │
    │                TTL: 5 minutes                   │
    └─────────────────┬───────────────────────────────┘
                      │ Cache Miss
    ┌─────────────────▼───────────────────────────────┐
    │              Redis 缓存 (Distributed)            │
    │                TTL: 1 hour                      │
    └─────────────────┬───────────────────────────────┘
                      │ Cache Miss
    ┌─────────────────▼───────────────────────────────┐
    │              数据库 (PostgreSQL)                 │
    └─────────────────────────────────────────────────┘

缓存实现
--------

.. code-block:: python

    from functools import lru_cache
    import redis
    
    class CacheService:
        """缓存服务"""
        
        def __init__(self):
            self.redis_client = redis.Redis()
        
        @lru_cache(maxsize=1000)
        async def get_user(self, user_id: int) -> User:
            """获取用户（带缓存）"""
            # 先查 Redis
            cached = await self.redis_client.get(f"user:{user_id}")
            if cached:
                return User.parse_raw(cached)
            
            # 再查数据库
            user = await db.query(User).get(user_id)
            
            # 写入 Redis
            await self.redis_client.setex(
                f"user:{user_id}",
                3600,  # 1 hour
                user.json()
            )
            
            return user

异步处理
========

任务队列
--------

使用 Celery 处理异步任务：

.. code-block:: python

    from celery import Celery
    
    celery_app = Celery('zishu', broker='redis://localhost:6379/0')
    
    @celery_app.task
    async def process_document(document_id: int):
        """异步处理文档"""
        document = await get_document(document_id)
        
        # 1. 提取文本
        text = await extract_text(document)
        
        # 2. 分块
        chunks = await chunk_text(text)
        
        # 3. 生成嵌入
        embeddings = await generate_embeddings(chunks)
        
        # 4. 存储到向量数据库
        await store_vectors(embeddings)

错误处理
========

统一异常处理
------------

.. code-block:: python

    from fastapi import HTTPException
    
    class ZishuException(Exception):
        """基础异常类"""
        def __init__(self, message: str, code: str):
            self.message = message
            self.code = code
    
    @app.exception_handler(ZishuException)
    async def zishu_exception_handler(request, exc):
        """全局异常处理"""
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message
                }
            }
        )

安全架构
========

认证和授权
----------

使用 JWT 进行身份认证：

.. code-block:: python

    from jose import jwt
    
    async def create_access_token(user_id: int) -> str:
        """创建访问令牌"""
        payload = {
            "user_id": user_id,
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    async def verify_token(token: str) -> int:
        """验证令牌"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            return payload["user_id"]
        except jwt.JWTError:
            raise AuthenticationError("Invalid token")

扩展性设计
==========

水平扩展
--------

- 无状态 API 服务器，可任意增加实例
- 使用 Redis 共享会话状态
- 数据库读写分离，支持读副本

垂直扩展
--------

- 支持 GPU 加速推理
- 数据库连接池动态调整
- 缓存大小可配置

性能优化
========

数据库优化
----------

- 使用索引加速查询
- 实现查询结果缓存
- 批量操作减少往返次数

API 优化
--------

- 实现 GraphQL 减少过度获取
- 使用 HTTP/2 多路复用
- 启用响应压缩

下一步
======

- 查看 :doc:`development_setup` 设置开发环境
- 阅读 :doc:`coding_standards` 了解编码规范
- 参考 :doc:`testing` 学习测试策略


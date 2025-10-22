# 📊 Zishu-sensei 数据存储策略指南

> 针对 PostgreSQL、Redis、Qdrant 三大存储系统的最佳实践
> 生成时间：2025年10月22日

---

## 📑 目录

1. [存储系统概览](#1-存储系统概览)
2. [PostgreSQL - 关系数据存储](#2-postgresql---关系数据存储)
3. [Redis - 缓存与会话](#3-redis---缓存与会话)
4. [Qdrant - 向量数据库](#4-qdrant---向量数据库)
5. [数据流转关系](#5-数据流转关系)
6. [最佳实践](#6-最佳实践)
7. [实施方案](#7-实施方案)

---

## 1. 存储系统概览

### 1.1 三层存储架构

```
┌─────────────────────────────────────────────────────────┐
│                   应用层 (Zishu Core)                    │
└───────────┬──────────────┬──────────────┬───────────────┘
            │              │              │
    ┌───────▼──────┐  ┌───▼─────┐  ┌────▼──────┐
    │ PostgreSQL   │  │  Redis  │  │  Qdrant   │
    │ 关系型数据   │  │  缓存   │  │  向量库   │
    └──────────────┘  └─────────┘  └───────────┘
         持久化         临时/热数据      AI/语义
```

### 1.2 核心定位

| 存储系统 | 类型 | 主要用途 | 数据特点 |
|---------|------|---------|---------|
| **PostgreSQL** | 关系型数据库 | 结构化数据持久化 | 事务性、关系复杂 |
| **Redis** | 内存数据库 | 缓存与实时数据 | 高速读写、临时性 |
| **Qdrant** | 向量数据库 | 语义搜索与AI | 高维向量、相似度 |

---

## 2. PostgreSQL - 关系数据存储

### 2.1 存储数据类型

#### ✅ **核心业务数据**

```sql
-- 1. 用户系统
users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    settings JSONB,  -- 用户偏好设置
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- 用户配置（复杂JSON）
user_preferences (
    user_id UUID REFERENCES users(id),
    theme VARCHAR(50),  -- anime, dark, cyberpunk
    language VARCHAR(10),  -- zh-CN, en-US, ja-JP
    character_id UUID,  -- 当前使用的角色
    hotkeys JSONB,  -- 快捷键配置
    privacy_settings JSONB,  -- 隐私设置
    adapter_config JSONB  -- 适配器配置
);
```

```sql
-- 2. 适配器系统
adapters (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    type VARCHAR(20),  -- soft, hard, intelligent_hard
    category VARCHAR(50),  -- office, data_analysis, browser, etc.
    version VARCHAR(20),
    author_id UUID REFERENCES users(id),
    icon_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    
    -- 适配器元数据
    metadata JSONB,  -- {platform: "win/mac/linux", dependencies: [...]}
    config_schema JSONB,  -- 配置项JSON Schema
    
    -- 状态与统计
    status VARCHAR(20) DEFAULT 'active',  -- active, deprecated, archived
    downloads_count INTEGER DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    
    -- 审核信息
    is_official BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 适配器版本管理
adapter_versions (
    id UUID PRIMARY KEY,
    adapter_id UUID REFERENCES adapters(id),
    version VARCHAR(20) NOT NULL,
    changelog TEXT,
    package_url VARCHAR(500),
    package_size BIGINT,
    package_hash VARCHAR(64),  -- SHA256
    requirements JSONB,  -- Python/Node依赖
    min_app_version VARCHAR(20),
    is_latest BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP DEFAULT NOW()
);

-- 适配器评分
adapter_ratings (
    id UUID PRIMARY KEY,
    adapter_id UUID REFERENCES adapters(id),
    user_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(adapter_id, user_id)
);

-- 适配器依赖关系
adapter_dependencies (
    adapter_id UUID REFERENCES adapters(id),
    dependency_id UUID REFERENCES adapters(id),
    min_version VARCHAR(20),
    max_version VARCHAR(20),
    required BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (adapter_id, dependency_id)
);
```

```sql
-- 3. 对话历史（核心业务数据）
conversations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(200),
    character_id UUID,  -- 使用的角色
    adapter_ids UUID[],  -- 启用的适配器列表
    context JSONB,  -- 对话上下文
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20),  -- user, assistant, system
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',  -- text, image, file
    
    -- 元数据
    metadata JSONB,  -- {adapter_used, tokens, cost, etc.}
    attachments JSONB,  -- 附件信息
    
    -- AI相关
    model VARCHAR(50),  -- gpt-4, claude-3, etc.
    tokens_used INTEGER,
    cost DECIMAL(10,6),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_conversation_created (conversation_id, created_at)
);
```

```sql
-- 4. 角色系统
characters (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    personality TEXT,  -- 人格描述
    
    -- Live2D模型
    model_url VARCHAR(500),
    model_config JSONB,  -- Live2D配置
    expressions JSONB,  -- 表情映射
    motions JSONB,  -- 动作列表
    
    -- 语音
    voice_id VARCHAR(50),
    voice_config JSONB,
    
    -- 系统提示词
    system_prompt TEXT,
    greeting_message TEXT,
    
    -- 状态
    is_official BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    author_id UUID REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

```sql
-- 5. 工作流系统
workflows (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 工作流定义
    definition JSONB,  -- 节点和连接定义
    adapters JSONB,  -- 使用的适配器配置
    
    -- 状态
    is_public BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    
    -- 统计
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 工作流执行历史
workflow_executions (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    user_id UUID REFERENCES users(id),
    
    status VARCHAR(20),  -- running, completed, failed
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER
);
```

```sql
-- 6. 文件系统
files (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_type VARCHAR(50),
    file_size BIGINT,
    mime_type VARCHAR(100),
    
    -- 存储信息
    storage_path VARCHAR(500),  -- 实际存储路径
    storage_type VARCHAR(20) DEFAULT 'local',  -- local, s3, oss
    
    -- 元数据
    metadata JSONB,  -- {width, height, duration, etc.}
    tags VARCHAR(50)[],
    
    -- 关联
    related_entity_type VARCHAR(50),  -- adapter, character, message
    related_entity_id UUID,
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

```sql
-- 7. 社区系统
posts (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50),
    tags VARCHAR(50)[],
    
    -- 统计
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    
    -- 状态
    is_pinned BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'published',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_category_created (category, created_at),
    INDEX idx_tags (tags) USING GIN
);

comments (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    parent_id UUID REFERENCES comments(id),  -- 支持嵌套
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

likes (
    user_id UUID REFERENCES users(id),
    entity_type VARCHAR(20),  -- post, comment, adapter
    entity_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, entity_type, entity_id)
);
```

```sql
-- 8. 系统配置与日志
system_configs (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT NOW()
);

audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_action_created (action, created_at)
);
```

### 2.2 PostgreSQL 特性应用

```sql
-- 1. JSONB 高级查询
-- 查询特定主题配置的用户
SELECT * FROM users 
WHERE settings->>'theme' = 'cyberpunk';

-- 查询支持特定平台的适配器
SELECT * FROM adapters 
WHERE metadata @> '{"platform": ["windows", "macos"]}';

-- 2. 全文搜索
-- 适配器全文搜索
CREATE INDEX idx_adapter_fulltext ON adapters 
USING GIN (to_tsvector('english', name || ' ' || description));

SELECT * FROM adapters 
WHERE to_tsvector('english', name || ' ' || description) 
      @@ to_tsquery('english', 'office & automation');

-- 3. 数组操作
-- 查询包含特定标签的帖子
SELECT * FROM posts WHERE 'tutorial' = ANY(tags);

-- 4. 窗口函数
-- 获取每个分类的热门帖子
SELECT * FROM (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY category ORDER BY view_count DESC) as rank
    FROM posts
) WHERE rank <= 10;

-- 5. 物化视图（性能优化）
CREATE MATERIALIZED VIEW adapter_statistics AS
SELECT 
    a.id,
    a.name,
    a.downloads_count,
    a.rating_avg,
    COUNT(DISTINCT ar.user_id) as review_count,
    COUNT(DISTINCT av.id) as version_count
FROM adapters a
LEFT JOIN adapter_ratings ar ON a.id = ar.adapter_id
LEFT JOIN adapter_versions av ON a.id = av.adapter_id
GROUP BY a.id;

-- 定期刷新
REFRESH MATERIALIZED VIEW CONCURRENTLY adapter_statistics;
```

---

## 3. Redis - 缓存与会话

### 3.1 存储数据类型

#### ✅ **1. 会话管理**

```redis
# 用户会话（String + Hash）
Key: session:{session_id}
Type: Hash
TTL: 7200 (2小时)
Value: {
    user_id: "uuid",
    username: "username",
    email: "email",
    login_at: "timestamp",
    ip_address: "xxx.xxx.xxx.xxx",
    user_agent: "Mozilla/5.0...",
    permissions: ["read", "write"]
}

# JWT Token黑名单（Set）
Key: jwt:blacklist
Type: Set
Members: ["token1", "token2", ...]
TTL: token过期时间
```

#### ✅ **2. 热点数据缓存**

```redis
# 适配器详情缓存
Key: cache:adapter:{adapter_id}
Type: String (JSON)
TTL: 3600 (1小时)
Value: {完整的适配器信息}

# 用户信息缓存
Key: cache:user:{user_id}
Type: Hash
TTL: 1800 (30分钟)
Value: {用户基本信息}

# 热门适配器列表
Key: cache:adapters:popular
Type: List
TTL: 600 (10分钟)
Value: [adapter_id1, adapter_id2, ...]

# 适配器搜索结果缓存
Key: cache:search:{query_hash}
Type: String (JSON)
TTL: 300 (5分钟)
Value: [搜索结果]
```

#### ✅ **3. 实时计数器**

```redis
# 适配器下载计数（会定期同步到PostgreSQL）
Key: counter:adapter:downloads:{adapter_id}
Type: String
TTL: 无限期
Value: "12345"

# 帖子浏览计数
Key: counter:post:views:{post_id}
Type: String
TTL: 86400 (24小时，然后同步)
Value: "678"

# 在线用户数
Key: counter:users:online
Type: String
TTL: 60 (1分钟)
Value: "123"

# 适配器实时评分（HyperLogLog）
Key: stats:adapter:unique_users:{adapter_id}
Type: HyperLogLog
Value: 唯一用户访问统计
```

#### ✅ **4. 限流与防刷**

```redis
# API限流（滑动窗口）
Key: ratelimit:{user_id}:{api_endpoint}
Type: Sorted Set
TTL: 3600 (1小时)
Members: {timestamp: request_id}

# 示例：检查是否超过限流
ZREMRANGEBYSCORE ratelimit:user123:/api/chat 0 (now - 3600)
ZCARD ratelimit:user123:/api/chat  # 如果 > 100，拒绝请求
ZADD ratelimit:user123:/api/chat now request_id

# IP黑名单
Key: blacklist:ip
Type: Set
Members: ["1.2.3.4", "5.6.7.8"]
TTL: 无限期或设定时间
```

#### ✅ **5. 消息队列**

```redis
# 异步任务队列
Key: queue:tasks:{priority}
Type: List
Value: [task_json1, task_json2, ...]

# 示例：添加任务
LPUSH queue:tasks:high '{"type":"generate_report","data":{...}}'

# 示例：消费任务
BRPOP queue:tasks:high queue:tasks:normal queue:tasks:low 0

# 工作流执行队列
Key: queue:workflow:{workflow_id}
Type: List
Value: [execution_request1, execution_request2, ...]
```

#### ✅ **6. 发布/订阅**

```redis
# 实时通知频道
Channel: notifications:{user_id}
Message: {
    type: "new_message",
    data: {...}
}

# 系统广播频道
Channel: system:broadcast
Message: {
    type: "maintenance",
    message: "系统将在10分钟后维护"
}

# 适配器状态更新
Channel: adapter:status:{adapter_id}
Message: {
    status: "ready",
    version: "1.2.0"
}
```

#### ✅ **7. 临时数据存储**

```redis
# 验证码
Key: verify:email:{email}
Type: String
TTL: 300 (5分钟)
Value: "123456"

# 上传中的文件元数据
Key: upload:session:{upload_id}
Type: Hash
TTL: 7200 (2小时)
Value: {
    filename: "xxx",
    total_chunks: 10,
    uploaded_chunks: [1,2,3]
}

# 对话临时上下文（超出持久化阈值的历史）
Key: chat:context:{conversation_id}
Type: List
TTL: 3600 (1小时)
Value: [最近50条消息]
```

#### ✅ **8. 分布式锁**

```redis
# 适配器安装锁（防止重复安装）
Key: lock:adapter:install:{adapter_id}:{user_id}
Type: String
TTL: 60 (1分钟)
Value: "lock_token"

# 工作流执行锁
Key: lock:workflow:execute:{workflow_id}
Type: String
TTL: 300 (5分钟)
Value: "execution_id"

# 使用方法
SET lock:adapter:install:uuid1:uuid2 token123 NX EX 60
```

#### ✅ **9. 实时排行榜**

```redis
# 热门适配器（按下载量）
Key: leaderboard:adapters:downloads
Type: Sorted Set
Value: {adapter_id: download_count}

# 示例
ZADD leaderboard:adapters:downloads 10000 adapter_id1
ZREVRANGE leaderboard:adapters:downloads 0 9 WITHSCORES  # Top 10

# 活跃用户排行
Key: leaderboard:users:activity:{date}
Type: Sorted Set
Value: {user_id: activity_score}
```

### 3.2 Redis 数据流转策略

```python
# 写入策略（Cache-Aside Pattern）
async def get_adapter(adapter_id: str):
    # 1. 先查Redis
    cache_key = f"cache:adapter:{adapter_id}"
    cached = await redis.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    # 2. Redis没有，查PostgreSQL
    adapter = await db.query(Adapter).filter_by(id=adapter_id).first()
    
    # 3. 写入Redis缓存
    await redis.setex(
        cache_key,
        3600,  # 1小时
        json.dumps(adapter.to_dict())
    )
    
    return adapter

# 更新策略（Write-Through Pattern）
async def update_adapter(adapter_id: str, data: dict):
    # 1. 更新PostgreSQL
    await db.query(Adapter).filter_by(id=adapter_id).update(data)
    await db.commit()
    
    # 2. 删除Redis缓存（下次读取时重建）
    await redis.delete(f"cache:adapter:{adapter_id}")
    
    # 或者：直接更新缓存
    adapter = await db.query(Adapter).filter_by(id=adapter_id).first()
    await redis.setex(
        f"cache:adapter:{adapter_id}",
        3600,
        json.dumps(adapter.to_dict())
    )
```

---

## 4. Qdrant - 向量数据库

### 4.1 存储数据类型

#### ✅ **1. 适配器语义搜索**

```python
Collection: adapters_semantic
Vector Size: 1536  # OpenAI text-embedding-ada-002
Distance: Cosine

Payload Schema:
{
    "adapter_id": "uuid",
    "name": "Office自动化助手",
    "description": "帮助你自动处理Excel、Word、PPT等办公文档",
    "type": "intelligent_hard",
    "category": "office",
    "tags": ["office", "excel", "word", "automation"],
    "rating": 4.8,
    "downloads": 10000,
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 语义搜索："帮我找个能自动生成报表的工具" 
  → 返回相关的适配器
- 相似推荐：基于已安装适配器推荐相似适配器
```

#### ✅ **2. 知识库（RAG）**

```python
Collection: knowledge_base
Vector Size: 1536
Distance: Cosine

Payload Schema:
{
    "chunk_id": "uuid",
    "source_type": "adapter_doc",  # adapter_doc, user_doc, system_doc
    "source_id": "adapter_uuid",
    "title": "适配器开发指南 - 第3章",
    "content": "大段文本内容...",
    "metadata": {
        "page": 3,
        "section": "数据处理",
        "language": "zh-CN"
    },
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 软适配器RAG：检索相关知识回答用户问题
- 文档问答：在适配器文档中快速找到答案
- 智能推荐：根据用户问题推荐相关文档
```

#### ✅ **3. 对话历史语义搜索**

```python
Collection: conversation_history
Vector Size: 1536
Distance: Cosine

Payload Schema:
{
    "message_id": "uuid",
    "conversation_id": "uuid",
    "user_id": "uuid",
    "role": "user",  # user, assistant
    "content": "消息内容",
    "summary": "消息摘要",  # 长消息的摘要
    "adapters_used": ["adapter_id1", "adapter_id2"],
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 跨对话搜索："我上周问过的关于数据分析的问题"
- 上下文增强：找到历史相似对话作为参考
- 个性化推荐：基于历史对话推荐适配器
```

#### ✅ **4. 用户上传文档向量化**

```python
Collection: user_documents
Vector Size: 1536
Distance: Cosine

Payload Schema:
{
    "document_id": "uuid",
    "user_id": "uuid",
    "filename": "年度报告.pdf",
    "chunk_index": 0,
    "content": "文档片段内容...",
    "metadata": {
        "file_type": "pdf",
        "page": 1,
        "total_pages": 100
    },
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 文档智能问答："这份报告里提到的销售额是多少？"
- 跨文档搜索："在我所有文档中找到关于市场分析的内容"
```

#### ✅ **5. 代码片段语义搜索**

```python
Collection: code_snippets
Vector Size: 1536
Distance: Cosine

Payload Schema:
{
    "snippet_id": "uuid",
    "adapter_id": "uuid",
    "title": "Excel数据透视表生成",
    "description": "自动创建数据透视表的代码",
    "code": "def create_pivot_table(...):\n    ...",
    "language": "python",
    "tags": ["excel", "pivot", "data"],
    "usage_count": 100,
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 智能硬适配器代码检索：根据需求找到现有代码复用
- 代码推荐：推荐相似的代码片段
```

#### ✅ **6. 社区帖子语义搜索**

```python
Collection: community_posts
Vector Size: 1536
Distance: Cosine

Payload Schema:
{
    "post_id": "uuid",
    "title": "如何开发一个数据分析适配器？",
    "content": "完整的帖子内容...",
    "author_id": "uuid",
    "category": "tutorial",
    "tags": ["adapter", "data", "tutorial"],
    "view_count": 1000,
    "like_count": 50,
    "created_at": "2025-01-01T00:00:00Z"
}

使用场景:
- 智能问答："有没有关于适配器开发的教程？"
- 相似帖子推荐
```

#### ✅ **7. 多模态向量（未来扩展）**

```python
Collection: multimodal_embeddings
Vector Size: 512  # CLIP embedding
Distance: Cosine

Payload Schema:
{
    "entity_id": "uuid",
    "entity_type": "character",  # character, theme, screenshot
    "modality": "image",  # text, image, audio
    "url": "https://...",
    "description": "志鹤角色立绘",
    "metadata": {...}
}

使用场景:
- 图片搜索："找一个粉色头发的可爱角色"
- 跨模态搜索：文本查图片、图片查文本
```

### 4.2 Qdrant 操作示例

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# 1. 创建集合
client = QdrantClient(host="localhost", port=6333)

client.create_collection(
    collection_name="adapters_semantic",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# 2. 添加向量数据
from openai import OpenAI
openai_client = OpenAI()

def get_embedding(text: str):
    response = openai_client.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response.data[0].embedding

# 向量化适配器
adapter_text = f"{adapter.name} {adapter.description} {' '.join(adapter.tags)}"
embedding = get_embedding(adapter_text)

client.upsert(
    collection_name="adapters_semantic",
    points=[
        PointStruct(
            id=adapter.id,
            vector=embedding,
            payload={
                "adapter_id": str(adapter.id),
                "name": adapter.name,
                "description": adapter.description,
                "type": adapter.type,
                "category": adapter.category,
                "tags": adapter.tags,
                "rating": adapter.rating_avg,
                "downloads": adapter.downloads_count,
            }
        )
    ]
)

# 3. 语义搜索
query = "我需要一个能自动生成Excel报表的工具"
query_embedding = get_embedding(query)

results = client.search(
    collection_name="adapters_semantic",
    query_vector=query_embedding,
    limit=10,
    query_filter={
        "must": [
            {"key": "type", "match": {"value": "intelligent_hard"}},
            {"key": "rating", "range": {"gte": 4.0}}
        ]
    }
)

for result in results:
    print(f"{result.payload['name']} - Score: {result.score}")

# 4. 混合搜索（向量 + 过滤）
results = client.search(
    collection_name="knowledge_base",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "source_type", "match": {"value": "adapter_doc"}},
            {"key": "metadata.language", "match": {"value": "zh-CN"}}
        ]
    }
)
```

---

## 5. 数据流转关系

### 5.1 典型数据流

```
用户请求
    ↓
┌───────────────────────────────────────┐
│  1. 检查 Redis 缓存                    │
│     - 会话验证                         │
│     - 热点数据                         │
└───────┬───────────────────────────────┘
        │ Cache Miss
        ↓
┌───────────────────────────────────────┐
│  2. 查询 PostgreSQL                    │
│     - 获取完整业务数据                  │
│     - 执行复杂关联查询                  │
└───────┬───────────────────────────────┘
        │
        ↓
┌───────────────────────────────────────┐
│  3. 写入 Redis 缓存                    │
│     - 缓存查询结果                     │
│     - 设置合适的TTL                    │
└───────┬───────────────────────────────┘
        │
        ↓
┌───────────────────────────────────────┐
│  4. 如需语义搜索，查询 Qdrant           │
│     - 向量化查询                       │
│     - 语义匹配                         │
└───────┬───────────────────────────────┘
        │
        ↓
┌───────────────────────────────────────┐
│  5. 整合结果返回                       │
└───────────────────────────────────────┘
```

### 5.2 数据同步策略

```python
# 1. Redis → PostgreSQL 定期同步
async def sync_counters_to_postgres():
    """每小时同步一次计数器"""
    while True:
        # 获取所有下载计数
        keys = await redis.keys("counter:adapter:downloads:*")
        
        for key in keys:
            adapter_id = key.split(":")[-1]
            count = int(await redis.get(key))
            
            # 更新PostgreSQL
            await db.query(Adapter)\
                .filter_by(id=adapter_id)\
                .update({"downloads_count": count})
        
        await db.commit()
        await asyncio.sleep(3600)  # 1小时

# 2. PostgreSQL → Redis 预热
async def warmup_cache():
    """启动时预热热门数据"""
    # 加载热门适配器
    popular = await db.query(Adapter)\
        .order_by(Adapter.downloads_count.desc())\
        .limit(100)\
        .all()
    
    for adapter in popular:
        await redis.setex(
            f"cache:adapter:{adapter.id}",
            3600,
            json.dumps(adapter.to_dict())
        )

# 3. PostgreSQL → Qdrant 增量同步
async def sync_to_qdrant():
    """新增/更新适配器时同步到Qdrant"""
    # 获取最近更新的适配器
    recent = await db.query(Adapter)\
        .filter(Adapter.updated_at > last_sync_time)\
        .all()
    
    for adapter in recent:
        # 生成向量
        text = f"{adapter.name} {adapter.description}"
        embedding = get_embedding(text)
        
        # 同步到Qdrant
        qdrant.upsert(
            collection_name="adapters_semantic",
            points=[PointStruct(
                id=adapter.id,
                vector=embedding,
                payload=adapter.to_dict()
            )]
        )
```

---

## 6. 最佳实践

### 6.1 选择合适的存储

```yaml
问题: 我应该把这个数据放在哪？

决策树:
1. 需要事务保证？
   YES → PostgreSQL
   NO  → 继续

2. 需要持久化吗？
   NO  → Redis
   YES → 继续

3. 需要语义搜索？
   YES → Qdrant
   NO  → PostgreSQL

4. 访问频率高吗？
   YES → PostgreSQL + Redis缓存
   NO  → PostgreSQL
```

### 6.2 缓存策略

```python
# 1. 缓存分层
L1 (应用内存): 极热数据，如系统配置
L2 (Redis):    热数据，如用户会话、热门内容
L3 (PostgreSQL): 完整数据，持久化

# 2. TTL设置指南
- 会话数据: 2-4小时
- 用户信息: 30分钟-1小时
- 热门内容: 5-15分钟
- 搜索结果: 5-10分钟
- 计数器: 实时，定期同步

# 3. 缓存失效策略
- 主动失效: 数据更新时删除缓存
- 被动失效: TTL自然过期
- 定时刷新: 定期更新热门数据
```

### 6.3 性能优化

```sql
-- PostgreSQL优化
-- 1. 合适的索引
CREATE INDEX idx_adapters_category_rating 
ON adapters(category, rating_avg DESC);

-- 2. 分区表（大量历史数据）
CREATE TABLE messages_2025_01 PARTITION OF messages
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 3. 连接池配置
pool_size: 20
max_overflow: 10
pool_pre_ping: true

-- 4. 查询优化
EXPLAIN ANALYZE SELECT ...;  -- 分析慢查询
```

```python
# Redis优化
# 1. Pipeline批量操作
pipe = redis.pipeline()
for i in range(1000):
    pipe.set(f"key:{i}", value)
pipe.execute()

# 2. 避免大Key
# BAD: 单个Hash存储百万用户
# GOOD: 分片存储
shard = hash(user_id) % 100
redis.hset(f"users:shard:{shard}", user_id, data)

# 3. 内存优化
# 使用合适的数据结构
# Hash vs String: Hash更节省空间
```

```python
# Qdrant优化
# 1. 批量插入
points = [PointStruct(...) for _ in range(1000)]
client.upsert(collection_name="xxx", points=points)

# 2. 索引优化
client.create_collection(
    collection_name="adapters",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    hnsw_config=HnswConfig(m=16, ef_construct=100)  # 调优参数
)

# 3. 过滤索引
client.create_payload_index(
    collection_name="adapters",
    field_name="category",
    field_schema="keyword"
)
```

---

## 7. 实施方案

### 7.1 Phase 1: 基础架构（1-2周）

```yaml
PostgreSQL:
  - ✅ 设计完整数据模型
  - ✅ 创建所有表结构
  - ✅ 添加必要索引
  - ✅ 配置Alembic迁移

Redis:
  - ✅ 配置Redis连接
  - ✅ 实现缓存管理器
  - ✅ 会话管理
  - ✅ 限流中间件

Qdrant:
  - ✅ 部署Qdrant服务
  - ✅ 创建向量集合
  - ✅ 集成Embedding API
```

### 7.2 Phase 2: 核心功能（2-4周）

```yaml
数据访问层:
  - 实现Repository模式
  - 统一数据访问接口
  - 缓存装饰器

业务逻辑:
  - 适配器CRUD + 缓存
  - 对话系统 + 向量搜索
  - 用户系统 + 会话管理

数据同步:
  - Redis → PostgreSQL 定时任务
  - PostgreSQL → Qdrant 增量同步
```

### 7.3 Phase 3: 优化与监控（1-2周）

```yaml
性能优化:
  - 慢查询优化
  - 缓存命中率监控
  - 数据库连接池调优

监控告警:
  - Redis内存监控
  - PostgreSQL性能监控
  - Qdrant查询延迟监控
```

### 7.4 代码示例

```python
# zishu/database/repository.py
from typing import Optional, List
from sqlalchemy.orm import Session
from .models import Adapter
from ..cache import cache_manager
from ..vector import vector_store

class AdapterRepository:
    """适配器数据访问层"""
    
    def __init__(self, db: Session):
        self.db = db
    
    @cache_manager.cached(ttl=3600, key_prefix="adapter")
    async def get_by_id(self, adapter_id: str) -> Optional[Adapter]:
        """获取适配器（带缓存）"""
        return self.db.query(Adapter).filter_by(id=adapter_id).first()
    
    async def search_semantic(
        self, 
        query: str, 
        limit: int = 10,
        filters: dict = None
    ) -> List[Adapter]:
        """语义搜索适配器"""
        # 1. Qdrant向量搜索
        results = await vector_store.search(
            collection="adapters_semantic",
            query_text=query,
            limit=limit,
            filters=filters
        )
        
        # 2. 根据ID批量查询PostgreSQL获取完整信息
        adapter_ids = [r.payload['adapter_id'] for r in results]
        adapters = self.db.query(Adapter)\
            .filter(Adapter.id.in_(adapter_ids))\
            .all()
        
        # 3. 按相似度排序
        id_to_adapter = {str(a.id): a for a in adapters}
        sorted_adapters = [
            id_to_adapter[r.payload['adapter_id']] 
            for r in results 
            if r.payload['adapter_id'] in id_to_adapter
        ]
        
        return sorted_adapters
    
    async def create(self, adapter_data: dict) -> Adapter:
        """创建适配器"""
        # 1. 写入PostgreSQL
        adapter = Adapter(**adapter_data)
        self.db.add(adapter)
        self.db.commit()
        self.db.refresh(adapter)
        
        # 2. 异步同步到Qdrant
        await vector_store.upsert_adapter(adapter)
        
        # 3. 清除相关缓存
        await cache_manager.delete_pattern("cache:adapters:*")
        
        return adapter
    
    async def increment_downloads(self, adapter_id: str):
        """增加下载计数（Redis实时计数）"""
        key = f"counter:adapter:downloads:{adapter_id}"
        await cache_manager.redis.incr(key)
```

---

## 📊 总结

### 数据存储决策表

| 数据类型 | PostgreSQL | Redis | Qdrant |
|---------|-----------|-------|--------|
| 用户账号 | ✅ 主存储 | ⚡ 会话缓存 | ❌ |
| 适配器元数据 | ✅ 主存储 | ⚡ 热点缓存 | 🔍 语义索引 |
| 对话历史 | ✅ 持久化 | ⚡ 最近N条 | 🔍 历史搜索 |
| 工作流定义 | ✅ 主存储 | ❌ | ❌ |
| 知识库文档 | ✅ 元数据 | ❌ | 🔍 向量搜索 |
| 实时计数 | 📊 定期同步 | ✅ 实时计数 | ❌ |
| API限流 | ❌ | ✅ 滑动窗口 | ❌ |
| 验证码 | ❌ | ✅ 临时存储 | ❌ |
| 文件元数据 | ✅ 主存储 | ⚡ 热点缓存 | 🔍 内容搜索 |
| 社区帖子 | ✅ 主存储 | ⚡ 热帖缓存 | 🔍 语义搜索 |

**符号说明:**
- ✅ 主要存储
- ⚡ 缓存加速
- 🔍 向量搜索
- 📊 数据同步
- ❌ 不适用

### 关键原则

1. **PostgreSQL**: 所有需要持久化、事务保证、复杂关联的数据
2. **Redis**: 所有需要高速访问、临时存储、实时计数的数据
3. **Qdrant**: 所有需要语义理解、相似度匹配的数据

### 数据一致性保证

```
PostgreSQL (Source of Truth)
    ↓ 同步
Redis (Performance Layer)
    ↓ 同步  
Qdrant (Semantic Layer)
```

**写入流程:** 
PostgreSQL → 清除Redis缓存 → 异步同步Qdrant

**读取流程:**
Redis缓存 → PostgreSQL查询 → 回写Redis

---

**文档版本:** v1.0  
**最后更新:** 2025-10-22  
**维护者:** Zishu Team


# 向量搜索服务文档

## 📚 概述

向量搜索服务使用深度学习技术（sentence-transformers）和向量数据库（Qdrant）实现语义搜索和内容推荐。

与传统的关键词搜索不同，向量搜索能够理解文本的语义含义，找到内容相关但用词不同的结果。

## 🎯 核心功能

### 1. 文本嵌入（Embedding）
- 使用多语言模型 `paraphrase-multilingual-MiniLM-L12-v2`
- 支持中英文语义理解
- 向量维度：384（可配置为768）
- 自动批处理优化性能

### 2. 向量搜索
- 语义搜索：理解查询意图，找到语义相关的内容
- 相似度计算：基于余弦相似度
- 灵活过滤：支持分类、标签等条件筛选
- 性能优化：使用 Qdrant 高性能向量数据库

### 3. 内容推荐
- **个性化推荐**：基于用户历史行为（点赞、评论）
- **相似内容推荐**：为每篇帖子推荐相关内容
- **热门内容**：基于互动数据的热度排序
- **智能缓存**：Redis 缓存提升响应速度

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer                          │
│  ┌──────────┬───────────┬──────────────┬─────────────┐ │
│  │  搜索API │ 推荐API   │  相似内容API │  热门API    │ │
│  └──────────┴───────────┴──────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                         │
│  ┌──────────────┬──────────────┬───────────────────┐   │
│  │ Embedding    │ Vector       │ Recommendation    │   │
│  │ Service      │ Search       │ Service           │   │
│  └──────────────┴──────────────┴───────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────┬──────────────────┬──────────────────┐
│   PostgreSQL     │    Qdrant        │      Redis       │
│  (关系数据)      │  (向量索引)      │    (缓存)        │
└──────────────────┴──────────────────┴──────────────────┘
```

## 📁 文件结构

```
app/
├── services/
│   └── search/
│       ├── __init__.py              # 服务导出
│       ├── embedding_service.py     # 文本嵌入服务
│       ├── vector_search.py         # 向量搜索服务
│       └── recommendation.py        # 推荐服务
├── api/v1/endpoints/
│   └── search.py                    # 搜索和推荐 API
└── db/
    └── qdrant.py                    # Qdrant 数据库封装

scripts/
└── manage_vector_index.py           # 索引管理工具
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /opt/zishu-sensei/community_platform/backend
pip install -r requirements.txt
```

主要依赖：
- `sentence-transformers==2.2.2` - 文本嵌入模型
- `qdrant-client==1.7.0` - Qdrant 客户端
- `torch==2.1.2` - PyTorch 深度学习框架

### 2. 配置环境变量

在 `.env` 文件中配置：

```env
# Qdrant 配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=zishu_posts
QDRANT_VECTOR_SIZE=384  # 与模型维度一致
```

### 3. 启动服务

```bash
# 使用 Docker Compose 启动所有服务
docker-compose up -d

# 或单独启动 Qdrant
docker-compose up -d qdrant
```

### 4. 初始化索引

首次使用需要为现有帖子创建向量索引：

```bash
# 查看索引状态
python scripts/manage_vector_index.py status

# 重新索引所有帖子（首次运行必需）
python scripts/manage_vector_index.py reindex

# 测试嵌入服务
python scripts/manage_vector_index.py test-embedding

# 测试搜索
python scripts/manage_vector_index.py search "Python编程教程"
```

## 📖 API 使用

### 1. 向量搜索（语义搜索）

```bash
# POST /api/v1/search/vector
curl -X POST "http://localhost:8000/api/v1/search/vector?query=如何学习编程&limit=10&score_threshold=0.7"
```

**参数：**
- `query` (必需)：搜索查询
- `limit` (可选，默认10)：返回数量
- `score_threshold` (可选，默认0.7)：相似度阈值 (0-1)
- `category` (可选)：分类筛选

**特点：**
- 理解语义含义，如 "学习Python" 和 "Python教程" 会匹配
- 支持中英文混合查询
- 自动回退到文本搜索（当向量搜索失败时）

### 2. 个性化推荐

```bash
# GET /api/v1/search/recommendations
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/v1/search/recommendations?limit=20"
```

**参数：**
- `limit` (可选，默认20)：返回数量
- `refresh` (可选，默认false)：刷新缓存

**特点：**
- 基于用户点赞和评论历史
- 智能推荐相似内容
- 30分钟缓存

### 3. 相似内容推荐

```bash
# GET /api/v1/search/similar/{post_id}
curl "http://localhost:8000/api/v1/search/similar/123?limit=10"
```

**参数：**
- `post_id` (路径参数)：帖子 ID
- `limit` (可选，默认10)：返回数量

**特点：**
- 找到主题相关的帖子
- 优先推荐同类别内容
- 1小时缓存

### 4. 热门内容

```bash
# GET /api/v1/search/trending
curl "http://localhost:8000/api/v1/search/trending?limit=20&hours=24"
```

**参数：**
- `limit` (可选，默认20)：返回数量
- `hours` (可选，默认24)：时间范围（小时）

**特点：**
- 热度计算：点赞数 × 2 + 评论数 × 3 + 浏览数 × 0.1
- 可自定义时间范围
- 15分钟缓存

## 🛠️ 索引管理

### 管理工具命令

```bash
# 查看索引状态
python scripts/manage_vector_index.py status

# 重新索引所有帖子
python scripts/manage_vector_index.py reindex

# 索引单个帖子
python scripts/manage_vector_index.py index 123

# 删除帖子索引
python scripts/manage_vector_index.py delete 123

# 测试搜索
python scripts/manage_vector_index.py search "人工智能应用"

# 测试嵌入服务
python scripts/manage_vector_index.py test-embedding
```

### 自动索引

帖子的创建、更新和删除会自动同步到向量索引：

```python
from app.services.search import get_vector_search_service

# 在帖子创建后
await vector_service.index_post(post)

# 在帖子更新后
await vector_service.update_post_index(post)

# 在帖子删除后
await vector_service.delete_post_index(post.id)
```

## ⚙️ 配置优化

### 1. 模型选择

在 `embedding_service.py` 中可更改模型：

```python
# 默认：多语言小型模型（推荐）
model_name = "paraphrase-multilingual-MiniLM-L12-v2"  # 384维

# 备选：更大的多语言模型（更准确但更慢）
model_name = "distiluse-base-multilingual-cased-v1"  # 512维

# 英文专用（更快）
model_name = "all-MiniLM-L6-v2"  # 384维
```

**注意：** 更改模型后需要：
1. 更新 `QDRANT_VECTOR_SIZE` 配置
2. 重新创建 Qdrant 集合
3. 重新索引所有帖子

### 2. 批处理优化

```python
# 批量索引时调整批处理大小
success_count = await vector_service.batch_index_posts(
    posts, 
    batch_size=50  # 根据内存和CPU调整
)
```

### 3. 相似度阈值

```python
# 较高阈值 (0.8-1.0)：更精确，结果较少
# 中等阈值 (0.6-0.8)：平衡精确度和召回率（推荐）
# 较低阈值 (0.4-0.6)：更宽泛，结果更多

results = await vector_service.search_similar_posts(
    query=query,
    score_threshold=0.7  # 默认值
)
```

### 4. 缓存策略

在 `recommendation.py` 中调整缓存时间：

```python
# 个性化推荐缓存：30分钟
await self.redis.set_json(cache_key, post_ids, expire=1800)

# 相似帖子缓存：1小时
await self.redis.set_json(cache_key, cache_data, expire=3600)

# 热门帖子缓存：15分钟
await self.redis.set_json(cache_key, post_ids, expire=900)
```

## 🧪 测试示例

### Python 测试

```python
import asyncio
from app.services.search import embed_text, get_vector_search_service
from app.db.session import async_session_maker

async def test_vector_search():
    # 测试文本嵌入
    vector = await embed_text("如何学习 Python 编程？")
    print(f"向量维度: {len(vector)}")
    
    # 测试向量搜索
    async with async_session_maker() as db:
        service = get_vector_search_service(db)
        results = await service.search_similar_posts(
            query="Python 教程",
            limit=5,
        )
        
        for post, score in results:
            print(f"[{score:.3f}] {post.title}")

asyncio.run(test_vector_search())
```

### cURL 测试

```bash
# 1. 注册用户
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. 登录获取 token
TOKEN=$(curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}' \
  | jq -r '.access_token')

# 3. 测试向量搜索
curl -X POST "http://localhost:8000/api/v1/search/vector?query=编程学习" \
  -H "Authorization: Bearer $TOKEN"

# 4. 测试个性化推荐
curl "http://localhost:8000/api/v1/search/recommendations" \
  -H "Authorization: Bearer $TOKEN"
```

## 🔍 工作原理

### 向量搜索流程

```
1. 用户输入查询 "如何学习Python"
   ↓
2. 转换为384维向量 [0.12, -0.45, 0.78, ...]
   ↓
3. 在 Qdrant 中搜索相似向量（余弦相似度）
   ↓
4. 返回相似度 > 0.7 的帖子
   ↓
5. 从 PostgreSQL 加载帖子详情
   ↓
6. 返回搜索结果
```

### 个性化推荐流程

```
1. 获取用户最近点赞/评论的帖子
   ↓
2. 为每个帖子找相似内容
   ↓
3. 合并去重推荐结果
   ↓
4. 如果不足，补充热门内容
   ↓
5. 缓存30分钟
   ↓
6. 返回推荐列表
```

## 📊 性能指标

### 响应时间（参考值）

- **文本嵌入**：50-200ms（单个文本）
- **向量搜索**：10-50ms（Qdrant查询）
- **数据库查询**：20-100ms（PostgreSQL）
- **总体响应**：100-400ms

### 索引速度

- **单个帖子**：~100ms
- **批量索引（50个）**：~3-5秒
- **1000个帖子**：~1-2分钟

### 准确性

- **中文语义理解**：优秀
- **英文语义理解**：优秀
- **中英混合**：良好
- **相似度阈值建议**：0.6-0.8

## 🚨 常见问题

### 1. 模型下载慢

首次运行会自动下载模型（~120MB），可能较慢。

**解决方案：**
```bash
# 预先下载模型
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"
```

### 2. 内存不足

向量搜索需要较多内存，特别是 PyTorch。

**解决方案：**
- 减小批处理大小
- 使用更小的模型
- 增加系统内存或使用 GPU

### 3. 搜索结果不相关

相似度阈值可能设置不当。

**解决方案：**
```python
# 提高阈值以获得更精确的结果
score_threshold=0.8  # 而不是 0.5
```

### 4. 索引失败

检查 Qdrant 服务是否运行。

**解决方案：**
```bash
# 检查 Qdrant 状态
docker-compose ps qdrant

# 重启 Qdrant
docker-compose restart qdrant
```

## 🔄 更新和维护

### 定期维护任务

```bash
# 1. 每周重新索引（可选，确保数据一致性）
python scripts/manage_vector_index.py reindex

# 2. 监控索引状态
python scripts/manage_vector_index.py status

# 3. 清理 Redis 缓存（如需）
docker-compose exec redis redis-cli FLUSHDB
```

### 升级模型

```bash
# 1. 修改 embedding_service.py 中的模型名称
# 2. 更新向量维度配置
# 3. 删除旧集合（Qdrant UI: http://localhost:6333/dashboard）
# 4. 重新索引
python scripts/manage_vector_index.py reindex
```

## 📚 参考资源

- [Sentence Transformers 文档](https://www.sbert.net/)
- [Qdrant 文档](https://qdrant.tech/documentation/)
- [向量搜索最佳实践](https://www.pinecone.io/learn/vector-search/)

---

**创建时间**: 2025-10-22  
**版本**: 1.0.0  
**状态**: ✅ 生产就绪


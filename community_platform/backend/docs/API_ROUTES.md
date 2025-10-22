# API 路由文档

紫舒 AI 社区平台完整 API 文档

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API 版本**: v1
- **API 前缀**: `/api/v1`
- **认证方式**: JWT Bearer Token

## 目录

1. [认证 Authentication](#认证-authentication)
2. [用户 Users](#用户-users)
3. [帖子 Posts](#帖子-posts)
4. [评论 Comments](#评论-comments)
5. [搜索 Search](#搜索-search)
6. [通知 Notifications](#通知-notifications)

---

## 认证 Authentication

### 用户注册
```
POST /api/v1/auth/register
```

**请求体**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "full_name": "Test User"
}
```

**响应**: 201 Created
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "full_name": "Test User",
  "avatar_url": null,
  "bio": null,
  "is_verified": false,
  "created_at": "2025-10-22T12:00:00"
}
```

### 用户登录
```
POST /api/v1/auth/login
```

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**响应**: 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### 刷新令牌
```
POST /api/v1/auth/refresh
```

**请求体**:
```json
{
  "refresh_token": "eyJhbGc..."
}
```

### 用户登出
```
POST /api/v1/auth/logout
```

---

## 用户 Users

### 获取当前用户信息
```
GET /api/v1/users/me
```

**认证**: 必需

**响应**: 200 OK
```json
{
  "id": 1,
  "username": "testuser",
  "full_name": "Test User",
  "avatar_url": null,
  "bio": null,
  "is_verified": false,
  "created_at": "2025-10-22T12:00:00"
}
```

### 更新当前用户信息
```
PUT /api/v1/users/me
```

**认证**: 必需

**请求体**:
```json
{
  "full_name": "New Name",
  "bio": "My bio",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### 修改密码
```
POST /api/v1/users/me/change-password
```

**认证**: 必需

**请求体**:
```json
{
  "old_password": "old_pass",
  "new_password": "new_pass"
}
```

### 获取用户详细资料
```
GET /api/v1/users/{user_id}
```

**认证**: 必需

**响应**: 200 OK
```json
{
  "id": 1,
  "username": "testuser",
  "full_name": "Test User",
  "avatar_url": null,
  "bio": null,
  "is_verified": false,
  "created_at": "2025-10-22T12:00:00",
  "follower_count": 10,
  "following_count": 5,
  "post_count": 20,
  "is_following": false
}
```

### 关注用户
```
POST /api/v1/users/{user_id}/follow
```

**认证**: 必需

### 取消关注用户
```
DELETE /api/v1/users/{user_id}/follow
```

**认证**: 必需

### 获取用户粉丝列表
```
GET /api/v1/users/{user_id}/followers?skip=0&limit=20
```

**认证**: 必需

### 获取用户关注列表
```
GET /api/v1/users/{user_id}/following?skip=0&limit=20
```

**认证**: 必需

---

## 帖子 Posts

### 获取帖子列表
```
GET /api/v1/posts?page=1&page_size=20&category=tech&sort=latest
```

**查询参数**:
- `page`: 页码（默认: 1）
- `page_size`: 每页数量（默认: 20，最大: 100）
- `category`: 分类筛选（可选）
- `user_id`: 用户ID筛选（可选）
- `sort`: 排序方式（latest: 最新, popular: 热门）

**认证**: 可选

**响应**: 200 OK
```json
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "title": "我的第一篇帖子",
      "content": "帖子内容...",
      "category": "tech",
      "tags": ["python", "fastapi"],
      "view_count": 100,
      "like_count": 10,
      "comment_count": 5,
      "is_published": true,
      "created_at": "2025-10-22T12:00:00",
      "updated_at": "2025-10-22T12:00:00",
      "author": {
        "id": 1,
        "username": "testuser",
        "full_name": "Test User",
        "avatar_url": null
      },
      "is_liked": false
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "pages": 5
}
```

### 创建帖子
```
POST /api/v1/posts
```

**认证**: 必需

**请求体**:
```json
{
  "title": "帖子标题",
  "content": "帖子内容",
  "category": "tech",
  "tags": ["python", "fastapi"],
  "is_published": true
}
```

### 获取帖子详情
```
GET /api/v1/posts/{post_id}
```

**认证**: 可选

### 更新帖子
```
PUT /api/v1/posts/{post_id}
```

**认证**: 必需（仅作者）

**请求体**:
```json
{
  "title": "新标题",
  "content": "新内容",
  "is_published": true
}
```

### 删除帖子
```
DELETE /api/v1/posts/{post_id}
```

**认证**: 必需（仅作者）

### 点赞/取消点赞帖子
```
POST /api/v1/posts/{post_id}/like
```

**认证**: 必需

**响应**: 200 OK
```json
{
  "message": "点赞成功",
  "is_liked": true
}
```

---

## 评论 Comments

### 获取评论列表
```
GET /api/v1/comments?post_id=1&page=1&page_size=20
```

**查询参数**:
- `post_id`: 帖子ID（必需）
- `page`: 页码（默认: 1）
- `page_size`: 每页数量（默认: 20，最大: 100）

**认证**: 可选

**响应**: 200 OK
```json
{
  "items": [
    {
      "id": 1,
      "post_id": 1,
      "user_id": 2,
      "parent_id": null,
      "content": "很好的帖子！",
      "like_count": 5,
      "created_at": "2025-10-22T12:00:00",
      "updated_at": "2025-10-22T12:00:00",
      "author": {
        "id": 2,
        "username": "commenter",
        "full_name": "Commenter",
        "avatar_url": null
      },
      "is_liked": false,
      "replies": [
        {
          "id": 2,
          "post_id": 1,
          "user_id": 1,
          "parent_id": 1,
          "content": "谢谢！",
          "like_count": 2,
          "created_at": "2025-10-22T12:05:00",
          "author": {...},
          "is_liked": false,
          "replies": []
        }
      ]
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

### 创建评论
```
POST /api/v1/comments
```

**认证**: 必需

**请求体**:
```json
{
  "post_id": 1,
  "content": "我的评论",
  "parent_id": null
}
```

### 获取评论详情
```
GET /api/v1/comments/{comment_id}
```

**认证**: 可选

### 更新评论
```
PUT /api/v1/comments/{comment_id}
```

**认证**: 必需（仅作者）

**请求体**:
```json
{
  "content": "更新后的评论"
}
```

### 删除评论
```
DELETE /api/v1/comments/{comment_id}
```

**认证**: 必需（仅作者）

### 点赞/取消点赞评论
```
POST /api/v1/comments/{comment_id}/like
```

**认证**: 必需

---

## 搜索 Search

### 文本搜索
```
GET /api/v1/search?q=python&type=all&page=1&page_size=20
```

**查询参数**:
- `q`: 搜索关键词（必需）
- `type`: 搜索类型（all: 全部, post: 仅帖子, user: 仅用户）
- `category`: 分类筛选（可选，仅用于帖子）
- `page`: 页码（默认: 1）
- `page_size`: 每页数量（默认: 20，最大: 100）

**认证**: 可选

**响应**: 200 OK
```json
{
  "posts": [...],
  "users": [...],
  "total": 50
}
```

### 向量搜索（语义搜索）
```
POST /api/v1/search/vector?query=机器学习教程&limit=10
```

**查询参数**:
- `query`: 搜索查询（必需）
- `limit`: 返回数量（默认: 10，最大: 50）
- `category`: 分类筛选（可选）

**认证**: 可选

**响应**: 200 OK
```json
[
  {
    "id": 1,
    "title": "机器学习入门教程",
    "content": "...",
    ...
  }
]
```

---

## 通知 Notifications

### 获取通知列表
```
GET /api/v1/notifications?page=1&page_size=20&unread_only=false
```

**查询参数**:
- `page`: 页码（默认: 1）
- `page_size`: 每页数量（默认: 20，最大: 100）
- `unread_only`: 只显示未读通知（默认: false）

**认证**: 必需

**响应**: 200 OK
```json
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "type": "like",
      "title": "新的点赞",
      "content": "用户 testuser 点赞了你的帖子",
      "link": "/posts/1",
      "is_read": false,
      "created_at": "2025-10-22T12:00:00"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

### 获取通知统计
```
GET /api/v1/notifications/stats
```

**认证**: 必需

**响应**: 200 OK
```json
{
  "total_notifications": 50,
  "unread_notifications": 10
}
```

### 获取通知详情
```
GET /api/v1/notifications/{notification_id}
```

**认证**: 必需

### 标记通知为已读
```
PUT /api/v1/notifications/{notification_id}/read
```

**认证**: 必需

### 标记所有通知为已读
```
PUT /api/v1/notifications/read-all
```

**认证**: 必需

### 删除通知
```
DELETE /api/v1/notifications/{notification_id}
```

**认证**: 必需

---

## 错误响应

所有 API 可能返回以下错误：

### 400 Bad Request
```json
{
  "detail": "错误详情"
}
```

### 401 Unauthorized
```json
{
  "detail": "无法验证凭据"
}
```

### 403 Forbidden
```json
{
  "detail": "没有权限执行此操作"
}
```

### 404 Not Found
```json
{
  "detail": "资源不存在"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

---

## 使用示例

### Python 示例

```python
import requests

# 注册用户
response = requests.post(
    "http://localhost:8000/api/v1/auth/register",
    json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
)

# 登录
response = requests.post(
    "http://localhost:8000/api/v1/auth/login",
    json={
        "username": "testuser",
        "password": "password123"
    }
)
token = response.json()["access_token"]

# 创建帖子
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    "http://localhost:8000/api/v1/posts",
    headers=headers,
    json={
        "title": "我的第一篇帖子",
        "content": "这是内容",
        "category": "tech"
    }
)
```

### cURL 示例

```bash
# 注册用户
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# 登录
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# 创建帖子
curl -X POST http://localhost:8000/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"我的帖子","content":"内容","category":"tech"}'
```

---

## 开发调试

访问 Swagger UI 查看交互式 API 文档：
```
http://localhost:8000/docs
```

访问 ReDoc 查看 API 文档：
```
http://localhost:8000/redoc
```

---

**更新时间**: 2025-10-22  
**版本**: 1.0.0  
**状态**: ✅ 所有 API 已完成实现


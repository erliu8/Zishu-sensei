# 中间件使用指南

## 📚 概述

本项目实现了完整的中间件系统，包括：

1. **日志中间件** - 请求/响应日志记录和性能监控
2. **错误处理中间件** - 统一的异常处理和错误响应
3. **限流中间件** - 基于 Redis 的分布式限流
4. **自定义异常系统** - 结构化的异常类型

## 🏗️ 架构设计

### 中间件执行顺序

中间件按照**后添加先执行**的原则，当前配置的执行顺序：

```
Request → CORS → 日志 → 性能监控 → 限流 → 路由处理 → Response
```

### 文件结构

```
app/
├── core/
│   └── exceptions.py          # 自定义异常类
└── middleware/
    ├── __init__.py            # 中间件导出
    ├── logging.py             # 日志中间件
    ├── error_handler.py       # 错误处理中间件
    └── rate_limit.py          # 限流中间件
```

## 📝 日志中间件

### RequestLoggingMiddleware

记录每个请求和响应的详细信息。

**功能特性：**
- 自动生成请求 ID
- 记录请求方法、路径、查询参数
- 可选择记录请求体和响应体
- 自动隐藏敏感信息（password, token）
- 添加 `X-Request-ID` 和 `X-Process-Time` 响应头

**配置参数：**
```python
app.add_middleware(
    RequestLoggingMiddleware,
    exclude_paths=["/health", "/docs"],  # 排除的路径
    log_request_body=True,               # 是否记录请求体
    log_response_body=False,             # 是否记录响应体
)
```

**日志示例：**
```
2025-10-22 10:30:45 | Request started | request_id=abc123 | method=POST | path=/api/v1/posts
2025-10-22 10:30:46 | Request completed | request_id=abc123 | status_code=201 | process_time=0.523s
```

### PerformanceLoggingMiddleware

监控和记录慢请求。

**功能特性：**
- 自动检测慢请求
- 可配置的慢请求阈值
- 详细的性能指标

**配置参数：**
```python
app.add_middleware(
    PerformanceLoggingMiddleware,
    slow_request_threshold=1.0,  # 慢请求阈值（秒）
)
```

**日志示例：**
```
Slow request detected | method=GET | path=/api/v1/search | process_time=2.345s | threshold=1.0s
```

## 🚨 错误处理中间件

### 统一错误响应格式

所有错误都会返回统一的 JSON 格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {
      "field": "具体信息"
    }
  },
  "path": "/api/v1/endpoint",
  "method": "POST",
  "request_id": "abc123"
}
```

### 异常处理器

#### 1. 自定义异常处理器
处理所有继承自 `BaseAPIException` 的异常。

#### 2. 验证异常处理器
处理 Pydantic 验证错误，返回格式化的字段错误信息。

**响应示例：**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据验证失败",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "value is not a valid email address",
          "type": "value_error.email"
        }
      ]
    }
  }
}
```

#### 3. HTTP 异常处理器
处理 FastAPI/Starlette 的 HTTP 异常。

#### 4. 通用异常处理器
捕获所有未处理的异常，防止泄露服务器内部信息。

**开发模式：** 显示详细错误和堆栈跟踪
**生产模式：** 隐藏详细信息，只返回通用错误消息

## 🔐 限流中间件

### RateLimitMiddleware

基于 Redis 的分布式限流，使用滑动窗口算法。

**功能特性：**
- 基于客户端 IP 的限流
- 滑动窗口算法（精确控制）
- Redis 不可用时自动降级到内存限流
- 添加限流相关的响应头
- 自定义键生成函数

**配置参数：**
```python
app.add_middleware(
    RateLimitMiddleware,
    requests_per_window=100,     # 时间窗口内的最大请求数
    window_seconds=60,           # 时间窗口大小（秒）
    enabled=True,                # 是否启用限流
    exclude_paths=["/health"],   # 排除的路径
)
```

**响应头：**
```
X-RateLimit-Limit: 100
X-RateLimit-Window: 60
```

**限流超出响应：**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请在 45 秒后重试",
    "details": {
      "retry_after": 45
    }
  },
  "path": "/api/v1/posts",
  "method": "POST",
  "request_id": "abc123"
}
```

### UserRateLimitMiddleware

基于用户的限流，对认证用户和匿名用户应用不同的策略。

**功能特性：**
- 认证用户：更高的限流阈值
- 匿名用户：较低的限流阈值
- 自动识别用户身份

**配置参数：**
```python
app.add_middleware(
    UserRateLimitMiddleware,
    authenticated_requests=200,  # 认证用户限制
    anonymous_requests=50,       # 匿名用户限制
    window_seconds=60,
    enabled=True,
)
```

**使用场景：**
- 认证用户：200 请求/分钟
- 匿名用户：50 请求/分钟

## 🎯 自定义异常系统

### 异常类层次结构

```
BaseAPIException (基类)
├── AuthenticationException (认证异常)
│   ├── InvalidCredentialsException
│   ├── InvalidTokenException
│   └── TokenExpiredException
├── AuthorizationException (授权异常)
│   └── PermissionDeniedException
├── ResourceNotFoundException (资源未找到)
├── ResourceAlreadyExistsException (资源已存在)
├── ResourceConflictException (资源冲突)
├── ValidationException (验证异常)
│   └── InvalidInputException
├── BusinessLogicException (业务逻辑异常)
├── RateLimitException (限流异常)
├── DatabaseException (数据库异常)
│   └── DatabaseConnectionException
├── ExternalServiceException (外部服务异常)
│   ├── CacheException
│   └── VectorSearchException
└── FileException (文件异常)
    ├── FileTooLargeException
    └── InvalidFileTypeException
```

### 使用示例

#### 1. 抛出自定义异常

```python
from app.core.exceptions import ResourceNotFoundException, ValidationException

# 资源未找到
async def get_post(post_id: int):
    post = await Post.get(post_id)
    if not post:
        raise ResourceNotFoundException(
            resource_type="帖子",
            resource_id=post_id
        )
    return post

# 验证异常
async def create_post(title: str):
    if len(title) < 5:
        raise ValidationException(
            message="标题长度不能少于 5 个字符",
            details={"field": "title", "min_length": 5}
        )
```

#### 2. 业务逻辑异常

```python
from app.core.exceptions import BusinessLogicException

async def follow_user(user_id: int, target_id: int):
    if user_id == target_id:
        raise BusinessLogicException(
            message="不能关注自己",
            details={"user_id": user_id}
        )
```

#### 3. 权限异常

```python
from app.core.exceptions import PermissionDeniedException

async def delete_post(current_user: User, post: Post):
    if post.author_id != current_user.id:
        raise PermissionDeniedException(
            message="您只能删除自己的帖子"
        )
```

## ⚙️ 配置

### 环境变量

在 `.env` 文件中配置中间件相关参数：

```bash
# 日志配置
LOG_LEVEL=INFO
LOG_FORMAT="%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# 限流配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# 调试模式
DEBUG=false
```

### 代码配置

在 `app/core/config/settings.py` 中已定义相关配置：

```python
class Settings(BaseSettings):
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # 限流配置
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
```

## 📊 监控和调试

### 查看日志

```bash
# Docker 环境
docker-compose logs -f backend

# 本地开发
# 日志会输出到标准输出
```

### 测试限流

```bash
# 快速发送多个请求测试限流
for i in {1..150}; do
  curl -X GET "http://localhost:8000/api/v1/posts" &
done
wait
```

### 测试错误处理

```bash
# 测试验证错误
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "ab", "email": "invalid"}'

# 测试资源未找到
curl -X GET "http://localhost:8000/api/v1/posts/999999"
```

## 🎨 最佳实践

### 1. 异常处理

✅ **推荐：**
```python
from app.core.exceptions import ResourceNotFoundException

async def get_user(user_id: int):
    user = await User.get(user_id)
    if not user:
        raise ResourceNotFoundException("用户", user_id)
    return user
```

❌ **不推荐：**
```python
from fastapi import HTTPException

async def get_user(user_id: int):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### 2. 日志记录

✅ **推荐：**
```python
import logging

logger = logging.getLogger(__name__)

async def process_data():
    logger.info("开始处理数据")
    try:
        # 处理逻辑
        logger.info("数据处理完成")
    except Exception as e:
        logger.error(f"数据处理失败: {e}")
        raise
```

### 3. 敏感信息

中间件会自动隐藏以下字段：
- `password`
- `token`

如需隐藏其他字段，可在 `logging.py` 中修改：

```python
# 在 _log_request 方法中添加
if "secret_key" in body_json:
    body_json["secret_key"] = "***HIDDEN***"
```

### 4. 自定义限流键

```python
from fastapi import Request

def custom_rate_limit_key(request: Request) -> str:
    """基于用户 ID 和 IP 的限流键"""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"rate_limit:user:{user_id}"
    client_ip = request.client.host if request.client else "unknown"
    return f"rate_limit:ip:{client_ip}"

# 使用自定义键函数
app.add_middleware(
    RateLimitMiddleware,
    key_func=custom_rate_limit_key,
)
```

## 🔧 故障排查

### 问题：限流不生效

**可能原因：**
1. Redis 未连接
2. 限流被禁用
3. 路径在排除列表中

**解决方案：**
```bash
# 检查 Redis 连接
curl http://localhost:8000/health

# 检查配置
echo $RATE_LIMIT_ENABLED

# 查看日志
docker-compose logs -f backend | grep "rate_limit"
```

### 问题：请求 ID 未显示

**原因：** 请求路径被排除

**解决方案：**
检查 `exclude_paths` 配置，确保路径不在排除列表中。

### 问题：错误信息过于详细

**原因：** DEBUG 模式开启

**解决方案：**
```bash
# 在 .env 中设置
DEBUG=false
```

## 📈 性能考虑

### 日志中间件

- **建议：** 生产环境中禁用请求体和响应体日志
- **影响：** 记录大量请求体会增加内存使用和 I/O

```python
app.add_middleware(
    RequestLoggingMiddleware,
    log_request_body=False,  # 生产环境设为 False
    log_response_body=False,
)
```

### 限流中间件

- **Redis 优先：** 始终使用 Redis，内存限流仅作为回退
- **性能：** Redis 限流对性能影响极小（< 1ms）
- **扩展：** 支持水平扩展，多个实例共享限流状态

### 异常处理

- **无性能影响：** 仅在异常发生时执行
- **建议：** 在业务逻辑中尽早验证和抛出异常

## 🚀 下一步

- [ ] 添加 Prometheus 指标收集
- [ ] 实现请求追踪（Distributed Tracing）
- [ ] 添加更多限流策略（令牌桶、漏桶）
- [ ] 实现基于角色的限流
- [ ] 添加 IP 黑名单/白名单

---

**创建时间：** 2025-10-22  
**版本：** 1.0.0  
**维护者：** Zishu AI Team


# 🛠️ 工具函数使用指南

本文档介绍后端工具函数库的使用方法和最佳实践。

## 📚 目录

- [分页工具](#分页工具)
- [缓存工具](#缓存工具)
- [验证器](#验证器)
- [辅助函数](#辅助函数)

---

## 分页工具

### 1. 基础分页

```python
from sqlalchemy import select
from app.models.user import User
from app.utils import paginate

async def get_users(db: AsyncSession, page: int = 1, page_size: int = 20):
    query = select(User).where(User.is_active == True)
    result = await paginate(db, query, page, page_size)
    return result
```

### 2. 带转换的分页

```python
from app.utils import paginate_with_transform
from app.schemas.user import UserPublic

async def get_users_public(db: AsyncSession, page: int = 1):
    query = select(User).where(User.is_active == True)
    
    # 使用 Pydantic 模型转换
    result = await paginate_with_transform(
        db=db,
        query=query,
        transform=lambda user: UserPublic.model_validate(user),
        page=page,
        page_size=20
    )
    return result
```

### 3. 使用 Paginator 类

```python
from app.utils import Paginator

async def get_posts(db: AsyncSession, params: PaginationParams):
    paginator = Paginator(
        page=params.page,
        page_size=params.page_size,
        max_page_size=100
    )
    
    query = select(Post).order_by(Post.created_at.desc())
    return await paginator.paginate(db, query)
```

### 4. 列表分页

```python
from app.utils import paginate_list

def get_trending_posts(all_posts: List[Post], page: int = 1):
    # 对内存中的列表进行分页
    return paginate_list(all_posts, page=page, page_size=10)
```

---

## 缓存工具

### 1. 基础缓存操作

```python
from app.utils import get_cached, set_cached, delete_cached

async def get_user_profile(user_id: int):
    # 尝试从缓存获取
    cache_key = f"user:{user_id}"
    cached = await get_cached(cache_key)
    
    if cached:
        return cached
    
    # 从数据库获取
    user = await db.get(User, user_id)
    
    # 存入缓存（5分钟）
    await set_cached(cache_key, user.dict(), expire=300)
    
    return user
```

### 2. 缓存装饰器

```python
from app.utils import cache

@cache(prefix="user_profile", expire=300)
async def get_user_profile(user_id: int):
    """自动缓存函数结果"""
    return await db.get(User, user_id)

# 调用时会自动缓存
user = await get_user_profile(123)
```

### 3. 模型缓存装饰器

```python
from app.utils import cache_model

@cache_model(prefix="user", id_param="user_id", expire=600)
async def get_user_by_id(db: AsyncSession, user_id: int):
    """自动缓存数据库查询结果"""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

### 4. 缓存管理器

```python
from app.utils import CacheManager

# 创建用户缓存管理器
user_cache = CacheManager(prefix="user")

async def manage_user_cache(user_id: int, user_data: dict):
    # 设置缓存
    await user_cache.set(user_data, expire=300, user_id=user_id)
    
    # 获取缓存
    cached_user = await user_cache.get(user_id=user_id)
    
    # 删除缓存
    await user_cache.delete(user_id=user_id)
    
    # 清空所有用户缓存
    deleted_count = await user_cache.clear_all()
```

### 5. 缓存失效

```python
from app.utils import invalidate_cache, invalidate_model_cache, delete_pattern

# 使缓存失效
await invalidate_model_cache("user", user_id=123)

# 删除匹配模式的所有缓存
await delete_pattern("user:*")
```

### 6. 缓存最佳实践

```python
from app.utils import cache

class UserService:
    @cache(prefix="user_stats", expire=600)
    async def get_user_statistics(self, user_id: int):
        """缓存用户统计数据"""
        return {
            "posts_count": await self.count_posts(user_id),
            "followers_count": await self.count_followers(user_id),
            "following_count": await self.count_following(user_id),
        }
    
    async def update_user_profile(self, user_id: int, data: dict):
        """更新用户信息时清除缓存"""
        await db.update(User, user_id, data)
        
        # 清除相关缓存
        await invalidate_model_cache("user", user_id)
        await invalidate_cache("user_stats", user_id)
        await delete_pattern(f"user_posts:{user_id}:*")
```

---

## 验证器

### 1. 邮箱和用户名验证

```python
from app.utils import validate_email, validate_username

def validate_registration(email: str, username: str):
    if not validate_email(email):
        raise ValueError("无效的邮箱地址")
    
    if not validate_username(username):
        raise ValueError("用户名必须以字母开头，只能包含字母、数字和下划线")
```

### 2. 密码验证

```python
from app.utils import validate_password, validate_password_simple

# 严格验证（需要大小写字母和数字）
is_valid, error_msg = validate_password("MyPassword123")
if not is_valid:
    raise ValueError(error_msg)

# 简单验证（仅验证长度）
if not validate_password_simple("password123"):
    raise ValueError("密码长度必须在 8-128 个字符之间")
```

### 3. URL 和电话验证

```python
from app.utils import validate_url, validate_phone, normalize_phone

# URL 验证
if not validate_url("https://example.com"):
    raise ValueError("无效的 URL")

# 电话验证
phone = normalize_phone("138 1234 5678")  # 移除空格
if not validate_phone(phone):
    raise ValueError("无效的手机号")
```

### 4. 文件验证

```python
from app.utils import validate_image_extension, validate_file_extension
from app.core.config.settings import settings

# 图片验证
if not validate_image_extension(filename):
    raise ValueError("不支持的图片格式")

# 自定义文件类型验证
if not validate_file_extension(filename, settings.ALLOWED_EXTENSIONS):
    raise ValueError("不支持的文件类型")
```

### 5. 内容验证

```python
from app.utils import validate_content_length, sanitize_html

# 内容长度验证
if not validate_content_length(content, min_length=10, max_length=5000):
    raise ValueError("内容长度必须在 10-5000 个字符之间")

# HTML 清理（移除危险标签）
safe_content = sanitize_html(user_input)
```

### 6. Slug 生成和验证

```python
from app.utils import generate_slug, validate_slug

# 生成 slug
title = "Hello World! 这是一个测试"
slug = generate_slug(title, max_length=50)  # "hello-world"

# 验证 slug
if not validate_slug(slug):
    raise ValueError("无效的 slug 格式")
```

### 7. 数据掩码

```python
from app.utils import mask_email, mask_phone

# 邮箱掩码
masked_email = mask_email("user@example.com")  # "u***@example.com"

# 手机掩码
masked_phone = mask_phone("13812345678")  # "138****5678"
```

### 8. 使用 Validator 类

```python
from app.utils import Validator

# 统一验证接口
if not Validator.email(email):
    raise ValueError("无效的邮箱")

if not Validator.username(username):
    raise ValueError("无效的用户名")

is_valid, error = Validator.password(password, strict=True)
if not is_valid:
    raise ValueError(error)
```

---

## 辅助函数

### 1. UUID 和 ID 生成

```python
from app.utils import generate_uuid, generate_short_id, generate_random_string

# 生成 UUID
user_id = generate_uuid()  # "550e8400-e29b-41d4-a716-446655440000"

# 生成短 ID
short_id = generate_short_id(length=8)  # "a7b3c9d2"

# 生成随机字符串
token = generate_random_string(length=32)
```

### 2. 哈希和编码

```python
from app.utils import hash_string, encode_base64, decode_base64

# 字符串哈希
hash_value = hash_string("password", algorithm="sha256")

# Base64 编码
encoded = encode_base64("Hello World")
decoded = decode_base64(encoded)
```

### 3. 时间处理

```python
from app.utils import (
    get_timestamp,
    timestamp_to_datetime,
    datetime_to_timestamp,
    format_datetime,
    get_time_ago
)
from datetime import datetime

# 获取时间戳
ts = get_timestamp()  # 秒级时间戳
ts_ms = get_timestamp_ms()  # 毫秒级时间戳

# 时间转换
dt = timestamp_to_datetime(ts)
ts_back = datetime_to_timestamp(dt)

# 格式化时间
formatted = format_datetime(datetime.now(), "%Y-%m-%d %H:%M:%S")

# 相对时间
post_time = datetime(2025, 10, 22, 10, 0)
relative = get_time_ago(post_time)  # "2小时前"
```

### 4. 字符串处理

```python
from app.utils import truncate_string, obfuscate_string

# 截断字符串
short_text = truncate_string("This is a very long text...", length=20)

# 混淆字符串
obfuscated = obfuscate_string("sensitive_data", visible_chars=4)
# "sens**********"
```

### 5. 列表操作

```python
from app.utils import remove_duplicates, chunk_list, flatten_list

# 去重（保持顺序）
unique_items = remove_duplicates([1, 2, 2, 3, 1, 4])  # [1, 2, 3, 4]

# 分块
chunks = chunk_list([1, 2, 3, 4, 5, 6], chunk_size=2)
# [[1, 2], [3, 4], [5, 6]]

# 展平嵌套列表
flat = flatten_list([[1, 2], [3, [4, 5]], 6])  # [1, 2, 3, 4, 5, 6]
```

### 6. 字典操作

```python
from app.utils import merge_dicts, safe_get

# 合并字典
dict1 = {"a": 1, "b": 2}
dict2 = {"b": 3, "c": 4}
merged = merge_dicts(dict1, dict2)  # {"a": 1, "b": 3, "c": 4}

# 安全获取嵌套值
data = {
    "user": {
        "profile": {
            "name": "张三"
        }
    }
}
name = safe_get(data, "user.profile.name", default="未知")
```

### 7. 数值工具

```python
from app.utils import clamp, percentage, bytes_to_human_readable

# 限制范围
value = clamp(150, min_value=0, max_value=100)  # 100

# 计算百分比
percent = percentage(25, 100)  # 25.0

# 字节转可读格式
size = bytes_to_human_readable(1536000)  # "1.46 MB"
```

### 8. 验证码生成

```python
from app.utils import generate_verification_code

# 生成 6 位数字验证码
code = generate_verification_code(length=6)  # "123456"
```

### 9. 计时器

```python
from app.utils import Timer
import asyncio

# 使用计时器类
timer = Timer()
timer.start()
# ... 执行操作
timer.stop()
print(f"耗时: {timer.elapsed_seconds()} 秒")

# 使用上下文管理器
async def process_data():
    with Timer() as timer:
        await asyncio.sleep(1)
        # ... 执行操作
    
    print(f"处理耗时: {timer.elapsed_seconds()} 秒")
```

---

## 📦 完整使用示例

### 示例 1: 用户注册

```python
from app.utils import (
    validate_email,
    validate_username,
    validate_password,
    generate_uuid,
    hash_string,
    invalidate_cache
)

async def register_user(data: UserCreate, db: AsyncSession):
    # 验证
    if not validate_email(data.email):
        raise HTTPException(status_code=400, detail="无效的邮箱地址")
    
    if not validate_username(data.username):
        raise HTTPException(status_code=400, detail="无效的用户名")
    
    is_valid, error_msg = validate_password(data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # 创建用户
    user = User(
        id=generate_uuid(),
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password)
    )
    
    db.add(user)
    await db.commit()
    
    return user
```

### 示例 2: 获取帖子列表（带缓存和分页）

```python
from app.utils import cache, paginate_with_transform
from app.schemas.post import PostPublic

@cache(prefix="posts_list", expire=300)
async def get_posts_list(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20
):
    query = select(Post).where(Post.is_published == True).order_by(Post.created_at.desc())
    
    result = await paginate_with_transform(
        db=db,
        query=query,
        transform=lambda post: PostPublic.model_validate(post),
        page=page,
        page_size=page_size
    )
    
    return result
```

### 示例 3: 文件上传

```python
from app.utils import (
    validate_image_extension,
    generate_short_id,
    bytes_to_human_readable
)
from fastapi import UploadFile

async def upload_avatar(file: UploadFile):
    # 验证文件类型
    if not validate_image_extension(file.filename):
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    # 验证文件大小
    file_size = await file.read()
    if len(file_size) > settings.MAX_UPLOAD_SIZE:
        max_size = bytes_to_human_readable(settings.MAX_UPLOAD_SIZE)
        raise HTTPException(status_code=400, detail=f"文件大小超过限制 ({max_size})")
    
    # 生成文件名
    ext = file.filename.rsplit('.', 1)[1]
    filename = f"{generate_short_id(16)}.{ext}"
    
    # 保存文件
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(file_size)
    
    return {"filename": filename, "url": f"/uploads/{filename}"}
```

---

## 🎯 最佳实践

### 1. 缓存策略

- 对频繁查询的数据使用缓存
- 设置合理的过期时间
- 更新数据时及时清除缓存
- 使用缓存管理器统一管理同类缓存

### 2. 验证策略

- 在 API 层进行输入验证
- 使用 Pydantic 模型进行数据验证
- 对敏感数据进行额外验证
- 提供清晰的错误消息

### 3. 分页策略

- 限制最大分页大小
- 提供默认分页参数
- 返回完整的分页信息
- 对大数据集使用游标分页

### 4. 工具函数组合

```python
from app.utils import (
    cache,
    paginate_with_transform,
    validate_content_length,
    sanitize_html,
    get_time_ago
)

@cache(prefix="posts", expire=300)
async def get_posts_with_safety(db: AsyncSession, page: int):
    query = select(Post).where(Post.is_published == True)
    
    def transform_post(post):
        # 验证和清理内容
        if not validate_content_length(post.content, min_length=1, max_length=10000):
            post.content = post.content[:10000]
        
        post.content = sanitize_html(post.content)
        
        # 添加相对时间
        return {
            **PostPublic.model_validate(post).model_dump(),
            "created_ago": get_time_ago(post.created_at)
        }
    
    return await paginate_with_transform(
        db=db,
        query=query,
        transform=transform_post,
        page=page,
        page_size=20
    )
```

---

## 📝 总结

本工具函数库提供了：

✅ **分页工具** - 灵活的数据分页方案  
✅ **缓存工具** - 强大的缓存装饰器和管理器  
✅ **验证器** - 全面的数据验证函数  
✅ **辅助函数** - 常用的工具函数集合  

所有工具函数都经过优化，适合异步环境，并且类型安全。

---

**创建时间**: 2025-10-22  
**版本**: 1.0.0  
**状态**: ✅ 完成


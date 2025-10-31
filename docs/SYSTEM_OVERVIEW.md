# Zishu Sensei 系统全景概览

## 📋 文档目的

本文档旨在帮助开发者全面理解 Zishu Sensei 项目的整体架构、各模块职责以及它们之间的协作关系。

**文档版本**: v1.0  
**更新日期**: 2025-10-31  
**适用对象**: 新加入的开发者、架构师、技术负责人

---

## 🎯 项目核心定位

**Zishu Sensei (紫舒老师)** 是一个**现代化的桌面AI助手平台**，包含三个核心组件：

1. **桌面应用** (Desktop App) - 用户端AI助手程序
2. **社区平台** (Community Platform) - Web端社区和服务平台
3. **Python核心库** (zishu/) - 共享的AI能力和工具库

---

## 🏗️ 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户生态系统                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐    │
│  │   桌面应用 (Tauri)    │◄───────►│   社区平台 (Web)      │    │
│  │  - Live2D 交互        │  下载   │  - 适配器市场         │    │
│  │  - 适配器系统         │  同步   │  - 打包服务           │    │
│  │  - 多模态AI          │  更新   │  - 用户社区           │    │
│  └──────────┬───────────┘         └──────────┬───────────┘    │
│             │                                  │                │
│             │                                  │                │
│             └──────────┬───────────────────────┘                │
│                        │                                        │
│                        ▼                                        │
│             ┌──────────────────────┐                           │
│             │   Python 核心库       │                           │
│             │  - LLM 集成          │                           │
│             │  - 适配器基类         │                           │
│             │  - 工具函数          │                           │
│             └──────────────────────┘                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        基础设施层                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐│
│  │ PostgreSQL │  │   Redis    │  │   Qdrant   │  │  云模型  ││
│  │  (用户数据) │  │  (缓存)    │  │  (向量库)  │  │  (API)   ││
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ 一、桌面应用 (Desktop App)

### 1.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **UI层** | React 18 + TypeScript | 前端界面 |
| **桌面框架** | Tauri (Rust) | 跨平台桌面应用框架 |
| **核心逻辑** | Python 3.9+ | AI能力、适配器系统 |
| **数据存储** | SQLite (通过Rust) | 本地数据库 |
| **Live2D** | Live2D Web SDK | 虚拟角色显示 |

### 1.2 核心功能模块

#### 📁 目录结构
```
desktop_app/
├── src/                      # React 前端
│   ├── components/          # UI组件
│   ├── pages/              # 页面
│   ├── services/           # 服务层
│   └── hooks/              # React Hooks
│
└── src-tauri/              # Rust 后端
    ├── src/
    │   ├── main.rs         # 应用入口
    │   ├── commands/       # Tauri命令
    │   │   ├── adapter.rs  # 适配器管理
    │   │   ├── market.rs   # 市场功能
    │   │   ├── llm.rs      # LLM交互
    │   │   └── system.rs   # 系统功能
    │   ├── database/       # SQLite数据库
    │   │   ├── adapter.rs  # 适配器表
    │   │   ├── character.rs # 角色表
    │   │   ├── workflow.rs  # 工作流表
    │   │   ├── permission.rs # 权限表
    │   │   └── performance.rs # 性能表
    │   └── state.rs        # 全局状态
    └── Cargo.toml
```

#### 🔌 适配器系统

**适配器**是桌面应用的核心扩展机制，允许AI助手执行各种系统级操作。

**适配器生命周期**:
```
安装 → 权限请求 → 用户授权 → 激活 → 执行 → 停用 → 卸载
```

**适配器管理** (`commands/adapter.rs`):
- `list_adapters()` - 列出所有已安装的适配器
- `install_adapter(path)` - 安装适配器（解压、验证、注册）
- `uninstall_adapter(id)` - 卸载适配器
- `enable_adapter(id)` / `disable_adapter(id)` - 启用/停用
- `get_adapter_info(id)` - 获取适配器详细信息
- `execute_adapter(id, action, params)` - 执行适配器功能

**适配器类型**:
```rust
pub enum AdapterCategory {
    FileOperation,      // 文件操作 (读写、搜索)
    WebAutomation,      // 网页自动化 (浏览器控制)
    SystemControl,      // 系统控制 (音量、亮度)
    DataAnalysis,       // 数据分析 (Excel、CSV)
    Communication,      // 通讯 (邮件、消息)
    Productivity,       // 生产力 (日历、待办)
    Entertainment,      // 娱乐 (音乐、视频)
    Development,        // 开发工具 (Git、编译)
    Custom,            // 自定义
}
```

#### 🤖 LLM 集成 (`commands/llm.rs`)

桌面应用通过两种方式使用AI模型:

**方式1: 云端API** (推荐)
```rust
// 调用配置好的云端模型 (OpenAI, Qwen, DeepSeek等)
chat(messages, model_config) → Response
```

**方式2: 本地模型** (可选)
```rust
// 加载本地模型文件
load_local_model(model_path) → Model
generate(prompt) → Text
```

**配置文件**: `config/services/api_config.yml`
```yaml
providers:
  qwen:
    api_key: ${QWEN_API_KEY}
    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    model: qwen-max
    enabled: true
  openai:
    api_key: ${OPENAI_API_KEY}
    base_url: https://api.openai.com/v1
    model: gpt-4-turbo-preview
    enabled: false
```

#### 🔐 权限管理 (`database/permission.rs`)

**权限类型** (26种):
```rust
pub enum PermissionType {
    // 文件权限
    FileRead, FileWrite, FileDelete, FileExecute, FileWatch,
    
    // 网络权限
    NetworkHttp, NetworkWebSocket, NetworkSocket, NetworkDns,
    
    // 系统权限
    SystemCommand, SystemEnv, SystemInfo, 
    SystemClipboard, SystemNotification,
    
    // 应用权限
    AppDatabase, AppConfig, AppChatHistory, 
    AppUserData, AppAdapter,
    
    // 硬件权限
    HardwareCamera, HardwareMicrophone, 
    HardwareScreenCapture, HardwareLocation,
    
    // 高级权限
    AdvancedAutoStart, AdvancedBackground, AdvancedAdmin,
    
    // 自定义权限
    Custom(String),
}
```

**权限工作流**:
```
1. 适配器请求权限 → request_permission()
2. 用户查看请求 → get_pending_grants()
3. 用户授予/拒绝 → grant_permission() / deny_permission()
4. 检查权限 → check_permission()
5. 记录使用 → log_permission_usage()
6. 撤销权限 → revoke_permission()
```

#### 📊 性能监控 (`database/performance.rs`)

**监控内容**:
- **系统快照**: CPU、内存、磁盘、网络使用率
- **性能指标**: 自定义指标（响应时间、吞吐量）
- **网络指标**: DNS解析、连接时间、数据传输
- **用户操作**: 操作类型、持续时间、成功率
- **性能警告**: 阈值超限告警

**API示例**:
```rust
// 记录系统快照
record_snapshot(PerformanceSnapshot {
    cpu_usage: 45.2,
    memory_usage: 8192,
    disk_usage: 50.0,
    // ... 17个指标
})

// 获取性能统计
get_stats(start_time, end_time) → PerformanceStats

// 记录警告
record_alert(PerformanceAlert {
    metric_name: "memory_usage",
    threshold: 90.0,
    actual_value: 95.0,
    severity: High,
})
```

#### 🌊 工作流系统 (`database/workflow.rs`)

**工作流**允许用户创建自动化任务序列。

**工作流状态**:
```rust
pub enum WorkflowStatus {
    Draft,      // 草稿
    Published,  // 已发布
    Archived,   // 已归档
    Disabled,   // 已禁用
}
```

**工作流结构**:
```json
{
  "id": "workflow_001",
  "name": "每日自动化",
  "steps": [
    {
      "id": "step1",
      "type": "adapter",
      "adapter_id": "file_reader",
      "action": "read",
      "params": {"path": "/data/daily.txt"}
    },
    {
      "id": "step2",
      "type": "llm",
      "action": "summarize",
      "params": {"max_length": 200}
    },
    {
      "id": "step3",
      "type": "adapter",
      "adapter_id": "notification",
      "action": "send",
      "params": {"title": "每日摘要"}
    }
  ],
  "config": {
    "schedule": "0 9 * * *",
    "retry": 3,
    "timeout": 300
  }
}
```

### 1.3 数据流示例

**用户对话流程**:
```
1. 用户输入 → React UI
2. UI调用Tauri命令 → commands/llm.rs
3. Rust调用Python核心库 → zishu/llm/
4. Python调用云端API → OpenAI/Qwen/etc
5. 响应返回 → Python → Rust → React
6. 显示结果 + Live2D动画
```

**适配器执行流程**:
```
1. LLM决策需要执行某操作 → 调用适配器
2. 检查权限 → database/permission.rs
3. 权限通过 → 执行适配器 → commands/adapter.rs
4. 适配器调用Python实现 → zishu/adapters/
5. 执行系统操作
6. 记录日志 → database/performance.rs
7. 返回结果给LLM
```

---

## 🌐 二、社区平台 (Community Platform)

### 2.1 技术栈

#### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15 | React框架 (App Router) |
| React | 19 | UI库 |
| TypeScript | 5 | 类型安全 |
| Tailwind CSS | 3 | 样式 |
| Shadcn/ui | - | 组件库 |
| TanStack Query | 5 | 数据获取 |
| Zustand | 4 | 状态管理 |
| Framer Motion | 11 | 动画 |

#### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.104+ | Python Web框架 |
| PostgreSQL | 15 | 关系数据库 |
| Redis | 7 | 缓存/会话 |
| Qdrant | 1.7+ | 向量数据库 |
| SQLAlchemy | 2.0 | ORM |
| Celery | 5.3+ | 异步任务队列 |

### 2.2 前端架构

#### 📁 目录结构 (DDD架构)
```
community_platform/frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页
│   ├── layout.tsx         # 根布局
│   ├── providers.tsx      # 全局Provider
│   └── api/               # API Routes (BFF层)
│       ├── auth/          # 认证API
│       ├── adapters/      # 适配器API
│       └── lib/           # API工具函数
│
└── src/
    ├── features/          # 功能模块 (DDD)
    │   ├── auth/         # 认证模块
    │   │   ├── api/      # API客户端
    │   │   ├── components/ # UI组件
    │   │   ├── domain/   # 领域模型
    │   │   ├── hooks/    # React Hooks
    │   │   ├── services/ # 业务逻辑
    │   │   └── store/    # 状态管理
    │   │
    │   ├── adapter/      # 适配器市场
    │   ├── character/    # 角色管理
    │   ├── community/    # 社区功能
    │   ├── packaging/    # 打包服务
    │   └── user/         # 用户管理
    │
    ├── shared/           # 共享资源
    │   ├── components/   # 通用组件
    │   ├── hooks/        # 通用Hooks
    │   ├── utils/        # 工具函数
    │   └── types/        # 类型定义
    │
    └── infrastructure/   # 基础设施
        ├── api/          # API客户端基类
        ├── config/       # 配置
        └── providers/    # Provider组件
```

#### 🔐 认证系统 (`features/auth/`)

**认证流程**:
```
1. 用户登录 → auth.client.ts → POST /api/auth/login
2. 后端验证 → 返回JWT token
3. 存储token → token.service.ts (localStorage + cookie)
4. 全局状态 → auth.store.ts (Zustand)
5. 自动刷新 → refreshToken() 定时调用
6. 退出登录 → 清理token和状态
```

**Token管理** (`services/token.service.ts`):
```typescript
class TokenService {
  // 存储token (双重存储: localStorage + httpOnly cookie)
  setTokens(accessToken, refreshToken)
  
  // 获取token
  getAccessToken() → string | null
  getRefreshToken() → string | null
  
  // 刷新token
  refreshAccessToken() → Promise<string>
  
  // 清除token
  clearTokens()
  
  // Token验证
  isTokenExpired(token) → boolean
  decodeToken(token) → TokenPayload
}
```

**认证守卫**:
```typescript
// 页面级守卫
export default function ProtectedPage() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <Loading />;
  if (!user) redirect('/login');
  
  return <PageContent />;
}
```

#### 📦 适配器市场 (`features/adapter/`)

**核心功能**:
1. **浏览适配器** - 分类、搜索、筛选
2. **查看详情** - 详细信息、评分、评论、截图
3. **下载安装** - 下载.zip文件 → 桌面应用导入
4. **上传适配器** - 开发者上传自己的适配器
5. **评分评论** - 用户互动

**数据流**:
```
1. 列表页 → useAdapters() → GET /api/adapters
2. 详情页 → useAdapter(id) → GET /api/adapters/{id}
3. 下载 → downloadAdapter(id) → GET /api/adapters/{id}/download
4. 评分 → rateAdapter(id, rating) → POST /api/adapters/{id}/rate
5. 评论 → commentAdapter(id, comment) → POST /api/adapters/{id}/comments
```

#### 🎁 打包服务 (`features/packaging/`)

**功能**: 在线配置并生成自定义桌面应用安装包

**工作流**:
```
1. 用户配置
   - 选择AI模型
   - 选择适配器
   - 选择Live2D角色
   - 自定义设置

2. 后端打包
   - 创建打包任务 → POST /api/packaging/create
   - 后台打包 (Celery异步任务)
   - 生成安装包 (.exe/.dmg/.AppImage)

3. 下载安装
   - 获取下载链接 → GET /api/packaging/{task_id}/download
   - 用户下载安装包
   - 安装到本地
```

**打包配置示例**:
```json
{
  "app_name": "我的AI助手",
  "version": "1.0.0",
  "models": ["qwen-max"],
  "adapters": [
    "file_operation",
    "web_automation",
    "system_control"
  ],
  "character": {
    "live2d_model": "shizuka",
    "voice": "female_cn"
  },
  "settings": {
    "theme": "dark",
    "language": "zh-CN",
    "auto_start": true
  }
}
```

#### 👥 社区功能 (`features/community/`)

**功能模块**:
1. **帖子系统** - 发帖、回复、点赞
2. **用户关注** - 关注用户、查看动态
3. **话题标签** - 按话题浏览内容
4. **搜索** - 全文搜索帖子和用户
5. **通知** - 实时消息推送

### 2.3 后端架构

#### 📁 目录结构
```
community_platform/backend/
├── main.py                # FastAPI应用入口
├── config/               # 配置文件
│   ├── settings.py       # 环境配置
│   └── database.py       # 数据库配置
│
├── api/                  # API路由
│   ├── v1/
│   │   ├── auth.py      # 认证接口
│   │   ├── adapters.py  # 适配器接口
│   │   ├── users.py     # 用户接口
│   │   ├── posts.py     # 帖子接口
│   │   └── packaging.py # 打包接口
│   └── dependencies.py   # 依赖注入
│
├── models/              # 数据模型 (SQLAlchemy)
│   ├── user.py
│   ├── adapter.py
│   ├── post.py
│   └── package.py
│
├── schemas/             # Pydantic schemas
│   ├── user.py
│   ├── adapter.py
│   └── auth.py
│
├── services/            # 业务逻辑
│   ├── auth_service.py
│   ├── adapter_service.py
│   ├── packaging_service.py
│   └── notification_service.py
│
├── tasks/               # Celery异步任务
│   ├── packaging.py     # 打包任务
│   └── email.py         # 邮件发送
│
├── utils/               # 工具函数
│   ├── security.py      # 安全工具
│   ├── cache.py         # 缓存工具
│   └── vector.py        # 向量搜索
│
└── requirements.txt
```

#### 🔐 认证与安全

**JWT认证**:
```python
# 登录
@router.post("/auth/login")
async def login(credentials: LoginRequest):
    user = await authenticate_user(credentials)
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

# 受保护的路由
@router.get("/users/me")
async def get_current_user(
    current_user: User = Depends(get_current_user)
):
    return current_user
```

**权限控制**:
```python
# 权限装饰器
@router.delete("/adapters/{adapter_id}")
async def delete_adapter(
    adapter_id: str,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin)  # 需要管理员权限
):
    await adapter_service.delete(adapter_id)
    return {"success": True}
```

#### 📊 数据库模型

**用户模型**:
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER)
    avatar_url = Column(String)
    bio = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    adapters = relationship("Adapter", back_populates="author")
    posts = relationship("Post", back_populates="author")
```

**适配器模型**:
```python
class Adapter(Base):
    __tablename__ = "adapters"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False)
    version = Column(String, nullable=False)
    author_id = Column(String, ForeignKey("users.id"))
    
    # 统计数据
    downloads = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    
    # 文件信息
    file_url = Column(String, nullable=False)
    file_size = Column(BigInteger)
    file_hash = Column(String)
    
    # 元数据
    tags = Column(JSON)
    dependencies = Column(JSON)
    requirements = Column(JSON)
    
    # 关系
    author = relationship("User", back_populates="adapters")
    comments = relationship("AdapterComment")
```

#### 🔍 搜索与推荐

**向量搜索** (Qdrant):
```python
class VectorSearchService:
    def __init__(self, qdrant_client):
        self.client = qdrant_client
        self.collection = "adapters"
    
    async def search_adapters(
        self, 
        query: str, 
        limit: int = 10
    ) -> List[Adapter]:
        # 1. 将查询转换为向量
        query_vector = await self.embed_text(query)
        
        # 2. 向量搜索
        results = self.client.search(
            collection_name=self.collection,
            query_vector=query_vector,
            limit=limit
        )
        
        # 3. 获取完整数据
        adapter_ids = [r.id for r in results]
        adapters = await get_adapters_by_ids(adapter_ids)
        
        return adapters
    
    async def recommend_adapters(
        self, 
        user_id: str, 
        limit: int = 5
    ) -> List[Adapter]:
        # 基于用户历史推荐
        user_history = await get_user_adapter_history(user_id)
        # ... 推荐算法
        return recommended_adapters
```

#### ⚡ 缓存策略

**Redis缓存**:
```python
class CacheService:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def get_adapter(self, adapter_id: str):
        # 1. 尝试从缓存获取
        cached = await self.redis.get(f"adapter:{adapter_id}")
        if cached:
            return json.loads(cached)
        
        # 2. 从数据库获取
        adapter = await db.get_adapter(adapter_id)
        
        # 3. 写入缓存 (TTL: 1小时)
        await self.redis.setex(
            f"adapter:{adapter_id}",
            3600,
            json.dumps(adapter.dict())
        )
        
        return adapter
```

#### 📦 打包服务

**Celery异步任务**:
```python
@celery_app.task
def create_package_task(package_config: dict):
    """
    异步打包任务
    """
    task_id = package_config["task_id"]
    
    try:
        # 1. 更新状态: 打包中
        update_package_status(task_id, "packaging")
        
        # 2. 准备基础应用
        base_app = download_base_app(package_config["platform"])
        
        # 3. 注入配置
        inject_config(base_app, package_config)
        
        # 4. 打包适配器
        for adapter_id in package_config["adapters"]:
            adapter = download_adapter(adapter_id)
            install_adapter(base_app, adapter)
        
        # 5. 添加角色资源
        character = download_character(package_config["character"])
        install_character(base_app, character)
        
        # 6. 构建安装包
        installer = build_installer(base_app, package_config)
        
        # 7. 上传到存储
        download_url = upload_to_storage(installer)
        
        # 8. 更新状态: 完成
        update_package_status(task_id, "completed", {
            "download_url": download_url,
            "file_size": os.path.getsize(installer)
        })
        
    except Exception as e:
        # 打包失败
        update_package_status(task_id, "failed", {
            "error": str(e)
        })
        raise
```

---

## 🐍 三、Python 核心库 (zishu/)

### 3.1 目录结构

```
zishu/
├── __init__.py
├── adapters/              # 适配器系统
│   ├── base.py           # 适配器基类
│   ├── file_ops.py       # 文件操作适配器
│   ├── web_automation.py # 网页自动化
│   └── system_control.py # 系统控制
│
├── llm/                   # LLM集成
│   ├── base.py           # LLM基类
│   ├── openai_client.py  # OpenAI客户端
│   ├── qwen_client.py    # Qwen客户端
│   └── local_model.py    # 本地模型
│
├── live2d/               # Live2D集成
│   ├── manager.py        # Live2D管理器
│   └── models/           # Live2D模型资源
│
├── training/             # 模型训练
│   ├── train/
│   │   └── base.py       # ModelManager类
│   └── dataset/
│
├── api/                  # API客户端
│   └── community.py      # 社区平台API客户端
│
└── utils/                # 工具函数
    ├── logger.py         # 日志工具
    ├── config.py         # 配置加载
    └── security.py       # 安全工具
```

### 3.2 适配器基类

```python
# zishu/adapters/base.py
class BaseAdapter(ABC):
    """适配器基类"""
    
    def __init__(self, config: dict):
        self.config = config
        self.name = config["name"]
        self.version = config["version"]
        self.category = config["category"]
    
    @abstractmethod
    async def execute(self, action: str, params: dict) -> dict:
        """
        执行适配器操作
        
        Args:
            action: 操作名称
            params: 操作参数
        
        Returns:
            操作结果
        """
        pass
    
    @abstractmethod
    def get_required_permissions(self) -> List[str]:
        """获取需要的权限列表"""
        pass
    
    def validate_params(self, action: str, params: dict) -> bool:
        """验证参数"""
        schema = self.get_action_schema(action)
        # 使用 jsonschema 验证
        return validate(params, schema)
```

**适配器示例**:
```python
# zishu/adapters/file_ops.py
class FileOperationAdapter(BaseAdapter):
    """文件操作适配器"""
    
    def get_required_permissions(self):
        return [
            "FileRead",
            "FileWrite",
            "FileDelete"
        ]
    
    async def execute(self, action: str, params: dict):
        if action == "read":
            return await self.read_file(params["path"])
        elif action == "write":
            return await self.write_file(
                params["path"], 
                params["content"]
            )
        elif action == "delete":
            return await self.delete_file(params["path"])
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def read_file(self, path: str) -> dict:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {
            "success": True,
            "content": content,
            "size": len(content)
        }
```

### 3.3 LLM集成

```python
# zishu/llm/base.py
class BaseLLMClient(ABC):
    """LLM客户端基类"""
    
    @abstractmethod
    async def chat(
        self, 
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """聊天接口"""
        pass
    
    @abstractmethod
    async def stream_chat(
        self, 
        messages: List[dict]
    ) -> AsyncIterator[str]:
        """流式聊天"""
        pass


# zishu/llm/qwen_client.py
class QwenClient(BaseLLMClient):
    """通义千问客户端"""
    
    def __init__(self, api_key: str, model: str = "qwen-max"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    async def chat(self, messages, temperature=0.7, max_tokens=2000):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data
            )
            result = response.json()
            return result["choices"][0]["message"]["content"]
```

### 3.4 模型训练 (可选)

```python
# zishu/training/train/base.py
class ModelManager:
    """基础模型管理类"""
    
    def __init__(self, config_path: str):
        self.config = self.load_config(config_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._model = None
        self._tokenizer = None
    
    def load_model(self):
        """加载模型"""
        model_path = self.config["model_path"]
        self._model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        return self._model
    
    def load_tokenizer(self):
        """加载分词器"""
        tokenizer_path = self.config["tokenizer_path"]
        self._tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
        return self._tokenizer
    
    def generate(
        self, 
        prompt: str, 
        max_new_tokens: int = 256
    ) -> str:
        """生成文本"""
        inputs = self._tokenizer(prompt, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self._model.generate(
                inputs.input_ids,
                max_new_tokens=max_new_tokens,
                temperature=0.7,
                top_p=0.9
            )
        
        generated_text = self._tokenizer.decode(
            outputs[0], 
            skip_special_tokens=True
        )
        return generated_text[len(prompt):].strip()
```

---

## 🔄 四、系统集成与数据流

### 4.1 桌面应用与社区平台集成

#### 场景1: 用户下载安装适配器

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ 桌面应用 │         │ 社区平台 │         │ 数据库   │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │ 1. 浏览适配器      │                   │
     ├──────────────────►│                   │
     │                   │ 2. 查询适配器列表  │
     │                   ├──────────────────►│
     │                   │◄──────────────────┤
     │◄──────────────────┤ 3. 返回列表        │
     │                   │                   │
     │ 4. 下载适配器      │                   │
     ├──────────────────►│                   │
     │                   │ 5. 获取文件        │
     │                   ├──────────────────►│
     │                   │◄──────────────────┤
     │◄──────────────────┤ 6. 返回.zip文件    │
     │                   │                   │
     │ 7. 安装适配器      │                   │
     │ (本地数据库)        │                   │
     │                   │                   │
     │ 8. 同步安装记录     │                   │
     ├──────────────────►│                   │
     │                   │ 9. 更新下载统计    │
     │                   ├──────────────────►│
     │                   │                   │
```

#### 场景2: 在线打包定制应用

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ 用户浏览器│         │ 社区平台 │         │ 打包服务 │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │ 1. 访问打包页面    │                   │
     ├──────────────────►│                   │
     │                   │                   │
     │ 2. 配置应用        │                   │
     │ (选择模型/适配器)   │                   │
     ├──────────────────►│                   │
     │                   │                   │
     │                   │ 3. 创建打包任务    │
     │                   ├──────────────────►│
     │◄──────────────────┤ 4. 返回task_id    │
     │                   │◄──────────────────┤
     │                   │                   │
     │ 5. 轮询任务状态    │                   │
     ├──────────────────►│                   │
     │◄──────────────────┤ status: packaging │
     │                   │                   │
     │ ... (等待) ...    │                   │
     │                   │                   │ (后台打包中)
     │ 6. 轮询任务状态    │                   │
     ├──────────────────►│                   │
     │◄──────────────────┤ status: completed │
     │                   │                   │
     │ 7. 下载安装包      │                   │
     ├──────────────────►│                   │
     │◄──────────────────┤ installer.exe     │
     │                   │                   │
```

### 4.2 AI对话流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  用户输入 │   │ 桌面应用  │   │ Python核心│   │ 云端API  │
└─────┬────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
      │             │              │              │
      │ "帮我总结这个│              │              │
      │  文件"       │              │              │
      ├────────────►│              │              │
      │             │ 1. 解析意图   │              │
      │             │ (需要文件操作) │              │
      │             │              │              │
      │             │ 2. 检查权限   │              │
      │             │ (FileRead)   │              │
      │             │              │              │
      │             │ 3. 执行适配器 │              │
      │             ├─────────────►│              │
      │             │              │ file_ops.read│
      │             │◄─────────────┤              │
      │             │ 文件内容      │              │
      │             │              │              │
      │             │ 4. 调用LLM    │              │
      │             ├─────────────►│              │
      │             │              │ 5. API调用   │
      │             │              ├─────────────►│
      │             │              │◄─────────────┤
      │             │◄─────────────┤ 6. AI响应    │
      │             │ 摘要内容      │              │
      │◄────────────┤              │              │
      │ 显示摘要     │              │              │
      │             │              │              │
```

### 4.3 权限请求流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│  适配器   │   │ 桌面应用  │   │  用户    │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     │ 1. 请求权限   │              │
     ├─────────────►│              │
     │ FileWrite    │              │
     │              │              │
     │              │ 2. 显示权限对话│
     │              ├─────────────►│
     │              │ "XX适配器请求  │
     │              │  写入文件权限" │
     │              │              │
     │              │ 3. 用户决策   │
     │              │◄─────────────┤
     │              │ [允许]       │
     │              │              │
     │              │ 4. 保存授权   │
     │              │ (permission表)│
     │              │              │
     │◄─────────────┤ 5. 返回结果   │
     │ granted      │              │
     │              │              │
     │ 6. 执行操作   │              │
     │              │              │
```

---

## 🚀 五、部署架构

### 5.1 开发环境

```
本地机器
├── 桌面应用 (localhost:1420)
│   └── npm run tauri:dev
│
├── 社区平台前端 (localhost:3000)
│   └── npm run dev
│
└── 社区平台后端 (localhost:8000)
    └── uvicorn main:app --reload
```

### 5.2 生产环境 (Docker)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
  
  # Next.js前端
  frontend:
    build: ./community_platform/frontend
    environment:
      - NODE_ENV=production
  
  # FastAPI后端
  backend:
    build: ./community_platform/backend
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/zishu
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
  
  # PostgreSQL数据库
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=zishu
      - POSTGRES_USER=zishu
      - POSTGRES_PASSWORD=secret
  
  # Redis缓存
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass secret
  
  # Qdrant向量数据库
  qdrant:
    image: qdrant/qdrant:v1.7.0
    volumes:
      - qdrant_data:/qdrant/storage
  
  # Celery任务队列
  celery:
    build: ./community_platform/backend
    command: celery -A tasks worker -l info
    depends_on:
      - redis
      - backend

volumes:
  postgres_data:
  qdrant_data:
```

### 5.3 云服务器部署

**推荐配置**:
```
服务器: 4核8G (最低2核4G)
存储: 100GB SSD + 200GB 云硬盘
系统: Ubuntu 22.04 LTS
Docker: 24.0+
```

**目录结构**:
```
/data/disk/zishu-sensei/          # 云硬盘挂载点
├── data/
│   ├── postgres/                 # PostgreSQL数据
│   ├── redis/                    # Redis数据
│   ├── qdrant/                   # Qdrant数据
│   └── prometheus/               # 监控数据
├── models/                       # AI模型文件 (可选)
├── logs/                         # 应用日志
└── backup/                       # 数据备份
```

**部署命令**:
```bash
# 1. 克隆代码
git clone https://github.com/yourusername/zishu-sensei.git
cd zishu-sensei

# 2. 配置环境变量
cp .env.example .env
nano .env

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 访问服务
# 前端: https://your-domain.com
# API: https://your-domain.com/api
# 文档: https://your-domain.com/api/docs
```

---

## 📊 六、数据库设计

### 6.1 桌面应用本地数据库 (SQLite)

**核心表**:
```sql
-- 适配器表
CREATE TABLE adapters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    config JSONB,
    installed_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 角色表
CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_path TEXT NOT NULL,
    voice_id TEXT,
    config JSONB,
    is_active BOOLEAN DEFAULT false,
    created_at BIGINT NOT NULL
);

-- 工作流表
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    status TEXT NOT NULL,
    steps JSONB,
    config JSONB,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 权限授予表
CREATE TABLE permission_grants (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    permission_type TEXT NOT NULL,
    permission_level TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at BIGINT,
    granted_at BIGINT NOT NULL
);

-- 性能快照表
CREATE TABLE performance_snapshots (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage BIGINT NOT NULL,
    disk_usage REAL NOT NULL,
    network_sent BIGINT NOT NULL,
    network_received BIGINT NOT NULL
    -- ... 共17个指标
);
```

### 6.2 社区平台数据库 (PostgreSQL)

**核心表**:
```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 适配器表
CREATE TABLE adapters (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    author_id VARCHAR(50) REFERENCES users(id),
    
    -- 统计
    downloads INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    
    -- 文件
    file_url TEXT NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64),
    
    -- 元数据
    tags JSONB,
    dependencies JSONB,
    requirements JSONB,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'published',
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 帖子表
CREATE TABLE posts (
    id VARCHAR(50) PRIMARY KEY,
    author_id VARCHAR(50) REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50),
    tags JSONB,
    
    -- 统计
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'published',
    is_pinned BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 评论表
CREATE TABLE comments (
    id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) REFERENCES posts(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id),
    parent_id VARCHAR(50) REFERENCES comments(id),
    content TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 打包任务表
CREATE TABLE packaging_tasks (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id),
    config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    
    -- 结果
    download_url TEXT,
    file_size BIGINT,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

---

## 🔧 七、配置管理

### 7.1 环境变量

**桌面应用** (`.env.local`):
```bash
# API配置
QWEN_API_KEY=sk-xxxxx
OPENAI_API_KEY=sk-xxxxx

# 社区平台
COMMUNITY_API_URL=https://api.zishu.ai

# 本地模型路径 (可选)
LOCAL_MODEL_PATH=/path/to/models
```

**社区平台** (`.env`):
```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/zishu
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# 存储
STORAGE_BACKEND=s3  # s3 or local
S3_BUCKET=zishu-files
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# 邮件
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@zishu.ai
SMTP_PASSWORD=xxx

# 监控
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 7.2 配置文件

**LLM配置** (`config/services/api_config.yml`):
```yaml
providers:
  qwen:
    api_key: ${QWEN_API_KEY}
    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    model: qwen-max
    enabled: true
    priority: 8
    
  openai:
    api_key: ${OPENAI_API_KEY}
    base_url: https://api.openai.com/v1
    model: gpt-4-turbo-preview
    enabled: false
    priority: 9
```

---

## 📈 八、监控与日志

### 8.1 日志系统

**日志级别**:
- DEBUG: 详细调试信息
- INFO: 一般信息
- WARNING: 警告信息
- ERROR: 错误信息
- CRITICAL: 严重错误

**日志位置**:
```
桌面应用: ~/.zishu/logs/app.log
社区平台: /var/log/zishu/api.log
```

### 8.2 性能监控

**指标收集**:
- API响应时间
- 数据库查询时间
- 缓存命中率
- 错误率
- 请求量 (QPS)

**监控工具**:
- Prometheus + Grafana (推荐)
- Sentry (错误追踪)
- ELK Stack (日志聚合)

---

## 🔐 九、安全机制

### 9.1 桌面应用安全

1. **沙箱隔离**: 适配器在受限环境中运行
2. **权限系统**: 细粒度权限控制
3. **代码签名**: 验证适配器来源
4. **加密存储**: 敏感数据加密存储

### 9.2 社区平台安全

1. **JWT认证**: 无状态身份验证
2. **HTTPS**: 全站HTTPS加密
3. **SQL注入防护**: ORM + 参数化查询
4. **XSS防护**: 输入验证 + 输出转义
5. **CSRF防护**: Token验证
6. **速率限制**: 防止暴力攻击
7. **文件扫描**: 上传文件病毒扫描

---

## 📚 十、开发规范

### 10.1 代码规范

**Python**:
- PEP 8
- Black formatter
- Type hints
- Docstrings

**TypeScript**:
- ESLint + Prettier
- Strict mode
- JSDoc注释

**Rust**:
- rustfmt
- clippy检查

### 10.2 Git工作流

**分支策略**:
```
main         - 生产环境
develop      - 开发环境
feature/*    - 功能分支
hotfix/*     - 紧急修复
release/*    - 发布分支
```

**提交规范** (Conventional Commits):
```
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 🎯 十一、开发路线图

### ✅ 已完成
- [x] 桌面应用基础架构
- [x] Python核心库
- [x] 适配器系统
- [x] 权限管理
- [x] 性能监控
- [x] 工作流系统
- [x] 社区平台前端基础
- [x] 社区平台后端基础

### 🚧 进行中
- [ ] 适配器市场完善
- [ ] 在线打包服务
- [ ] Live2D集成优化
- [ ] 语音交互功能

### 📋 计划中
- [ ] 移动端支持 (React Native)
- [ ] 插件开发者工具
- [ ] 本地模型微调工具
- [ ] 企业版功能

---

## 📞 十二、技术支持

### 文档
- **架构设计**: `docs/ARCHITECTURE.md`
- **API文档**: `docs/API.md`
- **部署指南**: `DEPLOYMENT.md`
- **贡献指南**: `CONTRIBUTING.md`

### 联系方式
- **GitHub Issues**: https://github.com/yourusername/zishu-sensei/issues
- **Discord社区**: https://discord.gg/zishu
- **邮箱**: support@zishu.ai

---

## 📝 附录

### A. 术语表

| 术语 | 说明 |
|------|------|
| **适配器** | 扩展桌面应用功能的插件 |
| **工作流** | 自动化任务序列 |
| **权限** | 适配器访问系统资源的许可 |
| **打包** | 生成自定义桌面应用安装包 |
| **Live2D** | 2D虚拟角色动画技术 |
| **向量搜索** | 基于语义的搜索技术 |
| **DDD** | 领域驱动设计 |
| **BFF** | Backend For Frontend |

### B. 常见问题

**Q: 桌面应用如何调用云端模型?**
A: 通过配置API密钥,使用`zishu/llm/`模块调用云端API。

**Q: 如何开发自己的适配器?**
A: 继承`BaseAdapter`类,实现`execute()`方法,参考现有适配器。

**Q: 社区平台支持哪些部署方式?**
A: Docker Compose (推荐)、Kubernetes、手动部署。

**Q: 如何备份数据?**
A: 定期备份PostgreSQL、Redis、文件存储,参考`scripts/backup.sh`。

---

**文档维护者**: Zishu Team  
**最后更新**: 2025-10-31  
**版本**: 1.0



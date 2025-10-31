# Zishu Sensei 核心业务逻辑实现指南

## 📋 文档说明

本文档详细说明了 Zishu Sensei 项目的两个核心业务场景的完整实现：

1. **场景1：用户下载安装适配器**
2. **场景2：在线打包定制应用**

**创建日期**: 2025-10-31  
**实现状态**: ✅ 已完成

---

## 🎯 场景1: 用户下载安装适配器

### 架构概览

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 前端用户界面 │◄──►│ 后端API服务  │◄──►│ 桌面应用     │◄──►│ 本地数据库   │
│ (Next.js)   │    │ (FastAPI)   │    │ (Tauri/Rust)│    │ (SQLite)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 1.1 后端API实现

#### 核心文件

- **API路由**: `/opt/zishu-sensei/community_platform/backend/app/api/v1/endpoints/adapters.py`
- **业务逻辑**: `/opt/zishu-sensei/community_platform/backend/app/services/adapter/adapter_service.py`

#### 主要API端点

```python
# 1. 获取适配器列表
GET /api/v1/adapters
参数:
  - page: int (页码)
  - size: int (每页数量)
  - category: Optional[AdapterCategory] (分类筛选)
  - search: Optional[str] (搜索关键词)
  - tags: Optional[str] (标签筛选)
  - sort_by: str (排序字段: created_at, downloads, rating)
  - order: str (排序方向: asc, desc)

# 2. 获取适配器详情
GET /api/v1/adapters/{adapter_id}

# 3. 下载适配器
GET /api/v1/adapters/{adapter_id}/download
  - 自动记录下载统计
  - 返回重定向到实际文件URL

# 4. 收藏适配器
POST /api/v1/adapters/{adapter_id}/favorite
DELETE /api/v1/adapters/{adapter_id}/favorite

# 5. 评价适配器
POST /api/v1/adapters/{adapter_id}/reviews

# 6. 获取精选/热门/最新适配器
GET /api/v1/adapters/featured
GET /api/v1/adapters/trending
GET /api/v1/adapters/latest
```

#### 业务逻辑示例

```python
class AdapterService:
    @staticmethod
    def download_adapter(
        db: Session,
        adapter_id: str,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> str:
        """下载适配器"""
        adapter = AdapterService.get_adapter(db, adapter_id, user=user)
        
        # 增加下载计数
        adapter.downloads += 1
        
        # 记录下载
        download_record = AdapterDownload(
            id=f"dl_{uuid.uuid4().hex[:12]}",
            adapter_id=adapter_id,
            user_id=user.id if user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            platform=platform,
        )
        db.add(download_record)
        db.commit()
        
        return adapter.file_url
```

### 1.2 前端实现

#### 核心文件

- **适配器市场页面**: `/opt/zishu-sensei/community_platform/frontend/app/[locale]/(main)/adapters/page.tsx`
- **适配器卡片组件**: `/opt/zishu-sensei/community_platform/frontend/src/features/adapter/components/marketplace/AdapterCard.tsx`
- **API客户端**: `/opt/zishu-sensei/community_platform/frontend/src/features/adapter/api/AdapterApiClient.ts`

#### 主要功能

```typescript
// 1. 获取适配器列表
const { data: adaptersData } = useAdapters({
  page: 1,
  pageSize: 20,
  category: selectedCategory,
  search: searchQuery,
  sortBy: 'downloads',
  sortOrder: 'desc',
});

// 2. 下载适配器
const downloadAdapter = useDownloadAdapter();
await downloadAdapter.mutateAsync({ 
  id: adapterId, 
  version: '1.0.0' 
});

// 3. 收藏适配器
const favoriteAdapter = useFavoriteAdapter();
await favoriteAdapter.mutateAsync(adapterId);

// 4. 评价适配器
const rateAdapter = useRateAdapter();
await rateAdapter.mutateAsync({ 
  adapterId, 
  rating: 5, 
  comment: '非常好用！' 
});
```

#### 页面特性

- ✅ 响应式布局 (网格/列表视图切换)
- ✅ 实时搜索和筛选
- ✅ 分类浏览
- ✅ 精选/热门/最新推荐
- ✅ 分页和无限滚动支持
- ✅ 收藏和点赞功能
- ✅ 评分和评论系统

### 1.3 桌面应用安装

#### 核心文件

- **适配器命令**: `/opt/zishu-sensei/desktop_app/src-tauri/src/commands/adapter.rs`
- **市场命令**: `/opt/zishu-sensei/desktop_app/src-tauri/src/commands/market.rs`
- **数据库适配器注册**: `/opt/zishu-sensei/desktop_app/src-tauri/src/database/adapter.rs`

#### 安装流程

```rust
// 1. 从市场下载适配器
#[tauri::command]
pub async fn download_market_product(
    product_id: String,
    version: Option<String>,
    app_handle: AppHandle,
) -> Result<CommandResponse<String>, String> {
    // 下载到本地目录
    let file_path = download_product(&product_id, version.as_deref(), &app_handle).await?;
    Ok(CommandResponse::success(file_path))
}

// 2. 安装适配器
#[tauri::command]
pub async fn install_adapter(
    request: AdapterInstallRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    // 验证适配器包
    // 解压到安装目录
    // 注册到数据库
    // 请求权限
    install_adapter_from_backend(&request).await
}

// 3. 启用适配器
#[tauri::command]
pub async fn toggle_adapter(
    adapter_id: String,
    enabled: bool,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    let db = get_database()?;
    db.adapter_registry.set_adapter_enabled(&adapter_id, enabled).await?;
    Ok(CommandResponse::success(true))
}
```

#### 本地适配器管理

```rust
// 获取已安装适配器列表
#[tauri::command]
pub async fn get_installed_adapters() -> Result<CommandResponse<Vec<InstalledAdapter>>, String>

// 获取已启用适配器列表
#[tauri::command]
pub async fn get_enabled_adapters() -> Result<CommandResponse<Vec<InstalledAdapter>>, String>

// 删除已安装适配器
#[tauri::command]
pub async fn remove_installed_adapter(adapter_id: String) -> Result<CommandResponse<bool>, String>

// 检查适配器更新
#[tauri::command]
pub async fn check_product_updates(product_ids: Vec<String>) -> Result<CommandResponse<Vec<ProductUpdateInfo>>, String>
```

### 1.4 完整流程示例

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端API
    participant D as 桌面应用
    participant DB as 本地数据库

    U->>F: 1. 浏览适配器市场
    F->>B: GET /api/v1/adapters
    B-->>F: 返回适配器列表
    F-->>U: 展示适配器卡片

    U->>F: 2. 点击下载按钮
    F->>B: GET /api/v1/adapters/{id}/download
    B->>B: 记录下载统计
    B-->>F: 返回下载URL (重定向)
    F->>D: 调用 download_market_product()
    
    D->>D: 3. 下载文件到本地
    D->>D: 4. 解压并验证适配器包
    D->>D: 5. 安装到 ~/.zishu/adapters/
    D->>DB: 6. 注册到本地数据库
    DB-->>D: 注册成功
    
    D->>U: 7. 弹出权限请求对话框
    U->>D: 授予权限
    D->>DB: 记录权限
    
    D-->>U: 安装成功通知
    U->>D: 8. 启用适配器
    D->>DB: 更新状态为enabled
    D-->>U: 适配器已激活
```

---

## 🎁 场景2: 在线打包定制应用

### 架构概览

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 前端配置界面 │◄──►│ 后端API服务  │◄──►│ Celery任务   │◄──►│ 文件存储     │
│ (Next.js)   │    │ (FastAPI)   │    │ (异步打包)   │    │ (S3/本地)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 2.1 后端API实现

#### 核心文件

- **API路由**: `/opt/zishu-sensei/community_platform/backend/app/api/v1/endpoints/packaging.py`
- **业务逻辑**: `/opt/zishu-sensei/community_platform/backend/app/services/adapter/packaging_service.py`
- **Celery任务**: `/opt/zishu-sensei/community_platform/backend/app/tasks/packaging.py`

#### 主要API端点

```python
# 1. 创建打包任务
POST /api/v1/packaging/
Body: {
  "config": {
    "app_name": "我的AI助手",
    "version": "1.0.0",
    "description": "个人定制版AI助手",
    "character_id": "char_123",
    "adapter_ids": ["adapter_001", "adapter_002"],
    "platform": "windows",
    "architecture": "x64"
  }
}

# 2. 获取任务状态
GET /api/v1/packaging/{task_id}/status
Response: {
  "id": "pkg_abc123",
  "status": "packaging",
  "progress": 60,
  "download_url": null
}

# 3. 获取任务详情
GET /api/v1/packaging/{task_id}

# 4. 获取用户任务列表
GET /api/v1/packaging/user/tasks

# 5. 取消任务
DELETE /api/v1/packaging/{task_id}

# 6. 获取可用模型列表
GET /api/v1/packaging/models/available

# 7. 获取可用角色列表
GET /api/v1/packaging/characters/available
```

#### 业务逻辑示例

```python
class PackagingService:
    @staticmethod
    def create_task(
        db: Session,
        task_data: PackagingTaskCreate,
        user: User
    ) -> PackagingTask:
        """创建打包任务"""
        # 验证配置
        config = task_data.config
        
        # 验证适配器ID是否存在
        for adapter_id in config.adapters:
            adapter = db.query(Adapter).filter(Adapter.id == adapter_id).first()
            if not adapter:
                raise BadRequestException(f"适配器 {adapter_id} 不存在")
        
        # 创建任务
        task_id = f"pkg_{uuid.uuid4().hex[:12]}"
        task = PackagingTask(
            id=task_id,
            user_id=user.id,
            config=config.model_dump(),
            platform=task_data.platform,
            status="pending",
            progress=0,
        )
        
        db.add(task)
        db.commit()
        db.refresh(task)
        
        # 异步启动打包任务
        from app.tasks.packaging import create_package_task
        create_package_task.delay(task_id)
        
        return task
```

### 2.2 Celery异步任务

#### 核心文件

- **Celery配置**: `/opt/zishu-sensei/community_platform/backend/app/tasks/celery_app.py`
- **打包任务**: `/opt/zishu-sensei/community_platform/backend/app/tasks/packaging.py`

#### 任务实现

```python
@celery_app.task(
    bind=True,
    base=PackagingTask,
    name="tasks.create_package"
)
def create_package_task(self, task_id: str):
    """
    创建打包任务
    
    步骤：
    1. 创建工作目录 (10%)
    2. 复制基础应用 (30%)
    3. 注入配置 (40%)
    4. 安装适配器 (60%)
    5. 添加角色资源 (70%)
    6. 构建安装包 (85%)
    7. 计算哈希和大小 (90%)
    8. 上传到存储 (95%)
    9. 完成 (100%)
    """
    db = SessionLocal()
    
    try:
        # 获取任务信息
        task = PackagingService.get_task(db, task_id, user=None)
        config = task.config
        platform = task.platform
        
        # 更新状态为打包中
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="packaging",
            progress=0
        )
        
        # 步骤1: 创建工作目录 (10%)
        self.update_state(state='PROGRESS', meta={'progress': 10, 'status': '创建工作目录'})
        work_dir = tempfile.mkdtemp(prefix=f"packaging_{task_id}_")
        
        # 步骤2: 复制基础应用 (30%)
        self.update_state(state='PROGRESS', meta={'progress': 30, 'status': '准备基础应用'})
        base_app_dir = os.path.join(work_dir, "app")
        shutil.copytree(BASE_APP_PATH, base_app_dir, ignore=shutil.ignore_patterns(
            'node_modules', '.git', '__pycache__', 'target', 'dist'
        ))
        
        # 步骤3: 注入配置 (40%)
        self.update_state(state='PROGRESS', meta={'progress': 40, 'status': '注入配置'})
        config_file = os.path.join(base_app_dir, "config", "app.json")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        # 步骤4: 安装适配器 (60%)
        self.update_state(state='PROGRESS', meta={'progress': 60, 'status': '安装适配器'})
        for adapter_id in config.get("adapters", []):
            # 下载并安装适配器
            install_adapter_to_package(base_app_dir, adapter_id, db)
        
        # 步骤5: 添加角色资源 (70%)
        self.update_state(state='PROGRESS', meta={'progress': 70, 'status': '添加角色资源'})
        if config.get("character"):
            install_character_to_package(base_app_dir, config["character"], db)
        
        # 步骤6: 构建安装包 (85%)
        self.update_state(state='PROGRESS', meta={'progress': 85, 'status': '构建安装包'})
        output_file = _build_installer(base_app_dir, platform, config, task_id)
        
        # 步骤7: 计算哈希和大小 (90%)
        self.update_state(state='PROGRESS', meta={'progress': 90, 'status': '计算文件信息'})
        file_hash = _calculate_hash(output_file)
        file_size = os.path.getsize(output_file)
        
        # 步骤8: 上传到存储 (95%)
        self.update_state(state='PROGRESS', meta={'progress': 95, 'status': '上传文件'})
        download_url = _upload_to_storage(output_file, task_id, platform)
        
        # 步骤9: 完成 (100%)
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="completed",
            progress=100,
            download_url=download_url,
            file_size=file_size,
            file_hash=file_hash
        )
        
        # 清理工作目录
        shutil.rmtree(work_dir, ignore_errors=True)
        
        return {
            "task_id": task_id,
            "status": "completed",
            "download_url": download_url,
            "file_size": file_size,
            "file_hash": file_hash,
        }
        
    except Exception as e:
        # 更新状态为失败
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="failed",
            error_message=str(e)
        )
        raise
        
    finally:
        db.close()
```

### 2.3 前端实现

#### 核心文件

- **打包页面**: `/opt/zishu-sensei/community_platform/frontend/app/[locale]/(main)/packaging/page.tsx`
- **打包配置表单**: `/opt/zishu-sensei/community_platform/frontend/src/features/packaging/components/PackageConfigForm.tsx`
- **打包进度组件**: `/opt/zishu-sensei/community_platform/frontend/src/features/packaging/components/PackagingProgress.tsx`

#### 主要功能

```typescript
// 1. 创建打包任务
const createPackageMutation = useCreatePackage();
const task = await createPackageMutation.mutateAsync({
  config: {
    appName: '我的AI助手',
    version: '1.0.0',
    characterId: 'char_001',
    adapterIds: ['adapter_001', 'adapter_002'],
    platform: 'windows',
    architecture: 'x64',
  }
});

// 2. 轮询任务状态
const { data: taskStatus } = useQuery({
  queryKey: ['packaging-task', taskId],
  queryFn: () => getPackagingTaskStatus(taskId),
  refetchInterval: 2000, // 每2秒轮询一次
  enabled: task.status === 'packaging',
});

// 3. 下载打包好的应用
const handleDownload = () => {
  window.location.href = taskStatus.download_url;
};
```

#### 页面特性

- ✅ 分步骤配置表单
- ✅ 实时进度显示
- ✅ 任务状态轮询
- ✅ 错误处理和重试
- ✅ 打包历史记录
- ✅ 模板保存功能
- ✅ 多平台支持选择

### 2.4 完整流程示例

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端API
    participant C as Celery任务
    participant S as 文件存储

    U->>F: 1. 访问打包页面
    F->>B: GET /api/v1/packaging/models/available
    F->>B: GET /api/v1/packaging/characters/available
    B-->>F: 返回可用资源列表

    U->>F: 2. 填写配置并提交
    F->>B: POST /api/v1/packaging/
    B->>B: 创建任务记录
    B->>C: 启动异步打包任务
    B-->>F: 返回 task_id

    F->>F: 3. 开始轮询任务状态
    loop 每2秒轮询
        F->>B: GET /api/v1/packaging/{task_id}/status
        B-->>F: {"status": "packaging", "progress": 60}
        F->>F: 更新进度条
    end

    C->>C: 4. 执行打包步骤
    Note over C: 复制基础应用
    Note over C: 注入配置
    Note over C: 安装适配器
    Note over C: 添加角色资源
    Note over C: 构建安装包

    C->>S: 5. 上传文件
    S-->>C: 返回下载URL

    C->>B: 6. 更新任务状态
    B->>B: status="completed"

    F->>B: 7. 最后一次轮询
    B-->>F: {"status": "completed", "download_url": "..."}
    F-->>U: 显示下载按钮

    U->>F: 8. 点击下载
    F->>S: 直接下载文件
    S-->>U: 安装包文件
```

---

## 🔧 环境配置

### 后端配置

创建 `.env` 文件:

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/zishu
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# 打包配置
BASE_APP_PATH=/opt/zishu-sensei/desktop_app
PACKAGING_OUTPUT_PATH=/tmp/packaging_output
STORAGE_URL_PREFIX=https://storage.zishu.ai

# JWT
JWT_SECRET=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 启动服务

```bash
# 1. 启动后端API
cd community_platform/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. 启动Celery Worker
celery -A app.tasks.celery_app worker -l info

# 3. 启动前端
cd community_platform/frontend
npm run dev

# 4. 启动桌面应用
cd desktop_app
npm run tauri:dev
```

---

## 📊 数据库Schema

### 适配器表

```sql
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
    
    -- 状态
    status VARCHAR(20) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 打包任务表

```sql
CREATE TABLE packaging_tasks (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id),
    config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, packaging, completed, failed
    platform VARCHAR(20) NOT NULL, -- windows, macos, linux
    progress INTEGER DEFAULT 0, -- 0-100
    
    -- 结果
    download_url TEXT,
    file_size BIGINT,
    file_hash VARCHAR(64),
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

---

## 🧪 测试

### API测试

```bash
# 测试适配器列表
curl http://localhost:8000/api/v1/adapters

# 测试适配器下载
curl http://localhost:8000/api/v1/adapters/{adapter_id}/download

# 测试创建打包任务
curl -X POST http://localhost:8000/api/v1/packaging/ \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "app_name": "Test App",
      "version": "1.0.0",
      "adapters": [],
      "platform": "windows"
    }
  }'

# 测试任务状态
curl http://localhost:8000/api/v1/packaging/{task_id}/status
```

### 前端测试

```bash
cd community_platform/frontend
npm run test
npm run test:e2e
```

---

## 📝 注意事项

### 安全性

1. **权限验证**: 所有敏感操作都需要用户认证
2. **文件验证**: 下载的适配器包需要验证签名和哈希
3. **沙箱隔离**: 适配器在受限环境中运行
4. **API限流**: 防止滥用下载和打包接口

### 性能优化

1. **缓存策略**: 使用Redis缓存适配器列表和详情
2. **CDN加速**: 静态资源和下载文件使用CDN
3. **异步处理**: 打包任务使用Celery异步执行
4. **进度推送**: 使用WebSocket推送实时进度

### 错误处理

1. **下载失败**: 提供重试机制
2. **安装失败**: 回滚到之前状态
3. **打包失败**: 保存错误日志供调试
4. **网络超时**: 合理设置超时时间

---

## 🚀 未来优化

### 短期计划

- [ ] 添加适配器依赖自动解析
- [ ] 实现增量更新机制
- [ ] 优化打包速度
- [ ] 添加更多平台支持

### 长期计划

- [ ] 支持适配器热更新
- [ ] 实现分布式打包
- [ ] 添加A/B测试功能
- [ ] 支持插件市场分成

---

## 📞 技术支持

如有问题，请联系：
- **GitHub Issues**: https://github.com/yourusername/zishu-sensei/issues
- **Discord**: https://discord.gg/zishu
- **Email**: support@zishu.ai

---

**文档维护**: Zishu Team  
**最后更新**: 2025-10-31  
**版本**: 1.0.0


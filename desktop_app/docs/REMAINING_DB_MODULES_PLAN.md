# 待实现数据库模块详细计划

> **项目**: Zishu Sensei Desktop App - PostgreSQL 数据库层
> 
> **状态**: 7个模块待实现（3个高优先级，2个中优先级，2个低优先级）
> 
> **创建时间**: 2025-10-22
> 
> **已完成模块**: adapter.rs, character_registry.rs, model_config.rs, workflow.rs, permission.rs, performance.rs

---

## 📋 目录

1. [模块概览](#模块概览)
2. [高优先级模块](#高优先级模块)
   - [file.rs - 文件管理](#1-filers---文件管理)
   - [logging.rs - 日志记录](#2-loggingrs---日志记录)
   - [encrypted_storage.rs - 加密存储](#3-encrypted_storagers---加密存储)
3. [中优先级模块](#中优先级模块)
   - [update.rs - 应用更新](#4-updaters---应用更新)
   - [theme.rs - 主题管理](#5-themers---主题管理)
4. [低优先级模块](#低优先级模块)
   - [region.rs - 区域设置](#6-regionrs---区域设置)
   - [privacy.rs - 隐私设置](#7-privacyrs---隐私设置)
5. [实施时间表](#实施时间表)

---

## 模块概览

| 模块 | 当前状态 | 行数 | 依赖命令 | 优先级 | 预计工时 |
|------|---------|------|---------|--------|---------|
| **file.rs** | Stub | 158 | commands/file.rs (462行) | 🔴 高 | 6-8小时 |
| **logging.rs** | Stub | 35 | commands/logging.rs | 🔴 高 | 3-4小时 |
| **encrypted_storage.rs** | Stub | 81 | commands/encryption.rs | 🔴 高 | 4-5小时 |
| **update.rs** | Stub | 174 | commands/update.rs (596行) | 🟡 中 | 5-6小时 |
| **theme.rs** | Stub | 39 | commands/theme.rs | 🟡 中 | 3-4小时 |
| **region.rs** | Stub | 145 | commands/region.rs | 🟢 低 | 3-4小时 |
| **privacy.rs** | Stub | 38 | commands/privacy.rs | 🟢 低 | 2-3小时 |
| **总计** | - | 670 | 7个命令模块 | - | **26-34小时** |

---

## 高优先级模块

### 1. file.rs - 文件管理

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/file.rs`
- **当前状态**: 158行 Stub（全部空实现）
- **依赖命令**: `commands/file.rs` (462行)
- **优先级**: 🔴 **最高** - 核心业务功能

#### 🎯 功能需求

##### 数据模型
```rust
pub struct FileMetadata {
    pub file_path: String,
    pub file_size: i64,
    pub file_hash: String,
    pub created_at: i64,
}

pub struct FileInfo {
    pub id: String,                    // UUID
    pub name: String,                  // 文件名
    pub original_name: String,         // 原始文件名
    pub file_path: String,             // 存储路径
    pub file_size: i64,                // 文件大小（字节）
    pub file_type: String,             // 类型：image/video/audio/document等
    pub mime_type: String,             // MIME类型
    pub hash: String,                  // SHA256哈希（去重）
    pub thumbnail_path: Option<String>, // 缩略图路径
    pub conversation_id: Option<String>, // 关联对话
    pub message_id: Option<String>,     // 关联消息
    pub tags: Option<String>,           // 标签（JSON数组）
    pub description: Option<String>,    // 描述
    pub created_at: String,            // 创建时间
    pub updated_at: String,            // 更新时间
    pub accessed_at: String,           // 最后访问时间
    pub is_deleted: bool,              // 软删除标记
}

pub struct FileHistory {
    pub id: i64,
    pub file_id: String,
    pub action: String,               // upload/download/delete/update等
    pub details: Option<String>,      // JSON详情
    pub timestamp: String,
}

pub struct FileStats {
    pub total_files: i64,
    pub total_size: i64,
    pub deleted_files: i64,
    pub file_types: HashMap<String, i64>,
}
```

#### 🗄️ 数据库表设计

##### 1. `files` 表
```sql
CREATE TABLE files (
    id VARCHAR(36) PRIMARY KEY,              -- UUID
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,          -- image, video, audio, document等
    mime_type VARCHAR(100) NOT NULL,
    hash VARCHAR(64) NOT NULL,               -- SHA256
    thumbnail_path TEXT,
    conversation_id VARCHAR(36),
    message_id VARCHAR(36),
    tags TEXT,                               -- JSON数组
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- 索引
    INDEX idx_files_hash (hash),
    INDEX idx_files_conversation_id (conversation_id),
    INDEX idx_files_file_type (file_type),
    INDEX idx_files_created_at (created_at),
    INDEX idx_files_is_deleted (is_deleted)
);
```

##### 2. `file_history` 表
```sql
CREATE TABLE file_history (
    id BIGSERIAL PRIMARY KEY,
    file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,             -- upload, download, delete, update, restore
    details TEXT,                            -- JSON格式详细信息
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 索引
    INDEX idx_file_history_file_id (file_id),
    INDEX idx_file_history_timestamp (timestamp)
);
```

#### 🔧 需要实现的函数

##### FileRegistry 类方法
```rust
impl FileRegistry {
    pub fn new(pool: DbPool) -> Self;
    pub async fn init_tables(&self) -> Result<(), Box<dyn Error>>;
}
```

##### SQLite 兼容函数（14个）
```rust
// 表初始化
pub fn init_file_tables(conn: &DummyConnection) -> Result<()>;

// 文件信息管理
pub fn save_file_info(conn: &DummyConnection, file_info: &FileInfo) -> Result<()>;
pub fn get_file_info(conn: &DummyConnection, file_id: &str) -> Result<Option<FileInfo>>;
pub fn update_file_info(conn: &DummyConnection, file_info: &FileInfo) -> Result<()>;

// 文件删除
pub fn mark_file_deleted(conn: &DummyConnection, file_id: &str) -> Result<()>;
pub fn delete_file_permanently(conn: &DummyConnection, file_id: &str) -> Result<()>;
pub fn batch_delete_files(conn: &DummyConnection, file_ids: &[String]) -> Result<usize>;
pub fn cleanup_deleted_files(conn: &DummyConnection, days: i64) -> Result<Vec<FileInfo>>;

// 文件查询
pub fn list_files(
    conn: &DummyConnection,
    conversation_id: Option<&str>,
    file_type: Option<&str>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<FileInfo>>;

pub fn search_files(
    conn: &DummyConnection,
    keyword: &str,
    file_type: Option<&str>,
) -> Result<Vec<FileInfo>>;

pub fn find_file_by_hash(conn: &DummyConnection, hash: &str) -> Result<Option<FileInfo>>;

// 历史和统计
pub fn get_file_history(conn: &DummyConnection, file_id: &str) -> Result<Vec<FileHistory>>;
pub fn add_file_history(
    conn: &DummyConnection,
    file_id: &str,
    action: &str,
    details: Option<&str>,
) -> Result<()>;
pub fn get_file_stats(conn: &DummyConnection) -> Result<FileStats>;
```

#### 📝 实现要点

1. **哈希去重**
   - 使用SHA256哈希检测重复文件
   - `find_file_by_hash` 用于上传前检查

2. **软删除机制**
   - `mark_file_deleted` 设置 `is_deleted = true`
   - `cleanup_deleted_files` 清理N天前的已删除文件
   - `delete_file_permanently` 物理删除

3. **文件搜索**
   - 按文件名、描述、标签搜索
   - 支持文件类型过滤
   - 分页支持

4. **历史追踪**
   - 记录所有文件操作
   - 支持审计和调试

5. **统计功能**
   - 总文件数、总大小
   - 按类型统计
   - 已删除文件统计

#### 🧪 测试用例

```rust
#[cfg(test)]
mod tests {
    // 1. 文件上传和去重测试
    #[tokio::test]
    async fn test_file_deduplication();
    
    // 2. 软删除和清理测试
    #[tokio::test]
    async fn test_soft_delete_and_cleanup();
    
    // 3. 文件搜索测试
    #[tokio::test]
    async fn test_file_search();
    
    // 4. 批量删除测试
    #[tokio::test]
    async fn test_batch_delete();
    
    // 5. 历史记录测试
    #[tokio::test]
    async fn test_file_history();
}
```

---

### 2. logging.rs - 日志记录

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/logging.rs`
- **当前状态**: 35行 Stub
- **依赖命令**: `commands/logging.rs`
- **优先级**: 🔴 **高** - 调试和监控基础

#### 🎯 功能需求

##### 数据模型
```rust
pub struct LogDatabase {
    pool: DbPool,
}

pub struct LogFilter {
    pub level: Option<String>,        // DEBUG, INFO, WARN, ERROR
    pub target: Option<String>,       // 日志来源模块
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub keyword: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

pub struct LogStatistics {
    pub total_logs: i64,
    pub by_level: HashMap<String, i64>,   // 按级别统计
    pub by_target: HashMap<String, i64>,  // 按模块统计
    pub error_count_24h: i64,             // 24小时内错误数
}
```

#### 🗄️ 数据库表设计

```sql
CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,           -- DEBUG, INFO, WARN, ERROR, CRITICAL
    target VARCHAR(100) NOT NULL,         -- 日志来源模块
    message TEXT NOT NULL,
    file VARCHAR(255),                    -- 源文件
    line INTEGER,                         -- 行号
    thread VARCHAR(100),                  -- 线程名
    metadata JSONB,                       -- 额外元数据
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 索引
    INDEX idx_logs_level (level),
    INDEX idx_logs_target (target),
    INDEX idx_logs_timestamp (timestamp DESC),
    INDEX idx_logs_level_timestamp (level, timestamp DESC)
);

-- 分区表（可选，用于大量日志）
-- CREATE TABLE logs_2025_10 PARTITION OF logs
--     FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

#### 🔧 需要实现的函数

```rust
impl LogDatabase {
    pub fn new(pool: DbPool) -> Self;
    pub async fn init_tables(&self) -> Result<()>;
    
    // 日志写入
    pub async fn write_log(
        &self,
        level: &str,
        target: &str,
        message: &str,
        file: Option<&str>,
        line: Option<u32>,
        metadata: Option<serde_json::Value>,
    ) -> Result<()>;
    
    pub async fn write_logs_batch(&self, logs: Vec<LogEntry>) -> Result<()>;
    
    // 日志查询
    pub async fn query_logs(&self, filter: &LogFilter) -> Result<Vec<LogEntry>>;
    pub async fn get_log_by_id(&self, id: i64) -> Result<Option<LogEntry>>;
    
    // 日志统计
    pub async fn get_log_statistics(&self, hours: Option<i32>) -> Result<LogStatistics>;
    
    // 日志清理
    pub async fn cleanup_old_logs(&self, days: i32) -> Result<i64>;
    pub async fn clear_all_logs(&self) -> Result<i64>;
}
```

#### 📝 实现要点

1. **批量写入优化**
   - 支持批量插入减少IO
   - 异步写入避免阻塞

2. **高效查询**
   - 时间范围索引
   - 级别过滤优化

3. **自动清理**
   - 定期清理旧日志
   - 分区表支持（可选）

4. **日志级别映射**
   ```rust
   DEBUG -> 1
   INFO  -> 2
   WARN  -> 3
   ERROR -> 4
   CRITICAL -> 5
   ```

---

### 3. encrypted_storage.rs - 加密存储

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/encrypted_storage.rs`
- **当前状态**: 81行 Stub
- **依赖命令**: `commands/encryption.rs`
- **优先级**: 🔴 **高** - 安全性核心

#### 🎯 功能需求

##### 数据模型
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EncryptedFieldType {
    ApiKey,        // API密钥
    Password,      // 密码
    Token,         // 访问令牌
    Secret,        // 通用密钥
    Certificate,   // 证书
    PrivateKey,    // 私钥
}

pub struct EncryptedStorage {
    pool: DbPool,
    master_key: Vec<u8>,  // 主密钥（从密钥管理器获取）
}

pub struct EncryptedField {
    pub id: String,
    pub field_type: EncryptedFieldType,
    pub key: String,              // 字段标识符
    pub encrypted_value: Vec<u8>, // 加密后的数据
    pub iv: Vec<u8>,              // 初始化向量
    pub created_at: String,
    pub updated_at: String,
    pub accessed_at: String,
    pub metadata: Option<serde_json::Value>,
}
```

#### 🗄️ 数据库表设计

```sql
CREATE TABLE encrypted_data (
    id VARCHAR(36) PRIMARY KEY,
    field_type VARCHAR(50) NOT NULL,      -- ApiKey, Password, Token等
    key VARCHAR(255) NOT NULL UNIQUE,     -- 字段标识符（如 'openai_api_key'）
    encrypted_value BYTEA NOT NULL,       -- 加密数据
    iv BYTEA NOT NULL,                    -- AES-GCM初始化向量
    tag BYTEA,                            -- 认证标签（AES-GCM）
    metadata JSONB,                       -- 额外元数据
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 索引
    INDEX idx_encrypted_data_field_type (field_type),
    INDEX idx_encrypted_data_key (key)
);
```

#### 🔧 需要实现的函数

```rust
impl EncryptedStorage {
    pub async fn new(pool: DbPool, master_key: Vec<u8>) -> Result<Self>;
    pub async fn init_tables(&self) -> Result<()>;
    
    // 加密存储
    pub async fn store(
        &self,
        key: &str,
        value: &[u8],
        field_type: EncryptedFieldType,
        metadata: Option<serde_json::Value>,
    ) -> Result<()>;
    
    pub async fn store_string(
        &self,
        key: &str,
        value: &str,
        field_type: EncryptedFieldType,
    ) -> Result<()>;
    
    // 解密读取
    pub async fn retrieve(&self, key: &str) -> Result<Option<Vec<u8>>>;
    pub async fn retrieve_string(&self, key: &str) -> Result<Option<String>>;
    
    // 更新和删除
    pub async fn update(
        &self,
        key: &str,
        value: &[u8],
    ) -> Result<()>;
    
    pub async fn delete(&self, key: &str) -> Result<()>;
    
    // 列表和查询
    pub async fn list_keys(&self, field_type: Option<EncryptedFieldType>) -> Result<Vec<String>>;
    pub async fn exists(&self, key: &str) -> Result<bool>;
    
    // 密钥轮换
    pub async fn rotate_master_key(&self, new_master_key: Vec<u8>) -> Result<()>;
}
```

#### 📝 实现要点

1. **加密算法**
   - 使用 **AES-256-GCM** 加密
   - 每个字段独立的IV（初始化向量）
   - 认证标签防止篡改

2. **密钥管理**
   - 主密钥不存储在数据库
   - 从系统密钥链/环境变量获取
   - 支持密钥轮换

3. **安全考虑**
   - 记录访问时间（审计）
   - 敏感数据零拷贝
   - 使用后清零内存

4. **依赖库**
   ```toml
   aes-gcm = "0.10"
   rand = "0.8"
   ```

5. **示例加密流程**
   ```rust
   // 1. 生成随机IV
   let iv = generate_random_iv();
   
   // 2. 使用主密钥派生字段密钥
   let field_key = derive_key(master_key, key_id);
   
   // 3. AES-GCM加密
   let (ciphertext, tag) = aes_gcm_encrypt(field_key, iv, plaintext);
   
   // 4. 存储 (ciphertext, iv, tag)
   store_to_db(ciphertext, iv, tag);
   ```

#### 🧪 测试用例

```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_encrypt_decrypt_roundtrip();
    
    #[tokio::test]
    async fn test_key_rotation();
    
    #[tokio::test]
    async fn test_tamper_detection();
    
    #[tokio::test]
    async fn test_multiple_field_types();
}
```

---

## 中优先级模块

### 4. update.rs - 应用更新

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/update.rs`
- **当前状态**: 174行 Stub
- **依赖命令**: `commands/update.rs` (596行)
- **优先级**: 🟡 **中** - 用户体验提升

#### 🎯 功能需求

##### 数据模型
```rust
pub struct UpdateInfo {
    pub version: String,
    pub update_type: Option<UpdateType>,  // Major/Minor/Patch/Hotfix
    pub title: String,
    pub description: String,
    pub changelog: String,
    pub release_notes: String,
    pub release_date: Option<String>,
    pub download_url: Option<String>,
    pub file_size: Option<i64>,
    pub file_hash: Option<String>,
    pub is_mandatory: bool,
    pub is_prerelease: bool,
    pub min_version: Option<String>,
    pub target_platform: Option<String>,
    pub target_arch: Option<String>,
    pub status: UpdateStatus,
    pub download_progress: f64,
    pub install_progress: f64,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub created_at: i64,
}

pub enum UpdateStatus {
    Pending,
    Available,
    Downloading,
    Downloaded,
    Installing,
    Installed,
    Failed,
    Cancelled,
}

pub enum UpdateType {
    Major,    // 1.0.0 -> 2.0.0
    Minor,    // 1.0.0 -> 1.1.0
    Patch,    // 1.0.0 -> 1.0.1
    Hotfix,   // 紧急修复
}

pub struct UpdateConfig {
    pub auto_check: bool,
    pub auto_check_enabled: bool,
    pub check_interval: i64,
    pub check_interval_hours: i64,
    pub auto_download: bool,
    pub auto_install: bool,
    pub backup_before_update: bool,
    pub include_prerelease: bool,
    pub max_backup_count: i32,
    pub last_check_time: Option<DateTime<Utc>>,
}

pub struct VersionHistory {
    pub id: Option<i64>,
    pub version: String,
    pub installed_at: i64,
    pub release_notes: String,
    pub notes: String,
    pub is_rollback: bool,
    pub install_source: String,  // auto/manual
}
```

#### 🗄️ 数据库表设计

##### 1. `update_info` 表
```sql
CREATE TABLE update_info (
    version VARCHAR(50) PRIMARY KEY,
    update_type VARCHAR(20),              -- major, minor, patch, hotfix
    title VARCHAR(255) NOT NULL,
    description TEXT,
    changelog TEXT,
    release_notes TEXT,
    release_date TIMESTAMPTZ,
    download_url TEXT,
    file_size BIGINT,
    file_hash VARCHAR(64),
    is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
    min_version VARCHAR(50),
    target_platform VARCHAR(50),
    target_arch VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    download_progress DOUBLE PRECISION DEFAULT 0,
    install_progress DOUBLE PRECISION DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    INDEX idx_update_info_status (status),
    INDEX idx_update_info_created_at (created_at DESC)
);
```

##### 2. `update_config` 表
```sql
CREATE TABLE update_config (
    id INTEGER PRIMARY KEY DEFAULT 1,     -- 单例配置
    auto_check_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    check_interval_hours INTEGER NOT NULL DEFAULT 24,
    auto_download BOOLEAN NOT NULL DEFAULT FALSE,
    auto_install BOOLEAN NOT NULL DEFAULT FALSE,
    backup_before_update BOOLEAN NOT NULL DEFAULT TRUE,
    include_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
    max_backup_count INTEGER NOT NULL DEFAULT 5,
    last_check_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CHECK (id = 1)  -- 确保只有一行
);
```

##### 3. `version_history` 表
```sql
CREATE TABLE version_history (
    id BIGSERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    release_notes TEXT,
    is_rollback BOOLEAN NOT NULL DEFAULT FALSE,
    install_source VARCHAR(20) NOT NULL,  -- 'auto' or 'manual'
    
    INDEX idx_version_history_installed_at (installed_at DESC)
);
```

#### 🔧 需要实现的函数

```rust
// UpdateRegistry
impl UpdateRegistry {
    pub fn new(pool: DbPool) -> Self;
    pub async fn init_tables(&self) -> Result<()>;
    pub fn check_for_updates(&self) -> Result<Option<UpdateInfo>>;
    pub fn mark_update_installed(&self, version: &str) -> Result<()>;
}

// UpdateDatabase (SQLite兼容层)
impl UpdateDatabase {
    pub fn new(path: &Path) -> Result<Self>;
    
    // 更新信息
    pub fn get_update_info(&self, version: &str) -> Result<Option<UpdateInfo>>;
    pub fn get_update_info_by_version(&self, version: &str) -> Result<Option<UpdateInfo>>;
    pub fn save_update_info(&self, info: &UpdateInfo) -> Result<()>;
    
    // 配置
    pub fn get_or_create_update_config(&self) -> Result<UpdateConfig>;
    pub fn save_update_config(&self, config: &UpdateConfig) -> Result<()>;
    
    // 版本历史
    pub fn get_version_history(&self) -> Result<Vec<VersionHistory>>;
    pub fn save_version_history(&self, history: &VersionHistory) -> Result<()>;
    
    // 统计
    pub fn get_update_stats(&self) -> Result<HashMap<String, i64>>;
}
```

#### 📝 实现要点

1. **版本比较**
   - 使用 `semver` 库
   - 支持 `1.2.3-beta.1` 格式

2. **更新状态机**
   ```
   Pending -> Available -> Downloading -> Downloaded -> Installing -> Installed
                                ↓                         ↓
                             Failed                   Cancelled
   ```

3. **配置单例**
   - `update_config` 表只有一行
   - 使用约束确保

4. **版本历史**
   - 记录所有安装的版本
   - 支持回滚标记

---

### 5. theme.rs - 主题管理

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/theme.rs`
- **当前状态**: 39行 Stub
- **依赖命令**: `commands/theme.rs`
- **优先级**: 🟡 **中** - UI个性化

#### 🗄️ 数据库表设计

```sql
CREATE TABLE themes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    author VARCHAR(100),
    version VARCHAR(20),
    
    -- 颜色配置
    colors JSONB NOT NULL,           -- 颜色方案
    
    -- 主题元数据
    is_dark BOOLEAN NOT NULL DEFAULT FALSE,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- 预览
    thumbnail_url TEXT,
    preview_images TEXT[],           -- 预览图数组
    
    -- 统计
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    INDEX idx_themes_is_active (is_active),
    INDEX idx_themes_usage_count (usage_count DESC)
);
```

#### 🔧 需要实现的函数

```rust
impl ThemeDatabase {
    pub fn new(pool: DbPool) -> Result<Self>;
    pub async fn init_tables(&self) -> Result<()>;
    
    // 主题管理
    pub async fn get_theme(&self, id: &str) -> Result<Option<Theme>>;
    pub async fn save_theme(&self, theme: &Theme) -> Result<()>;
    pub async fn update_theme(&self, theme: &Theme) -> Result<()>;
    pub async fn delete_theme(&self, id: &str) -> Result<()>;
    pub async fn list_themes(&self) -> Result<Vec<Theme>>;
    
    // 激活主题
    pub async fn get_active_theme(&self) -> Result<Option<Theme>>;
    pub async fn set_active_theme(&self, id: &str) -> Result<()>;
    
    // 统计
    pub async fn get_theme_statistics(&self) -> Result<ThemeStatistics>;
    pub async fn increment_usage(&self, id: &str) -> Result<()>;
}
```

---

## 低优先级模块

### 6. region.rs - 区域设置

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/region.rs`
- **当前状态**: 145行 Stub
- **优先级**: 🟢 **低** - 国际化支持

#### 🗄️ 数据库表设计

```sql
CREATE TABLE region_preferences (
    id INTEGER PRIMARY KEY DEFAULT 1,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    region VARCHAR(10) NOT NULL DEFAULT 'US',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    date_format VARCHAR(50),
    time_format VARCHAR(50),
    number_format VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CHECK (id = 1)
);

CREATE TABLE region_configs (
    id VARCHAR(10) PRIMARY KEY,          -- 'en_US', 'zh_CN'等
    name VARCHAR(100) NOT NULL,
    local_name VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL,
    country VARCHAR(10) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    date_format VARCHAR(50) NOT NULL,
    time_format VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    INDEX idx_region_configs_language (language)
);
```

---

### 7. privacy.rs - 隐私设置

#### 📌 模块信息
- **路径**: `desktop_app/src-tauri/src/database/privacy.rs`
- **当前状态**: 38行 Stub
- **优先级**: 🟢 **低** - 隐私控制

#### 🗄️ 数据库表设计

```sql
CREATE TABLE privacy_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- 数据收集
    analytics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    crash_reporting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    usage_statistics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- 隐私保护
    anonymize_logs BOOLEAN NOT NULL DEFAULT TRUE,
    clear_on_exit BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- 网络隐私
    dns_over_https BOOLEAN NOT NULL DEFAULT FALSE,
    proxy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    proxy_url TEXT,
    
    -- 元数据
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CHECK (id = 1)
);
```

---

## 实施时间表

### 第一阶段：核心业务功能（2-3天）

| 模块 | 预计工时 | 完成标准 |
|------|---------|---------|
| **file.rs** | 6-8小时 | 14个函数全部实现，单元测试通过 |
| **logging.rs** | 3-4小时 | 日志写入/查询/统计功能完整 |
| **encrypted_storage.rs** | 4-5小时 | AES-GCM加密/解密正常工作 |

**验收标准**：
- ✅ 所有单元测试通过
- ✅ 与commands层集成测试通过
- ✅ 性能测试达标（file.rs批量操作<100ms）

---

### 第二阶段：用户体验功能（1-2天）

| 模块 | 预计工时 | 完成标准 |
|------|---------|---------|
| **update.rs** | 5-6小时 | 更新检查/下载/安装流程完整 |
| **theme.rs** | 3-4小时 | 主题切换和管理功能正常 |

**验收标准**：
- ✅ 自动更新流程测试通过
- ✅ 主题切换无闪烁

---

### 第三阶段：辅助功能（1天，可选）

| 模块 | 预计工时 | 完成标准 |
|------|---------|---------|
| **region.rs** | 3-4小时 | 多语言切换正常 |
| **privacy.rs** | 2-3小时 | 隐私设置持久化 |

---

## 📊 进度追踪

```
总进度: 6/13 模块完成 (46%)

已完成 ✅:
├── adapter.rs
├── character_registry.rs
├── model_config.rs
├── workflow.rs
├── permission.rs
└── performance.rs

待实现 🔲:
├── 🔴 file.rs (高优先级)
├── 🔴 logging.rs (高优先级)
├── 🔴 encrypted_storage.rs (高优先级)
├── 🟡 update.rs (中优先级)
├── 🟡 theme.rs (中优先级)
├── 🟢 region.rs (低优先级)
└── 🟢 privacy.rs (低优先级)
```

---

## 📚 参考资料

### 数据库连接
- 使用 `crate::database::get_database()` 获取连接池
- 参考已实现模块的连接方式

### 加密库
```toml
[dependencies]
aes-gcm = "0.10"
rand = "0.8"
sha2 = "0.10"
```

### 测试工具
```bash
# 运行特定模块测试
cargo test --package zishu-sensei-desktop --lib database::file::tests

# 运行所有数据库测试
cargo test --package zishu-sensei-desktop --lib database
```

---

## ✅ 验收清单

### 每个模块必须满足：

- [ ] 所有表结构创建成功
- [ ] 所有索引正确建立
- [ ] 所有函数实现完整
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 文档注释完整
- [ ] 错误处理健壮
- [ ] 日志记录完善

---

## 🎯 总结

**已完成**: 6个核心模块（适配器、角色、模型配置、工作流、权限、性能）

**待实现**: 7个模块
- **高优先级（3个）**: file.rs, logging.rs, encrypted_storage.rs - 核心业务功能
- **中优先级（2个）**: update.rs, theme.rs - 用户体验提升
- **低优先级（2个）**: region.rs, privacy.rs - 辅助功能

**总工时估算**: 26-34小时（约4-5个工作日）

**建议顺序**:
1. file.rs → logging.rs → encrypted_storage.rs（3天）
2. update.rs → theme.rs（2天）
3. region.rs → privacy.rs（1天，可选）

---

**最后更新**: 2025-10-22
**维护者**: Zishu Sensei Development Team


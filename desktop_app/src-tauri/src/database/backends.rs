//! 数据库后端抽象接口
//!
//! 提供统一的数据库接口，支持多种数据库后端

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::fmt;

// ================================
// 错误类型定义
// ================================

/// 数据库错误
#[derive(Debug)]
pub enum DatabaseError {
    /// 连接错误
    ConnectionError(String),
    /// 查询错误
    QueryError(String),
    /// 数据不存在
    NotFound(String),
    /// 重复数据
    Duplicate(String),
    /// 无效数据
    InvalidData(String),
    /// 序列化错误
    SerializationError(String),
    /// 其他错误
    Other(String),
}

impl fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ConnectionError(msg) => write!(f, "连接错误: {}", msg),
            Self::QueryError(msg) => write!(f, "查询错误: {}", msg),
            Self::NotFound(msg) => write!(f, "数据不存在: {}", msg),
            Self::Duplicate(msg) => write!(f, "重复数据: {}", msg),
            Self::InvalidData(msg) => write!(f, "无效数据: {}", msg),
            Self::SerializationError(msg) => write!(f, "序列化错误: {}", msg),
            Self::Other(msg) => write!(f, "错误: {}", msg),
        }
    }
}

impl Error for DatabaseError {}

impl From<serde_json::Error> for DatabaseError {
    fn from(err: serde_json::Error) -> Self {
        Self::SerializationError(err.to_string())
    }
}

pub type DatabaseResult<T> = Result<T, DatabaseError>;

// ================================
// 数据库后端类型
// ================================

/// 数据库后端类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatabaseBackendType {
    /// SQLite
    SQLite,
    /// PostgreSQL
    PostgreSQL,
    /// Redis
    Redis,
    /// Qdrant (向量数据库)
    Qdrant,
}

impl fmt::Display for DatabaseBackendType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SQLite => write!(f, "SQLite"),
            Self::PostgreSQL => write!(f, "PostgreSQL"),
            Self::Redis => write!(f, "Redis"),
            Self::Qdrant => write!(f, "Qdrant"),
        }
    }
}

// ================================
// 查询条件
// ================================

/// 查询操作符
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryOperator {
    /// 等于
    Eq,
    /// 不等于
    Ne,
    /// 大于
    Gt,
    /// 大于等于
    Gte,
    /// 小于
    Lt,
    /// 小于等于
    Lte,
    /// 包含
    In,
    /// 不包含
    NotIn,
    /// 正则匹配
    Regex,
    /// 存在
    Exists,
}

/// 查询条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryCondition {
    /// 字段名
    pub field: String,
    /// 操作符
    pub operator: QueryOperator,
    /// 值
    pub value: serde_json::Value,
}

/// 查询参数
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QueryOptions {
    /// 条件
    pub conditions: Vec<QueryCondition>,
    /// 限制数量
    pub limit: Option<usize>,
    /// 偏移量
    pub offset: Option<usize>,
    /// 排序字段
    pub order_by: Option<Vec<(String, bool)>>, // (field, ascending)
}

// ================================
// 数据库连接配置
// ================================

/// 数据库连接配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// 后端类型
    pub backend_type: DatabaseBackendType,
    /// 连接字符串或路径
    pub connection_string: String,
    /// 最大连接数
    pub max_connections: Option<usize>,
    /// 连接超时（秒）
    pub timeout: Option<u64>,
    /// 额外配置
    pub extra: HashMap<String, serde_json::Value>,
}

impl DatabaseConfig {
    /// 创建SQLite配置
    pub fn sqlite(path: &str) -> Self {
        Self {
            backend_type: DatabaseBackendType::SQLite,
            connection_string: path.to_string(),
            max_connections: Some(5),
            timeout: Some(30),
            extra: HashMap::new(),
        }
    }

    /// 创建PostgreSQL配置
    pub fn postgresql(connection_string: &str) -> Self {
        Self {
            backend_type: DatabaseBackendType::PostgreSQL,
            connection_string: connection_string.to_string(),
            max_connections: Some(10),
            timeout: Some(30),
            extra: HashMap::new(),
        }
    }

    /// 创建Redis配置
    pub fn redis(connection_string: &str) -> Self {
        Self {
            backend_type: DatabaseBackendType::Redis,
            connection_string: connection_string.to_string(),
            max_connections: Some(10),
            timeout: Some(30),
            extra: HashMap::new(),
        }
    }

    /// 创建Qdrant配置
    pub fn qdrant(url: &str) -> Self {
        Self {
            backend_type: DatabaseBackendType::Qdrant,
            connection_string: url.to_string(),
            max_connections: Some(5),
            timeout: Some(30),
            extra: HashMap::new(),
        }
    }
}

// ================================
// 数据库后端接口
// ================================

/// 数据库后端接口
#[async_trait]
pub trait DatabaseBackend: Send + Sync {
    /// 获取后端类型
    fn backend_type(&self) -> DatabaseBackendType;

    /// 连接数据库
    async fn connect(&mut self, config: &DatabaseConfig) -> DatabaseResult<()>;

    /// 断开连接
    async fn disconnect(&mut self) -> DatabaseResult<()>;

    /// 检查是否已连接
    fn is_connected(&self) -> bool;

    /// 创建集合/表
    async fn create_collection(&self, name: &str, schema: Option<&str>) -> DatabaseResult<()>;

    /// 删除集合/表
    async fn drop_collection(&self, name: &str) -> DatabaseResult<()>;

    /// 检查集合/表是否存在
    async fn collection_exists(&self, name: &str) -> DatabaseResult<bool>;

    /// 插入数据
    async fn insert(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()>;

    /// 批量插入
    async fn batch_insert(
        &self,
        collection: &str,
        items: Vec<(String, serde_json::Value)>,
    ) -> DatabaseResult<()>;

    /// 获取数据
    async fn get(
        &self,
        collection: &str,
        key: &str,
    ) -> DatabaseResult<Option<serde_json::Value>>;

    /// 更新数据
    async fn update(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()>;

    /// 删除数据
    async fn delete(&self, collection: &str, key: &str) -> DatabaseResult<()>;

    /// 查询数据
    async fn query(
        &self,
        collection: &str,
        options: &QueryOptions,
    ) -> DatabaseResult<Vec<(String, serde_json::Value)>>;

    /// 统计数量
    async fn count(&self, collection: &str, options: Option<&QueryOptions>) -> DatabaseResult<usize>;

    /// 清空集合
    async fn clear_collection(&self, collection: &str) -> DatabaseResult<()>;

    /// 执行原始查询
    async fn execute_raw(&self, query: &str) -> DatabaseResult<serde_json::Value>;

    /// 开始事务
    async fn begin_transaction(&self) -> DatabaseResult<Box<dyn DatabaseTransaction>>;
}

/// 数据库事务接口
#[async_trait]
pub trait DatabaseTransaction: Send + Sync {
    /// 提交事务
    async fn commit(&mut self) -> DatabaseResult<()>;

    /// 回滚事务
    async fn rollback(&mut self) -> DatabaseResult<()>;

    /// 在事务中插入数据
    async fn insert(
        &mut self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()>;

    /// 在事务中更新数据
    async fn update(
        &mut self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()>;

    /// 在事务中删除数据
    async fn delete(&mut self, collection: &str, key: &str) -> DatabaseResult<()>;
}

// ================================
// 向量搜索接口（用于 Qdrant）
// ================================

/// 向量搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchResult {
    /// ID
    pub id: String,
    /// 相似度分数
    pub score: f32,
    /// 数据
    pub payload: serde_json::Value,
}

/// 向量数据库接口
#[async_trait]
pub trait VectorDatabaseBackend: DatabaseBackend {
    /// 插入向量
    async fn insert_vector(
        &self,
        collection: &str,
        id: &str,
        vector: Vec<f32>,
        payload: &serde_json::Value,
    ) -> DatabaseResult<()>;

    /// 批量插入向量
    async fn batch_insert_vectors(
        &self,
        collection: &str,
        items: Vec<(String, Vec<f32>, serde_json::Value)>,
    ) -> DatabaseResult<()>;

    /// 向量搜索
    async fn vector_search(
        &self,
        collection: &str,
        query_vector: Vec<f32>,
        limit: usize,
        filter: Option<&QueryOptions>,
    ) -> DatabaseResult<Vec<VectorSearchResult>>;

    /// 删除向量
    async fn delete_vector(&self, collection: &str, id: &str) -> DatabaseResult<()>;
}

// ================================
// 缓存接口（用于 Redis）
// ================================

/// 缓存数据库接口
#[async_trait]
pub trait CacheDatabaseBackend: DatabaseBackend {
    /// 设置缓存（带过期时间）
    async fn set_with_expiry(
        &self,
        key: &str,
        value: &serde_json::Value,
        ttl_seconds: u64,
    ) -> DatabaseResult<()>;

    /// 获取缓存
    async fn get_cache(&self, key: &str) -> DatabaseResult<Option<serde_json::Value>>;

    /// 删除缓存
    async fn delete_cache(&self, key: &str) -> DatabaseResult<()>;

    /// 检查缓存是否存在
    async fn exists(&self, key: &str) -> DatabaseResult<bool>;

    /// 设置过期时间
    async fn expire(&self, key: &str, ttl_seconds: u64) -> DatabaseResult<()>;

    /// 获取剩余过期时间
    async fn ttl(&self, key: &str) -> DatabaseResult<Option<i64>>;

    /// 增加计数器
    async fn increment(&self, key: &str, delta: i64) -> DatabaseResult<i64>;

    /// 减少计数器
    async fn decrement(&self, key: &str, delta: i64) -> DatabaseResult<i64>;
}


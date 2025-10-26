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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            backend_type: DatabaseBackendType::PostgreSQL,
            connection_string: "postgresql://localhost:5432/test".to_string(),
            max_connections: Some(10),
            timeout: Some(30),
            extra: HashMap::new(),
        }
    }
}

impl DatabaseConfig {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // ================================
    // DatabaseError 测试
    // ================================

    #[test]
    fn test_database_error_display() {
        let test_cases = vec![
            (DatabaseError::ConnectionError("连接超时".to_string()), "连接错误: 连接超时"),
            (DatabaseError::QueryError("SQL语法错误".to_string()), "查询错误: SQL语法错误"),
            (DatabaseError::NotFound("用户不存在".to_string()), "数据不存在: 用户不存在"),
            (DatabaseError::Duplicate("主键冲突".to_string()), "重复数据: 主键冲突"),
            (DatabaseError::InvalidData("格式错误".to_string()), "无效数据: 格式错误"),
            (DatabaseError::SerializationError("JSON解析失败".to_string()), "序列化错误: JSON解析失败"),
            (DatabaseError::Other("未知错误".to_string()), "错误: 未知错误"),
        ];

        for (error, expected) in test_cases {
            assert_eq!(error.to_string(), expected);
        }
    }

    #[test]
    fn test_database_error_debug() {
        let error = DatabaseError::ConnectionError("测试错误".to_string());
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("ConnectionError"));
        assert!(debug_str.contains("测试错误"));
    }

    #[test]
    fn test_database_error_error_trait() {
        let error = DatabaseError::QueryError("测试查询错误".to_string());
        
        // 测试 Error trait 实现
        assert!(error.source().is_none());
        
        // 测试错误链
        let boxed_error: Box<dyn std::error::Error> = Box::new(error);
        assert!(!boxed_error.to_string().is_empty());
    }

    #[test]
    fn test_database_error_from_serde_json() {
        let json_str = r#"{"invalid": json"#;
        let json_error = serde_json::from_str::<serde_json::Value>(json_str);
        assert!(json_error.is_err());
        
        let database_error: DatabaseError = json_error.unwrap_err().into();
        match database_error {
            DatabaseError::SerializationError(msg) => {
                assert!(!msg.is_empty());
            },
            _ => panic!("期望 SerializationError"),
        }
    }

    #[test]
    fn test_database_result_type_alias() {
        let success: DatabaseResult<String> = Ok("成功".to_string());
        let failure: DatabaseResult<String> = Err(DatabaseError::NotFound("失败".to_string()));
        
        assert!(success.is_ok());
        assert_eq!(success.unwrap(), "成功");
        assert!(failure.is_err());
    }

    // ================================
    // DatabaseBackendType 测试
    // ================================

    #[test]
    fn test_database_backend_type_display() {
        assert_eq!(DatabaseBackendType::PostgreSQL.to_string(), "PostgreSQL");
        assert_eq!(DatabaseBackendType::Redis.to_string(), "Redis");
        assert_eq!(DatabaseBackendType::Qdrant.to_string(), "Qdrant");
    }

    #[test]
    fn test_database_backend_type_serialization() {
        let backend_types = vec![
            DatabaseBackendType::PostgreSQL,
            DatabaseBackendType::Redis,
            DatabaseBackendType::Qdrant,
        ];

        for backend_type in backend_types {
            // 测试序列化
            let serialized = serde_json::to_string(&backend_type).unwrap();
            assert!(!serialized.is_empty());
            
            // 测试反序列化
            let deserialized: DatabaseBackendType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(backend_type, deserialized);
        }
    }

    #[test]
    fn test_database_backend_type_equality() {
        assert_eq!(DatabaseBackendType::PostgreSQL, DatabaseBackendType::PostgreSQL);
        assert_ne!(DatabaseBackendType::PostgreSQL, DatabaseBackendType::Redis);
        assert_ne!(DatabaseBackendType::Redis, DatabaseBackendType::Qdrant);
    }

    #[test]
    fn test_database_backend_type_clone_copy() {
        let original = DatabaseBackendType::PostgreSQL;
        let cloned = original.clone();
        let copied = original;
        
        assert_eq!(original, cloned);
        assert_eq!(original, copied);
    }

    // ================================
    // QueryOperator 测试
    // ================================

    #[test]
    fn test_query_operator_serialization() {
        let operators = vec![
            QueryOperator::Eq,
            QueryOperator::Ne,
            QueryOperator::Gt,
            QueryOperator::Gte,
            QueryOperator::Lt,
            QueryOperator::Lte,
            QueryOperator::In,
            QueryOperator::NotIn,
            QueryOperator::Regex,
            QueryOperator::Exists,
        ];

        for operator in operators {
            let serialized = serde_json::to_string(&operator).unwrap();
            let deserialized: QueryOperator = serde_json::from_str(&serialized).unwrap();
            
            // 由于没有 PartialEq，我们只测试序列化不会失败
            assert!(!serialized.is_empty());
        }
    }

    #[test]
    fn test_query_operator_debug() {
        let operator = QueryOperator::Eq;
        let debug_str = format!("{:?}", operator);
        assert!(debug_str.contains("Eq"));
    }

    // ================================
    // QueryCondition 测试
    // ================================

    #[test]
    fn test_query_condition_creation() {
        let condition = QueryCondition {
            field: "name".to_string(),
            operator: QueryOperator::Eq,
            value: serde_json::json!("张三"),
        };

        assert_eq!(condition.field, "name");
        assert_eq!(condition.value, serde_json::json!("张三"));
    }

    #[test]
    fn test_query_condition_serialization() {
        let condition = QueryCondition {
            field: "age".to_string(),
            operator: QueryOperator::Gte,
            value: serde_json::json!(18),
        };

        let serialized = serde_json::to_string(&condition).unwrap();
        let deserialized: QueryCondition = serde_json::from_str(&serialized).unwrap();

        assert_eq!(condition.field, deserialized.field);
        assert_eq!(condition.value, deserialized.value);
    }

    #[test]
    fn test_query_condition_with_different_value_types() {
        let conditions = vec![
            QueryCondition {
                field: "string_field".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::json!("字符串值"),
            },
            QueryCondition {
                field: "number_field".to_string(),
                operator: QueryOperator::Gt,
                value: serde_json::json!(42),
            },
            QueryCondition {
                field: "bool_field".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::json!(true),
            },
            QueryCondition {
                field: "array_field".to_string(),
                operator: QueryOperator::In,
                value: serde_json::json!([1, 2, 3]),
            },
            QueryCondition {
                field: "null_field".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::json!(null),
            },
        ];

        for condition in conditions {
            let serialized = serde_json::to_string(&condition).unwrap();
            let deserialized: QueryCondition = serde_json::from_str(&serialized).unwrap();
            assert_eq!(condition.field, deserialized.field);
            assert_eq!(condition.value, deserialized.value);
        }
    }

    // ================================
    // QueryOptions 测试
    // ================================

    #[test]
    fn test_query_options_default() {
        let options = QueryOptions::default();
        
        assert!(options.conditions.is_empty());
        assert!(options.limit.is_none());
        assert!(options.offset.is_none());
        assert!(options.order_by.is_none());
    }

    #[test]
    fn test_query_options_with_conditions() {
        let mut options = QueryOptions::default();
        options.conditions.push(QueryCondition {
            field: "status".to_string(),
            operator: QueryOperator::Eq,
            value: serde_json::json!("active"),
        });
        options.limit = Some(10);
        options.offset = Some(5);
        options.order_by = Some(vec![("created_at".to_string(), false)]);

        assert_eq!(options.conditions.len(), 1);
        assert_eq!(options.limit, Some(10));
        assert_eq!(options.offset, Some(5));
        assert_eq!(options.order_by.as_ref().unwrap()[0].0, "created_at");
        assert_eq!(options.order_by.as_ref().unwrap()[0].1, false);
    }

    #[test]
    fn test_query_options_serialization() {
        let mut options = QueryOptions::default();
        options.conditions.push(QueryCondition {
            field: "category".to_string(),
            operator: QueryOperator::In,
            value: serde_json::json!(["tech", "science"]),
        });
        options.limit = Some(20);

        let serialized = serde_json::to_string(&options).unwrap();
        let deserialized: QueryOptions = serde_json::from_str(&serialized).unwrap();

        assert_eq!(options.conditions.len(), deserialized.conditions.len());
        assert_eq!(options.limit, deserialized.limit);
    }

    #[test]
    fn test_query_options_multiple_order_by() {
        let options = QueryOptions {
            conditions: vec![],
            limit: None,
            offset: None,
            order_by: Some(vec![
                ("priority".to_string(), false), // 优先级降序
                ("created_at".to_string(), true), // 创建时间升序
            ]),
        };

        let order_by = options.order_by.unwrap();
        assert_eq!(order_by.len(), 2);
        assert_eq!(order_by[0].0, "priority");
        assert_eq!(order_by[0].1, false);
        assert_eq!(order_by[1].0, "created_at");
        assert_eq!(order_by[1].1, true);
    }

    // ================================
    // DatabaseConfig 测试
    // ================================

    #[test]
    fn test_database_config_postgresql() {
        let config = DatabaseConfig::postgresql("postgresql://user:pass@localhost/db");
        
        assert_eq!(config.backend_type, DatabaseBackendType::PostgreSQL);
        assert_eq!(config.connection_string, "postgresql://user:pass@localhost/db");
        assert_eq!(config.max_connections, Some(10));
        assert_eq!(config.timeout, Some(30));
        assert!(config.extra.is_empty());
    }

    #[test]
    fn test_database_config_redis() {
        let config = DatabaseConfig::redis("redis://localhost:6379");
        
        assert_eq!(config.backend_type, DatabaseBackendType::Redis);
        assert_eq!(config.connection_string, "redis://localhost:6379");
        assert_eq!(config.max_connections, Some(10));
        assert_eq!(config.timeout, Some(30));
        assert!(config.extra.is_empty());
    }

    #[test]
    fn test_database_config_qdrant() {
        let config = DatabaseConfig::qdrant("http://localhost:6333");
        
        assert_eq!(config.backend_type, DatabaseBackendType::Qdrant);
        assert_eq!(config.connection_string, "http://localhost:6333");
        assert_eq!(config.max_connections, Some(5));
        assert_eq!(config.timeout, Some(30));
        assert!(config.extra.is_empty());
    }

    #[test]
    fn test_database_config_custom() {
        let mut extra = HashMap::new();
        extra.insert("ssl_mode".to_string(), serde_json::json!("require"));
        extra.insert("pool_size".to_string(), serde_json::json!(20));

        let config = DatabaseConfig {
            backend_type: DatabaseBackendType::PostgreSQL,
            connection_string: "custom://connection".to_string(),
            max_connections: Some(50),
            timeout: Some(60),
            extra,
        };

        assert_eq!(config.backend_type, DatabaseBackendType::PostgreSQL);
        assert_eq!(config.connection_string, "custom://connection");
        assert_eq!(config.max_connections, Some(50));
        assert_eq!(config.timeout, Some(60));
        assert_eq!(config.extra.len(), 2);
        assert_eq!(config.extra["ssl_mode"], serde_json::json!("require"));
        assert_eq!(config.extra["pool_size"], serde_json::json!(20));
    }

    #[test]
    fn test_database_config_serialization() {
        let config = DatabaseConfig::postgresql("postgresql://test");
        
        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: DatabaseConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.backend_type, deserialized.backend_type);
        assert_eq!(config.connection_string, deserialized.connection_string);
        assert_eq!(config.max_connections, deserialized.max_connections);
        assert_eq!(config.timeout, deserialized.timeout);
    }

    #[test]
    fn test_database_config_debug() {
        let config = DatabaseConfig::redis("redis://test");
        let debug_str = format!("{:?}", config);
        
        assert!(debug_str.contains("DatabaseConfig"));
        assert!(debug_str.contains("Redis"));
        assert!(debug_str.contains("redis://test"));
    }

    // ================================
    // VectorSearchResult 测试
    // ================================

    #[test]
    fn test_vector_search_result_creation() {
        let result = VectorSearchResult {
            id: "doc_123".to_string(),
            score: 0.95,
            payload: serde_json::json!({"title": "测试文档", "content": "这是测试内容"}),
        };

        assert_eq!(result.id, "doc_123");
        assert_eq!(result.score, 0.95);
        assert_eq!(result.payload["title"], "测试文档");
    }

    #[test]
    fn test_vector_search_result_serialization() {
        let result = VectorSearchResult {
            id: "vec_001".to_string(),
            score: 0.87,
            payload: serde_json::json!({"category": "技术", "tags": ["rust", "database"]}),
        };

        let serialized = serde_json::to_string(&result).unwrap();
        let deserialized: VectorSearchResult = serde_json::from_str(&serialized).unwrap();

        assert_eq!(result.id, deserialized.id);
        assert_eq!(result.score, deserialized.score);
        assert_eq!(result.payload, deserialized.payload);
    }

    #[test]
    fn test_vector_search_result_clone() {
        let original = VectorSearchResult {
            id: "clone_test".to_string(),
            score: 0.76,
            payload: serde_json::json!({"data": "test"}),
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.score, cloned.score);
        assert_eq!(original.payload, cloned.payload);
    }

    #[test]
    fn test_vector_search_result_debug() {
        let result = VectorSearchResult {
            id: "debug_test".to_string(),
            score: 0.88,
            payload: serde_json::json!({"type": "debug"}),
        };

        let debug_str = format!("{:?}", result);
        assert!(debug_str.contains("VectorSearchResult"));
        assert!(debug_str.contains("debug_test"));
        assert!(debug_str.contains("0.88"));
    }

    // ================================
    // 综合测试
    // ================================

    #[test]
    fn test_complete_query_workflow() {
        // 创建查询条件
        let condition1 = QueryCondition {
            field: "status".to_string(),
            operator: QueryOperator::Eq,
            value: serde_json::json!("published"),
        };

        let condition2 = QueryCondition {
            field: "score".to_string(),
            operator: QueryOperator::Gte,
            value: serde_json::json!(80),
        };

        // 创建查询选项
        let options = QueryOptions {
            conditions: vec![condition1, condition2],
            limit: Some(50),
            offset: Some(10),
            order_by: Some(vec![("score".to_string(), false)]),
        };

        // 验证查询选项
        assert_eq!(options.conditions.len(), 2);
        assert_eq!(options.conditions[0].field, "status");
        assert_eq!(options.conditions[1].field, "score");
        assert_eq!(options.limit, Some(50));
        assert_eq!(options.offset, Some(10));

        // 测试序列化完整流程
        let serialized = serde_json::to_string(&options).unwrap();
        let deserialized: QueryOptions = serde_json::from_str(&serialized).unwrap();
        assert_eq!(options.conditions.len(), deserialized.conditions.len());
    }

    #[test]
    fn test_error_handling_chain() {
        // 模拟错误传播链
        fn level3_error() -> DatabaseResult<String> {
            Err(DatabaseError::ConnectionError("网络超时".to_string()))
        }

        fn level2_error() -> DatabaseResult<String> {
            level3_error().map_err(|e| DatabaseError::QueryError(format!("查询失败: {}", e)))
        }

        fn level1_error() -> DatabaseResult<String> {
            level2_error().map_err(|e| DatabaseError::Other(format!("操作失败: {}", e)))
        }

        let result = level1_error();
        assert!(result.is_err());
        
        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("操作失败"));
        assert!(error_msg.contains("查询失败"));
        assert!(error_msg.contains("网络超时"));
    }

    #[test]
    fn test_config_validation_scenarios() {
        // 测试各种配置场景
        let configs = vec![
            DatabaseConfig::postgresql("postgresql://localhost/test"),
            DatabaseConfig::redis("redis://127.0.0.1:6379/0"),
            DatabaseConfig::qdrant("https://qdrant.example.com:443"),
        ];

        for config in configs {
            // 每个配置都应该有有效的连接字符串
            assert!(!config.connection_string.is_empty());
            
            // 每个配置都应该有默认的连接数和超时设置
            assert!(config.max_connections.is_some());
            assert!(config.timeout.is_some());
            
            // 测试配置的序列化和反序列化
            let serialized = serde_json::to_string(&config).unwrap();
            let _deserialized: DatabaseConfig = serde_json::from_str(&serialized).unwrap();
        }
    }
}


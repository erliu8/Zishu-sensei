//! PostgreSQL后端单元测试

use zishu_sensei_desktop::database::{
    backends::*,
    postgres_backend::PostgresBackend,
};
use serde_json::json;

// ================================
// 基础测试
// ================================

#[tokio::test]
async fn test_postgres_backend_creation() {
    let backend = PostgresBackend::new();
    assert_eq!(backend.backend_type(), DatabaseBackendType::PostgreSQL);
    assert!(!backend.is_connected());
}

// ================================
// 连接测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_connect_success() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    let result = backend.connect(&config).await;
    assert!(result.is_ok(), "连接应该成功");
    assert!(backend.is_connected());
    
    backend.disconnect().await.unwrap();
    assert!(!backend.is_connected());
}

#[tokio::test]
async fn test_postgres_connect_invalid_url() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig {
        backend_type: DatabaseBackendType::PostgreSQL,
        connection_string: "invalid_url".to_string(),
        max_connections: Some(5),
        timeout: Some(30),
        extra: Default::default(),
    };
    
    let result = backend.connect(&config).await;
    assert!(result.is_err(), "连接应该失败");
    assert!(!backend.is_connected());
}

// ================================
// 集合操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_create_and_drop_collection() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    // 创建集合
    let collection_name = "test_collection";
    let result = backend.create_collection(collection_name, None).await;
    assert!(result.is_ok(), "创建集合应该成功");
    
    // 检查集合是否存在
    let exists = backend.collection_exists(collection_name).await.unwrap();
    assert!(exists, "集合应该存在");
    
    // 删除集合
    let result = backend.drop_collection(collection_name).await;
    assert!(result.is_ok(), "删除集合应该成功");
    
    // 检查集合是否被删除
    let exists = backend.collection_exists(collection_name).await.unwrap();
    assert!(!exists, "集合应该已被删除");
    
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_create_collection_with_custom_schema() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection_name = "custom_schema_collection";
    let custom_schema = format!(
        "CREATE TABLE IF NOT EXISTS {} (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )",
        collection_name
    );
    
    let result = backend.create_collection(collection_name, Some(&custom_schema)).await;
    assert!(result.is_ok(), "使用自定义schema创建集合应该成功");
    
    backend.drop_collection(collection_name).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// CRUD操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_insert_and_get() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_users";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入数据
    let key = "user1";
    let data = json!({
        "name": "Alice",
        "age": 30,
        "email": "alice@example.com"
    });
    
    let result = backend.insert(collection, key, &data).await;
    assert!(result.is_ok(), "插入应该成功");
    
    // 获取数据
    let retrieved = backend.get(collection, key).await.unwrap();
    assert!(retrieved.is_some(), "应该能获取到数据");
    assert_eq!(retrieved.unwrap()["name"], "Alice");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_insert_duplicate_key() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_dup";
    backend.create_collection(collection, None).await.unwrap();
    
    let key = "user1";
    let data = json!({"name": "Alice"});
    
    // 第一次插入
    backend.insert(collection, key, &data).await.unwrap();
    
    // 第二次插入相同的键
    let result = backend.insert(collection, key, &data).await;
    assert!(result.is_err(), "重复插入应该失败");
    
    if let Err(DatabaseError::Duplicate(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回Duplicate错误");
    }
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_update() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_update";
    backend.create_collection(collection, None).await.unwrap();
    
    let key = "user1";
    let initial_data = json!({"name": "Alice", "age": 30});
    
    backend.insert(collection, key, &initial_data).await.unwrap();
    
    // 更新数据
    let updated_data = json!({"name": "Alice", "age": 31});
    let result = backend.update(collection, key, &updated_data).await;
    assert!(result.is_ok(), "更新应该成功");
    
    // 验证更新
    let retrieved = backend.get(collection, key).await.unwrap().unwrap();
    assert_eq!(retrieved["age"], 31);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_update_nonexistent() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_update_ne";
    backend.create_collection(collection, None).await.unwrap();
    
    let result = backend.update(collection, "nonexistent", &json!({"name": "Bob"})).await;
    assert!(result.is_err(), "更新不存在的键应该失败");
    
    if let Err(DatabaseError::NotFound(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回NotFound错误");
    }
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_delete() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_delete";
    backend.create_collection(collection, None).await.unwrap();
    
    let key = "user1";
    backend.insert(collection, key, &json!({"name": "Alice"})).await.unwrap();
    
    // 删除数据
    let result = backend.delete(collection, key).await;
    assert!(result.is_ok(), "删除应该成功");
    
    // 验证已删除
    let retrieved = backend.get(collection, key).await.unwrap();
    assert!(retrieved.is_none(), "数据应该已被删除");
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 批量操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_batch_insert() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_batch";
    backend.create_collection(collection, None).await.unwrap();
    
    // 批量插入
    let items = vec![
        ("user1".to_string(), json!({"name": "Alice"})),
        ("user2".to_string(), json!({"name": "Bob"})),
        ("user3".to_string(), json!({"name": "Charlie"})),
    ];
    
    let result = backend.batch_insert(collection, items).await;
    assert!(result.is_ok(), "批量插入应该成功");
    
    // 验证数量
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 3);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 查询测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_query_basic() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_query";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入测试数据
    backend.insert(collection, "user1", &json!({"name": "Alice", "age": 30})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob", "age": 25})).await.unwrap();
    backend.insert(collection, "user3", &json!({"name": "Charlie", "age": 35})).await.unwrap();
    
    // 查询所有
    let options = QueryOptions::default();
    let results = backend.query(collection, &options).await.unwrap();
    assert_eq!(results.len(), 3);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_query_with_limit() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_query_limit";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入测试数据
    for i in 0..10 {
        backend.insert(
            collection,
            &format!("user{}", i),
            &json!({"name": format!("User{}", i), "id": i}),
        ).await.unwrap();
    }
    
    // 带限制的查询
    let options = QueryOptions {
        limit: Some(5),
        ..Default::default()
    };
    let results = backend.query(collection, &options).await.unwrap();
    assert_eq!(results.len(), 5);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_count() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_count";
    backend.create_collection(collection, None).await.unwrap();
    
    // 初始计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 0);
    
    // 插入数据
    backend.insert(collection, "user1", &json!({"name": "Alice"})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob"})).await.unwrap();
    
    // 再次计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 2);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_clear_collection() {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_clear";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入数据
    backend.insert(collection, "user1", &json!({"name": "Alice"})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob"})).await.unwrap();
    
    // 清空集合
    let result = backend.clear_collection(collection).await;
    assert!(result.is_ok());
    
    // 验证已清空
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 0);
    
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 错误处理测试
// ================================

#[tokio::test]
async fn test_postgres_operations_without_connection() {
    let backend = PostgresBackend::new();
    
    // 尝试在未连接时执行操作
    let result = backend.create_collection("test", None).await;
    assert!(result.is_err());
    
    if let Err(DatabaseError::ConnectionError(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回ConnectionError");
    }
}


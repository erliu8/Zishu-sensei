//! Redis后端单元测试

use zishu_sensei_desktop::database::{
    backends::*,
    redis_backend::RedisBackend,
};
use serde_json::json;

// ================================
// 基础测试
// ================================

#[tokio::test]
async fn test_redis_backend_creation() {
    let backend = RedisBackend::new();
    assert_eq!(backend.backend_type(), DatabaseBackendType::Redis);
    assert!(!backend.is_connected());
}

#[tokio::test]
async fn test_redis_with_prefix() {
    let backend = RedisBackend::new().with_prefix("test:");
    assert_eq!(backend.backend_type(), DatabaseBackendType::Redis);
}

// ================================
// 连接测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_connect_success() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    let result = backend.connect(&config).await;
    assert!(result.is_ok(), "连接应该成功: {:?}", result.err());
    assert!(backend.is_connected());
    
    backend.disconnect().await.unwrap();
    assert!(!backend.is_connected());
}

#[tokio::test]
async fn test_redis_connect_invalid_url() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig {
        backend_type: DatabaseBackendType::Redis,
        connection_string: "invalid://url".to_string(),
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
#[ignore] // 需要实际的Redis服务器
async fn test_redis_create_collection() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    // Redis不需要显式创建集合
    let result = backend.create_collection("test_collection", None).await;
    assert!(result.is_ok(), "创建集合应该成功");
    
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_drop_collection() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_drop";
    
    // 插入一些数据
    backend.insert(collection, "key1", &json!({"value": 1})).await.unwrap();
    backend.insert(collection, "key2", &json!({"value": 2})).await.unwrap();
    
    // 删除集合
    let result = backend.drop_collection(collection).await;
    assert!(result.is_ok(), "删除集合应该成功");
    
    // 验证数据已删除
    let exists = backend.get(collection, "key1").await.unwrap();
    assert!(exists.is_none());
    
    backend.disconnect().await.unwrap();
}

// ================================
// CRUD操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_insert_and_get() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_users";
    let key = "user1";
    let data = json!({
        "name": "Alice",
        "age": 30,
        "email": "alice@example.com"
    });
    
    // 插入数据
    let result = backend.insert(collection, key, &data).await;
    assert!(result.is_ok(), "插入应该成功");
    
    // 获取数据
    let retrieved = backend.get(collection, key).await.unwrap();
    assert!(retrieved.is_some(), "应该能获取到数据");
    
    let retrieved_data = retrieved.unwrap();
    assert_eq!(retrieved_data["name"], "Alice");
    assert_eq!(retrieved_data["age"], 30);
    
    // 清理
    backend.delete(collection, key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_insert_duplicate_key() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_dup";
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
        panic!("应该返回Duplicate错误，实际: {:?}", result.err());
    }
    
    // 清理
    backend.delete(collection, key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_update() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_update";
    let key = "user1";
    let initial_data = json!({"name": "Alice", "age": 30});
    
    backend.insert(collection, key, &initial_data).await.unwrap();
    
    // 更新数据
    let updated_data = json!({"name": "Alice", "age": 31, "city": "Tokyo"});
    let result = backend.update(collection, key, &updated_data).await;
    assert!(result.is_ok(), "更新应该成功");
    
    // 验证更新
    let retrieved = backend.get(collection, key).await.unwrap().unwrap();
    assert_eq!(retrieved["age"], 31);
    assert_eq!(retrieved["city"], "Tokyo");
    
    // 清理
    backend.delete(collection, key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_update_nonexistent() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let result = backend.update("test", "nonexistent", &json!({"name": "Bob"})).await;
    assert!(result.is_err(), "更新不存在的键应该失败");
    
    if let Err(DatabaseError::NotFound(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回NotFound错误");
    }
    
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_delete() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_delete";
    let key = "user1";
    
    backend.insert(collection, key, &json!({"name": "Alice"})).await.unwrap();
    
    // 删除数据
    let result = backend.delete(collection, key).await;
    assert!(result.is_ok(), "删除应该成功");
    
    // 验证已删除
    let retrieved = backend.get(collection, key).await.unwrap();
    assert!(retrieved.is_none(), "数据应该已被删除");
    
    backend.disconnect().await.unwrap();
}

// ================================
// 批量操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_batch_insert() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_batch";
    
    // 批量插入
    let items = vec![
        ("user1".to_string(), json!({"name": "Alice", "id": 1})),
        ("user2".to_string(), json!({"name": "Bob", "id": 2})),
        ("user3".to_string(), json!({"name": "Charlie", "id": 3})),
    ];
    
    let result = backend.batch_insert(collection, items).await;
    assert!(result.is_ok(), "批量插入应该成功");
    
    // 验证数据
    let retrieved = backend.get(collection, "user2").await.unwrap().unwrap();
    assert_eq!(retrieved["name"], "Bob");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 查询测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_query_basic() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_query";
    
    // 插入测试数据
    backend.insert(collection, "user1", &json!({"name": "Alice", "age": 30})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob", "age": 25})).await.unwrap();
    backend.insert(collection, "user3", &json!({"name": "Charlie", "age": 35})).await.unwrap();
    
    // 查询所有
    let options = QueryOptions::default();
    let results = backend.query(collection, &options).await.unwrap();
    assert_eq!(results.len(), 3, "应该有3条数据");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_query_with_filter() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_filter";
    
    // 插入测试数据
    backend.insert(collection, "user1", &json!({"name": "Alice", "age": 30})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob", "age": 25})).await.unwrap();
    backend.insert(collection, "user3", &json!({"name": "Alice", "age": 35})).await.unwrap();
    
    // 按name过滤
    let options = QueryOptions {
        conditions: vec![QueryCondition {
            field: "name".to_string(),
            operator: QueryOperator::Eq,
            value: json!("Alice"),
        }],
        ..Default::default()
    };
    
    let results = backend.query(collection, &options).await.unwrap();
    assert_eq!(results.len(), 2, "应该有2条name=Alice的数据");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_query_with_limit() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_limit";
    
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
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_count() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_count";
    
    // 初始计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 0);
    
    // 插入数据
    backend.insert(collection, "user1", &json!({"name": "Alice"})).await.unwrap();
    backend.insert(collection, "user2", &json!({"name": "Bob"})).await.unwrap();
    backend.insert(collection, "user3", &json!({"name": "Charlie"})).await.unwrap();
    
    // 再次计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 3);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 缓存接口测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_cache_set_and_get() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let key = "cache:test:user1";
    let value = json!({"name": "Alice", "cached_at": "2025-01-01"});
    
    // 设置缓存
    let result = backend.set_with_expiry(key, &value, 60).await;
    assert!(result.is_ok(), "设置缓存应该成功");
    
    // 获取缓存
    let cached = backend.get_cache(key).await.unwrap();
    assert!(cached.is_some());
    assert_eq!(cached.unwrap()["name"], "Alice");
    
    // 检查TTL
    let ttl = backend.ttl(key).await.unwrap();
    assert!(ttl.is_some());
    assert!(ttl.unwrap() > 0 && ttl.unwrap() <= 60);
    
    // 清理
    backend.delete_cache(key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_cache_exists() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let key = "cache:exists:test";
    
    // 检查不存在的键
    let exists = backend.exists(key).await.unwrap();
    assert!(!exists);
    
    // 设置键
    backend.set_with_expiry(key, &json!({"test": true}), 60).await.unwrap();
    
    // 再次检查
    let exists = backend.exists(key).await.unwrap();
    assert!(exists);
    
    // 清理
    backend.delete_cache(key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_cache_increment() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let key = "counter:test";
    
    // 增加计数器
    let result = backend.increment(key, 1).await.unwrap();
    assert_eq!(result, 1);
    
    let result = backend.increment(key, 5).await.unwrap();
    assert_eq!(result, 6);
    
    // 减少计数器
    let result = backend.decrement(key, 2).await.unwrap();
    assert_eq!(result, 4);
    
    // 清理
    backend.delete_cache(key).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_cache_expire() {
    let mut backend = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    backend.connect(&config).await.unwrap();
    
    let key = "cache:expire:test";
    
    // 设置没有过期时间的键
    backend.set_with_expiry(key, &json!({"test": true}), 3600).await.unwrap();
    
    // 设置过期时间
    let result = backend.expire(key, 30).await;
    assert!(result.is_ok());
    
    // 检查TTL
    let ttl = backend.ttl(key).await.unwrap();
    assert!(ttl.is_some());
    assert!(ttl.unwrap() > 0 && ttl.unwrap() <= 30);
    
    // 清理
    backend.delete_cache(key).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 错误处理测试
// ================================

#[tokio::test]
async fn test_redis_operations_without_connection() {
    let backend = RedisBackend::new();
    
    // 尝试在未连接时执行操作
    let result = backend.get("test", "key1").await;
    assert!(result.is_err());
    
    if let Err(DatabaseError::ConnectionError(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回ConnectionError");
    }
}


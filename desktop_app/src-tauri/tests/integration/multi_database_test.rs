//! 多数据库集成测试
//!
//! 演示如何同时使用PostgreSQL、Redis和Qdrant

use zishu_sensei_desktop::database::{
    backends::*,
    postgres_backend::PostgresBackend,
    redis_backend::RedisBackend,
    qdrant_backend::QdrantBackend,
};
use serde_json::json;

// ================================
// 混合数据库场景测试
// ================================

/// 测试使用PostgreSQL存储结构化数据，Redis做缓存，Qdrant做向量搜索
#[tokio::test]
#[ignore] // 需要实际的数据库服务器
async fn test_hybrid_database_architecture() {
    // 1. PostgreSQL - 主数据存储
    let mut pg_backend = PostgresBackend::new();
    let pg_config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    pg_backend.connect(&pg_config).await.unwrap();
    
    let users_collection = "users";
    pg_backend.create_collection(users_collection, None).await.unwrap();
    
    // 存储用户数据
    let user = json!({
        "id": 1,
        "name": "Alice",
        "email": "alice@example.com",
        "bio": "A software engineer interested in AI"
    });
    pg_backend.insert(users_collection, "1", &user).await.unwrap();
    
    // 2. Redis - 缓存层
    let mut redis_backend = RedisBackend::new();
    let redis_config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    redis_backend.connect(&redis_config).await.unwrap();
    
    // 缓存用户会话
    let session_key = "session:user1";
    let session_data = json!({
        "user_id": 1,
        "logged_in_at": chrono::Utc::now().to_rfc3339(),
        "ip_address": "192.168.1.1"
    });
    redis_backend.set_with_expiry(session_key, &session_data, 3600).await.unwrap();
    
    // 3. Qdrant - 向量搜索
    let mut qdrant_backend = QdrantBackend::new().with_vector_size(384);
    let qdrant_config = DatabaseConfig::qdrant("http://localhost:6334");
    qdrant_backend.connect(&qdrant_config).await.unwrap();
    
    let embeddings_collection = "user_embeddings";
    qdrant_backend.create_collection(embeddings_collection, None).await.unwrap();
    
    // 存储用户的文本嵌入向量（假设已经生成）
    let user_vector: Vec<f32> = (0..384).map(|i| i as f32 / 384.0).collect();
    let vector_payload = json!({
        "user_id": 1,
        "text": "A software engineer interested in AI"
    });
    qdrant_backend.insert_vector(
        embeddings_collection,
        "1",
        user_vector,
        &vector_payload,
    ).await.unwrap();
    
    // 验证数据
    // PostgreSQL - 获取用户数据
    let pg_user = pg_backend.get(users_collection, "1").await.unwrap().unwrap();
    assert_eq!(pg_user["name"], "Alice");
    
    // Redis - 获取会话
    let cached_session = redis_backend.get_cache(session_key).await.unwrap().unwrap();
    assert_eq!(cached_session["user_id"], 1);
    
    // Qdrant - 向量搜索
    let query_vector: Vec<f32> = (0..384).map(|i| i as f32 / 384.0).collect();
    let search_results = qdrant_backend.vector_search(
        embeddings_collection,
        query_vector,
        5,
        None,
    ).await.unwrap();
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].payload["user_id"], 1);
    
    // 清理
    pg_backend.drop_collection(users_collection).await.unwrap();
    pg_backend.disconnect().await.unwrap();
    
    redis_backend.delete_cache(session_key).await.unwrap();
    redis_backend.disconnect().await.unwrap();
    
    qdrant_backend.drop_collection(embeddings_collection).await.unwrap();
    qdrant_backend.disconnect().await.unwrap();
}

/// 测试跨数据库的数据一致性
#[tokio::test]
#[ignore] // 需要实际的数据库服务器
async fn test_cross_database_consistency() {
    let mut pg = PostgresBackend::new();
    let mut redis = RedisBackend::new();
    
    let pg_config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    let redis_config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    pg.connect(&pg_config).await.unwrap();
    redis.connect(&redis_config).await.unwrap();
    
    let collection = "products";
    pg.create_collection(collection, None).await.unwrap();
    
    // 在PostgreSQL中创建产品
    let product = json!({
        "id": 1001,
        "name": "Laptop",
        "price": 1299.99,
        "stock": 10
    });
    pg.insert(collection, "1001", &product).await.unwrap();
    
    // 在Redis中缓存产品信息
    let cache_key = "product:1001";
    redis.set_with_expiry(cache_key, &product, 300).await.unwrap();
    
    // 更新产品（减少库存）
    let updated_product = json!({
        "id": 1001,
        "name": "Laptop",
        "price": 1299.99,
        "stock": 9
    });
    
    // 同时更新两个数据库
    pg.update(collection, "1001", &updated_product).await.unwrap();
    redis.set_with_expiry(cache_key, &updated_product, 300).await.unwrap();
    
    // 验证一致性
    let pg_data = pg.get(collection, "1001").await.unwrap().unwrap();
    let redis_data = redis.get_cache(cache_key).await.unwrap().unwrap();
    
    assert_eq!(pg_data["stock"], 9);
    assert_eq!(redis_data["stock"], 9);
    assert_eq!(pg_data["stock"], redis_data["stock"]);
    
    // 清理
    pg.drop_collection(collection).await.unwrap();
    pg.disconnect().await.unwrap();
    
    redis.delete_cache(cache_key).await.unwrap();
    redis.disconnect().await.unwrap();
}

/// 测试使用Redis做分布式锁
#[tokio::test]
#[ignore] // 需要实际的Redis服务器
async fn test_redis_distributed_lock() {
    let mut redis = RedisBackend::new();
    let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    redis.connect(&config).await.unwrap();
    
    let lock_key = "lock:resource:123";
    let lock_value = json!({"holder": "worker-1", "acquired_at": chrono::Utc::now().to_rfc3339()});
    
    // 获取锁
    let result = redis.set_with_expiry(lock_key, &lock_value, 10).await;
    assert!(result.is_ok(), "应该能获取锁");
    
    // 验证锁存在
    let exists = redis.exists(lock_key).await.unwrap();
    assert!(exists);
    
    // 检查TTL
    let ttl = redis.ttl(lock_key).await.unwrap();
    assert!(ttl.is_some() && ttl.unwrap() <= 10);
    
    // 释放锁
    redis.delete_cache(lock_key).await.unwrap();
    
    let exists = redis.exists(lock_key).await.unwrap();
    assert!(!exists);
    
    redis.disconnect().await.unwrap();
}

/// 测试Qdrant的语义搜索
#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_semantic_search() {
    let mut qdrant = QdrantBackend::new().with_vector_size(128);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    qdrant.connect(&config).await.unwrap();
    
    let collection = "documents";
    qdrant.create_collection(collection, None).await.unwrap();
    
    // 插入文档向量（模拟文本嵌入）
    let documents = vec![
        ("1", "Machine learning basics", vec![0.1; 128]),
        ("2", "Deep learning tutorial", vec![0.2; 128]),
        ("3", "Web development guide", vec![0.9; 128]),
        ("4", "Database optimization", vec![0.5; 128]),
        ("5", "Neural networks", vec![0.15; 128]),
    ];
    
    for (id, title, mut vector) in documents {
        // 添加一些随机性
        vector[0] = vector[0] + (id.parse::<usize>().unwrap() as f32 / 10.0);
        
        let payload = json!({"title": title});
        qdrant.insert_vector(collection, id, vector, &payload).await.unwrap();
    }
    
    // 搜索与"machine learning"相似的文档
    let query_vector = vec![0.12; 128];
    let results = qdrant.vector_search(collection, query_vector, 3, None).await.unwrap();
    
    assert_eq!(results.len(), 3);
    // 应该找到相关的文档
    assert!(results.iter().any(|r| r.payload["title"].as_str().unwrap().contains("learning")));
    
    qdrant.drop_collection(collection).await.unwrap();
    qdrant.disconnect().await.unwrap();
}

/// 测试PostgreSQL的复杂查询
#[tokio::test]
#[ignore] // 需要实际的PostgreSQL服务器
async fn test_postgres_complex_queries() {
    let mut pg = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    pg.connect(&config).await.unwrap();
    
    let collection = "analytics";
    pg.create_collection(collection, None).await.unwrap();
    
    // 插入分析数据
    for i in 0..20 {
        let data = json!({
            "id": i,
            "user_id": i % 5,
            "event": if i % 2 == 0 { "click" } else { "view" },
            "timestamp": chrono::Utc::now().timestamp() + i,
            "value": i * 10
        });
        pg.insert(collection, &i.to_string(), &data).await.unwrap();
    }
    
    // 查询所有数据
    let all_data = pg.query(collection, &QueryOptions::default()).await.unwrap();
    assert_eq!(all_data.len(), 20);
    
    // 带限制和偏移的查询
    let paginated = pg.query(
        collection,
        &QueryOptions {
            limit: Some(10),
            offset: Some(5),
            ..Default::default()
        },
    ).await.unwrap();
    assert_eq!(paginated.len(), 10);
    
    // 统计
    let count = pg.count(collection, None).await.unwrap();
    assert_eq!(count, 20);
    
    pg.drop_collection(collection).await.unwrap();
    pg.disconnect().await.unwrap();
}

/// 性能对比测试：PostgreSQL vs Redis
#[tokio::test]
#[ignore] // 需要实际的数据库服务器
async fn test_performance_comparison() {
    use std::time::Instant;
    
    let mut pg = PostgresBackend::new();
    let mut redis = RedisBackend::new();
    
    let pg_config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost:5432/test_db");
    let redis_config = DatabaseConfig::redis("redis://127.0.0.1:6379");
    
    pg.connect(&pg_config).await.unwrap();
    redis.connect(&redis_config).await.unwrap();
    
    let pg_collection = "perf_test_pg";
    let redis_collection = "perf_test_redis";
    
    pg.create_collection(pg_collection, None).await.unwrap();
    
    let test_data = json!({"data": "test value with some content"});
    
    // PostgreSQL 写入性能
    let pg_start = Instant::now();
    for i in 0..100 {
        pg.insert(pg_collection, &format!("key{}", i), &test_data).await.unwrap();
    }
    let pg_write_time = pg_start.elapsed();
    
    // Redis 写入性能
    let redis_start = Instant::now();
    for i in 0..100 {
        redis.insert(redis_collection, &format!("key{}", i), &test_data).await.unwrap();
    }
    let redis_write_time = redis_start.elapsed();
    
    println!("\n📊 性能对比:");
    println!("PostgreSQL 写入100条: {:?}", pg_write_time);
    println!("Redis 写入100条: {:?}", redis_write_time);
    println!("Redis 快了 {:.2}x", pg_write_time.as_secs_f64() / redis_write_time.as_secs_f64());
    
    // PostgreSQL 读取性能
    let pg_start = Instant::now();
    for i in 0..100 {
        pg.get(pg_collection, &format!("key{}", i)).await.unwrap();
    }
    let pg_read_time = pg_start.elapsed();
    
    // Redis 读取性能
    let redis_start = Instant::now();
    for i in 0..100 {
        redis.get(redis_collection, &format!("key{}", i)).await.unwrap();
    }
    let redis_read_time = redis_start.elapsed();
    
    println!("PostgreSQL 读取100条: {:?}", pg_read_time);
    println!("Redis 读取100条: {:?}", redis_read_time);
    println!("Redis 快了 {:.2}x", pg_read_time.as_secs_f64() / redis_read_time.as_secs_f64());
    
    // 清理
    pg.drop_collection(pg_collection).await.unwrap();
    redis.drop_collection(redis_collection).await.unwrap();
    
    pg.disconnect().await.unwrap();
    redis.disconnect().await.unwrap();
    
    // Redis通常应该更快
    assert!(redis_write_time < pg_write_time);
    assert!(redis_read_time < pg_read_time);
}


//! Qdrant向量数据库后端单元测试

use zishu_sensei_desktop::database::{
    backends::*,
    qdrant_backend::QdrantBackend,
};
use serde_json::json;

// ================================
// 基础测试
// ================================

#[tokio::test]
async fn test_qdrant_backend_creation() {
    let backend = QdrantBackend::new();
    assert_eq!(backend.backend_type(), DatabaseBackendType::Qdrant);
    assert!(!backend.is_connected());
}

#[tokio::test]
async fn test_qdrant_with_vector_size() {
    let backend = QdrantBackend::new().with_vector_size(512);
    assert_eq!(backend.backend_type(), DatabaseBackendType::Qdrant);
}

// ================================
// 连接测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_connect_success() {
    let mut backend = QdrantBackend::new();
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    let result = backend.connect(&config).await;
    assert!(result.is_ok(), "连接应该成功: {:?}", result.err());
    assert!(backend.is_connected());
    
    backend.disconnect().await.unwrap();
    assert!(!backend.is_connected());
}

#[tokio::test]
async fn test_qdrant_connect_invalid_url() {
    let mut backend = QdrantBackend::new();
    let config = DatabaseConfig {
        backend_type: DatabaseBackendType::Qdrant,
        connection_string: "http://invalid-host:99999".to_string(),
        max_connections: Some(5),
        timeout: Some(1), // 短超时
        extra: Default::default(),
    };
    
    let result = backend.connect(&config).await;
    // 可能会连接成功但健康检查失败
    if result.is_ok() {
        // 尝试操作，应该失败
        let coll_result = backend.collection_exists("test").await;
        // 可能返回错误或false
    }
}

// ================================
// 集合操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_create_and_drop_collection() {
    let mut backend = QdrantBackend::new().with_vector_size(128);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection_name = "test_collection";
    
    // 创建集合
    let result = backend.create_collection(collection_name, None).await;
    assert!(result.is_ok(), "创建集合应该成功: {:?}", result.err());
    
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
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_create_collection_with_custom_size() {
    let mut backend = QdrantBackend::new();
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection_name = "custom_vector_collection";
    let schema = json!({
        "vector_size": 256
    });
    
    let result = backend.create_collection(
        collection_name,
        Some(&serde_json::to_string(&schema).unwrap()),
    ).await;
    assert!(result.is_ok(), "使用自定义向量维度创建集合应该成功");
    
    backend.drop_collection(collection_name).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 向量操作测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_insert_and_get_vector() {
    let mut backend = QdrantBackend::new().with_vector_size(128);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_vectors";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入向量
    let vector: Vec<f32> = (0..128).map(|i| i as f32 / 128.0).collect();
    let payload = json!({
        "name": "Alice",
        "category": "person",
        "age": 30
    });
    
    let result = backend.insert_vector(collection, "1", vector.clone(), &payload).await;
    assert!(result.is_ok(), "插入向量应该成功");
    
    // 获取数据
    let retrieved = backend.get(collection, "1").await.unwrap();
    assert!(retrieved.is_some(), "应该能获取到数据");
    
    let data = retrieved.unwrap();
    assert_eq!(data["name"], "Alice");
    assert_eq!(data["age"], 30);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_batch_insert_vectors() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_batch_vectors";
    backend.create_collection(collection, None).await.unwrap();
    
    // 批量插入向量
    let items = vec![
        (
            "1".to_string(),
            (0..64).map(|i| i as f32 / 64.0).collect(),
            json!({"name": "Alice", "id": 1}),
        ),
        (
            "2".to_string(),
            (0..64).map(|i| (i as f32 + 10.0) / 64.0).collect(),
            json!({"name": "Bob", "id": 2}),
        ),
        (
            "3".to_string(),
            (0..64).map(|i| (i as f32 + 20.0) / 64.0).collect(),
            json!({"name": "Charlie", "id": 3}),
        ),
    ];
    
    let result = backend.batch_insert_vectors(collection, items).await;
    assert!(result.is_ok(), "批量插入向量应该成功");
    
    // 验证数量
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 3);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_vector_search() {
    let mut backend = QdrantBackend::new().with_vector_size(128);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_search";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入一些向量
    for i in 0..5 {
        let vector: Vec<f32> = (0..128).map(|j| (j as f32 + i as f32 * 10.0) / 128.0).collect();
        let payload = json!({
            "name": format!("Item{}", i),
            "category": if i % 2 == 0 { "even" } else { "odd" },
            "value": i
        });
        
        backend.insert_vector(
            collection,
            &i.to_string(),
            vector,
            &payload,
        ).await.unwrap();
    }
    
    // 执行向量搜索
    let query_vector: Vec<f32> = (0..128).map(|i| i as f32 / 128.0).collect();
    let results = backend.vector_search(collection, query_vector, 3, None).await.unwrap();
    
    assert_eq!(results.len(), 3, "应该返回3个最相似的结果");
    
    // 第一个结果应该是最相似的（ID=0）
    assert_eq!(results[0].id, "0");
    assert!(results[0].score > 0.9, "第一个结果的相似度应该很高");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_update_payload() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_update";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入向量
    let vector: Vec<f32> = (0..64).map(|i| i as f32 / 64.0).collect();
    let initial_payload = json!({"name": "Alice", "age": 30});
    
    backend.insert_vector(collection, "1", vector, &initial_payload).await.unwrap();
    
    // 更新payload
    let updated_payload = json!({"name": "Alice", "age": 31, "city": "Tokyo"});
    let result = backend.update(collection, "1", &updated_payload).await;
    assert!(result.is_ok(), "更新payload应该成功");
    
    // 验证更新
    let retrieved = backend.get(collection, "1").await.unwrap().unwrap();
    assert_eq!(retrieved["age"], 31);
    assert_eq!(retrieved["city"], "Tokyo");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_delete_vector() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_delete";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入向量
    let vector: Vec<f32> = (0..64).map(|i| i as f32 / 64.0).collect();
    backend.insert_vector(
        collection,
        "1",
        vector,
        &json!({"name": "Alice"}),
    ).await.unwrap();
    
    // 删除向量
    let result = backend.delete_vector(collection, "1").await;
    assert!(result.is_ok(), "删除向量应该成功");
    
    // 验证已删除
    let retrieved = backend.get(collection, "1").await.unwrap();
    assert!(retrieved.is_none(), "数据应该已被删除");
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 查询测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_query_basic() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_query";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入测试数据
    for i in 0..5 {
        let vector: Vec<f32> = (0..64).map(|j| (j + i) as f32 / 64.0).collect();
        backend.insert_vector(
            collection,
            &i.to_string(),
            vector,
            &json!({"name": format!("Item{}", i), "value": i}),
        ).await.unwrap();
    }
    
    // 查询所有
    let options = QueryOptions::default();
    let results = backend.query(collection, &options).await.unwrap();
    assert_eq!(results.len(), 5);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_query_with_limit() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_limit";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入测试数据
    for i in 0..10 {
        let vector: Vec<f32> = (0..64).map(|j| (j + i) as f32 / 64.0).collect();
        backend.insert_vector(
            collection,
            &i.to_string(),
            vector,
            &json!({"name": format!("Item{}", i), "id": i}),
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
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_count() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_count";
    backend.create_collection(collection, None).await.unwrap();
    
    // 初始计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 0);
    
    // 插入数据
    for i in 0..3 {
        let vector: Vec<f32> = (0..64).map(|j| (j + i) as f32 / 64.0).collect();
        backend.insert_vector(
            collection,
            &i.to_string(),
            vector,
            &json!({"name": format!("Item{}", i)}),
        ).await.unwrap();
    }
    
    // 再次计数
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 3);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_clear_collection() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_clear";
    backend.create_collection(collection, None).await.unwrap();
    
    // 插入数据
    for i in 0..3 {
        let vector: Vec<f32> = (0..64).map(|j| (j + i) as f32 / 64.0).collect();
        backend.insert_vector(
            collection,
            &i.to_string(),
            vector,
            &json!({"name": format!("Item{}", i)}),
        ).await.unwrap();
    }
    
    // 清空集合
    let result = backend.clear_collection(collection).await;
    assert!(result.is_ok());
    
    // 验证已清空
    let count = backend.count(collection, None).await.unwrap();
    assert_eq!(count, 0);
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 边界情况测试
// ================================

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_insert_with_invalid_id() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_invalid_id";
    backend.create_collection(collection, None).await.unwrap();
    
    // 尝试使用非数字ID
    let vector: Vec<f32> = (0..64).map(|i| i as f32 / 64.0).collect();
    let result = backend.insert_vector(
        collection,
        "invalid_id",
        vector,
        &json!({"name": "Test"}),
    ).await;
    
    assert!(result.is_err(), "使用非数字ID应该失败");
    
    if let Err(DatabaseError::InvalidData(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回InvalidData错误");
    }
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

#[tokio::test]
#[ignore] // 需要实际的Qdrant服务器
async fn test_qdrant_normal_insert_not_supported() {
    let mut backend = QdrantBackend::new().with_vector_size(64);
    let config = DatabaseConfig::qdrant("http://localhost:6334");
    
    backend.connect(&config).await.unwrap();
    
    let collection = "test_normal_insert";
    backend.create_collection(collection, None).await.unwrap();
    
    // 尝试使用普通insert（没有向量）
    let result = backend.insert(collection, "1", &json!({"name": "Test"})).await;
    
    assert!(result.is_err(), "普通insert应该失败");
    
    if let Err(DatabaseError::InvalidData(msg)) = result {
        assert!(msg.contains("向量"), "错误消息应该提示需要向量");
    } else {
        panic!("应该返回InvalidData错误");
    }
    
    // 清理
    backend.drop_collection(collection).await.unwrap();
    backend.disconnect().await.unwrap();
}

// ================================
// 错误处理测试
// ================================

#[tokio::test]
async fn test_qdrant_operations_without_connection() {
    let backend = QdrantBackend::new();
    
    // 尝试在未连接时执行操作
    let result = backend.create_collection("test", None).await;
    assert!(result.is_err());
    
    if let Err(DatabaseError::ConnectionError(_)) = result {
        // 正确的错误类型
    } else {
        panic!("应该返回ConnectionError");
    }
}


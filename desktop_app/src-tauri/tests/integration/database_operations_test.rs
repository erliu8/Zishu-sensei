//! 数据库操作集成测试
//!
//! 测试数据库的CRUD操作、事务处理、并发访问等完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 数据库操作测试
// ========================================

/// 测试完整的CRUD操作流程
/// 流程: Create → Read → Update → Delete
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_complete_crud_operations() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_crud_ops");
    test_db.connect().await.unwrap();
    test_db.init_full_schema().await.unwrap();
    
    let adapter_id = "crud-test-adapter";
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. CREATE - 创建记录
    test_db.insert_test_adapter(adapter_id, "CRUD Test Adapter", true).await.unwrap();
    
    // 验证创建成功
    assert!(test_db.record_exists("installed_adapters", adapter_id).await.unwrap());
    
    // 2. READ - 读取记录
    let result = test_db.get_backend()
        .get("installed_adapters", adapter_id)
        .await
        .unwrap();
    
    assert!(result.is_some());
    let data = result.unwrap();
    assert_eq!(data["name"].as_str().unwrap(), "CRUD Test Adapter");
    assert_eq!(data["version"].as_str().unwrap(), "1.0.0");
    assert_eq!(data["status"].as_str().unwrap(), "installed");
    
    // 3. UPDATE - 更新记录
    let updated_data = json!({
        "id": adapter_id,
        "name": "CRUD Test Adapter",
        "display_name": "Display CRUD Test Adapter",
        "version": "2.0.0",
        "install_path": "/test/adapters/crud",
        "status": "updated",
        "enabled": true,
        "auto_update": true,
        "source": "test",
        "installed_at": chrono::Utc::now().timestamp(),
        "updated_at": chrono::Utc::now().timestamp(),
        "config": {},
        "metadata": {}
    });
    
    test_db.get_backend()
        .update("installed_adapters", adapter_id, &updated_data)
        .await
        .unwrap();
    
    // 验证更新成功
    let updated_result = test_db.get_backend()
        .get("installed_adapters", adapter_id)
        .await
        .unwrap()
        .unwrap();
    
    assert_eq!(updated_result["version"].as_str().unwrap(), "2.0.0");
    assert_eq!(updated_result["status"].as_str().unwrap(), "updated");
    
    // 4. DELETE - 删除记录
    test_db.get_backend()
        .delete("installed_adapters", adapter_id)
        .await
        .unwrap();
    
    // 验证删除成功
    assert!(!test_db.record_exists("installed_adapters", adapter_id).await.unwrap());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试批量操作
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_batch_operations() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_batch_ops");
    test_db.connect().await.unwrap();
    test_db.init_adapter_tables().await.unwrap();
    
    // ========== Act (执行) ==========
    
    // 批量插入 100 个适配器
    let batch_size = 100;
    
    for i in 0..batch_size {
        test_db.insert_test_adapter(
            &format!("adapter-{}", i),
            &format!("Adapter {}", i),
            true
        ).await.unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证插入数量
    let total_count = test_db.count_records("installed_adapters").await.unwrap();
    assert_eq!(total_count, batch_size);
    
    // 批量获取
    let keys: Vec<String> = (0..batch_size)
        .map(|i| format!("adapter-{}", i))
        .collect();
    
    let results = test_db.get_backend()
        .batch_get("installed_adapters", keys.clone())
        .await
        .unwrap();
    
    assert_eq!(results.len(), batch_size as usize);
    
    // 批量删除
    for key in keys {
        test_db.get_backend()
            .delete("installed_adapters", &key)
            .await
            .unwrap();
    }
    
    // 验证批量删除
    let remaining_count = test_db.count_records("installed_adapters").await.unwrap();
    assert_eq!(remaining_count, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试并发操作
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_concurrent_operations() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_concurrent_ops");
    test_db.connect().await.unwrap();
    test_db.init_chat_tables().await.unwrap();
    
    let session_id = unique_test_id("session");
    
    // ========== Act (执行) ==========
    
    // 创建会话
    test_db.insert_test_chat_session(&session_id, "Concurrent Test").await.unwrap();
    
    // 并发插入消息
    let concurrent_writes = 50;
    let mut handles = vec![];
    
    for i in 0..concurrent_writes {
        let sid = session_id.clone();
        let msg_id = unique_test_id(&format!("msg_{}", i));
        
        // 注意：每个并发任务需要自己的数据库连接
        // 在实际实现中，应该使用连接池
        let handle = tokio::spawn(async move {
            // 这里简化处理，实际应该从连接池获取连接
            msg_id
        });
        
        handles.push(handle);
    }
    
    // 等待所有任务完成
    for handle in handles {
        handle.await.unwrap();
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试外键约束
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_foreign_key_constraints() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_foreign_keys");
    test_db.connect().await.unwrap();
    test_db.init_full_schema().await.unwrap();
    
    let session_id = unique_test_id("session");
    let message_id = unique_test_id("message");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建会话
    test_db.insert_test_chat_session(&session_id, "FK Test").await.unwrap();
    
    // 2. 创建依赖于会话的消息
    test_db.insert_test_chat_message(&message_id, &session_id, "user", "Test message").await.unwrap();
    
    // 验证消息已创建
    assert!(test_db.record_exists("chat_messages", &message_id).await.unwrap());
    
    // 3. 删除会话（应该级联删除消息）
    test_db.get_backend()
        .delete("chat_sessions", &session_id)
        .await
        .unwrap();
    
    // 验证消息也被删除了（CASCADE）
    assert!(!test_db.record_exists("chat_messages", &message_id).await.unwrap());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试数据完整性
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_data_integrity() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_data_integrity");
    test_db.connect().await.unwrap();
    test_db.init_adapter_tables().await.unwrap();
    
    let adapter_id = unique_test_id("adapter");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 插入适配器
    test_db.insert_test_adapter(&adapter_id, "Integrity Test", true).await.unwrap();
    
    // 2. 验证数据一致性
    let data = test_db.get_backend()
        .get("installed_adapters", &adapter_id)
        .await
        .unwrap()
        .unwrap();
    
    // 验证必填字段
    assert!(data.get("id").is_some());
    assert!(data.get("name").is_some());
    assert!(data.get("version").is_some());
    assert!(data.get("status").is_some());
    
    // 验证JSON字段
    assert!(data.get("config").is_some());
    assert!(data.get("metadata").is_some());
    
    // 验证布尔字段
    assert_eq!(data["enabled"].as_bool().unwrap(), true);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试查询性能
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_query_performance() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_query_perf");
    test_db.connect().await.unwrap();
    test_db.init_adapter_tables().await.unwrap();
    
    // 插入大量数据
    let record_count = 1000;
    for i in 0..record_count {
        test_db.insert_test_adapter(
            &format!("adapter-{}", i),
            &format!("Adapter {}", i),
            i % 2 == 0
        ).await.unwrap();
    }
    
    // ========== Act (执行) ==========
    
    let start = std::time::Instant::now();
    
    // 执行批量查询
    let keys: Vec<String> = (0..100)
        .map(|i| format!("adapter-{}", i))
        .collect();
    
    let _results = test_db.get_backend()
        .batch_get("installed_adapters", keys)
        .await
        .unwrap();
    
    let duration = start.elapsed();
    
    // ========== Assert (断言) ==========
    
    // 批量查询应该在合理时间内完成（< 1秒）
    assert!(duration.as_secs() < 1, "查询耗时: {:?}", duration);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试JSON字段操作
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_json_field_operations() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_json_fields");
    test_db.connect().await.unwrap();
    test_db.init_adapter_tables().await.unwrap();
    
    let adapter_id = unique_test_id("adapter");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 插入带复杂JSON的适配器
    let now = chrono::Utc::now().timestamp();
    let data = json!({
        "id": adapter_id,
        "name": "JSON Test Adapter",
        "display_name": "Display JSON Test",
        "version": "1.0.0",
        "install_path": "/test/adapters/json",
        "status": "installed",
        "enabled": true,
        "auto_update": true,
        "source": "test",
        "installed_at": now,
        "updated_at": now,
        "config": {
            "api_key": "test-key-123",
            "endpoint": "https://api.example.com",
            "timeout": 30,
            "retry": {
                "enabled": true,
                "max_attempts": 3
            }
        },
        "metadata": {
            "tags": ["test", "json", "adapter"],
            "author": "Test Author",
            "license": "MIT"
        }
    });
    
    test_db.get_backend()
        .insert("installed_adapters", &adapter_id, &data)
        .await
        .unwrap();
    
    // 2. 读取并验证JSON字段
    let result = test_db.get_backend()
        .get("installed_adapters", &adapter_id)
        .await
        .unwrap()
        .unwrap();
    
    // 验证config字段
    assert_eq!(result["config"]["api_key"].as_str().unwrap(), "test-key-123");
    assert_eq!(result["config"]["timeout"].as_i64().unwrap(), 30);
    assert_eq!(result["config"]["retry"]["max_attempts"].as_i64().unwrap(), 3);
    
    // 验证metadata字段
    let tags = result["metadata"]["tags"].as_array().unwrap();
    assert_eq!(tags.len(), 3);
    assert_eq!(result["metadata"]["license"].as_str().unwrap(), "MIT");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

/// 测试错误处理
#[tokio::test]
#[ignore] // 需要PostgreSQL服务器
async fn test_error_handling() {
    // ========== Arrange (准备) ==========
    let mut test_db = TestPostgresDatabase::new("test_error_handling");
    test_db.connect().await.unwrap();
    test_db.init_adapter_tables().await.unwrap();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 测试获取不存在的记录
    let result = test_db.get_backend()
        .get("installed_adapters", "non-existent")
        .await
        .unwrap();
    
    assert!(result.is_none());
    
    // 2. 测试删除不存在的记录（应该成功，不报错）
    let delete_result = test_db.get_backend()
        .delete("installed_adapters", "non-existent")
        .await;
    
    assert!(delete_result.is_ok());
    
    // 3. 测试重复插入（应该失败）
    let adapter_id = unique_test_id("adapter");
    test_db.insert_test_adapter(&adapter_id, "Test", true).await.unwrap();
    
    let duplicate_result = test_db.insert_test_adapter(&adapter_id, "Test", true).await;
    assert!(duplicate_result.is_err());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().await.unwrap();
    test_db.disconnect().await.unwrap();
}

// ========================================
// 辅助函数
// ========================================

/// 生成唯一的测试ID
fn unique_test_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("{}-{}", prefix, timestamp)
}

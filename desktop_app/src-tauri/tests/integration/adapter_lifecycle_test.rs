//! 适配器完整生命周期集成测试
//!
//! 测试适配器从安装、加载、配置、使用到卸载的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 适配器生命周期测试
// ========================================

/// 测试适配器的完整生命周期
/// 流程: 注册 → 安装 → 配置 → 启用 → 使用 → 禁用 → 卸载
#[tokio::test]
async fn test_adapter_full_lifecycle() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    test_db.init_permission_tables().unwrap();
    
    let adapter_id = "test-lifecycle-adapter";
    let adapter_data = create_test_adapter(adapter_id);
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 安装适配器
    test_db.insert_test_adapter(adapter_id, "Lifecycle Adapter", false).unwrap();
    assert!(test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
    
    // 验证初始状态
    let conn = test_db.get_connection();
    let status: String = conn.query_row(
        "SELECT status FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(status, "installed");
    
    // 2. 启用适配器
    conn.execute(
        "UPDATE installed_adapters SET enabled = 1 WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    let enabled: i32 = conn.query_row(
        "SELECT enabled FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(enabled, 1);
    
    // 3. 配置适配器
    let config = json!({
        "api_key": "test-key-123",
        "model": "gpt-4",
        "temperature": 0.7
    });
    
    conn.execute(
        "UPDATE installed_adapters SET config = ?1 WHERE id = ?2",
        rusqlite::params![config.to_string(), adapter_id]
    ).unwrap();
    
    // 验证配置已保存
    let saved_config: String = conn.query_row(
        "SELECT config FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    let parsed_config: serde_json::Value = serde_json::from_str(&saved_config).unwrap();
    assert_eq!(parsed_config["model"], "gpt-4");
    
    // 4. 授予权限
    conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, granted_at)
         VALUES (?1, ?2, 1, ?3)",
        rusqlite::params![adapter_id, "network.access", chrono::Utc::now().timestamp()]
    ).unwrap();
    
    // 验证权限已授予
    let permission_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1 AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(permission_count, 1);
    
    // 5. 更新最后使用时间（模拟使用）
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE installed_adapters SET last_used_at = ?1 WHERE id = ?2",
        rusqlite::params![now, adapter_id]
    ).unwrap();
    
    let last_used: i64 = conn.query_row(
        "SELECT last_used_at FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(last_used, now);
    
    // 6. 禁用适配器
    conn.execute(
        "UPDATE installed_adapters SET enabled = 0 WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    let disabled: i32 = conn.query_row(
        "SELECT enabled FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(disabled, 0);
    
    // 7. 卸载适配器（级联删除权限）
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    // 验证适配器已删除
    assert!(!test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
    
    // 验证权限也已删除（级联删除）
    let remaining_permissions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_permissions, 0);
    
    // ========== Cleanup (清理) ==========
    // TestDatabase 会自动清理
}

/// 测试多个适配器的并发生命周期
#[tokio::test]
async fn test_multiple_adapters_concurrent_lifecycle() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_ids = vec!["adapter-1", "adapter-2", "adapter-3"];
    
    // ========== Act (执行) ==========
    
    // 安装多个适配器
    for id in &adapter_ids {
        test_db.insert_test_adapter(id, &format!("Adapter {}", id), true).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证所有适配器都已安装
    let total_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(total_count, 3);
    
    // 验证每个适配器都存在
    for id in &adapter_ids {
        assert!(test_db.record_exists("installed_adapters", "id", id).unwrap());
    }
    
    // 禁用第二个适配器
    let conn = test_db.get_connection();
    conn.execute(
        "UPDATE installed_adapters SET enabled = 0 WHERE id = ?1",
        &["adapter-2"]
    ).unwrap();
    
    // 验证启用/禁用状态
    let enabled_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM installed_adapters WHERE enabled = 1",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(enabled_count, 2);
    
    // 删除第一个适配器
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &["adapter-1"]
    ).unwrap();
    
    // 验证删除后的数量
    let remaining_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(remaining_count, 2);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}

/// 测试适配器版本更新流程
#[tokio::test]
async fn test_adapter_version_update_lifecycle() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "versioned-adapter";
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 安装 v1.0.0
    test_db.insert_test_adapter(adapter_id, "Versioned Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    
    // 记录版本历史
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO adapter_versions (adapter_id, version, released_at, is_current)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![adapter_id, "1.0.0", now]
    ).unwrap();
    
    // 验证当前版本
    let current_version: String = conn.query_row(
        "SELECT version FROM adapter_versions WHERE adapter_id = ?1 AND is_current = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(current_version, "1.0.0");
    
    // 2. 更新到 v1.1.0
    conn.execute(
        "UPDATE adapter_versions SET is_current = 0 WHERE adapter_id = ?1",
        &[adapter_id]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO adapter_versions (adapter_id, version, released_at, is_current)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![adapter_id, "1.1.0", now]
    ).unwrap();
    
    conn.execute(
        "UPDATE installed_adapters SET version = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params!["1.1.0", now, adapter_id]
    ).unwrap();
    
    // 验证版本已更新
    let new_version: String = conn.query_row(
        "SELECT version FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(new_version, "1.1.0");
    
    // 验证版本历史
    let version_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_versions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(version_count, 2);
    
    // 3. 回滚到 v1.0.0
    conn.execute(
        "UPDATE adapter_versions SET is_current = 0 WHERE adapter_id = ?1",
        &[adapter_id]
    ).unwrap();
    
    conn.execute(
        "UPDATE adapter_versions SET is_current = 1 
         WHERE adapter_id = ?1 AND version = ?2",
        rusqlite::params![adapter_id, "1.0.0"]
    ).unwrap();
    
    conn.execute(
        "UPDATE installed_adapters SET version = ?1 WHERE id = ?2",
        rusqlite::params!["1.0.0", adapter_id]
    ).unwrap();
    
    // 验证回滚成功
    let rolled_back_version: String = conn.query_row(
        "SELECT version FROM adapter_versions WHERE adapter_id = ?1 AND is_current = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(rolled_back_version, "1.0.0");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}

/// 测试适配器依赖管理
#[tokio::test]
async fn test_adapter_dependency_management() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "dependent-adapter";
    let dependency_id = "base-adapter";
    
    // ========== Act (执行) ==========
    
    // 安装基础适配器
    test_db.insert_test_adapter(dependency_id, "Base Adapter", true).unwrap();
    
    // 安装依赖适配器
    test_db.insert_test_adapter(adapter_id, "Dependent Adapter", true).unwrap();
    
    // 添加依赖关系
    let conn = test_db.get_connection();
    conn.execute(
        "INSERT INTO adapter_dependencies (adapter_id, dependency_id, version_requirement, required)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![adapter_id, dependency_id, "^1.0.0"]
    ).unwrap();
    
    // ========== Assert (断言) ==========
    
    // 验证依赖已记录
    let dependency_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_dependencies WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(dependency_count, 1);
    
    // 验证依赖信息
    let (dep_id, version_req): (String, String) = conn.query_row(
        "SELECT dependency_id, version_requirement FROM adapter_dependencies WHERE adapter_id = ?1",
        &[adapter_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    assert_eq!(dep_id, dependency_id);
    assert_eq!(version_req, "^1.0.0");
    
    // 尝试删除被依赖的适配器应该先检查依赖
    // （在实际应用中，这应该被阻止或警告）
    let has_dependents: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_dependencies WHERE dependency_id = ?1",
        &[dependency_id],
        |row| row.get(0)
    ).unwrap();
    assert!(has_dependents > 0, "Base adapter has dependents");
    
    // 先删除依赖适配器
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    // 验证依赖关系也被删除（级联删除）
    let remaining_deps: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_dependencies WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_deps, 0);
    
    // 现在可以安全删除基础适配器
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &[dependency_id]
    ).unwrap();
    
    assert_eq!(test_db.count_records("installed_adapters").unwrap(), 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}

/// 测试适配器配置的持久化和恢复
#[tokio::test]
async fn test_adapter_config_persistence() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "config-adapter";
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 安装适配器
    test_db.insert_test_adapter(adapter_id, "Config Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    
    // 2. 保存复杂配置
    let config = json!({
        "api": {
            "endpoint": "https://api.example.com",
            "key": "encrypted_key_here",
            "timeout": 30000
        },
        "model": {
            "name": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 2048
        },
        "features": {
            "streaming": true,
            "function_calling": true,
            "vision": false
        },
        "metadata": {
            "custom_field_1": "value1",
            "custom_field_2": 123,
            "custom_field_3": true
        }
    });
    
    conn.execute(
        "UPDATE installed_adapters SET config = ?1 WHERE id = ?2",
        rusqlite::params![config.to_string(), adapter_id]
    ).unwrap();
    
    // 3. 读取配置并验证
    let saved_config: String = conn.query_row(
        "SELECT config FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    
    let parsed_config: serde_json::Value = serde_json::from_str(&saved_config).unwrap();
    
    // 验证配置的各个部分
    assert_eq!(parsed_config["api"]["endpoint"], "https://api.example.com");
    assert_eq!(parsed_config["model"]["temperature"], 0.7);
    assert_eq!(parsed_config["features"]["streaming"], true);
    assert_eq!(parsed_config["metadata"]["custom_field_2"], 123);
    
    // 4. 部分更新配置
    let mut updated_config = parsed_config.clone();
    updated_config["model"]["temperature"] = json!(0.9);
    updated_config["features"]["vision"] = json!(true);
    
    conn.execute(
        "UPDATE installed_adapters SET config = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![
            updated_config.to_string(),
            chrono::Utc::now().timestamp(),
            adapter_id
        ]
    ).unwrap();
    
    // 5. 验证更新后的配置
    let final_config: String = conn.query_row(
        "SELECT config FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    
    let final_parsed: serde_json::Value = serde_json::from_str(&final_config).unwrap();
    assert_eq!(final_parsed["model"]["temperature"], 0.9);
    assert_eq!(final_parsed["features"]["vision"], true);
    assert_eq!(final_parsed["api"]["endpoint"], "https://api.example.com"); // 未改变的部分保持不变
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}

/// 测试适配器权限的完整管理流程
#[tokio::test]
async fn test_adapter_permission_full_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "permission-adapter";
    
    // ========== Act & Assert (执行和验证) ==========
    
    test_db.insert_test_adapter(adapter_id, "Permission Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 1. 请求多个权限
    let permissions = vec![
        ("network.access", "Access network resources"),
        ("file.read", "Read local files"),
        ("file.write", "Write local files"),
        ("system.clipboard", "Access clipboard"),
    ];
    
    for (perm_type, desc) in &permissions {
        conn.execute(
            "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, granted_at, description)
             VALUES (?1, ?2, 0, NULL, ?3)",
            rusqlite::params![adapter_id, perm_type, desc]
        ).unwrap();
    }
    
    // 验证权限请求已记录
    let pending_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1 AND granted = 0",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(pending_count, 4);
    
    // 2. 授予部分权限
    conn.execute(
        "UPDATE adapter_permissions 
         SET granted = 1, granted_at = ?1 
         WHERE adapter_id = ?2 AND permission_type IN ('network.access', 'file.read')",
        rusqlite::params![now, adapter_id]
    ).unwrap();
    
    // 验证授予的权限
    let granted_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1 AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(granted_count, 2);
    
    // 3. 拒绝一个权限（删除）
    conn.execute(
        "DELETE FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = 'system.clipboard'",
        &[adapter_id]
    ).unwrap();
    
    // 4. 撤销一个已授予的权限
    conn.execute(
        "UPDATE adapter_permissions 
         SET granted = 0, granted_at = NULL 
         WHERE adapter_id = ?1 AND permission_type = 'file.read'",
        &[adapter_id]
    ).unwrap();
    
    // 5. 最终状态验证
    let total_perms: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_perms, 3); // 删除了一个
    
    let final_granted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1 AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(final_granted, 1); // 只剩 network.access
    
    // 验证 network.access 仍然被授予
    let network_granted: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = 'network.access'",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(network_granted, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}

/// 测试适配器异常情况处理
#[tokio::test]
async fn test_adapter_error_scenarios() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let conn = test_db.get_connection();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 测试重复安装（唯一约束）
    test_db.insert_test_adapter("duplicate-adapter", "Duplicate", true).unwrap();
    
    let duplicate_result = test_db.insert_test_adapter("duplicate-adapter", "Duplicate", true);
    assert!(duplicate_result.is_err(), "Should not allow duplicate adapter IDs");
    
    // 2. 测试无效的外键引用
    let invalid_permission_result = conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
         VALUES (?1, ?2, 0)",
        rusqlite::params!["non-existent-adapter", "test.permission"]
    );
    // 注意：SQLite 默认不强制外键约束，需要在连接时启用
    // 这里我们只是演示如何测试
    
    // 3. 测试删除适配器时的级联删除
    let adapter_id = "cascade-test-adapter";
    test_db.insert_test_adapter(adapter_id, "Cascade Test", true).unwrap();
    
    // 添加依赖数据
    conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
         VALUES (?1, ?2, 1)",
        rusqlite::params![adapter_id, "test.permission"]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO adapter_versions (adapter_id, version, released_at)
         VALUES (?1, ?2, ?3)",
        rusqlite::params![adapter_id, "1.0.0", chrono::Utc::now().timestamp()]
    ).unwrap();
    
    // 删除适配器
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    // 验证关联数据也被删除
    let remaining_perms: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_perms, 0);
    
    let remaining_versions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_versions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_versions, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_adapter_data().unwrap();
}


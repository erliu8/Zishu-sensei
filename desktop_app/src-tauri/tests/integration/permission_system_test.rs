//! 权限系统集成测试
//!
//! 测试权限的申请、授予、检查、撤销的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 权限系统测试
// ========================================

/// 测试完整的权限管理流程
/// 流程: 权限申请 → 权限检查 → 权限授予 → 权限验证 → 权限撤销
#[tokio::test]
async fn test_complete_permission_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "test-adapter";
    test_db.insert_test_adapter(adapter_id, "Test Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 适配器请求权限
    let requested_permissions = vec![
        ("network.access", "访问网络资源"),
        ("file.read", "读取本地文件"),
        ("file.write", "写入本地文件"),
        ("clipboard.read", "读取剪贴板"),
    ];
    
    for (perm_type, desc) in &requested_permissions {
        conn.execute(
            "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, description)
             VALUES (?1, ?2, 0, ?3)",
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
    
    // 2. 检查权限状态（未授予）
    let network_granted: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "network.access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(network_granted, 0);
    
    // 3. 用户授予部分权限
    let granted_perms = vec!["network.access", "file.read"];
    
    for perm_type in &granted_perms {
        conn.execute(
            "UPDATE adapter_permissions 
             SET granted = 1, granted_at = ?1 
             WHERE adapter_id = ?2 AND permission_type = ?3",
            rusqlite::params![now, adapter_id, perm_type]
        ).unwrap();
    }
    
    // 4. 验证授予状态
    let granted_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(granted_count, 2);
    
    // 5. 检查特定权限
    let can_access_network: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "network.access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_access_network, 1);
    
    let can_write_file: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "file.write"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_write_file, 0);
    
    // 6. 撤销权限
    conn.execute(
        "UPDATE adapter_permissions 
         SET granted = 0, granted_at = NULL 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "network.access"]
    ).unwrap();
    
    // 7. 验证撤销成功
    let revoked_check: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "network.access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(revoked_check, 0);
    
    // 8. 拒绝权限（删除请求）
    conn.execute(
        "DELETE FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter_id, "clipboard.read"]
    ).unwrap();
    
    // 验证权限已删除
    let remaining_perms: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_perms, 3);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试权限继承和层级
#[tokio::test]
async fn test_permission_hierarchy() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 定义权限层级
    // file.* (父权限)
    //   ├─ file.read
    //   ├─ file.write
    //   └─ file.delete
    
    let permissions = vec![
        ("file", "read", true),   // 授予读权限
        ("file", "write", true),  // 授予写权限
        ("file", "delete", false), // 不授予删除权限
        ("network", "access", true), // 授予网络访问
    ];
    
    for (resource, action, granted) in &permissions {
        conn.execute(
            "INSERT INTO permissions (resource, action, granted, granted_at, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                resource,
                action,
                *granted as i32,
                if *granted { Some(now) } else { None::<i64> },
                format!("Permission for {} on {}", action, resource)
            ]
        ).unwrap();
    }
    
    // 检查文件读权限
    let can_read_file: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["file", "read"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_read_file, 1);
    
    // 检查文件写权限
    let can_write_file: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["file", "write"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_write_file, 1);
    
    // 检查文件删除权限（未授予）
    let can_delete_file: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["file", "delete"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_delete_file, 0);
    
    // 统计文件相关的已授予权限
    let file_perms_granted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM permissions WHERE resource = ?1 AND granted = 1",
        &["file"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(file_perms_granted, 2); // read 和 write
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试多个适配器的权限隔离
#[tokio::test]
async fn test_permission_isolation() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let adapter1_id = "adapter-1";
    let adapter2_id = "adapter-2";
    
    test_db.insert_test_adapter(adapter1_id, "Adapter 1", true).unwrap();
    test_db.insert_test_adapter(adapter2_id, "Adapter 2", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // Adapter 1 请求并获得网络权限
    conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, granted_at)
         VALUES (?1, ?2, 1, ?3)",
        rusqlite::params![adapter1_id, "network.access", now]
    ).unwrap();
    
    // Adapter 2 请求但未获得网络权限
    conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
         VALUES (?1, ?2, 0)",
        rusqlite::params![adapter2_id, "network.access"]
    ).unwrap();
    
    // 验证 Adapter 1 有权限
    let adapter1_has_network: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter1_id, "network.access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(adapter1_has_network, 1);
    
    // 验证 Adapter 2 没有权限
    let adapter2_has_network: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter2_id, "network.access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(adapter2_has_network, 0);
    
    // Adapter 2 获得文件读权限
    conn.execute(
        "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, granted_at)
         VALUES (?1, ?2, 1, ?3)",
        rusqlite::params![adapter2_id, "file.read", now]
    ).unwrap();
    
    // 验证 Adapter 1 没有文件读权限
    let adapter1_file_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter1_id, "file.read"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(adapter1_file_count, 0);
    
    // 验证 Adapter 2 有文件读权限
    let adapter2_has_file: i32 = conn.query_row(
        "SELECT granted FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type = ?2",
        rusqlite::params![adapter2_id, "file.read"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(adapter2_has_file, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试权限审计日志
#[tokio::test]
async fn test_permission_audit_log() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    test_db.init_log_tables().unwrap();
    
    let resource = "sensitive.data";
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 授予权限并记录日志
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, 1, ?3, ?4)",
        rusqlite::params![
            resource,
            "read",
            now,
            "Granted read permission"
        ]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO app_logs (level, message, module, timestamp)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "info",
            format!("Permission granted: {} - read", resource),
            "permission_system",
            now
        ]
    ).unwrap();
    
    // 2. 使用权限并记录
    conn.execute(
        "INSERT INTO app_logs (level, message, module, timestamp)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "info",
            format!("Permission used: {} - read", resource),
            "permission_system",
            now + 1
        ]
    ).unwrap();
    
    // 3. 撤销权限并记录
    conn.execute(
        "UPDATE permissions SET granted = 0, granted_at = NULL 
         WHERE resource = ?1 AND action = ?2",
        rusqlite::params![resource, "read"]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO app_logs (level, message, module, timestamp)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "warn",
            format!("Permission revoked: {} - read", resource),
            "permission_system",
            now + 2
        ]
    ).unwrap();
    
    // 4. 验证审计日志
    let log_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_logs WHERE module = ?1",
        &["permission_system"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(log_count, 3);
    
    // 按时间顺序查询日志
    let mut stmt = conn.prepare(
        "SELECT level, message FROM app_logs 
         WHERE module = ?1 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let logs: Vec<(String, String)> = stmt.query_map(&["permission_system"], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(logs.len(), 3);
    assert_eq!(logs[0].0, "info");
    assert!(logs[0].1.contains("granted"));
    assert_eq!(logs[1].0, "info");
    assert!(logs[1].1.contains("used"));
    assert_eq!(logs[2].0, "warn");
    assert!(logs[2].1.contains("revoked"));
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试临时权限（时间限制）
#[tokio::test]
async fn test_temporary_permissions() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    test_db.init_settings_tables().unwrap();
    
    let resource = "temporary.resource";
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    let expires_at = now + 3600; // 1小时后过期
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 授予临时权限
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, 1, ?3, ?4)",
        rusqlite::params![
            resource,
            "access",
            now,
            format!("Temporary permission, expires at {}", expires_at)
        ]
    ).unwrap();
    
    // 存储过期时间
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            format!("permission.{}.{}.expires_at", resource, "access"),
            expires_at.to_string(),
            "integer",
            now
        ]
    ).unwrap();
    
    // 2. 检查权限（在有效期内）
    let current_time = now + 1800; // 30分钟后
    
    let granted: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params![resource, "access"],
        |row| row.get(0)
    ).unwrap();
    
    let expires: i64 = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        &[format!("permission.{}.{}.expires_at", resource, "access")],
        |row| row.get::<_, String>(0)?.parse().map_err(|_| rusqlite::Error::InvalidQuery)
    ).unwrap();
    
    // 权限仍然有效
    assert_eq!(granted, 1);
    assert!(current_time < expires);
    
    // 3. 检查过期权限
    let expired_time = now + 7200; // 2小时后（已过期）
    assert!(expired_time > expires);
    
    // 在实际应用中，应该自动撤销过期权限
    // 这里手动撤销
    if expired_time > expires {
        conn.execute(
            "UPDATE permissions SET granted = 0, granted_at = NULL 
             WHERE resource = ?1 AND action = ?2",
            rusqlite::params![resource, "access"]
        ).unwrap();
    }
    
    let revoked: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params![resource, "access"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(revoked, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试权限组和批量操作
#[tokio::test]
async fn test_permission_groups() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    test_db.init_adapter_tables().unwrap();
    
    let adapter_id = "group-test-adapter";
    test_db.insert_test_adapter(adapter_id, "Group Test Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 定义权限组
    let file_permissions = vec!["file.read", "file.write", "file.delete"];
    let network_permissions = vec!["network.access", "network.upload", "network.download"];
    
    // 1. 批量授予文件权限组
    for perm in &file_permissions {
        conn.execute(
            "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, granted_at, description)
             VALUES (?1, ?2, 1, ?3, ?4)",
            rusqlite::params![
                adapter_id,
                perm,
                now,
                format!("Part of file permissions group")
            ]
        ).unwrap();
    }
    
    // 验证文件权限组全部授予
    let file_perms_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type LIKE 'file.%' AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(file_perms_count, 3);
    
    // 2. 批量请求网络权限组（未授予）
    for perm in &network_permissions {
        conn.execute(
            "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, description)
             VALUES (?1, ?2, 0, ?3)",
            rusqlite::params![
                adapter_id,
                perm,
                format!("Part of network permissions group")
            ]
        ).unwrap();
    }
    
    // 验证网络权限组未授予
    let network_perms_granted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type LIKE 'network.%' AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(network_perms_granted, 0);
    
    // 3. 批量撤销文件权限组
    conn.execute(
        "UPDATE adapter_permissions 
         SET granted = 0, granted_at = NULL 
         WHERE adapter_id = ?1 AND permission_type LIKE 'file.%'",
        &[adapter_id]
    ).unwrap();
    
    // 验证文件权限组全部撤销
    let file_perms_after_revoke: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type LIKE 'file.%' AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(file_perms_after_revoke, 0);
    
    // 4. 批量授予网络权限组
    conn.execute(
        "UPDATE adapter_permissions 
         SET granted = 1, granted_at = ?1 
         WHERE adapter_id = ?2 AND permission_type LIKE 'network.%'",
        rusqlite::params![now + 1, adapter_id]
    ).unwrap();
    
    // 验证网络权限组全部授予
    let network_perms_final: i64 = conn.query_row(
        "SELECT COUNT(*) FROM adapter_permissions 
         WHERE adapter_id = ?1 AND permission_type LIKE 'network.%' AND granted = 1",
        &[adapter_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(network_perms_final, 3);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试权限依赖关系
#[tokio::test]
async fn test_permission_dependencies() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_permission_tables().unwrap();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 定义权限依赖关系
    // file.write 依赖于 file.read
    // file.delete 依赖于 file.write（因此也间接依赖 file.read）
    
    let dependencies = json!({
        "file.write": ["file.read"],
        "file.delete": ["file.write"]
    });
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "permission.dependencies",
            dependencies.to_string(),
            "json",
            now
        ]
    ).unwrap();
    
    // 1. 尝试授予 file.write 但未授予 file.read（应该检查依赖）
    let has_read_perm: i64 = conn.query_row(
        "SELECT COUNT(*) FROM permissions 
         WHERE resource = ?1 AND action = ?2 AND granted = 1",
        rusqlite::params!["file", "read"],
        |row| row.get(0)
    ).unwrap();
    
    if has_read_perm == 0 {
        // 依赖未满足，应该先授予 file.read
        conn.execute(
            "INSERT INTO permissions (resource, action, granted, granted_at, description)
             VALUES (?1, ?2, 1, ?3, ?4)",
            rusqlite::params![
                "file",
                "read",
                now,
                "Dependency for file.write"
            ]
        ).unwrap();
    }
    
    // 2. 现在可以授予 file.write
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, 1, ?3, ?4)",
        rusqlite::params![
            "file",
            "write",
            now,
            "Write permission"
        ]
    ).unwrap();
    
    // 3. 授予 file.delete（依赖已满足）
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, 1, ?3, ?4)",
        rusqlite::params![
            "file",
            "delete",
            now,
            "Delete permission"
        ]
    ).unwrap();
    
    // 验证所有权限都已授予
    let all_granted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM permissions WHERE resource = ?1 AND granted = 1",
        &["file"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(all_granted, 3);
    
    // 4. 撤销 file.read 应该级联撤销依赖它的权限
    // （在实际应用中需要实现级联逻辑）
    conn.execute(
        "UPDATE permissions SET granted = 0, granted_at = NULL 
         WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["file", "read"]
    ).unwrap();
    
    // 模拟级联撤销
    conn.execute(
        "UPDATE permissions SET granted = 0, granted_at = NULL 
         WHERE resource = ?1 AND action IN ('write', 'delete')",
        &["file"]
    ).unwrap();
    
    // 验证所有权限都被撤销
    let remaining_granted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM permissions WHERE resource = ?1 AND granted = 1",
        &["file"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining_granted, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


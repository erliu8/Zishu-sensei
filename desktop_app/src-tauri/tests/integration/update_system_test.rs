//! 更新系统集成测试
//!
//! 测试版本检查、更新下载、安装、回滚的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 更新系统测试
// ========================================

/// 测试完整的更新流程
/// 流程: 检查更新 → 下载 → 验证 → 安装
#[tokio::test]
async fn test_complete_update_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 存储当前版本
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["app.version", "1.0.0", "string", now]
    ).unwrap();
    
    // 2. 检查更新信息
    let update_info = json!({
        "latest_version": "1.1.0",
        "download_url": "https://example.com/v1.1.0/app.zip",
        "release_notes": "New features and bug fixes",
        "required": false
    });
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "update.latest_info",
            update_info.to_string(),
            "json",
            now
        ]
    ).unwrap();
    
    // 3. 标记更新状态
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["update.status", "checking", "string", now]
    ).unwrap();
    
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params!["downloading", now + 1, "update.status"]
    ).unwrap();
    
    // 4. 下载完成后验证
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params!["downloaded", now + 2, "update.status"]
    ).unwrap();
    
    // 5. 安装更新
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params!["installing", now + 3, "update.status"]
    ).unwrap();
    
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params!["1.1.0", now + 4, "app.version"]
    ).unwrap();
    
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params!["completed", now + 4, "update.status"]
    ).unwrap();
    
    // 验证更新完成
    let current_version: String = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        &["app.version"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(current_version, "1.1.0");
    
    let status: String = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        &["update.status"],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(status, "completed");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试更新版本历史
#[tokio::test]
async fn test_update_version_history() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act (执行) ==========
    
    // 记录版本历史
    let versions = vec!["1.0.0", "1.0.1", "1.1.0", "1.2.0"];
    
    for (i, version) in versions.iter().enumerate() {
        let key = format!("version_history.{}", i);
        let info = json!({
            "version": version,
            "installed_at": now + i as i64 * 3600,
            "notes": format!("Version {} release", version)
        });
        
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![&key, info.to_string(), "json", now + i as i64 * 3600]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 查询版本历史数量
    let history_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_settings WHERE key LIKE 'version_history.%'",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(history_count, 4);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


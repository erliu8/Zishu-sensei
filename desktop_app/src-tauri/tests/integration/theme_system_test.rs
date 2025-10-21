//! 主题系统集成测试
//!
//! 测试主题的加载、应用、切换、持久化的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 主题系统测试
// ========================================

/// 测试完整的主题管理流程
/// 流程: 加载主题 → 应用配置 → 切换主题 → 持久化
#[tokio::test]
async fn test_complete_theme_management() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建多个主题
    let themes = vec![
        ("light", json!({"colors": {"primary": "#ffffff", "text": "#000000"}})),
        ("dark", json!({"colors": {"primary": "#000000", "text": "#ffffff"}})),
        ("anime", json!({"colors": {"primary": "#ff69b4", "text": "#333333"}})),
    ];
    
    for (theme_id, config) in &themes {
        conn.execute(
            "INSERT INTO theme_configs (id, name, config, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                theme_id,
                format!("{} Theme", theme_id),
                config.to_string(),
                0,
                now,
                now
            ]
        ).unwrap();
    }
    
    // 验证主题已创建
    let theme_count = test_db.count_records("theme_configs").unwrap();
    assert_eq!(theme_count, 3);
    
    // 2. 激活一个主题
    conn.execute(
        "UPDATE theme_configs SET is_active = 1 WHERE id = ?1",
        &["light"]
    ).unwrap();
    
    // 验证激活
    let active_theme: String = conn.query_row(
        "SELECT id FROM theme_configs WHERE is_active = 1",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(active_theme, "light");
    
    // 3. 切换主题
    conn.execute("UPDATE theme_configs SET is_active = 0", []).unwrap();
    conn.execute(
        "UPDATE theme_configs SET is_active = 1 WHERE id = ?1",
        &["dark"]
    ).unwrap();
    
    // 验证切换成功
    let new_active: String = conn.query_row(
        "SELECT id FROM theme_configs WHERE is_active = 1",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(new_active, "dark");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试主题配置的更新
#[tokio::test]
async fn test_theme_config_update() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let theme_id = "custom";
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 创建主题
    let initial_config = json!({"colors": {"primary": "#ff0000"}});
    
    conn.execute(
        "INSERT INTO theme_configs (id, name, config, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            theme_id,
            "Custom Theme",
            initial_config.to_string(),
            1,
            now,
            now
        ]
    ).unwrap();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 更新主题配置
    let updated_config = json!({"colors": {"primary": "#00ff00", "secondary": "#0000ff"}});
    
    conn.execute(
        "UPDATE theme_configs SET config = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![updated_config.to_string(), now + 1, theme_id]
    ).unwrap();
    
    // 验证更新
    let stored_config: String = conn.query_row(
        "SELECT config FROM theme_configs WHERE id = ?1",
        &[theme_id],
        |row| row.get(0)
    ).unwrap();
    
    let config_json: serde_json::Value = serde_json::from_str(&stored_config).unwrap();
    assert_eq!(config_json["colors"]["primary"], "#00ff00");
    assert_eq!(config_json["colors"]["secondary"], "#0000ff");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


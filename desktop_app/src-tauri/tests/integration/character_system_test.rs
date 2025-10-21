//! 角色系统集成测试
//!
//! 测试角色的加载、配置、切换、状态管理的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 角色系统测试
// ========================================

/// 测试角色的完整管理流程
/// 流程: 加载角色 → 配置 → 激活 → 切换 → 卸载
#[tokio::test]
async fn test_complete_character_management() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_character_tables().unwrap();
    
    let char1_id = "shizuku";
    let char2_id = "miku";
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 加载多个角色
    test_db.insert_test_character(char1_id, "Shizuku", false).unwrap();
    test_db.insert_test_character(char2_id, "Miku", false).unwrap();
    
    let total_chars = test_db.count_records("characters").unwrap();
    assert_eq!(total_chars, 2);
    
    // 2. 配置第一个角色
    conn.execute(
        "INSERT INTO character_configs (character_id, scale, position_x, position_y, interaction_enabled, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![char1_id, 1.0, 100.0, 100.0, 1, now]
    ).unwrap();
    
    // 3. 激活第一个角色
    conn.execute(
        "UPDATE characters SET is_active = 1 WHERE id = ?1",
        &[char1_id]
    ).unwrap();
    
    let active_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM characters WHERE is_active = 1",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(active_count, 1);
    
    // 4. 切换到第二个角色
    conn.execute("UPDATE characters SET is_active = 0", []).unwrap();
    conn.execute(
        "UPDATE characters SET is_active = 1 WHERE id = ?1",
        &[char2_id]
    ).unwrap();
    
    // 验证切换成功
    let active_char: String = conn.query_row(
        "SELECT id FROM characters WHERE is_active = 1",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(active_char, char2_id);
    
    // 5. 添加角色动作和表情
    conn.execute(
        "INSERT INTO character_motions (character_id, motion_name, motion_group)
         VALUES (?1, ?2, ?3)",
        rusqlite::params![char2_id, "idle", "default"]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO character_expressions (character_id, expression_name)
         VALUES (?1, ?2)",
        rusqlite::params![char2_id, "smile"]
    ).unwrap();
    
    // 验证动作和表情
    let motion_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM character_motions WHERE character_id = ?1",
        &[char2_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(motion_count, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试角色切换流程
#[tokio::test]
async fn test_character_switching() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_character_tables().unwrap();
    
    // 创建3个角色
    let chars = vec!["char1", "char2", "char3"];
    for char_id in &chars {
        test_db.insert_test_character(char_id, &format!("Character {}", char_id), false).unwrap();
    }
    
    let conn = test_db.get_connection();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 依次激活每个角色
    for char_id in &chars {
        // 先停用所有角色
        conn.execute("UPDATE characters SET is_active = 0", []).unwrap();
        
        // 激活当前角色
        conn.execute(
            "UPDATE characters SET is_active = 1 WHERE id = ?1",
            &[char_id]
        ).unwrap();
        
        // 验证只有一个角色被激活
        let active_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM characters WHERE is_active = 1",
            [],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(active_count, 1);
        
        // 验证是正确的角色
        let active_id: String = conn.query_row(
            "SELECT id FROM characters WHERE is_active = 1",
            [],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(active_id, *char_id);
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试角色动作和表情管理
#[tokio::test]
async fn test_character_motions_and_expressions() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_character_tables().unwrap();
    
    let char_id = "test_char";
    test_db.insert_test_character(char_id, "Test Character", true).unwrap();
    
    let conn = test_db.get_connection();
    
    // ========== Act (执行) ==========
    
    // 添加多个动作
    let motions = vec![
        ("idle", "default"),
        ("walk", "default"),
        ("run", "default"),
        ("wave", "greetings"),
        ("bow", "greetings"),
    ];
    
    for (motion, group) in &motions {
        conn.execute(
            "INSERT INTO character_motions (character_id, motion_name, motion_group)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![char_id, motion, group]
        ).unwrap();
    }
    
    // 添加多个表情
    let expressions = vec!["normal", "smile", "angry", "sad", "surprised"];
    
    for expr in &expressions {
        conn.execute(
            "INSERT INTO character_expressions (character_id, expression_name)
             VALUES (?1, ?2)",
            rusqlite::params![char_id, expr]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证动作数量
    let motion_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM character_motions WHERE character_id = ?1",
        &[char_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(motion_count, 5);
    
    // 按组查询动作
    let default_motions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM character_motions WHERE character_id = ?1 AND motion_group = 'default'",
        &[char_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(default_motions, 3);
    
    // 验证表情数量
    let expr_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM character_expressions WHERE character_id = ?1",
        &[char_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(expr_count, 5);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


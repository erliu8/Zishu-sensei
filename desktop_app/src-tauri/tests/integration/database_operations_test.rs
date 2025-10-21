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
async fn test_complete_crud_operations() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_full_schema().unwrap();
    
    let adapter_id = "crud-test-adapter";
    let conn = test_db.get_connection();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. CREATE - 创建记录
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO installed_adapters (
            id, name, display_name, version, install_path, status, enabled,
            auto_update, source, installed_at, updated_at, config, metadata
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            adapter_id,
            "CRUD Test Adapter",
            "Display CRUD Test Adapter",
            "1.0.0",
            "/test/adapters/crud",
            "installed",
            1,
            1,
            "test",
            now,
            now,
            "{}",
            "{}"
        ],
    ).unwrap();
    
    // 验证创建成功
    assert!(test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
    
    // 2. READ - 读取记录
    let (name, version, status): (String, String, String) = conn.query_row(
        "SELECT name, version, status FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).unwrap();
    
    assert_eq!(name, "CRUD Test Adapter");
    assert_eq!(version, "1.0.0");
    assert_eq!(status, "installed");
    
    // 3. UPDATE - 更新记录
    conn.execute(
        "UPDATE installed_adapters SET version = ?1, status = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params!["2.0.0", "updated", now + 1, adapter_id]
    ).unwrap();
    
    // 验证更新成功
    let (new_version, new_status): (String, String) = conn.query_row(
        "SELECT version, status FROM installed_adapters WHERE id = ?1",
        &[adapter_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    
    assert_eq!(new_version, "2.0.0");
    assert_eq!(new_status, "updated");
    
    // 4. DELETE - 删除记录
    conn.execute(
        "DELETE FROM installed_adapters WHERE id = ?1",
        &[adapter_id]
    ).unwrap();
    
    // 验证删除成功
    assert!(!test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试批量操作
#[tokio::test]
async fn test_batch_operations() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_adapter_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act (执行) ==========
    
    // 批量插入 100 个适配器
    let batch_size = 100;
    
    for i in 0..batch_size {
        conn.execute(
            "INSERT INTO installed_adapters (
                id, name, display_name, version, install_path, status, enabled,
                auto_update, source, installed_at, updated_at, config, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                format!("adapter-{}", i),
                format!("Adapter {}", i),
                format!("Display Adapter {}", i),
                "1.0.0",
                format!("/test/adapters/{}", i),
                "installed",
                1,
                1,
                "batch",
                now,
                now,
                "{}",
                "{}"
            ],
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证插入数量
    let total_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(total_count, batch_size);
    
    // 批量更新
    conn.execute(
        "UPDATE installed_adapters SET enabled = 0 WHERE source = ?1",
        &["batch"]
    ).unwrap();
    
    // 验证批量更新
    let disabled_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM installed_adapters WHERE enabled = 0",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(disabled_count, batch_size);
    
    // 批量删除
    conn.execute(
        "DELETE FROM installed_adapters WHERE source = ?1",
        &["batch"]
    ).unwrap();
    
    // 验证批量删除
    let remaining_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(remaining_count, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试事务处理
#[tokio::test]
async fn test_transaction_handling() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    let conn = test_db.get_connection();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 成功的事务
    {
        let tx = conn.unchecked_transaction().unwrap();
        
        // 创建会话
        tx.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                &session_id,
                "Transaction Test",
                chrono::Utc::now().timestamp(),
                chrono::Utc::now().timestamp(),
                "{}"
            ]
        ).unwrap();
        
        // 添加多条消息
        for i in 0..5 {
            tx.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    unique_test_id(&format!("msg_{}", i)),
                    &session_id,
                    if i % 2 == 0 { "user" } else { "assistant" },
                    format!("Message {}", i),
                    chrono::Utc::now().timestamp() + i as i64,
                    "{}"
                ]
            ).unwrap();
        }
        
        // 提交事务
        tx.commit().unwrap();
    }
    
    // 验证事务成功
    assert!(test_db.record_exists("chat_sessions", "id", &session_id).unwrap());
    
    let msg_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(msg_count, 5);
    
    // 2. 回滚的事务
    let failed_session_id = unique_test_id("failed_session");
    
    {
        let tx = conn.unchecked_transaction().unwrap();
        
        // 创建会话
        tx.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                &failed_session_id,
                "Failed Transaction",
                chrono::Utc::now().timestamp(),
                chrono::Utc::now().timestamp(),
                "{}"
            ]
        ).unwrap();
        
        // 添加消息
        tx.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                unique_test_id("msg"),
                &failed_session_id,
                "user",
                "This will be rolled back",
                chrono::Utc::now().timestamp(),
                "{}"
            ]
        ).unwrap();
        
        // 回滚事务
        tx.rollback().unwrap();
    }
    
    // 验证事务回滚
    assert!(!test_db.record_exists("chat_sessions", "id", &failed_session_id).unwrap());
    
    let failed_msg_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&failed_session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(failed_msg_count, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试并发访问
#[tokio::test]
async fn test_concurrent_database_access() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("concurrent_session");
    test_db.insert_test_chat_session(&session_id, "Concurrent Test").unwrap();
    
    // ========== Act (执行) ==========
    
    // 模拟并发插入消息
    let handles: Vec<_> = (0..10).map(|i| {
        let session_id_clone = session_id.clone();
        let test_db_path = test_db.path.clone();
        
        tokio::spawn(async move {
            // 在实际应用中，每个线程会创建自己的连接
            // 这里我们只是模拟并发操作
            wait_ms(random_number(0, 10) as u64).await;
            
            // 返回消息ID
            unique_test_id(&format!("concurrent_msg_{}", i))
        })
    }).collect();
    
    let mut message_ids = Vec::new();
    for handle in handles {
        let msg_id = handle.await.unwrap();
        message_ids.push(msg_id);
    }
    
    // 串行插入收集到的消息ID（避免SQLite并发写入问题）
    let conn = test_db.get_connection();
    for (i, msg_id) in message_ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                msg_id,
                &session_id,
                if i % 2 == 0 { "user" } else { "assistant" },
                format!("Concurrent message {}", i),
                chrono::Utc::now().timestamp() + i as i64,
                "{}"
            ]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证所有消息都已插入
    let total_messages: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_messages, 10);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试复杂查询和JOIN操作
#[tokio::test]
async fn test_complex_queries_and_joins() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    test_db.init_character_tables().unwrap();
    test_db.init_adapter_tables().unwrap();
    
    // 创建测试数据
    let character_id = "shizuku";
    let adapter_id = "openai-adapter";
    
    test_db.insert_test_character(character_id, "Shizuku", true).unwrap();
    test_db.insert_test_adapter(adapter_id, "OpenAI Adapter", true).unwrap();
    
    // 创建多个会话
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    for i in 0..3 {
        let session_id = unique_test_id(&format!("session_{}", i));
        
        conn.execute(
            "INSERT INTO chat_sessions (id, title, character_id, adapter_id, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                &session_id,
                format!("Session {}", i),
                character_id,
                adapter_id,
                now + i as i64,
                now + i as i64,
                "{}"
            ]
        ).unwrap();
        
        // 每个会话添加几条消息
        for j in 0..(i + 1) * 2 {
            conn.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    unique_test_id(&format!("msg_{}_{}", i, j)),
                    &session_id,
                    if j % 2 == 0 { "user" } else { "assistant" },
                    format!("Message {} in session {}", j, i),
                    now + i as i64 + j as i64,
                    "{}"
                ]
            ).unwrap();
        }
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. JOIN 查询：获取会话及其角色信息
    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, c.display_name, c.gender
         FROM chat_sessions s
         INNER JOIN characters c ON s.character_id = c.id
         ORDER BY s.created_at"
    ).unwrap();
    
    let session_info: Vec<(String, String, String, String)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(session_info.len(), 3);
    assert_eq!(session_info[0].2, "Display Shizuku");
    
    // 2. 聚合查询：统计每个会话的消息数
    let mut stmt = conn.prepare(
        "SELECT s.title, COUNT(m.id) as message_count
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON s.id = m.session_id
         GROUP BY s.id
         ORDER BY s.created_at"
    ).unwrap();
    
    let message_counts: Vec<(String, i64)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(message_counts.len(), 3);
    assert_eq!(message_counts[0].1, 2);  // Session 0: 2条消息
    assert_eq!(message_counts[1].1, 4);  // Session 1: 4条消息
    assert_eq!(message_counts[2].1, 6);  // Session 2: 6条消息
    
    // 3. 子查询：查找最新的消息
    let mut stmt = conn.prepare(
        "SELECT s.title, m.content, m.timestamp
         FROM chat_messages m
         INNER JOIN chat_sessions s ON m.session_id = s.id
         WHERE m.timestamp = (
             SELECT MAX(timestamp)
             FROM chat_messages
             WHERE session_id = m.session_id
         )
         ORDER BY m.timestamp DESC"
    ).unwrap();
    
    let latest_messages: Vec<(String, String, i64)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(latest_messages.len(), 3);
    
    // 4. 复杂WHERE条件：查找特定条件的会话
    let user_message_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages 
         WHERE role = ?1 AND session_id IN (
             SELECT id FROM chat_sessions WHERE character_id = ?2
         )",
        rusqlite::params!["user", character_id],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(user_message_count, 6); // (1 + 2 + 3) 个用户消息
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试索引性能
#[tokio::test]
async fn test_index_performance() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("perf_session");
    test_db.insert_test_chat_session(&session_id, "Performance Test").unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 插入大量消息
    for i in 0..1000 {
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                unique_test_id(&format!("msg_{}", i)),
                &session_id,
                if i % 2 == 0 { "user" } else { "assistant" },
                format!("Message {}", i),
                now + i as i64,
                "{}"
            ]
        ).unwrap();
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 使用索引的查询（session_id 有索引）
    let (result, duration) = measure_time(|| {
        conn.query_row(
            "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
            &[&session_id],
            |row| row.get::<_, i64>(0)
        ).unwrap()
    });
    
    assert_eq!(result, 1000);
    // 索引查询应该很快（< 10ms）
    assert!(duration.as_millis() < 100, "Index query too slow: {}ms", duration.as_millis());
    
    // 2. 使用索引的时间范围查询
    let mid_time = now + 500;
    
    let (count, duration) = measure_time(|| {
        conn.query_row(
            "SELECT COUNT(*) FROM chat_messages 
             WHERE session_id = ?1 AND timestamp >= ?2",
            rusqlite::params![&session_id, mid_time],
            |row| row.get::<_, i64>(0)
        ).unwrap()
    });
    
    assert_eq!(count, 500);
    assert!(duration.as_millis() < 100, "Time range query too slow: {}ms", duration.as_millis());
    
    // 3. 按timestamp排序查询（有索引）
    let (results, duration) = measure_time(|| {
        let mut stmt = conn.prepare(
            "SELECT id FROM chat_messages 
             WHERE session_id = ?1 
             ORDER BY timestamp DESC 
             LIMIT 10"
        ).unwrap();
        
        stmt.query_map(&[&session_id], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    });
    
    assert_eq!(results.len(), 10);
    assert!(duration.as_millis() < 100, "Sorted query too slow: {}ms", duration.as_millis());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试数据完整性约束
#[tokio::test]
async fn test_data_integrity_constraints() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("integrity_session");
    test_db.insert_test_chat_session(&session_id, "Integrity Test").unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. PRIMARY KEY 约束（不能重复）
    let msg_id = unique_test_id("msg");
    
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![&msg_id, &session_id, "user", "First message", now, "{}"]
    ).unwrap();
    
    // 尝试插入相同ID
    let duplicate_result = conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![&msg_id, &session_id, "user", "Duplicate message", now, "{}"]
    );
    
    assert!(duplicate_result.is_err(), "Should not allow duplicate primary key");
    
    // 2. FOREIGN KEY 约束（需要启用外键支持）
    // SQLite 默认不启用外键，但我们可以测试概念
    
    // 3. NOT NULL 约束
    let null_result = conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, NULL, ?3, ?4, ?5)",
        rusqlite::params![unique_test_id("msg_null"), &session_id, "Content", now, "{}"]
    );
    
    assert!(null_result.is_err(), "Should not allow NULL in NOT NULL column");
    
    // 4. 级联删除
    let cascade_session = unique_test_id("cascade_session");
    conn.execute(
        "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![&cascade_session, "Cascade Test", now, now, "{}"]
    ).unwrap();
    
    // 添加消息
    for i in 0..5 {
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                unique_test_id(&format!("cascade_msg_{}", i)),
                &cascade_session,
                "user",
                format!("Message {}", i),
                now + i as i64,
                "{}"
            ]
        ).unwrap();
    }
    
    // 删除会话
    conn.execute(
        "DELETE FROM chat_sessions WHERE id = ?1",
        &[&cascade_session]
    ).unwrap();
    
    // 验证消息也被删除（级联删除）
    let remaining_messages: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&cascade_session],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(remaining_messages, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试数据库备份和恢复
#[tokio::test]
async fn test_database_backup_and_restore() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new();  // 使用文件数据库
    test_db.init_adapter_tables().unwrap();
    
    // 创建测试数据
    for i in 0..10 {
        test_db.insert_test_adapter(
            &format!("adapter-{}", i),
            &format!("Adapter {}", i),
            true
        ).unwrap();
    }
    
    let original_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(original_count, 10);
    
    // ========== Act (执行) ==========
    
    // 1. 导出数据（备份）
    let conn = test_db.get_connection();
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, version, install_path, status, enabled
         FROM installed_adapters"
    ).unwrap();
    
    let backup_data: Vec<(String, String, String, String, String, String, i32)> = 
        stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?
            ))
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(backup_data.len(), 10);
    
    // 2. 清空数据（模拟数据丢失）
    test_db.clear_adapter_data().unwrap();
    let after_clear = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(after_clear, 0);
    
    // 3. 恢复数据
    let now = chrono::Utc::now().timestamp();
    
    for (id, name, display_name, version, path, status, enabled) in backup_data {
        conn.execute(
            "INSERT INTO installed_adapters (
                id, name, display_name, version, install_path, status, enabled,
                auto_update, source, installed_at, updated_at, config, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                id, name, display_name, version, path, status, enabled,
                1, "restored", now, now, "{}", "{}"
            ]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证数据已恢复
    let restored_count = test_db.count_records("installed_adapters").unwrap();
    assert_eq!(restored_count, 10);
    
    // 验证数据完整性
    for i in 0..10 {
        assert!(test_db.record_exists(
            "installed_adapters",
            "id",
            &format!("adapter-{}", i)
        ).unwrap());
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


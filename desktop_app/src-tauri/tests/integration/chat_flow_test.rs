//! 聊天完整流程集成测试
//!
//! 测试聊天从创建会话、发送消息、处理响应到存储的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 聊天流程测试
// ========================================

/// 测试完整的聊天对话流程
/// 流程: 创建会话 → 发送消息 → 接收响应 → 存储历史 → 查询历史
#[tokio::test]
async fn test_complete_chat_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    test_db.init_character_tables().unwrap();
    test_db.init_adapter_tables().unwrap();
    
    let session_id = unique_test_id("session");
    let character_id = "shizuku";
    let adapter_id = "openai-adapter";
    
    // 准备角色和适配器
    test_db.insert_test_character(character_id, "Shizuku", true).unwrap();
    test_db.insert_test_adapter(adapter_id, "OpenAI Adapter", true).unwrap();
    
    let conn = test_db.get_connection();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建聊天会话
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO chat_sessions (id, title, character_id, adapter_id, created_at, updated_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            &session_id,
            "Test Chat Session",
            character_id,
            adapter_id,
            now,
            now,
            "{}"
        ]
    ).unwrap();
    
    // 验证会话创建成功
    assert!(test_db.record_exists("chat_sessions", "id", &session_id).unwrap());
    
    // 2. 发送用户消息
    let user_msg_id = unique_test_id("msg");
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &user_msg_id,
            &session_id,
            "user",
            "你好，今天天气怎么样？",
            now,
            "{}"
        ]
    ).unwrap();
    
    // 3. 生成系统消息（上下文）
    let system_msg_id = unique_test_id("msg");
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &system_msg_id,
            &session_id,
            "system",
            "你是一个友善的助手。",
            now - 1,
            "{}"
        ]
    ).unwrap();
    
    // 4. 添加助手响应
    let assistant_msg_id = unique_test_id("msg");
    let response_time = now + 2;
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &assistant_msg_id,
            &session_id,
            "assistant",
            "今天天气晴朗，阳光明媚！",
            response_time,
            json!({"tokens": 15, "model": "gpt-4"}).to_string()
        ]
    ).unwrap();
    
    // 5. 更新会话的更新时间
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![response_time, &session_id]
    ).unwrap();
    
    // ========== Assert (断言) ==========
    
    // 验证消息数量
    let message_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(message_count, 3);
    
    // 验证消息顺序（按时间排序）
    let mut stmt = conn.prepare(
        "SELECT role, content FROM chat_messages 
         WHERE session_id = ?1 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let messages: Vec<(String, String)> = stmt.query_map(&[&session_id], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(messages.len(), 3);
    assert_eq!(messages[0].0, "system");
    assert_eq!(messages[1].0, "user");
    assert_eq!(messages[2].0, "assistant");
    
    // 验证最后一条消息
    let last_message: String = conn.query_row(
        "SELECT content FROM chat_messages 
         WHERE session_id = ?1 
         ORDER BY timestamp DESC 
         LIMIT 1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(last_message, "今天天气晴朗，阳光明媚！");
    
    // 验证会话的更新时间
    let session_updated: i64 = conn.query_row(
        "SELECT updated_at FROM chat_sessions WHERE id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(session_updated, response_time);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试多轮对话流程
#[tokio::test]
async fn test_multi_turn_conversation() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    let mut current_time = chrono::Utc::now().timestamp();
    
    // 创建会话
    test_db.insert_test_chat_session(&session_id, "Multi-turn Chat").unwrap();
    
    let conn = test_db.get_connection();
    
    // ========== Act (执行) ==========
    
    // 模拟 5 轮对话
    let conversations = vec![
        ("user", "什么是 Rust？"),
        ("assistant", "Rust 是一种系统编程语言。"),
        ("user", "它有什么特点？"),
        ("assistant", "Rust 具有内存安全、零成本抽象等特点。"),
        ("user", "谢谢！"),
        ("assistant", "不客气！有其他问题随时问我。"),
    ];
    
    for (role, content) in conversations {
        let msg_id = unique_test_id("msg");
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                &msg_id,
                &session_id,
                role,
                content,
                current_time,
                "{}"
            ]
        ).unwrap();
        current_time += 1;
    }
    
    // ========== Assert (断言) ==========
    
    // 验证消息总数
    let total_messages: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_messages, 6);
    
    // 验证用户消息数量
    let user_messages: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1 AND role = 'user'",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(user_messages, 3);
    
    // 验证助手消息数量
    let assistant_messages: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1 AND role = 'assistant'",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(assistant_messages, 3);
    
    // 获取对话历史
    let mut stmt = conn.prepare(
        "SELECT role FROM chat_messages 
         WHERE session_id = ?1 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let roles: Vec<String> = stmt.query_map(&[&session_id], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    // 验证对话轮次交替
    for i in 0..roles.len() {
        if i % 2 == 0 {
            assert_eq!(roles[i], "user");
        } else {
            assert_eq!(roles[i], "assistant");
        }
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试多个并发会话
#[tokio::test]
async fn test_concurrent_chat_sessions() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    // ========== Act (执行) ==========
    
    // 创建 3 个并发会话
    let session_ids: Vec<String> = (0..3)
        .map(|i| unique_test_id(&format!("session_{}", i)))
        .collect();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    for (i, session_id) in session_ids.iter().enumerate() {
        // 创建会话
        conn.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                session_id,
                format!("Session {}", i),
                now,
                now,
                "{}"
            ]
        ).unwrap();
        
        // 每个会话添加不同数量的消息
        for j in 0..(i + 1) * 2 {
            let msg_id = unique_test_id(&format!("msg_{}_{}", i, j));
            let role = if j % 2 == 0 { "user" } else { "assistant" };
            
            conn.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    &msg_id,
                    session_id,
                    role,
                    format!("Message {} in session {}", j, i),
                    now + j as i64,
                    "{}"
                ]
            ).unwrap();
        }
    }
    
    // ========== Assert (断言) ==========
    
    // 验证会话数量
    let session_count = test_db.count_records("chat_sessions").unwrap();
    assert_eq!(session_count, 3);
    
    // 验证每个会话的消息数量
    for (i, session_id) in session_ids.iter().enumerate() {
        let msg_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
            &[session_id],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(msg_count as usize, (i + 1) * 2);
    }
    
    // 验证总消息数
    let total_messages = test_db.count_records("chat_messages").unwrap();
    assert_eq!(total_messages, 2 + 4 + 6); // 12条消息
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试聊天历史的分页查询
#[tokio::test]
async fn test_chat_history_pagination() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    test_db.insert_test_chat_session(&session_id, "Paginated Chat").unwrap();
    
    let conn = test_db.get_connection();
    let base_time = chrono::Utc::now().timestamp();
    
    // 插入 50 条消息
    for i in 0..50 {
        let msg_id = unique_test_id(&format!("msg_{}", i));
        let role = if i % 2 == 0 { "user" } else { "assistant" };
        
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                &msg_id,
                &session_id,
                role,
                format!("Message {}", i),
                base_time + i,
                "{}"
            ]
        ).unwrap();
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 分页查询：每页 10 条
    let page_size = 10;
    
    for page in 0..5 {
        let offset = page * page_size;
        
        let mut stmt = conn.prepare(
            "SELECT content FROM chat_messages 
             WHERE session_id = ?1 
             ORDER BY timestamp ASC 
             LIMIT ?2 OFFSET ?3"
        ).unwrap();
        
        let messages: Vec<String> = stmt.query_map(
            rusqlite::params![&session_id, page_size, offset],
            |row| row.get(0)
        ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        
        assert_eq!(messages.len(), 10);
        
        // 验证消息内容
        for (i, content) in messages.iter().enumerate() {
            assert_eq!(content, &format!("Message {}", offset + i));
        }
    }
    
    // 查询最新的 20 条消息（倒序）
    let mut stmt = conn.prepare(
        "SELECT content FROM chat_messages 
         WHERE session_id = ?1 
         ORDER BY timestamp DESC 
         LIMIT 20"
    ).unwrap();
    
    let recent_messages: Vec<String> = stmt.query_map(&[&session_id], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(recent_messages.len(), 20);
    assert_eq!(recent_messages[0], "Message 49"); // 最新的消息
    assert_eq!(recent_messages[19], "Message 30");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试聊天会话的删除（级联删除消息）
#[tokio::test]
async fn test_chat_session_cascade_delete() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    test_db.insert_test_chat_session(&session_id, "Delete Test").unwrap();
    
    // 添加一些消息
    let conn = test_db.get_connection();
    for i in 0..10 {
        test_db.insert_test_chat_message(
            &unique_test_id(&format!("msg_{}", i)),
            &session_id,
            if i % 2 == 0 { "user" } else { "assistant" },
            &format!("Message {}", i)
        ).unwrap();
    }
    
    // ========== Act (执行) ==========
    
    // 验证消息已创建
    let msg_count_before: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(msg_count_before, 10);
    
    // 删除会话
    conn.execute(
        "DELETE FROM chat_sessions WHERE id = ?1",
        &[&session_id]
    ).unwrap();
    
    // ========== Assert (断言) ==========
    
    // 验证会话已删除
    assert!(!test_db.record_exists("chat_sessions", "id", &session_id).unwrap());
    
    // 验证消息也被级联删除
    let msg_count_after: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(msg_count_after, 0);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试聊天元数据的存储和检索
#[tokio::test]
async fn test_chat_metadata_storage() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 创建会话，带有元数据
    let session_metadata = json!({
        "tags": ["important", "work"],
        "language": "zh-CN",
        "context": {
            "project": "zishu-sensei",
            "category": "technical-support"
        }
    });
    
    conn.execute(
        "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            &session_id,
            "Metadata Test Session",
            now,
            now,
            session_metadata.to_string()
        ]
    ).unwrap();
    
    // 添加消息，带有元数据
    let msg_id = unique_test_id("msg");
    let message_metadata = json!({
        "tokens": 150,
        "model": "gpt-4",
        "temperature": 0.7,
        "finish_reason": "stop",
        "latency_ms": 1250
    });
    
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &msg_id,
            &session_id,
            "assistant",
            "Response with metadata",
            now,
            message_metadata.to_string()
        ]
    ).unwrap();
    
    // 验证会话元数据
    let saved_session_metadata: String = conn.query_row(
        "SELECT metadata FROM chat_sessions WHERE id = ?1",
        &[&session_id],
        |row| row.get(0)
    ).unwrap();
    
    let parsed_session_meta: serde_json::Value = 
        serde_json::from_str(&saved_session_metadata).unwrap();
    assert_eq!(parsed_session_meta["language"], "zh-CN");
    assert_eq!(parsed_session_meta["context"]["project"], "zishu-sensei");
    
    // 验证消息元数据
    let saved_message_metadata: String = conn.query_row(
        "SELECT metadata FROM chat_messages WHERE id = ?1",
        &[&msg_id],
        |row| row.get(0)
    ).unwrap();
    
    let parsed_msg_meta: serde_json::Value = 
        serde_json::from_str(&saved_message_metadata).unwrap();
    assert_eq!(parsed_msg_meta["tokens"], 150);
    assert_eq!(parsed_msg_meta["model"], "gpt-4");
    assert_eq!(parsed_msg_meta["latency_ms"], 1250);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}

/// 测试聊天搜索功能
#[tokio::test]
async fn test_chat_message_search() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_chat_tables().unwrap();
    
    let session_id = unique_test_id("session");
    test_db.insert_test_chat_session(&session_id, "Search Test").unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 添加多条消息
    let messages = vec![
        "如何学习 Rust 编程语言？",
        "Rust 是一种系统编程语言，具有内存安全特性。",
        "Python 和 Rust 有什么区别？",
        "Rust 使用所有权系统来管理内存，而 Python 使用垃圾回收。",
        "谢谢你的解释！",
    ];
    
    for (i, content) in messages.iter().enumerate() {
        let msg_id = unique_test_id(&format!("msg_{}", i));
        let role = if i % 2 == 0 { "user" } else { "assistant" };
        
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                &msg_id,
                &session_id,
                role,
                content,
                now + i as i64,
                "{}"
            ]
        ).unwrap();
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 搜索包含 "Rust" 的消息
    let mut stmt = conn.prepare(
        "SELECT content FROM chat_messages 
         WHERE session_id = ?1 AND content LIKE ?2 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let rust_messages: Vec<String> = stmt.query_map(
        rusqlite::params![&session_id, "%Rust%"],
        |row| row.get(0)
    ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(rust_messages.len(), 3);
    assert!(rust_messages[0].contains("Rust"));
    assert!(rust_messages[1].contains("Rust"));
    assert!(rust_messages[2].contains("Rust"));
    
    // 搜索用户消息
    let mut stmt = conn.prepare(
        "SELECT content FROM chat_messages 
         WHERE session_id = ?1 AND role = 'user' 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let user_messages: Vec<String> = stmt.query_map(&[&session_id], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(user_messages.len(), 3);
    
    // 按时间范围搜索
    let time_threshold = now + 2;
    let mut stmt = conn.prepare(
        "SELECT content FROM chat_messages 
         WHERE session_id = ?1 AND timestamp >= ?2 
         ORDER BY timestamp ASC"
    ).unwrap();
    
    let recent_messages: Vec<String> = stmt.query_map(
        rusqlite::params![&session_id, time_threshold],
        |row| row.get(0)
    ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(recent_messages.len(), 3); // 最后3条消息
    
    // ========== Cleanup (清理) ==========
    test_db.clear_chat_data().unwrap();
}


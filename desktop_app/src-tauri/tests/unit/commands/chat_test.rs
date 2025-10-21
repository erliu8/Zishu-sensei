//! 聊天相关命令测试
//!
//! 测试所有聊天相关的Tauri命令

#[cfg(test)]
mod chat_commands_tests {
    use crate::common::*;
    
    // ================================
    // send_message 命令测试
    // ================================
    
    mod send_message {
        use super::*;
        
        #[tokio::test]
        async fn test_send_message_creates_message() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().expect("Failed to init chat tables");
            
            let session_id = "session-001";
            test_db.insert_test_chat_session(session_id, "Test Session").unwrap();
            
            let message_id = unique_test_id("msg");
            let content = "Hello, AI!";
            
            // ========== Act (执行) ==========
            test_db.insert_test_chat_message(&message_id, session_id, "user", content).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("chat_messages", "id", &message_id).unwrap());
            
            let retrieved_content: String = test_db.get_connection()
                .query_row(
                    "SELECT content FROM chat_messages WHERE id = ?1",
                    [&message_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(retrieved_content, content, "消息内容应该正确");
        }
        
        #[tokio::test]
        async fn test_send_message_with_empty_content() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = "session-002";
            test_db.insert_test_chat_session(session_id, "Empty Test").unwrap();
            
            let message_id = unique_test_id("msg");
            
            // ========== Act (执行) ==========
            test_db.insert_test_chat_message(&message_id, session_id, "user", "").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("chat_messages", "id", &message_id).unwrap());
        }
    }
    
    // ================================
    // get_chat_history 命令测试
    // ================================
    
    mod get_chat_history {
        use super::*;
        
        #[tokio::test]
        async fn test_get_chat_history_returns_all_messages() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = "history-session";
            test_db.insert_test_chat_session(session_id, "History Test").unwrap();
            
            // 插入多条消息
            for i in 0..5 {
                let msg_id = format!("msg-{}", i);
                test_db.insert_test_chat_message(&msg_id, session_id, "user", &format!("Message {}", i)).unwrap();
            }
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
                    [session_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 5, "应该有5条历史消息");
        }
        
        #[tokio::test]
        async fn test_get_chat_history_orders_by_timestamp() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = "ordered-session";
            test_db.insert_test_chat_session(session_id, "Order Test").unwrap();
            
            test_db.insert_test_chat_message("msg-1", session_id, "user", "First").unwrap();
            wait_briefly().await;
            test_db.insert_test_chat_message("msg-2", session_id, "assistant", "Second").unwrap();
            wait_briefly().await;
            test_db.insert_test_chat_message("msg-3", session_id, "user", "Third").unwrap();
            
            // ========== Act (执行) ==========
            let mut stmt = test_db.get_connection()
                .prepare("SELECT content FROM chat_messages WHERE session_id = ?1 ORDER BY timestamp ASC")
                .unwrap();
            
            let messages: Vec<String> = stmt
                .query_map([session_id], |row| row.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();
            
            // ========== Assert (断言) ==========
            assert_eq!(messages, vec!["First", "Second", "Third"], "消息应该按时间顺序排列");
        }
    }
    
    // ================================
    // clear_chat_history 命令测试
    // ================================
    
    mod clear_chat_history {
        use super::*;
        
        #[tokio::test]
        async fn test_clear_chat_history_deletes_all_messages() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = "clear-session";
            test_db.insert_test_chat_session(session_id, "Clear Test").unwrap();
            
            test_db.insert_test_chat_message("msg-1", session_id, "user", "Message 1").unwrap();
            test_db.insert_test_chat_message("msg-2", session_id, "user", "Message 2").unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("DELETE FROM chat_messages WHERE session_id = ?1", [session_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
                    [session_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(count, 0, "所有消息应该已被清除");
        }
        
        #[tokio::test]
        async fn test_clear_chat_history_keeps_other_sessions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session1 = "session-1";
            let session2 = "session-2";
            
            test_db.insert_test_chat_session(session1, "Session 1").unwrap();
            test_db.insert_test_chat_session(session2, "Session 2").unwrap();
            
            test_db.insert_test_chat_message("msg-1", session1, "user", "Session 1 msg").unwrap();
            test_db.insert_test_chat_message("msg-2", session2, "user", "Session 2 msg").unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("DELETE FROM chat_messages WHERE session_id = ?1", [session1])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let session1_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1", [session1], |row| row.get(0))
                .unwrap();
            
            let session2_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1", [session2], |row| row.get(0))
                .unwrap();
            
            assert_eq!(session1_count, 0, "Session 1消息应该已清除");
            assert_eq!(session2_count, 1, "Session 2消息应该保留");
        }
    }
    
    // ================================
    // create_session 命令测试
    // ================================
    
    mod create_session {
        use super::*;
        
        #[tokio::test]
        async fn test_create_session_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = unique_test_id("session");
            let title = "New Chat Session";
            
            // ========== Act (执行) ==========
            test_db.insert_test_chat_session(&session_id, title).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("chat_sessions", "id", &session_id).unwrap());
            
            let retrieved_title: String = test_db.get_connection()
                .query_row(
                    "SELECT title FROM chat_sessions WHERE id = ?1",
                    [&session_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(retrieved_title, title);
        }
    }
    
    // ================================
    // delete_session 命令测试
    // ================================
    
    mod delete_session {
        use super::*;
        
        #[tokio::test]
        async fn test_delete_session_removes_session_and_messages() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_chat_tables().unwrap();
            
            let session_id = "deletable-session";
            test_db.insert_test_chat_session(session_id, "To Delete").unwrap();
            test_db.insert_test_chat_message("msg-1", session_id, "user", "Message").unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("DELETE FROM chat_sessions WHERE id = ?1", [session_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!test_db.record_exists("chat_sessions", "id", session_id).unwrap());
            
            let message_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1", [session_id], |row| row.get(0))
                .unwrap();
            
            assert_eq!(message_count, 0, "级联删除应该清除所有消息");
        }
    }
}


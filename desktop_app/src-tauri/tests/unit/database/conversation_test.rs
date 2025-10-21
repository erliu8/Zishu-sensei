//! 对话历史数据库测试
//!
//! 测试对话历史管理的所有功能，包括：
//! - 对话会话管理
//! - 消息的CRUD操作
//! - 对话搜索
//! - 对话统计
//! - 对话归档

use zishu_sensei::database::conversation::{
    ConversationHistory, Conversation, Message, MessageRole,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;

// ========== 辅助函数 ==========

fn setup_test_history() -> ConversationHistory {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let history = ConversationHistory::new(conn);
    history.init_tables().expect("无法初始化数据库表");
    history
}

fn create_test_conversation(id: &str) -> Conversation {
    Conversation {
        id: id.to_string(),
        title: format!("对话 {}", id),
        summary: Some(format!("这是测试对话 {}", id)),
        character_id: Some("hiyori".to_string()),
        context: serde_json::json!({"mood": "happy"}),
        message_count: 0,
        is_archived: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_message_at: None,
    }
}

fn create_test_message(conversation_id: &str, order: i32) -> Message {
    Message {
        id: 0, // 由数据库自动生成
        conversation_id: conversation_id.to_string(),
        role: MessageRole::User,
        content: format!("消息内容 {}", order),
        metadata: serde_json::json!({"order": order}),
        created_at: Utc::now(),
    }
}

// ========== 对话会话管理测试 ==========

mod conversation_crud {
    use super::*;

    #[test]
    fn test_create_and_get_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("conv-001");

        // ========== Act ==========
        let result = history.create_conversation(conversation.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "创建对话应该成功");

        let retrieved = history.get_conversation("conv-001")
            .expect("查询应该成功")
            .expect("应该找到对话");
        
        assert_eq!(retrieved.id, conversation.id);
        assert_eq!(retrieved.title, conversation.title);
    }

    #[test]
    fn test_get_conversation_not_found() {
        // ========== Arrange ==========
        let history = setup_test_history();

        // ========== Act ==========
        let result = history.get_conversation("non-existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的对话应该返回None");
    }

    #[test]
    fn test_get_all_conversations() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        for i in 1..=5 {
            let conversation = create_test_conversation(&format!("conv-{}", i));
            history.create_conversation(conversation)
                .expect("创建应该成功");
        }

        // ========== Act ==========
        let conversations = history.get_all_conversations()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(conversations.len(), 5, "应该返回5个对话");
    }

    #[test]
    fn test_update_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let mut conversation = create_test_conversation("update-test");
        history.create_conversation(conversation.clone())
            .expect("创建应该成功");

        // ========== Act ==========
        conversation.title = "更新后的标题".to_string();
        conversation.summary = Some("更新后的摘要".to_string());
        
        let result = history.update_conversation(conversation.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新应该成功");

        let retrieved = history.get_conversation("update-test")
            .expect("查询应该成功")
            .unwrap();
        
        assert_eq!(retrieved.title, "更新后的标题");
        assert_eq!(retrieved.summary, Some("更新后的摘要".to_string()));
    }

    #[test]
    fn test_delete_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("delete-test");
        history.create_conversation(conversation)
            .expect("创建应该成功");

        // ========== Act ==========
        let result = history.delete_conversation("delete-test");

        // ========== Assert ==========
        assert!(result.is_ok(), "删除应该成功");

        let retrieved = history.get_conversation("delete-test")
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到对话");
    }

    #[test]
    fn test_archive_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("archive-test");
        history.create_conversation(conversation)
            .expect("创建应该成功");

        // ========== Act ==========
        let result = history.archive_conversation("archive-test", true);

        // ========== Assert ==========
        assert!(result.is_ok(), "归档应该成功");

        let archived = history.get_conversation("archive-test")
            .unwrap()
            .unwrap();
        assert!(archived.is_archived, "对话应该被标记为已归档");
    }

    #[test]
    fn test_unarchive_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let mut conversation = create_test_conversation("unarchive-test");
        conversation.is_archived = true;
        history.create_conversation(conversation).unwrap();

        // ========== Act ==========
        history.archive_conversation("unarchive-test", false).unwrap();

        // ========== Assert ==========
        let unarchived = history.get_conversation("unarchive-test")
            .unwrap()
            .unwrap();
        assert!(!unarchived.is_archived, "归档标记应该被取消");
    }

    #[test]
    fn test_get_active_conversations() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        // 创建活跃对话
        for i in 1..=3 {
            let conversation = create_test_conversation(&format!("active-{}", i));
            history.create_conversation(conversation).unwrap();
        }

        // 创建归档对话
        for i in 1..=2 {
            let mut conversation = create_test_conversation(&format!("archived-{}", i));
            conversation.is_archived = true;
            history.create_conversation(conversation).unwrap();
        }

        // ========== Act ==========
        let active = history.get_active_conversations()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(active.len(), 3, "应该有3个活跃对话");
        
        for conv in active {
            assert!(!conv.is_archived);
        }
    }
}

// ========== 消息管理测试 ==========

mod message_crud {
    use super::*;

    #[test]
    fn test_add_message() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("msg-test");
        history.create_conversation(conversation).unwrap();

        let message = create_test_message("msg-test", 1);

        // ========== Act ==========
        let result = history.add_message(message.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "添加消息应该成功");
        let msg_id = result.unwrap();
        assert!(msg_id > 0, "应该返回有效的消息ID");

        // 验证对话的消息计数和最后消息时间已更新
        let updated_conv = history.get_conversation("msg-test")
            .unwrap()
            .unwrap();
        assert_eq!(updated_conv.message_count, 1);
        assert!(updated_conv.last_message_at.is_some());
    }

    #[test]
    fn test_get_messages() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("get-msgs");
        history.create_conversation(conversation).unwrap();

        // 添加多条消息
        for i in 1..=5 {
            let message = create_test_message("get-msgs", i);
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let messages = history.get_messages("get-msgs", None, None)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(messages.len(), 5, "应该有5条消息");
    }

    #[test]
    fn test_get_messages_with_limit() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("limit-test");
        history.create_conversation(conversation).unwrap();

        for i in 1..=10 {
            let message = create_test_message("limit-test", i);
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let messages = history.get_messages("limit-test", Some(5), None)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(messages.len(), 5, "应该只返回5条消息");
    }

    #[test]
    fn test_get_messages_with_offset() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("offset-test");
        history.create_conversation(conversation).unwrap();

        for i in 1..=10 {
            let message = create_test_message("offset-test", i);
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let messages = history.get_messages("offset-test", Some(5), Some(3))
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(messages.len(), 5, "应该返回5条消息");
        // 验证是跳过了前3条
    }

    #[test]
    fn test_delete_message() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("del-msg");
        history.create_conversation(conversation).unwrap();

        let message = create_test_message("del-msg", 1);
        let msg_id = history.add_message(message).unwrap();

        // ========== Act ==========
        let result = history.delete_message(msg_id);

        // ========== Assert ==========
        assert!(result.is_ok(), "删除消息应该成功");

        let messages = history.get_messages("del-msg", None, None).unwrap();
        assert_eq!(messages.len(), 0, "消息列表应该为空");

        // 验证对话的消息计数已更新
        let updated_conv = history.get_conversation("del-msg")
            .unwrap()
            .unwrap();
        assert_eq!(updated_conv.message_count, 0);
    }

    #[test]
    fn test_message_roles() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("roles-test");
        history.create_conversation(conversation).unwrap();

        // 添加不同角色的消息
        let mut user_msg = create_test_message("roles-test", 1);
        user_msg.role = MessageRole::User;
        history.add_message(user_msg).unwrap();

        let mut assistant_msg = create_test_message("roles-test", 2);
        assistant_msg.role = MessageRole::Assistant;
        history.add_message(assistant_msg).unwrap();

        let mut system_msg = create_test_message("roles-test", 3);
        system_msg.role = MessageRole::System;
        history.add_message(system_msg).unwrap();

        // ========== Act ==========
        let messages = history.get_messages("roles-test", None, None)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(messages[1].role, MessageRole::Assistant);
        assert_eq!(messages[2].role, MessageRole::System);
    }
}

// ========== 对话搜索测试 ==========

mod conversation_search {
    use super::*;

    #[test]
    fn test_search_conversations_by_title() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        for i in 1..=3 {
            let mut conversation = create_test_conversation(&format!("work-{}", i));
            conversation.title = format!("工作对话 {}", i);
            history.create_conversation(conversation).unwrap();
        }

        for i in 1..=2 {
            let mut conversation = create_test_conversation(&format!("personal-{}", i));
            conversation.title = format!("个人对话 {}", i);
            history.create_conversation(conversation).unwrap();
        }

        // ========== Act ==========
        let results = history.search_conversations("工作", None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 3, "应该找到3个工作对话");
    }

    #[test]
    fn test_search_conversations_by_character() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        for i in 1..=3 {
            let mut conversation = create_test_conversation(&format!("hiyori-{}", i));
            conversation.character_id = Some("hiyori".to_string());
            history.create_conversation(conversation).unwrap();
        }

        for i in 1..=2 {
            let mut conversation = create_test_conversation(&format!("other-{}", i));
            conversation.character_id = Some("other".to_string());
            history.create_conversation(conversation).unwrap();
        }

        // ========== Act ==========
        let results = history.get_conversations_by_character("hiyori")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 3, "应该有3个hiyori的对话");
    }

    #[test]
    fn test_search_messages() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("search-msg");
        history.create_conversation(conversation).unwrap();

        for i in 1..=5 {
            let mut message = create_test_message("search-msg", i);
            if i <= 2 {
                message.content = format!("关于项目的消息 {}", i);
            }
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let results = history.search_messages("search-msg", "项目", None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 2, "应该找到2条包含'项目'的消息");
    }

    #[test]
    fn test_search_with_no_results() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("empty-search");
        history.create_conversation(conversation).unwrap();

        // ========== Act ==========
        let results = history.search_conversations("不存在的内容", None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 0, "没有匹配结果");
    }
}

// ========== 对话统计测试 ==========

mod conversation_statistics {
    use super::*;

    #[test]
    fn test_get_total_conversations() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        for i in 1..=10 {
            let conversation = create_test_conversation(&format!("conv-{}", i));
            history.create_conversation(conversation).unwrap();
        }

        // ========== Act ==========
        let total = history.get_total_conversations()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(total, 10, "应该有10个对话");
    }

    #[test]
    fn test_get_total_messages() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("msg-count");
        history.create_conversation(conversation).unwrap();

        for i in 1..=20 {
            let message = create_test_message("msg-count", i);
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let total = history.get_total_messages()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(total, 20, "应该有20条消息");
    }

    #[test]
    fn test_get_conversation_stats() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("stats-test");
        history.create_conversation(conversation).unwrap();

        // 添加不同角色的消息
        for i in 1..=10 {
            let mut message = create_test_message("stats-test", i);
            message.role = if i % 2 == 0 {
                MessageRole::Assistant
            } else {
                MessageRole::User
            };
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        let stats = history.get_conversation_stats("stats-test")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_messages, 10);
        assert_eq!(stats.user_messages, 5);
        assert_eq!(stats.assistant_messages, 5);
    }

    #[test]
    fn test_get_recent_conversations() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        for i in 1..=10 {
            let conversation = create_test_conversation(&format!("recent-{}", i));
            history.create_conversation(conversation).unwrap();
            
            // 添加一条消息以更新last_message_at
            let message = create_test_message(&format!("recent-{}", i), 1);
            history.add_message(message).unwrap();
            
            // 稍微等待以确保时间差异
            std::thread::sleep(std::time::Duration::from_millis(5));
        }

        // ========== Act ==========
        let recent = history.get_recent_conversations(5)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(recent.len(), 5, "应该返回最近的5个对话");
        
        // 验证是按时间排序的
        for i in 0..recent.len()-1 {
            assert!(
                recent[i].last_message_at >= recent[i+1].last_message_at,
                "对话应该按最后消息时间降序排列"
            );
        }
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_conversation_lifecycle() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        // 1. 创建对话
        let conversation = create_test_conversation("lifecycle");
        history.create_conversation(conversation).unwrap();

        // 2. 添加多条消息
        for i in 1..=10 {
            let mut message = create_test_message("lifecycle", i);
            message.role = if i % 2 == 0 {
                MessageRole::Assistant
            } else {
                MessageRole::User
            };
            history.add_message(message).unwrap();
        }

        // 3. 更新对话信息
        let mut updated = history.get_conversation("lifecycle").unwrap().unwrap();
        updated.summary = Some("这是一个完整的对话生命周期测试".to_string());
        history.update_conversation(updated).unwrap();

        // 4. 归档对话
        history.archive_conversation("lifecycle", true).unwrap();

        // 5. 验证最终状态
        let final_conv = history.get_conversation("lifecycle")
            .unwrap()
            .unwrap();
        
        assert_eq!(final_conv.message_count, 10);
        assert!(final_conv.is_archived);
        assert!(final_conv.last_message_at.is_some());
        assert_eq!(
            final_conv.summary,
            Some("这是一个完整的对话生命周期测试".to_string())
        );

        let messages = history.get_messages("lifecycle", None, None).unwrap();
        assert_eq!(messages.len(), 10);
    }

    #[test]
    fn test_multi_character_conversations() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        let characters = vec!["hiyori", "char2", "char3"];
        
        for character in &characters {
            for i in 1..=3 {
                let mut conversation = create_test_conversation(
                    &format!("{}-conv-{}", character, i)
                );
                conversation.character_id = Some(character.to_string());
                history.create_conversation(conversation).unwrap();
                
                // 每个对话添加几条消息
                for j in 1..=5 {
                    let message = create_test_message(
                        &format!("{}-conv-{}", character, i),
                        j
                    );
                    history.add_message(message).unwrap();
                }
            }
        }

        // ========== Act & Assert ==========
        for character in &characters {
            let convs = history.get_conversations_by_character(character).unwrap();
            assert_eq!(convs.len(), 3, "每个角色应该有3个对话");
            
            for conv in convs {
                assert_eq!(conv.message_count, 5, "每个对话应该有5条消息");
            }
        }
    }

    #[test]
    fn test_conversation_with_context() {
        // ========== Arrange ==========
        let history = setup_test_history();
        
        let mut conversation = create_test_conversation("context-test");
        conversation.context = serde_json::json!({
            "mood": "happy",
            "topics": ["工作", "生活"],
            "preferences": {
                "language": "zh-CN",
                "tone": "friendly"
            }
        });
        
        history.create_conversation(conversation.clone()).unwrap();

        // ========== Act ==========
        let retrieved = history.get_conversation("context-test")
            .unwrap()
            .unwrap();

        // ========== Assert ==========
        assert_eq!(retrieved.context, conversation.context);
    }

    #[test]
    fn test_cascade_delete_conversation() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("cascade-test");
        history.create_conversation(conversation).unwrap();

        // 添加消息
        for i in 1..=5 {
            let message = create_test_message("cascade-test", i);
            history.add_message(message).unwrap();
        }

        // ========== Act ==========
        history.delete_conversation("cascade-test").unwrap();

        // ========== Assert ==========
        let conv = history.get_conversation("cascade-test").unwrap();
        assert!(conv.is_none(), "对话应该被删除");

        let messages = history.get_messages("cascade-test", None, None).unwrap();
        assert_eq!(messages.len(), 0, "消息应该被级联删除");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_conversation_with_empty_title() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let mut conversation = create_test_conversation("empty-title");
        conversation.title = "".to_string();

        // ========== Act ==========
        let result = history.create_conversation(conversation);

        // ========== Assert ==========
        assert!(result.is_ok(), "空标题应该被接受");
    }

    #[test]
    fn test_message_with_empty_content() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("empty-msg");
        history.create_conversation(conversation).unwrap();

        let mut message = create_test_message("empty-msg", 1);
        message.content = "".to_string();

        // ========== Act ==========
        let result = history.add_message(message);

        // ========== Assert ==========
        assert!(result.is_ok(), "空内容应该被接受");
    }

    #[test]
    fn test_conversation_with_long_content() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let mut conversation = create_test_conversation("long-content");
        conversation.summary = Some("x".repeat(10000));

        // ========== Act ==========
        let result = history.create_conversation(conversation.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "长内容应该被接受");

        let retrieved = history.get_conversation("long-content")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.summary, conversation.summary);
    }

    #[test]
    fn test_message_with_large_metadata() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let conversation = create_test_conversation("large-metadata");
        history.create_conversation(conversation).unwrap();

        let mut message = create_test_message("large-metadata", 1);
        let mut metadata = serde_json::Map::new();
        for i in 0..100 {
            metadata.insert(
                format!("key_{}", i),
                serde_json::json!({"value": format!("data_{}", i)})
            );
        }
        message.metadata = serde_json::Value::Object(metadata);

        // ========== Act ==========
        let msg_id = history.add_message(message.clone()).unwrap();

        // ========== Assert ==========
        let messages = history.get_messages("large-metadata", None, None).unwrap();
        assert_eq!(messages[0].metadata, message.metadata);
    }

    #[test]
    fn test_conversation_with_special_characters() {
        // ========== Arrange ==========
        let history = setup_test_history();
        let mut conversation = create_test_conversation("special-chars");
        conversation.title = "测试@#$%^&*()对话\n换行\t制表符".to_string();

        // ========== Act ==========
        let result = history.create_conversation(conversation.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "特殊字符应该被正确处理");

        let retrieved = history.get_conversation("special-chars")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, conversation.title);
    }
}


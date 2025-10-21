//! AppState 应用状态管理模块单元测试
//!
//! 测试AppState及其相关子状态模块，包括ChatState和TrayState

use chrono::Utc;

// 导入被测试的模块
use zishu_sensei::{
    ChatState, ChatSession, ModelConfig,
    TrayState, TrayIconState, RecentConversation, SystemResources, 
    TrayNotification, NotificationType,
};

// ========== ChatSession 测试 ==========

mod chat_session_tests {
    use super::*;

    #[test]
    fn test_chat_session_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let now = Utc::now().timestamp();
        let session = ChatSession {
            session_id: "session_001".to_string(),
            created_at: now,
            last_activity: now,
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(session.session_id, "session_001");
        assert_eq!(session.created_at, now);
        assert_eq!(session.last_activity, now);
        assert_eq!(session.message_count, 0);
        assert_eq!(session.model_id, None);
        assert_eq!(session.character_id, None);
    }

    #[test]
    fn test_chat_session_with_model_and_character() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let session = ChatSession {
            session_id: "session_002".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 5,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("shizuku".to_string()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(session.model_id, Some("gpt-4".to_string()));
        assert_eq!(session.character_id, Some("shizuku".to_string()));
        assert_eq!(session.message_count, 5);
    }

    #[test]
    fn test_chat_session_clone() {
        // ========== Arrange (准备) ==========
        let session = ChatSession {
            session_id: "session_003".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 10,
            model_id: Some("gpt-3.5".to_string()),
            character_id: None,
        };

        // ========== Act (执行) ==========
        let cloned = session.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.session_id, session.session_id);
        assert_eq!(cloned.created_at, session.created_at);
        assert_eq!(cloned.last_activity, session.last_activity);
        assert_eq!(cloned.message_count, session.message_count);
        assert_eq!(cloned.model_id, session.model_id);
        assert_eq!(cloned.character_id, session.character_id);
    }

    #[test]
    fn test_chat_session_serialization() {
        // ========== Arrange (准备) ==========
        let session = ChatSession {
            session_id: "session_004".to_string(),
            created_at: 1234567890,
            last_activity: 1234567900,
            message_count: 3,
            model_id: Some("claude".to_string()),
            character_id: Some("assistant".to_string()),
        };

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&session).unwrap();
        let deserialized: ChatSession = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.session_id, session.session_id);
        assert_eq!(deserialized.created_at, session.created_at);
        assert_eq!(deserialized.last_activity, session.last_activity);
        assert_eq!(deserialized.message_count, session.message_count);
        assert_eq!(deserialized.model_id, session.model_id);
        assert_eq!(deserialized.character_id, session.character_id);
    }
}

// ========== ModelConfig 测试 ==========

mod model_config_tests {
    use super::*;

    #[test]
    fn test_default_model_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ModelConfig::default();

        // ========== Assert (断言) ==========
        assert_eq!(config.model_id, "default");
        assert_eq!(config.adapter_id, None);
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.top_p, 0.9);
        assert_eq!(config.max_tokens, 2048);
    }

    #[test]
    fn test_custom_model_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.8,
            top_p: 0.95,
            max_tokens: 4096,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.model_id, "gpt-4");
        assert_eq!(config.adapter_id, Some("openai".to_string()));
        assert_eq!(config.temperature, 0.8);
        assert_eq!(config.top_p, 0.95);
        assert_eq!(config.max_tokens, 4096);
    }

    #[test]
    fn test_model_config_extreme_parameters() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ModelConfig {
            model_id: "test".to_string(),
            adapter_id: None,
            temperature: 0.0,
            top_p: 1.0,
            max_tokens: 1,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.temperature, 0.0, "应该允许0温度");
        assert_eq!(config.top_p, 1.0, "应该允许1.0的top_p");
        assert_eq!(config.max_tokens, 1, "应该允许最小token数");
    }

    #[test]
    fn test_model_config_high_parameters() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ModelConfig {
            model_id: "test".to_string(),
            adapter_id: None,
            temperature: 2.0,
            top_p: 1.0,
            max_tokens: 100000,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.temperature, 2.0);
        assert_eq!(config.max_tokens, 100000);
    }

    #[test]
    fn test_model_config_clone() {
        // ========== Arrange (准备) ==========
        let config = ModelConfig {
            model_id: "claude-3".to_string(),
            adapter_id: Some("anthropic".to_string()),
            temperature: 0.5,
            top_p: 0.8,
            max_tokens: 8192,
        };

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.model_id, config.model_id);
        assert_eq!(cloned.adapter_id, config.adapter_id);
        assert_eq!(cloned.temperature, config.temperature);
        assert_eq!(cloned.top_p, config.top_p);
        assert_eq!(cloned.max_tokens, config.max_tokens);
    }

    #[test]
    fn test_model_config_serialization() {
        // ========== Arrange (准备) ==========
        let config = ModelConfig {
            model_id: "gemini".to_string(),
            adapter_id: Some("google".to_string()),
            temperature: 0.6,
            top_p: 0.92,
            max_tokens: 2048,
        };

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ModelConfig = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.model_id, config.model_id);
        assert_eq!(deserialized.adapter_id, config.adapter_id);
        assert_eq!(deserialized.temperature, config.temperature);
        assert_eq!(deserialized.top_p, config.top_p);
        assert_eq!(deserialized.max_tokens, config.max_tokens);
    }
}

// ========== ChatState 测试 ==========

mod chat_state_tests {
    use super::*;

    #[test]
    fn test_chat_state_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let state = ChatState::new();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none(), "新状态不应有当前会话");
        assert_eq!(state.get_all_sessions().len(), 0, "新状态不应有任何会话");
        assert_eq!(state.get_api_base_url(), "http://127.0.0.1:8000", "默认API URL应该正确");
        
        let default_config = state.get_model_config();
        assert_eq!(default_config.model_id, "default");
    }

    #[test]
    fn test_chat_state_default() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let state = ChatState::default();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_set_and_get_current_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = ChatSession {
            session_id: "test_001".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session.clone());

        // ========== Assert (断言) ==========
        let current = state.get_current_session();
        assert!(current.is_some());
        assert_eq!(current.unwrap().session_id, "test_001");
        
        // 应该也能通过get_session获取
        let retrieved = state.get_session("test_001");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().session_id, "test_001");
    }

    #[test]
    fn test_clear_current_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = ChatSession {
            session_id: "test_002".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        state.set_current_session(session);

        // ========== Act (执行) ==========
        state.clear_current_session();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none());
        // 会话仍然应该存在于sessions中
        assert!(state.get_session("test_002").is_some());
    }

    #[test]
    fn test_multiple_sessions() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        
        let session1 = ChatSession {
            session_id: "session_1".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        let session2 = ChatSession {
            session_id: "session_2".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 5,
            model_id: Some("gpt-4".to_string()),
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session1);
        state.set_current_session(session2.clone());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_all_sessions().len(), 2);
        
        // 当前会话应该是session2
        let current = state.get_current_session().unwrap();
        assert_eq!(current.session_id, "session_2");
        
        // 应该能获取任一会话
        assert!(state.get_session("session_1").is_some());
        assert!(state.get_session("session_2").is_some());
    }

    #[test]
    fn test_remove_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = ChatSession {
            session_id: "to_remove".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        state.set_current_session(session);

        // ========== Act (执行) ==========
        state.remove_session("to_remove");

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none(), "移除当前会话应该清除current_session");
        assert!(state.get_session("to_remove").is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_remove_non_current_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        
        let session1 = ChatSession {
            session_id: "keep".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        let session2 = ChatSession {
            session_id: "remove".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session1);
        state.set_current_session(session2);
        state.set_current_session(state.get_session("keep").unwrap());

        // ========== Act (执行) ==========
        state.remove_session("remove");

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_some(), "当前会话应该保留");
        assert_eq!(state.get_current_session().unwrap().session_id, "keep");
        assert!(state.get_session("remove").is_none());
        assert_eq!(state.get_all_sessions().len(), 1);
    }

    #[test]
    fn test_update_session_activity() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let start_time = Utc::now().timestamp();
        
        let session = ChatSession {
            session_id: "active_session".to_string(),
            created_at: start_time,
            last_activity: start_time,
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        state.set_current_session(session);

        // ========== Act (执行) ==========
        // 需要等待一点时间确保时间戳不同
        std::thread::sleep(std::time::Duration::from_millis(10));
        state.update_session_activity("active_session");

        // ========== Assert (断言) ==========
        let updated = state.get_session("active_session").unwrap();
        assert!(updated.last_activity > start_time, "活动时间应该更新");
        assert_eq!(updated.message_count, 1, "消息计数应该增加");
    }

    #[test]
    fn test_model_config_management() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let config = ModelConfig {
            model_id: "custom-model".to_string(),
            adapter_id: Some("custom-adapter".to_string()),
            temperature: 0.5,
            top_p: 0.85,
            max_tokens: 1024,
        };

        // ========== Act (执行) ==========
        state.set_model_config(config.clone());

        // ========== Assert (断言) ==========
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.model_id, "custom-model");
        assert_eq!(retrieved.adapter_id, Some("custom-adapter".to_string()));
        assert_eq!(retrieved.temperature, 0.5);
        assert_eq!(retrieved.top_p, 0.85);
        assert_eq!(retrieved.max_tokens, 1024);
    }

    #[test]
    fn test_api_base_url_management() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        state.set_api_base_url("http://custom.api.com:9000".to_string());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), "http://custom.api.com:9000");
    }

    #[test]
    fn test_update_nonexistent_session_activity() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        state.update_session_activity("nonexistent");

        // ========== Assert (断言) ==========
        // 不应该崩溃，只是什么都不做
        assert!(state.get_session("nonexistent").is_none());
    }
}

// ========== TrayIconState 测试 ==========

mod tray_icon_state_tests {
    use super::*;

    #[test]
    fn test_tray_icon_states() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let states = vec![
            TrayIconState::Idle,
            TrayIconState::Active,
            TrayIconState::Busy,
            TrayIconState::Notification,
            TrayIconState::Error,
        ];

        // ========== Assert (断言) ==========
        for state in states {
            // 测试Clone
            let cloned = state.clone();
            assert_eq!(cloned, state);
            
            // 测试序列化
            let json = serde_json::to_string(&state).unwrap();
            let deserialized: TrayIconState = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, state);
        }
    }

    #[test]
    fn test_tray_icon_state_serialization_format() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let idle_json = serde_json::to_string(&TrayIconState::Idle).unwrap();
        let active_json = serde_json::to_string(&TrayIconState::Active).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(idle_json, "\"idle\"");
        assert_eq!(active_json, "\"active\"");
    }
}

// ========== RecentConversation 测试 ==========

mod recent_conversation_tests {
    use super::*;

    #[test]
    fn test_recent_conversation_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let now = Utc::now();
        let conversation = RecentConversation {
            id: "conv_001".to_string(),
            title: "Test Conversation".to_string(),
            last_message: "Hello, how are you?".to_string(),
            updated_at: now,
            unread_count: 3,
        };

        // ========== Assert (断言) ==========
        assert_eq!(conversation.id, "conv_001");
        assert_eq!(conversation.title, "Test Conversation");
        assert_eq!(conversation.last_message, "Hello, how are you?");
        assert_eq!(conversation.unread_count, 3);
    }

    #[test]
    fn test_recent_conversation_serialization() {
        // ========== Arrange (准备) ==========
        let now = Utc::now();
        let conversation = RecentConversation {
            id: "conv_002".to_string(),
            title: "Serialization Test".to_string(),
            last_message: "Test message".to_string(),
            updated_at: now,
            unread_count: 0,
        };

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&conversation).unwrap();
        let deserialized: RecentConversation = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.id, conversation.id);
        assert_eq!(deserialized.title, conversation.title);
        assert_eq!(deserialized.last_message, conversation.last_message);
        assert_eq!(deserialized.unread_count, conversation.unread_count);
    }
}

// ========== SystemResources 测试 ==========

mod system_resources_tests {
    use super::*;

    #[test]
    fn test_default_system_resources() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let resources = SystemResources::default();

        // ========== Assert (断言) ==========
        assert_eq!(resources.cpu_usage, 0.0);
        assert_eq!(resources.memory_usage, 0.0);
        assert_eq!(resources.total_memory, 0);
        assert_eq!(resources.used_memory, 0);
        assert_eq!(resources.uptime, 0);
    }

    #[test]
    fn test_custom_system_resources() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let now = Utc::now();
        let resources = SystemResources {
            cpu_usage: 45.5,
            memory_usage: 67.3,
            total_memory: 16_000_000_000,
            used_memory: 10_000_000_000,
            uptime: 3600,
            updated_at: now,
        };

        // ========== Assert (断言) ==========
        assert_eq!(resources.cpu_usage, 45.5);
        assert_eq!(resources.memory_usage, 67.3);
        assert_eq!(resources.total_memory, 16_000_000_000);
        assert_eq!(resources.used_memory, 10_000_000_000);
        assert_eq!(resources.uptime, 3600);
    }

    #[test]
    fn test_system_resources_serialization() {
        // ========== Arrange (准备) ==========
        let now = Utc::now();
        let resources = SystemResources {
            cpu_usage: 25.0,
            memory_usage: 50.0,
            total_memory: 8_000_000_000,
            used_memory: 4_000_000_000,
            uptime: 7200,
            updated_at: now,
        };

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&resources).unwrap();
        let deserialized: SystemResources = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.cpu_usage, resources.cpu_usage);
        assert_eq!(deserialized.memory_usage, resources.memory_usage);
        assert_eq!(deserialized.total_memory, resources.total_memory);
        assert_eq!(deserialized.used_memory, resources.used_memory);
        assert_eq!(deserialized.uptime, resources.uptime);
    }
}

// ========== TrayNotification 和 NotificationType 测试 ==========

mod notification_tests {
    use super::*;

    #[test]
    fn test_notification_types() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let types = vec![
            NotificationType::Info,
            NotificationType::Warning,
            NotificationType::Error,
            NotificationType::Success,
            NotificationType::Message,
        ];

        // ========== Assert (断言) ==========
        for notification_type in types {
            let cloned = notification_type.clone();
            assert_eq!(cloned, notification_type);
            
            let json = serde_json::to_string(&notification_type).unwrap();
            let deserialized: NotificationType = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, notification_type);
        }
    }

    #[test]
    fn test_tray_notification_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let now = Utc::now();
        let notification = TrayNotification {
            id: "notif_001".to_string(),
            title: "Test Notification".to_string(),
            body: "This is a test notification body".to_string(),
            notification_type: NotificationType::Info,
            created_at: now,
            is_read: false,
        };

        // ========== Assert (断言) ==========
        assert_eq!(notification.id, "notif_001");
        assert_eq!(notification.title, "Test Notification");
        assert_eq!(notification.body, "This is a test notification body");
        assert_eq!(notification.notification_type, NotificationType::Info);
        assert_eq!(notification.is_read, false);
    }

    #[test]
    fn test_tray_notification_serialization() {
        // ========== Arrange (准备) ==========
        let now = Utc::now();
        let notification = TrayNotification {
            id: "notif_002".to_string(),
            title: "Error".to_string(),
            body: "An error occurred".to_string(),
            notification_type: NotificationType::Error,
            created_at: now,
            is_read: true,
        };

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&notification).unwrap();
        let deserialized: TrayNotification = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.id, notification.id);
        assert_eq!(deserialized.title, notification.title);
        assert_eq!(deserialized.body, notification.body);
        assert_eq!(deserialized.notification_type, notification.notification_type);
        assert_eq!(deserialized.is_read, notification.is_read);
    }
}

// ========== TrayState 测试 ==========

mod tray_state_tests {
    use super::*;

    #[test]
    fn test_tray_state_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let state = TrayState::new();

        // ========== Assert (断言) ==========
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);
        assert_eq!(state.get_recent_conversations().len(), 0);
        assert_eq!(state.get_notifications().len(), 0);
        assert_eq!(state.get_unread_notification_count(), 0);
        assert_eq!(state.get_total_unread_count(), 0);
    }

    #[test]
    fn test_tray_state_default() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let state = TrayState::default();

        // ========== Assert (断言) ==========
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);
    }

    #[test]
    fn test_icon_state_management() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();

        // ========== Act & Assert (执行 & 断言) ==========
        state.set_icon_state(TrayIconState::Active);
        assert_eq!(state.get_icon_state(), TrayIconState::Active);

        state.set_icon_state(TrayIconState::Busy);
        assert_eq!(state.get_icon_state(), TrayIconState::Busy);

        state.set_icon_state(TrayIconState::Error);
        assert_eq!(state.get_icon_state(), TrayIconState::Error);
    }

    #[test]
    fn test_add_conversation() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let conversation = RecentConversation {
            id: "conv_001".to_string(),
            title: "First Conversation".to_string(),
            last_message: "Hello".to_string(),
            updated_at: Utc::now(),
            unread_count: 2,
        };

        // ========== Act (执行) ==========
        state.add_or_update_conversation(conversation.clone());

        // ========== Assert (断言) ==========
        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 1);
        assert_eq!(conversations[0].id, "conv_001");
        assert_eq!(state.get_total_unread_count(), 2);
    }

    #[test]
    fn test_update_existing_conversation() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let conversation1 = RecentConversation {
            id: "conv_001".to_string(),
            title: "Original Title".to_string(),
            last_message: "Original Message".to_string(),
            updated_at: Utc::now(),
            unread_count: 1,
        };
        state.add_or_update_conversation(conversation1);

        // ========== Act (执行) ==========
        let conversation2 = RecentConversation {
            id: "conv_001".to_string(),
            title: "Updated Title".to_string(),
            last_message: "Updated Message".to_string(),
            updated_at: Utc::now(),
            unread_count: 5,
        };
        state.add_or_update_conversation(conversation2);

        // ========== Assert (断言) ==========
        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 1, "应该只有一个会话");
        assert_eq!(conversations[0].title, "Updated Title");
        assert_eq!(conversations[0].last_message, "Updated Message");
        assert_eq!(conversations[0].unread_count, 5);
    }

    #[test]
    fn test_conversation_limit() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();

        // ========== Act (执行) ==========
        // 添加15个会话
        for i in 0..15 {
            let conversation = RecentConversation {
                id: format!("conv_{:03}", i),
                title: format!("Conversation {}", i),
                last_message: format!("Message {}", i),
                updated_at: Utc::now(),
                unread_count: 0,
            };
            state.add_or_update_conversation(conversation);
            // 小延迟确保时间戳不同
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        // ========== Assert (断言) ==========
        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 10, "应该只保留最近10条会话");
    }

    #[test]
    fn test_remove_conversation() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let conversation = RecentConversation {
            id: "to_remove".to_string(),
            title: "Remove Me".to_string(),
            last_message: "Bye".to_string(),
            updated_at: Utc::now(),
            unread_count: 1,
        };
        state.add_or_update_conversation(conversation);

        // ========== Act (执行) ==========
        state.remove_conversation("to_remove");

        // ========== Assert (断言) ==========
        assert_eq!(state.get_recent_conversations().len(), 0);
        assert_eq!(state.get_total_unread_count(), 0);
    }

    #[test]
    fn test_clear_conversations() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        for i in 0..5 {
            let conversation = RecentConversation {
                id: format!("conv_{}", i),
                title: format!("Conversation {}", i),
                last_message: "Message".to_string(),
                updated_at: Utc::now(),
                unread_count: 1,
            };
            state.add_or_update_conversation(conversation);
        }

        // ========== Act (执行) ==========
        state.clear_conversations();

        // ========== Assert (断言) ==========
        assert_eq!(state.get_recent_conversations().len(), 0);
        assert_eq!(state.get_total_unread_count(), 0);
    }

    #[test]
    fn test_mark_conversation_read() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let conversation = RecentConversation {
            id: "conv_001".to_string(),
            title: "Test".to_string(),
            last_message: "Message".to_string(),
            updated_at: Utc::now(),
            unread_count: 5,
        };
        state.add_or_update_conversation(conversation);

        // ========== Act (执行) ==========
        state.mark_conversation_read("conv_001");

        // ========== Assert (断言) ==========
        let conversations = state.get_recent_conversations();
        assert_eq!(conversations[0].unread_count, 0);
        assert_eq!(state.get_total_unread_count(), 0);
    }

    #[test]
    fn test_system_resources_management() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let resources = SystemResources {
            cpu_usage: 30.5,
            memory_usage: 55.2,
            total_memory: 16_000_000_000,
            used_memory: 8_800_000_000,
            uptime: 1800,
            updated_at: Utc::now(),
        };

        // ========== Act (执行) ==========
        state.update_system_resources(resources.clone());

        // ========== Assert (断言) ==========
        let retrieved = state.get_system_resources();
        assert_eq!(retrieved.cpu_usage, 30.5);
        assert_eq!(retrieved.memory_usage, 55.2);
        assert_eq!(retrieved.total_memory, 16_000_000_000);
        assert_eq!(retrieved.used_memory, 8_800_000_000);
        assert_eq!(retrieved.uptime, 1800);
    }

    #[test]
    fn test_add_notification() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let notification = TrayNotification {
            id: "notif_001".to_string(),
            title: "Test".to_string(),
            body: "Test notification".to_string(),
            notification_type: NotificationType::Info,
            created_at: Utc::now(),
            is_read: false,
        };

        // ========== Act (执行) ==========
        state.add_notification(notification);

        // ========== Assert (断言) ==========
        assert_eq!(state.get_notifications().len(), 1);
        assert_eq!(state.get_unread_notification_count(), 1);
        assert_eq!(state.get_unread_notifications().len(), 1);
    }

    #[test]
    fn test_notification_limit() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();

        // ========== Act (执行) ==========
        // 添加60个通知
        for i in 0..60 {
            let notification = TrayNotification {
                id: format!("notif_{:03}", i),
                title: format!("Notification {}", i),
                body: "Body".to_string(),
                notification_type: NotificationType::Info,
                created_at: Utc::now(),
                is_read: false,
            };
            state.add_notification(notification);
        }

        // ========== Assert (断言) ==========
        assert_eq!(state.get_notifications().len(), 50, "应该只保留最近50条通知");
    }

    #[test]
    fn test_mark_notification_read() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        let notification = TrayNotification {
            id: "notif_001".to_string(),
            title: "Test".to_string(),
            body: "Body".to_string(),
            notification_type: NotificationType::Info,
            created_at: Utc::now(),
            is_read: false,
        };
        state.add_notification(notification);

        // ========== Act (执行) ==========
        state.mark_notification_read("notif_001");

        // ========== Assert (断言) ==========
        assert_eq!(state.get_unread_notification_count(), 0);
        assert_eq!(state.get_unread_notifications().len(), 0);
        
        let notifications = state.get_notifications();
        assert_eq!(notifications[0].is_read, true);
    }

    #[test]
    fn test_mark_all_notifications_read() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        for i in 0..5 {
            let notification = TrayNotification {
                id: format!("notif_{}", i),
                title: "Test".to_string(),
                body: "Body".to_string(),
                notification_type: NotificationType::Info,
                created_at: Utc::now(),
                is_read: false,
            };
            state.add_notification(notification);
        }

        // ========== Act (执行) ==========
        state.mark_all_notifications_read();

        // ========== Assert (断言) ==========
        assert_eq!(state.get_unread_notification_count(), 0);
        assert_eq!(state.get_unread_notifications().len(), 0);
        
        let notifications = state.get_notifications();
        for notification in notifications {
            assert_eq!(notification.is_read, true);
        }
    }

    #[test]
    fn test_clear_notifications() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        for i in 0..5 {
            let notification = TrayNotification {
                id: format!("notif_{}", i),
                title: "Test".to_string(),
                body: "Body".to_string(),
                notification_type: NotificationType::Info,
                created_at: Utc::now(),
                is_read: false,
            };
            state.add_notification(notification);
        }

        // ========== Act (执行) ==========
        state.clear_notifications();

        // ========== Assert (断言) ==========
        assert_eq!(state.get_notifications().len(), 0);
        assert_eq!(state.get_unread_notification_count(), 0);
    }

    #[test]
    fn test_mixed_read_unread_notifications() {
        // ========== Arrange (准备) ==========
        let state = TrayState::new();
        
        for i in 0..10 {
            let notification = TrayNotification {
                id: format!("notif_{}", i),
                title: "Test".to_string(),
                body: "Body".to_string(),
                notification_type: NotificationType::Info,
                created_at: Utc::now(),
                is_read: i % 2 == 0, // 偶数已读，奇数未读
            };
            state.add_notification(notification);
        }

        // ========== Assert (断言) ==========
        assert_eq!(state.get_notifications().len(), 10);
        assert_eq!(state.get_unread_notification_count(), 5);
        assert_eq!(state.get_unread_notifications().len(), 5);
    }
}

// ========== 集成测试场景 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_complete_chat_workflow() {
        // ========== Arrange (准备) ==========
        let chat_state = ChatState::new();
        
        // 设置模型配置
        let model_config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 4096,
        };
        chat_state.set_model_config(model_config);

        // ========== Act (执行) ==========
        // 创建新会话
        let session = ChatSession {
            session_id: "workflow_session".to_string(),
            created_at: Utc::now().timestamp(),
            last_activity: Utc::now().timestamp(),
            message_count: 0,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("shizuku".to_string()),
        };
        chat_state.set_current_session(session);
        
        // 模拟对话活动
        for _ in 0..3 {
            std::thread::sleep(std::time::Duration::from_millis(10));
            chat_state.update_session_activity("workflow_session");
        }

        // ========== Assert (断言) ==========
        let current = chat_state.get_current_session().unwrap();
        assert_eq!(current.message_count, 3);
        
        let config = chat_state.get_model_config();
        assert_eq!(config.model_id, "gpt-4");
    }

    #[test]
    fn test_complete_tray_workflow() {
        // ========== Arrange (准备) ==========
        let tray_state = TrayState::new();

        // ========== Act (执行) ==========
        // 设置图标状态为活跃
        tray_state.set_icon_state(TrayIconState::Active);
        
        // 添加会话
        let conversation = RecentConversation {
            id: "tray_conv".to_string(),
            title: "Important Chat".to_string(),
            last_message: "Hello there!".to_string(),
            updated_at: Utc::now(),
            unread_count: 3,
        };
        tray_state.add_or_update_conversation(conversation);
        
        // 更新系统资源
        let resources = SystemResources {
            cpu_usage: 25.0,
            memory_usage: 40.0,
            total_memory: 16_000_000_000,
            used_memory: 6_400_000_000,
            uptime: 3600,
            updated_at: Utc::now(),
        };
        tray_state.update_system_resources(resources);
        
        // 添加通知
        let notification = TrayNotification {
            id: "important_notif".to_string(),
            title: "New Message".to_string(),
            body: "You have a new message".to_string(),
            notification_type: NotificationType::Message,
            created_at: Utc::now(),
            is_read: false,
        };
        tray_state.add_notification(notification);

        // ========== Assert (断言) ==========
        assert_eq!(tray_state.get_icon_state(), TrayIconState::Active);
        assert_eq!(tray_state.get_recent_conversations().len(), 1);
        assert_eq!(tray_state.get_total_unread_count(), 3);
        assert_eq!(tray_state.get_unread_notification_count(), 1);
        
        let sys_res = tray_state.get_system_resources();
        assert_eq!(sys_res.cpu_usage, 25.0);
    }
}


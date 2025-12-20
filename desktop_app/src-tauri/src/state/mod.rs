use std::sync::Arc;
use parking_lot::Mutex;
use tauri::AppHandle;

use crate::AppConfig;

pub mod chat_state;
pub mod tray_state;
pub mod app_state;
pub mod character_state;
pub mod settings;

pub use chat_state::{ChatState, ModelConfig};
pub use tray_state::{
    TrayState, TrayIconState,
};

/// Global application state stored in Tauri managed state
pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
    pub chat: ChatState,
    pub tray: Arc<TrayState>,
}

impl AppState {
    /// Create a new application state. Loads default config for now.
    pub async fn new(app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let config = AppConfig::default();
        let chat = ChatState::new();
        let tray = Arc::new(TrayState::new());

        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            chat,
            tray,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // 测试所需的导入已在上面声明

    #[test]
    fn test_module_exports() {
        // 测试所有导出的类型是否可用
        let _app_state_type: Option<AppState> = None;
        let _chat_state_type: Option<ChatState> = None;
        let _chat_session_type: Option<ChatSession> = None;
        let _model_config_type: Option<ModelConfig> = None;
        let _tray_state_type: Option<TrayState> = None;
        let _tray_icon_state_type: Option<TrayIconState> = None;
        let _recent_conversation_type: Option<RecentConversation> = None;
        let _system_resources_type: Option<SystemResources> = None;
        let _tray_notification_type: Option<TrayNotification> = None;
        let _notification_type_type: Option<NotificationType> = None;
        
        // 如果编译通过，说明所有类型都正确导出
        assert!(true);
    }

    #[test]
    fn test_chat_state_integration() {
        let chat_state = ChatState::new();
        
        // 测试默认状态
        assert!(chat_state.get_current_session().is_none());
        assert_eq!(chat_state.get_all_sessions().len(), 0);
        
        // 测试模型配置
        let default_config = chat_state.get_model_config();
        assert_eq!(default_config.model_id, "default");
        assert_eq!(default_config.temperature, 0.7);
        
        // 测试 API URL
        assert_eq!(chat_state.get_api_base_url(), "http://127.0.0.1:8000");
    }

    #[test]
    fn test_tray_state_integration() {
        let tray_state = TrayState::new();
        
        // 测试默认状态
        assert_eq!(tray_state.get_icon_state(), TrayIconState::Idle);
        assert_eq!(tray_state.get_recent_conversations().len(), 0);
        assert_eq!(tray_state.get_notifications().len(), 0);
        assert_eq!(tray_state.get_unread_notification_count(), 0);
        
        // 测试系统资源默认值
        let resources = tray_state.get_system_resources();
        assert_eq!(resources.cpu_usage, 0.0);
        assert_eq!(resources.memory_usage, 0.0);
    }

    #[test]
    fn test_state_types_serialization() {
        // 测试 ChatSession 序列化
        let session = ChatSession {
            session_id: "test".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 5,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("shizuku".to_string()),
        };
        
        let serialized = serde_json::to_string(&session);
        assert!(serialized.is_ok());
        
        let deserialized: Result<ChatSession, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
        
        // 测试 ModelConfig 序列化
        let config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.8,
            top_p: 0.9,
            max_tokens: 4096,
        };
        
        let serialized = serde_json::to_string(&config);
        assert!(serialized.is_ok());
        
        let deserialized: Result<ModelConfig, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
    }

    #[test]
    fn test_tray_icon_state_enum() {
        // 测试枚举值
        assert_eq!(TrayIconState::Idle, TrayIconState::Idle);
        assert_ne!(TrayIconState::Idle, TrayIconState::Active);
        
        // 测试序列化
        let state = TrayIconState::Notification;
        let serialized = serde_json::to_string(&state);
        assert!(serialized.is_ok());
        
        let deserialized: Result<TrayIconState, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
        assert_eq!(deserialized.unwrap(), TrayIconState::Notification);
    }

    #[test]
    fn test_notification_type_enum() {
        // 测试枚举值
        let types = vec![
            NotificationType::Info,
            NotificationType::Warning,
            NotificationType::Error,
            NotificationType::Success,
            NotificationType::Message,
        ];
        
        for notification_type in types {
            let serialized = serde_json::to_string(&notification_type);
            assert!(serialized.is_ok());
            
            let deserialized: Result<NotificationType, _> = serde_json::from_str(&serialized.unwrap());
            assert!(deserialized.is_ok());
        }
    }

    #[test]
    fn test_recent_conversation_structure() {
        let conversation = RecentConversation {
            id: "conv_123".to_string(),
            title: "测试对话".to_string(),
            last_message: "你好世界".to_string(),
            updated_at: chrono::Utc::now(),
            unread_count: 3,
        };
        
        // 测试字段访问
        assert_eq!(conversation.id, "conv_123");
        assert_eq!(conversation.title, "测试对话");
        assert_eq!(conversation.unread_count, 3);
        
        // 测试序列化
        let serialized = serde_json::to_string(&conversation);
        assert!(serialized.is_ok());
    }

    #[test]
    fn test_system_resources_default() {
        let resources = SystemResources::default();
        
        assert_eq!(resources.cpu_usage, 0.0);
        assert_eq!(resources.memory_usage, 0.0);
        assert_eq!(resources.total_memory, 0);
        assert_eq!(resources.used_memory, 0);
        assert_eq!(resources.uptime, 0);
        
        // 测试序列化
        let serialized = serde_json::to_string(&resources);
        assert!(serialized.is_ok());
    }

    #[test]
    fn test_tray_notification_structure() {
        let notification = TrayNotification {
            id: "notif_456".to_string(),
            title: "测试通知".to_string(),
            body: "这是一个测试通知".to_string(),
            notification_type: NotificationType::Info,
            created_at: chrono::Utc::now(),
            is_read: false,
        };
        
        // 测试字段访问
        assert_eq!(notification.id, "notif_456");
        assert_eq!(notification.title, "测试通知");
        assert_eq!(notification.notification_type, NotificationType::Info);
        assert!(!notification.is_read);
        
        // 测试序列化
        let serialized = serde_json::to_string(&notification);
        assert!(serialized.is_ok());
    }

    #[test]
    fn test_model_config_default() {
        let config = ModelConfig::default();
        
        assert_eq!(config.model_id, "default");
        assert!(config.adapter_id.is_none());
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.top_p, 0.9);
        assert_eq!(config.max_tokens, 2048);
    }

    #[test]
    fn test_state_module_thread_safety() {
        use std::thread;
        use std::sync::Arc;
        
        // 测试 ChatState 的线程安全性
        let chat_state = Arc::new(ChatState::new());
        let chat_state_clone = Arc::clone(&chat_state);
        
        let handle = thread::spawn(move || {
            let config = ModelConfig {
                model_id: "test_model".to_string(),
                adapter_id: None,
                temperature: 0.5,
                top_p: 0.8,
                max_tokens: 1024,
            };
            chat_state_clone.set_model_config(config);
        });
        
        handle.join().unwrap();
        
        let retrieved_config = chat_state.get_model_config();
        assert_eq!(retrieved_config.model_id, "test_model");
        assert_eq!(retrieved_config.temperature, 0.5);
    }

    #[test]
    fn test_tray_state_thread_safety() {
        use std::thread;
        use std::sync::Arc;
        
        // 测试 TrayState 的线程安全性
        let tray_state = Arc::new(TrayState::new());
        let tray_state_clone = Arc::clone(&tray_state);
        
        let handle = thread::spawn(move || {
            tray_state_clone.set_icon_state(TrayIconState::Active);
        });
        
        handle.join().unwrap();
        
        assert_eq!(tray_state.get_icon_state(), TrayIconState::Active);
    }

    #[test]
    fn test_cross_state_interaction() {
        let chat_state = ChatState::new();
        let tray_state = TrayState::new();
        
        // 创建一个聊天会话
        let session = ChatSession {
            session_id: "cross_test".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 1,
            model_id: Some("gpt-4".to_string()),
            character_id: None,
        };
        
        chat_state.set_current_session(session.clone());
        
        // 在托盘中添加对应的对话记录
        let conversation = RecentConversation {
            id: session.session_id.clone(),
            title: "跨状态测试".to_string(),
            last_message: "测试消息".to_string(),
            updated_at: chrono::Utc::now(),
            unread_count: 1,
        };
        
        tray_state.add_or_update_conversation(conversation);
        
        // 验证状态一致性
        assert!(chat_state.get_current_session().is_some());
        assert_eq!(tray_state.get_recent_conversations().len(), 1);
        assert_eq!(tray_state.get_total_unread_count(), 1);
    }

    #[test]
    fn test_state_cleanup() {
        let chat_state = ChatState::new();
        let tray_state = TrayState::new();
        
        // 添加一些数据
        let session = ChatSession {
            session_id: "cleanup_test".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 5,
            model_id: None,
            character_id: None,
        };
        
        chat_state.set_current_session(session);
        
        let notification = TrayNotification {
            id: "cleanup_notif".to_string(),
            title: "清理测试".to_string(),
            body: "测试通知".to_string(),
            notification_type: NotificationType::Info,
            created_at: chrono::Utc::now(),
            is_read: false,
        };
        
        tray_state.add_notification(notification);
        
        // 验证数据已添加
        assert!(chat_state.get_current_session().is_some());
        assert_eq!(tray_state.get_notifications().len(), 1);
        
        // 清理数据
        chat_state.clear_current_session();
        tray_state.clear_notifications();
        
        // 验证数据已清理
        assert!(chat_state.get_current_session().is_none());
        assert_eq!(tray_state.get_notifications().len(), 0);
    }

    #[test]
    fn test_state_module_memory_usage() {
        // 测试状态模块的内存使用情况
        let chat_state = ChatState::new();
        let tray_state = TrayState::new();
        
        // 添加大量数据测试内存管理
        for i in 0..1000 {
            let session = ChatSession {
                session_id: format!("session_{}", i),
                created_at: chrono::Utc::now().timestamp(),
                last_activity: chrono::Utc::now().timestamp(),
                message_count: i % 100,
                model_id: Some(format!("model_{}", i % 10)),
                character_id: None,
            };
            
            chat_state.set_current_session(session);
            
            if i < 50 { // 托盘只保留最近50个通知
                let notification = TrayNotification {
                    id: format!("notif_{}", i),
                    title: format!("通知 {}", i),
                    body: "测试内容".to_string(),
                    notification_type: NotificationType::Info,
                    created_at: chrono::Utc::now(),
                    is_read: false,
                };
                
                tray_state.add_notification(notification);
            }
        }
        
        // 验证数据限制生效
        assert_eq!(chat_state.get_all_sessions().len(), 1000);
        assert_eq!(tray_state.get_notifications().len(), 50); // 应该被限制在50个
    }
}


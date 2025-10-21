//! ChatState 聊天状态模块单元测试
//!
//! 测试聊天会话管理、模型配置、API基础URL等功能

use zishu_sensei::state::{ChatState, ChatSession, ModelConfig};

// ========== ChatState 基础测试 ==========

mod chat_state_creation {
    use super::*;

    #[test]
    fn test_new_chat_state_has_default_values() {
        // ========== Arrange (准备) ==========
        // 无需特殊准备

        // ========== Act (执行) ==========
        let state = ChatState::new();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none(), "新建状态应该没有当前会话");
        assert_eq!(state.get_all_sessions().len(), 0, "新建状态应该没有会话列表");
        assert_eq!(state.get_api_base_url(), "http://127.0.0.1:8000", "应该有默认API地址");
        
        let config = state.get_model_config();
        assert_eq!(config.model_id, "default", "应该有默认模型ID");
        assert_eq!(config.temperature, 0.7, "应该有默认温度参数");
    }

    #[test]
    fn test_default_trait_creates_valid_state() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let state = ChatState::default();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }
}

// ========== ChatSession 管理测试 ==========

mod session_management {
    use super::*;

    fn create_test_session(session_id: &str) -> ChatSession {
        ChatSession {
            session_id: session_id.to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        }
    }

    #[test]
    fn test_set_current_session_success() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = create_test_session("test_session_001");

        // ========== Act (执行) ==========
        state.set_current_session(session.clone());

        // ========== Assert (断言) ==========
        let current = state.get_current_session();
        assert!(current.is_some(), "应该设置了当前会话");
        assert_eq!(current.unwrap().session_id, "test_session_001");
        
        // 验证会话也被添加到会话列表中
        let all_sessions = state.get_all_sessions();
        assert_eq!(all_sessions.len(), 1, "会话列表应该有一个会话");
        assert_eq!(all_sessions[0].session_id, "test_session_001");
    }

    #[test]
    fn test_set_current_session_updates_existing() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let mut session = create_test_session("session_001");
        session.message_count = 5;
        state.set_current_session(session);

        // ========== Act (执行) ==========
        let mut updated_session = create_test_session("session_001");
        updated_session.message_count = 10;
        state.set_current_session(updated_session);

        // ========== Assert (断言) ==========
        let current = state.get_current_session().unwrap();
        assert_eq!(current.message_count, 10, "应该更新了消息计数");
        assert_eq!(state.get_all_sessions().len(), 1, "不应该创建新会话");
    }

    #[test]
    fn test_clear_current_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = create_test_session("test_session");
        state.set_current_session(session);
        assert!(state.get_current_session().is_some());

        // ========== Act (执行) ==========
        state.clear_current_session();

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none(), "当前会话应该被清除");
        // 注意：会话仍然保留在会话列表中
        assert_eq!(state.get_all_sessions().len(), 1, "会话列表不应该被影响");
    }

    #[test]
    fn test_get_session_by_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session1 = create_test_session("session_001");
        let session2 = create_test_session("session_002");
        state.set_current_session(session1);
        state.set_current_session(session2);

        // ========== Act (执行) ==========
        let retrieved = state.get_session("session_001");

        // ========== Assert (断言) ==========
        assert!(retrieved.is_some(), "应该能找到会话");
        assert_eq!(retrieved.unwrap().session_id, "session_001");
    }

    #[test]
    fn test_get_session_not_found() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        let result = state.get_session("nonexistent");

        // ========== Assert (断言) ==========
        assert!(result.is_none(), "不存在的会话应该返回None");
    }

    #[test]
    fn test_remove_session_by_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = create_test_session("session_to_remove");
        state.set_current_session(session);
        assert_eq!(state.get_all_sessions().len(), 1);

        // ========== Act (执行) ==========
        state.remove_session("session_to_remove");

        // ========== Assert (断言) ==========
        assert_eq!(state.get_all_sessions().len(), 0, "会话应该被删除");
        assert!(state.get_session("session_to_remove").is_none());
    }

    #[test]
    fn test_remove_current_session_clears_it() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = create_test_session("current_session");
        state.set_current_session(session);
        assert!(state.get_current_session().is_some());

        // ========== Act (执行) ==========
        state.remove_session("current_session");

        // ========== Assert (断言) ==========
        assert!(state.get_current_session().is_none(), "当前会话应该被清除");
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_remove_non_current_session_keeps_current() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session1 = create_test_session("session_001");
        let session2 = create_test_session("session_002");
        state.set_current_session(session1);
        state.set_current_session(session2);
        
        // 将session_001设置为当前会话
        let session1 = state.get_session("session_001").unwrap();
        state.set_current_session(session1);

        // ========== Act (执行) ==========
        state.remove_session("session_002");

        // ========== Assert (断言) ==========
        let current = state.get_current_session();
        assert!(current.is_some(), "当前会话不应该被影响");
        assert_eq!(current.unwrap().session_id, "session_001");
        assert_eq!(state.get_all_sessions().len(), 1);
    }

    #[test]
    fn test_get_all_sessions_returns_all() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        for i in 0..5 {
            let session = create_test_session(&format!("session_{:03}", i));
            state.set_current_session(session);
        }

        // ========== Act (执行) ==========
        let all_sessions = state.get_all_sessions();

        // ========== Assert (断言) ==========
        assert_eq!(all_sessions.len(), 5, "应该返回所有5个会话");
    }

    #[test]
    fn test_update_session_activity() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let mut session = create_test_session("session_001");
        session.message_count = 0;
        session.last_activity = 1000000; // 旧时间戳
        state.set_current_session(session);

        // ========== Act (执行) ==========
        state.update_session_activity("session_001");

        // ========== Assert (断言) ==========
        let updated = state.get_session("session_001").unwrap();
        assert_eq!(updated.message_count, 1, "消息计数应该增加");
        assert!(updated.last_activity > 1000000, "最后活动时间应该更新");
    }

    #[test]
    fn test_update_session_activity_nonexistent_session() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        // 对不存在的会话调用更新，不应该panic
        state.update_session_activity("nonexistent");

        // ========== Assert (断言) ==========
        // 没有panic就是成功
        assert!(state.get_session("nonexistent").is_none());
    }
}

// ========== ModelConfig 管理测试 ==========

mod model_config_management {
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
    fn test_get_initial_model_config() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        let config = state.get_model_config();

        // ========== Assert (断言) ==========
        assert_eq!(config.model_id, "default");
        assert_eq!(config.temperature, 0.7);
    }

    #[test]
    fn test_set_model_config() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let new_config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.8,
            top_p: 0.95,
            max_tokens: 4096,
        };

        // ========== Act (执行) ==========
        state.set_model_config(new_config);

        // ========== Assert (断言) ==========
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.model_id, "gpt-4");
        assert_eq!(retrieved.adapter_id, Some("openai".to_string()));
        assert_eq!(retrieved.temperature, 0.8);
        assert_eq!(retrieved.top_p, 0.95);
        assert_eq!(retrieved.max_tokens, 4096);
    }

    #[test]
    fn test_update_model_config_multiple_times() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        for i in 1..=5 {
            let config = ModelConfig {
                model_id: format!("model_{}", i),
                adapter_id: Some(format!("adapter_{}", i)),
                temperature: 0.1 * i as f32,
                top_p: 0.9,
                max_tokens: 1024 * i as u32,
            };
            state.set_model_config(config);
        }

        // ========== Assert (断言) ==========
        let final_config = state.get_model_config();
        assert_eq!(final_config.model_id, "model_5");
        assert_eq!(final_config.adapter_id, Some("adapter_5".to_string()));
        assert_eq!(final_config.temperature, 0.5);
        assert_eq!(final_config.max_tokens, 5120);
    }

    #[test]
    fn test_model_config_with_extreme_values() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let extreme_config = ModelConfig {
            model_id: "extreme_model".to_string(),
            adapter_id: None,
            temperature: 2.0, // 极端值
            top_p: 1.0,
            max_tokens: 100000,
        };

        // ========== Act (执行) ==========
        state.set_model_config(extreme_config);

        // ========== Assert (断言) ==========
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.temperature, 2.0);
        assert_eq!(retrieved.max_tokens, 100000);
    }

    #[test]
    fn test_model_config_clone() {
        // ========== Arrange (准备) ==========
        let config = ModelConfig {
            model_id: "test_model".to_string(),
            adapter_id: Some("test_adapter".to_string()),
            temperature: 0.5,
            top_p: 0.8,
            max_tokens: 1024,
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
}

// ========== API Base URL 管理测试 ==========

mod api_base_url_management {
    use super::*;

    #[test]
    fn test_default_api_base_url() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        let url = state.get_api_base_url();

        // ========== Assert (断言) ==========
        assert_eq!(url, "http://127.0.0.1:8000");
    }

    #[test]
    fn test_set_api_base_url() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let new_url = "http://localhost:9000".to_string();

        // ========== Act (执行) ==========
        state.set_api_base_url(new_url.clone());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), new_url);
    }

    #[test]
    fn test_set_api_base_url_with_https() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let secure_url = "https://api.example.com".to_string();

        // ========== Act (执行) ==========
        state.set_api_base_url(secure_url.clone());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), secure_url);
    }

    #[test]
    fn test_set_api_base_url_multiple_times() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        state.set_api_base_url("http://server1:8000".to_string());
        state.set_api_base_url("http://server2:8000".to_string());
        state.set_api_base_url("http://server3:8000".to_string());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), "http://server3:8000");
    }

    #[test]
    fn test_set_api_base_url_with_path() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let url_with_path = "http://api.example.com/v1/chat".to_string();

        // ========== Act (执行) ==========
        state.set_api_base_url(url_with_path.clone());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), url_with_path);
    }

    #[test]
    fn test_set_api_base_url_empty_string() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        state.set_api_base_url("".to_string());

        // ========== Assert (断言) ==========
        assert_eq!(state.get_api_base_url(), "");
    }
}

// ========== ChatSession 结构测试 ==========

mod chat_session_struct {
    use super::*;

    #[test]
    fn test_chat_session_creation() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let session = ChatSession {
            session_id: "test_001".to_string(),
            created_at: 1000000,
            last_activity: 1000000,
            message_count: 0,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("char_001".to_string()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(session.session_id, "test_001");
        assert_eq!(session.created_at, 1000000);
        assert_eq!(session.last_activity, 1000000);
        assert_eq!(session.message_count, 0);
        assert_eq!(session.model_id, Some("gpt-4".to_string()));
        assert_eq!(session.character_id, Some("char_001".to_string()));
    }

    #[test]
    fn test_chat_session_with_optional_none() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let session = ChatSession {
            session_id: "test_002".to_string(),
            created_at: 2000000,
            last_activity: 2000000,
            message_count: 5,
            model_id: None,
            character_id: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(session.model_id, None);
        assert_eq!(session.character_id, None);
    }

    #[test]
    fn test_chat_session_clone() {
        // ========== Arrange (准备) ==========
        let session = ChatSession {
            session_id: "test_003".to_string(),
            created_at: 3000000,
            last_activity: 3000000,
            message_count: 10,
            model_id: Some("claude".to_string()),
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
    fn test_chat_session_with_large_message_count() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let session = ChatSession {
            session_id: "test_004".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: u32::MAX,
            model_id: None,
            character_id: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(session.message_count, u32::MAX);
    }
}

// ========== 并发测试 ==========

mod concurrent_operations {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_concurrent_session_operations() {
        // ========== Arrange (准备) ==========
        let state = Arc::new(ChatState::new());
        let mut handles = vec![];

        // ========== Act (执行) ==========
        // 启动多个线程同时操作会话
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let session = ChatSession {
                    session_id: format!("session_{:03}", i),
                    created_at: chrono::Utc::now().timestamp(),
                    last_activity: chrono::Utc::now().timestamp(),
                    message_count: i as u32,
                    model_id: None,
                    character_id: None,
                };
                state_clone.set_current_session(session);
            });
            handles.push(handle);
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // ========== Assert (断言) ==========
        let all_sessions = state.get_all_sessions();
        assert_eq!(all_sessions.len(), 10, "应该有10个会话");
    }

    #[test]
    fn test_concurrent_model_config_updates() {
        // ========== Arrange (准备) ==========
        let state = Arc::new(ChatState::new());
        let mut handles = vec![];

        // ========== Act (执行) ==========
        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let config = ModelConfig {
                    model_id: format!("model_{}", i),
                    adapter_id: None,
                    temperature: 0.1 * i as f32,
                    top_p: 0.9,
                    max_tokens: 1024,
                };
                state_clone.set_model_config(config);
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // ========== Assert (断言) ==========
        // 最终配置应该是某个线程设置的值（不确定是哪个，但应该是有效的）
        let config = state.get_model_config();
        assert!(config.model_id.starts_with("model_"));
    }

    #[test]
    fn test_concurrent_read_operations() {
        // ========== Arrange (准备) ==========
        let state = Arc::new(ChatState::new());
        let session = ChatSession {
            session_id: "shared_session".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        state.set_current_session(session);

        let mut handles = vec![];

        // ========== Act (执行) ==========
        // 多个线程同时读取
        for _ in 0..20 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let _ = state_clone.get_current_session();
                let _ = state_clone.get_all_sessions();
                let _ = state_clone.get_model_config();
                let _ = state_clone.get_api_base_url();
            });
            handles.push(handle);
        }

        // ========== Assert (断言) ==========
        for handle in handles {
            handle.join().unwrap(); // 不应该panic
        }
    }
}

// ========== 集成场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_complete_chat_workflow() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act & Assert (执行 & 断言) ==========
        
        // 1. 设置模型配置
        let config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 4096,
        };
        state.set_model_config(config);

        // 2. 创建新会话
        let session = ChatSession {
            session_id: "chat_001".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("assistant_001".to_string()),
        };
        state.set_current_session(session);

        // 3. 模拟消息交互
        for _ in 0..5 {
            state.update_session_activity("chat_001");
        }

        // 4. 验证状态
        let current = state.get_current_session().unwrap();
        assert_eq!(current.session_id, "chat_001");
        assert_eq!(current.message_count, 5);

        // 5. 切换到新会话
        let new_session = ChatSession {
            session_id: "chat_002".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: Some("gpt-4".to_string()),
            character_id: None,
        };
        state.set_current_session(new_session);

        // 6. 验证切换
        let current = state.get_current_session().unwrap();
        assert_eq!(current.session_id, "chat_002");
        assert_eq!(state.get_all_sessions().len(), 2);

        // 7. 删除旧会话
        state.remove_session("chat_001");
        assert_eq!(state.get_all_sessions().len(), 1);
    }

    #[test]
    fn test_session_cleanup_workflow() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();

        // ========== Act (执行) ==========
        // 创建多个会话
        for i in 0..10 {
            let session = ChatSession {
                session_id: format!("session_{:03}", i),
                created_at: chrono::Utc::now().timestamp(),
                last_activity: chrono::Utc::now().timestamp(),
                message_count: 0,
                model_id: None,
                character_id: None,
            };
            state.set_current_session(session);
        }

        assert_eq!(state.get_all_sessions().len(), 10);

        // 删除部分会话
        for i in 0..5 {
            state.remove_session(&format!("session_{:03}", i));
        }

        // ========== Assert (断言) ==========
        assert_eq!(state.get_all_sessions().len(), 5);
        
        // 验证剩余的会话
        for i in 5..10 {
            assert!(state.get_session(&format!("session_{:03}", i)).is_some());
        }
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_empty_session_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let session = ChatSession {
            session_id: "".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session);

        // ========== Assert (断言) ==========
        let retrieved = state.get_session("");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().session_id, "");
    }

    #[test]
    fn test_very_long_session_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let long_id = "a".repeat(10000);
        let session = ChatSession {
            session_id: long_id.clone(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session);

        // ========== Assert (断言) ==========
        let retrieved = state.get_session(&long_id);
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_special_characters_in_session_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let special_id = "session!@#$%^&*()_+-=[]{}|;':\",./<>?";
        let session = ChatSession {
            session_id: special_id.to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session);

        // ========== Assert (断言) ==========
        let retrieved = state.get_session(special_id);
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_unicode_in_session_id() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let unicode_id = "会话_🚀_测试_😀";
        let session = ChatSession {
            session_id: unicode_id.to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };

        // ========== Act (执行) ==========
        state.set_current_session(session);

        // ========== Assert (断言) ==========
        let retrieved = state.get_session(unicode_id);
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_zero_temperature() {
        // ========== Arrange (准备) ==========
        let state = ChatState::new();
        let config = ModelConfig {
            model_id: "test".to_string(),
            adapter_id: None,
            temperature: 0.0,
            top_p: 1.0,
            max_tokens: 1,
        };

        // ========== Act (执行) ==========
        state.set_model_config(config);

        // ========== Assert (断言) ==========
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.temperature, 0.0);
        assert_eq!(retrieved.max_tokens, 1);
    }
}


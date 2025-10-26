//! # 聊天状态管理模块
//! 
//! 管理聊天会话状态、当前模型配置等

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// 聊天会话状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    /// 会话 ID
    pub session_id: String,
    /// 会话创建时间
    pub created_at: i64,
    /// 最后活动时间
    pub last_activity: i64,
    /// 消息数量
    pub message_count: u32,
    /// 模型 ID
    pub model_id: Option<String>,
    /// 角色 ID
    pub character_id: Option<String>,
}

/// 当前模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// 模型 ID
    pub model_id: String,
    /// 适配器 ID
    pub adapter_id: Option<String>,
    /// 温度参数
    pub temperature: f32,
    /// Top-P 参数
    pub top_p: f32,
    /// 最大 token 数
    pub max_tokens: u32,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            model_id: "default".to_string(),
            adapter_id: None,
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2048,
        }
    }
}

/// 聊天状态管理器
pub struct ChatState {
    /// 当前活动会话
    current_session: Arc<RwLock<Option<ChatSession>>>,
    /// 所有会话
    sessions: Arc<RwLock<HashMap<String, ChatSession>>>,
    /// 当前模型配置
    model_config: Arc<RwLock<ModelConfig>>,
    /// Python API 基础 URL
    api_base_url: Arc<RwLock<String>>,
}

impl ChatState {
    /// 创建新的聊天状态
    pub fn new() -> Self {
        Self {
            current_session: Arc::new(RwLock::new(None)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            model_config: Arc::new(RwLock::new(ModelConfig::default())),
            api_base_url: Arc::new(RwLock::new("http://127.0.0.1:8000".to_string())),
        }
    }

    /// 获取当前会话
    pub fn get_current_session(&self) -> Option<ChatSession> {
        self.current_session.read().clone()
    }

    /// 设置当前会话
    pub fn set_current_session(&self, session: ChatSession) {
        // 先添加到会话列表
        {
            self.sessions.write().insert(session.session_id.clone(), session.clone());
        } // 写锁在这里释放
        
        // 然后设置为当前会话
        {
            *self.current_session.write() = Some(session);
        } // 写锁在这里释放
    }

    /// 获取会话
    pub fn get_session(&self, session_id: &str) -> Option<ChatSession> {
        self.sessions.read().get(session_id).cloned()
    }

    /// 删除会话
    pub fn remove_session(&self, session_id: &str) {
        // 先从会话列表中删除
        {
            self.sessions.write().remove(session_id);
        } // 写锁在这里释放
        
        // 检查是否需要清除当前会话（使用单独的作用域避免死锁）
        let should_clear_current = {
            if let Some(current) = self.current_session.read().as_ref() {
                current.session_id == session_id
            } else {
                false
            }
        }; // 读锁在这里释放
        
        // 如果需要，清除当前会话
        if should_clear_current {
            *self.current_session.write() = None;
        }
    }

    /// 获取所有会话
    pub fn get_all_sessions(&self) -> Vec<ChatSession> {
        self.sessions.read().values().cloned().collect()
    }

    /// 清除当前会话
    pub fn clear_current_session(&self) {
        *self.current_session.write() = None;
    }

    /// 更新会话活动时间
    pub fn update_session_activity(&self, session_id: &str) {
        if let Some(session) = self.sessions.write().get_mut(session_id) {
            session.last_activity = chrono::Utc::now().timestamp();
            session.message_count += 1;
        }
    }

    /// 获取模型配置
    pub fn get_model_config(&self) -> ModelConfig {
        self.model_config.read().clone()
    }

    /// 设置模型配置
    pub fn set_model_config(&self, config: ModelConfig) {
        *self.model_config.write() = config;
    }

    /// 获取 API 基础 URL
    pub fn get_api_base_url(&self) -> String {
        self.api_base_url.read().clone()
    }

    /// 设置 API 基础 URL
    pub fn set_api_base_url(&self, url: String) {
        *self.api_base_url.write() = url;
    }
}

impl Default for ChatState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_state_creation() {
        let state = ChatState::new();
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_session_management() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "test_session".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session.clone());
        
        assert!(state.get_current_session().is_some());
        assert_eq!(state.get_session("test_session").unwrap().session_id, "test_session");
        assert_eq!(state.get_all_sessions().len(), 1);
        
        state.remove_session("test_session");
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_model_config() {
        let state = ChatState::new();
        
        let config = ModelConfig {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.8,
            top_p: 0.95,
            max_tokens: 4096,
        };
        
        state.set_model_config(config.clone());
        
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.model_id, "gpt-4");
        assert_eq!(retrieved.temperature, 0.8);
    }

    // ================================
    // 增强测试覆盖率 - 边界情况和并发测试
    // ================================

    #[test]
    fn test_multiple_sessions() {
        let state = ChatState::new();
        
        // 创建多个会话
        let session1 = ChatSession {
            session_id: "session_1".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 5,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("alice".to_string()),
        };
        
        let session2 = ChatSession {
            session_id: "session_2".to_string(),
            created_at: chrono::Utc::now().timestamp() - 3600,
            last_activity: chrono::Utc::now().timestamp() - 1800,
            message_count: 10,
            model_id: Some("claude".to_string()),
            character_id: Some("bob".to_string()),
        };
        
        // 设置会话
        state.set_current_session(session1.clone());
        state.set_current_session(session2.clone()); // 切换到session2
        
        // 验证当前会话是session2
        let current = state.get_current_session().unwrap();
        assert_eq!(current.session_id, "session_2");
        
        // 验证两个会话都存在
        let all_sessions = state.get_all_sessions();
        assert_eq!(all_sessions.len(), 2);
        
        // 验证可以通过ID获取特定会话
        let retrieved_session1 = state.get_session("session_1").unwrap();
        assert_eq!(retrieved_session1.message_count, 5);
        
        let retrieved_session2 = state.get_session("session_2").unwrap();
        assert_eq!(retrieved_session2.message_count, 10);
    }

    #[test]
    fn test_session_activity_update() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "test_session".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp() - 3600, // 1小时前
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session);
        
        // 更新活动时间
        let before_update = chrono::Utc::now().timestamp();
        state.update_session_activity("test_session");
        let after_update = chrono::Utc::now().timestamp();
        
        // 验证活动时间和消息数量更新
        let updated_session = state.get_session("test_session").unwrap();
        assert!(updated_session.last_activity >= before_update);
        assert!(updated_session.last_activity <= after_update);
        assert_eq!(updated_session.message_count, 1);
        
        // 再次更新
        state.update_session_activity("test_session");
        let final_session = state.get_session("test_session").unwrap();
        assert_eq!(final_session.message_count, 2);
    }

    #[test]
    fn test_session_removal_current_session() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "to_remove".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session);
        
        // 验证当前会话存在
        assert!(state.get_current_session().is_some());
        assert!(state.get_session("to_remove").is_some());
        
        // 删除当前会话
        state.remove_session("to_remove");
        
        // 验证当前会话被清除
        assert!(state.get_current_session().is_none());
        assert!(state.get_session("to_remove").is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_session_removal_non_current_session() {
        let state = ChatState::new();
        
        let current_session = ChatSession {
            session_id: "current".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        let other_session = ChatSession {
            session_id: "other".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(current_session.clone());
        state.set_current_session(other_session); // 这会添加到sessions中
        state.set_current_session(current_session); // 设置current为current_session
        
        // 删除非当前会话
        state.remove_session("other");
        
        // 验证当前会话不受影响
        let current = state.get_current_session().unwrap();
        assert_eq!(current.session_id, "current");
        
        // 验证other会话被删除
        assert!(state.get_session("other").is_none());
        assert_eq!(state.get_all_sessions().len(), 1);
    }

    #[test]
    fn test_nonexistent_session_operations() {
        let state = ChatState::new();
        
        // 尝试获取不存在的会话
        assert!(state.get_session("nonexistent").is_none());
        
        // 尝试删除不存在的会话（不应该崩溃）
        state.remove_session("nonexistent");
        
        // 尝试更新不存在的会话活动（不应该崩溃）
        state.update_session_activity("nonexistent");
        
        // 验证状态没有改变
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_model_config_default_values() {
        let default_config = ModelConfig::default();
        
        assert_eq!(default_config.model_id, "default");
        assert!(default_config.adapter_id.is_none());
        assert_eq!(default_config.temperature, 0.7);
        assert_eq!(default_config.top_p, 0.9);
        assert_eq!(default_config.max_tokens, 2048);
    }

    #[test]
    fn test_model_config_edge_values() {
        let state = ChatState::new();
        
        // 测试极值配置
        let extreme_config = ModelConfig {
            model_id: "".to_string(), // 空字符串
            adapter_id: Some("".to_string()), // 空适配器ID
            temperature: 0.0, // 最小温度
            top_p: 1.0, // 最大top_p
            max_tokens: 1, // 最小token数
        };
        
        state.set_model_config(extreme_config.clone());
        
        let retrieved = state.get_model_config();
        assert_eq!(retrieved.model_id, "");
        assert_eq!(retrieved.adapter_id, Some("".to_string()));
        assert_eq!(retrieved.temperature, 0.0);
        assert_eq!(retrieved.top_p, 1.0);
        assert_eq!(retrieved.max_tokens, 1);
    }

    #[test]
    fn test_api_base_url() {
        let state = ChatState::new();
        
        // 测试默认URL
        assert_eq!(state.get_api_base_url(), "http://127.0.0.1:8000");
        
        // 测试设置新URL
        let new_url = "https://api.example.com:8080";
        state.set_api_base_url(new_url.to_string());
        assert_eq!(state.get_api_base_url(), new_url);
        
        // 测试空URL
        state.set_api_base_url("".to_string());
        assert_eq!(state.get_api_base_url(), "");
        
        // 测试很长的URL
        let long_url = "https://very-long-domain-name-for-testing-purposes.example.com:8080/api/v1/chat";
        state.set_api_base_url(long_url.to_string());
        assert_eq!(state.get_api_base_url(), long_url);
    }

    #[test]
    fn test_chat_session_serialization() {
        let session = ChatSession {
            session_id: "test_serialization".to_string(),
            created_at: 1634567890,
            last_activity: 1634567900,
            message_count: 15,
            model_id: Some("gpt-4".to_string()),
            character_id: Some("alice".to_string()),
        };
        
        // 测试序列化
        let json = serde_json::to_string(&session).expect("序列化失败");
        assert!(json.contains("test_serialization"));
        assert!(json.contains("gpt-4"));
        assert!(json.contains("alice"));
        
        // 测试反序列化
        let deserialized: ChatSession = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.session_id, "test_serialization");
        assert_eq!(deserialized.message_count, 15);
        assert_eq!(deserialized.model_id, Some("gpt-4".to_string()));
        assert_eq!(deserialized.character_id, Some("alice".to_string()));
    }

    #[test]
    fn test_model_config_serialization() {
        let config = ModelConfig {
            model_id: "claude-3".to_string(),
            adapter_id: Some("anthropic".to_string()),
            temperature: 0.5,
            top_p: 0.8,
            max_tokens: 1024,
        };
        
        // 测试序列化
        let json = serde_json::to_string(&config).expect("序列化失败");
        assert!(json.contains("claude-3"));
        assert!(json.contains("anthropic"));
        assert!(json.contains("0.5"));
        
        // 测试反序列化
        let deserialized: ModelConfig = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.model_id, "claude-3");
        assert_eq!(deserialized.adapter_id, Some("anthropic".to_string()));
        assert_eq!(deserialized.temperature, 0.5);
    }

    #[test]
    fn test_concurrent_session_operations() {
        use std::thread;
        use std::sync::Arc;
        
        let state = Arc::new(ChatState::new());
        let mut handles = vec![];
        
        // 创建多个线程同时操作会话
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let session = ChatSession {
                    session_id: format!("session_{}", i),
                    created_at: chrono::Utc::now().timestamp(),
                    last_activity: chrono::Utc::now().timestamp(),
                    message_count: i,
                    model_id: Some(format!("model_{}", i)),
                    character_id: Some(format!("char_{}", i)),
                };
                
                // 设置会话
                state_clone.set_current_session(session);
                
                // 更新活动
                state_clone.update_session_activity(&format!("session_{}", i));
                
                // 获取会话信息
                let retrieved = state_clone.get_session(&format!("session_{}", i));
                assert!(retrieved.is_some());
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }
        
        // 验证所有会话都被创建
        let all_sessions = state.get_all_sessions();
        assert_eq!(all_sessions.len(), 10);
    }

    #[test]
    fn test_concurrent_model_config_operations() {
        use std::thread;
        use std::sync::Arc;
        
        let state = Arc::new(ChatState::new());
        let mut handles = vec![];
        
        // 创建多个线程同时修改模型配置
        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let config = ModelConfig {
                    model_id: format!("model_{}", i),
                    adapter_id: Some(format!("adapter_{}", i)),
                    temperature: 0.1 * i as f32,
                    top_p: 0.8 + 0.02 * i as f32,
                    max_tokens: 1024 + i * 100,
                };
                
                state_clone.set_model_config(config);
                
                // 读取配置
                let retrieved = state_clone.get_model_config();
                assert!(retrieved.model_id.starts_with("model_"));
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }
        
        // 最终配置应该是某个线程设置的值
        let final_config = state.get_model_config();
        assert!(final_config.model_id.starts_with("model_"));
    }

    #[test]
    fn test_session_with_null_optional_fields() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "null_fields_test".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session.clone());
        
        let retrieved = state.get_current_session().unwrap();
        assert_eq!(retrieved.session_id, "null_fields_test");
        assert!(retrieved.model_id.is_none());
        assert!(retrieved.character_id.is_none());
        assert_eq!(retrieved.message_count, 0);
    }

    #[test]
    fn test_state_default_initialization() {
        let state = ChatState::default();
        
        // 验证默认状态
        assert!(state.get_current_session().is_none());
        assert_eq!(state.get_all_sessions().len(), 0);
        
        let default_config = state.get_model_config();
        assert_eq!(default_config.model_id, "default");
        assert_eq!(default_config.temperature, 0.7);
        
        assert_eq!(state.get_api_base_url(), "http://127.0.0.1:8000");
    }

    #[test]
    fn test_clear_current_session() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "to_clear".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 0,
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session);
        assert!(state.get_current_session().is_some());
        
        // 清除当前会话
        state.clear_current_session();
        assert!(state.get_current_session().is_none());
        
        // 但会话仍然存在于sessions中
        assert!(state.get_session("to_clear").is_some());
        assert_eq!(state.get_all_sessions().len(), 1);
    }

    #[test]
    fn test_large_message_count() {
        let state = ChatState::new();
        
        let session = ChatSession {
            session_id: "large_count".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: u32::MAX - 1, // 接近最大值
            model_id: None,
            character_id: None,
        };
        
        state.set_current_session(session);
        
        // 更新活动（这会增加消息计数）
        state.update_session_activity("large_count");
        
        let updated_session = state.get_session("large_count").unwrap();
        assert_eq!(updated_session.message_count, u32::MAX); // 应该达到最大值
    }
}


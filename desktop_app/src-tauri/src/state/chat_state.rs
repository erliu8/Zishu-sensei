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
        *self.current_session.write() = Some(session.clone());
        self.sessions.write().insert(session.session_id.clone(), session);
    }

    /// 清除当前会话
    pub fn clear_current_session(&self) {
        *self.current_session.write() = None;
    }

    /// 获取会话
    pub fn get_session(&self, session_id: &str) -> Option<ChatSession> {
        self.sessions.read().get(session_id).cloned()
    }

    /// 删除会话
    pub fn remove_session(&self, session_id: &str) {
        self.sessions.write().remove(session_id);
        
        // 如果删除的是当前会话，清除当前会话
        if let Some(current) = self.current_session.read().as_ref() {
            if current.session_id == session_id {
                *self.current_session.write() = None;
            }
        }
    }

    /// 获取所有会话
    pub fn get_all_sessions(&self) -> Vec<ChatSession> {
        self.sessions.read().values().cloned().collect()
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
}


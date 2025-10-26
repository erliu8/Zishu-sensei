//! 聊天事件处理模块
//! 
//! 处理聊天相关的事件

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// 聊天消息类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MessageType {
    /// 用户消息
    User,
    /// AI助手消息
    Assistant,
    /// 系统消息
    System,
}

/// 聊天消息结构
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    /// 消息ID
    pub id: Uuid,
    /// 消息类型
    pub message_type: MessageType,
    /// 消息内容
    pub content: String,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 会话ID
    pub session_id: Uuid,
}

/// 聊天会话
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatSession {
    /// 会话ID
    pub id: Uuid,
    /// 会话标题
    pub title: String,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
    /// 是否活跃
    pub is_active: bool,
}

/// 聊天事件类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ChatEvent {
    /// 新消息事件
    NewMessage(ChatMessage),
    /// 会话创建事件
    SessionCreated(ChatSession),
    /// 会话更新事件
    SessionUpdated(ChatSession),
    /// 会话删除事件
    SessionDeleted(Uuid),
    /// 消息删除事件
    MessageDeleted(Uuid),
}

/// 聊天事件处理器
#[derive(Debug)]
pub struct ChatEventHandler {
    /// 活跃会话
    sessions: Arc<RwLock<HashMap<Uuid, ChatSession>>>,
    /// 消息存储
    messages: Arc<RwLock<HashMap<Uuid, Vec<ChatMessage>>>>,
}

impl ChatEventHandler {
    /// 创建新的聊天事件处理器
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            messages: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 处理聊天事件
    pub async fn handle_event(&self, event: ChatEvent) -> Result<(), ChatEventError> {
        match event {
            ChatEvent::NewMessage(message) => self.handle_new_message(message).await,
            ChatEvent::SessionCreated(session) => self.handle_session_created(session).await,
            ChatEvent::SessionUpdated(session) => self.handle_session_updated(session).await,
            ChatEvent::SessionDeleted(session_id) => self.handle_session_deleted(session_id).await,
            ChatEvent::MessageDeleted(message_id) => self.handle_message_deleted(message_id).await,
        }
    }

    /// 处理新消息
    async fn handle_new_message(&self, message: ChatMessage) -> Result<(), ChatEventError> {
        let mut messages = self.messages.write().await;
        let session_messages = messages.entry(message.session_id).or_insert_with(Vec::new);
        session_messages.push(message);
        Ok(())
    }

    /// 处理会话创建
    async fn handle_session_created(&self, session: ChatSession) -> Result<(), ChatEventError> {
        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(&session.id) {
            return Err(ChatEventError::SessionAlreadyExists(session.id));
        }
        sessions.insert(session.id, session);
        Ok(())
    }

    /// 处理会话更新
    async fn handle_session_updated(&self, session: ChatSession) -> Result<(), ChatEventError> {
        let mut sessions = self.sessions.write().await;
        if !sessions.contains_key(&session.id) {
            return Err(ChatEventError::SessionNotFound(session.id));
        }
        sessions.insert(session.id, session);
        Ok(())
    }

    /// 处理会话删除
    async fn handle_session_deleted(&self, session_id: Uuid) -> Result<(), ChatEventError> {
        let mut sessions = self.sessions.write().await;
        let mut messages = self.messages.write().await;
        
        if !sessions.contains_key(&session_id) {
            return Err(ChatEventError::SessionNotFound(session_id));
        }
        
        sessions.remove(&session_id);
        messages.remove(&session_id);
        Ok(())
    }

    /// 处理消息删除
    async fn handle_message_deleted(&self, message_id: Uuid) -> Result<(), ChatEventError> {
        let mut messages = self.messages.write().await;
        
        for session_messages in messages.values_mut() {
            if let Some(pos) = session_messages.iter().position(|msg| msg.id == message_id) {
                session_messages.remove(pos);
                return Ok(());
            }
        }
        
        Err(ChatEventError::MessageNotFound(message_id))
    }

    /// 获取会话数量
    pub async fn session_count(&self) -> usize {
        self.sessions.read().await.len()
    }

    /// 获取会话的消息数量
    pub async fn message_count(&self, session_id: Uuid) -> usize {
        self.messages.read().await
            .get(&session_id)
            .map(|msgs| msgs.len())
            .unwrap_or(0)
    }
}

/// 聊天事件错误类型
#[derive(Debug, thiserror::Error, PartialEq)]
pub enum ChatEventError {
    #[error("会话已存在: {0}")]
    SessionAlreadyExists(Uuid),
    
    #[error("会话未找到: {0}")]
    SessionNotFound(Uuid),
    
    #[error("消息未找到: {0}")]
    MessageNotFound(Uuid),
}

impl Default for ChatEventHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    /// 创建测试用的聊天消息
    fn create_test_message(session_id: Uuid, content: &str) -> ChatMessage {
        ChatMessage {
            id: Uuid::new_v4(),
            message_type: MessageType::User,
            content: content.to_string(),
            created_at: Utc::now(),
            session_id,
        }
    }

    /// 创建测试用的聊天会话
    fn create_test_session(title: &str) -> ChatSession {
        let now = Utc::now();
        ChatSession {
            id: Uuid::new_v4(),
            title: title.to_string(),
            created_at: now,
            updated_at: now,
            is_active: true,
        }
    }

    #[test]
    fn test_message_type_serialization() {
        // Arrange
        let message_types = vec![
            MessageType::User,
            MessageType::Assistant,
            MessageType::System,
        ];

        // Act & Assert
        for msg_type in message_types {
            let serialized = serde_json::to_string(&msg_type).unwrap();
            let deserialized: MessageType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(msg_type, deserialized);
        }
    }

    #[test]
    fn test_chat_message_creation() {
        // Arrange
        let session_id = Uuid::new_v4();
        let content = "Hello, world!";

        // Act
        let message = create_test_message(session_id, content);

        // Assert
        assert_eq!(message.message_type, MessageType::User);
        assert_eq!(message.content, content);
        assert_eq!(message.session_id, session_id);
        assert!(!message.id.is_nil());
    }

    #[test]
    fn test_chat_session_creation() {
        // Arrange
        let title = "Test Session";

        // Act
        let session = create_test_session(title);

        // Assert
        assert_eq!(session.title, title);
        assert!(session.is_active);
        assert!(!session.id.is_nil());
        assert!(session.updated_at >= session.created_at);
    }

    #[tokio::test]
    async fn test_chat_event_handler_creation() {
        // Act
        let handler = ChatEventHandler::new();

        // Assert
        assert_eq!(handler.session_count().await, 0);
    }

    #[tokio::test]
    async fn test_chat_event_handler_default() {
        // Act
        let handler = ChatEventHandler::default();

        // Assert
        assert_eq!(handler.session_count().await, 0);
    }

    #[tokio::test]
    async fn test_handle_session_created_success() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let session_id = session.id;

        // Act
        let result = handler.handle_event(ChatEvent::SessionCreated(session)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.session_count().await, 1);
        assert_eq!(handler.message_count(session_id).await, 0);
    }

    #[tokio::test]
    async fn test_handle_session_created_duplicate_error() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let duplicate_session = session.clone();

        // Act
        let first_result = handler.handle_event(ChatEvent::SessionCreated(session)).await;
        let second_result = handler.handle_event(ChatEvent::SessionCreated(duplicate_session)).await;

        // Assert
        assert!(first_result.is_ok());
        assert!(second_result.is_err());
        
        if let Err(ChatEventError::SessionAlreadyExists(id)) = second_result {
            assert!(!id.is_nil());
        } else {
            panic!("Expected SessionAlreadyExists error");
        }
        
        assert_eq!(handler.session_count().await, 1);
    }

    #[tokio::test]
    async fn test_handle_new_message_success() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let session_id = session.id;
        let message = create_test_message(session_id, "Hello!");

        // 先创建会话
        handler.handle_event(ChatEvent::SessionCreated(session)).await.unwrap();

        // Act
        let result = handler.handle_event(ChatEvent::NewMessage(message)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.message_count(session_id).await, 1);
    }

    #[tokio::test]
    async fn test_handle_multiple_messages() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let session_id = session.id;

        handler.handle_event(ChatEvent::SessionCreated(session)).await.unwrap();

        // Act
        for i in 0..5 {
            let message = create_test_message(session_id, &format!("Message {}", i));
            let result = handler.handle_event(ChatEvent::NewMessage(message)).await;
            assert!(result.is_ok());
        }

        // Assert
        assert_eq!(handler.message_count(session_id).await, 5);
    }

    #[tokio::test]
    async fn test_handle_session_updated_success() {
        // Arrange
        let handler = ChatEventHandler::new();
        let mut session = create_test_session("Original Title");
        let session_id = session.id;
        
        handler.handle_event(ChatEvent::SessionCreated(session.clone())).await.unwrap();
        
        // 修改会话
        session.title = "Updated Title".to_string();
        session.updated_at = Utc::now();

        // Act
        let result = handler.handle_event(ChatEvent::SessionUpdated(session)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.session_count().await, 1);
    }

    #[tokio::test]
    async fn test_handle_session_updated_not_found_error() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Non-existent Session");
        let session_id = session.id;

        // Act
        let result = handler.handle_event(ChatEvent::SessionUpdated(session)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(ChatEventError::SessionNotFound(id)) = result {
            assert_eq!(id, session_id);
        } else {
            panic!("Expected SessionNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_session_deleted_success() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let session_id = session.id;
        let message = create_test_message(session_id, "Test message");
        
        handler.handle_event(ChatEvent::SessionCreated(session)).await.unwrap();
        handler.handle_event(ChatEvent::NewMessage(message)).await.unwrap();
        
        assert_eq!(handler.session_count().await, 1);
        assert_eq!(handler.message_count(session_id).await, 1);

        // Act
        let result = handler.handle_event(ChatEvent::SessionDeleted(session_id)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.session_count().await, 0);
        assert_eq!(handler.message_count(session_id).await, 0);
    }

    #[tokio::test]
    async fn test_handle_session_deleted_not_found_error() {
        // Arrange
        let handler = ChatEventHandler::new();
        let non_existent_id = Uuid::new_v4();

        // Act
        let result = handler.handle_event(ChatEvent::SessionDeleted(non_existent_id)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(ChatEventError::SessionNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected SessionNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_message_deleted_success() {
        // Arrange
        let handler = ChatEventHandler::new();
        let session = create_test_session("Test Session");
        let session_id = session.id;
        let message = create_test_message(session_id, "Test message");
        let message_id = message.id;
        
        handler.handle_event(ChatEvent::SessionCreated(session)).await.unwrap();
        handler.handle_event(ChatEvent::NewMessage(message)).await.unwrap();
        
        assert_eq!(handler.message_count(session_id).await, 1);

        // Act
        let result = handler.handle_event(ChatEvent::MessageDeleted(message_id)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.message_count(session_id).await, 0);
    }

    #[tokio::test]
    async fn test_handle_message_deleted_not_found_error() {
        // Arrange
        let handler = ChatEventHandler::new();
        let non_existent_id = Uuid::new_v4();

        // Act
        let result = handler.handle_event(ChatEvent::MessageDeleted(non_existent_id)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(ChatEventError::MessageNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected MessageNotFound error");
        }
    }

    #[tokio::test]
    async fn test_concurrent_session_operations() {
        // Arrange
        let handler = Arc::new(ChatEventHandler::new());
        let mut handles = vec![];
        
        // Act - 并发创建多个会话
        for i in 0..10 {
            let handler_clone = Arc::clone(&handler);
            let handle = tokio::spawn(async move {
                let session = create_test_session(&format!("Session {}", i));
                handler_clone.handle_event(ChatEvent::SessionCreated(session)).await
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // Assert
        assert_eq!(handler.session_count().await, 10);
    }

    #[tokio::test]
    async fn test_concurrent_message_operations() {
        // Arrange
        let handler = Arc::new(ChatEventHandler::new());
        let session = create_test_session("Test Session");
        let session_id = session.id;
        
        handler.handle_event(ChatEvent::SessionCreated(session)).await.unwrap();
        
        let mut handles = vec![];
        
        // Act - 并发添加多个消息
        for i in 0..20 {
            let handler_clone = Arc::clone(&handler);
            let handle = tokio::spawn(async move {
                let message = create_test_message(session_id, &format!("Message {}", i));
                handler_clone.handle_event(ChatEvent::NewMessage(message)).await
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // Assert
        assert_eq!(handler.message_count(session_id).await, 20);
    }

    #[test]
    fn test_chat_event_error_display() {
        // Arrange
        let session_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();

        // Act & Assert
        let error1 = ChatEventError::SessionAlreadyExists(session_id);
        assert!(error1.to_string().contains("会话已存在"));
        assert!(error1.to_string().contains(&session_id.to_string()));

        let error2 = ChatEventError::SessionNotFound(session_id);
        assert!(error2.to_string().contains("会话未找到"));
        assert!(error2.to_string().contains(&session_id.to_string()));

        let error3 = ChatEventError::MessageNotFound(message_id);
        assert!(error3.to_string().contains("消息未找到"));
        assert!(error3.to_string().contains(&message_id.to_string()));
    }

    #[test]
    fn test_chat_event_error_equality() {
        // Arrange
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        // Act & Assert
        assert_eq!(
            ChatEventError::SessionAlreadyExists(id1),
            ChatEventError::SessionAlreadyExists(id1)
        );
        
        assert_ne!(
            ChatEventError::SessionAlreadyExists(id1),
            ChatEventError::SessionAlreadyExists(id2)
        );
        
        assert_ne!(
            ChatEventError::SessionAlreadyExists(id1),
            ChatEventError::SessionNotFound(id1)
        );
    }
}


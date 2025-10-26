//! 角色事件处理模块
//! 
//! 处理角色相关的事件

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// 角色状态
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CharacterState {
    /// 空闲状态
    Idle,
    /// 说话状态
    Speaking,
    /// 思考状态
    Thinking,
    /// 睡眠状态
    Sleeping,
    /// 播放动画状态
    Animation(String),
}

/// 角色表情
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CharacterExpression {
    /// 默认表情
    Default,
    /// 开心
    Happy,
    /// 悲伤
    Sad,
    /// 惊讶
    Surprised,
    /// 愤怒
    Angry,
    /// 困惑
    Confused,
    /// 眨眼
    Wink,
}

/// 角色配置
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CharacterConfig {
    /// 角色ID
    pub id: Uuid,
    /// 角色名称
    pub name: String,
    /// 角色描述
    pub description: String,
    /// 角色模型路径
    pub model_path: String,
    /// 是否启用语音
    pub voice_enabled: bool,
    /// 语音ID
    pub voice_id: Option<String>,
    /// 默认表情
    pub default_expression: CharacterExpression,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
}

/// 角色状态更新
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CharacterStateUpdate {
    /// 角色ID
    pub character_id: Uuid,
    /// 新状态
    pub new_state: CharacterState,
    /// 新表情
    pub new_expression: Option<CharacterExpression>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 角色事件类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CharacterEvent {
    /// 角色注册事件
    CharacterRegistered(CharacterConfig),
    /// 角色更新事件
    CharacterUpdated(CharacterConfig),
    /// 角色删除事件
    CharacterDeleted(Uuid),
    /// 角色激活事件
    CharacterActivated(Uuid),
    /// 角色停用事件
    CharacterDeactivated(Uuid),
    /// 角色状态更新事件
    StateUpdated(CharacterStateUpdate),
    /// 角色表情更新事件
    ExpressionUpdated { character_id: Uuid, expression: CharacterExpression },
}

/// 角色事件处理器
#[derive(Debug)]
pub struct CharacterEventHandler {
    /// 注册的角色
    characters: Arc<RwLock<HashMap<Uuid, CharacterConfig>>>,
    /// 角色状态
    character_states: Arc<RwLock<HashMap<Uuid, CharacterState>>>,
    /// 角色表情
    character_expressions: Arc<RwLock<HashMap<Uuid, CharacterExpression>>>,
    /// 当前激活的角色ID
    active_character: Arc<RwLock<Option<Uuid>>>,
}

impl CharacterEventHandler {
    /// 创建新的角色事件处理器
    pub fn new() -> Self {
        Self {
            characters: Arc::new(RwLock::new(HashMap::new())),
            character_states: Arc::new(RwLock::new(HashMap::new())),
            character_expressions: Arc::new(RwLock::new(HashMap::new())),
            active_character: Arc::new(RwLock::new(None)),
        }
    }

    /// 处理角色事件
    pub async fn handle_event(&self, event: CharacterEvent) -> Result<(), CharacterEventError> {
        match event {
            CharacterEvent::CharacterRegistered(config) => self.handle_character_registered(config).await,
            CharacterEvent::CharacterUpdated(config) => self.handle_character_updated(config).await,
            CharacterEvent::CharacterDeleted(id) => self.handle_character_deleted(id).await,
            CharacterEvent::CharacterActivated(id) => self.handle_character_activated(id).await,
            CharacterEvent::CharacterDeactivated(id) => self.handle_character_deactivated(id).await,
            CharacterEvent::StateUpdated(update) => self.handle_state_updated(update).await,
            CharacterEvent::ExpressionUpdated { character_id, expression } => {
                self.handle_expression_updated(character_id, expression).await
            }
        }
    }

    /// 处理角色注册
    async fn handle_character_registered(&self, config: CharacterConfig) -> Result<(), CharacterEventError> {
        let mut characters = self.characters.write().await;
        let mut states = self.character_states.write().await;
        let mut expressions = self.character_expressions.write().await;
        
        if characters.contains_key(&config.id) {
            return Err(CharacterEventError::CharacterAlreadyExists(config.id));
        }
        
        // 初始化默认状态和表情
        states.insert(config.id, CharacterState::Idle);
        expressions.insert(config.id, config.default_expression.clone());
        characters.insert(config.id, config);
        
        Ok(())
    }

    /// 处理角色更新
    async fn handle_character_updated(&self, config: CharacterConfig) -> Result<(), CharacterEventError> {
        let mut characters = self.characters.write().await;
        
        if !characters.contains_key(&config.id) {
            return Err(CharacterEventError::CharacterNotFound(config.id));
        }
        
        characters.insert(config.id, config);
        Ok(())
    }

    /// 处理角色删除
    async fn handle_character_deleted(&self, character_id: Uuid) -> Result<(), CharacterEventError> {
        let mut characters = self.characters.write().await;
        let mut states = self.character_states.write().await;
        let mut expressions = self.character_expressions.write().await;
        let mut active = self.active_character.write().await;
        
        if !characters.contains_key(&character_id) {
            return Err(CharacterEventError::CharacterNotFound(character_id));
        }
        
        // 如果删除的是当前激活角色，则清除激活状态
        if *active == Some(character_id) {
            *active = None;
        }
        
        characters.remove(&character_id);
        states.remove(&character_id);
        expressions.remove(&character_id);
        
        Ok(())
    }

    /// 处理角色激活
    async fn handle_character_activated(&self, character_id: Uuid) -> Result<(), CharacterEventError> {
        let characters = self.characters.read().await;
        let mut active = self.active_character.write().await;
        
        if !characters.contains_key(&character_id) {
            return Err(CharacterEventError::CharacterNotFound(character_id));
        }
        
        *active = Some(character_id);
        Ok(())
    }

    /// 处理角色停用
    async fn handle_character_deactivated(&self, character_id: Uuid) -> Result<(), CharacterEventError> {
        let mut active = self.active_character.write().await;
        
        if *active != Some(character_id) {
            return Err(CharacterEventError::CharacterNotActive(character_id));
        }
        
        *active = None;
        Ok(())
    }

    /// 处理状态更新
    async fn handle_state_updated(&self, update: CharacterStateUpdate) -> Result<(), CharacterEventError> {
        let characters = self.characters.read().await;
        let mut states = self.character_states.write().await;
        let mut expressions = self.character_expressions.write().await;
        
        if !characters.contains_key(&update.character_id) {
            return Err(CharacterEventError::CharacterNotFound(update.character_id));
        }
        
        states.insert(update.character_id, update.new_state);
        
        if let Some(expression) = update.new_expression {
            expressions.insert(update.character_id, expression);
        }
        
        Ok(())
    }

    /// 处理表情更新
    async fn handle_expression_updated(&self, character_id: Uuid, expression: CharacterExpression) -> Result<(), CharacterEventError> {
        let characters = self.characters.read().await;
        let mut expressions = self.character_expressions.write().await;
        
        if !characters.contains_key(&character_id) {
            return Err(CharacterEventError::CharacterNotFound(character_id));
        }
        
        expressions.insert(character_id, expression);
        Ok(())
    }

    /// 获取角色数量
    pub async fn character_count(&self) -> usize {
        self.characters.read().await.len()
    }

    /// 获取当前激活的角色ID
    pub async fn get_active_character(&self) -> Option<Uuid> {
        *self.active_character.read().await
    }

    /// 获取角色状态
    pub async fn get_character_state(&self, character_id: Uuid) -> Option<CharacterState> {
        self.character_states.read().await.get(&character_id).cloned()
    }

    /// 获取角色表情
    pub async fn get_character_expression(&self, character_id: Uuid) -> Option<CharacterExpression> {
        self.character_expressions.read().await.get(&character_id).cloned()
    }

    /// 检查角色是否存在
    pub async fn character_exists(&self, character_id: Uuid) -> bool {
        self.characters.read().await.contains_key(&character_id)
    }
}

/// 角色事件错误类型
#[derive(Debug, thiserror::Error, PartialEq)]
pub enum CharacterEventError {
    #[error("角色已存在: {0}")]
    CharacterAlreadyExists(Uuid),
    
    #[error("角色未找到: {0}")]
    CharacterNotFound(Uuid),
    
    #[error("角色未激活: {0}")]
    CharacterNotActive(Uuid),
}

impl Default for CharacterEventHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    /// 创建测试用的角色配置
    fn create_test_character(name: &str) -> CharacterConfig {
        let now = Utc::now();
        CharacterConfig {
            id: Uuid::new_v4(),
            name: name.to_string(),
            description: format!("{} 的描述", name),
            model_path: format!("/models/{}.model", name.to_lowercase()),
            voice_enabled: true,
            voice_id: Some(format!("voice_{}", name.to_lowercase())),
            default_expression: CharacterExpression::Default,
            created_at: now,
            updated_at: now,
        }
    }

    /// 创建测试用的状态更新
    fn create_state_update(character_id: Uuid, state: CharacterState) -> CharacterStateUpdate {
        CharacterStateUpdate {
            character_id,
            new_state: state,
            new_expression: None,
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_character_state_serialization() {
        // Arrange
        let states = vec![
            CharacterState::Idle,
            CharacterState::Speaking,
            CharacterState::Thinking,
            CharacterState::Sleeping,
            CharacterState::Animation("dance".to_string()),
        ];

        // Act & Assert
        for state in states {
            let serialized = serde_json::to_string(&state).unwrap();
            let deserialized: CharacterState = serde_json::from_str(&serialized).unwrap();
            assert_eq!(state, deserialized);
        }
    }

    #[test]
    fn test_character_expression_serialization() {
        // Arrange
        let expressions = vec![
            CharacterExpression::Default,
            CharacterExpression::Happy,
            CharacterExpression::Sad,
            CharacterExpression::Surprised,
            CharacterExpression::Angry,
            CharacterExpression::Confused,
            CharacterExpression::Wink,
        ];

        // Act & Assert
        for expression in expressions {
            let serialized = serde_json::to_string(&expression).unwrap();
            let deserialized: CharacterExpression = serde_json::from_str(&serialized).unwrap();
            assert_eq!(expression, deserialized);
        }
    }

    #[test]
    fn test_character_config_creation() {
        // Arrange
        let name = "测试角色";

        // Act
        let config = create_test_character(name);

        // Assert
        assert_eq!(config.name, name);
        assert!(config.voice_enabled);
        assert!(config.voice_id.is_some());
        assert_eq!(config.default_expression, CharacterExpression::Default);
        assert!(!config.id.is_nil());
    }

    #[tokio::test]
    async fn test_character_event_handler_creation() {
        // Act
        let handler = CharacterEventHandler::new();

        // Assert
        assert_eq!(handler.character_count().await, 0);
        assert!(handler.get_active_character().await.is_none());
    }

    #[tokio::test]
    async fn test_character_event_handler_default() {
        // Act
        let handler = CharacterEventHandler::default();

        // Assert
        assert_eq!(handler.character_count().await, 0);
        assert!(handler.get_active_character().await.is_none());
    }

    #[tokio::test]
    async fn test_handle_character_registered_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterRegistered(config)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.character_count().await, 1);
        assert!(handler.character_exists(character_id).await);
        assert_eq!(handler.get_character_state(character_id).await, Some(CharacterState::Idle));
        assert_eq!(handler.get_character_expression(character_id).await, Some(CharacterExpression::Default));
    }

    #[tokio::test]
    async fn test_handle_character_registered_duplicate_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let duplicate_config = config.clone();

        // Act
        let first_result = handler.handle_event(CharacterEvent::CharacterRegistered(config)).await;
        let second_result = handler.handle_event(CharacterEvent::CharacterRegistered(duplicate_config)).await;

        // Assert
        assert!(first_result.is_ok());
        assert!(second_result.is_err());
        
        if let Err(CharacterEventError::CharacterAlreadyExists(id)) = second_result {
            assert!(!id.is_nil());
        } else {
            panic!("Expected CharacterAlreadyExists error");
        }
        
        assert_eq!(handler.character_count().await, 1);
    }

    #[tokio::test]
    async fn test_handle_character_updated_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let mut config = create_test_character("原始角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config.clone())).await.unwrap();
        
        // 修改配置
        config.name = "更新后的角色".to_string();
        config.updated_at = Utc::now();

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterUpdated(config)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.character_count().await, 1);
        assert!(handler.character_exists(character_id).await);
    }

    #[tokio::test]
    async fn test_handle_character_updated_not_found_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("不存在的角色");
        let character_id = config.id;

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterUpdated(config)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotFound(id)) = result {
            assert_eq!(id, character_id);
        } else {
            panic!("Expected CharacterNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_character_deleted_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("待删除角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        handler.handle_event(CharacterEvent::CharacterActivated(character_id)).await.unwrap();
        
        assert_eq!(handler.character_count().await, 1);
        assert_eq!(handler.get_active_character().await, Some(character_id));

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterDeleted(character_id)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.character_count().await, 0);
        assert!(!handler.character_exists(character_id).await);
        assert!(handler.get_active_character().await.is_none());
        assert!(handler.get_character_state(character_id).await.is_none());
        assert!(handler.get_character_expression(character_id).await.is_none());
    }

    #[tokio::test]
    async fn test_handle_character_deleted_not_found_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let non_existent_id = Uuid::new_v4();

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterDeleted(non_existent_id)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected CharacterNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_character_activated_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterActivated(character_id)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.get_active_character().await, Some(character_id));
    }

    #[tokio::test]
    async fn test_handle_character_activated_not_found_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let non_existent_id = Uuid::new_v4();

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterActivated(non_existent_id)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected CharacterNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_character_deactivated_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        handler.handle_event(CharacterEvent::CharacterActivated(character_id)).await.unwrap();
        
        assert_eq!(handler.get_active_character().await, Some(character_id));

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterDeactivated(character_id)).await;

        // Assert
        assert!(result.is_ok());
        assert!(handler.get_active_character().await.is_none());
    }

    #[tokio::test]
    async fn test_handle_character_deactivated_not_active_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        // 注意：没有激活角色

        // Act
        let result = handler.handle_event(CharacterEvent::CharacterDeactivated(character_id)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotActive(id)) = result {
            assert_eq!(id, character_id);
        } else {
            panic!("Expected CharacterNotActive error");
        }
    }

    #[tokio::test]
    async fn test_handle_state_updated_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        
        let update = create_state_update(character_id, CharacterState::Speaking);

        // Act
        let result = handler.handle_event(CharacterEvent::StateUpdated(update)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.get_character_state(character_id).await, Some(CharacterState::Speaking));
    }

    #[tokio::test]
    async fn test_handle_state_updated_with_expression() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        
        let mut update = create_state_update(character_id, CharacterState::Speaking);
        update.new_expression = Some(CharacterExpression::Happy);

        // Act
        let result = handler.handle_event(CharacterEvent::StateUpdated(update)).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.get_character_state(character_id).await, Some(CharacterState::Speaking));
        assert_eq!(handler.get_character_expression(character_id).await, Some(CharacterExpression::Happy));
    }

    #[tokio::test]
    async fn test_handle_state_updated_not_found_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let non_existent_id = Uuid::new_v4();
        let update = create_state_update(non_existent_id, CharacterState::Speaking);

        // Act
        let result = handler.handle_event(CharacterEvent::StateUpdated(update)).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected CharacterNotFound error");
        }
    }

    #[tokio::test]
    async fn test_handle_expression_updated_success() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();

        // Act
        let result = handler.handle_event(CharacterEvent::ExpressionUpdated {
            character_id,
            expression: CharacterExpression::Happy,
        }).await;

        // Assert
        assert!(result.is_ok());
        assert_eq!(handler.get_character_expression(character_id).await, Some(CharacterExpression::Happy));
    }

    #[tokio::test]
    async fn test_handle_expression_updated_not_found_error() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let non_existent_id = Uuid::new_v4();

        // Act
        let result = handler.handle_event(CharacterEvent::ExpressionUpdated {
            character_id: non_existent_id,
            expression: CharacterExpression::Happy,
        }).await;

        // Assert
        assert!(result.is_err());
        
        if let Err(CharacterEventError::CharacterNotFound(id)) = result {
            assert_eq!(id, non_existent_id);
        } else {
            panic!("Expected CharacterNotFound error");
        }
    }

    #[tokio::test]
    async fn test_multiple_character_management() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let mut configs = vec![];
        
        for i in 0..5 {
            let config = create_test_character(&format!("角色{}", i));
            configs.push(config.clone());
            handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        }

        // Act & Assert
        assert_eq!(handler.character_count().await, 5);
        
        for config in &configs {
            assert!(handler.character_exists(config.id).await);
            assert_eq!(handler.get_character_state(config.id).await, Some(CharacterState::Idle));
            assert_eq!(handler.get_character_expression(config.id).await, Some(CharacterExpression::Default));
        }
    }

    #[tokio::test]
    async fn test_character_activation_switch() {
        // Arrange
        let handler = CharacterEventHandler::new();
        let config1 = create_test_character("角色1");
        let config2 = create_test_character("角色2");
        let id1 = config1.id;
        let id2 = config2.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config1)).await.unwrap();
        handler.handle_event(CharacterEvent::CharacterRegistered(config2)).await.unwrap();

        // Act & Assert - 激活第一个角色
        handler.handle_event(CharacterEvent::CharacterActivated(id1)).await.unwrap();
        assert_eq!(handler.get_active_character().await, Some(id1));

        // Act & Assert - 激活第二个角色（应该覆盖第一个）
        handler.handle_event(CharacterEvent::CharacterActivated(id2)).await.unwrap();
        assert_eq!(handler.get_active_character().await, Some(id2));

        // Act & Assert - 停用第二个角色
        handler.handle_event(CharacterEvent::CharacterDeactivated(id2)).await.unwrap();
        assert!(handler.get_active_character().await.is_none());
    }

    #[tokio::test]
    async fn test_concurrent_character_operations() {
        // Arrange
        let handler = Arc::new(CharacterEventHandler::new());
        let mut handles = vec![];
        
        // Act - 并发注册多个角色
        for i in 0..10 {
            let handler_clone = Arc::clone(&handler);
            let handle = tokio::spawn(async move {
                let config = create_test_character(&format!("并发角色{}", i));
                handler_clone.handle_event(CharacterEvent::CharacterRegistered(config)).await
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // Assert
        assert_eq!(handler.character_count().await, 10);
    }

    #[tokio::test]
    async fn test_concurrent_state_updates() {
        // Arrange
        let handler = Arc::new(CharacterEventHandler::new());
        let config = create_test_character("测试角色");
        let character_id = config.id;
        
        handler.handle_event(CharacterEvent::CharacterRegistered(config)).await.unwrap();
        
        let states = vec![
            CharacterState::Speaking,
            CharacterState::Thinking,
            CharacterState::Sleeping,
            CharacterState::Animation("dance".to_string()),
            CharacterState::Idle,
        ];
        
        let mut handles = vec![];
        
        // Act - 并发更新状态
        for state in states {
            let handler_clone = Arc::clone(&handler);
            let handle = tokio::spawn(async move {
                let update = create_state_update(character_id, state);
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                handler_clone.handle_event(CharacterEvent::StateUpdated(update)).await
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // Assert - 最终状态应该是某个有效状态
        let final_state = handler.get_character_state(character_id).await;
        assert!(final_state.is_some());
    }

    #[test]
    fn test_character_event_error_display() {
        // Arrange
        let character_id = Uuid::new_v4();

        // Act & Assert
        let error1 = CharacterEventError::CharacterAlreadyExists(character_id);
        assert!(error1.to_string().contains("角色已存在"));
        assert!(error1.to_string().contains(&character_id.to_string()));

        let error2 = CharacterEventError::CharacterNotFound(character_id);
        assert!(error2.to_string().contains("角色未找到"));
        assert!(error2.to_string().contains(&character_id.to_string()));

        let error3 = CharacterEventError::CharacterNotActive(character_id);
        assert!(error3.to_string().contains("角色未激活"));
        assert!(error3.to_string().contains(&character_id.to_string()));
    }

    #[test]
    fn test_character_event_error_equality() {
        // Arrange
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        // Act & Assert
        assert_eq!(
            CharacterEventError::CharacterAlreadyExists(id1),
            CharacterEventError::CharacterAlreadyExists(id1)
        );
        
        assert_ne!(
            CharacterEventError::CharacterAlreadyExists(id1),
            CharacterEventError::CharacterAlreadyExists(id2)
        );
        
        assert_ne!(
            CharacterEventError::CharacterAlreadyExists(id1),
            CharacterEventError::CharacterNotFound(id1)
        );
    }

    #[test]
    fn test_character_state_animation_variant() {
        // Arrange
        let animation_name = "custom_dance";
        let state = CharacterState::Animation(animation_name.to_string());

        // Act & Assert
        if let CharacterState::Animation(name) = state {
            assert_eq!(name, animation_name);
        } else {
            panic!("Expected Animation variant");
        }
    }

    #[test]
    fn test_character_config_voice_settings() {
        // Arrange & Act
        let mut config = create_test_character("语音测试角色");
        
        // Assert - 默认启用语音
        assert!(config.voice_enabled);
        assert!(config.voice_id.is_some());
        
        // Act - 禁用语音
        config.voice_enabled = false;
        config.voice_id = None;
        
        // Assert
        assert!(!config.voice_enabled);
        assert!(config.voice_id.is_none());
    }
}


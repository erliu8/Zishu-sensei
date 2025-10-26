//! # 角色状态管理模块
//! 
//! 管理应用中的角色相关状态，包括角色数据、配置、表情、动作等

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use parking_lot::{Mutex, RwLock};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 角色状态管理器
#[derive(Debug)]
pub struct CharacterState {
    /// 当前活跃角色
    current_character: Arc<Mutex<Option<Character>>>,
    /// 已加载的角色列表
    loaded_characters: Arc<RwLock<HashMap<String, Character>>>,
    /// 角色配置
    config: Arc<Mutex<CharacterConfig>>,
    /// 角色历史状态
    history: Arc<Mutex<VecDeque<CharacterStateSnapshot>>>,
    /// 角色表情状态
    expression_state: Arc<Mutex<ExpressionState>>,
    /// 角色动作队列
    action_queue: Arc<Mutex<VecDeque<CharacterAction>>>,
}

/// 角色信息结构
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Character {
    /// 角色ID
    pub id: String,
    /// 角色名称
    pub name: String,
    /// 角色描述
    pub description: String,
    /// Live2D模型路径
    pub model_path: String,
    /// 角色头像路径
    pub avatar_path: String,
    /// 角色创建时间
    pub created_at: DateTime<Utc>,
    /// 最后修改时间
    pub updated_at: DateTime<Utc>,
    /// 角色是否启用
    pub enabled: bool,
    /// 角色版本
    pub version: String,
    /// 角色标签
    pub tags: Vec<String>,
    /// 角色元数据
    pub metadata: HashMap<String, String>,
}

/// 角色配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CharacterConfig {
    /// 缩放比例
    pub scale: f64,
    /// 是否启用自动待机
    pub auto_idle: bool,
    /// 待机时间（秒）
    pub idle_timeout: u64,
    /// 是否启用交互
    pub interaction_enabled: bool,
    /// 动画速度倍率
    pub animation_speed: f64,
    /// 音频音量
    pub audio_volume: f64,
    /// 是否启用语音
    pub voice_enabled: bool,
    /// 语音语言
    pub voice_language: String,
    /// 自定义设置
    pub custom_settings: HashMap<String, String>,
}

/// 角色表情状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionState {
    /// 当前表情
    pub current_expression: String,
    /// 表情强度 (0.0-1.0)
    pub intensity: f64,
    /// 表情持续时间
    pub duration: Option<u64>,
    /// 表情开始时间
    pub started_at: DateTime<Utc>,
    /// 是否循环播放
    pub loop_animation: bool,
    /// 表情队列
    pub expression_queue: VecDeque<String>,
}

/// 角色动作
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CharacterAction {
    /// 动作ID
    pub id: String,
    /// 动作名称
    pub name: String,
    /// 动作类型
    pub action_type: ActionType,
    /// 动作参数
    pub parameters: HashMap<String, String>,
    /// 预期持续时间（毫秒）
    pub duration: Option<u64>,
    /// 优先级 (0-10, 数字越大优先级越高)
    pub priority: u8,
    /// 是否可中断
    pub interruptible: bool,
    /// 创建时间
    pub created_at: DateTime<Utc>,
}

/// 动作类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ActionType {
    /// 表情变化
    Expression,
    /// 姿态变化
    Pose,
    /// 移动
    Movement,
    /// 语音播放
    Speech,
    /// 特效
    Effect,
    /// 自定义
    Custom(String),
}

/// 角色状态快照
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStateSnapshot {
    /// 快照时间
    pub timestamp: DateTime<Utc>,
    /// 角色ID
    pub character_id: Option<String>,
    /// 表情状态
    pub expression_state: ExpressionState,
    /// 配置快照
    pub config: CharacterConfig,
    /// 动作队列长度
    pub action_queue_length: usize,
    /// 快照描述
    pub description: Option<String>,
}

/// 角色状态错误类型
#[derive(Debug, thiserror::Error)]
pub enum CharacterStateError {
    #[error("角色未找到: {0}")]
    CharacterNotFound(String),
    #[error("无效的角色ID: {0}")]
    InvalidCharacterId(String),
    #[error("角色已存在: {0}")]
    CharacterAlreadyExists(String),
    #[error("配置错误: {0}")]
    ConfigError(String),
    #[error("序列化错误: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("状态不一致: {0}")]
    StateInconsistency(String),
    #[error("操作失败: {0}")]
    OperationFailed(String),
}

impl CharacterState {
    /// 创建新的角色状态管理器
    pub fn new() -> Self {
        Self {
            current_character: Arc::new(Mutex::new(None)),
            loaded_characters: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(Mutex::new(CharacterConfig::default())),
            history: Arc::new(Mutex::new(VecDeque::with_capacity(50))),
            expression_state: Arc::new(Mutex::new(ExpressionState::default())),
            action_queue: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    /// 获取当前角色
    pub fn get_current_character(&self) -> Option<Character> {
        self.current_character.lock().clone()
    }

    /// 设置当前角色
    pub fn set_current_character(&self, character: Character) -> Result<(), CharacterStateError> {
        // 验证角色ID
        if character.id.is_empty() {
            return Err(CharacterStateError::InvalidCharacterId("角色ID不能为空".to_string()));
        }

        // 将角色添加到已加载列表
        self.loaded_characters.write().insert(character.id.clone(), character.clone());
        
        // 设置为当前角色
        *self.current_character.lock() = Some(character);
        
        // 创建状态快照
        self.create_snapshot(Some("切换角色".to_string()))?;

        Ok(())
    }

    /// 清除当前角色
    pub fn clear_current_character(&self) {
        *self.current_character.lock() = None;
    }

    /// 获取已加载的角色列表
    pub fn get_loaded_characters(&self) -> HashMap<String, Character> {
        self.loaded_characters.read().clone()
    }

    /// 根据ID获取角色
    pub fn get_character(&self, character_id: &str) -> Option<Character> {
        self.loaded_characters.read().get(character_id).cloned()
    }

    /// 加载角色
    pub fn load_character(&self, character: Character) -> Result<(), CharacterStateError> {
        if character.id.is_empty() {
            return Err(CharacterStateError::InvalidCharacterId("角色ID不能为空".to_string()));
        }

        self.loaded_characters.write().insert(character.id.clone(), character);
        Ok(())
    }

    /// 卸载角色
    pub fn unload_character(&self, character_id: &str) -> Result<(), CharacterStateError> {
        let mut characters = self.loaded_characters.write();
        
        if !characters.contains_key(character_id) {
            return Err(CharacterStateError::CharacterNotFound(character_id.to_string()));
        }

        // 如果是当前角色，则清除当前角色
        if let Some(current) = self.get_current_character() {
            if current.id == character_id {
                self.clear_current_character();
            }
        }

        characters.remove(character_id);
        Ok(())
    }

    /// 获取角色配置
    pub fn get_config(&self) -> CharacterConfig {
        self.config.lock().clone()
    }

    /// 设置角色配置
    pub fn set_config(&self, config: CharacterConfig) -> Result<(), CharacterStateError> {
        // 验证配置
        if config.scale <= 0.0 || config.scale > 5.0 {
            return Err(CharacterStateError::ConfigError("缩放比例必须在0.0到5.0之间".to_string()));
        }

        if config.animation_speed <= 0.0 || config.animation_speed > 10.0 {
            return Err(CharacterStateError::ConfigError("动画速度必须在0.0到10.0之间".to_string()));
        }

        if !(0.0..=1.0).contains(&config.audio_volume) {
            return Err(CharacterStateError::ConfigError("音频音量必须在0.0到1.0之间".to_string()));
        }

        *self.config.lock() = config;
        
        // 创建状态快照
        self.create_snapshot(Some("更新配置".to_string()))?;

        Ok(())
    }

    /// 获取表情状态
    pub fn get_expression_state(&self) -> ExpressionState {
        self.expression_state.lock().clone()
    }

    /// 设置表情
    pub fn set_expression(&self, expression: String, intensity: f64, duration: Option<u64>) -> Result<(), CharacterStateError> {
        if expression.is_empty() {
            return Err(CharacterStateError::ConfigError("表情名称不能为空".to_string()));
        }

        if !(0.0..=1.0).contains(&intensity) {
            return Err(CharacterStateError::ConfigError("表情强度必须在0.0到1.0之间".to_string()));
        }

        let mut state = self.expression_state.lock();
        state.current_expression = expression;
        state.intensity = intensity;
        state.duration = duration;
        state.started_at = Utc::now();

        Ok(())
    }

    /// 添加动作到队列
    pub fn add_action(&self, action: CharacterAction) -> Result<(), CharacterStateError> {
        if action.id.is_empty() {
            return Err(CharacterStateError::ConfigError("动作ID不能为空".to_string()));
        }

        if action.name.is_empty() {
            return Err(CharacterStateError::ConfigError("动作名称不能为空".to_string()));
        }

        let mut queue = self.action_queue.lock();
        
        // 按优先级插入动作
        let insert_index = queue.iter().position(|a| a.priority < action.priority).unwrap_or(queue.len());
        queue.insert(insert_index, action);

        // 限制队列长度
        if queue.len() > 100 {
            queue.pop_back();
        }

        Ok(())
    }

    /// 获取下一个动作
    pub fn get_next_action(&self) -> Option<CharacterAction> {
        self.action_queue.lock().pop_front()
    }

    /// 清空动作队列
    pub fn clear_action_queue(&self) {
        self.action_queue.lock().clear();
    }

    /// 获取动作队列长度
    pub fn get_action_queue_length(&self) -> usize {
        self.action_queue.lock().len()
    }

    /// 创建状态快照
    pub fn create_snapshot(&self, description: Option<String>) -> Result<CharacterStateSnapshot, CharacterStateError> {
        let current_character_id = self.get_current_character().map(|c| c.id);
        let expression_state = self.get_expression_state();
        let config = self.get_config();
        let action_queue_length = self.get_action_queue_length();

        let snapshot = CharacterStateSnapshot {
            timestamp: Utc::now(),
            character_id: current_character_id,
            expression_state,
            config,
            action_queue_length,
            description,
        };

        // 添加到历史记录
        let mut history = self.history.lock();
        history.push_front(snapshot.clone());

        // 限制历史记录长度
        if history.len() > 50 {
            history.pop_back();
        }

        Ok(snapshot)
    }

    /// 获取历史快照
    pub fn get_snapshots(&self) -> Vec<CharacterStateSnapshot> {
        self.history.lock().iter().cloned().collect()
    }

    /// 从快照恢复状态
    pub fn restore_from_snapshot(&self, snapshot: &CharacterStateSnapshot) -> Result<(), CharacterStateError> {
        // 恢复配置
        self.set_config(snapshot.config.clone())?;

        // 恢复表情状态
        *self.expression_state.lock() = snapshot.expression_state.clone();

        // 如果有角色ID，尝试恢复角色
        if let Some(character_id) = &snapshot.character_id {
            if let Some(character) = self.get_character(character_id) {
                self.set_current_character(character)?;
            }
        } else {
            self.clear_current_character();
        }

        Ok(())
    }

    /// 验证状态一致性
    pub fn validate_state(&self) -> Result<(), CharacterStateError> {
        let config = self.get_config();
        
        // 验证配置
        if config.scale <= 0.0 || config.scale > 5.0 {
            return Err(CharacterStateError::StateInconsistency("缩放比例超出有效范围".to_string()));
        }

        if config.animation_speed <= 0.0 || config.animation_speed > 10.0 {
            return Err(CharacterStateError::StateInconsistency("动画速度超出有效范围".to_string()));
        }

        // 验证表情状态
        let expression = self.get_expression_state();
        if !(0.0..=1.0).contains(&expression.intensity) {
            return Err(CharacterStateError::StateInconsistency("表情强度超出有效范围".to_string()));
        }

        // 验证当前角色是否在已加载列表中
        if let Some(current) = self.get_current_character() {
            if !self.loaded_characters.read().contains_key(&current.id) {
                return Err(CharacterStateError::StateInconsistency("当前角色不在已加载列表中".to_string()));
            }
        }

        Ok(())
    }

    /// 重置到默认状态
    pub fn reset_to_default(&self) -> Result<(), CharacterStateError> {
        // 清除当前角色
        self.clear_current_character();

        // 重置配置
        *self.config.lock() = CharacterConfig::default();

        // 重置表情状态
        *self.expression_state.lock() = ExpressionState::default();

        // 清空动作队列
        self.clear_action_queue();

        // 清空历史记录
        self.history.lock().clear();

        // 清空已加载角色
        self.loaded_characters.write().clear();

        Ok(())
    }

    /// 获取状态统计信息
    pub fn get_statistics(&self) -> CharacterStateStatistics {
        let loaded_count = self.loaded_characters.read().len();
        let history_count = self.history.lock().len();
        let action_queue_length = self.get_action_queue_length();
        let current_character_id = self.get_current_character().map(|c| c.id);
        let expression_state = self.get_expression_state();

        CharacterStateStatistics {
            loaded_characters_count: loaded_count,
            history_snapshots_count: history_count,
            action_queue_length,
            current_character_id,
            current_expression: expression_state.current_expression,
            expression_intensity: expression_state.intensity,
        }
    }
}

/// 角色状态统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStateStatistics {
    /// 已加载角色数量
    pub loaded_characters_count: usize,
    /// 历史快照数量
    pub history_snapshots_count: usize,
    /// 动作队列长度
    pub action_queue_length: usize,
    /// 当前角色ID
    pub current_character_id: Option<String>,
    /// 当前表情
    pub current_expression: String,
    /// 表情强度
    pub expression_intensity: f64,
}

// 默认实现
impl Default for CharacterConfig {
    fn default() -> Self {
        Self {
            scale: 1.0,
            auto_idle: true,
            idle_timeout: 300, // 5分钟
            interaction_enabled: true,
            animation_speed: 1.0,
            audio_volume: 0.8,
            voice_enabled: false,
            voice_language: "zh-CN".to_string(),
            custom_settings: HashMap::new(),
        }
    }
}

impl Default for ExpressionState {
    fn default() -> Self {
        Self {
            current_expression: "neutral".to_string(),
            intensity: 1.0,
            duration: None,
            started_at: Utc::now(),
            loop_animation: false,
            expression_queue: VecDeque::new(),
        }
    }
}

impl Character {
    /// 创建新角色
    pub fn new(id: String, name: String, model_path: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            description: String::new(),
            model_path,
            avatar_path: String::new(),
            created_at: now,
            updated_at: now,
            enabled: true,
            version: "1.0.0".to_string(),
            tags: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    /// 更新角色信息
    pub fn update(&mut self) {
        self.updated_at = Utc::now();
    }

    /// 添加标签
    pub fn add_tag(&mut self, tag: String) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.update();
        }
    }

    /// 移除标签
    pub fn remove_tag(&mut self, tag: &str) {
        if let Some(pos) = self.tags.iter().position(|t| t == tag) {
            self.tags.remove(pos);
            self.update();
        }
    }

    /// 设置元数据
    pub fn set_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
        self.update();
    }

    /// 获取元数据
    pub fn get_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.get(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    fn create_test_character(id: &str) -> Character {
        Character::new(
            id.to_string(),
            format!("角色{}", id),
            format!("/models/{}.live2d", id),
        )
    }

    #[test]
    fn test_character_state_new() {
        let state = CharacterState::new();
        assert!(state.get_current_character().is_none());
        assert_eq!(state.get_loaded_characters().len(), 0);
        assert_eq!(state.get_action_queue_length(), 0);
    }

    #[test]
    fn test_set_current_character() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");

        let result = state.set_current_character(character.clone());
        assert!(result.is_ok());

        let current = state.get_current_character();
        assert!(current.is_some());
        assert_eq!(current.unwrap().id, "shizuku");
        assert_eq!(state.get_loaded_characters().len(), 1);
    }

    #[test]
    fn test_set_current_character_invalid_id() {
        let state = CharacterState::new();
        let mut character = create_test_character("test");
        character.id = String::new(); // 空ID

        let result = state.set_current_character(character);
        assert!(result.is_err());
        
        if let Err(CharacterStateError::InvalidCharacterId(msg)) = result {
            assert!(msg.contains("角色ID不能为空"));
        } else {
            panic!("期望 InvalidCharacterId 错误");
        }
    }

    #[test]
    fn test_clear_current_character() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");

        state.set_current_character(character).unwrap();
        assert!(state.get_current_character().is_some());

        state.clear_current_character();
        assert!(state.get_current_character().is_none());
    }

    #[test]
    fn test_load_and_unload_character() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");

        // 加载角色
        let result = state.load_character(character.clone());
        assert!(result.is_ok());
        assert_eq!(state.get_loaded_characters().len(), 1);

        // 获取角色
        let loaded = state.get_character("shizuku");
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap().id, "shizuku");

        // 卸载角色
        let result = state.unload_character("shizuku");
        assert!(result.is_ok());
        assert_eq!(state.get_loaded_characters().len(), 0);
    }

    #[test]
    fn test_unload_nonexistent_character() {
        let state = CharacterState::new();

        let result = state.unload_character("nonexistent");
        assert!(result.is_err());
        
        if let Err(CharacterStateError::CharacterNotFound(id)) = result {
            assert_eq!(id, "nonexistent");
        } else {
            panic!("期望 CharacterNotFound 错误");
        }
    }

    #[test]
    fn test_unload_current_character() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");

        // 设置为当前角色
        state.set_current_character(character).unwrap();
        assert!(state.get_current_character().is_some());

        // 卸载当前角色
        let result = state.unload_character("shizuku");
        assert!(result.is_ok());
        assert!(state.get_current_character().is_none());
        assert_eq!(state.get_loaded_characters().len(), 0);
    }

    #[test]
    fn test_character_config() {
        let state = CharacterState::new();
        let default_config = state.get_config();
        assert_eq!(default_config.scale, 1.0);
        assert!(default_config.auto_idle);

        let mut new_config = CharacterConfig::default();
        new_config.scale = 1.5;
        new_config.audio_volume = 0.6;

        let result = state.set_config(new_config);
        assert!(result.is_ok());

        let updated_config = state.get_config();
        assert_eq!(updated_config.scale, 1.5);
        assert_eq!(updated_config.audio_volume, 0.6);
    }

    #[test]
    fn test_invalid_config() {
        let state = CharacterState::new();

        // 测试无效的缩放比例
        let mut config = CharacterConfig::default();
        config.scale = -1.0; // 无效值

        let result = state.set_config(config);
        assert!(result.is_err());
        
        if let Err(CharacterStateError::ConfigError(msg)) = result {
            assert!(msg.contains("缩放比例"));
        } else {
            panic!("期望 ConfigError 错误");
        }

        // 测试无效的音频音量
        let mut config = CharacterConfig::default();
        config.audio_volume = 1.5; // 超出范围

        let result = state.set_config(config);
        assert!(result.is_err());
    }

    #[test]
    fn test_expression_state() {
        let state = CharacterState::new();
        let default_expression = state.get_expression_state();
        assert_eq!(default_expression.current_expression, "neutral");
        assert_eq!(default_expression.intensity, 1.0);

        let result = state.set_expression("happy".to_string(), 0.8, Some(5000));
        assert!(result.is_ok());

        let updated_expression = state.get_expression_state();
        assert_eq!(updated_expression.current_expression, "happy");
        assert_eq!(updated_expression.intensity, 0.8);
        assert_eq!(updated_expression.duration, Some(5000));
    }

    #[test]
    fn test_invalid_expression() {
        let state = CharacterState::new();

        // 空表情名称
        let result = state.set_expression(String::new(), 1.0, None);
        assert!(result.is_err());

        // 无效强度
        let result = state.set_expression("happy".to_string(), 1.5, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_character_actions() {
        let state = CharacterState::new();
        assert_eq!(state.get_action_queue_length(), 0);

        let action = CharacterAction {
            id: "action1".to_string(),
            name: "挥手".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: Some(3000),
            priority: 5,
            interruptible: true,
            created_at: Utc::now(),
        };

        let result = state.add_action(action);
        assert!(result.is_ok());
        assert_eq!(state.get_action_queue_length(), 1);

        let next_action = state.get_next_action();
        assert!(next_action.is_some());
        assert_eq!(next_action.unwrap().id, "action1");
        assert_eq!(state.get_action_queue_length(), 0);
    }

    #[test]
    fn test_action_priority_queue() {
        let state = CharacterState::new();

        // 添加低优先级动作
        let low_priority_action = CharacterAction {
            id: "low".to_string(),
            name: "低优先级".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: Some(1000),
            priority: 3,
            interruptible: true,
            created_at: Utc::now(),
        };

        // 添加高优先级动作
        let high_priority_action = CharacterAction {
            id: "high".to_string(),
            name: "高优先级".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: Some(1000),
            priority: 8,
            interruptible: false,
            created_at: Utc::now(),
        };

        state.add_action(low_priority_action).unwrap();
        state.add_action(high_priority_action).unwrap();

        // 高优先级动作应该先执行
        let next_action = state.get_next_action();
        assert!(next_action.is_some());
        assert_eq!(next_action.unwrap().id, "high");

        // 然后是低优先级动作
        let next_action = state.get_next_action();
        assert!(next_action.is_some());
        assert_eq!(next_action.unwrap().id, "low");
    }

    #[test]
    fn test_invalid_action() {
        let state = CharacterState::new();

        // 空动作ID
        let action = CharacterAction {
            id: String::new(),
            name: "测试".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: None,
            priority: 5,
            interruptible: true,
            created_at: Utc::now(),
        };

        let result = state.add_action(action);
        assert!(result.is_err());
    }

    #[test]
    fn test_clear_action_queue() {
        let state = CharacterState::new();

        // 添加几个动作
        for i in 0..5 {
            let action = CharacterAction {
                id: format!("action{}", i),
                name: format!("动作{}", i),
                action_type: ActionType::Expression,
                parameters: HashMap::new(),
                duration: Some(1000),
                priority: i,
                interruptible: true,
                created_at: Utc::now(),
            };
            state.add_action(action).unwrap();
        }

        assert_eq!(state.get_action_queue_length(), 5);

        state.clear_action_queue();
        assert_eq!(state.get_action_queue_length(), 0);
    }

    #[test]
    fn test_create_snapshot() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");
        state.set_current_character(character).unwrap();

        let result = state.create_snapshot(Some("测试快照".to_string()));
        assert!(result.is_ok());

        let snapshot = result.unwrap();
        assert_eq!(snapshot.character_id, Some("shizuku".to_string()));
        assert_eq!(snapshot.description, Some("测试快照".to_string()));
    }

    #[test]
    fn test_snapshot_history() {
        let state = CharacterState::new();

        // 创建多个快照
        for i in 0..3 {
            state.create_snapshot(Some(format!("快照{}", i))).unwrap();
        }

        let snapshots = state.get_snapshots();
        assert_eq!(snapshots.len(), 3);

        // 最新的快照应该在前面
        assert_eq!(snapshots[0].description, Some("快照2".to_string()));
        assert_eq!(snapshots[2].description, Some("快照0".to_string()));
    }

    #[test]
    fn test_restore_from_snapshot() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");
        state.set_current_character(character).unwrap();

        // 修改配置
        let mut config = CharacterConfig::default();
        config.scale = 2.0;
        config.audio_volume = 0.5;
        state.set_config(config).unwrap();

        // 创建快照
        let snapshot = state.create_snapshot(Some("保存状态".to_string())).unwrap();

        // 修改状态
        let mut new_config = CharacterConfig::default();
        new_config.scale = 1.5;
        new_config.audio_volume = 0.8;
        state.set_config(new_config).unwrap();
        state.clear_current_character();

        // 从快照恢复
        let result = state.restore_from_snapshot(&snapshot);
        assert!(result.is_ok());

        // 验证状态已恢复
        let restored_config = state.get_config();
        assert_eq!(restored_config.scale, 2.0);
        assert_eq!(restored_config.audio_volume, 0.5);

        let current_character = state.get_current_character();
        assert!(current_character.is_some());
        assert_eq!(current_character.unwrap().id, "shizuku");
    }

    #[test]
    fn test_validate_state() {
        let state = CharacterState::new();

        // 正常状态应该通过验证
        let result = state.validate_state();
        assert!(result.is_ok());

        // 制造状态不一致
        let mut config = CharacterConfig::default();
        config.scale = 10.0; // 超出范围
        state.set_config(config).unwrap_or(()); // 忽略可能的错误

        // 直接修改状态而不验证
        {
            let mut config = state.config.lock();
            config.scale = 10.0;
        }

        let result = state.validate_state();
        assert!(result.is_err());
    }

    #[test]
    fn test_reset_to_default() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");
        state.set_current_character(character).unwrap();

        // 添加一些数据
        let mut config = CharacterConfig::default();
        config.scale = 2.0;
        state.set_config(config).unwrap();

        let action = CharacterAction {
            id: "test_action".to_string(),
            name: "测试动作".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: Some(1000),
            priority: 5,
            interruptible: true,
            created_at: Utc::now(),
        };
        state.add_action(action).unwrap();

        // 验证数据已添加
        assert!(state.get_current_character().is_some());
        assert_eq!(state.get_config().scale, 2.0);
        assert_eq!(state.get_action_queue_length(), 1);
        assert_eq!(state.get_loaded_characters().len(), 1);

        // 重置状态
        let result = state.reset_to_default();
        assert!(result.is_ok());

        // 验证状态已重置
        assert!(state.get_current_character().is_none());
        assert_eq!(state.get_config().scale, 1.0);
        assert_eq!(state.get_action_queue_length(), 0);
        assert_eq!(state.get_loaded_characters().len(), 0);
        assert_eq!(state.get_snapshots().len(), 0);
    }

    #[test]
    fn test_get_statistics() {
        let state = CharacterState::new();
        let character = create_test_character("shizuku");
        state.set_current_character(character).unwrap();

        let action = CharacterAction {
            id: "stat_test".to_string(),
            name: "统计测试".to_string(),
            action_type: ActionType::Expression,
            parameters: HashMap::new(),
            duration: Some(1000),
            priority: 5,
            interruptible: true,
            created_at: Utc::now(),
        };
        state.add_action(action).unwrap();

        let stats = state.get_statistics();
        assert_eq!(stats.loaded_characters_count, 1);
        assert_eq!(stats.action_queue_length, 1);
        assert_eq!(stats.current_character_id, Some("shizuku".to_string()));
        assert_eq!(stats.current_expression, "neutral");
        assert_eq!(stats.expression_intensity, 1.0);
    }

    #[test]
    fn test_thread_safety() {
        let state = Arc::new(CharacterState::new());
        let mut handles = vec![];

        // 启动多个线程同时操作状态
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let character = create_test_character(&format!("char_{}", i));
                let _ = state_clone.set_current_character(character);
                
                let action = CharacterAction {
                    id: format!("action_{}", i),
                    name: format!("动作{}", i),
                    action_type: ActionType::Expression,
                    parameters: HashMap::new(),
                    duration: Some(1000),
                    priority: (i % 10) as u8,
                    interruptible: true,
                    created_at: Utc::now(),
                };
                let _ = state_clone.add_action(action);
            });
            handles.push(handle);
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // 验证状态仍然一致
        let result = state.validate_state();
        assert!(result.is_ok());
        assert_eq!(state.get_loaded_characters().len(), 10);
        assert_eq!(state.get_action_queue_length(), 10);
    }

    #[test]
    fn test_character_creation_and_modification() {
        let mut character = Character::new(
            "test_id".to_string(),
            "测试角色".to_string(),
            "/models/test.live2d".to_string(),
        );

        assert_eq!(character.id, "test_id");
        assert_eq!(character.name, "测试角色");
        assert!(character.enabled);
        assert_eq!(character.version, "1.0.0");

        // 测试添加标签
        character.add_tag("可爱".to_string());
        character.add_tag("AI".to_string());
        assert_eq!(character.tags.len(), 2);

        // 测试重复标签
        character.add_tag("可爱".to_string());
        assert_eq!(character.tags.len(), 2);

        // 测试移除标签
        character.remove_tag("可爱");
        assert_eq!(character.tags.len(), 1);
        assert_eq!(character.tags[0], "AI");

        // 测试元数据
        character.set_metadata("creator".to_string(), "Zishu Team".to_string());
        assert_eq!(character.get_metadata("creator"), Some(&"Zishu Team".to_string()));
        assert_eq!(character.get_metadata("nonexistent"), None);
    }

    #[test]
    fn test_action_type_serialization() {
        let action_types = vec![
            ActionType::Expression,
            ActionType::Pose,
            ActionType::Movement,
            ActionType::Speech,
            ActionType::Effect,
            ActionType::Custom("自定义类型".to_string()),
        ];

        for action_type in action_types {
            let serialized = serde_json::to_string(&action_type);
            assert!(serialized.is_ok());

            let deserialized: Result<ActionType, _> = serde_json::from_str(&serialized.unwrap());
            assert!(deserialized.is_ok());
        }
    }

    #[test]
    fn test_character_state_error_display() {
        let errors = vec![
            CharacterStateError::CharacterNotFound("test".to_string()),
            CharacterStateError::InvalidCharacterId("invalid".to_string()),
            CharacterStateError::CharacterAlreadyExists("exists".to_string()),
            CharacterStateError::ConfigError("config error".to_string()),
            CharacterStateError::StateInconsistency("inconsistent".to_string()),
            CharacterStateError::OperationFailed("operation failed".to_string()),
        ];

        for error in errors {
            let error_string = error.to_string();
            assert!(!error_string.is_empty());
        }
    }

    #[test]
    fn test_queue_size_limit() {
        let state = CharacterState::new();

        // 添加超过限制的动作
        for i in 0..150 {
            let action = CharacterAction {
                id: format!("action_{}", i),
                name: format!("动作{}", i),
                action_type: ActionType::Expression,
                parameters: HashMap::new(),
                duration: Some(1000),
                priority: 5,
                interruptible: true,
                created_at: Utc::now(),
            };
            state.add_action(action).unwrap();
        }

        // 队列长度应该被限制在100
        assert_eq!(state.get_action_queue_length(), 100);
    }

    #[test]
    fn test_snapshot_history_limit() {
        let state = CharacterState::new();

        // 创建超过限制的快照
        for i in 0..60 {
            state.create_snapshot(Some(format!("快照{}", i))).unwrap();
        }

        let snapshots = state.get_snapshots();
        // 历史记录应该被限制在50个
        assert_eq!(snapshots.len(), 50);

        // 最新的快照应该保留
        assert_eq!(snapshots[0].description, Some("快照59".to_string()));
    }

    #[test]
    fn test_expression_queue_functionality() {
        let state = CharacterState::new();
        let mut expression_state = state.get_expression_state();
        
        // 测试表情队列操作
        expression_state.expression_queue.push_back("happy".to_string());
        expression_state.expression_queue.push_back("sad".to_string());
        
        assert_eq!(expression_state.expression_queue.len(), 2);
        
        let next_expression = expression_state.expression_queue.pop_front();
        assert_eq!(next_expression, Some("happy".to_string()));
        assert_eq!(expression_state.expression_queue.len(), 1);
    }

    #[test]
    fn test_concurrent_character_operations() {
        let state = Arc::new(CharacterState::new());
        let handles: Vec<_> = (0..5).map(|i| {
            let state_clone = Arc::clone(&state);
            thread::spawn(move || {
                // 每个线程加载一个角色
                let character = create_test_character(&format!("concurrent_{}", i));
                state_clone.load_character(character).unwrap();
                
                // 短暂延迟模拟真实场景
                thread::sleep(Duration::from_millis(10));
                
                // 获取角色数量
                state_clone.get_loaded_characters().len()
            })
        }).collect();

        let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        
        // 所有线程都应该成功执行
        assert_eq!(results.len(), 5);
        
        // 最终应该有5个角色
        assert_eq!(state.get_loaded_characters().len(), 5);
    }

    #[test]
    fn test_expression_timing() {
        let state = CharacterState::new();
        
        let start_time = Utc::now();
        state.set_expression("happy".to_string(), 0.8, Some(1000)).unwrap();
        
        let expression_state = state.get_expression_state();
        assert_eq!(expression_state.current_expression, "happy");
        assert_eq!(expression_state.duration, Some(1000));
        
        // 验证开始时间是最近的
        let time_diff = expression_state.started_at.signed_duration_since(start_time);
        assert!(time_diff.num_milliseconds() < 100); // 应该在100ms内
    }
}

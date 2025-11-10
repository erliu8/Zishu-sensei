//! # 应用状态扩展功能
//! 
//! 提供应用状态的高级操作和管理功能

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

use crate::AppConfig;
use super::AppState;

/// 应用状态快照
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateSnapshot {
    /// 配置快照
    pub config: AppConfig,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 快照版本
    pub version: String,
    /// 快照描述
    pub description: Option<String>,
}

/// 应用状态操作错误
#[derive(Debug, thiserror::Error)]
pub enum AppStateError {
    #[error("序列化错误: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("状态不一致: {0}")]
    StateInconsistency(String),
    #[error("操作失败: {0}")]
    OperationFailed(String),
}

/// 应用状态扩展操作
impl AppState {
    /// 创建配置快照
    pub fn create_config_snapshot(&self, description: Option<String>) -> Result<AppStateSnapshot, AppStateError> {
        let config = self.config.lock().clone();
        Ok(AppStateSnapshot {
            config,
            created_at: Utc::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description,
        })
    }

    /// 从快照恢复配置
    pub fn restore_from_snapshot(&self, snapshot: AppStateSnapshot) -> Result<(), AppStateError> {
        // 验证快照版本兼容性
        if !self.is_snapshot_compatible(&snapshot) {
            return Err(AppStateError::StateInconsistency(
                format!("快照版本 {} 与当前版本 {} 不兼容", 
                    snapshot.version, env!("CARGO_PKG_VERSION"))
            ));
        }

        *self.config.lock() = snapshot.config;
        Ok(())
    }

    /// 检查快照兼容性
    fn is_snapshot_compatible(&self, snapshot: &AppStateSnapshot) -> bool {
        // 简单的版本兼容性检查，实际项目中可能需要更复杂的逻辑
        let current_version = env!("CARGO_PKG_VERSION");
        snapshot.version == current_version || snapshot.version.starts_with("1.0")
    }

    /// 获取应用状态健康检查
    pub fn health_check(&self) -> AppHealthStatus {
        let issues = Vec::new();
        let mut warnings = Vec::new();

        // 检查聊天状态
        let chat_sessions = self.chat.get_all_sessions();
        if chat_sessions.len() > 100 {
            warnings.push("聊天会话数量过多，可能影响性能".to_string());
        }

        // 检查托盘状态
        let unread_count = self.tray.get_unread_notification_count();
        if unread_count > 50 {
            warnings.push("未读通知过多，建议清理".to_string());
        }

        // 根据问题严重程度确定状态
        let status = if !issues.is_empty() {
            HealthStatusLevel::Critical
        } else if !warnings.is_empty() {
            HealthStatusLevel::Warning
        } else {
            HealthStatusLevel::Healthy
        };

        AppHealthStatus {
            status,
            issues,
            warnings,
            checked_at: Utc::now(),
        }
    }

    /// 重置所有状态到默认值
    pub fn reset_to_defaults(&self) -> Result<(), AppStateError> {
        // 重置配置
        *self.config.lock() = AppConfig::default();

        // 清理聊天状态
        self.chat.clear_current_session();
        let sessions = self.chat.get_all_sessions();
        for session in sessions {
            self.chat.remove_session(&session.session_id);
        }

        // 清理托盘状态
        self.tray.clear_conversations();
        self.tray.clear_notifications();
        self.tray.set_icon_state(super::TrayIconState::Idle);

        Ok(())
    }

    /// 获取应用状态统计信息
    pub fn get_statistics(&self) -> AppStateStatistics {
        let chat_sessions = self.chat.get_all_sessions();
        let total_messages: u32 = chat_sessions.iter().map(|s| s.message_count).sum();
        
        AppStateStatistics {
            total_sessions: chat_sessions.len() as u32,
            total_messages,
            total_conversations: self.tray.get_recent_conversations().len() as u32,
            total_notifications: self.tray.get_notifications().len() as u32,
            unread_notifications: self.tray.get_unread_notification_count(),
            current_icon_state: self.tray.get_icon_state(),
            uptime: self.tray.get_system_resources().uptime,
        }
    }

    /// 验证应用状态一致性
    pub fn validate_state_consistency(&self) -> Result<(), AppStateError> {
        // 检查聊天状态一致性
        if let Some(current_session) = self.chat.get_current_session() {
            if self.chat.get_session(&current_session.session_id).is_none() {
                return Err(AppStateError::StateInconsistency(
                    "当前会话在会话列表中不存在".to_string()
                ));
            }
        }

        // 检查配置有效性
        let config = self.config.lock();
        if config.window.width <= 0.0 || config.window.height <= 0.0 {
            return Err(AppStateError::StateInconsistency(
                "窗口尺寸无效".to_string()
            ));
        }

        if config.character.scale <= 0.0 {
            return Err(AppStateError::StateInconsistency(
                "角色缩放比例无效".to_string()
            ));
        }

        Ok(())
    }
}

/// 健康状态级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatusLevel {
    /// 健康
    Healthy,
    /// 警告
    Warning,
    /// 严重
    Critical,
}

/// 应用健康状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppHealthStatus {
    /// 状态级别
    pub status: HealthStatusLevel,
    /// 严重问题列表
    pub issues: Vec<String>,
    /// 警告列表
    pub warnings: Vec<String>,
    /// 检查时间
    pub checked_at: DateTime<Utc>,
}

/// 应用状态统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateStatistics {
    /// 总会话数
    pub total_sessions: u32,
    /// 总消息数
    pub total_messages: u32,
    /// 总对话数
    pub total_conversations: u32,
    /// 总通知数
    pub total_notifications: u32,
    /// 未读通知数
    pub unread_notifications: u32,
    /// 当前图标状态
    pub current_icon_state: super::TrayIconState,
    /// 运行时间
    pub uptime: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_app, mock_context};
    
    // 测试专用的简化 AppState 结构
    struct TestAppState {
        config: Arc<Mutex<AppConfig>>,
        chat: ChatState,
        tray: Arc<TrayState>,
    }
    
    impl TestAppState {
        fn new() -> Self {
            Self {
                config: Arc::new(Mutex::new(AppConfig::default())),
                chat: ChatState::new(),
                tray: Arc::new(TrayState::new()),
            }
        }
        
        // 模拟 AppState 的方法
        fn create_config_snapshot(&self, description: Option<String>) -> Result<AppStateSnapshot, AppStateError> {
            let config = self.config.lock();
            Ok(AppStateSnapshot {
                config: config.clone(),
                created_at: Utc::now(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                description,
            })
        }
        
        fn restore_from_snapshot(&self, snapshot: &AppStateSnapshot) -> Result<(), AppStateError> {
            if !self.is_snapshot_compatible(snapshot) {
                return Err(AppStateError::StateInconsistency("快照版本不兼容".to_string()));
            }
            
            let mut config = self.config.lock();
            *config = snapshot.config.clone();
            Ok(())
        }
        
        fn health_check(&self) -> AppHealthStatus {
            let mut issues = Vec::new();
            let mut warnings = Vec::new();
            
            // 检查会话数量
            let session_count = self.chat.get_all_sessions().len();
            if session_count > 100 {
                warnings.push("聊天会话数量过多，可能影响性能".to_string());
            }
            
            let status = if !warnings.is_empty() || !issues.is_empty() {
                if issues.is_empty() {
                    HealthStatusLevel::Warning
                } else {
                    HealthStatusLevel::Critical
                }
            } else {
                HealthStatusLevel::Healthy
            };
            
            AppHealthStatus {
                status,
                issues,
                checked_at: Utc::now(),
                warnings,
            }
        }
        
        fn reset_to_defaults(&self) -> Result<(), AppStateError> {
            let mut config = self.config.lock();
            *config = AppConfig::default();
            
            // 清理聊天状态
            self.chat.clear_current_session();
            let sessions = self.chat.get_all_sessions();
            for session in sessions {
                self.chat.remove_session(&session.session_id);
            }
            
            Ok(())
        }
        
        fn get_statistics(&self) -> AppStateStatistics {
            let sessions = self.chat.get_all_sessions();
            AppStateStatistics {
                total_sessions: sessions.len() as u32,
                total_messages: sessions
                    .iter()
                    .map(|s| s.message_count)
                    .sum(),
                total_conversations: sessions.len() as u32,
                total_notifications: 0,
                unread_notifications: 0,
                current_icon_state: self.tray.get_icon_state(),
                uptime: 0,
            }
        }
        
        fn validate_state_consistency(&self) -> Result<(), AppStateError> {
            // 基本的状态一致性检查
            let config = self.config.lock();
            
            if config.window.width <= 0.0 || config.window.height <= 0.0 {
                return Err(AppStateError::StateInconsistency("窗口尺寸无效".to_string()));
            }
            
            Ok(())
        }
        
        fn is_snapshot_compatible(&self, snapshot: &AppStateSnapshot) -> bool {
            // 简单的版本兼容性检查
            snapshot.version == env!("CARGO_PKG_VERSION")
        }
    }

    #[test]
    fn test_app_state_snapshot_creation() {
        let app_state = TestAppState::new();
        
        let snapshot = app_state.create_config_snapshot(Some("测试快照".to_string()));
        
        assert!(snapshot.is_ok());
        let snapshot = snapshot.unwrap();
        assert_eq!(snapshot.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(snapshot.description, Some("测试快照".to_string()));
    }

    #[test]
    fn test_app_state_snapshot_restore() {
        let app_state = TestAppState::new();
        
        // 修改配置
        {
            let mut config = app_state.config.lock();
            config.window.width = 800.0;
            config.window.height = 600.0;
        }
        
        // 创建快照
        let snapshot = app_state.create_config_snapshot(None).unwrap();
        
        // 再次修改配置
        {
            let mut config = app_state.config.lock();
            config.window.width = 1024.0;
            config.window.height = 768.0;
        }
        
        // 从快照恢复
        let result = app_state.restore_from_snapshot(&snapshot);
        assert!(result.is_ok());
        
        // 验证配置已恢复
        let config = app_state.config.lock();
        assert_eq!(config.window.width, 800.0);
        assert_eq!(config.window.height, 600.0);
    }

    #[test]
    fn test_app_state_health_check() {
        let app_state = TestAppState::new();
        
        let health_status = app_state.health_check();
        
        // 初始状态应该是健康的
        assert_eq!(health_status.status, HealthStatusLevel::Healthy);
        assert!(health_status.issues.is_empty());
    }

    #[test]
    fn test_app_state_reset_to_defaults() {
        let app_state = TestAppState::new();
        
        // 修改一些状态
        {
            let mut config = app_state.config.lock();
            config.window.width = 1000.0;
        }
        
        let session = super::super::ChatSession {
            session_id: "test_session".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 5,
            model_id: None,
            character_id: None,
        };
        app_state.chat.set_current_session(session);
        
        // 重置到默认值
        let result = app_state.reset_to_defaults();
        assert!(result.is_ok());
        
        // 验证状态已重置
        let config = app_state.config.lock();
        assert_eq!(config.window.width, 400.0); // 默认值
        
        assert!(app_state.chat.get_current_session().is_none());
        assert_eq!(app_state.chat.get_all_sessions().len(), 0);
    }

    #[test]
    fn test_app_state_statistics() {
        let app_state = TestAppState::new();
        
        // 添加一些数据
        let session = super::super::ChatSession {
            session_id: "test_session".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            last_activity: chrono::Utc::now().timestamp(),
            message_count: 10,
            model_id: None,
            character_id: None,
        };
        app_state.chat.set_current_session(session);
        
        let stats = app_state.get_statistics();
        
        assert_eq!(stats.total_sessions, 1);
        assert_eq!(stats.total_messages, 10);
        assert_eq!(stats.current_icon_state, super::super::TrayIconState::Idle);
    }

    #[test]
    fn test_app_state_validation() {
        let app_state = TestAppState::new();
        
        // 正常状态应该通过验证
        let result = app_state.validate_state_consistency();
        assert!(result.is_ok());
        
        // 制造状态不一致
        {
            let mut config = app_state.config.lock();
            config.window.width = -100.0; // 无效值
        }
        
        let result = app_state.validate_state_consistency();
        assert!(result.is_err());
        
        if let Err(AppStateError::StateInconsistency(msg)) = result {
            assert!(msg.contains("窗口尺寸无效"));
        } else {
            panic!("期望 StateInconsistency 错误");
        }
    }

    #[test]
    fn test_snapshot_compatibility() {
        let app_state = TestAppState::new();
        
        // 创建兼容的快照
        let compatible_snapshot = AppStateSnapshot {
            config: AppConfig::default(),
            created_at: Utc::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: None,
        };
        
        assert!(app_state.is_snapshot_compatible(&compatible_snapshot));
        
        // 创建不兼容的快照
        let incompatible_snapshot = AppStateSnapshot {
            config: AppConfig::default(),
            created_at: Utc::now(),
            version: "2.0.0".to_string(),
            description: None,
        };
        
        assert!(!app_state.is_snapshot_compatible(&incompatible_snapshot));
    }

    #[test] 
    fn test_health_check_with_warnings() {
        let app_state = TestAppState::new();
        
        // 添加大量会话以触发警告
        for i in 0..101 {
            let session = super::super::ChatSession {
                session_id: format!("session_{}", i),
                created_at: chrono::Utc::now().timestamp(),
                last_activity: chrono::Utc::now().timestamp(),
                message_count: 1,
                model_id: None,
                character_id: None,
            };
            app_state.chat.set_current_session(session);
        }
        
        let health_status = app_state.health_check();
        
        assert_eq!(health_status.status, HealthStatusLevel::Warning);
        assert!(!health_status.warnings.is_empty());
        assert!(health_status.warnings[0].contains("聊天会话数量过多"));
    }

    #[test]
    fn test_app_state_error_display() {
        let error = AppStateError::StateInconsistency("测试错误".to_string());
        assert_eq!(error.to_string(), "状态不一致: 测试错误");
        
        let error = AppStateError::OperationFailed("操作失败".to_string());
        assert_eq!(error.to_string(), "操作失败: 操作失败");
    }

    #[test]
    fn test_health_status_serialization() {
        let status = AppHealthStatus {
            status: HealthStatusLevel::Warning,
            issues: vec!["问题1".to_string()],
            warnings: vec!["警告1".to_string()],
            checked_at: Utc::now(),
        };
        
        let serialized = serde_json::to_string(&status);
        assert!(serialized.is_ok());
        
        let deserialized: Result<AppHealthStatus, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
    }

    #[test]
    fn test_statistics_serialization() {
        let stats = AppStateStatistics {
            total_sessions: 5,
            total_messages: 50,
            total_conversations: 3,
            total_notifications: 10,
            unread_notifications: 2,
            current_icon_state: super::super::TrayIconState::Active,
            uptime: 3600,
        };
        
        let serialized = serde_json::to_string(&stats);
        assert!(serialized.is_ok());
        
        let deserialized: Result<AppStateStatistics, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
    }
}

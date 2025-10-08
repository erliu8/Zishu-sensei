//! # Zishu Sensei Desktop Pet Library
//! 
//! 这是 Zishu Sensei 桌面宠物应用的核心库，提供了完整的功能模块和 API。
//! 
//! ## 功能模块
//! 
//! - **commands**: Tauri 命令处理
//! - **events**: 事件系统和处理
//! - **state**: 应用状态管理
//! - **utils**: 工具函数和辅助功能
//! - **database**: 数据库操作和管理
//! - **adapter**: 适配器系统
//! - **character**: 角色管理
//! - **chat**: 聊天功能
//! - **settings**: 设置管理
//! - **desktop**: 桌面操作
//! - **system**: 系统功能
//! - **window**: 窗口管理
//! - **system_monitor**: 系统监控
//! 
//! ## 使用示例
//! 
//! ```rust
//! use zishu_sensei::{AppState, AppConfig, ZishuResult};
//! 
//! // 创建应用状态
//! let app_state = AppState::new(app_handle).await?;
//! 
//! // 加载配置
//! let config = load_config(&app_handle).await?;
//! ```

#![warn(missing_docs)]
#![warn(clippy::all)]
#![allow(clippy::module_inception)]

use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

// ================================
// 核心模块导出
// ================================

/// 命令处理模块
pub mod commands {
    /// 聊天相关命令
    pub mod chat;
    /// 角色相关命令
    pub mod character;
    /// 设置相关命令
    pub mod settings;
    /// 适配器相关命令
    pub mod adapter;
    /// 桌面操作命令
    pub mod desktop;
    /// 系统相关命令
    pub mod system;
    /// 窗口管理命令
    pub mod window;
}

/// 事件系统模块
pub mod events;

/// 应用状态管理模块
pub mod state;

/// 工具函数模块
pub mod utils;

/// 数据库操作模块
pub mod database;

/// 适配器系统模块
pub mod adapter;

/// 系统监控模块
pub mod system_monitor;

// ================================
// 公共类型定义
// ================================

/// 应用统一错误类型
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum ZishuError {
    /// 配置相关错误
    #[error("配置错误: {message}")]
    Config { message: String },
    
    /// 数据库相关错误
    #[error("数据库错误: {message}")]
    Database { message: String },
    
    /// 网络相关错误
    #[error("网络错误: {message}")]
    Network { message: String },
    
    /// 文件系统错误
    #[error("文件系统错误: {message}")]
    FileSystem { message: String },
    
    /// 序列化/反序列化错误
    #[error("序列化错误: {message}")]
    Serialization { message: String },
    
    /// 适配器相关错误
    #[error("适配器错误: {message}")]
    Adapter { message: String },
    
    /// 角色相关错误
    #[error("角色错误: {message}")]
    Character { message: String },
    
    /// 聊天相关错误
    #[error("聊天错误: {message}")]
    Chat { message: String },
    
    /// 窗口相关错误
    #[error("窗口错误: {message}")]
    Window { message: String },
    
    /// 系统相关错误
    #[error("系统错误: {message}")]
    System { message: String },
    
    /// 权限相关错误
    #[error("权限错误: {message}")]
    Permission { message: String },
    
    /// 验证相关错误
    #[error("验证错误: {message}")]
    Validation { message: String },
    
    /// 未知错误
    #[error("未知错误: {message}")]
    Unknown { message: String },
}

/// 应用统一结果类型
pub type ZishuResult<T> = Result<T, ZishuError>;

/// 应用配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 窗口配置
    pub window: WindowConfig,
    /// 角色配置
    pub character: CharacterConfig,
    /// 主题配置
    pub theme: ThemeConfig,
    /// 系统配置
    pub system: SystemConfig,
}

/// 窗口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    /// 窗口宽度
    pub width: f64,
    /// 窗口高度
    pub height: f64,
    /// 始终置顶
    pub always_on_top: bool,
    /// 透明窗口
    pub transparent: bool,
    /// 窗口装饰
    pub decorations: bool,
    /// 可调整大小
    pub resizable: bool,
    /// 窗口位置
    pub position: Option<(i32, i32)>,
}

/// 角色配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    /// 当前角色
    pub current_character: String,
    /// 缩放比例
    pub scale: f64,
    /// 自动待机
    pub auto_idle: bool,
    /// 启用交互
    pub interaction_enabled: bool,
}

/// 主题配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    /// 当前主题
    pub current_theme: String,
    /// 自定义CSS
    pub custom_css: Option<String>,
}

/// 系统配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    /// 开机自启
    pub auto_start: bool,
    /// 最小化到托盘
    pub minimize_to_tray: bool,
    /// 关闭到托盘
    pub close_to_tray: bool,
    /// 显示通知
    pub show_notifications: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            window: WindowConfig {
                width: 400.0,
                height: 600.0,
                always_on_top: true,
                transparent: true,
                decorations: false,
                resizable: true,
                position: None,
            },
            character: CharacterConfig {
                current_character: "shizuku".to_string(),
                scale: 1.0,
                auto_idle: true,
                interaction_enabled: true,
            },
            theme: ThemeConfig {
                current_theme: "anime".to_string(),
                custom_css: None,
            },
            system: SystemConfig {
                auto_start: false,
                minimize_to_tray: true,
                close_to_tray: true,
                show_notifications: true,
            },
        }
    }
}

// ================================
// 核心 Trait 定义
// ================================

/// 适配器 Trait
pub trait Adapter: Send + Sync {
    /// 适配器名称
    fn name(&self) -> &str;
    
    /// 适配器版本
    fn version(&self) -> &str;
    
    /// 适配器描述
    fn description(&self) -> &str;
    
    /// 初始化适配器
    fn initialize(&mut self) -> ZishuResult<()>;
    
    /// 执行适配器
    fn execute(&self, input: &str) -> ZishuResult<String>;
    
    /// 获取配置
    fn get_config(&self) -> ZishuResult<serde_json::Value>;
    
    /// 设置配置
    fn set_config(&mut self, config: serde_json::Value) -> ZishuResult<()>;
    
    /// 清理资源
    fn cleanup(&mut self) -> ZishuResult<()>;
}

/// 角色 Trait
pub trait Character: Send + Sync {
    /// 角色名称
    fn name(&self) -> &str;
    
    /// 角色描述
    fn description(&self) -> &str;
    
    /// 角色模型路径
    fn model_path(&self) -> &str;
    
    /// 播放动作
    fn play_motion(&self, motion: &str) -> ZishuResult<()>;
    
    /// 设置表情
    fn set_expression(&self, expression: &str) -> ZishuResult<()>;
    
    /// 获取可用动作
    fn get_motions(&self) -> Vec<String>;
    
    /// 获取可用表情
    fn get_expressions(&self) -> Vec<String>;
}

/// 聊天模型 Trait
pub trait ChatModel: Send + Sync {
    /// 模型名称
    fn name(&self) -> &str;
    
    /// 发送消息
    async fn send_message(&self, message: &str) -> ZishuResult<String>;
    
    /// 获取配置
    fn get_config(&self) -> ZishuResult<serde_json::Value>;
    
    /// 设置配置
    fn set_config(&mut self, config: serde_json::Value) -> ZishuResult<()>;
}

// ================================
// 公共数据结构
// ================================

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    /// 消息ID
    pub id: String,
    /// 消息内容
    pub content: String,
    /// 消息类型
    pub message_type: MessageType,
    /// 时间戳
    pub timestamp: i64,
    /// 元数据
    pub metadata: Option<serde_json::Value>,
}

/// 消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    /// 用户消息
    User,
    /// 助手消息
    Assistant,
    /// 系统消息
    System,
}

/// 适配器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterInfo {
    /// 适配器ID
    pub id: String,
    /// 适配器名称
    pub name: String,
    /// 版本
    pub version: String,
    /// 描述
    pub description: String,
    /// 作者
    pub author: String,
    /// 是否已安装
    pub installed: bool,
    /// 是否已启用
    pub enabled: bool,
    /// 配置
    pub config: Option<serde_json::Value>,
}

/// 角色信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterInfo {
    /// 角色ID
    pub id: String,
    /// 角色名称
    pub name: String,
    /// 描述
    pub description: String,
    /// 模型路径
    pub model_path: String,
    /// 预览图
    pub preview_image: Option<String>,
    /// 可用动作
    pub motions: Vec<String>,
    /// 可用表情
    pub expressions: Vec<String>,
}

/// 工作流定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// 工作流ID
    pub id: String,
    /// 工作流名称
    pub name: String,
    /// 描述
    pub description: String,
    /// 步骤列表
    pub steps: Vec<WorkflowStep>,
    /// 是否已启用
    pub enabled: bool,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 工作流步骤
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// 步骤ID
    pub id: String,
    /// 步骤名称
    pub name: String,
    /// 适配器ID
    pub adapter_id: String,
    /// 输入参数
    pub input: serde_json::Value,
    /// 输出映射
    pub output_mapping: Option<serde_json::Value>,
    /// 条件
    pub condition: Option<String>,
}

/// 系统信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    /// 操作系统
    pub os: String,
    /// 系统版本
    pub os_version: String,
    /// 架构
    pub arch: String,
    /// 内存总量
    pub total_memory: u64,
    /// 可用内存
    pub available_memory: u64,
    /// CPU 使用率
    pub cpu_usage: f32,
    /// 磁盘使用情况
    pub disk_usage: Vec<DiskInfo>,
}

/// 磁盘信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    /// 磁盘名称
    pub name: String,
    /// 总容量
    pub total_space: u64,
    /// 可用空间
    pub available_space: u64,
    /// 使用率
    pub usage_percentage: f32,
}

// ================================
// 错误转换实现
// ================================

impl From<std::io::Error> for ZishuError {
    fn from(err: std::io::Error) -> Self {
        ZishuError::FileSystem {
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ZishuError {
    fn from(err: serde_json::Error) -> Self {
        ZishuError::Serialization {
            message: err.to_string(),
        }
    }
}

impl From<reqwest::Error> for ZishuError {
    fn from(err: reqwest::Error) -> Self {
        ZishuError::Network {
            message: err.to_string(),
        }
    }
}

impl From<sqlx::Error> for ZishuError {
    fn from(err: sqlx::Error) -> Self {
        ZishuError::Database {
            message: err.to_string(),
        }
    }
}

impl From<tauri::Error> for ZishuError {
    fn from(err: tauri::Error) -> Self {
        ZishuError::System {
            message: err.to_string(),
        }
    }
}

// ================================
// 公共函数导出
// ================================

pub use state::AppState;
pub use utils::*;
pub use database::*;

/// 加载应用配置
pub async fn load_config(app_handle: &tauri::AppHandle) -> ZishuResult<AppConfig> {
    utils::load_config(app_handle).await
}

/// 保存应用配置
pub async fn save_config(app_handle: &tauri::AppHandle, config: &AppConfig) -> ZishuResult<()> {
    utils::save_config(app_handle, config).await
}

/// 初始化应用
pub async fn initialize_app(app_handle: &tauri::AppHandle) -> ZishuResult<()> {
    // 初始化数据库
    database::init_database(app_handle).await?;
    
    // 初始化适配器系统
    adapter::init_adapter_system(app_handle).await?;
    
    // 启动系统监控
    system_monitor::start_system_monitor(app_handle.clone()).await?;
    
    Ok(())
}

/// 清理应用资源
pub async fn cleanup_app(app_handle: &tauri::AppHandle) -> ZishuResult<()> {
    // 停止系统监控
    system_monitor::stop_system_monitor().await?;
    
    // 清理适配器系统
    adapter::cleanup_adapter_system().await?;
    
    // 关闭数据库连接
    database::close_database().await?;
    
    Ok(())
}

// ================================
// 常量定义
// ================================

/// 应用名称
pub const APP_NAME: &str = "Zishu Sensei";

/// 应用版本
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// 配置文件名
pub const CONFIG_FILE_NAME: &str = "config.json";

/// 数据库文件名
pub const DATABASE_FILE_NAME: &str = "zishu_sensei.db";

/// 日志文件名前缀
pub const LOG_FILE_PREFIX: &str = "zishu-sensei";

/// 默认角色
pub const DEFAULT_CHARACTER: &str = "shizuku";

/// 默认主题
pub const DEFAULT_THEME: &str = "anime";

/// API 基础 URL
pub const API_BASE_URL: &str = "https://api.zishu.dev";

/// 市场 URL
pub const MARKET_URL: &str = "https://market.zishu.dev";

/// 更新检查 URL
pub const UPDATE_URL: &str = "https://update.zishu.dev";

// ================================
// 宏定义
// ================================

/// 创建错误的便捷宏
#[macro_export]
macro_rules! zishu_error {
    ($variant:ident, $msg:expr) => {
        ZishuError::$variant {
            message: $msg.to_string(),
        }
    };
    ($variant:ident, $fmt:expr, $($arg:tt)*) => {
        ZishuError::$variant {
            message: format!($fmt, $($arg)*),
        }
    };
}

/// 日志记录宏
#[macro_export]
macro_rules! log_error {
    ($err:expr) => {
        tracing::error!("错误: {}", $err);
    };
    ($msg:expr, $err:expr) => {
        tracing::error!("{}: {}", $msg, $err);
    };
}

/// 结果处理宏
#[macro_export]
macro_rules! handle_result {
    ($result:expr) => {
        match $result {
            Ok(val) => val,
            Err(err) => {
                log_error!(err);
                return Err(err);
            }
        }
    };
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.character.current_character, "shizuku");
        assert_eq!(config.theme.current_theme, "anime");
        assert!(config.window.always_on_top);
        assert!(config.system.close_to_tray);
    }

    #[test]
    fn test_error_creation() {
        let error = zishu_error!(Config, "测试错误");
        match error {
            ZishuError::Config { message } => assert_eq!(message, "测试错误"),
            _ => panic!("错误类型不匹配"),
        }
    }

    #[test]
    fn test_chat_message_serialization() {
        let message = ChatMessage {
            id: "test-id".to_string(),
            content: "测试消息".to_string(),
            message_type: MessageType::User,
            timestamp: 1234567890,
            metadata: None,
        };

        let json = serde_json::to_string(&message).unwrap();
        let deserialized: ChatMessage = serde_json::from_str(&json).unwrap();
        
        assert_eq!(message.id, deserialized.id);
        assert_eq!(message.content, deserialized.content);
    }
}

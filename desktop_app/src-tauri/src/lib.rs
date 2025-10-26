//! Zishu-sensei 桌面应用库
//!
//! 这个库模块暴露给测试使用，避免代码重复

// 导入模块
pub mod commands;
pub mod events;
pub mod state;
pub mod utils;
pub mod adapter;
pub mod system_monitor;
pub mod database;
pub mod workflow;

// 重新导出常用类型供测试使用
pub use state::{
    AppState, ChatState, ChatSession, ModelConfig,
    TrayState, TrayIconState, RecentConversation, SystemResources, 
    TrayNotification, NotificationType,
};

// 重新导出命令相关类型
pub use commands::ZishuResult;

// 重新导出配置类型
pub use app_config::{AppConfig, WindowConfig, CharacterConfig, ThemeConfig, SystemConfig};

// 导入和重新导出AppConfig等配置类型
mod app_config {
    use serde::{Deserialize, Serialize};

    /// 应用配置结构
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AppConfig {
        pub window: WindowConfig,
        pub character: CharacterConfig,
        pub theme: ThemeConfig,
        pub system: SystemConfig,
    }

    /// 窗口配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct WindowConfig {
        pub width: f64,
        pub height: f64,
        pub always_on_top: bool,
        pub transparent: bool,
        pub decorations: bool,
        pub resizable: bool,
        pub position: Option<(i32, i32)>,
    }

    /// 角色配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CharacterConfig {
        pub current_character: String,
        pub scale: f64,
        pub auto_idle: bool,
        pub interaction_enabled: bool,
    }

    /// 主题配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ThemeConfig {
        pub current_theme: String,
        pub custom_css: Option<String>,
    }

    /// 系统配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SystemConfig {
        pub auto_start: bool,
        pub minimize_to_tray: bool,
        pub close_to_tray: bool,
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
}


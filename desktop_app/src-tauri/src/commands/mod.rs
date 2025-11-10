//! # Tauri 命令模块
//! 
//! 这个模块包含了所有 Tauri 应用的命令处理器，提供前端与后端之间的 API 接口。
//! 
//! ## 模块结构
//! 
//! - **chat**: 聊天相关命令
//! - **character**: 角色管理命令
//! - **settings**: 设置管理命令
//! - **adapter**: 适配器系统命令
//! - **desktop**: 桌面操作命令
//! - **system**: 系统功能命令
//! - **window**: 窗口管理命令
//! - **database**: 数据库操作命令
//! - **workflow**: 工作流管理命令
//! - **market**: 市场相关命令
//! - **update**: 更新检查命令
//! 
//! ## 使用示例
//! 
//! ```rust
//! use crate::commands::*;
//! 
//! // 在 main.rs 中注册所有命令
//! tauri::Builder::default()
//!     .invoke_handler(tauri::generate_handler![
//!         // 聊天命令
//!         send_message,
//!         get_chat_history,
//!         clear_chat_history,
//!         // 角色命令
//!         get_characters,
//!         switch_character,
//!         // ... 更多命令
//!     ])
//!     .run(tauri::generate_context!())
//!     .expect("error while running tauri application");
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;


/// Simplified result type for command handlers
pub type ZishuResult<T> = Result<T, String>;

// ================================
// 子模块声明
// ================================

/// 聊天相关命令
pub mod chat;

/// 角色管理命令
pub mod character;

/// 设置管理命令
pub mod settings;

/// 适配器系统命令
pub mod adapter;

/// 桌面操作命令
pub mod desktop;

/// 系统功能命令
pub mod system;

/// 窗口管理命令
pub mod window;

/// 数据库操作命令
pub mod database;

/// 工作流管理命令
pub mod workflow;

/// 市场相关命令
pub mod market;

/// 更新检查命令
pub mod update;

/// 快捷键管理命令
pub mod shortcuts;

/// 模型配置管理命令
pub mod model_config;

/// 文件管理命令
pub mod file;

/// 加密相关命令
pub mod encryption;

/// 权限管理命令
pub mod permission;

/// 隐私保护命令
pub mod privacy;

/// 内存管理命令
pub mod memory;

/// 渲染性能命令
pub mod rendering;

/// 语言设置命令
pub mod language;

/// 区域适配命令
pub mod region;

/// 性能监控命令
pub mod performance;

/// 日志管理命令
pub mod logging;

/// Deep Link 处理命令
pub mod deeplink;

/// 启动相关命令
pub mod startup;

/// 错误监控命令
pub mod error_monitoring;

/// 主题管理命令
pub mod theme;

/// 本地LLM模型管理命令
pub mod local_llm;

/// Prompt管理命令
pub mod prompt;

// ================================
// 公共命令类型定义
// ================================

/// 命令响应结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse<T> {
    /// 是否成功
    pub success: bool,
    /// 响应数据
    pub data: Option<T>,
    /// 错误信息
    pub error: Option<String>,
    /// 响应消息
    pub message: Option<String>,
    /// 时间戳
    pub timestamp: i64,
}

impl<T> CommandResponse<T> {
    /// 创建成功响应
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            message: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// 创建成功响应（带消息）
    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            message: Some(message),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// 创建错误响应
    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            message: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// 从错误创建错误响应
    pub fn from_error(err: impl ToString) -> Self {
        Self::error(err.to_string())
    }
}

/// 分页请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    /// 页码（从1开始）
    pub page: u32,
    /// 每页大小
    pub page_size: u32,
    /// 排序字段
    pub sort_by: Option<String>,
    /// 排序方向
    pub sort_order: Option<SortOrder>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: 20,
            sort_by: None,
            sort_order: Some(SortOrder::Desc),
        }
    }
}

/// 排序方向
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    /// 升序
    Asc,
    /// 降序
    Desc,
}

/// 分页响应数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    /// 数据列表
    pub items: Vec<T>,
    /// 总数量
    pub total: u32,
    /// 当前页码
    pub page: u32,
    /// 每页大小
    pub page_size: u32,
    /// 总页数
    pub total_pages: u32,
    /// 是否有下一页
    pub has_next: bool,
    /// 是否有上一页
    pub has_prev: bool,
}

impl<T> PaginatedResponse<T> {
    /// 创建分页响应
    pub fn new(items: Vec<T>, total: u32, page: u32, page_size: u32) -> Self {
        let total_pages = (total + page_size - 1) / page_size;
        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        }
    }
}

/// 搜索参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchParams {
    /// 搜索关键词
    pub query: String,
    /// 搜索字段
    pub fields: Option<Vec<String>>,
    /// 过滤条件
    pub filters: Option<HashMap<String, serde_json::Value>>,
    /// 分页参数
    pub pagination: Option<PaginationParams>,
}

// ================================
// 命令处理宏
// ================================

/// 创建命令处理器的宏
#[macro_export]
macro_rules! create_command {
    ($name:ident, $handler:expr) => {
        #[tauri::command]
        pub async fn $name(
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(app_handle, state).await {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
    ($name:ident, $input:ty, $handler:expr) => {
        #[tauri::command]
        pub async fn $name(
            input: $input,
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(input, app_handle, state).await {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
    ($name:ident, $input:ty, $output:ty, $handler:expr) => {
        #[tauri::command]
        pub async fn $name(
            input: $input,
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<$output>, String> {
            match $handler(input, app_handle, state).await {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
}

/// 创建带窗口的命令处理器的宏
#[macro_export]
macro_rules! create_window_command {
    ($name:ident, $handler:expr) => {
        #[tauri::command]
        pub async fn $name(
            window: Window,
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(window, app_handle, state).await {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
    ($name:ident, $input:ty, $handler:expr) => {
        #[tauri::command]
        pub async fn $name(
            input: $input,
            window: Window,
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(input, window, app_handle, state).await {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
}

/// 创建同步命令处理器的宏
#[macro_export]
macro_rules! create_sync_command {
    ($name:ident, $handler:expr) => {
        #[tauri::command]
        pub fn $name(
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(app_handle, state) {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
    ($name:ident, $input:ty, $handler:expr) => {
        #[tauri::command]
        pub fn $name(
            input: $input,
            app_handle: AppHandle,
            state: State<'_, AppState>,
        ) -> Result<CommandResponse<serde_json::Value>, String> {
            match $handler(input, app_handle, state) {
                Ok(data) => Ok(CommandResponse::success(data)),
                Err(err) => Ok(CommandResponse::from_error(err)),
            }
        }
    };
}

// ================================
// 通用命令处理函数
// ================================

/// 验证命令参数
pub fn validate_params<T>(_params: &T) -> ZishuResult<()>
where
    T: serde::Serialize,
{
    // 这里可以添加通用的参数验证逻辑
    // 例如：检查必填字段、数据格式等
    Ok(())
}

/// 记录命令执行日志
pub fn log_command_execution(command_name: &str, params: Option<&str>) {
    if let Some(params) = params {
        tracing::info!("执行命令: {} 参数: {}", command_name, params);
    } else {
        tracing::info!("执行命令: {}", command_name);
    }
}

/// 处理命令错误
pub fn handle_command_error(command_name: &str, error: &str) -> String {
    let error_msg = format!("命令 {} 执行失败: {}", command_name, error);
    tracing::error!("{}", error_msg);
    error_msg
}

/// 创建空响应
pub fn empty_response() -> serde_json::Value {
    serde_json::json!({})
}

/// 创建成功消息响应
pub fn success_message(message: &str) -> serde_json::Value {
    serde_json::json!({
        "message": message
    })
}

// ================================
// 命令权限检查
// ================================

/// 权限级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum PermissionLevel {
    /// 公开权限
    Public,
    /// 用户权限
    User,
    /// 管理员权限
    Admin,
    /// 系统权限
    System,
}

/// 检查命令权限
pub fn check_permission(
    _command_name: &str,
    _required_level: PermissionLevel,
) -> ZishuResult<()> {
    // 这里可以实现具体的权限检查逻辑
    // 例如：检查用户角色、API 密钥等
    Ok(())
}

/// 权限检查装饰器宏
#[macro_export]
macro_rules! require_permission {
    ($level:expr, $handler:expr) => {
        |app_handle, state| async move {
            check_permission("command", $level)?;
            $handler(app_handle, state).await
        }
    };
}

// ================================
// 命令注册辅助函数
// ================================

/// 获取所有命令处理器
pub fn get_all_command_handlers() -> Vec<Box<dyn Fn() + Send + Sync>> {
    vec![
        // 这里将在各个子模块中实现具体的命令处理器注册
    ]
}

/// 命令元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMetadata {
    /// 命令名称
    pub name: String,
    /// 命令描述
    pub description: String,
    /// 参数类型
    pub input_type: Option<String>,
    /// 返回类型
    pub output_type: Option<String>,
    /// 权限要求
    pub required_permission: PermissionLevel,
    /// 是否异步
    pub is_async: bool,
    /// 分类
    pub category: String,
}

/// 获取命令元数据
pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    // 聊天命令
    metadata.extend(chat::get_command_metadata());
    
    // 角色命令
    metadata.extend(character::get_command_metadata());
    
    // 设置命令
    metadata.extend(settings::get_command_metadata());
    
    // 适配器命令
    metadata.extend(adapter::get_command_metadata());
    
    // 桌面命令
    metadata.extend(desktop::get_command_metadata());
    
    // 系统命令
    metadata.extend(system::get_command_metadata());
    
    // 窗口命令
    metadata.extend(window::get_command_metadata());
    
    // 数据库命令
    metadata.extend(database::get_command_metadata());
    
    // 工作流命令
    metadata.extend(workflow::get_command_metadata());
    
    // 市场命令
    metadata.extend(market::get_command_metadata());
    
    // 更新命令
    metadata.extend(update::get_command_metadata());
    
    // 快捷键命令 (如果有元数据函数的话)
    // metadata.extend(shortcuts::get_command_metadata());
    
    // 模型配置命令
    metadata.extend(model_config::get_command_metadata());
    
    // 本地LLM模型命令
    metadata.extend(local_llm::get_command_metadata());
    
    // Prompt命令
    metadata.extend(prompt::get_command_metadata());
    
    metadata
}

// ================================
// 命令性能监控
// ================================

/// 命令执行统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandStats {
    /// 命令名称
    pub command_name: String,
    /// 执行次数
    pub execution_count: u64,
    /// 总执行时间（毫秒）
    pub total_duration_ms: u64,
    /// 平均执行时间（毫秒）
    pub average_duration_ms: f64,
    /// 成功次数
    pub success_count: u64,
    /// 失败次数
    pub error_count: u64,
    /// 最后执行时间
    pub last_execution: i64,
}

/// 记录命令执行统计
pub async fn record_command_stats(
    command_name: &str,
    duration_ms: u64,
    success: bool,
) -> ZishuResult<()> {
    // 这里可以实现命令统计记录逻辑
    // 例如：更新数据库中的统计信息
    tracing::debug!(
        "命令统计 - 名称: {}, 耗时: {}ms, 成功: {}",
        command_name,
        duration_ms,
        success
    );
    Ok(())
}

/// 获取命令统计信息
pub async fn get_command_stats() -> ZishuResult<Vec<CommandStats>> {
    // 这里可以实现从数据库获取统计信息的逻辑
    Ok(vec![])
}

// ================================
// 命令缓存
// ================================

/// 命令缓存配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// 是否启用缓存
    pub enabled: bool,
    /// 缓存过期时间（秒）
    pub ttl_seconds: u64,
    /// 最大缓存条目数
    pub max_entries: usize,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            ttl_seconds: 300, // 5分钟
            max_entries: 1000,
        }
    }
}

/// 缓存键生成
pub fn generate_cache_key(command_name: &str, params: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    command_name.hash(&mut hasher);
    params.hash(&mut hasher);
    format!("cmd_{}_{:x}", command_name, hasher.finish())
}

// ================================
// 重新导出所有命令
// ================================

// 聊天命令
pub use chat::*;

// 角色命令
pub use character::*;

// 设置命令
pub use settings::*;

// 适配器命令
pub use adapter::*;

// 桌面命令
pub use desktop::*;

// 系统命令
pub use system::*;

// 窗口命令
pub use window::*;

// 数据库命令

// 工作流命令

// 市场命令
pub use market::*;

// 更新命令

// 快捷键命令

// 模型配置命令
pub use model_config::*;

// 本地LLM模型命令
pub use local_llm::*;

// Prompt命令
pub use prompt::*;

// 加密命令

// 权限命令
pub use permission::*;

// 隐私命令

// 语言命令

// 区域命令

// 日志命令

// Deep Link 命令

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_response_success() {
        let response = CommandResponse::success("test data".to_string());
        assert!(response.success);
        assert_eq!(response.data, Some("test data".to_string()));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_command_response_error() {
        let response: CommandResponse<String> = CommandResponse::error("test error".to_string());
        assert!(!response.success);
        assert!(response.data.is_none());
        assert_eq!(response.error, Some("test error".to_string()));
    }

    #[test]
    fn test_pagination_params_default() {
        let params = PaginationParams::default();
        assert_eq!(params.page, 1);
        assert_eq!(params.page_size, 20);
        assert!(matches!(params.sort_order, Some(SortOrder::Desc)));
    }

    #[test]
    fn test_paginated_response() {
        let items = vec!["item1".to_string(), "item2".to_string()];
        let response = PaginatedResponse::new(items, 10, 1, 5);
        
        assert_eq!(response.total, 10);
        assert_eq!(response.page, 1);
        assert_eq!(response.page_size, 5);
        assert_eq!(response.total_pages, 2);
        assert!(response.has_next);
        assert!(!response.has_prev);
    }

    #[test]
    fn test_cache_key_generation() {
        let key1 = generate_cache_key("test_command", "param1");
        let key2 = generate_cache_key("test_command", "param1");
        let key3 = generate_cache_key("test_command", "param2");
        
        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_permission_level_ordering() {
        assert!(PermissionLevel::Public < PermissionLevel::User);
        assert!(PermissionLevel::User < PermissionLevel::Admin);
        assert!(PermissionLevel::Admin < PermissionLevel::System);
    }
}

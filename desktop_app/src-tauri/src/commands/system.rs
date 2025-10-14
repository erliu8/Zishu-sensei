//! System-related commands
//!
//! This module provides commands for system operations including:
//! - System information
//! - Application version
//! - Update checking
//! - Application restart
//! - File operations

use std::path::PathBuf;
use tauri::{AppHandle, State, Manager};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

use crate::{
    commands::*,
    state::AppState,
    utils::*,
};

// ================================
// Data Types
// ================================

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    /// Operating system name
    pub os: String,
    /// OS version
    pub os_version: String,
    /// Architecture
    pub arch: String,
    /// CPU count
    pub cpu_count: usize,
    /// Total memory (bytes)
    pub total_memory: u64,
    /// App version
    pub app_version: String,
    /// App name
    pub app_name: String,
}

/// Application version info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    /// Version string
    pub version: String,
    /// Build date
    pub build_date: Option<String>,
    /// Git commit hash
    pub git_hash: Option<String>,
}

// ================================
// Command Handlers
// ================================

/// Get system information
#[tauri::command]
pub async fn get_system_info(
    app_handle: AppHandle,
) -> Result<CommandResponse<SystemInfo>, String> {
    info!("获取系统信息");
    
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    
    // Get OS version
    let os_version = if cfg!(target_os = "windows") {
        "Windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macOS".to_string()
    } else if cfg!(target_os = "linux") {
        "Linux".to_string()
    } else {
        "Unknown".to_string()
    };
    
    // Get CPU count
    let cpu_count = num_cpus::get();
    
    // Get memory info (using sysinfo if available, otherwise default)
    let total_memory = 0u64; // TODO: Add sysinfo crate for actual memory info
    
    let app_version = app_handle.package_info().version.to_string();
    let app_name = app_handle.package_info().name.clone();
    
    let system_info = SystemInfo {
        os,
        os_version,
        arch,
        cpu_count,
        total_memory,
        app_version,
        app_name,
    };
    
    Ok(CommandResponse::success(system_info))
}

/// Get application version
#[tauri::command]
pub async fn get_app_version(
    app_handle: AppHandle,
) -> Result<CommandResponse<VersionInfo>, String> {
    info!("获取应用版本");
    
    let version = app_handle.package_info().version.to_string();
    
    let version_info = VersionInfo {
        version,
        build_date: option_env!("BUILD_DATE").map(|s| s.to_string()),
        git_hash: option_env!("GIT_HASH").map(|s| s.to_string()),
    };
    
    Ok(CommandResponse::success(version_info))
}

/// Check for application updates
#[tauri::command]
pub async fn check_for_updates(
    app_handle: AppHandle,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("检查应用更新");
    
    // TODO: Implement actual update checking logic
    // This would typically:
    // 1. Check a remote server for the latest version
    // 2. Compare with current version
    // 3. Return update information if available
    
    let current_version = app_handle.package_info().version.to_string();
    
    let update_info = serde_json::json!({
        "current_version": current_version,
        "latest_version": current_version,
        "update_available": false,
        "message": "您已使用最新版本",
    });
    
    Ok(CommandResponse::success(update_info))
}

/// Restart application
#[tauri::command]
pub async fn restart_app(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("重启应用");
    
    // Use tauri's restart API
    app_handle.restart();
    
    Ok(CommandResponse::success_with_message(
        true,
        "应用正在重启".to_string(),
    ))
}

/// Quit application
#[tauri::command]
pub async fn quit_app(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("退出应用");
    
    app_handle.exit(0);
    
    Ok(CommandResponse::success_with_message(
        true,
        "应用正在退出".to_string(),
    ))
}

/// Show file/folder in file explorer
#[tauri::command]
pub async fn show_in_folder(
    path: String,
) -> Result<CommandResponse<bool>, String> {
    info!("在文件管理器中显示: {}", path);
    
    let path_buf = PathBuf::from(&path);
    
    // Check if path exists
    if !path_buf.exists() {
        return Ok(CommandResponse::error(format!("路径不存在: {}", path)));
    }
    
    // Open in file explorer
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Err(e) = Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
        {
            error!("打开文件管理器失败: {}", e);
            return Ok(CommandResponse::error(format!("打开文件管理器失败: {}", e)));
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Err(e) = Command::new("open")
            .args(["-R", &path])
            .spawn()
        {
            error!("打开访达失败: {}", e);
            return Ok(CommandResponse::error(format!("打开访达失败: {}", e)));
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Try different file managers
        let file_managers = ["nautilus", "dolphin", "thunar", "nemo", "caja"];
        let mut success = false;
        
        for fm in &file_managers {
            if let Ok(_) = Command::new(fm)
                .arg(&path)
                .spawn()
            {
                success = true;
                break;
            }
        }
        
        if !success {
            error!("打开文件管理器失败");
            return Ok(CommandResponse::error("打开文件管理器失败".to_string()));
        }
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已在文件管理器中打开".to_string(),
    ))
}

/// Open URL in default browser
#[tauri::command]
pub async fn open_url(
    url: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("打开URL: {}", url);
    
    use tauri::api::shell;
    
    if let Err(e) = shell::open(&app_handle.shell_scope(), &url, None) {
        error!("打开URL失败: {}", e);
        return Ok(CommandResponse::error(format!("打开URL失败: {}", e)));
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已在浏览器中打开".to_string(),
    ))
}

/// Get application data directory path
#[tauri::command]
pub async fn get_app_data_path() -> Result<CommandResponse<String>, String> {
    info!("获取应用数据目录");
    
    match get_app_data_dir() {
        Ok(path) => {
            Ok(CommandResponse::success(path.to_string_lossy().to_string()))
        }
        Err(e) => {
            error!("获取应用数据目录失败: {}", e);
            Ok(CommandResponse::error(format!("获取应用数据目录失败: {}", e)))
        }
    }
}

/// Get application log directory path
#[tauri::command]
pub async fn get_app_log_path() -> Result<CommandResponse<String>, String> {
    info!("获取应用日志目录");
    
    match get_app_log_dir() {
        Ok(path) => {
            Ok(CommandResponse::success(path.to_string_lossy().to_string()))
        }
        Err(e) => {
            error!("获取应用日志目录失败: {}", e);
            Ok(CommandResponse::error(format!("获取应用日志目录失败: {}", e)))
        }
    }
}

/// Set auto-start on system boot
#[tauri::command]
pub async fn set_auto_start(
    enabled: bool,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("设置开机自启: {}", enabled);
    
    // TODO: Implement auto-start logic using auto-launch crate
    // For now, just update the config
    
    let mut config = state.config.lock().clone();
    config.system.auto_start = enabled;
    *state.config.lock() = config.clone();
    
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存自启动配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    Ok(CommandResponse::success_with_message(
        enabled,
        if enabled { "已启用开机自启".to_string() } else { "已禁用开机自启".to_string() },
    ))
}

/// Copy text to clipboard
#[tauri::command]
pub async fn copy_to_clipboard(
    text: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("复制到剪贴板");
    
    use tauri::ClipboardManager;
    
    if let Err(e) = app_handle.clipboard_manager().write_text(text) {
        error!("复制到剪贴板失败: {}", e);
        return Ok(CommandResponse::error(format!("复制失败: {}", e)));
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已复制到剪贴板".to_string(),
    ))
}

/// Read text from clipboard
#[tauri::command]
pub async fn read_from_clipboard(
    app_handle: AppHandle,
) -> Result<CommandResponse<String>, String> {
    info!("从剪贴板读取");
    
    use tauri::ClipboardManager;
    
    match app_handle.clipboard_manager().read_text() {
        Ok(Some(text)) => {
            Ok(CommandResponse::success(text))
        }
        Ok(None) => {
            Ok(CommandResponse::error("剪贴板为空".to_string()))
        }
        Err(e) => {
            error!("读取剪贴板失败: {}", e);
            Ok(CommandResponse::error(format!("读取失败: {}", e)))
        }
    }
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "get_system_info".to_string(),
        CommandMetadata {
            name: "get_system_info".to_string(),
            description: "获取系统信息".to_string(),
            input_type: None,
            output_type: Some("SystemInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "get_app_version".to_string(),
        CommandMetadata {
            name: "get_app_version".to_string(),
            description: "获取应用版本".to_string(),
            input_type: None,
            output_type: Some("VersionInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "check_for_updates".to_string(),
        CommandMetadata {
            name: "check_for_updates".to_string(),
            description: "检查应用更新".to_string(),
            input_type: None,
            output_type: Some("serde_json::Value".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "restart_app".to_string(),
        CommandMetadata {
            name: "restart_app".to_string(),
            description: "重启应用".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata
}

//! Settings management commands
//!
//! This module provides commands for managing application settings including:
//! - Getting/updating settings
//! - Resetting to defaults
//! - Import/export functionality
//! - Partial updates

use std::path::PathBuf;
use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

use crate::{
    commands::*,
    state::AppState,
    AppConfig, WindowConfig, CharacterConfig, ThemeConfig, SystemConfig,
    utils::*,
};

use crate::utils::config::{
    get_config_info as utils_get_config_info,
    get_backup_files as utils_get_backup_files,
    clean_old_backups as utils_clean_old_backups,
    create_config_snapshot as utils_create_config_snapshot,
    restore_from_snapshot as utils_restore_from_snapshot,
    get_config_diff,
    validate_config,
    save_config,
};

// ================================
// Request/Response Types
// ================================

/// Request to update partial settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingsRequest {
    /// Partial config updates as JSON
    pub updates: serde_json::Value,
}

/// Request to import settings from file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSettingsRequest {
    /// File path to import from
    pub file_path: String,
}

/// Request to export settings to file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettingsRequest {
    /// File path to export to
    pub file_path: String,
}

/// Window config update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWindowConfigRequest {
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub always_on_top: Option<bool>,
    pub transparent: Option<bool>,
    pub decorations: Option<bool>,
    pub resizable: Option<bool>,
    pub position: Option<(i32, i32)>,
}

/// Character config update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCharacterConfigRequest {
    pub current_character: Option<String>,
    pub scale: Option<f64>,
    pub auto_idle: Option<bool>,
    pub interaction_enabled: Option<bool>,
}

/// Theme config update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateThemeConfigRequest {
    pub current_theme: Option<String>,
    pub custom_css: Option<String>,
}

/// System config update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSystemConfigRequest {
    pub auto_start: Option<bool>,
    pub minimize_to_tray: Option<bool>,
    pub close_to_tray: Option<bool>,
    pub show_notifications: Option<bool>,
}

// ================================
// Command Handlers
// ================================

/// Get all application settings
#[tauri::command]
pub async fn get_settings(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("获取应用设置");
    
    let config = state.config.lock().clone();
    Ok(CommandResponse::success(config))
}

/// Update application settings (full replacement)
#[tauri::command]
pub async fn update_settings(
    config: AppConfig,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("更新应用设置");
    
    // Validate config
    if let Err(e) = validate_config(&config) {
        error!("配置验证失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("设置更新成功");
    Ok(CommandResponse::success_with_message(
        config,
        "设置更新成功".to_string(),
    ))
}

/// Update partial settings (merge with existing)
#[tauri::command]
pub async fn update_partial_settings(
    updates: serde_json::Value,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("部分更新应用设置");
    
    let mut config = state.config.lock().clone();
    
    // Merge updates
    if let Err(e) = merge_config(&mut config, updates) {
        error!("合并配置失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("部分设置更新成功");
    Ok(CommandResponse::success_with_message(
        config,
        "设置更新成功".to_string(),
    ))
}

/// Reset settings to default
#[tauri::command]
pub async fn reset_settings(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("重置应用设置");
    
    match reset_config(&app_handle).await {
        Ok(default_config) => {
            // Update state
            *state.config.lock() = default_config.clone();
            
            // Save to disk
            if let Err(e) = save_config(&app_handle, &default_config).await {
                error!("保存默认配置失败: {}", e);
                return Ok(CommandResponse::error(format!("保存默认配置失败: {}", e)));
            }
            
            info!("设置重置成功");
            Ok(CommandResponse::success_with_message(
                default_config,
                "设置已重置为默认值".to_string(),
            ))
        }
        Err(e) => {
            error!("重置配置失败: {}", e);
            Ok(CommandResponse::error(format!("重置配置失败: {}", e)))
        }
    }
}

/// Export settings to file
#[tauri::command]
pub async fn export_settings(
    file_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<String>, String> {
    info!("导出应用设置到: {}", file_path);
    
    let config = state.config.lock().clone();
    let path = PathBuf::from(&file_path);
    
    match export_config(&config, path).await {
        Ok(_) => {
            info!("设置导出成功");
            Ok(CommandResponse::success_with_message(
                file_path,
                "设置导出成功".to_string(),
            ))
        }
        Err(e) => {
            error!("导出配置失败: {}", e);
            Ok(CommandResponse::error(format!("导出配置失败: {}", e)))
        }
    }
}

/// Import settings from file
#[tauri::command]
pub async fn import_settings(
    file_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("从文件导入应用设置: {}", file_path);
    
    let path = PathBuf::from(&file_path);
    
    match import_config(path).await {
        Ok(config) => {
            // Validate imported config
            if let Err(e) = validate_config(&config) {
                error!("导入的配置验证失败: {}", e);
                return Ok(CommandResponse::error(format!("导入的配置无效: {}", e)));
            }
            
            // Update state
            *state.config.lock() = config.clone();
            
            // Save to disk
            if let Err(e) = save_config(&app_handle, &config).await {
                error!("保存导入的配置失败: {}", e);
                return Ok(CommandResponse::error(format!("保存导入的配置失败: {}", e)));
            }
            
            info!("设置导入成功");
            Ok(CommandResponse::success_with_message(
                config,
                "设置导入成功".to_string(),
            ))
        }
        Err(e) => {
            error!("导入配置失败: {}", e);
            Ok(CommandResponse::error(format!("导入配置失败: {}", e)))
        }
    }
}

/// Get window configuration
#[tauri::command]
pub async fn get_window_config(
    state: State<'_, AppState>,
) -> Result<CommandResponse<WindowConfig>, String> {
    info!("获取窗口配置");
    
    let config = state.config.lock().window.clone();
    Ok(CommandResponse::success(config))
}

/// Update window configuration
#[tauri::command]
pub async fn update_window_config(
    updates: UpdateWindowConfigRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<WindowConfig>, String> {
    info!("更新窗口配置");
    
    let mut config = state.config.lock().clone();
    
    // Apply updates
    if let Some(width) = updates.width {
        config.window.width = width;
    }
    if let Some(height) = updates.height {
        config.window.height = height;
    }
    if let Some(always_on_top) = updates.always_on_top {
        config.window.always_on_top = always_on_top;
    }
    if let Some(transparent) = updates.transparent {
        config.window.transparent = transparent;
    }
    if let Some(decorations) = updates.decorations {
        config.window.decorations = decorations;
    }
    if let Some(resizable) = updates.resizable {
        config.window.resizable = resizable;
    }
    if let Some(position) = updates.position {
        config.window.position = Some(position);
    }
    
    // Validate config
    if let Err(e) = validate_config(&config) {
        error!("窗口配置验证失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    let window_config = config.window.clone();
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存窗口配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("窗口配置更新成功");
    Ok(CommandResponse::success_with_message(
        window_config,
        "窗口配置更新成功".to_string(),
    ))
}

/// Update character configuration
#[tauri::command]
pub async fn update_character_config(
    updates: UpdateCharacterConfigRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterConfig>, String> {
    info!("更新角色配置");
    
    let mut config = state.config.lock().clone();
    
    // Apply updates
    if let Some(current_character) = updates.current_character {
        config.character.current_character = current_character;
    }
    if let Some(scale) = updates.scale {
        config.character.scale = scale;
    }
    if let Some(auto_idle) = updates.auto_idle {
        config.character.auto_idle = auto_idle;
    }
    if let Some(interaction_enabled) = updates.interaction_enabled {
        config.character.interaction_enabled = interaction_enabled;
    }
    
    // Validate config
    if let Err(e) = validate_config(&config) {
        error!("角色配置验证失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    let character_config = config.character.clone();
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存角色配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("角色配置更新成功");
    Ok(CommandResponse::success_with_message(
        character_config,
        "角色配置更新成功".to_string(),
    ))
}

/// Get theme configuration
#[tauri::command]
pub async fn get_theme_config(
    state: State<'_, AppState>,
) -> Result<CommandResponse<ThemeConfig>, String> {
    info!("获取主题配置");
    
    let config = state.config.lock().theme.clone();
    Ok(CommandResponse::success(config))
}

/// Update theme configuration
#[tauri::command]
pub async fn update_theme_config(
    updates: UpdateThemeConfigRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<ThemeConfig>, String> {
    info!("更新主题配置");
    
    let mut config = state.config.lock().clone();
    
    // Apply updates
    if let Some(current_theme) = updates.current_theme {
        config.theme.current_theme = current_theme;
    }
    if let Some(custom_css) = updates.custom_css {
        config.theme.custom_css = Some(custom_css);
    }
    
    // Validate config
    if let Err(e) = validate_config(&config) {
        error!("主题配置验证失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    let theme_config = config.theme.clone();
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存主题配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("主题配置更新成功");
    Ok(CommandResponse::success_with_message(
        theme_config,
        "主题配置更新成功".to_string(),
    ))
}

/// Get system configuration
#[tauri::command]
pub async fn get_system_config(
    state: State<'_, AppState>,
) -> Result<CommandResponse<SystemConfig>, String> {
    info!("获取系统配置");
    
    let config = state.config.lock().system.clone();
    Ok(CommandResponse::success(config))
}

/// Update system configuration
#[tauri::command]
pub async fn update_system_config(
    updates: UpdateSystemConfigRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<SystemConfig>, String> {
    info!("更新系统配置");
    
    let mut config = state.config.lock().clone();
    
    // Apply updates
    if let Some(auto_start) = updates.auto_start {
        config.system.auto_start = auto_start;
    }
    if let Some(minimize_to_tray) = updates.minimize_to_tray {
        config.system.minimize_to_tray = minimize_to_tray;
    }
    if let Some(close_to_tray) = updates.close_to_tray {
        config.system.close_to_tray = close_to_tray;
    }
    if let Some(show_notifications) = updates.show_notifications {
        config.system.show_notifications = show_notifications;
    }
    
    // Validate config
    if let Err(e) = validate_config(&config) {
        error!("系统配置验证失败: {}", e);
        return Ok(CommandResponse::error(e));
    }
    
    // Update state
    let system_config = config.system.clone();
    *state.config.lock() = config.clone();
    
    // Save to disk
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存系统配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    info!("系统配置更新成功");
    Ok(CommandResponse::success_with_message(
        system_config,
        "系统配置更新成功".to_string(),
    ))
}

/// Get config file paths
#[tauri::command]
pub async fn get_config_paths() -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取配置文件路径");
    
    match (get_config_file_path(), get_config_backup_path(), get_app_data_dir()) {
        (Ok(config_path), Ok(backup_path), Ok(data_dir)) => {
            let paths = serde_json::json!({
                "config": config_path.to_string_lossy(),
                "backup": backup_path.to_string_lossy(),
                "data_dir": data_dir.to_string_lossy(),
            });
            Ok(CommandResponse::success(paths))
        }
        _ => {
            Ok(CommandResponse::error("获取配置路径失败".to_string()))
        }
    }
}

/// Get config info (size, modified time, backup count, etc.)
#[tauri::command]
pub async fn get_config_info() -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取配置信息");
    
    match utils_get_config_info().await {
        Ok(info) => {
            Ok(CommandResponse::success(info))
        }
        Err(e) => {
            error!("获取配置信息失败: {}", e);
            Ok(CommandResponse::error(format!("获取配置信息失败: {}", e)))
        }
    }
}

/// Get all config backup files
#[tauri::command]
pub async fn get_backup_files() -> Result<CommandResponse<Vec<String>>, String> {
    info!("获取配置备份文件列表");
    
    match utils_get_backup_files().await {
        Ok(backups) => {
            let paths: Vec<String> = backups
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            Ok(CommandResponse::success(paths))
        }
        Err(e) => {
            error!("获取备份文件失败: {}", e);
            Ok(CommandResponse::error(format!("获取备份文件失败: {}", e)))
        }
    }
}

/// Clean old backup files
#[tauri::command]
pub async fn clean_old_backups(keep_count: usize) -> Result<CommandResponse<usize>, String> {
    info!("清理旧备份文件，保留最近 {} 个", keep_count);
    
    match utils_clean_old_backups(keep_count).await {
        Ok(removed_count) => {
            info!("成功删除 {} 个旧备份文件", removed_count);
            Ok(CommandResponse::success_with_message(
                removed_count,
                format!("成功删除 {} 个旧备份文件", removed_count),
            ))
        }
        Err(e) => {
            error!("清理备份文件失败: {}", e);
            Ok(CommandResponse::error(format!("清理备份文件失败: {}", e)))
        }
    }
}

/// Create a config snapshot
#[tauri::command]
pub async fn create_config_snapshot(
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<CommandResponse<String>, String> {
    info!("创建配置快照");
    
    let config = state.config.lock().clone();
    
    match utils_create_config_snapshot(&config, description).await {
        Ok(path) => {
            let path_str = path.to_string_lossy().to_string();
            Ok(CommandResponse::success_with_message(
                path_str,
                "配置快照创建成功".to_string(),
            ))
        }
        Err(e) => {
            error!("创建配置快照失败: {}", e);
            Ok(CommandResponse::error(format!("创建配置快照失败: {}", e)))
        }
    }
}

/// Restore config from snapshot
#[tauri::command]
pub async fn restore_from_snapshot(
    snapshot_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AppConfig>, String> {
    info!("从快照恢复配置: {}", snapshot_path);
    
    let path = PathBuf::from(&snapshot_path);
    
    match utils_restore_from_snapshot(path).await {
        Ok(config) => {
            // Validate restored config
            if let Err(e) = validate_config(&config) {
                error!("恢复的配置验证失败: {}", e);
                return Ok(CommandResponse::error(format!("恢复的配置无效: {}", e)));
            }
            
            // Update state
            *state.config.lock() = config.clone();
            
            // Save to disk
            if let Err(e) = save_config(&app_handle, &config).await {
                error!("保存恢复的配置失败: {}", e);
                return Ok(CommandResponse::error(format!("保存恢复的配置失败: {}", e)));
            }
            
            info!("配置恢复成功");
            Ok(CommandResponse::success_with_message(
                config,
                "配置恢复成功".to_string(),
            ))
        }
        Err(e) => {
            error!("恢复配置失败: {}", e);
            Ok(CommandResponse::error(format!("恢复配置失败: {}", e)))
        }
    }
}

/// Compare two configs and get differences
#[tauri::command]
pub async fn compare_configs(
    config1: AppConfig,
    config2: AppConfig,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("比较配置差异");
    
    let diff = get_config_diff(&config1, &config2);
    Ok(CommandResponse::success(diff))
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "get_settings".to_string(),
        CommandMetadata {
            name: "get_settings".to_string(),
            description: "获取所有应用设置".to_string(),
            input_type: None,
            output_type: Some("AppConfig".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata.insert(
        "update_settings".to_string(),
        CommandMetadata {
            name: "update_settings".to_string(),
            description: "更新应用设置（完整替换）".to_string(),
            input_type: Some("AppConfig".to_string()),
            output_type: Some("AppConfig".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata.insert(
        "update_partial_settings".to_string(),
        CommandMetadata {
            name: "update_partial_settings".to_string(),
            description: "部分更新应用设置".to_string(),
            input_type: Some("serde_json::Value".to_string()),
            output_type: Some("AppConfig".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata.insert(
        "reset_settings".to_string(),
        CommandMetadata {
            name: "reset_settings".to_string(),
            description: "重置设置为默认值".to_string(),
            input_type: None,
            output_type: Some("AppConfig".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata.insert(
        "export_settings".to_string(),
        CommandMetadata {
            name: "export_settings".to_string(),
            description: "导出设置到文件".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("String".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata.insert(
        "import_settings".to_string(),
        CommandMetadata {
            name: "import_settings".to_string(),
            description: "从文件导入设置".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("AppConfig".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "settings".to_string(),
        },
    );
    
    metadata
}

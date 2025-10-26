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

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ================================
    // 请求/响应数据结构测试
    // ================================

    #[test]
    fn test_update_settings_request_serialization() {
        // Arrange
        let updates = json!({
            "window": {
                "width": 800,
                "height": 600
            },
            "character": {
                "current_character": "new_character"
            }
        });
        
        let request = UpdateSettingsRequest { updates: updates.clone() };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.updates, updates);
    }

    #[test]
    fn test_import_export_request_serialization() {
        // Arrange
        let import_request = ImportSettingsRequest {
            file_path: "/path/to/settings.json".to_string(),
        };
        
        let export_request = ExportSettingsRequest {
            file_path: "/path/to/export.json".to_string(),
        };
        
        // Act & Assert - Import
        let json = serde_json::to_string(&import_request).unwrap();
        let deserialized: ImportSettingsRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_path, "/path/to/settings.json");
        
        // Act & Assert - Export
        let json = serde_json::to_string(&export_request).unwrap();
        let deserialized: ExportSettingsRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_path, "/path/to/export.json");
    }

    #[test]
    fn test_update_window_config_request() {
        // Arrange
        let request = UpdateWindowConfigRequest {
            width: Some(1024.0),
            height: Some(768.0),
            always_on_top: Some(true),
            transparent: Some(false),
            decorations: Some(true),
            resizable: Some(true),
            position: Some((100, 200)),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateWindowConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.width, Some(1024.0));
        assert_eq!(deserialized.height, Some(768.0));
        assert_eq!(deserialized.always_on_top, Some(true));
        assert_eq!(deserialized.position, Some((100, 200)));
    }

    #[test]
    fn test_update_character_config_request() {
        // Arrange
        let request = UpdateCharacterConfigRequest {
            current_character: Some("test_character".to_string()),
            scale: Some(1.5),
            auto_idle: Some(true),
            interaction_enabled: Some(false),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateCharacterConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.current_character, Some("test_character".to_string()));
        assert_eq!(deserialized.scale, Some(1.5));
        assert_eq!(deserialized.auto_idle, Some(true));
        assert_eq!(deserialized.interaction_enabled, Some(false));
    }

    #[test]
    fn test_update_theme_config_request() {
        // Arrange
        let request = UpdateThemeConfigRequest {
            current_theme: Some("dark".to_string()),
            custom_css: Some("body { color: red; }".to_string()),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateThemeConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.current_theme, Some("dark".to_string()));
        assert_eq!(deserialized.custom_css, Some("body { color: red; }".to_string()));
    }

    #[test]
    fn test_update_system_config_request() {
        // Arrange
        let request = UpdateSystemConfigRequest {
            auto_start: Some(true),
            minimize_to_tray: Some(false),
            close_to_tray: Some(true),
            show_notifications: Some(false),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSystemConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.auto_start, Some(true));
        assert_eq!(deserialized.minimize_to_tray, Some(false));
        assert_eq!(deserialized.close_to_tray, Some(true));
        assert_eq!(deserialized.show_notifications, Some(false));
    }

    // ================================
    // 命令元数据测试
    // ================================

    #[test]
    fn test_get_command_metadata() {
        // Act
        let metadata = get_command_metadata();
        
        // Assert
        assert!(!metadata.is_empty());
        
        // 验证核心命令存在
        assert!(metadata.contains_key("get_settings"));
        assert!(metadata.contains_key("update_settings"));
        assert!(metadata.contains_key("update_partial_settings"));
        assert!(metadata.contains_key("reset_settings"));
        assert!(metadata.contains_key("export_settings"));
        assert!(metadata.contains_key("import_settings"));
        
        // 验证get_settings元数据
        let get_settings_meta = &metadata["get_settings"];
        assert_eq!(get_settings_meta.name, "get_settings");
        assert_eq!(get_settings_meta.category, "settings");
        assert_eq!(get_settings_meta.required_permission, PermissionLevel::User);
        assert!(get_settings_meta.is_async);
        assert_eq!(get_settings_meta.input_type, None);
        assert_eq!(get_settings_meta.output_type, Some("AppConfig".to_string()));
        
        // 验证update_settings元数据
        let update_settings_meta = &metadata["update_settings"];
        assert_eq!(update_settings_meta.name, "update_settings");
        assert_eq!(update_settings_meta.description, "更新应用设置（完整替换）");
        assert_eq!(update_settings_meta.input_type, Some("AppConfig".to_string()));
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_window_config_boundary_values() {
        // Arrange - 测试边界值
        let request = UpdateWindowConfigRequest {
            width: Some(0.0), // 最小宽度
            height: Some(0.0), // 最小高度
            always_on_top: Some(false),
            transparent: Some(true),
            decorations: Some(false),
            resizable: Some(false),
            position: Some((i32::MIN, i32::MAX)), // 极端位置值
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateWindowConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.width, Some(0.0));
        assert_eq!(deserialized.height, Some(0.0));
        assert_eq!(deserialized.position, Some((i32::MIN, i32::MAX)));
    }

    #[test]
    fn test_character_config_boundary_values() {
        // Arrange - 测试边界值
        let request = UpdateCharacterConfigRequest {
            current_character: Some("".to_string()), // 空字符串
            scale: Some(0.0), // 最小缩放
            auto_idle: Some(true),
            interaction_enabled: Some(true),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateCharacterConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.current_character, Some("".to_string()));
        assert_eq!(deserialized.scale, Some(0.0));
    }

    #[test]
    fn test_theme_config_with_large_css() {
        // Arrange - 测试大量CSS内容
        let large_css = "body { color: red; }".repeat(1000);
        let request = UpdateThemeConfigRequest {
            current_theme: Some("custom".to_string()),
            custom_css: Some(large_css.clone()),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateThemeConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.custom_css, Some(large_css));
    }

    // ================================
    // 错误场景测试
    // ================================

    #[test]
    fn test_invalid_json_deserialization() {
        // Arrange
        let invalid_json = r#"{"width": "not_a_number", "invalid_field": []}"#;
        
        // Act & Assert
        let result: Result<UpdateWindowConfigRequest, _> = serde_json::from_str(invalid_json);
        assert!(result.is_err(), "应该拒绝无效的JSON格式");
    }

    #[test]
    fn test_partial_json_deserialization() {
        // Arrange - 只包含部分字段的JSON
        let partial_json = r#"{"width": 800}"#;
        
        // Act
        let result: Result<UpdateWindowConfigRequest, _> = serde_json::from_str(partial_json);
        
        // Assert
        assert!(result.is_ok(), "应该接受部分字段的JSON");
        let request = result.unwrap();
        assert_eq!(request.width, Some(800.0));
        assert_eq!(request.height, None);
    }

    #[test]
    fn test_empty_json_deserialization() {
        // Arrange
        let empty_json = r#"{}"#;
        
        // Act
        let result: Result<UpdateWindowConfigRequest, _> = serde_json::from_str(empty_json);
        
        // Assert
        assert!(result.is_ok(), "应该接受空的JSON对象");
        let request = result.unwrap();
        assert_eq!(request.width, None);
        assert_eq!(request.height, None);
    }

    // ================================
    // Unicode和特殊字符测试
    // ================================

    #[test]
    fn test_unicode_character_name() {
        // Arrange - 测试Unicode字符名称
        let unicode_name = "紫舒老师🌸测试角色";
        let request = UpdateCharacterConfigRequest {
            current_character: Some(unicode_name.to_string()),
            scale: None,
            auto_idle: None,
            interaction_enabled: None,
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateCharacterConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.current_character, Some(unicode_name.to_string()));
    }

    #[test]
    fn test_special_characters_in_paths() {
        // Arrange - 测试特殊字符路径
        let special_path = "/path/with spaces/and-dashes/file_name.json";
        let request = ImportSettingsRequest {
            file_path: special_path.to_string(),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ImportSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.file_path, special_path);
    }

    #[test]
    fn test_css_with_special_characters() {
        // Arrange - 测试包含特殊字符的CSS
        let special_css = r#"
            body { 
                font-family: "微软雅黑", Arial; 
                background: url('data:image/svg+xml;utf8,<svg>...</svg>'); 
                content: "测试内容 \u00A0 \u2603";
            }
        "#;
        
        let request = UpdateThemeConfigRequest {
            current_theme: Some("custom".to_string()),
            custom_css: Some(special_css.to_string()),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateThemeConfigRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.custom_css, Some(special_css.to_string()));
    }

    // ================================
    // 性能相关测试
    // ================================

    #[test]
    fn test_large_updates_object_serialization() {
        // Arrange - 创建大型更新对象
        let mut large_updates = serde_json::Map::new();
        
        // 添加大量配置项
        for i in 0..1000 {
            large_updates.insert(
                format!("config_item_{}", i),
                json!({
                    "value": format!("test_value_{}", i),
                    "enabled": i % 2 == 0,
                    "priority": i,
                }),
            );
        }
        
        let request = UpdateSettingsRequest {
            updates: json!(large_updates),
        };
        
        // Act
        let start = std::time::Instant::now();
        let json = serde_json::to_string(&request).unwrap();
        let serialization_time = start.elapsed();
        
        let start = std::time::Instant::now();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        let deserialization_time = start.elapsed();
        
        // Assert
        assert!(deserialized.updates.is_object());
        let obj = deserialized.updates.as_object().unwrap();
        assert_eq!(obj.len(), 1000);
        
        // 性能断言
        assert!(serialization_time.as_millis() < 200, "序列化时间过长");
        assert!(deserialization_time.as_millis() < 200, "反序列化时间过长");
    }

    // ================================
    // 嵌套对象测试
    // ================================

    #[test]
    fn test_deeply_nested_updates() {
        // Arrange - 创建深度嵌套的更新对象
        let nested_updates = json!({
            "level1": {
                "level2": {
                    "level3": {
                        "level4": {
                            "level5": {
                                "value": "深度嵌套测试",
                                "enabled": true
                            }
                        }
                    }
                }
            }
        });
        
        let request = UpdateSettingsRequest {
            updates: nested_updates.clone(),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.updates, nested_updates);
        
        // 验证深度嵌套访问
        let level5 = &deserialized.updates["level1"]["level2"]["level3"]["level4"]["level5"];
        assert_eq!(level5["value"], "深度嵌套测试");
        assert_eq!(level5["enabled"], true);
    }

    // ================================
    // 数组处理测试
    // ================================

    #[test]
    fn test_array_values_in_updates() {
        // Arrange - 测试数组值的处理
        let updates_with_arrays = json!({
            "themes": ["light", "dark", "auto"],
            "languages": ["zh", "en", "ja"],
            "plugins": [
                {"name": "plugin1", "enabled": true},
                {"name": "plugin2", "enabled": false}
            ],
            "coordinates": [100, 200, 300]
        });
        
        let request = UpdateSettingsRequest {
            updates: updates_with_arrays.clone(),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.updates, updates_with_arrays);
        
        // 验证数组内容
        let themes = deserialized.updates["themes"].as_array().unwrap();
        assert_eq!(themes.len(), 3);
        assert_eq!(themes[0], "light");
        
        let plugins = deserialized.updates["plugins"].as_array().unwrap();
        assert_eq!(plugins.len(), 2);
        assert_eq!(plugins[0]["name"], "plugin1");
    }

    // ================================
    // 空值和null处理测试
    // ================================

    #[test]
    fn test_null_values_handling() {
        // Arrange - 测试null值处理
        let updates_with_nulls = json!({
            "nullable_field": null,
            "optional_string": null,
            "valid_field": "valid_value"
        });
        
        let request = UpdateSettingsRequest {
            updates: updates_with_nulls.clone(),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.updates, updates_with_nulls);
        assert!(deserialized.updates["nullable_field"].is_null());
        assert_eq!(deserialized.updates["valid_field"], "valid_value");
    }

    // ================================
    // 类型混合测试
    // ================================

    #[test]
    fn test_mixed_types_in_updates() {
        // Arrange - 测试混合数据类型
        let mixed_updates = json!({
            "string_value": "test",
            "number_value": 42,
            "float_value": 3.14,
            "boolean_value": true,
            "array_value": [1, 2, 3],
            "object_value": {"nested": "value"},
            "null_value": null
        });
        
        let request = UpdateSettingsRequest {
            updates: mixed_updates.clone(),
        };
        
        // Act
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSettingsRequest = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.updates, mixed_updates);
        assert!(deserialized.updates["string_value"].is_string());
        assert!(deserialized.updates["number_value"].is_number());
        assert!(deserialized.updates["boolean_value"].is_boolean());
        assert!(deserialized.updates["array_value"].is_array());
        assert!(deserialized.updates["object_value"].is_object());
        assert!(deserialized.updates["null_value"].is_null());
    }
}

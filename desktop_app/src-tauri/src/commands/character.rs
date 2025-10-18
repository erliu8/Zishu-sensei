//! Character management commands
//!
//! This module provides commands for managing Live2D characters including:
//! - Listing available characters
//! - Switching characters
//! - Playing motions and expressions
//! - Character configuration

use tauri::{AppHandle, State, Manager};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};

use crate::{
    commands::*,
    state::AppState,
    utils::*,
};

// ================================
// Data Types
// ================================

/// Character information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterInfo {
    /// Character ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Preview image URL
    pub preview_image: Option<String>,
    /// Available motions
    pub motions: Vec<String>,
    /// Available expressions
    pub expressions: Vec<String>,
    /// Is currently active
    pub is_active: bool,
}

/// Motion playback request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayMotionRequest {
    /// Character ID
    pub character_id: Option<String>,
    /// Motion name/ID
    pub motion: String,
    /// Priority (higher values take precedence)
    pub priority: Option<u8>,
    /// Loop the motion
    pub loop_motion: Option<bool>,
}

/// Expression change request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetExpressionRequest {
    /// Character ID
    pub character_id: Option<String>,
    /// Expression name/ID
    pub expression: String,
}

/// Character switch request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchCharacterRequest {
    /// Character ID to switch to
    pub character_id: String,
}

/// Character configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfigData {
    pub character_id: String,
    pub scale: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub interaction_enabled: bool,
    pub config_json: Option<String>,
}

// ================================
// Command Handlers
// ================================

/// Get list of available characters
#[tauri::command]
pub async fn get_characters(
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<CharacterInfo>>, String> {
    info!("获取可用角色列表");
    
    // Get database instance
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // Load characters from database
    let characters_data = db.character_registry.get_all_characters()
        .map_err(|e| format!("获取角色列表失败: {}", e))?;
    
    // Convert to CharacterInfo
    let characters: Vec<CharacterInfo> = characters_data
        .into_iter()
        .map(|c| CharacterInfo {
            id: c.id,
            name: c.name,
            description: Some(c.description),
            preview_image: c.preview_image,
            motions: c.motions,
            expressions: c.expressions,
            is_active: c.is_active,
        })
        .collect();
    
    Ok(CommandResponse::success(characters))
}

/// Get detailed information about a specific character
#[tauri::command]
pub async fn get_character_info(
    character_id: String,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterInfo>, String> {
    info!("获取角色信息: {}", character_id);
    
    // Get database instance
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // Load character from database
    let character_data = db.character_registry.get_character(&character_id)
        .map_err(|e| format!("获取角色信息失败: {}", e))?;
    
    match character_data {
        Some(c) => {
            let character = CharacterInfo {
                id: c.id,
                name: c.name,
                description: Some(c.description),
                preview_image: c.preview_image,
                motions: c.motions,
                expressions: c.expressions,
                is_active: c.is_active,
            };
            Ok(CommandResponse::success(character))
        }
        None => {
            Ok(CommandResponse::error(format!("角色不存在: {}", character_id)))
        }
    }
}

/// Switch to a different character
#[tauri::command]
pub async fn switch_character(
    character_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterInfo>, String> {
    info!("切换角色: {}", character_id);
    
    // Get database instance
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // Validate character exists in database
    let character_data = db.character_registry.get_character(&character_id)
        .map_err(|e| format!("查询角色失败: {}", e))?;
    
    let character_data = match character_data {
        Some(c) => c,
        None => {
            error!("尝试切换到不存在的角色: {}", character_id);
            return Ok(CommandResponse::error(format!("角色不存在: {}", character_id)));
        }
    };
    
    // Get old active character
    let old_character = db.character_registry.get_active_character()
        .map_err(|e| format!("获取当前角色失败: {}", e))?
        .map(|c| c.id);
    
    // Set new active character in database
    db.character_registry.set_active_character(&character_id)
        .map_err(|e| format!("设置激活角色失败: {}", e))?;
    
    // Update config
    let mut config = state.config.lock().clone();
    config.character.current_character = character_id.clone();
    
    // Save config
    *state.config.lock() = config.clone();
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存角色切换配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    // Build character info response
    let character_info = CharacterInfo {
        id: character_data.id.clone(),
        name: character_data.name.clone(),
        description: Some(character_data.description),
        preview_image: character_data.preview_image,
        motions: character_data.motions,
        expressions: character_data.expressions,
        is_active: true,
    };
    
    // Emit event to frontend
    if let Some(main_window) = app_handle.get_window("main") {
        let _ = main_window.emit("character-changed", serde_json::json!({
            "old_character": old_character,
            "new_character": character_id,
            "character_info": character_info,
        }));
    }
    
    info!("角色切换成功: {:?} -> {}", old_character, character_id);
    Ok(CommandResponse::success_with_message(
        character_info,
        format!("已切换到角色: {}", character_id),
    ))
}

/// Play a character motion
#[tauri::command]
pub async fn play_motion(
    request: PlayMotionRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    let character_id = request.character_id
        .unwrap_or_else(|| state.config.lock().character.current_character.clone());
    
    info!("播放动作: {} 在角色 {}", request.motion, character_id);
    
    // Emit event to frontend to play motion
    if let Some(main_window) = app_handle.get_window("main") {
        let payload = serde_json::json!({
            "character_id": character_id,
            "motion": request.motion,
            "priority": request.priority.unwrap_or(1),
            "loop": request.loop_motion.unwrap_or(false),
        });
        
        if let Err(e) = main_window.emit("play-motion", &payload) {
            error!("发送播放动作事件失败: {}", e);
            return Ok(CommandResponse::error(format!("播放动作失败: {}", e)));
        }
        
        Ok(CommandResponse::success_with_message(
            payload,
            format!("正在播放动作: {}", request.motion),
        ))
    } else {
        warn!("主窗口不存在，无法播放动作");
        Ok(CommandResponse::error("主窗口不存在".to_string()))
    }
}

/// Set character expression
#[tauri::command]
pub async fn set_expression(
    request: SetExpressionRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    let character_id = request.character_id
        .unwrap_or_else(|| state.config.lock().character.current_character.clone());
    
    info!("设置表情: {} 在角色 {}", request.expression, character_id);
    
    // Emit event to frontend to set expression
    if let Some(main_window) = app_handle.get_window("main") {
        let payload = serde_json::json!({
            "character_id": character_id,
            "expression": request.expression,
        });
        
        if let Err(e) = main_window.emit("set-expression", &payload) {
            error!("发送设置表情事件失败: {}", e);
            return Ok(CommandResponse::error(format!("设置表情失败: {}", e)));
        }
        
        Ok(CommandResponse::success_with_message(
            payload,
            format!("已设置表情: {}", request.expression),
        ))
    } else {
        warn!("主窗口不存在，无法设置表情");
        Ok(CommandResponse::error("主窗口不存在".to_string()))
    }
}

/// Get current character state
#[tauri::command]
pub async fn get_current_character(
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterInfo>, String> {
    info!("获取当前角色");
    
    let character_id = state.config.lock().character.current_character.clone();
    
    // Get character info
    match get_character_info(character_id.clone(), state).await {
        Ok(response) => Ok(response),
        Err(e) => {
            error!("获取当前角色信息失败: {}", e);
            Ok(CommandResponse::error(e))
        }
    }
}

/// Toggle character interaction
#[tauri::command]
pub async fn toggle_character_interaction(
    enabled: bool,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("切换角色交互: {}", enabled);
    
    let mut config = state.config.lock().clone();
    config.character.interaction_enabled = enabled;
    
    // Save config
    *state.config.lock() = config.clone();
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存交互设置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    // Emit event to frontend
    if let Some(main_window) = app_handle.get_window("main") {
        let _ = main_window.emit("interaction-toggled", enabled);
    }
    
    Ok(CommandResponse::success_with_message(
        enabled,
        if enabled { "已启用角色交互".to_string() } else { "已禁用角色交互".to_string() },
    ))
}

/// Set character scale
#[tauri::command]
pub async fn set_character_scale(
    scale: f64,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<f64>, String> {
    info!("设置角色缩放: {}", scale);
    
    // Validate scale
    if scale < 0.1 || scale > 5.0 {
        return Ok(CommandResponse::error("缩放值必须在 0.1 到 5.0 之间".to_string()));
    }
    
    let mut config = state.config.lock().clone();
    config.character.scale = scale;
    
    // Save config
    *state.config.lock() = config.clone();
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存缩放设置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    // Emit event to frontend
    if let Some(main_window) = app_handle.get_window("main") {
        let _ = main_window.emit("scale-changed", scale);
    }
    
    Ok(CommandResponse::success_with_message(
        scale,
        format!("已设置角色缩放: {}", scale),
    ))
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "get_characters".to_string(),
        CommandMetadata {
            name: "get_characters".to_string(),
            description: "获取可用角色列表".to_string(),
            input_type: None,
            output_type: Some("Vec<CharacterInfo>".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "get_character_info".to_string(),
        CommandMetadata {
            name: "get_character_info".to_string(),
            description: "获取角色详细信息".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("CharacterInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "switch_character".to_string(),
        CommandMetadata {
            name: "switch_character".to_string(),
            description: "切换角色".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("CharacterInfo".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "play_motion".to_string(),
        CommandMetadata {
            name: "play_motion".to_string(),
            description: "播放角色动作".to_string(),
            input_type: Some("PlayMotionRequest".to_string()),
            output_type: Some("serde_json::Value".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "set_expression".to_string(),
        CommandMetadata {
            name: "set_expression".to_string(),
            description: "设置角色表情".to_string(),
            input_type: Some("SetExpressionRequest".to_string()),
            output_type: Some("serde_json::Value".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "save_character_config".to_string(),
        CommandMetadata {
            name: "save_character_config".to_string(),
            description: "保存角色配置".to_string(),
            input_type: Some("CharacterConfigData".to_string()),
            output_type: Some("()".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata.insert(
        "get_character_config".to_string(),
        CommandMetadata {
            name: "get_character_config".to_string(),
            description: "获取角色配置".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("CharacterConfigData".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "character".to_string(),
        },
    );
    
    metadata
}

/// Save character configuration to database
#[tauri::command]
pub async fn save_character_config(
    config: CharacterConfigData,
) -> Result<CommandResponse<()>, String> {
    info!("保存角色配置: {}", config.character_id);
    
    // Get database instance
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // Convert to database CharacterConfig
    let db_config = crate::database::character_registry::CharacterConfig {
        character_id: config.character_id.clone(),
        scale: config.scale,
        position_x: config.position_x,
        position_y: config.position_y,
        interaction_enabled: config.interaction_enabled,
        config_json: config.config_json,
    };
    
    // Save to database
    db.character_registry.save_character_config(db_config)
        .map_err(|e| format!("保存角色配置失败: {}", e))?;
    
    info!("角色配置保存成功: {}", config.character_id);
    Ok(CommandResponse::success(()))
}

/// Get character configuration from database
#[tauri::command]
pub async fn get_character_config(
    character_id: String,
) -> Result<CommandResponse<CharacterConfigData>, String> {
    info!("获取角色配置: {}", character_id);
    
    // Get database instance
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // Load from database
    let db_config = db.character_registry.get_character_config(&character_id)
        .map_err(|e| format!("获取角色配置失败: {}", e))?;
    
    match db_config {
        Some(config) => {
            let config_data = CharacterConfigData {
                character_id: config.character_id,
                scale: config.scale,
                position_x: config.position_x,
                position_y: config.position_y,
                interaction_enabled: config.interaction_enabled,
                config_json: config.config_json,
            };
            Ok(CommandResponse::success(config_data))
        }
        None => {
            // Return default config
            let default_config = CharacterConfigData {
                character_id: character_id.clone(),
                scale: 1.0,
                position_x: 0.0,
                position_y: 0.0,
                interaction_enabled: true,
                config_json: None,
            };
            Ok(CommandResponse::success(default_config))
        }
    }
}

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

// ================================
// Command Handlers
// ================================

/// Get list of available characters
#[tauri::command]
pub async fn get_characters(
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<CharacterInfo>>, String> {
    info!("获取可用角色列表");
    
    let current_character = state.config.lock().character.current_character.clone();
    
    // TODO: In the future, load this from a character registry/database
    let characters = vec![
        CharacterInfo {
            id: "shizuku".to_string(),
            name: "Shizuku".to_string(),
            description: Some("可爱的桌面宠物角色".to_string()),
            preview_image: Some("/characters/shizuku/preview.png".to_string()),
            motions: vec![
                "idle".to_string(),
                "tap_body".to_string(),
                "tap_head".to_string(),
                "shake".to_string(),
            ],
            expressions: vec![
                "normal".to_string(),
                "happy".to_string(),
                "sad".to_string(),
                "angry".to_string(),
            ],
            is_active: current_character == "shizuku",
        },
        CharacterInfo {
            id: "haru".to_string(),
            name: "Haru".to_string(),
            description: Some("活泼的桌面助手".to_string()),
            preview_image: Some("/characters/haru/preview.png".to_string()),
            motions: vec![
                "idle".to_string(),
                "wave".to_string(),
                "dance".to_string(),
            ],
            expressions: vec![
                "normal".to_string(),
                "smile".to_string(),
                "wink".to_string(),
            ],
            is_active: current_character == "haru",
        },
    ];
    
    Ok(CommandResponse::success(characters))
}

/// Get detailed information about a specific character
#[tauri::command]
pub async fn get_character_info(
    character_id: String,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterInfo>, String> {
    info!("获取角色信息: {}", character_id);
    
    let current_character = state.config.lock().character.current_character.clone();
    
    // TODO: Load from character registry
    let character = match character_id.as_str() {
        "shizuku" => CharacterInfo {
            id: "shizuku".to_string(),
            name: "Shizuku".to_string(),
            description: Some("可爱的桌面宠物角色，喜欢和用户互动".to_string()),
            preview_image: Some("/characters/shizuku/preview.png".to_string()),
            motions: vec![
                "idle".to_string(),
                "tap_body".to_string(),
                "tap_head".to_string(),
                "shake".to_string(),
            ],
            expressions: vec![
                "normal".to_string(),
                "happy".to_string(),
                "sad".to_string(),
                "angry".to_string(),
            ],
            is_active: current_character == "shizuku",
        },
        "haru" => CharacterInfo {
            id: "haru".to_string(),
            name: "Haru".to_string(),
            description: Some("活泼的桌面助手，总是充满活力".to_string()),
            preview_image: Some("/characters/haru/preview.png".to_string()),
            motions: vec![
                "idle".to_string(),
                "wave".to_string(),
                "dance".to_string(),
            ],
            expressions: vec![
                "normal".to_string(),
                "smile".to_string(),
                "wink".to_string(),
            ],
            is_active: current_character == "haru",
        },
        _ => {
            return Ok(CommandResponse::error(format!("角色不存在: {}", character_id)));
        }
    };
    
    Ok(CommandResponse::success(character))
}

/// Switch to a different character
#[tauri::command]
pub async fn switch_character(
    character_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CharacterInfo>, String> {
    info!("切换角色: {}", character_id);
    
    // Validate character exists
    // TODO: Check against character registry
    let valid_characters = vec!["shizuku", "haru"];
    if !valid_characters.contains(&character_id.as_str()) {
        error!("尝试切换到不存在的角色: {}", character_id);
        return Ok(CommandResponse::error(format!("角色不存在: {}", character_id)));
    }
    
    // Update config
    let mut config = state.config.lock().clone();
    let old_character = config.character.current_character.clone();
    config.character.current_character = character_id.clone();
    
    // Save config
    *state.config.lock() = config.clone();
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存角色切换配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    // Get character info
    let character_info = CharacterInfo {
        id: character_id.clone(),
        name: character_id.clone(),
        description: None,
        preview_image: None,
        motions: vec![],
        expressions: vec![],
        is_active: true,
    };
    
    // Emit event to frontend
    if let Some(main_window) = app_handle.get_window("main") {
        let _ = main_window.emit("character-changed", serde_json::json!({
            "old_character": old_character,
            "new_character": character_id,
        }));
    }
    
    info!("角色切换成功: {} -> {}", old_character, character_id);
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
    
    metadata
}

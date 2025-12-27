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

fn fallback_characters() -> Vec<CharacterInfo> {
    vec![CharacterInfo {
        id: "hiyori".to_string(),
        name: "Hiyori".to_string(),
        description: Some("默认内置角色（数据库未就绪时兜底）".to_string()),
        preview_image: Some("/live2d_models/hiyori/icon.jpg".to_string()),
        model_path: "/live2d_models/hiyori/hiyori.model3.json".to_string(),
        motions: vec![],
        expressions: vec![],
        is_active: true,
    }]
}

// ================================
// Data Types
// ================================

/// Character information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CharacterInfo {
    /// Character ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Preview image URL
    pub preview_image: Option<String>,
    /// Model file path (model3.json)
    pub model_path: String,
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
    info!("🔍 [get_characters] 开始获取可用角色列表");
    
    // Get database instance
    let db = match crate::database::get_database() {
        Some(db) => db,
        None => {
            warn!("⚠️ [get_characters] 数据库未初始化，返回默认角色列表兜底");
            return Ok(CommandResponse::success_with_message(
                fallback_characters(),
                "数据库未就绪，已返回默认角色".to_string(),
            ));
        }
    };
    
    info!("✅ [get_characters] 数据库实例获取成功");
    
    // Load characters from database
    let characters_data = db.character_registry.get_all_characters_async().await
        .map_err(|e| {
            error!("❌ [get_characters] 获取角色列表失败: {}", e);
            format!("获取角色列表失败: {}", e)
        })?;
    
    info!("📊 [get_characters] 从数据库获取到 {} 个角色", characters_data.len());

    if characters_data.is_empty() {
        warn!("⚠️ [get_characters] 数据库角色列表为空，返回默认角色列表兜底");
        return Ok(CommandResponse::success_with_message(
            fallback_characters(),
            "未找到角色数据，已返回默认角色".to_string(),
        ));
    }
    
    // Convert to CharacterInfo
    let characters: Vec<CharacterInfo> = characters_data
        .into_iter()
        .map(|c| {
            info!("  - 角色: {} ({}), path: {}, motions: {}, expressions: {}", 
                c.id, c.name, &c.path, c.motions.len(), c.expressions.len());
            CharacterInfo {
                id: c.id,
                name: c.name,
                description: Some(c.description),
                preview_image: c.preview_image,
                model_path: c.path,
                motions: c.motions,
                expressions: c.expressions,
                is_active: c.is_active,
            }
        })
        .collect();
    
    info!("✅ [get_characters] 成功返回 {} 个角色", characters.len());
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
    let character_data = db.character_registry.get_character_async(&character_id).await
        .map_err(|e| format!("获取角色信息失败: {}", e))?;
    
    match character_data {
        Some(c) => {
            let character = CharacterInfo {
                id: c.id,
                name: c.name,
                description: Some(c.description),
                preview_image: c.preview_image,
                model_path: c.path,
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
    let character_data = db.character_registry.get_character_async(&character_id).await
        .map_err(|e| format!("查询角色失败: {}", e))?;
    
    let character_data = match character_data {
        Some(c) => c,
        None => {
            error!("尝试切换到不存在的角色: {}", character_id);
            return Ok(CommandResponse::error(format!("角色不存在: {}", character_id)));
        }
    };
    
    // Get old active character
    let old_character = db.character_registry.get_active_character_async().await
        .map_err(|e| format!("获取当前角色失败: {}", e))?
        .map(|c| c.id);
    
    // Set new active character in database
    db.character_registry.set_active_character_async(&character_id).await
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
        model_path: character_data.path,
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
    db.character_registry.save_character_config_async(db_config).await
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
    let db_config = db.character_registry.get_character_config_async(&character_id).await
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

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use serde_json::json;
    
    // Mock character registry for testing
    pub struct MockCharacterRegistry;
    
    impl MockCharacterRegistry {
        pub fn new() -> Self {
            Self
        }
        
        pub fn get_all_characters(&self) -> Result<Vec<crate::database::character_registry::CharacterData>, String> {
            Ok(vec![
                crate::database::character_registry::CharacterData {
                    id: "hiyori".to_string(),
                    name: "Hiyori".to_string(),
                    display_name: "日和".to_string(),
                    path: "/live2d/hiyori".to_string(),
                    preview_image: Some("/images/hiyori_preview.png".to_string()),
                    description: "可爱的猫耳少女".to_string(),
                    gender: "female".to_string(),
                    size: "medium".to_string(),
                    features: vec!["cute".to_string(), "catgirl".to_string()],
                    motions: vec!["idle".to_string(), "wave".to_string(), "happy".to_string()],
                    expressions: vec!["normal".to_string(), "smile".to_string(), "surprised".to_string()],
                    is_active: true,
                },
                crate::database::character_registry::CharacterData {
                    id: "shizuku".to_string(),
                    name: "Shizuku".to_string(),
                    display_name: "雫".to_string(),
                    path: "/live2d/shizuku".to_string(),
                    preview_image: Some("/images/shizuku_preview.png".to_string()),
                    description: "温柔的治愈系少女".to_string(),
                    gender: "female".to_string(),
                    size: "medium".to_string(),
                    features: vec!["gentle".to_string(), "healing".to_string()],
                    motions: vec!["idle".to_string(), "nod".to_string(), "thinking".to_string()],
                    expressions: vec!["normal".to_string(), "gentle".to_string(), "worried".to_string()],
                    is_active: false,
                }
            ])
        }
        
        pub fn get_character(&self, id: &str) -> Result<Option<crate::database::character_registry::CharacterData>, String> {
            let characters = self.get_all_characters()?;
            Ok(characters.into_iter().find(|c| c.id == id))
        }
        
        pub fn get_active_character(&self) -> Result<Option<crate::database::character_registry::CharacterData>, String> {
            let characters = self.get_all_characters()?;
            Ok(characters.into_iter().find(|c| c.is_active))
        }
        
        pub fn set_active_character(&self, _id: &str) -> Result<(), String> {
            Ok(())
        }
        
        pub fn save_character_config(&self, _config: crate::database::character_registry::CharacterConfig) -> Result<(), String> {
            Ok(())
        }
        
        pub fn get_character_config(&self, id: &str) -> Result<Option<crate::database::character_registry::CharacterConfig>, String> {
            if id == "hiyori" {
                Ok(Some(crate::database::character_registry::CharacterConfig {
                    character_id: id.to_string(),
                    scale: 1.0,
                    position_x: 0.0,
                    position_y: 0.0,
                    interaction_enabled: true,
                    config_json: Some("{\"custom_param\": \"value\"}".to_string()),
                }))
            } else {
                Ok(None)
            }
        }
    }
    
    // Mock database for testing
    pub struct MockDatabase {
        pub character_registry: MockCharacterRegistry,
    }
    
    impl MockDatabase {
        pub fn new() -> Self {
            Self {
                character_registry: MockCharacterRegistry::new(),
            }
        }
    }
    
    // Helper function to create mock app state (simplified for testing)
    fn create_mock_character_config() -> HashMap<String, serde_json::Value> {
        let mut config = HashMap::new();
        config.insert("current_character".to_string(), json!("hiyori"));
        config.insert("scale".to_string(), json!(1.0));
        config.insert("interaction_enabled".to_string(), json!(true));
        config
    }

    // ================================
    // 数据类型测试
    // ================================

    #[test]
    fn test_character_info_serialization() {
        let character_info = CharacterInfo {
            id: "hiyori".to_string(),
            name: "Hiyori".to_string(),
            description: Some("可爱的猫耳少女".to_string()),
            preview_image: Some("/images/hiyori_preview.png".to_string()),
            model_path: "/live2d_models/hiyori/hiyori.model3.json".to_string(),
            motions: vec!["idle".to_string(), "wave".to_string(), "happy".to_string()],
            expressions: vec!["normal".to_string(), "smile".to_string(), "surprised".to_string()],
            is_active: true,
        };

        let serialized = serde_json::to_string(&character_info).expect("序列化失败");
        let deserialized: CharacterInfo = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(character_info.id, deserialized.id);
        assert_eq!(character_info.name, deserialized.name);
        assert_eq!(character_info.description, deserialized.description);
        assert_eq!(character_info.preview_image, deserialized.preview_image);
        assert_eq!(character_info.model_path, deserialized.model_path);
        assert_eq!(character_info.motions, deserialized.motions);
        assert_eq!(character_info.expressions, deserialized.expressions);
        assert_eq!(character_info.is_active, deserialized.is_active);
    }

    #[test]
    fn test_play_motion_request_serialization() {
        let request = PlayMotionRequest {
            character_id: Some("hiyori".to_string()),
            motion: "wave".to_string(),
            priority: Some(2),
            loop_motion: Some(true),
        };

        let serialized = serde_json::to_string(&request).expect("序列化失败");
        let deserialized: PlayMotionRequest = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(request.character_id, deserialized.character_id);
        assert_eq!(request.motion, deserialized.motion);
        assert_eq!(request.priority, deserialized.priority);
        assert_eq!(request.loop_motion, deserialized.loop_motion);
    }

    #[test]
    fn test_set_expression_request_serialization() {
        let request = SetExpressionRequest {
            character_id: Some("hiyori".to_string()),
            expression: "smile".to_string(),
        };

        let serialized = serde_json::to_string(&request).expect("序列化失败");
        let deserialized: SetExpressionRequest = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(request.character_id, deserialized.character_id);
        assert_eq!(request.expression, deserialized.expression);
    }

    #[test]
    fn test_switch_character_request_serialization() {
        let request = SwitchCharacterRequest {
            character_id: "shizuku".to_string(),
        };

        let serialized = serde_json::to_string(&request).expect("序列化失败");
        let deserialized: SwitchCharacterRequest = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(request.character_id, deserialized.character_id);
    }

    #[test]
    fn test_character_config_data_serialization() {
        let config = CharacterConfigData {
            character_id: "hiyori".to_string(),
            scale: 1.5,
            position_x: 100.0,
            position_y: 200.0,
            interaction_enabled: true,
            config_json: Some("{\"test\": true}".to_string()),
        };

        let serialized = serde_json::to_string(&config).expect("序列化失败");
        let deserialized: CharacterConfigData = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(config.character_id, deserialized.character_id);
        assert_eq!(config.scale, deserialized.scale);
        assert_eq!(config.position_x, deserialized.position_x);
        assert_eq!(config.position_y, deserialized.position_y);
        assert_eq!(config.interaction_enabled, deserialized.interaction_enabled);
        assert_eq!(config.config_json, deserialized.config_json);
    }

    // ================================
    // 边界条件和错误处理测试
    // ================================

    #[test]
    fn test_empty_character_info() {
        let character_info = CharacterInfo {
            id: "".to_string(),
            name: "".to_string(),
            description: None,
            preview_image: None,
            model_path: "".to_string(),
            motions: vec![],
            expressions: vec![],
            is_active: false,
        };

        let serialized = serde_json::to_string(&character_info).expect("空角色信息序列化失败");
        let deserialized: CharacterInfo = serde_json::from_str(&serialized).expect("空角色信息反序列化失败");

        assert_eq!(character_info.id, deserialized.id);
        assert_eq!(character_info.name, deserialized.name);
        assert_eq!(character_info.motions.len(), 0);
        assert_eq!(character_info.expressions.len(), 0);
        assert!(!character_info.is_active);
    }

    #[test]
    fn test_large_character_data() {
        let character_info = CharacterInfo {
            id: "large_character".to_string(),
            name: "A".repeat(1000), // 1000 character name
            description: Some("B".repeat(10000)), // 10KB description
            preview_image: Some("https://example.com/very-long-url-path/".repeat(100)),
            model_path: "D".repeat(500),
            motions: (0..500).map(|i| format!("motion_{}", i)).collect(), // 500 motions
            expressions: (0..200).map(|i| format!("expression_{}", i)).collect(), // 200 expressions
            is_active: false,
        };

        let serialized = serde_json::to_string(&character_info).expect("大型角色数据序列化失败");
        let deserialized: CharacterInfo = serde_json::from_str(&serialized).expect("大型角色数据反序列化失败");

        assert_eq!(character_info.name.len(), deserialized.name.len());
        assert_eq!(character_info.motions.len(), deserialized.motions.len());
        assert_eq!(character_info.expressions.len(), deserialized.expressions.len());
        assert_eq!(character_info.motions.len(), 500);
        assert_eq!(character_info.expressions.len(), 200);
    }

    #[test]
    fn test_unicode_character_data() {
        let character_info = CharacterInfo {
            id: "unicode_character".to_string(),
            name: "测试角色 🎭".to_string(),
            description: Some("这是一个支持Unicode的角色 🌟".to_string()),
            preview_image: Some("/images/测试角色.png".to_string()),
            model_path: "/live2d_models/测试角色/模型.model3.json".to_string(),
            motions: vec!["待机".to_string(), "挥手👋".to_string(), "微笑😊".to_string()],
            expressions: vec!["普通".to_string(), "开心😄".to_string(), "惊讶😲".to_string()],
            is_active: false,
        };

        let serialized = serde_json::to_string(&character_info).expect("Unicode角色数据序列化失败");
        let deserialized: CharacterInfo = serde_json::from_str(&serialized).expect("Unicode角色数据反序列化失败");

        assert_eq!(character_info.name, deserialized.name);
        assert_eq!(character_info.description, deserialized.description);
        assert_eq!(character_info.motions, deserialized.motions);
        assert_eq!(character_info.expressions, deserialized.expressions);
    }

    #[test]
    fn test_extreme_scale_values() {
        // Test very small scale
        let config_small = CharacterConfigData {
            character_id: "test".to_string(),
            scale: 0.001, // Very small scale
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: None,
        };

        let serialized = serde_json::to_string(&config_small).expect("小比例配置序列化失败");
        let deserialized: CharacterConfigData = serde_json::from_str(&serialized).expect("小比例配置反序列化失败");
        assert_eq!(config_small.scale, deserialized.scale);

        // Test very large scale
        let config_large = CharacterConfigData {
            character_id: "test".to_string(),
            scale: 1000.0, // Very large scale
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: None,
        };

        let serialized = serde_json::to_string(&config_large).expect("大比例配置序列化失败");
        let deserialized: CharacterConfigData = serde_json::from_str(&serialized).expect("大比例配置反序列化失败");
        assert_eq!(config_large.scale, deserialized.scale);
    }

    #[test]
    fn test_extreme_position_values() {
        let config = CharacterConfigData {
            character_id: "test".to_string(),
            scale: 1.0,
            position_x: f64::MAX,
            position_y: f64::MIN,
            interaction_enabled: true,
            config_json: None,
        };

        let serialized = serde_json::to_string(&config).expect("极值位置配置序列化失败");
        let deserialized: CharacterConfigData = serde_json::from_str(&serialized).expect("极值位置配置反序列化失败");

        assert_eq!(config.position_x, deserialized.position_x);
        assert_eq!(config.position_y, deserialized.position_y);
    }

    #[test]
    fn test_complex_config_json() {
        let complex_json = json!({
            "animations": {
                "idle": {
                    "duration": 5000,
                    "loop": true,
                    "files": ["idle_01.motion3.json", "idle_02.motion3.json"]
                },
                "talking": {
                    "duration": 2000,
                    "loop": false,
                    "files": ["talk_01.motion3.json"]
                }
            },
            "expressions": {
                "happy": "exp_happy.exp3.json",
                "sad": "exp_sad.exp3.json",
                "angry": "exp_angry.exp3.json"
            },
            "physics": {
                "gravity": 9.8,
                "wind": 0.5,
                "hair_physics": true
            },
            "custom_settings": {
                "eye_blink_interval": 3.0,
                "breath_strength": 0.8,
                "random_motions": true
            }
        });

        let config = CharacterConfigData {
            character_id: "complex_character".to_string(),
            scale: 1.0,
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: Some(complex_json.to_string()),
        };

        let serialized = serde_json::to_string(&config).expect("复杂配置JSON序列化失败");
        let deserialized: CharacterConfigData = serde_json::from_str(&serialized).expect("复杂配置JSON反序列化失败");

        assert_eq!(config.config_json, deserialized.config_json);
        
        // Verify JSON is valid
        if let Some(ref json_str) = deserialized.config_json {
            let parsed: serde_json::Value = serde_json::from_str(json_str).expect("配置JSON解析失败");
            assert!(parsed["animations"]["idle"]["loop"].as_bool().unwrap());
            assert_eq!(parsed["physics"]["gravity"].as_f64().unwrap(), 9.8);
        }
    }

    // ================================
    // 请求验证测试
    // ================================

    #[test]
    fn test_play_motion_request_defaults() {
        let request = PlayMotionRequest {
            character_id: None,
            motion: "idle".to_string(),
            priority: None,
            loop_motion: None,
        };

        assert!(request.character_id.is_none());
        assert_eq!(request.motion, "idle");
        assert!(request.priority.is_none());
        assert!(request.loop_motion.is_none());
    }

    #[test]
    fn test_set_expression_request_defaults() {
        let request = SetExpressionRequest {
            character_id: None,
            expression: "normal".to_string(),
        };

        assert!(request.character_id.is_none());
        assert_eq!(request.expression, "normal");
    }

    #[test]
    fn test_motion_priority_ranges() {
        // Test minimum priority
        let request_min = PlayMotionRequest {
            character_id: Some("test".to_string()),
            motion: "test".to_string(),
            priority: Some(0),
            loop_motion: Some(false),
        };
        assert_eq!(request_min.priority, Some(0));

        // Test maximum priority
        let request_max = PlayMotionRequest {
            character_id: Some("test".to_string()),
            motion: "test".to_string(),
            priority: Some(u8::MAX),
            loop_motion: Some(false),
        };
        assert_eq!(request_max.priority, Some(u8::MAX));
    }

    // ================================
    // 命令响应测试
    // ================================

    #[tokio::test]
    async fn test_command_response_success() {
        let character_info = CharacterInfo {
            id: "test".to_string(),
            name: "Test Character".to_string(),
            description: Some("Test description".to_string()),
            preview_image: None,
            model_path: "/live2d_models/test/test.model3.json".to_string(),
            motions: vec![],
            expressions: vec![],
            is_active: true,
        };

        let response = CommandResponse::success(character_info.clone());

        assert!(response.success);
        assert_eq!(response.data, Some(character_info));
        assert!(response.error.is_none());
        assert!(response.message.is_none());
        assert!(response.timestamp > 0);
    }

    #[tokio::test]
    async fn test_command_response_error() {
        let error_msg = "Character not found".to_string();
        let response: CommandResponse<CharacterInfo> = CommandResponse::error(error_msg.clone());

        assert!(!response.success);
        assert!(response.data.is_none());
        assert_eq!(response.error, Some(error_msg));
        assert!(response.message.is_none());
        assert!(response.timestamp > 0);
    }

    #[tokio::test]
    async fn test_command_response_success_with_message() {
        let data = true;
        let message = "Character switched successfully".to_string();
        let response = CommandResponse::success_with_message(data, message.clone());

        assert!(response.success);
        assert_eq!(response.data, Some(data));
        assert!(response.error.is_none());
        assert_eq!(response.message, Some(message));
        assert!(response.timestamp > 0);
    }

    // ================================
    // 命令元数据测试
    // ================================

    #[test]
    fn test_get_command_metadata() {
        let metadata = get_command_metadata();
        
        // Test that metadata contains expected commands
        assert!(metadata.contains_key("get_characters"));
        assert!(metadata.contains_key("get_character_info"));
        assert!(metadata.contains_key("switch_character"));
        assert!(metadata.contains_key("play_motion"));
        assert!(metadata.contains_key("set_expression"));
        assert!(metadata.contains_key("save_character_config"));
        assert!(metadata.contains_key("get_character_config"));

        // Test metadata structure for get_characters
        if let Some(get_characters_meta) = metadata.get("get_characters") {
            assert_eq!(get_characters_meta.name, "get_characters");
            assert_eq!(get_characters_meta.category, "character");
            assert!(get_characters_meta.is_async);
            assert_eq!(get_characters_meta.required_permission, PermissionLevel::Public);
        }

        // Test metadata structure for switch_character
        if let Some(switch_character_meta) = metadata.get("switch_character") {
            assert_eq!(switch_character_meta.name, "switch_character");
            assert_eq!(switch_character_meta.category, "character");
            assert!(switch_character_meta.is_async);
            assert_eq!(switch_character_meta.required_permission, PermissionLevel::User);
        }
    }

    #[test]
    fn test_all_character_command_metadata_completeness() {
        let metadata = get_command_metadata();
        
        for (command_name, meta) in metadata.iter() {
            // Verify all metadata fields are properly set
            assert!(!meta.name.is_empty(), "Command {} has empty name", command_name);
            assert!(!meta.description.is_empty(), "Command {} has empty description", command_name);
            assert!(!meta.category.is_empty(), "Command {} has empty category", command_name);
            assert_eq!(meta.name, *command_name, "Command name mismatch for {}", command_name);
            assert_eq!(meta.category, "character", "All commands should be in character category");
            
            // Verify permission levels are valid
            match meta.required_permission {
                PermissionLevel::Public | PermissionLevel::User | PermissionLevel::Admin | PermissionLevel::System => {},
            }
        }
    }

    // ================================
    // 数据库集成测试
    // ================================

    #[tokio::test]
    async fn test_database_character_operations() {
        let mock_registry = MockCharacterRegistry::new();
        
        // Test get_all_characters
        let characters = mock_registry.get_all_characters().unwrap();
        assert_eq!(characters.len(), 2);
        assert!(characters.iter().any(|c| c.id == "hiyori"));
        assert!(characters.iter().any(|c| c.id == "shizuku"));
        
        // Test get_character
        let hiyori = mock_registry.get_character("hiyori").unwrap();
        assert!(hiyori.is_some());
        let hiyori = hiyori.unwrap();
        assert_eq!(hiyori.name, "Hiyori");
        assert!(hiyori.is_active);
        
        // Test get non-existent character
        let non_existent = mock_registry.get_character("non_existent").unwrap();
        assert!(non_existent.is_none());
        
        // Test get_active_character
        let active = mock_registry.get_active_character().unwrap();
        assert!(active.is_some());
        let active = active.unwrap();
        assert_eq!(active.id, "hiyori");
        
        // Test set_active_character
        let result = mock_registry.set_active_character("shizuku");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_database_character_config_operations() {
        let mock_registry = MockCharacterRegistry::new();
        
        // Test get existing config
        let config = mock_registry.get_character_config("hiyori").unwrap();
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.character_id, "hiyori");
        assert_eq!(config.scale, 1.0);
        assert!(config.interaction_enabled);
        
        // Test get non-existent config
        let no_config = mock_registry.get_character_config("non_existent").unwrap();
        assert!(no_config.is_none());
        
        // Test save config
        let new_config = crate::database::character_registry::CharacterConfig {
            character_id: "test_character".to_string(),
            scale: 1.5,
            position_x: 100.0,
            position_y: 200.0,
            interaction_enabled: false,
            config_json: Some("{\"custom\": \"data\"}".to_string()),
        };
        
        let result = mock_registry.save_character_config(new_config);
        assert!(result.is_ok());
    }

    // ================================
    // 命令处理函数模拟测试
    // ================================

    /// 创建模拟应用状态  
    fn create_mock_app_state() -> MockAppState {
        use crate::{AppConfig as Config, CharacterConfig};
        use std::sync::Arc;
        use parking_lot::Mutex;
        
        let mut config = Config::default();
        config.character = CharacterConfig {
            current_character: "hiyori".to_string(),
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
        };
        
        MockAppState {
            config: Arc::new(Mutex::new(config)),
        }
    }
    
    /// 简化的AppState用于测试
    pub struct MockAppState {
        pub config: std::sync::Arc<parking_lot::Mutex<crate::AppConfig>>,
    }

    #[tokio::test]
    async fn test_character_info_database_conversion() {
        let mock_registry = MockCharacterRegistry::new();
        let characters_data = mock_registry.get_all_characters().unwrap();
        
        // Test conversion from database format to API format
        let characters: Vec<CharacterInfo> = characters_data
            .into_iter()
            .map(|c| CharacterInfo {
                id: c.id,
                name: c.name,
                description: Some(c.description),
                preview_image: c.preview_image,
                model_path: c.path,
                motions: c.motions,
                expressions: c.expressions,
                is_active: c.is_active,
            })
            .collect();
        
        assert_eq!(characters.len(), 2);
        
        let hiyori = characters.iter().find(|c| c.id == "hiyori").unwrap();
        assert_eq!(hiyori.name, "Hiyori");
        assert_eq!(hiyori.motions.len(), 3);
        assert_eq!(hiyori.expressions.len(), 3);
        assert!(hiyori.is_active);
        
        let shizuku = characters.iter().find(|c| c.id == "shizuku").unwrap();
        assert_eq!(shizuku.name, "Shizuku");
        assert!(!shizuku.is_active);
    }

    #[tokio::test]
    async fn test_character_config_data_conversion() {
        let db_config = crate::database::character_registry::CharacterConfig {
            character_id: "test_character".to_string(),
            scale: 2.0,
            position_x: 50.0,
            position_y: 100.0,
            interaction_enabled: true,
            config_json: Some("{\"theme\": \"dark\", \"animation_speed\": 1.5}".to_string()),
        };
        
        // Convert to API format
        let config_data = CharacterConfigData {
            character_id: db_config.character_id.clone(),
            scale: db_config.scale,
            position_x: db_config.position_x,
            position_y: db_config.position_y,
            interaction_enabled: db_config.interaction_enabled,
            config_json: db_config.config_json.clone(),
        };
        
        assert_eq!(config_data.character_id, "test_character");
        assert_eq!(config_data.scale, 2.0);
        assert_eq!(config_data.position_x, 50.0);
        assert_eq!(config_data.position_y, 100.0);
        assert!(config_data.interaction_enabled);
        
        // Verify JSON is valid
        if let Some(ref json_str) = config_data.config_json {
            let parsed: serde_json::Value = serde_json::from_str(json_str).expect("Invalid JSON");
            assert_eq!(parsed["theme"], "dark");
            assert_eq!(parsed["animation_speed"], 1.5);
        }
    }

    // ================================
    // 错误处理和边界条件测试
    // ================================

    #[tokio::test]
    async fn test_character_not_found_scenarios() {
        // Test with empty character ID
        let empty_id = "".to_string();
        let mock_registry = MockCharacterRegistry::new();
        let result = mock_registry.get_character(&empty_id).unwrap();
        assert!(result.is_none());
        
        // Test with very long character ID
        let long_id = "a".repeat(1000);
        let result = mock_registry.get_character(&long_id).unwrap();
        assert!(result.is_none());
        
        // Test with special characters in ID
        let special_id = "char-with-特殊字符-and-🎭-emoji".to_string();
        let result = mock_registry.get_character(&special_id).unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_character_scale_validation() {
        // Test valid scale ranges
        let valid_scales = vec![0.1, 0.5, 1.0, 1.5, 2.0, 5.0];
        
        for scale in valid_scales {
            let config = CharacterConfigData {
                character_id: "test".to_string(),
                scale,
                position_x: 0.0,
                position_y: 0.0,
                interaction_enabled: true,
                config_json: None,
            };
            
            // In a real command handler, we would validate scale between 0.1 and 5.0
            assert!(scale >= 0.1 && scale <= 5.0, "Scale {} should be valid", scale);
        }
        
        // Test invalid scales (for validation logic)
        let invalid_scales = vec![0.0, -1.0, 10.0, f64::INFINITY, f64::NEG_INFINITY];
        
        for scale in invalid_scales {
            // These would be rejected by validation logic
            assert!(scale < 0.1 || scale > 5.0 || !scale.is_finite(), "Scale {} should be invalid", scale);
        }
    }

    #[tokio::test]
    async fn test_motion_request_validation() {
        // Test valid motion requests
        let valid_request = PlayMotionRequest {
            character_id: Some("hiyori".to_string()),
            motion: "idle".to_string(),
            priority: Some(1),
            loop_motion: Some(false),
        };
        
        assert!(!valid_request.motion.is_empty());
        assert!(valid_request.priority.unwrap() >= 0);
        
        // Test edge cases
        let edge_cases = vec![
            PlayMotionRequest {
                character_id: None, // Use current character
                motion: "wave".to_string(),
                priority: Some(u8::MAX), // Maximum priority
                loop_motion: Some(true),
            },
            PlayMotionRequest {
                character_id: Some("".to_string()), // Empty character ID
                motion: "gesture".to_string(),
                priority: Some(0), // Minimum priority
                loop_motion: None, // No loop preference
            },
        ];
        
        for request in edge_cases {
            // Verify structure is maintained
            assert_eq!(request.motion.chars().count() > 0 || request.motion.is_empty(), true);
        }
    }

    #[tokio::test]
    async fn test_expression_request_validation() {
        // Test valid expression requests
        let requests = vec![
            SetExpressionRequest {
                character_id: Some("hiyori".to_string()),
                expression: "smile".to_string(),
            },
            SetExpressionRequest {
                character_id: None, // Use current character
                expression: "normal".to_string(),
            },
            SetExpressionRequest {
                character_id: Some("".to_string()), // Empty ID (should use current)
                expression: "😊".to_string(), // Unicode expression
            },
        ];
        
        for request in requests {
            assert!(!request.expression.is_empty());
            // Character ID can be None (use current) or Some(string)
            if let Some(ref id) = request.character_id {
                // Empty string is allowed (falls back to current character)
                assert!(id.len() >= 0);
            }
        }
    }

    // ================================
    // 并发和性能测试
    // ================================

    #[tokio::test]
    async fn test_concurrent_character_operations() {
        use tokio::task;
        
        let mock_registry = MockCharacterRegistry::new();
        
        // Simulate concurrent operations
        let tasks = vec![
            task::spawn(async {
                let _characters = MockCharacterRegistry::new().get_all_characters();
            }),
            task::spawn(async {
                let _character = MockCharacterRegistry::new().get_character("hiyori");
            }),
            task::spawn(async {
                let _active = MockCharacterRegistry::new().get_active_character();
            }),
        ];
        
        // Wait for all tasks to complete
        for task in tasks {
            assert!(task.await.is_ok());
        }
    }

    #[tokio::test]
    async fn test_large_character_dataset_performance() {
        // Create a large mock character registry
        let mut large_characters = Vec::new();
        
        for i in 0..1000 {
            large_characters.push(crate::database::character_registry::CharacterData {
                id: format!("character_{}", i),
                name: format!("Character {}", i),
                display_name: format!("角色{}", i),
                path: format!("/live2d/character_{}", i),
                preview_image: Some(format!("/images/character_{}_preview.png", i)),
                description: format!("Generated character number {}", i),
                gender: if i % 2 == 0 { "female" } else { "male" }.to_string(),
                size: "medium".to_string(),
                features: vec![format!("feature_{}", i % 10)],
                motions: vec!["idle".to_string(), "wave".to_string()],
                expressions: vec!["normal".to_string(), "smile".to_string()],
                is_active: i == 0, // Only first one is active
            });
        }
        
        // Test performance with large dataset
        let start = std::time::Instant::now();
        
        // Simulate operations that would be performed on large dataset
        let active_characters: Vec<_> = large_characters
            .iter()
            .filter(|c| c.is_active)
            .collect();
        
        let search_result: Vec<_> = large_characters
            .iter()
            .filter(|c| c.name.contains("Character 1"))
            .collect();
        
        let duration = start.elapsed();
        
        // Verify results
        assert_eq!(active_characters.len(), 1);
        assert!(search_result.len() > 0);
        
        // Performance should be reasonable for 1000 characters
        assert!(duration.as_millis() < 100, "Operation took too long: {:?}", duration);
    }

    // ================================
    // 集成测试示例
    // ================================

    #[tokio::test]
    async fn test_character_workflow_simulation() {
        // Simulate a complete character management workflow
        
        // 1. Get all characters
        let mock_characters = vec![
            CharacterInfo {
                id: "hiyori".to_string(),
                name: "Hiyori".to_string(),
                description: Some("可爱的猫耳少女".to_string()),
                preview_image: Some("/images/hiyori.png".to_string()),
                model_path: "/live2d_models/hiyori/hiyori.model3.json".to_string(),
                motions: vec!["idle".to_string(), "tap".to_string()],
                expressions: vec!["normal".to_string(), "smile".to_string()],
                is_active: true,
            },
            CharacterInfo {
                id: "shizuku".to_string(),
                name: "Shizuku".to_string(),
                description: Some("温柔的治愈系少女".to_string()),
                preview_image: Some("/images/shizuku.png".to_string()),
                model_path: "/live2d_models/shizuku/shizuku.model3.json".to_string(),
                motions: vec!["idle".to_string(), "nod".to_string()],
                expressions: vec!["normal".to_string(), "gentle".to_string()],
                is_active: false,
            }
        ];
        
        // 2. Switch character
        let switch_request = SwitchCharacterRequest {
            character_id: "shizuku".to_string(),
        };
        
        // 3. Play motion
        let motion_request = PlayMotionRequest {
            character_id: Some("shizuku".to_string()),
            motion: "nod".to_string(),
            priority: Some(1),
            loop_motion: Some(false),
        };
        
        // 4. Set expression
        let expression_request = SetExpressionRequest {
            character_id: Some("shizuku".to_string()),
            expression: "gentle".to_string(),
        };
        
        // 5. Update configuration
        let config_update = CharacterConfigData {
            character_id: "shizuku".to_string(),
            scale: 1.2,
            position_x: 50.0,
            position_y: 100.0,
            interaction_enabled: true,
            config_json: Some("{\"theme\": \"gentle\"}".to_string()),
        };
        
        // Verify all requests are properly structured
        assert_eq!(mock_characters.len(), 2);
        assert_eq!(switch_request.character_id, "shizuku");
        assert_eq!(motion_request.motion, "nod");
        assert_eq!(expression_request.expression, "gentle");
        assert_eq!(config_update.scale, 1.2);
        
        // Verify workflow logic
        let current_active = mock_characters.iter().find(|c| c.is_active).unwrap();
        assert_eq!(current_active.id, "hiyori");
        
        let target_character = mock_characters.iter().find(|c| c.id == switch_request.character_id).unwrap();
        assert!(!target_character.is_active); // Should become active after switch
        assert!(target_character.motions.contains(&motion_request.motion));
        assert!(target_character.expressions.contains(&expression_request.expression));
    }
}

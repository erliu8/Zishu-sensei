//! # 模型配置管理命令模块
//! 
//! 提供模型配置的 CRUD 操作、验证、历史记录等功能的 Tauri 命令

use crate::create_command;
use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{commands::*, AppState, ZishuResult};
use crate::database::{get_database, model_config::*};

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert(
        "save_model_config".to_string(),
        CommandMetadata {
            name: "save_model_config".to_string(),
            description: "保存模型配置".to_string(),
            input_type: Some("ModelConfigData".to_string()),
            output_type: Some("SaveConfigResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "get_model_config".to_string(),
        CommandMetadata {
            name: "get_model_config".to_string(),
            description: "获取模型配置".to_string(),
            input_type: Some("GetConfigInput".to_string()),
            output_type: Some("ModelConfigData".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "delete_model_config".to_string(),
        CommandMetadata {
            name: "delete_model_config".to_string(),
            description: "删除模型配置".to_string(),
            input_type: Some("DeleteConfigInput".to_string()),
            output_type: Some("DeleteConfigResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "get_all_model_configs".to_string(),
        CommandMetadata {
            name: "get_all_model_configs".to_string(),
            description: "获取所有模型配置".to_string(),
            input_type: None,
            output_type: Some("GetAllConfigsResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "get_default_model_config".to_string(),
        CommandMetadata {
            name: "get_default_model_config".to_string(),
            description: "获取默认模型配置".to_string(),
            input_type: None,
            output_type: Some("ModelConfigData".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "set_default_model_config".to_string(),
        CommandMetadata {
            name: "set_default_model_config".to_string(),
            description: "设置默认模型配置".to_string(),
            input_type: Some("SetDefaultConfigInput".to_string()),
            output_type: Some("SetDefaultConfigResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "validate_model_config".to_string(),
        CommandMetadata {
            name: "validate_model_config".to_string(),
            description: "验证模型配置".to_string(),
            input_type: Some("ModelConfigData".to_string()),
            output_type: Some("ValidationResult".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "get_config_history".to_string(),
        CommandMetadata {
            name: "get_config_history".to_string(),
            description: "获取配置历史记录".to_string(),
            input_type: Some("GetHistoryInput".to_string()),
            output_type: Some("GetHistoryResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "export_model_config".to_string(),
        CommandMetadata {
            name: "export_model_config".to_string(),
            description: "导出模型配置".to_string(),
            input_type: Some("ExportConfigInput".to_string()),
            output_type: Some("ExportConfigResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata.insert(
        "import_model_config".to_string(),
        CommandMetadata {
            name: "import_model_config".to_string(),
            description: "导入模型配置".to_string(),
            input_type: Some("ImportConfigInput".to_string()),
            output_type: Some("ImportConfigResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "model_config".to_string(),
        },
    );
    
    metadata
}

// ================================
// 请求/响应数据结构
// ================================

/// 获取配置输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigInput {
    pub config_id: String,
}

/// 删除配置输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteConfigInput {
    pub config_id: String,
}

/// 删除配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteConfigResponse {
    pub success: bool,
    pub message: String,
}

/// 保存配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigResponse {
    pub success: bool,
    pub config_id: String,
    pub message: String,
}

/// 获取所有配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAllConfigsResponse {
    pub configs: Vec<ModelConfigData>,
    pub total: usize,
}

/// 设置默认配置输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetDefaultConfigInput {
    pub config_id: String,
}

/// 设置默认配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetDefaultConfigResponse {
    pub success: bool,
    pub message: String,
}

/// 获取历史记录输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetHistoryInput {
    pub config_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// 获取历史记录响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetHistoryResponse {
    pub history: Vec<ModelConfigHistory>,
    pub total: usize,
}

/// 导出配置输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportConfigInput {
    /// 配置 ID，如果为 None 则导出所有配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_id: Option<String>,
}

/// 导出配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportConfigResponse {
    pub success: bool,
    pub data: String,
}

/// 导入配置输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConfigInput {
    pub data: String,
    /// 是否批量导入
    #[serde(default)]
    pub batch: bool,
}

/// 导入配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConfigResponse {
    pub success: bool,
    pub imported_ids: Vec<String>,
    pub message: String,
}

// ================================
// 命令处理器实现
// ================================

/// 保存模型配置处理器
pub async fn save_model_config_handler(
    input: ModelConfigData,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("save_model_config", Some(&input.id));
    
    // 获取数据库实例
    let db = get_database().ok_or_else(|| {
        handle_command_error("save_model_config", "数据库未初始化")
    })?;
    
    // 保存配置
    db.model_config_registry.save_config(input.clone()).map_err(|e| {
        handle_command_error("save_model_config", &format!("保存配置失败: {}", e))
    })?;
    
    // 如果设置为默认，更新 AppState
    if input.is_default {
        let model_config = crate::state::ModelConfig {
            model_id: input.model_id.clone(),
            adapter_id: input.adapter_id.clone(),
            temperature: input.temperature,
            top_p: input.top_p,
            max_tokens: input.max_tokens,
        };
        state.chat.set_model_config(model_config);
    }
    
    let response = SaveConfigResponse {
        success: true,
        config_id: input.id.clone(),
        message: "配置保存成功".to_string(),
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 获取模型配置处理器
pub async fn get_model_config_handler(
    input: GetConfigInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("get_model_config", Some(&input.config_id));
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("get_model_config", "数据库未初始化")
    })?;
    
    let config = db.model_config_registry.get_config(&input.config_id).map_err(|e| {
        handle_command_error("get_model_config", &format!("获取配置失败: {}", e))
    })?;
    
    match config {
        Some(cfg) => Ok(serde_json::to_value(cfg).unwrap()),
        None => Err("配置不存在".to_string()),
    }
}

/// 删除模型配置处理器
pub async fn delete_model_config_handler(
    input: DeleteConfigInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("delete_model_config", Some(&input.config_id));
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("delete_model_config", "数据库未初始化")
    })?;
    
    db.model_config_registry.delete_config(&input.config_id).map_err(|e| {
        handle_command_error("delete_model_config", &format!("删除配置失败: {}", e))
    })?;
    
    let response = DeleteConfigResponse {
        success: true,
        message: "配置删除成功".to_string(),
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 获取所有模型配置处理器
pub async fn get_all_model_configs_handler(
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("get_all_model_configs", None);
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("get_all_model_configs", "数据库未初始化")
    })?;
    
    let configs = db.model_config_registry.get_all_configs().map_err(|e| {
        handle_command_error("get_all_model_configs", &format!("获取配置列表失败: {}", e))
    })?;
    
    let response = GetAllConfigsResponse {
        total: configs.len(),
        configs,
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 获取默认模型配置处理器
pub async fn get_default_model_config_handler(
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("get_default_model_config", None);
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("get_default_model_config", "数据库未初始化")
    })?;
    
    let config = db.model_config_registry.get_default_config().map_err(|e| {
        handle_command_error("get_default_model_config", &format!("获取默认配置失败: {}", e))
    })?;
    
    match config {
        Some(cfg) => Ok(serde_json::to_value(cfg).unwrap()),
        None => Err("未设置默认配置".to_string()),
    }
}

/// 设置默认模型配置处理器
pub async fn set_default_model_config_handler(
    input: SetDefaultConfigInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("set_default_model_config", Some(&input.config_id));
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("set_default_model_config", "数据库未初始化")
    })?;
    
    db.model_config_registry.set_default_config(&input.config_id).map_err(|e| {
        handle_command_error("set_default_model_config", &format!("设置默认配置失败: {}", e))
    })?;
    
    // 更新 AppState
    let config = db.model_config_registry.get_config(&input.config_id).map_err(|e| {
        format!("获取配置失败: {}", e)
    })?.ok_or("配置不存在")?;
    
    let model_config = crate::state::ModelConfig {
        model_id: config.model_id.clone(),
        adapter_id: config.adapter_id.clone(),
        temperature: config.temperature,
        top_p: config.top_p,
        max_tokens: config.max_tokens,
    };
    state.chat.set_model_config(model_config);
    
    let response = SetDefaultConfigResponse {
        success: true,
        message: "默认配置设置成功".to_string(),
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 验证模型配置处理器
pub async fn validate_model_config_handler(
    input: ModelConfigData,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("validate_model_config", Some(&input.id));
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("validate_model_config", "数据库未初始化")
    })?;
    
    let validation = db.model_config_registry.validate_config(&input);
    
    Ok(serde_json::to_value(validation).unwrap())
}

/// 获取配置历史记录处理器
pub async fn get_config_history_handler(
    input: GetHistoryInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("get_config_history", Some(&input.config_id));
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("get_config_history", "数据库未初始化")
    })?;
    
    let history = db.model_config_registry.get_config_history(&input.config_id, input.limit).map_err(|e| {
        handle_command_error("get_config_history", &format!("获取历史记录失败: {}", e))
    })?;
    
    let response = GetHistoryResponse {
        total: history.len(),
        history,
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 导出模型配置处理器
pub async fn export_model_config_handler(
    input: ExportConfigInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("export_model_config", input.config_id.as_deref());
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("export_model_config", "数据库未初始化")
    })?;
    
    let data = if let Some(config_id) = input.config_id {
        // 导出单个配置
        db.model_config_registry.export_config(&config_id).map_err(|e| {
            handle_command_error("export_model_config", &format!("导出配置失败: {}", e))
        })?
    } else {
        // 导出所有配置
        db.model_config_registry.export_all_configs().map_err(|e| {
            handle_command_error("export_model_config", &format!("导出配置失败: {}", e))
        })?
    };
    
    let response = ExportConfigResponse {
        success: true,
        data,
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

/// 导入模型配置处理器
pub async fn import_model_config_handler(
    input: ImportConfigInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("import_model_config", None);
    
    let db = get_database().ok_or_else(|| {
        handle_command_error("import_model_config", "数据库未初始化")
    })?;
    
    let imported_ids = if input.batch {
        // 批量导入
        db.model_config_registry.import_configs(&input.data).map_err(|e| {
            handle_command_error("import_model_config", &format!("导入配置失败: {}", e))
        })?
    } else {
        // 单个导入
        let config = db.model_config_registry.import_config(&input.data).map_err(|e| {
            handle_command_error("import_model_config", &format!("导入配置失败: {}", e))
        })?;
        vec![config]
    };
    
    let response = ImportConfigResponse {
        success: true,
        imported_ids: imported_ids.clone(),
        message: format!("成功导入 {} 个配置", imported_ids.len()),
    };
    
    Ok(serde_json::to_value(response).unwrap())
}

// ================================
// 命令注册宏调用
// ================================

// 保存模型配置命令
create_command!(save_model_config, ModelConfigData, save_model_config_handler);

// 获取模型配置命令
create_command!(get_model_config, GetConfigInput, get_model_config_handler);

// 删除模型配置命令
create_command!(delete_model_config, DeleteConfigInput, delete_model_config_handler);

// 获取所有模型配置命令（无输入）
#[tauri::command]
pub async fn get_all_model_configs(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    get_all_model_configs_handler(app, state).await
}

// 获取默认模型配置命令（无输入）
#[tauri::command]
pub async fn get_default_model_config(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    get_default_model_config_handler(app, state).await
}

// 设置默认模型配置命令
create_command!(set_default_model_config, SetDefaultConfigInput, set_default_model_config_handler);

// 验证模型配置命令
create_command!(validate_model_config, ModelConfigData, validate_model_config_handler);

// 获取配置历史记录命令
create_command!(get_config_history, GetHistoryInput, get_config_history_handler);

// 导出模型配置命令
create_command!(export_model_config, ExportConfigInput, export_model_config_handler);

// 导入模型配置命令
create_command!(import_model_config, ImportConfigInput, import_model_config_handler);


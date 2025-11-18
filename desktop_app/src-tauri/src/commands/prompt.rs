//! # Prompt管理命令模块
//! 
//! 提供Prompt的创建、编辑、删除、应用等功能
//! Prompt用于角色扮演，与本地LLM模型配合使用
//! 
//! **已迁移到数据库存储**

use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::{
    commands::*,
    state::AppState,
};

// ================================
// 数据类型定义
// ================================

/// Prompt信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    /// Prompt ID（唯一标识）
    pub id: String,
    /// Prompt名称
    pub name: String,
    /// Prompt内容
    pub content: String,
    /// Prompt描述
    pub description: Option<String>,
    /// 关联的模型ID（可选）
    pub model_id: Option<String>,
    /// 角色设定
    pub character_setting: Option<String>,
    /// 是否启用
    pub is_enabled: bool,
    /// 是否为默认Prompt
    pub is_default: bool,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
    /// 使用次数
    pub usage_count: u64,
    /// 元数据
    pub metadata: HashMap<String, serde_json::Value>,
}

/// 创建Prompt请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePromptRequest {
    /// Prompt名称
    pub name: String,
    /// Prompt内容
    pub content: String,
    /// Prompt描述（可选）
    pub description: Option<String>,
    /// 关联的模型ID（可选）
    pub model_id: Option<String>,
    /// 角色设定（可选）
    pub character_setting: Option<String>,
    /// 是否设为默认
    pub set_as_default: bool,
}

/// 更新Prompt请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePromptRequest {
    /// Prompt ID
    pub prompt_id: String,
    /// 更新的名称（可选）
    pub name: Option<String>,
    /// 更新的内容（可选）
    pub content: Option<String>,
    /// 更新的描述（可选）
    pub description: Option<String>,
    /// 更新的角色设定（可选）
    pub character_setting: Option<String>,
    /// 是否设为默认（可选）
    pub set_as_default: Option<bool>,
}

/// 删除Prompt请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeletePromptRequest {
    /// Prompt ID
    pub prompt_id: String,
}

/// 应用Prompt请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyPromptRequest {
    /// Prompt ID
    pub prompt_id: String,
    /// 模型ID（可选，如果不提供则使用Prompt关联的模型）
    pub model_id: Option<String>,
}

// ================================
// 命令处理器
// ================================

/// 获取所有Prompt列表
#[tauri::command]
pub async fn get_prompts(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<Prompt>>, String> {
    info!("获取Prompt列表");
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.prompt_registry.get_all_prompts().await {
        Ok(db_prompts) => {
            let prompts: Vec<Prompt> = db_prompts.into_iter().map(|p| Prompt {
                id: p.id,
                name: p.name,
                content: p.content,
                description: p.description,
                model_id: p.model_id,
                character_setting: p.character_setting,
                is_enabled: p.is_enabled,
                is_default: p.is_default,
                created_at: p.created_at,
                updated_at: p.updated_at,
                usage_count: p.usage_count as u64,
                metadata: p.metadata,
            }).collect();
            
            info!("成功获取 {} 个Prompt", prompts.len());
            Ok(CommandResponse::success(prompts))
        }
        Err(e) => {
            error!("获取Prompt列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取Prompt列表失败: {}", e)))
        }
    }
}

/// 创建Prompt
#[tauri::command]
pub async fn create_prompt(
    request: CreatePromptRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Prompt>, String> {
    info!("创建Prompt: {}", request.name);
    
    // 验证输入
    if request.name.trim().is_empty() {
        return Ok(CommandResponse::error("Prompt名称不能为空".to_string()));
    }
    
    if request.content.trim().is_empty() {
        return Ok(CommandResponse::error("Prompt内容不能为空".to_string()));
    }
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    let prompt_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    let db_prompt = crate::database::prompt_registry::PromptData {
        id: prompt_id.clone(),
        name: request.name.clone(),
        content: request.content.clone(),
        description: request.description.clone(),
        model_id: request.model_id.clone(),
        character_setting: request.character_setting.clone(),
        is_enabled: true,
        is_default: request.set_as_default,
        created_at: now,
        updated_at: now,
        usage_count: 0,
        metadata: HashMap::new(),
    };
    
    match db.prompt_registry.create_prompt(db_prompt.clone()).await {
        Ok(_) => {
            if request.set_as_default {
                let _ = db.prompt_registry.set_default_prompt(&prompt_id).await;
            }
            
            let prompt = Prompt {
                id: db_prompt.id,
                name: db_prompt.name,
                content: db_prompt.content,
                description: db_prompt.description,
                model_id: db_prompt.model_id,
                character_setting: db_prompt.character_setting,
                is_enabled: db_prompt.is_enabled,
                is_default: db_prompt.is_default,
                created_at: db_prompt.created_at,
                updated_at: db_prompt.updated_at,
                usage_count: db_prompt.usage_count as u64,
                metadata: db_prompt.metadata,
            };
            
            info!("Prompt创建成功: {}", prompt.id);
            Ok(CommandResponse::success_with_message(
                prompt,
                format!("Prompt {} 创建成功", request.name),
            ))
        }
        Err(e) => {
            error!("创建Prompt失败: {}", e);
            Ok(CommandResponse::error(format!("创建Prompt失败: {}", e)))
        }
    }
}

/// 更新Prompt
#[tauri::command]
pub async fn update_prompt(
    request: UpdatePromptRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Prompt>, String> {
    info!("更新Prompt: {}", request.prompt_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // 获取现有Prompt
    let existing_prompt = match db.prompt_registry.get_prompt(&request.prompt_id).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            return Ok(CommandResponse::error(format!("Prompt不存在: {}", request.prompt_id)));
        }
        Err(e) => {
            return Ok(CommandResponse::error(format!("获取Prompt失败: {}", e)));
        }
    };
    
    // 更新字段
    let updated_prompt = crate::database::prompt_registry::PromptData {
        id: existing_prompt.id.clone(),
        name: request.name.unwrap_or(existing_prompt.name),
        content: request.content.unwrap_or(existing_prompt.content),
        description: request.description.or(existing_prompt.description),
        model_id: existing_prompt.model_id,
        character_setting: request.character_setting.or(existing_prompt.character_setting),
        is_enabled: existing_prompt.is_enabled,
        is_default: request.set_as_default.unwrap_or(existing_prompt.is_default),
        created_at: existing_prompt.created_at,
        updated_at: chrono::Utc::now().timestamp(),
        usage_count: existing_prompt.usage_count,
        metadata: existing_prompt.metadata.clone(),
    };
    
    match db.prompt_registry.update_prompt(&request.prompt_id, updated_prompt.clone()).await {
        Ok(_) => {
            if request.set_as_default.unwrap_or(false) {
                let _ = db.prompt_registry.set_default_prompt(&request.prompt_id).await;
            }
            
            let prompt = Prompt {
                id: updated_prompt.id,
                name: updated_prompt.name,
                content: updated_prompt.content,
                description: updated_prompt.description,
                model_id: updated_prompt.model_id,
                character_setting: updated_prompt.character_setting,
                is_enabled: updated_prompt.is_enabled,
                is_default: updated_prompt.is_default,
                created_at: updated_prompt.created_at,
                updated_at: updated_prompt.updated_at,
                usage_count: updated_prompt.usage_count as u64,
                metadata: updated_prompt.metadata,
            };
            
            info!("Prompt更新成功: {}", prompt.id);
            Ok(CommandResponse::success_with_message(
                prompt,
                "Prompt更新成功".to_string(),
            ))
        }
        Err(e) => {
            error!("更新Prompt失败: {}", e);
            Ok(CommandResponse::error(format!("更新Prompt失败: {}", e)))
        }
    }
}

/// 删除Prompt
#[tauri::command]
pub async fn delete_prompt(
    request: DeletePromptRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("删除Prompt: {}", request.prompt_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.prompt_registry.delete_prompt(&request.prompt_id).await {
        Ok(_) => {
            info!("Prompt删除成功: {}", request.prompt_id);
            Ok(CommandResponse::success_with_message(
                true,
                "Prompt删除成功".to_string(),
            ))
        }
        Err(e) => {
            error!("删除Prompt失败: {}", e);
            Ok(CommandResponse::error(format!("删除Prompt失败: {}", e)))
        }
    }
}

/// 应用Prompt（设置为当前使用的Prompt）
#[tauri::command]
pub async fn apply_prompt(
    request: ApplyPromptRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("应用Prompt: {}", request.prompt_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // 验证Prompt是否存在
    match db.prompt_registry.get_prompt(&request.prompt_id).await {
        Ok(Some(_)) => {
            // 设置为默认
            match db.prompt_registry.set_default_prompt(&request.prompt_id).await {
                Ok(_) => {
                    // 增加使用次数
                    let _ = db.prompt_registry.increment_usage(&request.prompt_id).await;
                    
                    info!("Prompt应用成功: {}", request.prompt_id);
                    Ok(CommandResponse::success_with_message(
                        true,
                        "Prompt应用成功".to_string(),
                    ))
                }
                Err(e) => {
                    error!("应用Prompt失败: {}", e);
                    Ok(CommandResponse::error(format!("应用Prompt失败: {}", e)))
                }
            }
        }
        Ok(None) => {
            Ok(CommandResponse::error(format!("Prompt不存在: {}", request.prompt_id)))
        }
        Err(e) => {
            Ok(CommandResponse::error(format!("获取Prompt失败: {}", e)))
        }
    }
}

/// 获取Prompt详情
#[tauri::command]
pub async fn get_prompt(
    prompt_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Prompt>, String> {
    info!("获取Prompt详情: {}", prompt_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.prompt_registry.get_prompt(&prompt_id).await {
        Ok(Some(db_prompt)) => {
            let prompt = Prompt {
                id: db_prompt.id,
                name: db_prompt.name,
                content: db_prompt.content,
                description: db_prompt.description,
                model_id: db_prompt.model_id,
                character_setting: db_prompt.character_setting,
                is_enabled: db_prompt.is_enabled,
                is_default: db_prompt.is_default,
                created_at: db_prompt.created_at,
                updated_at: db_prompt.updated_at,
                usage_count: db_prompt.usage_count as u64,
                metadata: db_prompt.metadata,
            };
            
            info!("成功获取Prompt详情: {}", prompt.name);
            Ok(CommandResponse::success(prompt))
        }
        Ok(None) => {
            warn!("Prompt不存在: {}", prompt_id);
            Ok(CommandResponse::error(format!("Prompt不存在: {}", prompt_id)))
        }
        Err(e) => {
            error!("获取Prompt详情失败: {}", e);
            Ok(CommandResponse::error(format!("获取Prompt详情失败: {}", e)))
        }
    }
}

/// 获取当前使用的Prompt
#[tauri::command]
pub async fn get_current_prompt(
    app_handle: AppHandle,
    _state: State<'_, AppState>,
) -> Result<CommandResponse<Option<Prompt>>, String> {
    info!("获取当前使用的Prompt");
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.prompt_registry.get_default_prompt().await {
        Ok(Some(db_prompt)) => {
            let prompt = Prompt {
                id: db_prompt.id,
                name: db_prompt.name,
                content: db_prompt.content,
                description: db_prompt.description,
                model_id: db_prompt.model_id,
                character_setting: db_prompt.character_setting,
                is_enabled: db_prompt.is_enabled,
                is_default: db_prompt.is_default,
                created_at: db_prompt.created_at,
                updated_at: db_prompt.updated_at,
                usage_count: db_prompt.usage_count as u64,
                metadata: db_prompt.metadata,
            };
            Ok(CommandResponse::success(Some(prompt)))
        }
        Ok(None) => {
            Ok(CommandResponse::success(None))
        }
        Err(e) => {
            error!("获取当前Prompt失败: {}", e);
            Ok(CommandResponse::error(format!("获取当前Prompt失败: {}", e)))
        }
    }
}

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert("get_prompts".to_string(), CommandMetadata {
        name: "get_prompts".to_string(),
        description: "获取所有Prompt列表".to_string(),
        input_type: None,
        output_type: Some("Vec<Prompt>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("create_prompt".to_string(), CommandMetadata {
        name: "create_prompt".to_string(),
        description: "创建Prompt".to_string(),
        input_type: Some("CreatePromptRequest".to_string()),
        output_type: Some("Prompt".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("update_prompt".to_string(), CommandMetadata {
        name: "update_prompt".to_string(),
        description: "更新Prompt".to_string(),
        input_type: Some("UpdatePromptRequest".to_string()),
        output_type: Some("Prompt".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("delete_prompt".to_string(), CommandMetadata {
        name: "delete_prompt".to_string(),
        description: "删除Prompt".to_string(),
        input_type: Some("DeletePromptRequest".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("apply_prompt".to_string(), CommandMetadata {
        name: "apply_prompt".to_string(),
        description: "应用Prompt（设置为当前使用的Prompt）".to_string(),
        input_type: Some("ApplyPromptRequest".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("get_prompt".to_string(), CommandMetadata {
        name: "get_prompt".to_string(),
        description: "获取Prompt详情".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("Prompt".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata.insert("get_current_prompt".to_string(), CommandMetadata {
        name: "get_current_prompt".to_string(),
        description: "获取当前使用的Prompt".to_string(),
        input_type: None,
        output_type: Some("Option<Prompt>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "prompt".to_string(),
    });
    
    metadata
}

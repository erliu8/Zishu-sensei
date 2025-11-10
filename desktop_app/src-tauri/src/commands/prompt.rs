//! # Prompt管理命令模块
//! 
//! 提供Prompt的创建、编辑、删除、应用等功能
//! Prompt用于角色扮演，与本地LLM模型配合使用

use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
    
    match get_prompts_from_storage(&app_handle).await {
        Ok(prompts) => {
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
    
    match create_prompt_internal(&request, &app_handle).await {
        Ok(prompt) => {
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
    
    match update_prompt_internal(&request, &app_handle).await {
        Ok(prompt) => {
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
    
    match delete_prompt_internal(&request, &app_handle).await {
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
    
    match apply_prompt_internal(&request, &app_handle, &state).await {
        Ok(_) => {
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

/// 获取Prompt详情
#[tauri::command]
pub async fn get_prompt(
    prompt_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Prompt>, String> {
    info!("获取Prompt详情: {}", prompt_id);
    
    match get_prompt_by_id(&prompt_id, &app_handle).await {
        Ok(Some(prompt)) => {
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
    
    match get_default_prompt(&app_handle).await {
        Ok(prompt) => {
            Ok(CommandResponse::success(prompt))
        }
        Err(e) => {
            error!("获取当前Prompt失败: {}", e);
            Ok(CommandResponse::error(format!("获取当前Prompt失败: {}", e)))
        }
    }
}

// ================================
// 内部实现函数
// ================================

/// 从存储中获取所有Prompt
async fn get_prompts_from_storage(app_handle: &AppHandle) -> Result<Vec<Prompt>, String> {
    let prompts_dir = get_prompts_directory(app_handle)?;
    
    if !prompts_dir.exists() {
        std::fs::create_dir_all(&prompts_dir).map_err(|e| {
            format!("创建Prompt目录失败: {}", e)
        })?;
        return Ok(vec![]);
    }
    
    // 读取Prompt索引文件
    let index_file = prompts_dir.join("prompts_index.json");
    if !index_file.exists() {
        return Ok(vec![]);
    }
    
    let content = std::fs::read_to_string(&index_file).map_err(|e| {
        format!("读取Prompt索引失败: {}", e)
    })?;
    
    let prompts: Vec<Prompt> = serde_json::from_str(&content).map_err(|e| {
        format!("解析Prompt索引失败: {}", e)
    })?;
    
    Ok(prompts)
}

/// 创建Prompt
async fn create_prompt_internal(
    request: &CreatePromptRequest,
    app_handle: &AppHandle,
) -> Result<Prompt, String> {
    // 验证输入
    if request.name.trim().is_empty() {
        return Err("Prompt名称不能为空".to_string());
    }
    
    if request.content.trim().is_empty() {
        return Err("Prompt内容不能为空".to_string());
    }
    
    // 如果设为默认，先取消其他默认Prompt
    if request.set_as_default {
        unset_all_default_prompts(app_handle).await?;
    }
    
    // 生成Prompt ID
    let prompt_id = format!("prompt_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..16].to_string());
    
    // 创建Prompt
    let prompt = Prompt {
        id: prompt_id.clone(),
        name: request.name.clone(),
        content: request.content.clone(),
        description: request.description.clone(),
        model_id: request.model_id.clone(),
        character_setting: request.character_setting.clone(),
        is_enabled: true,
        is_default: request.set_as_default,
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
        usage_count: 0,
        metadata: HashMap::new(),
    };
    
    // 保存Prompt
    save_prompt_to_index(&prompt, app_handle)?;
    
    Ok(prompt)
}

/// 更新Prompt
async fn update_prompt_internal(
    request: &UpdatePromptRequest,
    app_handle: &AppHandle,
) -> Result<Prompt, String> {
    let mut prompts = get_prompts_from_storage(app_handle).await?;
    
    let prompt = prompts.iter_mut()
        .find(|p| p.id == request.prompt_id)
        .ok_or("Prompt不存在")?;
    
    // 更新字段
    if let Some(name) = &request.name {
        prompt.name = name.clone();
    }
    
    if let Some(content) = &request.content {
        prompt.content = content.clone();
    }
    
    if let Some(description) = &request.description {
        prompt.description = Some(description.clone());
    }
    
    if let Some(character_setting) = &request.character_setting {
        prompt.character_setting = Some(character_setting.clone());
    }
    
    if let Some(set_as_default) = request.set_as_default {
        if set_as_default {
            unset_all_default_prompts(app_handle).await?;
        }
        prompt.is_default = set_as_default;
    }
    
    prompt.updated_at = chrono::Utc::now().timestamp();
    
    // 克隆prompt数据以便在保存后返回
    let prompt_clone = prompt.clone();
    
    // 保存更新（现在可以安全地借用prompts，因为prompt的借用已经结束）
    save_all_prompts_to_index(&prompts, app_handle)?;
    
    Ok(prompt_clone)
}

/// 删除Prompt
async fn delete_prompt_internal(
    request: &DeletePromptRequest,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let mut prompts = get_prompts_from_storage(app_handle).await?;
    
    prompts.retain(|p| p.id != request.prompt_id);
    
    save_all_prompts_to_index(&prompts, app_handle)?;
    
    Ok(())
}

/// 应用Prompt
async fn apply_prompt_internal(
    request: &ApplyPromptRequest,
    app_handle: &AppHandle,
    _state: &AppState,
) -> Result<(), String> {
    let mut prompts = get_prompts_from_storage(app_handle).await?;
    
    let prompt = prompts.iter_mut()
        .find(|p| p.id == request.prompt_id)
        .ok_or("Prompt不存在")?;
    
    // 取消所有默认Prompt
    unset_all_default_prompts(app_handle).await?;
    
    // 设置为默认
    prompt.is_default = true;
    prompt.is_enabled = true;
    prompt.usage_count += 1;
    prompt.updated_at = chrono::Utc::now().timestamp();
    
    // 如果提供了模型ID，更新关联
    if let Some(model_id) = &request.model_id {
        prompt.model_id = Some(model_id.clone());
    }
    
    // 重新加载所有Prompt以更新状态
    let mut all_prompts = get_prompts_from_storage(app_handle).await?;
    for p in all_prompts.iter_mut() {
        if p.id == request.prompt_id {
            p.is_default = true;
            p.is_enabled = true;
            p.usage_count += 1;
            p.updated_at = chrono::Utc::now().timestamp();
            if let Some(model_id) = &request.model_id {
                p.model_id = Some(model_id.clone());
            }
        } else {
            p.is_default = false;
        }
    }
    
    save_all_prompts_to_index(&all_prompts, app_handle)?;
    
    Ok(())
}

/// 根据ID获取Prompt
async fn get_prompt_by_id(
    prompt_id: &str,
    app_handle: &AppHandle,
) -> Result<Option<Prompt>, String> {
    let prompts = get_prompts_from_storage(app_handle).await?;
    Ok(prompts.into_iter().find(|p| p.id == prompt_id))
}

/// 获取默认Prompt
async fn get_default_prompt(app_handle: &AppHandle) -> Result<Option<Prompt>, String> {
    let prompts = get_prompts_from_storage(app_handle).await?;
    Ok(prompts.into_iter().find(|p| p.is_default && p.is_enabled))
}

/// 取消所有默认Prompt
async fn unset_all_default_prompts(app_handle: &AppHandle) -> Result<(), String> {
    let mut prompts = get_prompts_from_storage(app_handle).await?;
    
    for prompt in prompts.iter_mut() {
        prompt.is_default = false;
    }
    
    save_all_prompts_to_index(&prompts, app_handle)?;
    
    Ok(())
}

/// 获取Prompt存储目录
fn get_prompts_directory(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    Ok(app_data_dir.join("prompts"))
}

/// 保存Prompt到索引
fn save_prompt_to_index(prompt: &Prompt, app_handle: &AppHandle) -> Result<(), String> {
    let prompts_dir = get_prompts_directory(app_handle)?;
    let index_file = prompts_dir.join("prompts_index.json");
    
    let mut prompts = if index_file.exists() {
        let content = std::fs::read_to_string(&index_file).map_err(|e| {
            format!("读取Prompt索引失败: {}", e)
        })?;
        serde_json::from_str::<Vec<Prompt>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    // 更新或添加Prompt
    if let Some(existing) = prompts.iter_mut().find(|p| p.id == prompt.id) {
        *existing = prompt.clone();
    } else {
        prompts.push(prompt.clone());
    }
    
    save_all_prompts_to_index(&prompts, app_handle)
}

/// 保存所有Prompt到索引
fn save_all_prompts_to_index(prompts: &[Prompt], app_handle: &AppHandle) -> Result<(), String> {
    let prompts_dir = get_prompts_directory(app_handle)?;
    std::fs::create_dir_all(&prompts_dir).map_err(|e| {
        format!("创建Prompt目录失败: {}", e)
    })?;
    
    let index_file = prompts_dir.join("prompts_index.json");
    
    let content = serde_json::to_string_pretty(prompts).map_err(|e| {
        format!("序列化Prompt索引失败: {}", e)
    })?;
    
    std::fs::write(&index_file, content).map_err(|e| {
        format!("写入Prompt索引失败: {}", e)
    })?;
    
    Ok(())
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
        description: "应用Prompt".to_string(),
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


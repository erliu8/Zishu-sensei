//! # 角色模板管理命令模块
//! 
//! 提供角色模板的创建、管理和适配器自动注册功能
//! - 本地LLM + prompt → 自动注册为智能硬适配器
//! - API + prompt → 自动注册为软适配器

use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use reqwest::Client;

use crate::commands::*;

// ================================
// 数据类型定义
// ================================

/// 角色模板注册请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterTemplateRegisterRequest {
    /// 模板ID
    pub id: String,
    /// 模板名称
    pub name: String,
    /// Prompt内容
    pub prompt: String,
    /// LLM配置
    pub llm_config: LLMConfigData,
}

/// LLM配置数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LLMConfigData {
    #[serde(rename = "local", rename_all = "camelCase")]
    Local {
        model_id: String,
        model_name: String,
        model_path: String,
        #[serde(default)]
        params: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "api", rename_all = "camelCase")]
    Api {
        provider: String,
        api_endpoint: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        api_key: Option<String>,
        model_name: String,
        #[serde(default)]
        params: HashMap<String, serde_json::Value>,
    },
}

/// 适配器注册响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistrationResponse {
    /// 适配器ID
    pub adapter_id: String,
    /// 适配器类型 (hard 或 soft)
    pub adapter_type: String,
    /// 注册消息
    pub message: String,
}

/// 角色模板数据（用于存储）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterTemplateData {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub live2d_model_id: String,
    pub prompt: PromptData,
    pub llm_config: LLMConfigData,
    #[serde(flatten)]
    pub metadata: Option<TemplateMetadata>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 模板元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateMetadata {
    pub adapter_id: Option<String>,
    pub adapter_type: Option<String>,
    pub is_adapter_registered: Option<bool>,
    pub adapter_error: Option<String>,
}

/// Prompt数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptData {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
    pub description: Option<String>,
}

// ================================
// 命令处理器
// ================================

/// 注册角色模板的适配器
/// 根据LLM配置自动识别并注册为硬适配器或软适配器
#[tauri::command]
pub async fn register_character_adapter(
    template: CharacterTemplateRegisterRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<AdapterRegistrationResponse>, String> {
    info!("注册角色模板适配器: {} ({})", template.name, template.id);
    
    match register_adapter_internal(&template, &app_handle).await {
        Ok(response) => {
            info!("适配器注册成功: {} - {}", response.adapter_id, response.adapter_type);
            Ok(CommandResponse::success_with_message(
                response.clone(),
                response.message,
            ))
        }
        Err(e) => {
            error!("注册适配器失败: {}", e);
            Ok(CommandResponse::error(format!("注册适配器失败: {}", e)))
        }
    }
}

/// 获取所有角色模板
#[tauri::command]
pub async fn get_character_templates(
    app_handle: AppHandle,
) -> Result<CommandResponse<Vec<CharacterTemplateData>>, String> {
    info!("获取角色模板列表");
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.character_template_registry.get_all_templates().await {
        Ok(db_templates) => {
            let templates: Vec<CharacterTemplateData> = db_templates.into_iter().map(|t| {
                let metadata = if t.adapter_id.is_some() || t.adapter_type.is_some() {
                    Some(TemplateMetadata {
                        adapter_id: t.adapter_id.clone(),
                        adapter_type: t.adapter_type.clone(),
                        is_adapter_registered: Some(t.adapter_id.is_some()),
                        adapter_error: None,
                    })
                } else {
                    None
                };
                
                CharacterTemplateData {
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    live2d_model_id: t.live2d_model_id,
                    prompt: PromptData {
                        id: t.prompt_id.clone(),
                        name: t.prompt_name,
                        system_prompt: t.prompt_content,
                        description: None,
                    },
                    llm_config: serde_json::from_str(&t.llm_config_data).unwrap_or_else(|_| {
                        if t.llm_config_type == "local" {
                            LLMConfigData::Local {
                                model_id: String::new(),
                                model_name: String::new(),
                                model_path: String::new(),
                                params: HashMap::new(),
                            }
                        } else {
                            LLMConfigData::Api {
                                provider: String::new(),
                                api_endpoint: String::new(),
                                api_key: None,
                                model_name: String::new(),
                                params: HashMap::new(),
                            }
                        }
                    }),
                    metadata,
                    created_at: t.created_at,
                    updated_at: t.updated_at,
                }
            }).collect();
            
            info!("成功获取 {} 个角色模板", templates.len());
            Ok(CommandResponse::success(templates))
        }
        Err(e) => {
            error!("获取角色模板列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取模板列表失败: {}", e)))
        }
    }
}

/// 保存角色模板
#[tauri::command]
pub async fn save_character_template(
    template: CharacterTemplateData,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("保存角色模板: {}", template.name);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    let llm_config_type = match &template.llm_config {
        LLMConfigData::Local { .. } => "local",
        LLMConfigData::Api { .. } => "api",
    };
    
    let llm_config_data = serde_json::to_string(&template.llm_config)
        .map_err(|e| format!("序列化LLM配置失败: {}", e))?;
    
    let (adapter_id, adapter_type) = if let Some(ref metadata) = template.metadata {
        (metadata.adapter_id.clone(), metadata.adapter_type.clone())
    } else {
        (None, None)
    };
    
    let db_template = crate::database::character_template_registry::CharacterTemplateData {
        id: template.id.clone(),
        name: template.name.clone(),
        description: template.description.clone(),
        live2d_model_id: template.live2d_model_id.clone(),
        prompt_id: template.prompt.id.clone(),
        prompt_name: template.prompt.name.clone(),
        prompt_content: template.prompt.system_prompt.clone(),
        llm_config_type: llm_config_type.to_string(),
        llm_config_data,
        adapter_id,
        adapter_type,
        created_at: template.created_at,
        updated_at: template.updated_at,
    };
    
    match db.character_template_registry.create_template(db_template).await {
        Ok(_) => {
            info!("模板保存成功: {}", template.id);
            Ok(CommandResponse::success_with_message(
                true,
                "模板保存成功".to_string(),
            ))
        }
        Err(e) => {
            error!("保存模板失败: {}", e);
            Ok(CommandResponse::error(format!("保存模板失败: {}", e)))
        }
    }
}

/// 更新角色模板
#[tauri::command]
pub async fn update_character_template(
    template_id: String,
    template: CharacterTemplateData,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("更新角色模板: {} -> {}", template_id, template.name);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    let llm_config_type = match &template.llm_config {
        LLMConfigData::Local { .. } => "local",
        LLMConfigData::Api { .. } => "api",
    };
    
    let llm_config_data = serde_json::to_string(&template.llm_config)
        .map_err(|e| format!("序列化LLM配置失败: {}", e))?;
    
    let (adapter_id, adapter_type) = if let Some(ref metadata) = template.metadata {
        (metadata.adapter_id.clone(), metadata.adapter_type.clone())
    } else {
        (None, None)
    };
    
    let db_template = crate::database::character_template_registry::CharacterTemplateData {
        id: template_id.clone(),
        name: template.name.clone(),
        description: template.description.clone(),
        live2d_model_id: template.live2d_model_id.clone(),
        prompt_id: template.prompt.id.clone(),
        prompt_name: template.prompt.name.clone(),
        prompt_content: template.prompt.system_prompt.clone(),
        llm_config_type: llm_config_type.to_string(),
        llm_config_data,
        adapter_id,
        adapter_type,
        created_at: template.created_at,
        updated_at: chrono::Utc::now().timestamp(),
    };
    
    match db.character_template_registry.update_template(&template_id, db_template).await {
        Ok(_) => {
            info!("模板更新成功: {}", template_id);
            Ok(CommandResponse::success_with_message(
                true,
                "模板更新成功".to_string(),
            ))
        }
        Err(e) => {
            error!("更新模板失败: {}", e);
            Ok(CommandResponse::error(format!("更新模板失败: {}", e)))
        }
    }
}

/// 删除角色模板
#[tauri::command]
pub async fn delete_character_template(
    template_id: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("删除角色模板: {}", template_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.character_template_registry.delete_template(&template_id).await {
        Ok(_) => {
            info!("模板删除成功: {}", template_id);
            Ok(CommandResponse::success_with_message(
                true,
                "模板删除成功".to_string(),
            ))
        }
        Err(e) => {
            error!("删除模板失败: {}", e);
            Ok(CommandResponse::error(format!("删除模板失败: {}", e)))
        }
    }
}

// ================================
// 内部实现函数
// ================================

/// 内部注册适配器逻辑
async fn register_adapter_internal(
    template: &CharacterTemplateRegisterRequest,
    _app_handle: &AppHandle,
) -> Result<AdapterRegistrationResponse, String> {
    // 获取后端URL
    let backend_url = get_backend_url();
    
    // 根据LLM配置类型决定注册哪种适配器
    let (adapter_type, api_endpoint) = match &template.llm_config {
        LLMConfigData::Local { .. } => {
            // 本地LLM → 智能硬适配器
            ("hard", format!("{}/api/v1/adapters/register-hard", backend_url))
        }
        LLMConfigData::Api { .. } => {
            // API调用 → 软适配器
            ("soft", format!("{}/api/v1/adapters/register-soft", backend_url))
        }
    };
    
    info!("注册{}适配器: {} -> {}", adapter_type, template.name, api_endpoint);
    
    // 创建HTTP客户端
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    // 构建请求体
    let request_body = serde_json::json!({
        "template_id": template.id,
        "name": template.name,
        "prompt": template.prompt,
        "llm_config": template.llm_config,
        "adapter_type": adapter_type,
    });
    
    info!("发送注册请求: {}", serde_json::to_string_pretty(&request_body).unwrap_or_default());
    
    // 发送注册请求
    let response = client
        .post(&api_endpoint)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求后端API失败: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        return Err(format!("后端API返回错误 (status: {}): {}", status, error_text));
    }
    
    let api_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析后端响应失败: {}", e))?;
    
    // 提取适配器ID
    let adapter_id = api_response
        .get("adapter_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "后端响应中缺少adapter_id".to_string())?
        .to_string();
    
    Ok(AdapterRegistrationResponse {
        adapter_id,
        adapter_type: adapter_type.to_string(),
        message: format!("角色模板 '{}' 已成功注册为{}适配器", template.name, adapter_type),
    })
}

/// 获取后端URL
fn get_backend_url() -> String {
    std::env::var("ZISHU_BACKEND_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8000".to_string())
        .replace("localhost", "127.0.0.1")
}

/// 从存储中获取所有模板
async fn get_templates_from_storage(app_handle: &AppHandle) -> Result<Vec<CharacterTemplateData>, String> {
    let templates_dir = get_templates_directory(app_handle)?;
    
    if !templates_dir.exists() {
        std::fs::create_dir_all(&templates_dir).map_err(|e| {
            format!("创建模板目录失败: {}", e)
        })?;
        return Ok(vec![]);
    }
    
    let index_file = templates_dir.join("templates_index.json");
    if !index_file.exists() {
        return Ok(vec![]);
    }
    
    let content = std::fs::read_to_string(&index_file).map_err(|e| {
        format!("读取模板索引失败: {}", e)
    })?;
    
    let templates: Vec<CharacterTemplateData> = serde_json::from_str(&content).map_err(|e| {
        format!("解析模板索引失败: {}", e)
    })?;
    
    Ok(templates)
}

/// 保存模板到存储
async fn save_template_to_storage(
    template: &CharacterTemplateData,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let templates_dir = get_templates_directory(app_handle)?;
    std::fs::create_dir_all(&templates_dir).map_err(|e| {
        format!("创建模板目录失败: {}", e)
    })?;
    
    let index_file = templates_dir.join("templates_index.json");
    
    let mut templates = if index_file.exists() {
        let content = std::fs::read_to_string(&index_file).map_err(|e| {
            format!("读取模板索引失败: {}", e)
        })?;
        serde_json::from_str::<Vec<CharacterTemplateData>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    // 更新或添加模板
    if let Some(existing) = templates.iter_mut().find(|t| t.id == template.id) {
        *existing = template.clone();
    } else {
        templates.push(template.clone());
    }
    
    let content = serde_json::to_string_pretty(&templates).map_err(|e| {
        format!("序列化模板索引失败: {}", e)
    })?;
    
    std::fs::write(&index_file, content).map_err(|e| {
        format!("写入模板索引失败: {}", e)
    })?;
    
    Ok(())
}

/// 从存储中删除模板
async fn delete_template_from_storage(
    template_id: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let templates_dir = get_templates_directory(app_handle)?;
    let index_file = templates_dir.join("templates_index.json");
    
    if !index_file.exists() {
        return Ok(());
    }
    
    let content = std::fs::read_to_string(&index_file).map_err(|e| {
        format!("读取模板索引失败: {}", e)
    })?;
    
    let mut templates: Vec<CharacterTemplateData> = serde_json::from_str(&content).map_err(|e| {
        format!("解析模板索引失败: {}", e)
    })?;
    
    templates.retain(|t| t.id != template_id);
    
    let content = serde_json::to_string_pretty(&templates).map_err(|e| {
        format!("序列化模板索引失败: {}", e)
    })?;
    
    std::fs::write(&index_file, content).map_err(|e| {
        format!("写入模板索引失败: {}", e)
    })?;
    
    Ok(())
}

/// 获取模板存储目录
fn get_templates_directory(app_handle: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    Ok(app_data_dir.join("character_templates"))
}

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert("register_character_adapter".to_string(), CommandMetadata {
        name: "register_character_adapter".to_string(),
        description: "注册角色模板的适配器（自动识别类型）".to_string(),
        input_type: Some("CharacterTemplateRegisterRequest".to_string()),
        output_type: Some("AdapterRegistrationResponse".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "character_template".to_string(),
    });
    
    metadata.insert("get_character_templates".to_string(), CommandMetadata {
        name: "get_character_templates".to_string(),
        description: "获取所有角色模板".to_string(),
        input_type: None,
        output_type: Some("Vec<CharacterTemplateData>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "character_template".to_string(),
    });
    
    metadata.insert("save_character_template".to_string(), CommandMetadata {
        name: "save_character_template".to_string(),
        description: "保存角色模板".to_string(),
        input_type: Some("CharacterTemplateData".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "character_template".to_string(),
    });
    
    metadata.insert("update_character_template".to_string(), CommandMetadata {
        name: "update_character_template".to_string(),
        description: "更新角色模板".to_string(),
        input_type: Some("CharacterTemplateData".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "character_template".to_string(),
    });
    
    metadata.insert("delete_character_template".to_string(), CommandMetadata {
        name: "delete_character_template".to_string(),
        description: "删除角色模板".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "character_template".to_string(),
    });
    
    metadata
}

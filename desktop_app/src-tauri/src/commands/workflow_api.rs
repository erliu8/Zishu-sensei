//! 工作流 API 命令
//! 通过 HTTP 调用 Python 后端服务

use crate::http::workflow_client::{
    CreateWorkflowRequest, ExecuteWorkflowRequest, UpdateWorkflowRequest,
    WorkflowApiClient, WorkflowExecutionResponse, WorkflowResponse,
};
use crate::state::AppState;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tauri::State;
use tracing::{debug, error, info};

/// 获取工作流 API 客户端
fn get_workflow_client(state: &AppState) -> Result<WorkflowApiClient, String> {
    // 从配置或环境变量读取 API 地址，工作流使用核心服务
    let api_url = std::env::var("ZISHU_API_URL")
        .unwrap_or_else(|_| {
            let router = crate::config::ApiRouter::new();
            router.core_url()
        });
    
    let mut client = WorkflowApiClient::new(api_url)
        .map_err(|e| format!("创建 API 客户端失败: {}", e))?;
    
    // TODO: 从状态中获取认证令牌
    // client.set_auth_token(state.auth_token.clone());
    
    Ok(client)
}

// ================================
// 工作流 CRUD 操作
// ================================

/// 创建工作流（通过 Python API）
#[tauri::command]
pub async fn api_create_workflow(
    state: State<'_, AppState>,
    name: String,
    slug: String,
    description: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    definition: JsonValue,
    trigger_type: String,
    trigger_config: Option<JsonValue>,
) -> Result<WorkflowResponse, String> {
    info!("API: 创建工作流 - {}", name);
    
    let client = get_workflow_client(&state)?;
    
    let request = CreateWorkflowRequest {
        name,
        slug,
        description,
        category,
        tags,
        definition,
        trigger_type,
        trigger_config,
    };
    
    client
        .create_workflow(request)
        .await
        .map_err(|e| format!("创建工作流失败: {}", e))
}

/// 获取工作流列表（通过 Python API）
#[tauri::command]
pub async fn api_list_workflows(
    state: State<'_, AppState>,
    skip: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<WorkflowResponse>, String> {
    debug!("API: 获取工作流列表");
    
    let client = get_workflow_client(&state)?;
    
    client
        .list_workflows(skip.unwrap_or(0), limit.unwrap_or(20))
        .await
        .map_err(|e| format!("获取工作流列表失败: {}", e))
}

/// 获取工作流详情（通过 Python API）
#[tauri::command]
pub async fn api_get_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowResponse, String> {
    debug!("API: 获取工作流详情 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| format!("获取工作流详情失败: {}", e))
}

/// 更新工作流（通过 Python API）
#[tauri::command]
pub async fn api_update_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    definition: Option<JsonValue>,
    trigger_type: Option<String>,
    trigger_config: Option<JsonValue>,
) -> Result<WorkflowResponse, String> {
    info!("API: 更新工作流 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    let request = UpdateWorkflowRequest {
        name,
        description,
        category,
        tags,
        definition,
        trigger_type,
        trigger_config,
    };
    
    client
        .update_workflow(&workflow_id, request)
        .await
        .map_err(|e| format!("更新工作流失败: {}", e))
}

/// 删除工作流（通过 Python API）
#[tauri::command]
pub async fn api_delete_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    info!("API: 删除工作流 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .delete_workflow(&workflow_id)
        .await
        .map_err(|e| format!("删除工作流失败: {}", e))
}

// ================================
// 工作流执行
// ================================

/// 执行工作流（通过 Python API）
#[tauri::command]
pub async fn api_execute_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    input_data: Option<HashMap<String, JsonValue>>,
    execution_mode: Option<String>,
) -> Result<WorkflowExecutionResponse, String> {
    info!("API: 执行工作流 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    let request = ExecuteWorkflowRequest {
        input_data,
        execution_mode: execution_mode.unwrap_or_else(|| "manual".to_string()),
    };
    
    client
        .execute_workflow(&workflow_id, request)
        .await
        .map_err(|e| format!("执行工作流失败: {}", e))
}

/// 获取工作流执行历史（通过 Python API）
#[tauri::command]
pub async fn api_list_executions(
    state: State<'_, AppState>,
    workflow_id: String,
    skip: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<WorkflowExecutionResponse>, String> {
    debug!("API: 获取执行历史 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .list_executions(&workflow_id, skip.unwrap_or(0), limit.unwrap_or(20))
        .await
        .map_err(|e| format!("获取执行历史失败: {}", e))
}

/// 获取执行详情（通过 Python API）
#[tauri::command]
pub async fn api_get_execution(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<WorkflowExecutionResponse, String> {
    debug!("API: 获取执行详情 - {}", execution_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .get_execution(&execution_id)
        .await
        .map_err(|e| format!("获取执行详情失败: {}", e))
}

/// 取消执行（通过 Python API）
#[tauri::command]
pub async fn api_cancel_execution(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<WorkflowExecutionResponse, String> {
    info!("API: 取消执行 - {}", execution_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .cancel_execution(&execution_id)
        .await
        .map_err(|e| format!("取消执行失败: {}", e))
}

// ================================
// 工作流状态管理
// ================================

/// 发布工作流（通过 Python API）
#[tauri::command]
pub async fn api_publish_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowResponse, String> {
    info!("API: 发布工作流 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .publish_workflow(&workflow_id)
        .await
        .map_err(|e| format!("发布工作流失败: {}", e))
}

/// 归档工作流（通过 Python API）
#[tauri::command]
pub async fn api_archive_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowResponse, String> {
    info!("API: 归档工作流 - {}", workflow_id);
    
    let client = get_workflow_client(&state)?;
    
    client
        .archive_workflow(&workflow_id)
        .await
        .map_err(|e| format!("归档工作流失败: {}", e))
}

/// 克隆工作流（通过 Python API）
#[tauri::command]
pub async fn api_clone_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    new_name: String,
) -> Result<WorkflowResponse, String> {
    info!("API: 克隆工作流 - {} -> {}", workflow_id, new_name);
    
    let client = get_workflow_client(&state)?;
    
    client
        .clone_workflow(&workflow_id, &new_name)
        .await
        .map_err(|e| format!("克隆工作流失败: {}", e))
}

// ================================
// 工作流搜索
// ================================

/// 搜索工作流（通过 Python API）
#[tauri::command]
pub async fn api_search_workflows(
    state: State<'_, AppState>,
    keyword: Option<String>,
    status: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Vec<WorkflowResponse>, String> {
    debug!("API: 搜索工作流 - keyword: {:?}", keyword);
    
    let client = get_workflow_client(&state)?;
    
    client
        .search_workflows(
            keyword.as_deref(),
            status.as_deref(),
            category.as_deref(),
            tags,
        )
        .await
        .map_err(|e| format!("搜索工作流失败: {}", e))
}

// ================================
// 工作流模板
// ================================

/// 获取模板列表（通过 Python API）
#[tauri::command]
pub async fn api_list_templates(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<WorkflowResponse>, String> {
    debug!("API: 获取模板列表");
    
    let client = get_workflow_client(&state)?;
    
    client
        .list_templates(limit.unwrap_or(20))
        .await
        .map_err(|e| format!("获取模板列表失败: {}", e))
}

/// 从模板创建工作流（通过 Python API）
#[tauri::command]
pub async fn api_create_from_template(
    state: State<'_, AppState>,
    template_id: String,
    name: String,
    parameters: Option<HashMap<String, JsonValue>>,
) -> Result<WorkflowResponse, String> {
    info!("API: 从模板创建工作流 - {} -> {}", template_id, name);
    
    let client = get_workflow_client(&state)?;
    
    client
        .create_from_template(&template_id, &name, parameters)
        .await
        .map_err(|e| format!("从模板创建工作流失败: {}", e))
}

// ================================
// 健康检查
// ================================

/// 检查 Python API 服务健康状态
#[tauri::command]
pub async fn api_health_check(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    debug!("API: 健康检查");
    
    let client = get_workflow_client(&state)?;
    
    client
        .health_check()
        .await
        .map_err(|e| format!("健康检查失败: {}", e))
}

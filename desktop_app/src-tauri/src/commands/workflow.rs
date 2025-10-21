use crate::commands::{CommandMetadata, PermissionLevel};
use crate::state::AppState;
use crate::workflow::{
    Workflow, WorkflowExecution, ScheduledWorkflowInfo, WorkflowTemplate, 
    WorkflowVersion, WorkflowExport, ImportResult, WorkflowStatus,
    EventTrigger, EventType, WebhookConfig, WebhookRequest, WebhookResponse,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tauri::State;

/// Create a new workflow
#[tauri::command]
pub async fn create_workflow(
    state: State<'_, AppState>,
    workflow: Workflow,
) -> Result<String, String> {
    state.workflow_registry
        .create_workflow(workflow)
        .await
        .map_err(|e| e.to_string())
}

/// Update a workflow
#[tauri::command]
pub async fn update_workflow(
    state: State<'_, AppState>,
    workflow: Workflow,
) -> Result<(), String> {
    state.workflow_registry
        .update_workflow(workflow)
        .await
        .map_err(|e| e.to_string())
}

/// Delete a workflow
#[tauri::command]
pub async fn delete_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    state.workflow_registry
        .delete_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get a workflow by ID
#[tauri::command]
pub async fn get_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<Workflow, String> {
    state.workflow_registry
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// List all workflows
#[tauri::command]
pub async fn list_workflows(
    state: State<'_, AppState>,
) -> Result<Vec<Workflow>, String> {
    state.workflow_registry
        .list_workflows()
        .await
        .map_err(|e| e.to_string())
}

/// Execute a workflow
#[tauri::command]
pub async fn execute_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    variables: HashMap<String, JsonValue>,
) -> Result<String, String> {
    let workflow = state.workflow_registry
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())?;

    state.workflow_engine
        .execute_workflow(workflow, variables)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel a workflow execution
#[tauri::command]
pub async fn cancel_workflow_execution(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<(), String> {
    state.workflow_engine
        .cancel_execution(&execution_id)
        .await
        .map_err(|e| e.to_string())
}

/// Pause a workflow execution
#[tauri::command]
pub async fn pause_workflow_execution(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<(), String> {
    state.workflow_engine
        .pause_execution(&execution_id)
        .await
        .map_err(|e| e.to_string())
}

/// Resume a workflow execution
#[tauri::command]
pub async fn resume_workflow_execution(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<(), String> {
    state.workflow_engine
        .resume_execution(&execution_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get workflow execution status
#[tauri::command]
pub async fn get_workflow_execution_status(
    state: State<'_, AppState>,
    execution_id: String,
) -> Result<WorkflowExecution, String> {
    state.workflow_engine
        .get_execution_status(&execution_id)
        .await
        .map_err(|e| e.to_string())
}

/// List all workflow executions
#[tauri::command]
pub async fn list_workflow_executions(
    state: State<'_, AppState>,
) -> Result<Vec<WorkflowExecution>, String> {
    Ok(state.workflow_engine.list_executions().await)
}

/// Schedule a workflow
#[tauri::command]
pub async fn schedule_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    let workflow = state.workflow_registry
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())?;

    state.workflow_scheduler
        .schedule_workflow(workflow)
        .await
        .map_err(|e| e.to_string())
}

/// Unschedule a workflow
#[tauri::command]
pub async fn unschedule_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    state.workflow_scheduler
        .unschedule_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// List scheduled workflows
#[tauri::command]
pub async fn list_scheduled_workflows(
    state: State<'_, AppState>,
) -> Result<Vec<ScheduledWorkflowInfo>, String> {
    Ok(state.workflow_scheduler.list_scheduled().await)
}

/// Start the workflow scheduler
#[tauri::command]
pub async fn start_workflow_scheduler(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.workflow_scheduler
        .start()
        .await
        .map_err(|e| e.to_string())
}

/// Stop the workflow scheduler
#[tauri::command]
pub async fn stop_workflow_scheduler(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.workflow_scheduler
        .stop()
        .await
        .map_err(|e| e.to_string())
}

/// Get workflow scheduler status
#[tauri::command]
pub async fn get_workflow_scheduler_status(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.workflow_scheduler.is_running().await)
}

// ================================
// 工作流模板管理
// ================================

/// Create a workflow template
#[tauri::command]
pub async fn create_workflow_template(
    state: State<'_, AppState>,
    template: WorkflowTemplate,
) -> Result<String, String> {
    state.workflow_registry
        .create_template(template)
        .await
        .map_err(|e| e.to_string())
}

/// Update a workflow template
#[tauri::command]
pub async fn update_workflow_template(
    state: State<'_, AppState>,
    template: WorkflowTemplate,
) -> Result<(), String> {
    state.workflow_registry
        .update_template(template)
        .await
        .map_err(|e| e.to_string())
}

/// Delete a workflow template
#[tauri::command]
pub async fn delete_workflow_template(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<(), String> {
    state.workflow_registry
        .delete_template(&template_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get a workflow template
#[tauri::command]
pub async fn get_workflow_template(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<WorkflowTemplate, String> {
    state.workflow_registry
        .get_template(&template_id)
        .await
        .map_err(|e| e.to_string())
}

/// List all workflow templates
#[tauri::command]
pub async fn list_workflow_templates(
    state: State<'_, AppState>,
) -> Result<Vec<WorkflowTemplate>, String> {
    state.workflow_registry
        .list_templates()
        .await
        .map_err(|e| e.to_string())
}

/// Create workflow from template
#[tauri::command]
pub async fn create_workflow_from_template(
    state: State<'_, AppState>,
    template_id: String,
    name: String,
    parameters: HashMap<String, JsonValue>,
) -> Result<String, String> {
    state.workflow_registry
        .create_from_template(&template_id, name, parameters)
        .await
        .map_err(|e| e.to_string())
}

/// Get all builtin workflow templates
#[tauri::command]
pub async fn get_builtin_templates() -> Result<Vec<WorkflowTemplate>, String> {
    use crate::workflow::BuiltinTemplates;
    Ok(BuiltinTemplates::get_all())
}

/// Get a specific builtin template by ID
#[tauri::command]
pub async fn get_builtin_template(template_id: String) -> Result<WorkflowTemplate, String> {
    use crate::workflow::BuiltinTemplates;
    BuiltinTemplates::get_by_id(&template_id)
        .ok_or_else(|| format!("内置模板不存在: {}", template_id))
}

// ================================
// 工作流版本控制
// ================================

/// Get workflow version history
#[tauri::command]
pub async fn get_workflow_versions(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<Vec<WorkflowVersion>, String> {
    state.workflow_registry
        .get_workflow_versions(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get a specific workflow version
#[tauri::command]
pub async fn get_workflow_version(
    state: State<'_, AppState>,
    workflow_id: String,
    version: String,
) -> Result<Workflow, String> {
    state.workflow_registry
        .get_workflow_version(&workflow_id, &version)
        .await
        .map_err(|e| e.to_string())
}

/// Rollback workflow to a specific version
#[tauri::command]
pub async fn rollback_workflow_to_version(
    state: State<'_, AppState>,
    workflow_id: String,
    version: String,
) -> Result<(), String> {
    state.workflow_registry
        .rollback_to_version(&workflow_id, &version)
        .await
        .map_err(|e| e.to_string())
}

// ================================
// 工作流导入/导出
// ================================

/// Export workflows
#[tauri::command]
pub async fn export_workflows(
    state: State<'_, AppState>,
    workflow_ids: Vec<String>,
    include_templates: bool,
) -> Result<WorkflowExport, String> {
    state.workflow_registry
        .export_workflows(workflow_ids, include_templates)
        .await
        .map_err(|e| e.to_string())
}

/// Export all workflows
#[tauri::command]
pub async fn export_all_workflows(
    state: State<'_, AppState>,
    include_templates: bool,
) -> Result<WorkflowExport, String> {
    state.workflow_registry
        .export_all(include_templates)
        .await
        .map_err(|e| e.to_string())
}

/// Import workflows
#[tauri::command]
pub async fn import_workflows(
    state: State<'_, AppState>,
    export_data: WorkflowExport,
    overwrite: bool,
) -> Result<ImportResult, String> {
    state.workflow_registry
        .import_workflows(export_data, overwrite)
        .await
        .map_err(|e| e.to_string())
}

// ================================
// 工作流状态管理
// ================================

/// Publish a workflow
#[tauri::command]
pub async fn publish_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    state.workflow_registry
        .publish_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// Archive a workflow
#[tauri::command]
pub async fn archive_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    state.workflow_registry
        .archive_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// Disable a workflow
#[tauri::command]
pub async fn disable_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    state.workflow_registry
        .disable_workflow(&workflow_id)
        .await
        .map_err(|e| e.to_string())
}

/// Clone a workflow
#[tauri::command]
pub async fn clone_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    new_name: String,
) -> Result<String, String> {
    state.workflow_registry
        .clone_workflow(&workflow_id, new_name)
        .await
        .map_err(|e| e.to_string())
}

/// Search workflows
#[tauri::command]
pub async fn search_workflows(
    state: State<'_, AppState>,
    keyword: Option<String>,
    status: Option<WorkflowStatus>,
    tags: Option<Vec<String>>,
    category: Option<String>,
) -> Result<Vec<Workflow>, String> {
    state.workflow_registry
        .search_workflows(
            keyword.as_deref(),
            status,
            tags,
            category.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Trigger Commands
// ============================================================================

/// Create an event trigger
#[tauri::command]
pub async fn create_event_trigger(
    state: State<'_, AppState>,
    trigger: EventTrigger,
) -> Result<String, String> {
    let trigger_id = trigger.id.clone();
    state.event_trigger_manager
        .register_trigger(trigger)
        .await
        .map_err(|e| e.to_string())?;
    Ok(trigger_id)
}

/// List all event triggers
#[tauri::command]
pub async fn list_event_triggers(
    state: State<'_, AppState>,
    workflow_id: Option<String>,
) -> Result<Vec<EventTrigger>, String> {
    let all_triggers = state.event_trigger_manager.list_triggers().await;
    
    // Filter by workflow_id if provided
    if let Some(wf_id) = workflow_id {
        Ok(all_triggers.into_iter()
            .filter(|t| t.workflow_id == wf_id)
            .collect())
    } else {
        Ok(all_triggers)
    }
}

/// Remove an event trigger
#[tauri::command]
pub async fn remove_event_trigger(
    state: State<'_, AppState>,
    trigger_id: String,
) -> Result<(), String> {
    state.event_trigger_manager
        .unregister_trigger(&trigger_id)
        .await
        .map_err(|e| e.to_string())
}

/// Trigger an event manually
#[tauri::command]
pub async fn trigger_event(
    state: State<'_, AppState>,
    event_type: EventType,
    event_data: JsonValue,
) -> Result<Vec<String>, String> {
    state.event_trigger_manager
        .trigger_event(event_type, event_data)
        .await
        .map_err(|e| e.to_string())
}

/// Create a webhook trigger
#[tauri::command]
pub async fn create_webhook_trigger(
    state: State<'_, AppState>,
    workflow_id: String,
    config: WebhookConfig,
) -> Result<String, String> {
    let webhook_id = config.id.clone();
    state.webhook_trigger_manager
        .register_webhook(config)
        .await
        .map_err(|e| e.to_string())?;
    Ok(webhook_id)
}

/// List webhook triggers
#[tauri::command]
pub async fn list_webhook_triggers(
    state: State<'_, AppState>,
    workflow_id: Option<String>,
) -> Result<Vec<WebhookConfig>, String> {
    let all_webhooks = state.webhook_trigger_manager.list_webhooks().await;
    
    // Filter by workflow_id if provided
    if let Some(wf_id) = workflow_id {
        Ok(all_webhooks.into_iter()
            .filter(|w| w.workflow_id == wf_id)
            .collect())
    } else {
        Ok(all_webhooks)
    }
}

/// Remove a webhook trigger
#[tauri::command]
pub async fn remove_webhook_trigger(
    state: State<'_, AppState>,
    webhook_id: String,
) -> Result<(), String> {
    state.webhook_trigger_manager
        .unregister_webhook(&webhook_id)
        .await
        .map_err(|e| e.to_string())
}

/// Trigger a webhook
#[tauri::command]
pub async fn trigger_webhook(
    state: State<'_, AppState>,
    webhook_id: String,
    request: WebhookRequest,
) -> Result<WebhookResponse, String> {
    state.webhook_trigger_manager
        .handle_webhook(request)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Command Metadata
// ============================================================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();

    metadata.insert(
        "create_workflow".to_string(),
        CommandMetadata {
            name: "create_workflow".to_string(),
            description: "创建工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "update_workflow".to_string(),
        CommandMetadata {
            name: "update_workflow".to_string(),
            description: "更新工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "delete_workflow".to_string(),
        CommandMetadata {
            name: "delete_workflow".to_string(),
            description: "删除工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_workflow".to_string(),
        CommandMetadata {
            name: "get_workflow".to_string(),
            description: "获取工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_workflows".to_string(),
        CommandMetadata {
            name: "list_workflows".to_string(),
            description: "列出所有工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "execute_workflow".to_string(),
        CommandMetadata {
            name: "execute_workflow".to_string(),
            description: "执行工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "cancel_workflow_execution".to_string(),
        CommandMetadata {
            name: "cancel_workflow_execution".to_string(),
            description: "取消工作流执行".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "pause_workflow_execution".to_string(),
        CommandMetadata {
            name: "pause_workflow_execution".to_string(),
            description: "暂停工作流执行".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "resume_workflow_execution".to_string(),
        CommandMetadata {
            name: "resume_workflow_execution".to_string(),
            description: "恢复工作流执行".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_workflow_execution_status".to_string(),
        CommandMetadata {
            name: "get_workflow_execution_status".to_string(),
            description: "获取工作流执行状态".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_workflow_executions".to_string(),
        CommandMetadata {
            name: "list_workflow_executions".to_string(),
            description: "列出所有工作流执行".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "schedule_workflow".to_string(),
        CommandMetadata {
            name: "schedule_workflow".to_string(),
            description: "调度工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "unschedule_workflow".to_string(),
        CommandMetadata {
            name: "unschedule_workflow".to_string(),
            description: "取消工作流调度".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_scheduled_workflows".to_string(),
        CommandMetadata {
            name: "list_scheduled_workflows".to_string(),
            description: "列出已调度的工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "start_workflow_scheduler".to_string(),
        CommandMetadata {
            name: "start_workflow_scheduler".to_string(),
            description: "启动工作流调度器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "stop_workflow_scheduler".to_string(),
        CommandMetadata {
            name: "stop_workflow_scheduler".to_string(),
            description: "停止工作流调度器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_workflow_scheduler_status".to_string(),
        CommandMetadata {
            name: "get_workflow_scheduler_status".to_string(),
            description: "获取工作流调度器状态".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    // 模板管理命令
    metadata.insert(
        "create_workflow_template".to_string(),
        CommandMetadata {
            name: "create_workflow_template".to_string(),
            description: "创建工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "update_workflow_template".to_string(),
        CommandMetadata {
            name: "update_workflow_template".to_string(),
            description: "更新工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "delete_workflow_template".to_string(),
        CommandMetadata {
            name: "delete_workflow_template".to_string(),
            description: "删除工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_workflow_template".to_string(),
        CommandMetadata {
            name: "get_workflow_template".to_string(),
            description: "获取工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_workflow_templates".to_string(),
        CommandMetadata {
            name: "list_workflow_templates".to_string(),
            description: "列出所有工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "create_workflow_from_template".to_string(),
        CommandMetadata {
            name: "create_workflow_from_template".to_string(),
            description: "从模板创建工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_builtin_templates".to_string(),
        CommandMetadata {
            name: "get_builtin_templates".to_string(),
            description: "获取所有内置工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_builtin_template".to_string(),
        CommandMetadata {
            name: "get_builtin_template".to_string(),
            description: "获取指定的内置工作流模板".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    // 版本控制命令
    metadata.insert(
        "get_workflow_versions".to_string(),
        CommandMetadata {
            name: "get_workflow_versions".to_string(),
            description: "获取工作流版本历史".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "get_workflow_version".to_string(),
        CommandMetadata {
            name: "get_workflow_version".to_string(),
            description: "获取指定版本的工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "rollback_workflow_to_version".to_string(),
        CommandMetadata {
            name: "rollback_workflow_to_version".to_string(),
            description: "回滚工作流到指定版本".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    // 导入/导出命令
    metadata.insert(
        "export_workflows".to_string(),
        CommandMetadata {
            name: "export_workflows".to_string(),
            description: "导出工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "export_all_workflows".to_string(),
        CommandMetadata {
            name: "export_all_workflows".to_string(),
            description: "导出所有工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "import_workflows".to_string(),
        CommandMetadata {
            name: "import_workflows".to_string(),
            description: "导入工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    // 状态管理命令
    metadata.insert(
        "publish_workflow".to_string(),
        CommandMetadata {
            name: "publish_workflow".to_string(),
            description: "发布工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "archive_workflow".to_string(),
        CommandMetadata {
            name: "archive_workflow".to_string(),
            description: "归档工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "disable_workflow".to_string(),
        CommandMetadata {
            name: "disable_workflow".to_string(),
            description: "禁用工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "clone_workflow".to_string(),
        CommandMetadata {
            name: "clone_workflow".to_string(),
            description: "克隆工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "search_workflows".to_string(),
        CommandMetadata {
            name: "search_workflows".to_string(),
            description: "搜索工作流".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    // Trigger commands
    metadata.insert(
        "create_event_trigger".to_string(),
        CommandMetadata {
            name: "create_event_trigger".to_string(),
            description: "创建事件触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_event_triggers".to_string(),
        CommandMetadata {
            name: "list_event_triggers".to_string(),
            description: "列出事件触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "remove_event_trigger".to_string(),
        CommandMetadata {
            name: "remove_event_trigger".to_string(),
            description: "移除事件触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "trigger_event".to_string(),
        CommandMetadata {
            name: "trigger_event".to_string(),
            description: "触发事件".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "create_webhook_trigger".to_string(),
        CommandMetadata {
            name: "create_webhook_trigger".to_string(),
            description: "创建Webhook触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "list_webhook_triggers".to_string(),
        CommandMetadata {
            name: "list_webhook_triggers".to_string(),
            description: "列出Webhook触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "remove_webhook_trigger".to_string(),
        CommandMetadata {
            name: "remove_webhook_trigger".to_string(),
            description: "移除Webhook触发器".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata.insert(
        "trigger_webhook".to_string(),
        CommandMetadata {
            name: "trigger_webhook".to_string(),
            description: "触发Webhook".to_string(),
            input_type: None,
            output_type: None,
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "workflow".to_string(),
        },
    );

    metadata
}

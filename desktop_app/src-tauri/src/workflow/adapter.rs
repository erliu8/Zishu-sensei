//! # 工作流模型适配器
//! 
//! 在业务层模型（models.rs）和数据库层模型（database::workflow）之间进行转换

use super::models::*;
use crate::database::workflow::{WorkflowDefinition as DbWorkflowDefinition, WorkflowStatus as DbWorkflowStatus};
use anyhow::{Result, anyhow};
use serde_json::Value as JsonValue;

/// 将业务层 Workflow 转换为数据库层 WorkflowDefinition
pub fn workflow_to_db(workflow: &Workflow) -> Result<DbWorkflowDefinition> {
    let steps_json = serde_json::to_string(&workflow.steps)?;
    let config_json = serde_json::to_string(&workflow.config)?;
    let tags_json = serde_json::to_string(&workflow.tags)?;

    Ok(DbWorkflowDefinition {
        id: workflow.id.clone(),
        name: workflow.name.clone(),
        description: workflow.description.clone(),
        version: workflow.version.clone(),
        steps: steps_json,
        config: config_json,
        status: workflow_status_to_db(workflow.status),
        tags: tags_json,
        category: workflow.category.clone(),
        is_template: workflow.is_template,
        template_id: workflow.template_id.clone(),
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
    })
}

/// 将数据库层 WorkflowDefinition 转换为业务层 Workflow
pub fn db_to_workflow(db_workflow: &DbWorkflowDefinition) -> Result<Workflow> {
    let steps: Vec<WorkflowStep> = serde_json::from_str(&db_workflow.steps)?;
    let config: WorkflowConfig = serde_json::from_str(&db_workflow.config)?;
    let tags: Vec<String> = serde_json::from_str(&db_workflow.tags)?;

    // 解析trigger（如果有的话，可以从config中获取）
    let trigger = None; // TODO: 从配置中提取触发器信息

    Ok(Workflow {
        id: db_workflow.id.clone(),
        name: db_workflow.name.clone(),
        description: db_workflow.description.clone(),
        version: db_workflow.version.clone(),
        status: db_status_to_workflow(db_workflow.status),
        steps,
        config,
        trigger,
        tags,
        category: db_workflow.category.clone(),
        is_template: db_workflow.is_template,
        template_id: db_workflow.template_id.clone(),
        created_at: db_workflow.created_at,
        updated_at: db_workflow.updated_at,
    })
}

/// 将业务层 WorkflowStatus 转换为数据库层
fn workflow_status_to_db(status: WorkflowStatus) -> DbWorkflowStatus {
    match status {
        WorkflowStatus::Draft => DbWorkflowStatus::Draft,
        WorkflowStatus::Published => DbWorkflowStatus::Published,
        WorkflowStatus::Archived => DbWorkflowStatus::Archived,
        WorkflowStatus::Disabled => DbWorkflowStatus::Draft, // 数据库层没有Disabled，映射为Draft
    }
}

/// 将数据库层 WorkflowStatus 转换为业务层
fn db_status_to_workflow(status: DbWorkflowStatus) -> WorkflowStatus {
    match status {
        DbWorkflowStatus::Draft => WorkflowStatus::Draft,
        DbWorkflowStatus::Published => WorkflowStatus::Published,
        DbWorkflowStatus::Archived => WorkflowStatus::Archived,
    }
}


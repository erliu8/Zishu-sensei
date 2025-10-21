//! # Workflow 适配器测试
//!
//! 测试工作流模型在业务层和数据库层之间的转换

use zishu_sensei::workflow::adapter::*;
use zishu_sensei::workflow::models::*;
use std::collections::HashMap;

/// 创建测试用的工作流
fn create_test_workflow() -> Workflow {
    Workflow {
        id: "test-workflow".to_string(),
        name: "测试工作流".to_string(),
        description: Some("测试描述".to_string()),
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![
            WorkflowStep {
                id: "step1".to_string(),
                name: "步骤1".to_string(),
                step_type: "custom".to_string(),
                description: Some("测试步骤".to_string()),
                config: Some(serde_json::json!({"key": "value"})),
                inputs: Some({
                    let mut map = HashMap::new();
                    map.insert("input1".to_string(), serde_json::json!("value1"));
                    map
                }),
                outputs: Some({
                    let mut map = HashMap::new();
                    map.insert("output1".to_string(), "$.result".to_string());
                    map
                }),
                condition: None,
                error_handling: None,
                retry_count: Some(3),
                timeout: Some(30000),
                depends_on: vec![],
                allow_failure: false,
            },
        ],
        config: WorkflowConfig {
            timeout: Some(60000),
            max_concurrent: Some(5),
            error_strategy: ErrorStrategy::Stop,
            retry_config: None,
            notification: None,
            variables: None,
            environment: None,
            custom: None,
        },
        trigger: None,
        tags: vec!["test".to_string(), "automation".to_string()],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 1234567890,
        updated_at: 1234567890,
    }
}

// ================================
// workflow_to_db 转换测试
// ================================

#[test]
fn test_workflow_to_db_converts_successfully() {
    // Arrange
    let workflow = create_test_workflow();
    
    // Act
    let result = workflow_to_db(&workflow);
    
    // Assert
    assert!(result.is_ok());
    let db_workflow = result.unwrap();
    assert_eq!(db_workflow.id, workflow.id);
    assert_eq!(db_workflow.name, workflow.name);
    assert_eq!(db_workflow.description, workflow.description);
    assert_eq!(db_workflow.version, workflow.version);
    assert_eq!(db_workflow.category, workflow.category);
    assert_eq!(db_workflow.is_template, workflow.is_template);
    assert_eq!(db_workflow.created_at, workflow.created_at);
    assert_eq!(db_workflow.updated_at, workflow.updated_at);
}

#[test]
fn test_workflow_to_db_serializes_steps_as_json() {
    // Arrange
    let workflow = create_test_workflow();
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Assert
    assert!(!db_workflow.steps.is_empty());
    
    // 验证JSON格式
    let parsed_steps: Result<Vec<WorkflowStep>, _> = serde_json::from_str(&db_workflow.steps);
    assert!(parsed_steps.is_ok());
    
    let steps = parsed_steps.unwrap();
    assert_eq!(steps.len(), workflow.steps.len());
    assert_eq!(steps[0].id, workflow.steps[0].id);
}

#[test]
fn test_workflow_to_db_serializes_config_as_json() {
    // Arrange
    let workflow = create_test_workflow();
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Assert
    assert!(!db_workflow.config.is_empty());
    
    // 验证JSON格式
    let parsed_config: Result<WorkflowConfig, _> = serde_json::from_str(&db_workflow.config);
    assert!(parsed_config.is_ok());
    
    let config = parsed_config.unwrap();
    assert_eq!(config.timeout, workflow.config.timeout);
    assert_eq!(config.max_concurrent, workflow.config.max_concurrent);
}

#[test]
fn test_workflow_to_db_serializes_tags_as_json() {
    // Arrange
    let workflow = create_test_workflow();
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Assert
    assert!(!db_workflow.tags.is_empty());
    
    // 验证JSON格式
    let parsed_tags: Result<Vec<String>, _> = serde_json::from_str(&db_workflow.tags);
    assert!(parsed_tags.is_ok());
    
    let tags = parsed_tags.unwrap();
    assert_eq!(tags.len(), workflow.tags.len());
    assert_eq!(tags, workflow.tags);
}

// ================================
// db_to_workflow 转换测试
// ================================

#[test]
fn test_db_to_workflow_converts_successfully() {
    // Arrange
    let workflow = create_test_workflow();
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Act
    let result = db_to_workflow(&db_workflow);
    
    // Assert
    assert!(result.is_ok());
    let converted_workflow = result.unwrap();
    assert_eq!(converted_workflow.id, workflow.id);
    assert_eq!(converted_workflow.name, workflow.name);
    assert_eq!(converted_workflow.description, workflow.description);
    assert_eq!(converted_workflow.version, workflow.version);
}

#[test]
fn test_db_to_workflow_deserializes_steps() {
    // Arrange
    let workflow = create_test_workflow();
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Act
    let converted_workflow = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted_workflow.steps.len(), workflow.steps.len());
    assert_eq!(converted_workflow.steps[0].id, workflow.steps[0].id);
    assert_eq!(converted_workflow.steps[0].name, workflow.steps[0].name);
    assert_eq!(converted_workflow.steps[0].step_type, workflow.steps[0].step_type);
}

#[test]
fn test_db_to_workflow_deserializes_config() {
    // Arrange
    let workflow = create_test_workflow();
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Act
    let converted_workflow = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted_workflow.config.timeout, workflow.config.timeout);
    assert_eq!(converted_workflow.config.max_concurrent, workflow.config.max_concurrent);
    assert_eq!(converted_workflow.config.error_strategy, workflow.config.error_strategy);
}

#[test]
fn test_db_to_workflow_deserializes_tags() {
    // Arrange
    let workflow = create_test_workflow();
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Act
    let converted_workflow = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted_workflow.tags, workflow.tags);
}

// ================================
// 往返转换测试
// ================================

#[test]
fn test_roundtrip_conversion_preserves_data() {
    // Arrange
    let original_workflow = create_test_workflow();
    
    // Act
    let db_workflow = workflow_to_db(&original_workflow).unwrap();
    let converted_workflow = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted_workflow.id, original_workflow.id);
    assert_eq!(converted_workflow.name, original_workflow.name);
    assert_eq!(converted_workflow.description, original_workflow.description);
    assert_eq!(converted_workflow.version, original_workflow.version);
    assert_eq!(converted_workflow.category, original_workflow.category);
    assert_eq!(converted_workflow.is_template, original_workflow.is_template);
    assert_eq!(converted_workflow.template_id, original_workflow.template_id);
    assert_eq!(converted_workflow.tags, original_workflow.tags);
    assert_eq!(converted_workflow.steps.len(), original_workflow.steps.len());
    assert_eq!(converted_workflow.config.timeout, original_workflow.config.timeout);
}

// ================================
// 状态转换测试
// ================================

#[test]
fn test_workflow_status_draft_conversion() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.status = WorkflowStatus::Draft;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.status, WorkflowStatus::Draft);
}

#[test]
fn test_workflow_status_published_conversion() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.status = WorkflowStatus::Published;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.status, WorkflowStatus::Published);
}

#[test]
fn test_workflow_status_archived_conversion() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.status = WorkflowStatus::Archived;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.status, WorkflowStatus::Archived);
}

#[test]
fn test_workflow_status_disabled_maps_to_draft() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.status = WorkflowStatus::Disabled;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    
    // Assert
    // Disabled 状态在数据库层映射为 Draft
    assert_eq!(db_workflow.status, zishu_sensei::database::workflow::WorkflowStatus::Draft);
}

// ================================
// 边界情况测试
// ================================

#[test]
fn test_workflow_with_empty_steps_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.steps = vec![];
    
    // Act
    let result = workflow_to_db(&workflow);
    
    // Assert
    assert!(result.is_ok());
    let db_workflow = result.unwrap();
    
    let steps: Vec<WorkflowStep> = serde_json::from_str(&db_workflow.steps).unwrap();
    assert_eq!(steps.len(), 0);
}

#[test]
fn test_workflow_with_no_description_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.description = None;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.description, None);
}

#[test]
fn test_workflow_with_no_template_id_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.template_id = None;
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.template_id, None);
}

#[test]
fn test_workflow_with_empty_tags_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.tags = vec![];
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.tags.len(), 0);
}

// ================================
// 复杂数据测试
// ================================

#[test]
fn test_workflow_with_complex_config_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.config = WorkflowConfig {
        timeout: Some(120000),
        max_concurrent: Some(10),
        error_strategy: ErrorStrategy::Retry,
        retry_config: Some(RetryConfig {
            max_attempts: 5,
            interval: 3000,
            backoff: BackoffStrategy::Exponential,
            retry_on: vec!["network_error".to_string(), "timeout".to_string()],
        }),
        notification: Some(NotificationConfig {
            on_success: true,
            on_failure: true,
            channels: vec!["email".to_string(), "slack".to_string()],
            message_template: Some("工作流 {{name}} 执行完成".to_string()),
        }),
        variables: Some({
            let mut vars = HashMap::new();
            vars.insert("var1".to_string(), VariableDefinition {
                var_type: "string".to_string(),
                default: Some(serde_json::json!("default_value")),
                required: true,
                description: Some("测试变量".to_string()),
            });
            vars
        }),
        environment: Some({
            let mut env = HashMap::new();
            env.insert("ENV_VAR".to_string(), "value".to_string());
            env
        }),
        custom: Some(serde_json::json!({"custom_key": "custom_value"})),
    };
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.config.timeout, Some(120000));
    assert_eq!(converted.config.max_concurrent, Some(10));
    assert_eq!(converted.config.error_strategy, ErrorStrategy::Retry);
    assert!(converted.config.retry_config.is_some());
    assert!(converted.config.notification.is_some());
    assert!(converted.config.variables.is_some());
    assert!(converted.config.environment.is_some());
    assert!(converted.config.custom.is_some());
}

#[test]
fn test_workflow_with_multiple_complex_steps_converts() {
    // Arrange
    let mut workflow = create_test_workflow();
    workflow.steps = vec![
        WorkflowStep {
            id: "step1".to_string(),
            name: "聊天步骤".to_string(),
            step_type: "chat".to_string(),
            description: Some("AI聊天".to_string()),
            config: Some(serde_json::json!({
                "prompt": "Hello",
                "model": "gpt-4",
                "temperature": 0.7
            })),
            inputs: Some({
                let mut map = HashMap::new();
                map.insert("input1".to_string(), serde_json::json!("value1"));
                map
            }),
            outputs: Some({
                let mut map = HashMap::new();
                map.insert("response".to_string(), "$.output".to_string());
                map
            }),
            condition: Some("count > 5".to_string()),
            error_handling: Some("retry".to_string()),
            retry_count: Some(3),
            timeout: Some(30000),
            depends_on: vec![],
            allow_failure: false,
        },
        WorkflowStep {
            id: "step2".to_string(),
            name: "转换步骤".to_string(),
            step_type: "transform".to_string(),
            description: Some("数据转换".to_string()),
            config: Some(serde_json::json!({
                "type": "json",
                "input": "${step1.output}"
            })),
            inputs: None,
            outputs: Some({
                let mut map = HashMap::new();
                map.insert("result".to_string(), "$.transformed".to_string());
                map
            }),
            condition: None,
            error_handling: Some("continue".to_string()),
            retry_count: None,
            timeout: Some(10000),
            depends_on: vec!["step1".to_string()],
            allow_failure: true,
        },
    ];
    
    // Act
    let db_workflow = workflow_to_db(&workflow).unwrap();
    let converted = db_to_workflow(&db_workflow).unwrap();
    
    // Assert
    assert_eq!(converted.steps.len(), 2);
    assert_eq!(converted.steps[0].step_type, "chat");
    assert_eq!(converted.steps[1].step_type, "transform");
    assert!(converted.steps[1].depends_on.contains(&"step1".to_string()));
    assert_eq!(converted.steps[1].allow_failure, true);
}


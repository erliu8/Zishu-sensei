//! # 工作流注册表测试
//!
//! 测试工作流注册表的CRUD操作、版本管理、模板管理等功能

use zishu_sensei::workflow::registry::*;
use zishu_sensei::workflow::models::*;
use zishu_sensei::database::workflow::WorkflowRegistry as DbWorkflowRegistry;
use std::collections::HashMap;
use std::sync::Arc;
use serde_json::json;

// 注意：这些测试需要Mock数据库注册表
// 在实际测试中，应该使用测试数据库或Mock对象

// ================================
// 辅助函数
// ================================

/// 创建测试用的工作流
fn create_test_workflow(id: &str, name: &str) -> Workflow {
    Workflow {
        id: id.to_string(),
        name: name.to_string(),
        description: Some("测试工作流".to_string()),
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![
            WorkflowStep {
                id: "step1".to_string(),
                name: "步骤1".to_string(),
                step_type: "custom".to_string(),
                description: None,
                config: None,
                inputs: None,
                outputs: None,
                condition: None,
                error_handling: None,
                retry_count: None,
                timeout: None,
                depends_on: vec![],
                allow_failure: false,
            },
        ],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec!["test".to_string()],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
    }
}

// ================================
// WorkflowExport 测试
// ================================

#[test]
fn test_workflow_export_creation() {
    // Arrange
    let workflows = vec![
        create_test_workflow("wf1", "工作流1"),
        create_test_workflow("wf2", "工作流2"),
    ];
    let templates = vec![];
    
    // Act
    let export = WorkflowExport::new(workflows.clone(), templates);
    
    // Assert
    assert_eq!(export.format_version, WorkflowExport::CURRENT_VERSION);
    assert!(export.exported_at > 0);
    assert_eq!(export.workflows.len(), 2);
    assert_eq!(export.templates.len(), 0);
}

#[test]
fn test_workflow_export_serialization() {
    // Arrange
    let workflows = vec![create_test_workflow("test", "测试")];
    let export = WorkflowExport::new(workflows, vec![]);
    
    // Act
    let json_str = serde_json::to_string(&export).unwrap();
    let deserialized: WorkflowExport = serde_json::from_str(&json_str).unwrap();
    
    // Assert
    assert_eq!(deserialized.format_version, export.format_version);
    assert_eq!(deserialized.workflows.len(), export.workflows.len());
    assert_eq!(deserialized.workflows[0].id, export.workflows[0].id);
}

#[test]
fn test_workflow_export_with_templates() {
    // Arrange
    let workflows = vec![];
    let templates = vec![
        WorkflowTemplate {
            id: "template1".to_string(),
            name: "模板1".to_string(),
            description: Some("测试模板".to_string()),
            template_type: "test".to_string(),
            workflow: create_test_workflow("wf1", "工作流1"),
            parameters: vec![],
            tags: vec![],
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
        },
    ];
    
    // Act
    let export = WorkflowExport::new(workflows, templates.clone());
    
    // Assert
    assert_eq!(export.templates.len(), 1);
    assert_eq!(export.templates[0].id, templates[0].id);
}

// ================================
// ImportResult 测试
// ================================

#[test]
fn test_import_result_default() {
    // Arrange & Act
    let result = ImportResult::default();
    
    // Assert
    assert_eq!(result.imported_workflows.len(), 0);
    assert_eq!(result.imported_templates.len(), 0);
    assert_eq!(result.success_count, 0);
    assert_eq!(result.error_count, 0);
    assert_eq!(result.errors.len(), 0);
}

#[test]
fn test_import_result_serialization() {
    // Arrange
    let mut result = ImportResult::default();
    result.imported_workflows.push("wf1".to_string());
    result.success_count = 1;
    
    // Act
    let json_str = serde_json::to_string(&result).unwrap();
    let deserialized: ImportResult = serde_json::from_str(&json_str).unwrap();
    
    // Assert
    assert_eq!(deserialized.success_count, result.success_count);
    assert_eq!(deserialized.imported_workflows.len(), result.imported_workflows.len());
}

// ================================
// Workflow 验证测试（已在 models_test.rs 中）
// ================================

#[test]
fn test_workflow_validation_integration() {
    // Arrange
    let workflow = create_test_workflow("test", "测试");
    
    // Act
    let result = workflow.validate();
    
    // Assert
    assert!(result.is_ok());
}

// ================================
// WorkflowTemplate 测试
// ================================

#[test]
fn test_workflow_template_creation() {
    // Arrange & Act
    let template = WorkflowTemplate {
        id: "template-1".to_string(),
        name: "测试模板".to_string(),
        description: Some("这是一个测试模板".to_string()),
        template_type: "automation".to_string(),
        workflow: create_test_workflow("wf-1", "工作流1"),
        parameters: vec![
            TemplateParameter {
                name: "param1".to_string(),
                param_type: "string".to_string(),
                default: Some(json!("default_value")),
                required: true,
                description: Some("参数1".to_string()),
                validation: None,
            },
        ],
        tags: vec!["test".to_string(), "automation".to_string()],
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
    };
    
    // Assert
    assert_eq!(template.id, "template-1");
    assert_eq!(template.name, "测试模板");
    assert_eq!(template.template_type, "automation");
    assert_eq!(template.parameters.len(), 1);
    assert_eq!(template.tags.len(), 2);
}

#[test]
fn test_workflow_template_serialization() {
    // Arrange
    let template = WorkflowTemplate {
        id: "test-template".to_string(),
        name: "测试".to_string(),
        description: None,
        template_type: "test".to_string(),
        workflow: create_test_workflow("wf", "工作流"),
        parameters: vec![],
        tags: vec![],
        created_at: 1000,
        updated_at: 2000,
    };
    
    // Act
    let json_str = serde_json::to_string(&template).unwrap();
    let deserialized: WorkflowTemplate = serde_json::from_str(&json_str).unwrap();
    
    // Assert
    assert_eq!(deserialized.id, template.id);
    assert_eq!(deserialized.name, template.name);
    assert_eq!(deserialized.created_at, template.created_at);
}

// ================================
// TemplateParameter 测试
// ================================

#[test]
fn test_template_parameter_required() {
    // Arrange & Act
    let param = TemplateParameter {
        name: "required_param".to_string(),
        param_type: "string".to_string(),
        default: None,
        required: true,
        description: Some("必需参数".to_string()),
        validation: Some(json!({
            "min_length": 5,
            "max_length": 100
        })),
    };
    
    // Assert
    assert_eq!(param.required, true);
    assert!(param.default.is_none());
    assert!(param.validation.is_some());
}

#[test]
fn test_template_parameter_optional_with_default() {
    // Arrange & Act
    let param = TemplateParameter {
        name: "optional_param".to_string(),
        param_type: "number".to_string(),
        default: Some(json!(42)),
        required: false,
        description: Some("可选参数".to_string()),
        validation: Some(json!({
            "min": 0,
            "max": 100
        })),
    };
    
    // Assert
    assert_eq!(param.required, false);
    assert!(param.default.is_some());
    assert_eq!(param.default.unwrap(), json!(42));
}

#[test]
fn test_template_parameter_types() {
    // Test different parameter types
    let string_param = TemplateParameter {
        name: "str_param".to_string(),
        param_type: "string".to_string(),
        default: Some(json!("default")),
        required: false,
        description: None,
        validation: None,
    };
    
    let number_param = TemplateParameter {
        name: "num_param".to_string(),
        param_type: "number".to_string(),
        default: Some(json!(100)),
        required: false,
        description: None,
        validation: None,
    };
    
    let boolean_param = TemplateParameter {
        name: "bool_param".to_string(),
        param_type: "boolean".to_string(),
        default: Some(json!(true)),
        required: false,
        description: None,
        validation: None,
    };
    
    let array_param = TemplateParameter {
        name: "arr_param".to_string(),
        param_type: "array".to_string(),
        default: Some(json!(["item1", "item2"])),
        required: false,
        description: None,
        validation: None,
    };
    
    assert_eq!(string_param.param_type, "string");
    assert_eq!(number_param.param_type, "number");
    assert_eq!(boolean_param.param_type, "boolean");
    assert_eq!(array_param.param_type, "array");
}

// ================================
// WorkflowVersion 测试
// ================================

#[test]
fn test_workflow_version_creation() {
    // Arrange & Act
    let version = WorkflowVersion {
        id: 1,
        workflow_id: "wf-1".to_string(),
        version: "1.0.0".to_string(),
        workflow: create_test_workflow("wf-1", "工作流1"),
        changelog: Some("初始版本".to_string()),
        created_by: Some("user1".to_string()),
        created_at: chrono::Utc::now().timestamp(),
    };
    
    // Assert
    assert_eq!(version.id, 1);
    assert_eq!(version.workflow_id, "wf-1");
    assert_eq!(version.version, "1.0.0");
    assert!(version.changelog.is_some());
    assert!(version.created_by.is_some());
}

#[test]
fn test_workflow_version_serialization() {
    // Arrange
    let version = WorkflowVersion {
        id: 1,
        workflow_id: "test".to_string(),
        version: "1.0.0".to_string(),
        workflow: create_test_workflow("test", "测试"),
        changelog: None,
        created_by: None,
        created_at: 1000,
    };
    
    // Act
    let json_str = serde_json::to_string(&version).unwrap();
    let deserialized: WorkflowVersion = serde_json::from_str(&json_str).unwrap();
    
    // Assert
    assert_eq!(deserialized.id, version.id);
    assert_eq!(deserialized.workflow_id, version.workflow_id);
    assert_eq!(deserialized.version, version.version);
}

// ================================
// 版本号测试
// ================================

#[test]
fn test_version_string_format() {
    let versions = vec![
        "1.0.0",
        "2.1.3",
        "10.20.30",
        "0.0.1",
    ];
    
    for version in versions {
        let parts: Vec<&str> = version.split('.').collect();
        assert_eq!(parts.len(), 3);
        for part in parts {
            assert!(part.parse::<u32>().is_ok());
        }
    }
}

// ================================
// 搜索和过滤测试（模拟）
// ================================

#[test]
fn test_workflow_tag_filtering() {
    // Arrange
    let mut workflow1 = create_test_workflow("wf1", "工作流1");
    workflow1.tags = vec!["automation".to_string(), "production".to_string()];
    
    let mut workflow2 = create_test_workflow("wf2", "工作流2");
    workflow2.tags = vec!["test".to_string(), "development".to_string()];
    
    let workflows = vec![workflow1.clone(), workflow2.clone()];
    
    // Act - 模拟按标签过滤
    let filtered: Vec<&Workflow> = workflows.iter()
        .filter(|w| w.tags.contains(&"automation".to_string()))
        .collect();
    
    // Assert
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].id, "wf1");
}

#[test]
fn test_workflow_status_filtering() {
    // Arrange
    let mut workflow1 = create_test_workflow("wf1", "工作流1");
    workflow1.status = WorkflowStatus::Published;
    
    let mut workflow2 = create_test_workflow("wf2", "工作流2");
    workflow2.status = WorkflowStatus::Draft;
    
    let workflows = vec![workflow1.clone(), workflow2.clone()];
    
    // Act - 模拟按状态过滤
    let filtered: Vec<&Workflow> = workflows.iter()
        .filter(|w| w.status == WorkflowStatus::Published)
        .collect();
    
    // Assert
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].id, "wf1");
}

#[test]
fn test_workflow_category_filtering() {
    // Arrange
    let mut workflow1 = create_test_workflow("wf1", "工作流1");
    workflow1.category = "automation".to_string();
    
    let mut workflow2 = create_test_workflow("wf2", "工作流2");
    workflow2.category = "data_processing".to_string();
    
    let workflows = vec![workflow1.clone(), workflow2.clone()];
    
    // Act - 模拟按分类过滤
    let filtered: Vec<&Workflow> = workflows.iter()
        .filter(|w| w.category == "automation")
        .collect();
    
    // Assert
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].id, "wf1");
}

// ================================
// 模板管理测试（模拟）
// ================================

#[test]
fn test_template_workflow_flag() {
    // Arrange
    let mut workflow = create_test_workflow("template-wf", "模板工作流");
    workflow.is_template = true;
    workflow.template_id = Some("template-1".to_string());
    
    // Assert
    assert_eq!(workflow.is_template, true);
    assert!(workflow.template_id.is_some());
}

#[test]
fn test_workflow_created_from_template() {
    // Arrange
    let mut workflow = create_test_workflow("instance-wf", "实例工作流");
    workflow.is_template = false;
    workflow.template_id = Some("template-1".to_string());
    
    // Assert
    assert_eq!(workflow.is_template, false);
    assert!(workflow.template_id.is_some());
    assert_eq!(workflow.template_id.unwrap(), "template-1");
}

// ================================
// 克隆和复制测试
// ================================

#[test]
fn test_workflow_clone() {
    // Arrange
    let original = create_test_workflow("original", "原始工作流");
    
    // Act
    let cloned = original.clone();
    
    // Assert
    assert_eq!(cloned.id, original.id);
    assert_eq!(cloned.name, original.name);
    assert_eq!(cloned.steps.len(), original.steps.len());
}

#[test]
fn test_workflow_clone_independence() {
    // Arrange
    let mut original = create_test_workflow("original", "原始工作流");
    let mut cloned = original.clone();
    
    // Act
    cloned.id = "cloned".to_string();
    cloned.name = "克隆工作流".to_string();
    cloned.status = WorkflowStatus::Published;
    
    // Assert
    assert_ne!(cloned.id, original.id);
    assert_ne!(cloned.name, original.name);
    assert_ne!(cloned.status, original.status);
}


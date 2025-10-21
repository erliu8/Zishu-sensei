//! # Workflow 模型测试
//!
//! 测试工作流模型的验证、序列化、反序列化等功能

use zishu_sensei::workflow::models::*;
use serde_json::json;
use std::collections::HashMap;

// ================================
// Workflow 基础测试
// ================================

#[test]
fn test_workflow_creation_with_valid_data() {
    // Arrange
    let workflow = Workflow {
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
        created_at: 1234567890,
        updated_at: 1234567890,
    };

    // Assert
    assert_eq!(workflow.id, "test-workflow");
    assert_eq!(workflow.name, "测试工作流");
    assert_eq!(workflow.status, WorkflowStatus::Draft);
    assert_eq!(workflow.steps.len(), 1);
}

#[test]
fn test_workflow_validation_with_empty_name_fails() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "".to_string(), // 空名称
        description: None,
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![WorkflowStep {
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
        }],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let result = workflow.validate();

    // Assert
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("名称不能为空"));
}

#[test]
fn test_workflow_validation_with_no_steps_fails() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "测试工作流".to_string(),
        description: None,
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![], // 无步骤
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let result = workflow.validate();

    // Assert
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("至少需要一个步骤"));
}

#[test]
fn test_workflow_validation_with_invalid_dependency_fails() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "测试工作流".to_string(),
        description: None,
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
                depends_on: vec!["non_existent_step".to_string()], // 不存在的依赖
                allow_failure: false,
            },
        ],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let result = workflow.validate();

    // Assert
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("依赖的步骤"));
    assert!(result.unwrap_err().contains("不存在"));
}

#[test]
fn test_workflow_validation_with_circular_dependency_fails() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "测试工作流".to_string(),
        description: None,
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
                depends_on: vec!["step2".to_string()],
                allow_failure: false,
            },
            WorkflowStep {
                id: "step2".to_string(),
                name: "步骤2".to_string(),
                step_type: "custom".to_string(),
                description: None,
                config: None,
                inputs: None,
                outputs: None,
                condition: None,
                error_handling: None,
                retry_count: None,
                timeout: None,
                depends_on: vec!["step1".to_string()], // 循环依赖
                allow_failure: false,
            },
        ],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let result = workflow.validate();

    // Assert
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("循环依赖"));
}

#[test]
fn test_workflow_validation_with_valid_dependencies_succeeds() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "测试工作流".to_string(),
        description: None,
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
            WorkflowStep {
                id: "step2".to_string(),
                name: "步骤2".to_string(),
                step_type: "custom".to_string(),
                description: None,
                config: None,
                inputs: None,
                outputs: None,
                condition: None,
                error_handling: None,
                retry_count: None,
                timeout: None,
                depends_on: vec!["step1".to_string()],
                allow_failure: false,
            },
        ],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let result = workflow.validate();

    // Assert
    assert!(result.is_ok());
}

#[test]
fn test_workflow_get_execution_order_with_dependencies() {
    // Arrange
    let workflow = Workflow {
        id: "test".to_string(),
        name: "测试工作流".to_string(),
        description: None,
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![
            WorkflowStep {
                id: "step3".to_string(),
                name: "步骤3".to_string(),
                step_type: "custom".to_string(),
                description: None,
                config: None,
                inputs: None,
                outputs: None,
                condition: None,
                error_handling: None,
                retry_count: None,
                timeout: None,
                depends_on: vec!["step1".to_string(), "step2".to_string()],
                allow_failure: false,
            },
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
            WorkflowStep {
                id: "step2".to_string(),
                name: "步骤2".to_string(),
                step_type: "custom".to_string(),
                description: None,
                config: None,
                inputs: None,
                outputs: None,
                condition: None,
                error_handling: None,
                retry_count: None,
                timeout: None,
                depends_on: vec!["step1".to_string()],
                allow_failure: false,
            },
        ],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    // Act
    let order = workflow.get_execution_order().unwrap();

    // Assert
    assert_eq!(order.len(), 3);
    // step1应该第一个执行
    assert_eq!(order[0], "step1");
    // step2应该在step1之后
    assert_eq!(order[1], "step2");
    // step3应该最后执行
    assert_eq!(order[2], "step3");
}

// ================================
// WorkflowStatus 测试
// ================================

#[test]
fn test_workflow_status_serialization() {
    let statuses = vec![
        WorkflowStatus::Draft,
        WorkflowStatus::Published,
        WorkflowStatus::Archived,
        WorkflowStatus::Disabled,
    ];

    for status in statuses {
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: WorkflowStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, deserialized);
    }
}

// ================================
// WorkflowConfig 测试
// ================================

#[test]
fn test_workflow_config_default() {
    let config = WorkflowConfig::default();
    
    assert_eq!(config.timeout, None);
    assert_eq!(config.max_concurrent, None);
    assert_eq!(config.error_strategy, ErrorStrategy::Stop);
    assert_eq!(config.retry_config, None);
}

#[test]
fn test_workflow_config_with_retry() {
    let config = WorkflowConfig {
        timeout: Some(60000),
        max_concurrent: Some(5),
        error_strategy: ErrorStrategy::Retry,
        retry_config: Some(RetryConfig {
            max_attempts: 3,
            interval: 5000,
            backoff: BackoffStrategy::Exponential,
            retry_on: vec!["network_error".to_string()],
        }),
        notification: None,
        variables: None,
        environment: None,
        custom: None,
    };

    assert_eq!(config.timeout, Some(60000));
    assert_eq!(config.max_concurrent, Some(5));
    assert_eq!(config.error_strategy, ErrorStrategy::Retry);
    assert!(config.retry_config.is_some());
    
    let retry = config.retry_config.unwrap();
    assert_eq!(retry.max_attempts, 3);
    assert_eq!(retry.interval, 5000);
    assert_eq!(retry.backoff, BackoffStrategy::Exponential);
}

// ================================
// WorkflowStep 测试
// ================================

#[test]
fn test_workflow_step_creation() {
    let step = WorkflowStep {
        id: "test-step".to_string(),
        name: "测试步骤".to_string(),
        step_type: "chat".to_string(),
        description: Some("测试描述".to_string()),
        config: Some(json!({
            "prompt": "Hello",
            "model": "gpt-4"
        })),
        inputs: Some({
            let mut map = HashMap::new();
            map.insert("input1".to_string(), json!("value1"));
            map
        }),
        outputs: Some({
            let mut map = HashMap::new();
            map.insert("output1".to_string(), "$.result".to_string());
            map
        }),
        condition: Some("count > 5".to_string()),
        error_handling: Some("continue".to_string()),
        retry_count: Some(3),
        timeout: Some(30000),
        depends_on: vec!["prev_step".to_string()],
        allow_failure: true,
    };

    assert_eq!(step.id, "test-step");
    assert_eq!(step.step_type, "chat");
    assert!(step.config.is_some());
    assert!(step.inputs.is_some());
    assert!(step.outputs.is_some());
    assert_eq!(step.retry_count, Some(3));
    assert_eq!(step.timeout, Some(30000));
    assert_eq!(step.allow_failure, true);
}

// ================================
// ErrorStrategy 测试
// ================================

#[test]
fn test_error_strategy_default() {
    let strategy = ErrorStrategy::default();
    assert_eq!(strategy, ErrorStrategy::Stop);
}

#[test]
fn test_error_strategy_variants() {
    let strategies = vec![
        ErrorStrategy::Stop,
        ErrorStrategy::Continue,
        ErrorStrategy::Retry,
        ErrorStrategy::Rollback,
    ];

    for strategy in strategies {
        let json = serde_json::to_string(&strategy).unwrap();
        let deserialized: ErrorStrategy = serde_json::from_str(&json).unwrap();
        assert_eq!(strategy, deserialized);
    }
}

// ================================
// WorkflowExport 测试
// ================================

#[test]
fn test_workflow_export_creation() {
    let workflows = vec![];
    let templates = vec![];
    
    let export = WorkflowExport::new(workflows, templates);
    
    assert_eq!(export.format_version, WorkflowExport::CURRENT_VERSION);
    assert!(export.exported_at > 0);
    assert_eq!(export.workflows.len(), 0);
    assert_eq!(export.templates.len(), 0);
}

#[test]
fn test_workflow_export_serialization() {
    let workflow = Workflow {
        id: "test".to_string(),
        name: "Test".to_string(),
        description: None,
        version: "1.0.0".to_string(),
        status: WorkflowStatus::Draft,
        steps: vec![],
        config: WorkflowConfig::default(),
        trigger: None,
        tags: vec![],
        category: "test".to_string(),
        is_template: false,
        template_id: None,
        created_at: 0,
        updated_at: 0,
    };

    let export = WorkflowExport::new(vec![workflow], vec![]);
    
    let json = serde_json::to_string(&export).unwrap();
    let deserialized: WorkflowExport = serde_json::from_str(&json).unwrap();
    
    assert_eq!(export.format_version, deserialized.format_version);
    assert_eq!(export.workflows.len(), deserialized.workflows.len());
}

// ================================
// ExecutionStatus 测试
// ================================

#[test]
fn test_execution_status_variants() {
    let statuses = vec![
        ExecutionStatus::Pending,
        ExecutionStatus::Running,
        ExecutionStatus::Paused,
        ExecutionStatus::Completed,
        ExecutionStatus::Failed,
        ExecutionStatus::Cancelled,
    ];

    for status in statuses {
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: ExecutionStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, deserialized);
    }
}

// ================================
// LoopType 和 TransformType 测试
// ================================

#[test]
fn test_loop_type_serialization() {
    let types = vec![
        LoopType::ForEach,
        LoopType::While,
        LoopType::Count,
    ];

    for loop_type in types {
        let json = serde_json::to_string(&loop_type).unwrap();
        let deserialized: LoopType = serde_json::from_str(&json).unwrap();
        assert_eq!(loop_type, deserialized);
    }
}

#[test]
fn test_transform_type_serialization() {
    let types = vec![
        TransformType::Json,
        TransformType::Text,
        TransformType::Expression,
        TransformType::Script,
    ];

    for transform_type in types {
        let json = serde_json::to_string(&transform_type).unwrap();
        let deserialized: TransformType = serde_json::from_str(&json).unwrap();
        assert_eq!(transform_type, deserialized);
    }
}

// ================================
// ParallelFailureStrategy 测试
// ================================

#[test]
fn test_parallel_failure_strategy_variants() {
    let strategies = vec![
        ParallelFailureStrategy::WaitAll,
        ParallelFailureStrategy::FailFast,
        ParallelFailureStrategy::Continue,
    ];

    for strategy in strategies {
        let json = serde_json::to_string(&strategy).unwrap();
        let deserialized: ParallelFailureStrategy = serde_json::from_str(&json).unwrap();
        assert_eq!(strategy, deserialized);
    }
}

// ================================
// BackoffStrategy 测试
// ================================

#[test]
fn test_backoff_strategy_variants() {
    let strategies = vec![
        BackoffStrategy::Fixed,
        BackoffStrategy::Linear,
        BackoffStrategy::Exponential,
    ];

    for strategy in strategies {
        let json = serde_json::to_string(&strategy).unwrap();
        let deserialized: BackoffStrategy = serde_json::from_str(&json).unwrap();
        assert_eq!(strategy, deserialized);
    }
}


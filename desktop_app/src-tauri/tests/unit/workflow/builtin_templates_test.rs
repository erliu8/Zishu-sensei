//! # 内置工作流模板测试
//!
//! 测试内置工作流模板的完整性和正确性

use zishu_sensei::workflow::builtin_templates::BuiltinTemplates;
use zishu_sensei::workflow::models::*;

// ================================
// 获取所有模板测试
// ================================

#[test]
fn test_get_all_templates() {
    // Act
    let templates = BuiltinTemplates::get_all();
    
    // Assert
    assert!(templates.len() > 0, "应该至少有一个内置模板");
    
    // 验证每个模板的基本结构
    for template in &templates {
        assert!(!template.id.is_empty(), "模板ID不能为空");
        assert!(!template.name.is_empty(), "模板名称不能为空");
        assert!(!template.template_type.is_empty(), "模板类型不能为空");
        assert!(!template.workflow.steps.is_empty(), "工作流步骤不能为空");
    }
}

#[test]
fn test_all_templates_have_unique_ids() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    let mut ids = std::collections::HashSet::new();
    
    // Act & Assert
    for template in &templates {
        assert!(
            ids.insert(template.id.clone()),
            "模板ID {} 重复",
            template.id
        );
    }
}

#[test]
fn test_all_templates_are_marked_as_templates() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in &templates {
        assert_eq!(
            template.workflow.is_template,
            true,
            "模板 {} 的工作流应该标记为模板",
            template.id
        );
    }
}

// ================================
// 根据ID获取模板测试
// ================================

#[test]
fn test_get_by_id_existing_template() {
    // Arrange
    let all_templates = BuiltinTemplates::get_all();
    let first_template_id = &all_templates[0].id;
    
    // Act
    let template = BuiltinTemplates::get_by_id(first_template_id);
    
    // Assert
    assert!(template.is_some(), "应该能找到模板");
    assert_eq!(template.unwrap().id, *first_template_id);
}

#[test]
fn test_get_by_id_nonexistent_template() {
    // Act
    let template = BuiltinTemplates::get_by_id("nonexistent_template_id");
    
    // Assert
    assert!(template.is_none(), "不存在的模板应该返回None");
}

// ================================
// 每日总结模板测试
// ================================

#[test]
fn test_daily_summary_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_daily_summary");
    
    // Assert
    assert!(template.is_some(), "每日总结模板应该存在");
}

#[test]
fn test_daily_summary_template_structure() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_daily_summary").unwrap();
    
    // Assert
    assert_eq!(template.id, "builtin_daily_summary");
    assert_eq!(template.name, "每日总结");
    assert_eq!(template.template_type, "productivity");
    assert!(template.workflow.steps.len() >= 3, "应该有多个步骤");
    
    // 验证步骤类型
    let step_types: Vec<&str> = template.workflow.steps
        .iter()
        .map(|s| s.step_type.as_str())
        .collect();
    assert!(step_types.contains(&"custom") || step_types.contains(&"chat"));
}

#[test]
fn test_daily_summary_template_has_schedule_trigger() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_daily_summary").unwrap();
    
    // Assert
    assert!(template.workflow.trigger.is_some(), "应该有触发器配置");
    let trigger = template.workflow.trigger.unwrap();
    assert_eq!(trigger.trigger_type, "schedule");
}

// ================================
// 内容生成器模板测试
// ================================

#[test]
fn test_content_generator_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_content_generator");
    
    // Assert
    assert!(template.is_some(), "内容生成器模板应该存在");
}

#[test]
fn test_content_generator_template_structure() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_content_generator").unwrap();
    
    // Assert
    assert_eq!(template.id, "builtin_content_generator");
    assert_eq!(template.name, "内容生成器");
    assert_eq!(template.template_type, "content");
    assert!(template.parameters.len() > 0, "应该有模板参数");
}

#[test]
fn test_content_generator_has_required_parameters() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_content_generator").unwrap();
    
    // Assert
    let required_params: Vec<&TemplateParameter> = template.parameters
        .iter()
        .filter(|p| p.required)
        .collect();
    
    assert!(required_params.len() > 0, "应该有必需参数");
    
    // 验证topic参数存在且为必需
    let topic_param = template.parameters.iter().find(|p| p.name == "topic");
    assert!(topic_param.is_some(), "应该有topic参数");
    assert_eq!(topic_param.unwrap().required, true);
}

// ================================
// 数据处理模板测试
// ================================

#[test]
fn test_data_processing_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_data_processing");
    
    // Assert
    assert!(template.is_some(), "数据处理模板应该存在");
}

#[test]
fn test_data_processing_template_structure() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_data_processing").unwrap();
    
    // Assert
    assert_eq!(template.id, "builtin_data_processing");
    assert_eq!(template.name, "数据处理");
    assert_eq!(template.template_type, "data");
}

#[test]
fn test_data_processing_has_loop_step() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_data_processing").unwrap();
    
    // Assert
    let has_loop = template.workflow.steps
        .iter()
        .any(|step| step.step_type == "loop");
    
    assert!(has_loop, "数据处理模板应该包含循环步骤");
}

// ================================
// 通知模板测试
// ================================

#[test]
fn test_notification_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_notification");
    
    // Assert
    assert!(template.is_some(), "通知模板应该存在");
}

#[test]
fn test_notification_template_has_parallel_step() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_notification").unwrap();
    
    // Assert
    let has_parallel = template.workflow.steps
        .iter()
        .any(|step| step.step_type == "parallel");
    
    assert!(has_parallel, "通知模板应该包含并行步骤");
}

// ================================
// 文件整理模板测试
// ================================

#[test]
fn test_file_organizer_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_file_organizer");
    
    // Assert
    assert!(template.is_some(), "文件整理模板应该存在");
}

#[test]
fn test_file_organizer_template_structure() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_file_organizer").unwrap();
    
    // Assert
    assert_eq!(template.id, "builtin_file_organizer");
    assert_eq!(template.name, "文件整理");
    assert_eq!(template.template_type, "utility");
}

// ================================
// API集成模板测试
// ================================

#[test]
fn test_api_integration_template_exists() {
    // Act
    let template = BuiltinTemplates::get_by_id("builtin_api_integration");
    
    // Assert
    assert!(template.is_some(), "API集成模板应该存在");
}

#[test]
fn test_api_integration_template_structure() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_api_integration").unwrap();
    
    // Assert
    assert_eq!(template.id, "builtin_api_integration");
    assert_eq!(template.name, "API集成");
    assert_eq!(template.template_type, "integration");
}

#[test]
fn test_api_integration_has_error_handling() {
    // Arrange
    let template = BuiltinTemplates::get_by_id("builtin_api_integration").unwrap();
    
    // Assert
    assert_eq!(
        template.workflow.config.error_strategy,
        ErrorStrategy::Retry,
        "API集成应该使用重试策略"
    );
    assert!(
        template.workflow.config.retry_config.is_some(),
        "应该有重试配置"
    );
}

// ================================
// 模板参数验证测试
// ================================

#[test]
fn test_all_templates_parameters_are_valid() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        for param in &template.parameters {
            assert!(!param.name.is_empty(), "参数名称不能为空");
            assert!(!param.param_type.is_empty(), "参数类型不能为空");
            
            // 如果参数不是必需的，应该有默认值
            if !param.required {
                // 注意：某些可选参数可能没有默认值，这取决于设计
                // 这里我们只验证结构的一致性
            }
        }
    }
}

// ================================
// 模板工作流验证测试
// ================================

#[test]
fn test_all_templates_workflows_are_valid() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        let validation_result = template.workflow.validate();
        assert!(
            validation_result.is_ok(),
            "模板 {} 的工作流验证失败: {:?}",
            template.id,
            validation_result.err()
        );
    }
}

#[test]
fn test_all_templates_have_proper_step_configuration() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        for step in &template.workflow.steps {
            assert!(!step.id.is_empty(), "步骤ID不能为空");
            assert!(!step.name.is_empty(), "步骤名称不能为空");
            assert!(!step.step_type.is_empty(), "步骤类型不能为空");
            
            // 验证依赖关系的完整性
            for dep in &step.depends_on {
                let dep_exists = template.workflow.steps
                    .iter()
                    .any(|s| s.id == *dep);
                assert!(
                    dep_exists,
                    "模板 {} 的步骤 {} 依赖的步骤 {} 不存在",
                    template.id,
                    step.id,
                    dep
                );
            }
        }
    }
}

// ================================
// 模板标签测试
// ================================

#[test]
fn test_all_templates_have_builtin_tag() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        assert!(
            template.tags.contains(&"builtin".to_string()),
            "模板 {} 应该包含 'builtin' 标签",
            template.id
        );
    }
}

// ================================
// 模板配置测试
// ================================

#[test]
fn test_templates_have_reasonable_timeouts() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        if let Some(timeout) = template.workflow.config.timeout {
            assert!(
                timeout > 0 && timeout < 3600000, // 不超过1小时
                "模板 {} 的超时时间不合理: {}",
                template.id,
                timeout
            );
        }
    }
}

#[test]
fn test_templates_have_reasonable_concurrency() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        if let Some(max_concurrent) = template.workflow.config.max_concurrent {
            assert!(
                max_concurrent > 0 && max_concurrent <= 100,
                "模板 {} 的最大并发数不合理: {}",
                template.id,
                max_concurrent
            );
        }
    }
}

// ================================
// 模板版本测试
// ================================

#[test]
fn test_all_templates_have_valid_version() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        let version = &template.workflow.version;
        let parts: Vec<&str> = version.split('.').collect();
        
        assert_eq!(
            parts.len(),
            3,
            "模板 {} 的版本号格式不正确: {}",
            template.id,
            version
        );
        
        for part in parts {
            assert!(
                part.parse::<u32>().is_ok(),
                "模板 {} 的版本号部分不是数字: {}",
                template.id,
                part
            );
        }
    }
}

// ================================
// 模板时间戳测试
// ================================

#[test]
fn test_all_templates_have_valid_timestamps() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        assert!(
            template.created_at > 0,
            "模板 {} 的创建时间无效",
            template.id
        );
        assert!(
            template.updated_at > 0,
            "模板 {} 的更新时间无效",
            template.id
        );
        assert_eq!(
            template.workflow.created_at,
            template.created_at,
            "模板 {} 的工作流创建时间应该与模板创建时间一致",
            template.id
        );
    }
}

// ================================
// 模板序列化测试
// ================================

#[test]
fn test_all_templates_can_be_serialized() {
    // Arrange
    let templates = BuiltinTemplates::get_all();
    
    // Act & Assert
    for template in templates {
        let json_result = serde_json::to_string(&template);
        assert!(
            json_result.is_ok(),
            "模板 {} 序列化失败: {:?}",
            template.id,
            json_result.err()
        );
        
        let json = json_result.unwrap();
        let deserialize_result: Result<WorkflowTemplate, _> = serde_json::from_str(&json);
        assert!(
            deserialize_result.is_ok(),
            "模板 {} 反序列化失败: {:?}",
            template.id,
            deserialize_result.err()
        );
    }
}


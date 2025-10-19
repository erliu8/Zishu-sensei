use serde_json::json;
use crate::workflow::models::*;
use std::collections::HashMap;

/// 内置工作流模板管理
pub struct BuiltinTemplates;

impl BuiltinTemplates {
    /// 获取所有内置模板
    pub fn get_all() -> Vec<WorkflowTemplate> {
        vec![
            Self::daily_summary_template(),
            Self::content_generator_template(),
            Self::data_processing_template(),
            Self::notification_workflow_template(),
            Self::file_organizer_template(),
            Self::api_integration_template(),
        ]
    }

    /// 根据ID获取模板
    pub fn get_by_id(id: &str) -> Option<WorkflowTemplate> {
        Self::get_all().into_iter().find(|t| t.id == id)
    }

    /// 每日总结工作流模板
    fn daily_summary_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_daily_summary".to_string(),
            name: "每日总结".to_string(),
            description: Some("自动生成每日工作总结，包括任务完成情况、时间统计等".to_string()),
            template_type: "productivity".to_string(),
            workflow: Workflow {
                id: "daily_summary_workflow".to_string(),
                name: "每日总结工作流".to_string(),
                description: Some("收集并整理每日数据，生成总结报告".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "collect_data".to_string(),
                        name: "收集数据".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("收集今日的任务和活动数据".to_string()),
                        config: Some(json!({
                            "data_sources": ["tasks", "calendar", "activity_log"],
                            "date_range": "today"
                        })),
                        inputs: None,
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("collected_data".to_string(), "$.output.data".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(3),
                        timeout: Some(30000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "analyze_tasks".to_string(),
                        name: "分析任务".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("统计任务完成情况".to_string()),
                        config: Some(json!({
                            "analysis_type": "task_statistics",
                            "metrics": ["completed", "pending", "overdue", "time_spent"]
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${steps.collect_data.output.collected_data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("task_stats".to_string(), "$.output.statistics".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(20000),
                        depends_on: vec!["collect_data".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "generate_summary".to_string(),
                        name: "生成总结".to_string(),
                        step_type: "chat".to_string(),
                        description: Some("使用AI生成总结报告".to_string()),
                        config: Some(json!({
                            "prompt": "根据以下数据生成一份简洁的每日工作总结：\n\n任务统计：${steps.analyze_tasks.output.task_stats}\n\n请包括：1. 完成情况 2. 主要成就 3. 待改进点",
                            "model": "gpt-4",
                            "temperature": 0.7,
                            "max_tokens": 500
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("stats".to_string(), json!("${steps.analyze_tasks.output.task_stats}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("summary".to_string(), "$.output.response".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(60000),
                        depends_on: vec!["analyze_tasks".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "save_report".to_string(),
                        name: "保存报告".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("保存总结报告到文件".to_string()),
                        config: Some(json!({
                            "action": "save_file",
                            "path": "daily_reports/${date}.md",
                            "format": "markdown"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("content".to_string(), json!("${steps.generate_summary.output.summary}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("file_path".to_string(), "$.output.path".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(10000),
                        depends_on: vec!["generate_summary".to_string()],
                        allow_failure: false,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(180000),
                    max_concurrent: Some(1),
                    error_strategy: ErrorStrategy::Stop,
                    retry_config: Some(RetryConfig {
                        max_attempts: 3,
                        interval: 5000,
                        backoff: BackoffStrategy::Exponential,
                        retry_on: vec!["network_error".to_string(), "timeout".to_string()],
                    }),
                    notification: Some(NotificationConfig {
                        on_success: true,
                        on_failure: true,
                        channels: vec!["desktop".to_string()],
                        message_template: Some("每日总结已生成".to_string()),
                    }),
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("date".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("${now.format('YYYY-MM-DD')}")),
                            required: false,
                            description: Some("报告日期".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: Some(WorkflowTrigger {
                    trigger_type: "schedule".to_string(),
                    config: Some(json!({
                        "cron": "0 18 * * *",
                        "timezone": "Asia/Shanghai"
                    })),
                }),
                tags: vec!["productivity".to_string(), "summary".to_string()],
                category: "automation".to_string(),
                is_template: true,
                template_id: Some("builtin_daily_summary".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "report_time".to_string(),
                    param_type: "string".to_string(),
                    default: Some(json!("18:00")),
                    required: false,
                    description: Some("生成报告的时间".to_string()),
                    validation: Some(json!({
                        "pattern": "^([01]\\d|2[0-3]):([0-5]\\d)$"
                    })),
                },
                TemplateParameter {
                    name: "include_calendar".to_string(),
                    param_type: "boolean".to_string(),
                    default: Some(json!(true)),
                    required: false,
                    description: Some("是否包含日历事件".to_string()),
                    validation: None,
                },
            ],
            tags: vec!["builtin".to_string(), "productivity".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    /// 内容生成工作流模板
    fn content_generator_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_content_generator".to_string(),
            name: "内容生成器".to_string(),
            description: Some("根据主题自动生成结构化的内容，支持文章、博客、文档等".to_string()),
            template_type: "content".to_string(),
            workflow: Workflow {
                id: "content_generator_workflow".to_string(),
                name: "内容生成工作流".to_string(),
                description: Some("智能生成高质量内容".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "outline_generation".to_string(),
                        name: "生成大纲".to_string(),
                        step_type: "chat".to_string(),
                        description: Some("根据主题生成内容大纲".to_string()),
                        config: Some(json!({
                            "prompt": "为以下主题创建详细的内容大纲：${input.topic}\n\n要求：\n1. 至少3个主要部分\n2. 每个部分包含2-4个子点\n3. 逻辑清晰，结构完整",
                            "model": "gpt-4",
                            "temperature": 0.8
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("topic".to_string(), json!("${input.topic}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("outline".to_string(), "$.output.response".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(60000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "content_expansion".to_string(),
                        name: "扩展内容".to_string(),
                        step_type: "chat".to_string(),
                        description: Some("根据大纲扩展完整内容".to_string()),
                        config: Some(json!({
                            "prompt": "根据以下大纲，撰写完整的内容：\n\n${steps.outline_generation.output.outline}\n\n要求：\n1. 语言流畅自然\n2. 内容充实有深度\n3. 符合${input.style}风格\n4. 字数约${input.length}字",
                            "model": "gpt-4",
                            "temperature": 0.7,
                            "max_tokens": 2000
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("outline".to_string(), json!("${steps.outline_generation.output.outline}"));
                            map.insert("style".to_string(), json!("${input.style}"));
                            map.insert("length".to_string(), json!("${input.length}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("content".to_string(), "$.output.response".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(120000),
                        depends_on: vec!["outline_generation".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "polish_content".to_string(),
                        name: "润色优化".to_string(),
                        step_type: "chat".to_string(),
                        description: Some("对内容进行润色和优化".to_string()),
                        config: Some(json!({
                            "prompt": "请对以下内容进行润色优化：\n\n${steps.content_expansion.output.content}\n\n优化重点：\n1. 提升可读性\n2. 修正语法错误\n3. 增强表达力\n4. 保持原意不变",
                            "model": "gpt-4",
                            "temperature": 0.6
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("content".to_string(), json!("${steps.content_expansion.output.content}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("polished_content".to_string(), "$.output.response".to_string());
                            map
                        }),
                        condition: Some("${input.polish} == true".to_string()),
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(60000),
                        depends_on: vec!["content_expansion".to_string()],
                        allow_failure: true,
                    },
                    WorkflowStep {
                        id: "format_output".to_string(),
                        name: "格式化输出".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("将内容格式化为指定格式".to_string()),
                        config: Some(json!({
                            "format": "${input.output_format}",
                            "add_metadata": true
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("content".to_string(), json!("${steps.polish_content.output.polished_content || steps.content_expansion.output.content}"));
                            map.insert("outline".to_string(), json!("${steps.outline_generation.output.outline}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("final_content".to_string(), "$.output.formatted".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(10000),
                        depends_on: vec!["content_expansion".to_string()],
                        allow_failure: false,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(300000),
                    max_concurrent: Some(1),
                    error_strategy: ErrorStrategy::Stop,
                    retry_config: Some(RetryConfig {
                        max_attempts: 2,
                        interval: 3000,
                        backoff: BackoffStrategy::Linear,
                        retry_on: vec!["api_error".to_string()],
                    }),
                    notification: None,
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("topic".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: None,
                            required: true,
                            description: Some("内容主题".to_string()),
                        });
                        vars.insert("style".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("专业")),
                            required: false,
                            description: Some("写作风格".to_string()),
                        });
                        vars.insert("length".to_string(), VariableDefinition {
                            var_type: "number".to_string(),
                            default: Some(json!(1000)),
                            required: false,
                            description: Some("目标字数".to_string()),
                        });
                        vars.insert("polish".to_string(), VariableDefinition {
                            var_type: "boolean".to_string(),
                            default: Some(json!(true)),
                            required: false,
                            description: Some("是否润色".to_string()),
                        });
                        vars.insert("output_format".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("markdown")),
                            required: false,
                            description: Some("输出格式".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: None,
                tags: vec!["content".to_string(), "ai".to_string()],
                category: "content_creation".to_string(),
                is_template: true,
                template_id: Some("builtin_content_generator".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "topic".to_string(),
                    param_type: "string".to_string(),
                    default: None,
                    required: true,
                    description: Some("要生成内容的主题".to_string()),
                    validation: Some(json!({
                        "min_length": 5,
                        "max_length": 200
                    })),
                },
                TemplateParameter {
                    name: "style".to_string(),
                    param_type: "string".to_string(),
                    default: Some(json!("专业")),
                    required: false,
                    description: Some("写作风格（如：专业、轻松、学术等）".to_string()),
                    validation: None,
                },
                TemplateParameter {
                    name: "length".to_string(),
                    param_type: "number".to_string(),
                    default: Some(json!(1000)),
                    required: false,
                    description: Some("目标字数".to_string()),
                    validation: Some(json!({
                        "min": 100,
                        "max": 5000
                    })),
                },
            ],
            tags: vec!["builtin".to_string(), "content".to_string(), "ai".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    /// 数据处理工作流模板
    fn data_processing_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_data_processing".to_string(),
            name: "数据处理".to_string(),
            description: Some("批量处理数据，支持转换、过滤、聚合等操作".to_string()),
            template_type: "data".to_string(),
            workflow: Workflow {
                id: "data_processing_workflow".to_string(),
                name: "数据处理工作流".to_string(),
                description: Some("灵活的数据处理流水线".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "load_data".to_string(),
                        name: "加载数据".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("从数据源加载数据".to_string()),
                        config: Some(json!({
                            "source_type": "${input.source_type}",
                            "source_path": "${input.source_path}",
                            "format": "${input.format}"
                        })),
                        inputs: None,
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("raw_data".to_string(), "$.output.data".to_string());
                            map.insert("row_count".to_string(), "$.output.count".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(3),
                        timeout: Some(60000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "validate_data".to_string(),
                        name: "验证数据".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("验证数据格式和完整性".to_string()),
                        config: Some(json!({
                            "validation_rules": "${input.validation_rules}",
                            "strict_mode": false
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${steps.load_data.output.raw_data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("validated_data".to_string(), "$.output.valid_data".to_string());
                            map.insert("errors".to_string(), "$.output.errors".to_string());
                            map
                        }),
                        condition: Some("${input.validate} == true".to_string()),
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(30000),
                        depends_on: vec!["load_data".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "transform_data".to_string(),
                        name: "转换数据".to_string(),
                        step_type: "loop".to_string(),
                        description: Some("批量转换数据".to_string()),
                        config: Some(json!({
                            "loop_type": "for_each",
                            "items": "${steps.validate_data.output.validated_data || steps.load_data.output.raw_data}",
                            "item_name": "item",
                            "max_iterations": 10000,
                            "body_steps": ["transform_item"]
                        })),
                        inputs: None,
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("transformed_data".to_string(), "$.output.results".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(300000),
                        depends_on: vec!["load_data".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "aggregate_data".to_string(),
                        name: "聚合数据".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("对数据进行聚合统计".to_string()),
                        config: Some(json!({
                            "aggregations": "${input.aggregations}",
                            "group_by": "${input.group_by}"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${steps.transform_data.output.transformed_data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("aggregated_data".to_string(), "$.output.aggregations".to_string());
                            map
                        }),
                        condition: Some("${input.aggregate} == true".to_string()),
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(60000),
                        depends_on: vec!["transform_data".to_string()],
                        allow_failure: true,
                    },
                    WorkflowStep {
                        id: "export_data".to_string(),
                        name: "导出数据".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("将处理后的数据导出".to_string()),
                        config: Some(json!({
                            "output_path": "${input.output_path}",
                            "output_format": "${input.output_format}",
                            "overwrite": true
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${steps.aggregate_data.output.aggregated_data || steps.transform_data.output.transformed_data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("export_path".to_string(), "$.output.path".to_string());
                            map.insert("export_size".to_string(), "$.output.size".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(60000),
                        depends_on: vec!["transform_data".to_string()],
                        allow_failure: false,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(600000),
                    max_concurrent: Some(4),
                    error_strategy: ErrorStrategy::Stop,
                    retry_config: Some(RetryConfig {
                        max_attempts: 3,
                        interval: 2000,
                        backoff: BackoffStrategy::Exponential,
                        retry_on: vec!["io_error".to_string(), "timeout".to_string()],
                    }),
                    notification: Some(NotificationConfig {
                        on_success: true,
                        on_failure: true,
                        channels: vec!["desktop".to_string()],
                        message_template: Some("数据处理完成：处理了 ${steps.load_data.output.row_count} 条记录".to_string()),
                    }),
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("source_type".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("file")),
                            required: true,
                            description: Some("数据源类型".to_string()),
                        });
                        vars.insert("format".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("json")),
                            required: false,
                            description: Some("数据格式".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: None,
                tags: vec!["data".to_string(), "etl".to_string()],
                category: "data_processing".to_string(),
                is_template: true,
                template_id: Some("builtin_data_processing".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "source_path".to_string(),
                    param_type: "string".to_string(),
                    default: None,
                    required: true,
                    description: Some("数据源路径".to_string()),
                    validation: None,
                },
                TemplateParameter {
                    name: "output_path".to_string(),
                    param_type: "string".to_string(),
                    default: None,
                    required: true,
                    description: Some("输出路径".to_string()),
                    validation: None,
                },
            ],
            tags: vec!["builtin".to_string(), "data".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    /// 通知工作流模板
    fn notification_workflow_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_notification".to_string(),
            name: "智能通知".to_string(),
            description: Some("根据条件发送多渠道通知，支持桌面、邮件等".to_string()),
            template_type: "notification".to_string(),
            workflow: Workflow {
                id: "notification_workflow".to_string(),
                name: "智能通知工作流".to_string(),
                description: Some("灵活的多渠道通知系统".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "check_condition".to_string(),
                        name: "检查条件".to_string(),
                        step_type: "condition".to_string(),
                        description: Some("检查是否满足通知条件".to_string()),
                        config: Some(json!({
                            "condition": "${input.condition}",
                            "default_result": true
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${input.data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("should_notify".to_string(), "$.output.result".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(5000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "format_message".to_string(),
                        name: "格式化消息".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("根据模板格式化通知消息".to_string()),
                        config: Some(json!({
                            "template": "${input.message_template}",
                            "format": "text"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${input.data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("message".to_string(), "$.output.formatted".to_string());
                            map
                        }),
                        condition: Some("${steps.check_condition.output.should_notify} == true".to_string()),
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(5000),
                        depends_on: vec!["check_condition".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "send_notification".to_string(),
                        name: "发送通知".to_string(),
                        step_type: "parallel".to_string(),
                        description: Some("并行发送到多个渠道".to_string()),
                        config: Some(json!({
                            "tasks": [
                                {
                                    "id": "desktop",
                                    "name": "桌面通知",
                                    "steps": ["send_desktop"]
                                },
                                {
                                    "id": "log",
                                    "name": "日志记录",
                                    "steps": ["write_log"]
                                }
                            ],
                            "max_concurrent": 3,
                            "failure_strategy": "continue"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("message".to_string(), json!("${steps.format_message.output.message}"));
                            map.insert("channels".to_string(), json!("${input.channels}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("sent_channels".to_string(), "$.output.success".to_string());
                            map
                        }),
                        condition: Some("${steps.check_condition.output.should_notify} == true".to_string()),
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(30000),
                        depends_on: vec!["format_message".to_string()],
                        allow_failure: false,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(60000),
                    max_concurrent: Some(1),
                    error_strategy: ErrorStrategy::Continue,
                    retry_config: Some(RetryConfig {
                        max_attempts: 2,
                        interval: 1000,
                        backoff: BackoffStrategy::Fixed,
                        retry_on: vec!["network_error".to_string()],
                    }),
                    notification: None,
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("message_template".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("${title}: ${content}")),
                            required: false,
                            description: Some("消息模板".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: None,
                tags: vec!["notification".to_string()],
                category: "utility".to_string(),
                is_template: true,
                template_id: Some("builtin_notification".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "message_template".to_string(),
                    param_type: "string".to_string(),
                    default: Some(json!("${title}: ${content}")),
                    required: false,
                    description: Some("通知消息模板".to_string()),
                    validation: None,
                },
                TemplateParameter {
                    name: "channels".to_string(),
                    param_type: "array".to_string(),
                    default: Some(json!(["desktop"])),
                    required: false,
                    description: Some("通知渠道列表".to_string()),
                    validation: None,
                },
            ],
            tags: vec!["builtin".to_string(), "notification".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    /// 文件整理工作流模板
    fn file_organizer_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_file_organizer".to_string(),
            name: "文件整理".to_string(),
            description: Some("自动整理文件，按类型、日期等规则分类存放".to_string()),
            template_type: "utility".to_string(),
            workflow: Workflow {
                id: "file_organizer_workflow".to_string(),
                name: "文件整理工作流".to_string(),
                description: Some("智能文件管理助手".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "scan_files".to_string(),
                        name: "扫描文件".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("扫描指定目录的文件".to_string()),
                        config: Some(json!({
                            "path": "${input.source_path}",
                            "recursive": true,
                            "include_hidden": false
                        })),
                        inputs: None,
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("files".to_string(), "$.output.file_list".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(2),
                        timeout: Some(30000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "classify_files".to_string(),
                        name: "分类文件".to_string(),
                        step_type: "loop".to_string(),
                        description: Some("根据规则对文件进行分类".to_string()),
                        config: Some(json!({
                            "loop_type": "for_each",
                            "items": "${steps.scan_files.output.files}",
                            "item_name": "file",
                            "body_steps": ["classify_file"]
                        })),
                        inputs: None,
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("classified".to_string(), "$.output.results".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(120000),
                        depends_on: vec!["scan_files".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "move_files".to_string(),
                        name: "移动文件".to_string(),
                        step_type: "custom".to_string(),
                        description: Some("将文件移动到对应的分类目录".to_string()),
                        config: Some(json!({
                            "dry_run": "${input.dry_run}",
                            "create_dirs": true,
                            "overwrite": false
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("classifications".to_string(), json!("${steps.classify_files.output.classified}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("moved_count".to_string(), "$.output.count".to_string());
                            map.insert("results".to_string(), "$.output.results".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(60000),
                        depends_on: vec!["classify_files".to_string()],
                        allow_failure: false,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(300000),
                    max_concurrent: Some(1),
                    error_strategy: ErrorStrategy::Stop,
                    retry_config: None,
                    notification: Some(NotificationConfig {
                        on_success: true,
                        on_failure: true,
                        channels: vec!["desktop".to_string()],
                        message_template: Some("文件整理完成：整理了 ${steps.move_files.output.moved_count} 个文件".to_string()),
                    }),
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("source_path".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: None,
                            required: true,
                            description: Some("源目录路径".to_string()),
                        });
                        vars.insert("dry_run".to_string(), VariableDefinition {
                            var_type: "boolean".to_string(),
                            default: Some(json!(false)),
                            required: false,
                            description: Some("预览模式（不实际移动文件）".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: None,
                tags: vec!["file".to_string(), "organization".to_string()],
                category: "utility".to_string(),
                is_template: true,
                template_id: Some("builtin_file_organizer".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "source_path".to_string(),
                    param_type: "string".to_string(),
                    default: None,
                    required: true,
                    description: Some("要整理的目录路径".to_string()),
                    validation: None,
                },
                TemplateParameter {
                    name: "dry_run".to_string(),
                    param_type: "boolean".to_string(),
                    default: Some(json!(false)),
                    required: false,
                    description: Some("是否仅预览而不实际移动文件".to_string()),
                    validation: None,
                },
            ],
            tags: vec!["builtin".to_string(), "file".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    /// API集成工作流模板
    fn api_integration_template() -> WorkflowTemplate {
        let now = chrono::Utc::now().timestamp();
        
        WorkflowTemplate {
            id: "builtin_api_integration".to_string(),
            name: "API集成".to_string(),
            description: Some("调用外部API并处理响应，支持认证、重试等".to_string()),
            template_type: "integration".to_string(),
            workflow: Workflow {
                id: "api_integration_workflow".to_string(),
                name: "API集成工作流".to_string(),
                description: Some("灵活的API调用和数据集成".to_string()),
                version: "1.0.0".to_string(),
                status: WorkflowStatus::Published,
                steps: vec![
                    WorkflowStep {
                        id: "prepare_request".to_string(),
                        name: "准备请求".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("准备API请求参数".to_string()),
                        config: Some(json!({
                            "auth_type": "${input.auth_type}",
                            "headers": "${input.headers}",
                            "query_params": "${input.query_params}"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("data".to_string(), json!("${input.request_data}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("request_config".to_string(), "$.output.config".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(5000),
                        depends_on: vec![],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "call_api".to_string(),
                        name: "调用API".to_string(),
                        step_type: "http".to_string(),
                        description: Some("执行HTTP请求".to_string()),
                        config: Some(json!({
                            "url": "${input.api_url}",
                            "method": "${input.method}",
                            "timeout": 30000
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("config".to_string(), json!("${steps.prepare_request.output.request_config}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("response".to_string(), "$.output.body".to_string());
                            map.insert("status_code".to_string(), "$.output.status".to_string());
                            map
                        }),
                        condition: None,
                        error_handling: None,
                        retry_count: Some(3),
                        timeout: Some(30000),
                        depends_on: vec!["prepare_request".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "parse_response".to_string(),
                        name: "解析响应".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("解析API响应数据".to_string()),
                        config: Some(json!({
                            "format": "${input.response_format}",
                            "extract_fields": "${input.extract_fields}"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("response".to_string(), json!("${steps.call_api.output.response}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("parsed_data".to_string(), "$.output.data".to_string());
                            map
                        }),
                        condition: Some("${steps.call_api.output.status_code} >= 200 && ${steps.call_api.output.status_code} < 300".to_string()),
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(10000),
                        depends_on: vec!["call_api".to_string()],
                        allow_failure: false,
                    },
                    WorkflowStep {
                        id: "handle_error".to_string(),
                        name: "处理错误".to_string(),
                        step_type: "transform".to_string(),
                        description: Some("处理API错误响应".to_string()),
                        config: Some(json!({
                            "error_mapping": "${input.error_mapping}"
                        })),
                        inputs: Some({
                            let mut map = HashMap::new();
                            map.insert("response".to_string(), json!("${steps.call_api.output.response}"));
                            map.insert("status_code".to_string(), json!("${steps.call_api.output.status_code}"));
                            map
                        }),
                        outputs: Some({
                            let mut map = HashMap::new();
                            map.insert("error_info".to_string(), "$.output.error".to_string());
                            map
                        }),
                        condition: Some("${steps.call_api.output.status_code} >= 400".to_string()),
                        error_handling: None,
                        retry_count: Some(1),
                        timeout: Some(5000),
                        depends_on: vec!["call_api".to_string()],
                        allow_failure: true,
                    },
                ],
                config: WorkflowConfig {
                    timeout: Some(120000),
                    max_concurrent: Some(1),
                    error_strategy: ErrorStrategy::Retry,
                    retry_config: Some(RetryConfig {
                        max_attempts: 3,
                        interval: 2000,
                        backoff: BackoffStrategy::Exponential,
                        retry_on: vec![
                            "network_error".to_string(),
                            "timeout".to_string(),
                            "502".to_string(),
                            "503".to_string(),
                        ],
                    }),
                    notification: None,
                    variables: Some({
                        let mut vars = HashMap::new();
                        vars.insert("api_url".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: None,
                            required: true,
                            description: Some("API地址".to_string()),
                        });
                        vars.insert("method".to_string(), VariableDefinition {
                            var_type: "string".to_string(),
                            default: Some(json!("GET")),
                            required: false,
                            description: Some("HTTP方法".to_string()),
                        });
                        vars
                    }),
                    environment: None,
                    custom: None,
                },
                trigger: None,
                tags: vec!["api".to_string(), "integration".to_string()],
                category: "integration".to_string(),
                is_template: true,
                template_id: Some("builtin_api_integration".to_string()),
                created_at: now,
                updated_at: now,
            },
            parameters: vec![
                TemplateParameter {
                    name: "api_url".to_string(),
                    param_type: "string".to_string(),
                    default: None,
                    required: true,
                    description: Some("API端点URL".to_string()),
                    validation: Some(json!({
                        "pattern": "^https?://.+"
                    })),
                },
                TemplateParameter {
                    name: "method".to_string(),
                    param_type: "string".to_string(),
                    default: Some(json!("GET")),
                    required: false,
                    description: Some("HTTP方法（GET、POST等）".to_string()),
                    validation: Some(json!({
                        "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]
                    })),
                },
                TemplateParameter {
                    name: "auth_type".to_string(),
                    param_type: "string".to_string(),
                    default: Some(json!("none")),
                    required: false,
                    description: Some("认证类型".to_string()),
                    validation: Some(json!({
                        "enum": ["none", "bearer", "basic", "api_key"]
                    })),
                },
            ],
            tags: vec!["builtin".to_string(), "api".to_string()],
            created_at: now,
            updated_at: now,
        }
    }
}


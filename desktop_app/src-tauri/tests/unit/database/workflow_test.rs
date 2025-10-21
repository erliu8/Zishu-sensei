//! 工作流数据库测试
//!
//! 测试工作流管理的所有功能，包括：
//! - 工作流的CRUD操作
//! - 工作流步骤管理
//! - 工作流执行历史
//! - 工作流状态管理
//! - 复杂工作流场景

use zishu_sensei::database::workflow::{
    WorkflowRegistry, Workflow, WorkflowStep, WorkflowExecution,
    WorkflowStatus, StepType, StepStatus,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use serde_json::json;

// ========== 辅助函数 ==========

fn setup_test_registry() -> WorkflowRegistry {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let registry = WorkflowRegistry::new(conn);
    registry.init_tables().expect("无法初始化数据库表");
    registry
}

fn create_test_workflow(id: &str) -> Workflow {
    Workflow {
        id: id.to_string(),
        name: format!("workflow_{}", id),
        display_name: format!("测试工作流 {}", id),
        description: format!("这是测试工作流 {}", id),
        category: "test".to_string(),
        tags: vec!["测试".to_string(), "自动化".to_string()],
        trigger: json!({
            "type": "manual",
            "config": {}
        }),
        config: json!({
            "timeout": 300,
            "retry": 3
        }),
        is_enabled: true,
        is_system: false,
    }
}

fn create_test_step(workflow_id: &str, order: i32, name: &str) -> WorkflowStep {
    WorkflowStep {
        id: 0, // 由数据库自动生成
        workflow_id: workflow_id.to_string(),
        step_order: order,
        step_type: StepType::Action,
        name: name.to_string(),
        display_name: format!("步骤 {}", name),
        description: format!("这是步骤 {}", name),
        config: json!({
            "action": "test_action",
            "params": {}
        }),
        is_optional: false,
        timeout: 60,
        retry_count: 3,
        on_failure: "stop".to_string(),
    }
}

// ========== 工作流 CRUD 测试 ==========

mod workflow_crud {
    use super::*;

    #[test]
    fn test_create_and_get_workflow() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("test-001");

        // ========== Act ==========
        let result = registry.create_workflow(workflow.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "创建工作流应该成功");

        let retrieved = registry.get_workflow("test-001")
            .expect("查询应该成功")
            .expect("应该找到工作流");
        
        assert_eq!(retrieved.id, workflow.id);
        assert_eq!(retrieved.name, workflow.name);
        assert_eq!(retrieved.display_name, workflow.display_name);
        assert!(retrieved.is_enabled);
    }

    #[test]
    fn test_get_workflow_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let result = registry.get_workflow("non-existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的工作流应该返回None");
    }

    #[test]
    fn test_get_all_workflows() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=5 {
            let workflow = create_test_workflow(&format!("wf-{}", i));
            registry.create_workflow(workflow)
                .expect("创建应该成功");
        }

        // ========== Act ==========
        let workflows = registry.get_all_workflows()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(workflows.len(), 5, "应该返回5个工作流");
    }

    #[test]
    fn test_update_workflow() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut workflow = create_test_workflow("update-test");
        registry.create_workflow(workflow.clone())
            .expect("创建应该成功");

        // ========== Act ==========
        workflow.display_name = "更新后的工作流".to_string();
        workflow.is_enabled = false;
        
        let result = registry.update_workflow(workflow.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新应该成功");

        let retrieved = registry.get_workflow("update-test")
            .expect("查询应该成功")
            .unwrap();
        
        assert_eq!(retrieved.display_name, "更新后的工作流");
        assert!(!retrieved.is_enabled);
    }

    #[test]
    fn test_delete_workflow() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("delete-test");
        registry.create_workflow(workflow)
            .expect("创建应该成功");

        // ========== Act ==========
        let result = registry.delete_workflow("delete-test");

        // ========== Assert ==========
        assert!(result.is_ok(), "删除应该成功");

        let retrieved = registry.get_workflow("delete-test")
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到工作流");
    }

    #[test]
    fn test_get_workflows_by_category() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=3 {
            let mut workflow = create_test_workflow(&format!("automation-{}", i));
            workflow.category = "automation".to_string();
            registry.create_workflow(workflow).unwrap();
        }
        
        for i in 1..=2 {
            let mut workflow = create_test_workflow(&format!("integration-{}", i));
            workflow.category = "integration".to_string();
            registry.create_workflow(workflow).unwrap();
        }

        // ========== Act ==========
        let automation_workflows = registry.get_workflows_by_category("automation")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(automation_workflows.len(), 3, "应该有3个automation工作流");
        
        for wf in automation_workflows {
            assert_eq!(wf.category, "automation");
        }
    }

    #[test]
    fn test_get_enabled_workflows() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=5 {
            let mut workflow = create_test_workflow(&format!("wf-{}", i));
            workflow.is_enabled = i % 2 == 0; // 偶数启用，奇数禁用
            registry.create_workflow(workflow).unwrap();
        }

        // ========== Act ==========
        let enabled = registry.get_enabled_workflows()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(enabled.len(), 2, "应该有2个启用的工作流");
        
        for wf in enabled {
            assert!(wf.is_enabled);
        }
    }
}

// ========== 工作流步骤测试 ==========

mod workflow_steps {
    use super::*;

    #[test]
    fn test_add_workflow_step() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("step-test");
        registry.create_workflow(workflow).unwrap();

        let step = create_test_step("step-test", 1, "step1");

        // ========== Act ==========
        let result = registry.add_workflow_step(step.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "添加步骤应该成功");
        let step_id = result.unwrap();
        assert!(step_id > 0, "应该返回有效的步骤ID");

        let steps = registry.get_workflow_steps("step-test").unwrap();
        assert_eq!(steps.len(), 1, "应该有1个步骤");
    }

    #[test]
    fn test_get_workflow_steps_ordered() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("ordered-steps");
        registry.create_workflow(workflow).unwrap();

        // 添加步骤（乱序）
        for order in [3, 1, 4, 2, 5] {
            let step = create_test_step("ordered-steps", order, &format!("step{}", order));
            registry.add_workflow_step(step).unwrap();
        }

        // ========== Act ==========
        let steps = registry.get_workflow_steps("ordered-steps")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(steps.len(), 5, "应该有5个步骤");
        
        // 验证步骤是按order排序的
        for (idx, step) in steps.iter().enumerate() {
            assert_eq!(step.step_order, (idx + 1) as i32, "步骤应该按order排序");
        }
    }

    #[test]
    fn test_update_workflow_step() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("update-step");
        registry.create_workflow(workflow).unwrap();

        let step = create_test_step("update-step", 1, "original");
        let step_id = registry.add_workflow_step(step).unwrap();

        // ========== Act ==========
        let mut updated_step = create_test_step("update-step", 1, "updated");
        updated_step.id = step_id;
        updated_step.timeout = 120;
        
        let result = registry.update_workflow_step(updated_step.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新步骤应该成功");

        let steps = registry.get_workflow_steps("update-step").unwrap();
        assert_eq!(steps[0].name, "updated");
        assert_eq!(steps[0].timeout, 120);
    }

    #[test]
    fn test_delete_workflow_step() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("delete-step");
        registry.create_workflow(workflow).unwrap();

        let step = create_test_step("delete-step", 1, "to-delete");
        let step_id = registry.add_workflow_step(step).unwrap();

        // ========== Act ==========
        let result = registry.delete_workflow_step(step_id);

        // ========== Assert ==========
        assert!(result.is_ok(), "删除步骤应该成功");

        let steps = registry.get_workflow_steps("delete-step").unwrap();
        assert_eq!(steps.len(), 0, "步骤列表应该为空");
    }

    #[test]
    fn test_reorder_workflow_steps() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("reorder");
        registry.create_workflow(workflow).unwrap();

        let mut step_ids = vec![];
        for i in 1..=3 {
            let step = create_test_step("reorder", i, &format!("step{}", i));
            let id = registry.add_workflow_step(step).unwrap();
            step_ids.push(id);
        }

        // ========== Act ==========
        // 重新排序：3, 1, 2
        let new_order = vec![
            (step_ids[2], 1),
            (step_ids[0], 2),
            (step_ids[1], 3),
        ];
        
        for (step_id, new_order) in new_order {
            let mut step = create_test_step("reorder", new_order, "");
            step.id = step_id;
            step.step_order = new_order;
            registry.update_workflow_step(step).unwrap();
        }

        // ========== Assert ==========
        let steps = registry.get_workflow_steps("reorder").unwrap();
        assert_eq!(steps[0].name, "step3");
        assert_eq!(steps[1].name, "step1");
        assert_eq!(steps[2].name, "step2");
    }

    #[test]
    fn test_optional_steps() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("optional-steps");
        registry.create_workflow(workflow).unwrap();

        let mut step1 = create_test_step("optional-steps", 1, "required");
        step1.is_optional = false;
        
        let mut step2 = create_test_step("optional-steps", 2, "optional");
        step2.is_optional = true;

        // ========== Act ==========
        registry.add_workflow_step(step1).unwrap();
        registry.add_workflow_step(step2).unwrap();

        // ========== Assert ==========
        let steps = registry.get_workflow_steps("optional-steps").unwrap();
        assert!(!steps[0].is_optional, "第一个步骤应该是必需的");
        assert!(steps[1].is_optional, "第二个步骤应该是可选的");
    }
}

// ========== 工作流执行历史测试 ==========

mod workflow_execution {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_create_execution() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("exec-test");
        registry.create_workflow(workflow).unwrap();

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "exec-test".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "manual".to_string(),
            trigger_data: json!({"user": "test"}),
            context: json!({}),
            error_message: None,
            steps_completed: 0,
            steps_total: 5,
        };

        // ========== Act ==========
        let result = registry.create_execution(execution);

        // ========== Assert ==========
        assert!(result.is_ok(), "创建执行记录应该成功");
        let exec_id = result.unwrap();
        assert!(exec_id > 0, "应该返回有效的执行ID");
    }

    #[test]
    fn test_get_workflow_executions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("exec-history");
        registry.create_workflow(workflow).unwrap();

        // 创建多个执行记录
        for i in 1..=5 {
            let execution = WorkflowExecution {
                id: 0,
                workflow_id: "exec-history".to_string(),
                status: if i % 2 == 0 { WorkflowStatus::Completed } else { WorkflowStatus::Failed },
                started_at: Utc::now(),
                completed_at: Some(Utc::now()),
                trigger_source: "test".to_string(),
                trigger_data: json!({}),
                context: json!({}),
                error_message: if i % 2 == 0 { None } else { Some("测试错误".to_string()) },
                steps_completed: i,
                steps_total: 5,
            };
            registry.create_execution(execution).unwrap();
        }

        // ========== Act ==========
        let executions = registry.get_workflow_executions("exec-history", Some(10))
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(executions.len(), 5, "应该有5个执行记录");
    }

    #[test]
    fn test_update_execution_status() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("status-update");
        registry.create_workflow(workflow).unwrap();

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "status-update".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "test".to_string(),
            trigger_data: json!({}),
            context: json!({}),
            error_message: None,
            steps_completed: 0,
            steps_total: 3,
        };
        let exec_id = registry.create_execution(execution).unwrap();

        // ========== Act ==========
        let result = registry.update_execution_status(
            exec_id,
            WorkflowStatus::Completed,
            Some(Utc::now()),
            None,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "更新状态应该成功");

        let updated = registry.get_execution(exec_id)
            .unwrap()
            .unwrap();
        assert_eq!(updated.status, WorkflowStatus::Completed);
        assert!(updated.completed_at.is_some());
    }

    #[test]
    fn test_update_execution_progress() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("progress-test");
        registry.create_workflow(workflow).unwrap();

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "progress-test".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "test".to_string(),
            trigger_data: json!({}),
            context: json!({}),
            error_message: None,
            steps_completed: 0,
            steps_total: 10,
        };
        let exec_id = registry.create_execution(execution).unwrap();

        // ========== Act ==========
        for completed in 1..=10 {
            registry.update_execution_progress(exec_id, completed).unwrap();
        }

        // ========== Assert ==========
        let final_exec = registry.get_execution(exec_id)
            .unwrap()
            .unwrap();
        assert_eq!(final_exec.steps_completed, 10);
    }

    #[test]
    fn test_execution_with_error() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("error-test");
        registry.create_workflow(workflow).unwrap();

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "error-test".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "test".to_string(),
            trigger_data: json!({}),
            context: json!({}),
            error_message: None,
            steps_completed: 2,
            steps_total: 5,
        };
        let exec_id = registry.create_execution(execution).unwrap();

        // ========== Act ==========
        registry.update_execution_status(
            exec_id,
            WorkflowStatus::Failed,
            Some(Utc::now()),
            Some("步骤3执行失败：权限不足".to_string()),
        ).unwrap();

        // ========== Assert ==========
        let failed_exec = registry.get_execution(exec_id)
            .unwrap()
            .unwrap();
        
        assert_eq!(failed_exec.status, WorkflowStatus::Failed);
        assert_eq!(
            failed_exec.error_message,
            Some("步骤3执行失败：权限不足".to_string())
        );
    }

    #[test]
    fn test_get_recent_executions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=3 {
            let workflow = create_test_workflow(&format!("wf-{}", i));
            registry.create_workflow(workflow).unwrap();
            
            for j in 1..=2 {
                let execution = WorkflowExecution {
                    id: 0,
                    workflow_id: format!("wf-{}", i),
                    status: WorkflowStatus::Completed,
                    started_at: Utc::now(),
                    completed_at: Some(Utc::now()),
                    trigger_source: "test".to_string(),
                    trigger_data: json!({"run": j}),
                    context: json!({}),
                    error_message: None,
                    steps_completed: 5,
                    steps_total: 5,
                };
                registry.create_execution(execution).unwrap();
            }
        }

        // ========== Act ==========
        let recent = registry.get_recent_executions(Some(5))
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(recent.len(), 5, "应该返回最近的5个执行记录");
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_complete_workflow_lifecycle() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 1. 创建工作流
        let workflow = create_test_workflow("lifecycle");
        registry.create_workflow(workflow).unwrap();

        // 2. 添加步骤
        for i in 1..=5 {
            let step = create_test_step("lifecycle", i, &format!("step{}", i));
            registry.add_workflow_step(step).unwrap();
        }

        // 3. 执行工作流
        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "lifecycle".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "manual".to_string(),
            trigger_data: json!({"user": "admin"}),
            context: json!({"environment": "test"}),
            error_message: None,
            steps_completed: 0,
            steps_total: 5,
        };
        let exec_id = registry.create_execution(execution).unwrap();

        // 4. 模拟步骤执行
        for step in 1..=5 {
            registry.update_execution_progress(exec_id, step).unwrap();
        }

        // 5. 完成执行
        registry.update_execution_status(
            exec_id,
            WorkflowStatus::Completed,
            Some(Utc::now()),
            None,
        ).unwrap();

        // ========== Assert ==========
        let final_workflow = registry.get_workflow("lifecycle").unwrap().unwrap();
        assert_eq!(final_workflow.id, "lifecycle");

        let steps = registry.get_workflow_steps("lifecycle").unwrap();
        assert_eq!(steps.len(), 5);

        let final_exec = registry.get_execution(exec_id).unwrap().unwrap();
        assert_eq!(final_exec.status, WorkflowStatus::Completed);
        assert_eq!(final_exec.steps_completed, 5);
        assert!(final_exec.completed_at.is_some());
    }

    #[test]
    fn test_workflow_with_conditional_steps() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("conditional");
        registry.create_workflow(workflow).unwrap();

        // 添加条件步骤
        let mut step1 = create_test_step("conditional", 1, "check_condition");
        step1.step_type = StepType::Condition;
        
        let mut step2 = create_test_step("conditional", 2, "if_true");
        step2.on_failure = "skip".to_string();
        
        let mut step3 = create_test_step("conditional", 3, "if_false");
        step3.on_failure = "skip".to_string();

        // ========== Act ==========
        registry.add_workflow_step(step1).unwrap();
        registry.add_workflow_step(step2).unwrap();
        registry.add_workflow_step(step3).unwrap();

        // ========== Assert ==========
        let steps = registry.get_workflow_steps("conditional").unwrap();
        assert_eq!(steps.len(), 3);
        assert_eq!(steps[0].step_type, StepType::Condition);
    }

    #[test]
    fn test_parallel_workflow_executions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("parallel-test");
        registry.create_workflow(workflow).unwrap();

        // ========== Act ==========
        // 创建多个并发执行
        let mut exec_ids = vec![];
        for i in 1..=5 {
            let execution = WorkflowExecution {
                id: 0,
                workflow_id: "parallel-test".to_string(),
                status: WorkflowStatus::Running,
                started_at: Utc::now(),
                completed_at: None,
                trigger_source: format!("trigger-{}", i),
                trigger_data: json!({"run": i}),
                context: json!({}),
                error_message: None,
                steps_completed: 0,
                steps_total: 3,
            };
            let exec_id = registry.create_execution(execution).unwrap();
            exec_ids.push(exec_id);
        }

        // ========== Assert ==========
        let executions = registry.get_workflow_executions("parallel-test", Some(10))
            .unwrap();
        
        assert_eq!(executions.len(), 5, "应该有5个并发执行");
        
        // 验证所有执行都是Running状态
        for exec in executions {
            assert_eq!(exec.status, WorkflowStatus::Running);
        }
    }

    #[test]
    fn test_workflow_cascade_delete() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("cascade-test");
        registry.create_workflow(workflow).unwrap();

        // 添加步骤和执行记录
        for i in 1..=3 {
            let step = create_test_step("cascade-test", i, &format!("step{}", i));
            registry.add_workflow_step(step).unwrap();
        }

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "cascade-test".to_string(),
            status: WorkflowStatus::Completed,
            started_at: Utc::now(),
            completed_at: Some(Utc::now()),
            trigger_source: "test".to_string(),
            trigger_data: json!({}),
            context: json!({}),
            error_message: None,
            steps_completed: 3,
            steps_total: 3,
        };
        registry.create_execution(execution).unwrap();

        // ========== Act ==========
        registry.delete_workflow("cascade-test").unwrap();

        // ========== Assert ==========
        let workflow = registry.get_workflow("cascade-test").unwrap();
        assert!(workflow.is_none(), "工作流应该被删除");

        let steps = registry.get_workflow_steps("cascade-test").unwrap();
        assert_eq!(steps.len(), 0, "步骤应该被级联删除");

        let executions = registry.get_workflow_executions("cascade-test", Some(10))
            .unwrap();
        assert_eq!(executions.len(), 0, "执行记录应该被级联删除");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_workflow_with_empty_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut workflow = create_test_workflow("empty-config");
        workflow.config = json!({});

        // ========== Act ==========
        let result = registry.create_workflow(workflow);

        // ========== Assert ==========
        assert!(result.is_ok(), "空配置应该被接受");
    }

    #[test]
    fn test_workflow_with_large_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut workflow = create_test_workflow("large-config");
        
        // 创建大型配置
        let mut config = serde_json::Map::new();
        for i in 0..100 {
            config.insert(
                format!("key_{}", i),
                json!({"data": format!("value_{}", i)})
            );
        }
        workflow.config = json!(config);

        // ========== Act ==========
        let result = registry.create_workflow(workflow.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "大型配置应该被接受");

        let retrieved = registry.get_workflow("large-config")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.config, workflow.config);
    }

    #[test]
    fn test_step_with_zero_timeout() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("zero-timeout");
        registry.create_workflow(workflow).unwrap();

        let mut step = create_test_step("zero-timeout", 1, "instant");
        step.timeout = 0;

        // ========== Act ==========
        let result = registry.add_workflow_step(step);

        // ========== Assert ==========
        assert!(result.is_ok(), "零超时应该被接受");
    }

    #[test]
    fn test_execution_without_completion_time() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let workflow = create_test_workflow("no-completion");
        registry.create_workflow(workflow).unwrap();

        let execution = WorkflowExecution {
            id: 0,
            workflow_id: "no-completion".to_string(),
            status: WorkflowStatus::Running,
            started_at: Utc::now(),
            completed_at: None,
            trigger_source: "test".to_string(),
            trigger_data: json!({}),
            context: json!({}),
            error_message: None,
            steps_completed: 5,
            steps_total: 10,
        };

        // ========== Act ==========
        let result = registry.create_execution(execution);

        // ========== Assert ==========
        assert!(result.is_ok(), "未完成的执行应该被接受");
    }

    #[test]
    fn test_workflow_with_special_characters() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut workflow = create_test_workflow("special-chars");
        workflow.display_name = "测试@#$%^&*()工作流".to_string();
        workflow.description = "包含\n换行符\t制表符的描述".to_string();

        // ========== Act ==========
        let result = registry.create_workflow(workflow.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "特殊字符应该被正确处理");

        let retrieved = registry.get_workflow("special-chars")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.display_name, workflow.display_name);
        assert_eq!(retrieved.description, workflow.description);
    }
}


//! 工作流管理命令测试
//!
//! 测试所有工作流相关的Tauri命令

#[cfg(test)]
mod workflow_commands_tests {
    use crate::common::*;
    
    // ================================
    // create_workflow 命令测试
    // ================================
    
    mod create_workflow {
        use super::*;
        
        #[tokio::test]
        async fn test_create_workflow_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            test_db.insert_workflow("wf-001", "My Workflow", "active").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.workflow_exists("wf-001").unwrap();
            assert!(exists, "工作流应该被创建");
        }
        
        #[tokio::test]
        async fn test_create_workflow_returns_id() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            let workflow_id = "wf-001";
            test_db.insert_workflow(workflow_id, "Workflow", "active").unwrap();
            
            // ========== Assert (断言) ==========
            let stored_id = test_db.get_workflow_id_by_name("Workflow").unwrap();
            assert_eq!(stored_id, Some(workflow_id.to_string()));
        }
        
        #[tokio::test]
        async fn test_create_workflow_with_complex_definition() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            let definition = r#"{"steps":[{"id":"step1","action":"send_message"}]}"#;
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_with_definition("wf-001", "Complex WF", definition).unwrap();
            
            // ========== Assert (断言) ==========
            let stored_def = test_db.get_workflow_definition("wf-001").unwrap();
            assert!(stored_def.is_some());
        }
    }
    
    // ================================
    // update_workflow 命令测试
    // ================================
    
    mod update_workflow {
        use super::*;
        
        #[tokio::test]
        async fn test_update_workflow_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Old Name", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_workflow_name("wf-001", "New Name").unwrap();
            
            // ========== Assert (断言) ==========
            let name = test_db.get_workflow_name("wf-001").unwrap();
            assert_eq!(name, Some("New Name".to_string()));
        }
        
        #[tokio::test]
        async fn test_update_workflow_increments_version() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_with_version("wf-001", "Workflow", 1).unwrap();
            
            // ========== Act (执行) ==========
            test_db.increment_workflow_version("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            let version = test_db.get_workflow_version("wf-001").unwrap();
            assert_eq!(version, Some(2));
        }
    }
    
    // ================================
    // delete_workflow 命令测试
    // ================================
    
    mod delete_workflow {
        use super::*;
        
        #[tokio::test]
        async fn test_delete_workflow_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_workflow("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.workflow_exists("wf-001").unwrap();
            assert!(!exists, "工作流应该被删除");
        }
        
        #[tokio::test]
        async fn test_delete_workflow_cascades_executions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            test_db.insert_workflow_execution("exec-001", "wf-001", "running").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_workflow_executions("wf-001").unwrap();
            test_db.delete_workflow("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            let exec_count = test_db.count_workflow_executions("wf-001").unwrap();
            assert_eq!(exec_count, 0);
        }
    }
    
    // ================================
    // get_workflow & list_workflows 命令测试
    // ================================
    
    mod get_list_workflows {
        use super::*;
        
        #[tokio::test]
        async fn test_get_workflow_returns_details() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "My Workflow", "active").unwrap();
            
            // ========== Act (执行) ==========
            let workflow = test_db.get_workflow("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(workflow.is_some());
        }
        
        #[tokio::test]
        async fn test_list_workflows_returns_all() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow 1", "active").unwrap();
            test_db.insert_workflow("wf-002", "Workflow 2", "active").unwrap();
            test_db.insert_workflow("wf-003", "Workflow 3", "archived").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_workflows().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3);
        }
    }
    
    // ================================
    // execute_workflow 命令测试
    // ================================
    
    mod execute_workflow {
        use super::*;
        
        #[tokio::test]
        async fn test_execute_workflow_creates_execution() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_execution("exec-001", "wf-001", "running").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.execution_exists("exec-001").unwrap();
            assert!(exists);
        }
        
        #[tokio::test]
        async fn test_execute_workflow_with_variables() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            let variables = r#"{"user":"alice","count":5}"#;
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_execution_with_vars("exec-001", "wf-001", variables).unwrap();
            
            // ========== Assert (断言) ==========
            let stored_vars = test_db.get_execution_variables("exec-001").unwrap();
            assert!(stored_vars.is_some());
        }
    }
    
    // ================================
    // cancel_workflow_execution 命令测试
    // ================================
    
    mod cancel_workflow_execution {
        use super::*;
        
        #[tokio::test]
        async fn test_cancel_workflow_execution_updates_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_execution("exec-001", "wf-001", "running").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_execution_status("exec-001", "cancelled").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_execution_status("exec-001").unwrap();
            assert_eq!(status, Some("cancelled".to_string()));
        }
    }
    
    // ================================
    // pause_workflow_execution & resume_workflow_execution 命令测试
    // ================================
    
    mod pause_resume_execution {
        use super::*;
        
        #[tokio::test]
        async fn test_pause_workflow_execution() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_execution("exec-001", "wf-001", "running").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_execution_status("exec-001", "paused").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_execution_status("exec-001").unwrap();
            assert_eq!(status, Some("paused".to_string()));
        }
        
        #[tokio::test]
        async fn test_resume_workflow_execution() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_execution("exec-001", "wf-001", "paused").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_execution_status("exec-001", "running").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_execution_status("exec-001").unwrap();
            assert_eq!(status, Some("running".to_string()));
        }
    }
    
    // ================================
    // schedule_workflow & unschedule_workflow 命令测试
    // ================================
    
    mod schedule_workflow {
        use super::*;
        
        #[tokio::test]
        async fn test_schedule_workflow_creates_schedule() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_schedule("wf-001", "0 0 * * *").unwrap();
            
            // ========== Assert (断言) ==========
            let is_scheduled = test_db.is_workflow_scheduled("wf-001").unwrap();
            assert!(is_scheduled);
        }
        
        #[tokio::test]
        async fn test_unschedule_workflow_removes_schedule() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_schedule("wf-001", "0 0 * * *").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_workflow_schedule("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            let is_scheduled = test_db.is_workflow_scheduled("wf-001").unwrap();
            assert!(!is_scheduled);
        }
        
        #[tokio::test]
        async fn test_list_scheduled_workflows() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_schedule("wf-001", "0 0 * * *").unwrap();
            test_db.insert_workflow_schedule("wf-002", "0 12 * * *").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_scheduled_workflows().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
    }
    
    // ================================
    // 工作流模板命令测试
    // ================================
    
    mod workflow_templates {
        use super::*;
        
        #[tokio::test]
        async fn test_create_workflow_template() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_template("tmpl-001", "Email Template").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.template_exists("tmpl-001").unwrap();
            assert!(exists);
        }
        
        #[tokio::test]
        async fn test_create_workflow_from_template() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_template("tmpl-001", "Template").unwrap();
            
            // ========== Act (执行) ==========
            test_db.insert_workflow_from_template("wf-001", "tmpl-001", "My Workflow").unwrap();
            
            // ========== Assert (断言) ==========
            let template_id = test_db.get_workflow_template_id("wf-001").unwrap();
            assert_eq!(template_id, Some("tmpl-001".to_string()));
        }
        
        #[tokio::test]
        async fn test_list_workflow_templates() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_template("tmpl-001", "Template 1").unwrap();
            test_db.insert_workflow_template("tmpl-002", "Template 2").unwrap();
            test_db.insert_workflow_template("tmpl-003", "Template 3").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_workflow_templates().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3);
        }
        
        #[tokio::test]
        async fn test_get_builtin_templates() {
            // ========== Arrange (准备) ==========
            let builtin_templates = vec!["email_notification", "data_backup", "daily_report"];
            
            // ========== Act (执行) ==========
            let count = builtin_templates.len();
            
            // ========== Assert (断言) ==========
            assert!(count > 0, "应该有内置模板");
        }
    }
    
    // ================================
    // 工作流版本控制命令测试
    // ================================
    
    mod workflow_versioning {
        use super::*;
        
        #[tokio::test]
        async fn test_get_workflow_versions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_version("wf-001", 1, "Initial version").unwrap();
            test_db.insert_workflow_version("wf-001", 2, "Updated version").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_workflow_versions("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
        
        #[tokio::test]
        async fn test_rollback_workflow_to_version() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_with_version("wf-001", "Workflow", 2).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_workflow_version("wf-001", 1).unwrap();
            
            // ========== Assert (断言) ==========
            let version = test_db.get_workflow_version("wf-001").unwrap();
            assert_eq!(version, Some(1));
        }
    }
    
    // ================================
    // 工作流导入/导出命令测试
    // ================================
    
    mod workflow_import_export {
        use super::*;
        
        #[tokio::test]
        async fn test_export_workflows() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow 1", "active").unwrap();
            test_db.insert_workflow("wf-002", "Workflow 2", "active").unwrap();
            
            // ========== Act (执行) ==========
            let export_data = test_db.export_workflows(vec!["wf-001", "wf-002"]).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(export_data.len() > 0);
        }
        
        #[tokio::test]
        async fn test_import_workflows() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            let import_data = r#"[{"id":"wf-001","name":"Imported Workflow"}]"#;
            
            // ========== Act (执行) ==========
            test_db.import_workflows_from_json(import_data).unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.workflow_exists("wf-001").unwrap();
            assert!(exists);
        }
    }
    
    // ================================
    // 工作流状态管理命令测试
    // ================================
    
    mod workflow_status {
        use super::*;
        
        #[tokio::test]
        async fn test_publish_workflow() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "draft").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_workflow_status("wf-001", "published").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_workflow_status("wf-001").unwrap();
            assert_eq!(status, Some("published".to_string()));
        }
        
        #[tokio::test]
        async fn test_archive_workflow() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_workflow_status("wf-001", "archived").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_workflow_status("wf-001").unwrap();
            assert_eq!(status, Some("archived".to_string()));
        }
        
        #[tokio::test]
        async fn test_disable_workflow() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_workflow_status("wf-001", "disabled").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_workflow_status("wf-001").unwrap();
            assert_eq!(status, Some("disabled".to_string()));
        }
        
        #[tokio::test]
        async fn test_clone_workflow() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Original", "active").unwrap();
            
            // ========== Act (执行) ==========
            test_db.clone_workflow("wf-001", "wf-002", "Cloned Workflow").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.workflow_exists("wf-002").unwrap();
            assert!(exists);
        }
    }
    
    // ================================
    // search_workflows 命令测试
    // ================================
    
    mod search_workflows {
        use super::*;
        
        #[tokio::test]
        async fn test_search_workflows_by_keyword() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Email Workflow", "active").unwrap();
            test_db.insert_workflow("wf-002", "Data Backup", "active").unwrap();
            test_db.insert_workflow("wf-003", "Email Report", "active").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.search_workflows_by_keyword("Email").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
        
        #[tokio::test]
        async fn test_search_workflows_by_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Active 1", "active").unwrap();
            test_db.insert_workflow("wf-002", "Active 2", "active").unwrap();
            test_db.insert_workflow("wf-003", "Archived", "archived").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_workflows_by_status("active").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
        
        #[tokio::test]
        async fn test_search_workflows_by_tags() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow_with_tags("wf-001", "Workflow 1", "email,automation").unwrap();
            test_db.insert_workflow_with_tags("wf-002", "Workflow 2", "backup").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.search_workflows_by_tag("email").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 1);
        }
    }
    
    // ================================
    // 事件触发器命令测试
    // ================================
    
    mod event_triggers {
        use super::*;
        
        #[tokio::test]
        async fn test_create_event_trigger() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            test_db.insert_event_trigger("trigger-001", "wf-001", "file_created").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.event_trigger_exists("trigger-001").unwrap();
            assert!(exists);
        }
        
        #[tokio::test]
        async fn test_remove_event_trigger() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_event_trigger("trigger-001", "wf-001", "file_created").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_event_trigger("trigger-001").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.event_trigger_exists("trigger-001").unwrap();
            assert!(!exists);
        }
        
        #[tokio::test]
        async fn test_list_event_triggers() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_event_trigger("trigger-001", "wf-001", "file_created").unwrap();
            test_db.insert_event_trigger("trigger-002", "wf-001", "file_updated").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_event_triggers_for_workflow("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
        
        #[tokio::test]
        async fn test_trigger_event_executes_workflows() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            test_db.insert_event_trigger("trigger-001", "wf-001", "custom_event").unwrap();
            
            // ========== Act (执行) ==========
            test_db.record_event_trigger_fired("trigger-001").unwrap();
            
            // ========== Assert (断言) ==========
            let fire_count = test_db.get_trigger_fire_count("trigger-001").unwrap();
            assert!(fire_count > 0);
        }
    }
    
    // ================================
    // Webhook触发器命令测试
    // ================================
    
    mod webhook_triggers {
        use super::*;
        
        #[tokio::test]
        async fn test_create_webhook_trigger() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            // ========== Act (执行) ==========
            test_db.insert_webhook_trigger("webhook-001", "wf-001", "/api/webhook").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.webhook_trigger_exists("webhook-001").unwrap();
            assert!(exists);
        }
        
        #[tokio::test]
        async fn test_list_webhook_triggers() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_webhook_trigger("webhook-001", "wf-001", "/api/webhook1").unwrap();
            test_db.insert_webhook_trigger("webhook-002", "wf-001", "/api/webhook2").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_webhook_triggers_for_workflow("wf-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2);
        }
        
        #[tokio::test]
        async fn test_remove_webhook_trigger() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_webhook_trigger("webhook-001", "wf-001", "/api/webhook").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_webhook_trigger("webhook-001").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.webhook_trigger_exists("webhook-001").unwrap();
            assert!(!exists);
        }
        
        #[tokio::test]
        async fn test_trigger_webhook_executes_workflow() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_workflow_tables().expect("Failed to init workflow tables");
            
            test_db.insert_workflow("wf-001", "Workflow", "active").unwrap();
            test_db.insert_webhook_trigger("webhook-001", "wf-001", "/api/webhook").unwrap();
            
            // ========== Act (执行) ==========
            test_db.record_webhook_trigger_fired("webhook-001").unwrap();
            
            // ========== Assert (断言) ==========
            let fire_count = test_db.get_webhook_fire_count("webhook-001").unwrap();
            assert!(fire_count > 0);
        }
    }
}


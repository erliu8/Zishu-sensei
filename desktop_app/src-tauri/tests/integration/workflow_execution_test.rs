//! 工作流执行集成测试
//!
//! 测试工作流的定义、触发、执行、监控的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 工作流执行测试
// ========================================

/// 测试完整的工作流执行流程
/// 流程: 定义工作流 → 保存 → 触发 → 执行 → 记录结果
#[tokio::test]
async fn test_complete_workflow_execution() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 定义工作流
    let workflow_definition = json!({
        "name": "Test Workflow",
        "trigger": {
            "type": "manual"
        },
        "steps": [
            {
                "id": "step1",
                "action": "log",
                "params": {"message": "Step 1 executed"}
            },
            {
                "id": "step2",
                "action": "compute",
                "params": {"formula": "1 + 1"}
            },
            {
                "id": "step3",
                "action": "notify",
                "params": {"message": "Workflow completed"}
            }
        ]
    });
    
    conn.execute(
        "INSERT INTO workflows (id, name, description, version, enabled, definition, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            &workflow_id,
            "Test Workflow",
            "A test workflow for integration testing",
            "1.0.0",
            1,
            workflow_definition.to_string(),
            now,
            now
        ]
    ).unwrap();
    
    // 验证工作流已创建
    assert!(test_db.record_exists("workflows", "id", &workflow_id).unwrap());
    
    // 2. 触发工作流执行
    let execution_id = unique_test_id("execution");
    let input_data = json!({"user": "test_user", "action": "test"});
    
    conn.execute(
        "INSERT INTO workflow_executions (id, workflow_id, status, input, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            &execution_id,
            &workflow_id,
            "running",
            input_data.to_string(),
            now + 1
        ]
    ).unwrap();
    
    // 3. 模拟执行过程（更新状态）
    wait_ms(10).await; // 模拟执行时间
    
    let output_data = json!({
        "results": {
            "step1": "success",
            "step2": {"result": 2},
            "step3": "notified"
        }
    });
    
    conn.execute(
        "UPDATE workflow_executions 
         SET status = ?1, output = ?2, completed_at = ?3 
         WHERE id = ?4",
        rusqlite::params![
            "completed",
            output_data.to_string(),
            now + 2,
            &execution_id
        ]
    ).unwrap();
    
    // 4. 验证执行结果
    let (status, output, started, completed): (String, String, i64, Option<i64>) = conn.query_row(
        "SELECT status, output, started_at, completed_at FROM workflow_executions WHERE id = ?1",
        &[&execution_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    ).unwrap();
    
    assert_eq!(status, "completed");
    assert!(output.contains("step1"));
    assert!(completed.is_some());
    assert!(completed.unwrap() > started);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流失败处理
#[tokio::test]
async fn test_workflow_failure_handling() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 创建工作流
    test_db.insert_test_workflow(&workflow_id, "Failing Workflow", true).unwrap();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 触发执行
    let execution_id = unique_test_id("execution");
    
    conn.execute(
        "INSERT INTO workflow_executions (id, workflow_id, status, started_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&execution_id, &workflow_id, "running", now]
    ).unwrap();
    
    // 2. 模拟执行失败
    let error_message = json!({
        "error": "Step2 failed: Invalid input",
        "step": "step2",
        "timestamp": now + 1
    });
    
    conn.execute(
        "UPDATE workflow_executions 
         SET status = ?1, error = ?2, completed_at = ?3 
         WHERE id = ?4",
        rusqlite::params![
            "failed",
            error_message.to_string(),
            now + 1,
            &execution_id
        ]
    ).unwrap();
    
    // 3. 验证失败状态
    let (status, error): (String, Option<String>) = conn.query_row(
        "SELECT status, error FROM workflow_executions WHERE id = ?1",
        &[&execution_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    
    assert_eq!(status, "failed");
    assert!(error.is_some());
    
    let error_json: serde_json::Value = serde_json::from_str(&error.unwrap()).unwrap();
    assert_eq!(error_json["step"], "step2");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试并发工作流执行
#[tokio::test]
async fn test_concurrent_workflow_executions() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    test_db.insert_test_workflow(&workflow_id, "Concurrent Workflow", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act (执行) ==========
    
    // 创建多个并发执行
    let execution_count = 5;
    let mut execution_ids = Vec::new();
    
    for i in 0..execution_count {
        let execution_id = unique_test_id(&format!("execution_{}", i));
        execution_ids.push(execution_id.clone());
        
        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![&execution_id, &workflow_id, "running", now + i as i64]
        ).unwrap();
    }
    
    // 模拟异步完成
    for (i, execution_id) in execution_ids.iter().enumerate() {
        let status = if i % 2 == 0 { "completed" } else { "failed" };
        
        conn.execute(
            "UPDATE workflow_executions SET status = ?1, completed_at = ?2 WHERE id = ?3",
            rusqlite::params![status, now + 10 + i as i64, execution_id]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证总执行数
    let total_executions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_executions, execution_count as i64);
    
    // 统计成功和失败数量
    let completed_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1 AND status = 'completed'",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    
    let failed_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1 AND status = 'failed'",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(completed_count, 3); // 0, 2, 4
    assert_eq!(failed_count, 2);    // 1, 3
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流版本管理
#[tokio::test]
async fn test_workflow_versioning() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建 v1.0.0
    let definition_v1 = json!({"steps": ["step1", "step2"]});
    
    conn.execute(
        "INSERT INTO workflows (id, name, version, enabled, definition, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            &workflow_id,
            "Versioned Workflow",
            "1.0.0",
            1,
            definition_v1.to_string(),
            now,
            now
        ]
    ).unwrap();
    
    // 2. 更新到 v1.1.0
    let definition_v1_1 = json!({"steps": ["step1", "step2", "step3"]});
    
    conn.execute(
        "UPDATE workflows SET version = ?1, definition = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![
            "1.1.0",
            definition_v1_1.to_string(),
            now + 1,
            &workflow_id
        ]
    ).unwrap();
    
    // 验证版本已更新
    let (current_version, definition): (String, String) = conn.query_row(
        "SELECT version, definition FROM workflows WHERE id = ?1",
        &[&workflow_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    
    assert_eq!(current_version, "1.1.0");
    
    let def_json: serde_json::Value = serde_json::from_str(&definition).unwrap();
    assert_eq!(def_json["steps"].as_array().unwrap().len(), 3);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流启用/禁用
#[tokio::test]
async fn test_workflow_enable_disable() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    test_db.insert_test_workflow(&workflow_id, "Toggle Workflow", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 验证初始启用状态
    let enabled: i32 = conn.query_row(
        "SELECT enabled FROM workflows WHERE id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(enabled, 1);
    
    // 2. 禁用工作流
    conn.execute(
        "UPDATE workflows SET enabled = 0 WHERE id = ?1",
        &[&workflow_id]
    ).unwrap();
    
    let disabled: i32 = conn.query_row(
        "SELECT enabled FROM workflows WHERE id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(disabled, 0);
    
    // 3. 尝试执行被禁用的工作流（应该被拒绝）
    let is_enabled: bool = conn.query_row(
        "SELECT enabled FROM workflows WHERE id = ?1",
        &[&workflow_id],
        |row| row.get::<_, i32>(0).map(|v| v == 1)
    ).unwrap();
    
    if !is_enabled {
        // 在实际应用中，这里会阻止执行
        // 我们只是验证状态
    }
    
    // 4. 重新启用
    conn.execute(
        "UPDATE workflows SET enabled = 1 WHERE id = ?1",
        &[&workflow_id]
    ).unwrap();
    
    let re_enabled: i32 = conn.query_row(
        "SELECT enabled FROM workflows WHERE id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(re_enabled, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流执行历史查询
#[tokio::test]
async fn test_workflow_execution_history() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    test_db.insert_test_workflow(&workflow_id, "History Workflow", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 创建多次执行历史
    for i in 0..10 {
        let execution_id = unique_test_id(&format!("exec_{}", i));
        let status = if i < 7 { "completed" } else if i < 9 { "failed" } else { "running" };
        
        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                &execution_id,
                &workflow_id,
                status,
                now + i as i64,
                if status == "running" { None } else { Some(now + i as i64 + 5) }
            ]
        ).unwrap();
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 查询所有执行历史
    let total_executions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_executions, 10);
    
    // 2. 按状态统计
    let completed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1 AND status = 'completed'",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(completed, 7);
    
    let failed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1 AND status = 'failed'",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(failed, 2);
    
    // 3. 查询最近5次执行
    let mut stmt = conn.prepare(
        "SELECT id, status FROM workflow_executions 
         WHERE workflow_id = ?1 
         ORDER BY started_at DESC 
         LIMIT 5"
    ).unwrap();
    
    let recent: Vec<(String, String)> = stmt.query_map(&[&workflow_id], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(recent.len(), 5);
    
    // 4. 计算成功率
    let success_rate = (completed as f64 / (completed + failed) as f64) * 100.0;
    assert!(success_rate > 70.0);
    
    // 5. 查询正在运行的执行
    let running: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1 AND status = 'running'",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(running, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流输入输出传递
#[tokio::test]
async fn test_workflow_input_output_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    test_db.insert_test_workflow(&workflow_id, "IO Workflow", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 准备输入数据
    let input = json!({
        "user_id": "user_123",
        "action": "process_data",
        "parameters": {
            "value": 42,
            "mode": "fast"
        }
    });
    
    let execution_id = unique_test_id("execution");
    
    conn.execute(
        "INSERT INTO workflow_executions (id, workflow_id, status, input, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            &execution_id,
            &workflow_id,
            "running",
            input.to_string(),
            now
        ]
    ).unwrap();
    
    // 2. 模拟处理并生成输出
    let output = json!({
        "status": "success",
        "result": {
            "processed_value": 84,
            "processing_time_ms": 150,
            "mode_used": "fast"
        },
        "metadata": {
            "execution_id": execution_id,
            "timestamp": now + 1
        }
    });
    
    conn.execute(
        "UPDATE workflow_executions SET status = ?1, output = ?2, completed_at = ?3 WHERE id = ?4",
        rusqlite::params![
            "completed",
            output.to_string(),
            now + 1,
            &execution_id
        ]
    ).unwrap();
    
    // 3. 验证输入输出数据
    let (stored_input, stored_output): (String, Option<String>) = conn.query_row(
        "SELECT input, output FROM workflow_executions WHERE id = ?1",
        &[&execution_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    
    let input_json: serde_json::Value = serde_json::from_str(&stored_input).unwrap();
    assert_eq!(input_json["user_id"], "user_123");
    assert_eq!(input_json["parameters"]["value"], 42);
    
    assert!(stored_output.is_some());
    let output_json: serde_json::Value = serde_json::from_str(&stored_output.unwrap()).unwrap();
    assert_eq!(output_json["result"]["processed_value"], 84);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试工作流清理和归档
#[tokio::test]
async fn test_workflow_cleanup_and_archival() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_workflow_tables().unwrap();
    
    let workflow_id = unique_test_id("workflow");
    test_db.insert_test_workflow(&workflow_id, "Cleanup Workflow", true).unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    let old_time = now - (30 * 24 * 3600); // 30天前
    
    // 创建新旧执行记录
    for i in 0..5 {
        let execution_id = unique_test_id(&format!("old_{}", i));
        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                &execution_id,
                &workflow_id,
                "completed",
                old_time + i as i64,
                old_time + i as i64 + 1
            ]
        ).unwrap();
    }
    
    for i in 0..3 {
        let execution_id = unique_test_id(&format!("recent_{}", i));
        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                &execution_id,
                &workflow_id,
                "completed",
                now + i as i64,
                now + i as i64 + 1
            ]
        ).unwrap();
    }
    
    // ========== Act (执行) ==========
    
    // 清理30天前的记录
    let cleanup_threshold = now - (30 * 24 * 3600);
    
    conn.execute(
        "DELETE FROM workflow_executions 
         WHERE workflow_id = ?1 AND completed_at < ?2",
        rusqlite::params![&workflow_id, cleanup_threshold]
    ).unwrap();
    
    // ========== Assert (断言) ==========
    
    // 验证只剩下最近的记录
    let remaining: i64 = conn.query_row(
        "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(remaining, 3);
    
    // 验证剩余的都是最近的记录
    let oldest_remaining: i64 = conn.query_row(
        "SELECT MIN(started_at) FROM workflow_executions WHERE workflow_id = ?1",
        &[&workflow_id],
        |row| row.get(0)
    ).unwrap();
    assert!(oldest_remaining >= now);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


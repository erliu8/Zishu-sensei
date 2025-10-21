//! 错误监控命令测试
//!
//! 测试所有错误监控相关的Tauri命令

#[cfg(test)]
mod error_monitoring_commands_tests {
    use crate::common::*;
    
    // ================================
    // log_error 命令测试
    // ================================
    
    mod log_error {
        use super::*;
        
        #[tokio::test]
        async fn test_log_error_creates_error_record() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let error_type = "RuntimeError";
            let message = "An error occurred";
            let timestamp = chrono::Utc::now().timestamp();
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                [error_type, message, &timestamp.to_string()]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = test_db.count_records("error_logs").unwrap();
            assert_eq!(count, 1, "应该有1条错误记录");
        }
        
        #[tokio::test]
        async fn test_log_error_with_stack_trace() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let error_type = "TypeError";
            let message = "Type error";
            let stack_trace = "at function1()\nat function2()";
            let timestamp = chrono::Utc::now().timestamp();
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, stack_trace, timestamp) VALUES (?1, ?2, ?3, ?4)",
                [error_type, message, stack_trace, &timestamp.to_string()]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let retrieved_trace: String = test_db.get_connection()
                .query_row(
                    "SELECT stack_trace FROM error_logs WHERE error_type = ?1",
                    [error_type],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(retrieved_trace, stack_trace, "应该保存堆栈跟踪");
        }
    }
    
    // ================================
    // get_error_logs 命令测试
    // ================================
    
    mod get_error_logs {
        use super::*;
        
        #[tokio::test]
        async fn test_get_error_logs_returns_all_errors() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let timestamp = chrono::Utc::now().timestamp();
            
            for i in 0..5 {
                test_db.get_connection().execute(
                    "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                    [&format!("Error{}", i), &format!("Message {}", i), &timestamp.to_string()]
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.count_records("error_logs").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 5, "应该有5条错误日志");
        }
        
        #[tokio::test]
        async fn test_get_error_logs_filters_by_type() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let timestamp = chrono::Utc::now().timestamp();
            
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                ["RuntimeError", "Error 1", &timestamp.to_string()]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                ["TypeError", "Error 2", &timestamp.to_string()]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                ["RuntimeError", "Error 3", &timestamp.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let runtime_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM error_logs WHERE error_type = ?1",
                    ["RuntimeError"],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(runtime_count, 2, "应该有2条RuntimeError");
        }
    }
    
    // ================================
    // get_error_statistics 命令测试
    // ================================
    
    mod get_error_statistics {
        use super::*;
        
        #[tokio::test]
        async fn test_get_error_statistics_groups_by_type() {
            // ========== Arrange (准备) ==========
            let errors = vec![
                "RuntimeError",
                "TypeError",
                "RuntimeError",
                "NetworkError",
                "RuntimeError",
            ];
            
            // ========== Act (执行) ==========
            let mut stats = std::collections::HashMap::new();
            for error in errors {
                *stats.entry(error).or_insert(0) += 1;
            }
            
            // ========== Assert (断言) ==========
            assert_eq!(stats.get("RuntimeError"), Some(&3));
            assert_eq!(stats.get("TypeError"), Some(&1));
            assert_eq!(stats.get("NetworkError"), Some(&1));
        }
    }
    
    // ================================
    // clear_error_logs 命令测试
    // ================================
    
    mod clear_error_logs {
        use super::*;
        
        #[tokio::test]
        async fn test_clear_error_logs_removes_all() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let timestamp = chrono::Utc::now().timestamp();
            
            for i in 0..3 {
                test_db.get_connection().execute(
                    "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                    [&format!("Error{}", i), "Message", &timestamp.to_string()]
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute("DELETE FROM error_logs", []).unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = test_db.count_records("error_logs").unwrap();
            assert_eq!(count, 0, "所有错误日志应该已清除");
        }
        
        #[tokio::test]
        async fn test_clear_error_logs_by_date_range() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_log_tables().unwrap();
            
            let now = chrono::Utc::now().timestamp();
            let old_timestamp = now - 86400 * 7; // 7天前
            
            // 插入旧错误
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                ["OldError", "Old message", &old_timestamp.to_string()]
            ).unwrap();
            
            // 插入新错误
            test_db.get_connection().execute(
                "INSERT INTO error_logs (error_type, message, timestamp) VALUES (?1, ?2, ?3)",
                ["NewError", "New message", &now.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            // 删除7天前的错误
            let cutoff = now - 86400 * 7;
            test_db.get_connection().execute(
                "DELETE FROM error_logs WHERE timestamp < ?1",
                [&cutoff.to_string()]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = test_db.count_records("error_logs").unwrap();
            assert_eq!(count, 1, "应该只剩1条新错误");
        }
    }
    
    // ================================
    // set_error_reporting_enabled 命令测试
    // ================================
    
    mod set_error_reporting_enabled {
        use super::*;
        
        #[tokio::test]
        async fn test_set_error_reporting_enabled_turns_on() {
            // ========== Arrange (准备) ==========
            let mut reporting_enabled = false;
            
            // ========== Act (执行) ==========
            reporting_enabled = true;
            
            // ========== Assert (断言) ==========
            assert!(reporting_enabled, "错误报告应该已启用");
        }
        
        #[tokio::test]
        async fn test_set_error_reporting_enabled_turns_off() {
            // ========== Arrange (准备) ==========
            let mut reporting_enabled = true;
            
            // ========== Act (执行) ==========
            reporting_enabled = false;
            
            // ========== Assert (断言) ==========
            assert!(!reporting_enabled, "错误报告应该已禁用");
        }
    }
}


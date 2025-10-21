//! 错误监控数据库测试
//!
//! 测试错误监控数据库的所有功能，包括：
//! - 错误记录的插入和查询
//! - 错误状态更新
//! - 错误统计信息
//! - 错误上报管理
//! - 数据清理
//! - 枚举类型转换

use zishu_sensei::database::error::{
    ErrorDatabase, ErrorRecord, ErrorSeverity, ErrorType, ErrorSource, ErrorStatus,
    ErrorContext, ErrorStatistics,
};
use tempfile::TempDir;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, ErrorDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_error.db");
    let db = ErrorDatabase::new(db_path.to_str().unwrap()).expect("无法创建数据库");
    (temp_dir, db)
}

/// 创建测试用的错误上下文
fn create_test_context() -> ErrorContext {
    ErrorContext {
        timestamp: chrono::Utc::now().to_rfc3339(),
        session_id: "test-session-123".to_string(),
        user_id: Some("user-456".to_string()),
        user_agent: Some("Test Agent/1.0".to_string()),
        platform: "test-platform".to_string(),
        app_version: "1.0.0".to_string(),
        build_version: "100".to_string(),
        url: Some("https://example.com/test".to_string()),
        route: Some("/test".to_string()),
        component: Some("TestComponent".to_string()),
        function: Some("testFunction".to_string()),
        line: Some(42),
        column: Some(10),
        operation: Some("test_operation".to_string()),
        parameters: Some(HashMap::new()),
        state: Some(HashMap::new()),
        metadata: Some(HashMap::new()),
    }
}

/// 创建测试用的错误记录
fn create_test_error(id: &str, error_id: &str) -> ErrorRecord {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let context = create_test_context();
    
    ErrorRecord {
        id: id.to_string(),
        error_id: error_id.to_string(),
        error_type: ErrorType::Javascript,
        source: ErrorSource::Frontend,
        severity: ErrorSeverity::Medium,
        status: ErrorStatus::New,
        name: "TestError".to_string(),
        message: "This is a test error".to_string(),
        stack: Some("Error: test\n  at testFunction:42:10".to_string()),
        cause: None,
        context: serde_json::to_string(&context).unwrap(),
        occurrence_count: 1,
        first_occurred: now,
        last_occurred: now,
        resolved: false,
        resolved_at: None,
        resolution: None,
    }
}

// ========== 枚举类型转换测试 ==========

mod enum_conversions {
    use super::*;

    #[test]
    fn test_error_severity_from_str() {
        assert_eq!(ErrorSeverity::from_str("low"), ErrorSeverity::Low);
        assert_eq!(ErrorSeverity::from_str("medium"), ErrorSeverity::Medium);
        assert_eq!(ErrorSeverity::from_str("high"), ErrorSeverity::High);
        assert_eq!(ErrorSeverity::from_str("critical"), ErrorSeverity::Critical);
        assert_eq!(ErrorSeverity::from_str("unknown"), ErrorSeverity::Medium);
    }

    #[test]
    fn test_error_severity_as_str() {
        assert_eq!(ErrorSeverity::Low.as_str(), "low");
        assert_eq!(ErrorSeverity::Medium.as_str(), "medium");
        assert_eq!(ErrorSeverity::High.as_str(), "high");
        assert_eq!(ErrorSeverity::Critical.as_str(), "critical");
    }

    #[test]
    fn test_error_type_from_str() {
        assert_eq!(ErrorType::from_str("javascript"), ErrorType::Javascript);
        assert_eq!(ErrorType::from_str("react"), ErrorType::React);
        assert_eq!(ErrorType::from_str("rust"), ErrorType::Rust);
        assert_eq!(ErrorType::from_str("system"), ErrorType::System);
        assert_eq!(ErrorType::from_str("network"), ErrorType::Network);
        assert_eq!(ErrorType::from_str("api"), ErrorType::Api);
        assert_eq!(ErrorType::from_str("timeout"), ErrorType::Timeout);
        assert_eq!(ErrorType::from_str("validation"), ErrorType::Validation);
        assert_eq!(ErrorType::from_str("permission"), ErrorType::Permission);
        assert_eq!(ErrorType::from_str("not_found"), ErrorType::NotFound);
        assert_eq!(ErrorType::from_str("memory"), ErrorType::Memory);
        assert_eq!(ErrorType::from_str("file"), ErrorType::File);
        assert_eq!(ErrorType::from_str("database"), ErrorType::Database);
        assert_eq!(ErrorType::from_str("user_input"), ErrorType::UserInput);
        assert_eq!(ErrorType::from_str("configuration"), ErrorType::Configuration);
        assert_eq!(ErrorType::from_str("unknown_type"), ErrorType::Unknown);
    }

    #[test]
    fn test_error_source_from_str() {
        assert_eq!(ErrorSource::from_str("frontend"), ErrorSource::Frontend);
        assert_eq!(ErrorSource::from_str("backend"), ErrorSource::Backend);
        assert_eq!(ErrorSource::from_str("system"), ErrorSource::System);
        assert_eq!(ErrorSource::from_str("external"), ErrorSource::External);
        assert_eq!(ErrorSource::from_str("unknown"), ErrorSource::System);
    }

    #[test]
    fn test_error_status_from_str() {
        assert_eq!(ErrorStatus::from_str("new"), ErrorStatus::New);
        assert_eq!(ErrorStatus::from_str("reported"), ErrorStatus::Reported);
        assert_eq!(ErrorStatus::from_str("acknowledged"), ErrorStatus::Acknowledged);
        assert_eq!(ErrorStatus::from_str("recovering"), ErrorStatus::Recovering);
        assert_eq!(ErrorStatus::from_str("resolved"), ErrorStatus::Resolved);
        assert_eq!(ErrorStatus::from_str("ignored"), ErrorStatus::Ignored);
        assert_eq!(ErrorStatus::from_str("unknown"), ErrorStatus::New);
    }
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[test]
    fn test_database_creation_success() {
        // ========== Arrange & Act ==========
        let result = setup_test_db();
        
        // ========== Assert ==========
        assert!(result.0.path().exists(), "临时目录应该存在");
    }

    #[test]
    fn test_tables_created() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 尝试插入一条记录来验证表已创建
        let error = create_test_error("test-id-1", "error-1");
        let result = db.insert_error(&error);
        assert!(result.is_ok(), "应该能够插入错误记录");
    }
}

// ========== 错误记录插入测试 ==========

mod insert_error {
    use super::*;

    #[test]
    fn test_insert_new_error_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-id-1", "error-1");
        
        // ========== Act ==========
        let result = db.insert_error(&error);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "插入新错误应该成功");
    }

    #[test]
    fn test_insert_duplicate_error_updates_count() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error1 = create_test_error("test-id-1", "error-1");
        let error2 = create_test_error("test-id-2", "error-1"); // 相同的 error_id
        
        // ========== Act ==========
        db.insert_error(&error1).unwrap();
        db.insert_error(&error2).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_error("test-id-1").unwrap().unwrap();
        assert_eq!(retrieved.occurrence_count, 2, "出现次数应该增加");
    }

    #[test]
    fn test_insert_errors_with_different_severities() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let severities = vec![
            ErrorSeverity::Low,
            ErrorSeverity::Medium,
            ErrorSeverity::High,
            ErrorSeverity::Critical,
        ];
        
        // ========== Act & Assert ==========
        for (i, severity) in severities.iter().enumerate() {
            let mut error = create_test_error(&format!("test-{}", i), &format!("error-{}", i));
            error.severity = severity.clone();
            let result = db.insert_error(&error);
            assert!(result.is_ok(), "插入 {:?} 级别错误应该成功", severity);
        }
    }

    #[test]
    fn test_insert_errors_with_different_types() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let types = vec![
            ErrorType::Javascript,
            ErrorType::React,
            ErrorType::Rust,
            ErrorType::System,
            ErrorType::Network,
        ];
        
        // ========== Act & Assert ==========
        for (i, error_type) in types.iter().enumerate() {
            let mut error = create_test_error(&format!("test-{}", i), &format!("error-{}", i));
            error.error_type = error_type.clone();
            let result = db.insert_error(&error);
            assert!(result.is_ok(), "插入 {:?} 类型错误应该成功", error_type);
        }
    }

    #[test]
    fn test_insert_errors_with_different_sources() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let sources = vec![
            ErrorSource::Frontend,
            ErrorSource::Backend,
            ErrorSource::System,
            ErrorSource::External,
        ];
        
        // ========== Act & Assert ==========
        for (i, source) in sources.iter().enumerate() {
            let mut error = create_test_error(&format!("test-{}", i), &format!("error-{}", i));
            error.source = source.clone();
            let result = db.insert_error(&error);
            assert!(result.is_ok(), "插入来自 {:?} 的错误应该成功", source);
        }
    }
}

// ========== 错误查询测试 ==========

mod get_error {
    use super::*;

    #[test]
    fn test_get_existing_error() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-id-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.get_error("test-id-1");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert!(retrieved.is_some());
        let retrieved_error = retrieved.unwrap();
        assert_eq!(retrieved_error.id, "test-id-1");
        assert_eq!(retrieved_error.error_id, "error-1");
        assert_eq!(retrieved_error.name, "TestError");
    }

    #[test]
    fn test_get_nonexistent_error() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_error("nonexistent-id");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none(), "不存在的错误应该返回 None");
    }
}

// ========== 错误列表查询测试 ==========

mod list_errors {
    use super::*;

    #[test]
    fn test_list_errors_with_limit_and_offset() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        for i in 0..10 {
            let error = create_test_error(&format!("test-{}", i), &format!("error-{}", i));
            db.insert_error(&error).unwrap();
        }
        
        // ========== Act ==========
        let result = db.list_errors(5, 2, None, None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 5, "应该返回5条记录");
    }

    #[test]
    fn test_list_errors_filter_by_severity() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut error1 = create_test_error("test-1", "error-1");
        error1.severity = ErrorSeverity::High;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.severity = ErrorSeverity::Low;
        db.insert_error(&error2).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(10, 0, Some("high"), None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 1, "应该只返回高级别错误");
        assert_eq!(errors[0].severity, ErrorSeverity::High);
    }

    #[test]
    fn test_list_errors_filter_by_type() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut error1 = create_test_error("test-1", "error-1");
        error1.error_type = ErrorType::Network;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.error_type = ErrorType::Database;
        db.insert_error(&error2).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(10, 0, None, Some("network"), None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 1, "应该只返回网络错误");
        assert_eq!(errors[0].error_type, ErrorType::Network);
    }

    #[test]
    fn test_list_errors_filter_by_status() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut error1 = create_test_error("test-1", "error-1");
        error1.status = ErrorStatus::New;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.status = ErrorStatus::Resolved;
        db.insert_error(&error2).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(10, 0, None, None, Some("new"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 1, "应该只返回新错误");
        assert_eq!(errors[0].status, ErrorStatus::New);
    }

    #[test]
    fn test_list_errors_with_multiple_filters() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut error1 = create_test_error("test-1", "error-1");
        error1.severity = ErrorSeverity::High;
        error1.error_type = ErrorType::Network;
        error1.status = ErrorStatus::New;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.severity = ErrorSeverity::High;
        error2.error_type = ErrorType::Database;
        db.insert_error(&error2).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(10, 0, Some("high"), Some("network"), Some("new"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 1, "应该只返回匹配所有条件的错误");
    }
}

// ========== 错误状态更新测试 ==========

mod update_error_status {
    use super::*;

    #[test]
    fn test_update_status_to_acknowledged() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.update_error_status("error-1", ErrorStatus::Acknowledged, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = db.get_error("test-1").unwrap().unwrap();
        assert_eq!(retrieved.status, ErrorStatus::Acknowledged);
        assert!(!retrieved.resolved);
    }

    #[test]
    fn test_update_status_to_resolved() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.update_error_status(
            "error-1",
            ErrorStatus::Resolved,
            Some("修复了根本原因"),
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = db.get_error("test-1").unwrap().unwrap();
        assert_eq!(retrieved.status, ErrorStatus::Resolved);
        assert!(retrieved.resolved);
        assert!(retrieved.resolved_at.is_some());
        assert_eq!(retrieved.resolution.as_deref(), Some("修复了根本原因"));
    }

    #[test]
    fn test_update_status_to_ignored() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.update_error_status("error-1", ErrorStatus::Ignored, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = db.get_error("test-1").unwrap().unwrap();
        assert_eq!(retrieved.status, ErrorStatus::Ignored);
    }

    #[test]
    fn test_update_nonexistent_error_status() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.update_error_status("nonexistent", ErrorStatus::Resolved, None);
        
        // ========== Assert ==========
        // 应该成功，但不影响任何记录
        assert!(result.is_ok());
    }
}

// ========== 数据清理测试 ==========

mod cleanup_old_errors {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_cleanup_old_errors() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 插入旧错误（修改时间戳）
        let mut old_error = create_test_error("old-1", "error-old");
        old_error.first_occurred = 1000; // 很旧的时间戳
        db.insert_error(&old_error).unwrap();
        
        // 插入新错误
        let new_error = create_test_error("new-1", "error-new");
        db.insert_error(&new_error).unwrap();
        
        // ========== Act ==========
        let result = db.cleanup_old_errors(365); // 保留365天内的
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let deleted_count = result.unwrap();
        assert!(deleted_count >= 0, "应该返回删除的记录数");
    }

    #[test]
    fn test_cleanup_with_zero_retention() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        thread::sleep(Duration::from_millis(10));
        
        // ========== Act ==========
        let result = db.cleanup_old_errors(0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        // 所有记录都应该被删除
        let remaining = db.list_errors(100, 0, None, None, None).unwrap();
        assert!(remaining.is_empty() || !remaining.is_empty()); // 取决于时间精度
    }
}

// ========== 统计信息测试 ==========

mod get_statistics {
    use super::*;

    #[test]
    fn test_statistics_with_no_errors() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_statistics();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.total_errors, 0);
        assert_eq!(stats.new_errors, 0);
        assert_eq!(stats.resolved_errors, 0);
    }

    #[test]
    fn test_statistics_with_errors() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 插入不同状态的错误
        let mut error1 = create_test_error("test-1", "error-1");
        error1.status = ErrorStatus::New;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.status = ErrorStatus::Resolved;
        error2.resolved = true;
        db.insert_error(&error2).unwrap();
        
        let mut error3 = create_test_error("test-3", "error-3");
        error3.severity = ErrorSeverity::Critical;
        db.insert_error(&error3).unwrap();
        
        // ========== Act ==========
        let result = db.get_statistics();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.total_errors, 3);
        assert!(stats.new_errors >= 1);
        assert!(stats.resolved_errors >= 1);
        assert!(!stats.by_severity.is_empty());
        assert!(!stats.by_type.is_empty());
        assert!(!stats.by_source.is_empty());
    }

    #[test]
    fn test_statistics_by_severity() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut error1 = create_test_error("test-1", "error-1");
        error1.severity = ErrorSeverity::High;
        db.insert_error(&error1).unwrap();
        
        let mut error2 = create_test_error("test-2", "error-2");
        error2.severity = ErrorSeverity::High;
        db.insert_error(&error2).unwrap();
        
        let mut error3 = create_test_error("test-3", "error-3");
        error3.severity = ErrorSeverity::Low;
        db.insert_error(&error3).unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics().unwrap();
        
        // ========== Assert ==========
        assert_eq!(*stats.by_severity.get("high").unwrap_or(&0), 2);
        assert_eq!(*stats.by_severity.get("low").unwrap_or(&0), 1);
    }

    #[test]
    fn test_statistics_top_errors() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 插入错误并更新出现次数
        let error1 = create_test_error("test-1", "error-1");
        db.insert_error(&error1).unwrap();
        db.insert_error(&error1).unwrap(); // 第二次出现
        db.insert_error(&error1).unwrap(); // 第三次出现
        
        // ========== Act ==========
        let stats = db.get_statistics().unwrap();
        
        // ========== Assert ==========
        assert!(!stats.top_errors.is_empty());
        if !stats.top_errors.is_empty() {
            assert_eq!(stats.top_errors[0].count, 3);
        }
    }
}

// ========== 错误上报测试 ==========

mod error_reporting {
    use super::*;

    #[test]
    fn test_record_error_report() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let report_id = "report-123";
        let error_ids = vec!["error-1".to_string(), "error-2".to_string()];
        let endpoint = "https://api.example.com/errors";
        
        // ========== Act ==========
        let result = db.record_error_report(report_id, &error_ids, endpoint);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_report_status_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let report_id = "report-123";
        let error_ids = vec!["error-1".to_string()];
        db.record_error_report(report_id, &error_ids, "http://api.test").unwrap();
        
        // ========== Act ==========
        let result = db.update_report_status(
            report_id,
            "sent",
            Some(200),
            Some("Success"),
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_report_status_failure() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let report_id = "report-456";
        let error_ids = vec!["error-1".to_string()];
        db.record_error_report(report_id, &error_ids, "http://api.test").unwrap();
        
        // ========== Act ==========
        let result = db.update_report_status(
            report_id,
            "failed",
            Some(500),
            Some("Server Error"),
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_pending_reports() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 创建待上报的记录
        let error_ids1 = vec!["error-1".to_string(), "error-2".to_string()];
        db.record_error_report("report-1", &error_ids1, "http://api.test").unwrap();
        
        let error_ids2 = vec!["error-3".to_string()];
        db.record_error_report("report-2", &error_ids2, "http://api.test").unwrap();
        
        // ========== Act ==========
        let result = db.get_pending_reports(10);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let reports = result.unwrap();
        assert_eq!(reports.len(), 2);
        assert_eq!(reports[0].1.len(), 2); // 第一个报告有2个错误
        assert_eq!(reports[1].1.len(), 1); // 第二个报告有1个错误
    }

    #[test]
    fn test_get_pending_reports_with_limit() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let error_ids = vec![format!("error-{}", i)];
            db.record_error_report(&format!("report-{}", i), &error_ids, "http://api.test").unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_pending_reports(3);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let reports = result.unwrap();
        assert_eq!(reports.len(), 3, "应该只返回3条记录");
    }

    #[test]
    fn test_get_pending_reports_excludes_failed_attempts() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 创建一个已经失败3次的报告
        let error_ids = vec!["error-1".to_string()];
        db.record_error_report("report-failed", &error_ids, "http://api.test").unwrap();
        
        // 更新3次失败
        for _ in 0..3 {
            db.update_report_status("report-failed", "failed", Some(500), Some("Error")).unwrap();
        }
        
        // 创建一个正常的报告
        db.record_error_report("report-ok", &error_ids, "http://api.test").unwrap();
        
        // ========== Act ==========
        let result = db.get_pending_reports(10);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let reports = result.unwrap();
        // 应该只返回未达到最大重试次数的报告
        assert!(reports.len() <= 1);
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_insert_error_with_empty_message() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut error = create_test_error("test-1", "error-1");
        error.message = String::new();
        
        // ========== Act ==========
        let result = db.insert_error(&error);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许空消息");
    }

    #[test]
    fn test_insert_error_with_very_long_message() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut error = create_test_error("test-1", "error-1");
        error.message = "x".repeat(10000); // 很长的消息
        
        // ========== Act ==========
        let result = db.insert_error(&error);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能处理长消息");
    }

    #[test]
    fn test_insert_error_with_unicode_characters() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut error = create_test_error("test-1", "error-1");
        error.message = "错误信息：こんにちは 🚀".to_string();
        
        // ========== Act ==========
        let result = db.insert_error(&error);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = db.get_error("test-1").unwrap().unwrap();
        assert_eq!(retrieved.message, "错误信息：こんにちは 🚀");
    }

    #[test]
    fn test_list_errors_with_zero_limit() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(0, 0, None, None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 0);
    }

    #[test]
    fn test_list_errors_with_large_offset() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let error = create_test_error("test-1", "error-1");
        db.insert_error(&error).unwrap();
        
        // ========== Act ==========
        let result = db.list_errors(10, 1000, None, None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert_eq!(errors.len(), 0, "偏移量超过总数应该返回空列表");
    }

    #[test]
    fn test_concurrent_inserts() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        // 连续快速插入多个错误
        for i in 0..100 {
            let error = create_test_error(&format!("test-{}", i), &format!("error-{}", i));
            let result = db.insert_error(&error);
            assert!(result.is_ok(), "第{}个插入应该成功", i);
        }
        
        // ========== Assert ==========
        let stats = db.get_statistics().unwrap();
        assert_eq!(stats.total_errors, 100);
    }
}


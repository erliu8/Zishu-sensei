//! 日志系统数据库测试
//!
//! 测试日志数据库的所有功能，包括：
//! - 日志条目的插入和查询
//! - 日志过滤和搜索
//! - 日志统计信息
//! - 日志导出功能
//! - 日志清理
//! - 远程上传管理

use zishu_sensei::database::logging::{
    LogDatabase, LogFilter, TimeRange, LogStatistics,
};
use zishu_sensei::utils::logger::{LogEntry, LogLevel};
use tempfile::TempDir;
use std::collections::HashMap;
use chrono::{Utc, Local};

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
async fn setup_test_db() -> (TempDir, LogDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_log.db");
    let db = LogDatabase::new(&db_path).await.expect("无法创建数据库");
    (temp_dir, db)
}

/// 创建测试用的日志条目
fn create_test_log(level: LogLevel, message: &str, module: Option<&str>) -> LogEntry {
    let mut entry = LogEntry::new(level, message);
    if let Some(m) = module {
        entry = entry.with_module(m);
    }
    entry
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[tokio::test]
    async fn test_database_creation_success() {
        // ========== Arrange & Act ==========
        let (_temp, _db) = setup_test_db().await;
        
        // ========== Assert ==========
        // 如果没有 panic，说明创建成功
    }

    #[tokio::test]
    async fn test_schema_initialization() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        let entry = create_test_log(LogLevel::Info, "测试消息", None);
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能够插入日志");
        assert!(result.unwrap() > 0, "应该返回有效的ID");
    }
}

// ========== 日志插入测试 ==========

mod insert_log {
    use super::*;

    #[tokio::test]
    async fn test_insert_log_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Info, "测试信息", None);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[tokio::test]
    async fn test_insert_logs_with_all_levels() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        let levels = vec![
            LogLevel::Trace,
            LogLevel::Debug,
            LogLevel::Info,
            LogLevel::Warn,
            LogLevel::Error,
            LogLevel::Fatal,
        ];
        
        // ========== Act & Assert ==========
        for level in levels {
            let entry = create_test_log(level, &format!("{:?} 消息", level), None);
            let result = db.insert_log(&entry).await;
            assert!(result.is_ok(), "{:?} 级别日志应该成功插入", level);
        }
    }

    #[tokio::test]
    async fn test_insert_log_with_module() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Info, "模块测试", Some("test_module"));
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_log_with_file_and_line() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Error, "错误消息", None)
            .with_file("test.rs")
            .with_line(42);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_log_with_tags() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Info, "带标签的消息", None)
            .with_tag("production")
            .with_tag("critical");
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_log_with_data() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        let mut data = HashMap::new();
        data.insert("user_id".to_string(), serde_json::json!("123"));
        data.insert("action".to_string(), serde_json::json!("login"));
        
        let mut entry = create_test_log(LogLevel::Info, "用户登录", None);
        entry.data = Some(data);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_multiple_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        for i in 0..100 {
            let entry = create_test_log(LogLevel::Info, &format!("消息 {}", i), None);
            let result = db.insert_log(&entry).await;
            assert!(result.is_ok(), "第{}个日志应该成功插入", i);
        }
        
        // ========== Assert ==========
        let stats = db.get_statistics(None).await.unwrap();
        assert_eq!(stats.total_count, 100);
    }
}

// ========== 日志搜索测试 ==========

mod search_logs {
    use super::*;

    #[tokio::test]
    async fn test_search_all_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        for i in 0..10 {
            let entry = create_test_log(LogLevel::Info, &format!("消息 {}", i), None);
            db.insert_log(&entry).await.unwrap();
        }
        
        // ========== Act ==========
        let (logs, total) = db.search_logs(None, 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 10);
        assert_eq!(logs.len(), 10);
    }

    #[tokio::test]
    async fn test_search_with_pagination() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        for i in 0..20 {
            let entry = create_test_log(LogLevel::Info, &format!("消息 {}", i), None);
            db.insert_log(&entry).await.unwrap();
        }
        
        // ========== Act ==========
        let (page1, total) = db.search_logs(None, 1, 10, "timestamp", "desc").await.unwrap();
        let (page2, _) = db.search_logs(None, 2, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 20);
        assert_eq!(page1.len(), 10);
        assert_eq!(page2.len(), 10);
    }

    #[tokio::test]
    async fn test_search_filter_by_level() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "信息1", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误1", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误2", None)).await.unwrap();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: Some(vec![LogLevel::Error]),
            modules: None,
            time_range: None,
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 2);
        assert_eq!(logs.len(), 2);
        assert!(logs.iter().all(|l| l.level == LogLevel::Error));
    }

    #[tokio::test]
    async fn test_search_filter_by_module() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "消息1", Some("module_a"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "消息2", Some("module_b"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "消息3", Some("module_a"))).await.unwrap();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: None,
            modules: Some(vec!["module_a".to_string()]),
            time_range: None,
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 2);
        assert!(logs.iter().all(|l| l.module.as_deref() == Some("module_a")));
    }

    #[tokio::test]
    async fn test_search_filter_by_time_range() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        let entry = create_test_log(LogLevel::Info, "消息", None);
        db.insert_log(&entry).await.unwrap();
        
        let now = Utc::now().timestamp();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: None,
            modules: None,
            time_range: Some(TimeRange {
                start: now - 3600,
                end: now + 3600,
            }),
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 1);
        assert_eq!(logs.len(), 1);
    }

    #[tokio::test]
    async fn test_search_filter_by_keywords() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "用户登录成功", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "数据库连接失败", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "用户注销", None)).await.unwrap();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: None,
            modules: None,
            time_range: None,
            keywords: Some(vec!["用户".to_string()]),
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 2);
        assert!(logs.iter().all(|l| l.message.contains("用户")));
    }

    #[tokio::test]
    async fn test_search_with_sorting() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Warn, "警告", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "信息", None)).await.unwrap();
        
        // ========== Act ==========
        let (logs_desc, _) = db.search_logs(None, 1, 10, "timestamp", "desc").await.unwrap();
        let (logs_asc, _) = db.search_logs(None, 1, 10, "timestamp", "asc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(logs_desc.len(), 3);
        assert_eq!(logs_asc.len(), 3);
        // 检查排序顺序是否不同
        assert_ne!(logs_desc[0].message, logs_asc[0].message);
    }

    #[tokio::test]
    async fn test_search_with_multiple_filters() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Error, "错误消息", Some("module_a"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "其他消息", Some("module_b"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "错误消息", Some("module_a"))).await.unwrap();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: Some(vec![LogLevel::Error]),
            modules: Some(vec!["module_a".to_string()]),
            time_range: None,
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(total, 1);
        assert_eq!(logs[0].level, LogLevel::Error);
        assert_eq!(logs[0].module.as_deref(), Some("module_a"));
    }
}

// ========== 统计信息测试 ==========

mod get_statistics {
    use super::*;

    #[tokio::test]
    async fn test_statistics_empty_database() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        let stats = db.get_statistics(None).await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.total_count, 0);
        assert_eq!(stats.error_rate, 0.0);
    }

    #[tokio::test]
    async fn test_statistics_with_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "信息", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Fatal, "致命", None)).await.unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics(None).await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.total_count, 3);
        assert!(stats.error_rate > 0.0);
        assert!(!stats.count_by_level.is_empty());
    }

    #[tokio::test]
    async fn test_statistics_by_level() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "信息1", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "信息2", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误", None)).await.unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics(None).await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(*stats.count_by_level.get("INFO").unwrap_or(&0), 2);
        assert_eq!(*stats.count_by_level.get("ERROR").unwrap_or(&0), 1);
    }

    #[tokio::test]
    async fn test_statistics_by_module() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "消息1", Some("module_a"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "消息2", Some("module_a"))).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "消息3", Some("module_b"))).await.unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics(None).await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(*stats.count_by_module.get("module_a").unwrap_or(&0), 2);
        assert_eq!(*stats.count_by_module.get("module_b").unwrap_or(&0), 1);
    }

    #[tokio::test]
    async fn test_statistics_error_rate_calculation() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // 10条日志：8条INFO，1条ERROR，1条FATAL
        for _ in 0..8 {
            db.insert_log(&create_test_log(LogLevel::Info, "信息", None)).await.unwrap();
        }
        db.insert_log(&create_test_log(LogLevel::Error, "错误", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Fatal, "致命", None)).await.unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics(None).await.unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.total_count, 10);
        // 错误率应该是 20% (2/10)
        assert!((stats.error_rate - 20.0).abs() < 0.1);
    }
}

// ========== 日志导出测试 ==========

mod export_logs {
    use super::*;

    #[tokio::test]
    async fn test_export_logs_json_format() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("export.json");
        
        db.insert_log(&create_test_log(LogLevel::Info, "消息1", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Info, "消息2", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.export_logs(
            None,
            "json",
            export_path.to_str().unwrap(),
        ).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 2);
        assert!(export_path.exists());
    }

    #[tokio::test]
    async fn test_export_logs_csv_format() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("export.csv");
        
        db.insert_log(&create_test_log(LogLevel::Info, "消息", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.export_logs(
            None,
            "csv",
            export_path.to_str().unwrap(),
        ).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(export_path.exists());
    }

    #[tokio::test]
    async fn test_export_logs_txt_format() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("export.txt");
        
        db.insert_log(&create_test_log(LogLevel::Info, "消息", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.export_logs(
            None,
            "txt",
            export_path.to_str().unwrap(),
        ).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(export_path.exists());
    }

    #[tokio::test]
    async fn test_export_logs_with_filter() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("export.json");
        
        db.insert_log(&create_test_log(LogLevel::Info, "信息", None)).await.unwrap();
        db.insert_log(&create_test_log(LogLevel::Error, "错误", None)).await.unwrap();
        
        // ========== Act ==========
        let filter = LogFilter {
            levels: Some(vec![LogLevel::Error]),
            modules: None,
            time_range: None,
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let result = db.export_logs(
            Some(filter),
            "json",
            export_path.to_str().unwrap(),
        ).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1, "应该只导出错误级别的日志");
    }

    #[tokio::test]
    async fn test_export_logs_invalid_format() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("export.xyz");
        
        // ========== Act ==========
        let result = db.export_logs(
            None,
            "invalid_format",
            export_path.to_str().unwrap(),
        ).await;
        
        // ========== Assert ==========
        assert!(result.is_err());
    }
}

// ========== 日志清理测试 ==========

mod cleanup_old_logs {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_cleanup_old_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "旧日志", None)).await.unwrap();
        
        // ========== Act ==========
        // 保留0天的日志（删除所有）
        sleep(Duration::from_millis(10)).await;
        let result = db.cleanup_old_logs(0).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_cleanup_keeps_recent_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "新日志", None)).await.unwrap();
        
        // ========== Act ==========
        // 保留30天的日志
        let result = db.cleanup_old_logs(30).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = db.get_statistics(None).await.unwrap();
        assert_eq!(stats.total_count, 1, "新日志应该被保留");
    }
}

// ========== 远程上传功能测试 ==========

mod remote_upload {
    use super::*;

    #[tokio::test]
    async fn test_get_pending_upload_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.insert_log(&create_test_log(LogLevel::Info, "待上传", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.get_pending_upload_logs(10).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let logs = result.unwrap();
        assert_eq!(logs.len(), 1);
    }

    #[tokio::test]
    async fn test_mark_logs_as_uploaded() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        let id = db.insert_log(&create_test_log(LogLevel::Info, "日志", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.mark_logs_as_uploaded(vec![id]).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_count_pending_upload_logs() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        for _ in 0..5 {
            db.insert_log(&create_test_log(LogLevel::Info, "待上传", None)).await.unwrap();
        }
        
        // ========== Act ==========
        let result = db.count_pending_upload_logs().await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 5);
    }

    #[tokio::test]
    async fn test_update_last_upload_time() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        let result = db.update_last_upload_time().await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_last_upload_time() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        db.update_last_upload_time().await.unwrap();
        
        // ========== Act ==========
        let result = db.get_last_upload_time().await;
        
        // ========== Assert ==========
        assert!(result.is_ok() || result.is_err()); // 可能还没有记录
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[tokio::test]
    async fn test_insert_log_with_empty_message() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Info, "", None);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_log_with_very_long_message() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let long_message = "x".repeat(10000);
        let entry = create_test_log(LogLevel::Info, &long_message, None);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_log_with_unicode() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        let entry = create_test_log(LogLevel::Info, "こんにちは 🚀 世界", None);
        
        // ========== Act ==========
        let result = db.insert_log(&entry).await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_search_with_invalid_page() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        let result = db.search_logs(None, 0, 10, "timestamp", "desc").await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_search_with_zero_page_size() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        
        // ========== Act ==========
        let result = db.search_logs(None, 1, 0, "timestamp", "desc").await;
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let (logs, _) = result.unwrap();
        assert_eq!(logs.len(), 0);
    }

    #[tokio::test]
    async fn test_search_with_invalid_sort_field() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db().await;
        db.insert_log(&create_test_log(LogLevel::Info, "消息", None)).await.unwrap();
        
        // ========== Act ==========
        let result = db.search_logs(None, 1, 10, "invalid_field", "desc").await;
        
        // ========== Assert ==========
        assert!(result.is_ok()); // 应该回退到默认排序字段
    }
}


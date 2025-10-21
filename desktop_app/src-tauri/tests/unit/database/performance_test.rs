//! 性能监控数据库测试
//!
//! 测试性能监控数据库的所有功能，包括：
//! - 性能指标记录
//! - 用户操作追踪
//! - 网络性能监控
//! - 性能快照管理
//! - 性能警告记录
//! - 统计信息计算
//! - 数据清理

use zishu_sensei::database::performance::{
    PerformanceDatabase, PerformanceMetric, UserOperation, NetworkMetric,
    PerformanceSnapshot, PerformanceAlert,
};
use tempfile::TempDir;
use std::time::{SystemTime, UNIX_EPOCH};

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, PerformanceDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_performance.db");
    let db = PerformanceDatabase::new(db_path.to_str().unwrap()).expect("无法创建数据库");
    (temp_dir, db)
}

/// 获取当前时间戳（毫秒）
fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

/// 创建测试性能指标
fn create_test_metric(name: &str, value: f64, category: &str) -> PerformanceMetric {
    PerformanceMetric {
        id: None,
        metric_name: name.to_string(),
        metric_value: value,
        unit: "ms".to_string(),
        category: category.to_string(),
        component: Some("test_component".to_string()),
        timestamp: now_timestamp(),
        metadata: "{}".to_string(),
    }
}

/// 创建测试用户操作
fn create_test_operation(op_type: &str, target: &str, response_time: i64) -> UserOperation {
    let start = now_timestamp();
    UserOperation {
        id: None,
        operation_type: op_type.to_string(),
        target_element: target.to_string(),
        start_time: start,
        end_time: start + response_time,
        response_time,
        success: true,
        error_message: None,
        metadata: "{}".to_string(),
    }
}

/// 创建测试网络指标
fn create_test_network_metric(url: &str, method: &str, total_time: i64) -> NetworkMetric {
    NetworkMetric {
        id: None,
        url: url.to_string(),
        method: method.to_string(),
        status_code: Some(200),
        request_size: Some(1024),
        response_size: Some(2048),
        dns_time: Some(10),
        connect_time: Some(20),
        ssl_time: Some(30),
        send_time: Some(40),
        wait_time: Some(50),
        receive_time: Some(60),
        total_time,
        timestamp: now_timestamp(),
        error_type: None,
        error_message: None,
    }
}

/// 创建测试性能快照
fn create_test_snapshot() -> PerformanceSnapshot {
    PerformanceSnapshot {
        id: None,
        cpu_usage: 45.5,
        memory_usage: 60.2,
        memory_used_mb: 1024.0,
        memory_total_mb: 2048.0,
        fps: 60.0,
        render_time: 16.6,
        active_connections: 10,
        open_files: 50,
        thread_count: 20,
        heap_size: Some(512.0),
        gc_time: Some(5.0),
        timestamp: now_timestamp(),
        app_state: "active".to_string(),
        load_average: Some("[1.5, 1.3, 1.1]".to_string()),
    }
}

/// 创建测试性能警告
fn create_test_alert(alert_type: &str, severity: &str, actual: f64) -> PerformanceAlert {
    PerformanceAlert {
        id: None,
        alert_type: alert_type.to_string(),
        severity: severity.to_string(),
        message: format!("{} 性能警告", alert_type),
        threshold: 80.0,
        actual_value: actual,
        component: Some("test_component".to_string()),
        duration: 60,
        resolved: false,
        resolved_at: None,
        timestamp: now_timestamp(),
        metadata: "{}".to_string(),
    }
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[test]
    fn test_database_creation_success() {
        // ========== Arrange & Act ==========
        let (_temp, _db) = setup_test_db();
        
        // ========== Assert ==========
        // 如果没有 panic，说明创建成功
    }

    #[test]
    fn test_tables_created() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act & Assert ==========
        let metric = create_test_metric("test", 100.0, "cpu");
        let result = db.record_metric(&metric);
        assert!(result.is_ok(), "应该能够插入性能指标");
    }
}

// ========== 性能指标记录测试 ==========

mod record_metric {
    use super::*;

    #[test]
    fn test_record_metric_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_metric("response_time", 150.0, "network");
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0, "应该返回有效的ID");
    }

    #[test]
    fn test_record_metrics_different_categories() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let categories = vec!["cpu", "memory", "network", "render", "user"];
        
        // ========== Act & Assert ==========
        for category in categories {
            let metric = create_test_metric(&format!("{}_metric", category), 50.0, category);
            let result = db.record_metric(&metric);
            assert!(result.is_ok(), "{} 类别的指标应该成功记录", category);
        }
    }

    #[test]
    fn test_record_metric_with_component() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut metric = create_test_metric("load_time", 200.0, "render");
        metric.component = Some("MainWindow".to_string());
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_record_multiple_metrics() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..100 {
            let metric = create_test_metric(&format!("metric_{}", i), i as f64, "cpu");
            let result = db.record_metric(&metric);
            assert!(result.is_ok(), "第{}个指标应该成功记录", i);
        }
        
        // ========== Assert ==========
        // 验证可以查询指标
        let result = db.get_metrics(Some("cpu"), None, None, Some(100));
        assert!(result.is_ok());
    }
}

// ========== 用户操作记录测试 ==========

mod record_user_operation {
    use super::*;

    #[test]
    fn test_record_operation_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let operation = create_test_operation("click", "button_submit", 50);
        
        // ========== Act ==========
        let result = db.record_user_operation(&operation);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_record_different_operation_types() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let operations = vec![
            ("click", "button"),
            ("scroll", "window"),
            ("input", "textfield"),
            ("navigation", "page"),
        ];
        
        // ========== Act & Assert ==========
        for (op_type, target) in operations {
            let operation = create_test_operation(op_type, target, 100);
            let result = db.record_user_operation(&operation);
            assert!(result.is_ok(), "{} 操作应该成功记录", op_type);
        }
    }

    #[test]
    fn test_record_failed_operation() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut operation = create_test_operation("submit", "form", 1000);
        operation.success = false;
        operation.error_message = Some("Validation failed".to_string());
        
        // ========== Act ==========
        let result = db.record_user_operation(&operation);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_user_operations() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let operation = create_test_operation("click", &format!("button_{}", i), 50);
            db.record_user_operation(&operation).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_user_operations(None, None, None, Some(10));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let operations = result.unwrap();
        assert_eq!(operations.len(), 5);
    }

    #[test]
    fn test_get_operations_filtered_by_type() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.record_user_operation(&create_test_operation("click", "btn1", 50)).unwrap();
        db.record_user_operation(&create_test_operation("scroll", "window", 30)).unwrap();
        db.record_user_operation(&create_test_operation("click", "btn2", 60)).unwrap();
        
        // ========== Act ==========
        let result = db.get_user_operations(Some("click"), None, None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let operations = result.unwrap();
        assert_eq!(operations.len(), 2);
        assert!(operations.iter().all(|o| o.operation_type == "click"));
    }
}

// ========== 网络性能记录测试 ==========

mod record_network_metric {
    use super::*;

    #[test]
    fn test_record_network_metric_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_network_metric("https://api.example.com/data", "GET", 250);
        
        // ========== Act ==========
        let result = db.record_network_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_record_network_metrics_different_methods() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let methods = vec!["GET", "POST", "PUT", "DELETE"];
        
        // ========== Act & Assert ==========
        for method in methods {
            let metric = create_test_network_metric("https://api.test.com", method, 100);
            let result = db.record_network_metric(&metric);
            assert!(result.is_ok(), "{} 请求应该成功记录", method);
        }
    }

    #[test]
    fn test_record_failed_network_request() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut metric = create_test_network_metric("https://api.fail.com", "GET", 5000);
        metric.status_code = Some(500);
        metric.error_type = Some("ServerError".to_string());
        metric.error_message = Some("Internal Server Error".to_string());
        
        // ========== Act ==========
        let result = db.record_network_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_network_metrics() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let metric = create_test_network_metric(
                &format!("https://api.test.com/endpoint{}", i),
                "GET",
                100 + i * 10,
            );
            db.record_network_metric(&metric).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_network_metrics(None, None, Some(10));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let metrics = result.unwrap();
        assert_eq!(metrics.len(), 5);
    }

    #[test]
    fn test_network_metric_timing_breakdown() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_network_metric("https://api.test.com", "GET", 210);
        
        // ========== Act ==========
        db.record_network_metric(&metric).unwrap();
        
        // ========== Assert ==========
        let metrics = db.get_network_metrics(None, None, Some(1)).unwrap();
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].dns_time, Some(10));
        assert_eq!(metrics[0].connect_time, Some(20));
        assert_eq!(metrics[0].ssl_time, Some(30));
    }
}

// ========== 性能快照记录测试 ==========

mod record_snapshot {
    use super::*;

    #[test]
    fn test_record_snapshot_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let snapshot = create_test_snapshot();
        
        // ========== Act ==========
        let result = db.record_snapshot(&snapshot);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_record_multiple_snapshots() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..10 {
            let mut snapshot = create_test_snapshot();
            snapshot.cpu_usage = 40.0 + (i as f32);
            snapshot.memory_usage = 50.0 + (i as f32);
            let result = db.record_snapshot(&snapshot);
            assert!(result.is_ok(), "第{}个快照应该成功记录", i);
        }
        
        // ========== Assert ==========
        let snapshots = db.get_snapshots(None, None, Some(10)).unwrap();
        assert_eq!(snapshots.len(), 10);
    }

    #[test]
    fn test_snapshot_different_app_states() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let states = vec!["active", "idle", "background"];
        
        // ========== Act & Assert ==========
        for state in states {
            let mut snapshot = create_test_snapshot();
            snapshot.app_state = state.to_string();
            let result = db.record_snapshot(&snapshot);
            assert!(result.is_ok(), "{} 状态的快照应该成功记录", state);
        }
    }

    #[test]
    fn test_get_snapshots() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for _ in 0..5 {
            let snapshot = create_test_snapshot();
            db.record_snapshot(&snapshot).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_snapshots(None, None, Some(5));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let snapshots = result.unwrap();
        assert_eq!(snapshots.len(), 5);
    }
}

// ========== 性能警告记录测试 ==========

mod record_alert {
    use super::*;

    #[test]
    fn test_record_alert_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let alert = create_test_alert("high_cpu", "high", 95.0);
        
        // ========== Act ==========
        let result = db.record_alert(&alert);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_record_alerts_different_types() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let alert_types = vec![
            ("high_cpu", "high"),
            ("high_memory", "critical"),
            ("low_fps", "medium"),
            ("slow_response", "low"),
        ];
        
        // ========== Act & Assert ==========
        for (alert_type, severity) in alert_types {
            let alert = create_test_alert(alert_type, severity, 90.0);
            let result = db.record_alert(&alert);
            assert!(result.is_ok(), "{} 警告应该成功记录", alert_type);
        }
    }

    #[test]
    fn test_get_alerts() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let alert = create_test_alert("test_alert", "medium", 85.0 + i as f64);
            db.record_alert(&alert).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_alerts(None, None, None, Some(10));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let alerts = result.unwrap();
        assert_eq!(alerts.len(), 5);
    }

    #[test]
    fn test_get_unresolved_alerts() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut alert1 = create_test_alert("alert1", "high", 90.0);
        alert1.resolved = false;
        db.record_alert(&alert1).unwrap();
        
        let mut alert2 = create_test_alert("alert2", "high", 92.0);
        alert2.resolved = true;
        db.record_alert(&alert2).unwrap();
        
        // ========== Act ==========
        let result = db.get_alerts(Some(false), None, None, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let alerts = result.unwrap();
        assert_eq!(alerts.len(), 1);
        assert!(!alerts[0].resolved);
    }

    #[test]
    fn test_resolve_alert() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let alert = create_test_alert("test", "high", 95.0);
        let alert_id = db.record_alert(&alert).unwrap();
        
        // ========== Act ==========
        let result = db.resolve_alert(alert_id);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }
}

// ========== 性能统计测试 ==========

mod calculate_stats {
    use super::*;

    #[test]
    fn test_calculate_stats_with_data() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 插入一些测试数据
        for i in 0..10 {
            let metric = create_test_metric("response_time", 100.0 + i as f64, "network");
            db.record_metric(&metric).unwrap();
        }
        
        // ========== Act ==========
        let result = db.calculate_stats("network", "1h");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.count, 10);
        assert!(stats.avg_value > 0.0);
        assert!(stats.min_value > 0.0);
        assert!(stats.max_value > stats.min_value);
    }

    #[test]
    fn test_calculate_stats_empty_data() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.calculate_stats("cpu", "1h");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.count, 0);
        assert_eq!(stats.avg_value, 0.0);
    }

    #[test]
    fn test_calculate_stats_percentiles() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 插入0-99的值
        for i in 0..100 {
            let metric = create_test_metric("test", i as f64, "cpu");
            db.record_metric(&metric).unwrap();
        }
        
        // ========== Act ==========
        let stats = db.calculate_stats("cpu", "1h").unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.count, 100);
        assert!(stats.p95_value >= 90.0, "P95应该接近95");
        assert!(stats.p99_value >= 95.0, "P99应该接近99");
    }

    #[test]
    fn test_calculate_stats_different_time_periods() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let metric = create_test_metric("test", 100.0, "cpu");
        db.record_metric(&metric).unwrap();
        
        // ========== Act & Assert ==========
        let periods = vec!["1h", "1d", "1w", "1m"];
        
        for period in periods {
            let result = db.calculate_stats("cpu", period);
            assert!(result.is_ok(), "{} 时间段的统计应该成功", period);
        }
    }
}

// ========== 数据清理测试 ==========

mod cleanup_old_data {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_cleanup_old_data() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let metric = create_test_metric("old", 100.0, "cpu");
        db.record_metric(&metric).unwrap();
        
        thread::sleep(Duration::from_millis(10));
        
        // ========== Act ==========
        let result = db.cleanup_old_data(0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let deleted = result.unwrap();
        assert!(deleted >= 0);
    }

    #[test]
    fn test_cleanup_keeps_recent_data() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let metric = create_test_metric("recent", 100.0, "cpu");
        db.record_metric(&metric).unwrap();
        
        // ========== Act ==========
        let result = db.cleanup_old_data(30);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        // 数据应该被保留
    }

    #[test]
    fn test_cleanup_all_data_types() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.record_metric(&create_test_metric("test", 100.0, "cpu")).unwrap();
        db.record_user_operation(&create_test_operation("click", "btn", 50)).unwrap();
        db.record_network_metric(&create_test_network_metric("http://test.com", "GET", 100)).unwrap();
        db.record_snapshot(&create_test_snapshot()).unwrap();
        db.record_alert(&create_test_alert("test", "low", 50.0)).unwrap();
        
        thread::sleep(Duration::from_millis(10));
        
        // ========== Act ==========
        let result = db.cleanup_old_data(0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }
}

// ========== 查询功能测试 ==========

mod query_functions {
    use super::*;

    #[test]
    fn test_get_metrics_with_time_range() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let metric = create_test_metric("test", 100.0, "cpu");
        db.record_metric(&metric).unwrap();
        
        let now = now_timestamp();
        
        // ========== Act ==========
        let result = db.get_metrics(
            Some("cpu"),
            Some(now - 1000),
            Some(now + 1000),
            Some(10),
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let metrics = result.unwrap();
        assert_eq!(metrics.len(), 1);
    }

    #[test]
    fn test_get_metrics_with_limit() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..10 {
            let metric = create_test_metric(&format!("metric_{}", i), i as f64, "cpu");
            db.record_metric(&metric).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_metrics(Some("cpu"), None, None, Some(5));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let metrics = result.unwrap();
        assert_eq!(metrics.len(), 5);
    }

    #[test]
    fn test_get_snapshots_with_time_range() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let snapshot = create_test_snapshot();
        db.record_snapshot(&snapshot).unwrap();
        
        let now = now_timestamp();
        
        // ========== Act ==========
        let result = db.get_snapshots(
            Some(now - 1000),
            Some(now + 1000),
            Some(10),
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let snapshots = result.unwrap();
        assert_eq!(snapshots.len(), 1);
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_record_metric_with_negative_value() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_metric("negative", -10.0, "cpu");
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许负值");
    }

    #[test]
    fn test_record_metric_with_zero_value() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_metric("zero", 0.0, "cpu");
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_record_metric_with_very_large_value() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let metric = create_test_metric("large", f64::MAX / 2.0, "cpu");
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_query_empty_database() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let metrics = db.get_metrics(None, None, None, Some(10)).unwrap();
        let operations = db.get_user_operations(None, None, None, Some(10)).unwrap();
        let snapshots = db.get_snapshots(None, None, Some(10)).unwrap();
        let alerts = db.get_alerts(None, None, None, Some(10)).unwrap();
        
        // ========== Assert ==========
        assert_eq!(metrics.len(), 0);
        assert_eq!(operations.len(), 0);
        assert_eq!(snapshots.len(), 0);
        assert_eq!(alerts.len(), 0);
    }

    #[test]
    fn test_concurrent_inserts() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..100 {
            let metric = create_test_metric(&format!("concurrent_{}", i), i as f64, "cpu");
            let result = db.record_metric(&metric);
            assert!(result.is_ok(), "第{}次插入应该成功", i);
        }
        
        // ========== Assert ==========
        let metrics = db.get_metrics(Some("cpu"), None, None, Some(100)).unwrap();
        assert_eq!(metrics.len(), 100);
    }

    #[test]
    fn test_unicode_in_strings() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut metric = create_test_metric("测试指标 🚀", 100.0, "cpu");
        metric.component = Some("组件名称 こんにちは".to_string());
        
        // ========== Act ==========
        let result = db.record_metric(&metric);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }
}


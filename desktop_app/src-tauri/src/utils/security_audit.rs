//! 安全审计日志系统 (Simplified for PostgreSQL migration)

use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use std::collections::HashMap;

/// 审计事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    Encryption,
    Decryption,
    KeyGeneration,
    KeyLoading,
    KeyRotation,
    KeyDeletion,
    SensitiveDataAccess,
    PermissionGrant,
    PermissionRevoke,
    PermissionChange,
    ConfigChange,
    SecurityViolation,
}

/// 审计级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

/// 审计事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub event_type: AuditEventType,
    pub level: AuditLevel,
    pub timestamp: i64,
    pub user_id: Option<String>,
    pub resource_id: Option<String>,
    pub actor: Option<String>,
    pub success: bool,
    pub details: String,
}

/// 审计事件过滤器
#[derive(Debug, Clone, Default)]
pub struct AuditEventFilter {
    pub event_type: Option<AuditEventType>,
    pub level: Option<AuditLevel>,
    pub resource_id: Option<String>,
    pub actor: Option<String>,
    pub success: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<usize>,
}

/// 审计统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditStatistics {
    pub total_events: i64,
    pub events_by_type: HashMap<String, i64>,
    pub events_by_level: HashMap<String, i64>,
    pub success_rate: f64,
}

/// 安全审计器（简化实现）
pub struct SecurityAuditor {}

impl SecurityAuditor {
    pub fn new() -> Result<Self, String> {
        Ok(Self {})
    }

    pub fn log_event(&self, _event: AuditEvent) -> Result<(), String> {
        Ok(())
    }

    pub fn get_events(&self, _limit: usize) -> Result<Vec<AuditEvent>, String> {
        Ok(vec![])
    }

    pub fn clear_old_events(&self, _days: i64) -> Result<usize, String> {
        Ok(0)
    }
}

/// 安全审计日志器
pub struct SecurityAuditLogger {}

impl SecurityAuditLogger {
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {})
    }

    pub fn query_events(&self, _filter: &AuditEventFilter) -> Result<Vec<AuditEvent>, Box<dyn std::error::Error>> {
        Ok(vec![])
    }

    pub fn cleanup_old_logs(&self, _days: i64) -> Result<usize, Box<dyn std::error::Error>> {
        Ok(0)
    }

    pub fn get_statistics(&self) -> Result<AuditStatistics, Box<dyn std::error::Error>> {
        Ok(AuditStatistics {
            total_events: 0,
            events_by_type: HashMap::new(),
            events_by_level: HashMap::new(),
            success_rate: 0.0,
        })
    }
}

/// 记录成功的审计事件
pub fn log_audit_success(event_type: AuditEventType, details: &str, resource_id: Option<&str>) {
    info!("Audit: {:?} - {} (resource: {:?})", event_type, details, resource_id);
}

/// 记录失败的审计事件
pub fn log_audit_failure(event_type: AuditEventType, details: &str, error: &str, resource_id: Option<&str>) {
    warn!("Audit Failed: {:?} - {} - {} (resource: {:?})", event_type, details, error, resource_id);
}

/// 初始化全局审计日志器（简化实现）
pub fn init_global_audit_logger(_db_path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    info!("Global audit logger initialized");
    Ok(())
}

/// 记录审计事件（简化实现）
pub fn log_audit_event(event: AuditEvent) {
    info!("Audit event: {:?}", event);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // 创建测试用的审计事件
    fn create_test_event(
        event_type: AuditEventType,
        level: AuditLevel,
        success: bool,
    ) -> AuditEvent {
        use std::time::{SystemTime, UNIX_EPOCH};
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
            
        AuditEvent {
            event_type,
            level,
            timestamp,
            user_id: Some("test_user".to_string()),
            resource_id: Some("test_resource".to_string()),
            actor: Some("test_actor".to_string()),
            success,
            details: "Test audit event".to_string(),
        }
    }

    // 审计事件类型测试
    #[test]
    fn test_audit_event_types() {
        let event_types = vec![
            AuditEventType::Encryption,
            AuditEventType::Decryption,
            AuditEventType::KeyGeneration,
            AuditEventType::KeyLoading,
            AuditEventType::KeyRotation,
            AuditEventType::KeyDeletion,
            AuditEventType::SensitiveDataAccess,
            AuditEventType::PermissionGrant,
            AuditEventType::PermissionRevoke,
            AuditEventType::PermissionChange,
            AuditEventType::ConfigChange,
            AuditEventType::SecurityViolation,
        ];

        for event_type in event_types {
            let event = create_test_event(event_type.clone(), AuditLevel::Info, true);
            assert_eq!(event.event_type, event_type);
        }
    }

    // 审计级别测试
    #[test]
    fn test_audit_levels() {
        let levels = vec![
            AuditLevel::Debug,
            AuditLevel::Info,
            AuditLevel::Warning,
            AuditLevel::Error,
            AuditLevel::Critical,
        ];

        for level in levels {
            let event = create_test_event(AuditEventType::Encryption, level.clone(), true);
            assert_eq!(event.level, level);
        }
    }

    // 审计事件序列化测试
    #[test]
    fn test_audit_event_serialization() {
        let event = AuditEvent {
            event_type: AuditEventType::Encryption,
            level: AuditLevel::Info,
            timestamp: 1640995200, // 固定时间戳用于测试
            user_id: Some("user123".to_string()),
            resource_id: Some("resource456".to_string()),
            actor: Some("system".to_string()),
            success: true,
            details: "Encryption operation completed successfully".to_string(),
        };

        // 测试序列化
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event_type\":\"encryption\""));
        assert!(json.contains("\"level\":\"info\""));
        assert!(json.contains("\"success\":true"));

        // 测试反序列化
        let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.event_type, AuditEventType::Encryption);
        assert_eq!(deserialized.level, AuditLevel::Info);
        assert_eq!(deserialized.success, true);
        assert_eq!(deserialized.timestamp, 1640995200);
    }

    // 审计事件过滤器测试
    #[test]
    fn test_audit_event_filter() {
        let mut filter = AuditEventFilter::default();
        
        // 默认过滤器应该为空
        assert!(filter.event_type.is_none());
        assert!(filter.level.is_none());
        assert!(filter.resource_id.is_none());
        assert!(filter.actor.is_none());
        assert!(filter.success.is_none());
        assert!(filter.start_time.is_none());
        assert!(filter.end_time.is_none());
        assert!(filter.limit.is_none());

        // 设置过滤条件
        filter.event_type = Some(AuditEventType::Encryption);
        filter.level = Some(AuditLevel::Warning);
        filter.success = Some(true);
        filter.limit = Some(100);

        assert_eq!(filter.event_type.unwrap(), AuditEventType::Encryption);
        assert_eq!(filter.level.unwrap(), AuditLevel::Warning);
        assert_eq!(filter.success.unwrap(), true);
        assert_eq!(filter.limit.unwrap(), 100);
    }

    // 审计统计信息测试
    #[test]
    fn test_audit_statistics() {
        let mut events_by_type = HashMap::new();
        events_by_type.insert("encryption".to_string(), 10);
        events_by_type.insert("decryption".to_string(), 5);

        let mut events_by_level = HashMap::new();
        events_by_level.insert("info".to_string(), 12);
        events_by_level.insert("warning".to_string(), 3);

        let stats = AuditStatistics {
            total_events: 15,
            events_by_type,
            events_by_level,
            success_rate: 0.8,
        };

        assert_eq!(stats.total_events, 15);
        assert_eq!(stats.events_by_type.get("encryption"), Some(&10));
        assert_eq!(stats.events_by_level.get("info"), Some(&12));
        assert_eq!(stats.success_rate, 0.8);

        // 测试序列化
        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: AuditStatistics = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_events, 15);
        assert_eq!(deserialized.success_rate, 0.8);
    }

    // SecurityAuditor 测试
    #[test]
    fn test_security_auditor_creation() {
        let auditor = SecurityAuditor::new();
        assert!(auditor.is_ok());
    }

    #[test]
    fn test_security_auditor_log_event() {
        let auditor = SecurityAuditor::new().unwrap();
        let event = create_test_event(AuditEventType::Encryption, AuditLevel::Info, true);
        
        let result = auditor.log_event(event);
        assert!(result.is_ok());
    }

    #[test]
    fn test_security_auditor_get_events() {
        let auditor = SecurityAuditor::new().unwrap();
        
        let events = auditor.get_events(10).unwrap();
        assert_eq!(events.len(), 0); // 简化实现返回空向量
    }

    #[test]
    fn test_security_auditor_clear_old_events() {
        let auditor = SecurityAuditor::new().unwrap();
        
        let count = auditor.clear_old_events(30).unwrap();
        assert_eq!(count, 0); // 简化实现返回0
    }

    // SecurityAuditLogger 测试
    #[test]
    fn test_security_audit_logger_creation() {
        use std::env;
        let temp_path = env::temp_dir().join("audit_test.db");
        
        let logger = SecurityAuditLogger::new(&temp_path);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_security_audit_logger_query_events() {
        use std::env;
        let temp_path = env::temp_dir().join("audit_query_test.db");
        let logger = SecurityAuditLogger::new(&temp_path).unwrap();
        
        let filter = AuditEventFilter {
            event_type: Some(AuditEventType::Encryption),
            ..Default::default()
        };
        
        let events = logger.query_events(&filter);
        assert!(events.is_ok());
        assert_eq!(events.unwrap().len(), 0); // 简化实现返回空向量
    }

    #[test]
    fn test_security_audit_logger_cleanup() {
        use std::env;
        let temp_path = env::temp_dir().join("audit_cleanup_test.db");
        let logger = SecurityAuditLogger::new(&temp_path).unwrap();
        
        let count = logger.cleanup_old_logs(30);
        assert!(count.is_ok());
        assert_eq!(count.unwrap(), 0); // 简化实现返回0
    }

    #[test]
    fn test_security_audit_logger_statistics() {
        use std::env;
        let temp_path = env::temp_dir().join("audit_stats_test.db");
        let logger = SecurityAuditLogger::new(&temp_path).unwrap();
        
        let stats = logger.get_statistics();
        assert!(stats.is_ok());
        let stats = stats.unwrap();
        assert_eq!(stats.total_events, 0);
        assert_eq!(stats.success_rate, 0.0);
    }

    // 全局日志函数测试
    #[test]
    fn test_log_audit_success() {
        // 这些函数主要是日志记录，测试它们不会panic
        log_audit_success(
            AuditEventType::Encryption,
            "Test encryption success",
            Some("test_resource")
        );
        
        log_audit_success(
            AuditEventType::KeyGeneration,
            "Test key generation",
            None
        );
    }

    #[test]
    fn test_log_audit_failure() {
        log_audit_failure(
            AuditEventType::Decryption,
            "Test decryption failure",
            "Invalid key",
            Some("test_resource")
        );
        
        log_audit_failure(
            AuditEventType::PermissionGrant,
            "Permission denied",
            "Insufficient privileges",
            None
        );
    }

    #[test]
    fn test_init_global_audit_logger() {
        use std::env;
        let db_path = env::temp_dir().join("global_audit_test.db");
        
        let result = init_global_audit_logger(&db_path);
        assert!(result.is_ok());
    }

    #[test]
    fn test_log_audit_event() {
        let event = create_test_event(AuditEventType::SecurityViolation, AuditLevel::Critical, false);
        
        // 这个函数主要是日志记录，测试它不会panic
        log_audit_event(event);
    }

    // 边界条件测试
    #[test]
    fn test_audit_event_edge_cases() {
        // 空字符串测试
        let event = AuditEvent {
            event_type: AuditEventType::Encryption,
            level: AuditLevel::Info,
            timestamp: 0,
            user_id: Some("".to_string()),
            resource_id: Some("".to_string()),
            actor: Some("".to_string()),
            success: true,
            details: "".to_string(),
        };
        
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.user_id, Some("".to_string()));
        assert_eq!(deserialized.details, "");

        // None 值测试
        let event = AuditEvent {
            event_type: AuditEventType::KeyDeletion,
            level: AuditLevel::Error,
            timestamp: -1, // 负时间戳
            user_id: None,
            resource_id: None,
            actor: None,
            success: false,
            details: "Critical error occurred".to_string(),
        };
        
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.user_id, None);
        assert_eq!(deserialized.resource_id, None);
        assert_eq!(deserialized.actor, None);
    }

    // 性能测试
    #[test]
    fn test_audit_performance() {
        let start = std::time::Instant::now();
        
        // 创建大量审计事件
        for i in 0..1000 {
            let event = AuditEvent {
                event_type: if i % 2 == 0 { AuditEventType::Encryption } else { AuditEventType::Decryption },
                level: AuditLevel::Info,
                timestamp: i as i64,
                user_id: Some(format!("user_{}", i)),
                resource_id: Some(format!("resource_{}", i)),
                actor: Some("system".to_string()),
                success: i % 3 != 0,
                details: format!("Operation {} completed", i),
            };
            
            // 序列化性能测试
            let _json = serde_json::to_string(&event).unwrap();
            
            // 日志记录性能测试
            log_audit_event(event);
        }
        
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 1000); // 应该在1秒内完成
    }

    // 并发测试 - 优化版本，避免死锁
    #[test]
    fn test_concurrent_audit_logging() {
        use std::sync::Arc;
        use std::thread;
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::{Duration, Instant};
        
        let auditor = Arc::new(SecurityAuditor::new().unwrap());
        let success_counter = Arc::new(AtomicUsize::new(0));
        let mut handles = vec![];
        
        // 减少线程数量，避免资源竞争
        for i in 0..2 {
            let auditor_clone = auditor.clone();
            let counter_clone = success_counter.clone();
            let handle = thread::spawn(move || {
                let start = Instant::now();
                let mut attempts = 0;
                // 添加超时保护，避免无限等待
                while start.elapsed() < Duration::from_millis(100) && attempts < 3 {
                    let event = AuditEvent {
                        event_type: AuditEventType::Encryption,
                        level: AuditLevel::Info,
                        timestamp: (i * 100 + attempts) as i64,
                        user_id: Some(format!("user_{}_{}", i, attempts)),
                        resource_id: Some(format!("resource_{}_{}", i, attempts)),
                        actor: Some("concurrent_test".to_string()),
                        success: true,
                        details: format!("Concurrent operation {} {}", i, attempts),
                    };
                    
                    if auditor_clone.log_event(event).is_ok() {
                        counter_clone.fetch_add(1, Ordering::Relaxed);
                    }
                    
                    attempts += 1;
                    // 短暂休眠避免过度竞争
                    thread::sleep(Duration::from_millis(5));
                }
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成，设置合理超时
        for handle in handles {
            handle.join().expect("Audit thread should complete");
        }
        
        // 验证至少有一些操作成功完成
        assert!(success_counter.load(Ordering::Relaxed) > 0);
        let events = auditor.get_events(1000).unwrap();
        assert_eq!(events.len(), 0); // 简化实现返回空向量，但操作应该成功
    }

    // 添加更多精确的测试用例
    
    // 审计事件去重测试
    #[test]
    fn test_audit_event_deduplication() {
        let event1 = AuditEvent {
            event_type: AuditEventType::Encryption,
            level: AuditLevel::Info,
            timestamp: 1640995200,
            user_id: Some("test_user".to_string()),
            resource_id: Some("test_resource".to_string()),
            actor: Some("system".to_string()),
            success: true,
            details: "Test event".to_string(),
        };
        
        let event2 = AuditEvent {
            event_type: AuditEventType::Encryption,
            level: AuditLevel::Info,
            timestamp: 1640995200, // 相同时间戳
            user_id: Some("test_user".to_string()),
            resource_id: Some("test_resource".to_string()),
            actor: Some("system".to_string()),
            success: true,
            details: "Test event".to_string(), // 相同内容
        };
        
        // 测试序列化后的内容是否相同
        let json1 = serde_json::to_string(&event1).unwrap();
        let json2 = serde_json::to_string(&event2).unwrap();
        assert_eq!(json1, json2);
    }

    // 审计级别优先级测试
    #[test]
    fn test_audit_level_priority() {
        let levels = vec![
            (AuditLevel::Debug, "debug"),
            (AuditLevel::Info, "info"),
            (AuditLevel::Warning, "warning"),
            (AuditLevel::Error, "error"),
            (AuditLevel::Critical, "critical"),
        ];
        
        for (level, expected_str) in levels {
            let event = create_test_event(AuditEventType::SecurityViolation, level, false);
            let json = serde_json::to_string(&event).unwrap();
            assert!(json.contains(&format!("\"level\":\"{}\"", expected_str)));
        }
    }

    // 大量事件序列化性能测试
    #[test]
    fn test_large_event_serialization() {
        let start = std::time::Instant::now();
        
        for i in 0..100 {
            let event = AuditEvent {
                event_type: AuditEventType::SensitiveDataAccess,
                level: AuditLevel::Warning,
                timestamp: i as i64,
                user_id: Some(format!("bulk_user_{}", i)),
                resource_id: Some(format!("bulk_resource_{}", i)),
                actor: Some("bulk_processor".to_string()),
                success: i % 2 == 0,
                details: format!("Bulk operation {} with detailed description that might be longer", i),
            };
            
            let json = serde_json::to_string(&event).unwrap();
            assert!(json.len() > 0);
            
            // 反序列化测试
            let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized.timestamp, i as i64);
        }
        
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 100); // 应该在100ms内完成
    }

    // 审计事件过滤器复合条件测试
    #[test]
    fn test_complex_audit_filter() {
        let mut filter = AuditEventFilter::default();
        
        // 设置复合过滤条件
        filter.event_type = Some(AuditEventType::KeyRotation);
        filter.level = Some(AuditLevel::Critical);
        filter.success = Some(false);
        filter.start_time = Some(1640995200);
        filter.end_time = Some(1641081600);
        filter.limit = Some(50);
        filter.resource_id = Some("critical_resource".to_string());
        filter.actor = Some("security_system".to_string());
        
        // 验证所有条件都被正确设置
        assert_eq!(filter.event_type.unwrap(), AuditEventType::KeyRotation);
        assert_eq!(filter.level.unwrap(), AuditLevel::Critical);
        assert_eq!(filter.success.unwrap(), false);
        assert_eq!(filter.start_time.unwrap(), 1640995200);
        assert_eq!(filter.end_time.unwrap(), 1641081600);
        assert_eq!(filter.limit.unwrap(), 50);
        assert_eq!(filter.resource_id.as_ref().unwrap(), "critical_resource");
        assert_eq!(filter.actor.as_ref().unwrap(), "security_system");
    }

    // 审计统计信息完整性测试
    #[test]
    fn test_audit_statistics_integrity() {
        let mut events_by_type = HashMap::new();
        events_by_type.insert("encryption".to_string(), 15);
        events_by_type.insert("decryption".to_string(), 10);
        events_by_type.insert("key_generation".to_string(), 5);

        let mut events_by_level = HashMap::new();
        events_by_level.insert("info".to_string(), 20);
        events_by_level.insert("warning".to_string(), 8);
        events_by_level.insert("error".to_string(), 2);

        let total_events = 30i64;
        let successful_events = 25i64;

        let stats = AuditStatistics {
            total_events,
            events_by_type: events_by_type.clone(),
            events_by_level: events_by_level.clone(),
            success_rate: (successful_events as f64) / (total_events as f64),
        };

        // 验证统计数据的一致性
        let type_sum: i64 = events_by_type.values().sum();
        let level_sum: i64 = events_by_level.values().sum();
        
        assert_eq!(type_sum, total_events);
        assert_eq!(level_sum, total_events);
        assert!((stats.success_rate - 0.8333333333333334).abs() < 0.0001);
        
        // 测试序列化和反序列化
        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: AuditStatistics = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_events, total_events);
        assert!((deserialized.success_rate - stats.success_rate).abs() < 0.0001);
    }

    // 错误场景下的审计日志测试
    #[test]
    fn test_audit_error_scenarios() {
        // 测试各种错误场景的审计事件
        let error_scenarios = vec![
            (AuditEventType::KeyDeletion, "Key not found"),
            (AuditEventType::PermissionGrant, "Insufficient privileges"),
            (AuditEventType::ConfigChange, "Invalid configuration"),
            (AuditEventType::SecurityViolation, "Unauthorized access attempt"),
        ];

        for (event_type, error_msg) in error_scenarios {
            let event = AuditEvent {
                event_type: event_type.clone(),
                level: AuditLevel::Error,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64,
                user_id: Some("error_test_user".to_string()),
                resource_id: Some("error_test_resource".to_string()),
                actor: Some("error_test_system".to_string()),
                success: false,
                details: error_msg.to_string(),
            };

            // 验证错误事件可以正确序列化
            let json = serde_json::to_string(&event).unwrap();
            assert!(json.contains("\"success\":false"));
            assert!(json.contains(error_msg));
            
            // 验证可以正确反序列化
            let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized.event_type, event_type);
            assert!(!deserialized.success);
            assert_eq!(deserialized.details, error_msg);
        }
    }

    // 时间戳精度和排序测试
    #[test]
    fn test_timestamp_precision_and_ordering() {
        let mut events = Vec::new();
        
        // 创建一系列有序的审计事件
        for i in 0..10 {
            let timestamp = 1640995200 + i * 3600; // 每小时一个事件
            let event = AuditEvent {
                event_type: AuditEventType::SensitiveDataAccess,
                level: AuditLevel::Info,
                timestamp,
                user_id: Some(format!("time_test_user_{}", i)),
                resource_id: Some(format!("time_test_resource_{}", i)),
                actor: Some("time_test_system".to_string()),
                success: true,
                details: format!("Timed operation {}", i),
            };
            events.push(event);
        }
        
        // 验证时间戳排序
        for i in 1..events.len() {
            assert!(events[i].timestamp > events[i-1].timestamp);
            assert_eq!(events[i].timestamp - events[i-1].timestamp, 3600);
        }
        
        // 测试时间戳序列化精度
        let json = serde_json::to_string(&events[0]).unwrap();
        let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.timestamp, events[0].timestamp);
    }

    // 过滤器验证测试
    #[test]
    fn test_audit_filter_validation() {
        let mut filter = AuditEventFilter::default();
        
        // 时间范围测试
        filter.start_time = Some(1640995200);
        filter.end_time = Some(1641081600);
        assert!(filter.end_time.unwrap() > filter.start_time.unwrap());
        
        // 限制数量测试
        filter.limit = Some(0);
        assert_eq!(filter.limit.unwrap(), 0);
        
        filter.limit = Some(usize::MAX);
        assert_eq!(filter.limit.unwrap(), usize::MAX);
    }

    // 类型转换测试
    #[test]
    fn test_enum_equality() {
        assert_eq!(AuditEventType::Encryption, AuditEventType::Encryption);
        assert_ne!(AuditEventType::Encryption, AuditEventType::Decryption);
        
        assert_eq!(AuditLevel::Critical, AuditLevel::Critical);
        assert_ne!(AuditLevel::Info, AuditLevel::Warning);
    }

    // Clone 和 Debug trait 测试
    #[test]
    fn test_trait_implementations() {
        let event_type = AuditEventType::Encryption;
        let cloned_type = event_type.clone();
        assert_eq!(event_type, cloned_type);
        
        let level = AuditLevel::Warning;
        let debug_str = format!("{:?}", level);
        assert!(debug_str.contains("Warning"));
        
        let event = create_test_event(AuditEventType::KeyGeneration, AuditLevel::Info, true);
        let cloned_event = event.clone();
        assert_eq!(event.event_type, cloned_event.event_type);
        assert_eq!(event.success, cloned_event.success);
    }
}


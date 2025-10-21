// tests/unit/utils/security_audit_test.rs
//! 安全审计日志系统测试
//!
//! 测试审计事件记录、查询、统计和清理功能

use zishu_sensei::utils::security_audit::*;
use tempfile::tempdir;
use std::path::PathBuf;

/// 创建测试用的审计日志器
fn create_test_logger() -> (SecurityAuditLogger, tempfile::TempDir) {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("audit_test.db");
    let logger = SecurityAuditLogger::new(&db_path).unwrap();
    (logger, temp_dir)
}

// ========================================
// 审计事件记录测试
// ========================================

mod event_logging {
    use super::*;

    #[test]
    fn test_log_event_success() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::KeyGeneration,
            level: AuditLevel::Info,
            description: "生成新的主密钥".to_string(),
            resource_id: Some("key-001".to_string()),
            actor: Some("user-123".to_string()),
            client_ip: Some("192.168.1.100".to_string()),
            metadata: Some(r#"{"algorithm":"AES-256-GCM"}"#.to_string()),
            success: true,
            error_message: None,
            timestamp: chrono::Utc::now().timestamp(),
        };

        // ========== Act ==========
        let result = logger.log_event(event.clone());

        // ========== Assert ==========
        assert!(result.is_ok());

        // 验证可以查询到
        let filter = AuditEventFilter {
            resource_id: Some("key-001".to_string()),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, event.description);
    }

    #[test]
    fn test_log_success_shortcut() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let event_type = AuditEventType::Encryption;
        let description = "加密敏感数据";
        let resource_id = "data-001";

        // ========== Act ==========
        let result = logger.log_success(event_type.clone(), description, Some(resource_id));

        // ========== Assert ==========
        assert!(result.is_ok());

        let filter = AuditEventFilter {
            event_type: Some(event_type),
            success: Some(true),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, description);
        assert!(events[0].success);
    }

    #[test]
    fn test_log_failure_shortcut() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let event_type = AuditEventType::Decryption;
        let description = "解密失败";
        let error_message = "密钥不匹配";
        let resource_id = "key-002";

        // ========== Act ==========
        let result = logger.log_failure(
            event_type.clone(),
            description,
            error_message,
            Some(resource_id),
        );

        // ========== Assert ==========
        assert!(result.is_ok());

        let filter = AuditEventFilter {
            success: Some(false),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, description);
        assert!(!events[0].success);
        assert_eq!(events[0].error_message.as_ref().unwrap(), error_message);
    }

    #[test]
    fn test_log_multiple_events() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let event_types = vec![
            AuditEventType::KeyGeneration,
            AuditEventType::KeyLoading,
            AuditEventType::Encryption,
            AuditEventType::Decryption,
        ];

        // ========== Act ==========
        for (i, event_type) in event_types.iter().enumerate() {
            logger.log_success(
                event_type.clone(),
                &format!("事件 {}", i),
                Some(&format!("resource-{}", i)),
            ).unwrap();
        }

        // ========== Assert ==========
        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), event_types.len());
    }

    #[test]
    fn test_log_event_with_all_levels() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let levels = vec![
            AuditLevel::Debug,
            AuditLevel::Info,
            AuditLevel::Warning,
            AuditLevel::Error,
            AuditLevel::Critical,
        ];

        // ========== Act ==========
        for level in &levels {
            let event = AuditEvent {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: AuditEventType::SecurityError,
                level: level.clone(),
                description: format!("测试级别: {:?}", level),
                resource_id: None,
                actor: None,
                client_ip: None,
                metadata: None,
                success: true,
                error_message: None,
                timestamp: chrono::Utc::now().timestamp(),
            };
            logger.log_event(event).unwrap();
        }

        // ========== Assert ==========
        for level in levels {
            let filter = AuditEventFilter {
                level: Some(level.clone()),
                ..Default::default()
            };
            let events = logger.query_events(&filter).unwrap();
            assert_eq!(events.len(), 1);
        }
    }
}

// ========================================
// 审计事件查询测试
// ========================================

mod event_querying {
    use super::*;

    #[test]
    fn test_query_by_event_type() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        logger.log_success(AuditEventType::KeyGeneration, "生成密钥", None).unwrap();
        logger.log_success(AuditEventType::Encryption, "加密数据", None).unwrap();
        logger.log_success(AuditEventType::Encryption, "再次加密", None).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            event_type: Some(AuditEventType::Encryption),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 2);
        for event in events {
            assert_eq!(event.event_type, AuditEventType::Encryption);
        }
    }

    #[test]
    fn test_query_by_level() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();

        let event1 = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::SecurityError,
            level: AuditLevel::Error,
            description: "错误事件".to_string(),
            resource_id: None,
            actor: None,
            client_ip: None,
            metadata: None,
            success: false,
            error_message: Some("错误".to_string()),
            timestamp: chrono::Utc::now().timestamp(),
        };
        
        logger.log_event(event1).unwrap();
        logger.log_success(AuditEventType::KeyGeneration, "正常事件", None).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            level: Some(AuditLevel::Error),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].level, AuditLevel::Error);
    }

    #[test]
    fn test_query_by_resource_id() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        logger.log_success(AuditEventType::KeyGeneration, "密钥1", Some("key-001")).unwrap();
        logger.log_success(AuditEventType::KeyGeneration, "密钥2", Some("key-002")).unwrap();
        logger.log_success(AuditEventType::Encryption, "加密1", Some("key-001")).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            resource_id: Some("key-001".to_string()),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 2);
        for event in events {
            assert_eq!(event.resource_id.as_ref().unwrap(), "key-001");
        }
    }

    #[test]
    fn test_query_by_actor() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();

        let event1 = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::AuthenticationAttempt,
            level: AuditLevel::Info,
            description: "用户登录".to_string(),
            resource_id: None,
            actor: Some("user-001".to_string()),
            client_ip: None,
            metadata: None,
            success: true,
            error_message: None,
            timestamp: chrono::Utc::now().timestamp(),
        };

        let event2 = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::AuthenticationAttempt,
            level: AuditLevel::Info,
            description: "用户登录".to_string(),
            resource_id: None,
            actor: Some("user-002".to_string()),
            client_ip: None,
            metadata: None,
            success: true,
            error_message: None,
            timestamp: chrono::Utc::now().timestamp(),
        };

        logger.log_event(event1).unwrap();
        logger.log_event(event2).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            actor: Some("user-001".to_string()),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].actor.as_ref().unwrap(), "user-001");
    }

    #[test]
    fn test_query_by_success_status() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        logger.log_success(AuditEventType::Encryption, "成功", None).unwrap();
        logger.log_failure(AuditEventType::Decryption, "失败", "错误", None).unwrap();
        logger.log_success(AuditEventType::KeyGeneration, "成功", None).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            success: Some(false),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 1);
        assert!(!events[0].success);
    }

    #[test]
    fn test_query_by_time_range() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        let now = chrono::Utc::now().timestamp();
        let past = now - 3600; // 1小时前
        let future = now + 3600; // 1小时后

        logger.log_success(AuditEventType::KeyGeneration, "事件1", None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        logger.log_success(AuditEventType::Encryption, "事件2", None).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            start_time: Some(past),
            end_time: Some(future),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert!(events.len() >= 2);
    }

    #[test]
    fn test_query_with_limit() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        for i in 0..10 {
            logger.log_success(
                AuditEventType::Encryption,
                &format!("事件 {}", i),
                None
            ).unwrap();
        }

        // ========== Act ==========
        let filter = AuditEventFilter {
            limit: Some(5),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 5);
    }

    #[test]
    fn test_query_with_multiple_filters() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        logger.log_success(AuditEventType::Encryption, "匹配", Some("key-001")).unwrap();
        logger.log_success(AuditEventType::Decryption, "不匹配类型", Some("key-001")).unwrap();
        logger.log_success(AuditEventType::Encryption, "不匹配资源", Some("key-002")).unwrap();

        // ========== Act ==========
        let filter = AuditEventFilter {
            event_type: Some(AuditEventType::Encryption),
            resource_id: Some("key-001".to_string()),
            success: Some(true),
            ..Default::default()
        };
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, "匹配");
    }

    #[test]
    fn test_query_returns_ordered_by_timestamp_desc() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        for i in 0..5 {
            logger.log_success(
                AuditEventType::Encryption,
                &format!("事件 {}", i),
                None
            ).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Act ==========
        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();

        // ========== Assert ==========
        assert_eq!(events.len(), 5);
        // 应该按时间戳降序排列
        for i in 1..events.len() {
            assert!(events[i-1].timestamp >= events[i].timestamp);
        }
    }
}

// ========================================
// 审计统计测试
// ========================================

mod statistics {
    use super::*;

    #[test]
    fn test_get_statistics() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        // 记录各种事件
        logger.log_success(AuditEventType::KeyGeneration, "成功1", None).unwrap();
        logger.log_success(AuditEventType::Encryption, "成功2", None).unwrap();
        logger.log_failure(AuditEventType::Decryption, "失败1", "错误", None).unwrap();
        
        let critical_event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::SecurityError,
            level: AuditLevel::Critical,
            description: "严重错误".to_string(),
            resource_id: None,
            actor: None,
            client_ip: None,
            metadata: None,
            success: false,
            error_message: Some("严重安全问题".to_string()),
            timestamp: chrono::Utc::now().timestamp(),
        };
        logger.log_event(critical_event).unwrap();

        // ========== Act ==========
        let stats = logger.get_statistics().unwrap();

        // ========== Assert ==========
        assert_eq!(stats.total_events, 4);
        assert_eq!(stats.failed_events, 2); // 1个失败 + 1个严重错误
        assert_eq!(stats.critical_events, 1);
    }

    #[test]
    fn test_empty_statistics() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();

        // ========== Act ==========
        let stats = logger.get_statistics().unwrap();

        // ========== Assert ==========
        assert_eq!(stats.total_events, 0);
        assert_eq!(stats.failed_events, 0);
        assert_eq!(stats.critical_events, 0);
    }
}

// ========================================
// 日志清理测试
// ========================================

mod cleanup {
    use super::*;

    #[test]
    fn test_cleanup_old_logs() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        // 创建一些旧事件（通过直接插入数据库）
        let old_timestamp = chrono::Utc::now().timestamp() - (40 * 86400); // 40天前
        let old_event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::KeyGeneration,
            level: AuditLevel::Info,
            description: "旧事件".to_string(),
            resource_id: None,
            actor: None,
            client_ip: None,
            metadata: None,
            success: true,
            error_message: None,
            timestamp: old_timestamp,
        };
        logger.log_event(old_event).unwrap();

        // 创建新事件
        logger.log_success(AuditEventType::Encryption, "新事件", None).unwrap();

        // ========== Act ==========
        let cleaned = logger.cleanup_old_logs(30).unwrap(); // 清理30天以上的

        // ========== Assert ==========
        assert_eq!(cleaned, 1); // 应该清理了1条旧记录

        // 验证新事件还在
        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, "新事件");
    }

    #[test]
    fn test_cleanup_returns_zero_if_no_old_logs() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        
        logger.log_success(AuditEventType::Encryption, "新事件", None).unwrap();

        // ========== Act ==========
        let cleaned = logger.cleanup_old_logs(30).unwrap();

        // ========== Assert ==========
        assert_eq!(cleaned, 0);
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_log_event_with_very_long_description() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let long_description = "A".repeat(10000);

        // ========== Act ==========
        let result = logger.log_success(
            AuditEventType::Encryption,
            &long_description,
            None
        );

        // ========== Assert ==========
        assert!(result.is_ok());

        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events[0].description.len(), 10000);
    }

    #[test]
    fn test_log_event_with_complex_metadata() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let metadata = r#"{"user":"张三","action":"加密","data":{"files":["file1.txt","file2.pdf"],"size":1024}}"#;

        let event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: AuditEventType::Encryption,
            level: AuditLevel::Info,
            description: "带元数据的事件".to_string(),
            resource_id: None,
            actor: None,
            client_ip: None,
            metadata: Some(metadata.to_string()),
            success: true,
            error_message: None,
            timestamp: chrono::Utc::now().timestamp(),
        };

        // ========== Act ==========
        let result = logger.log_event(event);

        // ========== Assert ==========
        assert!(result.is_ok());

        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events[0].metadata.as_ref().unwrap(), metadata);
    }

    #[test]
    fn test_handle_database_reopen() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("audit.db");

        // 创建第一个logger并记录事件
        {
            let logger = SecurityAuditLogger::new(&db_path).unwrap();
            logger.log_success(AuditEventType::KeyGeneration, "事件1", None).unwrap();
        }

        // ========== Act ==========
        // 重新打开数据库
        let logger = SecurityAuditLogger::new(&db_path).unwrap();
        logger.log_success(AuditEventType::Encryption, "事件2", None).unwrap();

        // ========== Assert ==========
        let filter = AuditEventFilter::default();
        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 2);
    }
}

// ========================================
// 事件类型和级别测试
// ========================================

mod event_types_and_levels {
    use super::*;

    #[test]
    fn test_all_event_types() {
        // ========== Arrange ==========
        let (logger, _temp_dir) = create_test_logger();
        let event_types = vec![
            AuditEventType::Encryption,
            AuditEventType::Decryption,
            AuditEventType::KeyGeneration,
            AuditEventType::KeyLoading,
            AuditEventType::KeyRotation,
            AuditEventType::KeyDeletion,
            AuditEventType::SensitiveDataAccess,
            AuditEventType::AuthenticationAttempt,
            AuditEventType::AuthorizationCheck,
            AuditEventType::ConfigurationChange,
            AuditEventType::DataExport,
            AuditEventType::DataImport,
            AuditEventType::PermissionChange,
            AuditEventType::SecurityError,
        ];

        // ========== Act & Assert ==========
        for event_type in event_types {
            let result = logger.log_success(event_type.clone(), "测试", None);
            assert!(result.is_ok());

            let filter = AuditEventFilter {
                event_type: Some(event_type),
                ..Default::default()
            };
            let events = logger.query_events(&filter).unwrap();
            assert_eq!(events.len(), 1);
        }
    }

    #[test]
    fn test_audit_level_ordering() {
        // ========== Arrange & Assert ==========
        assert!(AuditLevel::Debug < AuditLevel::Info);
        assert!(AuditLevel::Info < AuditLevel::Warning);
        assert!(AuditLevel::Warning < AuditLevel::Error);
        assert!(AuditLevel::Error < AuditLevel::Critical);
    }
}


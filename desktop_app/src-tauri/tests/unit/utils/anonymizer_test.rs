// tests/unit/utils/anonymizer_test.rs
//! 数据匿名化工具测试
//!
//! 测试使用统计数据匿名化、IP地址匿名化等功能

use zishu_sensei::utils::anonymizer::*;
use std::collections::HashMap;

// ========================================
// IP地址匿名化测试
// ========================================

mod ip_anonymization {
    use super::*;

    #[test]
    fn test_anonymize_ipv4() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let ip = "192.168.1.100";

        // ========== Act ==========
        let anonymized = anonymizer.anonymize_ip(ip);

        // ========== Assert ==========
        assert_eq!(anonymized, "192.168.***.***");
        assert!(!anonymized.contains("1.100"));
    }

    #[test]
    fn test_anonymize_ipv4_preserves_network_prefix() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let ips = vec![
            "10.0.0.1",
            "10.0.5.128",
            "10.0.255.255",
        ];

        // ========== Act & Assert ==========
        for ip in ips {
            let anonymized = anonymizer.anonymize_ip(ip);
            assert_eq!(anonymized, "10.0.***.***");
        }
    }

    #[test]
    fn test_anonymize_ipv6() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";

        // ========== Act ==========
        let anonymized = anonymizer.anonymize_ip(ip);

        // ========== Assert ==========
        assert!(anonymized.starts_with("2001:0db8:85a3:0000"));
        assert!(anonymized.contains("****"));
        assert!(!anonymized.contains("7334"));
    }

    #[test]
    fn test_anonymize_ipv6_short_format() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let ip = "2001:db8::1";

        // ========== Act ==========
        let anonymized = anonymizer.anonymize_ip(ip);

        // ========== Assert ==========
        // 应该有默认的匿名化
        assert!(anonymized.contains("****"));
    }

    #[test]
    fn test_anonymize_ipv4_localhost() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let ip = "127.0.0.1";

        // ========== Act ==========
        let anonymized = anonymizer.anonymize_ip(ip);

        // ========== Assert ==========
        assert_eq!(anonymized, "127.0.***.***");
    }

    #[test]
    fn test_anonymize_invalid_ip() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let invalid_ip = "not.an.ip.address";

        // ========== Act ==========
        let anonymized = anonymizer.anonymize_ip(invalid_ip);

        // ========== Assert ==========
        // 应该有某种默认处理
        assert!(anonymized.len() > 0);
    }
}

// ========================================
// 使用统计匿名化测试
// ========================================

mod statistics_anonymization {
    use super::*;

    fn create_test_statistics() -> UsageStatistics {
        let mut event_data = HashMap::new();
        event_data.insert("action".to_string(), serde_json::json!("click"));
        event_data.insert("target".to_string(), serde_json::json!("button"));

        UsageStatistics {
            user_id: Some("user-123".to_string()),
            session_id: "session-456".to_string(),
            event_type: "user_interaction".to_string(),
            event_data,
            timestamp: 1234567890,
            ip_address: Some("192.168.1.100".to_string()),
            user_agent: Some("Mozilla/5.0".to_string()),
            device_id: Some("device-789".to_string()),
            location: Some(Location {
                country: Some("China".to_string()),
                region: Some("Beijing".to_string()),
                city: Some("Beijing".to_string()),
                latitude: Some(39.9042),
                longitude: Some(116.4074),
            }),
            app_version: "1.0.0".to_string(),
            os_type: "Linux".to_string(),
            os_version: "5.15.0".to_string(),
        }
    }

    #[test]
    fn test_anonymize_statistics_with_full_options() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let stats = create_test_statistics();
        let options = AnonymizationOptions::default();

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats.clone(), &options);

        // ========== Assert ==========
        // 用户ID应该被哈希化
        assert_ne!(anonymous.anonymous_id, stats.user_id.unwrap());
        assert_eq!(anonymous.anonymous_id.len(), 64); // SHA256哈希长度

        // 会话ID应该被哈希化
        assert_ne!(anonymous.session_hash, stats.session_id);

        // 只保留国家信息
        assert_eq!(anonymous.country, Some("China".to_string()));

        // 其他非敏感信息应该保留
        assert_eq!(anonymous.event_type, stats.event_type);
        assert_eq!(anonymous.app_version, stats.app_version);
        assert_eq!(anonymous.os_type, stats.os_type);
    }

    #[test]
    fn test_anonymize_statistics_without_user_id_anonymization() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let stats = create_test_statistics();
        let options = AnonymizationOptions {
            anonymize_user_id: false,
            ..Default::default()
        };

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats.clone(), &options);

        // ========== Assert ==========
        // 用户ID应该保持原样
        assert_eq!(anonymous.anonymous_id, stats.user_id.unwrap());
    }

    #[test]
    fn test_anonymize_statistics_without_location_anonymization() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let stats = create_test_statistics();
        let options = AnonymizationOptions {
            anonymize_location: false,
            ..Default::default()
        };

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats, &options);

        // ========== Assert ==========
        // 位置信息应该被移除
        assert!(anonymous.country.is_none());
    }

    #[test]
    fn test_anonymize_statistics_removes_sensitive_fields() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let mut stats = create_test_statistics();
        
        // 添加敏感字段
        stats.event_data.insert("email".to_string(), serde_json::json!("user@example.com"));
        stats.event_data.insert("password".to_string(), serde_json::json!("secret123"));
        stats.event_data.insert("api_key".to_string(), serde_json::json!("sk-123456"));

        let options = AnonymizationOptions::default();

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats, &options);

        // ========== Assert ==========
        // 敏感字段应该被移除
        assert!(!anonymous.event_data.contains_key("email"));
        assert!(!anonymous.event_data.contains_key("password"));
        assert!(!anonymous.event_data.contains_key("api_key"));

        // 非敏感字段应该保留
        assert!(anonymous.event_data.contains_key("action"));
    }

    #[test]
    fn test_anonymize_statistics_hashes_name_fields() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let mut stats = create_test_statistics();
        
        stats.event_data.insert("user_name".to_string(), serde_json::json!("John Doe"));
        stats.event_data.insert("file_id".to_string(), serde_json::json!("file-123"));

        let options = AnonymizationOptions::default();

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats.clone(), &options);

        // ========== Assert ==========
        // 包含 "name" 或 "id" 的字段应该被哈希化
        if let Some(name_value) = anonymous.event_data.get("user_name") {
            let name_str = name_value.as_str().unwrap();
            assert_ne!(name_str, "John Doe");
            assert_eq!(name_str.len(), 64); // SHA256哈希
        }
    }

    #[test]
    fn test_anonymize_statistics_consistent_hashing() {
        // ========== Arrange ==========
        let salt = "test-salt-123".to_string();
        let anonymizer = Anonymizer::new_with_salt(salt);
        let stats = create_test_statistics();
        let options = AnonymizationOptions::default();

        // ========== Act ==========
        let anonymous1 = anonymizer.anonymize_statistics(stats.clone(), &options);
        let anonymous2 = anonymizer.anonymize_statistics(stats, &options);

        // ========== Assert ==========
        // 使用相同盐值，相同数据应该产生相同哈希
        assert_eq!(anonymous1.anonymous_id, anonymous2.anonymous_id);
        assert_eq!(anonymous1.session_hash, anonymous2.session_hash);
    }
}

// ========================================
// 盐值哈希测试
// ========================================

mod hash_with_salt {
    use super::*;

    #[test]
    fn test_hash_with_salt_produces_consistent_output() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new_with_salt("fixed-salt".to_string());
        let input = "test-data";

        // ========== Act ==========
        let hash1 = anonymizer.generate_anonymous_device_id(input);
        let hash2 = anonymizer.generate_anonymous_device_id(input);

        // ========== Assert ==========
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA256
    }

    #[test]
    fn test_hash_with_different_salts_produces_different_output() {
        // ========== Arrange ==========
        let anonymizer1 = Anonymizer::new_with_salt("salt1".to_string());
        let anonymizer2 = Anonymizer::new_with_salt("salt2".to_string());
        let input = "test-data";

        // ========== Act ==========
        let hash1 = anonymizer1.generate_anonymous_device_id(input);
        let hash2 = anonymizer2.generate_anonymous_device_id(input);

        // ========== Assert ==========
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hash_with_different_inputs_produces_different_output() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new_with_salt("salt".to_string());

        // ========== Act ==========
        let hash1 = anonymizer.generate_anonymous_device_id("input1");
        let hash2 = anonymizer.generate_anonymous_device_id("input2");

        // ========== Assert ==========
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hash_with_empty_input() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();

        // ========== Act ==========
        let hash = anonymizer.generate_anonymous_device_id("");

        // ========== Assert ==========
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_hash_with_unicode_input() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let input = "测试数据🔒";

        // ========== Act ==========
        let hash = anonymizer.generate_anonymous_device_id(input);

        // ========== Assert ==========
        assert_eq!(hash.len(), 64);
    }
}

// ========================================
// 敏感数据检测测试
// ========================================

mod sensitive_data_detection {
    use super::*;

    #[test]
    fn test_contains_sensitive_data_with_email() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Contact me at user@example.com";

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data(text);

        // ========== Assert ==========
        assert!(contains);
    }

    #[test]
    fn test_contains_sensitive_data_with_phone() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let texts = vec![
            "Call 123-456-7890",
            "Phone: 13812345678",
            "Mobile: 555.123.4567",
        ];

        // ========== Act & Assert ==========
        for text in texts {
            assert!(anonymizer.contains_sensitive_data(text));
        }
    }

    #[test]
    fn test_contains_sensitive_data_with_ip() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Server IP: 192.168.1.100";

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data(text);

        // ========== Assert ==========
        assert!(contains);
    }

    #[test]
    fn test_contains_sensitive_data_with_api_key() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let texts = vec![
            "api_key: abc123",
            "API-KEY=xyz789",
            r#"token: "secret123""#,
        ];

        // ========== Act & Assert ==========
        for text in texts {
            assert!(anonymizer.contains_sensitive_data(text));
        }
    }

    #[test]
    fn test_contains_sensitive_data_with_clean_text() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "This is a normal message without any sensitive information.";

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data(text);

        // ========== Assert ==========
        assert!(!contains);
    }

    #[test]
    fn test_contains_sensitive_data_with_multiple_types() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Email: user@example.com, Phone: 123-456-7890, IP: 10.0.0.1";

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data(text);

        // ========== Assert ==========
        assert!(contains);
    }
}

// ========================================
// 敏感文本脱敏测试
// ========================================

mod sensitive_text_redaction {
    use super::*;

    #[test]
    fn test_redact_sensitive_text_email() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Contact john@example.com for more info";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(!redacted.contains("john@example.com"));
        assert!(redacted.contains("[EMAIL_REDACTED]"));
    }

    #[test]
    fn test_redact_sensitive_text_phone() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Call me at 123-456-7890";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(!redacted.contains("123-456-7890"));
        assert!(redacted.contains("[PHONE_REDACTED]"));
    }

    #[test]
    fn test_redact_sensitive_text_ip() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Server IP is 192.168.1.100";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(!redacted.contains("192.168.1.100"));
        assert!(redacted.contains("[IP_REDACTED]"));
    }

    #[test]
    fn test_redact_sensitive_text_api_key() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "api_key=sk-123456789";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(!redacted.contains("sk-123456789"));
        assert!(redacted.contains("[REDACTED]"));
    }

    #[test]
    fn test_redact_sensitive_text_multiple() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "Email: user@example.com, Phone: 123-456-7890, IP: 10.0.0.1, api-key: secret123";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(redacted.contains("[EMAIL_REDACTED]"));
        assert!(redacted.contains("[PHONE_REDACTED]"));
        assert!(redacted.contains("[IP_REDACTED]"));
        assert!(redacted.contains("[REDACTED]"));
        assert!(!redacted.contains("user@example.com"));
        assert!(!redacted.contains("123-456-7890"));
        assert!(!redacted.contains("10.0.0.1"));
    }

    #[test]
    fn test_redact_sensitive_text_preserves_structure() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "User email@test.com has phone 123-456-7890";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(redacted.contains("User"));
        assert!(redacted.contains("has"));
    }

    #[test]
    fn test_redact_sensitive_text_no_sensitive_data() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "This is a clean message";

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert_eq!(redacted, text);
    }
}

// ========================================
// 隐私日志记录器测试
// ========================================

mod privacy_logger {
    use super::*;

    #[test]
    fn test_privacy_logger_sanitizes_message() {
        // ========== Arrange ==========
        let logger = PrivacyLogger::new(true);
        let message = "User email@example.com logged in from 192.168.1.1";

        // ========== Act ==========
        let sanitized = logger.sanitize_message(message);

        // ========== Assert ==========
        assert!(!sanitized.contains("email@example.com"));
        assert!(!sanitized.contains("192.168.1.1"));
    }

    #[test]
    fn test_privacy_logger_preserves_clean_message() {
        // ========== Arrange ==========
        let logger = PrivacyLogger::new(true);
        let message = "User logged in successfully";

        // ========== Act ==========
        let sanitized = logger.sanitize_message(message);

        // ========== Assert ==========
        assert_eq!(sanitized, message);
    }

    #[test]
    fn test_privacy_logger_log_does_not_panic() {
        // ========== Arrange ==========
        let logger = PrivacyLogger::new(true);
        let message = "Test message with email@test.com";

        // ========== Act & Assert ==========
        // 不应该panic
        logger.log("info", message);
        logger.log("error", "Error with phone 123-456-7890");
        logger.log("warn", "Warning");
    }

    #[test]
    fn test_privacy_logger_disabled() {
        // ========== Arrange ==========
        let logger = PrivacyLogger::new(false);
        let message = "Test message";

        // ========== Act & Assert ==========
        // 禁用状态下也不应该panic
        logger.log("info", message);
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_anonymize_empty_statistics() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let stats = UsageStatistics {
            user_id: None,
            session_id: String::new(),
            event_type: String::new(),
            event_data: HashMap::new(),
            timestamp: 0,
            ip_address: None,
            user_agent: None,
            device_id: None,
            location: None,
            app_version: String::new(),
            os_type: String::new(),
            os_version: String::new(),
        };
        let options = AnonymizationOptions::default();

        // ========== Act ==========
        let anonymous = anonymizer.anonymize_statistics(stats, &options);

        // ========== Assert ==========
        // 不应该panic，应该正常处理空数据
        assert_eq!(anonymous.event_data.len(), 0);
    }

    #[test]
    fn test_anonymize_ip_with_invalid_format() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let invalid_ips = vec![
            "not-an-ip",
            "999.999.999.999",
            "",
            "::::",
        ];

        // ========== Act & Assert ==========
        for ip in invalid_ips {
            let result = anonymizer.anonymize_ip(ip);
            // 不应该panic
            assert!(result.len() > 0);
        }
    }

    #[test]
    fn test_contains_sensitive_data_with_empty_string() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data("");

        // ========== Assert ==========
        assert!(!contains);
    }

    #[test]
    fn test_redact_sensitive_text_with_empty_string() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();

        // ========== Act ==========
        let redacted = anonymizer.redact_sensitive_text("");

        // ========== Assert ==========
        assert_eq!(redacted, "");
    }

    #[test]
    fn test_anonymizer_default() {
        // ========== Act ==========
        let anonymizer = Anonymizer::default();

        // ========== Assert ==========
        // 应该能够正常创建
        let hash = anonymizer.generate_anonymous_device_id("test");
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_unicode_handling() {
        // ========== Arrange ==========
        let anonymizer = Anonymizer::new();
        let text = "用户: user@例子.com，电话: 13812345678";

        // ========== Act ==========
        let contains = anonymizer.contains_sensitive_data(text);
        let redacted = anonymizer.redact_sensitive_text(text);

        // ========== Assert ==========
        assert!(contains);
        assert!(redacted.contains("用户"));
        assert!(redacted.contains("电话"));
    }
}

// ========================================
// 匿名化选项测试
// ========================================

mod anonymization_options {
    use super::*;

    #[test]
    fn test_default_options() {
        // ========== Act ==========
        let options = AnonymizationOptions::default();

        // ========== Assert ==========
        assert!(options.anonymize_user_id);
        assert!(options.anonymize_ip);
        assert!(options.anonymize_location);
        assert!(options.anonymize_device_id);
        assert!(options.hash_sensitive_data);
    }

    #[test]
    fn test_custom_options() {
        // ========== Arrange ==========
        let options = AnonymizationOptions {
            anonymize_user_id: false,
            anonymize_ip: true,
            anonymize_location: false,
            anonymize_device_id: true,
            hash_sensitive_data: false,
        };

        // ========== Assert ==========
        assert!(!options.anonymize_user_id);
        assert!(options.anonymize_ip);
        assert!(!options.anonymize_location);
        assert!(options.anonymize_device_id);
        assert!(!options.hash_sensitive_data);
    }
}


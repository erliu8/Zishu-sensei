// tests/unit/utils/data_masking_test.rs
//! 数据脱敏工具测试
//!
//! 测试敏感信息的检测和脱敏功能

use zishu_sensei::utils::data_masking::*;

// ========================================
// 脱敏策略测试
// ========================================

mod masking_strategies {
    use super::*;

    #[test]
    fn test_mask_full_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "my_secret_password_12345";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Full);

        // ========== Assert ==========
        assert_eq!(masked, "********");
        assert!(!masked.contains("password"));
    }

    #[test]
    fn test_mask_partial_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "my_secret_password";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Partial { prefix: 3, suffix: 3 });

        // ========== Assert ==========
        assert!(masked.starts_with("my_"));
        assert!(masked.ends_with("ord"));
        assert!(masked.contains("********"));
    }

    #[test]
    fn test_mask_partial_with_short_text() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "short";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Partial { prefix: 10, suffix: 10 });

        // ========== Assert ==========
        // 文本太短时应该完全隐藏
        assert_eq!(masked, "********");
    }

    #[test]
    fn test_mask_prefix_only_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "sk-1234567890abcdef";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::PrefixOnly { length: 7 });

        // ========== Assert ==========
        assert!(masked.starts_with("sk-1234"));
        assert!(masked.ends_with("********"));
        assert!(!masked.contains("abcdef"));
    }

    #[test]
    fn test_mask_suffix_only_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "1234567890123456"; // 信用卡号

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::SuffixOnly { length: 4 });

        // ========== Assert ==========
        assert!(masked.starts_with("********"));
        assert!(masked.ends_with("3456"));
    }

    #[test]
    fn test_mask_middle_hidden_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "13812345678"; // 手机号

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::MiddleHidden { show: 3 });

        // ========== Assert ==========
        assert!(masked.starts_with("138"));
        assert!(masked.ends_with("678"));
        assert!(masked.contains("********"));
    }

    #[test]
    fn test_mask_hash_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "sensitive_data";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Hash);

        // ========== Assert ==========
        assert!(masked.starts_with("sha256:"));
        assert_ne!(masked, text);
        assert_eq!(masked.len(), 71); // "sha256:" + 64个十六进制字符
    }

    #[test]
    fn test_mask_hash_is_deterministic() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "test_data";

        // ========== Act ==========
        let hash1 = masker.mask(text, &MaskingStrategy::Hash);
        let hash2 = masker.mask(text, &MaskingStrategy::Hash);

        // ========== Assert ==========
        assert_eq!(hash1, hash2);
    }
}

// ========================================
// API密钥脱敏测试
// ========================================

mod api_key_masking {
    use super::*;

    #[test]
    fn test_mask_openai_api_key() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890 please keep it secret";

        // ========== Act ==========
        let masked = masker.mask_api_keys(text);

        // ========== Assert ==========
        assert!(!masked.contains("sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890"));
        assert!(masked.contains("sk-1234"));
        assert!(masked.contains("7890"));
    }

    #[test]
    fn test_mask_anthropic_api_key() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let api_key = "sk-ant-api" + &"a".repeat(95);
        let text = format!("Anthropic key: {}", api_key);

        // ========== Act ==========
        let masked = masker.mask_api_keys(&text);

        // ========== Assert ==========
        assert!(!masked.contains(&api_key));
        assert!(masked.contains("sk-ant-api"));
    }

    #[test]
    fn test_mask_generic_api_key_patterns() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let texts = vec![
            r#"api_key: "abc123def456ghi789jkl""#,
            r#"API_KEY='xyz987uvw654rst321'"#,
            "ApiKey = token1234567890abcdefgh",
        ];

        for text in texts {
            // ========== Act ==========
            let masked = masker.mask_api_keys(text);

            // ========== Assert ==========
            assert_ne!(masked, text);
            // 密钥部分应该被脱敏
            assert!(masked.contains("api") || masked.contains("Api") || masked.contains("API"));
        }
    }

    #[test]
    fn test_mask_multiple_api_keys() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Key1: sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890 and Key2: sk-0987654321zyxwvutsrqponmlkjihgfedcba0987654321";

        // ========== Act ==========
        let masked = masker.mask_api_keys(text);

        // ========== Assert ==========
        // 两个密钥都应该被脱敏
        let original_key_count = text.matches("sk-").count();
        let masked_key_count = masked.matches("sk-").count();
        assert_eq!(original_key_count, masked_key_count);
        assert!(!masked.contains("abcdefghijklmnopqrstuvwxyz"));
    }

    #[test]
    fn test_mask_api_keys_preserves_non_key_text() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "This is normal text with sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890 in it";

        // ========== Act ==========
        let masked = masker.mask_api_keys(text);

        // ========== Assert ==========
        assert!(masked.contains("This is normal text"));
        assert!(masked.contains("in it"));
    }
}

// ========================================
// Token脱敏测试
// ========================================

mod token_masking {
    use super::*;

    #[test]
    fn test_mask_jwt_token() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        let text = format!("Authorization: {}", token);

        // ========== Act ==========
        let masked = masker.mask_tokens(&text);

        // ========== Assert ==========
        assert!(!masked.contains(&token));
        assert!(masked.contains("eyJhbGciOi")); // 前缀保留
    }

    #[test]
    fn test_mask_bearer_token() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Authorization: Bearer abc123def456ghi789jkl012mno345pqr678stu901vwx234yz";

        // ========== Act ==========
        let masked = masker.mask_tokens(text);

        // ========== Assert ==========
        assert!(!masked.contains("abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"));
        assert!(masked.contains("Bearer"));
    }

    #[test]
    fn test_mask_multiple_tokens() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Token1: Bearer token1234567890abc and Token2: Bearer xyz9876543210fed";

        // ========== Act ==========
        let masked = masker.mask_tokens(text);

        // ========== Assert ==========
        let bearer_count = text.matches("Bearer").count();
        assert_eq!(masked.matches("Bearer").count(), bearer_count);
        assert!(!masked.contains("token1234567890abc"));
        assert!(!masked.contains("xyz9876543210fed"));
    }
}

// ========================================
// 电子邮件脱敏测试
// ========================================

mod email_masking {
    use super::*;

    #[test]
    fn test_mask_email_simple() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Contact me at user@example.com for details";

        // ========== Act ==========
        let masked = masker.mask_email(text);

        // ========== Assert ==========
        assert!(!masked.contains("user@example.com"));
        assert!(masked.contains("us***@example.com"));
    }

    #[test]
    fn test_mask_email_short_local_part() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Email: ab@test.com";

        // ========== Act ==========
        let masked = masker.mask_email(text);

        // ========== Assert ==========
        // 短邮箱地址应该完整保留本地部分
        assert!(masked.contains("ab@test.com"));
    }

    #[test]
    fn test_mask_multiple_emails() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Contact alice@example.com or bob@company.org";

        // ========== Act ==========
        let masked = masker.mask_email(text);

        // ========== Assert ==========
        assert!(!masked.contains("alice@example.com"));
        assert!(!masked.contains("bob@company.org"));
        assert!(masked.contains("@example.com"));
        assert!(masked.contains("@company.org"));
    }

    #[test]
    fn test_mask_email_preserves_domain() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Email: john.doe@example.com";

        // ========== Act ==========
        let masked = masker.mask_email(text);

        // ========== Assert ==========
        assert!(masked.contains("@example.com"));
        assert!(masked.contains("jo***"));
    }

    #[test]
    fn test_mask_email_with_plus_addressing() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "user+tag@example.com";

        // ========== Act ==========
        let masked = masker.mask_email(text);

        // ========== Assert ==========
        assert!(!masked.contains("user+tag@example.com"));
        assert!(masked.contains("@example.com"));
    }
}

// ========================================
// 电话号码脱敏测试
// ========================================

mod phone_masking {
    use super::*;

    #[test]
    fn test_mask_chinese_mobile_number() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Call me at 13812345678";

        // ========== Act ==========
        let masked = masker.mask_phone(text);

        // ========== Assert ==========
        assert!(!masked.contains("13812345678"));
        assert!(masked.contains("138"));
        assert!(masked.contains("678"));
        assert!(masked.contains("********"));
    }

    #[test]
    fn test_mask_phone_with_country_code() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Phone: +8613912345678";

        // ========== Act ==========
        let masked = masker.mask_phone(text);

        // ========== Assert ==========
        assert!(!masked.contains("13912345678"));
    }

    #[test]
    fn test_mask_multiple_phone_numbers() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "Mobile: 13812345678, Office: 15987654321";

        // ========== Act ==========
        let masked = masker.mask_phone(text);

        // ========== Assert ==========
        assert!(!masked.contains("13812345678"));
        assert!(!masked.contains("15987654321"));
    }
}

// ========================================
// 综合脱敏测试
// ========================================

mod all_sensitive_masking {
    use super::*;

    #[test]
    fn test_mask_all_sensitive_data() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = r#"
            API Key: sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890
            Email: john.doe@example.com
            Phone: 13812345678
            Token: Bearer abc123def456ghi789jkl012
        "#;

        // ========== Act ==========
        let masked = masker.mask_all_sensitive(text);

        // ========== Assert ==========
        assert!(!masked.contains("sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890"));
        assert!(!masked.contains("john.doe@example.com"));
        assert!(!masked.contains("13812345678"));
        assert!(!masked.contains("abc123def456ghi789jkl012"));
    }

    #[test]
    fn test_mask_all_sensitive_preserves_structure() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "User: alice@example.com, Phone: 13912345678, Key: sk-" + &"a".repeat(48);

        // ========== Act ==========
        let masked = masker.mask_all_sensitive(&text);

        // ========== Assert ==========
        assert!(masked.contains("User:"));
        assert!(masked.contains("Phone:"));
        assert!(masked.contains("Key:"));
    }

    #[test]
    fn test_mask_all_sensitive_with_no_sensitive_data() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "This is a normal text without any sensitive information.";

        // ========== Act ==========
        let masked = masker.mask_all_sensitive(text);

        // ========== Assert ==========
        assert_eq!(masked, text);
    }
}

// ========================================
// JSON脱敏测试
// ========================================

mod json_masking {
    use super::*;

    #[test]
    fn test_mask_json_fields_simple() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let json = r#"{"username":"alice","password":"secret123","email":"alice@example.com"}"#;

        // ========== Act ==========
        let masked = masker.mask_json_fields(
            json,
            &["password"],
            &MaskingStrategy::Full,
        ).unwrap();

        // ========== Assert ==========
        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        assert_eq!(value["password"], "********");
        assert_eq!(value["username"], "alice");
        assert_eq!(value["email"], "alice@example.com");
    }

    #[test]
    fn test_mask_json_fields_multiple() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let json = r#"{"user":"john","password":"pass123","api_key":"key456","data":"public"}"#;

        // ========== Act ==========
        let masked = masker.mask_json_fields(
            json,
            &["password", "api_key"],
            &MaskingStrategy::Full,
        ).unwrap();

        // ========== Assert ==========
        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        assert_eq!(value["password"], "********");
        assert_eq!(value["api_key"], "********");
        assert_eq!(value["user"], "john");
        assert_eq!(value["data"], "public");
    }

    #[test]
    fn test_mask_json_fields_nested() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let json = r#"{"user":{"name":"alice","password":"secret"},"settings":{"api_key":"key123"}}"#;

        // ========== Act ==========
        let masked = masker.mask_json_fields(
            json,
            &["password", "api_key"],
            &MaskingStrategy::Full,
        ).unwrap();

        // ========== Assert ==========
        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        assert_eq!(value["user"]["password"], "********");
        assert_eq!(value["settings"]["api_key"], "********");
        assert_eq!(value["user"]["name"], "alice");
    }

    #[test]
    fn test_mask_json_fields_array() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let json = r#"{"users":[{"name":"alice","password":"pass1"},{"name":"bob","password":"pass2"}]}"#;

        // ========== Act ==========
        let masked = masker.mask_json_fields(
            json,
            &["password"],
            &MaskingStrategy::Full,
        ).unwrap();

        // ========== Assert ==========
        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        assert_eq!(value["users"][0]["password"], "********");
        assert_eq!(value["users"][1]["password"], "********");
        assert_eq!(value["users"][0]["name"], "alice");
    }

    #[test]
    fn test_mask_json_fields_with_partial_strategy() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let json = r#"{"api_key":"sk-1234567890abcdefghij"}"#;

        // ========== Act ==========
        let masked = masker.mask_json_fields(
            json,
            &["api_key"],
            &MaskingStrategy::Partial { prefix: 7, suffix: 4 },
        ).unwrap();

        // ========== Assert ==========
        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        let masked_key = value["api_key"].as_str().unwrap();
        assert!(masked_key.starts_with("sk-1234"));
        assert!(masked_key.ends_with("ghij"));
    }

    #[test]
    fn test_mask_json_invalid_json_returns_error() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let invalid_json = "{invalid json}";

        // ========== Act ==========
        let result = masker.mask_json_fields(
            invalid_json,
            &["password"],
            &MaskingStrategy::Full,
        );

        // ========== Assert ==========
        assert!(result.is_err());
    }
}

// ========================================
// 快速脱敏函数测试
// ========================================

mod quick_mask {
    use super::*;

    #[test]
    fn test_quick_mask_api_key() {
        // ========== Act ==========
        let masked = quick_mask("sk-1234567890abcdefghij", SensitiveDataType::ApiKey);

        // ========== Assert ==========
        assert!(masked.starts_with("sk-1234"));
        assert!(masked.ends_with("ghij"));
    }

    #[test]
    fn test_quick_mask_password() {
        // ========== Act ==========
        let masked = quick_mask("my_password_123", SensitiveDataType::Password);

        // ========== Assert ==========
        assert_eq!(masked, "********");
    }

    #[test]
    fn test_quick_mask_token() {
        // ========== Act ==========
        let masked = quick_mask("token1234567890abcdef", SensitiveDataType::Token);

        // ========== Assert ==========
        assert!(masked.starts_with("token12345"));
        assert!(masked.ends_with("cdef"));
    }

    #[test]
    fn test_quick_mask_credit_card() {
        // ========== Act ==========
        let masked = quick_mask("1234567890123456", SensitiveDataType::CreditCard);

        // ========== Assert ==========
        assert!(masked.ends_with("3456"));
        assert!(masked.starts_with("********"));
    }

    #[test]
    fn test_quick_mask_id_card() {
        // ========== Act ==========
        let masked = quick_mask("123456789012345678", SensitiveDataType::IdCard);

        // ========== Assert ==========
        assert!(masked.starts_with("1234"));
        assert!(masked.ends_with("5678"));
        assert!(masked.contains("********"));
    }

    #[test]
    fn test_quick_mask_ip_address() {
        // ========== Act ==========
        let masked = quick_mask("192.168.1.100", SensitiveDataType::IpAddress);

        // ========== Assert ==========
        assert!(masked.starts_with("192.168"));
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_mask_empty_string() {
        // ========== Arrange ==========
        let masker = DataMasker::new();

        // ========== Act & Assert ==========
        assert_eq!(masker.mask("", &MaskingStrategy::Full), "********");
        assert_eq!(masker.mask("", &MaskingStrategy::Partial { prefix: 2, suffix: 2 }), "********");
    }

    #[test]
    fn test_mask_unicode_text() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "密码123密码";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Full);

        // ========== Assert ==========
        assert_eq!(masked, "********");
    }

    #[test]
    fn test_mask_very_long_text() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "A".repeat(10000);

        // ========== Act ==========
        let masked = masker.mask(&text, &MaskingStrategy::Partial { prefix: 10, suffix: 10 });

        // ========== Assert ==========
        assert!(masked.starts_with("AAAAAAAAAA"));
        assert!(masked.ends_with("AAAAAAAAAA"));
    }

    #[test]
    fn test_mask_special_characters() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::MiddleHidden { show: 3 });

        // ========== Assert ==========
        assert!(masked.len() > 0);
    }

    #[test]
    fn test_mask_single_character() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "A";

        // ========== Act ==========
        let masked = masker.mask(text, &MaskingStrategy::Partial { prefix: 0, suffix: 0 });

        // ========== Assert ==========
        assert_eq!(masked, "********");
    }

    #[test]
    fn test_hash_consistency() {
        // ========== Arrange ==========
        let masker = DataMasker::new();
        let text = "consistent_data";

        // ========== Act ==========
        let hash1 = masker.mask(text, &MaskingStrategy::Hash);
        let hash2 = masker.mask(text, &MaskingStrategy::Hash);
        let hash3 = masker.mask(text, &MaskingStrategy::Hash);

        // ========== Assert ==========
        assert_eq!(hash1, hash2);
        assert_eq!(hash2, hash3);
    }
}


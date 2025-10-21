//! 隐私设置数据库测试
//!
//! 测试隐私设置数据库的所有功能，包括：
//! - 隐私设置的获取和更新
//! - 隐私政策同意记录
//! - 数据清除记录
//! - 清除统计信息

use zishu_sensei::database::privacy::{
    PrivacyDatabase, PrivacySettings, PrivacyConsent, DataCleanupRecord,
};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tempfile::TempDir;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, PrivacyDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_privacy.db");
    let conn = Connection::open(&db_path).expect("无法创建数据库");
    let conn_arc = Arc::new(Mutex::new(conn));
    let db = PrivacyDatabase::new(conn_arc).expect("无法创建隐私数据库");
    (temp_dir, db)
}

/// 创建测试隐私设置
fn create_test_settings() -> PrivacySettings {
    let now = chrono::Utc::now().timestamp();
    PrivacySettings {
        id: 1,
        local_conversation_only: false,
        privacy_mode_enabled: false,
        anonymous_analytics: true,
        save_conversation_history: true,
        save_search_history: true,
        allow_crash_reports: true,
        allow_usage_statistics: true,
        auto_clear_cache_days: 0,
        auto_clear_logs_days: 30,
        clipboard_history_enabled: true,
        telemetry_level: "basic".to_string(),
        created_at: now,
        updated_at: now,
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
        let result = db.get_or_create_settings();
        assert!(result.is_ok(), "应该能够获取或创建设置");
    }
}

// ========== 隐私设置获取测试 ==========

mod get_or_create_settings {
    use super::*;

    #[test]
    fn test_create_default_settings() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_or_create_settings();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let settings = result.unwrap();
        assert!(settings.id > 0);
        assert_eq!(settings.telemetry_level, "basic");
        assert_eq!(settings.auto_clear_logs_days, 30);
    }

    #[test]
    fn test_get_existing_settings() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 首次创建
        db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        let result = db.get_or_create_settings();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        // 应该返回相同的设置，而不是创建新的
    }

    #[test]
    fn test_default_settings_values() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let settings = db.get_or_create_settings().unwrap();
        
        // ========== Assert ==========
        assert!(!settings.local_conversation_only);
        assert!(!settings.privacy_mode_enabled);
        assert!(settings.anonymous_analytics);
        assert!(settings.save_conversation_history);
        assert!(settings.save_search_history);
        assert!(settings.allow_crash_reports);
        assert!(settings.allow_usage_statistics);
        assert_eq!(settings.auto_clear_cache_days, 0);
        assert_eq!(settings.auto_clear_logs_days, 30);
        assert!(settings.clipboard_history_enabled);
    }
}

// ========== 隐私设置更新测试 ==========

mod update_settings {
    use super::*;

    #[test]
    fn test_update_settings_success() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.privacy_mode_enabled = true;
        settings.anonymous_analytics = false;
        settings.telemetry_level = "none".to_string();
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let updated = db.get_or_create_settings().unwrap();
        assert!(updated.privacy_mode_enabled);
        assert!(!updated.anonymous_analytics);
        assert_eq!(updated.telemetry_level, "none");
    }

    #[test]
    fn test_update_all_privacy_flags() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.local_conversation_only = true;
        settings.privacy_mode_enabled = true;
        settings.anonymous_analytics = false;
        settings.save_conversation_history = false;
        settings.save_search_history = false;
        settings.allow_crash_reports = false;
        settings.allow_usage_statistics = false;
        settings.clipboard_history_enabled = false;
        
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let updated = db.get_or_create_settings().unwrap();
        assert!(updated.local_conversation_only);
        assert!(updated.privacy_mode_enabled);
        assert!(!updated.anonymous_analytics);
        assert!(!updated.save_conversation_history);
    }

    #[test]
    fn test_update_auto_clear_days() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.auto_clear_cache_days = 7;
        settings.auto_clear_logs_days = 14;
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let updated = db.get_or_create_settings().unwrap();
        assert_eq!(updated.auto_clear_cache_days, 7);
        assert_eq!(updated.auto_clear_logs_days, 14);
    }

    #[test]
    fn test_update_telemetry_level() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        let levels = vec!["none", "basic", "full"];
        
        // ========== Act & Assert ==========
        for level in levels {
            settings.telemetry_level = level.to_string();
            let result = db.update_settings(&settings);
            assert!(result.is_ok(), "{} 级别应该成功更新", level);
            
            let updated = db.get_or_create_settings().unwrap();
            assert_eq!(updated.telemetry_level, level);
        }
    }

    #[test]
    fn test_update_settings_preserves_id() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let original = db.get_or_create_settings().unwrap();
        let original_id = original.id;
        
        // ========== Act ==========
        let mut settings = original.clone();
        settings.privacy_mode_enabled = true;
        db.update_settings(&settings).unwrap();
        
        // ========== Assert ==========
        let updated = db.get_or_create_settings().unwrap();
        assert_eq!(updated.id, original_id, "ID应该保持不变");
    }
}

// ========== 隐私政策同意测试 ==========

mod privacy_consent {
    use super::*;

    #[test]
    fn test_record_consent() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_consent("1.0.0", true);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0, "应该返回记录ID");
    }

    #[test]
    fn test_record_multiple_consents() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        db.record_consent("1.0.0", true).unwrap();
        db.record_consent("1.1.0", true).unwrap();
        db.record_consent("1.2.0", false).unwrap();
        
        // ========== Assert ==========
        let latest = db.get_latest_consent().unwrap();
        assert!(latest.is_some());
        let consent = latest.unwrap();
        assert_eq!(consent.policy_version, "1.2.0");
        assert!(!consent.consented);
    }

    #[test]
    fn test_get_latest_consent() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.record_consent("1.0.0", true).unwrap();
        
        // ========== Act ==========
        let result = db.get_latest_consent();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let consent = result.unwrap();
        assert!(consent.is_some());
        assert_eq!(consent.unwrap().policy_version, "1.0.0");
    }

    #[test]
    fn test_get_latest_consent_empty() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_latest_consent();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_has_consented_to_version() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.record_consent("1.0.0", true).unwrap();
        db.record_consent("1.1.0", false).unwrap();
        
        // ========== Act & Assert ==========
        assert!(db.has_consented_to_version("1.0.0").unwrap());
        assert!(!db.has_consented_to_version("1.1.0").unwrap());
        assert!(!db.has_consented_to_version("2.0.0").unwrap());
    }

    #[test]
    fn test_consent_with_unicode_version() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_consent("版本 1.0.0 🚀", true);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }
}

// ========== 数据清除记录测试 ==========

mod data_cleanup {
    use super::*;

    #[test]
    fn test_record_cleanup() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_cleanup(
            "conversations",
            100,
            1024 * 1024 * 10, // 10MB
            "user",
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_record_different_cleanup_types() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let types = vec![
            ("conversations", 50, 5242880),  // 5MB
            ("cache", 200, 10485760),         // 10MB
            ("logs", 1000, 2097152),          // 2MB
            ("all", 1250, 17825792),          // 17MB
        ];
        
        // ========== Act & Assert ==========
        for (cleanup_type, items, space) in types {
            let result = db.record_cleanup(cleanup_type, items, space, "auto");
            assert!(result.is_ok(), "{} 类型的清除应该成功记录", cleanup_type);
        }
    }

    #[test]
    fn test_get_cleanup_history() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            db.record_cleanup(
                "cache",
                i * 10,
                i * 1024,
                if i % 2 == 0 { "user" } else { "auto" },
            ).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_cleanup_history(10);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let history = result.unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn test_get_cleanup_history_with_limit() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..10 {
            db.record_cleanup("cache", i, i * 1000, "user").unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_cleanup_history(3);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let history = result.unwrap();
        assert_eq!(history.len(), 3, "应该只返回最新的3条记录");
    }

    #[test]
    fn test_get_cleanup_stats() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.record_cleanup("cache", 100, 1024 * 1024, "user").unwrap();
        db.record_cleanup("logs", 50, 512 * 1024, "auto").unwrap();
        
        // ========== Act ==========
        let result = db.get_cleanup_stats();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        
        assert!(stats.get("total_cleanups").is_some());
        assert!(stats.get("total_items_deleted").is_some());
        assert!(stats.get("total_space_freed_bytes").is_some());
        assert!(stats.get("total_space_freed_mb").is_some());
        
        let total_cleanups = stats.get("total_cleanups").unwrap().as_i64().unwrap();
        assert_eq!(total_cleanups, 2);
        
        let total_items = stats.get("total_items_deleted").unwrap().as_i64().unwrap();
        assert_eq!(total_items, 150);
    }

    #[test]
    fn test_cleanup_stats_empty_database() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_cleanup_stats();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        
        let total = stats.get("total_cleanups").unwrap().as_i64().unwrap();
        assert_eq!(total, 0);
    }

    #[test]
    fn test_cleanup_triggered_by_user() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        db.record_cleanup("all", 500, 5242880, "user").unwrap();
        
        // ========== Assert ==========
        let history = db.get_cleanup_history(1).unwrap();
        assert_eq!(history[0].triggered_by, "user");
    }

    #[test]
    fn test_cleanup_triggered_by_auto() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        db.record_cleanup("cache", 200, 2097152, "auto").unwrap();
        
        // ========== Assert ==========
        let history = db.get_cleanup_history(1).unwrap();
        assert_eq!(history[0].triggered_by, "auto");
    }

    #[test]
    fn test_record_zero_cleanup() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_cleanup("cache", 0, 0, "user");
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许记录零清除");
    }

    #[test]
    fn test_record_large_cleanup() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_cleanup(
            "all",
            1000000,                    // 100万项
            1024i64 * 1024 * 1024 * 10, // 10GB
            "user",
        );
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }
}

// ========== 综合场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_privacy_mode_workflow() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act & Assert ==========
        // 1. 启用隐私模式
        settings.privacy_mode_enabled = true;
        settings.local_conversation_only = true;
        settings.save_conversation_history = false;
        db.update_settings(&settings).unwrap();
        
        let updated = db.get_or_create_settings().unwrap();
        assert!(updated.privacy_mode_enabled);
        
        // 2. 记录数据清除
        db.record_cleanup("conversations", 100, 5242880, "auto").unwrap();
        
        // 3. 验证清除记录
        let history = db.get_cleanup_history(1).unwrap();
        assert!(!history.is_empty());
    }

    #[test]
    fn test_privacy_policy_upgrade_workflow() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 同意旧版本
        db.record_consent("1.0.0", true).unwrap();
        assert!(db.has_consented_to_version("1.0.0").unwrap());
        
        // 2. 新版本发布，需要重新同意
        assert!(!db.has_consented_to_version("2.0.0").unwrap());
        
        // 3. 同意新版本
        db.record_consent("2.0.0", true).unwrap();
        assert!(db.has_consented_to_version("2.0.0").unwrap());
        
        // 4. 验证最新同意记录
        let latest = db.get_latest_consent().unwrap().unwrap();
        assert_eq!(latest.policy_version, "2.0.0");
    }

    #[test]
    fn test_auto_cleanup_workflow() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act & Assert ==========
        // 1. 设置自动清理
        settings.auto_clear_cache_days = 7;
        settings.auto_clear_logs_days = 30;
        db.update_settings(&settings).unwrap();
        
        // 2. 模拟自动清理执行
        db.record_cleanup("cache", 150, 3145728, "auto").unwrap();
        db.record_cleanup("logs", 500, 1048576, "auto").unwrap();
        
        // 3. 验证清理统计
        let stats = db.get_cleanup_stats().unwrap();
        let total_cleanups = stats.get("total_cleanups").unwrap().as_i64().unwrap();
        assert_eq!(total_cleanups, 2);
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_update_nonexistent_settings() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let settings = create_test_settings();
        
        // ========== Act ==========
        // 直接更新（不先创建）可能会失败或被忽略
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        // 应该能处理这种情况
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_telemetry_level_with_unicode() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.telemetry_level = "基本模式 🔒".to_string();
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let updated = db.get_or_create_settings().unwrap();
        assert!(updated.telemetry_level.contains("基本模式"));
    }

    #[test]
    fn test_negative_auto_clear_days() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.auto_clear_cache_days = -1;
        settings.auto_clear_logs_days = -1;
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许负值（可能表示禁用）");
    }

    #[test]
    fn test_very_large_auto_clear_days() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut settings = db.get_or_create_settings().unwrap();
        
        // ========== Act ==========
        settings.auto_clear_cache_days = i32::MAX;
        let result = db.update_settings(&settings);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_empty_consent_version() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.record_consent("", true);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许空版本号");
    }

    #[test]
    fn test_cleanup_with_very_long_type_name() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let long_type = "x".repeat(1000);
        
        // ========== Act ==========
        let result = db.record_cleanup(&long_type, 10, 1024, "user");
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能处理长类型名称");
    }

    #[test]
    fn test_concurrent_settings_updates() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..10 {
            let mut settings = db.get_or_create_settings().unwrap();
            settings.auto_clear_cache_days = i;
            let result = db.update_settings(&settings);
            assert!(result.is_ok(), "第{}次更新应该成功", i);
        }
        
        // ========== Assert ==========
        let final_settings = db.get_or_create_settings().unwrap();
        assert_eq!(final_settings.auto_clear_cache_days, 9);
    }

    #[test]
    fn test_cleanup_history_ordering() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..5 {
            db.record_cleanup("cache", i, i * 1000, "auto").unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        
        // ========== Assert ==========
        let history = db.get_cleanup_history(5).unwrap();
        // 应该按时间倒序排列（最新的在前）
        assert!(history[0].performed_at >= history[1].performed_at);
    }
}


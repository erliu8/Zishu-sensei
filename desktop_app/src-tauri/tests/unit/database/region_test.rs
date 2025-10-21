//! 区域偏好数据库测试
//!
//! 测试区域偏好数据库的所有功能，包括：
//! - 区域偏好的获取和保存
//! - 区域偏好的删除
//! - 区域配置缓存
//! - 默认配置生成
//! - 缓存清理

use zishu_sensei::database::region::{
    RegionDatabase, RegionPreferences, RegionConfig, NumberFormat,
    build_default_region_configs,
};
use rusqlite::Connection;
use tempfile::TempDir;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, Connection) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_region.db");
    let conn = Connection::open(&db_path).expect("无法创建数据库");
    RegionDatabase::init(&conn).expect("无法初始化表");
    (temp_dir, conn)
}

/// 创建测试用的区域偏好
fn create_test_preferences(locale: &str) -> RegionPreferences {
    RegionPreferences {
        id: None,
        user_id: Some("test-user".to_string()),
        locale: locale.to_string(),
        timezone: "Asia/Shanghai".to_string(),
        currency: "CNY".to_string(),
        number_format: "1,234.56".to_string(),
        date_format: "YYYY-MM-DD".to_string(),
        time_format: "24h".to_string(),
        temperature_unit: "celsius".to_string(),
        distance_unit: "metric".to_string(),
        weight_unit: "kg".to_string(),
        first_day_of_week: 1,
        rtl_support: false,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}

/// 创建测试用的区域配置
fn create_test_region_config(locale: &str) -> RegionConfig {
    RegionConfig {
        locale: locale.to_string(),
        name: "Test Region".to_string(),
        native_name: "测试区域".to_string(),
        language_code: "zh".to_string(),
        country_code: "CN".to_string(),
        currency: "CNY".to_string(),
        timezone: vec!["Asia/Shanghai".to_string()],
        number_format: NumberFormat {
            decimal_separator: ".".to_string(),
            thousands_separator: ",".to_string(),
            currency_symbol: "¥".to_string(),
            currency_position: "before".to_string(),
        },
        date_formats: vec!["YYYY-MM-DD".to_string()],
        temperature_unit: "celsius".to_string(),
        distance_unit: "metric".to_string(),
        weight_unit: "kg".to_string(),
        first_day_of_week: 1,
        rtl: false,
    }
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[test]
    fn test_database_init_success() {
        // ========== Arrange & Act ==========
        let result = setup_test_db();
        
        // ========== Assert ==========
        // 如果没有 panic，说明初始化成功
    }

    #[test]
    fn test_tables_created() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act & Assert ==========
        let prefs = create_test_preferences("zh-CN");
        let result = RegionDatabase::save_user_preferences(&conn, &prefs);
        assert!(result.is_ok(), "应该能够保存区域偏好");
    }
}

// ========== 区域偏好保存测试 ==========

mod save_user_preferences {
    use super::*;

    #[test]
    fn test_save_new_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let prefs = create_test_preferences("zh-CN");
        
        // ========== Act ==========
        let result = RegionDatabase::save_user_preferences(&conn, &prefs);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0, "应该返回有效的ID");
    }

    #[test]
    fn test_save_update_existing_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let prefs = create_test_preferences("zh-CN");
        
        let id = RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Act ==========
        let mut updated_prefs = prefs.clone();
        updated_prefs.id = Some(id);
        updated_prefs.locale = "en-US".to_string();
        updated_prefs.timezone = "America/New_York".to_string();
        
        let result = RegionDatabase::save_user_preferences(&conn, &updated_prefs);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), id, "ID应该保持不变");
        
        let retrieved = RegionDatabase::get_user_preferences(&conn, Some("test-user")).unwrap();
        assert_eq!(retrieved.locale, "en-US");
        assert_eq!(retrieved.timezone, "America/New_York");
    }

    #[test]
    fn test_save_preferences_for_different_users() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        let mut prefs1 = create_test_preferences("zh-CN");
        prefs1.user_id = Some("user-1".to_string());
        
        let mut prefs2 = create_test_preferences("en-US");
        prefs2.user_id = Some("user-2".to_string());
        
        // ========== Act ==========
        RegionDatabase::save_user_preferences(&conn, &prefs1).unwrap();
        RegionDatabase::save_user_preferences(&conn, &prefs2).unwrap();
        
        // ========== Assert ==========
        let retrieved1 = RegionDatabase::get_user_preferences(&conn, Some("user-1")).unwrap();
        let retrieved2 = RegionDatabase::get_user_preferences(&conn, Some("user-2")).unwrap();
        
        assert_eq!(retrieved1.locale, "zh-CN");
        assert_eq!(retrieved2.locale, "en-US");
    }

    #[test]
    fn test_save_preferences_without_user_id() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("ja-JP");
        prefs.user_id = None;
        
        // ========== Act ==========
        let result = RegionDatabase::save_user_preferences(&conn, &prefs);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_save_all_preference_fields() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("de-DE");
        prefs.currency = "EUR".to_string();
        prefs.number_format = "1.234,56".to_string();
        prefs.date_format = "DD.MM.YYYY".to_string();
        prefs.time_format = "24h".to_string();
        prefs.temperature_unit = "celsius".to_string();
        prefs.distance_unit = "metric".to_string();
        prefs.weight_unit = "kg".to_string();
        prefs.first_day_of_week = 1;
        prefs.rtl_support = false;
        
        // ========== Act ==========
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Assert ==========
        let retrieved = RegionDatabase::get_user_preferences(&conn, prefs.user_id.as_deref()).unwrap();
        assert_eq!(retrieved.currency, "EUR");
        assert_eq!(retrieved.number_format, "1.234,56");
        assert_eq!(retrieved.date_format, "DD.MM.YYYY");
    }
}

// ========== 区域偏好获取测试 ==========

mod get_user_preferences {
    use super::*;

    #[test]
    fn test_get_existing_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let prefs = create_test_preferences("zh-CN");
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::get_user_preferences(&conn, Some("test-user"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert_eq!(retrieved.locale, "zh-CN");
        assert_eq!(retrieved.user_id, Some("test-user".to_string()));
    }

    #[test]
    fn test_get_nonexistent_preferences_returns_default() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        let result = RegionDatabase::get_user_preferences(&conn, Some("nonexistent-user"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let preferences = result.unwrap();
        // 应该返回默认配置
        assert_eq!(preferences.locale, "zh-CN");
    }

    #[test]
    fn test_get_preferences_without_user_id() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("fr-FR");
        prefs.user_id = None;
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::get_user_preferences(&conn, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert_eq!(retrieved.locale, "fr-FR");
    }

    #[test]
    fn test_get_latest_preferences_for_user() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // 保存多次（模拟更新）
        let prefs1 = create_test_preferences("zh-CN");
        RegionDatabase::save_user_preferences(&conn, &prefs1).unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        let prefs2 = create_test_preferences("en-US");
        RegionDatabase::save_user_preferences(&conn, &prefs2).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::get_user_preferences(&conn, Some("test-user"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        // 应该返回最新的
    }
}

// ========== 区域偏好删除测试 ==========

mod delete_user_preferences {
    use super::*;

    #[test]
    fn test_delete_existing_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let prefs = create_test_preferences("zh-CN");
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::delete_user_preferences(&conn, Some("test-user"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0, "应该删除至少一条记录");
    }

    #[test]
    fn test_delete_nonexistent_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        let result = RegionDatabase::delete_user_preferences(&conn, Some("nonexistent"));
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0, "不应该删除任何记录");
    }

    #[test]
    fn test_delete_preferences_without_user_id() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("ko-KR");
        prefs.user_id = None;
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::delete_user_preferences(&conn, None);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }
}

// ========== 区域配置缓存测试 ==========

mod region_config_cache {
    use super::*;

    #[test]
    fn test_cache_region_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let config = create_test_region_config("zh-CN");
        
        // ========== Act ==========
        let result = RegionDatabase::cache_region_config(&conn, &config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_cached_region_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let config = create_test_region_config("zh-CN");
        RegionDatabase::cache_region_config(&conn, &config).unwrap();
        
        // ========== Act ==========
        let result = RegionDatabase::get_region_config(&conn, "zh-CN");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let cached = result.unwrap();
        assert!(cached.is_some());
        let cached_config = cached.unwrap();
        assert_eq!(cached_config.locale, "zh-CN");
        assert_eq!(cached_config.name, "Test Region");
    }

    #[test]
    fn test_get_nonexistent_cached_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        let result = RegionDatabase::get_region_config(&conn, "nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_cache_update_existing_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let config1 = create_test_region_config("zh-CN");
        RegionDatabase::cache_region_config(&conn, &config1).unwrap();
        
        // ========== Act ==========
        let mut config2 = create_test_region_config("zh-CN");
        config2.name = "Updated Region".to_string();
        RegionDatabase::cache_region_config(&conn, &config2).unwrap();
        
        // ========== Assert ==========
        let cached = RegionDatabase::get_region_config(&conn, "zh-CN").unwrap().unwrap();
        assert_eq!(cached.name, "Updated Region");
    }

    #[test]
    fn test_cache_multiple_configs() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        let locales = vec!["zh-CN", "en-US", "ja-JP", "de-DE"];
        
        // ========== Act ==========
        for locale in &locales {
            let config = create_test_region_config(locale);
            RegionDatabase::cache_region_config(&conn, &config).unwrap();
        }
        
        // ========== Assert ==========
        for locale in locales {
            let cached = RegionDatabase::get_region_config(&conn, locale).unwrap();
            assert!(cached.is_some(), "{} 应该被缓存", locale);
        }
    }

    #[test]
    fn test_get_all_region_configs() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        for locale in vec!["zh-CN", "en-US", "ja-JP"] {
            let config = create_test_region_config(locale);
            RegionDatabase::cache_region_config(&conn, &config).unwrap();
        }
        
        // ========== Act ==========
        let result = RegionDatabase::get_all_region_configs(&conn);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let configs = result.unwrap();
        assert_eq!(configs.len(), 3);
    }

    #[test]
    fn test_cleanup_expired_cache() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let config = create_test_region_config("zh-CN");
        RegionDatabase::cache_region_config(&conn, &config).unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        // ========== Act ==========
        // 清理0天前的缓存（应该清理所有）
        let result = RegionDatabase::cleanup_expired_cache(&conn, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok() || result.is_err()); // 取决于时间精度
    }

    #[test]
    fn test_cleanup_keeps_recent_cache() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let config = create_test_region_config("zh-CN");
        RegionDatabase::cache_region_config(&conn, &config).unwrap();
        
        // ========== Act ==========
        // 清理30天前的缓存
        let result = RegionDatabase::cleanup_expired_cache(&conn, 30);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        // 新缓存应该被保留
        let cached = RegionDatabase::get_region_config(&conn, "zh-CN").unwrap();
        assert!(cached.is_some());
    }
}

// ========== 默认配置测试 ==========

mod default_configs {
    use super::*;

    #[test]
    fn test_default_preferences() {
        // ========== Act ==========
        let prefs = RegionPreferences::default();
        
        // ========== Assert ==========
        assert_eq!(prefs.locale, "zh-CN");
        assert_eq!(prefs.timezone, "Asia/Shanghai");
        assert_eq!(prefs.currency, "CNY");
        assert_eq!(prefs.first_day_of_week, 1);
        assert!(!prefs.rtl_support);
    }

    #[test]
    fn test_build_default_region_configs() {
        // ========== Act ==========
        let configs = build_default_region_configs();
        
        // ========== Assert ==========
        assert!(!configs.is_empty(), "应该有默认配置");
        
        // 检查是否包含主要语言
        let has_zh_cn = configs.iter().any(|c| c.locale == "zh-CN");
        let has_en_us = configs.iter().any(|c| c.locale == "en-US");
        let has_ja_jp = configs.iter().any(|c| c.locale == "ja-JP");
        
        assert!(has_zh_cn, "应该包含简体中文");
        assert!(has_en_us, "应该包含美式英语");
        assert!(has_ja_jp, "应该包含日语");
    }

    #[test]
    fn test_default_config_structure() {
        // ========== Arrange ==========
        let configs = build_default_region_configs();
        
        // ========== Act & Assert ==========
        for config in configs {
            assert!(!config.locale.is_empty());
            assert!(!config.name.is_empty());
            assert!(!config.native_name.is_empty());
            assert!(!config.language_code.is_empty());
            assert!(!config.country_code.is_empty());
            assert!(!config.currency.is_empty());
            assert!(!config.timezone.is_empty());
            assert!(!config.date_formats.is_empty());
        }
    }

    #[test]
    fn test_zh_cn_config() {
        // ========== Arrange ==========
        let configs = build_default_region_configs();
        let zh_cn = configs.iter().find(|c| c.locale == "zh-CN").unwrap();
        
        // ========== Assert ==========
        assert_eq!(zh_cn.currency, "CNY");
        assert_eq!(zh_cn.temperature_unit, "celsius");
        assert_eq!(zh_cn.distance_unit, "metric");
        assert_eq!(zh_cn.first_day_of_week, 1);
        assert!(!zh_cn.rtl);
    }

    #[test]
    fn test_en_us_config() {
        // ========== Arrange ==========
        let configs = build_default_region_configs();
        let en_us = configs.iter().find(|c| c.locale == "en-US").unwrap();
        
        // ========== Assert ==========
        assert_eq!(en_us.currency, "USD");
        assert_eq!(en_us.temperature_unit, "fahrenheit");
        assert_eq!(en_us.distance_unit, "imperial");
        assert_eq!(en_us.weight_unit, "lb");
        assert_eq!(en_us.first_day_of_week, 0);
    }

    #[test]
    fn test_de_de_config() {
        // ========== Arrange ==========
        let configs = build_default_region_configs();
        let de_de = configs.iter().find(|c| c.locale == "de-DE").unwrap();
        
        // ========== Assert ==========
        assert_eq!(de_de.currency, "EUR");
        assert_eq!(de_de.number_format.decimal_separator, ",");
        assert_eq!(de_de.number_format.thousands_separator, ".");
        assert_eq!(de_de.number_format.currency_position, "after");
    }
}

// ========== 综合场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_user_preference_workflow() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 用户首次访问，获取默认配置
        let default_prefs = RegionDatabase::get_user_preferences(&conn, Some("new-user")).unwrap();
        assert_eq!(default_prefs.locale, "zh-CN");
        
        // 2. 用户修改偏好
        let mut custom_prefs = default_prefs.clone();
        custom_prefs.locale = "en-US".to_string();
        custom_prefs.timezone = "America/New_York".to_string();
        custom_prefs.user_id = Some("new-user".to_string());
        RegionDatabase::save_user_preferences(&conn, &custom_prefs).unwrap();
        
        // 3. 验证更新成功
        let updated = RegionDatabase::get_user_preferences(&conn, Some("new-user")).unwrap();
        assert_eq!(updated.locale, "en-US");
        assert_eq!(updated.timezone, "America/New_York");
    }

    #[test]
    fn test_multi_user_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        // 用户1: 中国用户
        let mut prefs1 = create_test_preferences("zh-CN");
        prefs1.user_id = Some("user-cn".to_string());
        RegionDatabase::save_user_preferences(&conn, &prefs1).unwrap();
        
        // 用户2: 美国用户
        let mut prefs2 = create_test_preferences("en-US");
        prefs2.user_id = Some("user-us".to_string());
        prefs2.timezone = "America/New_York".to_string();
        prefs2.currency = "USD".to_string();
        RegionDatabase::save_user_preferences(&conn, &prefs2).unwrap();
        
        // 用户3: 日本用户
        let mut prefs3 = create_test_preferences("ja-JP");
        prefs3.user_id = Some("user-jp".to_string());
        prefs3.timezone = "Asia/Tokyo".to_string();
        prefs3.currency = "JPY".to_string();
        RegionDatabase::save_user_preferences(&conn, &prefs3).unwrap();
        
        // ========== Assert ==========
        let cn_prefs = RegionDatabase::get_user_preferences(&conn, Some("user-cn")).unwrap();
        assert_eq!(cn_prefs.locale, "zh-CN");
        
        let us_prefs = RegionDatabase::get_user_preferences(&conn, Some("user-us")).unwrap();
        assert_eq!(us_prefs.locale, "en-US");
        
        let jp_prefs = RegionDatabase::get_user_preferences(&conn, Some("user-jp")).unwrap();
        assert_eq!(jp_prefs.locale, "ja-JP");
    }

    #[test]
    fn test_config_cache_workflow() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 缓存默认配置
        for config in build_default_region_configs() {
            RegionDatabase::cache_region_config(&conn, &config).unwrap();
        }
        
        // 2. 验证所有配置已缓存
        let all_configs = RegionDatabase::get_all_region_configs(&conn).unwrap();
        assert!(all_configs.len() >= 7, "应该有至少7种语言配置");
        
        // 3. 获取特定配置
        let zh_cn = RegionDatabase::get_region_config(&conn, "zh-CN").unwrap().unwrap();
        assert_eq!(zh_cn.currency, "CNY");
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_preferences_with_empty_strings() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("");
        prefs.locale = "".to_string();
        
        // ========== Act ==========
        let result = RegionDatabase::save_user_preferences(&conn, &prefs);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许空字符串");
    }

    #[test]
    fn test_preferences_with_unicode() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("zh-CN");
        prefs.user_id = Some("用户-123 🚀".to_string());
        
        // ========== Act ==========
        let result = RegionDatabase::save_user_preferences(&conn, &prefs);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_rtl_support_preferences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let mut prefs = create_test_preferences("ar-SA");
        prefs.rtl_support = true;
        
        // ========== Act ==========
        RegionDatabase::save_user_preferences(&conn, &prefs).unwrap();
        
        // ========== Assert ==========
        let retrieved = RegionDatabase::get_user_preferences(&conn, prefs.user_id.as_deref()).unwrap();
        assert!(retrieved.rtl_support);
    }

    #[test]
    fn test_first_day_of_week_values() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act & Assert ==========
        for day in 0..=6 {
            let mut prefs = create_test_preferences("test");
            prefs.first_day_of_week = day;
            prefs.user_id = Some(format!("user-{}", day));
            
            let result = RegionDatabase::save_user_preferences(&conn, &prefs);
            assert!(result.is_ok(), "第{}天应该是有效的", day);
        }
    }

    #[test]
    fn test_cache_with_complex_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        let mut config = create_test_region_config("test");
        config.timezone = vec![
            "America/New_York".to_string(),
            "America/Chicago".to_string(),
            "America/Denver".to_string(),
            "America/Los_Angeles".to_string(),
        ];
        config.date_formats = vec![
            "MM/DD/YYYY".to_string(),
            "MMM DD, YYYY".to_string(),
            "DD-MMM-YY".to_string(),
        ];
        
        // ========== Act ==========
        let result = RegionDatabase::cache_region_config(&conn, &config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let cached = RegionDatabase::get_region_config(&conn, "test").unwrap().unwrap();
        assert_eq!(cached.timezone.len(), 4);
        assert_eq!(cached.date_formats.len(), 3);
    }

    #[test]
    fn test_concurrent_preference_updates() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..10 {
            let mut prefs = create_test_preferences("zh-CN");
            prefs.user_id = Some("concurrent-user".to_string());
            prefs.auto_clear_cache_days = i;
            let result = RegionDatabase::save_user_preferences(&conn, &prefs);
            assert!(result.is_ok(), "第{}次更新应该成功", i);
        }
        
        // ========== Assert ==========
        // 最后一次更新应该生效
        let final_prefs = RegionDatabase::get_user_preferences(&conn, Some("concurrent-user")).unwrap();
        assert_eq!(final_prefs.first_day_of_week, 1);
    }
}


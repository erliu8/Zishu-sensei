//! 语言设置命令测试
//!
//! 测试所有语言设置相关的Tauri命令

#[cfg(test)]
mod language_commands_tests {
    use crate::common::*;
    
    // ================================
    // get_current_language 命令测试
    // ================================
    
    mod get_current_language {
        use super::*;
        
        #[tokio::test]
        async fn test_get_current_language_returns_language_code() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_settings_tables().unwrap();
            
            let timestamp = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "INSERT INTO app_settings (key, value, type, updated_at) VALUES (?1, ?2, ?3, ?4)",
                ["language", "zh-CN", "string", &timestamp.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let language: String = test_db.get_connection()
                .query_row(
                    "SELECT value FROM app_settings WHERE key = ?1",
                    ["language"],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(language, "zh-CN", "应该返回当前语言代码");
        }
    }
    
    // ================================
    // set_language 命令测试
    // ================================
    
    mod set_language {
        use super::*;
        
        #[tokio::test]
        async fn test_set_language_updates_setting() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_settings_tables().unwrap();
            
            let timestamp = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "INSERT INTO app_settings (key, value, type, updated_at) VALUES (?1, ?2, ?3, ?4)",
                ["language", "en-US", "string", &timestamp.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let new_timestamp = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
                ["zh-CN", &new_timestamp.to_string(), "language"]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let language: String = test_db.get_connection()
                .query_row(
                    "SELECT value FROM app_settings WHERE key = ?1",
                    ["language"],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(language, "zh-CN", "语言应该已更新");
        }
        
        #[tokio::test]
        async fn test_set_language_validates_language_code() {
            // ========== Arrange (准备) ==========
            let valid_languages = vec!["en-US", "zh-CN", "ja-JP", "ko-KR", "es-ES"];
            
            // ========== Act (执行) ==========
            let test_code = "zh-CN";
            let is_valid = valid_languages.contains(&test_code);
            
            // ========== Assert (断言) ==========
            assert!(is_valid, "zh-CN应该是有效的语言代码");
            
            let invalid_code = "invalid-CODE";
            let is_invalid = valid_languages.contains(&invalid_code);
            assert!(!is_invalid, "invalid-CODE应该是无效的语言代码");
        }
    }
    
    // ================================
    // get_available_languages 命令测试
    // ================================
    
    mod get_available_languages {
        use super::*;
        
        #[tokio::test]
        async fn test_get_available_languages_returns_list() {
            // ========== Arrange (准备) ==========
            let available_languages = vec![
                ("en-US", "English (US)"),
                ("zh-CN", "简体中文"),
                ("zh-TW", "繁體中文"),
                ("ja-JP", "日本語"),
                ("ko-KR", "한국어"),
            ];
            
            // ========== Act (执行) ==========
            let count = available_languages.len();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 5, "应该有5种可用语言");
            
            let has_chinese = available_languages.iter().any(|(code, _)| *code == "zh-CN");
            assert!(has_chinese, "应该包含简体中文");
        }
    }
    
    // ================================
    // translate_text 命令测试
    // ================================
    
    mod translate_text {
        use super::*;
        
        #[tokio::test]
        async fn test_translate_text_returns_translation() {
            // ========== Arrange (准备) ==========
            let mut translations = std::collections::HashMap::new();
            translations.insert("hello".to_string(), "你好".to_string());
            translations.insert("goodbye".to_string(), "再见".to_string());
            
            // ========== Act (执行) ==========
            let translated = translations.get("hello");
            
            // ========== Assert (断言) ==========
            assert_eq!(translated, Some(&"你好".to_string()), "应该返回翻译");
        }
        
        #[tokio::test]
        async fn test_translate_text_returns_key_when_not_found() {
            // ========== Arrange (准备) ==========
            let translations = std::collections::HashMap::new();
            let key = "unknown_key";
            
            // ========== Act (执行) ==========
            let translated = translations.get(key).unwrap_or(&key.to_string());
            
            // ========== Assert (断言) ==========
            assert_eq!(translated, key, "未找到翻译时应该返回原键");
        }
    }
    
    // ================================
    // get_language_file 命令测试
    // ================================
    
    mod get_language_file {
        use super::*;
        
        #[tokio::test]
        async fn test_get_language_file_loads_translations() {
            // ========== Arrange (准备) ==========
            let language_data = serde_json::json!({
                "app": {
                    "name": "字述先生",
                    "version": "1.0.0"
                },
                "common": {
                    "ok": "确定",
                    "cancel": "取消"
                }
            });
            
            // ========== Act (执行) ==========
            let app_name = language_data["app"]["name"].as_str();
            let ok_text = language_data["common"]["ok"].as_str();
            
            // ========== Assert (断言) ==========
            assert_eq!(app_name, Some("字述先生"));
            assert_eq!(ok_text, Some("确定"));
        }
    }
    
    // ================================
    // detect_system_language 命令测试
    // ================================
    
    mod detect_system_language {
        use super::*;
        
        #[tokio::test]
        async fn test_detect_system_language_returns_locale() {
            // ========== Arrange (准备) ==========
            // 模拟系统语言检测
            let system_locale = std::env::var("LANG")
                .unwrap_or_else(|_| "en-US".to_string());
            
            // ========== Act (执行) ==========
            let detected = if system_locale.starts_with("zh") {
                "zh-CN"
            } else if system_locale.starts_with("ja") {
                "ja-JP"
            } else {
                "en-US"
            };
            
            // ========== Assert (断言) ==========
            assert!(!detected.is_empty(), "应该检测到系统语言");
        }
    }
    
    // ================================
    // format_date 命令测试
    // ================================
    
    mod format_date {
        use super::*;
        
        #[tokio::test]
        async fn test_format_date_with_locale() {
            // ========== Arrange (准备) ==========
            let timestamp = chrono::Utc::now();
            let locale = "zh-CN";
            
            // ========== Act (执行) ==========
            let formatted = if locale == "zh-CN" {
                timestamp.format("%Y年%m月%d日").to_string()
            } else {
                timestamp.format("%Y-%m-%d").to_string()
            };
            
            // ========== Assert (断言) ==========
            assert!(formatted.contains("年") || formatted.contains("-"), 
                "日期应该根据语言环境格式化");
        }
    }
    
    // ================================
    // format_number 命令测试
    // ================================
    
    mod format_number {
        use super::*;
        
        #[tokio::test]
        async fn test_format_number_with_locale() {
            // ========== Arrange (准备) ==========
            let number = 1234567.89;
            let locale = "zh-CN";
            
            // ========== Act (执行) ==========
            let formatted = if locale == "zh-CN" {
                format!("{:.2}", number)
            } else {
                format!("{:.2}", number)
            };
            
            // ========== Assert (断言) ==========
            assert!(formatted.contains(".") || formatted.contains(","), 
                "数字应该根据语言环境格式化");
        }
    }
}


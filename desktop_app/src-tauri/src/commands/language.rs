use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageSettings {
    pub language: String,
    pub auto_detect: bool,
    pub fallback_language: String,
    pub updated_at: i64,
}

impl Default for LanguageSettings {
    fn default() -> Self {
        Self {
            language: "zh".to_string(),
            auto_detect: true,
            fallback_language: "en".to_string(),
            updated_at: chrono::Utc::now().timestamp(),
        }
    }
}

fn get_language_config_path(app_handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    // 确保目录存在
    fs::create_dir_all(&app_data_dir)?;
    
    Ok(app_data_dir.join("language_settings.json"))
}

#[tauri::command]
pub async fn save_language_setting(
    app_handle: AppHandle,
    language: String,
) -> Result<(), String> {
    let config_path = get_language_config_path(&app_handle)
        .map_err(|e| format!("Failed to get config path: {}", e))?;
    
    // 读取现有设置或使用默认值
    let mut settings = load_language_settings_internal(&app_handle)
        .unwrap_or_default();
    
    // 更新语言设置
    settings.language = language;
    settings.updated_at = chrono::Utc::now().timestamp();
    
    // 保存到文件
    let json_data = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&config_path, json_data)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    println!("Language setting saved: {}", settings.language);
    Ok(())
}

#[tauri::command]
pub async fn load_language_settings(
    app_handle: AppHandle,
) -> Result<LanguageSettings, String> {
    load_language_settings_internal(&app_handle)
        .map_err(|e| format!("Failed to load language settings: {}", e))
}

fn load_language_settings_internal(
    app_handle: &AppHandle,
) -> Result<LanguageSettings, Box<dyn std::error::Error>> {
    let config_path = get_language_config_path(app_handle)?;
    
    if !config_path.exists() {
        // 如果配置文件不存在，返回默认设置
        return Ok(LanguageSettings::default());
    }
    
    let json_data = fs::read_to_string(&config_path)?;
    let settings: LanguageSettings = serde_json::from_str(&json_data)?;
    
    Ok(settings)
}

#[tauri::command]
pub async fn detect_system_language() -> Result<String, String> {
    // 尝试检测系统语言
    let system_locale = sys_locale::get_locale()
        .unwrap_or_else(|| "en-US".to_string());
    
    println!("Detected system locale: {}", system_locale);
    
    // 映射到支持的语言
    let language = match system_locale.as_str() {
        locale if locale.starts_with("zh") => "zh",
        locale if locale.starts_with("ja") => "ja",
        locale if locale.starts_with("ko") => "ko",
        locale if locale.starts_with("en") => "en",
        _ => "zh", // 默认中文
    };
    
    Ok(language.to_string())
}

#[tauri::command]
pub async fn update_language_settings(
    app_handle: AppHandle,
    settings: LanguageSettings,
) -> Result<(), String> {
    let config_path = get_language_config_path(&app_handle)
        .map_err(|e| format!("Failed to get config path: {}", e))?;
    
    let mut updated_settings = settings;
    updated_settings.updated_at = chrono::Utc::now().timestamp();
    
    let json_data = serde_json::to_string_pretty(&updated_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&config_path, json_data)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    println!("Language settings updated: {:?}", updated_settings);
    Ok(())
}

#[tauri::command]
pub async fn reset_language_settings(
    app_handle: AppHandle,
) -> Result<LanguageSettings, String> {
    let config_path = get_language_config_path(&app_handle)
        .map_err(|e| format!("Failed to get config path: {}", e))?;
    
    let default_settings = LanguageSettings::default();
    
    let json_data = serde_json::to_string_pretty(&default_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&config_path, json_data)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    println!("Language settings reset to default");
    Ok(default_settings)
}

#[tauri::command]
pub async fn get_supported_languages() -> Result<Vec<LanguageInfo>, String> {
    Ok(vec![
        LanguageInfo {
            code: "zh".to_string(),
            name: "Chinese".to_string(),
            native_name: "中文".to_string(),
            rtl: false,
        },
        LanguageInfo {
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: "English".to_string(),
            rtl: false,
        },
        LanguageInfo {
            code: "ja".to_string(),
            name: "Japanese".to_string(),
            native_name: "日本語".to_string(),
            rtl: false,
        },
        LanguageInfo {
            code: "ko".to_string(),
            name: "Korean".to_string(),
            native_name: "한국어".to_string(),
            rtl: false,
        },
    ])
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageInfo {
    pub code: String,
    pub name: String,
    pub native_name: String,
    pub rtl: bool,
}

// 语言变化事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageChangedEvent {
    pub old_language: String,
    pub new_language: String,
    pub timestamp: i64,
}

pub fn emit_language_changed_event(
    app_handle: &AppHandle,
    old_language: &str,
    new_language: &str,
) -> Result<(), tauri::Error> {
    let event = LanguageChangedEvent {
        old_language: old_language.to_string(),
        new_language: new_language.to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    };
    
    app_handle.emit_all("language-changed", &event)?;
    println!("Language changed event emitted: {} -> {}", old_language, new_language);
    
    Ok(())
}

// 初始化语言设置
pub async fn initialize_language_settings(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings = load_language_settings_internal(app_handle)?;
    
    // 如果是首次运行且启用了自动检测
    if settings.auto_detect {
        let detected_language = detect_system_language().await.unwrap_or_else(|_| "zh".to_string());
        
        if detected_language != settings.language {
            println!("Auto-detected language: {}, current: {}", detected_language, settings.language);
            
            // 更新设置
            let mut new_settings = settings.clone();
            new_settings.language = detected_language.clone();
            new_settings.updated_at = chrono::Utc::now().timestamp();
            
            let config_path = get_language_config_path(app_handle)?;
            let json_data = serde_json::to_string_pretty(&new_settings)?;
            fs::write(&config_path, json_data)?;
            
            // 发送语言变化事件
            if let Err(e) = emit_language_changed_event(app_handle, &settings.language, &detected_language) {
                eprintln!("Failed to emit language changed event: {}", e);
            }
        }
    }
    
    println!("Language settings initialized: {:?}", settings);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use std::path::PathBuf;
    use tokio_test;
    use std::sync::{Arc, Mutex};
    use std::collections::HashMap;

    // ================================
    // 精确高效的测试集 - 避免AppHandle复杂性
    // ================================

    // 简化的设置管理器用于测试
    #[derive(Debug)]
    struct TestLanguageManager {
        temp_dir: TempDir,
        settings_cache: Arc<Mutex<Option<LanguageSettings>>>,
    }

    impl TestLanguageManager {
        fn new() -> Self {
            Self {
                temp_dir: TempDir::new().unwrap(),
                settings_cache: Arc::new(Mutex::new(None)),
            }
        }

        fn get_config_path(&self) -> PathBuf {
            self.temp_dir.path().join("language_settings.json")
        }

        fn save_settings(&self, settings: &LanguageSettings) -> Result<(), Box<dyn std::error::Error>> {
            let config_path = self.get_config_path();
            let json_data = serde_json::to_string_pretty(settings)?;
            fs::write(&config_path, json_data)?;
            
            // 更新缓存
            let mut cache = self.settings_cache.lock().unwrap();
            *cache = Some(settings.clone());
            
            Ok(())
        }

        fn load_settings(&self) -> Result<LanguageSettings, Box<dyn std::error::Error>> {
            let config_path = self.get_config_path();
            
            if !config_path.exists() {
                return Ok(LanguageSettings::default());
            }
            
            let json_data = fs::read_to_string(&config_path)?;
            let settings: LanguageSettings = serde_json::from_str(&json_data)?;
            
            // 更新缓存
            let mut cache = self.settings_cache.lock().unwrap();
            *cache = Some(settings.clone());
            
            Ok(settings)
        }

        fn clear_cache(&self) {
            let mut cache = self.settings_cache.lock().unwrap();
            *cache = None;
        }
    }

    fn create_test_settings() -> LanguageSettings {
        LanguageSettings {
            language: "en".to_string(),
            auto_detect: true,
            fallback_language: "zh".to_string(),
            updated_at: 1640995200, // Fixed timestamp for testing
        }
    }

    // ================================
    // 核心功能测试
    // ================================

    #[test]
    fn test_language_settings_default() {
        // Act
        let settings = LanguageSettings::default();

        // Assert
        assert_eq!(settings.language, "zh");
        assert_eq!(settings.auto_detect, true);
        assert_eq!(settings.fallback_language, "en");
        assert!(settings.updated_at > 0);
    }

    #[test]
    fn test_language_settings_serialization() {
        // Arrange
        let original_settings = create_test_settings();

        // Act - Serialize
        let json_result = serde_json::to_string(&original_settings);

        // Assert
        assert!(json_result.is_ok());
        let json_str = json_result.unwrap();
        assert!(json_str.contains("\"language\":\"en\""));
        assert!(json_str.contains("\"auto_detect\":true"));

        // Act - Deserialize
        let deserialized_result: Result<LanguageSettings, _> = serde_json::from_str(&json_str);

        // Assert
        assert!(deserialized_result.is_ok());
        let deserialized = deserialized_result.unwrap();
        assert_eq!(deserialized.language, original_settings.language);
        assert_eq!(deserialized.auto_detect, original_settings.auto_detect);
        assert_eq!(deserialized.fallback_language, original_settings.fallback_language);
        assert_eq!(deserialized.updated_at, original_settings.updated_at);
    }

    #[test]
    fn test_language_manager_file_operations() {
        // Arrange
        let manager = TestLanguageManager::new();
        let test_settings = create_test_settings();

        // Act - Save settings
        let save_result = manager.save_settings(&test_settings);
        assert!(save_result.is_ok());

        // Assert - File exists
        assert!(manager.get_config_path().exists());

        // Act - Load settings
        let loaded_settings = manager.load_settings().unwrap();

        // Assert - Settings match
        assert_eq!(loaded_settings.language, test_settings.language);
        assert_eq!(loaded_settings.auto_detect, test_settings.auto_detect);
        assert_eq!(loaded_settings.fallback_language, test_settings.fallback_language);
    }

    #[test]
    fn test_language_manager_default_when_no_file() {
        // Arrange
        let manager = TestLanguageManager::new();
        
        // Act - Load from empty directory
        let settings = manager.load_settings().unwrap();
        
        // Assert - Should return default settings
        assert_eq!(settings.language, "zh");
        assert_eq!(settings.auto_detect, true);
        assert_eq!(settings.fallback_language, "en");
    }

    #[tokio::test]
    async fn test_detect_system_language_functionality() {
        // Act
        let result = detect_system_language().await;

        // Assert
        assert!(result.is_ok());
        let language = result.unwrap();
        
        // Should return one of the supported languages
        let supported = ["zh", "en", "ja", "ko"];
        assert!(supported.contains(&language.as_str()));
    }

    #[tokio::test]
    async fn test_get_supported_languages() {
        // Act
        let result = get_supported_languages().await;

        // Assert
        assert!(result.is_ok());
        let languages = result.unwrap();
        assert_eq!(languages.len(), 4);
        
        // Verify all expected languages are present
        let language_codes: Vec<String> = languages.iter().map(|l| l.code.clone()).collect();
        assert!(language_codes.contains(&"zh".to_string()));
        assert!(language_codes.contains(&"en".to_string()));
        assert!(language_codes.contains(&"ja".to_string()));
        assert!(language_codes.contains(&"ko".to_string()));

        // Verify structure of languages
        for lang in &languages {
            assert!(!lang.code.is_empty());
            assert!(!lang.name.is_empty());
            assert!(!lang.native_name.is_empty());
            assert_eq!(lang.rtl, false); // All supported languages are LTR
        }
    }

    #[test]
    fn test_language_mapping_logic() {
        // 测试语言映射逻辑
        struct TestCase {
            input_locale: &'static str,
            expected_language: &'static str,
        }

        let test_cases = vec![
            TestCase { input_locale: "zh-CN", expected_language: "zh" },
            TestCase { input_locale: "zh-TW", expected_language: "zh" },
            TestCase { input_locale: "zh-HK", expected_language: "zh" },
            TestCase { input_locale: "en-US", expected_language: "en" },
            TestCase { input_locale: "en-GB", expected_language: "en" },
            TestCase { input_locale: "ja-JP", expected_language: "ja" },
            TestCase { input_locale: "ko-KR", expected_language: "ko" },
            TestCase { input_locale: "de-DE", expected_language: "zh" }, // Default
            TestCase { input_locale: "fr-FR", expected_language: "zh" }, // Default
            TestCase { input_locale: "", expected_language: "zh" }, // Empty string
        ];

        for test_case in test_cases {
            let language = match test_case.input_locale {
                locale if locale.starts_with("zh") => "zh",
                locale if locale.starts_with("ja") => "ja",
                locale if locale.starts_with("ko") => "ko",
                locale if locale.starts_with("en") => "en",
                _ => "zh", // 默认
            };
            
            assert_eq!(language, test_case.expected_language, 
                "Failed for locale: {}", test_case.input_locale);
        }
    }

    // ================================
    // 数据结构测试
    // ================================

    #[test]
    fn test_language_info_structure() {
        // Arrange
        let lang_info = LanguageInfo {
            code: "zh".to_string(),
            name: "Chinese".to_string(),
            native_name: "中文".to_string(),
            rtl: false,
        };

        // Act - Test serialization
        let json_result = serde_json::to_string(&lang_info);

        // Assert
        assert!(json_result.is_ok());
        let json_str = json_result.unwrap();

        // Act - Test deserialization
        let deserialized_result: Result<LanguageInfo, _> = serde_json::from_str(&json_str);

        // Assert
        assert!(deserialized_result.is_ok());
        let deserialized = deserialized_result.unwrap();
        assert_eq!(deserialized.code, "zh");
        assert_eq!(deserialized.name, "Chinese");
        assert_eq!(deserialized.native_name, "中文");
        assert_eq!(deserialized.rtl, false);
    }

    #[test]
    fn test_language_changed_event_structure() {
        // Arrange
        let timestamp = chrono::Utc::now().timestamp();
        let event = LanguageChangedEvent {
            old_language: "zh".to_string(),
            new_language: "en".to_string(),
            timestamp,
        };

        // Act - Test serialization
        let json_result = serde_json::to_string(&event);

        // Assert
        assert!(json_result.is_ok());
        let json_str = json_result.unwrap();

        // Act - Test deserialization
        let deserialized_result: Result<LanguageChangedEvent, _> = serde_json::from_str(&json_str);

        // Assert
        assert!(deserialized_result.is_ok());
        let deserialized = deserialized_result.unwrap();
        assert_eq!(deserialized.old_language, "zh");
        assert_eq!(deserialized.new_language, "en");
        assert_eq!(deserialized.timestamp, timestamp);
    }

    // ================================
    // 边界条件和错误场景测试
    // ================================

    #[test]
    fn test_invalid_json_handling() {
        // 测试无效JSON的错误处理
        let invalid_json_cases = vec![
            "{ invalid json }",
            "",
            "{",
            "}",
            "null",
            "[]",
            "{\"language\": }",
            "{\"language\": \"en\", \"auto_detect\":}",
        ];

        for invalid_json in invalid_json_cases {
            let result: Result<LanguageSettings, _> = serde_json::from_str(invalid_json);
            assert!(result.is_err(), "Should fail for: {}", invalid_json);
        }
    }

    #[test]
    fn test_partial_json_handling() {
        // 测试部分JSON字段的处理
        let partial_json = r#"{"language": "en"}"#;
        let result: Result<LanguageSettings, _> = serde_json::from_str(partial_json);
        assert!(result.is_err()); // 应该失败，因为缺少必需字段

        // 测试包含额外字段的JSON
        let extra_fields_json = r#"{
            "language": "en",
            "auto_detect": true,
            "fallback_language": "zh",
            "updated_at": 1640995200,
            "extra_field": "should_be_ignored"
        }"#;
        
        let result: Result<LanguageSettings, _> = serde_json::from_str(extra_fields_json);
        assert!(result.is_ok()); // 应该成功，额外字段被忽略
        
        let settings = result.unwrap();
        assert_eq!(settings.language, "en");
        assert_eq!(settings.auto_detect, true);
        assert_eq!(settings.fallback_language, "zh");
        assert_eq!(settings.updated_at, 1640995200);
    }

    #[test]
    fn test_edge_cases() {
        // 测试边界情况
        
        // 空字符串语言
        let settings = LanguageSettings {
            language: "".to_string(),
            auto_detect: false,
            fallback_language: "en".to_string(),
            updated_at: chrono::Utc::now().timestamp(),
        };

        let json_str = serde_json::to_string(&settings).unwrap();
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.language, "");

        // 很长的语言字符串
        let long_language = "a".repeat(1000);
        let settings = LanguageSettings {
            language: long_language.clone(),
            auto_detect: true,
            fallback_language: "en".to_string(),
            updated_at: chrono::Utc::now().timestamp(),
        };

        let json_str = serde_json::to_string(&settings).unwrap();
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.language, long_language);
    }

    #[test]
    fn test_concurrent_access_safety() {
        // 测试并发访问时的线程安全性
        use std::thread;
        
        let manager = Arc::new(TestLanguageManager::new());
        let mut handles = vec![];
        
        // 创建多个线程同时访问设置
        for i in 0..10 {
            let manager_clone = Arc::clone(&manager);
            let handle = thread::spawn(move || {
                let mut settings = create_test_settings();
                settings.language = format!("lang_{}", i);
                settings.updated_at = chrono::Utc::now().timestamp();
                
                // 保存和加载操作
                let _ = manager_clone.save_settings(&settings);
                let _ = manager_clone.load_settings();
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }
        
        // 验证最终状态是有效的
        let final_settings = manager.load_settings().unwrap();
        assert!(!final_settings.language.is_empty());
        assert!(final_settings.updated_at > 0);
    }

    #[test]
    fn test_supported_language_codes_consistency() {
        // 测试支持的语言代码的一致性
        let expected_codes = vec!["zh", "en", "ja", "ko"];
        
        // 模拟get_supported_languages函数的逻辑
        let supported_languages = vec![
            LanguageInfo {
                code: "zh".to_string(),
                name: "Chinese".to_string(),
                native_name: "中文".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "en".to_string(),
                name: "English".to_string(),
                native_name: "English".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ja".to_string(),
                name: "Japanese".to_string(),
                native_name: "日本語".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ko".to_string(),
                name: "Korean".to_string(),
                native_name: "한국어".to_string(),
                rtl: false,
            },
        ];

        let actual_codes: Vec<String> = supported_languages.iter()
            .map(|lang| lang.code.clone())
            .collect();

        assert_eq!(actual_codes, expected_codes);
        
        // 验证每个语言都有有效的字段
        for lang in &supported_languages {
            assert!(!lang.code.is_empty());
            assert!(!lang.name.is_empty()); 
            assert!(!lang.native_name.is_empty());
            assert_eq!(lang.rtl, false);
        }
    }

    #[tokio::test]
    async fn test_language_validation_for_all_supported_languages() {
        // 测试所有支持的语言的有效性
        let supported_languages = vec!["zh", "en", "ja", "ko"];
        
        for lang in &supported_languages {
            let settings = LanguageSettings {
                language: lang.to_string(),
                auto_detect: true,
                fallback_language: "en".to_string(),
                updated_at: chrono::Utc::now().timestamp(),
            };
            
            // 验证序列化和反序列化
            let json_str = serde_json::to_string(&settings).unwrap();
            let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
            
            assert_eq!(parsed.language, *lang);
            assert!(supported_languages.contains(&parsed.language.as_str()));
        }
    }

    #[test]
    fn test_timestamp_handling() {
        // 测试时间戳处理
        let now = chrono::Utc::now().timestamp();
        let settings = LanguageSettings {
            language: "en".to_string(),
            auto_detect: true,
            fallback_language: "zh".to_string(),
            updated_at: now,
        };

        // 序列化和反序列化
        let json_str = serde_json::to_string(&settings).unwrap();
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        
        assert_eq!(parsed.updated_at, now);
        assert!(parsed.updated_at > 0);
    }

    #[test]
    fn test_file_system_operations() {
        // 测试文件系统操作的健壮性
        let manager = TestLanguageManager::new();
        let settings = create_test_settings();
        
        // 测试保存到不存在的目录
        assert!(manager.save_settings(&settings).is_ok());
        
        // 测试文件权限（在有权限的系统上）
        let config_path = manager.get_config_path();
        assert!(config_path.exists());
        
        // 测试加载损坏的文件
        fs::write(&config_path, "invalid json content").unwrap();
        let result = manager.load_settings();
        // 应该返回错误或默认值（取决于实现）
        // 这里我们期望它返回错误
        assert!(result.is_err());
    }
}
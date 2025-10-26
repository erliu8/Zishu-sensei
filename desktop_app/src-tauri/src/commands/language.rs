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

    // Mock AppHandle for testing
    struct MockAppHandle {
        temp_dir: TempDir,
    }

    impl MockAppHandle {
        fn new() -> Self {
            Self {
                temp_dir: TempDir::new().unwrap(),
            }
        }

        fn get_app_data_dir(&self) -> PathBuf {
            self.temp_dir.path().to_path_buf()
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

    fn setup_test_config_file(temp_dir: &TempDir, settings: &LanguageSettings) -> PathBuf {
        let config_path = temp_dir.path().join("language_settings.json");
        let json_data = serde_json::to_string_pretty(settings).unwrap();
        fs::write(&config_path, json_data).unwrap();
        config_path
    }

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
        let settings = create_test_settings();

        // Act - Serialize
        let json_result = serde_json::to_string(&settings);

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
        assert_eq!(deserialized.language, settings.language);
        assert_eq!(deserialized.auto_detect, settings.auto_detect);
        assert_eq!(deserialized.fallback_language, settings.fallback_language);
        assert_eq!(deserialized.updated_at, settings.updated_at);
    }

    #[tokio::test]
    async fn test_detect_system_language_english() {
        // This test checks if the function runs without panicking
        // Actual result depends on system locale
        
        // Act
        let result = detect_system_language().await;

        // Assert
        assert!(result.is_ok());
        let language = result.unwrap();
        assert!(["zh", "en", "ja", "ko"].contains(&language.as_str()));
    }

    #[tokio::test]
    async fn test_get_supported_languages() {
        // Act
        let result = get_supported_languages().await;

        // Assert
        assert!(result.is_ok());
        let languages = result.unwrap();
        assert_eq!(languages.len(), 4);
        
        // Check for specific languages
        let language_codes: Vec<String> = languages.iter().map(|l| l.code.clone()).collect();
        assert!(language_codes.contains(&"zh".to_string()));
        assert!(language_codes.contains(&"en".to_string()));
        assert!(language_codes.contains(&"ja".to_string()));
        assert!(language_codes.contains(&"ko".to_string()));

        // Check structure of first language
        let first_lang = &languages[0];
        assert!(!first_lang.name.is_empty());
        assert!(!first_lang.native_name.is_empty());
        assert_eq!(first_lang.rtl, false); // All supported languages are LTR
    }

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

    // Helper function tests
    #[test]
    fn test_load_language_settings_internal_with_existing_file() {
        // This test would require a real AppHandle, so we'll simulate the logic
        let temp_dir = TempDir::new().unwrap();
        let settings = create_test_settings();
        let config_path = setup_test_config_file(&temp_dir, &settings);

        // Verify file exists and can be read
        assert!(config_path.exists());
        
        let json_data = fs::read_to_string(&config_path).unwrap();
        let loaded_settings: LanguageSettings = serde_json::from_str(&json_data).unwrap();
        
        assert_eq!(loaded_settings.language, "en");
        assert_eq!(loaded_settings.auto_detect, true);
        assert_eq!(loaded_settings.fallback_language, "zh");
    }

    #[test]
    fn test_load_language_settings_internal_with_missing_file() {
        // Test default behavior when config file doesn't exist
        let temp_dir = TempDir::new().unwrap();
        let nonexistent_path = temp_dir.path().join("nonexistent.json");
        
        // Verify file doesn't exist
        assert!(!nonexistent_path.exists());
        
        // This simulates the default behavior
        let default_settings = LanguageSettings::default();
        assert_eq!(default_settings.language, "zh");
        assert_eq!(default_settings.auto_detect, true);
        assert_eq!(default_settings.fallback_language, "en");
    }

    #[test]
    fn test_language_mapping_logic() {
        // Test the language mapping logic from detect_system_language
        struct TestCase {
            input_locale: &'static str,
            expected_language: &'static str,
        }

        let test_cases = vec![
            TestCase { input_locale: "zh-CN", expected_language: "zh" },
            TestCase { input_locale: "zh-TW", expected_language: "zh" },
            TestCase { input_locale: "en-US", expected_language: "en" },
            TestCase { input_locale: "en-GB", expected_language: "en" },
            TestCase { input_locale: "ja-JP", expected_language: "ja" },
            TestCase { input_locale: "ko-KR", expected_language: "ko" },
            TestCase { input_locale: "de-DE", expected_language: "zh" }, // Default case
            TestCase { input_locale: "fr-FR", expected_language: "zh" }, // Default case
        ];

        for test_case in test_cases {
            let language = match test_case.input_locale {
                locale if locale.starts_with("zh") => "zh",
                locale if locale.starts_with("ja") => "ja",
                locale if locale.starts_with("ko") => "ko",
                locale if locale.starts_with("en") => "en",
                _ => "zh", // Default
            };
            
            assert_eq!(language, test_case.expected_language, 
                "Failed for locale: {}", test_case.input_locale);
        }
    }

    #[test]
    fn test_config_file_format() {
        // Test that our config file format is consistent
        let settings = LanguageSettings {
            language: "ja".to_string(),
            auto_detect: false,
            fallback_language: "en".to_string(),
            updated_at: 1640995200,
        };

        let json_str = serde_json::to_string_pretty(&settings).unwrap();
        
        // Verify JSON structure
        assert!(json_str.contains("\"language\": \"ja\""));
        assert!(json_str.contains("\"auto_detect\": false"));
        assert!(json_str.contains("\"fallback_language\": \"en\""));
        assert!(json_str.contains("\"updated_at\": 1640995200"));

        // Verify it can be parsed back
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.language, settings.language);
        assert_eq!(parsed.auto_detect, settings.auto_detect);
        assert_eq!(parsed.fallback_language, settings.fallback_language);
        assert_eq!(parsed.updated_at, settings.updated_at);
    }

    #[test]
    fn test_invalid_json_handling() {
        // Test behavior with malformed JSON
        let invalid_json = "{invalid json}";
        let result: Result<LanguageSettings, _> = serde_json::from_str(invalid_json);
        assert!(result.is_err());

        // Test behavior with missing fields
        let partial_json = r#"{"language": "en"}"#;
        let result: Result<LanguageSettings, _> = serde_json::from_str(partial_json);
        assert!(result.is_err()); // Should fail because required fields are missing
    }

    #[test]
    fn test_timestamp_handling() {
        // Test that timestamps are handled correctly
        let now = chrono::Utc::now().timestamp();
        let settings = LanguageSettings {
            language: "en".to_string(),
            auto_detect: true,
            fallback_language: "zh".to_string(),
            updated_at: now,
        };

        // Serialize and deserialize
        let json_str = serde_json::to_string(&settings).unwrap();
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        
        assert_eq!(parsed.updated_at, now);
        assert!(parsed.updated_at > 0);
    }

    #[test]
    fn test_supported_language_codes() {
        // Test that we have the expected language codes
        let expected_codes = vec!["zh", "en", "ja", "ko"];
        
        // This simulates the get_supported_languages function logic
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
    }

    #[test]
    fn test_edge_cases() {
        // Test empty string language
        let settings = LanguageSettings {
            language: "".to_string(),
            auto_detect: false,
            fallback_language: "en".to_string(),
            updated_at: chrono::Utc::now().timestamp(),
        };

        let json_str = serde_json::to_string(&settings).unwrap();
        let parsed: LanguageSettings = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.language, "");

        // Test very long language string
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
}

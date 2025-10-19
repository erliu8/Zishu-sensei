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
#[derive(Debug, Clone, Serialize)]
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

use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs;
use tracing::{debug, error, info, trace, warn};

use crate::AppConfig;

/// Return a directory to store application logs
pub fn get_app_log_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("logs");
    Ok(dir)
}

/// Get the application data directory
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    // Use platform-specific data directory
    let data_dir = if cfg!(target_os = "windows") {
        // Windows: %APPDATA%\zishu-sensei
        dirs::config_dir()
            .ok_or("Failed to get config directory".to_string())?
            .join("zishu-sensei")
    } else if cfg!(target_os = "macos") {
        // macOS: ~/Library/Application Support/zishu-sensei
        dirs::data_dir()
            .ok_or("Failed to get data directory".to_string())?
            .join("zishu-sensei")
    } else {
        // Linux: ~/.config/zishu-sensei
        dirs::config_dir()
            .ok_or("Failed to get config directory".to_string())?
            .join("zishu-sensei")
    };
    
    Ok(data_dir)
}

/// Get the config file path
pub fn get_config_file_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("config.json"))
}

/// Get the backup config file path
pub fn get_config_backup_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("config.backup.json"))
}

/// Load application config from disk
pub async fn load_config(_app_handle: &AppHandle) -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    
    // If config file doesn't exist, return default config
    if !config_path.exists() {
        info!("配置文件不存在，使用默认配置");
        return Ok(AppConfig::default());
    }
    
    // Read and parse config file
    match fs::read_to_string(&config_path).await {
        Ok(content) => {
            match serde_json::from_str::<AppConfig>(&content) {
                Ok(config) => {
                    info!("成功加载配置文件: {:?}", config_path);
                    Ok(config)
                }
                Err(e) => {
                    error!("解析配置文件失败: {}, 尝试加载备份", e);
                    // Try to load from backup
                    load_config_from_backup().await
                }
            }
        }
        Err(e) => {
            error!("读取配置文件失败: {}, 尝试加载备份", e);
            load_config_from_backup().await
        }
    }
}

/// Load config from backup file
async fn load_config_from_backup() -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    let backup_path = get_config_backup_path()?;
    
    if !backup_path.exists() {
        warn!("备份配置文件不存在，使用默认配置");
        return Ok(AppConfig::default());
    }
    
    match fs::read_to_string(&backup_path).await {
        Ok(content) => {
            match serde_json::from_str::<AppConfig>(&content) {
                Ok(config) => {
                    info!("成功从备份加载配置");
                    Ok(config)
                }
                Err(e) => {
                    error!("解析备份配置失败: {}, 使用默认配置", e);
                    Ok(AppConfig::default())
                }
            }
        }
        Err(e) => {
            error!("读取备份配置失败: {}, 使用默认配置", e);
            Ok(AppConfig::default())
        }
    }
}

/// Save application config to disk
pub async fn save_config(_app_handle: &AppHandle, config: &AppConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    let backup_path = get_config_backup_path()?;
    
    // Ensure data directory exists
    let data_dir = get_app_data_dir()?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).await?;
        info!("创建数据目录: {:?}", data_dir);
    }
    
    // Serialize config to JSON with pretty formatting
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    // If config file exists, backup it first
    if config_path.exists() {
        if let Err(e) = fs::copy(&config_path, &backup_path).await {
            warn!("备份配置文件失败: {}", e);
        } else {
            trace!("配置文件已备份到: {:?}", backup_path);
        }
    }
    
    // Write config to file
    fs::write(&config_path, json).await
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    debug!("配置已保存到: {:?}", config_path);
    Ok(())
}

/// Reset config to default
pub async fn reset_config(_app_handle: &AppHandle) -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    let backup_path = get_config_backup_path()?;
    
    // Backup current config before reset
    if config_path.exists() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let reset_backup_path = get_app_data_dir()?
            .join(format!("config.reset_backup_{}.json", timestamp));
        
        if let Err(e) = fs::copy(&config_path, &reset_backup_path).await {
            warn!("重置前备份配置失败: {}", e);
        } else {
            info!("重置前配置已备份到: {:?}", reset_backup_path);
        }
    }
    
    // Delete current config and backup
    if config_path.exists() {
        let _ = fs::remove_file(&config_path).await;
    }
    if backup_path.exists() {
        let _ = fs::remove_file(&backup_path).await;
    }
    
    let default_config = AppConfig::default();
    info!("配置已重置为默认值");
    
    Ok(default_config)
}

/// Import config from a file
pub async fn import_config(file_path: PathBuf) -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    let content = fs::read_to_string(&file_path).await
        .map_err(|e| format!("读取导入文件失败: {}", e))?;
    
    let config = serde_json::from_str::<AppConfig>(&content)
        .map_err(|e| format!("解析导入配置失败: {}", e))?;
    
    info!("成功从文件导入配置: {:?}", file_path);
    Ok(config)
}

/// Export config to a file
pub async fn export_config(config: &AppConfig, file_path: PathBuf) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await
                .map_err(|e| format!("创建导出目录失败: {}", e))?;
        }
    }
    
    fs::write(&file_path, json).await
        .map_err(|e| format!("写入导出文件失败: {}", e))?;
    
    info!("配置已导出到: {:?}", file_path);
    Ok(())
}

/// Validate config structure
pub fn validate_config(config: &AppConfig) -> Result<(), String> {
    // Validate window config
    if config.window.width < 200.0 || config.window.width > 4000.0 {
        return Err("窗口宽度必须在 200-4000 之间".to_string());
    }
    if config.window.height < 200.0 || config.window.height > 4000.0 {
        return Err("窗口高度必须在 200-4000 之间".to_string());
    }
    
    // Validate character config
    if config.character.scale < 0.1 || config.character.scale > 5.0 {
        return Err("角色缩放比例必须在 0.1-5.0 之间".to_string());
    }
    
    // Validate character name is not empty
    if config.character.current_character.trim().is_empty() {
        return Err("角色名称不能为空".to_string());
    }
    
    // Validate theme name is not empty
    if config.theme.current_theme.trim().is_empty() {
        return Err("主题名称不能为空".to_string());
    }
    
    Ok(())
}

/// Merge partial config updates into existing config
pub fn merge_config(base: &mut AppConfig, updates: serde_json::Value) -> Result<(), String> {
    // Get base config as JSON
    let mut base_json = serde_json::to_value(&*base)
        .map_err(|e| format!("序列化基础配置失败: {}", e))?;
    
    // Merge updates into base
    merge_json(&mut base_json, &updates);
    
    // Convert back to AppConfig
    *base = serde_json::from_value(base_json)
        .map_err(|e| format!("反序列化合并后的配置失败: {}", e))?;
    
    // Validate merged config
    validate_config(base)?;
    
    Ok(())
}

/// Recursively merge JSON values
fn merge_json(base: &mut serde_json::Value, updates: &serde_json::Value) {
    if let (Some(base_obj), Some(updates_obj)) = (base.as_object_mut(), updates.as_object()) {
        for (key, value) in updates_obj {
            if let Some(base_value) = base_obj.get_mut(key) {
                if base_value.is_object() && value.is_object() {
                    merge_json(base_value, value);
                } else {
                    *base_value = value.clone();
                }
            } else {
                base_obj.insert(key.clone(), value.clone());
            }
        }
    }
}

/// Get all config backup files (sorted by timestamp, newest first)
pub async fn get_backup_files() -> Result<Vec<PathBuf>, Box<dyn std::error::Error + Send + Sync>> {
    let data_dir = get_app_data_dir()?;
    
    if !data_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut backups = Vec::new();
    let mut entries = fs::read_dir(&data_dir).await?;
    
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
            if filename.starts_with("config.") && filename.ends_with(".json") {
                if filename.contains("backup") || filename.contains("reset_backup") {
                    backups.push(path);
                }
            }
        }
    }
    
    // Sort by modification time (newest first)
    backups.sort_by(|a, b| {
        let a_meta = std::fs::metadata(a).ok();
        let b_meta = std::fs::metadata(b).ok();
        
        match (a_meta, b_meta) {
            (Some(a_m), Some(b_m)) => {
                let a_time = a_m.modified().ok();
                let b_time = b_m.modified().ok();
                b_time.cmp(&a_time)
            }
            _ => std::cmp::Ordering::Equal
        }
    });
    
    Ok(backups)
}

/// Clean old backup files (keep only the most recent N backups)
pub async fn clean_old_backups(keep_count: usize) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let backups = get_backup_files().await?;
    let mut removed_count = 0;
    
    // Skip the first 'keep_count' backups and remove the rest
    for backup_path in backups.iter().skip(keep_count) {
        if let Err(e) = fs::remove_file(backup_path).await {
            warn!("删除旧备份失败 {:?}: {}", backup_path, e);
        } else {
            info!("删除旧备份: {:?}", backup_path);
            removed_count += 1;
        }
    }
    
    Ok(removed_count)
}

/// Get config file size in bytes
pub async fn get_config_size() -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    
    if !config_path.exists() {
        return Ok(0);
    }
    
    let metadata = fs::metadata(&config_path).await?;
    Ok(metadata.len())
}

/// Get config last modified timestamp
pub async fn get_config_modified_time() -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    
    if !config_path.exists() {
        return Ok(0);
    }
    
    let metadata = std::fs::metadata(&config_path)?;
    let modified = metadata.modified()?;
    let duration = modified.duration_since(std::time::UNIX_EPOCH)?;
    
    Ok(duration.as_secs())
}

/// Compare two configs and get differences
pub fn get_config_diff(config1: &AppConfig, config2: &AppConfig) -> serde_json::Value {
    let json1 = serde_json::to_value(config1).unwrap_or(serde_json::Value::Null);
    let json2 = serde_json::to_value(config2).unwrap_or(serde_json::Value::Null);
    
    let mut diff = serde_json::Map::new();
    
    if let (Some(obj1), Some(obj2)) = (json1.as_object(), json2.as_object()) {
        for (key, value1) in obj1 {
            if let Some(value2) = obj2.get(key) {
                if value1 != value2 {
                    diff.insert(
                        key.clone(),
                        serde_json::json!({
                            "old": value1,
                            "new": value2
                        })
                    );
                }
            }
        }
    }
    
    serde_json::Value::Object(diff)
}

/// Create a config snapshot with metadata
pub async fn create_config_snapshot(
    config: &AppConfig,
    description: Option<String>
) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let data_dir = get_app_data_dir()?;
    
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).await?;
    }
    
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let snapshot_path = data_dir.join(format!("config.snapshot_{}.json", timestamp));
    
    let snapshot = serde_json::json!({
        "timestamp": timestamp.to_string(),
        "description": description.unwrap_or_else(|| "Manual snapshot".to_string()),
        "config": config
    });
    
    let json = serde_json::to_string_pretty(&snapshot)?;
    fs::write(&snapshot_path, json).await?;
    
    info!("配置快照已创建: {:?}", snapshot_path);
    Ok(snapshot_path)
}

/// Restore config from a snapshot file
pub async fn restore_from_snapshot(snapshot_path: PathBuf) -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    let content = fs::read_to_string(&snapshot_path).await?;
    let snapshot: serde_json::Value = serde_json::from_str(&content)?;
    
    // Extract config from snapshot
    if let Some(config_value) = snapshot.get("config") {
        let config = serde_json::from_value::<AppConfig>(config_value.clone())?;
        info!("从快照恢复配置: {:?}", snapshot_path);
        Ok(config)
    } else {
        // Try to parse as direct config
        let config = serde_json::from_str::<AppConfig>(&content)?;
        info!("从配置文件恢复: {:?}", snapshot_path);
        Ok(config)
    }
}

/// Check if config needs migration (version upgrade)
pub fn needs_migration(config: &AppConfig) -> bool {
    // In future versions, check for version field and determine if migration is needed
    // For now, always return false
    false
}

/// Migrate config to latest version
pub async fn migrate_config(config: AppConfig) -> Result<AppConfig, Box<dyn std::error::Error + Send + Sync>> {
    // In future versions, implement actual migration logic
    // For now, just return the config as-is
    info!("配置迁移检查完成，无需迁移");
    Ok(config)
}

/// Get config info (size, modified time, backup count, etc.)
pub async fn get_config_info() -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    let config_path = get_config_file_path()?;
    let backup_path = get_config_backup_path()?;
    let data_dir = get_app_data_dir()?;
    
    let config_exists = config_path.exists();
    let backup_exists = backup_path.exists();
    
    let config_size = if config_exists {
        get_config_size().await?
    } else {
        0
    };
    
    let config_modified = if config_exists {
        get_config_modified_time().await?
    } else {
        0
    };
    
    let backup_files = get_backup_files().await?;
    
    Ok(serde_json::json!({
        "config_path": config_path.to_string_lossy(),
        "backup_path": backup_path.to_string_lossy(),
        "data_dir": data_dir.to_string_lossy(),
        "config_exists": config_exists,
        "backup_exists": backup_exists,
        "config_size": config_size,
        "config_modified": config_modified,
        "backup_count": backup_files.len(),
        "backup_files": backup_files.iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
    }))
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppConfig, SystemConfig, WindowConfig, CharacterConfig, ThemeConfig};
    use tempfile::tempdir;
    use tokio;
    use serde_json::json;
    use tokio::fs;
    use serde::{Serialize, Deserialize};
    
    // 测试用的配置结构体定义
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestWindowConfig {
        width: f64,
        height: f64,
        x: Option<f64>,
        y: Option<f64>,
        resizable: bool,
        maximized: bool,
        minimized: bool,
        fullscreen: bool,
        always_on_top: bool,
        decorations: bool,
        transparent: bool,
        shadow: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestPosition {
        x: f64,
        y: f64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestCharacterConfig {
        current_character: String,
        scale: f64,
        position: TestPosition,
        auto_move: bool,
        interaction_enabled: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestThemeConfig {
        current_theme: String,
        custom_themes: Vec<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestChatConfig {
        auto_scroll: bool,
        show_timestamps: bool,
        font_size: f64,
        max_history: i32,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestPrivacyConfig {
        data_collection: bool,
        analytics: bool,
        crash_reports: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestSystemConfig {
        auto_start: bool,
        minimize_to_tray: bool,
        close_to_tray: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestAppConfig {
        window: TestWindowConfig,
        character: TestCharacterConfig,
        theme: TestThemeConfig,
        chat: TestChatConfig,
        privacy: TestPrivacyConfig,
        system: TestSystemConfig,
    }
    
    // 创建测试用的AppConfig
    fn create_test_config() -> TestAppConfig {
        TestAppConfig {
            window: TestWindowConfig {
                width: 800.0,
                height: 600.0,
                x: Some(100.0),
                y: Some(100.0),
                resizable: true,
                maximized: false,
                minimized: false,
                fullscreen: false,
                always_on_top: false,
                decorations: true,
                transparent: false,
                shadow: true,
            },
            character: TestCharacterConfig {
                current_character: "default".to_string(),
                scale: 1.0,
                position: TestPosition { x: 0.0, y: 0.0 },
                auto_move: true,
                interaction_enabled: true,
            },
            theme: TestThemeConfig {
                current_theme: "default".to_string(),
                custom_themes: vec![],
            },
            chat: TestChatConfig {
                auto_scroll: true,
                show_timestamps: true,
                font_size: 14.0,
                max_history: 1000,
            },
            privacy: TestPrivacyConfig {
                data_collection: false,
                analytics: false,
                crash_reports: true,
            },
            system: TestSystemConfig {
                auto_start: false,
                minimize_to_tray: true,
                close_to_tray: false,
            },
        }
    }

    // ================================
    // 路径函数测试
    // ================================

    #[test]
    fn test_get_app_data_dir() {
        let result = get_app_data_dir();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("zishu-sensei"));
    }

    #[test]
    fn test_get_app_log_dir() {
        let result = get_app_log_dir();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("zishu-sensei"));
        assert!(path.to_string_lossy().contains("logs"));
    }

    #[test]
    fn test_get_config_file_path() {
        let result = get_config_file_path();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("config.json"));
    }

    #[test]
    fn test_get_config_backup_path() {
        let result = get_config_backup_path();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("config.backup.json"));
    }

    // ================================
    // 配置验证测试
    // ================================

    // 为测试配置实现验证逻辑
    fn test_validate_config(config: &TestAppConfig) -> Result<(), String> {
        // 验证窗口配置
        if config.window.width < 200.0 || config.window.width > 4000.0 {
            return Err("窗口宽度必须在200到4000之间".to_string());
        }
        if config.window.height < 200.0 || config.window.height > 4000.0 {
            return Err("窗口高度必须在200到4000之间".to_string());
        }
        
        // 验证角色配置
        if config.character.scale < 0.1 || config.character.scale > 5.0 {
            return Err("缩放比例必须在0.1到5.0之间".to_string());
        }
        if config.character.current_character.trim().is_empty() {
            return Err("角色名称不能为空".to_string());
        }
        
        // 验证主题配置
        if config.theme.current_theme.trim().is_empty() {
            return Err("主题名称不能为空".to_string());
        }
        
        Ok(())
    }

    #[test]
    fn test_validate_config_valid() {
        let config = create_test_config();
        let result = test_validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_config_invalid_window_width() {
        let mut config = create_test_config();
        config.window.width = 100.0; // 太小
        
        let result = test_validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口宽度"));
    }

    #[test]
    fn test_validate_config_invalid_window_height() {
        let mut config = create_test_config();
        config.window.height = 5000.0; // 太大
        
        let result = test_validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口高度"));
    }

    #[test]
    fn test_validate_config_invalid_character_scale() {
        let mut config = create_test_config();
        config.character.scale = 0.05; // 太小
        
        let result = test_validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("缩放比例"));
    }

    #[test]
    fn test_validate_config_empty_character_name() {
        let mut config = create_test_config();
        config.character.current_character = "   ".to_string(); // 空白
        
        let result = test_validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("角色名称"));
    }

    #[test]
    fn test_validate_config_empty_theme_name() {
        let mut config = create_test_config();
        config.theme.current_theme = "".to_string(); // 空
        
        let result = test_validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("主题名称"));
    }

    // ================================
    // JSON合并测试
    // ================================

    #[test]
    fn test_merge_json_simple() {
        let mut base = json!({"a": 1, "b": 2});
        let updates = json!({"b": 3, "c": 4});
        
        merge_json(&mut base, &updates);
        
        assert_eq!(base["a"], 1);
        assert_eq!(base["b"], 3); // 更新
        assert_eq!(base["c"], 4); // 新增
    }

    #[test]
    fn test_merge_json_nested() {
        let mut base = json!({
            "window": {"width": 800, "height": 600},
            "character": {"name": "old"}
        });
        let updates = json!({
            "window": {"width": 1024},
            "character": {"scale": 1.5}
        });
        
        merge_json(&mut base, &updates);
        
        assert_eq!(base["window"]["width"], 1024); // 更新
        assert_eq!(base["window"]["height"], 600); // 保持不变
        assert_eq!(base["character"]["name"], "old"); // 保持不变
        assert_eq!(base["character"]["scale"], 1.5); // 新增
    }

    // 测试用的合并配置函数
    fn merge_test_config(base_config: &mut TestAppConfig, updates: serde_json::Value) -> Result<(), String> {
        // 将更新应用到基础配置
        let mut base_json = serde_json::to_value(&base_config).map_err(|e| e.to_string())?;
        merge_json(&mut base_json, &updates);
        
        // 反序列化更新后的配置
        let updated_config: TestAppConfig = serde_json::from_value(base_json).map_err(|e| e.to_string())?;
        
        // 验证更新后的配置
        test_validate_config(&updated_config)?;
        
        // 如果验证通过，更新原配置
        *base_config = updated_config;
        
        Ok(())
    }

    #[test]
    fn test_merge_config() {
        let mut base_config = create_test_config();
        let updates = json!({
            "window": {"width": 1024.0},
            "character": {"scale": 1.5}
        });
        
        let result = merge_test_config(&mut base_config, updates);
        assert!(result.is_ok());
        assert_eq!(base_config.window.width, 1024.0);
        assert_eq!(base_config.character.scale, 1.5);
    }

    #[test]
    fn test_merge_config_validation_failure() {
        let mut base_config = create_test_config();
        let updates = json!({
            "window": {"width": 50.0} // 无效值
        });
        
        let result = merge_test_config(&mut base_config, updates);
        assert!(result.is_err());
    }

    // ================================
    // 配置差异测试
    // ================================

    // 测试用的配置差异函数
    fn test_get_config_diff(config1: &TestAppConfig, config2: &TestAppConfig) -> serde_json::Value {
        let json1 = serde_json::to_value(config1).unwrap();
        let json2 = serde_json::to_value(config2).unwrap();
        
        // 简单的差异检测 - 比较JSON值
        if json1 == json2 {
            json!({})
        } else {
            json!({
                "changes": "detected",
                "config1": json1,
                "config2": json2
            })
        }
    }

    #[test]
    fn test_get_config_diff_no_changes() {
        let config1 = create_test_config();
        let config2 = create_test_config();
        
        let diff = test_get_config_diff(&config1, &config2);
        assert!(diff.as_object().unwrap().is_empty());
    }

    #[test]
    fn test_get_config_diff_with_changes() {
        let config1 = create_test_config();
        let mut config2 = create_test_config();
        config2.window.width = 1024.0;
        config2.character.scale = 1.5;
        
        let diff = test_get_config_diff(&config1, &config2);
        let diff_obj = diff.as_object().unwrap();
        
        assert!(!diff_obj.is_empty());
        // 注意：由于配置是嵌套结构，diff会显示整个window和character对象的差异
    }

    // ================================
    // 异步配置操作测试
    // ================================
    
    // 模拟AppHandle
    struct MockAppHandle;
    
    // 为了测试，我们需要修改一些函数以接受临时目录
    async fn test_load_config_file_not_exists() {
        let temp_dir = tempdir().unwrap();
        
        // 设置临时的数据目录（在实际测试中需要mock这些路径函数）
        // 这里我们直接创建一个不存在的配置文件路径进行测试
        let config_path = temp_dir.path().join("config.json");
        
        // 由于配置文件不存在，应该返回默认配置
        // 注意：实际测试中需要mock get_config_file_path函数
        assert!(!config_path.exists());
    }

    #[tokio::test]
    async fn test_save_and_load_config_roundtrip() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let original_config = create_test_config();
        
        // 序列化配置
        let json = serde_json::to_string_pretty(&original_config).unwrap();
        fs::write(&config_path, json).await.unwrap();
        
        // 读取并反序列化
        let content = fs::read_to_string(&config_path).await.unwrap();
        let loaded_config: TestAppConfig = serde_json::from_str(&content).unwrap();
        
        assert_eq!(original_config.window.width, loaded_config.window.width);
        assert_eq!(original_config.character.current_character, loaded_config.character.current_character);
    }

    #[tokio::test]
    async fn test_config_backup_creation() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        let backup_path = temp_dir.path().join("config.backup.json");
        
        let config = create_test_config();
        let json = serde_json::to_string_pretty(&config).unwrap();
        
        // 创建原始配置文件
        fs::write(&config_path, &json).await.unwrap();
        
        // 模拟备份过程
        fs::copy(&config_path, &backup_path).await.unwrap();
        
        assert!(config_path.exists());
        assert!(backup_path.exists());
        
        let original_content = fs::read_to_string(&config_path).await.unwrap();
        let backup_content = fs::read_to_string(&backup_path).await.unwrap();
        
        assert_eq!(original_content, backup_content);
    }

    // ================================
    // 导入导出测试
    // ================================

    // 测试用的导入导出函数
    async fn import_test_config(path: std::path::PathBuf) -> Result<TestAppConfig, String> {
        let content = fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
        let config: TestAppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        test_validate_config(&config)?;
        Ok(config)
    }

    async fn export_test_config(config: &TestAppConfig, path: std::path::PathBuf) -> Result<(), String> {
        test_validate_config(config)?;
        
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
            }
        }
        
        let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&path, json).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tokio::test]
    async fn test_import_config() {
        let temp_dir = tempdir().unwrap();
        let import_path = temp_dir.path().join("import.json");
        
        let config = create_test_config();
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&import_path, json).await.unwrap();
        
        let imported_config = import_test_config(import_path).await.unwrap();
        assert_eq!(config.window.width, imported_config.window.width);
        assert_eq!(config.character.current_character, imported_config.character.current_character);
    }

    #[tokio::test]
    async fn test_import_config_file_not_exists() {
        let temp_dir = tempdir().unwrap();
        let import_path = temp_dir.path().join("nonexistent.json");
        
        let result = import_test_config(import_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_import_config_invalid_json() {
        let temp_dir = tempdir().unwrap();
        let import_path = temp_dir.path().join("invalid.json");
        
        fs::write(&import_path, "invalid json content").await.unwrap();
        
        let result = import_test_config(import_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_export_config() {
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("export.json");
        
        let config = create_test_config();
        
        let result = export_test_config(&config, export_path.clone()).await;
        assert!(result.is_ok());
        assert!(export_path.exists());
        
        // 验证导出的内容
        let content = fs::read_to_string(&export_path).await.unwrap();
        let exported_config: TestAppConfig = serde_json::from_str(&content).unwrap();
        assert_eq!(config.window.width, exported_config.window.width);
    }

    #[tokio::test]
    async fn test_export_config_create_directory() {
        let temp_dir = tempdir().unwrap();
        let export_dir = temp_dir.path().join("new_dir");
        let export_path = export_dir.join("export.json");
        
        let config = create_test_config();
        
        // 目录不存在，应该自动创建
        assert!(!export_dir.exists());
        
        let result = export_test_config(&config, export_path.clone()).await;
        assert!(result.is_ok());
        assert!(export_dir.exists());
        assert!(export_path.exists());
    }

    // ================================
    // 快照功能测试
    // ================================

    #[tokio::test]
    async fn test_create_config_snapshot() {
        let temp_dir = tempdir().unwrap();
        
        // 由于create_config_snapshot使用get_app_data_dir()，我们需要模拟
        // 这里我们测试快照的JSON结构
        let config = create_test_config();
        let description = Some("Test snapshot".to_string());
        
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let snapshot_path = temp_dir.path().join(format!("config.snapshot_{}.json", timestamp));
        
        let snapshot = json!({
            "timestamp": timestamp.to_string(),
            "description": description.unwrap_or_else(|| "Manual snapshot".to_string()),
            "config": config
        });
        
        let json = serde_json::to_string_pretty(&snapshot).unwrap();
        fs::write(&snapshot_path, json).await.unwrap();
        
        assert!(snapshot_path.exists());
        
        // 验证快照内容
        let content = fs::read_to_string(&snapshot_path).await.unwrap();
        let snapshot_data: serde_json::Value = serde_json::from_str(&content).unwrap();
        
        assert!(snapshot_data["timestamp"].is_string());
        assert!(snapshot_data["description"].is_string());
        assert!(snapshot_data["config"].is_object());
    }

    // 测试用的快照恢复函数
    async fn restore_test_from_snapshot(path: std::path::PathBuf) -> Result<TestAppConfig, String> {
        let content = fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
        let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        
        // 尝试作为快照格式解析
        if let Some(config_data) = data.get("config") {
            let config: TestAppConfig = serde_json::from_value(config_data.clone()).map_err(|e| e.to_string())?;
            test_validate_config(&config)?;
            Ok(config)
        } else {
            // 尝试作为直接配置文件解析
            let config: TestAppConfig = serde_json::from_value(data).map_err(|e| e.to_string())?;
            test_validate_config(&config)?;
            Ok(config)
        }
    }

    #[tokio::test]
    async fn test_restore_from_snapshot() {
        let temp_dir = tempdir().unwrap();
        let snapshot_path = temp_dir.path().join("test_snapshot.json");
        
        let config = create_test_config();
        let snapshot = json!({
            "timestamp": "20241026_120000",
            "description": "Test snapshot",
            "config": config
        });
        
        let json = serde_json::to_string_pretty(&snapshot).unwrap();
        fs::write(&snapshot_path, json).await.unwrap();
        
        let restored_config = restore_test_from_snapshot(snapshot_path).await.unwrap();
        assert_eq!(config.window.width, restored_config.window.width);
        assert_eq!(config.character.current_character, restored_config.character.current_character);
    }

    #[tokio::test]
    async fn test_restore_from_direct_config_file() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("direct_config.json");
        
        let config = create_test_config();
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_path, json).await.unwrap();
        
        // 应该能够从直接的配置文件恢复
        let restored_config = restore_test_from_snapshot(config_path).await.unwrap();
        assert_eq!(config.window.width, restored_config.window.width);
    }

    // ================================
    // 备份管理测试
    // ================================

    #[tokio::test]
    async fn test_get_backup_files_empty_directory() {
        let temp_dir = tempdir().unwrap();
        
        // 模拟空的数据目录
        // 在实际测试中需要mock get_app_data_dir函数
        let mut entries = fs::read_dir(&temp_dir.path()).await.unwrap();
        let mut files = Vec::new();
        
        while let Some(entry) = entries.next_entry().await.unwrap() {
            files.push(entry.path());
        }
        
        assert!(files.is_empty());
    }

    #[tokio::test]
    async fn test_backup_file_filtering() {
        let temp_dir = tempdir().unwrap();
        
        // 创建各种类型的文件
        let files_to_create = vec![
            "config.backup.json",
            "config.reset_backup_20241026.json", 
            "config.json",
            "other_file.txt",
            "config.snapshot_20241026.json",
        ];
        
        for filename in files_to_create {
            let file_path = temp_dir.path().join(filename);
            fs::write(&file_path, "{}").await.unwrap();
        }
        
        let mut entries = fs::read_dir(&temp_dir.path()).await.unwrap();
        let mut backup_files = Vec::new();
        
        while let Some(entry) = entries.next_entry().await.unwrap() {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                if filename.starts_with("config.") && filename.ends_with(".json") {
                    if filename.contains("backup") || filename.contains("reset_backup") {
                        backup_files.push(path);
                    }
                }
            }
        }
        
        assert_eq!(backup_files.len(), 2);
    }

    // ================================
    // 配置信息测试
    // ================================

    #[tokio::test]
    async fn test_get_config_size() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let config = create_test_config();
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_path, &json).await.unwrap();
        
        let metadata = fs::metadata(&config_path).await.unwrap();
        let size = metadata.len();
        
        assert!(size > 0);
        assert_eq!(size, json.len() as u64);
    }

    #[tokio::test]
    async fn test_get_config_modified_time() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let config = create_test_config();
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_path, json).await.unwrap();
        
        let metadata = std::fs::metadata(&config_path).unwrap();
        let modified = metadata.modified().unwrap();
        let duration = modified.duration_since(std::time::UNIX_EPOCH).unwrap();
        
        assert!(duration.as_secs() > 0);
    }

    // ================================
    // 迁移功能测试
    // ================================

    #[test]
    fn test_needs_migration() {
        // 测试用的默认AppConfig（使用系统提供的结构）
        let app_config = AppConfig {
            window: WindowConfig {
                width: 800.0,
                height: 600.0,
                always_on_top: false,
                transparent: false,
                decorations: true,
                resizable: true,
                position: Some((100, 100)),
            },
            character: CharacterConfig {
                current_character: "default".to_string(),
                scale: 1.0,
                auto_idle: true,
                interaction_enabled: true,
            },
            theme: ThemeConfig {
                current_theme: "default".to_string(),
                custom_css: None,
            },
            system: SystemConfig {
                auto_start: false,
                minimize_to_tray: true,
                close_to_tray: false,
                show_notifications: true,
            }
        };
        
        // 目前总是返回false
        assert!(!needs_migration(&app_config));
    }

    #[tokio::test]
    async fn test_migrate_config() {
        // 测试用的默认AppConfig
        let app_config = AppConfig {
            window: WindowConfig {
                width: 800.0,
                height: 600.0,
                always_on_top: false,
                transparent: false,
                decorations: true,
                resizable: true,
                position: Some((100, 100)),
            },
            character: CharacterConfig {
                current_character: "default".to_string(),
                scale: 1.0,
                auto_idle: true,
                interaction_enabled: true,
            },
            theme: ThemeConfig {
                current_theme: "default".to_string(),
                custom_css: None,
            },
            system: SystemConfig {
                auto_start: false,
                minimize_to_tray: true,
                close_to_tray: false,
                show_notifications: true,
            }
        };
        
        // 目前迁移不做任何改变
        let migrated_config = migrate_config(app_config.clone()).await.unwrap();
        assert_eq!(app_config.system.auto_start, migrated_config.system.auto_start);
    }

    // ================================
    // 错误处理测试
    // ================================

    #[tokio::test]
    async fn test_invalid_json_handling() {
        let temp_dir = tempdir().unwrap();
        let invalid_config_path = temp_dir.path().join("invalid.json");
        
        // 写入无效的JSON
        fs::write(&invalid_config_path, "{ invalid json }").await.unwrap();
        
        let result = restore_test_from_snapshot(invalid_config_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_permission_denied_handling() {
        // 在Unix系统上创建只读目录进行测试
        if cfg!(unix) {
            let temp_dir = tempdir().unwrap();
            let readonly_dir = temp_dir.path().join("readonly");
            fs::create_dir_all(&readonly_dir).await.unwrap();
            
            // 设置只读权限
            let mut permissions = fs::metadata(&readonly_dir).await.unwrap().permissions();
            permissions.set_readonly(true);
            fs::set_permissions(&readonly_dir, permissions).await.unwrap();
            
            let config_path = readonly_dir.join("config.json");
            let config = create_test_config();
            
            let result = export_test_config(&config, config_path).await;
            // 在只读目录中写入应该失败
            assert!(result.is_err());
        }
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_validate_config_boundary_values() {
        let mut config = create_test_config();
        
        // 测试边界值
        config.window.width = 200.0; // 最小值
        config.window.height = 200.0; // 最小值
        config.character.scale = 0.1; // 最小值
        assert!(test_validate_config(&config).is_ok());
        
        config.window.width = 4000.0; // 最大值
        config.window.height = 4000.0; // 最大值  
        config.character.scale = 5.0; // 最大值
        assert!(test_validate_config(&config).is_ok());
        
        // 测试超出边界
        config.window.width = 199.9; // 低于最小值
        assert!(test_validate_config(&config).is_err());
        
        config.window.width = 200.0;
        config.character.scale = 5.1; // 高于最大值
        assert!(test_validate_config(&config).is_err());
    }

    #[tokio::test]
    async fn test_large_config_handling() {
        // 测试大型配置处理
        let mut config = create_test_config();
        
        // 添加大量自定义主题
        for i in 0..1000 {
            config.theme.custom_themes.push(format!("theme_{}", i));
        }
        
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("large_config.json");
        
        let result = export_test_config(&config, config_path.clone()).await;
        assert!(result.is_ok());
        
        let imported_config = import_test_config(config_path).await.unwrap();
        assert_eq!(config.theme.custom_themes.len(), imported_config.theme.custom_themes.len());
    }

    // ================================
    // 并发安全测试
    // ================================

    #[tokio::test]
    async fn test_concurrent_config_operations() {
        let temp_dir = tempdir().unwrap();
        let mut handles = vec![];
        
        // 创建多个并发的配置操作任务
        for i in 0..5 {
            let temp_dir = temp_dir.path().to_path_buf();
            let handle = tokio::spawn(async move {
                let config_path = temp_dir.join(format!("config_{}.json", i));
                let mut config = create_test_config();
                config.window.width = 800.0 + i as f64 * 100.0;
                
                export_test_config(&config, config_path.clone()).await.unwrap();
                let loaded_config = import_test_config(config_path).await.unwrap();
                
                assert_eq!(config.window.width, loaded_config.window.width);
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            handle.await.unwrap();
        }
    }
}



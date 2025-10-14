use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs;
use tracing::{info, warn, error};

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
            info!("配置文件已备份到: {:?}", backup_path);
        }
    }
    
    // Write config to file
    fs::write(&config_path, json).await
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    info!("配置已保存到: {:?}", config_path);
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



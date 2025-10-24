/**
 * 日志系统 Tauri 命令接口
 * 
 * 提供前端调用的日志管理功能：
 * - 日志记录和查询
 * - 日志配置管理
 * - 日志统计和分析
 * - 日志导出和清理
 * - 远程日志上传
 */

use crate::database::logging::{LogDatabase, LogFilter, LogStatistics};
use crate::utils::logger::{global_logger, init_global_logger, LogEntry, LogLevel, LoggerConfig, LoggerError, LoggerResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

// ================================
// 类型定义
// ================================

/// 日志搜索请求
#[derive(Debug, Deserialize)]
pub struct LogSearchRequest {
    pub filter: Option<LogFilter>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>, // "asc" | "desc"
}

/// 日志搜索响应
#[derive(Debug, Serialize)]
pub struct LogSearchResponse {
    pub logs: Vec<LogEntry>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}

/// 日志导出请求
#[derive(Debug, Deserialize)]
pub struct LogExportRequest {
    pub format: String, // "json" | "csv" | "txt"
    pub filter: Option<LogFilter>,
    pub file_path: String,
}

/// 远程日志上传配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteLogConfig {
    pub enabled: bool,
    pub endpoint_url: String,
    pub api_key: Option<String>,
    pub batch_size: usize,
    pub upload_interval_seconds: u64,
    pub retry_attempts: usize,
    pub timeout_seconds: u64,
}

impl Default for RemoteLogConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            endpoint_url: String::new(),
            api_key: None,
            batch_size: 100,
            upload_interval_seconds: 300, // 5分钟
            retry_attempts: 3,
            timeout_seconds: 30,
        }
    }
}

/// 日志系统状态
#[derive(Debug, Serialize)]
pub struct LogSystemStatus {
    pub initialized: bool,
    pub config: LoggerConfig,
    pub remote_config: RemoteLogConfig,
    pub current_log_file: Option<PathBuf>,
    pub log_file_size: u64,
    pub total_logs_count: usize,
    pub pending_upload_count: usize,
    pub last_upload_time: Option<i64>,
    pub last_error: Option<String>,
}

// ================================
// Tauri 命令
// ================================

/// 初始化日志系统
#[tauri::command]
pub async fn init_logging_system(
    config: LoggerConfig,
) -> Result<(), String> {
    init_global_logger(config)
        .map_err(|e| format!("初始化日志系统失败: {}", e))
}

/// 写入日志条目
#[tauri::command]
pub async fn write_log_entry(
    level: String,
    message: String,
    module: Option<String>,
    data: Option<serde_json::Value>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let log_level = LogLevel::from_str(&level)
        .map_err(|e| format!("无效的日志级别: {}", e))?;
    
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    
    let mut entry = LogEntry::new(log_level, message);
    
    if let Some(module) = module {
        entry = entry.with_module(module);
    }
    
    if let Some(data) = data {
        entry = entry.with_data(data);
    }
    
    if let Some(tags) = tags {
        entry = entry.with_tags(tags);
    }
    
    logger.log(entry)
        .map_err(|e| format!("写入日志失败: {}", e))
}

/// 搜索日志条目
#[tauri::command]
pub async fn search_logs(
    request: LogSearchRequest,
    db: State<'_, LogDatabase>,
) -> Result<LogSearchResponse, String> {
    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(50);
    let sort_by = request.sort_by.unwrap_or_else(|| "timestamp".to_string());
    let sort_order = request.sort_order.unwrap_or_else(|| "desc".to_string());
    
    let (logs, total) = db.search_logs(
        request.filter,
        page,
        page_size,
        &sort_by,
        &sort_order,
    ).await.map_err(|e| format!("搜索日志失败: {}", e))?;
    
    let total_pages = (total + page_size - 1) / page_size;
    
    Ok(LogSearchResponse {
        logs,
        total,
        page,
        page_size,
        total_pages,
    })
}

/// 获取日志统计信息
#[tauri::command]
pub async fn get_log_statistics(
    filter: Option<LogFilter>,
    db: State<'_, LogDatabase>,
) -> Result<crate::utils::logger::LogStatistics, String> {
    db.get_statistics(filter).await
        .map_err(|e| format!("获取日志统计失败: {}", e))
}

/// 导出日志
#[tauri::command]
pub async fn export_logs(
    request: LogExportRequest,
    db: State<'_, LogDatabase>,
) -> Result<usize, String> {
    db.export_logs(
        request.filter,
        &request.format,
        &request.file_path,
    ).await.map_err(|e| format!("导出日志失败: {}", e))
}

/// 清理旧日志
#[tauri::command]
pub async fn cleanup_old_logs(
    retention_days: u32,
    db: State<'_, LogDatabase>,
) -> Result<usize, String> {
    db.cleanup_old_logs(retention_days).await
        .map_err(|e| format!("清理旧日志失败: {}", e))
}

/// 获取日志配置
#[tauri::command]
pub async fn get_log_config() -> Result<LoggerConfig, String> {
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    
    Ok(logger.get_config())
}

/// 更新日志配置
#[tauri::command]
pub async fn update_log_config(
    config: LoggerConfig,
) -> Result<(), String> {
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    
    logger.update_config(config);
    Ok(())
}

/// 获取远程日志配置
#[tauri::command]
pub async fn get_remote_log_config(
    db: State<'_, LogDatabase>,
) -> Result<RemoteLogConfig, String> {
    db.get_remote_config().await
        .map_err(|e| format!("获取远程日志配置失败: {}", e))
}

/// 更新远程日志配置
#[tauri::command]
pub async fn update_remote_log_config(
    config: RemoteLogConfig,
    db: State<'_, LogDatabase>,
) -> Result<(), String> {
    db.save_remote_config(config).await
        .map_err(|e| format!("更新远程日志配置失败: {}", e))
}

/// 手动上传日志到远程服务器
#[tauri::command]
pub async fn upload_logs_to_remote(
    db: State<'_, LogDatabase>,
) -> Result<usize, String> {
    let config = db.get_remote_config().await
        .map_err(|e| format!("获取远程配置失败: {}", e))?;
    
    if !config.enabled {
        return Err("远程日志上传未启用".to_string());
    }
    
    upload_logs_batch(&*db, &config).await
        .map_err(|e| format!("上传日志失败: {}", e))
}

/// 获取日志系统状态
#[tauri::command]
pub async fn get_log_system_status(
    db: State<'_, LogDatabase>,
) -> Result<LogSystemStatus, String> {
    let logger = global_logger().ok();
    let config = if let Some(ref logger) = logger {
        logger.get_config()
    } else {
        LoggerConfig::default()
    };
    
    let remote_config = db.get_remote_config().await
        .unwrap_or_default();
    
    let stats = db.get_statistics(None).await
        .unwrap_or_default();
    
    let pending_count = db.count_pending_upload_logs().await
        .unwrap_or(0);
    
    let last_upload = db.get_last_upload_time().await
        .ok();
    
    Ok(LogSystemStatus {
        initialized: logger.is_some(),
        config,
        remote_config,
        current_log_file: None, // TODO: 从logger获取
        log_file_size: 0, // TODO: 从logger获取
        total_logs_count: stats.total_count,
        pending_upload_count: pending_count,
        last_upload_time: last_upload,
        last_error: None, // TODO: 从错误记录获取
    })
}

/// 刷新日志缓冲区
#[tauri::command]
pub async fn flush_log_buffer() -> Result<(), String> {
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    
    logger.flush()
        .map_err(|e| format!("刷新日志缓冲区失败: {}", e))
}

/// 获取日志文件列表
#[tauri::command]
pub async fn get_log_files() -> Result<Vec<LogFileInfo>, String> {
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    
    let config = logger.get_config();
    let log_dir = &config.log_dir;
    
    if !log_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut files = Vec::new();
    
    for entry in std::fs::read_dir(log_dir)
        .map_err(|e| format!("读取日志目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("log") {
            let metadata = entry.metadata()
                .map_err(|e| format!("获取文件元数据失败: {}", e))?;
            
            files.push(LogFileInfo {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                created: metadata.created().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64),
                modified: metadata.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64),
            });
        }
    }
    
    // 按修改时间倒序排列
    files.sort_by(|a, b| {
        b.modified.unwrap_or(0).cmp(&a.modified.unwrap_or(0))
    });
    
    Ok(files)
}

/// 删除日志文件
#[tauri::command]
pub async fn delete_log_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    
    // 安全检查：确保文件在日志目录内
    let logger = global_logger()
        .map_err(|e| format!("获取日志实例失败: {}", e))?;
    let config = logger.get_config();
    
    if !path.starts_with(&config.log_dir) {
        return Err("文件路径不在日志目录内".to_string());
    }
    
    std::fs::remove_file(&path)
        .map_err(|e| format!("删除日志文件失败: {}", e))
}

/// 压缩日志文件
#[tauri::command]
pub async fn compress_log_files(
    file_paths: Vec<String>,
    output_path: String,
) -> Result<String, String> {
    use std::fs::File;
    use std::io::{Read, Write};
    use flate2::write::GzEncoder;
    use flate2::Compression;
    
    let mut encoder = GzEncoder::new(
        File::create(&output_path)
            .map_err(|e| format!("创建压缩文件失败: {}", e))?,
        Compression::default()
    );
    
    for file_path in file_paths {
        let mut file = File::open(&file_path)
            .map_err(|e| format!("打开文件失败 {}: {}", file_path, e))?;
        
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("读取文件失败 {}: {}", file_path, e))?;
        
        encoder.write_all(&buffer)
            .map_err(|e| format!("写入压缩文件失败: {}", e))?;
    }
    
    encoder.finish()
        .map_err(|e| format!("完成压缩失败: {}", e))?;
    
    Ok(output_path)
}

// ================================
// 辅助类型和函数
// ================================

/// 日志文件信息
#[derive(Debug, Serialize)]
pub struct LogFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub created: Option<i64>,
    pub modified: Option<i64>,
}

/// 批量上传日志到远程服务器
async fn upload_logs_batch(
    db: &LogDatabase,
    config: &RemoteLogConfig,
) -> Result<usize, String> {
    use reqwest::Client;
    use serde_json::json;
    use std::time::Duration;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout_seconds))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    let logs = db.get_pending_upload_logs(config.batch_size).await
        .map_err(|e| format!("获取待上传日志失败: {}", e))?;
    
    if logs.is_empty() {
        return Ok(0);
    }
    
    let payload = json!({
        "logs": logs,
        "metadata": {
            "app_version": env!("CARGO_PKG_VERSION"),
            "upload_time": chrono::Utc::now().timestamp(),
            "batch_size": logs.len()
        }
    });
    
    let mut request = client.post(&config.endpoint_url)
        .header("Content-Type", "application/json")
        .json(&payload);
    
    if let Some(ref api_key) = config.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }
    
    let mut last_error = String::new();
    
    for attempt in 0..config.retry_attempts {
        match request.try_clone().unwrap().send().await {
            Ok(response) => {
                if response.status().is_success() {
                    // 标记日志为已上传
                    let log_ids: Vec<i64> = logs.iter().map(|l| l.id.unwrap_or(0)).collect();
                    db.mark_logs_as_uploaded(log_ids).await
                        .map_err(|e| format!("标记日志已上传失败: {}", e))?;
                    
                    // 更新最后上传时间
                    db.update_last_upload_time().await
                        .map_err(|e| format!("更新上传时间失败: {}", e))?;
                    
                    return Ok(logs.len());
                } else {
                    last_error = format!(
                        "HTTP错误: {} - {}", 
                        response.status(),
                        response.text().await.unwrap_or_default()
                    );
                }
            }
            Err(e) => {
                last_error = format!("请求失败: {}", e);
            }
        }
        
        if attempt < config.retry_attempts - 1 {
            // 指数退避
            let delay = Duration::from_millis(100 * (2_u64.pow(attempt as u32)));
            tokio::time::sleep(delay).await;
        }
    }
    
    Err(format!("上传失败，已重试{}次: {}", config.retry_attempts, last_error))
}

/// 扩展的LogEntry，包含数据库ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntryWithId {
    #[serde(flatten)]
    pub entry: LogEntry,
    pub id: Option<i64>,
    pub uploaded: bool,
    pub created_at: Option<i64>,
}

impl From<LogEntry> for LogEntryWithId {
    fn from(entry: LogEntry) -> Self {
        Self {
            entry,
            id: None,
            uploaded: false,
            created_at: None,
        }
    }
}

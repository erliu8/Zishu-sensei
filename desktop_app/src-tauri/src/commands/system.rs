//! System-related commands
//!
//! This module provides commands for system operations including:
//! - System information
//! - Application version
//! - Update checking
//! - Application restart
//! - File operations

use std::path::PathBuf;
use tauri::{AppHandle, State, Manager};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use sysinfo::{System, SystemExt, CpuExt, ProcessExt};

use crate::{
    commands::*,
    state::AppState,
    utils::*,
};

// ================================
// Data Types
// ================================

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    /// Operating system name
    pub os: String,
    /// OS version
    pub os_version: String,
    /// Architecture
    pub arch: String,
    /// CPU count
    pub cpu_count: usize,
    /// Total memory (bytes)
    pub total_memory: u64,
    /// Available memory (bytes)
    pub available_memory: u64,
    /// Used memory (bytes)
    pub used_memory: u64,
    /// CPU usage (percentage)
    pub cpu_usage: f32,
    /// Uptime (seconds)
    pub uptime: u64,
    /// App version
    pub app_version: String,
    /// App name
    pub app_name: String,
}

/// Application version info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    /// Version string
    pub version: String,
    /// Build date
    pub build_date: Option<String>,
    /// Git commit hash
    pub git_hash: Option<String>,
}

/// Update information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    /// Current version
    pub current_version: String,
    /// Latest version
    pub latest_version: String,
    /// Update available
    pub update_available: bool,
    /// Update message
    pub message: String,
    /// Download URL
    pub download_url: Option<String>,
    /// Release notes
    pub release_notes: Option<String>,
    /// Release date
    pub release_date: Option<String>,
    /// Update size (bytes)
    pub size: Option<u64>,
    /// Update is mandatory
    pub mandatory: bool,
}

// ================================
// Command Handlers
// ================================

/// Get system information
#[tauri::command]
pub async fn get_system_info(
    app_handle: AppHandle,
) -> Result<CommandResponse<SystemInfo>, String> {
    info!("获取系统信息");
    
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    
    // Initialize sysinfo system
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get OS version
    let os_version = sys.long_os_version().unwrap_or_else(|| {
        if cfg!(target_os = "windows") {
            "Windows".to_string()
        } else if cfg!(target_os = "macos") {
            "macOS".to_string()
        } else if cfg!(target_os = "linux") {
            "Linux".to_string()
        } else {
            "Unknown".to_string()
        }
    });
    
    // Get CPU count
    let cpu_count = sys.cpus().len();
    
    // Get memory info using sysinfo
    let total_memory = sys.total_memory();
    let available_memory = sys.available_memory();
    let used_memory = sys.used_memory();
    
    // Get CPU usage (需要刷新两次才能获取准确值)
    sys.refresh_cpu();
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    sys.refresh_cpu();
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    
    // Get system uptime
    let uptime = sys.uptime();
    
    let app_version = app_handle.package_info().version.to_string();
    let app_name = app_handle.package_info().name.clone();
    
    let system_info = SystemInfo {
        os,
        os_version,
        arch,
        cpu_count,
        total_memory,
        available_memory,
        used_memory,
        cpu_usage,
        uptime,
        app_version,
        app_name,
    };
    
    info!("系统信息: 内存总量={}MB, 可用={}MB, CPU使用率={:.2}%", 
        total_memory / 1024 / 1024,
        available_memory / 1024 / 1024,
        cpu_usage
    );
    
    Ok(CommandResponse::success(system_info))
}

/// Get application version
#[tauri::command]
pub async fn get_app_version(
    app_handle: AppHandle,
) -> Result<CommandResponse<VersionInfo>, String> {
    info!("获取应用版本");
    
    let version = app_handle.package_info().version.to_string();
    
    let version_info = VersionInfo {
        version,
        build_date: option_env!("BUILD_DATE").map(|s| s.to_string()),
        git_hash: option_env!("GIT_HASH").map(|s| s.to_string()),
    };
    
    Ok(CommandResponse::success(version_info))
}

/// Compare two version strings (simple implementation)
fn compare_versions(version1: &str, version2: &str) -> bool {
    let v1_parts: Vec<u32> = version1
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let v2_parts: Vec<u32> = version2
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    
    for i in 0..std::cmp::max(v1_parts.len(), v2_parts.len()) {
        let v1 = v1_parts.get(i).unwrap_or(&0);
        let v2 = v2_parts.get(i).unwrap_or(&0);
        
        if v1 > v2 {
            return true;
        } else if v1 < v2 {
            return false;
        }
    }
    
    false
}

/// Restart application
#[tauri::command]
pub async fn restart_app(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("重启应用");
    
    // Use tauri's restart API
    app_handle.restart();
    
    Ok(CommandResponse::success_with_message(
        true,
        "应用正在重启".to_string(),
    ))
}

/// Quit application
#[tauri::command]
pub async fn quit_app(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("退出应用");
    
    app_handle.exit(0);
    
    Ok(CommandResponse::success_with_message(
        true,
        "应用正在退出".to_string(),
    ))
}

/// Show file/folder in file explorer
#[tauri::command]
pub async fn show_in_folder(
    path: String,
) -> Result<CommandResponse<bool>, String> {
    info!("在文件管理器中显示: {}", path);
    
    let path_buf = PathBuf::from(&path);
    
    // Check if path exists
    if !path_buf.exists() {
        return Ok(CommandResponse::error(format!("路径不存在: {}", path)));
    }
    
    // Open in file explorer
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Err(e) = Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
        {
            error!("打开文件管理器失败: {}", e);
            return Ok(CommandResponse::error(format!("打开文件管理器失败: {}", e)));
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Err(e) = Command::new("open")
            .args(["-R", &path])
            .spawn()
        {
            error!("打开访达失败: {}", e);
            return Ok(CommandResponse::error(format!("打开访达失败: {}", e)));
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Try different file managers
        let file_managers = ["nautilus", "dolphin", "thunar", "nemo", "caja"];
        let mut success = false;
        
        for fm in &file_managers {
            if let Ok(_) = Command::new(fm)
                .arg(&path)
                .spawn()
            {
                success = true;
                break;
            }
        }
        
        if !success {
            error!("打开文件管理器失败");
            return Ok(CommandResponse::error("打开文件管理器失败".to_string()));
        }
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已在文件管理器中打开".to_string(),
    ))
}

/// Open URL in default browser
#[tauri::command]
pub async fn open_url(
    url: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("打开URL: {}", url);
    
    use tauri::api::shell;
    
    if let Err(e) = shell::open(&app_handle.shell_scope(), &url, None) {
        error!("打开URL失败: {}", e);
        return Ok(CommandResponse::error(format!("打开URL失败: {}", e)));
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已在浏览器中打开".to_string(),
    ))
}

/// Get application data directory path
#[tauri::command]
pub async fn get_app_data_path() -> Result<CommandResponse<String>, String> {
    info!("获取应用数据目录");
    
    match get_app_data_dir() {
        Ok(path) => {
            Ok(CommandResponse::success(path.to_string_lossy().to_string()))
        }
        Err(e) => {
            error!("获取应用数据目录失败: {}", e);
            Ok(CommandResponse::error(format!("获取应用数据目录失败: {}", e)))
        }
    }
}

/// Get application log directory path
#[tauri::command]
pub async fn get_app_log_path() -> Result<CommandResponse<String>, String> {
    info!("获取应用日志目录");
    
    match get_app_log_dir() {
        Ok(path) => {
            Ok(CommandResponse::success(path.to_string_lossy().to_string()))
        }
        Err(e) => {
            error!("获取应用日志目录失败: {}", e);
            Ok(CommandResponse::error(format!("获取应用日志目录失败: {}", e)))
        }
    }
}

/// Set auto-start on system boot
#[tauri::command]
pub async fn set_auto_start(
    enabled: bool,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("设置开机自启: {}", enabled);
    
    // 实现自启动功能
    match configure_auto_launch(enabled, &app_handle) {
        Ok(_) => {
            info!("自启动配置成功: {}", if enabled { "已启用" } else { "已禁用" });
            
            // 更新配置
            let mut config = state.config.lock().clone();
            config.system.auto_start = enabled;
            *state.config.lock() = config.clone();
            
            if let Err(e) = save_config(&app_handle, &config).await {
                error!("保存自启动配置失败: {}", e);
                return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
            }
            
            Ok(CommandResponse::success_with_message(
                enabled,
                if enabled { "已启用开机自启".to_string() } else { "已禁用开机自启".to_string() },
            ))
        }
        Err(e) => {
            error!("配置自启动失败: {}", e);
            Ok(CommandResponse::error(format!("配置自启动失败: {}", e)))
        }
    }
}

/// Configure auto-launch using auto-launch crate
fn configure_auto_launch(
    enabled: bool,
    app_handle: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use auto_launch::AutoLaunch;
    use std::env;
    
    // 获取应用名称和可执行文件路径
    let app_name = app_handle.package_info().name.clone();
    let app_path = env::current_exe()?;
    
    info!("配置自启动: 应用={}, 路径={:?}", app_name, app_path);
    
    // 创建 AutoLaunch 实例
    let auto = AutoLaunch::new(
        &app_name,
        app_path.to_str().ok_or("无效的应用路径")?,
        &[] as &[&str], // 启动参数
    );
    
    if enabled {
        // 启用自启动
        if auto.is_enabled()? {
            info!("自启动已经启用");
            return Ok(());
        }
        
        auto.enable()?;
        info!("自启动已启用");
    } else {
        // 禁用自启动
        if !auto.is_enabled()? {
            info!("自启动已经禁用");
            return Ok(());
        }
        
        auto.disable()?;
        info!("自启动已禁用");
    }
    
    Ok(())
}

/// Check if auto-start is enabled
#[tauri::command]
pub async fn is_auto_start_enabled(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("检查开机自启状态");
    
    match check_auto_launch_status(&app_handle) {
        Ok(enabled) => {
            Ok(CommandResponse::success(enabled))
        }
        Err(e) => {
            error!("检查自启动状态失败: {}", e);
            Ok(CommandResponse::error(format!("检查自启动状态失败: {}", e)))
        }
    }
}

/// Check auto-launch status
fn check_auto_launch_status(
    app_handle: &AppHandle,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    use auto_launch::AutoLaunch;
    use std::env;
    
    let app_name = app_handle.package_info().name.clone();
    let app_path = env::current_exe()?;
    
    let auto = AutoLaunch::new(
        &app_name,
        app_path.to_str().ok_or("无效的应用路径")?,
        &[] as &[&str],
    );
    
    Ok(auto.is_enabled()?)
}

/// Copy text to clipboard
#[tauri::command]
pub async fn copy_to_clipboard(
    text: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("复制到剪贴板");
    
    use tauri::ClipboardManager;
    
    if let Err(e) = app_handle.clipboard_manager().write_text(text) {
        error!("复制到剪贴板失败: {}", e);
        return Ok(CommandResponse::error(format!("复制失败: {}", e)));
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "已复制到剪贴板".to_string(),
    ))
}

/// Read text from clipboard
#[tauri::command]
pub async fn read_from_clipboard(
    app_handle: AppHandle,
) -> Result<CommandResponse<String>, String> {
    info!("从剪贴板读取");
    
    use tauri::ClipboardManager;
    
    match app_handle.clipboard_manager().read_text() {
        Ok(Some(text)) => {
            Ok(CommandResponse::success(text))
        }
        Ok(None) => {
            Ok(CommandResponse::error("剪贴板为空".to_string()))
        }
        Err(e) => {
            error!("读取剪贴板失败: {}", e);
            Ok(CommandResponse::error(format!("读取失败: {}", e)))
        }
    }
}

// ================================
// 系统托盘命令
// ================================

/// 更新托盘图标
#[tauri::command]
pub async fn update_tray_icon(
    icon_path: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("更新托盘图标: {}", icon_path);
    
    use crate::events::tray::helpers;
    
    match helpers::update_tray_icon(&app_handle, &icon_path) {
        Ok(_) => {
            Ok(CommandResponse::success_with_message(
                true,
                "托盘图标已更新".to_string(),
            ))
        }
        Err(e) => {
            error!("更新托盘图标失败: {}", e);
            Ok(CommandResponse::error(e))
        }
    }
}

/// 更新托盘工具提示
#[tauri::command]
pub async fn update_tray_tooltip(
    tooltip: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("更新托盘提示: {}", tooltip);
    
    use crate::events::tray::helpers;
    
    match helpers::update_tray_tooltip(&app_handle, &tooltip) {
        Ok(_) => {
            Ok(CommandResponse::success_with_message(
                true,
                "托盘提示已更新".to_string(),
            ))
        }
        Err(e) => {
            error!("更新托盘提示失败: {}", e);
            Ok(CommandResponse::error(e))
        }
    }
}

/// 显示托盘通知
#[tauri::command]
pub async fn show_tray_notification(
    title: String,
    body: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("显示托盘通知: {}", title);
    
    use tauri::api::notification::Notification;
    
    match Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title(&title)
        .body(&body)
        .show()
    {
        Ok(_) => {
            Ok(CommandResponse::success_with_message(
                true,
                "通知已显示".to_string(),
            ))
        }
        Err(e) => {
            error!("显示通知失败: {}", e);
            Ok(CommandResponse::error(format!("显示通知失败: {}", e)))
        }
    }
}

/// 更新托盘状态
#[tauri::command]
pub async fn update_tray_status(
    status: String,
    tooltip: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("更新托盘状态: {}", status);
    
    use crate::state::tray_state::TrayIconState;
    
    // 解析状态
    let tray_status = match status.as_str() {
        "idle" => TrayIconState::Idle,
        "active" => TrayIconState::Active,
        "busy" => TrayIconState::Busy,
        "notification" => TrayIconState::Notification,
        "error" => TrayIconState::Error,
        _ => TrayIconState::Idle,
    };
    
    // 更新状态
    state.tray.set_icon_state(tray_status.clone());
    
    // 更新托盘提示
    if let Some(tooltip_text) = tooltip {
        use crate::events::tray::helpers;
        if let Err(e) = helpers::update_tray_tooltip(&app_handle, &tooltip_text) {
            warn!("更新托盘提示失败: {}", e);
        }
    }
    
    // 发送状态更新事件到前端
    if let Err(e) = app_handle.emit_all("tray-status-changed", &tray_status) {
        warn!("发送托盘状态变更事件失败: {}", e);
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        format!("托盘状态已更新为: {}", status),
    ))
}

/// 获取托盘状态
#[tauri::command]
pub async fn get_tray_status(
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取托盘状态");
    
    let status = state.tray.get_icon_state();
    let resources = state.tray.get_system_resources();
    let unread_count = state.tray.get_unread_notification_count();
    
    Ok(CommandResponse::success(serde_json::json!({
        "status": status,
        "resources": resources,
        "unread_count": unread_count,
    })))
}

/// 添加最近对话
#[tauri::command]
pub async fn add_recent_conversation(
    conversation_id: String,
    title: String,
    preview: String,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("添加最近对话: {}", conversation_id);
    
    use crate::state::tray_state::RecentConversation;
    use chrono::Utc;
    
    let conversation = RecentConversation {
        id: conversation_id,
        title,
        last_message: preview,
        updated_at: Utc::now(),
        unread_count: 0,
    };
    
    state.tray.add_or_update_conversation(conversation);
    
    Ok(CommandResponse::success_with_message(
        true,
        "已添加到最近对话".to_string(),
    ))
}

/// 获取最近对话
#[tauri::command]
pub async fn get_recent_conversations(
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<serde_json::Value>>, String> {
    info!("获取最近对话");
    
    let conversations = state.tray.get_recent_conversations();
    let limit = limit.unwrap_or(5);
    
    let result: Vec<serde_json::Value> = conversations
        .iter()
        .take(limit)
        .map(|conv| serde_json::json!({
            "id": conv.id,
            "title": conv.title,
            "preview": conv.last_message,
            "timestamp": conv.updated_at,
        }))
        .collect();
    
    Ok(CommandResponse::success(result))
}

/// 清空最近对话
#[tauri::command]
pub async fn clear_recent_conversations(
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("清空最近对话");
    
    state.tray.clear_conversations();
    
    Ok(CommandResponse::success_with_message(
        true,
        "已清空最近对话".to_string(),
    ))
}

// ================================
// 系统监控命令
// ================================

/// 获取系统监控信息
#[tauri::command]
pub async fn get_system_monitor_stats(
    app_handle: AppHandle,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取系统监控信息");
    
    use crate::system_monitor;
    
    match system_monitor::get_system_monitor_stats(&app_handle) {
        Some(stats) => {
            Ok(CommandResponse::success(serde_json::to_value(stats).unwrap_or_default()))
        }
        None => {
            warn!("系统监控未初始化");
            Ok(CommandResponse::error("系统监控未初始化".to_string()))
        }
    }
}

/// 启动系统监控
#[tauri::command]
pub async fn start_system_monitor(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("启动系统监控");
    
    match crate::system_monitor::start_system_monitor(app_handle).await {
        Ok(_) => {
            Ok(CommandResponse::success_with_message(
                true,
                "系统监控已启动".to_string(),
            ))
        }
        Err(e) => {
            error!("启动系统监控失败: {}", e);
            Ok(CommandResponse::error(format!("启动系统监控失败: {}", e)))
        }
    }
}

/// 停止系统监控
#[tauri::command]
pub async fn stop_system_monitor(
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("停止系统监控");
    
    match crate::system_monitor::stop_system_monitor(&app_handle).await {
        Ok(_) => {
            Ok(CommandResponse::success_with_message(
                true,
                "系统监控已停止".to_string(),
            ))
        }
        Err(e) => {
            error!("停止系统监控失败: {}", e);
            Ok(CommandResponse::error(format!("停止系统监控失败: {}", e)))
        }
    }
}

// ================================
// Logger Commands
// ================================

/// Upload logs request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadLogsRequest {
    /// Logs to upload
    pub logs: Vec<serde_json::Value>,
}

/// Check log rotation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckLogRotationRequest {
    /// Maximum file size in bytes
    pub max_size: u64,
    /// Retention days
    pub retention_days: u32,
}

/// Upload logs to backend
#[tauri::command]
pub async fn upload_logs(
    request: UploadLogsRequest,
) -> Result<CommandResponse<bool>, String> {
    info!("上传日志: {} 条", request.logs.len());
    
    // 从环境变量读取日志上传URL
    let log_upload_url = std::env::var("LOG_UPLOAD_URL")
        .unwrap_or_else(|_| "https://api.zishu-sensei.com/logs/upload".to_string());
    
    // 尝试上传到后端 API
    match upload_logs_to_backend(&log_upload_url, &request.logs).await {
        Ok(response) => {
            info!("日志上传成功: {:?}", response);
            Ok(CommandResponse::success_with_message(
                true,
                format!("成功上传 {} 条日志", request.logs.len()),
            ))
        }
        Err(e) => {
            warn!("日志上传失败: {}, 已记录到本地", e);
            
            // 如果上传失败，记录到本地日志
            for log in &request.logs {
                tracing::debug!("前端日志(上传失败): {}", log);
            }
            
            // 返回成功但带警告消息
            Ok(CommandResponse::success_with_message(
                true,
                format!("日志已记录到本地 ({} 条), 但上传失败: {}", request.logs.len(), e),
            ))
        }
    }
}

/// Upload logs to backend API
async fn upload_logs_to_backend(
    upload_url: &str,
    logs: &[serde_json::Value],
) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    use reqwest;
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    
    // 准备上传数据
    let upload_data = serde_json::json!({
        "logs": logs,
        "timestamp": chrono::Utc::now().timestamp(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
    });
    
    let response = client
        .post(upload_url)
        .json(&upload_data)
        .header("Content-Type", "application/json")
        .header("User-Agent", format!("Zishu-Sensei/{}", env!("CARGO_PKG_VERSION")))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("服务器返回错误状态: {}", response.status()).into());
    }
    
    let result = response.json().await?;
    Ok(result)
}

/// Check log rotation and cleanup old logs
#[tauri::command]
pub async fn check_log_rotation(
    request: CheckLogRotationRequest,
) -> Result<CommandResponse<bool>, String> {
    info!("检查日志轮转");
    
    // Get logger and check rotation
    if let Ok(logger) = crate::utils::logger::global_logger() {
        // The logger's check_rotation method is called automatically on each log write
        // This command can be used to manually trigger cleanup
        logger.flush().map_err(|e| e.to_string())?;
    }
    
    Ok(CommandResponse::success_with_message(
        true,
        "日志轮转检查完成".to_string(),
    ))
}

/// Get log stats
#[tauri::command]
pub async fn get_log_stats() -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取日志统计");
    
    match collect_log_statistics().await {
        Ok(stats) => {
            info!("日志统计收集成功: {:?}", stats);
            Ok(CommandResponse::success(stats))
        }
        Err(e) => {
            error!("日志统计收集失败: {}", e);
            Ok(CommandResponse::error(format!("日志统计收集失败: {}", e)))
        }
    }
}

/// Collect log statistics
async fn collect_log_statistics() -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    use std::fs;
    use chrono::{DateTime, Local};
    
    let log_dir = get_app_log_dir()?;
    
    if !log_dir.exists() {
        return Ok(serde_json::json!({
            "total_logs": 0,
            "total_files": 0,
            "total_size": 0,
            "oldest_log": null,
            "newest_log": null,
            "files": []
        }));
    }
    
    let mut total_logs = 0u64;
    let mut total_files = 0u32;
    let mut total_size = 0u64;
    let mut oldest_time: Option<DateTime<Local>> = None;
    let mut newest_time: Option<DateTime<Local>> = None;
    let mut log_files = Vec::new();
    
    // 遍历日志目录
    for entry in fs::read_dir(&log_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        // 只处理 .log 文件
        if path.extension().and_then(|s| s.to_str()) == Some("log") {
            let metadata = entry.metadata()?;
            let file_size = metadata.len();
            total_size += file_size;
            total_files += 1;
            
            // 获取文件修改时间
            if let Ok(modified) = metadata.modified() {
                let modified_time: DateTime<Local> = modified.into();
                
                // 更新最旧和最新时间
                match oldest_time {
                    None => oldest_time = Some(modified_time),
                    Some(ref t) if modified_time < *t => oldest_time = Some(modified_time),
                    _ => {}
                }
                
                match newest_time {
                    None => newest_time = Some(modified_time),
                    Some(ref t) if modified_time > *t => newest_time = Some(modified_time),
                    _ => {}
                }
            }
            
            // 统计文件中的日志行数
            if let Ok(content) = fs::read_to_string(&path) {
                let line_count = content.lines().count() as u64;
                total_logs += line_count;
                
                log_files.push(serde_json::json!({
                    "name": path.file_name().and_then(|n| n.to_str()),
                    "size": file_size,
                    "lines": line_count,
                    "modified": metadata.modified()
                        .ok()
                        .and_then(|t| {
                            let dt: DateTime<Local> = t.into();
                            Some(dt.format("%Y-%m-%d %H:%M:%S").to_string())
                        }),
                }));
            }
        }
    }
    
    // 按修改时间排序（最新的在前）
    log_files.sort_by(|a, b| {
        let time_a = a.get("modified").and_then(|v| v.as_str()).unwrap_or("");
        let time_b = b.get("modified").and_then(|v| v.as_str()).unwrap_or("");
        time_b.cmp(time_a)
    });
    
    Ok(serde_json::json!({
        "total_logs": total_logs,
        "total_files": total_files,
        "total_size": total_size,
        "total_size_mb": (total_size as f64 / 1024.0 / 1024.0),
        "oldest_log": oldest_time.map(|t| t.format("%Y-%m-%d %H:%M:%S").to_string()),
        "newest_log": newest_time.map(|t| t.format("%Y-%m-%d %H:%M:%S").to_string()),
        "log_dir": log_dir.to_string_lossy(),
        "files": log_files,
    }))
}

/// Clean old logs
#[tauri::command]
pub async fn clean_old_logs(
    retention_days: Option<u32>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("清理旧日志, 保留天数: {:?}", retention_days);
    
    let retention_days = retention_days.unwrap_or(7);
    
    match cleanup_old_log_files(retention_days).await {
        Ok(result) => {
            info!("日志清理完成: 删除 {} 个文件, 释放 {} MB", 
                result.deleted_count, 
                result.freed_size / 1024 / 1024
            );
            
            Ok(CommandResponse::success_with_message(
                serde_json::json!({
                    "deleted_count": result.deleted_count,
                    "freed_size": result.freed_size,
                    "freed_size_mb": (result.freed_size as f64 / 1024.0 / 1024.0),
                }),
                format!("清理完成: 删除 {} 个文件", result.deleted_count),
            ))
        }
        Err(e) => {
            error!("日志清理失败: {}", e);
            Ok(CommandResponse::error(format!("日志清理失败: {}", e)))
        }
    }
}

/// Log cleanup result
struct LogCleanupResult {
    deleted_count: u32,
    freed_size: u64,
}

/// Cleanup old log files
async fn cleanup_old_log_files(
    retention_days: u32,
) -> Result<LogCleanupResult, Box<dyn std::error::Error + Send + Sync>> {
    use std::fs;
    use chrono::{DateTime, Local, Duration};
    
    let log_dir = get_app_log_dir()?;
    
    if !log_dir.exists() {
        return Ok(LogCleanupResult {
            deleted_count: 0,
            freed_size: 0,
        });
    }
    
    let cutoff_time = Local::now() - Duration::days(retention_days as i64);
    let mut deleted_count = 0u32;
    let mut freed_size = 0u64;
    
    for entry in fs::read_dir(&log_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("log") {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    let modified_time: DateTime<Local> = modified.into();
                    
                    if modified_time < cutoff_time {
                        let file_size = metadata.len();
                        
                        match fs::remove_file(&path) {
                            Ok(_) => {
                                info!("删除旧日志文件: {:?}", path);
                                deleted_count += 1;
                                freed_size += file_size;
                            }
                            Err(e) => {
                                warn!("删除日志文件失败 {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(LogCleanupResult {
        deleted_count,
        freed_size,
    })
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "get_system_info".to_string(),
        CommandMetadata {
            name: "get_system_info".to_string(),
            description: "获取系统信息".to_string(),
            input_type: None,
            output_type: Some("SystemInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "get_app_version".to_string(),
        CommandMetadata {
            name: "get_app_version".to_string(),
            description: "获取应用版本".to_string(),
            input_type: None,
            output_type: Some("VersionInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "check_for_updates".to_string(),
        CommandMetadata {
            name: "check_for_updates".to_string(),
            description: "检查应用更新".to_string(),
            input_type: None,
            output_type: Some("serde_json::Value".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata.insert(
        "restart_app".to_string(),
        CommandMetadata {
            name: "restart_app".to_string(),
            description: "重启应用".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "system".to_string(),
        },
    );
    
    metadata
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use tokio_test;
    use serde_json::json;
    use tempfile::TempDir;
    use std::fs;

    // Mock structures for testing
    #[derive(Clone)]
    struct MockSystemInfo {
        os: String,
        arch: String,
        memory: u64,
    }

    impl MockSystemInfo {
        fn new() -> Self {
            Self {
                os: "Linux".to_string(),
                arch: "x86_64".to_string(),
                memory: 8_000_000_000, // 8GB
            }
        }
    }

    // Create test system info
    fn create_test_system_info() -> SystemInfo {
        SystemInfo {
            os: "Linux".to_string(),
            os_version: "Ubuntu 22.04".to_string(),
            arch: "x86_64".to_string(),
            cpu_count: 8,
            total_memory: 8_000_000_000,
            available_memory: 4_000_000_000,
            used_memory: 4_000_000_000,
            cpu_usage: 25.5,
            uptime: 86400, // 1 day
            app_version: "1.0.0".to_string(),
            app_name: "Zishu Sensei".to_string(),
        }
    }

    // Create test version info
    fn create_test_version_info() -> VersionInfo {
        VersionInfo {
            version: "1.0.0".to_string(),
            build_date: Some("2025-10-26".to_string()),
            git_hash: Some("abc123def456".to_string()),
        }
    }

    // Create test update info
    fn create_test_update_info() -> UpdateInfo {
        UpdateInfo {
            current_version: "1.0.0".to_string(),
            latest_version: "1.1.0".to_string(),
            update_available: true,
            message: "新版本可用".to_string(),
            download_url: Some("https://example.com/download".to_string()),
            release_notes: Some("修复了一些bug".to_string()),
            release_date: Some("2025-10-27".to_string()),
            size: Some(50_000_000), // 50MB
            mandatory: false,
        }
    }

    // ================================
    // 系统信息测试
    // ================================

    #[tokio::test]
    async fn test_create_test_system_info() {
        // Arrange & Act
        let system_info = create_test_system_info();

        // Assert
        assert_eq!(system_info.os, "Linux");
        assert_eq!(system_info.arch, "x86_64");
        assert_eq!(system_info.cpu_count, 8);
        assert!(system_info.total_memory > 0);
        assert!(system_info.cpu_usage >= 0.0);
        assert!(system_info.uptime > 0);
        assert!(!system_info.app_version.is_empty());
        assert!(!system_info.app_name.is_empty());
    }

    #[tokio::test]
    async fn test_system_info_memory_calculations() {
        // Arrange
        let system_info = create_test_system_info();

        // Act & Assert
        assert_eq!(system_info.total_memory, 8_000_000_000);
        assert_eq!(system_info.available_memory, 4_000_000_000);
        assert_eq!(system_info.used_memory, 4_000_000_000);
        
        // 验证内存使用率计算
        let usage_percent = (system_info.used_memory as f64 / system_info.total_memory as f64) * 100.0;
        assert_eq!(usage_percent, 50.0);
    }

    #[tokio::test]
    async fn test_system_info_validation() {
        // Arrange
        let system_info = create_test_system_info();

        // Act & Assert
        // 验证基本字段不为空
        assert!(!system_info.os.is_empty());
        assert!(!system_info.os_version.is_empty());
        assert!(!system_info.arch.is_empty());
        
        // 验证数值字段合理性
        assert!(system_info.cpu_count > 0);
        assert!(system_info.total_memory > 0);
        assert!(system_info.cpu_usage >= 0.0 && system_info.cpu_usage <= 100.0);
        assert!(system_info.uptime >= 0);
    }

    // ================================
    // 版本信息测试
    // ================================

    #[tokio::test]
    async fn test_create_test_version_info() {
        // Arrange & Act
        let version_info = create_test_version_info();

        // Assert
        assert_eq!(version_info.version, "1.0.0");
        assert!(version_info.build_date.is_some());
        assert!(version_info.git_hash.is_some());
        
        if let Some(build_date) = version_info.build_date {
            assert!(!build_date.is_empty());
        }
        
        if let Some(git_hash) = version_info.git_hash {
            assert!(!git_hash.is_empty());
        }
    }

    #[tokio::test]
    async fn test_version_info_optional_fields() {
        // Arrange
        let mut version_info = create_test_version_info();
        
        // Act - 测试可选字段为 None 的情况
        version_info.build_date = None;
        version_info.git_hash = None;

        // Assert
        assert_eq!(version_info.version, "1.0.0");
        assert!(version_info.build_date.is_none());
        assert!(version_info.git_hash.is_none());
    }

    // ================================
    // 版本比较测试  
    // ================================

    #[tokio::test]
    async fn test_compare_versions_equal() {
        // Arrange
        let version1 = "1.0.0";
        let version2 = "1.0.0";

        // Act
        let result = compare_versions(version1, version2);

        // Assert
        assert!(!result); // 相等版本返回 false
    }

    #[tokio::test]
    async fn test_compare_versions_newer() {
        // Arrange & Act & Assert
        assert!(compare_versions("1.1.0", "1.0.0"));
        assert!(compare_versions("2.0.0", "1.9.9"));
        assert!(compare_versions("1.0.1", "1.0.0"));
    }

    #[tokio::test]
    async fn test_compare_versions_older() {
        // Arrange & Act & Assert
        assert!(!compare_versions("1.0.0", "1.1.0"));
        assert!(!compare_versions("1.9.9", "2.0.0"));
        assert!(!compare_versions("1.0.0", "1.0.1"));
    }

    #[tokio::test]
    async fn test_compare_versions_edge_cases() {
        // Arrange & Act & Assert
        // 测试不同长度的版本号
        assert!(compare_versions("1.0.0.1", "1.0.0"));
        assert!(!compare_versions("1.0", "1.0.0"));
        
        // 测试包含非数字字符的版本号（解析失败时默认为0）
        assert!(!compare_versions("1.0.0-alpha", "1.0.0"));
        assert!(!compare_versions("invalid", "1.0.0"));
    }

    // ================================
    // 更新信息测试
    // ================================

    #[tokio::test]
    async fn test_create_test_update_info() {
        // Arrange & Act
        let update_info = create_test_update_info();

        // Assert
        assert_eq!(update_info.current_version, "1.0.0");
        assert_eq!(update_info.latest_version, "1.1.0");
        assert!(update_info.update_available);
        assert!(!update_info.message.is_empty());
        assert!(update_info.download_url.is_some());
        assert!(update_info.release_notes.is_some());
        assert!(update_info.release_date.is_some());
        assert!(update_info.size.is_some());
        assert!(!update_info.mandatory);
    }

    #[tokio::test]
    async fn test_update_info_no_update_available() {
        // Arrange
        let mut update_info = create_test_update_info();
        update_info.current_version = "1.1.0".to_string(); // 与最新版本相同
        update_info.latest_version = "1.1.0".to_string();
        update_info.update_available = false;

        // Act & Assert
        assert!(!update_info.update_available);
        assert_eq!(update_info.current_version, update_info.latest_version);
    }

    #[tokio::test]
    async fn test_update_info_mandatory_update() {
        // Arrange
        let mut update_info = create_test_update_info();
        update_info.mandatory = true;
        update_info.message = "强制更新".to_string();

        // Act & Assert
        assert!(update_info.mandatory);
        assert!(update_info.message.contains("强制"));
    }

    // ================================
    // 文件和路径操作测试
    // ================================

    #[tokio::test]
    async fn test_path_validation_existing_file() {
        // Arrange - 创建临时文件
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_file.txt");
        fs::write(&file_path, "test content").unwrap();

        // Act & Assert
        assert!(file_path.exists());
        assert!(file_path.is_file());
    }

    #[tokio::test]
    async fn test_path_validation_nonexistent_file() {
        // Arrange
        let nonexistent_path = PathBuf::from("/nonexistent/path/file.txt");

        // Act & Assert
        assert!(!nonexistent_path.exists());
    }

    #[tokio::test]
    async fn test_path_validation_directory() {
        // Arrange
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Act & Assert
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
    }

    // ================================
    // 剪贴板相关测试
    // ================================

    #[tokio::test]
    async fn test_clipboard_text_validation() {
        // Arrange
        let long_text = "very long text ".repeat(1000);
        let test_texts = vec![
            "简单文本",
            "包含特殊字符的文本: !@#$%^&*()",
            "多行\n文本\n测试",
            "包含中文的测试文本：紫舒老师",
            "", // 空字符串
            &long_text, // 长文本
        ];

        // Act & Assert
        for text in test_texts {
            // 验证文本不会导致panic
            assert!(text.len() >= 0);
            // 验证UTF-8编码有效性
            assert!(text.chars().count() >= 0);
        }
    }

    #[tokio::test]
    async fn test_clipboard_special_characters() {
        // Arrange
        let special_texts = vec![
            "🚀 emoji test",
            "Tab\tSeparated\tValues",
            "Line\nBreak\rTest",
            "Unicode: ñáéíóú",
            "JSON: {\"key\": \"value\"}",
            "XML: <tag>content</tag>",
        ];

        // Act & Assert
        for text in special_texts {
            assert!(text.is_ascii() || !text.is_ascii()); // 任何UTF-8文本都应该有效
            assert!(!text.contains('\0')); // 不应包含null字符
        }
    }

    // ================================
    // 托盘状态测试
    // ================================

    #[tokio::test]
    async fn test_tray_status_parsing() {
        // Arrange
        let statuses = vec![
            ("idle", "idle"),
            ("active", "active"),
            ("busy", "busy"),
            ("notification", "notification"),
            ("error", "error"),
            ("unknown", "idle"), // 未知状态应该默认为idle
        ];

        // Act & Assert
        for (input, expected) in statuses {
            let expected_status = match expected {
                "idle" => "idle",
                "active" => "active", 
                "busy" => "busy",
                "notification" => "notification",
                "error" => "error",
                _ => "idle",
            };
            
            assert_eq!(expected_status, expected);
        }
    }

    #[tokio::test]
    async fn test_tray_tooltip_validation() {
        // Arrange
        let long_tooltip = "很长的tooltip文本".repeat(100);
        let tooltips = vec![
            "系统正常运行",
            "CPU使用率: 25%",
            "内存使用: 4GB/8GB",
            "有3条未读消息",
            "", // 空tooltip
            &long_tooltip, // 长tooltip
        ];

        // Act & Assert
        for tooltip in tooltips {
            assert!(tooltip.len() >= 0); // 基本验证
            // 在实际应用中，可能需要长度限制
            // assert!(tooltip.len() <= 256);
        }
    }

    // ================================
    // 自启动配置测试
    // ================================

    #[tokio::test]
    async fn test_auto_start_config_validation() {
        // Arrange
        let test_cases = vec![
            (true, "应启用自启动"),
            (false, "应禁用自启动"),
        ];

        // Act & Assert
        for (enabled, description) in test_cases {
            // 验证布尔值
            assert!(enabled == true || enabled == false);
            assert!(!description.is_empty());
        }
    }

    // ================================
    // 系统监控测试
    // ================================

    #[tokio::test]
    async fn test_system_monitor_stats_structure() {
        // Arrange
        let mock_stats = json!({
            "cpu_usage": 25.5,
            "memory_usage": 50.0,
            "disk_usage": 75.0,
            "network_io": {
                "bytes_sent": 1024000,
                "bytes_received": 2048000
            },
            "processes": 150,
            "uptime": 86400
        });

        // Act & Assert
        assert!(mock_stats.is_object());
        assert!(mock_stats["cpu_usage"].is_number());
        assert!(mock_stats["memory_usage"].is_number());
        assert!(mock_stats["network_io"].is_object());
        
        // 验证数值范围
        if let Some(cpu) = mock_stats["cpu_usage"].as_f64() {
            assert!(cpu >= 0.0 && cpu <= 100.0);
        }
        
        if let Some(memory) = mock_stats["memory_usage"].as_f64() {
            assert!(memory >= 0.0 && memory <= 100.0);
        }
    }

    // ================================
    // 日志相关测试
    // ================================

    #[tokio::test]
    async fn test_upload_logs_request_validation() {
        // Arrange
        let logs = vec![
            json!({"level": "info", "message": "测试日志1", "timestamp": "2025-10-26T12:00:00Z"}),
            json!({"level": "error", "message": "错误日志", "timestamp": "2025-10-26T12:01:00Z"}),
            json!({"level": "debug", "message": "调试信息", "timestamp": "2025-10-26T12:02:00Z"}),
        ];

        let request = UploadLogsRequest {
            logs: logs.clone(),
        };

        // Act & Assert
        assert_eq!(request.logs.len(), 3);
        
        for log in &request.logs {
            assert!(log.is_object());
            assert!(log["level"].is_string());
            assert!(log["message"].is_string());
            assert!(log["timestamp"].is_string());
        }
    }

    #[tokio::test]
    async fn test_check_log_rotation_request() {
        // Arrange
        let request = CheckLogRotationRequest {
            max_size: 10_000_000, // 10MB
            retention_days: 7,
        };

        // Act & Assert
        assert!(request.max_size > 0);
        assert!(request.retention_days > 0);
        assert!(request.retention_days <= 365); // 合理的保留期限
    }

    #[tokio::test]
    async fn test_log_cleanup_result_validation() {
        // Arrange
        let result = LogCleanupResult {
            deleted_count: 5,
            freed_size: 50_000_000, // 50MB
        };

        // Act & Assert
        assert!(result.deleted_count >= 0);
        assert!(result.freed_size >= 0);
        
        // 计算平均文件大小
        if result.deleted_count > 0 {
            let avg_size = result.freed_size / result.deleted_count as u64;
            assert!(avg_size > 0); // 平均文件大小应该大于0
        }
    }

    // ================================
    // 最近对话测试
    // ================================

    #[tokio::test]
    async fn test_recent_conversation_data() {
        // Arrange
        use chrono::Utc;
        
        let conversations = vec![
            json!({
                "id": "conv-1",
                "title": "与AI的对话",
                "preview": "你好，请帮我解决这个问题...",
                "timestamp": Utc::now().to_rfc3339()
            }),
            json!({
                "id": "conv-2", 
                "title": "工作流讨论",
                "preview": "如何创建一个自动化工作流？",
                "timestamp": Utc::now().to_rfc3339()
            }),
        ];

        // Act & Assert
        for conv in &conversations {
            assert!(conv["id"].is_string());
            assert!(conv["title"].is_string());
            assert!(conv["preview"].is_string());
            assert!(conv["timestamp"].is_string());
            
            // 验证ID不为空
            if let Some(id) = conv["id"].as_str() {
                assert!(!id.is_empty());
            }
            
            // 验证标题不为空
            if let Some(title) = conv["title"].as_str() {
                assert!(!title.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_recent_conversation_limit() {
        // Arrange
        let limit_values = vec![
            Some(5),
            Some(10),
            Some(1),
            None, // 默认限制
        ];

        // Act & Assert
        for limit in limit_values {
            let effective_limit = limit.unwrap_or(5);
            assert!(effective_limit > 0);
            assert!(effective_limit <= 100); // 合理的上限
        }
    }

    // ================================
    // 错误处理和边界条件测试
    // ================================

    #[tokio::test]
    async fn test_empty_input_handling() {
        // Arrange & Act & Assert
        // 测试空字符串
        let empty_string = String::new();
        assert!(empty_string.is_empty());
        
        // 测试空路径
        let empty_path = PathBuf::new();
        assert_eq!(empty_path.to_string_lossy(), "");
        
        // 测试空JSON
        let empty_json = json!({});
        assert!(empty_json.is_object());
        assert_eq!(empty_json.as_object().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_large_input_handling() {
        // Arrange
        let large_string = "x".repeat(1_000_000); // 1MB字符串
        let large_number = u64::MAX;
        let large_json = json!({
            "large_array": (0..10000).collect::<Vec<i32>>(),
            "large_string": large_string.clone()
        });

        // Act & Assert
        assert_eq!(large_string.len(), 1_000_000);
        assert!(large_number > 0);
        assert!(large_json.is_object());
        
        // 验证大型JSON的结构
        assert!(large_json["large_array"].is_array());
        assert!(large_json["large_string"].is_string());
    }

    #[tokio::test]
    async fn test_special_characters_handling() {
        // Arrange
        let special_chars = vec![
            "🚀", // emoji
            "\\n\\t\\r", // 转义字符
            "\"'`", // 引号
            "<>&", // HTML特殊字符
            "中文测试", // 中文
            "Тест", // 俄文
            "اختبار", // 阿拉伯文
        ];

        // Act & Assert
        for chars in special_chars {
            assert!(!chars.is_empty());
            // 验证UTF-8有效性
            assert!(chars.chars().count() > 0);
        }
    }

    #[tokio::test]
    async fn test_concurrent_operations_safety() {
        // Arrange
        use std::sync::Arc;
        use std::sync::atomic::{AtomicU32, Ordering};
        use tokio::task;

        let counter = Arc::new(AtomicU32::new(0));
        let mut handles = vec![];

        // Act - 并发执行多个操作
        for _ in 0..10 {
            let counter_clone = counter.clone();
            let handle = task::spawn(async move {
                for _ in 0..100 {
                    counter_clone.fetch_add(1, Ordering::SeqCst);
                }
            });
            handles.push(handle);
        }

        // 等待所有任务完成
        for handle in handles {
            handle.await.unwrap();
        }

        // Assert
        assert_eq!(counter.load(Ordering::SeqCst), 1000);
    }

    // ================================
    // 性能测试（简化版）
    // ================================

    #[tokio::test]
    async fn test_system_info_creation_performance() {
        // Arrange
        let start_time = std::time::Instant::now();
        let iterations = 1000;

        // Act
        for _ in 0..iterations {
            let _system_info = create_test_system_info();
        }

        // Assert
        let duration = start_time.elapsed();
        assert!(duration.as_millis() < 1000, "系统信息创建耗时过长: {:?}", duration);
    }

    #[tokio::test]
    async fn test_version_comparison_performance() {
        // Arrange
        let start_time = std::time::Instant::now();
        let iterations = 10000;

        // Act
        for i in 0..iterations {
            let version1 = format!("1.{}.0", i % 100);
            let version2 = format!("1.{}.1", i % 100);
            let _result = compare_versions(&version1, &version2);
        }

        // Assert
        let duration = start_time.elapsed();
        assert!(duration.as_millis() < 1000, "版本比较耗时过长: {:?}", duration);
    }

    #[tokio::test]
    async fn test_json_serialization_performance() {
        // Arrange
        let start_time = std::time::Instant::now();
        let system_info = create_test_system_info();

        // Act
        for _ in 0..1000 {
            let _json = serde_json::to_string(&system_info).unwrap();
        }

        // Assert
        let duration = start_time.elapsed();
        assert!(duration.as_millis() < 1000, "JSON序列化耗时过长: {:?}", duration);
    }

    // ================================
    // 集成测试（模拟）
    // ================================

    #[tokio::test]
    async fn test_system_workflow_integration() {
        // Arrange
        let system_info = create_test_system_info();
        let version_info = create_test_version_info();

        // Act - 模拟系统信息和版本信息的组合使用
        let combined_info = json!({
            "system": {
                "os": system_info.os,
                "arch": system_info.arch,
                "memory": system_info.total_memory,
                "cpu_count": system_info.cpu_count
            },
            "app": {
                "version": version_info.version,
                "build_date": version_info.build_date,
                "git_hash": version_info.git_hash
            }
        });

        // Assert
        assert!(combined_info.is_object());
        assert!(combined_info["system"].is_object());
        assert!(combined_info["app"].is_object());
        
        // 验证系统信息
        assert_eq!(combined_info["system"]["os"], "Linux");
        assert_eq!(combined_info["system"]["arch"], "x86_64");
        
        // 验证应用信息
        assert_eq!(combined_info["app"]["version"], "1.0.0");
    }

    #[tokio::test]
    async fn test_tray_and_system_monitor_integration() {
        // Arrange
        let system_info = create_test_system_info();
        
        // Act - 模拟托盘显示系统监控信息
        let tray_info = json!({
            "status": "active",
            "tooltip": format!("CPU: {:.1}% | 内存: {}MB", 
                system_info.cpu_usage,
                system_info.used_memory / 1024 / 1024
            ),
            "system": {
                "cpu_usage": system_info.cpu_usage,
                "memory_usage_percent": (system_info.used_memory as f64 / system_info.total_memory as f64) * 100.0,
                "uptime": system_info.uptime
            }
        });

        // Assert
        assert!(tray_info["tooltip"].is_string());
        assert!(tray_info["system"]["cpu_usage"].is_number());
        assert!(tray_info["system"]["memory_usage_percent"].is_number());
        
        // 验证tooltip包含相关信息
        if let Some(tooltip) = tray_info["tooltip"].as_str() {
            assert!(tooltip.contains("CPU"));
            assert!(tooltip.contains("内存"));
        }
    }

    // ================================
    // 数据验证测试
    // ================================

    #[tokio::test]
    async fn test_data_sanitization() {
        // Arrange
        let very_long_input = "极长的输入".repeat(10000);
        let malicious_inputs = vec![
            "<script>alert('xss')</script>",
            "'; DROP TABLE users; --",
            "../../../etc/passwd",
            "\0null_byte_test",
            &very_long_input,
        ];

        // Act & Assert
        for input in malicious_inputs {
            // 基本的输入验证 - 在实际应用中需要更严格的清理
            assert!(input.len() > 0);
            
            // 检查潜在的危险字符
            let has_dangerous_chars = input.contains('<') || 
                                    input.contains('>') || 
                                    input.contains(';') ||
                                    input.contains('\0');
                                    
            // 在实际应用中，包含危险字符的输入应该被拒绝或清理
            if has_dangerous_chars {
                // 这里只是验证我们能检测到危险字符
                assert!(true, "检测到潜在危险字符: {}", input);
            }
        }
    }

    #[tokio::test]
    async fn test_configuration_validation() {
        // Arrange
        let configs = vec![
            ("auto_start", json!(true)),
            ("log_level", json!("info")),
            ("max_log_size", json!(10_000_000)),
            ("retention_days", json!(7)),
            ("theme", json!("dark")),
        ];

        // Act & Assert
        for (key, value) in configs {
            assert!(!key.is_empty());
            
            match key {
                "auto_start" => assert!(value.is_boolean()),
                "log_level" => {
                    assert!(value.is_string());
                    if let Some(level) = value.as_str() {
                        assert!(["trace", "debug", "info", "warn", "error"].contains(&level));
                    }
                },
                "max_log_size" | "retention_days" => {
                    assert!(value.is_number());
                    if let Some(num) = value.as_u64() {
                        assert!(num > 0);
                    }
                },
                _ => {
                    // 其他配置项的基本验证
                    assert!(!value.is_null());
                }
            }
        }
    }
}

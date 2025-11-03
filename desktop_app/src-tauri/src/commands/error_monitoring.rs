/**
 * 错误监控系统 Tauri 命令接口
 * 提供错误记录、查询、统计和上报等功能
 */

use crate::database::error::{
    ErrorDatabase, ErrorRecord, ErrorStatistics, ErrorContext,
    ErrorSeverity, ErrorType, ErrorSource, ErrorStatus,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

// ================================
// 全局状态管理
// ================================

pub struct ErrorMonitorState {
    pub database: Arc<Mutex<ErrorDatabase>>,
    pub config: Arc<Mutex<ErrorMonitorConfig>>,
}

impl ErrorMonitorState {
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let database = ErrorDatabase::new(db_path)?;
        let config = ErrorMonitorConfig::default();

        Ok(Self {
            database: Arc::new(Mutex::new(database)),
            config: Arc::new(Mutex::new(config)),
        })
    }
}

// ================================
// 配置结构
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMonitorConfig {
    pub enabled: bool,
    pub log_level: String,
    pub capture_js_errors: bool,
    pub capture_promise_rejections: bool,
    pub capture_react_errors: bool,
    pub capture_console_errors: bool,
    pub max_stored_errors: i64,
    pub storage_retention_days: i64,
    pub report_config: ErrorReportConfig,
    pub enable_auto_recovery: bool,
    pub recovery_timeout: i64,
    pub show_error_notifications: bool,
    pub show_error_dialog: bool,
    pub allow_user_reporting: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorReportConfig {
    pub enabled: bool,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub min_severity: String,
    pub blacklisted_types: Vec<String>,
    pub whitelisted_types: Option<Vec<String>>,
    pub rate_limit_enabled: bool,
    pub max_reports_per_minute: i64,
    pub include_user_data: bool,
    pub include_system_info: bool,
    pub mask_sensitive_data: bool,
    pub batch_enabled: bool,
    pub batch_size: i64,
    pub batch_timeout: i64,
}

impl Default for ErrorMonitorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            log_level: "error".to_string(),
            capture_js_errors: true,
            capture_promise_rejections: true,
            capture_react_errors: true,
            capture_console_errors: false,
            max_stored_errors: 10000,
            storage_retention_days: 30,
            report_config: ErrorReportConfig::default(),
            enable_auto_recovery: true,
            recovery_timeout: 5000,
            show_error_notifications: true,
            show_error_dialog: true,
            allow_user_reporting: true,
        }
    }
}

impl Default for ErrorReportConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            endpoint: None,
            api_key: None,
            min_severity: "medium".to_string(),
            blacklisted_types: vec!["user_input".to_string()],
            whitelisted_types: None,
            rate_limit_enabled: true,
            max_reports_per_minute: 10,
            include_user_data: false,
            include_system_info: true,
            mask_sensitive_data: true,
            batch_enabled: true,
            batch_size: 10,
            batch_timeout: 30000,
        }
    }
}

// ================================
// 命令输入结构
// ================================

#[derive(Debug, Deserialize)]
pub struct ReportErrorRequest {
    pub error_type: String,
    pub source: String,
    pub severity: String,
    pub name: String,
    pub message: String,
    pub stack: Option<String>,
    pub cause: Option<String>,
    pub context: ErrorContextInput,
}

#[derive(Debug, Deserialize)]
pub struct ErrorContextInput {
    pub timestamp: String,
    pub session_id: String,
    pub user_id: Option<String>,
    pub user_agent: Option<String>,
    pub platform: String,
    pub app_version: String,
    pub build_version: String,
    pub url: Option<String>,
    pub route: Option<String>,
    pub component: Option<String>,
    pub function: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub operation: Option<String>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub state: Option<HashMap<String, serde_json::Value>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct ErrorListRequest {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub severity_filter: Option<String>,
    pub type_filter: Option<String>,
    pub status_filter: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateErrorStatusRequest {
    pub error_id: String,
    pub status: String,
    pub resolution: Option<String>,
}

// ================================
// 命令响应结构
// ================================

#[derive(Debug, Serialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub timestamp: String,
}

impl<T> CommandResult<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// ================================
// Tauri 命令实现
// ================================

/// 报告错误
#[tauri::command]
pub fn report_error(
    request: ReportErrorRequest,
    state: State<ErrorMonitorState>,
) -> CommandResult<String> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    // 生成错误ID
    let error_id = generate_error_id(&request.name, &request.message, request.context.component.as_deref());
    let record_id = uuid::Uuid::new_v4().to_string();
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    // 转换上下文
    let context = ErrorContext {
        timestamp: request.context.timestamp,
        session_id: request.context.session_id,
        user_id: request.context.user_id,
        user_agent: request.context.user_agent,
        platform: request.context.platform,
        app_version: request.context.app_version,
        build_version: request.context.build_version,
        url: request.context.url,
        route: request.context.route,
        component: request.context.component,
        function: request.context.function,
        line: request.context.line,
        column: request.context.column,
        operation: request.context.operation,
        parameters: request.context.parameters,
        state: request.context.state,
        metadata: request.context.metadata,
    };

    let context_json = match serde_json::to_string(&context) {
        Ok(json) => json,
        Err(e) => return CommandResult::error(format!("Failed to serialize context: {}", e)),
    };

    // 创建错误记录
    let error_record = ErrorRecord {
        id: record_id.clone(),
        error_id: error_id.clone(),
        error_type: ErrorType::from_str(&request.error_type),
        source: ErrorSource::from_str(&request.source),
        severity: ErrorSeverity::from_str(&request.severity),
        status: ErrorStatus::New,
        name: request.name,
        message: request.message,
        stack: request.stack,
        cause: request.cause,
        context: context_json,
        occurrence_count: 1,
        first_occurred: now,
        last_occurred: now,
        resolved: false,
        resolved_at: None,
        resolution: None,
    };

    match db.insert_error(&error_record) {
        Ok(()) => CommandResult::success(error_id),
        Err(e) => CommandResult::error(format!("Failed to insert error: {}", e)),
    }
}

/// 获取错误列表
#[tauri::command]
pub fn get_error_list(
    request: ErrorListRequest,
    state: State<ErrorMonitorState>,
) -> CommandResult<Vec<ErrorRecord>> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    let limit = request.limit.unwrap_or(50);
    let offset = request.offset.unwrap_or(0);

    match db.list_errors(
        limit,
        offset,
        request.severity_filter.as_deref(),
        request.type_filter.as_deref(),
        request.status_filter.as_deref(),
    ) {
        Ok(errors) => CommandResult::success(errors),
        Err(e) => CommandResult::error(format!("Failed to get error list: {}", e)),
    }
}

/// 获取错误详情
#[tauri::command]
pub fn get_error_details(
    error_id: String,
    state: State<ErrorMonitorState>,
) -> CommandResult<Option<ErrorRecord>> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    match db.get_error(&error_id) {
        Ok(error) => CommandResult::success(error),
        Err(e) => CommandResult::error(format!("Failed to get error details: {}", e)),
    }
}

/// 更新错误状态
#[tauri::command]
pub fn update_error_status(
    request: UpdateErrorStatusRequest,
    state: State<ErrorMonitorState>,
) -> CommandResult<()> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    let status = ErrorStatus::from_str(&request.status);

    match db.update_error_status(&request.error_id, status, request.resolution.as_deref()) {
        Ok(()) => CommandResult::success(()),
        Err(e) => CommandResult::error(format!("Failed to update error status: {}", e)),
    }
}

/// 获取错误统计信息
#[tauri::command]
pub fn get_error_statistics(state: State<ErrorMonitorState>) -> CommandResult<ErrorStatistics> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    match db.get_statistics() {
        Ok(stats) => CommandResult::success(stats),
        Err(e) => CommandResult::error(format!("Failed to get error statistics: {}", e)),
    }
}

/// 清理过期错误
#[tauri::command]
pub fn cleanup_old_errors(
    retention_days: Option<i64>,
    state: State<ErrorMonitorState>,
) -> CommandResult<i64> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    let config = match state.config.lock() {
        Ok(config) => config,
        Err(e) => return CommandResult::error(format!("Failed to acquire config lock: {}", e)),
    };

    let days = retention_days.unwrap_or(config.storage_retention_days);

    match db.cleanup_old_errors(days) {
        Ok(count) => CommandResult::success(count),
        Err(e) => CommandResult::error(format!("Failed to cleanup old errors: {}", e)),
    }
}

/// 获取监控配置
#[tauri::command]
pub fn get_error_monitor_config(state: State<ErrorMonitorState>) -> CommandResult<ErrorMonitorConfig> {
    let config = match state.config.lock() {
        Ok(config) => config,
        Err(e) => return CommandResult::error(format!("Failed to acquire config lock: {}", e)),
    };

    CommandResult::success(config.clone())
}

/// 更新监控配置
#[tauri::command]
pub fn update_error_monitor_config(
    new_config: ErrorMonitorConfig,
    state: State<ErrorMonitorState>,
) -> CommandResult<()> {
    let mut config = match state.config.lock() {
        Ok(config) => config,
        Err(e) => return CommandResult::error(format!("Failed to acquire config lock: {}", e)),
    };

    *config = new_config;
    CommandResult::success(())
}

/// 记录错误上报
#[tauri::command]
pub fn record_error_report(
    report_id: String,
    error_ids: Vec<String>,
    endpoint: String,
    state: State<ErrorMonitorState>,
) -> CommandResult<()> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    match db.record_error_report(&report_id, &error_ids, &endpoint) {
        Ok(()) => CommandResult::success(()),
        Err(e) => CommandResult::error(format!("Failed to record error report: {}", e)),
    }
}

/// 更新上报状态
#[tauri::command]
pub fn update_report_status(
    report_id: String,
    status: String,
    response_code: Option<i32>,
    response_message: Option<String>,
    state: State<ErrorMonitorState>,
) -> CommandResult<()> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    match db.update_report_status(
        &report_id,
        &status,
        response_code,
        response_message.as_deref(),
    ) {
        Ok(()) => CommandResult::success(()),
        Err(e) => CommandResult::error(format!("Failed to update report status: {}", e)),
    }
}

/// 获取待上报的错误
#[tauri::command]
pub fn get_pending_reports(
    limit: Option<i64>,
    state: State<ErrorMonitorState>,
) -> CommandResult<Vec<(String, Vec<String>)>> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    let limit = limit.unwrap_or(10);

    match db.get_pending_reports(limit) {
        Ok(reports) => CommandResult::success(reports),
        Err(e) => CommandResult::error(format!("Failed to get pending reports: {}", e)),
    }
}

/// 批量解决错误
#[tauri::command]
pub fn batch_resolve_errors(
    error_ids: Vec<String>,
    resolution: String,
    state: State<ErrorMonitorState>,
) -> CommandResult<i64> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    let mut resolved_count = 0;

    for error_id in error_ids {
        if let Ok(()) = db.update_error_status(&error_id, ErrorStatus::Resolved, Some(&resolution)) {
            resolved_count += 1;
        }
    }

    CommandResult::success(resolved_count)
}

/// 获取系统健康状态
#[tauri::command]
pub fn get_system_health(state: State<ErrorMonitorState>) -> CommandResult<SystemHealth> {
    let db = match state.database.lock() {
        Ok(db) => db,
        Err(e) => return CommandResult::error(format!("Failed to acquire database lock: {}", e)),
    };

    // 获取最近1小时的错误统计
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let one_hour_ago = now - 3600;

    let stats = match db.get_statistics() {
        Ok(stats) => stats,
        Err(e) => return CommandResult::error(format!("Failed to get statistics: {}", e)),
    };

    // 计算健康评分
    let health_score = calculate_health_score(&stats);
    let status = if health_score >= 90 {
        "healthy"
    } else if health_score >= 70 {
        "warning"
    } else if health_score >= 50 {
        "degraded"
    } else {
        "unhealthy"
    };

    let health = SystemHealth {
        status: status.to_string(),
        score: health_score,
        total_errors: stats.total_errors,
        new_errors: stats.new_errors,
        critical_errors: stats.by_severity.get("critical").copied().unwrap_or(0),
        last_error_time: stats.hourly_trend.last()
            .map(|h| h.hour.clone())
            .unwrap_or_else(|| "N/A".to_string()),
        recovery_suggestions: generate_recovery_suggestions(&stats),
    };

    CommandResult::success(health)
}

// ================================
// 辅助函数
// ================================

/// 生成错误ID（基于错误特征的哈希）
fn generate_error_id(name: &str, message: &str, component: Option<&str>) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(name.as_bytes());
    hasher.update(message.as_bytes());
    if let Some(comp) = component {
        hasher.update(comp.as_bytes());
    }

    let result = hasher.finalize();
    format!("{:x}", result)[..16].to_string() // 取前16个字符
}

/// 计算系统健康评分
fn calculate_health_score(stats: &ErrorStatistics) -> u8 {
    let mut score: u8 = 100;

    // 基于错误数量扣分
    if stats.total_errors > 1000 {
        score = score.saturating_sub(20);
    } else if stats.total_errors > 500 {
        score = score.saturating_sub(10);
    } else if stats.total_errors > 100 {
        score = score.saturating_sub(5);
    }

    // 基于新错误数量扣分
    if stats.new_errors > 50 {
        score = score.saturating_sub(15);
    } else if stats.new_errors > 20 {
        score = score.saturating_sub(10);
    } else if stats.new_errors > 5 {
        score = score.saturating_sub(5);
    }

    // 基于严重错误数量扣分
    let critical_errors = stats.by_severity.get("critical").copied().unwrap_or(0);
    if critical_errors > 10 {
        score = score.saturating_sub(25);
    } else if critical_errors > 5 {
        score = score.saturating_sub(15);
    } else if critical_errors > 0 {
        score = score.saturating_sub(5);
    }

    // 基于错误趋势扣分
    let recent_trend: i64 = stats.hourly_trend.iter().rev().take(3).map(|h| h.count).sum();
    if recent_trend > 20 {
        score = score.saturating_sub(10);
    } else if recent_trend > 10 {
        score = score.saturating_sub(5);
    }

    score
}

/// 生成恢复建议
fn generate_recovery_suggestions(stats: &ErrorStatistics) -> Vec<String> {
    let mut suggestions = Vec::new();

    if stats.new_errors > 20 {
        suggestions.push("检查最近的代码更改或配置变更".to_string());
    }

    if let Some(critical_count) = stats.by_severity.get("critical") {
        if *critical_count > 0 {
            suggestions.push("立即处理严重错误，可能影响系统稳定性".to_string());
        }
    }

    if let Some(memory_errors) = stats.by_type.get("memory") {
        if *memory_errors > 10 {
            suggestions.push("检查内存使用情况，考虑优化内存管理".to_string());
        }
    }

    if let Some(network_errors) = stats.by_type.get("network") {
        if *network_errors > 10 {
            suggestions.push("检查网络连接和API端点状态".to_string());
        }
    }

    let recent_errors: i64 = stats.hourly_trend.iter().rev().take(2).map(|h| h.count).sum();
    if recent_errors > 15 {
        suggestions.push("错误频率较高，建议启用详细日志记录".to_string());
    }

    if suggestions.is_empty() {
        suggestions.push("系统运行良好，继续保持当前配置".to_string());
    }

    suggestions
}

// ================================
// 辅助结构
// ================================

#[derive(Debug, Serialize)]
pub struct SystemHealth {
    pub status: String,
    pub score: u8,
    pub total_errors: i64,
    pub new_errors: i64,
    pub critical_errors: i64,
    pub last_error_time: String,
    pub recovery_suggestions: Vec<String>,
}

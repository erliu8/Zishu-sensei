//! 性能监控命令模块
//! 
//! 提供完整的性能监控功能，包括：
//! - 性能指标采集和记录
//! - 用户操作追踪
//! - 网络性能监控
//! - 应用性能快照
//! - 性能警告管理
//! - 性能统计和分析

use crate::database::performance::{
    PerformanceAlert, PerformanceDatabase, PerformanceMetric, PerformanceSnapshot,
    PerformanceStats, NetworkMetric, UserOperation,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tracing::{debug, error, info, warn};

// ============================================================================
// 性能监控状态管理
// ============================================================================

/// 性能监控管理器状态
pub struct PerformanceMonitorState {
    /// 数据库实例
    db: Arc<Mutex<PerformanceDatabase>>,
    /// 监控配置
    config: Arc<Mutex<MonitorConfig>>,
    /// 实时性能指标缓存
    metrics_cache: Arc<Mutex<HashMap<String, Vec<f64>>>>,
    /// 当前监控状态
    is_monitoring: Arc<Mutex<bool>>,
}

/// 监控配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    /// 是否启用性能监控
    pub enabled: bool,
    /// 性能指标采集间隔（毫秒）
    pub metrics_interval: u64,
    /// 快照采集间隔（毫秒）
    pub snapshot_interval: u64,
    /// 数据保留天数
    pub retention_days: i32,
    /// 性能阈值配置
    pub thresholds: PerformanceThresholds,
}

/// 性能阈值配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceThresholds {
    /// CPU使用率阈值（百分比）
    pub cpu_usage_warning: f32,
    pub cpu_usage_critical: f32,
    /// 内存使用率阈值（百分比）
    pub memory_usage_warning: f32,
    pub memory_usage_critical: f32,
    /// FPS阈值
    pub fps_warning: f32,
    pub fps_critical: f32,
    /// 渲染时间阈值（毫秒）
    pub render_time_warning: f64,
    pub render_time_critical: f64,
    /// 用户操作响应时间阈值（毫秒）
    pub response_time_warning: i64,
    pub response_time_critical: i64,
    /// 网络请求超时阈值（毫秒）
    pub network_timeout_warning: i64,
    pub network_timeout_critical: i64,
}

impl Default for MonitorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            metrics_interval: 5000,   // 5秒
            snapshot_interval: 30000, // 30秒
            retention_days: 30,
            thresholds: PerformanceThresholds {
                cpu_usage_warning: 70.0,
                cpu_usage_critical: 90.0,
                memory_usage_warning: 80.0,
                memory_usage_critical: 95.0,
                fps_warning: 30.0,
                fps_critical: 15.0,
                render_time_warning: 16.0,
                render_time_critical: 33.0,
                response_time_warning: 500,
                response_time_critical: 2000,
                network_timeout_warning: 5000,
                network_timeout_critical: 15000,
            },
        }
    }
}

impl PerformanceMonitorState {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let db = PerformanceDatabase::new(db_path).map_err(|e| e.to_string())?;
        
        Ok(Self {
            db: Arc::new(Mutex::new(db)),
            config: Arc::new(Mutex::new(MonitorConfig::default())),
            metrics_cache: Arc::new(Mutex::new(HashMap::new())),
            is_monitoring: Arc::new(Mutex::new(false)),
        })
    }
}

// ============================================================================
// 性能指标记录命令
// ============================================================================

/// 记录性能指标
#[tauri::command]
pub async fn record_performance_metric(
    metric_name: String,
    metric_value: f64,
    unit: String,
    category: String,
    component: Option<String>,
    metadata: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<i64, String> {
    let metric = PerformanceMetric {
        id: None,
        metric_name: metric_name.clone(),
        metric_value,
        unit,
        category: category.clone(),
        component,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        metadata: metadata.unwrap_or_default(),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let record_id = db.record_metric(&metric)?;

    // 更新缓存
    {
        let mut cache = state.metrics_cache.lock().map_err(|e| e.to_string())?;
        let cache_key = format!("{}_{}", category, metric_name);
        let values = cache.entry(cache_key).or_insert_with(Vec::new);
        values.push(metric_value);
        
        // 只保留最近100个值
        if values.len() > 100 {
            values.drain(0..20);
        }
    }

    debug!("记录性能指标: {} = {} {}", metric_name, metric_value, metric.unit);
    Ok(record_id)
}

/// 批量记录性能指标
#[tauri::command]
pub async fn record_performance_metrics_batch(
    metrics: Vec<PerformanceMetric>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<i64>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut record_ids = Vec::new();

    for metric in metrics {
        let record_id = db.record_metric(&metric)?;
        record_ids.push(record_id);
    }

    Ok(record_ids)
}

/// 获取性能指标
#[tauri::command]
pub async fn get_performance_metrics(
    category: Option<String>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<PerformanceMetric>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_metrics(
        category.as_deref(),
        start_time,
        end_time,
        limit,
    ).map_err(|e| e.to_string())
}

/// 获取性能指标摘要
#[tauri::command]
pub async fn get_performance_summary(
    category: String,
    time_period: String,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.calculate_stats(&category, &time_period)
        .map_err(|e| e.to_string())
}

// ============================================================================
// 用户操作追踪命令
// ============================================================================

/// 记录用户操作
#[tauri::command]
pub async fn record_user_operation(
    operation_type: String,
    target_element: String,
    start_time: i64,
    end_time: i64,
    success: bool,
    error_message: Option<String>,
    metadata: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<i64, String> {
    let response_time = end_time - start_time;
    
    let operation = UserOperation {
        id: None,
        operation_type: operation_type.clone(),
        target_element: target_element.clone(),
        start_time,
        end_time,
        response_time,
        success,
        error_message,
        metadata: metadata.unwrap_or_default(),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let record_id = db.record_user_operation(&operation)?;

    // 检查响应时间是否超过阈值，生成警告
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let thresholds = &config.thresholds;
    
    if response_time > thresholds.response_time_critical {
        let alert = PerformanceAlert {
            id: None,
            alert_type: "slow_response".to_string(),
            severity: "critical".to_string(),
            message: format!("用户操作响应时间过长: {}ms", response_time),
            threshold: thresholds.response_time_critical as f64,
            actual_value: response_time as f64,
            component: Some(target_element),
            duration: response_time / 1000, // 转换为秒
            resolved: false,
            resolved_at: None,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
            metadata: serde_json::json!({
                "operation_type": operation_type,
                "success": success
            }).to_string(),
        };
        
        db.record_alert(&alert)?;
    } else if response_time > thresholds.response_time_warning {
        let alert = PerformanceAlert {
            id: None,
            alert_type: "slow_response".to_string(),
            severity: "warning".to_string(),
            message: format!("用户操作响应时间较慢: {}ms", response_time),
            threshold: thresholds.response_time_warning as f64,
            actual_value: response_time as f64,
            component: Some(target_element),
            duration: response_time / 1000,
            resolved: false,
            resolved_at: None,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
            metadata: serde_json::json!({
                "operation_type": operation_type,
                "success": success
            }).to_string(),
        };
        
        db.record_alert(&alert)?;
    }

    debug!("记录用户操作: {} -> {} ({}ms)", operation_type, target_element, response_time);
    Ok(record_id)
}

/// 获取用户操作记录
#[tauri::command]
pub async fn get_user_operations(
    operation_type: Option<String>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<UserOperation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_user_operations(
        operation_type.as_deref(),
        start_time,
        end_time,
        limit,
    ).map_err(|e| e.to_string())
}

/// 获取用户操作统计
#[tauri::command]
pub async fn get_user_operation_stats(
    time_period: String,
    state: State<'_, PerformanceMonitorState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let period_seconds = match time_period.as_str() {
        "1h" => 3600,
        "1d" => 86400,
        "1w" => 604800,
        "1m" => 2592000,
        _ => 3600,
    };

    let start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 * 1000 - period_seconds * 1000;

    let operations = db.get_user_operations(None, Some(start_time), None, None)
        .map_err(|e| e.to_string())?;

    let mut stats = HashMap::new();
    
    // 总操作数
    stats.insert("total_operations".to_string(), serde_json::json!(operations.len()));
    
    // 成功率
    let successful = operations.iter().filter(|op| op.success).count();
    let success_rate = if !operations.is_empty() {
        successful as f64 / operations.len() as f64 * 100.0
    } else {
        0.0
    };
    stats.insert("success_rate".to_string(), serde_json::json!(success_rate));
    
    // 平均响应时间
    let total_response_time: i64 = operations.iter().map(|op| op.response_time).sum();
    let avg_response_time = if !operations.is_empty() {
        total_response_time / operations.len() as i64
    } else {
        0
    };
    stats.insert("avg_response_time".to_string(), serde_json::json!(avg_response_time));
    
    // 操作类型分布
    let mut type_counts = HashMap::new();
    for operation in &operations {
        *type_counts.entry(&operation.operation_type).or_insert(0) += 1;
    }
    stats.insert("operation_types".to_string(), serde_json::json!(type_counts));
    
    Ok(stats)
}

// ============================================================================
// 网络性能监控命令
// ============================================================================

/// 记录网络请求性能
#[tauri::command]
pub async fn record_network_metric(
    url: String,
    method: String,
    status_code: Option<i32>,
    request_size: Option<i64>,
    response_size: Option<i64>,
    timing: NetworkTiming,
    error_type: Option<String>,
    error_message: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<i64, String> {
    let total_time = timing.dns_time.unwrap_or(0)
        + timing.connect_time.unwrap_or(0)
        + timing.ssl_time.unwrap_or(0)
        + timing.send_time.unwrap_or(0)
        + timing.wait_time.unwrap_or(0)
        + timing.receive_time.unwrap_or(0);

    let metric = NetworkMetric {
        id: None,
        url: url.clone(),
        method: method.clone(),
        status_code,
        request_size,
        response_size,
        dns_time: timing.dns_time,
        connect_time: timing.connect_time,
        ssl_time: timing.ssl_time,
        send_time: timing.send_time,
        wait_time: timing.wait_time,
        receive_time: timing.receive_time,
        total_time,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        error_type,
        error_message,
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let record_id = db.record_network_metric(&metric)?;

    // 检查网络性能是否异常
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let thresholds = &config.thresholds;
    
    if total_time > thresholds.network_timeout_critical {
        let alert = PerformanceAlert {
            id: None,
            alert_type: "slow_network".to_string(),
            severity: "critical".to_string(),
            message: format!("网络请求超时严重: {}ms", total_time),
            threshold: thresholds.network_timeout_critical as f64,
            actual_value: total_time as f64,
            component: Some(url.clone()),
            duration: total_time / 1000,
            resolved: false,
            resolved_at: None,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
            metadata: serde_json::json!({
                "method": method,
                "status_code": status_code
            }).to_string(),
        };
        
        db.record_alert(&alert)?;
    }

    debug!("记录网络请求: {} {} ({}ms)", method, url, total_time);
    Ok(record_id)
}

/// 网络请求时间细分
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkTiming {
    pub dns_time: Option<i64>,
    pub connect_time: Option<i64>,
    pub ssl_time: Option<i64>,
    pub send_time: Option<i64>,
    pub wait_time: Option<i64>,
    pub receive_time: Option<i64>,
}

/// 获取网络性能指标
#[tauri::command]
pub async fn get_network_metrics(
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<NetworkMetric>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_network_metrics(start_time, end_time, limit)
        .map_err(|e| e.to_string())
}

/// 获取网络性能统计
#[tauri::command]
pub async fn get_network_stats(
    time_period: String,
    state: State<'_, PerformanceMonitorState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let period_seconds = match time_period.as_str() {
        "1h" => 3600,
        "1d" => 86400,
        "1w" => 604800,
        "1m" => 2592000,
        _ => 3600,
    };

    let start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 * 1000 - period_seconds * 1000;

    let metrics = db.get_network_metrics(Some(start_time), None, None)
        .map_err(|e| e.to_string())?;

    let mut stats = HashMap::new();
    
    // 请求总数
    stats.insert("total_requests".to_string(), serde_json::json!(metrics.len()));
    
    // 成功率
    let successful = metrics.iter().filter(|m| {
        m.status_code.map_or(false, |code| code >= 200 && code < 400)
    }).count();
    let success_rate = if !metrics.is_empty() {
        successful as f64 / metrics.len() as f64 * 100.0
    } else {
        0.0
    };
    stats.insert("success_rate".to_string(), serde_json::json!(success_rate));
    
    // 平均响应时间
    let total_time: i64 = metrics.iter().map(|m| m.total_time).sum();
    let avg_response_time = if !metrics.is_empty() {
        total_time / metrics.len() as i64
    } else {
        0
    };
    stats.insert("avg_response_time".to_string(), serde_json::json!(avg_response_time));
    
    // HTTP方法分布
    let mut method_counts = HashMap::new();
    for metric in &metrics {
        *method_counts.entry(&metric.method).or_insert(0) += 1;
    }
    stats.insert("http_methods".to_string(), serde_json::json!(method_counts));
    
    // 状态码分布
    let mut status_counts = HashMap::new();
    for metric in &metrics {
        if let Some(status) = metric.status_code {
            *status_counts.entry(status).or_insert(0) += 1;
        }
    }
    stats.insert("status_codes".to_string(), serde_json::json!(status_counts));
    
    Ok(stats)
}

// ============================================================================
// 性能快照命令
// ============================================================================

/// 记录性能快照
#[tauri::command]
pub async fn record_performance_snapshot(
    cpu_usage: f32,
    memory_usage: f32,
    memory_used_mb: f64,
    memory_total_mb: f64,
    fps: f32,
    render_time: f64,
    active_connections: i32,
    open_files: i32,
    thread_count: i32,
    heap_size: Option<f64>,
    gc_time: Option<f64>,
    app_state: String,
    load_average: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<i64, String> {
    let snapshot = PerformanceSnapshot {
        id: None,
        cpu_usage,
        memory_usage,
        memory_used_mb,
        memory_total_mb,
        fps,
        render_time,
        active_connections,
        open_files,
        thread_count,
        heap_size,
        gc_time,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        app_state,
        load_average,
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let record_id = db.record_snapshot(&snapshot)?;

    // 检查性能指标是否超过阈值
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let thresholds = &config.thresholds;
    
    let mut alerts = Vec::new();
    
    // CPU使用率检查
    if cpu_usage > thresholds.cpu_usage_critical {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "high_cpu".to_string(),
            severity: "critical".to_string(),
            message: format!("CPU使用率过高: {:.1}%", cpu_usage),
            threshold: thresholds.cpu_usage_critical as f64,
            actual_value: cpu_usage as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    } else if cpu_usage > thresholds.cpu_usage_warning {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "high_cpu".to_string(),
            severity: "warning".to_string(),
            message: format!("CPU使用率较高: {:.1}%", cpu_usage),
            threshold: thresholds.cpu_usage_warning as f64,
            actual_value: cpu_usage as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    }
    
    // 内存使用率检查
    if memory_usage > thresholds.memory_usage_critical {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "high_memory".to_string(),
            severity: "critical".to_string(),
            message: format!("内存使用率过高: {:.1}%", memory_usage),
            threshold: thresholds.memory_usage_critical as f64,
            actual_value: memory_usage as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    } else if memory_usage > thresholds.memory_usage_warning {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "high_memory".to_string(),
            severity: "warning".to_string(),
            message: format!("内存使用率较高: {:.1}%", memory_usage),
            threshold: thresholds.memory_usage_warning as f64,
            actual_value: memory_usage as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    }
    
    // FPS检查
    if fps < thresholds.fps_critical {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "low_fps".to_string(),
            severity: "critical".to_string(),
            message: format!("帧率过低: {:.1} FPS", fps),
            threshold: thresholds.fps_critical as f64,
            actual_value: fps as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    } else if fps < thresholds.fps_warning {
        alerts.push(PerformanceAlert {
            id: None,
            alert_type: "low_fps".to_string(),
            severity: "warning".to_string(),
            message: format!("帧率较低: {:.1} FPS", fps),
            threshold: thresholds.fps_warning as f64,
            actual_value: fps as f64,
            component: None,
            duration: 0,
            resolved: false,
            resolved_at: None,
            timestamp: snapshot.timestamp,
            metadata: "{}".to_string(),
        });
    }
    
    // 记录警告
    for alert in alerts {
        db.record_alert(&alert)?;
    }

    debug!("记录性能快照: CPU {:.1}%, 内存 {:.1}%, FPS {:.1}", 
           cpu_usage, memory_usage, fps);
    Ok(record_id)
}

/// 获取性能快照
#[tauri::command]
pub async fn get_performance_snapshots(
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<PerformanceSnapshot>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_snapshots(start_time, end_time, limit)
        .map_err(|e| e.to_string())
}

// ============================================================================
// 性能警告管理命令
// ============================================================================

/// 获取性能警告
#[tauri::command]
pub async fn get_performance_alerts(
    resolved: Option<bool>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<PerformanceAlert>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_alerts(resolved, start_time, end_time, limit)
        .map_err(|e| e.to_string())
}

/// 标记警告为已解决
#[tauri::command]
pub async fn resolve_performance_alert(
    alert_id: i64,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.resolve_alert(alert_id).map_err(|e| e.to_string())
}

/// 获取警告统计
#[tauri::command]
pub async fn get_alert_stats(
    time_period: String,
    state: State<'_, PerformanceMonitorState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let period_seconds = match time_period.as_str() {
        "1h" => 3600,
        "1d" => 86400,
        "1w" => 604800,
        "1m" => 2592000,
        _ => 3600,
    };

    let start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 * 1000 - period_seconds * 1000;

    let alerts = db.get_alerts(None, Some(start_time), None, None)
        .map_err(|e| e.to_string())?;

    let mut stats = HashMap::new();
    
    // 总警告数
    stats.insert("total_alerts".to_string(), serde_json::json!(alerts.len()));
    
    // 未解决的警告数
    let unresolved = alerts.iter().filter(|a| !a.resolved).count();
    stats.insert("unresolved_alerts".to_string(), serde_json::json!(unresolved));
    
    // 按严重程度分类
    let mut severity_counts = HashMap::new();
    for alert in &alerts {
        *severity_counts.entry(&alert.severity).or_insert(0) += 1;
    }
    stats.insert("severity_distribution".to_string(), serde_json::json!(severity_counts));
    
    // 按类型分类
    let mut type_counts = HashMap::new();
    for alert in &alerts {
        *type_counts.entry(&alert.alert_type).or_insert(0) += 1;
    }
    stats.insert("type_distribution".to_string(), serde_json::json!(type_counts));
    
    Ok(stats)
}

// ============================================================================
// 监控配置管理命令
// ============================================================================

/// 获取监控配置
#[tauri::command]
pub async fn get_monitor_config(
    state: State<'_, PerformanceMonitorState>,
) -> Result<MonitorConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

/// 更新监控配置
#[tauri::command]
pub async fn update_monitor_config(
    config: MonitorConfig,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let mut current_config = state.config.lock().map_err(|e| e.to_string())?;
    *current_config = config;
    info!("监控配置已更新");
    Ok(())
}

/// 开始监控
#[tauri::command]
pub async fn start_performance_monitoring(
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let mut is_monitoring = state.is_monitoring.lock().map_err(|e| e.to_string())?;
    *is_monitoring = true;
    info!("性能监控已启动");
    Ok(())
}

/// 停止监控
#[tauri::command]
pub async fn stop_performance_monitoring(
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let mut is_monitoring = state.is_monitoring.lock().map_err(|e| e.to_string())?;
    *is_monitoring = false;
    info!("性能监控已停止");
    Ok(())
}

/// 检查监控状态
#[tauri::command]
pub async fn is_monitoring_active(
    state: State<'_, PerformanceMonitorState>,
) -> Result<bool, String> {
    let is_monitoring = state.is_monitoring.lock().map_err(|e| e.to_string())?;
    Ok(*is_monitoring)
}

/// 清理旧的性能数据
#[tauri::command]
pub async fn cleanup_performance_data(
    days: i32,
    state: State<'_, PerformanceMonitorState>,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.cleanup_old_data(days).map_err(|e| e.to_string())
}

/// 获取监控状态信息
#[tauri::command]
pub async fn get_monitoring_status(
    state: State<'_, PerformanceMonitorState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let is_monitoring = state.is_monitoring.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let cache = state.metrics_cache.lock().map_err(|e| e.to_string())?;
    
    let mut status = HashMap::new();
    
    status.insert("is_monitoring".to_string(), serde_json::json!(*is_monitoring));
    status.insert("config".to_string(), serde_json::to_value(&*config).unwrap());
    status.insert("cached_metrics_count".to_string(), serde_json::json!(cache.len()));
    
    // 获取最近的缓存指标摘要
    let mut recent_metrics = HashMap::new();
    for (key, values) in cache.iter() {
        if !values.is_empty() {
            let avg = values.iter().sum::<f64>() / values.len() as f64;
            let min = values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
            let max = values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
            
            recent_metrics.insert(key.clone(), serde_json::json!({
                "count": values.len(),
                "average": avg,
                "min": min,
                "max": max,
                "latest": values.last().unwrap_or(&0.0)
            }));
        }
    }
    status.insert("recent_metrics".to_string(), serde_json::json!(recent_metrics));
    
    Ok(status)
}

/// 生成性能报告
#[tauri::command]
pub async fn generate_performance_report(
    time_period: String,
    include_details: bool,
    state: State<'_, PerformanceMonitorState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let period_seconds = match time_period.as_str() {
        "1h" => 3600,
        "1d" => 86400,
        "1w" => 604800,
        "1m" => 2592000,
        _ => 3600,
    };

    let start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 * 1000 - period_seconds * 1000;

    let mut report = HashMap::new();
    
    // 基本信息
    report.insert("report_time".to_string(), serde_json::json!(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
    ));
    report.insert("time_period".to_string(), serde_json::json!(time_period));
    report.insert("start_time".to_string(), serde_json::json!(start_time));
    
    // 性能指标摘要
    let categories = ["cpu", "memory", "render", "network", "user"];
    let mut metrics_summary = HashMap::new();
    
    for category in &categories {
        match db.calculate_stats(category, &time_period) {
            Ok(stats) => {
                metrics_summary.insert(category.to_string(), serde_json::json!(stats));
            }
            Err(e) => {
                warn!("计算性能统计失败 {}: {}", category, e);
            }
        }
    }
    report.insert("metrics_summary".to_string(), serde_json::json!(metrics_summary));
    
    // 警告统计
    let alerts = db.get_alerts(None, Some(start_time), None, None)
        .map_err(|e| e.to_string())?;
    
    let mut alert_summary = HashMap::new();
    alert_summary.insert("total_alerts", serde_json::json!(alerts.len()));
    alert_summary.insert("unresolved_alerts", serde_json::json!(
        alerts.iter().filter(|a| !a.resolved).count()
    ));
    
    let mut severity_counts = HashMap::new();
    let mut type_counts = HashMap::new();
    for alert in &alerts {
        *severity_counts.entry(&alert.severity).or_insert(0) += 1;
        *type_counts.entry(&alert.alert_type).or_insert(0) += 1;
    }
    alert_summary.insert("severity_distribution", serde_json::json!(severity_counts));
    alert_summary.insert("type_distribution", serde_json::json!(type_counts));
    
    report.insert("alert_summary".to_string(), serde_json::json!(alert_summary));
    
    // 如果需要详细信息，包含原始数据
    if include_details {
        let snapshots = db.get_snapshots(Some(start_time), None, Some(100))
            .map_err(|e| e.to_string())?;
        report.insert("snapshots".to_string(), serde_json::json!(snapshots));
        
        let operations = db.get_user_operations(None, Some(start_time), None, Some(100))
            .map_err(|e| e.to_string())?;
        report.insert("user_operations".to_string(), serde_json::json!(operations));
        
        let networks = db.get_network_metrics(Some(start_time), None, Some(100))
            .map_err(|e| e.to_string())?;
        report.insert("network_metrics".to_string(), serde_json::json!(networks));
    }
    
    info!("生成性能报告完成，时间段: {}", time_period);
    Ok(report)
}

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
use tauri::{Manager, State};
use tracing::{debug, info};

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
        use std::path::Path;
        let db = PerformanceDatabase::new(Path::new(db_path)).map_err(|e| e.to_string())?;
        
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
        value: metric_value,
        metric_value,
        unit: unit.clone(),
        category: category.clone(),
        component: component.unwrap_or_default(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        metadata: Some(metadata.unwrap_or_default()),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.record_metric(&metric).map_err(|e| e.to_string())?;

    debug!("记录性能指标: {} = {} {}", metric_name, metric_value, unit);
    Ok(0)
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
    let metric_name = category.as_deref().unwrap_or("");
    let limit_value = limit.unwrap_or(100);
    db.get_metrics(metric_name, limit_value).map_err(|e| e.to_string())
}

/// 获取监控配置
#[tauri::command]
pub async fn get_monitor_config(
    state: State<'_, PerformanceMonitorState>,
) -> Result<MonitorConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
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

// ============================================================================
// 批量记录和高级功能命令
// ============================================================================

/// 批量记录性能指标
#[tauri::command]
pub async fn record_performance_metrics_batch(
    metrics: Vec<PerformanceMetric>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for metric in metrics {
        let _ = db.record_metric(&metric);
    }
    debug!("批量记录了性能指标");
    Ok(())
}

/// 获取性能摘要
#[tauri::command]
pub async fn get_performance_summary(
    _start_time: Option<i64>,
    _end_time: Option<i64>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}

/// 记录用户操作
#[tauri::command]
pub async fn record_user_operation(
    operation_type: String,
    duration_ms: i64,
    component: Option<String>,
    metadata: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let operation = UserOperation {
        id: 0, // Will be set by database
        user_id: "default_user".to_string(),
        operation: operation_type.clone(),
        operation_type: operation_type.clone(),
        target_element: component.unwrap_or_default(),
        start_time: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
        end_time: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64 + duration_ms,
        duration_ms,
        response_time: duration_ms as f64,
        success: true,
        error_message: None,
        metadata: Some(metadata.unwrap_or_default()),
        timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
    };
    
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.record_user_operation(&operation).map_err(|e| e.to_string())?;
    debug!("记录用户操作: {}", operation_type);
    Ok(())
}

/// 获取用户操作记录
#[tauri::command]
pub async fn get_user_operations(
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<UserOperation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_user_operations(None, start_time, end_time, limit).map_err(|e| e.to_string())
}

/// 获取用户操作统计
#[tauri::command]
pub async fn get_user_operation_stats(
    _operation_type: Option<String>,
    _start_time: Option<i64>,
    _end_time: Option<i64>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}

/// 记录网络指标
#[tauri::command]
pub async fn record_network_metric(
    url: String,
    method: String,
    duration_ms: i64,
    status_code: i32,
    bytes_sent: i64,
    bytes_received: i64,
    timing: Option<NetworkTiming>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let metric = NetworkMetric {
        id: None,
        timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
        bytes_sent,
        bytes_received,
        packets_sent: 0,
        packets_received: 0,
        method: method.clone(),
        url: url.clone(),
        status_code,
        request_size: bytes_sent,
        response_size: bytes_received,
        total_time: duration_ms as f64,
        dns_time: timing.as_ref().and_then(|t| t.dns_time).unwrap_or(0) as f64,
        connect_time: timing.as_ref().and_then(|t| t.connect_time).unwrap_or(0) as f64,
        ssl_time: timing.as_ref().and_then(|t| t.ssl_time).unwrap_or(0) as f64,
        send_time: timing.as_ref().and_then(|t| t.send_time).unwrap_or(0) as f64,
        wait_time: timing.as_ref().and_then(|t| t.wait_time).unwrap_or(0) as f64,
        receive_time: timing.as_ref().and_then(|t| t.receive_time).unwrap_or(0) as f64,
        error_message: None,
        error_type: None,
    };
    
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.record_network_metric(&metric).map_err(|e| e.to_string())?;
    debug!("记录网络指标: {} {}", method, url);
    Ok(())
}

/// 获取网络指标
#[tauri::command]
pub async fn get_network_metrics(
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<NetworkMetric>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_network_metrics(start_time, end_time, limit).map_err(|e| e.to_string())
}

/// 获取网络统计
#[tauri::command]
pub async fn get_network_stats(
    _start_time: Option<i64>,
    _end_time: Option<i64>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}

/// 记录性能快照
#[tauri::command]
pub async fn record_performance_snapshot(
    cpu_usage: f32,
    memory_usage: f32,
    fps: f32,
    render_time: f64,
    metadata: Option<String>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let snapshot = PerformanceSnapshot {
        id: None,
        timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
        cpu_usage: cpu_usage as f64,
        memory_usage: memory_usage as f64,
        memory_used_mb: 0.0,
        memory_total_mb: 0.0,
        disk_usage: 0.0,
        network_in: 0.0,
        network_out: 0.0,
        load_average: 0.0,
        thread_count: 0,
        open_files: 0,
        render_time,
        fps: fps as f64,
        heap_size: 0.0,
        gc_time: 0.0,
        app_state: "active".to_string(),
        active_connections: 0,
    };
    
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.record_snapshot(&snapshot).map_err(|e| e.to_string())?;
    debug!("记录性能快照");
    Ok(())
}

/// 获取性能快照
#[tauri::command]
pub async fn get_performance_snapshots(
    start_time: Option<i64>,
    end_time: Option<i64>,
    _limit: Option<usize>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<PerformanceSnapshot>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let start = start_time.unwrap_or(0);
    let end = end_time.unwrap_or(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64);
    db.get_snapshots(start, end).map_err(|e| e.to_string())
}

/// 获取性能警告
#[tauri::command]
pub async fn get_performance_alerts(
    _start_time: Option<i64>,
    _end_time: Option<i64>,
    _resolved: Option<bool>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<Vec<PerformanceAlert>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_alerts().map_err(|e| e.to_string())
}

/// 解决性能警告
#[tauri::command]
pub async fn resolve_performance_alert(
    alert_id: i64,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.resolve_alert(alert_id).map_err(|e| e.to_string())?;
    debug!("解决性能警告: {}", alert_id);
    Ok(())
}

/// 获取警告统计
#[tauri::command]
pub async fn get_alert_stats(
    _start_time: Option<i64>,
    _end_time: Option<i64>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}

/// 更新监控配置
#[tauri::command]
pub async fn update_monitor_config(
    config: MonitorConfig,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let mut current_config = state.config.lock().map_err(|e| e.to_string())?;
    *current_config = config;
    debug!("更新监控配置");
    Ok(())
}

/// 清理性能数据
#[tauri::command]
pub async fn cleanup_performance_data(
    older_than_days: i32,
    state: State<'_, PerformanceMonitorState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.cleanup_old_data(older_than_days as i64).map_err(|e| e.to_string())?;
    debug!("清理{}天前的性能数据", older_than_days);
    Ok(())
}

/// 获取监控状态
#[tauri::command]
pub async fn get_monitoring_status(
    state: State<'_, PerformanceMonitorState>,
) -> Result<MonitoringStatus, String> {
    let is_monitoring = state.is_monitoring.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    
    Ok(MonitoringStatus {
        is_active: *is_monitoring,
        config: config.clone(),
        uptime_seconds: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
    })
}

/// 生成性能报告
#[tauri::command]
pub async fn generate_performance_report(
    start_time: Option<i64>,
    end_time: Option<i64>,
    state: State<'_, PerformanceMonitorState>,
) -> Result<PerformanceReport, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let stats = db.get_stats().map_err(|e| e.to_string())?;
    let alerts = db.get_alerts().map_err(|e| e.to_string())?;
    
    let start = start_time.unwrap_or(0);
    let end = end_time.unwrap_or(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64);
    
    Ok(PerformanceReport {
        start_time: start,
        end_time: end,
        metrics_count: stats.total_requests as usize,
        avg_cpu_usage: 0.0,
        avg_memory_usage: 0.0,
        avg_fps: 0.0,
        network_requests: stats.total_requests as usize,
        alerts_count: alerts.len(),
        summary: format!("Performance report from {} to {}", start, end),
    })
}

// ============================================================================
// 附加数据结构
// ============================================================================

/// 监控状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringStatus {
    pub is_active: bool,
    pub config: MonitorConfig,
    pub uptime_seconds: u64,
}

/// 性能报告
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReport {
    pub start_time: i64,
    pub end_time: i64,
    pub metrics_count: usize,
    pub avg_cpu_usage: f32,
    pub avg_memory_usage: f32,
    pub avg_fps: f32,
    pub network_requests: usize,
    pub alerts_count: usize,
    pub summary: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    // 简化的超时保护辅助函数
    async fn with_timeout_guard<F, R>(future: F) -> Result<R, String>
    where
        F: std::future::Future<Output = Result<R, String>>,
    {
        timeout(Duration::from_millis(200), future)
            .await
            .map_err(|_| "测试超时".to_string())?
    }

    // 创建测试用的性能监控状态（使用内存数据库）
    async fn create_test_performance_state() -> Result<PerformanceMonitorState, String> {
        PerformanceMonitorState::new(":memory:")
    }

    #[test]
    fn test_monitor_config_default_values() {
        // Arrange & Act
        let config = MonitorConfig::default();

        // Assert
        assert!(config.enabled, "默认应该启用监控");
        assert_eq!(config.metrics_interval, 5000, "默认指标间隔应为5秒");
        assert_eq!(config.snapshot_interval, 30000, "默认快照间隔应为30秒");
        assert_eq!(config.retention_days, 30, "默认保留天数应为30天");
        assert!(config.thresholds.cpu_usage_warning > 0.0, "CPU警告阈值应大于0");
        assert!(config.thresholds.memory_usage_warning > 0.0, "内存警告阈值应大于0");
    }

    #[test]
    fn test_network_timing_structure() {
        // Arrange & Act
        let timing = NetworkTiming {
            dns_time: Some(10),
            connect_time: Some(20),
            ssl_time: Some(30),
            send_time: Some(5),
            wait_time: Some(100),
            receive_time: Some(15),
        };
        
        // Assert
        assert_eq!(timing.dns_time, Some(10), "DNS时间应正确设置");
        assert_eq!(timing.connect_time, Some(20), "连接时间应正确设置");
        assert_eq!(timing.ssl_time, Some(30), "SSL时间应正确设置");
        assert_eq!(timing.send_time, Some(5), "发送时间应正确设置");
        assert_eq!(timing.wait_time, Some(100), "等待时间应正确设置");
        assert_eq!(timing.receive_time, Some(15), "接收时间应正确设置");
    }

    #[tokio::test]
    async fn test_performance_state_creation() {
        // Arrange & Act
        let result = create_test_performance_state().await;

        // Assert
        assert!(result.is_ok(), "性能监控状态应该能够创建");
        
        if let Ok(state) = result {
            // 测试基本锁获取
            assert!(state.config.try_lock().is_ok(), "应该能够获取配置锁");
            assert!(state.is_monitoring.try_lock().is_ok(), "应该能够获取监控状态锁");
        }
    }

    #[tokio::test]
    async fn test_performance_direct_operations() {
        // Arrange
        let state = create_test_performance_state().await.unwrap();
        
        // Act & Assert - 直接测试性能监控操作
        
        // 测试配置访问
        let config = state.config.lock();
        assert!(config.is_ok(), "应该能够获取配置锁");
        
        if let Ok(cfg) = config {
            assert!(cfg.enabled, "默认应该启用监控");
            assert!(cfg.metrics_interval > 0, "指标间隔应该大于0");
        }
        
        // 测试监控状态
        let monitoring = state.is_monitoring.lock();
        assert!(monitoring.is_ok(), "应该能够获取监控状态锁");
        
        if let Ok(mut mon) = monitoring {
            let original = *mon;
            *mon = !original;
            assert_eq!(*mon, !original, "监控状态应该能够修改");
        }
    }
}
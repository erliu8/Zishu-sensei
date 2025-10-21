// 隐私管理命令接口
use crate::database::privacy::{PrivacyDatabase, PrivacySettings};
use crate::utils::anonymizer::{
    AnonymizationOptions, Anonymizer, AnonymousStatistics, UsageStatistics,
};
use crate::utils::data_cleanup::{CleanupResult, CleanupType, DataCleanupManager};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

/// 隐私管理器状态
pub struct PrivacyState {
    pub db: Arc<Mutex<Connection>>,
    pub privacy_db: PrivacyDatabase,
    pub anonymizer: Anonymizer,
}

impl PrivacyState {
    pub fn new(db: Arc<Mutex<Connection>>) -> Result<Self, String> {
        let privacy_db = PrivacyDatabase::new(db.clone())
            .map_err(|e| format!("初始化隐私数据库失败: {}", e))?;
        
        let anonymizer = Anonymizer::new();

        Ok(Self {
            db,
            privacy_db,
            anonymizer,
        })
    }
}

/// 获取隐私设置
#[tauri::command]
pub fn get_privacy_settings(state: State<PrivacyState>) -> Result<PrivacySettings, String> {
    state
        .privacy_db
        .get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))
}

/// 更新隐私设置
#[tauri::command]
pub fn update_privacy_settings(
    settings: PrivacySettings,
    state: State<PrivacyState>,
) -> Result<(), String> {
    state
        .privacy_db
        .update_settings(&settings)
        .map_err(|e| format!("更新隐私设置失败: {}", e))
}

/// 启用隐私模式
#[tauri::command]
pub fn enable_privacy_mode(state: State<PrivacyState>) -> Result<(), String> {
    let mut settings = state.privacy_db.get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))?;
    
    settings.privacy_mode_enabled = true;
    settings.save_conversation_history = false;
    settings.save_search_history = false;
    settings.allow_usage_statistics = false;
    settings.telemetry_level = "none".to_string();

    state
        .privacy_db
        .update_settings(&settings)
        .map_err(|e| format!("启用隐私模式失败: {}", e))
}

/// 禁用隐私模式
#[tauri::command]
pub fn disable_privacy_mode(state: State<PrivacyState>) -> Result<(), String> {
    let mut settings = state.privacy_db.get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))?;
    
    settings.privacy_mode_enabled = false;
    settings.save_conversation_history = true;
    settings.save_search_history = true;
    settings.telemetry_level = "basic".to_string();

    state
        .privacy_db
        .update_settings(&settings)
        .map_err(|e| format!("禁用隐私模式失败: {}", e))
}

/// 记录隐私政策同意
#[tauri::command]
pub fn record_privacy_consent(
    policy_version: String,
    consented: bool,
    state: State<PrivacyState>,
) -> Result<i64, String> {
    state
        .privacy_db
        .record_consent(&policy_version, consented)
        .map_err(|e| format!("记录隐私政策同意失败: {}", e))
}

/// 获取最新的隐私政策同意记录
#[tauri::command]
pub fn get_latest_privacy_consent(
    state: State<PrivacyState>,
) -> Result<Option<crate::database::privacy::PrivacyConsent>, String> {
    state
        .privacy_db
        .get_latest_consent()
        .map_err(|e| format!("获取隐私政策同意记录失败: {}", e))
}

/// 检查是否已同意特定版本的隐私政策
#[tauri::command]
pub fn has_consented_to_privacy_policy(
    version: String,
    state: State<PrivacyState>,
) -> Result<bool, String> {
    state
        .privacy_db
        .has_consented_to_version(&version)
        .map_err(|e| format!("检查隐私政策同意失败: {}", e))
}

/// 清除数据
#[tauri::command]
pub fn cleanup_data(
    cleanup_type: String,
    app_handle: AppHandle,
    state: State<PrivacyState>,
) -> Result<CleanupResult, String> {
    let cleanup_manager = DataCleanupManager::new(app_handle, state.db.clone());

    let cleanup_type_enum = match cleanup_type.as_str() {
        "conversations" => CleanupType::Conversations,
        "cache" => CleanupType::Cache,
        "logs" => CleanupType::Logs,
        "search_history" => CleanupType::SearchHistory,
        "clipboard_history" => CleanupType::ClipboardHistory,
        "temp_files" => CleanupType::TempFiles,
        "all" => CleanupType::All,
        _ => return Err(format!("未知的清除类型: {}", cleanup_type)),
    };

    let result = cleanup_manager.cleanup(cleanup_type_enum)?;

    // 记录清除操作
    state
        .privacy_db
        .record_cleanup(
            &cleanup_type,
            result.items_deleted,
            result.space_freed_bytes,
            "user",
        )
        .map_err(|e| format!("记录清除操作失败: {}", e))?;

    Ok(result)
}

/// 清除旧数据
#[tauri::command]
pub fn cleanup_old_data(
    days: i64,
    app_handle: AppHandle,
    state: State<PrivacyState>,
) -> Result<CleanupResult, String> {
    let cleanup_manager = DataCleanupManager::new(app_handle, state.db.clone());
    let result = cleanup_manager.cleanup_old_data(days)?;

    // 记录清除操作
    state
        .privacy_db
        .record_cleanup(
            "old_data",
            result.items_deleted,
            result.space_freed_bytes,
            "auto",
        )
        .map_err(|e| format!("记录清除操作失败: {}", e))?;

    Ok(result)
}

/// 获取数据使用统计
#[tauri::command]
pub fn get_data_usage_stats(
    app_handle: AppHandle,
    state: State<PrivacyState>,
) -> Result<serde_json::Value, String> {
    let cleanup_manager = DataCleanupManager::new(app_handle, state.db.clone());
    cleanup_manager.get_data_usage_stats()
}

/// 获取清除历史记录
#[tauri::command]
pub fn get_cleanup_history(
    limit: i64,
    state: State<PrivacyState>,
) -> Result<Vec<crate::database::privacy::DataCleanupRecord>, String> {
    state
        .privacy_db
        .get_cleanup_history(limit)
        .map_err(|e| format!("获取清除历史失败: {}", e))
}

/// 获取清除统计
#[tauri::command]
pub fn get_cleanup_stats(state: State<PrivacyState>) -> Result<serde_json::Value, String> {
    state
        .privacy_db
        .get_cleanup_stats()
        .map_err(|e| format!("获取清除统计失败: {}", e))
}

/// 匿名化使用统计
#[tauri::command]
pub fn anonymize_usage_statistics(
    statistics: UsageStatistics,
    options: Option<AnonymizationOptions>,
    state: State<PrivacyState>,
) -> Result<AnonymousStatistics, String> {
    let options = options.unwrap_or_default();
    Ok(state.anonymizer.anonymize_statistics(statistics, &options))
}

/// 匿名化 IP 地址
#[tauri::command]
pub fn anonymize_ip_address(ip: String, state: State<PrivacyState>) -> Result<String, String> {
    Ok(state.anonymizer.anonymize_ip(&ip))
}

/// 生成匿名设备 ID
#[tauri::command]
pub fn generate_anonymous_device_id(
    device_info: String,
    state: State<PrivacyState>,
) -> Result<String, String> {
    Ok(state.anonymizer.generate_anonymous_device_id(&device_info))
}

/// 检查文本是否包含敏感信息
#[tauri::command]
pub fn contains_sensitive_data(text: String, state: State<PrivacyState>) -> Result<bool, String> {
    Ok(state.anonymizer.contains_sensitive_data(&text))
}

/// 脱敏敏感文本
#[tauri::command]
pub fn redact_sensitive_text(text: String, state: State<PrivacyState>) -> Result<String, String> {
    Ok(state.anonymizer.redact_sensitive_text(&text))
}

/// 自动清除过期数据（后台任务）
#[tauri::command]
pub fn auto_cleanup_expired_data(
    app_handle: AppHandle,
    state: State<PrivacyState>,
) -> Result<CleanupResult, String> {
    let settings = state.privacy_db.get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))?;

    let cleanup_manager = DataCleanupManager::new(app_handle, state.db.clone());
    let mut total_result = CleanupResult {
        cleanup_type: "auto".to_string(),
        items_deleted: 0,
        space_freed_bytes: 0,
        errors: Vec::new(),
    };

    // 自动清除缓存
    if settings.auto_clear_cache_days > 0 {
        if let Ok(result) = cleanup_manager.cleanup(CleanupType::Cache) {
            total_result.items_deleted += result.items_deleted;
            total_result.space_freed_bytes += result.space_freed_bytes;
            total_result.errors.extend(result.errors);
        }
    }

    // 自动清除旧日志
    if settings.auto_clear_logs_days > 0 {
        if let Ok(result) = cleanup_manager.cleanup_old_data(settings.auto_clear_logs_days as i64) {
            total_result.items_deleted += result.items_deleted;
            total_result.space_freed_bytes += result.space_freed_bytes;
            total_result.errors.extend(result.errors);
        }
    }

    // 记录清除操作
    if total_result.items_deleted > 0 {
        state
            .privacy_db
            .record_cleanup(
                "auto",
                total_result.items_deleted,
                total_result.space_freed_bytes,
                "auto",
            )
            .map_err(|e| format!("记录清除操作失败: {}", e))?;
    }

    Ok(total_result)
}

/// 导出隐私设置
#[tauri::command]
pub fn export_privacy_settings(state: State<PrivacyState>) -> Result<String, String> {
    let settings = state.privacy_db.get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))?;
    
    serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))
}

/// 导入隐私设置
#[tauri::command]
pub fn import_privacy_settings(
    settings_json: String,
    state: State<PrivacyState>,
) -> Result<(), String> {
    let settings: PrivacySettings = serde_json::from_str(&settings_json)
        .map_err(|e| format!("解析设置失败: {}", e))?;
    
    state
        .privacy_db
        .update_settings(&settings)
        .map_err(|e| format!("导入设置失败: {}", e))
}

/// 获取隐私报告
#[tauri::command]
pub fn get_privacy_report(
    app_handle: AppHandle,
    state: State<PrivacyState>,
) -> Result<serde_json::Value, String> {
    let settings = state.privacy_db.get_or_create_settings()
        .map_err(|e| format!("获取隐私设置失败: {}", e))?;
    
    let cleanup_manager = DataCleanupManager::new(app_handle, state.db.clone());
    let data_usage = cleanup_manager.get_data_usage_stats()?;
    let cleanup_stats = state.privacy_db.get_cleanup_stats()
        .map_err(|e| format!("获取清除统计失败: {}", e))?;
    
    let latest_consent = state.privacy_db.get_latest_consent()
        .map_err(|e| format!("获取隐私政策同意记录失败: {}", e))?;

    Ok(serde_json::json!({
        "settings": settings,
        "data_usage": data_usage,
        "cleanup_stats": cleanup_stats,
        "latest_consent": latest_consent,
        "generated_at": chrono::Utc::now().timestamp(),
    }))
}


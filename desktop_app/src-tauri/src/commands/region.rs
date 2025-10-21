use tauri::{command, State};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::{DateTime, Utc, NaiveDateTime};

use crate::database::region::{RegionDatabase, RegionPreferences, RegionConfig, build_default_region_configs};
use crate::utils::region_detector::{RegionDetector, SystemRegionInfo};
use crate::utils::region_formatter::{RegionFormatter, FormatOptions, FormattedValue, 
    NumberFormatStyle, DateFormatStyle, TimeFormatStyle, TemperatureUnit, DistanceUnit, WeightUnit, CurrencyPosition};

/// 区域适配状态管理
pub struct RegionState {
    pub current_preferences: Mutex<Option<RegionPreferences>>,
    pub formatter: Mutex<Option<RegionFormatter>>,
}

impl Default for RegionState {
    fn default() -> Self {
        Self {
            current_preferences: Mutex::new(None),
            formatter: Mutex::new(None),
        }
    }
}

/// 错误类型
#[derive(Debug, Serialize)]
pub struct RegionError {
    pub message: String,
    pub code: String,
}

impl From<String> for RegionError {
    fn from(message: String) -> Self {
        Self {
            message,
            code: "REGION_ERROR".to_string(),
        }
    }
}

impl From<rusqlite::Error> for RegionError {
    fn from(error: rusqlite::Error) -> Self {
        Self {
            message: format!("Database error: {}", error),
            code: "DATABASE_ERROR".to_string(),
        }
    }
}

/// 检测系统区域设置
#[command]
pub async fn detect_system_region() -> Result<SystemRegionInfo, RegionError> {
    let region_info = RegionDetector::detect_system_region();
    Ok(region_info)
}

/// 获取推荐的区域设置列表
#[command]
pub async fn get_recommended_regions(current_locale: Option<String>) -> Result<Vec<String>, RegionError> {
    let current = if let Some(locale) = current_locale {
        SystemRegionInfo {
            locale,
            language: String::new(),
            country: String::new(),
            timezone: String::new(),
            currency: String::new(),
            confidence: 1.0,
        }
    } else {
        RegionDetector::detect_system_region()
    };

    let recommendations = RegionDetector::get_recommended_regions(&current);
    Ok(recommendations)
}

/// 获取用户区域偏好设置
#[command]
pub async fn get_user_region_preferences(
    db: State<'_, crate::database::Database>,
    user_id: Option<String>,
) -> Result<RegionPreferences, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let preferences = RegionDatabase::get_user_preferences(&conn, user_id.as_deref())?;
    Ok(preferences)
}

/// 保存用户区域偏好设置
#[command]
pub async fn save_user_region_preferences(
    db: State<'_, crate::database::Database>,
    region_state: State<'_, RegionState>,
    preferences: RegionPreferences,
) -> Result<i64, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let id = RegionDatabase::save_user_preferences(&conn, &preferences)?;
    
    // 更新状态
    *region_state.current_preferences.lock().unwrap() = Some(preferences.clone());
    
    // 创建新的格式化器
    let format_options = FormatOptions {
        locale: preferences.locale.clone(),
        timezone: preferences.timezone.clone(),
        currency: preferences.currency.clone(),
        number_format: NumberFormatStyle {
            decimal_separator: if preferences.locale.starts_with("de") || preferences.locale.starts_with("fr") {
                ",".to_string()
            } else {
                ".".to_string()
            },
            thousands_separator: if preferences.locale.starts_with("de") {
                ".".to_string()
            } else if preferences.locale.starts_with("fr") {
                " ".to_string()
            } else {
                ",".to_string()
            },
            currency_symbol: get_currency_symbol(&preferences.currency),
            currency_position: if preferences.locale.starts_with("de") || preferences.locale.starts_with("fr") {
                CurrencyPosition::AfterWithSpace
            } else {
                CurrencyPosition::Before
            },
            negative_sign: "-".to_string(),
            positive_sign: None,
        },
        date_format: parse_date_format(&preferences.date_format),
        time_format: parse_time_format(&preferences.time_format),
        temperature_unit: parse_temperature_unit(&preferences.temperature_unit),
        distance_unit: parse_distance_unit(&preferences.distance_unit),
        weight_unit: parse_weight_unit(&preferences.weight_unit),
    };
    
    let formatter = RegionFormatter::new(format_options);
    *region_state.formatter.lock().unwrap() = Some(formatter);
    
    Ok(id)
}

/// 删除用户区域偏好设置
#[command]
pub async fn delete_user_region_preferences(
    db: State<'_, crate::database::Database>,
    region_state: State<'_, RegionState>,
    user_id: Option<String>,
) -> Result<usize, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let count = RegionDatabase::delete_user_preferences(&conn, user_id.as_deref())?;
    
    // 清理状态
    *region_state.current_preferences.lock().unwrap() = None;
    *region_state.formatter.lock().unwrap() = None;
    
    Ok(count)
}

/// 获取所有支持的区域配置
#[command]
pub async fn get_all_region_configs(
    db: State<'_, crate::database::Database>,
) -> Result<Vec<RegionConfig>, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let mut configs = RegionDatabase::get_all_region_configs(&conn)?;
    
    // 如果数据库中没有配置，初始化默认配置
    if configs.is_empty() {
        let default_configs = build_default_region_configs();
        for config in &default_configs {
            if let Err(e) = RegionDatabase::cache_region_config(&conn, config) {
                eprintln!("Failed to cache region config for {}: {}", config.locale, e);
            }
        }
        configs = default_configs;
    }
    
    Ok(configs)
}

/// 获取特定区域配置
#[command]
pub async fn get_region_config(
    db: State<'_, crate::database::Database>,
    locale: String,
) -> Result<Option<RegionConfig>, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let config = RegionDatabase::get_region_config(&conn, &locale)?;
    Ok(config)
}

/// 缓存区域配置
#[command]
pub async fn cache_region_config(
    db: State<'_, crate::database::Database>,
    config: RegionConfig,
) -> Result<(), RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    RegionDatabase::cache_region_config(&conn, &config)?;
    Ok(())
}

/// 初始化区域适配系统
#[command]
pub async fn initialize_region_system(
    db: State<'_, crate::database::Database>,
    region_state: State<'_, RegionState>,
    user_id: Option<String>,
) -> Result<RegionPreferences, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    
    // 初始化数据库表
    RegionDatabase::init(&conn)?;
    
    // 初始化默认区域配置
    let default_configs = build_default_region_configs();
    for config in &default_configs {
        let _ = RegionDatabase::cache_region_config(&conn, config);
    }
    
    // 获取或创建用户偏好
    let mut preferences = RegionDatabase::get_user_preferences(&conn, user_id.as_deref())?;
    
    // 如果是新用户，检测系统区域并保存
    if preferences.id.is_none() {
        let system_region = RegionDetector::detect_system_region();
        if system_region.confidence > 0.7 {
            preferences.locale = system_region.locale;
            preferences.timezone = system_region.timezone;
            preferences.currency = system_region.currency;
        }
        preferences.user_id = user_id.clone();
        let _ = RegionDatabase::save_user_preferences(&conn, &preferences);
    }
    
    // 更新状态
    *region_state.current_preferences.lock().unwrap() = Some(preferences.clone());
    
    Ok(preferences)
}

/// 格式化日期时间
#[command]
pub async fn format_datetime(
    region_state: State<'_, RegionState>,
    timestamp: i64, // Unix 时间戳（秒）
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let datetime = DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| RegionError::from("Invalid timestamp".to_string()))?;
    
    formatter.format_datetime(&datetime)
        .map_err(|e| RegionError::from(e))
}

/// 格式化日期
#[command]
pub async fn format_date(
    region_state: State<'_, RegionState>,
    timestamp: i64, // Unix 时间戳（秒）
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let datetime = DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| RegionError::from("Invalid timestamp".to_string()))?;
    
    let naive_datetime = datetime.naive_utc();
    Ok(formatter.format_date(&naive_datetime))
}

/// 格式化时间
#[command]
pub async fn format_time(
    region_state: State<'_, RegionState>,
    timestamp: i64, // Unix 时间戳（秒）
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let datetime = DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| RegionError::from("Invalid timestamp".to_string()))?;
    
    let naive_datetime = datetime.naive_utc();
    Ok(formatter.format_time(&naive_datetime))
}

/// 格式化数字
#[command]
pub async fn format_number(
    region_state: State<'_, RegionState>,
    number: f64,
    decimal_places: Option<usize>,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_number(number, decimal_places))
}

/// 格式化货币
#[command]
pub async fn format_currency(
    region_state: State<'_, RegionState>,
    amount: f64,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_currency(amount))
}

/// 格式化温度
#[command]
pub async fn format_temperature(
    region_state: State<'_, RegionState>,
    celsius: f64,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_temperature(celsius))
}

/// 格式化距离
#[command]
pub async fn format_distance(
    region_state: State<'_, RegionState>,
    meters: f64,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_distance(meters))
}

/// 格式化重量
#[command]
pub async fn format_weight(
    region_state: State<'_, RegionState>,
    grams: f64,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_weight(grams))
}

/// 格式化文件大小
#[command]
pub async fn format_file_size(
    region_state: State<'_, RegionState>,
    bytes: u64,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_file_size(bytes))
}

/// 格式化百分比
#[command]
pub async fn format_percentage(
    region_state: State<'_, RegionState>,
    ratio: f64,
    decimal_places: Option<usize>,
) -> Result<FormattedValue, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    Ok(formatter.format_percentage(ratio, decimal_places))
}

/// 转换温度单位
#[command]
pub async fn convert_temperature(
    region_state: State<'_, RegionState>,
    value: f64,
    from_unit: String,
    to_unit: String,
) -> Result<f64, RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let from = parse_temperature_unit(&from_unit);
    let to = parse_temperature_unit(&to_unit);
    
    Ok(formatter.convert_temperature(value, &from, &to))
}

/// 转换距离单位
#[command]
pub async fn convert_distance(
    region_state: State<'_, RegionState>,
    meters: f64,
    to_unit: String,
) -> Result<(f64, String), RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let to = parse_distance_unit(&to_unit);
    let (value, unit) = formatter.convert_distance(meters, &to);
    
    Ok((value, unit.to_string()))
}

/// 转换重量单位
#[command]
pub async fn convert_weight(
    region_state: State<'_, RegionState>,
    grams: f64,
    to_unit: String,
) -> Result<(f64, String), RegionError> {
    let formatter_guard = region_state.formatter.lock().unwrap();
    let formatter = formatter_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let to = parse_weight_unit(&to_unit);
    let (value, unit) = formatter.convert_weight(grams, &to);
    
    Ok((value, unit.to_string()))
}

/// 清理过期的区域配置缓存
#[command]
pub async fn cleanup_expired_region_cache(
    db: State<'_, crate::database::Database>,
    days: i32,
) -> Result<usize, RegionError> {
    let conn = db.get_pool().get()
        .map_err(|e| RegionError {
            message: format!("Database error: {}", e),
            code: "DATABASE_ERROR".to_string(),
        })?;
    let count = RegionDatabase::cleanup_expired_cache(&conn, days)?;
    Ok(count)
}

/// 获取区域格式化统计信息
#[command]
pub async fn get_region_format_stats(
    region_state: State<'_, RegionState>,
) -> Result<HashMap<String, String>, RegionError> {
    let preferences_guard = region_state.current_preferences.lock().unwrap();
    let preferences = preferences_guard.as_ref().ok_or_else(|| {
        RegionError::from("Region system not initialized".to_string())
    })?;
    
    let mut stats = HashMap::new();
    stats.insert("locale".to_string(), preferences.locale.clone());
    stats.insert("timezone".to_string(), preferences.timezone.clone());
    stats.insert("currency".to_string(), preferences.currency.clone());
    stats.insert("date_format".to_string(), preferences.date_format.clone());
    stats.insert("time_format".to_string(), preferences.time_format.clone());
    stats.insert("temperature_unit".to_string(), preferences.temperature_unit.clone());
    stats.insert("distance_unit".to_string(), preferences.distance_unit.clone());
    stats.insert("weight_unit".to_string(), preferences.weight_unit.clone());
    
    Ok(stats)
}

// 辅助函数
fn get_currency_symbol(currency: &str) -> String {
    match currency {
        "CNY" => "¥".to_string(),
        "USD" => "$".to_string(),
        "EUR" => "€".to_string(),
        "GBP" => "£".to_string(),
        "JPY" => "¥".to_string(),
        "KRW" => "₩".to_string(),
        "TWD" => "NT$".to_string(),
        "HKD" => "HK$".to_string(),
        "CAD" => "C$".to_string(),
        "AUD" => "A$".to_string(),
        "CHF" => "CHF".to_string(),
        _ => currency.to_string(),
    }
}

fn parse_date_format(format: &str) -> DateFormatStyle {
    match format {
        "YYYY-MM-DD" => DateFormatStyle::ISO,
        "MM/DD/YYYY" => DateFormatStyle::US,
        "DD/MM/YYYY" => DateFormatStyle::EU,
        "YYYY年MM月DD日" => DateFormatStyle::Chinese,
        "YYYY년 MM월 DD일" => DateFormatStyle::Korean,
        "DD.MM.YYYY" => DateFormatStyle::German,
        _ => DateFormatStyle::Custom(format.to_string()),
    }
}

fn parse_time_format(format: &str) -> TimeFormatStyle {
    match format {
        "24h" => TimeFormatStyle::H24,
        "12h" => TimeFormatStyle::H12,
        _ => TimeFormatStyle::H24,
    }
}

fn parse_temperature_unit(unit: &str) -> TemperatureUnit {
    match unit.to_lowercase().as_str() {
        "celsius" | "c" => TemperatureUnit::Celsius,
        "fahrenheit" | "f" => TemperatureUnit::Fahrenheit,
        "kelvin" | "k" => TemperatureUnit::Kelvin,
        _ => TemperatureUnit::Celsius,
    }
}

fn parse_distance_unit(unit: &str) -> DistanceUnit {
    match unit.to_lowercase().as_str() {
        "metric" => DistanceUnit::Metric,
        "imperial" => DistanceUnit::Imperial,
        "mixed" => DistanceUnit::Mixed,
        _ => DistanceUnit::Metric,
    }
}

fn parse_weight_unit(unit: &str) -> WeightUnit {
    match unit.to_lowercase().as_str() {
        "metric" => WeightUnit::Metric,
        "imperial" => WeightUnit::Imperial,
        "mixed" => WeightUnit::Mixed,
        _ => WeightUnit::Metric,
    }
}


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

impl From<Box<dyn std::error::Error + Send + Sync>> for RegionError {
    fn from(err: Box<dyn std::error::Error + Send + Sync>) -> Self {
        Self {
            message: err.to_string(),
            code: "REGION_ERROR".to_string(),
        }
    }
}

// Using PostgreSQL for database operations
impl From<Box<dyn std::error::Error>> for RegionError {
    fn from(error: Box<dyn std::error::Error>) -> Self {
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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
    let conn = db.get_pool().get().await
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::region::{RegionPreferences, RegionConfig};
    use crate::utils::region_formatter::{FormatOptions, RegionFormatter, 
        NumberFormatStyle, DateFormatStyle, TimeFormatStyle, 
        TemperatureUnit, DistanceUnit, WeightUnit, CurrencyPosition};
    use std::sync::Mutex;
    use std::collections::HashMap;
    use tokio;

    /// 创建测试用的RegionState，避免死锁
    fn create_test_region_state() -> RegionState {
        let preferences = RegionPreferences {
            id: Some(1),
            user_id: Some("test_user".to_string()),
            language: "en".to_string(),
            locale: "en-US".to_string(),
            timezone: "UTC".to_string(),
            currency: "USD".to_string(),
            date_format: "MM/DD/YYYY".to_string(),
            time_format: "12h".to_string(),
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "metric".to_string(),
        };
        
        let format_options = FormatOptions {
            locale: preferences.locale.clone(),
            timezone: preferences.timezone.clone(),
            currency: preferences.currency.clone(),
            number_format: NumberFormatStyle {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "$".to_string(),
                currency_position: CurrencyPosition::Before,
                negative_sign: "-".to_string(),
                positive_sign: None,
            },
            date_format: DateFormatStyle::US,
            time_format: TimeFormatStyle::H12,
            temperature_unit: TemperatureUnit::Celsius,
            distance_unit: DistanceUnit::Metric,
            weight_unit: WeightUnit::Metric,
        };
        
        let formatter = RegionFormatter::new(format_options);
        
        RegionState {
            current_preferences: Mutex::new(Some(preferences)),
            formatter: Mutex::new(Some(formatter)),
        }
    }

    /// 创建测试用的RegionState，避免死锁
    fn create_empty_region_state() -> RegionState {
        RegionState {
            current_preferences: Mutex::new(None),
            formatter: Mutex::new(None),
        }
    }

    #[test]
    fn test_region_state_default() {
        // Arrange & Act
        let state = RegionState::default();
        
        // Assert
        let preferences_guard = state.current_preferences.lock().unwrap();
        let formatter_guard = state.formatter.lock().unwrap();
        assert!(preferences_guard.is_none());
        assert!(formatter_guard.is_none());
    }

    #[test]
    fn test_region_error_from_string() {
        // Arrange
        let error_message = "Test error message".to_string();
        
        // Act
        let region_error = RegionError::from(error_message.clone());
        
        // Assert
        assert_eq!(region_error.message, error_message);
        assert_eq!(region_error.code, "REGION_ERROR");
    }

    #[tokio::test]
    async fn test_detect_system_region_success() {
        // Arrange & Act
        let result = detect_system_region().await;
        
        // Assert
        assert!(result.is_ok());
        let system_info = result.unwrap();
        assert!(!system_info.locale.is_empty());
        assert!(system_info.confidence >= 0.0 && system_info.confidence <= 1.0);
    }

    #[tokio::test]
    async fn test_get_recommended_regions_with_locale() {
        // Arrange
        let current_locale = Some("en-US".to_string());
        
        // Act
        let result = get_recommended_regions(current_locale).await;
        
        // Assert
        assert!(result.is_ok());
        let recommendations = result.unwrap();
        assert!(!recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_get_recommended_regions_without_locale() {
        // Arrange
        let current_locale = None;
        
        // Act
        let result = get_recommended_regions(current_locale).await;
        
        // Assert
        assert!(result.is_ok());
        let recommendations = result.unwrap();
        assert!(!recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_format_number_success() {
        // Arrange
        let state = create_test_region_state();
        let number = 1234.56;
        let decimal_places = Some(2);
        
        // Act
        let result = format_number(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            number,
            decimal_places,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_currency_success() {
        // Arrange
        let state = create_test_region_state();
        let amount = 1234.56;
        
        // Act
        let result = format_currency(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            amount,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_temperature_success() {
        // Arrange
        let state = create_test_region_state();
        let celsius = 25.0;
        
        // Act
        let result = format_temperature(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            celsius,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_distance_success() {
        // Arrange
        let state = create_test_region_state();
        let meters = 1000.0;
        
        // Act
        let result = format_distance(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            meters,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_weight_success() {
        // Arrange
        let state = create_test_region_state();
        let grams = 1000.0;
        
        // Act
        let result = format_weight(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            grams,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_file_size_success() {
        // Arrange
        let state = create_test_region_state();
        let bytes = 1024u64;
        
        // Act
        let result = format_file_size(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            bytes,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_percentage_success() {
        // Arrange
        let state = create_test_region_state();
        let ratio = 0.85;
        let decimal_places = Some(1);
        
        // Act
        let result = format_percentage(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            ratio,
            decimal_places,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_convert_temperature_success() {
        // Arrange
        let state = create_test_region_state();
        let value = 25.0;
        let from_unit = "celsius".to_string();
        let to_unit = "fahrenheit".to_string();
        
        // Act
        let result = convert_temperature(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            value,
            from_unit,
            to_unit,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let converted = result.unwrap();
        assert!(converted > 70.0); // 25°C ≈ 77°F
    }

    #[tokio::test]
    async fn test_convert_distance_success() {
        // Arrange
        let state = create_test_region_state();
        let meters = 1000.0;
        let to_unit = "imperial".to_string();
        
        // Act
        let result = convert_distance(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            meters,
            to_unit,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let (value, unit) = result.unwrap();
        assert!(value > 0.0);
        assert!(!unit.is_empty());
    }

    #[tokio::test]
    async fn test_convert_weight_success() {
        // Arrange
        let state = create_test_region_state();
        let grams = 1000.0;
        let to_unit = "imperial".to_string();
        
        // Act
        let result = convert_weight(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            grams,
            to_unit,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let (value, unit) = result.unwrap();
        assert!(value > 0.0);
        assert!(!unit.is_empty());
    }

    #[tokio::test]
    async fn test_get_region_format_stats_success() {
        // Arrange
        let state = create_test_region_state();
        
        // Act
        let result = get_region_format_stats(
            unsafe { std::mem::transmute(&state as *const RegionState) }
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert!(stats.contains_key("locale"));
        assert!(stats.contains_key("timezone"));
        assert!(stats.contains_key("currency"));
        assert_eq!(stats.get("locale").unwrap(), "en-US");
    }

    // 错误条件测试
    #[tokio::test]
    async fn test_format_number_without_initialization() {
        // Arrange
        let state = create_empty_region_state();
        let number = 123.45;
        
        // Act
        let result = format_number(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            number,
            None,
        ).await;
        
        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("not initialized"));
    }

    #[tokio::test]
    async fn test_format_datetime_with_invalid_timestamp() {
        // Arrange
        let state = create_test_region_state();
        // 使用一个真正无效的时间戳（超出i64范围或导致DateTime::from_timestamp返回None的值）
        let invalid_timestamp = i64::MAX;
        
        // Act
        let result = format_datetime(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            invalid_timestamp,
        ).await;
        
        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Invalid timestamp"));
    }

    #[tokio::test]
    async fn test_format_datetime_success() {
        // Arrange
        let state = create_test_region_state();
        let timestamp = 1635724800i64; // 2021-11-01 12:00:00 UTC
        
        // Act
        let result = format_datetime(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            timestamp,
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_get_region_format_stats_without_initialization() {
        // Arrange
        let state = create_empty_region_state();
        
        // Act
        let result = get_region_format_stats(
            unsafe { std::mem::transmute(&state as *const RegionState) }
        ).await;
        
        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("not initialized"));
    }

    // 辅助函数测试
    #[test]
    fn test_get_currency_symbol() {
        // Test various currencies
        assert_eq!(get_currency_symbol("CNY"), "¥");
        assert_eq!(get_currency_symbol("USD"), "$");
        assert_eq!(get_currency_symbol("EUR"), "€");
        assert_eq!(get_currency_symbol("GBP"), "£");
        assert_eq!(get_currency_symbol("UNKNOWN"), "UNKNOWN");
    }

    #[test]
    fn test_parse_date_format() {
        // Test various date formats
        assert!(matches!(parse_date_format("YYYY-MM-DD"), DateFormatStyle::ISO));
        assert!(matches!(parse_date_format("MM/DD/YYYY"), DateFormatStyle::US));
        assert!(matches!(parse_date_format("DD/MM/YYYY"), DateFormatStyle::EU));
        assert!(matches!(parse_date_format("YYYY年MM月DD日"), DateFormatStyle::Chinese));
        assert!(matches!(parse_date_format("CUSTOM"), DateFormatStyle::Custom(_)));
    }

    #[test]
    fn test_parse_time_format() {
        // Test time formats
        assert!(matches!(parse_time_format("24h"), TimeFormatStyle::H24));
        assert!(matches!(parse_time_format("12h"), TimeFormatStyle::H12));
        assert!(matches!(parse_time_format("invalid"), TimeFormatStyle::H24)); // default
    }

    #[test]
    fn test_parse_temperature_unit() {
        // Test temperature units
        assert!(matches!(parse_temperature_unit("celsius"), TemperatureUnit::Celsius));
        assert!(matches!(parse_temperature_unit("C"), TemperatureUnit::Celsius));
        assert!(matches!(parse_temperature_unit("fahrenheit"), TemperatureUnit::Fahrenheit));
        assert!(matches!(parse_temperature_unit("F"), TemperatureUnit::Fahrenheit));
        assert!(matches!(parse_temperature_unit("kelvin"), TemperatureUnit::Kelvin));
        assert!(matches!(parse_temperature_unit("invalid"), TemperatureUnit::Celsius)); // default
    }

    #[test]
    fn test_parse_distance_unit() {
        // Test distance units
        assert!(matches!(parse_distance_unit("metric"), DistanceUnit::Metric));
        assert!(matches!(parse_distance_unit("imperial"), DistanceUnit::Imperial));
        assert!(matches!(parse_distance_unit("mixed"), DistanceUnit::Mixed));
        assert!(matches!(parse_distance_unit("invalid"), DistanceUnit::Metric)); // default
    }

    #[test]
    fn test_parse_weight_unit() {
        // Test weight units
        assert!(matches!(parse_weight_unit("metric"), WeightUnit::Metric));
        assert!(matches!(parse_weight_unit("imperial"), WeightUnit::Imperial));
        assert!(matches!(parse_weight_unit("mixed"), WeightUnit::Mixed));
        assert!(matches!(parse_weight_unit("invalid"), WeightUnit::Metric)); // default
    }

    // 边界条件测试
    #[tokio::test]
    async fn test_format_number_with_zero() {
        // Arrange
        let state = create_test_region_state();
        let number = 0.0;
        
        // Act
        let result = format_number(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            number,
            Some(2),
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_format_number_with_negative() {
        // Arrange
        let state = create_test_region_state();
        let number = -123.45;
        
        // Act
        let result = format_number(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            number,
            Some(2),
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let formatted = result.unwrap();
        assert!(!formatted.value.is_empty());
    }

    #[tokio::test]
    async fn test_convert_temperature_celsius_to_fahrenheit() {
        // Arrange
        let state = create_test_region_state();
        
        // Act
        let result = convert_temperature(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            0.0,  // 0°C
            "celsius".to_string(),
            "fahrenheit".to_string(),
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let converted = result.unwrap();
        assert!((converted - 32.0).abs() < 0.01); // 0°C = 32°F
    }

    #[tokio::test]
    async fn test_convert_temperature_same_unit() {
        // Arrange
        let state = create_test_region_state();
        let temp = 25.0;
        
        // Act
        let result = convert_temperature(
            unsafe { std::mem::transmute(&state as *const RegionState) },
            temp,
            "celsius".to_string(),
            "celsius".to_string(),
        ).await;
        
        // Assert
        assert!(result.is_ok());
        let converted = result.unwrap();
        assert!((converted - temp).abs() < 0.01);
    }
}


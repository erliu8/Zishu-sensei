use rusqlite::{params, Connection, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 用户区域偏好设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionPreferences {
    pub id: Option<i64>,
    pub user_id: Option<String>,
    pub locale: String,              // 区域代码，如 "zh-CN", "en-US", "ja-JP"
    pub timezone: String,            // 时区，如 "Asia/Shanghai", "America/New_York"
    pub currency: String,            // 货币代码，如 "CNY", "USD", "JPY"
    pub number_format: String,       // 数字格式，如 "1,234.56", "1 234,56"
    pub date_format: String,         // 日期格式，如 "YYYY-MM-DD", "MM/DD/YYYY"
    pub time_format: String,         // 时间格式，如 "24h", "12h"
    pub temperature_unit: String,    // 温度单位，如 "celsius", "fahrenheit"
    pub distance_unit: String,       // 距离单位，如 "metric", "imperial"
    pub weight_unit: String,         // 重量单位，如 "kg", "lb"
    pub first_day_of_week: i32,     // 每周第一天，0=Sunday, 1=Monday
    pub rtl_support: bool,           // 是否支持从右到左的文字方向
    pub created_at: String,
    pub updated_at: String,
}

/// 区域配置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionConfig {
    pub locale: String,
    pub name: String,
    pub native_name: String,
    pub language_code: String,
    pub country_code: String,
    pub currency: String,
    pub timezone: Vec<String>,
    pub number_format: NumberFormat,
    pub date_formats: Vec<String>,
    pub temperature_unit: String,
    pub distance_unit: String,
    pub weight_unit: String,
    pub first_day_of_week: i32,
    pub rtl: bool,
}

/// 数字格式配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberFormat {
    pub decimal_separator: String,
    pub thousands_separator: String,
    pub currency_symbol: String,
    pub currency_position: String, // "before" | "after"
}

/// 格式化选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatOptions {
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub show_currency_symbol: bool,
    pub use_24h_format: bool,
    pub use_metric: bool,
}

impl RegionPreferences {
    /// 创建默认区域偏好
    pub fn default() -> Self {
        Self {
            id: None,
            user_id: None,
            locale: "zh-CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            number_format: "1,234.56".to_string(),
            date_format: "YYYY-MM-DD".to_string(),
            time_format: "24h".to_string(),
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 1, // Monday
            rtl_support: false,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// 从数据库行创建
    pub fn from_row(row: &Row) -> SqliteResult<Self> {
        Ok(Self {
            id: Some(row.get(0)?),
            user_id: row.get(1)?,
            locale: row.get(2)?,
            timezone: row.get(3)?,
            currency: row.get(4)?,
            number_format: row.get(5)?,
            date_format: row.get(6)?,
            time_format: row.get(7)?,
            temperature_unit: row.get(8)?,
            distance_unit: row.get(9)?,
            weight_unit: row.get(10)?,
            first_day_of_week: row.get(11)?,
            rtl_support: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    }
}

/// 区域数据库管理器
pub struct RegionDatabase;

impl RegionDatabase {
    /// 初始化区域数据库表
    pub fn init(conn: &Connection) -> SqliteResult<()> {
        // 创建用户区域偏好表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS region_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                locale TEXT NOT NULL DEFAULT 'zh-CN',
                timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
                currency TEXT NOT NULL DEFAULT 'CNY',
                number_format TEXT NOT NULL DEFAULT '1,234.56',
                date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
                time_format TEXT NOT NULL DEFAULT '24h',
                temperature_unit TEXT NOT NULL DEFAULT 'celsius',
                distance_unit TEXT NOT NULL DEFAULT 'metric',
                weight_unit TEXT NOT NULL DEFAULT 'kg',
                first_day_of_week INTEGER NOT NULL DEFAULT 1,
                rtl_support BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 创建区域配置缓存表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS region_configs (
                locale TEXT PRIMARY KEY,
                config_data TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_preferences_user_id ON region_preferences(user_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_preferences_locale ON region_preferences(locale)",
            [],
        )?;

        Ok(())
    }

    /// 获取用户区域偏好
    pub fn get_user_preferences(conn: &Connection, user_id: Option<&str>) -> SqliteResult<RegionPreferences> {
        let query = if let Some(uid) = user_id {
            "SELECT * FROM region_preferences WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1"
        } else {
            "SELECT * FROM region_preferences WHERE user_id IS NULL ORDER BY updated_at DESC LIMIT 1"
        };

        let mut stmt = conn.prepare(query)?;
        let preferences_iter = if let Some(uid) = user_id {
            stmt.query_map(params![uid], RegionPreferences::from_row)?
        } else {
            stmt.query_map([], RegionPreferences::from_row)?
        };

        for preferences in preferences_iter {
            return Ok(preferences?);
        }

        // 如果没有找到，返回默认配置
        Ok(RegionPreferences::default())
    }

    /// 保存用户区域偏好
    pub fn save_user_preferences(conn: &Connection, preferences: &RegionPreferences) -> SqliteResult<i64> {
        let now = chrono::Utc::now().to_rfc3339();
        
        if let Some(id) = preferences.id {
            // 更新现有记录
            conn.execute(
                "UPDATE region_preferences SET 
                 user_id = ?, locale = ?, timezone = ?, currency = ?,
                 number_format = ?, date_format = ?, time_format = ?,
                 temperature_unit = ?, distance_unit = ?, weight_unit = ?,
                 first_day_of_week = ?, rtl_support = ?, updated_at = ?
                 WHERE id = ?",
                params![
                    preferences.user_id,
                    preferences.locale,
                    preferences.timezone,
                    preferences.currency,
                    preferences.number_format,
                    preferences.date_format,
                    preferences.time_format,
                    preferences.temperature_unit,
                    preferences.distance_unit,
                    preferences.weight_unit,
                    preferences.first_day_of_week,
                    preferences.rtl_support,
                    now,
                    id
                ],
            )?;
            Ok(id)
        } else {
            // 插入新记录
            conn.execute(
                "INSERT INTO region_preferences 
                (user_id, locale, timezone, currency, number_format, date_format, time_format,
                 temperature_unit, distance_unit, weight_unit, first_day_of_week, rtl_support, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    preferences.user_id,
                    preferences.locale,
                    preferences.timezone,
                    preferences.currency,
                    preferences.number_format,
                    preferences.date_format,
                    preferences.time_format,
                    preferences.temperature_unit,
                    preferences.distance_unit,
                    preferences.weight_unit,
                    preferences.first_day_of_week,
                    preferences.rtl_support,
                    now,
                    now
                ],
            )?;
            Ok(conn.last_insert_rowid())
        }
    }

    /// 删除用户区域偏好
    pub fn delete_user_preferences(conn: &Connection, user_id: Option<&str>) -> SqliteResult<usize> {
        if let Some(uid) = user_id {
            Ok(conn.execute("DELETE FROM region_preferences WHERE user_id = ?", params![uid])?)
        } else {
            Ok(conn.execute("DELETE FROM region_preferences WHERE user_id IS NULL", [])?)
        }
    }

    /// 获取区域配置缓存
    pub fn get_region_config(conn: &Connection, locale: &str) -> SqliteResult<Option<RegionConfig>> {
        let mut stmt = conn.prepare("SELECT config_data FROM region_configs WHERE locale = ?")?;
        let config_iter = stmt.query_map(params![locale], |row| {
            let config_data: String = row.get(0)?;
            Ok(serde_json::from_str::<RegionConfig>(&config_data).ok())
        })?;

        for config in config_iter {
            if let Some(cfg) = config? {
                return Ok(Some(cfg));
            }
        }

        Ok(None)
    }

    /// 缓存区域配置
    pub fn cache_region_config(conn: &Connection, config: &RegionConfig) -> SqliteResult<()> {
        let config_data = serde_json::to_string(config).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(e))
        })?;
        
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO region_configs (locale, config_data, updated_at)
             VALUES (?, ?, ?)",
            params![config.locale, config_data, now],
        )?;

        Ok(())
    }

    /// 获取所有支持的区域配置
    pub fn get_all_region_configs(conn: &Connection) -> SqliteResult<Vec<RegionConfig>> {
        let mut stmt = conn.prepare("SELECT config_data FROM region_configs ORDER BY locale")?;
        let config_iter = stmt.query_map([], |row| {
            let config_data: String = row.get(0)?;
            Ok(serde_json::from_str::<RegionConfig>(&config_data).ok())
        })?;

        let mut configs = Vec::new();
        for config in config_iter {
            if let Some(cfg) = config? {
                configs.push(cfg);
            }
        }

        Ok(configs)
    }

    /// 清理过期的区域配置缓存
    pub fn cleanup_expired_cache(conn: &Connection, days: i32) -> SqliteResult<usize> {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff.to_rfc3339();

        Ok(conn.execute(
            "DELETE FROM region_configs WHERE updated_at < ?",
            params![cutoff_str],
        )?)
    }
}

/// 构建默认区域配置
pub fn build_default_region_configs() -> Vec<RegionConfig> {
    vec![
        // 中文（简体）
        RegionConfig {
            locale: "zh-CN".to_string(),
            name: "Chinese (Simplified)".to_string(),
            native_name: "中文（简体）".to_string(),
            language_code: "zh".to_string(),
            country_code: "CN".to_string(),
            currency: "CNY".to_string(),
            timezone: vec!["Asia/Shanghai".to_string(), "Asia/Beijing".to_string()],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "¥".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "YYYY-MM-DD".to_string(),
                "YYYY年MM月DD日".to_string(),
                "MM-DD".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 1, // Monday
            rtl: false,
        },
        // 中文（繁体）
        RegionConfig {
            locale: "zh-TW".to_string(),
            name: "Chinese (Traditional)".to_string(),
            native_name: "中文（繁體）".to_string(),
            language_code: "zh".to_string(),
            country_code: "TW".to_string(),
            currency: "TWD".to_string(),
            timezone: vec!["Asia/Taipei".to_string()],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "NT$".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "YYYY-MM-DD".to_string(),
                "YYYY年MM月DD日".to_string(),
                "MM/DD".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 0, // Sunday
            rtl: false,
        },
        // 英语（美国）
        RegionConfig {
            locale: "en-US".to_string(),
            name: "English (United States)".to_string(),
            native_name: "English (United States)".to_string(),
            language_code: "en".to_string(),
            country_code: "US".to_string(),
            currency: "USD".to_string(),
            timezone: vec![
                "America/New_York".to_string(),
                "America/Chicago".to_string(),
                "America/Denver".to_string(),
                "America/Los_Angeles".to_string(),
            ],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "$".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "MM/DD/YYYY".to_string(),
                "MMM DD, YYYY".to_string(),
                "MM-DD".to_string(),
            ],
            temperature_unit: "fahrenheit".to_string(),
            distance_unit: "imperial".to_string(),
            weight_unit: "lb".to_string(),
            first_day_of_week: 0, // Sunday
            rtl: false,
        },
        // 英语（英国）
        RegionConfig {
            locale: "en-GB".to_string(),
            name: "English (United Kingdom)".to_string(),
            native_name: "English (United Kingdom)".to_string(),
            language_code: "en".to_string(),
            country_code: "GB".to_string(),
            currency: "GBP".to_string(),
            timezone: vec!["Europe/London".to_string()],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "£".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "DD/MM/YYYY".to_string(),
                "DD MMM YYYY".to_string(),
                "DD-MM".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 1, // Monday
            rtl: false,
        },
        // 日语（日本）
        RegionConfig {
            locale: "ja-JP".to_string(),
            name: "Japanese (Japan)".to_string(),
            native_name: "日本語（日本）".to_string(),
            language_code: "ja".to_string(),
            country_code: "JP".to_string(),
            currency: "JPY".to_string(),
            timezone: vec!["Asia/Tokyo".to_string()],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "¥".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "YYYY-MM-DD".to_string(),
                "YYYY年MM月DD日".to_string(),
                "MM月DD日".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 0, // Sunday
            rtl: false,
        },
        // 韩语（韩国）
        RegionConfig {
            locale: "ko-KR".to_string(),
            name: "Korean (South Korea)".to_string(),
            native_name: "한국어（대한민국）".to_string(),
            language_code: "ko".to_string(),
            country_code: "KR".to_string(),
            currency: "KRW".to_string(),
            timezone: vec!["Asia/Seoul".to_string()],
            number_format: NumberFormat {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "₩".to_string(),
                currency_position: "before".to_string(),
            },
            date_formats: vec![
                "YYYY-MM-DD".to_string(),
                "YYYY년 MM월 DD일".to_string(),
                "MM월 DD일".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 0, // Sunday
            rtl: false,
        },
        // 德语（德国）
        RegionConfig {
            locale: "de-DE".to_string(),
            name: "German (Germany)".to_string(),
            native_name: "Deutsch (Deutschland)".to_string(),
            language_code: "de".to_string(),
            country_code: "DE".to_string(),
            currency: "EUR".to_string(),
            timezone: vec!["Europe/Berlin".to_string()],
            number_format: NumberFormat {
                decimal_separator: ",".to_string(),
                thousands_separator: ".".to_string(),
                currency_symbol: "€".to_string(),
                currency_position: "after".to_string(),
            },
            date_formats: vec![
                "DD.MM.YYYY".to_string(),
                "DD. MMM YYYY".to_string(),
                "DD.MM".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 1, // Monday
            rtl: false,
        },
        // 法语（法国）
        RegionConfig {
            locale: "fr-FR".to_string(),
            name: "French (France)".to_string(),
            native_name: "Français (France)".to_string(),
            language_code: "fr".to_string(),
            country_code: "FR".to_string(),
            currency: "EUR".to_string(),
            timezone: vec!["Europe/Paris".to_string()],
            number_format: NumberFormat {
                decimal_separator: ",".to_string(),
                thousands_separator: " ".to_string(),
                currency_symbol: "€".to_string(),
                currency_position: "after".to_string(),
            },
            date_formats: vec![
                "DD/MM/YYYY".to_string(),
                "DD MMM YYYY".to_string(),
                "DD/MM".to_string(),
            ],
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "kg".to_string(),
            first_day_of_week: 1, // Monday
            rtl: false,
        },
    ]
}


//! 区域设置数据库模块 (PostgreSQL完整实现)
//! 管理用户区域和本地化设置

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tokio_postgres::Row;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionSettings {
    pub language: String,
    pub timezone: String,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionPreferences {
    pub id: Option<i64>,
    pub user_id: Option<String>,
    pub language: String,
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub date_format: String,
    pub time_format: String,
    pub temperature_unit: String,
    pub distance_unit: String,
    pub weight_unit: String,
}

impl Default for RegionPreferences {
    fn default() -> Self {
        Self {
            id: None,
            user_id: None,
            language: "en".to_string(),
            locale: "en-US".to_string(),
            timezone: "UTC".to_string(),
            currency: "USD".to_string(),
            date_format: "YYYY-MM-DD".to_string(),
            time_format: "24h".to_string(),
            temperature_unit: "celsius".to_string(),
            distance_unit: "metric".to_string(),
            weight_unit: "metric".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionConfig {
    pub code: String,
    pub name: String,
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub language: String,
}

/// 区域注册表（用于高层API）
pub struct RegionRegistry {
    pool: DbPool,
}

impl RegionRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;

        // 创建区域偏好设置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS region_preferences (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT UNIQUE,
                language TEXT NOT NULL DEFAULT 'en',
                locale TEXT NOT NULL DEFAULT 'en-US',
                timezone TEXT NOT NULL DEFAULT 'UTC',
                currency TEXT NOT NULL DEFAULT 'USD',
                date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
                time_format TEXT NOT NULL DEFAULT '24h',
                temperature_unit TEXT NOT NULL DEFAULT 'celsius',
                distance_unit TEXT NOT NULL DEFAULT 'metric',
                weight_unit TEXT NOT NULL DEFAULT 'metric',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建区域配置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS region_configs (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                locale TEXT NOT NULL,
                timezone TEXT NOT NULL,
                currency TEXT NOT NULL,
                language TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建区域缓存表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS region_cache (
                locale TEXT PRIMARY KEY,
                config_data JSONB NOT NULL,
                cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            )",
            &[],
        ).await?;

        // 创建索引
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_preferences_user_id ON region_preferences(user_id)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_preferences_locale ON region_preferences(locale)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_configs_locale ON region_configs(locale)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_region_cache_expires_at ON region_cache(expires_at)",
            &[],
        ).await;

        tracing::info!("Region tables initialized successfully");
        Ok(())
    }

    /// 获取区域设置（同步接口）
    pub fn get_settings(&self) -> Result<RegionSettings, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_settings_async().await
        })
    }

    async fn get_settings_async(&self) -> Result<RegionSettings, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        // 获取默认用户的设置（user_id为NULL）
        let row = conn.query_opt(
            "SELECT language, timezone, currency FROM region_preferences WHERE user_id IS NULL LIMIT 1",
            &[],
        ).await?;

        if let Some(row) = row {
            Ok(RegionSettings {
                language: row.get(0),
                timezone: row.get(1),
                currency: row.get(2),
            })
        } else {
            // 返回默认值
            Ok(RegionSettings {
                language: "zh-CN".to_string(),
                timezone: "Asia/Shanghai".to_string(),
                currency: "CNY".to_string(),
            })
        }
    }

    /// 更新区域设置（同步接口）
    pub fn update_settings(&self, settings: RegionSettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.update_settings_async(settings).await
        })
    }

    async fn update_settings_async(&self, settings: RegionSettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        conn.execute(
            "INSERT INTO region_preferences (user_id, language, timezone, currency, locale, updated_at)
             VALUES (NULL, $1, $2, $3, $1, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
                language = EXCLUDED.language,
                timezone = EXCLUDED.timezone,
                currency = EXCLUDED.currency,
                locale = EXCLUDED.locale,
                updated_at = NOW()",
            &[&settings.language, &settings.timezone, &settings.currency],
        ).await?;

        tracing::info!("Region settings updated: {:?}", settings);
        Ok(())
    }

    /// 获取用户偏好设置
    pub fn get_user_preferences(&self, user_id: Option<&str>) -> Result<RegionPreferences, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_user_preferences_async(user_id).await
        })
    }

    async fn get_user_preferences_async(&self, user_id: Option<&str>) -> Result<RegionPreferences, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_opt(
            "SELECT id, user_id, language, locale, timezone, currency, date_format, 
                    time_format, temperature_unit, distance_unit, weight_unit
             FROM region_preferences 
             WHERE user_id = $1 OR (user_id IS NULL AND $1 IS NULL)
             LIMIT 1",
            &[&user_id],
        ).await?;

        if let Some(row) = row {
            Ok(row_to_preferences(&row))
        } else {
            Ok(RegionPreferences::default())
        }
    }

    /// 保存用户偏好设置
    pub fn save_user_preferences(&self, preferences: &RegionPreferences) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.save_user_preferences_async(preferences).await
        })
    }

    async fn save_user_preferences_async(&self, preferences: &RegionPreferences) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_one(
            "INSERT INTO region_preferences 
             (user_id, language, locale, timezone, currency, date_format, time_format,
              temperature_unit, distance_unit, weight_unit, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
                language = EXCLUDED.language,
                locale = EXCLUDED.locale,
                timezone = EXCLUDED.timezone,
                currency = EXCLUDED.currency,
                date_format = EXCLUDED.date_format,
                time_format = EXCLUDED.time_format,
                temperature_unit = EXCLUDED.temperature_unit,
                distance_unit = EXCLUDED.distance_unit,
                weight_unit = EXCLUDED.weight_unit,
                updated_at = NOW()
             RETURNING id",
            &[
                &preferences.user_id,
                &preferences.language,
                &preferences.locale,
                &preferences.timezone,
                &preferences.currency,
                &preferences.date_format,
                &preferences.time_format,
                &preferences.temperature_unit,
                &preferences.distance_unit,
                &preferences.weight_unit,
            ],
        ).await?;

        let id: i64 = row.get(0);
        tracing::info!("Region preferences saved: id={}, user_id={:?}", id, preferences.user_id);
        Ok(id)
    }

    /// 删除用户偏好设置
    pub fn delete_user_preferences(&self, user_id: &str) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.delete_user_preferences_async(user_id).await
        })
    }

    async fn delete_user_preferences_async(&self, user_id: &str) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let count = conn.execute(
            "DELETE FROM region_preferences WHERE user_id = $1",
            &[&user_id],
        ).await?;

        tracing::info!("Deleted {} region preferences for user_id={}", count, user_id);
        Ok(count as usize)
    }

    /// 获取所有区域配置
    pub fn get_all_region_configs(&self) -> Result<Vec<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_all_region_configs_async().await
        })
    }

    async fn get_all_region_configs_async(&self) -> Result<Vec<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let rows = conn.query(
            "SELECT code, name, locale, timezone, currency, language
             FROM region_configs
             WHERE is_active = true
             ORDER BY name",
            &[],
        ).await?;

        Ok(rows.iter().map(row_to_config).collect())
    }

    /// 获取特定区域配置
    pub fn get_region_config(&self, code: &str) -> Result<Option<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_region_config_async(code).await
        })
    }

    async fn get_region_config_async(&self, code: &str) -> Result<Option<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_opt(
            "SELECT code, name, locale, timezone, currency, language
             FROM region_configs
             WHERE code = $1",
            &[&code],
        ).await?;

        Ok(row.map(|r| row_to_config(&r)))
    }

    /// 缓存区域配置
    pub fn cache_region_config(&self, config: &RegionConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.cache_region_config_async(config).await
        })
    }

    async fn cache_region_config_async(&self, config: &RegionConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        // 先保存到配置表
        conn.execute(
            "INSERT INTO region_configs (code, name, locale, timezone, currency, language)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                locale = EXCLUDED.locale,
                timezone = EXCLUDED.timezone,
                currency = EXCLUDED.currency,
                language = EXCLUDED.language",
            &[
                &config.code,
                &config.name,
                &config.locale,
                &config.timezone,
                &config.currency,
                &config.language,
            ],
        ).await?;

        // 然后缓存配置数据
        let config_json = serde_json::to_value(config)?;
        conn.execute(
            "INSERT INTO region_cache (locale, config_data)
             VALUES ($1, $2)
             ON CONFLICT (locale) DO UPDATE SET
                config_data = EXCLUDED.config_data,
                cached_at = NOW()",
            &[&config.locale, &config_json],
        ).await?;

        tracing::debug!("Cached region config: {}", config.code);
        Ok(())
    }

    /// 清理过期的缓存
    pub fn cleanup_expired_cache(&self, days: i32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.cleanup_expired_cache_async(days).await
        })
    }

    async fn cleanup_expired_cache_async(&self, days: i32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let count = conn.execute(
            "DELETE FROM region_cache 
             WHERE cached_at < NOW() - INTERVAL '1 day' * $1",
            &[&days],
        ).await?;

        tracing::info!("Cleaned up {} expired region cache entries", count);
        Ok(count as usize)
    }

    /// 获取统计信息
    pub fn get_statistics(&self) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_statistics_async().await
        })
    }

    async fn get_statistics_async(&self) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let total_users: i64 = conn.query_one(
            "SELECT COUNT(*) FROM region_preferences",
            &[],
        ).await?.get(0);

        let total_configs: i64 = conn.query_one(
            "SELECT COUNT(*) FROM region_configs WHERE is_active = true",
            &[],
        ).await?.get(0);

        let cache_size: i64 = conn.query_one(
            "SELECT COUNT(*) FROM region_cache",
            &[],
        ).await?.get(0);

        Ok(serde_json::json!({
            "total_users": total_users,
            "total_configs": total_configs,
            "cache_size": cache_size,
        }))
    }
}

// SQLite 兼容性包装器（用于命令层）
pub struct RegionDatabase {}

impl RegionDatabase {
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {})
    }

    pub fn get_preferences(&self) -> Result<Option<RegionPreferences>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(None)
    }

    pub fn save_preferences(&self, _preferences: &RegionPreferences) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    /// 保存用户偏好设置（PostgreSQL客户端接口）
    pub fn save_user_preferences(conn: &deadpool_postgres::Client, preferences: &RegionPreferences) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let row = conn.query_one(
                "INSERT INTO region_preferences 
                 (user_id, language, locale, timezone, currency, date_format, time_format,
                  temperature_unit, distance_unit, weight_unit, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET
                    language = EXCLUDED.language,
                    locale = EXCLUDED.locale,
                    timezone = EXCLUDED.timezone,
                    currency = EXCLUDED.currency,
                    date_format = EXCLUDED.date_format,
                    time_format = EXCLUDED.time_format,
                    temperature_unit = EXCLUDED.temperature_unit,
                    distance_unit = EXCLUDED.distance_unit,
                    weight_unit = EXCLUDED.weight_unit,
                    updated_at = NOW()
                 RETURNING id",
                &[
                    &preferences.user_id,
                    &preferences.language,
                    &preferences.locale,
                    &preferences.timezone,
                    &preferences.currency,
                    &preferences.date_format,
                    &preferences.time_format,
                    &preferences.temperature_unit,
                    &preferences.distance_unit,
                    &preferences.weight_unit,
                ],
            ).await?;

            let id: i64 = row.get(0);
            Ok(id)
        })
    }

    /// 获取用户偏好设置（PostgreSQL客户端接口）
    pub fn get_user_preferences(conn: &deadpool_postgres::Client, user_id: Option<&str>) -> Result<RegionPreferences, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let row = conn.query_opt(
                "SELECT id, user_id, language, locale, timezone, currency, date_format, 
                        time_format, temperature_unit, distance_unit, weight_unit
                 FROM region_preferences 
                 WHERE user_id = $1 OR (user_id IS NULL AND $1 IS NULL)
                 LIMIT 1",
                &[&user_id],
            ).await?;

            if let Some(row) = row {
                Ok(row_to_preferences(&row))
            } else {
                // 返回默认值
                let mut prefs = RegionPreferences::default();
                prefs.user_id = user_id.map(|s| s.to_string());
                Ok(prefs)
            }
        })
    }

    pub fn init(_conn: &deadpool_postgres::Client) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    /// 获取所有区域配置（PostgreSQL客户端接口）
    pub fn get_all_region_configs(conn: &deadpool_postgres::Client) -> Result<Vec<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let rows = conn.query(
                "SELECT code, name, locale, timezone, currency, language
                 FROM region_configs
                 WHERE is_active = true
                 ORDER BY name",
                &[],
            ).await?;

            if rows.is_empty() {
                // 返回默认配置
                Ok(build_default_region_configs())
            } else {
                Ok(rows.iter().map(row_to_config).collect())
            }
        })
    }

    /// 删除用户偏好设置（PostgreSQL客户端接口）
    pub fn delete_user_preferences(conn: &deadpool_postgres::Client, user_id: Option<&str>) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let user_id_str = user_id.unwrap_or("");
            let count = conn.execute(
                "DELETE FROM region_preferences WHERE user_id = $1",
                &[&user_id_str],
            ).await?;

            Ok(count as usize)
        })
    }

    /// 缓存区域配置（PostgreSQL客户端接口）
    pub fn cache_region_config(conn: &deadpool_postgres::Client, config: &RegionConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            // 保存到配置表
            conn.execute(
                "INSERT INTO region_configs (code, name, locale, timezone, currency, language)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    locale = EXCLUDED.locale,
                    timezone = EXCLUDED.timezone,
                    currency = EXCLUDED.currency,
                    language = EXCLUDED.language",
                &[
                    &config.code,
                    &config.name,
                    &config.locale,
                    &config.timezone,
                    &config.currency,
                    &config.language,
                ],
            ).await?;

            // 缓存配置数据
            let config_json = serde_json::to_value(config)?;
            conn.execute(
                "INSERT INTO region_cache (locale, config_data)
                 VALUES ($1, $2)
                 ON CONFLICT (locale) DO UPDATE SET
                    config_data = EXCLUDED.config_data,
                    cached_at = NOW()",
                &[&config.locale, &config_json],
            ).await?;

            Ok(())
        })
    }

    /// 获取区域配置（PostgreSQL客户端接口）
    pub fn get_region_config(conn: &deadpool_postgres::Client, locale: &str) -> Result<Option<RegionConfig>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let row = conn.query_opt(
                "SELECT code, name, locale, timezone, currency, language
                 FROM region_configs
                 WHERE locale = $1 OR code = $1",
                &[&locale],
            ).await?;

            Ok(row.map(|r| row_to_config(&r)))
        })
    }

    /// 清理过期缓存（PostgreSQL客户端接口）
    pub fn cleanup_expired_cache(conn: &deadpool_postgres::Client, days: i32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            let count = conn.execute(
                "DELETE FROM region_cache 
                 WHERE cached_at < NOW() - INTERVAL '1 day' * $1",
                &[&days],
            ).await?;

            Ok(count as usize)
        })
    }
}

/// 构建默认区域配置
pub fn build_default_region_configs() -> Vec<RegionConfig> {
    vec![
        RegionConfig {
            code: "zh-CN".to_string(),
            name: "中国大陆".to_string(),
            locale: "zh-CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            language: "zh-CN".to_string(),
        },
        RegionConfig {
            code: "en-US".to_string(),
            name: "United States".to_string(),
            locale: "en-US".to_string(),
            timezone: "America/New_York".to_string(),
            currency: "USD".to_string(),
            language: "en-US".to_string(),
        },
        RegionConfig {
            code: "ja-JP".to_string(),
            name: "日本".to_string(),
            locale: "ja-JP".to_string(),
            timezone: "Asia/Tokyo".to_string(),
            currency: "JPY".to_string(),
            language: "ja-JP".to_string(),
        },
        RegionConfig {
            code: "ko-KR".to_string(),
            name: "대한민국".to_string(),
            locale: "ko-KR".to_string(),
            timezone: "Asia/Seoul".to_string(),
            currency: "KRW".to_string(),
            language: "ko-KR".to_string(),
        },
        RegionConfig {
            code: "de-DE".to_string(),
            name: "Deutschland".to_string(),
            locale: "de-DE".to_string(),
            timezone: "Europe/Berlin".to_string(),
            currency: "EUR".to_string(),
            language: "de-DE".to_string(),
        },
        RegionConfig {
            code: "fr-FR".to_string(),
            name: "France".to_string(),
            locale: "fr-FR".to_string(),
            timezone: "Europe/Paris".to_string(),
            currency: "EUR".to_string(),
            language: "fr-FR".to_string(),
        },
        RegionConfig {
            code: "es-ES".to_string(),
            name: "España".to_string(),
            locale: "es-ES".to_string(),
            timezone: "Europe/Madrid".to_string(),
            currency: "EUR".to_string(),
            language: "es-ES".to_string(),
        },
    ]
}

// 辅助函数：将数据库行转换为RegionPreferences
fn row_to_preferences(row: &Row) -> RegionPreferences {
    RegionPreferences {
        id: Some(row.get(0)),
        user_id: row.get(1),
        language: row.get(2),
        locale: row.get(3),
        timezone: row.get(4),
        currency: row.get(5),
        date_format: row.get(6),
        time_format: row.get(7),
        temperature_unit: row.get(8),
        distance_unit: row.get(9),
        weight_unit: row.get(10),
    }
}

// 辅助函数：将数据库行转换为RegionConfig
fn row_to_config(row: &Row) -> RegionConfig {
    RegionConfig {
        code: row.get(0),
        name: row.get(1),
        locale: row.get(2),
        timezone: row.get(3),
        currency: row.get(4),
        language: row.get(5),
    }
}

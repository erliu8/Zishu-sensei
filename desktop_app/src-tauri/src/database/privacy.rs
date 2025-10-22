//! 隐私设置数据库模块 (PostgreSQL完整实现)
//! 管理用户隐私偏好和数据处理设置

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tokio_postgres::Row;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrivacySettings {
    pub analytics_enabled: bool,
    pub crash_reports_enabled: bool,
    pub data_collection_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullPrivacySettings {
    pub id: Option<i64>,
    pub user_id: Option<String>,
    pub analytics_enabled: bool,
    pub crash_reports_enabled: bool,
    pub data_collection_enabled: bool,
    pub usage_tracking_enabled: bool,
    pub performance_tracking_enabled: bool,
    pub error_reporting_enabled: bool,
    pub personalization_enabled: bool,
    pub third_party_sharing_enabled: bool,
    pub marketing_emails_enabled: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl Default for FullPrivacySettings {
    fn default() -> Self {
        Self {
            id: None,
            user_id: None,
            analytics_enabled: false,
            crash_reports_enabled: true,
            data_collection_enabled: false,
            usage_tracking_enabled: false,
            performance_tracking_enabled: true,
            error_reporting_enabled: true,
            personalization_enabled: true,
            third_party_sharing_enabled: false,
            marketing_emails_enabled: false,
            created_at: None,
            updated_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRetentionPolicy {
    pub id: Option<i64>,
    pub data_type: String,
    pub retention_days: i32,
    pub auto_cleanup_enabled: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentLog {
    pub id: Option<i64>,
    pub user_id: Option<String>,
    pub consent_type: String,
    pub granted: bool,
    pub version: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// 隐私注册表（主要API）
pub struct PrivacyRegistry {
    pool: DbPool,
}

impl PrivacyRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;

        // 创建隐私设置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS privacy_settings (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT UNIQUE,
                analytics_enabled BOOLEAN NOT NULL DEFAULT false,
                crash_reports_enabled BOOLEAN NOT NULL DEFAULT true,
                data_collection_enabled BOOLEAN NOT NULL DEFAULT false,
                usage_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
                performance_tracking_enabled BOOLEAN NOT NULL DEFAULT true,
                error_reporting_enabled BOOLEAN NOT NULL DEFAULT true,
                personalization_enabled BOOLEAN NOT NULL DEFAULT true,
                third_party_sharing_enabled BOOLEAN NOT NULL DEFAULT false,
                marketing_emails_enabled BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建数据保留策略表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS data_retention_policies (
                id BIGSERIAL PRIMARY KEY,
                data_type TEXT UNIQUE NOT NULL,
                retention_days INTEGER NOT NULL DEFAULT 90,
                auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
                description TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建同意记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS consent_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT,
                consent_type TEXT NOT NULL,
                granted BOOLEAN NOT NULL,
                version TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建索引
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_consent_logs_type ON consent_logs(consent_type)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_consent_logs_created_at ON consent_logs(created_at)",
            &[],
        ).await;

        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_retention_policies_data_type ON data_retention_policies(data_type)",
            &[],
        ).await;

        // 初始化默认数据保留策略
        self.init_default_retention_policies().await?;

        tracing::info!("Privacy tables initialized successfully");
        Ok(())
    }

    /// 初始化默认数据保留策略
    async fn init_default_retention_policies(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let default_policies = vec![
            ("logs", 30, "应用日志"),
            ("analytics", 90, "分析数据"),
            ("crash_reports", 180, "崩溃报告"),
            ("user_sessions", 30, "用户会话"),
            ("temporary_files", 7, "临时文件"),
            ("cache", 14, "缓存数据"),
        ];

        for (data_type, retention_days, description) in default_policies {
            conn.execute(
                "INSERT INTO data_retention_policies (data_type, retention_days, description)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (data_type) DO NOTHING",
                &[&data_type, &retention_days, &description],
            ).await?;
        }

        Ok(())
    }

    /// 获取隐私设置（同步接口）
    pub fn get_settings(&self) -> Result<PrivacySettings, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_settings_async(None).await
        })
    }

    /// 获取完整隐私设置
    pub fn get_full_settings(&self, user_id: Option<&str>) -> Result<FullPrivacySettings, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_full_settings_async(user_id).await
        })
    }

    async fn get_settings_async(&self, user_id: Option<&str>) -> Result<PrivacySettings, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_opt(
            "SELECT analytics_enabled, crash_reports_enabled, data_collection_enabled
             FROM privacy_settings
             WHERE user_id = $1 OR (user_id IS NULL AND $1 IS NULL)
             LIMIT 1",
            &[&user_id],
        ).await?;

        if let Some(row) = row {
            Ok(PrivacySettings {
                analytics_enabled: row.get(0),
                crash_reports_enabled: row.get(1),
                data_collection_enabled: row.get(2),
            })
        } else {
            Ok(PrivacySettings::default())
        }
    }

    async fn get_full_settings_async(&self, user_id: Option<&str>) -> Result<FullPrivacySettings, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_opt(
            "SELECT id, user_id, analytics_enabled, crash_reports_enabled, data_collection_enabled,
                    usage_tracking_enabled, performance_tracking_enabled, error_reporting_enabled,
                    personalization_enabled, third_party_sharing_enabled, marketing_emails_enabled,
                    created_at, updated_at
             FROM privacy_settings
             WHERE user_id = $1 OR (user_id IS NULL AND $1 IS NULL)
             LIMIT 1",
            &[&user_id],
        ).await?;

        if let Some(row) = row {
            Ok(row_to_full_settings(&row))
        } else {
            let mut settings = FullPrivacySettings::default();
            settings.user_id = user_id.map(|s| s.to_string());
            Ok(settings)
        }
    }

    /// 更新隐私设置（同步接口）
    pub fn update_settings(&self, settings: PrivacySettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.update_settings_async(None, settings).await
        })
    }

    /// 更新完整隐私设置
    pub fn update_full_settings(&self, user_id: Option<&str>, settings: FullPrivacySettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.update_full_settings_async(user_id, settings).await
        })
    }

    async fn update_settings_async(&self, user_id: Option<&str>, settings: PrivacySettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        conn.execute(
            "INSERT INTO privacy_settings (user_id, analytics_enabled, crash_reports_enabled, data_collection_enabled)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE SET
                analytics_enabled = EXCLUDED.analytics_enabled,
                crash_reports_enabled = EXCLUDED.crash_reports_enabled,
                data_collection_enabled = EXCLUDED.data_collection_enabled,
                updated_at = NOW()",
            &[&user_id, &settings.analytics_enabled, &settings.crash_reports_enabled, &settings.data_collection_enabled],
        ).await?;

        tracing::info!("Privacy settings updated for user_id={:?}", user_id);
        Ok(())
    }

    async fn update_full_settings_async(&self, user_id: Option<&str>, settings: FullPrivacySettings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        conn.execute(
            "INSERT INTO privacy_settings 
             (user_id, analytics_enabled, crash_reports_enabled, data_collection_enabled,
              usage_tracking_enabled, performance_tracking_enabled, error_reporting_enabled,
              personalization_enabled, third_party_sharing_enabled, marketing_emails_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id) DO UPDATE SET
                analytics_enabled = EXCLUDED.analytics_enabled,
                crash_reports_enabled = EXCLUDED.crash_reports_enabled,
                data_collection_enabled = EXCLUDED.data_collection_enabled,
                usage_tracking_enabled = EXCLUDED.usage_tracking_enabled,
                performance_tracking_enabled = EXCLUDED.performance_tracking_enabled,
                error_reporting_enabled = EXCLUDED.error_reporting_enabled,
                personalization_enabled = EXCLUDED.personalization_enabled,
                third_party_sharing_enabled = EXCLUDED.third_party_sharing_enabled,
                marketing_emails_enabled = EXCLUDED.marketing_emails_enabled,
                updated_at = NOW()",
            &[
                &user_id,
                &settings.analytics_enabled,
                &settings.crash_reports_enabled,
                &settings.data_collection_enabled,
                &settings.usage_tracking_enabled,
                &settings.performance_tracking_enabled,
                &settings.error_reporting_enabled,
                &settings.personalization_enabled,
                &settings.third_party_sharing_enabled,
                &settings.marketing_emails_enabled,
            ],
        ).await?;

        tracing::info!("Full privacy settings updated for user_id={:?}", user_id);
        Ok(())
    }

    /// 记录同意日志
    pub fn log_consent(&self, log: ConsentLog) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.log_consent_async(log).await
        })
    }

    async fn log_consent_async(&self, log: ConsentLog) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let metadata = serde_json::json!({
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
        });

        let row = conn.query_one(
            "INSERT INTO consent_logs (user_id, consent_type, granted, version, ip_address, user_agent, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id",
            &[
                &log.user_id,
                &log.consent_type,
                &log.granted,
                &log.version,
                &log.ip_address,
                &log.user_agent,
                &metadata,
            ],
        ).await?;

        let id: i64 = row.get(0);
        tracing::info!("Consent logged: id={}, type={}, granted={}", id, log.consent_type, log.granted);
        Ok(id)
    }

    /// 获取同意历史
    pub fn get_consent_history(&self, user_id: Option<&str>, consent_type: Option<&str>) -> Result<Vec<ConsentLog>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_consent_history_async(user_id, consent_type).await
        })
    }

    async fn get_consent_history_async(&self, user_id: Option<&str>, consent_type: Option<&str>) -> Result<Vec<ConsentLog>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let query = if let Some(ctype) = consent_type {
            "SELECT id, user_id, consent_type, granted, version, ip_address, user_agent, created_at
             FROM consent_logs
             WHERE (user_id = $1 OR ($1 IS NULL AND user_id IS NULL))
               AND consent_type = $2
             ORDER BY created_at DESC
             LIMIT 100"
        } else {
            "SELECT id, user_id, consent_type, granted, version, ip_address, user_agent, created_at
             FROM consent_logs
             WHERE user_id = $1 OR ($1 IS NULL AND user_id IS NULL)
             ORDER BY created_at DESC
             LIMIT 100"
        };

        let rows = if let Some(ctype) = consent_type {
            conn.query(query, &[&user_id, &ctype]).await?
        } else {
            conn.query(query, &[&user_id]).await?
        };

        Ok(rows.iter().map(row_to_consent_log).collect())
    }

    /// 获取数据保留策略
    pub fn get_retention_policy(&self, data_type: &str) -> Result<Option<DataRetentionPolicy>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_retention_policy_async(data_type).await
        })
    }

    async fn get_retention_policy_async(&self, data_type: &str) -> Result<Option<DataRetentionPolicy>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let row = conn.query_opt(
            "SELECT id, data_type, retention_days, auto_cleanup_enabled, created_at, updated_at
             FROM data_retention_policies
             WHERE data_type = $1",
            &[&data_type],
        ).await?;

        Ok(row.map(|r| row_to_retention_policy(&r)))
    }

    /// 获取所有数据保留策略
    pub fn get_all_retention_policies(&self) -> Result<Vec<DataRetentionPolicy>, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.get_all_retention_policies_async().await
        })
    }

    async fn get_all_retention_policies_async(&self) -> Result<Vec<DataRetentionPolicy>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let rows = conn.query(
            "SELECT id, data_type, retention_days, auto_cleanup_enabled, created_at, updated_at
             FROM data_retention_policies
             ORDER BY data_type",
            &[],
        ).await?;

        Ok(rows.iter().map(row_to_retention_policy).collect())
    }

    /// 更新数据保留策略
    pub fn update_retention_policy(&self, policy: DataRetentionPolicy) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.update_retention_policy_async(policy).await
        })
    }

    async fn update_retention_policy_async(&self, policy: DataRetentionPolicy) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        conn.execute(
            "INSERT INTO data_retention_policies (data_type, retention_days, auto_cleanup_enabled)
             VALUES ($1, $2, $3)
             ON CONFLICT (data_type) DO UPDATE SET
                retention_days = EXCLUDED.retention_days,
                auto_cleanup_enabled = EXCLUDED.auto_cleanup_enabled,
                updated_at = NOW()",
            &[&policy.data_type, &policy.retention_days, &policy.auto_cleanup_enabled],
        ).await?;

        tracing::info!("Retention policy updated: data_type={}, retention_days={}", policy.data_type, policy.retention_days);
        Ok(())
    }

    /// 启用隐私模式
    pub fn enable_privacy_mode(&self, user_id: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.enable_privacy_mode_async(user_id).await
        })
    }

    async fn enable_privacy_mode_async(&self, user_id: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let settings = FullPrivacySettings {
            analytics_enabled: false,
            crash_reports_enabled: false,
            data_collection_enabled: false,
            usage_tracking_enabled: false,
            performance_tracking_enabled: false,
            error_reporting_enabled: false,
            personalization_enabled: false,
            third_party_sharing_enabled: false,
            marketing_emails_enabled: false,
            ..Default::default()
        };

        self.update_full_settings_async(user_id, settings).await?;
        tracing::info!("Privacy mode enabled for user_id={:?}", user_id);
        Ok(())
    }

    /// 禁用隐私模式（恢复默认设置）
    pub fn disable_privacy_mode(&self, user_id: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.disable_privacy_mode_async(user_id).await
        })
    }

    async fn disable_privacy_mode_async(&self, user_id: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let settings = FullPrivacySettings::default();
        self.update_full_settings_async(user_id, settings).await?;
        tracing::info!("Privacy mode disabled for user_id={:?}", user_id);
        Ok(())
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
            "SELECT COUNT(*) FROM privacy_settings",
            &[],
        ).await?.get(0);

        let analytics_enabled: i64 = conn.query_one(
            "SELECT COUNT(*) FROM privacy_settings WHERE analytics_enabled = true",
            &[],
        ).await?.get(0);

        let total_consents: i64 = conn.query_one(
            "SELECT COUNT(*) FROM consent_logs",
            &[],
        ).await?.get(0);

        let total_policies: i64 = conn.query_one(
            "SELECT COUNT(*) FROM data_retention_policies",
            &[],
        ).await?.get(0);

        Ok(serde_json::json!({
            "total_users": total_users,
            "analytics_enabled_count": analytics_enabled,
            "total_consent_logs": total_consents,
            "total_retention_policies": total_policies,
        }))
    }

    /// 清理旧的同意日志
    pub fn cleanup_old_consent_logs(&self, days: i32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.cleanup_old_consent_logs_async(days).await
        })
    }

    async fn cleanup_old_consent_logs_async(&self, days: i32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let count = conn.execute(
            "DELETE FROM consent_logs 
             WHERE created_at < NOW() - INTERVAL '1 day' * $1",
            &[&days],
        ).await?;

        tracing::info!("Cleaned up {} old consent logs", count);
        Ok(count as usize)
    }

    /// 删除用户所有隐私数据
    pub fn delete_all_user_data(&self, user_id: &str) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        tokio::runtime::Handle::current().block_on(async {
            self.delete_all_user_data_async(user_id).await
        })
    }

    async fn delete_all_user_data_async(&self, user_id: &str) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get().await?;
        
        let mut total_deleted = 0;

        // 删除隐私设置
        let count1 = conn.execute(
            "DELETE FROM privacy_settings WHERE user_id = $1",
            &[&user_id],
        ).await?;
        total_deleted += count1 as usize;

        // 删除同意日志
        let count2 = conn.execute(
            "DELETE FROM consent_logs WHERE user_id = $1",
            &[&user_id],
        ).await?;
        total_deleted += count2 as usize;

        tracing::info!("Deleted all privacy data for user_id={}: {} records", user_id, total_deleted);
        Ok(total_deleted)
    }
}

// 辅助函数：将数据库行转换为FullPrivacySettings
fn row_to_full_settings(row: &Row) -> FullPrivacySettings {
    FullPrivacySettings {
        id: Some(row.get(0)),
        user_id: row.get(1),
        analytics_enabled: row.get(2),
        crash_reports_enabled: row.get(3),
        data_collection_enabled: row.get(4),
        usage_tracking_enabled: row.get(5),
        performance_tracking_enabled: row.get(6),
        error_reporting_enabled: row.get(7),
        personalization_enabled: row.get(8),
        third_party_sharing_enabled: row.get(9),
        marketing_emails_enabled: row.get(10),
        created_at: Some(row.get(11)),
        updated_at: Some(row.get(12)),
    }
}

// 辅助函数：将数据库行转换为ConsentLog
fn row_to_consent_log(row: &Row) -> ConsentLog {
    ConsentLog {
        id: Some(row.get(0)),
        user_id: row.get(1),
        consent_type: row.get(2),
        granted: row.get(3),
        version: row.get(4),
        ip_address: row.get(5),
        user_agent: row.get(6),
        created_at: Some(row.get(7)),
    }
}

// 辅助函数：将数据库行转换为DataRetentionPolicy
fn row_to_retention_policy(row: &Row) -> DataRetentionPolicy {
    DataRetentionPolicy {
        id: Some(row.get(0)),
        data_type: row.get(1),
        retention_days: row.get(2),
        auto_cleanup_enabled: row.get(3),
        created_at: Some(row.get(4)),
        updated_at: Some(row.get(5)),
    }
}

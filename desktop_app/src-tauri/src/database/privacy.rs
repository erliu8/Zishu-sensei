// 隐私设置数据库模型
use rusqlite::{params, Connection, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// 隐私设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub id: i64,
    pub local_conversation_only: bool,      // 仅本地对话
    pub privacy_mode_enabled: bool,          // 隐私模式
    pub anonymous_analytics: bool,           // 匿名使用统计
    pub save_conversation_history: bool,     // 保存对话历史
    pub save_search_history: bool,           // 保存搜索历史
    pub allow_crash_reports: bool,           // 允许崩溃报告
    pub allow_usage_statistics: bool,        // 允许使用统计
    pub auto_clear_cache_days: i32,          // 自动清除缓存天数（0=禁用）
    pub auto_clear_logs_days: i32,           // 自动清除日志天数（0=禁用）
    pub clipboard_history_enabled: bool,     // 剪贴板历史
    pub telemetry_level: String,             // 遥测级别: none/basic/full
    pub created_at: i64,
    pub updated_at: i64,
}

/// 隐私政策同意记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyConsent {
    pub id: i64,
    pub policy_version: String,
    pub consented: bool,
    pub consented_at: i64,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// 数据清除记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataCleanupRecord {
    pub id: i64,
    pub cleanup_type: String,  // conversations/cache/logs/all
    pub items_deleted: i64,
    pub space_freed_bytes: i64,
    pub performed_at: i64,
    pub triggered_by: String,  // user/auto
}

impl PrivacySettings {
    fn from_row(row: &Row) -> SqliteResult<Self> {
        Ok(Self {
            id: row.get(0)?,
            local_conversation_only: row.get(1)?,
            privacy_mode_enabled: row.get(2)?,
            anonymous_analytics: row.get(3)?,
            save_conversation_history: row.get(4)?,
            save_search_history: row.get(5)?,
            allow_crash_reports: row.get(6)?,
            allow_usage_statistics: row.get(7)?,
            auto_clear_cache_days: row.get(8)?,
            auto_clear_logs_days: row.get(9)?,
            clipboard_history_enabled: row.get(10)?,
            telemetry_level: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }
}

impl PrivacyConsent {
    fn from_row(row: &Row) -> SqliteResult<Self> {
        Ok(Self {
            id: row.get(0)?,
            policy_version: row.get(1)?,
            consented: row.get(2)?,
            consented_at: row.get(3)?,
            ip_address: row.get(4)?,
            user_agent: row.get(5)?,
        })
    }
}

impl DataCleanupRecord {
    fn from_row(row: &Row) -> SqliteResult<Self> {
        Ok(Self {
            id: row.get(0)?,
            cleanup_type: row.get(1)?,
            items_deleted: row.get(2)?,
            space_freed_bytes: row.get(3)?,
            performed_at: row.get(4)?,
            triggered_by: row.get(5)?,
        })
    }
}

/// 隐私数据库管理器
pub struct PrivacyDatabase {
    conn: Arc<Mutex<Connection>>,
}

impl PrivacyDatabase {
    pub fn new(conn: Arc<Mutex<Connection>>) -> SqliteResult<Self> {
        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();

        // 隐私设置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS privacy_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                local_conversation_only BOOLEAN NOT NULL DEFAULT 0,
                privacy_mode_enabled BOOLEAN NOT NULL DEFAULT 0,
                anonymous_analytics BOOLEAN NOT NULL DEFAULT 1,
                save_conversation_history BOOLEAN NOT NULL DEFAULT 1,
                save_search_history BOOLEAN NOT NULL DEFAULT 1,
                allow_crash_reports BOOLEAN NOT NULL DEFAULT 1,
                allow_usage_statistics BOOLEAN NOT NULL DEFAULT 1,
                auto_clear_cache_days INTEGER NOT NULL DEFAULT 0,
                auto_clear_logs_days INTEGER NOT NULL DEFAULT 30,
                clipboard_history_enabled BOOLEAN NOT NULL DEFAULT 1,
                telemetry_level TEXT NOT NULL DEFAULT 'basic',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 隐私政策同意表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS privacy_consents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                policy_version TEXT NOT NULL,
                consented BOOLEAN NOT NULL,
                consented_at INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT
            )",
            [],
        )?;

        // 数据清除记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS data_cleanup_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cleanup_type TEXT NOT NULL,
                items_deleted INTEGER NOT NULL,
                space_freed_bytes INTEGER NOT NULL,
                performed_at INTEGER NOT NULL,
                triggered_by TEXT NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_consents_version ON privacy_consents(policy_version)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cleanup_type ON data_cleanup_records(cleanup_type)",
            [],
        )?;

        Ok(())
    }

    /// 获取或创建默认隐私设置
    pub fn get_or_create_settings(&self) -> SqliteResult<PrivacySettings> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, local_conversation_only, privacy_mode_enabled, anonymous_analytics,
                    save_conversation_history, save_search_history, allow_crash_reports,
                    allow_usage_statistics, auto_clear_cache_days, auto_clear_logs_days,
                    clipboard_history_enabled, telemetry_level, created_at, updated_at
             FROM privacy_settings LIMIT 1"
        )?;

        let result = stmt.query_row([], PrivacySettings::from_row);

        match result {
            Ok(settings) => Ok(settings),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 创建默认设置
                let now = chrono::Utc::now().timestamp();
                conn.execute(
                    "INSERT INTO privacy_settings (
                        local_conversation_only, privacy_mode_enabled, anonymous_analytics,
                        save_conversation_history, save_search_history, allow_crash_reports,
                        allow_usage_statistics, auto_clear_cache_days, auto_clear_logs_days,
                        clipboard_history_enabled, telemetry_level, created_at, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![false, false, true, true, true, true, true, 0, 30, true, "basic", now, now],
                )?;

                let id = conn.last_insert_rowid();
                Ok(PrivacySettings {
                    id,
                    local_conversation_only: false,
                    privacy_mode_enabled: false,
                    anonymous_analytics: true,
                    save_conversation_history: true,
                    save_search_history: true,
                    allow_crash_reports: true,
                    allow_usage_statistics: true,
                    auto_clear_cache_days: 0,
                    auto_clear_logs_days: 30,
                    clipboard_history_enabled: true,
                    telemetry_level: "basic".to_string(),
                    created_at: now,
                    updated_at: now,
                })
            }
            Err(e) => Err(e),
        }
    }

    /// 更新隐私设置
    pub fn update_settings(&self, settings: &PrivacySettings) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE privacy_settings SET
                local_conversation_only = ?1,
                privacy_mode_enabled = ?2,
                anonymous_analytics = ?3,
                save_conversation_history = ?4,
                save_search_history = ?5,
                allow_crash_reports = ?6,
                allow_usage_statistics = ?7,
                auto_clear_cache_days = ?8,
                auto_clear_logs_days = ?9,
                clipboard_history_enabled = ?10,
                telemetry_level = ?11,
                updated_at = ?12
             WHERE id = ?13",
            params![
                settings.local_conversation_only,
                settings.privacy_mode_enabled,
                settings.anonymous_analytics,
                settings.save_conversation_history,
                settings.save_search_history,
                settings.allow_crash_reports,
                settings.allow_usage_statistics,
                settings.auto_clear_cache_days,
                settings.auto_clear_logs_days,
                settings.clipboard_history_enabled,
                settings.telemetry_level,
                now,
                settings.id,
            ],
        )?;

        Ok(())
    }

    /// 记录隐私政策同意
    pub fn record_consent(&self, policy_version: &str, consented: bool) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO privacy_consents (policy_version, consented, consented_at)
             VALUES (?1, ?2, ?3)",
            params![policy_version, consented, now],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 获取最新的隐私政策同意记录
    pub fn get_latest_consent(&self) -> SqliteResult<Option<PrivacyConsent>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, policy_version, consented, consented_at, ip_address, user_agent
             FROM privacy_consents
             ORDER BY consented_at DESC
             LIMIT 1"
        )?;

        let result = stmt.query_row([], PrivacyConsent::from_row);

        match result {
            Ok(consent) => Ok(Some(consent)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 检查是否已同意特定版本的隐私政策
    pub fn has_consented_to_version(&self, version: &str) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM privacy_consents WHERE policy_version = ?1 AND consented = 1",
            params![version],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// 记录数据清除
    pub fn record_cleanup(
        &self,
        cleanup_type: &str,
        items_deleted: i64,
        space_freed_bytes: i64,
        triggered_by: &str,
    ) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO data_cleanup_records (cleanup_type, items_deleted, space_freed_bytes, performed_at, triggered_by)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![cleanup_type, items_deleted, space_freed_bytes, now, triggered_by],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 获取清除历史记录
    pub fn get_cleanup_history(&self, limit: i64) -> SqliteResult<Vec<DataCleanupRecord>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, cleanup_type, items_deleted, space_freed_bytes, performed_at, triggered_by
             FROM data_cleanup_records
             ORDER BY performed_at DESC
             LIMIT ?1"
        )?;

        let records = stmt
            .query_map(params![limit], DataCleanupRecord::from_row)?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(records)
    }

    /// 获取清除统计
    pub fn get_cleanup_stats(&self) -> SqliteResult<serde_json::Value> {
        let conn = self.conn.lock().unwrap();
        
        let total_cleanups: i64 = conn.query_row(
            "SELECT COUNT(*) FROM data_cleanup_records",
            [],
            |row| row.get(0),
        )?;

        let total_items: i64 = conn.query_row(
            "SELECT COALESCE(SUM(items_deleted), 0) FROM data_cleanup_records",
            [],
            |row| row.get(0),
        )?;

        let total_space: i64 = conn.query_row(
            "SELECT COALESCE(SUM(space_freed_bytes), 0) FROM data_cleanup_records",
            [],
            |row| row.get(0),
        )?;

        Ok(serde_json::json!({
            "total_cleanups": total_cleanups,
            "total_items_deleted": total_items,
            "total_space_freed_bytes": total_space,
            "total_space_freed_mb": total_space as f64 / 1024.0 / 1024.0,
        }))
    }
}


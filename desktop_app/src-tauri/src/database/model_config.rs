//! # 模型配置持久化模块
//! 
//! 提供聊天模型配置的数据库持久化存储和管理功能
//! 
//! ## 功能特性
//! - 模型配置的 CRUD 操作
//! - 配置历史记录追踪
//! - 配置验证和错误处理
//! - 默认配置管理
//! - 配置搜索和过滤
//! - 配置导入导出（JSON格式）

use rusqlite::{Connection, params, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::{info, error, warn};
use std::collections::HashMap;
use crate::database::DbPool;

// ================================
// 数据结构定义
// ================================

/// 模型配置数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfigData {
    /// 配置 ID（唯一标识）
    pub id: String,
    /// 配置名称
    pub name: String,
    /// 模型 ID
    pub model_id: String,
    /// 适配器 ID
    pub adapter_id: Option<String>,
    /// 温度参数 (0.0 - 2.0)
    pub temperature: f32,
    /// Top-P 参数 (0.0 - 1.0)
    pub top_p: f32,
    /// Top-K 参数
    pub top_k: Option<i32>,
    /// 最大 token 数
    pub max_tokens: u32,
    /// 频率惩罚 (-2.0 - 2.0)
    pub frequency_penalty: f32,
    /// 存在惩罚 (-2.0 - 2.0)
    pub presence_penalty: f32,
    /// 停止序列
    pub stop_sequences: Vec<String>,
    /// 是否为默认配置
    pub is_default: bool,
    /// 是否启用
    pub is_enabled: bool,
    /// 配置描述
    pub description: Option<String>,
    /// 额外配置（JSON格式）
    pub extra_config: Option<String>,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 模型配置历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfigHistory {
    /// 历史记录 ID
    pub id: i64,
    /// 配置 ID
    pub config_id: String,
    /// 操作类型（created, updated, deleted）
    pub action: String,
    /// 变更前数据（JSON格式）
    pub old_data: Option<String>,
    /// 变更后数据（JSON格式）
    pub new_data: Option<String>,
    /// 变更原因/备注
    pub reason: Option<String>,
    /// 创建时间
    pub created_at: i64,
}

/// 配置验证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// 是否有效
    pub is_valid: bool,
    /// 错误信息列表
    pub errors: Vec<String>,
    /// 警告信息列表
    pub warnings: Vec<String>,
}

// ================================
// 模型配置管理器
// ================================

/// 模型配置管理器
pub struct ModelConfigRegistry {
    pool: DbPool,
}

impl ModelConfigRegistry {
    /// 创建新的配置管理器
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    // ==================== 配置 CRUD 操作 ====================

    /// 保存模型配置
    pub fn save_config(&self, config: ModelConfigData) -> SqliteResult<()> {
        // 验证配置
        let validation = self.validate_config(&config);
        if !validation.is_valid {
            error!("配置验证失败: {:?}", validation.errors);
            return Err(rusqlite::Error::InvalidParameterName(
                validation.errors.join("; ")
            ));
        }

        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let timestamp = Utc::now().timestamp();

        // 检查是否已存在
        let exists = self.config_exists_internal(&conn, &config.id)?;

        // 如果设置为默认配置，取消其他配置的默认状态
        if config.is_default {
            conn.execute(
                "UPDATE model_configs SET is_default = 0 WHERE is_default = 1",
                [],
            )?;
        }

        let stop_sequences_json = serde_json::to_string(&config.stop_sequences)
            .unwrap_or_else(|_| "[]".to_string());

        if exists {
            // 获取旧数据用于历史记录
            let old_config = self.get_config_by_id_internal(&conn, &config.id)?;
            
            // 更新配置
            conn.execute(
                "UPDATE model_configs SET 
                name = ?1, model_id = ?2, adapter_id = ?3, temperature = ?4, 
                top_p = ?5, top_k = ?6, max_tokens = ?7, frequency_penalty = ?8, 
                presence_penalty = ?9, stop_sequences = ?10, is_default = ?11, 
                is_enabled = ?12, description = ?13, extra_config = ?14, updated_at = ?15
                WHERE id = ?16",
                params![
                    config.name,
                    config.model_id,
                    config.adapter_id,
                    config.temperature,
                    config.top_p,
                    config.top_k,
                    config.max_tokens,
                    config.frequency_penalty,
                    config.presence_penalty,
                    stop_sequences_json,
                    if config.is_default { 1 } else { 0 },
                    if config.is_enabled { 1 } else { 0 },
                    config.description,
                    config.extra_config,
                    timestamp,
                    config.id,
                ],
            )?;

            // 记录历史
            if let Some(old) = old_config {
                self.add_history_internal(
                    &conn,
                    &config.id,
                    "updated",
                    Some(&old),
                    Some(&config),
                    Some("配置已更新"),
                )?;
            }

            info!("模型配置已更新: {}", config.id);
        } else {
            // 插入新配置
            conn.execute(
                "INSERT INTO model_configs 
                (id, name, model_id, adapter_id, temperature, top_p, top_k, 
                max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
                is_default, is_enabled, description, extra_config, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                params![
                    config.id,
                    config.name,
                    config.model_id,
                    config.adapter_id,
                    config.temperature,
                    config.top_p,
                    config.top_k,
                    config.max_tokens,
                    config.frequency_penalty,
                    config.presence_penalty,
                    stop_sequences_json,
                    if config.is_default { 1 } else { 0 },
                    if config.is_enabled { 1 } else { 0 },
                    config.description,
                    config.extra_config,
                    timestamp,
                    timestamp,
                ],
            )?;

            // 记录历史
            self.add_history_internal(
                &conn,
                &config.id,
                "created",
                None,
                Some(&config),
                Some("配置已创建"),
            )?;

            info!("模型配置已创建: {}", config.id);
        }

        Ok(())
    }

    /// 获取配置
    pub fn get_config(&self, config_id: &str) -> SqliteResult<Option<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.get_config_by_id_internal(&conn, config_id)
    }

    /// 删除配置
    pub fn delete_config(&self, config_id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        // 获取配置用于历史记录
        let old_config = self.get_config_by_id_internal(&conn, config_id)?;

        // 删除配置
        let affected = conn.execute(
            "DELETE FROM model_configs WHERE id = ?1",
            params![config_id],
        )?;

        if affected > 0 {
            // 记录历史
            if let Some(old) = old_config {
                self.add_history_internal(
                    &conn,
                    config_id,
                    "deleted",
                    Some(&old),
                    None,
                    Some("配置已删除"),
                )?;
            }

            info!("模型配置已删除: {}", config_id);
            Ok(())
        } else {
            Err(rusqlite::Error::QueryReturnedNoRows)
        }
    }

    /// 获取所有配置
    pub fn get_all_configs(&self) -> SqliteResult<Vec<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs ORDER BY created_at DESC"
        )?;

        let configs = stmt.query_map([], |row| {
            self.row_to_config(row)
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(configs)
    }

    /// 获取启用的配置
    pub fn get_enabled_configs(&self) -> SqliteResult<Vec<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE is_enabled = 1 ORDER BY created_at DESC"
        )?;

        let configs = stmt.query_map([], |row| {
            self.row_to_config(row)
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(configs)
    }

    /// 获取默认配置
    pub fn get_default_config(&self) -> SqliteResult<Option<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE is_default = 1 LIMIT 1"
        )?;

        let result = stmt.query_row([], |row| {
            self.row_to_config(row)
        });

        match result {
            Ok(config) => Ok(Some(config)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 设置默认配置
    pub fn set_default_config(&self, config_id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        // 检查配置是否存在
        if !self.config_exists_internal(&conn, config_id)? {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        // 取消所有默认配置
        conn.execute(
            "UPDATE model_configs SET is_default = 0 WHERE is_default = 1",
            [],
        )?;

        // 设置新的默认配置
        conn.execute(
            "UPDATE model_configs SET is_default = 1 WHERE id = ?1",
            params![config_id],
        )?;

        info!("默认模型配置已设置: {}", config_id);
        Ok(())
    }

    /// 按模型ID查询配置
    pub fn get_configs_by_model(&self, model_id: &str) -> SqliteResult<Vec<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE model_id = ?1 ORDER BY created_at DESC"
        )?;

        let configs = stmt.query_map(params![model_id], |row| {
            self.row_to_config(row)
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(configs)
    }

    /// 按适配器ID查询配置
    pub fn get_configs_by_adapter(&self, adapter_id: &str) -> SqliteResult<Vec<ModelConfigData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE adapter_id = ?1 ORDER BY created_at DESC"
        )?;

        let configs = stmt.query_map(params![adapter_id], |row| {
            self.row_to_config(row)
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(configs)
    }

    // ==================== 配置历史记录 ====================

    /// 获取配置历史记录
    pub fn get_config_history(&self, config_id: &str, limit: Option<u32>) -> SqliteResult<Vec<ModelConfigHistory>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let query = if let Some(lim) = limit {
            format!(
                "SELECT id, config_id, action, old_data, new_data, reason, created_at
                FROM model_config_history WHERE config_id = ?1 
                ORDER BY created_at DESC LIMIT {}",
                lim
            )
        } else {
            "SELECT id, config_id, action, old_data, new_data, reason, created_at
            FROM model_config_history WHERE config_id = ?1 
            ORDER BY created_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&query)?;

        let history = stmt.query_map(params![config_id], |row| {
            Ok(ModelConfigHistory {
                id: row.get(0)?,
                config_id: row.get(1)?,
                action: row.get(2)?,
                old_data: row.get(3)?,
                new_data: row.get(4)?,
                reason: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(history)
    }

    /// 获取所有历史记录
    pub fn get_all_history(&self, limit: Option<u32>) -> SqliteResult<Vec<ModelConfigHistory>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let query = if let Some(lim) = limit {
            format!(
                "SELECT id, config_id, action, old_data, new_data, reason, created_at
                FROM model_config_history ORDER BY created_at DESC LIMIT {}",
                lim
            )
        } else {
            "SELECT id, config_id, action, old_data, new_data, reason, created_at
            FROM model_config_history ORDER BY created_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&query)?;

        let history = stmt.query_map([], |row| {
            Ok(ModelConfigHistory {
                id: row.get(0)?,
                config_id: row.get(1)?,
                action: row.get(2)?,
                old_data: row.get(3)?,
                new_data: row.get(4)?,
                reason: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(history)
    }

    /// 清理历史记录（保留最近N条）
    pub fn cleanup_history(&self, keep_count: u32) -> SqliteResult<usize> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let affected = conn.execute(
            "DELETE FROM model_config_history 
            WHERE id NOT IN (
                SELECT id FROM model_config_history 
                ORDER BY created_at DESC LIMIT ?1
            )",
            params![keep_count],
        )?;

        info!("已清理 {} 条历史记录", affected);
        Ok(affected)
    }

    // ==================== 配置验证 ====================

    /// 验证配置
    pub fn validate_config(&self, config: &ModelConfigData) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // 验证 ID
        if config.id.trim().is_empty() {
            errors.push("配置 ID 不能为空".to_string());
        }
        if config.id.len() > 128 {
            errors.push("配置 ID 长度不能超过 128 字符".to_string());
        }

        // 验证名称
        if config.name.trim().is_empty() {
            errors.push("配置名称不能为空".to_string());
        }
        if config.name.len() > 255 {
            errors.push("配置名称长度不能超过 255 字符".to_string());
        }

        // 验证模型 ID
        if config.model_id.trim().is_empty() {
            errors.push("模型 ID 不能为空".to_string());
        }

        // 验证温度参数
        if config.temperature < 0.0 || config.temperature > 2.0 {
            errors.push("温度参数必须在 0.0 到 2.0 之间".to_string());
        }
        if config.temperature > 1.5 {
            warnings.push("温度参数较高，可能导致输出不稳定".to_string());
        }

        // 验证 Top-P 参数
        if config.top_p < 0.0 || config.top_p > 1.0 {
            errors.push("Top-P 参数必须在 0.0 到 1.0 之间".to_string());
        }

        // 验证 Top-K 参数
        if let Some(top_k) = config.top_k {
            if top_k < 1 || top_k > 1000 {
                errors.push("Top-K 参数必须在 1 到 1000 之间".to_string());
            }
        }

        // 验证最大 token 数
        if config.max_tokens == 0 {
            errors.push("最大 token 数必须大于 0".to_string());
        }
        if config.max_tokens > 100000 {
            warnings.push("最大 token 数较大，可能导致请求超时或成本增加".to_string());
        }

        // 验证频率惩罚
        if config.frequency_penalty < -2.0 || config.frequency_penalty > 2.0 {
            errors.push("频率惩罚必须在 -2.0 到 2.0 之间".to_string());
        }

        // 验证存在惩罚
        if config.presence_penalty < -2.0 || config.presence_penalty > 2.0 {
            errors.push("存在惩罚必须在 -2.0 到 2.0 之间".to_string());
        }

        // 验证停止序列
        if config.stop_sequences.len() > 10 {
            warnings.push("停止序列数量较多，可能影响性能".to_string());
        }

        // 验证额外配置 JSON
        if let Some(ref extra) = config.extra_config {
            if serde_json::from_str::<serde_json::Value>(extra).is_err() {
                errors.push("额外配置必须是有效的 JSON 格式".to_string());
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    // ==================== 配置导入导出 ====================

    /// 导出配置为 JSON
    pub fn export_config(&self, config_id: &str) -> SqliteResult<String> {
        let config = self.get_config(config_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        
        serde_json::to_string_pretty(&config)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    }

    /// 导出所有配置为 JSON
    pub fn export_all_configs(&self) -> SqliteResult<String> {
        let configs = self.get_all_configs()?;
        
        serde_json::to_string_pretty(&configs)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    }

    /// 从 JSON 导入配置
    pub fn import_config(&self, json_data: &str) -> SqliteResult<ModelConfigData> {
        let config: ModelConfigData = serde_json::from_str(json_data)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0, 
                rusqlite::types::Type::Text, 
                Box::new(e)
            ))?;
        
        self.save_config(config.clone())?;
        Ok(config)
    }

    /// 批量导入配置
    pub fn import_configs(&self, json_data: &str) -> SqliteResult<Vec<String>> {
        let configs: Vec<ModelConfigData> = serde_json::from_str(json_data)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0, 
                rusqlite::types::Type::Text, 
                Box::new(e)
            ))?;
        
        let mut imported_ids = Vec::new();
        for config in configs {
            match self.save_config(config.clone()) {
                Ok(_) => {
                    imported_ids.push(config.id);
                }
                Err(e) => {
                    warn!("导入配置失败 {}: {}", config.id, e);
                }
            }
        }
        
        Ok(imported_ids)
    }

    // ==================== 辅助方法 ====================

    /// 检查配置是否存在（内部方法，需要传入连接）
    fn config_exists_internal(&self, conn: &Connection, config_id: &str) -> SqliteResult<bool> {
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM model_configs WHERE id = ?1")?;
        let count: i64 = stmt.query_row(params![config_id], |row| row.get(0))?;
        Ok(count > 0)
    }

    /// 获取配置（内部方法）
    fn get_config_by_id_internal(&self, conn: &Connection, config_id: &str) -> SqliteResult<Option<ModelConfigData>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![config_id], |row| {
            self.row_to_config(row)
        });

        match result {
            Ok(config) => Ok(Some(config)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 添加历史记录（内部方法）
    fn add_history_internal(
        &self,
        conn: &Connection,
        config_id: &str,
        action: &str,
        old_data: Option<&ModelConfigData>,
        new_data: Option<&ModelConfigData>,
        reason: Option<&str>,
    ) -> SqliteResult<()> {
        let timestamp = Utc::now().timestamp();
        
        let old_json = old_data.and_then(|d| serde_json::to_string(d).ok());
        let new_json = new_data.and_then(|d| serde_json::to_string(d).ok());

        conn.execute(
            "INSERT INTO model_config_history 
            (config_id, action, old_data, new_data, reason, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                config_id,
                action,
                old_json,
                new_json,
                reason,
                timestamp,
            ],
        )?;

        Ok(())
    }

    /// 将数据库行转换为配置对象
    fn row_to_config(&self, row: &Row) -> SqliteResult<ModelConfigData> {
        let stop_sequences_json: String = row.get(10)?;
        let stop_sequences: Vec<String> = serde_json::from_str(&stop_sequences_json)
            .unwrap_or_default();

        Ok(ModelConfigData {
            id: row.get(0)?,
            name: row.get(1)?,
            model_id: row.get(2)?,
            adapter_id: row.get(3)?,
            temperature: row.get(4)?,
            top_p: row.get(5)?,
            top_k: row.get(6)?,
            max_tokens: row.get(7)?,
            frequency_penalty: row.get(8)?,
            presence_penalty: row.get(9)?,
            stop_sequences,
            is_default: row.get::<_, i32>(11)? != 0,
            is_enabled: row.get::<_, i32>(12)? != 0,
            description: row.get(13)?,
            extra_config: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
        })
    }
}

// ================================
// 默认配置生成器
// ================================

impl ModelConfigData {
    /// 创建默认配置
    pub fn default_config() -> Self {
        Self {
            id: "default".to_string(),
            name: "默认配置".to_string(),
            model_id: "gpt-3.5-turbo".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.7,
            top_p: 0.9,
            top_k: None,
            max_tokens: 2048,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop_sequences: vec![],
            is_default: true,
            is_enabled: true,
            description: Some("默认的聊天模型配置".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }

    /// 创建高创造性配置
    pub fn creative_config() -> Self {
        Self {
            id: "creative".to_string(),
            name: "创造性配置".to_string(),
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 1.2,
            top_p: 0.95,
            top_k: None,
            max_tokens: 4096,
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
            stop_sequences: vec![],
            is_default: false,
            is_enabled: true,
            description: Some("适合创意写作和头脑风暴".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }

    /// 创建精确性配置
    pub fn precise_config() -> Self {
        Self {
            id: "precise".to_string(),
            name: "精确性配置".to_string(),
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            temperature: 0.3,
            top_p: 0.8,
            top_k: None,
            max_tokens: 2048,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop_sequences: vec![],
            is_default: false,
            is_enabled: true,
            description: Some("适合技术问答和精确任务".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::path::PathBuf;
    use r2d2_sqlite::SqliteConnectionManager;
    use r2d2::Pool;

    fn setup_test_db() -> (TempDir, DbPool) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        // Create connection pool
        let manager = SqliteConnectionManager::file(&db_path);
        let pool = Pool::builder()
            .max_size(5)
            .build(manager)
            .unwrap();
        
        // 创建测试表结构
        let conn = pool.get().unwrap();
        conn.execute(
            "CREATE TABLE model_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                adapter_id TEXT,
                temperature REAL NOT NULL,
                top_p REAL NOT NULL,
                top_k INTEGER,
                max_tokens INTEGER NOT NULL,
                frequency_penalty REAL NOT NULL,
                presence_penalty REAL NOT NULL,
                stop_sequences TEXT NOT NULL,
                is_default INTEGER NOT NULL,
                is_enabled INTEGER NOT NULL,
                description TEXT,
                extra_config TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();

        conn.execute(
            "CREATE TABLE model_config_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_data TEXT,
                new_data TEXT,
                reason TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();
        
        drop(conn);

        (temp_dir, pool)
    }

    #[test]
    fn test_save_and_get_config() {
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);

        let config = ModelConfigData::default_config();
        registry.save_config(config.clone()).unwrap();

        let retrieved = registry.get_config(&config.id).unwrap().unwrap();
        assert_eq!(retrieved.id, config.id);
        assert_eq!(retrieved.name, config.name);
        assert_eq!(retrieved.model_id, config.model_id);
    }

    #[test]
    fn test_validation() {
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);

        let mut config = ModelConfigData::default_config();
        config.temperature = 3.0; // 无效值

        let result = registry.validate_config(&config);
        assert!(!result.is_valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_default_config() {
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);

        let config1 = ModelConfigData::default_config();
        let mut config2 = ModelConfigData::creative_config();
        config2.is_default = true;

        registry.save_config(config1).unwrap();
        registry.save_config(config2.clone()).unwrap();

        let default = registry.get_default_config().unwrap().unwrap();
        assert_eq!(default.id, config2.id);
    }

    #[test]
    fn test_export_import() {
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);

        let config = ModelConfigData::default_config();
        registry.save_config(config.clone()).unwrap();

        let exported = registry.export_config(&config.id).unwrap();
        let imported = registry.import_config(&exported).unwrap();

        assert_eq!(imported.id, config.id);
        assert_eq!(imported.name, config.name);
    }
}


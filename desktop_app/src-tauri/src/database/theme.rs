//! # 主题管理数据库模块 (PostgreSQL)
//! 
//! 提供应用主题的数据库存储、查询和管理功能

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use tracing::{info, error, warn, debug};
use crate::database::DbPool;
use tokio::runtime::Handle;

// ================================
// 数据结构定义
// ================================

/// 主题数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: String,
    pub category: String,
    pub variables: serde_json::Value,  // 主题变量（颜色、字体等）
    pub custom_css: Option<String>,
    pub preview_image: Option<String>,
    pub is_dark: bool,
    pub is_default: bool,
    pub installed: bool,
    pub favorited: bool,
    pub download_count: i64,
    pub rating: f64,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            description: None,
            author: None,
            version: "1.0.0".to_string(),
            category: "general".to_string(),
            variables: serde_json::json!({}),
            custom_css: None,
            preview_image: None,
            is_dark: false,
            is_default: false,
            installed: false,
            favorited: false,
            download_count: 0,
            rating: 0.0,
            tags: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

/// 主题数据（仅用于兼容旧的ThemeData结构）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeData {
    pub theme_id: String,
    pub name: String,
    pub colors: HashMap<String, String>,
    pub is_active: bool,
}

/// 主题统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeStatistics {
    pub total_themes: i64,
    pub installed_themes: i64,
    pub favorited_themes: i64,
    pub dark_themes: i64,
    pub light_themes: i64,
    pub categories: HashMap<String, i64>,
}

// ================================
// 主题注册表
// ================================

pub struct ThemeRegistry {
    pool: DbPool,
}

impl ThemeRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建主题表
        client.execute(
            "CREATE TABLE IF NOT EXISTS themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                author TEXT,
                version TEXT NOT NULL DEFAULT '1.0.0',
                category TEXT NOT NULL DEFAULT 'general',
                variables JSONB NOT NULL DEFAULT '{}'::jsonb,
                custom_css TEXT,
                preview_image TEXT,
                is_dark BOOLEAN NOT NULL DEFAULT false,
                is_default BOOLEAN NOT NULL DEFAULT false,
                installed BOOLEAN NOT NULL DEFAULT false,
                favorited BOOLEAN NOT NULL DEFAULT false,
                download_count BIGINT NOT NULL DEFAULT 0,
                rating DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                tags JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建主题设置表（存储当前激活的主题等配置）
        client.execute(
            "CREATE TABLE IF NOT EXISTS theme_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                active_theme_id TEXT,
                last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY (active_theme_id) REFERENCES themes(id) ON DELETE SET NULL
            )",
            &[],
        ).await?;

        // 创建索引
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_installed ON themes(installed)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_favorited ON themes(favorited)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_is_dark ON themes(is_dark)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_download_count ON themes(download_count DESC)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_rating ON themes(rating DESC)",
            &[],
        ).await?;

        // 插入默认设置记录
        client.execute(
            "INSERT INTO theme_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING",
            &[],
        ).await?;

        info!("主题数据库表初始化完成");
        Ok(())
    }

    // ================================
    // 主题CRUD操作
    // ================================

    /// 创建或更新主题
    pub async fn upsert_theme_async(&self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let tags_json = serde_json::to_value(&theme.tags)?;

        client.execute(
            "INSERT INTO themes (
                id, name, description, author, version, category, variables,
                custom_css, preview_image, is_dark, is_default, installed, favorited,
                download_count, rating, tags, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                author = EXCLUDED.author,
                version = EXCLUDED.version,
                category = EXCLUDED.category,
                variables = EXCLUDED.variables,
                custom_css = EXCLUDED.custom_css,
                preview_image = EXCLUDED.preview_image,
                is_dark = EXCLUDED.is_dark,
                is_default = EXCLUDED.is_default,
                download_count = EXCLUDED.download_count,
                rating = EXCLUDED.rating,
                tags = EXCLUDED.tags,
                updated_at = EXCLUDED.updated_at",
            &[
                &theme.id, &theme.name, &theme.description, &theme.author,
                &theme.version, &theme.category, &theme.variables,
                &theme.custom_css, &theme.preview_image, &theme.is_dark,
                &theme.is_default, &theme.installed, &theme.favorited,
                &theme.download_count, &theme.rating, &tags_json,
                &theme.created_at, &theme.updated_at,
            ],
        ).await?;

        debug!("保存主题: {}", theme.name);
        Ok(())
    }

    pub fn upsert_theme(&self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.upsert_theme_async(theme))
    }

    /// 获取主题
    pub async fn get_theme_async(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_opt(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             WHERE id = $1",
            &[&theme_id],
        ).await?;

        if let Some(row) = row {
            let tags_json: serde_json::Value = row.get(15);
            let tags: Vec<String> = serde_json::from_value(tags_json).unwrap_or_default();

            Ok(Some(Theme {
                id: row.get(0),
                name: row.get(1),
                description: row.get(2),
                author: row.get(3),
                version: row.get(4),
                category: row.get(5),
                variables: row.get(6),
                custom_css: row.get(7),
                preview_image: row.get(8),
                is_dark: row.get(9),
                is_default: row.get(10),
                installed: row.get(11),
                favorited: row.get(12),
                download_count: row.get(13),
                rating: row.get(14),
                tags,
                created_at: row.get(16),
                updated_at: row.get(17),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_theme_async(theme_id))
    }

    /// 获取所有主题
    pub async fn get_all_themes_async(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             ORDER BY name ASC",
            &[],
        ).await?;

        let themes = self.rows_to_themes(&rows)?;
        Ok(themes)
    }

    pub fn get_all_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_all_themes_async())
    }

    /// 删除主题
    pub async fn delete_theme_async(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "DELETE FROM themes WHERE id = $1",
            &[&theme_id],
        ).await?;

        info!("删除主题: {}", theme_id);
        Ok(())
    }

    pub fn delete_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.delete_theme_async(theme_id))
    }

    // ================================
    // 主题查询
    // ================================

    /// 搜索主题
    pub async fn search_themes_async(
        &self,
        keyword: Option<&str>,
        category: Option<&str>,
        installed_only: bool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let mut query = String::from(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             WHERE 1=1"
        );

        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = Vec::new();
        let mut param_index = 1;

        // 添加关键字搜索
        if let Some(ref kw) = keyword {
            query.push_str(&format!(" AND (name ILIKE ${} OR description ILIKE ${})", param_index, param_index));
            params.push(kw);
            param_index += 1;
        }

        // 添加分类过滤
        if let Some(ref cat) = category {
            query.push_str(&format!(" AND category = ${}", param_index));
            params.push(cat);
            param_index += 1;
        }

        // 添加已安装过滤
        if installed_only {
            query.push_str(" AND installed = true");
        }

        query.push_str(&format!(" ORDER BY download_count DESC, rating DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));
        params.push(&limit);
        params.push(&offset);

        let rows = client.query(&query, &params).await?;
        let themes = self.rows_to_themes(&rows)?;

        Ok(themes)
    }

    pub fn search_themes(
        &self,
        keyword: Option<&str>,
        category: Option<&str>,
        installed_only: bool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.search_themes_async(keyword, category, installed_only, limit, offset))
    }

    /// 获取已安装的主题
    pub async fn get_installed_themes_async(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             WHERE installed = true
             ORDER BY name ASC",
            &[],
        ).await?;

        let themes = self.rows_to_themes(&rows)?;
        Ok(themes)
    }

    pub fn get_installed_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_installed_themes_async())
    }

    /// 获取收藏的主题
    pub async fn get_favorited_themes_async(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             WHERE favorited = true
             ORDER BY name ASC",
            &[],
        ).await?;

        let themes = self.rows_to_themes(&rows)?;
        Ok(themes)
    }

    pub fn get_favorited_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_favorited_themes_async())
    }

    /// 按分类获取主题
    pub async fn get_themes_by_category_async(&self, category: &str) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, name, description, author, version, category, variables,
                    custom_css, preview_image, is_dark, is_default, installed, favorited,
                    download_count, rating, tags, created_at, updated_at
             FROM themes
             WHERE category = $1
             ORDER BY download_count DESC, rating DESC",
            &[&category],
        ).await?;

        let themes = self.rows_to_themes(&rows)?;
        Ok(themes)
    }

    pub fn get_themes_by_category(&self, category: &str) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_themes_by_category_async(category))
    }

    // ================================
    // 主题状态管理
    // ================================

    /// 标记主题为已安装/未安装
    pub async fn mark_installed_async(&self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE themes SET installed = $1, updated_at = NOW() WHERE id = $2",
            &[&installed, &theme_id],
        ).await?;

        debug!("标记主题 {} 安装状态: {}", theme_id, installed);
        Ok(())
    }

    pub fn mark_installed(&self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.mark_installed_async(theme_id, installed))
    }

    /// 收藏主题
    pub async fn favorite_theme_async(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE themes SET favorited = true, updated_at = NOW() WHERE id = $1",
            &[&theme_id],
        ).await?;

        debug!("收藏主题: {}", theme_id);
        Ok(())
    }

    pub fn favorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.favorite_theme_async(theme_id))
    }

    /// 取消收藏主题
    pub async fn unfavorite_theme_async(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE themes SET favorited = false, updated_at = NOW() WHERE id = $1",
            &[&theme_id],
        ).await?;

        debug!("取消收藏主题: {}", theme_id);
        Ok(())
    }

    pub fn unfavorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.unfavorite_theme_async(theme_id))
    }

    /// 增加下载计数
    pub async fn increment_download_count_async(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE themes SET download_count = download_count + 1, updated_at = NOW() WHERE id = $1",
            &[&theme_id],
        ).await?;

        Ok(())
    }

    pub fn increment_download_count(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.increment_download_count_async(theme_id))
    }

    // ================================
    // 激活主题管理
    // ================================

    /// 获取激活的主题
    pub async fn get_active_theme_async(&self) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_opt(
            "SELECT t.id, t.name, t.description, t.author, t.version, t.category, t.variables,
                    t.custom_css, t.preview_image, t.is_dark, t.is_default, t.installed, t.favorited,
                    t.download_count, t.rating, t.tags, t.created_at, t.updated_at
             FROM theme_settings s
             JOIN themes t ON s.active_theme_id = t.id
             WHERE s.id = 1",
            &[],
        ).await?;

        if let Some(row) = row {
            let tags_json: serde_json::Value = row.get(15);
            let tags: Vec<String> = serde_json::from_value(tags_json).unwrap_or_default();

            Ok(Some(Theme {
                id: row.get(0),
                name: row.get(1),
                description: row.get(2),
                author: row.get(3),
                version: row.get(4),
                category: row.get(5),
                variables: row.get(6),
                custom_css: row.get(7),
                preview_image: row.get(8),
                is_dark: row.get(9),
                is_default: row.get(10),
                installed: row.get(11),
                favorited: row.get(12),
                download_count: row.get(13),
                rating: row.get(14),
                tags,
                created_at: row.get(16),
                updated_at: row.get(17),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_active_theme(&self) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_active_theme_async())
    }

    /// 设置激活的主题
    pub async fn set_active_theme_async(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 检查主题是否存在
        let theme = self.get_theme_async(theme_id).await?;
        if theme.is_none() {
            return Err(format!("主题不存在: {}", theme_id).into());
        }

        // 更新激活主题
        client.execute(
            "UPDATE theme_settings SET active_theme_id = $1, last_updated = NOW() WHERE id = 1",
            &[&theme_id],
        ).await?;

        info!("设置激活主题: {}", theme_id);
        Ok(())
    }

    pub fn set_active_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.set_active_theme_async(theme_id))
    }

    // ================================
    // 统计信息
    // ================================

    /// 获取统计信息
    pub async fn get_statistics_async(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 总主题数
        let row = client.query_one("SELECT COUNT(*) FROM themes", &[]).await?;
        let total_themes: i64 = row.get(0);

        // 已安装主题数
        let row = client.query_one("SELECT COUNT(*) FROM themes WHERE installed = true", &[]).await?;
        let installed_themes: i64 = row.get(0);

        // 收藏主题数
        let row = client.query_one("SELECT COUNT(*) FROM themes WHERE favorited = true", &[]).await?;
        let favorited_themes: i64 = row.get(0);

        // 深色主题数
        let row = client.query_one("SELECT COUNT(*) FROM themes WHERE is_dark = true", &[]).await?;
        let dark_themes: i64 = row.get(0);

        // 浅色主题数
        let row = client.query_one("SELECT COUNT(*) FROM themes WHERE is_dark = false", &[]).await?;
        let light_themes: i64 = row.get(0);

        // 分类统计
        let rows = client.query("SELECT category, COUNT(*) FROM themes GROUP BY category", &[]).await?;
        let mut categories = HashMap::new();
        for row in rows {
            let category: String = row.get(0);
            let count: i64 = row.get(1);
            categories.insert(category, count);
        }

        Ok(ThemeStatistics {
            total_themes,
            installed_themes,
            favorited_themes,
            dark_themes,
            light_themes,
            categories,
        })
    }

    pub fn get_statistics(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_statistics_async())
    }

    // ================================
    // 辅助方法
    // ================================

    /// 将数据库行转换为Theme对象
    fn rows_to_themes(&self, rows: &[tokio_postgres::Row]) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        let themes = rows.iter().map(|row| {
            let tags_json: serde_json::Value = row.get(15);
            let tags: Vec<String> = serde_json::from_value(tags_json).unwrap_or_default();

            Theme {
                id: row.get(0),
                name: row.get(1),
                description: row.get(2),
                author: row.get(3),
                version: row.get(4),
                category: row.get(5),
                variables: row.get(6),
                custom_css: row.get(7),
                preview_image: row.get(8),
                is_dark: row.get(9),
                is_default: row.get(10),
                installed: row.get(11),
                favorited: row.get(12),
                download_count: row.get(13),
                rating: row.get(14),
                tags,
                created_at: row.get(16),
                updated_at: row.get(17),
            }
        }).collect();

        Ok(themes)
    }

    /// 将主题转换为ThemeData（兼容旧接口）
    pub fn theme_to_theme_data(theme: &Theme) -> ThemeData {
        let colors = if let Some(obj) = theme.variables.as_object() {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        } else {
            HashMap::new()
        };

        ThemeData {
            theme_id: theme.id.clone(),
            name: theme.name.clone(),
            colors,
            is_active: false, // 需要单独查询
        }
    }
}

// ================================
// ThemeDatabase - 兼容性包装器
// ================================

/// 兼容旧版本的数据库包装器
pub struct ThemeDatabase {
    registry: ThemeRegistry,
}

impl ThemeDatabase {
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // 注意：这里假设全局DbPool已经初始化
        // 实际使用时，应该从应用状态中获取pool
        Err("请使用ThemeRegistry，并传入DbPool".into())
    }

    pub fn from_pool(pool: DbPool) -> Self {
        Self {
            registry: ThemeRegistry::new(pool),
        }
    }

    pub fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_theme(theme_id)
    }

    pub fn upsert_theme(&self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.upsert_theme(theme)
    }

    pub fn search_themes(
        &self,
        keyword: Option<&str>,
        category: Option<&str>,
        installed_only: bool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.search_themes(keyword, category, installed_only, limit, offset)
    }

    pub fn get_installed_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_installed_themes()
    }

    pub fn get_favorited_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_favorited_themes()
    }

    pub fn mark_installed(&self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.mark_installed(theme_id, installed)
    }

    pub fn favorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.favorite_theme(theme_id)
    }

    pub fn unfavorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.unfavorite_theme(theme_id)
    }

    pub fn get_statistics(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_statistics()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use chrono::Utc;

    // 创建测试用的简单模拟池
    fn create_mock_pool() -> DbPool {
        use deadpool_postgres::{Config as PoolConfig, Manager, ManagerConfig, RecyclingMethod, Runtime, Pool};
        use tokio_postgres::NoTls;
        
        // 创建一个简单的模拟配置，但不实际连接数据库
        let mut cfg = PoolConfig::new();
        cfg.host = Some("localhost".to_string());
        cfg.port = Some(5432);
        cfg.dbname = Some("test_db".to_string());
        cfg.user = Some("test_user".to_string());
        cfg.password = Some("test_password".to_string());
        
        // 创建管理器配置
        let mgr_config = ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        };
        
        // 这只是为了测试结构，实际不会连接数据库
        let manager = Manager::from_config(cfg.get_pg_config().unwrap(), NoTls, mgr_config);
        Pool::builder(manager)
            .max_size(1)
            .build()
            .unwrap()
    }

    // 创建测试用的Theme
    fn create_test_theme(id: &str, name: &str) -> Theme {
        Theme {
            id: id.to_string(),
            name: name.to_string(),
            description: Some("测试主题".to_string()),
            author: Some("测试作者".to_string()),
            version: "1.0.0".to_string(),
            category: "general".to_string(),
            variables: serde_json::json!({
                "primary_color": "#007bff",
                "secondary_color": "#6c757d"
            }),
            custom_css: Some("body { background: #fff; }".to_string()),
            preview_image: Some("/path/to/preview.png".to_string()),
            is_dark: false,
            is_default: false,
            installed: true,
            favorited: false,
            download_count: 100,
            rating: 4.5,
            tags: vec!["modern".to_string(), "clean".to_string()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_theme_default() {
        let theme = Theme::default();
        
        assert!(theme.id.is_empty());
        assert!(theme.name.is_empty());
        assert_eq!(theme.version, "1.0.0");
        assert_eq!(theme.category, "general");
        assert_eq!(theme.variables, serde_json::json!({}));
        assert_eq!(theme.is_dark, false);
        assert_eq!(theme.is_default, false);
        assert_eq!(theme.installed, false);
        assert_eq!(theme.favorited, false);
        assert_eq!(theme.download_count, 0);
        assert_eq!(theme.rating, 0.0);
        assert!(theme.tags.is_empty());
    }

    #[tokio::test]
    async fn test_theme_creation() {
        let theme = create_test_theme("test-theme", "测试主题");
        
        assert_eq!(theme.id, "test-theme");
        assert_eq!(theme.name, "测试主题");
        assert_eq!(theme.description, Some("测试主题".to_string()));
        assert_eq!(theme.author, Some("测试作者".to_string()));
        assert_eq!(theme.version, "1.0.0");
        assert_eq!(theme.category, "general");
        assert_eq!(theme.is_dark, false);
        assert_eq!(theme.installed, true);
        assert_eq!(theme.favorited, false);
        assert_eq!(theme.download_count, 100);
        assert_eq!(theme.rating, 4.5);
        assert_eq!(theme.tags, vec!["modern", "clean"]);
    }

    #[tokio::test]
    async fn test_theme_data_creation() {
        let theme_data = ThemeData {
            theme_id: "test-id".to_string(),
            name: "测试主题".to_string(),
            colors: {
                let mut colors = HashMap::new();
                colors.insert("primary".to_string(), "#007bff".to_string());
                colors.insert("secondary".to_string(), "#6c757d".to_string());
                colors
            },
            is_active: true,
        };

        assert_eq!(theme_data.theme_id, "test-id");
        assert_eq!(theme_data.name, "测试主题");
        assert_eq!(theme_data.is_active, true);
        assert!(theme_data.colors.contains_key("primary"));
        assert_eq!(theme_data.colors.get("primary"), Some(&"#007bff".to_string()));
    }

    #[tokio::test]
    async fn test_theme_statistics_creation() {
        let stats = ThemeStatistics {
            total_themes: 10,
            installed_themes: 5,
            favorited_themes: 3,
            dark_themes: 4,
            light_themes: 6,
            categories: {
                let mut categories = HashMap::new();
                categories.insert("general".to_string(), 5);
                categories.insert("modern".to_string(), 3);
                categories.insert("classic".to_string(), 2);
                categories
            },
        };

        assert_eq!(stats.total_themes, 10);
        assert_eq!(stats.installed_themes, 5);
        assert_eq!(stats.favorited_themes, 3);
        assert_eq!(stats.dark_themes, 4);
        assert_eq!(stats.light_themes, 6);
        assert_eq!(stats.categories.len(), 3);
        assert_eq!(stats.categories.get("general"), Some(&5));
    }

    #[tokio::test]
    async fn test_theme_registry_new() {
        let pool = create_mock_pool();
        let registry = ThemeRegistry::new(pool);
        
        // 验证注册表创建成功
        assert!(true); // 创建成功就是测试通过
    }

    #[tokio::test]
    async fn test_theme_serialization() {
        let theme = create_test_theme("test-theme", "测试主题");

        let json = serde_json::to_string(&theme).unwrap();
        let deserialized: Theme = serde_json::from_str(&json).unwrap();

        assert_eq!(theme.id, deserialized.id);
        assert_eq!(theme.name, deserialized.name);
        assert_eq!(theme.version, deserialized.version);
        assert_eq!(theme.category, deserialized.category);
        assert_eq!(theme.is_dark, deserialized.is_dark);
        assert_eq!(theme.installed, deserialized.installed);
        assert_eq!(theme.download_count, deserialized.download_count);
        assert_eq!(theme.rating, deserialized.rating);
        assert_eq!(theme.tags, deserialized.tags);
    }

    #[tokio::test]
    async fn test_theme_data_serialization() {
        let theme_data = ThemeData {
            theme_id: "test-id".to_string(),
            name: "测试主题".to_string(),
            colors: {
                let mut colors = HashMap::new();
                colors.insert("primary".to_string(), "#007bff".to_string());
                colors
            },
            is_active: false,
        };

        let json = serde_json::to_string(&theme_data).unwrap();
        let deserialized: ThemeData = serde_json::from_str(&json).unwrap();

        assert_eq!(theme_data.theme_id, deserialized.theme_id);
        assert_eq!(theme_data.name, deserialized.name);
        assert_eq!(theme_data.is_active, deserialized.is_active);
        assert_eq!(theme_data.colors, deserialized.colors);
    }

    #[tokio::test]
    async fn test_theme_statistics_serialization() {
        let stats = ThemeStatistics {
            total_themes: 10,
            installed_themes: 5,
            favorited_themes: 3,
            dark_themes: 4,
            light_themes: 6,
            categories: HashMap::new(),
        };

        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: ThemeStatistics = serde_json::from_str(&json).unwrap();

        assert_eq!(stats.total_themes, deserialized.total_themes);
        assert_eq!(stats.installed_themes, deserialized.installed_themes);
        assert_eq!(stats.favorited_themes, deserialized.favorited_themes);
        assert_eq!(stats.dark_themes, deserialized.dark_themes);
        assert_eq!(stats.light_themes, deserialized.light_themes);
    }

    #[tokio::test]
    async fn test_theme_variables_json() {
        let mut theme = Theme::default();
        
        // 测试空JSON对象
        assert_eq!(theme.variables, serde_json::json!({}));
        
        // 测试设置复杂的JSON变量
        theme.variables = serde_json::json!({
            "colors": {
                "primary": "#007bff",
                "secondary": "#6c757d",
                "success": "#28a745"
            },
            "fonts": {
                "primary": "Arial, sans-serif",
                "monospace": "Monaco, monospace"
            },
            "sizes": {
                "base": 16,
                "scale": 1.2
            }
        });

        // 验证JSON结构
        assert!(theme.variables.is_object());
        let colors = &theme.variables["colors"];
        assert!(colors.is_object());
        assert_eq!(colors["primary"], "#007bff");

        let fonts = &theme.variables["fonts"];
        assert_eq!(fonts["primary"], "Arial, sans-serif");

        let sizes = &theme.variables["sizes"];
        assert_eq!(sizes["base"], 16);
        assert_eq!(sizes["scale"], 1.2);
    }

    #[tokio::test]
    async fn test_theme_tags_handling() {
        let mut theme = Theme::default();
        
        // 测试空标签
        assert!(theme.tags.is_empty());
        
        // 测试添加标签
        theme.tags = vec![
            "modern".to_string(),
            "dark".to_string(),
            "minimal".to_string(),
        ];
        assert_eq!(theme.tags.len(), 3);
        assert!(theme.tags.contains(&"modern".to_string()));
        assert!(theme.tags.contains(&"dark".to_string()));
        assert!(theme.tags.contains(&"minimal".to_string()));
        
        // 测试重复标签
        theme.tags.push("modern".to_string());
        assert_eq!(theme.tags.len(), 4);
        
        // 测试空字符串标签
        theme.tags.push("".to_string());
        assert_eq!(theme.tags.len(), 5);
        assert!(theme.tags.contains(&"".to_string()));
    }

    #[tokio::test]
    async fn test_theme_boundary_values() {
        let mut theme = Theme::default();
        
        // 测试下载计数边界值
        theme.download_count = 0;
        assert_eq!(theme.download_count, 0);
        
        theme.download_count = i64::MAX;
        assert_eq!(theme.download_count, i64::MAX);
        
        // 测试评分边界值
        theme.rating = 0.0;
        assert_eq!(theme.rating, 0.0);
        
        theme.rating = 5.0;
        assert_eq!(theme.rating, 5.0);
        
        theme.rating = -1.0; // 虽然业务上不合理，但测试数据类型边界
        assert_eq!(theme.rating, -1.0);
        
        theme.rating = f64::MAX;
        assert_eq!(theme.rating, f64::MAX);
    }

    #[tokio::test]
    async fn test_theme_string_fields_validation() {
        let mut theme = Theme::default();
        
        // 测试ID字段
        theme.id = "".to_string();
        assert_eq!(theme.id, "");
        
        theme.id = "a".repeat(1000); // 长字符串
        assert_eq!(theme.id.len(), 1000);
        
        // 测试名称字段
        theme.name = "主题名称".to_string();
        assert_eq!(theme.name, "主题名称");
        
        // 测试特殊字符
        theme.name = "Theme-Name_123!@#$%".to_string();
        assert_eq!(theme.name, "Theme-Name_123!@#$%");
        
        // 测试版本字段
        theme.version = "1.0.0".to_string();
        assert_eq!(theme.version, "1.0.0");
        
        theme.version = "2.1.0-beta.1".to_string();
        assert_eq!(theme.version, "2.1.0-beta.1");
        
        // 测试分类字段
        theme.category = "custom-category".to_string();
        assert_eq!(theme.category, "custom-category");
    }

    #[tokio::test]
    async fn test_theme_optional_fields() {
        let mut theme = Theme::default();
        
        // 测试描述字段
        assert_eq!(theme.description, None);
        
        theme.description = Some("".to_string());
        assert_eq!(theme.description, Some("".to_string()));
        
        theme.description = Some("一个很长的描述".repeat(100));
        assert!(theme.description.unwrap().len() > 500);
        
        // 测试作者字段
        theme.author = Some("作者名称".to_string());
        assert_eq!(theme.author, Some("作者名称".to_string()));
        
        theme.author = None;
        assert_eq!(theme.author, None);
        
        // 测试自定义CSS
        theme.custom_css = Some("body { color: red; }".to_string());
        assert!(theme.custom_css.unwrap().contains("color: red"));
        
        // 测试预览图片
        theme.preview_image = Some("/path/to/image.png".to_string());
        assert!(theme.preview_image.unwrap().ends_with(".png"));
    }

    #[tokio::test]
    async fn test_theme_boolean_fields() {
        let mut theme = Theme::default();
        
        // 测试默认布尔值
        assert_eq!(theme.is_dark, false);
        assert_eq!(theme.is_default, false);
        assert_eq!(theme.installed, false);
        assert_eq!(theme.favorited, false);
        
        // 测试设置为true
        theme.is_dark = true;
        theme.is_default = true;
        theme.installed = true;
        theme.favorited = true;
        
        assert_eq!(theme.is_dark, true);
        assert_eq!(theme.is_default, true);
        assert_eq!(theme.installed, true);
        assert_eq!(theme.favorited, true);
    }

    #[tokio::test]
    async fn test_theme_to_theme_data_conversion() {
        let theme = create_test_theme("test-theme", "测试主题");
        let theme_data = ThemeRegistry::theme_to_theme_data(&theme);
        
        assert_eq!(theme_data.theme_id, theme.id);
        assert_eq!(theme_data.name, theme.name);
        assert_eq!(theme_data.is_active, false); // 默认为false
        
        // 验证颜色转换
        assert!(theme_data.colors.contains_key("primary_color"));
        assert_eq!(theme_data.colors.get("primary_color"), Some(&"#007bff".to_string()));
    }

    #[tokio::test]
    async fn test_theme_data_colors_handling() {
        let mut colors = HashMap::new();
        colors.insert("bg".to_string(), "#ffffff".to_string());
        colors.insert("fg".to_string(), "#000000".to_string());
        colors.insert("accent".to_string(), "#007bff".to_string());
        
        let theme_data = ThemeData {
            theme_id: "color-test".to_string(),
            name: "颜色测试主题".to_string(),
            colors: colors.clone(),
            is_active: false,
        };
        
        assert_eq!(theme_data.colors.len(), 3);
        assert!(theme_data.colors.contains_key("bg"));
        assert!(theme_data.colors.contains_key("fg"));
        assert!(theme_data.colors.contains_key("accent"));
        
        // 测试颜色值格式
        assert!(theme_data.colors["bg"].starts_with("#"));
        assert_eq!(theme_data.colors["bg"].len(), 7); // #RRGGBB格式
    }

    #[tokio::test]
    async fn test_clone_implementations() {
        let theme = create_test_theme("clone-test", "克隆测试");
        let cloned_theme = theme.clone();
        
        assert_eq!(theme.id, cloned_theme.id);
        assert_eq!(theme.name, cloned_theme.name);
        assert_eq!(theme.variables, cloned_theme.variables);
        assert_eq!(theme.tags, cloned_theme.tags);
        
        let theme_data = ThemeData {
            theme_id: "test".to_string(),
            name: "test".to_string(),
            colors: HashMap::new(),
            is_active: false,
        };
        let cloned_data = theme_data.clone();
        assert_eq!(theme_data.theme_id, cloned_data.theme_id);
        
        let stats = ThemeStatistics {
            total_themes: 5,
            installed_themes: 3,
            favorited_themes: 1,
            dark_themes: 2,
            light_themes: 3,
            categories: HashMap::new(),
        };
        let cloned_stats = stats.clone();
        assert_eq!(stats.total_themes, cloned_stats.total_themes);
    }

    #[tokio::test]
    async fn test_debug_implementations() {
        let theme = create_test_theme("debug-test", "调试测试");
        let debug_str = format!("{:?}", theme);
        assert!(debug_str.contains("Theme"));
        assert!(debug_str.contains("debug-test"));
        
        let theme_data = ThemeData {
            theme_id: "debug".to_string(),
            name: "Debug Theme".to_string(),
            colors: HashMap::new(),
            is_active: true,
        };
        let debug_str = format!("{:?}", theme_data);
        assert!(debug_str.contains("ThemeData"));
        assert!(debug_str.contains("debug"));
        
        let stats = ThemeStatistics {
            total_themes: 1,
            installed_themes: 1,
            favorited_themes: 0,
            dark_themes: 0,
            light_themes: 1,
            categories: HashMap::new(),
        };
        let debug_str = format!("{:?}", stats);
        assert!(debug_str.contains("ThemeStatistics"));
    }

    #[tokio::test]
    async fn test_theme_database_error_handling() {
        // 测试ThemeDatabase::new应该返回错误
        let temp_dir = std::env::temp_dir();
        let result = ThemeDatabase::new(&temp_dir);
        assert!(result.is_err());
        
        let error_message = result.err().unwrap().to_string();
        assert!(error_message.contains("请使用ThemeRegistry"));
    }

    // 性能测试：大量标签处理
    #[tokio::test]
    async fn test_large_tags_performance() {
        let mut theme = Theme::default();
        
        // 创建1000个标签
        let large_tags: Vec<String> = (0..1000)
            .map(|i| format!("tag_{}", i))
            .collect();
        
        theme.tags = large_tags.clone();
        assert_eq!(theme.tags.len(), 1000);
        
        // 测试序列化性能（基本验证）
        let json_result = serde_json::to_string(&theme);
        assert!(json_result.is_ok());
        
        // 测试反序列化
        let json = json_result.unwrap();
        let deserialized_result: Result<Theme, _> = serde_json::from_str(&json);
        assert!(deserialized_result.is_ok());
        
        let deserialized = deserialized_result.unwrap();
        assert_eq!(deserialized.tags.len(), 1000);
        assert_eq!(deserialized.tags, large_tags);
    }

    // 边界条件测试：空主题
    #[tokio::test]
    async fn test_minimal_theme() {
        let minimal_theme = Theme {
            id: "min".to_string(),
            name: "M".to_string(),
            ..Theme::default()
        };
        
        assert_eq!(minimal_theme.id, "min");
        assert_eq!(minimal_theme.name, "M");
        assert_eq!(minimal_theme.description, None);
        assert_eq!(minimal_theme.author, None);
        assert_eq!(minimal_theme.custom_css, None);
        assert_eq!(minimal_theme.preview_image, None);
        assert!(minimal_theme.tags.is_empty());
        assert_eq!(minimal_theme.download_count, 0);
        assert_eq!(minimal_theme.rating, 0.0);
    }
}

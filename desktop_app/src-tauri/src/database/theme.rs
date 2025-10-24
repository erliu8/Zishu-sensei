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

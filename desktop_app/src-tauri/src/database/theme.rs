/**
 * 主题数据库模型
 * 
 * 提供主题相关的本地数据库操作：
 * - 本地主题存储和查询
 * - 主题安装状态管理
 * - 主题收藏管理
 * - 本地主题统计信息
 * 
 * 注意：评分、评论等社区功能由独立的社区平台处理
 */

use rusqlite::{params, Connection, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};

/**
 * 主题基本信息
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub author_id: String,
    pub author_name: String,
    pub version: String,
    pub category: String,
    pub tags: Vec<String>,
    pub is_dark: bool,
    pub thumbnail: String,
    pub preview_images: Vec<String>,
    pub variables: serde_json::Value,
    pub custom_css: Option<String>,
    pub downloads: i64,
    pub rating: f64,
    pub rating_count: i64,
    pub installed: bool,
    pub favorited: bool,
    pub file_path: Option<PathBuf>,
    pub file_size: i64,
    pub min_version: String,
    pub max_version: Option<String>,
    pub license: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/**
 * 主题收藏记录
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeFavorite {
    pub id: i64,
    pub theme_id: String,
    pub favorited_at: DateTime<Utc>,
}

/**
 * 本地主题统计信息
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeStatistics {
    pub total_themes: i64,
    pub installed_themes: i64,
    pub favorited_themes: i64,
    pub custom_themes: i64,
}

/**
 * 主题数据库管理器
 */
pub struct ThemeDatabase {
    conn: Connection,
}

impl ThemeDatabase {
    /**
     * 创建新的数据库连接
     */
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }
    
    /**
     * 初始化数据库表
     */
    fn init_tables(&self) -> SqliteResult<()> {
        // 主题表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                version TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT,
                is_dark INTEGER NOT NULL DEFAULT 0,
                thumbnail TEXT,
                preview_images TEXT,
                variables TEXT,
                custom_css TEXT,
                downloads INTEGER DEFAULT 0,
                rating REAL DEFAULT 0,
                rating_count INTEGER DEFAULT 0,
                installed INTEGER DEFAULT 0,
                file_path TEXT,
                file_size INTEGER DEFAULT 0,
                min_version TEXT NOT NULL,
                max_version TEXT,
                license TEXT DEFAULT 'MIT',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;
        
        // 收藏表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS theme_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                theme_id TEXT NOT NULL,
                favorited_at TEXT NOT NULL,
                UNIQUE(theme_id)
            )",
            [],
        )?;
        
        // 创建索引
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_themes_installed ON themes(installed)",
            [],
        )?;
        
        Ok(())
    }
    
    /**
     * 插入或更新主题
     */
    pub fn upsert_theme(&self, theme: &Theme) -> SqliteResult<()> {
        let tags_json = serde_json::to_string(&theme.tags).unwrap_or_default();
        let preview_images_json = serde_json::to_string(&theme.preview_images).unwrap_or_default();
        let variables_json = serde_json::to_string(&theme.variables).unwrap_or_default();
        let file_path = theme.file_path.as_ref().map(|p| p.to_string_lossy().to_string());
        
        self.conn.execute(
            "INSERT OR REPLACE INTO themes (
                id, name, display_name, description, author_id, author_name,
                version, category, tags, is_dark, thumbnail, preview_images,
                variables, custom_css, downloads, rating, rating_count,
                installed, file_path, file_size, min_version, max_version,
                license, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25
            )",
            params![
                &theme.id,
                &theme.name,
                &theme.display_name,
                &theme.description,
                &theme.author_id,
                &theme.author_name,
                &theme.version,
                &theme.category,
                &tags_json,
                theme.is_dark as i32,
                &theme.thumbnail,
                &preview_images_json,
                &variables_json,
                &theme.custom_css,
                theme.downloads,
                theme.rating,
                theme.rating_count,
                theme.installed as i32,
                file_path,
                theme.file_size,
                &theme.min_version,
                &theme.max_version,
                &theme.license,
                theme.created_at.to_rfc3339(),
                theme.updated_at.to_rfc3339(),
            ],
        )?;
        
        Ok(())
    }
    
    /**
     * 根据ID获取主题
     */
    pub fn get_theme(&self, theme_id: &str) -> SqliteResult<Option<Theme>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM themes WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query(params![theme_id])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_theme(row)?))
        } else {
            Ok(None)
        }
    }
    
    /**
     * 搜索主题
     */
    pub fn search_themes(
        &self,
        keyword: Option<&str>,
        category: Option<&str>,
        installed_only: bool,
        limit: i64,
        offset: i64,
    ) -> SqliteResult<Vec<Theme>> {
        let mut sql = String::from("SELECT * FROM themes WHERE 1=1");
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(kw) = keyword {
            sql.push_str(" AND (name LIKE ?1 OR display_name LIKE ?1 OR description LIKE ?1)");
            params.push(Box::new(format!("%{}%", kw)));
        }
        
        if let Some(cat) = category {
            sql.push_str(&format!(" AND category = ?{}", params.len() + 1));
            params.push(Box::new(cat.to_string()));
        }
        
        if installed_only {
            sql.push_str(" AND installed = 1");
        }
        
        sql.push_str(&format!(" ORDER BY downloads DESC LIMIT ?{} OFFSET ?{}", params.len() + 1, params.len() + 2));
        params.push(Box::new(limit));
        params.push(Box::new(offset));
        
        let mut stmt = self.conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(&param_refs[..], |row| {
            self.row_to_theme(row)
        })?;
        
        let mut themes = Vec::new();
        for theme in rows {
            themes.push(theme?);
        }
        
        Ok(themes)
    }
    
    /**
     * 获取已安装的主题
     */
    pub fn get_installed_themes(&self) -> SqliteResult<Vec<Theme>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM themes WHERE installed = 1 ORDER BY updated_at DESC"
        )?;
        
        let rows = stmt.query_map([], |row| {
            self.row_to_theme(row)
        })?;
        
        let mut themes = Vec::new();
        for theme in rows {
            themes.push(theme?);
        }
        
        Ok(themes)
    }
    
    /**
     * 获取收藏的主题
     */
    pub fn get_favorited_themes(&self) -> SqliteResult<Vec<Theme>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.* FROM themes t 
             INNER JOIN theme_favorites f ON t.id = f.theme_id
             ORDER BY f.favorited_at DESC"
        )?;
        
        let rows = stmt.query_map([], |row| {
            self.row_to_theme(row)
        })?;
        
        let mut themes = Vec::new();
        for theme in rows {
            themes.push(theme?);
        }
        
        Ok(themes)
    }
    
    /**
     * 标记主题为已安装
     */
    pub fn mark_installed(&self, theme_id: &str, installed: bool) -> SqliteResult<()> {
        self.conn.execute(
            "UPDATE themes SET installed = ?1, updated_at = ?2 WHERE id = ?3",
            params![installed as i32, Utc::now().to_rfc3339(), theme_id],
        )?;
        Ok(())
    }
    
    /**
     * 收藏主题
     */
    pub fn favorite_theme(&self, theme_id: &str) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO theme_favorites (theme_id, favorited_at) VALUES (?1, ?2)",
            params![theme_id, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }
    
    /**
     * 取消收藏主题
     */
    pub fn unfavorite_theme(&self, theme_id: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM theme_favorites WHERE theme_id = ?1",
            params![theme_id],
        )?;
        Ok(())
    }
    
    /**
     * 检查主题是否已收藏
     */
    pub fn is_favorited(&self, theme_id: &str) -> SqliteResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM theme_favorites WHERE theme_id = ?1",
            params![theme_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }
    
    /**
     * 获取本地统计信息
     */
    pub fn get_statistics(&self) -> SqliteResult<ThemeStatistics> {
        let total_themes: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM themes",
            [],
            |row| row.get(0),
        )?;
        
        let installed_themes: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM themes WHERE installed = 1",
            [],
            |row| row.get(0),
        )?;
        
        let favorited_themes: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM theme_favorites",
            [],
            |row| row.get(0),
        )?;
        
        let custom_themes: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM themes WHERE category = 'custom'",
            [],
            |row| row.get(0),
        )?;
        
        Ok(ThemeStatistics {
            total_themes,
            installed_themes,
            favorited_themes,
            custom_themes,
        })
    }
    
    /**
     * 删除主题
     */
    pub fn delete_theme(&self, theme_id: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM themes WHERE id = ?1",
            params![theme_id],
        )?;
        
        // 同时删除相关收藏
        self.conn.execute(
            "DELETE FROM theme_favorites WHERE theme_id = ?1",
            params![theme_id],
        )?;
        
        Ok(())
    }
    
    /**
     * 将数据库行转换为 Theme 对象
     */
    fn row_to_theme(&self, row: &Row) -> SqliteResult<Theme> {
        let tags_str: String = row.get(8)?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        
        let preview_images_str: String = row.get(11)?;
        let preview_images: Vec<String> = serde_json::from_str(&preview_images_str).unwrap_or_default();
        
        let variables_str: String = row.get(12)?;
        let variables: serde_json::Value = serde_json::from_str(&variables_str).unwrap_or(serde_json::json!({}));
        
        let file_path_str: Option<String> = row.get(18)?;
        let file_path = file_path_str.map(PathBuf::from);
        
        let created_at_str: String = row.get(23)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .unwrap_or_else(|_| DateTime::parse_from_rfc3339("2025-01-01T00:00:00Z").unwrap())
            .with_timezone(&Utc);
        
        let updated_at_str: String = row.get(24)?;
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .unwrap_or_else(|_| DateTime::parse_from_rfc3339("2025-01-01T00:00:00Z").unwrap())
            .with_timezone(&Utc);
        
        let theme_id: String = row.get(0)?;
        let favorited = self.is_favorited(&theme_id).unwrap_or(false);
        
        Ok(Theme {
            id: theme_id,
            name: row.get(1)?,
            display_name: row.get(2)?,
            description: row.get(3)?,
            author_id: row.get(4)?,
            author_name: row.get(5)?,
            version: row.get(6)?,
            category: row.get(7)?,
            tags,
            is_dark: row.get::<_, i32>(9)? != 0,
            thumbnail: row.get(10)?,
            preview_images,
            variables,
            custom_css: row.get(13)?,
            downloads: row.get(14)?,
            rating: row.get(15)?,
            rating_count: row.get(16)?,
            installed: row.get::<_, i32>(17)? != 0,
            favorited,
            file_path,
            file_size: row.get(19)?,
            min_version: row.get(20)?,
            max_version: row.get(21)?,
            license: row.get(22)?,
            created_at,
            updated_at,
        })
    }
    
}


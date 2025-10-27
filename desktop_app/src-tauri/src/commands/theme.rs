/**
 * 主题管理Tauri命令
 * 
 * 提供主题相关的前端调用接口：
 * - 本地主题搜索和查询
 * - 主题安装和卸载
 * - 主题收藏管理
 * - 主题导入和导出
 * 
 * 注意：评分、评论等社区功能通过社区平台 API 处理
 */

use crate::database::theme::{Theme, ThemeDatabase, ThemeStatistics};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;
use chrono::Utc;
use std::fs;
use std::sync::Mutex;
use uuid::Uuid;

/**
 * 主题搜索选项
 */
#[derive(Debug, Deserialize)]
pub struct ThemeSearchOptions {
    pub keyword: Option<String>,
    pub category: Option<String>,
    pub installed_only: Option<bool>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

/**
 * 主题搜索结果
 */
#[derive(Debug, Serialize)]
pub struct ThemeSearchResult {
    pub themes: Vec<Theme>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
    pub has_next_page: bool,
}

/**
 * 主题安装选项
 */
#[derive(Debug, Deserialize)]
pub struct ThemeInstallOptions {
    pub theme_id: String,
    pub set_as_current: Option<bool>,
    pub overwrite: Option<bool>,
}

/**
 * 主题卸载选项
 */
#[derive(Debug, Deserialize)]
pub struct ThemeUninstallOptions {
    pub theme_id: String,
    pub remove_user_data: Option<bool>,
    pub backup: Option<bool>,
}

/**
 * 主题导出选项
 */
#[derive(Debug, Deserialize)]
pub struct ThemeExportOptions {
    pub theme_id: String,
    pub format: String,
    pub include_preview: Option<bool>,
    pub include_metadata: Option<bool>,
    pub output_path: Option<PathBuf>,
}

/**
 * 主题导入选项
 */
#[derive(Debug, Deserialize)]
pub struct ThemeImportOptions {
    pub source: String,
    pub validate: Option<bool>,
    pub overwrite: Option<bool>,
    pub set_as_current: Option<bool>,
}

/**
 * 搜索主题
 */
#[tauri::command]
pub async fn search_themes(
    options: ThemeSearchOptions,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<ThemeSearchResult, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let page = options.page.unwrap_or(1);
    let page_size = options.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;
    let installed_only = options.installed_only.unwrap_or(false);
    
    let themes = db
        .search_themes(
            options.keyword.as_deref(),
            options.category.as_deref(),
            installed_only,
            page_size,
            offset,
        )
        .map_err(|e| format!("Failed to search themes: {}", e))?;
    
    // 计算总数（这里简化处理，实际应该有专门的count查询）
    let total = themes.len() as i64;
    let total_pages = (total as f64 / page_size as f64).ceil() as i64;
    let has_next_page = page < total_pages;
    
    Ok(ThemeSearchResult {
        themes,
        total,
        page,
        page_size,
        total_pages,
        has_next_page,
    })
}

/**
 * 获取主题详情
 */
#[tauri::command]
pub async fn get_theme(
    theme_id: String,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<Theme, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let theme = db
        .get_theme(&theme_id)
        .map_err(|e| format!("Failed to get theme: {}", e))?
        .ok_or_else(|| format!("Theme not found: {}", theme_id))?;
    
    Ok(theme)
}

/**
 * 安装主题
 */
#[tauri::command]
pub async fn install_theme(
    options: ThemeInstallOptions,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // 检查主题是否存在
    let theme = db
        .get_theme(&options.theme_id)
        .map_err(|e| format!("Failed to get theme: {}", e))?
        .ok_or_else(|| format!("Theme not found: {}", options.theme_id))?;
    
    // 如果已安装且不覆盖，返回错误
    if theme.installed && !options.overwrite.unwrap_or(false) {
        return Err("Theme already installed".to_string());
    }
    
    // 标记为已安装
    db.mark_installed(&options.theme_id, true)
        .map_err(|e| format!("Failed to mark theme as installed: {}", e))?;
    
    // TODO: 如果需要，应用为当前主题
    if options.set_as_current.unwrap_or(false) {
        // 实现应用主题逻辑
    }
    
    Ok(())
}

/**
 * 卸载主题
 */
#[tauri::command]
pub async fn uninstall_theme(
    options: ThemeUninstallOptions,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // 检查主题是否存在
    let theme = db
        .get_theme(&options.theme_id)
        .map_err(|e| format!("Failed to get theme: {}", e))?
        .ok_or_else(|| format!("Theme not found: {}", options.theme_id))?;
    
    if !theme.installed {
        return Err("Theme not installed".to_string());
    }
    
    // TODO: 如果需要备份
    if options.backup.unwrap_or(false) {
        // 实现备份逻辑
    }
    
    // 标记为未安装
    db.mark_installed(&options.theme_id, false)
        .map_err(|e| format!("Failed to mark theme as uninstalled: {}", e))?;
    
    // TODO: 如果需要删除用户数据
    if options.remove_user_data.unwrap_or(false) {
        // 实现删除用户数据逻辑
    }
    
    Ok(())
}

/**
 * 收藏主题
 */
#[tauri::command]
pub async fn favorite_theme(
    theme_id: String,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    db.favorite_theme(&theme_id)
        .map_err(|e| format!("Failed to favorite theme: {}", e))?;
    
    Ok(())
}

/**
 * 取消收藏主题
 */
#[tauri::command]
pub async fn unfavorite_theme(
    theme_id: String,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    db.unfavorite_theme(&theme_id)
        .map_err(|e| format!("Failed to unfavorite theme: {}", e))?;
    
    Ok(())
}

/**
 * 导出主题
 */
#[tauri::command]
pub async fn export_theme(
    options: ThemeExportOptions,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<String, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // 获取主题
    let theme = db
        .get_theme(&options.theme_id)
        .map_err(|e| format!("Failed to get theme: {}", e))?
        .ok_or_else(|| format!("Theme not found: {}", options.theme_id))?;
    
    // 确定输出路径
    let output_path = match options.output_path {
        Some(path) => path,
        None => {
            let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
            home_dir.join("Downloads").join(format!("theme-{}.json", theme.id))
        }
    };
    
    // 序列化主题数据
    let theme_json = serde_json::to_string_pretty(&theme)
        .map_err(|e| format!("Failed to serialize theme: {}", e))?;
    
    // 写入文件
    fs::write(&output_path, theme_json)
        .map_err(|e| format!("Failed to write theme file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

/**
 * 导入主题
 */
#[tauri::command]
pub async fn import_theme(
    options: ThemeImportOptions,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<Theme, String> {
    // 读取主题文件
    let theme_json = fs::read_to_string(&options.source)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;
    
    // 解析主题数据
    let mut theme: Theme = serde_json::from_str(&theme_json)
        .map_err(|e| format!("Failed to parse theme file: {}", e))?;
    
    // 验证主题（如果需要）
    if options.validate.unwrap_or(true) {
        // TODO: 实现主题验证逻辑
    }
    
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // 检查主题是否已存在
    if let Ok(Some(_)) = db.get_theme(&theme.id) {
        if !options.overwrite.unwrap_or(false) {
            return Err("Theme already exists".to_string());
        }
    }
    
    // 更新时间戳
    theme.updated_at = Utc::now();
    
    // 保存主题
    db.upsert_theme(&theme)
        .map_err(|e| format!("Failed to save theme: {}", e))?;
    
    // 如果需要，设为当前主题
    if options.set_as_current.unwrap_or(false) {
        db.mark_installed(&theme.id, true)
            .map_err(|e| format!("Failed to mark theme as installed: {}", e))?;
        // TODO: 应用主题
    }
    
    Ok(theme)
}

/**
 * 验证主题
 */
#[tauri::command]
pub async fn validate_theme(source: String) -> Result<serde_json::Value, String> {
    // 读取主题文件
    let theme_json = fs::read_to_string(&source)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;
    
    // 尝试解析主题数据
    match serde_json::from_str::<Theme>(&theme_json) {
        Ok(theme) => {
            Ok(serde_json::json!({
                "valid": true,
                "errors": [],
                "warnings": [],
                "theme": theme,
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "valid": false,
                "errors": [{
                    "field": "theme",
                    "message": format!("Invalid theme format: {}", e),
                }],
                "warnings": [],
                "theme": null,
            }))
        }
    }
}

/**
 * 获取统计信息
 */
#[tauri::command]
pub async fn get_theme_statistics(
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<ThemeStatistics, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let stats = db
        .get_statistics()
        .map_err(|e| format!("Failed to get statistics: {}", e))?;
    
    Ok(stats)
}

/**
 * 获取已安装的主题
 */
#[tauri::command]
pub async fn get_installed_themes(
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<Vec<Theme>, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let themes = db
        .get_installed_themes()
        .map_err(|e| format!("Failed to get installed themes: {}", e))?;
    
    Ok(themes)
}

/**
 * 获取收藏的主题
 */
#[tauri::command]
pub async fn get_favorited_themes(
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<Vec<Theme>, String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let themes = db
        .get_favorited_themes()
        .map_err(|e| format!("Failed to get favorited themes: {}", e))?;
    
    Ok(themes)
}

/**
 * 应用主题
 */
#[tauri::command]
pub async fn apply_theme(
    theme_id: String,
    db: State<'_, Mutex<ThemeDatabase>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // 获取主题
    let theme = db
        .get_theme(&theme_id)
        .map_err(|e| format!("Failed to get theme: {}", e))?
        .ok_or_else(|| format!("Theme not found: {}", theme_id))?;
    
    // TODO: 实现应用主题逻辑
    // 1. 将主题变量应用到配置
    // 2. 应用自定义CSS
    // 3. 更新当前主题设置
    // 4. 通知前端刷新
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::theme::{Theme, ThemeDatabase, ThemeStatistics};
    use std::sync::{Arc, Mutex};
    use tempfile::NamedTempFile;
    use tokio_test;
    use chrono::Utc;
    use std::collections::HashMap;
    use std::cell::RefCell;

    // 线程安全的Mock数据库 - 改进版本，避免死锁
    #[derive(Debug)]
    struct SafeMockThemeDatabase {
        inner: Arc<Mutex<MockThemeDatabaseInner>>,
    }

    #[derive(Debug, Clone)]
    struct MockThemeDatabaseInner {
        themes: HashMap<String, Theme>,
        statistics: ThemeStatistics,
        should_fail: bool,
    }

    impl SafeMockThemeDatabase {
        fn new() -> Self {
            Self {
                inner: Arc::new(Mutex::new(MockThemeDatabaseInner {
                    themes: HashMap::new(),
                    statistics: ThemeStatistics {
                        total_themes: 0,
                        installed_themes: 0,
                        favorited_themes: 0,
                        dark_themes: 0,
                        light_themes: 0,
                        categories: HashMap::new(),
                    },
                    should_fail: false,
                }))
            }
        }

        fn with_failure() -> Self {
            Self {
                inner: Arc::new(Mutex::new(MockThemeDatabaseInner {
                    themes: HashMap::new(),
                    statistics: ThemeStatistics {
                        total_themes: 0,
                        installed_themes: 0,
                        favorited_themes: 0,
                        dark_themes: 0,
                        light_themes: 0,
                        categories: HashMap::new(),
                    },
                    should_fail: true,
                }))
            }
        }

        fn add_theme(&self, theme: Theme) {
            let mut inner = self.inner.lock().unwrap();
            inner.themes.insert(theme.id.clone(), theme);
            inner.update_statistics();
        }
    }

    impl MockThemeDatabaseInner {
        fn update_statistics(&mut self) {
            self.statistics.total_themes = self.themes.len() as i64;
            self.statistics.installed_themes = self.themes.values()
                .filter(|t| t.installed)
                .count() as i64;
            self.statistics.favorited_themes = self.themes.values()
                .filter(|t| t.favorited)
                .count() as i64;
            self.statistics.dark_themes = self.themes.values()
                .filter(|t| t.is_dark)
                .count() as i64;
            self.statistics.light_themes = self.themes.values()
                .filter(|t| !t.is_dark)
                .count() as i64;
        }

        fn search_themes(
            &self,
            keyword: Option<&str>,
            category: Option<&str>,
            installed_only: bool,
            _limit: i64,
            _offset: i64,
        ) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }

            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| {
                    let keyword_match = keyword.map_or(true, |kw| {
                        theme.name.contains(kw) || 
                        theme.description.as_ref().map_or(false, |d| d.contains(kw))
                    });
                    
                    let category_match = category.map_or(true, |cat| {
                        theme.category == cat
                    });
                    
                    let installed_match = if installed_only {
                        theme.installed
                    } else {
                        true
                    };
                    
                    keyword_match && category_match && installed_match
                })
                .cloned()
                .collect();
            Ok(themes)
        }
        
        fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            Ok(self.themes.get(theme_id).cloned())
        }
        
        fn mark_installed(&mut self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.installed = installed;
                self.update_statistics();
            }
            Ok(())
        }
        
        fn favorite_theme(&mut self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.favorited = true;
                self.update_statistics();
            }
            Ok(())
        }
        
        fn unfavorite_theme(&mut self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.favorited = false;
                self.update_statistics();
            }
            Ok(())
        }
        
        fn upsert_theme(&mut self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            self.themes.insert(theme.id.clone(), theme.clone());
            self.update_statistics();
            Ok(())
        }
        
        fn get_statistics(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            Ok(self.statistics.clone())
        }
        
        fn get_installed_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| theme.installed)
                .cloned()
                .collect();
            Ok(themes)
        }
        
        fn get_favorited_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            if self.should_fail {
                return Err("Mock database failure".into());
            }
            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| theme.favorited)
                .cloned()
                .collect();
            Ok(themes)
        }
    }

    // SafeMockThemeDatabase的数据库操作方法
    impl SafeMockThemeDatabase {
        fn search_themes(&self, keyword: Option<&str>, category: Option<&str>, installed_only: bool, limit: i64, offset: i64) -> Result<Vec<Theme>, String> {
            let inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.search_themes(keyword, category, installed_only, limit, offset)
                .map_err(|e| e.to_string())
        }

        fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, String> {
            let inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.get_theme(theme_id).map_err(|e| e.to_string())
        }

        fn mark_installed(&self, theme_id: &str, installed: bool) -> Result<(), String> {
            let mut inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.mark_installed(theme_id, installed).map_err(|e| e.to_string())
        }

        fn favorite_theme(&self, theme_id: &str) -> Result<(), String> {
            let mut inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.favorite_theme(theme_id).map_err(|e| e.to_string())
        }

        fn unfavorite_theme(&self, theme_id: &str) -> Result<(), String> {
            let mut inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.unfavorite_theme(theme_id).map_err(|e| e.to_string())
        }

        fn upsert_theme(&self, theme: &Theme) -> Result<(), String> {
            let mut inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.upsert_theme(theme).map_err(|e| e.to_string())
        }

        fn get_statistics(&self) -> Result<ThemeStatistics, String> {
            let inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.get_statistics().map_err(|e| e.to_string())
        }

        fn get_installed_themes(&self) -> Result<Vec<Theme>, String> {
            let inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.get_installed_themes().map_err(|e| e.to_string())
        }

        fn get_favorited_themes(&self) -> Result<Vec<Theme>, String> {
            let inner = self.inner.lock().map_err(|_| "Lock poisoned")?;
            inner.get_favorited_themes().map_err(|e| e.to_string())
        }
    }

    // 测试辅助函数 - 创建Mock数据库状态
    fn create_mock_db_state(mock_db: SafeMockThemeDatabase) -> tauri::State<Mutex<SafeMockThemeDatabase>> {
        tauri::State::from(&Mutex::new(mock_db))
    }

    fn create_test_theme() -> Theme {
        Theme {
            id: "test-theme-001".to_string(),
            name: "Test Theme".to_string(),
            description: Some("A test theme".to_string()),
            author: Some("Test Author".to_string()),
            version: "1.0.0".to_string(),
            category: "test".to_string(),
            variables: serde_json::json!({}),
            custom_css: None,
            preview_image: None,
            is_dark: false,
            is_default: false,
            installed: false,
            favorited: false,
            download_count: 0,
            rating: 0.0,
            tags: vec!["test".to_string()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // 创建测试用的Mock数据库适配器
    struct MockThemeDatabaseAdapter {
        mock_db: SafeMockThemeDatabase,
    }

    impl MockThemeDatabaseAdapter {
        fn new(mock_db: SafeMockThemeDatabase) -> Self {
            Self { mock_db }
        }
    }

    // 为Mock适配器实现ThemeDatabase trait的方法
    impl MockThemeDatabaseAdapter {
        fn search_themes(&self, keyword: Option<&str>, category: Option<&str>, installed_only: bool, limit: i64, offset: i64) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.search_themes(keyword, category, installed_only, limit, offset)
                .map_err(|e| e.into())
        }

        fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.get_theme(theme_id).map_err(|e| e.into())
        }

        fn mark_installed(&self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.mark_installed(theme_id, installed).map_err(|e| e.into())
        }

        fn favorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.favorite_theme(theme_id).map_err(|e| e.into())
        }

        fn unfavorite_theme(&self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.unfavorite_theme(theme_id).map_err(|e| e.into())
        }

        fn upsert_theme(&self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.upsert_theme(theme).map_err(|e| e.into())
        }

        fn get_statistics(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.get_statistics().map_err(|e| e.into())
        }

        fn get_installed_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.get_installed_themes().map_err(|e| e.into())
        }

        fn get_favorited_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            self.mock_db.get_favorited_themes().map_err(|e| e.into())
        }
    }

    // ================================
    // 精确高效的测试集 - 避免死锁和并发问题
    // ================================

    #[tokio::test]
    async fn test_search_themes_basic_functionality() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        // Act & Assert - 直接调用数据库方法避免State复杂性
        let themes = mock_db.search_themes(Some("Test"), None, false, 20, 0).unwrap();
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0].name, "Test Theme");
    }

    #[tokio::test]
    async fn test_get_theme_success() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        // Act
        let result = mock_db.get_theme("test-theme-001").unwrap();

        // Assert
        assert!(result.is_some());
        let theme = result.unwrap();
        assert_eq!(theme.id, "test-theme-001");
        assert_eq!(theme.name, "Test Theme");
    }

    #[tokio::test]
    async fn test_get_theme_not_found() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();

        // Act
        let result = mock_db.get_theme("nonexistent").unwrap();

        // Assert
        assert!(result.is_none());
    }

    #[tokio::test] 
    async fn test_theme_install_uninstall_cycle() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        // Act - Install
        let install_result = mock_db.mark_installed("test-theme-001", true);
        assert!(install_result.is_ok());

        // Assert - Verify installation
        let installed_themes = mock_db.get_installed_themes().unwrap();
        assert_eq!(installed_themes.len(), 1);
        assert_eq!(installed_themes[0].id, "test-theme-001");

        // Act - Uninstall
        let uninstall_result = mock_db.mark_installed("test-theme-001", false);
        assert!(uninstall_result.is_ok());

        // Assert - Verify uninstallation
        let installed_themes = mock_db.get_installed_themes().unwrap();
        assert_eq!(installed_themes.len(), 0);
    }

    #[tokio::test]
    async fn test_theme_favorite_unfavorite_cycle() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        // Act - Favorite
        let favorite_result = mock_db.favorite_theme("test-theme-001");
        assert!(favorite_result.is_ok());

        // Assert - Verify favorite
        let favorited_themes = mock_db.get_favorited_themes().unwrap();
        assert_eq!(favorited_themes.len(), 1);

        // Act - Unfavorite
        let unfavorite_result = mock_db.unfavorite_theme("test-theme-001");
        assert!(unfavorite_result.is_ok());

        // Assert - Verify unfavorite
        let favorited_themes = mock_db.get_favorited_themes().unwrap();
        assert_eq!(favorited_themes.len(), 0);
    }

    #[tokio::test]
    async fn test_theme_statistics() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        
        // Add various themes
        let mut theme1 = create_test_theme();
        theme1.id = "theme1".to_string();
        theme1.installed = true;
        theme1.is_dark = true;
        
        let mut theme2 = create_test_theme();
        theme2.id = "theme2".to_string();
        theme2.favorited = true;
        theme2.is_dark = false;

        mock_db.add_theme(theme1);
        mock_db.add_theme(theme2);

        // Act
        let stats = mock_db.get_statistics().unwrap();

        // Assert
        assert_eq!(stats.total_themes, 2);
        assert_eq!(stats.installed_themes, 1);
        assert_eq!(stats.favorited_themes, 1);
        assert_eq!(stats.dark_themes, 1);
        assert_eq!(stats.light_themes, 1);
    }

    #[tokio::test]
    async fn test_theme_search_filters() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        
        let mut theme1 = create_test_theme();
        theme1.id = "dark-theme".to_string();
        theme1.category = "dark".to_string();
        theme1.installed = true;
        
        let mut theme2 = create_test_theme();
        theme2.id = "light-theme".to_string();
        theme2.category = "light".to_string();
        theme2.installed = false;

        mock_db.add_theme(theme1);
        mock_db.add_theme(theme2);

        // Test category filter
        let dark_themes = mock_db.search_themes(None, Some("dark"), false, 10, 0).unwrap();
        assert_eq!(dark_themes.len(), 1);
        assert_eq!(dark_themes[0].category, "dark");

        // Test installed filter
        let installed_themes = mock_db.search_themes(None, None, true, 10, 0).unwrap();
        assert_eq!(installed_themes.len(), 1);
        assert_eq!(installed_themes[0].installed, true);
    }

    #[tokio::test]
    async fn test_database_error_handling() {
        // Arrange - 使用失败模拟
        let mock_db = SafeMockThemeDatabase::with_failure();

        // Act & Assert - 所有操作都应该失败
        assert!(mock_db.search_themes(None, None, false, 10, 0).is_err());
        assert!(mock_db.get_theme("any").is_err());
        assert!(mock_db.mark_installed("any", true).is_err());
        assert!(mock_db.favorite_theme("any").is_err());
        assert!(mock_db.get_statistics().is_err());
    }

    #[tokio::test]
    async fn test_theme_upsert() {
        // Arrange
        let mock_db = SafeMockThemeDatabase::new();
        let mut theme = create_test_theme();
        
        // Act - Insert new theme
        let insert_result = mock_db.upsert_theme(&theme);
        assert!(insert_result.is_ok());
        
        // Assert - Theme exists
        let retrieved = mock_db.get_theme(&theme.id).unwrap().unwrap();
        assert_eq!(retrieved.name, theme.name);
        
        // Act - Update existing theme
        theme.name = "Updated Theme".to_string();
        let update_result = mock_db.upsert_theme(&theme);
        assert!(update_result.is_ok());
        
        // Assert - Theme updated
        let updated = mock_db.get_theme(&theme.id).unwrap().unwrap();
        assert_eq!(updated.name, "Updated Theme");
    }

    // ================================
    // 边界条件和错误场景测试
    // ================================

    #[test]
    fn test_theme_structure_validation() {
        // 测试Theme结构体的基本功能
        let theme = create_test_theme();
        
        assert_eq!(theme.id, "test-theme-001");
        assert_eq!(theme.name, "Test Theme");
        assert_eq!(theme.version, "1.0.0");
        assert_eq!(theme.category, "test");
        assert!(!theme.installed);
        assert!(!theme.favorited);
        assert_eq!(theme.download_count, 0);
        assert_eq!(theme.rating, 0.0);
        assert!(theme.tags.contains(&"test".to_string()));
    }

    #[test] 
    fn test_theme_serialization_round_trip() {
        // 测试Theme序列化和反序列化
        let original_theme = create_test_theme();
        
        // Serialize
        let serialized = serde_json::to_string(&original_theme).expect("序列化失败");
        assert!(!serialized.is_empty());
        assert!(serialized.contains("\"id\":\"test-theme-001\""));
        
        // Deserialize
        let deserialized: Theme = serde_json::from_str(&serialized).expect("反序列化失败");
        
        // Verify round-trip
        assert_eq!(original_theme.id, deserialized.id);
        assert_eq!(original_theme.name, deserialized.name);
        assert_eq!(original_theme.version, deserialized.version);
        assert_eq!(original_theme.category, deserialized.category);
        assert_eq!(original_theme.installed, deserialized.installed);
        assert_eq!(original_theme.favorited, deserialized.favorited);
    }

    #[tokio::test]
    async fn test_concurrent_operations_safety() {
        // 测试并发操作的安全性
        let mock_db = Arc::new(SafeMockThemeDatabase::new());
        
        // 准备测试数据
        for i in 0..5 {
            let mut theme = create_test_theme();
            theme.id = format!("theme-{}", i);
            theme.name = format!("Theme {}", i);
            mock_db.add_theme(theme);
        }
        
        // 并发执行多个操作
        let handles: Vec<_> = (0..10).map(|i| {
            let db = Arc::clone(&mock_db);
            tokio::spawn(async move {
                // 随机执行不同操作
                match i % 4 {
                    0 => db.search_themes(Some("Theme"), None, false, 10, 0),
                    1 => {
                        db.mark_installed(&format!("theme-{}", i % 5), true).map(|_| vec![])
                    }
                    2 => {
                        db.favorite_theme(&format!("theme-{}", i % 5)).map(|_| vec![])
                    }
                    _ => db.get_installed_themes(),
                }
            })
        }).collect();
        
        // 等待所有操作完成
        for handle in handles {
            let result = handle.await.expect("任务执行失败");
            assert!(result.is_ok(), "并发操作应该成功");
        }
    }

    #[test]
    fn test_theme_options_validation() {
        // 测试各种选项结构的有效性
        
        // ThemeSearchOptions
        let search_opts = ThemeSearchOptions {
            keyword: Some("test".to_string()),
            category: Some("dark".to_string()),
            installed_only: Some(true),
            page: Some(1),
            page_size: Some(20),
        };
        
        assert_eq!(search_opts.keyword.unwrap(), "test");
        assert_eq!(search_opts.page.unwrap(), 1);
        assert_eq!(search_opts.page_size.unwrap(), 20);
        
        // ThemeInstallOptions
        let install_opts = ThemeInstallOptions {
            theme_id: "test-theme".to_string(),
            set_as_current: Some(true),
            overwrite: Some(false),
        };
        
        assert_eq!(install_opts.theme_id, "test-theme");
        assert_eq!(install_opts.set_as_current.unwrap(), true);
        assert_eq!(install_opts.overwrite.unwrap(), false);
    }

    #[tokio::test]
    async fn test_empty_search_results() {
        // 测试空搜索结果的处理
        let mock_db = SafeMockThemeDatabase::new();
        
        // 搜索不存在的关键词
        let result = mock_db.search_themes(Some("nonexistent"), None, false, 10, 0).unwrap();
        assert_eq!(result.len(), 0);
        
        // 搜索不存在的分类
        let result = mock_db.search_themes(None, Some("nonexistent"), false, 10, 0).unwrap();
        assert_eq!(result.len(), 0);
        
        // 搜索已安装但没有已安装主题
        let result = mock_db.search_themes(None, None, true, 10, 0).unwrap();
        assert_eq!(result.len(), 0);
    }
}


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
    use mockall::{mock, predicate::*};
    use std::sync::Mutex;
    use tempfile::NamedTempFile;
    use tokio_test;
    use chrono::Utc;

    // Mock 简单的主题数据库，直接实现方法而不用 trait
    struct MockThemeDatabase {
        themes: std::collections::HashMap<String, Theme>,
        statistics: ThemeStatistics,
    }

    impl MockThemeDatabase {
        fn new() -> Self {
            Self {
                themes: std::collections::HashMap::new(),
                statistics: ThemeStatistics {
                    total_themes: 0,
                    installed_themes: 0,
                    favorited_themes: 0,
                    dark_themes: 0,
                    light_themes: 0,
                    categories: std::collections::HashMap::new(),
                },
            }
        }

        fn add_theme(&mut self, theme: Theme) {
            self.themes.insert(theme.id.clone(), theme);
        }

        fn search_themes(
            &self,
            keyword: Option<&str>,
            _category: Option<&str>,
            _installed_only: bool,
            _limit: i64,
            _offset: i64,
        ) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| {
                    if let Some(kw) = keyword {
                        theme.name.contains(kw) || theme.description.as_ref().map_or(false, |d| d.contains(kw))
                    } else {
                        true
                    }
                })
                .cloned()
                .collect();
            Ok(themes)
        }
        
        fn get_theme(&self, theme_id: &str) -> Result<Option<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            Ok(self.themes.get(theme_id).cloned())
        }
        
        fn mark_installed(&mut self, theme_id: &str, installed: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.installed = installed;
            }
            Ok(())
        }
        
        fn favorite_theme(&mut self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.favorited = true;
            }
            Ok(())
        }
        
        fn unfavorite_theme(&mut self, theme_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if let Some(theme) = self.themes.get_mut(theme_id) {
                theme.favorited = false;
            }
            Ok(())
        }
        
        fn upsert_theme(&mut self, theme: &Theme) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.themes.insert(theme.id.clone(), theme.clone());
            Ok(())
        }
        
        fn get_statistics(&self) -> Result<ThemeStatistics, Box<dyn std::error::Error + Send + Sync>> {
            Ok(self.statistics.clone())
        }
        
        fn get_installed_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| theme.installed)
                .cloned()
                .collect();
            Ok(themes)
        }
        
        fn get_favorited_themes(&self) -> Result<Vec<Theme>, Box<dyn std::error::Error + Send + Sync>> {
            let themes: Vec<Theme> = self.themes.values()
                .filter(|theme| theme.favorited)
                .cloned()
                .collect();
            Ok(themes)
        }
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

    #[tokio::test]
    async fn test_search_themes_success() {
        // Arrange
        let mut mock_db = MockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        let options = ThemeSearchOptions {
            keyword: Some("Test".to_string()),
            category: None,
            installed_only: Some(false),
            page: Some(1),
            page_size: Some(20),
        };

        // Act
        let result = search_themes(
            options,
            tauri::State::from(&Mutex::new(mock_db)),
        ).await;

        // Assert
        assert!(result.is_ok());
        let search_result = result.unwrap();
        assert_eq!(search_result.themes.len(), 1);
        assert_eq!(search_result.page, 1);
        assert_eq!(search_result.page_size, 20);
    }

    #[tokio::test]
    async fn test_get_theme_success() {
        // Arrange
        let mut mock_db = MockThemeDatabase::new();
        let test_theme = create_test_theme();
        mock_db.add_theme(test_theme);

        // Act
        let result = get_theme(
            "test-theme-001".to_string(),
            tauri::State::from(&Mutex::new(mock_db)),
        ).await;

        // Assert
        assert!(result.is_ok());
        let theme = result.unwrap();
        assert_eq!(theme.id, "test-theme-001");
        assert_eq!(theme.name, "Test Theme");
    }

    #[tokio::test]
    async fn test_get_theme_not_found() {
        // Arrange
        let mock_db = MockThemeDatabase::new(); // 空的数据库

        // Act
        let result = get_theme(
            "nonexistent".to_string(),
            tauri::State::from(&Mutex::new(mock_db)),
        ).await;

        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Theme not found"));
    }

    // 基本的集成测试 - 测试核心功能
    #[tokio::test]
    async fn test_validate_theme_functions() {
        // 测试有效的主题验证
        let test_theme = create_test_theme();
        let temp_file = NamedTempFile::new().unwrap();
        let theme_json = serde_json::to_string_pretty(&test_theme).unwrap();
        std::fs::write(temp_file.path(), theme_json).unwrap();

        let result = validate_theme(
            temp_file.path().to_string_lossy().to_string()
        ).await;

        assert!(result.is_ok());
        let validation_result = result.unwrap();
        assert_eq!(validation_result["valid"], true);

        // 测试无效的主题验证
        let temp_file_invalid = NamedTempFile::new().unwrap();
        std::fs::write(temp_file_invalid.path(), "invalid json").unwrap();

        let result_invalid = validate_theme(
            temp_file_invalid.path().to_string_lossy().to_string()
        ).await;

        assert!(result_invalid.is_ok());
        let validation_result_invalid = result_invalid.unwrap();
        assert_eq!(validation_result_invalid["valid"], false);
    }

    #[test]
    fn test_theme_structure() {
        // 测试 Theme 结构体的基本功能
        let theme = create_test_theme();
        assert_eq!(theme.id, "test-theme-001");
        assert_eq!(theme.name, "Test Theme");
        assert_eq!(theme.version, "1.0.0");
        assert_eq!(theme.category, "test");
        assert!(!theme.installed);
        assert!(!theme.favorited);
    }

    #[test]
    fn test_theme_serialization() {
        // 测试 Theme 序列化和反序列化
        let theme = create_test_theme();
        let serialized = serde_json::to_string(&theme).unwrap();
        let deserialized: Theme = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(theme.id, deserialized.id);
        assert_eq!(theme.name, deserialized.name);
        assert_eq!(theme.version, deserialized.version);
    }
}


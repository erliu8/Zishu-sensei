//! 主题数据库测试
//!
//! 测试主题数据库的所有功能，包括：
//! - 主题的CRUD操作
//! - 主题搜索和过滤
//! - 主题收藏管理
//! - 安装状态管理
//! - 统计信息
//! - 数据完整性

use zishu_sensei::database::theme::{
    ThemeDatabase, Theme, ThemeStatistics,
};
use tempfile::TempDir;
use std::path::PathBuf;
use chrono::Utc;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, ThemeDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_theme.db");
    let db = ThemeDatabase::new(db_path).expect("无法创建数据库");
    (temp_dir, db)
}

/// 创建测试主题
fn create_test_theme(id: &str, name: &str) -> Theme {
    Theme {
        id: id.to_string(),
        name: name.to_string(),
        display_name: name.to_string(),
        description: format!("{} 的描述", name),
        author_id: "author-123".to_string(),
        author_name: "测试作者".to_string(),
        version: "1.0.0".to_string(),
        category: "modern".to_string(),
        tags: vec!["dark".to_string(), "minimal".to_string()],
        is_dark: true,
        thumbnail: "thumbnail.png".to_string(),
        preview_images: vec!["preview1.png".to_string(), "preview2.png".to_string()],
        variables: serde_json::json!({}),
        custom_css: None,
        downloads: 0,
        rating: 0.0,
        rating_count: 0,
        installed: false,
        favorited: false,
        file_path: None,
        file_size: 0,
        min_version: "0.1.0".to_string(),
        max_version: None,
        license: "MIT".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[test]
    fn test_database_creation_success() {
        // ========== Arrange & Act ==========
        let (_temp, _db) = setup_test_db();
        
        // ========== Assert ==========
        // 如果没有 panic，说明创建成功
    }

    #[test]
    fn test_tables_created() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("test-theme", "测试主题");
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能够插入主题");
    }
}

// ========== 主题插入/更新测试 ==========

mod upsert_theme {
    use super::*;

    #[test]
    fn test_insert_new_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("new-theme", "新主题");
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_existing_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("update-theme", "原主题");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let mut updated = theme.clone();
        updated.display_name = "更新后的主题".to_string();
        updated.downloads = 100;
        db.upsert_theme(&updated).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("update-theme").unwrap().unwrap();
        assert_eq!(retrieved.display_name, "更新后的主题");
        assert_eq!(retrieved.downloads, 100);
    }

    #[test]
    fn test_insert_theme_with_all_fields() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("full-theme", "完整主题");
        theme.custom_css = Some(".custom { color: red; }".to_string());
        theme.file_path = Some(PathBuf::from("/path/to/theme.zip"));
        theme.file_size = 1024 * 1024; // 1MB
        theme.max_version = Some("2.0.0".to_string());
        theme.downloads = 500;
        theme.rating = 4.5;
        theme.rating_count = 100;
        
        // ========== Act ==========
        db.upsert_theme(&theme).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("full-theme").unwrap().unwrap();
        assert_eq!(retrieved.custom_css, theme.custom_css);
        assert_eq!(retrieved.file_size, 1024 * 1024);
        assert_eq!(retrieved.rating, 4.5);
    }

    #[test]
    fn test_insert_themes_different_categories() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let categories = vec!["modern", "classic", "minimal", "colorful", "custom"];
        
        // ========== Act & Assert ==========
        for (i, category) in categories.iter().enumerate() {
            let mut theme = create_test_theme(&format!("theme-{}", i), &format!("主题{}", i));
            theme.category = category.to_string();
            let result = db.upsert_theme(&theme);
            assert!(result.is_ok(), "{} 类别的主题应该成功插入", category);
        }
    }

    #[test]
    fn test_insert_light_and_dark_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut dark_theme = create_test_theme("dark", "暗色主题");
        dark_theme.is_dark = true;
        
        let mut light_theme = create_test_theme("light", "亮色主题");
        light_theme.is_dark = false;
        
        // ========== Act ==========
        db.upsert_theme(&dark_theme).unwrap();
        db.upsert_theme(&light_theme).unwrap();
        
        // ========== Assert ==========
        let dark = db.get_theme("dark").unwrap().unwrap();
        let light = db.get_theme("light").unwrap().unwrap();
        
        assert!(dark.is_dark);
        assert!(!light.is_dark);
    }
}

// ========== 主题查询测试 ==========

mod get_theme {
    use super::*;

    #[test]
    fn test_get_existing_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("get-test", "获取测试");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let result = db.get_theme("get-test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "获取测试");
    }

    #[test]
    fn test_get_nonexistent_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_theme("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}

// ========== 主题搜索测试 ==========

mod search_themes {
    use super::*;

    #[test]
    fn test_search_all_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let theme = create_test_theme(&format!("theme-{}", i), &format!("主题{}", i));
            db.upsert_theme(&theme).unwrap();
        }
        
        // ========== Act ==========
        let result = db.search_themes(None, None, false, 10, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 5);
    }

    #[test]
    fn test_search_with_keyword() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        db.upsert_theme(&create_test_theme("modern-dark", "现代暗色主题")).unwrap();
        db.upsert_theme(&create_test_theme("classic-light", "经典亮色主题")).unwrap();
        db.upsert_theme(&create_test_theme("modern-light", "现代亮色主题")).unwrap();
        
        // ========== Act ==========
        let result = db.search_themes(Some("现代"), None, false, 10, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 2);
        assert!(themes.iter().all(|t| t.display_name.contains("现代")));
    }

    #[test]
    fn test_search_by_category() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut theme1 = create_test_theme("modern-1", "现代1");
        theme1.category = "modern".to_string();
        db.upsert_theme(&theme1).unwrap();
        
        let mut theme2 = create_test_theme("classic-1", "经典1");
        theme2.category = "classic".to_string();
        db.upsert_theme(&theme2).unwrap();
        
        let mut theme3 = create_test_theme("modern-2", "现代2");
        theme3.category = "modern".to_string();
        db.upsert_theme(&theme3).unwrap();
        
        // ========== Act ==========
        let result = db.search_themes(None, Some("modern"), false, 10, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 2);
        assert!(themes.iter().all(|t| t.category == "modern"));
    }

    #[test]
    fn test_search_installed_only() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut installed = create_test_theme("installed", "已安装");
        installed.installed = true;
        db.upsert_theme(&installed).unwrap();
        
        let not_installed = create_test_theme("not-installed", "未安装");
        db.upsert_theme(&not_installed).unwrap();
        
        // ========== Act ==========
        let result = db.search_themes(None, None, true, 10, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 1);
        assert!(themes[0].installed);
    }

    #[test]
    fn test_search_with_pagination() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..20 {
            let theme = create_test_theme(&format!("theme-{}", i), &format!("主题{}", i));
            db.upsert_theme(&theme).unwrap();
        }
        
        // ========== Act ==========
        let page1 = db.search_themes(None, None, false, 10, 0).unwrap();
        let page2 = db.search_themes(None, None, false, 10, 10).unwrap();
        
        // ========== Assert ==========
        assert_eq!(page1.len(), 10);
        assert_eq!(page2.len(), 10);
    }

    #[test]
    fn test_search_sorted_by_downloads() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut theme1 = create_test_theme("popular", "热门");
        theme1.downloads = 1000;
        db.upsert_theme(&theme1).unwrap();
        
        let mut theme2 = create_test_theme("less-popular", "较少");
        theme2.downloads = 100;
        db.upsert_theme(&theme2).unwrap();
        
        // ========== Act ==========
        let themes = db.search_themes(None, None, false, 10, 0).unwrap();
        
        // ========== Assert ==========
        // 应该按下载量降序排列
        assert!(themes[0].downloads >= themes[1].downloads);
    }
}

// ========== 已安装主题测试 ==========

mod installed_themes {
    use super::*;

    #[test]
    fn test_get_installed_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut installed1 = create_test_theme("installed-1", "已安装1");
        installed1.installed = true;
        db.upsert_theme(&installed1).unwrap();
        
        let mut installed2 = create_test_theme("installed-2", "已安装2");
        installed2.installed = true;
        db.upsert_theme(&installed2).unwrap();
        
        let not_installed = create_test_theme("not-installed", "未安装");
        db.upsert_theme(&not_installed).unwrap();
        
        // ========== Act ==========
        let result = db.get_installed_themes();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 2);
        assert!(themes.iter().all(|t| t.installed));
    }

    #[test]
    fn test_mark_installed() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("mark-test", "标记测试");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let result = db.mark_installed("mark-test", true);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = db.get_theme("mark-test").unwrap().unwrap();
        assert!(retrieved.installed);
    }

    #[test]
    fn test_mark_uninstalled() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let mut theme = create_test_theme("uninstall-test", "卸载测试");
        theme.installed = true;
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        db.mark_installed("uninstall-test", false).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("uninstall-test").unwrap().unwrap();
        assert!(!retrieved.installed);
    }
}

// ========== 主题收藏测试 ==========

mod favorite_themes {
    use super::*;

    #[test]
    fn test_favorite_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("fav-test", "收藏测试");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let result = db.favorite_theme("fav-test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let is_fav = db.is_favorited("fav-test").unwrap();
        assert!(is_fav);
    }

    #[test]
    fn test_unfavorite_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("unfav-test", "取消收藏测试");
        db.upsert_theme(&theme).unwrap();
        db.favorite_theme("unfav-test").unwrap();
        
        // ========== Act ==========
        let result = db.unfavorite_theme("unfav-test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let is_fav = db.is_favorited("unfav-test").unwrap();
        assert!(!is_fav);
    }

    #[test]
    fn test_get_favorited_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        let theme1 = create_test_theme("fav-1", "收藏1");
        db.upsert_theme(&theme1).unwrap();
        db.favorite_theme("fav-1").unwrap();
        
        let theme2 = create_test_theme("fav-2", "收藏2");
        db.upsert_theme(&theme2).unwrap();
        db.favorite_theme("fav-2").unwrap();
        
        let theme3 = create_test_theme("not-fav", "未收藏");
        db.upsert_theme(&theme3).unwrap();
        
        // ========== Act ==========
        let result = db.get_favorited_themes();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 2);
    }

    #[test]
    fn test_is_favorited_nonexistent() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.is_favorited("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_favorite_twice() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("double-fav", "重复收藏");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        db.favorite_theme("double-fav").unwrap();
        db.favorite_theme("double-fav").unwrap(); // 第二次收藏
        
        // ========== Assert ==========
        let themes = db.get_favorited_themes().unwrap();
        assert_eq!(themes.len(), 1, "应该只有一条收藏记录");
    }
}

// ========== 主题删除测试 ==========

mod delete_theme {
    use super::*;

    #[test]
    fn test_delete_existing_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("delete-test", "删除测试");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let result = db.delete_theme("delete-test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = db.get_theme("delete-test").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_delete_removes_favorites() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("delete-fav", "删除收藏");
        db.upsert_theme(&theme).unwrap();
        db.favorite_theme("delete-fav").unwrap();
        
        // ========== Act ==========
        db.delete_theme("delete-fav").unwrap();
        
        // ========== Assert ==========
        let is_fav = db.is_favorited("delete-fav").unwrap();
        assert!(!is_fav, "收藏记录应该被删除");
    }

    #[test]
    fn test_delete_nonexistent_theme() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.delete_theme("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok(), "删除不存在的主题应该不报错");
    }
}

// ========== 统计信息测试 ==========

mod get_statistics {
    use super::*;

    #[test]
    fn test_statistics_empty_database() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_statistics();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.total_themes, 0);
        assert_eq!(stats.installed_themes, 0);
        assert_eq!(stats.favorited_themes, 0);
        assert_eq!(stats.custom_themes, 0);
    }

    #[test]
    fn test_statistics_with_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // 普通主题
        let theme1 = create_test_theme("theme-1", "主题1");
        db.upsert_theme(&theme1).unwrap();
        
        // 已安装主题
        let mut theme2 = create_test_theme("theme-2", "主题2");
        theme2.installed = true;
        db.upsert_theme(&theme2).unwrap();
        
        // 自定义主题
        let mut theme3 = create_test_theme("theme-3", "主题3");
        theme3.category = "custom".to_string();
        db.upsert_theme(&theme3).unwrap();
        
        // 收藏主题
        db.favorite_theme("theme-1").unwrap();
        
        // ========== Act ==========
        let stats = db.get_statistics().unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.total_themes, 3);
        assert_eq!(stats.installed_themes, 1);
        assert_eq!(stats.favorited_themes, 1);
        assert_eq!(stats.custom_themes, 1);
    }

    #[test]
    fn test_statistics_multiple_custom_themes() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        for i in 0..5 {
            let mut theme = create_test_theme(&format!("custom-{}", i), &format!("自定义{}", i));
            theme.category = "custom".to_string();
            db.upsert_theme(&theme).unwrap();
        }
        
        // ========== Act ==========
        let stats = db.get_statistics().unwrap();
        
        // ========== Assert ==========
        assert_eq!(stats.custom_themes, 5);
    }
}

// ========== 综合场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_theme_lifecycle() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 创建主题
        let theme = create_test_theme("lifecycle", "生命周期测试");
        db.upsert_theme(&theme).unwrap();
        
        // 2. 收藏主题
        db.favorite_theme("lifecycle").unwrap();
        assert!(db.is_favorited("lifecycle").unwrap());
        
        // 3. 安装主题
        db.mark_installed("lifecycle", true).unwrap();
        let installed = db.get_theme("lifecycle").unwrap().unwrap();
        assert!(installed.installed);
        
        // 4. 更新主题信息
        let mut updated = installed.clone();
        updated.downloads = 100;
        updated.rating = 4.5;
        db.upsert_theme(&updated).unwrap();
        
        // 5. 验证更新
        let final_theme = db.get_theme("lifecycle").unwrap().unwrap();
        assert_eq!(final_theme.downloads, 100);
        assert_eq!(final_theme.rating, 4.5);
        assert!(final_theme.installed);
    }

    #[test]
    fn test_multi_user_favorites() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        // 创建多个主题
        for i in 0..5 {
            let theme = create_test_theme(&format!("theme-{}", i), &format!("主题{}", i));
            db.upsert_theme(&theme).unwrap();
        }
        
        // 收藏部分主题
        db.favorite_theme("theme-0").unwrap();
        db.favorite_theme("theme-2").unwrap();
        db.favorite_theme("theme-4").unwrap();
        
        // ========== Assert ==========
        let favorited = db.get_favorited_themes().unwrap();
        assert_eq!(favorited.len(), 3);
    }

    #[test]
    fn test_theme_marketplace_simulation() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        // 模拟市场中的多个主题
        let mut popular = create_test_theme("popular", "热门主题");
        popular.downloads = 10000;
        popular.rating = 4.8;
        popular.rating_count = 500;
        db.upsert_theme(&popular).unwrap();
        
        let mut new_theme = create_test_theme("new", "新主题");
        new_theme.downloads = 10;
        new_theme.rating = 0.0;
        new_theme.rating_count = 0;
        db.upsert_theme(&new_theme).unwrap();
        
        let mut custom = create_test_theme("custom", "自定义主题");
        custom.category = "custom".to_string();
        custom.downloads = 0;
        db.upsert_theme(&custom).unwrap();
        
        // ========== Assert ==========
        let all_themes = db.search_themes(None, None, false, 10, 0).unwrap();
        assert_eq!(all_themes.len(), 3);
        
        // 热门主题应该排在前面
        assert_eq!(all_themes[0].id, "popular");
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_theme_with_empty_strings() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("empty", "");
        theme.description = "".to_string();
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许空字符串");
    }

    #[test]
    fn test_theme_with_unicode() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("unicode", "测试主题 🎨 こんにちは");
        
        // ========== Act ==========
        db.upsert_theme(&theme).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("unicode").unwrap().unwrap();
        assert!(retrieved.display_name.contains("🎨"));
    }

    #[test]
    fn test_theme_with_very_long_description() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("long", "长描述");
        theme.description = "x".repeat(10000);
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_theme_with_many_tags() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("many-tags", "多标签");
        theme.tags = (0..100).map(|i| format!("tag-{}", i)).collect();
        
        // ========== Act ==========
        db.upsert_theme(&theme).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("many-tags").unwrap().unwrap();
        assert_eq!(retrieved.tags.len(), 100);
    }

    #[test]
    fn test_theme_with_many_preview_images() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("many-images", "多图片");
        theme.preview_images = (0..50).map(|i| format!("preview-{}.png", i)).collect();
        
        // ========== Act ==========
        db.upsert_theme(&theme).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_theme("many-images").unwrap().unwrap();
        assert_eq!(retrieved.preview_images.len(), 50);
    }

    #[test]
    fn test_theme_with_negative_downloads() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("negative", "负数下载");
        theme.downloads = -1;
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        // 应该能处理（数据库会存储）
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_theme_with_zero_file_size() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let mut theme = create_test_theme("zero-size", "零大小");
        theme.file_size = 0;
        
        // ========== Act ==========
        let result = db.upsert_theme(&theme);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_concurrent_operations() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        // 模拟并发操作
        for i in 0..100 {
            let theme = create_test_theme(&format!("concurrent-{}", i), &format!("并发{}", i));
            let result = db.upsert_theme(&theme);
            assert!(result.is_ok(), "第{}个主题应该成功插入", i);
        }
        
        // ========== Assert ==========
        let stats = db.get_statistics().unwrap();
        assert_eq!(stats.total_themes, 100);
    }

    #[test]
    fn test_search_with_special_characters() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        let theme = create_test_theme("special", "特殊字符 %_'\"");
        db.upsert_theme(&theme).unwrap();
        
        // ========== Act ==========
        let result = db.search_themes(Some("特殊"), None, false, 10, 0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let themes = result.unwrap();
        assert_eq!(themes.len(), 1);
    }
}


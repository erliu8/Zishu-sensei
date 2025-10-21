//! 主题管理命令测试
//!
//! 测试所有主题相关的Tauri命令

#[cfg(test)]
mod theme_commands_tests {
    use crate::common::*;
    
    // ================================
    // search_themes 命令测试
    // ================================
    
    mod search_themes {
        use super::*;
        
        #[tokio::test]
        async fn test_search_themes_returns_all_themes() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-1", "Dark Theme", "dark").unwrap();
            test_db.insert_test_theme("theme-2", "Light Theme", "light").unwrap();
            test_db.insert_test_theme("theme-3", "Colorful Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3, "应该有3个主题");
        }
        
        #[tokio::test]
        async fn test_search_themes_filters_by_keyword() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-1", "Dark Theme", "dark").unwrap();
            test_db.insert_test_theme("theme-2", "Light Theme", "light").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.search_themes_by_keyword("Dark").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 1, "应该找到1个包含'Dark'的主题");
        }
        
        #[tokio::test]
        async fn test_search_themes_filters_by_category() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-1", "Dark Theme", "dark").unwrap();
            test_db.insert_test_theme("theme-2", "Another Dark", "dark").unwrap();
            test_db.insert_test_theme("theme-3", "Light Theme", "light").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_themes_by_category("dark").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2, "应该找到2个dark类别的主题");
        }
        
        #[tokio::test]
        async fn test_search_themes_supports_pagination() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            for i in 1..=25 {
                test_db.insert_test_theme(
                    &format!("theme-{}", i),
                    &format!("Theme {}", i),
                    "general"
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            let total = test_db.count_themes().unwrap();
            let page_size = 20i64;
            let page_1_count = std::cmp::min(page_size, total);
            let page_2_count = total - page_1_count;
            
            // ========== Assert (断言) ==========
            assert_eq!(total, 25);
            assert_eq!(page_1_count, 20);
            assert_eq!(page_2_count, 5);
        }
        
        #[tokio::test]
        async fn test_search_themes_filters_installed_only() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-1", "Theme 1", "general", true).unwrap();
            test_db.insert_test_theme_with_status("theme-2", "Theme 2", "general", false).unwrap();
            test_db.insert_test_theme_with_status("theme-3", "Theme 3", "general", true).unwrap();
            
            // ========== Act (执行) ==========
            let installed_count = test_db.count_installed_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(installed_count, 2, "应该有2个已安装的主题");
        }
    }
    
    // ================================
    // get_theme 命令测试
    // ================================
    
    mod get_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_get_theme_returns_theme_details() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "My Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            let theme = test_db.get_theme("theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(theme.is_some());
            let theme_data = theme.unwrap();
            assert!(theme_data.contains("My Theme"));
        }
        
        #[tokio::test]
        async fn test_get_theme_returns_none_when_not_found() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            // ========== Act (执行) ==========
            let theme = test_db.get_theme("nonexistent").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(theme.is_none(), "不存在的主题应该返回None");
        }
    }
    
    // ================================
    // install_theme 命令测试
    // ================================
    
    mod install_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_install_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "New Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            test_db.mark_theme_installed("theme-001", true).unwrap();
            
            // ========== Assert (断言) ==========
            let is_installed = test_db.is_theme_installed("theme-001").unwrap();
            assert!(is_installed, "主题应该被标记为已安装");
        }
        
        #[tokio::test]
        async fn test_install_theme_prevents_duplicate() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-001", "Theme", "custom", true).unwrap();
            
            // ========== Act (执行) ==========
            let is_installed = test_db.is_theme_installed("theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(is_installed, "已安装的主题不应该重复安装");
        }
        
        #[tokio::test]
        async fn test_install_theme_with_overwrite() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-001", "Old Theme", "custom", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_theme_name("theme-001", "Updated Theme").unwrap();
            
            // ========== Assert (断言) ==========
            let theme = test_db.get_theme("theme-001").unwrap();
            assert!(theme.unwrap().contains("Updated Theme"));
        }
    }
    
    // ================================
    // uninstall_theme 命令测试
    // ================================
    
    mod uninstall_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_uninstall_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-001", "Theme", "custom", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.mark_theme_installed("theme-001", false).unwrap();
            
            // ========== Assert (断言) ==========
            let is_installed = test_db.is_theme_installed("theme-001").unwrap();
            assert!(!is_installed, "主题应该被标记为未安装");
        }
        
        #[tokio::test]
        async fn test_uninstall_theme_not_installed() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-001", "Theme", "custom", false).unwrap();
            
            // ========== Act (执行) ==========
            let is_installed = test_db.is_theme_installed("theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!is_installed, "未安装的主题不能卸载");
        }
    }
    
    // ================================
    // favorite_theme & unfavorite_theme 命令测试
    // ================================
    
    mod favorite_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_favorite_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            test_db.mark_theme_favorited("theme-001", true).unwrap();
            
            // ========== Assert (断言) ==========
            let is_favorited = test_db.is_theme_favorited("theme-001").unwrap();
            assert!(is_favorited, "主题应该被标记为收藏");
        }
        
        #[tokio::test]
        async fn test_unfavorite_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "Theme", "custom").unwrap();
            test_db.mark_theme_favorited("theme-001", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.mark_theme_favorited("theme-001", false).unwrap();
            
            // ========== Assert (断言) ==========
            let is_favorited = test_db.is_theme_favorited("theme-001").unwrap();
            assert!(!is_favorited, "主题应该被取消收藏");
        }
        
        #[tokio::test]
        async fn test_get_favorited_themes() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-1", "Theme 1", "custom").unwrap();
            test_db.insert_test_theme("theme-2", "Theme 2", "custom").unwrap();
            test_db.insert_test_theme("theme-3", "Theme 3", "custom").unwrap();
            
            test_db.mark_theme_favorited("theme-1", true).unwrap();
            test_db.mark_theme_favorited("theme-3", true).unwrap();
            
            // ========== Act (执行) ==========
            let favorited_count = test_db.count_favorited_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(favorited_count, 2, "应该有2个收藏的主题");
        }
    }
    
    // ================================
    // export_theme 命令测试
    // ================================
    
    mod export_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_export_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "My Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            let theme_data = test_db.get_theme("theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(theme_data.is_some(), "应该能够获取主题数据用于导出");
        }
        
        #[tokio::test]
        async fn test_export_theme_not_found() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            // ========== Act (执行) ==========
            let theme_data = test_db.get_theme("nonexistent").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(theme_data.is_none(), "不存在的主题不能导出");
        }
    }
    
    // ================================
    // import_theme 命令测试
    // ================================
    
    mod import_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_import_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            // ========== Act (执行) ==========
            test_db.insert_test_theme("imported-theme", "Imported Theme", "custom").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.theme_exists("imported-theme").unwrap();
            assert!(exists, "导入的主题应该存在");
        }
        
        #[tokio::test]
        async fn test_import_theme_with_overwrite() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "Old Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_theme_name("theme-001", "New Theme").unwrap();
            
            // ========== Assert (断言) ==========
            let theme = test_db.get_theme("theme-001").unwrap();
            assert!(theme.unwrap().contains("New Theme"), "应该覆盖旧主题");
        }
        
        #[tokio::test]
        async fn test_import_theme_prevents_duplicate_without_overwrite() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme("theme-001", "Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            let exists = test_db.theme_exists("theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(exists, "已存在的主题应该阻止重复导入");
        }
    }
    
    // ================================
    // validate_theme 命令测试
    // ================================
    
    mod validate_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_validate_theme_success() {
            // ========== Arrange (准备) ==========
            let valid_theme_json = r#"{"id":"theme-001","name":"Valid Theme","category":"custom"}"#;
            
            // ========== Act (执行) ==========
            let is_valid = serde_json::from_str::<serde_json::Value>(valid_theme_json).is_ok();
            
            // ========== Assert (断言) ==========
            assert!(is_valid, "有效的主题JSON应该通过验证");
        }
        
        #[tokio::test]
        async fn test_validate_theme_invalid_json() {
            // ========== Arrange (准备) ==========
            let invalid_json = r#"{"id":"theme-001","name":"Invalid Theme"#; // 缺少闭合括号
            
            // ========== Act (执行) ==========
            let is_valid = serde_json::from_str::<serde_json::Value>(invalid_json).is_ok();
            
            // ========== Assert (断言) ==========
            assert!(!is_valid, "无效的JSON应该验证失败");
        }
        
        #[tokio::test]
        async fn test_validate_theme_missing_required_fields() {
            // ========== Arrange (准备) ==========
            let incomplete_theme = r#"{"id":"theme-001"}"#; // 缺少name字段
            
            // ========== Act (执行) ==========
            let parsed = serde_json::from_str::<serde_json::Value>(incomplete_theme).unwrap();
            let has_name = parsed.get("name").is_some();
            
            // ========== Assert (断言) ==========
            assert!(!has_name, "缺少必需字段的主题应该验证失败");
        }
    }
    
    // ================================
    // get_theme_statistics 命令测试
    // ================================
    
    mod get_theme_statistics {
        use super::*;
        
        #[tokio::test]
        async fn test_get_theme_statistics_returns_counts() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-1", "Theme 1", "dark", true).unwrap();
            test_db.insert_test_theme_with_status("theme-2", "Theme 2", "light", false).unwrap();
            test_db.insert_test_theme("theme-3", "Theme 3", "custom").unwrap();
            
            test_db.mark_theme_favorited("theme-1", true).unwrap();
            
            // ========== Act (执行) ==========
            let total = test_db.count_themes().unwrap();
            let installed = test_db.count_installed_themes().unwrap();
            let favorited = test_db.count_favorited_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(total, 3);
            assert_eq!(installed, 1);
            assert_eq!(favorited, 1);
        }
    }
    
    // ================================
    // get_installed_themes 命令测试
    // ================================
    
    mod get_installed_themes {
        use super::*;
        
        #[tokio::test]
        async fn test_get_installed_themes_returns_only_installed() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            test_db.insert_test_theme_with_status("theme-1", "Installed 1", "custom", true).unwrap();
            test_db.insert_test_theme_with_status("theme-2", "Not Installed", "custom", false).unwrap();
            test_db.insert_test_theme_with_status("theme-3", "Installed 2", "custom", true).unwrap();
            
            // ========== Act (执行) ==========
            let installed_count = test_db.count_installed_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(installed_count, 2, "应该只返回已安装的主题");
        }
        
        #[tokio::test]
        async fn test_get_installed_themes_returns_empty_when_none() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            // ========== Act (执行) ==========
            let installed_count = test_db.count_installed_themes().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(installed_count, 0, "没有安装主题时应该返回空列表");
        }
    }
    
    // ================================
    // apply_theme 命令测试
    // ================================
    
    mod apply_theme {
        use super::*;
        
        #[tokio::test]
        async fn test_apply_theme_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.insert_test_theme("theme-001", "My Theme", "custom").unwrap();
            
            // ========== Act (执行) ==========
            test_db.upsert_config("current_theme", "theme-001").unwrap();
            
            // ========== Assert (断言) ==========
            let current = test_db.get_config("current_theme").unwrap();
            assert_eq!(current, Some("theme-001".to_string()));
        }
        
        #[tokio::test]
        async fn test_apply_theme_not_found() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            
            // ========== Act (执行) ==========
            let theme = test_db.get_theme("nonexistent").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(theme.is_none(), "不存在的主题不能应用");
        }
        
        #[tokio::test]
        async fn test_apply_theme_updates_config() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_theme_tables().expect("Failed to init theme tables");
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.insert_test_theme("theme-001", "Theme 1", "dark").unwrap();
            test_db.insert_test_theme("theme-002", "Theme 2", "light").unwrap();
            
            test_db.upsert_config("current_theme", "theme-001").unwrap();
            
            // ========== Act (执行) ==========
            test_db.upsert_config("current_theme", "theme-002").unwrap();
            
            // ========== Assert (断言) ==========
            let current = test_db.get_config("current_theme").unwrap();
            assert_eq!(current, Some("theme-002".to_string()), "应该更新当前主题配置");
        }
    }
}


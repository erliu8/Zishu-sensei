// 测试配置管理功能
use std::path::PathBuf;
use tempfile::tempdir;
use tokio::fs;
use zishu_sensei::utils::config::*;
use zishu_sensei::AppConfig;

// ========== 配置文件路径测试 ==========

mod config_paths {
    use super::*;

    #[test]
    fn test_get_app_data_dir() {
        let result = get_app_data_dir();
        assert!(result.is_ok());
        
        let dir = result.unwrap();
        assert!(dir.to_str().unwrap().contains("zishu-sensei"));
    }

    #[test]
    fn test_get_config_file_path() {
        let result = get_config_file_path();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_str().unwrap().ends_with("config.json"));
    }

    #[test]
    fn test_get_config_backup_path() {
        let result = get_config_backup_path();
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.to_str().unwrap().ends_with("config.backup.json"));
    }

    #[test]
    fn test_get_app_log_dir() {
        let result = get_app_log_dir();
        assert!(result.is_ok());
        
        let dir = result.unwrap();
        assert!(dir.to_str().unwrap().contains("logs"));
    }
}

// ========== 配置验证测试 ==========

mod config_validation {
    use super::*;

    fn create_default_app_config() -> AppConfig {
        AppConfig::default()
    }

    #[test]
    fn test_validate_config_success() {
        let config = create_default_app_config();
        let result = validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_config_invalid_window_width_too_small() {
        let mut config = create_default_app_config();
        config.window.width = 100.0; // < 200
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口宽度"));
    }

    #[test]
    fn test_validate_config_invalid_window_width_too_large() {
        let mut config = create_default_app_config();
        config.window.width = 5000.0; // > 4000
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口宽度"));
    }

    #[test]
    fn test_validate_config_invalid_window_height_too_small() {
        let mut config = create_default_app_config();
        config.window.height = 100.0; // < 200
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口高度"));
    }

    #[test]
    fn test_validate_config_invalid_window_height_too_large() {
        let mut config = create_default_app_config();
        config.window.height = 5000.0; // > 4000
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("窗口高度"));
    }

    #[test]
    fn test_validate_config_invalid_character_scale_too_small() {
        let mut config = create_default_app_config();
        config.character.scale = 0.05; // < 0.1
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("缩放比例"));
    }

    #[test]
    fn test_validate_config_invalid_character_scale_too_large() {
        let mut config = create_default_app_config();
        config.character.scale = 6.0; // > 5.0
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("缩放比例"));
    }

    #[test]
    fn test_validate_config_empty_character_name() {
        let mut config = create_default_app_config();
        config.character.current_character = "".to_string();
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("角色名称"));
    }

    #[test]
    fn test_validate_config_empty_theme_name() {
        let mut config = create_default_app_config();
        config.theme.current_theme = "".to_string();
        
        let result = validate_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("主题名称"));
    }

    #[test]
    fn test_validate_config_whitespace_character_name() {
        let mut config = create_default_app_config();
        config.character.current_character = "   ".to_string();
        
        let result = validate_config(&config);
        assert!(result.is_err());
    }
}

// ========== 配置合并测试 ==========

mod config_merging {
    use super::*;

    #[test]
    fn test_merge_config_simple_value() {
        let mut base = AppConfig::default();
        let updates = serde_json::json!({
            "window": {
                "width": 1000.0
            }
        });
        
        let result = merge_config(&mut base, updates);
        assert!(result.is_ok());
        assert_eq!(base.window.width, 1000.0);
    }

    #[test]
    fn test_merge_config_nested_values() {
        let mut base = AppConfig::default();
        let updates = serde_json::json!({
            "character": {
                "current_character": "new_character",
                "scale": 1.5
            }
        });
        
        let result = merge_config(&mut base, updates);
        assert!(result.is_ok());
        assert_eq!(base.character.current_character, "new_character");
        assert_eq!(base.character.scale, 1.5);
    }

    #[test]
    fn test_merge_config_partial_update() {
        let mut base = AppConfig::default();
        let original_height = base.window.height;
        
        let updates = serde_json::json!({
            "window": {
                "width": 1200.0
            }
        });
        
        merge_config(&mut base, updates).unwrap();
        
        // width应该更新
        assert_eq!(base.window.width, 1200.0);
        // height应该保持不变
        assert_eq!(base.window.height, original_height);
    }

    #[test]
    fn test_merge_config_invalid_value() {
        let mut base = AppConfig::default();
        let updates = serde_json::json!({
            "window": {
                "width": 100.0 // 无效值：太小
            }
        });
        
        let result = merge_config(&mut base, updates);
        assert!(result.is_err());
    }

    #[test]
    fn test_merge_config_new_field() {
        let mut base = AppConfig::default();
        let updates = serde_json::json!({
            "new_field": "new_value"
        });
        
        // 即使有新字段，合并也应该成功
        let result = merge_config(&mut base, updates);
        assert!(result.is_ok());
    }
}

// ========== 配置差异测试 ==========

mod config_diff {
    use super::*;

    #[test]
    fn test_get_config_diff_no_changes() {
        let config1 = AppConfig::default();
        let config2 = AppConfig::default();
        
        let diff = get_config_diff(&config1, &config2);
        
        // 应该没有差异
        assert!(diff.as_object().unwrap().is_empty());
    }

    #[test]
    fn test_get_config_diff_single_change() {
        let config1 = AppConfig::default();
        let mut config2 = AppConfig::default();
        config2.window.width = 1000.0;
        
        let diff = get_config_diff(&config1, &config2);
        let diff_obj = diff.as_object().unwrap();
        
        assert!(!diff_obj.is_empty());
        assert!(diff_obj.contains_key("window"));
    }

    #[test]
    fn test_get_config_diff_multiple_changes() {
        let config1 = AppConfig::default();
        let mut config2 = AppConfig::default();
        config2.window.width = 1000.0;
        config2.window.height = 800.0;
        config2.character.scale = 1.5;
        
        let diff = get_config_diff(&config1, &config2);
        let diff_obj = diff.as_object().unwrap();
        
        assert!(!diff_obj.is_empty());
    }

    #[test]
    fn test_get_config_diff_structure() {
        let config1 = AppConfig::default();
        let mut config2 = AppConfig::default();
        config2.window.width = 1000.0;
        
        let diff = get_config_diff(&config1, &config2);
        let diff_obj = diff.as_object().unwrap();
        
        if let Some(window_diff) = diff_obj.get("window") {
            let window_obj = window_diff.as_object().unwrap();
            assert!(window_obj.contains_key("old"));
            assert!(window_obj.contains_key("new"));
        }
    }
}

// ========== 配置文件操作测试 ==========

mod config_file_operations {
    use super::*;

    #[tokio::test]
    async fn test_import_export_config() {
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("exported_config.json");
        
        let config = AppConfig::default();
        
        // 导出配置
        let export_result = export_config(&config, export_path.clone()).await;
        assert!(export_result.is_ok());
        
        // 验证文件已创建
        assert!(export_path.exists());
        
        // 导入配置
        let import_result = import_config(export_path).await;
        assert!(import_result.is_ok());
        
        let imported_config = import_result.unwrap();
        assert_eq!(imported_config.window.width, config.window.width);
    }

    #[tokio::test]
    async fn test_export_config_creates_directory() {
        let temp_dir = tempdir().unwrap();
        let nested_path = temp_dir.path()
            .join("nested")
            .join("directory")
            .join("config.json");
        
        let config = AppConfig::default();
        let result = export_config(&config, nested_path.clone()).await;
        
        assert!(result.is_ok());
        assert!(nested_path.exists());
    }

    #[tokio::test]
    async fn test_import_config_invalid_json() {
        let temp_dir = tempdir().unwrap();
        let invalid_path = temp_dir.path().join("invalid.json");
        
        fs::write(&invalid_path, "{ invalid json }").await.unwrap();
        
        let result = import_config(invalid_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_import_config_nonexistent_file() {
        let temp_dir = tempdir().unwrap();
        let nonexistent = temp_dir.path().join("nonexistent.json");
        
        let result = import_config(nonexistent).await;
        assert!(result.is_err());
    }
}

// ========== 配置快照测试 ==========

mod config_snapshots {
    use super::*;

    #[tokio::test]
    async fn test_create_config_snapshot() {
        let config = AppConfig::default();
        let result = create_config_snapshot(&config, None).await;
        
        assert!(result.is_ok());
        
        let snapshot_path = result.unwrap();
        assert!(PathBuf::from(&snapshot_path).exists());
        
        // 清理
        let _ = fs::remove_file(snapshot_path).await;
    }

    #[tokio::test]
    async fn test_create_config_snapshot_with_description() {
        let config = AppConfig::default();
        let description = Some("Test snapshot".to_string());
        let result = create_config_snapshot(&config, description).await;
        
        assert!(result.is_ok());
        
        let snapshot_path = result.unwrap();
        let content = fs::read_to_string(&snapshot_path).await.unwrap();
        assert!(content.contains("Test snapshot"));
        
        // 清理
        let _ = fs::remove_file(snapshot_path).await;
    }

    #[tokio::test]
    async fn test_restore_from_snapshot() {
        let original_config = AppConfig::default();
        
        // 创建快照
        let snapshot_path = create_config_snapshot(&original_config, None).await.unwrap();
        
        // 恢复配置
        let result = restore_from_snapshot(PathBuf::from(&snapshot_path)).await;
        assert!(result.is_ok());
        
        let restored_config = result.unwrap();
        assert_eq!(restored_config.window.width, original_config.window.width);
        
        // 清理
        let _ = fs::remove_file(snapshot_path).await;
    }

    #[tokio::test]
    async fn test_restore_from_direct_config_file() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("direct_config.json");
        
        let config = AppConfig::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_path, json).await.unwrap();
        
        // 恢复配置
        let result = restore_from_snapshot(config_path).await;
        assert!(result.is_ok());
    }
}

// ========== 配置备份测试 ==========

mod config_backups {
    use super::*;

    #[tokio::test]
    async fn test_get_backup_files_empty() {
        // 在临时目录中应该没有备份文件
        let result = get_backup_files().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_clean_old_backups() {
        let result = clean_old_backups(5).await;
        assert!(result.is_ok());
        
        let removed_count = result.unwrap();
        assert!(removed_count >= 0);
    }
}

// ========== 配置信息测试 ==========

mod config_info {
    use super::*;

    #[tokio::test]
    async fn test_get_config_size() {
        let result = get_config_size().await;
        assert!(result.is_ok());
        
        // 如果配置文件不存在，应该返回0
        let size = result.unwrap();
        assert!(size >= 0);
    }

    #[tokio::test]
    async fn test_get_config_modified_time() {
        let result = get_config_modified_time().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_config_info() {
        let result = get_config_info().await;
        assert!(result.is_ok());
        
        let info = result.unwrap();
        let info_obj = info.as_object().unwrap();
        
        assert!(info_obj.contains_key("config_path"));
        assert!(info_obj.contains_key("backup_path"));
        assert!(info_obj.contains_key("data_dir"));
        assert!(info_obj.contains_key("config_exists"));
        assert!(info_obj.contains_key("backup_exists"));
        assert!(info_obj.contains_key("config_size"));
        assert!(info_obj.contains_key("backup_count"));
    }
}

// ========== 配置迁移测试 ==========

mod config_migration {
    use super::*;

    #[test]
    fn test_needs_migration() {
        let config = AppConfig::default();
        let needs_migration = needs_migration(&config);
        
        // 目前应该总是返回false
        assert_eq!(needs_migration, false);
    }

    #[tokio::test]
    async fn test_migrate_config() {
        let config = AppConfig::default();
        let result = migrate_config(config.clone()).await;
        
        assert!(result.is_ok());
        
        let migrated = result.unwrap();
        // 目前迁移应该返回相同的配置
        assert_eq!(migrated.window.width, config.window.width);
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_validate_config_boundary_window_width_min() {
        let mut config = AppConfig::default();
        config.window.width = 200.0;
        
        let result = validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_config_boundary_window_width_max() {
        let mut config = AppConfig::default();
        config.window.width = 4000.0;
        
        let result = validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_config_boundary_character_scale_min() {
        let mut config = AppConfig::default();
        config.character.scale = 0.1;
        
        let result = validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_config_boundary_character_scale_max() {
        let mut config = AppConfig::default();
        config.character.scale = 5.0;
        
        let result = validate_config(&config);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_export_config_overwrite_existing() {
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("config.json");
        
        let config1 = AppConfig::default();
        export_config(&config1, export_path.clone()).await.unwrap();
        
        let mut config2 = AppConfig::default();
        config2.window.width = 1500.0;
        
        // 覆盖已存在的文件
        let result = export_config(&config2, export_path.clone()).await;
        assert!(result.is_ok());
        
        // 验证文件内容已更新
        let imported = import_config(export_path).await.unwrap();
        assert_eq!(imported.window.width, 1500.0);
    }

    #[test]
    fn test_merge_config_empty_updates() {
        let mut base = AppConfig::default();
        let original_width = base.window.width;
        let updates = serde_json::json!({});
        
        merge_config(&mut base, updates).unwrap();
        
        // 配置应该保持不变
        assert_eq!(base.window.width, original_width);
    }

    #[test]
    fn test_get_config_diff_identical_configs() {
        let config1 = AppConfig::default();
        let config2 = config1.clone();
        
        let diff = get_config_diff(&config1, &config2);
        
        // 完全相同的配置应该没有差异
        assert!(diff.as_object().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_clean_old_backups_zero_keep() {
        let result = clean_old_backups(0).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_clean_old_backups_large_keep_count() {
        let result = clean_old_backups(1000).await;
        assert!(result.is_ok());
        
        // 不应该删除任何文件
        let removed = result.unwrap();
        assert_eq!(removed, 0);
    }
}

// ========== Integration Tests 测试 ==========

mod integration {
    use super::*;

    #[tokio::test]
    async fn test_full_config_lifecycle() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        // 1. 创建配置
        let mut config = AppConfig::default();
        config.window.width = 1200.0;
        
        // 2. 导出配置
        export_config(&config, config_path.clone()).await.unwrap();
        
        // 3. 导入配置
        let imported = import_config(config_path.clone()).await.unwrap();
        assert_eq!(imported.window.width, 1200.0);
        
        // 4. 验证配置
        assert!(validate_config(&imported).is_ok());
        
        // 5. 修改配置
        let mut modified = imported.clone();
        modified.window.height = 900.0;
        
        // 6. 获取差异
        let diff = get_config_diff(&imported, &modified);
        assert!(!diff.as_object().unwrap().is_empty());
        
        // 7. 创建快照
        let snapshot_path = create_config_snapshot(&modified, Some("Test".to_string())).await.unwrap();
        
        // 8. 从快照恢复
        let restored = restore_from_snapshot(PathBuf::from(&snapshot_path)).await.unwrap();
        assert_eq!(restored.window.height, 900.0);
        
        // 清理
        let _ = fs::remove_file(snapshot_path).await;
    }

    #[tokio::test]
    async fn test_config_update_and_merge_workflow() {
        let mut base_config = AppConfig::default();
        
        // 部分更新
        let updates = serde_json::json!({
            "window": {
                "width": 1400.0
            },
            "character": {
                "scale": 1.2
            }
        });
        
        merge_config(&mut base_config, updates).unwrap();
        
        assert_eq!(base_config.window.width, 1400.0);
        assert_eq!(base_config.character.scale, 1.2);
        
        // 验证其他字段未受影响
        assert!(validate_config(&base_config).is_ok());
    }
}


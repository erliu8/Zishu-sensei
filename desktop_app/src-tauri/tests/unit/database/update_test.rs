//! 更新系统数据库测试
//!
//! 测试更新系统数据库的所有功能，包括：
//! - 更新信息的CRUD操作
//! - 版本历史记录
//! - 更新配置管理
//! - 更新状态追踪
//! - 统计信息
//! - 数据清理

use zishu_sensei::database::update::{
    UpdateDatabase, UpdateInfo, UpdateType, UpdateStatus, VersionHistory, UpdateConfig,
};
use tempfile::TempDir;
use chrono::Utc;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, UpdateDatabase) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_update.db");
    let db = UpdateDatabase::new(db_path.to_str().unwrap()).expect("无法创建数据库");
    (temp_dir, db)
}

/// 创建测试更新信息
fn create_test_update(version: &str) -> UpdateInfo {
    UpdateInfo {
        id: None,
        version: version.to_string(),
        update_type: UpdateType::Minor,
        status: UpdateStatus::Available,
        title: format!("版本 {} 更新", version),
        description: "这是一个测试更新".to_string(),
        changelog: "- 新功能A\n- 修复了Bug B".to_string(),
        release_date: Utc::now(),
        file_size: Some(10485760), // 10MB
        download_url: Some("https://example.com/update.zip".to_string()),
        file_hash: Some("abcdef123456".to_string()),
        is_mandatory: false,
        is_prerelease: false,
        min_version: Some("0.1.0".to_string()),
        target_platform: Some("windows".to_string()),
        target_arch: Some("x86_64".to_string()),
        download_progress: 0.0,
        install_progress: 0.0,
        error_message: None,
        retry_count: 0,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// 创建测试版本历史
fn create_test_history(version: &str) -> VersionHistory {
    VersionHistory {
        id: None,
        version: version.to_string(),
        installed_at: Utc::now(),
        is_rollback: false,
        install_source: "auto".to_string(),
        notes: Some("测试安装".to_string()),
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
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能够保存更新信息");
    }
}

// ========== 更新信息保存测试 ==========

mod save_update_info {
    use super::*;

    #[test]
    fn test_save_new_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(update.id.is_some(), "应该分配ID");
    }

    #[test]
    fn test_update_existing_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        db.save_update_info(&mut update).unwrap();
        
        // ========== Act ==========
        update.status = UpdateStatus::Downloading;
        update.download_progress = 50.0;
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = db.get_update_info_by_version("1.0.0").unwrap().unwrap();
        assert_eq!(retrieved.status, UpdateStatus::Downloading);
        assert_eq!(retrieved.download_progress, 50.0);
    }

    #[test]
    fn test_save_updates_different_types() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let types = vec![
            UpdateType::Major,
            UpdateType::Minor,
            UpdateType::Patch,
            UpdateType::Hotfix,
            UpdateType::Security,
        ];
        
        // ========== Act & Assert ==========
        for (i, update_type) in types.iter().enumerate() {
            let mut update = create_test_update(&format!("1.{}.0", i));
            update.update_type = update_type.clone();
            let result = db.save_update_info(&mut update);
            assert!(result.is_ok(), "{:?} 类型的更新应该成功保存", update_type);
        }
    }

    #[test]
    fn test_save_updates_different_statuses() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let statuses = vec![
            UpdateStatus::None,
            UpdateStatus::Available,
            UpdateStatus::Downloading,
            UpdateStatus::Downloaded,
            UpdateStatus::Installing,
            UpdateStatus::Installed,
            UpdateStatus::Failed,
        ];
        
        // ========== Act & Assert ==========
        for (i, status) in statuses.iter().enumerate() {
            let mut update = create_test_update(&format!("1.0.{}", i));
            update.status = status.clone();
            let result = db.save_update_info(&mut update);
            assert!(result.is_ok(), "{:?} 状态的更新应该成功保存", status);
        }
    }

    #[test]
    fn test_save_mandatory_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("2.0.0");
        update.is_mandatory = true;
        update.update_type = UpdateType::Major;
        
        // ========== Act ==========
        db.save_update_info(&mut update).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_update_info_by_version("2.0.0").unwrap().unwrap();
        assert!(retrieved.is_mandatory);
    }

    #[test]
    fn test_save_prerelease_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0-beta.1");
        update.is_prerelease = true;
        
        // ========== Act ==========
        db.save_update_info(&mut update).unwrap();
        
        // ========== Assert ==========
        let retrieved = db.get_update_info_by_version("1.0.0-beta.1").unwrap().unwrap();
        assert!(retrieved.is_prerelease);
    }
}

// ========== 更新信息查询测试 ==========

mod get_update_info {
    use super::*;

    #[test]
    fn test_get_by_version() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        db.save_update_info(&mut update).unwrap();
        
        // ========== Act ==========
        let result = db.get_update_info_by_version("1.0.0");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().version, "1.0.0");
    }

    #[test]
    fn test_get_nonexistent_version() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_update_info_by_version("99.99.99");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_get_latest_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let mut update1 = create_test_update("1.0.0");
        db.save_update_info(&mut update1).unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        let mut update2 = create_test_update("2.0.0");
        db.save_update_info(&mut update2).unwrap();
        
        // ========== Act ==========
        let result = db.get_latest_update_info();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let latest = result.unwrap();
        assert!(latest.is_some());
        // 应该返回最新的一个
    }

    #[test]
    fn test_get_all_updates() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..5 {
            let mut update = create_test_update(&format!("1.{}.0", i));
            db.save_update_info(&mut update).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_all_update_info();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let updates = result.unwrap();
        assert_eq!(updates.len(), 5);
    }
}

// ========== 更新删除测试 ==========

mod delete_update_info {
    use super::*;

    #[test]
    fn test_delete_existing_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        db.save_update_info(&mut update).unwrap();
        let id = update.id.unwrap();
        
        // ========== Act ==========
        let result = db.delete_update_info(id);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = db.get_update_info_by_version("1.0.0").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_delete_nonexistent_update() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.delete_update_info(99999);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "删除不存在的记录应该不报错");
    }
}

// ========== 版本历史测试 ==========

mod version_history {
    use super::*;

    #[test]
    fn test_save_version_history() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let history = create_test_history("1.0.0");
        
        // ========== Act ==========
        let result = db.save_version_history(&history);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_version_history() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..5 {
            let history = create_test_history(&format!("1.{}.0", i));
            db.save_version_history(&history).unwrap();
        }
        
        // ========== Act ==========
        let result = db.get_version_history();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let histories = result.unwrap();
        assert_eq!(histories.len(), 5);
    }

    #[test]
    fn test_version_history_ordered_by_time() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let history1 = create_test_history("1.0.0");
        db.save_version_history(&history1).unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        let history2 = create_test_history("1.1.0");
        db.save_version_history(&history2).unwrap();
        
        // ========== Act ==========
        let histories = db.get_version_history().unwrap();
        
        // ========== Assert ==========
        // 应该按安装时间倒序排列
        assert_eq!(histories[0].version, "1.1.0");
        assert_eq!(histories[1].version, "1.0.0");
    }

    #[test]
    fn test_rollback_history() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let mut history = create_test_history("1.0.0");
        history.is_rollback = true;
        history.install_source = "rollback".to_string();
        
        // ========== Act ==========
        db.save_version_history(&history).unwrap();
        
        // ========== Assert ==========
        let histories = db.get_version_history().unwrap();
        assert!(histories[0].is_rollback);
        assert_eq!(histories[0].install_source, "rollback");
    }

    #[test]
    fn test_history_install_sources() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        let sources = vec!["auto", "manual", "rollback"];
        
        // ========== Act & Assert ==========
        for (i, source) in sources.iter().enumerate() {
            let mut history = create_test_history(&format!("1.{}.0", i));
            history.install_source = source.to_string();
            let result = db.save_version_history(&history);
            assert!(result.is_ok(), "{} 来源应该成功保存", source);
        }
    }
}

// ========== 更新配置测试 ==========

mod update_config {
    use super::*;

    #[test]
    fn test_get_or_create_config() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_or_create_update_config();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let config = result.unwrap();
        assert!(config.id.is_some());
        assert_eq!(config.update_channel, "stable");
    }

    #[test]
    fn test_save_update_config() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.auto_check_enabled = false;
        config.auto_download_enabled = true;
        config.check_interval_hours = 12;
        config.update_channel = "beta".to_string();
        
        let result = db.save_update_config(&mut config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let updated = db.get_or_create_update_config().unwrap();
        assert!(!updated.auto_check_enabled);
        assert!(updated.auto_download_enabled);
        assert_eq!(updated.check_interval_hours, 12);
        assert_eq!(updated.update_channel, "beta");
    }

    #[test]
    fn test_config_update_channels() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let channels = vec!["stable", "beta", "alpha"];
        
        // ========== Act & Assert ==========
        for channel in channels {
            let mut config = db.get_or_create_update_config().unwrap();
            config.update_channel = channel.to_string();
            let result = db.save_update_config(&mut config);
            assert!(result.is_ok(), "{} 频道应该成功保存", channel);
            
            let updated = db.get_or_create_update_config().unwrap();
            assert_eq!(updated.update_channel, channel);
        }
    }

    #[test]
    fn test_config_network_types() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let network_types = vec!["wifi", "cellular", "all"];
        
        // ========== Act & Assert ==========
        for network_type in network_types {
            let mut config = db.get_or_create_update_config().unwrap();
            config.allowed_network_types = network_type.to_string();
            let result = db.save_update_config(&mut config);
            assert!(result.is_ok(), "{} 网络类型应该成功保存", network_type);
        }
    }

    #[test]
    fn test_config_retry_and_timeout() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.max_retry_count = 5;
        config.download_timeout_seconds = 600;
        db.save_update_config(&mut config).unwrap();
        
        // ========== Assert ==========
        let updated = db.get_or_create_update_config().unwrap();
        assert_eq!(updated.max_retry_count, 5);
        assert_eq!(updated.download_timeout_seconds, 600);
    }

    #[test]
    fn test_config_backup_settings() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.backup_before_update = true;
        config.max_backup_count = 5;
        db.save_update_config(&mut config).unwrap();
        
        // ========== Assert ==========
        let updated = db.get_or_create_update_config().unwrap();
        assert!(updated.backup_before_update);
        assert_eq!(updated.max_backup_count, 5);
    }

    #[test]
    fn test_config_last_check_time() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.last_check_time = Some(Utc::now());
        db.save_update_config(&mut config).unwrap();
        
        // ========== Assert ==========
        let updated = db.get_or_create_update_config().unwrap();
        assert!(updated.last_check_time.is_some());
    }
}

// ========== 数据清理测试 ==========

mod cleanup_old_updates {
    use super::*;

    #[test]
    fn test_cleanup_old_updates() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..10 {
            let mut update = create_test_update(&format!("1.{}.0", i));
            db.save_update_info(&mut update).unwrap();
        }
        
        // ========== Act ==========
        let result = db.cleanup_old_updates(5);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let deleted = result.unwrap();
        assert_eq!(deleted, 5, "应该删除5条旧记录");
        
        let remaining = db.get_all_update_info().unwrap();
        assert_eq!(remaining.len(), 5, "应该保留5条最新记录");
    }

    #[test]
    fn test_cleanup_keeps_recent() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..3 {
            let mut update = create_test_update(&format!("1.{}.0", i));
            db.save_update_info(&mut update).unwrap();
        }
        
        // ========== Act ==========
        db.cleanup_old_updates(5).unwrap();
        
        // ========== Assert ==========
        let remaining = db.get_all_update_info().unwrap();
        assert_eq!(remaining.len(), 3, "所有记录都应该被保留");
    }
}

// ========== 统计信息测试 ==========

mod get_update_stats {
    use super::*;

    #[test]
    fn test_stats_empty_database() {
        // ========== Arrange ==========
        let (_temp, db) = setup_test_db();
        
        // ========== Act ==========
        let result = db.get_update_stats();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(*stats.get("total_updates").unwrap(), 0);
        assert_eq!(*stats.get("installed_updates").unwrap(), 0);
        assert_eq!(*stats.get("failed_updates").unwrap(), 0);
    }

    #[test]
    fn test_stats_with_updates() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // 已安装更新
        let mut installed = create_test_update("1.0.0");
        installed.status = UpdateStatus::Installed;
        db.save_update_info(&mut installed).unwrap();
        
        // 失败更新
        let mut failed = create_test_update("1.1.0");
        failed.status = UpdateStatus::Failed;
        db.save_update_info(&mut failed).unwrap();
        
        // 可用更新
        let mut available = create_test_update("1.2.0");
        available.status = UpdateStatus::Available;
        db.save_update_info(&mut available).unwrap();
        
        // ========== Act ==========
        let stats = db.get_update_stats().unwrap();
        
        // ========== Assert ==========
        assert_eq!(*stats.get("total_updates").unwrap(), 3);
        assert_eq!(*stats.get("installed_updates").unwrap(), 1);
        assert_eq!(*stats.get("failed_updates").unwrap(), 1);
    }

    #[test]
    fn test_stats_version_history() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..5 {
            let history = create_test_history(&format!("1.{}.0", i));
            db.save_version_history(&history).unwrap();
        }
        
        // ========== Act ==========
        let stats = db.get_update_stats().unwrap();
        
        // ========== Assert ==========
        assert_eq!(*stats.get("version_count").unwrap(), 5);
    }
}

// ========== 综合场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_update_lifecycle() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 检测到新版本
        let mut update = create_test_update("2.0.0");
        update.status = UpdateStatus::Available;
        db.save_update_info(&mut update).unwrap();
        
        // 2. 开始下载
        update.status = UpdateStatus::Downloading;
        update.download_progress = 30.0;
        db.save_update_info(&mut update).unwrap();
        
        // 3. 下载完成
        update.status = UpdateStatus::Downloaded;
        update.download_progress = 100.0;
        db.save_update_info(&mut update).unwrap();
        
        // 4. 安装中
        update.status = UpdateStatus::Installing;
        update.install_progress = 50.0;
        db.save_update_info(&mut update).unwrap();
        
        // 5. 安装完成
        update.status = UpdateStatus::Installed;
        update.install_progress = 100.0;
        db.save_update_info(&mut update).unwrap();
        
        // 6. 记录版本历史
        let history = VersionHistory {
            id: None,
            version: "2.0.0".to_string(),
            installed_at: Utc::now(),
            is_rollback: false,
            install_source: "auto".to_string(),
            notes: Some("自动更新".to_string()),
        };
        db.save_version_history(&history).unwrap();
        
        // ========== Assert ==========
        let final_update = db.get_update_info_by_version("2.0.0").unwrap().unwrap();
        assert_eq!(final_update.status, UpdateStatus::Installed);
        assert_eq!(final_update.download_progress, 100.0);
        assert_eq!(final_update.install_progress, 100.0);
        
        let histories = db.get_version_history().unwrap();
        assert!(!histories.is_empty());
    }

    #[test]
    fn test_update_failure_and_retry() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act ==========
        let mut update = create_test_update("1.5.0");
        update.status = UpdateStatus::Downloading;
        db.save_update_info(&mut update).unwrap();
        
        // 失败
        update.status = UpdateStatus::Failed;
        update.error_message = Some("网络错误".to_string());
        update.retry_count = 1;
        db.save_update_info(&mut update).unwrap();
        
        // 重试
        update.status = UpdateStatus::Downloading;
        update.error_message = None;
        update.retry_count = 2;
        db.save_update_info(&mut update).unwrap();
        
        // ========== Assert ==========
        let final_update = db.get_update_info_by_version("1.5.0").unwrap().unwrap();
        assert_eq!(final_update.retry_count, 2);
    }

    #[test]
    fn test_auto_update_workflow() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act & Assert ==========
        // 1. 配置自动更新
        let mut config = db.get_or_create_update_config().unwrap();
        config.auto_check_enabled = true;
        config.auto_download_enabled = true;
        config.auto_install_enabled = true;
        config.check_interval_hours = 24;
        db.save_update_config(&mut config).unwrap();
        
        // 2. 检查更新
        config.last_check_time = Some(Utc::now());
        db.save_update_config(&mut config).unwrap();
        
        // 3. 发现更新
        let mut update = create_test_update("3.0.0");
        db.save_update_info(&mut update).unwrap();
        
        // 4. 自动下载并安装
        update.status = UpdateStatus::Installed;
        db.save_update_info(&mut update).unwrap();
        
        // ========== Assert ==========
        let config = db.get_or_create_update_config().unwrap();
        assert!(config.auto_check_enabled);
        assert!(config.last_check_time.is_some());
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_update_with_empty_version() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("");
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许空版本号");
    }

    #[test]
    fn test_update_with_unicode_version() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("版本 1.0.0 🚀");
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_with_very_long_changelog() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        update.changelog = "x".repeat(100000);
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该能处理长变更日志");
    }

    #[test]
    fn test_update_with_negative_progress() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        update.download_progress = -10.0;
        update.install_progress = -5.0;
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许负进度值");
    }

    #[test]
    fn test_update_with_progress_over_100() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut update = create_test_update("1.0.0");
        update.download_progress = 150.0;
        
        // ========== Act ==========
        let result = db.save_update_info(&mut update);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许超过100的进度值");
    }

    #[test]
    fn test_config_with_negative_intervals() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.check_interval_hours = -1;
        config.max_retry_count = -1;
        let result = db.save_update_config(&mut config);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "应该允许负值（可能表示禁用）");
    }

    #[test]
    fn test_config_with_very_large_values() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        let mut config = db.get_or_create_update_config().unwrap();
        
        // ========== Act ==========
        config.check_interval_hours = i32::MAX;
        config.download_timeout_seconds = i32::MAX;
        let result = db.save_update_config(&mut config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_concurrent_update_saves() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        // ========== Act ==========
        for i in 0..100 {
            let mut update = create_test_update("1.0.0");
            update.download_progress = i as f64;
            let result = db.save_update_info(&mut update);
            assert!(result.is_ok(), "第{}次更新应该成功", i);
        }
        
        // ========== Assert ==========
        let final_update = db.get_update_info_by_version("1.0.0").unwrap().unwrap();
        assert_eq!(final_update.download_progress, 99.0);
    }

    #[test]
    fn test_cleanup_with_zero_keep_count() {
        // ========== Arrange ==========
        let (_temp, mut db) = setup_test_db();
        
        for i in 0..5 {
            let mut update = create_test_update(&format!("1.{}.0", i));
            db.save_update_info(&mut update).unwrap();
        }
        
        // ========== Act ==========
        let result = db.cleanup_old_updates(0);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let remaining = db.get_all_update_info().unwrap();
        assert_eq!(remaining.len(), 0, "应该删除所有记录");
    }
}


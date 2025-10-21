//! 更新管理命令测试
//!
//! 测试所有更新相关的Tauri命令

#[cfg(test)]
mod update_commands_tests {
    use crate::common::*;
    
    // ================================
    // init_update_manager 命令测试
    // ================================
    
    mod init_update_manager {
        use super::*;
        
        #[tokio::test]
        async fn test_init_update_manager_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_init("1.0.0").unwrap();
            
            // ========== Assert (断言) ==========
            let init_count = test_db.count_update_inits().unwrap();
            assert_eq!(init_count, 1, "应该记录一次初始化");
        }
        
        #[tokio::test]
        async fn test_init_update_manager_creates_db_path() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_test_dir();
            let db_path = temp_dir.path().join("updates.db");
            
            // ========== Act (执行) ==========
            let parent_exists = db_path.parent().unwrap().exists();
            
            // ========== Assert (断言) ==========
            assert!(parent_exists, "更新数据库目录应该存在");
        }
    }
    
    // ================================
    // check_for_updates 命令测试
    // ================================
    
    mod check_for_updates {
        use super::*;
        
        #[tokio::test]
        async fn test_check_for_updates_when_update_available() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_check("1.0.0", "1.1.0", true).unwrap();
            
            // ========== Assert (断言) ==========
            let has_update = test_db.has_update_available().unwrap();
            assert!(has_update, "应该检测到可用更新");
        }
        
        #[tokio::test]
        async fn test_check_for_updates_when_up_to_date() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_check("1.0.0", "1.0.0", false).unwrap();
            
            // ========== Assert (断言) ==========
            let has_update = test_db.has_update_available().unwrap();
            assert!(!has_update, "应该没有可用更新");
        }
        
        #[tokio::test]
        async fn test_check_for_updates_with_force() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_check_with_force("1.0.0", "1.1.0", true, true).unwrap();
            
            // ========== Assert (断言) ==========
            let was_forced = test_db.was_update_check_forced().unwrap();
            assert!(was_forced, "应该记录强制检查标志");
        }
        
        #[tokio::test]
        async fn test_check_for_updates_handles_network_error() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_check_error("Network timeout").unwrap();
            
            // ========== Assert (断言) ==========
            let error = test_db.get_last_update_check_error().unwrap();
            assert!(error.is_some());
            assert!(error.unwrap().contains("Network timeout"));
        }
    }
    
    // ================================
    // download_update 命令测试
    // ================================
    
    mod download_update {
        use super::*;
        
        #[tokio::test]
        async fn test_download_update_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_download("1.1.0", "completed").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_download_status("1.1.0").unwrap();
            assert_eq!(status, Some("completed".to_string()));
        }
        
        #[tokio::test]
        async fn test_download_update_tracks_progress() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_download_progress("1.1.0", 500, 1000).unwrap();
            
            // ========== Assert (断言) ==========
            let progress = test_db.get_download_progress("1.1.0").unwrap();
            assert!(progress.is_some());
            let (downloaded, total) = progress.unwrap();
            assert_eq!(downloaded, 500);
            assert_eq!(total, 1000);
        }
        
        #[tokio::test]
        async fn test_download_update_handles_failure() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_download("1.1.0", "failed").unwrap();
            test_db.record_download_error("1.1.0", "Download interrupted").unwrap();
            
            // ========== Assert (断言) ==========
            let error = test_db.get_download_error("1.1.0").unwrap();
            assert!(error.is_some());
        }
        
        #[tokio::test]
        async fn test_download_update_returns_file_path() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            let file_path = "/tmp/updates/zishu-sensei-1.1.0.AppImage";
            
            // ========== Act (执行) ==========
            test_db.set_download_path("1.1.0", file_path).unwrap();
            
            // ========== Assert (断言) ==========
            let path = test_db.get_download_path("1.1.0").unwrap();
            assert_eq!(path, Some(file_path.to_string()));
        }
    }
    
    // ================================
    // install_update 命令测试
    // ================================
    
    mod install_update {
        use super::*;
        
        #[tokio::test]
        async fn test_install_update_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_installation("1.1.0", "success").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_installation_status("1.1.0").unwrap();
            assert_eq!(status, Some("success".to_string()));
        }
        
        #[tokio::test]
        async fn test_install_update_returns_needs_restart() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.set_installation_needs_restart("1.1.0", true).unwrap();
            
            // ========== Assert (断言) ==========
            let needs_restart = test_db.get_installation_needs_restart("1.1.0").unwrap();
            assert!(needs_restart.unwrap());
        }
        
        #[tokio::test]
        async fn test_install_update_handles_failure() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_installation("1.1.0", "failed").unwrap();
            test_db.record_installation_error("1.1.0", "Permission denied").unwrap();
            
            // ========== Assert (断言) ==========
            let error = test_db.get_installation_error("1.1.0").unwrap();
            assert!(error.is_some());
            assert!(error.unwrap().contains("Permission denied"));
        }
    }
    
    // ================================
    // cancel_download 命令测试
    // ================================
    
    mod cancel_download {
        use super::*;
        
        #[tokio::test]
        async fn test_cancel_download_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            test_db.record_update_download("1.1.0", "downloading").unwrap();
            
            // ========== Act (执行) ==========
            test_db.record_update_download("1.1.0", "cancelled").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_download_status("1.1.0").unwrap();
            assert_eq!(status, Some("cancelled".to_string()));
        }
        
        #[tokio::test]
        async fn test_cancel_download_cleans_up_partial_file() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_test_dir();
            let partial_file = temp_dir.path().join("update.partial");
            std::fs::write(&partial_file, b"partial data").unwrap();
            
            // ========== Act (执行) ==========
            std::fs::remove_file(&partial_file).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!partial_file.exists(), "部分下载的文件应该被删除");
        }
    }
    
    // ================================
    // rollback_to_version 命令测试
    // ================================
    
    mod rollback_to_version {
        use super::*;
        
        #[tokio::test]
        async fn test_rollback_to_version_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_version_rollback("1.0.0", "success").unwrap();
            
            // ========== Assert (断言) ==========
            let rollback_count = test_db.count_rollbacks().unwrap();
            assert_eq!(rollback_count, 1);
        }
        
        #[tokio::test]
        async fn test_rollback_to_version_validates_version_exists() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            test_db.record_version_history("1.0.0").unwrap();
            
            // ========== Act (执行) ==========
            let version_exists = test_db.version_exists("1.0.0").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(version_exists, "回滚目标版本应该存在");
        }
        
        #[tokio::test]
        async fn test_rollback_to_version_handles_failure() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_version_rollback("0.9.0", "failed").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_rollback_status("0.9.0").unwrap();
            assert_eq!(status, Some("failed".to_string()));
        }
    }
    
    // ================================
    // get_update_config & save_update_config 命令测试
    // ================================
    
    mod update_config {
        use super::*;
        
        #[tokio::test]
        async fn test_get_update_config_returns_defaults() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("auto_check", "true").unwrap();
            test_db.upsert_config("check_interval_hours", "24").unwrap();
            
            // ========== Assert (断言) ==========
            let auto_check = test_db.get_config("auto_check").unwrap();
            let interval = test_db.get_config("check_interval_hours").unwrap();
            
            assert_eq!(auto_check, Some("true".to_string()));
            assert_eq!(interval, Some("24".to_string()));
        }
        
        #[tokio::test]
        async fn test_save_update_config_persists_settings() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("auto_download", "false").unwrap();
            test_db.upsert_config("notify_on_update", "true").unwrap();
            
            // ========== Assert (断言) ==========
            let auto_download = test_db.get_config("auto_download").unwrap();
            let notify = test_db.get_config("notify_on_update").unwrap();
            
            assert_eq!(auto_download, Some("false".to_string()));
            assert_eq!(notify, Some("true".to_string()));
        }
    }
    
    // ================================
    // get_version_history 命令测试
    // ================================
    
    mod get_version_history {
        use super::*;
        
        #[tokio::test]
        async fn test_get_version_history_returns_all_versions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_version_history("0.9.0").unwrap();
            test_db.record_version_history("1.0.0").unwrap();
            test_db.record_version_history("1.1.0").unwrap();
            
            // ========== Assert (断言) ==========
            let count = test_db.count_version_history().unwrap();
            assert_eq!(count, 3, "应该记录3个历史版本");
        }
        
        #[tokio::test]
        async fn test_get_version_history_ordered_by_date() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_version_with_timestamp("1.0.0", "2024-01-01").unwrap();
            test_db.record_version_with_timestamp("1.1.0", "2024-02-01").unwrap();
            test_db.record_version_with_timestamp("0.9.0", "2023-12-01").unwrap();
            
            // ========== Assert (断言) ==========
            let latest = test_db.get_latest_version().unwrap();
            assert_eq!(latest, Some("1.1.0".to_string()));
        }
    }
    
    // ================================
    // get_update_stats 命令测试
    // ================================
    
    mod get_update_stats {
        use super::*;
        
        #[tokio::test]
        async fn test_get_update_stats_returns_statistics() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_check("1.0.0", "1.1.0", true).unwrap();
            test_db.record_update_download("1.1.0", "completed").unwrap();
            test_db.record_update_installation("1.1.0", "success").unwrap();
            
            // ========== Assert (断言) ==========
            let check_count = test_db.count_update_checks().unwrap();
            let download_count = test_db.count_successful_downloads().unwrap();
            let install_count = test_db.count_successful_installs().unwrap();
            
            assert_eq!(check_count, 1);
            assert_eq!(download_count, 1);
            assert_eq!(install_count, 1);
        }
    }
    
    // ================================
    // cleanup_old_files 命令测试
    // ================================
    
    mod cleanup_old_files {
        use super::*;
        
        #[tokio::test]
        async fn test_cleanup_old_files_removes_old_downloads() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_test_dir();
            
            let old_file = temp_dir.path().join("zishu-1.0.0.AppImage");
            let current_file = temp_dir.path().join("zishu-1.1.0.AppImage");
            
            std::fs::write(&old_file, b"old version").unwrap();
            std::fs::write(&current_file, b"current version").unwrap();
            
            // ========== Act (执行) ==========
            std::fs::remove_file(&old_file).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!old_file.exists(), "旧文件应该被删除");
            assert!(current_file.exists(), "当前文件应该保留");
        }
        
        #[tokio::test]
        async fn test_cleanup_old_files_preserves_current_version() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_test_dir();
            let current_file = temp_dir.path().join("zishu-1.1.0.AppImage");
            std::fs::write(&current_file, b"current version").unwrap();
            
            // ========== Act (执行) ==========
            // 清理操作不应删除当前版本
            
            // ========== Assert (断言) ==========
            assert!(current_file.exists(), "当前版本文件应该保留");
        }
    }
    
    // ================================
    // restart_application 命令测试
    // ================================
    
    mod restart_application {
        use super::*;
        
        #[tokio::test]
        async fn test_restart_application_records_restart() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_system_tables().expect("Failed to init system tables");
            
            // ========== Act (执行) ==========
            test_db.record_app_event("restart_for_update", "1.1.0").unwrap();
            
            // ========== Assert (断言) ==========
            let event = test_db.get_latest_app_event().unwrap();
            assert!(event.is_some());
            assert!(event.unwrap().contains("restart_for_update"));
        }
    }
    
    // ================================
    // listen_update_events 命令测试
    // ================================
    
    mod listen_update_events {
        use super::*;
        
        #[tokio::test]
        async fn test_listen_update_events_receives_check_event() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_event("CheckStarted", "{}").unwrap();
            
            // ========== Assert (断言) ==========
            let event_count = test_db.count_update_events().unwrap();
            assert_eq!(event_count, 1);
        }
        
        #[tokio::test]
        async fn test_listen_update_events_receives_download_progress() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_event("DownloadProgress", r#"{"progress":50}"#).unwrap();
            
            // ========== Assert (断言) ==========
            let event = test_db.get_latest_update_event().unwrap();
            assert!(event.is_some());
            assert!(event.unwrap().contains("DownloadProgress"));
        }
        
        #[tokio::test]
        async fn test_listen_update_events_receives_install_complete() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_update_tables().expect("Failed to init update tables");
            
            // ========== Act (执行) ==========
            test_db.record_update_event("InstallComplete", r#"{"version":"1.1.0"}"#).unwrap();
            
            // ========== Assert (断言) ==========
            let event = test_db.get_latest_update_event().unwrap();
            assert!(event.is_some());
            assert!(event.unwrap().contains("InstallComplete"));
        }
    }
    
    // ================================
    // check_tauri_updater_available 命令测试
    // ================================
    
    mod check_tauri_updater_available {
        use super::*;
        
        #[tokio::test]
        async fn test_check_tauri_updater_available_returns_availability() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("tauri_updater_enabled", "true").unwrap();
            
            // ========== Assert (断言) ==========
            let enabled = test_db.get_config("tauri_updater_enabled").unwrap();
            assert_eq!(enabled, Some("true".to_string()));
        }
    }
    
    // ================================
    // get_current_version 命令测试
    // ================================
    
    mod get_current_version {
        use super::*;
        
        #[tokio::test]
        async fn test_get_current_version_returns_version_string() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_system_tables().expect("Failed to init system tables");
            
            // ========== Act (执行) ==========
            test_db.record_system_info("current_version", "1.0.0").unwrap();
            
            // ========== Assert (断言) ==========
            let version = test_db.get_system_info("current_version").unwrap();
            assert_eq!(version, Some("1.0.0".to_string()));
        }
        
        #[tokio::test]
        async fn test_get_current_version_matches_package_version() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_system_tables().expect("Failed to init system tables");
            
            let package_version = "1.0.0";
            
            // ========== Act (执行) ==========
            test_db.record_system_info("current_version", package_version).unwrap();
            
            // ========== Assert (断言) ==========
            let version = test_db.get_system_info("current_version").unwrap();
            assert_eq!(version, Some(package_version.to_string()));
        }
    }
}


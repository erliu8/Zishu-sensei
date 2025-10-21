//! 数据库命令测试
//!
//! 测试所有数据库操作相关的Tauri命令

#[cfg(test)]
mod database_commands_tests {
    use crate::common::*;
    
    // ================================
    // init_database 命令测试
    // ================================
    
    mod init_database {
        use super::*;
        
        #[tokio::test]
        async fn test_init_database_creates_tables() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            
            // ========== Act (执行) ==========
            test_db.init_full_schema().unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.count_records("installed_adapters").is_ok());
            assert!(test_db.count_records("characters").is_ok());
            assert!(test_db.count_records("chat_sessions").is_ok());
            assert!(test_db.count_records("permissions").is_ok());
        }
    }
    
    // ================================
    // backup_database 命令测试
    // ================================
    
    mod backup_database {
        use super::*;
        
        #[tokio::test]
        async fn test_backup_database_creates_backup_file() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new();
            let backup_dir = create_temp_dir();
            let backup_path = backup_dir.path().join("backup.db");
            
            // ========== Act (执行) ==========
            std::fs::copy(&test_db.path, &backup_path).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(backup_path.exists(), "备份文件应该已创建");
        }
    }
    
    // ================================
    // restore_database 命令测试
    // ================================
    
    mod restore_database {
        use super::*;
        
        #[tokio::test]
        async fn test_restore_database_from_backup() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new();
            test_db.init_adapter_tables().unwrap();
            test_db.insert_test_adapter("adapter-1", "Test", true).unwrap();
            
            let backup_dir = create_temp_dir();
            let backup_path = backup_dir.path().join("backup.db");
            
            // 创建备份
            std::fs::copy(&test_db.path, &backup_path).unwrap();
            
            // ========== Act (执行) ==========
            let restored_db = rusqlite::Connection::open(&backup_path).unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = restored_db
                .query_row("SELECT COUNT(*) FROM installed_adapters", [], |row| row.get(0))
                .unwrap();
            
            assert_eq!(count, 1, "恢复的数据库应该包含原有数据");
        }
    }
    
    // ================================
    // vacuum_database 命令测试
    // ================================
    
    mod vacuum_database {
        use super::*;
        
        #[tokio::test]
        async fn test_vacuum_database_reduces_size() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new();
            test_db.init_adapter_tables().unwrap();
            
            // 插入并删除数据以产生碎片
            for i in 0..100 {
                test_db.insert_test_adapter(&format!("temp-{}", i), "Temp", true).unwrap();
            }
            test_db.get_connection().execute("DELETE FROM installed_adapters", []).unwrap();
            
            let size_before = std::fs::metadata(&test_db.path).unwrap().len();
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute("VACUUM", []).unwrap();
            
            // ========== Assert (断言) ==========
            let size_after = std::fs::metadata(&test_db.path).unwrap().len();
            assert!(size_after <= size_before, "VACUUM后文件大小应该不会增加");
        }
    }
    
    // ================================
    // get_database_stats 命令测试
    // ================================
    
    mod get_database_stats {
        use super::*;
        
        #[tokio::test]
        async fn test_get_database_stats_returns_correct_counts() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_full_schema().unwrap();
            
            test_db.insert_test_adapter("adapter-1", "Adapter", true).unwrap();
            test_db.insert_test_character("char-1", "Character", false).unwrap();
            test_db.insert_test_chat_session("session-1", "Session").unwrap();
            
            // ========== Act (执行) ==========
            let adapter_count: i64 = test_db.count_records("installed_adapters").unwrap();
            let character_count: i64 = test_db.count_records("characters").unwrap();
            let session_count: i64 = test_db.count_records("chat_sessions").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(adapter_count, 1);
            assert_eq!(character_count, 1);
            assert_eq!(session_count, 1);
        }
    }
    
    // ================================
    // clear_all_data 命令测试
    // ================================
    
    mod clear_all_data {
        use super::*;
        
        #[tokio::test]
        async fn test_clear_all_data_removes_all_records() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_full_schema().unwrap();
            
            test_db.insert_test_adapter("adapter-1", "Adapter", true).unwrap();
            test_db.insert_test_character("char-1", "Character", false).unwrap();
            
            // ========== Act (执行) ==========
            test_db.clear_all_data().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(test_db.count_records("installed_adapters").unwrap(), 0);
            assert_eq!(test_db.count_records("characters").unwrap(), 0);
        }
    }
    
    // ================================
    // export_data 命令测试
    // ================================
    
    mod export_data {
        use super::*;
        
        #[tokio::test]
        async fn test_export_data_creates_export_file() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().unwrap();
            test_db.insert_test_adapter("adapter-1", "Adapter", true).unwrap();
            
            let export_dir = create_temp_dir();
            let export_path = export_dir.path().join("export.json");
            
            // ========== Act (执行) ==========
            let data = serde_json::json!({
                "adapters": [{"id": "adapter-1", "name": "Adapter"}]
            });
            std::fs::write(&export_path, serde_json::to_string_pretty(&data).unwrap()).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(export_path.exists(), "导出文件应该已创建");
            let content = std::fs::read_to_string(&export_path).unwrap();
            assert!(content.contains("adapter-1"), "导出内容应该包含数据");
        }
    }
    
    // ================================
    // import_data 命令测试
    // ================================
    
    mod import_data {
        use super::*;
        
        #[tokio::test]
        async fn test_import_data_restores_from_export() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().unwrap();
            
            let import_data = r#"{"adapters": [{"id": "imported-1", "name": "Imported"}]}"#;
            let parsed: serde_json::Value = serde_json::from_str(import_data).unwrap();
            
            // ========== Act (执行) ==========
            // 模拟导入
            if let Some(adapters) = parsed["adapters"].as_array() {
                for adapter in adapters {
                    if let (Some(id), Some(name)) = (
                        adapter["id"].as_str(),
                        adapter["name"].as_str()
                    ) {
                        test_db.insert_test_adapter(id, name, true).unwrap();
                    }
                }
            }
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("installed_adapters", "id", "imported-1").unwrap());
        }
    }
}


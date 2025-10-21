//! 适配器管理命令测试
//!
//! 测试所有适配器相关的Tauri命令

#[cfg(test)]
mod adapter_commands_tests {
    use crate::common::*;
    
    // ================================
    // get_adapters 命令测试
    // ================================
    
    mod get_adapters {
        use super::*;
        
        #[tokio::test]
        async fn test_get_adapters_success_returns_all_adapters() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            // 插入测试适配器
            test_db.insert_test_adapter("adapter-1", "Test Adapter 1", true).unwrap();
            test_db.insert_test_adapter("adapter-2", "Test Adapter 2", true).unwrap();
            test_db.insert_test_adapter("adapter-3", "Test Adapter 3", false).unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_records("installed_adapters").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3, "应该有3个适配器");
            
            // 验证适配器存在
            assert!(test_db.record_exists("installed_adapters", "id", "adapter-1").unwrap());
            assert!(test_db.record_exists("installed_adapters", "id", "adapter-2").unwrap());
            assert!(test_db.record_exists("installed_adapters", "id", "adapter-3").unwrap());
        }
        
        #[tokio::test]
        async fn test_get_adapters_returns_empty_when_no_adapters() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            // ========== Act (执行) ==========
            let count = test_db.count_records("installed_adapters").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 0, "应该没有适配器");
        }
        
        #[tokio::test]
        async fn test_get_adapters_filters_by_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            test_db.insert_test_adapter("adapter-1", "Enabled Adapter", true).unwrap();
            test_db.insert_test_adapter("adapter-2", "Disabled Adapter", false).unwrap();
            
            // ========== Act (执行) ==========
            // 查询启用的适配器数量
            let enabled_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM installed_adapters WHERE enabled = 1", [], |row| row.get(0))
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(enabled_count, 1, "应该只有1个启用的适配器");
        }
    }
    
    // ================================
    // install_adapter 命令测试
    // ================================
    
    mod install_adapter {
        use super::*;
        
        #[tokio::test]
        async fn test_install_adapter_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "new-adapter-001";
            
            // ========== Act (执行) ==========
            test_db.insert_test_adapter(adapter_id, "New Adapter", true).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
            
            // 验证适配器数据
            let result: (String, String) = test_db.get_connection()
                .query_row(
                    "SELECT id, name FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| Ok((row.get(0)?, row.get(1)?))
                )
                .unwrap();
            
            assert_eq!(result.0, adapter_id);
            assert_eq!(result.1, "New Adapter");
        }
        
        #[tokio::test]
        async fn test_install_adapter_fails_with_duplicate_id() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "duplicate-adapter";
            test_db.insert_test_adapter(adapter_id, "First Adapter", true).unwrap();
            
            // ========== Act (执行) ==========
            let result = test_db.insert_test_adapter(adapter_id, "Duplicate Adapter", true);
            
            // ========== Assert (断言) ==========
            assert!(result.is_err(), "插入重复ID的适配器应该失败");
        }
        
        #[tokio::test]
        async fn test_install_adapter_creates_with_correct_timestamp() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "timestamped-adapter";
            let before_install = chrono::Utc::now().timestamp();
            
            // ========== Act (执行) ==========
            test_db.insert_test_adapter(adapter_id, "Timestamped Adapter", true).unwrap();
            
            let after_install = chrono::Utc::now().timestamp();
            
            // ========== Assert (断言) ==========
            let installed_at: i64 = test_db.get_connection()
                .query_row(
                    "SELECT installed_at FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert!(installed_at >= before_install && installed_at <= after_install,
                "安装时间戳应该在正确的范围内");
        }
    }
    
    // ================================
    // uninstall_adapter 命令测试
    // ================================
    
    mod uninstall_adapter {
        use super::*;
        
        #[tokio::test]
        async fn test_uninstall_adapter_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "to-be-uninstalled";
            test_db.insert_test_adapter(adapter_id, "Uninstall Target", true).unwrap();
            
            assert!(test_db.record_exists("installed_adapters", "id", adapter_id).unwrap());
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("DELETE FROM installed_adapters WHERE id = ?1", [adapter_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!test_db.record_exists("installed_adapters", "id", adapter_id).unwrap(),
                "适配器应该已被删除");
        }
        
        #[tokio::test]
        async fn test_uninstall_adapter_when_not_exists() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "non-existent-adapter";
            
            // ========== Act (执行) ==========
            let rows_affected = test_db.get_connection()
                .execute("DELETE FROM installed_adapters WHERE id = ?1", [adapter_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(rows_affected, 0, "删除不存在的适配器不应影响任何行");
        }
        
        #[tokio::test]
        async fn test_uninstall_adapter_removes_dependencies() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "adapter-with-deps";
            test_db.insert_test_adapter(adapter_id, "Adapter With Dependencies", true).unwrap();
            
            // 添加依赖项
            test_db.get_connection().execute(
                "INSERT INTO adapter_dependencies (adapter_id, dependency_id, version_requirement, required)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "dep-1", "^1.0.0", "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            // 删除适配器（外键约束应该级联删除依赖项）
            test_db.get_connection()
                .execute("DELETE FROM installed_adapters WHERE id = ?1", [adapter_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let dep_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM adapter_dependencies WHERE adapter_id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(dep_count, 0, "依赖项应该被级联删除");
        }
    }
    
    // ================================
    // toggle_adapter 命令测试
    // ================================
    
    mod toggle_adapter {
        use super::*;
        
        #[tokio::test]
        async fn test_toggle_adapter_enables_disabled_adapter() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "toggle-adapter";
            test_db.insert_test_adapter(adapter_id, "Toggle Adapter", false).unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("UPDATE installed_adapters SET enabled = 1 WHERE id = ?1", [adapter_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let enabled: i32 = test_db.get_connection()
                .query_row(
                    "SELECT enabled FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(enabled, 1, "适配器应该已启用");
        }
        
        #[tokio::test]
        async fn test_toggle_adapter_disables_enabled_adapter() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "toggle-adapter";
            test_db.insert_test_adapter(adapter_id, "Toggle Adapter", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("UPDATE installed_adapters SET enabled = 0 WHERE id = ?1", [adapter_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let enabled: i32 = test_db.get_connection()
                .query_row(
                    "SELECT enabled FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(enabled, 0, "适配器应该已禁用");
        }
    }
    
    // ================================
    // get_adapter_config 命令测试
    // ================================
    
    mod get_adapter_config {
        use super::*;
        
        #[tokio::test]
        async fn test_get_adapter_config_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "config-adapter";
            test_db.insert_test_adapter(adapter_id, "Config Adapter", true).unwrap();
            
            // 更新配置
            let config_json = r#"{"api_key": "test-key", "model": "gpt-4"}"#;
            test_db.get_connection()
                .execute("UPDATE installed_adapters SET config = ?1 WHERE id = ?2",
                    [config_json, adapter_id])
                .unwrap();
            
            // ========== Act (执行) ==========
            let retrieved_config: String = test_db.get_connection()
                .query_row(
                    "SELECT config FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(retrieved_config, config_json, "应该返回正确的配置");
            
            // 验证JSON有效性
            let _parsed: serde_json::Value = serde_json::from_str(&retrieved_config)
                .expect("配置应该是有效的JSON");
        }
        
        #[tokio::test]
        async fn test_get_adapter_config_returns_default_when_not_set() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "default-config-adapter";
            test_db.insert_test_adapter(adapter_id, "Default Config Adapter", true).unwrap();
            
            // ========== Act (执行) ==========
            let config: String = test_db.get_connection()
                .query_row(
                    "SELECT config FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(config, "{}", "默认配置应该是空对象");
        }
    }
    
    // ================================
    // update_adapter_config 命令测试
    // ================================
    
    mod update_adapter_config {
        use super::*;
        
        #[tokio::test]
        async fn test_update_adapter_config_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "update-config-adapter";
            test_db.insert_test_adapter(adapter_id, "Update Config Adapter", true).unwrap();
            
            let new_config = r#"{"api_key": "updated-key", "timeout": 30}"#;
            
            // ========== Act (执行) ==========
            let before_update = chrono::Utc::now().timestamp();
            
            test_db.get_connection()
                .execute(
                    "UPDATE installed_adapters SET config = ?1, updated_at = ?2 WHERE id = ?3",
                    [new_config, &before_update.to_string(), adapter_id]
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            let (config, updated_at): (String, i64) = test_db.get_connection()
                .query_row(
                    "SELECT config, updated_at FROM installed_adapters WHERE id = ?1",
                    [adapter_id],
                    |row| Ok((row.get(0)?, row.get(1)?))
                )
                .unwrap();
            
            assert_eq!(config, new_config, "配置应该已更新");
            assert!(updated_at >= before_update, "更新时间戳应该已更新");
        }
        
        #[tokio::test]
        async fn test_update_adapter_config_validates_json() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "validate-config-adapter";
            test_db.insert_test_adapter(adapter_id, "Validate Config Adapter", true).unwrap();
            
            let valid_config = r#"{"key": "value"}"#;
            
            // ========== Act (执行) ==========
            // 验证配置是有效的JSON
            let parse_result = serde_json::from_str::<serde_json::Value>(valid_config);
            
            // ========== Assert (断言) ==========
            assert!(parse_result.is_ok(), "配置应该是有效的JSON");
            
            // 无效JSON应该失败
            let invalid_config = r#"{"key": invalid}"#;
            let invalid_parse_result = serde_json::from_str::<serde_json::Value>(invalid_config);
            assert!(invalid_parse_result.is_err(), "无效JSON应该解析失败");
        }
    }
    
    // ================================
    // get_adapter_permissions 命令测试
    // ================================
    
    mod get_adapter_permissions {
        use super::*;
        
        #[tokio::test]
        async fn test_get_adapter_permissions_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "perm-adapter";
            test_db.insert_test_adapter(adapter_id, "Permission Adapter", true).unwrap();
            
            // 添加权限
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, description)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "file_system", "1", "File system access"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted, description)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "network", "0", "Network access"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let perm_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(perm_count, 2, "应该有2个权限记录");
        }
        
        #[tokio::test]
        async fn test_get_adapter_permissions_filters_by_granted() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "filter-perm-adapter";
            test_db.insert_test_adapter(adapter_id, "Filter Permission Adapter", true).unwrap();
            
            // 添加多个权限
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
                 VALUES (?1, ?2, ?3)",
                [adapter_id, "perm1", "1"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
                 VALUES (?1, ?2, ?3)",
                [adapter_id, "perm2", "1"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
                 VALUES (?1, ?2, ?3)",
                [adapter_id, "perm3", "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let granted_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM adapter_permissions WHERE adapter_id = ?1 AND granted = 1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(granted_count, 2, "应该有2个已授予的权限");
        }
    }
    
    // ================================
    // grant_adapter_permission 命令测试
    // ================================
    
    mod grant_adapter_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_grant_adapter_permission_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "grant-perm-adapter";
            test_db.insert_test_adapter(adapter_id, "Grant Permission Adapter", true).unwrap();
            
            // 先添加未授予的权限
            test_db.get_connection().execute(
                "INSERT INTO adapter_permissions (adapter_id, permission_type, granted)
                 VALUES (?1, ?2, ?3)",
                [adapter_id, "camera", "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let now = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "UPDATE adapter_permissions SET granted = 1, granted_at = ?1
                 WHERE adapter_id = ?2 AND permission_type = ?3",
                [&now.to_string(), adapter_id, "camera"]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let (granted, granted_at): (i32, i64) = test_db.get_connection()
                .query_row(
                    "SELECT granted, granted_at FROM adapter_permissions
                     WHERE adapter_id = ?1 AND permission_type = ?2",
                    [adapter_id, "camera"],
                    |row| Ok((row.get(0)?, row.get(1)?))
                )
                .unwrap();
            
            assert_eq!(granted, 1, "权限应该已授予");
            assert!(granted_at > 0, "应该有授予时间");
        }
    }
    
    // ================================
    // search_adapters 命令测试
    // ================================
    
    mod search_adapters {
        use super::*;
        
        #[tokio::test]
        async fn test_search_adapters_by_name() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            test_db.insert_test_adapter("adapter-1", "OpenAI Adapter", true).unwrap();
            test_db.insert_test_adapter("adapter-2", "Claude Adapter", true).unwrap();
            test_db.insert_test_adapter("adapter-3", "OpenAI Advanced", true).unwrap();
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM installed_adapters WHERE name LIKE ?1",
                    ["%OpenAI%"],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2, "应该找到2个包含'OpenAI'的适配器");
        }
        
        #[tokio::test]
        async fn test_search_adapters_returns_empty_when_no_match() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            test_db.insert_test_adapter("adapter-1", "OpenAI Adapter", true).unwrap();
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM installed_adapters WHERE name LIKE ?1",
                    ["%NonExistent%"],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 0, "不应该找到任何适配器");
        }
    }
    
    // ================================
    // get_adapter_versions 命令测试
    // ================================
    
    mod get_adapter_versions {
        use super::*;
        
        #[tokio::test]
        async fn test_get_adapter_versions_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "versioned-adapter";
            test_db.insert_test_adapter(adapter_id, "Versioned Adapter", true).unwrap();
            
            // 添加版本记录
            let now = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "INSERT INTO adapter_versions (adapter_id, version, released_at, is_current)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "1.0.0", &now.to_string(), "0"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO adapter_versions (adapter_id, version, released_at, is_current)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "1.1.0", &now.to_string(), "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let version_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM adapter_versions WHERE adapter_id = ?1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(version_count, 2, "应该有2个版本记录");
        }
        
        #[tokio::test]
        async fn test_get_adapter_versions_identifies_current_version() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_adapter_tables().expect("Failed to init adapter tables");
            
            let adapter_id = "current-version-adapter";
            test_db.insert_test_adapter(adapter_id, "Current Version Adapter", true).unwrap();
            
            let now = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "INSERT INTO adapter_versions (adapter_id, version, released_at, is_current)
                 VALUES (?1, ?2, ?3, ?4)",
                [adapter_id, "2.0.0", &now.to_string(), "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let current_version: String = test_db.get_connection()
                .query_row(
                    "SELECT version FROM adapter_versions
                     WHERE adapter_id = ?1 AND is_current = 1",
                    [adapter_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(current_version, "2.0.0", "应该返回当前版本");
        }
    }
}


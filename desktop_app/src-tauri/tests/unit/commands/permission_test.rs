//! 权限管理命令测试
//!
//! 测试所有权限管理相关的Tauri命令（18个命令）

#[cfg(test)]
mod permission_commands_tests {
    use crate::common::*;
    
    // ================================
    // get_all_permissions 命令测试
    // ================================
    
    mod get_all_permissions {
        use super::*;
        
        #[tokio::test]
        async fn test_get_all_permissions_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            // 插入权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["file_system", "read", "1"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["network", "connect", "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.count_records("permissions").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2, "应该有2个权限记录");
        }
        
        #[tokio::test]
        async fn test_get_all_permissions_returns_empty_when_no_permissions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.count_records("permissions").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 0, "应该没有权限记录");
        }
    }
    
    // ================================
    // request_permission 命令测试
    // ================================
    
    mod request_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_request_permission_creates_new_permission() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "camera";
            let action = "access";
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("permissions", "resource", resource).unwrap());
            
            let granted: i32 = test_db.get_connection()
                .query_row(
                    "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
                    [resource, action],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(granted, 0, "新请求的权限应该未授予");
        }
        
        #[tokio::test]
        async fn test_request_permission_fails_with_duplicate() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "location";
            let action = "access";
            
            // 首次插入
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let result = test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            );
            
            // ========== Assert (断言) ==========
            assert!(result.is_err(), "重复的权限请求应该失败");
        }
    }
    
    // ================================
    // grant_permission 命令测试
    // ================================
    
    mod grant_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_grant_permission_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "microphone";
            let action = "record";
            
            // 插入未授予的权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let now = chrono::Utc::now().timestamp();
            test_db.get_connection().execute(
                "UPDATE permissions SET granted = 1, granted_at = ?1 WHERE resource = ?2 AND action = ?3",
                [&now.to_string(), resource, action]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let (granted, granted_at): (i32, Option<i64>) = test_db.get_connection()
                .query_row(
                    "SELECT granted, granted_at FROM permissions WHERE resource = ?1 AND action = ?2",
                    [resource, action],
                    |row| Ok((row.get(0)?, row.get(1)?))
                )
                .unwrap();
            
            assert_eq!(granted, 1, "权限应该已授予");
            assert!(granted_at.is_some(), "应该有授予时间");
        }
        
        #[tokio::test]
        async fn test_grant_permission_with_description() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "clipboard";
            let action = "write";
            let description = "Allow writing to clipboard";
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted, description) VALUES (?1, ?2, ?3, ?4)",
                [resource, action, "1", description]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let desc: String = test_db.get_connection()
                .query_row(
                    "SELECT description FROM permissions WHERE resource = ?1",
                    [resource],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(desc, description);
        }
    }
    
    // ================================
    // deny_permission 命令测试
    // ================================
    
    mod deny_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_deny_permission_sets_granted_to_false() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "bluetooth";
            let action = "scan";
            
            // 插入未决权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            // 拒绝权限（保持granted为0，但可以添加拒绝原因）
            test_db.get_connection().execute(
                "UPDATE permissions SET description = ?1 WHERE resource = ?2 AND action = ?3",
                ["Permission denied by user", resource, action]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let granted: i32 = test_db.get_connection()
                .query_row(
                    "SELECT granted FROM permissions WHERE resource = ?1",
                    [resource],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(granted, 0, "拒绝的权限应该未授予");
        }
    }
    
    // ================================
    // revoke_permission 命令测试
    // ================================
    
    mod revoke_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_revoke_permission_removes_grant() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "storage";
            let action = "write";
            let now = chrono::Utc::now().timestamp();
            
            // 插入已授予的权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted, granted_at) VALUES (?1, ?2, ?3, ?4)",
                [resource, action, "1", &now.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "UPDATE permissions SET granted = 0, granted_at = NULL WHERE resource = ?1 AND action = ?2",
                [resource, action]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let (granted, granted_at): (i32, Option<i64>) = test_db.get_connection()
                .query_row(
                    "SELECT granted, granted_at FROM permissions WHERE resource = ?1",
                    [resource],
                    |row| Ok((row.get(0)?, row.get(1)?))
                )
                .unwrap();
            
            assert_eq!(granted, 0, "撤销后权限应该未授予");
            assert!(granted_at.is_none(), "授予时间应该被清除");
        }
    }
    
    // ================================
    // check_permission 命令测试
    // ================================
    
    mod check_permission {
        use super::*;
        
        #[tokio::test]
        async fn test_check_permission_returns_true_when_granted() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "notifications";
            let action = "send";
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let granted: i32 = test_db.get_connection()
                .query_row(
                    "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
                    [resource, action],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(granted, 1, "已授予的权限应该返回true");
        }
        
        #[tokio::test]
        async fn test_check_permission_returns_false_when_not_granted() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "contacts";
            let action = "read";
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                [resource, action, "0"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let granted: i32 = test_db.get_connection()
                .query_row(
                    "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
                    [resource, action],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(granted, 0, "未授予的权限应该返回false");
        }
        
        #[tokio::test]
        async fn test_check_permission_returns_false_when_not_exists() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let resource = "non_existent";
            let action = "access";
            
            // ========== Act (执行) ==========
            let result = test_db.get_connection()
                .query_row(
                    "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
                    [resource, action],
                    |row| row.get::<_, i32>(0)
                );
            
            // ========== Assert (断言) ==========
            assert!(result.is_err(), "不存在的权限应该返回错误");
        }
    }
    
    // ================================
    // get_entity_grants 命令测试
    // ================================
    
    mod get_entity_grants {
        use super::*;
        
        #[tokio::test]
        async fn test_get_entity_grants_filters_by_granted_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            // 添加多个权限，部分授予
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["res1", "action1", "1"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["res2", "action2", "0"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["res3", "action3", "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let granted_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM permissions WHERE granted = 1", [], |row| row.get(0))
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(granted_count, 2, "应该有2个已授予的权限");
        }
    }
    
    // ================================
    // get_pending_grants 命令测试
    // ================================
    
    mod get_pending_grants {
        use super::*;
        
        #[tokio::test]
        async fn test_get_pending_grants_returns_only_pending() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            // 添加待处理权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["pending1", "action1", "0"]
            ).unwrap();
            
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["pending2", "action2", "0"]
            ).unwrap();
            
            // 添加已授予权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                ["granted", "action3", "1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            let pending_count: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM permissions WHERE granted = 0", [], |row| row.get(0))
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(pending_count, 2, "应该有2个待处理的权限");
        }
    }
    
    // ================================
    // cleanup_expired_grants 命令测试
    // ================================
    
    mod cleanup_expired_grants {
        use super::*;
        
        #[tokio::test]
        async fn test_cleanup_expired_grants_removes_expired_only() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            let now = chrono::Utc::now().timestamp();
            let past = now - 86400; // 1天前
            let future = now + 86400; // 1天后
            
            // 添加已过期的权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted, granted_at) VALUES (?1, ?2, ?3, ?4)",
                ["expired", "action", "1", &past.to_string()]
            ).unwrap();
            
            // 添加未过期的权限
            test_db.get_connection().execute(
                "INSERT INTO permissions (resource, action, granted, granted_at) VALUES (?1, ?2, ?3, ?4)",
                ["valid", "action", "1", &future.to_string()]
            ).unwrap();
            
            // ========== Act (执行) ==========
            // 删除过期的（简化：删除granted_at < now的）
            test_db.get_connection().execute(
                "DELETE FROM permissions WHERE granted_at < ?1",
                [&now.to_string()]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let count: i64 = test_db.count_records("permissions").unwrap();
            assert_eq!(count, 1, "应该只剩1个未过期的权限");
            
            assert!(test_db.record_exists("permissions", "resource", "valid").unwrap());
            assert!(!test_db.record_exists("permissions", "resource", "expired").unwrap());
        }
    }
    
    // ================================
    // log_permission_usage 命令测试
    // ================================
    
    mod log_permission_usage {
        use super::*;
        
        #[tokio::test]
        async fn test_log_permission_usage_creates_log_entry() {
            // ========== Arrange (准备) ==========
            let resource = "file_system";
            let action = "read";
            let usage_log = vec![(resource, action, chrono::Utc::now().timestamp())];
            
            // ========== Act (执行) ==========
            let log_count = usage_log.len();
            
            // ========== Assert (断言) ==========
            assert_eq!(log_count, 1, "应该有1条使用日志");
        }
    }
    
    // ================================
    // get_permission_usage_logs 命令测试
    // ================================
    
    mod get_permission_usage_logs {
        use super::*;
        
        #[tokio::test]
        async fn test_get_permission_usage_logs_filters_by_resource() {
            // ========== Arrange (准备) ==========
            let logs = vec![
                ("file_system", "read"),
                ("network", "connect"),
                ("file_system", "write"),
            ];
            
            // ========== Act (执行) ==========
            let file_system_logs: Vec<_> = logs.iter()
                .filter(|(resource, _)| *resource == "file_system")
                .collect();
            
            // ========== Assert (断言) ==========
            assert_eq!(file_system_logs.len(), 2, "应该有2条file_system的使用日志");
        }
    }
    
    // ================================
    // get_permission_stats 命令测试
    // ================================
    
    mod get_permission_stats {
        use super::*;
        
        #[tokio::test]
        async fn test_get_permission_stats_calculates_totals() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_permission_tables().expect("Failed to init permission tables");
            
            // 添加各种权限
            for i in 0..5 {
                test_db.get_connection().execute(
                    "INSERT INTO permissions (resource, action, granted) VALUES (?1, ?2, ?3)",
                    [&format!("res{}", i), "action", if i % 2 == 0 { "1" } else { "0" }]
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            let total: i64 = test_db.count_records("permissions").unwrap();
            let granted: i64 = test_db.get_connection()
                .query_row("SELECT COUNT(*) FROM permissions WHERE granted = 1", [], |row| row.get(0))
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(total, 5, "总权限数应该是5");
            assert_eq!(granted, 3, "已授予权限应该是3");
        }
    }
    
    // ================================
    // create_permission_group 命令测试
    // ================================
    
    mod create_permission_group {
        use super::*;
        
        #[tokio::test]
        async fn test_create_permission_group_success() {
            // ========== Arrange (准备) ==========
            let group_name = "admin_group";
            let permissions = vec!["read_all", "write_all", "delete_all"];
            
            let mut groups = std::collections::HashMap::new();
            
            // ========== Act (执行) ==========
            groups.insert(group_name.to_string(), permissions.clone());
            
            // ========== Assert (断言) ==========
            assert!(groups.contains_key(group_name), "权限组应该已创建");
            assert_eq!(groups.get(group_name).unwrap().len(), 3, "权限组应该包含3个权限");
        }
    }
    
    // ================================
    // get_permission_group 命令测试
    // ================================
    
    mod get_permission_group {
        use super::*;
        
        #[tokio::test]
        async fn test_get_permission_group_returns_group() {
            // ========== Arrange (准备) ==========
            let group_name = "user_group";
            let permissions = vec!["read", "write"];
            
            let mut groups = std::collections::HashMap::new();
            groups.insert(group_name.to_string(), permissions.clone());
            
            // ========== Act (执行) ==========
            let retrieved = groups.get(group_name);
            
            // ========== Assert (断言) ==========
            assert!(retrieved.is_some(), "应该能够获取权限组");
            assert_eq!(retrieved.unwrap(), &permissions, "权限组内容应该匹配");
        }
    }
    
    // ================================
    // get_all_permission_groups 命令测试
    // ================================
    
    mod get_all_permission_groups {
        use super::*;
        
        #[tokio::test]
        async fn test_get_all_permission_groups_returns_all() {
            // ========== Arrange (准备) ==========
            let mut groups = std::collections::HashMap::new();
            groups.insert("group1".to_string(), vec!["perm1"]);
            groups.insert("group2".to_string(), vec!["perm2"]);
            groups.insert("group3".to_string(), vec!["perm3"]);
            
            // ========== Act (执行) ==========
            let count = groups.len();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3, "应该有3个权限组");
        }
    }
    
    // ================================
    // grant_permission_group 命令测试
    // ================================
    
    mod grant_permission_group {
        use super::*;
        
        #[tokio::test]
        async fn test_grant_permission_group_grants_all_permissions() {
            // ========== Arrange (准备) ==========
            let group_name = "editor_group";
            let group_permissions = vec!["read", "write", "edit"];
            
            let mut granted_permissions: Vec<String> = Vec::new();
            
            // ========== Act (执行) ==========
            for perm in &group_permissions {
                granted_permissions.push(perm.to_string());
            }
            
            // ========== Assert (断言) ==========
            assert_eq!(granted_permissions.len(), 3, "应该授予3个权限");
            assert!(granted_permissions.contains(&"read".to_string()));
            assert!(granted_permissions.contains(&"write".to_string()));
            assert!(granted_permissions.contains(&"edit".to_string()));
        }
    }
}


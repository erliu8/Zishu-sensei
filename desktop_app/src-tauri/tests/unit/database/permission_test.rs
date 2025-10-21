//! 权限管理数据库测试
//!
//! 测试权限数据库的所有功能，包括：
//! - 权限定义管理
//! - 权限授权和撤销
//! - 权限检查
//! - 权限使用日志
//! - 权限组管理
//! - 统计信息

use zishu_sensei::database::permission::{
    PermissionRegistry, PermissionType, PermissionLevel, PermissionStatus,
    Permission, PermissionGrant, PermissionUsageLog, PermissionGroup,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;
use std::collections::HashMap;

// ========== 辅助函数 ==========

fn setup_test_registry() -> PermissionRegistry {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let registry = PermissionRegistry::new(conn);
    registry.init_tables().expect("无法初始化数据库表");
    registry
}

// ========== 权限类型测试 ==========

mod permission_types {
    use super::*;

    #[test]
    fn test_permission_type_to_string() {
        let test_cases = vec![
            (PermissionType::FileRead, "file_read"),
            (PermissionType::FileWrite, "file_write"),
            (PermissionType::NetworkHttp, "network_http"),
            (PermissionType::SystemCommand, "system_command"),
            (PermissionType::AppDatabase, "app_database"),
            (PermissionType::HardwareCamera, "hardware_camera"),
            (PermissionType::AdvancedAdmin, "advanced_admin"),
        ];

        for (ptype, expected) in test_cases {
            assert_eq!(ptype.to_string(), expected);
        }
    }

    #[test]
    fn test_permission_type_from_string() {
        let test_cases = vec![
            ("file_read", PermissionType::FileRead),
            ("file_write", PermissionType::FileWrite),
            ("network_http", PermissionType::NetworkHttp),
            ("system_command", PermissionType::SystemCommand),
        ];

        for (s, expected) in test_cases {
            let result: PermissionType = s.parse().expect("解析应该成功");
            assert_eq!(result, expected);
        }
    }

    #[test]
    fn test_custom_permission_type() {
        let custom = PermissionType::Custom("my_custom_permission".to_string());
        assert_eq!(custom.to_string(), "custom_my_custom_permission");

        let parsed: PermissionType = "custom_test".parse().expect("解析应该成功");
        assert!(matches!(parsed, PermissionType::Custom(_)));
    }

    #[test]
    fn test_permission_level_ordering() {
        assert!(PermissionLevel::None < PermissionLevel::ReadOnly);
        assert!(PermissionLevel::ReadOnly < PermissionLevel::ReadWrite);
        assert!(PermissionLevel::ReadWrite < PermissionLevel::Full);
    }
}

// ========== 权限定义管理测试 ==========

mod permission_definitions {
    use super::*;

    #[test]
    fn test_default_permissions_initialized() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let permissions = registry.get_all_permissions()
            .expect("获取权限应该成功");

        // ========== Assert ==========
        assert!(!permissions.is_empty(), "应该有默认权限");
        
        // 验证一些关键权限存在
        let permission_names: Vec<_> = permissions.iter()
            .map(|p| p.name.as_str())
            .collect();
        
        assert!(permission_names.contains(&"file_read"), "应该包含file_read权限");
        assert!(permission_names.contains(&"network_http"), "应该包含network_http权限");
        assert!(permission_names.contains(&"system_command"), "应该包含system_command权限");
    }

    #[test]
    fn test_add_custom_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let id = registry.add_permission(
            "custom_permission".to_string(),
            PermissionType::Custom("special".to_string()),
            PermissionLevel::ReadWrite,
            "自定义权限".to_string(),
            "这是一个自定义权限".to_string(),
            "custom".to_string(),
            false,
            true,
            vec![],
        ).expect("添加权限应该成功");

        // ========== Assert ==========
        assert!(id > 0, "应该返回有效的ID");

        let all_permissions = registry.get_all_permissions().unwrap();
        let added = all_permissions.iter()
            .find(|p| p.name == "custom_permission")
            .expect("应该找到添加的权限");
        
        assert_eq!(added.display_name, "自定义权限");
        assert!(!added.is_dangerous);
        assert!(added.is_revocable);
    }

    #[test]
    fn test_get_permission_by_type() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let permission = registry.get_permission_by_type(&PermissionType::FileRead)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(permission.is_some(), "应该找到file_read权限");
        let permission = permission.unwrap();
        assert_eq!(permission.permission_type, PermissionType::FileRead);
    }

    #[test]
    fn test_get_permissions_by_category() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let filesystem_perms = registry.get_permissions_by_category("filesystem")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(!filesystem_perms.is_empty(), "文件系统类别应该有权限");
        
        for perm in filesystem_perms {
            assert_eq!(perm.category, "filesystem", "所有权限都应该属于filesystem类别");
        }
    }

    #[test]
    fn test_dangerous_permissions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let all_permissions = registry.get_all_permissions().unwrap();

        // ========== Assert ==========
        let dangerous: Vec<_> = all_permissions.iter()
            .filter(|p| p.is_dangerous)
            .collect();
        
        assert!(!dangerous.is_empty(), "应该有危险权限");
        
        // 验证一些应该标记为危险的权限
        let dangerous_types: Vec<_> = dangerous.iter()
            .map(|p| &p.permission_type)
            .collect();
        
        assert!(dangerous_types.contains(&&PermissionType::FileDelete));
        assert!(dangerous_types.contains(&&PermissionType::SystemCommand));
        assert!(dangerous_types.contains(&&PermissionType::HardwareCamera));
    }
}

// ========== 权限授权管理测试 ==========

mod permission_grants {
    use super::*;

    #[test]
    fn test_request_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let id = registry.request_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            None,
        ).expect("请求权限应该成功");

        // ========== Assert ==========
        assert!(id > 0, "应该返回有效的请求ID");

        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询授权应该成功");
        
        assert_eq!(grants.len(), 1, "应该有一个授权记录");
        assert_eq!(grants[0].status, PermissionStatus::Pending, "状态应该是待审核");
    }

    #[test]
    fn test_grant_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::Full,
            None,
            Some("system".to_string()),
            None,
        ).expect("授予权限应该成功");

        // ========== Assert ==========
        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询授权应该成功");
        
        assert_eq!(grants.len(), 1, "应该有一个授权记录");
        let grant = &grants[0];
        assert_eq!(grant.status, PermissionStatus::Granted, "状态应该是已授予");
        assert_eq!(grant.level, PermissionLevel::Full, "级别应该匹配");
        assert!(grant.granted_at.is_some(), "授予时间应该已设置");
        assert_eq!(grant.granted_by, Some("system".to_string()), "授予者应该匹配");
    }

    #[test]
    fn test_deny_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        registry.request_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::SystemCommand,
            PermissionLevel::Full,
            None,
        ).expect("请求权限应该成功");

        // ========== Act ==========
        registry.deny_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::SystemCommand,
            None,
            Some("安全原因".to_string()),
        ).expect("拒绝权限应该成功");

        // ========== Assert ==========
        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询授权应该成功");
        
        let grant = &grants[0];
        assert_eq!(grant.status, PermissionStatus::Denied, "状态应该是已拒绝");
        assert_eq!(grant.reason, Some("安全原因".to_string()), "拒绝原因应该匹配");
    }

    #[test]
    fn test_revoke_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileWrite,
            PermissionLevel::ReadWrite,
            None,
            Some("system".to_string()),
            None,
        ).expect("授予权限应该成功");

        // ========== Act ==========
        registry.revoke_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileWrite,
            None,
            Some("权限滥用".to_string()),
        ).expect("撤销权限应该成功");

        // ========== Assert ==========
        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询授权应该成功");
        
        let grant = &grants[0];
        assert_eq!(grant.status, PermissionStatus::Revoked, "状态应该是已撤销");
        assert_eq!(grant.reason, Some("权限滥用".to_string()), "撤销原因应该匹配");
    }

    #[test]
    fn test_check_permission_granted() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::AppDatabase,
            PermissionLevel::ReadWrite,
            None,
            Some("system".to_string()),
            None,
        ).expect("授予权限应该成功");

        // ========== Act & Assert ==========
        let has_readonly = registry.check_permission(
            "adapter",
            "adapter-001",
            &PermissionType::AppDatabase,
            &PermissionLevel::ReadOnly,
            None,
        ).expect("检查权限应该成功");
        assert!(has_readonly, "应该有ReadOnly级别的权限");

        let has_readwrite = registry.check_permission(
            "adapter",
            "adapter-001",
            &PermissionType::AppDatabase,
            &PermissionLevel::ReadWrite,
            None,
        ).expect("检查权限应该成功");
        assert!(has_readwrite, "应该有ReadWrite级别的权限");

        let has_full = registry.check_permission(
            "adapter",
            "adapter-001",
            &PermissionType::AppDatabase,
            &PermissionLevel::Full,
            None,
        ).expect("检查权限应该成功");
        assert!(!has_full, "不应该有Full级别的权限");
    }

    #[test]
    fn test_check_permission_not_granted() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let has_permission = registry.check_permission(
            "adapter",
            "adapter-999",
            &PermissionType::NetworkSocket,
            &PermissionLevel::ReadOnly,
            None,
        ).expect("检查权限应该成功");

        // ========== Assert ==========
        assert!(!has_permission, "未授予的权限应该返回false");
    }

    #[test]
    fn test_permission_with_scope() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some("/home/user/documents".to_string()),
            Some("user".to_string()),
            None,
        ).expect("授予权限应该成功");

        // ========== Assert ==========
        let has_scoped = registry.check_permission(
            "adapter",
            "adapter-001",
            &PermissionType::FileRead,
            &PermissionLevel::ReadOnly,
            Some("/home/user/documents"),
        ).expect("检查权限应该成功");
        assert!(has_scoped, "指定范围内应该有权限");

        let has_unscoped = registry.check_permission(
            "adapter",
            "adapter-001",
            &PermissionType::FileRead,
            &PermissionLevel::ReadOnly,
            None,
        ).expect("检查权限应该成功");
        assert!(has_unscoped, "不指定范围也应该有权限（通配符匹配）");
    }

    #[test]
    fn test_permission_expiration() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let past_time = Utc::now() - chrono::Duration::days(1);

        registry.grant_permission(
            "adapter".to_string(),
            "adapter-expired".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::Full,
            None,
            Some("system".to_string()),
            Some(past_time),
        ).expect("授予权限应该成功");

        // ========== Act ==========
        let has_permission = registry.check_permission(
            "adapter",
            "adapter-expired",
            &PermissionType::NetworkHttp,
            &PermissionLevel::Full,
            None,
        ).expect("检查权限应该成功");

        // ========== Assert ==========
        assert!(!has_permission, "过期的权限应该返回false");
    }

    #[test]
    fn test_get_pending_grants() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 创建多个权限请求
        for i in 1..=3 {
            registry.request_permission(
                "adapter".to_string(),
                format!("adapter-{}", i),
                PermissionType::FileWrite,
                PermissionLevel::ReadWrite,
                None,
            ).expect("请求权限应该成功");
        }

        // 授予其中一个
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-1".to_string(),
            PermissionType::FileWrite,
            PermissionLevel::ReadWrite,
            None,
            Some("system".to_string()),
            None,
        ).expect("授予权限应该成功");

        // ========== Act ==========
        let pending = registry.get_pending_grants()
            .expect("查询待审核权限应该成功");

        // ========== Assert ==========
        assert_eq!(pending.len(), 2, "应该有2个待审核的权限");
        
        for grant in pending {
            assert_eq!(grant.status, PermissionStatus::Pending, "所有返回的权限都应该是待审核状态");
        }
    }

    #[test]
    fn test_cleanup_expired_grants() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let past_time = Utc::now() - chrono::Duration::days(1);

        // 添加已过期的权限
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::Full,
            None,
            Some("system".to_string()),
            Some(past_time),
        ).expect("授予权限应该成功");

        // 添加未过期的权限
        let future_time = Utc::now() + chrono::Duration::days(30);
        registry.grant_permission(
            "adapter".to_string(),
            "adapter-002".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            None,
            Some("system".to_string()),
            Some(future_time),
        ).expect("授予权限应该成功");

        // ========== Act ==========
        let count = registry.cleanup_expired_grants()
            .expect("清理应该成功");

        // ========== Assert ==========
        assert_eq!(count, 1, "应该清理1个过期权限");

        // 验证过期权限状态已更新
        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询应该成功");
        assert_eq!(grants[0].status, PermissionStatus::Expired, "状态应该是已过期");
    }
}

// ========== 权限使用日志测试 ==========

mod usage_logging {
    use super::*;

    #[test]
    fn test_log_permission_usage() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let id = registry.log_permission_usage(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some("/home/user/file.txt".to_string()),
            "read_file".to_string(),
            true,
            None,
            Some("192.168.1.1".to_string()),
            None,
        ).expect("记录日志应该成功");

        // ========== Assert ==========
        assert!(id > 0, "应该返回有效的日志ID");
    }

    #[test]
    fn test_get_usage_logs() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 记录多条日志
        for i in 1..=5 {
            registry.log_permission_usage(
                "adapter".to_string(),
                format!("adapter-{}", i),
                PermissionType::NetworkHttp,
                PermissionLevel::Full,
                Some(format!("https://api.example.com/v{}", i)),
                "http_request".to_string(),
                true,
                None,
                None,
                None,
            ).expect("记录日志应该成功");
        }

        // ========== Act ==========
        let logs = registry.get_usage_logs(
            Some("adapter"),
            None,
            None,
            Some(10),
            Some(0),
        ).expect("查询日志应该成功");

        // ========== Assert ==========
        assert_eq!(logs.len(), 5, "应该返回5条日志");
    }

    #[test]
    fn test_get_usage_logs_filtered() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 记录不同类型的日志
        registry.log_permission_usage(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            None,
            "read".to_string(),
            true,
            None,
            None,
            None,
        ).expect("记录日志应该成功");

        registry.log_permission_usage(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::Full,
            None,
            "request".to_string(),
            true,
            None,
            None,
            None,
        ).expect("记录日志应该成功");

        // ========== Act ==========
        let file_logs = registry.get_usage_logs(
            Some("adapter"),
            Some("adapter-001"),
            Some(&PermissionType::FileRead),
            None,
            None,
        ).expect("查询日志应该成功");

        // ========== Assert ==========
        assert_eq!(file_logs.len(), 1, "应该返回1条文件读取日志");
        assert_eq!(file_logs[0].permission_type, PermissionType::FileRead);
    }

    #[test]
    fn test_log_failed_usage() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        registry.log_permission_usage(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::SystemCommand,
            PermissionLevel::Full,
            Some("rm -rf /".to_string()),
            "execute_command".to_string(),
            false,
            Some("权限被拒绝".to_string()),
            None,
            None,
        ).expect("记录日志应该成功");

        // ========== Assert ==========
        let logs = registry.get_usage_logs(
            Some("adapter"),
            Some("adapter-001"),
            None,
            None,
            None,
        ).expect("查询日志应该成功");

        assert_eq!(logs.len(), 1, "应该有1条日志");
        assert!(!logs[0].success, "日志应该标记为失败");
        assert_eq!(
            logs[0].failure_reason,
            Some("权限被拒绝".to_string()),
            "失败原因应该匹配"
        );
    }
}

// ========== 权限统计测试 ==========

mod statistics {
    use super::*;

    #[test]
    fn test_get_permission_stats() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 授予多个权限
        for i in 1..=3 {
            registry.grant_permission(
                "adapter".to_string(),
                "adapter-stats".to_string(),
                if i == 1 { PermissionType::FileRead } 
                else if i == 2 { PermissionType::FileWrite }
                else { PermissionType::NetworkHttp },
                PermissionLevel::ReadOnly,
                None,
                Some("system".to_string()),
                None,
            ).expect("授予权限应该成功");
        }

        // 拒绝一个权限
        registry.request_permission(
            "adapter".to_string(),
            "adapter-stats".to_string(),
            PermissionType::SystemCommand,
            PermissionLevel::Full,
            None,
        ).expect("请求权限应该成功");
        
        registry.deny_permission(
            "adapter".to_string(),
            "adapter-stats".to_string(),
            PermissionType::SystemCommand,
            None,
            Some("危险操作".to_string()),
        ).expect("拒绝权限应该成功");

        // 记录使用
        for _ in 0..5 {
            registry.log_permission_usage(
                "adapter".to_string(),
                "adapter-stats".to_string(),
                PermissionType::FileRead,
                PermissionLevel::ReadOnly,
                None,
                "read".to_string(),
                true,
                None,
                None,
                None,
            ).expect("记录日志应该成功");
        }

        // ========== Act ==========
        let stats = registry.get_permission_stats("adapter", "adapter-stats")
            .expect("获取统计应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_grants, 4, "应该有4个授权记录");
        assert_eq!(stats.active_grants, 3, "应该有3个活跃授权");
        assert_eq!(stats.pending_grants, 0, "应该有0个待审核");
        assert_eq!(stats.denied_grants, 1, "应该有1个被拒绝");
        assert_eq!(stats.total_usage, 5, "应该有5次使用");
        assert!(stats.last_used_at.is_some(), "最后使用时间应该已设置");
    }

    #[test]
    fn test_empty_stats() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let stats = registry.get_permission_stats("adapter", "non-existent")
            .expect("获取统计应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_grants, 0);
        assert_eq!(stats.active_grants, 0);
        assert_eq!(stats.total_usage, 0);
        assert!(stats.last_used_at.is_none());
    }
}

// ========== 权限组管理测试 ==========

mod permission_groups {
    use super::*;

    #[test]
    fn test_create_permission_group() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let permissions = vec![
            PermissionType::FileRead,
            PermissionType::FileWrite,
            PermissionType::FileDelete,
        ];

        // ========== Act ==========
        let id = registry.create_permission_group(
            "filesystem_full".to_string(),
            "完整文件系统权限".to_string(),
            "包含所有文件系统操作权限".to_string(),
            permissions.clone(),
        ).expect("创建权限组应该成功");

        // ========== Assert ==========
        assert!(id > 0, "应该返回有效的组ID");

        let group = registry.get_permission_group("filesystem_full")
            .expect("查询应该成功")
            .expect("应该找到权限组");
        
        assert_eq!(group.display_name, "完整文件系统权限");
        assert_eq!(group.permissions.len(), 3);
    }

    #[test]
    fn test_get_all_permission_groups() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 创建多个组
        for i in 1..=3 {
            registry.create_permission_group(
                format!("group-{}", i),
                format!("组 {}", i),
                "测试组".to_string(),
                vec![PermissionType::FileRead],
            ).expect("创建权限组应该成功");
        }

        // ========== Act ==========
        let groups = registry.get_all_permission_groups()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(groups.len(), 3, "应该有3个权限组");
    }

    #[test]
    fn test_grant_permission_group() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        let permissions = vec![
            PermissionType::NetworkHttp,
            PermissionType::NetworkWebSocket,
        ];
        
        registry.create_permission_group(
            "network_basic".to_string(),
            "基础网络权限".to_string(),
            "基本网络操作权限".to_string(),
            permissions,
        ).expect("创建权限组应该成功");

        // ========== Act ==========
        registry.grant_permission_group(
            "adapter".to_string(),
            "adapter-001".to_string(),
            "network_basic",
            PermissionLevel::Full,
            Some("system".to_string()),
            None,
        ).expect("授予权限组应该成功");

        // ========== Assert ==========
        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询授权应该成功");
        
        assert_eq!(grants.len(), 2, "应该有2个权限被授予");
        
        // 验证所有权限都是已授予状态
        for grant in grants {
            assert_eq!(grant.status, PermissionStatus::Granted);
            assert_eq!(grant.level, PermissionLevel::Full);
        }
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_duplicate_permission_request() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let id1 = registry.request_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            None,
        ).expect("首次请求应该成功");

        let id2 = registry.request_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadWrite, // 不同级别
            None,
        ).expect("重复请求应该成功");

        // ========== Assert ==========
        // 重复请求应该更新现有记录
        assert_eq!(id1, id2, "应该返回相同的ID");

        let grants = registry.get_entity_grants("adapter", "adapter-001")
            .expect("查询应该成功");
        
        assert_eq!(grants.len(), 1, "应该只有1条记录");
        assert_eq!(grants[0].level, PermissionLevel::ReadWrite, "级别应该已更新");
    }

    #[test]
    fn test_permission_with_empty_scope() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let result = registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some("".to_string()),
            Some("system".to_string()),
            None,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "空范围应该被接受");
    }

    #[test]
    fn test_concurrent_permission_checks() {
        use std::sync::Arc;
        use std::thread;

        // ========== Arrange ==========
        let conn = Connection::open_in_memory().unwrap();
        let conn = Arc::new(RwLock::new(conn));
        let registry = Arc::new(PermissionRegistry::new(conn));
        registry.init_tables().unwrap();

        registry.grant_permission(
            "adapter".to_string(),
            "adapter-001".to_string(),
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            None,
            Some("system".to_string()),
            None,
        ).unwrap();

        // ========== Act ==========
        let handles: Vec<_> = (0..10)
            .map(|_| {
                let registry = Arc::clone(&registry);
                thread::spawn(move || {
                    registry.check_permission(
                        "adapter",
                        "adapter-001",
                        &PermissionType::FileRead,
                        &PermissionLevel::ReadOnly,
                        None,
                    )
                })
            })
            .collect();

        // ========== Assert ==========
        for handle in handles {
            let result = handle.join().unwrap();
            assert!(result.is_ok(), "并发检查应该成功");
            assert!(result.unwrap(), "权限检查应该返回true");
        }
    }
}


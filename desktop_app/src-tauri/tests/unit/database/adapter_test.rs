//! 适配器数据库测试
//!
//! 测试适配器数据库的所有功能，包括：
//! - 适配器的CRUD操作
//! - 版本管理
//! - 依赖管理
//! - 权限管理
//! - 状态更新
//! - 查询和过滤

use zishu_sensei::database::adapter::{
    AdapterRegistry, InstalledAdapter, AdapterInstallStatus, AdapterVersion,
    AdapterDependency, AdapterPermission,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;
use std::collections::HashMap;

// ========== 辅助函数 ==========

/// 创建测试用的内存数据库
fn setup_test_registry() -> AdapterRegistry {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let registry = AdapterRegistry::new(conn);
    registry.init_tables().expect("无法初始化数据库表");
    registry
}

/// 创建测试用的适配器
fn create_test_adapter(id: &str) -> InstalledAdapter {
    InstalledAdapter {
        id: id.to_string(),
        name: format!("Test Adapter {}", id),
        display_name: format!("测试适配器 {}", id),
        version: "1.0.0".to_string(),
        install_path: format!("/test/path/{}", id),
        status: AdapterInstallStatus::Installed,
        enabled: true,
        auto_update: true,
        source: "market".to_string(),
        source_id: Some(format!("market_{}", id)),
        description: Some(format!("测试适配器 {} 的描述", id)),
        author: Some("Test Author".to_string()),
        license: Some("MIT".to_string()),
        homepage_url: Some("https://example.com".to_string()),
        installed_at: Utc::now(),
        updated_at: Utc::now(),
        last_used_at: None,
        config: HashMap::new(),
        metadata: HashMap::new(),
    }
}

// ========== 适配器 CRUD 测试 ==========

mod adapter_crud {
    use super::*;

    #[test]
    fn test_add_and_get_adapter_success() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("test-001");

        // ========== Act ==========
        let add_result = registry.add_adapter(adapter.clone());

        // ========== Assert ==========
        assert!(add_result.is_ok(), "添加适配器应该成功");

        let retrieved = registry.get_adapter("test-001").expect("查询应该成功");
        assert!(retrieved.is_some(), "应该找到适配器");
        
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, adapter.id, "ID应该匹配");
        assert_eq!(retrieved.name, adapter.name, "名称应该匹配");
        assert_eq!(retrieved.version, adapter.version, "版本应该匹配");
    }

    #[test]
    fn test_get_adapter_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let result = registry.get_adapter("non-existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的适配器应该返回None");
    }

    #[test]
    fn test_get_all_adapters_empty() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let adapters = registry.get_all_adapters().expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(adapters.len(), 0, "空数据库应该返回空列表");
    }

    #[test]
    fn test_get_all_adapters_multiple() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=5 {
            let adapter = create_test_adapter(&format!("adapter-{}", i));
            registry.add_adapter(adapter).expect("添加应该成功");
        }

        // ========== Act ==========
        let adapters = registry.get_all_adapters().expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(adapters.len(), 5, "应该返回5个适配器");
        
        // 验证按安装时间倒序排列
        for i in 0..adapters.len()-1 {
            assert!(
                adapters[i].installed_at >= adapters[i+1].installed_at,
                "适配器应该按安装时间倒序排列"
            );
        }
    }

    #[test]
    fn test_update_adapter_success() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut adapter = create_test_adapter("update-test");
        registry.add_adapter(adapter.clone()).expect("添加应该成功");

        // ========== Act ==========
        adapter.version = "2.0.0".to_string();
        adapter.description = Some("更新后的描述".to_string());
        adapter.updated_at = Utc::now();

        let update_result = registry.update_adapter(adapter.clone());

        // ========== Assert ==========
        assert!(update_result.is_ok(), "更新应该成功");

        let retrieved = registry.get_adapter("update-test")
            .expect("查询应该成功")
            .expect("应该找到适配器");
        
        assert_eq!(retrieved.version, "2.0.0", "版本应该已更新");
        assert_eq!(
            retrieved.description,
            Some("更新后的描述".to_string()),
            "描述应该已更新"
        );
    }

    #[test]
    fn test_delete_adapter_success() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("delete-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        // ========== Act ==========
        let delete_result = registry.delete_adapter("delete-test");

        // ========== Assert ==========
        assert!(delete_result.is_ok(), "删除应该成功");

        let retrieved = registry.get_adapter("delete-test")
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到适配器");
    }

    #[test]
    fn test_adapter_exists() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("exists-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        // ========== Act & Assert ==========
        let exists = registry.adapter_exists("exists-test")
            .expect("查询应该成功");
        assert!(exists, "已添加的适配器应该存在");

        let not_exists = registry.adapter_exists("non-existent")
            .expect("查询应该成功");
        assert!(!not_exists, "未添加的适配器不应该存在");
    }

    #[test]
    fn test_count_adapters() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act & Assert ==========
        let count_empty = registry.count_adapters().expect("计数应该成功");
        assert_eq!(count_empty, 0, "空数据库应该有0个适配器");

        // 添加适配器
        for i in 1..=3 {
            let adapter = create_test_adapter(&format!("count-{}", i));
            registry.add_adapter(adapter).expect("添加应该成功");
        }

        let count_after = registry.count_adapters().expect("计数应该成功");
        assert_eq!(count_after, 3, "应该有3个适配器");
    }
}

// ========== 适配器状态管理测试 ==========

mod adapter_status {
    use super::*;

    #[test]
    fn test_set_adapter_enabled() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("status-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        // ========== Act ==========
        registry.set_adapter_enabled("status-test", false)
            .expect("禁用应该成功");

        // ========== Assert ==========
        let retrieved = registry.get_adapter("status-test")
            .expect("查询应该成功")
            .unwrap();
        assert!(!retrieved.enabled, "适配器应该被禁用");

        // 重新启用
        registry.set_adapter_enabled("status-test", true)
            .expect("启用应该成功");

        let retrieved = registry.get_adapter("status-test")
            .expect("查询应该成功")
            .unwrap();
        assert!(retrieved.enabled, "适配器应该被启用");
    }

    #[test]
    fn test_get_enabled_adapters() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 添加已启用的适配器
        for i in 1..=3 {
            let adapter = create_test_adapter(&format!("enabled-{}", i));
            registry.add_adapter(adapter).expect("添加应该成功");
        }

        // 添加已禁用的适配器
        let mut disabled_adapter = create_test_adapter("disabled");
        disabled_adapter.enabled = false;
        registry.add_adapter(disabled_adapter).expect("添加应该成功");

        // ========== Act ==========
        let enabled_adapters = registry.get_enabled_adapters()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(enabled_adapters.len(), 3, "应该返回3个已启用的适配器");
        
        for adapter in enabled_adapters {
            assert!(adapter.enabled, "返回的适配器应该都是已启用的");
        }
    }

    #[test]
    fn test_update_adapter_status() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("status-change");
        registry.add_adapter(adapter).expect("添加应该成功");

        // ========== Act & Assert ==========
        let statuses = vec![
            AdapterInstallStatus::Downloading,
            AdapterInstallStatus::Installing,
            AdapterInstallStatus::Installed,
            AdapterInstallStatus::Updating,
            AdapterInstallStatus::Installed,
        ];

        for status in statuses {
            registry.update_adapter_status("status-change", status.clone())
                .expect("更新状态应该成功");

            let retrieved = registry.get_adapter("status-change")
                .expect("查询应该成功")
                .unwrap();
            assert_eq!(retrieved.status, status, "状态应该已更新");
        }
    }

    #[test]
    fn test_update_last_used() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("last-used");
        registry.add_adapter(adapter).expect("添加应该成功");

        let before = Utc::now();
        std::thread::sleep(std::time::Duration::from_millis(100));

        // ========== Act ==========
        registry.update_last_used("last-used")
            .expect("更新最后使用时间应该成功");

        // ========== Assert ==========
        let retrieved = registry.get_adapter("last-used")
            .expect("查询应该成功")
            .unwrap();
        
        assert!(retrieved.last_used_at.is_some(), "最后使用时间应该已设置");
        assert!(
            retrieved.last_used_at.unwrap() > before,
            "最后使用时间应该在当前时间之后"
        );
    }
}

// ========== 版本管理测试 ==========

mod version_management {
    use super::*;

    #[test]
    fn test_add_version() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("version-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        let version = AdapterVersion {
            id: 0,
            adapter_id: "version-test".to_string(),
            version: "1.0.0".to_string(),
            released_at: Utc::now(),
            changelog: Some("Initial release".to_string()),
            download_url: Some("https://example.com/v1.0.0".to_string()),
            file_size: Some(1024),
            checksum: Some("abc123".to_string()),
            is_current: true,
        };

        // ========== Act ==========
        let result = registry.add_version(version);

        // ========== Assert ==========
        assert!(result.is_ok(), "添加版本应该成功");
    }

    #[test]
    fn test_get_versions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("multi-version");
        registry.add_adapter(adapter).expect("添加应该成功");

        // 添加多个版本
        for i in 1..=3 {
            let version = AdapterVersion {
                id: 0,
                adapter_id: "multi-version".to_string(),
                version: format!("1.{}.0", i),
                released_at: Utc::now(),
                changelog: Some(format!("Version 1.{}.0", i)),
                download_url: None,
                file_size: None,
                checksum: None,
                is_current: i == 3,
            };
            registry.add_version(version).expect("添加版本应该成功");
            
            // 稍微延迟以确保时间戳不同
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Act ==========
        let versions = registry.get_versions("multi-version")
            .expect("查询版本应该成功");

        // ========== Assert ==========
        assert_eq!(versions.len(), 3, "应该有3个版本");
        
        // 验证按发布时间倒序排列
        for i in 0..versions.len()-1 {
            assert!(
                versions[i].released_at >= versions[i+1].released_at,
                "版本应该按发布时间倒序排列"
            );
        }
    }

    #[test]
    fn test_set_current_version() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("current-version");
        registry.add_adapter(adapter).expect("添加应该成功");

        // 添加多个版本
        for i in 1..=3 {
            let version = AdapterVersion {
                id: 0,
                adapter_id: "current-version".to_string(),
                version: format!("1.{}.0", i),
                released_at: Utc::now(),
                changelog: None,
                download_url: None,
                file_size: None,
                checksum: None,
                is_current: false,
            };
            registry.add_version(version).expect("添加版本应该成功");
        }

        // ========== Act ==========
        registry.set_current_version("current-version", "1.2.0")
            .expect("设置当前版本应该成功");

        // ========== Assert ==========
        let versions = registry.get_versions("current-version")
            .expect("查询版本应该成功");
        
        let current_versions: Vec<_> = versions.iter()
            .filter(|v| v.is_current)
            .collect();
        
        assert_eq!(current_versions.len(), 1, "应该只有一个当前版本");
        assert_eq!(current_versions[0].version, "1.2.0", "当前版本应该是1.2.0");
    }
}

// ========== 依赖管理测试 ==========

mod dependency_management {
    use super::*;

    #[test]
    fn test_add_dependency() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        let adapter1 = create_test_adapter("adapter-1");
        let adapter2 = create_test_adapter("adapter-2");
        registry.add_adapter(adapter1).expect("添加应该成功");
        registry.add_adapter(adapter2).expect("添加应该成功");

        let dependency = AdapterDependency {
            id: 0,
            adapter_id: "adapter-1".to_string(),
            dependency_id: "adapter-2".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: true,
        };

        // ========== Act ==========
        let result = registry.add_dependency(dependency);

        // ========== Assert ==========
        assert!(result.is_ok(), "添加依赖应该成功");
    }

    #[test]
    fn test_get_dependencies() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        // 添加适配器
        for i in 0..=3 {
            let adapter = create_test_adapter(&format!("adapter-{}", i));
            registry.add_adapter(adapter).expect("添加应该成功");
        }

        // 添加依赖关系
        for i in 1..=3 {
            let dependency = AdapterDependency {
                id: 0,
                adapter_id: "adapter-0".to_string(),
                dependency_id: format!("adapter-{}", i),
                version_requirement: ">=1.0.0".to_string(),
                required: i <= 2, // 前两个是必需的
            };
            registry.add_dependency(dependency).expect("添加依赖应该成功");
        }

        // ========== Act ==========
        let dependencies = registry.get_dependencies("adapter-0")
            .expect("查询依赖应该成功");

        // ========== Assert ==========
        assert_eq!(dependencies.len(), 3, "应该有3个依赖");
        
        let required_count = dependencies.iter()
            .filter(|d| d.required)
            .count();
        assert_eq!(required_count, 2, "应该有2个必需依赖");
    }

    #[test]
    fn test_delete_dependency() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        let adapter1 = create_test_adapter("adapter-1");
        let adapter2 = create_test_adapter("adapter-2");
        registry.add_adapter(adapter1).expect("添加应该成功");
        registry.add_adapter(adapter2).expect("添加应该成功");

        let dependency = AdapterDependency {
            id: 0,
            adapter_id: "adapter-1".to_string(),
            dependency_id: "adapter-2".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: true,
        };
        registry.add_dependency(dependency).expect("添加依赖应该成功");

        // ========== Act ==========
        let result = registry.delete_dependency("adapter-1", "adapter-2");

        // ========== Assert ==========
        assert!(result.is_ok(), "删除依赖应该成功");

        let dependencies = registry.get_dependencies("adapter-1")
            .expect("查询依赖应该成功");
        assert_eq!(dependencies.len(), 0, "删除后应该没有依赖");
    }
}

// ========== 权限管理测试 ==========

mod permission_management {
    use super::*;

    #[test]
    fn test_add_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("perm-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        let permission = AdapterPermission {
            id: 0,
            adapter_id: "perm-test".to_string(),
            permission_type: "file_read".to_string(),
            granted: false,
            granted_at: None,
            description: Some("读取文件权限".to_string()),
        };

        // ========== Act ==========
        let result = registry.add_permission(permission);

        // ========== Assert ==========
        assert!(result.is_ok(), "添加权限应该成功");
    }

    #[test]
    fn test_get_permissions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("multi-perm");
        registry.add_adapter(adapter).expect("添加应该成功");

        let permission_types = vec!["file_read", "file_write", "network_http"];
        for perm_type in &permission_types {
            let permission = AdapterPermission {
                id: 0,
                adapter_id: "multi-perm".to_string(),
                permission_type: perm_type.to_string(),
                granted: false,
                granted_at: None,
                description: None,
            };
            registry.add_permission(permission).expect("添加权限应该成功");
        }

        // ========== Act ==========
        let permissions = registry.get_permissions("multi-perm")
            .expect("查询权限应该成功");

        // ========== Assert ==========
        assert_eq!(permissions.len(), 3, "应该有3个权限");
    }

    #[test]
    fn test_grant_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("grant-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        let permission = AdapterPermission {
            id: 0,
            adapter_id: "grant-test".to_string(),
            permission_type: "network_http".to_string(),
            granted: false,
            granted_at: None,
            description: None,
        };
        registry.add_permission(permission).expect("添加权限应该成功");

        // ========== Act ==========
        registry.grant_permission("grant-test", "network_http", true)
            .expect("授予权限应该成功");

        // ========== Assert ==========
        let permissions = registry.get_permissions("grant-test")
            .expect("查询权限应该成功");
        
        let granted = permissions.iter()
            .find(|p| p.permission_type == "network_http")
            .expect("应该找到权限");
        
        assert!(granted.granted, "权限应该被授予");
        assert!(granted.granted_at.is_some(), "授予时间应该已设置");
    }

    #[test]
    fn test_check_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("check-perm");
        registry.add_adapter(adapter).expect("添加应该成功");

        // 添加并授予权限
        let permission = AdapterPermission {
            id: 0,
            adapter_id: "check-perm".to_string(),
            permission_type: "file_read".to_string(),
            granted: false,
            granted_at: None,
            description: None,
        };
        registry.add_permission(permission).expect("添加权限应该成功");
        registry.grant_permission("check-perm", "file_read", true)
            .expect("授予权限应该成功");

        // ========== Act ==========
        let is_granted = registry.check_permission("check-perm", "file_read")
            .expect("检查权限应该成功");

        // ========== Assert ==========
        assert!(is_granted, "已授予的权限检查应该返回true");
    }

    #[test]
    fn test_revoke_permission() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("revoke-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        let permission = AdapterPermission {
            id: 0,
            adapter_id: "revoke-test".to_string(),
            permission_type: "system_command".to_string(),
            granted: false,
            granted_at: None,
            description: None,
        };
        registry.add_permission(permission).expect("添加权限应该成功");
        registry.grant_permission("revoke-test", "system_command", true)
            .expect("授予权限应该成功");

        // ========== Act ==========
        registry.grant_permission("revoke-test", "system_command", false)
            .expect("撤销权限应该成功");

        // ========== Assert ==========
        let is_granted = registry.check_permission("revoke-test", "system_command")
            .expect("检查权限应该成功");
        assert!(!is_granted, "撤销后权限检查应该返回false");
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_full_adapter_lifecycle() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut adapter = create_test_adapter("lifecycle");

        // ========== Act & Assert ==========
        
        // 1. 添加适配器
        registry.add_adapter(adapter.clone()).expect("添加应该成功");
        assert!(registry.adapter_exists("lifecycle").unwrap(), "适配器应该存在");

        // 2. 更新状态为下载中
        registry.update_adapter_status("lifecycle", AdapterInstallStatus::Downloading)
            .expect("更新状态应该成功");

        // 3. 更新状态为安装中
        registry.update_adapter_status("lifecycle", AdapterInstallStatus::Installing)
            .expect("更新状态应该成功");

        // 4. 更新状态为已安装
        registry.update_adapter_status("lifecycle", AdapterInstallStatus::Installed)
            .expect("更新状态应该成功");

        // 5. 添加版本
        let version = AdapterVersion {
            id: 0,
            adapter_id: "lifecycle".to_string(),
            version: "1.0.0".to_string(),
            released_at: Utc::now(),
            changelog: Some("Initial release".to_string()),
            download_url: None,
            file_size: None,
            checksum: None,
            is_current: true,
        };
        registry.add_version(version).expect("添加版本应该成功");

        // 6. 添加权限
        let permission = AdapterPermission {
            id: 0,
            adapter_id: "lifecycle".to_string(),
            permission_type: "file_read".to_string(),
            granted: false,
            granted_at: None,
            description: None,
        };
        registry.add_permission(permission).expect("添加权限应该成功");
        registry.grant_permission("lifecycle", "file_read", true)
            .expect("授予权限应该成功");

        // 7. 更新最后使用时间
        registry.update_last_used("lifecycle")
            .expect("更新最后使用时间应该成功");

        // 8. 禁用适配器
        registry.set_adapter_enabled("lifecycle", false)
            .expect("禁用应该成功");

        // 9. 重新启用
        registry.set_adapter_enabled("lifecycle", true)
            .expect("启用应该成功");

        // 10. 最后验证
        let final_adapter = registry.get_adapter("lifecycle")
            .expect("查询应该成功")
            .expect("应该找到适配器");
        
        assert_eq!(final_adapter.status, AdapterInstallStatus::Installed);
        assert!(final_adapter.enabled);
        assert!(final_adapter.last_used_at.is_some());

        let versions = registry.get_versions("lifecycle").unwrap();
        assert_eq!(versions.len(), 1);

        let permissions = registry.get_permissions("lifecycle").unwrap();
        assert_eq!(permissions.len(), 1);
        assert!(permissions[0].granted);
    }

    #[test]
    fn test_cascading_delete() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter = create_test_adapter("cascade-test");
        registry.add_adapter(adapter).expect("添加应该成功");

        // 添加版本、依赖和权限
        let version = AdapterVersion {
            id: 0,
            adapter_id: "cascade-test".to_string(),
            version: "1.0.0".to_string(),
            released_at: Utc::now(),
            changelog: None,
            download_url: None,
            file_size: None,
            checksum: None,
            is_current: true,
        };
        registry.add_version(version).expect("添加版本应该成功");

        let permission = AdapterPermission {
            id: 0,
            adapter_id: "cascade-test".to_string(),
            permission_type: "network_http".to_string(),
            granted: true,
            granted_at: Some(Utc::now()),
            description: None,
        };
        registry.add_permission(permission).expect("添加权限应该成功");

        // ========== Act ==========
        registry.delete_adapter("cascade-test").expect("删除应该成功");

        // ========== Assert ==========
        // 由于外键约束设置了ON DELETE CASCADE，关联数据应该被删除
        let adapter = registry.get_adapter("cascade-test").unwrap();
        assert!(adapter.is_none(), "适配器应该被删除");

        let versions = registry.get_versions("cascade-test").unwrap();
        assert_eq!(versions.len(), 0, "版本应该被删除");

        let permissions = registry.get_permissions("cascade-test").unwrap();
        assert_eq!(permissions.len(), 0, "权限应该被删除");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_adapter_with_empty_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut adapter = create_test_adapter("empty-config");
        adapter.config = HashMap::new();
        adapter.metadata = HashMap::new();

        // ========== Act ==========
        let result = registry.add_adapter(adapter);

        // ========== Assert ==========
        assert!(result.is_ok(), "添加空配置的适配器应该成功");

        let retrieved = registry.get_adapter("empty-config")
            .unwrap()
            .unwrap();
        assert!(retrieved.config.is_empty(), "配置应该为空");
        assert!(retrieved.metadata.is_empty(), "元数据应该为空");
    }

    #[test]
    fn test_adapter_with_long_strings() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut adapter = create_test_adapter("long-strings");
        adapter.description = Some("x".repeat(10000));
        adapter.homepage_url = Some("https://".to_string() + &"x".repeat(1000) + ".com");

        // ========== Act ==========
        let result = registry.add_adapter(adapter);

        // ========== Assert ==========
        assert!(result.is_ok(), "添加长字符串适配器应该成功");
    }

    #[test]
    fn test_duplicate_adapter_id() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let adapter1 = create_test_adapter("duplicate");
        let adapter2 = create_test_adapter("duplicate");

        // ========== Act ==========
        let result1 = registry.add_adapter(adapter1);
        let result2 = registry.add_adapter(adapter2);

        // ========== Assert ==========
        assert!(result1.is_ok(), "首次添加应该成功");
        // SQLite的INSERT会失败，因为ID是主键
        assert!(result2.is_err(), "重复ID应该失败");
    }

    #[test]
    fn test_special_characters_in_fields() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut adapter = create_test_adapter("special-chars");
        adapter.name = "测试!@#$%^&*()适配器".to_string();
        adapter.description = Some("包含\n换行\t制表符\r回车的描述".to_string());

        // ========== Act ==========
        let result = registry.add_adapter(adapter.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "添加特殊字符适配器应该成功");

        let retrieved = registry.get_adapter("special-chars")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.name, adapter.name, "特殊字符应该被保留");
    }
}


//! 适配器数据库测试 - 多后端支持
//!
//! 测试适配器数据库在不同后端上的所有功能，包括：
//! - 适配器的CRUD操作（PostgreSQL, Redis）
//! - 版本管理（PostgreSQL）
//! - 依赖管理（PostgreSQL）
//! - 权限管理（PostgreSQL）
//! - 状态更新（PostgreSQL, Redis）
//! - 查询和过滤（PostgreSQL, Redis）
//!
//! ## 数据库后端支持
//! 
//! - **PostgreSQL**: 完整的关系型数据，支持所有功能
//! - **Redis**: 键值存储，用于缓存和快速访问
//! - **Qdrant**: 向量数据库（适配器元数据不使用向量存储）

mod common;

use zishu_sensei::database::adapter::{
    AdapterRegistry, InstalledAdapter, AdapterInstallStatus, AdapterVersion,
    AdapterDependency, AdapterPermission,
};
use chrono::Utc;
use std::collections::HashMap;
use common::test_db::{setup_test_postgres, setup_test_redis};

// ========== 测试数据生成辅助函数 ==========

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

// ========================================
// PostgreSQL 后端测试
// ========================================

#[cfg(test)]
mod postgres_tests {
    use super::*;

    /// 创建测试用的 PostgreSQL 数据库
    async fn setup_test_registry() -> AdapterRegistry {
        let pg = setup_test_postgres().await;
        let registry = AdapterRegistry::new(pg.backend.pool.clone());
        registry.init_tables().await.expect("无法初始化数据库表");
        registry
    }

    // ========== 适配器 CRUD 测试 ==========

    mod adapter_crud {
        use super::*;

        #[tokio::test]
        #[ignore] // 需要PostgreSQL服务器
        async fn test_add_and_get_adapter_success() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("test-001");

            // ========== Act ==========
            let add_result = registry.add_adapter(adapter.clone()).await;

            // ========== Assert ==========
            assert!(add_result.is_ok(), "添加适配器应该成功");

            let retrieved = registry.get_adapter("test-001").await.expect("查询应该成功");
            assert!(retrieved.is_some(), "应该找到适配器");
            
            let retrieved = retrieved.unwrap();
            assert_eq!(retrieved.id, adapter.id, "ID应该匹配");
            assert_eq!(retrieved.name, adapter.name, "名称应该匹配");
            assert_eq!(retrieved.version, adapter.version, "版本应该匹配");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_adapter_not_found() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;

            // ========== Act ==========
            let result = registry.get_adapter("non-existent").await
                .expect("查询应该成功");

            // ========== Assert ==========
            assert!(result.is_none(), "不存在的适配器应该返回None");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_all_adapters_empty() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;

            // ========== Act ==========
            let adapters = registry.get_all_adapters().await.expect("查询应该成功");

            // ========== Assert ==========
            assert_eq!(adapters.len(), 0, "空数据库应该返回空列表");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_all_adapters_multiple() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            
            for i in 1..=5 {
                let adapter = create_test_adapter(&format!("adapter-{}", i));
                registry.add_adapter(adapter).await.expect("添加应该成功");
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }

            // ========== Act ==========
            let adapters = registry.get_all_adapters().await.expect("查询应该成功");

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

        #[tokio::test]
        #[ignore]
        async fn test_update_adapter_success() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let mut adapter = create_test_adapter("update-test");
            registry.add_adapter(adapter.clone()).await.expect("添加应该成功");

            // ========== Act ==========
            adapter.version = "2.0.0".to_string();
            adapter.description = Some("更新后的描述".to_string());
            adapter.updated_at = Utc::now();

            let update_result = registry.update_adapter(adapter.clone()).await;

            // ========== Assert ==========
            assert!(update_result.is_ok(), "更新应该成功");

            let retrieved = registry.get_adapter("update-test").await
                .expect("查询应该成功")
                .expect("应该找到适配器");
            
            assert_eq!(retrieved.version, "2.0.0", "版本应该已更新");
            assert_eq!(
                retrieved.description,
                Some("更新后的描述".to_string()),
                "描述应该已更新"
            );
        }

        #[tokio::test]
        #[ignore]
        async fn test_delete_adapter_success() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("delete-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            // ========== Act ==========
            let delete_result = registry.delete_adapter("delete-test").await;

            // ========== Assert ==========
            assert!(delete_result.is_ok(), "删除应该成功");

            let retrieved = registry.get_adapter("delete-test").await
                .expect("查询应该成功");
            assert!(retrieved.is_none(), "删除后应该找不到适配器");
        }

        #[tokio::test]
        #[ignore]
        async fn test_adapter_exists() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("exists-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            // ========== Act & Assert ==========
            let exists = registry.adapter_exists("exists-test").await
                .expect("查询应该成功");
            assert!(exists, "已添加的适配器应该存在");

            let not_exists = registry.adapter_exists("non-existent").await
                .expect("查询应该成功");
            assert!(!not_exists, "未添加的适配器不应该存在");
        }

        #[tokio::test]
        #[ignore]
        async fn test_count_adapters() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;

            // ========== Act & Assert ==========
            let count_empty = registry.count_adapters().await.expect("计数应该成功");
            assert_eq!(count_empty, 0, "空数据库应该有0个适配器");

            // 添加适配器
            for i in 1..=3 {
                let adapter = create_test_adapter(&format!("count-{}", i));
                registry.add_adapter(adapter).await.expect("添加应该成功");
            }

            let count_after = registry.count_adapters().await.expect("计数应该成功");
            assert_eq!(count_after, 3, "应该有3个适配器");
        }
    }

    // ========== 适配器状态管理测试 ==========

    mod adapter_status {
        use super::*;

        #[tokio::test]
        #[ignore]
        async fn test_set_adapter_enabled() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("status-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            // ========== Act ==========
            registry.set_adapter_enabled("status-test", false).await
                .expect("禁用应该成功");

            // ========== Assert ==========
            let retrieved = registry.get_adapter("status-test").await
                .expect("查询应该成功")
                .unwrap();
            assert!(!retrieved.enabled, "适配器应该被禁用");

            // 重新启用
            registry.set_adapter_enabled("status-test", true).await
                .expect("启用应该成功");

            let retrieved = registry.get_adapter("status-test").await
                .expect("查询应该成功")
                .unwrap();
            assert!(retrieved.enabled, "适配器应该被启用");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_enabled_adapters() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            
            // 添加已启用的适配器
            for i in 1..=3 {
                let adapter = create_test_adapter(&format!("enabled-{}", i));
                registry.add_adapter(adapter).await.expect("添加应该成功");
            }

            // 添加已禁用的适配器
            let mut disabled_adapter = create_test_adapter("disabled");
            disabled_adapter.enabled = false;
            registry.add_adapter(disabled_adapter).await.expect("添加应该成功");

            // ========== Act ==========
            let enabled_adapters = registry.get_enabled_adapters().await
                .expect("查询应该成功");

            // ========== Assert ==========
            assert_eq!(enabled_adapters.len(), 3, "应该返回3个已启用的适配器");
            
            for adapter in enabled_adapters {
                assert!(adapter.enabled, "返回的适配器应该都是已启用的");
            }
        }

        #[tokio::test]
        #[ignore]
        async fn test_update_adapter_status() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("status-change");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            // ========== Act & Assert ==========
            let statuses = vec![
                AdapterInstallStatus::Downloading,
                AdapterInstallStatus::Installing,
                AdapterInstallStatus::Installed,
                AdapterInstallStatus::Updating,
                AdapterInstallStatus::Installed,
            ];

            for status in statuses {
                registry.update_adapter_status("status-change", status.clone()).await
                    .expect("更新状态应该成功");

                let retrieved = registry.get_adapter("status-change").await
                    .expect("查询应该成功")
                    .unwrap();
                assert_eq!(retrieved.status, status, "状态应该已更新");
            }
        }

        #[tokio::test]
        #[ignore]
        async fn test_update_last_used() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("last-used");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            let before = Utc::now();
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // ========== Act ==========
            registry.update_last_used("last-used").await
                .expect("更新最后使用时间应该成功");

            // ========== Assert ==========
            let retrieved = registry.get_adapter("last-used").await
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

        #[tokio::test]
        #[ignore]
        async fn test_add_version() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("version-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

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
            let result = registry.add_version(version).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加版本应该成功");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_versions() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("multi-version");
            registry.add_adapter(adapter).await.expect("添加应该成功");

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
                registry.add_version(version).await.expect("添加版本应该成功");
                
                // 稍微延迟以确保时间戳不同
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }

            // ========== Act ==========
            let versions = registry.get_versions("multi-version").await
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

        #[tokio::test]
        #[ignore]
        async fn test_set_current_version() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("current-version");
            registry.add_adapter(adapter).await.expect("添加应该成功");

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
                registry.add_version(version).await.expect("添加版本应该成功");
            }

            // ========== Act ==========
            registry.set_current_version("current-version", "1.2.0").await
                .expect("设置当前版本应该成功");

            // ========== Assert ==========
            let versions = registry.get_versions("current-version").await
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

        #[tokio::test]
        #[ignore]
        async fn test_add_dependency() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            
            let adapter1 = create_test_adapter("adapter-1");
            let adapter2 = create_test_adapter("adapter-2");
            registry.add_adapter(adapter1).await.expect("添加应该成功");
            registry.add_adapter(adapter2).await.expect("添加应该成功");

            let dependency = AdapterDependency {
                id: 0,
                adapter_id: "adapter-1".to_string(),
                dependency_id: "adapter-2".to_string(),
                version_requirement: ">=1.0.0".to_string(),
                required: true,
            };

            // ========== Act ==========
            let result = registry.add_dependency(dependency).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加依赖应该成功");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_dependencies() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            
            // 添加适配器
            for i in 0..=3 {
                let adapter = create_test_adapter(&format!("adapter-{}", i));
                registry.add_adapter(adapter).await.expect("添加应该成功");
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
                registry.add_dependency(dependency).await.expect("添加依赖应该成功");
            }

            // ========== Act ==========
            let dependencies = registry.get_dependencies("adapter-0").await
                .expect("查询依赖应该成功");

            // ========== Assert ==========
            assert_eq!(dependencies.len(), 3, "应该有3个依赖");
            
            let required_count = dependencies.iter()
                .filter(|d| d.required)
                .count();
            assert_eq!(required_count, 2, "应该有2个必需依赖");
        }

        #[tokio::test]
        #[ignore]
        async fn test_delete_dependency() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            
            let adapter1 = create_test_adapter("adapter-1");
            let adapter2 = create_test_adapter("adapter-2");
            registry.add_adapter(adapter1).await.expect("添加应该成功");
            registry.add_adapter(adapter2).await.expect("添加应该成功");

            let dependency = AdapterDependency {
                id: 0,
                adapter_id: "adapter-1".to_string(),
                dependency_id: "adapter-2".to_string(),
                version_requirement: ">=1.0.0".to_string(),
                required: true,
            };
            registry.add_dependency(dependency).await.expect("添加依赖应该成功");

            // ========== Act ==========
            let result = registry.delete_dependency("adapter-1", "adapter-2").await;

            // ========== Assert ==========
            assert!(result.is_ok(), "删除依赖应该成功");

            let dependencies = registry.get_dependencies("adapter-1").await
                .expect("查询依赖应该成功");
            assert_eq!(dependencies.len(), 0, "删除后应该没有依赖");
        }
    }

    // ========== 权限管理测试 ==========

    mod permission_management {
        use super::*;

        #[tokio::test]
        #[ignore]
        async fn test_add_permission() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("perm-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            let permission = AdapterPermission {
                id: 0,
                adapter_id: "perm-test".to_string(),
                permission_type: "file_read".to_string(),
                granted: false,
                granted_at: None,
                description: Some("读取文件权限".to_string()),
            };

            // ========== Act ==========
            let result = registry.add_permission(permission).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加权限应该成功");
        }

        #[tokio::test]
        #[ignore]
        async fn test_get_permissions() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("multi-perm");
            registry.add_adapter(adapter).await.expect("添加应该成功");

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
                registry.add_permission(permission).await.expect("添加权限应该成功");
            }

            // ========== Act ==========
            let permissions = registry.get_permissions("multi-perm").await
                .expect("查询权限应该成功");

            // ========== Assert ==========
            assert_eq!(permissions.len(), 3, "应该有3个权限");
        }

        #[tokio::test]
        #[ignore]
        async fn test_grant_permission() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("grant-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            let permission = AdapterPermission {
                id: 0,
                adapter_id: "grant-test".to_string(),
                permission_type: "network_http".to_string(),
                granted: false,
                granted_at: None,
                description: None,
            };
            registry.add_permission(permission).await.expect("添加权限应该成功");

            // ========== Act ==========
            registry.grant_permission("grant-test", "network_http", true).await
                .expect("授予权限应该成功");

            // ========== Assert ==========
            let permissions = registry.get_permissions("grant-test").await
                .expect("查询权限应该成功");
            
            let granted = permissions.iter()
                .find(|p| p.permission_type == "network_http")
                .expect("应该找到权限");
            
            assert!(granted.granted, "权限应该被授予");
            assert!(granted.granted_at.is_some(), "授予时间应该已设置");
        }

        #[tokio::test]
        #[ignore]
        async fn test_check_permission() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("check-perm");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            // 添加并授予权限
            let permission = AdapterPermission {
                id: 0,
                adapter_id: "check-perm".to_string(),
                permission_type: "file_read".to_string(),
                granted: false,
                granted_at: None,
                description: None,
            };
            registry.add_permission(permission).await.expect("添加权限应该成功");
            registry.grant_permission("check-perm", "file_read", true).await
                .expect("授予权限应该成功");

            // ========== Act ==========
            let is_granted = registry.check_permission("check-perm", "file_read").await
                .expect("检查权限应该成功");

            // ========== Assert ==========
            assert!(is_granted, "已授予的权限检查应该返回true");
        }

        #[tokio::test]
        #[ignore]
        async fn test_revoke_permission() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("revoke-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

            let permission = AdapterPermission {
                id: 0,
                adapter_id: "revoke-test".to_string(),
                permission_type: "system_command".to_string(),
                granted: false,
                granted_at: None,
                description: None,
            };
            registry.add_permission(permission).await.expect("添加权限应该成功");
            registry.grant_permission("revoke-test", "system_command", true).await
                .expect("授予权限应该成功");

            // ========== Act ==========
            registry.grant_permission("revoke-test", "system_command", false).await
                .expect("撤销权限应该成功");

            // ========== Assert ==========
            let is_granted = registry.check_permission("revoke-test", "system_command").await
                .expect("检查权限应该成功");
            assert!(!is_granted, "撤销后权限检查应该返回false");
        }
    }

    // ========== 复杂场景测试 ==========

    mod complex_scenarios {
        use super::*;

        #[tokio::test]
        #[ignore]
        async fn test_full_adapter_lifecycle() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("lifecycle");

            // ========== Act & Assert ==========
            
            // 1. 添加适配器
            registry.add_adapter(adapter.clone()).await.expect("添加应该成功");
            assert!(registry.adapter_exists("lifecycle").await.unwrap(), "适配器应该存在");

            // 2. 更新状态为下载中
            registry.update_adapter_status("lifecycle", AdapterInstallStatus::Downloading).await
                .expect("更新状态应该成功");

            // 3. 更新状态为安装中
            registry.update_adapter_status("lifecycle", AdapterInstallStatus::Installing).await
                .expect("更新状态应该成功");

            // 4. 更新状态为已安装
            registry.update_adapter_status("lifecycle", AdapterInstallStatus::Installed).await
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
            registry.add_version(version).await.expect("添加版本应该成功");

            // 6. 添加权限
            let permission = AdapterPermission {
                id: 0,
                adapter_id: "lifecycle".to_string(),
                permission_type: "file_read".to_string(),
                granted: false,
                granted_at: None,
                description: None,
            };
            registry.add_permission(permission).await.expect("添加权限应该成功");
            registry.grant_permission("lifecycle", "file_read", true).await
                .expect("授予权限应该成功");

            // 7. 更新最后使用时间
            registry.update_last_used("lifecycle").await
                .expect("更新最后使用时间应该成功");

            // 8. 禁用适配器
            registry.set_adapter_enabled("lifecycle", false).await
                .expect("禁用应该成功");

            // 9. 重新启用
            registry.set_adapter_enabled("lifecycle", true).await
                .expect("启用应该成功");

            // 10. 最后验证
            let final_adapter = registry.get_adapter("lifecycle").await
                .expect("查询应该成功")
                .expect("应该找到适配器");
            
            assert_eq!(final_adapter.status, AdapterInstallStatus::Installed);
            assert!(final_adapter.enabled);
            assert!(final_adapter.last_used_at.is_some());

            let versions = registry.get_versions("lifecycle").await.unwrap();
            assert_eq!(versions.len(), 1);

            let permissions = registry.get_permissions("lifecycle").await.unwrap();
            assert_eq!(permissions.len(), 1);
            assert!(permissions[0].granted);
        }

        #[tokio::test]
        #[ignore]
        async fn test_cascading_delete() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter = create_test_adapter("cascade-test");
            registry.add_adapter(adapter).await.expect("添加应该成功");

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
            registry.add_version(version).await.expect("添加版本应该成功");

            let permission = AdapterPermission {
                id: 0,
                adapter_id: "cascade-test".to_string(),
                permission_type: "network_http".to_string(),
                granted: true,
                granted_at: Some(Utc::now()),
                description: None,
            };
            registry.add_permission(permission).await.expect("添加权限应该成功");

            // ========== Act ==========
            registry.delete_adapter("cascade-test").await.expect("删除应该成功");

            // ========== Assert ==========
            // 由于外键约束设置了ON DELETE CASCADE，关联数据应该被删除
            let adapter = registry.get_adapter("cascade-test").await.unwrap();
            assert!(adapter.is_none(), "适配器应该被删除");

            let versions = registry.get_versions("cascade-test").await.unwrap();
            assert_eq!(versions.len(), 0, "版本应该被删除");

            let permissions = registry.get_permissions("cascade-test").await.unwrap();
            assert_eq!(permissions.len(), 0, "权限应该被删除");
        }
    }

    // ========== 边界条件测试 ==========

    mod edge_cases {
        use super::*;

        #[tokio::test]
        #[ignore]
        async fn test_adapter_with_empty_config() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let mut adapter = create_test_adapter("empty-config");
            adapter.config = HashMap::new();
            adapter.metadata = HashMap::new();

            // ========== Act ==========
            let result = registry.add_adapter(adapter).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加空配置的适配器应该成功");

            let retrieved = registry.get_adapter("empty-config").await
                .unwrap()
                .unwrap();
            assert!(retrieved.config.is_empty(), "配置应该为空");
            assert!(retrieved.metadata.is_empty(), "元数据应该为空");
        }

        #[tokio::test]
        #[ignore]
        async fn test_adapter_with_long_strings() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let mut adapter = create_test_adapter("long-strings");
            adapter.description = Some("x".repeat(10000));
            adapter.homepage_url = Some("https://".to_string() + &"x".repeat(1000) + ".com");

            // ========== Act ==========
            let result = registry.add_adapter(adapter).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加长字符串适配器应该成功");
        }

        #[tokio::test]
        #[ignore]
        async fn test_duplicate_adapter_id() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let adapter1 = create_test_adapter("duplicate");
            let adapter2 = create_test_adapter("duplicate");

            // ========== Act ==========
            let result1 = registry.add_adapter(adapter1).await;
            let result2 = registry.add_adapter(adapter2).await;

            // ========== Assert ==========
            assert!(result1.is_ok(), "首次添加应该成功");
            assert!(result2.is_err(), "重复ID应该失败");
        }

        #[tokio::test]
        #[ignore]
        async fn test_special_characters_in_fields() {
            // ========== Arrange ==========
            let registry = setup_test_registry().await;
            let mut adapter = create_test_adapter("special-chars");
            adapter.name = "测试!@#$%^&*()适配器".to_string();
            adapter.description = Some("包含\n换行\t制表符\r回车的描述".to_string());

            // ========== Act ==========
            let result = registry.add_adapter(adapter.clone()).await;

            // ========== Assert ==========
            assert!(result.is_ok(), "添加特殊字符适配器应该成功");

            let retrieved = registry.get_adapter("special-chars").await
                .unwrap()
                .unwrap();
            assert_eq!(retrieved.name, adapter.name, "特殊字符应该被保留");
        }
    }
}

// ========================================
// Redis 后端测试
// ========================================
// 
// 注意：Redis作为缓存后端，主要用于快速访问适配器元数据
// 不支持复杂的关系查询（如版本、依赖、权限管理）

#[cfg(test)]
mod redis_tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要Redis服务器
    async fn test_redis_basic_adapter_operations() {
        // Redis后端主要用于缓存适配器的基本信息
        // 复杂的关系数据仍然存储在PostgreSQL中
        
        let mut redis_db = setup_test_redis().await;
        let backend = redis_db.get_backend();
        
        // 测试基本的键值存储
        let adapter = create_test_adapter("redis-test-1");
        let adapter_data = serde_json::to_value(&adapter).unwrap();
        
        backend.insert("adapters", "redis-test-1", &adapter_data)
            .await
            .expect("Redis插入应该成功");
        
        let retrieved = backend.get("adapters", "redis-test-1")
            .await
            .expect("Redis获取应该成功");
        
        assert!(retrieved.is_some(), "应该能从Redis获取数据");
        
        // 清理
        redis_db.clear_all_data().await.ok();
    }

    #[tokio::test]
    #[ignore] // 需要Redis服务器
    async fn test_redis_adapter_caching() {
        let mut redis_db = setup_test_redis().await;
        let backend = redis_db.get_backend();
        
        // 模拟缓存场景：先从数据库加载，然后缓存到Redis
        let adapters = vec![
            create_test_adapter("cache-1"),
            create_test_adapter("cache-2"),
            create_test_adapter("cache-3"),
        ];
        
        // 批量缓存
        for adapter in &adapters {
            let adapter_data = serde_json::to_value(adapter).unwrap();
            backend.insert("adapters", &adapter.id, &adapter_data)
                .await
                .expect("缓存应该成功");
        }
        
        // 验证缓存
        let cached = backend.get("adapters", "cache-2")
            .await
            .expect("获取缓存应该成功")
            .expect("缓存应该存在");
        
        assert_eq!(cached["name"], "Test Adapter cache-2");
        
        // 清理
        redis_db.clear_all_data().await.ok();
    }
}

// ========================================
// 说明：Qdrant 后端
// ========================================
//
// Qdrant是向量数据库，主要用于：
// - 存储适配器描述的向量表示
// - 支持语义搜索（根据描述查找相似适配器）
// - 不用于存储适配器的结构化元数据
//
// 适配器元数据的标准存储仍然是PostgreSQL
// 因此这里不为Qdrant创建独立的适配器CRUD测试

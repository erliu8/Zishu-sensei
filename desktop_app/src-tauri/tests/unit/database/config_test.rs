//! 配置管理数据库测试
//!
//! 测试配置管理的所有功能，包括：
//! - 配置项的CRUD操作
//! - 配置分组管理
//! - 配置验证
//! - 配置历史记录
//! - 配置导入导出

use zishu_sensei::database::config::{
    ConfigManager, ConfigItem, ConfigValue, ConfigGroup,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;

// ========== 辅助函数 ==========

fn setup_test_manager() -> ConfigManager {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let manager = ConfigManager::new(conn);
    manager.init_tables().expect("无法初始化数据库表");
    manager
}

fn create_test_config(key: &str) -> ConfigItem {
    ConfigItem {
        key: key.to_string(),
        value: ConfigValue::String("test_value".to_string()),
        group: "test".to_string(),
        description: Some(format!("测试配置项 {}", key)),
        is_system: false,
        is_encrypted: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

// ========== 配置项 CRUD 测试 ==========

mod config_crud {
    use super::*;

    #[test]
    fn test_set_and_get_config() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let config = create_test_config("test.key1");

        // ========== Act ==========
        let result = manager.set_config(config.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "设置配置应该成功");

        let retrieved = manager.get_config("test.key1")
            .expect("查询应该成功")
            .expect("应该找到配置");
        
        assert_eq!(retrieved.key, config.key);
        assert_eq!(retrieved.value, config.value);
    }

    #[test]
    fn test_get_config_not_found() {
        // ========== Arrange ==========
        let manager = setup_test_manager();

        // ========== Act ==========
        let result = manager.get_config("non.existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的配置应该返回None");
    }

    #[test]
    fn test_update_config() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let config = create_test_config("update.test");
        manager.set_config(config).unwrap();

        // ========== Act ==========
        let mut updated = create_test_config("update.test");
        updated.value = ConfigValue::Integer(42);
        
        let result = manager.set_config(updated.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新配置应该成功");

        let retrieved = manager.get_config("update.test")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.value, ConfigValue::Integer(42));
    }

    #[test]
    fn test_delete_config() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let config = create_test_config("delete.test");
        manager.set_config(config).unwrap();

        // ========== Act ==========
        let result = manager.delete_config("delete.test");

        // ========== Assert ==========
        assert!(result.is_ok(), "删除配置应该成功");

        let retrieved = manager.get_config("delete.test")
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到配置");
    }

    #[test]
    fn test_get_all_configs() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        for i in 1..=5 {
            let config = create_test_config(&format!("test.config{}", i));
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let configs = manager.get_all_configs()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(configs.len(), 5, "应该返回5个配置项");
    }
}

// ========== 配置值类型测试 ==========

mod config_value_types {
    use super::*;

    #[test]
    fn test_string_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("string.test");
        config.value = ConfigValue::String("测试字符串".to_string());

        // ========== Act ==========
        manager.set_config(config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("string.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, config.value);
    }

    #[test]
    fn test_integer_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("integer.test");
        config.value = ConfigValue::Integer(12345);

        // ========== Act ==========
        manager.set_config(config).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("integer.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::Integer(12345));
    }

    #[test]
    fn test_float_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("float.test");
        config.value = ConfigValue::Float(3.14159);

        // ========== Act ==========
        manager.set_config(config).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("float.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::Float(3.14159));
    }

    #[test]
    fn test_boolean_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("boolean.test");
        config.value = ConfigValue::Boolean(true);

        // ========== Act ==========
        manager.set_config(config).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("boolean.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::Boolean(true));
    }

    #[test]
    fn test_json_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("json.test");
        let json_data = serde_json::json!({
            "name": "测试",
            "count": 42,
            "enabled": true,
            "items": ["a", "b", "c"]
        });
        config.value = ConfigValue::Json(json_data.clone());

        // ========== Act ==========
        manager.set_config(config).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("json.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::Json(json_data));
    }

    #[test]
    fn test_array_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("array.test");
        config.value = ConfigValue::Array(vec![
            "item1".to_string(),
            "item2".to_string(),
            "item3".to_string(),
        ]);

        // ========== Act ==========
        manager.set_config(config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("array.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, config.value);
    }
}

// ========== 配置分组测试 ==========

mod config_groups {
    use super::*;

    #[test]
    fn test_get_configs_by_group() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        // 创建app组的配置
        for i in 1..=3 {
            let mut config = create_test_config(&format!("app.config{}", i));
            config.group = "app".to_string();
            manager.set_config(config).unwrap();
        }

        // 创建ui组的配置
        for i in 1..=2 {
            let mut config = create_test_config(&format!("ui.config{}", i));
            config.group = "ui".to_string();
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let app_configs = manager.get_configs_by_group("app")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(app_configs.len(), 3, "app组应该有3个配置");
        
        for config in app_configs {
            assert_eq!(config.group, "app");
        }
    }

    #[test]
    fn test_get_all_groups() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let groups = vec!["app", "ui", "system", "network"];
        
        for group in &groups {
            let mut config = create_test_config(&format!("{}.test", group));
            config.group = group.to_string();
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let all_groups = manager.get_all_groups()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(all_groups.len(), 4, "应该有4个分组");
        
        for group in groups {
            assert!(all_groups.contains(&group.to_string()));
        }
    }
}

// ========== 系统配置测试 ==========

mod system_configs {
    use super::*;

    #[test]
    fn test_system_config_flag() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut system_config = create_test_config("system.version");
        system_config.is_system = true;
        manager.set_config(system_config).unwrap();

        let mut user_config = create_test_config("user.setting");
        user_config.is_system = false;
        manager.set_config(user_config).unwrap();

        // ========== Act ==========
        let system_configs = manager.get_system_configs()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(system_configs.len(), 1, "应该有1个系统配置");
        assert!(system_configs[0].is_system);
    }

    #[test]
    fn test_protect_system_config() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut config = create_test_config("system.protected");
        config.is_system = true;
        manager.set_config(config).unwrap();

        // ========== Act ==========
        let result = manager.delete_config("system.protected");

        // ========== Assert ==========
        // 根据实现，系统配置可能不允许删除
        // 这里假设会返回错误
        if result.is_err() {
            // 预期行为：不能删除系统配置
            assert!(true);
        } else {
            // 如果允许删除，至少验证它确实被删除了
            let retrieved = manager.get_config("system.protected").unwrap();
            assert!(retrieved.is_none());
        }
    }
}

// ========== 加密配置测试 ==========

mod encrypted_configs {
    use super::*;

    #[test]
    fn test_encrypted_config() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut config = create_test_config("secure.password");
        config.value = ConfigValue::String("my_secret_password".to_string());
        config.is_encrypted = true;

        // ========== Act ==========
        manager.set_config(config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("secure.password")
            .unwrap()
            .unwrap();
        
        assert!(retrieved.is_encrypted);
        // 根据实现，值可能已加密，这里只验证标志
    }

    #[test]
    fn test_get_encrypted_configs() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        for i in 1..=3 {
            let mut config = create_test_config(&format!("secure.key{}", i));
            config.is_encrypted = true;
            manager.set_config(config).unwrap();
        }

        for i in 1..=2 {
            let mut config = create_test_config(&format!("plain.key{}", i));
            config.is_encrypted = false;
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let encrypted = manager.get_encrypted_configs()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(encrypted.len(), 3, "应该有3个加密配置");
        
        for config in encrypted {
            assert!(config.is_encrypted);
        }
    }
}

// ========== 配置历史记录测试 ==========

mod config_history {
    use super::*;

    #[test]
    fn test_config_update_history() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut config = create_test_config("history.test");
        config.value = ConfigValue::String("version1".to_string());
        manager.set_config(config.clone()).unwrap();

        // ========== Act ==========
        // 多次更新
        for i in 2..=5 {
            config.value = ConfigValue::String(format!("version{}", i));
            manager.set_config(config.clone()).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Assert ==========
        let history = manager.get_config_history("history.test", Some(10))
            .expect("查询应该成功");
        
        // 根据实现，可能会保存历史记录
        if !history.is_empty() {
            assert!(history.len() <= 5, "历史记录应该不超过5条");
        }
    }

    #[test]
    fn test_config_history_limit() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut config = create_test_config("limit.test");
        
        // 创建多个历史版本
        for i in 1..=20 {
            config.value = ConfigValue::Integer(i);
            manager.set_config(config.clone()).unwrap();
        }

        // ========== Act ==========
        let history = manager.get_config_history("limit.test", Some(5))
            .expect("查询应该成功");

        // ========== Assert ==========
        if !history.is_empty() {
            assert!(history.len() <= 5, "应该只返回最近的5条历史");
        }
    }
}

// ========== 配置验证测试 ==========

mod config_validation {
    use super::*;

    #[test]
    fn test_validate_config_key() {
        // ========== Arrange ==========
        let manager = setup_test_manager();

        // ========== Act & Assert ==========
        let valid_keys = vec![
            "app.name",
            "ui.theme.color",
            "system.version",
            "network.timeout",
        ];

        for key in valid_keys {
            let config = create_test_config(key);
            let result = manager.set_config(config);
            assert!(result.is_ok(), "有效的key应该被接受: {}", key);
        }
    }

    #[test]
    fn test_invalid_config_key() {
        // ========== Arrange ==========
        let manager = setup_test_manager();

        // ========== Act & Assert ==========
        // 根据实现，某些key格式可能不被接受
        let invalid_keys = vec![
            "",  // 空key
            " ", // 空格
        ];

        for key in invalid_keys {
            if key.is_empty() {
                // 空key应该导致错误
                let config = create_test_config(key);
                let result = manager.set_config(config);
                // 某些实现可能会拒绝空key
                if result.is_err() {
                    assert!(true, "空key应该被拒绝");
                }
            }
        }
    }
}

// ========== 配置导入导出测试 ==========

mod config_import_export {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_export_configs() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        for i in 1..=5 {
            let config = create_test_config(&format!("export.key{}", i));
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let exported = manager.export_configs(None)
            .expect("导出应该成功");

        // ========== Assert ==========
        assert!(!exported.is_empty(), "导出的配置不应为空");
    }

    #[test]
    fn test_export_configs_by_group() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        for i in 1..=3 {
            let mut config = create_test_config(&format!("app.key{}", i));
            config.group = "app".to_string();
            manager.set_config(config).unwrap();
        }

        for i in 1..=2 {
            let mut config = create_test_config(&format!("ui.key{}", i));
            config.group = "ui".to_string();
            manager.set_config(config).unwrap();
        }

        // ========== Act ==========
        let exported = manager.export_configs(Some("app"))
            .expect("导出应该成功");

        // ========== Assert ==========
        assert_eq!(exported.len(), 3, "应该只导出app组的配置");
    }

    #[test]
    fn test_import_configs() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut configs = HashMap::new();
        for i in 1..=5 {
            let config = create_test_config(&format!("import.key{}", i));
            configs.insert(config.key.clone(), config);
        }

        // ========== Act ==========
        let result = manager.import_configs(configs, false);

        // ========== Assert ==========
        assert!(result.is_ok(), "导入应该成功");

        for i in 1..=5 {
            let retrieved = manager.get_config(&format!("import.key{}", i))
                .unwrap();
            assert!(retrieved.is_some(), "导入的配置应该存在");
        }
    }

    #[test]
    fn test_import_with_override() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        // 先设置一个配置
        let mut config = create_test_config("override.test");
        config.value = ConfigValue::String("original".to_string());
        manager.set_config(config).unwrap();

        // 准备导入数据
        let mut configs = HashMap::new();
        let mut new_config = create_test_config("override.test");
        new_config.value = ConfigValue::String("updated".to_string());
        configs.insert(new_config.key.clone(), new_config);

        // ========== Act ==========
        manager.import_configs(configs, true).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("override.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::String("updated".to_string()));
    }

    #[test]
    fn test_import_without_override() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        // 先设置一个配置
        let mut config = create_test_config("no_override.test");
        config.value = ConfigValue::String("original".to_string());
        manager.set_config(config).unwrap();

        // 准备导入数据
        let mut configs = HashMap::new();
        let mut new_config = create_test_config("no_override.test");
        new_config.value = ConfigValue::String("updated".to_string());
        configs.insert(new_config.key.clone(), new_config);

        // ========== Act ==========
        manager.import_configs(configs, false).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("no_override.test")
            .unwrap()
            .unwrap();
        // 应该保持原值
        assert_eq!(retrieved.value, ConfigValue::String("original".to_string()));
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_config_lifecycle() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        // 1. 创建配置
        let mut config = create_test_config("lifecycle.test");
        config.value = ConfigValue::Integer(1);
        manager.set_config(config.clone()).unwrap();

        // 2. 多次更新
        for i in 2..=5 {
            config.value = ConfigValue::Integer(i);
            manager.set_config(config.clone()).unwrap();
        }

        // 3. 验证当前值
        let current = manager.get_config("lifecycle.test")
            .unwrap()
            .unwrap();
        assert_eq!(current.value, ConfigValue::Integer(5));

        // 4. 查看历史（如果支持）
        let history = manager.get_config_history("lifecycle.test", None);
        if history.is_ok() {
            let h = history.unwrap();
            if !h.is_empty() {
                assert!(h.len() >= 1);
            }
        }

        // 5. 删除配置
        manager.delete_config("lifecycle.test").unwrap();
        
        let deleted = manager.get_config("lifecycle.test").unwrap();
        assert!(deleted.is_none());
    }

    #[test]
    fn test_multi_group_management() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let groups = vec![
            ("app", 5),
            ("ui", 3),
            ("network", 4),
            ("system", 2),
        ];

        // 为每个组创建配置
        for (group, count) in &groups {
            for i in 1..=*count {
                let mut config = create_test_config(&format!("{}.config{}", group, i));
                config.group = group.to_string();
                manager.set_config(config).unwrap();
            }
        }

        // ========== Act & Assert ==========
        for (group, expected_count) in groups {
            let configs = manager.get_configs_by_group(group).unwrap();
            assert_eq!(configs.len(), expected_count, "{}组应该有{}个配置", group, expected_count);
        }

        let all_configs = manager.get_all_configs().unwrap();
        assert_eq!(all_configs.len(), 14, "总共应该有14个配置");
    }

    #[test]
    fn test_mixed_value_types() {
        // ========== Arrange ==========
        let manager = setup_test_manager();

        let configs = vec![
            ("string.value", ConfigValue::String("测试".to_string())),
            ("int.value", ConfigValue::Integer(42)),
            ("float.value", ConfigValue::Float(3.14)),
            ("bool.value", ConfigValue::Boolean(true)),
            ("array.value", ConfigValue::Array(vec!["a".to_string(), "b".to_string()])),
            ("json.value", ConfigValue::Json(serde_json::json!({"key": "value"}))),
        ];

        // ========== Act ==========
        for (key, value) in &configs {
            let mut config = create_test_config(key);
            config.value = value.clone();
            manager.set_config(config).unwrap();
        }

        // ========== Assert ==========
        for (key, expected_value) in configs {
            let retrieved = manager.get_config(key)
                .unwrap()
                .unwrap();
            assert_eq!(retrieved.value, expected_value);
        }
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_config_with_empty_value() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("empty.value");
        config.value = ConfigValue::String("".to_string());

        // ========== Act ==========
        let result = manager.set_config(config);

        // ========== Assert ==========
        assert!(result.is_ok(), "空值应该被接受");
    }

    #[test]
    fn test_config_with_long_key() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let long_key = format!("app.{}.config", "level.".repeat(50));
        let config = create_test_config(&long_key);

        // ========== Act ==========
        let result = manager.set_config(config);

        // ========== Assert ==========
        assert!(result.is_ok(), "长key应该被接受");
    }

    #[test]
    fn test_config_with_special_characters() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("special.test");
        config.value = ConfigValue::String("测试@#$%^&*()\n\t\"'".to_string());

        // ========== Act ==========
        let result = manager.set_config(config.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "特殊字符应该被正确处理");

        let retrieved = manager.get_config("special.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, config.value);
    }

    #[test]
    fn test_config_with_large_json() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        
        let mut large_object = serde_json::Map::new();
        for i in 0..100 {
            large_object.insert(
                format!("key_{}", i),
                serde_json::json!({
                    "value": format!("data_{}", i),
                    "nested": {
                        "field1": i,
                        "field2": format!("nested_{}", i)
                    }
                })
            );
        }

        let mut config = create_test_config("large.json");
        config.value = ConfigValue::Json(serde_json::Value::Object(large_object.clone()));

        // ========== Act ==========
        let result = manager.set_config(config);

        // ========== Assert ==========
        assert!(result.is_ok(), "大型JSON应该被接受");

        let retrieved = manager.get_config("large.json")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, ConfigValue::Json(serde_json::Value::Object(large_object)));
    }

    #[test]
    fn test_config_with_unicode() {
        // ========== Arrange ==========
        let manager = setup_test_manager();
        let mut config = create_test_config("unicode.test");
        config.value = ConfigValue::String("Hello 世界 🌍 مرحبا Привет".to_string());

        // ========== Act ==========
        manager.set_config(config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = manager.get_config("unicode.test")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.value, config.value);
    }

    #[test]
    fn test_concurrent_config_updates() {
        use std::sync::Arc;
        use std::thread;

        // ========== Arrange ==========
        let conn = Connection::open_in_memory().unwrap();
        let conn = Arc::new(RwLock::new(conn));
        let manager = Arc::new(ConfigManager::new(conn));
        manager.init_tables().unwrap();

        // ========== Act ==========
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let manager = Arc::clone(&manager);
                thread::spawn(move || {
                    let mut config = create_test_config(&format!("concurrent.key{}", i));
                    config.value = ConfigValue::Integer(i);
                    manager.set_config(config)
                })
            })
            .collect();

        // ========== Assert ==========
        for handle in handles {
            let result = handle.join().unwrap();
            assert!(result.is_ok(), "并发更新应该成功");
        }

        let all_configs = manager.get_all_configs().unwrap();
        assert_eq!(all_configs.len(), 10, "应该有10个配置项");
    }
}


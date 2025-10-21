//! 角色注册表数据库测试
//!
//! 测试角色注册表的所有功能，包括：
//! - 角色的CRUD操作
//! - 角色配置管理
//! - 激活角色管理
//! - 动作和表情管理

use zishu_sensei::database::character_registry::{
    CharacterRegistry, CharacterData, CharacterConfig,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;

// ========== 辅助函数 ==========

fn setup_test_registry() -> CharacterRegistry {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    
    // 手动初始化表结构
    {
        let c = conn.write();
        c.execute(
            "CREATE TABLE characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                path TEXT NOT NULL,
                preview_image TEXT,
                description TEXT,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                features TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();

        c.execute(
            "CREATE TABLE character_motions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                motion_name TEXT NOT NULL,
                motion_group TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, motion_name)
            )",
            [],
        ).unwrap();

        c.execute(
            "CREATE TABLE character_expressions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                expression_name TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, expression_name)
            )",
            [],
        ).unwrap();

        c.execute(
            "CREATE TABLE character_configs (
                character_id TEXT PRIMARY KEY,
                scale REAL NOT NULL DEFAULT 1.0,
                position_x REAL NOT NULL DEFAULT 0.0,
                position_y REAL NOT NULL DEFAULT 0.0,
                interaction_enabled INTEGER NOT NULL DEFAULT 1,
                config_json TEXT,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )",
            [],
        ).unwrap();
    }
    
    CharacterRegistry::new(conn)
}

fn create_test_character(id: &str) -> CharacterData {
    CharacterData {
        id: id.to_string(),
        name: format!("character_{}", id),
        display_name: format!("测试角色 {}", id),
        path: format!("/path/to/{}", id),
        preview_image: Some(format!("/preview/{}.png", id)),
        description: format!("这是测试角色 {}", id),
        gender: "female".to_string(),
        size: "medium".to_string(),
        features: vec!["可爱".to_string(), "活泼".to_string()],
        motions: vec!["idle".to_string(), "walk".to_string()],
        expressions: vec!["happy".to_string(), "sad".to_string()],
        is_active: false,
    }
}

// ========== 角色 CRUD 测试 ==========

mod character_crud {
    use super::*;

    #[test]
    fn test_register_and_get_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("hiyori");

        // ========== Act ==========
        let result = registry.register_character(character.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "注册角色应该成功");

        let retrieved = registry.get_character("hiyori")
            .expect("查询应该成功")
            .expect("应该找到角色");
        
        assert_eq!(retrieved.id, character.id);
        assert_eq!(retrieved.name, character.name);
        assert_eq!(retrieved.display_name, character.display_name);
    }

    #[test]
    fn test_get_character_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let result = registry.get_character("non-existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的角色应该返回None");
    }

    #[test]
    fn test_get_all_characters() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        for i in 1..=5 {
            let character = create_test_character(&format!("char-{}", i));
            registry.register_character(character)
                .expect("注册应该成功");
        }

        // ========== Act ==========
        let characters = registry.get_all_characters()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(characters.len(), 5, "应该返回5个角色");
    }

    #[test]
    fn test_update_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("update-test");
        registry.register_character(character.clone())
            .expect("注册应该成功");

        // ========== Act ==========
        character.display_name = "更新后的名称".to_string();
        character.description = "更新后的描述".to_string();
        
        let result = registry.update_character(character.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新应该成功");

        let retrieved = registry.get_character("update-test")
            .expect("查询应该成功")
            .unwrap();
        
        assert_eq!(retrieved.display_name, "更新后的名称");
        assert_eq!(retrieved.description, "更新后的描述");
    }

    #[test]
    fn test_delete_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("delete-test");
        registry.register_character(character)
            .expect("注册应该成功");

        // ========== Act ==========
        let result = registry.delete_character("delete-test");

        // ========== Assert ==========
        assert!(result.is_ok(), "删除应该成功");

        let retrieved = registry.get_character("delete-test")
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到角色");
    }

    #[test]
    fn test_register_replaces_existing() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character1 = create_test_character("replace-test");
        registry.register_character(character1)
            .expect("首次注册应该成功");

        // ========== Act ==========
        let mut character2 = create_test_character("replace-test");
        character2.display_name = "新的显示名称".to_string();
        
        let result = registry.register_character(character2);

        // ========== Assert ==========
        assert!(result.is_ok(), "重复注册应该成功（替换）");

        let retrieved = registry.get_character("replace-test")
            .expect("查询应该成功")
            .unwrap();
        
        assert_eq!(retrieved.display_name, "新的显示名称", "应该使用新的数据");
    }
}

// ========== 激活角色管理测试 ==========

mod active_character {
    use super::*;

    #[test]
    fn test_set_active_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("active-test");
        registry.register_character(character)
            .expect("注册应该成功");

        // ========== Act ==========
        let result = registry.set_active_character("active-test");

        // ========== Assert ==========
        assert!(result.is_ok(), "设置激活角色应该成功");

        let active = registry.get_active_character()
            .expect("查询应该成功")
            .expect("应该有激活角色");
        
        assert_eq!(active.id, "active-test");
        assert!(active.is_active);
    }

    #[test]
    fn test_get_active_character_none() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let active = registry.get_active_character()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(active.is_none(), "没有激活角色应该返回None");
    }

    #[test]
    fn test_set_active_deactivates_previous() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        
        let char1 = create_test_character("char1");
        let char2 = create_test_character("char2");
        
        registry.register_character(char1).unwrap();
        registry.register_character(char2).unwrap();

        registry.set_active_character("char1").unwrap();

        // ========== Act ==========
        registry.set_active_character("char2").unwrap();

        // ========== Assert ==========
        let char1_retrieved = registry.get_character("char1")
            .unwrap()
            .unwrap();
        assert!(!char1_retrieved.is_active, "之前的激活角色应该被取消激活");

        let char2_retrieved = registry.get_character("char2")
            .unwrap()
            .unwrap();
        assert!(char2_retrieved.is_active, "新角色应该被激活");

        let active = registry.get_active_character()
            .unwrap()
            .unwrap();
        assert_eq!(active.id, "char2", "激活角色应该是char2");
    }

    #[test]
    fn test_set_active_character_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let result = registry.set_active_character("non-existent");

        // ========== Assert ==========
        assert!(result.is_err(), "设置不存在的角色为激活应该失败");
    }
}

// ========== 动作和表情管理测试 ==========

mod motions_and_expressions {
    use super::*;

    #[test]
    fn test_register_character_with_motions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("motion-test");
        character.motions = vec![
            "idle".to_string(),
            "walk".to_string(),
            "run".to_string(),
            "jump".to_string(),
        ];

        // ========== Act ==========
        registry.register_character(character).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character("motion-test")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.motions.len(), 4, "应该有4个动作");
        assert!(retrieved.motions.contains(&"idle".to_string()));
        assert!(retrieved.motions.contains(&"walk".to_string()));
        assert!(retrieved.motions.contains(&"run".to_string()));
        assert!(retrieved.motions.contains(&"jump".to_string()));
    }

    #[test]
    fn test_register_character_with_expressions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("expression-test");
        character.expressions = vec![
            "happy".to_string(),
            "sad".to_string(),
            "angry".to_string(),
            "surprised".to_string(),
        ];

        // ========== Act ==========
        registry.register_character(character).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character("expression-test")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.expressions.len(), 4, "应该有4个表情");
        assert!(retrieved.expressions.contains(&"happy".to_string()));
        assert!(retrieved.expressions.contains(&"sad".to_string()));
        assert!(retrieved.expressions.contains(&"angry".to_string()));
        assert!(retrieved.expressions.contains(&"surprised".to_string()));
    }

    #[test]
    fn test_update_motions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("update-motions");
        registry.register_character(character).unwrap();

        // ========== Act ==========
        let mut updated_character = registry.get_character("update-motions")
            .unwrap()
            .unwrap();
        
        updated_character.motions = vec![
            "new_motion1".to_string(),
            "new_motion2".to_string(),
        ];
        
        registry.register_character(updated_character).unwrap();

        // ========== Assert ==========
        let final_character = registry.get_character("update-motions")
            .unwrap()
            .unwrap();
        
        assert_eq!(final_character.motions.len(), 2);
        assert!(final_character.motions.contains(&"new_motion1".to_string()));
        assert!(final_character.motions.contains(&"new_motion2".to_string()));
    }

    #[test]
    fn test_empty_motions_and_expressions() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("empty-test");
        character.motions = vec![];
        character.expressions = vec![];

        // ========== Act ==========
        registry.register_character(character).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character("empty-test")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.motions.len(), 0, "动作列表应该为空");
        assert_eq!(retrieved.expressions.len(), 0, "表情列表应该为空");
    }
}

// ========== 角色配置管理测试 ==========

mod character_config {
    use super::*;

    #[test]
    fn test_save_and_get_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("config-test");
        registry.register_character(character).unwrap();

        let config = CharacterConfig {
            character_id: "config-test".to_string(),
            scale: 1.5,
            position_x: 100.0,
            position_y: 200.0,
            interaction_enabled: true,
            config_json: Some("{\"custom\": \"value\"}".to_string()),
        };

        // ========== Act ==========
        registry.save_character_config(config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character_config("config-test")
            .expect("查询应该成功")
            .expect("应该有配置");
        
        assert_eq!(retrieved.character_id, config.character_id);
        assert_eq!(retrieved.scale, config.scale);
        assert_eq!(retrieved.position_x, config.position_x);
        assert_eq!(retrieved.position_y, config.position_y);
        assert_eq!(retrieved.interaction_enabled, config.interaction_enabled);
        assert_eq!(retrieved.config_json, config.config_json);
    }

    #[test]
    fn test_get_config_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        let config = registry.get_character_config("non-existent")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(config.is_none(), "不存在的配置应该返回None");
    }

    #[test]
    fn test_update_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("update-config");
        registry.register_character(character).unwrap();

        let config = CharacterConfig {
            character_id: "update-config".to_string(),
            scale: 1.0,
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: None,
        };
        registry.save_character_config(config).unwrap();

        // ========== Act ==========
        let updated_config = CharacterConfig {
            character_id: "update-config".to_string(),
            scale: 2.0,
            position_x: 50.0,
            position_y: 75.0,
            interaction_enabled: false,
            config_json: Some("{\"updated\": true}".to_string()),
        };
        registry.save_character_config(updated_config.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character_config("update-config")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.scale, 2.0);
        assert_eq!(retrieved.position_x, 50.0);
        assert_eq!(retrieved.position_y, 75.0);
        assert!(!retrieved.interaction_enabled);
    }

    #[test]
    fn test_config_with_default_values() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("default-config");
        registry.register_character(character).unwrap();

        let config = CharacterConfig {
            character_id: "default-config".to_string(),
            scale: 1.0,
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: None,
        };

        // ========== Act ==========
        registry.save_character_config(config).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character_config("default-config")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.scale, 1.0);
        assert_eq!(retrieved.position_x, 0.0);
        assert_eq!(retrieved.position_y, 0.0);
        assert!(retrieved.interaction_enabled);
        assert_eq!(retrieved.config_json, None);
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_full_character_lifecycle() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("lifecycle");

        // ========== Act & Assert ==========
        
        // 1. 注册角色
        registry.register_character(character.clone()).unwrap();

        // 2. 设置配置
        let config = CharacterConfig {
            character_id: "lifecycle".to_string(),
            scale: 1.2,
            position_x: 100.0,
            position_y: 150.0,
            interaction_enabled: true,
            config_json: None,
        };
        registry.save_character_config(config).unwrap();

        // 3. 激活角色
        registry.set_active_character("lifecycle").unwrap();

        // 4. 更新角色
        character.display_name = "生命周期测试角色 (已更新)".to_string();
        registry.update_character(character).unwrap();

        // 5. 验证最终状态
        let final_character = registry.get_character("lifecycle")
            .unwrap()
            .unwrap();
        assert!(final_character.is_active);
        assert_eq!(final_character.display_name, "生命周期测试角色 (已更新)");

        let final_config = registry.get_character_config("lifecycle")
            .unwrap()
            .unwrap();
        assert_eq!(final_config.scale, 1.2);

        // 6. 删除角色
        registry.delete_character("lifecycle").unwrap();
        
        let deleted = registry.get_character("lifecycle").unwrap();
        assert!(deleted.is_none());
    }

    #[test]
    fn test_multiple_characters_management() {
        // ========== Arrange ==========
        let registry = setup_test_registry();

        // ========== Act ==========
        for i in 1..=10 {
            let mut character = create_test_character(&format!("char-{}", i));
            character.gender = if i % 2 == 0 { "male" } else { "female" }.to_string();
            registry.register_character(character).unwrap();
        }

        // 设置第5个为激活角色
        registry.set_active_character("char-5").unwrap();

        // ========== Assert ==========
        let all_characters = registry.get_all_characters().unwrap();
        assert_eq!(all_characters.len(), 10);

        let active = registry.get_active_character().unwrap().unwrap();
        assert_eq!(active.id, "char-5");

        // 验证性别分布
        let female_count = all_characters.iter()
            .filter(|c| c.gender == "female")
            .count();
        let male_count = all_characters.iter()
            .filter(|c| c.gender == "male")
            .count();
        
        assert_eq!(female_count, 5);
        assert_eq!(male_count, 5);
    }

    #[test]
    fn test_cascading_delete() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("cascade-test");
        registry.register_character(character).unwrap();

        let config = CharacterConfig {
            character_id: "cascade-test".to_string(),
            scale: 1.0,
            position_x: 0.0,
            position_y: 0.0,
            interaction_enabled: true,
            config_json: None,
        };
        registry.save_character_config(config).unwrap();

        // ========== Act ==========
        registry.delete_character("cascade-test").unwrap();

        // ========== Assert ==========
        let character = registry.get_character("cascade-test").unwrap();
        assert!(character.is_none(), "角色应该被删除");

        let config = registry.get_character_config("cascade-test").unwrap();
        assert!(config.is_none(), "配置应该被级联删除");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_character_with_empty_strings() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("empty-strings");
        character.description = "".to_string();

        // ========== Act ==========
        let result = registry.register_character(character);

        // ========== Assert ==========
        assert!(result.is_ok(), "空字符串应该被接受");

        let retrieved = registry.get_character("empty-strings")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.description, "");
    }

    #[test]
    fn test_character_with_special_characters() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("special");
        character.name = "角色@#$%^&*()".to_string();
        character.display_name = "测试角色😀\n换行\t制表符".to_string();

        // ========== Act ==========
        registry.register_character(character.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character("special")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.name, character.name);
        assert_eq!(retrieved.display_name, character.display_name);
    }

    #[test]
    fn test_character_with_long_lists() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let mut character = create_test_character("long-lists");
        
        // 创建长列表
        character.motions = (0..100)
            .map(|i| format!("motion_{}", i))
            .collect();
        character.expressions = (0..100)
            .map(|i| format!("expression_{}", i))
            .collect();
        character.features = (0..100)
            .map(|i| format!("feature_{}", i))
            .collect();

        // ========== Act ==========
        registry.register_character(character).unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character("long-lists")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.motions.len(), 100);
        assert_eq!(retrieved.expressions.len(), 100);
        assert_eq!(retrieved.features.len(), 100);
    }

    #[test]
    fn test_config_with_extreme_values() {
        // ========== Arrange ==========
        let registry = setup_test_registry();
        let character = create_test_character("extreme-config");
        registry.register_character(character).unwrap();

        let config = CharacterConfig {
            character_id: "extreme-config".to_string(),
            scale: 999.999,
            position_x: -10000.0,
            position_y: 10000.0,
            interaction_enabled: false,
            config_json: Some("{}".repeat(1000)),
        };

        // ========== Act ==========
        let result = registry.save_character_config(config.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "极端值应该被接受");

        let retrieved = registry.get_character_config("extreme-config")
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.scale, config.scale);
        assert_eq!(retrieved.position_x, config.position_x);
        assert_eq!(retrieved.position_y, config.position_y);
    }
}


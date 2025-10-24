//! 角色注册表数据库测试 - PostgreSQL后端
//!
//! 测试角色注册表的所有功能，包括：
//! - 角色的CRUD操作
//! - 角色配置管理
//! - 激活角色管理
//! - 动作和表情管理
//!
//! ## 数据库后端
//! - **PostgreSQL**: 主要存储，支持所有功能

use crate::common;

use zishu_sensei::database::character_registry::{
    CharacterRegistry, CharacterData, CharacterConfig,
};
use common::test_db::setup_test_postgres;

// ========== 辅助函数 ==========

async fn setup_test_registry() -> CharacterRegistry {
    let pg = setup_test_postgres().await;
    let registry = CharacterRegistry::new(pg.backend.pool.clone());
    registry.init_tables().await.expect("无法初始化数据库表");
    registry
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

fn create_test_config(character_id: &str) -> CharacterConfig {
    CharacterConfig {
        character_id: character_id.to_string(),
        scale: 1.0,
        position_x: 0.0,
        position_y: 0.0,
        interaction_enabled: true,
        config_json: None,
    }
}

// ========== 角色 CRUD 测试 ==========

mod character_crud {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要PostgreSQL服务器
    async fn test_add_and_get_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("test-001");

        // ========== Act ==========
        let result = registry.add_character(character.clone()).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "添加角色应该成功");

        let retrieved = registry.get_character("test-001").await
            .expect("查询应该成功")
            .expect("应该找到角色");
        
        assert_eq!(retrieved.id, character.id);
        assert_eq!(retrieved.name, character.name);
        assert_eq!(retrieved.display_name, character.display_name);
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_character_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;

        // ========== Act ==========
        let result = registry.get_character("non-existent").await
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的角色应该返回None");
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_all_characters_empty() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;

        // ========== Act ==========
        let characters = registry.get_all_characters().await.expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(characters.len(), 0, "空数据库应该返回空列表");
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_all_characters_multiple() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        
        for i in 1..=5 {
            let character = create_test_character(&format!("character-{}", i));
            registry.add_character(character).await.expect("添加应该成功");
        }

        // ========== Act ==========
        let characters = registry.get_all_characters().await.expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(characters.len(), 5, "应该返回5个角色");
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("update-test");
        registry.add_character(character.clone()).await.expect("添加应该成功");

        // ========== Act ==========
        character.display_name = "更新后的角色".to_string();
        character.description = "更新后的描述".to_string();
        
        let result = registry.update_character(character.clone()).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "更新应该成功");

        let retrieved = registry.get_character("update-test").await
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.display_name, "更新后的角色");
        assert_eq!(retrieved.description, "更新后的描述");
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("delete-test");
        registry.add_character(character).await.expect("添加应该成功");

        // ========== Act ==========
        let result = registry.delete_character("delete-test").await;

        // ========== Assert ==========
        assert!(result.is_ok(), "删除应该成功");

        let retrieved = registry.get_character("delete-test").await.unwrap();
        assert!(retrieved.is_none(), "删除后应该找不到角色");
    }

    #[tokio::test]
    #[ignore]
    async fn test_character_exists() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("exists-test");
        registry.add_character(character).await.expect("添加应该成功");

        // ========== Act & Assert ==========
        let exists = registry.character_exists("exists-test").await
            .expect("查询应该成功");
        assert!(exists, "已添加的角色应该存在");

        let not_exists = registry.character_exists("non-existent").await
            .expect("查询应该成功");
        assert!(!not_exists, "未添加的角色不应该存在");
    }

    #[tokio::test]
    #[ignore]
    async fn test_duplicate_character_id() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character1 = create_test_character("duplicate");
        let character2 = create_test_character("duplicate");

        // ========== Act ==========
        let result1 = registry.add_character(character1).await;
        let result2 = registry.add_character(character2).await;

        // ========== Assert ==========
        assert!(result1.is_ok(), "首次添加应该成功");
        assert!(result2.is_err(), "重复ID应该失败");
    }
}

// ========== 激活角色管理测试 ==========

mod active_character {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_set_active_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("active-test");
        registry.add_character(character).await.expect("添加应该成功");

        // ========== Act ==========
        let result = registry.set_active_character("active-test").await;

        // ========== Assert ==========
        assert!(result.is_ok(), "设置激活角色应该成功");

        let active = registry.get_active_character().await
            .expect("查询应该成功")
            .expect("应该有激活角色");
        
        assert_eq!(active.id, "active-test");
        assert!(active.is_active);
    }

    #[tokio::test]
    #[ignore]
    async fn test_change_active_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        
        let char1 = create_test_character("char1");
        let char2 = create_test_character("char2");
        
        registry.add_character(char1).await.unwrap();
        registry.add_character(char2).await.unwrap();
        
        registry.set_active_character("char1").await.unwrap();

        // ========== Act ==========
        registry.set_active_character("char2").await.unwrap();

        // ========== Assert ==========
        let active = registry.get_active_character().await.unwrap().unwrap();
        assert_eq!(active.id, "char2", "应该切换到新的激活角色");
        
        let char1_retrieved = registry.get_character("char1").await.unwrap().unwrap();
        assert!(!char1_retrieved.is_active, "旧的激活角色应该被停用");
    }

    #[tokio::test]
    #[ignore]
    async fn test_deactivate_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("deactivate-test");
        registry.add_character(character).await.unwrap();
        registry.set_active_character("deactivate-test").await.unwrap();

        // ========== Act ==========
        let result = registry.deactivate_character("deactivate-test").await;

        // ========== Assert ==========
        assert!(result.is_ok(), "停用角色应该成功");
        
        let active = registry.get_active_character().await.unwrap();
        assert!(active.is_none(), "不应该有激活角色");
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_active_character_when_none() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;

        // ========== Act ==========
        let active = registry.get_active_character().await.unwrap();

        // ========== Assert ==========
        assert!(active.is_none(), "没有激活角色时应该返回None");
    }
}

// ========== 角色配置管理测试 ==========

mod character_config {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_set_and_get_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("config-test");
        registry.add_character(character).await.unwrap();
        
        let config = create_test_config("config-test");

        // ========== Act ==========
        let result = registry.set_character_config(config.clone()).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "设置配置应该成功");

        let retrieved = registry.get_character_config("config-test").await
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.character_id, config.character_id);
        assert_eq!(retrieved.scale, config.scale);
        assert_eq!(retrieved.position_x, config.position_x);
        assert_eq!(retrieved.position_y, config.position_y);
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_config() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("update-config");
        registry.add_character(character).await.unwrap();
        
        let mut config = create_test_config("update-config");
        registry.set_character_config(config.clone()).await.unwrap();

        // ========== Act ==========
        config.scale = 1.5;
        config.position_x = 100.0;
        config.position_y = 200.0;
        config.interaction_enabled = false;
        
        registry.set_character_config(config.clone()).await.unwrap();

        // ========== Assert ==========
        let retrieved = registry.get_character_config("update-config").await
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.scale, 1.5);
        assert_eq!(retrieved.position_x, 100.0);
        assert_eq!(retrieved.position_y, 200.0);
        assert!(!retrieved.interaction_enabled);
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_config_not_found() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;

        // ========== Act ==========
        let config = registry.get_character_config("non-existent").await.unwrap();

        // ========== Assert ==========
        assert!(config.is_none(), "不存在的角色配置应该返回None");
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_config_with_character() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("delete-with-config");
        registry.add_character(character).await.unwrap();
        
        let config = create_test_config("delete-with-config");
        registry.set_character_config(config).await.unwrap();

        // ========== Act ==========
        registry.delete_character("delete-with-config").await.unwrap();

        // ========== Assert ==========
        let config = registry.get_character_config("delete-with-config").await.unwrap();
        assert!(config.is_none(), "删除角色时配置也应该被删除（级联删除）");
    }
}

// ========== 动作和表情管理测试 ==========

mod motions_and_expressions {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_add_and_get_motions() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("motion-test");
        character.motions = vec!["idle".to_string(), "walk".to_string(), "run".to_string()];
        registry.add_character(character).await.unwrap();

        // ========== Act ==========
        let motions = registry.get_character_motions("motion-test").await.unwrap();

        // ========== Assert ==========
        assert_eq!(motions.len(), 3, "应该有3个动作");
        assert!(motions.contains(&"idle".to_string()));
        assert!(motions.contains(&"walk".to_string()));
        assert!(motions.contains(&"run".to_string()));
    }

    #[tokio::test]
    #[ignore]
    async fn test_add_and_get_expressions() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("expr-test");
        character.expressions = vec!["happy".to_string(), "sad".to_string(), "angry".to_string()];
        registry.add_character(character).await.unwrap();

        // ========== Act ==========
        let expressions = registry.get_character_expressions("expr-test").await.unwrap();

        // ========== Assert ==========
        assert_eq!(expressions.len(), 3, "应该有3个表情");
        assert!(expressions.contains(&"happy".to_string()));
        assert!(expressions.contains(&"sad".to_string()));
        assert!(expressions.contains(&"angry".to_string()));
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_motions() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("update-motion");
        character.motions = vec!["idle".to_string()];
        registry.add_character(character.clone()).await.unwrap();

        // ========== Act ==========
        character.motions = vec!["idle".to_string(), "walk".to_string(), "jump".to_string()];
        registry.update_character(character).await.unwrap();

        // ========== Assert ==========
        let motions = registry.get_character_motions("update-motion").await.unwrap();
        assert_eq!(motions.len(), 3, "应该有3个动作");
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_character_removes_motions() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("delete-motion");
        character.motions = vec!["idle".to_string(), "walk".to_string()];
        registry.add_character(character).await.unwrap();

        // ========== Act ==========
        registry.delete_character("delete-motion").await.unwrap();

        // ========== Assert ==========
        let motions = registry.get_character_motions("delete-motion").await.unwrap();
        assert_eq!(motions.len(), 0, "删除角色时动作也应该被删除");
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_character_removes_expressions() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("delete-expr");
        character.expressions = vec!["happy".to_string(), "sad".to_string()];
        registry.add_character(character).await.unwrap();

        // ========== Act ==========
        registry.delete_character("delete-expr").await.unwrap();

        // ========== Assert ==========
        let expressions = registry.get_character_expressions("delete-expr").await.unwrap();
        assert_eq!(expressions.len(), 0, "删除角色时表情也应该被删除");
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_full_character_lifecycle() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("lifecycle");

        // ========== Act & Assert ==========
        
        // 1. 添加角色
        registry.add_character(character.clone()).await.expect("添加应该成功");
        assert!(registry.character_exists("lifecycle").await.unwrap());

        // 2. 设置配置
        let config = create_test_config("lifecycle");
        registry.set_character_config(config).await.expect("设置配置应该成功");

        // 3. 激活角色
        registry.set_active_character("lifecycle").await.expect("激活应该成功");
        let active = registry.get_active_character().await.unwrap().unwrap();
        assert_eq!(active.id, "lifecycle");

        // 4. 更新配置
        let mut updated_config = registry.get_character_config("lifecycle").await.unwrap().unwrap();
        updated_config.scale = 2.0;
        registry.set_character_config(updated_config).await.unwrap();

        // 5. 停用角色
        registry.deactivate_character("lifecycle").await.unwrap();
        assert!(registry.get_active_character().await.unwrap().is_none());

        // 6. 删除角色
        registry.delete_character("lifecycle").await.unwrap();
        assert!(!registry.character_exists("lifecycle").await.unwrap());
    }

    #[tokio::test]
    #[ignore]
    async fn test_multiple_characters_management() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;

        // ========== Act ==========
        // 添加多个角色
        for i in 1..=5 {
            let character = create_test_character(&format!("char-{}", i));
            registry.add_character(character).await.unwrap();
            
            let config = create_test_config(&format!("char-{}", i));
            registry.set_character_config(config).await.unwrap();
        }

        // 激活其中一个
        registry.set_active_character("char-3").await.unwrap();

        // ========== Assert ==========
        let all_characters = registry.get_all_characters().await.unwrap();
        assert_eq!(all_characters.len(), 5);
        
        let active = registry.get_active_character().await.unwrap().unwrap();
        assert_eq!(active.id, "char-3");
        
        // 验证只有一个激活
        let active_count = all_characters.iter()
            .filter(|c| c.is_active)
            .count();
        assert_eq!(active_count, 1, "应该只有一个激活角色");
    }
}

// ========== 边界情况测试 ==========

mod edge_cases {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_character_with_empty_features() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("empty-features");
        character.features = vec![];
        character.motions = vec![];
        character.expressions = vec![];

        // ========== Act ==========
        let result = registry.add_character(character).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "添加空特征的角色应该成功");
    }

    #[tokio::test]
    #[ignore]
    async fn test_character_with_special_characters() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let mut character = create_test_character("special-chars");
        character.display_name = "测试!@#$%^&*()角色".to_string();
        character.description = "包含\n换行\t制表符的描述".to_string();

        // ========== Act ==========
        let result = registry.add_character(character.clone()).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "添加特殊字符角色应该成功");

        let retrieved = registry.get_character("special-chars").await
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.display_name, character.display_name);
    }

    #[tokio::test]
    #[ignore]
    async fn test_config_with_extreme_values() {
        // ========== Arrange ==========
        let registry = setup_test_registry().await;
        let character = create_test_character("extreme-config");
        registry.add_character(character).await.unwrap();
        
        let mut config = create_test_config("extreme-config");
        config.scale = 0.1; // 很小
        config.position_x = -9999.99;
        config.position_y = 9999.99;

        // ========== Act ==========
        let result = registry.set_character_config(config.clone()).await;

        // ========== Assert ==========
        assert!(result.is_ok(), "设置极端值配置应该成功");

        let retrieved = registry.get_character_config("extreme-config").await
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.scale, 0.1);
        assert_eq!(retrieved.position_x, -9999.99);
        assert_eq!(retrieved.position_y, 9999.99);
    }
}

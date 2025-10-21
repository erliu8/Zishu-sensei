//! 模型配置数据库测试
//!
//! 测试模型配置持久化的所有功能，包括：
//! - 配置的CRUD操作
//! - 配置验证
//! - 默认配置管理
//! - 配置历史记录
//! - 配置导入导出
//! - 配置搜索和过滤

use zishu_sensei::database::model_config::{
    ModelConfigRegistry, ModelConfigData, ValidationResult,
};
use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Arc;
use parking_lot::RwLock;
use tempfile::TempDir;
use chrono::Utc;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_db() -> (TempDir, Arc<RwLock<Connection>>) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test_model_config.db");
    let conn = Connection::open(&db_path).expect("无法创建数据库");
    
    // 创建表结构
    conn.execute(
        "CREATE TABLE model_configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            model_id TEXT NOT NULL,
            adapter_id TEXT,
            temperature REAL NOT NULL,
            top_p REAL NOT NULL,
            top_k INTEGER,
            max_tokens INTEGER NOT NULL,
            frequency_penalty REAL NOT NULL,
            presence_penalty REAL NOT NULL,
            stop_sequences TEXT NOT NULL,
            is_default INTEGER NOT NULL,
            is_enabled INTEGER NOT NULL,
            description TEXT,
            extra_config TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).expect("无法创建model_configs表");

    conn.execute(
        "CREATE TABLE model_config_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_data TEXT,
            new_data TEXT,
            reason TEXT,
            created_at INTEGER NOT NULL
        )",
        [],
    ).expect("无法创建history表");
    
    (temp_dir, Arc::new(RwLock::new(conn)))
}

/// 创建测试配置
fn create_test_config(id: &str, name: &str) -> ModelConfigData {
    let now = Utc::now().timestamp();
    ModelConfigData {
        id: id.to_string(),
        name: name.to_string(),
        model_id: "gpt-3.5-turbo".to_string(),
        adapter_id: Some("openai".to_string()),
        temperature: 0.7,
        top_p: 0.9,
        top_k: None,
        max_tokens: 2048,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stop_sequences: vec![],
        is_default: false,
        is_enabled: true,
        description: Some("测试配置".to_string()),
        extra_config: None,
        created_at: now,
        updated_at: now,
    }
}

// ========== 数据库初始化测试 ==========

mod database_initialization {
    use super::*;

    #[test]
    fn test_registry_creation() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        
        // ========== Act ==========
        let registry = ModelConfigRegistry::new(conn);
        
        // ========== Assert ==========
        // 如果没有 panic，说明创建成功
    }
}

// ========== 配置保存测试 ==========

mod save_config {
    use super::*;

    #[test]
    fn test_save_new_config_success() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test-config-1", "测试配置1");
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_ok(), "保存新配置应该成功");
    }

    #[test]
    fn test_save_update_existing_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("test-config-1", "测试配置1");
        
        registry.save_config(config.clone()).unwrap();
        
        // ========== Act ==========
        config.name = "更新后的配置".to_string();
        config.temperature = 0.8;
        let result = registry.save_config(config.clone());
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = registry.get_config("test-config-1").unwrap().unwrap();
        assert_eq!(retrieved.name, "更新后的配置");
        assert_eq!(retrieved.temperature, 0.8);
    }

    #[test]
    fn test_save_config_with_all_fields() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("full-config", "完整配置");
        config.top_k = Some(50);
        config.stop_sequences = vec!["STOP".to_string(), "END".to_string()];
        config.extra_config = Some("{\"custom_field\": \"value\"}".to_string());
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = registry.get_config("full-config").unwrap().unwrap();
        assert_eq!(retrieved.top_k, Some(50));
        assert_eq!(retrieved.stop_sequences.len(), 2);
    }

    #[test]
    fn test_save_default_config_clears_others() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config1 = create_test_config("config-1", "配置1");
        config1.is_default = true;
        registry.save_config(config1).unwrap();
        
        let mut config2 = create_test_config("config-2", "配置2");
        config2.is_default = true;
        
        // ========== Act ==========
        registry.save_config(config2).unwrap();
        
        // ========== Assert ==========
        let config1_retrieved = registry.get_config("config-1").unwrap().unwrap();
        assert!(!config1_retrieved.is_default, "旧的默认配置应该被取消");
        
        let config2_retrieved = registry.get_config("config-2").unwrap().unwrap();
        assert!(config2_retrieved.is_default, "新配置应该成为默认");
    }

    #[test]
    fn test_save_invalid_config_fails() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("invalid", "无效配置");
        config.temperature = 5.0; // 无效的温度值
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_err(), "保存无效配置应该失败");
    }
}

// ========== 配置查询测试 ==========

mod get_config {
    use super::*;

    #[test]
    fn test_get_existing_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test-1", "测试1");
        registry.save_config(config).unwrap();
        
        // ========== Act ==========
        let result = registry.get_config("test-1");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let retrieved = result.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "测试1");
    }

    #[test]
    fn test_get_nonexistent_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        // ========== Act ==========
        let result = registry.get_config("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}

// ========== 配置删除测试 ==========

mod delete_config {
    use super::*;

    #[test]
    fn test_delete_existing_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test-1", "测试1");
        registry.save_config(config).unwrap();
        
        // ========== Act ==========
        let result = registry.delete_config("test-1");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = registry.get_config("test-1").unwrap();
        assert!(retrieved.is_none(), "配置应该已被删除");
    }

    #[test]
    fn test_delete_nonexistent_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        // ========== Act ==========
        let result = registry.delete_config("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_err(), "删除不存在的配置应该返回错误");
    }
}

// ========== 配置列表查询测试 ==========

mod list_configs {
    use super::*;

    #[test]
    fn test_get_all_configs() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        for i in 0..5 {
            let config = create_test_config(&format!("config-{}", i), &format!("配置{}", i));
            registry.save_config(config).unwrap();
        }
        
        // ========== Act ==========
        let result = registry.get_all_configs();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let configs = result.unwrap();
        assert_eq!(configs.len(), 5);
    }

    #[test]
    fn test_get_enabled_configs() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config1 = create_test_config("enabled", "启用");
        config1.is_enabled = true;
        registry.save_config(config1).unwrap();
        
        let mut config2 = create_test_config("disabled", "禁用");
        config2.is_enabled = false;
        registry.save_config(config2).unwrap();
        
        // ========== Act ==========
        let result = registry.get_enabled_configs();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let configs = result.unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].id, "enabled");
    }

    #[test]
    fn test_get_default_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config1 = create_test_config("normal", "普通");
        config1.is_default = false;
        registry.save_config(config1).unwrap();
        
        let mut config2 = create_test_config("default", "默认");
        config2.is_default = true;
        registry.save_config(config2).unwrap();
        
        // ========== Act ==========
        let result = registry.get_default_config();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let default_config = result.unwrap();
        assert!(default_config.is_some());
        assert_eq!(default_config.unwrap().id, "default");
    }

    #[test]
    fn test_set_default_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let config = create_test_config("test", "测试");
        registry.save_config(config).unwrap();
        
        // ========== Act ==========
        let result = registry.set_default_config("test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let default_config = registry.get_default_config().unwrap().unwrap();
        assert_eq!(default_config.id, "test");
    }

    #[test]
    fn test_get_configs_by_model() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config1 = create_test_config("gpt35-1", "GPT3.5配置1");
        config1.model_id = "gpt-3.5-turbo".to_string();
        registry.save_config(config1).unwrap();
        
        let mut config2 = create_test_config("gpt35-2", "GPT3.5配置2");
        config2.model_id = "gpt-3.5-turbo".to_string();
        registry.save_config(config2).unwrap();
        
        let mut config3 = create_test_config("gpt4", "GPT4配置");
        config3.model_id = "gpt-4".to_string();
        registry.save_config(config3).unwrap();
        
        // ========== Act ==========
        let result = registry.get_configs_by_model("gpt-3.5-turbo");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let configs = result.unwrap();
        assert_eq!(configs.len(), 2);
    }

    #[test]
    fn test_get_configs_by_adapter() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config1 = create_test_config("openai-1", "OpenAI配置1");
        config1.adapter_id = Some("openai".to_string());
        registry.save_config(config1).unwrap();
        
        let mut config2 = create_test_config("claude", "Claude配置");
        config2.adapter_id = Some("claude".to_string());
        registry.save_config(config2).unwrap();
        
        // ========== Act ==========
        let result = registry.get_configs_by_adapter("openai");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let configs = result.unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].id, "openai-1");
    }
}

// ========== 配置验证测试 ==========

mod validate_config {
    use super::*;

    #[test]
    fn test_validate_valid_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("valid", "有效配置");
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(result.is_valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_empty_id() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("", "配置");
        config.id = "".to_string();
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(!result.is_valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_empty_name() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("test", "");
        config.name = "".to_string();
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(!result.is_valid);
    }

    #[test]
    fn test_validate_invalid_temperature() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let test_cases = vec![-0.1, 2.5, 3.0];
        
        // ========== Act & Assert ==========
        for temp in test_cases {
            let mut config = create_test_config("test", "测试");
            config.temperature = temp;
            let result = registry.validate_config(&config);
            assert!(!result.is_valid, "温度 {} 应该无效", temp);
        }
    }

    #[test]
    fn test_validate_invalid_top_p() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let test_cases = vec![-0.1, 1.1, 2.0];
        
        // ========== Act & Assert ==========
        for top_p in test_cases {
            let mut config = create_test_config("test", "测试");
            config.top_p = top_p;
            let result = registry.validate_config(&config);
            assert!(!result.is_valid, "top_p {} 应该无效", top_p);
        }
    }

    #[test]
    fn test_validate_invalid_top_k() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let test_cases = vec![0, -1, 1001];
        
        // ========== Act & Assert ==========
        for top_k in test_cases {
            let mut config = create_test_config("test", "测试");
            config.top_k = Some(top_k);
            let result = registry.validate_config(&config);
            assert!(!result.is_valid, "top_k {} 应该无效", top_k);
        }
    }

    #[test]
    fn test_validate_zero_max_tokens() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("test", "测试");
        config.max_tokens = 0;
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(!result.is_valid);
    }

    #[test]
    fn test_validate_invalid_penalties() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("test", "测试");
        config.frequency_penalty = 3.0;
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(!result.is_valid);
    }

    #[test]
    fn test_validate_warnings_for_high_values() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("test", "测试");
        config.temperature = 1.6; // 高温度
        config.max_tokens = 50000; // 高token数
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(result.is_valid, "配置应该有效但有警告");
        assert!(!result.warnings.is_empty(), "应该有警告");
    }

    #[test]
    fn test_validate_invalid_extra_config_json() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("test", "测试");
        config.extra_config = Some("invalid json".to_string());
        
        // ========== Act ==========
        let result = registry.validate_config(&config);
        
        // ========== Assert ==========
        assert!(!result.is_valid);
    }
}

// ========== 配置历史测试 ==========

mod config_history {
    use super::*;

    #[test]
    fn test_save_creates_history() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test", "测试");
        
        // ========== Act ==========
        registry.save_config(config).unwrap();
        
        // ========== Assert ==========
        let history = registry.get_config_history("test", None).unwrap();
        assert!(!history.is_empty(), "应该有历史记录");
        assert_eq!(history[0].action, "created");
    }

    #[test]
    fn test_update_creates_history() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("test", "测试");
        
        registry.save_config(config.clone()).unwrap();
        
        // ========== Act ==========
        config.temperature = 0.9;
        registry.save_config(config).unwrap();
        
        // ========== Assert ==========
        let history = registry.get_config_history("test", None).unwrap();
        assert!(history.len() >= 2, "应该有创建和更新记录");
        assert_eq!(history[0].action, "updated");
    }

    #[test]
    fn test_delete_creates_history() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test", "测试");
        
        registry.save_config(config).unwrap();
        
        // ========== Act ==========
        registry.delete_config("test").unwrap();
        
        // ========== Assert ==========
        let history = registry.get_config_history("test", None).unwrap();
        let deleted_record = history.iter().find(|h| h.action == "deleted");
        assert!(deleted_record.is_some(), "应该有删除记录");
    }

    #[test]
    fn test_get_config_history_with_limit() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let mut config = create_test_config("test", "测试");
        
        // 创建多次更新
        registry.save_config(config.clone()).unwrap();
        for i in 0..5 {
            config.temperature = 0.5 + (i as f32) * 0.1;
            registry.save_config(config.clone()).unwrap();
        }
        
        // ========== Act ==========
        let history = registry.get_config_history("test", Some(3)).unwrap();
        
        // ========== Assert ==========
        assert_eq!(history.len(), 3, "应该只返回3条记录");
    }

    #[test]
    fn test_get_all_history() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        for i in 0..3 {
            let config = create_test_config(&format!("config-{}", i), &format!("配置{}", i));
            registry.save_config(config).unwrap();
        }
        
        // ========== Act ==========
        let history = registry.get_all_history(None).unwrap();
        
        // ========== Assert ==========
        assert!(history.len() >= 3, "应该有至少3条历史记录");
    }

    #[test]
    fn test_cleanup_history() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        // 创建多个配置和历史
        for i in 0..10 {
            let config = create_test_config(&format!("config-{}", i), &format!("配置{}", i));
            registry.save_config(config).unwrap();
        }
        
        // ========== Act ==========
        let result = registry.cleanup_history(5);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let deleted = result.unwrap();
        assert!(deleted >= 5, "应该删除至少5条记录");
    }
}

// ========== 配置导入导出测试 ==========

mod import_export {
    use super::*;

    #[test]
    fn test_export_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        let config = create_test_config("test", "测试");
        registry.save_config(config).unwrap();
        
        // ========== Act ==========
        let result = registry.export_config("test");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let json = result.unwrap();
        assert!(json.contains("test"));
        assert!(json.contains("测试"));
    }

    #[test]
    fn test_export_all_configs() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        for i in 0..3 {
            let config = create_test_config(&format!("config-{}", i), &format!("配置{}", i));
            registry.save_config(config).unwrap();
        }
        
        // ========== Act ==========
        let result = registry.export_all_configs();
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let json = result.unwrap();
        assert!(json.contains("config-0"));
        assert!(json.contains("config-1"));
        assert!(json.contains("config-2"));
    }

    #[test]
    fn test_import_config() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let config = create_test_config("import-test", "导入测试");
        let json = serde_json::to_string(&config).unwrap();
        
        // ========== Act ==========
        let result = registry.import_config(&json);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = registry.get_config("import-test").unwrap();
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_import_invalid_json() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        // ========== Act ==========
        let result = registry.import_config("invalid json");
        
        // ========== Assert ==========
        assert!(result.is_err());
    }

    #[test]
    fn test_import_configs_batch() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let configs = vec![
            create_test_config("batch-1", "批量1"),
            create_test_config("batch-2", "批量2"),
            create_test_config("batch-3", "批量3"),
        ];
        let json = serde_json::to_string(&configs).unwrap();
        
        // ========== Act ==========
        let result = registry.import_configs(&json);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        let imported_ids = result.unwrap();
        assert_eq!(imported_ids.len(), 3);
    }

    #[test]
    fn test_export_import_roundtrip() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let original = create_test_config("roundtrip", "往返测试");
        registry.save_config(original.clone()).unwrap();
        
        // ========== Act ==========
        let exported = registry.export_config("roundtrip").unwrap();
        registry.delete_config("roundtrip").unwrap();
        let imported = registry.import_config(&exported).unwrap();
        
        // ========== Assert ==========
        assert_eq!(imported.id, original.id);
        assert_eq!(imported.name, original.name);
        assert_eq!(imported.temperature, original.temperature);
    }
}

// ========== 预设配置测试 ==========

mod preset_configs {
    use super::*;

    #[test]
    fn test_default_config_creation() {
        // ========== Act ==========
        let config = ModelConfigData::default_config();
        
        // ========== Assert ==========
        assert_eq!(config.id, "default");
        assert!(config.is_default);
        assert!(config.is_enabled);
        assert!(config.temperature >= 0.0 && config.temperature <= 2.0);
    }

    #[test]
    fn test_creative_config_creation() {
        // ========== Act ==========
        let config = ModelConfigData::creative_config();
        
        // ========== Assert ==========
        assert_eq!(config.id, "creative");
        assert!(config.temperature > 1.0);
        assert!(!config.is_default);
    }

    #[test]
    fn test_precise_config_creation() {
        // ========== Act ==========
        let config = ModelConfigData::precise_config();
        
        // ========== Assert ==========
        assert_eq!(config.id, "precise");
        assert!(config.temperature < 0.5);
        assert!(!config.is_default);
    }
}

// ========== 边界情况和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_save_config_with_very_long_name() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("test", &"x".repeat(300));
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_err(), "超长名称应该验证失败");
    }

    #[test]
    fn test_save_config_with_unicode_characters() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let config = create_test_config("unicode", "测试配置 🚀 こんにちは");
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
        
        let retrieved = registry.get_config("unicode").unwrap().unwrap();
        assert!(retrieved.name.contains("🚀"));
    }

    #[test]
    fn test_save_config_with_empty_stop_sequences() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let mut config = create_test_config("test", "测试");
        config.stop_sequences = vec![];
        
        // ========== Act ==========
        let result = registry.save_config(config);
        
        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_config_from_empty_database() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        // ========== Act ==========
        let result = registry.get_config("nonexistent");
        
        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_concurrent_updates() {
        // ========== Arrange ==========
        let (_temp, conn) = setup_test_db();
        let registry = ModelConfigRegistry::new(conn);
        
        let config = create_test_config("concurrent", "并发测试");
        registry.save_config(config.clone()).unwrap();
        
        // ========== Act ==========
        // 模拟并发更新
        for i in 0..10 {
            let mut updated = config.clone();
            updated.temperature = 0.5 + (i as f32) * 0.05;
            let result = registry.save_config(updated);
            assert!(result.is_ok(), "第{}次更新应该成功", i);
        }
        
        // ========== Assert ==========
        let final_config = registry.get_config("concurrent").unwrap().unwrap();
        assert!(final_config.temperature > 0.5);
    }
}


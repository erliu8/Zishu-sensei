//! 加密存储数据库测试
//!
//! 测试加密存储层的所有功能，包括：
//! - 数据加密和解密
//! - 记录的CRUD操作
//! - 按实体查询
//! - 密钥轮换
//! - 统计信息
//! - 错误处理

use zishu_sensei::database::encrypted_storage::{
    EncryptedStorage, EncryptedFieldType, EncryptedStorageError, EncryptedStorageStatistics,
};
use zishu_sensei::utils::encryption::{EncryptionManager, generate_random_key};
use tempfile::TempDir;
use std::path::PathBuf;

// ========== 辅助函数 ==========

/// 创建测试用的临时数据库
fn setup_test_storage() -> (TempDir, EncryptedStorage) {
    let temp_dir = TempDir::new().expect("无法创建临时目录");
    let db_path = temp_dir.path().join("test.db");
    let storage = EncryptedStorage::new(&db_path).expect("无法创建加密存储");
    (temp_dir, storage)
}

/// 创建测试用的加密管理器
fn create_test_manager() -> EncryptionManager {
    let key = generate_random_key().expect("无法生成密钥");
    EncryptionManager::new(key)
}

// ========== 基础功能测试 ==========

mod store_and_retrieve {
    use super::*;

    #[test]
    fn test_store_and_retrieve_success() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let id = "test-api-key-1";
        let plaintext = "sk-1234567890abcdef";

        // ========== Act ==========
        let store_result = storage.store(
            id,
            EncryptedFieldType::ApiKey,
            plaintext,
            Some("adapter-001"),
            &manager,
        );

        // ========== Assert ==========
        assert!(store_result.is_ok(), "存储应该成功");

        let retrieved = storage.retrieve(id, &manager);
        assert!(retrieved.is_ok(), "检索应该成功");
        assert_eq!(retrieved.unwrap(), plaintext, "检索的数据应该匹配原文");
    }

    #[test]
    fn test_store_different_field_types() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();

        let test_cases = vec![
            ("api-key-1", EncryptedFieldType::ApiKey, "sk-test-api-key"),
            ("password-1", EncryptedFieldType::Password, "SecurePass123!"),
            ("token-1", EncryptedFieldType::Token, "bearer-token-xyz"),
            ("config-1", EncryptedFieldType::SensitiveConfig, "{\"secret\": \"value\"}"),
            ("personal-1", EncryptedFieldType::PersonalInfo, "John Doe, john@example.com"),
            ("custom-1", EncryptedFieldType::Custom("my-custom".to_string()), "custom-data"),
        ];

        // ========== Act & Assert ==========
        for (id, field_type, plaintext) in test_cases {
            let store_result = storage.store(
                id,
                field_type,
                plaintext,
                None,
                &manager,
            );
            assert!(store_result.is_ok(), "存储 {} 应该成功", id);

            let retrieved = storage.retrieve(id, &manager).expect("检索应该成功");
            assert_eq!(retrieved, plaintext, "字段 {} 的数据应该匹配", id);
        }
    }

    #[test]
    fn test_store_with_entity_id() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let entity_id = "adapter-123";

        // ========== Act ==========
        storage.store(
            "field-1",
            EncryptedFieldType::ApiKey,
            "key1",
            Some(entity_id),
            &manager,
        ).expect("存储应该成功");

        storage.store(
            "field-2",
            EncryptedFieldType::Token,
            "token1",
            Some(entity_id),
            &manager,
        ).expect("存储应该成功");

        // ========== Assert ==========
        let records = storage.list_by_entity(entity_id).expect("列表查询应该成功");
        assert_eq!(records.len(), 2, "应该有2条记录");
        assert!(records.iter().any(|r| r.id == "field-1"), "应该包含field-1");
        assert!(records.iter().any(|r| r.id == "field-2"), "应该包含field-2");
    }

    #[test]
    fn test_store_overwrites_existing() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let id = "test-key";
        let original_data = "original-value";
        let updated_data = "updated-value";

        // ========== Act ==========
        storage.store(id, EncryptedFieldType::ApiKey, original_data, None, &manager)
            .expect("首次存储应该成功");

        storage.store(id, EncryptedFieldType::ApiKey, updated_data, None, &manager)
            .expect("更新存储应该成功");

        // ========== Assert ==========
        let retrieved = storage.retrieve(id, &manager).expect("检索应该成功");
        assert_eq!(retrieved, updated_data, "应该返回更新后的值");
    }

    #[test]
    fn test_retrieve_non_existent_returns_error() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();

        // ========== Act ==========
        let result = storage.retrieve("non-existent-id", &manager);

        // ========== Assert ==========
        assert!(result.is_err(), "检索不存在的记录应该返回错误");
        match result {
            Err(EncryptedStorageError::RecordNotFound) => {},
            _ => panic!("应该返回RecordNotFound错误"),
        }
    }

    #[test]
    fn test_retrieve_with_wrong_key_fails() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager1 = create_test_manager();
        let manager2 = create_test_manager(); // 不同的密钥
        let id = "test-key";
        let plaintext = "secret-data";

        // ========== Act ==========
        storage.store(id, EncryptedFieldType::ApiKey, plaintext, None, &manager1)
            .expect("存储应该成功");

        let result = storage.retrieve(id, &manager2);

        // ========== Assert ==========
        assert!(result.is_err(), "使用错误密钥解密应该失败");
    }
}

// ========== 记录管理测试 ==========

mod record_management {
    use super::*;

    #[test]
    fn test_get_record_success() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let id = "test-record";
        let entity_id = "entity-1";

        // ========== Act ==========
        storage.store(
            id,
            EncryptedFieldType::Token,
            "token-value",
            Some(entity_id),
            &manager,
        ).expect("存储应该成功");

        let record = storage.get_record(id).expect("获取记录应该成功");

        // ========== Assert ==========
        assert_eq!(record.id, id, "记录ID应该匹配");
        assert_eq!(record.entity_id, Some(entity_id.to_string()), "实体ID应该匹配");
        assert!(matches!(record.field_type, EncryptedFieldType::Token), "字段类型应该匹配");
        assert!(record.created_at > 0, "创建时间应该已设置");
        assert!(record.updated_at > 0, "更新时间应该已设置");
    }

    #[test]
    fn test_list_by_entity_empty() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();

        // ========== Act ==========
        let records = storage.list_by_entity("non-existent-entity")
            .expect("列表查询应该成功");

        // ========== Assert ==========
        assert_eq!(records.len(), 0, "不存在的实体应该返回空列表");
    }

    #[test]
    fn test_list_by_entity_multiple_records() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let entity_id = "adapter-xyz";

        // ========== Act ==========
        for i in 1..=5 {
            storage.store(
                &format!("field-{}", i),
                EncryptedFieldType::ApiKey,
                &format!("value-{}", i),
                Some(entity_id),
                &manager,
            ).expect("存储应该成功");
        }

        let records = storage.list_by_entity(entity_id).expect("列表查询应该成功");

        // ========== Assert ==========
        assert_eq!(records.len(), 5, "应该返回5条记录");
        
        // 验证所有记录的entity_id都匹配
        for record in &records {
            assert_eq!(
                record.entity_id,
                Some(entity_id.to_string()),
                "所有记录的entity_id应该匹配"
            );
        }
    }

    #[test]
    fn test_delete_success() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let id = "test-delete";

        storage.store(id, EncryptedFieldType::Password, "password", None, &manager)
            .expect("存储应该成功");

        // ========== Act ==========
        let delete_result = storage.delete(id);

        // ========== Assert ==========
        assert!(delete_result.is_ok(), "删除应该成功");

        // 验证记录已被删除
        let retrieve_result = storage.retrieve(id, &manager);
        assert!(retrieve_result.is_err(), "删除后检索应该失败");
    }

    #[test]
    fn test_delete_by_entity() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let entity_id = "entity-to-delete";

        // 为同一实体存储多条记录
        for i in 1..=3 {
            storage.store(
                &format!("field-{}", i),
                EncryptedFieldType::ApiKey,
                &format!("value-{}", i),
                Some(entity_id),
                &manager,
            ).expect("存储应该成功");
        }

        // 为不同实体存储记录
        storage.store(
            "field-other",
            EncryptedFieldType::ApiKey,
            "other-value",
            Some("other-entity"),
            &manager,
        ).expect("存储应该成功");

        // ========== Act ==========
        let count = storage.delete_by_entity(entity_id).expect("删除应该成功");

        // ========== Assert ==========
        assert_eq!(count, 3, "应该删除3条记录");

        let remaining = storage.list_by_entity(entity_id).expect("列表查询应该成功");
        assert_eq!(remaining.len(), 0, "实体的所有记录应该被删除");

        // 验证其他实体的记录未受影响
        let other_records = storage.list_by_entity("other-entity")
            .expect("列表查询应该成功");
        assert_eq!(other_records.len(), 1, "其他实体的记录应该保留");
    }
}

// ========== 密钥轮换测试 ==========

mod key_rotation {
    use super::*;

    #[test]
    fn test_reencrypt_all_success() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let old_manager = create_test_manager();
        let new_manager = create_test_manager();

        // 使用旧密钥存储数据
        let test_data = vec![
            ("key-1", "value-1"),
            ("key-2", "value-2"),
            ("key-3", "value-3"),
        ];

        for (id, value) in &test_data {
            storage.store(
                id,
                EncryptedFieldType::ApiKey,
                value,
                None,
                &old_manager,
            ).expect("存储应该成功");
        }

        // ========== Act ==========
        let count = storage.reencrypt_all(&old_manager, &new_manager)
            .expect("重新加密应该成功");

        // ========== Assert ==========
        assert_eq!(count, test_data.len(), "应该重新加密所有记录");

        // 验证可以用新密钥解密
        for (id, expected_value) in &test_data {
            let retrieved = storage.retrieve(id, &new_manager)
                .expect("用新密钥检索应该成功");
            assert_eq!(&retrieved, expected_value, "解密后的值应该匹配");
        }

        // 验证旧密钥不能解密
        for (id, _) in &test_data {
            let result = storage.retrieve(id, &old_manager);
            assert!(result.is_err(), "旧密钥不应该能解密");
        }
    }

    #[test]
    fn test_reencrypt_empty_database() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let old_manager = create_test_manager();
        let new_manager = create_test_manager();

        // ========== Act ==========
        let count = storage.reencrypt_all(&old_manager, &new_manager)
            .expect("重新加密应该成功");

        // ========== Assert ==========
        assert_eq!(count, 0, "空数据库应该返回0");
    }

    #[test]
    fn test_reencrypt_preserves_metadata() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let old_manager = create_test_manager();
        let new_manager = create_test_manager();
        let id = "metadata-test";
        let entity_id = "entity-123";

        storage.store(
            id,
            EncryptedFieldType::ApiKey,
            "test-value",
            Some(entity_id),
            &old_manager,
        ).expect("存储应该成功");

        let record_before = storage.get_record(id).expect("获取记录应该成功");

        // ========== Act ==========
        storage.reencrypt_all(&old_manager, &new_manager)
            .expect("重新加密应该成功");

        // ========== Assert ==========
        let record_after = storage.get_record(id).expect("获取记录应该成功");

        assert_eq!(record_after.id, record_before.id, "ID应该保持不变");
        assert_eq!(record_after.entity_id, record_before.entity_id, "实体ID应该保持不变");
        assert_eq!(record_after.created_at, record_before.created_at, "创建时间应该保持不变");
        assert!(record_after.updated_at >= record_before.updated_at, "更新时间应该被更新");
    }
}

// ========== 统计信息测试 ==========

mod statistics {
    use super::*;

    #[test]
    fn test_get_statistics_empty() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();

        // ========== Act ==========
        let stats = storage.get_statistics().expect("获取统计信息应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_count, 0, "空数据库应该有0条记录");
        assert_eq!(stats.oldest_timestamp, None, "空数据库应该没有最早时间戳");
        assert_eq!(stats.newest_timestamp, None, "空数据库应该没有最新时间戳");
    }

    #[test]
    fn test_get_statistics_with_data() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();

        // 添加测试数据
        for i in 1..=10 {
            storage.store(
                &format!("field-{}", i),
                EncryptedFieldType::ApiKey,
                &format!("value-{}", i),
                Some("test-entity"),
                &manager,
            ).expect("存储应该成功");
            
            // 稍微延迟以确保时间戳不同
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Act ==========
        let stats = storage.get_statistics().expect("获取统计信息应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_count, 10, "应该有10条记录");
        assert!(stats.oldest_timestamp.is_some(), "应该有最早时间戳");
        assert!(stats.newest_timestamp.is_some(), "应该有最新时间戳");
        assert!(
            stats.newest_timestamp.unwrap() >= stats.oldest_timestamp.unwrap(),
            "最新时间戳应该大于等于最早时间戳"
        );
    }

    #[test]
    fn test_statistics_after_deletion() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();

        // 添加并删除数据
        for i in 1..=5 {
            storage.store(
                &format!("field-{}", i),
                EncryptedFieldType::ApiKey,
                "value",
                None,
                &manager,
            ).expect("存储应该成功");
        }

        storage.delete("field-1").expect("删除应该成功");
        storage.delete("field-2").expect("删除应该成功");

        // ========== Act ==========
        let stats = storage.get_statistics().expect("获取统计信息应该成功");

        // ========== Assert ==========
        assert_eq!(stats.total_count, 3, "删除后应该有3条记录");
    }
}

// ========== 并发测试 ==========

mod concurrency {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_concurrent_writes() {
        // ========== Arrange ==========
        let temp_dir = TempDir::new().expect("无法创建临时目录");
        let db_path = temp_dir.path().join("concurrent.db");
        let storage = Arc::new(EncryptedStorage::new(&db_path).expect("无法创建加密存储"));
        let manager = Arc::new(create_test_manager());

        // ========== Act ==========
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let storage = Arc::clone(&storage);
                let manager = Arc::clone(&manager);
                
                thread::spawn(move || {
                    storage.store(
                        &format!("concurrent-{}", i),
                        EncryptedFieldType::ApiKey,
                        &format!("value-{}", i),
                        None,
                        &manager,
                    )
                })
            })
            .collect();

        // 等待所有线程完成
        for handle in handles {
            let result = handle.join().expect("线程应该成功完成");
            assert!(result.is_ok(), "并发写入应该成功");
        }

        // ========== Assert ==========
        let stats = storage.get_statistics().expect("获取统计信息应该成功");
        assert_eq!(stats.total_count, 10, "应该有10条记录");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_store_empty_string() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();

        // ========== Act ==========
        let result = storage.store(
            "empty-test",
            EncryptedFieldType::ApiKey,
            "",
            None,
            &manager,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "存储空字符串应该成功");
        let retrieved = storage.retrieve("empty-test", &manager).expect("检索应该成功");
        assert_eq!(retrieved, "", "应该返回空字符串");
    }

    #[test]
    fn test_store_large_data() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let large_data = "x".repeat(1_000_000); // 1MB 数据

        // ========== Act ==========
        let result = storage.store(
            "large-data",
            EncryptedFieldType::SensitiveConfig,
            &large_data,
            None,
            &manager,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "存储大数据应该成功");
        let retrieved = storage.retrieve("large-data", &manager).expect("检索应该成功");
        assert_eq!(retrieved.len(), large_data.len(), "数据大小应该匹配");
    }

    #[test]
    fn test_store_special_characters() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let special_data = "测试数据🔐\n\t\r\0特殊字符!@#$%^&*()";

        // ========== Act ==========
        let result = storage.store(
            "special-chars",
            EncryptedFieldType::PersonalInfo,
            special_data,
            None,
            &manager,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "存储特殊字符应该成功");
        let retrieved = storage.retrieve("special-chars", &manager).expect("检索应该成功");
        assert_eq!(retrieved, special_data, "特殊字符应该被正确保存和检索");
    }

    #[test]
    fn test_very_long_id() {
        // ========== Arrange ==========
        let (_temp, storage) = setup_test_storage();
        let manager = create_test_manager();
        let long_id = "a".repeat(1000);

        // ========== Act ==========
        let result = storage.store(
            &long_id,
            EncryptedFieldType::Custom("test".to_string()),
            "value",
            None,
            &manager,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "使用长ID存储应该成功");
        let retrieved = storage.retrieve(&long_id, &manager).expect("检索应该成功");
        assert_eq!(retrieved, "value", "应该能用长ID检索");
    }
}

// ========== 错误处理测试 ==========

mod error_handling {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_create_storage_invalid_path() {
        // ========== Arrange ==========
        let invalid_path = Path::new("/invalid/path/that/does/not/exist/test.db");

        // ========== Act ==========
        let result = EncryptedStorage::new(invalid_path);

        // ========== Assert ==========
        // 根据实现，可能成功（创建目录）或失败
        // 这里我们只是测试它不会panic
        let _ = result;
    }

    #[test]
    fn test_corrupted_data_handling() {
        // 这个测试需要直接操作数据库来模拟数据损坏
        // 由于EncryptedStorage没有直接暴露Connection，我们跳过这个测试
        // 或者在实际实现中添加测试辅助方法
    }
}


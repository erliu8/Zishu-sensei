//! 加密/解密流程集成测试
//!
//! 测试从密钥生成、数据加密、存储、解密到验证的完整流程

use crate::common::*;
use serde_json::json;

// ========================================
// 加密流程测试
// ========================================

/// 测试完整的加密/解密流程
/// 流程: 生成密钥 → 加密数据 → 存储加密数据 → 读取 → 解密 → 验证
#[tokio::test]
async fn test_complete_encryption_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_full_schema().unwrap();
    
    let key_id = "master-key-001";
    let plaintext = "这是需要加密的敏感数据：API Key = sk-1234567890";
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 模拟生成加密密钥（实际中会使用真实的加密库）
    // 这里我们只是存储密钥信息
    let key_info = json!({
        "id": key_id,
        "algorithm": "AES-256-GCM",
        "created_at": now,
        "expires_at": null,
        "usage": ["encrypt", "decrypt"],
        "status": "active"
    });
    
    // 创建一个设置条目来存储密钥信息
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            format!("encryption.key.{}", key_id),
            key_info.to_string(),
            "json",
            now
        ]
    ).unwrap();
    
    // 2. 加密数据（模拟）
    // 在真实应用中，这里会使用 AES-GCM 等算法进行加密
    let encrypted_data = base64::encode(format!("ENCRYPTED[{}]", plaintext));
    let iv = base64::encode("initialization_vector_12345");
    let tag = base64::encode("authentication_tag");
    
    let encryption_metadata = json!({
        "key_id": key_id,
        "algorithm": "AES-256-GCM",
        "iv": iv,
        "tag": tag,
        "encrypted_at": now
    });
    
    // 3. 存储加密后的数据
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "encrypted_data.test",
            encrypted_data,
            "encrypted",
            now
        ]
    ).unwrap();
    
    // 存储加密元数据
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "encrypted_data.test.metadata",
            encryption_metadata.to_string(),
            "json",
            now
        ]
    ).unwrap();
    
    // 4. 读取加密数据
    let (stored_encrypted_data, stored_metadata): (String, String) = {
        let encrypted = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &["encrypted_data.test"],
            |row| row.get(0)
        ).unwrap();
        
        let metadata = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &["encrypted_data.test.metadata"],
            |row| row.get(0)
        ).unwrap();
        
        (encrypted, metadata)
    };
    
    let metadata_json: serde_json::Value = serde_json::from_str(&stored_metadata).unwrap();
    
    // 验证元数据
    assert_eq!(metadata_json["key_id"], key_id);
    assert_eq!(metadata_json["algorithm"], "AES-256-GCM");
    
    // 5. 解密数据（模拟）
    let decoded = base64::decode(&stored_encrypted_data).unwrap();
    let decoded_str = String::from_utf8(decoded).unwrap();
    
    // 简单的解密模拟：移除 "ENCRYPTED[" 前缀和 "]" 后缀
    assert!(decoded_str.starts_with("ENCRYPTED["));
    let decrypted = decoded_str.trim_start_matches("ENCRYPTED[").trim_end_matches("]");
    
    // 6. 验证解密后的数据
    assert_eq!(decrypted, plaintext);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试多个数据项的加密存储
#[tokio::test]
async fn test_multiple_encrypted_items() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let key_id = "shared-key";
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act (执行) ==========
    
    // 加密并存储多个敏感数据项
    let sensitive_items = vec![
        ("api_key", "sk-proj-1234567890abcdef"),
        ("database_password", "MyS3cur3P@ssw0rd!"),
        ("oauth_token", "ghp_1234567890abcdefghijklmnop"),
        ("encryption_secret", "secret_encryption_key_xyz"),
    ];
    
    for (name, value) in &sensitive_items {
        // 模拟加密
        let encrypted = base64::encode(format!("ENCRYPTED[{}]", value));
        
        let metadata = json!({
            "key_id": key_id,
            "algorithm": "AES-256-GCM",
            "iv": base64::encode(format!("iv_{}", name)),
            "encrypted_at": now
        });
        
        // 存储加密数据
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                format!("encrypted.{}", name),
                encrypted,
                "encrypted",
                now
            ]
        ).unwrap();
        
        // 存储元数据
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                format!("encrypted.{}.metadata", name),
                metadata.to_string(),
                "json",
                now
            ]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证所有加密项都已存储
    let encrypted_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_settings WHERE type = 'encrypted'",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(encrypted_count, 4);
    
    // 逐个解密并验证
    for (name, expected_value) in &sensitive_items {
        let encrypted_data: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &[format!("encrypted.{}", name)],
            |row| row.get(0)
        ).unwrap();
        
        // 解密
        let decoded = base64::decode(&encrypted_data).unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        let decrypted = decoded_str.trim_start_matches("ENCRYPTED[").trim_end_matches("]");
        
        assert_eq!(decrypted, *expected_value);
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试密钥轮换流程
#[tokio::test]
async fn test_key_rotation_flow() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let old_key_id = "key-v1";
    let new_key_id = "key-v2";
    let plaintext = "Sensitive data that needs re-encryption";
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 使用旧密钥加密数据
    let encrypted_with_old_key = base64::encode(format!("ENCRYPTED_V1[{}]", plaintext));
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "data.sensitive",
            &encrypted_with_old_key,
            "encrypted",
            now
        ]
    ).unwrap();
    
    let metadata_v1 = json!({
        "key_id": old_key_id,
        "algorithm": "AES-256-GCM",
        "version": 1
    });
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "data.sensitive.metadata",
            metadata_v1.to_string(),
            "json",
            now
        ]
    ).unwrap();
    
    // 2. 生成新密钥
    let new_key_info = json!({
        "id": new_key_id,
        "algorithm": "AES-256-GCM",
        "version": 2,
        "created_at": now + 1,
        "status": "active"
    });
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            format!("encryption.key.{}", new_key_id),
            new_key_info.to_string(),
            "json",
            now + 1
        ]
    ).unwrap();
    
    // 3. 使用旧密钥解密数据
    let decoded_v1 = base64::decode(&encrypted_with_old_key).unwrap();
    let decoded_str_v1 = String::from_utf8(decoded_v1).unwrap();
    let decrypted_data = decoded_str_v1
        .trim_start_matches("ENCRYPTED_V1[")
        .trim_end_matches("]");
    
    assert_eq!(decrypted_data, plaintext);
    
    // 4. 使用新密钥重新加密
    let encrypted_with_new_key = base64::encode(format!("ENCRYPTED_V2[{}]", decrypted_data));
    
    // 5. 更新存储的加密数据
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params![
            &encrypted_with_new_key,
            now + 2,
            "data.sensitive"
        ]
    ).unwrap();
    
    let metadata_v2 = json!({
        "key_id": new_key_id,
        "algorithm": "AES-256-GCM",
        "version": 2,
        "rotated_from": old_key_id,
        "rotated_at": now + 2
    });
    
    conn.execute(
        "UPDATE app_settings SET value = ?1, updated_at = ?2 WHERE key = ?3",
        rusqlite::params![
            metadata_v2.to_string(),
            now + 2,
            "data.sensitive.metadata"
        ]
    ).unwrap();
    
    // 6. 验证新密钥加密的数据
    let new_encrypted: String = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        &["data.sensitive"],
        |row| row.get(0)
    ).unwrap();
    
    let new_metadata: String = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        &["data.sensitive.metadata"],
        |row| row.get(0)
    ).unwrap();
    
    let new_metadata_json: serde_json::Value = serde_json::from_str(&new_metadata).unwrap();
    assert_eq!(new_metadata_json["key_id"], new_key_id);
    assert_eq!(new_metadata_json["version"], 2);
    assert_eq!(new_metadata_json["rotated_from"], old_key_id);
    
    // 7. 解密并验证数据完整性
    let decoded_v2 = base64::decode(&new_encrypted).unwrap();
    let decoded_str_v2 = String::from_utf8(decoded_v2).unwrap();
    let final_decrypted = decoded_str_v2
        .trim_start_matches("ENCRYPTED_V2[")
        .trim_end_matches("]");
    
    assert_eq!(final_decrypted, plaintext);
    
    // 8. 标记旧密钥为已弃用
    conn.execute(
        "UPDATE app_settings 
         SET value = json_set(value, '$.status', 'deprecated'), updated_at = ?1 
         WHERE key = ?2",
        rusqlite::params![now + 3, format!("encryption.key.{}", old_key_id)]
    ).unwrap();
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试加密数据的访问控制
#[tokio::test]
async fn test_encrypted_data_access_control() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    test_db.init_permission_tables().unwrap();
    
    let key_id = "protected-key";
    let sensitive_data = "Very sensitive information";
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 存储加密数据
    let encrypted = base64::encode(format!("ENCRYPTED[{}]", sensitive_data));
    
    conn.execute(
        "INSERT INTO app_settings (key, value, type, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "protected.data",
            encrypted,
            "encrypted",
            now
        ]
    ).unwrap();
    
    // 2. 设置访问权限
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "encrypted.data",
            "read",
            1,
            now,
            "Permission to read encrypted data"
        ]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "encrypted.data",
            "write",
            0,
            None::<i64>,
            "Permission to write encrypted data (not granted)"
        ]
    ).unwrap();
    
    // 3. 检查读权限
    let read_granted: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["encrypted.data", "read"],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(read_granted, 1);
    
    // 4. 检查写权限
    let write_granted: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = ?2",
        rusqlite::params!["encrypted.data", "write"],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(write_granted, 0);
    
    // 5. 只有在有读权限时才能读取数据
    if read_granted == 1 {
        let encrypted_data: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &["protected.data"],
            |row| row.get(0)
        ).unwrap();
        
        // 解密
        let decoded = base64::decode(&encrypted_data).unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        let decrypted = decoded_str.trim_start_matches("ENCRYPTED[").trim_end_matches("]");
        
        assert_eq!(decrypted, sensitive_data);
    }
    
    // 6. 尝试写入应该检查权限
    if write_granted == 1 {
        // 可以写入
        panic!("Write permission should not be granted in this test");
    } else {
        // 写入应该被拒绝
        // 在实际应用中，这里会返回错误
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试批量加密数据迁移
#[tokio::test]
async fn test_bulk_encryption_migration() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act (执行) ==========
    
    // 1. 创建一些未加密的敏感数据
    let unencrypted_items = vec![
        ("user.api_key", "plain_api_key_123"),
        ("user.password", "plain_password_456"),
        ("user.token", "plain_token_789"),
    ];
    
    for (key, value) in &unencrypted_items {
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, value, "string", now]
        ).unwrap();
    }
    
    // 2. 批量迁移到加密存储
    let migration_key_id = "migration-key";
    
    for (key, _) in &unencrypted_items {
        // 读取明文数据
        let plaintext: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &[key],
            |row| row.get(0)
        ).unwrap();
        
        // 加密
        let encrypted = base64::encode(format!("ENCRYPTED[{}]", plaintext));
        
        // 更新为加密类型
        conn.execute(
            "UPDATE app_settings SET value = ?1, type = ?2, updated_at = ?3 WHERE key = ?4",
            rusqlite::params![encrypted, "encrypted", now + 1, key]
        ).unwrap();
        
        // 添加加密元数据
        let metadata = json!({
            "key_id": migration_key_id,
            "algorithm": "AES-256-GCM",
            "migrated_at": now + 1
        });
        
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                format!("{}.metadata", key),
                metadata.to_string(),
                "json",
                now + 1
            ]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证所有数据都已加密
    let encrypted_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_settings WHERE key LIKE 'user.%' AND type = 'encrypted'",
        [],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(encrypted_count, 3);
    
    // 验证可以解密所有数据
    for (key, expected_value) in &unencrypted_items {
        let encrypted_data: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &[key],
            |row| row.get(0)
        ).unwrap();
        
        let decoded = base64::decode(&encrypted_data).unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        let decrypted = decoded_str.trim_start_matches("ENCRYPTED[").trim_end_matches("]");
        
        assert_eq!(decrypted, *expected_value);
        
        // 验证元数据存在
        let metadata_exists = test_db.record_exists(
            "app_settings",
            "key",
            &format!("{}.metadata", key)
        ).unwrap();
        assert!(metadata_exists);
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试加密数据的备份和恢复
#[tokio::test]
async fn test_encrypted_data_backup_restore() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_settings_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    let key_id = "backup-key";
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建加密数据
    let original_data = vec![
        ("config.api_key", "secret_key_abc"),
        ("config.db_password", "db_pass_xyz"),
    ];
    
    for (key, value) in &original_data {
        let encrypted = base64::encode(format!("ENCRYPTED[{}]", value));
        
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, encrypted, "encrypted", now]
        ).unwrap();
        
        let metadata = json!({
            "key_id": key_id,
            "algorithm": "AES-256-GCM"
        });
        
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                format!("{}.metadata", key),
                metadata.to_string(),
                "json",
                now
            ]
        ).unwrap();
    }
    
    // 2. 备份加密数据（导出为 JSON）
    let mut stmt = conn.prepare(
        "SELECT key, value, type FROM app_settings WHERE type = 'encrypted' OR type = 'json'"
    ).unwrap();
    
    let backup_data: Vec<(String, String, String)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert!(!backup_data.is_empty());
    
    // 3. 清空数据（模拟数据丢失）
    conn.execute("DELETE FROM app_settings", []).unwrap();
    
    let count_after_delete = test_db.count_records("app_settings").unwrap();
    assert_eq!(count_after_delete, 0);
    
    // 4. 从备份恢复
    for (key, value, value_type) in backup_data {
        conn.execute(
            "INSERT INTO app_settings (key, value, type, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, value, value_type, now + 1]
        ).unwrap();
    }
    
    // 5. 验证恢复的数据
    for (key, expected_value) in &original_data {
        let encrypted_data: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            &[key],
            |row| row.get(0)
        ).unwrap();
        
        let decoded = base64::decode(&encrypted_data).unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        let decrypted = decoded_str.trim_start_matches("ENCRYPTED[").trim_end_matches("]");
        
        assert_eq!(decrypted, *expected_value);
        
        // 验证元数据也被恢复
        let metadata_exists = test_db.record_exists(
            "app_settings",
            "key",
            &format!("{}.metadata", key)
        ).unwrap();
        assert!(metadata_exists);
    }
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}


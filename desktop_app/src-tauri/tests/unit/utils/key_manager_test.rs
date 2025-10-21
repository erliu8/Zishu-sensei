// tests/unit/utils/key_manager_test.rs
//! 密钥管理器测试
//!
//! 测试密钥的生成、存储、加载、轮换、删除等功能

use zishu_sensei::utils::key_manager::*;
use zishu_sensei::utils::encryption::generate_random_password;

/// 创建测试用的密钥管理器（使用唯一的服务名避免冲突）
fn create_test_manager() -> KeyManager {
    let test_id = uuid::Uuid::new_v4().to_string();
    KeyManager::new("test-app", format!("test-service-{}", test_id))
}

// ========================================
// 密钥生成和存储测试
// ========================================

mod key_generation {
    use super::*;

    #[test]
    fn test_generate_master_key_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-key-001";
        let password = "secure_password_123";
        let purpose = "测试密钥";

        // ========== Act ==========
        let result = manager.generate_master_key(key_id, password, purpose, None);

        // ========== Assert ==========
        assert!(result.is_ok());
        let key_info = result.unwrap();
        assert_eq!(key_info.key_id, key_id);
        assert_eq!(key_info.purpose, purpose);
        assert_eq!(key_info.version, 1);
        assert!(key_info.created_at > 0);
        assert!(key_info.expires_at.is_none());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_generate_master_key_with_expiration() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-key-002";
        let password = "password123";
        let expires_in_days = 30;

        // ========== Act ==========
        let result = manager.generate_master_key(
            key_id,
            password,
            "有过期时间的密钥",
            Some(expires_in_days),
        );

        // ========== Assert ==========
        assert!(result.is_ok());
        let key_info = result.unwrap();
        assert!(key_info.expires_at.is_some());
        let expires_at = key_info.expires_at.unwrap();
        let expected_expires = key_info.created_at + expires_in_days * 86400;
        assert_eq!(expires_at, expected_expires);

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_generate_duplicate_key_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-key-003";
        let password = "password";

        // 先生成一个密钥
        manager.generate_master_key(key_id, password, "第一个密钥", None).unwrap();

        // ========== Act ==========
        // 尝试生成相同 ID 的密钥
        let result = manager.generate_master_key(key_id, password, "重复密钥", None);

        // ========== Assert ==========
        assert!(result.is_err());
        match result.unwrap_err() {
            KeyManagerError::KeyAlreadyExists => {},
            _ => panic!("应该返回 KeyAlreadyExists 错误"),
        }

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_generate_multiple_keys_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_ids = vec!["key-1", "key-2", "key-3"];
        let password = "password";

        // ========== Act & Assert ==========
        for key_id in &key_ids {
            let result = manager.generate_master_key(key_id, password, "测试", None);
            assert!(result.is_ok());
        }

        // 验证所有密钥都存在
        for key_id in &key_ids {
            assert!(manager.key_exists(key_id).unwrap());
        }

        // ========== Cleanup ==========
        for key_id in &key_ids {
            let _ = manager.delete_key(key_id);
        }
    }
}

// ========================================
// 密钥加载和获取测试
// ========================================

mod key_loading {
    use super::*;

    #[test]
    fn test_load_key_with_correct_password_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-load-001";
        let password = "correct_password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        manager.unload_key(key_id);

        // ========== Act ==========
        let result = manager.load_key(key_id, password);

        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(manager.get_manager(key_id).is_ok());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_load_key_with_wrong_password_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-load-002";
        let correct_password = "correct_password";
        let wrong_password = "wrong_password";

        manager.generate_master_key(key_id, correct_password, "测试", None).unwrap();
        manager.unload_key(key_id);

        // ========== Act ==========
        let result = manager.load_key(key_id, wrong_password);

        // ========== Assert ==========
        assert!(result.is_err());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_load_nonexistent_key_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "nonexistent-key";

        // ========== Act ==========
        let result = manager.load_key(key_id, "password");

        // ========== Assert ==========
        assert!(result.is_err());
    }

    #[test]
    fn test_get_manager_before_load_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-load-003";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        manager.unload_key(key_id);

        // ========== Act ==========
        let result = manager.get_manager(key_id);

        // ========== Assert ==========
        assert!(result.is_err());
        match result.unwrap_err() {
            KeyManagerError::KeyNotFound => {},
            _ => panic!("应该返回 KeyNotFound 错误"),
        }

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_get_manager_after_load_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-load-004";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        manager.unload_key(key_id);
        manager.load_key(key_id, password).unwrap();

        // ========== Act ==========
        let result = manager.get_manager(key_id);

        // ========== Assert ==========
        assert!(result.is_ok());

        // 验证管理器可以正常使用
        let encryption_manager = result.unwrap();
        let plaintext = "Test data";
        let encrypted = encryption_manager.encrypt_string(plaintext).unwrap();
        let decrypted = encryption_manager.decrypt_string(&encrypted).unwrap();
        assert_eq!(plaintext, decrypted);

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }
}

// ========================================
// 密钥轮换测试
// ========================================

mod key_rotation {
    use super::*;

    #[test]
    fn test_rotate_key_with_valid_passwords_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-rotate-001";
        let old_password = "old_password_123";
        let new_password = "new_password_456";

        manager.generate_master_key(key_id, old_password, "测试", None).unwrap();

        // ========== Act ==========
        let result = manager.rotate_key(key_id, old_password, new_password);

        // ========== Assert ==========
        assert!(result.is_ok());
        let key_info = result.unwrap();
        assert_eq!(key_info.version, 2); // 版本应该增加

        // 验证新密码可以加载密钥
        manager.unload_key(key_id);
        assert!(manager.load_key(key_id, new_password).is_ok());

        // 验证旧密码无法加载密钥
        manager.unload_key(key_id);
        assert!(manager.load_key(key_id, old_password).is_err());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_rotate_key_preserves_data() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-rotate-002";
        let old_password = "old_pass";
        let new_password = "new_pass";
        let plaintext = "Important data that should survive rotation";

        // 生成密钥并加密数据
        manager.generate_master_key(key_id, old_password, "测试", None).unwrap();
        let old_manager = manager.get_manager(key_id).unwrap();
        let encrypted = old_manager.encrypt_string(plaintext).unwrap();

        // ========== Act ==========
        manager.rotate_key(key_id, old_password, new_password).unwrap();

        // ========== Assert ==========
        // 加载新密钥并验证可以解密旧数据
        manager.unload_key(key_id);
        manager.load_key(key_id, new_password).unwrap();
        let new_manager = manager.get_manager(key_id).unwrap();
        let decrypted = new_manager.decrypt_string(&encrypted).unwrap();
        assert_eq!(plaintext, decrypted);

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_rotate_key_with_wrong_old_password_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-rotate-003";
        let correct_password = "correct";
        let wrong_password = "wrong";
        let new_password = "new";

        manager.generate_master_key(key_id, correct_password, "测试", None).unwrap();

        // ========== Act ==========
        let result = manager.rotate_key(key_id, wrong_password, new_password);

        // ========== Assert ==========
        assert!(result.is_err());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_multiple_rotations_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-rotate-004";
        let passwords = vec!["pass1", "pass2", "pass3", "pass4"];

        manager.generate_master_key(key_id, passwords[0], "测试", None).unwrap();

        // ========== Act & Assert ==========
        for i in 1..passwords.len() {
            let result = manager.rotate_key(key_id, passwords[i-1], passwords[i]);
            assert!(result.is_ok());
            assert_eq!(result.unwrap().version, i as u32 + 1);
        }

        // 验证最后一个密码可以使用
        manager.unload_key(key_id);
        assert!(manager.load_key(key_id, passwords[passwords.len() - 1]).is_ok());

        // 验证之前的密码都无法使用
        for i in 0..passwords.len()-1 {
            manager.unload_key(key_id);
            assert!(manager.load_key(key_id, passwords[i]).is_err());
        }

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }
}

// ========================================
// 密钥删除测试
// ========================================

mod key_deletion {
    use super::*;

    #[test]
    fn test_delete_existing_key_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-delete-001";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        assert!(manager.key_exists(key_id).unwrap());

        // ========== Act ==========
        let result = manager.delete_key(key_id);

        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(!manager.key_exists(key_id).unwrap());
    }

    #[test]
    fn test_delete_removes_from_cache() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-delete-002";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        assert!(manager.get_manager(key_id).is_ok());

        // ========== Act ==========
        manager.delete_key(key_id).unwrap();

        // ========== Assert ==========
        assert!(manager.get_manager(key_id).is_err());
    }

    #[test]
    fn test_delete_nonexistent_key_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "nonexistent-key";

        // ========== Act ==========
        let result = manager.delete_key(key_id);

        // ========== Assert ==========
        assert!(result.is_err());
    }
}

// ========================================
// 密钥信息查询测试
// ========================================

mod key_info {
    use super::*;

    #[test]
    fn test_key_exists_for_existing_key() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-exists-001";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();

        // ========== Act ==========
        let exists = manager.key_exists(key_id).unwrap();

        // ========== Assert ==========
        assert!(exists);

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_key_exists_for_nonexistent_key() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "nonexistent-key";

        // ========== Act ==========
        let exists = manager.key_exists(key_id).unwrap();

        // ========== Assert ==========
        assert!(!exists);
    }

    #[test]
    fn test_get_key_info_success() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-info-001";
        let password = "password";
        let purpose = "测试密钥信息";

        manager.generate_master_key(key_id, password, purpose, Some(7)).unwrap();

        // ========== Act ==========
        let result = manager.get_key_info(key_id);

        // ========== Assert ==========
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.key_id, key_id);
        assert_eq!(info.purpose, purpose);
        assert_eq!(info.version, 1);
        assert!(info.expires_at.is_some());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_get_key_info_for_nonexistent_key_fails() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "nonexistent-key";

        // ========== Act ==========
        let result = manager.get_key_info(key_id);

        // ========== Assert ==========
        assert!(result.is_err());
    }
}

// ========================================
// 密钥卸载测试
// ========================================

mod key_unloading {
    use super::*;

    #[test]
    fn test_unload_key_removes_from_cache() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-unload-001";
        let password = "password";

        manager.generate_master_key(key_id, password, "测试", None).unwrap();
        assert!(manager.get_manager(key_id).is_ok());

        // ========== Act ==========
        manager.unload_key(key_id);

        // ========== Assert ==========
        assert!(manager.get_manager(key_id).is_err());

        // 但密钥仍然存在于存储中
        assert!(manager.key_exists(key_id).unwrap());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_unload_all_keys_clears_cache() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_ids = vec!["key-1", "key-2", "key-3"];
        let password = "password";

        for key_id in &key_ids {
            manager.generate_master_key(key_id, password, "测试", None).unwrap();
            assert!(manager.get_manager(key_id).is_ok());
        }

        // ========== Act ==========
        manager.unload_all_keys();

        // ========== Assert ==========
        for key_id in &key_ids {
            assert!(manager.get_manager(key_id).is_err());
            // 但密钥仍然存在
            assert!(manager.key_exists(key_id).unwrap());
        }

        // ========== Cleanup ==========
        for key_id in &key_ids {
            let _ = manager.delete_key(key_id);
        }
    }

    #[test]
    fn test_unload_nonexistent_key_does_not_panic() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "nonexistent-key";

        // ========== Act & Assert ==========
        // 不应该 panic
        manager.unload_key(key_id);
    }
}

// ========================================
// 端到端加密测试
// ========================================

mod end_to_end {
    use super::*;

    #[test]
    fn test_full_lifecycle() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "lifecycle-test";
        let password = "lifecycle_password";
        let plaintext = "Sensitive data to encrypt";

        // ========== Act & Assert ==========
        // 1. 生成密钥
        manager.generate_master_key(key_id, password, "生命周期测试", Some(30)).unwrap();

        // 2. 使用密钥加密数据
        let encryption_manager = manager.get_manager(key_id).unwrap();
        let encrypted = encryption_manager.encrypt_string(plaintext).unwrap();

        // 3. 卸载密钥
        manager.unload_key(key_id);
        assert!(manager.get_manager(key_id).is_err());

        // 4. 重新加载密钥
        manager.load_key(key_id, password).unwrap();

        // 5. 解密数据
        let encryption_manager = manager.get_manager(key_id).unwrap();
        let decrypted = encryption_manager.decrypt_string(&encrypted).unwrap();
        assert_eq!(plaintext, decrypted);

        // 6. 轮换密钥
        let new_password = "new_lifecycle_password";
        manager.rotate_key(key_id, password, new_password).unwrap();

        // 7. 验证旧密文仍然可以解密
        manager.unload_key(key_id);
        manager.load_key(key_id, new_password).unwrap();
        let encryption_manager = manager.get_manager(key_id).unwrap();
        let decrypted = encryption_manager.decrypt_string(&encrypted).unwrap();
        assert_eq!(plaintext, decrypted);

        // 8. 删除密钥
        manager.delete_key(key_id).unwrap();
        assert!(!manager.key_exists(key_id).unwrap());
    }
}

// ========================================
// 并发测试
// ========================================

mod concurrency {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_concurrent_key_access() {
        // ========== Arrange ==========
        let manager = Arc::new(create_test_manager());
        let key_id = "concurrent-test";
        let password = "password";

        manager.generate_master_key(key_id, password, "并发测试", None).unwrap();

        let num_threads = 10;
        let mut handles = vec![];

        // ========== Act ==========
        for i in 0..num_threads {
            let manager_clone = Arc::clone(&manager);
            let handle = thread::spawn(move || {
                let encryption_manager = manager_clone.get_manager(key_id).unwrap();
                let plaintext = format!("Thread {} data", i);
                let encrypted = encryption_manager.encrypt_string(&plaintext).unwrap();
                let decrypted = encryption_manager.decrypt_string(&encrypted).unwrap();
                assert_eq!(plaintext, decrypted);
            });
            handles.push(handle);
        }

        // ========== Assert ==========
        for handle in handles {
            handle.join().unwrap();
        }

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_very_long_password() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "long-password-test";
        let password = generate_random_password(256).unwrap();

        // ========== Act ==========
        let result = manager.generate_master_key(key_id, &password, "长密码测试", None);

        // ========== Assert ==========
        assert!(result.is_ok());

        // 验证可以加载
        manager.unload_key(key_id);
        assert!(manager.load_key(key_id, &password).is_ok());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_unicode_password() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "unicode-password-test";
        let password = "密码123🔒パスワード";

        // ========== Act ==========
        let result = manager.generate_master_key(key_id, password, "Unicode密码测试", None);

        // ========== Assert ==========
        assert!(result.is_ok());

        manager.unload_key(key_id);
        assert!(manager.load_key(key_id, password).is_ok());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_key_id_with_special_characters() {
        // ========== Arrange ==========
        let manager = create_test_manager();
        let key_id = "test-key@2024#special_chars";
        let password = "password";

        // ========== Act ==========
        let result = manager.generate_master_key(key_id, password, "特殊字符ID测试", None);

        // ========== Assert ==========
        assert!(result.is_ok());
        assert!(manager.key_exists(key_id).unwrap());

        // ========== Cleanup ==========
        let _ = manager.delete_key(key_id);
    }
}


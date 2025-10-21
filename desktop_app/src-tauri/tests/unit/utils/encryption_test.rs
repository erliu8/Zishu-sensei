// tests/unit/utils/encryption_test.rs
//! 加密工具测试
//!
//! 测试 AES-GCM 加密/解密、密钥派生、随机数生成等功能

use zishu_sensei::utils::encryption::*;

// ========================================
// 基础加密/解密测试
// ========================================

mod encryption_decryption {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_with_random_key_success() {
        // ========== Arrange ==========
        let key = generate_random_key().expect("生成随机密钥失败");
        let manager = EncryptionManager::new(key);
        let plaintext = "Hello, World! 这是测试数据 🔒";

        // ========== Act ==========
        let encrypted = manager.encrypt_string(plaintext).expect("加密失败");
        let decrypted = manager.decrypt_string(&encrypted).expect("解密失败");

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
        assert_ne!(encrypted.ciphertext, "");
        assert_ne!(encrypted.nonce, "");
        assert_eq!(encrypted.version, 1);
        assert!(encrypted.timestamp > 0);
    }

    #[test]
    fn test_encrypt_decrypt_empty_string_success() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "";

        // ========== Act ==========
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encrypt_decrypt_large_data_success() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "A".repeat(10_000); // 10KB 数据

        // ========== Act ==========
        let encrypted = manager.encrypt_string(&plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encrypt_decrypt_binary_data_success() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = vec![0u8, 1, 2, 3, 255, 128, 64, 32];

        // ========== Act ==========
        let encrypted = manager.encrypt(&plaintext).unwrap();
        let decrypted = manager.decrypt(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        // ========== Arrange ==========
        let key1 = generate_random_key().unwrap();
        let key2 = generate_random_key().unwrap();
        let manager1 = EncryptionManager::new(key1);
        let manager2 = EncryptionManager::new(key2);
        let plaintext = "Secret message";

        // ========== Act ==========
        let encrypted = manager1.encrypt_string(plaintext).unwrap();
        let result = manager2.decrypt_string(&encrypted);

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("解密失败"));
    }

    #[test]
    fn test_decrypt_with_corrupted_ciphertext_fails() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "Test data";
        let mut encrypted = manager.encrypt_string(plaintext).unwrap();

        // 篡改密文
        encrypted.ciphertext = "corrupted_base64_data".to_string();

        // ========== Act ==========
        let result = manager.decrypt_string(&encrypted);

        // ========== Assert ==========
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_with_invalid_nonce_fails() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "Test data";
        let mut encrypted = manager.encrypt_string(plaintext).unwrap();

        // 使用无效长度的 nonce
        encrypted.nonce = base64::engine::general_purpose::STANDARD.encode(&[0u8; 8]); // 错误长度

        // ========== Act ==========
        let result = manager.decrypt_string(&encrypted);

        // ========== Assert ==========
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::InvalidNonceLength => {},
            _ => panic!("应该返回 InvalidNonceLength 错误"),
        }
    }

    #[test]
    fn test_multiple_encryptions_produce_different_ciphertexts() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "Same message";

        // ========== Act ==========
        let encrypted1 = manager.encrypt_string(plaintext).unwrap();
        let encrypted2 = manager.encrypt_string(plaintext).unwrap();

        // ========== Assert ==========
        // 由于使用随机 nonce，每次加密结果都应该不同
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
        assert_ne!(encrypted1.nonce, encrypted2.nonce);

        // 但解密结果应该相同
        assert_eq!(
            manager.decrypt_string(&encrypted1).unwrap(),
            manager.decrypt_string(&encrypted2).unwrap()
        );
    }
}

// ========================================
// 密码派生测试
// ========================================

mod password_based_encryption {
    use super::*;

    #[test]
    fn test_from_password_with_valid_params_success() {
        // ========== Arrange ==========
        let password = "my_secure_password_123";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            memory_cost: 65536,
            time_cost: 3,
            parallelism: 4,
        };

        // ========== Act ==========
        let result = EncryptionManager::from_password(password, &params);

        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_same_password_same_salt_produces_same_key() {
        // ========== Arrange ==========
        let password = "test_password";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        let plaintext = "Test message";

        // ========== Act ==========
        let manager1 = EncryptionManager::from_password(password, &params).unwrap();
        let manager2 = EncryptionManager::from_password(password, &params).unwrap();
        let encrypted = manager1.encrypt_string(plaintext).unwrap();
        let decrypted = manager2.decrypt_string(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_same_password_different_salt_produces_different_key() {
        // ========== Arrange ==========
        let password = "test_password";
        let salt1 = generate_salt().unwrap();
        let salt2 = generate_salt().unwrap();
        let params1 = KeyDerivationParams {
            salt: salt1,
            ..Default::default()
        };
        let params2 = KeyDerivationParams {
            salt: salt2,
            ..Default::default()
        };
        let plaintext = "Test message";

        // ========== Act ==========
        let manager1 = EncryptionManager::from_password(password, &params1).unwrap();
        let manager2 = EncryptionManager::from_password(password, &params2).unwrap();
        let encrypted = manager1.encrypt_string(plaintext).unwrap();
        let result = manager2.decrypt_string(&encrypted);

        // ========== Assert ==========
        assert!(result.is_err()); // 不同盐值应该无法解密
    }

    #[test]
    fn test_different_passwords_cannot_decrypt() {
        // ========== Arrange ==========
        let password1 = "password1";
        let password2 = "password2";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        let plaintext = "Secret data";

        // ========== Act ==========
        let manager1 = EncryptionManager::from_password(password1, &params).unwrap();
        let manager2 = EncryptionManager::from_password(password2, &params).unwrap();
        let encrypted = manager1.encrypt_string(plaintext).unwrap();
        let result = manager2.decrypt_string(&encrypted);

        // ========== Assert ==========
        assert!(result.is_err());
    }

    #[test]
    fn test_from_password_with_invalid_salt_fails() {
        // ========== Arrange ==========
        let password = "test_password";
        let params = KeyDerivationParams {
            salt: "invalid!!!base64".to_string(),
            ..Default::default()
        };

        // ========== Act ==========
        let result = EncryptionManager::from_password(password, &params);

        // ========== Assert ==========
        assert!(result.is_err());
    }
}

// ========================================
// 快速加密/解密测试
// ========================================

mod quick_encryption {
    use super::*;

    #[test]
    fn test_quick_encrypt_decrypt_success() {
        // ========== Arrange ==========
        let password = "quick_password_123";
        let plaintext = "Quick encryption test";

        // ========== Act ==========
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let decrypted = quick_decrypt(password, &encrypted, &params).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_quick_decrypt_with_wrong_password_fails() {
        // ========== Arrange ==========
        let password = "correct_password";
        let wrong_password = "wrong_password";
        let plaintext = "Secret data";

        // ========== Act ==========
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let result = quick_decrypt(wrong_password, &encrypted, &params);

        // ========== Assert ==========
        assert!(result.is_err());
    }

    #[test]
    fn test_quick_encrypt_generates_unique_salt() {
        // ========== Arrange ==========
        let password = "password";
        let plaintext = "data";

        // ========== Act ==========
        let (_, params1) = quick_encrypt(password, plaintext).unwrap();
        let (_, params2) = quick_encrypt(password, plaintext).unwrap();

        // ========== Assert ==========
        assert_ne!(params1.salt, params2.salt);
    }
}

// ========================================
// 密钥轮换测试
// ========================================

mod key_rotation {
    use super::*;

    #[test]
    fn test_reencrypt_with_new_key_success() {
        // ========== Arrange ==========
        let old_key = generate_random_key().unwrap();
        let new_key = generate_random_key().unwrap();
        let old_manager = EncryptionManager::new(old_key);
        let new_manager = EncryptionManager::new(new_key);
        let plaintext = "Data to rotate";

        // ========== Act ==========
        let encrypted_old = old_manager.encrypt_string(plaintext).unwrap();
        let reencrypted = old_manager.reencrypt(&encrypted_old, &new_manager).unwrap();
        let decrypted = new_manager.decrypt_string(&reencrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);

        // 旧密钥不能解密新的密文
        assert!(old_manager.decrypt_string(&reencrypted).is_err());
    }

    #[test]
    fn test_reencrypt_preserves_data_integrity() {
        // ========== Arrange ==========
        let key1 = generate_random_key().unwrap();
        let key2 = generate_random_key().unwrap();
        let key3 = generate_random_key().unwrap();
        let manager1 = EncryptionManager::new(key1);
        let manager2 = EncryptionManager::new(key2);
        let manager3 = EncryptionManager::new(key3);
        let plaintext = "Important data 重要数据 🔐";

        // ========== Act ==========
        // 多次轮换
        let encrypted1 = manager1.encrypt_string(plaintext).unwrap();
        let encrypted2 = manager1.reencrypt(&encrypted1, &manager2).unwrap();
        let encrypted3 = manager2.reencrypt(&encrypted2, &manager3).unwrap();
        let decrypted = manager3.decrypt_string(&encrypted3).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }
}

// ========================================
// 辅助函数测试
// ========================================

mod helper_functions {
    use super::*;

    #[test]
    fn test_generate_salt_success() {
        // ========== Act ==========
        let salt = generate_salt().unwrap();

        // ========== Assert ==========
        assert!(!salt.is_empty());
        assert!(base64::engine::general_purpose::STANDARD.decode(&salt).is_ok());
    }

    #[test]
    fn test_generate_salt_produces_unique_values() {
        // ========== Act ==========
        let salt1 = generate_salt().unwrap();
        let salt2 = generate_salt().unwrap();
        let salt3 = generate_salt().unwrap();

        // ========== Assert ==========
        assert_ne!(salt1, salt2);
        assert_ne!(salt2, salt3);
        assert_ne!(salt1, salt3);
    }

    #[test]
    fn test_generate_random_key_success() {
        // ========== Act ==========
        let key = generate_random_key().unwrap();

        // ========== Assert ==========
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_generate_random_key_produces_unique_values() {
        // ========== Act ==========
        let key1 = generate_random_key().unwrap();
        let key2 = generate_random_key().unwrap();

        // ========== Assert ==========
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_generate_random_password_with_valid_length() {
        // ========== Arrange ==========
        let lengths = vec![8, 16, 32, 64, 128];

        for length in lengths {
            // ========== Act ==========
            let password = generate_random_password(length).unwrap();

            // ========== Assert ==========
            assert_eq!(password.len(), length);
            assert!(password.chars().all(|c| c.is_ascii()));
        }
    }

    #[test]
    fn test_generate_random_password_produces_unique_values() {
        // ========== Act ==========
        let password1 = generate_random_password(32).unwrap();
        let password2 = generate_random_password(32).unwrap();

        // ========== Assert ==========
        assert_ne!(password1, password2);
    }
}

// ========================================
// 边界条件和错误处理测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_encrypt_very_large_data() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "X".repeat(1_000_000); // 1MB 数据

        // ========== Act ==========
        let encrypted = manager.encrypt_string(&plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encrypt_unicode_data() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "Hello 世界 🌍 مرحبا Привет こんにちは";

        // ========== Act ==========
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encrypted_data_serialization() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "Test data for serialization";

        // ========== Act ==========
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let json = serde_json::to_string(&encrypted).unwrap();
        let deserialized: EncryptedData = serde_json::from_str(&json).unwrap();
        let decrypted = manager.decrypt_string(&deserialized).unwrap();

        // ========== Assert ==========
        assert_eq!(plaintext, decrypted);
        assert_eq!(encrypted.ciphertext, deserialized.ciphertext);
        assert_eq!(encrypted.nonce, deserialized.nonce);
    }

    #[test]
    fn test_key_derivation_params_default() {
        // ========== Act ==========
        let params = KeyDerivationParams::default();

        // ========== Assert ==========
        assert_eq!(params.memory_cost, 65536);
        assert_eq!(params.time_cost, 3);
        assert_eq!(params.parallelism, 4);
    }
}

// ========================================
// 并发和性能测试
// ========================================

mod concurrency {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_concurrent_encryption() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = Arc::new(EncryptionManager::new(key));
        let num_threads = 10;
        let mut handles = vec![];

        // ========== Act ==========
        for i in 0..num_threads {
            let manager_clone = Arc::clone(&manager);
            let handle = thread::spawn(move || {
                let plaintext = format!("Thread {} data", i);
                let encrypted = manager_clone.encrypt_string(&plaintext).unwrap();
                let decrypted = manager_clone.decrypt_string(&encrypted).unwrap();
                assert_eq!(plaintext, decrypted);
            });
            handles.push(handle);
        }

        // ========== Assert ==========
        for handle in handles {
            handle.join().unwrap();
        }
    }
}

// ========================================
// 安全性测试
// ========================================

mod security {
    use super::*;

    #[test]
    fn test_ciphertext_does_not_contain_plaintext() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let plaintext = "VeryUniqueSecretMessage123456";

        // ========== Act ==========
        let encrypted = manager.encrypt_string(plaintext).unwrap();

        // ========== Assert ==========
        // Base64 解码后的密文不应包含明文
        let ciphertext_bytes = base64::engine::general_purpose::STANDARD
            .decode(&encrypted.ciphertext)
            .unwrap();
        let ciphertext_str = String::from_utf8_lossy(&ciphertext_bytes);
        assert!(!ciphertext_str.contains(plaintext));
    }

    #[test]
    fn test_timestamp_is_recent() {
        // ========== Arrange ==========
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        let before = chrono::Utc::now().timestamp();

        // ========== Act ==========
        let encrypted = manager.encrypt_string("test").unwrap();
        let after = chrono::Utc::now().timestamp();

        // ========== Assert ==========
        assert!(encrypted.timestamp >= before);
        assert!(encrypted.timestamp <= after);
    }
}


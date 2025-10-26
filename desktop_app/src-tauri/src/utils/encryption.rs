// src-tauri/src/utils/encryption.rs
//! 加密工具模块
//! 
//! 提供 AES-GCM 加密/解密、密钥派生、随机数生成等功能

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{
    password_hash::{rand_core::RngCore, PasswordHasher, SaltString},
    Argon2,
};
use base64::{engine::general_purpose, Engine};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 加密错误类型
#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("加密失败: {0}")]
    EncryptionFailed(String),
    
    #[error("解密失败: {0}")]
    DecryptionFailed(String),
    
    #[error("密钥派生失败: {0}")]
    KeyDerivationFailed(String),
    
    #[error("无效的密钥长度")]
    InvalidKeyLength,
    
    #[error("无效的 nonce 长度")]
    InvalidNonceLength,
    
    #[error("Base64 编码/解码失败: {0}")]
    Base64Error(String),
    
    #[error("随机数生成失败: {0}")]
    RandomGenerationFailed(String),
}

/// 加密结果结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    /// Base64 编码的密文
    pub ciphertext: String,
    /// Base64 编码的 nonce
    pub nonce: String,
    /// 加密算法版本（用于兼容性）
    pub version: u32,
    /// 加密时间戳
    pub timestamp: i64,
}

/// 密钥派生参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyDerivationParams {
    /// 盐值（Base64 编码）
    pub salt: String,
    /// Argon2 内存消耗（KB）
    pub memory_cost: u32,
    /// Argon2 时间消耗（迭代次数）
    pub time_cost: u32,
    /// Argon2 并行度
    pub parallelism: u32,
}

impl Default for KeyDerivationParams {
    fn default() -> Self {
        Self {
            salt: String::new(),
            memory_cost: 65536, // 64 MB
            time_cost: 3,
            parallelism: 4,
        }
    }
}

/// AES-GCM 加密管理器
#[derive(Clone, Debug)]
pub struct EncryptionManager {
    master_key: [u8; 32],
}

impl EncryptionManager {
    /// 从主密钥创建加密管理器
    pub fn new(master_key: [u8; 32]) -> Self {
        Self { master_key }
    }

    /// 从密码派生主密钥
    pub fn from_password(password: &str, params: &KeyDerivationParams) -> Result<Self, EncryptionError> {
        let salt_bytes = general_purpose::STANDARD
            .decode(&params.salt)
            .map_err(|e| EncryptionError::Base64Error(e.to_string()))?;
        
        let salt = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;
        
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(
                params.memory_cost,
                params.time_cost,
                params.parallelism,
                Some(32),
            )
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?,
        );
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;
        
        let hash_bytes = password_hash
            .hash
            .ok_or_else(|| EncryptionError::KeyDerivationFailed("无法获取哈希值".to_string()))?;
        
        let mut master_key = [0u8; 32];
        master_key.copy_from_slice(hash_bytes.as_bytes());
        
        Ok(Self { master_key })
    }

    /// 加密数据
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<EncryptedData, EncryptionError> {
        let key = Key::<Aes256Gcm>::from_slice(&self.master_key);
        let cipher = Aes256Gcm::new(key);
        
        // 生成随机 nonce（12 字节）
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 加密
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
        
        Ok(EncryptedData {
            ciphertext: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            version: 1,
            timestamp: chrono::Utc::now().timestamp(),
        })
    }

    /// 加密字符串
    pub fn encrypt_string(&self, plaintext: &str) -> Result<EncryptedData, EncryptionError> {
        self.encrypt(plaintext.as_bytes())
    }

    /// 解密数据
    pub fn decrypt(&self, encrypted: &EncryptedData) -> Result<Vec<u8>, EncryptionError> {
        let key = Key::<Aes256Gcm>::from_slice(&self.master_key);
        let cipher = Aes256Gcm::new(key);
        
        // 解码 ciphertext 和 nonce
        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted.ciphertext)
            .map_err(|e| EncryptionError::Base64Error(e.to_string()))?;
        
        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted.nonce)
            .map_err(|e| EncryptionError::Base64Error(e.to_string()))?;
        
        if nonce_bytes.len() != 12 {
            return Err(EncryptionError::InvalidNonceLength);
        }
        
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 解密
        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;
        
        Ok(plaintext)
    }

    /// 解密为字符串
    pub fn decrypt_string(&self, encrypted: &EncryptedData) -> Result<String, EncryptionError> {
        let plaintext = self.decrypt(encrypted)?;
        String::from_utf8(plaintext)
            .map_err(|e| EncryptionError::DecryptionFailed(format!("UTF-8 解码失败: {}", e)))
    }

    /// 重新加密（用于密钥轮换）
    pub fn reencrypt(
        &self,
        encrypted: &EncryptedData,
        new_manager: &EncryptionManager,
    ) -> Result<EncryptedData, EncryptionError> {
        let plaintext = self.decrypt(encrypted)?;
        new_manager.encrypt(&plaintext)
    }
}

/// 生成随机盐值
pub fn generate_salt() -> Result<String, EncryptionError> {
    let mut salt_bytes = [0u8; 16];
    OsRng.fill_bytes(&mut salt_bytes);
    Ok(general_purpose::STANDARD.encode(&salt_bytes))
}

/// 生成随机密钥（32 字节）
pub fn generate_random_key() -> Result<[u8; 32], EncryptionError> {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    Ok(key)
}

/// 生成随机密码（用于测试或临时密钥）
pub fn generate_random_password(length: usize) -> Result<String, EncryptionError> {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let mut password = vec![0u8; length];
    OsRng.fill_bytes(&mut password);
    
    Ok(password
        .iter()
        .map(|&b| CHARSET[b as usize % CHARSET.len()] as char)
        .collect())
}

/// 快速加密辅助函数（使用默认参数）
pub fn quick_encrypt(password: &str, plaintext: &str) -> Result<(EncryptedData, KeyDerivationParams), EncryptionError> {
    let salt = generate_salt()?;
    let params = KeyDerivationParams {
        salt,
        ..Default::default()
    };
    
    let manager = EncryptionManager::from_password(password, &params)?;
    let encrypted = manager.encrypt_string(plaintext)?;
    
    Ok((encrypted, params))
}

/// 快速解密辅助函数
pub fn quick_decrypt(
    password: &str,
    encrypted: &EncryptedData,
    params: &KeyDerivationParams,
) -> Result<String, EncryptionError> {
    let manager = EncryptionManager::from_password(password, params)?;
    manager.decrypt_string(encrypted)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ================================
    // 基础功能测试
    // ================================

    #[test]
    fn test_encryption_manager_creation() {
        let key = [0u8; 32];
        let manager = EncryptionManager::new(key);
        
        // 验证管理器可以正常创建
        assert!(manager.master_key.len() == 32);
    }

    #[test]
    fn test_encryption_decryption_basic() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Hello, World!";
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
        assert_eq!(encrypted.version, 1);
        assert!(encrypted.timestamp > 0);
    }

    #[test]
    fn test_encryption_decryption_binary_data() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let binary_data = vec![0u8, 1, 2, 3, 255, 128, 42];
        let encrypted = manager.encrypt(&binary_data).unwrap();
        let decrypted = manager.decrypt(&encrypted).unwrap();
        
        assert_eq!(binary_data, decrypted);
    }

    #[test]
    fn test_empty_data_encryption() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        // 测试空字符串
        let empty_string = "";
        let encrypted = manager.encrypt_string(empty_string).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();
        assert_eq!(empty_string, decrypted);
        
        // 测试空字节数组
        let empty_bytes = vec![];
        let encrypted = manager.encrypt(&empty_bytes).unwrap();
        let decrypted = manager.decrypt(&encrypted).unwrap();
        assert_eq!(empty_bytes, decrypted);
    }

    #[test]
    fn test_large_data_encryption() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        // 测试大数据（1MB）
        let large_data = vec![42u8; 1024 * 1024];
        let encrypted = manager.encrypt(&large_data).unwrap();
        let decrypted = manager.decrypt(&encrypted).unwrap();
        
        assert_eq!(large_data, decrypted);
    }

    // ================================
    // 密码基础加密测试
    // ================================

    #[test]
    fn test_password_based_encryption_basic() {
        let password = "my_secure_password";
        let plaintext = "Secret data";
        
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let decrypted = quick_decrypt(password, &encrypted, &params).unwrap();
        
        assert_eq!(plaintext, decrypted);
        assert!(!params.salt.is_empty());
    }

    #[test]
    fn test_password_derived_manager() {
        let password = "test_password";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        
        let manager1 = EncryptionManager::from_password(password, &params).unwrap();
        let manager2 = EncryptionManager::from_password(password, &params).unwrap();
        
        // 相同密码和参数应该产生相同的密钥
        assert_eq!(manager1.master_key, manager2.master_key);
    }

    #[test]
    fn test_different_passwords_different_keys() {
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        
        let manager1 = EncryptionManager::from_password("password1", &params).unwrap();
        let manager2 = EncryptionManager::from_password("password2", &params).unwrap();
        
        // 不同密码应该产生不同的密钥
        assert_ne!(manager1.master_key, manager2.master_key);
    }

    #[test]
    fn test_different_salts_different_keys() {
        let password = "same_password";
        
        let params1 = KeyDerivationParams {
            salt: generate_salt().unwrap(),
            ..Default::default()
        };
        
        let params2 = KeyDerivationParams {
            salt: generate_salt().unwrap(),
            ..Default::default()
        };
        
        let manager1 = EncryptionManager::from_password(password, &params1).unwrap();
        let manager2 = EncryptionManager::from_password(password, &params2).unwrap();
        
        // 不同盐值应该产生不同的密钥
        assert_ne!(manager1.master_key, manager2.master_key);
    }

    // ================================
    // 错误处理测试
    // ================================

    #[test]
    fn test_wrong_password_fails() {
        let password = "correct_password";
        let wrong_password = "wrong_password";
        let plaintext = "Secret data";
        
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let result = quick_decrypt(wrong_password, &encrypted, &params);
        
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::DecryptionFailed(_) => {},
            _ => panic!("期望DecryptionFailed错误"),
        }
    }

    #[test]
    fn test_corrupted_ciphertext_fails() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Test data";
        let mut encrypted = manager.encrypt_string(plaintext).unwrap();
        
        // 损坏密文
        encrypted.ciphertext = "corrupted_base64!@#$".to_string();
        
        let result = manager.decrypt_string(&encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_nonce_fails() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Test data";
        let mut encrypted = manager.encrypt_string(plaintext).unwrap();
        
        // 无效的nonce长度
        encrypted.nonce = general_purpose::STANDARD.encode(&vec![0u8; 8]); // 错误长度
        
        let result = manager.decrypt_string(&encrypted);
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::InvalidNonceLength => {},
            _ => panic!("期望InvalidNonceLength错误"),
        }
    }

    #[test]
    fn test_invalid_base64_nonce_fails() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Test data";
        let mut encrypted = manager.encrypt_string(plaintext).unwrap();
        
        // 无效的base64
        encrypted.nonce = "invalid_base64!@#$".to_string();
        
        let result = manager.decrypt_string(&encrypted);
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::Base64Error(_) => {},
            _ => panic!("期望Base64Error错误"),
        }
    }

    #[test]
    fn test_invalid_salt_base64_fails() {
        let password = "test_password";
        let params = KeyDerivationParams {
            salt: "invalid_base64!@#$".to_string(),
            ..Default::default()
        };
        
        let result = EncryptionManager::from_password(password, &params);
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::Base64Error(_) => {},
            _ => panic!("期望Base64Error错误"),
        }
    }

    #[test]
    fn test_non_utf8_decryption_fails() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        // 创建无效的UTF-8字节序列
        let invalid_utf8 = vec![0xFF, 0xFE, 0xFD];
        let encrypted = manager.encrypt(&invalid_utf8).unwrap();
        
        let result = manager.decrypt_string(&encrypted);
        assert!(result.is_err());
        match result.unwrap_err() {
            EncryptionError::DecryptionFailed(msg) => {
                assert!(msg.contains("UTF-8"));
            },
            _ => panic!("期望DecryptionFailed错误"),
        }
    }

    // ================================
    // 密钥派生参数测试
    // ================================

    #[test]
    fn test_key_derivation_params_default() {
        let params = KeyDerivationParams::default();
        
        assert!(params.salt.is_empty());
        assert_eq!(params.memory_cost, 65536);
        assert_eq!(params.time_cost, 3);
        assert_eq!(params.parallelism, 4);
    }

    #[test]
    fn test_custom_key_derivation_params() {
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt: salt.clone(),
            memory_cost: 32768,
            time_cost: 2,
            parallelism: 2,
        };
        
        let password = "test_password";
        let result = EncryptionManager::from_password(password, &params);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_extreme_key_derivation_params() {
        let salt = generate_salt().unwrap();
        
        // 最小参数
        let min_params = KeyDerivationParams {
            salt: salt.clone(),
            memory_cost: 8, // 8KB，最小值
            time_cost: 1,   // 最小值
            parallelism: 1, // 最小值
        };
        
        let result = EncryptionManager::from_password("password", &min_params);
        assert!(result.is_ok());
    }

    // ================================
    // 加密数据结构测试
    // ================================

    #[test]
    fn test_encrypted_data_serialization() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Test serialization";
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        
        // 测试序列化和反序列化
        let serialized = serde_json::to_string(&encrypted).unwrap();
        let deserialized: EncryptedData = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(encrypted.ciphertext, deserialized.ciphertext);
        assert_eq!(encrypted.nonce, deserialized.nonce);
        assert_eq!(encrypted.version, deserialized.version);
        assert_eq!(encrypted.timestamp, deserialized.timestamp);
        
        // 验证反序列化的数据可以正确解密
        let decrypted = manager.decrypt_string(&deserialized).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encrypted_data_clone() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Test cloning";
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let cloned = encrypted.clone();
        
        assert_eq!(encrypted.ciphertext, cloned.ciphertext);
        assert_eq!(encrypted.nonce, cloned.nonce);
        assert_eq!(encrypted.version, cloned.version);
        assert_eq!(encrypted.timestamp, cloned.timestamp);
        
        // 克隆的数据应该可以正确解密
        let decrypted = manager.decrypt_string(&cloned).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    // ================================
    // 重新加密测试
    // ================================

    #[test]
    fn test_reencryption() {
        let key1 = generate_random_key().unwrap();
        let key2 = generate_random_key().unwrap();
        
        let manager1 = EncryptionManager::new(key1);
        let manager2 = EncryptionManager::new(key2);
        
        let plaintext = "Test reencryption";
        let encrypted1 = manager1.encrypt_string(plaintext).unwrap();
        
        // 重新加密
        let encrypted2 = manager1.reencrypt(&encrypted1, &manager2).unwrap();
        
        // 原管理器无法解密新加密的数据
        assert!(manager1.decrypt_string(&encrypted2).is_err());
        
        // 新管理器可以解密
        let decrypted = manager2.decrypt_string(&encrypted2).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    // ================================
    // 随机数生成测试
    // ================================

    #[test]
    fn test_salt_generation_uniqueness() {
        let mut salts = std::collections::HashSet::new();
        
        // 生成多个盐值，验证唯一性
        for _ in 0..100 {
            let salt = generate_salt().unwrap();
            assert!(salts.insert(salt)); // 如果已存在会返回false
        }
    }

    #[test]
    fn test_random_key_generation_uniqueness() {
        let mut keys = std::collections::HashSet::new();
        
        // 生成多个密钥，验证唯一性
        for _ in 0..100 {
            let key = generate_random_key().unwrap();
            assert!(keys.insert(key.to_vec())); // 如果已存在会返回false
        }
    }

    #[test]
    fn test_random_password_generation() {
        let password = generate_random_password(32).unwrap();
        assert_eq!(password.len(), 32);
        
        // 验证字符集
        for c in password.chars() {
            assert!(c.is_ascii());
        }
    }

    #[test]
    fn test_random_password_different_lengths() {
        for length in [1, 8, 16, 32, 64, 128] {
            let password = generate_random_password(length).unwrap();
            assert_eq!(password.len(), length);
        }
    }

    #[test]
    fn test_random_password_uniqueness() {
        let mut passwords = std::collections::HashSet::new();
        
        for _ in 0..100 {
            let password = generate_random_password(16).unwrap();
            assert!(passwords.insert(password));
        }
    }

    // ================================
    // 安全性和边界条件测试
    // ================================

    #[test]
    fn test_nonce_uniqueness() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Same plaintext";
        let mut nonces = std::collections::HashSet::new();
        
        // 相同明文多次加密应该产生不同的nonce
        for _ in 0..100 {
            let encrypted = manager.encrypt_string(plaintext).unwrap();
            assert!(nonces.insert(encrypted.nonce));
        }
    }

    #[test]
    fn test_same_plaintext_different_ciphertexts() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Same plaintext";
        let mut ciphertexts = std::collections::HashSet::new();
        
        // 相同明文多次加密应该产生不同的密文
        for _ in 0..100 {
            let encrypted = manager.encrypt_string(plaintext).unwrap();
            assert!(ciphertexts.insert(encrypted.ciphertext));
        }
    }

    #[test]
    fn test_zero_length_password() {
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        
        // 空密码应该可以正常处理
        let result = EncryptionManager::from_password("", &params);
        assert!(result.is_ok());
    }

    #[test]
    fn test_very_long_password() {
        let long_password = "a".repeat(10000);
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        
        // 超长密码应该可以正常处理
        let result = EncryptionManager::from_password(&long_password, &params);
        assert!(result.is_ok());
    }

    #[test]
    fn test_unicode_password() {
        let unicode_password = "密码🔒测试📝";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            ..Default::default()
        };
        
        // Unicode密码应该可以正常处理
        let result = EncryptionManager::from_password(unicode_password, &params);
        assert!(result.is_ok());
    }

    #[test]
    fn test_unicode_plaintext() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let unicode_text = "你好世界🌍测试📝";
        let encrypted = manager.encrypt_string(unicode_text).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();
        
        assert_eq!(unicode_text, decrypted);
    }

    // ================================
    // 性能相关测试
    // ================================

    #[test]
    fn test_encryption_performance_baseline() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Performance test data";
        let start = std::time::Instant::now();
        
        // 执行多次加密/解密
        for _ in 0..1000 {
            let encrypted = manager.encrypt_string(plaintext).unwrap();
            let _decrypted = manager.decrypt_string(&encrypted).unwrap();
        }
        
        let duration = start.elapsed();
        
        // 确保性能在合理范围内（这里只是一个基准测试）
        assert!(duration < std::time::Duration::from_secs(10));
    }

    #[test]
    fn test_key_derivation_performance_baseline() {
        let password = "test_password";
        let salt = generate_salt().unwrap();
        let params = KeyDerivationParams {
            salt,
            memory_cost: 8192,  // 降低内存成本以加速测试
            time_cost: 1,       // 降低时间成本以加速测试
            parallelism: 1,     // 降低并行度以加速测试
        };
        
        let start = std::time::Instant::now();
        
        // 密钥派生应该在合理时间内完成
        let _manager = EncryptionManager::from_password(password, &params).unwrap();
        
        let duration = start.elapsed();
        
        // 密钥派生不应该太慢（即使是简化参数）
        assert!(duration < std::time::Duration::from_secs(5));
    }

    // ================================
    // 快速加密/解密辅助函数测试
    // ================================

    #[test]
    fn test_quick_encrypt_decrypt_consistency() {
        let password = "test_password";
        let plaintext = "Quick test data";
        
        let (encrypted1, params1) = quick_encrypt(password, plaintext).unwrap();
        let (encrypted2, params2) = quick_encrypt(password, plaintext).unwrap();
        
        // 相同密码和明文应该产生不同的盐值和加密结果
        assert_ne!(params1.salt, params2.salt);
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
        assert_ne!(encrypted1.nonce, encrypted2.nonce);
        
        // 但都应该能正确解密
        let decrypted1 = quick_decrypt(password, &encrypted1, &params1).unwrap();
        let decrypted2 = quick_decrypt(password, &encrypted2, &params2).unwrap();
        
        assert_eq!(plaintext, decrypted1);
        assert_eq!(plaintext, decrypted2);
    }

    #[test]
    fn test_quick_functions_error_handling() {
        let password = "test_password";
        let wrong_password = "wrong_password";
        let plaintext = "Test data";
        
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        
        // 错误密码应该失败
        let result = quick_decrypt(wrong_password, &encrypted, &params);
        assert!(result.is_err());
        
        // 错误参数应该失败
        let mut wrong_params = params.clone();
        wrong_params.salt = generate_salt().unwrap();
        
        let result = quick_decrypt(password, &encrypted, &wrong_params);
        assert!(result.is_err());
    }
}


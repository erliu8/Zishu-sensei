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

    #[test]
    fn test_encryption_decryption() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Hello, World!";
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_password_based_encryption() {
        let password = "my_secure_password";
        let plaintext = "Secret data";
        
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let decrypted = quick_decrypt(password, &encrypted, &params).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let password = "correct_password";
        let wrong_password = "wrong_password";
        let plaintext = "Secret data";
        
        let (encrypted, params) = quick_encrypt(password, plaintext).unwrap();
        let result = quick_decrypt(wrong_password, &encrypted, &params);
        
        assert!(result.is_err());
    }

    #[test]
    fn test_salt_generation() {
        let salt1 = generate_salt().unwrap();
        let salt2 = generate_salt().unwrap();
        
        assert_ne!(salt1, salt2);
        assert!(!salt1.is_empty());
    }

    #[test]
    fn test_random_password_generation() {
        let password = generate_random_password(32).unwrap();
        assert_eq!(password.len(), 32);
    }
}


// src-tauri/src/utils/key_manager.rs
//! 密钥管理模块
//! 
//! 使用系统密钥链安全存储和管理加密密钥

use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{error, info, warn};

use super::encryption::{
    generate_random_key, generate_salt, EncryptionError, EncryptionManager, KeyDerivationParams,
};

/// 密钥管理器错误类型
#[derive(Debug, thiserror::Error)]
pub enum KeyManagerError {
    #[error("密钥链操作失败: {0}")]
    KeyringError(String),
    
    #[error("密钥不存在")]
    KeyNotFound,
    
    #[error("密钥已存在")]
    KeyAlreadyExists,
    
    #[error("加密错误: {0}")]
    EncryptionError(#[from] EncryptionError),
    
    #[error("序列化错误: {0}")]
    SerializationError(String),
    
    #[error("密钥已过期")]
    KeyExpired,
    
    #[error("无效的密钥格式")]
    InvalidKeyFormat,
}

impl From<KeyringError> for KeyManagerError {
    fn from(err: KeyringError) -> Self {
        KeyManagerError::KeyringError(err.to_string())
    }
}

/// 存储的密钥信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredKeyInfo {
    /// 密钥 ID
    pub key_id: String,
    /// 加密的密钥数据（Base64）
    pub encrypted_key: String,
    /// 密钥派生参数
    pub derivation_params: KeyDerivationParams,
    /// 创建时间戳
    pub created_at: i64,
    /// 过期时间戳（可选）
    pub expires_at: Option<i64>,
    /// 密钥用途描述
    pub purpose: String,
    /// 密钥版本
    pub version: u32,
}

/// 密钥管理器
pub struct KeyManager {
    /// 应用名称（用于密钥链命名）
    app_name: String,
    /// 服务名称（用于密钥链命名）
    service_name: String,
    /// 当前激活的密钥
    active_keys: Arc<RwLock<std::collections::HashMap<String, EncryptionManager>>>,
}

impl KeyManager {
    /// 创建新的密钥管理器
    pub fn new(app_name: impl Into<String>, service_name: impl Into<String>) -> Self {
        Self {
            app_name: app_name.into(),
            service_name: service_name.into(),
            active_keys: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// 获取密钥链条目
    fn get_keyring_entry(&self, key_id: &str) -> Result<Entry, KeyManagerError> {
        let username = format!("{}_key_{}", self.app_name, key_id);
        Entry::new(&self.service_name, &username)
            .map_err(|e| KeyManagerError::KeyringError(e.to_string()))
    }

    /// 生成并存储新的主密钥
    pub fn generate_master_key(
        &self,
        key_id: &str,
        password: &str,
        purpose: &str,
        expires_in_days: Option<i64>,
    ) -> Result<StoredKeyInfo, KeyManagerError> {
        // 检查密钥是否已存在
        if self.key_exists(key_id)? {
            return Err(KeyManagerError::KeyAlreadyExists);
        }

        // 生成随机主密钥
        let master_key = generate_random_key()?;
        
        // 生成盐值用于密钥派生
        let salt = generate_salt()?;
        let derivation_params = KeyDerivationParams {
            salt,
            ..Default::default()
        };

        // 使用密码派生的密钥加密主密钥
        let password_manager = EncryptionManager::from_password(password, &derivation_params)?;
        let encrypted_key_data = password_manager.encrypt(&master_key)?;

        // 计算过期时间
        let created_at = chrono::Utc::now().timestamp();
        let expires_at = expires_in_days.map(|days| created_at + days * 86400);

        // 创建密钥信息
        let key_info = StoredKeyInfo {
            key_id: key_id.to_string(),
            encrypted_key: serde_json::to_string(&encrypted_key_data)
                .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?,
            derivation_params: derivation_params.clone(),
            created_at,
            expires_at,
            purpose: purpose.to_string(),
            version: 1,
        };

        // 序列化密钥信息
        let key_info_json = serde_json::to_string(&key_info)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;

        // 存储到系统密钥链
        let entry = self.get_keyring_entry(key_id)?;
        entry.set_password(&key_info_json)?;

        // 缓存加密管理器
        let manager = EncryptionManager::new(master_key);
        self.active_keys.write().insert(key_id.to_string(), manager);

        info!("成功生成并存储主密钥: {}", key_id);
        Ok(key_info)
    }

    /// 加载密钥
    pub fn load_key(&self, key_id: &str, password: &str) -> Result<(), KeyManagerError> {
        // 从密钥链读取
        let entry = self.get_keyring_entry(key_id)?;
        let key_info_json = entry.get_password()?;

        // 反序列化密钥信息
        let key_info: StoredKeyInfo = serde_json::from_str(&key_info_json)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;

        // 检查密钥是否过期
        if let Some(expires_at) = key_info.expires_at {
            if chrono::Utc::now().timestamp() > expires_at {
                warn!("密钥已过期: {}", key_id);
                return Err(KeyManagerError::KeyExpired);
            }
        }

        // 解密主密钥
        let encrypted_key_data = serde_json::from_str(&key_info.encrypted_key)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;

        let password_manager = EncryptionManager::from_password(password, &key_info.derivation_params)?;
        let master_key_bytes = password_manager.decrypt(&encrypted_key_data)?;

        if master_key_bytes.len() != 32 {
            return Err(KeyManagerError::InvalidKeyFormat);
        }

        let mut master_key = [0u8; 32];
        master_key.copy_from_slice(&master_key_bytes);

        // 缓存加密管理器
        let manager = EncryptionManager::new(master_key);
        self.active_keys.write().insert(key_id.to_string(), manager);

        info!("成功加载密钥: {}", key_id);
        Ok(())
    }

    /// 获取加密管理器
    pub fn get_manager(&self, key_id: &str) -> Result<EncryptionManager, KeyManagerError> {
        self.active_keys
            .read()
            .get(key_id)
            .cloned()
            .ok_or(KeyManagerError::KeyNotFound)
    }

    /// 轮换密钥（使用新密码重新加密主密钥）
    pub fn rotate_key(
        &self,
        key_id: &str,
        old_password: &str,
        new_password: &str,
    ) -> Result<StoredKeyInfo, KeyManagerError> {
        // 加载旧密钥
        self.load_key(key_id, old_password)?;
        let manager = self.get_manager(key_id)?;

        // 读取现有密钥信息
        let entry = self.get_keyring_entry(key_id)?;
        let key_info_json = entry.get_password()?;
        let mut key_info: StoredKeyInfo = serde_json::from_str(&key_info_json)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;

        // 获取原始主密钥
        let encrypted_key_data = serde_json::from_str(&key_info.encrypted_key)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;
        let old_password_manager = EncryptionManager::from_password(old_password, &key_info.derivation_params)?;
        let master_key_bytes = old_password_manager.decrypt(&encrypted_key_data)?;

        // 生成新的派生参数
        let new_salt = generate_salt()?;
        let new_derivation_params = KeyDerivationParams {
            salt: new_salt,
            ..Default::default()
        };

        // 使用新密码重新加密主密钥
        let new_password_manager = EncryptionManager::from_password(new_password, &new_derivation_params)?;
        let new_encrypted_key_data = new_password_manager.encrypt(&master_key_bytes)?;

        // 更新密钥信息
        key_info.encrypted_key = serde_json::to_string(&new_encrypted_key_data)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;
        key_info.derivation_params = new_derivation_params;
        key_info.version += 1;

        // 保存到密钥链
        let new_key_info_json = serde_json::to_string(&key_info)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;
        entry.set_password(&new_key_info_json)?;

        info!("成功轮换密钥: {}", key_id);
        Ok(key_info)
    }

    /// 删除密钥
    pub fn delete_key(&self, key_id: &str) -> Result<(), KeyManagerError> {
        let entry = self.get_keyring_entry(key_id)?;
        entry.delete_password()?;
        
        // 从缓存中移除
        self.active_keys.write().remove(key_id);

        info!("成功删除密钥: {}", key_id);
        Ok(())
    }

    /// 检查密钥是否存在
    pub fn key_exists(&self, key_id: &str) -> Result<bool, KeyManagerError> {
        let entry = self.get_keyring_entry(key_id)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(KeyringError::NoEntry) => Ok(false),
            Err(e) => Err(KeyManagerError::KeyringError(e.to_string())),
        }
    }

    /// 获取密钥信息（不包含敏感数据）
    pub fn get_key_info(&self, key_id: &str) -> Result<StoredKeyInfo, KeyManagerError> {
        let entry = self.get_keyring_entry(key_id)?;
        let key_info_json = entry.get_password()?;
        
        let key_info: StoredKeyInfo = serde_json::from_str(&key_info_json)
            .map_err(|e| KeyManagerError::SerializationError(e.to_string()))?;
        
        Ok(key_info)
    }

    /// 卸载密钥（从内存中移除）
    pub fn unload_key(&self, key_id: &str) {
        self.active_keys.write().remove(key_id);
        info!("已卸载密钥: {}", key_id);
    }

    /// 卸载所有密钥
    pub fn unload_all_keys(&self) {
        self.active_keys.write().clear();
        info!("已卸载所有密钥");
    }
}

/// 全局密钥管理器实例
lazy_static::lazy_static! {
    pub static ref GLOBAL_KEY_MANAGER: KeyManager = KeyManager::new("zishu-sensei", "zishu-sensei-keys");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation_and_loading() {
        let manager = KeyManager::new("test-app", "test-service");
        let key_id = "test-key-001";
        let password = "test_password_123";

        // 生成密钥
        let result = manager.generate_master_key(key_id, password, "测试密钥", None);
        assert!(result.is_ok());

        // 卸载密钥
        manager.unload_key(key_id);

        // 重新加载密钥
        let load_result = manager.load_key(key_id, password);
        assert!(load_result.is_ok());

        // 清理
        let _ = manager.delete_key(key_id);
    }

    #[test]
    fn test_key_rotation() {
        let manager = KeyManager::new("test-app", "test-service");
        let key_id = "test-key-002";
        let old_password = "old_password";
        let new_password = "new_password";

        // 生成密钥
        manager.generate_master_key(key_id, old_password, "测试密钥", None).unwrap();

        // 轮换密钥
        let rotate_result = manager.rotate_key(key_id, old_password, new_password);
        assert!(rotate_result.is_ok());

        // 验证新密码可以使用
        manager.unload_key(key_id);
        let load_result = manager.load_key(key_id, new_password);
        assert!(load_result.is_ok());

        // 验证旧密码不能使用
        manager.unload_key(key_id);
        let old_load_result = manager.load_key(key_id, old_password);
        assert!(old_load_result.is_err());

        // 清理
        let _ = manager.delete_key(key_id);
    }
}


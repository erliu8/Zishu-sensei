// src-tauri/src/commands/encryption.rs
//! 加密相关的 Tauri 命令

use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::PathBuf;
use parking_lot::Mutex;

use crate::utils::{
    encryption::{EncryptedData, KeyDerivationParams, quick_encrypt, quick_decrypt},
    key_manager::{KeyManager, StoredKeyInfo, GLOBAL_KEY_MANAGER},
    security_audit::{log_audit_success, log_audit_failure, AuditEventType, AuditEvent, AuditLevel, AuditEventFilter},
    data_masking::{quick_mask, MaskingStrategy, SensitiveDataType, DataMasker},
};

use crate::database::encrypted_storage::{EncryptedStorage, EncryptedFieldType};

/// 命令错误类型
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub message: String,
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(err: E) -> Self {
        CommandError {
            message: err.to_string(),
        }
    }
}

/// 加密请求
#[derive(Debug, Deserialize)]
pub struct EncryptRequest {
    pub password: String,
    pub plaintext: String,
}

/// 加密响应
#[derive(Debug, Serialize)]
pub struct EncryptResponse {
    pub encrypted_data: EncryptedData,
    pub derivation_params: KeyDerivationParams,
}

/// 解密请求
#[derive(Debug, Deserialize)]
pub struct DecryptRequest {
    pub password: String,
    pub encrypted_data: EncryptedData,
    pub derivation_params: KeyDerivationParams,
}

/// 密钥生成请求
#[derive(Debug, Deserialize)]
pub struct GenerateKeyRequest {
    pub key_id: String,
    pub password: String,
    pub purpose: String,
    pub expires_in_days: Option<i64>,
}

/// 密钥轮换请求
#[derive(Debug, Deserialize)]
pub struct RotateKeyRequest {
    pub key_id: String,
    pub old_password: String,
    pub new_password: String,
}

/// 加密字段存储请求
#[derive(Debug, Deserialize)]
pub struct StoreEncryptedFieldRequest {
    pub id: String,
    pub field_type: String,
    pub plaintext: String,
    pub entity_id: Option<String>,
    pub key_id: String,
    pub password: String,
}

/// 加密字段检索请求
#[derive(Debug, Deserialize)]
pub struct RetrieveEncryptedFieldRequest {
    pub id: String,
    pub key_id: String,
    pub password: String,
}

/// 脱敏请求
#[derive(Debug, Deserialize)]
pub struct MaskDataRequest {
    pub text: String,
    pub data_type: String,
}

/// 审计日志查询请求
#[derive(Debug, Deserialize)]
pub struct QueryAuditLogsRequest {
    pub event_type: Option<String>,
    pub level: Option<String>,
    pub resource_id: Option<String>,
    pub actor: Option<String>,
    pub success: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<usize>,
}

// ============ 加密命令 ============

/// 加密文本
#[tauri::command]
pub async fn encrypt_text(request: EncryptRequest) -> Result<EncryptResponse, CommandError> {
    let (encrypted_data, derivation_params) = quick_encrypt(&request.password, &request.plaintext)
        .map_err(|e| {
            log_audit_failure(
                AuditEventType::Encryption,
                "文本加密失败",
                &e.to_string(),
                None,
            );
            e
        })?;

    log_audit_success(
        AuditEventType::Encryption,
        "文本加密成功",
        None,
    );

    Ok(EncryptResponse {
        encrypted_data,
        derivation_params,
    })
}

/// 解密文本
#[tauri::command]
pub async fn decrypt_text(request: DecryptRequest) -> Result<String, CommandError> {
    let plaintext = quick_decrypt(
        &request.password,
        &request.encrypted_data,
        &request.derivation_params,
    )
    .map_err(|e| {
        log_audit_failure(
            AuditEventType::Decryption,
            "文本解密失败",
            &e.to_string(),
            None,
        );
        e
    })?;

    log_audit_success(
        AuditEventType::Decryption,
        "文本解密成功",
        None,
    );

    Ok(plaintext)
}

// ============ 密钥管理命令 ============

/// 生成主密钥
#[tauri::command]
pub async fn generate_master_key(request: GenerateKeyRequest) -> Result<StoredKeyInfo, CommandError> {
    let key_info = GLOBAL_KEY_MANAGER.generate_master_key(
        &request.key_id,
        &request.password,
        &request.purpose,
        request.expires_in_days,
    )
    .map_err(|e| {
        log_audit_failure(
            AuditEventType::KeyGeneration,
            &format!("生成主密钥失败: {}", request.key_id),
            &e.to_string(),
            Some(&request.key_id),
        );
        e
    })?;

    log_audit_success(
        AuditEventType::KeyGeneration,
        &format!("生成主密钥: {}", request.key_id),
        Some(&request.key_id),
    );

    Ok(key_info)
}

/// 加载密钥
#[tauri::command]
pub async fn load_key(key_id: String, password: String) -> Result<(), CommandError> {
    GLOBAL_KEY_MANAGER.load_key(&key_id, &password)
        .map_err(|e| {
            log_audit_failure(
                AuditEventType::KeyLoading,
                &format!("加载密钥失败: {}", key_id),
                &e.to_string(),
                Some(&key_id),
            );
            e
        })?;

    log_audit_success(
        AuditEventType::KeyLoading,
        &format!("加载密钥: {}", key_id),
        Some(&key_id),
    );

    Ok(())
}

/// 轮换密钥
#[tauri::command]
pub async fn rotate_key(request: RotateKeyRequest) -> Result<StoredKeyInfo, CommandError> {
    let key_info = GLOBAL_KEY_MANAGER.rotate_key(
        &request.key_id,
        &request.old_password,
        &request.new_password,
    )
    .map_err(|e| {
        log_audit_failure(
            AuditEventType::KeyRotation,
            &format!("轮换密钥失败: {}", request.key_id),
            &e.to_string(),
            Some(&request.key_id),
        );
        e
    })?;

    log_audit_success(
        AuditEventType::KeyRotation,
        &format!("轮换密钥: {}", request.key_id),
        Some(&request.key_id),
    );

    Ok(key_info)
}

/// 删除密钥
#[tauri::command]
pub async fn delete_key(key_id: String) -> Result<(), CommandError> {
    GLOBAL_KEY_MANAGER.delete_key(&key_id)
        .map_err(|e| {
            log_audit_failure(
                AuditEventType::KeyDeletion,
                &format!("删除密钥失败: {}", key_id),
                &e.to_string(),
                Some(&key_id),
            );
            e
        })?;

    log_audit_success(
        AuditEventType::KeyDeletion,
        &format!("删除密钥: {}", key_id),
        Some(&key_id),
    );

    Ok(())
}

/// 检查密钥是否存在
#[tauri::command]
pub async fn key_exists(key_id: String) -> Result<bool, CommandError> {
    Ok(GLOBAL_KEY_MANAGER.key_exists(&key_id)?)
}

/// 获取密钥信息
#[tauri::command]
pub async fn get_key_info(key_id: String) -> Result<StoredKeyInfo, CommandError> {
    Ok(GLOBAL_KEY_MANAGER.get_key_info(&key_id)?)
}

/// 卸载密钥（从内存中移除）
#[tauri::command]
pub async fn unload_key(key_id: String) -> Result<(), CommandError> {
    GLOBAL_KEY_MANAGER.unload_key(&key_id);
    Ok(())
}

// ============ 加密存储命令 ============

/// 存储加密字段
#[tauri::command]
pub async fn store_encrypted_field(
    request: StoreEncryptedFieldRequest,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    // 获取存储路径
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let storage_path = app_data_dir.join("encrypted_storage.db");
    let storage = EncryptedStorage::new(&storage_path)?;

    // 加载密钥
    GLOBAL_KEY_MANAGER.load_key(&request.key_id, &request.password)?;
    let manager = GLOBAL_KEY_MANAGER.get_manager(&request.key_id)?;

    // 解析字段类型
    let field_type = match request.field_type.as_str() {
        "api_key" => EncryptedFieldType::ApiKey,
        "password" => EncryptedFieldType::Password,
        "token" => EncryptedFieldType::Token,
        "sensitive_config" => EncryptedFieldType::SensitiveConfig,
        "personal_info" => EncryptedFieldType::PersonalInfo,
        custom => EncryptedFieldType::Custom(custom.to_string()),
    };

    storage.store(
        &request.id,
        field_type,
        &request.plaintext,
        request.entity_id.as_deref(),
        &manager,
    )?;

    log_audit_success(
        AuditEventType::SensitiveDataAccess,
        &format!("存储加密字段: {}", request.id),
        Some(&request.id),
    );

    Ok(())
}

/// 检索加密字段
#[tauri::command]
pub async fn retrieve_encrypted_field(
    request: RetrieveEncryptedFieldRequest,
    app_handle: tauri::AppHandle,
) -> Result<String, CommandError> {
    // 获取存储路径
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let storage_path = app_data_dir.join("encrypted_storage.db");
    let storage = EncryptedStorage::new(&storage_path)?;

    // 加载密钥
    GLOBAL_KEY_MANAGER.load_key(&request.key_id, &request.password)?;
    let manager = GLOBAL_KEY_MANAGER.get_manager(&request.key_id)?;

    let plaintext = storage.retrieve(&request.id, &manager)?;

    log_audit_success(
        AuditEventType::SensitiveDataAccess,
        &format!("检索加密字段: {}", request.id),
        Some(&request.id),
    );

    Ok(plaintext)
}

/// 删除加密字段
#[tauri::command]
pub async fn delete_encrypted_field(
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let storage_path = app_data_dir.join("encrypted_storage.db");
    let storage = EncryptedStorage::new(&storage_path)?;

    storage.delete(&id)?;

    log_audit_success(
        AuditEventType::SensitiveDataAccess,
        &format!("删除加密字段: {}", id),
        Some(&id),
    );

    Ok(())
}

// ============ 数据脱敏命令 ============

/// 脱敏敏感数据
#[tauri::command]
pub async fn mask_sensitive_data(request: MaskDataRequest) -> Result<String, CommandError> {
    let data_type = match request.data_type.as_str() {
        "api_key" => SensitiveDataType::ApiKey,
        "password" => SensitiveDataType::Password,
        "token" => SensitiveDataType::Token,
        "email" => SensitiveDataType::Email,
        "phone" => SensitiveDataType::PhoneNumber,
        "id_card" => SensitiveDataType::IdCard,
        "credit_card" => SensitiveDataType::CreditCard,
        "ip_address" => SensitiveDataType::IpAddress,
        custom => SensitiveDataType::Custom(custom.to_string()),
    };

    Ok(quick_mask(&request.text, data_type))
}

/// 自动检测并脱敏所有敏感信息
#[tauri::command]
pub async fn mask_all_sensitive(text: String) -> Result<String, CommandError> {
    let masker = DataMasker::new();
    Ok(masker.mask_all_sensitive(&text))
}

// ============ 审计日志命令 ============

/// 查询审计日志
#[tauri::command]
pub async fn query_audit_logs(
    request: QueryAuditLogsRequest,
    app_handle: tauri::AppHandle,
) -> Result<Vec<AuditEvent>, CommandError> {
    use crate::utils::security_audit::{SecurityAuditLogger, AuditEventType as AET, AuditLevel as AL};

    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let audit_db_path = app_data_dir.join("security_audit.db");
    let logger = SecurityAuditLogger::new(&audit_db_path)
        .map_err(|e| CommandError { message: e.to_string() })?;

    let event_type = request.event_type.and_then(|t| match t.as_str() {
        "encryption" => Some(AET::Encryption),
        "decryption" => Some(AET::Decryption),
        "key_generation" => Some(AET::KeyGeneration),
        "key_loading" => Some(AET::KeyLoading),
        "key_rotation" => Some(AET::KeyRotation),
        "key_deletion" => Some(AET::KeyDeletion),
        "sensitive_data_access" => Some(AET::SensitiveDataAccess),
        _ => None,
    });

    let level = request.level.and_then(|l| match l.as_str() {
        "debug" => Some(AL::Debug),
        "info" => Some(AL::Info),
        "warning" => Some(AL::Warning),
        "error" => Some(AL::Error),
        "critical" => Some(AL::Critical),
        _ => None,
    });

    let filter = AuditEventFilter {
        event_type,
        level,
        resource_id: request.resource_id,
        actor: request.actor,
        success: request.success,
        start_time: request.start_time,
        end_time: request.end_time,
        limit: request.limit,
    };

    let events = logger.query_events(&filter)
        .map_err(|e| CommandError { message: e.to_string() })?;

    Ok(events)
}

/// 清理旧的审计日志
#[tauri::command]
pub async fn cleanup_audit_logs(
    days: i64,
    app_handle: tauri::AppHandle,
) -> Result<usize, CommandError> {
    use crate::utils::security_audit::SecurityAuditLogger;

    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let audit_db_path = app_data_dir.join("security_audit.db");
    let logger = SecurityAuditLogger::new(&audit_db_path)
        .map_err(|e| CommandError { message: e.to_string() })?;

    let count = logger.cleanup_old_logs(days)
        .map_err(|e| CommandError { message: e.to_string() })?;

    Ok(count)
}

/// 获取审计日志统计
#[tauri::command]
pub async fn get_audit_statistics(
    app_handle: tauri::AppHandle,
) -> Result<crate::utils::security_audit::AuditStatistics, CommandError> {
    use crate::utils::security_audit::SecurityAuditLogger;

    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let audit_db_path = app_data_dir.join("security_audit.db");
    let logger = SecurityAuditLogger::new(&audit_db_path)
        .map_err(|e| CommandError { message: e.to_string() })?;

    let stats = logger.get_statistics()
        .map_err(|e| CommandError { message: e.to_string() })?;

    Ok(stats)
}


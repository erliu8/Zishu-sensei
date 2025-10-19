// src/types/encryption.ts
/**
 * 加密系统类型定义
 */

/**
 * 加密数据结构
 */
export interface EncryptedData {
  /** Base64 编码的密文 */
  ciphertext: string;
  /** Base64 编码的 nonce */
  nonce: string;
  /** 加密算法版本 */
  version: number;
  /** 加密时间戳 */
  timestamp: number;
}

/**
 * 密钥派生参数
 */
export interface KeyDerivationParams {
  /** 盐值（Base64 编码） */
  salt: string;
  /** Argon2 内存消耗（KB） */
  memory_cost: number;
  /** Argon2 时间消耗（迭代次数） */
  time_cost: number;
  /** Argon2 并行度 */
  parallelism: number;
}

/**
 * 存储的密钥信息
 */
export interface StoredKeyInfo {
  /** 密钥 ID */
  key_id: string;
  /** 加密的密钥数据（Base64） */
  encrypted_key: string;
  /** 密钥派生参数 */
  derivation_params: KeyDerivationParams;
  /** 创建时间戳 */
  created_at: number;
  /** 过期时间戳（可选） */
  expires_at?: number;
  /** 密钥用途描述 */
  purpose: string;
  /** 密钥版本 */
  version: number;
}

/**
 * 加密请求
 */
export interface EncryptRequest {
  /** 密码 */
  password: string;
  /** 明文 */
  plaintext: string;
}

/**
 * 加密响应
 */
export interface EncryptResponse {
  /** 加密数据 */
  encrypted_data: EncryptedData;
  /** 派生参数 */
  derivation_params: KeyDerivationParams;
}

/**
 * 解密请求
 */
export interface DecryptRequest {
  /** 密码 */
  password: string;
  /** 加密数据 */
  encrypted_data: EncryptedData;
  /** 派生参数 */
  derivation_params: KeyDerivationParams;
}

/**
 * 密钥生成请求
 */
export interface GenerateKeyRequest {
  /** 密钥 ID */
  key_id: string;
  /** 密码 */
  password: string;
  /** 用途描述 */
  purpose: string;
  /** 过期天数（可选） */
  expires_in_days?: number;
}

/**
 * 密钥轮换请求
 */
export interface RotateKeyRequest {
  /** 密钥 ID */
  key_id: string;
  /** 旧密码 */
  old_password: string;
  /** 新密码 */
  new_password: string;
}

/**
 * 加密字段存储请求
 */
export interface StoreEncryptedFieldRequest {
  /** 字段 ID */
  id: string;
  /** 字段类型 */
  field_type: EncryptedFieldType;
  /** 明文 */
  plaintext: string;
  /** 关联实体 ID（可选） */
  entity_id?: string;
  /** 密钥 ID */
  key_id: string;
  /** 密码 */
  password: string;
}

/**
 * 加密字段检索请求
 */
export interface RetrieveEncryptedFieldRequest {
  /** 字段 ID */
  id: string;
  /** 密钥 ID */
  key_id: string;
  /** 密码 */
  password: string;
}

/**
 * 加密字段类型
 */
export type EncryptedFieldType =
  | 'api_key'
  | 'password'
  | 'token'
  | 'sensitive_config'
  | 'personal_info'
  | string;

/**
 * 脱敏策略
 */
export type MaskingStrategy =
  | { type: 'full' }
  | { type: 'partial'; prefix: number; suffix: number }
  | { type: 'prefix_only'; length: number }
  | { type: 'suffix_only'; length: number }
  | { type: 'middle_hidden'; show: number }
  | { type: 'hash' };

/**
 * 敏感数据类型
 */
export type SensitiveDataType =
  | 'api_key'
  | 'password'
  | 'token'
  | 'email'
  | 'phone'
  | 'id_card'
  | 'credit_card'
  | 'ip_address'
  | string;

/**
 * 脱敏请求
 */
export interface MaskDataRequest {
  /** 文本 */
  text: string;
  /** 数据类型 */
  data_type: SensitiveDataType;
}

/**
 * 审计事件类型
 */
export type AuditEventType =
  | 'encryption'
  | 'decryption'
  | 'key_generation'
  | 'key_loading'
  | 'key_rotation'
  | 'key_deletion'
  | 'sensitive_data_access'
  | 'authentication_attempt'
  | 'authorization_check'
  | 'configuration_change'
  | 'data_export'
  | 'data_import'
  | 'permission_change'
  | 'security_error';

/**
 * 审计事件级别
 */
export type AuditLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * 审计事件
 */
export interface AuditEvent {
  /** 事件 ID */
  id: string;
  /** 事件类型 */
  event_type: AuditEventType;
  /** 事件级别 */
  level: AuditLevel;
  /** 事件描述 */
  description: string;
  /** 相关资源 ID */
  resource_id?: string;
  /** 操作执行者 */
  actor?: string;
  /** 客户端 IP */
  client_ip?: string;
  /** 额外元数据（JSON） */
  metadata?: string;
  /** 操作是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error_message?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 审计日志查询请求
 */
export interface QueryAuditLogsRequest {
  /** 事件类型 */
  event_type?: AuditEventType;
  /** 事件级别 */
  level?: AuditLevel;
  /** 资源 ID */
  resource_id?: string;
  /** 操作者 */
  actor?: string;
  /** 是否成功 */
  success?: boolean;
  /** 开始时间 */
  start_time?: number;
  /** 结束时间 */
  end_time?: number;
  /** 限制数量 */
  limit?: number;
}

/**
 * 审计统计信息
 */
export interface AuditStatistics {
  /** 总事件数 */
  total_events: number;
  /** 失败事件数 */
  failed_events: number;
  /** 严重事件数 */
  critical_events: number;
}

/**
 * 加密错误
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * 密钥管理错误
 */
export class KeyManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyManagerError';
  }
}


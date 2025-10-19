// src/services/encryptionService.ts
/**
 * 加密服务
 * 提供完整的数据加密、密钥管理、审计日志等功能
 */

import { invoke } from '@tauri-apps/api/tauri';
import type {
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  GenerateKeyRequest,
  RotateKeyRequest,
  StoredKeyInfo,
  StoreEncryptedFieldRequest,
  RetrieveEncryptedFieldRequest,
  MaskDataRequest,
  QueryAuditLogsRequest,
  AuditEvent,
  AuditStatistics,
  EncryptedData,
  KeyDerivationParams,
} from '../types/encryption';

/**
 * 加密服务类
 */
class EncryptionService {
  // ============ 文本加密/解密 ============

  /**
   * 加密文本
   */
  async encryptText(request: EncryptRequest): Promise<EncryptResponse> {
    try {
      return await invoke<EncryptResponse>('encrypt_text', { request });
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error(`加密失败: ${error}`);
    }
  }

  /**
   * 解密文本
   */
  async decryptText(request: DecryptRequest): Promise<string> {
    try {
      return await invoke<string>('decrypt_text', { request });
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error(`解密失败: ${error}`);
    }
  }

  /**
   * 快速加密（简化接口）
   */
  async quickEncrypt(password: string, plaintext: string): Promise<EncryptResponse> {
    return this.encryptText({ password, plaintext });
  }

  /**
   * 快速解密（简化接口）
   */
  async quickDecrypt(
    password: string,
    encryptedData: EncryptedData,
    derivationParams: KeyDerivationParams
  ): Promise<string> {
    return this.decryptText({
      password,
      encrypted_data: encryptedData,
      derivation_params: derivationParams,
    });
  }

  // ============ 密钥管理 ============

  /**
   * 生成主密钥
   */
  async generateMasterKey(request: GenerateKeyRequest): Promise<StoredKeyInfo> {
    try {
      return await invoke<StoredKeyInfo>('generate_master_key', { request });
    } catch (error) {
      console.error('生成主密钥失败:', error);
      throw new Error(`生成主密钥失败: ${error}`);
    }
  }

  /**
   * 加载密钥
   */
  async loadKey(keyId: string, password: string): Promise<void> {
    try {
      await invoke('load_key', { keyId, password });
    } catch (error) {
      console.error('加载密钥失败:', error);
      throw new Error(`加载密钥失败: ${error}`);
    }
  }

  /**
   * 轮换密钥
   */
  async rotateKey(request: RotateKeyRequest): Promise<StoredKeyInfo> {
    try {
      return await invoke<StoredKeyInfo>('rotate_key', { request });
    } catch (error) {
      console.error('轮换密钥失败:', error);
      throw new Error(`轮换密钥失败: ${error}`);
    }
  }

  /**
   * 删除密钥
   */
  async deleteKey(keyId: string): Promise<void> {
    try {
      await invoke('delete_key', { keyId });
    } catch (error) {
      console.error('删除密钥失败:', error);
      throw new Error(`删除密钥失败: ${error}`);
    }
  }

  /**
   * 检查密钥是否存在
   */
  async keyExists(keyId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('key_exists', { keyId });
    } catch (error) {
      console.error('检查密钥失败:', error);
      return false;
    }
  }

  /**
   * 获取密钥信息
   */
  async getKeyInfo(keyId: string): Promise<StoredKeyInfo> {
    try {
      return await invoke<StoredKeyInfo>('get_key_info', { keyId });
    } catch (error) {
      console.error('获取密钥信息失败:', error);
      throw new Error(`获取密钥信息失败: ${error}`);
    }
  }

  /**
   * 卸载密钥（从内存中移除）
   */
  async unloadKey(keyId: string): Promise<void> {
    try {
      await invoke('unload_key', { keyId });
    } catch (error) {
      console.error('卸载密钥失败:', error);
      throw new Error(`卸载密钥失败: ${error}`);
    }
  }

  // ============ 加密字段存储 ============

  /**
   * 存储加密字段
   */
  async storeEncryptedField(request: StoreEncryptedFieldRequest): Promise<void> {
    try {
      await invoke('store_encrypted_field', { request });
    } catch (error) {
      console.error('存储加密字段失败:', error);
      throw new Error(`存储加密字段失败: ${error}`);
    }
  }

  /**
   * 检索加密字段
   */
  async retrieveEncryptedField(request: RetrieveEncryptedFieldRequest): Promise<string> {
    try {
      return await invoke<string>('retrieve_encrypted_field', { request });
    } catch (error) {
      console.error('检索加密字段失败:', error);
      throw new Error(`检索加密字段失败: ${error}`);
    }
  }

  /**
   * 删除加密字段
   */
  async deleteEncryptedField(id: string): Promise<void> {
    try {
      await invoke('delete_encrypted_field', { id });
    } catch (error) {
      console.error('删除加密字段失败:', error);
      throw new Error(`删除加密字段失败: ${error}`);
    }
  }

  // ============ 数据脱敏 ============

  /**
   * 脱敏敏感数据
   */
  async maskSensitiveData(request: MaskDataRequest): Promise<string> {
    try {
      return await invoke<string>('mask_sensitive_data', { request });
    } catch (error) {
      console.error('脱敏失败:', error);
      throw new Error(`脱敏失败: ${error}`);
    }
  }

  /**
   * 自动检测并脱敏所有敏感信息
   */
  async maskAllSensitive(text: string): Promise<string> {
    try {
      return await invoke<string>('mask_all_sensitive', { text });
    } catch (error) {
      console.error('自动脱敏失败:', error);
      throw new Error(`自动脱敏失败: ${error}`);
    }
  }

  /**
   * 脱敏 API 密钥
   */
  async maskApiKey(apiKey: string): Promise<string> {
    return this.maskSensitiveData({ text: apiKey, data_type: 'api_key' });
  }

  /**
   * 脱敏密码
   */
  async maskPassword(password: string): Promise<string> {
    return this.maskSensitiveData({ text: password, data_type: 'password' });
  }

  /**
   * 脱敏 Token
   */
  async maskToken(token: string): Promise<string> {
    return this.maskSensitiveData({ text: token, data_type: 'token' });
  }

  /**
   * 脱敏电子邮件
   */
  async maskEmail(email: string): Promise<string> {
    return this.maskSensitiveData({ text: email, data_type: 'email' });
  }

  /**
   * 脱敏电话号码
   */
  async maskPhone(phone: string): Promise<string> {
    return this.maskSensitiveData({ text: phone, data_type: 'phone' });
  }

  // ============ 审计日志 ============

  /**
   * 查询审计日志
   */
  async queryAuditLogs(request: QueryAuditLogsRequest): Promise<AuditEvent[]> {
    try {
      return await invoke<AuditEvent[]>('query_audit_logs', { request });
    } catch (error) {
      console.error('查询审计日志失败:', error);
      throw new Error(`查询审计日志失败: ${error}`);
    }
  }

  /**
   * 清理旧的审计日志
   */
  async cleanupAuditLogs(days: number): Promise<number> {
    try {
      return await invoke<number>('cleanup_audit_logs', { days });
    } catch (error) {
      console.error('清理审计日志失败:', error);
      throw new Error(`清理审计日志失败: ${error}`);
    }
  }

  /**
   * 获取审计日志统计
   */
  async getAuditStatistics(): Promise<AuditStatistics> {
    try {
      return await invoke<AuditStatistics>('get_audit_statistics');
    } catch (error) {
      console.error('获取审计统计失败:', error);
      throw new Error(`获取审计统计失败: ${error}`);
    }
  }

  /**
   * 获取最近的审计日志（快捷方法）
   */
  async getRecentAuditLogs(limit: number = 100): Promise<AuditEvent[]> {
    return this.queryAuditLogs({ limit });
  }

  /**
   * 获取失败的审计日志
   */
  async getFailedAuditLogs(limit: number = 100): Promise<AuditEvent[]> {
    return this.queryAuditLogs({ success: false, limit });
  }

  /**
   * 获取严重审计日志
   */
  async getCriticalAuditLogs(limit: number = 100): Promise<AuditEvent[]> {
    return this.queryAuditLogs({ level: 'critical', limit });
  }

  // ============ 辅助方法 ============

  /**
   * 生成强随机密码
   */
  generateStrongPassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    return password;
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password: string): {
    isStrong: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // 长度检查
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    else feedback.push('密码长度至少应为 12 个字符');

    // 复杂度检查
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('应包含小写字母');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('应包含大写字母');

    if (/\d/.test(password)) score += 1;
    else feedback.push('应包含数字');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('应包含特殊字符');

    return {
      isStrong: score >= 5,
      score: Math.min(score, 7),
      feedback,
    };
  }

  /**
   * 检查密钥是否过期
   */
  isKeyExpired(keyInfo: StoredKeyInfo): boolean {
    if (!keyInfo.expires_at) {
      return false;
    }
    return Date.now() / 1000 > keyInfo.expires_at;
  }

  /**
   * 计算密钥剩余有效期（天数）
   */
  getKeyRemainingDays(keyInfo: StoredKeyInfo): number | null {
    if (!keyInfo.expires_at) {
      return null;
    }
    const remaining = keyInfo.expires_at - Date.now() / 1000;
    return Math.max(0, Math.floor(remaining / 86400));
  }
}

// 导出单例实例
export const encryptionService = new EncryptionService();
export default encryptionService;


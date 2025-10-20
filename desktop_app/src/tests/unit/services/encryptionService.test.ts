/**
 * 加密服务测试
 * 
 * 测试 EncryptionService 的所有加密、解密、密钥管理功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { encryptionService } from '../../../services/encryptionService';
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
  EncryptedData,
  KeyDerivationParams,
} from '../../../types/encryption';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('EncryptionService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  // 辅助函数
  const createMockEncryptedData = (): EncryptedData => ({
    ciphertext: 'bW9ja19jaXBoZXJ0ZXh0', // Base64
    nonce: 'bW9ja19ub25jZQ==',
    version: 1,
    timestamp: Date.now(),
  });

  const createMockDerivationParams = (): KeyDerivationParams => ({
    salt: 'bW9ja19zYWx0',
    memory_cost: 65536,
    time_cost: 3,
    parallelism: 4,
  });

  const createMockKeyInfo = (): StoredKeyInfo => ({
    key_id: 'test-key',
    encrypted_key: 'bW9ja19lbmNyeXB0ZWRfa2V5',
    derivation_params: createMockDerivationParams(),
    created_at: Date.now() / 1000,
    purpose: 'test',
    version: 1,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================
  // 文本加密/解密测试
  // ================================
  describe('Text Encryption/Decryption', () => {
    describe('encryptText', () => {
      it('应该成功加密文本', async () => {
        const request: EncryptRequest = {
          password: 'test-password',
          plaintext: 'Hello, World!',
        };

        const mockResponse: EncryptResponse = {
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockResolvedValue(mockResponse);

        const result = await encryptionService.encryptText(request);

        expect(mockInvoke).toHaveBeenCalledWith('encrypt_text', { request });
        expect(result).toEqual(mockResponse);
        expect(result.encrypted_data.ciphertext).toBeTruthy();
        expect(result.encrypted_data.nonce).toBeTruthy();
      });

      it('应该处理加密失败', async () => {
        const request: EncryptRequest = {
          password: 'test-password',
          plaintext: 'Hello',
        };

        mockInvoke.mockRejectedValue(new Error('Encryption failed'));

        await expect(encryptionService.encryptText(request)).rejects.toThrow(
          '加密失败'
        );
      });

      it('应该处理空文本', async () => {
        const request: EncryptRequest = {
          password: 'password',
          plaintext: '',
        };

        const mockResponse: EncryptResponse = {
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockResolvedValue(mockResponse);

        const result = await encryptionService.encryptText(request);

        expect(result).toBeDefined();
      });

      it('应该处理长文本', async () => {
        const longText = 'a'.repeat(10000);
        const request: EncryptRequest = {
          password: 'password',
          plaintext: longText,
        };

        const mockResponse: EncryptResponse = {
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockResolvedValue(mockResponse);

        const result = await encryptionService.encryptText(request);

        expect(result).toBeDefined();
      });
    });

    describe('decryptText', () => {
      it('应该成功解密文本', async () => {
        const request: DecryptRequest = {
          password: 'test-password',
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        const plaintext = 'Decrypted text';
        mockInvoke.mockResolvedValue(plaintext);

        const result = await encryptionService.decryptText(request);

        expect(mockInvoke).toHaveBeenCalledWith('decrypt_text', { request });
        expect(result).toBe(plaintext);
      });

      it('应该处理错误的密码', async () => {
        const request: DecryptRequest = {
          password: 'wrong-password',
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockRejectedValue(new Error('Decryption failed'));

        await expect(encryptionService.decryptText(request)).rejects.toThrow(
          '解密失败'
        );
      });

      it('应该处理损坏的数据', async () => {
        const request: DecryptRequest = {
          password: 'password',
          encrypted_data: {
            ...createMockEncryptedData(),
            ciphertext: 'invalid!!!',
          },
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockRejectedValue(new Error('Invalid ciphertext'));

        await expect(encryptionService.decryptText(request)).rejects.toThrow();
      });
    });

    describe('Quick Methods', () => {
      it('quickEncrypt 应该成功加密', async () => {
        const mockResponse: EncryptResponse = {
          encrypted_data: createMockEncryptedData(),
          derivation_params: createMockDerivationParams(),
        };

        mockInvoke.mockResolvedValue(mockResponse);

        const result = await encryptionService.quickEncrypt(
          'password',
          'Hello'
        );

        expect(result).toEqual(mockResponse);
      });

      it('quickDecrypt 应该成功解密', async () => {
        const plaintext = 'Hello';
        mockInvoke.mockResolvedValue(plaintext);

        const result = await encryptionService.quickDecrypt(
          'password',
          createMockEncryptedData(),
          createMockDerivationParams()
        );

        expect(result).toBe(plaintext);
      });
    });
  });

  // ================================
  // 密钥管理测试
  // ================================
  describe('Key Management', () => {
    describe('generateMasterKey', () => {
      it('应该成功生成主密钥', async () => {
        const request: GenerateKeyRequest = {
          key_id: 'master-key',
          password: 'strong-password',
          purpose: 'master',
          expires_in_days: 365,
        };

        const mockKeyInfo = createMockKeyInfo();
        mockInvoke.mockResolvedValue(mockKeyInfo);

        const result = await encryptionService.generateMasterKey(request);

        expect(mockInvoke).toHaveBeenCalledWith('generate_master_key', {
          request,
        });
        expect(result).toEqual(mockKeyInfo);
      });

      it('应该处理生成失败', async () => {
        const request: GenerateKeyRequest = {
          key_id: 'test-key',
          password: 'password',
          purpose: 'test',
        };

        mockInvoke.mockRejectedValue(new Error('Key generation failed'));

        await expect(
          encryptionService.generateMasterKey(request)
        ).rejects.toThrow('生成主密钥失败');
      });
    });

    describe('loadKey', () => {
      it('应该成功加载密钥', async () => {
        mockInvoke.mockResolvedValue(undefined);

        await encryptionService.loadKey('test-key', 'password');

        expect(mockInvoke).toHaveBeenCalledWith('load_key', {
          keyId: 'test-key',
          password: 'password',
        });
      });

      it('应该处理加载失败', async () => {
        mockInvoke.mockRejectedValue(new Error('Key not found'));

        await expect(
          encryptionService.loadKey('nonexistent', 'password')
        ).rejects.toThrow('加载密钥失败');
      });
    });

    describe('rotateKey', () => {
      it('应该成功轮换密钥', async () => {
        const request: RotateKeyRequest = {
          old_key_id: 'old-key',
          new_key_id: 'new-key',
          password: 'password',
          purpose: 'rotated',
        };

        const mockNewKeyInfo = createMockKeyInfo();
        mockInvoke.mockResolvedValue(mockNewKeyInfo);

        const result = await encryptionService.rotateKey(request);

        expect(mockInvoke).toHaveBeenCalledWith('rotate_key', { request });
        expect(result).toEqual(mockNewKeyInfo);
      });

      it('应该处理轮换失败', async () => {
        const request: RotateKeyRequest = {
          old_key_id: 'old-key',
          new_key_id: 'new-key',
          password: 'password',
          purpose: 'test',
        };

        mockInvoke.mockRejectedValue(new Error('Rotation failed'));

        await expect(encryptionService.rotateKey(request)).rejects.toThrow(
          '轮换密钥失败'
        );
      });
    });

    describe('deleteKey', () => {
      it('应该成功删除密钥', async () => {
        mockInvoke.mockResolvedValue(undefined);

        await encryptionService.deleteKey('test-key');

        expect(mockInvoke).toHaveBeenCalledWith('delete_key', {
          keyId: 'test-key',
        });
      });

      it('应该处理删除失败', async () => {
        mockInvoke.mockRejectedValue(new Error('Delete failed'));

        await expect(encryptionService.deleteKey('test-key')).rejects.toThrow(
          '删除密钥失败'
        );
      });
    });

    describe('keyExists', () => {
      it('应该检测已存在的密钥', async () => {
        mockInvoke.mockResolvedValue(true);

        const result = await encryptionService.keyExists('test-key');

        expect(mockInvoke).toHaveBeenCalledWith('key_exists', {
          keyId: 'test-key',
        });
        expect(result).toBe(true);
      });

      it('应该检测不存在的密钥', async () => {
        mockInvoke.mockResolvedValue(false);

        const result = await encryptionService.keyExists('nonexistent');

        expect(result).toBe(false);
      });

      it('应该处理检查错误', async () => {
        mockInvoke.mockRejectedValue(new Error('Check failed'));

        const result = await encryptionService.keyExists('test-key');

        expect(result).toBe(false);
      });
    });

    describe('getKeyInfo', () => {
      it('应该成功获取密钥信息', async () => {
        const mockKeyInfo = createMockKeyInfo();
        mockInvoke.mockResolvedValue(mockKeyInfo);

        const result = await encryptionService.getKeyInfo('test-key');

        expect(mockInvoke).toHaveBeenCalledWith('get_key_info', {
          keyId: 'test-key',
        });
        expect(result).toEqual(mockKeyInfo);
      });
    });

    describe('unloadKey', () => {
      it('应该成功卸载密钥', async () => {
        mockInvoke.mockResolvedValue(undefined);

        await encryptionService.unloadKey('test-key');

        expect(mockInvoke).toHaveBeenCalledWith('unload_key', {
          keyId: 'test-key',
        });
      });
    });
  });

  // ================================
  // 加密字段存储测试
  // ================================
  describe('Encrypted Field Storage', () => {
    describe('storeEncryptedField', () => {
      it('应该成功存储加密字段', async () => {
        const request: StoreEncryptedFieldRequest = {
          id: 'field-1',
          key_id: 'test-key',
          field_name: 'api_key',
          encrypted_value: 'encrypted_value',
        };

        mockInvoke.mockResolvedValue(undefined);

        await encryptionService.storeEncryptedField(request);

        expect(mockInvoke).toHaveBeenCalledWith('store_encrypted_field', {
          request,
        });
      });

      it('应该处理存储失败', async () => {
        const request: StoreEncryptedFieldRequest = {
          id: 'field-1',
          key_id: 'test-key',
          field_name: 'test',
          encrypted_value: 'value',
        };

        mockInvoke.mockRejectedValue(new Error('Store failed'));

        await expect(
          encryptionService.storeEncryptedField(request)
        ).rejects.toThrow('存储加密字段失败');
      });
    });

    describe('retrieveEncryptedField', () => {
      it('应该成功检索加密字段', async () => {
        const request: RetrieveEncryptedFieldRequest = {
          id: 'field-1',
          key_id: 'test-key',
        };

        const decryptedValue = 'secret_value';
        mockInvoke.mockResolvedValue(decryptedValue);

        const result = await encryptionService.retrieveEncryptedField(request);

        expect(mockInvoke).toHaveBeenCalledWith('retrieve_encrypted_field', {
          request,
        });
        expect(result).toBe(decryptedValue);
      });

      it('应该处理检索失败', async () => {
        const request: RetrieveEncryptedFieldRequest = {
          id: 'nonexistent',
          key_id: 'test-key',
        };

        mockInvoke.mockRejectedValue(new Error('Field not found'));

        await expect(
          encryptionService.retrieveEncryptedField(request)
        ).rejects.toThrow('检索加密字段失败');
      });
    });

    describe('deleteEncryptedField', () => {
      it('应该成功删除加密字段', async () => {
        mockInvoke.mockResolvedValue(undefined);

        await encryptionService.deleteEncryptedField('field-1');

        expect(mockInvoke).toHaveBeenCalledWith('delete_encrypted_field', {
          id: 'field-1',
        });
      });
    });
  });

  // ================================
  // 数据脱敏测试
  // ================================
  describe('Data Masking', () => {
    describe('maskSensitiveData', () => {
      it('应该成功脱敏敏感数据', async () => {
        const request: MaskDataRequest = {
          text: 'my-api-key-12345',
          data_type: 'api_key',
        };

        const maskedText = 'my-***-***';
        mockInvoke.mockResolvedValue(maskedText);

        const result = await encryptionService.maskSensitiveData(request);

        expect(mockInvoke).toHaveBeenCalledWith('mask_sensitive_data', {
          request,
        });
        expect(result).toBe(maskedText);
      });

      it('应该处理脱敏失败', async () => {
        const request: MaskDataRequest = {
          text: 'test',
          data_type: 'api_key',
        };

        mockInvoke.mockRejectedValue(new Error('Masking failed'));

        await expect(
          encryptionService.maskSensitiveData(request)
        ).rejects.toThrow('脱敏失败');
      });
    });

    describe('Specific Masking Methods', () => {
      it('maskApiKey 应该脱敏 API 密钥', async () => {
        mockInvoke.mockResolvedValue('sk-***');

        const result = await encryptionService.maskApiKey('sk-12345');

        expect(mockInvoke).toHaveBeenCalledWith('mask_sensitive_data', {
          request: { text: 'sk-12345', data_type: 'api_key' },
        });
        expect(result).toBe('sk-***');
      });

      it('maskPassword 应该脱敏密码', async () => {
        mockInvoke.mockResolvedValue('***');

        const result = await encryptionService.maskPassword('password123');

        expect(result).toBe('***');
      });

      it('maskToken 应该脱敏 Token', async () => {
        mockInvoke.mockResolvedValue('eyJ***');

        const result = await encryptionService.maskToken('eyJhbGciOiJIUzI1NiJ9');

        expect(result).toBe('eyJ***');
      });

      it('maskEmail 应该脱敏电子邮件', async () => {
        mockInvoke.mockResolvedValue('u***@example.com');

        const result = await encryptionService.maskEmail('user@example.com');

        expect(result).toBe('u***@example.com');
      });

      it('maskPhone 应该脱敏电话号码', async () => {
        mockInvoke.mockResolvedValue('138****5678');

        const result = await encryptionService.maskPhone('13812345678');

        expect(result).toBe('138****5678');
      });
    });

    describe('maskAllSensitive', () => {
      it('应该自动检测并脱敏所有敏感信息', async () => {
        const text = 'My email is user@example.com and phone is 13812345678';
        const masked = 'My email is u***@example.com and phone is 138****5678';

        mockInvoke.mockResolvedValue(masked);

        const result = await encryptionService.maskAllSensitive(text);

        expect(mockInvoke).toHaveBeenCalledWith('mask_all_sensitive', { text });
        expect(result).toBe(masked);
      });
    });
  });

  // ================================
  // 审计日志测试
  // ================================
  describe('Audit Logs', () => {
    const createMockAuditEvent = (): AuditEvent => ({
      id: '1',
      timestamp: Date.now(),
      action: 'encrypt',
      key_id: 'test-key',
      success: true,
      level: 'info',
      message: 'Encryption successful',
    });

    describe('queryAuditLogs', () => {
      it('应该成功查询审计日志', async () => {
        const request: QueryAuditLogsRequest = {
          limit: 100,
        };

        const mockEvents = [createMockAuditEvent()];
        mockInvoke.mockResolvedValue(mockEvents);

        const result = await encryptionService.queryAuditLogs(request);

        expect(mockInvoke).toHaveBeenCalledWith('query_audit_logs', { request });
        expect(result).toEqual(mockEvents);
      });

      it('应该支持过滤条件', async () => {
        const request: QueryAuditLogsRequest = {
          start_time: Date.now() - 86400000,
          end_time: Date.now(),
          action: 'decrypt',
          success: true,
          level: 'info',
          limit: 50,
        };

        mockInvoke.mockResolvedValue([]);

        await encryptionService.queryAuditLogs(request);

        expect(mockInvoke).toHaveBeenCalledWith('query_audit_logs', { request });
      });
    });

    describe('cleanupAuditLogs', () => {
      it('应该成功清理旧日志', async () => {
        mockInvoke.mockResolvedValue(50);

        const result = await encryptionService.cleanupAuditLogs(30);

        expect(mockInvoke).toHaveBeenCalledWith('cleanup_audit_logs', { days: 30 });
        expect(result).toBe(50);
      });
    });

    describe('getAuditStatistics', () => {
      it('应该成功获取审计统计', async () => {
        const mockStats = {
          total_events: 1000,
          successful_events: 950,
          failed_events: 50,
          events_by_action: {
            encrypt: 500,
            decrypt: 400,
            key_rotation: 100,
          },
        };

        mockInvoke.mockResolvedValue(mockStats);

        const result = await encryptionService.getAuditStatistics();

        expect(mockInvoke).toHaveBeenCalledWith('get_audit_statistics');
        expect(result).toEqual(mockStats);
      });
    });

    describe('Convenience Methods', () => {
      it('getRecentAuditLogs 应该获取最近的日志', async () => {
        mockInvoke.mockResolvedValue([]);

        await encryptionService.getRecentAuditLogs(50);

        expect(mockInvoke).toHaveBeenCalledWith('query_audit_logs', {
          request: { limit: 50 },
        });
      });

      it('getFailedAuditLogs 应该获取失败的日志', async () => {
        mockInvoke.mockResolvedValue([]);

        await encryptionService.getFailedAuditLogs(100);

        expect(mockInvoke).toHaveBeenCalledWith('query_audit_logs', {
          request: { success: false, limit: 100 },
        });
      });

      it('getCriticalAuditLogs 应该获取严重日志', async () => {
        mockInvoke.mockResolvedValue([]);

        await encryptionService.getCriticalAuditLogs(100);

        expect(mockInvoke).toHaveBeenCalledWith('query_audit_logs', {
          request: { level: 'critical', limit: 100 },
        });
      });
    });
  });

  // ================================
  // 辅助方法测试
  // ================================
  describe('Utility Methods', () => {
    describe('generateStrongPassword', () => {
      it('应该生成指定长度的密码', () => {
        const password = encryptionService.generateStrongPassword(32);

        expect(password).toHaveLength(32);
      });

      it('应该生成包含多种字符的密码', () => {
        const password = encryptionService.generateStrongPassword(100);

        expect(/[A-Z]/.test(password)).toBe(true); // 大写字母
        expect(/[a-z]/.test(password)).toBe(true); // 小写字母
        expect(/[0-9]/.test(password)).toBe(true); // 数字
      });

      it('应该使用默认长度', () => {
        const password = encryptionService.generateStrongPassword();

        expect(password).toHaveLength(32);
      });

      it('应该每次生成不同的密码', () => {
        const password1 = encryptionService.generateStrongPassword();
        const password2 = encryptionService.generateStrongPassword();

        expect(password1).not.toBe(password2);
      });
    });

    describe('validatePasswordStrength', () => {
      it('应该识别强密码', () => {
        const result = encryptionService.validatePasswordStrength(
          'StrongP@ssw0rd2024!'
        );

        expect(result.isStrong).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(5);
        expect(result.feedback).toHaveLength(0);
      });

      it('应该识别弱密码', () => {
        const result = encryptionService.validatePasswordStrength('weak');

        expect(result.isStrong).toBe(false);
        expect(result.score).toBeLessThan(5);
        expect(result.feedback.length).toBeGreaterThan(0);
      });

      it('应该提供具体的改进建议', () => {
        const result = encryptionService.validatePasswordStrength('password');

        expect(result.feedback).toContain('应包含大写字母');
        expect(result.feedback).toContain('应包含数字');
        expect(result.feedback).toContain('应包含特殊字符');
      });

      it('应该检查密码长度', () => {
        const result = encryptionService.validatePasswordStrength('Short1!');

        expect(result.feedback).toContain('密码长度至少应为 12 个字符');
      });
    });

    describe('isKeyExpired', () => {
      it('应该识别过期的密钥', () => {
        const expiredKey: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: Date.now() / 1000 - 86400, // 昨天过期
        };

        const result = encryptionService.isKeyExpired(expiredKey);

        expect(result).toBe(true);
      });

      it('应该识别未过期的密钥', () => {
        const validKey: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: Date.now() / 1000 + 86400, // 明天过期
        };

        const result = encryptionService.isKeyExpired(validKey);

        expect(result).toBe(false);
      });

      it('应该处理无过期时间的密钥', () => {
        const noExpiryKey: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: undefined,
        };

        const result = encryptionService.isKeyExpired(noExpiryKey);

        expect(result).toBe(false);
      });
    });

    describe('getKeyRemainingDays', () => {
      it('应该计算剩余天数', () => {
        const key: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: Date.now() / 1000 + 86400 * 7, // 7天后过期
        };

        const result = encryptionService.getKeyRemainingDays(key);

        expect(result).toBe(7);
      });

      it('应该处理无过期时间', () => {
        const key: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: undefined,
        };

        const result = encryptionService.getKeyRemainingDays(key);

        expect(result).toBe(null);
      });

      it('应该返回0对于已过期的密钥', () => {
        const key: StoredKeyInfo = {
          ...createMockKeyInfo(),
          expires_at: Date.now() / 1000 - 86400, // 昨天过期
        };

        const result = encryptionService.getKeyRemainingDays(key);

        expect(result).toBe(0);
      });
    });
  });

  // ================================
  // 错误处理和边界情况
  // ================================
  describe('Error Handling', () => {
    it('应该记录控制台错误', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error('Test error'));

      const request: EncryptRequest = {
        password: 'password',
        plaintext: 'test',
      };

      await expect(encryptionService.encryptText(request)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('应该处理网络错误', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const request: EncryptRequest = {
        password: 'password',
        plaintext: 'test',
      };

      await expect(encryptionService.encryptText(request)).rejects.toThrow();
    });
  });

  // ================================
  // 集成测试场景
  // ================================
  describe('Integration Scenarios', () => {
    it('应该支持完整的加密解密流程', async () => {
      const plaintext = 'Secret message';
      const password = 'strong-password';

      // 1. 加密
      const encryptResponse: EncryptResponse = {
        encrypted_data: createMockEncryptedData(),
        derivation_params: createMockDerivationParams(),
      };
      mockInvoke.mockResolvedValueOnce(encryptResponse);

      const encrypted = await encryptionService.quickEncrypt(password, plaintext);

      // 2. 解密
      mockInvoke.mockResolvedValueOnce(plaintext);

      const decrypted = await encryptionService.quickDecrypt(
        password,
        encrypted.encrypted_data,
        encrypted.derivation_params
      );

      expect(decrypted).toBe(plaintext);
    });

    it('应该支持完整的密钥生命周期', async () => {
      // 1. 生成密钥
      const keyInfo = createMockKeyInfo();
      mockInvoke.mockResolvedValueOnce(keyInfo);

      const generated = await encryptionService.generateMasterKey({
        key_id: 'test-key',
        password: 'password',
        purpose: 'test',
      });

      expect(generated).toEqual(keyInfo);

      // 2. 加载密钥
      mockInvoke.mockResolvedValueOnce(undefined);
      await encryptionService.loadKey('test-key', 'password');

      // 3. 检查密钥
      mockInvoke.mockResolvedValueOnce(true);
      const exists = await encryptionService.keyExists('test-key');
      expect(exists).toBe(true);

      // 4. 轮换密钥
      const newKeyInfo = createMockKeyInfo();
      mockInvoke.mockResolvedValueOnce(newKeyInfo);

      const rotated = await encryptionService.rotateKey({
        old_key_id: 'test-key',
        new_key_id: 'new-key',
        password: 'password',
        purpose: 'rotated',
      });

      expect(rotated).toEqual(newKeyInfo);

      // 5. 删除旧密钥
      mockInvoke.mockResolvedValueOnce(undefined);
      await encryptionService.deleteKey('test-key');
    });
  });
});


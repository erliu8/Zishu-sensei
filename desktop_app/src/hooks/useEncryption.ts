// src/hooks/useEncryption.ts
/**
 * 加密系统 React Hooks
 */

import { useState, useCallback, useEffect } from 'react';
import { encryptionService } from '../services/encryptionService';
import type {
  StoredKeyInfo,
  AuditEvent,
  AuditStatistics,
  EncryptedData,
  KeyDerivationParams,
} from '../types/encryption';

/**
 * 使用加密功能
 */
export function useEncryption() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加密文本
   */
  const encryptText = useCallback(async (password: string, plaintext: string) => {
    setIsEncrypting(true);
    setError(null);
    try {
      const result = await encryptionService.quickEncrypt(password, plaintext);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加密失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  /**
   * 解密文本
   */
  const decryptText = useCallback(
    async (
      password: string,
      encryptedData: EncryptedData,
      derivationParams: KeyDerivationParams
    ) => {
      setIsDecrypting(true);
      setError(null);
      try {
        const result = await encryptionService.quickDecrypt(
          password,
          encryptedData,
          derivationParams
        );
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '解密失败';
        setError(errorMsg);
        throw err;
      } finally {
        setIsDecrypting(false);
      }
    },
    []
  );

  return {
    encryptText,
    decryptText,
    isEncrypting,
    isDecrypting,
    error,
  };
}

/**
 * 使用密钥管理功能
 */
export function useKeyManager() {
  const [keys, setKeys] = useState<Record<string, StoredKeyInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 生成新密钥
   */
  const generateKey = useCallback(
    async (
      keyId: string,
      password: string,
      purpose: string,
      expiresInDays?: number
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const keyInfo = await encryptionService.generateMasterKey({
          key_id: keyId,
          password,
          purpose,
          expires_in_days: expiresInDays,
        });
        setKeys((prev) => ({ ...prev, [keyId]: keyInfo }));
        return keyInfo;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '生成密钥失败';
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 加载密钥
   */
  const loadKey = useCallback(async (keyId: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await encryptionService.loadKey(keyId, password);
      const keyInfo = await encryptionService.getKeyInfo(keyId);
      setKeys((prev) => ({ ...prev, [keyId]: keyInfo }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载密钥失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 轮换密钥
   */
  const rotateKey = useCallback(
    async (keyId: string, oldPassword: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const keyInfo = await encryptionService.rotateKey({
          key_id: keyId,
          old_password: oldPassword,
          new_password: newPassword,
        });
        setKeys((prev) => ({ ...prev, [keyId]: keyInfo }));
        return keyInfo;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '轮换密钥失败';
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 删除密钥
   */
  const deleteKey = useCallback(async (keyId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await encryptionService.deleteKey(keyId);
      setKeys((prev) => {
        const newKeys = { ...prev };
        delete newKeys[keyId];
        return newKeys;
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '删除密钥失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 卸载密钥
   */
  const unloadKey = useCallback(async (keyId: string) => {
    try {
      await encryptionService.unloadKey(keyId);
    } catch (err) {
      console.error('卸载密钥失败:', err);
    }
  }, []);

  /**
   * 检查密钥是否存在
   */
  const keyExists = useCallback(async (keyId: string) => {
    return await encryptionService.keyExists(keyId);
  }, []);

  return {
    keys,
    generateKey,
    loadKey,
    rotateKey,
    deleteKey,
    unloadKey,
    keyExists,
    isLoading,
    error,
  };
}

/**
 * 使用审计日志功能
 */
export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取审计日志
   */
  const fetchLogs = useCallback(async (limit: number = 100) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await encryptionService.getRecentAuditLogs(limit);
      setLogs(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取审计日志失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 获取统计信息
   */
  const fetchStatistics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await encryptionService.getAuditStatistics();
      setStatistics(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取审计统计失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 清理旧日志
   */
  const cleanupOldLogs = useCallback(async (days: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const count = await encryptionService.cleanupAuditLogs(days);
      // 重新获取日志
      await fetchLogs();
      return count;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '清理审计日志失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchLogs]);

  /**
   * 自动加载日志
   */
  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, [fetchLogs, fetchStatistics]);

  return {
    logs,
    statistics,
    fetchLogs,
    fetchStatistics,
    cleanupOldLogs,
    isLoading,
    error,
  };
}

/**
 * 使用数据脱敏功能
 */
export function useDataMasking() {
  const [isMasking, setIsMasking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 脱敏文本
   */
  const maskText = useCallback(async (text: string, dataType: string) => {
    setIsMasking(true);
    setError(null);
    try {
      const result = await encryptionService.maskSensitiveData({
        text,
        data_type: dataType,
      });
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '脱敏失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsMasking(false);
    }
  }, []);

  /**
   * 自动脱敏所有敏感信息
   */
  const maskAllSensitive = useCallback(async (text: string) => {
    setIsMasking(true);
    setError(null);
    try {
      const result = await encryptionService.maskAllSensitive(text);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '自动脱敏失败';
      setError(errorMsg);
      throw err;
    } finally {
      setIsMasking(false);
    }
  }, []);

  return {
    maskText,
    maskAllSensitive,
    isMasking,
    error,
  };
}

/**
 * 使用密码强度验证
 */
export function usePasswordStrength(password: string) {
  const [strength, setStrength] = useState({
    isStrong: false,
    score: 0,
    feedback: [] as string[],
  });

  useEffect(() => {
    const result = encryptionService.validatePasswordStrength(password);
    setStrength(result);
  }, [password]);

  return strength;
}


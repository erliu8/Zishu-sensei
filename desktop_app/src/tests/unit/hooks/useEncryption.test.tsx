/**
 * useEncryption Hook 测试套件
 * 
 * 测试加密相关功能，包括文本加密解密、密钥管理、审计日志、数据脱敏等
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { 
  useEncryption,
  useKeyManager, 
  useAuditLogs,
  useDataMasking,
  usePasswordStrength 
} from '@/hooks/useEncryption'
import { renderHook, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock objects need to be hoisted to work with vi.mock
const { mockEncryptionService } = vi.hoisted(() => ({
  mockEncryptionService: {
    quickEncrypt: vi.fn().mockResolvedValue({ ciphertext: 'encrypted', nonce: 'nonce', version: 1, timestamp: Date.now() }),
    quickDecrypt: vi.fn().mockResolvedValue('decrypted'),
    generateMasterKey: vi.fn().mockResolvedValue({ key_id: 'key-123', encrypted_key: 'encrypted_key', derivation_params: {}, purpose: 'data_encryption', created_at: Date.now(), version: 1 }),
    loadKey: vi.fn().mockResolvedValue(undefined),
    getKeyInfo: vi.fn().mockResolvedValue({ key_id: 'key-123', purpose: 'data_encryption', created_at: Date.now(), version: 1 }),
    rotateKey: vi.fn().mockResolvedValue({ key_id: 'key-124', encrypted_key: 'new_encrypted_key', derivation_params: {}, purpose: 'data_encryption', created_at: Date.now(), version: 1 }),
    deleteKey: vi.fn().mockResolvedValue(undefined),
    unloadKey: vi.fn().mockResolvedValue(undefined),
    keyExists: vi.fn().mockResolvedValue(true),
    getRecentAuditLogs: vi.fn().mockResolvedValue([]),
    getAuditStatistics: vi.fn().mockResolvedValue({ total_events: 0, events_by_type: {}, events_by_result: {}, time_range: { start: '', end: '' } }),
    cleanupAuditLogs: vi.fn().mockResolvedValue(0),
    maskSensitiveData: vi.fn().mockReturnValue('***'),
    maskAllSensitive: vi.fn().mockReturnValue({}),
    validatePasswordStrength: vi.fn().mockReturnValue({ isStrong: true, score: 4, feedback: [] }),
  },
}))

vi.mock('@/services/encryptionService', () => ({
  encryptionService: mockEncryptionService,
}))

// ==================== 测试数据 ====================

const mockEncryptedData = {
  ciphertext: 'encrypted_content_base64',
  nonce: 'nonce_base64',
  version: 1,
  timestamp: Date.now(),
}

const mockKeyDerivationParams = {
  salt: 'salt_base64',
  memory_cost: 65536,
  time_cost: 3,
  parallelism: 4,
}

const mockStoredKeyInfo = {
  key_id: 'test-key-123',
  encrypted_key: 'encrypted_key_base64',
  derivation_params: mockKeyDerivationParams,
  purpose: 'data_encryption',
  created_at: Date.now(),
  expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
  version: 1,
}

const mockAuditEvent = {
  id: 'audit-123',
  event_type: 'key_generated',
  key_id: 'test-key-123',
  user_id: 'user-456',
  timestamp: '2025-01-01T12:00:00Z',
  metadata: { purpose: 'data_encryption' },
  result: 'success' as const,
}

const mockAuditStatistics = {
  total_events: 1000,
  events_by_type: {
    key_generated: 10,
    key_loaded: 50,
    encryption_performed: 800,
    decryption_performed: 140,
  },
  events_by_result: {
    success: 950,
    failure: 50,
  },
  time_range: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  },
}

const mockPasswordStrength = {
  isStrong: true,
  score: 85,
  feedback: ['密码强度良好', '建议包含特殊字符'],
}

// ==================== 测试套件 ====================

describe('useEncryption Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置默认 mock 行为
    mockEncryptionService.quickEncrypt.mockResolvedValue(mockEncryptedData)
    mockEncryptionService.quickDecrypt.mockResolvedValue('decrypted_text')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==================== 基础加密解密测试 ====================

  describe('基础加密解密', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useEncryption())

      expect(result.current.isEncrypting).toBe(false)
      expect(result.current.isDecrypting).toBe(false)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.encryptText).toBe('function')
      expect(typeof result.current.decryptText).toBe('function')
    })

    it('应该成功加密文本', async () => {
      const { result } = renderHook(() => useEncryption())

      let encryptedResult: any
      await act(async () => {
        encryptedResult = await result.current.encryptText('password123', 'Hello World')
      })

      expect(mockEncryptionService.quickEncrypt).toHaveBeenCalledWith('password123', 'Hello World')
      expect(encryptedResult).toEqual(mockEncryptedData)
      expect(result.current.isEncrypting).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('应该管理加密状态', async () => {
      let resolveEncrypt: (value: any) => void
      const encryptPromise = new Promise(resolve => {
        resolveEncrypt = resolve
      })

      mockEncryptionService.quickEncrypt.mockReturnValue(encryptPromise)

      const { result } = renderHook(() => useEncryption())

      act(() => {
        result.current.encryptText('password123', 'Hello World')
      })

      expect(result.current.isEncrypting).toBe(true)

      await act(async () => {
        resolveEncrypt!(mockEncryptedData)
      })

      expect(result.current.isEncrypting).toBe(false)
    })

    it('应该处理加密错误', async () => {
      const testError = new Error('Encryption failed')
      mockEncryptionService.quickEncrypt.mockRejectedValue(testError)

      const { result } = renderHook(() => useEncryption())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.encryptText('password123', 'Hello World')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Encryption failed')
      expect(result.current.error).toBe('Encryption failed')
      expect(result.current.isEncrypting).toBe(false)
    })

    it('应该成功解密文本', async () => {
      const { result } = renderHook(() => useEncryption())

      let decryptedResult: any
      await act(async () => {
        decryptedResult = await result.current.decryptText(
          'password123',
          mockEncryptedData,
          mockKeyDerivationParams
        )
      })

      expect(mockEncryptionService.quickDecrypt).toHaveBeenCalledWith(
        'password123',
        mockEncryptedData,
        mockKeyDerivationParams
      )
      expect(decryptedResult).toBe('decrypted_text')
      expect(result.current.isDecrypting).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('应该管理解密状态', async () => {
      let resolveDecrypt: (value: any) => void
      const decryptPromise = new Promise(resolve => {
        resolveDecrypt = resolve
      })

      mockEncryptionService.quickDecrypt.mockReturnValue(decryptPromise)

      const { result } = renderHook(() => useEncryption())

      act(() => {
        result.current.decryptText('password123', mockEncryptedData, mockKeyDerivationParams)
      })

      expect(result.current.isDecrypting).toBe(true)

      await act(async () => {
        resolveDecrypt!('decrypted_text')
      })

      expect(result.current.isDecrypting).toBe(false)
    })

    it('应该处理解密错误', async () => {
      const testError = new Error('Decryption failed')
      mockEncryptionService.quickDecrypt.mockRejectedValue(testError)

      const { result } = renderHook(() => useEncryption())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.decryptText(
            'wrong_password',
            mockEncryptedData,
            mockKeyDerivationParams
          )
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Decryption failed')
      expect(result.current.error).toBe('Decryption failed')
    })
  })
})

// ==================== useKeyManager 测试 ====================

describe('useKeyManager Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEncryptionService.generateMasterKey.mockResolvedValue(mockStoredKeyInfo)
    mockEncryptionService.loadKey.mockResolvedValue(undefined)
    mockEncryptionService.getKeyInfo.mockResolvedValue(mockStoredKeyInfo)
    mockEncryptionService.rotateKey.mockResolvedValue(mockStoredKeyInfo)
    mockEncryptionService.deleteKey.mockResolvedValue(undefined)
    mockEncryptionService.unloadKey.mockResolvedValue(undefined)
    mockEncryptionService.keyExists.mockResolvedValue(true)
  })

  describe('密钥生成', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useKeyManager())

      expect(result.current.keys).toEqual({})
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.generateKey).toBe('function')
    })

    it('应该生成新密钥', async () => {
      const { result } = renderHook(() => useKeyManager())

      let keyInfo: any
      await act(async () => {
        keyInfo = await result.current.generateKey(
          'test-key-123',
          'password123',
          'data_encryption',
          365
        )
      })

      expect(mockEncryptionService.generateMasterKey).toHaveBeenCalledWith({
        key_id: 'test-key-123',
        password: 'password123',
        purpose: 'data_encryption',
        expires_in_days: 365,
      })

      expect(keyInfo).toEqual(mockStoredKeyInfo)
      expect(result.current.keys['test-key-123']).toEqual(mockStoredKeyInfo)
      expect(result.current.isLoading).toBe(false)
    })

    it('应该处理密钥生成错误', async () => {
      const testError = new Error('Key generation failed')
      mockEncryptionService.generateMasterKey.mockRejectedValue(testError)

      const { result } = renderHook(() => useKeyManager())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.generateKey('test-key', 'password', 'purpose')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Key generation failed')
      expect(result.current.error).toBe('Key generation failed')
    })

    it('应该管理加载状态', async () => {
      let resolveGeneration: (value: any) => void
      const generationPromise = new Promise(resolve => {
        resolveGeneration = resolve
      })

      mockEncryptionService.generateMasterKey.mockReturnValue(generationPromise)

      const { result } = renderHook(() => useKeyManager())

      act(() => {
        result.current.generateKey('test-key', 'password', 'purpose')
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolveGeneration!(mockStoredKeyInfo)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('密钥加载', () => {
    it('应该加载密钥', async () => {
      const { result } = renderHook(() => useKeyManager())

      await act(async () => {
        await result.current.loadKey('test-key-123', 'password123')
      })

      expect(mockEncryptionService.loadKey).toHaveBeenCalledWith('test-key-123', 'password123')
      expect(mockEncryptionService.getKeyInfo).toHaveBeenCalledWith('test-key-123')
      expect(result.current.keys['test-key-123']).toEqual(mockStoredKeyInfo)
    })

    it('应该处理密钥加载错误', async () => {
      const testError = new Error('Key not found')
      mockEncryptionService.loadKey.mockRejectedValue(testError)

      const { result } = renderHook(() => useKeyManager())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.loadKey('test-key', 'password')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Key not found')
      expect(result.current.error).toBe('Key not found')
    })
  })

  describe('密钥轮换', () => {
    it('应该轮换密钥', async () => {
      const { result } = renderHook(() => useKeyManager())

      let rotatedKey: any
      await act(async () => {
        rotatedKey = await result.current.rotateKey(
          'test-key-123',
          'old_password',
          'new_password'
        )
      })

      expect(mockEncryptionService.rotateKey).toHaveBeenCalledWith({
        key_id: 'test-key-123',
        old_password: 'old_password',
        new_password: 'new_password',
      })

      expect(rotatedKey).toEqual(mockStoredKeyInfo)
      expect(result.current.keys['test-key-123']).toEqual(mockStoredKeyInfo)
    })

    it('应该处理密钥轮换错误', async () => {
      const testError = new Error('Rotation failed')
      mockEncryptionService.rotateKey.mockRejectedValue(testError)

      const { result } = renderHook(() => useKeyManager())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.rotateKey('test-key', 'old', 'new')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Rotation failed')
      expect(result.current.error).toBe('Rotation failed')
    })
  })

  describe('密钥删除', () => {
    it('应该删除密钥', async () => {
      const { result } = renderHook(() => useKeyManager())

      // 先添加一个密钥
      act(() => {
        result.current.keys['test-key-123'] = mockStoredKeyInfo
      })

      await act(async () => {
        await result.current.deleteKey('test-key-123')
      })

      expect(mockEncryptionService.deleteKey).toHaveBeenCalledWith('test-key-123')
      expect(result.current.keys['test-key-123']).toBeUndefined()
    })

    it('应该处理密钥删除错误', async () => {
      const testError = new Error('Delete failed')
      mockEncryptionService.deleteKey.mockRejectedValue(testError)

      const { result } = renderHook(() => useKeyManager())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.deleteKey('test-key')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Delete failed')
      expect(result.current.error).toBe('Delete failed')
    })
  })

  describe('密钥卸载', () => {
    it('应该卸载密钥', async () => {
      const { result } = renderHook(() => useKeyManager())

      await act(async () => {
        await result.current.unloadKey('test-key-123')
      })

      expect(mockEncryptionService.unloadKey).toHaveBeenCalledWith('test-key-123')
    })

    it('应该静默处理卸载错误', async () => {
      const testError = new Error('Unload failed')
      mockEncryptionService.unloadKey.mockRejectedValue(testError)

      const { result } = renderHook(() => useKeyManager())

      await act(async () => {
        await result.current.unloadKey('test-key')
      })

      // 应该不抛出错误，只在控制台记录
      expect(result.current.error).toBe(null)
    })
  })

  describe('密钥存在性检查', () => {
    it('应该检查密钥是否存在', async () => {
      const { result } = renderHook(() => useKeyManager())

      let exists: boolean
      await act(async () => {
        exists = await result.current.keyExists('test-key-123')
      })

      expect(mockEncryptionService.keyExists).toHaveBeenCalledWith('test-key-123')
      expect(exists!).toBe(true)
    })
  })
})

// ==================== useAuditLogs 测试 ====================

describe('useAuditLogs Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEncryptionService.getRecentAuditLogs.mockResolvedValue([mockAuditEvent])
    mockEncryptionService.getAuditStatistics.mockResolvedValue(mockAuditStatistics)
    mockEncryptionService.cleanupAuditLogs.mockResolvedValue(50)
  })

  describe('初始化和数据获取', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useAuditLogs())

      expect(result.current.logs).toEqual([])
      expect(result.current.statistics).toBe(null)
      // isLoading can be true or false depending on timing
      expect(result.current.error).toBe(null)
    })

    it('应该自动获取审计日志和统计信息', async () => {
      const { result } = renderHook(() => useAuditLogs())

      await waitFor(() => {
        expect(result.current.logs).toEqual([mockAuditEvent])
        expect(result.current.statistics).toEqual(mockAuditStatistics)
      })

      expect(mockEncryptionService.getRecentAuditLogs).toHaveBeenCalledWith(100)
      expect(mockEncryptionService.getAuditStatistics).toHaveBeenCalled()
    })

    it('应该支持自定义日志限制', async () => {
      const { result } = renderHook(() => useAuditLogs())

      await act(async () => {
        await result.current.fetchLogs(50)
      })

      expect(mockEncryptionService.getRecentAuditLogs).toHaveBeenCalledWith(50)
    })
  })

  describe('错误处理', () => {
    it('应该处理获取日志错误', async () => {
      mockEncryptionService.getRecentAuditLogs.mockRejectedValue(new Error('Fetch logs failed'))
      mockEncryptionService.getAuditStatistics.mockResolvedValue(mockAuditStatistics)

      const { result } = renderHook(() => useAuditLogs())

      // 等待初始化完成（这会导致错误）
      await waitFor(() => {
        expect(result.current.error).toBe('Fetch logs failed')
      })

      // 手动调用也应该失败
      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.fetchLogs()
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Fetch logs failed')
    })

    it('应该处理获取统计错误', async () => {
      mockEncryptionService.getRecentAuditLogs.mockResolvedValue([mockAuditEvent])
      mockEncryptionService.getAuditStatistics.mockRejectedValue(new Error('Fetch statistics failed'))

      const { result } = renderHook(() => useAuditLogs())

      // 等待初始化完成（这会导致错误）
      await waitFor(() => {
        expect(result.current.error).toBe('Fetch statistics failed')
      })

      // 手动调用也应该失败
      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.fetchStatistics()
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Fetch statistics failed')
    })
  })

  describe('日志清理', () => {
    it('应该清理旧日志', async () => {
      const { result } = renderHook(() => useAuditLogs())

      // Wait for initial load
      await waitFor(() => {
        expect(mockEncryptionService.getRecentAuditLogs).toHaveBeenCalled()
      })

      const initialCallCount = mockEncryptionService.getRecentAuditLogs.mock.calls.length

      let cleanedCount: number
      await act(async () => {
        cleanedCount = await result.current.cleanupOldLogs(30)
      })

      expect(mockEncryptionService.cleanupAuditLogs).toHaveBeenCalledWith(30)
      expect(cleanedCount!).toBe(50)
      // Should be called at least once more after cleanup
      expect(mockEncryptionService.getRecentAuditLogs.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it('应该处理清理错误', async () => {
      mockEncryptionService.cleanupAuditLogs.mockRejectedValue(new Error('Cleanup failed'))

      const { result } = renderHook(() => useAuditLogs())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(mockEncryptionService.getRecentAuditLogs).toHaveBeenCalled()
      })

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.cleanupOldLogs(30)
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Cleanup failed')
      expect(result.current.error).toBe('Cleanup failed')
    })
  })
})

// ==================== useDataMasking 测试 ====================

describe('useDataMasking Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEncryptionService.maskSensitiveData.mockResolvedValue('手机号码：138****1234')
    mockEncryptionService.maskAllSensitive.mockResolvedValue('姓名：**，电话：138****1234')
  })

  describe('数据脱敏', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useDataMasking())

      expect(result.current.isMasking).toBe(false)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.maskText).toBe('function')
      expect(typeof result.current.maskAllSensitive).toBe('function')
    })

    it('应该脱敏指定类型的数据', async () => {
      const { result } = renderHook(() => useDataMasking())

      let maskedText: string
      await act(async () => {
        maskedText = await result.current.maskText('13812341234', 'phone')
      })

      expect(mockEncryptionService.maskSensitiveData).toHaveBeenCalledWith({
        text: '13812341234',
        data_type: 'phone',
      })
      expect(maskedText!).toBe('手机号码：138****1234')
      expect(result.current.isMasking).toBe(false)
    })

    it('应该自动脱敏所有敏感信息', async () => {
      const { result } = renderHook(() => useDataMasking())

      let maskedText: string
      await act(async () => {
        maskedText = await result.current.maskAllSensitive('张三的电话是13812341234')
      })

      expect(mockEncryptionService.maskAllSensitive).toHaveBeenCalledWith('张三的电话是13812341234')
      expect(maskedText!).toBe('姓名：**，电话：138****1234')
    })

    it('应该管理脱敏状态', async () => {
      let resolveMasking: (value: any) => void
      const maskingPromise = new Promise(resolve => {
        resolveMasking = resolve
      })

      mockEncryptionService.maskSensitiveData.mockReturnValue(maskingPromise)

      const { result } = renderHook(() => useDataMasking())

      act(() => {
        result.current.maskText('test data', 'phone')
      })

      expect(result.current.isMasking).toBe(true)

      await act(async () => {
        resolveMasking!('masked data')
      })

      expect(result.current.isMasking).toBe(false)
    })

    it('应该处理脱敏错误', async () => {
      const testError = new Error('Masking failed')
      mockEncryptionService.maskSensitiveData.mockRejectedValue(testError)

      const { result } = renderHook(() => useDataMasking())

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.maskText('test', 'phone')
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError?.message).toBe('Masking failed')
      expect(result.current.error).toBe('Masking failed')
    })
  })
})

// ==================== usePasswordStrength 测试 ====================

describe('usePasswordStrength Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEncryptionService.validatePasswordStrength.mockReturnValue(mockPasswordStrength)
  })

  describe('密码强度验证', () => {
    it('应该返回密码强度信息', () => {
      const { result } = renderHook(() => usePasswordStrength('SecurePassword123!'))

      expect(mockEncryptionService.validatePasswordStrength).toHaveBeenCalledWith('SecurePassword123!')
      expect(result.current).toEqual(mockPasswordStrength)
    })

    it('应该响应密码变化', () => {
      const { result, rerender } = renderHook(
        ({ password }) => usePasswordStrength(password),
        { initialProps: { password: 'weak' } }
      )

      // 更改为弱密码的响应
      mockEncryptionService.validatePasswordStrength.mockReturnValue({
        isStrong: false,
        score: 25,
        feedback: ['密码太短', '缺少大写字母', '缺少数字'],
      })

      rerender({ password: '123' })

      expect(mockEncryptionService.validatePasswordStrength).toHaveBeenCalledWith('123')
      expect(result.current.isStrong).toBe(false)
      expect(result.current.score).toBe(25)
      expect(result.current.feedback).toHaveLength(3)
    })

    it('应该处理空密码', () => {
      mockEncryptionService.validatePasswordStrength.mockReturnValue({
        isStrong: false,
        score: 0,
        feedback: ['密码不能为空'],
      })

      const { result } = renderHook(() => usePasswordStrength(''))

      expect(result.current.isStrong).toBe(false)
      expect(result.current.score).toBe(0)
    })

    it('应该处理强密码', () => {
      mockEncryptionService.validatePasswordStrength.mockReturnValue({
        isStrong: true,
        score: 95,
        feedback: ['密码强度极好'],
      })

      const { result } = renderHook(() => usePasswordStrength('VerySecurePassword123!@#'))

      expect(result.current.isStrong).toBe(true)
      expect(result.current.score).toBe(95)
    })
  })
})

// ==================== 集成测试 ====================

describe('useEncryption 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEncryptionService.quickEncrypt.mockResolvedValue(mockEncryptedData)
    mockEncryptionService.quickDecrypt.mockResolvedValue('Original text')
    mockEncryptionService.generateMasterKey.mockResolvedValue(mockStoredKeyInfo)
    mockEncryptionService.getRecentAuditLogs.mockResolvedValue([mockAuditEvent])
    mockEncryptionService.maskAllSensitive.mockResolvedValue('脱敏后的文本')
  })

  it('应该完成完整的加密工作流程', async () => {
    const encryptionHook = renderHook(() => useEncryption())
    const keyManagerHook = renderHook(() => useKeyManager())
    const auditHook = renderHook(() => useAuditLogs())

    // 1. 生成密钥
    await act(async () => {
      await keyManagerHook.result.current.generateKey(
        'workflow-key',
        'password123',
        'test_encryption'
      )
    })

    expect(keyManagerHook.result.current.keys['workflow-key']).toBeDefined()

    // 2. 加密数据
    let encryptedData: any
    await act(async () => {
      encryptedData = await encryptionHook.result.current.encryptText(
        'password123',
        'Sensitive information'
      )
    })

    expect(encryptedData).toEqual(mockEncryptedData)

    // 3. 解密数据
    let decryptedData: string
    await act(async () => {
      decryptedData = await encryptionHook.result.current.decryptText(
        'password123',
        encryptedData,
        mockKeyDerivationParams
      )
    })

    expect(decryptedData!).toBe('Original text')

    // 4. 检查审计日志
    await waitFor(() => {
      expect(auditHook.result.current.logs).toHaveLength(1)
    })

    // 5. 清理
    await act(async () => {
      await keyManagerHook.result.current.deleteKey('workflow-key')
    })

    expect(keyManagerHook.result.current.keys['workflow-key']).toBeUndefined()
  })

  it('应该处理并发加密操作', async () => {
    const { result } = renderHook(() => useEncryption())

    // 等待初始化完成
    await waitFor(() => {
      expect(result.current).not.toBe(null)
    })

    // 使用 act 包装并发操作
    await act(async () => {
      const promises = [
        result.current.encryptText('pass1', 'text1'),
        result.current.encryptText('pass2', 'text2'),
        result.current.encryptText('pass3', 'text3'),
      ]
      
      await Promise.allSettled(promises)
    })

    expect(mockEncryptionService.quickEncrypt).toHaveBeenCalledTimes(3)
  })

  it('应该处理密钥轮换工作流程', async () => {
    const { result } = renderHook(() => useKeyManager())

    // 等待初始化完成
    await waitFor(() => {
      expect(result.current).not.toBe(null)
    })

    // 生成初始密钥
    await act(async () => {
      await result.current.generateKey('rotate-key', 'old-password', 'rotation-test')
    })

    // 轮换密钥
    await act(async () => {
      await result.current.rotateKey('rotate-key', 'old-password', 'new-password')
    })

    // 删除密钥
    await act(async () => {
      await result.current.deleteKey('rotate-key')
    })

    expect(mockEncryptionService.generateMasterKey).toHaveBeenCalled()
    expect(mockEncryptionService.rotateKey).toHaveBeenCalled()
    expect(mockEncryptionService.deleteKey).toHaveBeenCalled()
  })
})

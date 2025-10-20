/**
 * usePermission Hooks 测试套件
 * 
 * 测试权限管理相关的所有 Hooks，包括权限查询、授权、撤销等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  usePermissions,
  useEntityGrants,
  usePendingGrants,
  usePermissionCheck,
  usePermissionStats,
  usePermissionUsageLogs,
  usePermissionPresets,
} from '@/hooks/usePermission'
import { 
  PermissionType, 
  PermissionLevel, 
  PermissionStatus 
} from '@/types/permission'
import { mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

const mockPermissionService = {
  getAllPermissions: vi.fn(),
  getEntityGrants: vi.fn(),
  getPendingGrants: vi.fn(),
  grantPermission: vi.fn(),
  revokePermission: vi.fn(),
  denyPermission: vi.fn(),
  checkPermission: vi.fn(),
  getPermissionStats: vi.fn(),
  getPermissionUsageLogs: vi.fn(),
  applyPermissionPreset: vi.fn(),
  PERMISSION_PRESETS: {
    FULL_ACCESS: {
      name: '完全访问',
      description: '授予所有权限',
      permissions: [],
    },
    READ_ONLY: {
      name: '只读访问',
      description: '仅授予读取权限',
      permissions: [],
    },
  },
}

vi.mock('@/services/permissionService', () => mockPermissionService)

// ==================== 测试数据 ====================

const mockPermissions = [
  {
    type: PermissionType.FILE_READ,
    name: '文件读取',
    description: '读取文件内容',
    category: 'file',
    required_level: PermissionLevel.READ,
  },
  {
    type: PermissionType.FILE_WRITE,
    name: '文件写入',
    description: '写入文件内容',
    category: 'file',
    required_level: PermissionLevel.WRITE,
  },
  {
    type: PermissionType.NETWORK_ACCESS,
    name: '网络访问',
    description: '访问网络',
    category: 'network',
    required_level: PermissionLevel.EXECUTE,
  },
]

const mockGrants = [
  {
    id: 'grant-1',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_READ,
    level: PermissionLevel.READ,
    status: PermissionStatus.GRANTED,
    granted_at: '2025-01-01T00:00:00Z',
    granted_by: 'user',
  },
  {
    id: 'grant-2',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_WRITE,
    level: PermissionLevel.WRITE,
    status: PermissionStatus.PENDING,
    requested_at: '2025-01-01T00:00:00Z',
  },
]

const mockStats = {
  total_grants: 10,
  active_grants: 8,
  pending_grants: 1,
  denied_grants: 1,
  revoked_grants: 0,
  most_used_permission: PermissionType.FILE_READ,
  least_used_permission: PermissionType.SYSTEM_ADMIN,
  total_usage_count: 100,
}

const mockUsageLogs = [
  {
    id: 'log-1',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_READ,
    operation: 'read',
    success: true,
    timestamp: '2025-01-01T00:00:00Z',
    metadata: {},
  },
  {
    id: 'log-2',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_WRITE,
    operation: 'write',
    success: false,
    timestamp: '2025-01-01T00:01:00Z',
    error_message: 'Permission denied',
    metadata: {},
  },
]

// ==================== 测试套件 ====================

describe('usePermissions Hook', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    mockPermissionService.getAllPermissions.mockResolvedValue(mockPermissions)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.permissions).toEqual([])
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.reload).toBe('function')
    })

    it('应该加载权限列表', async () => {
      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.permissions).toEqual(mockPermissions)
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.getAllPermissions).toHaveBeenCalledTimes(1)
    })

    it('应该处理加载错误', async () => {
      const testError = new Error('Failed to load permissions')
      mockPermissionService.getAllPermissions.mockRejectedValue(testError)

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该支持重新加载', async () => {
      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.permissions).toEqual(mockPermissions)
      })

      mockPermissionService.getAllPermissions.mockClear()

      await act(async () => {
        await result.current.reload()
      })

      expect(mockPermissionService.getAllPermissions).toHaveBeenCalledTimes(1)
    })
  })
})

describe('useEntityGrants Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.getEntityGrants.mockResolvedValue(mockGrants)
    mockPermissionService.grantPermission.mockResolvedValue(undefined)
    mockPermissionService.revokePermission.mockResolvedValue(undefined)
    mockPermissionService.denyPermission.mockResolvedValue(undefined)
  })

  describe('授权管理', () => {
    it('应该加载实体的权限授权', async () => {
      const { result } = renderHook(() =>
        useEntityGrants('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.grants).toEqual(mockGrants)
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.getEntityGrants).toHaveBeenCalledWith(
        'adapter',
        'test-adapter'
      )
    })

    it('应该授予权限', async () => {
      const { result } = renderHook(() =>
        useEntityGrants('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.grants).toEqual(mockGrants)
      })

      let success: boolean = false
      await act(async () => {
        success = await result.current.grant(
          PermissionType.NETWORK_ACCESS,
          PermissionLevel.EXECUTE
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.grantPermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.NETWORK_ACCESS,
        level: PermissionLevel.EXECUTE,
        granted_by: 'user',
      })
    })

    it('应该撤销权限', async () => {
      const { result } = renderHook(() =>
        useEntityGrants('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.grants).toEqual(mockGrants)
      })

      let success: boolean = false
      await act(async () => {
        success = await result.current.revoke(
          PermissionType.FILE_READ,
          '不再需要此权限'
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.revokePermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.FILE_READ,
        reason: '不再需要此权限',
      })
    })

    it('应该拒绝权限', async () => {
      const { result } = renderHook(() =>
        useEntityGrants('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.grants).toEqual(mockGrants)
      })

      let success: boolean = false
      await act(async () => {
        success = await result.current.deny(
          PermissionType.SYSTEM_ADMIN,
          '权限过高'
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.denyPermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.SYSTEM_ADMIN,
        scope: undefined,
        reason: '权限过高',
      })
    })

    it('应该计算统计信息', async () => {
      const { result } = renderHook(() =>
        useEntityGrants('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.grants).toEqual(mockGrants)
      })

      expect(result.current.stats.total).toBe(2)
      expect(result.current.stats.active).toBe(1)
      expect(result.current.stats.pending).toBe(1)
      expect(result.current.stats.denied).toBe(0)
      expect(result.current.stats.revoked).toBe(0)
    })

    it('应该处理空实体类型和ID', async () => {
      const { result } = renderHook(() => useEntityGrants('', ''))

      await waitFor(() => {
        expect(result.current.grants).toEqual([])
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.getEntityGrants).not.toHaveBeenCalled()
    })
  })
})

describe('usePendingGrants Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pendingGrants = mockGrants.filter(
      (g) => g.status === PermissionStatus.PENDING
    )
    mockPermissionService.getPendingGrants.mockResolvedValue(pendingGrants)
    mockPermissionService.grantPermission.mockResolvedValue(undefined)
    mockPermissionService.denyPermission.mockResolvedValue(undefined)
  })

  describe('待审核权限', () => {
    it('应该加载待审核权限列表', async () => {
      const { result } = renderHook(() => usePendingGrants())

      await waitFor(() => {
        expect(result.current.grants).toHaveLength(1)
        expect(result.current.grants[0].status).toBe(PermissionStatus.PENDING)
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该批准待审核权限', async () => {
      const { result } = renderHook(() => usePendingGrants())

      await waitFor(() => {
        expect(result.current.grants).toHaveLength(1)
      })

      const pendingGrant = result.current.grants[0]
      let success: boolean = false

      await act(async () => {
        success = await result.current.approve(pendingGrant)
      })

      expect(success).toBe(true)
      expect(mockPermissionService.grantPermission).toHaveBeenCalledWith({
        entity_type: pendingGrant.entity_type,
        entity_id: pendingGrant.entity_id,
        permission_type: pendingGrant.permission_type,
        level: pendingGrant.level,
        granted_by: 'user',
      })
    })

    it('应该拒绝待审核权限', async () => {
      const { result } = renderHook(() => usePendingGrants())

      await waitFor(() => {
        expect(result.current.grants).toHaveLength(1)
      })

      const pendingGrant = result.current.grants[0]
      let success: boolean = false

      await act(async () => {
        success = await result.current.reject(pendingGrant, '权限不必要')
      })

      expect(success).toBe(true)
      expect(mockPermissionService.denyPermission).toHaveBeenCalledWith({
        entity_type: pendingGrant.entity_type,
        entity_id: pendingGrant.entity_id,
        permission_type: pendingGrant.permission_type,
        reason: '权限不必要',
      })
    })
  })
})

describe('usePermissionCheck Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.checkPermission.mockResolvedValue(true)
  })

  describe('权限检查', () => {
    it('应该检查权限是否已授予', async () => {
      const { result } = renderHook(() =>
        usePermissionCheck(
          'adapter',
          'test-adapter',
          PermissionType.FILE_READ,
          PermissionLevel.READ
        )
      )

      await waitFor(() => {
        expect(result.current.granted).toBe(true)
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.FILE_READ,
        level: PermissionLevel.READ,
      })
    })

    it('应该返回未授予状态', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false)

      const { result } = renderHook(() =>
        usePermissionCheck(
          'adapter',
          'test-adapter',
          PermissionType.SYSTEM_ADMIN,
          PermissionLevel.ADMIN
        )
      )

      await waitFor(() => {
        expect(result.current.granted).toBe(false)
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该处理检查错误', async () => {
      mockPermissionService.checkPermission.mockRejectedValue(
        new Error('Check failed')
      )

      const { result } = renderHook(() =>
        usePermissionCheck(
          'adapter',
          'test-adapter',
          PermissionType.FILE_READ,
          PermissionLevel.READ
        )
      )

      await waitFor(() => {
        expect(result.current.granted).toBe(false)
        expect(result.current.error).toBeTruthy()
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该支持重新检查', async () => {
      const { result } = renderHook(() =>
        usePermissionCheck(
          'adapter',
          'test-adapter',
          PermissionType.FILE_READ,
          PermissionLevel.READ
        )
      )

      await waitFor(() => {
        expect(result.current.granted).toBe(true)
      })

      mockPermissionService.checkPermission.mockClear()
      mockPermissionService.checkPermission.mockResolvedValue(false)

      await act(async () => {
        await result.current.recheck()
      })

      await waitFor(() => {
        expect(result.current.granted).toBe(false)
      })
    })
  })
})

describe('usePermissionStats Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.getPermissionStats.mockResolvedValue(mockStats)
  })

  describe('权限统计', () => {
    it('应该加载权限统计信息', async () => {
      const { result } = renderHook(() =>
        usePermissionStats('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockStats)
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.getPermissionStats).toHaveBeenCalledWith(
        'adapter',
        'test-adapter'
      )
    })

    it('应该支持重新加载统计', async () => {
      const { result } = renderHook(() =>
        usePermissionStats('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockStats)
      })

      mockPermissionService.getPermissionStats.mockClear()

      await act(async () => {
        await result.current.reload()
      })

      expect(mockPermissionService.getPermissionStats).toHaveBeenCalledTimes(1)
    })
  })
})

describe('usePermissionUsageLogs Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.getPermissionUsageLogs.mockResolvedValue(
      mockUsageLogs
    )
  })

  describe('使用日志', () => {
    it('应该加载权限使用日志', async () => {
      const { result } = renderHook(() =>
        usePermissionUsageLogs('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.logs).toEqual(mockUsageLogs)
        expect(result.current.loading).toBe(false)
      })

      expect(mockPermissionService.getPermissionUsageLogs).toHaveBeenCalledWith(
        {
          entityType: 'adapter',
          entityId: 'test-adapter',
          permissionType: undefined,
          limit: 100,
          offset: 0,
        }
      )
    })

    it('应该支持分页加载', async () => {
      const { result } = renderHook(() =>
        usePermissionUsageLogs('adapter', 'test-adapter', undefined, 10)
      )

      await waitFor(() => {
        expect(result.current.logs).toEqual(mockUsageLogs)
        expect(result.current.hasMore).toBe(false)
      })

      mockPermissionService.getPermissionUsageLogs.mockClear()
      const moreLogs = Array.from({ length: 10 }, (_, i) => ({
        ...mockUsageLogs[0],
        id: `log-${i + 3}`,
      }))
      mockPermissionService.getPermissionUsageLogs.mockResolvedValue(moreLogs)

      await act(async () => {
        result.current.loadMore()
      })

      await waitFor(() => {
        expect(result.current.logs.length).toBe(mockUsageLogs.length + moreLogs.length)
        expect(result.current.hasMore).toBe(true)
      })
    })

    it('应该支持重新加载日志', async () => {
      const { result } = renderHook(() =>
        usePermissionUsageLogs('adapter', 'test-adapter')
      )

      await waitFor(() => {
        expect(result.current.logs).toEqual(mockUsageLogs)
      })

      mockPermissionService.getPermissionUsageLogs.mockClear()

      await act(async () => {
        result.current.reload()
      })

      expect(mockPermissionService.getPermissionUsageLogs).toHaveBeenCalled()
    })
  })
})

describe('usePermissionPresets Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.applyPermissionPreset.mockResolvedValue(undefined)
  })

  describe('权限预设', () => {
    it('应该返回所有预设', () => {
      const { result } = renderHook(() => usePermissionPresets())

      expect(result.current.presets).toEqual(
        mockPermissionService.PERMISSION_PRESETS
      )
    })

    it('应该应用权限预设', async () => {
      const { result } = renderHook(() => usePermissionPresets())

      let success: boolean = false
      await act(async () => {
        success = await result.current.applyPreset(
          'adapter',
          'test-adapter',
          'FULL_ACCESS'
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.applyPermissionPreset).toHaveBeenCalledWith(
        'adapter',
        'test-adapter',
        'FULL_ACCESS',
        'user'
      )
    })

    it('应该处理应用预设错误', async () => {
      mockPermissionService.applyPermissionPreset.mockRejectedValue(
        new Error('Apply failed')
      )

      const { result } = renderHook(() => usePermissionPresets())

      await expect(
        act(async () => {
          await result.current.applyPreset(
            'adapter',
            'test-adapter',
            'FULL_ACCESS'
          )
        })
      ).rejects.toThrow('Apply failed')
    })
  })
})

// ==================== 集成测试 ====================

describe('Permission Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionService.getAllPermissions.mockResolvedValue(mockPermissions)
    mockPermissionService.getEntityGrants.mockResolvedValue(mockGrants)
    mockPermissionService.grantPermission.mockResolvedValue(undefined)
    mockPermissionService.checkPermission.mockResolvedValue(true)
  })

  it('应该完成权限管理完整流程', async () => {
    // 1. 加载所有权限
    const permissionsHook = renderHook(() => usePermissions())

    await waitFor(() => {
      expect(permissionsHook.result.current.permissions).toEqual(mockPermissions)
    })

    // 2. 加载实体权限授权
    const grantsHook = renderHook(() =>
      useEntityGrants('adapter', 'test-adapter')
    )

    await waitFor(() => {
      expect(grantsHook.result.current.grants).toEqual(mockGrants)
    })

    // 3. 授予新权限
    await act(async () => {
      await grantsHook.result.current.grant(
        PermissionType.NETWORK_ACCESS,
        PermissionLevel.EXECUTE
      )
    })

    // 4. 检查权限是否已授予
    const checkHook = renderHook(() =>
      usePermissionCheck(
        'adapter',
        'test-adapter',
        PermissionType.NETWORK_ACCESS,
        PermissionLevel.EXECUTE
      )
    )

    await waitFor(() => {
      expect(checkHook.result.current.granted).toBe(true)
    })
  })
})


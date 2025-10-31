/**
 * usePermission Hooks 测试套件
 * 
 * 测试权限管理相关的所有 Hooks，包括权限查询、授权、撤销等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
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
import { renderHook, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}))

// Mock 权限服务 - 必须在 vi.mock 之前定义
vi.mock('@/services/permissionService', () => ({
  getAllPermissions: vi.fn().mockResolvedValue([]),
  getEntityGrants: vi.fn().mockResolvedValue([]),
  getPendingGrants: vi.fn().mockResolvedValue([]),
  grantPermission: vi.fn().mockResolvedValue(undefined),
  revokePermission: vi.fn().mockResolvedValue(undefined),
  denyPermission: vi.fn().mockResolvedValue(undefined),
  checkPermission: vi.fn().mockResolvedValue(false),
  getPermissionStats: vi.fn().mockResolvedValue({ total_grants: 0, active_grants: 0, pending_grants: 0, denied_grants: 0, revoked_grants: 0 }),
  getPermissionUsageLogs: vi.fn().mockResolvedValue([]),
  applyPermissionPreset: vi.fn().mockResolvedValue(undefined),
  PERMISSION_PRESETS: {
    BASIC_ADAPTER: [
      { type: 'FILE_READ', level: 'READ_ONLY' },
      { type: 'SYSTEM_INFO', level: 'READ_ONLY' },
    ],
    FILE_PROCESSOR: [
      { type: 'FILE_READ', level: 'READ_ONLY' },
      { type: 'FILE_WRITE', level: 'READ_WRITE' },
    ],
    NETWORK_SERVICE: [
      { type: 'NETWORK_HTTP', level: 'FULL' },
      { type: 'NETWORK_WEBSOCKET', level: 'READ_WRITE' },
    ],
    DATA_ANALYZER: [
      { type: 'FILE_READ', level: 'READ_ONLY' },
      { type: 'APP_DATABASE', level: 'READ_ONLY' },
    ],
    SYSTEM_TOOL: [
      { type: 'SYSTEM_INFO', level: 'READ_ONLY' },
      { type: 'SYSTEM_CLIPBOARD', level: 'READ_WRITE' },
    ],
    TRUSTED: [
      { type: 'FILE_READ', level: 'FULL' },
      { type: 'FILE_WRITE', level: 'FULL' },
      { type: 'NETWORK_HTTP', level: 'FULL' },
    ],
  },
}))

// 获取 mocked 模块的引用
import * as permissionServiceModule from '@/services/permissionService'
const mockPermissionService = permissionServiceModule as any

// ==================== 测试数据 ====================

const mockPermissions = [
  {
    type: PermissionType.FILE_READ,
    name: '文件读取',
    description: '读取文件内容',
    category: 'file',
    required_level: PermissionLevel.READ_ONLY,
  },
  {
    type: PermissionType.FILE_WRITE,
    name: '文件写入',
    description: '写入文件内容',
    category: 'file',
    required_level: PermissionLevel.READ_WRITE,
  },
  {
    type: PermissionType.NETWORK_HTTP,
    name: '网络访问',
    description: '访问网络',
    category: 'network',
    required_level: PermissionLevel.FULL,
  },
]

const mockGrants = [
  {
    id: 'grant-1',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_READ,
    level: PermissionLevel.READ_ONLY,
    status: PermissionStatus.GRANTED,
    granted_at: '2025-01-01T00:00:00Z',
    granted_by: 'user',
  },
  {
    id: 'grant-2',
    entity_type: 'adapter',
    entity_id: 'test-adapter',
    permission_type: PermissionType.FILE_WRITE,
    level: PermissionLevel.READ_WRITE,
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
  least_used_permission: PermissionType.ADVANCED_ADMIN,
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
    consoleMock.restore()
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
          PermissionType.NETWORK_HTTP,
          PermissionLevel.FULL
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.grantPermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.NETWORK_HTTP,
        level: PermissionLevel.FULL,
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
          PermissionType.ADVANCED_ADMIN,
          '权限过高'
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.denyPermission).toHaveBeenCalledWith({
        entity_type: 'adapter',
        entity_id: 'test-adapter',
        permission_type: PermissionType.ADVANCED_ADMIN,
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
          PermissionLevel.READ_ONLY
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
        level: PermissionLevel.READ_ONLY,
      })
    })

    it('应该返回未授予状态', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false)

      const { result } = renderHook(() =>
        usePermissionCheck(
          'adapter',
          'test-adapter',
          PermissionType.ADVANCED_ADMIN,
          PermissionLevel.FULL
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
          PermissionLevel.READ_ONLY
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
          PermissionLevel.READ_ONLY
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
      // 创建第一页数据（满页10条）
      const firstPageLogs = Array.from({ length: 10 }, (_, i) => ({
        ...mockUsageLogs[0],
        id: `log-${i + 1}`,
      }))
      mockPermissionService.getPermissionUsageLogs.mockResolvedValue(firstPageLogs)

      const { result } = renderHook(() =>
        usePermissionUsageLogs('adapter', 'test-adapter', undefined, 10)
      )

      await waitFor(() => {
        expect(result.current.logs).toEqual(firstPageLogs)
        expect(result.current.hasMore).toBe(true)
      })

      mockPermissionService.getPermissionUsageLogs.mockClear()
      const secondPageLogs = Array.from({ length: 10 }, (_, i) => ({
        ...mockUsageLogs[0],
        id: `log-${i + 11}`,
      }))
      mockPermissionService.getPermissionUsageLogs.mockResolvedValue(secondPageLogs)

      await act(async () => {
        result.current.loadMore()
      })

      await waitFor(() => {
        expect(result.current.logs.length).toBe(firstPageLogs.length + secondPageLogs.length)
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
          'TRUSTED'
        )
      })

      expect(success).toBe(true)
      expect(mockPermissionService.applyPermissionPreset).toHaveBeenCalledWith(
        'adapter',
        'test-adapter',
        'TRUSTED',
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
            'TRUSTED'
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
        PermissionType.NETWORK_HTTP,
        PermissionLevel.FULL
      )
    })

    // 4. 检查权限是否已授予
    const checkHook = renderHook(() =>
      usePermissionCheck(
        'adapter',
        'test-adapter',
        PermissionType.NETWORK_HTTP,
        PermissionLevel.FULL
      )
    )

    await waitFor(() => {
      expect(checkHook.result.current.granted).toBe(true)
    })
  })
})


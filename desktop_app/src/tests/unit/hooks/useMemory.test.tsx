/**
 * useMemory Hooks 测试套件
 * 
 * 测试内存管理相关的所有 Hooks，包括内存监控、清理、泄漏检测、优化等
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useMemoryInfo,
  useMemoryPoolStats,
  useMemorySnapshots,
  useMemoryLeakDetection,
  useMemoryCleanup,
  useMemoryOptimization,
  useMemoryStatus,
  useMemoryThresholds
} from '@/hooks/useMemory'
import { waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock MemoryService
const mockMemoryService = {
  getMemoryInfo: vi.fn(),
  getMemoryPoolStats: vi.fn(),
  getMemorySnapshots: vi.fn(),
  createMemorySnapshot: vi.fn(),
  detectMemoryLeaks: vi.fn(),
  getMemoryLeakReports: vi.fn(),
  startLeakDetection: vi.fn(),
  stopLeakDetection: vi.fn(),
  cleanupMemory: vi.fn(),
  startAutoCleanup: vi.fn(),
  stopAutoCleanup: vi.fn(),
  startSnapshotCollection: vi.fn(),
  stopSnapshotCollection: vi.fn(),
  getMemoryStatus: vi.fn(),
  getMemorySummary: vi.fn(),
  getMemoryThresholds: vi.fn(),
  setMemoryThresholds: vi.fn(),
}

vi.mock('@/services/memoryService', () => ({
  default: mockMemoryService,
}))

// ==================== 测试数据 ====================

const mockMemoryInfo = {
  total_memory: 16384 * 1024 * 1024, // 16GB
  used_memory: 8192 * 1024 * 1024,   // 8GB
  free_memory: 8192 * 1024 * 1024,   // 8GB
  available_memory: 8192 * 1024 * 1024,
  memory_usage_percentage: 50.0,
  swap_total: 2048 * 1024 * 1024,    // 2GB
  swap_used: 0,
  swap_free: 2048 * 1024 * 1024,
  process_memory: {
    resident: 256 * 1024 * 1024,     // 256MB
    virtual: 512 * 1024 * 1024,      // 512MB
    heap_used: 128 * 1024 * 1024,    // 128MB
    heap_total: 256 * 1024 * 1024,   // 256MB
  },
}

const mockPoolStats = [
  {
    pool_name: 'main',
    pool_type: 'system',
    total_size: 1024 * 1024 * 1024,  // 1GB
    used_size: 512 * 1024 * 1024,    // 512MB
    free_size: 512 * 1024 * 1024,    // 512MB
    allocation_count: 1000,
    deallocation_count: 800,
    fragmentation_ratio: 0.1,
    peak_usage: 768 * 1024 * 1024,   // 768MB
  },
  {
    pool_name: 'cache',
    pool_type: 'cache',
    total_size: 256 * 1024 * 1024,   // 256MB
    used_size: 128 * 1024 * 1024,    // 128MB
    free_size: 128 * 1024 * 1024,    // 128MB
    allocation_count: 500,
    deallocation_count: 400,
    fragmentation_ratio: 0.05,
    peak_usage: 200 * 1024 * 1024,   // 200MB
  },
]

const mockSnapshots = [
  {
    id: 'snapshot-1',
    timestamp: '2025-01-01T12:00:00Z',
    memory_info: mockMemoryInfo,
    pool_stats: mockPoolStats,
    metadata: {
      trigger: 'manual',
      description: 'Test snapshot',
    },
  },
  {
    id: 'snapshot-2',
    timestamp: '2025-01-01T11:00:00Z',
    memory_info: {
      ...mockMemoryInfo,
      used_memory: 7168 * 1024 * 1024, // 7GB
      memory_usage_percentage: 43.75,
    },
    pool_stats: mockPoolStats,
    metadata: {
      trigger: 'automatic',
      description: 'Scheduled snapshot',
    },
  },
]

const mockLeaks = [
  {
    leak_id: 'leak-1',
    detected_at: '2025-01-01T12:00:00Z',
    leak_type: 'memory_growth',
    severity: 'medium' as const,
    description: 'Continuous memory growth detected in main pool',
    affected_component: 'main_pool',
    memory_growth_rate: 1024 * 1024, // 1MB/s
    suggested_actions: ['Investigate allocation patterns', 'Check for unclosed resources'],
    metadata: {
      growth_duration: 300, // 5 minutes
      peak_usage: 768 * 1024 * 1024,
    },
  },
]

const mockCleanupResult = {
  cleaned_bytes: 256 * 1024 * 1024, // 256MB
  freed_objects: 1000,
  execution_time_ms: 1500,
  details: {
    cache_cleared: 128 * 1024 * 1024,
    temp_files_removed: 64 * 1024 * 1024,
    unused_buffers_freed: 64 * 1024 * 1024,
  },
}

const mockMemoryStatus = 'normal' as const

const mockMemorySummary = {
  status: 'normal' as const,
  usage_percentage: 50.0,
  peak_usage_percentage: 75.0,
  available_bytes: 8192 * 1024 * 1024,
  fragmentation_ratio: 0.1,
  gc_pressure: 0.2,
  recent_leaks_count: 0,
  cleanup_effectiveness: 0.85,
}

const mockThresholds = {
  warning_threshold: 75.0,
  critical_threshold: 90.0,
  cleanup_threshold: 80.0,
  gc_threshold: 85.0,
  leak_detection_threshold: 0.15,
  fragmentation_threshold: 0.3,
}

// ==================== 测试套件 ====================

describe('useMemoryInfo Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
    vi.useFakeTimers()
  })

  afterAll(() => {
    consoleMock.restore()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.getMemoryInfo.mockResolvedValue(mockMemoryInfo)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useMemoryInfo())

      expect(result.current.memoryInfo).toBe(null)
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.refresh).toBe('function')
    })

    it('应该获取内存信息', async () => {
      const { result } = renderHook(() => useMemoryInfo())

      await waitFor(() => {
        expect(result.current.memoryInfo).toEqual(mockMemoryInfo)
        expect(result.current.loading).toBe(false)
      })

      expect(mockMemoryService.getMemoryInfo).toHaveBeenCalled()
    })

    it('应该支持自定义刷新间隔', async () => {
      renderHook(() => useMemoryInfo(1000))

      // 初始调用
      await waitFor(() => {
        expect(mockMemoryService.getMemoryInfo).toHaveBeenCalledTimes(1)
      })

      // 快进时间
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      await waitFor(() => {
        expect(mockMemoryService.getMemoryInfo).toHaveBeenCalledTimes(2)
      })
    })

    it('应该处理获取错误', async () => {
      const testError = new Error('Memory info unavailable')
      mockMemoryService.getMemoryInfo.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryInfo())

      await waitFor(() => {
        expect(result.current.error).toBe('获取内存信息失败')
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该支持手动刷新', async () => {
      const { result } = renderHook(() => useMemoryInfo(0)) // 禁用自动刷新

      await waitFor(() => {
        expect(mockMemoryService.getMemoryInfo).toHaveBeenCalledTimes(1)
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockMemoryService.getMemoryInfo).toHaveBeenCalledTimes(2)
    })
  })
})

describe('useMemoryPoolStats Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.getMemoryPoolStats.mockResolvedValue(mockPoolStats)
  })

  describe('内存池统计', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useMemoryPoolStats())

      expect(result.current.poolStats).toEqual([])
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(null)
    })

    it('应该获取内存池统计信息', async () => {
      const { result } = renderHook(() => useMemoryPoolStats())

      await waitFor(() => {
        expect(result.current.poolStats).toEqual(mockPoolStats)
        expect(result.current.loading).toBe(false)
      })

      expect(mockMemoryService.getMemoryPoolStats).toHaveBeenCalled()
    })

    it('应该处理获取错误', async () => {
      const testError = new Error('Pool stats unavailable')
      mockMemoryService.getMemoryPoolStats.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryPoolStats())

      await waitFor(() => {
        expect(result.current.error).toBe('获取内存池统计失败')
      })
    })

    it('应该支持自定义刷新间隔', async () => {
      vi.useFakeTimers()

      renderHook(() => useMemoryPoolStats(2000))

      await waitFor(() => {
        expect(mockMemoryService.getMemoryPoolStats).toHaveBeenCalledTimes(1)
      })

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(mockMemoryService.getMemoryPoolStats).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })
  })
})

describe('useMemorySnapshots Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.getMemorySnapshots.mockResolvedValue(mockSnapshots)
    mockMemoryService.createMemorySnapshot.mockResolvedValue(undefined)
  })

  describe('内存快照', () => {
    it('应该获取内存快照列表', async () => {
      const { result } = renderHook(() => useMemorySnapshots())

      await waitFor(() => {
        expect(result.current.snapshots).toEqual(mockSnapshots)
        expect(result.current.loading).toBe(false)
      })

      expect(mockMemoryService.getMemorySnapshots).toHaveBeenCalledWith(50)
    })

    it('应该支持自定义快照限制数量', async () => {
      const { result } = renderHook(() => useMemorySnapshots(20))

      await waitFor(() => {
        expect(mockMemoryService.getMemorySnapshots).toHaveBeenCalledWith(20)
      })
    })

    it('应该创建新的内存快照', async () => {
      const { result } = renderHook(() => useMemorySnapshots())

      await waitFor(() => {
        expect(result.current.snapshots).toHaveLength(2)
      })

      await act(async () => {
        await result.current.createSnapshot()
      })

      expect(mockMemoryService.createMemorySnapshot).toHaveBeenCalled()
      expect(mockMemoryService.getMemorySnapshots).toHaveBeenCalledTimes(2) // 初始 + 创建后刷新
    })

    it('应该处理快照创建错误', async () => {
      const testError = new Error('Snapshot creation failed')
      mockMemoryService.createMemorySnapshot.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemorySnapshots())

      await expect(
        act(async () => {
          await result.current.createSnapshot()
        })
      ).rejects.toThrow('Snapshot creation failed')
    })
  })
})

describe('useMemoryLeakDetection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.detectMemoryLeaks.mockResolvedValue(mockLeaks)
    mockMemoryService.getMemoryLeakReports.mockResolvedValue(mockLeaks)
    mockMemoryService.startLeakDetection.mockReturnValue(123) // 返回 timer ID
    mockMemoryService.stopLeakDetection.mockImplementation(() => {})
  })

  describe('内存泄漏检测', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useMemoryLeakDetection(false))

      expect(result.current.leaks).toEqual([])
      expect(result.current.detecting).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('应该自动开始泄漏检测', async () => {
      const { result } = renderHook(() => useMemoryLeakDetection(true, 600000))

      await waitFor(() => {
        expect(result.current.leaks).toEqual(mockLeaks)
      })

      expect(mockMemoryService.detectMemoryLeaks).toHaveBeenCalled()
      expect(mockMemoryService.startLeakDetection).toHaveBeenCalledWith(600000)
    })

    it('应该手动检测泄漏', async () => {
      const { result } = renderHook(() => useMemoryLeakDetection(false))

      await act(async () => {
        const detectedLeaks = await result.current.detectLeaks()
        expect(detectedLeaks).toEqual(mockLeaks)
      })

      expect(mockMemoryService.detectMemoryLeaks).toHaveBeenCalled()
      expect(result.current.leaks).toEqual(mockLeaks)
    })

    it('应该获取泄漏报告', async () => {
      const { result } = renderHook(() => useMemoryLeakDetection(false))

      await act(async () => {
        const reports = await result.current.getLeakReports(10)
        expect(reports).toEqual(mockLeaks)
      })

      expect(mockMemoryService.getMemoryLeakReports).toHaveBeenCalledWith(10)
    })

    it('应该处理检测错误', async () => {
      const testError = new Error('Leak detection failed')
      mockMemoryService.detectMemoryLeaks.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryLeakDetection(false))

      await expect(
        act(async () => {
          await result.current.detectLeaks()
        })
      ).rejects.toThrow('Leak detection failed')

      expect(result.current.error).toBe('检测内存泄漏失败')
    })

    it('应该在卸载时停止检测', () => {
      const { unmount } = renderHook(() => useMemoryLeakDetection(true))

      unmount()

      expect(mockMemoryService.stopLeakDetection).toHaveBeenCalledWith(123)
    })
  })
})

describe('useMemoryCleanup Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.cleanupMemory.mockResolvedValue(mockCleanupResult)
  })

  describe('内存清理', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useMemoryCleanup())

      expect(result.current.cleaning).toBe(false)
      expect(result.current.lastResult).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('应该执行内存清理', async () => {
      const { result } = renderHook(() => useMemoryCleanup())

      let cleanupResult: any
      await act(async () => {
        cleanupResult = await result.current.cleanup()
      })

      expect(mockMemoryService.cleanupMemory).toHaveBeenCalled()
      expect(cleanupResult).toEqual(mockCleanupResult)
      expect(result.current.lastResult).toEqual(mockCleanupResult)
    })

    it('应该管理清理状态', async () => {
      let resolveCleanup: (value: any) => void
      const cleanupPromise = new Promise(resolve => {
        resolveCleanup = resolve
      })

      mockMemoryService.cleanupMemory.mockReturnValue(cleanupPromise)

      const { result } = renderHook(() => useMemoryCleanup())

      act(() => {
        result.current.cleanup()
      })

      expect(result.current.cleaning).toBe(true)

      await act(async () => {
        resolveCleanup!(mockCleanupResult)
      })

      expect(result.current.cleaning).toBe(false)
    })

    it('应该处理清理错误', async () => {
      const testError = new Error('Cleanup failed')
      mockMemoryService.cleanupMemory.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryCleanup())

      await expect(
        act(async () => {
          await result.current.cleanup()
        })
      ).rejects.toThrow('Cleanup failed')

      expect(result.current.error).toBe('内存清理失败')
    })
  })
})

describe('useMemoryOptimization Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.startAutoCleanup.mockReturnValue(111)
    mockMemoryService.startLeakDetection.mockReturnValue(222)
    mockMemoryService.startSnapshotCollection.mockReturnValue(333)
    mockMemoryService.stopAutoCleanup.mockImplementation(() => {})
    mockMemoryService.stopLeakDetection.mockImplementation(() => {})
    mockMemoryService.stopSnapshotCollection.mockImplementation(() => {})
  })

  describe('内存优化', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useMemoryOptimization())

      expect(result.current.optimizationEnabled).toBe(false)
      expect(result.current.currentOptions).toBeDefined()
      expect(typeof result.current.startOptimization).toBe('function')
      expect(typeof result.current.stopOptimization).toBe('function')
    })

    it('应该启动内存优化', () => {
      const { result } = renderHook(() => useMemoryOptimization({
        auto_cleanup: true,
        leak_detection: true,
        snapshot_enabled: true,
        cleanup_interval: 60,
        leak_detection_interval: 600,
        snapshot_interval: 300,
      }))

      act(() => {
        result.current.startOptimization()
      })

      expect(result.current.optimizationEnabled).toBe(true)
      expect(mockMemoryService.startAutoCleanup).toHaveBeenCalledWith(60000)
      expect(mockMemoryService.startLeakDetection).toHaveBeenCalledWith(600000)
      expect(mockMemoryService.startSnapshotCollection).toHaveBeenCalledWith(300000)
    })

    it('应该停止内存优化', () => {
      const { result } = renderHook(() => useMemoryOptimization())

      // 先启动
      act(() => {
        result.current.startOptimization()
      })

      // 再停止
      act(() => {
        result.current.stopOptimization()
      })

      expect(result.current.optimizationEnabled).toBe(false)
      expect(mockMemoryService.stopAutoCleanup).toHaveBeenCalledWith(111)
      expect(mockMemoryService.stopLeakDetection).toHaveBeenCalledWith(222)
      expect(mockMemoryService.stopSnapshotCollection).toHaveBeenCalledWith(333)
    })

    it('应该更新优化选项', () => {
      const { result } = renderHook(() => useMemoryOptimization())

      act(() => {
        result.current.updateOptions({
          auto_cleanup: false,
          cleanup_interval: 120,
        })
      })

      expect(result.current.currentOptions.auto_cleanup).toBe(false)
      expect(result.current.currentOptions.cleanup_interval).toBe(120)
    })

    it('应该在更新选项后重新启动优化', () => {
      const { result } = renderHook(() => useMemoryOptimization())

      // 启动优化
      act(() => {
        result.current.startOptimization()
      })

      expect(result.current.optimizationEnabled).toBe(true)

      // 更新选项（应该自动重启）
      act(() => {
        result.current.updateOptions({ cleanup_interval: 90 })
      })

      // 验证重启逻辑
      expect(mockMemoryService.stopAutoCleanup).toHaveBeenCalled()
      expect(mockMemoryService.stopLeakDetection).toHaveBeenCalled()
      expect(mockMemoryService.stopSnapshotCollection).toHaveBeenCalled()
    })

    it('应该在卸载时停止优化', () => {
      const { result, unmount } = renderHook(() => useMemoryOptimization())

      act(() => {
        result.current.startOptimization()
      })

      unmount()

      expect(mockMemoryService.stopAutoCleanup).toHaveBeenCalled()
      expect(mockMemoryService.stopLeakDetection).toHaveBeenCalled()
      expect(mockMemoryService.stopSnapshotCollection).toHaveBeenCalled()
    })
  })
})

describe('useMemoryStatus Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.getMemoryStatus.mockResolvedValue(mockMemoryStatus)
    mockMemoryService.getMemorySummary.mockResolvedValue(mockMemorySummary)
  })

  describe('内存状态', () => {
    it('应该获取内存状态和摘要', async () => {
      const { result } = renderHook(() => useMemoryStatus())

      await waitFor(() => {
        expect(result.current.status).toBe(mockMemoryStatus)
        expect(result.current.summary).toEqual(mockMemorySummary)
        expect(result.current.loading).toBe(false)
      })

      expect(mockMemoryService.getMemoryStatus).toHaveBeenCalled()
      expect(mockMemoryService.getMemorySummary).toHaveBeenCalled()
    })

    it('应该处理状态获取错误', async () => {
      const testError = new Error('Status unavailable')
      mockMemoryService.getMemoryStatus.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryStatus())

      await waitFor(() => {
        expect(result.current.error).toBe('获取内存状态失败')
      })
    })

    it('应该支持手动刷新', async () => {
      const { result } = renderHook(() => useMemoryStatus())

      await waitFor(() => {
        expect(mockMemoryService.getMemoryStatus).toHaveBeenCalledTimes(1)
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockMemoryService.getMemoryStatus).toHaveBeenCalledTimes(2)
    })
  })
})

describe('useMemoryThresholds Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryService.getMemoryThresholds.mockResolvedValue(mockThresholds)
    mockMemoryService.setMemoryThresholds.mockResolvedValue(undefined)
  })

  describe('内存阈值', () => {
    it('应该获取内存阈值', async () => {
      const { result } = renderHook(() => useMemoryThresholds())

      await waitFor(() => {
        expect(result.current.thresholds).toEqual(mockThresholds)
        expect(result.current.loading).toBe(false)
      })

      expect(mockMemoryService.getMemoryThresholds).toHaveBeenCalled()
    })

    it('应该更新内存阈值', async () => {
      const { result } = renderHook(() => useMemoryThresholds())

      const newThresholds = {
        ...mockThresholds,
        warning_threshold: 80.0,
        critical_threshold: 95.0,
      }

      await act(async () => {
        await result.current.updateThresholds(newThresholds)
      })

      expect(mockMemoryService.setMemoryThresholds).toHaveBeenCalledWith(newThresholds)
      expect(result.current.thresholds).toEqual(newThresholds)
    })

    it('应该处理阈值更新错误', async () => {
      const testError = new Error('Update failed')
      mockMemoryService.setMemoryThresholds.mockRejectedValue(testError)

      const { result } = renderHook(() => useMemoryThresholds())

      await expect(
        act(async () => {
          await result.current.updateThresholds(mockThresholds)
        })
      ).rejects.toThrow('Update failed')

      expect(result.current.error).toBe('更新内存阈值失败')
    })

    it('应该支持手动刷新阈值', async () => {
      const { result } = renderHook(() => useMemoryThresholds())

      await waitFor(() => {
        expect(mockMemoryService.getMemoryThresholds).toHaveBeenCalledTimes(1)
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockMemoryService.getMemoryThresholds).toHaveBeenCalledTimes(2)
    })
  })
})

// ==================== 集成测试 ====================

describe('Memory Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置所有服务的 mock 返回值
    mockMemoryService.getMemoryInfo.mockResolvedValue(mockMemoryInfo)
    mockMemoryService.getMemoryPoolStats.mockResolvedValue(mockPoolStats)
    mockMemoryService.detectMemoryLeaks.mockResolvedValue(mockLeaks)
    mockMemoryService.cleanupMemory.mockResolvedValue(mockCleanupResult)
    mockMemoryService.createMemorySnapshot.mockResolvedValue(undefined)
  })

  it('应该执行完整的内存监控和优化流程', async () => {
    const memoryInfoHook = renderHook(() => useMemoryInfo(0)) // 禁用自动刷新
    const leakDetectionHook = renderHook(() => useMemoryLeakDetection(false))
    const cleanupHook = renderHook(() => useMemoryCleanup())
    const snapshotHook = renderHook(() => useMemorySnapshots())

    // 1. 获取当前内存信息
    await waitFor(() => {
      expect(memoryInfoHook.result.current.memoryInfo).toEqual(mockMemoryInfo)
    })

    // 2. 检测内存泄漏
    await act(async () => {
      await leakDetectionHook.result.current.detectLeaks()
    })

    expect(leakDetectionHook.result.current.leaks).toEqual(mockLeaks)

    // 3. 创建内存快照
    await act(async () => {
      await snapshotHook.result.current.createSnapshot()
    })

    // 4. 执行内存清理
    let cleanupResult: any
    await act(async () => {
      cleanupResult = await cleanupHook.result.current.cleanup()
    })

    expect(cleanupResult).toEqual(mockCleanupResult)

    // 5. 验证所有服务被正确调用
    expect(mockMemoryService.getMemoryInfo).toHaveBeenCalled()
    expect(mockMemoryService.detectMemoryLeaks).toHaveBeenCalled()
    expect(mockMemoryService.createMemorySnapshot).toHaveBeenCalled()
    expect(mockMemoryService.cleanupMemory).toHaveBeenCalled()
  })

  it('应该处理并发内存操作', async () => {
    const memoryInfoHook = renderHook(() => useMemoryInfo(0))
    const poolStatsHook = renderHook(() => useMemoryPoolStats(0))
    const statusHook = renderHook(() => useMemoryStatus(0))

    // 等待所有初始加载完成
    await Promise.all([
      waitFor(() => expect(memoryInfoHook.result.current.loading).toBe(false)),
      waitFor(() => expect(poolStatsHook.result.current.loading).toBe(false)),
      waitFor(() => expect(statusHook.result.current.loading).toBe(false)),
    ])

    // 并发执行刷新操作
    await act(async () => {
      await Promise.all([
        memoryInfoHook.result.current.refresh(),
        poolStatsHook.result.current.refresh(),
        statusHook.result.current.refresh(),
      ])
    })

    // 验证所有服务都被调用
    expect(mockMemoryService.getMemoryInfo).toHaveBeenCalledTimes(2) // 初始 + 刷新
    expect(mockMemoryService.getMemoryPoolStats).toHaveBeenCalledTimes(2)
    expect(mockMemoryService.getMemoryStatus).toHaveBeenCalledTimes(2)
  })

  it('应该正确处理内存优化生命周期', async () => {
    const { result } = renderHook(() => useMemoryOptimization({
      auto_cleanup: true,
      leak_detection: true,
      snapshot_enabled: true,
    }))

    // 启动优化
    act(() => {
      result.current.startOptimization()
    })

    expect(result.current.optimizationEnabled).toBe(true)
    expect(mockMemoryService.startAutoCleanup).toHaveBeenCalled()
    expect(mockMemoryService.startLeakDetection).toHaveBeenCalled()
    expect(mockMemoryService.startSnapshotCollection).toHaveBeenCalled()

    // 更新配置
    act(() => {
      result.current.updateOptions({ auto_cleanup: false })
    })

    // 停止优化
    act(() => {
      result.current.stopOptimization()
    })

    expect(result.current.optimizationEnabled).toBe(false)
  })
})

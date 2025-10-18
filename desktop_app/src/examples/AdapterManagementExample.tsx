/**
 * 适配器管理使用示例
 * 
 * 展示如何使用 useAdapter Hook 和 adapterStore 进行适配器管理
 */

import React, { useEffect, useState } from 'react'
import { useAdapter } from '@/hooks/useAdapter'
import { useAdapterStore } from '@/stores/adapterStore'
import { AdapterStatus, AdapterType } from '@/services/adapter'

// ==================== 基础使用示例 ====================

export function AdapterManagementExample() {
  const {
    adapters,
    isLoading,
    error,
    refreshAdapters,
    installAdapter,
    uninstallAdapter,
    loadAdapter,
    unloadAdapter,
    isAdapterInstalled,
    isAdapterLoaded,
    getAdapterById
  } = useAdapter({
    autoRefresh: true,
    refreshInterval: 30000
  })

  // 安装适配器示例
  const handleInstall = async (adapterId: string) => {
    try {
      const success = await installAdapter({
        adapterId,
        source: 'market',
        force: false,
        options: {}
      })
      
      if (success) {
        console.log(`适配器 ${adapterId} 安装成功`)
      }
    } catch (err) {
      console.error('安装失败:', err)
    }
  }

  // 卸载适配器示例
  const handleUninstall = async (adapterId: string) => {
    try {
      const success = await uninstallAdapter(adapterId)
      
      if (success) {
        console.log(`适配器 ${adapterId} 卸载成功`)
      }
    } catch (err) {
      console.error('卸载失败:', err)
    }
  }

  // 加载适配器示例
  const handleLoad = async (adapterId: string) => {
    try {
      const success = await loadAdapter(adapterId)
      
      if (success) {
        console.log(`适配器 ${adapterId} 加载成功`)
      }
    } catch (err) {
      console.error('加载失败:', err)
    }
  }

  // 卸载适配器示例
  const handleUnload = async (adapterId: string) => {
    try {
      const success = await unloadAdapter(adapterId)
      
      if (success) {
        console.log(`适配器 ${adapterId} 卸载成功`)
      }
    } catch (err) {
      console.error('卸载失败:', err)
    }
  }

  if (isLoading) {
    return <div>加载中...</div>
  }

  if (error) {
    return <div>错误: {error}</div>
  }

  return (
    <div className="adapter-management">
      <h2>适配器管理</h2>
      
      <div className="actions">
        <button onClick={refreshAdapters}>刷新列表</button>
      </div>

      <div className="adapter-list">
        {adapters.map(adapter => (
          <div key={adapter.name} className="adapter-item">
            <h3>{adapter.name}</h3>
            <p>状态: {adapter.status}</p>
            <p>版本: {adapter.version}</p>
            <p>描述: {adapter.description}</p>
            
            <div className="adapter-actions">
              {!isAdapterInstalled(adapter.name) ? (
                <button onClick={() => handleInstall(adapter.name)}>
                  安装
                </button>
              ) : (
                <>
                  {!isAdapterLoaded(adapter.name) ? (
                    <button onClick={() => handleLoad(adapter.name)}>
                      加载
                    </button>
                  ) : (
                    <button onClick={() => handleUnload(adapter.name)}>
                      卸载
                    </button>
                  )}
                  <button onClick={() => handleUninstall(adapter.name)}>
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== 高级使用示例 ====================

export function AdvancedAdapterExample() {
  const adapterStore = useAdapterStore()
  const {
    adapters,
    searchAdapters,
    getAdapterDetails,
    updateAdapterConfig,
    onAdapterInstalled,
    onAdapterUninstalled,
    onAdapterLoaded,
    onAdapterUnloaded,
    onAdapterError
  } = useAdapter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAdapter, setSelectedAdapter] = useState<string | null>(null)
  const [adapterDetails, setAdapterDetails] = useState<any>(null)

  // 事件监听示例
  useEffect(() => {
    const unsubscribeInstalled = onAdapterInstalled((adapter) => {
      console.log('适配器已安装:', adapter.name)
    })

    const unsubscribeUninstalled = onAdapterUninstalled((adapterId) => {
      console.log('适配器已卸载:', adapterId)
    })

    const unsubscribeLoaded = onAdapterLoaded((adapter) => {
      console.log('适配器已加载:', adapter.name)
    })

    const unsubscribeUnloaded = onAdapterUnloaded((adapterId) => {
      console.log('适配器已卸载:', adapterId)
    })

    const unsubscribeError = onAdapterError((error, adapterId) => {
      console.error('适配器错误:', error, adapterId)
    })

    return () => {
      unsubscribeInstalled()
      unsubscribeUninstalled()
      unsubscribeLoaded()
      unsubscribeUnloaded()
      unsubscribeError()
    }
  }, [onAdapterInstalled, onAdapterUninstalled, onAdapterLoaded, onAdapterUnloaded, onAdapterError])

  // 搜索适配器示例
  const handleSearch = async () => {
    try {
      const results = await searchAdapters({
        query: searchQuery,
        page: 1,
        page_size: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      })
      
      console.log('搜索结果:', results)
    } catch (err) {
      console.error('搜索失败:', err)
    }
  }

  // 获取适配器详情示例
  const handleGetDetails = async (adapterId: string) => {
    try {
      const details = await getAdapterDetails(adapterId)
      setAdapterDetails(details)
      setSelectedAdapter(adapterId)
    } catch (err) {
      console.error('获取详情失败:', err)
    }
  }

  // 更新配置示例
  const handleUpdateConfig = async (adapterId: string, config: Record<string, any>) => {
    try {
      const success = await updateAdapterConfig({
        adapterId,
        config,
        merge: true
      })
      
      if (success) {
        console.log('配置更新成功')
      }
    } catch (err) {
      console.error('配置更新失败:', err)
    }
  }

  // 使用Store的过滤功能
  const filteredAdapters = adapterStore.getFilteredAdapters()
  const stats = adapterStore.stats

  return (
    <div className="advanced-adapter-management">
      <h2>高级适配器管理</h2>
      
      {/* 统计信息 */}
      <div className="stats">
        <h3>统计信息</h3>
        <p>总数: {stats.total}</p>
        <p>已加载: {stats.loaded}</p>
        <p>未加载: {stats.unloaded}</p>
        <p>错误: {stats.error}</p>
        <p>总内存使用: {stats.totalMemoryUsage} MB</p>
      </div>

      {/* 搜索 */}
      <div className="search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索适配器..."
        />
        <button onClick={handleSearch}>搜索</button>
      </div>

      {/* 过滤选项 */}
      <div className="filters">
        <h3>过滤选项</h3>
        <select
          onChange={(e) => {
            const status = e.target.value as AdapterStatus
            adapterStore.setFilters({
              status: status ? [status] : []
            })
          }}
        >
          <option value="">所有状态</option>
          <option value={AdapterStatus.Loaded}>已加载</option>
          <option value={AdapterStatus.Unloaded}>未加载</option>
          <option value={AdapterStatus.Error}>错误</option>
        </select>
      </div>

      {/* 适配器列表 */}
      <div className="adapter-list">
        <h3>适配器列表 ({filteredAdapters.length})</h3>
        {filteredAdapters.map(adapter => (
          <div key={adapter.name} className="adapter-item">
            <h4>{adapter.name}</h4>
            <p>状态: {adapter.status}</p>
            <p>版本: {adapter.version}</p>
            <p>内存使用: {adapter.memory_usage || 0} MB</p>
            
            <button onClick={() => handleGetDetails(adapter.name)}>
              查看详情
            </button>
          </div>
        ))}
      </div>

      {/* 适配器详情 */}
      {selectedAdapter && adapterDetails && (
        <div className="adapter-details">
          <h3>适配器详情: {selectedAdapter}</h3>
          <pre>{JSON.stringify(adapterDetails, null, 2)}</pre>
          
          <button
            onClick={() => handleUpdateConfig(selectedAdapter, {
              auto_load: true,
              memory_limit: 512
            })}
          >
            更新配置
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== 自定义Hook示例 ====================

export function useAdapterWithFilters() {
  const adapterStore = useAdapterStore()
  const adapterHook = useAdapter()

  const [filters, setFilters] = useState({
    status: [] as AdapterStatus[],
    query: '',
    sortBy: 'name' as const,
    sortOrder: 'asc' as const
  })

  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    
    adapterStore.setFilters({
      query: updatedFilters.query,
      status: updatedFilters.status,
      sortBy: updatedFilters.sortBy,
      sortOrder: updatedFilters.sortOrder
    })
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      query: '',
      sortBy: 'name',
      sortOrder: 'asc'
    })
    adapterStore.resetFilters()
  }

  return {
    ...adapterHook,
    filters,
    updateFilters,
    clearFilters,
    filteredAdapters: adapterStore.getFilteredAdapters(),
    stats: adapterStore.stats
  }
}

// ==================== 导出 ====================

export default AdapterManagementExample

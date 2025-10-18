/**
 * 适配器设置组件
 * 
 * 功能：
 * - 适配器列表展示
 * - 安装/卸载适配器
 * - 加载/卸载适配器
 * - 配置管理
 * - 搜索和过滤
 * - 状态监控
 * - 批量操作
 * 
 * @module AdapterSettings
 */

import React, { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AdapterList } from './AdapterList'
import { Button } from '../../common/Button/index'
import { useAdapter } from '@/hooks/useAdapter'
import { useAdapterStore } from '@/stores/adapterStore'
import { useToast } from '@/contexts/ToastContext'
import { 
  AdapterStatus,
  type AdapterInfo,
} from '@/types/adapter'
import styles from './AdapterSettings.module.css'

/**
 * 适配器设置组件属性
 */
export interface AdapterSettingsProps {
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 是否显示统计信息 */
  showStats?: boolean
  /** 是否启用自动刷新 */
  autoRefresh?: boolean
  /** 刷新间隔（毫秒） */
  refreshInterval?: number
}

/**
 * 视图模式类型
 */
type ViewMode = 'list' | 'grid' | 'compact'

/**
 * 适配器设置组件
 */
export const AdapterSettings: React.FC<AdapterSettingsProps> = ({
  className,
  style,
  showStats = true,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const { showToast } = useToast()
  
  // 使用适配器Hook
  const adapter = useAdapter({
    autoRefresh,
    refreshInterval,
    enableRetry: true,
    maxRetries: 3,
  })

  // 从store获取状态
  const adapterStore = useAdapterStore()
  const stats = adapterStore.stats
  const filters = adapterStore.filters
  const setFilters = adapterStore.setFilters
  const resetFilters = adapterStore.resetFilters

  // 本地状态
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())
  // const [showInstallModal, setShowInstallModal] = useState(false)
  // const [showConfigModal, setShowConfigModal] = useState(false)
  // const [currentAdapter, setCurrentAdapter] = useState<AdapterInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 获取过滤后的适配器列表
  const filteredAdapters = useMemo(() => {
    return adapter.adapters.filter(adp => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = adp.name.toLowerCase().includes(query)
        const matchDesc = adp.description?.toLowerCase().includes(query)
        const matchVersion = adp.version?.toLowerCase().includes(query)
        if (!matchName && !matchDesc && !matchVersion) {
          return false
        }
      }

      // 状态过滤
      if (filters.status.length > 0 && !filters.status.includes(adp.status)) {
        return false
      }

      // 安装状态过滤
      if (filters.installed !== null) {
        const isInstalled = adp.status !== AdapterStatus.Unloaded
        if (filters.installed !== isInstalled) {
          return false
        }
      }

      // 加载状态过滤
      if (filters.loaded !== null) {
        const isLoaded = adp.status === AdapterStatus.Loaded
        if (filters.loaded !== isLoaded) {
          return false
        }
      }

      return true
    })
  }, [adapter.adapters, searchQuery, filters])

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true)
      await adapter.refreshAdapters()
      showToast({
        type: 'success',
        title: '刷新成功',
        message: '适配器列表已更新'
      })
    } catch (error) {
      console.error('刷新失败:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [adapter, showToast])

  // 处理搜索
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  // 处理过滤器变化
  const handleFilterChange = useCallback((key: keyof typeof filters, value: any) => {
    setFilters({ [key]: value })
  }, [setFilters])

  // 处理清除过滤器
  const handleClearFilters = useCallback(() => {
    resetFilters()
    setSearchQuery('')
  }, [resetFilters])

  // 处理安装适配器（暂未实现）
  // const handleInstall = useCallback((adapterId: string) => {
  //   setShowInstallModal(true)
  // }, [])

  // 处理卸载适配器
  const handleUninstall = useCallback(async (adapterId: string) => {
    if (!window.confirm(`确定要卸载适配器 "${adapterId}" 吗？`)) {
      return
    }

    try {
      await adapter.uninstallAdapter(adapterId)
    } catch (error) {
      console.error('卸载失败:', error)
    }
  }, [adapter])

  // 处理加载适配器
  const handleLoad = useCallback(async (adapterId: string) => {
    try {
      await adapter.loadAdapter(adapterId)
    } catch (error) {
      console.error('加载失败:', error)
    }
  }, [adapter])

  // 处理卸载适配器
  const handleUnload = useCallback(async (adapterId: string) => {
    try {
      await adapter.unloadAdapter(adapterId)
    } catch (error) {
      console.error('卸载失败:', error)
    }
  }, [adapter])

  // 处理配置适配器（暂未实现）
  const handleConfigure = useCallback((_adapterInfo: AdapterInfo) => {
    // setCurrentAdapter(adapterInfo)
    // setShowConfigModal(true)
    showToast({
      type: 'info',
      title: '配置功能',
      message: '适配器配置功能正在开发中'
    })
  }, [showToast])

  // 处理选择适配器
  const handleSelect = useCallback((adapterId: string, selected: boolean) => {
    setSelectedAdapters(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(adapterId)
      } else {
        next.delete(adapterId)
      }
      return next
    })
  }, [])

  // 处理全选
  const handleSelectAll = useCallback(() => {
    if (selectedAdapters.size === filteredAdapters.length) {
      setSelectedAdapters(new Set())
    } else {
      setSelectedAdapters(new Set(filteredAdapters.map(a => a.name)))
    }
  }, [selectedAdapters, filteredAdapters])

  // 处理批量加载
  const handleBatchLoad = useCallback(async () => {
    if (selectedAdapters.size === 0) return

    const adapterIds = Array.from(selectedAdapters)
    let successCount = 0
    let failCount = 0

    for (const adapterId of adapterIds) {
      try {
        await adapter.loadAdapter(adapterId)
        successCount++
      } catch (error) {
        failCount++
        console.error(`加载适配器 ${adapterId} 失败:`, error)
      }
    }

    showToast({
      type: failCount === 0 ? 'success' : 'warning',
      title: '批量加载完成',
      message: `成功: ${successCount}, 失败: ${failCount}`
    })

    setSelectedAdapters(new Set())
  }, [selectedAdapters, adapter, showToast])

  // 处理批量卸载
  const handleBatchUnload = useCallback(async () => {
    if (selectedAdapters.size === 0) return

    const adapterIds = Array.from(selectedAdapters)
    let successCount = 0
    let failCount = 0

    for (const adapterId of adapterIds) {
      try {
        await adapter.unloadAdapter(adapterId)
        successCount++
      } catch (error) {
        failCount++
        console.error(`卸载适配器 ${adapterId} 失败:`, error)
      }
    }

    showToast({
      type: failCount === 0 ? 'success' : 'warning',
      title: '批量卸载完成',
      message: `成功: ${successCount}, 失败: ${failCount}`
    })

    setSelectedAdapters(new Set())
  }, [selectedAdapters, adapter, showToast])

  // 动画变体
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      className={`${styles.container} ${className || ''}`}
      style={style}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 头部 */}
      <motion.div className={styles.header} variants={itemVariants}>
        <div className={styles.headerTop}>
          <h2 className={styles.title}>适配器管理</h2>
          <div className={styles.headerActions}>
            <Button
              variant="outline"
              size="sm"
              icon="🔄"
              onClick={handleRefresh}
              loading={isRefreshing}
              disabled={adapter.isLoading}
            >
              刷新
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="+"
              onClick={() => showToast({
                type: 'info',
                title: '安装功能',
                message: '适配器安装功能正在开发中'
              })}
            >
              安装适配器
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        {showStats && (
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>总计</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.loaded}</div>
              <div className={styles.statLabel}>已加载</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.unloaded}</div>
              <div className={styles.statLabel}>未加载</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.error}</div>
              <div className={styles.statLabel}>错误</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {(stats.totalMemoryUsage / 1024 / 1024).toFixed(1)} MB
              </div>
              <div className={styles.statLabel}>内存使用</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* 工具栏 */}
      <motion.div className={styles.toolbar} variants={itemVariants}>
        {/* 搜索框 */}
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="搜索适配器..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>

        {/* 过滤器 */}
        <div className={styles.filters}>
          {/* 状态过滤 */}
          <select
            value={filters.status[0] || ''}
            onChange={(e) => handleFilterChange('status', e.target.value ? [e.target.value as AdapterStatus] : [])}
            className={styles.filterSelect}
          >
            <option value="">所有状态</option>
            <option value={AdapterStatus.Loaded}>已加载</option>
            <option value={AdapterStatus.Unloaded}>未加载</option>
            <option value={AdapterStatus.Loading}>加载中</option>
            <option value={AdapterStatus.Error}>错误</option>
          </select>

          {/* 清除过滤器 */}
          {(searchQuery || filters.status.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
            >
              清除过滤
            </Button>
          )}
        </div>

        {/* 视图切换 */}
        <div className={styles.viewModeSwitch}>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            ☰
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            title="网格视图"
          >
            ⊞
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'compact' ? styles.active : ''}`}
            onClick={() => setViewMode('compact')}
            title="紧凑视图"
          >
            ≡
          </button>
        </div>
      </motion.div>

      {/* 批量操作栏 */}
      <AnimatePresence>
        {selectedAdapters.size > 0 && (
          <motion.div
            className={styles.bulkActions}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={styles.bulkInfo}>
              已选择 {selectedAdapters.size} 个适配器
            </div>
            <div className={styles.bulkButtons}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchLoad}
              >
                批量加载
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchUnload}
              >
                批量卸载
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAdapters(new Set())}
              >
                取消选择
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 适配器列表 */}
      <motion.div className={styles.content} variants={itemVariants}>
        {adapter.isLoading && adapter.adapters.length === 0 ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <div className={styles.loadingText}>加载适配器列表...</div>
          </div>
        ) : filteredAdapters.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <div className={styles.emptyTitle}>
              {searchQuery || filters.status.length > 0 ? '未找到匹配的适配器' : '暂无已安装的适配器'}
            </div>
            <div className={styles.emptyDescription}>
              {searchQuery || filters.status.length > 0 
                ? '尝试调整搜索条件或过滤器' 
                : '点击"安装适配器"按钮开始安装'}
            </div>
          </div>
        ) : (
          <AdapterList
            adapters={filteredAdapters}
            viewMode={viewMode}
            selectedAdapters={selectedAdapters}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onLoad={handleLoad}
            onUnload={handleUnload}
            onUninstall={handleUninstall}
            onConfigure={handleConfigure}
            isLoading={adapter.isLoading}
          />
        )}
      </motion.div>

      {/* 错误提示 */}
      {adapter.error && (
        <motion.div
          className={styles.error}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{adapter.error}</span>
        </motion.div>
      )}
    </motion.div>
  )
}

export default AdapterSettings


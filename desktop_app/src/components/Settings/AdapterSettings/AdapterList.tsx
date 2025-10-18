/**
 * 适配器列表组件
 * 
 * 功能：
 * - 多种视图模式（列表、网格、紧凑）
 * - 适配器状态展示
 * - 操作按钮（加载、卸载、配置、删除）
 * - 多选支持
 * - 详情查看
 * - 性能监控展示
 * 
 * @module AdapterList
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../common/Button/index'
import { AdapterStatus, type AdapterInfo } from '@/types/adapter'
import styles from './AdapterSettings.module.css'

/**
 * 适配器列表组件属性
 */
export interface AdapterListProps {
  /** 适配器列表 */
  adapters: AdapterInfo[]
  /** 视图模式 */
  viewMode: 'list' | 'grid' | 'compact'
  /** 已选择的适配器 */
  selectedAdapters: Set<string>
  /** 选择适配器回调 */
  onSelect: (adapterId: string, selected: boolean) => void
  /** 全选回调 */
  onSelectAll: () => void
  /** 加载适配器回调 */
  onLoad: (adapterId: string) => void
  /** 卸载适配器回调 */
  onUnload: (adapterId: string) => void
  /** 卸载适配器回调 */
  onUninstall: (adapterId: string) => void
  /** 配置适配器回调 */
  onConfigure: (adapter: AdapterInfo) => void
  /** 是否正在加载 */
  isLoading?: boolean
}

/**
 * 获取状态显示信息
 */
const getStatusInfo = (status: AdapterStatus) => {
  switch (status) {
    case AdapterStatus.Loaded:
      return { text: '已加载', icon: '✓', color: '#10b981' }
    case AdapterStatus.Unloaded:
      return { text: '未加载', icon: '○', color: '#6b7280' }
    case AdapterStatus.Loading:
      return { text: '加载中', icon: '⟳', color: '#3b82f6' }
    case AdapterStatus.Unloading:
      return { text: '卸载中', icon: '⟳', color: '#f59e0b' }
    case AdapterStatus.Error:
      return { text: '错误', icon: '✗', color: '#ef4444' }
    case AdapterStatus.Maintenance:
      return { text: '维护中', icon: '🔧', color: '#8b5cf6' }
    default:
      return { text: '未知', icon: '?', color: '#9ca3af' }
  }
}

/**
 * 格式化文件大小
 */
const formatSize = (bytes: number | undefined): string => {
  if (!bytes) return 'N/A'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 格式化内存使用
 */
const formatMemory = (bytes: number | undefined): string => {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 格式化时间
 */
const formatTime = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN')
  } catch {
    return 'N/A'
  }
}

/**
 * 适配器项组件
 */
interface AdapterItemProps {
  adapter: AdapterInfo
  viewMode: 'list' | 'grid' | 'compact'
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onLoad: () => void
  onUnload: () => void
  onUninstall: () => void
  onConfigure: () => void
}

const AdapterItem: React.FC<AdapterItemProps> = ({
  adapter,
  viewMode,
  isSelected,
  onSelect,
  onLoad,
  onUnload,
  onUninstall,
  onConfigure,
}) => {
  const [showDetails, setShowDetails] = useState(false)
  const statusInfo = getStatusInfo(adapter.status)

  const handleToggleDetails = useCallback(() => {
    setShowDetails(prev => !prev)
  }, [])

  // 列表视图
  if (viewMode === 'list') {
    return (
      <motion.div
        className={`${styles.adapterItem} ${styles.listView} ${isSelected ? styles.selected : ''}`}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div className={styles.adapterHeader}>
          {/* 选择框 */}
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
          />

          {/* 状态指示器 */}
          <div
            className={styles.statusIndicator}
            style={{ backgroundColor: statusInfo.color }}
            title={statusInfo.text}
          >
            {statusInfo.icon}
          </div>

          {/* 基本信息 */}
          <div className={styles.adapterInfo}>
            <div className={styles.adapterName}>{adapter.name}</div>
            {adapter.description && (
              <div className={styles.adapterDescription}>{adapter.description}</div>
            )}
          </div>

          {/* 版本 */}
          {adapter.version && (
            <div className={styles.adapterVersion}>
              v{adapter.version}
            </div>
          )}

          {/* 内存使用 */}
          {adapter.memory_usage && (
            <div className={styles.adapterMemory}>
              💾 {formatMemory(adapter.memory_usage)}
            </div>
          )}

          {/* 操作按钮 */}
          <div className={styles.adapterActions}>
            {adapter.status === AdapterStatus.Loaded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onUnload}
              >
                卸载
              </Button>
            ) : adapter.status === AdapterStatus.Unloaded ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onLoad}
              >
                加载
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled
              >
                {statusInfo.text}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onConfigure}
              disabled={adapter.status === AdapterStatus.Error}
            >
              配置
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleDetails}
            >
              {showDetails ? '▲' : '▼'}
            </Button>
          </div>
        </div>

        {/* 详细信息 */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              className={styles.adapterDetails}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>路径</div>
                  <div className={styles.detailValue}>{adapter.path || 'N/A'}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>大小</div>
                  <div className={styles.detailValue}>{formatSize(adapter.size)}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>加载时间</div>
                  <div className={styles.detailValue}>{formatTime(adapter.load_time)}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>状态</div>
                  <div className={styles.detailValue}>
                    <span style={{ color: statusInfo.color }}>
                      {statusInfo.icon} {statusInfo.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* 配置信息 */}
              {adapter.config && Object.keys(adapter.config).length > 0 && (
                <div className={styles.configSection}>
                  <div className={styles.configTitle}>配置</div>
                  <div className={styles.configList}>
                    {Object.entries(adapter.config).map(([key, value]) => (
                      <div key={key} className={styles.configItem}>
                        <span className={styles.configKey}>{key}:</span>
                        <span className={styles.configValue}>{JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 删除按钮 */}
              <div className={styles.detailsActions}>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onUninstall}
                >
                  卸载适配器
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // 网格视图
  if (viewMode === 'grid') {
    return (
      <motion.div
        className={`${styles.adapterItem} ${styles.gridView} ${isSelected ? styles.selected : ''}`}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: 1.02 }}
      >
        {/* 选择框 */}
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />

        {/* 状态徽章 */}
        <div
          className={styles.statusBadge}
          style={{ backgroundColor: statusInfo.color }}
        >
          {statusInfo.icon}
        </div>

        {/* 内容 */}
        <div className={styles.gridContent}>
          <div className={styles.gridIcon}>📦</div>
          <div className={styles.gridName}>{adapter.name}</div>
          {adapter.version && (
            <div className={styles.gridVersion}>v{adapter.version}</div>
          )}
          {adapter.description && (
            <div className={styles.gridDescription}>{adapter.description}</div>
          )}
          {adapter.memory_usage && (
            <div className={styles.gridMemory}>
              💾 {formatMemory(adapter.memory_usage)}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className={styles.gridActions}>
          {adapter.status === AdapterStatus.Loaded ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUnload}
              block
            >
              卸载
            </Button>
          ) : adapter.status === AdapterStatus.Unloaded ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onLoad}
              block
            >
              加载
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              block
            >
              {statusInfo.text}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onConfigure}
            block
          >
            配置
          </Button>
        </div>
      </motion.div>
    )
  }

  // 紧凑视图
  return (
    <motion.div
      className={`${styles.adapterItem} ${styles.compactView} ${isSelected ? styles.selected : ''}`}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isSelected}
        onChange={(e) => onSelect(e.target.checked)}
      />
      <div
        className={styles.statusDot}
        style={{ backgroundColor: statusInfo.color }}
        title={statusInfo.text}
      />
      <div className={styles.compactName}>{adapter.name}</div>
      {adapter.version && (
        <div className={styles.compactVersion}>v{adapter.version}</div>
      )}
      {adapter.memory_usage && (
        <div className={styles.compactMemory}>{formatMemory(adapter.memory_usage)}</div>
      )}
      <div className={styles.compactActions}>
        {adapter.status === AdapterStatus.Loaded ? (
          <button className={styles.compactButton} onClick={onUnload} title="卸载">
            ⏸
          </button>
        ) : adapter.status === AdapterStatus.Unloaded ? (
          <button className={styles.compactButton} onClick={onLoad} title="加载">
            ▶
          </button>
        ) : (
          <button className={styles.compactButton} disabled title={statusInfo.text}>
            {statusInfo.icon}
          </button>
        )}
        <button className={styles.compactButton} onClick={onConfigure} title="配置">
          ⚙
        </button>
      </div>
    </motion.div>
  )
}

/**
 * 适配器列表组件
 */
export const AdapterList: React.FC<AdapterListProps> = ({
  adapters,
  viewMode,
  selectedAdapters,
  onSelect,
  onSelectAll,
  onLoad,
  onUnload,
  onUninstall,
  onConfigure,
  isLoading,
}) => {
  // 列表动画变体
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const allSelected = adapters.length > 0 && selectedAdapters.size === adapters.length

  return (
    <div className={styles.adapterList}>
      {/* 全选 */}
      {viewMode === 'list' && adapters.length > 0 && (
        <div className={styles.listHeader}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={allSelected}
            onChange={onSelectAll}
          />
          <div className={styles.headerLabel}>
            全选 ({adapters.length} 个适配器)
          </div>
        </div>
      )}

      {/* 适配器列表 */}
      <motion.div
        className={`${styles.adapterContainer} ${styles[viewMode]}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="popLayout">
          {adapters.map((adapter) => (
            <AdapterItem
              key={adapter.name}
              adapter={adapter}
              viewMode={viewMode}
              isSelected={selectedAdapters.has(adapter.name)}
              onSelect={(selected) => onSelect(adapter.name, selected)}
              onLoad={() => onLoad(adapter.name)}
              onUnload={() => onUnload(adapter.name)}
              onUninstall={() => onUninstall(adapter.name)}
              onConfigure={() => onConfigure(adapter)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* 加载状态 */}
      {isLoading && adapters.length > 0 && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  )
}

export default AdapterList


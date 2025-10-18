/**
 * 任务监控组件
 * 
 * 功能特性：
 * - 实时任务状态监控
 * - 任务统计信息展示
 * - 系统资源监控
 * - 任务操作（取消、重试）
 * - 任务历史记录
 * - 自动刷新
 * - 错误处理和重试机制
 * - 与后端API完整对接
 * 
 * @module TaskMonitor
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../common/Button/index'
import type { 
  TaskInfo, 
  TaskMonitorStats, 
  SystemResources,
  DesktopEvent,
  DesktopEventType 
} from '@/services/api/desktop'
import { 
  getTaskList, 
  getTaskMonitorStats,
  getSystemResources,
  cancelTask,
  DesktopEventManager 
} from '@/services/api/desktop'
import styles from './TaskMonitor.module.css'

/**
 * 任务监控组件属性
 */
export interface TaskMonitorProps {
  /** 是否显示 */
  visible?: boolean
  /** 自动刷新间隔（毫秒），默认5000ms */
  refreshInterval?: number
  /** 是否显示系统资源监控 */
  showSystemResources?: boolean
  /** 是否显示任务统计 */
  showStats?: boolean
  /** 任务过滤器 */
  taskFilter?: (task: TaskInfo) => boolean
  /** 关闭回调 */
  onClose?: () => void
}

/**
 * 任务状态颜色映射
 */
const TASK_STATUS_COLORS: Record<TaskInfo['status'], string> = {
  pending: '#FFA500',
  running: '#1E90FF',
  completed: '#32CD32',
  failed: '#DC143C',
  cancelled: '#808080',
}

/**
 * 任务优先级颜色映射
 */
const TASK_PRIORITY_COLORS: Record<TaskInfo['priority'], string> = {
  low: '#90EE90',
  normal: '#87CEEB',
  high: '#FFB347',
  urgent: '#FF6B6B',
}

/**
 * 任务类型图标映射
 */
const TASK_TYPE_ICONS: Record<TaskInfo['type'], string> = {
  workflow: '🔄',
  adapter: '🔌',
  system: '⚙️',
  custom: '✨',
}

/**
 * 格式化时间
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    return date.toLocaleString('zh-CN')
  }
}

/**
 * 格式化持续时间
 */
const formatDuration = (start: string, end?: string): string => {
  const startTime = new Date(start).getTime()
  const endTime = end ? new Date(end).getTime() : Date.now()
  const duration = endTime - startTime
  
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

/**
 * 格式化内存大小
 */
const formatMemorySize = (mb: number): string => {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return `${mb.toFixed(2)} MB`
}

/**
 * 任务监控组件
 */
export const TaskMonitor: React.FC<TaskMonitorProps> = ({
  visible = true,
  refreshInterval = 5000,
  showSystemResources = true,
  showStats = true,
  taskFilter,
  onClose,
}) => {
  // ==================== 状态管理 ====================
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [stats, setStats] = useState<TaskMonitorStats | null>(null)
  const [systemResources, setSystemResources] = useState<SystemResources | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null)
  const [filterStatus, setFilterStatus] = useState<TaskInfo['status'] | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<TaskInfo['priority'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'priority' | 'status'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const eventManagerRef = useRef<DesktopEventManager | null>(null)
  const retryCountRef = useRef<number>(0)
  const maxRetries = 3

  // ==================== 数据加载 ====================

  /**
   * 加载任务列表
   */
  const loadTasks = useCallback(async () => {
    try {
      const taskList = await getTaskList()
      setTasks(taskList)
      setError(null)
      retryCountRef.current = 0
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载任务列表失败'
      console.error('加载任务列表失败:', err)
      setError(errorMessage)
      
      // 重试机制
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        setTimeout(() => loadTasks(), 1000 * retryCountRef.current)
      }
    }
  }, [])

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    if (!showStats) return
    
    try {
      const statsData = await getTaskMonitorStats()
      setStats(statsData)
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
  }, [showStats])

  /**
   * 加载系统资源
   */
  const loadSystemResources = useCallback(async () => {
    if (!showSystemResources) return
    
    try {
      const resources = await getSystemResources()
      setSystemResources(resources)
    } catch (err) {
      console.error('加载系统资源失败:', err)
    }
  }, [showSystemResources])

  /**
   * 刷新所有数据
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    
    try {
      await Promise.all([
        loadTasks(),
        loadStats(),
        loadSystemResources(),
      ])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('刷新数据失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [loadTasks, loadStats, loadSystemResources])

  // ==================== 任务操作 ====================

  /**
   * 取消任务
   */
  const handleCancelTask = useCallback(async (taskId: string) => {
    try {
      await cancelTask(taskId)
      await refreshData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消任务失败'
      setError(errorMessage)
      console.error('取消任务失败:', err)
    }
  }, [refreshData])

  /**
   * 查看任务详情
   */
  const handleViewTaskDetails = useCallback((task: TaskInfo) => {
    setSelectedTask(task)
  }, [])

  /**
   * 关闭任务详情
   */
  const handleCloseTaskDetails = useCallback(() => {
    setSelectedTask(null)
  }, [])

  // ==================== 过滤和排序 ====================

  /**
   * 过滤后的任务列表
   */
  const filteredTasks = useMemo(() => {
    let filtered = tasks

    // 状态过滤
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus)
    }

    // 优先级过滤
    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority)
    }

    // 自定义过滤器
    if (taskFilter) {
      filtered = filtered.filter(taskFilter)
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'priority': {
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        }
        case 'status': {
          const statusOrder = { running: 5, pending: 4, failed: 3, cancelled: 2, completed: 1 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        }
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [tasks, filterStatus, filterPriority, sortBy, sortOrder, taskFilter])

  // ==================== 事件监听 ====================

  /**
   * 设置事件监听
   */
  useEffect(() => {
    const eventManager = new DesktopEventManager()
    eventManagerRef.current = eventManager

    // 监听任务事件
    const handleTaskEvent = (event: DesktopEvent) => {
      if (event.type === 'task_started' || event.type === 'task_completed' || event.type === 'task_failed') {
        // 任务状态变化，刷新数据
        refreshData()
      }
    }

    eventManager.addEventListener('task_started', handleTaskEvent)
    eventManager.addEventListener('task_completed', handleTaskEvent)
    eventManager.addEventListener('task_failed', handleTaskEvent)

    // 开始监听
    eventManager.startListening().catch(err => {
      console.error('启动事件监听失败:', err)
    })

    return () => {
      eventManager.stopListening()
    }
  }, [refreshData])

  // ==================== 自动刷新 ====================

  /**
   * 自动刷新定时器
   */
  useEffect(() => {
    if (!autoRefresh || !visible) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      return
    }

    refreshTimerRef.current = setInterval(() => {
      refreshData()
    }, refreshInterval)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [autoRefresh, visible, refreshInterval, refreshData])

  // ==================== 初始化加载 ====================

  useEffect(() => {
    if (visible) {
      refreshData()
    }
  }, [visible, refreshData])

  // ==================== 清理 ====================

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (eventManagerRef.current) {
        eventManagerRef.current.stopListening()
      }
    }
  }, [])

  // ==================== 渲染 ====================

  if (!visible) {
    return null
  }

  return (
    <motion.div
      className={styles.taskMonitor}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>📊 任务监控</h2>
          <span className={styles.lastRefresh}>
            上次更新: {lastRefresh.toLocaleTimeString('zh-CN')}
          </span>
        </div>
        <div className={styles.headerRight}>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'primary' : 'secondary'}
            size="small"
          >
            {autoRefresh ? '⏸️ 暂停刷新' : '▶️ 自动刷新'}
          </Button>
          <Button
            onClick={refreshData}
            disabled={isLoading}
            size="small"
          >
            🔄 {isLoading ? '刷新中...' : '刷新'}
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="small">
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.errorBanner}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorMessage}>{error}</span>
            <button
              className={styles.errorClose}
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 统计信息 */}
      {showStats && stats && (
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📋</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.total_tasks}</div>
                <div className={styles.statLabel}>总任务</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⚡</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.running_tasks}</div>
                <div className={styles.statLabel}>运行中</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>✅</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.completed_tasks}</div>
                <div className={styles.statLabel}>已完成</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>❌</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.failed_tasks}</div>
                <div className={styles.statLabel}>失败</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⏱️</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {(stats.average_execution_time_ms / 1000).toFixed(1)}s
                </div>
                <div className={styles.statLabel}>平均耗时</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📈</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.success_rate_percent.toFixed(1)}%</div>
                <div className={styles.statLabel}>成功率</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 系统资源监控 */}
      {showSystemResources && systemResources && (
        <div className={styles.resourcesSection}>
          <h3 className={styles.sectionTitle}>系统资源</h3>
          <div className={styles.resourcesGrid}>
            <div className={styles.resourceCard}>
              <div className={styles.resourceHeader}>
                <span className={styles.resourceIcon}>🖥️</span>
                <span className={styles.resourceLabel}>CPU</span>
              </div>
              <div className={styles.resourceProgress}>
                <div 
                  className={styles.resourceProgressBar}
                  style={{ 
                    width: `${systemResources.cpu_usage}%`,
                    backgroundColor: systemResources.cpu_usage > 80 ? '#DC143C' : '#1E90FF'
                  }}
                />
              </div>
              <div className={styles.resourceValue}>{systemResources.cpu_usage.toFixed(1)}%</div>
            </div>
            
            <div className={styles.resourceCard}>
              <div className={styles.resourceHeader}>
                <span className={styles.resourceIcon}>💾</span>
                <span className={styles.resourceLabel}>内存</span>
              </div>
              <div className={styles.resourceProgress}>
                <div 
                  className={styles.resourceProgressBar}
                  style={{ 
                    width: `${systemResources.memory.usage_percent}%`,
                    backgroundColor: systemResources.memory.usage_percent > 80 ? '#DC143C' : '#32CD32'
                  }}
                />
              </div>
              <div className={styles.resourceValue}>
                {formatMemorySize(systemResources.memory.used_mb)} / {formatMemorySize(systemResources.memory.total_mb)}
              </div>
            </div>
            
            <div className={styles.resourceCard}>
              <div className={styles.resourceHeader}>
                <span className={styles.resourceIcon}>💿</span>
                <span className={styles.resourceLabel}>磁盘</span>
              </div>
              <div className={styles.resourceProgress}>
                <div 
                  className={styles.resourceProgressBar}
                  style={{ 
                    width: `${systemResources.disk.usage_percent}%`,
                    backgroundColor: systemResources.disk.usage_percent > 80 ? '#DC143C' : '#FFA500'
                  }}
                />
              </div>
              <div className={styles.resourceValue}>
                {formatMemorySize(systemResources.disk.used_mb)} / {formatMemorySize(systemResources.disk.total_mb)}
              </div>
            </div>

            {systemResources.gpu && (
              <div className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <span className={styles.resourceIcon}>🎮</span>
                  <span className={styles.resourceLabel}>GPU</span>
                </div>
                <div className={styles.resourceProgress}>
                  <div 
                    className={styles.resourceProgressBar}
                    style={{ 
                      width: `${systemResources.gpu.usage_percent}%`,
                      backgroundColor: systemResources.gpu.usage_percent > 80 ? '#DC143C' : '#9370DB'
                    }}
                  />
                </div>
                <div className={styles.resourceValue}>
                  {systemResources.gpu.usage_percent.toFixed(1)}%
                  {systemResources.gpu.temperature && ` (${systemResources.gpu.temperature}°C)`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 过滤和排序 */}
      <div className={styles.controlsSection}>
        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">所有状态</option>
            <option value="pending">等待中</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>

          <select
            className={styles.filterSelect}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
          >
            <option value="all">所有优先级</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>

          <select
            className={styles.filterSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="created_at">创建时间</option>
            <option value="priority">优先级</option>
            <option value="status">状态</option>
          </select>

          <button
            className={styles.sortOrderButton}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className={styles.taskCount}>
          显示 {filteredTasks.length} / {tasks.length} 个任务
        </div>
      </div>

      {/* 任务列表 */}
      <div className={styles.tasksSection}>
        {isLoading && tasks.length === 0 ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <span>加载中...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyText}>没有找到任务</div>
          </div>
        ) : (
          <div className={styles.taskList}>
            <AnimatePresence>
              {filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  className={styles.taskItem}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  layout
                >
                  <div className={styles.taskHeader}>
                    <div className={styles.taskMeta}>
                      <span className={styles.taskIcon}>
                        {TASK_TYPE_ICONS[task.type]}
                      </span>
                      <span className={styles.taskName}>{task.name}</span>
                      <span
                        className={styles.taskPriority}
                        style={{ backgroundColor: TASK_PRIORITY_COLORS[task.priority] }}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className={styles.taskActions}>
                      {task.status === 'running' && (
                        <Button
                          onClick={() => handleCancelTask(task.id)}
                          variant="danger"
                          size="small"
                        >
                          取消
                        </Button>
                      )}
                      <Button
                        onClick={() => handleViewTaskDetails(task)}
                        variant="ghost"
                        size="small"
                      >
                        详情
                      </Button>
                    </div>
                  </div>

                  <div className={styles.taskBody}>
                    <div className={styles.taskProgress}>
                      <div className={styles.taskProgressBar}>
                        <div
                          className={styles.taskProgressFill}
                          style={{
                            width: `${task.progress.percentage}%`,
                            backgroundColor: TASK_STATUS_COLORS[task.status]
                          }}
                        />
                      </div>
                      <span className={styles.taskProgressText}>
                        {task.progress.percentage.toFixed(0)}%
                        {task.progress.message && ` - ${task.progress.message}`}
                      </span>
                    </div>

                    <div className={styles.taskInfo}>
                      <span
                        className={styles.taskStatus}
                        style={{ color: TASK_STATUS_COLORS[task.status] }}
                      >
                        ● {task.status}
                      </span>
                      <span className={styles.taskTime}>
                        创建于 {formatTimestamp(task.created_at)}
                      </span>
                      {task.started_at && (
                        <span className={styles.taskDuration}>
                          耗时 {formatDuration(task.started_at, task.ended_at)}
                        </span>
                      )}
                    </div>

                    {task.error && (
                      <div className={styles.taskError}>
                        <span className={styles.taskErrorIcon}>⚠️</span>
                        <span className={styles.taskErrorMessage}>{task.error}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 任务详情弹窗 */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            className={styles.taskDetailsOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseTaskDetails}
          >
            <motion.div
              className={styles.taskDetailsModal}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.taskDetailsHeader}>
                <h3>任务详情</h3>
                <button
                  className={styles.taskDetailsClose}
                  onClick={handleCloseTaskDetails}
                >
                  ✕
                </button>
              </div>
              
              <div className={styles.taskDetailsBody}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>任务ID:</span>
                  <span className={styles.detailValue}>{selectedTask.id}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>任务名称:</span>
                  <span className={styles.detailValue}>{selectedTask.name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>任务类型:</span>
                  <span className={styles.detailValue}>
                    {TASK_TYPE_ICONS[selectedTask.type]} {selectedTask.type}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>状态:</span>
                  <span 
                    className={styles.detailValue}
                    style={{ color: TASK_STATUS_COLORS[selectedTask.status] }}
                  >
                    {selectedTask.status}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>优先级:</span>
                  <span className={styles.detailValue}>{selectedTask.priority}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>进度:</span>
                  <span className={styles.detailValue}>
                    {selectedTask.progress.current} / {selectedTask.progress.total} ({selectedTask.progress.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>创建时间:</span>
                  <span className={styles.detailValue}>
                    {new Date(selectedTask.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                {selectedTask.started_at && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>开始时间:</span>
                    <span className={styles.detailValue}>
                      {new Date(selectedTask.started_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
                {selectedTask.ended_at && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>结束时间:</span>
                    <span className={styles.detailValue}>
                      {new Date(selectedTask.ended_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
                {selectedTask.error && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>错误信息:</span>
                    <span className={styles.detailValue} style={{ color: '#DC143C' }}>
                      {selectedTask.error}
                    </span>
                  </div>
                )}
                {selectedTask.result && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>执行结果:</span>
                    <pre className={styles.detailJson}>
                      {JSON.stringify(selectedTask.result, null, 2)}
                    </pre>
                  </div>
                )}
                {Object.keys(selectedTask.config).length > 0 && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>任务配置:</span>
                    <pre className={styles.detailJson}>
                      {JSON.stringify(selectedTask.config, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className={styles.taskDetailsFooter}>
                {selectedTask.status === 'running' && (
                  <Button
                    onClick={() => {
                      handleCancelTask(selectedTask.id)
                      handleCloseTaskDetails()
                    }}
                    variant="danger"
                  >
                    取消任务
                  </Button>
                )}
                <Button onClick={handleCloseTaskDetails}>
                  关闭
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default TaskMonitor


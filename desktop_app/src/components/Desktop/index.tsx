/**
 * 桌面组件入口
 * 
 * 主要功能：
 * - 集成桌面操作功能
 * - 工作流管理入口
 * - 任务监控入口
 * - 系统资源监控
 * - 窗口管理
 * 
 * @module Desktop
 */

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../common/Button/index'
import { WorkflowEditor } from './WorkflowEditor/index'
import { useDesktop } from '@/hooks/useDesktop'
import { useDesktopStore } from '@/stores/desktopStore'
import { DesktopAPI, type WorkflowDefinition, type TaskInfo, type SystemResources } from '@/services/api/desktop'
import styles from './Desktop.module.css'

/**
 * 桌面视图类型
 */
type DesktopView = 'dashboard' | 'workflows' | 'tasks' | 'resources' | 'settings'

/**
 * 桌面组件属性
 */
export interface DesktopProps {
  /** 初始视图 */
  initialView?: DesktopView
  /** 是否显示标题栏 */
  showHeader?: boolean
  /** 自定义类名 */
  className?: string
  /** 关闭回调 */
  onClose?: () => void
}

/**
 * 桌面组件
 */
export const Desktop: React.FC<DesktopProps> = ({
  initialView = 'dashboard',
  showHeader = true,
  className,
  onClose,
}) => {
  // ==================== 状态管理 ====================
  const [currentView, setCurrentView] = useState<DesktopView>(initialView)
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [systemResources, setSystemResources] = useState<SystemResources | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // ==================== Hooks ====================
  const desktop = useDesktop()
  const { appState } = useDesktopStore()

  // ==================== 数据获取 ====================

  /**
   * 加载工作流列表
   */
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const workflowList = await DesktopAPI.getWorkflowList()
      setWorkflows(workflowList)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载工作流列表失败'
      setError(errorMessage)
      console.error('Failed to load workflows:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 加载任务列表
   */
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const taskList = await DesktopAPI.getTaskList()
      setTasks(taskList)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载任务列表失败'
      setError(errorMessage)
      console.error('Failed to load tasks:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 加载系统资源
   */
  const loadSystemResources = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const resources = await DesktopAPI.getSystemResources()
      setSystemResources(resources)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载系统资源失败'
      setError(errorMessage)
      console.error('Failed to load system resources:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 创建新工作流
   */
  const handleCreateWorkflow = useCallback(async () => {
    setSelectedWorkflow(null)
    setIsEditing(true)
  }, [])

  /**
   * 编辑工作流
   */
  const handleEditWorkflow = useCallback((workflow: WorkflowDefinition) => {
    setSelectedWorkflow(workflow)
    setIsEditing(true)
  }, [])

  /**
   * 保存工作流
   */
  const handleSaveWorkflow = useCallback(async (workflow: WorkflowDefinition) => {
    try {
      setIsLoading(true)
      setError(null)

      if (selectedWorkflow) {
        // 更新现有工作流
        await DesktopAPI.updateWorkflow(selectedWorkflow.id, workflow)
      } else {
        // 创建新工作流
        await DesktopAPI.createWorkflow(workflow)
      }

      // 重新加载工作流列表
      await loadWorkflows()
      setIsEditing(false)
      setSelectedWorkflow(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存工作流失败'
      setError(errorMessage)
      console.error('Failed to save workflow:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkflow, loadWorkflows])

  /**
   * 删除工作流
   */
  const handleDeleteWorkflow = useCallback(async (workflowId: string) => {
    if (!confirm('确定要删除这个工作流吗？')) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      await DesktopAPI.deleteWorkflow(workflowId)
      await loadWorkflows()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除工作流失败'
      setError(errorMessage)
      console.error('Failed to delete workflow:', err)
    } finally {
      setIsLoading(false)
    }
  }, [loadWorkflows])

  /**
   * 执行工作流
   */
  const handleExecuteWorkflow = useCallback(async (workflowId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const execution = await DesktopAPI.executeWorkflow(workflowId)
      console.log('Workflow execution started:', execution)
      
      // 刷新任务列表
      await loadTasks()
      
      // 显示通知
      await desktop.showNotification({
        title: '工作流已启动',
        body: `工作流执行ID: ${execution.id}`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '执行工作流失败'
      setError(errorMessage)
      console.error('Failed to execute workflow:', err)
    } finally {
      setIsLoading(false)
    }
  }, [loadTasks, desktop])

  /**
   * 取消任务
   */
  const handleCancelTask = useCallback(async (taskId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      await DesktopAPI.cancelTask(taskId)
      await loadTasks()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消任务失败'
      setError(errorMessage)
      console.error('Failed to cancel task:', err)
    } finally {
      setIsLoading(false)
    }
  }, [loadTasks])

  // ==================== 初始化 ====================

  useEffect(() => {
    // 根据当前视图加载数据
    switch (currentView) {
      case 'workflows':
        loadWorkflows()
        break
      case 'tasks':
        loadTasks()
        break
      case 'resources':
        loadSystemResources()
        break
      case 'dashboard':
        loadWorkflows()
        loadTasks()
        loadSystemResources()
        break
    }
  }, [currentView, loadWorkflows, loadTasks, loadSystemResources])

  // 定期刷新系统资源
  useEffect(() => {
    if (currentView === 'resources' || currentView === 'dashboard') {
      const interval = setInterval(() => {
        loadSystemResources()
      }, 5000) // 每5秒刷新一次

      return () => clearInterval(interval)
    }
  }, [currentView, loadSystemResources])

  // ==================== 渲染工具函数 ====================

  /**
   * 格式化百分比
   */
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`
  }

  /**
   * 格式化内存大小
   */
  const formatMemory = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
  }

  /**
   * 获取任务状态颜色
   */
  const getTaskStatusColor = (status: TaskInfo['status']): string => {
    switch (status) {
      case 'running':
        return '#3b82f6' // blue
      case 'completed':
        return '#10b981' // green
      case 'failed':
        return '#ef4444' // red
      case 'cancelled':
        return '#6b7280' // gray
      default:
        return '#9ca3af' // gray
    }
  }

  /**
   * 获取任务状态文本
   */
  const getTaskStatusText = (status: TaskInfo['status']): string => {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'running':
        return '运行中'
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      case 'cancelled':
        return '已取消'
      default:
        return '未知'
    }
  }

  // ==================== 渲染子视图 ====================

  /**
   * 渲染仪表盘视图
   */
  const renderDashboard = () => (
    <div className={styles.dashboard}>
      {/* 系统资源概览 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>系统资源</h3>
        {systemResources ? (
          <div className={styles.resourceGrid}>
            <div className={styles.resourceCard}>
              <div className={styles.resourceLabel}>CPU</div>
              <div className={styles.resourceValue}>{formatPercent(systemResources.cpu_usage)}</div>
              <div className={styles.resourceBar}>
                <div
                  className={styles.resourceBarFill}
                  style={{
                    width: `${systemResources.cpu_usage}%`,
                    backgroundColor: systemResources.cpu_usage > 80 ? '#ef4444' : '#3b82f6',
                  }}
                />
              </div>
            </div>

            <div className={styles.resourceCard}>
              <div className={styles.resourceLabel}>内存</div>
              <div className={styles.resourceValue}>
                {formatMemory(systemResources.memory.used_mb)} / {formatMemory(systemResources.memory.total_mb)}
              </div>
              <div className={styles.resourceBar}>
                <div
                  className={styles.resourceBarFill}
                  style={{
                    width: `${systemResources.memory.usage_percent}%`,
                    backgroundColor: systemResources.memory.usage_percent > 80 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
            </div>

            <div className={styles.resourceCard}>
              <div className={styles.resourceLabel}>磁盘</div>
              <div className={styles.resourceValue}>
                {formatMemory(systemResources.disk.used_mb)} / {formatMemory(systemResources.disk.total_mb)}
              </div>
              <div className={styles.resourceBar}>
                <div
                  className={styles.resourceBarFill}
                  style={{
                    width: `${systemResources.disk.usage_percent}%`,
                    backgroundColor: systemResources.disk.usage_percent > 90 ? '#ef4444' : '#f59e0b',
                  }}
                />
              </div>
            </div>

            {systemResources.network && (
              <div className={styles.resourceCard}>
                <div className={styles.resourceLabel}>网络</div>
                <div className={styles.resourceValue}>
                  ↓ {(systemResources.network.download_speed_kbps / 1024).toFixed(2)} MB/s
                  <br />
                  ↑ {(systemResources.network.upload_speed_kbps / 1024).toFixed(2)} MB/s
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.loading}>加载中...</div>
        )}
      </div>

      {/* 最近工作流 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>最近工作流</h3>
          <Button size="sm" onClick={handleCreateWorkflow}>
            新建工作流
          </Button>
        </div>
        <div className={styles.workflowList}>
          {workflows.slice(0, 5).map((workflow) => (
            <div key={workflow.id} className={styles.workflowItem}>
              <div className={styles.workflowInfo}>
                <div className={styles.workflowName}>{workflow.name}</div>
                <div className={styles.workflowDesc}>{workflow.description}</div>
              </div>
              <div className={styles.workflowActions}>
                <Button size="sm" variant="outline" onClick={() => handleEditWorkflow(workflow)}>
                  编辑
                </Button>
                <Button size="sm" variant="primary" onClick={() => handleExecuteWorkflow(workflow.id)}>
                  执行
                </Button>
              </div>
            </div>
          ))}
          {workflows.length === 0 && (
            <div className={styles.emptyState}>暂无工作流</div>
          )}
        </div>
      </div>

      {/* 运行中的任务 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>运行中的任务</h3>
        </div>
        <div className={styles.taskList}>
          {tasks.filter(task => task.status === 'running').slice(0, 5).map((task) => (
            <div key={task.id} className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <div className={styles.taskName}>{task.name}</div>
                <div className={styles.taskProgress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${task.progress.percentage}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>{task.progress.percentage}%</span>
                </div>
              </div>
              <div className={styles.taskActions}>
                <Button size="sm" variant="ghost" onClick={() => handleCancelTask(task.id)}>
                  取消
                </Button>
              </div>
            </div>
          ))}
          {tasks.filter(task => task.status === 'running').length === 0 && (
            <div className={styles.emptyState}>暂无运行中的任务</div>
          )}
        </div>
      </div>
    </div>
  )

  /**
   * 渲染工作流视图
   */
  const renderWorkflows = () => {
    if (isEditing) {
      return (
        <WorkflowEditor
          workflow={selectedWorkflow || undefined}
          onSave={handleSaveWorkflow}
          onCancel={() => {
            setIsEditing(false)
            setSelectedWorkflow(null)
          }}
        />
      )
    }

    return (
      <div className={styles.workflowsView}>
        <div className={styles.viewHeader}>
          <h2 className={styles.viewTitle}>工作流管理</h2>
          <Button onClick={handleCreateWorkflow}>
            新建工作流
          </Button>
        </div>

        <div className={styles.workflowGrid}>
          {workflows.map((workflow) => (
            <motion.div
              key={workflow.id}
              className={styles.workflowCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>{workflow.name}</h4>
                <div className={styles.cardBadge}>{workflow.status}</div>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardDesc}>{workflow.description}</p>
                <div className={styles.cardMeta}>
                  <span>步骤: {workflow.steps.length}</span>
                  <span>版本: {workflow.version}</span>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <Button size="sm" variant="outline" onClick={() => handleEditWorkflow(workflow)}>
                  编辑
                </Button>
                <Button size="sm" variant="primary" onClick={() => handleExecuteWorkflow(workflow.id)}>
                  执行
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteWorkflow(workflow.id)}>
                  删除
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {workflows.length === 0 && (
          <div className={styles.emptyView}>
            <div className={styles.emptyIcon}>📋</div>
            <div className={styles.emptyTitle}>暂无工作流</div>
            <div className={styles.emptyDesc}>创建你的第一个工作流来自动化任务</div>
            <Button onClick={handleCreateWorkflow}>
              创建工作流
            </Button>
          </div>
        )}
      </div>
    )
  }

  /**
   * 渲染任务视图
   */
  const renderTasks = () => (
    <div className={styles.tasksView}>
      <div className={styles.viewHeader}>
        <h2 className={styles.viewTitle}>任务监控</h2>
        <Button size="sm" variant="ghost" onClick={loadTasks}>
          刷新
        </Button>
      </div>

      <div className={styles.taskTable}>
        <div className={styles.tableHeader}>
          <div className={styles.tableCell}>任务名称</div>
          <div className={styles.tableCell}>类型</div>
          <div className={styles.tableCell}>状态</div>
          <div className={styles.tableCell}>进度</div>
          <div className={styles.tableCell}>操作</div>
        </div>

        {tasks.map((task) => (
          <div key={task.id} className={styles.tableRow}>
            <div className={styles.tableCell}>
              <div className={styles.taskNameCell}>{task.name}</div>
            </div>
            <div className={styles.tableCell}>{task.type}</div>
            <div className={styles.tableCell}>
              <div
                className={styles.statusBadge}
                style={{ backgroundColor: getTaskStatusColor(task.status) }}
              >
                {getTaskStatusText(task.status)}
              </div>
            </div>
            <div className={styles.tableCell}>
              <div className={styles.progressCell}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${task.progress.percentage}%` }}
                  />
                </div>
                <span className={styles.progressText}>{task.progress.percentage}%</span>
              </div>
            </div>
            <div className={styles.tableCell}>
              {task.status === 'running' && (
                <Button size="sm" variant="ghost" onClick={() => handleCancelTask(task.id)}>
                  取消
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className={styles.emptyView}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyTitle}>暂无任务</div>
          <div className={styles.emptyDesc}>运行工作流来创建任务</div>
        </div>
      )}
    </div>
  )

  /**
   * 渲染资源视图
   */
  const renderResources = () => (
    <div className={styles.resourcesView}>
      <div className={styles.viewHeader}>
        <h2 className={styles.viewTitle}>系统资源</h2>
        <Button size="sm" variant="ghost" onClick={loadSystemResources}>
          刷新
        </Button>
      </div>

      {systemResources && (
        <div className={styles.resourcesGrid}>
          {/* CPU */}
          <div className={styles.resourcePanel}>
            <h3 className={styles.panelTitle}>CPU 使用率</h3>
            <div className={styles.panelValue}>{formatPercent(systemResources.cpu_usage)}</div>
            <div className={styles.panelChart}>
              <div
                className={styles.chartBar}
                style={{
                  height: `${systemResources.cpu_usage}%`,
                  backgroundColor: systemResources.cpu_usage > 80 ? '#ef4444' : '#3b82f6',
                }}
              />
            </div>
          </div>

          {/* 内存 */}
          <div className={styles.resourcePanel}>
            <h3 className={styles.panelTitle}>内存使用</h3>
            <div className={styles.panelValue}>
              {formatMemory(systemResources.memory.used_mb)} / {formatMemory(systemResources.memory.total_mb)}
            </div>
            <div className={styles.panelChart}>
              <div
                className={styles.chartBar}
                style={{
                  height: `${systemResources.memory.usage_percent}%`,
                  backgroundColor: systemResources.memory.usage_percent > 80 ? '#ef4444' : '#10b981',
                }}
              />
            </div>
            <div className={styles.panelDesc}>
              使用率: {formatPercent(systemResources.memory.usage_percent)}
            </div>
          </div>

          {/* 磁盘 */}
          <div className={styles.resourcePanel}>
            <h3 className={styles.panelTitle}>磁盘使用</h3>
            <div className={styles.panelValue}>
              {formatMemory(systemResources.disk.used_mb)} / {formatMemory(systemResources.disk.total_mb)}
            </div>
            <div className={styles.panelChart}>
              <div
                className={styles.chartBar}
                style={{
                  height: `${systemResources.disk.usage_percent}%`,
                  backgroundColor: systemResources.disk.usage_percent > 90 ? '#ef4444' : '#f59e0b',
                }}
              />
            </div>
            <div className={styles.panelDesc}>
              使用率: {formatPercent(systemResources.disk.usage_percent)}
            </div>
          </div>

          {/* GPU */}
          {systemResources.gpu && (
            <div className={styles.resourcePanel}>
              <h3 className={styles.panelTitle}>GPU 使用</h3>
              <div className={styles.panelValue}>{systemResources.gpu.name}</div>
              <div className={styles.panelChart}>
                <div
                  className={styles.chartBar}
                  style={{
                    height: `${systemResources.gpu.usage_percent}%`,
                    backgroundColor: systemResources.gpu.usage_percent > 80 ? '#ef4444' : '#8b5cf6',
                  }}
                />
              </div>
              <div className={styles.panelDesc}>
                使用率: {formatPercent(systemResources.gpu.usage_percent)}
                {systemResources.gpu.temperature && ` · 温度: ${systemResources.gpu.temperature}°C`}
              </div>
            </div>
          )}

          {/* 网络 */}
          {systemResources.network && (
            <div className={styles.resourcePanel}>
              <h3 className={styles.panelTitle}>网络流量</h3>
              <div className={styles.panelValue}>
                ↓ {(systemResources.network.download_speed_kbps / 1024).toFixed(2)} MB/s
              </div>
              <div className={styles.panelValue}>
                ↑ {(systemResources.network.upload_speed_kbps / 1024).toFixed(2)} MB/s
              </div>
              <div className={styles.panelDesc}>
                总下载: {formatMemory(systemResources.network.total_downloaded_mb)} ·
                总上传: {formatMemory(systemResources.network.total_uploaded_mb)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ==================== 主渲染 ====================

  return (
    <div className={`${styles.desktop} ${className || ''}`}>
      {/* 标题栏 */}
      {showHeader && (
        <div className={styles.header}>
          <h2 className={styles.title}>桌面管理</h2>
          <div className={styles.headerActions}>
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                关闭
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.errorBanner}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span>{error}</span>
            <button className={styles.errorClose} onClick={() => setError(null)}>
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 导航标签 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${currentView === 'dashboard' ? styles.tabActive : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          📊 仪表盘
        </button>
        <button
          className={`${styles.tab} ${currentView === 'workflows' ? styles.tabActive : ''}`}
          onClick={() => setCurrentView('workflows')}
        >
          🔄 工作流
        </button>
        <button
          className={`${styles.tab} ${currentView === 'tasks' ? styles.tabActive : ''}`}
          onClick={() => setCurrentView('tasks')}
        >
          📋 任务
        </button>
        <button
          className={`${styles.tab} ${currentView === 'resources' ? styles.tabActive : ''}`}
          onClick={() => setCurrentView('resources')}
        >
          💻 资源
        </button>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {isLoading && <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
        </div>}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={styles.viewContainer}
          >
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'workflows' && renderWorkflows()}
            {currentView === 'tasks' && renderTasks()}
            {currentView === 'resources' && renderResources()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 应用状态信息 */}
      {appState.connectivity.isOnline && (
        <div className={styles.statusBar}>
          <span className={styles.statusOnline}>● 在线</span>
          <span className={styles.statusInfo}>
            延迟: {appState.connectivity.latency}ms
          </span>
        </div>
      )}
    </div>
  )
}

export default Desktop


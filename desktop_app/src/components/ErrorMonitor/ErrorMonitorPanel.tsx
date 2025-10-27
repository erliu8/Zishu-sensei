/**
 * 错误监控面板组件
 * 提供错误列表、统计信息、配置管理等功能
 */

import React, { useState, useCallback } from 'react'
import { 
  AlertTriangle, 
  Bug, 
  Settings, 
  BarChart3, 
  RefreshCw, 
  Trash2,
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react'
import { 
  ErrorDetails, 
  ErrorSeverity, 
  ErrorType, 
  ErrorSource,
  ErrorStatus
} from '../../types/error'
import { useErrorMonitor } from '../../hooks/useErrorMonitor'
import ErrorDetailsModal from './ErrorDetailsModal'
import './ErrorMonitorPanel.css'

// ================================
// 接口定义
// ================================

interface ErrorFilter {
  severity?: ErrorSeverity[]
  type?: ErrorType[]
  source?: ErrorSource[]
  status?: ErrorStatus[]
  timeRange?: 'hour' | 'day' | 'week' | 'month'
  searchText?: string
}

interface ErrorMonitorPanelProps {
  className?: string
  style?: React.CSSProperties
  onClose?: () => void
}

// ================================
// 主组件
// ================================

export const ErrorMonitorPanel: React.FC<ErrorMonitorPanelProps> = ({
  className,
  style,
  onClose
}) => {
  const {
    errors,
    statistics,
    isMonitoring,
    clearErrors,
    resolveError,
    retryError,
    updateConfig,
    getConfig
  } = useErrorMonitor()

  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'config'>('list')
  const [filter, setFilter] = useState<ErrorFilter>({})
  const [selectedError, setSelectedError] = useState<ErrorDetails | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // ================================
  // 过滤和搜索逻辑
  // ================================

  const filteredErrors = React.useMemo(() => {
    let filtered = [...errors]

    // 严重程度筛选
    if (filter.severity?.length) {
      filtered = filtered.filter(error => filter.severity!.includes(error.severity))
    }

    // 类型筛选
    if (filter.type?.length) {
      filtered = filtered.filter(error => filter.type!.includes(error.type))
    }

    // 来源筛选
    if (filter.source?.length) {
      filtered = filtered.filter(error => filter.source!.includes(error.source))
    }

    // 状态筛选
    if (filter.status?.length) {
      filtered = filtered.filter(error => filter.status!.includes(error.status))
    }

    // 时间范围筛选
    if (filter.timeRange) {
      const now = Date.now()
      const timeRanges = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      }
      const rangeMs = timeRanges[filter.timeRange]
      filtered = filtered.filter(error => 
        new Date(error.lastOccurred).getTime() > now - rangeMs
      )
    }

    // 文本搜索
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase()
      filtered = filtered.filter(error =>
        error.name.toLowerCase().includes(searchLower) ||
        error.message.toLowerCase().includes(searchLower) ||
        error.context.component?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [errors, filter])

  // ================================
  // 事件处理
  // ================================

  const handleErrorClick = useCallback((error: ErrorDetails) => {
    setSelectedError(error)
    setShowDetailsModal(true)
  }, [])

  const handleResolveError = useCallback(async (errorId: string, resolution: string) => {
    setIsLoading(true)
    try {
      await resolveError(errorId, resolution)
    } catch (error) {
      console.error('Failed to resolve error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [resolveError])

  const handleRetryError = useCallback(async (errorId: string) => {
    setIsLoading(true)
    try {
      await retryError(errorId)
    } catch (error) {
      console.error('Failed to retry error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [retryError])

  const handleClearAllErrors = useCallback(async () => {
    if (confirm('确定要清除所有错误记录吗？此操作不可撤销。')) {
      setIsLoading(true)
      try {
        await clearErrors()
      } catch (error) {
        console.error('Failed to clear errors:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }, [clearErrors])

  const handleExportErrors = useCallback(() => {
    const dataStr = JSON.stringify(filteredErrors, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `error-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredErrors])

  // ================================
  // 渲染方法
  // ================================

  const renderTabButton = (tab: string, label: string, icon: React.ReactNode) => (
    <button
      className={`error-monitor-tab ${activeTab === tab ? 'active' : ''}`}
      onClick={() => setActiveTab(tab as any)}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  const renderSeverityBadge = (severity: ErrorSeverity) => {
    const severityConfig = {
      [ErrorSeverity.LOW]: { className: 'severity-low', icon: <Eye size={12} /> },
      [ErrorSeverity.MEDIUM]: { className: 'severity-medium', icon: <AlertCircle size={12} /> },
      [ErrorSeverity.HIGH]: { className: 'severity-high', icon: <AlertTriangle size={12} /> },
      [ErrorSeverity.CRITICAL]: { className: 'severity-critical', icon: <XCircle size={12} /> },
    }
    
    const config = severityConfig[severity]
    return (
      <span className={`severity-badge ${config.className}`}>
        {config.icon}
        {severity}
      </span>
    )
  }

  const renderStatusBadge = (status: ErrorStatus) => {
    const statusConfig = {
      [ErrorStatus.NEW]: { className: 'status-new', icon: <AlertCircle size={12} /> },
      [ErrorStatus.REPORTED]: { className: 'status-reported', icon: <Clock size={12} /> },
      [ErrorStatus.ACKNOWLEDGED]: { className: 'status-acknowledged', icon: <Eye size={12} /> },
      [ErrorStatus.RECOVERING]: { className: 'status-recovering', icon: <RefreshCw size={12} /> },
      [ErrorStatus.RESOLVED]: { className: 'status-resolved', icon: <CheckCircle size={12} /> },
      [ErrorStatus.IGNORED]: { className: 'status-ignored', icon: <EyeOff size={12} /> },
    }
    
    const config = statusConfig[status]
    return (
      <span className={`status-badge ${config.className}`}>
        {config.icon}
        {status}
      </span>
    )
  }

  const renderErrorRow = (error: ErrorDetails) => (
    <div
      key={error.id}
      className={`error-row ${error.severity}`}
      onClick={() => handleErrorClick(error)}
    >
      <div className="error-basic-info">
        <div className="error-header">
          <span className="error-name">{error.name}</span>
          <div className="error-badges">
            {renderSeverityBadge(error.severity)}
            {renderStatusBadge(error.status)}
          </div>
        </div>
        <div className="error-message">{error.message}</div>
        <div className="error-metadata">
          <span className="error-type">{error.type}</span>
          <span className="error-source">{error.source}</span>
          <span className="error-component">{error.context.component || 'N/A'}</span>
          <span className="error-count">发生 {error.occurrenceCount} 次</span>
          <span className="error-time">
            {new Date(error.lastOccurred).toLocaleString()}
          </span>
        </div>
      </div>
      <div className="error-actions">
        {error.status !== ErrorStatus.RESOLVED && (
          <>
            <button
              className="action-button resolve"
              onClick={(e) => {
                e.stopPropagation()
                handleResolveError(error.id, '手动解决')
              }}
              title="解决错误"
            >
              <CheckCircle size={16} />
            </button>
            <button
              className="action-button retry"
              onClick={(e) => {
                e.stopPropagation()
                handleRetryError(error.id)
              }}
              title="重试操作"
            >
              <RefreshCw size={16} />
            </button>
          </>
        )}
        <button
          className="action-button details"
          onClick={(e) => {
            e.stopPropagation()
            handleErrorClick(error)
          }}
          title="查看详情"
        >
          <Eye size={16} />
        </button>
      </div>
    </div>
  )

  const renderFilterPanel = () => (
    <div className="filter-panel">
      <div className="filter-row">
        <div className="filter-group">
          <label>严重程度</label>
          <select
            multiple
            value={filter.severity || []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as ErrorSeverity)
              setFilter({ ...filter, severity: values })
            }}
          >
            {Object.values(ErrorSeverity).map(severity => (
              <option key={severity} value={severity}>{severity}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>错误类型</label>
          <select
            multiple
            value={filter.type || []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as ErrorType)
              setFilter({ ...filter, type: values })
            }}
          >
            {Object.values(ErrorType).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>时间范围</label>
          <select
            value={filter.timeRange || ''}
            onChange={(e) => setFilter({ ...filter, timeRange: e.target.value as any })}
          >
            <option value="">全部</option>
            <option value="hour">最近1小时</option>
            <option value="day">最近1天</option>
            <option value="week">最近1周</option>
            <option value="month">最近1月</option>
          </select>
        </div>
      </div>
      
      <div className="filter-row">
        <div className="search-group">
          <Search size={16} />
          <input
            type="text"
            placeholder="搜索错误名称、消息或组件..."
            value={filter.searchText || ''}
            onChange={(e) => setFilter({ ...filter, searchText: e.target.value })}
          />
        </div>
        
        <button
          className="filter-clear-button"
          onClick={() => setFilter({})}
        >
          清除筛选
        </button>
      </div>
    </div>
  )

  const renderErrorList = () => (
    <div className="error-list-panel">
      <div className="panel-header">
        <h3>错误列表 ({filteredErrors.length})</h3>
        <div className="panel-actions">
          <button
            className="action-button"
            onClick={handleExportErrors}
            title="导出错误报告"
          >
            <Download size={16} />
          </button>
          <button
            className="action-button danger"
            onClick={handleClearAllErrors}
            title="清除所有错误"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {renderFilterPanel()}
      
      <div className="error-list">
        {filteredErrors.length === 0 ? (
          <div className="empty-state">
            <Bug size={48} />
            <h4>没有找到错误记录</h4>
            <p>系统运行良好，或者当前筛选条件下没有错误。</p>
          </div>
        ) : (
          filteredErrors.map((error) => renderErrorRow(error))
        )}
      </div>
    </div>
  )

  const renderStatsPanel = () => {
    const criticalCount = statistics?.bySeverity?.[ErrorSeverity.CRITICAL] || 0
    const newErrorsCount = statistics?.newErrors || 0
    
    return (
      <div className="stats-panel">
        <div className="stats-content">
          <h3>统计分析</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">总错误数</div>
              <div className="stat-value">{statistics?.totalErrors || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">严重错误</div>
              <div className="stat-value critical">{criticalCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">已解决</div>
              <div className="stat-value resolved">{statistics?.resolvedErrors || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">新错误</div>
              <div className="stat-value pending">{newErrorsCount}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderConfigPanel = () => {
    const config = getConfig()
    
    return (
      <div className="config-panel">
        <h3>配置</h3>
        <div className="config-content">
          <p>配置功能开发中...</p>
          <pre>{JSON.stringify(config, null, 2)}</pre>
          <button onClick={() => updateConfig(config)}>
            保存配置
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`error-monitor-panel ${className || ''}`} style={style}>
      <div className="panel-header">
        <div className="panel-title">
          <Bug size={20} />
          <h2>错误监控</h2>
          <div className="monitoring-status">
            <div className={`status-indicator ${isMonitoring ? 'active' : 'inactive'}`} />
            <span>{isMonitoring ? '监控中' : '已停止'}</span>
          </div>
        </div>
        
        <div className="panel-controls">
          <button
            className="control-button"
            onClick={() => window.location.reload()}
            title="刷新"
          >
            <RefreshCw size={16} />
          </button>
          
          <button
            className="control-button"
            onClick={() => setActiveTab('config')}
            title="配置"
          >
            <Settings size={16} />
          </button>
          
          {onClose && (
            <button
              className="control-button close"
              onClick={onClose}
              title="关闭"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="panel-tabs">
        {renderTabButton('list', '错误列表', <AlertTriangle size={16} />)}
        {renderTabButton('stats', '统计分析', <BarChart3 size={16} />)}
        {renderTabButton('config', '配置', <Settings size={16} />)}
      </div>

      <div className="panel-content">
        {isLoading && <div className="loading-overlay">处理中...</div>}
        
        {activeTab === 'list' && renderErrorList()}
        {activeTab === 'stats' && renderStatsPanel()}
        {activeTab === 'config' && renderConfigPanel()}
      </div>

      {showDetailsModal && selectedError && (
        <ErrorDetailsModal
          error={selectedError}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedError(null)
          }}
          onResolve={handleResolveError}
          onRetry={handleRetryError}
        />
      )}
    </div>
  )
}

export default ErrorMonitorPanel

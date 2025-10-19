/**
 * 错误详情模态框组件
 */

import React, { useState } from 'react'
import {
  X,
  AlertTriangle,
  Clock,
  MapPin,
  Code,
  User,
  Monitor,
  RefreshCw,
  CheckCircle,
  Copy,
  ExternalLink
} from 'lucide-react'
import { ErrorDetails, ErrorSeverity } from '../../types/error'
import './ErrorDetailsModal.css'

interface ErrorDetailsModalProps {
  error: ErrorDetails
  onClose: () => void
  onResolve: (errorId: string, resolution: string) => void
  onRetry: (errorId: string) => void
}

export const ErrorDetailsModal: React.FC<ErrorDetailsModalProps> = ({
  error,
  onClose,
  onResolve,
  onRetry
}) => {
  const [resolution, setResolution] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'context' | 'stack'>('details')
  const [copied, setCopied] = useState('')

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(''), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleResolve = () => {
    if (resolution.trim()) {
      onResolve(error.id, resolution.trim())
      onClose()
    }
  }

  const handleRetry = () => {
    onRetry(error.id)
    onClose()
  }

  const renderSeverityBadge = (severity: ErrorSeverity) => {
    const severityConfig = {
      low: { className: 'severity-low', label: '低' },
      medium: { className: 'severity-medium', label: '中' },
      high: { className: 'severity-high', label: '高' },
      critical: { className: 'severity-critical', label: '严重' }
    }
    
    const config = severityConfig[severity] || severityConfig.medium
    return (
      <span className={`severity-badge ${config.className}`}>
        <AlertTriangle size={12} />
        {config.label}
      </span>
    )
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const renderDetailsTab = () => (
    <div className="tab-content details-tab">
      <div className="error-overview">
        <div className="error-title">
          <h3>{error.name}</h3>
          {renderSeverityBadge(error.severity)}
        </div>
        
        <div className="error-message">
          <h4>错误消息</h4>
          <div className="message-content">
            <p>{error.message}</p>
            <button
              className="copy-button"
              onClick={() => handleCopy(error.message, 'message')}
              title="复制消息"
            >
              <Copy size={14} />
              {copied === 'message' ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        {error.cause && (
          <div className="error-cause">
            <h4>错误原因</h4>
            <p>{error.cause}</p>
          </div>
        )}

        <div className="error-stats">
          <div className="stat-item">
            <Clock size={16} />
            <div>
              <span className="stat-label">首次发生</span>
              <span className="stat-value">{formatTimestamp(error.firstOccurred)}</span>
            </div>
          </div>
          
          <div className="stat-item">
            <RefreshCw size={16} />
            <div>
              <span className="stat-label">最近发生</span>
              <span className="stat-value">{formatTimestamp(error.lastOccurred)}</span>
            </div>
          </div>
          
          <div className="stat-item">
            <AlertTriangle size={16} />
            <div>
              <span className="stat-label">发生次数</span>
              <span className="stat-value">{error.occurrenceCount}</span>
            </div>
          </div>
        </div>

        <div className="error-classification">
          <div className="classification-item">
            <span className="classification-label">类型</span>
            <span className="classification-value type-badge">{error.type}</span>
          </div>
          
          <div className="classification-item">
            <span className="classification-label">来源</span>
            <span className="classification-value source-badge">{error.source}</span>
          </div>
          
          <div className="classification-item">
            <span className="classification-label">状态</span>
            <span className="classification-value status-badge">{error.status}</span>
          </div>
        </div>

        {error.recoveryStrategy && (
          <div className="recovery-info">
            <h4>恢复策略</h4>
            <div className="recovery-strategy">
              <span className="strategy-badge">{error.recoveryStrategy}</span>
              {error.recoveryAttempts !== undefined && (
                <span className="recovery-attempts">
                  已尝试 {error.recoveryAttempts}/{error.maxRetries || 3} 次
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderContextTab = () => (
    <div className="tab-content context-tab">
      <div className="context-section">
        <h4><MapPin size={16} /> 位置信息</h4>
        <div className="context-grid">
          <div className="context-item">
            <span className="context-label">URL</span>
            <span className="context-value">{error.context.url || 'N/A'}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">路由</span>
            <span className="context-value">{error.context.route || 'N/A'}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">组件</span>
            <span className="context-value">{error.context.component || 'N/A'}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">函数</span>
            <span className="context-value">{error.context.function || 'N/A'}</span>
          </div>
          
          {error.context.line && (
            <div className="context-item">
              <span className="context-label">行号</span>
              <span className="context-value">{error.context.line}</span>
            </div>
          )}
          
          {error.context.column && (
            <div className="context-item">
              <span className="context-label">列号</span>
              <span className="context-value">{error.context.column}</span>
            </div>
          )}
        </div>
      </div>

      <div className="context-section">
        <h4><User size={16} /> 用户信息</h4>
        <div className="context-grid">
          <div className="context-item">
            <span className="context-label">会话ID</span>
            <span className="context-value">{error.context.sessionId}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">用户ID</span>
            <span className="context-value">{error.context.userId || 'N/A'}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">User Agent</span>
            <span className="context-value" title={error.context.userAgent}>
              {error.context.userAgent ? 
                error.context.userAgent.substring(0, 50) + '...' : 'N/A'
              }
            </span>
          </div>
        </div>
      </div>

      <div className="context-section">
        <h4><Monitor size={16} /> 环境信息</h4>
        <div className="context-grid">
          <div className="context-item">
            <span className="context-label">平台</span>
            <span className="context-value">{error.context.platform}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">应用版本</span>
            <span className="context-value">{error.context.appVersion}</span>
          </div>
          
          <div className="context-item">
            <span className="context-label">构建版本</span>
            <span className="context-value">{error.context.buildVersion}</span>
          </div>
        </div>
      </div>

      {error.context.operation && (
        <div className="context-section">
          <h4><Code size={16} /> 操作信息</h4>
          <div className="context-grid">
            <div className="context-item">
              <span className="context-label">操作</span>
              <span className="context-value">{error.context.operation}</span>
            </div>
          </div>
        </div>
      )}

      {error.context.metadata && Object.keys(error.context.metadata).length > 0 && (
        <div className="context-section">
          <h4>元数据</h4>
          <div className="metadata-content">
            <pre>{JSON.stringify(error.context.metadata, null, 2)}</pre>
            <button
              className="copy-button"
              onClick={() => handleCopy(JSON.stringify(error.context.metadata, null, 2), 'metadata')}
            >
              <Copy size={14} />
              {copied === 'metadata' ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const renderStackTab = () => (
    <div className="tab-content stack-tab">
      {error.stack ? (
        <div className="stack-trace">
          <div className="stack-header">
            <h4>堆栈跟踪</h4>
            <button
              className="copy-button"
              onClick={() => handleCopy(error.stack!, 'stack')}
            >
              <Copy size={14} />
              {copied === 'stack' ? '已复制' : '复制'}
            </button>
          </div>
          <pre className="stack-content">{error.stack}</pre>
        </div>
      ) : (
        <div className="no-stack">
          <Code size={48} />
          <h4>无堆栈跟踪信息</h4>
          <p>此错误没有可用的堆栈跟踪信息。</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="error-details-modal-backdrop">
      <div className="error-details-modal">
        <div className="modal-header">
          <div className="modal-title">
            <AlertTriangle size={20} />
            <h2>错误详情</h2>
          </div>
          
          <button
            className="close-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            详情
          </button>
          
          <button
            className={`tab-button ${activeTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveTab('context')}
          >
            上下文
          </button>
          
          <button
            className={`tab-button ${activeTab === 'stack' ? 'active' : ''}`}
            onClick={() => setActiveTab('stack')}
          >
            堆栈
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'details' && renderDetailsTab()}
          {activeTab === 'context' && renderContextTab()}
          {activeTab === 'stack' && renderStackTab()}
        </div>

        {error.status !== 'resolved' && (
          <div className="modal-footer">
            <div className="resolution-section">
              <textarea
                placeholder="输入解决方案或备注（可选）..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="resolution-input"
              />
            </div>
            
            <div className="action-buttons">
              <button
                className="action-button secondary"
                onClick={onClose}
              >
                关闭
              </button>
              
              <button
                className="action-button retry"
                onClick={handleRetry}
              >
                <RefreshCw size={16} />
                重试
              </button>
              
              <button
                className="action-button primary"
                onClick={handleResolve}
              >
                <CheckCircle size={16} />
                标记为已解决
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorDetailsModal

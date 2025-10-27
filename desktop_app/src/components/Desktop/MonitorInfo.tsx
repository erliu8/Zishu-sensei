/**
 * 显示器信息组件
 * 
 * 展示系统的显示器配置信息，包括：
 * - 所有显示器列表
 * - 主显示器标识
 * - 分辨率和 DPI 信息
 * - 虚拟屏幕布局
 */

import React from 'react'
import { useMonitor } from '@/hooks/useMonitor'
import { calculateMonitorStats, getPhysicalSize } from '@/types/monitor'
import type { MonitorInfo as MonitorInfoType } from '@/types/monitor'

/**
 * 显示器信息组件属性
 */
export interface MonitorInfoProps {
  /** 是否自动刷新 */
  autoRefresh?: boolean
  /** 刷新间隔（毫秒） */
  refreshInterval?: number
  /** 是否显示详细信息 */
  showDetails?: boolean
  /** 自定义样式类名 */
  className?: string
}

/**
 * 显示器卡片组件
 */
const MonitorCard: React.FC<{ monitor: MonitorInfoType; index: number }> = ({ monitor, index }) => {
  const physicalSize = getPhysicalSize(monitor)
  
  return (
    <div className="monitor-card">
      <div className="monitor-card-header">
        <h4>
          {monitor.name || `显示器 ${index + 1}`}
          {monitor.is_primary && <span className="primary-badge">主显示器</span>}
        </h4>
      </div>
      
      <div className="monitor-card-body">
        <div className="info-row">
          <span className="label">分辨率:</span>
          <span className="value">
            {monitor.size.width} × {monitor.size.height} (物理像素)
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">逻辑尺寸:</span>
          <span className="value">
            {Math.round(monitor.size.logical_width)} × {Math.round(monitor.size.logical_height)}
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">位置:</span>
          <span className="value">
            ({monitor.position.x}, {monitor.position.y})
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">缩放:</span>
          <span className="value">{Math.round(monitor.scale_factor * 100)}%</span>
        </div>
        
        <div className="info-row">
          <span className="label">方向:</span>
          <span className="value">
            {monitor.orientation === 'landscape' ? '横向' : 
             monitor.orientation === 'portrait' ? '竖向' : '正方形'}
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">估算尺寸:</span>
          <span className="value">
            {physicalSize.diagonal}" 
            ({physicalSize.widthInches}" × {physicalSize.heightInches}")
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * 显示器信息组件
 */
export const MonitorInfo: React.FC<MonitorInfoProps> = ({
  autoRefresh = false,
  refreshInterval = 30000,
  showDetails = true,
  className = '',
}) => {
  const {
    desktopInfo,
    monitors,
    monitorCount,
    isLoading,
    error,
    refresh,
  } = useMonitor({
    autoFetch: true,
    listenForChanges: true,
    refreshInterval: autoRefresh ? refreshInterval : 0,
  })

  if (isLoading && !desktopInfo) {
    return (
      <div className={`monitor-info loading ${className}`}>
        <div className="loading-spinner">
          <span>加载显示器信息...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`monitor-info error ${className}`}>
        <div className="error-message">
          <h3>❌ 加载失败</h3>
          <p>{error.message}</p>
          <button onClick={refresh} className="retry-button">
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!desktopInfo) {
    return (
      <div className={`monitor-info empty ${className}`}>
        <p>没有显示器信息</p>
      </div>
    )
  }

  const stats = calculateMonitorStats(desktopInfo)

  return (
    <div className={`monitor-info ${className}`}>
      {/* 概览区域 */}
      <div className="monitor-overview">
        <h3>🖥️ 显示器配置</h3>
        
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">显示器数量</span>
            <span className="stat-value">{monitorCount}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">虚拟屏幕</span>
            <span className="stat-value">
              {desktopInfo.virtual_screen.total_width} × {desktopInfo.virtual_screen.total_height}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">平均缩放</span>
            <span className="stat-value">
              {Math.round(stats.average_scale_factor * 100)}%
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">排列方式</span>
            <span className="stat-value">
              {stats.arrangement === 'single' ? '单显示器' :
               stats.arrangement === 'horizontal' ? '水平排列' :
               stats.arrangement === 'vertical' ? '垂直排列' : '混合排列'}
            </span>
          </div>
        </div>

        <button onClick={refresh} className="refresh-button" disabled={isLoading}>
          {isLoading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* 显示器列表 */}
      {showDetails && (
        <div className="monitors-list">
          <h4>显示器详情</h4>
          <div className="monitors-grid">
            {monitors.map((monitor, index) => (
              <MonitorCard key={monitor.name || index} monitor={monitor} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* 虚拟屏幕布局 */}
      {showDetails && monitorCount > 1 && (
        <div className="virtual-screen-layout">
          <h4>虚拟屏幕布局</h4>
          <div className="layout-info">
            <p>范围: ({desktopInfo.virtual_screen.min_x}, {desktopInfo.virtual_screen.min_y}) 
               到 ({desktopInfo.virtual_screen.max_x}, {desktopInfo.virtual_screen.max_y})</p>
            <p>总面积: {stats.total_area.toLocaleString()} 像素²</p>
          </div>
        </div>
      )}

      <style>{`
        .monitor-info {
          padding: 20px;
          background: var(--bg-secondary, #f8f9fa);
          border-radius: 8px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .monitor-info.loading,
        .monitor-info.error,
        .monitor-info.empty {
          text-align: center;
          padding: 40px;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .error-message {
          color: var(--error-color, #dc3545);
        }

        .retry-button {
          margin-top: 16px;
          padding: 8px 24px;
          background: var(--primary-color, #007bff);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .retry-button:hover {
          opacity: 0.9;
        }

        .monitor-overview {
          margin-bottom: 24px;
        }

        .monitor-overview h3 {
          margin-bottom: 16px;
          font-size: 20px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          padding: 12px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-secondary, #6c757d);
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #212529);
        }

        .refresh-button {
          padding: 8px 16px;
          background: var(--primary-color, #007bff);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-button:hover:not(:disabled) {
          opacity: 0.9;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .monitors-list {
          margin-top: 24px;
        }

        .monitors-list h4 {
          margin-bottom: 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .monitors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .monitor-card {
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .monitor-card-header {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e9ecef;
        }

        .monitor-card-header h4 {
          margin: 0;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .primary-badge {
          display: inline-block;
          padding: 2px 8px;
          background: var(--success-color, #28a745);
          color: white;
          font-size: 11px;
          border-radius: 12px;
          font-weight: 500;
        }

        .monitor-card-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        .info-row .label {
          color: var(--text-secondary, #6c757d);
          font-weight: 500;
        }

        .info-row .value {
          color: var(--text-primary, #212529);
          font-family: monospace;
        }

        .virtual-screen-layout {
          margin-top: 24px;
          padding: 16px;
          background: white;
          border-radius: 8px;
        }

        .virtual-screen-layout h4 {
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: 600;
        }

        .layout-info p {
          margin: 4px 0;
          font-size: 14px;
          color: var(--text-secondary, #6c757d);
        }
      `}</style>
    </div>
  )
}

export default MonitorInfo


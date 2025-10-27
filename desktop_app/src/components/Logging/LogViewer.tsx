/**
 * 日志查看器组件
 * 
 * 提供完整的日志管理和查看功能：
 * - 日志列表显示和分页
 * - 高级搜索和过滤
 * - 日志统计和图表
 * - 日志导出功能
 * - 实时日志更新
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Eye, 
  BarChart3,
  Trash2,
  Upload,
  AlertCircle,
  Info,
  XCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useLogging } from '../../hooks/useLogging';
import { LogLevel, LogFilter, LogEntry } from '../../services/loggingService';
import './LogViewer.css';

// ================================
// 类型定义
// ================================

interface LogViewerProps {
  /** 是否显示为模态框 */
  isModal?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 初始过滤条件 */
  initialFilter?: LogFilter;
  /** 是否自动刷新 */
  autoRefresh?: boolean;
  /** 刷新间隔（秒） */
  refreshInterval?: number;
}

interface LogViewConfig {
  showTimestamp: boolean;
  showLevel: boolean;
  showModule: boolean;
  showFile: boolean;
  showData: boolean;
  showTags: boolean;
  compactMode: boolean;
  darkTheme: boolean;
}

// ================================
// 主组件
// ================================

export const LogViewer: React.FC<LogViewerProps> = ({
  isModal = false,
  onClose,
  initialFilter,
  autoRefresh = false,
  refreshInterval = 30
}) => {
  // ================================
  // 状态管理
  // ================================

  const {
    logs,
    statistics,
    isLoading,
    error,
    searchLogs,
    exportLogs,
    clearLogs,
    uploadLogs,
    getLogFiles
  } = useLogging();

  // 搜索和过滤状态
  const [filter, setFilter] = useState<LogFilter>(initialFilter || {});
  const [searchText, setSearchText] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 视图配置
  const [viewConfig, setViewConfig] = useState<LogViewConfig>({
    showTimestamp: true,
    showLevel: true,
    showModule: true,
    showFile: false,
    showData: false,
    showTags: false,
    compactMode: false,
    darkTheme: false
  });
  
  // 选中的日志
  const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
  const [selectedLogDetail, setSelectedLogDetail] = useState<LogEntry | null>(null);
  
  // 统计面板状态
  const [showStatistics, setShowStatistics] = useState(false);
  
  // 导出状态
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ================================
  // 计算属性
  // ================================

  // 构建完整的过滤条件
  const fullFilter = useMemo<LogFilter>(() => {
    const result: LogFilter = { ...filter };
    
    if (searchText.trim()) {
      result.keywords = [searchText.trim()];
    }
    
    return result;
  }, [filter, searchText]);

  // 级别颜色映射
  const levelColors = {
    [LogLevel.DEBUG]: '#6B7280',
    [LogLevel.INFO]: '#3B82F6', 
    [LogLevel.WARN]: '#F59E0B',
    [LogLevel.ERROR]: '#EF4444',
    [LogLevel.FATAL]: '#7C3AED'
  };

  // 级别图标映射
  const levelIcons = {
    [LogLevel.DEBUG]: Eye,
    [LogLevel.INFO]: Info,
    [LogLevel.WARN]: AlertTriangle,
    [LogLevel.ERROR]: XCircle,
    [LogLevel.FATAL]: Zap
  };

  // ================================
  // 副作用
  // ================================

  // 初始加载和搜索
  useEffect(() => {
    handleSearch();
  }, [fullFilter, currentPage, pageSize, sortBy, sortOrder]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      handleSearch(false);
    }, refreshInterval * 1000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fullFilter]);

  // ================================
  // 事件处理
  // ================================

  const handleSearch = useCallback(async (resetPage = true) => {
    if (resetPage && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    
    try {
      await searchLogs({
        filter: Object.keys(fullFilter).length > 0 ? fullFilter : undefined,
        page: currentPage,
        pageSize,
        sortBy,
        sortOrder
      });
    } catch (err) {
      console.error('搜索日志失败:', err);
    }
  }, [fullFilter, currentPage, pageSize, sortBy, sortOrder, searchLogs]);

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'txt') => {
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `logs-${timestamp}.${format}`;
      
      await exportLogs(
        format,
        Object.keys(fullFilter).length > 0 ? fullFilter : undefined,
        filename
      );
      
      // 通知用户导出成功
      alert(`日志已导出到 ${filename}`);
    } catch (err) {
      console.error('导出日志失败:', err);
      alert(`导出失败: ${err}`);
    } finally {
      setIsExporting(false);
    }
  }, [fullFilter, exportLogs]);

  const handleUploadLogs = useCallback(async () => {
    setIsUploading(true);
    try {
      const count = await uploadLogs();
      alert(`成功上传 ${count} 条日志`);
    } catch (err) {
      console.error('上传日志失败:', err);
      alert(`上传失败: ${err}`);
    } finally {
      setIsUploading(false);
    }
  }, [uploadLogs]);

  const handleDeleteLogs = useCallback(async () => {
    if (selectedLogs.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedLogs.size} 条日志吗？此操作不可撤销。`)) {
      try {
        // TODO: 实现批量删除功能
        setSelectedLogs(new Set());
        await handleSearch();
      } catch (err) {
        console.error('删除日志失败:', err);
        alert(`删除失败: ${err}`);
      }
    }
  }, [selectedLogs, handleSearch]);

  const handleSelectAll = useCallback(() => {
    if (!logs || logs.logs.length === 0) return;
    
    const allIds = new Set(logs.logs.map((_, index) => index));
    setSelectedLogs(selectedLogs.size === logs.logs.length ? new Set() : allIds);
  }, [logs, selectedLogs.size]);

  const handleSelectLog = useCallback((index: number) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLogs(newSelected);
  }, [selectedLogs]);

  const handleShowLogDetail = useCallback((log: LogEntry) => {
    setSelectedLogDetail(log);
  }, []);

  // ================================
  // 渲染方法
  // ================================

  const renderHeader = () => (
    <div className="log-viewer-header">
      <div className="header-title">
        <h2>日志查看器</h2>
        {statistics && (
          <span className="log-count">
            总计 {statistics.totalCount} 条日志
          </span>
        )}
      </div>
      
      <div className="header-actions">
        <button
          className="btn btn-icon"
          onClick={() => setShowStatistics(!showStatistics)}
          title="显示统计信息"
        >
          <BarChart3 size={16} />
        </button>
        
        <button
          className="btn btn-icon"
          onClick={() => handleSearch()}
          disabled={isLoading}
          title="刷新"
        >
          <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
        </button>
        
        <button
          className="btn btn-icon"
          onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
          title="高级过滤"
        >
          <Filter size={16} />
        </button>
        
        {isModal && onClose && (
          <button
            className="btn btn-icon btn-close"
            onClick={onClose}
            title="关闭"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  const renderSearchBar = () => (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="搜索日志内容、模块名称..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="search-actions">
        <select 
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [newSortBy, newSortOrder] = e.target.value.split('-');
            setSortBy(newSortBy);
            setSortOrder(newSortOrder as 'asc' | 'desc');
          }}
          className="sort-select"
        >
          <option value="timestamp-desc">时间↓</option>
          <option value="timestamp-asc">时间↑</option>
          <option value="level-desc">级别↓</option>
          <option value="level-asc">级别↑</option>
          <option value="module-asc">模块↑</option>
          <option value="message-asc">消息↑</option>
        </select>
        
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="page-size-select"
        >
          <option value={25}>25条/页</option>
          <option value={50}>50条/页</option>
          <option value={100}>100条/页</option>
          <option value={200}>200条/页</option>
        </select>
      </div>
    </div>
  );

  const renderAdvancedFilter = () => {
    if (!showAdvancedFilter) return null;
    
    return (
      <div className="advanced-filter">
        <div className="filter-row">
          <label>日志级别:</label>
          <div className="level-filters">
            {Object.values(LogLevel).filter(l => typeof l === 'number').map((level) => {
              const levelNum = level as LogLevel;
              const levelName = LogLevel[levelNum];
              const isSelected = filter.levels?.includes(levelNum);
              
              return (
                <button
                  key={levelNum}
                  className={`level-filter-btn ${isSelected ? 'selected' : ''}`}
                  style={{ 
                    borderColor: levelColors[levelNum],
                    backgroundColor: isSelected ? levelColors[levelNum] : 'transparent',
                    color: isSelected ? 'white' : levelColors[levelNum]
                  }}
                  onClick={() => {
                    const currentLevels = filter.levels || [];
                    const newLevels = isSelected
                      ? currentLevels.filter(l => l !== levelNum)
                      : [...currentLevels, levelNum];
                    
                    setFilter({
                      ...filter,
                      levels: newLevels.length > 0 ? newLevels : undefined
                    });
                  }}
                >
                  {levelName}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="filter-row">
          <label>模块名称:</label>
          <input
            type="text"
            placeholder="例如: auth,chat,system"
            value={filter.modules?.join(',') || ''}
            onChange={(e) => {
              const modules = e.target.value.split(',')
                .map(m => m.trim())
                .filter(m => m.length > 0);
              setFilter({
                ...filter,
                modules: modules.length > 0 ? modules : undefined
              });
            }}
          />
        </div>
        
        <div className="filter-row">
          <label>时间范围:</label>
          <div className="time-range-inputs">
            <input
              type="datetime-local"
              value={filter.timeRange?.start 
                ? new Date(filter.timeRange.start * 1000).toISOString().slice(0, 16)
                : ''
              }
              onChange={(e) => {
                const start = e.target.value 
                  ? Math.floor(new Date(e.target.value).getTime() / 1000)
                  : undefined;
                setFilter({
                  ...filter,
                  timeRange: start ? {
                    start,
                    end: filter.timeRange?.end || Math.floor(Date.now() / 1000)
                  } : undefined
                });
              }}
            />
            <span>至</span>
            <input
              type="datetime-local"
              value={filter.timeRange?.end
                ? new Date(filter.timeRange.end * 1000).toISOString().slice(0, 16)
                : ''
              }
              onChange={(e) => {
                const end = e.target.value
                  ? Math.floor(new Date(e.target.value).getTime() / 1000)
                  : undefined;
                setFilter({
                  ...filter,
                  timeRange: end ? {
                    start: filter.timeRange?.start || 0,
                    end
                  } : undefined
                });
              }}
            />
          </div>
        </div>
        
        <div className="filter-actions">
          <button 
            onClick={() => setFilter({})}
            className="btn btn-secondary"
          >
            清空筛选
          </button>
        </div>
      </div>
    );
  };

  const renderLogList = () => (
    <div className="log-list-container">
      <div className="log-list-header">
        <div className="bulk-actions">
          <input
            type="checkbox"
            checked={selectedLogs.size > 0 && logs !== null && selectedLogs.size === logs.logs.length}
            onChange={handleSelectAll}
          />
          <span>选中 {selectedLogs.size} 条</span>
          
          {selectedLogs.size > 0 && (
            <>
              <button 
                onClick={handleDeleteLogs}
                className="btn btn-danger btn-small"
                title="删除选中"
              >
                <Trash2 size={14} />
              </button>
              
              <button
                onClick={() => handleExport('json')}
                className="btn btn-secondary btn-small"
                disabled={isExporting}
                title="导出选中"
              >
                <Download size={14} />
              </button>
            </>
          )}
        </div>
        
        <div className="view-config">
          <button
            onClick={() => setViewConfig({ ...viewConfig, compactMode: !viewConfig.compactMode })}
            className={`btn btn-small ${viewConfig.compactMode ? 'active' : ''}`}
            title="紧凑模式"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>
      
      <div className={`log-list ${viewConfig.compactMode ? 'compact' : ''}`}>
        {logs && logs.logs.map((log, index) => {
          const LevelIcon = levelIcons[log.level];
          const isSelected = selectedLogs.has(index);
          
          return (
            <div
              key={index}
              className={`log-item ${isSelected ? 'selected' : ''} level-${LogLevel[log.level].toLowerCase()}`}
              onClick={() => handleShowLogDetail(log)}
            >
              <div className="log-item-header">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectLog(index)}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div 
                  className="log-level"
                  style={{ color: levelColors[log.level] }}
                >
                  <LevelIcon size={16} />
                  <span className="level-name">{LogLevel[log.level]}</span>
                </div>
                
                {viewConfig.showTimestamp && (
                  <div className="log-timestamp">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                )}
                
                {viewConfig.showModule && log.module && (
                  <div className="log-module">
                    [{log.module}]
                  </div>
                )}
              </div>
              
              <div className="log-content">
                <div className="log-message">{log.message}</div>
                
                {viewConfig.showFile && log.file && (
                  <div className="log-location">
                    {log.file}:{log.line}
                  </div>
                )}
                
                {viewConfig.showData && log.data && (
                  <div className="log-data">
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
                
                {viewConfig.showTags && log.tags.length > 0 && (
                  <div className="log-tags">
                    {log.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPagination = () => {
    if (!logs || logs.totalPages <= 1) return null;
    
    const { page, totalPages } = logs;
    const pages = [];
    
    // 计算显示的页码范围
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return (
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(page - 1)}
          disabled={page <= 1}
          className="pagination-btn"
        >
          上一页
        </button>
        
        {startPage > 1 && (
          <>
            <button onClick={() => setCurrentPage(1)} className="pagination-btn">1</button>
            {startPage > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}
        
        {pages.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum)}
            className={`pagination-btn ${pageNum === page ? 'active' : ''}`}
          >
            {pageNum}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
            <button onClick={() => setCurrentPage(totalPages)} className="pagination-btn">
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => setCurrentPage(page + 1)}
          disabled={page >= totalPages}
          className="pagination-btn"
        >
          下一页
        </button>
        
        <div className="pagination-info">
          第 {page} 页，共 {totalPages} 页，总计 {logs.total} 条记录
        </div>
      </div>
    );
  };

  const renderStatistics = () => {
    if (!showStatistics || !statistics) return null;
    
    return (
      <div className="statistics-panel">
        <h3>日志统计</h3>
        
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">总数量</div>
            <div className="stat-value">{statistics.totalCount}</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">错误率</div>
            <div className="stat-value">{statistics.errorRate?.toFixed(2)}%</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">平均大小</div>
            <div className="stat-value">{statistics.averageSize?.toFixed(0)}B</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">待上传</div>
            <div className="stat-value">{statistics.uploadStats?.pendingUpload || 0}</div>
          </div>
        </div>
        
        <div className="level-distribution">
          <h4>级别分布</h4>
          <div className="level-bars">
            {Object.entries(statistics.countByLevel || {}).map(([level, count]) => {
              const levelEnum = LogLevel[level as keyof typeof LogLevel] as LogLevel;
              const percentage = statistics.totalCount > 0 ? (count / statistics.totalCount) * 100 : 0;
              
              return (
                <div key={level} className="level-bar">
                  <div className="level-bar-label">
                    <span style={{ color: levelColors[levelEnum] }}>{level}</span>
                    <span className="level-bar-count">{count}</span>
                  </div>
                  <div className="level-bar-track">
                    <div 
                      className="level-bar-fill"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: levelColors[levelEnum]
                      }}
                    />
                  </div>
                  <span className="level-bar-percentage">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderLogDetailModal = () => {
    if (!selectedLogDetail) return null;
    
    return (
      <div className="log-detail-modal-overlay" onClick={() => setSelectedLogDetail(null)}>
        <div className="log-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="log-detail-header">
            <h3>日志详情</h3>
            <button 
              onClick={() => setSelectedLogDetail(null)}
              className="btn btn-icon"
            >
              ×
            </button>
          </div>
          
          <div className="log-detail-content">
            <div className="detail-section">
              <label>级别:</label>
              <span className={`log-level level-${LogLevel[selectedLogDetail.level].toLowerCase()}`}>
                {LogLevel[selectedLogDetail.level]}
              </span>
            </div>
            
            <div className="detail-section">
              <label>时间:</label>
              <span>{new Date(selectedLogDetail.timestamp).toLocaleString()}</span>
            </div>
            
            {selectedLogDetail.module && (
              <div className="detail-section">
                <label>模块:</label>
                <span>{selectedLogDetail.module}</span>
              </div>
            )}
            
            {selectedLogDetail.file && (
              <div className="detail-section">
                <label>文件:</label>
                <span>{selectedLogDetail.file}:{selectedLogDetail.line}</span>
              </div>
            )}
            
            <div className="detail-section">
              <label>消息:</label>
              <div className="log-message-detail">{selectedLogDetail.message}</div>
            </div>
            
            {selectedLogDetail.data && (
              <div className="detail-section">
                <label>数据:</label>
                <pre className="log-data-detail">
                  {JSON.stringify(selectedLogDetail.data, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedLogDetail.stack && (
              <div className="detail-section">
                <label>堆栈:</label>
                <pre className="log-stack-detail">{selectedLogDetail.stack}</pre>
              </div>
            )}
            
            {selectedLogDetail.tags.length > 0 && (
              <div className="detail-section">
                <label>标签:</label>
                <div className="log-tags-detail">
                  {selectedLogDetail.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderActions = () => (
    <div className="log-viewer-actions">
      <div className="export-actions">
        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="btn btn-secondary"
        >
          <Download size={16} />
          导出 JSON
        </button>
        
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="btn btn-secondary"
        >
          <Download size={16} />
          导出 CSV
        </button>
        
        <button
          onClick={() => handleExport('txt')}
          disabled={isExporting}
          className="btn btn-secondary"
        >
          <Download size={16} />
          导出 TXT
        </button>
      </div>
      
      <div className="manage-actions">
        <button
          onClick={handleUploadLogs}
          disabled={isUploading}
          className="btn btn-primary"
        >
          <Upload size={16} />
          {isUploading ? '上传中...' : '上传日志'}
        </button>
        
        <button
          onClick={() => {
            if (confirm('确定要清空所有日志吗？此操作不可撤销。')) {
              clearLogs();
            }
          }}
          className="btn btn-danger"
        >
          <Trash2 size={16} />
          清空日志
        </button>
      </div>
    </div>
  );

  // ================================
  // 主渲染
  // ================================

  return (
    <div className={`log-viewer ${isModal ? 'modal' : ''} ${viewConfig.darkTheme ? 'dark' : ''}`}>
      {renderHeader()}
      
      <div className="log-viewer-body">
        {renderSearchBar()}
        {renderAdvancedFilter()}
        
        <div className="log-viewer-content">
          <div className="log-viewer-main">
            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            {isLoading ? (
              <div className="loading-message">
                <RefreshCw size={16} className="spinning" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                {renderLogList()}
                {renderPagination()}
              </>
            )}
          </div>
          
          {showStatistics && (
            <div className="log-viewer-sidebar">
              {renderStatistics()}
            </div>
          )}
        </div>
        
        {renderActions()}
      </div>
      
      {renderLogDetailModal()}
    </div>
  );
};

export default LogViewer;

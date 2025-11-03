import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Grid,
  List,
  MoreVertical,
  Eye,
  Copy,
  FileText
} from 'lucide-react';
import { useFileManager } from '../../hooks/useFileManager';
import { FileDropZone } from './FileDropZone';
import type { FileInfo } from '../../types/file';
import { formatFileSize, getFileTypeLabel, FILE_TYPE_ICONS } from '../../types/file';
import './FileManagerPanel.css';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'size' | 'type';

export interface FileManagerPanelProps {
  conversationId?: string;
  onFileSelect?: (file: FileInfo) => void;
  allowUpload?: boolean;
  allowDelete?: boolean;
}

export const FileManagerPanel: React.FC<FileManagerPanelProps> = ({
  conversationId,
  onFileSelect,
  allowUpload = true,
  allowDelete = true,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const {
    files,
    loading,
    error,
    uploadProgress,
    loadFiles,
    uploadFiles,
    deleteFile,
    batchDelete,
    searchFiles,
  } = useFileManager({
    conversation_id: conversationId,
    file_type: selectedFileType || undefined,
  });

  // 过滤和排序文件
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.original_name.toLowerCase().includes(query) ||
          file.tags?.toLowerCase().includes(query)
      );
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.original_name.localeCompare(b.original_name);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'size':
          return b.file_size - a.file_size;
        case 'type':
          return a.file_type.localeCompare(b.file_type);
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, sortBy]);

  // 文件类型统计
  const fileTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach((file) => {
      counts[file.file_type] = (counts[file.file_type] || 0) + 1;
    });
    return counts;
  }, [files]);

  const handleFilesSelected = useCallback(
    async (selectedFiles: File[]) => {
      try {
        await uploadFiles(selectedFiles, { conversationId });
      } catch (err) {
        console.error('Failed to upload files:', err);
      }
    },
    [uploadFiles, conversationId]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery) {
        searchFiles({ keyword: searchQuery, file_type: selectedFileType || undefined });
      } else {
        loadFiles();
      }
    },
    [searchQuery, selectedFileType, searchFiles, loadFiles]
  );

  const handleFileSelect = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.size === filteredAndSortedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map((f) => f.id)));
    }
  }, [selectedFiles, filteredAndSortedFiles]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    
    const confirmed = window.confirm(`确定要删除 ${selectedFiles.size} 个文件吗？`);
    if (!confirmed) return;

    try {
      await batchDelete(Array.from(selectedFiles));
      setSelectedFiles(new Set());
    } catch (err) {
      console.error('Failed to delete files:', err);
    }
  }, [selectedFiles, batchDelete]);

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      const confirmed = window.confirm('确定要删除这个文件吗？');
      if (!confirmed) return;

      try {
        await deleteFile(fileId);
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    },
    [deleteFile]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="file-manager-panel">
      {/* 头部工具栏 */}
      <div className="file-manager-header">
        <div className="header-left">
          <h2>文件管理</h2>
          <span className="file-count">
            {filteredAndSortedFiles.length} 个文件
          </span>
        </div>

        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => loadFiles()}
            title="刷新"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>

          <button
            className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="网格视图"
          >
            <Grid size={18} />
          </button>

          <button
            className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="file-manager-toolbar">
        <form className="search-form" onSubmit={handleSearch}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </form>

        <div className="filter-group">
          <Filter size={18} />
          <select
            value={selectedFileType || ''}
            onChange={(e) => setSelectedFileType(e.target.value || null)}
            className="filter-select"
          >
            <option value="">所有类型</option>
            {Object.entries(fileTypeCounts).map(([type, count]) => (
              <option key={type} value={type}>
                {getFileTypeLabel(type)} ({count})
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="filter-select"
          >
            <option value="date">按日期</option>
            <option value="name">按名称</option>
            <option value="size">按大小</option>
            <option value="type">按类型</option>
          </select>
        </div>

        {selectedFiles.size > 0 && allowDelete && (
          <div className="batch-actions">
            <span>{selectedFiles.size} 项已选</span>
            <button className="btn-danger" onClick={handleBatchDelete}>
              <Trash2 size={16} />
              批量删除
            </button>
          </div>
        )}
      </div>

      {/* 上传区域 */}
      {allowUpload && (
        <div className="upload-section">
          <FileDropZone onFilesSelected={handleFilesSelected} />
        </div>
      )}

      {/* 上传进度 */}
      {uploadProgress.length > 0 && (
        <div className="upload-progress">
          {uploadProgress.map((progress) => (
            <div key={progress.file_id} className="progress-item">
              <FileText size={16} />
              <span className="progress-name">{progress.file_name}</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <span className="progress-status">{progress.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
        </div>
      )}

      {/* 文件列表 */}
      <div className={`file-list ${viewMode}`}>
        {loading && files.length === 0 ? (
          <div className="loading-state">加载中...</div>
        ) : filteredAndSortedFiles.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>暂无文件</p>
          </div>
        ) : viewMode === 'grid' ? (
          // 网格视图
          <div className="file-grid">
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className={`file-card ${
                  selectedFiles.has(file.id) ? 'selected' : ''
                }`}
                onClick={() => onFileSelect?.(file)}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.id)}
                  onChange={() => handleFileSelect(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="file-checkbox"
                />

                <div className="file-icon-large">
                  {FILE_TYPE_ICONS[file.file_type] || '📎'}
                </div>

                <div className="file-card-info">
                  <h4 className="file-card-name" title={file.original_name}>
                    {file.original_name}
                  </h4>
                  <p className="file-card-meta">
                    {formatFileSize(file.file_size)}
                  </p>
                  <p className="file-card-date">
                    {formatDate(file.created_at)}
                  </p>
                </div>

                <div className="file-card-actions">
                  <button
                    className="icon-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(
                        activeDropdown === file.id ? null : file.id
                      );
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeDropdown === file.id && (
                    <div className="dropdown-menu">
                      <button onClick={() => onFileSelect?.(file)}>
                        <Eye size={16} /> 预览
                      </button>
                      <button onClick={() => console.log('下载', file.id)}>
                        <Download size={16} /> 下载
                      </button>
                      <button onClick={() => console.log('复制', file.id)}>
                        <Copy size={16} /> 复制
                      </button>
                      {allowDelete && (
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="danger"
                        >
                          <Trash2 size={16} /> 删除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 列表视图
          <table className="file-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === filteredAndSortedFiles.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>名称</th>
                <th>类型</th>
                <th>大小</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedFiles.map((file) => (
                <tr
                  key={file.id}
                  className={selectedFiles.has(file.id) ? 'selected' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => handleFileSelect(file.id)}
                    />
                  </td>
                  <td className="file-name-cell">
                    <span className="file-icon-sm">
                      {FILE_TYPE_ICONS[file.file_type] || '📎'}
                    </span>
                    <span>{file.original_name}</span>
                  </td>
                  <td>{getFileTypeLabel(file.file_type)}</td>
                  <td>{formatFileSize(file.file_size)}</td>
                  <td>{formatDate(file.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn-sm"
                        onClick={() => onFileSelect?.(file)}
                        title="预览"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="icon-btn-sm"
                        onClick={() => console.log('下载', file.id)}
                        title="下载"
                      >
                        <Download size={16} />
                      </button>
                      {allowDelete && (
                        <button
                          className="icon-btn-sm danger"
                          onClick={() => handleDeleteFile(file.id)}
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FileManagerPanel;


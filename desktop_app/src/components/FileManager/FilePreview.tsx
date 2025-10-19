import React, { useState, useEffect } from 'react';
import { X, Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useFileDetail } from '../../hooks/useFileManager';
import { fileService } from '../../services/fileService';
import type { FileInfo } from '../../types/file';
import { formatFileSize } from '../../types/file';
import './FilePreview.css';

interface FilePreviewProps {
  fileId: string | null;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ fileId, onClose }) => {
  const { file, loading, error } = useFileDetail(fileId);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!file) return;

    const loadPreview = async () => {
      setLoadingContent(true);
      try {
        switch (file.file_type) {
          case 'image':
            const imageUrl = await fileService.getFileDataUrl(file.id);
            setPreviewContent(imageUrl);
            break;

          case 'text':
          case 'code':
            const textContent = await fileService.readFileContent(file.id);
            const decoder = new TextDecoder();
            setPreviewContent(decoder.decode(textContent));
            break;

          case 'pdf':
            // PDF 预览需要特殊处理，这里简化为显示下载链接
            setPreviewContent(null);
            break;

          default:
            setPreviewContent(null);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
        setPreviewContent(null);
      } finally {
        setLoadingContent(false);
      }
    };

    loadPreview();
  }, [file]);

  const handleDownload = async () => {
    if (!file) return;
    try {
      await fileService.downloadFile(file.id);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  if (!fileId) return null;

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="preview-header">
          <div className="preview-title">
            {file ? (
              <>
                <h3>{file.original_name}</h3>
                <span className="preview-meta">
                  {formatFileSize(file.file_size)} • {file.file_type}
                </span>
              </>
            ) : (
              <h3>加载中...</h3>
            )}
          </div>

          <div className="preview-actions">
            {file && file.file_type === 'image' && (
              <>
                <button
                  className="icon-btn"
                  onClick={handleZoomOut}
                  title="缩小"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="zoom-level">{zoom}%</span>
                <button
                  className="icon-btn"
                  onClick={handleZoomIn}
                  title="放大"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={handleResetZoom}
                  title="重置"
                >
                  <Maximize2 size={18} />
                </button>
              </>
            )}
            <button className="icon-btn" onClick={handleDownload} title="下载">
              <Download size={18} />
            </button>
            <button className="icon-btn" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="preview-content">
          {loading || loadingContent ? (
            <div className="preview-loading">加载中...</div>
          ) : error ? (
            <div className="preview-error">加载失败: {error}</div>
          ) : file ? (
            <PreviewContent
              file={file}
              content={previewContent}
              zoom={zoom}
            />
          ) : null}
        </div>

        {/* 底部信息 */}
        {file && (
          <div className="preview-footer">
            <div className="preview-info">
              <div className="info-item">
                <span className="info-label">创建时间:</span>
                <span className="info-value">
                  {new Date(file.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              {file.tags && (
                <div className="info-item">
                  <span className="info-label">标签:</span>
                  <span className="info-value">{file.tags}</span>
                </div>
              )}
              {file.description && (
                <div className="info-item">
                  <span className="info-label">描述:</span>
                  <span className="info-value">{file.description}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PreviewContentProps {
  file: FileInfo;
  content: string | null;
  zoom: number;
}

const PreviewContent: React.FC<PreviewContentProps> = ({
  file,
  content,
  zoom,
}) => {
  switch (file.file_type) {
    case 'image':
      return content ? (
        <div className="image-preview">
          <img
            src={content}
            alt={file.original_name}
            style={{ transform: `scale(${zoom / 100})` }}
          />
        </div>
      ) : (
        <div className="preview-unsupported">无法预览图片</div>
      );

    case 'text':
    case 'code':
      return content ? (
        <div className="text-preview">
          <pre>
            <code>{content}</code>
          </pre>
        </div>
      ) : (
        <div className="preview-unsupported">无法预览文本</div>
      );

    case 'video':
      return (
        <div className="video-preview">
          <video controls>
            <source src={`file://${file.file_path}`} type={file.mime_type} />
            您的浏览器不支持视频播放
          </video>
        </div>
      );

    case 'audio':
      return (
        <div className="audio-preview">
          <audio controls>
            <source src={`file://${file.file_path}`} type={file.mime_type} />
            您的浏览器不支持音频播放
          </audio>
        </div>
      );

    case 'pdf':
      return (
        <div className="preview-unsupported">
          <p>PDF 预览功能开发中</p>
          <p>请下载文件查看</p>
        </div>
      );

    default:
      return (
        <div className="preview-unsupported">
          <p>不支持预览此文件类型</p>
          <p>请下载文件查看</p>
        </div>
      );
  }
};

export default FilePreview;


/**
 * 消息导出组件
 * 
 * 功能：
 * - 导出为 Markdown
 * - 导出为 HTML
 * - 导出为 PDF
 * - 导出为纯文本
 * - 自定义导出范围（全部/选中/日期范围）
 * - 导出设置（包含时间戳、用户名等）
 */

import React, { useState, useCallback } from 'react'
import { 
  Download, 
  FileText, 
  FileCode, 
  File,
  Calendar,
  Settings,
  X,
  Check
} from 'lucide-react'
import clsx from 'clsx'
import styles from './MessageExport.module.css'

// ==================== 类型定义 ====================

export interface Message {
  id: string
  content: string
  sender: string
  timestamp: number
  [key: string]: any
}

export interface ExportOptions {
  /** 导出格式 */
  format: 'markdown' | 'html' | 'pdf' | 'text'
  /** 导出范围 */
  range: 'all' | 'selected' | 'dateRange'
  /** 开始日期（范围导出时） */
  startDate?: Date
  /** 结束日期（范围导出时） */
  endDate?: Date
  /** 选中的消息 ID（选中导出时） */
  selectedIds?: string[]
  /** 是否包含时间戳 */
  includeTimestamp: boolean
  /** 是否包含发送者 */
  includeSender: boolean
  /** 是否包含元数据 */
  includeMetadata: boolean
  /** 文件名 */
  filename?: string
}

export interface MessageExportProps {
  /** 所有消息 */
  messages: Message[]
  /** 选中的消息 ID */
  selectedMessageIds?: string[]
  /** 导出完成回调 */
  onExportComplete?: (success: boolean, error?: Error) => void
  /** 自定义类名 */
  className?: string
  /** 是否显示 */
  visible?: boolean
  /** 关闭回调 */
  onClose?: () => void
}

// ==================== 工具函数 ====================

/**
 * 格式化日期时间
 */
const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 导出为 Markdown
 */
const exportToMarkdown = (messages: Message[], options: ExportOptions): string => {
  let markdown = '# 聊天记录\n\n'
  
  if (options.includeMetadata) {
    markdown += `> 导出时间: ${formatDateTime(Date.now())}\n`
    markdown += `> 消息数量: ${messages.length}\n\n`
  }

  markdown += '---\n\n'

  messages.forEach((message, index) => {
    if (options.includeSender) {
      markdown += `## ${message.sender}\n\n`
    }

    if (options.includeTimestamp) {
      markdown += `*${formatDateTime(message.timestamp)}*\n\n`
    }

    markdown += `${message.content}\n\n`

    if (index < messages.length - 1) {
      markdown += '---\n\n'
    }
  })

  return markdown
}

/**
 * 导出为 HTML
 */
const exportToHTML = (messages: Message[], options: ExportOptions): string => {
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>聊天记录</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
      background: #f9fafb;
    }
    h1 {
      color: #111827;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
    }
    .metadata {
      background: #eff6ff;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      color: #1e40af;
      font-size: 14px;
    }
    .message {
      background: #fff;
      padding: 20px;
      margin: 20px 0;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .sender {
      font-weight: 600;
      color: #111827;
      font-size: 16px;
    }
    .timestamp {
      color: #6b7280;
      font-size: 13px;
    }
    .content {
      color: #374151;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
  </style>
</head>
<body>
  <h1>💬 聊天记录</h1>
`

  if (options.includeMetadata) {
    html += `
  <div class="metadata">
    <div><strong>导出时间:</strong> ${formatDateTime(Date.now())}</div>
    <div><strong>消息数量:</strong> ${messages.length}</div>
  </div>
`
  }

  messages.forEach(message => {
    html += `
  <div class="message">
`
    if (options.includeSender || options.includeTimestamp) {
      html += `    <div class="message-header">\n`
      
      if (options.includeSender) {
        html += `      <div class="sender">${escapeHtml(message.sender)}</div>\n`
      }
      
      if (options.includeTimestamp) {
        html += `      <div class="timestamp">${formatDateTime(message.timestamp)}</div>\n`
      }
      
      html += `    </div>\n`
    }

    html += `    <div class="content">${escapeHtml(message.content)}</div>
  </div>
`
  })

  html += `
</body>
</html>`

  return html
}

/**
 * 导出为纯文本
 */
const exportToText = (messages: Message[], options: ExportOptions): string => {
  let text = '========================================\n'
  text += '           聊天记录\n'
  text += '========================================\n\n'

  if (options.includeMetadata) {
    text += `导出时间: ${formatDateTime(Date.now())}\n`
    text += `消息数量: ${messages.length}\n\n`
  }

  text += '========================================\n\n'

  messages.forEach((message, index) => {
    if (options.includeSender) {
      text += `[${message.sender}]\n`
    }

    if (options.includeTimestamp) {
      text += `时间: ${formatDateTime(message.timestamp)}\n`
    }

    text += `\n${message.content}\n\n`

    if (index < messages.length - 1) {
      text += '----------------------------------------\n\n'
    }
  })

  return text
}

/**
 * 转义 HTML
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 下载文件
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 生成 PDF（使用浏览器打印功能）
 */
const exportToPDF = async (messages: Message[], options: ExportOptions) => {
  // 生成 HTML 内容
  const htmlContent = exportToHTML(messages, options)
  
  // 创建新窗口
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('无法打开打印窗口，请检查浏览器弹窗设置')
  }

  // 写入 HTML
  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // 等待加载完成后打印
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

// ==================== 主组件 ====================

export const MessageExport: React.FC<MessageExportProps> = ({
  messages,
  selectedMessageIds = [],
  onExportComplete,
  className,
  visible = true,
  onClose,
}) => {
  // ==================== 状态 ====================

  const [options, setOptions] = useState<ExportOptions>({
    format: 'markdown',
    range: 'all',
    includeTimestamp: true,
    includeSender: true,
    includeMetadata: true,
  })

  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  // ==================== 导出逻辑 ====================

  /**
   * 筛选要导出的消息
   */
  const getMessagesToExport = useCallback((): Message[] => {
    let filtered = messages

    // 按范围筛选
    if (options.range === 'selected' && options.selectedIds) {
      filtered = messages.filter(m => options.selectedIds!.includes(m.id))
    } else if (options.range === 'dateRange') {
      filtered = messages.filter(m => {
        if (options.startDate && m.timestamp < options.startDate.getTime()) return false
        if (options.endDate && m.timestamp > options.endDate.getTime()) return false
        return true
      })
    }

    return filtered
  }, [messages, options])

  /**
   * 执行导出
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportSuccess(false)

    try {
      const messagesToExport = getMessagesToExport()

      if (messagesToExport.length === 0) {
        throw new Error('没有可导出的消息')
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const defaultFilename = `chat_export_${timestamp}`

      switch (options.format) {
        case 'markdown':
          const markdown = exportToMarkdown(messagesToExport, options)
          downloadFile(
            markdown,
            options.filename || `${defaultFilename}.md`,
            'text/markdown'
          )
          break

        case 'html':
          const html = exportToHTML(messagesToExport, options)
          downloadFile(
            html,
            options.filename || `${defaultFilename}.html`,
            'text/html'
          )
          break

        case 'text':
          const text = exportToText(messagesToExport, options)
          downloadFile(
            text,
            options.filename || `${defaultFilename}.txt`,
            'text/plain'
          )
          break

        case 'pdf':
          await exportToPDF(messagesToExport, options)
          break
      }

      setExportSuccess(true)
      onExportComplete?.(true)

      // 2秒后关闭
      setTimeout(() => {
        onClose?.()
      }, 2000)
    } catch (error) {
      console.error('导出失败:', error)
      onExportComplete?.(false, error as Error)
    } finally {
      setIsExporting(false)
    }
  }, [options, getMessagesToExport, onExportComplete, onClose])

  // ==================== 渲染 ====================

  if (!visible) return null

  const messagesToExport = getMessagesToExport()
  const canExport = messagesToExport.length > 0

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Download size={20} />
          导出聊天记录
        </h2>
        {onClose && (
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {/* 导出格式 */}
        <div className={styles.section}>
          <label className={styles.label}>导出格式</label>
          <div className={styles.formatGrid}>
            <button
              onClick={() => setOptions(prev => ({ ...prev, format: 'markdown' }))}
              className={clsx(
                styles.formatButton,
                options.format === 'markdown' && styles.formatButtonActive
              )}
            >
              <FileCode size={24} />
              <span>Markdown</span>
              <span className={styles.formatDesc}>适合技术文档</span>
            </button>

            <button
              onClick={() => setOptions(prev => ({ ...prev, format: 'html' }))}
              className={clsx(
                styles.formatButton,
                options.format === 'html' && styles.formatButtonActive
              )}
            >
              <FileText size={24} />
              <span>HTML</span>
              <span className={styles.formatDesc}>适合网页查看</span>
            </button>

            <button
              onClick={() => setOptions(prev => ({ ...prev, format: 'text' }))}
              className={clsx(
                styles.formatButton,
                options.format === 'text' && styles.formatButtonActive
              )}
            >
              <File size={24} />
              <span>纯文本</span>
              <span className={styles.formatDesc}>简单易读</span>
            </button>

            <button
              onClick={() => setOptions(prev => ({ ...prev, format: 'pdf' }))}
              className={clsx(
                styles.formatButton,
                options.format === 'pdf' && styles.formatButtonActive
              )}
            >
              <FileText size={24} />
              <span>PDF</span>
              <span className={styles.formatDesc}>适合打印</span>
            </button>
          </div>
        </div>

        {/* 导出范围 */}
        <div className={styles.section}>
          <label className={styles.label}>导出范围</label>
          <div className={styles.rangeOptions}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                checked={options.range === 'all'}
                onChange={() => setOptions(prev => ({ ...prev, range: 'all' }))}
              />
              <span>全部消息 ({messages.length})</span>
            </label>

            {selectedMessageIds.length > 0 && (
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  checked={options.range === 'selected'}
                  onChange={() => setOptions(prev => ({
                    ...prev,
                    range: 'selected',
                    selectedIds: selectedMessageIds
                  }))}
                />
                <span>选中的消息 ({selectedMessageIds.length})</span>
              </label>
            )}

            <label className={styles.radioOption}>
              <input
                type="radio"
                checked={options.range === 'dateRange'}
                onChange={() => setOptions(prev => ({ ...prev, range: 'dateRange' }))}
              />
              <span>日期范围</span>
            </label>
          </div>

          {/* 日期范围选择 */}
          {options.range === 'dateRange' && (
            <div className={styles.dateRange}>
              <div className={styles.dateField}>
                <Calendar size={16} />
                <input
                  type="date"
                  value={options.startDate ? options.startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    startDate: e.target.value ? new Date(e.target.value) : undefined
                  }))}
                  className={styles.dateInput}
                  placeholder="开始日期"
                />
              </div>
              <span>至</span>
              <div className={styles.dateField}>
                <Calendar size={16} />
                <input
                  type="date"
                  value={options.endDate ? options.endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    endDate: e.target.value ? new Date(e.target.value) : undefined
                  }))}
                  className={styles.dateInput}
                  placeholder="结束日期"
                />
              </div>
            </div>
          )}
        </div>

        {/* 导出设置 */}
        <div className={styles.section}>
          <label className={styles.label}>
            <Settings size={16} />
            导出设置
          </label>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={options.includeTimestamp}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeTimestamp: e.target.checked
                }))}
              />
              <span>包含时间戳</span>
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={options.includeSender}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeSender: e.target.checked
                }))}
              />
              <span>包含发送者</span>
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={options.includeMetadata}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeMetadata: e.target.checked
                }))}
              />
              <span>包含元数据</span>
            </label>
          </div>
        </div>

        {/* 预览信息 */}
        <div className={styles.preview}>
          <div className={styles.previewItem}>
            <span>将导出消息:</span>
            <strong>{messagesToExport.length} 条</strong>
          </div>
          <div className={styles.previewItem}>
            <span>导出格式:</span>
            <strong>{options.format.toUpperCase()}</strong>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {exportSuccess && (
          <div className={styles.successMessage}>
            <Check size={16} />
            <span>导出成功!</span>
          </div>
        )}
        
        <button
          onClick={handleExport}
          disabled={!canExport || isExporting}
          className={clsx(styles.exportButton, exportSuccess && styles.exportButtonSuccess)}
        >
          {isExporting ? (
            <>
              <span className={styles.spinner} />
              <span>导出中...</span>
            </>
          ) : exportSuccess ? (
            <>
              <Check size={18} />
              <span>导出成功</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>开始导出</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default MessageExport


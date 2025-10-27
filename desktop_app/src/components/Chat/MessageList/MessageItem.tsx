/**
 * 消息项组件
 * 
 * 用于渲染单个聊天消息，支持：
 * - 不同角色的消息展示（用户/助手/系统）
 * - 消息状态展示（发送中/失败/编辑等）
 * - 流式响应实时更新
 * - 消息操作（复制/重发/编辑/删除/置顶/收藏）
 * - Markdown 渲染
 * - 代码高亮
 * - 动画效果
 * - 时间戳显示
 * - 错误处理
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  Copy,
  Check,
  RotateCw,
  Edit2,
  Trash2,
  Pin,
  Star,
  AlertCircle,
  Clock,
  MoreVertical,
  User,
  Bot,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { ChatMessage } from '@/types/chat'
import {
  MessageRole,
  MessageStatus,
  MessageType,
} from '@/types/chat'
import styles from './MessageItem.module.css'

// ==================== 类型定义 ====================

export interface MessageItemProps {
  /** 消息数据 */
  message: ChatMessage
  /** 是否为流式消息 */
  isStreaming?: boolean
  /** 是否显示头像 */
  showAvatar?: boolean
  /** 是否显示时间戳 */
  showTimestamp?: boolean
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
  /** 是否为最后一条消息 */
  isLastMessage?: boolean
  /** 自定义类名 */
  className?: string
  /** 复制回调 */
  onCopy?: (content: string) => void
  /** 重发回调 */
  onResend?: (messageId: string) => void
  /** 编辑回调 */
  onEdit?: (messageId: string, content: string) => void
  /** 删除回调 */
  onDelete?: (messageId: string) => void
  /** 重新生成回调 */
  onRegenerate?: (messageId: string) => void
  /** 置顶/取消置顶回调 */
  onTogglePin?: (messageId: string) => void
  /** 收藏/取消收藏回调 */
  onToggleStar?: (messageId: string) => void
}

// ==================== 辅助函数 ====================

/**
 * 获取角色显示名称
 */
const getRoleName = (role: MessageRole): string => {
  const roleMap: Record<MessageRole, string> = {
    [MessageRole.USER]: '你',
    [MessageRole.ASSISTANT]: '紫舒老师',
    [MessageRole.SYSTEM]: '系统',
    [MessageRole.FUNCTION]: '函数',
    [MessageRole.TOOL]: '工具',
  }
  return roleMap[role] || role
}

/**
 * 获取角色图标
 */
const getRoleIcon = (role: MessageRole) => {
  const iconProps = { size: 16, strokeWidth: 2 }
  switch (role) {
    case MessageRole.USER:
      return <User {...iconProps} />
    case MessageRole.ASSISTANT:
      return <Bot {...iconProps} />
    case MessageRole.SYSTEM:
    default:
      return <Settings {...iconProps} />
  }
}

/**
 * 获取消息状态文本
 */
const getStatusText = (status: MessageStatus): string => {
  const statusMap: Record<MessageStatus, string> = {
    [MessageStatus.PENDING]: '等待发送',
    [MessageStatus.SENDING]: '发送中',
    [MessageStatus.SENT]: '已发送',
    [MessageStatus.RECEIVING]: '接收中',
    [MessageStatus.RECEIVED]: '已接收',
    [MessageStatus.FAILED]: '发送失败',
    [MessageStatus.CANCELLED]: '已取消',
    [MessageStatus.EDITED]: '已编辑',
    [MessageStatus.DELETED]: '已删除',
  }
  return statusMap[status] || status
}

/**
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return format(date, 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

/**
 * 简单的 Markdown 渲染（基础版本）
 */
const renderMarkdown = (content: string): string => {
  return content
    // 代码块
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 换行
    .replace(/\n/g, '<br>')
}

/**
 * 复制文本到剪贴板
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        return true
      } finally {
        document.body.removeChild(textArea)
      }
    }
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}

// ==================== 主组件 ====================

export const MessageItem: React.FC<MessageItemProps> = memo(({
  message,
  isStreaming = false,
  showAvatar = true,
  showTimestamp = true,
  showActions = true,
  compact = false,
  isLastMessage = false,
  className,
  onCopy,
  onResend,
  onEdit,
  onDelete,
  onRegenerate,
  onTogglePin,
  onToggleStar,
}) => {
  // ==================== 状态管理 ====================
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 提取消息内容
  const messageContent = typeof message.content === 'string'
    ? message.content
    : message.content.text || ''

  // 是否为用户消息
  const isUser = message.role === MessageRole.USER
  // 是否为系统消息
  const isSystem = message.role === MessageRole.SYSTEM
  // 是否为错误消息
  const isError = message.type === MessageType.ERROR || message.status === MessageStatus.FAILED

  // ==================== 副作用 ====================

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // 编辑时自动聚焦
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length
      )
    }
  }, [isEditing])

  // 复制成功后重置状态
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  // ==================== 事件处理 ====================

  /** 处理复制 */
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(messageContent)
    if (success) {
      setCopied(true)
      onCopy?.(messageContent)
    }
  }, [messageContent, onCopy])

  /** 处理重发 */
  const handleResend = useCallback(() => {
    onResend?.(message.id)
    setShowMenu(false)
  }, [message.id, onResend])

  /** 开始编辑 */
  const handleStartEdit = useCallback(() => {
    setEditContent(messageContent)
    setIsEditing(true)
    setShowMenu(false)
  }, [messageContent])

  /** 取消编辑 */
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent('')
  }, [])

  /** 保存编辑 */
  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && editContent !== messageContent) {
      onEdit?.(message.id, editContent.trim())
    }
    setIsEditing(false)
    setEditContent('')
  }, [editContent, messageContent, message.id, onEdit])

  /** 处理删除 */
  const handleDelete = useCallback(() => {
    if (window.confirm('确定要删除这条消息吗？')) {
      onDelete?.(message.id)
    }
    setShowMenu(false)
  }, [message.id, onDelete])

  /** 处理重新生成 */
  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message.id)
    setShowMenu(false)
  }, [message.id, onRegenerate])

  /** 处理置顶/取消置顶 */
  const handleTogglePin = useCallback(() => {
    onTogglePin?.(message.id)
    setShowMenu(false)
  }, [message.id, onTogglePin])

  /** 处理收藏/取消收藏 */
  const handleToggleStar = useCallback(() => {
    onToggleStar?.(message.id)
    setShowMenu(false)
  }, [message.id, onToggleStar])

  /** 切换展开/折叠 */
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // ==================== 渲染函数 ====================

  /** 渲染消息头部 */
  const renderHeader = () => {
    if (compact && !isSystem) return null

    return (
      <div className={styles.messageHeader}>
        {/* 头像 */}
        {showAvatar && (
          <div
            className={clsx(
              styles.avatar,
              isUser && styles.avatarUser,
              !isUser && !isSystem && styles.avatarAssistant,
              isSystem && styles.avatarSystem
            )}
          >
            {getRoleIcon(message.role)}
          </div>
        )}

        {/* 角色名和时间 */}
        <div className={styles.headerInfo}>
          <span className={styles.roleName}>
            {getRoleName(message.role)}
          </span>
          {showTimestamp && (
            <span className={styles.timestamp}>
              {formatTimestamp(message.timestamp)}
            </span>
          )}
          {message.metadata?.edited && (
            <span className={styles.editedTag}>已编辑</span>
          )}
        </div>

        {/* 状态标签 */}
        {(isStreaming || message.status === MessageStatus.SENDING || message.status === MessageStatus.RECEIVING) && (
          <div className={styles.statusBadge}>
            <div className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>{getStatusText(message.status)}</span>
          </div>
        )}

        {/* 置顶/收藏标记 */}
        <div className={styles.badges}>
          {message.pinned && (
            <Pin size={14} className={styles.pinnedIcon} />
          )}
          {message.starred && (
            <Star size={14} className={styles.starredIcon} fill="currentColor" />
          )}
        </div>
      </div>
    )
  }

  /** 渲染消息内容 */
  const renderContent = () => {
    if (isEditing) {
      return (
        <div className={styles.editContainer}>
          <textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={styles.editTextarea}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSaveEdit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                handleCancelEdit()
              }
            }}
          />
          <div className={styles.editActions}>
            <button
              onClick={handleCancelEdit}
              className={clsx(styles.editButton, styles.editButtonCancel)}
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className={clsx(styles.editButton, styles.editButtonSave)}
              disabled={!editContent.trim() || editContent === messageContent}
            >
              保存 (Ctrl+Enter)
            </button>
          </div>
        </div>
      )
    }

    // 折叠状态
    if (!isExpanded) {
      return (
        <div className={styles.collapsedContent} onClick={handleToggleExpand}>
          <span>消息已折叠</span>
          <ChevronDown size={16} />
        </div>
      )
    }

    // 错误消息
    if (isError) {
      return (
        <div className={styles.errorContent}>
          <AlertCircle size={16} />
          <span>{messageContent}</span>
          {message.metadata?.error && (
            <details className={styles.errorDetails}>
              <summary>详细信息</summary>
              <pre>{JSON.stringify(message.metadata.error, null, 2)}</pre>
            </details>
          )}
        </div>
      )
    }

    // 代码类型消息
    if (message.type === MessageType.CODE && typeof message.content !== 'string') {
      const codeContent = message.content.code
      if (codeContent) {
        return (
          <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span>{codeContent.language || 'code'}</span>
              <button onClick={handleCopy} className={styles.copyButton}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <pre>
              <code className={`language-${codeContent.language || 'text'}`}>
                {codeContent.content}
              </code>
            </pre>
          </div>
        )
      }
    }

    // 普通文本消息（支持简单的 Markdown）
    return (
      <div
        className={styles.messageContent}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(messageContent) }}
      />
    )
  }

  /** 渲染底部信息 */
  const renderFooter = () => {
    if (compact) return null

    const { metadata } = message
    if (!metadata) return null

    const hasFooterInfo =
      metadata.processingTime ||
      metadata.tokenUsage ||
      metadata.model ||
      metadata.emotion

    if (!hasFooterInfo) return null

    return (
      <div className={styles.messageFooter}>
        {metadata.processingTime && (
          <span className={styles.footerItem}>
            <Clock size={12} />
            {(metadata.processingTime / 1000).toFixed(2)}s
          </span>
        )}
        {metadata.tokenUsage && (
          <span className={styles.footerItem}>
            📊 {metadata.tokenUsage.total} tokens
          </span>
        )}
        {metadata.model && (
          <span className={styles.footerItem}>
            🤖 {metadata.model}
          </span>
        )}
        {metadata.emotion && (
          <span className={styles.footerItem}>
            💭 {metadata.emotion}
          </span>
        )}
      </div>
    )
  }

  /** 渲染操作按钮 */
  const renderActions = () => {
    if (!showActions || isEditing) return null
    if (!isHovered && !showMenu) return null

    return (
      <div className={styles.messageActions}>
        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className={styles.actionButton}
          title="复制"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>

        {/* 折叠/展开按钮 */}
        {messageContent.length > 200 && (
          <button
            onClick={handleToggleExpand}
            className={styles.actionButton}
            title={isExpanded ? '折叠' : '展开'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}

        {/* 更多操作菜单 */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={styles.actionButton}
            title="更多操作"
          >
            <MoreVertical size={16} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                  styles.menuDropdown,
                  isUser && styles.menuDropdownRight
                )}
              >
                {/* 用户消息可以编辑和重发 */}
                {isUser && onEdit && (
                  <button onClick={handleStartEdit} className={styles.menuItem}>
                    <Edit2 size={14} />
                    <span>编辑</span>
                  </button>
                )}
                {isUser && onResend && (
                  <button onClick={handleResend} className={styles.menuItem}>
                    <RotateCw size={14} />
                    <span>重新发送</span>
                  </button>
                )}

                {/* 助手消息可以重新生成 */}
                {!isUser && !isSystem && onRegenerate && (
                  <button onClick={handleRegenerate} className={styles.menuItem}>
                    <RotateCw size={14} />
                    <span>重新生成</span>
                  </button>
                )}

                {/* 置顶 */}
                {onTogglePin && (
                  <button onClick={handleTogglePin} className={styles.menuItem}>
                    <Pin size={14} />
                    <span>{message.pinned ? '取消置顶' : '置顶'}</span>
                  </button>
                )}

                {/* 收藏 */}
                {onToggleStar && (
                  <button onClick={handleToggleStar} className={styles.menuItem}>
                    <Star size={14} />
                    <span>{message.starred ? '取消收藏' : '收藏'}</span>
                  </button>
                )}

                {/* 分隔线 */}
                <div className={styles.menuDivider} />

                {/* 删除 */}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className={clsx(styles.menuItem, styles.menuItemDanger)}
                  >
                    <Trash2 size={14} />
                    <span>删除</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  // ==================== 主渲染 ====================

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        styles.messageItem,
        isUser && styles.messageItemUser,
        !isUser && !isSystem && styles.messageItemAssistant,
        isSystem && styles.messageItemSystem,
        isError && styles.messageItemError,
        compact && styles.messageItemCompact,
        isLastMessage && styles.messageItemLast,
        message.pinned && styles.messageItemPinned,
        message.starred && styles.messageItemStarred,
        isStreaming && styles.messageItemStreaming,
        className
      )}
    >
      <div className={styles.messageInner}>
        {renderHeader()}
        <div className={styles.messageBody}>
          {renderContent()}
          {renderFooter()}
        </div>
        {renderActions()}
      </div>
    </motion.div>
  )
})

MessageItem.displayName = 'MessageItem'

export default MessageItem


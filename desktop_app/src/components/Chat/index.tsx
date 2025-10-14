/**
 * 聊天组件
 * 
 * 主聊天界面组件，整合消息列表和输入框，提供完整的聊天功能：
 * - 消息发送和接收
 * - 流式响应支持
 * - 消息历史管理
 * - 会话管理
 * - 上下文维护
 * - 错误处理
 * - 加载状态
 * - 自动滚动
 * - 响应式布局
 */

import React, {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  Settings,
  MoreVertical,
  Archive,
  Trash2,
  Download,
} from 'lucide-react'
import type {
  ChatMessage,
  ChatSession,
  MessageRole,
  MessageStatus,
  MessageType,
  SessionConfig,
  StreamChunk,
} from '@/types/chat'
import MessageList from './MessageList'
import InputBox, { type Attachment, type Suggestion, type InputBoxRef } from './InputBox'
import styles from './Chat.module.css'

// ==================== 类型定义 ====================

export interface ChatProps {
  /** 当前会话 */
  session?: ChatSession
  /** 消息列表 */
  messages?: ChatMessage[]
  /** 是否正在加载 */
  isLoading?: boolean
  /** 是否正在发送 */
  isSending?: boolean
  /** 是否正在流式响应 */
  isStreaming?: boolean
  /** 错误信息 */
  error?: string | null
  /** 会话配置 */
  config?: SessionConfig
  /** 是否显示头像 */
  showAvatar?: boolean
  /** 是否显示时间戳 */
  showTimestamp?: boolean
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
  /** 是否显示会话信息 */
  showSessionInfo?: boolean
  /** 是否显示设置按钮 */
  showSettingsButton?: boolean
  /** 输入框占位符 */
  inputPlaceholder?: string
  /** 最大消息长度 */
  maxMessageLength?: number
  /** 是否启用附件 */
  enableAttachments?: boolean
  /** 是否启用表情 */
  enableEmoji?: boolean
  /** 是否启用语音 */
  enableVoice?: boolean
  /** 建议列表 */
  suggestions?: Suggestion[]
  /** 自定义类名 */
  className?: string
  /** 发送消息回调 */
  onSendMessage?: (message: string, attachments?: Attachment[]) => void
  /** 流式响应回调 */
  onStreamChunk?: (chunk: StreamChunk) => void
  /** 重新生成回调 */
  onRegenerate?: (messageId: string) => void
  /** 编辑消息回调 */
  onEditMessage?: (messageId: string, content: string) => void
  /** 删除消息回调 */
  onDeleteMessage?: (messageId: string) => void
  /** 重发消息回调 */
  onResendMessage?: (messageId: string) => void
  /** 置顶消息回调 */
  onTogglePin?: (messageId: string) => void
  /** 收藏消息回调 */
  onToggleStar?: (messageId: string) => void
  /** 复制消息回调 */
  onCopyMessage?: (content: string) => void
  /** 附件上传回调 */
  onAttachmentAdd?: (file: File) => Promise<Attachment>
  /** 附件移除回调 */
  onAttachmentRemove?: (attachmentId: string) => void
  /** 语音输入回调 */
  onVoiceStart?: () => void
  /** 建议选择回调 */
  onSuggestionSelect?: (suggestion: Suggestion) => void
  /** 设置按钮点击回调 */
  onSettingsClick?: () => void
  /** 会话归档回调 */
  onArchiveSession?: () => void
  /** 会话删除回调 */
  onDeleteSession?: () => void
  /** 导出会话回调 */
  onExportSession?: () => void
  /** 重试回调 */
  onRetry?: () => void
}

// ==================== 主组件 ====================

export const Chat: React.FC<ChatProps> = memo(({
  session,
  messages = [],
  isLoading = false,
  isSending = false,
  isStreaming = false,
  error = null,
  config,
  showAvatar = true,
  showTimestamp = true,
  showActions = true,
  compact = false,
  showSessionInfo = true,
  showSettingsButton = true,
  inputPlaceholder = '输入消息...',
  maxMessageLength = 10000,
  enableAttachments = true,
  enableEmoji = true,
  enableVoice = true,
  suggestions = [],
  className,
  onSendMessage,
  onStreamChunk,
  onRegenerate,
  onEditMessage,
  onDeleteMessage,
  onResendMessage,
  onTogglePin,
  onToggleStar,
  onCopyMessage,
  onAttachmentAdd,
  onAttachmentRemove,
  onVoiceStart,
  onSuggestionSelect,
  onSettingsClick,
  onArchiveSession,
  onDeleteSession,
  onExportSession,
  onRetry,
}) => {
  // ==================== Refs ====================
  const inputBoxRef = useRef<InputBoxRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ==================== 状态管理 ====================
  const [showMenu, setShowMenu] = useState(false)
  const [inputValue, setInputValue] = useState('')

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

  // 发送成功后清空输入框
  useEffect(() => {
    if (!isSending && inputBoxRef.current) {
      // 发送完成后可以做一些清理工作
    }
  }, [isSending])

  // ==================== 计算属性 ====================

  /** 是否有消息 */
  const hasMessages = messages.length > 0

  /** 是否可以发送 */
  const canSend = !isSending && !isStreaming && !isLoading

  /** 会话标题 */
  const sessionTitle = useMemo(() => {
    if (session?.title) return session.title
    if (hasMessages) {
      const firstUserMessage = messages.find(
        (m) => m.role === MessageRole.USER
      )
      if (firstUserMessage) {
        const content =
          typeof firstUserMessage.content === 'string'
            ? firstUserMessage.content
            : firstUserMessage.content.text || ''
        return content.length > 30 ? `${content.slice(0, 30)}...` : content
      }
    }
    return '新对话'
  }, [session, messages, hasMessages])

  /** 消息统计 */
  const messageStats = useMemo(() => {
    const userCount = messages.filter((m) => m.role === MessageRole.USER).length
    const assistantCount = messages.filter(
      (m) => m.role === MessageRole.ASSISTANT
    ).length
    const totalTokens = messages.reduce(
      (sum, m) => sum + (m.metadata?.tokenUsage?.total || 0),
      0
    )
    return { userCount, assistantCount, totalTokens }
  }, [messages])

  // ==================== 事件处理 ====================

  /** 处理发送消息 */
  const handleSendMessage = useCallback(
    (message: string, attachments?: Attachment[]) => {
      if (!canSend) return
      onSendMessage?.(message, attachments)
      setInputValue('')
    },
    [canSend, onSendMessage]
  )

  /** 处理输入变化 */
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
  }, [])

  /** 处理重试 */
  const handleRetry = useCallback(() => {
    onRetry?.()
  }, [onRetry])

  /** 处理归档 */
  const handleArchive = useCallback(() => {
    if (window.confirm('确定要归档这个会话吗？')) {
      onArchiveSession?.()
      setShowMenu(false)
    }
  }, [onArchiveSession])

  /** 处理删除会话 */
  const handleDeleteSession = useCallback(() => {
    if (window.confirm('确定要删除这个会话吗？此操作不可恢复。')) {
      onDeleteSession?.()
      setShowMenu(false)
    }
  }, [onDeleteSession])

  /** 处理导出 */
  const handleExport = useCallback(() => {
    onExportSession?.()
    setShowMenu(false)
  }, [onExportSession])

  // ==================== 渲染函数 ====================

  /** 渲染会话头部 */
  const renderHeader = () => {
    if (!showSessionInfo) return null

    return (
      <div className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.sessionTitle}>{sessionTitle}</h2>
          {hasMessages && (
            <div className={styles.sessionStats}>
              <span>{messageStats.userCount} 条提问</span>
              <span>·</span>
              <span>{messageStats.assistantCount} 条回复</span>
              {messageStats.totalTokens > 0 && (
                <>
                  <span>·</span>
                  <span>{messageStats.totalTokens} tokens</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          {/* 设置按钮 */}
          {showSettingsButton && onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className={styles.headerButton}
              title="设置"
            >
              <Settings size={18} />
            </button>
          )}

          {/* 更多菜单 */}
          <div className={styles.menuContainer} ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={styles.headerButton}
              title="更多操作"
            >
              <MoreVertical size={18} />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className={styles.menuDropdown}
                >
                  {onArchiveSession && (
                    <button onClick={handleArchive} className={styles.menuItem}>
                      <Archive size={16} />
                      <span>归档会话</span>
                    </button>
                  )}
                  {onExportSession && (
                    <button onClick={handleExport} className={styles.menuItem}>
                      <Download size={16} />
                      <span>导出会话</span>
                    </button>
                  )}
                  {(onArchiveSession || onExportSession) && onDeleteSession && (
                    <div className={styles.menuDivider} />
                  )}
                  {onDeleteSession && (
                    <button
                      onClick={handleDeleteSession}
                      className={clsx(styles.menuItem, styles.menuItemDanger)}
                    >
                      <Trash2 size={16} />
                      <span>删除会话</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    )
  }

  /** 渲染空状态 */
  const renderEmptyState = () => {
    if (hasMessages || isLoading) return null

    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>💬</div>
        <h3 className={styles.emptyTitle}>开始新对话</h3>
        <p className={styles.emptyDescription}>
          输入你的问题，紫舒老师会为你解答
        </p>
        {suggestions.length > 0 && (
          <div className={styles.emptySuggestions}>
            <p className={styles.emptySuggestionsTitle}>试试这些问题：</p>
            <div className={styles.emptySuggestionsList}>
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => {
                    setInputValue(suggestion.text)
                    inputBoxRef.current?.focus()
                  }}
                  className={styles.emptySuggestionItem}
                >
                  {suggestion.icon && (
                    <span className={styles.emptySuggestionIcon}>
                      {suggestion.icon}
                    </span>
                  )}
                  <span>{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  /** 渲染加载状态 */
  const renderLoadingState = () => {
    if (!isLoading || hasMessages) return null

    return (
      <div className={styles.loadingState}>
        <Loader2 size={32} className={styles.loadingIcon} />
        <p className={styles.loadingText}>加载中...</p>
      </div>
    )
  }

  /** 渲染错误状态 */
  const renderErrorState = () => {
    if (!error) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={styles.errorBanner}
      >
        <AlertCircle size={20} />
        <span className={styles.errorText}>{error}</span>
        {onRetry && (
          <button onClick={handleRetry} className={styles.retryButton}>
            <RefreshCw size={16} />
            <span>重试</span>
          </button>
        )}
      </motion.div>
    )
  }

  /** 渲染消息列表 */
  const renderMessages = () => {
    if (!hasMessages && !isLoading) return null

    return (
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        showAvatar={showAvatar}
        showTimestamp={showTimestamp}
        showActions={showActions}
        compact={compact}
        onCopy={onCopyMessage}
        onResend={onResendMessage}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onRegenerate={onRegenerate}
        onTogglePin={onTogglePin}
        onToggleStar={onToggleStar}
      />
    )
  }

  /** 渲染输入区域 */
  const renderInput = () => {
    return (
      <div className={styles.inputArea}>
        <InputBox
          ref={inputBoxRef}
          value={inputValue}
          onChange={handleInputChange}
          onSend={handleSendMessage}
          placeholder={inputPlaceholder}
          disabled={!canSend}
          isSending={isSending}
          isStreaming={isStreaming}
          maxLength={maxMessageLength}
          showAttachmentButton={enableAttachments}
          showEmojiButton={enableEmoji}
          showVoiceButton={enableVoice}
          showSuggestions={!hasMessages && suggestions.length > 0}
          suggestions={suggestions}
          onAttachmentAdd={onAttachmentAdd}
          onAttachmentRemove={onAttachmentRemove}
          onVoiceStart={onVoiceStart}
          onSuggestionSelect={onSuggestionSelect}
          autoFocus={!hasMessages}
        />
      </div>
    )
  }

  // ==================== 主渲染 ====================

  return (
    <div
      ref={containerRef}
      className={clsx(
        styles.chat,
        compact && styles.chatCompact,
        className
      )}
    >
      {/* 头部 */}
      {renderHeader()}

      {/* 错误提示 */}
      <AnimatePresence>{renderErrorState()}</AnimatePresence>

      {/* 内容区域 */}
      <div className={styles.chatContent}>
        {/* 空状态 */}
        {renderEmptyState()}

        {/* 加载状态 */}
        {renderLoadingState()}

        {/* 消息列表 */}
        {renderMessages()}
      </div>

      {/* 输入区域 */}
      {renderInput()}
    </div>
  )
})

Chat.displayName = 'Chat'

export default Chat


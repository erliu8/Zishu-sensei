/**
 * 消息列表组件
 * 
 * 用于渲染聊天消息列表，支持：
 * - 自动滚动到底部
 * - 新消息提示
 * - 虚拟滚动（可选，大量消息时）
 * - 加载历史消息
 * - 滚动到指定消息
 * - 消息分组（按日期）
 * - 空状态展示
 * - 加载状态展示
 * - 流式响应支持
 * - 响应式设计
 * - 无障碍支持
 */

import React, {
  memo,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  ArrowDown,
  Loader2,
  RefreshCw,
  MessageSquare,
  Calendar,
} from 'lucide-react'
import { format, isToday, isYesterday, differenceInDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { ChatMessage } from '@/types/chat'
import { MessageItem } from './MessageItem'
import styles from './MessageList.module.css'

// ==================== 类型定义 ====================

export interface MessageListProps {
  /** 消息列表 */
  messages: ChatMessage[]
  /** 是否正在加载 */
  isLoading?: boolean
  /** 是否正在发送消息 */
  isSending?: boolean
  /** 是否正在流式传输 */
  isStreaming?: boolean
  /** 流式消息的ID */
  streamingMessageId?: string | null
  /** 是否有更多历史消息 */
  hasMore?: boolean
  /** 是否正在加载历史 */
  isLoadingHistory?: boolean
  /** 是否显示日期分隔符 */
  showDateSeparator?: boolean
  /** 是否显示头像 */
  showAvatar?: boolean
  /** 是否显示时间戳 */
  showTimestamp?: boolean
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
  /** 是否启用虚拟滚动 */
  enableVirtualScroll?: boolean
  /** 虚拟滚动阈值（消息数量） */
  virtualScrollThreshold?: number
  /** 自动滚动到底部 */
  autoScrollToBottom?: boolean
  /** 空状态文本 */
  emptyText?: string
  /** 空状态描述 */
  emptyDescription?: string
  /** 自定义类名 */
  className?: string
  /** 加载更多历史回调 */
  onLoadMore?: () => void
  /** 消息复制回调 */
  onCopyMessage?: (content: string) => void
  /** 重发消息回调 */
  onResendMessage?: (messageId: string) => void
  /** 编辑消息回调 */
  onEditMessage?: (messageId: string, content: string) => void
  /** 删除消息回调 */
  onDeleteMessage?: (messageId: string) => void
  /** 重新生成回调 */
  onRegenerateMessage?: (messageId: string) => void
  /** 置顶/取消置顶回调 */
  onTogglePin?: (messageId: string) => void
  /** 收藏/取消收藏回调 */
  onToggleStar?: (messageId: string) => void
  /** 滚动到底部回调 */
  onScrollToBottom?: () => void
}

// ==================== 辅助函数 ====================

/**
 * 格式化日期分隔符
 */
const formatDateSeparator = (timestamp: number): string => {
  const date = new Date(timestamp)

  if (isToday(date)) {
    return '今天'
  }

  if (isYesterday(date)) {
    return '昨天'
  }

  const daysAgo = differenceInDays(new Date(), date)
  if (daysAgo < 7) {
    return format(date, 'EEEE', { locale: zhCN })
  }

  return format(date, 'yyyy年MM月dd日', { locale: zhCN })
}

/**
 * 按日期分组消息
 */
const groupMessagesByDate = (
  messages: ChatMessage[]
): Array<{ date: string; messages: ChatMessage[] }> => {
  const groups: Map<string, ChatMessage[]> = new Map()

  for (const message of messages) {
    const dateKey = format(new Date(message.timestamp), 'yyyy-MM-dd')
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(message)
  }

  return Array.from(groups.entries()).map(([date, msgs]) => ({
    date,
    messages: msgs,
  }))
}

/**
 * 检查是否滚动到底部
 */
const isScrolledToBottom = (element: HTMLElement, threshold = 50): boolean => {
  const { scrollTop, scrollHeight, clientHeight } = element
  return scrollHeight - scrollTop - clientHeight < threshold
}

// ==================== 主组件 ====================

export const MessageList: React.FC<MessageListProps> = memo(
  ({
    messages,
    isLoading = false,
    isSending = false,
    isStreaming = false,
    streamingMessageId = null,
    hasMore = false,
    isLoadingHistory = false,
    showDateSeparator = true,
    showAvatar = true,
    showTimestamp = true,
    showActions = true,
    compact = false,
    enableVirtualScroll = false,
    virtualScrollThreshold = 100,
    autoScrollToBottom = true,
    emptyText = '暂无消息',
    emptyDescription = '开始和紫舒老师聊天吧！',
    className,
    onLoadMore,
    onCopyMessage,
    onResendMessage,
    onEditMessage,
    onDeleteMessage,
    onRegenerateMessage,
    onTogglePin,
    onToggleStar,
    onScrollToBottom,
  }) => {
    // ==================== Refs ====================
    const containerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
    const isUserScrollingRef = useRef(false)
    const scrollTimeoutRef = useRef<NodeJS.Timeout>()

    // ==================== 状态管理 ====================
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [newMessageCount, setNewMessageCount] = useState(0)
    const [isNearBottom, setIsNearBottom] = useState(true)
    const prevMessagesLengthRef = useRef(messages.length)

    // ==================== 计算属性 ====================

    // 按日期分组的消息
    const groupedMessages = useMemo(() => {
      if (!showDateSeparator) {
        return [{ date: '', messages }]
      }
      return groupMessagesByDate(messages)
    }, [messages, showDateSeparator])

    // 是否为空状态
    const isEmpty = messages.length === 0 && !isLoading

    // 是否启用虚拟滚动
    const shouldUseVirtualScroll =
      enableVirtualScroll && messages.length > virtualScrollThreshold

    // ==================== 滚动相关 ====================

    /**
     * 滚动到底部
     */
    const scrollToBottom = useCallback(
      (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
          onScrollToBottom?.()
        }
      },
      [onScrollToBottom]
    )

    /**
     * 处理滚动事件
     */
    const handleScroll = useCallback(() => {
      const container = containerRef.current
      if (!container) return

      // 检查是否接近底部
      const nearBottom = isScrolledToBottom(container, 100)
      setIsNearBottom(nearBottom)

      // 显示/隐藏滚动按钮
      setShowScrollButton(!nearBottom && messages.length > 0)

      // 重置新消息计数
      if (nearBottom) {
        setNewMessageCount(0)
      }

      // 标记用户正在滚动
      isUserScrollingRef.current = true

      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // 延迟重置滚动状态
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 150)
    }, [messages.length])

    /**
     * 处理点击滚动按钮
     */
    const handleScrollButtonClick = useCallback(() => {
      scrollToBottom('smooth')
      setNewMessageCount(0)
    }, [scrollToBottom])

    // ==================== 加载更多 ====================

    /**
     * 设置加载更多的 Intersection Observer
     */
    useEffect(() => {
      if (!hasMore || !onLoadMore || !loadMoreTriggerRef.current) {
        return
      }

      const options = {
        root: containerRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      }

      observerRef.current = new IntersectionObserver((entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !isLoadingHistory) {
          onLoadMore()
        }
      }, options)

      observerRef.current.observe(loadMoreTriggerRef.current)

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    }, [hasMore, isLoadingHistory, onLoadMore])

    // ==================== 自动滚动 ====================

    /**
     * 新消息时自动滚动到底部
     */
    useEffect(() => {
      const messagesLength = messages.length
      const prevLength = prevMessagesLengthRef.current

      // 消息数量增加（新消息）
      if (messagesLength > prevLength) {
        const newMessagesCount = messagesLength - prevLength

        // 如果用户在底部或启用了自动滚动，则滚动到底部
        if (isNearBottom && autoScrollToBottom && !isUserScrollingRef.current) {
          // 短暂延迟以确保 DOM 更新完成
          setTimeout(() => scrollToBottom('smooth'), 100)
        } else {
          // 否则更新新消息计数
          setNewMessageCount((prev) => prev + newMessagesCount)
        }
      }

      prevMessagesLengthRef.current = messagesLength
    }, [messages.length, isNearBottom, autoScrollToBottom, scrollToBottom])

    /**
     * 流式消息更新时保持在底部
     */
    useEffect(() => {
      if (isStreaming && isNearBottom && !isUserScrollingRef.current) {
        scrollToBottom('auto')
      }
    }, [isStreaming, isNearBottom, scrollToBottom, messages])

    /**
     * 初始加载时滚动到底部
     */
    useEffect(() => {
      if (messages.length > 0 && autoScrollToBottom) {
        // 首次加载，直接滚动到底部
        setTimeout(() => scrollToBottom('auto'), 100)
      }
    }, []) // 仅首次加载

    // ==================== 清理 ====================

    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    }, [])

    // ==================== 渲染函数 ====================

    /**
     * 渲染空状态
     */
    const renderEmpty = () => (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.emptyState}
      >
        <MessageSquare size={48} className={styles.emptyIcon} />
        <h3 className={styles.emptyText}>{emptyText}</h3>
        {emptyDescription && (
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        )}
      </motion.div>
    )

    /**
     * 渲染加载状态
     */
    const renderLoading = () => (
      <div className={styles.loadingState}>
        <Loader2 size={24} className={styles.loadingSpinner} />
        <span className={styles.loadingText}>加载中...</span>
      </div>
    )

    /**
     * 渲染加载历史触发器
     */
    const renderLoadMoreTrigger = () => {
      if (!hasMore) return null

      return (
        <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger}>
          {isLoadingHistory ? (
            <div className={styles.loadingHistory}>
              <Loader2 size={16} className={styles.loadingSpinner} />
              <span>加载历史消息...</span>
            </div>
          ) : (
            <button onClick={onLoadMore} className={styles.loadMoreButton}>
              <RefreshCw size={16} />
              <span>加载更多</span>
            </button>
          )}
        </div>
      )
    }

    /**
     * 渲染日期分隔符
     */
    const renderDateSeparator = (timestamp: number) => (
      <div className={styles.dateSeparator}>
        <div className={styles.dateSeparatorLine} />
        <div className={styles.dateSeparatorText}>
          <Calendar size={14} />
          <span>{formatDateSeparator(timestamp)}</span>
        </div>
        <div className={styles.dateSeparatorLine} />
      </div>
    )

    /**
     * 渲染消息列表
     */
    const renderMessages = () => {
      if (shouldUseVirtualScroll) {
        // TODO: 实现虚拟滚动
        // 这里可以集成 react-window 或 react-virtual
        // 暂时回退到普通渲染
      }

      return (
        <AnimatePresence mode="popLayout">
          {groupedMessages.map((group, groupIndex) => (
            <React.Fragment key={group.date || groupIndex}>
              {/* 日期分隔符 */}
              {showDateSeparator && group.date && group.messages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={`separator-${group.date}`}
                >
                  {renderDateSeparator(group.messages[0].timestamp)}
                </motion.div>
              )}

              {/* 消息列表 */}
              {group.messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isStreaming={
                    isStreaming && message.id === streamingMessageId
                  }
                  showAvatar={showAvatar}
                  showTimestamp={showTimestamp}
                  showActions={showActions}
                  compact={compact}
                  isLastMessage={
                    groupIndex === groupedMessages.length - 1 &&
                    index === group.messages.length - 1
                  }
                  onCopy={onCopyMessage}
                  onResend={onResendMessage}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                  onRegenerate={onRegenerateMessage}
                  onTogglePin={onTogglePin}
                  onToggleStar={onToggleStar}
                />
              ))}
            </React.Fragment>
          ))}
        </AnimatePresence>
      )
    }

    /**
     * 渲染滚动到底部按钮
     */
    const renderScrollButton = () => {
      if (!showScrollButton) return null

      return (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={handleScrollButtonClick}
          className={styles.scrollButton}
          title="滚动到底部"
        >
          <ArrowDown size={20} />
          {newMessageCount > 0 && (
            <span className={styles.newMessageBadge}>{newMessageCount}</span>
          )}
        </motion.button>
      )
    }

    // ==================== 主渲染 ====================

    return (
      <div className={clsx(styles.messageList, className)}>
        <div
          ref={containerRef}
          className={styles.scrollContainer}
          onScroll={handleScroll}
        >
          {/* 加载历史触发器 */}
          {renderLoadMoreTrigger()}

          {/* 消息内容 */}
          <div className={styles.messagesContainer}>
            {isEmpty ? renderEmpty() : isLoading ? renderLoading() : renderMessages()}

            {/* 滚动锚点 */}
            <div ref={messagesEndRef} className={styles.messagesEnd} />
          </div>
        </div>

        {/* 滚动到底部按钮 */}
        <AnimatePresence>{renderScrollButton()}</AnimatePresence>
      </div>
    )
  }
)

MessageList.displayName = 'MessageList'

export default MessageList


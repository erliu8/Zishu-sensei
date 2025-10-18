/**
 * 消息引用/回复组件
 * 
 * 功能：
 * - 引用消息
 * - 回复消息
 * - 显示引用预览
 * - 跳转到被引用消息
 * - 取消引用
 */

import React, { useCallback } from 'react'
import { X, CornerDownRight, Quote } from 'lucide-react'
import clsx from 'clsx'
import styles from './MessageReply.module.css'

// ==================== 类型定义 ====================

export interface ReplyMessage {
  /** 消息 ID */
  id: string
  /** 消息内容 */
  content: string
  /** 发送者 */
  sender: string
  /** 时间戳 */
  timestamp: number
}

export interface MessageReplyProps {
  /** 被引用的消息 */
  replyTo?: ReplyMessage
  /** 取消引用回调 */
  onCancelReply?: () => void
  /** 跳转到消息回调 */
  onJumpToMessage?: (messageId: string) => void
  /** 自定义类名 */
  className?: string
  /** 紧凑模式 */
  compact?: boolean
  /** 是否可交互 */
  interactive?: boolean
}

// ==================== 工具函数 ====================

/**
 * 截断文本
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 格式化时间
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

// ==================== 主组件 ====================

export const MessageReply: React.FC<MessageReplyProps> = ({
  replyTo,
  onCancelReply,
  onJumpToMessage,
  className,
  compact = false,
  interactive = true,
}) => {
  // ==================== 事件处理 ====================

  const handleJump = useCallback(() => {
    if (replyTo && interactive && onJumpToMessage) {
      onJumpToMessage(replyTo.id)
    }
  }, [replyTo, interactive, onJumpToMessage])

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCancelReply?.()
  }, [onCancelReply])

  // ==================== 渲染 ====================

  if (!replyTo) return null

  return (
    <div
      className={clsx(
        styles.container,
        compact && styles.containerCompact,
        interactive && styles.containerInteractive,
        className
      )}
      onClick={interactive ? handleJump : undefined}
    >
      {/* 引用图标 */}
      <div className={styles.iconWrapper}>
        <CornerDownRight size={compact ? 14 : 16} className={styles.icon} />
      </div>

      {/* 引用内容 */}
      <div className={styles.content}>
        <div className={styles.header}>
          <Quote size={compact ? 12 : 14} className={styles.quoteIcon} />
          <span className={styles.sender}>{replyTo.sender}</span>
          {!compact && (
            <span className={styles.time}>{formatTime(replyTo.timestamp)}</span>
          )}
        </div>
        <div className={styles.text}>
          {truncateText(replyTo.content, compact ? 50 : 100)}
        </div>
      </div>

      {/* 取消按钮 */}
      {onCancelReply && (
        <button
          onClick={handleCancel}
          className={styles.cancelButton}
          title="取消引用"
        >
          <X size={compact ? 14 : 16} />
        </button>
      )}
    </div>
  )
}

export default MessageReply


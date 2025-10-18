/**
 * 消息反应（Emoji Reactions）组件
 * 
 * 功能：
 * - 添加 emoji 反应
 * - 移除反应
 * - 查看反应详情
 * - 常用 emoji 快捷选择
 * - 自定义 emoji 选择器
 * - 反应统计
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Smile, X, Plus } from 'lucide-react'
import clsx from 'clsx'
import styles from './MessageReactions.module.css'

// ==================== 类型定义 ====================

export interface Reaction {
  /** Emoji 表情 */
  emoji: string
  /** 反应用户列表 */
  users: string[]
  /** 反应数量 */
  count: number
}

export interface MessageReactionsProps {
  /** 消息 ID */
  messageId: string
  /** 反应列表 */
  reactions?: Reaction[]
  /** 当前用户名 */
  currentUser: string
  /** 添加反应回调 */
  onAddReaction?: (messageId: string, emoji: string, user: string) => void
  /** 移除反应回调 */
  onRemoveReaction?: (messageId: string, emoji: string, user: string) => void
  /** 自定义类名 */
  className?: string
  /** 紧凑模式 */
  compact?: boolean
  /** 最大显示反应数 */
  maxDisplay?: number
}

// ==================== 常用 Emoji ====================

const COMMON_EMOJIS = [
  '👍', '❤️', '😄', '😮', '😢', '🎉',
  '🔥', '👏', '✅', '❌', '⭐', '💯',
]

const EMOJI_CATEGORIES = {
  '表情': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘'],
  '手势': ['👍', '👎', '👏', '🙌', '👋', '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '☝️'],
  '符号': ['❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💯', '✅', '❌', '⭐', '✨', '💫', '🔥'],
  '庆祝': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎯', '🎪', '🎭', '🎨', '🎬', '🎤'],
}

// ==================== 主组件 ====================

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions = [],
  currentUser,
  onAddReaction,
  onRemoveReaction,
  className,
  compact = false,
  maxDisplay = 10,
}) => {
  // ==================== 状态 ====================

  const [showPicker, setShowPicker] = useState(false)
  const [showTooltip, setShowTooltip] = useState<string>()
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(EMOJI_CATEGORIES)[0])
  const pickerRef = useRef<HTMLDivElement>(null)

  // ==================== 事件处理 ====================

  /**
   * 切换反应
   */
  const handleToggleReaction = useCallback((emoji: string) => {
    const reaction = reactions.find(r => r.emoji === emoji)
    const hasReacted = reaction?.users.includes(currentUser)

    if (hasReacted) {
      onRemoveReaction?.(messageId, emoji, currentUser)
    } else {
      onAddReaction?.(messageId, emoji, currentUser)
    }
  }, [messageId, reactions, currentUser, onAddReaction, onRemoveReaction])

  /**
   * 添加新反应
   */
  const handleAddReaction = useCallback((emoji: string) => {
    handleToggleReaction(emoji)
    setShowPicker(false)
  }, [handleToggleReaction])

  /**
   * 点击外部关闭选择器
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  // ==================== 计算属性 ====================

  const sortedReactions = reactions
    .slice()
    .sort((a, b) => b.count - a.count)

  const displayedReactions = sortedReactions.slice(0, maxDisplay)
  const hiddenCount = sortedReactions.length - maxDisplay

  // ==================== 渲染 ====================

  if (reactions.length === 0 && !showPicker) {
    // 没有反应时显示添加按钮
    return (
      <div className={clsx(styles.container, className)}>
        <button
          onClick={() => setShowPicker(true)}
          className={clsx(styles.addButton, compact && styles.addButtonCompact)}
          title="添加反应"
        >
          <Smile size={compact ? 14 : 16} />
        </button>
      </div>
    )
  }

  return (
    <div className={clsx(styles.container, className)} ref={pickerRef}>
      {/* 反应列表 */}
      <div className={styles.reactionList}>
        {displayedReactions.map(reaction => {
          const hasReacted = reaction.users.includes(currentUser)
          
          return (
            <button
              key={reaction.emoji}
              onClick={() => handleToggleReaction(reaction.emoji)}
              onMouseEnter={() => setShowTooltip(reaction.emoji)}
              onMouseLeave={() => setShowTooltip(undefined)}
              className={clsx(
                styles.reactionButton,
                hasReacted && styles.reactionButtonActive,
                compact && styles.reactionButtonCompact
              )}
            >
              <span className={styles.emoji}>{reaction.emoji}</span>
              <span className={styles.count}>{reaction.count}</span>

              {/* 工具提示 */}
              {showTooltip === reaction.emoji && (
                <div className={styles.tooltip}>
                  {reaction.users.join(', ')}
                </div>
              )}
            </button>
          )
        })}

        {/* 隐藏的反应数 */}
        {hiddenCount > 0 && (
          <span className={styles.hiddenCount}>
            +{hiddenCount}
          </span>
        )}

        {/* 添加反应按钮 */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={clsx(
            styles.addButton,
            compact && styles.addButtonCompact,
            showPicker && styles.addButtonActive
          )}
          title="添加反应"
        >
          <Plus size={compact ? 12 : 14} />
        </button>
      </div>

      {/* Emoji 选择器 */}
      {showPicker && (
        <div className={styles.picker}>
          {/* 常用 Emoji */}
          <div className={styles.pickerSection}>
            <div className={styles.pickerTitle}>常用</div>
            <div className={styles.emojiGrid}>
              {COMMON_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleAddReaction(emoji)}
                  className={styles.emojiButton}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 分类标签 */}
          <div className={styles.categoryTabs}>
            {Object.keys(EMOJI_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={clsx(
                  styles.categoryTab,
                  selectedCategory === category && styles.categoryTabActive
                )}
              >
                {category}
              </button>
            ))}
          </div>

          {/* 分类 Emoji */}
          <div className={styles.pickerSection}>
            <div className={styles.emojiGrid}>
              {EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES]?.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleAddReaction(emoji)}
                  className={styles.emojiButton}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={() => setShowPicker(false)}
            className={styles.pickerCloseButton}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default MessageReactions


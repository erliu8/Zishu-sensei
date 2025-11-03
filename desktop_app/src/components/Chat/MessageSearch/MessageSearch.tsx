/**
 * 消息搜索组件
 * 
 * 功能：
 * - 全文搜索消息内容
 * - 高亮搜索关键词
 * - 搜索结果预览
 * - 快速跳转到消息
 * - 支持正则表达式
 * - 搜索历史记录
 * - 高级筛选（按时间、用户等）
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Calendar,
  User,
  Filter,
  History,
  Trash2
} from 'lucide-react'
import clsx from 'clsx'
import styles from './MessageSearch.module.css'

// ==================== 类型定义 ====================

export interface Message {
  id: string
  content: string
  sender: string
  timestamp: number
  [key: string]: any
}

export interface SearchResult {
  message: Message
  matchIndex: number
  matchText: string
  beforeText: string
  afterText: string
}

export interface MessageSearchProps {
  /** 所有消息 */
  messages: Message[]
  /** 当前激活的消息 ID */
  activeMessageId?: string
  /** 跳转到消息回调 */
  onJumpToMessage?: (messageId: string, matchIndex?: number) => void
  /** 自定义类名 */
  className?: string
  /** 是否显示 */
  visible?: boolean
  /** 关闭回调 */
  onClose?: () => void
  /** 最大搜索历史数 */
  maxHistory?: number
}

export interface SearchFilters {
  /** 搜索文本 */
  query: string
  /** 是否使用正则 */
  useRegex: boolean
  /** 是否区分大小写 */
  caseSensitive: boolean
  /** 开始日期 */
  startDate?: Date
  /** 结束日期 */
  endDate?: Date
  /** 按用户筛选 */
  sender?: string
}

// ==================== 工具函数 ====================

/**
 * 高亮文本
 */
// 注释掉未使用的函数
// const highlightText = (text: string, query: string, caseSensitive: boolean): string => {
//   if (!query) return text
//   const flags = caseSensitive ? 'g' : 'gi'
//   const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
//   return text.replace(regex, '<mark>$&</mark>')
// }

/**
 * 提取匹配上下文
 */
const extractContext = (
  text: string,
  query: string,
  contextLength: number = 50
): { beforeText: string; matchText: string; afterText: string } => {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) {
    return {
      beforeText: '',
      matchText: query,
      afterText: '',
    }
  }

  const matchEnd = index + query.length
  const beforeStart = Math.max(0, index - contextLength)
  const afterEnd = Math.min(text.length, matchEnd + contextLength)

  return {
    beforeText: (beforeStart > 0 ? '...' : '') + text.slice(beforeStart, index),
    matchText: text.slice(index, matchEnd),
    afterText: text.slice(matchEnd, afterEnd) + (afterEnd < text.length ? '...' : ''),
  }
}

/**
 * 格式化日期
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ==================== 主组件 ====================

export const MessageSearch: React.FC<MessageSearchProps> = ({
  messages,
  activeMessageId,
  onJumpToMessage,
  className,
  visible = true,
  onClose,
  maxHistory = 10,
}) => {
  // ==================== 状态 ====================

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    useRegex: false,
    caseSensitive: false,
  })

  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)

  // ==================== 搜索逻辑 ====================

  /**
   * 执行搜索
   */
  const searchResults = useMemo((): SearchResult[] => {
    if (!filters.query.trim()) return []

    const results: SearchResult[] = []
    const { query, useRegex, caseSensitive, startDate, endDate, sender } = filters

    try {
      const searchRegex = useRegex
        ? new RegExp(query, caseSensitive ? 'g' : 'gi')
        : new RegExp(
            query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            caseSensitive ? 'g' : 'gi'
          )

      for (const message of messages) {
        // 筛选时间范围
        if (startDate && message.timestamp < startDate.getTime()) continue
        if (endDate && message.timestamp > endDate.getTime()) continue

        // 筛选发送者
        if (sender && message.sender !== sender) continue

        // 搜索内容
        const matches = Array.from(message.content.matchAll(searchRegex))
        
        matches.forEach((match, index) => {
          const matchText = match[0]
          const context = extractContext(message.content, matchText)
          
          results.push({
            message,
            matchIndex: index,
            matchText,
            beforeText: context.beforeText,
            afterText: context.afterText,
          })
        })
      }
    } catch (error) {
      console.error('搜索错误:', error)
    }

    return results
  }, [messages, filters])

  /**
   * 跳转到结果
   */
  const jumpToResult = useCallback((index: number) => {
    if (searchResults.length === 0) return

    const result = searchResults[index]
    setCurrentResultIndex(index)
    onJumpToMessage?.(result.message.id, result.matchIndex)
  }, [searchResults, onJumpToMessage])

  /**
   * 上一个结果
   */
  const previousResult = useCallback(() => {
    const newIndex = currentResultIndex > 0
      ? currentResultIndex - 1
      : searchResults.length - 1
    jumpToResult(newIndex)
  }, [currentResultIndex, searchResults.length, jumpToResult])

  /**
   * 下一个结果
   */
  const nextResult = useCallback(() => {
    const newIndex = currentResultIndex < searchResults.length - 1
      ? currentResultIndex + 1
      : 0
    jumpToResult(newIndex)
  }, [currentResultIndex, searchResults.length, jumpToResult])

  /**
   * 更新搜索查询
   */
  const updateQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, query }))
    setCurrentResultIndex(0)

    // 添加到搜索历史
    if (query.trim() && !searchHistory.includes(query)) {
      setSearchHistory(prev => {
        const newHistory = [query, ...prev.filter(h => h !== query)]
        return newHistory.slice(0, maxHistory)
      })
    }
  }, [searchHistory, maxHistory])

  /**
   * 清空搜索
   */
  const clearSearch = useCallback(() => {
    setFilters({
      query: '',
      useRegex: false,
      caseSensitive: false,
    })
    setCurrentResultIndex(0)
    inputRef.current?.focus()
  }, [])

  /**
   * 清空搜索历史
   */
  const clearHistory = useCallback(() => {
    setSearchHistory([])
    setShowHistory(false)
  }, [])

  // ==================== 键盘快捷键 ====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return

      // Ctrl/Cmd + F: 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Enter: 下一个结果
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputRef.current) {
        e.preventDefault()
        nextResult()
      }

      // Shift + Enter: 上一个结果
      if (e.key === 'Enter' && e.shiftKey && document.activeElement === inputRef.current) {
        e.preventDefault()
        previousResult()
      }

      // Escape: 关闭搜索
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, nextResult, previousResult, onClose])

  // ==================== 渲染 ====================

  if (!visible) return null

  const senderOptions = useMemo(() => {
    const senders = new Set(messages.map(m => m.sender))
    return Array.from(senders)
  }, [messages])

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.searchBar}>
        {/* 搜索图标 */}
        <Search size={18} className={styles.searchIcon} />

        {/* 搜索输入 */}
        <input
          ref={inputRef}
          type="text"
          value={filters.query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => setShowHistory(searchHistory.length > 0)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          placeholder="搜索消息... (Ctrl+F)"
          className={styles.searchInput}
          autoFocus
        />

        {/* 搜索历史下拉 */}
        {showHistory && searchHistory.length > 0 && (
          <div className={styles.historyDropdown}>
            <div className={styles.historyHeader}>
              <History size={14} />
              <span>搜索历史</span>
              <button onClick={clearHistory} className={styles.clearHistoryButton}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className={styles.historyList}>
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    updateQuery(item)
                    setShowHistory(false)
                  }}
                  className={styles.historyItem}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 结果计数 */}
        {filters.query && (
          <div className={styles.resultCount}>
            {searchResults.length > 0
              ? `${currentResultIndex + 1} / ${searchResults.length}`
              : '0 结果'}
          </div>
        )}

        {/* 导航按钮 */}
        <div className={styles.navigation}>
          <button
            onClick={previousResult}
            disabled={searchResults.length === 0}
            className={styles.navButton}
            title="上一个 (Shift+Enter)"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={nextResult}
            disabled={searchResults.length === 0}
            className={styles.navButton}
            title="下一个 (Enter)"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* 筛选按钮 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(styles.filterButton, showFilters && styles.filterButtonActive)}
          title="高级筛选"
        >
          <Filter size={18} />
        </button>

        {/* 清除按钮 */}
        {filters.query && (
          <button onClick={clearSearch} className={styles.clearButton} title="清除">
            <X size={18} />
          </button>
        )}

        {/* 关闭按钮 */}
        {onClose && (
          <button onClick={onClose} className={styles.closeButton} title="关闭 (Esc)">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 高级筛选面板 */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.caseSensitive}
                onChange={(e) => setFilters(prev => ({ ...prev, caseSensitive: e.target.checked }))}
              />
              <span>区分大小写</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.useRegex}
                onChange={(e) => setFilters(prev => ({ ...prev, useRegex: e.target.checked }))}
              />
              <span>正则表达式</span>
            </label>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterField}>
              <Calendar size={14} />
              <input
                type="date"
                value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  startDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
                placeholder="开始日期"
                className={styles.dateInput}
              />
            </div>
            <div className={styles.filterField}>
              <Calendar size={14} />
              <input
                type="date"
                value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  endDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
                placeholder="结束日期"
                className={styles.dateInput}
              />
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterField}>
              <User size={14} />
              <select
                value={filters.sender || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  sender: e.target.value || undefined
                }))}
                className={styles.select}
              >
                <option value="">所有用户</option>
                {senderOptions.map(sender => (
                  <option key={sender} value={sender}>{sender}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 搜索结果列表 */}
      {searchResults.length > 0 && (
        <div className={styles.resultList}>
          {searchResults.map((result, index) => (
            <button
              key={`${result.message.id}-${result.matchIndex}`}
              onClick={() => jumpToResult(index)}
              className={clsx(
                styles.resultItem,
                index === currentResultIndex && styles.resultItemActive,
                result.message.id === activeMessageId && styles.resultItemCurrent
              )}
            >
              <div className={styles.resultHeader}>
                <span className={styles.resultSender}>{result.message.sender}</span>
                <span className={styles.resultTime}>
                  {formatDate(result.message.timestamp)}
                </span>
              </div>
              <div className={styles.resultContent}>
                <span className={styles.resultBefore}>{result.beforeText}</span>
                <mark className={styles.resultMatch}>{result.matchText}</mark>
                <span className={styles.resultAfter}>{result.afterText}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 无结果提示 */}
      {filters.query && searchResults.length === 0 && (
        <div className={styles.noResults}>
          <Search size={32} className={styles.noResultsIcon} />
          <p>未找到匹配的消息</p>
          <p className={styles.noResultsHint}>
            尝试使用不同的关键词或调整筛选条件
          </p>
        </div>
      )}
    </div>
  )
}

export default MessageSearch


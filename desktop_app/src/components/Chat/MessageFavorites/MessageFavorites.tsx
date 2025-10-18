/**
 * 消息收藏夹组件
 * 
 * 功能：
 * - 收藏消息
 * - 管理收藏夹
 * - 分类管理
 * - 搜索收藏
 * - 导出收藏
 * - 批量操作
 */

import React, { useState, useCallback, useMemo } from 'react'
import { 
  Star, 
  StarOff,
  Search, 
  Trash2, 
  FolderPlus,
  Tag,
  Calendar,
  X,
  MoreVertical,
  Edit2,
  Download
} from 'lucide-react'
import clsx from 'clsx'
import styles from './MessageFavorites.module.css'

// ==================== 类型定义 ====================

export interface FavoriteMessage {
  /** 消息 ID */
  id: string
  /** 消息内容 */
  content: string
  /** 发送者 */
  sender: string
  /** 时间戳 */
  timestamp: number
  /** 收藏时间 */
  favoriteTime: number
  /** 分类标签 */
  tags?: string[]
  /** 备注 */
  note?: string
}

export interface MessageFavoritesProps {
  /** 收藏的消息列表 */
  favorites: FavoriteMessage[]
  /** 收藏/取消收藏回调 */
  onToggleFavorite?: (messageId: string, isFavorite: boolean) => void
  /** 添加标签回调 */
  onAddTag?: (messageId: string, tag: string) => void
  /** 移除标签回调 */
  onRemoveTag?: (messageId: string, tag: string) => void
  /** 更新备注回调 */
  onUpdateNote?: (messageId: string, note: string) => void
  /** 删除收藏回调 */
  onDeleteFavorite?: (messageId: string) => void
  /** 跳转到消息回调 */
  onJumpToMessage?: (messageId: string) => void
  /** 批量导出回调 */
  onExportFavorites?: (messageIds: string[]) => void
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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 截断文本
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// ==================== 主组件 ====================

export const MessageFavorites: React.FC<MessageFavoritesProps> = ({
  favorites,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onUpdateNote,
  onDeleteFavorite,
  onJumpToMessage,
  onExportFavorites,
  className,
  visible = true,
  onClose,
}) => {
  // ==================== 状态 ====================

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<string>()
  const [noteValue, setNoteValue] = useState('')
  const [showMenu, setShowMenu] = useState<string>()

  // ==================== 计算属性 ====================

  /**
   * 所有标签
   */
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    favorites.forEach(fav => {
      fav.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [favorites])

  /**
   * 筛选后的收藏
   */
  const filteredFavorites = useMemo(() => {
    let filtered = favorites

    // 按搜索查询筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(fav =>
        fav.content.toLowerCase().includes(query) ||
        fav.sender.toLowerCase().includes(query) ||
        fav.note?.toLowerCase().includes(query)
      )
    }

    // 按标签筛选
    if (selectedTag) {
      filtered = filtered.filter(fav => fav.tags?.includes(selectedTag))
    }

    // 按收藏时间排序（最新的在前）
    return filtered.sort((a, b) => b.favoriteTime - a.favoriteTime)
  }, [favorites, searchQuery, selectedTag])

  // ==================== 事件处理 ====================

  /**
   * 切换选中
   */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredFavorites.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredFavorites.map(f => f.id)))
    }
  }, [selectedIds.size, filteredFavorites])

  /**
   * 批量删除
   */
  const handleBatchDelete = useCallback(() => {
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 条收藏吗？`)) {
      selectedIds.forEach(id => onDeleteFavorite?.(id))
      setSelectedIds(new Set())
    }
  }, [selectedIds, onDeleteFavorite])

  /**
   * 批量导出
   */
  const handleBatchExport = useCallback(() => {
    onExportFavorites?.(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [selectedIds, onExportFavorites])

  /**
   * 开始编辑备注
   */
  const startEditNote = useCallback((fav: FavoriteMessage) => {
    setEditingNoteId(fav.id)
    setNoteValue(fav.note || '')
  }, [])

  /**
   * 保存备注
   */
  const saveNote = useCallback(() => {
    if (editingNoteId) {
      onUpdateNote?.(editingNoteId, noteValue)
      setEditingNoteId(undefined)
      setNoteValue('')
    }
  }, [editingNoteId, noteValue, onUpdateNote])

  /**
   * 取消编辑备注
   */
  const cancelEditNote = useCallback(() => {
    setEditingNoteId(undefined)
    setNoteValue('')
  }, [])

  // ==================== 渲染 ====================

  if (!visible) return null

  const hasSelection = selectedIds.size > 0

  return (
    <div className={clsx(styles.container, className)}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Star size={20} className={styles.headerIcon} />
          <h2>收藏夹</h2>
          <span className={styles.count}>({favorites.length})</span>
        </div>
        {onClose && (
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* 工具栏 */}
      <div className={styles.toolbar}>
        {/* 搜索 */}
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索收藏..."
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={styles.clearButton}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 批量操作 */}
        {hasSelection && (
          <div className={styles.batchActions}>
            <span className={styles.selectionCount}>
              已选 {selectedIds.size} 条
            </span>
            <button onClick={handleBatchExport} className={styles.batchButton}>
              <Download size={16} />
              导出
            </button>
            <button onClick={handleBatchDelete} className={styles.batchButton}>
              <Trash2 size={16} />
              删除
            </button>
          </div>
        )}
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className={styles.tagFilter}>
          <button
            onClick={() => setSelectedTag(undefined)}
            className={clsx(
              styles.tagChip,
              !selectedTag && styles.tagChipActive
            )}
          >
            全部
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? undefined : tag)}
              className={clsx(
                styles.tagChip,
                selectedTag === tag && styles.tagChipActive
              )}
            >
              <Tag size={12} />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 收藏列表 */}
      <div className={styles.favoriteList}>
        {filteredFavorites.length === 0 ? (
          <div className={styles.emptyState}>
            <Star size={48} className={styles.emptyIcon} />
            <p>还没有收藏消息</p>
            <p className={styles.emptyHint}>
              点击消息旁的星标图标来收藏重要消息
            </p>
          </div>
        ) : (
          <>
            {/* 全选 */}
            {filteredFavorites.length > 0 && (
              <div className={styles.selectAllRow}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredFavorites.length}
                    onChange={toggleSelectAll}
                  />
                  <span>全选</span>
                </label>
              </div>
            )}

            {/* 收藏项 */}
            {filteredFavorites.map(fav => (
              <div
                key={fav.id}
                className={clsx(
                  styles.favoriteItem,
                  selectedIds.has(fav.id) && styles.favoriteItemSelected
                )}
              >
                {/* 选择框 */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(fav.id)}
                  onChange={() => toggleSelect(fav.id)}
                  className={styles.itemCheckbox}
                />

                {/* 内容 */}
                <div
                  className={styles.itemContent}
                  onClick={() => onJumpToMessage?.(fav.id)}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.itemSender}>{fav.sender}</span>
                    <div className={styles.itemMeta}>
                      <Calendar size={12} />
                      <span>{formatDateTime(fav.timestamp)}</span>
                    </div>
                  </div>

                  <div className={styles.itemText}>
                    {truncateText(fav.content, 200)}
                  </div>

                  {/* 标签 */}
                  {fav.tags && fav.tags.length > 0 && (
                    <div className={styles.itemTags}>
                      {fav.tags.map(tag => (
                        <span key={tag} className={styles.itemTag}>
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 备注 */}
                  {editingNoteId === fav.id ? (
                    <div className={styles.noteEditor}>
                      <input
                        type="text"
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNote()
                          if (e.key === 'Escape') cancelEditNote()
                        }}
                        placeholder="添加备注..."
                        className={styles.noteInput}
                        autoFocus
                      />
                      <button onClick={saveNote} className={styles.noteSaveButton}>
                        保存
                      </button>
                      <button onClick={cancelEditNote} className={styles.noteCancelButton}>
                        取消
                      </button>
                    </div>
                  ) : fav.note ? (
                    <div className={styles.itemNote}>
                      💡 {fav.note}
                    </div>
                  ) : null}
                </div>

                {/* 操作菜单 */}
                <div className={styles.itemActions}>
                  <button
                    onClick={() => setShowMenu(showMenu === fav.id ? undefined : fav.id)}
                    className={styles.menuButton}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {showMenu === fav.id && (
                    <div className={styles.menu}>
                      <button
                        onClick={() => {
                          startEditNote(fav)
                          setShowMenu(undefined)
                        }}
                        className={styles.menuItem}
                      >
                        <Edit2 size={14} />
                        编辑备注
                      </button>
                      <button
                        onClick={() => {
                          onToggleFavorite?.(fav.id, false)
                          setShowMenu(undefined)
                        }}
                        className={styles.menuItem}
                      >
                        <StarOff size={14} />
                        取消收藏
                      </button>
                      <button
                        onClick={() => {
                          onDeleteFavorite?.(fav.id)
                          setShowMenu(undefined)
                        }}
                        className={clsx(styles.menuItem, styles.menuItemDanger)}
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default MessageFavorites


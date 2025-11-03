/**
 * 快捷回复模板组件
 * 
 * 功能：
 * - 预设回复模板
 * - 自定义模板
 * - 模板分类
 * - 变量替换
 * - 快捷键触发
 * - 搜索模板
 */

import React, { useState, useCallback, useMemo } from 'react'
import { 
  Zap, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Hash,
  Copy,
  Check
} from 'lucide-react'
import clsx from 'clsx'
import styles from './QuickReplyTemplates.module.css'

// ==================== 类型定义 ====================

export interface QuickReplyTemplate {
  /** 模板 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板内容 */
  content: string
  /** 分类 */
  category?: string
  /** 快捷键（可选） */
  shortcut?: string
  /** 变量（例如: {name}, {time}） */
  variables?: string[]
  /** 使用次数 */
  useCount?: number
  /** 创建时间 */
  createdAt: number
}

export interface QuickReplyTemplatesProps {
  /** 模板列表 */
  templates: QuickReplyTemplate[]
  /** 使用模板回调 */
  onUseTemplate?: (template: QuickReplyTemplate) => void
  /** 添加模板回调 */
  onAddTemplate?: (template: Omit<QuickReplyTemplate, 'id' | 'createdAt' | 'useCount'>) => void
  /** 更新模板回调 */
  onUpdateTemplate?: (id: string, updates: Partial<QuickReplyTemplate>) => void
  /** 删除模板回调 */
  onDeleteTemplate?: (id: string) => void
  /** 自定义类名 */
  className?: string
  /** 是否显示 */
  visible?: boolean
  /** 关闭回调 */
  onClose?: () => void
}

// ==================== 预设模板 ====================

const DEFAULT_TEMPLATES: Omit<QuickReplyTemplate, 'id' | 'createdAt' | 'useCount'>[] = [
  {
    name: '问候',
    content: '你好！很高兴为您服务。',
    category: '常用',
    shortcut: '/hello',
  },
  {
    name: '感谢',
    content: '感谢您的反馈，我们会认真考虑您的建议。',
    category: '常用',
    shortcut: '/thanks',
  },
  {
    name: '稍等',
    content: '请稍等片刻，我正在为您处理...',
    category: '常用',
    shortcut: '/wait',
  },
  {
    name: '已处理',
    content: '您的问题已经处理完毕，如有其他需求请随时联系我们。',
    category: '常用',
    shortcut: '/done',
  },
  {
    name: '需要更多信息',
    content: '为了更好地帮助您，能否提供更多详细信息？',
    category: '询问',
    shortcut: '/info',
  },
  {
    name: '技术支持',
    content: '这个问题需要技术团队介入，我会尽快为您安排。',
    category: '支持',
    shortcut: '/tech',
  },
  {
    name: '会议邀请',
    content: '我想邀请您参加 {time} 的会议，讨论关于 {topic} 的事宜。',
    category: '会议',
    shortcut: '/meeting',
    variables: ['time', 'topic'],
  },
]

// ==================== 工具函数 ====================

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 提取变量
 */
const extractVariables = (content: string): string[] => {
  const regex = /\{([^}]+)\}/g
  const variables: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }
  return variables
}

// ==================== 主组件 ====================

export const QuickReplyTemplates: React.FC<QuickReplyTemplatesProps> = ({
  templates,
  onUseTemplate,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  className,
  visible = true,
  onClose,
}) => {
  // ==================== 状态 ====================

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [copiedId, setCopiedId] = useState<string>()
  
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: '',
    shortcut: '',
  })

  // ==================== 计算属性 ====================

  /**
   * 所有分类
   */
  const allCategories = useMemo(() => {
    const categories = new Set<string>()
    templates.forEach(t => {
      if (t.category) categories.add(t.category)
    })
    DEFAULT_TEMPLATES.forEach(t => {
      if (t.category) categories.add(t.category)
    })
    return Array.from(categories).sort()
  }, [templates])

  /**
   * 合并后的模板列表
   */
  const allTemplates = useMemo(() => {
    const merged = [...templates]
    
    // 添加默认模板（如果不存在）
    DEFAULT_TEMPLATES.forEach(defaultTemplate => {
      const exists = templates.some(t => t.shortcut === defaultTemplate.shortcut)
      if (!exists) {
        merged.push({
          ...defaultTemplate,
          id: generateId(),
          createdAt: Date.now(),
          useCount: 0,
        })
      }
    })

    return merged
  }, [templates])

  /**
   * 筛选后的模板
   */
  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates

    // 按搜索查询筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.shortcut?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
      )
    }

    // 按分类筛选
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }

    // 按使用次数排序
    return filtered.sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
  }, [allTemplates, searchQuery, selectedCategory])

  // ==================== 事件处理 ====================

  /**
   * 使用模板
   */
  const handleUseTemplate = useCallback((template: QuickReplyTemplate) => {
    onUseTemplate?.(template)
    
    // 增加使用次数
    if (onUpdateTemplate) {
      onUpdateTemplate(template.id, {
        useCount: (template.useCount || 0) + 1
      })
    }
  }, [onUseTemplate, onUpdateTemplate])

  /**
   * 复制模板内容
   */
  const handleCopyTemplate = useCallback(async (template: QuickReplyTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content)
      setCopiedId(template.id)
      setTimeout(() => setCopiedId(undefined), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }, [])

  /**
   * 添加模板
   */
  const handleAddTemplate = useCallback(() => {
    if (!formData.name || !formData.content) return

    const variables = extractVariables(formData.content)
    
    onAddTemplate?.({
      name: formData.name,
      content: formData.content,
      category: formData.category || undefined,
      shortcut: formData.shortcut || undefined,
      variables: variables.length > 0 ? variables : undefined,
    })

    // 重置表单
    setFormData({
      name: '',
      content: '',
      category: '',
      shortcut: '',
    })
    setShowAddForm(false)
  }, [formData, onAddTemplate])

  /**
   * 开始编辑
   */
  const handleStartEdit = useCallback((template: QuickReplyTemplate) => {
    setEditingId(template.id)
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category || '',
      shortcut: template.shortcut || '',
    })
  }, [])

  /**
   * 保存编辑
   */
  const handleSaveEdit = useCallback(() => {
    if (!editingId || !formData.name || !formData.content) return

    const variables = extractVariables(formData.content)

    onUpdateTemplate?.(editingId, {
      name: formData.name,
      content: formData.content,
      category: formData.category || undefined,
      shortcut: formData.shortcut || undefined,
      variables: variables.length > 0 ? variables : undefined,
    })

    setEditingId(undefined)
    setFormData({
      name: '',
      content: '',
      category: '',
      shortcut: '',
    })
  }, [editingId, formData, onUpdateTemplate])

  /**
   * 取消编辑
   */
  const handleCancelEdit = useCallback(() => {
    setEditingId(undefined)
    setShowAddForm(false)
    setFormData({
      name: '',
      content: '',
      category: '',
      shortcut: '',
    })
  }, [])

  /**
   * 删除模板
   */
  const handleDeleteTemplate = useCallback((id: string) => {
    if (window.confirm('确定要删除这个模板吗？')) {
      onDeleteTemplate?.(id)
    }
  }, [onDeleteTemplate])

  // ==================== 渲染 ====================

  if (!visible) return null

  return (
    <div className={clsx(styles.container, className)}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Zap size={20} className={styles.headerIcon} />
          <h2>快捷回复</h2>
          <span className={styles.count}>({filteredTemplates.length})</span>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => setShowAddForm(true)}
            className={styles.addButton}
            title="添加模板"
          >
            <Plus size={18} />
          </button>
          {onClose && (
            <button onClick={onClose} className={styles.closeButton}>
              <X size={20} />
            </button>
          )}
        </div>
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
            placeholder="搜索模板..."
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
      </div>

      {/* 分类筛选 */}
      {allCategories.length > 0 && (
        <div className={styles.categoryFilter}>
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={clsx(
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive
            )}
          >
            全部
          </button>
          {allCategories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category === selectedCategory ? undefined : category)}
              className={clsx(
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive
              )}
            >
              <Hash size={12} />
              {category}
            </button>
          ))}
        </div>
      )}

      {/* 模板列表 */}
      <div className={styles.templateList}>
        {/* 添加/编辑表单 */}
        {(showAddForm || editingId) && (
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>
              {editingId ? '编辑模板' : '添加模板'}
            </h3>
            <div className={styles.formGroup}>
              <label>模板名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: 问候"
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label>模板内容 *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入模板内容，使用 {变量名} 插入变量"
                className={styles.formTextarea}
                rows={4}
              />
              {extractVariables(formData.content).length > 0 && (
                <div className={styles.variablesHint}>
                  <span>变量:</span>
                  {extractVariables(formData.content).map(v => (
                    <span key={v} className={styles.variableTag}>{v}</span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>分类</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="例如: 常用"
                  className={styles.formInput}
                  list="categories"
                />
                <datalist id="categories">
                  {allCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className={styles.formGroup}>
                <label>快捷键</label>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="例如: /hello"
                  className={styles.formInput}
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button onClick={handleCancelEdit} className={styles.cancelButton}>
                取消
              </button>
              <button
                onClick={editingId ? handleSaveEdit : handleAddTemplate}
                disabled={!formData.name || !formData.content}
                className={styles.saveButton}
              >
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 模板项 */}
        {filteredTemplates.length === 0 ? (
          <div className={styles.emptyState}>
            <Zap size={48} className={styles.emptyIcon} />
            <p>还没有模板</p>
            <button onClick={() => setShowAddForm(true)} className={styles.emptyAddButton}>
              <Plus size={16} />
              添加第一个模板
            </button>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div
              key={template.id}
              className={styles.templateCard}
              onClick={() => handleUseTemplate(template)}
            >
              <div className={styles.templateHeader}>
                <div className={styles.templateTitle}>
                  <span className={styles.templateName}>{template.name}</span>
                  {template.category && (
                    <span className={styles.templateCategory}>
                      <Hash size={10} />
                      {template.category}
                    </span>
                  )}
                </div>
                <div className={styles.templateActions} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleCopyTemplate(template)}
                    className={styles.actionButton}
                    title="复制内容"
                  >
                    {copiedId === template.id ? (
                      <Check size={14} className={styles.checkIcon} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => handleStartEdit(template)}
                    className={styles.actionButton}
                    title="编辑"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className={clsx(styles.actionButton, styles.actionButtonDanger)}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className={styles.templateContent}>
                {template.content}
              </div>

              <div className={styles.templateFooter}>
                {template.shortcut && (
                  <span className={styles.templateShortcut}>
                    {template.shortcut}
                  </span>
                )}
                {template.useCount !== undefined && template.useCount > 0 && (
                  <span className={styles.templateUseCount}>
                    使用 {template.useCount} 次
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default QuickReplyTemplates


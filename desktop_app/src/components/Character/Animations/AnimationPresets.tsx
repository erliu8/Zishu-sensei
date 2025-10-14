import React, { useState, useMemo } from 'react'
import { AnimationConfig } from '../../../services/live2d/animation'
import { Play, Edit2, Trash2, Plus, Folder, Star, Copy, Search } from 'lucide-react'

/**
 * 动画预设数据
 */
export interface AnimationPreset {
  id: string
  name: string
  description?: string
  animations: AnimationConfig[]
  tags?: string[]
  isFavorite?: boolean
  createdAt: number
  updatedAt: number
}

/**
 * 预设项属性
 */
interface PresetItemProps {
  preset: AnimationPreset
  onPlay: (preset: AnimationPreset) => void
  onEdit: (preset: AnimationPreset) => void
  onDelete: (preset: AnimationPreset) => void
  onToggleFavorite: (preset: AnimationPreset) => void
  onDuplicate?: (preset: AnimationPreset) => void
}

/**
 * 预设项组件
 */
const PresetItem: React.FC<PresetItemProps> = ({
  preset,
  onPlay,
  onEdit,
  onDelete,
  onToggleFavorite,
  onDuplicate
}) => {
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors">
      {/* 预设头部 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {preset.name}
            </h4>
            {preset.isFavorite && (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            )}
          </div>
          {preset.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {preset.description}
            </p>
          )}
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{preset.animations.length} 个动画</span>
            <span>更新于 {formatDate(preset.updatedAt)}</span>
          </div>
        </div>

        {/* 收藏按钮 */}
        <button
          onClick={() => onToggleFavorite(preset)}
          className={`p-1 rounded transition-colors ${
            preset.isFavorite
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-gray-400 hover:text-yellow-500'
          }`}
          title={preset.isFavorite ? '取消收藏' : '添加收藏'}
        >
          <Star className={`w-4 h-4 ${preset.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* 标签 */}
      {preset.tags && preset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {preset.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 动画预览 */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">包含动画:</div>
        <div className="flex flex-wrap gap-1">
          {preset.animations.slice(0, 3).map((animation, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
            >
              {animation.group}[{animation.index ?? 0}]
            </span>
          ))}
          {preset.animations.length > 3 && (
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400">
              +{preset.animations.length - 3} 更多
            </span>
          )}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* 播放按钮 */}
          <button
            onClick={() => onPlay(preset)}
            className="flex items-center space-x-1 px-3 py-1 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <Play className="w-3 h-3" />
            <span>播放</span>
          </button>

          {/* 编辑按钮 */}
          <button
            onClick={() => onEdit(preset)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
            title="编辑预设"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {/* 复制按钮 */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(preset)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
              title="复制预设"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(preset)}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          title="删除预设"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * 预设编辑器属性
 */
interface PresetEditorProps {
  preset?: AnimationPreset
  availableAnimations: AnimationConfig[]
  onSave: (preset: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

/**
 * 预设编辑器组件
 */
const PresetEditor: React.FC<PresetEditorProps> = ({
  preset,
  availableAnimations,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState(preset?.name || '')
  const [description, setDescription] = useState(preset?.description || '')
  const [selectedAnimations, setSelectedAnimations] = useState<AnimationConfig[]>(
    preset?.animations || []
  )
  const [tags, setTags] = useState(preset?.tags?.join(', ') || '')
  const [isFavorite, setIsFavorite] = useState(preset?.isFavorite || false)

  const handleAddAnimation = (animation: AnimationConfig) => {
    setSelectedAnimations(prev => [...prev, animation])
  }

  const handleRemoveAnimation = (index: number) => {
    setSelectedAnimations(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      animations: selectedAnimations,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      isFavorite
    })
  }

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">预设名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入预设名称"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入预设描述"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">标签</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="输入标签，用逗号分隔"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="favorite"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="favorite" className="text-sm">
            标记为收藏
          </label>
        </div>
      </div>

      {/* 动画选择 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          包含的动画 ({selectedAnimations.length})
        </label>
        
        {/* 已选动画 */}
        {selectedAnimations.length > 0 && (
          <div className="mb-3 p-3 border border-gray-200 rounded-md dark:border-gray-600">
            <div className="space-y-2">
              {selectedAnimations.map((animation, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <span className="text-sm">
                    {animation.group}[{animation.index ?? 0}]
                    {animation.description && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        - {animation.description}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveAnimation(index)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 可选动画 */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md dark:border-gray-600">
          {availableAnimations.map((animation, index) => (
            <button
              key={index}
              onClick={() => handleAddAnimation(animation)}
              className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
            >
              <div className="text-sm">
                {animation.group}[{animation.index ?? 0}]
                {animation.description && (
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    - {animation.description}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || selectedAnimations.length === 0}
          className="px-4 py-2 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          保存预设
        </button>
      </div>
    </div>
  )
}

/**
 * 动画预设管理属性
 */
interface AnimationPresetsProps {
  presets: AnimationPreset[]
  availableAnimations: AnimationConfig[]
  onPlayPreset: (preset: AnimationPreset) => void
  onSavePreset: (preset: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => void
  onUpdatePreset: (id: string, preset: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDeletePreset: (id: string) => void
  onToggleFavorite: (id: string) => void
  maxHeight?: string
  className?: string
}

/**
 * 动画预设管理组件
 */
export const AnimationPresets: React.FC<AnimationPresetsProps> = ({
  presets,
  availableAnimations,
  onPlayPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  onToggleFavorite,
  maxHeight = '500px',
  className = ''
}) => {
  const [showEditor, setShowEditor] = useState(false)
  const [editingPreset, setEditingPreset] = useState<AnimationPreset | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTag, setFilterTag] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'favorite'>('updated')

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    presets.forEach(preset => {
      preset.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [presets])

  // 过滤和排序预设
  const filteredPresets = useMemo(() => {
    let result = presets

    // 搜索过滤
    if (searchTerm) {
      result = result.filter(preset =>
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // 标签过滤
    if (filterTag !== 'all') {
      if (filterTag === 'favorite') {
        result = result.filter(preset => preset.isFavorite)
      } else {
        result = result.filter(preset => preset.tags?.includes(filterTag))
      }
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'updated':
          return b.updatedAt - a.updatedAt
        case 'favorite':
          if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1
          }
          return b.updatedAt - a.updatedAt
        default:
          return 0
      }
    })

    return result
  }, [presets, searchTerm, filterTag, sortBy])

  // 处理编辑预设
  const handleEditPreset = (preset: AnimationPreset) => {
    setEditingPreset(preset)
    setShowEditor(true)
  }

  // 处理创建新预设
  const handleCreatePreset = () => {
    setEditingPreset(undefined)
    setShowEditor(true)
  }

  // 处理保存预设
  const handleSavePreset = (presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingPreset) {
      onUpdatePreset(editingPreset.id, presetData)
    } else {
      onSavePreset(presetData)
    }
    setShowEditor(false)
    setEditingPreset(undefined)
  }

  // 处理取消编辑
  const handleCancelEdit = () => {
    setShowEditor(false)
    setEditingPreset(undefined)
  }

  // 处理复制预设
  const handleDuplicatePreset = (preset: AnimationPreset) => {
    const duplicatedPreset = {
      ...preset,
      name: `${preset.name} (副本)`
    }
    delete (duplicatedPreset as any).id
    delete (duplicatedPreset as any).createdAt
    delete (duplicatedPreset as any).updatedAt
    onSavePreset(duplicatedPreset)
  }

  return (
    <div className={`animation-presets ${className}`}>
      {/* 预设头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <Folder className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            动画预设 ({presets.length})
          </h3>
        </div>
        
        <button
          onClick={handleCreatePreset}
          className="flex items-center space-x-1 px-3 py-1 text-sm rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>新建预设</span>
        </button>
      </div>

      {/* 编辑器 */}
      {showEditor && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50">
          <h4 className="font-medium mb-3">
            {editingPreset ? '编辑预设' : '创建新预设'}
          </h4>
          <PresetEditor
            preset={editingPreset}
            availableAnimations={availableAnimations}
            onSave={handleSavePreset}
            onCancel={handleCancelEdit}
          />
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50 space-y-3">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索预设..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        {/* 过滤和排序 */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">标签筛选</label>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="all">全部</option>
              <option value="favorite">收藏</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">排序方式</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'updated' | 'favorite')}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="updated">最近更新</option>
              <option value="name">名称</option>
              <option value="favorite">收藏优先</option>
            </select>
          </div>
        </div>
      </div>

      {/* 预设列表 */}
      <div 
        className="overflow-y-auto" 
        style={{ maxHeight }}
      >
        {filteredPresets.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
            {presets.length === 0 ? (
              <>
                <p>暂无动画预设</p>
                <p className="text-sm mt-1">创建预设来保存常用的动画组合</p>
              </>
            ) : (
              <>
                <p>没有找到匹配的预设</p>
                <p className="text-sm mt-1">尝试调整搜索条件或筛选器</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filteredPresets.map((preset) => (
              <PresetItem
                key={preset.id}
                preset={preset}
                onPlay={onPlayPreset}
                onEdit={handleEditPreset}
                onDelete={(preset) => onDeletePreset(preset.id)}
                onToggleFavorite={(preset) => onToggleFavorite(preset.id)}
                onDuplicate={handleDuplicatePreset}
              />
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      {presets.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>
              总计: {presets.length} 个预设
              {filteredPresets.length !== presets.length && 
                ` (显示 ${filteredPresets.length})`
              }
            </span>
            <span>
              收藏: {presets.filter(p => p.isFavorite).length} 个
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimationPresets

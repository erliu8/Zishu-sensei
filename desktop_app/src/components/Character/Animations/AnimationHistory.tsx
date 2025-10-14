import React, { useState, useMemo } from 'react'
import { AnimationConfig, AnimationType } from '../../../services/live2d/animation'
import { Play, Clock, Filter, Search, RotateCcw, X } from 'lucide-react'

/**
 * 历史项属性
 */
interface HistoryItemProps {
  animation: AnimationConfig
  index: number
  timestamp?: number
  onReplay: (animation: AnimationConfig) => void
  onRemove?: (index: number) => void
  showTimestamp?: boolean
}

/**
 * 历史项组件
 */
const HistoryItem: React.FC<HistoryItemProps> = ({
  animation,
  index,
  timestamp,
  onReplay,
  onRemove,
  showTimestamp = true
}) => {
  const getAnimationTypeName = (type: AnimationType): string => {
    const nameMap = {
      [AnimationType.IDLE]: '空闲',
      [AnimationType.TAP]: '点击',
      [AnimationType.DRAG]: '拖拽',
      [AnimationType.GREETING]: '问候',
      [AnimationType.FAREWELL]: '告别',
      [AnimationType.THINKING]: '思考',
      [AnimationType.SPEAKING]: '说话',
      [AnimationType.HAPPY]: '开心',
      [AnimationType.SURPRISED]: '惊讶',
      [AnimationType.CONFUSED]: '困惑',
      [AnimationType.SLEEPING]: '睡觉',
      [AnimationType.CUSTOM]: '自定义'
    }
    return nameMap[type] || type
  }

  const formatTimestamp = (ts?: number): string => {
    if (!ts) return ''
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors">
      {/* 动画信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            #{index + 1}
          </span>
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {animation.group}[{animation.index ?? 0}]
          </h4>
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {getAnimationTypeName(animation.type)}
          </span>
        </div>
        
        {animation.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
            {animation.description}
          </p>
        )}
        
        {showTimestamp && timestamp && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatTimestamp(timestamp)}
          </p>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center space-x-1 ml-3">
        {/* 重播按钮 */}
        <button
          onClick={() => onReplay(animation)}
          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          title="重播此动画"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* 删除按钮 */}
        {onRemove && (
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            title="从历史中删除"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 播放历史属性
 */
interface AnimationHistoryProps {
  history: AnimationConfig[]
  timestamps?: number[]
  onReplay: (animation: AnimationConfig, index: number) => void
  onRemove?: (index: number) => void
  onClear?: () => void
  maxHeight?: string
  showTimestamps?: boolean
  enableSearch?: boolean
  enableFilter?: boolean
  className?: string
}

/**
 * 播放历史组件
 */
export const AnimationHistory: React.FC<AnimationHistoryProps> = ({
  history,
  timestamps = [],
  onReplay,
  onRemove,
  onClear,
  maxHeight = '400px',
  showTimestamps = true,
  enableSearch = true,
  enableFilter = true,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<AnimationType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'type' | 'name'>('recent')

  // 过滤和搜索历史
  const filteredHistory = useMemo(() => {
    let result = history.map((animation, index) => ({
      animation,
      index,
      timestamp: timestamps[index]
    }))

    // 搜索过滤
    if (searchTerm) {
      result = result.filter(item => 
        item.animation.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.animation.description && item.animation.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // 类型过滤
    if (filterType !== 'all') {
      result = result.filter(item => item.animation.type === filterType)
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return (b.timestamp || 0) - (a.timestamp || 0)
        case 'type':
          return a.animation.type.localeCompare(b.animation.type)
        case 'name':
          return a.animation.group.localeCompare(b.animation.group)
        default:
          return 0
      }
    })

    return result
  }, [history, timestamps, searchTerm, filterType, sortBy])

  // 统计信息
  const stats = useMemo(() => {
    const typeStats = new Map<AnimationType, number>()
    history.forEach(animation => {
      const count = typeStats.get(animation.type) || 0
      typeStats.set(animation.type, count + 1)
    })
    return typeStats
  }, [history])

  // 获取动画类型名称
  const getAnimationTypeName = (type: AnimationType): string => {
    const nameMap = {
      [AnimationType.IDLE]: '空闲',
      [AnimationType.TAP]: '点击',
      [AnimationType.DRAG]: '拖拽',
      [AnimationType.GREETING]: '问候',
      [AnimationType.FAREWELL]: '告别',
      [AnimationType.THINKING]: '思考',
      [AnimationType.SPEAKING]: '说话',
      [AnimationType.HAPPY]: '开心',
      [AnimationType.SURPRISED]: '惊讶',
      [AnimationType.CONFUSED]: '困惑',
      [AnimationType.SLEEPING]: '睡觉',
      [AnimationType.CUSTOM]: '自定义'
    }
    return nameMap[type] || type
  }

  return (
    <div className={`animation-history ${className}`}>
      {/* 历史头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            播放历史 ({history.length})
          </h3>
        </div>
        
        {onClear && history.length > 0 && (
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
            title="清空历史"
          >
            清空历史
          </button>
        )}
      </div>

      {/* 搜索和过滤 */}
      {(enableSearch || enableFilter) && (
        <div className="p-3 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50 space-y-3">
          {/* 搜索框 */}
          {enableSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索动画..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}

          {/* 过滤和排序 */}
          {enableFilter && (
            <div className="flex space-x-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">类型筛选</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as AnimationType | 'all')}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="all">全部</option>
                  {Object.values(AnimationType).map(type => (
                    <option key={type} value={type}>
                      {getAnimationTypeName(type)} ({stats.get(type) || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">排序方式</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'type' | 'name')}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="recent">最近播放</option>
                  <option value="type">动画类型</option>
                  <option value="name">动画名称</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 历史列表 */}
      <div 
        className="overflow-y-auto" 
        style={{ maxHeight }}
      >
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            {history.length === 0 ? (
              <>
                <p>暂无播放历史</p>
                <p className="text-sm mt-1">播放动画后会在这里显示历史记录</p>
              </>
            ) : (
              <>
                <p>没有找到匹配的历史记录</p>
                <p className="text-sm mt-1">尝试调整搜索条件或筛选器</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredHistory.map((item) => (
              <HistoryItem
                key={`history_${item.index}_${item.timestamp}`}
                animation={item.animation}
                index={item.index}
                timestamp={item.timestamp}
                onReplay={(animation) => onReplay(animation, item.index)}
                onRemove={onRemove}
                showTimestamp={showTimestamps}
              />
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      {history.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>
              总计: {history.length} 次播放
              {filteredHistory.length !== history.length && 
                ` (显示 ${filteredHistory.length})`
              }
            </span>
            <span>最常用: {
              Array.from(stats.entries())
                .sort((a, b) => b[1] - a[1])[0]
                ? getAnimationTypeName(Array.from(stats.entries()).sort((a, b) => b[1] - a[1])[0][0])
                : '-'
            }</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimationHistory

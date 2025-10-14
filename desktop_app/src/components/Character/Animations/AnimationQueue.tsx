import React, { useState, useCallback } from 'react'
import { AnimationConfig, AnimationType } from '../../../services/live2d/animation'
import { Play, X, ArrowUp, ArrowDown, Plus, List, Shuffle } from 'lucide-react'

/**
 * 播放队列项属性
 */
interface QueueItemProps {
  animation: AnimationConfig
  index: number
  isActive?: boolean
  onPlay: (animation: AnimationConfig) => void
  onRemove: (index: number) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  showControls?: boolean
}

/**
 * 播放队列项组件
 */
const QueueItem: React.FC<QueueItemProps> = ({
  animation,
  index,
  isActive = false,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
  showControls = true
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

  return (
    <div className={`
      flex items-center p-3 rounded-lg border transition-all duration-200
      ${isActive 
        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700' 
        : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
      }
    `}>
      {/* 动画信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            #{index + 1}
          </span>
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {animation.group}[{animation.index ?? 0}]
          </h4>
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {getAnimationTypeName(animation.type)}
          </span>
        </div>
        {animation.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
            {animation.description}
          </p>
        )}
        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>优先级: {animation.priority || 2}</span>
          {animation.loop && <span>循环</span>}
          {animation.repeatCount && <span>重复: {animation.repeatCount}次</span>}
        </div>
      </div>

      {/* 控制按钮 */}
      {showControls && (
        <div className="flex items-center space-x-1 ml-3">
          {/* 播放按钮 */}
          <button
            onClick={() => onPlay(animation)}
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            title="播放此动画"
          >
            <Play className="w-4 h-4" />
          </button>

          {/* 上移按钮 */}
          {onMoveUp && index > 0 && (
            <button
              onClick={() => onMoveUp(index)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              title="上移"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}

          {/* 下移按钮 */}
          {onMoveDown && (
            <button
              onClick={() => onMoveDown(index)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              title="下移"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}

          {/* 删除按钮 */}
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            title="从队列中移除"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 播放队列属性
 */
interface AnimationQueueProps {
  queue: AnimationConfig[]
  currentIndex?: number
  availableAnimations?: AnimationConfig[]
  onPlay: (animation: AnimationConfig) => void
  onRemove: (index: number) => void
  onClear: () => void
  onAdd?: (animation: AnimationConfig) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  onShuffle?: () => void
  maxHeight?: string
  showAddControls?: boolean
  className?: string
}

/**
 * 播放队列组件
 */
export const AnimationQueue: React.FC<AnimationQueueProps> = ({
  queue,
  currentIndex = -1,
  availableAnimations = [],
  onPlay,
  onRemove,
  onClear,
  onAdd,
  onReorder,
  onShuffle,
  maxHeight = '300px',
  showAddControls = true,
  className = ''
}) => {
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [selectedType, setSelectedType] = useState<AnimationType>(AnimationType.IDLE)

  // 移动队列项
  const handleMoveUp = useCallback((index: number) => {
    if (onReorder && index > 0) {
      onReorder(index, index - 1)
    }
  }, [onReorder])

  const handleMoveDown = useCallback((index: number) => {
    if (onReorder && index < queue.length - 1) {
      onReorder(index, index + 1)
    }
  }, [onReorder, queue.length])

  // 按类型过滤可用动画
  const animationsByType = availableAnimations.filter(anim => anim.type === selectedType)

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
    <div className={`animation-queue ${className}`}>
      {/* 队列头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            播放队列 ({queue.length})
          </h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 随机排序按钮 */}
          {onShuffle && queue.length > 1 && (
            <button
              onClick={onShuffle}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              title="随机排序"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          )}

          {/* 添加动画按钮 */}
          {showAddControls && onAdd && (
            <button
              onClick={() => setShowAddPanel(!showAddPanel)}
              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
              title="添加动画"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* 清空队列按钮 */}
          <button
            onClick={onClear}
            disabled={queue.length === 0}
            className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
            title="清空队列"
          >
            清空
          </button>
        </div>
      </div>

      {/* 添加动画面板 */}
      {showAddPanel && onAdd && (
        <div className="p-3 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">动画类型</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as AnimationType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {Object.values(AnimationType).map(type => (
                  <option key={type} value={type}>
                    {getAnimationTypeName(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1">
              {animationsByType.map((animation, index) => (
                <button
                  key={`${animation.group}_${animation.index}_${index}`}
                  onClick={() => {
                    onAdd(animation)
                    setShowAddPanel(false)
                  }}
                  className="w-full text-left px-2 py-1 text-sm rounded hover:bg-white dark:hover:bg-gray-600 transition-colors"
                >
                  {animation.group}[{animation.index ?? 0}]
                  {animation.description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      - {animation.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 队列列表 */}
      <div 
        className="overflow-y-auto" 
        style={{ maxHeight }}
      >
        {queue.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>播放队列为空</p>
            <p className="text-sm mt-1">添加一些动画开始播放</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {queue.map((animation, index) => (
              <QueueItem
                key={`${animation.group}_${animation.index}_${index}`}
                animation={animation}
                index={index}
                isActive={index === currentIndex}
                onPlay={onPlay}
                onRemove={onRemove}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </div>
        )}
      </div>

      {/* 队列统计 */}
      {queue.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>总计: {queue.length} 个动画</span>
            <span>当前: {currentIndex >= 0 ? currentIndex + 1 : '-'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimationQueue

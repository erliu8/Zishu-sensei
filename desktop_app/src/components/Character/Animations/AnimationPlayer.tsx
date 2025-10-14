import React, { useState, useCallback, useMemo } from 'react'
import { 
  AnimationType, 
  AnimationConfig, 
  AnimationState
} from '../../../services/live2d/animation'
import { AnimationControlService } from '../../../services/animation/AnimationControlService'
import useAnimationControl from '@/hooks/useAnimationControl'
import { useAnimationPresets } from '@/hooks/useAnimationPresets'
import { AnimationPresets, AnimationPreset } from './AnimationPresets'
import { Play, Pause, Square, SkipForward, Repeat, Settings, Volume2, Folder } from 'lucide-react'

/**
 * 动画播放器属性接口
 */
interface AnimationPlayerProps {
  /** 动画控制服务实例 */
  animationControlService: AnimationControlService
  /** 是否显示详细控制面板 */
  showAdvancedControls?: boolean
  /** 是否显示动画列表 */
  showAnimationList?: boolean
  /** 是否显示预设管理 */
  showPresets?: boolean
  /** 自定义样式类名 */
  className?: string
  /** 播放器尺寸 */
  size?: 'small' | 'medium' | 'large'
  /** 主题风格 */
  theme?: 'light' | 'dark' | 'auto'
}

/**
 * 动画播放器组件
 */
export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  animationControlService,
  showAdvancedControls = false,
  showAnimationList = false,
  showPresets = false,
  className = '',
  size = 'medium',
  theme = 'auto'
}) => {
  const {
    currentPlayInfo,
    availableAnimations,
    isPlaying,
    isPaused,
    playAnimation,
    stopAnimation,
    pauseAnimation,
    resumeAnimation,
    playRandomAnimationByType,
    setAutoIdleEnabled,
    autoIdleEnabled,
    autoIdleInterval
  } = useAnimationControl(animationControlService)

  // 预设管理
  const {
    presets,
    createPreset,
    updatePreset,
    deletePreset,
    toggleFavorite
  } = useAnimationPresets()

  // 本地状态
  const [selectedAnimationType, setSelectedAnimationType] = useState<AnimationType>(AnimationType.IDLE)
  const [selectedAnimationConfig, setSelectedAnimationConfig] = useState<AnimationConfig | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showPresetsPanel, setShowPresetsPanel] = useState(false)

  // 根据类型过滤动画
  const animationsByType = useMemo(() => {
    const grouped = new Map<AnimationType, AnimationConfig[]>()
    availableAnimations.forEach((animation: AnimationConfig) => {
      if (!grouped.has(animation.type)) {
        grouped.set(animation.type, [])
      }
      grouped.get(animation.type)!.push(animation)
    })
    return grouped
  }, [availableAnimations])

  // 获取当前选中类型的动画列表
  const currentTypeAnimations = useMemo(() => {
    return animationsByType.get(selectedAnimationType) || []
  }, [animationsByType, selectedAnimationType])

  // 播放选中的动画
  const handlePlaySelectedAnimation = useCallback(async () => {
    if (selectedAnimationConfig) {
      try {
        await playAnimation(selectedAnimationConfig)
      } catch (error) {
        console.error('播放动画失败:', error)
      }
    }
  }, [selectedAnimationConfig, playAnimation])

  // 播放随机动画
  const handlePlayRandomAnimation = useCallback(async () => {
    try {
      await playRandomAnimationByType(selectedAnimationType)
    } catch (error) {
      console.error('播放随机动画失败:', error)
    }
  }, [selectedAnimationType, playRandomAnimationByType])

  // 切换播放/暂停
  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying && !isPaused) {
      pauseAnimation()
    } else if (isPaused) {
      resumeAnimation()
    } else {
      handlePlaySelectedAnimation()
    }
  }, [isPlaying, isPaused, pauseAnimation, resumeAnimation, handlePlaySelectedAnimation])

  // 获取动画类型的中文名称
  const getAnimationTypeName = useCallback((type: AnimationType): string => {
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
  }, [])

  // 播放预设
  const handlePlayPreset = useCallback(async (preset: AnimationPreset) => {
    try {
      // 按顺序播放预设中的所有动画
      for (const animation of preset.animations) {
        await playAnimation(animation as AnimationConfig)
        // 等待动画播放完成
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error('播放预设失败:', error)
    }
  }, [playAnimation])

  // 保存预设
  const handleSavePreset = useCallback(async (presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createPreset(presetData)
    } catch (error) {
      console.error('保存预设失败:', error)
    }
  }, [createPreset])

  // 更新预设
  const handleUpdatePreset = useCallback(async (id: string, presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await updatePreset(id, presetData)
    } catch (error) {
      console.error('更新预设失败:', error)
    }
  }, [updatePreset])

  // 删除预设
  const handleDeletePreset = useCallback(async (id: string) => {
    try {
      await deletePreset(id)
    } catch (error) {
      console.error('删除预设失败:', error)
    }
  }, [deletePreset])

  // 切换收藏
  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      await toggleFavorite(id)
    } catch (error) {
      console.error('切换收藏失败:', error)
    }
  }, [toggleFavorite])

  // 样式类名
  const sizeClasses = {
    small: 'text-xs p-2',
    medium: 'text-sm p-3',
    large: 'text-base p-4'
  }

  const themeClasses = {
    light: 'bg-white text-gray-900 border-gray-200',
    dark: 'bg-gray-800 text-white border-gray-600',
    auto: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600'
  }

  return (
    <div className={`
      animation-player rounded-lg border shadow-sm transition-all duration-200
      ${sizeClasses[size]} ${themeClasses[theme]} ${className}
    `}>
      {/* 主控制面板 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {/* 播放/暂停按钮 */}
          <button
            onClick={handleTogglePlayPause}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            title={isPlaying && !isPaused ? '暂停' : '播放'}
          >
            {isPlaying && !isPaused ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* 停止按钮 */}
          <button
            onClick={stopAnimation}
            disabled={!isPlaying}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white transition-colors"
            title="停止"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* 播放随机动画按钮 */}
          <button
            onClick={handlePlayRandomAnimation}
            className="flex items-center justify-center w-8 h-8 rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
            title="播放随机动画"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* 右侧控制按钮 */}
        <div className="flex items-center space-x-2">
          {/* 预设管理按钮 */}
          {showPresets && (
            <button
              onClick={() => setShowPresetsPanel(!showPresetsPanel)}
              className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                showPresetsPanel
                  ? 'bg-purple-500 hover:bg-purple-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
              }`}
              title={showPresetsPanel ? '隐藏预设面板' : '显示预设面板'}
            >
              <Folder className="w-4 h-4" />
            </button>
          )}

          {/* 自动播放切换 */}
          <button
            onClick={() => setAutoIdleEnabled(!autoIdleEnabled)}
            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
              autoIdleEnabled 
                ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            }`}
            title={autoIdleEnabled ? '关闭自动播放' : '开启自动播放'}
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* 音量控制 */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
            title="音量控制"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 当前播放信息 */}
      {currentPlayInfo && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                {getAnimationTypeName(currentPlayInfo.config.type)} - {currentPlayInfo.config.group}
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                状态: {currentPlayInfo.state === AnimationState.PLAYING ? '播放中' : 
                      currentPlayInfo.state === AnimationState.PAUSED ? '已暂停' : '已停止'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600 dark:text-blue-300">
                播放次数: {currentPlayInfo.playedCount}
              </p>
              {currentPlayInfo.config.repeatCount && (
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  剩余次数: {currentPlayInfo.remainingCount}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 动画类型选择器 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">动画类型</label>
        <select
          value={selectedAnimationType}
          onChange={(e) => {
            const newType = e.target.value as AnimationType
            setSelectedAnimationType(newType)
            setSelectedAnimationConfig(null)
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.values(AnimationType).map(type => (
            <option key={type} value={type}>
              {getAnimationTypeName(type)} ({animationsByType.get(type)?.length || 0})
            </option>
          ))}
        </select>
      </div>

      {/* 动画列表 */}
      {showAnimationList && currentTypeAnimations.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">选择具体动画</label>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {currentTypeAnimations.map((animation, index) => (
              <button
                key={`${animation.group}_${animation.index}_${index}`}
                onClick={() => setSelectedAnimationConfig(animation)}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  selectedAnimationConfig === animation
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {animation.group}[{animation.index ?? 0}]
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    优先级: {animation.priority || 2}
                  </span>
                </div>
                {animation.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {animation.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 高级控制面板 */}
      {showAdvancedControls && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <h3 className="text-sm font-medium mb-3">高级设置</h3>
          
          {/* 自动播放设置 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">自动空闲播放</label>
              <input
                type="checkbox"
                checked={autoIdleEnabled}
                onChange={(e) => setAutoIdleEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>
            {autoIdleEnabled && (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  播放间隔 (秒)
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={autoIdleInterval / 1000}
                  onChange={(e) => setAutoIdleEnabled(autoIdleEnabled, parseInt(e.target.value) * 1000)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>5s</span>
                  <span>{autoIdleInterval / 1000}s</span>
                  <span>60s</span>
                </div>
              </div>
            )}
          </div>

          {/* 音量控制 */}
          <div className="mb-4">
            <label className="block text-sm mb-2">音量</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>静音</span>
              <span>{Math.round(volume * 100)}%</span>
              <span>最大</span>
            </div>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full max-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">动画播放器设置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">统计信息</h3>
                <div className="text-sm space-y-1">
                  <p>可用动画总数: {availableAnimations.length}</p>
                  <p>动画类型数: {animationsByType.size}</p>
                  <p>当前状态: {isPlaying ? '播放中' : '空闲'}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">动画类型分布</h3>
                <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {Array.from(animationsByType.entries()).map(([type, animations]) => (
                    <div key={type} className="flex justify-between">
                      <span>{getAnimationTypeName(type)}</span>
                      <span>{animations.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预设管理面板 */}
      {showPresets && showPresetsPanel && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <AnimationPresets
            presets={presets}
            availableAnimations={availableAnimations}
            onPlayPreset={handlePlayPreset}
            onSavePreset={handleSavePreset}
            onUpdatePreset={handleUpdatePreset}
            onDeletePreset={handleDeletePreset}
            onToggleFavorite={handleToggleFavorite}
            maxHeight="400px"
            className="rounded-md border border-gray-200 dark:border-gray-600"
          />
        </div>
      )}
    </div>
  )
}

export default AnimationPlayer

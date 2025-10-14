import React from 'react'
import { Play, Pause, Square, SkipForward, SkipBack, Repeat, Shuffle } from 'lucide-react'

/**
 * 播放控制按钮属性
 */
interface PlayControlButtonProps {
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'outline'
  className?: string
}

/**
 * 播放控制按钮组件
 */
export const PlayControlButton: React.FC<PlayControlButtonProps> = ({
  icon,
  onClick,
  disabled = false,
  active = false,
  title,
  size = 'medium',
  variant = 'secondary',
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-6 h-6 text-sm',
    medium: 'w-8 h-8 text-base',
    large: 'w-10 h-10 text-lg'
  }

  const variantClasses = {
    primary: `
      bg-blue-500 hover:bg-blue-600 text-white
      ${active ? 'ring-2 ring-blue-300' : ''}
    `,
    secondary: `
      bg-gray-200 hover:bg-gray-300 text-gray-700
      dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200
      ${active ? 'ring-2 ring-gray-400 dark:ring-gray-300' : ''}
    `,
    outline: `
      border-2 border-gray-300 hover:border-gray-400 text-gray-700
      dark:border-gray-600 dark:hover:border-gray-400 dark:text-gray-200
      ${active ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' : ''}
    `
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center justify-center rounded transition-all duration-200
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:scale-105 active:scale-95'
        }
        ${className}
      `}
    >
      {icon}
    </button>
  )
}

/**
 * 动画控制按钮组属性
 */
interface AnimationControlsProps {
  isPlaying: boolean
  isPaused: boolean
  canPlay: boolean
  canStop: boolean
  canSkip: boolean
  repeatEnabled: boolean
  shuffleEnabled: boolean
  
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPrevious?: () => void
  onNext?: () => void
  onToggleRepeat?: () => void
  onToggleShuffle?: () => void
  
  size?: 'small' | 'medium' | 'large'
  layout?: 'horizontal' | 'vertical' | 'compact'
  showExtended?: boolean
  className?: string
}

/**
 * 动画控制按钮组组件
 */
export const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  isPaused,
  canPlay,
  canStop,
  canSkip,
  repeatEnabled,
  shuffleEnabled,
  onPlay,
  onPause,
  onStop,
  onPrevious,
  onNext,
  onToggleRepeat,
  onToggleShuffle,
  size = 'medium',
  layout = 'horizontal',
  showExtended = false,
  className = ''
}) => {
  const handlePlayPause = () => {
    if (isPlaying && !isPaused) {
      onPause()
    } else {
      onPlay()
    }
  }

  const layoutClasses = {
    horizontal: 'flex flex-row items-center space-x-2',
    vertical: 'flex flex-col items-center space-y-2',
    compact: 'flex flex-row items-center space-x-1'
  }

  const mainControls = (
    <>
      {/* 播放/暂停按钮 */}
      <PlayControlButton
        icon={isPlaying && !isPaused ? <Pause /> : <Play />}
        onClick={handlePlayPause}
        disabled={!canPlay}
        title={isPlaying && !isPaused ? '暂停' : '播放'}
        size={size}
        variant="primary"
      />

      {/* 停止按钮 */}
      <PlayControlButton
        icon={<Square />}
        onClick={onStop}
        disabled={!canStop}
        title="停止"
        size={size}
      />
    </>
  )

  const extendedControls = showExtended && (
    <>
      {/* 上一个按钮 */}
      {onPrevious && (
        <PlayControlButton
          icon={<SkipBack />}
          onClick={onPrevious}
          disabled={!canSkip}
          title="上一个"
          size={size}
        />
      )}

      {/* 下一个按钮 */}
      {onNext && (
        <PlayControlButton
          icon={<SkipForward />}
          onClick={onNext}
          disabled={!canSkip}
          title="下一个"
          size={size}
        />
      )}

      {/* 重复播放按钮 */}
      {onToggleRepeat && (
        <PlayControlButton
          icon={<Repeat />}
          onClick={onToggleRepeat}
          active={repeatEnabled}
          title={repeatEnabled ? '关闭重复播放' : '开启重复播放'}
          size={size}
        />
      )}

      {/* 随机播放按钮 */}
      {onToggleShuffle && (
        <PlayControlButton
          icon={<Shuffle />}
          onClick={onToggleShuffle}
          active={shuffleEnabled}
          title={shuffleEnabled ? '关闭随机播放' : '开启随机播放'}
          size={size}
        />
      )}
    </>
  )

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      {mainControls}
      {extendedControls}
    </div>
  )
}

export default AnimationControls

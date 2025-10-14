/**
 * Live2D控制面板组件
 * 
 * 提供Live2D模型的各种控制功能
 * 包括动画播放、表情设置、缩放控制等
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  Live2DControlPanelProps,
  Live2DAnimationConfig,
  Live2DAnimationType,
  Live2DViewerConfig,
  LIVE2D_ANIMATION_PRIORITY
} from '@/types/live2d'
import './Live2DControlPanel.css'

/**
 * Live2D控制面板组件
 */
export const Live2DControlPanel: React.FC<Live2DControlPanelProps> = ({
  visible,
  controls,
  modelState,
  animationInfo,
  availableAnimations,
  expressionCount,
  onPlayAnimation,
  onStopAnimation,
  onSetExpression,
  onResetTransform,
  onToggleFullscreen,
  onUpdateSettings
}) => {
  // ==================== State ====================
  const [activeTab, setActiveTab] = useState<'animations' | 'expressions' | 'settings'>('animations')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedAnimationType, setSelectedAnimationType] = useState<Live2DAnimationType>(Live2DAnimationType.IDLE)

  // ==================== 计算属性 ====================

  /**
   * 按类型分组的动画
   */
  const animationsByType = useMemo(() => {
    const grouped: Record<Live2DAnimationType, Live2DAnimationConfig[]> = {} as any
    
    // 初始化所有类型
    Object.values(Live2DAnimationType).forEach(type => {
      grouped[type] = []
    })

    // 按类型分组
    availableAnimations.forEach(animation => {
      if (grouped[animation.type]) {
        grouped[animation.type].push(animation)
      }
    })

    return grouped
  }, [availableAnimations])

  /**
   * 当前选中类型的动画列表
   */
  const currentTypeAnimations = useMemo(() => {
    return animationsByType[selectedAnimationType] || []
  }, [animationsByType, selectedAnimationType])

  /**
   * 表情列表
   */
  const expressions = useMemo(() => {
    return Array.from({ length: expressionCount }, (_, index) => ({
      index,
      name: `表情 ${index + 1}`,
      preview: null // 可以添加预览图
    }))
  }, [expressionCount])

  // ==================== 事件处理器 ====================

  /**
   * 播放指定动画
   */
  const handlePlayAnimation = useCallback((animation: Live2DAnimationConfig) => {
    onPlayAnimation(animation)
  }, [onPlayAnimation])

  /**
   * 播放随机动画
   */
  const handlePlayRandomAnimation = useCallback(() => {
    const animations = currentTypeAnimations
    if (animations.length > 0) {
      const randomIndex = Math.floor(Math.random() * animations.length)
      handlePlayAnimation(animations[randomIndex])
    }
  }, [currentTypeAnimations, handlePlayAnimation])

  /**
   * 设置表情
   */
  const handleSetExpression = useCallback((index: number) => {
    onSetExpression(index)
  }, [onSetExpression])

  /**
   * 更新设置
   */
  const handleUpdateSettings = useCallback((settings: Partial<Live2DViewerConfig>) => {
    onUpdateSettings(settings)
  }, [onUpdateSettings])

  // ==================== 渲染函数 ====================

  /**
   * 渲染动画控制标签页
   */
  const renderAnimationsTab = () => (
    <div className="live2d-control-panel__animations">
      {/* 动画类型选择器 */}
      <div className="live2d-control-panel__animation-types">
        <label className="live2d-control-panel__label">动画类型:</label>
        <select
          className="live2d-control-panel__select"
          value={selectedAnimationType}
          onChange={(e) => setSelectedAnimationType(e.target.value as Live2DAnimationType)}
        >
          {Object.values(Live2DAnimationType).map(type => (
            <option key={type} value={type}>
              {getAnimationTypeDisplayName(type)}
            </option>
          ))}
        </select>
      </div>

      {/* 动画列表 */}
      <div className="live2d-control-panel__animation-list">
        {currentTypeAnimations.length > 0 ? (
          <>
            <div className="live2d-control-panel__animation-controls">
              <button
                className="live2d-control-panel__button live2d-control-panel__button--random"
                onClick={handlePlayRandomAnimation}
                disabled={!modelState.loaded}
              >
                随机播放
              </button>
              {modelState.animating && (
                <button
                  className="live2d-control-panel__button live2d-control-panel__button--stop"
                  onClick={onStopAnimation}
                >
                  停止动画
                </button>
              )}
            </div>
            
            <div className="live2d-control-panel__animation-items">
              {currentTypeAnimations.map((animation, index) => (
                <button
                  key={`${animation.group}_${animation.index || 0}`}
                  className={`live2d-control-panel__animation-item ${
                    animationInfo?.config.group === animation.group && 
                    animationInfo?.config.index === animation.index
                      ? 'live2d-control-panel__animation-item--active' 
                      : ''
                  }`}
                  onClick={() => handlePlayAnimation(animation)}
                  disabled={!modelState.loaded}
                  title={animation.description}
                >
                  <span className="live2d-control-panel__animation-name">
                    {animation.group}[{animation.index || 0}]
                  </span>
                  <span className="live2d-control-panel__animation-priority">
                    P{animation.priority || ANIMATION_PRIORITY.NORMAL}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="live2d-control-panel__empty">
            <p>该类型暂无可用动画</p>
          </div>
        )}
      </div>

      {/* 当前播放信息 */}
      {animationInfo && (
        <div className="live2d-control-panel__current-animation">
          <h4>当前播放:</h4>
          <p>类型: {getAnimationTypeDisplayName(animationInfo.config.type)}</p>
          <p>动画: {animationInfo.config.group}[{animationInfo.config.index || 0}]</p>
          <p>状态: {getAnimationStateDisplayName(animationInfo.state)}</p>
          <p>进度: {Math.round(animationInfo.progress * 100)}%</p>
        </div>
      )}
    </div>
  )

  /**
   * 渲染表情控制标签页
   */
  const renderExpressionsTab = () => (
    <div className="live2d-control-panel__expressions">
      {expressions.length > 0 ? (
        <div className="live2d-control-panel__expression-grid">
          {expressions.map((expression) => (
            <button
              key={expression.index}
              className="live2d-control-panel__expression-item"
              onClick={() => handleSetExpression(expression.index)}
              disabled={!modelState.loaded}
              title={expression.name}
            >
              <div className="live2d-control-panel__expression-preview">
                {expression.preview ? (
                  <img src={expression.preview} alt={expression.name} />
                ) : (
                  <div className="live2d-control-panel__expression-placeholder">
                    {expression.index + 1}
                  </div>
                )}
              </div>
              <span className="live2d-control-panel__expression-name">
                {expression.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="live2d-control-panel__empty">
          <p>该模型暂无表情配置</p>
        </div>
      )}
    </div>
  )

  /**
   * 渲染设置标签页
   */
  const renderSettingsTab = () => (
    <div className="live2d-control-panel__settings">
      <div className="live2d-control-panel__setting-group">
        <h4>模型控制</h4>
        <button
          className="live2d-control-panel__button"
          onClick={onResetTransform}
          disabled={!modelState.loaded}
        >
          重置位置和缩放
        </button>
      </div>

      <div className="live2d-control-panel__setting-group">
        <h4>显示设置</h4>
        {controls.showFullscreen && (
          <button
            className="live2d-control-panel__button"
            onClick={onToggleFullscreen}
          >
            切换全屏
          </button>
        )}
      </div>

      <div className="live2d-control-panel__setting-group">
        <h4>性能信息</h4>
        <div className="live2d-control-panel__performance-info">
          <p>模型状态: {modelState.loaded ? '已加载' : '未加载'}</p>
          <p>交互状态: {modelState.interactive ? '启用' : '禁用'}</p>
          <p>最后更新: {new Date(modelState.lastUpdated).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  )

  // ==================== 工具函数 ====================

  /**
   * 获取动画类型显示名称
   */
  function getAnimationTypeDisplayName(type: Live2DAnimationType): string {
    const names: Record<Live2DAnimationType, string> = {
      [Live2DAnimationType.IDLE]: '空闲',
      [Live2DAnimationType.TAP]: '点击',
      [Live2DAnimationType.DRAG]: '拖拽',
      [Live2DAnimationType.GREETING]: '问候',
      [Live2DAnimationType.FAREWELL]: '告别',
      [Live2DAnimationType.THINKING]: '思考',
      [Live2DAnimationType.SPEAKING]: '说话',
      [Live2DAnimationType.HAPPY]: '高兴',
      [Live2DAnimationType.SURPRISED]: '惊讶',
      [Live2DAnimationType.CONFUSED]: '困惑',
      [Live2DAnimationType.SLEEPING]: '睡觉',
      [Live2DAnimationType.CUSTOM]: '自定义'
    }
    return names[type] || type
  }

  /**
   * 获取动画状态显示名称
   */
  function getAnimationStateDisplayName(state: string): string {
    const names: Record<string, string> = {
      'idle': '空闲',
      'playing': '播放中',
      'paused': '暂停',
      'stopped': '已停止'
    }
    return names[state] || state
  }

  // ==================== 渲染 ====================

  if (!visible) {
    return null
  }

  const panelClasses = [
    'live2d-control-panel',
    `live2d-control-panel--${controls.position}`,
    showSettings ? 'live2d-control-panel--expanded' : ''
  ].join(' ')

  return (
    <div className={panelClasses}>
      <div className="live2d-control-panel__header">
        {/* 主要控制按钮 */}
        <div className="live2d-control-panel__main-controls">
          {controls.showPlayPause && (
            <button
              className={`live2d-control-panel__button ${
                modelState.animating 
                  ? 'live2d-control-panel__button--pause' 
                  : 'live2d-control-panel__button--play'
              }`}
              onClick={modelState.animating ? onStopAnimation : handlePlayRandomAnimation}
              disabled={!modelState.loaded}
              title={modelState.animating ? '暂停' : '播放'}
            >
              {modelState.animating ? '⏸️' : '▶️'}
            </button>
          )}

          {controls.showZoomControls && (
            <>
              <button
                className="live2d-control-panel__button"
                onClick={onResetTransform}
                disabled={!modelState.loaded}
                title="重置缩放"
              >
                🔄
              </button>
            </>
          )}

          {controls.showFullscreen && (
            <button
              className="live2d-control-panel__button"
              onClick={onToggleFullscreen}
              title="全屏"
            >
              ⛶
            </button>
          )}

          {controls.showSettings && (
            <button
              className={`live2d-control-panel__button ${
                showSettings ? 'live2d-control-panel__button--active' : ''
              }`}
              onClick={() => setShowSettings(!showSettings)}
              title="设置"
            >
              ⚙️
            </button>
          )}
        </div>
      </div>

      {/* 详细控制面板 */}
      {showSettings && (
        <div className="live2d-control-panel__content">
          {/* 标签页导航 */}
          <div className="live2d-control-panel__tabs">
            {(controls.showAnimationSelector || availableAnimations.length > 0) && (
              <button
                className={`live2d-control-panel__tab ${
                  activeTab === 'animations' ? 'live2d-control-panel__tab--active' : ''
                }`}
                onClick={() => setActiveTab('animations')}
              >
                动画
              </button>
            )}

            {(controls.showExpressionSelector || expressionCount > 0) && (
              <button
                className={`live2d-control-panel__tab ${
                  activeTab === 'expressions' ? 'live2d-control-panel__tab--active' : ''
                }`}
                onClick={() => setActiveTab('expressions')}
              >
                表情
              </button>
            )}

            <button
              className={`live2d-control-panel__tab ${
                activeTab === 'settings' ? 'live2d-control-panel__tab--active' : ''
              }`}
              onClick={() => setActiveTab('settings')}
            >
              设置
            </button>
          </div>

          {/* 标签页内容 */}
          <div className="live2d-control-panel__tab-content">
            {activeTab === 'animations' && renderAnimationsTab()}
            {activeTab === 'expressions' && renderExpressionsTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </div>
        </div>
      )}
    </div>
  )
}

export default Live2DControlPanel

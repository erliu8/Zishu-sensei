/**
 * Live2D查看器React组件
 * 
 * 提供完整的Live2D模型查看和交互功能
 * 支持模型加载、动画播放、用户交互等
 */

import React, { 
  useRef, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo,
  forwardRef,
  useImperativeHandle 
} from 'react'
import {
  Live2DViewerProps,
  Live2DViewerConfig,
  Live2DLoadState,
  Live2DViewerEvent,
  Live2DAnimationConfig,
  Live2DRenderConfig,
  Live2DViewerControls,
  LIVE2D_DEFAULTS,
  UseLive2DViewerReturn
} from '@/types/live2d'
import type { Live2DService } from '@/services/live2d'
import { Live2DControlPanel } from './Live2DControlPanel'
import { Live2DLoadingIndicator } from './Live2DLoadingIndicator'
import { useLive2DViewer } from '@/hooks/useLive2DViewer'
import { printWebGLDiagnostics, checkTauriWebGLIssues } from '@/utils/webgl-diagnostics'
import './Live2DViewer.css'

/**
 * Live2D查看器组件引用接口
 */
export interface Live2DViewerRef extends UseLive2DViewerReturn {
  /** 获取画布元素 */
  getCanvas: () => HTMLCanvasElement | null
  /** 获取Live2D服务实例 */
  getService: () => Live2DService | null
  /** 截图功能 */
  takeScreenshot: (format?: 'png' | 'jpeg', quality?: number) => string | null
  /** 进入/退出全屏 */
  toggleFullscreen: () => void
}

/**
 * Live2D查看器主组件
 */
export const Live2DViewer = forwardRef<Live2DViewerRef, Live2DViewerProps>(({ 
  config,
  modelConfig,
  renderConfig,
  onEvent: emitEvent,
  onModelLoad: _onModelLoad,
  onAnimationPlay,
  onInteraction: _onInteraction,
  onError,
  children,
  className = '',
  style = {}
}, ref) => {
  // ==================== Refs ====================
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialModelLoadedRef = useRef(false)

  // ==================== State ====================
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [controlsAutoHideTimer, setControlsAutoHideTimer] = useState<NodeJS.Timeout | null>(null)
  
  // 拖动状态
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragInitialPosition, setDragInitialPosition] = useState({ x: 0, y: 0 }) // 拖拽开始时的模型位置
  const [modelPosition, setModelPosition] = useState({ x: 0, y: 0 })

  // ==================== 合并配置 ====================
  const finalConfig = useMemo((): Live2DViewerConfig => ({
    canvasSize: config?.canvasSize ?? LIVE2D_DEFAULTS.CANVAS_SIZE,
    renderConfig: { ...LIVE2D_DEFAULTS.RENDER_CONFIG, ...(config?.renderConfig ?? {}) },
    controls: { ...LIVE2D_DEFAULTS.CONTROLS, ...(config?.controls ?? {}) },
    performance: { ...LIVE2D_DEFAULTS.PERFORMANCE, ...(config?.performance ?? {}) },
    enableInteraction: config?.enableInteraction ?? true,
    enableAutoIdleAnimation: config?.enableAutoIdleAnimation ?? true,
    idleAnimationInterval: config?.idleAnimationInterval ?? 10000,
    debugMode: config?.debugMode ?? false,
    responsive: config?.responsive ?? true,
  }), [config])

  const finalRenderConfig = useMemo((): Partial<Live2DRenderConfig> => ({
    ...finalConfig.renderConfig,
    ...renderConfig
  }), [finalConfig.renderConfig, renderConfig])

  // ==================== 使用自定义Hook ====================
  const viewerApi = useLive2DViewer(canvasRef as React.RefObject<HTMLCanvasElement>, finalConfig)

  const {
    isReady,
    loadState,
    modelState,
    animationInfo,
    error,
    loadModel,
    stopAnimation,
    setExpression,
    resetTransform,
    destroy
  } = viewerApi

  // ==================== 事件处理器 ====================
  
  // 交互事件由 ControlPanel 的鼠标移动触发展示控制区

  /**
   * 处理动画播放
   */
  const handleAnimationPlay = useCallback((config: Live2DAnimationConfig) => {
    onAnimationPlay?.(config)
    ;(emitEvent as any)?.(Live2DViewerEvent.ANIMATION_START, { animationConfig: config })
  }, [onAnimationPlay, emitEvent])

  /**
   * 处理错误
   */
  const handleError = useCallback((error: Error) => {
    console.error('Live2D Viewer Error:', error)
    onError?.(error)
    ;(emitEvent as any)?.(Live2DViewerEvent.MODEL_LOAD_ERROR, { error })
  }, [onError, emitEvent])

  // ==================== 控制面板自动隐藏 ====================

  /**
   * 重置控制面板自动隐藏计时器
   */
  const resetControlsAutoHide = useCallback(() => {
    if (controlsAutoHideTimer) {
      clearTimeout(controlsAutoHideTimer)
    }

    if (finalConfig.controls?.autoHide) {
      const timer = setTimeout(() => {
        setShowControls(false)
      }, finalConfig.controls.autoHideDelay || 3000)
      
      setControlsAutoHideTimer(timer)
    }
  }, [controlsAutoHideTimer, finalConfig.controls])

  /**
   * 处理鼠标移动 - 显示控制面板
   */
  const handleMouseMove = useCallback(() => {
    if (finalConfig.controls?.autoHide && !showControls) {
      setShowControls(true)
    }
    resetControlsAutoHide()
  }, [finalConfig.controls?.autoHide, showControls, resetControlsAutoHide])

  // ==================== 全屏功能 ====================

  /**
   * 切换全屏模式
   */
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        // 进入全屏
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen()
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen()
        }
      } else {
        // 退出全屏
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen()
        }
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }, [isFullscreen])

  /**
   * 监听全屏状态变化
   */
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    )
    setIsFullscreen(isCurrentlyFullscreen)
  }, [])

  // ==================== 截图功能 ====================

  /**
   * 截取画布内容
   */
  const takeScreenshot = useCallback((format: 'png' | 'jpeg' = 'png', quality: number = 1.0): string | null => {
    if (!canvasRef.current) return null

    try {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
      return canvasRef.current.toDataURL(mimeType, quality)
    } catch (error) {
      console.error('Failed to take screenshot:', error)
      return null
    }
  }, [])

  // ==================== 生命周期 ====================

  // 取消标志
  const cancelledRef = useRef(false)

  /**
   * 组件初始化
   */
  useEffect(() => {
    // 重置取消标志
    cancelledRef.current = false
    if (!canvasRef.current) return

    // 执行WebGL诊断
    printWebGLDiagnostics()
    
    const tauriIssues = checkTauriWebGLIssues()
    if (tauriIssues.length > 0) {
      console.warn('⚠️ Tauri WebGL问题:', tauriIssues)
    }

    const maybeLoadInitialModel = async () => {
      try {
        if (cancelledRef.current) return
        if (isReady && modelConfig && !initialModelLoadedRef.current) {
          await loadModel(modelConfig, finalRenderConfig)
          if (cancelledRef.current) return
          initialModelLoadedRef.current = true
          
          // 🔧 [FIX] 模型加载完成后，同步模型位置到组件状态
          const transform = viewerApi.service?.getModelTransform?.(modelConfig.id)
          if (transform) {
            setModelPosition({ x: transform.x, y: transform.y })
          }
          
          ;(emitEvent as any)?.(Live2DViewerEvent.VIEWER_READY, { viewerId: 'live2d-viewer' })
        }
      } catch (error) {
        if (cancelledRef.current) return
        console.error('Failed to initialize Live2D viewer:', error)
        handleError(error as Error)
      }
    }

    maybeLoadInitialModel()

    return () => {
      // 这里只做本次 effect 的取消，不销毁服务（避免依赖变更时破坏初始化时序）
      cancelledRef.current = true
    }
  }, [isReady, modelConfig, finalRenderConfig, destroy, handleError, emitEvent, viewerApi.service])

  // ==================== Canvas状态监控和恢复 ====================
  useEffect(() => {
    if (!canvasRef.current) return

    const checkAndRecoverCanvasState = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const computedStyle = window.getComputedStyle(canvas)
      const rect = canvas.getBoundingClientRect()
      
      const canvasState = {
        timestamp: new Date().toISOString(),
        canvasExists: !!canvas,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        dimensions: {
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight
        },
        boundingRect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          visible: rect.width > 0 && rect.height > 0
        },
        webglContext: !!(canvas.getContext('webgl') || canvas.getContext('webgl2')),
        parentElement: canvas.parentElement?.tagName,
        hasParent: !!canvas.parentElement
      }
      
      // 🔧 [CRITICAL] 检查并修复Canvas问题
      let needsRecovery = false
      
      // 检查1: Canvas没有父元素（热重载问题）
      if (!canvasState.hasParent) {
        console.error('❌ [CRITICAL] Canvas失去父元素！这通常是热重载导致的')
        needsRecovery = true
      }
      
      // 检查2: Canvas尺寸为0
      if (canvasState.dimensions.clientWidth === 0 || canvasState.dimensions.clientHeight === 0) {
        console.error('❌ [CRITICAL] Canvas尺寸为0！')
        needsRecovery = true
      }
      
      // 检查3: Canvas样式丢失
      if (!canvasState.display || canvasState.display === '') {
        console.error('❌ [CRITICAL] Canvas样式丢失！')
        needsRecovery = true
      }
      
      // 执行恢复操作
      if (needsRecovery) {
        // 🔧 [CRITICAL FIX] 强制清理旧的Canvas状态
        try {
          // 清理可能存在的WebGL上下文
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context')
            if (loseContext) {
              loseContext.loseContext()
            }
          }
        } catch (error) {
          console.warn('⚠️ [RECOVERY] 清理WebGL上下文时出现警告:', error)
        }
        
        // 🔧 [CRITICAL FIX] 创建全新的Canvas元素
        const newCanvas = document.createElement('canvas')
        
        // 设置Canvas属性
        newCanvas.width = finalConfig.canvasSize.width
        newCanvas.height = finalConfig.canvasSize.height
        newCanvas.style.display = 'block'
        newCanvas.style.width = '100%'
        newCanvas.style.height = '100%'
        newCanvas.style.cursor = finalConfig.enableInteraction ? 'pointer' : 'default'
        newCanvas.style.position = 'relative'
        
        // 🔧 [CRITICAL FIX] 强制设置Canvas的内部属性
        Object.defineProperty(newCanvas, 'clientWidth', {
          get: () => finalConfig.canvasSize.width,
          configurable: true
        })
        Object.defineProperty(newCanvas, 'clientHeight', {
          get: () => finalConfig.canvasSize.height,
          configurable: true
        })
        
        // 替换Canvas元素
        if (containerRef.current) {
          try {
            // 移除旧Canvas
            if (canvas.parentNode) {
              canvas.parentNode.removeChild(canvas)
            }

            // 添加新Canvas
            containerRef.current.appendChild(newCanvas)

            // 同步 React ref 指向的新 canvas
            ;(canvasRef as any).current = newCanvas

            // 更新服务中的Canvas引用（尽量少做，服务会在全局事件中自我重建）
            const serviceRef = (viewerApi as any).serviceRef
            if (serviceRef?.current) {
              try { (serviceRef.current as any).canvas = newCanvas } catch {}
              if ((serviceRef.current as any).loader) {
                try { (serviceRef.current as any).loader.canvas = newCanvas } catch {}
              }
            }

            // 向全局派发 Canvas 恢复事件，交由 Hook 统一处理重建
            window.dispatchEvent(new Event('live2d-canvas-recovered'))
          } catch (error) {
            console.error('❌ Canvas元素替换失败:', error)
          }
        }
        
        // 🔧 [CRITICAL] 重置模型加载状态，确保热重载后能重新加载模型
        initialModelLoadedRef.current = false
        
        // 重新检查状态并触发服务重新初始化
        setTimeout(() => {
          // 🔧 [CRITICAL] 触发服务重新检查和初始化
          if (canvasRef.current) {
            // 兼容旧的组件内事件（保留）
            const event = new CustomEvent('canvas-recovered')
            canvasRef.current.dispatchEvent(event)
          }
        }, 100)
      }
    }

    // 立即检查一次
    checkAndRecoverCanvasState()
    
    // 设置定期检查 - 减少频率避免控制台噪音
    const interval = setInterval(checkAndRecoverCanvasState, 30000) // 每30秒检查一次
    
    return () => {
      clearInterval(interval)
    }
  }, [canvasRef.current, containerRef.current, finalConfig.canvasSize, finalConfig.enableInteraction])

  // 独立的卸载清理：仅在组件真正卸载时销毁服务
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      initialModelLoadedRef.current = false
      destroy()
    }
  }, [destroy])

  /**
   * 设置全屏事件监听
   */
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [handleFullscreenChange])

  /**
   * 清理自动隐藏计时器
   */
  useEffect(() => {
    return () => {
      if (controlsAutoHideTimer) {
        clearTimeout(controlsAutoHideTimer)
      }
    }
  }, [controlsAutoHideTimer])

  /**
   * 初始化模型位置 - 当模型加载完成时
   */
  useEffect(() => {
    if (modelState.loaded && viewerApi.isReady && viewerApi.getCurrentModel && viewerApi.service) {
      const currentModel = viewerApi.getCurrentModel()
      if (currentModel && currentModel.config?.id) {
        const transform = viewerApi.service.getModelTransform(currentModel.config.id)
        if (transform) {
          setModelPosition({ x: transform.x, y: transform.y })
        }
      }
    }
  }, [modelState.loaded, viewerApi.isReady])

  // ==================== 拖动和缩放事件处理 ====================
  
  /**
   * 鼠标按下 - 开始拖动
   */
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    console.log('🖱️ [DRAG] 鼠标按下:', { button: event.button, clientX: event.clientX, clientY: event.clientY })
    
    // 🔧 [FIX] 只处理左键，右键和中键直接忽略（不阻止默认行为，让右键菜单正常显示）
    if (event.button !== 0) {
      console.log('🖱️ [DRAG] 忽略非左键事件，button =', event.button)
      return
    }
    
    console.log('🖱️ [DRAG] 开始拖拽，当前模型位置:', modelPosition)
    setIsDragging(true)
    setDragStart({ x: event.clientX, y: event.clientY })
    setDragInitialPosition({ x: modelPosition.x, y: modelPosition.y }) // 保存开始拖拽时的模型位置
    event.preventDefault()
    event.stopPropagation() // 阻止事件冒泡，避免触发点击
  }, [modelPosition])

  /**
   * 鼠标移动 - 拖动中
   */
  const handleMouseMoveForDrag = useCallback((event: React.MouseEvent) => {
    if (!isDragging) {
      return
    }
    
    if (!viewerApi.isReady) return

    // 🔧 [FIX] 使用拖拽开始时的初始位置 + 累积偏移量，而不是每次基于当前位置累加
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y

    // 获取当前模型
    const currentModel = viewerApi.getCurrentModel?.()
    if (!currentModel) return

    const service = (viewerApi as any).service
    if (!service) return

    // 获取模型ID
    const modelId = currentModel.config?.id
    if (!modelId) return

    // 🔧 [FIX] 基于拖拽开始时的初始位置计算新位置
    const newX = dragInitialPosition.x + dx
    const newY = dragInitialPosition.y + dy
    
    service.updateModelPosition(modelId, newX, newY)
    setModelPosition({ x: newX, y: newY })
  }, [isDragging, dragStart, dragInitialPosition, viewerApi])

  /**
   * 鼠标松开 - 结束拖动
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [isDragging])

  /**
   * 鼠标滚轮 - 缩放
   * 注意：使用 useEffect 添加原生监听器，因为 React 的 onWheel 是 passive 的
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      // 先阻止默认行为
      event.preventDefault()
      event.stopPropagation()
      
      if (!viewerApi.isReady) return
      
      const currentModel = viewerApi.getCurrentModel?.()
      if (!currentModel) return

      const service = (viewerApi as any).service
      if (!service) return

      // 获取模型ID
      const modelId = currentModel.config?.id
      if (!modelId) return

      // 获取当前缩放
      const transform = service.getModelTransform(modelId)
      if (!transform) return

      // 计算新的缩放值
      const delta = event.deltaY > 0 ? -0.1 : 0.1
      const newScale = Math.max(0.1, Math.min(5.0, transform.scale + delta))
      
      service.updateModelScale(modelId, newScale)
    }

    // 添加非 passive 的滚轮监听器到 canvas
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [viewerApi, canvasRef.current])

  // ==================== 暴露API给ref ====================
  useImperativeHandle(ref, (): Live2DViewerRef => ({
    ...viewerApi,
    getCanvas: () => canvasRef.current,
    getService: () => null,
    takeScreenshot,
    toggleFullscreen
  }), [viewerApi, takeScreenshot, toggleFullscreen])

  // ==================== 渲染样式 ====================
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: finalConfig.theme?.backgroundColor || 'transparent',
    border: 'none',
    overflow: 'visible',
    pointerEvents: 'none', // 让容器不阻止鼠标事件
    ...style
  }

  const canvasStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: isDragging ? 'grabbing' : (finalConfig.enableInteraction ? 'grab' : 'default'),
    pointerEvents: 'auto' // 确保canvas可以接收鼠标事件
  }

  // 使用窗口尺寸而不是配置中的固定尺寸
  const [canvasSize, setCanvasSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : finalConfig.canvasSize.width,
    height: typeof window !== 'undefined' ? window.innerHeight : finalConfig.canvasSize.height
  })

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const newSize = {
        width: window.innerWidth,
        height: window.innerHeight
      }
      setCanvasSize(newSize)
      
      // 通知服务Canvas尺寸变化
      if (viewerApi.isReady && (viewerApi as any).service) {
        const service = (viewerApi as any).service
        if (service.app && service.app.renderer) {
          service.app.renderer.resize(newSize.width, newSize.height)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewerApi])

  // ==================== 组件渲染 ====================
  return (
    <div
      ref={containerRef}
      className={`live2d-viewer ${isFullscreen ? 'live2d-viewer--fullscreen' : ''} ${className}`}
      style={containerStyle}
      onMouseMove={(e) => {
        handleMouseMove()
        handleMouseMoveForDrag(e)
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* 主画布 */}
      <canvas
        ref={canvasRef}
        className="live2d-viewer__canvas"
        style={canvasStyle}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={() => {
          // Canvas点击事件 - 由Live2D服务处理
        }}
        onMouseDown={(event) => {
          handleMouseDown(event)
        }}
        onMouseUp={() => {
          // 鼠标释放
        }}
        onContextMenu={() => {
          // 不阻止事件冒泡，让右键事件传播到 PetWindow，从而触发自定义菜单
          // 注意：我们不调用 event.preventDefault() 或 event.stopPropagation()
          console.log('🖱️ [CONTEXT MENU] 右键菜单事件触发，传播到父组件')
        }}
        onLoad={() => {
          // Canvas加载完成
        }}
      />

      {/* 加载指示器 */}
      {loadState !== Live2DLoadState.LOADED && loadState !== Live2DLoadState.IDLE && (
        <Live2DLoadingIndicator
          loadState={loadState}
          theme={finalConfig.theme}
          message={
            loadState === Live2DLoadState.LOADING ? '正在加载Live2D模型...' :
            loadState === Live2DLoadState.ERROR ? '模型加载失败' :
            loadState === Live2DLoadState.SWITCHING ? '正在切换模型...' : ''
          }
        />
      )}

      {/* 控制面板 */}
      {finalConfig.controls && (showControls || !finalConfig.controls.autoHide) && isReady && (
        <Live2DControlPanel
          visible={showControls}
          controls={finalConfig.controls as Live2DViewerControls}
          modelState={modelState}
          animationInfo={animationInfo}
          availableAnimations={[]} // 这里需要从服务中获取
          expressionCount={0} // 这里需要从模型中获取
          onPlayAnimation={handleAnimationPlay}
          onStopAnimation={stopAnimation}
          onSetExpression={setExpression}
          onResetTransform={resetTransform}
          onToggleFullscreen={toggleFullscreen}
          onUpdateSettings={(settings) => {
            // 更新配置的逻辑
            ;(emitEvent as any)?.(Live2DViewerEvent.CONFIG_UPDATE, { config: settings })
          }}
        />
      )}

      {/* 错误显示 */}
      {error && (
        <div className="live2d-viewer__error">
          <div className="live2d-viewer__error-content">
            <h3>加载错误</h3>
            <p>{error.message}</p>
            <button
              className="live2d-viewer__error-retry"
              onClick={() => {
                if (modelConfig) {
                  loadModel(modelConfig, finalRenderConfig)
                }
              }}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 自定义内容 */}
      {children}

      {/* 调试信息 */}
      {finalConfig.debugMode && isReady && (
        <div className="live2d-viewer__debug">
          <div className="live2d-viewer__debug-info">
            <p>Load State: {loadState}</p>
            <p>Model: {modelState.loaded ? '已加载' : '未加载'}</p>
            <p>Animation: {animationInfo?.config.type || '无'}</p>
            <p>FPS: {finalConfig.performance?.targetFPS || 60}</p>
            <p>Interactive: {modelState.interactive ? '是' : '否'}</p>
          </div>
        </div>
      )}
    </div>
  )
})

Live2DViewer.displayName = 'Live2DViewer'

export default Live2DViewer

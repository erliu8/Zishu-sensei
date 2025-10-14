/**
 * useLive2DViewer Hook
 * 
 * 提供Live2D查看器的状态管理和操作方法
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  UseLive2DViewerReturn,
  Live2DViewerConfig,
  Live2DLoadState,
  Live2DModelState,
  Live2DAnimationPlayInfo,
  Live2DAnimationConfig,
  Live2DRenderConfig,
  Live2DModelConfig
} from '@/types/live2d'
import { createLive2DService, Live2DService } from '@/services/live2d'

// 全局服务创建锁，防止多个实例同时创建
let globalServiceCreationLock = false
// 全局Live2D服务实例引用，确保同时只有一个服务存在
let globalLive2DServiceInstance: Live2DService | null = null

/**
 * Live2D查看器Hook
 */
export function useLive2DViewer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Live2DViewerConfig
): UseLive2DViewerReturn {
  // ==================== State ====================
  const [isReady, setIsReady] = useState(false)
  const [loadState, setLoadState] = useState<Live2DLoadState>(Live2DLoadState.IDLE)
  const [modelState, setModelState] = useState<Live2DModelState>({
    loaded: false,
    animating: false,
    currentAnimation: undefined,
    currentExpression: undefined,
    visible: true,
    interactive: true,
    lastUpdated: Date.now()
  })
  const [animationInfo, setAnimationInfo] = useState<Live2DAnimationPlayInfo | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // ==================== Refs ====================
  const serviceRef = useRef<Live2DService | null>(null)
  const isInitializingRef = useRef(false)

  // ==================== 服务初始化 ====================

  /**
   * 初始化Live2D服务
   */
  const initializeService = useCallback(async () => {
    console.log('🔧 initializeService 调用检查:', {
      hasCanvas: !!canvasRef.current,
      isInitializing: isInitializingRef.current,
      hasService: !!serviceRef.current,
      globalLock: globalServiceCreationLock
    })
    
    if (!canvasRef.current || isInitializingRef.current || globalServiceCreationLock) {
      console.log('❌ 跳过服务初始化 - 条件不满足')
      return
    }

    // 如果已经有全局服务实例，先清理
    if (globalLive2DServiceInstance) {
      console.log('🧹 清理已存在的全局Live2D服务实例...')
      try {
        if (globalLive2DServiceInstance.destroy) {
          globalLive2DServiceInstance.destroy()
        }
      } catch (error) {
        console.warn('⚠️ 清理全局服务实例时出现警告:', error)
      }
      globalLive2DServiceInstance = null
    }

    // 如果当前组件有服务，也清理
    if (serviceRef.current) {
      console.log('🧹 清理当前组件的Live2D服务实例...')
      try {
        if (serviceRef.current.destroy) {
          serviceRef.current.destroy()
        }
      } catch (error) {
        console.warn('⚠️ 清理当前服务实例时出现警告:', error)
      }
      serviceRef.current = null
    }

    console.log('🚀 开始创建 Live2D 服务...')
    globalServiceCreationLock = true
    isInitializingRef.current = true

    try {
      // 创建Live2D服务
      console.log('📦 创建 Live2D 服务实例...')
      const service = await createLive2DService({
        canvas: canvasRef.current,
        // 由组件层主动加载模型，避免重复加载
        defaultModel: undefined,
        defaultRenderConfig: config.renderConfig,
        enableInteraction: config.enableInteraction,
        enableAutoIdleAnimation: config.enableAutoIdleAnimation,
        idleAnimationInterval: config.idleAnimationInterval,
        debugMode: config.debugMode
      })

      console.log('✅ Live2D 服务创建成功')

      // 设置事件监听器
      console.log('🎧 设置事件监听器...')
      setupServiceEventListeners(service)

      // 初始化并启动服务
      console.log('🔧 初始化服务...')
      await service.initialize()
      console.log('▶️ 启动服务...')
      await service.start()

      // 设置全局和本地服务引用
      globalLive2DServiceInstance = service
      serviceRef.current = service
      setIsReady(true)
      setLoadState(Live2DLoadState.IDLE)
      console.log('✅ Live2D 服务初始化完成，isReady 设置为 true')

    } catch (err) {
      const error = err as Error
      console.error('❌ Live2D 服务初始化失败:', error)
      setError(error)
      setLoadState(Live2DLoadState.ERROR)
    } finally {
      isInitializingRef.current = false
      globalServiceCreationLock = false
    }
  }, [canvasRef, config])

  /**
   * 设置服务事件监听器
   */
  const setupServiceEventListeners = useCallback((service: Live2DService) => {
    console.log('🔧 [DEBUG] 设置Live2D服务事件监听器...')
    
    // 模型加载事件
    service.on('serviceInitialized', () => {
      console.log('🎉 Live2D 服务初始化事件触发')
      // Avoid marking ready before the hook's serviceRef has been assigned,
      // which can cause consumers to call APIs while the service instance is not yet set.
      if (serviceRef.current) {
        console.log('✅ 通过事件设置 isReady 为 true')
        setIsReady(true)
        setError(null)
      } else {
        console.log('⚠️ serviceRef 尚未设置，跳过 isReady 更新')
      }
    })

    service.on('serviceError', ({ error }: { error: Error }) => {
      console.error('❌ [DEBUG] 服务错误事件:', error)
      setError(error)
      setLoadState(Live2DLoadState.ERROR)
    })

    service.on('modelChanged', (payload: { modelInstance: unknown }) => {
      console.log('📦 [DEBUG] 模型变更事件触发:', payload)
      setModelState(prev => ({
        ...prev,
        loaded: true,
        lastUpdated: Date.now()
      }))
      setLoadState(Live2DLoadState.LOADED)
    })

    // 添加交互事件监听
    service.on('interaction', (data: any) => {
      console.log('🎯 [DEBUG] 服务层交互事件:', data)
    })

    service.on('modelHit', (data: any) => {
      console.log('👆 [DEBUG] 模型点击事件:', data)
    })

    service.on('modelMotion', (data: any) => {
      console.log('🎬 [DEBUG] 模型动画事件:', data)
    })

    console.log('✅ [DEBUG] 事件监听器设置完成')

    // 动画事件监听器（需要动画管理器支持）
    // service.animationManager?.on('animationStart', (data) => {
    //   setModelState(prev => ({
    //     ...prev,
    //     animating: true,
    //     currentAnimation: data.config.type
    //   }))
    //   setAnimationInfo({
    //     config: data.config,
    //     state: Live2DAnimationState.PLAYING,
    //     startTime: Date.now(),
    //     playedCount: 0,
    //     remainingCount: data.config.repeatCount || 1,
    //     interruptible: true,
    //     progress: 0
    //   })
    // })

    // service.animationManager?.on('animationComplete', () => {
    //   setModelState(prev => ({
    //     ...prev,
    //     animating: false,
    //     currentAnimation: undefined
    //   }))
    //   setAnimationInfo(null)
    // })

  }, [])

  // ==================== 操作方法 ====================

  /**
   * 等待服务就绪（处理严格模式下的初始化时序）
   */
  const waitForServiceReady = useCallback(async (timeoutMs: number = 3000) => {
    const start = performance.now()
    // 快速路径
    if (serviceRef.current) return

    while (performance.now() - start < timeoutMs) {
      if (serviceRef.current) return
      await new Promise(resolve => setTimeout(resolve, 16))
    }
    throw new Error('Service not initialized')
  }, [])

  /**
   * 加载模型
   */
  const loadModel = useCallback(async (
    modelConfig: Live2DModelConfig,
    renderConfig?: Partial<Live2DRenderConfig>
  ) => {
    if (!serviceRef.current) {
      await waitForServiceReady()
    }

    try {
      setLoadState(Live2DLoadState.LOADING)
      setError(null)

      await serviceRef.current!.loadModel(modelConfig, renderConfig)

      // 启用交互/空闲动画等由服务自身处理
      setModelState(prev => ({
        ...prev,
        loaded: true,
        lastUpdated: Date.now()
      }))
      setLoadState(Live2DLoadState.LOADED)

    } catch (err) {
      const error = err as Error
      setError(error)
      setLoadState(Live2DLoadState.ERROR)
      throw error
    }
  }, [])

  /**
   * 播放动画
   */
  const playAnimation = useCallback(async (animationConfig: Live2DAnimationConfig) => {
    if (!serviceRef.current) {
      await waitForServiceReady()
    }

    if (!modelState.loaded) {
      throw new Error('No model loaded')
    }

    try {
      // 类型层面兼容服务侧动画配置
      await (serviceRef.current as any)!.playAnimation(animationConfig as any)

      setModelState(prev => ({
        ...prev,
        animating: true,
        currentAnimation: animationConfig.type,
        lastUpdated: Date.now()
      }))

    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    }
  }, [modelState.loaded])

  /**
   * 停止动画
   */
  const stopAnimation = useCallback(() => {
    if (!serviceRef.current) return

    serviceRef.current.stopAnimation()

    setModelState(prev => ({
      ...prev,
      animating: false,
      currentAnimation: undefined,
      lastUpdated: Date.now()
    }))
    setAnimationInfo(null)
  }, [])

  /**
   * 设置表情
   */
  const setExpression = useCallback(async (index: number) => {
    if (!serviceRef.current) {
      await waitForServiceReady()
    }

    if (!modelState.loaded) {
      throw new Error('No model loaded')
    }

    try {
      await serviceRef.current!.setExpression(index)

      setModelState(prev => ({
        ...prev,
        currentExpression: index,
        lastUpdated: Date.now()
      }))

    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    }
  }, [modelState.loaded])

  /**
   * 更新渲染配置
   */
  const updateRenderConfig = useCallback((newConfig: Partial<Live2DRenderConfig>) => {
    if (!serviceRef.current) return

    const currentModel = serviceRef.current.getCurrentModel()
    if (currentModel) {
      serviceRef.current.updateRenderConfig(newConfig)

      setModelState(prev => ({
        ...prev,
        lastUpdated: Date.now()
      }))
    }
  }, [])

  /**
   * 重置变换（位置和缩放）
   */
  const resetTransform = useCallback(() => {
    if (!serviceRef.current) return

    const currentModel = serviceRef.current.getCurrentModel()
    if (currentModel) {
      serviceRef.current.updateRenderConfig({
        scale: 1.0,
        position: { x: 0, y: 0 }
      })

      setModelState(prev => ({
        ...prev,
        lastUpdated: Date.now()
      }))
    }
  }, [])

  /**
   * 销毁查看器
   */
  const destroy = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.destroy()
      serviceRef.current = null
    }

    setIsReady(false)
    setLoadState(Live2DLoadState.IDLE)
    setModelState({
      loaded: false,
      animating: false,
      currentAnimation: undefined,
      currentExpression: undefined,
      visible: true,
      interactive: true,
      lastUpdated: Date.now()
    })
    setAnimationInfo(null)
    setError(null)
  }, [])

  // ==================== 生命周期 ====================

  /**
   * 初始化效果 - 支持热重载恢复
   */
  useEffect(() => {
    console.log('🔧 useLive2DViewer 服务初始化检查:', {
      hasCanvas: !!canvasRef.current,
      hasService: !!serviceRef.current,
      isInitializing: isInitializingRef.current,
      isReady,
      canvasParent: canvasRef.current?.parentElement?.tagName,
      canvasSize: canvasRef.current ? {
        width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight
      } : null
    })
    
    // 检查Canvas是否可用（有父元素且有尺寸）
    const isCanvasReady = canvasRef.current && 
                         canvasRef.current.parentElement && 
                         (canvasRef.current.clientWidth > 0 || canvasRef.current.clientHeight > 0)
    
    // 检查是否需要重新初始化服务（热重载恢复）
    const needsServiceInit = isCanvasReady && 
                            !serviceRef.current && 
                            !isInitializingRef.current
    
    // 检查服务是否需要恢复（服务存在但isReady为false，可能是热重载导致）
    const needsServiceRecovery = serviceRef.current && !isReady && !isInitializingRef.current
    
    // 🔧 [CRITICAL] 检查服务是否在Canvas恢复后需要重新初始化
    // 这种情况发生在：Canvas被恢复但服务已被清理的热重载场景
    const needsServiceReinit = isCanvasReady && 
                              !serviceRef.current && 
                              !isInitializingRef.current && 
                              !isReady
    
    if (needsServiceInit || needsServiceReinit) {
      console.log('🚀 开始初始化 Live2D 服务...', {
        reason: needsServiceInit ? 'initial' : 'reinit_after_hmr'
      })
      initializeService()
    } else if (needsServiceRecovery) {
      console.log('🔄 [RECOVERY] 恢复Live2D服务状态...')
      // 重新设置isReady状态
      setIsReady(true)
      console.log('✅ [RECOVERY] Live2D服务状态已恢复')
    } else {
      console.log('⏸️ 跳过服务初始化:', {
        hasCanvas: !!canvasRef.current,
        isCanvasReady,
        hasService: !!serviceRef.current,
        isInitializing: isInitializingRef.current,
        isReady,
        needsInit: needsServiceInit,
        needsRecovery: needsServiceRecovery,
        needsReinit: needsServiceReinit
      })
    }

    return () => {
      // 🔧 [CRITICAL] 只在真正卸载时清理，避免热重载时误清理
      // 使用延迟检查来区分热重载和真正的卸载
      const timeoutId = setTimeout(() => {
        // 如果Canvas仍然存在且有父元素，说明是热重载，不应该清理服务
        if (canvasRef.current && canvasRef.current.parentElement) {
          console.log('🔄 [HMR] 检测到热重载，保留Live2D服务')
          return
        }
        
        // 真正的组件卸载，执行清理
        if (serviceRef.current) {
          console.log('🧹 清理Live2D服务...')
          serviceRef.current.destroy()
          serviceRef.current = null
          setIsReady(false)
        }
        // 确保释放全局锁和全局服务实例
        globalServiceCreationLock = false
        if (globalLive2DServiceInstance === serviceRef.current) {
          globalLive2DServiceInstance = null
        }
      }, 100) // 100ms延迟检查
      
      // 清理延迟检查的timeout
      clearTimeout(timeoutId)
    }
  }, [canvasRef.current, isReady]) // 添加isReady依赖以支持恢复检测

  /**
   * Canvas恢复事件监听 - 处理热重载后的服务重新初始化
   */
  useEffect(() => {
    if (!canvasRef.current) return

    const handleCanvasRecovered = () => {
      console.log('🎧 [RECOVERY] 收到Canvas恢复事件，重新检查服务状态...')
      
      // 强制重新检查服务初始化条件
      const isCanvasReady = canvasRef.current && 
                           canvasRef.current.parentElement && 
                           (canvasRef.current.clientWidth > 0 || canvasRef.current.clientHeight > 0)
      
      if (isCanvasReady && !serviceRef.current && !isInitializingRef.current) {
        console.log('🚀 [RECOVERY] Canvas恢复后重新初始化Live2D服务...')
        initializeService()
      } else if (isCanvasReady && serviceRef.current && isReady) {
        // 🔧 [CRITICAL] 如果服务已存在且就绪，直接触发模型重新加载检查
        console.log('🔄 [RECOVERY] 服务已就绪，触发模型重新加载检查...')
        // 通过更新isReady状态来触发Live2DViewer的useEffect
        setIsReady(false)
        setTimeout(() => {
          setIsReady(true)
        }, 100)
      } else {
        console.log('⏸️ [RECOVERY] 服务状态检查:', {
          isCanvasReady,
          hasService: !!serviceRef.current,
          isInitializing: isInitializingRef.current,
          isReady
        })
      }
    }

    const canvas = canvasRef.current
    canvas.addEventListener('canvas-recovered', handleCanvasRecovered)
    
    return () => {
      canvas.removeEventListener('canvas-recovered', handleCanvasRecovered)
    }
  }, [canvasRef.current, initializeService])

  /**
   * 全局 Canvas 恢复事件监听（更稳健，避免旧 Canvas 引用问题）
   */
  useEffect(() => {
    const handleGlobalCanvasRecovered = () => {
      console.log('🎧 [RECOVERY] 收到全局 Canvas 恢复事件，准备重建服务...')

      // 避免并发初始化
      if (isInitializingRef.current || globalServiceCreationLock) {
        console.log('⏸️ [RECOVERY] 正在初始化或被全局锁阻塞，跳过此次重建')
        return
      }

      // 校验 Canvas 是否可用
      const canvas = canvasRef.current
      const isCanvasReady = !!(canvas && canvas.parentElement && (canvas.clientWidth > 0 || canvas.clientHeight > 0))
      console.log('🔧 [RECOVERY] 全局事件 Canvas 状态:', { isCanvasReady, hasCanvas: !!canvas, parent: canvas?.parentElement?.tagName, size: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null })

      if (!isCanvasReady) {
        console.log('⏸️ [RECOVERY] Canvas 未就绪，略过重建')
        return
      }

      try {
        // 先销毁旧服务
        if (serviceRef.current) {
          try { serviceRef.current.destroy() } catch (e) { console.warn('⚠️ [RECOVERY] 销毁旧服务警告:', e) }
          serviceRef.current = null
        }

        // 重置状态
        setIsReady(false)
        setLoadState(Live2DLoadState.IDLE)
        setModelState({
          loaded: false,
          animating: false,
          currentAnimation: undefined,
          currentExpression: undefined,
          visible: true,
          interactive: true,
          lastUpdated: Date.now()
        })
        setAnimationInfo(null)
        setError(null)

        // 重新初始化服务
        console.log('🚀 [RECOVERY] 开始重建 Live2D 服务...')
        initializeService()
      } catch (err) {
        console.error('❌ [RECOVERY] 重建服务失败:', err)
      }
    }

    window.addEventListener('live2d-canvas-recovered', handleGlobalCanvasRecovered)
    return () => {
      window.removeEventListener('live2d-canvas-recovered', handleGlobalCanvasRecovered)
    }
  }, [initializeService])

  /**
   * 配置变化效果
   */
  useEffect(() => {
    if (serviceRef.current && config.renderConfig) {
      updateRenderConfig(config.renderConfig)
    }
  }, [config.renderConfig, updateRenderConfig])

  // ==================== 返回API ====================
  return {
    isReady,
    loadState,
    modelState,
    animationInfo,
    error,
    loadModel,
    playAnimation,
    stopAnimation,
    setExpression,
    updateRenderConfig,
    resetTransform,
    destroy,
    getCurrentModel: useCallback(() => serviceRef.current?.getCurrentModel() || null, []),
    service: serviceRef.current
  }
}

export default useLive2DViewer

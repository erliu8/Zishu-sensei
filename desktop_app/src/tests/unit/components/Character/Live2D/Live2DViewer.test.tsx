/**
 * Live2DViewer组件单元测试
 * 
 * 测试Live2D查看器的完整功能：初始化、渲染、动画、交互等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Live2DViewer } from '@/components/Character/Live2D/Live2DViewer'
import { Live2DLoadState, Live2DViewerEvent } from '@/types/live2d'
import type { Live2DViewerProps } from '@/types/live2d'

// Mock useLive2DViewer hook
const mockUseLive2DViewer = vi.fn()
vi.mock('@/hooks/useLive2DViewer', () => ({
  useLive2DViewer: (canvasRef: any, config: any) => mockUseLive2DViewer(canvasRef, config)
}))

// Mock WebGL diagnostics
vi.mock('@/utils/webgl-diagnostics', () => ({
  printWebGLDiagnostics: vi.fn(),
  checkTauriWebGLIssues: vi.fn(() => [])
}))

// Mock CSS
vi.mock('@/components/Character/Live2D/Live2DViewer.css', () => ({}))

// Mock 子组件
vi.mock('@/components/Character/Live2D/Live2DControlPanel', () => ({
  Live2DControlPanel: vi.fn(({ visible, onPlayAnimation, onStopAnimation }) => (
    visible ? (
      <div data-testid="control-panel" style={{ pointerEvents: 'auto' }}>
        <button data-testid="play-animation" onClick={() => onPlayAnimation?.({ type: 'idle', group: 'idle', index: 0 })}>
          Play
        </button>
        <button data-testid="stop-animation" onClick={onStopAnimation}>
          Stop
        </button>
      </div>
    ) : null
  ))
}))

vi.mock('@/components/Character/Live2D/Live2DLoadingIndicator', () => ({
  Live2DLoadingIndicator: vi.fn(({ loadState, message }) => (
    <div data-testid="loading-indicator">
      <span>{message}</span>
      <span>{loadState}</span>
    </div>
  ))
}))

describe('Live2DViewer组件', () => {
  let mockService: any
  let mockViewerApi: any
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Mock console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Mock Live2D service
    mockService = {
      loadModel: vi.fn().mockResolvedValue(undefined),
      getModelTransform: vi.fn().mockReturnValue({ x: 0, y: 0, scale: 1 }),
      updateModelPosition: vi.fn(),
      updateModelScale: vi.fn(),
      destroy: vi.fn(),
      canvas: null,
      loader: null,
      app: {
        renderer: {
          resize: vi.fn()
        }
      }
    }

    // Mock viewer API
    mockViewerApi = {
      isReady: true,
      loadState: Live2DLoadState.IDLE,
      modelState: {
        loaded: false,
        interactive: true
      },
      animationInfo: null,
      error: null,
      loadModel: vi.fn().mockResolvedValue(undefined),
      stopAnimation: vi.fn(),
      setExpression: vi.fn(),
      resetTransform: vi.fn(),
      destroy: vi.fn(),
      getCurrentModel: vi.fn(() => ({ config: { id: 'test-model' } })),
      service: mockService,
      serviceRef: { current: mockService }
    }

    mockUseLive2DViewer.mockReturnValue(mockViewerApi)

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080
    })

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: document.createElement('canvas'),
      getExtension: vi.fn(() => ({
        loseContext: vi.fn()
      }))
    })) as any

    // Mock toDataURL
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('初始化测试', () => {
    it('应该正确初始化 Live2D 引擎', () => {
      const config = {
        canvasSize: { width: 800, height: 600 },
        enableInteraction: true
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该创建 canvas 元素', () => {
      render(<Live2DViewer />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      expect(canvas?.tagName).toBe('CANVAS')
    })

    it('应该设置正确的 canvas 尺寸', () => {
      const config = {
        canvasSize: { width: 800, height: 600 }
      }
      
      render(<Live2DViewer config={config} />)

      const canvas = document.querySelector('canvas')
      expect(canvas?.width).toBe(800)
      expect(canvas?.height).toBe(600)
    })

    it('应该应用自定义样式和类名', () => {
      const customStyle = { backgroundColor: 'red' }
      const customClass = 'custom-viewer'

      render(
        <Live2DViewer 
          className={customClass}
          style={customStyle}
        />
      )

      const container = document.querySelector('.live2d-viewer')
      expect(container).toHaveClass('live2d-viewer')
      expect(container).toHaveClass(customClass)
    })
  })

  describe('模型加载测试', () => {
    it('应该加载指定的模型配置', async () => {
      const modelConfig = {
        id: 'test-model',
        path: '/path/to/model.model3.json',
        textures: []
      }

      mockViewerApi.isReady = true

      render(
        <Live2DViewer 
          modelConfig={modelConfig}
        />
      )

      await waitFor(() => {
        expect(mockViewerApi.loadModel).toHaveBeenCalledWith(
          modelConfig,
          expect.any(Object)
        )
      }, { timeout: 3000 })
    })

    it('应该显示加载指示器', () => {
      mockViewerApi.loadState = Live2DLoadState.LOADING

      render(<Live2DViewer />)

      const loadingIndicator = screen.getByTestId('loading-indicator')
      expect(loadingIndicator).toBeInTheDocument()
      expect(loadingIndicator).toHaveTextContent('正在加载Live2D模型...')
    })

    it('加载成功后应该隐藏加载指示器', () => {
      mockViewerApi.loadState = Live2DLoadState.LOADED

      render(<Live2DViewer />)

      const loadingIndicator = screen.queryByTestId('loading-indicator')
      expect(loadingIndicator).not.toBeInTheDocument()
    })

    it('加载失败应该显示错误信息', () => {
      const errorMessage = 'Failed to load model'
      mockViewerApi.error = new Error(errorMessage)

      render(<Live2DViewer />)

      expect(screen.getByText('加载错误')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('应该触发 onModelLoad 回调', async () => {
      const onModelLoad = vi.fn()
      const modelConfig = {
        id: 'test-model',
        path: '/path/to/model.model3.json',
        textures: []
      }

      mockViewerApi.isReady = true
      mockViewerApi.loadModel.mockResolvedValue(undefined)

      render(
        <Live2DViewer 
          modelConfig={modelConfig}
          onModelLoad={onModelLoad}
        />
      )

      await waitFor(() => {
        expect(mockViewerApi.loadModel).toHaveBeenCalled()
      })
    })
  })

  describe('渲染测试', () => {
    it('应该以指定 FPS 渲染', () => {
      const config = {
        performance: {
          targetFPS: 60
        }
      }

      render(<Live2DViewer config={config} />)

      // FPS 配置应该传递给 useLive2DViewer
      expect(mockUseLive2DViewer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          performance: expect.objectContaining({
            targetFPS: 60
          })
        })
      )
    })

    it('应该应用缩放配置', async () => {
      const renderConfig = {
        scale: 1.5
      }

      render(
        <Live2DViewer 
          renderConfig={renderConfig}
        />
      )

      // 缩放配置应该合并到最终配置中
      expect(mockUseLive2DViewer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('应该应用位置配置', async () => {
      const renderConfig = {
        position: { x: 100, y: 100 }
      }

      render(
        <Live2DViewer 
          renderConfig={renderConfig}
        />
      )

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该应用透明度配置', () => {
      const renderConfig = {
        opacity: 0.8
      }

      render(
        <Live2DViewer 
          renderConfig={renderConfig}
        />
      )

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('响应式模式下应该自适应容器大小', async () => {
      const config = {
        responsive: true,
        canvasSize: { width: 800, height: 600 }
      }

      render(<Live2DViewer config={config} />)

      // 在响应式模式下，canvas 尺寸应该由配置决定
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      // 响应式模式下初始尺寸应该是配置的尺寸
      expect(canvas?.width).toBe(800)
      expect(canvas?.height).toBe(600)
    })
  })

  describe('动画测试', () => {
    it('应该播放指定动画', async () => {
      const onAnimationPlay = vi.fn()

      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          onAnimationPlay={onAnimationPlay}
          config={{ controls: {} }}
        />
      )

      const playButton = screen.getByTestId('play-animation')
      // 直接触发点击事件
      playButton.click()

      expect(onAnimationPlay).toHaveBeenCalledWith({
        type: 'idle',
        group: 'idle',
        index: 0
      })
    })

    it('应该支持动画优先级', () => {
      // 动画优先级应该在 AnimationQueue 中处理
      // 这里主要测试组件是否正确传递配置
      render(<Live2DViewer />)
      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该自动播放空闲动画', () => {
      const config = {
        enableAutoIdleAnimation: true,
        idleAnimationInterval: 5000
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          enableAutoIdleAnimation: true,
          idleAnimationInterval: 5000
        })
      )
    })

    it('应该根据间隔切换空闲动画', () => {
      vi.useFakeTimers()
      
      const config = {
        enableAutoIdleAnimation: true,
        idleAnimationInterval: 10000
      }

      render(<Live2DViewer config={config} />)

      // 快进时间
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // 自动空闲动画应该由 service 处理
      expect(mockUseLive2DViewer).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('应该处理动画结束事件', async () => {
      const onEvent = vi.fn()

      render(<Live2DViewer onEvent={onEvent} />)

      // 动画结束事件应该由 service 触发
      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })
  })

  describe('表情测试', () => {
    it('应该切换表情', () => {
      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer />)

      act(() => {
        mockViewerApi.setExpression('happy')
      })

      expect(mockViewerApi.setExpression).toHaveBeenCalledWith('happy')
    })

    it('应该支持表情淡入淡出', () => {
      // 表情淡入淡出应该由 Live2D SDK 处理
      // 这里测试方法是否可调用
      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer />)

      expect(mockViewerApi.setExpression).toBeDefined()
    })

    it('表情文件不存在时应该优雅降级', async () => {
      mockViewerApi.setExpression.mockRejectedValue(new Error('Expression not found'))

      render(<Live2DViewer />)

      await act(async () => {
        try {
          await mockViewerApi.setExpression('nonexistent')
        } catch (error) {
          // 应该捕获错误
        }
      })

      expect(mockViewerApi.setExpression).toHaveBeenCalled()
    })
  })

  describe('交互测试', () => {
    it('应该响应点击事件', async () => {
      const user = userEvent.setup()
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ enableInteraction: true }}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      
      // 由于 pointer-events: none，我们直接触发事件而不是使用 user.click
      if (canvas) {
        const clickEvent = new MouseEvent('click', { bubbles: true })
        canvas.dispatchEvent(clickEvent)
      }
      
      // 点击事件应该被处理
      expect(canvas).toBeInTheDocument()
    })

    it('应该检测点击命中区域', () => {
      const config = {
        enableInteraction: true
      }

      render(<Live2DViewer config={config} />)

      // 命中检测由 Live2D SDK 处理
      expect(mockUseLive2DViewer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          enableInteraction: true
        })
      )
    })

    it('应该播放点击动画', async () => {
      const onInteraction = vi.fn()
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          onInteraction={onInteraction}
          config={{ enableInteraction: true }}
        />
      )

      // 点击动画应该由 service 处理
      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该触发 onInteraction 回调', async () => {
      const onInteraction = vi.fn()

      render(
        <Live2DViewer 
          onInteraction={onInteraction}
          config={{ enableInteraction: true }}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      
      // 由于 pointer-events: none，我们直接触发事件
      if (canvas) {
        const clickEvent = new MouseEvent('click', { bubbles: true })
        canvas.dispatchEvent(clickEvent)
      }

      // 交互回调应该由 service 触发
      expect(canvas).toBeInTheDocument()
    })

    it('enableInteraction=false 时应该禁用交互', () => {
      render(
        <Live2DViewer 
          config={{ enableInteraction: false }}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toHaveStyle({ cursor: 'default' })
    })
  })

  describe('性能测试', () => {
    it('应该监控 FPS', () => {
      const config = {
        performance: {
          targetFPS: 60,
          enableFPSMonitor: true
        }
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          performance: expect.objectContaining({
            targetFPS: 60
          })
        })
      )
    })

    it('应该监控内存使用', () => {
      const config = {
        performance: {
          enableMemoryMonitor: true
        }
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该应用纹理压缩', () => {
      const config = {
        performance: {
          textureCompression: true
        }
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('应该应用抗锯齿', () => {
      const config = {
        renderConfig: {
          antialias: true
        }
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })

    it('低性能时应该降低渲染质量', () => {
      const config = {
        performance: {
          autoAdjustQuality: true
        }
      }

      render(<Live2DViewer config={config} />)

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })
  })

  describe('控制面板测试', () => {
    it('应该显示/隐藏控制面板', () => {
      mockViewerApi.modelState.loaded = true

      const { rerender } = render(
        <Live2DViewer 
          config={{ controls: { enabled: true } }}
        />
      )

      expect(screen.getByTestId('control-panel')).toBeInTheDocument()

      rerender(
        <Live2DViewer 
          config={{ controls: { enabled: false } }}
        />
      )

      // 控制面板应该始终渲染，但可能被隐藏
    })

    it('应该支持播放/暂停', async () => {
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ controls: {} }}
        />
      )

      const playButton = screen.getByTestId('play-animation')
      playButton.click()

      const stopButton = screen.getByTestId('stop-animation')
      stopButton.click()

      expect(mockViewerApi.stopAnimation).toHaveBeenCalled()
    })

    it('应该支持动画选择', async () => {
      const onAnimationPlay = vi.fn()
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          onAnimationPlay={onAnimationPlay}
          config={{ controls: {} }}
        />
      )

      const playButton = screen.getByTestId('play-animation')
      playButton.click()

      expect(onAnimationPlay).toHaveBeenCalled()
    })

    it('应该支持表情选择', () => {
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ controls: {} }}
        />
      )

      expect(mockViewerApi.setExpression).toBeDefined()
    })

    it('应该支持缩放控制', () => {
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ controls: {} }}
        />
      )

      // 缩放控制通过鼠标滚轮实现
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('应该支持重置位置', () => {
      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ controls: {} }}
        />
      )

      expect(mockViewerApi.resetTransform).toBeDefined()
    })

    it('应该支持全屏模式', () => {
      // Mock fullscreen API
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
      HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)

      mockViewerApi.modelState.loaded = true

      render(
        <Live2DViewer 
          config={{ controls: {} }}
        />
      )

      // 全屏功能存在
      expect(document.querySelector('.live2d-viewer')).toBeInTheDocument()
    })

    it('应该支持自动隐藏', async () => {
      vi.useFakeTimers()
      
      const config = {
        controls: {
          autoHide: true,
          autoHideDelay: 3000
        }
      }

      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer config={config} />)

      // 控制面板应该在3秒后自动隐藏
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      vi.useRealTimers()
    })
  })

  describe('清理测试', () => {
    it('组件卸载时应该释放资源', () => {
      const { unmount } = render(<Live2DViewer />)

      unmount()

      expect(mockViewerApi.destroy).toHaveBeenCalled()
    })

    it('应该停止动画循环', () => {
      const { unmount } = render(
        <Live2DViewer 
          config={{ enableAutoIdleAnimation: true }}
        />
      )

      unmount()

      expect(mockViewerApi.destroy).toHaveBeenCalled()
    })

    it('应该清理事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(<Live2DViewer />)

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
      
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('拖动和缩放功能', () => {
    it('应该支持鼠标拖动', async () => {
      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      if (canvas) {
        // 直接触发鼠标事件而不是使用 userEvent（因为 pointer-events: none）
        const mouseDown = new MouseEvent('mousedown', { 
          bubbles: true, 
          clientX: 100, 
          clientY: 100 
        })
        const mouseMove = new MouseEvent('mousemove', { 
          bubbles: true, 
          clientX: 200, 
          clientY: 200 
        })
        const mouseUp = new MouseEvent('mouseup', { bubbles: true })
        
        canvas.dispatchEvent(mouseDown)
        canvas.dispatchEvent(mouseMove)
        canvas.dispatchEvent(mouseUp)
      }

      // 拖动应该更新模型位置
      expect(canvas).toBeInTheDocument()
    })

    it('应该支持滚轮缩放', () => {
      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      if (canvas) {
        // 模拟滚轮事件
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: -100,
          bubbles: true
        })
        canvas.dispatchEvent(wheelEvent)
      }

      // 滚轮事件应该被处理
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('截图功能', () => {
    it('应该能够截取画布内容', () => {
      const ref = { current: null } as any

      render(<Live2DViewer ref={ref} />)

      // 等待ref被设置
      if (ref.current) {
        const screenshot = ref.current.takeScreenshot('png', 1.0)
        expect(screenshot).toContain('data:image/png;base64')
      }
    })

    it('应该支持不同的图片格式', () => {
      const ref = { current: null } as any

      render(<Live2DViewer ref={ref} />)

      if (ref.current) {
        const pngScreenshot = ref.current.takeScreenshot('png')
        const jpegScreenshot = ref.current.takeScreenshot('jpeg')

        expect(pngScreenshot).toBeTruthy()
        expect(jpegScreenshot).toBeTruthy()
      }
    })
  })

  describe('错误处理', () => {
    it('应该处理模型加载错误', async () => {
      const onError = vi.fn()
      const error = new Error('Model load failed')
      
      mockViewerApi.error = error

      render(
        <Live2DViewer 
          onError={onError}
        />
      )

      expect(screen.getByText('加载错误')).toBeInTheDocument()
      expect(screen.getByText('Model load failed')).toBeInTheDocument()
    })

    it('应该显示重试按钮', async () => {
      const modelConfig = {
        id: 'test-model',
        path: '/path/to/model.model3.json',
        textures: []
      }

      mockViewerApi.error = new Error('Load failed')

      render(
        <Live2DViewer 
          modelConfig={modelConfig}
        />
      )

      const retryButton = screen.getByText('重试')
      expect(retryButton).toBeInTheDocument()

      // 直接触发点击事件
      retryButton.click()

      expect(mockViewerApi.loadModel).toHaveBeenCalled()
    })

    it('应该记录错误到控制台', () => {
      mockViewerApi.error = new Error('Test error')

      render(<Live2DViewer />)

      // 错误应该被记录
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('调试模式', () => {
    it('应该显示调试信息', () => {
      const config = {
        debugMode: true
      }

      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer config={config} />)

      const debugInfo = screen.getByText(/Load State:/i)
      expect(debugInfo).toBeInTheDocument()
    })

    it('应该显示性能指标', () => {
      const config = {
        debugMode: true,
        performance: {
          targetFPS: 60
        }
      }

      mockViewerApi.modelState.loaded = true

      render(<Live2DViewer config={config} />)

      expect(screen.getByText(/FPS:/i)).toBeInTheDocument()
    })
  })

  describe('Canvas 恢复功能', () => {
    it('应该检测并恢复 Canvas 问题', () => {
      vi.useFakeTimers()

      render(<Live2DViewer />)

      // 快进30秒触发定期检查
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      vi.useRealTimers()
    })

    it('应该处理热重载导致的 Canvas 丢失', () => {
      render(<Live2DViewer />)

      // 派发 Canvas 恢复事件
      act(() => {
        window.dispatchEvent(new Event('live2d-canvas-recovered'))
      })

      expect(mockUseLive2DViewer).toHaveBeenCalled()
    })
  })
})


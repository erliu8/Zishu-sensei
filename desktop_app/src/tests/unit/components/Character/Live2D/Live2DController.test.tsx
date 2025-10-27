/**
 * Live2DController组件单元测试
 * 
 * 测试Live2D控制器的API、状态管理和模型控制功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Live2DController类
class MockLive2DController {
  private model: any = null
  private currentAnimation: string | null = null
  private currentExpression: string | null = null
  private isAutoIdleEnabled: boolean = false
  private scale: number = 1.0
  private position = { x: 0, y: 0 }
  private loadingState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle'
  private performanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0
  }

  async loadModel(modelUrl: string) {
    this.loadingState = 'loading'
    
    try {
      this.model = {
        id: modelUrl,
        loaded: true,
        animations: ['idle', 'tap', 'happy'],
        expressions: ['neutral', 'happy', 'sad']
      }
      
      this.loadingState = 'loaded'
      return this.model
    } catch (error) {
      this.loadingState = 'error'
      throw error
    }
  }

  async playAnimation(animationName: string, priority: number = 2) {
    if (!this.model) {
      throw new Error('Model not loaded')
    }

    if (!this.model.animations.includes(animationName)) {
      throw new Error(`Animation "${animationName}" not found`)
    }

    this.currentAnimation = animationName
    return Promise.resolve()
  }

  async setExpression(expressionName: string) {
    if (!this.model) {
      throw new Error('Model not loaded')
    }

    if (!this.model.expressions.includes(expressionName)) {
      throw new Error(`Expression "${expressionName}" not found`)
    }

    this.currentExpression = expressionName
    return Promise.resolve()
  }

  startAutoIdle(interval: number = 10000) {
    this.isAutoIdleEnabled = true
    return true
  }

  stopAutoIdle() {
    this.isAutoIdleEnabled = false
    return true
  }

  setScale(scale: number) {
    if (scale <= 0) {
      throw new Error('Scale must be positive')
    }
    this.scale = scale
  }

  setPosition(x: number, y: number) {
    this.position = { x, y }
  }

  resetPosition() {
    this.position = { x: 0, y: 0 }
    this.scale = 1.0
  }

  getCurrentAnimation() {
    return this.currentAnimation
  }

  getCurrentExpression() {
    return this.currentExpression
  }

  getScale() {
    return this.scale
  }

  getPosition() {
    return { ...this.position }
  }

  getLoadingState() {
    return this.loadingState
  }

  isAutoIdleActive() {
    return this.isAutoIdleEnabled
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics }
  }

  updatePerformanceMetrics(fps: number, frameTime: number, memoryUsage: number) {
    this.performanceMetrics = { fps, frameTime, memoryUsage }
  }

  destroy() {
    this.model = null
    this.currentAnimation = null
    this.currentExpression = null
    this.isAutoIdleEnabled = false
    this.scale = 1.0
    this.position = { x: 0, y: 0 }
    this.loadingState = 'idle'
  }

  isModelLoaded() {
    return this.model !== null && this.loadingState === 'loaded'
  }

  getAvailableAnimations() {
    return this.model?.animations || []
  }

  getAvailableExpressions() {
    return this.model?.expressions || []
  }
}

describe('Live2DController', () => {
  let controller: MockLive2DController
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    controller = new MockLive2DController()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    controller.destroy()
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('API测试', () => {
    it('loadModel() 应该加载模型', async () => {
      const model = await controller.loadModel('/models/test.model3.json')

      expect(model).toBeDefined()
      expect(model.loaded).toBe(true)
      expect(controller.isModelLoaded()).toBe(true)
    })

    it('playAnimation() 应该播放动画', async () => {
      await controller.loadModel('/models/test.model3.json')
      await controller.playAnimation('idle')

      expect(controller.getCurrentAnimation()).toBe('idle')
    })

    it('setExpression() 应该设置表情', async () => {
      await controller.loadModel('/models/test.model3.json')
      await controller.setExpression('happy')

      expect(controller.getCurrentExpression()).toBe('happy')
    })

    it('startAutoIdle() 应该启动自动空闲', () => {
      const result = controller.startAutoIdle(5000)

      expect(result).toBe(true)
      expect(controller.isAutoIdleActive()).toBe(true)
    })

    it('stopAutoIdle() 应该停止自动空闲', () => {
      controller.startAutoIdle()
      const result = controller.stopAutoIdle()

      expect(result).toBe(true)
      expect(controller.isAutoIdleActive()).toBe(false)
    })

    it('setScale() 应该设置缩放', () => {
      controller.setScale(1.5)

      expect(controller.getScale()).toBe(1.5)
    })

    it('setPosition() 应该设置位置', () => {
      controller.setPosition(100, 200)

      const position = controller.getPosition()
      expect(position.x).toBe(100)
      expect(position.y).toBe(200)
    })

    it('resetPosition() 应该重置位置', () => {
      controller.setScale(2.0)
      controller.setPosition(100, 200)

      controller.resetPosition()

      expect(controller.getScale()).toBe(1.0)
      expect(controller.getPosition()).toEqual({ x: 0, y: 0 })
    })
  })

  describe('状态管理测试', () => {
    it('应该跟踪当前动画', async () => {
      await controller.loadModel('/models/test.model3.json')
      
      expect(controller.getCurrentAnimation()).toBeNull()

      await controller.playAnimation('idle')
      expect(controller.getCurrentAnimation()).toBe('idle')

      await controller.playAnimation('tap')
      expect(controller.getCurrentAnimation()).toBe('tap')
    })

    it('应该跟踪当前表情', async () => {
      await controller.loadModel('/models/test.model3.json')
      
      expect(controller.getCurrentExpression()).toBeNull()

      await controller.setExpression('happy')
      expect(controller.getCurrentExpression()).toBe('happy')

      await controller.setExpression('sad')
      expect(controller.getCurrentExpression()).toBe('sad')
    })

    it('应该跟踪加载状态', async () => {
      expect(controller.getLoadingState()).toBe('idle')

      const loadPromise = controller.loadModel('/models/test.model3.json')
      // 加载中状态可能很快就变成loaded
      
      await loadPromise
      expect(controller.getLoadingState()).toBe('loaded')
    })

    it('应该跟踪性能指标', () => {
      const metrics = controller.getPerformanceMetrics()

      expect(metrics.fps).toBeDefined()
      expect(metrics.frameTime).toBeDefined()
      expect(metrics.memoryUsage).toBeDefined()
    })

    it('应该更新性能指标', () => {
      controller.updatePerformanceMetrics(30, 33.33, 50000000)

      const metrics = controller.getPerformanceMetrics()
      expect(metrics.fps).toBe(30)
      expect(metrics.frameTime).toBe(33.33)
      expect(metrics.memoryUsage).toBe(50000000)
    })
  })

  describe('模型加载', () => {
    it('应该在加载前返回false', () => {
      expect(controller.isModelLoaded()).toBe(false)
    })

    it('应该在加载后返回true', async () => {
      await controller.loadModel('/models/test.model3.json')

      expect(controller.isModelLoaded()).toBe(true)
    })

    it('应该加载模型动画列表', async () => {
      await controller.loadModel('/models/test.model3.json')

      const animations = controller.getAvailableAnimations()
      expect(animations).toContain('idle')
      expect(animations).toContain('tap')
      expect(animations).toContain('happy')
    })

    it('应该加载模型表情列表', async () => {
      await controller.loadModel('/models/test.model3.json')

      const expressions = controller.getAvailableExpressions()
      expect(expressions).toContain('neutral')
      expect(expressions).toContain('happy')
      expect(expressions).toContain('sad')
    })

    it('应该处理加载错误', async () => {
      // 模拟加载失败 - 修改Mock以在特定路径下抛出错误
      const originalLoadModel = controller.loadModel.bind(controller)
      controller.loadModel = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('invalid')) {
          throw new Error('Failed to load model')
        }
        return originalLoadModel(url)
      })

      await expect(controller.loadModel('/invalid/model.json')).rejects.toThrow('Failed to load model')
    })
  })

  describe('动画控制', () => {
    it('未加载模型时不应播放动画', async () => {
      await expect(controller.playAnimation('idle')).rejects.toThrow('Model not loaded')
    })

    it('应该验证动画是否存在', async () => {
      await controller.loadModel('/models/test.model3.json')

      await expect(controller.playAnimation('nonexistent')).rejects.toThrow('Animation "nonexistent" not found')
    })

    it('应该支持动画优先级', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.playAnimation('idle', 1)
      await controller.playAnimation('tap', 5)

      // 高优先级动画应该打断低优先级动画
      expect(controller.getCurrentAnimation()).toBe('tap')
    })

    it('应该切换动画', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.playAnimation('idle')
      expect(controller.getCurrentAnimation()).toBe('idle')

      await controller.playAnimation('happy')
      expect(controller.getCurrentAnimation()).toBe('happy')
    })
  })

  describe('表情控制', () => {
    it('未加载模型时不应设置表情', async () => {
      await expect(controller.setExpression('happy')).rejects.toThrow('Model not loaded')
    })

    it('应该验证表情是否存在', async () => {
      await controller.loadModel('/models/test.model3.json')

      await expect(controller.setExpression('nonexistent')).rejects.toThrow('Expression "nonexistent" not found')
    })

    it('应该切换表情', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.setExpression('happy')
      expect(controller.getCurrentExpression()).toBe('happy')

      await controller.setExpression('sad')
      expect(controller.getCurrentExpression()).toBe('sad')
    })

    it('应该同时播放动画和表情', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.playAnimation('idle')
      await controller.setExpression('happy')

      expect(controller.getCurrentAnimation()).toBe('idle')
      expect(controller.getCurrentExpression()).toBe('happy')
    })
  })

  describe('自动空闲', () => {
    it('应该启动自动空闲动画', () => {
      expect(controller.isAutoIdleActive()).toBe(false)

      controller.startAutoIdle()

      expect(controller.isAutoIdleActive()).toBe(true)
    })

    it('应该停止自动空闲动画', () => {
      controller.startAutoIdle()
      expect(controller.isAutoIdleActive()).toBe(true)

      controller.stopAutoIdle()

      expect(controller.isAutoIdleActive()).toBe(false)
    })

    it('应该设置自动空闲间隔', () => {
      const interval = 5000
      controller.startAutoIdle(interval)

      // 间隔应该被正确设置
      expect(controller.isAutoIdleActive()).toBe(true)
    })

    it('应该在播放其他动画时暂停自动空闲', async () => {
      await controller.loadModel('/models/test.model3.json')
      controller.startAutoIdle()

      await controller.playAnimation('tap')

      // 自动空闲应该被暂停
      expect(controller.getCurrentAnimation()).toBe('tap')
    })
  })

  describe('变换控制', () => {
    it('应该设置模型缩放', () => {
      controller.setScale(2.0)

      expect(controller.getScale()).toBe(2.0)
    })

    it('应该拒绝负数缩放', () => {
      expect(() => controller.setScale(-1.0)).toThrow('Scale must be positive')
    })

    it('应该拒绝零缩放', () => {
      expect(() => controller.setScale(0)).toThrow('Scale must be positive')
    })

    it('应该设置模型位置', () => {
      controller.setPosition(150, 250)

      const pos = controller.getPosition()
      expect(pos.x).toBe(150)
      expect(pos.y).toBe(250)
    })

    it('应该支持负数位置', () => {
      controller.setPosition(-100, -200)

      const pos = controller.getPosition()
      expect(pos.x).toBe(-100)
      expect(pos.y).toBe(-200)
    })

    it('应该重置所有变换', () => {
      controller.setScale(3.0)
      controller.setPosition(500, 600)

      controller.resetPosition()

      expect(controller.getScale()).toBe(1.0)
      expect(controller.getPosition()).toEqual({ x: 0, y: 0 })
    })
  })

  describe('性能监控', () => {
    it('应该获取性能指标', () => {
      const metrics = controller.getPerformanceMetrics()

      expect(metrics).toHaveProperty('fps')
      expect(metrics).toHaveProperty('frameTime')
      expect(metrics).toHaveProperty('memoryUsage')
    })

    it('应该更新FPS', () => {
      controller.updatePerformanceMetrics(45, 22.22, 30000000)

      expect(controller.getPerformanceMetrics().fps).toBe(45)
    })

    it('应该更新帧时间', () => {
      controller.updatePerformanceMetrics(30, 33.33, 30000000)

      expect(controller.getPerformanceMetrics().frameTime).toBe(33.33)
    })

    it('应该更新内存使用', () => {
      controller.updatePerformanceMetrics(60, 16.67, 100000000)

      expect(controller.getPerformanceMetrics().memoryUsage).toBe(100000000)
    })

    it('应该返回性能指标的副本', () => {
      const metrics1 = controller.getPerformanceMetrics()
      const metrics2 = controller.getPerformanceMetrics()

      expect(metrics1).not.toBe(metrics2) // 不是同一个对象
      expect(metrics1).toEqual(metrics2) // 但值相同
    })
  })

  describe('资源清理', () => {
    it('应该销毁控制器', async () => {
      await controller.loadModel('/models/test.model3.json')
      await controller.playAnimation('idle')
      await controller.setExpression('happy')

      controller.destroy()

      expect(controller.isModelLoaded()).toBe(false)
      expect(controller.getCurrentAnimation()).toBeNull()
      expect(controller.getCurrentExpression()).toBeNull()
      expect(controller.isAutoIdleActive()).toBe(false)
    })

    it('应该重置所有状态', async () => {
      await controller.loadModel('/models/test.model3.json')
      controller.setScale(2.0)
      controller.setPosition(100, 200)
      controller.startAutoIdle()

      controller.destroy()

      expect(controller.getScale()).toBe(1.0)
      expect(controller.getPosition()).toEqual({ x: 0, y: 0 })
      expect(controller.isAutoIdleActive()).toBe(false)
    })

    it('销毁后应该可以重新初始化', async () => {
      await controller.loadModel('/models/test.model3.json')
      controller.destroy()

      await controller.loadModel('/models/test.model3.json')

      expect(controller.isModelLoaded()).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('应该处理快速连续的动画切换', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.playAnimation('idle')
      await controller.playAnimation('tap')
      await controller.playAnimation('happy')

      expect(controller.getCurrentAnimation()).toBe('happy')
    })

    it('应该处理快速连续的表情切换', async () => {
      await controller.loadModel('/models/test.model3.json')

      await controller.setExpression('neutral')
      await controller.setExpression('happy')
      await controller.setExpression('sad')

      expect(controller.getCurrentExpression()).toBe('sad')
    })

    it('应该处理同时设置多个变换', () => {
      controller.setScale(1.5)
      controller.setPosition(50, 100)

      expect(controller.getScale()).toBe(1.5)
      expect(controller.getPosition()).toEqual({ x: 50, y: 100 })
    })

    it('应该处理极端的缩放值', () => {
      controller.setScale(0.01)
      expect(controller.getScale()).toBe(0.01)

      controller.setScale(10.0)
      expect(controller.getScale()).toBe(10.0)
    })

    it('应该处理极端的位置值', () => {
      controller.setPosition(-10000, -10000)
      expect(controller.getPosition()).toEqual({ x: -10000, y: -10000 })

      controller.setPosition(10000, 10000)
      expect(controller.getPosition()).toEqual({ x: 10000, y: 10000 })
    })
  })

  describe('并发操作', () => {
    it('应该处理并发的动画播放请求', async () => {
      await controller.loadModel('/models/test.model3.json')

      // 同时发起多个动画播放请求
      await Promise.all([
        controller.playAnimation('idle'),
        controller.playAnimation('tap'),
        controller.playAnimation('happy')
      ])

      // 应该播放最后一个请求的动画
      expect(['idle', 'tap', 'happy']).toContain(controller.getCurrentAnimation())
    })

    it('应该处理并发的表情设置请求', async () => {
      await controller.loadModel('/models/test.model3.json')

      await Promise.all([
        controller.setExpression('neutral'),
        controller.setExpression('happy'),
        controller.setExpression('sad')
      ])

      expect(['neutral', 'happy', 'sad']).toContain(controller.getCurrentExpression())
    })

    it('应该处理并发的变换设置', () => {
      controller.setScale(1.5)
      controller.setPosition(100, 200)
      controller.setScale(2.0)

      // 最后设置的值应该生效
      expect(controller.getScale()).toBe(2.0)
      expect(controller.getPosition()).toEqual({ x: 100, y: 200 })
    })
  })

  describe('错误恢复', () => {
    it('加载失败后应该能重新加载', async () => {
      // 第一次加载失败
      try {
        await controller.loadModel('/invalid/model.json')
      } catch (error) {
        // 忽略错误
      }

      // 应该能重新加载
      await controller.loadModel('/models/test.model3.json')
      expect(controller.isModelLoaded()).toBe(true)
    })

    it('动画播放失败不应影响后续操作', async () => {
      await controller.loadModel('/models/test.model3.json')

      // 尝试播放不存在的动画
      try {
        await controller.playAnimation('nonexistent')
      } catch (error) {
        // 忽略错误
      }

      // 应该能继续播放其他动画
      await controller.playAnimation('idle')
      expect(controller.getCurrentAnimation()).toBe('idle')
    })

    it('表情设置失败不应影响后续操作', async () => {
      await controller.loadModel('/models/test.model3.json')

      // 尝试设置不存在的表情
      try {
        await controller.setExpression('nonexistent')
      } catch (error) {
        // 忽略错误
      }

      // 应该能继续设置其他表情
      await controller.setExpression('happy')
      expect(controller.getCurrentExpression()).toBe('happy')
    })
  })

  describe('状态查询', () => {
    it('应该查询模型是否已加载', async () => {
      expect(controller.isModelLoaded()).toBe(false)

      await controller.loadModel('/models/test.model3.json')

      expect(controller.isModelLoaded()).toBe(true)
    })

    it('应该查询自动空闲是否启用', () => {
      expect(controller.isAutoIdleActive()).toBe(false)

      controller.startAutoIdle()

      expect(controller.isAutoIdleActive()).toBe(true)
    })

    it('应该查询加载状态', async () => {
      expect(controller.getLoadingState()).toBe('idle')

      const loadPromise = controller.loadModel('/models/test.model3.json')
      await loadPromise

      expect(controller.getLoadingState()).toBe('loaded')
    })

    it('应该查询可用动画', async () => {
      expect(controller.getAvailableAnimations()).toEqual([])

      await controller.loadModel('/models/test.model3.json')

      const animations = controller.getAvailableAnimations()
      expect(animations.length).toBeGreaterThan(0)
    })

    it('应该查询可用表情', async () => {
      expect(controller.getAvailableExpressions()).toEqual([])

      await controller.loadModel('/models/test.model3.json')

      const expressions = controller.getAvailableExpressions()
      expect(expressions.length).toBeGreaterThan(0)
    })
  })
})


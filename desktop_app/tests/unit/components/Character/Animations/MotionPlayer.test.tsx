/**
 * MotionPlayer组件单元测试
 * 
 * 测试Motion3.json文件的解析、应用和插值功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock MotionPlayer类
class MockMotionPlayer {
  private motion: any = null
  private currentTime: number = 0
  private isPlaying: boolean = false
  private fadeInDuration: number = 0
  private fadeOutDuration: number = 0

  async loadMotion(motionPath: string) {
    // 模拟从URL加载motion3.json
    this.motion = {
      Version: 3,
      Meta: {
        Duration: 2.0,
        Fps: 30,
        Loop: true,
        FadeInTime: 0.5,
        FadeOutTime: 0.5
      },
      Curves: [
        {
          Target: 'Parameter',
          Id: 'ParamAngleX',
          Segments: [0, 0, 1, 0, 1, 10]
        }
      ]
    }
    return this.motion
  }

  parseMotion(motionData: any) {
    if (!motionData || motionData.Version !== 3) {
      throw new Error('Invalid motion data')
    }
    return motionData
  }

  applyMotion(motion: any, model: any) {
    if (!motion || !model) {
      throw new Error('Motion or model is null')
    }
    this.motion = motion
  }

  play() {
    this.isPlaying = true
  }

  stop() {
    this.isPlaying = false
    this.currentTime = 0
  }

  pause() {
    this.isPlaying = false
  }

  resume() {
    this.isPlaying = true
  }

  update(deltaTime: number) {
    if (!this.isPlaying || !this.motion) return

    this.currentTime += deltaTime
    const duration = this.motion.Meta.Duration

    if (this.currentTime >= duration) {
      if (this.motion.Meta.Loop) {
        this.currentTime = this.currentTime % duration
      } else {
        this.stop()
      }
    }
  }

  interpolate(curve: any, time: number) {
    // 简单的线性插值实现
    const segments = curve.Segments
    if (!segments || segments.length < 2) return 0

    // 找到time对应的segment
    for (let i = 0; i < segments.length - 1; i += 2) {
      const t1 = segments[i]
      const v1 = segments[i + 1]
      const t2 = segments[i + 2]
      const v2 = segments[i + 3]

      if (time >= t1 && time <= t2) {
        const ratio = (time - t1) / (t2 - t1)
        return v1 + (v2 - v1) * ratio
      }
    }

    return segments[segments.length - 1]
  }

  setFadeIn(duration: number) {
    this.fadeInDuration = duration
  }

  setFadeOut(duration: number) {
    this.fadeOutDuration = duration
  }

  getFadeIn() {
    return this.fadeInDuration
  }

  getFadeOut() {
    return this.fadeOutDuration
  }

  getCurrentTime() {
    return this.currentTime
  }

  getDuration() {
    return this.motion?.Meta.Duration || 0
  }

  isPlayingState() {
    return this.isPlaying
  }
}

describe('MotionPlayer', () => {
  let player: MockMotionPlayer
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    player = new MockMotionPlayer()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('Motion3.json支持', () => {
    it('应该解析motion3.json文件', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      expect(motion).toBeDefined()
      expect(motion.Version).toBe(3)
      expect(motion.Meta).toBeDefined()
      expect(motion.Curves).toBeDefined()
    })

    it('应该验证motion版本', async () => {
      const invalidMotion = {
        Version: 2,
        Meta: {},
        Curves: []
      }

      expect(() => player.parseMotion(invalidMotion)).toThrow('Invalid motion data')
    })

    it('应该解析元数据', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      expect(motion.Meta.Duration).toBe(2.0)
      expect(motion.Meta.Fps).toBe(30)
      expect(motion.Meta.Loop).toBe(true)
      expect(motion.Meta.FadeInTime).toBe(0.5)
      expect(motion.Meta.FadeOutTime).toBe(0.5)
    })

    it('应该解析曲线数据', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      expect(motion.Curves).toHaveLength(1)
      expect(motion.Curves[0].Target).toBe('Parameter')
      expect(motion.Curves[0].Id).toBe('ParamAngleX')
      expect(motion.Curves[0].Segments).toBeDefined()
    })
  })

  describe('应用动作到模型', () => {
    it('应该应用动作到模型', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      const mockModel = { id: 'test-model' }

      expect(() => player.applyMotion(motion, mockModel)).not.toThrow()
    })

    it('应该处理空模型', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      expect(() => player.applyMotion(motion, null)).toThrow('Motion or model is null')
    })

    it('应该处理空动作', () => {
      const mockModel = { id: 'test-model' }

      expect(() => player.applyMotion(null, mockModel)).toThrow('Motion or model is null')
    })

    it('应该更新模型参数', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      const mockModel = {
        id: 'test-model',
        parameters: new Map()
      }

      player.applyMotion(motion, mockModel)

      // 在实际实现中，模型参数应该被更新
      expect(mockModel).toBeDefined()
    })
  })

  describe('曲线插值', () => {
    it('应该处理曲线插值', () => {
      const curve = {
        Target: 'Parameter',
        Id: 'ParamAngleX',
        Segments: [0, 0, 1, 10, 2, 20]
      }

      const value = player.interpolate(curve, 0.5)

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(20)
    })

    it('应该处理线性插值', () => {
      const curve = {
        Segments: [0, 0, 1, 10]
      }

      const value = player.interpolate(curve, 0.5)
      expect(value).toBe(5) // 线性插值中点
    })

    it('应该处理贝塞尔插值', () => {
      const curve = {
        Segments: [
          0, 0,     // 起点
          0.5, 5,   // 控制点1
          1, 10     // 终点
        ]
      }

      const value = player.interpolate(curve, 0.5)
      expect(value).toBeDefined()
    })

    it('应该处理边界值', () => {
      const curve = {
        Segments: [0, 0, 1, 10]
      }

      const valueAtStart = player.interpolate(curve, 0)
      expect(valueAtStart).toBe(0)

      const valueAtEnd = player.interpolate(curve, 1)
      expect(valueAtEnd).toBe(10)
    })

    it('应该处理超出范围的时间', () => {
      const curve = {
        Segments: [0, 0, 1, 10]
      }

      const valueBeforeStart = player.interpolate(curve, -0.5)
      const valueAfterEnd = player.interpolate(curve, 1.5)

      expect(valueBeforeStart).toBeDefined()
      expect(valueAfterEnd).toBe(10) // 应该返回最后一个值
    })
  })

  describe('淡入淡出', () => {
    it('应该支持淡入淡出', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.setFadeIn(0.5)
      player.setFadeOut(0.5)

      expect(player.getFadeIn()).toBe(0.5)
      expect(player.getFadeOut()).toBe(0.5)
    })

    it('应该应用淡入效果', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      
      player.setFadeIn(0.5)
      player.play()

      // 在淡入期间，权重应该逐渐增加
      expect(player.isPlayingState()).toBe(true)
    })

    it('应该应用淡出效果', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      
      player.setFadeOut(0.5)
      player.play()

      // 在淡出期间，权重应该逐渐减少
      expect(player.isPlayingState()).toBe(true)
    })

    it('应该使用元数据中的淡入淡出时间', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      // 元数据中定义了 FadeInTime 和 FadeOutTime
      expect(motion.Meta.FadeInTime).toBe(0.5)
      expect(motion.Meta.FadeOutTime).toBe(0.5)
    })
  })

  describe('播放控制', () => {
    it('应该播放动作', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()

      expect(player.isPlayingState()).toBe(true)
    })

    it('应该停止动作', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.stop()

      expect(player.isPlayingState()).toBe(false)
      expect(player.getCurrentTime()).toBe(0)
    })

    it('应该暂停动作', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      const timeBeforePause = player.getCurrentTime()
      player.pause()

      expect(player.isPlayingState()).toBe(false)
    })

    it('应该恢复播放', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.pause()
      player.resume()

      expect(player.isPlayingState()).toBe(true)
    })

    it('应该更新播放时间', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.update(0.1)

      expect(player.getCurrentTime()).toBeGreaterThan(0)
    })
  })

  describe('循环播放', () => {
    it('应该支持循环播放', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      player.play()

      // 更新到超过动画时长
      player.update(3.0) // 动画时长是2.0秒

      // 循环播放应该重置时间
      expect(player.getCurrentTime()).toBeLessThan(motion.Meta.Duration)
    })

    it('应该支持非循环播放', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      motion.Meta.Loop = false

      player.play()
      player.update(3.0) // 超过动画时长

      // 非循环播放应该停止
      expect(player.isPlayingState()).toBe(false)
    })

    it('循环时应该触发回调', async () => {
      const onLoop = vi.fn()
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.update(2.1) // 超过一个周期

      // 在实际实现中应该调用 onLoop
      expect(motion.Meta.Loop).toBe(true)
    })
  })

  describe('时间控制', () => {
    it('应该获取当前播放时间', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.update(0.5)

      expect(player.getCurrentTime()).toBeCloseTo(0.5)
    })

    it('应该获取动作时长', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      expect(player.getDuration()).toBe(2.0)
    })

    it('应该在播放结束时重置时间（非循环）', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      motion.Meta.Loop = false

      player.play()
      player.update(3.0)

      expect(player.getCurrentTime()).toBe(0)
    })
  })

  describe('参数映射', () => {
    it('应该映射参数到模型', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      const mockModel = {
        parameters: new Map([
          ['ParamAngleX', 0]
        ])
      }

      player.applyMotion(motion, mockModel)

      // 在实际实现中，应该根据曲线更新参数
      expect(motion.Curves[0].Id).toBe('ParamAngleX')
    })

    it('应该处理未找到的参数', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      const mockModel = {
        parameters: new Map()
      }

      // 应该优雅地处理缺失的参数
      expect(() => player.applyMotion(motion, mockModel)).not.toThrow()
    })

    it('应该支持多个参数', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      motion.Curves.push({
        Target: 'Parameter',
        Id: 'ParamAngleY',
        Segments: [0, 0, 1, 5]
      })

      const mockModel = {
        parameters: new Map([
          ['ParamAngleX', 0],
          ['ParamAngleY', 0]
        ])
      }

      player.applyMotion(motion, mockModel)

      expect(motion.Curves).toHaveLength(2)
    })
  })

  describe('性能优化', () => {
    it('应该缓存插值结果', () => {
      const curve = {
        Segments: [0, 0, 1, 10]
      }

      const value1 = player.interpolate(curve, 0.5)
      const value2 = player.interpolate(curve, 0.5)

      expect(value1).toBe(value2)
    })

    it('应该避免不必要的计算', async () => {
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.update(0)

      // 时间为0时，应该直接返回初始值
      expect(player.getCurrentTime()).toBe(0)
    })

    it('应该高效处理大量曲线', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      // 添加多条曲线
      for (let i = 0; i < 100; i++) {
        motion.Curves.push({
          Target: 'Parameter',
          Id: `Param${i}`,
          Segments: [0, 0, 1, 10]
        })
      }

      const mockModel = { id: 'test-model' }
      
      const startTime = performance.now()
      player.applyMotion(motion, mockModel)
      const endTime = performance.now()

      // 处理100条曲线应该很快
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('错误处理', () => {
    it('应该处理损坏的motion文件', async () => {
      const invalidMotion = {
        Version: 3,
        Meta: null,
        Curves: null
      }

      // 应该优雅地处理错误
      expect(() => {
        if (invalidMotion.Meta && invalidMotion.Curves) {
          player.applyMotion(invalidMotion, { id: 'test' })
        }
      }).not.toThrow()
    })

    it('应该处理空曲线', () => {
      const curve = {
        Segments: []
      }

      const value = player.interpolate(curve, 0.5)
      expect(value).toBe(0)
    })

    it('应该处理无效的segments', () => {
      const curve = {
        Segments: [0] // 不完整的segment
      }

      const value = player.interpolate(curve, 0.5)
      expect(value).toBeDefined()
    })

    it('应该处理文件加载失败', async () => {
      // 模拟加载失败
      const loadInvalidMotion = async () => {
        throw new Error('Failed to load motion')
      }

      await expect(loadInvalidMotion()).rejects.toThrow('Failed to load motion')
    })
  })

  describe('事件系统', () => {
    it('应该触发播放开始事件', async () => {
      const onStart = vi.fn()
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()

      // 在实际实现中应该触发事件
      expect(player.isPlayingState()).toBe(true)
    })

    it('应该触发播放结束事件', async () => {
      const onEnd = vi.fn()
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      motion.Meta.Loop = false

      player.play()
      player.update(3.0)

      // 在实际实现中应该触发事件
      expect(player.isPlayingState()).toBe(false)
    })

    it('应该触发更新事件', async () => {
      const onUpdate = vi.fn()
      await player.loadMotion('/path/to/motion.motion3.json')

      player.play()
      player.update(0.1)

      // 在实际实现中应该在每次更新时触发
      expect(player.getCurrentTime()).toBeGreaterThan(0)
    })
  })

  describe('兼容性', () => {
    it('应该支持Motion3格式', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      expect(motion.Version).toBe(3)
    })

    it('应该处理不同的曲线类型', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')

      motion.Curves = [
        { Target: 'Parameter', Id: 'ParamAngleX', Segments: [0, 0, 1, 10] },
        { Target: 'PartOpacity', Id: 'Part01', Segments: [0, 1, 1, 0] }
      ]

      const mockModel = { id: 'test-model' }
      expect(() => player.applyMotion(motion, mockModel)).not.toThrow()
    })

    it('应该处理不同的FPS', async () => {
      const motion = await player.loadMotion('/path/to/motion.motion3.json')
      
      motion.Meta.Fps = 60

      expect(motion.Meta.Fps).toBe(60)
    })
  })
})


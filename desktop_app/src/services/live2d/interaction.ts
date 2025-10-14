import { Live2DModelInstance } from './loader'
import { Live2DAnimationManager, AnimationType } from './animation'

/**
 * 交互类型枚举
 */
export enum InteractionType {
  /** 点击 */
  CLICK = 'click',
  /** 双击 */
  DOUBLE_CLICK = 'doubleClick',
  /** 长按 */
  LONG_PRESS = 'longPress',
  /** 悬停 */
  HOVER = 'hover',
  /** 拖拽 */
  DRAG = 'drag',
  /** 滚轮 */
  WHEEL = 'wheel',
  /** 键盘 */
  KEYBOARD = 'keyboard',
  /** 触摸 */
  TOUCH = 'touch',
}

/**
 * 交互区域定义
 */
export interface InteractionArea {
  /** 区域名称 */
  name: string
  /** 区域描述 */
  description?: string
  /** 区域形状 */
  shape: 'rect' | 'circle' | 'polygon'
  /** 区域坐标/参数 */
  bounds: number[]
  /** 是否启用 */
  enabled: boolean
  /** 优先级 */
  priority: number
  /** 关联的Live2D hit area */
  hitAreaName?: string
}

/**
 * 交互事件数据
 */
export interface InteractionEventData {
  /** 交互类型 */
  type: InteractionType
  /** 触发区域 */
  area?: InteractionArea
  /** 鼠标/触摸位置 */
  position: { x: number; y: number }
  /** 事件时间戳 */
  timestamp: number
  /** 原始事件对象 */
  originalEvent: Event
  /** 额外数据 */
  data?: any
}

/**
 * 交互响应配置
 */
export interface InteractionResponse {
  /** 响应类型 */
  type: 'animation' | 'expression' | 'sound' | 'callback' | 'chain'
  /** 动画类型 (当type为animation时) */
  animationType?: AnimationType
  /** 动画组名 */
  animationGroup?: string
  /** 动画索引 */
  animationIndex?: number
  /** 表情索引 (当type为expression时) */
  expressionIndex?: number
  /** 音频文件路径 (当type为sound时) */
  soundPath?: string
  /** 回调函数 (当type为callback时) */
  callback?: (data: InteractionEventData) => void
  /** 链式响应 (当type为chain时) */
  chain?: InteractionResponse[]
  /** 响应延迟(毫秒) */
  delay?: number
  /** 响应概率(0-1) */
  probability?: number
  /** 冷却时间(毫秒) */
  cooldown?: number
}

/**
 * 交互规则
 */
export interface InteractionRule {
  /** 规则ID */
  id: string
  /** 规则名称 */
  name: string
  /** 交互类型 */
  interactionType: InteractionType
  /** 目标区域 (为空表示全局) */
  targetArea?: string
  /** 触发条件 */
  condition?: (data: InteractionEventData) => boolean
  /** 响应配置 */
  response: InteractionResponse
  /** 是否启用 */
  enabled: boolean
  /** 优先级 */
  priority: number
  /** 最后触发时间 */
  lastTriggered?: number
}

/**
 * 手势识别配置
 */
export interface GestureConfig {
  /** 手势名称 */
  name: string
  /** 手势类型 */
  type: 'swipe' | 'pinch' | 'rotate' | 'tap' | 'custom'
  /** 最小距离 */
  minDistance?: number
  /** 最大时间 */
  maxTime?: number
  /** 方向 (对于swipe) */
  direction?: 'up' | 'down' | 'left' | 'right'
  /** 自定义识别函数 */
  recognizer?: (events: PointerEvent[]) => boolean
}

/**
 * Live2D交互管理器
 */
export class Live2DInteractionManager {
  private modelInstance: Live2DModelInstance | null = null
  private animationManager: Live2DAnimationManager | null = null
  private canvas: HTMLCanvasElement | null = null
  
  private interactionAreas = new Map<string, InteractionArea>()
  private interactionRules = new Map<string, InteractionRule>()
  private eventListeners = new Map<string, Set<Function>>()
  
  // 交互状态
  private isEnabled = true
  private isDragging = false
  private isHovering = false
  private longPressTimer: number | null = null
  private doubleClickTimer: number | null = null
  private lastClickTime = 0
  private lastClickPosition = { x: 0, y: 0 }
  
  // 触摸和手势相关
  private touchEvents: PointerEvent[] = []
  private gestureConfigs = new Map<string, GestureConfig>()
  
  // 性能和限制
  private readonly DOUBLE_CLICK_DELAY = 300
  private readonly LONG_PRESS_DELAY = 800
  private readonly HOVER_DELAY = 100
  private readonly MAX_TOUCH_EVENTS = 50

  /**
   * 初始化交互管理器
   */
  init(
    canvas: HTMLCanvasElement,
    modelInstance: Live2DModelInstance,
    animationManager: Live2DAnimationManager
  ): void {
    this.canvas = canvas
    this.modelInstance = modelInstance
    this.animationManager = animationManager
    
    this.setupEventListeners()
    this.initializeDefaultAreas()
    this.initializeDefaultRules()
    this.initializeDefaultGestures()
    
    console.log('Live2D交互管理器初始化完成')
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.canvas) return

    // 鼠标事件
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this))
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseenter', this.handleMouseEnter.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this))
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this))

    // 触摸事件
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this))
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this))
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this))

    // 指针事件 (统一处理鼠标和触摸)
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this))
    this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this))
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this))

    // 键盘事件 (全局)
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    document.addEventListener('keyup', this.handleKeyUp.bind(this))

    // 防止右键菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  /**
   * 初始化默认交互区域
   */
  private initializeDefaultAreas(): void {
    const canvasRect = this.canvas?.getBoundingClientRect()
    if (!canvasRect) return

    // 头部区域
    this.addInteractionArea({
      name: 'head',
      description: '头部区域',
      shape: 'rect',
      bounds: [
        canvasRect.width * 0.3,  // x
        canvasRect.height * 0.1, // y
        canvasRect.width * 0.4,  // width
        canvasRect.height * 0.3  // height
      ],
      enabled: true,
      priority: 1,
      hitAreaName: 'Head'
    })

    // 身体区域
    this.addInteractionArea({
      name: 'body',
      description: '身体区域',
      shape: 'rect',
      bounds: [
        canvasRect.width * 0.25,
        canvasRect.height * 0.35,
        canvasRect.width * 0.5,
        canvasRect.height * 0.6
      ],
      enabled: true,
      priority: 2,
      hitAreaName: 'Body'
    })

    // 全局区域
    this.addInteractionArea({
      name: 'global',
      description: '全局区域',
      shape: 'rect',
      bounds: [0, 0, canvasRect.width, canvasRect.height],
      enabled: true,
      priority: 3
    })
  }

  /**
   * 初始化默认交互规则
   */
  private initializeDefaultRules(): void {
    // 点击头部 - 播放点击头部动画
    this.addInteractionRule({
      id: 'click_head',
      name: '点击头部',
      interactionType: InteractionType.CLICK,
      targetArea: 'head',
      response: {
        type: 'animation',
        animationType: AnimationType.TAP,
        animationGroup: 'TapHead'
      },
      enabled: true,
      priority: 1
    })

    // 点击身体 - 播放点击身体动画
    this.addInteractionRule({
      id: 'click_body',
      name: '点击身体',
      interactionType: InteractionType.CLICK,
      targetArea: 'body',
      response: {
        type: 'animation',
        animationType: AnimationType.TAP,
        animationGroup: 'TapBody'
      },
      enabled: true,
      priority: 1
    })

    // 双击 - 播放高兴动画
    this.addInteractionRule({
      id: 'double_click',
      name: '双击',
      interactionType: InteractionType.DOUBLE_CLICK,
      response: {
        type: 'animation',
        animationType: AnimationType.HAPPY,
        probability: 0.8
      },
      enabled: true,
      priority: 2
    })

    // 长按 - 播放困惑动画
    this.addInteractionRule({
      id: 'long_press',
      name: '长按',
      interactionType: InteractionType.LONG_PRESS,
      response: {
        type: 'animation',
        animationType: AnimationType.CONFUSED,
        delay: 500
      },
      enabled: true,
      priority: 2
    })

    // 拖拽 - 播放拖拽动画
    this.addInteractionRule({
      id: 'drag',
      name: '拖拽',
      interactionType: InteractionType.DRAG,
      response: {
        type: 'animation',
        animationType: AnimationType.DRAG,
        cooldown: 1000
      },
      enabled: true,
      priority: 2
    })

    // 悬停 - 播放思考动画
    this.addInteractionRule({
      id: 'hover',
      name: '悬停',
      interactionType: InteractionType.HOVER,
      response: {
        type: 'animation',
        animationType: AnimationType.THINKING,
        delay: 1000,
        probability: 0.3
      },
      enabled: true,
      priority: 3
    })
  }

  /**
   * 初始化默认手势配置
   */
  private initializeDefaultGestures(): void {
    // 向上滑动 - 问候
    this.addGestureConfig({
      name: 'swipe_up',
      type: 'swipe',
      direction: 'up',
      minDistance: 50,
      maxTime: 500
    })

    // 向下滑动 - 再见
    this.addGestureConfig({
      name: 'swipe_down',
      type: 'swipe',
      direction: 'down',
      minDistance: 50,
      maxTime: 500
    })
  }

  /**
   * 添加交互区域
   */
  addInteractionArea(area: InteractionArea): void {
    this.interactionAreas.set(area.name, area)
  }

  /**
   * 移除交互区域
   */
  removeInteractionArea(name: string): void {
    this.interactionAreas.delete(name)
  }

  /**
   * 添加交互规则
   */
  addInteractionRule(rule: InteractionRule): void {
    this.interactionRules.set(rule.id, rule)
  }

  /**
   * 移除交互规则
   */
  removeInteractionRule(id: string): void {
    this.interactionRules.delete(id)
  }

  /**
   * 添加手势配置
   */
  addGestureConfig(config: GestureConfig): void {
    this.gestureConfigs.set(config.name, config)
  }

  /**
   * 处理点击事件
   */
  private handleClick(event: MouseEvent): void {
    if (!this.isEnabled) return

    const now = Date.now()
    const position = this.getEventPosition(event)
    
    // 检查是否是双击
    if (now - this.lastClickTime < this.DOUBLE_CLICK_DELAY &&
        this.isNearPosition(position, this.lastClickPosition, 10)) {
      return // 让双击事件处理
    }

    this.lastClickTime = now
    this.lastClickPosition = position

    // 延迟处理单击，确保不与双击冲突
    if (this.doubleClickTimer) {
      clearTimeout(this.doubleClickTimer)
    }

    this.doubleClickTimer = setTimeout(() => {
      this.processInteraction({
        type: InteractionType.CLICK,
        position,
        timestamp: now,
        originalEvent: event
      })
    }, this.DOUBLE_CLICK_DELAY) as unknown as number
  }

  /**
   * 处理双击事件
   */
  private handleDoubleClick(event: MouseEvent): void {
    if (!this.isEnabled) return

    if (this.doubleClickTimer) {
      clearTimeout(this.doubleClickTimer)
      this.doubleClickTimer = null
    }

    this.processInteraction({
      type: InteractionType.DOUBLE_CLICK,
      position: this.getEventPosition(event),
      timestamp: Date.now(),
      originalEvent: event
    })
  }

  /**
   * 处理鼠标按下事件
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.isEnabled) return

    const position = this.getEventPosition(event)

    // 开始长按计时
    this.longPressTimer = setTimeout(() => {
      this.processInteraction({
        type: InteractionType.LONG_PRESS,
        position,
        timestamp: Date.now(),
        originalEvent: event
      })
    }, this.LONG_PRESS_DELAY) as unknown as number

    // 记录拖拽开始
    this.isDragging = false
  }

  /**
   * 处理鼠标抬起事件
   */
  private handleMouseUp(_event: MouseEvent): void {
    // 清除长按计时器
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }

    this.isDragging = false
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isEnabled) return

    const position = this.getEventPosition(event)

    // 检查是否是拖拽
    if (event.buttons > 0 && !this.isDragging) {
      this.isDragging = true
      
      // 清除长按计时器
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }

      this.processInteraction({
        type: InteractionType.DRAG,
        position,
        timestamp: Date.now(),
        originalEvent: event
      })
    }

    // 处理悬停（节流处理）
    if (!this.isHovering) {
      this.isHovering = true
      setTimeout(() => {
        if (this.isHovering) {
          this.processInteraction({
            type: InteractionType.HOVER,
            position,
            timestamp: Date.now(),
            originalEvent: event
          })
        }
      }, this.HOVER_DELAY)
    }
  }

  /**
   * 处理鼠标进入事件
   */
  private handleMouseEnter(_event: MouseEvent): void {
    this.isHovering = true
  }

  /**
   * 处理鼠标离开事件
   */
  private handleMouseLeave(_event: MouseEvent): void {
    this.isHovering = false
    
    // 清除所有计时器
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  /**
   * 处理滚轮事件
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.isEnabled) return

    this.processInteraction({
      type: InteractionType.WHEEL,
      position: this.getEventPosition(event),
      timestamp: Date.now(),
      originalEvent: event,
      data: {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ
      }
    })
  }

  /**
   * 处理触摸开始事件
   */
  private handleTouchStart(event: TouchEvent): void {
    if (!this.isEnabled) return
    
    event.preventDefault()
    this.recordTouchEvent(event as any)
  }

  /**
   * 处理触摸移动事件
   */
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isEnabled) return
    
    event.preventDefault()
    this.recordTouchEvent(event as any)
  }

  /**
   * 处理触摸结束事件
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isEnabled) return
    
    event.preventDefault()
    this.recognizeGestures()
    this.clearTouchEvents()
  }

  /**
   * 处理指针事件
   */
  private handlePointerDown(event: PointerEvent): void {
    this.recordTouchEvent(event)
  }

  private handlePointerMove(event: PointerEvent): void {
    this.recordTouchEvent(event)
  }

  private handlePointerUp(_event: PointerEvent): void {
    this.recognizeGestures()
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return

    this.processInteraction({
      type: InteractionType.KEYBOARD,
      position: { x: 0, y: 0 },
      timestamp: Date.now(),
      originalEvent: event,
      data: {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      }
    })
  }

  private handleKeyUp(_event: KeyboardEvent): void {
    // 键盘抬起事件处理
  }

  /**
   * 记录触摸事件
   */
  private recordTouchEvent(event: PointerEvent): void {
    this.touchEvents.push(event)
    
    // 限制记录的事件数量
    if (this.touchEvents.length > this.MAX_TOUCH_EVENTS) {
      this.touchEvents.shift()
    }
  }

  /**
   * 识别手势
   */
  private recognizeGestures(): void {
    if (this.touchEvents.length < 2) return

    for (const [name, config] of this.gestureConfigs) {
      if (this.matchGesture(config)) {
        this.handleGestureRecognized(name, config)
        break
      }
    }
  }

  /**
   * 匹配手势
   */
  private matchGesture(config: GestureConfig): boolean {
    if (config.recognizer) {
      return config.recognizer(this.touchEvents)
    }

    switch (config.type) {
      case 'swipe':
        return this.matchSwipe(config)
      case 'tap':
        return this.matchTap(config)
      default:
        return false
    }
  }

  /**
   * 匹配滑动手势
   */
  private matchSwipe(config: GestureConfig): boolean {
    if (this.touchEvents.length < 2) return false

    const first = this.touchEvents[0]
    const last = this.touchEvents[this.touchEvents.length - 1]
    
    const deltaX = last.clientX - first.clientX
    const deltaY = last.clientY - first.clientY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const duration = last.timeStamp - first.timeStamp

    // 检查距离和时间限制
    if (config.minDistance && distance < config.minDistance) return false
    if (config.maxTime && duration > config.maxTime) return false

    // 检查方向
    if (config.direction) {
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI
      
      switch (config.direction) {
        case 'up':
          return angle >= -135 && angle <= -45
        case 'down':
          return angle >= 45 && angle <= 135
        case 'left':
          return Math.abs(angle) >= 135
        case 'right':
          return angle >= -45 && angle <= 45
      }
    }

    return true
  }

  /**
   * 匹配点击手势
   */
  private matchTap(_config: GestureConfig): boolean {
    // 简单的点击判断
    return this.touchEvents.length <= 3
  }

  /**
   * 处理手势识别
   */
  private handleGestureRecognized(name: string, _config: GestureConfig): void {
    console.log('识别到手势:', name)

    // 根据手势名称触发相应动画
    let animationType: AnimationType = AnimationType.IDLE

    switch (name) {
      case 'swipe_up':
        animationType = AnimationType.GREETING
        break
      case 'swipe_down':
        animationType = AnimationType.FAREWELL
        break
    }

    this.animationManager?.playRandomAnimationByType(animationType)
  }

  /**
   * 清除触摸事件记录
   */
  private clearTouchEvents(): void {
    this.touchEvents.length = 0
  }

  /**
   * 处理交互事件
   */
  private processInteraction(eventData: InteractionEventData): void {
    // 查找匹配的区域
    const area = this.findTargetArea(eventData.position)
    if (area) {
      eventData.area = area
    }

    // 查找匹配的规则
    const rules = this.findMatchingRules(eventData)
    
    // 按优先级排序并执行
    rules.sort((a, b) => a.priority - b.priority)
    
    for (const rule of rules) {
      if (this.shouldExecuteRule(rule, eventData)) {
        this.executeRule(rule, eventData)
        break // 只执行第一个匹配的规则
      }
    }

    // 触发事件
    this.emit('interaction', eventData)
  }

  /**
   * 查找目标区域
   */
  private findTargetArea(position: { x: number; y: number }): InteractionArea | null {
    const areas = Array.from(this.interactionAreas.values())
      .filter(area => area.enabled)
      .sort((a, b) => a.priority - b.priority)

    for (const area of areas) {
      if (this.isPositionInArea(position, area)) {
        return area
      }
    }

    return null
  }

  /**
   * 检查位置是否在区域内
   */
  private isPositionInArea(position: { x: number; y: number }, area: InteractionArea): boolean {
    switch (area.shape) {
      case 'rect':
        const [x, y, width, height] = area.bounds
        return position.x >= x && position.x <= x + width &&
               position.y >= y && position.y <= y + height

      case 'circle':
        const [centerX, centerY, radius] = area.bounds
        const distance = Math.sqrt(
          Math.pow(position.x - centerX, 2) + Math.pow(position.y - centerY, 2)
        )
        return distance <= radius

      case 'polygon':
        // 简化的多边形检测
        return this.pointInPolygon(position, area.bounds)

      default:
        return false
    }
  }

  /**
   * 点在多边形内检测 (射线算法)
   */
  private pointInPolygon(point: { x: number; y: number }, polygon: number[]): boolean {
    let inside = false
    const vertices = []
    
    // 将数组转换为顶点对
    for (let i = 0; i < polygon.length; i += 2) {
      vertices.push({ x: polygon[i], y: polygon[i + 1] })
    }

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (((vertices[i].y > point.y) !== (vertices[j].y > point.y)) &&
          (point.x < (vertices[j].x - vertices[i].x) * (point.y - vertices[i].y) / 
           (vertices[j].y - vertices[i].y) + vertices[i].x)) {
        inside = !inside
      }
    }

    return inside
  }

  /**
   * 查找匹配的规则
   */
  private findMatchingRules(eventData: InteractionEventData): InteractionRule[] {
    return Array.from(this.interactionRules.values()).filter(rule => {
      // 检查基本条件
      if (!rule.enabled || rule.interactionType !== eventData.type) {
        return false
      }

      // 检查区域限制
      if (rule.targetArea && (!eventData.area || eventData.area.name !== rule.targetArea)) {
        return false
      }

      // 检查自定义条件
      if (rule.condition && !rule.condition(eventData)) {
        return false
      }

      return true
    })
  }

  /**
   * 检查是否应该执行规则
   */
  private shouldExecuteRule(rule: InteractionRule, eventData: InteractionEventData): boolean {
    // 检查冷却时间
    if (rule.response.cooldown && rule.lastTriggered) {
      const timeSinceLastTrigger = eventData.timestamp - rule.lastTriggered
      if (timeSinceLastTrigger < rule.response.cooldown) {
        return false
      }
    }

    // 检查概率
    if (rule.response.probability && Math.random() > rule.response.probability) {
      return false
    }

    return true
  }

  /**
   * 执行规则
   */
  private async executeRule(rule: InteractionRule, eventData: InteractionEventData): Promise<void> {
    rule.lastTriggered = eventData.timestamp

    const response = rule.response

    // 应用延迟
    if (response.delay) {
      await new Promise(resolve => setTimeout(resolve, response.delay))
    }

    try {
      switch (response.type) {
        case 'animation':
          await this.executeAnimationResponse(response)
          break
        case 'expression':
          await this.executeExpressionResponse(response)
          break
        case 'sound':
          await this.executeSoundResponse(response)
          break
        case 'callback':
          response.callback?.(eventData)
          break
        case 'chain':
          await this.executeChainResponse(response, eventData)
          break
      }

      this.emit('ruleExecuted', { rule, eventData })
    } catch (error) {
      console.error('执行交互规则失败:', error)
      this.emit('ruleError', { rule, eventData, error })
    }
  }

  /**
   * 执行动画响应
   */
  private async executeAnimationResponse(response: InteractionResponse): Promise<void> {
    if (!this.animationManager) return

    if (response.animationType) {
      await this.animationManager.playRandomAnimationByType(response.animationType)
    } else if (response.animationGroup) {
      // 直接播放指定动画组
      // 这需要在动画管理器中添加相应方法
    }
  }

  /**
   * 执行表情响应
   */
  private async executeExpressionResponse(response: InteractionResponse): Promise<void> {
    if (!this.modelInstance || typeof response.expressionIndex !== 'number') return

    const model = this.modelInstance.model
    await model.expression(response.expressionIndex)
  }

  /**
   * 执行音频响应
   */
  private async executeSoundResponse(response: InteractionResponse): Promise<void> {
    if (!response.soundPath) return

    try {
      const audio = new Audio(response.soundPath)
      await audio.play()
    } catch (error) {
      console.error('播放音频失败:', error)
    }
  }

  /**
   * 执行链式响应
   */
  private async executeChainResponse(
    response: InteractionResponse,
    eventData: InteractionEventData
  ): Promise<void> {
    if (!response.chain) return

    for (const chainResponse of response.chain) {
      await this.executeRule(
        { response: chainResponse } as InteractionRule,
        eventData
      )
    }
  }

  /**
   * 获取事件位置
   */
  private getEventPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    let clientX: number, clientY: number

    if (event instanceof MouseEvent) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      const touch = event.touches[0] || event.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  /**
   * 检查位置是否接近
   */
  private isNearPosition(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
    threshold: number
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    )
    return distance <= threshold
  }

  /**
   * 启用/禁用交互
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`交互管理器${enabled ? '启用' : '禁用'}`)
  }

  /**
   * 获取交互状态
   */
  isInteractionEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * 获取所有交互区域
   */
  getInteractionAreas(): InteractionArea[] {
    return Array.from(this.interactionAreas.values())
  }

  /**
   * 获取所有交互规则
   */
  getInteractionRules(): InteractionRule[] {
    return Array.from(this.interactionRules.values())
  }

  /**
   * 清理
   */
  cleanup(): void {
    // 清除所有计时器
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
    }
    if (this.doubleClickTimer) {
      clearTimeout(this.doubleClickTimer)
    }

    // 清理事件监听器
    if (this.canvas) {
      // 移除所有事件监听器
      const events = [
        'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
        'mouseenter', 'mouseleave', 'wheel', 'touchstart', 'touchmove',
        'touchend', 'pointerdown', 'pointermove', 'pointerup', 'contextmenu'
      ]
      
      for (const eventType of events) {
        this.canvas.removeEventListener(eventType, () => {})
      }
    }

    // 清理状态
    this.interactionAreas.clear()
    this.interactionRules.clear()
    this.eventListeners.clear()
    this.touchEvents.length = 0
    this.gestureConfigs.clear()

    console.log('交互管理器已清理')
  }

  /**
   * 添加事件监听器
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error('交互事件监听器执行失败:', error)
        }
      })
    }
  }
}

/**
 * 创建交互管理器实例
 */
export function createInteractionManager(): Live2DInteractionManager {
  return new Live2DInteractionManager()
}

export default Live2DInteractionManager

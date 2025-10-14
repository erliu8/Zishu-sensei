/**
 * Live2D 角色动画配置模块
 * 
 * 提供预定义的动画配置、动画序列、动画映射和动画触发条件
 * 支持：
 * - 预定义动画配置
 * - 动画序列编排
 * - 情绪动画映射
 * - 活动状态动画映射
 * - 动画触发条件
 * - 动画组合和链式播放
 */

import { AnimationType, AnimationConfig } from '@/services/live2d/animation'
import type { EmotionType, ActivityState } from '@/stores/characterStore'

// ==================== 动画优先级常量 ====================

/**
 * 动画优先级定义
 */
export const AnimationPriority = {
  /** 最低优先级 - 空闲动画 */
  IDLE: 1,
  /** 普通优先级 - 一般交互动画 */
  NORMAL: 2,
  /** 高优先级 - 重要交互和情绪动画 */
  HIGH: 3,
  /** 紧急优先级 - 系统事件和特殊动画 */
  URGENT: 4,
} as const

// ==================== 动画时间常量 ====================

/**
 * 动画淡入淡出时间配置
 */
export const AnimationFadeTiming = {
  /** 快速淡入淡出 (300ms) */
  FAST: 300,
  /** 普通淡入淡出 (500ms) */
  NORMAL: 500,
  /** 慢速淡入淡出 (800ms) */
  SLOW: 800,
  /** 平滑淡入淡出 (1000ms) */
  SMOOTH: 1000,
} as const

// ==================== 预定义动画配置 ====================

/**
 * 空闲动画配置
 */
export const idleAnimations: AnimationConfig[] = [
  {
    type: AnimationType.IDLE,
    group: 'Idle',
    index: 0,
    priority: AnimationPriority.IDLE,
    loop: true,
    fadeInTime: AnimationFadeTiming.SMOOTH,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '默认空闲动画 - 平静站立',
  },
  {
    type: AnimationType.IDLE,
    group: 'Idle',
    index: 1,
    priority: AnimationPriority.IDLE,
    loop: false,
    fadeInTime: AnimationFadeTiming.NORMAL,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '空闲动画变体 - 轻微动作',
  },
]

/**
 * 点击交互动画配置
 */
export const tapAnimations: AnimationConfig[] = [
  {
    type: AnimationType.TAP,
    group: 'TapHead',
    priority: AnimationPriority.HIGH,
    fadeInTime: AnimationFadeTiming.FAST,
    fadeOutTime: AnimationFadeTiming.FAST,
    description: '点击头部 - 惊讶反应',
  },
  {
    type: AnimationType.TAP,
    group: 'TapBody',
    priority: AnimationPriority.HIGH,
    fadeInTime: AnimationFadeTiming.FAST,
    fadeOutTime: AnimationFadeTiming.FAST,
    description: '点击身体 - 害羞反应',
  },
]

/**
 * 拖拽动画配置
 */
export const dragAnimations: AnimationConfig[] = [
  {
    type: AnimationType.DRAG,
    group: 'Drag',
    priority: AnimationPriority.NORMAL,
    fadeInTime: AnimationFadeTiming.FAST,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '拖拽移动 - 跟随鼠标',
  },
]

/**
 * 问候动画配置
 */
export const greetingAnimations: AnimationConfig[] = [
  {
    type: AnimationType.GREETING,
    group: 'Hello',
    priority: AnimationPriority.NORMAL,
    fadeInTime: AnimationFadeTiming.NORMAL,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '打招呼 - 友好挥手',
  },
  {
    type: AnimationType.GREETING,
    group: 'Wave',
    priority: AnimationPriority.NORMAL,
    fadeInTime: AnimationFadeTiming.NORMAL,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '挥手 - 热情问候',
  },
]

/**
 * 告别动画配置
 */
export const farewellAnimations: AnimationConfig[] = [
  {
    type: AnimationType.FAREWELL,
    group: 'Bye',
    priority: AnimationPriority.NORMAL,
    fadeInTime: AnimationFadeTiming.NORMAL,
    fadeOutTime: AnimationFadeTiming.SMOOTH,
    description: '再见 - 挥手告别',
  },
]

/**
 * 思考动画配置
 */
export const thinkingAnimations: AnimationConfig[] = [
  {
    type: AnimationType.THINKING,
    group: 'Think',
    priority: AnimationPriority.NORMAL,
    fadeInTime: AnimationFadeTiming.NORMAL,
    fadeOutTime: AnimationFadeTiming.NORMAL,
    description: '思考中 - 沉思表情',
  },
]

/**
 * 说话动画配置
 */
export const speakingAnimations: AnimationConfig[] = [
  {
    type: AnimationType.SPEAKING,
    group: 'Talk',
    priority: AnimationPriority.HIGH,
    fadeInTime: AnimationFadeTiming.FAST,
    fadeOutTime: AnimationFadeTiming.FAST,
    description: '说话中 - 嘴部动画',
  },
]

/**
 * 情绪动画配置
 */
export const emotionAnimations = {
  happy: [
    {
      type: AnimationType.HAPPY,
      group: 'Happy',
      priority: AnimationPriority.NORMAL,
      fadeInTime: AnimationFadeTiming.NORMAL,
      fadeOutTime: AnimationFadeTiming.NORMAL,
      description: '开心 - 笑容满面',
    },
    {
      type: AnimationType.HAPPY,
      group: 'Joy',
      priority: AnimationPriority.NORMAL,
      fadeInTime: AnimationFadeTiming.NORMAL,
      fadeOutTime: AnimationFadeTiming.NORMAL,
      description: '喜悦 - 欢快跳跃',
    },
  ] as AnimationConfig[],
  
  surprised: [
    {
      type: AnimationType.SURPRISED,
      group: 'Surprise',
      priority: AnimationPriority.HIGH,
      fadeInTime: AnimationFadeTiming.FAST,
      fadeOutTime: AnimationFadeTiming.NORMAL,
      description: '惊讶 - 睁大眼睛',
    },
  ] as AnimationConfig[],
  
  confused: [
    {
      type: AnimationType.CONFUSED,
      group: 'Confused',
      priority: AnimationPriority.NORMAL,
      fadeInTime: AnimationFadeTiming.NORMAL,
      fadeOutTime: AnimationFadeTiming.NORMAL,
      description: '困惑 - 歪头疑问',
    },
  ] as AnimationConfig[],
  
  sleeping: [
    {
      type: AnimationType.SLEEPING,
      group: 'Sleep',
      priority: AnimationPriority.NORMAL,
      loop: true,
      fadeInTime: AnimationFadeTiming.SMOOTH,
      fadeOutTime: AnimationFadeTiming.SMOOTH,
      description: '睡觉 - 闭眼休息',
    },
  ] as AnimationConfig[],
}

// ==================== 动画映射配置 ====================

/**
 * 情绪到动画类型的映射
 */
export const emotionToAnimationMap: Record<string, AnimationType> = {
  neutral: AnimationType.IDLE,
  happy: AnimationType.HAPPY,
  sad: AnimationType.IDLE, // 可以定义一个SAD动画类型
  angry: AnimationType.IDLE,
  surprised: AnimationType.SURPRISED,
  confused: AnimationType.CONFUSED,
  thinking: AnimationType.THINKING,
  excited: AnimationType.HAPPY,
  tired: AnimationType.SLEEPING,
  shy: AnimationType.IDLE,
  annoyed: AnimationType.IDLE,
  worried: AnimationType.THINKING,
}

/**
 * 活动状态到动画类型的映射
 */
export const activityToAnimationMap: Record<string, AnimationType> = {
  idle: AnimationType.IDLE,
  speaking: AnimationType.SPEAKING,
  listening: AnimationType.IDLE,
  thinking: AnimationType.THINKING,
  interacting: AnimationType.TAP,
  sleeping: AnimationType.SLEEPING,
  working: AnimationType.THINKING,
}

/**
 * 交互类型到动画类型的映射
 */
export const interactionToAnimationMap: Record<string, AnimationType> = {
  click: AnimationType.TAP,
  doubleClick: AnimationType.HAPPY,
  longPress: AnimationType.CONFUSED,
  hover: AnimationType.THINKING,
  drag: AnimationType.DRAG,
  wheel: AnimationType.IDLE,
  keyboard: AnimationType.IDLE,
  touch: AnimationType.TAP,
}

// ==================== 动画序列配置 ====================

/**
 * 动画序列接口
 */
export interface AnimationSequence {
  /** 序列名称 */
  name: string
  /** 序列描述 */
  description?: string
  /** 动画列表 */
  animations: Array<{
    /** 动画配置 */
    config: AnimationConfig
    /** 延迟时间(毫秒) */
    delay?: number
    /** 是否等待动画完成 */
    waitForComplete?: boolean
  }>
  /** 是否循环播放 */
  loop?: boolean
}

/**
 * 预定义动画序列
 */
export const animationSequences: Record<string, AnimationSequence> = {
  // 欢迎序列：挥手 -> 微笑
  welcome: {
    name: '欢迎序列',
    description: '新用户欢迎动画序列',
    animations: [
      {
        config: greetingAnimations[0],
        waitForComplete: true,
      },
      {
        config: emotionAnimations.happy[0],
        delay: 500,
        waitForComplete: false,
      },
    ],
  },
  
  // 告别序列：挥手 -> 闭眼
  farewell: {
    name: '告别序列',
    description: '用户离开时的告别动画',
    animations: [
      {
        config: farewellAnimations[0],
        waitForComplete: true,
      },
      {
        config: emotionAnimations.sleeping[0],
        delay: 1000,
        waitForComplete: false,
      },
    ],
  },
  
  // 思考序列：思考 -> 恍然大悟
  thinking: {
    name: '思考序列',
    description: '思考并得出结论的动画序列',
    animations: [
      {
        config: thinkingAnimations[0],
        waitForComplete: true,
      },
      {
        config: emotionAnimations.surprised[0],
        delay: 2000,
        waitForComplete: true,
      },
      {
        config: emotionAnimations.happy[0],
        delay: 500,
        waitForComplete: false,
      },
    ],
  },
  
  // 惊喜序列：惊讶 -> 开心
  surprise: {
    name: '惊喜序列',
    description: '收到惊喜时的反应动画',
    animations: [
      {
        config: emotionAnimations.surprised[0],
        waitForComplete: true,
      },
      {
        config: emotionAnimations.happy[1],
        delay: 500,
        waitForComplete: false,
      },
    ],
  },
}

// ==================== 动画触发条件 ====================

/**
 * 动画触发条件接口
 */
export interface AnimationTrigger {
  /** 触发器名称 */
  name: string
  /** 触发条件检查函数 */
  condition: (context: AnimationTriggerContext) => boolean
  /** 要播放的动画 */
  animation: AnimationConfig | AnimationSequence
  /** 触发概率 (0-1) */
  probability?: number
  /** 冷却时间(毫秒) */
  cooldown?: number
  /** 最后触发时间 */
  lastTriggered?: number
}

/**
 * 动画触发上下文
 */
export interface AnimationTriggerContext {
  /** 当前情绪 */
  emotion: string
  /** 活动状态 */
  activityState: string
  /** 心情值 */
  mood: number
  /** 精力值 */
  energy: number
  /** 亲密度 */
  affection: number
  /** 最后交互时间 */
  lastInteractionTime: number
  /** 当前时间 */
  currentTime: number
  /** 累计交互次数 */
  totalInteractions: number
}

/**
 * 预定义动画触发器
 */
export const animationTriggers: AnimationTrigger[] = [
  // 长时间无交互 -> 睡觉
  {
    name: '长时间无交互',
    condition: (ctx) => {
      const idleTime = ctx.currentTime - ctx.lastInteractionTime
      return idleTime > 5 * 60 * 1000 && ctx.activityState === 'idle' // 5分钟
    },
    animation: emotionAnimations.sleeping[0],
    probability: 0.8,
    cooldown: 10 * 60 * 1000, // 10分钟冷却
  },
  
  // 精力低 -> 疲惫动画
  {
    name: '精力低',
    condition: (ctx) => ctx.energy < 20 && ctx.activityState === 'idle',
    animation: emotionAnimations.sleeping[0],
    probability: 0.6,
    cooldown: 5 * 60 * 1000,
  },
  
  // 心情好 -> 随机开心动画
  {
    name: '心情好',
    condition: (ctx) => ctx.mood > 80 && ctx.activityState === 'idle',
    animation: emotionAnimations.happy[0],
    probability: 0.3,
    cooldown: 2 * 60 * 1000,
  },
  
  // 亲密度高 -> 主动打招呼
  {
    name: '亲密度高',
    condition: (ctx) => {
      const timeSinceLastInteraction = ctx.currentTime - ctx.lastInteractionTime
      return ctx.affection > 70 && 
             timeSinceLastInteraction > 30 * 1000 && 
             timeSinceLastInteraction < 60 * 1000
    },
    animation: greetingAnimations[0],
    probability: 0.5,
    cooldown: 10 * 60 * 1000,
  },
  
  // 第一次交互 -> 欢迎序列
  {
    name: '第一次交互',
    condition: (ctx) => ctx.totalInteractions === 1,
    animation: animationSequences.welcome,
    probability: 1.0,
  },
]

// ==================== 动画配置工具函数 ====================

/**
 * 根据情绪获取推荐动画
 */
export function getAnimationByEmotion(emotion: EmotionType): AnimationConfig | null {
  const animationType = emotionToAnimationMap[emotion]
  if (!animationType) return null
  
  // 查找对应的动画配置
  switch (animationType) {
    case AnimationType.HAPPY:
      return emotionAnimations.happy[0]
    case AnimationType.SURPRISED:
      return emotionAnimations.surprised[0]
    case AnimationType.CONFUSED:
      return emotionAnimations.confused[0]
    case AnimationType.SLEEPING:
      return emotionAnimations.sleeping[0]
    case AnimationType.THINKING:
      return thinkingAnimations[0]
    case AnimationType.IDLE:
    default:
      return idleAnimations[0]
  }
}

/**
 * 根据活动状态获取推荐动画
 */
export function getAnimationByActivity(activity: ActivityState): AnimationConfig | null {
  const animationType = activityToAnimationMap[activity]
  if (!animationType) return null
  
  switch (animationType) {
    case AnimationType.SPEAKING:
      return speakingAnimations[0]
    case AnimationType.THINKING:
      return thinkingAnimations[0]
    case AnimationType.SLEEPING:
      return emotionAnimations.sleeping[0]
    case AnimationType.TAP:
      return tapAnimations[0]
    case AnimationType.IDLE:
    default:
      return idleAnimations[0]
  }
}

/**
 * 根据交互类型获取推荐动画
 */
export function getAnimationByInteraction(interactionType: string): AnimationConfig | null {
  const animationType = interactionToAnimationMap[interactionType]
  if (!animationType) return null
  
  switch (animationType) {
    case AnimationType.TAP:
      return tapAnimations[0]
    case AnimationType.HAPPY:
      return emotionAnimations.happy[0]
    case AnimationType.CONFUSED:
      return emotionAnimations.confused[0]
    case AnimationType.THINKING:
      return thinkingAnimations[0]
    case AnimationType.DRAG:
      return dragAnimations[0]
    case AnimationType.IDLE:
    default:
      return idleAnimations[0]
  }
}

/**
 * 获取随机动画配置
 */
export function getRandomAnimation(type: AnimationType): AnimationConfig | null {
  let animations: AnimationConfig[] = []
  
  switch (type) {
    case AnimationType.IDLE:
      animations = idleAnimations
      break
    case AnimationType.TAP:
      animations = tapAnimations
      break
    case AnimationType.DRAG:
      animations = dragAnimations
      break
    case AnimationType.GREETING:
      animations = greetingAnimations
      break
    case AnimationType.FAREWELL:
      animations = farewellAnimations
      break
    case AnimationType.THINKING:
      animations = thinkingAnimations
      break
    case AnimationType.SPEAKING:
      animations = speakingAnimations
      break
    case AnimationType.HAPPY:
      animations = emotionAnimations.happy
      break
    case AnimationType.SURPRISED:
      animations = emotionAnimations.surprised
      break
    case AnimationType.CONFUSED:
      animations = emotionAnimations.confused
      break
    case AnimationType.SLEEPING:
      animations = emotionAnimations.sleeping
      break
    default:
      return null
  }
  
  if (animations.length === 0) return null
  return animations[Math.floor(Math.random() * animations.length)]
}

/**
 * 检查动画触发器
 */
export function checkAnimationTriggers(
  context: AnimationTriggerContext
): AnimationConfig | AnimationSequence | null {
  for (const trigger of animationTriggers) {
    // 检查冷却时间
    if (trigger.lastTriggered && trigger.cooldown) {
      const timeSinceLastTrigger = context.currentTime - trigger.lastTriggered
      if (timeSinceLastTrigger < trigger.cooldown) {
        continue
      }
    }
    
    // 检查触发条件
    if (!trigger.condition(context)) {
      continue
    }
    
    // 检查概率
    if (trigger.probability && Math.random() > trigger.probability) {
      continue
    }
    
    // 更新最后触发时间
    trigger.lastTriggered = context.currentTime
    
    return trigger.animation
  }
  
  return null
}

/**
 * 创建自定义动画配置
 */
export function createAnimationConfig(
  type: AnimationType,
  group: string,
  options: {
    index?: number
    priority?: number
    loop?: boolean
    repeatCount?: number
    fadeInTime?: number
    fadeOutTime?: number
    description?: string
  } = {}
): AnimationConfig {
  return {
    type,
    group,
    index: options.index,
    priority: options.priority ?? AnimationPriority.NORMAL,
    loop: options.loop,
    repeatCount: options.repeatCount,
    fadeInTime: options.fadeInTime ?? AnimationFadeTiming.NORMAL,
    fadeOutTime: options.fadeOutTime ?? AnimationFadeTiming.NORMAL,
    description: options.description,
  }
}

/**
 * 合并动画配置
 */
export function mergeAnimationConfig(
  base: AnimationConfig,
  override: Partial<AnimationConfig>
): AnimationConfig {
  return {
    ...base,
    ...override,
  }
}

/**
 * 验证动画配置
 */
export function validateAnimationConfig(config: AnimationConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!config.type) {
    errors.push('动画类型不能为空')
  }
  
  if (!config.group) {
    errors.push('动画组名不能为空')
  }
  
  if (config.priority !== undefined && (config.priority < 1 || config.priority > 4)) {
    errors.push('动画优先级必须在 1-4 之间')
  }
  
  if (config.fadeInTime !== undefined && config.fadeInTime < 0) {
    errors.push('淡入时间不能为负数')
  }
  
  if (config.fadeOutTime !== undefined && config.fadeOutTime < 0) {
    errors.push('淡出时间不能为负数')
  }
  
  if (config.repeatCount !== undefined && config.repeatCount < 1) {
    errors.push('重复次数必须大于 0')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ==================== 导出所有动画配置 ====================

/**
 * 所有预定义动画的集合
 */
export const allAnimations = {
  idle: idleAnimations,
  tap: tapAnimations,
  drag: dragAnimations,
  greeting: greetingAnimations,
  farewell: farewellAnimations,
  thinking: thinkingAnimations,
  speaking: speakingAnimations,
  emotion: emotionAnimations,
} as const

/**
 * 默认导出
 */
export default {
  // 动画配置
  animations: allAnimations,
  sequences: animationSequences,
  triggers: animationTriggers,
  
  // 映射关系
  emotionMap: emotionToAnimationMap,
  activityMap: activityToAnimationMap,
  interactionMap: interactionToAnimationMap,
  
  // 工具函数
  getAnimationByEmotion,
  getAnimationByActivity,
  getAnimationByInteraction,
  getRandomAnimation,
  checkAnimationTriggers,
  createAnimationConfig,
  mergeAnimationConfig,
  validateAnimationConfig,
  
  // 常量
  priorities: AnimationPriority,
  fadeTiming: AnimationFadeTiming,
}


/**
 * Live2D类型定义文件
 * 
 * 为Live2D查看器和相关功能提供完整的TypeScript类型定义
 * 基于现有的Live2D服务架构进行设计
 */

import { ReactNode } from 'react'

// ==================== 基础类型定义 ====================

/**
 * 坐标点接口
 */
export interface Position {
  x: number
  y: number
}

/**
 * 尺寸接口
 */
export interface Size {
  width: number
  height: number
}

/**
 * 矩形区域接口
 */
export interface Rect extends Position, Size {}

/**
 * 颜色配置
 */
export interface ColorConfig {
  r: number
  g: number
  b: number
  a?: number
}

// ==================== Live2D模型相关类型 ====================

/**
 * Live2D模型加载状态
 */
export enum Live2DLoadState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
  SWITCHING = 'switching'
}

/**
 * Live2D模型基础配置
 */
export interface Live2DModelConfig {
  /** 模型唯一标识 */
  id: string
  /** 模型名称 */
  name: string
  /** 模型显示名称 */
  displayName?: string
  /** 模型文件路径 */
  modelPath: string
  /** 模型预览图 */
  previewImage?: string
  /** 模型分类 */
  category?: string
  /** 自定义标签 */
  tags?: string[]
  /** 模型描述 */
  description?: string
  /** 模型作者 */
  author?: string
  /** 模型版本 */
  version?: string
  /** 模型许可证 */
  license?: string
  /** 动画配置 */
  animations?: {
    [key: string]: Live2DAnimationDefinition[]
  }
  /** 表情配置 */
  expressions?: Live2DExpressionDefinition[]
  /** 物理配置文件路径 */
  physics?: string
  /** 模型元数据 */
  metadata?: {
    modelSize: Size
    canvasSize: Size
    pixelsPerUnit: number
    originX: number
    originY: number
  }
}

/**
 * 动画定义
 */
export interface Live2DAnimationDefinition {
  /** 动画名称 */
  name: string
  /** 动画文件路径 */
  file: string
  /** 动画优先级 */
  priority: Live2DAnimationPriority
  /** 动画描述 */
  description?: string
}

/**
 * 表情定义
 */
export interface Live2DExpressionDefinition {
  /** 表情名称 */
  name: string
  /** 表情文件路径 */
  file: string
  /** 表情描述 */
  description?: string
}

/**
 * Live2D渲染配置
 */
export interface Live2DRenderConfig {
  /** 模型缩放 */
  scale: number
  /** 模型位置 */
  position: Position
  /** 模型透明度 */
  opacity: number
  /** 背景颜色 */
  backgroundColor?: ColorConfig
  /** 是否启用物理效果 */
  enablePhysics: boolean
  /** 是否启用呼吸效果 */
  enableBreathing: boolean
  /** 是否启用眨眼 */
  enableEyeBlink: boolean
  /** 是否启用眼部追踪 */
  enableEyeTracking: boolean
  /** 是否启用唇形同步 */
  enableLipSync: boolean
  /** 动作淡入淡出时间 */
  motionFadeDuration: number
  /** 表情淡入淡出时间 */
  expressionFadeDuration: number
  /** 自定义着色器配置 */
  shaderConfig?: Record<string, any>
}

/**
 * Live2D模型实例状态
 */
export interface Live2DModelState {
  /** 是否已加载 */
  loaded: boolean
  /** 是否正在播放动画 */
  animating: boolean
  /** 当前动画名称 */
  currentAnimation?: string
  /** 当前表情索引 */
  currentExpression?: number
  /** 模型是否可见 */
  visible: boolean
  /** 模型是否可交互 */
  interactive: boolean
  /** 最后更新时间 */
  lastUpdated: number
}

// ==================== 动画相关类型 ====================

/**
 * 动画类型枚举
 */
export enum Live2DAnimationType {
  IDLE = 'idle',
  TAP = 'tap',
  DRAG = 'drag',
  GREETING = 'greeting',
  FAREWELL = 'farewell',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  HAPPY = 'happy',
  SURPRISED = 'surprised',
  CONFUSED = 'confused',
  SLEEPING = 'sleeping',
  CUSTOM = 'custom'
}

/**
 * 动画优先级枚举
 */
export enum Live2DAnimationPriority {
  IDLE = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * 动画播放状态
 */
export enum Live2DAnimationState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped'
}

/**
 * 动画配置
 */
export interface Live2DAnimationConfig {
  /** 动画类型 */
  type: Live2DAnimationType
  /** 动画组名 */
  group: string
  /** 动画索引 */
  index?: number
  /** 播放优先级 */
  priority?: number
  /** 是否循环播放 */
  loop?: boolean
  /** 播放次数 */
  repeatCount?: number
  /** 淡入时间(毫秒) */
  fadeInTime?: number
  /** 淡出时间(毫秒) */
  fadeOutTime?: number
  /** 动画描述 */
  description?: string
  /** 播放速度倍率 */
  playbackRate?: number
}

/**
 * 动画播放信息
 */
export interface Live2DAnimationPlayInfo {
  /** 动画配置 */
  config: Live2DAnimationConfig
  /** 播放状态 */
  state: Live2DAnimationState
  /** 开始时间 */
  startTime: number
  /** 已播放次数 */
  playedCount: number
  /** 剩余播放次数 */
  remainingCount: number
  /** 是否可以中断 */
  interruptible: boolean
  /** 播放进度 (0-1) */
  progress: number
}

// ==================== 交互相关类型 ====================

/**
 * 交互类型枚举
 */
export enum Live2DInteractionType {
  CLICK = 'click',
  DOUBLE_CLICK = 'doubleClick',
  LONG_PRESS = 'longPress',
  HOVER = 'hover',
  DRAG = 'drag',
  WHEEL = 'wheel',
  KEYBOARD = 'keyboard',
  TOUCH = 'touch'
}

/**
 * 交互区域定义
 */
export interface Live2DInteractionArea {
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
  /** 视觉反馈配置 */
  visualFeedback?: {
    highlight: boolean
    color?: ColorConfig
    opacity?: number
  }
}

/**
 * 交互事件数据
 */
export interface Live2DInteractionEvent {
  /** 交互类型 */
  type: Live2DInteractionType
  /** 触发区域 */
  area?: Live2DInteractionArea
  /** 鼠标/触摸位置 */
  position: Position
  /** 事件时间戳 */
  timestamp: number
  /** 原始事件对象 */
  originalEvent?: Event
  /** 额外数据 */
  data?: Record<string, any>
}

// ==================== 查看器配置类型 ====================

/**
 * Live2D查看器主题配置
 */
export interface Live2DViewerTheme {
  /** 主题名称 */
  name: string
  /** 背景色 */
  backgroundColor: string
  /** 边框色 */
  borderColor: string
  /** 控制按钮样式 */
  controls?: {
    backgroundColor: string
    textColor: string
    hoverColor: string
    activeColor: string
  }
  /** 加载指示器样式 */
  loading?: {
    color: string
    backgroundColor: string
  }
}

/**
 * Live2D查看器控制配置
 */
export interface Live2DViewerControls {
  /** 是否显示播放/暂停按钮 */
  showPlayPause: boolean
  /** 是否显示动画选择器 */
  showAnimationSelector: boolean
  /** 是否显示表情选择器 */
  showExpressionSelector: boolean
  /** 是否显示缩放控制 */
  showZoomControls: boolean
  /** 是否显示位置重置按钮 */
  showResetPosition: boolean
  /** 是否显示全屏按钮 */
  showFullscreen: boolean
  /** 是否显示设置面板 */
  showSettings: boolean
  /** 控制面板位置 */
  position: 'top' | 'bottom' | 'left' | 'right' | 'overlay'
  /** 是否自动隐藏 */
  autoHide: boolean
  /** 自动隐藏延迟(毫秒) */
  autoHideDelay: number
}

/**
 * Live2D查看器性能配置
 */
export interface Live2DViewerPerformance {
  /** 目标帧率 */
  targetFPS: number
  /** 是否启用性能监控 */
  enableMonitoring: boolean
  /** 内存使用限制(MB) */
  memoryLimit: number
  /** 是否启用纹理压缩 */
  enableTextureCompression: boolean
  /** 渲染质量 */
  renderQuality: 'low' | 'medium' | 'high' | 'ultra'
  /** 是否启用抗锯齿 */
  antiAliasing: boolean
}

/**
 * Live2D查看器配置
 */
export interface Live2DViewerConfig {
  /** 画布尺寸 */
  canvasSize: Size
  /** 模型配置 */
  modelConfig?: Live2DModelConfig
  /** 渲染配置 */
  renderConfig?: Partial<Live2DRenderConfig>
  /** 主题配置 */
  theme?: Live2DViewerTheme
  /** 控制配置 */
  controls?: Partial<Live2DViewerControls>
  /** 性能配置 */
  performance?: Partial<Live2DViewerPerformance>
  /** 是否启用交互 */
  enableInteraction: boolean
  /** 是否启用自动空闲动画 */
  enableAutoIdleAnimation: boolean
  /** 空闲动画间隔(毫秒) */
  idleAnimationInterval: number
  /** 是否启用调试模式 */
  debugMode: boolean
  /** 是否响应式布局 */
  responsive: boolean
  /** 自定义CSS类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

// ==================== 事件相关类型 ====================

/**
 * Live2D查看器事件类型
 */
export enum Live2DViewerEvent {
  /** 模型加载开始 */
  MODEL_LOAD_START = 'modelLoadStart',
  /** 模型加载进度 */
  MODEL_LOAD_PROGRESS = 'modelLoadProgress',
  /** 模型加载完成 */
  MODEL_LOAD_COMPLETE = 'modelLoadComplete',
  /** 模型加载错误 */
  MODEL_LOAD_ERROR = 'modelLoadError',
  /** 动画开始 */
  ANIMATION_START = 'animationStart',
  /** 动画完成 */
  ANIMATION_COMPLETE = 'animationComplete',
  /** 动画错误 */
  ANIMATION_ERROR = 'animationError',
  /** 交互触发 */
  INTERACTION = 'interaction',
  /** 配置更新 */
  CONFIG_UPDATE = 'configUpdate',
  /** 查看器就绪 */
  VIEWER_READY = 'viewerReady',
  /** 查看器销毁 */
  VIEWER_DESTROY = 'viewerDestroy'
}

/**
 * Live2D查看器事件处理器类型
 */
export type Live2DViewerEventHandler<T = any> = (data: T) => void

/**
 * Live2D查看器事件映射
 */
export interface Live2DViewerEventMap {
  [Live2DViewerEvent.MODEL_LOAD_START]: { modelId: string }
  [Live2DViewerEvent.MODEL_LOAD_PROGRESS]: { progress: number; stage: string }
  [Live2DViewerEvent.MODEL_LOAD_COMPLETE]: { modelId: string; loadTime: number }
  [Live2DViewerEvent.MODEL_LOAD_ERROR]: { error: Error; modelId?: string }
  [Live2DViewerEvent.ANIMATION_START]: { animationConfig: Live2DAnimationConfig }
  [Live2DViewerEvent.ANIMATION_COMPLETE]: { animationConfig: Live2DAnimationConfig }
  [Live2DViewerEvent.ANIMATION_ERROR]: { error: Error; animationConfig: Live2DAnimationConfig }
  [Live2DViewerEvent.INTERACTION]: Live2DInteractionEvent
  [Live2DViewerEvent.CONFIG_UPDATE]: { config: Partial<Live2DViewerConfig> }
  [Live2DViewerEvent.VIEWER_READY]: { viewerId: string }
  [Live2DViewerEvent.VIEWER_DESTROY]: { viewerId: string }
}

// ==================== Hook相关类型 ====================

/**
 * useLive2DViewer Hook返回类型
 */
export interface UseLive2DViewerReturn {
  /** 查看器是否已就绪 */
  isReady: boolean
  /** 加载状态 */
  loadState: Live2DLoadState
  /** 模型状态 */
  modelState: Live2DModelState
  /** 当前动画播放信息 */
  animationInfo: Live2DAnimationPlayInfo | null
  /** 错误信息 */
  error: Error | null
  /** 加载模型 */
  loadModel: (config: Live2DModelConfig, renderConfig?: Partial<Live2DRenderConfig>) => Promise<void>
  /** 播放动画 */
  playAnimation: (config: Live2DAnimationConfig) => Promise<void>
  /** 停止动画 */
  stopAnimation: () => void
  /** 设置表情 */
  setExpression: (index: number) => Promise<void>
  /** 更新渲染配置 */
  updateRenderConfig: (config: Partial<Live2DRenderConfig>) => void
  /** 重置模型位置和缩放 */
  resetTransform: () => void
  /** 销毁查看器 */
  destroy: () => void
  /** 获取当前模型 */
  getCurrentModel?: () => any | null
  /** Live2D服务实例 */
  service?: any
}

// ==================== 组件Props类型 ====================

/**
 * Live2D查看器组件Props
 */
export interface Live2DViewerProps {
  /** 查看器配置 */
  config: Live2DViewerConfig
  /** 模型配置 */
  modelConfig?: Live2DModelConfig
  /** 渲染配置 */
  renderConfig?: Partial<Live2DRenderConfig>
  /** 事件处理器 */
  onEvent?: <K extends keyof Live2DViewerEventMap>(
    event: K,
    handler: Live2DViewerEventHandler<Live2DViewerEventMap[K]>
  ) => void
  /** 模型加载完成回调 */
  onModelLoad?: (modelId: string) => void
  /** 动画播放回调 */
  onAnimationPlay?: (config: Live2DAnimationConfig) => void
  /** 交互事件回调 */
  onInteraction?: (event: Live2DInteractionEvent) => void
  /** 错误处理回调 */
  onError?: (error: Error) => void
  /** 自定义渲染内容 */
  children?: ReactNode
  /** CSS类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

/**
 * Live2D控制面板Props
 */
export interface Live2DControlPanelProps {
  /** 是否显示 */
  visible: boolean
  /** 控制配置 */
  controls: Live2DViewerControls
  /** 模型状态 */
  modelState: Live2DModelState
  /** 动画播放信息 */
  animationInfo: Live2DAnimationPlayInfo | null
  /** 可用动画列表 */
  availableAnimations: Live2DAnimationConfig[]
  /** 可用表情数量 */
  expressionCount: number
  /** 播放动画处理器 */
  onPlayAnimation: (config: Live2DAnimationConfig) => void
  /** 停止动画处理器 */
  onStopAnimation: () => void
  /** 设置表情处理器 */
  onSetExpression: (index: number) => void
  /** 重置变换处理器 */
  onResetTransform: () => void
  /** 全屏切换处理器 */
  onToggleFullscreen: () => void
  /** 设置更新处理器 */
  onUpdateSettings: (config: Partial<Live2DViewerConfig>) => void
}

/**
 * Live2D加载指示器Props
 */
export interface Live2DLoadingIndicatorProps {
  /** 加载状态 */
  loadState: Live2DLoadState
  /** 加载进度 (0-1) */
  progress?: number
  /** 当前阶段描述 */
  stage?: string
  /** 主题配置 */
  theme?: Live2DViewerTheme
  /** 自定义消息 */
  message?: string
}

// ==================== 工具函数类型 ====================

/**
 * Live2D工具函数集合
 */
export interface Live2DUtils {
  /** 计算模型边界框 */
  calculateModelBounds: (model: any) => Rect
  /** 屏幕坐标转模型坐标 */
  screenToModelCoords: (screenPos: Position, canvasSize: Size, modelTransform: any) => Position
  /** 模型坐标转屏幕坐标 */
  modelToScreenCoords: (modelPos: Position, canvasSize: Size, modelTransform: any) => Position
  /** 检测点击区域 */
  detectHitArea: (position: Position, areas: Live2DInteractionArea[]) => Live2DInteractionArea | null
  /** 格式化加载进度 */
  formatLoadProgress: (progress: number, stage: string) => string
  /** 验证模型配置 */
  validateModelConfig: (config: Live2DModelConfig) => { valid: boolean; errors: string[] }
  /** 合并渲染配置 */
  mergeRenderConfig: (base: Live2DRenderConfig, override: Partial<Live2DRenderConfig>) => Live2DRenderConfig
}

// ==================== 常量定义 ====================

/**
 * 默认配置常量
 */
export const LIVE2D_DEFAULTS = {
  /** 默认画布尺寸 */
  CANVAS_SIZE: { width: 800, height: 600 } as Size,
  /** 默认渲染配置 */
  RENDER_CONFIG: {
    scale: 1.0,
    position: { x: 0, y: 0 },
    opacity: 1.0,
    enablePhysics: true,
    enableBreathing: true,
    enableEyeBlink: true,
    enableEyeTracking: false,
    enableLipSync: false,
    motionFadeDuration: 500,
    expressionFadeDuration: 500
  } as Live2DRenderConfig,
  /** 默认控制配置 */
  CONTROLS: {
    showPlayPause: true,
    showAnimationSelector: true,
    showExpressionSelector: true,
    showZoomControls: true,
    showResetPosition: true,
    showFullscreen: false,
    showSettings: true,
    position: 'bottom',
    autoHide: false,
    autoHideDelay: 3000
  } as Live2DViewerControls,
  /** 默认性能配置 */
  PERFORMANCE: {
    targetFPS: 60,
    enableMonitoring: false,
    memoryLimit: 512,
    enableTextureCompression: true,
    renderQuality: 'high',
    antiAliasing: true
  } as Live2DViewerPerformance
} as const

/**
 * 动画优先级常量
 */
export const LIVE2D_ANIMATION_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
} as const

/**
 * 交互区域常量
 */
export const LIVE2D_INTERACTION_AREAS = {
  HEAD: 'head',
  BODY: 'body',
  FACE: 'face',
  EYE: 'eye',
  MOUTH: 'mouth',
  CUSTOM: 'custom'
} as const


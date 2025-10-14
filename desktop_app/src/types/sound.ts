/**
 * 音效系统类型定义
 * @module types/sound
 */

/**
 * 音效类别枚举
 */
export enum SoundCategory {
  /** UI交互音效 */
  UI = 'ui',
  /** 角色动作音效 */
  CHARACTER = 'character',
  /** 对话相关音效 */
  CHAT = 'chat',
  /** 系统通知音效 */
  NOTIFICATION = 'notification',
  /** 背景音乐 */
  BGM = 'bgm',
  /** 环境音效 */
  AMBIENT = 'ambient',
}

/**
 * 音效优先级
 */
export enum SoundPriority {
  /** 低优先级 - 可以被中断 */
  LOW = 0,
  /** 普通优先级 */
  NORMAL = 1,
  /** 高优先级 - 不容易被中断 */
  HIGH = 2,
  /** 最高优先级 - 总是播放 */
  CRITICAL = 3,
}

/**
 * 音效播放模式
 */
export enum SoundPlayMode {
  /** 单次播放 */
  ONCE = 'once',
  /** 循环播放 */
  LOOP = 'loop',
  /** 随机播放 */
  RANDOM = 'random',
}

/**
 * 音效状态
 */
export enum SoundState {
  /** 未加载 */
  UNLOADED = 'unloaded',
  /** 加载中 */
  LOADING = 'loading',
  /** 已加载 */
  LOADED = 'loaded',
  /** 播放中 */
  PLAYING = 'playing',
  /** 暂停 */
  PAUSED = 'paused',
  /** 停止 */
  STOPPED = 'stopped',
  /** 加载失败 */
  ERROR = 'error',
}

/**
 * 音效配置接口
 */
export interface SoundConfig {
  /** 音效ID */
  id: string
  /** 音效文件路径 */
  path: string
  /** 音效类别 */
  category: SoundCategory
  /** 音效名称 */
  name?: string
  /** 音效描述 */
  description?: string
  /** 默认音量 (0-1) */
  volume?: number
  /** 优先级 */
  priority?: SoundPriority
  /** 播放模式 */
  playMode?: SoundPlayMode
  /** 是否预加载 */
  preload?: boolean
  /** 淡入时间(ms) */
  fadeInDuration?: number
  /** 淡出时间(ms) */
  fadeOutDuration?: number
  /** 播放速率 */
  playbackRate?: number
  /** 是否启用立体声 */
  stereo?: boolean
  /** 自定义元数据 */
  metadata?: Record<string, any>
}

/**
 * 音效播放选项
 */
export interface SoundPlayOptions {
  /** 音量 (0-1) */
  volume?: number
  /** 播放速率 */
  playbackRate?: number
  /** 是否循环 */
  loop?: boolean
  /** 开始播放的时间点(秒) */
  startTime?: number
  /** 淡入时间(ms) */
  fadeIn?: number
  /** 延迟播放时间(ms) */
  delay?: number
  /** 播放完成回调 */
  onEnd?: () => void
  /** 播放错误回调 */
  onError?: (error: Error) => void
}

/**
 * 音效停止选项
 */
export interface SoundStopOptions {
  /** 淡出时间(ms) */
  fadeOut?: number
  /** 停止延迟(ms) */
  delay?: number
}

/**
 * 音效实例接口
 */
export interface SoundInstance {
  /** 音效ID */
  id: string
  /** 音效配置 */
  config: SoundConfig
  /** 音频元素 */
  audio: HTMLAudioElement
  /** 当前状态 */
  state: SoundState
  /** 当前音量 */
  volume: number
  /** 是否静音 */
  muted: boolean
  /** 播放进度 (0-1) */
  progress: number
  /** 创建时间 */
  createdAt: number
  /** 最后播放时间 */
  lastPlayedAt?: number
}

/**
 * 音效管理器配置
 */
export interface SoundManagerConfig {
  /** 全局音量 (0-1) */
  globalVolume?: number
  /** 是否全局静音 */
  globalMuted?: boolean
  /** 最大同时播放数量 */
  maxConcurrent?: number
  /** 默认淡入时间(ms) */
  defaultFadeIn?: number
  /** 默认淡出时间(ms) */
  defaultFadeOut?: number
  /** 音效基础路径 */
  basePath?: string
  /** 是否启用调试日志 */
  debug?: boolean
  /** 音效池大小 */
  poolSize?: number
  /** 缓存策略 */
  cacheStrategy?: 'memory' | 'lazy' | 'preload'
  /** 音效格式优先级 */
  formatPriority?: string[]
}

/**
 * 音效加载进度
 */
export interface SoundLoadProgress {
  /** 已加载数量 */
  loaded: number
  /** 总数量 */
  total: number
  /** 进度百分比 (0-100) */
  percentage: number
  /** 当前加载的音效 */
  currentSound?: string
  /** 加载失败的音效列表 */
  failed: string[]
}

/**
 * 音效播放事件
 */
export interface SoundPlayEvent {
  /** 音效ID */
  soundId: string
  /** 事件类型 */
  type: 'play' | 'pause' | 'stop' | 'end' | 'error'
  /** 事件时间戳 */
  timestamp: number
  /** 附加数据 */
  data?: any
}

/**
 * 音效统计信息
 */
export interface SoundStats {
  /** 总音效数量 */
  totalSounds: number
  /** 已加载数量 */
  loadedSounds: number
  /** 正在播放数量 */
  playingSounds: number
  /** 内存使用(字节) */
  memoryUsage: number
  /** 播放次数统计 */
  playCount: Record<string, number>
  /** 最常播放的音效 */
  mostPlayed: string[]
}

/**
 * 音效分组
 */
export interface SoundGroup {
  /** 分组ID */
  id: string
  /** 分组名称 */
  name: string
  /** 分组音效列表 */
  sounds: string[]
  /** 分组音量 (0-1) */
  volume: number
  /** 是否静音 */
  muted: boolean
}

/**
 * 音效淡入淡出控制器
 */
export interface SoundFadeController {
  /** 开始淡入 */
  fadeIn: (duration: number) => Promise<void>
  /** 开始淡出 */
  fadeOut: (duration: number) => Promise<void>
  /** 取消淡入淡出 */
  cancel: () => void
  /** 是否正在淡入淡出 */
  isFading: boolean
}

/**
 * 音效错误类型
 */
export class SoundError extends Error {
  constructor(
    message: string,
    public code: string,
    public soundId?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'SoundError'
  }
}

/**
 * 音效管理器事件类型
 */
export type SoundManagerEvent =
  | 'sound:loaded'
  | 'sound:play'
  | 'sound:pause'
  | 'sound:stop'
  | 'sound:end'
  | 'sound:error'
  | 'volume:changed'
  | 'mute:changed'
  | 'load:progress'
  | 'load:complete'

/**
 * 音效管理器事件处理器
 */
export type SoundManagerEventHandler = (event: any) => void

/**
 * 音效预设类型
 */
export interface SoundPreset {
  /** 预设ID */
  id: string
  /** 预设名称 */
  name: string
  /** 预设描述 */
  description?: string
  /** 预设配置 */
  config: Partial<SoundManagerConfig>
  /** 分组配置 */
  groups?: SoundGroup[]
}


/**
 * 角色相关类型定义
 */

/**
 * 角色类型
 */
export type CharacterType = 'live2d' | 'sprite' | 'avatar'

/**
 * 角色模型接口
 */
export interface CharacterModel {
  /** 角色唯一标识 */
  id: string
  /** 角色名称 */
  name: string
  /** 角色头像/图标 */
  avatar: string
  /** 角色描述 */
  description: string
  /** 角色类型 */
  type: CharacterType
  /** 模型文件路径（Live2D模型） */
  modelPath?: string
  /** 预览图片路径 */
  previewImage?: string
  /** 角色配置 */
  config?: CharacterConfig
}

/**
 * 角色配置接口
 */
export interface CharacterConfig {
  /** 默认表情 */
  defaultExpression?: string
  /** 默认动画 */
  defaultAnimation?: string
  /** 自动空闲动画 */
  autoIdleAnimation?: boolean
  /** 交互设置 */
  interaction?: {
    /** 启用点击交互 */
    enableClick?: boolean
    /** 启用拖拽 */
    enableDrag?: boolean
    /** 启用鼠标跟随 */
    enableMouseFollow?: boolean
  }
  /** 音频设置 */
  audio?: {
    /** 启用音效 */
    enableSounds?: boolean
    /** 音量 */
    volume?: number
  }
}

/**
 * 角色交互事件类型
 */
export type CharacterInteractionType = 
  | 'click' 
  | 'drag' 
  | 'hover' 
  | 'animation_start' 
  | 'animation_end'
  | 'expression_change'

/**
 * 角色交互事件数据
 */
export interface CharacterInteractionData {
  /** 事件类型 */
  type: CharacterInteractionType
  /** 角色ID */
  characterId: string
  /** 事件数据 */
  data?: any
  /** 时间戳 */
  timestamp: number
}

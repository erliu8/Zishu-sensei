/**
 * 角色模板类型定义
 */

/**
 * LLM配置类型
 */
export type LLMConfigType = 'local' | 'api'

/**
 * 本地LLM配置
 */
export interface LocalLLMConfig {
  type: 'local'
  /** 本地LLM模型ID */
  modelId: string
  /** 模型名称 */
  modelName: string
  /** 模型路径 */
  modelPath: string
  /** 额外配置参数 */
  params?: Record<string, any>
}

/**
 * API LLM配置
 */
export interface APILLMConfig {
  type: 'api'
  /** API提供商（如：openai, anthropic等） */
  provider: string
  /** API端点URL */
  apiEndpoint: string
  /** API密钥（加密存储） */
  apiKey?: string
  /** 模型名称 */
  modelName: string
  /** 额外配置参数 */
  params?: Record<string, any>
}

/**
 * LLM配置联合类型
 */
export type LLMConfig = LocalLLMConfig | APILLMConfig

/**
 * 角色Prompt配置
 */
export interface CharacterPrompt {
  /** Prompt ID */
  id: string
  /** Prompt名称 */
  name: string
  /** 系统提示词 */
  systemPrompt: string
  /** 用户提示词模板（可选） */
  userPromptTemplate?: string
  /** 描述 */
  description?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 创建新Prompt时的输入数据（不包含ID和时间戳）
 */
export interface CreateCharacterPromptInput {
  /** Prompt名称 */
  name: string
  /** 系统提示词 */
  systemPrompt: string
  /** 用户提示词模板（可选） */
  userPromptTemplate?: string
  /** 描述 */
  description?: string
}

/**
 * 角色模板
 */
export interface CharacterTemplate {
  /** 模板ID */
  id: string
  /** 角色名称（必填） */
  name: string
  /** 角色描述 */
  description?: string
  /** Live2D模型ID */
  live2dModelId: string
  /** 角色Prompt配置 */
  prompt: CharacterPrompt
  /** LLM配置 */
  llmConfig: LLMConfig
  /** 模板元数据 */
  metadata?: {
    /** 适配器ID（后端自动生成） */
    adapterId?: string
    /** 适配器类型（硬适配器或软适配器） */
    adapterType?: 'hard' | 'soft'
    /** 是否已注册适配器 */
    isAdapterRegistered?: boolean
    /** 适配器错误信息（如果注册失败） */
    adapterError?: string
  }
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 是否为默认模板 */
  isDefault?: boolean
}

/**
 * 创建角色模板请求（第一步）
 */
export interface CreateCharacterTemplateStep1 {
  /** 角色名称（必填） */
  name: string
  /** 角色描述 */
  description?: string
  /** Live2D模型ID */
  live2dModelId: string
  /** Prompt配置（可以选择已有的prompt ID或创建新的prompt） */
  prompt: string | CreateCharacterPromptInput 
  // string: 已有prompt的ID
  // CreateCharacterPromptInput: 创建新prompt的数据
}

/**
 * 创建角色模板请求（第二步）
 */
export interface CreateCharacterTemplateStep2 {
  /** 第一步的数据 */
  step1Data: CreateCharacterTemplateStep1
  /** LLM配置 */
  llmConfig: LLMConfig
}

/**
 * API提供商列表
 * 注意：这是固定的第三方服务列表，可以保留为常量
 */
export const API_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'custom', label: '自定义API' },
] as const

/**
 * 默认Prompt模板
 * 注意：这些仅用于数据库初始化或备份，实际使用时应从数据库获取
 * @deprecated 使用 CharacterTemplateService.getPrompts() 从数据库获取
 */
export const DEFAULT_PROMPTS: CharacterPrompt[] = [
  {
    id: 'default-assistant',
    name: '通用助手',
    systemPrompt: '你是一个有用的AI助手，能够回答各种问题并提供帮助。',
    description: '适用于一般对话场景的通用助手',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'default-creative',
    name: '创意写作',
    systemPrompt: '你是一个富有创意的写作助手，擅长创作故事、诗歌和各种文学作品。',
    description: '适用于创意写作和文学创作',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'default-technical',
    name: '技术专家',
    systemPrompt: '你是一个专业的技术专家，精通编程、系统设计和技术问题解决。',
    description: '适用于技术咨询和编程帮助',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

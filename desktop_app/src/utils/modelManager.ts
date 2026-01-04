/**
 * Live2D 模型管理器
 * 用于加载、缓存和管理多个 Live2D 模型
 */

import { Live2DModelConfig, Live2DAnimationPriority } from '@/types/live2d'
import { resolveLive2dUrl } from '@/utils/live2dUrl'

export interface ModelInfo {
  id: string
  name: string
  displayName: string
  path: string
  previewImage: string
  description: string
  gender: 'male' | 'female' | 'neutral'
  size: string
  features: string[]
}

export interface ModelLibrary {
  models: ModelInfo[]
  version: string
  lastUpdated: string
  source: string
  license: string
}

/**
 * 模型管理器类
 */
export class ModelManager {
  private static instance: ModelManager
  private modelLibrary: ModelLibrary | null = null
  private modelConfigs: Map<string, Live2DModelConfig> = new Map()
  private currentModelId: string = 'hiyori'

  private constructor() {}

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager()
    }
    return ModelManager.instance
  }

  /**
   * 加载模型库配置
   */
  async loadModelLibrary(): Promise<ModelLibrary> {
    if (this.modelLibrary) {
      return this.modelLibrary
    }

    try {
      const response = await fetch(resolveLive2dUrl('/live2d_models/models.json'))
      if (!response.ok) {
        throw new Error(`Failed to load model library: ${response.statusText}`)
      }
      
      const library: ModelLibrary = await response.json()
      this.modelLibrary = library
      console.log('✅ 模型库加载成功:', this.modelLibrary)
      return library
    } catch (error) {
      console.error('❌ 加载模型库失败:', error)
      throw error
    }
  }

  /**
   * 获取所有可用模型
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const library = await this.loadModelLibrary()
    if (!library) {
      throw new Error('Failed to load model library')
    }
    return library.models
  }

  /**
   * 根据ID获取模型信息
   */
  async getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
    const models = await this.getAvailableModels()
    return models.find(m => m.id === modelId)
  }

  /**
   * 创建 Live2D 模型配置
   */
  async createModelConfig(modelId: string): Promise<Live2DModelConfig> {
    // 检查缓存
    if (this.modelConfigs.has(modelId)) {
      return this.modelConfigs.get(modelId)!
    }

    const modelInfo = await this.getModelInfo(modelId)
    if (!modelInfo) {
      throw new Error(`Model not found: ${modelId}`)
    }

    const resolvedModelPath = resolveLive2dUrl(modelInfo.path) ?? modelInfo.path
    const resolvedPreviewImage = resolveLive2dUrl(modelInfo.previewImage) ?? modelInfo.previewImage

    // 创建基础配置
    const config: Live2DModelConfig = {
      id: modelInfo.id,
      name: modelInfo.name,
      modelPath: resolvedModelPath,
      previewImage: resolvedPreviewImage,
      description: modelInfo.description,
      author: 'Live2D Inc.',
      version: '1.0.0',
      tags: [modelInfo.gender, ...modelInfo.features],
      animations: {
        idle: [],
        tap: []
      },
      expressions: [],
      metadata: {
        modelSize: { width: 1024, height: 1024 },
        canvasSize: { width: 400, height: 600 },
        pixelsPerUnit: 1.0,
        originX: 0.5,
        originY: 0.5
      }
    }

    // 尝试加载模型的 JSON 配置以获取更多信息
    try {
      const response = await fetch(resolvedModelPath)
      if (response.ok) {
        const modelJson = await response.json()
        
        // 解析动画
        if (modelJson.FileReferences?.Motions) {
          const motions = modelJson.FileReferences.Motions
          
          // 初始化动画对象
          if (!config.animations) {
            config.animations = { idle: [], tap: [] }
          }
          
          // Idle 动画
          if (motions.Idle && config.animations) {
            config.animations.idle = motions.Idle.map((motion: any, index: number) => ({
              name: `idle_${String(index + 1).padStart(2, '0')}`,
              file: motion.File,
              priority: Live2DAnimationPriority.IDLE
            }))
          }

          // TapBody 动画
          if (motions.TapBody && config.animations) {
            config.animations.tap = motions.TapBody.map((motion: any, index: number) => ({
              name: `tap_body_${String(index + 1).padStart(2, '0')}`,
              file: motion.File,
              priority: Live2DAnimationPriority.NORMAL
            }))
          }
        }

        // 解析表情
        if (modelJson.FileReferences?.Expressions) {
          config.expressions = modelJson.FileReferences.Expressions.map((exp: any) => ({
            name: exp.Name || 'expression',
            file: exp.File
          }))
        }

        // 物理效果
        if (modelJson.FileReferences?.Physics) {
          const basePath = resolvedModelPath.substring(0, resolvedModelPath.lastIndexOf('/'))
          config.physics = `${basePath}/${modelJson.FileReferences.Physics}`
        }
      }
    } catch (error) {
      console.warn(`⚠️ 无法加载模型详细配置: ${modelId}`, error)
      // 使用默认配置
    }

    // 缓存配置
    this.modelConfigs.set(modelId, config)
    return config
  }

  /**
   * 获取当前模型ID
   */
  getCurrentModelId(): string {
    return this.currentModelId
  }

  /**
   * 设置当前模型ID
   */
  setCurrentModelId(modelId: string): void {
    this.currentModelId = modelId
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.modelConfigs.clear()
    this.modelLibrary = null
  }
}

/**
 * 导出单例实例
 */
export const modelManager = ModelManager.getInstance()


import { 
  Live2DModelConfig, 
  Live2DRenderConfig, 
  Live2DModelInstance 
} from './loader'
import { Live2DModelLoader } from './loader'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'

/**
 * 角色配置接口
 */
export interface CharacterConfig {
  id: string
  name: string
  displayName: string
  description?: string
  category: string
  tags: string[]
  modelConfig: Live2DModelConfig
  defaultRenderConfig?: Partial<Live2DRenderConfig>
  presets: CharacterPreset[]
  metadata: CharacterMetadata
}

/**
 * 角色预设配置
 */
export interface CharacterPreset {
  id: string
  name: string
  description?: string
  renderConfig: Partial<Live2DRenderConfig>
  defaultMotion?: string
  defaultExpression?: string
  customProperties?: Record<string, any>
}

/**
 * 角色元数据
 */
export interface CharacterMetadata {
  version: string
  author?: string
  license?: string
  source?: string
  createdAt: string
  updatedAt: string
  thumbnailUrl?: string
  previewImages?: string[]
  size: {
    width: number
    height: number
    fileSize: number
  }
  features: {
    hasPhysics: boolean
    hasBreathing: boolean
    hasEyeBlink: boolean
    hasEyeTracking: boolean
    hasLipSync: boolean
    motionCount: number
    expressionCount: number
  }
}

/**
 * 角色加载状态
 */
export enum CharacterLoadState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
  SWITCHING = 'switching'
}

/**
 * 角色事件类型
 */
export enum CharacterEvent {
  CHARACTER_LOADED = 'character_loaded',
  CHARACTER_SWITCHED = 'character_switched',
  CHARACTER_UNLOADED = 'character_unloaded',
  PRESET_APPLIED = 'preset_applied',
  CONFIG_UPDATED = 'config_updated',
  ERROR = 'error'
}

/**
 * 资源验证结果
 */
export interface ResourceValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  missingFiles: string[]
  suggestions: string[]
}

/**
 * 资源扫描结果
 */
export interface ResourceScanResult {
  modelFiles: string[]
  textureFiles: string[]
  motionFiles: string[]
  expressionFiles: string[]
  configFiles: string[]
  previewImages: string[]
}

/**
 * 角色资源管理器
 */
export class CharacterResourceManager {
  private loader: Live2DModelLoader
  private characters = new Map<string, CharacterConfig>()
  private loadedCharacters = new Map<string, Live2DModelInstance>()
  private currentCharacter: CharacterConfig | null = null
  private currentPreset: CharacterPreset | null = null
  private loadState: CharacterLoadState = CharacterLoadState.IDLE
  private eventListeners = new Map<string, Set<Function>>()

  constructor(loader: Live2DModelLoader) {
    this.loader = loader
    this.initializeDefaultCharacters()
  }

  /**
   * 初始化默认角色配置
   */
  private initializeDefaultCharacters(): void {
    // 添加一些默认角色配置
    const defaultCharacters: CharacterConfig[] = [
      {
        id: 'miku',
        name: 'miku',
        displayName: '初音未来',
        description: '虚拟歌手初音未来的Live2D模型',
        category: 'vocaloid',
        tags: ['vocaloid', 'singer', 'popular'],
        modelConfig: {
          id: 'miku',
          name: '初音未来',
          modelPath: '/assets/live2d/miku/miku.model3.json',
          previewImage: '/assets/live2d/miku/preview.png',
          category: 'vocaloid',
          tags: ['vocaloid', 'singer'],
          author: 'Crypton Future Media',
          license: 'Commercial'
        },
        defaultRenderConfig: {
          scale: 0.8,
          position: { x: 0, y: -50 },
          enablePhysics: true,
          enableBreathing: true,
          enableEyeBlink: true,
          enableEyeTracking: false,
          enableLipSync: false
        },
        presets: [
          {
            id: 'default',
            name: '默认',
            description: '默认外观设置',
            renderConfig: {
              scale: 0.8,
              position: { x: 0, y: -50 }
            }
          },
          {
            id: 'large',
            name: '大尺寸',
            description: '放大显示',
            renderConfig: {
              scale: 1.2,
              position: { x: 0, y: -100 }
            }
          },
          {
            id: 'small',
            name: '小尺寸',
            description: '缩小显示',
            renderConfig: {
              scale: 0.6,
              position: { x: 0, y: 0 }
            }
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'Crypton Future Media',
          license: 'Commercial',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          thumbnailUrl: '/assets/live2d/miku/thumbnail.png',
          previewImages: ['/assets/live2d/miku/preview1.png', '/assets/live2d/miku/preview2.png'],
          size: {
            width: 512,
            height: 768,
            fileSize: 15 * 1024 * 1024 // 15MB
          },
          features: {
            hasPhysics: true,
            hasBreathing: true,
            hasEyeBlink: true,
            hasEyeTracking: false,
            hasLipSync: false,
            motionCount: 12,
            expressionCount: 8
          }
        }
      },
      {
        id: 'hiyori',
        name: 'hiyori',
        displayName: '桃瀬ひより',
        description: '可爱的虚拟女孩桃瀬ひより',
        category: 'anime',
        tags: ['anime', 'cute', 'girl'],
        modelConfig: {
          id: 'hiyori',
          name: '桃瀬ひより',
          modelPath: '/assets/live2d/hiyori/hiyori.model3.json',
          previewImage: '/assets/live2d/hiyori/preview.png',
          category: 'anime',
          tags: ['anime', 'cute'],
          author: 'Live2D Inc.',
          license: 'Sample'
        },
        defaultRenderConfig: {
          scale: 0.75,
          position: { x: 0, y: -30 },
          enablePhysics: true,
          enableBreathing: true,
          enableEyeBlink: true,
          enableEyeTracking: true,
          enableLipSync: false
        },
        presets: [
          {
            id: 'default',
            name: '默认',
            description: '默认可爱风格',
            renderConfig: {
              scale: 0.75,
              position: { x: 0, y: -30 }
            }
          },
          {
            id: 'close',
            name: '特写',
            description: '近距离特写',
            renderConfig: {
              scale: 1.0,
              position: { x: 0, y: -80 }
            }
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'Live2D Inc.',
          license: 'Sample',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          thumbnailUrl: '/assets/live2d/hiyori/thumbnail.png',
          previewImages: ['/assets/live2d/hiyori/preview.png'],
          size: {
            width: 512,
            height: 768,
            fileSize: 8 * 1024 * 1024 // 8MB
          },
          features: {
            hasPhysics: true,
            hasBreathing: true,
            hasEyeBlink: true,
            hasEyeTracking: true,
            hasLipSync: false,
            motionCount: 6,
            expressionCount: 4
          }
        }
      },
      {
        id: 'koharu',
        name: 'koharu',
        displayName: '小春',
        description: '活泼开朗的小春',
        category: 'anime',
        tags: ['anime', 'cheerful', 'student'],
        modelConfig: {
          id: 'koharu',
          name: '小春',
          modelPath: '/assets/live2d/koharu/koharu.model3.json',
          previewImage: '/assets/live2d/koharu/preview.png',
          category: 'anime',
          tags: ['anime', 'cheerful'],
          author: 'Live2D Inc.',
          license: 'Sample'
        },
        defaultRenderConfig: {
          scale: 0.85,
          position: { x: 0, y: -40 },
          enablePhysics: true,
          enableBreathing: true,
          enableEyeBlink: true,
          enableEyeTracking: false,
          enableLipSync: false
        },
        presets: [
          {
            id: 'default',
            name: '默认',
            description: '活泼风格',
            renderConfig: {
              scale: 0.85,
              position: { x: 0, y: -40 }
            }
          },
          {
            id: 'energetic',
            name: '活力',
            description: '充满活力的样子',
            renderConfig: {
              scale: 0.9,
              position: { x: 0, y: -60 }
            }
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'Live2D Inc.',
          license: 'Sample',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          thumbnailUrl: '/assets/live2d/koharu/thumbnail.png',
          previewImages: ['/assets/live2d/koharu/preview.png'],
          size: {
            width: 512,
            height: 768,
            fileSize: 10 * 1024 * 1024 // 10MB
          },
          features: {
            hasPhysics: true,
            hasBreathing: true,
            hasEyeBlink: true,
            hasEyeTracking: false,
            hasLipSync: false,
            motionCount: 8,
            expressionCount: 6
          }
        }
      }
    ]

    // 注册默认角色
    for (const character of defaultCharacters) {
      this.registerCharacter(character)
    }
  }

  /**
   * 注册角色配置
   */
  registerCharacter(config: CharacterConfig): void {
    this.characters.set(config.id, config)
    console.log(`注册角色: ${config.displayName} (${config.id})`)
  }

  /**
   * 获取所有角色配置
   */
  getAllCharacters(): CharacterConfig[] {
    return Array.from(this.characters.values())
  }

  /**
   * 按类别获取角色
   */
  getCharactersByCategory(category: string): CharacterConfig[] {
    return this.getAllCharacters().filter(char => char.category === category)
  }

  /**
   * 按标签搜索角色
   */
  searchCharactersByTag(tag: string): CharacterConfig[] {
    return this.getAllCharacters().filter(char => 
      char.tags.includes(tag)
    )
  }

  /**
   * 搜索角色
   */
  searchCharacters(query: string): CharacterConfig[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllCharacters().filter(char => 
      char.name.toLowerCase().includes(lowerQuery) ||
      char.displayName.toLowerCase().includes(lowerQuery) ||
      char.description?.toLowerCase().includes(lowerQuery) ||
      char.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * 获取角色配置
   */
  getCharacter(id: string): CharacterConfig | undefined {
    return this.characters.get(id)
  }

  /**
   * 加载角色
   */
  async loadCharacter(
    characterId: string, 
    presetId?: string
  ): Promise<Live2DModelInstance> {
    const character = this.getCharacter(characterId)
    if (!character) {
      throw new Error(`角色不存在: ${characterId}`)
    }

    this.setLoadState(CharacterLoadState.LOADING)

    try {
      // 获取预设配置
      const preset = presetId ? 
        character.presets.find(p => p.id === presetId) : 
        character.presets[0] // 使用第一个预设作为默认

      // 合并渲染配置
      const renderConfig: Partial<Live2DRenderConfig> = {
        ...character.defaultRenderConfig,
        ...preset?.renderConfig
      }

      // 使用加载器加载模型
      const modelInstance = await this.loader.loadModel(
        character.modelConfig,
        renderConfig
      )

      // 保存加载的角色
      this.loadedCharacters.set(characterId, modelInstance)
      this.currentCharacter = character
      this.currentPreset = preset || null

      this.setLoadState(CharacterLoadState.LOADED)
      this.emit(CharacterEvent.CHARACTER_LOADED, { character, modelInstance, preset })

      return modelInstance
    } catch (error) {
      this.setLoadState(CharacterLoadState.ERROR)
      this.emit(CharacterEvent.ERROR, { error, characterId })
      throw error
    }
  }

  /**
   * 切换角色
   */
  async switchCharacter(
    characterId: string,
    presetId?: string
  ): Promise<Live2DModelInstance> {
    if (this.currentCharacter?.id === characterId) {
      // 如果是同一个角色，只切换预设
      if (presetId && this.currentPreset?.id !== presetId) {
        await this.applyPreset(presetId)
      }
      return this.loadedCharacters.get(characterId)!
    }

    this.setLoadState(CharacterLoadState.SWITCHING)

    try {
      // 卸载当前角色
      if (this.currentCharacter) {
        await this.unloadCharacter(this.currentCharacter.id)
      }

      // 加载新角色
      const modelInstance = await this.loadCharacter(characterId, presetId)
      
      this.emit(CharacterEvent.CHARACTER_SWITCHED, { 
        character: this.currentCharacter, 
        modelInstance, 
        preset: this.currentPreset 
      })

      return modelInstance
    } catch (error) {
      this.setLoadState(CharacterLoadState.ERROR)
      throw error
    }
  }

  /**
   * 应用预设
   */
  async applyPreset(presetId: string): Promise<void> {
    if (!this.currentCharacter) {
      throw new Error('没有当前角色')
    }

    const preset = this.currentCharacter.presets.find(p => p.id === presetId)
    if (!preset) {
      throw new Error(`预设不存在: ${presetId}`)
    }

    const modelInstance = this.loadedCharacters.get(this.currentCharacter.id)
    if (!modelInstance) {
      throw new Error('角色未加载')
    }

    // 应用预设配置
    Object.assign(modelInstance.renderConfig, preset.renderConfig)

    // 更新模型显示
    this.updateModelDisplay(modelInstance)

    // 应用默认动作和表情
    if (preset.defaultMotion && modelInstance) {
      // 这里需要获取正确的动作索引或ID
      // 暂时使用占位符实现
      console.log(`应用默认动作: ${preset.defaultMotion}`)
    }

    if (preset.defaultExpression && modelInstance) {
      // 这里需要获取正确的表情索引
      // 暂时使用占位符实现  
      console.log(`应用默认表情: ${preset.defaultExpression}`)
    }

    this.currentPreset = preset
    this.emit(CharacterEvent.PRESET_APPLIED, { preset, character: this.currentCharacter })
  }

  /**
   * 更新模型显示
   */
  private updateModelDisplay(modelInstance: Live2DModelInstance): void {
    const { model, renderConfig } = modelInstance
    
    // 更新缩放
    model.scale.set(renderConfig.scale)
    
    // 更新位置
    model.position.set(renderConfig.position.x, renderConfig.position.y)
    
    // 更新透明度
    model.alpha = renderConfig.opacity
  }

  /**
   * 卸载角色
   */
  async unloadCharacter(characterId: string): Promise<void> {
    const modelInstance = this.loadedCharacters.get(characterId)
    if (modelInstance) {
      // 从舞台移除
      if (modelInstance.model.parent) {
        modelInstance.model.parent.removeChild(modelInstance.model)
      }

      // 销毁模型
      modelInstance.model.destroy()

      // 从缓存中移除
      this.loadedCharacters.delete(characterId)

      const character = this.getCharacter(characterId)
      this.emit(CharacterEvent.CHARACTER_UNLOADED, { character, characterId })
    }

    if (this.currentCharacter?.id === characterId) {
      this.currentCharacter = null
      this.currentPreset = null
    }
  }

  /**
   * 获取当前角色
   */
  getCurrentCharacter(): CharacterConfig | null {
    return this.currentCharacter
  }

  /**
   * 获取当前预设
   */
  getCurrentPreset(): CharacterPreset | null {
    return this.currentPreset
  }

  /**
   * 获取加载状态
   */
  getLoadState(): CharacterLoadState {
    return this.loadState
  }

  /**
   * 设置加载状态
   */
  private setLoadState(state: CharacterLoadState): void {
    this.loadState = state
  }

  /**
   * 添加事件监听器
   */
  on(event: CharacterEvent, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: CharacterEvent, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: CharacterEvent, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (error) {
          console.error(`事件监听器错误 (${event}):`, error)
        }
      }
    }
  }

  /**
   * 获取角色统计信息
   */
  getCharacterStats(): {
    totalCharacters: number
    loadedCharacters: number
    categoryCounts: Record<string, number>
    tagCounts: Record<string, number>
  } {
    const characters = this.getAllCharacters()
    const categoryCounts: Record<string, number> = {}
    const tagCounts: Record<string, number> = {}

    for (const character of characters) {
      // 统计分类
      categoryCounts[character.category] = (categoryCounts[character.category] || 0) + 1
      
      // 统计标签
      for (const tag of character.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    return {
      totalCharacters: characters.length,
      loadedCharacters: this.loadedCharacters.size,
      categoryCounts,
      tagCounts
    }
  }

  /**
   * 导出角色配置
   */
  exportCharacterConfig(characterId: string): string {
    const character = this.getCharacter(characterId)
    if (!character) {
      throw new Error(`角色不存在: ${characterId}`)
    }
    return JSON.stringify(character, null, 2)
  }

  /**
   * 导入角色配置
   */
  importCharacterConfig(configJson: string): void {
    try {
      const config: CharacterConfig = JSON.parse(configJson)
      this.registerCharacter(config)
    } catch (error) {
      throw new Error(`导入角色配置失败: ${error}`)
    }
  }

  /**
   * 扫描目录中的Live2D资源
   */
  async scanResourceDirectory(directoryPath: string): Promise<ResourceScanResult> {
    const result: ResourceScanResult = {
      modelFiles: [],
      textureFiles: [],
      motionFiles: [],
      expressionFiles: [],
      configFiles: [],
      previewImages: []
    }

    try {
      const files = await this.getAllFilesRecursively(directoryPath)
      
      for (const file of files) {
        const ext = file.toLowerCase().split('.').pop()
        const relativePath = file.replace(directoryPath, '').replace(/^[\/\\]/, '')
        
        switch (ext) {
          case 'json':
            if (file.includes('model') || file.includes('.model3.json')) {
              result.modelFiles.push(relativePath)
            } else if (file.includes('motion')) {
              result.motionFiles.push(relativePath)
            } else if (file.includes('expression')) {
              result.expressionFiles.push(relativePath)
            } else {
              result.configFiles.push(relativePath)
            }
            break
          case 'png':
          case 'jpg':
          case 'jpeg':
            if (file.includes('preview') || file.includes('thumbnail')) {
              result.previewImages.push(relativePath)
            } else {
              result.textureFiles.push(relativePath)
            }
            break
          case 'moc3':
            // Live2D模型文件
            break
          case 'cdi3':
          case 'can3':
            // Live2D动画文件
            break
        }
      }
    } catch (error) {
      console.error('扫描资源目录失败:', error)
    }

    return result
  }

  /**
   * 递归获取目录下所有文件
   */
  private async getAllFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFilesRecursively(fullPath)
          files.push(...subFiles)
        } else {
          files.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`读取目录失败: ${dir}`, error)
    }
    
    return files
  }

  /**
   * 验证角色资源
   */
  async validateCharacterResources(config: CharacterConfig): Promise<ResourceValidationResult> {
    const result: ResourceValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      missingFiles: [],
      suggestions: []
    }

    try {
      // 验证模型文件
      if (!config.modelConfig.modelPath) {
        result.errors.push('缺少模型路径配置')
        result.isValid = false
      } else {
        const modelExists = await this.fileExists(config.modelConfig.modelPath)
        if (!modelExists) {
          result.errors.push(`模型文件不存在: ${config.modelConfig.modelPath}`)
          result.missingFiles.push(config.modelConfig.modelPath)
          result.isValid = false
        }
      }

      // 验证预览图片
      if (config.modelConfig.previewImage) {
        const previewExists = await this.fileExists(config.modelConfig.previewImage)
        if (!previewExists) {
          result.warnings.push(`预览图片不存在: ${config.modelConfig.previewImage}`)
          result.missingFiles.push(config.modelConfig.previewImage)
        }
      } else {
        result.suggestions.push('建议添加预览图片')
      }

      // 验证缩略图
      if (config.metadata.thumbnailUrl) {
        const thumbnailExists = await this.fileExists(config.metadata.thumbnailUrl)
        if (!thumbnailExists) {
          result.warnings.push(`缩略图不存在: ${config.metadata.thumbnailUrl}`)
          result.missingFiles.push(config.metadata.thumbnailUrl)
        }
      }

      // 验证预设配置
      if (config.presets.length === 0) {
        result.warnings.push('没有配置预设')
        result.suggestions.push('建议至少添加一个默认预设')
      }

      // 验证元数据完整性
      if (!config.metadata.version) {
        result.warnings.push('缺少版本信息')
      }
      
      if (!config.metadata.author) {
        result.warnings.push('缺少作者信息')
      }

      if (config.metadata.features.motionCount === 0) {
        result.suggestions.push('建议添加动作配置')
      }

      if (config.metadata.features.expressionCount === 0) {
        result.suggestions.push('建议添加表情配置')
      }

    } catch (error) {
      result.errors.push(`验证过程出错: ${error}`)
      result.isValid = false
    }

    return result
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 从资源扫描结果生成角色配置
   */
  generateCharacterConfigFromScan(
    scanResult: ResourceScanResult,
    basePath: string,
    characterInfo: {
      id: string
      name: string
      displayName: string
      category: string
      description?: string
    }
  ): CharacterConfig {
    const modelFile = scanResult.modelFiles[0] // 使用第一个模型文件
    const previewImage = scanResult.previewImages[0] // 使用第一个预览图片
    
    const config: CharacterConfig = {
      id: characterInfo.id,
      name: characterInfo.name,
      displayName: characterInfo.displayName,
      description: characterInfo.description || `${characterInfo.displayName}的Live2D模型`,
      category: characterInfo.category,
      tags: [characterInfo.category, 'live2d'],
      modelConfig: {
        id: characterInfo.id,
        name: characterInfo.displayName,
        modelPath: modelFile ? join(basePath, modelFile) : '',
        previewImage: previewImage ? join(basePath, previewImage) : undefined,
        category: characterInfo.category,
        tags: [characterInfo.category, 'live2d'],
        author: 'Unknown',
        license: 'Unknown'
      },
      defaultRenderConfig: {
        scale: 0.8,
        position: { x: 0, y: -50 },
        enablePhysics: true,
        enableBreathing: true,
        enableEyeBlink: true,
        enableEyeTracking: false,
        enableLipSync: false
      },
      presets: [
        {
          id: 'default',
          name: '默认',
          description: '默认显示设置',
          renderConfig: {
            scale: 0.8,
            position: { x: 0, y: -50 }
          }
        }
      ],
      metadata: {
        version: '1.0.0',
        author: 'Unknown',
        license: 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnailUrl: previewImage ? join(basePath, previewImage) : undefined,
        previewImages: scanResult.previewImages.map(img => join(basePath, img)),
        size: {
          width: 512,
          height: 768,
          fileSize: 0 // 需要实际计算
        },
        features: {
          hasPhysics: true,
          hasBreathing: true,
          hasEyeBlink: true,
          hasEyeTracking: false,
          hasLipSync: false,
          motionCount: scanResult.motionFiles.length,
          expressionCount: scanResult.expressionFiles.length
        }
      }
    }

    return config
  }

  /**
   * 保存角色配置到文件
   */
  async saveCharacterConfigToFile(config: CharacterConfig, filePath: string): Promise<void> {
    try {
      // 确保目录存在
      const dir = dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      
      // 保存配置
      const configJson = JSON.stringify(config, null, 2)
      await fs.writeFile(filePath, configJson, 'utf-8')
      
      console.log(`角色配置已保存: ${filePath}`)
    } catch (error) {
      throw new Error(`保存配置文件失败: ${error}`)
    }
  }

  /**
   * 从文件加载角色配置
   */
  async loadCharacterConfigFromFile(filePath: string): Promise<CharacterConfig> {
    try {
      const configJson = await fs.readFile(filePath, 'utf-8')
      const config: CharacterConfig = JSON.parse(configJson)
      return config
    } catch (error) {
      throw new Error(`加载配置文件失败: ${error}`)
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 卸载所有角色
    const loadedIds = Array.from(this.loadedCharacters.keys())
    for (const characterId of loadedIds) {
      await this.unloadCharacter(characterId)
    }

    // 清理事件监听器
    this.eventListeners.clear()

    // 重置状态
    this.currentCharacter = null
    this.currentPreset = null
    this.setLoadState(CharacterLoadState.IDLE)
  }
}

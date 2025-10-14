import { AnimationPreset } from '../../components/Character/Animations/AnimationPresets'

/**
 * 动画预设存储服务
 * 负责管理动画预设的持久化存储
 */
export class AnimationPresetService {
  private static instance: AnimationPresetService
  private readonly storageKey = 'animation-presets'
  private presets: AnimationPreset[] = []
  private listeners: Set<(presets: AnimationPreset[]) => void> = new Set()

  private constructor() {
    this.loadPresets()
  }

  /**
   * 获取服务实例
   */
  public static getInstance(): AnimationPresetService {
    if (!AnimationPresetService.instance) {
      AnimationPresetService.instance = new AnimationPresetService()
    }
    return AnimationPresetService.instance
  }

  /**
   * 从本地存储加载预设
   */
  private loadPresets(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.presets = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load animation presets:', error)
      this.presets = []
    }
  }

  /**
   * 保存预设到本地存储
   */
  private savePresets(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.presets))
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to save animation presets:', error)
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.presets])
      } catch (error) {
        console.error('Error in preset listener:', error)
      }
    })
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取所有预设
   */
  public getPresets(): AnimationPreset[] {
    return [...this.presets]
  }

  /**
   * 根据ID获取预设
   */
  public getPreset(id: string): AnimationPreset | undefined {
    return this.presets.find(preset => preset.id === id)
  }

  /**
   * 创建新预设
   */
  public createPreset(presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>): AnimationPreset {
    const now = Date.now()
    const preset: AnimationPreset = {
      ...presetData,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }

    this.presets.push(preset)
    this.savePresets()
    return preset
  }

  /**
   * 更新预设
   */
  public updatePreset(id: string, presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>): AnimationPreset | null {
    const index = this.presets.findIndex(preset => preset.id === id)
    if (index === -1) {
      return null
    }

    const existingPreset = this.presets[index]
    const updatedPreset: AnimationPreset = {
      ...presetData,
      id: existingPreset.id,
      createdAt: existingPreset.createdAt,
      updatedAt: Date.now()
    }

    this.presets[index] = updatedPreset
    this.savePresets()
    return updatedPreset
  }

  /**
   * 删除预设
   */
  public deletePreset(id: string): boolean {
    const index = this.presets.findIndex(preset => preset.id === id)
    if (index === -1) {
      return false
    }

    this.presets.splice(index, 1)
    this.savePresets()
    return true
  }

  /**
   * 切换收藏状态
   */
  public toggleFavorite(id: string): boolean {
    const preset = this.presets.find(preset => preset.id === id)
    if (!preset) {
      return false
    }

    preset.isFavorite = !preset.isFavorite
    preset.updatedAt = Date.now()
    this.savePresets()
    return true
  }

  /**
   * 复制预设
   */
  public duplicatePreset(id: string, newName?: string): AnimationPreset | null {
    const originalPreset = this.presets.find(preset => preset.id === id)
    if (!originalPreset) {
      return null
    }

    const duplicatedPreset = this.createPreset({
      ...originalPreset,
      name: newName || `${originalPreset.name} (副本)`,
      isFavorite: false // 复制的预设默认不收藏
    })

    return duplicatedPreset
  }

  /**
   * 根据标签获取预设
   */
  public getPresetsByTag(tag: string): AnimationPreset[] {
    return this.presets.filter(preset => 
      preset.tags?.includes(tag)
    )
  }

  /**
   * 获取收藏的预设
   */
  public getFavoritePresets(): AnimationPreset[] {
    return this.presets.filter(preset => preset.isFavorite)
  }

  /**
   * 搜索预设
   */
  public searchPresets(query: string): AnimationPreset[] {
    if (!query.trim()) {
      return [...this.presets]
    }

    const lowerQuery = query.toLowerCase()
    return this.presets.filter(preset =>
      preset.name.toLowerCase().includes(lowerQuery) ||
      preset.description?.toLowerCase().includes(lowerQuery) ||
      preset.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * 获取所有标签
   */
  public getAllTags(): string[] {
    const tags = new Set<string>()
    this.presets.forEach(preset => {
      preset.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  /**
   * 导出预设
   */
  public exportPresets(presetIds?: string[]): string {
    const presetsToExport = presetIds 
      ? this.presets.filter(preset => presetIds.includes(preset.id))
      : this.presets

    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      presets: presetsToExport
    }, null, 2)
  }

  /**
   * 导入预设
   */
  public importPresets(jsonData: string): { success: number; errors: string[] } {
    const result = { success: 0, errors: [] as string[] }

    try {
      const data = JSON.parse(jsonData)
      
      if (!data.presets || !Array.isArray(data.presets)) {
        result.errors.push('Invalid format: presets array not found')
        return result
      }

      data.presets.forEach((presetData: any, index: number) => {
        try {
          // 验证预设数据
          if (!presetData.name || !presetData.animations || !Array.isArray(presetData.animations)) {
            result.errors.push(`Preset ${index + 1}: Invalid preset data`)
            return
          }

          // 检查是否已存在同名预设
          const existingPreset = this.presets.find(p => p.name === presetData.name)
          if (existingPreset) {
            result.errors.push(`Preset "${presetData.name}": Name already exists`)
            return
          }

          // 创建预设
          this.createPreset({
            name: presetData.name,
            description: presetData.description,
            animations: presetData.animations,
            tags: presetData.tags || [],
            isFavorite: false // 导入的预设默认不收藏
          })

          result.success++
        } catch (error) {
          result.errors.push(`Preset ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      })
    } catch (error) {
      result.errors.push(`JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * 清空所有预设
   */
  public clearAllPresets(): void {
    this.presets = []
    this.savePresets()
  }

  /**
   * 添加变更监听器
   */
  public addListener(listener: (presets: AnimationPreset[]) => void): () => void {
    this.listeners.add(listener)
    
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 获取预设统计信息
   */
  public getStats(): {
    total: number
    favorites: number
    tags: number
    averageAnimationsPerPreset: number
  } {
    const total = this.presets.length
    const favorites = this.presets.filter(p => p.isFavorite).length
    const tags = this.getAllTags().length
    const totalAnimations = this.presets.reduce((sum, preset) => sum + preset.animations.length, 0)
    const averageAnimationsPerPreset = total > 0 ? Math.round(totalAnimations / total * 10) / 10 : 0

    return {
      total,
      favorites,
      tags,
      averageAnimationsPerPreset
    }
  }
}

// 导出默认实例
export const animationPresetService = AnimationPresetService.getInstance()

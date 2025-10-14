import { useState, useEffect, useCallback } from 'react'
import { AnimationPreset } from '../components/Character/Animations/AnimationPresets'
import { animationPresetService } from '../services/animation/AnimationPresetService'

/**
 * 动画预设管理Hook
 */
export const useAnimationPresets = () => {
  const [presets, setPresets] = useState<AnimationPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载预设
  useEffect(() => {
    try {
      const initialPresets = animationPresetService.getPresets()
      setPresets(initialPresets)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets')
      setLoading(false)
    }
  }, [])

  // 监听预设变化
  useEffect(() => {
    const unsubscribe = animationPresetService.addListener((updatedPresets) => {
      setPresets(updatedPresets)
    })

    return unsubscribe
  }, [])

  // 创建预设
  const createPreset = useCallback(async (presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newPreset = animationPresetService.createPreset(presetData)
      return newPreset
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create preset'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 更新预设
  const updatePreset = useCallback(async (id: string, presetData: Omit<AnimationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updatedPreset = animationPresetService.updatePreset(id, presetData)
      if (!updatedPreset) {
        throw new Error('Preset not found')
      }
      return updatedPreset
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preset'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 删除预设
  const deletePreset = useCallback(async (id: string) => {
    try {
      const success = animationPresetService.deletePreset(id)
      if (!success) {
        throw new Error('Preset not found')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete preset'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 切换收藏状态
  const toggleFavorite = useCallback(async (id: string) => {
    try {
      const success = animationPresetService.toggleFavorite(id)
      if (!success) {
        throw new Error('Preset not found')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle favorite'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 复制预设
  const duplicatePreset = useCallback(async (id: string, newName?: string) => {
    try {
      const duplicatedPreset = animationPresetService.duplicatePreset(id, newName)
      if (!duplicatedPreset) {
        throw new Error('Preset not found')
      }
      return duplicatedPreset
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate preset'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 获取预设
  const getPreset = useCallback((id: string) => {
    return animationPresetService.getPreset(id)
  }, [])

  // 根据标签获取预设
  const getPresetsByTag = useCallback((tag: string) => {
    return animationPresetService.getPresetsByTag(tag)
  }, [])

  // 获取收藏预设
  const getFavoritePresets = useCallback(() => {
    return animationPresetService.getFavoritePresets()
  }, [])

  // 搜索预设
  const searchPresets = useCallback((query: string) => {
    return animationPresetService.searchPresets(query)
  }, [])

  // 获取所有标签
  const getAllTags = useCallback(() => {
    return animationPresetService.getAllTags()
  }, [])

  // 导出预设
  const exportPresets = useCallback((presetIds?: string[]) => {
    try {
      return animationPresetService.exportPresets(presetIds)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export presets'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 导入预设
  const importPresets = useCallback(async (jsonData: string) => {
    try {
      const result = animationPresetService.importPresets(jsonData)
      if (result.errors.length > 0) {
        console.warn('Import warnings:', result.errors)
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import presets'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 清空所有预设
  const clearAllPresets = useCallback(async () => {
    try {
      animationPresetService.clearAllPresets()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear presets'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // 获取统计信息
  const getStats = useCallback(() => {
    return animationPresetService.getStats()
  }, [])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // 状态
    presets,
    loading,
    error,

    // 基本操作
    createPreset,
    updatePreset,
    deletePreset,
    getPreset,

    // 收藏和复制
    toggleFavorite,
    duplicatePreset,

    // 查询操作
    getPresetsByTag,
    getFavoritePresets,
    searchPresets,
    getAllTags,

    // 导入导出
    exportPresets,
    importPresets,
    clearAllPresets,

    // 统计和工具
    getStats,
    clearError
  }
}

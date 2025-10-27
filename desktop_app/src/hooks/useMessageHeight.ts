/**
 * 消息高度缓存 Hook
 * 
 * 用于缓存和管理消息项的动态高度，提升虚拟滚动性能：
 * - 自动测量消息高度
 * - 高度缓存和持久化
 * - 动态高度估算
 * - 高度变化检测
 * - 批量更新优化
 */

import { useRef, useCallback, useMemo } from 'react'
import type { ChatMessage } from '@/types/chat'

// ==================== 类型定义 ====================

/**
 * 高度缓存项
 */
interface HeightCacheItem {
  /** 消息 ID */
  id: string
  /** 实际高度 */
  height: number
  /** 时间戳 */
  timestamp: number
  /** 内容哈希（用于检测变化） */
  contentHash: string
}

/**
 * 高度估算配置
 */
interface HeightEstimateConfig {
  /** 默认高度 */
  defaultHeight: number
  /** 最小高度 */
  minHeight: number
  /** 最大高度 */
  maxHeight: number
  /** 用户消息平均高度 */
  userMessageHeight: number
  /** 助手消息平均高度 */
  assistantMessageHeight: number
  /** 系统消息平均高度 */
  systemMessageHeight: number
}

/**
 * Hook 配置
 */
interface UseMessageHeightConfig {
  /** 是否启用持久化缓存 */
  enablePersistence?: boolean
  /** 缓存键前缀 */
  cacheKeyPrefix?: string
  /** 缓存最大数量 */
  maxCacheSize?: number
  /** 缓存过期时间（毫秒） */
  cacheExpiry?: number
  /** 高度估算配置 */
  estimateConfig?: Partial<HeightEstimateConfig>
}

/**
 * Hook 返回值
 */
interface UseMessageHeightReturn {
  /** 获取消息高度（如果没有缓存则返回估算值） */
  getHeight: (message: ChatMessage) => number
  /** 设置消息高度 */
  setHeight: (messageId: string, height: number, content: string) => void
  /** 批量设置高度 */
  batchSetHeights: (heights: Array<{ id: string; height: number; content: string }>) => void
  /** 清除所有缓存 */
  clearCache: () => void
  /** 清除特定消息的缓存 */
  clearMessageCache: (messageId: string) => void
  /** 获取平均高度 */
  getAverageHeight: () => number
  /** 获取缓存统计 */
  getCacheStats: () => {
    size: number
    hits: number
    misses: number
    avgHeight: number
  }
  /** 估算消息高度 */
  estimateHeight: (message: ChatMessage) => number
}

// ==================== 常量 ====================

const DEFAULT_CONFIG: Required<UseMessageHeightConfig> = {
  enablePersistence: true,
  cacheKeyPrefix: 'zishu_message_height_',
  maxCacheSize: 1000,
  cacheExpiry: 24 * 60 * 60 * 1000, // 24小时
  estimateConfig: {
    defaultHeight: 120,
    minHeight: 60,
    maxHeight: 1200,
    userMessageHeight: 100,
    assistantMessageHeight: 150,
    systemMessageHeight: 80,
  },
}

// ==================== 辅助函数 ====================

/**
 * 计算内容哈希（简单版本）
 */
const hashContent = (content: string): string => {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

/**
 * 从消息提取文本内容
 */
const extractContent = (message: ChatMessage): string => {
  return typeof message.content === 'string'
    ? message.content
    : message.content.text || ''
}

/**
 * 估算文本高度
 */
const estimateTextHeight = (
  text: string,
  baseHeight: number,
  lineHeight: number = 24
): number => {
  const charCount = text.length
  const estimatedLines = Math.ceil(charCount / 50) // 假设每行约50个字符
  return Math.max(baseHeight, estimatedLines * lineHeight + 60) // 60px为padding和头部
}

// ==================== 主 Hook ====================

/**
 * 使用消息高度缓存
 */
export const useMessageHeight = (
  config: UseMessageHeightConfig = {}
): UseMessageHeightReturn => {
  // 合并配置
  const fullConfig = useMemo((): Required<UseMessageHeightConfig> => ({
    ...DEFAULT_CONFIG,
    ...config,
    estimateConfig: {
      ...DEFAULT_CONFIG.estimateConfig,
      ...config.estimateConfig,
    } as Required<HeightEstimateConfig>,
  }), [config])

  // 高度缓存
  const cacheRef = useRef<Map<string, HeightCacheItem>>(new Map())
  
  // 统计信息
  const statsRef = useRef({
    hits: 0,
    misses: 0,
  })

  // ==================== 持久化 ====================

  /**
   * 从 localStorage 加载缓存
   */
  const loadCache = useCallback(() => {
    if (!fullConfig.enablePersistence) return

    try {
      const stored = localStorage.getItem(`${fullConfig.cacheKeyPrefix}cache`)
      if (stored) {
        const data = JSON.parse(stored) as HeightCacheItem[]
        const now = Date.now()
        
        // 过滤过期项
        const validItems = data.filter(
          (item) => now - item.timestamp < fullConfig.cacheExpiry
        )
        
        validItems.forEach((item) => {
          cacheRef.current.set(item.id, item)
        })
      }
    } catch (error) {
      console.warn('加载高度缓存失败:', error)
    }
  }, [fullConfig.enablePersistence, fullConfig.cacheKeyPrefix, fullConfig.cacheExpiry])

  /**
   * 保存缓存到 localStorage
   */
  const saveCache = useCallback(() => {
    if (!fullConfig.enablePersistence) return

    try {
      const data = Array.from(cacheRef.current.values())
      
      // 限制缓存大小
      const sortedData = data
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, fullConfig.maxCacheSize)
      
      localStorage.setItem(
        `${fullConfig.cacheKeyPrefix}cache`,
        JSON.stringify(sortedData)
      )
    } catch (error) {
      console.warn('保存高度缓存失败:', error)
    }
  }, [fullConfig.enablePersistence, fullConfig.cacheKeyPrefix, fullConfig.maxCacheSize])

  // 初始化时加载缓存
  useMemo(() => {
    loadCache()
  }, [loadCache])

  // ==================== 高度估算 ====================

  /**
   * 估算消息高度
   */
  const estimateHeight = useCallback(
    (message: ChatMessage): number => {
      const ec = fullConfig.estimateConfig
      const content = extractContent(message)
      
      // 根据角色选择基础高度
      let baseHeight = ec.defaultHeight!
      switch (message.role) {
        case 'user':
          baseHeight = ec.userMessageHeight!
          break
        case 'assistant':
          baseHeight = ec.assistantMessageHeight!
          break
        case 'system':
          baseHeight = ec.systemMessageHeight!
          break
      }
      
      // 根据内容长度调整
      const estimatedHeight = estimateTextHeight(content, baseHeight)
      
      // 限制在最小和最大值之间
      return Math.min(
        Math.max(estimatedHeight, ec.minHeight!),
        ec.maxHeight!
      )
    },
    [fullConfig]
  )

  // ==================== 缓存操作 ====================

  /**
   * 获取消息高度
   */
  const getHeight = useCallback(
    (message: ChatMessage): number => {
      const cached = cacheRef.current.get(message.id)
      
      if (cached) {
        // 检查内容是否变化
        const currentContent = extractContent(message)
        const currentHash = hashContent(currentContent)
        
        if (cached.contentHash === currentHash) {
          statsRef.current.hits++
          return cached.height
        }
        
        // 内容变化，删除旧缓存
        cacheRef.current.delete(message.id)
      }
      
      // 缓存未命中，返回估算高度
      statsRef.current.misses++
      return estimateHeight(message)
    },
    [estimateHeight]
  )

  /**
   * 设置消息高度
   */
  const setHeight = useCallback(
    (messageId: string, height: number, content: string) => {
      // 验证高度值
      if (!height || height < 0 || !isFinite(height)) {
        console.warn('无效的高度值:', height)
        return
      }
      
      const contentHash = hashContent(content)
      const item: HeightCacheItem = {
        id: messageId,
        height,
        timestamp: Date.now(),
        contentHash,
      }
      
      cacheRef.current.set(messageId, item)
      
      // 定期保存缓存（使用防抖）
      if (cacheRef.current.size % 10 === 0) {
        saveCache()
      }
    },
    [saveCache]
  )

  /**
   * 批量设置高度
   */
  const batchSetHeights = useCallback(
    (heights: Array<{ id: string; height: number; content: string }>) => {
      heights.forEach(({ id, height, content }) => {
        if (height && height > 0 && isFinite(height)) {
          const contentHash = hashContent(content)
          const item: HeightCacheItem = {
            id,
            height,
            timestamp: Date.now(),
            contentHash,
          }
          cacheRef.current.set(id, item)
        }
      })
      
      saveCache()
    },
    [saveCache]
  )

  /**
   * 清除所有缓存
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    statsRef.current.hits = 0
    statsRef.current.misses = 0
    
    if (fullConfig.enablePersistence) {
      try {
        localStorage.removeItem(`${fullConfig.cacheKeyPrefix}cache`)
      } catch (error) {
        console.warn('清除缓存失败:', error)
      }
    }
  }, [fullConfig.enablePersistence, fullConfig.cacheKeyPrefix])

  /**
   * 清除特定消息的缓存
   */
  const clearMessageCache = useCallback((messageId: string) => {
    cacheRef.current.delete(messageId)
  }, [])

  // ==================== 统计信息 ====================

  /**
   * 获取平均高度
   */
  const getAverageHeight = useCallback((): number => {
    const heights = Array.from(cacheRef.current.values()).map((item) => item.height)
    if (heights.length === 0) {
      return fullConfig.estimateConfig.defaultHeight!
    }
    
    const sum = heights.reduce((acc, h) => acc + h, 0)
    return Math.round(sum / heights.length)
  }, [fullConfig.estimateConfig.defaultHeight])

  /**
   * 获取缓存统计
   */
  const getCacheStats = useCallback(() => {
    const avgHeight = getAverageHeight()
    
    return {
      size: cacheRef.current.size,
      hits: statsRef.current.hits,
      misses: statsRef.current.misses,
      avgHeight,
    }
  }, [getAverageHeight])

  // ==================== 返回值 ====================

  return {
    getHeight,
    setHeight,
    batchSetHeights,
    clearCache,
    clearMessageCache,
    getAverageHeight,
    getCacheStats,
    estimateHeight,
  }
}

export default useMessageHeight


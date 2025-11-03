/**
 * 虚拟滚动 Hook
 * 
 * 基于 @tanstack/react-virtual 的高性能虚拟滚动实现：
 * - 动态高度支持
 * - 平滑滚动
 * - 自动滚动到底部
 * - 滚动位置保持
 * - 性能优化
 * - 边界检测
 */

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMessage } from '@/types/chat'
import { useMessageHeight } from './useMessageHeight'

// ==================== 类型定义 ====================

/**
 * 虚拟滚动配置
 */
export interface VirtualScrollConfig {
  /** 是否启用虚拟滚动 */
  enabled?: boolean
  /** 启用虚拟滚动的最小消息数 */
  threshold?: number
  /** 预渲染项数（上方） */
  overscanBefore?: number
  /** 预渲染项数（下方） */
  overscanAfter?: number
  /** 是否启用平滑滚动 */
  smoothScroll?: boolean
  /** 滚动对齐方式 */
  scrollAlignment?: 'start' | 'center' | 'end' | 'auto'
  /** 是否启用高度缓存 */
  enableHeightCache?: boolean
  /** 初始滚动偏移量 */
  initialScrollOffset?: number
  /** 滚动行为 */
  scrollBehavior?: ScrollBehavior
}

/**
 * 虚拟滚动项数据
 */
export interface VirtualScrollItem {
  /** 索引 */
  index: number
  /** 起始位置 */
  start: number
  /** 大小 */
  size: number
  /** 结束位置 */
  end: number
  /** 键值 */
  key: string | number
  /** 消息数据 */
  message: ChatMessage
}

/**
 * Hook 返回值
 */
export interface UseVirtualScrollReturn {
  /** 虚拟滚动项列表 */
  virtualItems: VirtualScrollItem[]
  /** 总高度 */
  totalSize: number
  /** 滚动到指定索引 */
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
  /** 滚动到底部 */
  scrollToBottom: (behavior?: ScrollBehavior) => void
  /** 滚动到顶部 */
  scrollToTop: (behavior?: ScrollBehavior) => void
  /** 测量元素高度 */
  measureElement: (element: HTMLElement | null) => void
  /** 获取虚拟项 */
  getVirtualItem: (index: number) => VirtualScrollItem | undefined
  /** 是否在底部 */
  isAtBottom: boolean
  /** 是否在顶部 */
  isAtTop: boolean
  /** 可见范围 */
  visibleRange: { start: number; end: number }
  /** 滚动容器引用 */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  /** 是否启用虚拟滚动 */
  isVirtualScrollEnabled: boolean
}

/**
 * 滚动到选项
 */
interface ScrollToOptions {
  /** 对齐方式 */
  align?: 'start' | 'center' | 'end' | 'auto'
  /** 滚动行为 */
  behavior?: ScrollBehavior
}

// ==================== 常量 ====================

const DEFAULT_CONFIG: Required<VirtualScrollConfig> = {
  enabled: true,
  threshold: 100,
  overscanBefore: 5,
  overscanAfter: 10,
  smoothScroll: true,
  scrollAlignment: 'auto',
  enableHeightCache: true,
  initialScrollOffset: 0,
  scrollBehavior: 'smooth',
}

const BOTTOM_THRESHOLD = 50 // 距离底部多少像素算作在底部
const TOP_THRESHOLD = 50 // 距离顶部多少像素算作在顶部

// ==================== 主 Hook ====================

/**
 * 使用虚拟滚动
 */
export const useVirtualScroll = (
  messages: ChatMessage[],
  config: VirtualScrollConfig = {}
): UseVirtualScrollReturn => {
  // 合并配置
  const fullConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  )

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // 上一次滚动位置
  const lastScrollTopRef = useRef(0)
  
  // 是否在底部
  const isAtBottomRef = useRef(true)
  
  // 是否在顶部
  const isAtTopRef = useRef(false)

  // 消息高度管理
  const messageHeightHook = useMessageHeight({
    enablePersistence: fullConfig.enableHeightCache,
  })

  // 判断是否启用虚拟滚动
  const isVirtualScrollEnabled = useMemo(() => {
    return fullConfig.enabled && messages.length >= fullConfig.threshold
  }, [fullConfig.enabled, fullConfig.threshold, messages.length])

  // ==================== 虚拟滚动器 ====================

  /**
   * 创建虚拟滚动器
   */
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const message = messages[index]
        return message ? messageHeightHook.getHeight(message) : 120
      },
      [messages, messageHeightHook]
    ),
    overscan: fullConfig.overscanBefore + fullConfig.overscanAfter,
    // 启用动态高度测量
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element: HTMLElement) => element?.getBoundingClientRect().height
        : undefined,
    // 滚动边距
    scrollMargin: 0,
    // 初始偏移
    initialOffset: fullConfig.initialScrollOffset,
  })

  // ==================== 虚拟项处理 ====================

  /**
   * 增强的虚拟项列表（包含消息数据）
   */
  const virtualItems = useMemo((): VirtualScrollItem[] => {
    return virtualizer.getVirtualItems().map((virtualItem: any) => ({
      ...virtualItem,
      message: messages[virtualItem.index],
    }))
  }, [virtualizer, messages])

  // ==================== 滚动控制 ====================

  /**
   * 滚动到指定索引
   */
  const scrollToIndex = useCallback(
    (index: number, options: ScrollToOptions = {}) => {
      const align = options.align || fullConfig.scrollAlignment
      const behavior = options.behavior || fullConfig.scrollBehavior
      
      const scrollOptions: any = { align }
      if (behavior) {
        scrollOptions.behavior = behavior
      }
      virtualizer.scrollToIndex(index, scrollOptions)
    },
    [virtualizer, fullConfig.scrollAlignment, fullConfig.scrollBehavior]
  )

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = fullConfig.scrollBehavior) => {
      if (messages.length === 0) return
      
      const lastIndex = messages.length - 1
      scrollToIndex(lastIndex, { align: 'end', behavior })
      
      // 确保滚动到最底部
      setTimeout(() => {
        const container = scrollContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 100)
    },
    [messages.length, scrollToIndex, fullConfig.scrollBehavior]
  )

  /**
   * 滚动到顶部
   */
  const scrollToTop = useCallback(
    (behavior: ScrollBehavior = fullConfig.scrollBehavior) => {
      scrollToIndex(0, { align: 'start', behavior })
    },
    [scrollToIndex, fullConfig.scrollBehavior]
  )

  // ==================== 高度测量 ====================

  /**
   * 测量元素高度并缓存
   */
  const measureElement = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      
      const messageId = element.getAttribute('data-message-id')
      const messageIndex = element.getAttribute('data-index')
      
      if (messageId && messageIndex) {
        const height = element.getBoundingClientRect().height
        const index = parseInt(messageIndex, 10)
        const message = messages[index]
        
        if (message && height > 0) {
          // 保存到高度缓存
          const content = typeof message.content === 'string'
            ? message.content
            : message.content.text || ''
          
          messageHeightHook.setHeight(messageId, height, content)
          
          // 通知虚拟滚动器重新测量
          virtualizer.measure()
        }
      }
    },
    [messages, messageHeightHook, virtualizer]
  )

  // ==================== 边界检测 ====================

  /**
   * 检查滚动位置
   */
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    
    // 检查是否在底部
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD
    isAtBottomRef.current = atBottom
    
    // 检查是否在顶部
    const atTop = scrollTop <= TOP_THRESHOLD
    isAtTopRef.current = atTop
    
    // 更新上一次滚动位置
    lastScrollTopRef.current = scrollTop
  }, [])

  /**
   * 监听滚动事件
   */
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const handleScroll = () => {
      checkScrollPosition()
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [checkScrollPosition])

  // ==================== 初始化 ====================

  /**
   * 初始化滚动位置
   */
  useEffect(() => {
    if (messages.length > 0 && fullConfig.initialScrollOffset === 0) {
      // 默认滚动到底部
      setTimeout(() => {
        scrollToBottom('auto')
      }, 100)
    }
  }, []) // 仅首次运行

  // ==================== 辅助方法 ====================

  /**
   * 获取虚拟项
   */
  const getVirtualItem = useCallback(
    (index: number): VirtualScrollItem | undefined => {
      return virtualItems.find((item) => item.index === index)
    },
    [virtualItems]
  )

  /**
   * 获取可见范围
   */
  const visibleRange = useMemo(() => {
    if (virtualItems.length === 0) {
      return { start: 0, end: 0 }
    }
    
    const start = virtualItems[0].index
    const end = virtualItems[virtualItems.length - 1].index
    
    return { start, end }
  }, [virtualItems])

  // ==================== 返回值 ====================

  return {
    virtualItems,
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex,
    scrollToBottom,
    scrollToTop,
    measureElement,
    getVirtualItem,
    isAtBottom: isAtBottomRef.current,
    isAtTop: isAtTopRef.current,
    visibleRange,
    scrollContainerRef,
    isVirtualScrollEnabled,
  }
}

export default useVirtualScroll


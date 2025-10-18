/**
 * 虚拟滚动类型定义
 * 
 * 定义虚拟滚动相关的类型、接口和配置
 */

// ==================== 基础类型 ====================

/**
 * 滚动方向
 */
export enum ScrollDirection {
  /** 垂直滚动 */
  VERTICAL = 'vertical',
  /** 水平滚动 */
  HORIZONTAL = 'horizontal',
}

/**
 * 滚动对齐方式
 */
export enum ScrollAlign {
  /** 开始对齐 */
  START = 'start',
  /** 居中对齐 */
  CENTER = 'center',
  /** 结束对齐 */
  END = 'end',
  /** 自动对齐 */
  AUTO = 'auto',
}

/**
 * 滚动行为
 */
export enum ScrollBehaviorType {
  /** 平滑滚动 */
  SMOOTH = 'smooth',
  /** 立即滚动 */
  AUTO = 'auto',
  /** 瞬间滚动 */
  INSTANT = 'instant',
}

// ==================== 配置类型 ====================

/**
 * 虚拟滚动配置
 */
export interface VirtualScrollConfig {
  /** 是否启用虚拟滚动 */
  enabled?: boolean
  
  /** 启用虚拟滚动的最小项数阈值 */
  threshold?: number
  
  /** 滚动方向 */
  direction?: ScrollDirection
  
  /** 预渲染项数（可见区域上方） */
  overscanBefore?: number
  
  /** 预渲染项数（可见区域下方） */
  overscanAfter?: number
  
  /** 是否启用平滑滚动 */
  smoothScroll?: boolean
  
  /** 默认滚动对齐方式 */
  scrollAlignment?: ScrollAlign | 'start' | 'center' | 'end' | 'auto'
  
  /** 是否启用高度缓存 */
  enableHeightCache?: boolean
  
  /** 初始滚动偏移量（像素） */
  initialScrollOffset?: number
  
  /** 滚动行为 */
  scrollBehavior?: ScrollBehaviorType | ScrollBehavior
  
  /** 是否启用动态高度测量 */
  enableDynamicHeight?: boolean
  
  /** 估算项高度（像素） */
  estimatedItemHeight?: number
  
  /** 最小项高度（像素） */
  minItemHeight?: number
  
  /** 最大项高度（像素） */
  maxItemHeight?: number
}

/**
 * 高度估算配置
 */
export interface HeightEstimationConfig {
  /** 默认高度 */
  defaultHeight: number
  
  /** 最小高度 */
  minHeight: number
  
  /** 最大高度 */
  maxHeight: number
  
  /** 是否基于内容估算 */
  estimateByContent?: boolean
  
  /** 内容类型高度映射 */
  contentTypeHeights?: Record<string, number>
}

/**
 * 滚动位置配置
 */
export interface ScrollPositionConfig {
  /** 滚动位置（像素） */
  offset: number
  
  /** 对齐方式 */
  align?: ScrollAlign | 'start' | 'center' | 'end' | 'auto'
  
  /** 滚动行为 */
  behavior?: ScrollBehaviorType | ScrollBehavior
  
  /** 是否平滑滚动 */
  smooth?: boolean
}

/**
 * 虚拟项配置
 */
export interface VirtualItemConfig {
  /** 项索引 */
  index: number
  
  /** 项高度（像素） */
  height?: number
  
  /** 项宽度（像素） */
  width?: number
  
  /** 自定义数据 */
  data?: any
}

// ==================== 性能优化配置 ====================

/**
 * 性能优化配置
 */
export interface PerformanceConfig {
  /** 是否启用 RAF（requestAnimationFrame） */
  useRAF?: boolean
  
  /** 是否启用节流 */
  useThrottle?: boolean
  
  /** 节流延迟（毫秒） */
  throttleDelay?: number
  
  /** 是否启用防抖 */
  useDebounce?: boolean
  
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
  
  /** 是否启用批量更新 */
  useBatchUpdate?: boolean
  
  /** 批量更新大小 */
  batchSize?: number
  
  /** 是否启用内存回收 */
  enableGC?: boolean
  
  /** 内存回收间隔（毫秒） */
  gcInterval?: number
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled?: boolean
  
  /** 缓存类型 */
  type?: 'memory' | 'localStorage' | 'sessionStorage'
  
  /** 缓存键前缀 */
  keyPrefix?: string
  
  /** 最大缓存大小 */
  maxSize?: number
  
  /** 缓存过期时间（毫秒） */
  expiry?: number
  
  /** 是否自动清理过期缓存 */
  autoCleanup?: boolean
}

// ==================== 回调类型 ====================

/**
 * 滚动事件回调
 */
export type ScrollCallback = (event: {
  /** 滚动偏移量 */
  offset: number
  /** 滚动方向 */
  direction: 'up' | 'down' | 'left' | 'right'
  /** 是否在顶部 */
  isAtTop: boolean
  /** 是否在底部 */
  isAtBottom: boolean
  /** 可见范围 */
  visibleRange: { start: number; end: number }
}) => void

/**
 * 项渲染回调
 */
export type ItemRenderCallback<T = any> = (item: {
  /** 项索引 */
  index: number
  /** 项数据 */
  data: T
  /** 是否可见 */
  isVisible: boolean
  /** 测量回调 */
  measure: (height: number) => void
}) => React.ReactNode

/**
 * 测量完成回调
 */
export type MeasureCallback = (measurements: {
  /** 项索引 */
  index: number
  /** 测量高度 */
  height: number
  /** 测量宽度 */
  width: number
  /** 时间戳 */
  timestamp: number
}[]) => void

// ==================== 状态类型 ====================

/**
 * 虚拟滚动状态
 */
export interface VirtualScrollState {
  /** 总项数 */
  totalCount: number
  
  /** 可见项数 */
  visibleCount: number
  
  /** 可见范围 */
  visibleRange: { start: number; end: number }
  
  /** 当前滚动偏移量 */
  scrollOffset: number
  
  /** 总大小（像素） */
  totalSize: number
  
  /** 是否在顶部 */
  isAtTop: boolean
  
  /** 是否在底部 */
  isAtBottom: boolean
  
  /** 是否正在滚动 */
  isScrolling: boolean
  
  /** 滚动方向 */
  scrollDirection?: 'up' | 'down'
}

/**
 * 虚拟项状态
 */
export interface VirtualItemState {
  /** 项索引 */
  index: number
  
  /** 起始位置（像素） */
  start: number
  
  /** 结束位置（像素） */
  end: number
  
  /** 大小（像素） */
  size: number
  
  /** 是否可见 */
  isVisible: boolean
  
  /** 是否已测量 */
  isMeasured: boolean
  
  /** 偏移量 */
  offset: number
}

// ==================== 统计类型 ====================

/**
 * 性能统计
 */
export interface PerformanceStats {
  /** 渲染次数 */
  renderCount: number
  
  /** 平均渲染时间（毫秒） */
  avgRenderTime: number
  
  /** 最大渲染时间（毫秒） */
  maxRenderTime: number
  
  /** 最小渲染时间（毫秒） */
  minRenderTime: number
  
  /** 滚动事件次数 */
  scrollEventCount: number
  
  /** 测量次数 */
  measureCount: number
  
  /** 缓存命中率 */
  cacheHitRate: number
  
  /** 内存使用（字节） */
  memoryUsage?: number
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number
  
  /** 缓存命中次数 */
  hits: number
  
  /** 缓存未命中次数 */
  misses: number
  
  /** 平均项大小 */
  avgItemSize: number
  
  /** 总内存使用（字节） */
  totalMemory: number
}

// ==================== 默认配置 ====================

/**
 * 默认虚拟滚动配置
 */
export const DEFAULT_VIRTUAL_SCROLL_CONFIG: Required<VirtualScrollConfig> = {
  enabled: true,
  threshold: 100,
  direction: ScrollDirection.VERTICAL,
  overscanBefore: 5,
  overscanAfter: 10,
  smoothScroll: true,
  scrollAlignment: ScrollAlign.AUTO,
  enableHeightCache: true,
  initialScrollOffset: 0,
  scrollBehavior: 'smooth',
  enableDynamicHeight: true,
  estimatedItemHeight: 120,
  minItemHeight: 60,
  maxItemHeight: 1200,
}

/**
 * 默认高度估算配置
 */
export const DEFAULT_HEIGHT_ESTIMATION_CONFIG: Required<HeightEstimationConfig> = {
  defaultHeight: 120,
  minHeight: 60,
  maxHeight: 1200,
  estimateByContent: true,
  contentTypeHeights: {
    text: 100,
    image: 300,
    video: 400,
    code: 200,
    file: 80,
  },
}

/**
 * 默认性能配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: Required<PerformanceConfig> = {
  useRAF: true,
  useThrottle: true,
  throttleDelay: 16,
  useDebounce: false,
  debounceDelay: 150,
  useBatchUpdate: true,
  batchSize: 10,
  enableGC: true,
  gcInterval: 60000, // 60秒
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  enabled: true,
  type: 'localStorage',
  keyPrefix: 'virtual_scroll_',
  maxSize: 1000,
  expiry: 24 * 60 * 60 * 1000, // 24小时
  autoCleanup: true,
}

// ==================== 工具类型 ====================

/**
 * 部分配置类型
 */
export type PartialConfig<T> = {
  [P in keyof T]?: T[P] extends object ? PartialConfig<T[P]> : T[P]
}

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * 必需配置类型
 */
export type RequiredConfig<T> = {
  [P in keyof T]-?: T[P]
}


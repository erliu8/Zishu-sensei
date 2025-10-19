/**
 * 渲染优化系统 - 类型定义
 * 
 * 包含性能分析、虚拟化、动画优化和 WebGL 优化的类型定义
 */

// ============================================================================
// 性能分析类型
// ============================================================================

/**
 * 渲染性能指标
 */
export interface RenderMetrics {
  // 组件渲染时间（毫秒）
  renderTime: number;
  // 提交时间（毫秒）
  commitTime: number;
  // 渲染次数
  renderCount: number;
  // 组件名称
  componentName: string;
  // 时间戳
  timestamp: number;
  // 是否为首次渲染
  isInitialRender: boolean;
  // 渲染原因
  reason?: string;
  // 父组件
  parentComponent?: string;
}

/**
 * 性能分析报告
 */
export interface PerformanceReport {
  // 总渲染时间
  totalRenderTime: number;
  // 平均渲染时间
  averageRenderTime: number;
  // 最大渲染时间
  maxRenderTime: number;
  // 最小渲染时间
  minRenderTime: number;
  // 渲染次数
  renderCount: number;
  // 慢渲染组件列表（超过阈值）
  slowComponents: RenderMetrics[];
  // 频繁渲染组件列表
  frequentComponents: RenderMetrics[];
  // 分析时间范围
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * 性能监控配置
 */
export interface PerformanceConfig {
  // 是否启用性能监控
  enabled: boolean;
  // 慢渲染阈值（毫秒）
  slowRenderThreshold: number;
  // 频繁渲染阈值（次数）
  frequentRenderThreshold: number;
  // 采样率（0-1）
  samplingRate: number;
  // 是否记录渲染原因
  trackRenderReasons: boolean;
  // 最大记录数
  maxRecords: number;
}

// ============================================================================
// 虚拟化类型
// ============================================================================

/**
 * 虚拟化配置
 */
export interface VirtualizationConfig {
  // 项目高度（固定高度模式）
  itemHeight?: number;
  // 估算项目高度（动态高度模式）
  estimatedItemHeight?: number;
  // 过扫描数量（视口外渲染的项目数）
  overscanCount: number;
  // 滚动行为
  scrollBehavior: 'auto' | 'smooth';
  // 是否启用缓存
  enableCache: boolean;
  // 缓存大小
  cacheSize: number;
}

/**
 * 虚拟化项目数据
 */
export interface VirtualItem<T = any> {
  // 项目索引
  index: number;
  // 项目数据
  data: T;
  // 项目高度
  height?: number;
  // 是否可见
  isVisible: boolean;
  // 偏移量
  offset: number;
}

/**
 * 虚拟化状态
 */
export interface VirtualizationState {
  // 可见项目范围
  visibleRange: {
    start: number;
    end: number;
  };
  // 滚动偏移量
  scrollOffset: number;
  // 总高度
  totalHeight: number;
  // 可见项目数量
  visibleCount: number;
}

// ============================================================================
// 动画优化类型
// ============================================================================

/**
 * 动画配置
 */
export interface AnimationConfig {
  // 动画时长（毫秒）
  duration: number;
  // 缓动函数
  easing: EasingFunction;
  // 是否启用 GPU 加速
  useGPU: boolean;
  // 目标帧率
  targetFPS: number;
  // 是否使用 requestAnimationFrame
  useRAF: boolean;
  // 优先级
  priority: 'low' | 'normal' | 'high';
}

/**
 * 缓动函数类型
 */
export type EasingFunction =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'cubicBezier'
  | ((t: number) => number);

/**
 * 动画实例
 */
export interface AnimationInstance {
  // 动画 ID
  id: string;
  // 动画名称
  name: string;
  // 开始时间
  startTime: number;
  // 当前进度（0-1）
  progress: number;
  // 是否正在运行
  isRunning: boolean;
  // 配置
  config: AnimationConfig;
  // 取消动画
  cancel: () => void;
  // 暂停动画
  pause: () => void;
  // 恢复动画
  resume: () => void;
}

/**
 * 动画性能统计
 */
export interface AnimationStats {
  // 当前活动动画数量
  activeAnimations: number;
  // 平均帧率
  averageFPS: number;
  // 当前帧率
  currentFPS: number;
  // 掉帧数
  droppedFrames: number;
  // CPU 时间占用（毫秒）
  cpuTime: number;
  // GPU 时间占用（毫秒）
  gpuTime?: number;
}

// ============================================================================
// WebGL 优化类型
// ============================================================================

/**
 * WebGL 渲染配置
 */
export interface WebGLConfig {
  // 抗锯齿
  antialias: boolean;
  // 透明度
  alpha: boolean;
  // 深度缓冲
  depth: boolean;
  // 模板缓冲
  stencil: boolean;
  // 是否启用 GPU 加速
  powerPreference: 'default' | 'high-performance' | 'low-power';
  // 纹理过滤
  textureFiltering: 'nearest' | 'linear' | 'mipmap';
  // 最大纹理大小
  maxTextureSize: number;
}

/**
 * 纹理池配置
 */
export interface TexturePoolConfig {
  // 最大纹理数量
  maxTextures: number;
  // 纹理预加载数量
  preloadCount: number;
  // 是否启用压缩
  enableCompression: boolean;
  // 是否启用 Mipmap
  enableMipmap: boolean;
  // LRU 缓存大小
  cacheSize: number;
}

/**
 * 纹理信息
 */
export interface TextureInfo {
  // 纹理 ID
  id: string;
  // 纹理路径
  path: string;
  // 宽度
  width: number;
  // 高度
  height: number;
  // 内存大小（字节）
  memorySize: number;
  // 是否已加载
  isLoaded: boolean;
  // 最后使用时间
  lastUsedTime: number;
  // WebGL 纹理对象
  glTexture?: WebGLTexture;
}

/**
 * WebGL 性能统计
 */
export interface WebGLStats {
  // 绘制调用次数
  drawCalls: number;
  // 三角形数量
  triangles: number;
  // 纹理数量
  textureCount: number;
  // 纹理内存使用（字节）
  textureMemory: number;
  // 帧时间（毫秒）
  frameTime: number;
  // 渲染时间（毫秒）
  renderTime: number;
  // 是否启用 GPU
  gpuEnabled: boolean;
}

/**
 * LOD（细节层次）配置
 */
export interface LODConfig {
  // 距离阈值
  distances: number[];
  // LOD 级别模型
  models: string[];
  // 是否启用平滑过渡
  smoothTransition: boolean;
  // 过渡时间（毫秒）
  transitionDuration: number;
}

// ============================================================================
// 渲染优化配置
// ============================================================================

/**
 * 渲染优化全局配置
 */
export interface RenderOptimizationConfig {
  // 性能监控配置
  performance: PerformanceConfig;
  // 虚拟化配置
  virtualization: VirtualizationConfig;
  // 动画配置
  animation: AnimationConfig;
  // WebGL 配置
  webgl: WebGLConfig;
  // 纹理池配置
  texturePool: TexturePoolConfig;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 性能标记
 */
export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * 渲染批处理
 */
export interface RenderBatch {
  id: string;
  tasks: (() => void)[];
  priority: number;
  scheduled: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true,
  slowRenderThreshold: 16, // 16ms (60fps)
  frequentRenderThreshold: 10, // 10次渲染
  samplingRate: 0.1, // 10% 采样
  trackRenderReasons: true,
  maxRecords: 1000,
};

export const DEFAULT_VIRTUALIZATION_CONFIG: VirtualizationConfig = {
  estimatedItemHeight: 50,
  overscanCount: 3,
  scrollBehavior: 'auto',
  enableCache: true,
  cacheSize: 100,
};

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 300,
  easing: 'easeInOut',
  useGPU: true,
  targetFPS: 60,
  useRAF: true,
  priority: 'normal',
};

export const DEFAULT_WEBGL_CONFIG: WebGLConfig = {
  antialias: true,
  alpha: true,
  depth: true,
  stencil: false,
  powerPreference: 'high-performance',
  textureFiltering: 'linear',
  maxTextureSize: 4096,
};

export const DEFAULT_TEXTURE_POOL_CONFIG: TexturePoolConfig = {
  maxTextures: 50,
  preloadCount: 10,
  enableCompression: true,
  enableMipmap: true,
  cacheSize: 100,
};

export const DEFAULT_RENDER_OPTIMIZATION_CONFIG: RenderOptimizationConfig = {
  performance: DEFAULT_PERFORMANCE_CONFIG,
  virtualization: DEFAULT_VIRTUALIZATION_CONFIG,
  animation: DEFAULT_ANIMATION_CONFIG,
  webgl: DEFAULT_WEBGL_CONFIG,
  texturePool: DEFAULT_TEXTURE_POOL_CONFIG,
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化渲染时间
 */
export function formatRenderTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 计算 FPS
 */
export function calculateFPS(frameTime: number): number {
  return frameTime > 0 ? Math.round(1000 / frameTime) : 0;
}

/**
 * 判断是否为慢渲染
 */
export function isSlowRender(renderTime: number, threshold: number = 16): boolean {
  return renderTime > threshold;
}

/**
 * 判断是否为频繁渲染
 */
export function isFrequentRender(renderCount: number, threshold: number = 10): boolean {
  return renderCount > threshold;
}

/**
 * 获取渲染性能等级
 */
export function getRenderPerformanceLevel(
  renderTime: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (renderTime < 8) return 'excellent'; // 120fps+
  if (renderTime < 16) return 'good'; // 60fps+
  if (renderTime < 33) return 'fair'; // 30fps+
  return 'poor'; // < 30fps
}

/**
 * 计算动画进度
 */
export function calculateProgress(
  startTime: number,
  duration: number,
  currentTime: number
): number {
  const elapsed = currentTime - startTime;
  return Math.min(elapsed / duration, 1);
}

/**
 * 缓动函数实现
 */
export const EasingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicBezier: (t: number) => t * t * (3 - 2 * t),
};

/**
 * 应用缓动函数
 */
export function applyEasing(progress: number, easing: EasingFunction): number {
  if (typeof easing === 'function') {
    return easing(progress);
  }
  return EasingFunctions[easing]?.(progress) ?? progress;
}

/**
 * 计算纹理内存大小
 */
export function calculateTextureMemory(width: number, height: number, hasAlpha: boolean = true): number {
  const bytesPerPixel = hasAlpha ? 4 : 3; // RGBA or RGB
  return width * height * bytesPerPixel;
}

/**
 * 获取 LOD 级别
 */
export function getLODLevel(distance: number, distances: number[]): number {
  for (let i = 0; i < distances.length; i++) {
    if (distance < distances[i]) {
      return i;
    }
  }
  return distances.length;
}

/**
 * 批量调度优化
 */
export function batchSchedule(callback: () => void, priority: number = 0): void {
  if (priority > 0) {
    // 高优先级立即执行
    requestAnimationFrame(callback);
  } else {
    // 低优先级使用 requestIdleCallback
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback);
    } else {
      setTimeout(callback, 1);
    }
  }
}

/**
 * 检测是否支持 GPU 加速
 */
export function supportsGPUAcceleration(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * 获取最优纹理大小
 */
export function getOptimalTextureSize(width: number, height: number, maxSize: number): { width: number; height: number } {
  // 纹理大小应该是 2 的幂次方
  const nearestPowerOf2 = (n: number) => Math.pow(2, Math.ceil(Math.log2(n)));
  
  let optimalWidth = nearestPowerOf2(width);
  let optimalHeight = nearestPowerOf2(height);
  
  // 限制最大尺寸
  optimalWidth = Math.min(optimalWidth, maxSize);
  optimalHeight = Math.min(optimalHeight, maxSize);
  
  return { width: optimalWidth, height: optimalHeight };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}


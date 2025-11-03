/**
 * 渲染优化 Hooks
 * 
 * 提供性能分析、优化和监控的 React Hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { renderingService, type OptimizationSuggestion, type RenderStats } from '../services/renderingService';

// ============================================================================
// usePerformanceMonitor - 性能监控 Hook
// ============================================================================

export interface PerformanceMonitorOptions {
  // 是否自动启动
  autoStart?: boolean;
  // 采样间隔（毫秒）
  sampleInterval?: number;
  // 是否记录详细信息
  detailed?: boolean;
}

export interface PerformanceData {
  fps: number;
  avgRenderTime: number;
  slowRenders: number;
  totalRenders: number;
  suggestions: OptimizationSuggestion[];
}

/**
 * 性能监控 Hook
 */
export function usePerformanceMonitor(options: PerformanceMonitorOptions = {}) {
  const {
    autoStart = false,
    sampleInterval = 1000,
  } = options;

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    fps: 0,
    avgRenderTime: 0,
    slowRenders: 0,
    totalRenders: 0,
    suggestions: [],
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 更新性能数据
  const updatePerformanceData = useCallback(async () => {
    try {
      const [stats, suggestions, fps] = await Promise.all([
        renderingService.getRenderStats(),
        renderingService.getOptimizationSuggestions(),
        renderingService.getAverageFPS(60),
      ]);

      setPerformanceData({
        fps,
        avgRenderTime: stats.averageRenderTime,
        slowRenders: stats.slowRenderCount,
        totalRenders: stats.totalRenders,
        suggestions,
      });
    } catch (error) {
      console.error('更新性能数据失败:', error);
    }
  }, []);

  // 开始监控
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    renderingService.startMonitoring();
    setIsMonitoring(true);

    // 定期更新数据
    intervalRef.current = setInterval(updatePerformanceData, sampleInterval);
  }, [isMonitoring, sampleInterval, updatePerformanceData]);

  // 停止监控
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    renderingService.stopMonitoring();
    setIsMonitoring(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // 清空记录
  const clearRecords = useCallback(async () => {
    await renderingService.clearRecords();
    setPerformanceData({
      fps: 0,
      avgRenderTime: 0,
      slowRenders: 0,
      totalRenders: 0,
      suggestions: [],
    });
  }, []);

  // 自动启动
  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStart, startMonitoring, stopMonitoring]);

  return {
    isMonitoring,
    performanceData,
    startMonitoring,
    stopMonitoring,
    clearRecords,
    updatePerformanceData,
  };
}

// ============================================================================
// useRenderProfiler - 渲染分析 Hook
// ============================================================================

export interface RenderProfilerOptions {
  // 组件名称
  componentName: string;
  // 是否启用
  enabled?: boolean;
  // 是否记录原因
  trackReasons?: boolean;
}

/**
 * 渲染分析 Hook
 */
export function useRenderProfiler(options: RenderProfilerOptions) {
  const { componentName, enabled = true, trackReasons = false } = options;

  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const isInitialRenderRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const now = performance.now();
    const renderTime = lastRenderTimeRef.current > 0 
      ? now - lastRenderTimeRef.current 
      : 0;

    if (renderTime > 0) {
      renderingService.recordRenderPerformance(
        componentName,
        renderTime,
        0,
        isInitialRenderRef.current,
        trackReasons ? `Render #${renderCountRef.current}` : undefined
      );
    }

    lastRenderTimeRef.current = now;
    renderCountRef.current++;
    isInitialRenderRef.current = false;
  });

  return {
    renderCount: renderCountRef.current,
  };
}

// ============================================================================
// useOptimizedRender - 渲染优化 Hook
// ============================================================================

/**
 * 渲染优化 Hook
 * 减少不必要的重渲染
 */
export function useOptimizedRender<T>(value: T, isEqual?: (a: T, b: T) => boolean): T {
  const ref = useRef<T>(value);

  if (isEqual) {
    if (!isEqual(ref.current, value)) {
      ref.current = value;
    }
  } else {
    // 默认浅比较
    if (ref.current !== value) {
      ref.current = value;
    }
  }

  return ref.current;
}

// ============================================================================
// useDebounceRender - 防抖渲染 Hook
// ============================================================================

/**
 * 防抖渲染 Hook
 * 延迟渲染更新，避免频繁重渲染
 */
export function useDebounceRender<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useThrottleRender - 节流渲染 Hook
// ============================================================================

/**
 * 节流渲染 Hook
 * 限制渲染频率
 */
export function useThrottleRender<T>(value: T, interval: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    
    if (now - lastUpdateRef.current >= interval) {
      setThrottledValue(value);
      lastUpdateRef.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastUpdateRef.current = Date.now();
      }, interval - (now - lastUpdateRef.current));

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

// ============================================================================
// useMeasureRender - 测量渲染时间 Hook
// ============================================================================

export interface RenderTimingData {
  lastRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  renderCount: number;
}

/**
 * 测量渲染时间 Hook
 */
export function useMeasureRender(componentName: string): RenderTimingData {
  const [timingData, setTimingData] = useState<RenderTimingData>({
    lastRenderTime: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
    renderCount: 0,
  });

  const renderTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const now = performance.now();
    const renderTime = lastTimeRef.current > 0 ? now - lastTimeRef.current : 0;

    if (renderTime > 0) {
      renderTimesRef.current.push(renderTime);
      
      // 只保留最近 100 次渲染数据
      if (renderTimesRef.current.length > 100) {
        renderTimesRef.current.shift();
      }

      const times = renderTimesRef.current;
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);

      setTimingData({
        lastRenderTime: renderTime,
        averageRenderTime: avg,
        maxRenderTime: max,
        minRenderTime: min,
        renderCount: times.length,
      });

      // 记录到后端
      renderingService.recordRenderPerformance(
        componentName,
        renderTime,
        0,
        times.length === 1
      );
    }

    lastTimeRef.current = now;
  });

  return timingData;
}

// ============================================================================
// useRenderCount - 渲染计数 Hook
// ============================================================================

/**
 * 渲染计数 Hook
 * 调试工具，显示组件渲染次数
 */
export function useRenderCount(componentName?: string): number {
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current++;
    
    if (componentName) {
      console.log(`[${componentName}] 渲染次数: ${renderCountRef.current}`);
    }
  });

  return renderCountRef.current;
}

// ============================================================================
// useWhyDidYouUpdate - 渲染原因分析 Hook
// ============================================================================

/**
 * 渲染原因分析 Hook
 * 调试工具，显示导致重渲染的 props 变化
 */
export function useWhyDidYouUpdate(componentName: string, props: Record<string, any>): void {
  const previousPropsRef = useRef<Record<string, any>>();

  useEffect(() => {
    if (previousPropsRef.current) {
      const allKeys = Object.keys({ ...previousPropsRef.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};

      allKeys.forEach((key) => {
        if (previousPropsRef.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousPropsRef.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log(`[${componentName}] Props 变化:`, changedProps);
      }
    }

    previousPropsRef.current = props;
  });
}

// ============================================================================
// usePerformanceAnalyzer - 性能分析器 Hook
// ============================================================================

export interface PerformanceAnalysis {
  status: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: OptimizationSuggestion[];
  stats: RenderStats | null;
}

/**
 * 性能分析器 Hook
 */
export function usePerformanceAnalyzer() {
  const [analysis, setAnalysis] = useState<PerformanceAnalysis>({
    status: 'excellent',
    issues: [],
    suggestions: [],
    stats: null,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(async () => {
    setIsAnalyzing(true);

    try {
      const [health, stats, suggestions] = await Promise.all([
        renderingService.checkPerformanceHealth(),
        renderingService.getRenderStats(),
        renderingService.getOptimizationSuggestions(),
      ]);

      setAnalysis({
        status: health.status,
        issues: health.issues,
        suggestions,
        stats,
      });
    } catch (error) {
      console.error('性能分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analysis,
    isAnalyzing,
    analyze,
  };
}

// ============================================================================
// useFPS - FPS 监控 Hook
// ============================================================================

export interface FPSData {
  current: number;
  average: number;
  min: number;
  max: number;
}

/**
 * FPS 监控 Hook
 */
export function useFPS(updateInterval: number = 1000): FPSData {
  const [fpsData, setFPSData] = useState<FPSData>({
    current: 0,
    average: 0,
    min: 0,
    max: 0,
  });

  const fpsValuesRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  useEffect(() => {
    let animationId: number;
    let lastUpdate = Date.now();

    const measureFPS = () => {
      const now = performance.now();
      
      if (lastFrameRef.current > 0) {
        const delta = now - lastFrameRef.current;
        const fps = delta > 0 ? 1000 / delta : 0;
        frameCountRef.current++;

        // 每秒更新一次
        if (Date.now() - lastUpdate >= updateInterval) {
          fpsValuesRef.current.push(fps);
          
          // 只保留最近 60 个值
          if (fpsValuesRef.current.length > 60) {
            fpsValuesRef.current.shift();
          }

          const values = fpsValuesRef.current;
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);

          setFPSData({
            current: Math.round(fps),
            average: Math.round(avg),
            min: Math.round(min),
            max: Math.round(max),
          });

          lastUpdate = Date.now();
        }
      }

      lastFrameRef.current = now;
      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [updateInterval]);

  return fpsData;
}


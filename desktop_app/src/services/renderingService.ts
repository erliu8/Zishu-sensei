/**
 * 渲染性能服务
 * 
 * 提供渲染性能监控、分析和优化功能
 */

import { invoke } from '@tauri-apps/api/tauri';
import type {
  PerformanceReport,
} from '../types/rendering';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 渲染记录
 */
export interface RenderRecord {
  componentName: string;
  renderTime: number;
  commitTime: number;
  timestamp: number;
  isInitialRender: boolean;
  reason?: string;
}

/**
 * 渲染统计
 */
export interface RenderStats {
  totalRenders: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  slowRenderCount: number;
  componentStats: Record<string, ComponentStats>;
}

/**
 * 组件统计
 */
export interface ComponentStats {
  renderCount: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
}

/**
 * 帧记录
 */
export interface FrameRecord {
  timestamp: number;
  frameTime: number;
  fps: number;
  drawCalls: number;
}

/**
 * WebGL 性能统计
 */
export interface WebGLPerformanceStats {
  drawCalls: number;
  triangles: number;
  textureCount: number;
  textureMemory: number;
  frameTime: number;
  fps: number;
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  severity: 'info' | 'warning' | 'critical';
  category: 'render' | 'memory' | 'animation' | 'webgl';
  message: string;
  component?: string;
  suggestion: string;
}

// ============================================================================
// 渲染性能服务类
// ============================================================================

class RenderingService {
  private performanceObserver: PerformanceObserver | null = null;
  private frameCounter: number = 0;
  private lastFrameTime: number = 0;
  private isMonitoring: boolean = false;

  /**
   * 记录组件渲染性能
   */
  async recordRenderPerformance(
    componentName: string,
    renderTime: number,
    commitTime: number,
    isInitialRender: boolean = false,
    reason?: string
  ): Promise<void> {
    try {
      await invoke('record_render_performance', {
        componentName,
        renderTime,
        commitTime,
        isInitialRender,
        reason,
      });
    } catch (error) {
      console.error('记录渲染性能失败:', error);
    }
  }

  /**
   * 记录帧性能
   */
  async recordFramePerformance(
    frameTime: number,
    fps: number,
    drawCalls: number = 0
  ): Promise<void> {
    try {
      await invoke('record_frame_performance', {
        frameTime,
        fps,
        drawCalls,
      });
    } catch (error) {
      console.error('记录帧性能失败:', error);
    }
  }

  /**
   * 更新 WebGL 统计
   */
  async updateWebGLStats(stats: {
    drawCalls: number;
    triangles: number;
    textureCount: number;
    textureMemory: number;
    frameTime: number;
    fps: number;
  }): Promise<void> {
    try {
      await invoke('update_webgl_stats', stats);
    } catch (error) {
      console.error('更新 WebGL 统计失败:', error);
    }
  }

  /**
   * 获取渲染统计
   */
  async getRenderStats(): Promise<RenderStats> {
    try {
      return await invoke<RenderStats>('get_render_stats');
    } catch (error) {
      console.error('获取渲染统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取优化建议
   */
  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    try {
      return await invoke<OptimizationSuggestion[]>('get_optimization_suggestions');
    } catch (error) {
      console.error('获取优化建议失败:', error);
      return [];
    }
  }

  /**
   * 获取渲染记录
   */
  async getRenderRecords(limit?: number): Promise<RenderRecord[]> {
    try {
      return await invoke<RenderRecord[]>('get_render_records', { limit });
    } catch (error) {
      console.error('获取渲染记录失败:', error);
      return [];
    }
  }

  /**
   * 获取帧记录
   */
  async getFrameRecords(limit?: number): Promise<FrameRecord[]> {
    try {
      return await invoke<FrameRecord[]>('get_frame_records', { limit });
    } catch (error) {
      console.error('获取帧记录失败:', error);
      return [];
    }
  }

  /**
   * 获取 WebGL 统计
   */
  async getWebGLStats(): Promise<WebGLPerformanceStats | null> {
    try {
      return await invoke<WebGLPerformanceStats | null>('get_webgl_stats');
    } catch (error) {
      console.error('获取 WebGL 统计失败:', error);
      return null;
    }
  }

  /**
   * 清空性能记录
   */
  async clearRecords(): Promise<void> {
    try {
      await invoke('clear_render_records');
    } catch (error) {
      console.error('清空性能记录失败:', error);
    }
  }

  /**
   * 设置慢渲染阈值
   */
  async setSlowRenderThreshold(threshold: number): Promise<void> {
    try {
      await invoke('set_slow_render_threshold', { threshold });
    } catch (error) {
      console.error('设置慢渲染阈值失败:', error);
    }
  }

  /**
   * 设置最大记录数
   */
  async setMaxRecords(maxRecords: number): Promise<void> {
    try {
      await invoke('set_max_records', { maxRecords });
    } catch (error) {
      console.error('设置最大记录数失败:', error);
    }
  }

  /**
   * 开始性能监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // 使用 Performance Observer 监控渲染性能
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              // 记录测量结果
              this.recordRenderPerformance(
                entry.name,
                entry.duration,
                0,
                false
              );
            }
          }
        });

        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.error('启动 Performance Observer 失败:', error);
      }
    }

    // 启动帧率监控
    this.startFrameMonitoring();
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    this.frameCounter = 0;
  }

  /**
   * 启动帧率监控
   */
  private startFrameMonitoring(): void {
    const measureFrame = () => {
      if (!this.isMonitoring) {
        return;
      }

      const now = performance.now();
      
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime;
        const fps = frameTime > 0 ? 1000 / frameTime : 0;
        
        // 每秒记录一次
        this.frameCounter++;
        if (this.frameCounter >= 60) {
          this.recordFramePerformance(frameTime, fps);
          this.frameCounter = 0;
        }
      }
      
      this.lastFrameTime = now;
      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  /**
   * 测量组件渲染时间
   */
  measureComponentRender<T>(
    componentName: string,
    renderFn: () => T
  ): T {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    performance.mark(startMark);
    const result = renderFn();
    performance.mark(endMark);
    
    try {
      performance.measure(measureName, startMark, endMark);
    } catch (error) {
      console.warn('性能测量失败:', error);
    }

    return result;
  }

  /**
   * 异步测量组件渲染时间
   */
  async measureComponentRenderAsync<T>(
    componentName: string,
    renderFn: () => Promise<T>
  ): Promise<T> {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    performance.mark(startMark);
    const result = await renderFn();
    performance.mark(endMark);
    
    try {
      performance.measure(measureName, startMark, endMark);
    } catch (error) {
      console.warn('性能测量失败:', error);
    }

    return result;
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(): Promise<PerformanceReport> {
    const stats = await this.getRenderStats();
    // TODO: 集成优化建议到性能报告中
    // const suggestions = await this.getOptimizationSuggestions();
    
    return {
      totalRenderTime: stats.totalRenders * stats.averageRenderTime,
      averageRenderTime: stats.averageRenderTime,
      maxRenderTime: stats.maxRenderTime,
      minRenderTime: stats.minRenderTime,
      renderCount: stats.totalRenders,
      slowComponents: [],
      frequentComponents: [],
      timeRange: {
        start: Date.now() - 60000, // 最近1分钟
        end: Date.now(),
      },
    };
  }

  /**
   * 检测性能瓶颈
   */
  async detectBottlenecks(): Promise<{
    slowComponents: string[];
    frequentRenders: string[];
    highMemoryUsage: string[];
    poorAnimations: string[];
  }> {
    const stats = await this.getRenderStats();
    const suggestions = await this.getOptimizationSuggestions();

    const slowComponents = Object.entries(stats.componentStats)
      .filter(([_, stat]) => stat.averageTime > 16)
      .map(([name]) => name);

    const frequentRenders = Object.entries(stats.componentStats)
      .filter(([_, stat]) => stat.renderCount > 50)
      .map(([name]) => name);

    const highMemoryUsage = suggestions
      .filter(s => s.category === 'memory')
      .map(s => s.component)
      .filter((c): c is string => c !== undefined);

    const poorAnimations = suggestions
      .filter(s => s.category === 'animation')
      .map(s => s.component)
      .filter((c): c is string => c !== undefined);

    return {
      slowComponents,
      frequentRenders,
      highMemoryUsage,
      poorAnimations,
    };
  }

  /**
   * 获取当前 FPS
   */
  async getCurrentFPS(): Promise<number> {
    const records = await this.getFrameRecords(1);
    return records.length > 0 ? records[0].fps : 0;
  }

  /**
   * 获取平均 FPS
   */
  async getAverageFPS(sampleSize: number = 60): Promise<number> {
    const records = await this.getFrameRecords(sampleSize);
    if (records.length === 0) return 0;
    
    const totalFPS = records.reduce((sum, record) => sum + record.fps, 0);
    return totalFPS / records.length;
  }

  /**
   * 检查性能健康状况
   */
  async checkPerformanceHealth(): Promise<{
    status: 'excellent' | 'good' | 'fair' | 'poor';
    fps: number;
    avgRenderTime: number;
    issues: string[];
  }> {
    const stats = await this.getRenderStats();
    const fps = await getAverageFPS();
    const suggestions = await this.getOptimizationSuggestions();

    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    const issues: string[] = [];

    if (fps < 30) {
      status = 'poor';
      issues.push('帧率过低（< 30 FPS）');
    } else if (fps < 45) {
      status = 'fair';
      issues.push('帧率较低（< 45 FPS）');
    } else if (fps < 60) {
      status = 'good';
    }

    if (stats.averageRenderTime > 16) {
      status = status === 'excellent' ? 'good' : status;
      issues.push('平均渲染时间超过 16ms');
    }

    if (stats.slowRenderCount / stats.totalRenders > 0.1) {
      issues.push('超过 10% 的渲染较慢');
    }

    const criticalSuggestions = suggestions.filter(s => s.severity === 'critical');
    if (criticalSuggestions.length > 0) {
      status = 'poor';
      issues.push(`${criticalSuggestions.length} 个严重性能问题`);
    }

    return {
      status,
      fps,
      avgRenderTime: stats.averageRenderTime,
      issues,
    };
  }
}

// 导出单例实例
export const renderingService = new RenderingService();

// 导出类型
export type { RenderingService };

// 工具函数

/**
 * 获取平均 FPS
 */
export async function getAverageFPS(sampleSize: number = 60): Promise<number> {
  return renderingService.getAverageFPS(sampleSize);
}

/**
 * 开始性能监控
 */
export function startPerformanceMonitoring(): void {
  renderingService.startMonitoring();
}

/**
 * 停止性能监控
 */
export function stopPerformanceMonitoring(): void {
  renderingService.stopMonitoring();
}

/**
 * 测量函数执行时间
 */
export function measureExecutionTime<T>(
  name: string,
  fn: () => T
): T {
  return renderingService.measureComponentRender(name, fn);
}

/**
 * 异步测量函数执行时间
 */
export async function measureExecutionTimeAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return renderingService.measureComponentRenderAsync(name, fn);
}


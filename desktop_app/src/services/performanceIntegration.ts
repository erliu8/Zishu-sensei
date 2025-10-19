/**
 * 性能监控集成服务
 * 
 * 整合现有的内存监控、渲染监控、系统监控与新的统一性能监控系统
 */

import { EventEmitter } from 'events';
import { PerformanceService } from './performanceService';
import { MemoryService } from './memoryService';
import { RenderingService } from './renderingService';
import { 
  PerformanceMetric, 
  PerformanceSnapshot, 
  UserOperation, 
  NetworkMetric, 
  NetworkTiming, 
  PerformanceCategory 
} from '../types/performance';
import type { MemoryInfo, MemoryPoolStats } from '../types/memory';
import type { RenderStats } from '../types/rendering';

export interface IntegrationConfig {
  enabled: boolean;
  syncInterval: number;           // 同步间隔 (ms)
  memorySync: boolean;           // 是否同步内存数据
  renderingSync: boolean;        // 是否同步渲染数据
  systemSync: boolean;           // 是否同步系统数据
  userTrackingEnabled: boolean;  // 是否启用用户操作追踪
  networkMonitoring: boolean;    // 是否启用网络监控
}

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  enabled: true,
  syncInterval: 5000,
  memorySync: true,
  renderingSync: true,
  systemSync: true,
  userTrackingEnabled: true,
  networkMonitoring: true,
};

export class PerformanceIntegrationService extends EventEmitter {
  private config: IntegrationConfig = DEFAULT_INTEGRATION_CONFIG;
  private syncTimer: NodeJS.Timeout | null = null;
  private performanceService: PerformanceService;
  private memoryService: MemoryService;
  private renderingService: RenderingService;
  
  // 数据缓存
  private lastMemoryInfo: MemoryInfo | null = null;
  private lastRenderStats: RenderStats | null = null;
  private lastSystemSnapshot: any = null;
  
  // 性能监控状态
  private isIntegrationActive = false;
  private startTime = Date.now();

  constructor() {
    super();
    this.performanceService = new PerformanceService();
    this.memoryService = new MemoryService();
    this.renderingService = new RenderingService();
    
    // 初始化集成服务
    this.initializeIntegration();
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 启动集成监控
   */
  async startIntegration(config?: Partial<IntegrationConfig>): Promise<void> {
    if (this.isIntegrationActive) {
      console.warn('集成监控已在运行');
      return;
    }

    // 更新配置
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('集成监控已禁用');
      return;
    }

    try {
      // 启动统一性能监控
      await this.performanceService.startMonitoring();
      
      // 启动现有监控服务
      if (this.config.renderingSync) {
        this.renderingService.startMonitoring();
      }
      
      // 开始数据同步
      this.startDataSync();
      
      // 设置用户操作追踪
      if (this.config.userTrackingEnabled) {
        this.setupUserTracking();
      }
      
      // 设置网络监控
      if (this.config.networkMonitoring) {
        this.setupNetworkMonitoring();
      }

      this.isIntegrationActive = true;
      this.startTime = Date.now();
      
      this.emit('integrationStarted', { 
        config: this.config,
        timestamp: this.startTime 
      });
      
      console.log('性能监控集成服务已启动');
    } catch (error) {
      console.error('启动集成监控失败:', error);
      throw error;
    }
  }

  /**
   * 停止集成监控
   */
  async stopIntegration(): Promise<void> {
    if (!this.isIntegrationActive) {
      return;
    }

    try {
      // 停止数据同步
      this.stopDataSync();
      
      // 停止现有监控服务
      this.renderingService.stopMonitoring();
      
      // 停止统一性能监控
      await this.performanceService.stopMonitoring();
      
      // 清理用户操作追踪
      this.cleanupUserTracking();
      
      // 清理网络监控
      this.cleanupNetworkMonitoring();

      this.isIntegrationActive = false;
      
      this.emit('integrationStopped', { 
        duration: Date.now() - this.startTime 
      });
      
      console.log('性能监控集成服务已停止');
    } catch (error) {
      console.error('停止集成监控失败:', error);
      throw error;
    }
  }

  /**
   * 获取集成状态
   */
  getIntegrationStatus() {
    return {
      active: this.isIntegrationActive,
      config: this.config,
      startTime: this.startTime,
      uptime: this.isIntegrationActive ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * 更新集成配置
   */
  async updateConfig(newConfig: Partial<IntegrationConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // 如果正在运行，重启集成服务
    if (this.isIntegrationActive) {
      await this.stopIntegration();
      await this.startIntegration();
    }
    
    this.emit('configUpdated', { 
      oldConfig, 
      newConfig: this.config 
    });
  }

  /**
   * 手动触发数据同步
   */
  async syncNow(): Promise<void> {
    if (!this.isIntegrationActive) {
      console.warn('集成监控未启动，无法同步数据');
      return;
    }

    await this.performDataSync();
    console.log('手动数据同步完成');
  }

  /**
   * 记录用户操作
   */
  async recordUserOperation(
    type: string,
    target: string,
    startTime: number,
    endTime: number,
    success: boolean = true,
    error?: string,
    metadata?: any
  ): Promise<void> {
    if (!this.config.userTrackingEnabled) {
      return;
    }

    try {
      await this.performanceService.recordUserOperation(
        type,
        target,
        startTime,
        endTime,
        success,
        error,
        metadata ? JSON.stringify(metadata) : undefined
      );
    } catch (error) {
      console.error('记录用户操作失败:', error);
    }
  }

  /**
   * 记录网络请求
   */
  async recordNetworkRequest(
    url: string,
    method: string,
    statusCode?: number,
    timing?: NetworkTiming,
    requestSize?: number,
    responseSize?: number,
    errorType?: string,
    errorMessage?: string
  ): Promise<void> {
    if (!this.config.networkMonitoring) {
      return;
    }

    try {
      await this.performanceService.recordNetworkMetric(
        url,
        method,
        statusCode,
        requestSize,
        responseSize,
        timing || { total_time: 0 },
        errorType,
        errorMessage
      );
    } catch (error) {
      console.error('记录网络请求失败:', error);
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 初始化集成服务
   */
  private initializeIntegration(): void {
    // 监听性能服务事件
    this.performanceService.on('monitoringStarted', () => {
      this.emit('performanceMonitoringStarted');
    });

    this.performanceService.on('monitoringStopped', () => {
      this.emit('performanceMonitoringStopped');
    });

    this.performanceService.on('alertTriggered', (alert) => {
      this.emit('performanceAlert', alert);
    });
  }

  /**
   * 开始数据同步
   */
  private startDataSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // 立即执行一次同步
    this.performDataSync();

    // 定时同步
    this.syncTimer = setInterval(() => {
      this.performDataSync();
    }, this.config.syncInterval);
  }

  /**
   * 停止数据同步
   */
  private stopDataSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 执行数据同步
   */
  private async performDataSync(): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      // 同步内存数据
      if (this.config.memorySync) {
        promises.push(this.syncMemoryData());
      }

      // 同步渲染数据
      if (this.config.renderingSync) {
        promises.push(this.syncRenderingData());
      }

      // 同步系统数据
      if (this.config.systemSync) {
        promises.push(this.syncSystemData());
      }

      await Promise.all(promises);
      
      this.emit('dataSyncCompleted');
    } catch (error) {
      console.error('数据同步失败:', error);
      this.emit('dataSyncError', error);
    }
  }

  /**
   * 同步内存数据
   */
  private async syncMemoryData(): Promise<void> {
    try {
      // 获取当前内存信息
      const memoryInfo = await this.memoryService.getMemoryInfo();
      const memoryPools = await this.memoryService.getMemoryPoolStats();

      // 记录内存使用率指标
      await this.performanceService.recordMetric(
        'memory_usage_percentage',
        memoryInfo.usage_percentage,
        '%',
        'memory',
        'system',
        JSON.stringify({ 
          total: memoryInfo.total_memory,
          used: memoryInfo.used_memory,
          available: memoryInfo.available_memory 
        })
      );

      // 记录应用内存占用
      await this.performanceService.recordMetric(
        'app_memory_usage',
        memoryInfo.app_memory,
        'bytes',
        'memory',
        'application'
      );

      // 记录应用内存使用率
      await this.performanceService.recordMetric(
        'app_memory_percentage',
        memoryInfo.app_memory_percentage,
        '%',
        'memory',
        'application'
      );

      // 记录内存池统计
      for (const pool of memoryPools) {
        await this.performanceService.recordMetric(
          `memory_pool_usage_${pool.name}`,
          pool.usage_percentage,
          '%',
          'memory',
          'pool',
          JSON.stringify({
            allocated: pool.allocated_count,
            capacity: pool.capacity,
            bytes: pool.total_bytes
          })
        );
      }

      this.lastMemoryInfo = memoryInfo;
    } catch (error) {
      console.error('同步内存数据失败:', error);
    }
  }

  /**
   * 同步渲染数据
   */
  private async syncRenderingData(): Promise<void> {
    try {
      // 获取渲染统计
      const renderStats = await this.renderingService.getRenderStats();
      const averageFPS = await this.renderingService.getAverageFPS(60);

      // 记录FPS
      await this.performanceService.recordMetric(
        'fps',
        averageFPS,
        'fps',
        'render',
        'system'
      );

      // 记录平均渲染时间
      await this.performanceService.recordMetric(
        'average_render_time',
        renderStats.averageRenderTime,
        'ms',
        'render',
        'system'
      );

      // 记录慢渲染次数
      await this.performanceService.recordMetric(
        'slow_render_count',
        renderStats.slowRenderCount,
        'count',
        'render',
        'system'
      );

      // 记录总渲染次数
      await this.performanceService.recordMetric(
        'total_render_count',
        renderStats.totalRenders,
        'count',
        'render',
        'system'
      );

      this.lastRenderStats = renderStats;
    } catch (error) {
      console.error('同步渲染数据失败:', error);
    }
  }

  /**
   * 同步系统数据
   */
  private async syncSystemData(): Promise<void> {
    try {
      // 创建系统快照
      const snapshot = await this.createSystemSnapshot();
      
      if (snapshot) {
        await this.performanceService.recordSnapshot(
          snapshot.cpu_usage,
          snapshot.memory_usage,
          snapshot.memory_used_mb,
          snapshot.memory_total_mb,
          snapshot.fps,
          snapshot.render_time,
          snapshot.active_connections,
          snapshot.open_files,
          snapshot.thread_count,
          snapshot.heap_size,
          snapshot.gc_time,
          snapshot.app_state,
          snapshot.load_average
        );

        this.lastSystemSnapshot = snapshot;
      }
    } catch (error) {
      console.error('同步系统数据失败:', error);
    }
  }

  /**
   * 创建系统快照
   */
  private async createSystemSnapshot(): Promise<any | null> {
    try {
      const memoryInfo = this.lastMemoryInfo || await this.memoryService.getMemoryInfo();
      const renderStats = this.lastRenderStats || await this.renderingService.getRenderStats();
      const averageFPS = await this.renderingService.getAverageFPS(30);

      return {
        cpu_usage: 0, // TODO: 从系统获取 CPU 使用率
        memory_usage: memoryInfo.usage_percentage,
        memory_used_mb: memoryInfo.used_memory / (1024 * 1024),
        memory_total_mb: memoryInfo.total_memory / (1024 * 1024),
        fps: averageFPS,
        render_time: renderStats.averageRenderTime,
        active_connections: 0, // TODO: 从网络监控获取
        open_files: 0, // TODO: 从系统监控获取
        thread_count: 0, // TODO: 从系统监控获取
        heap_size: memoryInfo.app_memory,
        gc_time: 0, // TODO: 从 JS 引擎获取
        app_state: 'active',
        load_average: JSON.stringify([0, 0, 0]), // TODO: 从系统获取
      };
    } catch (error) {
      console.error('创建系统快照失败:', error);
      return null;
    }
  }

  /**
   * 设置用户操作追踪
   */
  private setupUserTracking(): void {
    // 全局点击事件监听
    document.addEventListener('click', this.handleUserClick.bind(this), true);
    
    // 全局键盘事件监听
    document.addEventListener('keydown', this.handleUserKeydown.bind(this), true);
    
    // 滚动事件监听
    document.addEventListener('scroll', this.handleUserScroll.bind(this), true);
    
    console.log('用户操作追踪已启用');
  }

  /**
   * 清理用户操作追踪
   */
  private cleanupUserTracking(): void {
    document.removeEventListener('click', this.handleUserClick.bind(this), true);
    document.removeEventListener('keydown', this.handleUserKeydown.bind(this), true);
    document.removeEventListener('scroll', this.handleUserScroll.bind(this), true);
    
    console.log('用户操作追踪已清理');
  }

  /**
   * 处理用户点击
   */
  private handleUserClick(event: MouseEvent): void {
    const startTime = Date.now();
    const target = (event.target as Element)?.tagName?.toLowerCase() || 'unknown';
    const targetId = (event.target as Element)?.id || '';
    const targetClass = (event.target as Element)?.className || '';
    
    // 简单的响应时间模拟（实际应该基于具体的交互反馈）
    setTimeout(() => {
      const endTime = Date.now();
      this.recordUserOperation(
        'click',
        `${target}${targetId ? '#' + targetId : ''}${targetClass ? '.' + targetClass : ''}`,
        startTime,
        endTime,
        true,
        undefined,
        {
          coordinates: { x: event.clientX, y: event.clientY },
          button: event.button
        }
      );
    }, 50);
  }

  /**
   * 处理用户键盘输入
   */
  private handleUserKeydown(event: KeyboardEvent): void {
    const startTime = Date.now();
    const target = (event.target as Element)?.tagName?.toLowerCase() || 'unknown';
    
    setTimeout(() => {
      const endTime = Date.now();
      this.recordUserOperation(
        'keydown',
        target,
        startTime,
        endTime,
        true,
        undefined,
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        }
      );
    }, 10);
  }

  /**
   * 处理用户滚动
   */
  private handleUserScroll(event: Event): void {
    // 节流处理，避免过多事件
    if (!this.lastScrollTime || Date.now() - this.lastScrollTime > 100) {
      const startTime = Date.now();
      const target = (event.target as Element)?.tagName?.toLowerCase() || 'document';
      
      setTimeout(() => {
        const endTime = Date.now();
        this.recordUserOperation(
          'scroll',
          target,
          startTime,
          endTime,
          true,
          undefined,
          {
            scrollTop: window.scrollY,
            scrollLeft: window.scrollX
          }
        );
      }, 10);
      
      this.lastScrollTime = Date.now();
    }
  }
  private lastScrollTime = 0;

  /**
   * 设置网络监控
   */
  private setupNetworkMonitoring(): void {
    // 监控 fetch 请求
    this.originalFetch = window.fetch;
    window.fetch = this.monitoredFetch.bind(this);
    
    // 监控 XMLHttpRequest
    this.setupXHRMonitoring();
    
    console.log('网络监控已启用');
  }

  /**
   * 清理网络监控
   */
  private cleanupNetworkMonitoring(): void {
    // 恢复原始 fetch
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    // 清理 XHR 监控
    this.cleanupXHRMonitoring();
    
    console.log('网络监控已清理');
  }

  private originalFetch: typeof fetch | null = null;

  /**
   * 监控的 fetch 函数
   */
  private async monitoredFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    
    try {
      const response = await this.originalFetch!(input, init);
      const endTime = Date.now();
      
      // 记录网络请求
      this.recordNetworkRequest(
        url,
        method,
        response.status,
        {
          total_time: endTime - startTime,
          dns_time: 0,
          connect_time: 0,
          ssl_time: 0,
          send_time: 0,
          wait_time: endTime - startTime,
          receive_time: 0
        },
        init?.body ? new Blob([init.body]).size : 0,
        0 // 响应大小需要从响应头获取
      );
      
      return response;
    } catch (error) {
      const endTime = Date.now();
      
      // 记录网络错误
      this.recordNetworkRequest(
        url,
        method,
        0,
        {
          total_time: endTime - startTime,
          dns_time: 0,
          connect_time: 0,
          ssl_time: 0,
          send_time: 0,
          wait_time: endTime - startTime,
          receive_time: 0
        },
        init?.body ? new Blob([init.body]).size : 0,
        0,
        'fetch_error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }

  /**
   * 设置 XHR 监控
   */
  private setupXHRMonitoring(): void {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args) {
      (this as any)._monitorData = {
        method,
        url: url.toString(),
        startTime: 0
      };
      return originalOpen.apply(this, [method, url, ...args] as any);
    };
    
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const monitorData = (this as any)._monitorData;
      if (monitorData) {
        monitorData.startTime = Date.now();
        
        this.addEventListener('loadend', () => {
          const endTime = Date.now();
          const integration = PerformanceIntegrationService.getInstance();
          
          integration?.recordNetworkRequest(
            monitorData.url,
            monitorData.method,
            this.status,
            {
              total_time: endTime - monitorData.startTime,
              dns_time: 0,
              connect_time: 0,
              ssl_time: 0,
              send_time: 0,
              wait_time: endTime - monitorData.startTime,
              receive_time: 0
            },
            body ? new Blob([body]).size : 0,
            0,
            this.status >= 400 ? 'http_error' : undefined,
            this.status >= 400 ? this.statusText : undefined
          );
        });
      }
      
      return originalSend.apply(this, [body]);
    };
  }

  /**
   * 清理 XHR 监控
   */
  private cleanupXHRMonitoring(): void {
    // 这里应该恢复原始的 XHR 方法
    // 但由于实现复杂性，暂时不实现
    // 在实际应用中，应该保存原始方法的引用
  }

  // ============================================================================
  // 静态方法 - 单例模式
  // ============================================================================

  private static instance: PerformanceIntegrationService | null = null;

  static getInstance(): PerformanceIntegrationService {
    if (!PerformanceIntegrationService.instance) {
      PerformanceIntegrationService.instance = new PerformanceIntegrationService();
    }
    return PerformanceIntegrationService.instance;
  }

  static resetInstance(): void {
    if (PerformanceIntegrationService.instance) {
      PerformanceIntegrationService.instance.stopIntegration();
      PerformanceIntegrationService.instance = null;
    }
  }
}

// 导出单例实例
export const performanceIntegration = PerformanceIntegrationService.getInstance();
export default performanceIntegration;

/**
 * 启动优化系统类型定义
 */

/**
 * 启动阶段枚举
 */
export enum StartupPhase {
  /** 应用初始化 */
  AppInitialization = 'AppInitialization',
  /** 数据库连接 */
  DatabaseConnection = 'DatabaseConnection',
  /** 配置加载 */
  ConfigLoading = 'ConfigLoading',
  /** 主题加载 */
  ThemeLoading = 'ThemeLoading',
  /** 适配器加载 */
  AdapterLoading = 'AdapterLoading',
  /** Live2D 模型加载 */
  Live2DModelLoading = 'Live2DModelLoading',
  /** 窗口创建 */
  WindowCreation = 'WindowCreation',
  /** 前端初始化 */
  FrontendInitialization = 'FrontendInitialization',
  /** 系统服务启动 */
  SystemServices = 'SystemServices',
  /** 网络连接检查 */
  NetworkConnection = 'NetworkConnection',
  /** 完成 */
  Completed = 'Completed',
}

/**
 * 阶段执行结果
 */
export interface PhaseResult {
  /** 阶段类型 */
  phase: StartupPhase;
  /** 开始时间戳 */
  start_time: number;
  /** 结束时间戳 */
  end_time?: number;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 内存使用量 */
  memory_usage?: number;
  /** 性能指标 */
  metrics: Record<string, number>;
}

/**
 * 启动性能配置
 */
export interface StartupConfig {
  /** 启用预加载 */
  enable_preloading: boolean;
  /** 最大并行加载数 */
  max_parallel_loading: number;
  /** 超时时间（毫秒） */
  timeout_ms: number;
  /** 启用性能监控 */
  enable_performance_monitoring: boolean;
  /** 启用启动缓存 */
  enable_startup_cache: boolean;
  /** 跳过的可选阶段 */
  skip_optional_phases: StartupPhase[];
  /** 延迟加载的阶段 */
  deferred_phases: StartupPhase[];
}

/**
 * 启动统计信息
 */
export interface StartupStats {
  /** 总耗时（毫秒） */
  total_duration: number;
  /** 阶段总数 */
  phase_count: number;
  /** 成功阶段数 */
  success_count: number;
  /** 失败阶段数 */
  error_count: number;
  /** 最慢的阶段 */
  slowest_phase?: StartupPhase;
  /** 最快的阶段 */
  fastest_phase?: StartupPhase;
  /** 内存峰值 */
  memory_peak: number;
  /** 平均 CPU 使用率 */
  cpu_usage_avg: number;
  /** 改进建议 */
  improvement_suggestions: string[];
}

/**
 * 启动事件
 */
export interface StartupEvent {
  /** 事件类型 */
  event_type: string;
  /** 相关阶段 */
  phase?: StartupPhase;
  /** 进度百分比 (0-1) */
  progress: number;
  /** 消息内容 */
  message: string;
  /** 时间戳 */
  timestamp: number;
  /** 附加数据 */
  data: Record<string, any>;
}

/**
 * 启动优化配置
 */
export interface StartupOptimization {
  /** 代码分割配置 */
  codeSplitting: {
    /** 启用代码分割 */
    enabled: boolean;
    /** 分割策略 */
    strategy: 'route' | 'component' | 'vendor';
    /** 预加载优先级路由 */
    preloadRoutes: string[];
    /** 懒加载组件列表 */
    lazyComponents: string[];
  };
  /** 资源预加载配置 */
  resourcePreloading: {
    /** 启用资源预加载 */
    enabled: boolean;
    /** 预加载策略 */
    strategy: 'eager' | 'lazy' | 'auto';
    /** 预加载资源类型 */
    resourceTypes: ResourceType[];
    /** 预加载优先级 */
    priorities: Record<string, number>;
  };
  /** 首屏渲染优化 */
  firstScreenOptimization: {
    /** 启用首屏优化 */
    enabled: boolean;
    /** 关键 CSS 内联 */
    inlineCriticalCSS: boolean;
    /** 图片懒加载 */
    lazyLoadImages: boolean;
    /** 虚拟滚动 */
    virtualScrolling: boolean;
  };
  /** 缓存策略 */
  cacheStrategy: {
    /** 启用缓存 */
    enabled: boolean;
    /** 缓存类型 */
    types: CacheType[];
    /** 缓存过期时间（秒） */
    expireTime: number;
    /** 最大缓存大小（MB） */
    maxSize: number;
  };
}

/**
 * 资源类型
 */
export enum ResourceType {
  /** 图片 */
  Image = 'image',
  /** CSS 样式 */
  CSS = 'css',
  /** JavaScript */
  JavaScript = 'javascript',
  /** 字体 */
  Font = 'font',
  /** Live2D 模型 */
  Live2DModel = 'live2d-model',
  /** 配置文件 */
  Config = 'config',
  /** 音频 */
  Audio = 'audio',
  /** 视频 */
  Video = 'video',
}

/**
 * 缓存类型
 */
export enum CacheType {
  /** 内存缓存 */
  Memory = 'memory',
  /** 本地存储 */
  LocalStorage = 'localStorage',
  /** SessionStorage */
  SessionStorage = 'sessionStorage',
  /** IndexedDB */
  IndexedDB = 'indexedDB',
  /** Service Worker 缓存 */
  ServiceWorker = 'serviceWorker',
}

/**
 * 启动性能指标
 */
export interface StartupPerformanceMetrics {
  /** 首次绘制时间 */
  firstPaint: number;
  /** 首次内容绘制时间 */
  firstContentfulPaint: number;
  /** 最大内容绘制时间 */
  largestContentfulPaint: number;
  /** 首次输入延迟 */
  firstInputDelay: number;
  /** 累积布局偏移 */
  cumulativeLayoutShift: number;
  /** 交互时间 */
  timeToInteractive: number;
  /** 总阻塞时间 */
  totalBlockingTime: number;
  /** 页面加载时间 */
  pageLoadTime: number;
  /** 资源加载时间 */
  resourceLoadTimes: Record<string, number>;
  /** 组件渲染时间 */
  componentRenderTimes: Record<string, number>;
}

/**
 * 启动指标（用于监控组件）
 */
export interface StartupMetrics {
  /** 总启动时长（毫秒） */
  totalDuration: number;
  /** 各阶段耗时 */
  phases: Record<string, number>;
  /** 内存使用量（字节） */
  memoryUsage?: number;
  /** CPU 使用率（百分比） */
  cpuUsage?: number;
  /** 启动时间戳 */
  startTimestamp: number;
  /** 完成时间戳 */
  endTimestamp?: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetric {
  /** 指标名称 */
  name: string;
  /** 指标值 */
  value: number;
  /** 单位 */
  unit: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 启动优化建议
 */
export interface OptimizationSuggestion {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: 'performance' | 'memory' | 'network' | 'user-experience';
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 建议标题 */
  title: string;
  /** 建议描述 */
  description: string;
  /** 预期收益 */
  expectedBenefit: string;
  /** 实施难度 */
  implementationDifficulty: 'easy' | 'medium' | 'hard';
  /** 相关阶段 */
  relatedPhase?: StartupPhase;
  /** 实施步骤 */
  implementationSteps?: string[];
}

/**
 * 启动监控配置
 */
export interface StartupMonitoringConfig {
  /** 启用监控 */
  enabled: boolean;
  /** 监控间隔（毫秒） */
  monitoringInterval: number;
  /** 性能指标采集 */
  collectPerformanceMetrics: boolean;
  /** 内存监控 */
  monitorMemoryUsage: boolean;
  /** 网络监控 */
  monitorNetworkUsage: boolean;
  /** 错误监控 */
  monitorErrors: boolean;
  /** 用户体验监控 */
  monitorUserExperience: boolean;
}

/**
 * 启动阶段详细信息
 */
export interface StartupPhaseInfo {
  /** 阶段枚举 */
  phase: StartupPhase;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 权重（用于进度计算） */
  weight: number;
  /** 是否必需 */
  required: boolean;
  /** 依赖的阶段 */
  dependencies: StartupPhase[];
  /** 预计耗时（毫秒） */
  estimatedDuration: number;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * 启动上下文
 */
export interface StartupContext {
  /** 当前阶段 */
  currentPhase?: StartupPhase;
  /** 启动时间 */
  startTime: number;
  /** 阶段结果 */
  phaseResults: Map<StartupPhase, PhaseResult>;
  /** 配置 */
  config: StartupConfig;
  /** 优化配置 */
  optimization: StartupOptimization;
  /** 监控配置 */
  monitoring: StartupMonitoringConfig;
  /** 性能指标 */
  performanceMetrics?: StartupPerformanceMetrics;
  /** 错误列表 */
  errors: Array<{
    phase: StartupPhase;
    error: string;
    timestamp: number;
  }>;
}

/**
 * 阶段名称映射
 */
export const PHASE_NAMES: Record<StartupPhase, string> = {
  [StartupPhase.AppInitialization]: '应用初始化',
  [StartupPhase.DatabaseConnection]: '数据库连接',
  [StartupPhase.ConfigLoading]: '配置加载',
  [StartupPhase.ThemeLoading]: '主题加载',
  [StartupPhase.AdapterLoading]: '适配器加载',
  [StartupPhase.Live2DModelLoading]: 'Live2D模型加载',
  [StartupPhase.WindowCreation]: '窗口创建',
  [StartupPhase.FrontendInitialization]: '前端初始化',
  [StartupPhase.SystemServices]: '系统服务启动',
  [StartupPhase.NetworkConnection]: '网络连接检查',
  [StartupPhase.Completed]: '启动完成',
};

/**
 * 阶段权重映射
 */
export const PHASE_WEIGHTS: Record<StartupPhase, number> = {
  [StartupPhase.AppInitialization]: 10,
  [StartupPhase.DatabaseConnection]: 15,
  [StartupPhase.ConfigLoading]: 8,
  [StartupPhase.ThemeLoading]: 5,
  [StartupPhase.AdapterLoading]: 12,
  [StartupPhase.Live2DModelLoading]: 20,
  [StartupPhase.WindowCreation]: 8,
  [StartupPhase.FrontendInitialization]: 15,
  [StartupPhase.SystemServices]: 5,
  [StartupPhase.NetworkConnection]: 2,
  [StartupPhase.Completed]: 0,
};

/**
 * 默认启动配置
 */
export const DEFAULT_STARTUP_CONFIG: StartupConfig = {
  enable_preloading: true,
  max_parallel_loading: 4,
  timeout_ms: 30000,
  enable_performance_monitoring: true,
  enable_startup_cache: true,
  skip_optional_phases: [],
  deferred_phases: [StartupPhase.Live2DModelLoading, StartupPhase.NetworkConnection],
};

/**
 * 默认优化配置
 */
export const DEFAULT_OPTIMIZATION_CONFIG: StartupOptimization = {
  codeSplitting: {
    enabled: true,
    strategy: 'route',
    preloadRoutes: ['/chat', '/settings'],
    lazyComponents: ['WorkflowEditor', 'ThemeCustomizer', 'AdapterManager'],
  },
  resourcePreloading: {
    enabled: true,
    strategy: 'auto',
    resourceTypes: [ResourceType.Image, ResourceType.CSS, ResourceType.JavaScript],
    priorities: {
      'critical-css': 10,
      'main-js': 9,
      'character-models': 8,
      'themes': 6,
      'adapters': 5,
    },
  },
  firstScreenOptimization: {
    enabled: true,
    inlineCriticalCSS: true,
    lazyLoadImages: true,
    virtualScrolling: true,
  },
  cacheStrategy: {
    enabled: true,
    types: [CacheType.Memory, CacheType.LocalStorage, CacheType.ServiceWorker],
    expireTime: 86400, // 24 hours
    maxSize: 100, // 100MB
  },
};

/**
 * 启动工具函数
 */
export class StartupUtils {
  /**
   * 获取阶段显示名称
   */
  static getPhaseDisplayName(phase: StartupPhase): string {
    return PHASE_NAMES[phase] || phase;
  }

  /**
   * 获取阶段权重
   */
  static getPhaseWeight(phase: StartupPhase): number {
    return PHASE_WEIGHTS[phase] || 0;
  }

  /**
   * 计算总权重
   */
  static getTotalWeight(phases: StartupPhase[]): number {
    return phases.reduce((total, phase) => total + this.getPhaseWeight(phase), 0);
  }

  /**
   * 计算进度百分比
   */
  static calculateProgress(completedPhases: StartupPhase[], allPhases: StartupPhase[]): number {
    const totalWeight = this.getTotalWeight(allPhases);
    const completedWeight = this.getTotalWeight(completedPhases);
    return totalWeight > 0 ? completedWeight / totalWeight : 0;
  }

  /**
   * 格式化时长
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 格式化内存大小
   */
  static formatMemorySize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 获取阶段状态颜色
   */
  static getPhaseStatusColor(result?: PhaseResult): string {
    if (!result) return '#6b7280'; // 未开始 - 灰色
    if (!result.end_time) return '#3b82f6'; // 进行中 - 蓝色
    if (result.success) return '#10b981'; // 成功 - 绿色
    return '#ef4444'; // 失败 - 红色
  }

  /**
   * 生成启动报告
   */
  static generateStartupReport(
    stats: StartupStats,
    phaseResults: Map<StartupPhase, PhaseResult>,
    performanceMetrics?: StartupPerformanceMetrics
  ): string {
    const lines: string[] = [];
    
    lines.push('# 启动性能报告');
    lines.push('');
    lines.push(`**总耗时**: ${this.formatDuration(stats.total_duration)}`);
    lines.push(`**成功阶段**: ${stats.success_count}/${stats.phase_count}`);
    lines.push(`**内存峰值**: ${this.formatMemorySize(stats.memory_peak)}`);
    
    if (stats.slowest_phase) {
      lines.push(`**最慢阶段**: ${this.getPhaseDisplayName(stats.slowest_phase)}`);
    }
    
    lines.push('');
    lines.push('## 阶段详情');
    
    for (const [phase, result] of Array.from(phaseResults.entries())) {
      lines.push(`- **${this.getPhaseDisplayName(phase)}**: ${
        result.duration ? this.formatDuration(result.duration) : '未完成'
      } ${result.success ? '✅' : result.error ? '❌' : '⏳'}`);
    }
    
    if (performanceMetrics) {
      lines.push('');
      lines.push('## 性能指标');
      lines.push(`- **首次绘制**: ${performanceMetrics.firstPaint}ms`);
      lines.push(`- **首次内容绘制**: ${performanceMetrics.firstContentfulPaint}ms`);
      lines.push(`- **交互时间**: ${performanceMetrics.timeToInteractive}ms`);
    }
    
    if (stats.improvement_suggestions.length > 0) {
      lines.push('');
      lines.push('## 优化建议');
      for (const suggestion of stats.improvement_suggestions) {
        lines.push(`- ${suggestion}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 检查是否为慢启动
   */
  static isSlowStartup(stats: StartupStats): boolean {
    return stats.total_duration > 10000; // 超过10秒认为是慢启动
  }

  /**
   * 获取性能评级
   */
  static getPerformanceRating(stats: StartupStats): 'excellent' | 'good' | 'average' | 'poor' {
    const duration = stats.total_duration;
    
    if (duration < 3000) return 'excellent'; // 3秒以内
    if (duration < 6000) return 'good'; // 6秒以内
    if (duration < 10000) return 'average'; // 10秒以内
    return 'poor'; // 超过10秒
  }
}

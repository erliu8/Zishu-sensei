/**
 * 启动优化相关 React Hooks
 */
import { useState, useEffect, useCallback } from 'react';
import {
  StartupConfig,
  StartupPhase,
  StartupStats,
  StartupEvent,
  StartupOptimization,
  StartupPerformanceMetrics,
  OptimizationSuggestion,
  StartupContext,
  PhaseResult,
  DEFAULT_STARTUP_CONFIG,
  DEFAULT_OPTIMIZATION_CONFIG,
} from '../types/startup';
import { startupService } from '../services/startupService';

/**
 * 启动进度监控 Hook
 */
export function useStartupProgress() {
  const [progress, setProgress] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<StartupPhase | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const updateProgress = async () => {
      try {
        const progressValue = await startupService.getProgress();
        if (mounted) {
          setProgress(progressValue);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    };

    const handleStartupEvent = (event: StartupEvent) => {
      if (!mounted) return;

      if (event.event_type === 'phase_started') {
        setCurrentPhase(event.phase || null);
      }
      
      if (event.progress !== undefined) {
        setProgress(event.progress);
      }

      if (event.event_type === 'startup_completed') {
        setProgress(1);
        setCurrentPhase(StartupPhase.Completed);
        setIsLoading(false);
      }
    };

    // 添加事件监听器
    startupService.addEventListener('startup_event', handleStartupEvent);

    // 初始获取进度
    updateProgress();

    // 定期更新进度
    const interval = setInterval(updateProgress, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
      startupService.removeEventListener('startup_event', handleStartupEvent);
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const progressValue = await startupService.getProgress();
      setProgress(progressValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    progress,
    currentPhase,
    isLoading,
    error,
    refresh,
  };
}

/**
 * 启动统计 Hook
 */
export function useStartupStats() {
  const [stats, setStats] = useState<StartupStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statsData = await startupService.getStats();
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats,
  };
}

/**
 * 启动配置管理 Hook
 */
export function useStartupConfig() {
  const [config, setConfig] = useState<StartupConfig>(DEFAULT_STARTUP_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const configData = await startupService.getStartupConfig();
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<StartupConfig>) => {
    setIsSaving(true);
    setError(null);
    try {
      const updatedConfig = { ...config, ...newConfig };
      await startupService.updateStartupConfig(updatedConfig);
      setConfig(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const resetConfig = useCallback(async () => {
    await updateConfig(DEFAULT_STARTUP_CONFIG);
  }, [updateConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    error,
    isSaving,
    updateConfig,
    resetConfig,
    refresh: fetchConfig,
  };
}

/**
 * 启动性能监控 Hook
 */
export function useStartupPerformanceMonitoring() {
  const [metrics, setMetrics] = useState<StartupPerformanceMetrics | null>(null);
  const [events, setEvents] = useState<StartupEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    setEvents([]);

    const handleEvent = (event: StartupEvent) => {
      setEvents(prev => [...prev, event].slice(-100)); // 保留最近100个事件
    };

    startupService.addEventListener('startup_event', handleEvent);
    startupService.addEventListener('performance_metric', handleEvent);

    return () => {
      startupService.removeEventListener('startup_event', handleEvent);
      startupService.removeEventListener('performance_metric', handleEvent);
    };
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  const collectMetrics = useCallback(async () => {
    try {
      const metricsData = await startupService.collectPerformanceMetrics();
      setMetrics(metricsData);
      return metricsData;
    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
      throw error;
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    metrics,
    events,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    collectMetrics,
    clearEvents,
  };
}

/**
 * 启动优化建议 Hook
 */
export function useStartupOptimizationSuggestions() {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const suggestionsData = await startupService.generateOptimizationSuggestions();
      setSuggestions(suggestionsData);
      return suggestionsData;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applySuggestion = useCallback(async (suggestionId: string) => {
    // 这里可以实现自动应用建议的逻辑
    console.log('Applying suggestion:', suggestionId);
  }, []);

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    generateSuggestions,
    applySuggestion,
    dismissSuggestion,
  };
}

/**
 * 启动缓存管理 Hook
 */
export function useStartupCache() {
  const [cacheStats, setCacheStats] = useState<{
    size: number;
    entries: number;
    hitRate: number;
  }>({
    size: 0,
    entries: 0,
    hitRate: 0,
  });

  const getCache = useCallback(async (key: string) => {
    try {
      return await startupService.getCache(key);
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }, []);

  const setCache = useCallback(async (key: string, value: any) => {
    try {
      await startupService.setCache(key, value);
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error);
      throw error;
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await startupService.clearCache();
      setCacheStats({ size: 0, entries: 0, hitRate: 0 });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }, []);

  return {
    cacheStats,
    getCache,
    setCache,
    clearCache,
  };
}

/**
 * 启动阶段执行 Hook
 */
export function useStartupPhaseExecution() {
  const [currentPhase, setCurrentPhase] = useState<StartupPhase | null>(null);
  const [phaseResults, setPhaseResults] = useState<Map<StartupPhase, PhaseResult>>(new Map());
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const startPhase = useCallback(async (phase: StartupPhase) => {
    setCurrentPhase(phase);
    setIsExecuting(true);
    try {
      await startupService.startPhase(phase);
      // 更新阶段结果
      setPhaseResults(prev => {
        const newResults = new Map(prev);
        newResults.set(phase, {
          phase,
          start_time: Date.now(),
          success: false,
          metrics: {},
        });
        return newResults;
      });
    } catch (error) {
      console.error(`Failed to start phase ${phase}:`, error);
      throw error;
    }
  }, []);

  const finishPhase = useCallback(async (
    phase: StartupPhase,
    success: boolean,
    metrics?: Record<string, number>,
    error?: string
  ) => {
    try {
      if (success) {
        await startupService.finishPhaseSuccess(phase, metrics);
      } else {
        await startupService.finishPhaseError(phase, error || 'Unknown error');
      }

      // 更新阶段结果
      setPhaseResults(prev => {
        const newResults = new Map(prev);
        const existing = newResults.get(phase);
        if (existing) {
          const endTime = Date.now();
          newResults.set(phase, {
            ...existing,
            end_time: endTime,
            duration: endTime - existing.start_time,
            success,
            error,
            metrics: metrics || {},
          });
        }
        return newResults;
      });

      setIsExecuting(false);
      if (phase === StartupPhase.Completed) {
        setCurrentPhase(null);
      }
    } catch (err) {
      console.error(`Failed to finish phase ${phase}:`, err);
      setIsExecuting(false);
      throw err;
    }
  }, []);

  const executePhase = useCallback(async (
    phase: StartupPhase,
    executor: () => Promise<Record<string, number> | void>
  ) => {
    await startPhase(phase);
    try {
      const metrics = await executor();
      await finishPhase(phase, true, metrics || {});
    } catch (error) {
      await finishPhase(
        phase,
        false,
        {},
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }, [startPhase, finishPhase]);

  return {
    currentPhase,
    phaseResults,
    isExecuting,
    startPhase,
    finishPhase,
    executePhase,
  };
}

/**
 * 启动上下文 Hook
 */
export function useStartupContext(): StartupContext {
  const { currentPhase } = useStartupProgress();
  const { } = useStartupStats();
  const { config } = useStartupConfig();
  const { metrics } = useStartupPerformanceMonitoring();
  const { phaseResults } = useStartupPhaseExecution();

  return {
    currentPhase: currentPhase || undefined,
    startTime: Date.now(), // 这里应该从实际的启动时间获取
    phaseResults,
    config,
    optimization: DEFAULT_OPTIMIZATION_CONFIG,
    monitoring: {
      enabled: true,
      monitoringInterval: 1000,
      collectPerformanceMetrics: true,
      monitorMemoryUsage: true,
      monitorNetworkUsage: false,
      monitorErrors: true,
      monitorUserExperience: true,
    },
    performanceMetrics: metrics || undefined,
    errors: [],
  };
}

/**
 * 资源预加载 Hook
 */
export function useResourcePreloader() {
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  const [preloadedResources, setPreloadedResources] = useState<Set<string>>(new Set());
  const [preloadError, setPreloadError] = useState<string | null>(null);

  const preloadResources = useCallback(async (resources: string[]) => {
    setIsPreloading(true);
    setPreloadError(null);
    
    try {
      await startupService.preloadResources(resources);
      setPreloadedResources(prev => {
        const newSet = new Set(prev);
        resources.forEach(resource => newSet.add(resource));
        return newSet;
      });
    } catch (error) {
      setPreloadError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setIsPreloading(false);
    }
  }, []);

  const isResourcePreloaded = useCallback((resource: string) => {
    return preloadedResources.has(resource);
  }, [preloadedResources]);

  const clearPreloadedResources = useCallback(() => {
    setPreloadedResources(new Set());
  }, []);

  return {
    isPreloading,
    preloadedResources: Array.from(preloadedResources),
    preloadError,
    preloadResources,
    isResourcePreloaded,
    clearPreloadedResources,
  };
}

/**
 * 启动优化执行 Hook
 */
export function useStartupOptimizationExecution() {
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  const executeOptimization = useCallback(async (config?: StartupOptimization) => {
    setIsOptimizing(true);
    setOptimizationError(null);
    setOptimizationResult(null);

    try {
      // 执行前端优化
      if (config) {
        await startupService.executeFrontendOptimization(config);
      }

      // 执行后端优化
      const result = await startupService.optimizeStartup();
      setOptimizationResult(result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOptimizationError(errorMessage);
      throw error;
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOptimizationResult(null);
    setOptimizationError(null);
  }, []);

  return {
    isOptimizing,
    optimizationResult,
    optimizationError,
    executeOptimization,
    reset,
  };
}

/**
 * 组合 Hook：完整的启动优化管理
 */
export function useStartupOptimization() {
  const progress = useStartupProgress();
  const stats = useStartupStats();
  const config = useStartupConfig();
  const monitoring = useStartupPerformanceMonitoring();
  const suggestions = useStartupOptimizationSuggestions();
  const cache = useStartupCache();
  const phaseExecution = useStartupPhaseExecution();
  const preloader = useResourcePreloader();
  const optimization = useStartupOptimizationExecution();
  const context = useStartupContext();

  return {
    progress,
    stats,
    config,
    monitoring,
    suggestions,
    cache,
    phaseExecution,
    preloader,
    optimization,
    context,
  };
}

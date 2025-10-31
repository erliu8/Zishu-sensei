/**
 * 内存管理相关 Hooks
 * 提供内存监控、清理、泄漏检测等功能的 React Hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MemoryInfo,
  MemoryPoolStats,
  MemorySnapshot,
  MemoryLeakInfo,
  MemoryCleanupResult,
  MemoryThresholds,
  MemoryStatus,
  MemorySummary,
  MemoryOptimizationOptions,
  DEFAULT_OPTIMIZATION_OPTIONS,
} from '../types/memory';
import memoryService from '../services/memoryService';

/**
 * 使用内存信息 Hook
 */
export function useMemoryInfo(refreshInterval: number = 5000) {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemoryInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await memoryService.getMemoryInfo();
      setMemoryInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存信息失败');
      console.error('获取内存信息失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemoryInfo();
    if (refreshInterval > 0) {
      const timer = setInterval(fetchMemoryInfo, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [fetchMemoryInfo, refreshInterval]);

  return { memoryInfo, loading, error, refresh: fetchMemoryInfo };
}

/**
 * 使用内存池统计 Hook
 */
export function useMemoryPoolStats(refreshInterval: number = 10000) {
  const [poolStats, setPoolStats] = useState<MemoryPoolStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoolStats = useCallback(async () => {
    try {
      setLoading(true);
      const stats = await memoryService.getMemoryPoolStats();
      setPoolStats(stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存池统计失败');
      console.error('获取内存池统计失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoolStats();
    if (refreshInterval > 0) {
      const timer = setInterval(fetchPoolStats, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [fetchPoolStats, refreshInterval]);

  return { poolStats, loading, error, refresh: fetchPoolStats };
}

/**
 * 使用内存快照 Hook
 */
export function useMemorySnapshots(limit: number = 50) {
  const [snapshots, setSnapshots] = useState<MemorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      const data = await memoryService.getMemorySnapshots(limit);
      setSnapshots(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存快照失败');
      console.error('获取内存快照失败:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const createSnapshot = useCallback(async () => {
    try {
      await memoryService.createMemorySnapshot();
      await fetchSnapshots();
    } catch (err) {
      console.error('创建内存快照失败:', err);
      throw err;
    }
  }, [fetchSnapshots]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  return { snapshots, loading, error, refresh: fetchSnapshots, createSnapshot };
}

/**
 * 使用内存泄漏检测 Hook
 */
export function useMemoryLeakDetection(autoDetect: boolean = true, interval: number = 600000) {
  const [leaks, setLeaks] = useState<MemoryLeakInfo[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const detectLeaks = useCallback(async () => {
    try {
      setDetecting(true);
      const detectedLeaks = await memoryService.detectMemoryLeaks();
      setLeaks(detectedLeaks);
      setError(null);
      return detectedLeaks;
    } catch (err) {
      setError(err instanceof Error ? err.message : '检测内存泄漏失败');
      console.error('检测内存泄漏失败:', err);
      throw err;
    } finally {
      setDetecting(false);
    }
  }, []);

  const getLeakReports = useCallback(async (limit: number = 20) => {
    try {
      const reports = await memoryService.getMemoryLeakReports(limit);
      setLeaks(reports);
      setError(null);
      return reports;
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取泄漏报告失败');
      console.error('获取泄漏报告失败:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (autoDetect) {
      detectLeaks();
      timerRef.current = memoryService.startLeakDetection(interval);
    }

    return () => {
      if (timerRef.current !== null) {
        memoryService.stopLeakDetection(timerRef.current);
      }
    };
  }, [autoDetect, interval, detectLeaks]);

  return { leaks, detecting, error, detectLeaks, getLeakReports };
}

/**
 * 使用内存清理 Hook
 */
export function useMemoryCleanup() {
  const [cleaning, setCleaning] = useState(false);
  const [lastResult, setLastResult] = useState<MemoryCleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(async () => {
    try {
      setCleaning(true);
      setError(null);
      const result = await memoryService.cleanupMemory();
      setLastResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '内存清理失败';
      setError(message);
      console.error('内存清理失败:', err);
      throw err;
    } finally {
      setCleaning(false);
    }
  }, []);

  return { cleanup, cleaning, lastResult, error };
}

/**
 * 使用内存优化 Hook
 */
export function useMemoryOptimization(options: Partial<MemoryOptimizationOptions> = {}) {
  const [optimizationEnabled, setOptimizationEnabled] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<MemoryOptimizationOptions>({
    ...DEFAULT_OPTIMIZATION_OPTIONS,
    ...options,
  });

  const cleanupTimerRef = useRef<number | null>(null);
  const leakDetectionTimerRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);

  const startOptimization = useCallback(() => {
    if (optimizationEnabled) return;

    // 启动自动清理
    if (currentOptions.auto_cleanup) {
      cleanupTimerRef.current = memoryService.startAutoCleanup(
        currentOptions.cleanup_interval * 1000
      );
    }

    // 启动泄漏检测
    if (currentOptions.leak_detection) {
      leakDetectionTimerRef.current = memoryService.startLeakDetection(
        currentOptions.leak_detection_interval * 1000
      );
    }

    // 启动快照采集
    if (currentOptions.snapshot_enabled) {
      snapshotTimerRef.current = memoryService.startSnapshotCollection(
        currentOptions.snapshot_interval * 1000
      );
    }

    setOptimizationEnabled(true);
  }, [optimizationEnabled, currentOptions]);

  const stopOptimization = useCallback(() => {
    if (!optimizationEnabled) return;

    // 停止自动清理
    if (cleanupTimerRef.current !== null) {
      memoryService.stopAutoCleanup(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    // 停止泄漏检测
    if (leakDetectionTimerRef.current !== null) {
      memoryService.stopLeakDetection(leakDetectionTimerRef.current);
      leakDetectionTimerRef.current = null;
    }

    // 停止快照采集
    if (snapshotTimerRef.current !== null) {
      memoryService.stopSnapshotCollection(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }

    setOptimizationEnabled(false);
  }, [optimizationEnabled]);

  const updateOptions = useCallback(
    (newOptions: Partial<MemoryOptimizationOptions>) => {
      setCurrentOptions(prev => ({ ...prev, ...newOptions }));
      if (optimizationEnabled) {
        stopOptimization();
        setTimeout(() => startOptimization(), 100);
      }
    },
    [optimizationEnabled, startOptimization, stopOptimization]
  );

  useEffect(() => {
    return () => {
      stopOptimization();
    };
  }, [stopOptimization]);

  return {
    optimizationEnabled,
    currentOptions,
    startOptimization,
    stopOptimization,
    updateOptions,
  };
}

/**
 * 使用内存状态 Hook
 */
export function useMemoryStatus(refreshInterval: number = 5000) {
  const [status, setStatus] = useState<MemoryStatus>('normal');
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [statusData, summaryData] = await Promise.all([
        memoryService.getMemoryStatus(),
        memoryService.getMemorySummary(),
      ]);
      setStatus(statusData);
      setSummary(summaryData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存状态失败');
      console.error('获取内存状态失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (refreshInterval > 0) {
      const timer = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [fetchStatus, refreshInterval]);

  return { status, summary, loading, error, refresh: fetchStatus };
}

/**
 * 使用内存阈值 Hook
 */
export function useMemoryThresholds() {
  const [thresholds, setThresholds] = useState<MemoryThresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await memoryService.getMemoryThresholds();
      setThresholds(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存阈值失败');
      console.error('获取内存阈值失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateThresholds = useCallback(async (newThresholds: MemoryThresholds) => {
    try {
      await memoryService.setMemoryThresholds(newThresholds);
      setThresholds(newThresholds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新内存阈值失败');
      console.error('更新内存阈值失败:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  return { thresholds, loading, error, updateThresholds, refresh: fetchThresholds };
}


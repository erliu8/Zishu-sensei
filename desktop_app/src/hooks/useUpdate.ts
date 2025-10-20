/**
 * 更新相关的 React Hooks
 * 
 * 提供更新系统的状态管理和操作封装
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnlistenFn } from '@tauri-apps/api/event';
import { 
  updateService, 
  updateOperations, 
  updateUtils 
} from '../services/updateService';
import { 
  UpdateInfo, 
  UpdateConfig, 
  VersionHistory, 
  UpdateEvent, 
  UpdateStats,
  defaultUpdateConfig,
  isUpdateAvailable,
  isUpdateInProgress,
  isUpdateFailed,
} from '../types/update';

/**
 * 更新管理器状态 Hook
 */
export const useUpdateManager = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (isInitializing || isInitialized) return;

    setIsInitializing(true);
    setInitError(null);

    try {
      const result = await updateService.initialize();
      setIsInitialized(result);
      
      if (!result) {
        setInitError('更新管理器初始化失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setInitError(`初始化失败: ${errorMessage}`);
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isInitialized]);

  useEffect(() => {
    initialize();

    return () => {
      if (isInitialized) {
        updateService.destroy();
      }
    };
  }, [initialize, isInitialized]);

  return {
    isInitialized,
    isInitializing,
    initError,
    initialize,
  };
};

/**
 * 更新检查 Hook
 */
export const useUpdateCheck = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const checkForUpdates = useCallback(async (force = false) => {
    setIsChecking(true);
    setCheckError(null);

    try {
      const result = await updateService.checkForUpdates(force);
      
      setHasUpdate(result.has_update);
      setUpdateInfo(result.update_info || null);
      setLastCheckTime(new Date());
      
      if (result.error) {
        setCheckError(result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '检查更新失败';
      setCheckError(errorMessage);
      setHasUpdate(false);
      setUpdateInfo(null);
      throw error;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 自动检查更新
  const autoCheck = useCallback(async () => {
    try {
      const config = await updateService.getUpdateConfig();
      if (config.auto_check_enabled) {
        await checkForUpdates(false);
      }
    } catch (error) {
      console.warn('Auto check failed:', error);
    }
  }, [checkForUpdates]);

  return {
    updateInfo,
    hasUpdate,
    isChecking,
    checkError,
    lastCheckTime,
    checkForUpdates,
    autoCheck,
    // 便捷的状态检查
    isUpdateAvailable: isUpdateAvailable(updateInfo || undefined),
    isUpdateInProgress: isUpdateInProgress(updateInfo || undefined),
    isUpdateFailed: isUpdateFailed(updateInfo || undefined),
  };
};

/**
 * 更新下载 Hook
 */
export const useUpdateDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);

  const downloadUpdate = useCallback(async (version: string) => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);
    setDownloadedFilePath(null);

    try {
      const filePath = await updateService.downloadUpdate(version);
      setDownloadedFilePath(filePath);
      setDownloadProgress(100);
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败';
      setDownloadError(errorMessage);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const cancelDownload = useCallback(async (version: string) => {
    try {
      await updateService.cancelDownload(version);
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadError(null);
    } catch (error) {
      console.error('Cancel download failed:', error);
    }
  }, []);

  return {
    isDownloading,
    downloadProgress,
    downloadError,
    downloadedFilePath,
    downloadUpdate,
    cancelDownload,
  };
};

/**
 * 更新安装 Hook
 */
export const useUpdateInstall = () => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState<string | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);

  const installUpdate = useCallback(async (version: string) => {
    setIsInstalling(true);
    setInstallError(null);
    setInstallProgress(0);
    setNeedsRestart(false);

    try {
      const result = await updateService.installUpdate(version);
      setNeedsRestart(result);
      setInstallProgress(100);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '安装失败';
      setInstallError(errorMessage);
      throw error;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const installWithTauri = useCallback(async () => {
    setIsInstalling(true);
    setInstallError(null);
    setInstallProgress(0);
    setNeedsRestart(false);

    try {
      const result = await updateService.installUpdateWithTauri();
      setNeedsRestart(result);
      setInstallProgress(100);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '安装失败';
      setInstallError(errorMessage);
      throw error;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const restartApplication = useCallback(async () => {
    try {
      await updateService.restartApplication();
    } catch (error) {
      console.error('Restart failed:', error);
      throw error;
    }
  }, []);

  return {
    isInstalling,
    installProgress,
    installError,
    needsRestart,
    installUpdate,
    installWithTauri,
    restartApplication,
  };
};

/**
 * 更新配置 Hook
 */
export const useUpdateConfig = () => {
  const [config, setConfig] = useState<UpdateConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedConfig = await updateService.getUpdateConfig();
      setConfig(loadedConfig);
      setHasChanges(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载配置失败';
      setError(errorMessage);
      setConfig({ ...defaultUpdateConfig } as UpdateConfig);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: UpdateConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      // 验证配置
      const validation = updateUtils.validateUpdateConfig(newConfig);
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      await updateService.saveUpdateConfig(newConfig);
      setConfig(newConfig);
      setHasChanges(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存配置失败';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<UpdateConfig>) => {
    if (!config) return;

    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setHasChanges(true);
  }, [config]);

  const resetConfig = useCallback(() => {
    if (!config) return;

    setConfig({ ...config, ...defaultUpdateConfig });
    setHasChanges(true);
  }, [config]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    isLoading,
    error,
    hasChanges,
    loadConfig,
    saveConfig,
    updateConfig,
    resetConfig,
  };
};

/**
 * 版本历史 Hook
 */
export const useVersionHistory = () => {
  const [history, setHistory] = useState<VersionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedHistory = await updateService.getVersionHistory();
      setHistory(loadedHistory);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载版本历史失败';
      setError(errorMessage);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rollbackToVersion = useCallback(async (version: string) => {
    try {
      await updateService.rollbackToVersion(version);
      await loadHistory(); // 重新加载历史
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '回滚失败';
      setError(errorMessage);
      return false;
    }
  }, [loadHistory]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    history,
    isLoading,
    error,
    loadHistory,
    rollbackToVersion,
  };
};

/**
 * 更新统计 Hook
 */
export const useUpdateStats = () => {
  const [stats, setStats] = useState<UpdateStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedStats = await updateUtils.getFormattedStats();
      setStats(loadedStats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载统计失败';
      setError(errorMessage);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    error,
    loadStats,
  };
};

/**
 * 更新事件监听 Hook
 */
export const useUpdateEvents = (callback?: (event: UpdateEvent) => void) => {
  const [events, setEvents] = useState<UpdateEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<UpdateEvent | null>(null);
  const callbackRef = useRef(callback);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const handleEvent = useCallback((event: UpdateEvent) => {
    setLatestEvent(event);
    setEvents(prev => [...prev.slice(-19), event]); // 保留最近20个事件
    
    if (callbackRef.current) {
      callbackRef.current(event);
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLatestEvent(null);
  }, []);

  useEffect(() => {
    const setupListener = async () => {
      try {
        const unlisten = await updateService.onUpdateEvent(handleEvent);
        unlistenRef.current = unlisten;
      } catch (error) {
        console.error('Failed to setup update event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [handleEvent]);

  return {
    events,
    latestEvent,
    clearEvents,
  };
};

/**
 * 完整更新流程 Hook
 */
export const useUpdateFlow = () => {
  const [currentStep, setCurrentStep] = useState<'idle' | 'checking' | 'downloading' | 'installing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const updateEvents = useUpdateEvents((event) => {
    switch (event.type) {
      case 'CheckStarted':
        setCurrentStep('checking');
        setProgress(0);
        setError(null);
        break;
      case 'CheckCompleted':
        if (event.data.has_update && event.data.update_info) {
          setUpdateInfo(event.data.update_info);
          setProgress(20);
        } else {
          setCurrentStep('idle');
          setProgress(0);
        }
        break;
      case 'CheckFailed':
        setCurrentStep('failed');
        setError(event.data.error);
        break;
      case 'DownloadStarted':
        setCurrentStep('downloading');
        setProgress(20);
        break;
      case 'DownloadProgress':
        setProgress(20 + (event.data.percentage * 0.6)); // 20-80%
        break;
      case 'DownloadCompleted':
        setProgress(80);
        break;
      case 'DownloadFailed':
        setCurrentStep('failed');
        setError(event.data.error);
        break;
      case 'InstallStarted':
        setCurrentStep('installing');
        setProgress(80);
        break;
      case 'InstallProgress':
        setProgress(80 + (event.data.percentage * 0.2)); // 80-100%
        break;
      case 'InstallCompleted':
        setCurrentStep('completed');
        setProgress(100);
        break;
      case 'InstallFailed':
        setCurrentStep('failed');
        setError(event.data.error);
        break;
    }
  });

  const startUpdateFlow = useCallback(async (version: string) => {
    setCurrentStep('idle');
    setProgress(0);
    setError(null);
    setUpdateInfo(null);

    try {
      await updateOperations.performFullUpdate(version);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      setError(errorMessage);
      setCurrentStep('failed');
    }
  }, []);

  const resetFlow = useCallback(() => {
    setCurrentStep('idle');
    setProgress(0);
    setError(null);
    setUpdateInfo(null);
  }, []);

  return {
    currentStep,
    progress,
    error,
    updateInfo,
    startUpdateFlow,
    resetFlow,
    events: updateEvents.events,
  };
};

/**
 * 应用版本信息 Hook
 */
export const useAppVersion = () => {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersion = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const version = await updateService.getCurrentVersion();
      setCurrentVersion(version);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取版本失败';
      setError(errorMessage);
      setCurrentVersion('Unknown');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);

  return {
    currentVersion,
    isLoading,
    error,
    loadVersion,
  };
};

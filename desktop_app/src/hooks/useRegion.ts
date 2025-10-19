/**
 * 区域适配相关 React Hooks
 * 
 * 提供区域适配功能的 React Hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RegionPreferences, 
  SystemRegionInfo, 
  RegionConfig, 
  RegionState, 
  RegionActions,
  FormattedValue,
  FormatState,
  FormatActions,
  createDefaultRegionPreferences,
  validateRegionPreferences
} from '../types/region';
import { RegionService, CachedRegionService, FormatCache } from '../services/regionService';

// ================================
// 主要区域适配 Hook
// ================================

/**
 * 区域适配主 Hook
 * 提供完整的区域适配状态管理和操作
 */
export function useRegion(userId?: string): RegionState & RegionActions {
  const [state, setState] = useState<RegionState>({
    preferences: null,
    systemRegion: null,
    availableRegions: [],
    loading: false,
    error: null,
    initialized: false,
  });

  // ================================
  // 状态更新辅助函数
  // ================================

  const updateState = useCallback((updates: Partial<RegionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    updateState({ loading });
  }, [updateState]);

  const setError = useCallback((error: string | null) => {
    updateState({ error });
  }, [updateState]);

  // ================================
  // 操作函数
  // ================================

  const detectSystemRegion = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const systemRegion = await RegionService.detectSystemRegion();
      updateState({ systemRegion });
    } catch (error) {
      setError(error instanceof Error ? error.message : '检测系统区域失败');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, updateState]);

  const getUserPreferences = useCallback(async (targetUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const preferences = await RegionService.getUserRegionPreferences(targetUserId || userId);
      updateState({ preferences });
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取用户偏好失败');
    } finally {
      setLoading(false);
    }
  }, [userId, setLoading, setError, updateState]);

  const saveUserPreferences = useCallback(async (preferences: RegionPreferences) => {
    setLoading(true);
    setError(null);
    
    // 验证偏好设置
    const validationErrors = validateRegionPreferences(preferences);
    if (validationErrors.length > 0) {
      setError(`验证失败: ${validationErrors.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      await RegionService.saveUserRegionPreferences(preferences);
      updateState({ preferences });
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存用户偏好失败');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, updateState]);

  const deleteUserPreferences = useCallback(async (targetUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      await RegionService.deleteUserRegionPreferences(targetUserId || userId);
      updateState({ 
        preferences: null,
        systemRegion: null 
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除用户偏好失败');
    } finally {
      setLoading(false);
    }
  }, [userId, setLoading, setError, updateState]);

  const initializeRegionSystem = useCallback(async (targetUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const preferences = await RegionService.initializeRegionSystem(targetUserId || userId);
      const availableRegions = await RegionService.getAllRegionConfigs();
      updateState({ 
        preferences,
        availableRegions,
        initialized: true 
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '初始化区域系统失败');
    } finally {
      setLoading(false);
    }
  }, [userId, setLoading, setError, updateState]);

  const getRecommendedRegions = useCallback(async (currentLocale?: string): Promise<string[]> => {
    try {
      return await RegionService.getRecommendedRegions(currentLocale);
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取推荐区域失败');
      return [];
    }
  }, [setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // ================================
  // 初始化效果
  // ================================

  useEffect(() => {
    if (!state.initialized) {
      initializeRegionSystem();
    }
  }, [state.initialized, initializeRegionSystem]);

  return {
    ...state,
    detectSystemRegion,
    getUserPreferences,
    saveUserPreferences,
    deleteUserPreferences,
    initializeRegionSystem,
    getRecommendedRegions,
    clearError,
  };
}

// ================================
// 格式化 Hook
// ================================

/**
 * 格式化功能 Hook
 * 提供各种格式化功能和缓存管理
 */
export function useFormat(): FormatState & FormatActions {
  const [state, setState] = useState<FormatState>({
    context: null,
    cache: new Map(),
    formatting: false,
  });

  const updateState = useCallback((updates: Partial<FormatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setFormatting = useCallback((formatting: boolean) => {
    updateState({ formatting });
  }, [updateState]);

  // ================================
  // 格式化操作
  // ================================

  const formatDateTime = useCallback(async (timestamp: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatDateTime(timestamp);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatDate = useCallback(async (timestamp: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatDate(timestamp);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatTime = useCallback(async (timestamp: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatTime(timestamp);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatNumber = useCallback(async (number: number, decimalPlaces?: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatNumber(number, decimalPlaces);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatCurrency = useCallback(async (amount: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatCurrency(amount);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatTemperature = useCallback(async (celsius: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatTemperature(celsius);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatDistance = useCallback(async (meters: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatDistance(meters);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatWeight = useCallback(async (grams: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatWeight(grams);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatFileSize = useCallback(async (bytes: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatFileSize(bytes);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const formatPercentage = useCallback(async (ratio: number, decimalPlaces?: number): Promise<FormattedValue> => {
    setFormatting(true);
    try {
      return await CachedRegionService.formatPercentage(ratio, decimalPlaces);
    } finally {
      setFormatting(false);
    }
  }, [setFormatting]);

  const clearCache = useCallback(() => {
    FormatCache.clear();
    updateState({ cache: new Map() });
  }, [updateState]);

  return {
    ...state,
    formatDateTime,
    formatDate,
    formatTime,
    formatNumber,
    formatCurrency,
    formatTemperature,
    formatDistance,
    formatWeight,
    formatFileSize,
    formatPercentage,
    clearCache,
  };
}

// ================================
// 单位转换 Hook
// ================================

/**
 * 单位转换 Hook
 */
export function useUnitConversion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertTemperature = useCallback(async (
    value: number,
    fromUnit: string,
    toUnit: string
  ): Promise<number | null> => {
    setLoading(true);
    setError(null);
    try {
      return await RegionService.convertTemperature(value, fromUnit, toUnit);
    } catch (error) {
      setError(error instanceof Error ? error.message : '温度转换失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const convertDistance = useCallback(async (
    meters: number,
    toUnit: string
  ): Promise<[number, string] | null> => {
    setLoading(true);
    setError(null);
    try {
      return await RegionService.convertDistance(meters, toUnit);
    } catch (error) {
      setError(error instanceof Error ? error.message : '距离转换失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const convertWeight = useCallback(async (
    grams: number,
    toUnit: string
  ): Promise<[number, string] | null> => {
    setLoading(true);
    setError(null);
    try {
      return await RegionService.convertWeight(grams, toUnit);
    } catch (error) {
      setError(error instanceof Error ? error.message : '重量转换失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    convertTemperature,
    convertDistance,
    convertWeight,
    loading,
    error,
    clearError,
  };
}

// ================================
// 区域配置 Hook
// ================================

/**
 * 区域配置管理 Hook
 */
export function useRegionConfigs() {
  const [configs, setConfigs] = useState<RegionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allConfigs = await RegionService.getAllRegionConfigs();
      setConfigs(allConfigs);
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载区域配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfigByLocale = useCallback((locale: string): RegionConfig | undefined => {
    return configs.find(config => config.locale === locale);
  }, [configs]);

  const getSupportedLocales = useCallback((): string[] => {
    return configs.map(config => config.locale);
  }, [configs]);

  const getSupportedCurrencies = useCallback((): string[] => {
    const currencies = new Set(configs.map(config => config.currency));
    return Array.from(currencies);
  }, [configs]);

  const getSupportedTimezones = useCallback((): string[] => {
    const timezones = new Set<string>();
    configs.forEach(config => {
      config.timezone.forEach(tz => timezones.add(tz));
    });
    return Array.from(timezones);
  }, [configs]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  return {
    configs,
    loading,
    error,
    loadConfigs,
    getConfigByLocale,
    getSupportedLocales,
    getSupportedCurrencies,
    getSupportedTimezones,
  };
}

// ================================
// 区域偏好表单 Hook
// ================================

/**
 * 区域偏好表单管理 Hook
 */
export function useRegionPreferencesForm(initialPreferences?: RegionPreferences) {
  const [preferences, setPreferences] = useState<RegionPreferences>(
    initialPreferences || createDefaultRegionPreferences()
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState<Set<keyof RegionPreferences>>(new Set());

  const updatePreference = useCallback(<K extends keyof RegionPreferences>(
    key: K,
    value: RegionPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setTouched(prev => new Set(prev).add(key));
  }, []);

  const validateForm = useCallback((): boolean => {
    const validationErrors = validateRegionPreferences(preferences);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  }, [preferences]);

  const resetForm = useCallback(() => {
    setPreferences(initialPreferences || createDefaultRegionPreferences());
    setErrors([]);
    setTouched(new Set());
  }, [initialPreferences]);

  const isFieldTouched = useCallback((field: keyof RegionPreferences): boolean => {
    return touched.has(field);
  }, [touched]);

  const getFieldError = useCallback((field: keyof RegionPreferences): string | undefined => {
    if (!touched.has(field)) return undefined;
    return errors.find(error => error.includes(field));
  }, [errors, touched]);

  return {
    preferences,
    errors,
    touched: Array.from(touched),
    updatePreference,
    validateForm,
    resetForm,
    isFieldTouched,
    getFieldError,
    isValid: errors.length === 0,
    isDirty: touched.size > 0,
  };
}

// ================================
// 本地化文本 Hook
// ================================

/**
 * 本地化文本 Hook
 */
export function useLocalization() {
  const { preferences } = useRegion();

  const getLocalizedText = useCallback((
    key: string,
    defaultText?: string,
    params?: Record<string, string>
  ): string => {
    // 简化实现，实际应该从本地化资源文件获取
    let text = defaultText || key;
    
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(new RegExp(`{${param}}`, 'g'), value);
      });
    }
    
    return text;
  }, []);

  const formatLocalizedDate = useCallback((date: Date): string => {
    if (!preferences) return date.toLocaleDateString();
    
    const locale = preferences.locale.replace('-', '_');
    return date.toLocaleDateString(locale);
  }, [preferences]);

  const formatLocalizedTime = useCallback((date: Date): string => {
    if (!preferences) return date.toLocaleTimeString();
    
    const locale = preferences.locale.replace('-', '_');
    const use24Hour = preferences.time_format === '24h';
    
    return date.toLocaleTimeString(locale, {
      hour12: !use24Hour
    });
  }, [preferences]);

  return {
    getLocalizedText,
    formatLocalizedDate,
    formatLocalizedTime,
    currentLocale: preferences?.locale || 'zh-CN',
    isRTL: preferences?.rtl_support || false,
  };
}

// ================================
// 轻量级格式化 Hook（用于频繁调用）
// ================================

/**
 * 轻量级格式化 Hook
 * 用于需要频繁调用的场景，提供简化的格式化功能
 */
export function useLightweightFormat() {
  const { preferences } = useRegion();
  const cache = useRef(new Map<string, string>());

  const formatNumber = useCallback((
    number: number,
    options: { decimals?: number; currency?: boolean } = {}
  ): string => {
    if (!preferences) return number.toString();

    const cacheKey = `${number}_${JSON.stringify(options)}_${preferences.locale}`;
    const cached = cache.current.get(cacheKey);
    if (cached) return cached;

    const locale = preferences.locale.replace('-', '_');
    let formatted: string;

    if (options.currency) {
      formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: preferences.currency,
      }).format(number);
    } else {
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: options.decimals || 0,
        maximumFractionDigits: options.decimals || 2,
      }).format(number);
    }

    cache.current.set(cacheKey, formatted);
    return formatted;
  }, [preferences]);

  const formatDate = useCallback((date: Date | number): string => {
    if (!preferences) return new Date(date).toLocaleDateString();

    const dateObj = new Date(date);
    const cacheKey = `${dateObj.getTime()}_${preferences.locale}_${preferences.date_format}`;
    const cached = cache.current.get(cacheKey);
    if (cached) return cached;

    const locale = preferences.locale.replace('-', '_');
    const formatted = dateObj.toLocaleDateString(locale);

    cache.current.set(cacheKey, formatted);
    return formatted;
  }, [preferences]);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    formatNumber,
    formatDate,
    clearCache,
  };
}


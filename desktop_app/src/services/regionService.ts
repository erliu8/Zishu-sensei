/**
 * 区域适配服务
 * 
 * 提供与后端区域适配系统交互的服务接口
 */

import { invoke } from '@tauri-apps/api/tauri';
import {
  SystemRegionInfo,
  RegionPreferences,
  RegionConfig,
  FormattedValue,
  RegionFormatStats
} from '../types/region';

/**
 * 区域适配服务类
 */
export class RegionService {
  // ================================
  // 系统检测相关
  // ================================

  /**
   * 检测系统区域设置
   */
  static async detectSystemRegion(): Promise<SystemRegionInfo> {
    try {
      return await invoke<SystemRegionInfo>('detect_system_region');
    } catch (error) {
      throw new Error(`检测系统区域失败: ${error}`);
    }
  }

  /**
   * 获取推荐的区域设置列表
   */
  static async getRecommendedRegions(currentLocale?: string): Promise<string[]> {
    try {
      return await invoke<string[]>('get_recommended_regions', {
        currentLocale
      });
    } catch (error) {
      throw new Error(`获取推荐区域失败: ${error}`);
    }
  }

  // ================================
  // 用户偏好管理
  // ================================

  /**
   * 获取用户区域偏好设置
   */
  static async getUserRegionPreferences(userId?: string): Promise<RegionPreferences> {
    try {
      return await invoke<RegionPreferences>('get_user_region_preferences', {
        userId
      });
    } catch (error) {
      throw new Error(`获取用户区域偏好失败: ${error}`);
    }
  }

  /**
   * 保存用户区域偏好设置
   */
  static async saveUserRegionPreferences(preferences: RegionPreferences): Promise<number> {
    try {
      return await invoke<number>('save_user_region_preferences', {
        preferences
      });
    } catch (error) {
      throw new Error(`保存用户区域偏好失败: ${error}`);
    }
  }

  /**
   * 删除用户区域偏好设置
   */
  static async deleteUserRegionPreferences(userId?: string): Promise<number> {
    try {
      return await invoke<number>('delete_user_region_preferences', {
        userId
      });
    } catch (error) {
      throw new Error(`删除用户区域偏好失败: ${error}`);
    }
  }

  // ================================
  // 区域配置管理
  // ================================

  /**
   * 获取所有支持的区域配置
   */
  static async getAllRegionConfigs(): Promise<RegionConfig[]> {
    try {
      return await invoke<RegionConfig[]>('get_all_region_configs');
    } catch (error) {
      throw new Error(`获取区域配置失败: ${error}`);
    }
  }

  /**
   * 获取特定区域配置
   */
  static async getRegionConfig(locale: string): Promise<RegionConfig | null> {
    try {
      return await invoke<RegionConfig | null>('get_region_config', {
        locale
      });
    } catch (error) {
      throw new Error(`获取区域配置失败: ${error}`);
    }
  }

  /**
   * 缓存区域配置
   */
  static async cacheRegionConfig(config: RegionConfig): Promise<void> {
    try {
      await invoke('cache_region_config', { config });
    } catch (error) {
      throw new Error(`缓存区域配置失败: ${error}`);
    }
  }

  // ================================
  // 系统初始化
  // ================================

  /**
   * 初始化区域适配系统
   */
  static async initializeRegionSystem(userId?: string): Promise<RegionPreferences> {
    try {
      return await invoke<RegionPreferences>('initialize_region_system', {
        userId
      });
    } catch (error) {
      throw new Error(`初始化区域系统失败: ${error}`);
    }
  }

  // ================================
  // 格式化服务
  // ================================

  /**
   * 格式化日期时间
   */
  static async formatDateTime(timestamp: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_datetime', {
        timestamp
      });
    } catch (error) {
      throw new Error(`格式化日期时间失败: ${error}`);
    }
  }

  /**
   * 格式化日期
   */
  static async formatDate(timestamp: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_date', {
        timestamp
      });
    } catch (error) {
      throw new Error(`格式化日期失败: ${error}`);
    }
  }

  /**
   * 格式化时间
   */
  static async formatTime(timestamp: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_time', {
        timestamp
      });
    } catch (error) {
      throw new Error(`格式化时间失败: ${error}`);
    }
  }

  /**
   * 格式化数字
   */
  static async formatNumber(number: number, decimalPlaces?: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_number', {
        number,
        decimalPlaces
      });
    } catch (error) {
      throw new Error(`格式化数字失败: ${error}`);
    }
  }

  /**
   * 格式化货币
   */
  static async formatCurrency(amount: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_currency', {
        amount
      });
    } catch (error) {
      throw new Error(`格式化货币失败: ${error}`);
    }
  }

  /**
   * 格式化温度
   */
  static async formatTemperature(celsius: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_temperature', {
        celsius
      });
    } catch (error) {
      throw new Error(`格式化温度失败: ${error}`);
    }
  }

  /**
   * 格式化距离
   */
  static async formatDistance(meters: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_distance', {
        meters
      });
    } catch (error) {
      throw new Error(`格式化距离失败: ${error}`);
    }
  }

  /**
   * 格式化重量
   */
  static async formatWeight(grams: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_weight', {
        grams
      });
    } catch (error) {
      throw new Error(`格式化重量失败: ${error}`);
    }
  }

  /**
   * 格式化文件大小
   */
  static async formatFileSize(bytes: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_file_size', {
        bytes
      });
    } catch (error) {
      throw new Error(`格式化文件大小失败: ${error}`);
    }
  }

  /**
   * 格式化百分比
   */
  static async formatPercentage(ratio: number, decimalPlaces?: number): Promise<FormattedValue> {
    try {
      return await invoke<FormattedValue>('format_percentage', {
        ratio,
        decimalPlaces
      });
    } catch (error) {
      throw new Error(`格式化百分比失败: ${error}`);
    }
  }

  // ================================
  // 单位转换服务
  // ================================

  /**
   * 转换温度单位
   */
  static async convertTemperature(
    value: number,
    fromUnit: string,
    toUnit: string
  ): Promise<number> {
    try {
      return await invoke<number>('convert_temperature', {
        value,
        fromUnit,
        toUnit
      });
    } catch (error) {
      throw new Error(`温度单位转换失败: ${error}`);
    }
  }

  /**
   * 转换距离单位
   */
  static async convertDistance(meters: number, toUnit: string): Promise<[number, string]> {
    try {
      return await invoke<[number, string]>('convert_distance', {
        meters,
        toUnit
      });
    } catch (error) {
      throw new Error(`距离单位转换失败: ${error}`);
    }
  }

  /**
   * 转换重量单位
   */
  static async convertWeight(grams: number, toUnit: string): Promise<[number, string]> {
    try {
      return await invoke<[number, string]>('convert_weight', {
        grams,
        toUnit
      });
    } catch (error) {
      throw new Error(`重量单位转换失败: ${error}`);
    }
  }

  // ================================
  // 维护和统计
  // ================================

  /**
   * 清理过期的区域配置缓存
   */
  static async cleanupExpiredRegionCache(days: number): Promise<number> {
    try {
      return await invoke<number>('cleanup_expired_region_cache', {
        days
      });
    } catch (error) {
      throw new Error(`清理过期缓存失败: ${error}`);
    }
  }

  /**
   * 获取区域格式化统计信息
   */
  static async getRegionFormatStats(): Promise<RegionFormatStats> {
    try {
      return await invoke<RegionFormatStats>('get_region_format_stats');
    } catch (error) {
      throw new Error(`获取格式化统计失败: ${error}`);
    }
  }
}

// ================================
// 格式化缓存管理
// ================================

/**
 * 格式化缓存管理器
 */
export class FormatCache {
  private static cache = new Map<string, { value: FormattedValue; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

  /**
   * 生成缓存键
   */
  private static generateKey(operation: string, params: Record<string, unknown>): string {
    const paramStr = JSON.stringify(params);
    return `${operation}_${btoa(paramStr).slice(0, 16)}`;
  }

  /**
   * 获取缓存值
   */
  static get(operation: string, params: Record<string, unknown>): FormattedValue | null {
    const key = this.generateKey(operation, params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * 设置缓存值
   */
  static set(operation: string, params: Record<string, unknown>, value: FormattedValue): void {
    const key = this.generateKey(operation, params);
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // 定期清理过期缓存
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * 清理过期缓存
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清空所有缓存
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  static getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // 简化实现，实际应该统计命中率
    };
  }
}

// ================================
// 带缓存的格式化服务
// ================================

/**
 * 带缓存的格式化服务
 */
export class CachedRegionService extends RegionService {
  /**
   * 带缓存的格式化日期时间
   */
  static async formatDateTime(timestamp: number): Promise<FormattedValue> {
    const cached = FormatCache.get('datetime', { timestamp });
    if (cached) {
      return cached;
    }

    const result = await super.formatDateTime(timestamp);
    FormatCache.set('datetime', { timestamp }, result);
    return result;
  }

  /**
   * 带缓存的格式化日期
   */
  static async formatDate(timestamp: number): Promise<FormattedValue> {
    const cached = FormatCache.get('date', { timestamp });
    if (cached) {
      return cached;
    }

    const result = await super.formatDate(timestamp);
    FormatCache.set('date', { timestamp }, result);
    return result;
  }

  /**
   * 带缓存的格式化时间
   */
  static async formatTime(timestamp: number): Promise<FormattedValue> {
    const cached = FormatCache.get('time', { timestamp });
    if (cached) {
      return cached;
    }

    const result = await super.formatTime(timestamp);
    FormatCache.set('time', { timestamp }, result);
    return result;
  }

  /**
   * 带缓存的格式化数字
   */
  static async formatNumber(number: number, decimalPlaces?: number): Promise<FormattedValue> {
    const cached = FormatCache.get('number', { number, decimalPlaces });
    if (cached) {
      return cached;
    }

    const result = await super.formatNumber(number, decimalPlaces);
    FormatCache.set('number', { number, decimalPlaces }, result);
    return result;
  }

  /**
   * 带缓存的格式化货币
   */
  static async formatCurrency(amount: number): Promise<FormattedValue> {
    const cached = FormatCache.get('currency', { amount });
    if (cached) {
      return cached;
    }

    const result = await super.formatCurrency(amount);
    FormatCache.set('currency', { amount }, result);
    return result;
  }

  /**
   * 带缓存的格式化温度
   */
  static async formatTemperature(celsius: number): Promise<FormattedValue> {
    const cached = FormatCache.get('temperature', { celsius });
    if (cached) {
      return cached;
    }

    const result = await super.formatTemperature(celsius);
    FormatCache.set('temperature', { celsius }, result);
    return result;
  }

  /**
   * 带缓存的格式化距离
   */
  static async formatDistance(meters: number): Promise<FormattedValue> {
    const cached = FormatCache.get('distance', { meters });
    if (cached) {
      return cached;
    }

    const result = await super.formatDistance(meters);
    FormatCache.set('distance', { meters }, result);
    return result;
  }

  /**
   * 带缓存的格式化重量
   */
  static async formatWeight(grams: number): Promise<FormattedValue> {
    const cached = FormatCache.get('weight', { grams });
    if (cached) {
      return cached;
    }

    const result = await super.formatWeight(grams);
    FormatCache.set('weight', { grams }, result);
    return result;
  }

  /**
   * 带缓存的格式化文件大小
   */
  static async formatFileSize(bytes: number): Promise<FormattedValue> {
    const cached = FormatCache.get('fileSize', { bytes });
    if (cached) {
      return cached;
    }

    const result = await super.formatFileSize(bytes);
    FormatCache.set('fileSize', { bytes }, result);
    return result;
  }

  /**
   * 带缓存的格式化百分比
   */
  static async formatPercentage(ratio: number, decimalPlaces?: number): Promise<FormattedValue> {
    const cached = FormatCache.get('percentage', { ratio, decimalPlaces });
    if (cached) {
      return cached;
    }

    const result = await super.formatPercentage(ratio, decimalPlaces);
    FormatCache.set('percentage', { ratio, decimalPlaces }, result);
    return result;
  }
}

// 默认导出缓存版本的服务
export default CachedRegionService;

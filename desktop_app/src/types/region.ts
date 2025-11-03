/**
 * 区域适配系统类型定义
 * 
 * 该模块定义了区域适配系统中使用的所有类型接口和工具函数
 */

// ================================
// 核心类型定义
// ================================

/**
 * 系统区域信息
 */
export interface SystemRegionInfo {
  /** 区域代码 (如 "zh-CN", "en-US") */
  locale: string;
  /** 语言代码 (如 "zh", "en") */
  language: string;
  /** 国家代码 (如 "CN", "US") */
  country: string;
  /** 时区 (如 "Asia/Shanghai", "America/New_York") */
  timezone: string;
  /** 货币代码 (如 "CNY", "USD") */
  currency: string;
  /** 检测置信度 (0.0 - 1.0) */
  confidence: number;
}

/**
 * 用户区域偏好设置
 */
export interface RegionPreferences {
  /** ID */
  id?: number;
  /** 用户ID */
  user_id?: string;
  /** 区域代码 */
  locale: string;
  /** 时区 */
  timezone: string;
  /** 货币 */
  currency: string;
  /** 数字格式 */
  number_format: string;
  /** 日期格式 */
  date_format: string;
  /** 时间格式 */
  time_format: string;
  /** 温度单位 */
  temperature_unit: string;
  /** 距离单位 */
  distance_unit: string;
  /** 重量单位 */
  weight_unit: string;
  /** 每周第一天 (0=Sunday, 1=Monday) */
  first_day_of_week: number;
  /** 是否支持从右到左的文字方向 */
  rtl_support: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 区域配置信息
 */
export interface RegionConfig {
  /** 区域代码 */
  locale: string;
  /** 英文名称 */
  name: string;
  /** 本地化名称 */
  native_name: string;
  /** 语言代码 */
  language_code: string;
  /** 国家代码 */
  country_code: string;
  /** 货币代码 */
  currency: string;
  /** 支持的时区列表 */
  timezone: string[];
  /** 数字格式配置 */
  number_format: NumberFormat;
  /** 支持的日期格式列表 */
  date_formats: string[];
  /** 温度单位 */
  temperature_unit: string;
  /** 距离单位 */
  distance_unit: string;
  /** 重量单位 */
  weight_unit: string;
  /** 每周第一天 */
  first_day_of_week: number;
  /** 是否从右到左 */
  rtl: boolean;
}

/**
 * 数字格式配置
 */
export interface NumberFormat {
  /** 小数点分隔符 */
  decimal_separator: string;
  /** 千位分隔符 */
  thousands_separator: string;
  /** 货币符号 */
  currency_symbol: string;
  /** 货币位置 */
  currency_position: CurrencyPosition;
}

/**
 * 货币位置枚举
 */
export enum CurrencyPosition {
  Before = 'Before',
  After = 'After',
  BeforeWithSpace = 'BeforeWithSpace',
  AfterWithSpace = 'AfterWithSpace',
}

/**
 * 日期格式样式
 */
export enum DateFormatStyle {
  ISO = 'ISO',                    // 2025-10-19
  US = 'US',                      // 10/19/2025
  EU = 'EU',                      // 19/10/2025
  Chinese = 'Chinese',            // 2025年10月19日
  Japanese = 'Japanese',          // 2025年10月19日
  Korean = 'Korean',              // 2025년 10월 19일
  German = 'German',              // 19.10.2025
  French = 'French',              // 19/10/2025
}

/**
 * 时间格式样式
 */
export enum TimeFormatStyle {
  H24 = 'H24',                   // 14:30:00
  H12 = 'H12',                   // 2:30:00 PM
  H24NoSeconds = 'H24NoSeconds', // 14:30
  H12NoSeconds = 'H12NoSeconds', // 2:30 PM
}

/**
 * 温度单位
 */
export enum TemperatureUnit {
  Celsius = 'Celsius',
  Fahrenheit = 'Fahrenheit',
  Kelvin = 'Kelvin',
}

/**
 * 距离单位
 */
export enum DistanceUnit {
  Metric = 'Metric',       // km, m, cm, mm
  Imperial = 'Imperial',   // mile, ft, in
  Mixed = 'Mixed',         // 根据距离选择合适单位
}

/**
 * 重量单位
 */
export enum WeightUnit {
  Metric = 'Metric',       // kg, g, mg
  Imperial = 'Imperial',   // lb, oz
  Mixed = 'Mixed',         // 根据重量选择合适单位
}

/**
 * 格式化选项
 */
export interface FormatOptions {
  /** 区域代码 */
  locale: string;
  /** 时区 */
  timezone: string;
  /** 货币 */
  currency: string;
  /** 数字格式样式 */
  number_format: NumberFormatStyle;
  /** 日期格式样式 */
  date_format: DateFormatStyle;
  /** 时间格式样式 */
  time_format: TimeFormatStyle;
  /** 温度单位 */
  temperature_unit: TemperatureUnit;
  /** 距离单位 */
  distance_unit: DistanceUnit;
  /** 重量单位 */
  weight_unit: WeightUnit;
}

/**
 * 数字格式样式
 */
export interface NumberFormatStyle {
  /** 小数点分隔符 */
  decimal_separator: string;
  /** 千位分隔符 */
  thousands_separator: string;
  /** 货币符号 */
  currency_symbol: string;
  /** 货币位置 */
  currency_position: CurrencyPosition;
  /** 负号 */
  negative_sign: string;
  /** 正号 (可选) */
  positive_sign?: string;
}

/**
 * 格式化结果
 */
export interface FormattedValue {
  /** 格式化后的值 */
  value: string;
  /** 单位 (可选) */
  unit?: string;
  /** 符号 (可选) */
  symbol?: string;
}

// ================================
// API 响应类型
// ================================

/**
 * 区域错误类型
 */
export interface RegionError {
  /** 错误信息 */
  message: string;
  /** 错误代码 */
  code: string;
}

/**
 * 格式化统计信息
 */
export interface RegionFormatStats {
  /** 区域代码 */
  locale: string;
  /** 时区 */
  timezone: string;
  /** 货币 */
  currency: string;
  /** 日期格式 */
  date_format: string;
  /** 时间格式 */
  time_format: string;
  /** 温度单位 */
  temperature_unit: string;
  /** 距离单位 */
  distance_unit: string;
  /** 重量单位 */
  weight_unit: string;
}

// ================================
// 工具类型和常量
// ================================

/**
 * 支持的区域代码列表
 */
export const SUPPORTED_LOCALES = [
  'zh-CN', 'zh-TW', 'zh-HK',
  'en-US', 'en-GB', 'en-AU', 'en-CA',
  'ja-JP', 'ko-KR',
  'de-DE', 'de-AT', 'de-CH',
  'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
  'es-ES', 'es-MX', 'es-AR',
  'it-IT', 'pt-BR', 'pt-PT',
  'ru-RU', 'ar-SA', 'hi-IN',
  'th-TH', 'vi-VN', 'ms-MY', 'id-ID'
] as const;

/**
 * 支持的区域代码类型
 */
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * 支持的货币代码列表
 */
export const SUPPORTED_CURRENCIES = [
  'CNY', 'TWD', 'HKD',
  'USD', 'GBP', 'AUD', 'CAD',
  'JPY', 'KRW',
  'EUR', 'CHF',
  'RUB', 'BRL', 'MXN', 'ARS',
  'INR', 'SGD', 'MYR', 'THB',
  'IDR', 'PHP', 'VND',
  'SAR', 'AED', 'EGP', 'ILS',
  'TRY', 'ZAR'
] as const;

/**
 * 支持的货币代码类型
 */
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * 支持的时区列表 (主要时区)
 */
export const SUPPORTED_TIMEZONES = [
  'Asia/Shanghai', 'Asia/Beijing', 'Asia/Taipei', 'Asia/Hong_Kong',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne',
  'Pacific/Auckland',
  'UTC'
] as const;

/**
 * 支持的时区类型
 */
export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

// ================================
// 工具函数类型定义
// ================================

/**
 * 区域检测结果
 */
export interface RegionDetectionResult {
  /** 检测到的区域信息 */
  detected: SystemRegionInfo;
  /** 推荐的区域列表 */
  recommendations: string[];
  /** 是否需要用户确认 */
  requires_confirmation: boolean;
}

/**
 * 格式化上下文
 */
export interface FormatContext {
  /** 用户区域偏好 */
  preferences: RegionPreferences;
  /** 当前格式化选项 */
  options: FormatOptions;
  /** 是否使用缓存 */
  use_cache: boolean;
}

/**
 * 单位转换选项
 */
export interface ConversionOptions {
  /** 源单位 */
  from: string;
  /** 目标单位 */
  to: string;
  /** 精度 (小数位数) */
  precision?: number;
  /** 是否显示单位符号 */
  show_symbol?: boolean;
}

// ================================
// Hook 相关类型
// ================================

/**
 * 区域适配 Hook 状态
 */
export interface RegionState {
  /** 当前用户区域偏好 */
  preferences: RegionPreferences | null;
  /** 系统检测到的区域信息 */
  systemRegion: SystemRegionInfo | null;
  /** 所有支持的区域配置 */
  availableRegions: RegionConfig[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否已初始化 */
  initialized: boolean;
}

/**
 * 区域适配 Hook 操作
 */
export interface RegionActions {
  /** 检测系统区域 */
  detectSystemRegion: () => Promise<void>;
  /** 获取用户偏好 */
  getUserPreferences: (userId?: string) => Promise<void>;
  /** 保存用户偏好 */
  saveUserPreferences: (preferences: RegionPreferences) => Promise<void>;
  /** 删除用户偏好 */
  deleteUserPreferences: (userId?: string) => Promise<void>;
  /** 初始化区域系统 */
  initializeRegionSystem: (userId?: string) => Promise<void>;
  /** 获取推荐区域 */
  getRecommendedRegions: (currentLocale?: string) => Promise<string[]>;
  /** 清理错误 */
  clearError: () => void;
}

/**
 * 格式化 Hook 状态
 */
export interface FormatState {
  /** 当前格式化上下文 */
  context: FormatContext | null;
  /** 格式化缓存 */
  cache: Map<string, FormattedValue>;
  /** 是否正在格式化 */
  formatting: boolean;
}

/**
 * 格式化 Hook 操作
 */
export interface FormatActions {
  /** 格式化日期时间 */
  formatDateTime: (timestamp: number) => Promise<FormattedValue>;
  /** 格式化日期 */
  formatDate: (timestamp: number) => Promise<FormattedValue>;
  /** 格式化时间 */
  formatTime: (timestamp: number) => Promise<FormattedValue>;
  /** 格式化数字 */
  formatNumber: (number: number, decimalPlaces?: number) => Promise<FormattedValue>;
  /** 格式化货币 */
  formatCurrency: (amount: number) => Promise<FormattedValue>;
  /** 格式化温度 */
  formatTemperature: (celsius: number) => Promise<FormattedValue>;
  /** 格式化距离 */
  formatDistance: (meters: number) => Promise<FormattedValue>;
  /** 格式化重量 */
  formatWeight: (grams: number) => Promise<FormattedValue>;
  /** 格式化文件大小 */
  formatFileSize: (bytes: number) => Promise<FormattedValue>;
  /** 格式化百分比 */
  formatPercentage: (ratio: number, decimalPlaces?: number) => Promise<FormattedValue>;
  /** 清理缓存 */
  clearCache: () => void;
}

// ================================
// 组件 Props 类型
// ================================

/**
 * 区域选择器组件 Props
 */
export interface RegionSelectorProps {
  /** 当前选中的区域 */
  value?: string;
  /** 选择变化回调 */
  onChange?: (locale: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示推荐区域 */
  showRecommended?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 格式化预览组件 Props
 */
export interface FormatPreviewProps {
  /** 区域偏好设置 */
  preferences: RegionPreferences;
  /** 要预览的数据 */
  sampleData?: SampleData;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 示例数据
 */
export interface SampleData {
  /** 日期时间 */
  datetime?: number;
  /** 数字 */
  number?: number;
  /** 货币金额 */
  currency?: number;
  /** 温度 */
  temperature?: number;
  /** 距离 */
  distance?: number;
  /** 重量 */
  weight?: number;
  /** 文件大小 */
  fileSize?: number;
  /** 百分比 */
  percentage?: number;
}

/**
 * 区域设置表单组件 Props
 */
export interface RegionSettingsFormProps {
  /** 初始区域偏好 */
  initialPreferences?: RegionPreferences;
  /** 提交回调 */
  onSubmit?: (preferences: RegionPreferences) => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否正在提交 */
  loading?: boolean;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

// ================================
// 工具函数
// ================================

/**
 * 检查是否为支持的区域代码
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * 检查是否为支持的货币代码
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
}

/**
 * 检查是否为支持的时区
 */
export function isSupportedTimezone(timezone: string): timezone is SupportedTimezone {
  return SUPPORTED_TIMEZONES.includes(timezone as SupportedTimezone);
}

/**
 * 从区域代码提取语言代码
 */
export function extractLanguageFromLocale(locale: string): string {
  return locale.split('-')[0] || locale;
}

/**
 * 从区域代码提取国家代码
 */
export function extractCountryFromLocale(locale: string): string {
  return locale.split('-')[1] || '';
}

/**
 * 构建区域代码
 */
export function buildLocale(language: string, country: string): string {
  return `${language}-${country}`;
}

/**
 * 获取区域的本地化名称
 */
export function getLocalizedRegionName(locale: string, _targetLocale: string): string {
  // 这里可以实现本地化名称映射
  // 简化实现，返回原始代码
  return locale;
}

/**
 * 创建默认区域偏好
 */
export function createDefaultRegionPreferences(): RegionPreferences {
  return {
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    number_format: '1,234.56',
    date_format: 'YYYY年MM月DD日',
    time_format: '24h',
    temperature_unit: 'celsius',
    distance_unit: 'metric',
    weight_unit: 'kg',
    first_day_of_week: 1,
    rtl_support: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * 验证区域偏好设置
 */
export function validateRegionPreferences(preferences: Partial<RegionPreferences>): string[] {
  const errors: string[] = [];

  if (preferences.locale && !isSupportedLocale(preferences.locale)) {
    errors.push(`不支持的区域代码: ${preferences.locale}`);
  }

  if (preferences.currency && !isSupportedCurrency(preferences.currency)) {
    errors.push(`不支持的货币代码: ${preferences.currency}`);
  }

  if (preferences.timezone && !isSupportedTimezone(preferences.timezone)) {
    errors.push(`不支持的时区: ${preferences.timezone}`);
  }

  if (preferences.first_day_of_week !== undefined) {
    if (preferences.first_day_of_week < 0 || preferences.first_day_of_week > 6) {
      errors.push('每周第一天必须在 0-6 之间');
    }
  }

  return errors;
}

/**
 * 生成缓存键
 */
export function generateCacheKey(operation: string, params: Record<string, unknown>): string {
  const paramStr = JSON.stringify(params);
  return `region_${operation}_${btoa(paramStr).slice(0, 16)}`;
}

/**
 * 比较两个区域偏好是否相等
 */
export function areRegionPreferencesEqual(
  a: RegionPreferences,
  b: RegionPreferences
): boolean {
  return (
    a.locale === b.locale &&
    a.timezone === b.timezone &&
    a.currency === b.currency &&
    a.number_format === b.number_format &&
    a.date_format === b.date_format &&
    a.time_format === b.time_format &&
    a.temperature_unit === b.temperature_unit &&
    a.distance_unit === b.distance_unit &&
    a.weight_unit === b.weight_unit &&
    a.first_day_of_week === b.first_day_of_week &&
    a.rtl_support === b.rtl_support
  );
}

/**
 * 合并区域偏好设置
 */
export function mergeRegionPreferences(
  base: RegionPreferences,
  updates: Partial<RegionPreferences>
): RegionPreferences {
  return {
    ...base,
    ...updates,
    updated_at: new Date().toISOString(),
  };
}


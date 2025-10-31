/**
 * 监控系统配置
 */

import type { SentryConfig } from './sentry';
import type { AnalyticsConfig } from './analytics';
import type { WebVitalsConfig } from './webVitals';
import type { LoggerConfig, LogLevel } from './logger';

/**
 * 监控配置接口
 */
export interface MonitoringConfig {
  sentry: SentryConfig;
  analytics: AnalyticsConfig;
  webVitals: WebVitalsConfig;
  logger?: LoggerConfig;
}

/**
 * 从环境变量获取配置
 */
export function getMonitoringConfig(): MonitoringConfig {
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    // Sentry 配置
    sentry: {
      dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'] || '',
      environment: process.env['NEXT_PUBLIC_ENV'] || process.env['NODE_ENV'] || 'development',
      tracesSampleRate: isProduction ? 0.1 : 1.0, // 生产环境 10% 采样
      replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0, // 错误时 100% 录制
      enabled: isProduction && !!process.env['NEXT_PUBLIC_SENTRY_DSN'],
    },

    // Google Analytics 配置
    analytics: {
      measurementId: process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] || '',
      enabled: isProduction && !!process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'],
      debug: isDevelopment,
    },

    // Web Vitals 配置
    webVitals: {
      enabled: true,
      reportToAnalytics: isProduction && !!process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'],
      reportToSentry: isProduction && !!process.env['NEXT_PUBLIC_SENTRY_DSN'],
      reportToConsole: isDevelopment,
    },

    // 日志配置
    logger: {
      level: (isDevelopment ? 0 : 1) as LogLevel, // DEBUG in dev, INFO in prod
      enableConsole: true,
      enablePersistence: true,
      maxLogSize: 1000,
      persistenceKey: 'zishu_logs',
      enableRemote: isProduction,
      remoteEndpoint: process.env['NEXT_PUBLIC_LOG_ENDPOINT'],
      batchSize: 50,
      batchInterval: 30000,
    },
  };
}

/**
 * 创建自定义监控配置
 */
export function createMonitoringConfig(
  overrides?: Partial<MonitoringConfig>
): MonitoringConfig {
  const defaultConfig = getMonitoringConfig();
  
  return {
    ...defaultConfig,
    ...overrides,
    sentry: { ...defaultConfig.sentry, ...overrides?.sentry },
    analytics: { ...defaultConfig.analytics, ...overrides?.analytics },
    webVitals: { ...defaultConfig.webVitals, ...overrides?.webVitals },
    logger: defaultConfig.logger ? { ...defaultConfig.logger, ...overrides?.logger } : overrides?.logger,
  };
}


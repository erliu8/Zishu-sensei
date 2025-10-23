/**
 * 监控系统统一导出
 */

// Sentry
export {
  initSentry,
  setUser as setSentryUser,
  setTag,
  setContext,
  addBreadcrumb,
  captureException,
  captureMessage,
  startTransaction,
  withTransaction,
  showReportDialog,
  SentryErrorBoundary,
  Sentry,
} from './sentry';
export type { SentryConfig } from './sentry';

// Analytics
export {
  initAnalytics,
  trackPageView,
  trackEvent,
  setUserProperties,
  setUserId as setAnalyticsUserId,
  Analytics,
} from './analytics';
export type { AnalyticsConfig, EventParams, PageViewParams, UserProperties } from './analytics';

// Web Vitals
export {
  initWebVitals,
  getWebVitals,
  generatePerformanceReport,
  monitorResourceTiming,
  monitorLongTasks,
  reportWebVitals,
} from './webVitals';
export type {
  WebVitalMetricName,
  WebVitalMetric,
  WebVitalsConfig,
} from './webVitals';

// Logger
export {
  initLogger,
  getLogger,
  logger,
  Logger,
  LogLevel,
  LOG_LEVEL_NAMES,
} from './logger';
export type {
  LogEntry,
  LoggerConfig,
} from './logger';

// Config
export {
  getMonitoringConfig,
  createMonitoringConfig,
} from './config';
export type { MonitoringConfig } from './config';

// Provider
export { MonitoringProvider, useMonitoring } from './MonitoringProvider';
export type { MonitoringProviderProps } from './MonitoringProvider';


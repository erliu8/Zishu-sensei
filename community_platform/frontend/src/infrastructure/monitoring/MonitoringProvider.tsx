/**
 * 监控系统 Provider
 * 统一初始化所有监控服务
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initSentry, setUser as setSentryUser } from './sentry';
import { initAnalytics, trackPageView, setUserId as setAnalyticsUserId } from './analytics';
import { initWebVitals } from './webVitals';
import { initLogger, getLogger } from './logger';
import type { MonitoringConfig } from './config';

export interface MonitoringProviderProps {
  children: ReactNode;
  config: MonitoringConfig;
  user?: {
    id: string;
    email?: string;
    username?: string;
  } | null;
}

/**
 * 监控系统 Provider 组件
 */
export function MonitoringProvider({ children, config, user }: MonitoringProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 初始化监控服务
  useEffect(() => {
    // 初始化 Sentry
    if (config.sentry.enabled) {
      initSentry(config.sentry);
      getLogger().info('Sentry initialized', { environment: config.sentry.environment });
    }

    // 初始化 Google Analytics
    if (config.analytics.enabled) {
      initAnalytics(config.analytics);
      getLogger().info('Google Analytics initialized', { 
        measurementId: config.analytics.measurementId 
      });
    }

    // 初始化 Web Vitals
    if (config.webVitals.enabled) {
      initWebVitals(config.webVitals);
      getLogger().info('Web Vitals monitoring initialized');
    }

    // 初始化日志系统
    if (config.logger) {
      initLogger(config.logger);
      getLogger().info('Logger initialized', { 
        level: config.logger.level,
        enablePersistence: config.logger.enablePersistence 
      });
    }
  }, [config]);

  // 设置用户信息
  useEffect(() => {
    if (user) {
      // 设置 Sentry 用户
      if (config.sentry.enabled) {
        setSentryUser(user);
      }

      // 设置 Analytics 用户
      if (config.analytics.enabled) {
        setAnalyticsUserId(user.id);
      }

      getLogger().info('User context updated', { userId: user.id });
    } else {
      // 清除用户信息
      if (config.sentry.enabled) {
        setSentryUser(null);
      }
      if (config.analytics.enabled) {
        setAnalyticsUserId(null);
      }
    }
  }, [user, config.sentry.enabled, config.analytics.enabled]);

  // 跟踪页面浏览
  useEffect(() => {
    if (config.analytics.enabled) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      
      trackPageView({
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      });

      getLogger().debug('Page view tracked', { path: pathname, url });
    }
  }, [pathname, searchParams, config.analytics.enabled]);

  return <>{children}</>;
}

/**
 * Hook: 使用监控功能
 */
export function useMonitoring() {
  const logger = getLogger();

  return {
    logger,
  };
}


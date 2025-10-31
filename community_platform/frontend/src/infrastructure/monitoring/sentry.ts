/**
 * Sentry 错误监控集成
 * 提供错误捕获、性能监控、用户反馈功能
 */

import * as Sentry from '@sentry/nextjs';
import type { User } from '@sentry/nextjs';

/**
 * Sentry 配置选项
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  enabled: boolean;
}

/**
 * 初始化 Sentry
 */
export function initSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) {
    console.warn('Sentry is disabled or DSN is not provided');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    
    // 性能监控采样率
    tracesSampleRate: config.tracesSampleRate,
    
    // Session Replay 配置
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    
    // 集成配置
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // 隐私保护：遮盖所有文本和输入
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // 错误过滤
    beforeSend(event, hint) {
      // 过滤掉某些不需要上报的错误
      const error = hint.originalException;
      
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        
        // 忽略网络错误
        if (message.includes('Network Error') || message.includes('Failed to fetch')) {
          return null;
        }
        
        // 忽略取消的请求
        if (message.includes('canceled') || message.includes('aborted')) {
          return null;
        }
      }
      
      return event;
    },
    
    // 性能监控过滤
    beforeSendTransaction(event) {
      // 可以在这里过滤某些不需要的性能数据
      return event;
    },
  });
}

/**
 * 设置用户上下文
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    } as User);
  } else {
    Sentry.setUser(null);
  }
}

/**
 * 设置自定义标签
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * 设置自定义上下文
 */
export function setContext(name: string, context: Record<string, any>): void {
  Sentry.setContext(name, context);
}

/**
 * 添加面包屑
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  category?: string;
  data?: Record<string, any>;
}): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * 手动捕获异常
 */
export function captureException(error: Error, context?: Record<string, any>): string {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
    return '';
  }
  
  return Sentry.captureException(error);
}

/**
 * 手动捕获消息
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): string {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureMessage(message, level);
    });
    return '';
  }
  
  return Sentry.captureMessage(message, level);
}

/**
 * 开始性能追踪
 */
export function startTransaction(options: {
  name: string;
  op: string;
  tags?: Record<string, string>;
}): any {
  // 使用现代的 Sentry span API
  return Sentry.startSpan({
    name: options.name,
    op: options.op,
  }, (_span) => {
    // 设置标签
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }
    
    // 返回一个简单的 span 对象
    return {
      setTag: (key: string, value: string) => Sentry.setTag(key, value),
      setData: (key: string, value: any) => Sentry.setContext('custom', { [key]: value }),
      finish: () => {},
    };
  });
}

/**
 * 性能追踪装饰器
 */
export function withTransaction<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction({ name, op });
  
  return fn()
    .then((result) => {
      transaction.finish();
      return result;
    })
    .catch((error) => {
      transaction.setStatus('internal_error');
      transaction.finish();
      throw error;
    });
}

/**
 * 用户反馈对话框
 */
export function showReportDialog(options?: {
  eventId?: string;
  user?: { name?: string; email?: string };
  title?: string;
  subtitle?: string;
  subtitle2?: string;
  labelName?: string;
  labelEmail?: string;
  labelComments?: string;
  labelClose?: string;
  labelSubmit?: string;
  errorGeneric?: string;
  errorFormEntry?: string;
  successMessage?: string;
}): void {
  Sentry.showReportDialog({
    eventId: options?.eventId,
    user: options?.user,
    title: options?.title || '出错了',
    subtitle: options?.subtitle || '我们的团队已经收到通知',
    subtitle2: options?.subtitle2 || '如果您想帮助我们，请告诉我们发生了什么',
    labelName: options?.labelName || '姓名',
    labelEmail: options?.labelEmail || '邮箱',
    labelComments: options?.labelComments || '发生了什么？',
    labelClose: options?.labelClose || '关闭',
    labelSubmit: options?.labelSubmit || '提交',
    errorGeneric: options?.errorGeneric || '提交报告时发生错误，请稍后重试',
    errorFormEntry: options?.errorFormEntry || '某些字段无效，请更正错误并重试',
    successMessage: options?.successMessage || '您的反馈已提交，谢谢！',
  });
}

/**
 * 错误边界使用的 Sentry
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * 导出 Sentry 实例供高级使用
 */
export { Sentry };


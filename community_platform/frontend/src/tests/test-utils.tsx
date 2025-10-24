/**
 * 测试工具函数
 * 提供自定义的 render 函数和常用测试工具
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 创建测试用的 QueryClient
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // 屏蔽错误日志
    },
  });
}

/**
 * 所有 Provider 包装器
 */
interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({ 
  children, 
  queryClient = createTestQueryClient() 
}: AllProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * 自定义 render 选项
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialState?: any;
}

/**
 * 自定义 render 函数，带所有必要的 Provider
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders queryClient={queryClient}>
      {children}
    </AllProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * 等待指定的毫秒数
 */
export const wait = (ms: number) => 
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 等待下一个事件循环
 */
export const waitForNextTick = () => 
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 创建模拟的 Promise
 */
export function createMockPromise<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';


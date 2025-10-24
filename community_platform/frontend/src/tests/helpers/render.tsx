/**
 * 自定义渲染辅助函数
 * 提供带各种 Provider 的渲染函数
 */

import { ReactElement } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 创建测试专用的 QueryClient
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
      error: () => {},
    },
  });
}

/**
 * 渲染选项
 */
export interface RenderWithProvidersOptions {
  queryClient?: QueryClient;
  initialState?: any;
}

/**
 * 带 Provider 的渲染函数
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const queryClient = options.queryClient || createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  };
}

/**
 * 简单渲染（不带 Provider）
 */
export function renderSimple(ui: ReactElement): RenderResult {
  return render(ui);
}

export { render };


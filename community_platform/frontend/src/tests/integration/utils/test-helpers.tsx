/**
 * 集成测试辅助工具
 * @module tests/integration/utils
 */

import { render, RenderOptions } from '@testing-library/react';
import React, { type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

/**
 * 创建测试用的 QueryClient
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * 所有 Providers 的包装器
 */
interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * 自定义 render 函数，自动包装 providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  }
) {
  const { queryClient, ...renderOptions } = options || {};
  
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  );
  
  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });
}

/**
 * 等待异步操作完成的辅助函数
 */
export function waitForLoadingToFinish() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * 模拟延迟
 */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 mock 的认证上下文
 */
export function createMockAuthContext(user: any = null) {
  return {
    user,
    accessToken: user ? 'mock-token' : null,
    refreshToken: user ? 'mock-refresh-token' : null,
    isAuthenticated: !!user,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };
}

/**
 * 清理所有 mock
 */
export function cleanupMocks() {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
}

export * from '@testing-library/react';
export { renderWithProviders as render };

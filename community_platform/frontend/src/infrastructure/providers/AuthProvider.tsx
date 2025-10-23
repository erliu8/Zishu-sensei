/**
 * 认证提供者组件
 * @module infrastructure/providers
 */

'use client';

import React, { useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store';

/**
 * React Query Client 配置
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      gcTime: 10 * 60 * 1000, // 10 分钟
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * 认证初始化组件
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // 初始化认证状态
    initialize().finally(() => {
      setIsInitialized(true);
    });
  }, [initialize]);

  // 可以在这里显示一个加载页面
  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-sm text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * 认证提供者属性
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * 认证提供者组件
 * 
 * 提供以下功能：
 * 1. NextAuth SessionProvider
 * 2. TanStack Query Provider
 * 3. Zustand 认证状态初始化
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // 会话刷新间隔
      refetchInterval={5 * 60} // 5 分钟
      // 窗口焦点时刷新
      refetchOnWindowFocus={true}
    >
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          {children}
        </AuthInitializer>
      </QueryClientProvider>
    </SessionProvider>
  );
}

/**
 * 导出 Query Client 供其他地方使用
 */
export { queryClient };


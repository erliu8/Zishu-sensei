/**
 * Providers - 全局提供者组件
 * 包含React Query、Theme、Animation、Auth等全局提供者
 */

'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import { AnimationProvider } from '@/shared/components/providers/AnimationProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1分钟
            gcTime: 5 * 60 * 1000, // 5分钟
            retry: 1,
            refetchOnWindowFocus: false,
            // 防止错误被抛出导致页面崩溃
            throwOnError: false,
          },
        },
      })
  );

  return (
    <SessionProvider
      refetchInterval={5 * 60} // 5 分钟刷新一次
      refetchOnWindowFocus={true}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AnimationProvider>
            {children}
          </AnimationProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}


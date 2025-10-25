/**
 * 集成测试辅助工具
 * @module tests/integration/utils
 */

import { render, RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
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
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // 静默错误日志
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

export function AllProviders({
  children,
  queryClient,
}: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();
  
  return (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
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
 * 模拟 localStorage
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
}

/**
 * 模拟 sessionStorage
 */
export const mockSessionStorage = mockLocalStorage;

/**
 * 设置认证 token
 */
export function setAuthToken(token: string) {
  localStorage.setItem('auth-storage', JSON.stringify({
    state: {
      accessToken: token,
      refreshToken: `refresh-${token}`,
    },
    version: 0,
  }));
}

/**
 * 清除认证 token
 */
export function clearAuthToken() {
  localStorage.removeItem('auth-storage');
}

/**
 * 创建 mock 的 File 对象
 */
export function createMockFile(
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

/**
 * 创建 mock 的 Blob 对象
 */
export function createMockBlob(
  content: string = 'test content',
  type: string = 'text/plain'
): Blob {
  return new Blob([content], { type });
}

/**
 * 模拟网络请求延迟
 */
export async function simulateNetworkDelay(ms: number = 100) {
  await delay(ms);
}

/**
 * 获取所有 console.error 调用
 */
export function captureConsoleErrors() {
  const errors: any[] = [];
  const originalError = console.error;
  
  console.error = (...args: any[]) => {
    errors.push(args);
  };
  
  return {
    errors,
    restore: () => {
      console.error = originalError;
    },
  };
}

/**
 * 等待特定条件满足
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 3000,
  interval: number = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await delay(interval);
  }
}

/**
 * 创建 mock 的 IntersectionObserver
 */
export function mockIntersectionObserver() {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver as any;
}

/**
 * 创建 mock 的 ResizeObserver
 */
export function mockResizeObserver() {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver as any;
}

/**
 * 模拟滚动到底部
 */
export function mockScrollToBottom() {
  Object.defineProperty(window, 'scrollY', {
    writable: true,
    configurable: true,
    value: document.body.scrollHeight,
  });
  
  window.dispatchEvent(new Event('scroll'));
}

/**
 * 模拟滚动到顶部
 */
export function mockScrollToTop() {
  Object.defineProperty(window, 'scrollY', {
    writable: true,
    configurable: true,
    value: 0,
  });
  
  window.dispatchEvent(new Event('scroll'));
}

/**
 * 设置视口大小
 */
export function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  window.dispatchEvent(new Event('resize'));
}

/**
 * 模拟移动设备
 */
export function mockMobileDevice() {
  setViewportSize(375, 667);
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  });
}

/**
 * 模拟桌面设备
 */
export function mockDesktopDevice() {
  setViewportSize(1920, 1080);
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
}

/**
 * 创建 mock 的剪贴板 API
 */
export function mockClipboard() {
  const clipboardData = { text: '' };
  
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn((text: string) => {
        clipboardData.text = text;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(clipboardData.text)),
    },
  });
  
  return clipboardData;
}

/**
 * 创建 mock 的 Geolocation API
 */
export function mockGeolocation(
  latitude: number = 0,
  longitude: number = 0
) {
  const mockGeolocation = {
    getCurrentPosition: vi.fn((success: GeolocationPositionCallback) =>
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
  
  Object.defineProperty(navigator, 'geolocation', {
    writable: true,
    configurable: true,
    value: mockGeolocation,
  });
  
  return mockGeolocation;
}

/**
 * 创建 mock 的 matchMedia
 */
export function mockMatchMedia(matches: boolean = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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


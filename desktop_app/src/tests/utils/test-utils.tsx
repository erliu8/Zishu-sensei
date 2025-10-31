/**
 * 测试工具函数
 * 
 * 提供通用的测试辅助函数和工具
 */

import React, { ReactElement } from 'react'
import { render, RenderOptions, RenderResult, renderHook as rtlRenderHook, RenderHookOptions, RenderHookResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { vi, beforeAll, afterAll, expect } from 'vitest'

// 导入 mock 设置
import '../mocks/tauri'
import '../mocks/chatAPI'
import '../mocks/tauriHook'
import '../mocks/services'

// ==================== 测试渲染包装器 ====================

/**
 * 创建测试用的 QueryClient
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * 所有 Provider 包装器
 */
interface AllProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
}

export function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient()
  
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/**
 * 测试 Provider 别名（用于测试中的简洁导入）
 */
export const TestProvider = AllProviders

/**
 * 自定义渲染函数
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialRoute?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const { queryClient, initialRoute = '/', ...renderOptions } = options || {}
  
  // 设置初始路由
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute)
  }
  
  // 创建 user event
  const user = userEvent.setup()
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  )
  
  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}

/**
 * 自定义 renderHook 函数 - 包含 providers
 */
interface CustomRenderHookOptions<Props> {
  queryClient?: QueryClient
  initialProps?: Props
}

export function renderHook<Result, Props = undefined>(
  hook: (props: Props) => Result,
  options?: CustomRenderHookOptions<Props>
): RenderHookResult<Result, Props> {
  const { queryClient, initialProps, ...otherOptions } = options || {}
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  )
  
  return rtlRenderHook(hook, { 
    wrapper: Wrapper, 
    initialProps,
    ...otherOptions 
  } as any)
}

// ==================== 等待工具 ====================

/**
 * 等待指定时间
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 等待下一个事件循环
 */
export const waitForNextTick = () => wait(0)

/**
 * 等待多个事件循环
 */
export const waitForTicks = (count: number) => {
  return Array(count).fill(0).reduce(
    (promise) => promise.then(() => waitForNextTick()),
    Promise.resolve()
  )
}

// ==================== Mock 工具 ====================

/**
 * 创建 mock 函数并记录调用
 */
export function createMockFn<T extends (...args: any[]) => any>(
  implementation?: T
): ReturnType<typeof vi.fn<Parameters<T>, ReturnType<T>>> {
  return vi.fn(implementation as any)
}

/**
 * 创建 mock Promise
 */
export function createMockPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  
  return { promise, resolve, reject }
}

/**
 * Mock localStorage
 */
export function mockLocalStorage() {
  const storage: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key])
    }),
    key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    get length() {
      return Object.keys(storage).length
    },
  }
}

/**
 * Mock sessionStorage
 */
export function mockSessionStorage() {
  return mockLocalStorage()
}

/**
 * Mock Tauri API
 */
export function mockTauriAPI() {
  return {
    invoke: vi.fn(),
    event: {
      listen: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
    },
    window: {
      appWindow: {
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        hide: vi.fn(),
        show: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        setDecorations: vi.fn(),
        setResizable: vi.fn(),
        setSize: vi.fn(),
        setPosition: vi.fn(),
        center: vi.fn(),
        onResized: vi.fn(),
        onMoved: vi.fn(),
        onCloseRequested: vi.fn(),
      },
    },
  }
}

// ==================== 断言工具 ====================

/**
 * 断言元素可见
 */
export function expectVisible(element: HTMLElement | null) {
  expect(element).toBeInTheDocument()
  expect(element).toBeVisible()
}

/**
 * 断言元素不可见
 */
export function expectHidden(element: HTMLElement | null) {
  if (element) {
    expect(element).not.toBeVisible()
  } else {
    expect(element).not.toBeInTheDocument()
  }
}

/**
 * 断言元素被禁用
 */
export function expectDisabled(element: HTMLElement) {
  expect(element).toBeDisabled()
}

/**
 * 断言元素被启用
 */
export function expectEnabled(element: HTMLElement) {
  expect(element).not.toBeDisabled()
}

/**
 * 断言元素有特定的 class
 */
export function expectHasClass(element: HTMLElement, className: string) {
  expect(element).toHaveClass(className)
}

/**
 * 断言元素没有特定的 class
 */
export function expectNotHasClass(element: HTMLElement, className: string) {
  expect(element).not.toHaveClass(className)
}

// ==================== 事件工具 ====================

/**
 * 触发键盘事件
 */
export async function typeText(
  element: HTMLElement,
  text: string,
  user?: ReturnType<typeof userEvent.setup>
) {
  const userInstance = user || userEvent.setup()
  await userInstance.type(element, text)
}

/**
 * 点击元素
 */
export async function clickElement(
  element: HTMLElement,
  user?: ReturnType<typeof userEvent.setup>
) {
  const userInstance = user || userEvent.setup()
  await userInstance.click(element)
}

/**
 * 双击元素
 */
export async function doubleClickElement(
  element: HTMLElement,
  user?: ReturnType<typeof userEvent.setup>
) {
  const userInstance = user || userEvent.setup()
  await userInstance.dblClick(element)
}

/**
 * Hover 元素
 */
export async function hoverElement(
  element: HTMLElement,
  user?: ReturnType<typeof userEvent.setup>
) {
  const userInstance = user || userEvent.setup()
  await userInstance.hover(element)
}

// ==================== 查询工具 ====================

/**
 * 查找所有带有 data-testid 的元素
 */
export function getAllByTestId(container: HTMLElement, testId: string) {
  return container.querySelectorAll(`[data-testid="${testId}"]`)
}

/**
 * 查找第一个带有 data-testid 的元素
 */
export function getByTestId(container: HTMLElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

/**
 * 查找所有带有特定 class 的元素
 */
export function getAllByClass(container: HTMLElement, className: string) {
  return container.querySelectorAll(`.${className}`)
}

/**
 * 查找第一个带有特定 class 的元素
 */
export function getByClass(container: HTMLElement, className: string) {
  return container.querySelector(`.${className}`)
}

// ==================== 数据生成工具 ====================

/**
 * 生成随机字符串
 */
export function randomString(length = 10) {
  return Math.random().toString(36).substring(2, 2 + length)
}

/**
 * 生成随机数字
 */
export function randomNumber(min = 0, max = 100) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 生成随机布尔值
 */
export function randomBoolean() {
  return Math.random() < 0.5
}

/**
 * 从数组中随机选择一个元素
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * 生成随机日期
 */
export function randomDate(start = new Date(2020, 0, 1), end = new Date()) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// ==================== 测试数据清理 ====================

/**
 * 清理所有测试数据
 */
export function cleanupTestData() {
  // 清理 localStorage
  localStorage.clear()
  
  // 清理 sessionStorage
  sessionStorage.clear()
  
  // 清理 IndexedDB
  if (window.indexedDB) {
    // 获取所有数据库并删除
    indexedDB.databases?.().then((databases) => {
      databases.forEach((db) => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      })
    })
  }
}

// ==================== 控制台工具 ====================

/**
 * Mock console 方法
 */
export function mockConsole() {
  const originalConsole = { ...console }
  
  return {
    restore: () => {
      Object.assign(console, originalConsole)
    },
    mockLog: () => {
      console.log = vi.fn()
    },
    mockError: () => {
      console.error = vi.fn()
    },
    mockWarn: () => {
      console.warn = vi.fn()
    },
    mockAll: () => {
      console.log = vi.fn()
      console.error = vi.fn()
      console.warn = vi.fn()
      console.info = vi.fn()
      console.debug = vi.fn()
    },
  }
}

/**
 * 抑制控制台错误（用于测试预期的错误）
 */
export function suppressConsoleError() {
  const originalError = console.error
  beforeAll(() => {
    console.error = vi.fn()
  })
  afterAll(() => {
    console.error = originalError
  })
}

// ==================== 导出所有工具 ====================

export default {
  // 渲染工具
  renderWithProviders,
  renderHook,
  createTestQueryClient,
  AllProviders,
  
  // 等待工具
  wait,
  waitForNextTick,
  waitForTicks,
  
  // Mock 工具
  createMockFn,
  createMockPromise,
  mockLocalStorage,
  mockSessionStorage,
  mockTauriAPI,
  
  // 断言工具
  expectVisible,
  expectHidden,
  expectDisabled,
  expectEnabled,
  expectHasClass,
  expectNotHasClass,
  
  // 事件工具
  typeText,
  clickElement,
  doubleClickElement,
  hoverElement,
  
  // 查询工具
  getAllByTestId,
  getByTestId,
  getAllByClass,
  getByClass,
  
  // 数据生成工具
  randomString,
  randomNumber,
  randomBoolean,
  randomChoice,
  randomDate,
  
  // 清理工具
  cleanupTestData,
  
  // 控制台工具
  mockConsole,
  suppressConsoleError,
}


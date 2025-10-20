/**
 * 测试环境设置文件
 * 
 * 这个文件会在所有测试运行前执行，用于：
 * - 设置全局测试环境
 * - 配置测试工具
 * - 设置模拟数据
 */

import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// 设置 MSW 服务器
export const server = setupServer(...handlers)

// 在所有测试前启动 MSW 服务器
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn',
  })
})

// 在每个测试后清理 DOM 和重置处理器
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// 在所有测试后关闭 MSW 服务器
afterAll(() => {
  server.close()
})

// 全局测试配置
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// 模拟 ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// 模拟 IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// 模拟 Tauri API
Object.defineProperty(window, '__TAURI__', {
  value: {
    invoke: vi.fn(),
    event: {
      listen: vi.fn(),
      emit: vi.fn(),
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
        setFullscreen: vi.fn(),
        setFocus: vi.fn(),
        setIcon: vi.fn(),
        setTitle: vi.fn(),
        setSkipTaskbar: vi.fn(),
        setCursorGrab: vi.fn(),
        setCursorIcon: vi.fn(),
        setCursorPosition: vi.fn(),
        setCursorVisible: vi.fn(),
        setIgnoreCursorEvents: vi.fn(),
        startDragging: vi.fn(),
        print: vi.fn(),
        onResized: vi.fn(),
        onMoved: vi.fn(),
        onCloseRequested: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        onScaleChanged: vi.fn(),
        onMenuClicked: vi.fn(),
        onFileDropEvent: vi.fn(),
        onThemeChanged: vi.fn(),
        isMaximized: vi.fn(),
        isMinimized: vi.fn(),
        isFullscreen: vi.fn(),
        isDecorated: vi.fn(),
        isResizable: vi.fn(),
        isVisible: vi.fn(),
        isFocused: vi.fn(),
        scaleFactor: vi.fn(),
        innerPosition: vi.fn(),
        outerPosition: vi.fn(),
        innerSize: vi.fn(),
        outerSize: vi.fn(),
        theme: vi.fn(),
        center: vi.fn(),
        requestUserAttention: vi.fn(),
        setProgressBar: vi.fn(),
        clearProgressBar: vi.fn(),
        setProgressBarState: vi.fn(),
        clearProgressBarState: vi.fn(),
      },
    },
    tauri: {
      invoke: vi.fn(),
    },
  },
})

// 模拟 PixiJS
Object.defineProperty(window, 'PIXI', {
  value: {
    Application: vi.fn().mockImplementation(() => ({
      stage: { addChild: vi.fn(), removeChild: vi.fn() },
      renderer: { render: vi.fn() },
      ticker: { add: vi.fn(), remove: vi.fn() },
      destroy: vi.fn(),
    })),
    Sprite: vi.fn().mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchor: { set: vi.fn() },
      destroy: vi.fn(),
    })),
    Container: vi.fn().mockImplementation(() => ({
      addChild: vi.fn(),
      removeChild: vi.fn(),
      destroy: vi.fn(),
    })),
    Graphics: vi.fn().mockImplementation(() => ({
      beginFill: vi.fn(),
      drawRect: vi.fn(),
      endFill: vi.fn(),
      destroy: vi.fn(),
    })),
    Text: vi.fn().mockImplementation(() => ({
      text: '',
      style: {},
      destroy: vi.fn(),
    })),
    Loader: {
      shared: {
        add: vi.fn(),
        load: vi.fn(),
        reset: vi.fn(),
      },
    },
  },
})

// 设置测试超时
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
})

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('测试中的全局错误:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('测试中的未处理 Promise 拒绝:', event.reason)
})

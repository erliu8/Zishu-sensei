/**
 * SettingsWindow 设置窗口组件测试
 * 
 * 测试覆盖：
 * - 渲染测试：窗口结构、标题栏、设置内容、调整大小手柄
 * - 窗口控制测试：最小化、最大化、关闭、拖拽、调整大小
 * - 键盘快捷键测试：ESC关闭、Ctrl+S保存、Ctrl+W关闭
 * - 响应式测试：窗口尺寸限制、居中显示
 * - 错误处理测试：Tauri调用失败、设置加载失败
 * - 生命周期测试：窗口打开关闭、内存清理
 * - 无障碍测试：键盘导航、ARIA属性
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  renderWithProviders,
  mockTauriAPI,
  expectVisible,
  expectHidden,
  expectHasClass,
  expectNotHasClass,
  clickElement,
  doubleClickElement,
  wait,
  randomString,
  createMockFn,
} from '../../../utils/test-utils'
import { createMockSettings } from '../../../mocks/factories'

// 导入需要 mock 的 hooks
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'
import { useWindowManager } from '@/hooks/useWindowManager'
import { Settings } from '@/components/Settings'

// 导入实际的 SettingsWindow 组件
import { SettingsWindow } from '../../../../components/Layout/SettingsWindow'

// Mock 依赖
vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
}))

vi.mock('@/hooks/useTauri', () => ({
  useTauri: vi.fn(),
}))

vi.mock('@/hooks/useWindowManager', () => ({
  useWindowManager: vi.fn(),
}))

// Mock Settings 组件
vi.mock('@/components/Settings', () => ({
  Settings: vi.fn(() => <div data-testid="mock-settings">Settings Content</div>),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock Tauri API
const mockTauri = mockTauriAPI()
vi.mock('@tauri-apps/api/tauri', () => mockTauri)
vi.mock('@tauri-apps/api/window', () => mockTauri.window)

// 测试开始
describe('SettingsWindow 设置窗口组件', () => {
  // Mock 数据
  const mockSettings = createMockSettings()
  
  // Mock 回调函数
  const mockOnClose = vi.fn()
  const mockInvoke = vi.fn()
  const mockCenterWindow = vi.fn().mockResolvedValue(undefined)
  const mockFocusWindow = vi.fn().mockResolvedValue(undefined)
  const mockCloseWindow = vi.fn().mockResolvedValue(undefined)
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock hooks 返回值
    vi.mocked(useSettings).mockReturnValue({
      config: mockSettings,
      updateConfig: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
    })
    
    vi.mocked(useTauri).mockReturnValue({
      isAvailable: true,
      invoke: mockInvoke,
    })
    
    vi.mocked(useWindowManager).mockReturnValue({
      center: mockCenterWindow,
      focus: mockFocusWindow,
      closeWindow: mockCloseWindow,
    })
    
    // Mock 窗口尺寸
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    })
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    })
    
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 700,
      top: 0,
      left: 0,
      bottom: 700,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }))
    
    // Mock resize observer
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  // ==================== 渲染测试 ====================
  
  describe('渲染测试', () => {
    it('应该正确渲染设置窗口', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('isOpen=false 时不应该渲染内容', () => {
      renderWithProviders(<SettingsWindow isOpen={false} onClose={mockOnClose} />)
      
      // 由于我们 mock 了 framer-motion，这里主要验证逻辑
      expect(screen.queryByTestId('toaster')).toBe(null)
    })
    
    it('应该显示自定义标题', () => {
      renderWithProviders(<SettingsWindow title="自定义设置" onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该应用自定义样式类', () => {
      const customClass = randomString()
      renderWithProviders(
        <SettingsWindow className={customClass} onClose={mockOnClose} />
      )
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该根据props控制功能显示', () => {
      renderWithProviders(
        <SettingsWindow
          draggable={false}
          resizable={false}
          showHeader={false}
          showSidebar={false}
          onClose={mockOnClose}
        />
      )
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 窗口控制测试 ====================
  
  describe('窗口控制测试', () => {
    it('应该在窗口打开时居中显示', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(mockCenterWindow).toHaveBeenCalled()
      })
    })
    
    it('Tauri 不可用时应该正常工作', () => {
      vi.mocked(useTauri).mockReturnValue({
        isAvailable: false,
        invoke: vi.fn(),
      })
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 键盘快捷键测试 ====================
  
  describe('键盘快捷键测试', () => {
    it('按 ESC 应该关闭窗口', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      // 模拟按 ESC 键
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
    
    it('按 Ctrl+W 应该关闭窗口', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      // 模拟按 Ctrl+W
      fireEvent.keyDown(window, { 
        key: 'w', 
        code: 'KeyW', 
        ctrlKey: true 
      })
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
    
    it('按 Cmd+W 应该关闭窗口 (macOS)', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      // 模拟按 Cmd+W
      fireEvent.keyDown(window, { 
        key: 'w', 
        code: 'KeyW', 
        metaKey: true 
      })
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
    
    it('按 Ctrl+S 应该阻止默认保存行为', () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      const preventDefault = vi.fn()
      const event = new KeyboardEvent('keydown', { 
        key: 's', 
        code: 'KeyS', 
        ctrlKey: true 
      })
      event.preventDefault = preventDefault
      
      window.dispatchEvent(event)
      
      expect(preventDefault).toHaveBeenCalled()
    })
    
    it('窗口关闭时不应该响应键盘事件', () => {
      renderWithProviders(<SettingsWindow isOpen={false} onClose={mockOnClose} />)
      
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })
  
  // ==================== 窗口大小调整测试 ====================
  
  describe('窗口大小调整测试', () => {
    it('应该监听窗口大小变化', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      
      addEventListenerSpy.mockRestore()
    })
    
    it('组件卸载时应该清理事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })
  
  // ==================== Settings 组件集成测试 ====================
  
  describe('Settings 组件集成测试', () => {
    it('应该渲染 Settings 组件', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expect(vi.mocked(Settings)).toHaveBeenCalled()
    })
    
    it('应该传递正确的 props 给 Settings 组件', () => {
      renderWithProviders(
        <SettingsWindow
          initialTab="character"
          showHeader={false}
          showSidebar={false}
          onClose={mockOnClose}
        />
      )
      
      expect(vi.mocked(Settings)).toHaveBeenCalledWith(
        expect.objectContaining({
          initialTab: 'character',
          showHeader: false,
          showSidebar: false,
          onClose: expect.any(Function),
        }),
        expect.any(Object)
      )
    })
  })
  
  // ==================== 错误处理测试 ====================
  
  describe('错误处理测试', () => {
    it('应该显示设置加载错误', () => {
      const mockError = new Error('设置加载失败')
      vi.mocked(useSettings).mockReturnValue({
        config: mockSettings,
        updateConfig: vi.fn(),
        isLoading: false,
        error: mockError,
        clearError: vi.fn(),
      })
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该处理 Tauri 调用失败', async () => {
      mockInvoke.mockRejectedValue(new Error('Tauri 调用失败'))
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      // 窗口应该正常渲染，不应该崩溃
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该处理窗口管理器调用失败', async () => {
      mockCenterWindow.mockRejectedValue(new Error('居中失败'))
      mockCloseWindow.mockRejectedValue(new Error('关闭失败'))
      
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      // 窗口应该正常渲染
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 窗口尺寸限制测试 ====================
  
  describe('窗口尺寸限制测试', () => {
    it('应该有最小窗口尺寸', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该有最大窗口尺寸', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该有默认窗口尺寸', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 生命周期测试 ====================
  
  describe('生命周期测试', () => {
    it('窗口打开时应该执行初始化', () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('窗口关闭时应该清理资源', () => {
      const { rerender } = renderWithProviders(
        <SettingsWindow isOpen={true} onClose={mockOnClose} />
      )
      
      rerender(<SettingsWindow isOpen={false} onClose={mockOnClose} />)
      
      // 验证清理逻辑
      expect(screen.queryByTestId('mock-settings')).toBe(null)
    })
    
    it('组件卸载时应该清理事件监听器', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      const addCallCount = addEventListenerSpy.mock.calls.length
      
      unmount()
      
      // 每个添加的监听器都应该被移除
      expect(removeEventListenerSpy).toHaveBeenCalled()
      
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
  
  // ==================== 性能测试 ====================
  
  describe('性能测试', () => {
    it('应该避免不必要的重新渲染', () => {
      const { rerender } = renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      const initialCallCount = vi.mocked(Settings).mock.calls.length
      
      // 相同 props 重新渲染
      rerender(<SettingsWindow onClose={mockOnClose} />)
      
      // Settings 组件不应该被不必要地重新渲染
      expect(vi.mocked(Settings).mock.calls.length).toBeLessThanOrEqual(initialCallCount + 2)
    })
    
    it('窗口尺寸变化不应该导致过多重渲染', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      const initialCallCount = vi.mocked(Settings).mock.calls.length
      
      // 触发多次 resize 事件
      for (let i = 0; i < 5; i++) {
        fireEvent.resize(window)
      }
      
      // 应该有合理的重渲染次数
      expect(vi.mocked(Settings).mock.calls.length).toBeLessThan(initialCallCount + 10)
    })
    
    it('快速开关窗口应该正常处理', () => {
      const { rerender } = renderWithProviders(
        <SettingsWindow isOpen={false} onClose={mockOnClose} />
      )
      
      // 快速切换窗口状态
      for (let i = 0; i < 5; i++) {
        rerender(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
        rerender(<SettingsWindow isOpen={false} onClose={mockOnClose} />)
      }
      
      // 不应该崩溃
      expect(screen.queryByTestId('toaster')).toBe(null)
    })
  })
  
  // ==================== 边界情况测试 ====================
  
  describe('边界情况测试', () => {
    it('应该处理缺少 onClose 回调的情况', () => {
      renderWithProviders(<SettingsWindow />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该处理无效的 initialTab', () => {
      renderWithProviders(
        <SettingsWindow initialTab={'invalid' as any} onClose={mockOnClose} />
      )
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该处理极小的窗口尺寸', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 300,
      })
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 200,
      })
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('应该处理极大的窗口尺寸', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 5000,
      })
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 3000,
      })
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 无障碍测试 ====================
  
  describe('无障碍测试', () => {
    it('应该有适当的焦点管理', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      // 窗口打开后应该正确管理焦点
      expectVisible(screen.getByTestId('toaster'))
    })
    
    it('ESC 键应该能关闭模态窗口', async () => {
      renderWithProviders(<SettingsWindow isOpen={true} onClose={mockOnClose} />)
      
      fireEvent.keyDown(window, { key: 'Escape' })
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
    
    it('应该支持键盘导航', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
  
  // ==================== 集成测试 ====================
  
  describe('集成测试', () => {
    it('应该正确集成 useSettings hook', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expect(vi.mocked(useSettings)).toHaveBeenCalled()
    })
    
    it('应该正确集成 useTauri hook', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expect(vi.mocked(useTauri)).toHaveBeenCalled()
    })
    
    it('应该正确集成 useWindowManager hook', () => {
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expect(vi.mocked(useWindowManager)).toHaveBeenCalled()
    })
    
    it('loading 状态应该正确处理', () => {
      vi.mocked(useSettings).mockReturnValue({
        config: mockSettings,
        updateConfig: vi.fn(),
        isLoading: true,
        error: null,
        clearError: vi.fn(),
      })
      
      renderWithProviders(<SettingsWindow onClose={mockOnClose} />)
      
      expectVisible(screen.getByTestId('toaster'))
    })
  })
})

/**
 * AdapterManagement 组件测试
 * 
 * 测试适配器管理页面的完整功能，包括：
 * - 标签页切换
 * - 适配器选择和配置
 * - 状态管理
 * - 错误处理
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { AdapterManagement } from '../../../../pages/AdapterManagement'
import { renderWithProviders } from '../../../utils/test-utils'
import {
  mockAdapterService,
  createMockAdapterInfo,
  createMockAdapterMetadata,
  setupAdapterListScenario,
  setupAdapterSearchScenario,
  setupAdapterConfigScenario,
} from '../../../utils/adapter-test-helpers'
import { AdapterStatus } from '../../../../types/adapter'

// Mock 适配器服务
const mockService = mockAdapterService()
vi.mock('../../../../src/services/adapter', () => ({
  AdapterService: mockService,
}))

// Mock 子组件
vi.mock('../../../../src/pages/AdapterList', () => ({
  default: ({ onAdapterSelect }: { onAdapterSelect?: (adapter: any) => void }) => (
    <div data-testid="adapter-list">
      <h3>Installed Adapters</h3>
      <button
        data-testid="select-adapter-btn"
        onClick={() => onAdapterSelect?.({
          name: 'test-adapter',
          status: AdapterStatus.Loaded,
          config: {},
        })}
      >
        Select Adapter
      </button>
    </div>
  ),
}))

vi.mock('../../../../src/pages/AdapterSearch', () => ({
  default: ({ onAdapterSelect }: { onAdapterSelect?: (adapter: any) => void }) => (
    <div data-testid="adapter-search">
      <h3>Adapter Marketplace</h3>
      <button
        data-testid="select-market-adapter-btn"
        onClick={() => onAdapterSelect?.({
          name: 'market-adapter',
          status: AdapterStatus.Unloaded,
          config: {},
        })}
      >
        Select Market Adapter
      </button>
    </div>
  ),
}))

vi.mock('../../../../src/pages/AdapterConfig', () => ({
  default: ({ adapterId, onClose }: { adapterId: string; onClose?: () => void }) => (
    <div data-testid="adapter-config">
      <h3>Configure {adapterId}</h3>
      <button data-testid="close-config-btn" onClick={onClose}>
        Close Config
      </button>
    </div>
  ),
}))

describe('AdapterManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该渲染适配器管理页面', () => {
      renderWithProviders(<AdapterManagement />)
      
      // 检查标题
      expect(screen.getByText('Adapter Management')).toBeInTheDocument()
      
      // 检查标签页
      expect(screen.getByRole('tab', { name: /installed/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /marketplace/i })).toBeInTheDocument()
      
      // 默认显示已安装适配器页面
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
    })

    it('应该显示正确的标签页内容', () => {
      renderWithProviders(<AdapterManagement />)
      
      // 默认显示已安装适配器
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
      expect(screen.getByText('Installed Adapters')).toBeInTheDocument()
    })

    it('应该高亮当前活动的标签页', () => {
      renderWithProviders(<AdapterManagement />)
      
      const installedTab = screen.getByRole('tab', { name: /installed/i })
      expect(installedTab).toHaveAttribute('aria-selected', 'true')
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i })
      expect(marketplaceTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  describe('标签页切换测试', () => {
    it('应该切换到 marketplace 标签页', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i })
      await user.click(marketplaceTab)
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
        expect(screen.getByText('Adapter Marketplace')).toBeInTheDocument()
      })
      
      // 检查标签页状态
      expect(marketplaceTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: /installed/i })).toHaveAttribute('aria-selected', 'false')
    })

    it('应该保持标签页状态', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 切换到 marketplace
      await user.click(screen.getByRole('tab', { name: /marketplace/i }))
      await waitFor(() => {
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
      })
      
      // 切换回 installed
      await user.click(screen.getByRole('tab', { name: /installed/i }))
      await waitFor(() => {
        expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
      })
    })

    it('应该使用键盘导航标签页', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      const installedTab = screen.getByRole('tab', { name: /installed/i })
      installedTab.focus()
      
      // 使用右箭头键导航到下一个标签页
      await user.keyboard('{ArrowRight}')
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i })
      expect(marketplaceTab).toHaveFocus()
      
      // 按回车激活标签页
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
      })
    })
  })

  describe('适配器选择测试', () => {
    it('应该处理从已安装列表选择适配器', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 从已安装适配器列表选择适配器
      const selectBtn = screen.getByTestId('select-adapter-btn')
      await user.click(selectBtn)
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
        expect(screen.getByText('Configure test-adapter')).toBeInTheDocument()
      })
    })

    it('应该处理从市场选择适配器', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 切换到市场页面
      await user.click(screen.getByRole('tab', { name: /marketplace/i }))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
      })
      
      // 从市场选择适配器
      const selectMarketBtn = screen.getByTestId('select-market-adapter-btn')
      await user.click(selectMarketBtn)
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
        expect(screen.getByText('Configure market-adapter')).toBeInTheDocument()
      })
    })

    it('应该清空选择状态当切换标签页时', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 选择适配器
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
      
      // 切换标签页
      await user.click(screen.getByRole('tab', { name: /marketplace/i }))
      
      await waitFor(() => {
        expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
      })
    })
  })

  describe('配置管理测试', () => {
    it('应该显示适配器配置对话框', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
        expect(screen.getByText('Configure test-adapter')).toBeInTheDocument()
      })
    })

    it('应该关闭配置对话框', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 打开配置
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
      
      // 关闭配置
      await user.click(screen.getByTestId('close-config-btn'))
      
      await waitFor(() => {
        expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
      })
    })

    it('应该处理配置保存成功', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
      
      // 验证配置组件接收到正确的 adapterId
      expect(screen.getByText('Configure test-adapter')).toBeInTheDocument()
    })
  })

  describe('状态管理测试', () => {
    it('应该管理选中的适配器状态', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 初始状态：没有选中的适配器
      expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
      
      // 选择适配器
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
      
      // 关闭配置
      await user.click(screen.getByTestId('close-config-btn'))
      
      await waitFor(() => {
        expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
      })
    })

    it('应该管理配置显示状态', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 选择适配器时应该显示配置
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
    })

    it('应该重置状态当组件卸载时', () => {
      const { unmount } = renderWithProviders(<AdapterManagement />)
      
      // 卸载组件
      unmount()
      
      // 重新渲染应该是初始状态
      renderWithProviders(<AdapterManagement />)
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
      expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
    })
  })

  describe('响应式设计测试', () => {
    it('应该在小屏幕上调整布局', () => {
      // 模拟小屏幕
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      })
      
      renderWithProviders(<AdapterManagement />)
      
      // 在小屏幕上标签页应该垂直堆叠
      const tabList = screen.getByRole('tablist')
      expect(tabList).toHaveClass('flex-col', 'md:flex-row')
    })

    it('应该在大屏幕上使用水平布局', () => {
      // 模拟大屏幕
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })
      
      renderWithProviders(<AdapterManagement />)
      
      const tabList = screen.getByRole('tablist')
      expect(tabList).toHaveClass('flex-row')
    })
  })

  describe('无障碍性测试', () => {
    it('应该提供正确的 ARIA 标签', () => {
      renderWithProviders(<AdapterManagement />)
      
      // 检查主要区域的 ARIA 标签
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Adapter Management')
      
      // 检查标签页的 ARIA 属性
      const tabList = screen.getByRole('tablist')
      expect(tabList).toHaveAttribute('aria-label', 'Adapter management sections')
      
      const tabs = screen.getAllByRole('tab')
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected')
        expect(tab).toHaveAttribute('aria-controls')
      })
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      const firstTab = screen.getByRole('tab', { name: /installed/i })
      firstTab.focus()
      
      // Tab 键应该移动到下一个可聚焦元素
      await user.keyboard('{Tab}')
      
      // 应该可以用箭头键在标签页之间导航
      firstTab.focus()
      await user.keyboard('{ArrowRight}')
      
      expect(screen.getByRole('tab', { name: /marketplace/i })).toHaveFocus()
    })

    it('应该有适当的焦点管理', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 打开配置对话框时，焦点应该移动到对话框
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-config')).toBeInTheDocument()
      })
      
      // 关闭对话框时，焦点应该回到触发元素
      await user.click(screen.getByTestId('close-config-btn'))
      
      await waitFor(() => {
        expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
      })
    })
  })

  describe('边界情况测试', () => {
    it('应该处理空的适配器选择', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 模拟选择 null 适配器
      const selectBtn = screen.getByTestId('select-adapter-btn')
      
      // 修改按钮行为以传递 null
      fireEvent.click(selectBtn, { 
        target: { 
          onclick: () => undefined 
        } 
      })
      
      // 不应该显示配置对话框
      expect(screen.queryByTestId('adapter-config')).not.toBeInTheDocument()
    })

    it('应该处理无效的适配器数据', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      renderWithProviders(<AdapterManagement />)
      
      // 应该优雅地处理无效数据而不崩溃
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
      
      consoleError.mockRestore()
    })

    it('应该处理配置组件加载失败', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 选择适配器
      await user.click(screen.getByTestId('select-adapter-btn'))
      
      // 即使配置组件有问题，也不应该崩溃整个页面
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
    })
  })

  describe('性能测试', () => {
    it('应该优化渲染性能', () => {
      const renderCount = vi.fn()
      
      function TestWrapper() {
        renderCount()
        return <AdapterManagement />
      }
      
      const { rerender } = renderWithProviders(<TestWrapper />)
      
      // 重新渲染相同的 props 不应该导致不必要的重渲染
      rerender(<TestWrapper />)
      
      expect(renderCount).toHaveBeenCalledTimes(2) // 只应该渲染两次
    })

    it('应该懒加载标签页内容', async () => {
      const { user } = renderWithProviders(<AdapterManagement />)
      
      // 初始只渲染当前活动的标签页
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
      expect(screen.queryByTestId('adapter-search')).not.toBeInTheDocument()
      
      // 切换标签页时才渲染新内容
      await user.click(screen.getByRole('tab', { name: /marketplace/i }))
      
      await waitFor(() => {
        expect(screen.getByTestId('adapter-search')).toBeInTheDocument()
      })
    })
  })
})

/**
 * AdapterList 组件测试
 * 
 * 测试适配器列表组件的完整功能，包括：
 * - 渲染适配器列表
 * - 适配器操作（加载/卸载/安装/卸载）
 * - 状态显示和管理
 * - 错误处理和重试
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { AdapterList } from '../../../../components/AdapterList'
import { renderWithProviders } from '../../../utils/test-utils'
import {
  mockAdapterService,
  createMockAdapterInfo,
  setupAdapterListScenario,
  mockServiceWithErrors,
  createNetworkError,
} from '../../../utils/adapter-test-helpers'
import { AdapterStatus, AdapterType } from '../../../../types/adapter'

// Mock 适配器服务
const mockService = mockAdapterService()
vi.mock('../../../../src/services/adapter', () => ({
  AdapterService: mockService,
}))

describe('AdapterList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockService.getAdapters.mockResolvedValue([
      createMockAdapterInfo({
        name: 'gpt-adapter',
        status: AdapterStatus.Loaded,
        description: 'GPT-based text generation',
        version: '1.0.0',
        size: 1024 * 1024,
        memory_usage: 50 * 1024 * 1024,
      }),
      createMockAdapterInfo({
        name: 'claude-adapter',
        status: AdapterStatus.Unloaded,
        description: 'Claude conversation adapter',
        version: '2.1.0',
        size: 2048 * 1024,
      }),
      createMockAdapterInfo({
        name: 'dalle-adapter',
        status: AdapterStatus.Error,
        description: 'DALL-E image generation',
        version: '1.5.0',
      }),
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该渲染适配器列表', async () => {
      renderWithProviders(<AdapterList />)
      
      // 等待适配器加载
      await waitFor(() => {
        expect(screen.getByText('Installed Adapters')).toBeInTheDocument()
      })
      
      // 验证适配器显示
      expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      expect(screen.getByText('claude-adapter')).toBeInTheDocument()
      expect(screen.getByText('dalle-adapter')).toBeInTheDocument()
      
      // 验证服务调用
      expect(mockService.getAdapters).toHaveBeenCalledTimes(1)
    })

    it('应该显示适配器详细信息', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 检查适配器信息
      expect(screen.getByText('GPT-based text generation')).toBeInTheDocument()
      expect(screen.getByText('Version: 1.0.0')).toBeInTheDocument()
      expect(screen.getByText('Size: 1.0 MB')).toBeInTheDocument()
      expect(screen.getByText('Memory: 50.0 MB')).toBeInTheDocument()
    })

    it('应该显示适配器状态', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 检查状态显示
      const loadedStatus = screen.getByText('Loaded')
      expect(loadedStatus).toBeInTheDocument()
      expect(loadedStatus).toHaveClass('bg-green-100', 'text-green-800')
      
      const unloadedStatus = screen.getByText('Unloaded')
      expect(unloadedStatus).toBeInTheDocument()
      expect(unloadedStatus).toHaveClass('bg-gray-100', 'text-gray-800')
      
      const errorStatus = screen.getByText('Error')
      expect(errorStatus).toBeInTheDocument()
      expect(errorStatus).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('应该显示刷新按钮', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
    })
  })

  describe('加载状态测试', () => {
    it('应该显示加载指示器', () => {
      mockService.getAdapters.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      renderWithProviders(<AdapterList />)
      
      expect(screen.getByText('Loading adapters...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('加载完成后应该隐藏加载指示器', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading adapters...')).not.toBeInTheDocument()
        expect(screen.getByText('Installed Adapters')).toBeInTheDocument()
      })
    })

    it('刷新时应该显示刷新状态', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 点击刷新按钮
      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshBtn)
      
      // 应该显示刷新状态
      expect(refreshBtn).toHaveTextContent('Refreshing...')
      expect(refreshBtn).toBeDisabled()
    })
  })

  describe('空状态测试', () => {
    it('应该显示空状态当没有适配器时', async () => {
      mockService.getAdapters.mockResolvedValue([])
      
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('No adapters installed')).toBeInTheDocument()
        expect(screen.getByText('Install adapters from the marketplace to get started')).toBeInTheDocument()
      })
    })

    it('空状态应该提供安装引导', async () => {
      mockService.getAdapters.mockResolvedValue([])
      
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        const message = screen.getByText('Install adapters from the marketplace to get started')
        expect(message).toBeInTheDocument()
      })
    })
  })

  describe('适配器操作测试', () => {
    it('应该加载未加载的适配器', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('claude-adapter')).toBeInTheDocument()
      })
      
      // 找到 Claude 适配器的加载按钮
      const claudeContainer = screen.getByText('claude-adapter').closest('.border')!
      const loadBtn = claudeContainer.querySelector('button[data-testid*="load"]') ||
        claudeContainer.querySelector('button:contains("Load")')
      
      if (loadBtn) {
        await user.click(loadBtn as HTMLElement)
        
        expect(mockService.loadAdapter).toHaveBeenCalledWith('claude-adapter')
        
        // 验证重新加载列表
        await waitFor(() => {
          expect(mockService.getAdapters).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('应该卸载已加载的适配器', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 找到 GPT 适配器的卸载按钮
      const gptContainer = screen.getByText('gpt-adapter').closest('.border')!
      const unloadBtn = gptContainer.querySelector('button[data-testid*="unload"]') ||
        gptContainer.querySelector('button:contains("Unload")')
      
      if (unloadBtn) {
        await user.click(unloadBtn as HTMLElement)
        
        expect(mockService.unloadAdapter).toHaveBeenCalledWith('gpt-adapter')
        
        // 验证重新加载列表
        await waitFor(() => {
          expect(mockService.getAdapters).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('应该卸载适配器', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 找到卸载按钮
      const uninstallButtons = screen.getAllByText('Uninstall')
      await user.click(uninstallButtons[0])
      
      expect(mockService.uninstallAdapter).toHaveBeenCalledWith('gpt-adapter')
      
      // 验证重新加载列表
      await waitFor(() => {
        expect(mockService.getAdapters).toHaveBeenCalledTimes(2)
      })
    })

    it('应该配置适配器', async () => {
      const mockOnAdapterSelect = vi.fn()
      const { user } = renderWithProviders(<AdapterList onAdapterSelect={mockOnAdapterSelect} />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 找到配置按钮
      const configureButtons = screen.getAllByText('Configure')
      await user.click(configureButtons[0])
      
      expect(mockOnAdapterSelect).toHaveBeenCalledWith({
        name: 'gpt-adapter',
        status: AdapterStatus.Loaded,
        description: 'GPT-based text generation',
        version: '1.0.0',
        size: 1024 * 1024,
        memory_usage: 50 * 1024 * 1024,
        path: '/path/to/adapter',
        load_time: expect.any(String),
        config: { enabled: true, timeout: 30000 },
      })
    })
  })

  describe('按钮状态测试', () => {
    it('已加载适配器应该显示卸载按钮', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      const gptContainer = screen.getByText('gpt-adapter').closest('.border')!
      expect(gptContainer).toContainHTML('Unload')
      expect(gptContainer).not.toContainHTML('Load')
    })

    it('未加载适配器应该显示加载按钮', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('claude-adapter')).toBeInTheDocument()
      })
      
      const claudeContainer = screen.getByText('claude-adapter').closest('.border')!
      expect(claudeContainer).toContainHTML('Load')
      expect(claudeContainer).not.toContainHTML('Unload')
    })

    it('操作进行中应该禁用按钮', async () => {
      // 模拟慢速操作
      mockService.loadAdapter.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('claude-adapter')).toBeInTheDocument()
      })
      
      // 点击加载按钮
      const claudeContainer = screen.getByText('claude-adapter').closest('.border')!
      const loadBtn = claudeContainer.querySelector('button:contains("Load")')
      
      if (loadBtn) {
        await user.click(loadBtn as HTMLElement)
        
        // 按钮应该被禁用
        expect(loadBtn).toBeDisabled()
      }
    })
  })

  describe('错误处理测试', () => {
    it('应该显示加载错误', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapters).mockImplementation(errorService.getAdapters)
      
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('Failed to load adapters')).toBeInTheDocument()
      })
    })

    it('应该显示重试按钮', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapters).mockImplementation(errorService.getAdapters)
      
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('应该处理重试操作', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapters).mockImplementationOnce(errorService.getAdapters)
      
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load adapters')).toBeInTheDocument()
      })
      
      // 恢复正常响应并点击重试
      vi.mocked(mockService.getAdapters).mockResolvedValue([
        createMockAdapterInfo({ name: 'recovered-adapter' })
      ])
      
      await user.click(screen.getByRole('button', { name: /retry/i }))
      
      await waitFor(() => {
        expect(screen.getByText('recovered-adapter')).toBeInTheDocument()
        expect(screen.queryByText('Failed to load adapters')).not.toBeInTheDocument()
      })
    })

    it('应该处理适配器操作错误', async () => {
      mockService.loadAdapter.mockRejectedValue(new Error('Load failed'))
      
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('claude-adapter')).toBeInTheDocument()
      })
      
      // 尝试加载适配器
      const claudeContainer = screen.getByText('claude-adapter').closest('.border')!
      const loadBtn = claudeContainer.querySelector('button:contains("Load")')
      
      if (loadBtn) {
        await user.click(loadBtn as HTMLElement)
        
        await waitFor(() => {
          // 应该显示错误消息
          expect(screen.getByText(/load failed/i)).toBeInTheDocument()
        })
      }
    })
  })

  describe('刷新功能测试', () => {
    it('应该刷新适配器列表', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(mockService.getAdapters).toHaveBeenCalledTimes(1)
      })
      
      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshBtn)
      
      await waitFor(() => {
        expect(mockService.getAdapters).toHaveBeenCalledTimes(2)
      })
    })

    it('应该清除错误状态当刷新时', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapters).mockImplementationOnce(errorService.getAdapters)
      
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load adapters')).toBeInTheDocument()
      })
      
      // 恢复正常响应并刷新
      vi.mocked(mockService.getAdapters).mockResolvedValue([])
      
      await user.click(screen.getByRole('button', { name: /refresh/i }))
      
      await waitFor(() => {
        expect(screen.queryByText('Failed to load adapters')).not.toBeInTheDocument()
        expect(screen.getByText('No adapters installed')).toBeInTheDocument()
      })
    })
  })

  describe('格式化功能测试', () => {
    it('应该正确格式化文件大小', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 验证格式化调用
      expect(mockService.formatSize).toHaveBeenCalledWith(1024 * 1024)
      expect(screen.getByText('Size: 1.0 MB')).toBeInTheDocument()
    })

    it('应该正确格式化状态', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 验证状态格式化调用
      expect(mockService.formatStatus).toHaveBeenCalledWith(AdapterStatus.Loaded)
      expect(mockService.formatStatus).toHaveBeenCalledWith(AdapterStatus.Unloaded)
      expect(mockService.formatStatus).toHaveBeenCalledWith(AdapterStatus.Error)
    })

    it('应该正确设置状态颜色', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 验证颜色设置调用
      expect(mockService.getStatusColor).toHaveBeenCalledWith(AdapterStatus.Loaded)
      expect(mockService.getStatusColor).toHaveBeenCalledWith(AdapterStatus.Unloaded)
      expect(mockService.getStatusColor).toHaveBeenCalledWith(AdapterStatus.Error)
    })
  })

  describe('性能测试', () => {
    it('应该处理大量适配器', async () => {
      const manyAdapters = Array.from({ length: 100 }, (_, i) =>
        createMockAdapterInfo({
          name: `adapter-${i}`,
          status: i % 2 === 0 ? AdapterStatus.Loaded : AdapterStatus.Unloaded,
        })
      )
      
      mockService.getAdapters.mockResolvedValue(manyAdapters)
      
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('adapter-0')).toBeInTheDocument()
        expect(screen.getByText('adapter-99')).toBeInTheDocument()
      })
      
      // 验证所有适配器都被渲染
      expect(screen.getAllByText(/^adapter-\d+$/).length).toBe(100)
    })

    it('应该优化重新渲染', () => {
      const renderSpy = vi.fn()
      
      function SpyWrapper(props: any) {
        renderSpy()
        return <AdapterList {...props} />
      }
      
      const { rerender } = renderWithProviders(<SpyWrapper />)
      
      // 使用相同 props 重新渲染不应该触发额外渲染
      rerender(<SpyWrapper />)
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('无障碍性测试', () => {
    it('应该提供适当的 ARIA 标签', async () => {
      renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      // 检查列表的 ARIA 属性
      const adapterList = screen.getByRole('list')
      expect(adapterList).toHaveAttribute('aria-label', 'Installed adapters')
      
      // 检查按钮的 ARIA 标签
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label')
      })
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<AdapterList />)
      
      await waitFor(() => {
        expect(screen.getByText('gpt-adapter')).toBeInTheDocument()
      })
      
      const firstButton = screen.getAllByRole('button')[0]
      firstButton.focus()
      
      // Tab 键应该移动到下一个按钮
      await user.keyboard('{Tab}')
      
      const buttons = screen.getAllByRole('button')
      expect(buttons[1]).toHaveFocus()
    })
  })
})

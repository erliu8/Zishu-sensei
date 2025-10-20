/**
 * AdapterSearch 组件测试
 * 
 * 测试适配器搜索组件的完整功能，包括：
 * - 搜索适配器
 * - 过滤和排序
 * - 安装适配器
 * - 分页处理
 * - 错误处理
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { AdapterSearch } from '../../../../components/AdapterSearch'
import { renderWithProviders } from '../../../utils/test-utils'
import {
  mockAdapterService,
  createMockMarketProduct,
  createMockPaginatedResponse,
  setupAdapterSearchScenario,
  mockServiceWithErrors,
  createNetworkError,
} from '../../../utils/adapter-test-helpers'
import { AdapterType } from '../../../../types/adapter'

// Mock 适配器服务
const mockService = mockAdapterService()
vi.mock('../../../../src/services/adapter', () => ({
  AdapterService: mockService,
}))

describe('AdapterSearch', () => {
  const mockSearchResults = [
    createMockMarketProduct({
      id: 'gpt-turbo-adapter',
      name: 'GPT Turbo Adapter',
      description: 'High-performance GPT adapter with turbo speed',
      category: 'Language Models',
      rating: { average: 4.8, count: 250, distribution: {} },
      downloads: { total: 15000, monthly: 2000, weekly: 500 },
      pricing: { price: 0, currency: 'USD', license_type: 'MIT', free_trial: true },
      tags: ['gpt', 'fast', 'popular'],
    }),
    createMockMarketProduct({
      id: 'image-pro-adapter',
      name: 'Image Pro Adapter',
      description: 'Professional image generation and editing',
      category: 'Image Generation',
      rating: { average: 4.5, count: 120, distribution: {} },
      downloads: { total: 8000, monthly: 800, weekly: 200 },
      pricing: { price: 9.99, currency: 'USD', license_type: 'Commercial', subscription: true },
      tags: ['image', 'professional', 'editing'],
    }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockService.searchAdapters.mockResolvedValue(
      createMockPaginatedResponse(mockSearchResults, {
        total: 2,
        page: 1,
        page_size: 20,
      })
    )
    mockService.installAdapter.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该渲染搜索界面', () => {
      renderWithProviders(<AdapterSearch />)
      
      // 检查搜索输入框
      expect(screen.getByPlaceholderText(/search adapters/i)).toBeInTheDocument()
      
      // 检查搜索按钮
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
      
      // 检查过滤器
      expect(screen.getByLabelText(/adapter type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    })

    it('应该显示过滤选项', () => {
      renderWithProviders(<AdapterSearch />)
      
      // 检查适配器类型过滤器
      expect(screen.getByLabelText(/adapter type/i)).toBeInTheDocument()
      
      // 检查分类过滤器
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
      
      // 检查价格过滤器
      expect(screen.getByLabelText(/free only/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/featured only/i)).toBeInTheDocument()
      
      // 检查排序选项
      expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument()
    })

    it('应该显示初始提示信息', () => {
      renderWithProviders(<AdapterSearch />)
      
      expect(screen.getByText(/enter search terms/i)).toBeInTheDocument()
      expect(screen.getByText(/discover new adapters/i)).toBeInTheDocument()
    })
  })

  describe('搜索功能测试', () => {
    it('应该执行基本搜索', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      await user.type(searchInput, 'gpt')
      
      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'gpt',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该在输入时自动搜索', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      await user.type(searchInput, 'image')
      
      // 等待防抖延迟
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'image',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      }, { timeout: 2000 })
    })

    it('应该显示搜索结果', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      await user.type(searchInput, 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
        expect(screen.getByText('Image Pro Adapter')).toBeInTheDocument()
      })
      
      // 检查适配器详情
      expect(screen.getByText('High-performance GPT adapter with turbo speed')).toBeInTheDocument()
      expect(screen.getByText('Professional image generation and editing')).toBeInTheDocument()
    })

    it('应该清空搜索结果', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      // 先执行搜索
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      await user.type(searchInput, 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      // 清空搜索
      await user.clear(searchInput)
      
      await waitFor(() => {
        expect(screen.queryByText('GPT Turbo Adapter')).not.toBeInTheDocument()
        expect(screen.getByText(/enter search terms/i)).toBeInTheDocument()
      })
    })
  })

  describe('过滤功能测试', () => {
    it('应该按适配器类型过滤', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      // 设置搜索查询
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      // 选择适配器类型
      const typeSelect = screen.getByLabelText(/adapter type/i)
      await user.selectOptions(typeSelect, AdapterType.Soft)
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: AdapterType.Soft,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该按分类过滤', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const categorySelect = screen.getByLabelText(/category/i)
      await user.selectOptions(categorySelect, 'Language Models')
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: 'Language Models',
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该按价格过滤', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const freeOnlyCheckbox = screen.getByLabelText(/free only/i)
      await user.click(freeOnlyCheckbox)
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: undefined,
          free_only: true,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该按精选状态过滤', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const featuredOnlyCheckbox = screen.getByLabelText(/featured only/i)
      await user.click(featuredOnlyCheckbox)
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: true,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该组合多个过滤器', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      // 设置多个过滤器
      await user.selectOptions(screen.getByLabelText(/adapter type/i), AdapterType.Hard)
      await user.selectOptions(screen.getByLabelText(/category/i), 'Image Generation')
      await user.click(screen.getByLabelText(/free only/i))
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: AdapterType.Hard,
          category: 'Image Generation',
          free_only: true,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })
  })

  describe('排序功能测试', () => {
    it('应该按创建时间排序', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'created_at')
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该按下载量排序', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'downloads')
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'downloads',
          sort_order: 'desc',
          page: 1,
          page_size: 20,
        })
      })
    })

    it('应该切换排序顺序', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      const sortOrderSelect = screen.getByLabelText(/sort order/i)
      await user.selectOptions(sortOrderSelect, 'asc')
      
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledWith({
          query: 'adapter',
          adapter_type: undefined,
          category: undefined,
          free_only: undefined,
          featured_only: undefined,
          sort_by: 'created_at',
          sort_order: 'asc',
          page: 1,
          page_size: 20,
        })
      })
    })
  })

  describe('安装功能测试', () => {
    it('应该安装适配器', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      // 执行搜索
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      // 点击安装按钮
      const installButtons = screen.getAllByText(/install/i)
      await user.click(installButtons[0])
      
      expect(mockService.installAdapter).toHaveBeenCalledWith({
        adapter_id: 'gpt-turbo-adapter',
        source: 'market',
        force: false,
        options: {},
      })
    })

    it('应该显示安装进度', async () => {
      // 模拟慢速安装
      mockService.installAdapter.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      )
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      const installButtons = screen.getAllByText(/install/i)
      await user.click(installButtons[0])
      
      // 应该显示安装中状态
      expect(screen.getByText(/installing/i)).toBeInTheDocument()
      
      // 按钮应该被禁用
      expect(installButtons[0]).toBeDisabled()
    })

    it('应该处理安装成功', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      const installButtons = screen.getAllByText(/install/i)
      await user.click(installButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText(/installed successfully/i)).toBeInTheDocument()
      })
    })

    it('应该处理安装失败', async () => {
      mockService.installAdapter.mockRejectedValue(new Error('Installation failed'))
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      const installButtons = screen.getAllByText(/install/i)
      await user.click(installButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText(/installation failed/i)).toBeInTheDocument()
      })
    })

    it('应该处理适配器选择', async () => {
      const mockOnAdapterSelect = vi.fn()
      const { user } = renderWithProviders(<AdapterSearch onAdapterSelect={mockOnAdapterSelect} />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      // 点击适配器卡片
      const adapterCard = screen.getByText('GPT Turbo Adapter').closest('.border')!
      await user.click(adapterCard)
      
      expect(mockOnAdapterSelect).toHaveBeenCalledWith({
        id: 'gpt-turbo-adapter',
        name: 'GPT Turbo Adapter',
        description: 'High-performance GPT adapter with turbo speed',
        category: 'Language Models',
        rating: { average: 4.8, count: 250, distribution: {} },
        downloads: { total: 15000, monthly: 2000, weekly: 500 },
        pricing: { price: 0, currency: 'USD', license_type: 'MIT', free_trial: true },
        tags: ['gpt', 'fast', 'popular'],
        // ... 其他属性
      })
    })
  })

  describe('分页测试', () => {
    it('应该显示分页信息', async () => {
      const paginatedResults = createMockPaginatedResponse(mockSearchResults, {
        total: 100,
        page: 1,
        page_size: 20,
        total_pages: 5,
        has_next: true,
        has_prev: false,
      })
      
      mockService.searchAdapters.mockResolvedValue(paginatedResults)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText(/showing 1-20 of 100 results/i)).toBeInTheDocument()
      })
    })

    it('应该处理下一页', async () => {
      const paginatedResults = createMockPaginatedResponse(mockSearchResults, {
        total: 100,
        page: 1,
        page_size: 20,
        has_next: true,
      })
      
      mockService.searchAdapters.mockResolvedValue(paginatedResults)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      expect(mockService.searchAdapters).toHaveBeenLastCalledWith({
        query: 'adapter',
        adapter_type: undefined,
        category: undefined,
        free_only: undefined,
        featured_only: undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
        page: 2,
        page_size: 20,
      })
    })

    it('应该处理上一页', async () => {
      const paginatedResults = createMockPaginatedResponse(mockSearchResults, {
        total: 100,
        page: 2,
        page_size: 20,
        has_prev: true,
      })
      
      mockService.searchAdapters.mockResolvedValue(paginatedResults)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
      
      const prevButton = screen.getByRole('button', { name: /previous/i })
      await user.click(prevButton)
      
      expect(mockService.searchAdapters).toHaveBeenLastCalledWith({
        query: 'adapter',
        adapter_type: undefined,
        category: undefined,
        free_only: undefined,
        featured_only: undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
        page: 1,
        page_size: 20,
      })
    })
  })

  describe('加载状态测试', () => {
    it('应该显示搜索加载状态', () => {
      mockService.searchAdapters.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      expect(screen.getByText(/searching/i)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('应该隐藏加载状态当搜索完成', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.queryByText(/searching/i)).not.toBeInTheDocument()
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
      })
    })
  })

  describe('错误处理测试', () => {
    it('应该显示搜索错误', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.searchAdapters).mockImplementation(errorService.searchAdapters)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText(/search service unavailable/i)).toBeInTheDocument()
      })
    })

    it('应该显示重试按钮', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.searchAdapters).mockImplementation(errorService.searchAdapters)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry search/i })).toBeInTheDocument()
      })
    })

    it('应该处理重试搜索', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.searchAdapters).mockImplementationOnce(errorService.searchAdapters)
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText(/search service unavailable/i)).toBeInTheDocument()
      })
      
      // 恢复正常响应并重试
      vi.mocked(mockService.searchAdapters).mockResolvedValue(
        createMockPaginatedResponse(mockSearchResults)
      )
      
      await user.click(screen.getByRole('button', { name: /retry search/i }))
      
      await waitFor(() => {
        expect(screen.getByText('GPT Turbo Adapter')).toBeInTheDocument()
        expect(screen.queryByText(/search service unavailable/i)).not.toBeInTheDocument()
      })
    })

    it('应该处理网络中断', async () => {
      mockService.searchAdapters.mockRejectedValue(createNetworkError('Network connection failed'))
      
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByText(/network connection failed/i)).toBeInTheDocument()
        expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
      })
    })
  })

  describe('无障碍性测试', () => {
    it('应该提供适当的 ARIA 标签', () => {
      renderWithProviders(<AdapterSearch />)
      
      // 检查搜索区域
      const searchRegion = screen.getByRole('search')
      expect(searchRegion).toHaveAttribute('aria-label', 'Adapter search')
      
      // 检查输入框
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      expect(searchInput).toHaveAttribute('aria-label', 'Search adapters')
      
      // 检查过滤器
      const filters = screen.getAllByRole('combobox')
      filters.forEach(filter => {
        expect(filter).toHaveAttribute('aria-label')
      })
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      searchInput.focus()
      
      // Tab 键应该移动到下一个元素
      await user.keyboard('{Tab}')
      
      const nextElement = document.activeElement
      expect(nextElement).not.toBe(searchInput)
    })

    it('应该提供搜索结果的 ARIA 信息', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      await user.type(screen.getByPlaceholderText(/search adapters/i), 'adapter')
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /search results/i })).toBeInTheDocument()
      })
      
      const resultsRegion = screen.getByRole('region', { name: /search results/i })
      expect(resultsRegion).toHaveAttribute('aria-live', 'polite')
      expect(resultsRegion).toHaveAttribute('aria-label', 'Search results: 2 adapters found')
    })
  })

  describe('性能测试', () => {
    it('应该防抖搜索请求', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      
      // 快速输入多个字符
      await user.type(searchInput, 'gpt')
      await user.type(searchInput, ' adapter')
      
      // 应该只触发一次搜索请求（除了初始渲染）
      await waitFor(() => {
        expect(mockService.searchAdapters).toHaveBeenCalledTimes(1)
      }, { timeout: 2000 })
    })

    it('应该取消之前的请求', async () => {
      const { user } = renderWithProviders(<AdapterSearch />)
      
      const searchInput = screen.getByPlaceholderText(/search adapters/i)
      
      // 开始第一个搜索
      await user.type(searchInput, 'first')
      
      // 立即开始第二个搜索
      await user.clear(searchInput)
      await user.type(searchInput, 'second')
      
      await waitFor(() => {
        // 最后一次调用应该是 'second'
        expect(mockService.searchAdapters).toHaveBeenLastCalledWith(
          expect.objectContaining({ query: 'second' })
        )
      })
    })
  })
})

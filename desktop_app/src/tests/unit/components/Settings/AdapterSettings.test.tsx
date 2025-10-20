/**
 * 适配器设置组件测试
 * 
 * 测试主要功能：
 * - 📦 适配器列表展示和管理
 * - ⚡ 适配器启用/禁用控制
 * - 🔧 适配器参数配置
 * - 📥 适配器安装和卸载
 * - 🔄 适配器更新检查
 * - 🛠️ 适配器调试工具
 * - 📊 适配器性能监控
 * - 🔒 适配器权限管理
 * 
 * @module Tests/Components/Settings/AdapterSettings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from '@/tests/utils/test-utils'
import { 
  createMockUseSettings, 
  createMockUseTauri,
  createMockAdapterSettings,
  mockToast 
} from '@/tests/mocks/settings-mocks'
import { createMockAdapter, createMockAdapterList } from '@/tests/mocks/factories'

// 模拟依赖
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('@/hooks/useAdapter')
vi.mock('react-hot-toast', () => ({ default: mockToast }))
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    section: vi.fn(({ children, ...props }) => <section {...props}>{children}</section>)
  }
}))

// Mock useAdapter Hook
const mockUseAdapter = {
  adapters: [
    {
      id: 'openai-adapter',
      name: 'OpenAI Adapter',
      version: '1.2.0',
      enabled: true,
      status: 'running',
      config: {
        apiKey: '***hidden***',
        model: 'gpt-3.5-turbo',
        maxTokens: 2000
      },
      author: 'Zishu Team',
      description: 'OpenAI GPT 模型适配器'
    },
    {
      id: 'claude-adapter',
      name: 'Claude Adapter',
      version: '1.0.5',
      enabled: false,
      status: 'stopped',
      config: {
        apiKey: '',
        model: 'claude-3-sonnet'
      },
      author: 'Community',
      description: 'Anthropic Claude 模型适配器'
    }
  ],
  availableAdapters: [
    {
      id: 'gemini-adapter',
      name: 'Gemini Adapter',
      version: '1.1.0',
      author: 'Google',
      description: 'Google Gemini 模型适配器',
      downloadUrl: 'https://adapters.zishu.com/gemini-adapter.zip'
    }
  ],
  installingAdapters: [],
  isLoading: false,
  error: null,
  
  installAdapter: vi.fn(),
  uninstallAdapter: vi.fn(),
  enableAdapter: vi.fn(),
  disableAdapter: vi.fn(),
  updateAdapter: vi.fn(),
  configureAdapter: vi.fn(),
  restartAdapter: vi.fn(),
  getAdapterLogs: vi.fn(),
  validateAdapterConfig: vi.fn(),
  searchAdapters: vi.fn(),
  checkUpdates: vi.fn()
}

vi.mock('@/hooks/useAdapter', () => ({
  useAdapter: () => mockUseAdapter
}))

// 导入要测试的组件
import { AdapterSettings } from '@/components/Settings/AdapterSettings'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

describe('AdapterSettings - 适配器设置组件', () => {
  let mockUseSettings: ReturnType<typeof createMockUseSettings>
  let mockUseTauri: ReturnType<typeof createMockUseTauri>
  let user: ReturnType<typeof userEvent.setup>
  let mockAdapterSettings: ReturnType<typeof createMockAdapterSettings>
  let mockOnSettingsChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUseSettings = createMockUseSettings()
    mockUseTauri = createMockUseTauri()
    mockAdapterSettings = createMockAdapterSettings()
    mockOnSettingsChange = vi.fn()
    user = userEvent.setup()

    vi.mocked(useSettings).mockReturnValue(mockUseSettings)
    vi.mocked(useTauri).mockReturnValue(mockUseTauri)
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderAdapterSettings = (overrideProps = {}) => {
    const defaultProps = {
      adapterSettings: mockAdapterSettings,
      onSettingsChange: mockOnSettingsChange,
      ...overrideProps
    }
    
    return render(
      <TestProvider>
        <AdapterSettings {...defaultProps} />
      </TestProvider>
    )
  }

  // ==================== 渲染测试 ====================

  describe('渲染测试', () => {
    it('应该正确渲染适配器设置组件', () => {
      renderAdapterSettings()

      expect(screen.getByText('已安装适配器')).toBeInTheDocument()
      expect(screen.getByText('适配器市场')).toBeInTheDocument()
      expect(screen.getByText('全局配置')).toBeInTheDocument()
    })

    it('应该显示适配器统计信息', () => {
      renderAdapterSettings()

      expect(screen.getByText('适配器概览')).toBeInTheDocument()
      expect(screen.getByText(/共 \d+ 个适配器/)).toBeInTheDocument()
      expect(screen.getByText(/\d+ 个运行中/)).toBeInTheDocument()
    })

    it('应该应用自定义样式类名', () => {
      const { container } = renderAdapterSettings({ className: 'custom-adapter-settings' })
      
      expect(container.firstChild).toHaveClass('custom-adapter-settings')
    })
  })

  // ==================== 适配器列表测试 ====================

  describe('适配器列表测试', () => {
    it('应该显示已安装适配器列表', () => {
      renderAdapterSettings()

      expect(screen.getByText('OpenAI Adapter')).toBeInTheDocument()
      expect(screen.getByText('Claude Adapter')).toBeInTheDocument()
    })

    it('应该显示适配器基本信息', () => {
      renderAdapterSettings()

      expect(screen.getByText('1.2.0')).toBeInTheDocument()
      expect(screen.getByText('Zishu Team')).toBeInTheDocument()
      expect(screen.getByText('OpenAI GPT 模型适配器')).toBeInTheDocument()
    })

    it('应该显示适配器状态', () => {
      renderAdapterSettings()

      expect(screen.getByText('运行中')).toBeInTheDocument()
      expect(screen.getByText('已停止')).toBeInTheDocument()
    })

    it('应该显示适配器启用开关', () => {
      renderAdapterSettings()

      const switches = screen.getAllByRole('switch')
      expect(switches).toHaveLength(2)
    })

    it('应该启用/禁用适配器', async () => {
      renderAdapterSettings()

      const enableSwitch = screen.getAllByRole('switch')[1] // Claude适配器
      await user.click(enableSwitch)

      expect(mockUseAdapter.enableAdapter).toHaveBeenCalledWith('claude-adapter')
    })

    it('应该过滤适配器列表', async () => {
      renderAdapterSettings()

      const searchInput = screen.getByPlaceholderText('搜索适配器...')
      await user.type(searchInput, 'OpenAI')

      expect(screen.getByText('OpenAI Adapter')).toBeInTheDocument()
      expect(screen.queryByText('Claude Adapter')).not.toBeInTheDocument()
    })

    it('应该按状态筛选适配器', async () => {
      renderAdapterSettings()

      const statusFilter = screen.getByLabelText('状态筛选')
      await user.selectOptions(statusFilter, 'running')

      expect(screen.getByText('OpenAI Adapter')).toBeInTheDocument()
      expect(screen.queryByText('Claude Adapter')).not.toBeInTheDocument()
    })

    it('应该排序适配器列表', async () => {
      renderAdapterSettings()

      const sortSelect = screen.getByLabelText('排序方式')
      await user.selectOptions(sortSelect, 'name')

      // 验证排序后的顺序
      const adapterItems = screen.getAllByTestId(/adapter-item/)
      expect(adapterItems[0]).toHaveTextContent('Claude Adapter')
      expect(adapterItems[1]).toHaveTextContent('OpenAI Adapter')
    })
  })

  // ==================== 适配器操作测试 ====================

  describe('适配器操作测试', () => {
    it('应该配置适配器', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      expect(screen.getByText('适配器配置')).toBeInTheDocument()
    })

    it('应该重启适配器', async () => {
      renderAdapterSettings()

      const restartButton = screen.getAllByText('重启')[0]
      await user.click(restartButton)

      expect(mockUseAdapter.restartAdapter).toHaveBeenCalledWith('openai-adapter')
    })

    it('应该卸载适配器', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderAdapterSettings()

      const uninstallButton = screen.getAllByText('卸载')[0]
      await user.click(uninstallButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要卸载 OpenAI Adapter 吗？此操作不可恢复。')
      expect(mockUseAdapter.uninstallAdapter).toHaveBeenCalledWith('openai-adapter')

      confirmSpy.mockRestore()
    })

    it('应该更新适配器', async () => {
      renderAdapterSettings()

      const updateButton = screen.getAllByText('更新')[0]
      await user.click(updateButton)

      expect(mockUseAdapter.updateAdapter).toHaveBeenCalledWith('openai-adapter')
    })

    it('应该查看适配器日志', async () => {
      renderAdapterSettings()

      const logsButton = screen.getAllByText('日志')[0]
      await user.click(logsButton)

      expect(mockUseAdapter.getAdapterLogs).toHaveBeenCalledWith('openai-adapter')
    })

    it('应该检查适配器更新', async () => {
      renderAdapterSettings()

      const checkUpdatesButton = screen.getByText('检查更新')
      await user.click(checkUpdatesButton)

      expect(mockUseAdapter.checkUpdates).toHaveBeenCalled()
    })
  })

  // ==================== 适配器配置测试 ====================

  describe('适配器配置测试', () => {
    it('应该显示配置对话框', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('OpenAI Adapter 配置')).toBeInTheDocument()
    })

    it('应该显示配置表单字段', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      expect(screen.getByLabelText('模型')).toBeInTheDocument()
      expect(screen.getByLabelText('最大Token数')).toBeInTheDocument()
    })

    it('应该显示当前配置值', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const modelSelect = screen.getByLabelText('模型') as HTMLSelectElement
      expect(modelSelect.value).toBe('gpt-3.5-turbo')

      const maxTokensInput = screen.getByLabelText('最大Token数') as HTMLInputElement
      expect(maxTokensInput.value).toBe('2000')
    })

    it('应该更新配置值', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const maxTokensInput = screen.getByLabelText('最大Token数')
      await user.clear(maxTokensInput)
      await user.type(maxTokensInput, '4000')

      const saveButton = screen.getByText('保存配置')
      await user.click(saveButton)

      expect(mockUseAdapter.configureAdapter).toHaveBeenCalledWith('openai-adapter', {
        apiKey: '***hidden***',
        model: 'gpt-3.5-turbo',
        maxTokens: 4000
      })
    })

    it('应该验证配置值', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const maxTokensInput = screen.getByLabelText('最大Token数')
      await user.clear(maxTokensInput)
      await user.type(maxTokensInput, 'invalid')

      expect(screen.getByText('请输入有效的数字')).toBeInTheDocument()
    })

    it('应该测试配置连接', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const testButton = screen.getByText('测试连接')
      await user.click(testButton)

      expect(mockUseTauri.commands.test_adapter_connection).toHaveBeenCalledWith('openai-adapter')
    })

    it('应该重置配置到默认值', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const resetButton = screen.getByText('重置默认')
      await user.click(resetButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要重置配置到默认值吗？')

      confirmSpy.mockRestore()
    })

    it('应该取消配置更改', async () => {
      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const cancelButton = screen.getByText('取消')
      await user.click(cancelButton)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  // ==================== 适配器市场测试 ====================

  describe('适配器市场测试', () => {
    it('应该显示可用适配器', () => {
      renderAdapterSettings()

      expect(screen.getByText('Gemini Adapter')).toBeInTheDocument()
    })

    it('应该搜索市场适配器', async () => {
      renderAdapterSettings()

      const marketSearchInput = screen.getByPlaceholderText('搜索市场适配器...')
      await user.type(marketSearchInput, 'Gemini')

      expect(mockUseAdapter.searchAdapters).toHaveBeenCalledWith('Gemini')
    })

    it('应该安装市场适配器', async () => {
      renderAdapterSettings()

      const installButton = screen.getByText('安装')
      await user.click(installButton)

      expect(mockUseAdapter.installAdapter).toHaveBeenCalledWith('gemini-adapter')
    })

    it('应该显示安装进度', () => {
      mockUseAdapter.installingAdapters = ['gemini-adapter']

      renderAdapterSettings()

      expect(screen.getByText(/安装中/i)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('应该取消安装', async () => {
      mockUseAdapter.installingAdapters = ['gemini-adapter']

      renderAdapterSettings()

      const cancelButton = screen.getByText('取消安装')
      await user.click(cancelButton)

      expect(mockUseTauri.commands.cancel_adapter_installation).toHaveBeenCalledWith('gemini-adapter')
    })

    it('应该显示适配器详情', async () => {
      renderAdapterSettings()

      const detailsButton = screen.getByText('详情')
      await user.click(detailsButton)

      expect(screen.getByText('适配器详情')).toBeInTheDocument()
      expect(screen.getByText('Google Gemini 模型适配器')).toBeInTheDocument()
    })

    it('应该按类别筛选市场适配器', async () => {
      renderAdapterSettings()

      const categoryFilter = screen.getByLabelText('适配器类别')
      await user.selectOptions(categoryFilter, 'ai-model')

      expect(mockUseAdapter.searchAdapters).toHaveBeenCalledWith('', { category: 'ai-model' })
    })

    it('应该刷新市场适配器', async () => {
      renderAdapterSettings()

      const refreshButton = screen.getByText('刷新市场')
      await user.click(refreshButton)

      expect(mockUseAdapter.searchAdapters).toHaveBeenCalledWith('')
    })
  })

  // ==================== 全局配置测试 ====================

  describe('全局配置测试', () => {
    it('应该显示全局适配器设置', () => {
      renderAdapterSettings()

      expect(screen.getByText('全局配置')).toBeInTheDocument()
      expect(screen.getByLabelText('自动更新')).toBeInTheDocument()
      expect(screen.getByLabelText('错误重试')).toBeInTheDocument()
    })

    it('应该切换自动更新', async () => {
      renderAdapterSettings()

      const autoUpdateSwitch = screen.getByLabelText('自动更新')
      await user.click(autoUpdateSwitch)

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        global: {
          ...mockAdapterSettings.global,
          autoUpdate: true
        }
      })
    })

    it('应该设置更新检查间隔', async () => {
      renderAdapterSettings()

      const intervalSelect = screen.getByLabelText('检查间隔')
      await user.selectOptions(intervalSelect, '24')

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        global: {
          ...mockAdapterSettings.global,
          updateCheckInterval: 24
        }
      })
    })

    it('应该设置最大并发适配器数', async () => {
      renderAdapterSettings()

      const concurrentSlider = screen.getByLabelText('最大并发数')
      fireEvent.change(concurrentSlider, { target: { value: '5' } })

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        global: {
          ...mockAdapterSettings.global,
          maxConcurrent: 5
        }
      })
    })

    it('应该设置超时时间', async () => {
      renderAdapterSettings()

      const timeoutInput = screen.getByLabelText('请求超时（秒）')
      await user.clear(timeoutInput)
      await user.type(timeoutInput, '60')

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        global: {
          ...mockAdapterSettings.global,
          requestTimeout: 60
        }
      })
    })

    it('应该设置日志级别', async () => {
      renderAdapterSettings()

      const logLevelSelect = screen.getByLabelText('日志级别')
      await user.selectOptions(logLevelSelect, 'debug')

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        global: {
          ...mockAdapterSettings.global,
          logLevel: 'debug'
        }
      })
    })
  })

  // ==================== 性能监控测试 ====================

  describe('性能监控测试', () => {
    it('应该显示适配器性能统计', () => {
      renderAdapterSettings()

      expect(screen.getByText('性能监控')).toBeInTheDocument()
      expect(screen.getByText('CPU使用率')).toBeInTheDocument()
      expect(screen.getByText('内存使用')).toBeInTheDocument()
    })

    it('应该显示请求统计', () => {
      renderAdapterSettings()

      expect(screen.getByText('请求统计')).toBeInTheDocument()
      expect(screen.getByText('今日请求')).toBeInTheDocument()
      expect(screen.getByText('成功率')).toBeInTheDocument()
    })

    it('应该显示实时性能图表', () => {
      renderAdapterSettings()

      expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
    })

    it('应该切换性能监控开关', async () => {
      renderAdapterSettings()

      const monitoringSwitch = screen.getByLabelText('启用性能监控')
      await user.click(monitoringSwitch)

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockAdapterSettings,
        monitoring: {
          ...mockAdapterSettings.monitoring,
          enabled: true
        }
      })
    })

    it('应该清理性能数据', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderAdapterSettings()

      const clearButton = screen.getByText('清理数据')
      await user.click(clearButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要清理所有性能数据吗？')

      confirmSpy.mockRestore()
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理测试', () => {
    it('应该显示适配器错误状态', () => {
      mockUseAdapter.adapters[0].status = 'error'

      renderAdapterSettings()

      expect(screen.getByText('错误')).toBeInTheDocument()
    })

    it('应该显示安装错误', () => {
      mockUseAdapter.error = new Error('适配器安装失败')

      renderAdapterSettings()

      expect(screen.getByText('适配器安装失败')).toBeInTheDocument()
    })

    it('应该处理配置验证错误', async () => {
      mockUseAdapter.validateAdapterConfig.mockResolvedValue({
        valid: false,
        errors: ['API Key 不能为空']
      })

      renderAdapterSettings()

      const configButton = screen.getAllByText('配置')[0]
      await user.click(configButton)

      const saveButton = screen.getByText('保存配置')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('API Key 不能为空')).toBeInTheDocument()
      })
    })

    it('应该处理网络错误', () => {
      mockUseAdapter.error = new Error('网络连接失败')

      renderAdapterSettings()

      expect(screen.getByText('网络连接失败')).toBeInTheDocument()
      expect(screen.getByText('重试')).toBeInTheDocument()
    })

    it('应该重试失败的操作', async () => {
      mockUseAdapter.error = new Error('网络连接失败')

      renderAdapterSettings()

      const retryButton = screen.getByText('重试')
      await user.click(retryButton)

      expect(mockUseAdapter.searchAdapters).toHaveBeenCalled()
    })

    it('应该显示适配器兼容性警告', () => {
      mockUseAdapter.adapters[0].compatibility = 'warning'

      renderAdapterSettings()

      expect(screen.getByText(/兼容性警告/i)).toBeInTheDocument()
    })
  })

  // ==================== 导入导出测试 ====================

  describe('导入导出测试', () => {
    it('应该导出适配器配置', async () => {
      renderAdapterSettings()

      const exportButton = screen.getByText('导出配置')
      await user.click(exportButton)

      expect(mockUseTauri.commands.export_adapter_settings).toHaveBeenCalled()
    })

    it('应该导入适配器配置', async () => {
      renderAdapterSettings()

      const importButton = screen.getByText('导入配置')
      await user.click(importButton)

      expect(mockUseTauri.commands.import_adapter_settings).toHaveBeenCalled()
    })

    it('应该备份当前配置', async () => {
      renderAdapterSettings()

      const backupButton = screen.getByText('备份配置')
      await user.click(backupButton)

      expect(mockUseTauri.commands.backup_adapter_settings).toHaveBeenCalled()
    })

    it('应该恢复配置备份', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderAdapterSettings()

      const restoreButton = screen.getByText('恢复备份')
      await user.click(restoreButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要恢复配置备份吗？当前配置将被覆盖。')

      confirmSpy.mockRestore()
    })

    it('应该处理导入验证错误', async () => {
      mockUseTauri.commands.import_adapter_settings.mockRejectedValue(new Error('配置格式无效'))

      renderAdapterSettings()

      const importButton = screen.getByText('导入配置')
      await user.click(importButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('配置导入失败: 配置格式无效')
      })
    })
  })

  // ==================== 批量操作测试 ====================

  describe('批量操作测试', () => {
    it('应该选择多个适配器', async () => {
      renderAdapterSettings()

      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      expect(screen.getByText('已选择 2 个适配器')).toBeInTheDocument()
    })

    it('应该全选适配器', async () => {
      renderAdapterSettings()

      const selectAllButton = screen.getByText('全选')
      await user.click(selectAllButton)

      expect(screen.getByText('已选择 2 个适配器')).toBeInTheDocument()
    })

    it('应该批量启用适配器', async () => {
      renderAdapterSettings()

      // 选择适配器
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      const batchEnableButton = screen.getByText('批量启用')
      await user.click(batchEnableButton)

      expect(mockUseAdapter.enableAdapter).toHaveBeenCalledTimes(2)
    })

    it('应该批量禁用适配器', async () => {
      renderAdapterSettings()

      // 选择适配器
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      const batchDisableButton = screen.getByText('批量禁用')
      await user.click(batchDisableButton)

      expect(mockUseAdapter.disableAdapter).toHaveBeenCalledWith('openai-adapter')
    })

    it('应该批量卸载适配器', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderAdapterSettings()

      // 选择适配器
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      const batchUninstallButton = screen.getByText('批量卸载')
      await user.click(batchUninstallButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要卸载选中的 1 个适配器吗？此操作不可恢复。')

      confirmSpy.mockRestore()
    })
  })
})

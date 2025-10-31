/**
 * 通用设置组件测试
 * 
 * 测试主要功能：
 * - 🪟 窗口配置（大小、位置、显示选项）
 * - 🎨 主题配置（主题选择、自定义CSS）
 * - 💻 系统配置（自动启动、托盘、通知）
 * - 🎭 角色配置（当前角色、缩放、交互）
 * - ✅ 实时验证和错误提示
 * - 🔄 自动保存和手动保存
 * - 📊 设置预览
 * 
 * @module Tests/Components/Settings/GeneralSettings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from '@/tests/utils/test-utils'
import { 
  createMockUseSettings, 
  createMockUseTauri,
  createMockAppConfig,
  createMockAppSettings,
  createMockWindowConfig,
  createMockSystemConfig,
  mockToast,
  SETTINGS_TEST_PRESETS 
} from '@/tests/mocks/settings-mocks'

// 模拟依赖
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('react-hot-toast', () => ({ default: mockToast }))
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    section: vi.fn(({ children, ...props }) => <section {...props}>{children}</section>)
  }
}))

// Mock clsx
vi.mock('clsx', () => ({
  default: vi.fn((...classes) => classes.filter(Boolean).join(' '))
}))

// Mock ConfigValidator
vi.mock('@/utils/configValidator', () => ({
  ConfigValidator: {
    getInstance: vi.fn(() => ({
      validateWindowConfig: vi.fn(() => ({ valid: true, errors: [] })),
      validateCharacterConfig: vi.fn(() => ({ valid: true, errors: [] })),
      validateThemeConfig: vi.fn(() => ({ valid: true, errors: [] })),
      validateSystemConfig: vi.fn(() => ({ valid: true, errors: [] })),
      validateAppConfig: vi.fn(() => ({ valid: true, errors: [] }))
    }))
  }
}))

// Mock types/settings
vi.mock('@/types/settings', () => ({
  CONFIG_VALIDATION_RULES: {
    window: {
      width: { min: 200, max: 4000 },
      height: { min: 200, max: 4000 }
    },
    character: {
      scale: { min: 0.1, max: 5.0 }
    }
  },
  DEFAULT_CONFIG: {
    window: {
      width: 800,
      height: 600,
      always_on_top: false,
      transparent: false,
      decorations: true,
      resizable: true,
      position: null
    },
    character: {
      current_id: 'default',
      scale: 1.0,
      auto_idle: true,
      interaction_enabled: true
    },
    theme: {
      current_theme: 'anime',
      custom_css: null
    },
    system: {
      auto_start: false,
      minimize_to_tray: true,
      close_to_tray: true,
      show_notifications: true
    }
  }
}))

// 导入要测试的组件
import { GeneralSettings } from '@/components/Settings/GeneralSettings'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

describe('GeneralSettings - 通用设置组件', () => {
  let mockUseSettings: ReturnType<typeof createMockUseSettings>
  let mockUseTauri: ReturnType<typeof createMockUseTauri>
  let user: ReturnType<typeof userEvent.setup>
  let mockConfig: ReturnType<typeof createMockAppConfig>
  let mockOnConfigChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUseSettings = createMockUseSettings()
    mockUseTauri = createMockUseTauri()
    mockConfig = createMockAppConfig()
    mockOnConfigChange = vi.fn()
    user = userEvent.setup()

    vi.mocked(useSettings).mockReturnValue(mockUseSettings)
    vi.mocked(useTauri).mockReturnValue(mockUseTauri)
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderGeneralSettings = (overrideProps = {}) => {
    const defaultProps = {
      config: mockConfig,
      onConfigChange: mockOnConfigChange,
      ...overrideProps
    }
    
    return render(
      <div data-testid="general-settings-container">
        <GeneralSettings {...defaultProps} />
      </div>
    )
  }

  // ==================== 渲染测试 ====================

  describe('渲染测试', () => {
    it('应该正确渲染通用设置组件', () => {
      renderGeneralSettings()

      expect(screen.getByText('窗口设置')).toBeInTheDocument()
      expect(screen.getByText('主题设置')).toBeInTheDocument()
      expect(screen.getByText('系统设置')).toBeInTheDocument()
      expect(screen.getByText('语言设置')).toBeInTheDocument()
    })

    it('应该显示所有设置分组', () => {
      renderGeneralSettings()

      const sections = [
        '窗口设置',
        '角色设置',
        '主题设置',
        '系统设置',
        '语言设置',
        '自动保存'
      ]

      sections.forEach(section => {
        // 使用 getAllByText 来处理重复的文本
        const elements = screen.getAllByText(section)
        expect(elements.length).toBeGreaterThan(0)
        // 确保至少有一个是 h3 元素（分组标题）
        const headings = elements.filter(el => el.tagName === 'H3')
        expect(headings.length).toBeGreaterThan(0)
      })
    })

    it('应该应用自定义样式类名', () => {
      const { container } = renderGeneralSettings({ className: 'custom-general-settings' })
      
      expect(container.firstChild).toHaveClass('custom-general-settings')
    })
  })

  // ==================== 窗口设置测试 ====================

  describe('窗口设置测试', () => {
    it('应该显示窗口尺寸配置', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('窗口宽度')).toBeInTheDocument()
      expect(screen.getByLabelText('窗口高度')).toBeInTheDocument()
    })

    it('应该显示当前窗口尺寸值', () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度') as HTMLInputElement
      const heightInput = screen.getByLabelText('窗口高度') as HTMLInputElement

      expect(widthInput.value).toBe(mockConfig.window.width.toString())
      expect(heightInput.value).toBe(mockConfig.window.height.toString())
    })

    it('应该更新窗口宽度', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '800')

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        window: {
          ...mockConfig.window,
          width: 800
        }
      })
    })

    it('应该更新窗口高度', async () => {
      renderGeneralSettings()

      const heightInput = screen.getByLabelText('窗口高度')
      await user.clear(heightInput)
      await user.type(heightInput, '600')

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        window: {
          ...mockConfig.window,
          height: 600
        }
      })
    })

    it('应该验证窗口尺寸范围', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '100') // 小于最小值 200

      expect(screen.getByText('窗口宽度必须在 200-4000 之间')).toBeInTheDocument()
    })

    it('应该显示窗口选项开关', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('总是置顶')).toBeInTheDocument()
      expect(screen.getByLabelText('窗口透明')).toBeInTheDocument()
      expect(screen.getByLabelText('显示边框')).toBeInTheDocument()
      expect(screen.getByLabelText('可调整大小')).toBeInTheDocument()
    })

    it('应该切换窗口选项', async () => {
      renderGeneralSettings()

      const alwaysOnTopSwitch = screen.getByLabelText('总是置顶')
      await user.click(alwaysOnTopSwitch)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        window: {
          ...mockConfig.window,
          always_on_top: !mockConfig.window.always_on_top
        }
      })
    })

    it('应该重置窗口位置', async () => {
      renderGeneralSettings()

      const resetButton = screen.getByText('重置位置')
      await user.click(resetButton)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        window: {
          ...mockConfig.window,
          position: null
        }
      })
    })
  })

  // ==================== 主题设置测试 ====================

  describe('主题设置测试', () => {
    it('应该显示主题选择器', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('界面主题')).toBeInTheDocument()
    })

    it('应该显示所有可用主题', () => {
      renderGeneralSettings()

      const themeSelect = screen.getByLabelText('界面主题')
      fireEvent.click(themeSelect)

      const themes = ['动漫风格', '现代简约', '经典样式', '深色主题', '浅色主题', '自定义']
      themes.forEach(theme => {
        expect(screen.getByText(theme)).toBeInTheDocument()
      })
    })

    it('应该显示当前选中主题', () => {
      renderGeneralSettings()

      const themeSelect = screen.getByLabelText('界面主题') as HTMLSelectElement
      expect(themeSelect.value).toBe(mockConfig.theme.current_theme)
    })

    it('应该切换主题', async () => {
      renderGeneralSettings()

      const themeSelect = screen.getByLabelText('界面主题')
      await user.selectOptions(themeSelect, 'dark')

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        theme: {
          ...mockConfig.theme,
          current_theme: 'dark'
        }
      })
    })

    it('应该显示自定义CSS编辑器当选择自定义主题', async () => {
      const customThemeConfig = createMockAppConfig({
        theme: { current_theme: 'custom', custom_css: null }
      })
      renderGeneralSettings({ config: customThemeConfig })

      expect(screen.getByLabelText('自定义CSS')).toBeInTheDocument()
    })

    it('应该更新自定义CSS', async () => {
      const customThemeConfig = createMockAppConfig({
        theme: { current_theme: 'custom', custom_css: '' }
      })
      renderGeneralSettings({ config: customThemeConfig })

      const cssEditor = screen.getByLabelText('自定义CSS')
      await user.type(cssEditor, '.app { color: red; }')

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...customThemeConfig,
        theme: {
          ...customThemeConfig.theme,
          custom_css: '.app { color: red; }'
        }
      })
    })

    it('应该验证自定义CSS语法', async () => {
      const customThemeConfig = createMockAppConfig({
        theme: { current_theme: 'custom', custom_css: '' }
      })
      renderGeneralSettings({ config: customThemeConfig })

      const cssEditor = screen.getByLabelText('自定义CSS')
      await user.type(cssEditor, '.invalid css {')

      await waitFor(() => {
        expect(screen.getByText(/CSS语法错误/i)).toBeInTheDocument()
      })
    })

    it('应该预览主题效果', async () => {
      renderGeneralSettings()

      const themeSelect = screen.getByLabelText('界面主题')
      await user.selectOptions(themeSelect, 'dark')

      expect(screen.getByTestId('theme-preview')).toHaveClass('theme-dark')
    })
  })

  // ==================== 系统设置测试 ====================

  describe('系统设置测试', () => {
    it('应该显示系统设置选项', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('开机自启动')).toBeInTheDocument()
      expect(screen.getByLabelText('最小化到托盘')).toBeInTheDocument()
      expect(screen.getByLabelText('关闭到托盘')).toBeInTheDocument()
      expect(screen.getByLabelText('显示通知')).toBeInTheDocument()
    })

    it('应该显示当前系统设置状态', () => {
      renderGeneralSettings()

      const autoStartSwitch = screen.getByLabelText('开机自启动') as HTMLInputElement
      expect(autoStartSwitch.checked).toBe(mockConfig.system.auto_start)
    })

    it('应该切换自启动设置', async () => {
      renderGeneralSettings()

      const autoStartSwitch = screen.getByLabelText('开机自启动')
      await user.click(autoStartSwitch)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        system: {
          ...mockConfig.system,
          auto_start: !mockConfig.system.auto_start
        }
      })
    })

    it('应该调用系统API设置自启动', async () => {
      renderGeneralSettings()

      const autoStartSwitch = screen.getByLabelText('开机自启动')
      await user.click(autoStartSwitch)

      expect(mockUseTauri.commands.update_system_config).toHaveBeenCalledWith({
        auto_start: !mockConfig.system.auto_start
      })
    })

    it('应该显示权限要求提示', () => {
      renderGeneralSettings()

      const autoStartLabel = screen.getByText('开机自启动')
      expect(autoStartLabel.parentElement).toHaveTextContent('需要管理员权限')
    })
  })

  // ==================== 语言设置测试 ====================

  describe('语言设置测试', () => {
    it('应该显示语言选择器', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('界面语言')).toBeInTheDocument()
    })

    it('应该显示支持的语言', () => {
      renderGeneralSettings()

      const languageSelect = screen.getByLabelText('界面语言')
      fireEvent.click(languageSelect)

      const languages = ['简体中文', 'English', '日本語', '한국어']
      languages.forEach(lang => {
        expect(screen.getByText(lang)).toBeInTheDocument()
      })
    })

    it('应该切换语言', async () => {
      renderGeneralSettings()

      const languageSelect = screen.getByLabelText('界面语言')
      await user.selectOptions(languageSelect, 'en-US')

      expect(mockUseSettings.updateLanguage).toHaveBeenCalledWith('en-US')
    })

    it('应该显示语言包下载状态', () => {
      renderGeneralSettings()

      expect(screen.getByText('语言包状态')).toBeInTheDocument()
      expect(screen.getByText('已下载')).toBeInTheDocument()
    })
  })

  // ==================== 通知设置测试 ====================

  describe('通知设置测试', () => {
    it('应该显示通知设置选项', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('启用通知')).toBeInTheDocument()
      expect(screen.getByLabelText('通知声音')).toBeInTheDocument()
      expect(screen.getByLabelText('桌面通知')).toBeInTheDocument()
    })

    it('应该切换通知设置', async () => {
      renderGeneralSettings()

      const notificationSwitch = screen.getByLabelText('启用通知')
      await user.click(notificationSwitch)

      expect(mockUseSettings.updateNotifications).toHaveBeenCalledWith({
        enabled: !mockUseSettings.settings.notifications.enabled
      })
    })

    it('应该测试通知功能', async () => {
      renderGeneralSettings()

      const testButton = screen.getByText('测试通知')
      await user.click(testButton)

      expect(mockUseTauri.commands.test_notification).toHaveBeenCalled()
    })

    it('应该请求通知权限', async () => {
      // 模拟浏览器通知API
      const requestPermissionSpy = vi.spyOn(Notification, 'requestPermission')
        .mockResolvedValue('granted')

      renderGeneralSettings()

      const requestButton = screen.getByText('请求权限')
      await user.click(requestButton)

      expect(requestPermissionSpy).toHaveBeenCalled()

      requestPermissionSpy.mockRestore()
    })
  })

  // ==================== 验证和错误处理测试 ====================

  describe('验证和错误处理测试', () => {
    it('应该实时验证设置值', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '5000') // 超过最大值

      expect(screen.getByText('窗口宽度必须在 200-4000 之间')).toBeInTheDocument()
    })

    it('应该显示字段级错误提示', async () => {
      renderGeneralSettings()

      const heightInput = screen.getByLabelText('窗口高度')
      await user.clear(heightInput)
      await user.type(heightInput, 'invalid')

      expect(screen.getByText('请输入有效的数字')).toBeInTheDocument()
    })

    it('应该禁用保存按钮当有验证错误时', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '100')

      const saveButton = screen.getByText('保存')
      expect(saveButton).toBeDisabled()
    })

    it('应该处理保存错误', async () => {
      mockOnConfigChange.mockRejectedValue(new Error('保存失败'))
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '800')

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('保存失败')
      })
    })

    it('应该恢复到上次有效值当输入无效时', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度') as HTMLInputElement
      const originalValue = widthInput.value

      await user.clear(widthInput)
      await user.type(widthInput, 'invalid')
      fireEvent.blur(widthInput)

      expect(widthInput.value).toBe(originalValue)
    })
  })

  // ==================== 预览功能测试 ====================

  describe('预览功能测试', () => {
    it('应该显示设置预览', () => {
      renderGeneralSettings()

      expect(screen.getByTestId('settings-preview')).toBeInTheDocument()
    })

    it('应该实时更新预览', async () => {
      renderGeneralSettings()

      const themeSelect = screen.getByLabelText('界面主题')
      await user.selectOptions(themeSelect, 'dark')

      const preview = screen.getByTestId('settings-preview')
      expect(preview).toHaveClass('theme-dark')
    })

    it('应该预览窗口尺寸变化', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '800')

      const preview = screen.getByTestId('settings-preview')
      expect(preview).toHaveStyle({ width: '80px' }) // 缩放预览
    })

    it('应该显示预览开关', () => {
      renderGeneralSettings()

      expect(screen.getByLabelText('启用预览')).toBeInTheDocument()
    })

    it('应该切换预览显示', async () => {
      renderGeneralSettings()

      const previewToggle = screen.getByLabelText('启用预览')
      await user.click(previewToggle)

      expect(screen.queryByTestId('settings-preview')).not.toBeInTheDocument()
    })
  })

  // ==================== 自动保存测试 ====================

  describe('自动保存测试', () => {
    it('应该显示自动保存状态', () => {
      renderGeneralSettings()

      expect(screen.getByText(/自动保存/i)).toBeInTheDocument()
    })

    it('应该在设置变更后自动保存', async () => {
      vi.useFakeTimers()
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '800')

      // 等待防抖延迟
      vi.advanceTimersByTime(1000)

      expect(mockOnConfigChange).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('应该显示最后保存时间', () => {
      renderGeneralSettings()

      expect(screen.getByText(/最后保存/i)).toBeInTheDocument()
    })

    it('应该切换自动保存模式', async () => {
      renderGeneralSettings()

      const autoSaveToggle = screen.getByLabelText('自动保存')
      await user.click(autoSaveToggle)

      expect(screen.getByText('手动保存模式')).toBeInTheDocument()
    })
  })

  // ==================== 键盘快捷键测试 ====================

  describe('键盘快捷键测试', () => {
    it('应该支持 Ctrl+S 保存设置', async () => {
      renderGeneralSettings()

      await user.keyboard('{Control>}s{/Control}')

      expect(mockOnConfigChange).toHaveBeenCalled()
    })

    it('应该支持 Escape 取消更改', async () => {
      renderGeneralSettings()

      const widthInput = screen.getByLabelText('窗口宽度')
      await user.clear(widthInput)
      await user.type(widthInput, '800')

      await user.keyboard('{Escape}')

      const inputAfterEscape = screen.getByLabelText('窗口宽度') as HTMLInputElement
      expect(inputAfterEscape.value).toBe(mockConfig.window.width.toString())
    })
  })
})

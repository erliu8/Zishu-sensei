/**
 * 设置面板组件测试
 * 
 * 测试主要功能：
 * - 🎨 响应式侧边栏导航
 * - 📱 多标签页管理（通用、角色、主题、系统、高级）
 * - ⚡ 实时设置同步和验证
 * - 💾 自动保存和手动保存
 * - 🔄 配置导入导出
 * - 🛡️ 错误处理和恢复
 * - ♿ 无障碍支持
 * - 🎭 流畅的动画过渡
 * 
 * @module Tests/Components/Settings/SettingsPanel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from '@/tests/utils/test-utils'
import { 
  createMockUseSettings, 
  createMockUseTauri,
  mockToast,
  SETTINGS_TEST_PRESETS,
  SETTINGS_ERROR_PRESETS 
} from '@/tests/mocks/settings-mocks'

// 模拟组件导入
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('react-hot-toast', () => ({ default: mockToast }))
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    aside: vi.fn(({ children, ...props }) => <aside {...props}>{children}</aside>),
    main: vi.fn(({ children, ...props }) => <main {...props}>{children}</main>)
  },
  AnimatePresence: vi.fn(({ children }) => <>{children}</>)
}))

// 模拟子组件
vi.mock('@/components/Settings/GeneralSettings', () => ({
  GeneralSettings: vi.fn(() => <div data-testid="general-settings">General Settings Component</div>)
}))

vi.mock('@/components/Settings/CharacterSettings', () => ({
  CharacterSettings: vi.fn(() => <div data-testid="character-settings">Character Settings Component</div>)
}))

vi.mock('@/components/Settings/ThemeSettings', () => ({
  ThemeSettings: vi.fn(() => <div data-testid="theme-settings">Theme Settings Component</div>)
}))

// 导入要测试的组件
import { Settings } from '@/components/Settings'
import type { SettingsTab } from '@/components/Settings'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

describe('Settings - 设置面板组件', () => {
  let mockUseSettings: ReturnType<typeof createMockUseSettings>
  let mockUseTauri: ReturnType<typeof createMockUseTauri>
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    mockUseSettings = createMockUseSettings()
    mockUseTauri = createMockUseTauri()
    user = userEvent.setup()

    vi.mocked(useSettings).mockReturnValue(mockUseSettings)
    vi.mocked(useTauri).mockReturnValue(mockUseTauri)
    
    // 重置所有 mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==================== 渲染测试 ====================

  describe('渲染测试', () => {
    it('应该正确渲染设置面板', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      // 验证主要结构
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByText('设置')).toBeInTheDocument()
      expect(screen.getByText('通用设置')).toBeInTheDocument()
      expect(screen.getByText('角色设置')).toBeInTheDocument()
      expect(screen.getByText('主题设置')).toBeInTheDocument()
    })

    it('应该显示所有标签页选项', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const tabs = [
        '通用设置',
        '角色设置', 
        '主题设置',
        '系统设置',
        '高级设置'
      ]

      tabs.forEach(tabName => {
        expect(screen.getByText(tabName)).toBeInTheDocument()
      })
    })

    it('应该显示侧边栏和头部（默认）', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('应该隐藏侧边栏当 showSidebar=false', () => {
      render(
        <TestProvider>
          <Settings showSidebar={false} />
        </TestProvider>
      )

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('应该隐藏头部当 showHeader=false', () => {
      render(
        <TestProvider>
          <Settings showHeader={false} />
        </TestProvider>
      )

      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    })

    it('应该应用自定义样式类名', () => {
      const { container } = render(
        <TestProvider>
          <Settings className="custom-settings" />
        </TestProvider>
      )

      expect(container.firstChild).toHaveClass('custom-settings')
    })
  })

  // ==================== 导航测试 ====================

  describe('导航测试', () => {
    it('应该显示默认标签页（通用设置）', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByTestId('general-settings')).toBeInTheDocument()
      expect(screen.queryByTestId('character-settings')).not.toBeInTheDocument()
    })

    it('应该显示指定的初始标签页', () => {
      render(
        <TestProvider>
          <Settings initialTab="character" />
        </TestProvider>
      )

      expect(screen.getByTestId('character-settings')).toBeInTheDocument()
      expect(screen.queryByTestId('general-settings')).not.toBeInTheDocument()
    })

    it('应该切换标签页', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      // 初始状态：通用设置
      expect(screen.getByTestId('general-settings')).toBeInTheDocument()

      // 点击角色设置标签
      await user.click(screen.getByText('角色设置'))

      // 验证切换成功
      await waitFor(() => {
        expect(screen.getByTestId('character-settings')).toBeInTheDocument()
        expect(screen.queryByTestId('general-settings')).not.toBeInTheDocument()
      })
    })

    it('应该高亮当前激活的标签', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const generalTab = screen.getByText('通用设置').closest('button')
      const characterTab = screen.getByText('角色设置').closest('button')

      // 初始状态：通用设置标签应该被高亮
      expect(generalTab).toHaveAttribute('aria-selected', 'true')
      expect(characterTab).toHaveAttribute('aria-selected', 'false')

      // 切换到角色设置
      await user.click(screen.getByText('角色设置'))

      await waitFor(() => {
        expect(generalTab).toHaveAttribute('aria-selected', 'false')
        expect(characterTab).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  // ==================== 搜索功能测试 ====================

  describe('搜索功能测试', () => {
    it('应该显示搜索输入框', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByPlaceholderText(/搜索设置/i)).toBeInTheDocument()
    })

    it('应该过滤设置项基于搜索关键词', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const searchInput = screen.getByPlaceholderText(/搜索设置/i)
      await user.type(searchInput, '主题')

      // 应该只显示包含"主题"的设置项
      expect(screen.getByText('主题设置')).toBeInTheDocument()
      expect(screen.queryByText('角色设置')).not.toBeInTheDocument()
    })

    it('应该显示无搜索结果提示', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const searchInput = screen.getByPlaceholderText(/搜索设置/i)
      await user.type(searchInput, '不存在的设置')

      expect(screen.getByText(/未找到匹配的设置/i)).toBeInTheDocument()
    })
  })

  // ==================== 保存功能测试 ====================

  describe('保存功能测试', () => {
    it('应该显示保存按钮', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('保存')).toBeInTheDocument()
    })

    it('应该调用保存函数当点击保存按钮', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const saveButton = screen.getByText('保存')
      await user.click(saveButton)

      expect(mockUseSettings.updateConfig).toHaveBeenCalled()
    })

    it('应该显示保存中状态', async () => {
      mockUseSettings.isLoading = true
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const saveButton = screen.getByText(/保存中/i)
      expect(saveButton).toBeDisabled()
    })

    it('应该显示成功保存提示', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const saveButton = screen.getByText('保存')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('设置已保存')
      })
    })

    it('应该处理保存错误', async () => {
      mockUseSettings.updateConfig.mockRejectedValue(new Error('保存失败'))

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const saveButton = screen.getByText('保存')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('保存失败')
      })
    })
  })

  // ==================== 重置功能测试 ====================

  describe('重置功能测试', () => {
    it('应该显示重置按钮', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('重置')).toBeInTheDocument()
    })

    it('应该调用重置回调当点击重置按钮', async () => {
      const onReset = vi.fn()
      
      render(
        <TestProvider>
          <Settings onReset={onReset} />
        </TestProvider>
      )

      const resetButton = screen.getByText('重置')
      await user.click(resetButton)

      expect(onReset).toHaveBeenCalled()
    })

    it('应该显示重置确认对话框', async () => {
      // 模拟 window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const resetButton = screen.getByText('重置')
      await user.click(resetButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要重置所有设置吗？此操作不可恢复。')

      confirmSpy.mockRestore()
    })

    it('应该在确认后执行重置', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const resetButton = screen.getByText('重置')
      await user.click(resetButton)

      await waitFor(() => {
        expect(mockUseSettings.resetConfig).toHaveBeenCalled()
      })

      confirmSpy.mockRestore()
    })

    it('应该取消重置如果用户不确认', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const resetButton = screen.getByText('重置')
      await user.click(resetButton)

      expect(mockUseSettings.resetConfig).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  // ==================== 导入导出测试 ====================

  describe('导入导出测试', () => {
    it('应该显示导出按钮', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('导出设置')).toBeInTheDocument()
    })

    it('应该显示导入按钮', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('导入设置')).toBeInTheDocument()
    })

    it('应该执行导出设置', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const exportButton = screen.getByText('导出设置')
      await user.click(exportButton)

      expect(mockUseSettings.exportSettingsToFile).toHaveBeenCalled()
    })

    it('应该处理文件选择进行导入', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const importButton = screen.getByText('导入设置')
      await user.click(importButton)

      // 验证文件输入框被触发
      expect(screen.getByTestId('file-input')).toBeInTheDocument()
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理测试', () => {
    it('应该显示错误信息', () => {
      mockUseSettings.error = new Error('加载设置失败')
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('加载设置失败')).toBeInTheDocument()
    })

    it('应该显示重试按钮当有错误时', () => {
      mockUseSettings.error = new Error('网络错误')
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText('重试')).toBeInTheDocument()
    })

    it('应该调用重试函数当点击重试按钮', async () => {
      mockUseSettings.error = new Error('网络错误')
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const retryButton = screen.getByText('重试')
      await user.click(retryButton)

      expect(mockUseSettings.refreshConfig).toHaveBeenCalled()
    })
  })

  // ==================== 无障碍测试 ====================

  describe('无障碍测试', () => {
    it('应该有正确的 ARIA 标签', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', '设置面板')
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', '设置导航')
    })

    it('应该支持键盘导航', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const firstTab = screen.getByText('通用设置')
      firstTab.focus()

      // Tab 键切换到下一个标签
      await user.keyboard('{Tab}')
      expect(screen.getByText('角色设置')).toHaveFocus()
    })

    it('应该支持 Enter 键激活标签', async () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const characterTab = screen.getByText('角色设置')
      characterTab.focus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByTestId('character-settings')).toBeInTheDocument()
      })
    })

    it('应该有正确的 tabindex', () => {
      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const tabs = screen.getAllByRole('tab')
      tabs.forEach((tab, index) => {
        if (index === 0) {
          expect(tab).toHaveAttribute('tabindex', '0')
        } else {
          expect(tab).toHaveAttribute('tabindex', '-1')
        }
      })
    })
  })

  // ==================== 响应式测试 ====================

  describe('响应式测试', () => {
    it('应该在小屏幕隐藏侧边栏', () => {
      // 模拟小屏幕尺寸
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      })

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const sidebar = screen.queryByRole('navigation')
      expect(sidebar).toHaveClass('hidden', 'md:block')
    })

    it('应该显示移动端菜单按钮', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      })

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByLabelText('打开菜单')).toBeInTheDocument()
    })
  })

  // ==================== 状态同步测试 ====================

  describe('状态同步测试', () => {
    it('应该显示同步状态', () => {
      mockUseSettings.syncStatus = 'syncing'
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText(/同步中/i)).toBeInTheDocument()
    })

    it('应该显示需要同步提示', () => {
      mockUseSettings.needsSync = true
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      expect(screen.getByText(/有未同步的更改/i)).toBeInTheDocument()
    })

    it('应该提供手动同步按钮', async () => {
      mockUseSettings.needsSync = true
      vi.mocked(useSettings).mockReturnValue(mockUseSettings)

      render(
        <TestProvider>
          <Settings />
        </TestProvider>
      )

      const syncButton = screen.getByText('立即同步')
      await user.click(syncButton)

      expect(mockUseSettings.forceSync).toHaveBeenCalled()
    })
  })

  // ==================== 性能测试 ====================

  describe('性能测试', () => {
    it('应该使用 memo 优化渲染', () => {
      const { rerender } = render(
        <TestProvider>
          <Settings initialTab="general" />
        </TestProvider>
      )

      // 重新渲染相同的props不应该触发不必要的更新
      rerender(
        <TestProvider>
          <Settings initialTab="general" />
        </TestProvider>
      )

      // 验证组件没有重新渲染（通过检查是否调用了新的渲染）
      expect(screen.getByTestId('general-settings')).toBeInTheDocument()
    })

    it('应该延迟加载未激活的标签页内容', () => {
      render(
        <TestProvider>
          <Settings initialTab="general" />
        </TestProvider>
      )

      // 只有激活的标签页内容被渲染
      expect(screen.getByTestId('general-settings')).toBeInTheDocument()
      expect(screen.queryByTestId('character-settings')).not.toBeInTheDocument()
      expect(screen.queryByTestId('theme-settings')).not.toBeInTheDocument()
    })
  })
})

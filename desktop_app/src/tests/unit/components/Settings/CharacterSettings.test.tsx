/**
 * 角色设置组件测试
 * 
 * 测试主要功能：
 * - 🎭 角色选择和切换
 * - 📏 角色缩放配置
 * - 🎪 交互设置和行为配置
 * - 🎨 角色外观自定义
 * - 📁 模型文件管理
 * - 🎮 动画和表情配置
 * - 🔧 高级角色参数
 * - 🎯 角色预览和实时调试
 * 
 * @module Tests/Components/Settings/CharacterSettings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from '@/tests/utils/test-utils'
import { 
  createMockUseSettings, 
  createMockUseTauri,
  createMockAppConfig,
  createMockCharacterConfig,
  mockToast,
  SETTINGS_TEST_PRESETS 
} from '@/tests/mocks/settings-mocks'

// 模拟依赖
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('@/hooks/useCharacter')
vi.mock('react-hot-toast', () => ({ default: mockToast }))
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    section: vi.fn(({ children, ...props }) => <section {...props}>{children}</section>)
  }
}))

// 模拟 Live2D 组件
vi.mock('@/components/Character/Live2D/Live2DViewer', () => ({
  Live2DViewer: vi.fn(() => <div data-testid="live2d-preview">Live2D Preview</div>)
}))

// 导入要测试的组件
import { CharacterSettings } from '@/components/Settings/CharacterSettings'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

// Mock useCharacter Hook
const mockUseCharacter = {
  currentCharacter: {
    id: 'shizuku',
    name: '静流',
    modelPath: '/models/shizuku/',
    animations: ['idle', 'happy', 'sad', 'angry'],
    expressions: ['default', 'smile', 'cry', 'surprise']
  },
  availableCharacters: [
    { id: 'shizuku', name: '静流', type: 'live2d' },
    { id: 'hiyori', name: 'ひより', type: 'live2d' },
    { id: 'miku', name: '初音ミク', type: 'live2d' }
  ],
  isLoading: false,
  error: null,
  switchCharacter: vi.fn(),
  preloadCharacter: vi.fn(),
  getCharacterInfo: vi.fn(),
  validateModel: vi.fn()
}

vi.mock('@/hooks/useCharacter', () => ({
  useCharacter: () => mockUseCharacter
}))

describe('CharacterSettings - 角色设置组件', () => {
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

  const renderCharacterSettings = (overrideProps = {}) => {
    const defaultProps = {
      config: mockConfig,
      onConfigChange: mockOnConfigChange,
      ...overrideProps
    }
    
    return render(
      <TestProvider>
        <CharacterSettings {...defaultProps} />
      </TestProvider>
    )
  }

  // ==================== 渲染测试 ====================

  describe('渲染测试', () => {
    it('应该正确渲染角色设置组件', () => {
      renderCharacterSettings()

      expect(screen.getByText('角色选择')).toBeInTheDocument()
      expect(screen.getByText('外观设置')).toBeInTheDocument()
      expect(screen.getByText('行为设置')).toBeInTheDocument()
      expect(screen.getByText('模型管理')).toBeInTheDocument()
    })

    it('应该显示角色预览', () => {
      renderCharacterSettings()

      expect(screen.getByTestId('live2d-preview')).toBeInTheDocument()
    })

    it('应该应用自定义样式类名', () => {
      const { container } = renderCharacterSettings({ className: 'custom-character-settings' })
      
      expect(container.firstChild).toHaveClass('custom-character-settings')
    })
  })

  // ==================== 角色选择测试 ====================

  describe('角色选择测试', () => {
    it('应该显示可用角色列表', () => {
      renderCharacterSettings()

      expect(screen.getByText('静流')).toBeInTheDocument()
      expect(screen.getByText('ひより')).toBeInTheDocument()
      expect(screen.getByText('初音ミク')).toBeInTheDocument()
    })

    it('应该高亮当前选中角色', () => {
      renderCharacterSettings()

      const currentCharacter = screen.getByText('静流').closest('.character-item')
      expect(currentCharacter).toHaveClass('selected')
    })

    it('应该显示角色信息', () => {
      renderCharacterSettings()

      expect(screen.getByText('Live2D 模型')).toBeInTheDocument()
      expect(screen.getByText('/models/shizuku/')).toBeInTheDocument()
    })

    it('应该切换角色', async () => {
      renderCharacterSettings()

      const hiyoriCharacter = screen.getByText('ひより')
      await user.click(hiyoriCharacter)

      expect(mockUseCharacter.switchCharacter).toHaveBeenCalledWith('hiyori')
    })

    it('应该显示角色切换确认对话框', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderCharacterSettings()

      const mikuCharacter = screen.getByText('初音ミク')
      await user.click(mikuCharacter)

      expect(confirmSpy).toHaveBeenCalledWith('切换角色将重新加载模型，确定要继续吗？')

      confirmSpy.mockRestore()
    })

    it('应该预览角色模型', async () => {
      renderCharacterSettings()

      const previewButton = screen.getByText('预览')
      await user.click(previewButton)

      expect(mockUseCharacter.preloadCharacter).toHaveBeenCalled()
    })

    it('应该显示角色加载状态', () => {
      mockUseCharacter.isLoading = true
      
      renderCharacterSettings()

      expect(screen.getByText(/加载中/i)).toBeInTheDocument()
    })

    it('应该显示角色加载错误', () => {
      mockUseCharacter.error = new Error('模型加载失败')
      
      renderCharacterSettings()

      expect(screen.getByText('模型加载失败')).toBeInTheDocument()
    })
  })

  // ==================== 外观设置测试 ====================

  describe('外观设置测试', () => {
    it('应该显示缩放控制器', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('角色缩放')).toBeInTheDocument()
    })

    it('应该显示当前缩放值', () => {
      renderCharacterSettings()

      const scaleSlider = screen.getByLabelText('角色缩放') as HTMLInputElement
      expect(scaleSlider.value).toBe(mockConfig.character.scale.toString())
    })

    it('应该更新角色缩放', async () => {
      renderCharacterSettings()

      const scaleSlider = screen.getByLabelText('角色缩放')
      fireEvent.change(scaleSlider, { target: { value: '1.5' } })

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          scale: 1.5
        }
      })
    })

    it('应该验证缩放范围', async () => {
      renderCharacterSettings()

      const scaleSlider = screen.getByLabelText('角色缩放')
      fireEvent.change(scaleSlider, { target: { value: '10' } })

      expect(screen.getByText('缩放值必须在 0.1-5.0 之间')).toBeInTheDocument()
    })

    it('应该显示缩放预设按钮', () => {
      renderCharacterSettings()

      expect(screen.getByText('小')).toBeInTheDocument()
      expect(screen.getByText('中')).toBeInTheDocument()
      expect(screen.getByText('大')).toBeInTheDocument()
    })

    it('应该应用缩放预设', async () => {
      renderCharacterSettings()

      const largePreset = screen.getByText('大')
      await user.click(largePreset)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          scale: 2.0
        }
      })
    })

    it('应该显示透明度控制', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('透明度')).toBeInTheDocument()
    })

    it('应该显示位置调整控制', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('水平位置')).toBeInTheDocument()
      expect(screen.getByLabelText('垂直位置')).toBeInTheDocument()
    })

    it('应该重置角色位置', async () => {
      renderCharacterSettings()

      const resetButton = screen.getByText('重置位置')
      await user.click(resetButton)

      expect(mockUseTauri.commands.reset_character_position).toHaveBeenCalled()
    })
  })

  // ==================== 行为设置测试 ====================

  describe('行为设置测试', () => {
    it('应该显示交互设置开关', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('启用交互')).toBeInTheDocument()
    })

    it('应该显示当前交互设置状态', () => {
      renderCharacterSettings()

      const interactionSwitch = screen.getByLabelText('启用交互') as HTMLInputElement
      expect(interactionSwitch.checked).toBe(mockConfig.character.interaction_enabled)
    })

    it('应该切换交互设置', async () => {
      renderCharacterSettings()

      const interactionSwitch = screen.getByLabelText('启用交互')
      await user.click(interactionSwitch)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          interaction_enabled: !mockConfig.character.interaction_enabled
        }
      })
    })

    it('应该显示自动待机设置', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('自动待机')).toBeInTheDocument()
    })

    it('应该切换自动待机', async () => {
      renderCharacterSettings()

      const autoIdleSwitch = screen.getByLabelText('自动待机')
      await user.click(autoIdleSwitch)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          auto_idle: !mockConfig.character.auto_idle
        }
      })
    })

    it('应该显示待机动画间隔设置', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('待机间隔（秒）')).toBeInTheDocument()
    })

    it('应该显示鼠标跟随设置', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('鼠标跟随')).toBeInTheDocument()
    })

    it('应该显示触摸反馈设置', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('触摸反馈')).toBeInTheDocument()
    })

    it('应该显示语音反应设置', () => {
      renderCharacterSettings()

      expect(screen.getByLabelText('语音反应')).toBeInTheDocument()
    })
  })

  // ==================== 动画设置测试 ====================

  describe('动画设置测试', () => {
    it('应该显示可用动画列表', () => {
      renderCharacterSettings()

      expect(screen.getByText('可用动画')).toBeInTheDocument()
      expect(screen.getByText('idle')).toBeInTheDocument()
      expect(screen.getByText('happy')).toBeInTheDocument()
      expect(screen.getByText('sad')).toBeInTheDocument()
      expect(screen.getByText('angry')).toBeInTheDocument()
    })

    it('应该预览动画', async () => {
      renderCharacterSettings()

      const playButton = screen.getAllByText('播放')[0]
      await user.click(playButton)

      expect(mockUseTauri.commands.play_character_animation).toHaveBeenCalledWith('idle')
    })

    it('应该设置默认动画', async () => {
      renderCharacterSettings()

      const setDefaultButton = screen.getAllByText('设为默认')[0]
      await user.click(setDefaultButton)

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          default_animation: 'idle'
        }
      })
    })

    it('应该显示表情列表', () => {
      renderCharacterSettings()

      expect(screen.getByText('可用表情')).toBeInTheDocument()
      expect(screen.getByText('default')).toBeInTheDocument()
      expect(screen.getByText('smile')).toBeInTheDocument()
      expect(screen.getByText('cry')).toBeInTheDocument()
    })

    it('应该预览表情', async () => {
      renderCharacterSettings()

      const expressionButtons = screen.getAllByText('预览')
      await user.click(expressionButtons[0])

      expect(mockUseTauri.commands.set_character_expression).toHaveBeenCalledWith('default')
    })

    it('应该配置动画播放速度', async () => {
      renderCharacterSettings()

      const speedSlider = screen.getByLabelText('播放速度')
      fireEvent.change(speedSlider, { target: { value: '1.5' } })

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          animation_speed: 1.5
        }
      })
    })
  })

  // ==================== 模型管理测试 ====================

  describe('模型管理测试', () => {
    it('应该显示模型信息', () => {
      renderCharacterSettings()

      expect(screen.getByText('模型信息')).toBeInTheDocument()
      expect(screen.getByText('模型路径')).toBeInTheDocument()
      expect(screen.getByText('版本信息')).toBeInTheDocument()
    })

    it('应该显示模型文件列表', () => {
      renderCharacterSettings()

      expect(screen.getByText('模型文件')).toBeInTheDocument()
      expect(screen.getByText('.model3.json')).toBeInTheDocument()
      expect(screen.getByText('纹理文件')).toBeInTheDocument()
      expect(screen.getByText('动画文件')).toBeInTheDocument()
    })

    it('应该验证模型文件', async () => {
      renderCharacterSettings()

      const validateButton = screen.getByText('验证模型')
      await user.click(validateButton)

      expect(mockUseCharacter.validateModel).toHaveBeenCalled()
    })

    it('应该显示验证结果', () => {
      mockUseCharacter.validateModel.mockResolvedValue({
        valid: true,
        issues: [],
        warnings: []
      })

      renderCharacterSettings()

      expect(screen.getByText(/模型验证通过/i)).toBeInTheDocument()
    })

    it('应该导入新模型', async () => {
      renderCharacterSettings()

      const importButton = screen.getByText('导入模型')
      await user.click(importButton)

      expect(mockUseTauri.commands.import_character_model).toHaveBeenCalled()
    })

    it('应该导出当前模型', async () => {
      renderCharacterSettings()

      const exportButton = screen.getByText('导出模型')
      await user.click(exportButton)

      expect(mockUseTauri.commands.export_character_model).toHaveBeenCalled()
    })

    it('应该删除模型', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderCharacterSettings()

      const deleteButton = screen.getByText('删除模型')
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要删除此模型吗？此操作不可恢复。')
      expect(mockUseTauri.commands.delete_character_model).toHaveBeenCalled()

      confirmSpy.mockRestore()
    })

    it('应该显示模型大小信息', () => {
      renderCharacterSettings()

      expect(screen.getByText(/模型大小/i)).toBeInTheDocument()
      expect(screen.getByText(/MB/i)).toBeInTheDocument()
    })

    it('应该显示模型加载性能', () => {
      renderCharacterSettings()

      expect(screen.getByText('加载时间')).toBeInTheDocument()
      expect(screen.getByText('内存使用')).toBeInTheDocument()
      expect(screen.getByText('渲染FPS')).toBeInTheDocument()
    })
  })

  // ==================== 高级设置测试 ====================

  describe('高级设置测试', () => {
    it('应该显示高级设置折叠面板', () => {
      renderCharacterSettings()

      expect(screen.getByText('高级设置')).toBeInTheDocument()
    })

    it('应该展开高级设置', async () => {
      renderCharacterSettings()

      const advancedToggle = screen.getByText('高级设置')
      await user.click(advancedToggle)

      expect(screen.getByText('物理参数')).toBeInTheDocument()
    })

    it('应该配置物理参数', async () => {
      renderCharacterSettings()

      // 先展开高级设置
      await user.click(screen.getByText('高级设置'))

      const gravitySlider = screen.getByLabelText('重力强度')
      fireEvent.change(gravitySlider, { target: { value: '0.8' } })

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          physics: {
            ...mockConfig.character.physics,
            gravity: 0.8
          }
        }
      })
    })

    it('应该配置渲染质量', async () => {
      renderCharacterSettings()

      await user.click(screen.getByText('高级设置'))

      const qualitySelect = screen.getByLabelText('渲染质量')
      await user.selectOptions(qualitySelect, 'high')

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...mockConfig,
        character: {
          ...mockConfig.character,
          render_quality: 'high'
        }
      })
    })

    it('应该显示性能监控', async () => {
      renderCharacterSettings()

      await user.click(screen.getByText('高级设置'))

      expect(screen.getByText('实时FPS')).toBeInTheDocument()
      expect(screen.getByText('GPU使用率')).toBeInTheDocument()
    })

    it('应该重置高级设置', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderCharacterSettings()

      await user.click(screen.getByText('高级设置'))

      const resetButton = screen.getByText('重置高级设置')
      await user.click(resetButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要重置所有高级设置吗？')

      confirmSpy.mockRestore()
    })
  })

  // ==================== 预览功能测试 ====================

  describe('预览功能测试', () => {
    it('应该实时预览角色变化', async () => {
      renderCharacterSettings()

      const scaleSlider = screen.getByLabelText('角色缩放')
      fireEvent.change(scaleSlider, { target: { value: '1.5' } })

      const preview = screen.getByTestId('live2d-preview')
      expect(preview).toHaveAttribute('data-scale', '1.5')
    })

    it('应该预览动画效果', async () => {
      renderCharacterSettings()

      const playButton = screen.getAllByText('播放')[0]
      await user.click(playButton)

      const preview = screen.getByTestId('live2d-preview')
      expect(preview).toHaveAttribute('data-animation', 'idle')
    })

    it('应该预览表情变化', async () => {
      renderCharacterSettings()

      const expressionButtons = screen.getAllByText('预览')
      await user.click(expressionButtons[0])

      const preview = screen.getByTestId('live2d-preview')
      expect(preview).toHaveAttribute('data-expression', 'default')
    })

    it('应该切换全屏预览', async () => {
      renderCharacterSettings()

      const fullscreenButton = screen.getByText('全屏预览')
      await user.click(fullscreenButton)

      expect(screen.getByTestId('fullscreen-preview')).toBeInTheDocument()
    })

    it('应该保存预览截图', async () => {
      renderCharacterSettings()

      const screenshotButton = screen.getByText('保存截图')
      await user.click(screenshotButton)

      expect(mockUseTauri.commands.save_character_screenshot).toHaveBeenCalled()
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理测试', () => {
    it('应该处理角色切换错误', async () => {
      mockUseCharacter.switchCharacter.mockRejectedValue(new Error('切换失败'))

      renderCharacterSettings()

      const hiyoriCharacter = screen.getByText('ひより')
      await user.click(hiyoriCharacter)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('角色切换失败: 切换失败')
      })
    })

    it('应该处理模型验证错误', async () => {
      mockUseCharacter.validateModel.mockRejectedValue(new Error('验证失败'))

      renderCharacterSettings()

      const validateButton = screen.getByText('验证模型')
      await user.click(validateButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('模型验证失败: 验证失败')
      })
    })

    it('应该显示无效配置警告', () => {
      const invalidConfig = createMockAppConfig({
        character: createMockCharacterConfig({ scale: 10 as any })
      })

      renderCharacterSettings({ config: invalidConfig })

      expect(screen.getByText(/配置无效/i)).toBeInTheDocument()
    })

    it('应该处理文件操作错误', async () => {
      mockUseTauri.commands.import_character_model.mockRejectedValue(new Error('导入失败'))

      renderCharacterSettings()

      const importButton = screen.getByText('导入模型')
      await user.click(importButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('模型导入失败: 导入失败')
      })
    })

    it('应该提供错误恢复选项', () => {
      mockUseCharacter.error = new Error('模型加载失败')

      renderCharacterSettings()

      expect(screen.getByText('重试')).toBeInTheDocument()
      expect(screen.getByText('使用默认模型')).toBeInTheDocument()
    })
  })
})

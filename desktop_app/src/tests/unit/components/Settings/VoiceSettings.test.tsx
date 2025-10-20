/**
 * 语音设置组件测试
 * 
 * 测试主要功能：
 * - 🎤 TTS（文本转语音）引擎配置
 * - 🎧 STT（语音转文本）引擎配置
 * - 🔊 音量和语速调整
 * - 🎵 语音样本测试和预览
 * - 🔧 音频设备管理
 * - 🌐 多语言语音支持
 * - 🎛️ 高级音频参数调整
 * - 📊 音频质量监控
 * 
 * @module Tests/Components/Settings/VoiceSettings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from '@/tests/utils/test-utils'
import { 
  createMockUseSettings, 
  createMockUseTauri,
  createMockVoiceSettings,
  mockToast 
} from '@/tests/mocks/settings-mocks'

// 模拟依赖
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('@/hooks/useVoice')
vi.mock('react-hot-toast', () => ({ default: mockToast }))
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    section: vi.fn(({ children, ...props }) => <section {...props}>{children}</section>)
  }
}))

// 模拟音频API
Object.defineProperty(window, 'SpeechSynthesis', {
  writable: true,
  value: {
    getVoices: vi.fn(() => [
      { name: 'Microsoft Yaoyao', lang: 'zh-CN', default: true },
      { name: 'Microsoft Kangkang', lang: 'zh-CN', default: false },
      { name: 'Google US English', lang: 'en-US', default: false }
    ]),
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn()
  }
})

Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

// Mock useVoice Hook
const mockUseVoice = {
  ttsSettings: {
    engine: 'system',
    voice: 'Microsoft Yaoyao',
    speed: 1.0,
    volume: 0.8,
    enabled: true
  },
  sttSettings: {
    engine: 'browser',
    language: 'zh-CN',
    sensitivity: 0.5,
    enabled: true
  },
  availableVoices: [
    { id: 'yaoyao', name: 'Microsoft Yaoyao', language: 'zh-CN', gender: 'female' },
    { id: 'kangkang', name: 'Microsoft Kangkang', language: 'zh-CN', gender: 'male' }
  ],
  availableEngines: [
    { id: 'system', name: '系统语音', type: 'tts' },
    { id: 'azure', name: 'Azure 认知服务', type: 'tts' },
    { id: 'browser', name: '浏览器识别', type: 'stt' },
    { id: 'whisper', name: 'OpenAI Whisper', type: 'stt' }
  ],
  audioDevices: {
    input: [
      { deviceId: 'default', label: '默认麦克风' },
      { deviceId: 'mic1', label: '内置麦克风' }
    ],
    output: [
      { deviceId: 'default', label: '默认扬声器' },
      { deviceId: 'speaker1', label: '内置扬声器' }
    ]
  },
  isRecording: false,
  isSpeaking: false,
  error: null,
  updateTTSSettings: vi.fn(),
  updateSTTSettings: vi.fn(),
  testTTS: vi.fn(),
  testSTT: vi.fn(),
  requestMicrophonePermission: vi.fn(),
  getAudioDevices: vi.fn(),
  setAudioDevice: vi.fn()
}

vi.mock('@/hooks/useVoice', () => ({
  useVoice: () => mockUseVoice
}))

// 导入要测试的组件
import { VoiceSettings } from '@/components/Settings/VoiceSettings'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

describe('VoiceSettings - 语音设置组件', () => {
  let mockUseSettings: ReturnType<typeof createMockUseSettings>
  let mockUseTauri: ReturnType<typeof createMockUseTauri>
  let user: ReturnType<typeof userEvent.setup>
  let mockVoiceSettings: ReturnType<typeof createMockVoiceSettings>
  let mockOnSettingsChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUseSettings = createMockUseSettings()
    mockUseTauri = createMockUseTauri()
    mockVoiceSettings = createMockVoiceSettings()
    mockOnSettingsChange = vi.fn()
    user = userEvent.setup()

    vi.mocked(useSettings).mockReturnValue(mockUseSettings)
    vi.mocked(useTauri).mockReturnValue(mockUseTauri)
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderVoiceSettings = (overrideProps = {}) => {
    const defaultProps = {
      voiceSettings: mockVoiceSettings,
      onSettingsChange: mockOnSettingsChange,
      ...overrideProps
    }
    
    return render(
      <TestProvider>
        <VoiceSettings {...defaultProps} />
      </TestProvider>
    )
  }

  // ==================== 渲染测试 ====================

  describe('渲染测试', () => {
    it('应该正确渲染语音设置组件', () => {
      renderVoiceSettings()

      expect(screen.getByText('TTS 设置')).toBeInTheDocument()
      expect(screen.getByText('STT 设置')).toBeInTheDocument()
      expect(screen.getByText('音频设备')).toBeInTheDocument()
      expect(screen.getByText('高级设置')).toBeInTheDocument()
    })

    it('应该显示所有主要设置分组', () => {
      renderVoiceSettings()

      const sections = [
        'TTS 设置',
        'STT 设置',
        '音频设备',
        '权限管理',
        '测试工具'
      ]

      sections.forEach(section => {
        expect(screen.getByText(section)).toBeInTheDocument()
      })
    })

    it('应该应用自定义样式类名', () => {
      const { container } = renderVoiceSettings({ className: 'custom-voice-settings' })
      
      expect(container.firstChild).toHaveClass('custom-voice-settings')
    })
  })

  // ==================== TTS设置测试 ====================

  describe('TTS设置测试', () => {
    it('应该显示TTS引擎选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('TTS引擎')).toBeInTheDocument()
    })

    it('应该显示当前选中的TTS引擎', () => {
      renderVoiceSettings()

      const engineSelect = screen.getByLabelText('TTS引擎') as HTMLSelectElement
      expect(engineSelect.value).toBe(mockVoiceSettings.tts.engine)
    })

    it('应该切换TTS引擎', async () => {
      renderVoiceSettings()

      const engineSelect = screen.getByLabelText('TTS引擎')
      await user.selectOptions(engineSelect, 'azure')

      expect(mockUseVoice.updateTTSSettings).toHaveBeenCalledWith({
        engine: 'azure'
      })
    })

    it('应该显示语音选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('语音')).toBeInTheDocument()
    })

    it('应该显示可用语音列表', () => {
      renderVoiceSettings()

      const voiceSelect = screen.getByLabelText('语音')
      fireEvent.click(voiceSelect)

      expect(screen.getByText('Microsoft Yaoyao')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Kangkang')).toBeInTheDocument()
    })

    it('应该切换语音', async () => {
      renderVoiceSettings()

      const voiceSelect = screen.getByLabelText('语音')
      await user.selectOptions(voiceSelect, 'kangkang')

      expect(mockUseVoice.updateTTSSettings).toHaveBeenCalledWith({
        voice: 'kangkang'
      })
    })

    it('应该显示语速控制器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('语速')).toBeInTheDocument()
    })

    it('应该调整语速', async () => {
      renderVoiceSettings()

      const speedSlider = screen.getByLabelText('语速')
      fireEvent.change(speedSlider, { target: { value: '1.5' } })

      expect(mockUseVoice.updateTTSSettings).toHaveBeenCalledWith({
        speed: 1.5
      })
    })

    it('应该显示音量控制器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('音量')).toBeInTheDocument()
    })

    it('应该调整音量', async () => {
      renderVoiceSettings()

      const volumeSlider = screen.getByLabelText('音量')
      fireEvent.change(volumeSlider, { target: { value: '0.6' } })

      expect(mockUseVoice.updateTTSSettings).toHaveBeenCalledWith({
        volume: 0.6
      })
    })

    it('应该切换TTS启用状态', async () => {
      renderVoiceSettings()

      const enableSwitch = screen.getByLabelText('启用TTS')
      await user.click(enableSwitch)

      expect(mockUseVoice.updateTTSSettings).toHaveBeenCalledWith({
        enabled: !mockVoiceSettings.tts.enabled
      })
    })

    it('应该测试TTS功能', async () => {
      renderVoiceSettings()

      const testButton = screen.getByText('测试语音')
      await user.click(testButton)

      expect(mockUseVoice.testTTS).toHaveBeenCalledWith('这是一段测试语音。')
    })

    it('应该允许自定义测试文本', async () => {
      renderVoiceSettings()

      const testInput = screen.getByLabelText('测试文本')
      await user.clear(testInput)
      await user.type(testInput, '自定义测试文本')

      const testButton = screen.getByText('测试语音')
      await user.click(testButton)

      expect(mockUseVoice.testTTS).toHaveBeenCalledWith('自定义测试文本')
    })

    it('应该显示TTS状态指示器', () => {
      mockUseVoice.isSpeaking = true
      
      renderVoiceSettings()

      expect(screen.getByText(/正在播放/i)).toBeInTheDocument()
    })

    it('应该停止正在播放的TTS', async () => {
      mockUseVoice.isSpeaking = true
      
      renderVoiceSettings()

      const stopButton = screen.getByText('停止')
      await user.click(stopButton)

      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    })
  })

  // ==================== STT设置测试 ====================

  describe('STT设置测试', () => {
    it('应该显示STT引擎选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('STT引擎')).toBeInTheDocument()
    })

    it('应该显示当前选中的STT引擎', () => {
      renderVoiceSettings()

      const engineSelect = screen.getByLabelText('STT引擎') as HTMLSelectElement
      expect(engineSelect.value).toBe(mockVoiceSettings.stt.engine)
    })

    it('应该切换STT引擎', async () => {
      renderVoiceSettings()

      const engineSelect = screen.getByLabelText('STT引擎')
      await user.selectOptions(engineSelect, 'whisper')

      expect(mockUseVoice.updateSTTSettings).toHaveBeenCalledWith({
        engine: 'whisper'
      })
    })

    it('应该显示识别语言选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('识别语言')).toBeInTheDocument()
    })

    it('应该切换识别语言', async () => {
      renderVoiceSettings()

      const languageSelect = screen.getByLabelText('识别语言')
      await user.selectOptions(languageSelect, 'en-US')

      expect(mockUseVoice.updateSTTSettings).toHaveBeenCalledWith({
        language: 'en-US'
      })
    })

    it('应该显示灵敏度控制器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('识别灵敏度')).toBeInTheDocument()
    })

    it('应该调整识别灵敏度', async () => {
      renderVoiceSettings()

      const sensitivitySlider = screen.getByLabelText('识别灵敏度')
      fireEvent.change(sensitivitySlider, { target: { value: '0.8' } })

      expect(mockUseVoice.updateSTTSettings).toHaveBeenCalledWith({
        sensitivity: 0.8
      })
    })

    it('应该切换STT启用状态', async () => {
      renderVoiceSettings()

      const enableSwitch = screen.getByLabelText('启用STT')
      await user.click(enableSwitch)

      expect(mockUseVoice.updateSTTSettings).toHaveBeenCalledWith({
        enabled: !mockVoiceSettings.stt.enabled
      })
    })

    it('应该测试STT功能', async () => {
      renderVoiceSettings()

      const testButton = screen.getByText('测试识别')
      await user.click(testButton)

      expect(mockUseVoice.testSTT).toHaveBeenCalled()
    })

    it('应该显示STT状态指示器', () => {
      mockUseVoice.isRecording = true
      
      renderVoiceSettings()

      expect(screen.getByText(/正在录音/i)).toBeInTheDocument()
    })

    it('应该停止STT录音', async () => {
      mockUseVoice.isRecording = true
      
      renderVoiceSettings()

      const stopButton = screen.getByText('停止录音')
      await user.click(stopButton)

      // STT停止逻辑在 useVoice hook 中处理
      expect(mockUseVoice.testSTT).toHaveBeenCalled()
    })

    it('应该显示识别结果', () => {
      renderVoiceSettings()

      // 模拟识别结果
      const resultArea = screen.getByLabelText('识别结果')
      expect(resultArea).toBeInTheDocument()
    })

    it('应该清除识别结果', async () => {
      renderVoiceSettings()

      const clearButton = screen.getByText('清除结果')
      await user.click(clearButton)

      const resultArea = screen.getByLabelText('识别结果') as HTMLTextAreaElement
      expect(resultArea.value).toBe('')
    })
  })

  // ==================== 音频设备测试 ====================

  describe('音频设备测试', () => {
    it('应该显示输入设备选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('麦克风')).toBeInTheDocument()
    })

    it('应该显示输出设备选择器', () => {
      renderVoiceSettings()

      expect(screen.getByLabelText('扬声器')).toBeInTheDocument()
    })

    it('应该显示可用音频设备', () => {
      renderVoiceSettings()

      const micSelect = screen.getByLabelText('麦克风')
      fireEvent.click(micSelect)

      expect(screen.getByText('默认麦克风')).toBeInTheDocument()
      expect(screen.getByText('内置麦克风')).toBeInTheDocument()
    })

    it('应该切换音频设备', async () => {
      renderVoiceSettings()

      const micSelect = screen.getByLabelText('麦克风')
      await user.selectOptions(micSelect, 'mic1')

      expect(mockUseVoice.setAudioDevice).toHaveBeenCalledWith('input', 'mic1')
    })

    it('应该刷新音频设备列表', async () => {
      renderVoiceSettings()

      const refreshButton = screen.getByText('刷新设备')
      await user.click(refreshButton)

      expect(mockUseVoice.getAudioDevices).toHaveBeenCalled()
    })

    it('应该测试音频设备', async () => {
      renderVoiceSettings()

      const testMicButton = screen.getByText('测试麦克风')
      await user.click(testMicButton)

      expect(mockUseTauri.commands.test_audio_device).toHaveBeenCalledWith('input')
    })

    it('应该显示音频设备状态', () => {
      renderVoiceSettings()

      expect(screen.getByText('设备状态')).toBeInTheDocument()
      expect(screen.getByText(/正常/i)).toBeInTheDocument()
    })

    it('应该显示音频电平指示器', () => {
      renderVoiceSettings()

      expect(screen.getByTestId('audio-level-meter')).toBeInTheDocument()
    })
  })

  // ==================== 权限管理测试 ====================

  describe('权限管理测试', () => {
    it('应该显示麦克风权限状态', () => {
      renderVoiceSettings()

      expect(screen.getByText('麦克风权限')).toBeInTheDocument()
    })

    it('应该请求麦克风权限', async () => {
      renderVoiceSettings()

      const requestButton = screen.getByText('请求权限')
      await user.click(requestButton)

      expect(mockUseVoice.requestMicrophonePermission).toHaveBeenCalled()
    })

    it('应该显示权限被拒绝提示', () => {
      mockUseVoice.error = new Error('Permission denied')
      
      renderVoiceSettings()

      expect(screen.getByText(/权限被拒绝/i)).toBeInTheDocument()
    })

    it('应该提供权限设置指引', () => {
      renderVoiceSettings()

      const helpButton = screen.getByText('权限帮助')
      fireEvent.click(helpButton)

      expect(screen.getByText(/如何开启权限/i)).toBeInTheDocument()
    })

    it('应该显示浏览器兼容性信息', () => {
      renderVoiceSettings()

      expect(screen.getByText('浏览器支持')).toBeInTheDocument()
    })
  })

  // ==================== 高级设置测试 ====================

  describe('高级设置测试', () => {
    it('应该显示高级设置折叠面板', () => {
      renderVoiceSettings()

      expect(screen.getByText('高级设置')).toBeInTheDocument()
    })

    it('应该展开高级设置', async () => {
      renderVoiceSettings()

      const advancedToggle = screen.getByText('高级设置')
      await user.click(advancedToggle)

      expect(screen.getByText('音频参数')).toBeInTheDocument()
    })

    it('应该配置音频采样率', async () => {
      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const sampleRateSelect = screen.getByLabelText('采样率')
      await user.selectOptions(sampleRateSelect, '48000')

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockVoiceSettings,
        advanced: {
          ...mockVoiceSettings.advanced,
          sampleRate: 48000
        }
      })
    })

    it('应该配置音频缓冲区大小', async () => {
      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const bufferSizeSelect = screen.getByLabelText('缓冲区大小')
      await user.selectOptions(bufferSizeSelect, '1024')

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockVoiceSettings,
        advanced: {
          ...mockVoiceSettings.advanced,
          bufferSize: 1024
        }
      })
    })

    it('应该启用噪音抑制', async () => {
      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const noiseSuppressionSwitch = screen.getByLabelText('噪音抑制')
      await user.click(noiseSuppressionSwitch)

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockVoiceSettings,
        advanced: {
          ...mockVoiceSettings.advanced,
          noiseSuppression: true
        }
      })
    })

    it('应该启用回声消除', async () => {
      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const echoCancellationSwitch = screen.getByLabelText('回声消除')
      await user.click(echoCancellationSwitch)

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockVoiceSettings,
        advanced: {
          ...mockVoiceSettings.advanced,
          echoCancellation: true
        }
      })
    })

    it('应该启用自动增益控制', async () => {
      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const agcSwitch = screen.getByLabelText('自动增益控制')
      await user.click(agcSwitch)

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockVoiceSettings,
        advanced: {
          ...mockVoiceSettings.advanced,
          autoGainControl: true
        }
      })
    })

    it('应该重置高级设置', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderVoiceSettings()

      await user.click(screen.getByText('高级设置'))

      const resetButton = screen.getByText('重置高级设置')
      await user.click(resetButton)

      expect(confirmSpy).toHaveBeenCalledWith('确定要重置所有高级设置吗？')

      confirmSpy.mockRestore()
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理测试', () => {
    it('应该显示TTS错误信息', () => {
      mockUseVoice.error = new Error('TTS引擎初始化失败')
      
      renderVoiceSettings()

      expect(screen.getByText('TTS引擎初始化失败')).toBeInTheDocument()
    })

    it('应该显示STT错误信息', () => {
      mockUseVoice.error = new Error('语音识别不可用')
      
      renderVoiceSettings()

      expect(screen.getByText('语音识别不可用')).toBeInTheDocument()
    })

    it('应该处理权限错误', () => {
      mockUseVoice.error = new Error('Permission denied')
      
      renderVoiceSettings()

      expect(screen.getByText(/请允许麦克风权限/i)).toBeInTheDocument()
    })

    it('应该处理设备不可用错误', () => {
      mockUseVoice.error = new Error('No audio devices found')
      
      renderVoiceSettings()

      expect(screen.getByText(/未找到音频设备/i)).toBeInTheDocument()
    })

    it('应该提供错误重试选项', () => {
      mockUseVoice.error = new Error('网络连接失败')
      
      renderVoiceSettings()

      expect(screen.getByText('重试')).toBeInTheDocument()
    })

    it('应该重试失败的操作', async () => {
      mockUseVoice.error = new Error('网络连接失败')
      
      renderVoiceSettings()

      const retryButton = screen.getByText('重试')
      await user.click(retryButton)

      // 验证重试逻辑被触发
      expect(mockUseVoice.getAudioDevices).toHaveBeenCalled()
    })
  })

  // ==================== 实时监控测试 ====================

  describe('实时监控测试', () => {
    it('应该显示音频质量监控', () => {
      renderVoiceSettings()

      expect(screen.getByText('音频质量')).toBeInTheDocument()
    })

    it('应该显示实时音频电平', () => {
      renderVoiceSettings()

      expect(screen.getByTestId('audio-level-meter')).toBeInTheDocument()
    })

    it('应该显示延迟监控', () => {
      renderVoiceSettings()

      expect(screen.getByText('音频延迟')).toBeInTheDocument()
      expect(screen.getByText(/ms/i)).toBeInTheDocument()
    })

    it('应该显示识别准确度', () => {
      renderVoiceSettings()

      expect(screen.getByText('识别准确度')).toBeInTheDocument()
    })

    it('应该显示使用统计', () => {
      renderVoiceSettings()

      expect(screen.getByText('使用统计')).toBeInTheDocument()
      expect(screen.getByText('今日使用时长')).toBeInTheDocument()
      expect(screen.getByText('识别次数')).toBeInTheDocument()
    })
  })

  // ==================== 导入导出测试 ====================

  describe('导入导出测试', () => {
    it('应该导出语音设置', async () => {
      renderVoiceSettings()

      const exportButton = screen.getByText('导出设置')
      await user.click(exportButton)

      expect(mockUseTauri.commands.export_voice_settings).toHaveBeenCalled()
    })

    it('应该导入语音设置', async () => {
      renderVoiceSettings()

      const importButton = screen.getByText('导入设置')
      await user.click(importButton)

      expect(mockUseTauri.commands.import_voice_settings).toHaveBeenCalled()
    })

    it('应该验证导入的设置', async () => {
      renderVoiceSettings()

      const importButton = screen.getByText('导入设置')
      await user.click(importButton)

      await waitFor(() => {
        expect(mockUseTauri.commands.validate_voice_settings).toHaveBeenCalled()
      })
    })

    it('应该处理导入错误', async () => {
      mockUseTauri.commands.import_voice_settings.mockRejectedValue(new Error('格式错误'))

      renderVoiceSettings()

      const importButton = screen.getByText('导入设置')
      await user.click(importButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('设置导入失败: 格式错误')
      })
    })
  })
})

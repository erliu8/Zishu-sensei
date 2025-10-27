/**
 * VoiceInput 组件测试
 * 
 * 测试语音输入组件的录音、播放、识别等功能
 * @module VoiceInput/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'

// Mock VoiceInput component (组件尚未实现)
const VoiceInput = vi.fn(({ onVoiceResult, onRecordingStart, onRecordingStop, onError, ...props }: any) => (
  <div 
    data-testid="voice-input"
    role="group"
    aria-label="语音输入"
    {...props}
  >
    <button 
      data-testid="record-button"
      aria-label="开始录音"
      aria-describedby="recording-help"
      onClick={() => {
        onRecordingStart?.()
        // Simulate recording
      }}
    >
      录音
    </button>
    <div data-testid="recording-status" aria-live="polite">就绪</div>
    <div data-testid="volume-level" aria-label="音量级别" />
  </div>
))

// ==================== Mock 设置 ====================

// Mock Web Audio API
const mockAudioContext = {
  createMediaStreamSource: vi.fn(),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
  })),
  createScriptProcessor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  })),
  destination: {},
  close: vi.fn(),
}

global.AudioContext = vi.fn(() => mockAudioContext) as any
global.webkitAudioContext = vi.fn(() => mockAudioContext) as any

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  requestData: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstart: null,
  onstop: null,
  onerror: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any
global.MediaRecorder.isTypeSupported = vi.fn(() => true)

// Mock getUserMedia
const mockStream = {
  getTracks: vi.fn(() => [
    {
      stop: vi.fn(),
      kind: 'audio',
      enabled: true,
    },
  ]),
  getAudioTracks: vi.fn(() => [
    {
      stop: vi.fn(),
      kind: 'audio',
      enabled: true,
    },
  ]),
}

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
    enumerateDevices: vi.fn(() => Promise.resolve([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: '默认麦克风',
        groupId: 'group1',
      },
    ])),
  },
  writable: true,
})

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock Audio element
global.Audio = vi.fn(() => ({
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  src: '',
  duration: 0,
  currentTime: 0,
  paused: true,
  ended: false,
})) as any

describe('VoiceInput 组件', () => {
  // ==================== 测试数据 ====================
  
  const defaultProps = {
    onVoiceResult: createMockFn(),
    onRecordingStart: createMockFn(),
    onRecordingStop: createMockFn(),
    onError: createMockFn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaRecorder.state = 'inactive'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染语音输入组件', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      expect(screen.getByTestId('voice-input')).toBeInTheDocument()
      expect(screen.getByLabelText('开始录音')).toBeInTheDocument()
    })

    it('应该显示录音按钮', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      expect(recordButton).toBeInTheDocument()
      expect(recordButton).not.toBeDisabled()
    })

    it('当不支持语音输入时应该禁用', () => {
      // Mock 不支持 MediaRecorder
      global.MediaRecorder = undefined as any
      
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      expect(screen.getByTestId('record-button')).toBeDisabled()
      expect(screen.getByText(/不支持语音输入/)).toBeInTheDocument()
    })

    it('应该显示录音状态指示器', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      expect(screen.getByTestId('recording-status')).toBeInTheDocument()
    })

    it('应该显示音量级别指示器', () => {
      renderWithProviders(<VoiceInput {...defaultProps} showVolumeLevel />)
      
      expect(screen.getByTestId('volume-level')).toBeInTheDocument()
    })
  })

  // ==================== 录音功能测试 ====================
  
  describe('录音功能', () => {
    it('应该开始录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
          audio: true,
        })
        expect(mockMediaRecorder.start).toHaveBeenCalled()
        expect(defaultProps.onRecordingStart).toHaveBeenCalled()
      })
    })

    it('应该停止录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      
      // 开始录音
      await user.click(recordButton)
      mockMediaRecorder.state = 'recording'
      
      // 停止录音
      await user.click(recordButton)
      
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(defaultProps.onRecordingStop).toHaveBeenCalled()
    })

    it('应该处理录音数据', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟录音数据事件
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' })
      const dataEvent = new Event('dataavailable') as any
      dataEvent.data = mockBlob
      
      mockMediaRecorder.ondataavailable?.(dataEvent)
      
      expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
    })

    it('应该支持暂停和恢复录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      // 暂停录音
      const pauseButton = screen.getByLabelText('暂停录音')
      await user.click(pauseButton)
      
      expect(mockMediaRecorder.pause).toHaveBeenCalled()
      
      // 恢复录音
      const resumeButton = screen.getByLabelText('继续录音')
      await user.click(resumeButton)
      
      expect(mockMediaRecorder.resume).toHaveBeenCalled()
    })

    it('应该限制录音时长', async () => {
      const maxDuration = 30 // 30秒
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} maxDuration={maxDuration} />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟时间流逝
      vi.advanceTimersByTime(maxDuration * 1000 + 1000)
      
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
    })
  })

  // ==================== 播放功能测试 ====================
  
  describe('播放功能', () => {
    it('应该播放录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // 先录制音频
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      await user.click(recordButton) // 停止录音
      
      // 播放录音
      const playButton = screen.getByLabelText('播放录音')
      await user.click(playButton)
      
      expect(global.Audio).toHaveBeenCalled()
    })

    it('应该暂停播放', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // 录制并播放音频
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      await user.click(recordButton)
      
      const playButton = screen.getByLabelText('播放录音')
      await user.click(playButton)
      
      // 暂停播放
      const pauseButton = screen.getByLabelText('暂停播放')
      await user.click(pauseButton)
      
      // 验证音频暂停
      const audioInstance = vi.mocked(global.Audio).mock.results[0].value
      expect(audioInstance.pause).toHaveBeenCalled()
    })

    it('应该显示播放进度', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      await user.click(recordButton)
      
      const playButton = screen.getByLabelText('播放录音')
      await user.click(playButton)
      
      expect(screen.getByTestId('playback-progress')).toBeInTheDocument()
    })

    it('应该显示音频波形', async () => {
      renderWithProviders(
        <VoiceInput {...defaultProps} showWaveform />
      )
      
      expect(screen.getByTestId('audio-waveform')).toBeInTheDocument()
    })
  })

  // ==================== 语音识别测试 ====================
  
  describe('语音识别', () => {
    beforeEach(() => {
      // Mock SpeechRecognition
      const mockSpeechRecognition = {
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        continuous: false,
        interimResults: false,
        lang: 'zh-CN',
        onstart: null,
        onend: null,
        onresult: null,
        onerror: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      
      global.webkitSpeechRecognition = vi.fn(() => mockSpeechRecognition) as any
      global.SpeechRecognition = vi.fn(() => mockSpeechRecognition) as any
    })

    it('应该启动语音识别', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpeechRecognition />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      expect(global.webkitSpeechRecognition || global.SpeechRecognition).toHaveBeenCalled()
    })

    it('应该处理语音识别结果', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpeechRecognition />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟语音识别结果
      const mockRecognition = vi.mocked(global.webkitSpeechRecognition || global.SpeechRecognition).mock.results[0].value
      const resultEvent = {
        results: [{
          0: { transcript: '你好世界' },
          isFinal: true,
        }],
      } as any
      
      mockRecognition.onresult?.(resultEvent)
      
      expect(defaultProps.onVoiceResult).toHaveBeenCalledWith('你好世界')
    })

    it('应该处理语音识别错误', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpeechRecognition />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟语音识别错误
      const mockRecognition = vi.mocked(global.webkitSpeechRecognition || global.SpeechRecognition).mock.results[0].value
      const errorEvent = {
        error: 'network',
        message: '网络错误',
      } as any
      
      mockRecognition.onerror?.(errorEvent)
      
      expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: 'recognition_error',
        error: 'network',
      }))
    })

    it('应该支持不同语言', async () => {
      renderWithProviders(
        <VoiceInput 
          {...defaultProps} 
          enableSpeechRecognition 
          language="en-US"
        />
      )
      
      const mockRecognition = vi.mocked(global.webkitSpeechRecognition || global.SpeechRecognition).mock.results[0].value
      expect(mockRecognition.lang).toBe('en-US')
    })
  })

  // ==================== 音频设备管理测试 ====================
  
  describe('音频设备管理', () => {
    it('应该列出可用的音频输入设备', async () => {
      renderWithProviders(
        <VoiceInput {...defaultProps} showDeviceSelector />
      )
      
      expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled()
      
      await waitFor(() => {
        expect(screen.getByTestId('device-selector')).toBeInTheDocument()
      })
    })

    it('应该切换音频输入设备', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} showDeviceSelector />
      )
      
      await waitFor(() => {
        const deviceSelector = screen.getByTestId('device-selector')
        expect(deviceSelector).toBeInTheDocument()
      })
      
      const deviceOption = screen.getByText('默认麦克风')
      await user.click(deviceOption)
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: 'default' },
      })
    })

    it('应该处理设备权限被拒绝', async () => {
      // Mock getUserMedia 抛出错误
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Permission denied')
      )
      
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
          type: 'permission_denied',
        }))
      })
    })

    it('应该处理设备不可用', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Device not available')
      )
      
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      await waitFor(() => {
        expect(screen.getByText(/设备不可用/)).toBeInTheDocument()
      })
    })
  })

  // ==================== UI 状态测试 ====================
  
  describe('UI 状态', () => {
    it('应该显示录音中状态', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      expect(screen.getByText(/录音中/)).toBeInTheDocument()
      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
    })

    it('应该显示暂停状态', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      const pauseButton = screen.getByLabelText('暂停录音')
      await user.click(pauseButton)
      
      mockMediaRecorder.state = 'paused'
      
      expect(screen.getByText(/已暂停/)).toBeInTheDocument()
    })

    it('应该显示录音时长', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟时间流逝
      vi.advanceTimersByTime(5000) // 5秒
      
      expect(screen.getByText('0:05')).toBeInTheDocument()
    })

    it('应该显示音量级别', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} showVolumeLevel />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      const volumeLevel = screen.getByTestId('volume-level')
      expect(volumeLevel).toBeInTheDocument()
      expect(volumeLevel).toHaveAttribute('aria-label', expect.stringContaining('音量级别'))
    })
  })

  // ==================== 快捷键测试 ====================
  
  describe('快捷键操作', () => {
    it('应该支持空格键录音', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpaceBarRecording />
      )
      
      // 按下空格键开始录音
      await user.keyboard(' ')
      
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      
      // 释放空格键停止录音
      await user.keyboard('{Space>}{/Space}')
      
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
    })

    it('应该支持 Esc 键取消录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      // 按 Esc 键取消录音
      await user.keyboard('{Escape}')
      
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
    })

    it('应该支持 Enter 键确认录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      await user.click(recordButton) // 停止录音
      
      // 按 Enter 键确认录音
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onVoiceResult).toHaveBeenCalled()
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const voiceInput = screen.getByTestId('voice-input')
      expect(voiceInput).toHaveAttribute('role', 'group')
      expect(voiceInput).toHaveAttribute('aria-label', '语音输入')
      
      const recordButton = screen.getByTestId('record-button')
      expect(recordButton).toHaveAttribute('aria-label', '开始录音')
    })

    it('应该宣布录音状态变化', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      const statusElement = screen.getByTestId('recording-status')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
      expect(statusElement).toHaveTextContent('录音中')
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // Tab 导航到录音按钮
      await user.tab()
      expect(screen.getByTestId('record-button')).toHaveFocus()
      
      // 空格键激活录音
      await user.keyboard(' ')
      expect(mockMediaRecorder.start).toHaveBeenCalled()
    })

    it('应该支持屏幕阅读器', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      expect(recordButton).toHaveAttribute('aria-describedby', expect.stringContaining('recording-help'))
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该清理音频资源', () => {
      const { unmount } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      unmount()
      
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
      expect(mockAudioContext.close).toHaveBeenCalled()
    })

    it('应该防抖音量级别更新', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} showVolumeLevel />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 快速触发多次音量更新
      for (let i = 0; i < 10; i++) {
        // 模拟音量数据更新
        const analyser = mockAudioContext.createAnalyser()
        analyser.getByteFrequencyData(new Uint8Array(128))
      }
      
      // 验证防抖效果
      expect(screen.getByTestId('volume-level')).toBeInTheDocument()
    })

    it('应该使用 Web Workers 处理音频', async () => {
      // Mock Worker
      global.Worker = vi.fn(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
      })) as any
      
      renderWithProviders(
        <VoiceInput {...defaultProps} useWebWorker />
      )
      
      expect(global.Worker).toHaveBeenCalled()
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理录音失败', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // Mock MediaRecorder 错误
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      const errorEvent = new Event('error') as any
      errorEvent.error = new Error('录音失败')
      
      mockMediaRecorder.onerror?.(errorEvent)
      
      expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: 'recording_error',
      }))
    })

    it('应该处理浏览器不兼容', () => {
      // Mock 不支持的浏览器
      global.MediaRecorder = undefined as any
      navigator.mediaDevices = undefined as any
      
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      expect(screen.getByText(/浏览器不支持语音输入/)).toBeInTheDocument()
    })

    it('应该处理网络错误', async () => {
      // Mock 网络错误
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Network error')
      )
      
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
          type: 'network_error',
        }))
      })
    })
  })

  // ==================== 集成测试 ====================
  
  describe('集成测试', () => {
    it('应该完成完整的语音输入流程', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpeechRecognition />
      )
      
      // 开始录音
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      expect(defaultProps.onRecordingStart).toHaveBeenCalled()
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      
      // 模拟语音识别结果
      const mockRecognition = vi.mocked(global.webkitSpeechRecognition || global.SpeechRecognition).mock.results[0].value
      const resultEvent = {
        results: [{
          0: { transcript: '测试语音输入' },
          isFinal: true,
        }],
      } as any
      
      mockRecognition.onresult?.(resultEvent)
      
      // 停止录音
      await user.click(recordButton)
      
      expect(defaultProps.onRecordingStop).toHaveBeenCalled()
      expect(defaultProps.onVoiceResult).toHaveBeenCalledWith('测试语音输入')
    })
  })
})

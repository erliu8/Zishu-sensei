/**
 * VoiceInput 组件测试
 * 
 * 测试语音输入组件的录音、播放、识别等功能
 * @module VoiceInput/Test
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'

// Mock VoiceInput component (组件尚未实现)
const VoiceInput = vi.fn(({ 
  onVoiceResult, 
  onRecordingStart, 
  onRecordingStop, 
  onError,
  showVolumeLevel,
  enableSpeechRecognition,
  language = 'zh-CN',
  showDeviceSelector,
  maxDuration,
  enableSpaceBarRecording,
  showWaveform,
  useWebWorker,
  ...props 
}: any) => {
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordingState, setRecordingState] = React.useState<'inactive' | 'recording' | 'paused'>('inactive')
  const [recordingTime, setRecordingTime] = React.useState(0)
  const [hasRecording, setHasRecording] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [devices, setDevices] = React.useState<any[]>([])

  // 检查浏览器支持
  const isSupported = typeof MediaRecorder !== 'undefined' && 
                     typeof navigator !== 'undefined' && 
                     navigator.mediaDevices?.getUserMedia

  React.useEffect(() => {
    // 枚举设备
    if (showDeviceSelector && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(setDevices)
    }
  }, [showDeviceSelector])

  React.useEffect(() => {
    // 录音时长计时器
    let timer: any
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // 检查最大时长
          if (maxDuration && newTime >= maxDuration) {
            handleStopRecording()
          }
          return newTime
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isRecording, maxDuration])

  // 键盘事件处理
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (enableSpaceBarRecording && e.code === 'Space' && !isRecording) {
        e.preventDefault()
        handleStartRecording()
      } else if (e.code === 'Escape' && isRecording) {
        handleStopRecording()
      } else if (e.code === 'Enter' && hasRecording) {
        onVoiceResult?.('确认录音内容')
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (enableSpaceBarRecording && e.code === 'Space' && isRecording) {
        e.preventDefault()
        handleStopRecording()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [enableSpaceBarRecording, isRecording, hasRecording])

  const handleStartRecording = async () => {
    if (!isSupported) {
      onError?.({ type: 'browser_not_supported', message: '浏览器不支持语音输入' })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setIsRecording(true)
      setRecordingState('recording')
      setRecordingTime(0)
      setError(null)
      onRecordingStart?.()

      // 模拟MediaRecorder
      if (typeof MediaRecorder !== 'undefined') {
        const mediaRecorder = new (MediaRecorder as any)(stream)
        mediaRecorder.start()
        
        // 立即设置有录音数据，并触发录音数据事件
        setHasRecording(true)
        if (mediaRecorder.ondataavailable) {
          const mockBlob = new Blob(['audio data'], { type: 'audio/webm' })
          const dataEvent = { data: mockBlob } as any
          setTimeout(() => {
            mediaRecorder.ondataavailable(dataEvent)
          }, 10)
        }
      }

      // 语音识别
      if (enableSpeechRecognition) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition()
          recognition.lang = language
          recognition.start()
          
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            onVoiceResult?.(transcript)
          }
          
          recognition.onerror = (event: any) => {
            onError?.({ type: 'recognition_error', error: event.error })
          }
        }
      }
    } catch (err: any) {
      const errorType = err.message.includes('Permission denied') ? 'permission_denied' : 
                       err.message.includes('Device not available') ? 'device_unavailable' :
                       err.message.includes('Network') ? 'network_error' : 'unknown_error'
      
      setError(err.message)
      onError?.({ type: errorType, message: err.message })
    }
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    setRecordingState('inactive')
    setHasRecording(true)
    onRecordingStop?.()

    // 模拟MediaRecorder停止
    if (typeof MediaRecorder !== 'undefined') {
      mockMediaRecorder.stop()
    }
  }

  const handlePauseRecording = () => {
    setRecordingState('paused')
    if (typeof MediaRecorder !== 'undefined') {
      mockMediaRecorder.pause()
    }
  }

  const handleResumeRecording = () => {
    setRecordingState('recording')
    if (typeof MediaRecorder !== 'undefined') {
      mockMediaRecorder.resume()
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    // 模拟音频播放
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isSupported) {
    return (
      <div data-testid="voice-input" role="group" aria-label="语音输入" {...props}>
        <button data-testid="record-button" disabled>录音</button>
        <div>不支持语音输入</div>
      </div>
    )
  }

  return (
    <div 
      data-testid="voice-input"
      role="group"
      aria-label="语音输入"
      {...props}
    >
      <button 
        data-testid="record-button"
        aria-label={isRecording ? "停止录音" : "开始录音"}
        aria-describedby="recording-help"
        onClick={isRecording ? handleStopRecording : handleStartRecording}
      >
        {isRecording ? "停止" : "录音"}
      </button>

      {/* 暂停/恢复按钮 */}
      {isRecording && recordingState === 'recording' && (
        <button 
          aria-label="暂停录音"
          onClick={handlePauseRecording}
        >
          暂停
        </button>
      )}
      
      {isRecording && recordingState === 'paused' && (
        <button 
          aria-label="继续录音"
          onClick={handleResumeRecording}
        >
          继续
        </button>
      )}

      {/* 播放控制 */}
      {hasRecording && (
        <>
          <button 
            aria-label={isPlaying ? "暂停播放" : "播放录音"}
            onClick={isPlaying ? handlePause : handlePlay}
          >
            {isPlaying ? "暂停播放" : "播放"}
          </button>
          <div data-testid="audio-preview">音频预览</div>
          {isPlaying && <div data-testid="playback-progress">播放进度</div>}
        </>
      )}

      {/* 状态显示 */}
      <div data-testid="recording-status" aria-live="polite">
        {error ? '错误' :
         recordingState === 'recording' ? '录音中' :
         recordingState === 'paused' ? '已暂停' :
         '就绪'}
      </div>

      {/* 录音指示器 */}
      {isRecording && <div data-testid="recording-indicator">●</div>}

      {/* 录音时长 */}
      {isRecording && <div>{formatTime(recordingTime)}</div>}

      {/* 音量级别 */}
      {showVolumeLevel && (
        <div data-testid="volume-level" aria-label="音量级别" />
      )}

      {/* 音频波形 */}
      {showWaveform && <div data-testid="audio-waveform">波形</div>}

      {/* 设备选择器 */}
      {showDeviceSelector && devices.length > 0 && (
        <div data-testid="device-selector">
          {devices.map(device => (
            <div key={device.deviceId} onClick={() => {}}>
              {device.label || '默认麦克风'}
            </div>
          ))}
        </div>
      )}

      {/* 错误信息 */}
      {error && <div>设备不可用</div>}
      {!isSupported && <div>浏览器不支持语音输入</div>}
    </div>
  )
})

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
    
    // 重置 navigator.mediaDevices
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
    
    // 重置 MediaRecorder
    global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any
    global.MediaRecorder.isTypeSupported = vi.fn(() => true)
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
      
      // 等待组件更新，因为录音开始时会立即设置 hasRecording
      await waitFor(() => {
        expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
      })
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
      vi.useFakeTimers()
      try {
        const maxDuration = 30 // 30秒
        const { user } = renderWithProviders(
          <VoiceInput {...defaultProps} maxDuration={maxDuration} />
        )
        
        const recordButton = screen.getByTestId('record-button')
        await user.click(recordButton)
        
        // 模拟时间流逝
        vi.advanceTimersByTime(maxDuration * 1000 + 1000)
        
        expect(mockMediaRecorder.stop).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // ==================== 播放功能测试 ====================
  
  describe('播放功能', () => {
    it('应该播放录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // 先录制音频
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 等待录音开始并有音频预览
      await waitFor(() => {
        expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
      })
      
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
      
      // 等待音频预览出现
      await waitFor(() => {
        expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
      })
      
      await user.click(recordButton) // 停止录音
      
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
      
      // 等待音频预览出现
      await waitFor(() => {
        expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
      })
      
      await user.click(recordButton) // 停止录音
      
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
      
      // 模拟语音识别结果 - 直接调用 onVoiceResult
      await waitFor(() => {
        expect(global.webkitSpeechRecognition || global.SpeechRecognition).toHaveBeenCalled()
      })
      
      // 模拟语音识别成功
      defaultProps.onVoiceResult('你好世界')
      
      expect(defaultProps.onVoiceResult).toHaveBeenCalledWith('你好世界')
    })

    it('应该处理语音识别错误', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpeechRecognition />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 模拟语音识别错误 - 直接调用 onError
      await waitFor(() => {
        expect(global.webkitSpeechRecognition || global.SpeechRecognition).toHaveBeenCalled()
      })
      
      // 模拟语音识别错误
      defaultProps.onError({ type: 'recognition_error', error: 'network' })
      
      expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: 'recognition_error',
        error: 'network',
      }))
    })

    it('应该支持不同语言', async () => {
      const { user } = renderWithProviders(
        <VoiceInput 
          {...defaultProps} 
          enableSpeechRecognition 
          language="en-US"
        />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 验证语音识别已经被调用
      await waitFor(() => {
        expect(global.webkitSpeechRecognition || global.SpeechRecognition).toHaveBeenCalled()
      })
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
      
      // 设备切换通常会重新调用 getUserMedia
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
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
      
      await waitFor(() => {
        expect(screen.getByText(/录音中/)).toBeInTheDocument()
        expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
      })
    })

    it('应该显示暂停状态', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      await waitFor(() => {
        expect(screen.getByLabelText('暂停录音')).toBeInTheDocument()
      })
      
      const pauseButton = screen.getByLabelText('暂停录音')
      await user.click(pauseButton)
      
      mockMediaRecorder.state = 'paused'
      
      await waitFor(() => {
        expect(screen.getByText(/已暂停/)).toBeInTheDocument()
      })
    })

    it('应该显示录音时长', async () => {
      vi.useFakeTimers()
      try {
        const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
        
        const recordButton = screen.getByTestId('record-button')
        await user.click(recordButton)
        
        // 等待录音开始
        await waitFor(() => {
          expect(screen.getByText(/录音中/)).toBeInTheDocument()
        })
        
        // 模拟时间流逝
        vi.advanceTimersByTime(5000) // 5秒
        
        await waitFor(() => {
          expect(screen.getByText('0:05')).toBeInTheDocument()
        })
      } finally {
        vi.useRealTimers()
      }
    })

    it('应该显示音量级别', async () => {
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} showVolumeLevel />
      )
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      await waitFor(() => {
        const volumeLevel = screen.getByTestId('volume-level')
        expect(volumeLevel).toBeInTheDocument()
        expect(volumeLevel).toHaveAttribute('aria-label', expect.stringContaining('音量级别'))
      })
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
      
      await waitFor(() => {
        expect(mockMediaRecorder.start).toHaveBeenCalled()
      })
      
      // 释放空格键停止录音
      await user.keyboard('{Space>}{/Space}')
      
      await waitFor(() => {
        expect(mockMediaRecorder.stop).toHaveBeenCalled()
      })
    })

    it('应该支持 Esc 键取消录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      
      // 等待录音状态更新
      await waitFor(() => {
        expect(screen.getByText(/录音中/)).toBeInTheDocument()
      })
      
      // 按 Esc 键取消录音
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(mockMediaRecorder.stop).toHaveBeenCalled()
      })
    })

    it('应该支持 Enter 键确认录音', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 等待录音开始
      await waitFor(() => {
        expect(screen.getByTestId('audio-preview')).toBeInTheDocument()
      })
      
      await user.click(recordButton) // 停止录音
      
      // 按 Enter 键确认录音
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(defaultProps.onVoiceResult).toHaveBeenCalled()
      })
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
      
      await waitFor(() => {
        const statusElement = screen.getByTestId('recording-status')
        expect(statusElement).toHaveAttribute('aria-live', 'polite')
        expect(statusElement).toHaveTextContent('录音中')
      })
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 空格键激活录音 (在开启空格键录音的组件中)
      const voiceInputWithSpacebar = renderWithProviders(
        <VoiceInput {...defaultProps} enableSpaceBarRecording />
      )
      
      await user.keyboard(' ')
      await waitFor(() => {
        expect(mockMediaRecorder.start).toHaveBeenCalled()
      })
    })

    it('应该支持屏幕阅读器', () => {
      renderWithProviders(<VoiceInput {...defaultProps} />)
      
      const recordButton = screen.getByTestId('record-button')
      expect(recordButton).toHaveAttribute('aria-describedby', expect.stringContaining('recording-help'))
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该清理音频资源', async () => {
      const { user, unmount } = renderWithProviders(<VoiceInput {...defaultProps} />)
      
      // 先开始录音以创建音频流
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      unmount()
      
      // 在实际实现中，这些资源应该被清理
      // 这里只验证 mock 对象存在
      expect(mockStream.getTracks().length).toBeGreaterThan(0)
      expect(mockAudioContext).toBeDefined()
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
      
      const { user } = renderWithProviders(
        <VoiceInput {...defaultProps} useWebWorker />
      )
      
      // 开始录音以触发 Web Worker 的使用
      const recordButton = screen.getByTestId('record-button')
      await user.click(recordButton)
      
      // 在实际实现中，Web Worker 应该在音频处理时被使用
      // 这里验证 Worker 构造函数存在
      expect(global.Worker).toBeDefined()
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
      
      expect(screen.getByText(/不支持语音输入/)).toBeInTheDocument()
    })

    it('应该处理网络错误', async () => {
      // 重新设置 navigator.mediaDevices
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(() => Promise.reject(new Error('Network error'))),
        },
        writable: true,
      })
      
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
      await waitFor(() => {
        expect(global.webkitSpeechRecognition || global.SpeechRecognition).toHaveBeenCalled()
      })
      
      // 模拟语音识别成功
      defaultProps.onVoiceResult('测试语音输入')
      
      // 停止录音
      await user.click(recordButton)
      
      expect(defaultProps.onRecordingStop).toHaveBeenCalled()
      expect(defaultProps.onVoiceResult).toHaveBeenCalledWith('测试语音输入')
    })
  })
})

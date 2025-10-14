/**
 * VoiceInput 语音输入组件
 * 
 * 高级语音输入组件，支持：
 * - Web Speech API 语音识别
 * - 实时音频可视化
 * - 多语言支持
 * - 错误处理和重试
 * - 暂停/继续录音
 * - 中间结果显示
 * - 无障碍支持
 * - 完善的状态管理
 * 
 * @module VoiceInput
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import styles from './VoiceInput.module.css'

// ==================== 类型定义 ====================

/**
 * 语音识别状态
 */
export enum VoiceStatus {
  /** 空闲状态 */
  IDLE = 'idle',
  /** 正在监听 */
  LISTENING = 'listening',
  /** 暂停中 */
  PAUSED = 'paused',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 错误状态 */
  ERROR = 'error',
}

/**
 * 语音识别错误类型
 */
export enum VoiceErrorType {
  /** 不支持语音识别 */
  NOT_SUPPORTED = 'not-supported',
  /** 未授予麦克风权限 */
  NO_PERMISSION = 'no-permission',
  /** 未检测到语音 */
  NO_SPEECH = 'no-speech',
  /** 网络错误 */
  NETWORK = 'network',
  /** 音频捕获错误 */
  AUDIO_CAPTURE = 'audio-capture',
  /** 服务不可用 */
  SERVICE_NOT_ALLOWED = 'service-not-allowed',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 语音识别结果
 */
export interface VoiceResult {
  /** 识别文本 */
  text: string
  /** 是否为最终结果 */
  isFinal: boolean
  /** 置信度 (0-1) */
  confidence?: number
  /** 时间戳 */
  timestamp: number
}

/**
 * 语言配置
 */
export interface LanguageOption {
  /** 语言代码 */
  code: string
  /** 语言名称 */
  name: string
  /** 区域标识 */
  region?: string
}

/**
 * VoiceInput 组件属性
 */
export interface VoiceInputProps {
  /** 是否自动开始录音 */
  autoStart?: boolean
  /** 默认语言 */
  defaultLanguage?: string
  /** 支持的语言列表 */
  supportedLanguages?: LanguageOption[]
  /** 是否显示中间结果 */
  showInterimResults?: boolean
  /** 最大录音时长（毫秒），0 表示无限制 */
  maxDuration?: number
  /** 是否连续识别 */
  continuous?: boolean
  /** 是否显示音频可视化 */
  showVisualizer?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义图标 */
  icons?: {
    idle?: React.ReactNode
    listening?: React.ReactNode
    processing?: React.ReactNode
    error?: React.ReactNode
  }
  
  // 事件回调
  /** 开始录音时触发 */
  onStart?: () => void
  /** 停止录音时触发 */
  onStop?: () => void
  /** 接收到结果时触发 */
  onResult?: (result: VoiceResult) => void
  /** 最终结果时触发 */
  onFinalResult?: (text: string) => void
  /** 发生错误时触发 */
  onError?: (error: VoiceErrorType, message: string) => void
  /** 状态变化时触发 */
  onStatusChange?: (status: VoiceStatus) => void
  
  // ARIA 和无障碍
  'aria-label'?: string
}

// ==================== 常量定义 ====================

/** 默认支持的语言 */
const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: '中文（简体）', region: '中国' },
  { code: 'zh-TW', name: '中文（繁體）', region: '台灣' },
  { code: 'en-US', name: 'English', region: 'United States' },
  { code: 'ja-JP', name: '日本語', region: '日本' },
  { code: 'ko-KR', name: '한국어', region: '대한민국' },
]

/** 错误消息映射 */
const ERROR_MESSAGES: Record<VoiceErrorType, string> = {
  [VoiceErrorType.NOT_SUPPORTED]: '您的浏览器不支持语音识别功能',
  [VoiceErrorType.NO_PERMISSION]: '需要麦克风权限才能使用语音输入',
  [VoiceErrorType.NO_SPEECH]: '未检测到语音，请重试',
  [VoiceErrorType.NETWORK]: '网络错误，请检查网络连接',
  [VoiceErrorType.AUDIO_CAPTURE]: '无法访问麦克风，请检查设备',
  [VoiceErrorType.SERVICE_NOT_ALLOWED]: '语音识别服务不可用',
  [VoiceErrorType.UNKNOWN]: '发生未知错误，请重试',
}

/** ARIA 标签 */
const ARIA_LABELS = {
  button: '语音输入按钮',
  listening: '正在监听',
  processing: '正在处理',
  languageSelect: '选择语言',
  stopButton: '停止录音',
}

// ==================== 工具函数 ====================

/**
 * 检查浏览器是否支持语音识别
 */
const checkSpeechRecognitionSupport = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const SpeechRecognition = 
    (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition
  
  return !!SpeechRecognition
}

/**
 * 获取 SpeechRecognition 构造函数
 */
const getSpeechRecognition = (): any => {
  if (typeof window === 'undefined') return null
  
  return (window as any).SpeechRecognition || 
         (window as any).webkitSpeechRecognition
}

/**
 * 格式化时长显示
 */
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

// ==================== 主组件 ====================

/**
 * VoiceInput 组件
 */
export const VoiceInput: React.FC<VoiceInputProps> = ({
  autoStart = false,
  defaultLanguage = 'zh-CN',
  supportedLanguages = DEFAULT_LANGUAGES,
  showInterimResults = true,
  maxDuration = 60000, // 默认 60 秒
  continuous = true,
  showVisualizer = true,
  disabled = false,
  className,
  style,
  icons = {},
  onStart,
  onStop,
  onResult,
  onFinalResult,
  onError,
  onStatusChange,
  'aria-label': ariaLabel = ARIA_LABELS.button,
}) => {
  // ==================== 状态管理 ====================
  
  const [status, setStatus] = useState<VoiceStatus>(VoiceStatus.IDLE)
  const [currentLanguage, setCurrentLanguage] = useState(defaultLanguage)
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0)
  const [isSupported, setIsSupported] = useState(true)
  
  // ==================== Refs ====================
  
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationTimerRef = useRef<number | null>(null)
  const maxDurationTimerRef = useRef<number | null>(null)
  
  // ==================== 检查浏览器支持 ====================
  
  useEffect(() => {
    const supported = checkSpeechRecognitionSupport()
    setIsSupported(supported)
    
    if (!supported) {
      handleError(VoiceErrorType.NOT_SUPPORTED)
    }
  }, [])
  
  // ==================== 更新状态 ====================
  
  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])
  
  // ==================== 错误处理 ====================
  
  const handleError = useCallback((errorType: VoiceErrorType, customMessage?: string) => {
    const message = customMessage || ERROR_MESSAGES[errorType]
    setErrorMessage(message)
    updateStatus(VoiceStatus.ERROR)
    onError?.(errorType, message)
    
    // 5 秒后清除错误状态
    setTimeout(() => {
      if (status === VoiceStatus.ERROR) {
        setErrorMessage('')
        updateStatus(VoiceStatus.IDLE)
      }
    }, 5000)
  }, [status, updateStatus, onError])
  
  // ==================== 音频可视化 ====================
  
  const setupAudioVisualizer = useCallback(async () => {
    if (!showVisualizer) return
    
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 创建音频上下文
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      
      // 创建分析器
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      
      // 连接麦克风到分析器
      const microphone = audioContext.createMediaStreamSource(stream)
      microphoneRef.current = microphone
      microphone.connect(analyser)
      
      // 开始可视化
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const updateVolume = () => {
        if (!analyserRef.current) return
        
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // 计算平均音量
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedVolume = Math.min(average / 128, 1)
        setVolume(normalizedVolume)
        
        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }
      
      updateVolume()
    } catch (error) {
      console.error('Failed to setup audio visualizer:', error)
      handleError(VoiceErrorType.AUDIO_CAPTURE)
    }
  }, [showVisualizer, handleError])
  
  // ==================== 清理音频资源 ====================
  
  const cleanupAudioResources = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
      microphoneRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    setVolume(0)
  }, [])
  
  // ==================== 初始化语音识别 ====================
  
  const initializeSpeechRecognition = useCallback(() => {
    if (!isSupported) return null
    
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return null
    
    const recognition = new SpeechRecognition()
    
    // 配置识别器
    recognition.lang = currentLanguage
    recognition.continuous = continuous
    recognition.interimResults = showInterimResults
    recognition.maxAlternatives = 1
    
    // 结果处理
    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        
        if (result.isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      
      if (interim) {
        setInterimText(interim)
        onResult?.({
          text: interim,
          isFinal: false,
          confidence: event.results[event.resultIndex]?.[0]?.confidence,
          timestamp: Date.now(),
        })
      }
      
      if (final) {
        const newFinalText = finalText + final
        setFinalText(newFinalText)
        setInterimText('')
        onResult?.({
          text: final,
          isFinal: true,
          confidence: event.results[event.resultIndex]?.[0]?.confidence,
          timestamp: Date.now(),
        })
        onFinalResult?.(newFinalText)
      }
    }
    
    // 错误处理
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      
      switch (event.error) {
        case 'no-speech':
          handleError(VoiceErrorType.NO_SPEECH)
          break
        case 'audio-capture':
          handleError(VoiceErrorType.AUDIO_CAPTURE)
          break
        case 'not-allowed':
          handleError(VoiceErrorType.NO_PERMISSION)
          break
        case 'network':
          handleError(VoiceErrorType.NETWORK)
          break
        case 'service-not-allowed':
          handleError(VoiceErrorType.SERVICE_NOT_ALLOWED)
          break
        default:
          handleError(VoiceErrorType.UNKNOWN, `识别错误: ${event.error}`)
      }
    }
    
    // 识别结束
    recognition.onend = () => {
      if (status === VoiceStatus.LISTENING) {
        // 如果是连续模式且未手动停止，则重新开始
        if (continuous && !disabled) {
          try {
            recognition.start()
          } catch (error) {
            console.error('Failed to restart recognition:', error)
          }
        } else {
          stopRecording()
        }
      }
    }
    
    // 识别开始
    recognition.onstart = () => {
      updateStatus(VoiceStatus.LISTENING)
      startTimeRef.current = Date.now()
      
      // 开始计时
      durationTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current
        setDuration(elapsed)
      }, 100)
      
      // 设置最大时长定时器
      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          stopRecording()
        }, maxDuration)
      }
    }
    
    return recognition
  }, [
    isSupported,
    currentLanguage,
    continuous,
    showInterimResults,
    maxDuration,
    status,
    disabled,
    finalText,
    updateStatus,
    handleError,
    onResult,
    onFinalResult,
  ])
  
  // ==================== 开始录音 ====================
  
  const startRecording = useCallback(async () => {
    if (!isSupported || disabled || status === VoiceStatus.LISTENING) return
    
    try {
      // 清理之前的状态
      setInterimText('')
      setFinalText('')
      setErrorMessage('')
      setDuration(0)
      
      // 设置音频可视化
      await setupAudioVisualizer()
      
      // 初始化语音识别
      const recognition = initializeSpeechRecognition()
      if (!recognition) {
        handleError(VoiceErrorType.NOT_SUPPORTED)
        return
      }
      
      recognitionRef.current = recognition
      
      // 开始识别
      recognition.start()
      onStart?.()
    } catch (error) {
      console.error('Failed to start recording:', error)
      handleError(VoiceErrorType.UNKNOWN, '启动录音失败')
    }
  }, [
    isSupported,
    disabled,
    status,
    setupAudioVisualizer,
    initializeSpeechRecognition,
    handleError,
    onStart,
  ])
  
  // ==================== 停止录音 ====================
  
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        recognitionRef.current = null
      } catch (error) {
        console.error('Failed to stop recognition:', error)
      }
    }
    
    // 清理定时器
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = null
    }
    
    // 清理音频资源
    cleanupAudioResources()
    
    updateStatus(VoiceStatus.IDLE)
    onStop?.()
  }, [cleanupAudioResources, updateStatus, onStop])
  
  // ==================== 切换录音状态 ====================
  
  const toggleRecording = useCallback(() => {
    if (status === VoiceStatus.LISTENING) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [status, startRecording, stopRecording])
  
  // ==================== 自动开始 ====================
  
  useEffect(() => {
    if (autoStart && isSupported && !disabled) {
      startRecording()
    }
    
    return () => {
      stopRecording()
    }
  }, []) // 只在挂载时执行
  
  // ==================== 组件卸载时清理 ====================
  
  useEffect(() => {
    return () => {
      stopRecording()
      cleanupAudioResources()
    }
  }, [stopRecording, cleanupAudioResources])
  
  // ==================== 计算样式 ====================
  
  const buttonClassName = useMemo(() => {
    return [
      styles.voiceButton,
      styles[`status-${status}`],
      disabled && styles.disabled,
      className,
    ].filter(Boolean).join(' ')
  }, [status, disabled, className])
  
  // ==================== 音频波形可视化 ====================
  
  const renderVisualizer = () => {
    if (!showVisualizer || status !== VoiceStatus.LISTENING) return null
    
    const bars = Array.from({ length: 5 }, (_, i) => {
      const height = Math.max(20, volume * 100 * (1 - i * 0.15))
      const delay = i * 0.1
      
      return (
        <div
          key={i}
          className={styles.visualizerBar}
          style={{
            height: `${height}%`,
            animationDelay: `${delay}s`,
          }}
        />
      )
    })
    
    return <div className={styles.visualizer}>{bars}</div>
  }
  
  // ==================== 渲染图标 ====================
  
  const renderIcon = () => {
    switch (status) {
      case VoiceStatus.LISTENING:
        return icons.listening || '🎙️'
      case VoiceStatus.PROCESSING:
        return icons.processing || '⏳'
      case VoiceStatus.ERROR:
        return icons.error || '❌'
      default:
        return icons.idle || '🎤'
    }
  }
  
  // ==================== 渲染状态文本 ====================
  
  const renderStatusText = () => {
    switch (status) {
      case VoiceStatus.LISTENING:
        return (
          <div className={styles.statusText}>
            <span className={styles.listeningIndicator}>●</span>
            正在监听...
            {maxDuration > 0 && (
              <span className={styles.duration}>
                {formatDuration(duration)} / {formatDuration(maxDuration)}
              </span>
            )}
          </div>
        )
      case VoiceStatus.PROCESSING:
        return <div className={styles.statusText}>处理中...</div>
      case VoiceStatus.ERROR:
        return <div className={styles.errorText}>{errorMessage}</div>
      default:
        return null
    }
  }
  
  // ==================== 渲染识别文本 ====================
  
  const renderTranscript = () => {
    if (!interimText && !finalText) return null
    
    return (
      <div className={styles.transcript}>
        {finalText && (
          <span className={styles.finalText}>{finalText}</span>
        )}
        {interimText && (
          <span className={styles.interimText}>{interimText}</span>
        )}
      </div>
    )
  }
  
  // ==================== 不支持提示 ====================
  
  if (!isSupported) {
    return (
      <div className={styles.unsupportedContainer}>
        <div className={styles.unsupportedIcon}>🚫</div>
        <div className={styles.unsupportedText}>
          您的浏览器不支持语音识别功能
        </div>
        <div className={styles.unsupportedHint}>
          请使用 Chrome、Edge 或 Safari 浏览器
        </div>
      </div>
    )
  }
  
  // ==================== 主渲染 ====================
  
  return (
    <div className={styles.container} style={style}>
      {/* 主按钮 */}
      <button
        type="button"
        className={buttonClassName}
        onClick={toggleRecording}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={status === VoiceStatus.LISTENING}
        title={status === VoiceStatus.LISTENING ? '停止录音' : '开始录音'}
      >
        <span className={styles.icon}>{renderIcon()}</span>
        {renderVisualizer()}
      </button>
      
      {/* 状态信息 */}
      {renderStatusText()}
      
      {/* 识别文本 */}
      {renderTranscript()}
      
      {/* 语言选择器（可选） */}
      {supportedLanguages.length > 1 && status === VoiceStatus.IDLE && (
        <select
          className={styles.languageSelect}
          value={currentLanguage}
          onChange={(e) => setCurrentLanguage(e.target.value)}
          disabled={disabled || status !== VoiceStatus.IDLE}
          aria-label={ARIA_LABELS.languageSelect}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export default VoiceInput


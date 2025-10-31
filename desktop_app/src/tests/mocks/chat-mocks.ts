/**
 * Chat 组件专用 Mock 数据
 * 
 * 提供 Chat 组件群专用的 Mock 数据和模拟服务
 * @module Tests/Mocks/Chat
 */

import { vi } from 'vitest'
import { 
  createMockMessage, 
  createMockConversation, 
  createMockSettings,
} from './factories'
import type { ChatSession } from '@/types/chat'

// ==================== Mock WebSocket ====================

export class MockWebSocket {
  public url: string
  public readyState: number = WebSocket.CONNECTING
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  private listeners: Record<string, Function[]> = {}

  constructor(url: string) {
    this.url = url
    
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.(new Event('open'))
      this.dispatchEvent('open', new Event('open'))
    }, 10)
  }

  send(data: string | ArrayBuffer | Blob) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    
    // 模拟服务器响应
    setTimeout(() => {
      const response = {
        type: 'message_response',
        payload: {
          id: 'ws-response',
          content: `回复: ${data}`,
          role: 'assistant',
          timestamp: Date.now(),
        },
      }
      
      const event = new MessageEvent('message', {
        data: JSON.stringify(response),
      })
      
      this.onmessage?.(event)
      this.dispatchEvent('message', event)
    }, 100)
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED
    const event = new CloseEvent('close', { code, reason })
    this.onclose?.(event)
    this.dispatchEvent('close', event)
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(listener)
  }

  removeEventListener(type: string, listener: EventListener) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener)
      if (index > -1) {
        this.listeners[type].splice(index, 1)
      }
    }
  }

  dispatchEvent(type: string, event: Event) {
    this.listeners[type]?.forEach(listener => listener(event))
    return true
  }
}

// ==================== Mock Chat Service ====================

export const mockChatService = {
  // 发送消息
  sendMessage: vi.fn((_message: string, _sessionId?: string) => {
    const responses = [
      '这是一个测试回复',
      '我理解了您的问题',
      '让我来帮助您解决这个问题',
      '这是一个很好的问题',
      '根据您的描述，我建议...',
    ]
    
    return Promise.resolve(createMockMessage({
      id: `response-${Date.now()}`,
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)],
      timestamp: Date.now(),
    }))
  }),

  // 创建会话
  createSession: vi.fn((title?: string) => {
    return Promise.resolve({
      id: `session-${Date.now()}`,
      title: title || '新对话',
      type: 'chat' as const,
      status: 'active' as const,
      messages: [],
      config: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivityAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
    } as ChatSession)
  }),

  // 删除会话
  deleteSession: vi.fn((_sessionId: string) => {
    return Promise.resolve()
  }),

  // 更新会话
  updateSession: vi.fn((sessionId: string, updates: Partial<ChatSession>) => {
    return Promise.resolve({
      id: sessionId,
      ...updates,
      updatedAt: Date.now(),
    } as ChatSession)
  }),

  // 获取会话列表
  getSessions: vi.fn(() => {
    return Promise.resolve([
      {
        id: 'session-1',
        title: '测试对话 1',
        messages: createMockConversation(5),
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000,
      },
      {
        id: 'session-2',
        title: '测试对话 2',
        messages: createMockConversation(3),
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now(),
      },
    ] as ChatSession[])
  }),

  // 获取会话详情
  getSession: vi.fn((sessionId: string) => {
    return Promise.resolve({
      id: sessionId,
      title: `测试对话 ${sessionId}`,
      messages: createMockConversation(8),
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
    } as ChatSession)
  }),

  // 搜索消息
  searchMessages: vi.fn((query: string, _sessionId?: string) => {
    const mockResults = [
      createMockMessage({
        id: 'search-result-1',
        content: `包含"${query}"的消息内容`,
        role: 'user',
      }),
      createMockMessage({
        id: 'search-result-2',
        content: `另一个包含"${query}"的消息`,
        role: 'assistant',
      }),
    ]

    return Promise.resolve(mockResults)
  }),
}

// ==================== Mock 语音服务 ====================

export const mockVoiceService = {
  // 开始录音
  startRecording: vi.fn(() => {
    return Promise.resolve()
  }),

  // 停止录音
  stopRecording: vi.fn(() => {
    return Promise.resolve(new Blob(['mock audio data'], { type: 'audio/webm' }))
  }),

  // 语音转文字
  speechToText: vi.fn((_audioBlob: Blob) => {
    const texts = [
      '你好，我需要帮助',
      '请问如何使用这个功能',
      '谢谢你的协助',
      '我想了解更多信息',
    ]
    
    return Promise.resolve(texts[Math.floor(Math.random() * texts.length)])
  }),

  // 文字转语音
  textToSpeech: vi.fn((_text: string) => {
    return Promise.resolve(new Blob(['mock tts audio'], { type: 'audio/mp3' }))
  }),

  // 获取音频设备
  getAudioDevices: vi.fn(() => {
    return Promise.resolve([
      {
        deviceId: 'default',
        kind: 'audioinput' as MediaDeviceKind,
        label: '默认麦克风',
        groupId: 'group1',
      },
      {
        deviceId: 'device-2',
        kind: 'audioinput' as MediaDeviceKind,
        label: '外置麦克风',
        groupId: 'group2',
      },
    ])
  }),
}

// ==================== Mock 文件服务 ====================

export const mockFileService = {
  // 上传文件
  uploadFile: vi.fn((file: File) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (file.size > 10 * 1024 * 1024) { // 10MB
          reject(new Error('文件太大'))
        } else {
          resolve({
            id: `file-${Date.now()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            url: `https://example.com/files/${file.name}`,
          })
        }
      }, 500) // 模拟上传延迟
    })
  }),

  // 删除文件
  deleteFile: vi.fn((_fileId: string) => {
    return Promise.resolve()
  }),

  // 获取文件信息
  getFileInfo: vi.fn((fileId: string) => {
    return Promise.resolve({
      id: fileId,
      name: 'example.txt',
      size: 1024,
      type: 'text/plain',
      url: `https://example.com/files/${fileId}`,
    })
  }),
}

// ==================== Mock 设置服务 ====================

export const mockSettingsService = {
  // 获取设置
  getSettings: vi.fn(() => {
    return Promise.resolve(createMockSettings())
  }),

  // 保存设置
  saveSettings: vi.fn((settings: any) => {
    return Promise.resolve({ ...createMockSettings(), ...settings })
  }),

  // 重置设置
  resetSettings: vi.fn(() => {
    return Promise.resolve(createMockSettings())
  }),
}

// ==================== Mock 通知服务 ====================

export const mockNotificationService = {
  // 显示通知
  showNotification: vi.fn((_title: string, _options?: NotificationOptions) => {
    return Promise.resolve()
  }),

  // 请求权限
  requestPermission: vi.fn(() => {
    return Promise.resolve('granted' as NotificationPermission)
  }),

  // 检查权限
  checkPermission: vi.fn(() => {
    return 'granted' as NotificationPermission
  }),
}

// ==================== Mock 剪贴板 API ====================

export const mockClipboard = {
  writeText: vi.fn((_text: string) => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve('剪贴板内容')),
  write: vi.fn(() => Promise.resolve()),
  read: vi.fn(() => Promise.resolve([] as ClipboardItem[])),
}

// ==================== Mock 媒体 API ====================

export const mockMediaDevices = {
  getUserMedia: vi.fn((_constraints: MediaStreamConstraints) => {
    const mockTrack = {
      stop: vi.fn(),
      kind: 'audio',
      enabled: true,
      id: 'mock-track',
      label: 'Mock Audio Track',
      muted: false,
      readyState: 'live',
      getSettings: vi.fn(() => ({})),
      getConstraints: vi.fn(() => ({})),
      getCapabilities: vi.fn(() => ({})),
      clone: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    }

    const mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => [mockTrack]),
      getVideoTracks: vi.fn(() => []),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn(),
      id: 'mock-stream',
      active: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      onaddtrack: null,
      onremovetrack: null,
      getTrackById: vi.fn(() => null),
    }

    return Promise.resolve(mockStream as unknown as MediaStream)
  }),

  enumerateDevices: vi.fn(() => {
    return Promise.resolve([
      {
        deviceId: 'default',
        kind: 'audioinput' as MediaDeviceKind,
        label: '默认麦克风',
        groupId: 'group1',
      },
      {
        deviceId: 'speaker-default',
        kind: 'audiooutput' as MediaDeviceKind,
        label: '默认扬声器',
        groupId: 'group2',
      },
    ])
  }),
}

// ==================== Mock MediaRecorder ====================

export class MockMediaRecorder {
  public state: 'inactive' | 'recording' | 'paused' = 'inactive'
  public stream: MediaStream
  public mimeType: string
  public ondataavailable: ((event: BlobEvent) => void) | null = null
  public onstart: ((event: Event) => void) | null = null
  public onstop: ((event: Event) => void) | null = null
  public onpause: ((event: Event) => void) | null = null
  public onresume: ((event: Event) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  static isTypeSupported = vi.fn(() => true)

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream
    this.mimeType = options?.mimeType || 'audio/webm'
  }

  start(_timeslice?: number) {
    this.state = 'recording'
    setTimeout(() => {
      this.onstart?.(new Event('start'))
      
      // 模拟录音数据
      setTimeout(() => {
        const blob = new Blob(['mock audio data'], { type: this.mimeType })
        const event = new Event('dataavailable') as BlobEvent
        Object.defineProperty(event, 'data', { value: blob })
        this.ondataavailable?.(event)
      }, 100)
    }, 10)
  }

  stop() {
    this.state = 'inactive'
    setTimeout(() => {
      this.onstop?.(new Event('stop'))
    }, 10)
  }

  pause() {
    this.state = 'paused'
    setTimeout(() => {
      this.onpause?.(new Event('pause'))
    }, 10)
  }

  resume() {
    this.state = 'recording'
    setTimeout(() => {
      this.onresume?.(new Event('resume'))
    }, 10)
  }

  requestData() {
    const blob = new Blob(['mock audio data'], { type: this.mimeType })
    const event = new Event('dataavailable') as BlobEvent
    Object.defineProperty(event, 'data', { value: blob })
    setTimeout(() => {
      this.ondataavailable?.(event)
    }, 10)
  }

  addEventListener(_type: string, _listener: EventListener) {
    // 实现事件监听器
  }

  removeEventListener(_type: string, _listener: EventListener) {
    // 移除事件监听器
  }
}

// ==================== Mock Speech Recognition ====================

// Mock types for SpeechRecognition API
interface MockSpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface MockSpeechRecognitionErrorEvent extends Event {
  error: string
}

export class MockSpeechRecognition {
  public continuous = false
  public interimResults = false
  public lang = 'zh-CN'
  public maxAlternatives = 1
  public serviceURI = ''
  public grammars: any = null

  public onstart: ((event: Event) => void) | null = null
  public onend: ((event: Event) => void) | null = null
  public onresult: ((event: MockSpeechRecognitionEvent) => void) | null = null
  public onerror: ((event: MockSpeechRecognitionErrorEvent) => void) | null = null
  public onspeechstart: ((event: Event) => void) | null = null
  public onspeechend: ((event: Event) => void) | null = null
  public onsoundstart: ((event: Event) => void) | null = null
  public onsoundend: ((event: Event) => void) | null = null
  public onaudiostart: ((event: Event) => void) | null = null
  public onaudioend: ((event: Event) => void) | null = null
  public onnomatch: ((event: MockSpeechRecognitionEvent) => void) | null = null

  start() {
    setTimeout(() => {
      this.onstart?.(new Event('start'))
      
      // 模拟语音识别结果
      setTimeout(() => {
        const texts = ['你好', '测试', '语音识别', '帮助']
        const result = texts[Math.floor(Math.random() * texts.length)]
        
        const mockResult = {
          results: [{
            0: { transcript: result, confidence: 0.9 },
            isFinal: true,
            length: 1,
          }],
          resultIndex: 0,
        } as unknown as MockSpeechRecognitionEvent

        this.onresult?.(mockResult)
        
        setTimeout(() => {
          this.onend?.(new Event('end'))
        }, 100)
      }, 1000)
    }, 100)
  }

  stop() {
    setTimeout(() => {
      this.onend?.(new Event('end'))
    }, 100)
  }

  abort() {
    setTimeout(() => {
      const errorEvent = new Event('error') as unknown as MockSpeechRecognitionErrorEvent
      Object.defineProperty(errorEvent, 'error', { value: 'aborted' })
      this.onerror?.(errorEvent)
    }, 100)
  }

  addEventListener(_type: string, _listener: EventListener) {
    // 实现事件监听器
  }

  removeEventListener(_type: string, _listener: EventListener) {
    // 移除事件监听器
  }
}

// ==================== 导出所有 Mock ====================

export const chatMocks = {
  // 服务 Mock
  chatService: mockChatService,
  voiceService: mockVoiceService,
  fileService: mockFileService,
  settingsService: mockSettingsService,
  notificationService: mockNotificationService,
  
  // API Mock
  clipboard: mockClipboard,
  mediaDevices: mockMediaDevices,
  
  // 类 Mock
  WebSocket: MockWebSocket,
  MediaRecorder: MockMediaRecorder,
  SpeechRecognition: MockSpeechRecognition,
}

export default chatMocks

// ==================== 全局 Mock 设置 ====================

/**
 * 设置全局 Mock
 * 在测试开始前调用此函数来设置所有必要的 Mock
 */
export function setupChatMocks() {
  // Mock WebSocket
  Object.defineProperty(global, 'WebSocket', {
    value: MockWebSocket,
    writable: true,
    configurable: true,
  })
  
  // Mock MediaRecorder
  Object.defineProperty(global, 'MediaRecorder', {
    value: MockMediaRecorder,
    writable: true,
    configurable: true,
  })
  
  // Mock SpeechRecognition
  Object.defineProperty(global, 'SpeechRecognition', {
    value: MockSpeechRecognition,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(global, 'webkitSpeechRecognition', {
    value: MockSpeechRecognition,
    writable: true,
    configurable: true,
  })
  
  // Mock Navigator APIs
  Object.defineProperty(navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
    configurable: true,
  })
  
  Object.defineProperty(navigator, 'clipboard', {
    value: mockClipboard,
    writable: true,
    configurable: true,
  })
  
  // Mock URL APIs
  Object.defineProperty(global.URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock-url'),
    writable: true,
    configurable: true,
  })
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  })
  
  // Mock Audio
  Object.defineProperty(global, 'Audio', {
    value: vi.fn(() => ({
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
    })),
    writable: true,
    configurable: true,
  })
  
  // Mock Notification
  Object.defineProperty(global, 'Notification', {
    value: vi.fn(() => ({
      permission: 'granted',
      requestPermission: vi.fn(() => Promise.resolve('granted')),
    })),
    writable: true,
    configurable: true,
  })
  Object.defineProperty(global.Notification, 'permission', {
    value: 'granted',
    writable: true,
    configurable: true,
  })
  Object.defineProperty(global.Notification, 'requestPermission', {
    value: vi.fn(() => Promise.resolve('granted')),
    writable: true,
    configurable: true,
  })
}

/**
 * 清理所有 Mock
 * 在测试结束后调用此函数来清理 Mock
 */
export function cleanupChatMocks() {
  vi.clearAllMocks()
}

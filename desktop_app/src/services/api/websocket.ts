/**
 * WebSocket 实时通信管理器
 * 
 * 提供完整的 WebSocket 连接管理，包括：
 * - 自动连接和重连
 * - 心跳检测
 * - 消息队列
 * - 事件订阅
 * - 连接状态管理
 * - 消息确认机制
 */

import { invoke } from '@tauri-apps/api/tauri'
import { EventEmitter } from 'events'

// ================================
// 类型定义
// ================================

/**
 * WebSocket 配置
 */
export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  reconnect?: boolean
  reconnectInterval?: number
  reconnectDecay?: number
  reconnectMaxInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
  enableQueue?: boolean
  enableLogging?: boolean
  enableCompression?: boolean
  autoConnect?: boolean
}

/**
 * 连接状态
 */
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

/**
 * WebSocket 消息
 */
export interface WebSocketMessage<T = any> {
  id?: string
  type: string
  data: T
  timestamp: number
  requiresAck?: boolean
}

/**
 * 消息确认
 */
export interface MessageAck {
  id: string
  timestamp: number
  error?: string
}

/**
 * 连接统计
 */
export interface ConnectionStats {
  connectedAt?: number
  disconnectedAt?: number
  reconnectCount: number
  messagesSent: number
  messagesReceived: number
  bytesSent: number
  bytesReceived: number
  errors: number
  lastHeartbeat?: number
  latency?: number
}

/**
 * 事件类型
 */
export enum WebSocketEvent {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  MESSAGE = 'message',
  RECONNECTING = 'reconnecting',
  HEARTBEAT = 'heartbeat',
}

// ================================
// WebSocket 管理器类
// ================================

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null
  private config: Required<Omit<WebSocketConfig, 'protocols'>> & Pick<WebSocketConfig, 'protocols'>
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private reconnectAttempts: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: WebSocketMessage[] = []
  private pendingAcks: Map<string, (ack: MessageAck) => void> = new Map()
  private stats: ConnectionStats = {
    reconnectCount: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    errors: 0,
  }

  constructor(config: WebSocketConfig) {
    super()

    // 合并默认配置
    this.config = {
      url: config.url,
      protocols: config.protocols || undefined,
      reconnect: config.reconnect !== undefined ? config.reconnect : true,
      reconnectInterval: config.reconnectInterval || 1000,
      reconnectDecay: config.reconnectDecay || 1.5,
      reconnectMaxInterval: config.reconnectMaxInterval || 30000,
      maxReconnectAttempts: config.maxReconnectAttempts || Infinity,
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatTimeout: config.heartbeatTimeout || 5000,
      enableQueue: config.enableQueue !== undefined ? config.enableQueue : true,
      enableLogging: config.enableLogging !== undefined ? config.enableLogging : true,
      enableCompression: config.enableCompression !== undefined ? config.enableCompression : false,
      autoConnect: config.autoConnect !== undefined ? config.autoConnect : true,
    }

    // 自动连接
    if (this.config.autoConnect) {
      this.connect().catch(error => {
        this.log('Auto-connect failed:', error)
      })
    }

    this.log('WebSocket Manager initialized', this.config)
  }

  // ================================
  // 连接管理
  // ================================

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    if (this.ws && (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING)) {
      this.log('Already connected or connecting')
      return
    }

    this.setState(ConnectionState.CONNECTING)
    this.emit(WebSocketEvent.CONNECTING)

    try {
      // 获取完整的 WebSocket URL（添加认证令牌）
      const url = await this.getWebSocketUrl()

      this.log(`Connecting to ${url}`)

      // 创建 WebSocket 连接
      this.ws = new WebSocket(url, this.config.protocols)

      // 设置事件监听器
      this.setupEventListeners()
    } catch (error) {
      this.log('Connection error:', error)
      this.handleError(error as Error)
    }
  }

  /**
   * 断开连接
   */
  disconnect(code?: number, reason?: string): void {
    if (!this.ws || this.state === ConnectionState.DISCONNECTED) {
      return
    }

    this.log('Disconnecting...', { code, reason })

    this.setState(ConnectionState.DISCONNECTING)

    // 停止心跳
    this.stopHeartbeat()

    // 关闭连接
    try {
      this.ws.close(code || 1000, reason || 'Client disconnect')
    } catch (error) {
      this.log('Error during disconnect:', error)
    }

    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 重置重连计数
    this.reconnectAttempts = 0

    this.stats.disconnectedAt = Date.now()
  }

  /**
   * 重新连接
   */
  private reconnect(): void {
    if (!this.config.reconnect) {
      this.log('Reconnection disabled')
      return
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log(`Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`)
      this.emit(WebSocketEvent.ERROR, new Error('Max reconnect attempts reached'))
      return
    }

    // 计算重连延迟（指数退避）
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.reconnectMaxInterval
    )

    this.reconnectAttempts++
    this.stats.reconnectCount++

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.emit(WebSocketEvent.RECONNECTING, { attempt: this.reconnectAttempts, delay })

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.log('Reconnect failed:', error)
      })
    }, delay)
  }

  // ================================
  // 事件监听器
  // ================================

  private setupEventListeners(): void {
    if (!this.ws) return

    // 连接成功
    this.ws.onopen = () => {
      this.log('WebSocket connected')
      
      this.setState(ConnectionState.CONNECTED)
      this.stats.connectedAt = Date.now()
      this.reconnectAttempts = 0

      // 开始心跳
      this.startHeartbeat()

      // 处理消息队列
      this.processMessageQueue()

      this.emit(WebSocketEvent.CONNECTED)
    }

    // 接收消息
    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data)
    }

    // 连接关闭
    this.ws.onclose = (event: CloseEvent) => {
      this.log('WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })

      this.setState(ConnectionState.DISCONNECTED)
      this.stopHeartbeat()

      this.emit(WebSocketEvent.DISCONNECTED, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })

      // 如果不是正常关闭，尝试重连
      if (!event.wasClean && this.config.reconnect) {
        this.reconnect()
      }
    }

    // 连接错误
    this.ws.onerror = (event: Event) => {
      this.log('WebSocket error:', event)
      this.handleError(new Error('WebSocket error'))
    }
  }

  // ================================
  // 消息处理
  // ================================

  /**
   * 发送消息
   */
  send<T = any>(type: string, data: T, requiresAck: boolean = false): Promise<MessageAck | void> {
    const message: WebSocketMessage<T> = {
      id: this.generateMessageId(),
      type,
      data,
      timestamp: Date.now(),
      requiresAck,
    }

    // 如果未连接且启用了队列，加入队列
    if (this.state !== ConnectionState.CONNECTED) {
      if (this.config.enableQueue) {
        this.log('Connection not ready, queuing message', message)
        this.messageQueue.push(message)
        return Promise.resolve()
      } else {
        return Promise.reject(new Error('WebSocket not connected'))
      }
    }

    return this.sendMessage(message)
  }

  /**
   * 发送消息（内部）
   */
  private sendMessage<T = any>(message: WebSocketMessage<T>): Promise<MessageAck | void> {
    if (!this.ws || this.state !== ConnectionState.CONNECTED) {
      return Promise.reject(new Error('WebSocket not connected'))
    }

    try {
      const messageStr = JSON.stringify(message)
      this.ws.send(messageStr)

      this.stats.messagesSent++
      this.stats.bytesSent += messageStr.length

      this.log('Message sent:', message.type, message.id)

      // 如果需要确认，返回 Promise
      if (message.requiresAck && message.id) {
        const messageId = message.id
        return new Promise((resolve, reject) => {
          // 设置超时
          const timeout = setTimeout(() => {
            this.pendingAcks.delete(messageId)
            reject(new Error('Message acknowledgment timeout'))
          }, 10000) // 10秒超时

          // 保存确认回调
          this.pendingAcks.set(messageId, (ack: MessageAck) => {
            clearTimeout(timeout)
            if (ack.error) {
              reject(new Error(ack.error))
            } else {
              resolve(ack)
            }
          })
        })
      }

      return Promise.resolve()
    } catch (error) {
      this.log('Failed to send message:', error)
      return Promise.reject(error)
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string | Blob | ArrayBuffer): void {
    try {
      // 处理不同类型的数据
      let messageStr: string

      if (typeof data === 'string') {
        messageStr = data
      } else if (data instanceof Blob) {
        // Blob 转字符串（异步）
        const reader = new FileReader()
        reader.onload = () => {
          this.handleMessage(reader.result as string)
        }
        reader.readAsText(data)
        return
      } else if (data instanceof ArrayBuffer) {
        messageStr = new TextDecoder().decode(data)
      } else {
        this.log('Unknown message type:', typeof data)
        return
      }

      this.stats.messagesReceived++
      this.stats.bytesReceived += messageStr.length

      const message: WebSocketMessage = JSON.parse(messageStr)

      this.log('Message received:', message.type, message.id)

      // 处理心跳响应
      if (message.type === 'pong') {
        this.handlePong(message)
        return
      }

      // 处理消息确认
      if (message.type === 'ack') {
        this.handleAck(message.data as MessageAck)
        return
      }

      // 发送确认（如果需要）
      if (message.requiresAck && message.id) {
        this.sendAck(message.id)
      }

      // 触发消息事件
      this.emit(WebSocketEvent.MESSAGE, message)
      this.emit(`message:${message.type}`, message.data)
    } catch (error) {
      this.log('Failed to parse message:', error)
      this.stats.errors++
    }
  }

  /**
   * 发送消息确认
   */
  private sendAck(messageId: string): void {
    const ack: MessageAck = {
      id: messageId,
      timestamp: Date.now(),
    }

    this.send('ack', ack).catch(error => {
      this.log('Failed to send ack:', error)
    })
  }

  /**
   * 处理消息确认
   */
  private handleAck(ack: MessageAck): void {
    const callback = this.pendingAcks.get(ack.id)
    if (callback) {
      callback(ack)
      this.pendingAcks.delete(ack.id)
    }
  }

  /**
   * 处理消息队列
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return
    }

    this.log(`Processing message queue (${this.messageQueue.length} messages)`)

    const queue = [...this.messageQueue]
    this.messageQueue = []

    queue.forEach(message => {
      this.sendMessage(message).catch(error => {
        this.log('Failed to send queued message:', error)
        // 重新入队
        this.messageQueue.push(message)
      })
    })
  }

  // ================================
  // 心跳检测
  // ================================

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval)

    this.log('Heartbeat started')
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }

    this.log('Heartbeat stopped')
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    const startTime = Date.now()

    this.send('ping', { timestamp: startTime }).catch(error => {
      this.log('Heartbeat failed:', error)
      this.handleHeartbeatTimeout()
    })

    // 设置心跳超时
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.handleHeartbeatTimeout()
    }, this.config.heartbeatTimeout)

    this.emit(WebSocketEvent.HEARTBEAT, { timestamp: startTime })
  }

  /**
   * 处理心跳响应
   */
  private handlePong(message: WebSocketMessage): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }

    const latency = Date.now() - message.data.timestamp
    this.stats.lastHeartbeat = Date.now()
    this.stats.latency = latency

    this.log(`Heartbeat received (latency: ${latency}ms)`)
  }

  /**
   * 处理心跳超时
   */
  private handleHeartbeatTimeout(): void {
    this.log('Heartbeat timeout - reconnecting')
    this.disconnect(4000, 'Heartbeat timeout')
    this.reconnect()
  }

  // ================================
  // 状态管理
  // ================================

  /**
   * 设置连接状态
   */
  private setState(state: ConnectionState): void {
    if (this.state === state) {
      return
    }

    this.log(`State changed: ${this.state} -> ${state}`)
    this.state = state
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED
  }

  // ================================
  // 统计信息
  // ================================

  /**
   * 获取连接统计
   */
  getStats(): Readonly<ConnectionStats> {
    return { ...this.stats }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      reconnectCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: 0,
    }
    this.log('Stats reset')
  }

  // ================================
  // 错误处理
  // ================================

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    this.log('Error:', error)
    this.stats.errors++
    this.setState(ConnectionState.ERROR)
    this.emit(WebSocketEvent.ERROR, error)

    // 尝试重连
    if (this.config.reconnect) {
      this.reconnect()
    }
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 获取 WebSocket URL（添加认证等参数）
   */
  private async getWebSocketUrl(): Promise<string> {
    let url = this.config.url

    try {
      // 添加认证令牌
      const token = await invoke<string>('get_auth_token')
      if (token) {
        const separator = url.includes('?') ? '&' : '?'
        url += `${separator}token=${encodeURIComponent(token)}`
      }

      // 添加设备ID
      const deviceId = await invoke<string>('get_device_id')
      if (deviceId) {
        const separator = url.includes('?') ? '&' : '?'
        url += `${separator}device_id=${encodeURIComponent(deviceId)}`
      }
    } catch (error) {
      this.log('Failed to add auth params:', error)
    }

    return url
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 日志记录
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[WebSocketManager] ${message}`, ...args)
    }
  }

  // ================================
  // 清理
  // ================================

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.log('Destroying WebSocket manager')
    
    // 断开连接
    this.disconnect(1000, 'Manager destroyed')

    // 清理定时器
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    // 清理队列和待确认消息
    this.messageQueue = []
    this.pendingAcks.clear()

    // 移除所有事件监听器
    this.removeAllListeners()

    this.ws = null
  }
}

// ================================
// 导出
// ================================

/**
 * 创建 WebSocket 管理器
 */
export function createWebSocketManager(config: WebSocketConfig): WebSocketManager {
  return new WebSocketManager(config)
}

/**
 * 默认 WebSocket 管理器（用于全局消息）
 */
let defaultWebSocketManager: WebSocketManager | null = null

/**
 * 获取默认 WebSocket 管理器
 */
export function getDefaultWebSocketManager(): WebSocketManager {
  if (!defaultWebSocketManager) {
    // 使用环境变量或默认值
    const wsUrl = (typeof window !== 'undefined' && (window as any).__VITE_WS_URL__) || 'ws://127.0.0.1:8000/ws'
    const isDev = process.env.NODE_ENV === 'development'
    
    defaultWebSocketManager = new WebSocketManager({
      url: wsUrl,
      autoConnect: true,
      enableLogging: isDev,
    })
  }
  return defaultWebSocketManager
}


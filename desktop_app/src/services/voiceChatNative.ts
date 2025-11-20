/**
 * 原生语音对话服务（使用 Tauri 音频 API）
 * 不依赖浏览器 getUserMedia，完全使用后端音频捕获
 */

import { invoke } from '@tauri-apps/api/tauri'

/**
 * 生成 UUID
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * 音频配置
 */
export interface AudioConfig {
    sample_rate: number
    channels: number
    bits_per_sample: number
}

/**
 * 语音对话配置
 */
export interface VoiceChatNativeConfig {
    /** WebSocket URL */
    wsUrl: string
    /** 音频配置 */
    audio?: AudioConfig
    /** 角色配置 */
    character?: {
        characterId?: string
        adapterId?: string
        systemPrompt?: string
        model?: string
    }
    /** STT 配置 */
    stt?: {
        model?: string
        language?: string
    }
    /** TTS 配置 */
    tts?: {
        voice?: string
        rate?: string
        volume?: string
        pitch?: string
    }
}

/**
 * 语音对话事件
 */
export interface VoiceChatNativeEvents {
    onReady?: () => void
    onTranscription?: (text: string, isFinal: boolean) => void
    onResponse?: (text: string) => void
    onAudioData?: (audioData: Blob) => void
    onSpeechEnd?: () => void
    onInterrupted?: () => void
    onError?: (error: string) => void
    onDisconnect?: () => void
}

/**
 * WebSocket 消息类型
 */
enum MessageType {
    CONFIG = 'config',
    AUDIO = 'audio',
    TEXT = 'text',
    INTERRUPT = 'interrupt',
    CLOSE = 'close',
    READY = 'ready',
    CONFIGURED = 'configured',
    TRANSCRIPTION = 'transcription',
    RESPONSE = 'response',
    SPEECH_END = 'speech_end',
    INTERRUPTED = 'interrupted',
    ERROR = 'error',
}

/**
 * 原生语音对话服务类
 */
export class VoiceChatNativeService {
    private ws: WebSocket | null = null
    private sessionId: string
    private config: VoiceChatNativeConfig
    private events: VoiceChatNativeEvents
    private isRecording = false
    private isSpeaking = false
    private audioQueue: Blob[] = []
    private isPlaying = false
    private recordingTimer: number | null = null

    constructor(config: VoiceChatNativeConfig, events: VoiceChatNativeEvents = {}) {
        this.sessionId = generateUUID()
        this.config = config
        this.events = events
    }

    /**
     * 连接到语音对话服务
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${this.config.wsUrl}/ws/${this.sessionId}`
                console.log(`🔌 连接到: ${wsUrl}`)
                this.ws = new WebSocket(wsUrl)

                this.ws.onopen = () => {
                    console.log('✅ WebSocket 已连接')
                }

                this.ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data)
                    await this.handleMessage(message)

                    // 第一次收到 ready 消息后解析 promise
                    if (message.type === MessageType.READY) {
                        this.sendConfig()
                        resolve()
                    }
                }

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket 错误:', error)
                    this.events.onError?.('WebSocket 连接失败')
                    reject(error)
                }

                this.ws.onclose = () => {
                    console.log('🔌 WebSocket 已断开')
                    this.cleanup()
                    this.events.onDisconnect?.()
                }
            } catch (error) {
                console.error('连接失败:', error)
                reject(error)
            }
        })
    }

    /**
     * 发送配置到服务器
     */
    private sendConfig(): void {
        this.send({
            type: MessageType.CONFIG,
            data: {
                stt: this.config.stt || {},
                tts: this.config.tts || {},
                character_id: this.config.character?.characterId,
                adapter_id: this.config.character?.adapterId,
                system_prompt: this.config.character?.systemPrompt,
                model: this.config.character?.model || 'default',
            },
        })
    }

    /**
     * 开始录音（使用 Tauri 原生 API）
     */
    async startRecording(): Promise<void> {
        if (this.isRecording) {
            console.warn('已经在录音中')
            return
        }

        try {
            // 获取音频设备列表
            const devices = await invoke<string[]>('list_audio_devices')
            console.log('📋 可用音频设备:', devices)

            if (devices.length === 0) {
                throw new Error('未找到音频输入设备')
            }

            // 准备音频配置
            const audioConfig: AudioConfig = {
                sample_rate: this.config.audio?.sample_rate || 16000,
                channels: this.config.audio?.channels || 1,
                bits_per_sample: this.config.audio?.bits_per_sample || 16,
            }

            // 启动录音
            await invoke('start_recording', { config: audioConfig })
            this.isRecording = true
            console.log('🎤 开始录音（Tauri 原生）')

            // 启动定时器，每 500ms 获取音频数据并发送
            this.recordingTimer = window.setInterval(async () => {
                try {
                    const audioData = await invoke<string>('get_recording_data')
                    if (audioData && audioData.length > 0) {
                        // 发送音频数据到服务器
                        this.send({
                            type: MessageType.AUDIO,
                            data: audioData,
                        })
                    }
                } catch (error) {
                    console.error('获取录音数据失败:', error)
                }
            }, 500)

        } catch (error) {
            console.error('启动录音失败:', error)
            this.events.onError?.(`无法启动录音: ${error}`)
            throw error
        }
    }

    /**
     * 停止录音
     */
    async stopRecording(): Promise<void> {
        if (!this.isRecording) {
            return
        }

        // 停止定时器
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer)
            this.recordingTimer = null
        }

        try {
            // 获取最后的音频数据
            const finalData = await invoke<string>('stop_recording')
            if (finalData && finalData.length > 0) {
                // 发送最后的音频数据
                this.send({
                    type: MessageType.AUDIO,
                    data: finalData,
                })
            }

            this.isRecording = false
            console.log('🛑 停止录音')
        } catch (error) {
            console.error('停止录音失败:', error)
            // 即使失败也取消录音
            await invoke('cancel_recording').catch(console.error)
            this.isRecording = false
        }
    }

    /**
     * 发送文本消息
     */
    sendText(text: string): void {
        this.send({
            type: MessageType.TEXT,
            data: text,
        })
    }

    /**
     * 打断当前语音播放
     */
    interrupt(): void {
        // 停止本地播放
        this.stopAudioPlayback()

        // 通知服务器打断
        this.send({
            type: MessageType.INTERRUPT,
        })

        this.isSpeaking = false
        console.log('⏸️ 打断语音播放')
    }

    /**
     * 处理服务器消息
     */
    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case MessageType.READY:
                console.log('✅ 会话已就绪:', message.session_id)
                this.events.onReady?.()
                break

            case MessageType.CONFIGURED:
                console.log('✅ 配置已应用')
                break

            case MessageType.TRANSCRIPTION:
                console.log('📝 识别结果:', message.data)
                this.events.onTranscription?.(message.data, message.isFinal ?? false)
                break

            case MessageType.RESPONSE:
                console.log('💬 AI 响应:', message.data)
                this.events.onResponse?.(message.data)
                this.isSpeaking = true
                break

            case MessageType.AUDIO:
                // 接收并播放音频
                if (message.data) {
                    const audioBlob = this.base64ToBlob(message.data, 'audio/mpeg')
                    await this.playAudio(audioBlob)
                    this.events.onAudioData?.(audioBlob)
                }
                break

            case MessageType.SPEECH_END:
                console.log('🔇 语音播放结束')
                this.isSpeaking = false
                this.events.onSpeechEnd?.()
                break

            case MessageType.INTERRUPTED:
                console.log('⏸️ 语音已打断')
                this.isSpeaking = false
                this.events.onInterrupted?.()
                break

            case MessageType.ERROR:
                console.error('❌ 服务器错误:', message.message)
                this.events.onError?.(message.message || '未知错误')
                break

            default:
                console.warn('未知消息类型:', message.type)
        }
    }

    /**
     * 播放音频
     */
    private async playAudio(audioBlob: Blob): Promise<void> {
        try {
            // 添加到播放队列
            this.audioQueue.push(audioBlob)

            // 如果没有正在播放，开始播放
            if (!this.isPlaying) {
                await this.processAudioQueue()
            }
        } catch (error) {
            console.error('播放音频失败:', error)
        }
    }

    /**
     * 处理音频播放队列
     */
    private async processAudioQueue(): Promise<void> {
        if (this.audioQueue.length === 0 || !this.isSpeaking) {
            this.isPlaying = false
            return
        }

        this.isPlaying = true
        const audioBlob = this.audioQueue.shift()!

        try {
            const audioUrl = URL.createObjectURL(audioBlob)
            const audio = new Audio(audioUrl)

            await new Promise<void>((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl)
                    resolve()
                }

                audio.onerror = (error) => {
                    URL.revokeObjectURL(audioUrl)
                    reject(error)
                }

                audio.play().catch(reject)
            })

            // 播放下一个
            await this.processAudioQueue()
        } catch (error) {
            console.error('处理音频队列失败:', error)
            this.isPlaying = false
        }
    }

    /**
     * 停止音频播放
     */
    private stopAudioPlayback(): void {
        this.audioQueue = []
        this.isPlaying = false
    }

    /**
     * 发送消息到服务器
     */
    private send(message: Partial<any>): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket 未连接')
            return
        }

        this.ws.send(JSON.stringify(message))
    }

    /**
     * 断开连接
     */
    async disconnect(): Promise<void> {
        // 停止录音
        if (this.isRecording) {
            await this.stopRecording().catch(console.error)
        }

        this.stopAudioPlayback()

        if (this.ws) {
            this.send({ type: MessageType.CLOSE })
            this.ws.close()
            this.ws = null
        }

        this.cleanup()
    }

    /**
     * 清理资源
     */
    private cleanup(): void {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer)
            this.recordingTimer = null
        }

        this.stopAudioPlayback()
        this.isRecording = false
        this.isSpeaking = false
    }

    /**
     * Base64 转 Blob
     */
    private base64ToBlob(base64: string, mimeType: string): Blob {
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }

        const byteArray = new Uint8Array(byteNumbers)
        return new Blob([byteArray], { type: mimeType })
    }

    /**
     * 获取当前状态
     */
    getState() {
        return {
            isConnected: this.ws?.readyState === WebSocket.OPEN,
            isRecording: this.isRecording,
            isSpeaking: this.isSpeaking,
            isPlaying: this.isPlaying,
            sessionId: this.sessionId,
        }
    }
}

export default VoiceChatNativeService

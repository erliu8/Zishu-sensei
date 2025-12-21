import { motion } from 'framer-motion'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChatService } from '@/services/chat'
import { CharacterSelector } from './CharacterSelector'
import { CharacterTemplateService } from '@/services/characterTemplate'
import { MoodDiaryReviewModal } from './MoodDiaryReviewModal'
import { skillsApi } from '@/api/skillsApi'
import VoiceChatNativeService, { VoiceChatNativeConfig, VoiceChatNativeEvents } from '@/services/voiceChatNative'
import toast from 'react-hot-toast'

interface ChatWindowProps {
    onClose: () => void
    onMinimize: () => void
}

/**
 * 聊天窗口组件
 */
export const ChatWindow: React.FC<ChatWindowProps> = ({
    onClose,
    onMinimize,
}) => {
    const [message, setMessage] = useState('')
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>()
    const [sessionId] = useState(() => ChatService.generateSessionId())
    const [isLoading, setIsLoading] = useState(false)
    const [messages, setMessages] = useState<Array<{
        id: string
        content: string
        sender: 'user' | 'assistant'
        timestamp: number
    }>>([
        {
            id: '1',
            content: '你好！我是你的桌面助手，有什么可以帮助你的吗？',
            sender: 'assistant',
            timestamp: Date.now(),
        }
    ])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isMoodDiaryModalOpen, setIsMoodDiaryModalOpen] = useState(false)

    // 语音对话状态
    const [isVoiceChatActive, setIsVoiceChatActive] = useState(false)
    const [isVoiceConnected, setIsVoiceConnected] = useState(false)
    const [currentTranscript, setCurrentTranscript] = useState('')
    const voiceServiceRef = useRef<VoiceChatNativeService | null>(null)

    // 初始化持续语音对话服务
    const initializeVoiceService = useCallback(async () => {
        const events: VoiceChatNativeEvents = {
            onReady: () => {
                console.log('✅ 语音对话已就绪')
                setIsVoiceConnected(true)
                toast.success('语音对话已连接')
            },

            onTranscription: (text, isFinal) => {
                setCurrentTranscript(text)

                if (isFinal && text.trim()) {
                    // 添加用户消息到对话
                    const userMessage = {
                        id: `voice-user-${Date.now()}`,
                        content: text,
                        sender: 'user' as const,
                        timestamp: Date.now(),
                    }
                    setMessages(prev => [...prev, userMessage])
                    setCurrentTranscript('')
                }
            },

            onResponse: (text) => {
                // 添加 AI 消息到对话
                const aiMessage = {
                    id: `voice-ai-${Date.now()}`,
                    content: text,
                    sender: 'assistant' as const,
                    timestamp: Date.now(),
                }
                setMessages(prev => [...prev, aiMessage])
                setIsSpeaking(true)
            },

            onSpeechEnd: () => {
                setIsSpeaking(false)
            },

            onInterrupted: () => {
                setIsSpeaking(false)
                toast('语音已打断', { icon: '⏸️' })
            },

            onError: (error) => {
                console.error('语音对话错误:', error)
                toast.error(error)
            },

            onDisconnect: () => {
                setIsVoiceConnected(false)
                setIsVoiceChatActive(false)
                toast('语音对话已断开', { icon: '🔌' })
            },
        }

        // 获取角色模板信息
        let characterConfig = {}
        if (selectedCharacterId) {
            try {
                const template = await CharacterTemplateService.getTemplateById(selectedCharacterId)
                if (template) {
                    let adapterId = template.metadata?.adapterId
                    
                    // 如果是 API 类型，准备适配器配置
                    if (template.llmConfig.type === 'api') {
                        const apiConfig = template.llmConfig as any
                        characterConfig = {
                            characterId: selectedCharacterId,
                            adapterId: adapterId,
                            systemPrompt: template.prompt.systemPrompt,
                            model: apiConfig.modelName || 'default',
                        }
                    } else {
                        characterConfig = {
                            characterId: selectedCharacterId,
                            systemPrompt: template.prompt.systemPrompt,
                            model: 'local-model',
                        }
                    }
                }
            } catch (error) {
                console.error('获取角色模板失败:', error)
            }
        }

        const config: VoiceChatNativeConfig = {
            wsUrl: 'ws://localhost:8000/api/voice',
            stt: {
                model: 'base',
                language: 'zh',
            },
            tts: {
                voice: 'zh-CN-XiaoxiaoNeural',
                rate: '+0%',
                volume: '+0%',
                pitch: '+0Hz',
            },
            audio: {
                sample_rate: 16000,
                channels: 1,
                bits_per_sample: 16,
            },
            character: characterConfig,
        }

        voiceServiceRef.current = new VoiceChatNativeService(config, events)
    }, [selectedCharacterId])

    // 切换持续语音对话
    const toggleVoiceChat = useCallback(async () => {
        if (!selectedCharacterId) {
            toast.error('请先选择一个角色模板')
            return
        }

        if (!isVoiceChatActive) {
            // 启动语音功能
            try {
                if (!voiceServiceRef.current) {
                    await initializeVoiceService()
                }

                if (!isVoiceConnected) {
                    await voiceServiceRef.current!.connect()
                }

                await voiceServiceRef.current!.startRecording()
                setIsVoiceChatActive(true)
                toast.success('语音对话已启动')
            } catch (error) {
                console.error('启动语音功能失败:', error)
                toast.error('启动语音功能失败')
            }
        } else {
            // 关闭语音功能
            voiceServiceRef.current?.stopRecording()
            voiceServiceRef.current?.disconnect()
            voiceServiceRef.current = null
            
            setIsVoiceChatActive(false)
            setIsVoiceConnected(false)
            toast('语音对话已关闭', { icon: '🔇' })
        }
    }, [isVoiceChatActive, isVoiceConnected, selectedCharacterId, initializeVoiceService])

    // 打断 AI 语音
    const interruptVoice = useCallback(() => {
        if (isSpeaking && voiceServiceRef.current) {
            voiceServiceRef.current.interrupt()
        }
    }, [isSpeaking])

    // 组件挂载时从 localStorage 加载之前选择的角色
    useEffect(() => {
        try {
            const savedConfig = localStorage.getItem('current_chat_config')
            if (savedConfig) {
                const config = JSON.parse(savedConfig)
                if (config.templateId) {
                    console.log('📖 从 localStorage 加载角色配置:', config)
                    setSelectedCharacterId(config.templateId)
                }
            }
        } catch (error) {
            console.error('加载保存的角色配置失败:', error)
        }
    }, [])

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            if (voiceServiceRef.current) {
                voiceServiceRef.current.disconnect()
            }
        }
    }, [])


    // 自动滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // 当消息列表更新时滚动到底部
    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSendMessage = async () => {
        if (!message.trim() || isLoading) return

        // 检查是否选择了角色
        if (!selectedCharacterId) {
            const warningReply = {
                id: Date.now().toString(),
                content: '请先选择一个角色模板再开始对话。',
                sender: 'assistant' as const,
                timestamp: Date.now(),
            }
            setMessages(prev => [...prev, warningReply])
            return
        }

        const userMessage = {
            id: Date.now().toString(),
            content: message,
            sender: 'user' as const,
            timestamp: Date.now(),
        }

        setMessages(prev => [...prev, userMessage])
        const messageContent = message
        setMessage('')
        setIsLoading(true)

        try {
            // 获取角色模板信息
            const template = await CharacterTemplateService.getTemplateById(selectedCharacterId)
            
            if (!template) {
                throw new Error('未找到角色模板')
            }

            const backendUrl = 'http://localhost:8000'
            let adapterId = template.metadata?.adapterId

            // 🎯 自动注册适配器（如果需要）
            if (template.llmConfig.type === 'api') {
                // 检查适配器是否存在
                const checkResponse = await fetch(`${backendUrl}/api/adapters/list`)
                const checkData = await checkResponse.json()
                const adapterExists = checkData.data?.adapters?.some((a: any) => a.adapter_id === adapterId)
                
                // 如果适配器不存在，自动注册
                if (!adapterExists) {
                    console.log('适配器不存在，自动注册...')
                    const apiConfig = template.llmConfig as any
                    const registerResponse = await fetch(`${backendUrl}/api/adapters/third-party/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider: apiConfig.provider,
                            api_key: apiConfig.apiKey,
                            model: apiConfig.modelName,
                            api_base: apiConfig.apiEndpoint,
                        }),
                    })
                    
                    const registerData = await registerResponse.json()
                    if (registerData.success) {
                        adapterId = registerData.data.adapter_id
                        console.log('✅ 适配器自动注册成功:', adapterId)
                        
                        // 更新模板的adapterId（可选，下次就不需要重新注册了）
                        template.metadata = {
                            ...template.metadata,
                            adapterId: adapterId,
                            isAdapterRegistered: true,
                        }
                        await CharacterTemplateService.updateTemplate(template.id, template)
                    } else {
                        console.error('适配器注册失败:', registerData)
                    }
                }
            }

            // 构建消息列表（包含历史消息）
            const apiMessages = messages
                .filter(msg => msg.sender === 'user' || msg.sender === 'assistant')
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            
            // 添加当前用户消息
            apiMessages.push({
                role: 'user',
                content: messageContent
            })

            // 直接调用后端 HTTP API
            const response = await fetch(`${backendUrl}/api/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: template.llmConfig.type === 'api' 
                        ? (template.llmConfig as any).modelName 
                        : 'local-model',
                    session_id: sessionId,
                    character_id: selectedCharacterId,
                    adapter: adapterId,
                    system_prompt: template.prompt.systemPrompt, // 🎯 传递system prompt
                    temperature: 0.7,
                    max_tokens: 2000,
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: '未知错误' }))
                throw new Error(error.detail || '请求失败')
            }

            const data = await response.json()
            const assistantMessage = data.choices?.[0]?.message?.content || '抱歉，我没有收到有效的回复。'

            const reply = {
                id: data.id || Date.now().toString(),
                content: assistantMessage,
                sender: 'assistant' as const,
                timestamp: Date.now(),
            }
            setMessages(prev => [...prev, reply])

            // 记录情绪日记（如果启用了相应技能）
            try {
                const chatConfig = JSON.parse(localStorage.getItem('current_chat_config') || '{}')
                if (chatConfig.enabledSkills?.includes('skill.builtin.mood.record')) {
                    await skillsApi.recordMoodDiary({
                        turn: {
                            user_text: messageContent,
                            assistant_text: assistantMessage,
                            ts: new Date().toISOString()
                        },
                        context: {
                            conversation_id: sessionId,
                            character_id: selectedCharacterId,
                            source: 'desktop_chat'
                        }
                    })
                    console.log('✅ 情绪日记记录成功')
                }
            } catch (moodError) {
                console.warn('⚠️ 记录情绪日记失败（不影响聊天）:', moodError)
            }
        } catch (error) {
            console.error('发送消息失败:', error)
            const errorMessage = error instanceof Error ? error.message : '未知错误'
            const errorReply = {
                id: (Date.now() + 1).toString(),
                content: `抱歉，发送消息失败：${errorMessage}。请检查后端服务是否正常运行。`,
                sender: 'assistant' as const,
                timestamp: Date.now(),
            }
            setMessages(prev => [...prev, errorReply])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
            }}
        >
            {/* 标题栏 */}
            <div data-tauri-drag-region style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid hsl(var(--color-border))',
                backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                backdropFilter: 'blur(10px)',
                cursor: 'move',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: 0,
                        color: 'hsl(var(--color-foreground))',
                    }}>
                        聊天助手
                    </h2>
                    {/* 语音对话状态指示 */}
                    {isVoiceChatActive && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            backgroundColor: 'hsl(var(--color-primary) / 0.1)',
                            borderRadius: '12px',
                            fontSize: '12px',
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'hsl(var(--color-primary))',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }} />
                            <span style={{ color: 'hsl(var(--color-primary))' }}>
                                {isSpeaking ? 'AI 正在说话' : '语音对话中'}
                            </span>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }} data-tauri-drag-region={false}>
                    <button
                        onClick={onMinimize}
                        data-tauri-drag-region={false}
                        style={{
                            padding: '8px',
                            color: 'hsl(var(--color-muted-foreground))',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    >
                        ➖
                    </button>
                    <button
                        onClick={onClose}
                        data-tauri-drag-region={false}
                        style={{
                            padding: '8px',
                            color: 'hsl(var(--color-muted-foreground))',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* 主内容区 */}
            <>
                    {/* 消息列表 */}
                    <div style={{
                        flex: 1,
                        overflowY: 'scroll',
                        padding: '16px',
                        minHeight: 0, // 重要：确保 flex 子元素可以正确收缩
                        WebkitOverflowScrolling: 'touch', // iOS 平滑滚动
                    }}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            marginBottom: '16px',
                        }}
                    >
                        <div
                            style={{
                                maxWidth: '70%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                backgroundColor: msg.sender === 'user'
                                    ? 'hsl(var(--color-primary))'
                                    : 'hsl(var(--color-muted))',
                                color: msg.sender === 'user'
                                    ? 'hsl(var(--color-primary-foreground))'
                                    : 'hsl(var(--color-foreground))',
                            }}
                        >
                            <p style={{ fontSize: '14px', margin: 0 }}>{msg.content}</p>
                            <p style={{
                                fontSize: '12px',
                                opacity: 0.7,
                                marginTop: '4px',
                                marginBottom: 0,
                            }}>
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
                {/* 用于自动滚动的引用点 */}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入框区域 */}
            <div style={{
                padding: '16px',
                borderTop: '1px solid hsl(var(--color-border))',
                flexShrink: 0,
                backgroundColor: 'hsl(var(--color-background))',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                {/* 角色选择器 */}
                <CharacterSelector
                    selectedCharacterId={selectedCharacterId}
                    onSelectCharacter={setSelectedCharacterId}
                />

                {/* 情绪日记回顾按钮 */}
                <button
                    onClick={() => setIsMoodDiaryModalOpen(true)}
                    style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: 'hsl(var(--color-foreground))',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                >
                    📚 查看情绪日记
                </button>

                {/* 语音相关指示器 */}
                {currentTranscript && (
                    <div style={{
                        padding: '8px 12px',
                        backgroundColor: 'hsl(var(--color-primary) / 0.1)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: 'hsl(var(--color-primary))',
                    }}>
                        🎤 正在识别: {currentTranscript}...
                    </div>
                )}
                
                {isSpeaking && isVoiceChatActive && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'hsl(var(--color-muted))',
                        borderRadius: '6px',
                        fontSize: '14px',
                    }}>
                        <span style={{ color: 'hsl(var(--color-primary))' }}>🔊 AI 正在语音回复...</span>
                        <button
                            onClick={interruptVoice}
                            style={{
                                marginLeft: 'auto',
                                padding: '4px 12px',
                                fontSize: '12px',
                                backgroundColor: 'hsl(var(--color-destructive))',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            打断
                        </button>
                    </div>
                )}

                {/* 输入区域 - 文字输入和持续语音对话按钮 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    {/* 持续语音对话按钮 */}
                    <button
                        onClick={toggleVoiceChat}
                        disabled={isLoading || !selectedCharacterId}
                        style={{
                            padding: '10px',
                            backgroundColor: isVoiceChatActive ? '#ef4444' : 'hsl(var(--color-primary))',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (isLoading || !selectedCharacterId) ? 'not-allowed' : 'pointer',
                            opacity: (isLoading || !selectedCharacterId) ? 0.5 : 1,
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            transition: 'all 0.2s',
                            position: 'relative',
                        }}
                        title={isVoiceChatActive ? '关闭语音对话' : '开始语音对话'}
                    >
                        {isVoiceChatActive ? '🔴' : '🎤'}
                        {isVoiceChatActive && (
                            <span style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#22c55e',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }} />
                        )}
                    </button>

                    {/* 输入框 */}
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                        placeholder={selectedCharacterId ? "输入消息或点击麦克风..." : "请先选择角色..."}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: '6px',
                            backgroundColor: 'hsl(var(--color-background))',
                            color: 'hsl(var(--color-foreground))',
                            outline: 'none',
                            opacity: isLoading ? 0.6 : 1,
                            cursor: isLoading ? 'not-allowed' : 'text',
                            fontSize: '14px',
                        }}
                        onFocus={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                            }
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                        }}
                    />

                    {/* 发送按钮 */}
                    <button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || isLoading}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: 'hsl(var(--color-primary))',
                            color: 'hsl(var(--color-primary-foreground))',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: message.trim() && !isLoading ? 'pointer' : 'not-allowed',
                            opacity: message.trim() && !isLoading ? 1 : 0.5,
                            minWidth: '60px',
                            minHeight: '44px',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                            if (message.trim() && !isLoading) {
                                e.currentTarget.style.opacity = '0.9'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (message.trim() && !isLoading) {
                                e.currentTarget.style.opacity = '1'
                            }
                        }}
                    >
                        {isLoading ? '发送中...' : '发送'}
                    </button>
                </div>
            </div>
            </>

            {/* 情绪日记回顾模态框 */}
            <MoodDiaryReviewModal
                isOpen={isMoodDiaryModalOpen}
                onClose={() => setIsMoodDiaryModalOpen(false)}
            />
        </motion.div>
    )
}

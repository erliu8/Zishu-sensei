import { motion } from 'framer-motion'
import React, { useState, useRef, useEffect } from 'react'
import { ChatService } from '@/services/chat'
import { CharacterSelector } from './CharacterSelector'
import { CharacterTemplateService } from '@/services/characterTemplate'

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
            <div 
                data-tauri-drag-region
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid hsl(var(--color-border))',
                    cursor: 'move',
                }}
            >
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'hsl(var(--color-foreground))',
                }}>
                    对话
                </h1>
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

                {/* 输入框 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                        placeholder={selectedCharacterId ? "输入消息..." : "请先选择角色..."}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: '6px',
                            backgroundColor: 'hsl(var(--color-background))',
                            color: 'hsl(var(--color-foreground))',
                            outline: 'none',
                            opacity: isLoading ? 0.6 : 1,
                            cursor: isLoading ? 'not-allowed' : 'text',
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
                    <button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || isLoading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'hsl(var(--color-primary))',
                            color: 'hsl(var(--color-primary-foreground))',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: message.trim() && !isLoading ? 'pointer' : 'not-allowed',
                            opacity: message.trim() && !isLoading ? 1 : 0.5,
                            minWidth: '60px',
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
        </motion.div>
    )
}

import { motion } from 'framer-motion'
import React, { useState } from 'react'

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
            timestamp: Date.now() - 60000,
        }
    ])

    const handleSendMessage = () => {
        if (!message.trim()) return

        const newMessage = {
            id: Date.now().toString(),
            content: message,
            sender: 'user' as const,
            timestamp: Date.now(),
        }

        setMessages(prev => [...prev, newMessage])
        setMessage('')

        // 模拟助手回复
        setTimeout(() => {
            const reply = {
                id: (Date.now() + 1).toString(),
                content: '我收到了你的消息：' + message,
                sender: 'assistant' as const,
                timestamp: Date.now(),
            }
            setMessages(prev => [...prev, reply])
        }, 1000)
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full h-full flex flex-col bg-background text-foreground"
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
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
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
            </div>

            {/* 输入框 */}
            <div style={{
                padding: '16px',
                borderTop: '1px solid hsl(var(--color-border))',
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="输入消息..."
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: '6px',
                            backgroundColor: 'hsl(var(--color-background))',
                            color: 'hsl(var(--color-foreground))',
                            outline: 'none',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!message.trim()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'hsl(var(--color-primary))',
                            color: 'hsl(var(--color-primary-foreground))',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: message.trim() ? 'pointer' : 'not-allowed',
                            opacity: message.trim() ? 1 : 0.5,
                        }}
                        onMouseEnter={(e) => {
                            if (message.trim()) {
                                e.currentTarget.style.opacity = '0.9'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (message.trim()) {
                                e.currentTarget.style.opacity = '1'
                            }
                        }}
                    >
                        发送
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

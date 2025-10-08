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
            className="w-full h-full bg-white dark:bg-gray-900 flex flex-col"
        >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    对话
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={onMinimize}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        ➖
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.sender === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                }`}
                        >
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 输入框 */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="输入消息..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!message.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        发送
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

import { useCallback, useState } from 'react'

/**
 * 聊天功能 Hook
 */
export const useChat = () => {
    const [isConnected, setIsConnected] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

    const connect = useCallback(async () => {
        setConnectionStatus('connecting')
        // 模拟连接逻辑
        setTimeout(() => {
            setIsConnected(true)
            setConnectionStatus('connected')
        }, 1000)
    }, [])

    const disconnect = useCallback(() => {
        setIsConnected(false)
        setConnectionStatus('disconnected')
    }, [])

    return {
        isConnected,
        connectionStatus,
        connect,
        disconnect,
    }
}

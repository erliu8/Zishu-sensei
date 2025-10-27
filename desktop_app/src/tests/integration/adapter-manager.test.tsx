/**
 * 集成测试示例
 * 
 * 测试多个组件或服务之间的交互
 */

import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../setup'

// 模拟的适配器服务
const AdapterService = {
  async getAdapters() {
    const response = await fetch('/api/adapters')
    const result = await response.json()
    return result.data
  },
  
  async loadAdapter(id: string) {
    const response = await fetch(`/api/adapters/${id}/load`, {
      method: 'POST'
    })
    const result = await response.json()
    return result.data
  },
  
  async unloadAdapter(id: string) {
    const response = await fetch(`/api/adapters/${id}/unload`, {
      method: 'POST'
    })
    const result = await response.json()
    return result.data
  }
}

// 模拟的适配器管理组件
const AdapterManager = () => {
  const [adapters, setAdapters] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  
  React.useEffect(() => {
    loadAdapters()
  }, [])
  
  const loadAdapters = async () => {
    setLoading(true)
    try {
      const data = await AdapterService.getAdapters()
      setAdapters(data)
    } catch (error) {
      console.error('加载适配器失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleLoadAdapter = async (id: string) => {
    try {
      await AdapterService.loadAdapter(id)
      loadAdapters() // 重新加载列表
    } catch (error) {
      console.error('加载适配器失败:', error)
    }
  }
  
  const handleUnloadAdapter = async (id: string) => {
    try {
      await AdapterService.unloadAdapter(id)
      loadAdapters() // 重新加载列表
    } catch (error) {
      console.error('卸载适配器失败:', error)
    }
  }
  
  if (loading) {
    return <div data-testid="loading">加载中...</div>
  }
  
  return (
    <div data-testid="adapter-manager">
      <h2>适配器管理</h2>
      <div data-testid="adapter-list">
        {adapters.map(adapter => (
          <div key={adapter.name} data-testid={`adapter-${adapter.name}`}>
            <h3>{adapter.name}</h3>
            <p>状态: {adapter.status}</p>
            <p>版本: {adapter.version}</p>
            {adapter.status === 'unloaded' ? (
              <button 
                onClick={() => handleLoadAdapter(adapter.name)}
                data-testid={`load-${adapter.name}`}
              >
                加载
              </button>
            ) : (
              <button 
                onClick={() => handleUnloadAdapter(adapter.name)}
                data-testid={`unload-${adapter.name}`}
              >
                卸载
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

describe('适配器管理集成测试', () => {
  beforeEach(() => {
    // 重置所有 mock
    server.resetHandlers()
  })

  it('应该能够加载和显示适配器列表', async () => {
    render(<AdapterManager />)
    
    // 等待加载完成
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
    
    // 检查适配器列表
    expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
    expect(screen.getByTestId('adapter-test-adapter-1')).toBeInTheDocument()
    expect(screen.getByTestId('adapter-test-adapter-2')).toBeInTheDocument()
  })

  it('应该能够加载适配器', async () => {
    render(<AdapterManager />)
    
    // 等待初始加载
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
    
    // 点击加载按钮
    const loadButton = screen.getByTestId('load-test-adapter-2')
    await userEvent.click(loadButton)
    
    // 等待状态更新
    await waitFor(() => {
      expect(screen.getByText('状态: loaded')).toBeInTheDocument()
    })
  })

  it('应该能够卸载适配器', async () => {
    render(<AdapterManager />)
    
    // 等待初始加载
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
    
    // 点击卸载按钮
    const unloadButton = screen.getByTestId('unload-test-adapter-1')
    await userEvent.click(unloadButton)
    
    // 等待状态更新
    await waitFor(() => {
      expect(screen.getByText('状态: unloaded')).toBeInTheDocument()
    })
  })

  it('应该处理 API 错误', async () => {
    // 模拟 API 错误
    server.use(
      http.get('/api/adapters', () => {
        return HttpResponse.json({ error: '服务器错误' }, { status: 500 })
      })
    )
    
    render(<AdapterManager />)
    
    // 等待加载完成（即使失败）
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
    
    // 检查错误处理（这里应该显示错误信息）
    expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
  })
})

describe('聊天功能集成测试', () => {
  it('应该能够发送和接收消息', async () => {
    const ChatComponent = () => {
      const [messages, setMessages] = React.useState<any[]>([])
      const [input, setInput] = React.useState('')
      
      const sendMessage = async () => {
        if (!input.trim()) return
        
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input })
        })
        
        const result = await response.json()
        setMessages(prev => [...prev, 
          { text: input, type: 'user' },
          { text: result.data.message, type: 'bot' }
        ])
        setInput('')
      }
      
      return (
        <div data-testid="chat">
          <div data-testid="messages">
            {messages.map((msg, index) => (
              <div key={index} data-testid={`message-${index}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <input 
            data-testid="message-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
          />
          <button 
            data-testid="send-button"
            onClick={sendMessage}
          >
            发送
          </button>
        </div>
      )
    }
    
    render(<ChatComponent />)
    
    // 输入消息
    const input = screen.getByTestId('message-input')
    await userEvent.type(input, 'Hello')
    
    // 发送消息
    const sendButton = screen.getByTestId('send-button')
    await userEvent.click(sendButton)
    
    // 等待消息显示
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('回复: Hello')).toBeInTheDocument()
    })
  })
})

describe('系统信息集成测试', () => {
  it('应该能够获取和显示系统信息', async () => {
    const SystemInfoComponent = () => {
      const [systemInfo, setSystemInfo] = React.useState<any>(null)
      
      React.useEffect(() => {
        const fetchSystemInfo = async () => {
          const response = await fetch('/api/system/info')
          const result = await response.json()
          setSystemInfo(result.data)
        }
        fetchSystemInfo()
      }, [])
      
      if (!systemInfo) {
        return <div data-testid="loading">加载系统信息...</div>
      }
      
      return (
        <div data-testid="system-info">
          <h3>系统信息</h3>
          <p>操作系统: {systemInfo.os_name}</p>
          <p>架构: {systemInfo.arch}</p>
          <p>CPU: {systemInfo.cpu.model}</p>
          <p>内存: {systemInfo.memory.total_mb} MB</p>
        </div>
      )
    }
    
    render(<SystemInfoComponent />)
    
    // 等待系统信息加载
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
    
    // 检查系统信息显示
    expect(screen.getByText('操作系统: Linux')).toBeInTheDocument()
    expect(screen.getByText('架构: x86_64')).toBeInTheDocument()
    expect(screen.getByText('CPU: Intel Core i7-10700K')).toBeInTheDocument()
  })
})

/**
 * ChatStore 使用示例
 * 展示如何使用聊天状态管理和类型定义
 * 
 * @example
 * import ChatStoreExample from './examples/ChatStoreExample';
 */

import React, { useState, useEffect } from 'react'
import {
  useChatStore,
  useCurrentSession,
  useSessionList,
  useSessionActions,
  useMessageActions,
  useChatStatus,
  useChatStats,
  useChatSearch,
  useChatTemplates,
} from '@/stores/chatStore'
import {
  type ChatMessage,
  type ChatSuggestion,
  MessageRole,
  SessionType,
  MessageType,
} from '@/types/chat'

// ==================== 示例 1: 基础会话管理 ====================

export function BasicSessionManagement() {
  const { sessions, activeSessions } = useSessionList()
  const { createSession, switchSession, deleteSession, renameSession } = useSessionActions()
  const { session } = useCurrentSession()

  const handleCreateSession = () => {
    const sessionId = createSession('新对话', SessionType.CHAT)
    console.log('创建会话:', sessionId)
  }

  const handleSwitchSession = (sessionId: string) => {
    switchSession(sessionId)
  }

  const handleRenameSession = (sessionId: string) => {
    const newTitle = prompt('输入新标题:')
    if (newTitle) {
      renameSession(sessionId, newTitle)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">会话管理示例</h2>
        <button
          onClick={handleCreateSession}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          创建新会话
        </button>
      </div>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">当前会话</h3>
        {session ? (
          <div>
            <p className="text-lg">{session.title}</p>
            <p className="text-sm text-gray-600">
              消息数: {session.messageCount} | Token: {session.totalTokens}
            </p>
          </div>
        ) : (
          <p className="text-gray-500">没有活跃会话</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">会话列表 ({activeSessions.length})</h3>
        {activeSessions.map((s) => (
          <div
            key={s.id}
            className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
              session?.id === s.id ? 'border-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => handleSwitchSession(s.id)}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-gray-600">
                  {s.messageCount} 条消息 | {new Date(s.lastActivityAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRenameSession(s.id)
                  }}
                  className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                >
                  重命名
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('确定删除此会话？')) {
                      deleteSession(s.id)
                    }
                  }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== 示例 2: 消息发送和管理 ====================

export function MessageManagement() {
  const [input, setInput] = useState('')
  const [useStreaming, setUseStreaming] = useState(false)
  const { session, messages, isStreaming } = useCurrentSession()
  const { sendMessage, sendStreamMessage, stopStreaming, regenerateResponse } = useMessageActions()
  const { isSending, error, clearError } = useChatStatus()

  const handleSend = async () => {
    if (!input.trim()) return

    try {
      if (useStreaming) {
        await sendStreamMessage(input, {
          streamOptions: {
            onStart: () => console.log('流式传输开始'),
            onChunk: (chunk) => console.log('收到数据块:', chunk.delta),
            onComplete: (response) => console.log('流式传输完成:', response),
            onError: (err) => console.error('流式传输错误:', err),
          },
        })
      } else {
        const response = await sendMessage(input)
        console.log('消息发送成功:', response)
      }
      setInput('')
    } catch (err) {
      console.error('发送失败:', err)
    }
  }

  const handleRegenerate = (messageId: string) => {
    if (session) {
      regenerateResponse(session.id, messageId)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">消息管理示例</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => setUseStreaming(e.target.checked)}
          />
          <span>启用流式响应</span>
        </label>
      </div>

      {session && (
        <div className="mb-2 p-2 bg-gray-100 rounded text-sm">
          <p>
            会话: {session.title} | 消息数: {messages.length}
          </p>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-4 bg-gray-50 rounded">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[70%]">
              <div
                className={`p-3 rounded-lg ${
                  msg.role === MessageRole.USER
                    ? 'bg-blue-500 text-white'
                    : msg.role === MessageRole.ASSISTANT
                    ? 'bg-white border'
                    : 'bg-yellow-100'
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {typeof msg.content === 'string' ? msg.content : msg.content.text}
                </p>
                {msg.metadata?.processingTime && (
                  <p className="text-xs mt-1 opacity-70">
                    {msg.metadata.processingTime}ms
                  </p>
                )}
              </div>
              {msg.role === MessageRole.ASSISTANT && (
                <button
                  onClick={() => handleRegenerate(msg.id)}
                  className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  🔄 重新生成
                </button>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex justify-between items-center">
          <span>{error.message}</span>
          <button onClick={clearError} className="text-sm underline">
            关闭
          </button>
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入消息... (Shift+Enter 换行)"
          className="flex-1 p-3 border rounded-lg resize-none"
          rows={3}
          disabled={isSending}
        />
        <div className="flex flex-col gap-2">
          {isStreaming ? (
            <button
              onClick={() => stopStreaming()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
            >
              {isSending ? '发送中...' : '发送'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== 示例 3: 统计信息 ====================

export function StatsDisplay() {
  const { globalStats, getCurrentStats } = useChatStats()
  const currentStats = getCurrentStats()
  const { session } = useCurrentSession()

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">统计信息示例</h2>

      {/* 全局统计 */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="text-lg font-bold mb-3">全局统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{globalStats.totalSessions}</p>
            <p className="text-sm text-gray-600">总会话数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{globalStats.activeSessions}</p>
            <p className="text-sm text-gray-600">活跃会话</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{globalStats.totalMessages}</p>
            <p className="text-sm text-gray-600">总消息数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">
              {(globalStats.totalTokens / 1000).toFixed(1)}K
            </p>
            <p className="text-sm text-gray-600">总 Token</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">今日消息</p>
            <p className="text-xl font-semibold">{globalStats.todayMessages}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">本周消息</p>
            <p className="text-xl font-semibold">{globalStats.weekMessages}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">平均会话长度</p>
            <p className="text-xl font-semibold">{globalStats.avgSessionLength.toFixed(1)}</p>
          </div>
        </div>

        {globalStats.mostActiveSession && (
          <div className="mt-4 p-3 bg-white rounded">
            <p className="text-sm text-gray-600">最活跃会话</p>
            <p className="font-medium">{globalStats.mostActiveSession.title}</p>
            <p className="text-sm">{globalStats.mostActiveSession.messageCount} 条消息</p>
          </div>
        )}
      </div>

      {/* 当前会话统计 */}
      {session && currentStats && (
        <div className="p-4 bg-green-50 rounded">
          <h3 className="text-lg font-bold mb-3">当前会话统计: {session.title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">总消息</p>
              <p className="text-2xl font-bold">{currentStats.totalMessages}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">用户消息</p>
              <p className="text-2xl font-bold text-blue-600">{currentStats.userMessages}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">助手消息</p>
              <p className="text-2xl font-bold text-green-600">{currentStats.assistantMessages}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">总 Token</p>
              <p className="text-2xl font-bold">{currentStats.totalTokens}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">平均响应时间</p>
              <p className="text-lg font-semibold">{currentStats.avgResponseTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">最快响应</p>
              <p className="text-lg font-semibold">{currentStats.minResponseTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">最慢响应</p>
              <p className="text-lg font-semibold">{currentStats.maxResponseTime.toFixed(0)}ms</p>
            </div>
          </div>

          {currentStats.sessionDuration > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">会话时长</p>
              <p className="text-lg font-semibold">
                {(currentStats.sessionDuration / 60).toFixed(1)} 分钟
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== 示例 4: 搜索功能 ====================

export function SearchExample() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<any[]>([])
  const { searchMessages, globalSearch } = useChatSearch()
  const { session } = useCurrentSession()

  const handleSearch = () => {
    if (!keyword.trim()) return

    if (session) {
      // 在当前会话中搜索
      const searchResults = searchMessages({
        keyword,
        sessionId: session.id,
        caseSensitive: false,
      })
      setResults(searchResults)
    } else {
      // 全局搜索
      const searchResults = globalSearch(keyword, 20)
      setResults(searchResults)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">搜索功能示例</h2>

      {/* 搜索框 */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="输入搜索关键词..."
          className="flex-1 p-3 border rounded-lg"
        />
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          搜索
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {session ? `在当前会话中搜索` : `全局搜索所有会话`}
      </p>

      {/* 搜索结果 */}
      <div className="space-y-3">
        <p className="font-medium">搜索结果 ({results.length})</p>
        {results.map((result, index) => (
          <div key={index} className="p-3 border rounded bg-white">
            <div className="flex justify-between items-start mb-2">
              <span
                className={`px-2 py-1 text-xs rounded ${
                  result.message.role === MessageRole.USER
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {result.message.role}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(result.message.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-sm">
              {result.matchedText || (
                typeof result.message.content === 'string'
                  ? result.message.content
                  : result.message.content.text
              )}
            </p>
            {result.score && (
              <p className="text-xs text-gray-500 mt-1">匹配度: {(result.score * 100).toFixed(0)}%</p>
            )}
          </div>
        ))}
        {results.length === 0 && keyword && (
          <p className="text-center text-gray-500 py-8">没有找到匹配的结果</p>
        )}
      </div>
    </div>
  )
}

// ==================== 示例 5: 模板功能 ====================

export function TemplateExample() {
  const { templates, createFromTemplate, addTemplate, deleteTemplate } = useChatTemplates()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    systemPrompt: '',
  })

  const handleCreateFromTemplate = (templateId: string) => {
    try {
      const sessionId = createFromTemplate(templateId)
      alert(`从模板创建会话成功: ${sessionId}`)
    } catch (error) {
      alert('创建失败: ' + (error as Error).message)
    }
  }

  const handleAddTemplate = () => {
    if (!newTemplate.name || !newTemplate.systemPrompt) {
      alert('请填写模板名称和系统提示词')
      return
    }

    addTemplate({
      name: newTemplate.name,
      description: newTemplate.description,
      type: SessionType.CHAT,
      systemPrompt: newTemplate.systemPrompt,
      isBuiltIn: false,
    })

    setNewTemplate({ name: '', description: '', systemPrompt: '' })
    setShowAddForm(false)
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">模板功能示例</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showAddForm ? '取消' : '添加模板'}
        </button>
      </div>

      {/* 添加模板表单 */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-3">新建模板</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">模板名称</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="例如: 代码助手"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <input
                type="text"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="简短描述此模板的用途"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">系统提示词</label>
              <textarea
                value={newTemplate.systemPrompt}
                onChange={(e) => setNewTemplate({ ...newTemplate, systemPrompt: e.target.value })}
                className="w-full p-2 border rounded"
                rows={4}
                placeholder="输入系统提示词，定义 AI 的行为和角色..."
              />
            </div>
            <button
              onClick={handleAddTemplate}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              保存模板
            </button>
          </div>
        </div>
      )}

      {/* 模板列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="p-4 border rounded bg-white">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{template.name}</h3>
                <p className="text-sm text-gray-600">{template.description}</p>
              </div>
              {!template.isBuiltIn && (
                <button
                  onClick={() => {
                    if (confirm('确定删除此模板？')) {
                      deleteTemplate(template.id)
                    }
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  删除
                </button>
              )}
            </div>
            <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
              <p className="text-xs text-gray-600 mb-1">系统提示词:</p>
              <p className="line-clamp-2">{template.systemPrompt}</p>
            </div>
            <button
              onClick={() => handleCreateFromTemplate(template.id)}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              使用此模板创建会话
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-500">
            暂无模板，点击"添加模板"创建第一个模板
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 示例 6: 事件监听 ====================

export function EventListenerExample() {
  const [events, setEvents] = useState<string[]>([])
  const addEventListener = useChatStore((state) => state.addEventListener)

  useEffect(() => {
    // 添加事件监听器
    const unsubscribe = addEventListener((event) => {
      const eventStr = `[${new Date().toLocaleTimeString()}] ${event.type}`
      setEvents((prev) => [eventStr, ...prev.slice(0, 19)]) // 保留最近 20 条
    })

    // 清理函数
    return () => {
      unsubscribe()
    }
  }, [addEventListener])

  const clearEvents = () => {
    setEvents([])
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">事件监听示例</h2>
        <button
          onClick={clearEvents}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          清空日志
        </button>
      </div>

      <div className="p-4 bg-gray-900 text-green-400 rounded font-mono text-sm h-96 overflow-y-auto">
        <p className="mb-2">事件日志 (最近 20 条):</p>
        {events.map((event, index) => (
          <p key={index} className="mb-1">
            {event}
          </p>
        ))}
        {events.length === 0 && (
          <p className="text-gray-600">等待事件...</p>
        )}
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h3 className="font-bold mb-2">可监听的事件类型</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>message:sent - 消息已发送</li>
          <li>message:received - 消息已接收</li>
          <li>message:updated - 消息已更新</li>
          <li>message:deleted - 消息已删除</li>
          <li>session:created - 会话已创建</li>
          <li>session:updated - 会话已更新</li>
          <li>session:deleted - 会话已删除</li>
          <li>stream:start - 流式传输开始</li>
          <li>stream:chunk - 流式数据块</li>
          <li>stream:complete - 流式传输完成</li>
          <li>stream:error - 流式传输错误</li>
          <li>error - 错误事件</li>
        </ul>
      </div>
    </div>
  )
}

// ==================== 综合示例组件 ====================

export default function ChatStoreExample() {
  const [activeTab, setActiveTab] = useState(0)

  const examples = [
    { title: '会话管理', component: BasicSessionManagement },
    { title: '消息管理', component: MessageManagement },
    { title: '统计信息', component: StatsDisplay },
    { title: '搜索功能', component: SearchExample },
    { title: '模板功能', component: TemplateExample },
    { title: '事件监听', component: EventListenerExample },
  ]

  const ActiveComponent = examples[activeTab].component

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto p-4">
          <h1 className="text-3xl font-bold mb-4">ChatStore 使用示例</h1>
          <div className="flex gap-2 flex-wrap">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 rounded ${
                  activeTab === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="py-6">
        <ActiveComponent />
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-bold mb-2">📚 使用说明</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>会话管理:</strong> 演示如何创建、切换、重命名和删除会话
            </li>
            <li>
              <strong>消息管理:</strong> 演示如何发送消息、流式响应、重新生成等
            </li>
            <li>
              <strong>统计信息:</strong> 展示全局和会话级别的统计数据
            </li>
            <li>
              <strong>搜索功能:</strong> 演示如何在会话中搜索消息
            </li>
            <li>
              <strong>模板功能:</strong> 演示如何创建和使用对话模板
            </li>
            <li>
              <strong>事件监听:</strong> 演示如何监听和处理聊天事件
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}


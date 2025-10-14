/**
 * useChat Hook 使用示例
 * 展示如何使用 useChat Hook 构建完整的聊天界面
 * 
 * @example
 * import UseChatExample from './examples/UseChatExample';
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChat, type Message } from '../src/hooks/useChat';

// ================================
// 示例 1: 基础聊天界面
// ================================

export function BasicChatInterface() {
  const [input, setInput] = useState('');
  
  const {
    messages,
    isSending,
    error,
    sendMessage,
    clearHistory,
  } = useChat({
    sessionId: 'basic_chat_session',
    defaultModel: 'gpt-3.5-turbo',
    maxContextMessages: 10,
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">基础聊天界面</h2>
        <button
          onClick={clearHistory}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm"
        >
          清空历史
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.role === 'assistant'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.processing_time && (
                <p className="text-xs mt-1 opacity-70">
                  {msg.processing_time}ms
                </p>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error.message}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          className="flex-1 p-3 border rounded-lg resize-none"
          rows={2}
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
        >
          {isSending ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
}

// ================================
// 示例 2: 流式聊天界面
// ================================

export function StreamingChatInterface() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isSending,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearError,
  } = useChat({
    sessionId: 'streaming_chat_session',
    enableStreaming: true,
    onStreamStart: () => {
      console.log('开始流式传输');
    },
    onStreamChunk: (chunk) => {
      console.log('收到数据块:', chunk);
    },
    onStreamComplete: () => {
      console.log('流式传输完成');
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    clearError();
    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">流式聊天界面</h2>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex justify-between items-center">
          <span>{error.message}</span>
          <button onClick={clearError} className="text-red-700 underline text-sm">
            关闭
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="flex-1 p-3 border rounded-lg resize-none"
          rows={2}
          disabled={isSending}
        />
        {isStreaming ? (
          <button
            onClick={stopStreaming}
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
            发送
          </button>
        )}
      </div>
    </div>
  );
}

// ================================
// 示例 3: 高级功能界面
// ================================

export function AdvancedChatInterface() {
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);

  const {
    messages,
    isSending,
    error,
    stats,
    sendMessage,
    resendLastMessage,
    regenerateLastResponse,
    deleteMessage,
    editMessage,
    clearHistory,
    loadHistory,
    exportHistory,
    importHistory,
  } = useChat({
    sessionId: 'advanced_chat_session',
    autoLoadHistory: true,
    maxContextMessages: 20,
    maxRetries: 3,
    defaultTemperature: temperature,
    onError: (error) => {
      console.error('聊天错误:', error);
    },
    onMessageSent: (message, response) => {
      console.log('消息已发送:', message, response);
    },
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, { temperature });
    setInput('');
  };

  const handleExport = () => {
    const history = exportHistory();
    const json = JSON.stringify(history, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_history_${Date.now()}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const history = JSON.parse(event.target?.result as string);
        importHistory(history);
      } catch (error) {
        console.error('导入失败:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* 头部工具栏 */}
      <div className="flex justify-between items-center mb-4 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold">高级聊天界面</h2>
          <div className="text-sm text-gray-600 mt-1">
            消息数: {stats.totalMessages} | Token: {stats.totalTokens} | 
            平均响应: {stats.avgResponseTime.toFixed(0)}ms
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
          >
            {showSettings ? '隐藏设置' : '显示设置'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          >
            导出
          </button>
          <label className="px-3 py-1 bg-blue-500 text-white rounded text-sm cursor-pointer">
            导入
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={clearHistory}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            清空
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">聊天设置</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-sm mb-1">
                温度 (Temperature): {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadHistory(50)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
              >
                加载历史 (50条)
              </button>
              <button
                onClick={resendLastMessage}
                className="px-3 py-1 bg-yellow-500 text-white rounded text-sm"
              >
                重发最后消息
              </button>
              <button
                onClick={regenerateLastResponse}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm"
              >
                重新生成回复
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={(e) => {
              const actions = e.currentTarget.querySelector('.message-actions');
              if (actions) {
                (actions as HTMLElement).style.display = 'flex';
              }
            }}
            onMouseLeave={(e) => {
              const actions = e.currentTarget.querySelector('.message-actions');
              if (actions) {
                (actions as HTMLElement).style.display = 'none';
              }
            }}
          >
            <div className="relative max-w-[70%]">
              <div
                className={`rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : msg.role === 'assistant'
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.processing_time && (
                  <p className="text-xs mt-1 opacity-70">
                    {msg.processing_time}ms
                  </p>
                )}
              </div>
              
              {/* 消息操作按钮 */}
              <div
                className="message-actions absolute -top-2 right-0 hidden gap-1"
                style={{ display: 'none' }}
              >
                {msg.role === 'user' && (
                  <button
                    onClick={() => {
                      const newContent = prompt('编辑消息:', msg.content);
                      if (newContent) {
                        editMessage(msg.id, newContent);
                      }
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                    title="编辑"
                  >
                    ✏️
                  </button>
                )}
                <button
                  onClick={() => deleteMessage(msg.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error.message}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="flex-1 p-3 border rounded-lg resize-none"
          rows={2}
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
        >
          {isSending ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
}

// ================================
// 示例 4: 简化版聊天（使用 useSimpleChat）
// ================================

import { useSimpleChat } from '../src/hooks/useChat';

export function SimpleChatInterface() {
  const [input, setInput] = useState('');
  const { messages, isLoading, send } = useSimpleChat('simple_session');

  const handleSend = async () => {
    if (!input.trim()) return;
    await send(input);
    setInput('');
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">简化版聊天</h2>
      
      <div className="space-y-2 mb-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded ${
              msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isLoading ? '...' : '发送'}
        </button>
      </div>
    </div>
  );
}

// ================================
// 综合示例组件
// ================================

export default function UseChatExample() {
  const [activeTab, setActiveTab] = useState(0);

  const examples = [
    { title: '基础界面', component: BasicChatInterface },
    { title: '流式响应', component: StreamingChatInterface },
    { title: '高级功能', component: AdvancedChatInterface },
    { title: '简化版本', component: SimpleChatInterface },
  ];

  const ActiveComponent = examples[activeTab].component;

  return (
    <div>
      <div className="bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">useChat Hook 使用示例</h1>
          <div className="flex gap-2 flex-wrap">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 rounded ${
                  activeTab === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ActiveComponent />

      <div className="max-w-4xl mx-auto p-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-bold mb-2">📚 使用指南</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>基础界面:</strong> 展示最简单的聊天实现</li>
            <li><strong>流式响应:</strong> 展示如何使用流式传输实时显示回复</li>
            <li><strong>高级功能:</strong> 展示所有高级特性（编辑、重发、导入导出等）</li>
            <li><strong>简化版本:</strong> 展示 useSimpleChat 的极简用法</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


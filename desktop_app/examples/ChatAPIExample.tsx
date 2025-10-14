/**
 * 聊天 API 使用示例
 * 展示如何直接使用底层 Chat API
 * 
 * @example
 * import ChatAPIExample from './examples/ChatAPIExample';
 */

import React, { useState } from 'react';
import {
  ChatAPI,
  type ChatResponse,
  type StreamChunk,
  type ChatError,
  StreamManager,
} from '../src/services/api/chat';

// ================================
// 示例 1: 基础消息发送
// ================================

export function BasicChatExample() {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSend = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await ChatAPI.sendMessage({
        message: '你好，请介绍一下自己',
        session_id: 'example_session_001',
        temperature: 0.7,
      });

      setResponse(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">基础消息发送</h2>
      <button
        onClick={handleSend}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? '发送中...' : '发送消息'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {response && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

// ================================
// 示例 2: 流式响应
// ================================

export function StreamingChatExample() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [streamManager, setStreamManager] = useState<StreamManager | null>(null);

  const handleStreamSend = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const manager = await ChatAPI.sendMessageStream(
        {
          message: '请写一首关于春天的诗',
          session_id: 'streaming_session_001',
          temperature: 0.8,
          stream: true,
        },
        {
          onChunk: (chunk: StreamChunk) => {
            if (chunk.delta) {
              setMessage((prev) => prev + chunk.delta);
            }
          },
          onComplete: (response) => {
            console.log('流式响应完成:', response);
            setLoading(false);
          },
          onError: (err: ChatError) => {
            setError(err.message);
            setLoading(false);
          },
        }
      );

      setStreamManager(manager);
    } catch (err) {
      setError(err instanceof Error ? err.message : '流式发送失败');
      setLoading(false);
    }
  };

  const handleStop = () => {
    if (streamManager) {
      streamManager.abort();
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">流式响应示例</h2>
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleStreamSend}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '接收中...' : '开始流式传输'}
        </button>
        {loading && (
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            停止
          </button>
        )}
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {message && (
        <div className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap">
          {message}
          {loading && <span className="animate-pulse">▋</span>}
        </div>
      )}
    </div>
  );
}

// ================================
// 示例 3: 历史记录管理
// ================================

export function ChatHistoryExample() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await ChatAPI.getHistory('example_session_001', 20);
      setMessages(history.messages);
    } catch (err) {
      console.error('加载历史失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await ChatAPI.clearHistory('example_session_001');
      setMessages([]);
    } catch (err) {
      console.error('清空历史失败:', err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">历史记录管理</h2>
      <div className="flex gap-2 mb-4">
        <button
          onClick={loadHistory}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          加载历史
        </button>
        <button
          onClick={clearHistory}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          清空历史
        </button>
      </div>
      <div className="space-y-2">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded ${
              msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <span className="font-bold">{msg.role}:</span> {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================
// 示例 4: 模型管理
// ================================

export function ModelManagementExample() {
  const [models, setModels] = useState<any[]>([]);
  const [currentModel, setCurrentModel] = useState<any>(null);

  const loadModels = async () => {
    try {
      const availableModels = await ChatAPI.getAvailableModels();
      setModels(availableModels);

      const current = await ChatAPI.getCurrentModel();
      setCurrentModel(current);
    } catch (err) {
      console.error('加载模型失败:', err);
    }
  };

  const switchModel = async (modelId: string, adapterId?: string) => {
    try {
      await ChatAPI.setModel({ model_id: modelId, adapter_id: adapterId });
      const current = await ChatAPI.getCurrentModel();
      setCurrentModel(current);
    } catch (err) {
      console.error('切换模型失败:', err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">模型管理</h2>
      <button
        onClick={loadModels}
        className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
      >
        加载可用模型
      </button>
      
      {currentModel && (
        <div className="mb-4 p-4 bg-green-100 rounded">
          <h3 className="font-bold">当前模型:</h3>
          <p>{currentModel.model_id}</p>
        </div>
      )}

      <div className="space-y-2">
        {models.map((model, index) => (
          <div
            key={index}
            className="p-3 bg-gray-100 rounded flex justify-between items-center"
          >
            <div>
              <p className="font-bold">{model.display_name || model.model_id}</p>
              {model.description && (
                <p className="text-sm text-gray-600">{model.description}</p>
              )}
            </div>
            <button
              onClick={() => switchModel(model.model_id, model.adapter_id)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              使用
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================
// 示例 5: 批量操作
// ================================

export function BatchOperationsExample() {
  const [results, setResults] = useState<any>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const handleBatchSend = async () => {
    setLoading(true);
    setResults(null);

    const messages = [
      { message: '什么是人工智能？', session_id: 'batch_001' },
      { message: '什么是机器学习？', session_id: 'batch_002' },
      { message: '什么是深度学习？', session_id: 'batch_003' },
      { message: '什么是神经网络？', session_id: 'batch_004' },
    ];

    try {
      const result = await ChatAPI.sendBatch(messages, {
        concurrency: 2,
        continueOnError: true,
        onProgress: (completed, total) => {
          setProgress({ completed, total });
        },
      });

      setResults(result);
    } catch (err) {
      console.error('批量发送失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">批量操作</h2>
      <button
        onClick={handleBatchSend}
        disabled={loading}
        className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
      >
        批量发送 4 条消息
      </button>

      {loading && (
        <div className="mt-4">
          <p>
            进度: {progress.completed} / {progress.total}
          </p>
          <div className="w-full bg-gray-200 rounded h-4 mt-2">
            <div
              className="bg-purple-500 h-4 rounded transition-all"
              style={{
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {results && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">成功: {results.success.length}</h3>
          <h3 className="font-bold mb-2">失败: {results.failed.length}</h3>
          
          {results.success.map((response: ChatResponse, index: number) => (
            <div key={index} className="p-3 bg-green-100 rounded mb-2">
              <p className="text-sm">{response.message}</p>
            </div>
          ))}

          {results.failed.map((item: any, index: number) => (
            <div key={index} className="p-3 bg-red-100 rounded mb-2">
              <p className="text-sm font-bold">错误: {item.error.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================
// 示例 6: 工具函数使用
// ================================

export function UtilityFunctionsExample() {
  const [text, setText] = useState('这是一段测试文本，用来估算 token 数量。');
  const [tokenEstimate, setTokenEstimate] = useState(0);

  const estimateTokens = () => {
    const estimate = ChatAPI.estimateTokens(text);
    setTokenEstimate(estimate);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">工具函数使用</h2>
      
      <div className="mb-4">
        <label className="block mb-2 font-bold">消息验证:</label>
        <input
          type="text"
          placeholder="输入消息测试验证"
          className="w-full p-2 border rounded"
          onBlur={(e) => {
            const validation = ChatAPI.validateMessage(e.target.value);
            if (!validation.valid) {
              alert(validation.error);
            } else {
              alert('消息格式正确！');
            }
          }}
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-bold">Token 估算:</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          rows={4}
        />
        <button
          onClick={estimateTokens}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          估算 Tokens
        </button>
        {tokenEstimate > 0 && (
          <p className="mt-2">
            估算 Token 数量: <strong>{tokenEstimate}</strong>
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-bold">会话 ID 生成:</label>
        <button
          onClick={() => {
            const sessionId = ChatAPI.generateSessionId();
            alert(`新会话 ID: ${sessionId}`);
          }}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          生成会话 ID
        </button>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-bold">消息 ID 生成:</label>
        <button
          onClick={() => {
            const messageId = ChatAPI.generateMessageId();
            alert(`新消息 ID: ${messageId}`);
          }}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          生成消息 ID
        </button>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-bold">时间格式化:</label>
        <div className="space-y-1">
          <p>刚刚: {ChatAPI.formatMessageTime(Date.now())}</p>
          <p>5分钟前: {ChatAPI.formatMessageTime(Date.now() - 5 * 60 * 1000)}</p>
          <p>2小时前: {ChatAPI.formatMessageTime(Date.now() - 2 * 60 * 60 * 1000)}</p>
          <p>3天前: {ChatAPI.formatMessageTime(Date.now() - 3 * 24 * 60 * 60 * 1000)}</p>
        </div>
      </div>
    </div>
  );
}

// ================================
// 综合示例组件
// ================================

export default function ChatAPIExample() {
  const [activeTab, setActiveTab] = useState(0);

  const examples = [
    { title: '基础发送', component: BasicChatExample },
    { title: '流式响应', component: StreamingChatExample },
    { title: '历史管理', component: ChatHistoryExample },
    { title: '模型管理', component: ModelManagementExample },
    { title: '批量操作', component: BatchOperationsExample },
    { title: '工具函数', component: UtilityFunctionsExample },
  ];

  const ActiveComponent = examples[activeTab].component;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Chat API 使用示例</h1>
      
      <div className="flex gap-2 mb-6 flex-wrap">
        {examples.map((example, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 rounded ${
              activeTab === index
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {example.title}
          </button>
        ))}
      </div>

      <div className="border rounded-lg">
        <ActiveComponent />
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold mb-2">💡 提示</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>所有 API 调用都是异步的，需要使用 async/await</li>
          <li>流式响应需要正确处理回调函数</li>
          <li>记得在组件卸载时停止流式传输</li>
          <li>批量操作支持设置并发数量和错误处理策略</li>
          <li>使用工具函数可以提高代码质量和用户体验</li>
        </ul>
      </div>
    </div>
  );
}


/**
 * 聊天功能使用示例
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../src/hooks/useChat';
import type { Message } from '../src/hooks/useChat';

// ================================
// 基础聊天组件示例
// ================================

export function BasicChatExample() {
  const [input, setInput] = useState('');
  const {
    messages,
    sessionId,
    isSending,
    sendMessage,
    clearHistory,
  } = useChat({
    autoLoadHistory: true,
    defaultModel: 'gpt-4',
    defaultCharacter: 'shizuku',
    onError: (error) => {
      console.error('聊天错误:', error);
      alert(`错误: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="chat-container" style={styles.container}>
      {/* 标题栏 */}
      <div className="chat-header" style={styles.header}>
        <h2>与紫舒老师对话</h2>
        <span className="session-id">会话: {sessionId}</span>
        <button onClick={clearHistory} style={styles.clearButton}>
          清空历史
        </button>
      </div>

      {/* 消息列表 */}
      <div className="messages" style={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isSending && <LoadingIndicator />}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          disabled={isSending}
          style={styles.input}
        />
        <button type="submit" disabled={isSending} style={styles.sendButton}>
          {isSending ? '发送中...' : '发送'}
        </button>
      </form>
    </div>
  );
}

// ================================
// 高级聊天组件示例（带模型选择）
// ================================

export function AdvancedChatExample() {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sessionId,
    isSending,
    error,
    sendMessage,
    resendLastMessage,
    clearHistory,
    setModel,
    addSystemMessage,
  } = useChat({
    autoLoadHistory: true,
    defaultModel: selectedModel,
    defaultCharacter: 'shizuku',
    maxContextMessages: 20,
    onError: (error) => {
      console.error('聊天错误:', error);
    },
    onMessageSent: (message, response) => {
      console.log('消息已发送:', message);
      console.log('Token 使用:', response.usage);
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    await sendMessage(input, {
      temperature: 0.7,
      max_tokens: 2048,
    });
    setInput('');
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    await setModel(modelId);
    addSystemMessage(`已切换到模型: ${modelId}`);
  };

  return (
    <div className="advanced-chat" style={styles.container}>
      {/* 控制栏 */}
      <div className="controls" style={styles.controls}>
        <select
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
          style={styles.select}
        >
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="claude-3">Claude 3</option>
        </select>

        <button onClick={clearHistory} style={styles.button}>
          清空
        </button>

        {error && (
          <button onClick={resendLastMessage} style={styles.retryButton}>
            重试
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="messages" style={styles.messagesAdvanced}>
        {messages.map((msg) => (
          <MessageBubbleAdvanced key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error" style={styles.error}>
          ⚠️ {error.message}
        </div>
      )}

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} style={styles.formAdvanced}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息... (按 Enter 发送)"
          disabled={isSending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          style={styles.textarea}
          rows={3}
        />
        <button type="submit" disabled={isSending || !input.trim()} style={styles.sendButtonLarge}>
          {isSending ? '💭 思考中...' : '📤 发送'}
        </button>
      </form>
    </div>
  );
}

// ================================
// 消息气泡组件
// ================================

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={`message ${message.role}`}
      style={{
        ...styles.messageBubble,
        ...(isUser ? styles.userMessage : isSystem ? styles.systemMessage : styles.assistantMessage),
      }}
    >
      <div style={styles.messageHeader}>
        <strong>{isUser ? '你' : isSystem ? '系统' : '紫舒老师'}</strong>
        {message.processing_time && (
          <span style={styles.processingTime}>⏱️ {message.processing_time.toFixed(2)}s</span>
        )}
      </div>
      <p style={styles.messageContent}>{message.content}</p>
      {message.emotion && <span style={styles.emotion}>😊 {message.emotion}</span>}
    </div>
  );
}

function MessageBubbleAdvanced({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const getAvatar = () => {
    if (isUser) return '👤';
    if (isSystem) return '⚙️';
    return '🎭';
  };

  return (
    <div
      style={{
        ...styles.messageBubbleAdvanced,
        ...(isUser && styles.messageBubbleUser),
      }}
    >
      <div style={styles.avatar}>{getAvatar()}</div>
      <div style={styles.messageContentWrapper}>
        <div style={styles.messageMeta}>
          <span style={styles.messageName}>
            {isUser ? '你' : isSystem ? '系统' : '紫舒老师'}
          </span>
          <span style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div style={styles.messageText}>{message.content}</div>
        {message.processing_time && (
          <div style={styles.messageFooter}>
            处理时间: {message.processing_time.toFixed(2)}秒
          </div>
        )}
      </div>
    </div>
  );
}

// ================================
// 加载指示器
// ================================

function LoadingIndicator() {
  return (
    <div style={styles.loading}>
      <span>💭</span>
      <span>紫舒老师正在思考...</span>
    </div>
  );
}

// ================================
// 样式定义
// ================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '20px',
    backgroundColor: '#6200ea',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controls: {
    padding: '10px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    gap: '10px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#6200ea',
    color: 'white',
    cursor: 'pointer',
  },
  clearButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    cursor: 'pointer',
  },
  retryButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#ff5722',
    color: 'white',
    cursor: 'pointer',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  messagesAdvanced: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    backgroundColor: '#ffffff',
  },
  messageBubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    maxWidth: '70%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6200ea',
    color: 'white',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    border: '1px solid #ddd',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: '#fff3cd',
    color: '#856404',
    fontSize: '0.9em',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    fontSize: '0.9em',
  },
  messageContent: {
    margin: 0,
    lineHeight: 1.5,
  },
  processingTime: {
    fontSize: '0.8em',
    opacity: 0.7,
  },
  emotion: {
    fontSize: '0.8em',
    marginTop: '4px',
    display: 'block',
  },
  messageBubbleAdvanced: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  },
  messageBubbleUser: {
    flexDirection: 'row-reverse' as const,
    backgroundColor: '#e3f2fd',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  messageContentWrapper: {
    flex: 1,
  },
  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  messageName: {
    fontWeight: 'bold' as const,
    fontSize: '0.9em',
  },
  messageTime: {
    fontSize: '0.8em',
    color: '#666',
  },
  messageText: {
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
  },
  messageFooter: {
    marginTop: '8px',
    fontSize: '0.8em',
    color: '#666',
  },
  form: {
    padding: '20px',
    backgroundColor: 'white',
    borderTop: '1px solid #ddd',
    display: 'flex',
    gap: '10px',
  },
  formAdvanced: {
    padding: '20px',
    backgroundColor: 'white',
    borderTop: '2px solid #6200ea',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6200ea',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
  },
  sendButtonLarge: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6200ea',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  loading: {
    padding: '12px',
    textAlign: 'center' as const,
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderLeft: '4px solid #c62828',
    margin: '0 20px',
  },
};

export default BasicChatExample;


/**
 * VoiceInput 组件示例
 * 
 * 展示 VoiceInput 组件的各种使用场景和配置选项
 * 
 * @module VoiceInput.example
 */

import React, { useState } from 'react'
import { VoiceInput, VoiceStatus, VoiceResult, VoiceErrorType } from './index'

/**
 * 示例容器样式
 */
const exampleContainerStyle: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '48px',
  padding: '24px',
  background: '#f8f9fa',
  borderRadius: '12px',
  border: '1px solid #e0e0e0',
}

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  marginBottom: '16px',
  color: '#333',
}

const descriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  marginBottom: '20px',
  lineHeight: 1.6,
}

const codeBlockStyle: React.CSSProperties = {
  background: '#2d2d2d',
  color: '#f8f8f2',
  padding: '16px',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: 'Monaco, Consolas, monospace',
  overflow: 'auto',
  marginTop: '12px',
}

const logContainerStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  background: '#fff',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
  maxHeight: '200px',
  overflow: 'auto',
  fontSize: '13px',
  fontFamily: 'Monaco, Consolas, monospace',
}

const logEntryStyle: React.CSSProperties = {
  padding: '4px 0',
  borderBottom: '1px solid #f0f0f0',
}

/**
 * 示例 1: 基础用法
 */
const BasicExample: React.FC = () => {
  const [result, setResult] = useState('')

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>1. 基础用法</h2>
      <p style={descriptionStyle}>
        最简单的语音输入示例，使用默认配置。点击按钮开始录音，再次点击停止。
      </p>
      
      <VoiceInput
        onFinalResult={(text) => setResult(text)}
        aria-label="基础语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  onFinalResult={(text) => setResult(text)}
  aria-label="基础语音输入"
/>`}</pre>
    </div>
  )
}

/**
 * 示例 2: 显示中间结果
 */
const InterimResultsExample: React.FC = () => {
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')

  const handleResult = (result: VoiceResult) => {
    if (result.isFinal) {
      setFinalText(prev => prev + result.text + ' ')
      setInterimText('')
    } else {
      setInterimText(result.text)
    }
  }

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>2. 显示中间结果</h2>
      <p style={descriptionStyle}>
        实时显示语音识别的中间结果，提供即时反馈。中间结果以灰色斜体显示，最终结果为黑色。
      </p>
      
      <VoiceInput
        showInterimResults={true}
        onResult={handleResult}
        aria-label="带中间结果的语音输入"
      />
      
      <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
        {finalText && (
          <div style={{ marginBottom: '8px' }}>
            <strong>最终结果：</strong>
            <div style={{ color: '#333', marginTop: '4px' }}>{finalText}</div>
          </div>
        )}
        {interimText && (
          <div>
            <strong>中间结果：</strong>
            <div style={{ color: '#999', fontStyle: 'italic', marginTop: '4px' }}>{interimText}</div>
          </div>
        )}
      </div>
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  showInterimResults={true}
  onResult={(result) => {
    if (result.isFinal) {
      setFinalText(prev => prev + result.text + ' ')
      setInterimText('')
    } else {
      setInterimText(result.text)
    }
  }}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 3: 多语言支持
 */
const MultiLanguageExample: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN')
  const [result, setResult] = useState('')

  const languages = [
    { code: 'zh-CN', name: '中文（简体）', region: '中国' },
    { code: 'zh-TW', name: '中文（繁體）', region: '台灣' },
    { code: 'en-US', name: 'English', region: 'United States' },
    { code: 'ja-JP', name: '日本語', region: '日本' },
    { code: 'ko-KR', name: '한국어', region: '대한민국' },
    { code: 'es-ES', name: 'Español', region: 'España' },
    { code: 'fr-FR', name: 'Français', region: 'France' },
  ]

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>3. 多语言支持</h2>
      <p style={descriptionStyle}>
        支持多种语言的语音识别。组件会自动显示语言选择器。
      </p>
      
      <VoiceInput
        defaultLanguage={selectedLanguage}
        supportedLanguages={languages}
        onFinalResult={setResult}
        aria-label="多语言语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果（{languages.find(l => l.code === selectedLanguage)?.name}）：</strong>
          <div style={{ marginTop: '4px' }}>{result}</div>
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`const languages = [
  { code: 'zh-CN', name: '中文（简体）', region: '中国' },
  { code: 'en-US', name: 'English', region: 'United States' },
  // ... more languages
]

<VoiceInput
  defaultLanguage="zh-CN"
  supportedLanguages={languages}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 4: 限制录音时长
 */
const MaxDurationExample: React.FC = () => {
  const [result, setResult] = useState('')
  const [duration, setDuration] = useState(0)

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>4. 限制录音时长</h2>
      <p style={descriptionStyle}>
        设置最大录音时长（本例为 30 秒），超时后自动停止录音。
      </p>
      
      <VoiceInput
        maxDuration={30000} // 30 秒
        onFinalResult={setResult}
        onStatusChange={(status) => {
          if (status === VoiceStatus.IDLE) {
            setDuration(0)
          }
        }}
        aria-label="限时语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  maxDuration={30000} // 30 秒
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 5: 完整事件处理
 */
const FullEventsExample: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<VoiceStatus>(VoiceStatus.IDLE)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const clearLogs = () => setLogs([])

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>5. 完整事件处理</h2>
      <p style={descriptionStyle}>
        监听所有可用的事件回调，包括开始、停止、结果、错误和状态变化。
      </p>
      
      <VoiceInput
        showInterimResults={true}
        onStart={() => addLog('✅ 开始录音')}
        onStop={() => addLog('⏹️ 停止录音')}
        onResult={(result) => {
          if (result.isFinal) {
            addLog(`📝 最终结果: "${result.text}" (置信度: ${(result.confidence! * 100).toFixed(1)}%)`)
          } else {
            addLog(`💬 中间结果: "${result.text}"`)
          }
        }}
        onFinalResult={(text) => addLog(`✨ 完整文本: "${text}"`)}
        onError={(errorType, message) => addLog(`❌ 错误 [${errorType}]: ${message}`)}
        onStatusChange={(newStatus) => {
          setStatus(newStatus)
          addLog(`🔄 状态变化: ${newStatus}`)
        }}
        aria-label="完整事件语音输入"
      />
      
      <div style={logContainerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <strong>事件日志（当前状态: {status}）</strong>
          <button
            onClick={clearLogs}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            清空日志
          </button>
        </div>
        {logs.length === 0 ? (
          <div style={{ color: '#999', fontStyle: 'italic' }}>暂无日志</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={logEntryStyle}>{log}</div>
          ))
        )}
      </div>
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  onStart={() => console.log('开始录音')}
  onStop={() => console.log('停止录音')}
  onResult={(result) => console.log('结果:', result)}
  onFinalResult={(text) => console.log('最终:', text)}
  onError={(errorType, message) => console.error(errorType, message)}
  onStatusChange={(status) => console.log('状态:', status)}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 6: 禁用音频可视化
 */
const NoVisualizerExample: React.FC = () => {
  const [result, setResult] = useState('')

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>6. 禁用音频可视化</h2>
      <p style={descriptionStyle}>
        关闭音频波形可视化效果，适用于简洁的 UI 设计。
      </p>
      
      <VoiceInput
        showVisualizer={false}
        onFinalResult={setResult}
        aria-label="无可视化语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  showVisualizer={false}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 7: 自定义样式
 */
const CustomStyleExample: React.FC = () => {
  const [result, setResult] = useState('')

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>7. 自定义样式</h2>
      <p style={descriptionStyle}>
        通过 className 和 style 属性自定义组件外观。
      </p>
      
      <VoiceInput
        onFinalResult={setResult}
        style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
        }}
        aria-label="自定义样式语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  style={{
    padding: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
  }}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 8: 自定义图标
 */
const CustomIconsExample: React.FC = () => {
  const [result, setResult] = useState('')

  const customIcons = {
    idle: '⭕',
    listening: '🔴',
    processing: '⏳',
    error: '⚠️',
  }

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>8. 自定义图标</h2>
      <p style={descriptionStyle}>
        为不同状态提供自定义图标或 React 组件。
      </p>
      
      <VoiceInput
        icons={customIcons}
        onFinalResult={setResult}
        aria-label="自定义图标语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`const customIcons = {
  idle: '⭕',
  listening: '🔴',
  processing: '⏳',
  error: '⚠️',
}

<VoiceInput
  icons={customIcons}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 9: 禁用状态
 */
const DisabledExample: React.FC = () => {
  const [isDisabled, setIsDisabled] = useState(true)
  const [result, setResult] = useState('')

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>9. 禁用状态</h2>
      <p style={descriptionStyle}>
        组件可以被禁用，适用于需要等待其他操作完成的场景。
      </p>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isDisabled}
            onChange={(e) => setIsDisabled(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>禁用语音输入</span>
        </label>
      </div>
      
      <VoiceInput
        disabled={isDisabled}
        onFinalResult={setResult}
        aria-label="可禁用语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  disabled={isDisabled}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 示例 10: 非连续模式
 */
const NonContinuousExample: React.FC = () => {
  const [result, setResult] = useState('')

  return (
    <div style={sectionStyle}>
      <h2 style={titleStyle}>10. 非连续模式</h2>
      <p style={descriptionStyle}>
        设置 continuous={'{false}'} 后，识别到第一句话后会自动停止，而不是持续监听。
      </p>
      
      <VoiceInput
        continuous={false}
        onFinalResult={setResult}
        aria-label="非连续语音输入"
      />
      
      {result && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '8px' }}>
          <strong>识别结果：</strong> {result}
        </div>
      )}
      
      <pre style={codeBlockStyle}>{`<VoiceInput
  continuous={false}
  onFinalResult={setResult}
/>`}</pre>
    </div>
  )
}

/**
 * 主示例组件
 */
export const VoiceInputExamples: React.FC = () => {
  return (
    <div style={exampleContainerStyle}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: '#222' }}>
        VoiceInput 组件示例
      </h1>
      <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
        这里展示了 VoiceInput 组件的各种用法和配置选项。
        VoiceInput 是一个功能强大的语音输入组件，基于 Web Speech API 实现。
      </p>
      
      <div style={{ 
        padding: '16px', 
        background: '#fff3cd', 
        border: '1px solid #ffc107',
        borderRadius: '8px',
        marginBottom: '32px',
      }}>
        <strong>⚠️ 注意事项：</strong>
        <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
          <li>语音识别功能需要在支持的浏览器中使用（Chrome、Edge、Safari）</li>
          <li>首次使用需要授予麦克风权限</li>
          <li>某些浏览器可能需要 HTTPS 才能使用语音识别</li>
          <li>语音识别服务可能需要网络连接</li>
        </ul>
      </div>
      
      <BasicExample />
      <InterimResultsExample />
      <MultiLanguageExample />
      <MaxDurationExample />
      <FullEventsExample />
      <NoVisualizerExample />
      <CustomStyleExample />
      <CustomIconsExample />
      <DisabledExample />
      <NonContinuousExample />
      
      <div style={{
        marginTop: '48px',
        padding: '24px',
        background: '#e3f2fd',
        borderRadius: '12px',
        border: '1px solid #2196f3',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1976d2' }}>
          📚 更多资源
        </h3>
        <ul style={{ marginBottom: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>
            <a href="#" style={{ color: '#2196f3', textDecoration: 'none' }}>
              VoiceInput API 文档
            </a>
          </li>
          <li>
            <a href="#" style={{ color: '#2196f3', textDecoration: 'none' }}>
              Web Speech API 规范
            </a>
          </li>
          <li>
            <a href="#" style={{ color: '#2196f3', textDecoration: 'none' }}>
              无障碍最佳实践
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default VoiceInputExamples


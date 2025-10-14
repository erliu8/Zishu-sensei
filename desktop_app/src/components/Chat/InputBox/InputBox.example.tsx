/**
 * InputBox 组件使用示例
 * 
 * 展示各种使用场景和配置选项
 * @module InputBox/Example
 */

import React, { useState } from 'react'
import { InputBox } from './index'
import type { Attachment, Suggestion } from './InputBox.types'

/**
 * 基础示例
 */
export function BasicExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string, attachments: Attachment[]) => {
    console.log('发送消息:', { text, attachments })
    setValue('')
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      placeholder="输入消息..."
    />
  )
}

/**
 * 带附件上传的示例
 */
export function WithAttachmentsExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string, attachments: Attachment[]) => {
    console.log('发送消息:', { text, attachments })
    setValue('')
  }
  
  const handleAttachmentAdd = (file: File, attachment: Attachment) => {
    console.log('添加附件:', file.name)
  }
  
  const handleAttachmentRemove = (attachment: Attachment) => {
    console.log('移除附件:', attachment.name)
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      enableAttachments
      maxAttachments={3}
      maxFileSize={5 * 1024 * 1024} // 5MB
      acceptedFileTypes={['image/*', '.pdf', '.doc', '.docx']}
      onAttachmentAdd={handleAttachmentAdd}
      onAttachmentRemove={handleAttachmentRemove}
    />
  )
}

/**
 * 带建议的示例
 */
export function WithSuggestionsExample() {
  const [value, setValue] = useState('')
  
  const suggestions: Suggestion[] = [
    {
      id: '1',
      text: '你好，我需要帮助',
      icon: '👋',
      type: 'prompt',
    },
    {
      id: '2',
      text: '谢谢你的帮助！',
      icon: '🙏',
      type: 'quick_reply',
    },
    {
      id: '3',
      text: '请告诉我更多详情',
      icon: '💡',
      type: 'prompt',
    },
  ]
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    console.log('选择建议:', suggestion.text)
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      enableSuggestions
      suggestions={suggestions}
      onSuggestionSelect={handleSuggestionSelect}
    />
  )
}

/**
 * 带字符计数的示例
 */
export function WithCharCountExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      showCharCount
      maxLength={500}
    />
  )
}

/**
 * 带验证的示例
 */
export function WithValidationExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  const handleValidationError = (errors: string[]) => {
    console.error('验证错误:', errors)
    alert(errors.join('\n'))
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      validationRules={[
        {
          minLength: 5,
          message: '消息至少需要 5 个字符',
        },
        {
          maxLength: 200,
          message: '消息最多 200 个字符',
        },
        {
          validator: (text) => !text.includes('spam'),
          message: '消息不能包含敏感词',
        },
      ]}
      onValidationError={handleValidationError}
    />
  )
}

/**
 * 不同快捷键的示例
 */
export function DifferentShortcutsExample() {
  const [value, setValue] = useState('')
  const [shortcut, setShortcut] = useState<'enter' | 'ctrl+enter'>('ctrl+enter')
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="radio"
            checked={shortcut === 'enter'}
            onChange={() => setShortcut('enter')}
          />
          Enter 发送
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="radio"
            checked={shortcut === 'ctrl+enter'}
            onChange={() => setShortcut('ctrl+enter')}
          />
          Ctrl+Enter 发送
        </label>
      </div>
      
      <InputBox
        value={value}
        onChange={setValue}
        onSend={handleSend}
        sendShortcut={shortcut}
      />
    </div>
  )
}

/**
 * 流式响应状态示例
 */
export function StreamingExample() {
  const [value, setValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
    
    // 模拟流式响应
    setIsStreaming(true)
    setTimeout(() => setIsStreaming(false), 3000)
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      streaming={isStreaming}
      disabled={isStreaming}
    />
  )
}

/**
 * 不同尺寸和变体的示例
 */
export function VariantsExample() {
  const [value, setValue] = useState('')
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3>默认变体 - 小尺寸</h3>
        <InputBox
          value={value}
          onChange={setValue}
          variant="default"
          size="small"
        />
      </div>
      
      <div>
        <h3>默认变体 - 中尺寸</h3>
        <InputBox
          value={value}
          onChange={setValue}
          variant="default"
          size="medium"
        />
      </div>
      
      <div>
        <h3>默认变体 - 大尺寸</h3>
        <InputBox
          value={value}
          onChange={setValue}
          variant="default"
          size="large"
        />
      </div>
      
      <div>
        <h3>边框变体</h3>
        <InputBox
          value={value}
          onChange={setValue}
          variant="bordered"
        />
      </div>
      
      <div>
        <h3>填充变体</h3>
        <InputBox
          value={value}
          onChange={setValue}
          variant="filled"
        />
      </div>
    </div>
  )
}

/**
 * 拖拽上传示例
 */
export function DragDropExample() {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  
  const handleSend = (text: string, atts: Attachment[]) => {
    console.log('发送消息:', { text, attachments: atts })
    setValue('')
    setAttachments([])
  }
  
  return (
    <div style={{ padding: '20px', border: '2px dashed #ccc' }}>
      <p>拖拽文件到输入框上传</p>
      <InputBox
        value={value}
        onChange={setValue}
        onSend={handleSend}
        enableDragDrop
        enableAttachments
      />
    </div>
  )
}

/**
 * 表情选择器示例
 */
export function EmojiPickerExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      enableEmoji
    />
  )
}

/**
 * 自定义样式示例
 */
export function CustomStyleExample() {
  const [value, setValue] = useState('')
  
  const handleSend = (text: string) => {
    console.log('发送消息:', text)
    setValue('')
  }
  
  return (
    <InputBox
      value={value}
      onChange={setValue}
      onSend={handleSend}
      style={{
        border: '2px solid #2196f3',
        borderRadius: '12px',
        backgroundColor: '#f5f5f5',
      }}
    />
  )
}

/**
 * 只读和禁用状态示例
 */
export function DisabledStatesExample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3>正常状态</h3>
        <InputBox value="" placeholder="正常输入框" />
      </div>
      
      <div>
        <h3>只读状态</h3>
        <InputBox value="这是只读文本" readOnly />
      </div>
      
      <div>
        <h3>禁用状态</h3>
        <InputBox value="" placeholder="禁用的输入框" disabled />
      </div>
      
      <div>
        <h3>加载状态</h3>
        <InputBox value="" placeholder="加载中..." loading />
      </div>
    </div>
  )
}

/**
 * 完整功能示例
 */
export function FullFeaturedExample() {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  
  const suggestions: Suggestion[] = [
    { id: '1', text: '你好！', icon: '👋', type: 'quick_reply' },
    { id: '2', text: '谢谢！', icon: '🙏', type: 'quick_reply' },
    { id: '3', text: '我需要帮助', icon: '🆘', type: 'prompt' },
  ]
  
  const handleSend = (text: string, atts: Attachment[]) => {
    console.log('发送消息:', { text, attachments: atts })
    alert(`发送: ${text}\n附件数量: ${atts.length}`)
    setValue('')
    setAttachments([])
  }
  
  const handleAttachmentAdd = (file: File, attachment: Attachment) => {
    console.log('添加附件:', file.name)
    setAttachments([...attachments, attachment])
  }
  
  const handleAttachmentRemove = (attachment: Attachment) => {
    console.log('移除附件:', attachment.name)
    setAttachments(attachments.filter(a => a.id !== attachment.id))
  }
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>完整功能演示</h2>
      <InputBox
        value={value}
        onChange={setValue}
        onSend={handleSend}
        placeholder="输入消息... (支持拖拽上传文件)"
        
        // 功能开关
        enableAttachments
        enableEmoji
        enableVoice={false}
        enableSuggestions
        enableDragDrop
        enablePaste
        
        // 限制
        maxLength={1000}
        maxAttachments={5}
        maxFileSize={10 * 1024 * 1024}
        acceptedFileTypes={['image/*', '.pdf', '.doc', '.docx']}
        
        // 显示选项
        showCharCount
        
        // 建议
        suggestions={suggestions}
        
        // 样式
        variant="default"
        size="medium"
        
        // 快捷键
        sendShortcut="ctrl+enter"
        
        // 回调
        onAttachmentAdd={handleAttachmentAdd}
        onAttachmentRemove={handleAttachmentRemove}
        onSuggestionSelect={(s) => console.log('选择建议:', s.text)}
        
        // 验证
        validationRules={[
          { minLength: 1, message: '消息不能为空' },
          { maxLength: 1000, message: '消息过长' },
        ]}
        onValidationError={(errors) => console.error('验证错误:', errors)}
      />
    </div>
  )
}

/**
 * 所有示例的集合
 */
export function AllExamples() {
  return (
    <div style={{ padding: '40px' }}>
      <h1>InputBox 组件示例</h1>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>1. 基础示例</h2>
        <BasicExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>2. 带附件上传</h2>
        <WithAttachmentsExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>3. 带建议</h2>
        <WithSuggestionsExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>4. 带字符计数</h2>
        <WithCharCountExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>5. 带验证</h2>
        <WithValidationExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>6. 不同快捷键</h2>
        <DifferentShortcutsExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>7. 流式响应</h2>
        <StreamingExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>8. 拖拽上传</h2>
        <DragDropExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>9. 不同状态</h2>
        <DisabledStatesExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>10. 完整功能</h2>
        <FullFeaturedExample />
      </section>
    </div>
  )
}

export default AllExamples


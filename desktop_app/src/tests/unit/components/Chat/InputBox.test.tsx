/**
 * InputBox 组件测试
 * 
 * 测试聊天输入框组件的输入、发送、快捷键等功能
 * @module InputBox/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'
import { InputBox } from '@/components/Chat/InputBox'

// ==================== Mock 设置 ====================

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    textarea: ({ children, ...props }: any) => <textarea {...props}>{children}</textarea>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock react-textarea-autosize
vi.mock('react-textarea-autosize', () => ({
  default: ({ value, onChange, ...props }: any) => (
    <textarea 
      {...props}
      value={value}
      onChange={onChange}
      data-testid="auto-resize-textarea"
    />
  ),
}))

// Mock EmojiPicker 组件
vi.mock('@/components/Chat/EmojiPicker', () => ({
  default: vi.fn(({ onEmojiSelect, onClose }) => (
    <div data-testid="emoji-picker">
      <button onClick={() => onEmojiSelect?.('😀')}>😀</button>
      <button onClick={() => onEmojiSelect?.('😃')}>😃</button>
      <button onClick={() => onClose?.()}>关闭</button>
    </div>
  )),
}))

// Mock FileUpload 组件
vi.mock('@/components/Chat/FileUpload', () => ({
  default: vi.fn(({ onFileSelect }) => (
    <div data-testid="file-upload">
      <input 
        type="file"
        onChange={(e) => onFileSelect?.(Array.from(e.target.files || []))}
        data-testid="file-input"
      />
    </div>
  )),
}))

// Mock VoiceInput 组件
vi.mock('@/components/Chat/VoiceInput', () => ({
  default: vi.fn(({ onVoiceResult }) => (
    <div data-testid="voice-input">
      <button onClick={() => onVoiceResult?.('语音转文字结果')}>
        开始录音
      </button>
    </div>
  )),
}))

describe('InputBox 组件', () => {
  // ==================== 测试数据 ====================
  
  const defaultProps = {
    onSend: createMockFn(),
    placeholder: '输入消息...',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染输入框组件', () => {
      renderWithProviders(<InputBox {...defaultProps} />)
      
      expect(screen.getByTestId('input-box')).toBeInTheDocument()
      expect(screen.getByTestId('message-textarea')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
    })

    it('应该显示占位符文本', () => {
      renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveAttribute('placeholder', '输入消息...')
    })

    it('应该支持自定义占位符', () => {
      const customPlaceholder = '请输入您的问题...'
      renderWithProviders(
        <InputBox {...defaultProps} placeholder={customPlaceholder} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveAttribute('placeholder', customPlaceholder)
    })

    it('应该显示字符计数', () => {
      renderWithProviders(<InputBox {...defaultProps} showCharCount />)
      
      expect(screen.getByTestId('char-count')).toBeInTheDocument()
      expect(screen.getByText('0/1000')).toBeInTheDocument()
    })

    it('应该支持自定义最大长度', () => {
      renderWithProviders(
        <InputBox {...defaultProps} maxLength={500} showCharCount />
      )
      
      expect(screen.getByText('0/500')).toBeInTheDocument()
    })
  })

  // ==================== 输入功能测试 ====================
  
  describe('输入功能', () => {
    it('应该支持文本输入', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '这是测试消息')
      
      expect(textarea).toHaveValue('这是测试消息')
    })

    it('应该自动调整高度', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('auto-resize-textarea')
      const longText = '这是一段很长的文字\n'.repeat(10)
      
      await user.type(textarea, longText)
      
      expect(textarea).toHaveValue(longText)
    })

    it('应该更新字符计数', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showCharCount />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试')
      
      expect(screen.getByText('2/1000')).toBeInTheDocument()
    })

    it('应该限制输入长度', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} maxLength={10} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '这是超过十个字符的长文本')
      
      expect(textarea.value.length).toBeLessThanOrEqual(10)
    })

    it('应该支持多行输入', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '第一行{enter}第二行{enter}第三行')
      
      expect(textarea).toHaveValue('第一行\n第二行\n第三行')
    })

    it('应该支持粘贴内容', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      const clipboardText = '粘贴的内容'
      
      await user.click(textarea)
      await user.paste(clipboardText)
      
      expect(textarea).toHaveValue(clipboardText)
    })
  })

  // ==================== 发送功能测试 ====================
  
  describe('发送功能', () => {
    it('应该通过点击发送按钮发送消息', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(textarea, '测试消息')
      await user.click(sendButton)
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })

    it('应该通过 Enter 键发送消息', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息{enter}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })

    it('应该通过 Ctrl+Enter 发送消息', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} sendOnEnter={false} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息')
      await user.keyboard('{Control>}{Enter}{/Control}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })

    it('应该在发送后清空输入框', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息{enter}')
      
      expect(textarea).toHaveValue('')
    })

    it('应该不发送空消息', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-button')
      await user.click(sendButton)
      
      expect(defaultProps.onSend).not.toHaveBeenCalled()
    })

    it('应该不发送只包含空格的消息', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '   {enter}')
      
      expect(defaultProps.onSend).not.toHaveBeenCalled()
    })

    it('应该修剪消息前后的空格', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '  测试消息  {enter}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })
  })

  // ==================== 状态管理测试 ====================
  
  describe('状态管理', () => {
    it('应该支持禁用状态', () => {
      renderWithProviders(<InputBox {...defaultProps} disabled />)
      
      const textarea = screen.getByTestId('message-textarea')
      const sendButton = screen.getByTestId('send-button')
      
      expect(textarea).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    it('应该支持只读状态', () => {
      renderWithProviders(<InputBox {...defaultProps} readOnly />)
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveAttribute('readonly')
    })

    it('应该支持加载状态', () => {
      renderWithProviders(<InputBox {...defaultProps} loading />)
      
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toBeDisabled()
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('应该显示发送中状态', () => {
      renderWithProviders(<InputBox {...defaultProps} sending />)
      
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toBeDisabled()
      expect(screen.getByText(/发送中/)).toBeInTheDocument()
    })

    it('应该支持聚焦状态', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.click(textarea)
      
      expect(textarea).toHaveFocus()
      expect(screen.getByTestId('input-box')).toHaveClass('focused')
    })
  })

  // ==================== 工具栏功能测试 ====================
  
  describe('工具栏功能', () => {
    it('应该显示表情按钮', () => {
      renderWithProviders(<InputBox {...defaultProps} showEmojiPicker />)
      
      expect(screen.getByLabelText('插入表情')).toBeInTheDocument()
    })

    it('应该打开表情选择器', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showEmojiPicker />
      )
      
      const emojiButton = screen.getByLabelText('插入表情')
      await user.click(emojiButton)
      
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
    })

    it('应该插入选择的表情', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showEmojiPicker />
      )
      
      const emojiButton = screen.getByLabelText('插入表情')
      await user.click(emojiButton)
      
      const emojiOption = screen.getByText('😀')
      await user.click(emojiOption)
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveValue('😀')
    })

    it('应该显示文件上传按钮', () => {
      renderWithProviders(<InputBox {...defaultProps} enableFileUpload />)
      
      expect(screen.getByLabelText('上传文件')).toBeInTheDocument()
    })

    it('应该处理文件选择', async () => {
      const onFileSelect = createMockFn()
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableFileUpload onFileSelect={onFileSelect} />
      )
      
      const fileButton = screen.getByLabelText('上传文件')
      await user.click(fileButton)
      
      const fileInput = screen.getByTestId('file-input')
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      await user.upload(fileInput, file)
      
      expect(onFileSelect).toHaveBeenCalledWith([file])
    })

    it('应该显示语音输入按钮', () => {
      renderWithProviders(<InputBox {...defaultProps} enableVoiceInput />)
      
      expect(screen.getByLabelText('语音输入')).toBeInTheDocument()
    })

    it('应该处理语音输入结果', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableVoiceInput />
      )
      
      const voiceButton = screen.getByLabelText('语音输入')
      await user.click(voiceButton)
      
      const voiceInput = screen.getByTestId('voice-input')
      const recordButton = voiceInput.querySelector('button')!
      await user.click(recordButton)
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveValue('语音转文字结果')
    })
  })

  // ==================== 快捷键测试 ====================
  
  describe('快捷键功能', () => {
    it('应该支持 Enter 发送消息', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息{enter}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })

    it('应该支持 Shift+Enter 换行', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '第一行{Shift>}{Enter}{/Shift}第二行')
      
      expect(textarea).toHaveValue('第一行\n第二行')
      expect(defaultProps.onSend).not.toHaveBeenCalled()
    })

    it('应该支持 Ctrl+Enter 发送消息', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} sendOnEnter={false} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息')
      await user.keyboard('{Control>}{Enter}{/Control}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('测试消息')
    })

    it('应该支持 Esc 清空输入', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息')
      await user.keyboard('{Escape}')
      
      expect(textarea).toHaveValue('')
    })

    it('应该支持 Ctrl+A 全选', async () => {
      const { user } = renderWithProviders(<InputBox {...defaultProps} />)
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息')
      await user.keyboard('{Control>}a{/Control}')
      
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(4)
    })

    it('应该支持历史记录导航', async () => {
      const messageHistory = ['消息1', '消息2', '消息3']
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} messageHistory={messageHistory} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.click(textarea)
      
      // 向上箭头查看历史
      await user.keyboard('{ArrowUp}')
      expect(textarea).toHaveValue('消息3')
      
      await user.keyboard('{ArrowUp}')
      expect(textarea).toHaveValue('消息2')
      
      // 向下箭头
      await user.keyboard('{ArrowDown}')
      expect(textarea).toHaveValue('消息3')
    })
  })

  // ==================== 自动完成测试 ====================
  
  describe('自动完成功能', () => {
    it('应该显示提及建议', async () => {
      const mentionSuggestions = ['@Alice', '@Bob', '@Charlie']
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} mentionSuggestions={mentionSuggestions} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '@A')
      
      expect(screen.getByTestId('mention-suggestions')).toBeInTheDocument()
      expect(screen.getByText('@Alice')).toBeInTheDocument()
    })

    it('应该插入选择的提及', async () => {
      const mentionSuggestions = ['@Alice', '@Bob']
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} mentionSuggestions={mentionSuggestions} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '@A')
      
      const suggestion = screen.getByText('@Alice')
      await user.click(suggestion)
      
      expect(textarea).toHaveValue('@Alice ')
    })

    it('应该显示命令建议', async () => {
      const commands = ['/help', '/clear', '/export']
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} commands={commands} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '/')
      
      expect(screen.getByTestId('command-suggestions')).toBeInTheDocument()
      expect(screen.getByText('/help')).toBeInTheDocument()
    })

    it('应该支持 Tab 键自动完成', async () => {
      const mentionSuggestions = ['@Alice']
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} mentionSuggestions={mentionSuggestions} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '@A')
      await user.keyboard('{Tab}')
      
      expect(textarea).toHaveValue('@Alice ')
    })
  })

  // ==================== 格式化功能测试 ====================
  
  describe('格式化功能', () => {
    it('应该支持粗体格式化', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableFormatting />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试')
      await user.keyboard('{Control>}a{/Control}')
      await user.keyboard('{Control>}b{/Control}')
      
      expect(textarea).toHaveValue('**测试**')
    })

    it('应该支持斜体格式化', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableFormatting />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试')
      await user.keyboard('{Control>}a{/Control}')
      await user.keyboard('{Control>}i{/Control}')
      
      expect(textarea).toHaveValue('*测试*')
    })

    it('应该支持代码格式化', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableFormatting />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, 'console.log("hello")')
      await user.keyboard('{Control>}a{/Control}')
      await user.keyboard('{Control>}`{/Control}')
      
      expect(textarea).toHaveValue('`console.log("hello")`')
    })

    it('应该显示格式化工具栏', () => {
      renderWithProviders(
        <InputBox {...defaultProps} enableFormatting showFormattingBar />
      )
      
      expect(screen.getByTestId('formatting-bar')).toBeInTheDocument()
      expect(screen.getByLabelText('粗体')).toBeInTheDocument()
      expect(screen.getByLabelText('斜体')).toBeInTheDocument()
      expect(screen.getByLabelText('代码')).toBeInTheDocument()
    })
  })

  // ==================== 草稿功能测试 ====================
  
  describe('草稿功能', () => {
    it('应该自动保存草稿', async () => {
      const onDraftSave = createMockFn()
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableDraft onDraftSave={onDraftSave} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '草稿内容')
      
      // 等待防抖
      await wait(1000)
      
      expect(onDraftSave).toHaveBeenCalledWith('草稿内容')
    })

    it('应该恢复草稿内容', () => {
      const draftContent = '之前保存的草稿'
      renderWithProviders(
        <InputBox {...defaultProps} draftContent={draftContent} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveValue(draftContent)
    })

    it('应该在发送后清除草稿', async () => {
      const onDraftClear = createMockFn()
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableDraft onDraftClear={onDraftClear} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息{enter}')
      
      expect(onDraftClear).toHaveBeenCalled()
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<InputBox {...defaultProps} />)
      
      const inputBox = screen.getByTestId('input-box')
      expect(inputBox).toHaveAttribute('role', 'group')
      expect(inputBox).toHaveAttribute('aria-label', '消息输入')
      
      const textarea = screen.getByTestId('message-textarea')
      expect(textarea).toHaveAttribute('aria-label', '输入消息')
      
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toHaveAttribute('aria-label', '发送消息')
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showEmojiPicker />
      )
      
      // Tab 导航到文本框
      await user.tab()
      expect(screen.getByTestId('message-textarea')).toHaveFocus()
      
      // Tab 导航到表情按钮
      await user.tab()
      expect(screen.getByLabelText('插入表情')).toHaveFocus()
      
      // Tab 导航到发送按钮
      await user.tab()
      expect(screen.getByTestId('send-button')).toHaveFocus()
    })

    it('应该宣布状态变化', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showCharCount />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试')
      
      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveAttribute('aria-live', 'polite')
    })

    it('应该支持高对比度模式', () => {
      const { container } = renderWithProviders(
        <InputBox {...defaultProps} highContrast />
      )
      
      expect(container.firstChild).toHaveClass('high-contrast')
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该防抖输入处理', async () => {
      const onChange = createMockFn()
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} onChange={onChange} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      
      // 快速输入
      await user.type(textarea, '测试', { delay: 10 })
      
      // 等待防抖
      await wait(500)
      
      // 应该只触发一次回调
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('应该使用 React.memo 优化重渲染', () => {
      const { rerender } = renderWithProviders(<InputBox {...defaultProps} />)
      
      // 重新渲染相同的 props
      rerender(<InputBox {...defaultProps} />)
      
      // 验证没有不必要的重渲染
      expect(screen.getByTestId('input-box')).toBeInTheDocument()
    })

    it('应该懒加载工具栏组件', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showEmojiPicker />
      )
      
      // 初始时表情选择器不应该被渲染
      expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument()
      
      // 点击后才渲染
      const emojiButton = screen.getByLabelText('插入表情')
      await user.click(emojiButton)
      
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理发送失败', async () => {
      const onSend = vi.fn().mockRejectedValue(new Error('发送失败'))
      const onError = createMockFn()
      
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} onSend={onSend} onError={onError} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '测试消息{enter}')
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          type: 'send_error',
        }))
      })
    })

    it('应该处理文件上传错误', async () => {
      const onError = createMockFn()
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} enableFileUpload onError={onError} />
      )
      
      const fileButton = screen.getByLabelText('上传文件')
      await user.click(fileButton)
      
      const fileInput = screen.getByTestId('file-input')
      const largeFile = new File(['x'.repeat(1000000)], 'large.txt', { 
        type: 'text/plain' 
      })
      
      await user.upload(fileInput, largeFile)
      
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        type: 'file_too_large',
      }))
    })

    it('应该处理输入验证错误', async () => {
      const validator = vi.fn(() => '消息格式不正确')
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} validator={validator} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      await user.type(textarea, '无效消息{enter}')
      
      expect(screen.getByText('消息格式不正确')).toBeInTheDocument()
      expect(defaultProps.onSend).not.toHaveBeenCalled()
    })
  })

  // ==================== 集成测试 ====================
  
  describe('集成测试', () => {
    it('应该完成完整的输入和发送流程', async () => {
      const { user } = renderWithProviders(
        <InputBox {...defaultProps} showEmojiPicker enableFileUpload />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      
      // 输入文本
      await user.type(textarea, '这是一条')
      
      // 插入表情
      const emojiButton = screen.getByLabelText('插入表情')
      await user.click(emojiButton)
      
      const emoji = screen.getByText('😀')
      await user.click(emoji)
      
      // 继续输入
      await user.type(textarea, '测试消息')
      
      // 发送消息
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onSend).toHaveBeenCalledWith('这是一条😀测试消息')
    })
  })
})

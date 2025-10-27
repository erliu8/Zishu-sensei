/**
 * InputBox 组件测试
 * 
 * 测试组件的各种功能和交互
 * @module InputBox/Test
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InputBox from './InputBox'
import type { Suggestion } from './InputBox.types'
import { SuggestionType } from './InputBox.types'

describe('InputBox Component', () => {
  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染', () => {
      render(<InputBox />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
    })
    
    it('应该显示占位符', () => {
      const placeholder = '请输入消息...'
      render(<InputBox placeholder={placeholder} />)
      const textarea = screen.getByPlaceholderText(placeholder)
      expect(textarea).toBeInTheDocument()
    })
    
    it('应该显示初始值', () => {
      const value = 'Hello, World!'
      render(<InputBox value={value} />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe(value)
    })
    
    it('应该应用自定义类名', () => {
      const className = 'custom-input-box'
      const { container } = render(<InputBox className={className} />)
      expect(container.firstChild).toHaveClass(className)
    })
  })
  
  // ==================== 输入交互测试 ====================
  
  describe('输入交互', () => {
    it('应该处理文本输入', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      
      render(<InputBox onChange={handleChange} />)
      const textarea = screen.getByRole('textbox')
      
      await user.type(textarea, 'Hello')
      
      expect(handleChange).toHaveBeenCalled()
      expect(textarea).toHaveValue('Hello')
    })
    
    it('应该限制最大字符数', async () => {
      const user = userEvent.setup()
      const maxLength = 10
      
      render(<InputBox maxLength={maxLength} />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      
      await user.type(textarea, 'This is a very long text')
      
      expect(textarea.value.length).toBeLessThanOrEqual(maxLength)
    })
    
    it('应该在禁用时阻止输入', () => {
      render(<InputBox disabled />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })
    
    it('应该在只读时阻止输入', () => {
      render(<InputBox readOnly />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('readonly')
    })
  })
  
  // ==================== 发送消息测试 ====================
  
  describe('发送消息', () => {
    it('应该在点击发送按钮时发送消息', async () => {
      const user = userEvent.setup()
      const handleSend = vi.fn()
      const value = 'Test message'
      
      render(<InputBox value={value} onSend={handleSend} />)
      const sendButton = screen.getByLabelText('发送消息')
      
      await user.click(sendButton)
      
      expect(handleSend).toHaveBeenCalledWith(value, [])
    })
    
    it('应该在按下 Ctrl+Enter 时发送消息', async () => {
      const user = userEvent.setup()
      const handleSend = vi.fn()
      const value = 'Test message'
      
      render(<InputBox value={value} onSend={handleSend} sendShortcut="ctrl+enter" />)
      const textarea = screen.getByRole('textbox')
      
      await user.type(textarea, '{Control>}{Enter}{/Control}')
      
      expect(handleSend).toHaveBeenCalled()
    })
    
    it('应该在按下 Enter 时发送消息（如果配置）', async () => {
      const user = userEvent.setup()
      const handleSend = vi.fn()
      const value = 'Test message'
      
      render(<InputBox value={value} onSend={handleSend} sendShortcut="enter" />)
      const textarea = screen.getByRole('textbox')
      
      await user.type(textarea, '{Enter}')
      
      expect(handleSend).toHaveBeenCalled()
    })
    
    it('不应该发送空消息', async () => {
      const user = userEvent.setup()
      const handleSend = vi.fn()
      
      render(<InputBox value="" onSend={handleSend} />)
      const sendButton = screen.getByLabelText('发送消息')
      
      await user.click(sendButton)
      
      expect(handleSend).not.toHaveBeenCalled()
    })
  })
  
  // ==================== 字符计数测试 ====================
  
  describe('字符计数', () => {
    it('应该显示字符计数', () => {
      const value = 'Hello'
      render(<InputBox value={value} showCharCount />)
      
      expect(screen.getByText(/5/)).toBeInTheDocument()
    })
    
    it('应该显示字符限制', () => {
      const maxLength = 100
      render(<InputBox showCharCount maxLength={maxLength} />)
      
      expect(screen.getByText(new RegExp(maxLength.toString()))).toBeInTheDocument()
    })
    
    it('应该标记超出限制', async () => {
      const user = userEvent.setup()
      const maxLength = 5
      
      render(<InputBox showCharCount maxLength={maxLength} />)
      const textarea = screen.getByRole('textbox')
      
      await user.type(textarea, 'Too long text')
      
      const charCount = screen.getByLabelText('字符计数')
      expect(charCount).toHaveAttribute('data-exceeded', 'true')
    })
  })
  
  // ==================== 附件测试 ====================
  
  describe('附件', () => {
    it('应该显示附件按钮', () => {
      render(<InputBox showAttachmentButton />)
      const attachButton = screen.getByLabelText('添加附件')
      expect(attachButton).toBeInTheDocument()
    })
    
    it('应该处理文件选择', async () => {
      const user = userEvent.setup()
      const handleAttachmentAdd = vi.fn()
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      render(<InputBox showAttachmentButton onAttachmentAdd={handleAttachmentAdd} />)
      const attachButton = screen.getByLabelText('添加附件')
      
      await user.click(attachButton)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(handleAttachmentAdd).toHaveBeenCalled()
      })
    })
    
    it('应该限制附件数量', async () => {
      const maxAttachments = 2
      render(<InputBox showAttachmentButton maxAttachments={maxAttachments} />)
      
      // 添加测试逻辑
    })
    
    it('应该验证文件大小', () => {
      const maxFileSize = 1024 // 1KB
      render(<InputBox showAttachmentButton maxFileSize={maxFileSize} />)
      
      // 添加测试逻辑
    })
    
    it('应该移除附件', async () => {
      // const user = userEvent.setup()
      // const handleAttachmentRemove = vi.fn()
      
      // 添加测试逻辑
    })
  })
  
  // ==================== 建议测试 ====================
  
  describe('建议', () => {
    const suggestions: Suggestion[] = [
      { id: '1', text: 'Hello', icon: '👋', type: SuggestionType.PROMPT },
      { id: '2', text: 'Thanks', icon: '🙏', type: SuggestionType.PROMPT },
    ]
    
    it('应该显示建议列表', () => {
      render(
        <InputBox
          suggestions={suggestions}
          showSuggestions
        />
      )
      
      // 聚焦输入框以显示建议
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Thanks')).toBeInTheDocument()
    })
    
    it('应该在选择建议时调用回调', async () => {
      const user = userEvent.setup()
      const handleSuggestionSelect = vi.fn()
      
      render(
        <InputBox
          suggestions={suggestions}
          showSuggestions
          onSuggestionSelect={handleSuggestionSelect}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      
      const suggestion = screen.getByText('Hello')
      await user.click(suggestion)
      
      expect(handleSuggestionSelect).toHaveBeenCalled()
    })
    
    it('应该在输入后隐藏建议', async () => {
      const user = userEvent.setup()
      
      render(
        <InputBox
          suggestions={suggestions}
          showSuggestions
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')
      
      expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    })
  })
  
  // ==================== 验证测试 ====================
  
  describe('验证', () => {
    it('应该验证最小长度', async () => {
      const user = userEvent.setup()
      const handleSend = vi.fn()
      
      render(
        <InputBox
          onSend={handleSend}
          validationRules={[
            { minLength: 5, message: '至少 5 个字符' },
          ]}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hi')
      
      const sendButton = screen.getByLabelText('发送消息')
      await user.click(sendButton)
      
      expect(handleSend).not.toHaveBeenCalled()
      expect(screen.getByText('至少 5 个字符')).toBeInTheDocument()
    })
    
    it('应该验证最大长度', async () => {
      const user = userEvent.setup()
      
      render(
        <InputBox
          validationRules={[
            { maxLength: 5, message: '最多 5 个字符' },
          ]}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Too long')
      
      expect(screen.getByText('最多 5 个字符')).toBeInTheDocument()
    })
    
    it('应该验证正则表达式', async () => {
      const user = userEvent.setup()
      
      render(
        <InputBox
          validationRules={[
            { pattern: /^\d+$/, message: '只能输入数字' },
          ]}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'abc')
      
      expect(screen.getByText('只能输入数字')).toBeInTheDocument()
    })
    
    it('应该使用自定义验证器', async () => {
      const user = userEvent.setup()
      
      render(
        <InputBox
          validationRules={[
            {
              validator: (value) => !value.includes('bad'),
              message: '不能包含敏感词',
            },
          ]}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'This is bad')
      
      expect(screen.getByText('不能包含敏感词')).toBeInTheDocument()
    })
  })
  
  // ==================== 拖拽上传测试 ====================
  
  describe('拖拽上传', () => {
    it('应该处理拖拽进入', () => {
      const { container } = render(<InputBox enableDragDrop showAttachmentButton />)
      
      const dropzone = container.firstChild as HTMLElement
      fireEvent.dragEnter(dropzone, {
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      })
      
      expect(dropzone).toHaveClass('dragging')
    })
    
    it('应该处理文件拖放', () => {
      const handleAttachmentAdd = vi.fn()
      const { container } = render(
        <InputBox
          enableDragDrop
          showAttachmentButton
          onAttachmentAdd={handleAttachmentAdd}
        />
      )
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const dropzone = container.firstChild as HTMLElement
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      })
      
      // 验证文件处理
    })
  })
  
  // ==================== 焦点和失焦测试 ====================
  
  describe('焦点管理', () => {
    it('应该处理焦点事件', () => {
      const handleFocus = vi.fn()
      
      render(<InputBox onFocus={handleFocus} />)
      const textarea = screen.getByRole('textbox')
      
      fireEvent.focus(textarea)
      
      expect(handleFocus).toHaveBeenCalled()
    })
    
    it('应该处理失焦事件', () => {
      const handleBlur = vi.fn()
      
      render(<InputBox onBlur={handleBlur} />)
      const textarea = screen.getByRole('textbox')
      
      fireEvent.blur(textarea)
      
      expect(handleBlur).toHaveBeenCalled()
    })
    
    it('应该应用焦点样式', () => {
      const { container } = render(<InputBox />)
      const textarea = screen.getByRole('textbox')
      
      fireEvent.focus(textarea)
      
      expect(container.firstChild).toHaveClass('focused')
    })
  })
  
  // ==================== 无障碍测试 ====================
  
  describe('无障碍', () => {
    it('应该有正确的 ARIA 标签', () => {
      render(<InputBox aria-label="消息输入框" />)
      const textarea = screen.getByLabelText('消息输入框')
      expect(textarea).toBeInTheDocument()
    })
    
    it('应该在验证失败时设置 aria-invalid', async () => {
      const user = userEvent.setup()
      
      render(
        <InputBox
          validationRules={[
            { minLength: 5, message: '至少 5 个字符' },
          ]}
        />
      )
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hi')
      
      expect(textarea).toHaveAttribute('aria-invalid', 'true')
    })
    
    it('应该有键盘导航支持', async () => {
      const user = userEvent.setup()
      
      render(<InputBox showAttachmentButton showEmojiButton />)
      
      // Tab 导航测试
      await user.tab()
      expect(screen.getByRole('textbox')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('添加附件')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('选择表情')).toHaveFocus()
    })
  })
})


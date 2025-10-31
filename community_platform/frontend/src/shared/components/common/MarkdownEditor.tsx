/**
 * MarkdownEditor 增强版 Markdown 编辑器组件
 * 
 * 功能特性：
 * - 完整的工具栏（粗体、斜体、标题、列表、代码等）
 * - 实时预览
 * - 图片粘贴上传
 * - 代码高亮
 * - 表格支持
 * - 数学公式支持
 * - 快捷键支持
 * - 自动保存
 */

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/utils'
import { MarkdownToolbar, MarkdownAction } from './MarkdownToolbar'
import { MarkdownViewer } from './MarkdownViewer'
import { useAutoSave } from '@/shared/hooks/useAutoSave'
import { useImageUpload } from '@/shared/hooks/useImageUpload'
import { Loader2 } from 'lucide-react'

export interface MarkdownEditorProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  toolbar?: boolean
  preview?: boolean
  minHeight?: string
  maxHeight?: string
  enableAutoSave?: boolean
  autoSaveDelay?: number
  onAutoSave?: (value: string) => Promise<void> | void
  enableImageUpload?: boolean
  onImageUpload?: (file: File) => Promise<string>
  showSaveStatus?: boolean
  className?: string
}

export const MarkdownEditor = React.forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  (
    {
      className,
      value = '',
      onChange,
      preview = false,
      toolbar = true,
      minHeight = '400px',
      maxHeight = '600px',
      disabled = false,
      enableAutoSave = false,
      autoSaveDelay = 2000,
      onAutoSave,
      enableImageUpload = false,
      onImageUpload,
      showSaveStatus = false,
      ...props
    },
    ref
  ) => {
    const [content, setContent] = useState(value)
    const [showPreview, setShowPreview] = useState(preview)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    React.useImperativeHandle(ref, () => textareaRef.current!)

    // 同步外部 value
    useEffect(() => {
      setContent(value)
    }, [value])

    // 自动保存
    const { isSaving, lastSavedAt } = useAutoSave({
      data: content,
      onSave: async (data) => {
        if (onAutoSave) {
          await onAutoSave(data)
        }
      },
      delay: autoSaveDelay,
      enabled: enableAutoSave && !!onAutoSave,
    })

    // 图片上传
    const { isUploading, uploadImage } = useImageUpload({
      onUpload: async (file) => {
        if (onImageUpload) {
          return await onImageUpload(file)
        }
        throw new Error('图片上传未配置')
      },
    })

    // 内容变化处理
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const newValue = e.target.value
      setContent(newValue)
      onChange?.(newValue)
      },
      [onChange]
    )

    // 插入文本
    const insertText = useCallback(
      (before: string, after: string = '', placeholder: string = ''): void => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)
        const textToInsert = selectedText || placeholder

        const newText =
          content.substring(0, start) +
          before +
          textToInsert +
          after +
          content.substring(end)

      setContent(newText)
      onChange?.(newText)

      // 恢复光标位置
      setTimeout(() => {
        textarea.focus()
          const newCursorPos = start + before.length + textToInsert.length
          textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
      },
      [content, onChange]
    )

    // 插入新行
    const insertLine = useCallback(
      (text: string): void => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const lines = content.split('\n')
        let currentLine = 0
        let charCount = 0

        // 找到当前行
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i]?.length || 0
          charCount += lineLength + 1
          if (charCount > start) {
            currentLine = i
            break
          }
        }

        // 在当前行末尾插入
        const currentLineText = lines[currentLine]
        if (currentLineText !== undefined) {
          const lineEnd = charCount - 1
          const newText =
            content.substring(0, lineEnd) +
            '\n' +
            text +
            content.substring(lineEnd)

          setContent(newText)
          onChange?.(newText)

          setTimeout(() => {
            textarea.focus()
            const newCursorPos = lineEnd + text.length + 1
            textarea.setSelectionRange(newCursorPos, newCursorPos)
          }, 0)
        }
      },
      [content, onChange]
    )

    // 工具栏操作处理
    const handleToolbarAction = useCallback(
      (action: MarkdownAction): void => {
        switch (action) {
          case 'bold':
            insertText('**', '**', '粗体文本')
            break
          case 'italic':
            insertText('*', '*', '斜体文本')
            break
          case 'strikethrough':
            insertText('~~', '~~', '删除线文本')
            break
          case 'code':
            insertText('`', '`', '代码')
            break
          case 'code-block':
            insertText('```javascript\n', '\n```', '// 代码块')
            break
          case 'h1':
            insertLine('# 一级标题')
            break
          case 'h2':
            insertLine('## 二级标题')
            break
          case 'h3':
            insertLine('### 三级标题')
            break
          case 'ul':
            insertLine('- 列表项')
            break
          case 'ol':
            insertLine('1. 列表项')
            break
          case 'task':
            insertLine('- [ ] 待办事项')
            break
          case 'quote':
            insertLine('> 引用文本')
            break
          case 'link':
            insertText('[', '](https://example.com)', '链接文本')
            break
          case 'image':
            if (enableImageUpload && fileInputRef.current) {
              fileInputRef.current.click()
            } else {
              insertText('![', '](https://example.com/image.jpg)', '图片描述')
            }
            break
          case 'table':
            insertLine(
              '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |'
            )
            break
          case 'hr':
            insertLine('---')
            break
          case 'math':
            insertText('$', '$', 'E=mc^2')
            break
        }
      },
      [insertText, insertLine, enableImageUpload]
    )

    // 快捷键处理
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey

        if (!ctrlKey) return

        const keyActions: Record<string, MarkdownAction> = {
          b: 'bold',
          i: 'italic',
          k: 'link',
          '`': 'code',
          m: 'math',
        }

        if (e.shiftKey) {
          const shiftKeyActions: Record<string, MarkdownAction> = {
            s: 'strikethrough',
            c: 'code-block',
            u: 'ul',
            o: 'ol',
            t: 'task',
            q: 'quote',
            i: 'image',
          }

          const action = shiftKeyActions[e.key.toLowerCase()]
          if (action) {
            e.preventDefault()
            handleToolbarAction(action)
          }
        } else {
          // 标题快捷键
          if (e.key >= '1' && e.key <= '3') {
            e.preventDefault()
            handleToolbarAction((`h${e.key}` as MarkdownAction))
            return
          }

          const action = keyActions[e.key.toLowerCase()]
          if (action) {
            e.preventDefault()
            handleToolbarAction(action)
          }
        }
      },
      [handleToolbarAction]
    )

    // 粘贴处理（图片）
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
        if (!enableImageUpload || !onImageUpload) return

        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item && item.type.indexOf('image') !== -1) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) {
              try {
                const url = await uploadImage(file)
                if (url) {
                  insertText(`![图片](${url})`, '')
                }
              } catch (error) {
                console.error('图片上传失败:', error)
              }
            }
          }
        }
      },
      [enableImageUpload, onImageUpload, uploadImage, insertText]
    )

    // 文件选择处理
    const handleFileSelect = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
          const url = await uploadImage(file)
          if (url) {
            insertText(`![${file.name}](${url})`, '')
          }
        } catch (error) {
          console.error('图片上传失败:', error)
        }

        // 清空 input 以允许重复上传同一文件
        e.target.value = ''
      },
      [uploadImage, insertText]
    )

    // 拖拽上传
    const handleDrop = useCallback(
      async (e: React.DragEvent<HTMLTextAreaElement>): Promise<void> => {
        if (!enableImageUpload || !onImageUpload) return

        e.preventDefault()
        e.stopPropagation()

        const files = e.dataTransfer?.files
        if (!files || files.length === 0) return

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (file && file.type.indexOf('image') !== -1) {
            try {
              const url = await uploadImage(file)
              if (url) {
                insertText(`![${file.name}](${url})\n`, '')
              }
            } catch (error) {
              console.error('图片上传失败:', error)
            }
          }
        }
      },
      [enableImageUpload, onImageUpload, uploadImage, insertText]
    )

    const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault()
      e.stopPropagation()
    }, [])

    // 格式化保存时间
    const formatSaveTime = (date: Date): string => {
      const now = new Date()
      const diff = now.getTime() - date.getTime()

      if (diff < 60000) return '刚刚保存'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前保存`
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }

    return (
      <div className={cn('w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden', className)}>
        {/* 工具栏 */}
        {toolbar && (
          <MarkdownToolbar
            onAction={handleToolbarAction}
                  disabled={disabled}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
          />
        )}

        {/* 保存状态 */}
        {showSaveStatus && enableAutoSave && (
          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>保存中...</span>
              </>
            ) : lastSavedAt ? (
              <span>{formatSaveTime(lastSavedAt)}</span>
            ) : null}
            </div>
        )}

        {/* 上传状态 */}
        {isUploading && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>图片上传中...</span>
          </div>
        )}

        {/* 编辑器/预览 */}
        <div className="relative">
          {showPreview ? (
            <div
              className="p-6 prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
              style={{ minHeight, maxHeight }}
            >
              <MarkdownViewer content={content} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              disabled={disabled}
              className={cn(
                'w-full p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
                'resize-none focus:outline-none',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'font-mono text-sm leading-relaxed'
              )}
              style={{ minHeight, maxHeight }}
              {...props}
            />
          )}
        </div>

        {/* 隐藏的文件输入 */}
        {enableImageUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor

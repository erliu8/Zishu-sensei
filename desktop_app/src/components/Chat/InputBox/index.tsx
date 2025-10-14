/**
 * 输入框组件
 * 
 * 用于聊天消息输入，支持：
 * - 多行文本输入
 * - 自动调整高度
 * - 字符计数和限制
 * - 快捷键支持（Ctrl+Enter 发送、Shift+Enter 换行）
 * - 表情选择器
 * - 文件上传（图片、文档等）
 * - 语音输入
 * - 发送建议/提示词
 * - 清空输入
 * - 响应式设计
 * - 无障碍支持
 * - 加载状态
 * - 禁用状态
 */

import React, {
  memo,
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Mic,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react'
import styles from './InputBox.module.css'

// ==================== 类型定义 ====================

export interface Attachment {
  /** 附件 ID */
  id: string
  /** 文件名 */
  name: string
  /** 文件大小（字节） */
  size: number
  /** MIME 类型 */
  mimeType: string
  /** 文件 URL 或 Data URL */
  url: string
  /** 文件类型 */
  type: 'image' | 'document' | 'audio' | 'video' | 'other'
  /** 预览 URL（如果是图片） */
  previewUrl?: string
}

export interface Suggestion {
  /** 建议 ID */
  id: string
  /** 建议文本 */
  text: string
  /** 建议图标 */
  icon?: React.ReactNode
  /** 建议类型 */
  type?: 'prompt' | 'command' | 'template'
}

export interface InputBoxProps {
  /** 输入值 */
  value?: string
  /** 占位符文本 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读 */
  readOnly?: boolean
  /** 是否正在发送 */
  isSending?: boolean
  /** 是否正在流式响应 */
  isStreaming?: boolean
  /** 最大字符数 */
  maxLength?: number
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
  /** 是否显示字符计数 */
  showCharCount?: boolean
  /** 是否显示附件按钮 */
  showAttachmentButton?: boolean
  /** 是否显示表情按钮 */
  showEmojiButton?: boolean
  /** 是否显示语音按钮 */
  showVoiceButton?: boolean
  /** 是否显示建议 */
  showSuggestions?: boolean
  /** 建议列表 */
  suggestions?: Suggestion[]
  /** 是否自动聚焦 */
  autoFocus?: boolean
  /** 是否启用快捷键 */
  enableShortcuts?: boolean
  /** 发送快捷键（默认 Ctrl+Enter） */
  sendShortcut?: 'enter' | 'ctrl+enter' | 'cmd+enter'
  /** 允许的文件类型 */
  acceptedFileTypes?: string[]
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 自定义类名 */
  className?: string
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 发送回调 */
  onSend?: (message: string, attachments?: Attachment[]) => void
  /** 附件添加回调 */
  onAttachmentAdd?: (file: File) => Promise<Attachment>
  /** 附件移除回调 */
  onAttachmentRemove?: (attachmentId: string) => void
  /** 表情选择回调 */
  onEmojiSelect?: (emoji: string) => void
  /** 语音输入开始回调 */
  onVoiceStart?: () => void
  /** 建议选择回调 */
  onSuggestionSelect?: (suggestion: Suggestion) => void
  /** 聚焦回调 */
  onFocus?: () => void
  /** 失焦回调 */
  onBlur?: () => void
  /** 键盘事件回调 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export interface InputBoxRef {
  /** 聚焦输入框 */
  focus: () => void
  /** 失焦输入框 */
  blur: () => void
  /** 清空输入 */
  clear: () => void
  /** 插入文本 */
  insertText: (text: string) => void
  /** 获取输入值 */
  getValue: () => string
  /** 设置输入值 */
  setValue: (value: string) => void
}

// ==================== 常量 ====================

const DEFAULT_MAX_LENGTH = 10000
const DEFAULT_MIN_ROWS = 1
const DEFAULT_MAX_ROWS = 10
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 常用表情
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
  '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒',
  '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
  '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '👍', '👎', '👏', '🙌', '👋', '🤝', '💪', '🙏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
]

// ==================== 辅助函数 ====================

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 获取文件类型
 */
const getFileType = (mimeType: string): Attachment['type'] => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text')
  ) {
    return 'document'
  }
  return 'other'
}

/**
 * 验证文件
 */
const validateFile = (
  file: File,
  acceptedTypes?: string[],
  maxSize?: number
): { valid: boolean; error?: string } => {
  // 检查文件类型
  if (acceptedTypes && acceptedTypes.length > 0) {
    const isAccepted = acceptedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', ''))
      }
      return file.type === type
    })
    if (!isAccepted) {
      return { valid: false, error: '不支持的文件类型' }
    }
  }

  // 检查文件大小
  if (maxSize && file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小不能超过 ${formatFileSize(maxSize)}`,
    }
  }

  return { valid: true }
}

// ==================== 主组件 ====================

export const InputBox = forwardRef<InputBoxRef, InputBoxProps>(
  (
    {
      value: controlledValue,
      placeholder = '输入消息...',
      disabled = false,
      readOnly = false,
      isSending = false,
      isStreaming = false,
      maxLength = DEFAULT_MAX_LENGTH,
      minRows = DEFAULT_MIN_ROWS,
      maxRows = DEFAULT_MAX_ROWS,
      showCharCount = true,
      showAttachmentButton = true,
      showEmojiButton = true,
      showVoiceButton = true,
      showSuggestions = true,
      suggestions = [],
      autoFocus = false,
      enableShortcuts = true,
      sendShortcut = 'ctrl+enter',
      acceptedFileTypes,
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      className,
      onChange,
      onSend,
      onAttachmentAdd,
      onAttachmentRemove,
      onEmojiSelect,
      onVoiceStart,
      onSuggestionSelect,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref
  ) => {
    // ==================== Refs ====================
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const emojiPickerRef = useRef<HTMLDivElement>(null)

    // ==================== 状态管理 ====================
    const [internalValue, setInternalValue] = useState('')
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [isComposing, setIsComposing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // 使用受控或非受控模式
    const value = controlledValue !== undefined ? controlledValue : internalValue
    const isDisabled = disabled || isSending || isStreaming

    // ==================== 副作用 ====================

    // 自动调整文本框高度
    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10)
      const minHeight = lineHeight * minRows
      const maxHeight = lineHeight * maxRows

      textarea.style.height = `${Math.min(
        Math.max(scrollHeight, minHeight),
        maxHeight
      )}px`
    }, [value, minRows, maxRows])

    // 自动聚焦
    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus()
      }
    }, [autoFocus])

    // 点击外部关闭表情选择器
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          emojiPickerRef.current &&
          !emojiPickerRef.current.contains(event.target as Node)
        ) {
          setShowEmojiPicker(false)
        }
      }

      if (showEmojiPicker) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [showEmojiPicker])

    // 清除错误信息
    useEffect(() => {
      if (error) {
        const timer = setTimeout(() => setError(null), 3000)
        return () => clearTimeout(timer)
      }
    }, [error])

    // ==================== 暴露的方法 ====================

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      clear: () => handleClear(),
      insertText: (text: string) => handleInsertText(text),
      getValue: () => value,
      setValue: (newValue: string) => handleChange(newValue),
    }))

    // ==================== 事件处理 ====================

    /** 处理输入变化 */
    const handleChange = useCallback(
      (newValue: string) => {
        if (newValue.length > maxLength) {
          setError(`最多只能输入 ${maxLength} 个字符`)
          return
        }

        if (controlledValue === undefined) {
          setInternalValue(newValue)
        }
        onChange?.(newValue)
      },
      [controlledValue, maxLength, onChange]
    )

    /** 处理文本域变化 */
    const handleTextareaChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleChange(e.target.value)
      },
      [handleChange]
    )

    /** 处理发送 */
    const handleSend = useCallback(() => {
      const trimmedValue = value.trim()
      if (!trimmedValue && attachments.length === 0) {
        setError('请输入消息或添加附件')
        return
      }

      if (trimmedValue.length > maxLength) {
        setError(`消息长度不能超过 ${maxLength} 个字符`)
        return
      }

      onSend?.(trimmedValue, attachments.length > 0 ? attachments : undefined)
      handleClear()
    }, [value, attachments, maxLength, onSend])

    /** 处理清空 */
    const handleClear = useCallback(() => {
      handleChange('')
      setAttachments([])
      setError(null)
    }, [handleChange])

    /** 插入文本 */
    const handleInsertText = useCallback(
      (text: string) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.substring(0, start) + text + value.substring(end)

        handleChange(newValue)

        // 设置光标位置
        setTimeout(() => {
          const newPosition = start + text.length
          textarea.setSelectionRange(newPosition, newPosition)
          textarea.focus()
        }, 0)
      },
      [value, handleChange]
    )

    /** 处理键盘事件 */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // 输入法组合中不处理
        if (isComposing) return

        onKeyDown?.(e)

        if (!enableShortcuts) return

        // 检查发送快捷键
        const shouldSend =
          (sendShortcut === 'enter' && e.key === 'Enter' && !e.shiftKey) ||
          (sendShortcut === 'ctrl+enter' &&
            e.key === 'Enter' &&
            (e.ctrlKey || e.metaKey)) ||
          (sendShortcut === 'cmd+enter' && e.key === 'Enter' && e.metaKey)

        if (shouldSend) {
          e.preventDefault()
          handleSend()
          return
        }

        // Shift+Enter 换行（默认行为，无需处理）
        if (e.key === 'Enter' && e.shiftKey) {
          return
        }

        // Esc 清空输入
        if (e.key === 'Escape') {
          e.preventDefault()
          handleClear()
          return
        }
      },
      [
        isComposing,
        enableShortcuts,
        sendShortcut,
        handleSend,
        handleClear,
        onKeyDown,
      ]
    )

    /** 处理文件选择 */
    const handleFileSelect = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        setError(null)

        try {
          for (const file of Array.from(files)) {
            // 验证文件
            const validation = validateFile(file, acceptedFileTypes, maxFileSize)
            if (!validation.valid) {
              setError(validation.error || '文件验证失败')
              continue
            }

            // 处理文件上传
            if (onAttachmentAdd) {
              const attachment = await onAttachmentAdd(file)
              setAttachments((prev) => [...prev, attachment])
            } else {
              // 默认处理：读取为 Data URL
              const reader = new FileReader()
              reader.onload = () => {
                const attachment: Attachment = {
                  id: `${Date.now()}-${Math.random()}`,
                  name: file.name,
                  size: file.size,
                  mimeType: file.type,
                  url: reader.result as string,
                  type: getFileType(file.type),
                  previewUrl:
                    file.type.startsWith('image/') ? (reader.result as string) : undefined,
                }
                setAttachments((prev) => [...prev, attachment])
              }
              reader.readAsDataURL(file)
            }
          }
        } catch (error) {
          console.error('文件上传失败:', error)
          setError('文件上传失败')
        } finally {
          setIsUploading(false)
          // 重置 input 以允许选择相同文件
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
      },
      [acceptedFileTypes, maxFileSize, onAttachmentAdd]
    )

    /** 处理移除附件 */
    const handleRemoveAttachment = useCallback(
      (attachmentId: string) => {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
        onAttachmentRemove?.(attachmentId)
      },
      [onAttachmentRemove]
    )

    /** 处理表情选择 */
    const handleEmojiSelect = useCallback(
      (emoji: string) => {
        handleInsertText(emoji)
        setShowEmojiPicker(false)
        onEmojiSelect?.(emoji)
      },
      [handleInsertText, onEmojiSelect]
    )

    /** 处理建议选择 */
    const handleSuggestionClick = useCallback(
      (suggestion: Suggestion) => {
        handleChange(suggestion.text)
        onSuggestionSelect?.(suggestion)
      },
      [handleChange, onSuggestionSelect]
    )

    // ==================== 渲染函数 ====================

    /** 渲染附件列表 */
    const renderAttachments = () => {
      if (attachments.length === 0) return null

      return (
        <div className={styles.attachments}>
          {attachments.map((attachment) => (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={styles.attachmentItem}
            >
              {attachment.type === 'image' && attachment.previewUrl ? (
                <div className={styles.attachmentImage}>
                  <img src={attachment.previewUrl} alt={attachment.name} />
                </div>
              ) : (
                <div className={styles.attachmentIcon}>
                  <Paperclip size={16} />
                </div>
              )}
              <div className={styles.attachmentInfo}>
                <span className={styles.attachmentName}>{attachment.name}</span>
                <span className={styles.attachmentSize}>
                  {formatFileSize(attachment.size)}
                </span>
              </div>
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                className={styles.attachmentRemove}
                title="移除附件"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )
    }

    /** 渲染表情选择器 */
    const renderEmojiPicker = () => {
      if (!showEmojiPicker) return null

      return (
        <motion.div
          ref={emojiPickerRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className={styles.emojiPicker}
        >
          <div className={styles.emojiPickerHeader}>选择表情</div>
          <div className={styles.emojiGrid}>
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className={styles.emojiButton}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )
    }

    /** 渲染建议 */
    const renderSuggestions = () => {
      if (!showSuggestions || suggestions.length === 0 || value.trim()) {
        return null
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={styles.suggestions}
        >
          {suggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={styles.suggestionItem}
              disabled={isDisabled}
            >
              {suggestion.icon && (
                <span className={styles.suggestionIcon}>{suggestion.icon}</span>
              )}
              <span className={styles.suggestionText}>{suggestion.text}</span>
            </button>
          ))}
        </motion.div>
      )
    }

    /** 渲染错误提示 */
    const renderError = () => {
      if (!error) return null

      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={styles.error}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </motion.div>
      )
    }

    /** 获取发送按钮提示文本 */
    const getSendButtonHint = () => {
      if (sendShortcut === 'enter') return 'Enter'
      if (sendShortcut === 'ctrl+enter') return 'Ctrl+Enter'
      if (sendShortcut === 'cmd+enter') return 'Cmd+Enter'
      return ''
    }

    // ==================== 主渲染 ====================

    const charCount = value.length
    const isOverLimit = charCount > maxLength
    const canSend = !isDisabled && (value.trim() || attachments.length > 0)

    return (
      <div className={clsx(styles.inputBox, className)}>
        {/* 建议 */}
        <AnimatePresence>{renderSuggestions()}</AnimatePresence>

        {/* 附件列表 */}
        <AnimatePresence>{renderAttachments()}</AnimatePresence>

        {/* 错误提示 */}
        <AnimatePresence>{renderError()}</AnimatePresence>

        {/* 主输入区域 */}
        <div className={styles.inputContainer}>
          {/* 左侧工具栏 */}
          <div className={styles.toolbar}>
            {/* 附件按钮 */}
            {showAttachmentButton && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.toolButton}
                  disabled={isDisabled || isUploading}
                  title="添加附件"
                >
                  {isUploading ? (
                    <Loader2 size={20} className={styles.spinning} />
                  ) : (
                    <Paperclip size={20} />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={acceptedFileTypes?.join(',')}
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                />
              </>
            )}

            {/* 表情按钮 */}
            {showEmojiButton && (
              <div className={styles.emojiContainer}>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={clsx(
                    styles.toolButton,
                    showEmojiPicker && styles.toolButtonActive
                  )}
                  disabled={isDisabled}
                  title="插入表情"
                >
                  <Smile size={20} />
                </button>
                <AnimatePresence>{renderEmojiPicker()}</AnimatePresence>
              </div>
            )}

            {/* 语音按钮 */}
            {showVoiceButton && (
              <button
                onClick={onVoiceStart}
                className={styles.toolButton}
                disabled={isDisabled}
                title="语音输入"
              >
                <Mic size={20} />
              </button>
            )}
          </div>

          {/* 文本输入区域 */}
          <div className={styles.textareaContainer}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder={placeholder}
              disabled={isDisabled}
              readOnly={readOnly}
              className={clsx(
                styles.textarea,
                isOverLimit && styles.textareaError
              )}
              rows={minRows}
            />
            {showCharCount && (
              <div
                className={clsx(
                  styles.charCount,
                  isOverLimit && styles.charCountError
                )}
              >
                {charCount} / {maxLength}
              </div>
            )}
          </div>

          {/* 发送按钮 */}
          <div className={styles.sendContainer}>
            {isSending ? (
              <button className={styles.sendButton} disabled>
                <Loader2 size={20} className={styles.spinning} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                className={clsx(
                  styles.sendButton,
                  canSend && styles.sendButtonActive
                )}
                disabled={!canSend}
                title={`发送消息 (${getSendButtonHint()})`}
              >
                <Send size={20} />
              </button>
            )}
            {enableShortcuts && !isSending && (
              <div className={styles.shortcutHint}>
                <CornerDownLeft size={12} />
                <span>{getSendButtonHint()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

InputBox.displayName = 'InputBox'

export default InputBox


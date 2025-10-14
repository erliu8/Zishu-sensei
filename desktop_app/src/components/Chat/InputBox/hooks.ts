/**
 * InputBox 组件自定义 Hooks
 * 
 * 提供输入框常用的状态管理和交互逻辑
 * @module InputBox/hooks
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type {
  Attachment,
  AttachmentValidation,
  ValidationResult,
  SendShortcut,
} from './InputBox.types'
import { validateFile, debounce, countCharacters } from './utils'

// ==================== 输入值管理 ====================

/**
 * 管理输入框的值
 * @param initialValue - 初始值
 * @param onChange - 值变化回调
 * @returns [value, setValue, reset]
 */
export function useInputValue(
  initialValue = '',
  onChange?: (value: string) => void
) {
  const [value, setValue] = useState(initialValue)
  
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue)
    onChange?.(newValue)
  }, [onChange])
  
  const reset = useCallback(() => {
    setValue(initialValue)
  }, [initialValue])
  
  return [value, handleChange, reset] as const
}

// ==================== 字符计数 ====================

/**
 * 管理字符计数
 * @param value - 输入值
 * @param maxLength - 最大长度
 * @returns 字符计数信息
 */
export function useCharCount(value: string, maxLength?: number) {
  const count = useMemo(() => countCharacters(value), [value])
  const remaining = maxLength ? maxLength - count : null
  const isExceeded = maxLength ? count > maxLength : false
  const percentage = maxLength ? (count / maxLength) * 100 : 0
  
  return {
    count,
    remaining,
    isExceeded,
    percentage,
    maxLength,
  }
}

// ==================== 附件管理 ====================

/**
 * 管理附件列表
 * @param initialAttachments - 初始附件列表
 * @param options - 选项
 * @returns 附件管理方法和状态
 */
export function useAttachments(
  initialAttachments: Attachment[] = [],
  options: {
    maxSize?: number
    maxAttachments?: number
    acceptedTypes?: string[]
    onValidationError?: (file: File, validation: AttachmentValidation) => void
  } = {}
) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [uploadingCount, setUploadingCount] = useState(0)
  
  const {
    maxSize,
    maxAttachments,
    acceptedTypes,
    onValidationError,
  } = options
  
  // 添加附件
  const addAttachment = useCallback((attachment: Attachment) => {
    setAttachments(prev => {
      if (maxAttachments && prev.length >= maxAttachments) {
        return prev
      }
      return [...prev, attachment]
    })
  }, [maxAttachments])
  
  // 移除附件
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }, [])
  
  // 更新附件
  const updateAttachment = useCallback((id: string, updates: Partial<Attachment>) => {
    setAttachments(prev =>
      prev.map(att => (att.id === id ? { ...att, ...updates } : att))
    )
  }, [])
  
  // 清空附件
  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])
  
  // 验证文件
  const validateAndAdd = useCallback(async (
    file: File,
    onAdd: (file: File) => Promise<Attachment> | Attachment
  ) => {
    // 验证文件
    const validation = validateFile(file, { maxSize, acceptedTypes })
    
    if (!validation.valid) {
      onValidationError?.(file, validation)
      return null
    }
    
    // 检查数量限制
    if (maxAttachments && attachments.length >= maxAttachments) {
      onValidationError?.(file, {
        valid: false,
        error: `最多只能上传 ${maxAttachments} 个文件`,
        code: 'INVALID_FILE',
      })
      return null
    }
    
    try {
      setUploadingCount(prev => prev + 1)
      const attachment = await onAdd(file)
      addAttachment(attachment)
      return attachment
    } catch (error) {
      console.error('Failed to add attachment:', error)
      return null
    } finally {
      setUploadingCount(prev => prev - 1)
    }
  }, [attachments.length, maxSize, maxAttachments, acceptedTypes, onValidationError, addAttachment])
  
  // 批量添加
  const addMultiple = useCallback(async (
    files: File[],
    onAdd: (file: File) => Promise<Attachment> | Attachment
  ) => {
    const results = await Promise.all(
      files.map(file => validateAndAdd(file, onAdd))
    )
    return results.filter((att): att is Attachment => att !== null)
  }, [validateAndAdd])
  
  return {
    attachments,
    uploadingCount,
    isUploading: uploadingCount > 0,
    canAddMore: !maxAttachments || attachments.length < maxAttachments,
    addAttachment,
    removeAttachment,
    updateAttachment,
    clearAttachments,
    validateAndAdd,
    addMultiple,
  }
}

// ==================== 自动调整高度 ====================

/**
 * 自动调整 textarea 高度
 * @param minRows - 最小行数
 * @param maxRows - 最大行数
 * @returns [textareaRef, adjustHeight]
 */
export function useAutoResize(minRows = 1, maxRows = 10) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto'
    
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight)
    const minHeight = lineHeight * minRows
    const maxHeight = lineHeight * maxRows
    
    let newHeight = textarea.scrollHeight
    newHeight = Math.max(newHeight, minHeight)
    newHeight = Math.min(newHeight, maxHeight)
    
    textarea.style.height = `${newHeight}px`
    textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden'
  }, [minRows, maxRows])
  
  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])
  
  return [textareaRef, adjustHeight] as const
}

// ==================== 快捷键处理 ====================

/**
 * 处理快捷键
 * @param options - 快捷键配置
 * @returns 键盘事件处理函数
 */
export function useShortcuts(options: {
  onSend?: () => void
  onEscape?: () => void
  onTab?: () => void
  sendShortcut?: SendShortcut
  enableTab?: boolean
  enableEscClear?: boolean
}) {
  const {
    onSend,
    onEscape,
    onTab,
    sendShortcut = 'ctrl+enter',
    enableTab = false,
    enableEscClear = true,
  } = options
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { key, ctrlKey, metaKey, shiftKey } = event
    
    // 处理发送快捷键
    if (onSend) {
      let shouldSend = false
      
      if (sendShortcut === 'enter' && key === 'Enter' && !shiftKey && !ctrlKey && !metaKey) {
        shouldSend = true
      } else if (sendShortcut === 'ctrl+enter' && key === 'Enter' && ctrlKey) {
        shouldSend = true
      } else if (sendShortcut === 'cmd+enter' && key === 'Enter' && metaKey) {
        shouldSend = true
      } else if (sendShortcut === 'shift+enter' && key === 'Enter' && shiftKey) {
        shouldSend = true
      }
      
      if (shouldSend) {
        event.preventDefault()
        onSend()
        return
      }
    }
    
    // 处理 Escape 键
    if (enableEscClear && key === 'Escape' && onEscape) {
      event.preventDefault()
      onEscape()
      return
    }
    
    // 处理 Tab 键
    if (enableTab && key === 'Tab' && onTab) {
      event.preventDefault()
      onTab()
      return
    }
  }, [onSend, onEscape, onTab, sendShortcut, enableTab, enableEscClear])
  
  return handleKeyDown
}

// ==================== 验证 ====================

/**
 * 输入验证
 * @param value - 输入值
 * @param rules - 验证规则
 * @returns 验证结果
 */
export function useValidation(
  value: string,
  rules: Array<{
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    validator?: (value: string) => boolean | string
    message?: string
  }> = []
): ValidationResult {
  const [errors, setErrors] = useState<string[]>([])
  
  const validate = useCallback(() => {
    const newErrors: string[] = []
    
    for (const rule of rules) {
      // 最小长度验证
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        newErrors.push(rule.message || `至少需要 ${rule.minLength} 个字符`)
        continue
      }
      
      // 最大长度验证
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        newErrors.push(rule.message || `最多允许 ${rule.maxLength} 个字符`)
        continue
      }
      
      // 正则验证
      if (rule.pattern && !rule.pattern.test(value)) {
        newErrors.push(rule.message || '格式不正确')
        continue
      }
      
      // 自定义验证
      if (rule.validator) {
        const result = rule.validator(value)
        if (result === false) {
          newErrors.push(rule.message || '验证失败')
        } else if (typeof result === 'string') {
          newErrors.push(result)
        }
      }
    }
    
    setErrors(newErrors)
    return {
      valid: newErrors.length === 0,
      errors: newErrors,
    }
  }, [value, rules])
  
  // 实时验证
  useEffect(() => {
    validate()
  }, [validate])
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ==================== 拖拽上传 ====================

/**
 * 拖拽上传
 * @param onDrop - 文件放下回调
 * @returns [isDragging, dragHandlers]
 */
export function useDragDrop(onDrop: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(false)
    dragCounter.current = 0
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      onDrop(files)
    }
  }, [onDrop])
  
  return {
    isDragging,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  }
}

// ==================== 粘贴处理 ====================

/**
 * 粘贴处理
 * @param onPaste - 粘贴回调
 * @returns 粘贴事件处理函数
 */
export function usePaste(
  onPaste?: (text: string, files: File[]) => void
) {
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    const files: File[] = []
    let text = ''
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        item.getAsString(str => {
          text = str
        })
      }
    }
    
    if (files.length > 0 || text) {
      onPaste?.(text, files)
    }
  }, [onPaste])
  
  return handlePaste
}

// ==================== 防抖输入 ====================

/**
 * 防抖输入
 * @param callback - 输入回调
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const callbackRef = useRef(callback)
  const debouncedFn = useRef(debounce(callback, delay))
  
  useEffect(() => {
    callbackRef.current = callback
    debouncedFn.current = debounce(callback, delay)
  }, [callback, delay])
  
  return debouncedFn.current
}

// ==================== 焦点管理 ====================

/**
 * 焦点管理
 * @returns [isFocused, focusHandlers]
 */
export function useFocus() {
  const [isFocused, setIsFocused] = useState(false)
  
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])
  
  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])
  
  return {
    isFocused,
    focusHandlers: {
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  }
}

// ==================== 表情选择器 ====================

/**
 * 表情选择器状态
 * @returns [isOpen, toggle, close, open]
 */
export function useEmojiPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  
  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, close])
  
  return {
    isOpen,
    open,
    close,
    toggle,
    pickerRef,
  }
}

// ==================== 语音输入 ====================

/**
 * 语音输入状态
 * @param onResult - 识别结果回调
 * @param onError - 错误回调
 * @returns 语音输入控制
 */
export function useVoiceInput(
  onResult?: (text: string) => void,
  onError?: (error: Error) => void
) {
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  
  useEffect(() => {
    // 检查浏览器支持
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (SpeechRecognition) {
      setIsSupported(true)
      recognitionRef.current = new SpeechRecognition()
      
      const recognition = recognitionRef.current
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'zh-CN'
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        onResult?.(transcript)
      }
      
      recognition.onerror = (event: any) => {
        onError?.(new Error(event.error))
        setIsRecording(false)
      }
      
      recognition.onend = () => {
        setIsRecording(false)
      }
    }
  }, [onResult, onError])
  
  const start = useCallback(() => {
    if (!isSupported || !recognitionRef.current) return
    
    try {
      recognitionRef.current.start()
      setIsRecording(true)
    } catch (error) {
      onError?.(error as Error)
    }
  }, [isSupported, onError])
  
  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    
    recognitionRef.current.stop()
    setIsRecording(false)
  }, [])
  
  const toggle = useCallback(() => {
    if (isRecording) {
      stop()
    } else {
      start()
    }
  }, [isRecording, start, stop])
  
  return {
    isRecording,
    isSupported,
    start,
    stop,
    toggle,
  }
}

// ==================== 组合 Hook ====================

/**
 * InputBox 完整功能的组合 Hook
 * @param options - 配置选项
 * @returns 所有需要的状态和方法
 */
export function useInputBox(options: {
  initialValue?: string
  maxLength?: number
  minRows?: number
  maxRows?: number
  sendShortcut?: SendShortcut
  onSend?: (value: string, attachments: Attachment[]) => void
  onAttachmentAdd?: (file: File) => Promise<Attachment> | Attachment
  maxAttachments?: number
  maxFileSize?: number
  acceptedFileTypes?: string[]
} = {}) {
  const {
    initialValue = '',
    maxLength,
    minRows = 1,
    maxRows = 10,
    sendShortcut = 'ctrl+enter',
    onSend,
    onAttachmentAdd,
    maxAttachments,
    maxFileSize,
    acceptedFileTypes,
  } = options
  
  // 输入值
  const [value, setValue, resetValue] = useInputValue(initialValue)
  
  // 字符计数
  const charCount = useCharCount(value, maxLength)
  
  // 附件管理
  const attachments = useAttachments([], {
    maxSize: maxFileSize,
    maxAttachments,
    acceptedTypes: acceptedFileTypes,
  })
  
  // 自动调整高度
  const [textareaRef, adjustHeight] = useAutoResize(minRows, maxRows)
  
  // 焦点管理
  const { isFocused, focusHandlers } = useFocus()
  
  // 表情选择器
  const emojiPicker = useEmojiPicker()
  
  // 发送消息
  const handleSend = useCallback(() => {
    const trimmedValue = value.trim()
    if (!trimmedValue && attachments.attachments.length === 0) return
    if (charCount.isExceeded) return
    
    onSend?.(trimmedValue, attachments.attachments)
    resetValue()
    attachments.clearAttachments()
  }, [value, attachments, charCount.isExceeded, onSend, resetValue])
  
  // 快捷键处理
  const handleKeyDown = useShortcuts({
    onSend: handleSend,
    onEscape: resetValue,
    sendShortcut,
  })
  
  // 拖拽上传
  const dragDrop = useDragDrop(files => {
    if (onAttachmentAdd) {
      attachments.addMultiple(files, onAttachmentAdd)
    }
  })
  
  // 粘贴处理
  const handlePaste = usePaste((text, files) => {
    if (files.length > 0 && onAttachmentAdd) {
      attachments.addMultiple(files, onAttachmentAdd)
    }
  })
  
  // 值变化时调整高度
  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])
  
  // 判断是否可以发送
  const canSend = value.trim().length > 0 || attachments.attachments.length > 0
  
  return {
    // 输入相关
    value,
    setValue,
    resetValue,
    textareaRef,
    
    // 字符计数
    charCount,
    
    // 附件管理
    ...attachments,
    
    // 焦点状态
    isFocused,
    
    // 表情选择器
    emojiPicker,
    
    // 事件处理
    handleKeyDown,
    handlePaste,
    handleSend,
    ...focusHandlers,
    ...dragDrop.dragHandlers,
    
    // 状态
    canSend,
    isDragging: dragDrop.isDragging,
  }
}


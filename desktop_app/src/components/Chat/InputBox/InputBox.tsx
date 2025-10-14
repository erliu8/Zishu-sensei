/**
 * InputBox 组件
 * 
 * 高级聊天输入框组件，支持：
 * - 富文本输入
 * - 附件上传
 * - 表情选择
 * - 语音输入
 * - 智能建议
 * - 快捷键
 * - 拖拽上传
 * - 字符计数
 * 
 * @module InputBox
 */

import React, { useCallback, useRef, useEffect } from 'react'
import type { InputBoxProps, Attachment, Suggestion } from './InputBox.types'
import {
  useInputBox,
  useValidation,
  useDebouncedCallback,
} from './hooks'
import {
  formatFileSize,
  getFileType,
  generateId,
  fileToDataURL,
  createImageThumbnail,
} from './utils'
import {
  DEFAULT_CONFIG,
  SHORTCUT_HINTS,
  ARIA_LABELS,
  CSS_CLASSES,
} from './constants'
import styles from './InputBox.module.css'

/**
 * InputBox 组件
 */
const InputBox: React.FC<InputBoxProps> = ({
  // 基本属性
  value: controlledValue,
  placeholder = DEFAULT_CONFIG.PLACEHOLDER,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  
  // 尺寸和限制
  minRows = DEFAULT_CONFIG.MIN_ROWS,
  maxRows = DEFAULT_CONFIG.MAX_ROWS,
  maxLength = DEFAULT_CONFIG.MAX_LENGTH,
  showCharCount = false,
  
  // 附件相关
  enableAttachments = true,
  maxAttachments = DEFAULT_CONFIG.MAX_ATTACHMENTS,
  maxFileSize = DEFAULT_CONFIG.MAX_FILE_SIZE,
  acceptedFileTypes = [],
  
  // 功能开关
  enableEmoji = true,
  enableVoice = false,
  enableSuggestions = true,
  enableDragDrop = true,
  enablePaste = true,
  enableFormatting = false,
  
  // 快捷键
  sendShortcut = DEFAULT_CONFIG.SEND_SHORTCUT,
  
  // 建议
  suggestions = [],
  showSuggestions = true,
  
  // 状态
  loading = false,
  streaming = false,
  
  // 样式
  className,
  style,
  variant = 'default',
  size = 'medium',
  
  // 回调函数
  onChange,
  onSend,
  onFocus,
  onBlur,
  onKeyDown,
  onAttachmentAdd,
  onAttachmentRemove,
  onSuggestionSelect,
  onValidationError,
  
  // 验证规则
  validationRules = [],
  
  // 其他
  'aria-label': ariaLabel = ARIA_LABELS.inputBox,
  ...restProps
}) => {
  // 文件输入引用
  const fileInputRef = useRef<HTMLInputleElement>(null)
  
  // 处理附件添加
  const handleAttachmentAdd = useCallback(async (file: File): Promise<Attachment> => {
    const id = generateId('attachment')
    const type = getFileType(file.type)
    
    // 创建附件对象
    const attachment: Attachment = {
      id,
      name: file.name,
      size: file.size,
      type,
      status: 'uploading',
      progress: 0,
    }
    
    try {
      // 如果是图片，创建缩略图
      if (type === 'image') {
        const thumbnail = await createImageThumbnail(file)
        attachment.thumbnail = thumbnail
      }
      
      // 转换为 Data URL
      const url = await fileToDataURL(file)
      attachment.url = url
      attachment.status = 'uploaded'
      attachment.progress = 100
      
      // 调用外部回调
      onAttachmentAdd?.(file, attachment)
      
      return attachment
    } catch (error) {
      console.error('Failed to process attachment:', error)
      attachment.status = 'error'
      attachment.error = error instanceof Error ? error.message : '处理文件失败'
      return attachment
    }
  }, [onAttachmentAdd])
  
  // 使用组合 Hook
  const inputBox = useInputBox({
    initialValue: controlledValue,
    maxLength,
    minRows,
    maxRows,
    sendShortcut,
    onSend: (value, attachments) => {
      if (!disabled && !readOnly) {
        onSend?.(value, attachments)
      }
    },
    onAttachmentAdd: handleAttachmentAdd,
    maxAttachments,
    maxFileSize,
    acceptedFileTypes,
  })
  
  // 验证
  const validation = useValidation(inputBox.value, validationRules)
  
  // 同步受控值
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== inputBox.value) {
      inputBox.setValue(controlledValue)
    }
  }, [controlledValue]) // 移除 inputBox.value 依赖以避免循环
  
  // 处理值变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    inputBox.setValue(newValue)
    onChange?.(newValue)
  }, [inputBox.setValue, onChange])
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    inputBox.handleKeyDown(e)
    onKeyDown?.(e)
  }, [inputBox.handleKeyDown, onKeyDown])
  
  // 处理粘贴
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (enablePaste) {
      inputBox.handlePaste(e)
    }
  }, [enablePaste, inputBox.handlePaste])
  
  // 处理焦点
  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    inputBox.focusHandlers.onFocus()
    onFocus?.(e)
  }, [inputBox.focusHandlers, onFocus])
  
  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    inputBox.focusHandlers.onBlur()
    onBlur?.(e)
  }, [inputBox.focusHandlers, onBlur])
  
  // 处理文件选择
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      inputBox.addMultiple(Array.from(files), handleAttachmentAdd)
    }
    // 清空 input 值，允许重复选择同一文件
    e.target.value = ''
  }, [inputBox.addMultiple, handleAttachmentAdd])
  
  // 处理附件移除
  const handleRemoveAttachment = useCallback((id: string) => {
    const attachment = inputBox.attachments.find(att => att.id === id)
    inputBox.removeAttachment(id)
    if (attachment) {
      onAttachmentRemove?.(attachment)
    }
  }, [inputBox.attachments, inputBox.removeAttachment, onAttachmentRemove])
  
  // 处理建议选择
  const handleSuggestionSelect = useCallback((suggestion: Suggestion) => {
    inputBox.setValue(suggestion.text)
    onSuggestionSelect?.(suggestion)
  }, [inputBox.setValue, onSuggestionSelect])
  
  // 处理发送
  const handleSend = useCallback(() => {
    if (!inputBox.canSend || disabled || readOnly || loading) return
    
    // 验证
    if (!validation.valid) {
      onValidationError?.(validation.errors)
      return
    }
    
    inputBox.handleSend()
  }, [
    inputBox.canSend,
    inputBox.handleSend,
    disabled,
    readOnly,
    loading,
    validation,
    onValidationError,
  ])
  
  // 计算容器类名
  const containerClassName = [
    styles[CSS_CLASSES.container],
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    inputBox.isFocused && styles[CSS_CLASSES.focused],
    disabled && styles[CSS_CLASSES.disabled],
    streaming && styles[CSS_CLASSES.streaming],
    enableDragDrop && inputBox.isDragging && styles[CSS_CLASSES.dragging],
    !validation.valid && styles[CSS_CLASSES.error],
    className,
  ].filter(Boolean).join(' ')
  
  // 是否显示建议
  const shouldShowSuggestions = enableSuggestions &&
    showSuggestions &&
    suggestions.length > 0 &&
    inputBox.isFocused &&
    inputBox.value.length === 0
  
  return (
    <div
      className={containerClassName}
      style={style}
      {...(enableDragDrop ? inputBox.dragHandlers : {})}
      {...restProps}
    >
      {/* 建议列表 */}
      {shouldShowSuggestions && (
        <div className={styles[CSS_CLASSES.suggestions]}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className={styles[CSS_CLASSES.suggestionItem]}
              onClick={() => handleSuggestionSelect(suggestion)}
              aria-label={`${ARIA_LABELS.suggestionItem}: ${suggestion.text}`}
            >
              {suggestion.icon && <span className={styles.suggestionIcon}>{suggestion.icon}</span>}
              <span className={styles.suggestionText}>{suggestion.text}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* 附件预览 */}
      {inputBox.attachments.length > 0 && (
        <div className={styles[CSS_CLASSES.attachments]}>
          {inputBox.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={styles[CSS_CLASSES.attachmentItem]}
              data-status={attachment.status}
            >
              {/* 缩略图或图标 */}
              {attachment.thumbnail ? (
                <img
                  src={attachment.thumbnail}
                  alt={attachment.name}
                  className={styles.attachmentThumbnail}
                />
              ) : (
                <div className={styles.attachmentIcon}>
                  {attachment.type === 'image' && '🖼️'}
                  {attachment.type === 'document' && '📄'}
                  {attachment.type === 'audio' && '🎵'}
                  {attachment.type === 'video' && '🎬'}
                  {attachment.type === 'other' && '📎'}
                </div>
              )}
              
              {/* 文件信息 */}
              <div className={styles.attachmentInfo}>
                <div className={styles.attachmentName}>{attachment.name}</div>
                <div className={styles.attachmentSize}>
                  {formatFileSize(attachment.size)}
                </div>
              </div>
              
              {/* 进度条 */}
              {attachment.status === 'uploading' && (
                <div className={styles.attachmentProgress}>
                  <div
                    className={styles.attachmentProgressBar}
                    style={{ width: `${attachment.progress}%` }}
                  />
                </div>
              )}
              
              {/* 错误提示 */}
              {attachment.status === 'error' && attachment.error && (
                <div className={styles.attachmentError}>{attachment.error}</div>
              )}
              
              {/* 移除按钮 */}
              <button
                type="button"
                className={styles.attachmentRemove}
                onClick={() => handleRemoveAttachment(attachment.id)}
                aria-label={`${ARIA_LABELS.removeAttachment}: ${attachment.name}`}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* 输入区域 */}
      <div className={styles[CSS_CLASSES.inputContainer]}>
        {/* 文本输入框 */}
        <textarea
          ref={inputBox.textareaRef}
          className={styles[CSS_CLASSES.textarea]}
          value={inputBox.value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-label={ariaLabel}
          aria-invalid={!validation.valid}
          aria-describedby={validation.valid ? undefined : 'input-error'}
        />
        
        {/* 工具栏 */}
        <div className={styles[CSS_CLASSES.toolbar]}>
          {/* 左侧工具按钮 */}
          <div className={styles.toolbarLeft}>
            {/* 附件按钮 */}
            {enableAttachments && (
              <>
                <button
                  type="button"
                  className={styles[CSS_CLASSES.toolButton]}
                  onClick={handleFileSelect}
                  disabled={disabled || !inputBox.canAddMore}
                  aria-label={ARIA_LABELS.attachmentButton}
                  title="添加附件"
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={acceptedFileTypes.join(',')}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </>
            )}
            
            {/* 表情按钮 */}
            {enableEmoji && (
              <button
                type="button"
                className={styles[CSS_CLASSES.toolButton]}
                onClick={inputBox.emojiPicker.toggle}
                disabled={disabled}
                aria-label={ARIA_LABELS.emojiButton}
                title="选择表情"
              >
                😀
              </button>
            )}
            
            {/* 语音按钮 */}
            {enableVoice && (
              <button
                type="button"
                className={styles[CSS_CLASSES.toolButton]}
                disabled={disabled}
                aria-label={ARIA_LABELS.voiceButton}
                title="语音输入"
              >
                🎤
              </button>
            )}
          </div>
          
          {/* 右侧信息和发送按钮 */}
          <div className={styles.toolbarRight}>
            {/* 字符计数 */}
            {showCharCount && (
              <div
                className={styles.charCount}
                data-exceeded={inputBox.charCount.isExceeded}
                aria-label={ARIA_LABELS.charCount}
              >
                {inputBox.charCount.count}
                {maxLength && ` / ${maxLength}`}
              </div>
            )}
            
            {/* 快捷键提示 */}
            <div className={styles.shortcutHint}>
              {SHORTCUT_HINTS[sendShortcut]}
            </div>
            
            {/* 发送按钮 */}
            <button
              type="button"
              className={styles[CSS_CLASSES.sendButton]}
              onClick={handleSend}
              disabled={!inputBox.canSend || disabled || loading || !validation.valid}
              aria-label={ARIA_LABELS.sendButton}
              data-loading={loading}
            >
              {loading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 验证错误提示 */}
      {!validation.valid && validation.errors.length > 0 && (
        <div id="input-error" className={styles.errorMessage} role="alert">
          {validation.errors[0]}
        </div>
      )}
      
      {/* 上传中提示 */}
      {inputBox.isUploading && (
        <div className={styles.uploadingHint}>
          正在处理文件...
        </div>
      )}
    </div>
  )
}

export default InputBox


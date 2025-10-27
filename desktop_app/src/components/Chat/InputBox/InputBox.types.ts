/**
 * InputBox 组件类型定义
 * 
 * 提供完整的类型定义，确保类型安全和开发体验
 * @module InputBox.types
 */

import type { CSSProperties, KeyboardEvent, ChangeEvent, FocusEvent, DragEvent } from 'react'

// ==================== 文件类型相关 ====================

/**
 * 附件文件类型枚举
 */
export enum AttachmentType {
  /** 图片文件 */
  IMAGE = 'image',
  /** 文档文件 */
  DOCUMENT = 'document',
  /** 音频文件 */
  AUDIO = 'audio',
  /** 视频文件 */
  VIDEO = 'video',
  /** 其他类型文件 */
  OTHER = 'other',
}

/**
 * 附件上传状态
 */
export enum AttachmentStatus {
  /** 等待上传 */
  PENDING = 'pending',
  /** 正在上传 */
  UPLOADING = 'uploading',
  /** 上传成功 */
  SUCCESS = 'success',
  /** 上传失败 */
  FAILED = 'failed',
}

/**
 * 附件接口
 * @description 描述一个上传的附件
 */
export interface Attachment {
  /** 附件唯一标识符 */
  id: string
  /** 文件名称 */
  name: string
  /** 文件大小（字节） */
  size: number
  /** MIME 类型，例如 'image/png' */
  mimeType: string
  /** 文件 URL 或 Data URL */
  url: string
  /** 文件类型分类 */
  type: AttachmentType
  /** 上传状态 */
  status?: AttachmentStatus
  /** 上传进度 0-100 */
  progress?: number
  /** 预览 URL（通常用于图片缩略图） */
  previewUrl?: string
  /** 文件最后修改时间戳 */
  lastModified?: number
  /** 附件元数据 */
  metadata?: Record<string, unknown>
  /** 错误信息（上传失败时） */
  error?: string
}

/**
 * 附件验证结果
 */
export interface AttachmentValidation {
  /** 是否有效 */
  valid: boolean
  /** 错误消息 */
  error?: string
  /** 错误代码 */
  code?: 'SIZE_EXCEEDED' | 'TYPE_NOT_ALLOWED' | 'INVALID_FILE' | 'UNKNOWN'
}

// ==================== 建议相关 ====================

/**
 * 建议类型枚举
 */
export enum SuggestionType {
  /** 提示词 */
  PROMPT = 'prompt',
  /** 命令 */
  COMMAND = 'command',
  /** 模板 */
  TEMPLATE = 'template',
  /** 快捷回复 */
  QUICK_REPLY = 'quick_reply',
}

/**
 * 建议项接口
 * @description 描述一个输入建议
 */
export interface Suggestion {
  /** 建议唯一标识符 */
  id: string
  /** 建议显示文本 */
  text: string
  /** 建议图标（支持 emoji 或 React 节点） */
  icon?: React.ReactNode
  /** 建议类型 */
  type?: SuggestionType
  /** 建议描述（可选的额外说明） */
  description?: string
  /** 是否禁用此建议 */
  disabled?: boolean
  /** 建议的元数据 */
  metadata?: Record<string, unknown>
  /** 快捷键提示 */
  shortcut?: string
}

// ==================== 快捷键相关 ====================

/**
 * 发送快捷键类型
 */
export type SendShortcut = 'enter' | 'ctrl+enter' | 'cmd+enter' | 'shift+enter'

/**
 * 键盘快捷键配置
 */
export interface ShortcutConfig {
  /** 发送消息快捷键 */
  send?: SendShortcut
  /** 换行快捷键 */
  newLine?: SendShortcut
  /** 是否启用 Tab 缩进 */
  enableTab?: boolean
  /** 是否启用 Esc 清空 */
  enableEscClear?: boolean
}

// ==================== 验证相关 ====================

/**
 * 输入验证规则
 */
export interface ValidationRule {
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 正则表达式验证 */
  pattern?: RegExp
  /** 自定义验证函数 */
  validator?: (value: string) => boolean | string
  /** 错误消息 */
  message?: string
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 错误消息列表 */
  errors?: string[]
}

// ==================== 组件 Props ====================

/**
 * InputBox 组件属性
 * @description 输入框组件的完整配置选项
 */
export interface InputBoxProps {
  // -------- 基础属性 --------
  
  /** 输入值（受控组件模式） */
  value?: string
  /** 默认值（非受控组件模式） */
  defaultValue?: string
  /** 占位符文本 */
  placeholder?: string
  /** 是否禁用输入框 */
  disabled?: boolean
  /** 是否只读 */
  readOnly?: boolean
  /** 输入框名称（用于表单） */
  name?: string
  /** 输入框 ID */
  id?: string
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: CSSProperties
  /** 是否必填 */
  required?: boolean
  /** 输入框变体样式 */
  variant?: 'default' | 'outlined' | 'filled' | 'borderless'
  /** 输入框尺寸 */
  size?: 'small' | 'medium' | 'large'
  
  // -------- 状态属性 --------
  
  /** 是否正在发送消息 */
  isSending?: boolean
  /** 是否正在流式响应 */
  isStreaming?: boolean
  /** 是否正在流式响应（别名） */
  streaming?: boolean
  /** 是否处于错误状态 */
  hasError?: boolean
  /** 错误消息 */
  errorMessage?: string
  /** 是否显示加载指示器 */
  loading?: boolean
  
  // -------- 尺寸和布局 --------
  
  /** 最大字符数限制 */
  maxLength?: number
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
  /** 是否自动调整高度 */
  autoResize?: boolean
  /** 初始高度（像素） */
  initialHeight?: number
  
  // -------- 功能开关 --------
  
  /** 是否显示字符计数器 */
  showCharCount?: boolean
  /** 是否显示附件按钮 */
  showAttachmentButton?: boolean
  /** 是否启用附件功能 */
  enableAttachments?: boolean
  /** 是否显示表情选择器按钮 */
  showEmojiButton?: boolean
  /** 是否启用表情功能 */
  enableEmoji?: boolean
  /** 是否显示语音输入按钮 */
  showVoiceButton?: boolean
  /** 是否启用语音功能 */
  enableVoice?: boolean
  /** 是否显示格式化工具栏 */
  showFormatToolbar?: boolean
  /** 是否启用格式化功能 */
  enableFormatting?: boolean
  /** 是否显示建议提示 */
  showSuggestions?: boolean
  /** 是否启用建议功能 */
  enableSuggestions?: boolean
  /** 是否显示快捷键提示 */
  showShortcutHint?: boolean
  /** 是否启用拖拽上传 */
  enableDragDrop?: boolean
  /** 是否启用粘贴上传 */
  enablePasteUpload?: boolean
  /** 是否启用粘贴功能 */
  enablePaste?: boolean
  /** 是否启用自动补全 */
  enableAutocomplete?: boolean
  
  // -------- 建议和快捷键 --------
  
  /** 建议列表 */
  suggestions?: Suggestion[]
  /** 是否自动聚焦 */
  autoFocus?: boolean
  /** 是否启用快捷键 */
  enableShortcuts?: boolean
  /** 快捷键配置 */
  shortcutConfig?: ShortcutConfig
  /** 发送快捷键（向后兼容） */
  sendShortcut?: SendShortcut
  
  // -------- 文件上传配置 --------
  
  /** 允许的文件类型（MIME types 或扩展名） */
  acceptedFileTypes?: string[]
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 最大附件数量 */
  maxAttachments?: number
  /** 是否允许多个文件 */
  multiple?: boolean
  
  // -------- 验证 --------
  
  /** 验证规则 */
  validationRules?: ValidationRule[]
  /** 是否实时验证 */
  validateOnChange?: boolean
  /** 是否在失焦时验证 */
  validateOnBlur?: boolean
  
  // -------- 附件管理 --------
  
  /** 当前附件列表 */
  attachments?: Attachment[]
  /** 默认附件列表 */
  defaultAttachments?: Attachment[]
  
  // -------- 表情配置 --------
  
  /** 自定义表情列表 */
  customEmojis?: string[]
  /** 表情分类 */
  emojiCategories?: Array<{
    name: string
    emojis: string[]
    icon?: string
  }>
  
  // -------- 事件回调 --------
  
  /** 值变化时触发 */
  onChange?: (value: string, event?: ChangeEvent<HTMLTextAreaElement>) => void
  /** 发送消息时触发 */
  onSend?: (message: string, attachments?: Attachment[]) => void | Promise<void>
  /** 聚焦时触发 */
  onFocus?: (event?: FocusEvent<HTMLTextAreaElement>) => void
  /** 失焦时触发 */
  onBlur?: (event?: FocusEvent<HTMLTextAreaElement>) => void
  /** 键盘按下时触发 */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  /** 键盘抬起时触发 */
  onKeyUp?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  /** 按下 Enter 键时触发 */
  onEnter?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  /** 高度变化时触发 */
  onHeightChange?: (height: number) => void
  /** 验证失败时触发 */
  onValidationError?: (errors: string[]) => void
  
  // -------- 附件事件 --------
  
  /** 添加附件时触发（需返回处理后的附件信息） */
  onAttachmentAdd?: (file: File) => Promise<Attachment> | Attachment
  /** 移除附件时触发 */
  onAttachmentRemove?: (attachmentId: string) => void
  /** 附件上传进度变化时触发 */
  onAttachmentProgress?: (attachmentId: string, progress: number) => void
  /** 附件验证失败时触发 */
  onAttachmentValidationError?: (file: File, validation: AttachmentValidation) => void
  /** 拖拽文件进入时触发 */
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void
  /** 拖拽文件离开时触发 */
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void
  /** 拖拽文件放下时触发 */
  onDrop?: (files: File[], event: DragEvent<HTMLDivElement>) => void
  
  // -------- 表情和语音 --------
  
  /** 选择表情时触发 */
  onEmojiSelect?: (emoji: string) => void
  /** 表情选择器打开/关闭时触发 */
  onEmojiToggle?: (isOpen: boolean) => void
  /** 开始语音输入时触发 */
  onVoiceStart?: () => void | Promise<void>
  /** 停止语音输入时触发 */
  onVoiceStop?: () => void
  /** 语音输入结果时触发 */
  onVoiceResult?: (text: string) => void
  /** 语音输入错误时触发 */
  onVoiceError?: (error: Error) => void
  
  // -------- 建议相关 --------
  
  /** 选择建议时触发 */
  onSuggestionSelect?: (suggestion: Suggestion) => void
  /** 建议列表过滤函数 */
  onSuggestionFilter?: (suggestions: Suggestion[], query: string) => Suggestion[]
  
  // -------- 高级功能 --------
  
  /** 粘贴内容时触发（可用于自定义粘贴处理） */
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  /** 内容为空状态变化时触发 */
  onEmptyChange?: (isEmpty: boolean) => void
  /** 组件挂载完成时触发 */
  onMount?: () => void
  /** 组件卸载时触发 */
  onUnmount?: () => void
  
  // -------- ARIA 和无障碍 --------
  
  /** ARIA 标签 */
  'aria-label'?: string
  /** ARIA 描述 */
  'aria-describedby'?: string
  /** ARIA 必填标识 */
  'aria-required'?: boolean
  /** ARIA 无效标识 */
  'aria-invalid'?: boolean
  /** Tab 索引 */
  tabIndex?: number
}

// ==================== Ref 接口 ====================

/**
 * InputBox 组件 Ref 方法
 * @description 通过 ref 可以调用的方法
 */
export interface InputBoxRef {
  /** 聚焦输入框 */
  focus: () => void
  /** 失焦输入框 */
  blur: () => void
  /** 清空输入内容 */
  clear: () => void
  /** 重置到初始值 */
  reset: () => void
  /** 在光标位置插入文本 */
  insertText: (text: string) => void
  /** 在末尾追加文本 */
  appendText: (text: string) => void
  /** 获取当前输入值 */
  getValue: () => string
  /** 设置输入值 */
  setValue: (value: string) => void
  /** 获取字符数 */
  getCharCount: () => number
  /** 获取选中的文本 */
  getSelectedText: () => string
  /** 设置选中范围 */
  setSelectionRange: (start: number, end: number) => void
  /** 获取光标位置 */
  getCursorPosition: () => number
  /** 设置光标位置 */
  setCursorPosition: (position: number) => void
  /** 滚动到底部 */
  scrollToBottom: () => void
  /** 滚动到顶部 */
  scrollToTop: () => void
  /** 获取输入框高度 */
  getHeight: () => number
  /** 手动触发验证 */
  validate: () => ValidationResult
  /** 获取 textarea 元素 */
  getTextAreaElement: () => HTMLTextAreaElement | null
  /** 获取所有附件 */
  getAttachments: () => Attachment[]
  /** 添加附件 */
  addAttachment: (attachment: Attachment) => void
  /** 清空所有附件 */
  clearAttachments: () => void
  /** 是否为空 */
  isEmpty: () => boolean
  /** 是否可以发送 */
  canSend: () => boolean
}

// ==================== 实用类型 ====================

/**
 * 文件验证器函数类型
 */
export type FileValidator = (file: File) => AttachmentValidation | Promise<AttachmentValidation>

/**
 * 文件大小格式化选项
 */
export interface FileSizeFormatOptions {
  /** 精度（小数位数） */
  precision?: number
  /** 单位系统 */
  unit?: 'binary' | 'decimal'
  /** 语言 */
  locale?: string
}

/**
 * 常用文件类型常量
 */
export const FILE_TYPES = {
  IMAGE: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
} as const

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  MAX_LENGTH: 10000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ATTACHMENTS: 5,
  MIN_ROWS: 1,
  MAX_ROWS: 10,
  SEND_SHORTCUT: 'ctrl+enter' as SendShortcut,
} as const

